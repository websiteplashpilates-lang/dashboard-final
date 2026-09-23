const puppeteer = require('puppeteer-core');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function run() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let capturedResponse = null;

  page.on('response', async res => {
    if (res.request().method() === 'POST' && res.url().includes('/platform/pg-meta/ylabdaulbstmhvyzipyd/query?key=')) {
      try {
        const text = await res.text();
        console.log(`[PG RESPONSE ${res.status()}]:`, text.slice(0, 300));
        capturedResponse = text;
      } catch (_) {}
    }
  });

  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await sleep(4000);

  const targetSql = `DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK ((id = auth.uid()) OR (auth.role() = 'service_role'::text));`;

  await page.evaluate((sql) => {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors.length > 0) {
        editors[0].setValue(sql);
        editors[0].focus();
      }
    }
  }, targetSql);

  await sleep(1000);

  // Click initial Run button
  console.log('Clicking Run button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent && b.textContent.trim().startsWith('Run'));
    if (runBtn) {
      runBtn.click();
    }
  });

  await sleep(1500);

  // Check if destructive warning modal appeared with "Run query"
  console.log('Checking for confirmation modal...');
  const clickedModal = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    // Look for button that says "Run query"
    const confirmBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Run query');
    if (confirmBtn) {
      confirmBtn.click();
      return true;
    }
    return false;
  });
  console.log('Modal confirmation button clicked:', clickedModal);

  await sleep(5000);
  await page.screenshot({ path: 'scratch/after_confirm_run.png' });

  await browser.close();
  console.log('Finished. Captured response:', capturedResponse);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
