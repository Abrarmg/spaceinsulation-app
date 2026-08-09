import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkKhder() {
  console.log("=== Checking khderqassim21@gmail.com in Auth & Profiles ===");
  
  // 1. Get Auth User
  const { data: { users }, error: authErr } = await supabaseAdmin.auth.admin.listUsers();
  if (authErr) {
    console.error("❌ List users failed:", authErr);
    return;
  }

  const khderUser = users.find(u => u.email === 'khderqassim21@gmail.com');
  if (!khderUser) {
    console.log("❌ User not found in auth.users!");
    return;
  }

  console.log("✅ User found in auth.users:");
  console.log(`- ID: ${khderUser.id}`);
  console.log(`- Email: ${khderUser.email}`);
  console.log(`- Confirmed At: ${khderUser.email_confirmed_at}`);
  console.log(`- Invited At: ${khderUser.invited_at}`);

  // 2. Get Profile
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', khderUser.id)
    .maybeSingle();

  if (profileErr) {
    console.error("❌ Fetch profile failed:", profileErr);
  } else {
    console.log("Profile in public.profiles:", profile ? profile : "NOT FOUND");
  }
}

checkKhder();
