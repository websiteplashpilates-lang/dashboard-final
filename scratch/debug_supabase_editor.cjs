const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function debugEditor() {
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    userDataDir: '/tmp/chrome_test_prof41',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('https://supabase.com/dashboard/project/ylabdaulbstmhvyzipyd/sql/new', {
    waitUntil: 'networkidle2',
    timeout: 45000
  });

  await new Promise(r => setTimeout(r, 4000));
  await page.screenshot({ path: 'scratch/supabase_editor_state.png' });

  const editorsInfo = await page.evaluate(() => {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      return {
        count: editors.length,
        val: editors[0] ? editors[0].getValue() : 'no editor 0'
      };
    }
    return { count: 0, val: 'no monaco' };
  });

  console.log('Editors info:', editorsInfo);

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()).filter(t => t.length > 0);
  });
  console.log('Buttons on page:', buttons.slice(0, 20));

  await browser.close();
}

debugEditor().catch(console.error);
