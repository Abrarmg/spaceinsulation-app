import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password, fullName, profileData, wage, payrollType, certifications, auth_token } = req.body;

  let authUserId = null;

  try {
    // 0. Authorization check
    // We expect auth_token to be passed from the frontend to verify the requester is logged in
    if (!auth_token) {
      return res.status(401).json({ success: false, message: 'You are not authorized to create staff members.' });
    }
    
    // Validate that the auth_token is actually valid
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return res.status(500).json({ success: false, message: `Server configuration missing.` });
    }
      
    const verifyClient = createClient(
      process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co',
      anonKey,
      { auth: { persistSession: false } }
    );
    
    const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(auth_token);
    
    if (verifyError || !verifyData.user) {
      return res.status(401).json({ success: false, message: 'You are not authorized to create staff members.' });
    }

    // Aggressively sanitize the URL and Key to remove any hidden newlines, spaces, control characters, or accidental quotes.
    let rawUrl = process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    let rawKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!rawKey) {
      return res.status(500).json({ success: false, message: `Server configuration missing.` });
    }

    const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');
    const supabaseServiceKey = rawKey.replace(/[\n\r\s"']+/g, '');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Validate Required Inputs
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // 2. Protect against control characters and newlines
    if (/[\r\n\t\0]/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 3. Proper Email Syntax Validation
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // 4. Validate Name
    if (typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    
    const normalizedName = fullName.trim();

    // 5. Safe Diagnostic Logging (Server-Side Only)
    console.log('Creating staff auth user', {
      operation: 'create_staff',
      emailType: typeof email,
      normalizedEmailLength: normalizedEmail.length,
      emailDomain: normalizedEmail.split('@')[1] || null,
      hadOuterWhitespace: typeof email === 'string' && email !== email.trim(),
      hasPassword: typeof password === 'string' && password.length > 0,
      projectHost: new URL(supabaseUrl).hostname
    });

    const finalPassword = password || Math.random().toString(36).slice(-10) + 'A1!';

    // 6. Create the Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName
      }
    });

    if (authError) {
      console.error('Supabase create staff auth error', {
        name: authError?.name,
        message: authError?.message,
        status: authError?.status,
        code: authError?.code
      });

      if (authError.status === 422 || authError.code === 'email_exists' || (authError.message && authError.message.includes('already been registered'))) {
        return res.status(409).json({ success: false, message: "A staff member with this email already exists." });
      }
      return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
    }

    authUserId = authData?.user?.id;
    if (!authUserId) {
      return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
    }

    // 7. Staff Record DB Insert
    try {
      const { error: updateErr } = await supabaseAdmin.from('profiles').upsert({ id: authUserId, ...profileData });
      if (updateErr) throw updateErr;

      if (wage && typeof wage === 'number') {
        const { error: wageErr } = await supabaseAdmin.from('profile_wages').insert({
          id: authUserId,
          hourly_rate: wage,
          payroll_type: payrollType || 'Hourly'
        });
        if (wageErr) throw wageErr;
      }

      if (certifications && certifications.length > 0) {
        const { error: certErr } = await supabaseAdmin.from('staff_certifications').insert(
          certifications.map(c => ({
            profile_id: authUserId,
            name: c.name,
            issue_date: c.issue_date || null,
            expiry_date: c.expiry_date || null
          }))
        );
        if (certErr) throw certErr;
      }

      return res.status(200).json({ success: true, message: 'Staff created successfully.' });

    } catch (profileError) {
      // 8. Safe Rollback
      console.error('Supabase profile insertion error', profileError);
      
      if (authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          console.log('Rolled back orphaned auth user:', authUserId);
        } catch (rollbackError) {
          console.error('Failed to rollback orphaned auth user', rollbackError);
        }
      }
      
      return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
    }

  } catch (err) {
    console.error("Staff Creation Server Error:", err);
    return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
  }
}
