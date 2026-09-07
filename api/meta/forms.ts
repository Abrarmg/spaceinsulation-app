import { createClient } from '@supabase/supabase-js';

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
  const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

  const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  const anonKey = rawAnonKey ? rawAnonKey.replace(/[\n\r\s"']+/g, '') : null;

  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = rawServiceKey ? rawServiceKey.replace(/[\n\r\s"']+/g, '') : null;

  return { supabaseUrl, anonKey, serviceKey };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // 1. Require Bearer token in Authorization header
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid session token via Authorization: Bearer header.',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is empty.',
    });
  }

  // 2. Validate Supabase environment configuration
  const { supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!anonKey || !serviceKey) {
    console.error('[meta-forms] Server configuration missing (ANON_KEY or SERVICE_ROLE_KEY).');
    return res.status(500).json({
      success: false,
      message: 'Server configuration error.',
    });
  }

  // 3. Verify user identity server-side via Supabase auth
  let verifiedUserId: string;
  try {
    const verifyClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
    if (userError || !userData?.user?.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication session.',
      });
    }
    verifiedUserId = userData.user.id;
  } catch (err: any) {
    console.error('[meta-forms] Error verifying user session:', err?.message);
    return res.status(401).json({
      success: false,
      message: 'Failed to verify authentication session.',
    });
  }

  // 4. Verify user permissions in profiles table (office_staff or admin)
  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', verifiedUserId)
    .single();

  if (
    profileError ||
    !callerProfile ||
    (callerProfile.role !== 'office_staff' && callerProfile.role !== 'admin')
  ) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. You do not have permission to view Lead Forms.',
    });
  }

  // 5. Find that user's connected Meta integration
  const { data: integration, error: integError } = await supabaseAdmin
    .from('meta_integrations')
    .select('id, user_id, status')
    .eq('user_id', callerProfile.id)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integError || !integration) {
    return res.status(404).json({
      success: false,
      message: 'No connected Meta integration found for this user.',
    });
  }

  // 6. Find the Page where is_selected = true
  const { data: selectedPage, error: pageError } = await supabaseAdmin
    .from('meta_pages')
    .select('id, integration_id, facebook_page_id, page_name, page_access_token, is_selected')
    .eq('integration_id', integration.id)
    .eq('is_selected', true)
    .maybeSingle();

  if (pageError || !selectedPage || !selectedPage.page_access_token) {
    return res.status(404).json({
      success: false,
      message: 'No selected Facebook Page found. Please select a page first.',
    });
  }

  // 7. Call Meta Graph API to retrieve Lead Ads forms for that Page
  try {
    const formsUrl = new URL(`https://graph.facebook.com/v21.0/${selectedPage.facebook_page_id}/leadgen_forms`);
    formsUrl.searchParams.set('fields', 'id,name,status');

    const metaResponse = await fetch(formsUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${selectedPage.page_access_token}`,
        'Accept': 'application/json',
      },
    });

    const metaData: any = await metaResponse.json();

    if (!metaResponse.ok || !metaData || !Array.isArray(metaData.data)) {
      console.error('[meta-forms] Meta Graph API returned error:', {
        status: metaResponse.status,
        error: metaData?.error?.message,
      });

      // Check if we already have previously saved forms for this page in database
      const { data: existingForms } = await supabaseAdmin
        .from('meta_lead_forms')
        .select('facebook_form_id, form_name, form_status')
        .eq('page_id', selectedPage.id);

      if (existingForms && existingForms.length > 0) {
        return res.status(200).json({
          success: true,
          forms: existingForms,
        });
      }

      return res.status(502).json({
        success: false,
        message: metaData?.error?.message || 'Failed to retrieve Lead Forms from Meta.',
        forms: [],
      });
    }

    const rawForms: any[] = metaData.data;

    // 8. Upsert the forms returned by Meta into meta_lead_forms
    if (rawForms.length > 0) {
      const upsertRows = rawForms.map((form: any) => ({
        page_id: selectedPage.id,
        facebook_form_id: String(form.id),
        form_name: String(form.name || 'Untitled Form'),
        form_status: String(form.status || 'ACTIVE'),
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabaseAdmin
        .from('meta_lead_forms')
        .upsert(upsertRows, { onConflict: 'facebook_form_id' });

      if (upsertErr) {
        console.error('[meta-forms] Failed to upsert meta_lead_forms:', upsertErr.message);
      }
    }

    // 9. Query and return only safe metadata
    // Never return Meta or Page access tokens to the frontend
    const { data: dbForms } = await supabaseAdmin
      .from('meta_lead_forms')
      .select('facebook_form_id, form_name, form_status')
      .eq('page_id', selectedPage.id);

    const safeForms = (dbForms && dbForms.length > 0)
      ? dbForms
      : rawForms.map((form: any) => ({
          facebook_form_id: String(form.id),
          form_name: String(form.name || 'Untitled Form'),
          form_status: String(form.status || 'ACTIVE'),
        }));

    return res.status(200).json({
      success: true,
      forms: safeForms,
    });
  } catch (err: any) {
    console.error('[meta-forms] Unexpected error retrieving Lead Forms:', err?.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error while retrieving Lead Forms.',
      forms: [],
    });
  }
}
