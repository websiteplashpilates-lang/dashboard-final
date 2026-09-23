const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
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

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

async function testFulfill() {
  console.log('Testing payment insertion to Supabase...');

  const memberId = '11111111-1111-1111-1111-111111111111'; // Aisha Kapoor
  const packageId = 'pkg-001'; // 1-Month Foundation

  // 1. Create a simulated payment record using the server's payment structure
  const now = new Date();
  const testOrderId = `order_test_${Date.now()}`;
  const testPaymentId = `pay_test_${Date.now()}`;
  
  // Calculate signature
  const hmac = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET);
  hmac.update(`${testOrderId}|${testPaymentId}`);
  const signature = hmac.digest('hex');

  // Let's insert a test payment row directly via Supabase REST to see if public.payments accepts it
  const paymentRow = {
    id: `pay-${Date.now().toString().slice(-8)}`,
    member_id: memberId,
    package_id: packageId,
    invoice_no: `INV-${Date.now().toString().slice(-6)}`,
    gstin: '29ABIFP5917A1Z7',
    base_amount_inr: 22881.36,
    cgst_inr: 2059.32,
    sgst_inr: 2059.32,
    total_amount_inr: 27000.00,
    payment_method: 'Razorpay Live Gateway',
    reference: testPaymentId,
    status: 'paid',
    created_at: now.toISOString()
  };

  console.log('Attempting to insert paymentRow into Supabase with SERVICE_ROLE_KEY:');
  console.log(paymentRow);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(paymentRow)
  });

  console.log('Insert status:', res.status);
  const data = await res.json();
  console.log('Insert response:', data);

  // Now query it back with Aisha's token!
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aisha.kapoor@example.com', password: 'member123' })
  });
  const authData = await loginRes.json();
  const aishaToken = authData.access_token;

  console.log('\nQuerying payments as Aisha Kapoor (Member JWT):');
  const queryRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*,member:profiles(id,full_name,email,phone,tier),package:packages(*)`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${aishaToken}`
    }
  });
  console.log('Query status with Aisha JWT:', queryRes.status);
  const queryData = await queryRes.json();
  console.log('Query data length:', queryData.length);
  console.log('Query data:', JSON.stringify(queryData, null, 2));

  // Now query without auth header (Anon):
  console.log('\nQuerying payments as Anon:');
  const anonRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`
    }
  });
  const anonData = await anonRes.json();
  console.log('Query data length for Anon:', anonData.length);
}

testFulfill().catch(console.error);
