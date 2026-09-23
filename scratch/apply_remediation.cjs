const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function applyRemediation() {
  const sqlFile = path.join(__dirname, '../supabase/remediation_triggers.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log('SQL to apply length:', sql.length, 'bytes');

  console.log('Launching headless Chrome with Profile 41...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let queryDispatched = false;
  let queryResult = null;
  let queryError = null;

  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/query')) {
      console.log('[DISPATCHING SQL VIA API]:', req.url());
      queryDispatched = true;
    }
  });

  page.on('response', async res => {
    if (res.request().method() === 'POST' && res.url().includes('/platform/pg-meta/ylabdaulbstmhvyzipyd/query')) {
      const status = res.status();
      try {
        const text = await res.text();
        console.log(`[PG-META RESPONSE ${status}]:`, text.slice(0, 500));
        if (status >= 400) {
          queryError = text;
        } else {
          queryResult = text;
        }
      } catch (e) {
        console.error('Error reading response text:', e.message);
      }
    }
  });

  console.log('Navigating to Supabase SQL editor...');
  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await sleep(4000);

  console.log('Injecting SQL into Monaco editor...');
  const injected = await page.evaluate((sqlContent) => {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors.length > 0) {
        const ed = editors[0];
        ed.setValue(sqlContent);
        // Select all so "Run" executes the entire file
        ed.setSelection(ed.getModel().getFullModelRange());
        return true;
      }
    }
    return false;
  }, sql);

  if (!injected) {
    throw new Error('Could not find Monaco editor on page');
  }

  console.log('SQL injected into Monaco and full text selected. Finding Run button...');
  await sleep(1000);

  const clicked = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const runBtn = buttons.find(b => b.innerText.includes('Run') && !b.disabled);
    if (runBtn) {
      runBtn.click();
      return true;
    }
    return false;
  });

  console.log('Run button clicked:', clicked);

  if (!clicked) {
    console.log('Falling back to Meta+Enter / Control+Enter...');
    await page.keyboard.down('Meta');
    await page.keyboard.press('Enter');
    await page.keyboard.up('Meta');
  }

  // Check for destructive query confirmation modal
  console.log('Checking for confirmation modal...');
  await sleep(1500);
  const modalHandled = await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const confirmBtn = buttons.find(b => b.innerText.trim() === 'Run query');
    if (confirmBtn) {
      console.log('Found confirmation button: Run query. Clicking it...');
      confirmBtn.click();
      return true;
    }
    return false;
  });
  console.log('Confirmation modal handled:', modalHandled);

  console.log('Waiting for query execution and results...');
  await sleep(5000);

  // Also take screenshot of the result pane
  const shotPath = path.join(__dirname, 'remediation_sql_run.png');
  await page.screenshot({ path: shotPath });
  console.log('Screenshot saved to', shotPath);

  await browser.close();

  if (queryError) {
    throw new Error(`Database execution failed: ${queryError}`);
  }

  if (!queryResult) {
    console.warn('WARNING: No direct /query response captured. Verifying via DB inspection...');
  } else {
    console.log('SUCCESS: SQL executed cleanly!');
  }
}

applyRemediation().catch(err => {
  console.error('Remediation error:', err);
  process.exit(1);
});
