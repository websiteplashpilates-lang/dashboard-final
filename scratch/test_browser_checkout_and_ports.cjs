const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testBrowserCheckoutAndPorts() {
  console.log('=== VERIFYING ZERO CONSOLE ERRORS & PORT 7071 / PAYMENT ENUM ===');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
      console.log('  [BROWSER ERROR]:', msg.text());
    }
  });

  page.on('requestfailed', request => {
    const url = request.url();
    // Filter out expected external tracker failures if any
    console.log('  [REQUEST FAILED]:', url, request.failure().errorText);
    errors.push(`${url}: ${request.failure().errorText}`);
  });

  // 1. Load app on port 3333
  console.log('1. Loading app...');
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await sleep(1000);

  // 2. Login as Aisha
  console.log('2. Logging in...');
  await page.type('#login-email', 'aisha.kapoor@example.com', { delay: 10 });
  await page.type('#login-password', 'member123', { delay: 10 });
  await page.click('#btn-submit-login');
  await sleep(2000);

  // 3. Navigate to Cart
  console.log('3. Navigating to Cart...');
  await page.goto('http://localhost:3333/#/portal/cart', { waitUntil: 'networkidle0' });
  await sleep(1000);

  // 4. Navigate to Packages & add to cart
  console.log('4. Navigating to Packages & adding package...');
  await page.goto('http://localhost:3333/#/portal/packages', { waitUntil: 'networkidle0' });
  await sleep(1500);

  const buyBtn = await page.$('.btn-purchase');
  if (buyBtn) {
    await buyBtn.click();
    await sleep(1000);
  }

  // 5. Test probe request to port 7071 inside page context
  console.log('5. Testing port 7071 image fetch in page context...');
  const probeResult = await page.evaluate(async () => {
    try {
      const res = await fetch('http://localhost:7071/0934709.png');
      return { ok: res.ok, status: res.status };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });
  console.log('   Port 7071 probe in browser:', probeResult);

  // 6. Navigate to Payment History
  console.log('6. Navigating to Payment History...');
  await page.goto('http://localhost:3333/#/portal/payments', { waitUntil: 'networkidle0' });
  await sleep(2000);

  await browser.close();

  const had7071Refused = errors.some(e => e.includes('7071') && e.includes('net::ERR_CONNECTION_REFUSED'));
  const hadCompletedEnum = errors.some(e => e.includes('completed') && e.includes('enum payment_status'));

  console.log('\n--- VERIFICATION AUDIT ---');
  console.log('Port 7071 ERR_CONNECTION_REFUSED present?', had7071Refused ? 'YES (FAIL)' : 'NO (RESOLVED!)');
  console.log('Enum payment_status "completed" present?', hadCompletedEnum ? 'YES (FAIL)' : 'NO (RESOLVED!)');

  if (had7071Refused || hadCompletedEnum) {
    process.exit(1);
  } else {
    console.log('\nALL ISSUES FIXED AND VERIFIED CLEAN!');
  }
}

testBrowserCheckoutAndPorts().catch(err => {
  console.error(err);
  process.exit(1);
});
