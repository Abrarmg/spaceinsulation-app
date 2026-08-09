import fs from 'fs';

const envPath = '/Users/macbookpro/Downloads/space-insulation-app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

async function run() {
  const url = `${supabaseUrl}/functions/v1/run-migration`;
  console.log(`Invoking edge function at ${url}...`);
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({})
  });
  
  const text = await response.text();
  try {
    const data = JSON.parse(text);
    if (response.ok) {
      console.log('✅ Migration succeeded:', data);
    } else {
      console.error('❌ Migration failed:', data);
    }
  } catch (err) {
    console.error('❌ Failed to parse response:', text);
  }
}
run();
