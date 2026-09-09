/// <reference types="node" />
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
    console.error('[meta-pages] Server configuration missing (ANON_KEY or SERVICE_ROLE_KEY).');
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
    console.error('[meta-pages] Error verifying user session:', err?.message);
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
      message: 'Forbidden. You do not have permission to view connected Facebook Pages.',
    });
  }

  // 5. Find the user's connected record in meta_integrations
  const { data: integration, error: integError } = await supabaseAdmin
    .from('meta_integrations')
    .select('id, user_id, access_token, status')
    .eq('user_id', callerProfile.id)
    .eq('status', 'connected')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (integError || !integration || !integration.access_token) {
    return res.status(404).json({
      success: false,
      message: 'No connected Meta integration found for this user.',
    });
  }

  // 6. Call Meta Graph API to retrieve Facebook Pages
  try {
    const pagesUrl = new URL('https://graph.facebook.com/v21.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,access_token,picture{url}');

    const metaResponse = await fetch(pagesUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${integration.access_token}`,
        'Accept': 'application/json',
      },
    });

    const metaData: any = await metaResponse.json();

    if (!metaResponse.ok || !metaData || !Array.isArray(metaData.data)) {
      console.error('[meta-pages] Meta Graph API returned error:', {
        status: metaResponse.status,
        error: metaData?.error?.message,
      });
      return res.status(502).json({
        success: false,
        message: metaData?.error?.message || 'Failed to retrieve Facebook Pages from Meta.',
      });
    }

    const rawPages: any[] = metaData.data;

    // 7. Save / upsert the Pages returned by Meta into public.meta_pages
    if (rawPages.length > 0) {
      const upsertRows = rawPages.map((page: any) => ({
        integration_id: integration.id,
        facebook_page_id: String(page.id),
        page_name: String(page.name),
        page_access_token: String(page.access_token || ''),
        updated_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabaseAdmin
        .from('meta_pages')
        .upsert(upsertRows, { onConflict: 'facebook_page_id' });

      if (upsertErr) {
        console.error('[meta-pages] Failed to upsert meta_pages:', upsertErr.message);
      }
    }

    // Fetch existing selection status if any
    const { data: existingPages } = await supabaseAdmin
      .from('meta_pages')
      .select('facebook_page_id, is_selected')
      .eq('integration_id', integration.id);

    const selectionMap = new Map<string, boolean>();
    if (existingPages) {
      for (const ep of existingPages) {
        selectionMap.set(ep.facebook_page_id, ep.is_selected ?? false);
      }
    }

    // 8. Return ONLY safe page metadata to the frontend
    // NEVER return any Meta access token or page access token
    const safePages = rawPages.map((page: any) => {
      const pageId = String(page.id);
      return {
        facebook_page_id: pageId,
        page_name: String(page.name),
        picture: page.picture?.data?.url || null,
        is_selected: selectionMap.get(pageId) ?? false,
      };
    });

    return res.status(200).json({
      success: true,
      pages: safePages,
    });
  } catch (err: any) {
    console.error('[meta-pages] Unexpected error querying Facebook Pages:', err?.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error while retrieving Facebook Pages.',
    });
  }
}
