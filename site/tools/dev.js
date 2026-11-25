// npm run dev: work on the site locally and see every change at once. Nothing is published.
//
// Opens the live site (https://f2fedtech.learnworlds.com) in Chrome with ALL local code swapped in, on every page
// you visit: the site-wide code (site/custom-code/: header, footer, search, course pages, profile, account, 404 …),
// LearnWorlds' built-in pages (/account, /inbox …) with builtin.css, and every page in site/pages/ at its address,
// including pages that aren't published yet. Saving any of those files reloads the window.
//
// Sign in with the header's "Log in" to see the signed-in pages (My learning, Profile, Account). The window keeps its
// own sign-in between runs (%LOCALAPPDATA%\f2f-education\dev-profile); use a learner account, not the admin.
//
// Usage: npm run dev [-- <page name or /address>] [--phone] [--signed-out] [--shot=<file.png>]
//   npm run dev                  opens the home page
//   npm run dev -- courses       opens site/pages/courses at its address (/courses)
//   npm run dev -- /account      opens any address
//   --phone       phone-sized window (390 x 844, touch)
//   --width=1260  page this many pixels wide (e.g. to check a demo laptop's screen); works with --shot too
//   --signed-out  a fresh window with no sign-in (the visitor view), forgotten when it closes
//   --shot=x.png  no window: save one full-page screenshot of the visitor view and exit
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const pw = require('playwright-core');
const { ROOT, build, stripPublished, listPages } = require('./lib');

const SITE = 'https://f2fedtech.learnworlds.com';
const CUSTOM = path.join(ROOT, 'site', 'custom-code');
const PAGES = path.join(ROOT, 'site', 'pages');
// (F2F_DEV_PROFILE and F2F_DEV_HEADLESS are for testing the tool: another profile folder, no visible window.)
const PROFILE = process.env.F2F_DEV_PROFILE || path.join(process.env.LOCALAPPDATA || os.homedir(), 'f2f-education', 'dev-profile');

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('--'));
const phone = args.includes('--phone');
const shotArg = args.find(a => a.startsWith('--shot='));
const shot = shotArg ? shotArg.slice(7) : null;
const widthArg = args.find(a => a.startsWith('--width='));
const width = widthArg ? parseInt(widthArg.slice(8), 10) : 0;
if (widthArg && !(width >= 320 && width <= 3840)) { console.error('--width needs a number of pixels, e.g. --width=1260'); process.exit(1); }
const signedOut = args.includes('--signed-out') || !!shot;
if (args.includes('--member')) console.log('Note: --member is no longer needed. Sign in with "Log in" in the window to see the signed-in pages.');

/* ---------- Local code ---------- */
const readCustom = f => fs.readFileSync(path.join(CUSTOM, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '');
function siteCode() {
  const css = readCustom('style.css');
  return { head: readCustom('head.html'), body: readCustom('body.html'), css, builtin: css + '\n' + readCustom('builtin.css') };
}
// Every local page by its address. A page that doesn't build (e.g. a missing picture) is reported and left live.
function localPages() {
  const byPath = {};
  for (const name of listPages()) {
    try { const b = build(name, { mode: 'preview' }); byPath[b.config.path] = b; }
    catch (e) { console.log('  ' + name + ': not swapped in (' + e.message + ')'); }
  }
  return byPath;
}

/* ---------- Swapping it into the live page ----------
   LearnWorlds puts custom code into the page verbatim, so each block is found by its banner comment. */
const HEAD_START = '<!--\n  F2F Education · Site custom code · HEAD';
const BODY_START = '<!--\n  F2F Education · Site custom code · BODY';
// From a banner to its end marker (new code) or, for older live code without one, to its last </script>.
function replaceBlock(html, start, endMarker, local) {
  const i = html.indexOf(start);
  if (i < 0) return { html, done: false };
  let end = html.indexOf(endMarker, i);
  if (end >= 0) end += endMarker.length;
  else {
    const scripts = (local.match(/<\/script>/g) || []).length;
    end = i;
    for (let n = 0; n < scripts; n++) { const j = html.indexOf('</script>', end); if (j < 0) return { html, done: false }; end = j + 9; }
  }
  return { html: html.slice(0, i) + local + html.slice(end), done: true };
}
const CSS_BLOCK = /\/\* =+\n {3}F2F EDUCATION · SITE-WIDE STYLES[\s\S]*?(?=<\/style>)/g;

// Both versions of a local page go in; the page picks one the way the site's header does: LearnWorlds' hidden
// header has a "Sign in" link only for visitors.
// (Every "<" in the code is escaped, so a "</script>" inside it can't end this script early.)
const jsString = s => JSON.stringify(s).replace(/</g, '\\u003c');
function pageLoader(b) {
  return '<script>(function () {\n' +
    '  var visitor = !!document.querySelector(\'section.lw-topbar [data-interactive-link-type="openformslink"][data-interactive-link-var1="signin"]\');\n' +
    '  var code = visitor ? ' + jsString(b.bodyVisitor) + ' : ' + jsString(b.bodyMember) + ';\n' +
    '  var s = document.currentScript, r = document.createRange();\n' +
    '  r.selectNodeContents(document.body);\n' +
    '  s.parentNode.insertBefore(r.createContextualFragment(code), s);\n' +
    '})();</script>\n';
}

const BADGE = '<div id="f2f-dev-badge" style="position:fixed;left:12px;bottom:12px;z-index:2147483647;max-width:calc(100vw - 24px);' +
  'background:#0d1b3e;color:#fff;font:600 12px/1.4 Inter,system-ui,sans-serif;padding:8px 12px;border-radius:6px;opacity:.9;pointer-events:none">' +
  'LOCAL PREVIEW · not published · <span style="font-weight:400">npm run push to publish</span></div>';

function localise(html, urlPath, code, pages) {
  const swapped = [];
  let r = replaceBlock(html, HEAD_START, '<!-- /F2F Education · Site custom code · HEAD -->', code.head);
  html = r.html; if (r.done) swapped.push('head');
  r = replaceBlock(html, BODY_START, '<!-- /F2F Education · Site custom code · BODY -->', code.body);
  html = r.html; if (r.done) swapped.push('body');
  // Site styles: the "Dynamic (css)" slot, or on built-in pages the built-in pages slot (site styles + builtin.css)
  html = html.replace(CSS_BLOCK, block => { swapped.push(/F2F EDUCATION · BUILT-IN PAGES/.test(block) ? 'built-in css' : 'css'); return (/F2F EDUCATION · BUILT-IN PAGES/.test(block) ? code.builtin : code.css) + '\n'; });
  const b = pages[urlPath.replace(/\/+$/, '') || '/'];
  if (b) {
    html = stripPublished(html, b.tag);
    html = html.replace('</head>', () => '<style>\n' + b.style + '</style>\n</head>');
    const end = html.lastIndexOf('</body>');
    html = html.slice(0, end) + pageLoader(b) + html.slice(end);
    swapped.push('page ' + b.name);
  }
  if (process.env.F2F_DEV_DEBUG) console.log('  ' + urlPath + ': ' + (swapped.join(', ') || 'nothing to swap'));
  if (!swapped.length) return null; // not a site page (e.g. the admin): leave it alone
  if (!shot) { const end = html.lastIndexOf('</body>'); html = html.slice(0, end) + BADGE + html.slice(end); }
  return html;
}

/* ---------- The window ---------- */
function startPath() {
  if (!target) return '/';
  // An address: "/account" or "course/<slug>". (Git Bash turns "/x" into "C:/Program Files/Git/x"; undo that.)
  const addr = target.replace(/\\/g, '/').replace(/^[A-Za-z]:\/Program Files\/Git(?=\/)/i, '');
  if (addr.includes('/')) return '/' + addr.replace(/^\/+/, '');
  const p = path.join(PAGES, target, 'page.json');
  if (!fs.existsSync(p)) { console.error('No page "' + target + '" in site/pages/. Give a page name (' + listPages().join(', ') + ') or an address like /account.'); process.exit(1); }
  return JSON.parse(fs.readFileSync(p, 'utf8')).path;
}

(async () => {
  const startUrl = SITE + startPath();
  let code = siteCode(), pages = localPages();
  const view = phone ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }
    : width ? { viewport: { width, height: 800 } }
    : (shot ? { viewport: { width: 1366, height: 900 } } : { viewport: null });
  const launch = { channel: 'chrome', headless: !!shot || !!process.env.F2F_DEV_HEADLESS, args: shot || phone || width ? [] : ['--start-maximized'] };
  let browser = null, ctx;
  if (signedOut) { browser = await pw.chromium.launch(launch); ctx = await browser.newContext({ ...view, ...(shot ? { reducedMotion: 'reduce' } : {}) }); }
  else {
    fs.mkdirSync(PROFILE, { recursive: true });
    try { ctx = await pw.chromium.launchPersistentContext(PROFILE, { ...launch, ...view }); }
    catch (e) {
      if (/already in use|ProcessSingleton|lock/i.test(e.message)) { console.error('The dev window is already open (one at a time). Close it, or use --signed-out for a second one.'); process.exit(1); }
      throw e;
    }
  }

  await ctx.route(u => u.hostname === 'f2fedtech.learnworlds.com', async route => {
    const req = route.request();
    const urlPath = new URL(req.url()).pathname;
    // Pictures of pages not yet uploaded to LearnWorlds are served from site/pages/<name>/assets/
    const asset = urlPath.match(/^\/__f2f-local\/([\w-]+)\/([\w.-]+)$/);
    if (asset) {
      const file = path.join(PAGES, asset[1], 'assets', asset[2]);
      const types = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml' };
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'missing ' + asset[2] });
      return route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'content-type': types[asset[2].split('.').pop().toLowerCase()] || 'application/octet-stream' } });
    }
    if (req.resourceType() !== 'document' || urlPath.startsWith('/author')) return route.continue();
    let resp;
    try { resp = await route.fetch({ maxRedirects: 0 }); } catch (e) { return route.continue().catch(() => {}); }
    const type = resp.headers()['content-type'] || '';
    // Pages and the "not found" page get the local code; redirects and everything else pass through as they are
    if (![200, 404].includes(resp.status()) || !/text\/html/.test(type)) return route.fulfill({ response: resp });
    const html = localise((await resp.text()).replace(/\r\n/g, '\n'), urlPath, code, pages);
    if (html === null) return route.fulfill({ response: resp });
    return route.fulfill({ response: resp, body: html, headers: { ...resp.headers(), 'content-type': 'text/html; charset=utf-8' } });
  });

  const page = ctx.pages()[0] || await ctx.newPage();
  page.on('pageerror', e => console.log('  page error: ' + e.message));
  await page.goto(startUrl, { waitUntil: 'commit', timeout: 90000 });

  if (shot) {
    await page.waitForLoadState('load', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(3000);
    // Site pages scroll inside LearnWorlds' own boxes; open them up for a full-length picture, loading lazy images on the way
    await page.evaluate(async () => {
      document.querySelectorAll('#pageContainer, #pageContent, #sectionsWrapper').forEach(e => { e.style.height = 'auto'; e.style.overflow = 'visible'; });
      for (let y = 0; y < document.documentElement.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: shot, fullPage: true });
    console.log('saved ' + shot);
    // Chrome can take a long time to exit on Windows: don't wait for it
    await Promise.race([browser.close(), new Promise(r => setTimeout(r, 3000))]);
    process.exit(0);
  }

  console.log('Local preview of ' + startUrl + (phone ? ' (phone size)' : '') + (signedOut ? ' (signed out)' : ''));
  console.log('Every page you open shows your local files. Edit site/custom-code/ or site/pages/ and save: the window reloads.');
  if (!signedOut) console.log('Sign in with "Log in" to see the signed-in pages; the window remembers it.');
  console.log('When it looks right: npm run status, then npm run push. Close the window (or Ctrl+C) to stop.');

  let timer = null;
  const reload = file => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      code = siteCode(); pages = localPages();
      for (const p of ctx.pages()) await p.reload({ waitUntil: 'commit' }).catch(() => {});
      console.log('  reloaded (' + file + ')');
    }, 250);
  };
  fs.watch(CUSTOM, (ev, f) => reload(f || 'site/custom-code'));
  fs.watch(PAGES, { recursive: true }, (ev, f) => reload(f || 'site/pages'));
  ctx.on('close', () => process.exit(0));
  if (browser) browser.on('disconnected', () => process.exit(0));
})().catch(e => { console.error(e.message); process.exit(1); });
