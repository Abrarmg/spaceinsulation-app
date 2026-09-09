/// <reference types="node" />
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const STATE_COOKIE_NAME = 'meta_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

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

function getSupabaseConfig() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
  const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

  const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
  const serviceKey = rawKey ? rawKey.replace(/[\n\r\s"']+/g, '') : null;

  return { supabaseUrl, serviceKey };
}

function parseCookies(req: any): Record<string, string> {
  if (req?.cookies && typeof req.cookies === 'object') {
    return req.cookies;
  }
  const cookieHeader = req?.headers?.cookie;
  if (!cookieHeader || typeof cookieHeader !== 'string') return {};

  const cookies: Record<string, string> = {};
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const idx = part.indexOf('=');
    if (idx !== -1) {
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      if (key) {
        try {
          cookies[key] = decodeURIComponent(val);
        } catch {
          cookies[key] = val;
        }
      }
    }
  }
  return cookies;
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

function verifySignedState(
  state: string,
  secret: string,
  cookieNonce?: string | null
): { isValid: boolean; error?: string; returnTo?: string; userId?: string | null } {
  if (!state || typeof state !== 'string') {
    return { isValid: false, error: 'State parameter missing' };
  }

  const dotIdx = state.indexOf('.');
  if (dotIdx === -1) {
    return { isValid: false, error: 'Malformed state parameter' };
  }

  const payloadB64 = state.slice(0, dotIdx);
  const signature = state.slice(dotIdx + 1);

  const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSig);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    return { isValid: false, error: 'Invalid state signature' };
  }

  let payload: { nonce: string; ts: number; returnTo?: string; userId?: string | null };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return { isValid: false, error: 'Invalid state encoding' };
  }

  if (!payload?.nonce || typeof payload.ts !== 'number') {
    return { isValid: false, error: 'Invalid state payload' };
  }

  if (Date.now() - payload.ts > STATE_TTL_MS) {
    return { isValid: false, error: 'State has expired' };
  }

  if (cookieNonce && cookieNonce !== payload.nonce) {
    return { isValid: false, error: 'CSRF state verification failed' };
  }

  return { isValid: true, returnTo: payload.returnTo, userId: payload.userId || null };
}

function buildClearStateCookie(isSecure: boolean): string {
  const secureFlag = isSecure ? '; Secure' : '';
  return `${STATE_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

function getAppOrigin(req: any, redirectUri: string): string {
  if (redirectUri) {
    try {
      return new URL(redirectUri).origin;
    } catch {
      // Fall through to request headers
    }
  }

  const host = req?.headers?.['x-forwarded-host'] || req?.headers?.host;
  const proto = req?.headers?.['x-forwarded-proto'] || 'https';
  if (host) {
    return `${proto}://${host}`;
  }

  return '';
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
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { config, missing } = getMetaConfig();
  if (!config) {
    console.error('[meta-callback] Missing required environment configuration:', missing.join(', '));
    return res.status(500).json({
      success: false,
      message: `Server configuration missing: ${missing.join(', ')}`,
    });
  }

  const isSecure =
    process.env.NODE_ENV === 'production' ||
    req.headers?.['x-forwarded-proto'] === 'https';

  // Always clear the state cookie once the callback is triggered
  res.setHeader('Set-Cookie', buildClearStateCookie(isSecure));

  const appOrigin = getAppOrigin(req, config.redirectUri);
  const query = getQueryParams(req);

  // 1. Handle errors returned directly from Meta dialog (e.g. user denied permissions)
  const metaError = query.error || query.error_message;
  if (metaError) {
    console.warn('[meta-callback] Meta OAuth error returned by provider:', {
      error: metaError,
      description: query.error_description || query.error_reason,
    });

    const errorUrl = new URL(appOrigin || '/');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', String(metaError));
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }

  const code = query.code;
  const state = query.state;

  if (!code || !state) {
    console.warn('[meta-callback] Missing required code or state parameter');
    const errorUrl = new URL(appOrigin || '/');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'missing_code_or_state');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }

  // 2. Validate OAuth state parameter and CSRF cookie
  const cookies = parseCookies(req);
  const cookieNonce = cookies[STATE_COOKIE_NAME] || null;

  const stateVerification = verifySignedState(state, config.appSecret, cookieNonce);
  if (!stateVerification.isValid) {
    console.warn('[meta-callback] State verification failed:', stateVerification.error);
    const errorUrl = new URL(appOrigin || '/');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'invalid_state');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }

  const returnPath = stateVerification.returnTo || '/';

  // 3. Strict User Association Validation
  // A Facebook connection must NEVER be attached to an arbitrary user.
  // There is NO fallback to arbitrary office_staff/admin profiles.
  const verifiedUserId = stateVerification.userId;
  if (!verifiedUserId) {
    console.error('[meta-callback] State is missing verified user ID. Connection rejected.');
    const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'unauthenticated_user');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }

  // 4. Initialize Supabase admin client to verify the user and perform upsert
  const { supabaseUrl, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    console.error('[meta-callback] Missing server configuration (SERVICE_ROLE_KEY).');
    const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'server_config_error');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Verify that the specific user exists and has permission (office_staff or admin)
  const { data: userProfile, error: profileCheckErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', verifiedUserId)
    .single();

  if (
    profileCheckErr ||
    !userProfile ||
    (userProfile.role !== 'office_staff' && userProfile.role !== 'admin')
  ) {
    console.error('[meta-callback] User profile not found or unauthorized:', verifiedUserId);
    const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'unauthorized_user');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }

  // 5. Exchange the authorization code for an access token securely on the server
  try {
    const tokenUrl = 'https://graph.facebook.com/v21.0/oauth/access_token';
    const params = new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code: code,
    });

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: params.toString(),
    });

    const tokenData: any = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData || !tokenData.access_token) {
      console.error('[meta-callback] Token exchange failed with status', tokenResponse.status, {
        errorType: tokenData?.error?.type,
        errorCode: tokenData?.error?.code,
        errorMessage: tokenData?.error?.message,
      });

      const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
      errorUrl.searchParams.set('meta_auth', 'error');
      errorUrl.searchParams.set('error', 'token_exchange_failed');
      const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
      return safeRedirect(res, finalUrl);
    }

    // 6. Fetch the connected Facebook user's ID and name from Meta
    const userProfileUrl = new URL('https://graph.facebook.com/v21.0/me');
    userProfileUrl.searchParams.set('fields', 'id,name');

    const profileResponse = await fetch(userProfileUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    });

    const profileData: any = await profileResponse.json();

    if (!profileResponse.ok || !profileData || !profileData.id) {
      console.error('[meta-callback] Failed to fetch Facebook user profile from Meta:', {
        status: profileResponse.status,
        error: profileData?.error?.message,
      });

      const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
      errorUrl.searchParams.set('meta_auth', 'error');
      errorUrl.searchParams.set('error', 'profile_fetch_failed');
      const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
      return safeRedirect(res, finalUrl);
    }

    const facebookUserId = String(profileData.id);
    const facebookUserName = profileData.name ? String(profileData.name) : null;

    // 7. Calculate token expiration
    const tokenExpiresAt = tokenData.expires_in
      ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString()
      : null;

    // 8. Securely save/upsert integration in Supabase under the verified user's profile
    // CRITICAL: NEVER log or expose access_token
    const { error: dbError } = await supabaseAdmin
      .from('meta_integrations')
      .upsert(
        {
          user_id: userProfile.id,
          facebook_user_id: facebookUserId,
          facebook_user_name: facebookUserName,
          access_token: tokenData.access_token,
          token_expires_at: tokenExpiresAt,
          status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'facebook_user_id' }
      );

    if (dbError) {
      console.error('[meta-callback] Database upsert failed for meta_integrations:', {
        code: dbError.code,
        message: dbError.message,
      });

      const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
      errorUrl.searchParams.set('meta_auth', 'error');
      errorUrl.searchParams.set('error', 'db_save_failed');
      const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
      return safeRedirect(res, finalUrl);
    }

    // Success! Log confirmation without exposing any access token or sensitive secrets
    console.log('[meta-callback] Successfully saved Meta integration for Facebook user:', facebookUserId);

    // 9. Redirect back to the app with ?meta_auth=success
    const successUrl = new URL(returnPath, appOrigin || 'http://localhost');
    successUrl.searchParams.set('meta_auth', 'success');
    const finalUrl = appOrigin ? successUrl.toString() : `${successUrl.pathname}${successUrl.search}`;
    return safeRedirect(res, finalUrl);
  } catch (err: any) {
    console.error('[meta-callback] Unexpected exception during callback processing:', err?.message);
    const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'server_error');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }
}
