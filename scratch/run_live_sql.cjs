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

  page.on('request', req => {
    if (req.method() === 'POST' && req.url().includes('/query')) {
      const d = req.postData();
      if (d && (d.includes('enforce_class_capacity') || d.includes('enforce_booking') || d.includes('SELECT') || d.includes('CREATE') || d.includes('DROP'))) {
        console.log('[USER SQL DISPATCHED]:', d.slice(0, 120) + '...');
      }
    }
  });

  page.on('response', async res => {
    if (res.request().method() === 'POST' && res.url().includes('/platform/pg-meta/ylabdaulbstmhvyzipyd/query?key=')) {
      try {
        const text = await res.text();
        if (res.status() >= 400) {
          responseError = text;
          console.error(`[PG ERROR ${res.status()}]:`, text);
        } else {
          capturedResponse = text;
          console.log(`[PG RESPONSE ${res.status()}]:`, text.slice(0, 300));
        }
      } catch (_) {}
    }
  });

  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await sleep(3000);

  // Set SQL in Monaco editor and focus
  await page.evaluate((sqlContent) => {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors.length > 0) {
        editors[0].setValue(sqlContent);
        editors[0].focus();
      }
    }
  }, sql);

  await sleep(1000);

  // Trigger Run via Meta+Enter (Mac)
  await page.keyboard.down('Meta');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Meta');

  // Trigger Run via Control+Enter (Linux/Windows)
  await sleep(1000);
  await page.keyboard.down('Control');
  await page.keyboard.press('Enter');
  await page.keyboard.up('Control');

  // Also click the green "Run" button in the toolbar if present
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const runBtn = btns.find(b => b.textContent && b.textContent.trim().startsWith('Run'));
    if (runBtn) {
      runBtn.click();
    }
  });

  // Wait 7 seconds for execution
  await sleep(7000);

  await browser.close();

  if (responseError) {
    throw new Error(`SQL Execution Error: ${responseError}`);
  }

  return capturedResponse;
}

if (require.main === module) {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node run_live_sql.cjs "<sql>" or path/to/file.sql');
    process.exit(1);
  }

  let sql = arg;
  if (fs.existsSync(arg)) {
    sql = fs.readFileSync(arg, 'utf8');
  }

  console.log('Executing SQL against LIVE Supabase database (ylabdaulbstmhvyzipyd)...');
  executeSql(sql)
    .then(res => {
      console.log('SQL Execution SUCCESS!');
      process.exit(0);
    })
    .catch(err => {
      console.error('FATAL SQL ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = { executeSql };
