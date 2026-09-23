const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testSignupAndPayments() {
  console.log('=== TESTING SIGNUP FORM INPUT & REGISTRATION FLOW ===');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log('  [BROWSER CONSOLE ERROR]:', msg.text());
    }
  });

  // 1. Visit Login / Signup page
  console.log('1. Navigating to #/login...');
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await sleep(1000);

  // Accept cookies if present
  try {
    const acceptBtn = await page.$('button.btn-accept');
    if (acceptBtn) await acceptBtn.click();
  } catch (_) {}

  // 2. Switch to Sign Up tab
  console.log('2. Switching to Create Membership tab...');
  await page.click('#btn-switch-to-signup');
  await sleep(1000);

  // 3. Test typing into password and confirm password inputs (should NOT throw errBox is not defined)
  console.log('3. Typing into password and confirm-password fields...');
  await page.type('#signup-name', 'Test User', { delay: 10 });
  const testEmail = `test.member.${Date.now()}@plashpilates.com`;
  await page.type('#signup-email', testEmail, { delay: 10 });
  await page.type('#signup-phone', '+91 99999 88888', { delay: 10 });

  await page.type('#signup-password', 'TestPassword123!', { delay: 10 });
  await page.type('#signup-confirm-password', 'TestPassword123!', { delay: 10 });
  await sleep(500);

  const hadErrBoxError = consoleErrors.some(e => e.includes('errBox is not defined'));
  console.log('   Any errBox ReferenceErrors while typing?', hadErrBoxError ? 'YES (FAIL)' : 'NO (FIXED!)');
  if (hadErrBoxError) {
    throw new Error('errBox is not defined was thrown during typing!');
  }

  // Check waiver checkbox
  await page.click('#signup-waiver');
  await sleep(300);

  // 4. Submit Registration
  console.log('4. Submitting membership creation form...');
  await page.click('#btn-submit-signup');
  await sleep(4000);

  const currentUrl = page.url();
  console.log('   URL after registration:', currentUrl);

  const hadUnhandledRejection = consoleErrors.some(e => e.includes('Unhandled Rejection') || e.includes('Email not confirmed'));
  console.log('   Any Unhandled Rejections or Email Confirmation errors?', hadUnhandledRejection ? 'YES (FAIL)' : 'NO (PASS!)');

  await browser.close();

  if (hadErrBoxError || hadUnhandledRejection) {
    process.exit(1);
  } else {
    console.log('\nALL SIGNUP & INPUT VERIFICATIONS PASSED SUCCESSFULLY!');
  }
}

testSignupAndPayments().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
