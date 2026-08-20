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
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (!anonKey) {
      return res.status(500).json({ success: false, message: 'Server configuration missing (ANON_KEY).' });
    }
      
    let rawUrl = process.env.SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    const supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');

    const verifyClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: verifyData, error: verifyError } = await verifyClient.auth.getUser(auth_token);
    
    if (verifyError || !verifyData?.user) {
      return res.status(401).json({ success: false, message: 'You are not authorized to create staff members.' });
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

    // 1. Validate Required Inputs
    if (typeof email !== 'string') {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    if (/[\r\n\t\0]/.test(email)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    if (typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({ success: false, message: 'Full name is required.' });
    }
    
    const normalizedName = fullName.trim();
    const finalPassword = password || Math.random().toString(36).slice(-10) + 'A1!';



    // 2. Create the Auth User
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: normalizedName
      }
    });

    if (authError) {
      console.error('Supabase create staff auth error', authError);
      if (authError.status === 422 || authError.code === 'email_exists' || (authError.message && authError.message.includes('already been registered'))) {
        return res.status(409).json({ success: false, message: "A staff member with this email already exists." });
      }
      return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
    }

    authUserId = authData?.user?.id;
    if (!authUserId) {
      return res.status(500).json({ success: false, message: "Unable to create this staff member. Please try again." });
    }

    // 3. Staff Record DB Insert
    try {
      const profilePayload = { id: authUserId, ...profileData };


      const { error: profileError } = await supabaseAdmin.from('profiles').upsert(profilePayload);
      if (profileError) {
        console.error('[create-staff profile insert error]', {
          code: profileError?.code,
          message: profileError?.message,
          details: profileError?.details,
          hint: profileError?.hint
        });
        throw profileError;
      }

      if (wage && typeof wage === 'number') {
        const { error: wageErr } = await supabaseAdmin.from('profile_wages').insert({
          profile_id: authUserId,
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

      let emailSent = false;
      let emailMessage = "Staff member created, but the password setup email could not be sent.";

      const appUrl = process.env.APP_URL;
      const resendKey = process.env.RESEND_API_KEY;

      if (appUrl && resendKey) {
        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email: normalizedEmail,
          options: {
            redirectTo: `${appUrl}/reset-password`
          }
        });

        if (linkError || !linkData?.properties?.action_link) {
          console.error('[create-staff password link]', {
            status: 'FAIL',
            code: linkError?.code,
            message: linkError?.message,
            name: linkError?.name
          });
        } else {
          const actionLink = linkData.properties.action_link;
          const firstName = normalizedName.split(' ')[0] || 'Staff Member';

          const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #151A2D;">Welcome to Space Insulation!</h2>
              <p>Hi ${firstName},</p>
              <p>Your Space Insulation staff account has been created.</p>
              <p>Click the button below to set your password and activate your account.</p>
              <div style="margin: 30px 0;">
                <a href="${actionLink}" style="background-color: #7CC242; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Set Your Password</a>
              </div>
              <p style="color: #64748B; font-size: 12px; margin-top: 40px;">If you were not expecting this email, please contact your administrator.</p>
            </div>
          `;

          try {
            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "Space Insulation <invoices@app.spaceinsulation.ca>",
                to: normalizedEmail,
                subject: "Set up your Space Insulation password",
                html: emailHtml
              }),
            });

            if (resendRes.ok) {
              const resendData = await resendRes.json();
              emailSent = true;
              emailMessage = "Staff member created and password setup email sent.";
            } else {
              const errText = await resendRes.text();
              console.error('[staff password email]', { status: 'FAIL', statusCode: resendRes.status, message: errText });
            }
          } catch (resendErr: any) {
            console.error('[staff password email]', { status: 'FAIL', message: resendErr.message });
          }
        }
      } else {
         console.warn('[create-staff] Skipping email: missing APP_URL or RESEND_API_KEY');
      }

      return res.status(200).json({ success: true, emailSent, message: emailMessage });

    } catch (profileError) {
      // 4. Safe Rollback
      console.error('Supabase profile insertion error', profileError);
      if (authUserId) {
        try {
          await supabaseAdmin.auth.admin.deleteUser(authUserId);
        } catch (rollbackError) {
          console.error('Failed to rollback orphaned auth user', rollbackError);
        }
      }
      return res.status(500).json({ success: false, message: "Unable to save staff profile. Please try again." });
    }

  } catch (err) {
    console.error("Staff Creation Server Error:", err);
    return res.status(500).json({ success: false, message: "An unexpected error occurred. Please try again." });
  }
}
