import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const envPath = '/Users/macbookpro/Downloads/space-insulation-app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testInsert() {
  const payload = {
    description: "Test Expense",
    category: "Materials",
    amount: 50.00,
    expense_date: new Date().toISOString().split('T')[0],
    created_by: null // we will try to find a valid profile ID
  };

  const { data: profiles } = await supabase.from('profiles').select('id').limit(1);
  if (profiles && profiles.length > 0) {
    payload.created_by = profiles[0].id;
  }

  console.log("Inserting payload:", payload);

  const { data, error } = await supabase
    .from('expenses')
    .insert([payload])
    .select(`*, profiles:created_by ( id, full_name, email, role )`)
    .single();

  if (error) {
    console.error("Error inserting:", error);
  } else {
    console.log("Success:", data);
  }
}

testInsert();
