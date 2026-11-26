"""Builds the learner-facing lessons and unit quizzes of the Staple Yarn Spinning course (a hand-written module, not
an article-based readable course, so it has its own small build instead of reading.py).

  python courses/staple-yarn-spinning/learner/build.py [--check]

  learner/NN-*.md        -> upload/<Activity title>.docx   (Upload & convert in LearnWorlds makes each an Ebook)
  learner/quizzes.json   -> assessments/unitN-knowledge-check.xlsx   (Import questions -> From Excel)

Lesson Markdown uses the readable-course subset (see courses/_studio/READING_SCHEMA.md); the Markdown/Word helpers come
from reading.py so the lessons look like the other F2F readable courses.
"""
import json, math, re, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
COURSE = HERE.parent
STUDIO = COURSE.parent / '_studio'
sys.path.insert(0, str(STUDIO))
import reading, lw_quiz  # noqa: E402

TITLE = 'Staple Yarn Spinning – From Fibre to Yarn'
# file -> (kicker, Word file name; the LearnWorlds activity is renamed after upload)
LESSONS = [
    ('00-welcome.md', 'COURSE OVERVIEW', 'Welcome and course overview'),
    ('01-unit-1.md', 'UNIT 1 OF 4', 'Unit 1 reading - What is a staple yarn'),
    ('02-unit-2.md', 'UNIT 2 OF 4', 'Unit 2 reading - How spinning works'),
    ('03-unit-3.md', 'UNIT 3 OF 4', 'Unit 3 reading - Quality, specification and cost'),
    ('04-unit-4.md', 'UNIT 4 OF 4', 'Unit 4 reading - Design, blending and sustainability'),
    ('05-assignment.md', 'APPLIED ASSIGNMENT', 'Live panel and applied assignment brief'),
]


def check(md, name):
    errs = []
    for ln in md.split('\n'):
        if re.match(r'^\s{2,}[-*\d]', ln): errs.append(f'{name}: nested list: {ln.strip()[:40]}')
        if re.match(r'^#{4,}', ln): errs.append(f'{name}: only #, ## and ### headings: {ln[:40]}')
        if '![' in ln or '](' in ln: errs.append(f'{name}: no images or links: {ln[:40]}')
        if ln.startswith('|') and ln.count('|') - 1 > 4: errs.append(f'{name}: tables have at most 4 columns: {ln[:40]}')
    if '## Key takeaways' not in md: errs.append(f'{name}: missing "## Key takeaways"')
    return errs


def lesson_docx(md, kicker, out):
    from docx import Document
    from docx.shared import Pt, RGBColor, Cm
    words = reading.nwords(re.sub(r'[#>|*_-]', ' ', md))
    minutes = max(2, math.ceil(words / reading.WPM))
    doc = Document()
    sec = doc.sections[0]; sec.left_margin = sec.right_margin = Cm(2.2)
    st = doc.styles['Normal']; st.font.name = 'Inter'; st.font.size = Pt(11); st.font.color.rgb = RGBColor.from_string(reading.INK)
    st.paragraph_format.space_after = Pt(8); st.paragraph_format.line_spacing = 1.25
    for name, size in (('Heading 1', 22), ('Heading 2', 15), ('Heading 3', 12.5)):
        h = doc.styles[name]; h.font.name = 'Inter'; h.font.size = Pt(size); h.font.bold = True
        h.font.color.rgb = RGBColor.from_string(reading.INK if name != 'Heading 3' else reading.BLUE)
        h.paragraph_format.space_before = Pt(18 if name != 'Heading 1' else 0); h.paragraph_format.space_after = Pt(6)
    reading.add_runs(doc.add_paragraph(), f'{kicker}  ·  {minutes} MIN READ', size=9, color=reading.BLUE)
    for kind, val in reading.parse_md(md):
        if kind in ('h1', 'h2', 'h3'):
            reading.add_runs(doc.add_heading('', level=int(kind[1])), val)
        elif kind == 'p':
            reading.add_runs(doc.add_paragraph(), val)
        elif kind in ('ul', 'ol'):
            for it in val: reading.add_runs(doc.add_paragraph(style='List Bullet' if kind == 'ul' else 'List Number'), it)
        elif kind == 'note':
            t = doc.add_table(rows=1, cols=1); cell = t.rows[0].cells[0]; reading.shade(cell, reading.TINT)
            p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(4); reading.add_runs(p, val)
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
        elif kind == 'table':
            t = doc.add_table(rows=len(val), cols=max(len(r) for r in val)); t.style = 'Table Grid'
            for ri, row in enumerate(val):
                for ci, txt in enumerate(row):
                    cell = t.rows[ri].cells[ci]; p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
                    reading.add_runs(p, f'**{txt}**' if ri == 0 and '**' not in txt else txt, size=10)
                    if ri == 0: reading.shade(cell, reading.TINT)
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(20)
    reading.add_runs(p, f'F2F Education  ·  {TITLE}', size=9, color=reading.MUTED, italic=True)
    out.parent.mkdir(parents=True, exist_ok=True); doc.save(out)
    return words, minutes


def check_quiz(qs, name):
    errs = []
    for i, x in enumerate(qs, 1):
        if x['type'] == 'mc' and (len(x['options']) != 4 or not 0 <= x['answer'] < 4): errs.append(f'{name} q{i}: mc needs 4 options')
        if x['type'] == 'ma' and not x.get('answers'): errs.append(f'{name} q{i}: ma needs answers')
        if x['type'] == 'tf' and not isinstance(x['answer'], bool): errs.append(f'{name} q{i}: tf answer must be true/false')
        if not x.get('feedback'): errs.append(f'{name} q{i}: feedback missing')
    return errs


def main():
    only_check = '--check' in sys.argv
    errs = []
    mds = {f: (HERE / f).read_text(encoding='utf-8') for f, _, _ in LESSONS}
    for f, md in mds.items(): errs += check(md, f)
    quizzes = json.loads((HERE / 'quizzes.json').read_text(encoding='utf-8'))
    for k, q in quizzes.items(): errs += check_quiz(q['questions'], k)
    for e in errs: print('ERROR', e)
    if errs: sys.exit(1)
    if only_check: print('ok'); return
    up = COURSE / 'upload'
    for old in up.glob('*.docx') if up.exists() else []: old.unlink()
    for f, kicker, name in LESSONS:
        w, m = lesson_docx(mds[f], kicker, up / f'{name}.docx')
        print(f'{name}.docx: {w} words, {m} min')
    for k, q in quizzes.items():
        out = COURSE / 'assessments' / f'{k}-knowledge-check.xlsx'
        lw_quiz.write(lw_quiz.rows_from_quiz(q['questions'], q['title']), out)
        print(out.name, len(q['questions']), 'questions')


if __name__ == '__main__':
    main()
