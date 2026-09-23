const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testBrowserAuth() {
  console.log('============================================================');
  console.log('  LIVE BROWSER AUTHENTICATION & SECURITY VERIFICATION');
  console.log('============================================================\n');

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Invalid Login Test
  console.log('--- STEP 1: INVALID LOGIN TEST ---');
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 5000 });
  await page.type('#login-email', 'aisha.kapoor@example.com');
  await page.type('#login-password', 'wrongpassword999!');
  await page.click('button[type="submit"]');
  
  // Wait for error toast / message
  await sleep(1500);
  const errorText = await page.evaluate(() => {
    const toast = document.querySelector('.toast, .alert, .error-message, .toast-error');
    return toast ? toast.innerText : (document.body.innerText.includes('Invalid') ? 'Invalid credentials detected in page' : 'No visible error toast');
  });
  console.log('Invalid login result:', errorText);

  // 2. Valid Member Login
  console.log('\n--- STEP 2: VALID MEMBER LOGIN ---');
  await page.evaluate(() => {
    document.querySelector('#login-email').value = '';
    document.querySelector('#login-password').value = '';
  });
  await page.type('#login-email', 'aisha.kapoor@example.com');
  await page.type('#login-password', 'member123');
  await page.click('button[type="submit"]');

  await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => {});
  await sleep(2000);

  const currentUrl = page.url();
  console.log('Post-login URL:', currentUrl);

  // 3. Inspect Browser Session, Access Token, JWT claims, Profile
  console.log('\n--- STEP 3: SESSION & JWT INSPECTION ---');
  const sessionInfo = await page.evaluate(() => {
    // Check localStorage & sessionStorage for supabase token or app session
    let sbSession = null;
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.includes('sb-') || k.includes('supabase') || k.includes('auth')) {
        try {
          sbSession = { key: k, data: JSON.parse(localStorage.getItem(k)) };
        } catch (_) {}
      }
    }
    const appUser = window.__PLASH_AUTH_USER__ || null;
    return { sbSession, appUser, location: window.location.hash };
  });

  console.log('Session storage found:', sessionInfo.sbSession ? sessionInfo.sbSession.key : 'No direct sb- key in localStorage');
  
  // Extract token details directly from Supabase auth state in page
  const tokenAudit = await page.evaluate(async () => {
    // Look for Supabase client or extract from local/session storage
    let token = null;
    for (let k in localStorage) {
      if (localStorage.getItem(k) && localStorage.getItem(k).includes('access_token')) {
        try {
          const parsed = JSON.parse(localStorage.getItem(k));
          token = parsed.access_token || parsed?.currentSession?.access_token;
        } catch(e) {}
      }
    }
    if (!token) {
      for (let k in sessionStorage) {
        if (sessionStorage.getItem(k) && sessionStorage.getItem(k).includes('access_token')) {
          try {
            const parsed = JSON.parse(sessionStorage.getItem(k));
            token = parsed.access_token;
          } catch(e) {}
        }
      }
    }
    if (token) {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1]));
      return {
        found: true,
        jwt_sub: payload.sub,
        jwt_email: payload.email,
        jwt_role: payload.role,
        jwt_aud: payload.aud,
        token_prefix: token.slice(0, 15) + '...'
      };
    }
    return { found: false };
  });
  console.log('JWT Token Audit in Browser:', tokenAudit);

  // 4. Test Protected Route Access (Admin Portal as Member)
  console.log('\n--- STEP 4: PROTECTED ROUTE TEST (MEMBER ACCESSING ADMIN) ---');
  await page.goto('http://localhost:3333/#/admin/overview', { waitUntil: 'networkidle0' });
  await sleep(1500);
  const routeBlockedUrl = page.url();
  const routePageText = await page.evaluate(() => document.body.innerText);
  const is403 = routeBlockedUrl.includes('403') || routePageText.includes('Access Denied') || routePageText.includes('Unauthorized') || routePageText.includes('403');
  console.log('Navigated to #/admin/overview. Current URL:', routeBlockedUrl, '| Access Denied displayed:', is403);

  // 5. Test Persistence on Refresh
  console.log('\n--- STEP 5: PERSISTENCE ON REFRESH ---');
  await page.goto('http://localhost:3333/#/portal/dashboard', { waitUntil: 'networkidle0' });
  await sleep(1000);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  const postRefreshUrl = page.url();
  const welcomeText = await page.evaluate(() => {
    const el = document.querySelector('.dashboard-welcome-name');
    return el ? el.innerText : document.body.innerText;
  });
  console.log('Post-refresh URL:', postRefreshUrl);
  console.log('Welcome text post-refresh:', welcomeText.slice(0, 80));

  // 6. Test Logout
  console.log('\n--- STEP 6: LOGOUT TEST ---');
  const logoutClicked = await page.evaluate(() => {
    const logoutBtn = document.querySelector('.sidebar-action-btn.logout') || 
                      document.querySelector('button.logout') ||
                      Array.from(document.querySelectorAll('button')).find(b => b.title && b.title.toLowerCase().includes('logout'));
    if (logoutBtn) {
      logoutBtn.click();
      return true;
    }
    return false;
  });
  console.log('Logout clicked via DOM:', logoutClicked);
  await sleep(2000);
  console.log('Post-logout URL:', page.url());

  // Verify protected route redirected after logout
  await page.goto('http://localhost:3333/#/portal/dashboard', { waitUntil: 'networkidle0' });
  await sleep(1500);
  console.log('Attempting to access #/portal/dashboard after logout:', page.url());

  // 7. Login again
  console.log('\n--- STEP 7: RE-LOGIN TEST ---');
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email', { timeout: 5000 });
  await page.type('#login-email', 'aisha.kapoor@example.com');
  await page.type('#login-password', 'member123');
  await page.click('button[type="submit"]');
  await sleep(2000);
  console.log('Re-login destination URL:', page.url());

  await browser.close();
  console.log('\n============================================================');
  console.log('  BROWSER AUTHENTICATION AUDIT COMPLETED');
  console.log('============================================================');
}

testBrowserAuth().catch(err => {
  console.error('BROWSER AUTH AUDIT ERROR:', err);
  process.exit(1);
});
