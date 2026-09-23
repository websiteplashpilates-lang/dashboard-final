const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Parse .env
const envPath = path.join(__dirname, '..', '.env');
const envLines = fs.readFileSync(envPath, 'utf8').split('\n');
for (const line of envLines) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
    const idx = trimmed.indexOf('=');
    const k = trimmed.slice(0, idx).trim();
    const v = trimmed.slice(idx + 1).trim();
    process.env[k] = v;
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runEndToEndPaymentTest() {
  console.log('--- 1. Testing Backend /api/create-razorpay-order ---');
  const aishaId = '11111111-1111-1111-1111-111111111111';
  const orderRes = await fetch('http://localhost:3333/api/create-razorpay-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: 2700000,
      currency: 'INR',
      packageId: 'pkg-001',
      memberId: aishaId,
      receipt: `rcpt_test_${Date.now()}`
    })
  });
  console.log('Order creation HTTP status:', orderRes.status);
  const orderData = await orderRes.json();
  console.log('Order created:', orderData);

  console.log('\n--- 2. Simulating Razorpay Gateway Fulfillment Insertion ---');
  // We insert a live payment directly with the server payment schema, simulating a completed transaction
  const paymentId = `pay_e2e_${Date.now()}`;
  const now = new Date();
  const paymentRow = {
    id: `pay-${Date.now().toString().slice(-8)}`,
    member_id: aishaId,
    package_id: 'pkg-001',
    invoice_no: `INV-E2E-${Date.now().toString().slice(-4)}`,
    gstin: '29ABIFP5917A1Z7',
    base_amount_inr: 22881.36,
    cgst_inr: 2059.32,
    sgst_inr: 2059.32,
    total_amount_inr: 27000.00,
    payment_method: 'Razorpay Live Gateway (UPI)',
    reference: paymentId,
    status: 'paid',
    created_at: now.toISOString()
  };

  const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(paymentRow)
  });
  console.log('Supabase insert status:', insertRes.status);
  const insertedRow = await insertRes.json();
  console.log('Persisted row:', insertedRow[0]);

  console.log('\n--- 3. Launching Real Browser to Verify UI & Hard Refresh ---');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Visit Login
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await sleep(500);

  // Login
  await page.waitForSelector('#login-email');
  await page.type('#login-email', 'aisha.kapoor@example.com', { delay: 10 });
  await page.type('#login-password', 'member123', { delay: 10 });
  await page.click('#btn-submit-login');
  await sleep(2000);

  // Navigate to Payment History
  console.log('Navigating to Payment History...');
  await page.goto('http://localhost:3333/#/portal/payments', { waitUntil: 'networkidle0' });
  await sleep(2000);

  let beforeRefresh = await page.evaluate((ref) => {
    const rows = Array.from(document.querySelectorAll('.data-table tbody tr'));
    const text = document.querySelector('.card')?.innerText || '';
    const hasRef = text.includes(ref);
    return { count: rows.length, hasRef };
  }, paymentId);
  console.log('Before refresh:', beforeRefresh);

  // Hard Refresh
  console.log('Executing Hard Refresh (F5 / reload)...');
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(2000);

  let afterRefresh = await page.evaluate((ref) => {
    const rows = Array.from(document.querySelectorAll('.data-table tbody tr'));
    const text = document.querySelector('.card')?.innerText || '';
    const hasRef = text.includes(ref);
    return { count: rows.length, hasRef };
  }, paymentId);
  console.log('After refresh:', afterRefresh);

  await browser.close();

  if (afterRefresh.hasRef && afterRefresh.count > 0) {
    console.log('\nSUCCESS: Payment persisted and verified after hard browser reload!');
  } else {
    throw new Error('Payment was not found after browser refresh.');
  }
}

runEndToEndPaymentTest().catch(err => {
  console.error(err);
  process.exit(1);
});
