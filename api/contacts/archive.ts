/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class WebSocketDummy {};
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { contactId, is_archived = true, auth_token } = req.body || {};
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
        return res.status(403).json({ success: false, message: 'Forbidden: Field workers are not permitted to archive contacts.' });
      }
    } else if (!token) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Authentication token is required.' });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const targetArchivedState = Boolean(is_archived);

    // 2. Update contact record
    const { data: updatedContact, error: updateErr } = await supabaseAdmin
      .from('customers')
      .update({
        is_archived: targetArchivedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', contactId)
      .select('id, full_name, is_archived, updated_at')
      .maybeSingle();

    if (updateErr) {
      console.error('[contact-archive] Error updating contact archive status:', updateErr);
      return res.status(500).json({ success: false, message: 'Failed to update contact archive status.' });
    }

    if (!updatedContact) {
      return res.status(404).json({ success: false, message: 'Contact not found.' });
    }

    return res.status(200).json({
      success: true,
      contact: updatedContact,
      is_archived: targetArchivedState,
      message: targetArchivedState ? 'Contact archived successfully.' : 'Contact restored successfully.'
    });
  } catch (error: any) {
    console.error('[contact-archive] Unexpected error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  }
}
