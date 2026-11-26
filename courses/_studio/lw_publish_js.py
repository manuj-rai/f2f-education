"""Writes the Playwright scripts that put a built *readable* course into LearnWorlds (f2fedtech.learnworlds.com).

  python courses/_studio/lw_publish_js.py <slug> ["Author name" [<avatar.png>]] [--existing]

  --existing: the course is already in LearnWorlds (e.g. a Coming-soon course with no lessons). Script 1 skips the
  create-course wizard and opens that course's outline instead. Leave out the avatar to keep the one it has.

  With no author given, the course gets "Fibre2Fashion Education" with
  courses/_universities/fibre2fashion-education.png. AMFI: "AMFI (Amsterdam Fashion Institute)" courses/_universities/amfi.png.

-> .scratch/lw/<slug>-1-create.js    create course (wizard, Staple Yarn page layout), Upload & convert the .docx lessons,
                                     section "Lessons" (Public), "Lesson N: Title" names, section 2, blank exam -> exam editor
   .scratch/lw/<slug>-2-quiz.js      import knowledge-check.xlsx, pass mark 70 %, certificate of completion
   .scratch/lw/<slug>-3-settings.js  card description, label, author + avatar, category, SEO, card image, Free pricing, Public

Run each with the Playwright MCP tool browser_run_code_unsafe (filename=...), in order, in the signed-in admin browser.
Each returns a short log; if one throws, finish that step by hand and carry on with the next script.
"""
import json, sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
ROOT = STUDIO.parent.parent
sys.path.insert(0, str(STUDIO))
import reading  # noqa: E402

HELPERS = r"""
const cw = () => page.frames().find(f => f.name().startsWith('contentWindow_'));
const wait = ms => page.waitForTimeout(ms);
const log = [];
"""

P1 = r"""async (page) => {
const C = __C__;
__H__
//<wizard>
await page.goto('https://f2fedtech.learnworlds.com/author/courses', { waitUntil: 'domcontentloaded' });
await wait(6000);
await cw().getByTestId('course-manager--topbar-create-course').click(); await wait(2000);
await page.getByTestId('course-builder-option--build').click(); await wait(2000);
await page.getByTestId('course-wizard--basic-info--title').getByRole('textbox').fill(C.title);
await page.getByTestId('course-wizard--basic-info--description').getByRole('textbox').fill(C.card_description);
await page.getByRole('button', { name: 'Continue' }).last().click(); await wait(2500);
await page.getByRole('textbox', { name: 'type your slug' }).fill(C.slug); await wait(1500);
await page.getByRole('button', { name: 'Continue' }).last().click(); await wait(2500);   // -> access (Draft)
await page.getByRole('button', { name: 'Continue' }).last().click(); await wait(2500);   // -> page template
await page.getByTestId('course-wizard--page-template--layout-option-custom-wrapper').click(); await wait(800);
await page.getByTestId('course-wizard--page-template--page').locator('select').selectOption('staple-yarn-spinning'); await wait(600);
await page.getByRole('button', { name: 'Finish' }).click();
await page.waitForURL(u => String(u).includes('courseid=' + C.slug), { timeout: 60000 }); await wait(7000);
log.push('created ' + page.url());
//</wizard>
let fr = cw();
await fr.getByText('Upload & convert', { exact: true }).click(); await wait(2000);
await fr.locator('[role=dialog] input[type=file]').first().setInputFiles(C.files); await wait(2500);
await fr.locator('[role=dialog]').getByRole('button', { name: 'Upload', exact: true }).click();
await fr.waitForFunction(n => document.querySelectorAll('.chapter-cont-name').length >= n && !/Processing\.\.\./.test(document.body.innerText), C.files.length, { timeout: 240000, polling: 3000 });
await wait(2500);
log.push('uploaded ' + (await fr.locator('.chapter-cont-name').count()) + ' activities');
await fr.getByRole('button', { name: 'Close' }).last().click().catch(() => {});
// section 1
await fr.getByText('Unnamed section', { exact: true }).first().click(); await wait(1500);
await fr.getByTestId('course-content-authoring--section-form--title').fill('Lessons');
await fr.locator('label[for="courseChapterAccessPremium"]:visible').first().click(); await wait(400);
await fr.getByTestId('course-content-authoring--edit-form--save-button').click(); await wait(2500);
// activity names "Lesson N: Title" (upload order = file order)
const names = await fr.evaluate(() => [...document.querySelectorAll('.chapter-cont-name')].map(e => e.innerText.trim()));
for (let i = 0; i < C.lessonTitles.length; i++) {
  const idx = names.findIndex(n => n.startsWith('Lesson ' + (i + 1) + ' - '));
  if (idx < 0) { log.push('no activity for lesson ' + (i + 1)); continue; }
  const li = fr.locator('.chapter-cont-name').nth(idx).locator('xpath=ancestor::li[1]');
  await li.hover(); await wait(600);
  await li.locator('a[title="Settings"]').evaluate(a => a.click()); await wait(1800);
  await fr.locator('input[type=text]:visible').first().fill(C.lessonTitles[i]);
  await fr.locator('div:visible', { hasText: /^Save$/ }).last().click(); await wait(2200);
}
log.push('names: ' + (await fr.evaluate(() => [...document.querySelectorAll('.chapter-cont-name')].map(e => e.innerText.trim()).join(' | '))));
// section 2 + exam
await fr.getByRole('button', { name: 'Add section icon Add section' }).click(); await wait(1800);
await fr.getByTestId('course-content-authoring--section-form--title').fill('Knowledge check and certificate');
await fr.locator('label[for="courseChapterAccessPremium"]:visible').first().click(); await wait(400);
await fr.getByTestId('course-content-authoring--edit-form--save-button').click(); await wait(2500);
log.push('sections: ' + (await fr.evaluate(() => document.body.innerText.includes('Draft\nLessons') ? 'LESSONS STILL DRAFT' : 'ok')));
await fr.getByRole('button', { name: 'Add activity' }).nth(1).click(); await wait(1800);
const dlg = fr.getByRole('dialog', { name: 'Add learning activity' });
await dlg.getByText('Exams', { exact: true }).click(); await wait(1000);
await dlg.getByRole('heading', { name: 'Blank exam' }).click(); await wait(2000);
const se = fr.getByRole('button', { name: 'Save & Edit' });
await se.locator('xpath=ancestor::*[6]').locator('[contenteditable=true]').first().click();
await page.keyboard.type('Knowledge check'); await wait(400);
await se.click();
await page.waitForURL(/assessmenteditor/, { timeout: 60000 }); await wait(4000);
log.push('exam editor open');
return log.join('\n');
}"""

P2 = r"""async (page) => {
const C = __C__;
__H__
if (!page.url().includes('assessmenteditor')) throw new Error('open the exam editor first (script 1 ends there)');
let fr = cw();
await fr.getByText('Add/Import', { exact: true }).first().click(); await wait(1000);
await fr.getByTestId('Import questions').click(); await wait(1500);
await fr.getByRole('button', { name: 'From Excel' }).click(); await wait(1000);
const dlg = fr.getByRole('dialog', { name: 'Import questions' });
await dlg.locator('input[type=file]').first().setInputFiles(C.xlsx); await wait(3500);
const lbl = dlg.locator('label[for="undefined_ass_dropdown_checkbox"]').first();
await lbl.scrollIntoViewIfNeeded(); const b = await lbl.boundingBox();
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); await wait(600);
const checked = await dlg.locator('input.checkmark-checkbox').evaluateAll(xs => xs.filter(x => x.checked).length);
log.push('checked ' + checked);
await dlg.getByRole('button', { name: 'Import', exact: true }).click(); await wait(3000);
const proceed = fr.getByRole('button', { name: 'Proceed' });
if (await proceed.count()) { await proceed.first().click(); await wait(3000); }
log.push('questions: ' + (await fr.evaluate(() => (document.body.innerText.match(/\n\d+\n/g) || []).length)));
await fr.getByText('Settings', { exact: true }).first().click(); await wait(1500);
await fr.getByText('Grade & Attempts', { exact: true }).first().click(); await wait(1200);
const pass = fr.locator('input[type=number]:visible').first();
await pass.fill('70'); await pass.press('Tab'); await wait(400);
await fr.locator('[to="lw-modal-outlet"]').getByRole('button', { name: 'Save & Close' }).click(); await wait(2000);
await fr.getByRole('button', { name: 'Save', exact: true }).first().click(); await wait(3000);
log.push((await fr.evaluate(() => document.body.innerText.match(/[^\n]*saved[^\n]*/i)?.[0])) || 'exam save: no message');
await page.goto('https://f2fedtech.learnworlds.com/author/course?courseid=' + C.slug + '&tab=contents', { waitUntil: 'domcontentloaded' });
await wait(6000); fr = cw();
await fr.getByRole('button', { name: 'Add activity' }).nth(1).click(); await wait(1500);
const ad = fr.getByRole('dialog', { name: 'Add learning activity' });
await ad.getByText('Certificates', { exact: true }).click(); await wait(1000);
await ad.getByRole('heading', { name: 'Certificate of completion' }).click(); await wait(2000);
const sv = fr.getByRole('button', { name: 'Save', exact: true });
await sv.locator('xpath=ancestor::*[6]').locator('[contenteditable=true]').first().click();
await page.keyboard.type('Certificate of completion'); await wait(300);
await sv.click(); await wait(3000);
log.push('outline: ' + (await fr.evaluate(() => [...document.querySelectorAll('.chapter-cont-name')].map(e => e.innerText.trim()).join(' | '))));
return log.join('\n');
}"""

P3 = r"""async (page) => {
const C = __C__;
__H__
const base = 'https://f2fedtech.learnworlds.com/author/course?courseid=' + C.slug + '&tab=';
await page.goto(base + 'settings', { waitUntil: 'domcontentloaded' }); await wait(7000);
let fr = cw();
const desc = fr.getByText('Description', { exact: true }).locator('xpath=following::*[@contenteditable="true"][1]');
await desc.click(); await page.keyboard.press('Control+A'); await page.keyboard.type(C.card_description);
await fr.getByText('Add a label', { exact: true }).locator('xpath=following::input[1]').fill(C.label);
await fr.getByText("Author's name", { exact: true }).locator('xpath=following::input[1]').fill(C.author);
// the box loses its 'Enter category name' label once a category is in, so fall back to its class
const cat = fr.getByRole('textbox', { name: 'Enter category name' }).or(fr.locator('input.authoring-multiselect__input')).first();
// Category tags save as soon as they are added, so skip ones already there (keeps a re-run from adding duplicates).
const haveCats = await fr.getByText('Categories', { exact: true }).locator('xpath=..').evaluate(e => e.parentElement.innerText);
for (const c of C.categories) { if (haveCats.split(/\s+/).includes(c)) continue; await cat.click(); await cat.fill(c); await wait(800); await cat.press('Enter'); await wait(800); }
if (await fr.locator('#defaultSEO').isChecked()) { await fr.locator('label[for="defaultSEO"]').click(); await wait(800); }
const ces = fr.locator('[contenteditable=true]:visible');
await ces.nth((await ces.count()) - 1).click(); await page.keyboard.press('Control+A'); await page.keyboard.type(C.seo); await wait(400);
await fr.getByRole('button', { name: 'Save', exact: true }).first().click(); await wait(3000);
// card image
const ci = fr.getByRole('button', { name: 'Choose image' });
await ci.first().click(); await wait(3500);
let sm = page.frames().find(f => f.name() === 'simplemodal-data');
await sm.locator('input[type=file]').first().setInputFiles(C.card); await wait(2500);
await sm.getByRole('button', { name: 'Upload 1 file' }).click();
await sm.waitForFunction(() => document.querySelector('img.cropper-hidden')?.cropper, null, { timeout: 60000 }); await wait(1000);
await sm.evaluate(() => { const i = document.querySelector('img.cropper-hidden'); i.cropper.setData({ x: 0, y: 0, width: i.naturalWidth, height: i.naturalHeight }); });
await sm.getByText('Insert Image').first().click(); await wait(3500);
log.push('card image inserted');
// author avatar
if (C.avatar) {
  fr = cw();
  await fr.getByText("Author's avatar", { exact: true }).locator('xpath=following::*[contains(@class,"btn") and contains(@class,"image")][1]').first().click(); await wait(3500);
  let up = null;
  for (const f of page.frames().filter(f => f.name() === 'autoolsiframe')) { const t = await f.evaluate(() => document.body.innerText).catch(() => ''); if (/Drop files|browse/i.test(t)) up = f; }
  if (!up) throw new Error('avatar upload dialog not found');
  await up.locator('input[type=file]').first().setInputFiles(C.avatar); await wait(2000);
  await up.getByRole('button', { name: 'Upload 1 file' }).click();
  await up.waitForFunction(() => document.querySelector('img.cropper-hidden')?.cropper, null, { timeout: 60000 }); await wait(800);
  await up.evaluate(() => { const i = document.querySelector('img.cropper-hidden'); const s = Math.min(i.naturalWidth, i.naturalHeight); i.cropper.setData({ x: 0, y: 0, width: s, height: s }); });
  await up.getByText('Insert Image').first().click(); await wait(3000);
  log.push('avatar inserted');
}
fr = cw();
await fr.getByRole('button', { name: 'Save', exact: true }).first().click(); await wait(2500);
await fr.getByRole('button', { name: 'Save', exact: true }).first().click(); await wait(2500);
// pricing: Free, Public
await page.goto(base + 'pricing', { waitUntil: 'domcontentloaded' }); await wait(6000); fr = cw();
if (!(await fr.evaluate(() => /Free access/.test(document.body.innerText)))) {
  await fr.getByText('Add pricing option', { exact: true }).first().click(); await wait(2000);
  await fr.locator('select:has(option[value="free"])').last().selectOption('free'); await wait(1000);
  const pid = await fr.locator('input[type=radio][value=public]').last().getAttribute('id');
  await fr.locator(`label[for="${pid}"]`).first().click(); await wait(500);
  await fr.getByRole('button', { name: 'Add', exact: true }).last().click(); await wait(3000);
  await fr.getByRole('button', { name: 'OK' }).first().click().catch(() => {});
}
log.push('pricing: ' + (await fr.evaluate(() => /Free access\s*Public/.test(document.body.innerText) ? 'Free access, Public' : 'CHECK PRICING')));
// access: Public
await page.goto(base + 'access', { waitUntil: 'domcontentloaded' }); await wait(6000); fr = cw();
await fr.locator('label[for="courseAccessPublic"]').first().click(); await wait(800);
log.push('access public: ' + (await fr.locator('#courseAccessPublic').isChecked()));
await fr.getByRole('button', { name: 'Save', exact: true }).first().click(); await wait(3000);
// verify general settings
await page.goto(base + 'settings', { waitUntil: 'domcontentloaded' }); await wait(7000); fr = cw();
const v = {
  label: await fr.getByText('Add a label', { exact: true }).locator('xpath=following::input[1]').inputValue(),
  author: await fr.getByText("Author's name", { exact: true }).locator('xpath=following::input[1]').inputValue(),
  seoAuto: await fr.locator('#defaultSEO').isChecked(),
  cats: await fr.getByText('Categories', { exact: true }).locator('xpath=..').evaluate(e => e.parentElement.innerText.replace(/\s+/g, ' ').slice(0, 120)),
};
log.push('verify: ' + JSON.stringify(v));
return log.join('\n');
}"""


def main():
    existing = '--existing' in sys.argv
    argv = [a for a in sys.argv if a != '--existing']
    slug = argv[1]
    author = argv[2] if len(argv) > 2 else 'Fibre2Fashion Education'
    avatar = argv[3] if len(argv) > 3 else (STUDIO.parent / '_universities' / 'fibre2fashion-education.png' if author == 'Fibre2Fashion Education' else None)
    avatar = str(Path(avatar).resolve()).replace('\\', '/') if avatar else None
    c = reading.load(slug)
    d = (STUDIO.parent / slug).resolve()
    C = {
        'slug': slug, 'title': c['title'], 'card_description': c['card_description'], 'seo': c['seo_description'],
        'label': reading.label(c), 'author': author or c['author_name'], 'avatar': avatar, 'categories': c['categories'],
        'files': [str(d / 'upload' / reading.docx_name(l)).replace('\\', '/') for l in c['lessons']],
        'lessonTitles': [f"Lesson {l['n']}: {l['title']}" for l in c['lessons']],
        'xlsx': str(d / 'assessments' / 'knowledge-check.xlsx').replace('\\', '/'),
        'card': str(d / 'course-card.jpg').replace('\\', '/'),
    }
    for f in C['files'] + [C['xlsx'], C['card']] + ([avatar] if avatar else []):
        if not Path(f).exists(): sys.exit(f'missing {f}; build the course first')
    out = ROOT / '.scratch' / 'lw'; out.mkdir(parents=True, exist_ok=True)
    cj = json.dumps(C, ensure_ascii=False, indent=1)
    p1 = P1
    if existing:   # course already exists: open its outline instead of running the wizard
        a, b = p1.index('//<wizard>'), p1.index('//</wizard>') + len('//</wizard>')
        p1 = p1[:a] + ("await page.goto('https://f2fedtech.learnworlds.com/author/course?courseid=' + C.slug + '&tab=contents', { waitUntil: 'domcontentloaded' });\n"
                       "await wait(8000);\nlog.push('opened existing course ' + page.url());") + p1[b:]
    for name, tpl in (('1-create', p1), ('2-quiz', P2), ('3-settings', P3)):
        p = out / f'{slug}-{name}.js'
        p.write_text(tpl.replace('__C__', cj).replace('__H__', HELPERS), encoding='utf-8')
        print(p.relative_to(ROOT).as_posix())


if __name__ == '__main__':
    main()
