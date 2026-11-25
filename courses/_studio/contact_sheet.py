"""Contact sheet of the finished frame of every scene (for quick visual review). python contact_sheet.py <slug> <out.png> [lessons]"""
import json, os, sys, tempfile
from pathlib import Path
from PIL import Image, ImageDraw
slug, out = sys.argv[1], sys.argv[2]
want = [int(x) for x in sys.argv[3].split(',')] if len(sys.argv) > 3 else None
work = Path(os.environ.get('F2F_BUILD_DIR', Path(tempfile.gettempdir()) / 'f2f-course-build')) / slug
tiles = []
for mf in sorted(work.glob('L*/manifest.json'), key=lambda p: int(p.parent.name[1:])):
    m = json.loads(mf.read_text(encoding='utf-8'))
    if want and m['lesson'] not in want: continue
    last = {}
    for f in m['frames']: last[f['scene']] = f['png']
    tiles += [(f"L{m['lesson']}S{k}", last[k]) for k in sorted(last)]
cols, tw, th = 3, 640, 360
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new('RGB', (cols * tw, rows * th), 'white'); d = ImageDraw.Draw(sheet)
for i, (lab, p) in enumerate(tiles):
    im = Image.open(p).convert('RGB').resize((tw - 6, th - 6))
    x, y = (i % cols) * tw, (i // cols) * th
    sheet.paste(im, (x + 3, y + 3)); d.rectangle([x + 3, y + 3, x + 70, y + 22], fill='black'); d.text((x + 7, y + 6), lab, fill='white')
sheet.save(out); print(out, len(tiles), 'tiles')
