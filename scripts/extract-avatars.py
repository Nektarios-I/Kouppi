"""Extract individual transparent portrait avatars from Gemini sheets."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

RAW = Path(__file__).resolve().parents[1] / "apps/web/public/assets/players-display_raw"
OUT = Path(__file__).resolve().parents[1] / "apps/web/public/assets/avatars"

# Clean professional sheets only (skip ornate cultural sheet for small-UI readability)
SHEETS = [
    "Gemini_Generated_Image_vo6ebmvo6ebmvo6e.png",
    "Gemini_Generated_Image_6r75h46r75h46r75.png",
]

COLS, ROWS = 4, 3
SIZE = 256
INSET = 3


def remove_green(rgba: Image.Image) -> Image.Image:
    arr = np.asarray(rgba).astype(np.float32)
    r, g, b, a = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2], arr[:, :, 3]
    green_dom = (
        (g > 90)
        & (g > r * 1.15)
        & (g > b * 1.15)
        & ((g - r) > 25)
        & ((g - b) > 25)
    )
    near_key = (g > 140) & (r < 160) & (b < 160) & (g > r + 30) & (g > b + 30)
    mask = green_dom | near_key
    alpha = a.copy()
    alpha[mask] = 0
    green_score = np.clip((g - np.maximum(r, b)) / 80.0, 0, 1)
    soft = (green_score > 0.35) & ~mask
    alpha[soft] = alpha[soft] * (1 - green_score[soft])
    out = arr.copy()
    out[:, :, 3] = alpha
    return Image.fromarray(out.astype(np.uint8), "RGBA")


def crop_content(im: Image.Image, pad: int = 6) -> Image.Image:
    alpha = np.asarray(im.split()[-1])
    ys, xs = np.where(alpha > 12)
    if len(xs) == 0:
        return im
    x0, x1 = max(0, int(xs.min()) - pad), min(im.width, int(xs.max()) + pad + 1)
    y0, y1 = max(0, int(ys.min()) - pad), min(im.height, int(ys.max()) + pad + 1)
    return im.crop((x0, y0, x1, y1))


def fit_square(im: Image.Image, size: int = SIZE) -> Image.Image:
    w, h = im.size
    side = max(w, h)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    ox = (side - w) // 2
    oy = max(0, (side - h) // 2 - side // 20)
    canvas.paste(im, (ox, oy), im)
    return canvas.resize((size, size), Image.Resampling.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("portrait-*.png"):
        old.unlink()

    idx = 1
    for sheet_name in SHEETS:
        sheet = Image.open(RAW / sheet_name).convert("RGBA")
        cw, ch = sheet.width // COLS, sheet.height // ROWS
        for row in range(ROWS):
            for col in range(COLS):
                cell = sheet.crop(
                    (
                        col * cw + INSET,
                        row * ch + INSET,
                        (col + 1) * cw - INSET,
                        (row + 1) * ch - INSET,
                    )
                )
                cut = crop_content(remove_green(cell), pad=6)
                final = fit_square(cut)
                avatar_id = f"portrait-{idx:02d}"
                path = OUT / f"{avatar_id}.png"
                final.save(path, optimize=True)
                opaque = int((np.asarray(final.split()[-1]) > 20).sum())
                print(f"{avatar_id}: {path.stat().st_size // 1024}KB opaque_px={opaque}")
                idx += 1

    print(f"DONE {idx - 1} avatars -> {OUT}")


if __name__ == "__main__":
    main()
