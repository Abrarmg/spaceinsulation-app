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
    console.error('[meta-subscribe-page] Server configuration missing (ANON_KEY or SERVICE_ROLE_KEY).');
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
    console.error('[meta-subscribe-page] Error verifying user session:', err?.message);
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
      message: 'Forbidden. You do not have permission to configure Facebook subscriptions.',
    });
  }

  // 5. Find the user's connected Meta integration
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

  // 6. Find the Facebook Page where is_selected = true
  const { data: selectedPage, error: pageError } = await supabaseAdmin
    .from('meta_pages')
    .select('id, integration_id, facebook_page_id, page_name, page_access_token, is_selected')
    .eq('integration_id', integration.id)
    .eq('is_selected', true)
    .maybeSingle();

  if (pageError || !selectedPage || !selectedPage.page_access_token) {
    return res.status(404).json({
      success: false,
      message: 'No selected Facebook Page found. Please select a Facebook Page first.',
    });
  }

  const pageId = selectedPage.facebook_page_id;
  const pageToken = selectedPage.page_access_token;
  const pageName = selectedPage.page_name;

  try {
    // 7. Call Meta Graph API: POST /{facebook_page_id}/subscribed_apps
    const subscribeUrl = `https://graph.facebook.com/v21.0/${pageId}/subscribed_apps`;
    const postResponse = await fetch(subscribeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pageToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({ subscribed_fields: 'leadgen' }).toString(),
    });

    const postData: any = await postResponse.json();

    if (!postResponse.ok || !postData?.success) {
      const errorMsg = postData?.error?.message || 'Failed to subscribe Page to app webhooks.';
      const errorCode = postData?.error?.code;
      console.error('[meta-subscribe-page] Meta subscribed_apps POST failed:', {
        status: postResponse.status,
        error: errorMsg,
        code: errorCode,
      });

      return res.status(502).json({
        success: false,
        subscribed: false,
        message: errorMsg,
        error_code: errorCode,
        error_details: postData?.error || null,
      });
    }

    console.log('[meta-subscribe-page] Successfully subscribed Page to leadgen:', pageId);

    // 8. Verify Page subscription: GET /{facebook_page_id}/subscribed_apps
    const verifyResponse = await fetch(subscribeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${pageToken}`,
        'Accept': 'application/json',
      },
    });

    const verifyData: any = await verifyResponse.json();

    if (!verifyResponse.ok) {
      const verifyErrorMsg = verifyData?.error?.message || 'Failed to verify Page subscription with Meta.';
      const verifyErrorCode = verifyData?.error?.code;
      console.warn('[meta-subscribe-page] Meta subscribed_apps GET verification returned error:', {
        status: verifyResponse.status,
        error: verifyErrorMsg,
        code: verifyErrorCode,
      });

      return res.status(200).json({
        success: true,
        subscribed: true,
        page_id: pageId,
        page_name: pageName,
        subscribed_fields: ['leadgen'],
        verification: {
          verified: false,
          error_message: verifyErrorMsg,
          error_code: verifyErrorCode,
          error_type: verifyData?.error?.type || 'OAuthException',
        },
        message: `Page "${pageName}" was successfully subscribed to leadgen webhooks. Note: Meta subscription verification returned: ${verifyErrorMsg}`,
      });
    }

    const appEntries = Array.isArray(verifyData?.data) ? verifyData.data : [];
    const leadgenActive = appEntries.some((app: any) =>
      Array.isArray(app?.subscribed_fields) && app.subscribed_fields.includes('leadgen')
    );

    return res.status(200).json({
      success: true,
      subscribed: true,
      page_id: pageId,
      page_name: pageName,
      subscribed_fields: ['leadgen'],
      verification: {
        verified: true,
        leadgen_active: leadgenActive,
        apps: appEntries.map((app: any) => ({
          id: app.id,
          name: app.name,
          subscribed_fields: app.subscribed_fields,
        })),
      },
      message: `Page "${pageName}" successfully subscribed and verified for leadgen webhooks.`,
    });
  } catch (err: any) {
    console.error('[meta-subscribe-page] Unexpected exception during subscription:', err?.message);
    return res.status(500).json({
      success: false,
      message: 'Unexpected server error subscribing Facebook Page to webhooks.',
    });
  }
}
