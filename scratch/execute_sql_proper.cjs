const puppeteer = require('puppeteer-core');
const fs = require('fs');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function executeSql(sql) {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  let capturedResponse = null;
  let responseError = null;

  page.on('response', async res => {
    if (res.request().method() === 'POST' && res.url().includes('/platform/pg-meta/ylabdaulbstmhvyzipyd/query?key=')) {
      try {
        const text = await res.text();
        if (res.status() >= 400) {
          responseError = text;
          console.error(`[PG ERROR ${res.status()}]:`, text);
        } else {
          capturedResponse = text;
          console.log(`[PG RESPONSE ${res.status()}]:`, text.slice(0, 500));
        }
      } catch (_) {}
    }
  });

  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await sleep(4000);

  // Set SQL in Monaco editor
  await page.evaluate((sqlContent) => {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors.length > 0) {
        editors[0].setValue(sqlContent);
        editors[0].focus();
      }
    }
  }, sql);

  await sleep(1500);

  // Click the Run button
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent && b.textContent.includes('Run'));
    if (runBtn) {
      runBtn.click();
      return true;
    }
    return false;
  });
  console.log('Run button clicked:', clicked);

  // Wait 6 seconds for execution
  await sleep(6000);

  await browser.close();

  if (responseError) {
    throw new Error(`SQL Execution Error: ${responseError}`);
  }

  return capturedResponse;
}

if (require.main === module) {
  const sql = fs.readFileSync('scratch/update_profile_insert_rls.sql', 'utf8');
  console.log('Executing SQL against LIVE Supabase database:\n', sql);
  executeSql(sql)
    .then(res => {
      console.log('SQL Execution SUCCESS! Result:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('FATAL SQL ERROR:', err.message);
      process.exit(1);
    });
}
