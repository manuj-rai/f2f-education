"""F2F Education course studio: content.json -> slide frames -> lesson videos, PDF guide, course card, LearnWorlds copy.

Usage (from anywhere):
  python courses/_studio/build.py <slug> [--lessons 1,2] [--frames] [--video] [--pdf] [--card] [--copy] [--all]
  --all = frames + video + pdf + card + copy (default when no step flag is given)

Needs: Google Chrome (headless, renders the slides), Microsoft PowerPoint (exports the MP4s), Python with Pillow + PyMuPDF.
Frames are written to %TEMP%/f2f-course-build/<slug>/ (regenerated on every build); outputs go to courses/<slug>/.
"""
import argparse, base64, concurrent.futures as cf, json, math, os, re, subprocess, sys, tempfile
from pathlib import Path

STUDIO = Path(__file__).resolve().parent
COURSES = STUDIO.parent
CHROME = os.environ.get('F2F_CHROME', r'C:\Program Files\Google\Chrome\Application\chrome.exe')
WORK = Path(os.environ.get('F2F_BUILD_DIR', Path(tempfile.gettempdir()) / 'f2f-course-build'))
ICONS = set((STUDIO / 'icons.txt').read_text(encoding='utf-8').split())
ONE_STEP = {'opener', 'cover', 'shift', 'statement', 'definition', 'reflect', 'closing', 'glossary'}


def url(p): return Path(p).resolve().as_uri()


def words(*parts):
    n = 0
    for p in parts:
        if isinstance(p, (list, tuple)): n += words(*p)
        elif isinstance(p, dict): n += words(*[v for k, v in p.items() if k not in ('icon', 'say', 'type', 'cols', 'numbered')])
        elif p: n += len(re.sub(r'\*\*', '', str(p)).split())
    return n


def chunks(s):
    """Text newly revealed at each step of a scene (list, one entry per step)."""
    t = s['type']
    head = [s.get('kicker'), s.get('title'), s.get('lead')]
    if t in ONE_STEP: return [words(s)]
    if t in ('cards', 'list', 'recap', 'stats', 'formula'):
        it = s.get('items', []); c = [words(x) for x in it] or [0]
        c[0] += words(head)
        if s.get('note'): c[-1] += words(s['note'])
        return c
    if t == 'stack':
        c = [words(x) for x in s.get('layers', [])] or [0]; c[0] += words(head); return c
    if t == 'table':
        c = [words(r) for r in s.get('rows', [])] or [0]; c[0] += words(head, s.get('head')); return c
    if t == 'focus':
        c = [words(x) for x in s.get('points', [])] or [0]
        c[0] += words(head, s.get('h'), s.get('p'), s.get('label'))
        if s.get('note'): c[-1] += words(s['note'])
        return c
    if t == 'chips':
        c = [words(head, s.get('chips'))]
        if s.get('note'): c.append(words(s['note']))
        return c
    if t == 'compare': return [words(head, s['left']), words(s['right'])]
    if t == 'example': return [words(s.get('tag'), s.get('h'), s.get('p'), s.get('src'))] + [words(p) for p in s.get('points', [])]
    if t == 'calc': return [words(head, s.get('given'))] + [words(x) for x in s.get('steps', [])] + [words(s.get('result'))]
    return [words(s)]


def durations(s):
    t = s['type']
    if t == 'opener': return [5.0]
    if t == 'closing': return [8.0]
    out = []
    c = chunks(s)
    for i, w in enumerate(c):
        d = 2.4 + 0.34 * w
        if t in ('formula', 'calc', 'table'): d += 1.2          # numbers take longer to read
        d = max(3.2, min(d, 13.0))
        if i == len(c) - 1: d += 1.2                              # pause on the finished slide
        out.append(round(d, 1))
    return out


def validate(c):
    probs = []
    def chk(where, text, limit):
        if text and words(text) > limit: probs.append(f'{where}: {words(text)} words > {limit}')
    for li, L in enumerate(c['lessons'], 1):
        if L['scenes'][0]['type'] != 'opener': probs.append(f'L{li}: first scene is not an opener')
        for si, s in enumerate(L['scenes'], 1):
            w = f'L{li}S{si} {s["type"]}'
            for key in ('icon',):
                if s.get(key) and s[key] not in ICONS: probs.append(f'{w}: unknown icon {s[key]}')
            for coll in ('items', 'layers', 'chips', 'points'):
                for x in s.get(coll, []) if isinstance(s.get(coll), list) else []:
                    if isinstance(x, dict) and x.get('icon') and x['icon'] not in ICONS: probs.append(f'{w}: unknown icon {x["icon"]}')
            chk(w + ' title', s.get('title'), 10); chk(w + ' say', s.get('say'), 65)
            if not s.get('say'): probs.append(f'{w}: no narration (say)')
            if s['type'] == 'cards':
                for x in s.get('items', []): chk(w + ' card', x.get('p'), 24)
            if s['type'] == 'focus': chk(w + ' p', s.get('p'), 42)
            if s['type'] == 'statement': chk(w + ' big', s.get('big'), 24)
    return probs


# ---------- frames ----------
def bundle_css():
    css = (STUDIO / 'slide.css').read_text(encoding='utf-8')
    font = base64.b64encode((STUDIO / 'lib' / 'inter-var.woff2').read_bytes()).decode()
    css = css.replace('url("lib/inter-var.woff2")', f'url("data:font/woff2;base64,{font}")')
    out = WORK / 'slide.bundle.css'; out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(css, encoding='utf-8'); return out


def frame_html(scene, step, meta, css):
    j = lambda o: json.dumps(o, ensure_ascii=False).replace('</', '<\\/')
    return ('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="%s"></head><body><div id="root"></div>'
            '<script src="%s"></script><script>window.SCENE=%s;window.STEP=%d;window.META=%s;</script><script src="%s"></script></body></html>'
            % (url(css), url(STUDIO / 'lib' / 'lucide.min.js'), j(scene), step, j(meta), url(STUDIO / 'slide.js')))


def chrome(args, prof):
    cmd = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
           '--window-size=1920,1080', '--virtual-time-budget=6000', '--no-first-run', '--no-default-browser-check',
           f'--user-data-dir={prof}'] + args
    return subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)


def render_jobs(jobs, workers=4):
    """jobs: list of (html_path, png_path, check_overflow). Renders them all in one headless Chrome (render_cdp.mjs).
    Returns a list of warnings (overflowing slides, frames that never signalled ready)."""
    spec = [{'url': url(h), 'png': str(p), 'check': bool(c)} for h, p, c in jobs]
    jf = WORK / 'jobs.json'; jf.write_text(json.dumps(spec), encoding='utf-8')
    r = subprocess.run(['node', str(STUDIO / 'render_cdp.mjs'), str(jf), CHROME, str(WORK / 'chrome-profile'), str(workers)],
                       capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=3600)
    warn = []
    for line in r.stdout.splitlines():
        try: x = json.loads(line)
        except ValueError: continue
        name = Path(x['png']).parent.name + '/' + Path(x['png']).name
        if x.get('error'): warn.append(f"error {name}: {x['error']}")
        elif not x.get('ok'): warn.append(f'not ready (check fonts/icons): {name}')
        if x.get('overflow'): warn.append(f'text overflow (auto-shrunk to 66 % and still too tall): {name}')
    if r.returncode: warn.append('renderer exit %s: %s' % (r.returncode, r.stderr.strip()[-400:]))
    missing = [p for _, p, _ in jobs if not Path(p).exists()]
    warn += [f'missing frame: {m}' for m in missing]
    return warn


def build_frames(c, lessons, css):
    slug = c['slug']; base = WORK / slug; manifests = {}
    nL = len(c['lessons']); jobs = []
    for li in lessons:
        L = c['lessons'][li - 1]; scenes = L['scenes']
        durs = [durations(s) for s in scenes]
        total = sum(sum(d) for d in durs)
        meta0 = {'course_title': c['title'], 'lesson_index': li, 'lesson_count': nL, 'lesson_title': L['title'],
                 'lesson_minutes': max(1, round(total / 60)), 'scene_count': len(scenes), 'source': c.get('source'),
                 'quiz_count': len(c.get('quiz', [])), 'logo': url(STUDIO / 'lib' / 'logo.webp')}
        d = base / f'L{li}'; d.mkdir(parents=True, exist_ok=True)
        for old in d.glob('*'): old.unlink()
        frames = []
        for si, s in enumerate(scenes, 1):
            meta = dict(meta0, scene_index=si)
            for k, dur in enumerate(durs[si - 1], 1):
                html = d / f's{si:02d}_{k}.html'; png = d / f's{si:02d}_{k}.png'
                html.write_text(frame_html(s, k, meta, css), encoding='utf-8')
                jobs.append((str(html), str(png), k == len(durs[si - 1])))
                frames.append({'png': str(png), 'dur': dur, 'trans': 0.35 if k > 1 else 0.7, 'scene': si, 'step': k})
        manifests[li] = {'lesson': li, 'title': L['title'], 'seconds': round(total), 'frames': frames}
        (d / 'manifest.json').write_text(json.dumps(manifests[li], indent=1), encoding='utf-8')
    print(f'rendering {len(jobs)} frames ...', flush=True)
    warn = render_jobs(jobs)
    for w in warn: print('  WARN', w)
    return manifests


def render_single(scene, meta, out_png, css, name):
    d = WORK / c_slug_dir(); d.mkdir(parents=True, exist_ok=True)
    html = d / f'{name}.html'; html.write_text(frame_html(scene, 1, meta, css), encoding='utf-8')
    w = render_jobs([(str(html), str(out_png), True)], workers=1)
    for x in w: print('  WARN', x)


_slug = None
def c_slug_dir(): return f'{_slug}/single'


# ---------- video (PowerPoint) ----------
def build_videos(c, manifests):
    out_dir = COURSES / c['slug'] / 'video'; out_dir.mkdir(parents=True, exist_ok=True)
    ps1 = STUDIO / 'make_video.ps1'
    try:
        sys.path.insert(0, str(STUDIO)); import make_video; make_video.ffmpeg_exe(); use_ffmpeg = True   # fast path
    except Exception:
        use_ffmpeg = False                                                                                   # PowerPoint fallback
    for li, m in manifests.items():
        name = f"{li:02d}-{re.sub(r'[^a-z0-9]+', '-', m['title'].lower()).strip('-')}.mp4"
        mp = WORK / c['slug'] / f'L{li}' / 'manifest.json'
        out = out_dir / name
        if out.exists(): out.unlink()
        print(f'video L{li} ({m["seconds"]} s, {len(m["frames"])} frames) -> {out.name}', flush=True)
        if use_ffmpeg:
            make_video.make_video(m['frames'], out)
            print(f'   ffmpeg ok, {out.stat().st_size / 1e6:.1f} MB', flush=True)
            continue
        r = subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(ps1), '-Manifest', str(mp), '-Out', str(out)],
                           capture_output=True, text=True, timeout=3600)
        print('  ', (r.stdout or '').strip()[-300:], (r.stderr or '').strip()[-300:])


# ---------- PDF guide ----------
def build_pdf(c, manifests, cover_png, gloss_pngs):
    import fitz
    from PIL import Image
    pages = [cover_png]
    for li in sorted(manifests):
        last = {}
        for f in manifests[li]['frames']: last[f['scene']] = f['png']
        pages += [last[k] for k in sorted(last)]
    pages += gloss_pngs
    doc = fitz.open()
    for p in pages:
        im = Image.open(p).convert('RGB').resize((1600, 900), Image.LANCZOS)
        jpg = Path(p).with_suffix('.pdf.jpg'); im.save(jpg, 'JPEG', quality=82, optimize=True)
        page = doc.new_page(width=960, height=540); page.insert_image(page.rect, filename=str(jpg))
    doc.set_metadata({'title': c['title'] + ' – visual guide', 'author': 'F2F Education', 'subject': c.get('subtitle', '')})
    out = COURSES / c['slug'] / f"{c['slug']}-visual-guide.pdf"
    doc.save(out, garbage=4, deflate=True); print('pdf', out, f'{out.stat().st_size // 1024} KB, {len(pages)} pages')


# ---------- LearnWorlds copy ----------
def build_copy(c, manifests):
    L = []
    L.append(f"# {c['title']} – LearnWorlds setup\n")
    L.append('| Setting | Value |\n|---|---|')
    for k, v in [('Course title', c['title']), ('URL slug', c['slug']), ('Card description (Course settings → General)', c['card_description']),
                 ('Label (Course settings → General → Label)', c['label']), ('Author', c['author_name']),
                 ('Categories', ', '.join(c['categories'])), ('Level', c.get('level', '')), ('Pricing', 'Free'),
                 ('Course image', 'course-card.jpg')]:
        L.append(f'| {k} | {v} |')
    L.append(f"\n## Course page\n\n**{c['subtitle']}**\n\n{c['about']}\n\n**Who it is for:** {c['audience']}\n\n**You will learn to:**")
    L += [f'- {o}' for o in c['outcomes']]
    src = c['source']
    L.append(f"\n**Source:** this course is based on the Fibre2Fashion article [{src['title']}]({src['url']}) by {src['authors']} ({src.get('published','')}).")
    L.append('\n## Lessons (one Video learning activity each)\n')
    for li, Ls in enumerate(c['lessons'], 1):
        secs = manifests.get(li, {}).get('seconds')
        L.append(f"### Lesson {li}: {Ls['title']}" + (f' ({secs // 60} min {secs % 60:02d} s)' if secs else ''))
        L.append(f"_{Ls.get('sub','')}_\n\n**Transcript**\n")
        for s in Ls['scenes']:
            if s.get('say'): L.append(s['say'])
        L.append('')
    L.append('## Glossary\n')
    L += [f"- **{g['term']}**: {g['def']}" for g in c.get('glossary', [])]
    out = COURSES / c['slug'] / 'learnworlds-setup.md'
    out.write_text('\n'.join(L) + '\n', encoding='utf-8'); print('copy', out)


def main():
    global _slug
    ap = argparse.ArgumentParser()
    ap.add_argument('slug'); ap.add_argument('--lessons', default='')
    for f in ('frames', 'video', 'pdf', 'card', 'copy', 'all', 'check'): ap.add_argument('--' + f, action='store_true')
    a = ap.parse_args(); _slug = a.slug
    c = json.loads((COURSES / a.slug / 'content.json').read_text(encoding='utf-8'))
    probs = validate(c)
    for p in probs: print('CHECK', p)
    if a.check: return
    if not any([a.frames, a.video, a.pdf, a.card, a.copy]): a.all = True
    lessons = [int(x) for x in a.lessons.split(',') if x] or list(range(1, len(c['lessons']) + 1))
    css = bundle_css()
    manifests = {}
    if a.all or a.frames or a.video or a.pdf:
        manifests = build_frames(c, lessons, css)
    single = WORK / a.slug / 'single'; single.mkdir(parents=True, exist_ok=True)
    cover = single / 'cover.png'            # titled cover: first page of the PDF guide
    meta = {'course_title': c['title'], 'logo': url(STUDIO / 'lib' / 'logo.webp'), 'source': c.get('source')}
    if a.all or a.pdf:
        render_single({'type': 'cover', 'title': c['title'], 'sub': c['subtitle'], 'label': c['label'], 'icon': c.get('card_icon')}, meta, cover, css, 'cover')
    if a.all or a.card:
        # LearnWorlds course card: picture only (LearnWorlds prints title, label and author around/over it)
        card_png = single / 'card.png'
        render_single({'type': 'card', 'icon': c.get('card_icon', 'book-open'), 'topic': c.get('card_topic') or c['categories'][0].replace('-', ' ')}, meta, card_png, css, 'card')
        from PIL import Image
        Image.open(card_png).convert('RGB').resize((1280, 720), Image.LANCZOS).save(COURSES / a.slug / 'course-card.jpg', 'JPEG', quality=88)
        print('card', COURSES / a.slug / 'course-card.jpg')
    if a.all or a.pdf:
        gl = c.get('glossary', []); pngs = []
        for i in range(0, len(gl), 8):
            p = WORK / a.slug / 'single' / f'glossary{i // 8}.png'
            render_single({'type': 'glossary', 'title': 'Glossary' if i == 0 else 'Glossary (continued)', 'items': gl[i:i + 8]}, meta, p, css, f'glossary{i // 8}')
            pngs.append(str(p))
        build_pdf(c, manifests, str(cover), pngs)
    if a.all or a.copy: build_copy(c, manifests)
    if a.all or a.video: build_videos(c, manifests)


if __name__ == '__main__':
    main()
