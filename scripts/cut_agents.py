"""Cut the eight agent characters out of 'Eight Industrial Agent Icons Grid.png' (left to right, top to bottom = agent 1 to 8).

The source already has an alpha channel. Each character is found as a connected group of opaque pixels; the groups
are assigned to the 4 x 2 grid by their centre. Bounds were taken from the image, not guessed. Each output is placed,
unscaled, in the same square transparent canvas with the same padding. The original is not changed.
Usage: python3 -I scripts/cut_agents.py
"""
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "Eight Industrial Agent Icons Grid.png"
OUT = ROOT / "src" / "assets" / "agents"
CANVAS = 480

im = Image.open(SRC).convert("RGBA")
a = np.array(im)
alpha = a[..., 3]
lab, n = ndi.label(alpha >= 128)
H, W = alpha.shape
cells = {}
for i in range(1, n + 1):
    ys, xs = np.where(lab == i)
    if len(ys) < 3000:  # specks
        continue
    col = min(3, int(xs.mean() // (W / 4)))
    row = min(1, int(ys.mean() // (H / 2)))
    cells.setdefault(row * 4 + col, []).append(i)
assert sorted(cells) == list(range(8)), f"expected 8 characters, found cells {sorted(cells)}"

OUT.mkdir(parents=True, exist_ok=True)
for idx in range(8):
    mask = np.isin(lab, cells[idx])
    keep = ndi.binary_dilation(mask, iterations=4)  # keep the soft edge of the character
    piece = a.copy()
    piece[..., 3] = np.where(keep, alpha, 0)
    ys, xs = np.where(piece[..., 3] > 0)
    crop = Image.fromarray(piece).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    assert crop.width <= CANVAS - 40 and crop.height <= CANVAS - 40, crop.size
    canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.paste(crop, ((CANVAS - crop.width) // 2, (CANVAS - crop.height) // 2), crop)
    canvas.save(OUT / f"agent-{idx + 1}.png", optimize=True)
    print(f"agent-{idx + 1}.png  from x {xs.min()}-{xs.max()}  y {ys.min()}-{ys.max()}  ({crop.width}x{crop.height})")
