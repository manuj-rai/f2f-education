// Renders many slide frames with ONE headless Chrome over the DevTools protocol (much faster than one Chrome per frame).
// Usage: node render_cdp.mjs <jobs.json> <chrome.exe> <profile-dir> [workers]
// jobs.json = [{ "url": "file:///.../s01_1.html", "png": "C:\\...\\s01_1.png", "check": true }]
// Prints one JSON line per job: { png, ok, overflow }
import { spawn } from 'node:child_process';
import fs from 'node:fs';

const [, , jobsFile, chromePath, profDir, workersArg] = process.argv;
const jobs = JSON.parse(fs.readFileSync(jobsFile, 'utf8'));
const workers = Math.max(1, Math.min(parseInt(workersArg || '4', 10), jobs.length || 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// watchdog: never hang a build (about 6 s per frame is far more than needed)
setTimeout(() => { process.stderr.write('render_cdp: watchdog timeout\n'); process.exit(3); }, 60000 + jobs.length * 6000).unref();

// a fresh profile per run: a Chrome left over from an interrupted run can't lock it (exit code 21)
const prof = `${profDir}-${process.pid}`;
const proc = spawn(chromePath, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${prof}`, '--window-size=1920,1080', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
process.on('exit', () => { try { proc.kill(); } catch (e) { /* gone */ } setTimeout(() => {}, 0); try { fs.rmSync(prof, { recursive: true, force: true }); } catch (e) { /* still locked */ } });
const wsUrl = await new Promise((res, rej) => {
  let buf = '';
  proc.stderr.on('data', (d) => { buf += d; const m = buf.match(/DevTools listening on (ws:\/\/\S+)/); if (m) res(m[1]); });
  proc.on('exit', (c) => rej(new Error('chrome exited ' + c)));
  setTimeout(() => rej(new Error('no DevTools URL from Chrome')), 30000);
});

const ws = new WebSocket(wsUrl);
await new Promise((r, j) => { ws.addEventListener('open', r, { once: true }); ws.addEventListener('error', j, { once: true }); });
let seq = 0; const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.rej(new Error(msg.error.message)) : p.res(msg.result); }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
});
const evalIn = async (sid, expression) => (await send('Runtime.evaluate', { expression, returnByValue: true }, sid)).result.value;

async function newPage() {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, sessionId);
  return sessionId;
}

async function render(sid, job) {
  try { await evalIn(sid, "document.body && document.body.removeAttribute('data-ready')"); } catch (e) { /* about:blank */ }
  await send('Page.navigate', { url: job.url }, sid);
  const t0 = Date.now(); let ready = false;
  while (Date.now() - t0 < 20000) {
    await sleep(40);
    try { if ((await evalIn(sid, "document.readyState === 'complete' && document.body && document.body.getAttribute('data-ready')")) === '1') { ready = true; break; } } catch (e) { /* navigating */ }
  }
  await sleep(60); // let the last paint settle
  const overflow = (await evalIn(sid, "document.body && document.body.getAttribute('data-overflow')")) === '1';
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
  fs.writeFileSync(job.png, Buffer.from(shot.data, 'base64'));
  return { png: job.png, ok: ready, overflow: job.check ? overflow : false };
}

let next = 0;
async function worker() {
  const sid = await newPage();
  while (next < jobs.length) {
    const job = jobs[next++];
    let r;
    try { r = await render(sid, job); } catch (e) { r = { png: job.png, ok: false, error: String(e.message || e) }; }
    process.stdout.write(JSON.stringify(r) + '\n');
  }
}
try {
  await Promise.all(Array.from({ length: workers }, worker));
} finally {
  // Browser.close sometimes never answers (the socket closes first), so don't wait on it
  await Promise.race([send('Browser.close').catch(() => {}), sleep(3000)]);
  try { proc.kill(); } catch (e) { /* already gone */ }
  process.exit(0);
}
