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
  if (req?.url && typeof req.url === 'string' && req.url.includes('?')) {
    try {
      const searchParams = new URL(req.url, 'http://localhost').searchParams;
      searchParams.forEach((val, key) => {
        if (!query[key]) {
          query[key] = val;
        }
      });
    } catch {
      // ignore
    }
  }
  return query;
}

export default async function handler(req: any, res: any) {
  // 1. GET: Handle Meta Webhook Verification
  if (req.method === 'GET') {
    const query = getQueryParams(req);
    const mode = query['hub.mode'];
    const verifyToken = query['hub.verify_token'];
    const challenge = query['hub.challenge'];

    const expectedToken = (
      process.env.META_WEBHOOK_VERIFY_TOKEN ||
      process.env.VITE_META_WEBHOOK_VERIFY_TOKEN ||
      ''
    ).trim();

    if (!expectedToken) {
      console.error('[meta-webhook] META_WEBHOOK_VERIFY_TOKEN is not configured on server.');
      return res.status(500).json({
        success: false,
        message: 'Webhook verify token not configured on server.',
      });
    }

    if (mode === 'subscribe' && verifyToken && verifyToken === expectedToken) {
      console.log('[meta-webhook] Webhook verified successfully by Meta.');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      return res.status(200).send(challenge);
    }

    console.warn('[meta-webhook] Webhook verification failed. Invalid token or mode.');
    return res.status(403).json({
      success: false,
      message: 'Verification failed. Invalid verify token or mode.',
    });
  }

  // 2. POST: Accept Meta Webhook Events
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }

    // Safely log only basic non-sensitive event metadata for testing
    // Never log access tokens, secrets, or customer PII
    const objectType = body?.object || 'unknown';
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    const entryIds = entries.map((e: any) => e?.id).filter(Boolean);

    console.log('[meta-webhook] Received Meta webhook event:', {
      object: objectType,
      entry_count: entries.length,
      entry_ids: entryIds,
      timestamp: new Date().toISOString(),
    });

    // Return HTTP 200 quickly to Meta
    return res.status(200).send('EVENT_RECEIVED');
  }

  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed',
  });
}
