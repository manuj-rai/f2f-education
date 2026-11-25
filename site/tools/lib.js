// Shared build logic for locally designed pages.
//
// A page lives in site/pages/<name>/:
//   page.json  { "title", "path", "builderPage" }  where it lives on the site and in the Site Builder
//   page.html  the design: plain HTML sections (brand styles come from site/custom-code/style.css)
//   page.css   optional styles for this page only
//
// build(name) returns the two payloads that go into that page's *page custom code* in LearnWorlds:
//   body  -> "<body> logged in" and "<body> logged out"
//   style -> "<style> logged in" and "<style> logged out"
//
// How it works on the live site: LearnWorlds puts page custom code at the very end of <body>, after the
// footer. The small script below moves our page into <main> (between header and footer), then:
//   <div data-lw-section="#component_123"></div>  moves the whole LearnWorlds section holding that element
//   <div data-lw-element="#component_123"></div>  moves just that element (e.g. the live course cards)//   <a data-f2f-open="signup">  /  "signin"        opens LearnWorlds' own sign-up / sign-in window
//   data-show="visitors" / data-show="members"      shows an element only to signed-out / signed-in people
//                                                    (LearnWorlds keeps separate code for each, so the build
//                                                    makes one body per audience)
// The style payload hides LearnWorlds' other sections on that page, so the old layout never shows.
// The Site Builder canvas doesn't run custom code, so those sections stay editable there.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const PAGES = path.join(ROOT, 'site', 'pages');
const DIST = path.join(ROOT, 'site', 'dist');

// Notes from testing on the live site:
// - The page goes right before <main>, not inside it: LearnWorlds starts its live widgets (course cards,
//   load more) only while their sections sit untouched in <main>, so <main>'s children must not change.
// - For the same reason, LearnWorlds sections move into their slots only once the page has loaded.
const RUNTIME = [
  '(function () {',
  "  var page = document.getElementById('f2f-page');",
  "  var main = document.querySelector('#sectionsWrapper main') || document.querySelector('main');",
  '  if (!page || !main) return;',
  '  main.parentNode.insertBefore(page, main);',
  '  function fillSlots() {',
  "    var slots = page.querySelectorAll('[data-lw-section], [data-lw-element]');",
  '    for (var i = 0; i < slots.length; i++) {',
  "      var slot = slots[i], whole = slot.hasAttribute('data-lw-section');",
  "      var hit = document.querySelector(slot.getAttribute(whole ? 'data-lw-section' : 'data-lw-element'));",
  "      var node = hit && (whole ? (hit.closest('.learnworlds-section') || hit) : hit);",
  '      if (node && !page.contains(node)) slot.parentNode.replaceChild(node, slot);',
  "      else slot.setAttribute('data-lw-missing', '');",
  '    }',
  '  }',
  "  if (document.readyState === 'complete') fillSlots(); else window.addEventListener('load', fillSlots);",
  "  page.addEventListener('click', function (e) {",
  "    var a = e.target.closest('[data-f2f-open]');",
  '    if (!a) return;',
  '    e.preventDefault();',
  "    var form = a.getAttribute('data-f2f-open');",
  "    var lw = document.querySelector('.js-linked-node[data-interactive-link-type=\"openformslink\"][data-interactive-link-var1=\"' + form + '\"]');",
  "    if (lw && !page.contains(lw)) lw.click(); else location.href = '/?msg=not-logged-in';",
  '  });',
  '})();'
].join('\n');

function readPage(name) {
  const dir = path.join(PAGES, name);
  if (!fs.existsSync(dir)) throw new Error('No such page: site/pages/' + name);
  const config = JSON.parse(fs.readFileSync(path.join(dir, 'page.json'), 'utf8'));
  for (const k of ['title', 'path', 'builderPage']) if (!config[k]) throw new Error('page.json is missing "' + k + '"');
  const read = f => (fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8').replace(/\r\n/g, '\n').trim() : '');
  return { name, dir, config, html: read('page.html'), css: read('page.css') };
}

/* Static files a page uses live in site/pages/<name>/assets/ and are referenced as "assets/<file>".
   - SVGs (small icons and logos) are embedded as data URIs, so they need no hosting.
   - Other files (photos) need a public URL. For the preview they are served from disk; for publishing
     they must be listed in site/pages/<name>/assets.json as { "<file>": "<hosted URL>" }. */
const PREVIEW_ASSET_BASE = 'https://f2fedtech.learnworlds.com/__f2f-local/';
function resolveAssets(p, text, mode) {
  const manifestFile = path.join(p.dir, 'assets.json');
  const hosted = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
  const missing = new Set();
  const out = text.replace(/(["'(])assets\/([\w.-]+)(?=["')])/g, (m, q, file) => {
    const local = path.join(p.dir, 'assets', file);
    if (!fs.existsSync(local)) throw new Error('Missing asset file: site/pages/' + p.name + '/assets/' + file);
    if (/\.svg$/i.test(file)) return q + 'data:image/svg+xml;base64,' + fs.readFileSync(local).toString('base64');
    if (mode === 'preview') return q + PREVIEW_ASSET_BASE + p.name + '/' + file;
    if (hosted[file]) return q + hosted[file];
    missing.add(file);
    return m;
  });
  if (missing.size) throw new Error('Upload these to LearnWorlds and add their URLs to site/pages/' + p.name + '/assets.json before publishing: ' + [...missing].join(', '));
  return out;
}

function build(name, opts) {
  const mode = (opts && opts.mode) || 'publish';
  const p = readPage(name);
  if (!p.html) throw new Error('site/pages/' + name + '/page.html is empty');
  p.html = resolveAssets(p, p.html, mode);
  p.css = resolveAssets(p, p.css, mode);
  if (/<\/?(html|head|body)\b/i.test(p.html)) throw new Error('page.html must hold sections only, not <html>/<head>/<body>');
  const tag = 'F2F page:' + name;
  const note = 'generated from site/pages/' + name + ' by site/tools/build.js. Edit the files there, not here.';
  const bodyFor = audience => [
    '<!-- ' + tag + ' · ' + note + ' -->',
    '<div id="f2f-page" class="f2f-page f2f-page--' + name + ' f2f-' + audience + '">',
    p.html,
    '</div>',
    '<script>',
    '/* Moves this page between the header and footer, and LearnWorlds sections into their slots. */',
    RUNTIME,
    '</script>',
    '<!-- /' + tag + ' -->'
  ].join('\n') + '\n';
  const style = [
    '/* ' + tag + ' · ' + note + ' */',
    "/* LearnWorlds' own sections on this page are replaced by the design (slots move the ones it uses). */",
    '#sectionsWrapper main > .learnworlds-section { display: none !important; }',
    '/* Keep the footer below the fold until the page block is in place. */',
    '#sectionsWrapper:not(:has(#f2f-page)) main { min-height: 100vh; }',
    '/* Content for one audience only */',
    '.f2f-visitor [data-show="members"], .f2f-member [data-show="visitors"] { display: none !important; }',
    p.css,
    '/* /' + tag + ' */'
  ].join('\n') + '\n';
  return { ...p, tag, bodyVisitor: bodyFor('visitor'), bodyMember: bodyFor('member'), style };
}

function writeDist(b) {
  const out = path.join(DIST, b.name);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'body-visitors.html'), b.bodyVisitor);
  fs.writeFileSync(path.join(out, 'body-members.html'), b.bodyMember);
  fs.writeFileSync(path.join(out, 'style.css'), b.style);
  return out;
}

/* Removes a previously published copy of this page's code from live HTML (used by the preview). */
function stripPublished(html, tag) {
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html
    .replace(new RegExp('<!-- ' + esc(tag) + ' [\\s\\S]*?<!-- /' + esc(tag) + ' -->', 'g'), '')
    .replace(new RegExp('/\\* ' + esc(tag) + ' [\\s\\S]*?/\\* /' + esc(tag) + ' \\*/', 'g'), '');
}

function listPages() {
  return fs.existsSync(PAGES) ? fs.readdirSync(PAGES).filter(n => fs.existsSync(path.join(PAGES, n, 'page.json'))) : [];
}

/* ---- Keeping edits made in the LearnWorlds admin ----
   People also edit custom code directly in LearnWorlds (Page / Site custom code). A publish must never wipe
   that out. So every version of slot code these tools generate is remembered (its hash) in
   site/state/<page>/versions.json, and the publish snippet reads every slot BEFORE writing anything: if a slot
   holds code that isn't one of those versions, someone edited it in the admin, and the snippet stops without
   changing anything and returns that code. Copy the edit into the project files (site/pages/<page>/ or
   site/custom-code/), rebuild with --accept <hash> to mark that live code as handled, then publish again. */
function normCode(s) {
  return String(s == null ? '' : s).replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).join('\n').replace(/\s+$/, '');
}
function codeHash(s) {
  const t = normCode(s);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

function parseAccept(args) {
  const i = args.indexOf('--accept');
  if (i < 0) return [];
  const list = String(args[i + 1] || '').split(',').filter(Boolean);
  if (!list.length || list.some(h => !/^[0-9a-f]{16}$/.test(h))) throw new Error('--accept takes the 16-character hash(es) the publish snippet reported, comma separated');
  return list;
}

/* Adds the hashes of `values` (and of accepted live code) to dir/versions.json; returns every known hash. */
function rememberVersions(dir, values, acceptedHashes) {
  const file = path.join(dir, 'versions.json');
  let known = [];
  try { known = JSON.parse(fs.readFileSync(file, 'utf8')).hashes || []; } catch (e) { /* first run */ }
  const set = new Set(known);
  values.forEach(v => { if (normCode(v)) set.add(codeHash(v)); });
  (acceptedHashes || []).forEach(h => set.add(h));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, JSON.stringify({
    note: 'Slot code these tools generated, or live code accepted after its admin edits were copied into the project (--accept). A publish only overwrites a slot whose live code is one of these. See README "Edits made in the LearnWorlds admin".',
    hashes: [...set]
  }, null, 2) + '\n');
  return [...set];
}

/* Snippet code shared by both publish scripts. Needs in scope: page, frame, SLOTS ([label, value] pairs), KNOWN. */
const WRITE_SLOTS = `
  ${normCode.toString()}
  ${codeHash.toString()}
  const cm = () => frame.evaluate(() => { const v = [...document.querySelectorAll(".CodeMirror")].filter(c => c.getClientRects().length); return v.length === 1 ? v[0].CodeMirror.getValue() : null; });
  const openTab = async label => { const tab = frame.locator(".vertical-code-tab:visible", { hasText: label }).first(); await tab.click(); await page.waitForTimeout(900); return tab; };

  // 1. Read every slot first. Code that isn't a version these tools generated was edited in the
  //    LearnWorlds admin: stop before changing anything, so that edit is kept.
  const live = {};
  for (const [label] of SLOTS) {
    await openTab(label);
    const v = await cm();
    if (v === null) return { error: "expected one visible editor; stopped without changes", slot: label };
    live[label] = v;
  }
  const edited = SLOTS.filter(([label, value]) => { const n = normCode(live[label]); return n !== "" && n !== normCode(value) && !KNOWN.includes(codeHash(live[label])); })
    .map(([label]) => ({ slot: label, hash: codeHash(live[label]), live: live[label] }));
  if (edited.length) return { stopped: "These slots were edited in the LearnWorlds admin. Nothing was changed. Copy each edit into the project files, rebuild with --accept <hash>, then publish again.", edited };

  // 2. Write the slots that differ.
  const results = [];
  for (const [label, value] of SLOTS) {
    if (normCode(live[label]) === normCode(value)) { results.push({ slot: label, unchanged: true }); continue; }
    const tab = await openTab(label);
    await frame.evaluate(v => [...document.querySelectorAll(".CodeMirror")].find(c => c.getClientRects().length).CodeMirror.setValue(v + " "), value);
    await frame.locator(".CodeMirror:visible").first().click({ position: { x: 300, y: 15 } });
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Backspace");
    await page.waitForTimeout(500);
    const after = await cm();
    const btn = tab.locator("button.lw-popup-win-tab-btn");
    if (after !== value || /disabled/.test((await btn.getAttribute("class")) || "")) { results.push({ slot: label, error: "editor content mismatch or Update not enabled", afterLen: after && after.length }); break; }
    await btn.click();
    await page.waitForTimeout(2500);
    results.push({ slot: label, saved: /disabled/.test((await btn.getAttribute("class")) || ""), chars: value.length });
  }`;

module.exports = { ROOT, PAGES, DIST, PREVIEW_ASSET_BASE, build, writeDist, stripPublished, listPages, readPage, normCode, codeHash, parseAccept, rememberVersions, WRITE_SLOTS };
