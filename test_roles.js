import fs from 'fs';

const envPath = '/Users/macbookpro/Downloads/space-insulation-app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

async function testFetch() {
  const profilesUrl = `${supabaseUrl}/rest/v1/profiles?select=id,full_name,role`;
  const profilesRes = await fetch(profilesUrl, {
    headers: { 'apikey': supabaseServiceRoleKey, 'Authorization': `Bearer ${supabaseServiceRoleKey}` }
  });
  const profiles = await profilesRes.json();
  console.log("Profiles:", profiles);
}

testFetch();
