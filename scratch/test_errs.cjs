const puppeteer = require('puppeteer-core');
async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('[ERROR]:', msg.text());
    }
  });

  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#login-email');
  await page.type('#login-email', 'aisha.kapoor@example.com');
  await page.type('#login-password', 'member123');
  await page.click('button[type="submit"]');
  await new Promise(r => setTimeout(r, 2000));

  await page.goto('http://localhost:3333/#/portal/profile', { waitUntil: 'networkidle0' });
  await page.waitForSelector('#p-name');
  await new Promise(r => setTimeout(r, 2000));

  await page.goto('http://localhost:3333/#/portal/payments', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await page.goto('http://localhost:3333/#/portal/cart', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  await browser.close();
}
run().catch(console.error);
