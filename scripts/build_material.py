#!/usr/bin/env python3
"""The globe's materials: what every place is made of, in the collection's own colours.

The artist, 1 Oct 2026: "the colors overall in the entire globe need to be less pixelated and more
reflective of the materials the represent". So the body of the globe is no longer a dark gradient under
the dots: it is painted, smoothly, with what each place is — open ocean and the shallow shelf, reef,
lakes, forest by its canopy, grass, dry grass, the bare soil of the deserts in its own colour, rock,
glaciers, salt flats, wetland and the cities' built ground. Snow and sea ice are laid on in the page,
by the month, from DIRT Earth's snow layer.

Every colour written here is one of the saved paintings' colours (DIRT's rule: "no colour is painted
that the collection does not have"). Each place's real colour is worked out from DIRT Earth's atlas,
then the nearest colour the collection has (in CIE Lab) is the one written. The page does the light:
the sun, the relief, the water's sheen, the haze.

Reads (all already in the repository or public):
  dirt/earth/out/place.png, ground.png, terrain.png, water.png   DIRT Earth's atlas, a quarter degree a cell
  dirt/earth/site/earth-palette-MM.png, docs/v2/dirt-land.png,
  docs/v2/dirt-sea.png                                            the collection's colours (colours only)
  data/ne/urban.shp                                               Natural Earth 10m urban areas (public
                                                                  domain), fetched once into data/ne/

Writes:
  docs/v2/earth-material.webp   2048 x 1024 RGB, column 0 at 180 W, row 0 at 90 N: each place's colour
  docs/v2/earth-props.webp      2048 x 1024 RGB: r water (0 land .. 255 water, soft at the coast),
                                g on land the canopy (0..45 m), at sea the depth (sqrt of depth / 11000),
                                b the land's height (sqrt of metres / 8800)

    python3 scripts/build_material.py
"""

import glob
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "dirt" / "earth" / "out"
OUT = ROOT / "docs" / "v2"
URBAN = ROOT / "data" / "ne" / "urban.shp"
URBAN_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/10m_cultural/ne_10m_urban_areas"

W, H = 2048, 1024


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


# ---- the real colours of the materials (sRGB), from true-colour imagery ----------------------------
# Water by depth and kind.
TRENCH = hexrgb("#07152b")
ABYSS = hexrgb("#0b1f3d")
SLOPE = hexrgb("#123659")
SHELF = hexrgb("#1d5468")
REEF = hexrgb("#2d8a8c")
UPWELL = hexrgb("#1c4f52")
GYRE = hexrgb("#0c2c62")
POLAR_SEA = hexrgb("#16283a")
LAKE = hexrgb("#1c4256")
# Vegetation.
CANOPY_TROP = hexrgb("#1d3618")
CANOPY_TEMP = hexrgb("#2a3d1f")
CANOPY_BOREAL = hexrgb("#223127")
GRASS = hexrgb("#5d6b33")
DRY_GRASS = hexrgb("#8a7c4b")
TUNDRA = hexrgb("#5f5c49")
SCRUB = hexrgb("#6a6544")
WETLAND = hexrgb("#3c4a30")
MANGROVE = hexrgb("#24392a")
# Bare ground.
ROCK = hexrgb("#6f675d")
HIGH_ROCK = hexrgb("#7d776f")
ICE = hexrgb("#e9eef2")
SALT = hexrgb("#e4ded2")
SAND = hexrgb("#d3ad78")
URBAN_GROUND = hexrgb("#8a8277")


def read(name):
    return np.array(Image.open(ATLAS / name).convert("RGB")).astype(np.int32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = np.asarray(t, dtype=np.float32)[..., None]
    return a * (1 - t) + b * t


def up(field, mode=Image.BILINEAR):
    """A quarter-degree field, brought up to the texture's grid."""
    f = np.asarray(field, dtype=np.float32)
    return np.array(Image.fromarray(f, mode="F").resize((W, H), mode))


def up3(rgb):
    return np.stack([up(rgb[..., i], Image.BICUBIC) for i in range(3)], axis=-1)


# ---- colour science for the nearest painting colour -----------------------------------------------

def srgb_to_lab(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def collection_colours():
    cols = set()
    for f in sorted(glob.glob(str(ROOT / "dirt" / "earth" / "site" / "earth-palette-*.png"))):
        a = np.array(Image.open(f).convert("RGB")).reshape(-1, 3)
        cols |= set(map(tuple, np.unique(a, axis=0)))
    for f in (OUT / "dirt-land.png", OUT / "dirt-sea.png"):
        a = np.array(Image.open(f).convert("RGBA")).reshape(-1, 4)
        a = a[a[:, 3] > 0][:, :3]
        cols |= set(map(tuple, np.unique(a, axis=0)))
    return np.array(sorted(cols), dtype=np.uint8)


def snap(img, pal):
    """Every pixel to the collection's nearest colour, in Lab."""
    flat = img.reshape(-1, 3)
    # Pixels of the same colour (to the unit) are looked up once.
    q = np.clip(np.round(flat), 0, 255).astype(np.int32)
    key = (q[:, 0] << 16) | (q[:, 1] << 8) | q[:, 2]
    uk, inv = np.unique(key, return_inverse=True)
    ucol = np.stack([(uk >> 16) & 255, (uk >> 8) & 255, uk & 255], axis=-1)
    lab_u = srgb_to_lab(ucol)
    lab_p = srgb_to_lab(pal)
    best = np.empty(len(uk), dtype=np.int32)
    for s in range(0, len(uk), 4096):
        d = ((lab_u[s:s + 4096, None, :] - lab_p[None, :, :]) ** 2).sum(-1)
        best[s:s + 4096] = d.argmin(1)
    return pal[best][inv].reshape(img.shape).astype(np.uint8)


# ---- the cities' built ground -------------------------------------------------------------------

def urban_cover():
    if not URBAN.exists():
        import urllib.request
        URBAN.parent.mkdir(parents=True, exist_ok=True)
        for ext in ("shp", "shx", "dbf"):
            urllib.request.urlretrieve(URBAN_URL + "." + ext, str(URBAN.with_suffix("." + ext)))
    import shapefile
    S = 4                                              # drawn four times over, then averaged: soft edges
    big = Image.new("L", (W * S, H * S), 0)
    d = ImageDraw.Draw(big)
    for shape in shapefile.Reader(str(URBAN)).shapes():
        pts = shape.points
        parts = list(shape.parts) + [len(pts)]
        for a, b in zip(parts[:-1], parts[1:]):
            ring = [((x + 180) / 360 * W * S, (90 - y) / 180 * H * S) for x, y in pts[a:b]]
            if len(ring) >= 3:
                d.polygon(ring, fill=255)
    small = np.array(big.resize((W, H), Image.BOX)).astype(np.float32) / 255
    # A city's ground reaches a little past its edge at this scale, as its suburbs do.
    halo = np.array(Image.fromarray((small * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))) / 255
    return np.maximum(small, halo * 0.7)


def soft(mask, radius):
    m = Image.fromarray((np.asarray(mask, dtype=np.float32) * 255).astype(np.uint8))
    return np.array(m.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255


def spread(col, ok, rounds=24):
    """Each material carried a few cells past its own edge, so the soft coast mixes land with land's
    colour and sea with the sea's, never with a stand-in."""
    col = col.copy()
    ok = ok.copy()
    for _ in range(rounds):
        if ok.all():
            break
        acc = np.zeros_like(col)
        n = np.zeros(ok.shape, dtype=np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            o = np.roll(np.roll(ok, dy, 0), dx, 1)
            acc += np.roll(np.roll(col, dy, 0), dx, 1) * o[..., None]
            n += o
        grow = ~ok & (n > 0)
        col[grow] = acc[grow] / n[grow][:, None]
        ok = ok | grow
    return col


def main():
    place, ground, terrain, water = read("place.png"), read("ground.png"), read("terrain.png"), read("water.png")
    biome = place[..., 2]
    sea = biome == 255
    lake = (biome == 254) | ((water[..., 0] & 1) > 0)
    elev = (terrain[..., 0] + terrain[..., 1] * 256 - 11000).astype(np.float32)
    soil = ground[..., 0]
    canopy = ground[..., 1] / 255 * 45
    ai = np.exp(ground[..., 2] / 255 * (math.log(30) - math.log(0.001)) + math.log(0.001))
    marine = water[..., 1]
    warmth = water[..., 2]
    bits = water[..., 0]

    import json
    atlas = json.loads((ATLAS / "atlas.json").read_text())
    soil_col = np.array([hexrgb(s["colour"]) for s in atlas["soils"]] + [hexrgb("#7b6a55")] * 241, dtype=np.float32)

    lat = (90 - (np.arange(720) + 0.5) * 0.25)[:, None] * np.ones((1, 1440))
    alat = np.abs(lat)

    # -- land: what grows over what lies under it
    bare = soil_col[np.clip(soil, 0, 255)]
    # Deserts show their sand: the sand seas and the arid soils are the soil's own colour, a little warmer.
    bare = mix(bare, SAND, (soil == 4) * 0.55 + (soil == 5) * 0.3)
    bare = mix(bare, HIGH_ROCK, smoothstep(2600, 4800, elev) * 0.8)
    bare = np.where((soil == 1)[..., None], ROCK, bare)
    # Green cover: how wet it is (P/PET), how tall the canopy, and how cold.
    wet = smoothstep(0.04, 0.55, ai)
    tall = smoothstep(2, 22, canopy)
    cold = smoothstep(52, 68, alat) * (1 - tall)
    cover = np.clip(0.15 + 0.85 * wet, 0, 1) * (1 - 0.35 * cold)
    cover = np.maximum(cover, tall)
    cover = np.where(biome == 13, np.minimum(cover, 0.35 + 0.4 * tall), cover)
    cover = np.where(biome == 15, 0.0, cover)
    herb = mix(DRY_GRASS, GRASS, smoothstep(0.25, 0.75, ai))
    herb = np.where((biome == 11)[..., None], TUNDRA, herb)
    herb = np.where((biome == 12)[..., None], mix(SCRUB, herb, 0.4), herb)
    trop = (biome >= 1) & (biome <= 3) | (biome == 7)
    boreal = (biome == 6) | (biome == 5)
    can = np.where(trop[..., None], CANOPY_TROP, np.where(boreal[..., None], CANOPY_BOREAL, CANOPY_TEMP))
    can = np.where((biome == 14)[..., None], MANGROVE, can)
    veg = mix(herb, can, tall)
    landc = mix(bare, veg, cover)
    landc = mix(landc, WETLAND, ((bits & 64) > 0) * 0.5 + (biome == 9) * 0.35)
    landc = np.where(((bits & 8) > 0)[..., None], SALT, landc)
    landc = np.where(((bits & 4) > 0)[..., None] | (biome == 15)[..., None] & (soil == 0)[..., None], ICE, landc)

    # -- water: by depth, and what kind of sea it is
    depth = np.clip(-elev, 0, 11000)
    seac = mix(SHELF, SLOPE, smoothstep(150, 1200, depth))
    seac = mix(seac, ABYSS, smoothstep(1200, 4200, depth))
    seac = mix(seac, TRENCH, smoothstep(6000, 9000, depth))
    names = [m["name"] for m in atlas["marine"]]
    def zone(n):
        return marine == names.index(n)
    seac = np.where(zone("reef")[..., None], REEF, seac)
    # The kinds of sea are drawn as broad regions in the atlas: their edges are let go of softly.
    seac = mix(seac, UPWELL, soft(zone("upwelling"), 3) * 0.55)
    seac = mix(seac, GYRE, soft(zone("gyre"), 14) * 0.5)
    seac = mix(seac, POLAR_SEA, soft(warmth == 3, 14) * 0.5)
    seac = np.where((lake & ~sea)[..., None], LAKE, seac)

    waterness = (sea | lake).astype(np.float32)
    col = np.where((sea | lake)[..., None], seac, landc)

    # -- up to the texture's grid, the coast soft, the cities on
    colB = up3(col)
    wetB = np.clip(up(waterness, Image.BILINEAR), 0, 1)
    wetB = np.array(Image.fromarray((wetB * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) / 255
    landB = up3(spread(landc, ~(sea | lake)))
    seaB = up3(spread(seac, sea | lake))
    colB = landB * (1 - wetB[..., None]) + seaB * wetB[..., None]
    urb = urban_cover() * (1 - wetB)
    colB = colB * (1 - 0.82 * urb[..., None]) + URBAN_GROUND * 0.82 * urb[..., None]

    pal = collection_colours()
    print("collection colours:", len(pal))
    mat = snap(np.clip(colB, 0, 255), pal)
    Image.fromarray(mat).save(OUT / "earth-material.webp", quality=88, method=6)

    # -- what the page lights it with
    canB = up(canopy / 45, Image.BILINEAR)
    depB = up(np.sqrt(depth / 11000), Image.BILINEAR)
    g = np.where(wetB > 0.5, depB, canB)
    hB = up(np.sqrt(np.clip(elev, 0, 8800) / 8800), Image.BICUBIC)
    props = np.stack([wetB, np.clip(g, 0, 1), np.clip(hB, 0, 1)], axis=-1)
    Image.fromarray((props * 255).round().astype(np.uint8)).save(OUT / "earth-props.webp", quality=90, method=6)
    for f in ("earth-material.webp", "earth-props.webp"):
        print(f, (OUT / f).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
