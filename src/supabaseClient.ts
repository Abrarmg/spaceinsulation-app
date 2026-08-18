import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sBAB2M93WAsRCY0oDYFb5A_cOECjIWc';
const supabaseServiceRoleKey = (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id') || supabaseAnonKey.includes('your-anon-key')) {
  console.warn(
    'Supabase credentials missing or invalid. Please check your .env.local file. The app will not function correctly without a valid database connection.'
  );
}

// Client for standard public actions (uses Anonymous key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
