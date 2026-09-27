const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');

if (!fs.existsSync(PUBLIC)) {
  fs.mkdirSync(PUBLIC, { recursive: true });
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(child => {
      copyRecursive(path.join(src, child), path.join(dest, child));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

['index.html', 'site.webmanifest', 'favicon.ico', 'css', 'js', 'assets'].forEach(item => {
  const src = path.join(ROOT, item);
  const dest = path.join(PUBLIC, item);
  if (fs.existsSync(src)) {
    copyRecursive(src, dest);
  }
});

// Sync embedded serverless HTML string for Vercel SSR
const idxHtmlPath = path.join(ROOT, 'index.html');
const embeddedPath = path.join(ROOT, 'email-templates', 'index-html-string.cjs');
if (fs.existsSync(idxHtmlPath)) {
  const htmlContent = fs.readFileSync(idxHtmlPath, 'utf8');
  fs.writeFileSync(embeddedPath, `module.exports = ${JSON.stringify(htmlContent)};\n`, 'utf8');
  console.log('[sync-public] Successfully updated email-templates/index-html-string.cjs');
}

console.log('[sync-public] Successfully synced static assets to public/');
