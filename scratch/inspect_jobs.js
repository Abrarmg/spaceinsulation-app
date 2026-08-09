import { createClient } from '@supabase/supabase-js';

globalThis.WebSocket = class {
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
};

const supabaseUrl = 'https://hcoxvaqeomtpcsegadip.supabase.co';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhjb3h2YXFlb210cGNzZWdhZGlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDg1ODYwNiwiZXhwIjoyMTAwNDM0NjA2fQ.n46yTUbxfDpPVSa1AF7kM3UaMaP5Hs6pRJ8xdXWiobU';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false
  }
});

async function inspect() {
  const { data, error } = await supabaseAdmin.from('jobs').select('*').limit(1);
  if (error) {
    console.error("Error fetching jobs:", error);
  } else {
    console.log("Job columns:", Object.keys(data[0] || {}));
  }
}

inspect();
