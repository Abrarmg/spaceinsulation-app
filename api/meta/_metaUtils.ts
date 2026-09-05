import crypto from 'node:crypto';

export interface MetaConfig {
  appId: string;
  appSecret: string;
  configId: string;
  redirectUri: string;
}

export const STATE_COOKIE_NAME = 'meta_oauth_state';
export const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Loads and validates Meta environment variables.
 */
export function getMetaConfig(): { config: MetaConfig | null; missing: string[] } {
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

/**
 * Parses cookies from req.cookies or req.headers.cookie
 */
export function parseCookies(req: any): Record<string, string> {
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

/**
 * Helper to safely extract query parameters from req.query or req.url
 */
export function getQueryParams(req: any): Record<string, string> {
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

/**
 * Sanitizes return path to prevent open redirect vulnerabilities.
 */
export function sanitizeReturnTo(path?: unknown): string {
  if (typeof path !== 'string' || !path) {
    return '/';
  }
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\')) {
    return '/';
  }
  return trimmed;
}

/**
 * Generates a signed cryptographic state containing a random nonce, timestamp, and optional return path.
 */
export function createSignedState(secret: string, returnTo?: string): { state: string; nonce: string } {
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

/**
 * Validates a signed state parameter against secret, expiration window, and CSRF cookie.
 */
export function verifySignedState(
  state: string,
  secret: string,
  cookieNonce?: string | null
): { isValid: boolean; error?: string; returnTo?: string } {
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

  let payload: { nonce: string; ts: number; returnTo?: string };
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

  return { isValid: true, returnTo: payload.returnTo };
}

/**
 * Builds the Set-Cookie header string for state nonce.
 */
export function buildStateCookie(nonce: string, isSecure: boolean): string {
  const secureFlag = isSecure ? '; Secure' : '';
  return `${STATE_COOKIE_NAME}=${encodeURIComponent(nonce)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secureFlag}`;
}

/**
 * Builds the Set-Cookie header string to clear the state cookie.
 */
export function buildClearStateCookie(isSecure: boolean): string {
  const secureFlag = isSecure ? '; Secure' : '';
  return `${STATE_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`;
}

/**
 * Derives the base URL / origin of the application.
 */
export function getAppOrigin(req: any, redirectUri: string): string {
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

/**
 * Safe redirect helper supporting both Vercel res.redirect and Node ServerResponse.
 */
export function safeRedirect(res: any, location: string): void {
  if (typeof res?.redirect === 'function') {
    res.redirect(location);
    return;
  }
  res.writeHead(302, { Location: location });
  res.end();
}
