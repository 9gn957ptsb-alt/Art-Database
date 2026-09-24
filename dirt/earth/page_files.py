#!/usr/bin/env python3
"""The Earth's files for DIRT's page: the atlas's layers the page reads, at the resolutions it reads them.

The page reads the atlas's quarter-degree layers for everything that has edges (biomes, soils, water,
coasts, names) and its monthly layers at half a degree, which is finer than the climate data they come
from (MERRA-2 is half a degree by five eighths, CERES a degree). Elevation is kept only for the land, as
the square root of its height, for shading hills; the sea's depth is already in its zones.

    write(atlas_dir, out_dir)   # called by dirt/build_soil_viewer.py --earth
"""

import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

STATIC = ["place.png", "class.png", "ground.png", "water.png", "sky.png", "names.png", "view.png"]


def rgb(path):
    return np.asarray(Image.open(path).convert("RGB"))


def half(a, pick=False):
    """A quarter-degree layer at half a degree: the mean of each two by two, or for categories the first."""
    if pick:
        return np.ascontiguousarray(a[::2, ::2])
    h, w, c = a.shape
    return a.reshape(h // 2, 2, w // 2, 2, c).mean(axis=(1, 3)).round().astype(np.uint8)


def save(a, path):
    Image.fromarray(a).save(path, optimize=True)


def write(atlas, out):
    atlas, out = Path(atlas), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    for n in STATIC:
        shutil.copy(atlas / n, out / n)
    t = rgb(atlas / "terrain.png").astype(np.int32)
    elev = t[..., 0] + 256 * t[..., 1] - 11000
    sea = rgb(atlas / "place.png")[..., 2] == 255
    e = np.where(sea, 0, elev) + 11000                                          # the sea's depth is in its zones
    save(np.stack([(e & 255).astype(np.uint8), (e >> 8).astype(np.uint8), t[..., 2].astype(np.uint8)], -1), out / "relief.png")
    save(half(rgb(atlas / "wind.png")), out / "wind.png")
    for q in range(4):
        for n in ("temp", "rain", "cloud", "snow"):
            save(half(rgb(atlas / f"{n}-{q}.png")), out / f"{n}-{q}.png")
        save(half(rgb(atlas / f"cloudtype-{q}.png"), pick=True), out / f"cloudtype-{q}.png")
    meta = json.loads((atlas / "atlas.json").read_text())
    meta["grammar"] = json.loads((atlas / "grammar-engine.json").read_text())
    meta["page"] = {"relief.png": {"r,g": "land elevation in metres + 11000, little-endian 16 bit (0 m at sea); under the Greenland and Antarctic ice sheets the rock's, not the ice's",
                                   "b": "relief code, as terrain.png b"},
                    "half degree": ["wind.png", "temp-*.png", "rain-*.png", "cloud-*.png", "cloudtype-*.png", "snow-*.png"]}
    (out / "meta.json").write_text(json.dumps(meta, ensure_ascii=False, separators=(",", ":")))
    return sorted(p.name for p in out.iterdir())
