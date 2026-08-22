#!/usr/bin/env python3
"""Extract transparent mascot cutouts from the two source character sheets."""

from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "mascot"

# Source-sheet rectangles are intentionally kept away from the blue sheet border/title.
ASSETS = {
    "eunwon_char_poses.png": {
        "wave": (45, 145, 395, 550),
        "thinking": (390, 150, 700, 550),
        "celebrating": (710, 135, 1115, 560),
        "delighted": (1110, 150, 1455, 560),
        "shy": (75, 565, 405, 955),
        "thumbs-up": (415, 560, 715, 955),
        "sitting": (745, 570, 1110, 970),
        "yawning": (1115, 560, 1460, 960),
    },
    "eunwon_character_sheet.png": {
        "turn-front": (35, 185, 275, 535),
        "turn-front-three-quarter": (285, 185, 505, 535),
        "turn-side-left": (505, 185, 700, 535),
        "turn-back-three-quarter-left": (690, 185, 910, 535),
        "turn-back": (900, 185, 1130, 535),
        "turn-back-three-quarter-right": (1125, 185, 1335, 535),
        "turn-side-right": (1325, 185, 1510, 535),
        "head-front": (40, 640, 385, 940),
        "head-side": (420, 635, 720, 940),
        "head-back": (760, 640, 1085, 940),
        "glasses": (1110, 690, 1480, 910),
    },
}


def connected_background(rgb: np.ndarray, threshold: float = 62.0) -> np.ndarray:
    """Return near-background pixels connected to the crop boundary.

    Connectivity is important: white eyes, muzzle, and belly remain opaque because the
    character outline encloses them.
    """
    h, w, _ = rgb.shape
    border = np.concatenate((rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]), axis=0)
    # Bright, low-chroma pixels provide a robust estimate of the warm studio backdrop.
    candidates = border[(border.min(axis=1) > 220) & ((border.max(axis=1) - border.min(axis=1)) < 25)]
    bg = np.median(candidates if len(candidates) else border, axis=0)
    distance = np.linalg.norm(rgb.astype(np.float32) - bg.astype(np.float32), axis=2)
    eligible = distance < threshold
    connected = np.zeros((h, w), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    for x in range(w):
        if eligible[0, x]: queue.append((0, x))
        if eligible[h - 1, x]: queue.append((h - 1, x))
    for y in range(h):
        if eligible[y, 0]: queue.append((y, 0))
        if eligible[y, w - 1]: queue.append((y, w - 1))

    while queue:
        y, x = queue.popleft()
        if connected[y, x] or not eligible[y, x]:
            continue
        connected[y, x] = True
        if y: queue.append((y - 1, x))
        if y + 1 < h: queue.append((y + 1, x))
        if x: queue.append((y, x - 1))
        if x + 1 < w: queue.append((y, x + 1))
    return connected


def extract(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = source.crop(box).convert("RGBA")
    rgba = np.asarray(crop).copy()
    bg = connected_background(rgba[:, :, :3])
    rgba[bg, 3] = 0

    alpha = rgba[:, :, 3]
    ys, xs = np.nonzero(alpha)
    tight = Image.fromarray(rgba).crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    # Normalize all assets onto a square canvas; CSS can size them interchangeably.
    side = max(tight.width, tight.height) + 48
    canvas = Image.new("RGBA", (side, side))
    canvas.alpha_composite(tight, ((side - tight.width) // 2, (side - tight.height) // 2))
    return canvas


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for source_name, assets in ASSETS.items():
        source = Image.open(ROOT / "public" / source_name).convert("RGB")
        for name, box in assets.items():
            image = extract(source, box)
            image.save(OUT / f"{name}.png", optimize=True)
            print(f"{name}.png\t{image.width}x{image.height}")


if __name__ == "__main__":
    main()
