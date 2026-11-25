// npm run push [-- <page|site> ...] [--check] [--all] [--accept <hash>[,<hash>]] [--mcp] [--headless]
//
// Publishes everything that changed locally, in one run: the site-wide code (site/custom-code/) and every
// page in site/pages/ whose page.json has "publish": true. Pages without it are never published.
//
// 1. Before opening any browser it builds everything and compares it with the live site (like npm run status).
//    If the admin edited something, it stops: run npm run pull first. If nothing changed, it stops there too.
// 2. It opens its own Chrome window (the first time, sign in to LearnWorlds there; the sign-in is kept in
//    %LOCALAPPDATA%\f2f-education\push-session.json, outside the project). For each page
//    that changed it opens the Site Builder > Custom code and writes the slots, clicking each slot's Update.
//    Pages with "audiences": ["visitors"] (or ["members"]) only get that audience's slots.
// 0. It runs npm run check first and stops on a JavaScript syntax error.
// 3. It reads every slot first and stops without changing anything if a slot holds code
//    these tools never generated (an admin edit). Signed-in slots are only visible there, so that's where
//    their edits are found. The edit is saved to site/dist/<page>/live/ for copying into the project; then
//    run push again with --accept <hash>.
// 4. Afterwards it reloads the live pages and checks they show the new code.
//
//   <page|site>  only these (default: the site-wide code and every ready page)
//   --check      sign in and read every slot, report, write nothing
//   --all        open every selected page even if it looks up to date (re-checks the signed-in slots)
//   --accept     the hash(es) a stopped push reported, after copying those edits into the project
//   --mcp        don't open Chrome: write site/dist/push.js, one snippet Claude runs in the shared
//                Playwright MCP browser (browser_run_code_unsafe with filename)
//   --headless   no window (only works once the profile is signed in)
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const J = require('./jobs');
const { WRITE_SLOTS, normCode, codeHash, parseAccept } = require('./lib');

const args = process.argv.slice(2);
const names = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--accept');
const check = args.includes('--check');
const all = args.includes('--all');
const mcp = args.includes('--mcp');
const headless = args.includes('--headless');
// The LearnWorlds sign-in is kept here, outside the project (it is a login cookie: don't share it).
const SESSION = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.local', 'share'), 'f2f-education', 'push-session.json');

/* ---- What runs in the Site Builder (the same code in our own Chrome and as the MCP snippet) ----
   Self-contained: it's turned into source text. The slot writing itself is lib.js's WRITE_SLOTS. */
async function runJobs(page, JOBS, OPTS, H) {
  const SITE = 'https://f2fedtech.learnworlds.com';
  const PAGE_TABS = ['<head> logged in (html)', '<head> logged out (html)', '<body> logged in (html)', '<body> logged out (html)', '<style> logged in (css)', '<style> logged out (css)'];
  const wait = ms => page.waitForTimeout(ms);
  const visibleTabs = frame => frame.evaluate(() => [...document.querySelectorAll('.vertical-code-tab')].filter(t => t.getClientRects().length).map(t => t.innerText.replace(/\s+/g, ' ').trim()));

  async function openBuilder(builderPage) {
    await page.goto(SITE + '/author/pageseditor?page=' + encodeURIComponent(builderPage), { waitUntil: 'domcontentloaded', timeout: 90000 });
    // The builder reloads its iframe once while starting, so wait until the same ready frame is seen twice.
    let frame = null, ready = 0;
    for (let i = 0; i < 120 && ready < 2; i++) {
      await wait(500);
      const f = page.frames().find(x => x.name() === 'pageseditorIframe');
      const ok = f ? await f.locator('.authoring-topbar').count().catch(() => 0) : 0;
      if (ok && f === frame) ready++; else { ready = ok ? 1 : 0; frame = ok ? f : null; }
    }
    if (!frame) return { error: 'Site Builder did not open (signed out?)', url: page.url() };
    if (new URL(page.url()).searchParams.get('page') !== builderPage) return { error: 'Site Builder opened a different page', url: page.url() };
    await wait(1500);
    return { frame };
  }

  // Page menu > Custom code; for the site-wide code, then switch the window to "Site custom code".
  // Page and site code share slot names, so the visible tabs are checked before anything is read or written.
  async function openCode(frame, kind) {
    await frame.locator('.authoring-topbar').getByText('page', { exact: true }).first().click();
    await wait(800);
    await frame.locator('p.lw-PB-submenu-option-lbl', { hasText: 'Custom code' }).first().click();
    await wait(1500);
    await page.mouse.move(900, 520);
    await wait(800);
    if (kind === 'site') {
      await frame.getByText('Site custom code', { exact: true }).filter({ visible: true }).first().click();
      await wait(1200);
    } else {
      const toggle = frame.getByText('Page custom code', { exact: true });
      if (await toggle.isVisible().catch(() => false)) { await toggle.click().catch(() => {}); await wait(800); }
    }
    const tabs = await visibleTabs(frame);
    const ok = kind === 'site'
      ? tabs.includes('<style> Dynamic (css)') && !tabs.some(t => /<style> logged (in|out)/.test(t))
      : JSON.stringify(tabs) === JSON.stringify(PAGE_TABS);
    return ok ? { tabs } : { error: (kind === 'site' ? 'Site' : 'Page') + ' custom code tabs not showing; stopped without changes', tabs };
  }

  async function readSlots(frame, SLOTS, KNOWN) {
    const cm = () => frame.evaluate(() => { const v = [...document.querySelectorAll('.CodeMirror')].filter(c => c.getClientRects().length); return v.length === 1 ? v[0].CodeMirror.getValue() : null; });
    const results = [];
    for (const [label, value] of SLOTS) {
      await frame.locator('.vertical-code-tab:visible', { hasText: label }).first().click();
      await wait(900);
      const v = await cm();
      if (v === null) return { error: 'expected one visible editor', slot: label };
      const n = H.normCode(v);
      const state = n === H.normCode(value) ? 'unchanged' : n === '' ? 'empty' : KNOWN.includes(H.codeHash(v)) ? 'older version' : 'edited';
      results.push({ slot: label, state, hash: H.codeHash(v), live: state === 'edited' ? v : undefined });
    }
    return { results };
  }

  const out = [];
  for (const job of JOBS) {
    const b = await openBuilder(job.builderPage);
    if (b.error) { out.push({ id: job.id, error: b.error, url: b.url }); break; }
    const c = await openCode(b.frame, job.kind);
    if (c.error) { out.push({ id: job.id, error: c.error, tabs: c.tabs }); break; }
    const r = OPTS.check ? await readSlots(b.frame, job.slots, job.known) : await H.writeSlots(b.frame, job.slots, job.known);
    out.push({ id: job.id, ...r });
    if (r.error || r.stopped || (r.results || []).some(x => x.error || x.saved === false)) break;
  }
  return out;
}

function snippetSource(payload, opts) {
  return `async (page) => {
  const JOBS = ${JSON.stringify(payload)};
  const OPTS = ${JSON.stringify(opts)};
  ${normCode.toString()}
  ${codeHash.toString()}
  async function writeSlots(frame, SLOTS, KNOWN) {${WRITE_SLOTS}
    return { results };
  }
  const runJobs = ${runJobs.toString()};
  return runJobs(page, JOBS, OPTS, { writeSlots, normCode, codeHash });
}`;
}

/* ---- Record of what was last pushed (every slot confirmed in the Site Builder) ---- */
const pushedFile = job => path.join(J.stateDir(job), 'pushed.json');
function readPushed(job) { try { return JSON.parse(fs.readFileSync(pushedFile(job), 'utf8')).slots || null; } catch (e) { return null; } }
function writePushed(job) {
  fs.mkdirSync(J.stateDir(job), { recursive: true });
  fs.writeFileSync(pushedFile(job), JSON.stringify({
    note: 'Slots confirmed in the Site Builder by npm run push (hash of the code each slot held). push re-opens a page whose local code differs from this.',
    at: new Date().toISOString(),
    slots: Object.fromEntries(job.slots.map(([l, v]) => [l, codeHash(v)]))
  }, null, 2) + '\n');
}

/* ---- Signing in (our own Chrome profile) ---- */
async function ensureSignedIn(page) {
  const builder = J.SITE_URL + '/author/pageseditor?page=home';
  const inAdmin = () => { try { return new URL(page.url()).pathname.startsWith('/author/'); } catch (e) { return false; } };
  // Signed out, LearnWorlds redirects to /?msg=not-logged-in; that public page is slow to finish loading, so
  // only wait for the redirect to land.
  await page.goto(builder, { waitUntil: 'commit', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(2000);
  if (inAdmin()) return true;
  if (headless) return false;
  console.log('\nSign in to LearnWorlds (admin account) in the Chrome window that just opened.');
  console.log('The push carries on by itself once you are in (waiting up to 10 minutes). This is only needed the first time.\n');
  const until = Date.now() + 10 * 60 * 1000;
  while (Date.now() < until) {
    if (page.isClosed()) return false;
    await page.waitForTimeout(2000).catch(() => {});
    if (inAdmin()) { await page.waitForTimeout(1500); return true; }
  }
  return false;
}

function saveEdited(job, edited) {
  for (const e of edited) {
    const out = path.join(J.DIST, job.id, 'live', J.SLOT_FILE[e.slot]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, normCode(e.live) + '\n');
    const visible = job.visible.includes(e.slot);
    console.log('    ' + e.slot + '  (hash ' + e.hash + ')  saved to ' + J.rel(out));
    J.lineDiff(normCode(J.slotValue(job, e.slot)), normCode(e.live)).slice(0, 40).forEach(l => console.log('      ' + l.replace(/^- /, '- local ').replace(/^\+ /, '+ admin ')));
    console.log(visible
      ? '    -> npm run pull -- ' + (job.kind === 'site' ? 'site' : job.id) + '   copies it into ' + job.source[e.slot]
      : '    -> copy the admin\'s lines (+) into ' + job.source[e.slot] + ', then: npm run push -- ' + (job.kind === 'site' ? 'site' : job.id) + ' --accept ' + e.hash);
  }
}

(async () => {
  const accept = parseAccept(args);
  // 0. No broken script goes live: the same check as npm run check.
  if (!check) {
    const syntax = require('./check').check();
    if (syntax.errors.length) { console.error('Not pushed. Syntax errors:'); syntax.errors.forEach(e => console.error('  ' + e)); process.exit(1); }
  }
  // 1. Pick and build.
  let jobs = J.selectJobs(names);
  const notReady = jobs.filter(j => !j.ready);
  if (names.length && notReady.length && !check) {
    console.error(notReady.map(j => j.id).join(', ') + ': not marked ready. Add "publish": true to its page.json once the page is approved.');
    process.exit(1);
  }
  // Pages that aren't ready are left out; a read-only --check may name one explicitly.
  if (!check || !names.length) jobs = jobs.filter(j => j.ready);
  if (!names.length && notReady.length) console.log('Not published (no "publish": true in page.json): ' + notReady.map(j => j.id).join(', '));
  const broken = jobs.filter(j => j.error);
  if (broken.length) { broken.forEach(j => console.error(j.id + ': ' + j.error)); process.exit(1); }

  // 2. Compare with the live site; stop on admin edits; keep only what needs pushing.
  const todo = [];
  let adminEdits = 0;
  for (const job of jobs) {
    const cmp = await J.compareJob(job);
    const edited = cmp.slots.filter(s => s.state === 'edited');
    if (edited.length) {
      adminEdits++;
      console.log((job.kind === 'site' ? 'site' : job.id) + ': edited in the LearnWorlds admin: ' + edited.map(s => s.label).join(', '));
      continue;
    }
    const rec = readPushed(job);
    const reasons = [];
    if (cmp.slots.some(s => s.state !== 'same')) reasons.push('local changes');
    if (!rec || job.slots.some(([l, v]) => rec[l] !== codeHash(v))) reasons.push('signed-in slots not confirmed yet');
    if (!job.visible.length) reasons.push('signed-in only');
    if (all || check || reasons.length) todo.push({ job, why: reasons.join(', ') || (check ? 'check' : 'requested (--all)') });
  }
  if (adminEdits) { console.log('\nNothing was published. Run npm run pull to copy those edits into the local files, then push again.'); process.exit(1); }
  if (!todo.length) { console.log('Everything is already live. Nothing to push.'); return; }
  console.log((check ? 'Checking' : 'Pushing') + ':');
  todo.forEach(t => console.log('  ' + (t.job.kind === 'site' ? 'site' : t.job.id).padEnd(14) + (t.job.kind === 'page' && t.job.audiences.length === 1 ? '[' + t.job.audiences[0] + ' only] ' : '') + '(' + t.why + ')'));

  // Every version generated here counts as ours for the admin-edit guard.
  const payload = todo.map(({ job }) => ({ id: job.id, kind: job.kind, builderPage: job.builderPage, slots: job.slots, known: J.remember(job, accept) }));
  const source = snippetSource(payload, { check });

  if (mcp) {
    const out = path.join(J.DIST, 'push.js');
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, source);
    console.log('\nWrote ' + out);
    console.log('Claude: run it in the signed-in admin browser (Playwright MCP browser_run_code_unsafe, filename above), then npm run status.');
    return;
  }

  // 3. Our own Chrome, signed in once (the sign-in is saved to SESSION and loaded next time).
  const pw = require('playwright-core');
  let browser, ctx;
  try {
    browser = await pw.chromium.launch({ channel: 'chrome', headless });
    ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, ...(fs.existsSync(SESSION) ? { storageState: SESSION } : {}) });
  } catch (e) {
    console.error('Could not start Chrome: ' + e.message.split('\n')[0]);
    process.exit(1);
  }
  const saveSession = async () => {
    try { fs.mkdirSync(path.dirname(SESSION), { recursive: true }); await ctx.storageState({ path: SESSION }); } catch (e) { /* keep the old one */ }
  };
  // Chrome can take a minute to exit on this machine; don't wait for it (it finishes closing by itself).
  const close = () => Promise.race([browser.close().catch(() => {}), new Promise(r => setTimeout(r, 3000))]);
  process.on('SIGINT', () => { close().then(() => process.exit(130)); });
  const page = await ctx.newPage();
  // Leaving the builder never loses anything of ours (custom code saves with each slot's Update), so accept
  // "leave this page?" prompts; dismiss anything else.
  page.on('dialog', d => (d.type() === 'beforeunload' ? d.accept() : d.dismiss()).catch(() => {}));

  if (!(await ensureSignedIn(page))) {
    console.error(headless ? 'Not signed in. Run npm run push once without --headless and sign in in the window.' : 'Not signed in (window closed or timed out). Nothing was published.');
    await close();
    process.exit(1);
  }
  await saveSession();
  console.log('Signed in. Working in the Site Builder; leave the Chrome window alone until it closes.\n');

  let results;
  try { results = await (0, eval)(source)(page); }
  catch (e) { console.error('Stopped: ' + e.message.split('\n')[0]); await close(); process.exit(1); }
  await saveSession();
  await close();

  // 4. Report, remember, verify.
  let failed = false;
  const pushed = [];
  for (const r of results) {
    const job = todo.find(t => t.job.id === r.id).job;
    const name = job.kind === 'site' ? 'site' : job.id;
    if (r.error) { failed = true; console.log(name + ': ' + r.error + (r.slot ? ' (' + r.slot + ')' : '') + (r.tabs ? ' tabs: ' + JSON.stringify(r.tabs) : '')); continue; }
    if (r.stopped) {
      failed = true;
      console.log(name + ': stopped without changing anything. These slots were edited in the LearnWorlds admin:');
      saveEdited(job, r.edited);
      continue;
    }
    if (check) {
      console.log(name + ':');
      r.results.forEach(x => console.log('    ' + x.slot.padEnd(26) + ' ' + x.state + (x.state === 'edited' ? ' (hash ' + x.hash + ')' : '')));
      const edited = r.results.filter(x => x.state === 'edited').map(x => ({ slot: x.slot, hash: x.hash, live: x.live }));
      if (edited.length) { failed = true; saveEdited(job, edited); }
      if (r.results.every(x => x.state === 'unchanged')) writePushed(job);
      continue;
    }
    const bad = r.results.filter(x => x.error || x.saved === false);
    console.log(name + ':');
    r.results.forEach(x => console.log('    ' + x.slot.padEnd(26) + ' ' + (x.unchanged ? 'already up to date' : x.error ? 'ERROR: ' + x.error : x.saved ? 'saved' : 'NOT saved (Update stayed enabled)')));
    if (bad.length || r.results.length < job.slots.length) { failed = true; continue; }
    writePushed(job);
    if (r.results.some(x => x.saved)) pushed.push(job);
  }
  const done = new Set(results.map(r => r.id));
  const skipped = todo.filter(t => !done.has(t.job.id));
  if (skipped.length) console.log('Not reached because of the stop above: ' + skipped.map(t => t.job.id).join(', '));

  if (pushed.length) {
    console.log('\nChecking the live site:');
    for (const job of pushed) {
      const cmp = await J.compareJob(job, { fresh: true });
      const ok = cmp.slots.every(s => s.state === 'same');
      console.log('  ' + (job.kind === 'site' ? 'site' : job.id).padEnd(14) + (ok ? 'live' : 'not showing yet: ' + cmp.slots.filter(s => s.state !== 'same').map(s => s.label + ' ' + s.state).join(', ')));
    }
  }
  if (!failed) console.log(check ? '\nCheck finished; nothing was written.' : '\nDone.');
  process.exit(failed ? 1 : 0); // don't wait for Chrome to finish exiting
})().catch(e => { console.error(e.message); process.exit(1); });
