"""Square monogram logos for TEST universities (author pictures in LearnWorlds). Replace with real partner logos once approved."""
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
