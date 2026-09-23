const fs = require('fs');
const path = require('path');

// Parse .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const k = trimmed.slice(0, idx).trim();
      const v = trimmed.slice(idx + 1).trim();
      process.env[k] = v;
    }
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  console.log('Testing Supabase query from payments table...');

  // 1. Test with Service Role
  const sRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*,member:profiles(id,full_name,email,phone,tier),package:packages(*)`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  console.log('Service role status:', sRes.status);
  const sData = await sRes.json();
  console.log('Service role data count:', Array.isArray(sData) ? sData.length : sData);
  if (Array.isArray(sData) && sData.length > 0) {
    console.log('First payment row:', JSON.stringify(sData[0], null, 2));
  }

  // 2. Test with Anon Key (no auth header)
  const aRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*,member:profiles(id,full_name,email,phone,tier),package:packages(*)`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
  });
  console.log('Anon status:', aRes.status);
  const aData = await aRes.json();
  console.log('Anon data count:', Array.isArray(aData) ? aData.length : aData);

  // 3. Test with Authenticated Member JWT (Aisha Kapoor)
  // Let's generate or get Aisha's token or login
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aisha.kapoor@example.com', password: 'member123' })
  });
  console.log('Login status for Aisha:', loginRes.status);
  if (loginRes.ok) {
    const authData = await loginRes.json();
    const token = authData.access_token;
    console.log('Aisha UID:', authData.user.id);

    const mRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*,member:profiles(id,full_name,email,phone,tier),package:packages(*)`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
    });
    console.log('Member JWT payments query status:', mRes.status);
    const mData = await mRes.json();
    console.log('Member JWT payments count:', Array.isArray(mData) ? mData.length : mData);
    if (Array.isArray(mData) && mData.length > 0) {
      console.log('Member first payment:', JSON.stringify(mData[0], null, 2));
    }
  }
}

run().catch(console.error);
