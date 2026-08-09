import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://hcoxvaqeomtpcsegadip.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sBAB2M93WAsRCY0oDYFb5A_cOECjIWc';
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-project-id') || supabaseAnonKey.includes('your-anon-key')) {
  console.warn(
    'Supabase URL or Anon Key is missing or using placeholders. Please update VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env.local file.'
  );
}

// Client for standard public actions (uses Anonymous key, respects RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Client for secure administrative actions (uses Service Role Key, bypasses RLS)
// ONLY populated if VITE_SUPABASE_SERVICE_ROLE_KEY is defined in .env.local
export const supabaseAdmin = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;
