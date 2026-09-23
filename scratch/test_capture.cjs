const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

async function test() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err));

  await page.goto('http://localhost:3333/#/login', { waitUntil: 'networkidle0' });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(1000);

  const title = await page.title();
  console.log('Page Title:', title);

  const shotPath = path.join(__dirname, 'test_shot.png');
  await page.screenshot({ path: shotPath });
  console.log('Saved shot to:', shotPath, 'size:', fs.statSync(shotPath).size);

  await browser.close();
}

test().catch(err => {
  console.error('Error running test:', err);
  process.exit(1);
});
