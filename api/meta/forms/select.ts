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
  if (req.method !== 'POST') {
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
    console.error('[meta-forms-select] Server configuration missing (ANON_KEY or SERVICE_ROLE_KEY).');
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
    console.error('[meta-forms-select] Error verifying user session:', err?.message);
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
      message: 'Forbidden. You do not have permission to configure Lead Forms.',
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
    .select('id, integration_id, facebook_page_id, page_name, is_selected')
    .eq('integration_id', integration.id)
    .eq('is_selected', true)
    .maybeSingle();

  if (pageError || !selectedPage) {
    return res.status(404).json({
      success: false,
      message: 'No selected Facebook Page found. Please select a page first.',
    });
  }

  // Parse body safely
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  const rawFormIds = body?.form_ids;
  if (!Array.isArray(rawFormIds)) {
    return res.status(400).json({
      success: false,
      message: 'form_ids must be an array of Facebook form IDs.',
    });
  }

  const formIds: string[] = rawFormIds.map(String).map((id) => id.trim()).filter(Boolean);

  // 7. Verify all selected forms belong to the user's selected Facebook Page
  if (formIds.length > 0) {
    const { data: matchedForms, error: matchError } = await supabaseAdmin
      .from('meta_lead_forms')
      .select('id, facebook_form_id, form_name')
      .eq('page_id', selectedPage.id)
      .in('facebook_form_id', formIds);

    if (matchError || !matchedForms || matchedForms.length !== formIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more selected forms do not belong to the selected Facebook Page.',
      });
    }
  }

  // 8. Atomically update selections:
  const now = new Date().toISOString();

  // Set is_selected = false for all forms on this Page
  const { error: deselectErr } = await supabaseAdmin
    .from('meta_lead_forms')
    .update({ is_selected: false, updated_at: now })
    .eq('page_id', selectedPage.id);

  if (deselectErr) {
    console.error('[meta-forms-select] Failed to reset previous form selections:', deselectErr.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Lead Form selections.',
    });
  }

  // Set is_selected = true for the selected forms
  if (formIds.length > 0) {
    const { error: selectErr } = await supabaseAdmin
      .from('meta_lead_forms')
      .update({ is_selected: true, updated_at: now })
      .eq('page_id', selectedPage.id)
      .in('facebook_form_id', formIds);

    if (selectErr) {
      console.error('[meta-forms-select] Failed to update form selections:', selectErr.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to update Lead Form selections.',
      });
    }
  }

  // 9. Query and return updated forms list and selected forms
  // Never return Meta or Page access tokens to the frontend
  const { data: updatedForms } = await supabaseAdmin
    .from('meta_lead_forms')
    .select('facebook_form_id, form_name, form_status, is_selected')
    .eq('page_id', selectedPage.id);

  const safeForms = updatedForms || [];
  const selectedForms = safeForms.filter((f) => f.is_selected);

  return res.status(200).json({
    success: true,
    message: `Updated Lead Forms selection (${selectedForms.length} selected).`,
    forms: safeForms,
    selected_forms: selectedForms,
  });
}
