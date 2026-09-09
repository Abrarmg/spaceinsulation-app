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

async function verifyAuth(req: any) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return {
      error: {
        status: 401,
        message: 'Authentication required. Please provide a valid session token via Authorization: Bearer header.',
      },
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      error: {
        status: 401,
        message: 'Authentication token is empty.',
      },
    };
  }

  const { supabaseUrl, anonKey, serviceKey } = getSupabaseConfig();
  if (!anonKey || !serviceKey) {
    return {
      error: {
        status: 500,
        message: 'Server configuration error.',
      },
    };
  }

  const verifyClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await verifyClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      error: {
        status: 401,
        message: 'Invalid or expired authentication session.',
      },
    };
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .single();

  if (
    profileError ||
    !callerProfile ||
    (callerProfile.role !== 'office_staff' && callerProfile.role !== 'admin')
  ) {
    return {
      error: {
        status: 403,
        message: 'Forbidden. You do not have permission to manage Facebook Pages.',
      },
    };
  }

  return {
    userId: userData.user.id,
    profileId: callerProfile.id,
    supabaseAdmin,
  };
}

// --------------------------------------------------------------------------
// GET /api/meta/pages - Retrieve Pages
// --------------------------------------------------------------------------
async function handleGetPages(req: any, res: any) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { profileId, supabaseAdmin } = auth;

  // 1. Find the user's connected record in meta_integrations
  const { data: integration, error: integError } = await supabaseAdmin
    .from('meta_integrations')
    .select('id, user_id, access_token, status')
    .eq('user_id', profileId)
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

  // 2. Call Meta Graph API to retrieve Facebook Pages
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

    // 3. Save / upsert the Pages returned by Meta into public.meta_pages
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

    // 4. Return ONLY safe page metadata to the frontend (no access tokens)
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

// --------------------------------------------------------------------------
// POST /api/meta/pages - Select Page
// --------------------------------------------------------------------------
async function handleSelectPage(req: any, res: any) {
  const auth = await verifyAuth(req);
  if (auth.error) {
    return res.status(auth.error.status).json({ success: false, message: auth.error.message });
  }

  const { profileId, supabaseAdmin } = auth;

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // ignore
    }
  }

  const targetPageId = body?.facebook_page_id || body?.page_id || body?.id;
  if (!targetPageId || typeof targetPageId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'facebook_page_id is required.',
    });
  }

  // 1. Find user's connected Meta integration
  const { data: integration, error: integError } = await supabaseAdmin
    .from('meta_integrations')
    .select('id, user_id, status')
    .eq('user_id', profileId)
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

  // 2. Verify Page belongs to that user's connected integration
  const { data: pageRecord, error: pageErr } = await supabaseAdmin
    .from('meta_pages')
    .select('id, integration_id, facebook_page_id, page_name')
    .eq('integration_id', integration.id)
    .eq('facebook_page_id', targetPageId.trim())
    .maybeSingle();

  if (pageErr || !pageRecord) {
    return res.status(404).json({
      success: false,
      message: 'Facebook Page not found or does not belong to your connected integration.',
    });
  }

  // 3. Atomically deselect others and select target page
  const now = new Date().toISOString();

  const { error: deselectErr } = await supabaseAdmin
    .from('meta_pages')
    .update({ is_selected: false, updated_at: now })
    .eq('integration_id', integration.id);

  if (deselectErr) {
    console.error('[meta-pages-select] Failed to deselect previous pages:', deselectErr.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Page selection.',
    });
  }

  const { error: selectErr } = await supabaseAdmin
    .from('meta_pages')
    .update({ is_selected: true, updated_at: now })
    .eq('id', pageRecord.id);

  if (selectErr) {
    console.error('[meta-pages-select] Failed to select page:', selectErr.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to update Page selection.',
    });
  }

  return res.status(200).json({
    success: true,
    message: `Page "${pageRecord.page_name}" selected successfully.`,
    selected_page: {
      facebook_page_id: pageRecord.facebook_page_id,
      page_name: pageRecord.page_name,
      is_selected: true,
    },
  });
}

// --------------------------------------------------------------------------
// MAIN ENTRYPOINT: /api/meta/pages
// --------------------------------------------------------------------------
export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    return await handleGetPages(req, res);
  }

  if (req.method === 'POST') {
    return await handleSelectPage(req, res);
  }

  return res.status(405).json({ success: false, message: 'Method Not Allowed' });
}
