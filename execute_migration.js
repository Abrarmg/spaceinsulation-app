import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = '/Users/macbookpro/Downloads/space-insulation-app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

console.log(`Supabase URL: ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log('Invoking run-migration edge function to add approval_token column...');
  const { data, error } = await supabase.functions.invoke('run-migration', {
    method: 'POST',
    body: {}
  });

  if (error) {
    console.error('❌ Migration failed:', error);
  } else {
    console.log('✅ Migration succeeded:', data);
  }
}

run();
