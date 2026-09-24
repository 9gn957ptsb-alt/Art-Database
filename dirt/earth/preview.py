#!/usr/bin/env python3
"""Preview maps of the DIRT Earth atlas, for checking it by eye: one small map a layer, and a sheet.

    python3 dirt/earth/preview.py [--out dirt/earth/out]
"""

import argparse
import colorsys
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent


def load(out):
    atlas = json.loads((out / "atlas.json").read_text())
    rgb = lambda n: np.asarray(Image.open(out / n).convert("RGB"))
    return atlas, rgb


def ramp(v, stops):
    """v in 0..1 through colour stops [(t, '#rrggbb'), ...]."""
    ts = np.array([t for t, _ in stops])
    cs = np.array([[int(c[i:i + 2], 16) for i in (1, 3, 5)] for _, c in stops], float)
    out = np.stack([np.interp(v, ts, cs[:, k]) for k in range(3)], -1)
    return out.astype(np.uint8)


def hues(n, s=0.55, l=0.55):
    """n distinct colours, spaced by the golden angle."""
    return np.array([[int(255 * x) for x in colorsys.hls_to_rgb((k * 0.381966) % 1, l, s)] for k in range(n)], np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "out"))
    args = ap.parse_args()
    out = Path(args.out)
    atlas, rgb = load(out)
    place, cls, ground, view, water = rgb("place.png"), rgb("class.png"), rgb("ground.png"), rgb("view.png"), rgb("water.png")
    land = place[..., 2] < 254
    sea = np.array([18, 30, 44], np.uint8)
    maps = {}

    bio_col = {1: "#38a700", 2: "#ccc000", 3: "#88ce66", 4: "#00734c", 5: "#458970", 6: "#7ac6a7", 7: "#fea900", 8: "#fefe00",
               9: "#bee9ff", 10: "#d6c29e", 11: "#9ed7c2", 12: "#fe0000", 13: "#cc6767", 14: "#fe01c4", 15: "#dddddd"}
    lut = np.zeros((256, 3), np.uint8)
    for k, c in bio_col.items():
        lut[k] = [int(c[i:i + 2], 16) for i in (1, 3, 5)]
    img = lut[place[..., 2]]
    img[~land] = sea
    maps["biomes"] = img

    kl = hues(31, 0.6, 0.5)
    img = kl[np.minimum(cls[..., 0], 30)]
    img[~land] = sea
    maps["koppen"] = img

    soil_cols = np.array([[int(s["colour"][i:i + 2], 16) for i in (1, 3, 5)] for s in atlas["soils"]], np.uint8)
    img = soil_cols[np.minimum(ground[..., 0], len(soil_cols) - 1)]
    img[~land] = sea
    maps["soil"] = img

    img = ramp(ground[..., 1] / 255, [(0, "#e8dcc0"), (0.1, "#b8b070"), (0.35, "#4d8a3c"), (1, "#0b3d16")])
    img[~land] = sea
    maps["canopy height"] = img

    maps["view distance"] = ramp(view[..., 0] / 255, [(0, "#1a1410"), (0.5, "#6b5a4a"), (0.8, "#b9c7d6"), (1, "#f4fbff")])
    img = ramp(view[..., 2] / 255, [(0, "#0d0d12"), (0.4, "#3a4a66"), (1, "#bfe3ff")])
    maps["big sky"] = img

    ct = rgb("cloudtype-0.png")[..., 0], rgb("cloudtype-2.png")[..., 0]
    cl = hues(len(atlas["cloud_types"]), 0.55, 0.55)
    maps["cloud type Jan"] = cl[ct[0]]
    maps["cloud type Jul"] = cl[ct[1]]

    t = rgb("temp-0.png")[..., 0] / 255 * 127.5 - 60, rgb("temp-2.png")[..., 0] / 255 * 127.5 - 60
    tc = lambda v: ramp(np.clip((v + 45) / 80, 0, 1), [(0, "#2a1f6b"), (0.45, "#8fc1e6"), (0.56, "#f4f1d0"), (0.75, "#e89a3c"), (1, "#7a1010")])
    maps["temperature Jan"], maps["temperature Jul"] = tc(t[0]), tc(t[1])

    r = rgb("rain-0.png")[..., 0] / 255, rgb("rain-2.png")[..., 0] / 255
    rc = lambda v: ramp(v, [(0, "#f2e6c9"), (0.3, "#b7c98a"), (0.6, "#3d8f9e"), (1, "#0a2266")])
    maps["rain Jan"], maps["rain Jul"] = rc(r[0]), rc(r[1])

    marine = water[..., 1]
    ml = hues(len(atlas["marine"]), 0.5, 0.45)
    img = np.where(marine[..., None] < 255, ml[np.minimum(marine, len(ml) - 1)], 40).astype(np.uint8)
    maps["sea zones"] = img

    names = list(maps)
    w, h = 360, 180
    sheet = Image.new("RGB", (4 * (w + 6), ((len(names) + 3) // 4) * (h + 20)), (70, 70, 70))
    d = ImageDraw.Draw(sheet)
    for n, name in enumerate(names):
        im = Image.fromarray(maps[name]).resize((w, h), Image.LANCZOS)
        x, y = (n % 4) * (w + 6), (n // 4) * (h + 20)
        sheet.paste(im, (x, y + 16))
        d.text((x + 3, y + 2), name, fill=(255, 255, 255))
        Image.fromarray(maps[name]).save(out / f"preview-{name.replace(' ', '-')}.png", optimize=True)
    sheet.save(out / "preview-sheet.png", optimize=True)
    print(out / "preview-sheet.png")


if __name__ == "__main__":
    main()
