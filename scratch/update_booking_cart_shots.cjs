const puppeteer = require('puppeteer-core');
const path = require('path');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SCREENSHOT_DIR = path.join(__dirname, '..', 'docs', 'screenshots');

async function updateScreenshots() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await sleep(800);

  // Accept cookies
  try {
    const acceptBtn = await page.$('button.btn-accept');
    if (acceptBtn) await acceptBtn.click();
  } catch (e) {}

  // Login as Aisha
  await page.type('#login-email', 'aisha.kapoor@example.com', { delay: 20 });
  await page.type('#login-password', 'member123', { delay: 20 });
  await page.click('#btn-submit-login');
  await sleep(3000);

  // 1. Dashboard with updated credits
  console.log('Capturing updated dashboard with credits...');
  await page.evaluate(() => { window.location.hash = '#/portal/dashboard'; });
  await sleep(1500);
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-member-dashboard.png') });
  console.log('Captured 04-member-dashboard.png');

  // 2. Booking page - select tomorrow
  console.log('Navigating to #/portal/book...');
  await page.evaluate(() => { window.location.hash = '#/portal/book'; });
  await sleep(1500);

  // Click second day button (tomorrow)
  const dayPills = await page.$$('.calendar-strip-day');
  if (dayPills.length > 1) {
    await dayPills[1].click();
    await sleep(1200);
  }

  await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-member-book.png') });
  console.log('Captured updated 06-member-book.png with reserve buttons');

  // 3. Open booking modal
  const bookButtons = await page.$$('.class-card button.btn-primary');
  console.log(`Found ${bookButtons.length} active booking buttons`);
  if (bookButtons.length > 0) {
    // Find Barre button or first button
    await bookButtons[1]?.click() || await bookButtons[0].click();
    await sleep(1000);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '07-booking-modal.png') });
    console.log('Captured 07-booking-modal.png');
    // close modal
    const closeBtn = await page.$('.modal-close, button[aria-label="Close modal"], .btn-outline');
    if (closeBtn) await closeBtn.click();
    await sleep(500);
  }

  await browser.close();
  console.log('Done updating refined screenshots.');
}

updateScreenshots().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
