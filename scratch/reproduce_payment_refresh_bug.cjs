const puppeteer = require('puppeteer-core');

async function testBrowserRefresh() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  page.on('console', msg => console.log('[BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('[BROWSER ERROR]', err.message));

  console.log('1. Navigating to login...');
  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });

  console.log('2. Logging in as Aisha...');
  const loginResult = await page.evaluate(async () => {
    // Fill inputs
    document.querySelector('#login-email').value = 'aisha.kapoor@example.com';
    document.querySelector('#login-password').value = 'member123';
    // Dispatch submit on form
    const form = document.querySelector('form.auth-login-form');
    if (form) {
      form.requestSubmit();
      return { foundForm: true };
    }
    return { foundForm: false, forms: document.querySelectorAll('form').length };
  });
  console.log('Form submit triggered:', loginResult);
  await new Promise(r => setTimeout(r, 3000));

  console.log('Current URL after submit:', page.url());

  // Check auth session in browser
  const sessionInfo = await page.evaluate(async () => {
    const sb = window.supabaseClient || (window.supabase && window.supabase.createClient ? true : false);
    const session = await (window.__sb?.auth?.getSession?.() || Promise.resolve(null));
    const authSession = localStorage.getItem('plash_auth_session_v1');
    const allKeys = Object.keys(localStorage);
    return { sb, session, authSession, allKeys };
  });
  console.log('Session info after login:', sessionInfo);

  console.log('4. Navigating to #/portal/payments...');
  await page.goto('http://localhost:3333/#/portal/payments', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Check table rows in payment page
  let tableRows = await page.evaluate(() => {
    const rows = document.querySelectorAll('.data-table tbody tr');
    const emptyState = document.querySelector('.empty-state-title');
    return {
      rowCount: rows.length,
      emptyTitle: emptyState ? emptyState.textContent : null,
      html: document.querySelector('.card')?.innerText
    };
  });
  console.log('Payment page before refresh:', tableRows);

  console.log('5. Hard refreshing page...');
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  tableRows = await page.evaluate(() => {
    const rows = document.querySelectorAll('.data-table tbody tr');
    const emptyState = document.querySelector('.empty-state-title');
    return {
      rowCount: rows.length,
      emptyTitle: emptyState ? emptyState.textContent : null,
      html: document.querySelector('.card')?.innerText
    };
  });
  console.log('Payment page AFTER refresh:', tableRows);

  await browser.close();
}

testBrowserRefresh().catch(console.error);
