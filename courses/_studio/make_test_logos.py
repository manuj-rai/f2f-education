"""Square monogram logos for course authors (author pictures in LearnWorlds).

courses/_universities/: institutions in use. Since 25 Nov 2026 every course's author is "F2F University"
(the user's choice; it replaced the TEST universities). Replace with a real logo once there is one.
courses/_test-universities/: the old TEST universities, no longer used by any course.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SETS = {
    '_universities': [("F2F", "F2F University", "#0D1B3E")],
    '_test-universities': [("TA", "Test University A", "#1B5FA8"), ("TB", "Test University B", "#111111"),
                           ("TF", "Test Fashion Institute", "#154D89"), ("TC", "Test College of Textiles", "#2E7AD1")],
}
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 200)
for folder, unis in SETS.items():
    out = ROOT / folder
    out.mkdir(exist_ok=True)
    for code, name, color in unis:
        im = Image.new("RGB", (512, 512), color)
        d = ImageDraw.Draw(im)
        w = d.textlength(code, font=font)
        d.text(((512 - w) / 2, 140), code, font=font, fill="white")
        path = out / f"{name.lower().replace(' ', '-')}.png"
        im.save(path)
        print(path)
