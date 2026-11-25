// Shared logic for `npm run status`, `npm run pull` and `npm run push`.
//
// A "job" is one thing that gets published into LearnWorlds custom code:
//   _site        the site-wide code in site/custom-code/ (Site custom code: head, body, Dynamic css)
//   <page name>  a locally designed page in site/pages/<name>/ (its Page custom code: body, style)
//
// The live site shows the signed-out ("logged out") version of every slot in the public page HTML, verbatim.
// So status/pull can compare local files with what's live without signing in. The signed-in slots are
// only visible in the Site Builder; push reads those there before writing anything.
//
// site/state/<job>/versions.json   hashes of every version these tools generated (the admin-edit guard)
// site/state/<job>/last-live/      the last signed-out code seen live that matched the local files: the base
//                                  `npm run pull` uses to tell "only the admin changed this" from "both changed"
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, build, listPages, readPage, normCode, codeHash, rememberVersions } = require('./lib');

const SITE_URL = 'https://f2fedtech.learnworlds.com';
const STATE = path.join(ROOT, 'site', 'state');
const CUSTOM = path.join(ROOT, 'site', 'custom-code');
const DIST = path.join(ROOT, 'site', 'dist');
const SITE_ID = '_site';

const SLOT = {
  headIn: '<head> logged in (html)', headOut: '<head> logged out (html)',
  bodyIn: '<body> logged in (html)', bodyOut: '<body> logged out (html)',
  styleIn: '<style> logged in (css)', styleOut: '<style> logged out (css)',
  siteCss: '<style> Dynamic (css)',
  // LearnWorlds' built-in pages (/account, /inbox, /social, apps) load only this slot, not "Dynamic (css)"
  builtinCss: '<style> (css) for built in pages (i.e social, profile, workpad, my account)'
};
// File names used for a slot's copies in site/state/<job>/last-live/ and site/dist/<job>/live/.
const SLOT_FILE = {
  [SLOT.headIn]: 'head-members.html', [SLOT.headOut]: 'head-visitors.html',
  [SLOT.bodyIn]: 'body-members.html', [SLOT.bodyOut]: 'body-visitors.html',
  [SLOT.styleIn]: 'style-members.css', [SLOT.styleOut]: 'style-visitors.css',
  [SLOT.siteCss]: 'style.css',
  [SLOT.builtinCss]: 'builtin.css'
};

const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const readCustom = f => fs.readFileSync(path.join(CUSTOM, f), 'utf8').replace(/\r\n/g, '\n').replace(/\s+$/, '') + '\n';

function siteJob() {
  const head = readCustom('head.html'), body = readCustom('body.html'), css = readCustom('style.css');
  const builtin = css + '\n' + readCustom('builtin.css'); // the site styles, then the built-in pages' overrides (so they win)
  return {
    id: SITE_ID, kind: 'site', label: 'Site-wide code', path: '/', builderPage: 'home', ready: true,
    slots: [[SLOT.headIn, head], [SLOT.headOut, head], [SLOT.bodyIn, body], [SLOT.bodyOut, body], [SLOT.siteCss, css], [SLOT.builtinCss, builtin]],
    visible: [SLOT.headOut, SLOT.bodyOut, SLOT.siteCss],
    // where each slot's code comes from (site code is copied 1:1)
    source: { [SLOT.headIn]: 'site/custom-code/head.html', [SLOT.headOut]: 'site/custom-code/head.html', [SLOT.bodyIn]: 'site/custom-code/body.html', [SLOT.bodyOut]: 'site/custom-code/body.html', [SLOT.siteCss]: 'site/custom-code/style.css',
      [SLOT.builtinCss]: 'site/custom-code/style.css + site/custom-code/builtin.css' }
  };
}

function pageJob(name) {
  const p = readPage(name);
  // page.json "audiences": ["visitors"] / ["members"] publishes only that audience's slots; the other audience
  // keeps LearnWorlds' own page. Default: both.
  const audiences = p.config.audiences || ['visitors', 'members'];
  const job = {
    id: name, kind: 'page', label: name, path: p.config.path, builderPage: p.config.builderPage, ready: p.config.publish === true, audiences,
    visible: audiences.includes('visitors') ? [SLOT.bodyOut, SLOT.styleOut] : [],
    source: { [SLOT.bodyIn]: rel(path.join(p.dir, 'page.html')), [SLOT.bodyOut]: rel(path.join(p.dir, 'page.html')), [SLOT.styleIn]: rel(path.join(p.dir, 'page.css')), [SLOT.styleOut]: rel(path.join(p.dir, 'page.css')) }
  };
  if (!audiences.length || audiences.some(a => a !== 'visitors' && a !== 'members')) { job.error = 'page.json "audiences" must list "visitors" and/or "members"'; return job; }
  try {
    const b = build(name);
    job.build = b;
    // Signed-in slots first: if a push is interrupted, the signed-out ones (which status can see) still show it.
    job.slots = [];
    if (audiences.includes('members')) job.slots.push([SLOT.bodyIn, b.bodyMember], [SLOT.styleIn, b.style]);
    if (audiences.includes('visitors')) job.slots.push([SLOT.bodyOut, b.bodyVisitor], [SLOT.styleOut, b.style]);
  } catch (e) { job.error = e.message; }
  return job;
}

function allJobs() { return [siteJob(), ...listPages().map(pageJob)]; }

/* names: [] = everything; "site" = the site-wide code; anything else = a page in site/pages/. */
function selectJobs(names) {
  if (!names.length) return allJobs();
  const pages = listPages();
  return names.map(n => {
    if (n === 'site' || n === SITE_ID) return siteJob();
    if (!pages.includes(n)) throw new Error('No page "' + n + '". Pages: ' + pages.join(', ') + ' (or "site" for the site-wide code)');
    return pageJob(n);
  });
}

const slotValue = (job, label) => (job.slots.find(s => s[0] === label) || [])[1];
const stateDir = job => path.join(STATE, job.id);

function knownHashes(job) {
  try { return JSON.parse(fs.readFileSync(path.join(stateDir(job), 'versions.json'), 'utf8')).hashes || []; } catch (e) { return []; }
}
/* Records the job's current code (and accepted live hashes) as generated by these tools; returns all known hashes. */
function remember(job, accept) { return rememberVersions(stateDir(job), job.slots.map(s => s[1]), accept || []); }

function readLastLive(job, label) {
  const f = path.join(stateDir(job), 'last-live', SLOT_FILE[label]);
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}
function writeLastLive(job, label, code) {
  const dir = path.join(stateDir(job), 'last-live');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, SLOT_FILE[label]), normCode(code) + '\n');
}

/* ---- Reading the live site (signed out) ---- */
const pageCache = new Map();
async function fetchLive(urlPath, fresh) {
  if (!fresh && pageCache.has(urlPath)) return pageCache.get(urlPath);
  const url = SITE_URL + urlPath + (urlPath.includes('?') ? '&' : '?') + 'f2f-check=' + Date.now();
  let html = null, lastErr;
  for (let attempt = 0; attempt < 3 && html === null; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 (f2f-education site tools)', 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      html = (await r.text()).replace(/\r\n/g, '\n');
    } catch (e) { lastErr = e; }
  }
  if (html === null) throw new Error('Could not load ' + url + ': ' + (lastErr && lastErr.message));
  pageCache.set(urlPath, html);
  return html;
}

function styleElementAround(html, marker) {
  const i = html.indexOf(marker);
  if (i < 0) return null;
  const s = html.lastIndexOf('<style>', i), e = html.indexOf('</style>', i);
  return s < 0 || e < 0 ? null : html.slice(s + '<style>'.length, e);
}

/* The signed-out slots of a job as they appear in the live page HTML: { label: code | null (not on the page) }.
   Slots are found by the banner/marker our generated code starts with. An admin edit inside the slot is
   included; text an admin put before the banner would be missed here (push still catches it). */
function extractVisible(job, html) {
  const out = {};
  const bodyEnd = html.lastIndexOf('</body>');
  if (job.kind === 'site') {
    const cssMark = 'F2F EDUCATION · SITE-WIDE STYLES';
    out[SLOT.siteCss] = styleElementAround(html, cssMark);
    const headStart = html.indexOf('<!--\n  F2F Education · Site custom code · HEAD');
    const cssStart = html.lastIndexOf('<style>', html.indexOf(cssMark));
    out[SLOT.headOut] = headStart >= 0 && cssStart > headStart ? html.slice(headStart, cssStart) : null;
    const bodyStart = html.indexOf('<!--\n  F2F Education · Site custom code · BODY');
    if (bodyStart >= 0) {
      const pageCode = html.indexOf('<!-- F2F page:', bodyStart);
      out[SLOT.bodyOut] = html.slice(bodyStart, pageCode >= 0 ? pageCode : bodyEnd);
    } else out[SLOT.bodyOut] = null;
  } else {
    out[SLOT.styleOut] = styleElementAround(html, '/* F2F page:' + job.id + ' ');
    const start = html.indexOf('<!-- F2F page:' + job.id + ' ');
    out[SLOT.bodyOut] = start >= 0 ? html.slice(start, bodyEnd) : null;
  }
  for (const k in out) if (out[k] !== null) out[k] = normCode(out[k]);
  return out;
}

/* Compares each signed-out slot with the local code.
   state: same       live = local
          pending    live is an older version these tools generated: local changes not pushed yet
          edited     live is code these tools never generated: someone edited it in the LearnWorlds admin
          missing    not on the live page (never published, or the slot was emptied) */
async function compareJob(job, opts) {
  if (job.error) return { job, error: job.error, slots: [] };
  const html = await fetchLive(job.path, opts && opts.fresh);
  const live = extractVisible(job, html);
  const known = knownHashes(job);
  const slots = job.visible.map(label => {
    const local = normCode(slotValue(job, label)), lv = live[label];
    let state;
    if (lv === null) state = 'missing';
    else if (lv === local) state = 'same';
    else if (known.includes(codeHash(lv))) state = 'pending';
    else state = 'edited';
    if (state === 'same' && !(opts && opts.readOnly)) writeLastLive(job, label, lv);
    return { label, state, live: lv, local, hash: lv === null ? null : codeHash(lv) };
  });
  return { job, slots };
}

function summary(cmp) {
  if (cmp.error) return 'error';
  if (!cmp.job.visible.length) return 'members-only';
  const s = cmp.slots.map(x => x.state);
  if (s.includes('edited')) return 'edited';
  if (s.every(x => x === 'missing')) return 'unpublished';
  if (s.every(x => x === 'same')) return 'live';
  return 'pending';
}

/* ---- Mapping slot code back to the source file it was built from (used by pull) ----
   Site code is copied 1:1. A page's slot = generated header + page.html/page.css (asset paths resolved) +
   generated footer, so the middle is taken out and the asset URLs turned back into assets/<file>. */
function assetMap(job) {
  const dir = path.join(job.build.dir, 'assets');
  const pairs = [];
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) {
    if (/\.svg$/i.test(f)) pairs.push(['data:image/svg+xml;base64,' + fs.readFileSync(path.join(dir, f)).toString('base64'), 'assets/' + f]);
  }
  const manifest = path.join(job.build.dir, 'assets.json');
  if (fs.existsSync(manifest)) for (const [f, url] of Object.entries(JSON.parse(fs.readFileSync(manifest, 'utf8')))) pairs.push([url, 'assets/' + f]);
  return pairs.sort((a, b) => b[0].length - a[0].length);
}

/* Returns the source text (page.css / page.html / custom-code file) for a slot's code, or null if the code
   doesn't have the generated header/footer this build would produce (edited outside the page's own part). */
function toSource(job, label, code) {
  code = normCode(code);
  if (job.kind === 'site') return code;
  const b = job.build;
  const built = normCode(slotValue(job, label));
  const inner = label === SLOT.styleOut || label === SLOT.styleIn ? normCode(b.css) : normCode(b.html);
  const at = built.lastIndexOf(inner);
  if (at < 0 || !inner) return null;
  const head = built.slice(0, at), tail = built.slice(at + inner.length);
  if (!code.startsWith(head) || !code.endsWith(tail) || code.length < head.length + tail.length) return null;
  const pairs = assetMap(job);
  // Lines the admin didn't touch keep the local source line exactly (same asset file names); changed lines
  // get their asset URLs turned back into assets/<file>.
  const localSrc = fs.readFileSync(sourceFileFor(job, label), 'utf8').replace(/\r\n/g, '\n');
  const resolveLine = l => l.replace(/(["'(])(assets\/[\w.-]+)(?=["')])/g, (m, q, a) => { const p = pairs.find(x => x[1] === a); return p ? q + p[0] : m; });
  const byResolved = new Map();
  for (const l of localSrc.split('\n')) { const r = resolveLine(l).replace(/\s+$/, ''); if (!byResolved.has(r)) byResolved.set(r, l.replace(/\s+$/, '')); }
  return code.slice(head.length, code.length - tail.length).split('\n').map(l => {
    if (byResolved.has(l)) return byResolved.get(l);
    for (const [url, local] of pairs) l = l.split(url).join(local);
    return l;
  }).join('\n');
}

function sourceFileFor(job, label) { return path.join(ROOT, job.source[label]); }

/* ---- A small line diff for showing what changed ---- */
function lineDiff(a, b, context) {
  context = context == null ? 2 : context;
  const A = a.split('\n'), B = b.split('\n');
  let pre = 0; while (pre < A.length && pre < B.length && A[pre] === B[pre]) pre++;
  let suf = 0; while (suf < A.length - pre && suf < B.length - pre && A[A.length - 1 - suf] === B[B.length - 1 - suf]) suf++;
  const a2 = A.slice(pre, A.length - suf), b2 = B.slice(pre, B.length - suf);
  if (a2.length * b2.length > 4e6) return ['  (' + a2.length + ' lines differ: too many to show)'];
  const dp = Array.from({ length: a2.length + 1 }, () => new Int32Array(b2.length + 1));
  for (let i = a2.length - 1; i >= 0; i--) for (let j = b2.length - 1; j >= 0; j--) dp[i][j] = a2[i] === b2[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const ops = [];
  for (let k = 0; k < pre; k++) ops.push([' ', A[k], k + 1]);
  let i = 0, j = 0;
  while (i < a2.length || j < b2.length) {
    if (i < a2.length && j < b2.length && a2[i] === b2[j]) { ops.push([' ', a2[i], pre + i + 1]); i++; j++; }
    else if (i < a2.length && (j === b2.length || dp[i + 1][j] >= dp[i][j + 1])) { ops.push(['-', a2[i], pre + i + 1]); i++; }
    else { ops.push(['+', b2[j], pre + j + 1]); j++; }
  }
  for (let k = A.length - suf; k < A.length; k++) ops.push([' ', A[k], k + 1]);
  const keep = ops.map((o, k) => o[0] !== ' ' || ops.slice(Math.max(0, k - context), k + context + 1).some(x => x[0] !== ' '));
  const lines = [];
  ops.forEach((o, k) => {
    if (!keep[k]) { if (lines.length && lines[lines.length - 1] !== '  …') lines.push('  …'); return; }
    const text = o[1].length > 160 ? o[1].slice(0, 157) + '...' : o[1];
    lines.push((o[0] === ' ' ? '  ' : o[0] + ' ') + (o[0] === ' ' ? '' : 'line ' + o[2] + ': ') + text);
  });
  while (lines.length && lines[0] === '  …') lines.shift();
  while (lines.length && lines[lines.length - 1] === '  …') lines.pop();
  return lines;
}

module.exports = {
  SITE_URL, STATE, DIST, SITE_ID, SLOT, SLOT_FILE, rel,
  siteJob, pageJob, allJobs, selectJobs, slotValue, stateDir, knownHashes, remember,
  readLastLive, writeLastLive, fetchLive, extractVisible, compareJob, summary,
  toSource, sourceFileFor, lineDiff, normCode, codeHash
};
