"""Renders the LearnWorlds course-card image (picture only, 1280 x 720) for one or more courses.
  python courses/_studio/card.py <slug> [<slug> ...]      reads card_icon / card_topic from content.json
  python courses/_studio/card.py --custom <out.jpg> <icon> "<topic>"
"""
import importlib.util, json, sys
from pathlib import Path
STUDIO = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('build', STUDIO / 'build.py'); b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
from PIL import Image

def render(out_jpg, icon, topic):
    b._slug = 'cards'; css = b.bundle_css()
    png = b.WORK / 'cards' / (Path(out_jpg).stem + '.png'); png.parent.mkdir(parents=True, exist_ok=True)
    b.render_single({'type': 'card', 'icon': icon, 'topic': topic}, {'logo': b.url(STUDIO / 'lib' / 'logo.webp')}, png, css, Path(out_jpg).stem)
    Image.open(png).convert('RGB').resize((1280, 720), Image.LANCZOS).save(out_jpg, 'JPEG', quality=88)
    print('card', out_jpg)

if __name__ == '__main__':
    if sys.argv[1] == '--custom':
        render(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        for slug in sys.argv[1:]:
            c = json.loads((STUDIO.parent / slug / 'content.json').read_text(encoding='utf-8'))
            topic = c.get('card_topic') or c['categories'][0].replace('-', ' ')
            render(STUDIO.parent / slug / 'course-card.jpg', c.get('card_icon', 'book-open'), topic)
