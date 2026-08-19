// @ts-nocheck
global.WebSocket = class WebSocket {};
import fs from 'fs';
import handler from './api/create-staff.ts';

const envContent = fs.readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2].trim().replace(/['"]/g, '');
});

async function simulateRequest(body) {
  let status = 200;
  let jsonResponse = null;
  const req = {
    method: 'POST',
    body
  };
  const res = {
    status: (s) => {
      status = s;
      return res;
    },
    json: (data) => {
      jsonResponse = data;
      return res;
    }
  };
  
  await handler(req, res);
  return { status, data: jsonResponse };
}

const validProfileData = {
  full_name: 'Test Name',
  role: 'field_worker',
  phone: '555-555-5555',
  is_active: true,
  status: 'Active'
};

async function runTests() {
  console.log('--- TEST A — Normal user ---');
  let res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: 'normal_user' + Date.now() + '@example.com',
    fullName: 'Normal User',
    password: 'Password123!',
    profileData: validProfileData
  });
  console.log('TEST A Result:', res.status, res.data);

  console.log('\n--- TEST B — Uppercase email ---');
  res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: 'TEST.UPPERCASE' + Date.now() + '@EXAMPLE.com',
    fullName: 'Uppercase Email',
    password: 'Password123!',
    profileData: validProfileData
  });
  console.log('TEST B Result:', res.status, res.data);

  console.log('\n--- TEST C — Outer spaces ---');
  res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: '   spaces' + Date.now() + '@example.com   ',
    fullName: 'Spaces User',
    password: 'Password123!',
    profileData: validProfileData
  });
  console.log('TEST C Result:', res.status, res.data);

  console.log('\n--- TEST D — Invalid email ---');
  res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: 'not-an-email',
    fullName: 'Invalid Email',
    password: 'Password123!',
    profileData: validProfileData
  });
  console.log('TEST D Result:', res.status, res.data);

  console.log('\n--- TEST E — Hidden newline/control character ---');
  res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: 'newline\n' + Date.now() + '@example.com',
    fullName: 'Newline Email',
    password: 'Password123!',
    profileData: validProfileData
  });
  console.log('TEST E Result:', res.status, res.data);

  console.log('\n--- TEST F — Duplicate email ---');
  const duplicateEmail = 'duplicate' + Date.now() + '@example.com';
  await simulateRequest({ auth_token: 'TEST_BYPASS', email: duplicateEmail, fullName: 'Dup 1', password: 'Password123!', profileData: validProfileData });
  res = await simulateRequest({ auth_token: 'TEST_BYPASS', email: duplicateEmail, fullName: 'Dup 2', password: 'Password123!', profileData: validProfileData });
  console.log('TEST F Result:', res.status, res.data);

  console.log('\n--- TEST G — Full metadata ---');
  res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: 'full' + Date.now() + '@example.com',
    fullName: 'Full Metadata',
    password: 'Password123!',
    profileData: validProfileData,
    wage: 25,
    payrollType: 'Hourly',
    certifications: [{ name: 'OSHA 10', issue_date: '2023-01-01', expiry_date: '2025-01-01' }]
  });
  console.log('TEST G Result:', res.status, res.data);

  console.log('\n--- TEST H — Staff record failure simulation ---');
  res = await simulateRequest({
    auth_token: 'TEST_BYPASS',
    email: 'fail' + Date.now() + '@example.com',
    fullName: 'Fail Record',
    password: 'Password123!',
    profileData: {
      is_active: 'NOT_A_BOOLEAN' // this will cause Postgres to throw error on insertion!
    }
  });
  console.log('TEST H Result:', res.status, res.data);

  console.log('\n--- TEST I — Unauthorized request ---');
  res = await simulateRequest({
    // no auth_token
    email: 'unauth' + Date.now() + '@example.com',
    fullName: 'Unauth User',
    password: 'Password123!',
    profileData: validProfileData
  });
  console.log('TEST I Result:', res.status, res.data);
}

runTests().catch(console.error);
