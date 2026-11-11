/// <reference types="node" />
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { staffId, auth_token } = req.body;

  if (!staffId || typeof staffId !== 'string') {
    return res.status(400).json({ success: false, message: 'Valid Staff ID is required.' });
  }

  if (!auth_token) {
    return res.status(401).json({ success: false, message: 'Authentication token is required.' });
  }

  try {
    // 1. Authorization check
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      return res.status(500).json({ success: false, message: 'Server configuration missing (ANON_KEY).' });
    }
      
    let rawUrl = process.env.SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

    const verifyClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(auth_token);
    
    if (verifyError || !verifyData?.user) {
      return res.status(401).json({ success: false, message: 'You are not authorized to delete staff members.' });
    }

    let rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
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

    // Verify admin/management permission
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
        message: 'You do not have permission to delete staff members.'
      });
    }

    if (staffId === verifyData.user.id) {
      return res.status(400).json({ success: false, message: "You can't delete your own account while signed in to it." });
    }

    // 2. Verify staff member before delete
    const { data: staffProfile, error: staffProfileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', staffId)
      .single();

    if (staffProfileError || !staffProfile) {
      return res.status(404).json({ success: false, message: 'Staff member not found.' });
    }

    // 2.5 Clear references that don't cascade and shouldn't be deleted
    // The expenses table tracks who created an expense. We don't want to delete the expense,
    // but the foreign key prevents deleting the profile if we don't clear it.
    // Same for every other record that only *points at* the person: the record stays, it just
    // no longer names them (e.g. a past job shows "Unassigned" instead of blocking the delete).
    const detach: Array<[table: string, column: string]> = [
      ['expenses', 'created_by'],
      ['jobs', 'assigned_worker_id'],
      ['notes', 'created_by'],
      ['assessments', 'assigned_to'],
      ['leads', 'assigned_to'],
      ['inspection_reports', 'inspected_by'],
      ['inspection_photos', 'uploaded_by'],
    ];
    for (const [table, column] of detach) {
      const { error } = await supabaseAdmin.from(table).update({ [column]: null }).eq(column, staffId);
      // A table or column that doesn't exist in this database is fine to skip.
      if (error && !['42P01', '42703', 'PGRST204', 'PGRST205'].includes(String(error.code))) {
        console.warn('[delete-staff detach]', { table, column, code: error.code, message: error.message });
      }
    }

    // 2.6 Remove the staff profile first. Its own data (wages, time entries, crew spots…)
    // cascades with it, and if anything still blocks it the database names the table.
    const { error: profileDeleteError } = await supabaseAdmin.from('profiles').delete().eq('id', staffId);
    if (profileDeleteError) {
      const table = /on table "([^"]+)"/.exec(profileDeleteError.details || profileDeleteError.message || '')?.[1];
      console.error('[delete-staff profile delete]', { code: profileDeleteError.code, message: profileDeleteError.message, details: profileDeleteError.details });
      return res.status(409).json({
        success: false,
        message: table
          ? `This person can't be deleted yet because they are still linked to records in "${table}". Remove or reassign those first, or deactivate them instead.`
          : `This person can't be deleted yet: ${profileDeleteError.message}`,
      });
    }

    // 3. Delete Auth user permanently
    // This will safely cascade down to profiles, profile_wages, time_entries, time_breaks, job_issues, and staff_certifications
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(staffId);

    if (deleteAuthError) {
      console.error('[delete-staff auth error]', {
        stage: 'auth_delete',
        code: deleteAuthError?.status || deleteAuthError?.code,
        message: deleteAuthError?.message,
        name: deleteAuthError?.name
      });
      return res.status(500).json({ success: false, message: `Their staff details were removed, but their sign-in could not be deleted (${deleteAuthError.message}). Try again, or remove it in Supabase under Authentication → Users.` });
    }

    // 4. Verify deletion
    const { data: verifyDeletedProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', staffId)
      .maybeSingle();

    if (verifyDeletedProfile) {
      // If the profile still exists, the cascade failed or something went wrong
      console.error('[delete-staff verification failed]', {
        stage: 'verify_delete',
        message: 'Profile still exists after auth user deletion'
      });
      return res.status(500).json({ success: false, message: 'Failed to completely delete staff records.' });
    }

    return res.status(200).json({ success: true, message: 'Staff member permanently deleted.' });

  } catch (err: any) {
    console.error('[delete-staff server error]', {
      stage: 'unexpected',
      message: err?.message
    });
    return res.status(500).json({ success: false, message: 'An unexpected error occurred. Please try again.' });
  }
}
