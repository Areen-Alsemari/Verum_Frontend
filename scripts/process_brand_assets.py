"""Prepare brand assets for the UI. Originals in the repo root are never modified.

Outputs go to public/brand/. Run: npm run assets
"""
from pathlib import Path
from PIL import Image, ImageFilter
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "brand"
ICONS = OUT / "icons"
OUT.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

BG = (11, 12, 14)  # UI background used for the contrast check


def lum(rgb):
    def c(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = rgb
    return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b)


def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def make_transparent(img):
    """Return RGBA. Sources that already carry alpha are kept; opaque white
    backgrounds are keyed out by whiteness."""
    img = img.convert("RGBA")
    a = np.array(img)
    if a[..., 3].min() < 250:
        return img
    rgb = a[..., :3].astype(float)
    whiteness = rgb.min(axis=2) / 255.0
    alpha = np.clip((0.98 - whiteness) / 0.2, 0, 1)
    a[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(a)


def trim(img, pad, thresh=8):
    arr = np.array(img)[..., 3]
    ys, xs = np.where(arr > thresh)
    box = (max(xs.min() - pad, 0), max(ys.min() - pad, 0),
           min(xs.max() + pad, img.width), min(ys.max() + pad, img.height))
    return img.crop(box)


# ---- logo -----------------------------------------------------------------
logo = make_transparent(Image.open(ROOT / "Verum-Logo-Light.png"))
logo_t = trim(logo, 24)
logo_t.save(OUT / "logo.png")
# Sphere mark only (rows above the wordmark) for the favicon / header mark.
arr = np.array(logo)
mark = trim(logo.crop((0, 0, logo.width, 620)), 12)
mark.save(OUT / "logo-mark.png")
side = max(mark.size)
fav = Image.new("RGBA", (side, side), (0, 0, 0, 0))
fav.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
fav.resize((256, 256), Image.LANCZOS).save(OUT / "favicon.png")
fav.resize((64, 64), Image.LANCZOS).save(ROOT / "public" / "favicon.png")

# Contrast report: strongest wordmark / tagline pixels against the UI background.
def report(name, rows):
    sub = arr[rows[0]:rows[1]]
    px = sub[sub[..., 3] > 40]
    # composite onto BG at pixel alpha, take the 95th percentile brightest
    comp = (px[:, :3] * (px[:, 3:4] / 255) + np.array(BG) * (1 - px[:, 3:4] / 255))
    brightest = comp[np.argsort(comp.sum(1))[int(len(comp) * 0.95)]]
    print(f"{name}: contrast on UI bg = {contrast(tuple(brightest), BG):.2f}:1 (rgb {tuple(int(v) for v in brightest)})")
    return contrast(tuple(brightest), BG)

report("wordmark", (640, 760))
report("tagline", (775, 800))

# ---- icons ----------------------------------------------------------------
sheet = Image.open(ROOT / "Industrial Reliability Icon Set.png").convert("RGBA")
names = [["plant", "operator", "inspector"], ["analyst", "reviewer", "decision-owner"]]
cw, ch = sheet.width // 3, sheet.height // 2
for r in range(2):
    for c in range(3):
        cell = sheet.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
        # soften the cell border so no hard crop edge shows on the dark UI
        a = np.array(cell)
        yy, xx = np.mgrid[0:ch, 0:cw]
        edge = np.minimum.reduce([xx, cw - 1 - xx, yy, ch - 1 - yy]).astype(float)
        fade = np.clip(edge / 28.0, 0, 1)
        a[..., 3] = (a[..., 3] * fade).astype(np.uint8)
        cell = trim(Image.fromarray(a), 6, thresh=30)
        cell.save(ICONS / f"{names[r][c]}.png")

# ---- hero -----------------------------------------------------------------
hero = Image.open(ROOT / "Moody Industrial Tanks at Night.png").convert("RGB")
hero.save(OUT / "hero-refinery-night.webp", quality=82)
print("done")
