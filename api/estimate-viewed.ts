/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

// Records that a customer opened their quote link. Called by the public approve-estimate page.
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false });
  }

  const token = req.body?.token;
  if (!token || typeof token !== 'string' || token.length > 200) {
    return res.status(400).json({ success: false });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/[\n\r\s"']+/g, '');
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').replace(/[\n\r\s"']+/g, '');
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ success: false, message: 'Server configuration missing.' });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: est, error } = await supabase
    .from('estimates')
    .select('id, first_viewed_at, view_count')
    .eq('approval_token', token)
    .maybeSingle();

  if (error || !est) {
    return res.status(404).json({ success: false });
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('estimates')
    .update({
      first_viewed_at: est.first_viewed_at || now,
      last_viewed_at: now,
      view_count: Number(est.view_count || 0) + 1,
    })
    .eq('id', est.id);

  if (updateErr) {
    console.error('Failed to record estimate view:', updateErr);
    return res.status(500).json({ success: false });
  }
  return res.status(200).json({ success: true });
}
