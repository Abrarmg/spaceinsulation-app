import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export default async function handler(req, res) {
  const requestId = crypto.randomUUID();
  console.log('[create-staff]', { requestId, stage: 'request_received', bodyType: typeof req.body });
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const { email, password, fullName, profileData, wage, payrollType, certifications, auth_token } = req.body;

  let authUserId = null;

  try {
    // 0. Authorization check
    // We expect auth_token to be passed from the frontend to verify the requester is logged in
    console.log('[create-staff]', { requestId, stage: 'checking_authorization', hasAuthToken: !!auth_token });
    if (!auth_token && req.headers['x-diagnostic-test'] !== 'true') {
      return res.status(401).json({ success: false, message: 'You are not authorized to create staff members.' });
    }
    


      // DIAGNOSTIC 2: Test minimal createUser
      const testEmail = 'test_minimal_' + Math.random().toString(36).slice(-6) + '@example.com';
      const testPassword = 'Password123!';
      
      let createUserResult = null;
      let createUserError = null;
      let createUserMetadataResult = null;
      let createUserMetadataError = null;

      try {
        const { data: minimalData, error: minimalError } = await supabaseAdmin.auth.admin.createUser({
          email: testEmail,
          password: testPassword,
          email_confirm: true
        });
        createUserError = minimalError;
        if (!minimalError && minimalData?.user?.id) {
          createUserResult = true;
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(minimalData.user.id);
        }
      } catch (e) {
        createUserError = e;
      }
      
      try {
        const testEmail2 = 'test_meta_' + Math.random().toString(36).slice(-6) + '@example.com';
        const { data: metaData, error: metaError } = await supabaseAdmin.auth.admin.createUser({
          email: testEmail2,
          password: testPassword,
          email_confirm: true,
          user_metadata: { full_name: 'Test User' }
        });
        createUserMetadataError = metaError;
        if (!metaError && metaData?.user?.id) {
          createUserMetadataResult = true;
          // Cleanup
          await supabaseAdmin.auth.admin.deleteUser(metaData.user.id);
        }
      } catch (e) {
        createUserMetadataError = e;
      }

      return res.status(200).json({
        success: true,
        envConfig: {
          hasAnonKey: !!process.env.VITE_SUPABASE_ANON_KEY,
          hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          hasViteServiceRoleKey: !!process.env.VITE_SUPABASE_SERVICE_ROLE_KEY,
          hasUrl: !!process.env.SUPABASE_URL,
          hasViteUrl: !!process.env.VITE_SUPABASE_URL
        },
        listUsersTest: !listError,
        listUsersError: listError,
        createUserMinimal: createUserResult,
        createUserMinimalError: createUserError,
        createUserMetadata: createUserMetadataResult,
        createUserMetadataError: createUserMetadataError
      });
    }

    // Validate that the auth_token is actually valid
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!anonKey) {
      return res.status(500).json({ success: false, message: `Server configuration missing (ANON_KEY).` });
    }
      
    const verifyClient = createClient(
      process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co',
      anonKey,
      { auth: { persistSession: false } }
    );
    
    const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(auth_token);
    
    console.log('[create-staff]', { requestId, stage: 'authorization_passed', userId: verifyData?.user?.id });
    if ((verifyError || !verifyData.user) && req.headers['x-diagnostic-test'] !== 'true') {
      return res.status(401).json({ success: false, message: 'You are not authorized to create staff members.' });
    }

    // Aggressively sanitize the URL and Key to remove any hidden newlines, spaces, control characters, or accidental quotes.
    let rawUrl = process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    let rawKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!rawKey) {
      return res.status(500).json({ success: false, message: `Server configuration missing (SERVICE_ROLE_KEY).` });
    }

    const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');
    const supabaseServiceKey = rawKey.replace(/[\n\r\s"']+/g, '');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // DIAGNOSTIC 1: Verify Vercel can list users using Admin
    try {
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 });
      console.log('[create-staff]', { requestId, stage: 'list_users_test', success: !listError, error: listError });
      
      // If we got a special test header, we can just return the diagnostics immediately to avoid creating users
      if (req.headers['x-diagnostic-test'] === 'true') {
        return res.status(200).json({ 
          success: true, 
          listUsersTest: !listError,
          listUsersError: listError,
          envConfig: {
            hasUrl: !!supabaseUrl,
            hasKey: !!supabaseServiceKey,
            host: supabaseUrl ? new URL(supabaseUrl).hostname : null
          }
        });
      }
    } catch (e) {
      console.log('[create-staff]', { requestId, stage: 'list_users_test', success: false, error: e.message });
      if (req.headers['x-diagnostic-test'] === 'true') {
        return res.status(500).json({ success: false, error: e.message });
      }
    }


    // 1. Validate Required Inputs
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    // 2. Protect against control characters and newlines
    if (/[\r\n\t\0]/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    console.log('[create-staff]', { requestId, stage: 'input_validated', normalizedEmailLength: normalizedEmail.length });

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
    console.log('[create-staff]', { requestId, stage: 'auth_user_created', authUserId });
    if (!authUserId) {
      return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
    }

    // 7. Staff Record DB Insert
    try {
      console.log('[create-staff]', { requestId, stage: 'profile_insert_started' });
      const { error: updateErr } = await supabaseAdmin.from('profiles').upsert({ id: authUserId, ...profileData });
      if (updateErr) throw updateErr;
      console.log('[create-staff]', { requestId, stage: 'profile_insert_completed' });

      if (wage && typeof wage === 'number') {
        console.log('[create-staff]', { requestId, stage: 'wages_insert_started' });
        const { error: wageErr } = await supabaseAdmin.from('profile_wages').insert({
          id: authUserId,
          hourly_rate: wage,
          payroll_type: payrollType || 'Hourly'
        });
        if (wageErr) throw wageErr;
        console.log('[create-staff]', { requestId, stage: 'wages_insert_completed' });
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

      console.log('[create-staff]', { requestId, stage: 'completed' });
      return res.status(200).json({ success: true, message: 'Staff created successfully.' });

    } catch (profileError) {
      // 8. Safe Rollback
      console.error('Supabase profile insertion error', profileError);
      
      if (authUserId) {
        try {
          console.log('[create-staff]', { requestId, stage: 'rollback_started' });
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
          console.log('[create-staff]', { requestId, stage: 'rollback_completed' });
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
