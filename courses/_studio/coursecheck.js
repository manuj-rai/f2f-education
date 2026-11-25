// Visitor-side check of courses: listed in the public catalogue (same query the site search uses),
// with label, card image and price; then each course page opens and shows its title and lessons.
//   node courses/_studio/coursecheck.js [slug ...]     (no slugs: every courses/<slug>/ folder)
const pw = require('playwright-core');
const fs = require('fs'), path = require('path');
const COURSES = path.join(__dirname, '..');
const SLUGS = process.argv.length > 2 ? process.argv.slice(2)
  : fs.readdirSync(COURSES).filter(d => !d.startsWith('_') && fs.existsSync(path.join(COURSES, d, 'content.json')));
(async () => {
  const browser = await pw.chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  await page.goto('https://f2fedtech.learnworlds.com/courses?v=' + Date.now(), { waitUntil: 'load', timeout: 90000 });
  await page.waitForTimeout(2500);
  const cat = await page.evaluate(async () => {
    const meta = document.querySelector('meta[name="csrf-token"]');
    const r = await fetch('/api/learner/products', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'content-type': 'application/json', accept: 'application/json', 'csrf-token': meta ? meta.content : '' },
      body: JSON.stringify({ type: 'course', access: 'public,private-enroll,soon,view-locked', excludeNotEnrolledPrivateProductsForAdmin: 'true',
        hideProductsWithoutVisibleOptions: 'true', fields: 'title,titleId,cohorts.packages,settings', offset: '0', itemsPerPage: '60', paginationType: 'offset' })
    });
    const j = await r.json();
    return { total: (j.pagination && j.pagination.totalItems) || (j.data || []).length,
      items: (j.data || []).map(c => ({ slug: c.titleId, title: c.title, label: (c.settings || {}).points, image: !!(c.settings || {}).image })) };
  });
  console.log('catalogue total:', cat.total);
  const bySlug = Object.fromEntries(cat.items.map(c => [c.slug, c]));
  for (const s of SLUGS) {
    const c = bySlug[s];
    let pageInfo = '';
    if (c) {
      const p2 = await browser.newPage();
      await p2.goto('https://f2fedtech.learnworlds.com/course/' + s, { waitUntil: 'load', timeout: 90000 }).catch(() => {});
      // The curriculum renders after load; wait for it (up to 15 s) so a slow page doesn't read as 0 lessons.
      await p2.waitForFunction(() => /Lesson \d+:|Knowledge check/.test(document.body.innerText), null, { timeout: 15000 }).catch(() => {});
      pageInfo = await p2.evaluate(() => {
        const t = document.body.innerText;
        return 'page ' + (document.title.slice(0, 50)) + ' | lessons listed: ' + (t.match(/Lesson \d+:/g) || []).length + (/Nina Red|Ultimate Training/.test(t) ? ' | OLD TEMPLATE TEXT' : '');
      }).catch(e => 'page error ' + e.message);
      await p2.close();
    }
    console.log((c ? 'OK   ' : 'MISSING ') + s + (c ? ` | ${c.label} | image ${c.image} | ${pageInfo}` : ''));
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
