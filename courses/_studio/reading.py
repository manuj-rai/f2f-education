"""Builds a *readable* F2F course (text lessons, no video) from courses/<slug>/content.json + courses/<slug>/lessons/*.md.

  python courses/_studio/reading.py <slug> [<slug> ...]          check + build everything
  python courses/_studio/reading.py <slug> --check               check only

Outputs in courses/<slug>/:
  upload/Lesson N - <title>.docx       one Word file per lesson -> LearnWorlds "Upload & convert" makes each an Ebook activity
  assessments/knowledge-check.xlsx     quiz import (Assessment builder -> Import questions -> From Excel)
  course-card.jpg                      1280 x 720 card image (same look as the video courses)
  learnworlds-setup.md                 everything to type into course settings

See READING_SCHEMA.md for the content format.
"""
import json, math, os, re, sys
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
COURSES = STUDIO.parent
CATEGORIES = {'fibre-fundamentals', 'technical-textiles', 'sustainable-textiles', 'apparel-production', 'fashion-design'}
ICONS = set((STUDIO / 'icons.txt').read_text(encoding='utf-8').split())
BLUE, INK, MUTED, TINT = '1B5FA8', '111111', '5B6472', 'EEF4FB'
WPM = 200          # reading speed used for lesson times


def nwords(s): return len(re.findall(r"[\w'’%-]+", s or ''))


def load(slug):
    d = COURSES / slug
    c = json.loads((d / 'content.json').read_text(encoding='utf-8'))
    for i, l in enumerate(c['lessons'], 1):
        l['n'] = i
        l['md'] = (d / 'lessons' / l['file']).read_text(encoding='utf-8')
        l['words'] = nwords(re.sub(r'[#>|*_-]', ' ', l['md']))
        l['minutes'] = max(2, math.ceil(l['words'] / WPM))
    return c


def label(c):
    total = sum(l['minutes'] for l in c['lessons']) + max(3, len(c['quiz']) // 2)
    return f"{int(5 * math.ceil(total / 5))} min · Reading"


# ---------------------------------------------------------------- check
def check(c):
    errs, warn = [], []
    def lim(name, val, mx, mn=0):
        n = nwords(val)
        if n > mx or n < mn: errs.append(f'{name}: {n} words (allowed {mn}-{mx})')
    lim('title', c['title'], 9, 2); lim('subtitle', c['subtitle'], 18, 5); lim('card_description', c['card_description'], 30, 10)
    lim('about', c['about'], 110, 60); lim('audience', c['audience'], 30, 5); lim('card_topic', c['card_topic'], 3, 1)
    if len(c.get('seo_description', '')) > 155 or len(c.get('seo_description', '')) < 60:
        errs.append(f"seo_description: {len(c.get('seo_description', ''))} chars (allowed 60-155)")
    if c['card_icon'] not in ICONS: errs.append(f"card_icon '{c['card_icon']}' is not in icons.txt")
    bad = [x for x in c['categories'] if x not in CATEGORIES]
    if bad or not c['categories']: errs.append(f'categories must be from {sorted(CATEGORIES)}; got {c["categories"]}')
    if not 4 <= len(c['outcomes']) <= 5: errs.append('outcomes: need 4-5')
    for o in c['outcomes']: lim('outcome "%s…"' % o[:30], o, 14, 4)
    for k in ('title', 'url', 'authors', 'published'):
        if not c['source'].get(k): errs.append(f'source.{k} missing')
    micro = c.get('micro', False)
    if not (2 if micro else 3) <= len(c['lessons']) <= 5: errs.append('lessons: need 3-5 (2-3 for a micro course)')
    for l in c['lessons']:
        lim(f'lesson {l["n"]} title', l['title'], 7, 2)
        first = l['md'].lstrip().split('\n', 1)[0]
        if first != '# ' + l['title']: errs.append(f'lesson {l["n"]}: first line must be "# {l["title"]}", got "{first}"')
        lo, hi = (250, 1000) if micro else (400, 1000)
        if not lo <= l['words'] <= hi: errs.append(f'lesson {l["n"]}: {l["words"]} words (allowed {lo}-{hi})')
        if '## Key takeaways' not in l['md']: errs.append(f'lesson {l["n"]}: missing "## Key takeaways"')
        for ln in l['md'].split('\n'):
            if re.match(r'^\s{2,}[-*\d]', ln): errs.append(f'lesson {l["n"]}: nested list not supported: {ln.strip()[:40]}')
            if re.match(r'^#{4,}', ln): errs.append(f'lesson {l["n"]}: use only #, ## and ###: {ln[:40]}')
            if '![' in ln: errs.append(f'lesson {l["n"]}: images are not supported in lessons')
    q = c['quiz']
    if not (5 if micro else 8) <= len(q) <= 10: errs.append('quiz: need 8-10 questions (5-6 for a micro course)')
    for i, x in enumerate(q, 1):
        lim(f'quiz {i} q', x['q'], 30, 4); lim(f'quiz {i} feedback', x['feedback'], 30, 4)
        if x['type'] == 'mc':
            if len(x['options']) != 4 or not 0 <= x['answer'] < 4: errs.append(f'quiz {i}: mc needs 4 options and answer 0-3')
        elif x['type'] == 'ma':
            if not 4 <= len(x['options']) <= 5 or not x['answers']: errs.append(f'quiz {i}: ma needs 4-5 options and answers')
        elif x['type'] == 'tf':
            if not isinstance(x['answer'], bool): errs.append(f'quiz {i}: tf answer must be true/false')
        else: errs.append(f'quiz {i}: unknown type {x["type"]}')
        for o in x.get('options', []): lim(f'quiz {i} option', o, 14, 1)
    pos = [x['answer'] for x in q if x['type'] == 'mc']
    if pos and max(pos.count(p) for p in set(pos)) > math.ceil(len(pos) / 2): warn.append('quiz: correct answers bunch on one position')
    if not 5 <= len(c['glossary']) <= 10: errs.append('glossary: need 5-10 terms')
    for g in c['glossary']: lim(f'glossary {g["term"]}', g['def'], 25, 3)
    return errs, warn


# ---------------------------------------------------------------- markdown -> docx
def parse_md(md):
    """Returns blocks: ('h1'|'h2'|'h3'|'p'|'note', text) | ('ul'|'ol', [items]) | ('table', [rows])."""
    blocks, lines, i = [], md.strip().split('\n'), 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln.strip(): i += 1; continue
        m = re.match(r'^(#{1,3}) (.*)', ln)
        if m: blocks.append(('h%d' % len(m.group(1)), m.group(2).strip())); i += 1; continue
        if ln.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [x.strip() for x in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{2,}:?', x) for x in cells): rows.append(cells)
                i += 1
            blocks.append(('table', rows)); continue
        if re.match(r'^[-*] ', ln) or re.match(r'^\d+[.)] ', ln):
            kind = 'ul' if re.match(r'^[-*] ', ln) else 'ol'; items = []
            while i < len(lines) and (re.match(r'^[-*] ', lines[i]) if kind == 'ul' else re.match(r'^\d+[.)] ', lines[i])):
                items.append(re.sub(r'^([-*]|\d+[.)]) ', '', lines[i]).strip()); i += 1
            blocks.append((kind, items)); continue
        if ln.startswith('>'):
            buf = []
            while i < len(lines) and lines[i].startswith('>'): buf.append(lines[i].lstrip('>').strip()); i += 1
            blocks.append(('note', ' '.join(buf))); continue
        buf = []
        while i < len(lines) and lines[i].strip() and not re.match(r'^(#{1,3} |\||[-*] |\d+[.)] |>)', lines[i]):
            buf.append(lines[i].strip()); i += 1
        blocks.append(('p', ' '.join(buf)))
    return blocks


def add_runs(par, text, size=None, color=None, italic=False):
    from docx.shared import Pt, RGBColor
    for part in re.split(r'(\*\*[^*]+\*\*|\*[^*]+\*)', text):
        if not part: continue
        bold = part.startswith('**'); it = (not bold) and part.startswith('*') and len(part) > 2
        r = par.add_run(part.strip('*') if (bold or it) else part)
        r.bold = bold or None; r.italic = (it or italic) or None
        if size: r.font.size = Pt(size)
        if color: r.font.color.rgb = RGBColor.from_string(color)


def shade(cell, hexcolor):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), hexcolor); tcPr.append(sh)


def add_link(par, url, text):
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    rid = par.part.relate_to(url, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', is_external=True)
    h = OxmlElement('w:hyperlink'); h.set(qn('r:id'), rid)
    r = OxmlElement('w:r'); rpr = OxmlElement('w:rPr')
    col = OxmlElement('w:color'); col.set(qn('w:val'), BLUE); rpr.append(col)
    u = OxmlElement('w:u'); u.set(qn('w:val'), 'single'); rpr.append(u)
    r.append(rpr); t = OxmlElement('w:t'); t.text = text; r.append(t); h.append(r); par._p.append(h)


def lesson_docx(c, l, out):
    from docx import Document
    from docx.shared import Pt, RGBColor, Cm
    doc = Document()
    sec = doc.sections[0]; sec.left_margin = sec.right_margin = Cm(2.2)
    st = doc.styles['Normal']; st.font.name = 'Inter'; st.font.size = Pt(11); st.font.color.rgb = RGBColor.from_string(INK)
    st.paragraph_format.space_after = Pt(8); st.paragraph_format.line_spacing = 1.25
    for name, size in (('Heading 1', 22), ('Heading 2', 15), ('Heading 3', 12.5)):
        h = doc.styles[name]; h.font.name = 'Inter'; h.font.size = Pt(size); h.font.bold = True
        h.font.color.rgb = RGBColor.from_string(INK if name != 'Heading 3' else BLUE)
        h.paragraph_format.space_before = Pt(18 if name != 'Heading 1' else 0); h.paragraph_format.space_after = Pt(6)
    kick = doc.add_paragraph(); add_runs(kick, f"LESSON {l['n']} OF {len(c['lessons'])}  ·  {l['minutes']} MIN READ", size=9, color=BLUE)
    for kind, val in parse_md(l['md']):
        if kind in ('h1', 'h2', 'h3'):
            add_runs(doc.add_heading('', level=int(kind[1])), val)
        elif kind == 'p':
            add_runs(doc.add_paragraph(), val)
        elif kind in ('ul', 'ol'):
            for it in val: add_runs(doc.add_paragraph(style='List Bullet' if kind == 'ul' else 'List Number'), it)
        elif kind == 'note':
            t = doc.add_table(rows=1, cols=1); cell = t.rows[0].cells[0]; shade(cell, TINT)
            p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(4); add_runs(p, val)
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
        elif kind == 'table':
            t = doc.add_table(rows=len(val), cols=max(len(r) for r in val)); t.style = 'Table Grid'
            for ri, row in enumerate(val):
                for ci, txt in enumerate(row):
                    cell = t.rows[ri].cells[ci]; p = cell.paragraphs[0]; p.paragraph_format.space_after = Pt(2)
                    add_runs(p, f'**{txt}**' if ri == 0 and '**' not in txt else txt, size=10)
                    if ri == 0: shade(cell, TINT)
            doc.add_paragraph().paragraph_format.space_after = Pt(0)
    if l['n'] == len(c['lessons']):
        doc.add_heading('Key terms', level=2)
        for g in c['glossary']: add_runs(doc.add_paragraph(style='List Bullet'), f"**{g['term']}**: {g['def']}")
        doc.add_heading('What next', level=2)
        add_runs(doc.add_paragraph(), 'Take the short **knowledge check** in the next section. Score 70% or more to earn your certificate of completion.')
    s, s2 = c['source'], c.get('source2')
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(20)
    if s2:
        add_runs(p, f"Source: this lesson is based on the Fibre2Fashion articles “{s['title']}” ({s['published']}) and “{s2['title']}” ({s2['published']}) by {s['authors']}. ", size=9, color=MUTED, italic=True)
        add_link(p, s['url'], 'Read article 1'); add_runs(p, '  ·  ', size=9, color=MUTED); add_link(p, s2['url'], 'Read article 2')
    else:
        add_runs(p, f"Source: this lesson is based on the Fibre2Fashion article “{s['title']}” by {s['authors']} ({s['published']}). ", size=9, color=MUTED, italic=True)
        add_link(p, s['url'], 'Read the original article')
    out.parent.mkdir(parents=True, exist_ok=True); doc.save(out)


def safe_name(s):
    return re.sub(r'\s+', ' ', re.sub(r"[^A-Za-z0-9 ,()-]", '', s.replace('&', 'and').replace(':', ' -'))).strip()


# ---------------------------------------------------------------- setup notes
def setup_md(c):
    s = c['source']
    L = [f"# {c['title']} – LearnWorlds setup", '',
         'Readable course: each lesson is a Word file in `upload/` that **Upload & convert** turns into an Ebook activity.', '',
         '| Setting | Value |', '|---|---|',
         f"| Course title | {c['title']} |", f"| URL slug | {c['slug']} |",
         f"| Card description | {c['card_description']} |", f"| Label | {label(c)} |",
         f"| Author | {c['author_name']} |", f"| Categories | {', '.join(c['categories'])} |", f"| Level | {c['level']} |",
         f"| SEO description | {c['seo_description']} |", '| Pricing | Free (Public) |', '| Course image | course-card.jpg |', '',
         '## Course page', '', f"**{c['subtitle']}**", '', c['about'], '', f"**Who it is for:** {c['audience']}", '', '**You will learn to:**']
    L += [f'- {o}' for o in c['outcomes']]
    s2 = c.get('source2')
    src = (f"**Source:** this course is based on the Fibre2Fashion articles [{s['title']}]({s['url']}) ({s['published']}) and "
           f"[{s2['title']}]({s2['url']}) ({s2['published']}) by {s['authors']}." if s2 else
           f"**Source:** this course is based on the Fibre2Fashion article [{s['title']}]({s['url']}) by {s['authors']} ({s['published']}).")
    L += ['', src, '',
          '## Outline', '', '**Section 1: Lessons** (Public)', '']
    L += [f"- Lesson {l['n']}: {l['title']} — Ebook, {l['minutes']} min read (`upload/{docx_name(l)}`)" for l in c['lessons']]
    L += ['', '**Section 2: Knowledge check and certificate** (Public)', '',
          f"- Exam “Knowledge check”: import `assessments/knowledge-check.xlsx` ({len(c['quiz'])} questions), pass mark 70 %",
          '- Certificate of completion (requirement: complete all exams)', '']
    return '\n'.join(L)


def docx_name(l): return f"Lesson {l['n']} - {safe_name(l['title'])}.docx"


# ---------------------------------------------------------------- main
def build(slug, check_only=False):
    c = load(slug); errs, warn = check(c)
    for w in warn: print(f'  [{slug}] warning: {w}')
    if errs:
        for e in errs: print(f'  [{slug}] ERROR: {e}')
        return False
    total = sum(l['words'] for l in c['lessons'])
    print(f"[{slug}] ok: {len(c['lessons'])} lessons, {total} words, {len(c['quiz'])} questions, label '{label(c)}'")
    if check_only: return True
    d = COURSES / slug
    for old in (d / 'upload').glob('*.docx') if (d / 'upload').exists() else []: old.unlink()
    for l in c['lessons']: lesson_docx(c, l, d / 'upload' / docx_name(l))
    sys.path.insert(0, str(STUDIO)); import lw_quiz
    lw_quiz.write(lw_quiz.rows_from_quiz(c['quiz'], 'Knowledge check'), d / 'assessments' / 'knowledge-check.xlsx')
    (d / 'learnworlds-setup.md').write_text(setup_md(c), encoding='utf-8')
    if '--no-card' not in sys.argv:
        import card; card.render(d / 'course-card.jpg', c['card_icon'], c['card_topic'])
    print(f'[{slug}] built: upload/*.docx, assessments/knowledge-check.xlsx, learnworlds-setup.md, course-card.jpg')
    return True


if __name__ == '__main__':
    slugs = [a for a in sys.argv[1:] if not a.startswith('--')]
    ok = all([build(s, '--check' in sys.argv) for s in slugs])
    sys.exit(0 if ok else 1)
