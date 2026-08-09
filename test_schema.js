import fs from 'fs';

const envPath = '/Users/macbookpro/Downloads/space-insulation-app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

async function checkSchema() {
  const schemaUrl = `${supabaseUrl}/rest/v1/expenses?limit=1`;
  const schemaRes = await fetch(schemaUrl, {
    headers: { 'apikey': supabaseServiceRoleKey, 'Authorization': `Bearer ${supabaseServiceRoleKey}` }
  });
  const data = await schemaRes.json();
  console.log("Data:", data);
}

checkSchema();
