const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));
const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');
const EVIDENCE_DIR = path.join(__dirname, '..', 'docs', 'evidence', 'screenshots');

for (const dir of [SCREENSHOT_DIR, EVIDENCE_DIR]) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function saveShot(page, filename) {
  const p1 = path.join(SCREENSHOT_DIR, filename);
  const p2 = path.join(EVIDENCE_DIR, filename);
  await page.screenshot({ path: p1 });
  fs.copyFileSync(p1, p2);
  console.log(`[SAVED SHOT]: ${filename}`);
}

async function captureAll() {
  console.log('Launching headless Chrome with fresh clean session...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  // 1. Visit Login
  console.log('--- 1. Capturing Login ---');
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await sleep(1000);

  // Accept cookies if present
  try {
    const acceptBtn = await page.$('button.btn-accept');
    if (acceptBtn) {
      await acceptBtn.click();
      await sleep(500);
    }
  } catch (e) {}

  await saveShot(page, '01-homepage.png');

  // 2. Signup View
  console.log('--- 2. Capturing Signup ---');
  await page.evaluate(() => { window.location.hash = '#/signup'; });
  await sleep(1000);
  await saveShot(page, '02-signup.png');

  // 3. Forgot Password View (Native Supabase Recovery Modal)
  console.log('--- 3. Capturing Forgot Password ---');
  await page.evaluate(() => { window.location.hash = '#/login'; });
  await sleep(800);
  const forgotLink = await page.$('#btn-forgot-password-link');
  if (forgotLink) {
    await forgotLink.click();
    await sleep(800);
  } else {
    await page.evaluate(() => { window.location.hash = '#/forgot-password'; });
    await sleep(800);
  }
  await saveShot(page, '03-forgot-password.png');

  // Close modal
  try {
    const cancelBtn = await page.$('#btn-cancel-reset, .modal-close');
    if (cancelBtn) await cancelBtn.click();
    await sleep(500);
  } catch (_) {}

  // 4. Log in as Member (Aisha Kapoor)
  console.log('--- 4. Logging in as Member (Aisha Kapoor) ---');
  await page.evaluate(() => { window.location.hash = '#/login'; });
  await sleep(800);

  await page.type('#login-email', 'aisha.kapoor@example.com', { delay: 30 });
  await page.type('#login-password', 'member123', { delay: 30 });
  await page.click('#btn-submit-login');
  await sleep(2500);

  console.log('Current URL after member login:', page.url());
  await saveShot(page, '04-member-dashboard.png');

  // 5. Member Packages
  console.log('--- 5. Member Packages ---');
  await page.evaluate(() => { window.location.hash = '#/portal/packages'; });
  await sleep(1200);
  await saveShot(page, '05-member-packages.png');

  // 6. Member Book Class
  console.log('--- 6. Member Book Class ---');
  await page.evaluate(() => { window.location.hash = '#/portal/book'; });
  await sleep(1500);
  await saveShot(page, '06-member-book.png');

  // 7. Booking Modal
  console.log('--- 7. Booking Modal ---');
  try {
    const bookBtn = await page.$('button.btn-book-action, button.btn-primary');
    if (bookBtn) {
      await bookBtn.click();
      await sleep(1000);
      await saveShot(page, '07-booking-modal.png');
      const closeBtn = await page.$('.modal-close, button[aria-label="Close modal"]');
      if (closeBtn) await closeBtn.click();
      await sleep(500);
    }
  } catch (e) {
    console.warn('Booking modal click warning:', e.message);
  }

  // 8. Member Bookings List
  console.log('--- 8. Member Bookings ---');
  await page.evaluate(() => { window.location.hash = '#/portal/bookings'; });
  await sleep(1200);
  await saveShot(page, '08-member-bookings.png');

  // 9. Member Cart
  console.log('--- 9. Member Cart ---');
  await page.evaluate(() => { window.location.hash = '#/portal/cart'; });
  await sleep(1200);
  await saveShot(page, '09-member-cart.png');

  // 10. Member Payments
  console.log('--- 10. Member Payments ---');
  await page.evaluate(() => { window.location.hash = '#/portal/payments'; });
  await sleep(1200);
  await saveShot(page, '10-member-payments.png');

  // 11. Member Profile
  console.log('--- 11. Member Profile ---');
  await page.evaluate(() => { window.location.hash = '#/portal/profile'; });
  await sleep(1200);
  await saveShot(page, '11-member-profile.png');

  // 12. Member Security
  console.log('--- 12. Member Security ---');
  await page.evaluate(() => { window.location.hash = '#/portal/security'; });
  await sleep(1200);
  await saveShot(page, '12-member-security.png');

  // 13. Security RBAC 403 (Attempt admin access as member)
  console.log('--- 13. Security RBAC 403 Violation ---');
  await page.evaluate(() => { window.location.hash = '#/admin/overview'; });
  await sleep(1000);
  await saveShot(page, '13-security-403.png');

  // 14. Admin Login
  console.log('--- 14. Admin Login ---');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/login';
  });
  await sleep(1000);
  await page.type('#login-email', 'studio.admin@plashpilates.com', { delay: 30 });
  await page.type('#login-password', 'admin123', { delay: 30 });
  await page.click('#btn-submit-login');
  await sleep(2500);

  console.log('Current URL after admin login:', page.url());
  await saveShot(page, '14-admin-overview.png');

  // 15. Admin Members
  console.log('--- 15. Admin Members ---');
  await page.evaluate(() => { window.location.hash = '#/admin/members'; });
  await sleep(1200);
  await saveShot(page, '15-admin-members.png');

  // 16. Admin Schedule
  console.log('--- 16. Admin Schedule ---');
  await page.evaluate(() => { window.location.hash = '#/admin/schedule'; });
  await sleep(1200);
  await saveShot(page, '16-admin-schedule.png');

  // 17. Admin Packages
  console.log('--- 17. Admin Packages ---');
  await page.evaluate(() => { window.location.hash = '#/admin/packages'; });
  await sleep(1200);
  await saveShot(page, '17-admin-packages.png');

  // 18. Admin Bookings
  console.log('--- 18. Admin Bookings ---');
  await page.evaluate(() => { window.location.hash = '#/admin/bookings'; });
  await sleep(1200);
  await saveShot(page, '18-admin-bookings.png');

  // 19. Trainer Dashboard
  console.log('--- 19. Trainer Dashboard ---');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/login';
  });
  await sleep(1000);
  await page.type('#login-email', 'priya.sharma@plashpilates.com', { delay: 30 });
  await page.type('#login-password', 'trainer123', { delay: 30 });
  await page.click('#btn-submit-login');
  await sleep(2500);

  console.log('Current URL after trainer login:', page.url());
  await saveShot(page, '19-trainer-dashboard.png');

  // 20. Partner Portal
  console.log('--- 20. Partner Portal ---');
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.location.hash = '#/login';
  });
  await sleep(1000);
  await page.type('#login-email', 'ananya.deshmukh@physicq57.com', { delay: 30 });
  await page.type('#login-password', 'partner123', { delay: 30 });
  await page.click('#btn-submit-login');
  await sleep(2500);

  console.log('Current URL after partner login:', page.url());
  await saveShot(page, '20-partner-portal.png');

  // 21. Legal Privacy
  console.log('--- 21. Legal Privacy ---');
  await page.evaluate(() => { window.location.hash = '#/legal/privacy'; });
  await sleep(1000);
  await saveShot(page, '21-legal-privacy.png');

  // 22. Legal Terms
  console.log('--- 22. Legal Terms ---');
  await page.evaluate(() => { window.location.hash = '#/legal/terms'; });
  await sleep(1000);
  await saveShot(page, '22-legal-terms.png');

  // 23. Native Reset Password View
  console.log('--- 23. Reset Password View ---');
  await page.evaluate(() => { window.location.hash = '#/reset-password'; });
  await sleep(1000);
  await saveShot(page, '23-reset-password.png');

  await browser.close();
  console.log('All fresh screenshots captured and mirrored to docs/evidence/screenshots successfully!');
}

captureAll().catch(err => {
  console.error('Fatal error during capture:', err);
  process.exit(1);
});
