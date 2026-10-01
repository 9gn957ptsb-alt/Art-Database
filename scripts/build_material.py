#!/usr/bin/env python3
"""The globe's materials, and a door to a saved work at every cell of it.

The artist, 1 Oct 2026: "the colors overall in the entire globe need to be less pixelated and more
reflective of the materials the represent", and then: "I still want you to be able to select an
artwork from any pixel. There's enough colors between all the compositions I have saved to make the
globe look however you please".

So every place on the globe wears what it is made of — open ocean and the shallow shelf, reef, lakes,
forest by its canopy, grass and dry grass, the bare soil of the deserts in its own colour, rock and
high mountains, glaciers, salt flats, wetland, the cities' built ground; snow and sea ice by the month
— and every colour it wears is one of a saved work's own colours (the `c` of its public history,
up to three a work), the work whose colour is nearest that material's real colour in CIE Lab. Among
works almost as near, cells take turns in small patches, so a forest is many works of forest green,
not one. Each cell knows its work: pressing it opens that work's history.

The grid is 1024 x 512 cells (about 39 km), column 0 at 180 W, row 0 at 90 N. Closer than a cell, the
page splits a cell into smaller ones, each taking its cell's work or one of that work's eight nearest
in colour (`s` below) by a hash the page's shader and its script work out the same way, so a press
anywhere, at any height, lands on one work.

Reads only public files: DIRT Earth's atlas (dirt/earth/out/: place, ground, terrain, water, snow-*),
the works' histories (docs/v2/histories/*.json: id and colours), and Natural Earth's 10m urban areas
(public domain, fetched once into data/ne/). Never the private dump in data/.

Writes (docs/v2/):
  earth-doors.webp    lossless RGB: per cell, the entry it wears without snow (12 bits) and with
                      snow or sea ice (12 bits): r = base & 255, g = base >> 8 | (snow & 15) << 4,
                      b = snow >> 4
  earth-season.webp   lossless RGB: r = snow or sea ice in months 1-8 (bit m-1), g = months 9-12 in
                      its low four bits and the cell's material class in its high four (CLASSES)
  earth-props.webp    2048 x 1024 RGB, for the light only: r water (soft at the coast), g on land the
                      canopy (0..45 m) and at sea the depth (sqrt of depth / 11000), b the land's
                      height (sqrt of metres / 8800)
  earth-doors.json    w: the works' ids; e: each entry's work (index into w); c: each entry's colour,
                      six hex digits each; s: each entry's eight nearest entries in colour, itself first

    python3 scripts/build_material.py
"""

import glob
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "dirt" / "earth" / "out"
OUT = ROOT / "docs" / "v2"
URBAN = ROOT / "data" / "ne" / "urban.shp"
URBAN_URL = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/10m_cultural/ne_10m_urban_areas"

GW, GH = 1024, 512          # the doors
PW, PH = 2048, 1024         # the light
CLASSES = ["sea", "shallow sea", "lake", "forest", "grass", "desert", "rock", "ice", "city", "wetland"]
NEAR_ENOUGH = 4.0           # Lab units: works this much further than the nearest still take turns
SIBS = 8


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


# ---- the real colours of the materials (sRGB), after true-colour imagery ---------------------------
TRENCH, ABYSS, SLOPE, SHELF = hexrgb("#07152b"), hexrgb("#0b1f3d"), hexrgb("#123659"), hexrgb("#1d5468")
REEF, UPWELL, GYRE, POLAR_SEA, LAKE = (hexrgb("#2d8a8c"), hexrgb("#1c4f52"), hexrgb("#0c2c62"),
                                       hexrgb("#16283a"), hexrgb("#1c4256"))
CANOPY_TROP, CANOPY_TEMP, CANOPY_BOREAL = hexrgb("#1d3618"), hexrgb("#2a3d1f"), hexrgb("#223127")
GRASS, DRY_GRASS, TUNDRA, SCRUB = hexrgb("#5d6b33"), hexrgb("#8a7c4b"), hexrgb("#5f5c49"), hexrgb("#6a6544")
WETLAND, MANGROVE = hexrgb("#3c4a30"), hexrgb("#24392a")
ROCK, HIGH_ROCK, ICE, SALT, SAND = (hexrgb("#6f675d"), hexrgb("#7d776f"), hexrgb("#e9eef2"),
                                    hexrgb("#e4ded2"), hexrgb("#d3ad78"))
URBAN_GROUND = hexrgb("#8a8277")
SNOW, SEA_ICE = hexrgb("#eef2f5"), hexrgb("#d6dee4")


def read(name):
    return np.array(Image.open(ATLAS / name).convert("RGB")).astype(np.int32)


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    t = np.asarray(t, dtype=np.float32)[..., None]
    return a * (1 - t) + b * t


def resize(field, w, h, mode=Image.BILINEAR):
    f = np.asarray(field, dtype=np.float32)
    return np.array(Image.fromarray(f, mode="F").resize((w, h), mode))


def resize3(rgb, w, h, mode=Image.BILINEAR):
    return np.stack([resize(rgb[..., i], w, h, mode) for i in range(3)], axis=-1)


def soft(mask, radius):
    m = Image.fromarray((np.asarray(mask, dtype=np.float32) * 255).astype(np.uint8))
    return np.array(m.filter(ImageFilter.GaussianBlur(radius))).astype(np.float32) / 255


def spread(col, ok, rounds=24):
    """Each material carried a few cells past its own edge, so a coast's cells mix land with land's
    colour and sea with the sea's."""
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


def srgb_to_lab(c):
    c = np.asarray(c, dtype=np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], axis=-1)


def urban_cover(w, h):
    if not URBAN.exists():
        import urllib.request
        URBAN.parent.mkdir(parents=True, exist_ok=True)
        for ext in ("shp", "shx", "dbf"):
            urllib.request.urlretrieve(URBAN_URL + "." + ext, str(URBAN.with_suffix("." + ext)))
    import shapefile
    S = 4
    big = Image.new("L", (w * S, h * S), 0)
    d = ImageDraw.Draw(big)
    for shape in shapefile.Reader(str(URBAN)).shapes():
        pts = shape.points
        parts = list(shape.parts) + [len(pts)]
        for a, b in zip(parts[:-1], parts[1:]):
            ring = [((x + 180) / 360 * w * S, (90 - y) / 180 * h * S) for x, y in pts[a:b]]
            if len(ring) >= 3:
                d.polygon(ring, fill=255)
    return np.array(big.resize((w, h), Image.BOX)).astype(np.float32) / 255


# ---- the works and their colours, from their public histories -------------------------------------

def works_and_entries():
    ids, ent_w, ent_c = [], [], []
    for f in sorted(glob.glob(str(OUT / "histories" / "*.json"))):
        h = json.loads(Path(f).read_text())
        cols = []
        for c in h.get("c") or []:
            c = str(c).lower()
            if len(c) == 7 and c not in cols:
                cols.append(c)
        if not cols:
            continue
        wi = len(ids)
        ids.append(h["id"])
        for c in cols:
            ent_w.append(wi)
            ent_c.append(hexrgb(c))
    return ids, np.array(ent_w, dtype=np.int32), np.array(ent_c, dtype=np.float32)


def nearest(lab_q, lab_e, k):
    """For each query colour, the k nearest entries and their distances."""
    idx = np.empty((len(lab_q), k), dtype=np.int32)
    dist = np.empty((len(lab_q), k), dtype=np.float32)
    for s in range(0, len(lab_q), 2048):
        d = ((lab_q[s:s + 2048, None, :] - lab_e[None, :, :]) ** 2).sum(-1)
        part = np.argpartition(d, k, axis=1)[:, :k]
        pd = np.take_along_axis(d, part, 1)
        o = np.argsort(pd, axis=1, kind="stable")
        idx[s:s + 2048] = np.take_along_axis(part, o, 1)
        dist[s:s + 2048] = np.sqrt(np.take_along_axis(pd, o, 1))
    return idx, dist


def patches(h, w, seed, scale):
    """Value noise in [0, 1), a few cells across, wrapping round the world."""
    rng = np.random.default_rng(seed)
    gh, gw = h // scale + 2, w // scale
    g = rng.random((gh, gw)).astype(np.float32)
    ys, xs = np.arange(h) / scale, np.arange(w) / scale
    y0, x0 = np.floor(ys).astype(int), np.floor(xs).astype(int)
    fy, fx = (ys - y0)[:, None], (xs - x0)[None, :]
    fy, fx = fy * fy * (3 - 2 * fy), fx * fx * (3 - 2 * fx)
    a, b = g[y0][:, x0 % gw], g[y0][:, (x0 + 1) % gw]
    c, d = g[y0 + 1][:, x0 % gw], g[y0 + 1][:, (x0 + 1) % gw]
    v = (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy
    v = (v - v.min()) / (np.ptp(v) or 1)
    return np.clip(v * 0.85 + rng.random((h, w)) * 0.15, 0, 0.9999)


def choose(cols, lab_e, salt):
    """Each cell's entry: the nearest work's colour, or, by small patches, one of the works within
    NEAR_ENOUGH of it."""
    flat = cols.reshape(-1, 3)
    q = np.clip(np.round(flat), 0, 255).astype(np.int32)
    key = (q[:, 0] << 16) | (q[:, 1] << 8) | q[:, 2]
    uk, inv = np.unique(key, return_inverse=True)
    inv = inv.reshape(-1)
    ucol = np.stack([(uk >> 16) & 255, (uk >> 8) & 255, uk & 255], axis=-1)
    idx, dist = nearest(srgb_to_lab(ucol), lab_e, 8)
    n_ok = (dist <= dist[:, :1] + NEAR_ENOUGH).sum(1)
    pick = patches(cols.shape[0], cols.shape[1], salt, 3).reshape(-1)
    which = np.floor(pick * n_ok[inv]).astype(np.int32)
    return idx[inv, which].reshape(cols.shape[:2]), dist[inv, 0].reshape(cols.shape[:2])


def main():
    place, ground, terrain, water = read("place.png"), read("ground.png"), read("terrain.png"), read("water.png")
    atlas = json.loads((ATLAS / "atlas.json").read_text())
    biome = place[..., 2]
    sea = biome == 255
    lake = (biome == 254) | ((water[..., 0] & 1) > 0)
    wetm = sea | lake
    elev = (terrain[..., 0] + terrain[..., 1] * 256 - 11000).astype(np.float32)
    soil = ground[..., 0]
    canopy = ground[..., 1] / 255 * 45
    ai = np.exp(ground[..., 2] / 255 * (math.log(30) - math.log(0.001)) + math.log(0.001))
    marine, warmth, bits = water[..., 1], water[..., 2], water[..., 0]
    soil_col = np.array([hexrgb(s["colour"]) for s in atlas["soils"]] + [hexrgb("#7b6a55")] * 241, dtype=np.float32)
    alat = np.abs((90 - (np.arange(720) + 0.5) * 0.25)[:, None] * np.ones((1, 1440)))

    # -- land: what grows over what lies under it
    bare = soil_col[np.clip(soil, 0, 255)]
    bare = mix(bare, SAND, (soil == 4) * 0.55 + (soil == 5) * 0.3)
    bare = mix(bare, HIGH_ROCK, smoothstep(2600, 4800, elev) * 0.8)
    bare = np.where((soil == 1)[..., None], ROCK, bare)
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
    trop = ((biome >= 1) & (biome <= 3)) | (biome == 7)
    boreal = (biome == 6) | (biome == 5)
    can = np.where(trop[..., None], CANOPY_TROP, np.where(boreal[..., None], CANOPY_BOREAL, CANOPY_TEMP))
    can = np.where((biome == 14)[..., None], MANGROVE, can)
    landc = mix(bare, mix(herb, can, tall), cover)
    landc = mix(landc, WETLAND, ((bits & 64) > 0) * 0.5 + (biome == 9) * 0.35)
    landc = np.where(((bits & 8) > 0)[..., None], SALT, landc)
    glacier = ((bits & 4) > 0) | ((biome == 15) & (soil == 0))
    landc = np.where(glacier[..., None], ICE, landc)

    # -- water: by depth, and what kind of sea it is
    depth = np.clip(-elev, 0, 11000)
    seac = mix(SHELF, SLOPE, smoothstep(150, 1200, depth))
    seac = mix(seac, ABYSS, smoothstep(1200, 4200, depth))
    seac = mix(seac, TRENCH, smoothstep(6000, 9000, depth))
    names = [m["name"] for m in atlas["marine"]]
    zone = lambda n: marine == names.index(n)
    seac = np.where(zone("reef")[..., None], REEF, seac)
    seac = mix(seac, UPWELL, soft(zone("upwelling"), 3) * 0.55)
    seac = mix(seac, GYRE, soft(zone("gyre"), 14) * 0.5)
    seac = mix(seac, POLAR_SEA, soft(warmth == 3, 14) * 0.5)
    seac = np.where((lake & ~sea)[..., None], LAKE, seac)

    # -- classes, a quarter degree a cell
    cls = np.full(biome.shape, CLASSES.index("grass"), dtype=np.int32)
    cls[tall > 0.5] = CLASSES.index("forest")
    cls[(cover < 0.45) & ~glacier] = CLASSES.index("desert")
    cls[(elev > 2500) | (soil == 1)] = CLASSES.index("rock")
    cls[((bits & 64) > 0) | (biome == 9) | (biome == 14)] = CLASSES.index("wetland")
    cls[glacier] = CLASSES.index("ice")
    cls[sea] = CLASSES.index("sea")
    cls[sea & (depth < 200)] = CLASSES.index("shallow sea")
    cls[lake & ~sea] = CLASSES.index("lake")

    # -- down to the doors' grid
    wetG = resize(wetm.astype(np.float32), GW, GH, Image.BOX) > 0.5
    landG = resize3(spread(landc, ~wetm), GW, GH, Image.BOX)
    seaG = resize3(spread(seac, wetm), GW, GH, Image.BOX)
    colG = np.where(wetG[..., None], seaG, landG)
    urb = smoothstep(0.1, 0.5, urban_cover(GW, GH) * ~wetG)
    colG = colG * (1 - 0.85 * urb[..., None]) + URBAN_GROUND * 0.85 * urb[..., None]
    clsG = np.array(Image.fromarray(cls.astype(np.uint8)).resize((GW, GH), Image.NEAREST)).astype(np.int32)
    clsG[wetG & (clsG > 2)] = CLASSES.index("sea")
    clsG[~wetG & (clsG <= 2)] = CLASSES.index("grass")
    clsG[urb > 0.5] = CLASSES.index("city")
    snowcol = np.where(wetG[..., None], SEA_ICE, SNOW) * np.ones((GH, GW, 1), dtype=np.float32)

    # snow and sea ice, month by month
    months = np.zeros((GH, GW), dtype=np.int32)
    for s in range(4):
        img = np.array(Image.open(ATLAS / f"snow-{s}.png").convert("RGB")).astype(np.float32) / 255
        for k in range(3):
            frac = soft(resize(img[..., k], GW, GH, Image.BOX), 1.6)   # the source's coarse grid let go of
            months |= ((frac > 0.5).astype(np.int32) << (s * 3 + k))
    months[clsG == CLASSES.index("ice")] = 0xFFF

    # -- the works
    ids, ent_w, ent_c = works_and_entries()
    lab_e = srgb_to_lab(ent_c)
    base, d0 = choose(colG, lab_e, 7)
    snow, _ = choose(snowcol, lab_e, 11)
    used = np.unique(np.concatenate([base.ravel(), snow.ravel()]))
    print("works:", len(ids), " entries:", len(ent_w), " used:", len(used), " works used:", len(np.unique(ent_w[used])),
          " distance to the material (Lab) median", round(float(np.median(d0)), 2), "95th", round(float(np.percentile(d0, 95)), 2))
    assert len(used) < 4096, "more than 12 bits of entries"
    remap = np.full(len(ent_w), -1, dtype=np.int32)
    remap[used] = np.arange(len(used))
    lab_u = lab_e[used]
    sib, _ = nearest(lab_u, lab_u, SIBS)
    base_r, snow_r = remap[base], remap[snow]
    wused = np.unique(ent_w[used])
    wmap = np.full(len(ids), -1, dtype=np.int32)
    wmap[wused] = np.arange(len(wused))

    doors = np.stack([base_r & 255, (base_r >> 8) | ((snow_r & 15) << 4), snow_r >> 4], axis=-1).astype(np.uint8)
    season = np.stack([months & 255, (months >> 8) | (clsG << 4), np.zeros_like(months)], axis=-1).astype(np.uint8)
    for name, arr in (("earth-doors.webp", doors), ("earth-season.webp", season)):
        Image.fromarray(arr).save(OUT / name, lossless=True, quality=100, method=6)
        back = np.array(Image.open(OUT / name).convert("RGB"))
        assert (back == arr).all(), name + " did not come back exactly"
    table = {
        "note": "The globe's doors (scripts/build_material.py): w the saved works it wears, e each entry's work "
                "(an index into w), c each entry's colour (six hex digits each, from the work's history), "
                "s each entry's eight nearest entries in colour, itself first.",
        "w": [ids[i] for i in wused],
        "e": [int(wmap[ent_w[i]]) for i in used],
        "c": "".join("%02x%02x%02x" % tuple(int(v) for v in ent_c[i]) for i in used),
        "s": [int(v) for v in sib.ravel()],
    }
    (OUT / "earth-doors.json").write_text(json.dumps(table, separators=(",", ":")))

    # -- the light
    wetB = np.clip(resize(wetm.astype(np.float32), PW, PH), 0, 1)
    wetB = np.array(Image.fromarray((wetB * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))) / 255
    canB = resize(canopy / 45, PW, PH)
    depB = resize(np.sqrt(depth / 11000), PW, PH)
    hB = resize(np.sqrt(np.clip(elev, 0, 8800) / 8800), PW, PH, Image.BICUBIC)
    props = np.stack([wetB, np.clip(np.where(wetB > 0.5, depB, canB), 0, 1), np.clip(hB, 0, 1)], axis=-1)
    Image.fromarray((props * 255).round().astype(np.uint8)).save(OUT / "earth-props.webp", quality=90, method=6)

    for f in ("earth-doors.webp", "earth-season.webp", "earth-props.webp", "earth-doors.json"):
        print(f, (OUT / f).stat().st_size, "bytes")


if __name__ == "__main__":
    main()
