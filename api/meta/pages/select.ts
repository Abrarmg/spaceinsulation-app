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
    console.error('[meta-pages-select] Server configuration missing (ANON_KEY or SERVICE_ROLE_KEY).');
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
    console.error('[meta-pages-select] Error verifying user session:', err?.message);
    return res.status(401).json({
      success: false,
      message: 'Failed to verify authentication session.',
    });
  }

  // 4. Verify user role in profiles table (office_staff or admin)
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
      message: 'Forbidden. You do not have permission to configure Facebook Pages.',
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

  const targetPageId = body?.facebook_page_id || body?.page_id || body?.id;
  if (!targetPageId || typeof targetPageId !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'facebook_page_id is required.',
    });
  }

  // 5. Find the user's connected record in meta_integrations
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

  // 6. Verify that the Page belongs to that user's connected Meta integration
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

  // 7. Update selection:
  // Set all other Pages for the same integration to is_selected = false
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

  // Set that Page's is_selected = true
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

  // 8. Return safe response without exposing any access token
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
