import {
  getMetaConfig,
  getQueryParams,
  createSignedState,
  buildStateCookie,
  safeRedirect,
} from './_metaUtils';

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
