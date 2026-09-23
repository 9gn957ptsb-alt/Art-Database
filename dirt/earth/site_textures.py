#!/usr/bin/env python3
"""The Earth dressed month by month, for the Artist Website's globe.

DIRT Earth dresses every place in the saved paintings nearest its own colours for the month: the Amazon in
the collection's greens, the Sahara in its ochres, Greenland in its palest colours, the sea in the blues out
of its paintings. This writes that dressing down for the Artist Website's globe, which is woven of DIRT's
dots, in two forms for each month (01 to 12):

  earth-palette-MM.png   720 x 1080: for every half-degree cell (column 0 at 180 W, row 0 at 90 N), the
                         three colours its place wears, dark, middle and light, as three bands of 360 rows.
                         Any dot pattern can be dressed with it at any zoom: take a dot's lightness l, put
                         t = (l - 34) / 144 (clamped to 0-1; squeezed toward 0.42 by 1/phi on even ground,
                         sand, snow, ice and water) through the stops [dark / phi^2, dark, middle, light,
                         light lifted 1/phi of the way to white] at [0, phi^-4, 0.42, 1 - phi^-4, 1].
                         This is how DIRT Earth itself lays a place's paintings over its soil.
  earth-dirt-MM.png      720 x 360 RGBA: DIRT's own dots (dirt/out/collection-soil-dots.png, going round the
                         world twice and pole to pole once, as the globe reads its tile now) already dressed
                         that way; colour the dot's colour, alpha its size (0, 85, 170, 255), nothing where
                         the soil leaves a gap. A drop-in for dirt-land.png and dirt-sea.png together.

Only colours leave: no titles, no artists, nothing of which painting went where, as with the site's own tiles.
The matching is a line-for-line port of dirt/earth/engine/earth-common.js (eRank, eRankWater, aimAt, lookKey,
ePhase, eBare, seaLook), so the globe and DIRT Earth wear the same paintings in the same places.

    python3 dirt/earth/site_textures.py --plane dirt/private/plane/plane.json [--atlas dirt/earth/out] [--out dirt/earth/site]
"""

import argparse
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
PHI = (1 + 5 ** 0.5) / 2
GOLDEN_ANGLE = 2 * math.pi / PHI ** 2
MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

# ---- the page's hashes, in 32 bits ------------------------------------------------------------------------
M32 = 0xFFFFFFFF


def mix(h):
    h = np.asarray(h, dtype=np.uint64) & M32
    h ^= h >> 16
    h = (h * 0x7FEB352D) & M32
    h ^= h >> 15
    h = (h * 0x846CA68B) & M32
    h ^= h >> 16
    return h


def h3(x, y, s):
    x = np.asarray(x, dtype=np.int64).astype(np.uint64) & M32
    y = np.asarray(y, dtype=np.int64).astype(np.uint64) & M32
    return mix(((x * 0x27D4EB2D) & M32) ^ mix(((y * 0x165667B1) + np.uint64(s & M32)) & M32))


# ---- colour, as the page works it ---------------------------------------------------------------------------
def turn_rgb(c, t):
    r, g, b = c
    if abs(t) < 0.01:
        return [r, g, b]
    co, s = math.cos(t), math.sin(t)
    k, q = (1 - co) / 3, math.sqrt(1 / 3) * s
    cl = lambda v: max(0.0, min(255.0, v))
    return [cl(r * (co + k) + g * (k - q) + b * (k + q)), cl(r * (k + q) + g * (co + k) + b * (k - q)), cl(r * (k - q) + g * (k + q) + b * (co + k))]


def lab_of(c):
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(float(v)) for v in c)
    f = lambda t: t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    X, Y, Z = f((0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047), f(0.2126 * r + 0.7152 * g + 0.0722 * b), f((0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883)
    L, A, B = 116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)
    return (L, math.hypot(A, B), math.atan2(B, A))


def uv_hue(c):
    u, v = (2 * c[0] - c[1] - c[2]) / math.sqrt(6), (c[1] - c[2]) / math.sqrt(2)
    return math.atan2(v, u), math.hypot(u, v)


lum = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
TURN_SIGN = 1 if uv_hue(turn_rgb([200, 100, 50], 0.1))[0] > uv_hue([200, 100, 50])[0] else -1


def lch_dist(t, p):
    s = 0
    for i in range(3):
        (L1, C1, H1), (L2, C2, H2) = t[i], p[i]
        dh = 2 * math.sqrt(C1 * C2) * math.sin((H1 - H2) / 2)
        s += (1.3 if i == 1 else 1) * math.sqrt((L1 - L2) ** 2 + (C1 - C2) ** 2 + (dh / PHI) ** 2)
    return s / 3.3


def aim_at(t, p):
    sx = sy = ws = ct = 0.0
    for a, b in zip(t, p):
        (ha, ca), (hb, cb) = uv_hue(a), uv_hue(b)
        w = ca * cb
        sx += w * math.cos(ha - hb); sy += w * math.sin(ha - hb); ws += w; ct += ca / 3
    agree = math.hypot(sx, sy) / ws if ws else 0
    turn = max(-GOLDEN_ANGLE, min(GOLDEN_ANGLE, math.atan2(sy, sx))) * agree * min(1, ct / 21) if ws else 0
    out = [turn_rgb(c, TURN_SIGN * turn) for c in p]
    cp = sum(uv_hue(c)[1] for c in out) / 3 or 1
    k = max(1 / PHI, min(PHI, ct / cp))
    return [[max(0.0, min(255.0, lum(c) + (v - lum(c)) * k)) for v in c] for c in out], turn


def hls_of(c):
    r, g, b = (v / 255 for v in c)
    mx, mn = max(r, g, b), min(r, g, b)
    L, d = (mx + mn) / 2, mx - mn
    if not d:
        return 0, L, 0
    S = d / (1 - abs(2 * L - 1))
    H = ((g - b) / d + 6) % 6 if mx == r else (b - r) / d + 2 if mx == g else (r - g) / d + 4
    return H * 60, L, S


def is_water_colour(c):
    H, L, S = hls_of(c)
    return 170 <= H <= 250 and S >= 0.1 and 0.1 <= L <= 0.65


def with_stops(pal):
    pal = sorted(pal, key=lum)
    return [[v * PHI ** -2 for v in pal[0]], pal[0], pal[1], pal[2], [v + (255 - v) / PHI for v in pal[2]]]


class Matcher:
    """The paintings, ranked for a look as eRank and eRankWater rank them."""

    def __init__(self, tokens, looks, soils, marine, marine_names):
        self.paint = []
        for cols in tokens:
            c = [list(map(float, v)) for v in cols]
            while len(c) < 3:
                c.append(list(c[-1]))
            self.paint.append(sorted(c, key=lambda v: lab_of(v)[0]))
        self.look_names = list(looks)
        self.look_idx = {n: i for i, n in enumerate(self.look_names)}
        self.look_rgb = [[[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in looks[n]] for n in self.look_names]
        self.soil_rgb = [[int(s["colour"][i:i + 2], 16) for i in (1, 3, 5)] for s in soils]
        self.marine, self.marine_names = marine, marine_names
        self.cache = {}

    def rank(self, target, strict):
        tl = [lab_of(c) for c in target]
        out = []
        for w, p in enumerate(self.paint):
            pal, turn = aim_at(target, p)
            out.append((lch_dist(tl, [lab_of(c) for c in pal]) + (8 if strict else 2) * abs(turn), w, pal))
        out.sort(key=lambda o: o[0])
        return [with_stops(o[2]) for o in out[:5]]

    def rank_water(self, target):
        tl = [lab_of(c) for c in target]
        mid = tl[1]
        out = []
        for w, p in enumerate(self.paint):
            wet = [c for c in p if is_water_colour(c)]
            if not wet:
                continue
            def d(q):
                L = lab_of(q)
                return math.hypot(L[0] - mid[0], L[1] - mid[1], math.sin((L[2] - mid[2]) / 2) * 2 * math.sqrt(L[1] * mid[1]))
            c = min(wet, key=d)
            pale = p[2]
            hp = hls_of(pale)
            cool = 150 <= hp[0] <= 260 or hp[2] < 0.15
            base = [[v / PHI for v in c], c, pale if cool and lum(pale) > lum(c) else [v + (255 - v) / PHI for v in c]]
            pal, turn = aim_at(target, base)
            out.append((lch_dist(tl, [lab_of(q) for q in pal]) + 8 * abs(turn), w, pal))
        if len(out) < 5:
            return None
        out.sort(key=lambda o: o[0])
        return [with_stops(o[2]) for o in out[:5]]

    def palettes(self, key):
        if key not in self.cache:
            look, rest = divmod(key, 64)
            name, t = self.look_names[look], self.look_rgb[look]
            if rest != 63:
                soil, a = rest // 3, [0, PHI ** -2, PHI ** -1][rest % 3]
                s = self.soil_rgb[soil]
                sp = [[q / PHI for q in s], s, [q + (255 - q) * PHI ** -2 for q in s]]
                t = [[q + (sp[i][j] - q) * a for j, q in enumerate(c)] for i, c in enumerate(t)]
            water = name.startswith("sea") or name == "lake"
            self.cache[key] = (self.rank_water(t) if water else None) or self.rank(t, water or name in ("lake", "ice", "snow", "salt"))
        return self.cache[key]

    def sea_look(self, zone, warmth):
        name = self.marine_names[zone] if zone < len(self.marine_names) else None
        m = self.marine.get(name) if name else None
        if m and m.get("look"):
            return self.look_idx[m["look"]]
        if warmth == 0:
            return self.look_idx["sea, tropical shallows" if name == "shelf" else "sea, tropical"]
        return self.look_idx[["sea, tropical", "sea, subtropical", "sea, temperate", "sea, polar"][min(3, warmth)]]


# ---- the atlas at half a degree ------------------------------------------------------------------------------
def rgb(path):
    return np.asarray(Image.open(path).convert("RGB"))


def half(a):
    h, w, c = a.shape
    return a.reshape(h // 2, 2, w // 2, 2, c).mean(axis=(1, 3)).round().astype(np.uint8)


def monthly(atlas, name):
    """Twelve half-degree layers (codes), as the page reads them."""
    out = []
    for q in range(4):
        im = half(rgb(atlas / f"{name}-{q}.png"))
        out += [im[..., k] for k in range(3)]
    return out


smooth = lambda a, b, x: np.clip((x - a) / (b - a), 0, 1) ** 2 * (3 - 2 * np.clip((x - a) / (b - a), 0, 1))
temp_of = lambda v: v / 255 * 127.5 - 60
rain_of = lambda v: np.expm1(v / 255 * math.log1p(60))
arid_of = lambda v: np.exp(v / 255 * (math.log(30) - math.log(1e-3)) + math.log(1e-3))
PHEN = {"evergreen": 0, "deciduous": 1, "boreal": 1, "wet-dry": 2, "mediterranean": 3, "tundra": 4, "desert": 5, "ice": 6, "grassland": 7}
PHASES = ["green", "fresh", "turning", "bare", "dry", "bloom"]


def phase(ph, T, Tp, P, Pn, Pm):
    """ePhase over arrays: 0 green, 1 fresh, 2 turning, 3 bare, 4 dry, 5 bloom."""
    z = np.zeros(T.shape, np.int64)
    if ph == 0:
        return z
    if ph == 1:
        return np.where(T >= 10, 0, np.where(T < 5, 3, np.where(T > Tp, 1, 2)))
    if ph == 2:
        return np.where(P >= 3, 0, np.where(P < 1, 4, np.where(Pn > P, 0, 4)))
    if ph == 3:
        return np.where((P >= 1.5) & (T < 20), 0, 4)
    if ph == 4:
        return np.where(T > 3, 0, 3)
    if ph == 5:
        return np.where((P >= 1) & (P >= 2 * Pm), 5, 3)
    if ph == 7:
        return np.where(T < 5, 3, np.where(P < 1.5, 4, np.where((T < 10) & (T > Tp), 1, 0)))
    return z + 3


def dress(atlas, tokens, tile_path, out):
    atlas, out = Path(atlas), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    meta = json.loads((atlas / "atlas.json").read_text())
    G = json.loads((atlas / "grammar-engine.json").read_text())
    match = Matcher(tokens, G["looks"], meta["soils"], G["marine"], [m["name"] for m in meta["marine"]])
    place, ground, water = rgb(atlas / "place.png"), rgb(atlas / "ground.png"), rgb(atlas / "water.png")
    pick = lambda a: np.ascontiguousarray(a[::2, ::2])                          # a half-degree cell's first quarter
    surf, soil, canopy, arid = pick(place[..., 2]).astype(np.int64), pick(ground[..., 0]).astype(np.int64), pick(ground[..., 1]) * 45 / 255, arid_of(pick(ground[..., 2]).astype(float))
    wbits, zone = pick(water[..., 0]).astype(np.int64), pick(water[..., 1]).astype(np.int64)
    warmth = pick(water[..., 2]).astype(np.int64)
    zone = np.where(zone == 255, 15, zone & 15)
    mT, mP, mS = monthly(atlas, "temp"), monthly(atlas, "rain"), monthly(atlas, "snow")
    Pm = sum(rain_of(a.astype(float)) for a in mP) / 12
    H, W = surf.shape
    jj, ii = np.mgrid[0:H, 0:W]
    ci, cj = 2 * ii, 2 * jj                                                      # the quarter-degree cell, as the globe hashes it
    tile = np.asarray(Image.open(tile_path).convert("RGBA"))
    cell = tile.shape[0] // 256
    tcol = tile[0::cell, 0::cell, :3].astype(float)
    on = tile[..., 3] > 0
    tsize = sum(on[k::cell, k::cell].astype(int) for k in range(cell))
    # The tile goes round the world twice and pole to pole once, read from the south as the globe reads it.
    u = np.floor((ii + 0.5) / W * 2 * 256).astype(int) % 256
    v = np.floor((1 - (jj + 0.5) / H) * 256).astype(int) % 256
    dot_l = 0.3 * tcol[v, u, 0] + 0.59 * tcol[v, u, 1] + 0.11 * tcol[v, u, 2]
    dot_size = np.minimum(3, tsize[v, u])
    biomes = G["biomes"]
    L = match.look_idx
    key_of = lambda look, soil_a, bare: look * 64 + np.where(soil_a < 0, 63, soil_a * 3 + np.minimum(2, np.floor(bare * 3).astype(np.int64)))
    written = []
    for m in range(12):
        mp, mn = (m + 11) % 12, (m + 1) % 12
        T, Tp, P, Pn, SN = temp_of(mT[m].astype(float)), temp_of(mT[mp].astype(float)), rain_of(mP[m].astype(float)), rain_of(mP[mn].astype(float)), mS[m] / 255
        key = np.full((H, W), -1, np.int64)
        even = np.zeros((H, W), bool)
        # The sea, lakes, ice, salt and snow, as the globe dresses them.
        sea = surf == 255
        sea_key = np.vectorize(lambda z, w: match.sea_look(int(z), int(w)))(zone, warmth) * 64 + 63
        key = np.where(sea, np.where(SN > 0.5, L["ice"] * 64 + 63, sea_key), key)
        key = np.where(surf == 254, np.where(T < -3, L["ice"] * 64 + 63, L["lake"] * 64 + 63), key)
        land = surf <= 15
        ice = land & (((wbits & (4 | 32)) > 0) | (surf == 15))
        key = np.where(ice, L["ice"] * 64 + 63, key)
        salt = land & ~ice & ((wbits & 8) > 0)
        key = np.where(salt, L["salt"] * 64 + 63, key)
        snowy = land & ~ice & ~salt & (SN > 0.5)
        key = np.where(snowy, L["snow"] * 64 + 63, key)
        even |= sea | (surf == 254) | ice | salt | snowy
        rest = land & ~ice & ~salt & ~snowy
        for b in range(1, 16):
            here = rest & (surf == b)
            if not here.any():
                continue
            B = biomes[str(b)]
            looks = [L[B["looks"].get(ph) or B["looks"].get("green") or B["looks"].get("bare")] for ph in PHASES]
            ph = phase(PHEN[B["phenology"]], T, Tp, P, Pn, Pm)
            typ = B["typical canopy m"]
            trees = b in (1, 2, 3, 4, 5, 6, 14)
            bare = np.ones((H, W)) if not typ else (1 - smooth(0, 1, canopy / typ) if trees else 1 - smooth(PHI ** -8, PHI ** -1.5, arid))
            key = np.where(here, key_of(np.array(looks)[ph], soil, bare), key)
            if b == 13:
                even |= here & (soil == 4)
        # Every look's five palettes, and which a cell wears: the globe's choice, a 2-degree block at a time.
        uk = np.unique(key[key >= 0])
        pals = {int(k): match.palettes(int(k)) for k in uk}
        choice = h3(ci >> 3, cj >> 3, np.maximum(key, 0)).astype(np.int64)
        stops = np.zeros((H, W, 5, 3))
        for k in uk:
            k = int(k)
            sel = key == k
            n = len(pals[k])
            options = np.array(pals[k])                                          # n x 5 x 3
            stops[sel] = options[choice[sel] % n]
        band = np.concatenate([stops[:, :, 1], stops[:, :, 2], stops[:, :, 3]], axis=0)
        Image.fromarray(np.clip(band, 0, 255).round().astype(np.uint8)).save(out / f"earth-palette-{m + 1:02d}.png", optimize=True)
        # DIRT's dots, dressed.
        t = np.clip((dot_l - 34) / 144, 0, 1)
        t = np.where(even, 0.42 + (t - 0.42) / PHI, t)
        at = np.array([0, PHI ** -4, 0.42, 1 - PHI ** -4, 1])
        n = np.clip(np.searchsorted(at, t, side="right") - 1, 0, 3)
        f = np.clip((t - at[n]) / (at[n + 1] - at[n]), 0, 1)[..., None]
        a = np.take_along_axis(stops, n[..., None, None].repeat(3, -1), 2)[:, :, 0]
        b2 = np.take_along_axis(stops, (n + 1)[..., None, None].repeat(3, -1), 2)[:, :, 0]
        col = a + (b2 - a) * f
        rgba = np.zeros((H, W, 4), np.uint8)
        rgba[..., :3] = np.clip(col, 0, 255).round().astype(np.uint8)
        rgba[..., 3] = (dot_size * 85).astype(np.uint8)
        rgba[dot_size == 0, :3] = 0
        Image.fromarray(rgba, "RGBA").save(out / f"earth-dirt-{m + 1:02d}.png", optimize=True)
        written.append(m + 1)
        print(MONTHS[m], len(uk), "looks")
    return written


def preview(out):
    """The year at a glance: each month's dressed dots over the ground, four across."""
    out = Path(out)
    ims = []
    for m in range(12):
        a = np.asarray(Image.open(out / f"earth-dirt-{m + 1:02d}.png"))
        ground = np.array([15, 10, 7], float)
        al = a[..., 3:4] / 255
        img = (a[..., :3] * al + ground * (1 - al)).astype(np.uint8)
        ims.append(Image.fromarray(img).resize((360, 180), Image.LANCZOS))
    sheet = Image.new("RGB", (4 * 364, 3 * 200), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for m, im in enumerate(ims):
        x, y = (m % 4) * 364, (m // 4) * 200
        sheet.paste(im, (x, y + 18))
        d.text((x + 3, y + 3), MONTHS[m], fill=(255, 255, 255))
    sheet.save(out / "preview-year.png", optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--plane", required=True, help="DIRT's plane.json (in dirt/private), for the paintings' colours")
    ap.add_argument("--atlas", default=str(HERE / "out"))
    ap.add_argument("--tile", default=str(HERE.parent / "out" / "collection-soil-dots.png"))
    ap.add_argument("--out", default=str(HERE / "site"))
    args = ap.parse_args()
    works = json.loads(Path(args.plane).read_text())["works"]
    tokens = [[[int(h[i:i + 2], 16) for i in (1, 3, 5)] for h in w["colors"]] for w in works]
    dress(args.atlas, tokens, args.tile, args.out)
    preview(args.out)
    print(Path(args.out) / "preview-year.png")


if __name__ == "__main__":
    main()
