const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function runSql() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('response', async res => {
    if (res.request().method() === 'POST' && res.url().includes('/platform/pg-meta/ylabdaulbstmhvyzipyd/query')) {
      try {
        const text = await res.text();
        console.log(`[PG RESPONSE ${res.status()}]:`, text.slice(0, 300));
      } catch (_) {}
    }
  });

  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', { waitUntil: 'networkidle2', timeout: 45000 });
  await new Promise(r => setTimeout(r, 4000));

  const targetSql = `DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK ((id = auth.uid()) OR (auth.role() = 'service_role'::text));`;

  await page.evaluate((sql) => {
    if (window.monaco && window.monaco.editor) {
      const ed = window.monaco.editor.getEditors()[0];
      if (ed) {
        ed.setValue(sql);
        ed.focus();
      }
    }
  }, targetSql);

  await new Promise(r => setTimeout(r, 1000));

  console.log('Clicking button[data-testid="sql-run-button"]...');
  await page.click('button[data-testid="sql-run-button"]');

  await new Promise(r => setTimeout(r, 6000));
  await browser.close();
}

runSql().catch(console.error);
