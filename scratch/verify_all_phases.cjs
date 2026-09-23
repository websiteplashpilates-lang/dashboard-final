const fs = require('fs');
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');

// Load environment variables
const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET;
const BASE_URL = 'http://localhost:3333';

const results = {};

function recordResult(testName, passed, details = '') {
  results[testName] = { passed, details };
  console.log(`[${passed ? 'PASS' : 'FAIL'}] ${testName} ${details ? '- ' + details : ''}`);
}

async function runVerification() {
  console.log('================================================================');
  console.log('  PLASH PILATES — COMPLETE PRODUCTION AUDIT & VERIFICATION');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // PHASE 1 & 2: Supabase GoTrue Auth & Member Profiles RLS
  // -------------------------------------------------------------
  console.log('--- PHASE 1 & 2: PROFILES RLS & AUTHENTICATION ---');
  const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'aisha.kapoor@example.com', password: 'member123' })
  });

  if (!loginRes.ok) {
    recordResult('MEMBER_AUTHENTICATION', false, `Status ${loginRes.status}`);
    process.exit(1);
  }
  const loginData = await loginRes.json();
  const aishaJwt = loginData.access_token;
  const aishaId = loginData.user.id;
  recordResult('MEMBER_AUTHENTICATION', true, `Aisha UUID: ${aishaId}`);

  // Query own profile with member JWT
  const ownProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${aishaId}&select=*`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${aishaJwt}` }
  });
  const ownProfileData = await ownProfileRes.json();
  const canReadOwnProfile = ownProfileRes.ok && ownProfileData.length === 1 && ownProfileData[0].id === aishaId;
  recordResult('READ_OWN_PROFILE', canReadOwnProfile, `Status: ${ownProfileRes.status}`);

  // Member update own profile with member JWT
  const newName = `Aisha Kapoor (Verified ${Date.now().toString().slice(-4)})`;
  const newPhone = `+91 98450 ${Math.floor(10000 + Math.random() * 90000)}`;
  const updateOwnRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${aishaId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${aishaJwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ full_name: newName, phone: newPhone, updated_at: new Date().toISOString() })
  });
  const updateOwnData = await updateOwnRes.json();
  const updateOwnPassed = updateOwnRes.ok && updateOwnData.length === 1 && updateOwnData[0].full_name === newName;
  recordResult('UPDATE_OWN_PROFILE_RLS', updateOwnPassed, `DB confirmed: ${updateOwnData[0]?.full_name}`);

  // Cross-member profile update attempt (Aisha trying to update Sandeep John)
  const sandeepId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const hackCrossProfileRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${sandeepId}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${aishaJwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ full_name: 'HACKED BY CROSS USER' })
  });
  const hackCrossData = await hackCrossProfileRes.json();
  const crossProfileBlocked = hackCrossProfileRes.ok && hackCrossData.length === 0;
  recordResult('CROSS_MEMBER_PROFILE_ISOLATION', crossProfileBlocked, `Modified rows: ${hackCrossData.length} (Expected 0)`);

  // Anonymous profile insert attempt
  const anonInsertRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: crypto.randomUUID(), email: `anon_hack_${Date.now()}@test.com`, full_name: 'Anon Hacker' })
  });
  const anonInsertBlocked = anonInsertRes.status === 401 || anonInsertRes.status === 403;
  recordResult('ANONYMOUS_PROFILE_INSERT_DENIED', anonInsertBlocked, `Status: ${anonInsertRes.status}`);

  // -------------------------------------------------------------
  // PHASE 4 & 5: Payments & Passes RLS
  // -------------------------------------------------------------
  console.log('\n--- PHASE 4 & 5: PAYMENTS & MEMBER PASSES ZERO-TRUST RLS ---');

  // Direct member insert into payments
  const hackPaymentRes = await fetch(`${SUPABASE_URL}/rest/v1/payments`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${aishaJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `pay-hack-${Date.now()}`,
      member_id: aishaId,
      package_id: 'pkg-001',
      total_amount_inr: 10,
      status: 'paid',
      reference: 'hack'
    })
  });
  const directPaymentBlocked = hackPaymentRes.status === 401 || hackPaymentRes.status === 403;
  recordResult('DIRECT_MEMBER_PAYMENT_INSERT_DENIED', directPaymentBlocked, `Status: ${hackPaymentRes.status} (Zero Trust Enforced)`);

  // Direct member insert into member_passes
  const hackPassRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${aishaJwt}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      id: `pass-hack-${Date.now()}`,
      member_id: aishaId,
      package_id: 'pkg-001',
      status: 'active'
    })
  });
  const directPassBlocked = hackPassRes.status === 401 || hackPassRes.status === 403;
  recordResult('DIRECT_MEMBER_PASS_INSERT_DENIED', directPassBlocked, `Status: ${hackPassRes.status} (Zero Trust Enforced)`);

  // Cross-member payments read
  const crossPaymentsRes = await fetch(`${SUPABASE_URL}/rest/v1/payments?member_id=eq.${sandeepId}&select=*`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${aishaJwt}` }
  });
  const crossPaymentsData = await crossPaymentsRes.json();
  const crossPaymentsIsolated = crossPaymentsRes.ok && crossPaymentsData.length === 0;
  recordResult('CROSS_MEMBER_PAYMENTS_ISOLATION', crossPaymentsIsolated, `Returned rows: ${crossPaymentsData.length} (Expected 0)`);

  // Cross-member passes read
  const crossPassesRes = await fetch(`${SUPABASE_URL}/rest/v1/member_passes?member_id=eq.${sandeepId}&select=*`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${aishaJwt}` }
  });
  const crossPassesData = await crossPassesRes.json();
  const crossPassesIsolated = crossPassesRes.ok && crossPassesData.length === 0;
  recordResult('CROSS_MEMBER_PASSES_ISOLATION', crossPassesIsolated, `Returned rows: ${crossPassesData.length} (Expected 0)`);

  // -------------------------------------------------------------
  // PHASE 6: Payment Verification & Fulfillment Security
  // -------------------------------------------------------------
  console.log('\n--- PHASE 6: PAYMENT VERIFICATION & FULFILLMENT ---');

  // Test Missing Parameters -> 400
  const missingParamsRes = await fetch(`${BASE_URL}/api/verify-and-fulfill-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ packageId: 'pkg-001' })
  });
  recordResult('PAYMENT_VERIFY_MISSING_PARAMS_REJECTED', missingParamsRes.status === 400, `Status: ${missingParamsRes.status}`);

  // Test Tampered Signature -> 400
  const fakeSigRes = await fetch(`${BASE_URL}/api/verify-and-fulfill-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: 'order_test_123',
      razorpay_payment_id: 'pay_test_123',
      razorpay_signature: 'invalid_forged_signature_000000',
      packageId: 'pkg-001',
      memberId: aishaId
    })
  });
  recordResult('PAYMENT_VERIFY_FORGED_SIGNATURE_REJECTED', fakeSigRes.status === 400, `Status: ${fakeSigRes.status}`);

  // Test Legitimate Cryptographic Fulfillment with Live Razorpay Test Payment
  const testOrderId = 'order_TdkNz0DEUgr56N';
  const testPaymentId = 'pay_TdkOHFNySjUlgC';
  const validSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${testOrderId}|${testPaymentId}`)
    .digest('hex');

  const fulfillRes = await fetch(`${BASE_URL}/api/verify-and-fulfill-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: testOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
      packageId: 'pkg-001',
      memberId: aishaId
    })
  });

  const fulfillData = await fulfillRes.json();
  const fulfillPassed = fulfillRes.ok && fulfillData.success && fulfillData.payment?.id && fulfillData.pass?.id;
  recordResult('PAYMENT_FULFILLMENT_SUCCESS', fulfillPassed, `Invoice: ${fulfillData.payment?.invoiceNo}, Pass: ${fulfillData.pass?.id}`);

  // Test Idempotent Replay -> returns existing invoice without duplicating passes
  const replayRes = await fetch(`${BASE_URL}/api/verify-and-fulfill-payment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      razorpay_order_id: testOrderId,
      razorpay_payment_id: testPaymentId,
      razorpay_signature: validSignature,
      packageId: 'pkg-001',
      memberId: aishaId
    })
  });
  const replayData = await replayRes.json();
  const replayIdempotent = replayRes.ok && replayData.idempotent === true && replayData.payment?.invoiceNo === fulfillData.payment?.invoiceNo;
  recordResult('PAYMENT_IDEMPOTENCY_REPLAY_PROTECTION', replayIdempotent, `Idempotent confirmed: ${replayData.idempotent}`);

  // -------------------------------------------------------------
  // PHASE 8 & 9: Localhost Audit & Mixed Content
  // -------------------------------------------------------------
  console.log('\n--- PHASE 8 & 9: LOCALHOST CODEBASE AUDIT ---');
  const filesToScan = [
    'js/core/supabase.js',
    'js/core/store.js',
    'js/pages/portal/cart.js',
    'js/pages/portal/profile.js',
    'js/pages/portal/payments.js',
    'index.html'
  ];
  let localhostHits = 0;
  for (const f of filesToScan) {
    const content = fs.readFileSync(f, 'utf8');
    const matches = content.match(/http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?/g);
    if (matches) {
      console.error(`Found prohibited localhost URL in ${f}:`, matches);
      localhostHits += matches.length;
    }
  }
  recordResult('ZERO_LOCALHOST_IN_PRODUCTION_FRONTEND', localhostHits === 0, `${localhostHits} references found`);

  // -------------------------------------------------------------
  // PHASE 3, 14, 17: Full Clean Browser Test (Puppeteer)
  // -------------------------------------------------------------
  console.log('\n--- PHASE 3, 14, 17: REAL BROWSER PERSISTENCE & HARD REFRESH TEST ---');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-features=PrivateNetworkAccessNonSecureContextsAllowed']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // 1. Visit Login
  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 10000 });

  // 2. Perform Clean Login
  await page.type('#login-email', 'aisha.kapoor@example.com');
  await page.type('#login-password', 'member123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await new Promise(r => setTimeout(r, 2000));
  recordResult('BROWSER_LOGIN_SUCCESS', page.url().includes('#/portal/dashboard'), `Current URL: ${page.url()}`);

  // 3. Navigate to Member Profile Page
  await page.goto(`${BASE_URL}/#/portal/profile`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  const browserNameVal = `Aisha Automated ${Date.now().toString().slice(-4)}`;
  const browserPhoneVal = `+91 99112 ${Math.floor(10000 + Math.random() * 90000)}`;

  // Set values via DOM
  await page.evaluate((name, phone) => {
    const nInput = document.querySelector('#p-name');
    const pInput = document.querySelector('#p-phone');
    if (nInput) nInput.value = name;
    if (pInput) pInput.value = phone;
  }, browserNameVal, browserPhoneVal);

  // Click Update Contact Info
  await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    if (forms[0]) {
      const submitBtn = forms[0].querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.click();
    }
  });

  await new Promise(r => setTimeout(r, 2500));

  // Verify in Supabase directly
  const dbVerifyRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${aishaId}&select=*`, {
    headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
  });
  const dbRows = await dbVerifyRes.json();
  const dbSavedName = dbRows[0]?.full_name;
  recordResult('BROWSER_PROFILE_SAVE_DB_CONFIRMED', dbSavedName === browserNameVal, `DB saved name: "${dbSavedName}"`);

  // 4. Hard Refresh and Verify UI
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  const refreshedName = await page.evaluate(() => document.querySelector('#p-name')?.value);
  const refreshedPhone = await page.evaluate(() => document.querySelector('#p-phone')?.value);
  const refreshPersisted = refreshedName === browserNameVal;
  recordResult('BROWSER_PROFILE_HARD_REFRESH_PERSISTENCE', refreshPersisted, `Value after refresh: "${refreshedName}"`);

  // 5. Logout and Login Again
  await page.evaluate(() => {
    const logoutBtn = document.querySelector('.sidebar-action-btn.logout') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Log Out') || b.title?.includes('Log Out'));
    if (logoutBtn) logoutBtn.click();
  });
  await new Promise(r => setTimeout(r, 1500));

  await page.goto(`${BASE_URL}/#/login`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 10000 });
  await page.type('#login-email', 'aisha.kapoor@example.com');
  await page.type('#login-password', 'member123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2500));

  await page.goto(`${BASE_URL}/#/portal/profile`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1500));

  const reLoginName = await page.evaluate(() => document.querySelector('#p-name')?.value);
  const reLoginPersisted = reLoginName === browserNameVal;
  recordResult('BROWSER_PROFILE_RELOGIN_PERSISTENCE', reLoginPersisted, `Value after re-login: "${reLoginName}"`);

  // 6. Navigate to Payments History & Check Persistence
  await page.goto(`${BASE_URL}/#/portal/payments`, { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  const paymentsCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    return rows.length;
  });
  recordResult('PAYMENT_HISTORY_RENDERS_ROWS', paymentsCount > 0, `Rendered payment rows: ${paymentsCount}`);

  // Hard refresh payments page
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  const refreshedPaymentsCount = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tbody tr');
    return rows.length;
  });
  recordResult('PAYMENT_HISTORY_HARD_REFRESH_PERSISTENCE', refreshedPaymentsCount === paymentsCount && refreshedPaymentsCount > 0, `Rows after refresh: ${refreshedPaymentsCount}`);

  // Check for 403 or 400 console errors
  const forbiddenErrors = consoleErrors.filter(e => e.includes('403') || e.includes('row-level security') || e.includes('violates'));
  const badRequestErrors = consoleErrors.filter(e => e.includes('400') || e.includes('verify-and-fulfill-payment'));
  const loopbackCorsErrors = consoleErrors.filter(e => e.includes('loopback') || e.includes('7071') || e.includes('ERR_CONNECTION_REFUSED'));

  recordResult('ZERO_RLS_403_BROWSER_ERRORS', forbiddenErrors.length === 0, `${forbiddenErrors.length} errors recorded`);
  recordResult('ZERO_VERIFY_400_BROWSER_ERRORS', badRequestErrors.length === 0, `${badRequestErrors.length} errors recorded`);
  recordResult('ZERO_LOOPBACK_CORS_ERRORS', loopbackCorsErrors.length === 0, `${loopbackCorsErrors.length} errors recorded`);

  await browser.close();

  // -------------------------------------------------------------
  // FINAL SCORECARD
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('  FINAL VERIFICATION SUMMARY');
  console.log('================================================================');
  const allTests = Object.keys(results);
  const passedTests = allTests.filter(t => results[t].passed);
  console.log(`TOTAL AUDIT CHECKS: ${allTests.length}`);
  console.log(`PASSED: ${passedTests.length}`);
  console.log(`FAILED: ${allTests.length - passedTests.length}`);
  console.log('================================================================\n');

  if (passedTests.length === allTests.length) {
    console.log('ALL VERIFICATION PHASES PASSED WITH 100% EVIDENCE.');
    process.exit(0);
  } else {
    console.error('SOME CHECKS FAILED:');
    allTests.filter(t => !results[t].passed).forEach(t => console.error(`  - ${t}: ${results[t].details}`));
    process.exit(1);
  }
}

runVerification().catch(err => {
  console.error('FATAL VERIFICATION RUNNER ERROR:', err);
  process.exit(1);
});
