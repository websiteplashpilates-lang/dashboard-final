const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function runDirect() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('request', req => {
    if (req.method() === 'POST') {
      console.log('[POST URL]:', req.url());
      const postData = req.postData();
      if (postData) {
        console.log('[POST DATA]:', postData.slice(0, 150));
      }
    }
  });

  page.on('response', async res => {
    if (res.request().method() === 'POST') {
      try {
        const text = await res.text();
        console.log(`[RES ${res.status()} from ${res.url().slice(0, 60)}]:`, text.slice(0, 200));
      } catch (_) {}
    }
  });

  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await new Promise(r => setTimeout(r, 4000));

  const targetSql = `DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (id = auth.uid() OR auth.role() = 'service_role');`;

  // Type into Monaco editor or set value
  await page.evaluate((sql) => {
    if (window.monaco && window.monaco.editor) {
      const ed = window.monaco.editor.getEditors()[0];
      if (ed) {
        ed.setValue(sql);
        ed.focus();
        // Select all text in editor so "Run" runs the whole snippet
        const model = ed.getModel();
        ed.setSelection(model.getFullModelRange());
      }
    }
  }, targetSql);

  await new Promise(r => setTimeout(r, 1000));

  // Press Meta+Enter
  console.log('Sending Meta+Enter...');
  await page.keyboard.down('Meta');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Meta');

  await new Promise(r => setTimeout(r, 1000));

  // Also click Run button
  console.log('Finding and clicking Run button...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent && b.textContent.includes('Run'));
    if (runBtn) {
      runBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  });

  await new Promise(r => setTimeout(r, 6000));

  await browser.close();
}

runDirect().catch(console.error);
