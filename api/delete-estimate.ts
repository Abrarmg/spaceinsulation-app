import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { estimateId, auth_token } = req.body;

  if (!estimateId || typeof estimateId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Estimate ID is required.' });
  }

  if (!auth_token) {
    return res.status(401).json({ success: false, message: 'Authentication token is required.' });
  }

  try {
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      return res.status(500).json({ success: false, message: 'Server configuration missing (ANON_KEY).' });
    }
      
    let rawUrl = process.env.SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

    const verifyClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(auth_token);
    
    if (verifyError || !verifyData?.user) {
      return res.status(401).json({ success: false, message: 'You are not authorized to delete estimates.' });
    }

    let rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
    if (!rawKey) {
      return res.status(500).json({ success: false, message: 'Server configuration missing (SERVICE_ROLE_KEY).' });
    }

    const supabaseServiceKey = rawKey.replace(/[\n\r\s"']+/g, '');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', verifyData.user.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      (callerProfile.role !== 'office_staff' && callerProfile.role !== 'admin')
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete estimates.'
      });
    }

    const { error: deleteErr } = await supabaseAdmin
      .from('estimates')
      .delete()
      .eq('id', estimateId);

    if (deleteErr) {
      return res.status(500).json({ success: false, message: 'Database error: ' + deleteErr.message });
    }

    return res.status(200).json({ success: true, message: 'Estimate permanently deleted.' });

  } catch (err: any) {
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again.' });
  }
}
