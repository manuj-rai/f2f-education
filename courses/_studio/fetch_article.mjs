// Saves Fibre2Fashion articles as JSON for course writing (fibre2fashion.com sits behind an AWS WAF JavaScript
// challenge, so plain curl gets an empty 202; a real headless Chrome passes it).
//   node courses/_studio/fetch_article.mjs <article-url> [<article-url> ...]
//   -> articles/<id>-<slug>.json  { url, title, description, ogImage, author, published, images, fullText, html }
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = path.join(ROOT, 'articles');
const urls = process.argv.slice(2);
if (!urls.length) { console.error('usage: node fetch_article.mjs <url> [...]'); process.exit(1); }

function findChrome() {
  const cands = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ];
  const pw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (fs.existsSync(pw)) for (const d of fs.readdirSync(pw).filter(d => d.startsWith('chromium-')).sort().reverse())
    cands.push(path.join(pw, d, 'chrome-win64', 'chrome.exe'));
  return cands.find(p => fs.existsSync(p));
}

const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'en-GB' });
const page = await ctx.newPage();
for (const url of urls) {
  await page.goto(url, { waitUntil: 'commit', timeout: 60000 });
  // the WAF page reloads itself once its token is set; wait for the real article
  await page.waitForFunction(() => document.querySelector('meta[property="og:title"]') && document.body.innerText.length > 2000, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const data = await page.evaluate(() => {
    const meta = n => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content || null;
    const body = document.querySelector('.article-detail, .articledetail, #articleDetail, .article-content, article') || document.body;
    const imgs = [...body.querySelectorAll('img')].map(i => ({ src: i.currentSrc || i.src, alt: i.alt, w: i.naturalWidth }))
      .filter(i => i.src && i.w >= 200);
    return {
      url: location.href, title: meta('og:title') || document.title, description: meta('description'),
      ogImage: meta('og:image'), author: meta('author'), published: meta('article:published_time'),
      bodySelector: body === document.body ? 'body' : (body.className || body.id || body.tagName),
      images: imgs, fullText: body.innerText, html: body.innerHTML,
    };
  });
  const m = url.match(/industry-article\/(?:prime-articles\/)?(\d+)\/([^/?#]+)/);
  const file = path.join(OUT, `${m ? m[1] + '-' + m[2].slice(0, 60) : Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log('saved', path.relative(ROOT, file), data.bodySelector, data.fullText.length, 'chars');
}
await browser.close();
