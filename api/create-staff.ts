import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { email, password, fullName, profileData, wage, payrollType, certifications } = req.body;

  let rawUrl = '';
  let supabaseUrl = '';
  try {
    // Aggressively sanitize the URL and Key to remove any hidden newlines, spaces, control characters, or accidental quotes.
    rawUrl = process.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
    let rawKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!rawKey) {
      const availableKeys = Object.keys(process.env).filter(k => k.includes('SUPABASE')).join(', ');
      return res.status(500).json({ error: `Server configuration missing: VITE_SUPABASE_SERVICE_ROLE_KEY is not set in Vercel. Supabase keys found: [${availableKeys}]` });
    }

    supabaseUrl = rawUrl.replace(/[\n\r\s"']+/g, '');
    const supabaseServiceKey = rawKey.replace(/[\n\r\s"']+/g, '');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 1. Create the Auth User
    const finalEmail = email || `staff_${Date.now()}@spaceinsulation.local`;
    const finalPassword = password || Math.random().toString(36).slice(-10) + 'A1!';

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: finalEmail,
      password: finalPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName
      }
    });

    if (authError) throw authError;

    const profileId = authData.user?.id;
    if (!profileId) throw new Error("User created but no ID returned.");

    // 2. Update/Insert Profile
    const { error: updateErr } = await supabaseAdmin.from('profiles').update(profileData).eq('id', profileId);
    if (updateErr) {
      const { error: insertErr } = await supabaseAdmin.from('profiles').insert({ ...profileData, id: profileId });
      if (insertErr) throw insertErr;
    }

    // 3. Add Wages
    if (wage) {
      const { error: wageErr } = await supabaseAdmin.from('profile_wages').insert([{ profile_id: profileId, hourly_rate: Number(wage), payroll_type: payrollType }]);
      if (wageErr) console.error("Wage Insert Error:", wageErr);
    }

    // 4. Add Certifications
    if (certifications && certifications.length > 0) {
      const certsToInsert = certifications.map(c => ({
        profile_id: profileId,
        name: c.name,
        issue_date: c.issue_date || null,
        expiry_date: c.expiry_date || null
      }));
      const { error: certErr } = await supabaseAdmin.from('staff_certifications').insert(certsToInsert);
      if (certErr) console.error("Cert Insert Error:", certErr);
    }

    return res.status(200).json({ success: true, profileId });
  } catch (err) {
    console.error("API Error:", err);
    let debugInfo = 'Unknown error';
    try {
      if (err instanceof Error) {
        debugInfo = `${err.name}: ${err.message} \nStack: ${err.stack}`;
      } else if (typeof err === 'object') {
        debugInfo = JSON.stringify(err, Object.getOwnPropertyNames(err));
      } else {
        debugInfo = String(err);
      }
    } catch (e) {
      debugInfo = "Failed to stringify error";
    }
    
    debugInfo += `\n\n[DIAGNOSTICS]\nrawUrl: ${rawUrl}\nsupabaseUrl: ${supabaseUrl}`;
    
    return res.status(500).json({ error: debugInfo });
  }
}
