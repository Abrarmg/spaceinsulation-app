/// <reference types="node" />
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const STATE_COOKIE_NAME = 'meta_oauth_state';

function sanitizeReturnTo(path?: unknown): string {
  if (typeof path !== 'string' || !path) {
    return '/';
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }
  return trimmed;
}

function getMetaConfig() {
  const appId = (process.env.META_APP_ID || process.env.VITE_META_APP_ID || '').trim();
  const appSecret = (process.env.META_APP_SECRET || '').trim();
  const configId = (process.env.META_FB_CONFIG_ID || process.env.VITE_META_FB_CONFIG_ID || '').trim();
  const redirectUri = (process.env.META_REDIRECT_URI || process.env.VITE_META_REDIRECT_URI || '').trim();

  const missing: string[] = [];
  if (!appId) missing.push('META_APP_ID');
  if (!appSecret) missing.push('META_APP_SECRET');
  if (!configId) missing.push('META_FB_CONFIG_ID');
  if (!redirectUri) missing.push('META_REDIRECT_URI');

  if (missing.length > 0) {
    return { config: null, missing };
  }

  return {
    config: { appId, appSecret, configId, redirectUri },
    missing: [],
  };
}

function getQueryParams(req: any): Record<string, string> {
  const query: Record<string, string> = {};
  if (req?.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (typeof v === 'string') {
        query[k] = v;
      } else if (Array.isArray(v) && typeof v[0] === 'string') {
        query[k] = v[0];
      }
    }
  }
  if (Object.keys(query).length === 0 && req?.url && typeof req.url === 'string' && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      searchParams.forEach((val, key) => {
        query[key] = val;
      });
    } catch {
      // ignore
    }
  }
  return query;
}

function createSignedState(secret: string, returnTo: string | undefined, userId: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = {
    nonce,
    ts: Date.now(),
    returnTo: sanitizeReturnTo(returnTo),
    userId,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
  const state = `${payloadB64}.${signature}`;
  return { state, nonce };
}

function buildStateCookie(nonce: string, isSecure: boolean): string {
  const secureFlag = isSecure ? '; Secure' : '';
  return `${STATE_COOKIE_NAME}=${encodeURIComponent(nonce)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag}`;
}

function safeRedirect(res: any, location: string): void {
  if (typeof res?.redirect === 'function') {
    res.redirect(location);
    return;
  }
  res.writeHead(302, { Location: location });
  res.end();
}

export default async function handler(req: any, res: any) {
  // Allow GET and POST for initiating OAuth
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  // 1. Validate Meta server configuration
  const { config, missing } = getMetaConfig();
  if (!config) {
    console.error('[meta-connect] Missing required environment configuration:', missing.join(', '));
    return res.status(500).json({
      success: false,
      message: `Server configuration missing: ${missing.join(', ')}`,
    });
  }

  // 2. Extract Supabase session token strictly from Authorization: Bearer header
  // Tokens are NEVER accepted from query parameters to prevent leakage in URLs, browser history, or logs.
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required. Please provide a valid session token via the Authorization: Bearer header.',
    });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is empty.',
    });
  }

  // 3. Verify the authenticated Space Insulation user with Supabase server-side
  const rawAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!rawAnonKey) {
    return res.status(500).json({ success: false, message: 'Server configuration missing (ANON_KEY).' });
  }
  const anonKey = rawAnonKey.replace(/[\n\r\s"']+/g, '');

  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
  const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

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
    console.error('[meta-connect] Exception during session verification:', err?.message);
    return res.status(401).json({
      success: false,
      message: 'Failed to verify authentication session.',
    });
  }

  // 4. Verify user permissions in profiles table (must be office_staff or admin)
  const rawServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  if (!rawServiceKey) {
    return res.status(500).json({ success: false, message: 'Server configuration missing (SERVICE_ROLE_KEY).' });
  }
  const serviceKey = rawServiceKey.replace(/[\n\r\s"']+/g, '');

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
      message: 'You do not have permission to connect Facebook Lead Ads.',
    });
  }

  try {
    const query = getQueryParams(req);
    const returnTo = query.return_to;

    // 5. Create signed OAuth state sealed with the verified user ID
    const { state, nonce } = createSignedState(config.appSecret, returnTo, callerProfile.id);

    const isSecure =
      process.env.NODE_ENV === 'production' ||
      req.headers?.['x-forwarded-proto'] === 'https';

    res.setHeader('Set-Cookie', buildStateCookie(nonce, isSecure));

    const authUrl = new URL('https://www.facebook.com/v21.0/dialog/oauth');
    authUrl.searchParams.set('client_id', config.appId);
    authUrl.searchParams.set('redirect_uri', config.redirectUri);
    authUrl.searchParams.set('config_id', config.configId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // If requested via JSON API or POST, return the destination URL directly
    if (req.method === 'POST' || req.headers?.accept?.includes('application/json')) {
      return res.status(200).json({
        success: true,
        url: authUrl.toString(),
      });
    }

    // Otherwise redirect
    return safeRedirect(res, authUrl.toString());
  } catch (err: any) {
    console.error('[meta-connect] Unexpected error initiating Meta OAuth:', err?.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate Facebook Login for Business.',
    });
  }
}
