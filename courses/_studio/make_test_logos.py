"""Square monogram logos for the old TEST universities (author pictures in LearnWorlds), in courses/_test-universities/.

No course uses them any more. Since 25 Nov 2026 the institutions are real, with their own logos in courses/_universities/
(not generated here, so this script never overwrites them):
  fibre2fashion-education.png       Fibre2Fashion Education (the user's F2F logo), author of 13 courses
  amfi.png                          AMFI (Amsterdam Fashion Institute), author of the 3 Fashion Design courses
  sustainable-fashion-academy.png   for the Sustainable Fashion School / Academy course, once it exists
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / '_test-universities'
OUT.mkdir(exist_ok=True)
UNIS = [("TA", "Test University A", "#1B5FA8"), ("TB", "Test University B", "#111111"),
        ("TF", "Test Fashion Institute", "#154D89"), ("TC", "Test College of Textiles", "#2E7AD1")]
font = ImageFont.truetype(r"C:\Windows\Fonts\arialbd.ttf", 200)
for code, name, color in UNIS:
    im = Image.new("RGB", (512, 512), color)
    d = ImageDraw.Draw(im)
    w = d.textlength(code, font=font)
    d.text(((512 - w) / 2, 140), code, font=font, fill="white")
    path = OUT / f"{name.lower().replace(' ', '-')}.png"
    im.save(path)
    print(path)
