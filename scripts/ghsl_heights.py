#!/usr/bin/env python3
"""Average building heights from the Global Human Settlement Layer, for build_grounds.py.

Overture's buildings have a height for few of them in much of the world (Beijing's cells stood 98% at two
storeys, Shanghai's 96%, Antwerp's 86%, Brussels's 83%, Tokyo's 77%) and no register of them is read there.
GHS-BUILT-H R2023A (Pesaresi et al., JRC; CC BY 4.0), the average net building height in 2018 at 3
arc-seconds (about 90 m), is the one open height for every building on the Earth, from the same JRC host that
build_built_years.py reads the built-up surface from (GHS_BUILT_S). It is an average over a pixel, not a
building's height: against Overture's own heights it follows them at r = 0.62 in Chicago's pixels, 0.46 in
Madrid's, 0.23 in Berlin's; against EUBUCCO's register per building (Paris, Madrid) it has no skill between
buildings (r 0.05, 0.36) but its level is right (+1.8 m, +0.9 m) and it lands within a storey of the register
for 42% and 38% of buildings where the default two storeys does for 13% and 18% (mean error 5.4 m and 5.5 m
against 11.2 m and 8.1 m). build_grounds.py therefore gives it only to the cells that stand at the default two
storeys, and only in a city where most buildings do (`ghsl_storeys`).

A tile is 10° square (30 MB zipped, 576 MB read): the window a place's square takes from it is kept in
data/ghslh/<slug>.npz, so a place is fetched once.
"""

import io
import sys
import zipfile
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
URL = ("https://jeodpp.jrc.ec.europa.eu/ftp/jrc-opendata/GHSL/GHS_BUILT_H_GLOBE_R2023A/"
       "GHS_BUILT_H_ANBH_E2018_GLOBE_R2023A_4326_3ss/V1-0/tiles/"
       "GHS_BUILT_H_ANBH_E2018_GLOBE_R2023A_4326_3ss_V1_0_R{r}_C{c}.zip")
CACHE = ROOT / "data" / "ghslh"


def window(slug, box):
    """(array, x0, y0, step) of the pixels over box (south, west, north, east), x0, y0 the north-west corner in
    degrees; None where the tile is not there. shortcut: the tile the box's middle is in, so a square that
    crosses a 10° edge gets nothing across it (none of the cities' does)."""
    import build_built_years as BBY
    south, west, north, east = box
    path = CACHE / f"{slug}.npz"
    if path.exists():
        z = np.load(path)
        if np.allclose(z["box"], box, atol=1e-4):
            return (z["a"], float(z["x0"]), float(z["y0"]), float(z["step"])) if z["a"].size else None
    r = int(np.floor((89.0996 - (south + north) / 2) / 10)) + 1
    c = int(np.floor(((west + east) / 2 + 180.0079) / 10)) + 1
    data = BBY.fetch(URL.format(r=r, c=c), timeout=600)
    if not data:
        return None
    zf = zipfile.ZipFile(io.BytesIO(data))
    ras = BBY.Raster(zf.read(next(n for n in zf.namelist() if n.endswith(".tif"))))
    step = float(ras.sx)
    j0 = max(0, int(np.floor((west - ras.x0) / step)) - 2)
    j1 = min(ras.a.shape[1], int(np.ceil((east - ras.x0) / step)) + 2)
    i0 = max(0, int(np.floor((ras.y0 - north) / step)) - 2)
    i1 = min(ras.a.shape[0], int(np.ceil((ras.y0 - south) / step)) + 2)
    a = np.array(ras.a[i0:i1, j0:j1], dtype=np.float32) if i1 > i0 and j1 > j0 else np.zeros((0, 0), np.float32)
    x0, y0 = float(ras.x0 + j0 * step), float(ras.y0 - i0 * step)
    CACHE.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(f".{id(a)}.tmp.npz")          # whole or not at all: another run may read it
    np.savez_compressed(tmp, a=a, x0=x0, y0=y0, step=step, box=np.array(box))
    tmp.replace(path)
    return (a, x0, y0, step) if a.size else None


def at(win, lat, lon):
    """Metres at the points (arrays), 0 outside the window."""
    a, x0, y0, step = win
    j = np.floor((np.asarray(lon) - x0) / step).astype(int)
    i = np.floor((y0 - np.asarray(lat)) / step).astype(int)
    ok = (i >= 0) & (j >= 0) & (i < a.shape[0]) & (j < a.shape[1])
    out = np.zeros(np.shape(lat), dtype=np.float32)
    out[ok] = a[i[ok], j[ok]]
    return out
