import fs from 'fs';

const envPath = '/Users/macbookpro/Downloads/space-insulation-app/.env.local';
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnvVar = (name) => {
  const match = envContent.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return match ? match[1].trim() : null;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const supabaseServiceRoleKey = getEnvVar('VITE_SUPABASE_SERVICE_ROLE_KEY');

async function testInsert() {
  const payload = {
    description: "Test Expense",
    vendor_name: null,
    category: "Materials",
    amount: 50.00,
    tax_amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: "Card",
    invoice_number: null,
    notes: null,
    is_recurring: false,
    receipt_url: null,
    status: 'Completed'
  };

  const profilesUrl = `${supabaseUrl}/rest/v1/profiles?select=id&limit=1`;
  const profilesRes = await fetch(profilesUrl, {
    headers: { 'apikey': supabaseServiceRoleKey, 'Authorization': `Bearer ${supabaseServiceRoleKey}` }
  });
  const profiles = await profilesRes.json();
  
  if (profiles && profiles.length > 0) {
    payload.created_by = profiles[0].id;
  }

  console.log("Inserting payload:", payload);

  const insertUrl = `${supabaseUrl}/rest/v1/expenses`;
  const insertRes = await fetch(insertUrl, {
    method: 'POST',
    headers: { 
      'apikey': supabaseServiceRoleKey, 
      'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(payload)
  });

  const data = await insertRes.json();
  if (insertRes.ok) {
    console.log("Success:", data);
  } else {
    console.error("Error inserting:", data);
  }
}

testInsert();
