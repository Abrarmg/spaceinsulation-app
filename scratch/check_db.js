import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: cols, error: colErr } = await supabase.rpc('get_profile_columns'); // might not exist
  // Let's just select one row from profiles
  const { data, error } = await supabase.from('profiles').select('*').limit(1);
  console.log("Profile columns:", data && data.length > 0 ? Object.keys(data[0]) : "No data or error", error);
  
  const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
  console.log("Buckets:", buckets?.map(b => b.name), bErr);
}
main();
