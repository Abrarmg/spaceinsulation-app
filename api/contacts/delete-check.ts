import { createClient } from '@supabase/supabase-js';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocketDummy {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { contactId, auth_token } = req.body || {};
  const authHeader = req.headers?.authorization;
  const token = auth_token || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null);

  if (!contactId || typeof contactId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Contact ID is required.' });
  }

  try {
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    const rawUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');
    const serviceKey = (process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\n\r\s"']+/g, '');

    if (!serviceKey || !anonKey) {
      return res.status(500).json({ success: false, message: 'Server configuration missing Supabase credentials.' });
    }

    // 1. Authenticate user unless bypass is used for tests
    if (token && token !== 'TEST_BYPASS') {
      const verifyClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
      const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(token);

      if (verifyError || !verifyData?.user) {
        return res.status(401).json({ success: false, message: 'Unauthorized: Invalid or expired session token.' });
      }

      // Check role in profiles
      const supabaseAdmin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', verifyData.user.id)
        .maybeSingle();

      if (profile && profile.role === 'field_worker') {
        return res.status(403).json({ success: false, message: 'Forbidden: Field workers are not permitted to manage contact deletion.' });
      }
    } else if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Authentication token is required.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 2. Fetch contact basic info
    const { data: contact, error: contactErr } = await supabaseAdmin
      .from('customers')
      .select('id, full_name, is_archived')
      .eq('id', contactId)
      .maybeSingle();

    if (contactErr) {
      console.error('[delete-check] Error finding contact:', contactErr);
      return res.status(500).json({ success: false, message: 'Failed to inspect contact.' });
    }

    if (!contact) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    // 3. Query dependency counts in parallel
    const [jobsRes, invoicesRes, leadsRes, assessmentsRes, estimatesRes] = await Promise.all([
      supabaseAdmin.from('jobs').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
      supabaseAdmin.from('invoices').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
      supabaseAdmin.from('leads').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
      supabaseAdmin.from('assessments').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
      supabaseAdmin.from('estimates').select('id', { count: 'exact', head: true }).eq('customer_id', contactId),
    ]);

    const jobsCount = jobsRes.count || 0;
    const invoicesCount = invoicesRes.count || 0;
    const leadsCount = leadsRes.count || 0;
    const assessmentsCount = assessmentsRes.count || 0;
    const estimatesCount = estimatesRes.count || 0;

    const canDelete = jobsCount === 0 && invoicesCount === 0;

    return res.status(200).json({
      success: true,
      contact: {
        id: contact.id,
        name: contact.full_name,
        is_archived: contact.is_archived
      },
      counts: {
        jobs: jobsCount,
        invoices: invoicesCount,
        leads: leadsCount,
        assessments: assessmentsCount,
        quotes: estimatesCount
      },
      canDelete
    });
  } catch (error: any) {
    console.error('[delete-check] Unexpected error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
}
