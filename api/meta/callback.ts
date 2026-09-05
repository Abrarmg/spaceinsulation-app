import {
  getMetaConfig,
  parseCookies,
  getQueryParams,
  verifySignedState,
  buildClearStateCookie,
  getAppOrigin,
  safeRedirect,
  STATE_COOKIE_NAME,
} from './_metaUtils';

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

  // 3. Exchange the authorization code for an access token securely on the server
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

    // Success! Access token received securely on the server.
    // Never expose META_APP_SECRET or access tokens to the frontend.
    console.log('[meta-callback] Successfully exchanged Meta OAuth code for access token.');

    const successUrl = new URL(returnPath, appOrigin || 'http://localhost');
    successUrl.searchParams.set('meta_auth', 'success');
    const finalUrl = appOrigin ? successUrl.toString() : `${successUrl.pathname}${successUrl.search}`;
    return safeRedirect(res, finalUrl);
  } catch (err: any) {
    console.error('[meta-callback] Unexpected exception during token exchange:', err?.message);
    const errorUrl = new URL(returnPath, appOrigin || 'http://localhost');
    errorUrl.searchParams.set('meta_auth', 'error');
    errorUrl.searchParams.set('error', 'server_error');
    const finalUrl = appOrigin ? errorUrl.toString() : `${errorUrl.pathname}${errorUrl.search}`;
    return safeRedirect(res, finalUrl);
  }
}
