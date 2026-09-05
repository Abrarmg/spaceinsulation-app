import crypto from 'crypto';

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

function createSignedState(secret: string, returnTo?: string): { state: string; nonce: string } {
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = {
    nonce,
    ts: Date.now(),
    returnTo: sanitizeReturnTo(returnTo),
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
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { config, missing } = getMetaConfig();
  if (!config) {
    console.error('[meta-connect] Missing required environment configuration:', missing.join(', '));
    return res.status(500).json({
      success: false,
      message: `Server configuration missing: ${missing.join(', ')}`,
    });
  }

  try {
    const query = getQueryParams(req);
    const returnTo = query.return_to;
    const { state, nonce } = createSignedState(config.appSecret, returnTo);

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

    return safeRedirect(res, authUrl.toString());
  } catch (err: any) {
    console.error('[meta-connect] Unexpected error initiating Meta OAuth:', err?.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to initiate Facebook Login for Business.',
    });
  }
}
