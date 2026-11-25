"""Writes a LearnWorlds question-import Excel file from the "quiz" list in courses/<slug>/content.json.

  python courses/_studio/lw_quiz.py <slug>   ->  courses/<slug>/assessments/knowledge-check.xlsx

LearnWorlds rejects workbooks re-saved by openpyxl, so this copies lib/lw-question-base.xlsx (a file LearnWorlds
accepted) and only rewrites the XML of the "Questions" sheet (sheet3) and the shared-strings table.
Import in LearnWorlds: Assessment builder -> Add/Import -> Import questions -> From Excel.
"""
import json, re, sys, zipfile
from pathlib import Path
from xml.sax.saxutils import escape

STUDIO = Path(__file__).resolve().parent
BASE = STUDIO / 'lib' / 'lw-question-base.xlsx'
COLS = 'ABCDEFGHIJKLMNOP'          # Group, Type, Question, CorAns, Answer1-10 (E-N), CorrectExplanation (O), IncorrectExplanation (P)


def rows_from_quiz(quiz, group):
    rows = []
    for q in quiz:
        fb = q.get('feedback', '')
        ok, bad = 'Correct! ' + fb, 'Not quite. ' + fb
        if q['type'] == 'mc':
            rows.append([group, 'TMC', q['q'], str(q['answer'] + 1)] + q['options'] + [None] * (10 - len(q['options'])) + [ok, bad])
        elif q['type'] == 'ma':
            rows.append([group, 'TMCMA', q['q'], ','.join(str(i + 1) for i in q['answers'])] + q['options'] + [None] * (10 - len(q['options'])) + [ok, bad])
        elif q['type'] == 'tf':
            rows.append([group, 'TTF', q['q'], '1' if q['answer'] else '2', 'True', 'False'] + [None] * 8 + [ok, bad])
        else:
            raise ValueError('unsupported question type ' + q['type'])
    return rows


def write(rows, out):
    zin = zipfile.ZipFile(BASE)
    sst = zin.read('xl/sharedStrings.xml').decode('utf-8')
    sheet = zin.read('xl/worksheets/sheet3.xml').decode('utf-8')
    items = re.findall(r'<si>.*?</si>', sst, re.S)
    n0 = len(items); new = []; count = 0
    def sidx(text):
        nonlocal count
        count += 1
        new.append('<si><t xml:space="preserve">' + escape(text) + '</t></si>')
        return n0 + len(new) - 1
    body = []
    for r, row in enumerate(rows, start=2):
        cells = ''.join('<c r="%s%d" s="8" t="s"><v>%d</v></c>' % (COLS[i], r, sidx(str(v))) for i, v in enumerate(row) if v not in (None, ''))
        body.append('<row r="%d" spans="1:16">%s</row>' % (r, cells))
    header = re.search(r'<row r="1".*?</row>', sheet, re.S).group(0)
    sheet = re.sub(r'<sheetData>.*?</sheetData>', lambda m: '<sheetData>' + header + ''.join(body) + '</sheetData>', sheet, flags=re.S)
    sheet = re.sub(r'<dimension ref="[^"]*"/>', '<dimension ref="A1:P%d"/>' % (len(rows) + 1), sheet)
    old_count = int(re.search(r'count="(\d+)"', sst).group(1))
    sst = sst.replace('</sst>', ''.join(new) + '</sst>')
    sst = re.sub(r'count="\d+" uniqueCount="\d+"', 'count="%d" uniqueCount="%d"' % (old_count + count, n0 + len(new)), sst, count=1)
    Path(out).parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            if info.filename == 'xl/sharedStrings.xml': data = sst.encode('utf-8')
            elif info.filename == 'xl/worksheets/sheet3.xml': data = sheet.encode('utf-8')
            zout.writestr(info, data)
    return out


def main():
    slug = sys.argv[1]
    c = json.loads((STUDIO.parent / slug / 'content.json').read_text(encoding='utf-8'))
    out = write(rows_from_quiz(c['quiz'], 'Knowledge check'), STUDIO.parent / slug / 'assessments' / 'knowledge-check.xlsx')
    print('quiz', out, len(c['quiz']), 'questions')


if __name__ == '__main__':
    main()
