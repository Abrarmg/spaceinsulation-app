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

    // 1. Authorize office staff
    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', verifyData.user.id)
      .single();

    if (
      profileError ||
      !callerProfile ||
      callerProfile.role !== 'office_staff'
    ) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete estimates.'
      });
    }

    // 2. Validate estimate exists before deletion
    const { data: existingEstimate, error: checkError } = await supabaseAdmin
      .from('estimates')
      .select('id')
      .eq('id', estimateId)
      .maybeSingle();

    if (checkError) {
      console.error('[estimate-delete]', {
        stage: 'check_exists',
        code: checkError.code,
        message: checkError.message,
        hint: checkError.hint
      });
      return res.status(500).json({ success: false, message: 'Unable to delete this estimate. Please try again.' });
    }

    if (!existingEstimate) {
      return res.status(404).json({ success: false, message: 'Estimate not found.' });
    }

    // 3. Delete estimate and request exact deleted row
    const { data: deletedRow, error: deleteErr } = await supabaseAdmin
      .from('estimates')
      .delete()
      .eq('id', estimateId)
      .select('id')
      .maybeSingle();

    if (deleteErr) {
      console.error('[estimate-delete]', {
        stage: 'delete',
        code: deleteErr.code,
        message: deleteErr.message,
        hint: deleteErr.hint
      });
      return res.status(500).json({ success: false, message: 'Unable to delete this estimate. Please try again.' });
    }

    if (!deletedRow) {
      return res.status(500).json({ success: false, message: 'Unable to delete this estimate. Please try again.' });
    }

    // 4. Verify after delete
    const { data: verifyDeleted } = await supabaseAdmin
      .from('estimates')
      .select('id')
      .eq('id', estimateId)
      .maybeSingle();

    if (verifyDeleted) {
      console.error('[estimate-delete]', {
        stage: 'verify_delete',
        message: 'Estimate still exists after deletion attempt'
      });
      return res.status(500).json({ success: false, message: 'Failed to completely delete the estimate.' });
    }

    return res.status(200).json({ success: true, message: 'Estimate deleted successfully.' });

  } catch (err: any) {
    console.error('[estimate-delete]', {
      stage: 'unexpected',
      message: err?.message
    });
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again.' });
  }
}
