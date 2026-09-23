const puppeteer = require('puppeteer-core');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function testSqlRunner() {
  console.log('Launching headless Chrome with copied Profile 41...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));

  // Listen to network requests to see what Supabase API is called when queries run
  page.on('response', async res => {
    const url = res.url();
    if (url.includes('query') || url.includes('sql') || url.includes('run')) {
      console.log(`[API RESPONSE] ${res.status()} ${url}`);
      try {
        const text = await res.text();
        console.log(`[API BODY] ${text.slice(0, 300)}`);
      } catch (_) {}
    }
  });

  console.log('Navigating to SQL Editor new query page...');
  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  console.log('Page loaded:', page.url(), '| Title:', await page.title());
  await sleep(3000);

  // Look for Run button or Monaco editor
  const elements = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText.trim(),
      id: b.id,
      className: b.className
    }));
    return {
      buttons: buttons.filter(b => b.text.toLowerCase().includes('run') || b.text.toLowerCase().includes('sql')),
      hasMonaco: !!document.querySelector('.monaco-editor'),
      title: document.title
    };
  });

  console.log('Detected UI elements:', JSON.stringify(elements, null, 2));

  // Extract auth tokens from page context if present
  const tokens = await page.evaluate(() => {
    const storage = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.includes('token') || k.includes('auth') || k.includes('supabase')) {
        storage[k] = localStorage.getItem(k);
      }
    }
    return storage;
  });
  console.log('Storage keys related to auth/tokens:', Object.keys(tokens));

  await browser.close();
}

testSqlRunner().catch(err => {
  console.error('SQL RUNNER ERROR:', err);
  process.exit(1);
});
