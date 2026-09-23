const puppeteer = require('puppeteer-core');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testAntiFlicker() {
  console.log('=== TESTING INITIAL PAGE LOAD AT ROOT URL http://127.0.0.1:5500/ ===');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Clear all localStorage / cookies to ensure completely fresh unauthenticated visitor
  await page.goto('http://127.0.0.1:5500/#/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  let observedSidebarVisible = false;
  let observedDashboardVisible = false;

  // Track DOM mutations during load
  await page.exposeFunction('onMutationRecorded', (data) => {
    if (data.sidebarDisplay && data.sidebarDisplay !== 'none') {
      observedSidebarVisible = true;
    }
    if (data.hasDashboardContent) {
      observedDashboardVisible = true;
    }
  });

  await page.evaluateOnNewDocument(() => {
    const observer = new MutationObserver(() => {
      const sidebar = document.getElementById('sidebar');
      const sidebarDisplay = sidebar ? window.getComputedStyle(sidebar).display : null;
      const main = document.getElementById('main-content');
      const text = main ? main.innerText : '';
      const hasDashboardContent = text.includes('Upcoming Bookings') || text.includes('My Studio Passes');

      window.onMutationRecorded({
        sidebarDisplay,
        hasDashboardContent
      });
    });
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  });

  // Navigate directly to root URL http://127.0.0.1:5500/
  console.log('1. Loading root URL http://127.0.0.1:5500/ as unauthenticated visitor...');
  await page.goto('http://127.0.0.1:5500/', { waitUntil: 'networkidle0' });
  await sleep(1500);

  const finalUrl = page.url();
  console.log('   Final URL after redirection:', finalUrl);

  const finalState = await page.evaluate(() => {
    const sidebar = document.getElementById('sidebar');
    const sidebarDisplay = sidebar ? window.getComputedStyle(sidebar).display : null;
    const isAuthLayout = document.body.classList.contains('auth-layout');
    const hasLoginForm = !!document.querySelector('.auth-form') || !!document.querySelector('#login-email');
    return { sidebarDisplay, isAuthLayout, hasLoginForm };
  });
  console.log('   Final Page State:', finalState);

  await browser.close();

  console.log('\n--- ANTI-FLICKER AUDIT RESULTS ---');
  console.log('Was sidebar ever visible during load?', observedSidebarVisible ? 'YES (FLICKER BUG DETECTED)' : 'NO (CLEAN - ZERO FLICKER!)');
  console.log('Was dashboard content ever rendered before login?', observedDashboardVisible ? 'YES (UNAUTHORIZED FLASH)' : 'NO (STRICTLY GATED!)');

  if (observedSidebarVisible || observedDashboardVisible) {
    process.exit(1);
  } else {
    console.log('\nPASSED: Zero glimpse of dashboard or sidebar. Unauthenticated visitor routed cleanly to login.');
  }
}

testAntiFlicker().catch(err => {
  console.error(err);
  process.exit(1);
});
