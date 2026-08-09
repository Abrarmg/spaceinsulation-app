import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=(.*)/)[1];
const SUPABASE_ANON_KEY = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      profile_wages (hourly_rate, payroll_type),
      staff_certifications (id, name, issue_date, expiry_date)
    `)
    .order('full_name', { ascending: true });
    
  console.log("Error:", error);
  console.log("Data count:", data?.length);
}
test();
