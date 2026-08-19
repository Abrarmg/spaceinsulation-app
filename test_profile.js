import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function test() {
  const { data, error } = await supabase.from('profiles').insert([
    {
      full_name: 'Test Profile',
      role: 'field_worker',
      email: 'test@example.com'
    }
  ]).select();
  console.log('Result:', { data, error });
}
test();
