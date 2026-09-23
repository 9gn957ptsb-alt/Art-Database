#!/usr/bin/env python3
"""DIRT Earth: the conditions of every place on Earth, on the globe's own quarter-degree grid.

The Artist Website's globe is woven on a 1440 x 720 grid (a quarter degree a cell, column 0 at 180 W,
row 0 at 90 N; scripts/build_earth.py on the website's branch). This writes, on that same grid, the
hierarchies by which an environment is described, so that DIRT can shape every place by its own
conditions the way it shapes a rainforest:

  life        biogeographic realm > biome > ecoregion                 RESOLVE Ecoregions 2017
  climate     Koppen-Geiger class, Holdridge life zone               derived from the monthly means
  the year    monthly temperature, rain, snowfall, snow cover and     NASA POWER (MERRA-2) climatology
              sea ice; the annual and daily temperature ranges,
              growing season, frost and snow months, seasonality
  sky         monthly cloud amount, cloud thickness, clear days,     NASA POWER (CERES SYN1deg)
              aerosol haze; cloud types (derived)
  view        how far one sees: haze, clear days, the canopy's       derived
              closure and the terrain's openness
  ground      elevation and ocean depth, relief                      Mapzen/AWS terrain tiles
              vegetation height, soil wetness, aridity               MERRA-2; Thornthwaite PET
              soil order and its colour                              derived from climate, biome, terrain
  water       lakes, rivers, glaciers, salt flats, reefs              Natural Earth
  sea         depth zone, warmth, upwelling, gyres, reefs, sea ice   derived

Google Earth cannot be reached from the session that built this (its network policy refuses google.com),
and its imagery may not be mined in any case, so every source here is open data. The downloads go to
--cache, which is not committed. The outputs in dirt/earth/out/ are derived rasters and tables, with
their sources credited in atlas.json.

    python3 dirt/earth/build_atlas.py [--cache dirt/earth/cache] [--out dirt/earth/out]
"""

import argparse
import concurrent.futures as cf
import io
import json
import math
import urllib.request
from pathlib import Path

import numpy as np
import rasterio.features
import shapefile
from PIL import Image
from rasterio.transform import from_origin
from scipy import ndimage

from power import Power

HERE = Path(__file__).resolve().parent
W, H = 1440, 720                                    # a quarter degree a cell, as the globe
LON = -180 + (np.arange(W) + 0.5) * 0.25
LAT = 90 - (np.arange(H) + 0.5) * 0.25
TRANSFORM = from_origin(-180, 90, 0.25, 0.25)
DAYS = np.array([31, 28.25, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
PHI = (1 + 5 ** 0.5) / 2
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/{}.geojson"
ECO_URL = "https://storage.googleapis.com/teow2016/Ecoregions2017.zip"
TERRAIN = "https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png"


def fetch(url, path):
    path = Path(path)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url, timeout=600) as r:
            path.write_bytes(r.read())
    return path


def rasterize(shapes, all_touched=False, dtype="int32"):
    shapes = [(g, v) for g, v in shapes if g]
    if not shapes:
        return np.zeros((H, W), dtype)
    return rasterio.features.rasterize(shapes, out_shape=(H, W), transform=TRANSFORM, fill=0,
                                       all_touched=all_touched, dtype=dtype)


def resample(field, lat, lon):
    """Bilinear from a regular lat/lon grid (rows ascending south to north, lon ascending, wrapping)
    onto the quarter-degree grid. NaNs are filled from their nearest neighbours first."""
    f = field.astype(np.float64)
    bad = ~np.isfinite(f)
    if bad.any():
        idx = ndimage.distance_transform_edt(bad, return_distances=False, return_indices=True)
        f = f[tuple(idx)]
    dlat, dlon = lat[1] - lat[0], lon[1] - lon[0]
    fy = np.clip((LAT - lat[0]) / dlat, 0, len(lat) - 1.000001)
    fx = ((LON - lon[0]) / dlon) % len(lon)
    y0, x0 = np.floor(fy).astype(int), np.floor(fx).astype(int)
    ty, tx = (fy - y0)[:, None], (fx - x0)[None, :]
    y1, x1 = np.minimum(y0 + 1, len(lat) - 1), (x0 + 1) % len(lon)
    a, b = f[y0][:, x0], f[y0][:, x1]
    c, d = f[y1][:, x0], f[y1][:, x1]
    return ((a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty).astype(np.float32)


# ---- Natural Earth: land, water, ice, named places ------------------------------------------------

def natural_earth(cache):
    def load(name):
        return json.loads(fetch(NE.format(name), Path(cache) / "ne" / f"{name}.geojson").read_text())

    def polys(name, value=1, all_touched=False):
        fc = load(name)
        return rasterize([(f["geometry"], value) for f in fc["features"]], all_touched)

    land = polys("ne_50m_land") > 0
    # Lakes and the Caspian: holes in the land that are not sea.
    lakes = polys("ne_50m_lakes") > 0
    rivers = rasterize([(f["geometry"], 1) for f in load("ne_50m_rivers_lake_centerlines")["features"]], True) > 0
    glaciers = polys("ne_50m_glaciated_areas", all_touched=False) > 0
    shelves = polys("ne_50m_antarctic_ice_shelves_polys") > 0
    playas = polys("ne_10m_playas") > 0
    reefs = rasterize([(f["geometry"], 1) for f in load("ne_10m_reefs")["features"]], True) > 0
    # Named physical regions (deserts, ranges, plains, basins...) and seas, for naming a place.
    regions, region_names = np.zeros((H, W), np.int32), []
    for f in load("ne_50m_geography_regions_polys")["features"]:
        p = f["properties"]
        region_names.append({"name": p.get("name") or p.get("NAME"), "kind": (p.get("featurecla") or p.get("FEATURECLA") or "").lower()})
        r = rasterize([(f["geometry"], len(region_names))])
        regions[(r > 0) & (regions == 0)] = r[(r > 0) & (regions == 0)]
    seas, sea_names = np.zeros((H, W), np.int32), []
    for f in load("ne_50m_geography_marine_polys")["features"]:
        p = f["properties"]
        sea_names.append({"name": p.get("name") or p.get("NAME"), "kind": (p.get("featurecla") or p.get("FEATURECLA") or "").lower()})
        r = rasterize([(f["geometry"], len(sea_names))])
        seas[(r > 0) & (seas == 0)] = r[(r > 0) & (seas == 0)]
    return dict(land=land & ~lakes, lakes=lakes, rivers=rivers & land, glaciers=glaciers | shelves, shelves=shelves,
                playas=playas, reefs=reefs & ~land, regions=regions, region_names=region_names, seas=seas, sea_names=sea_names)


# ---- RESOLVE ecoregions: realm > biome > ecoregion ------------------------------------------------

BIOMES = [
    None,
    "Tropical & Subtropical Moist Broadleaf Forests", "Tropical & Subtropical Dry Broadleaf Forests",
    "Tropical & Subtropical Coniferous Forests", "Temperate Broadleaf & Mixed Forests", "Temperate Conifer Forests",
    "Boreal Forests/Taiga", "Tropical & Subtropical Grasslands, Savannas & Shrublands",
    "Temperate Grasslands, Savannas & Shrublands", "Flooded Grasslands & Savannas", "Montane Grasslands & Shrublands",
    "Tundra", "Mediterranean Forests, Woodlands & Scrub", "Deserts & Xeric Shrublands", "Mangroves",
    "Rock & Ice",
]
REALMS = ["", "Afrotropic", "Antarctica", "Australasia", "Indomalayan", "Nearctic", "Neotropic", "Oceania", "Palearctic"]


def ecoregions(cache, land):
    z = fetch(ECO_URL, Path(cache) / "Ecoregions2017.zip")
    import zipfile
    with zipfile.ZipFile(z) as zf:
        shp = shapefile.Reader(shp=io.BytesIO(zf.read("Ecoregions2017.shp")), dbf=io.BytesIO(zf.read("Ecoregions2017.dbf")),
                               shx=io.BytesIO(zf.read("Ecoregions2017.shx")), encoding="latin1")
        table, shapes = [None], []
        for sr in shp.iterShapeRecords():
            rec = sr.record.as_dict()
            biome = int(rec["BIOME_NUM"] or 0)
            name = rec["ECO_NAME"]
            if rec["BIOME_NAME"] in ("N/A", None) or name == "Rock and Ice":
                biome = 15
            table.append({"name": name, "biome": biome, "realm": REALMS.index(rec["REALM"]) if rec["REALM"] in REALMS else 0,
                          "colour": (rec["COLOR"] or "#888888").lower()})
            shapes.append((sr.shape.__geo_interface__, len(table) - 1))
    eco = rasterize(shapes)
    # Land the ecoregions miss at a quarter degree (small islands, coasts) takes the nearest ecoregion.
    miss = land & (eco == 0)
    if miss.any():
        idx = ndimage.distance_transform_edt(eco == 0, return_distances=False, return_indices=True)
        eco[miss] = eco[tuple(idx)][miss]
    eco[~land] = 0
    return eco, table


# ---- Terrain: elevation and ocean depth -----------------------------------------------------------

def terrain(cache, z=5):
    n = 2 ** z
    def tile(xy):
        x, y = xy
        p = fetch(TERRAIN.format(z=z, x=x, y=y), Path(cache) / "terrain" / f"{z}-{x}-{y}.png")
        a = np.asarray(Image.open(p).convert("RGB"), np.float32)
        return xy, a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
    merc = np.zeros((n * 256, n * 256), np.float32)
    with cf.ThreadPoolExecutor(16) as ex:
        for (x, y), e in ex.map(tile, [(x, y) for x in range(n) for y in range(n)]):
            merc[y * 256:(y + 1) * 256, x * 256:(x + 1) * 256] = e
    # Sample 4 x 4 points in each quarter-degree cell: its mean height and its relief.
    size = n * 256
    sub = (np.arange(4) + 0.5) / 4 * 0.25
    lats = (90 - np.arange(H)[:, None] * 0.25 - sub[None, :]).reshape(-1)
    lons = (-180 + np.arange(W)[:, None] * 0.25 + sub[None, :]).reshape(-1)
    la = np.clip(np.radians(lats), -1.4844, 1.4844)
    py = np.clip(((1 - np.log(np.tan(la) + 1 / np.cos(la)) / math.pi) / 2 * size).astype(int), 0, size - 1)
    px = np.clip(((lons + 180) / 360 * size).astype(int), 0, size - 1)
    samples = merc[py[:, None], px[None, :]].reshape(H, 4, W, 4)
    return samples.mean(axis=(1, 3)), samples.max(axis=(1, 3)) - samples.min(axis=(1, 3))


# ---- Classifications --------------------------------------------------------------------------------

KOPPEN = ["Af", "Am", "Aw", "BWh", "BWk", "BSh", "BSk", "Csa", "Csb", "Csc", "Cwa", "Cwb", "Cwc", "Cfa", "Cfb", "Cfc",
          "Dsa", "Dsb", "Dsc", "Dsd", "Dwa", "Dwb", "Dwc", "Dwd", "Dfa", "Dfb", "Dfc", "Dfd", "ET", "EF"]
KOPPEN_NAMES = {
    "Af": "tropical rainforest", "Am": "tropical monsoon", "Aw": "tropical savanna", "BWh": "hot desert", "BWk": "cold desert",
    "BSh": "hot steppe", "BSk": "cold steppe", "Csa": "hot-summer Mediterranean", "Csb": "warm-summer Mediterranean",
    "Csc": "cold-summer Mediterranean", "Cwa": "monsoon-influenced humid subtropical", "Cwb": "subtropical highland",
    "Cwc": "cold subtropical highland", "Cfa": "humid subtropical", "Cfb": "temperate oceanic", "Cfc": "subpolar oceanic",
    "Dsa": "hot-summer dry-summer continental", "Dsb": "warm-summer dry-summer continental", "Dsc": "dry-summer subarctic",
    "Dsd": "dry-summer extremely cold subarctic", "Dwa": "monsoon-influenced hot-summer continental",
    "Dwb": "monsoon-influenced warm-summer continental", "Dwc": "monsoon-influenced subarctic",
    "Dwd": "monsoon-influenced extremely cold subarctic", "Dfa": "hot-summer humid continental",
    "Dfb": "warm-summer humid continental", "Dfc": "subarctic", "Dfd": "extremely cold subarctic", "ET": "tundra", "EF": "ice cap"}


def koppen(T, P, lat):
    """Koppen-Geiger class per cell from monthly mean temperature (C) and precipitation (mm/month),
    after Peel et al. (2007) and Beck et al. (2018): summer is April-September in the north."""
    MAT, MAP = T.mean(0), P.sum(0)
    Thot, Tcold, T10 = T.max(0), T.min(0), (T > 10).sum(0)
    north = (lat >= 0)[:, None] * np.ones((1, W), bool)
    summer = np.zeros((12, H, W), bool)
    summer[3:9] = north
    summer[[0, 1, 2, 9, 10, 11]] = ~north
    big = 1e9
    Ps_dry = np.where(summer, P, big).min(0)
    Pw_dry = np.where(~summer, P, big).min(0)
    Ps_wet = np.where(summer, P, -big).max(0)
    Pw_wet = np.where(~summer, P, -big).max(0)
    Pdry = P.min(0)
    Pw_sum, Ps_sum = np.where(~summer, P, 0).sum(0), np.where(summer, P, 0).sum(0)
    Pth = np.where(Pw_sum >= 0.7 * MAP, 2 * MAT, np.where(Ps_sum >= 0.7 * MAP, 2 * MAT + 28, 2 * MAT + 14))
    out = np.full((H, W), -1, np.int16)
    k = {c: i for i, c in enumerate(KOPPEN)}
    E = Thot < 10
    B = ~E & (MAP < 10 * Pth)
    A = ~E & ~B & (Tcold >= 18)
    Ccls = ~E & ~B & ~A & (Tcold > 0)
    D = ~E & ~B & ~A & (Tcold <= 0)
    out[E] = np.where(Thot > 0, k["ET"], k["EF"])[E]
    hot = MAT >= 18
    bw = MAP < 5 * Pth
    out[B & bw & hot], out[B & bw & ~hot] = k["BWh"], k["BWk"]
    out[B & ~bw & hot], out[B & ~bw & ~hot] = k["BSh"], k["BSk"]
    out[A & (Pdry >= 60)] = k["Af"]
    out[A & (Pdry < 60) & (Pdry >= 100 - MAP / 25)] = k["Am"]
    out[A & (Pdry < 60) & (Pdry < 100 - MAP / 25)] = k["Aw"]
    s = (Ps_dry < 40) & (Ps_dry < Pw_wet / 3)
    w = ~s & (Pw_dry < Ps_wet / 10)
    a = Thot >= 22
    b = ~a & (T10 >= 4)
    d = ~a & ~b & (Tcold < -38)
    for cls, mask in (("C", Ccls), ("D", D)):
        for p, pm in (("s", s), ("w", w), ("f", ~s & ~w)):
            m = mask & pm
            out[m & a] = k[cls + p + "a"]
            out[m & b] = k[cls + p + "b"]
            if cls == "D":
                out[m & ~a & ~b & d] = k[cls + p + "d"]
                out[m & ~a & ~b & ~d] = k[cls + p + "c"]
            else:
                out[m & ~a & ~b] = k[cls + p + "c"]
    return out


BELTS = ["polar", "subpolar", "boreal", "cool temperate", "warm temperate", "subtropical", "tropical"]
HOLDRIDGE_ZONES = {
    "polar": ["desert"] * 8,
    "subpolar": ["dry tundra", "dry tundra", "dry tundra", "dry tundra", "dry tundra", "moist tundra", "wet tundra", "rain tundra"],
    "boreal": ["desert", "desert", "desert", "desert", "dry scrub", "moist forest", "wet forest", "rain forest"],
    "cool temperate": ["desert", "desert", "desert", "desert scrub", "steppe", "moist forest", "wet forest", "rain forest"],
    "warm temperate": ["desert", "desert", "desert scrub", "thorn steppe", "dry forest", "moist forest", "wet forest", "rain forest"],
    "subtropical": ["desert", "desert", "desert scrub", "thorn woodland", "dry forest", "moist forest", "wet forest", "rain forest"],
    "tropical": ["desert", "desert scrub", "thorn woodland", "very dry forest", "dry forest", "moist forest", "wet forest", "rain forest"],
}
PROVINCES = ["superarid", "perarid", "arid", "semiarid", "subhumid", "humid", "perhumid", "superhumid"]


def holdridge(T, P):
    """Holdridge life zone: a latitudinal belt from biotemperature and a humidity province from the
    ratio of potential evapotranspiration (58.93 x biotemperature) to rainfall."""
    bt = np.clip(T, 0, 30).mean(0)
    MAP = np.maximum(P.sum(0), 1)
    ratio = bt * 58.93 / MAP
    belt = np.digitize(bt, [1.5, 3, 6, 12, 18, 24])
    # provinces from the ratio: >16 superarid ... <0.25 superhumid
    prov = 7 - np.digitize(ratio, [0.25, 0.5, 1, 2, 4, 8, 16])
    names, index = [], {}
    zone = np.zeros((H, W), np.int16)
    for bi, b in enumerate(BELTS):
        for pi in range(8):
            nm = f"{b} {HOLDRIDGE_ZONES[b][pi]}"
            if nm not in index:
                index[nm] = len(names)
                names.append(nm)
            zone[(belt == bi) & (prov == pi)] = index[nm]
    return zone, names, bt, ratio


def daylength(lat, month):
    """Hours of daylight at mid-month."""
    doy = np.cumsum(DAYS)[month] - DAYS[month] / 2
    dec = 23.44 * math.sin(math.radians(360 / 365 * (doy - 81)))
    x = -np.tan(np.radians(lat)) * math.tan(math.radians(dec))
    return 24 / math.pi * np.arccos(np.clip(x, -1, 1))


def thornthwaite(T):
    """Monthly potential evapotranspiration, mm (Thornthwaite 1948, with Willmott's hot-month form)."""
    Tp = np.maximum(T, 0)
    I = ((Tp / 5) ** 1.514).sum(0)
    a = 6.75e-7 * I ** 3 - 7.71e-5 * I ** 2 + 1.792e-2 * I + 0.49239
    pet = np.zeros_like(T)
    for m in range(12):
        L = daylength(LAT, m)[:, None]
        base = np.where(I > 0, 16 * (10 * Tp[m] / np.maximum(I, 1e-6)) ** a, 0)
        base = np.where(T[m] > 26.5, -415.85 + 32.24 * T[m] - 0.43 * T[m] ** 2, base)
        pet[m] = np.where(T[m] > 0, base * (L / 12) * (DAYS[m] / 30), 0)
    return pet


CLOUDS = [
    ("clear", "few clouds: open sky"),
    ("deep convection", "cumulonimbus towers and anvils, the rain belts and monsoons"),
    ("trade cumulus", "fields and streets of small fair cumulus over the trade winds"),
    ("stratocumulus deck", "a low, closed-cell sheet over cold upwelling water"),
    ("coastal fog", "a marine layer and fog on a desert coast beside a cold sea"),
    ("storm track", "fronts, nimbostratus and comma-shaped storms of the westerlies"),
    ("polar stratus", "low, grey, persistent stratus of the high latitudes"),
    ("orographic", "caps, banners and lenticular wave clouds on mountains"),
    ("cirrus", "high, thin cirrus veils and streaks"),
    ("fair cumulus", "scattered fair-weather cumulus over land"),
    ("broken", "broken mixed cloud"),
]


def cloud_types(CA, OD, P, T, ocean, relief, elev):
    """A cloud regime per cell and month, from the regimes of the satellite cloud atlases, judged from
    cloud amount (%), cloud optical depth, rain (mm/day), temperature, latitude, sea or land and relief."""
    alat = np.abs(LAT)[None, :, None] * np.ones((12, 1, W))
    oc = np.broadcast_to(ocean, CA.shape)
    rel = np.broadcast_to(relief, CA.shape)
    c = np.full(CA.shape, CLOUDS.index(next(x for x in CLOUDS if x[0] == "broken")), np.uint8)
    idx = {n: i for i, (n, _) in enumerate(CLOUDS)}
    c[(CA >= 25) & (alat < 60) & (CA < 65) & ~oc] = idx["fair cumulus"]
    c[(CA >= 25) & (OD < 4)] = idx["cirrus"]
    c[oc & (alat < 35) & (CA >= 25) & (CA < 65) & (P < 3)] = idx["trade cumulus"]
    c[(alat >= 35) & (alat < 70) & (CA >= 65) & (P >= 1.5)] = idx["storm track"]
    c[(alat >= 60) & (CA >= 65) & (P < 1.5)] = idx["polar stratus"]
    deck = oc & (alat >= 10) & (alat <= 40) & (CA >= 65) & (P < 1.2)
    c[deck] = idx["stratocumulus deck"]
    high = np.broadcast_to(elev > 2500, CA.shape)
    c[((rel > 1000) | high) & (CA >= 40) & ~oc] = idx["orographic"]
    c[(alat < 30) & (P > 5) & (CA >= 60)] = idx["deep convection"]
    # Summer thunderstorms over mid-latitude land: warm, wet months under broken cloud.
    c[~oc & (alat >= 25) & (alat < 55) & (T > 20) & (P > 2.5) & (CA >= 40)] = idx["deep convection"]
    # A desert coast beside a deck: fog.
    near = np.stack([ndimage.maximum_filter(deck[m].astype(np.uint8), size=9) > 0 for m in range(12)])
    c[near & ~oc & (P < 0.5)] = idx["coastal fog"]
    c[CA < 25] = idx["clear"]
    return c


SOILS = [
    # name, what it is, colour seen from above
    ("ice", "glacier and ice sheet", "#e8eef3"),
    ("rock", "bare rock and scree", "#7b7771"),
    ("gelisol", "permafrost soil, cryoturbated, peaty", "#4a3e33"),
    ("histosol", "peat, the wettest soils", "#2f241b"),
    ("entisol", "sand seas and young sands", "#c98e52"),
    ("aridisol", "desert soil, pale, with caliche and salts", "#c4ac85"),
    ("vertisol", "dark cracking clay of the seasonal tropics", "#3b3430"),
    ("oxisol", "deep red and yellow laterite of the humid tropics", "#a4472a"),
    ("ultisol", "red clay of the humid subtropics", "#b36533"),
    ("alfisol", "brown forest soil", "#7b5b3b"),
    ("terra rossa", "red Mediterranean soil over limestone", "#99492f"),
    ("mollisol", "deep black grassland soil, chernozem", "#2b231c"),
    ("spodosol", "ash-grey podzol of the northern conifers", "#9a9186"),
    ("inceptisol", "young brown soil of slopes and mountains", "#8d7454"),
    ("andisol", "dark volcanic ash soil", "#35302c"),
]


def soils(biome, kop, MAT, MAP, AI, relief, elev, wet, glaciers, Tcold, pcv):
    """A soil order per land cell, by the rules of soil geography (Jenny's factors: climate, organisms,
    relief), standing in for a soil survey this session cannot reach. Each order has the colour its
    surface typically shows (after Munsell notations for the order)."""
    s = np.full((H, W), [n for n, *_ in SOILS].index("inceptisol"), np.uint8)
    i = {n: k for k, (n, *_) in enumerate(SOILS)}
    kc = np.array(KOPPEN + ["?"])[kop]
    s[(biome == 4)] = i["alfisol"]
    s[(biome == 12)] = i["terra rossa"]
    s[(biome == 8) | ((AI > 0.3) & (AI < 0.75) & (MAT > 0) & (MAT < 15) & np.isin(kc, ["BSk", "Dfa", "Dfb", "Dwa", "Dwb"]))] = i["mollisol"]
    s[np.isin(biome, [6]) | ((biome == 5) & (MAT < 6))] = i["spodosol"]
    s[np.isin(kc, ["Cfa", "Cwa"]) & (MAP > 1000) & (biome != 12)] = i["ultisol"]
    s[np.isin(kc, ["Af", "Am", "Aw"]) & (MAP > 1500) & (relief < 800)] = i["oxisol"]
    s[(AI > 0.3) & (AI < 0.65) & (Tcold >= 10) & (relief < 300) & (pcv > 0.8)] = i["vertisol"]
    s[(AI < 0.2)] = i["aridisol"]
    s[(AI < 0.05) & (relief < 400)] = i["entisol"]
    s[(wet > 0.85) & (relief < 300) & ((MAT < 5) | (biome == 9))] = i["histosol"]
    s[(MAT <= -2)] = i["gelisol"]
    s[(relief > 2000) | ((elev > 4200) & (AI < 1))] = i["rock"]
    s[glaciers | (kc == "EF") | (biome == 15)] = i["ice"]
    return s


MARINE = [
    ("sea ice", "pack ice and floes"),
    ("reef", "coral reef, lagoon and atoll"),
    ("upwelling", "cold, green, teeming coastal upwelling"),
    ("gyre", "the clear, blue, empty middle of an ocean gyre"),
    ("shelf", "the shallow sea over the continental shelf"),
    ("slope", "the continental slope"),
    ("abyss", "the deep ocean floor"),
    ("trench", "a hadal trench"),
]
WATERMARK = ["tropical", "subtropical", "temperate", "polar"]


# ---- the whole atlas ------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=str(HERE / "cache"))
    ap.add_argument("--out", default=str(HERE / "out"))
    args = ap.parse_args()
    out, cache = Path(args.out), Path(args.cache)
    out.mkdir(parents=True, exist_ok=True)

    print("natural earth")
    ne = natural_earth(cache)
    land = ne["land"]
    print("ecoregions")
    eco, eco_table = ecoregions(cache, land)
    biome = np.array([0] + [e["biome"] for e in eco_table[1:]], np.int16)[eco]
    realm = np.array([0] + [e["realm"] for e in eco_table[1:]], np.int16)[eco]
    print("terrain")
    elev, relief = terrain(cache)
    ocean = ~land & ~ne["lakes"]

    print("climate")
    m2 = Power("merra2", cache)
    sy = Power("syn1deg", cache)
    R2 = lambda name: np.stack([resample(m2.month(name, m), m2.lat, m2.lon) for m in range(12)])
    RS = lambda name: np.stack([resample(sy.month(name, m), sy.lat, sy.lon) for m in range(12)])
    A2 = lambda name: resample(m2.month(name, 12), m2.lat, m2.lon)
    AS = lambda name: resample(sy.month(name, 12), sy.lat, sy.lon)
    T = R2("T2M")                                   # C
    Tmax, Tmin = R2("T2M_MAX"), R2("T2M_MIN")       # the month's warmest and coldest hours
    Pday = np.maximum(R2("PRECTOTCORR"), 0)         # mm/day
    P = Pday * DAYS[:, None, None]                  # mm/month
    snowfall = np.maximum(R2("PRECSNO"), 0) * DAYS[:, None, None]
    snow = np.clip(R2("FRSNO"), 0, 1)               # fraction of the ground under snow
    seaice = np.clip(R2("FRSEAICE"), 0, 1)
    wind_u, wind_v = R2("U10M"), R2("V10M")
    rh = A2("RH2M")
    disph, z0m, wet = A2("DISPH"), A2("Z0M"), np.clip(A2("GWETROOT"), 0, 1)
    CA = np.clip(RS("CLOUD_AMT"), 0, 100)
    OD = np.maximum(RS("CLOUD_OD"), 0)
    aod = np.maximum(AS("AOD_55_ADJ"), 0)
    # Clear-sky days are counted over the whole record, month by month; as a share of the month's days:
    clear_n = np.maximum(RS("CLRSKY_DAYS"), 0)
    years = max(1, round(float(np.nanmax(clear_n)) / 31))
    clear_frac_m = np.clip(clear_n / (years * DAYS[:, None, None]), 0, 1)
    albedo = np.clip(AS("ALLSKY_SRF_ALB"), 0, 1)
    day_hours = np.stack([np.broadcast_to(daylength(LAT, m)[:, None], (H, W)) for m in range(12)])

    print("derived")
    MAT, MAP = T.mean(0), P.sum(0)
    Tcold, Thot = T.min(0), T.max(0)
    pet = thornthwaite(T)
    AI = MAP / np.maximum(pet.sum(0), 1)
    pcv = P.std(0) / np.maximum(P.mean(0), 1e-3)
    kop = koppen(T, P, LAT)
    hz, hz_names, biotemp, pet_ratio = holdridge(T, P)
    grow = (T > 5).sum(0)
    frost = (Tmin < 0).sum(0)
    snow_months = (snow > 0.5).sum(0)
    ice_months = (seaice > 0.5).sum(0)
    ctype = cloud_types(CA, OD, Pday, T, ocean, relief, elev)
    ctype_year = np.apply_along_axis(lambda v: np.bincount(v, minlength=len(CLOUDS)).argmax(), 0, ctype).astype(np.uint8)
    # Vegetation height: MERRA-2's zero-plane displacement is about two thirds of the canopy's height.
    canopy = np.clip(disph / 0.67, 0, 45) * land
    # How far one sees. The air: Koschmieder visibility (3.912 over the extinction per km), with clean
    # air's own scattering and the aerosol's optical depth spread through a 3 km haze layer.
    visibility = np.clip(3.912 / (0.0116 + aod / 3), 3, 300)
    # The ground: a closed canopy shuts the view in; hills break it; open level ground holds the whole sky.
    closure = np.clip((canopy - 2) / 18, 0, 1)
    rough = np.clip(np.log1p(relief / 50) / np.log1p(40), 0, 1)
    openness = (1 - 0.9 * closure) * (1 - 0.5 * rough)
    openness = np.where(ocean, 1, openness)
    clear_frac = clear_frac_m.mean(0)
    view_km = np.clip(visibility * openness, 0.05, 300)
    # Big sky: open ground, clear air and clear days, as over the Montana prairie.
    big_sky = np.clip(openness ** PHI * np.clip(visibility / 100, 0, 1) * (1 / PHI + (1 - 1 / PHI) * np.sqrt(clear_frac)), 0, 1)
    soil = soils(biome, kop, MAT, MAP, AI, relief, elev, wet, ne["glaciers"], Tcold, pcv)
    # The sea's zones.
    depth = np.where(ocean, -elev, 0)
    marine = np.full((H, W), 255, np.uint8)
    mi = {n: k for k, (n, _) in enumerate(MARINE)}
    marine[ocean] = mi["abyss"]
    marine[ocean & (depth < 2000)] = mi["slope"]
    marine[ocean & (depth < 200)] = mi["shelf"]
    marine[ocean & (depth > 6000)] = mi["trench"]
    alat = np.abs(LAT)[:, None] * np.ones((1, W))
    gyre = ocean & (depth > 3000) & (alat > 12) & (alat < 38) & (CA.mean(0) < 65) & (Pday.mean(0) < 2)
    marine[gyre] = mi["gyre"]
    deck = (ctype == CLOUDS.index(next(x for x in CLOUDS if x[0] == "stratocumulus deck"))).sum(0) >= 6
    marine[ocean & deck & (depth < 4000) & (alat < 40)] = mi["upwelling"]
    marine[ne["reefs"]] = mi["reef"]
    marine[ocean & (ice_months >= 6)] = mi["sea ice"]
    water_temp = np.digitize(MAT, [8, 18, 25])     # 0 polar ... 3 tropical
    water_temp = (3 - water_temp).astype(np.uint8)

    # ---- write the layers ------------------------------------------------------------------------------
    print("writing")
    q = lambda a, lo, hi: np.clip(np.round((a - lo) / (hi - lo) * 255), 0, 255).astype(np.uint8)
    def png(name, *chans):
        chans = list(chans) + [np.zeros((H, W), np.uint8)] * (3 - len(chans))
        Image.fromarray(np.stack(chans, -1).astype(np.uint8), "RGB").save(out / name, optimize=True)

    ecos = eco.astype(np.int32)
    png("place.png", ecos & 255, ecos >> 8, np.where(land, biome, np.where(ne["lakes"], 254, 255)).astype(np.uint8))
    png("class.png", np.where(kop >= 0, kop, 255).astype(np.uint8), hz.astype(np.uint8), realm.astype(np.uint8))
    e16 = np.clip(np.round(elev) + 11000, 0, 65535).astype(np.int32)
    png("terrain.png", e16 & 255, e16 >> 8, q(np.log1p(relief), 0, np.log1p(8000)))
    for g in range(4):
        ms = range(g * 3, g * 3 + 3)
        png(f"temp-{g}.png", *[q(T[m], -60, 67.5) for m in ms])
        png(f"rain-{g}.png", *[q(np.log1p(Pday[m]), 0, np.log1p(60)) for m in ms])
        png(f"cloud-{g}.png", *[q(CA[m], 0, 100) for m in ms])
        png(f"cloudtype-{g}.png", *[ctype[m] for m in ms])
        png(f"snow-{g}.png", *[q(np.maximum(snow[m], seaice[m]), 0, 1) for m in ms])
    png("range.png", q(Thot - Tcold, 0, 70), q((Tmax - Tmin).mean(0), 0, 30), q(pcv, 0, 3))
    png("sky.png", q(aod, 0, 1.5), q(clear_frac, 0, 1), q(OD.mean(0), 0, 40))
    png("view.png", q(np.log(view_km), np.log(0.05), np.log(300)), q(openness, 0, 1), q(big_sky, 0, 1))
    png("ground.png", soil.astype(np.uint8), q(canopy, 0, 45), q(np.log(np.maximum(AI, 1e-3)), np.log(1e-3), np.log(30)))
    water = (ne["lakes"] * 1 | ne["rivers"] * 2 | ne["glaciers"] * 4 | ne["playas"] * 8 | ne["reefs"] * 16 |
             ne["shelves"] * 32 | ((biome == 9) | (wet > 0.9)) * land * 64).astype(np.uint8)
    png("water.png", water, marine, water_temp)
    png("wind.png", q(wind_u.mean(0), -15, 15), q(wind_v.mean(0), -15, 15), q(np.hypot(wind_u, wind_v).mean(0), 0, 15))
    png("names.png", ne["regions"].astype(np.uint8), ne["seas"].astype(np.uint8), (ne["regions"] >> 8).astype(np.uint8))

    atlas = {
        "note": "DIRT Earth: the conditions of every place on Earth, a quarter degree a cell, on the Artist Website globe's grid. "
                "Built by dirt/earth/build_atlas.py from open data; see sources.",
        "grid": {"w": W, "h": H, "cell_deg": 0.25, "col0_lon": -180, "row0_lat": 90, "order": "row-major from 180W 90N, cell centres"},
        "layers": {
            "place.png": {"r": "ecoregion index, low byte", "g": "ecoregion index, high byte", "b": "biome number (1-14, 15 rock & ice); 254 lake; 255 sea"},
            "class.png": {"r": "Koppen-Geiger class index (255 none)", "g": "Holdridge life zone index", "b": "realm index"},
            "terrain.png": {"r,g": "elevation or ocean depth in metres + 11000, little-endian 16 bit", "b": "relief within the cell, log1p(m) scaled to log1p(8000)"},
            "temp-{0..3}.png": {"rgb": "monthly mean temperature, three months an image (Jan Feb Mar | Apr May Jun | ...), C = v / 255 * 127.5 - 60"},
            "rain-{0..3}.png": {"rgb": "monthly mean precipitation, mm/day = expm1(v / 255 * log1p(60))"},
            "cloud-{0..3}.png": {"rgb": "monthly cloud amount, % = v / 255 * 100"},
            "cloudtype-{0..3}.png": {"rgb": "monthly cloud regime index into cloud_types"},
            "snow-{0..3}.png": {"rgb": "monthly snow cover or sea ice fraction, v / 255"},
            "range.png": {"r": "annual temperature range (warmest - coldest month), C = v / 255 * 70", "g": "mean daily range, C = v / 255 * 30",
                          "b": "precipitation seasonality (coefficient of variation) = v / 255 * 3"},
            "sky.png": {"r": "aerosol optical depth = v / 255 * 1.5", "g": "share of days with clear sky = v / 255", "b": "cloud optical depth = v / 255 * 40"},
            "view.png": {"r": "view distance, km = exp(v / 255 * (ln 300 - ln 0.05) + ln 0.05)", "g": "openness 0-1", "b": "big-sky index 0-1"},
            "ground.png": {"r": "soil order index into soils", "g": "canopy height, m = v / 255 * 45", "b": "aridity index P/PET = exp(v / 255 * (ln 30 - ln 0.001) + ln 0.001)"},
            "water.png": {"r": "bits: 1 lake, 2 river, 4 glacier or ice shelf, 8 salt flat, 16 reef, 32 ice shelf, 64 wetland",
                          "g": "marine zone index into marine (255 land)", "b": "water warmth index into warmth"},
            "wind.png": {"r": "mean eastward wind at 10 m, m/s = v / 255 * 30 - 15", "g": "mean northward wind", "b": "mean wind speed, m/s = v / 255 * 15"},
            "names.png": {"r": "named physical region index, low byte (into regions)", "g": "named sea index (into seas)", "b": "named region, high byte"},
        },
        "realms": REALMS,
        "biomes": BIOMES,
        "ecoregions": eco_table,
        "koppen": [{"code": c, "name": KOPPEN_NAMES[c]} for c in KOPPEN],
        "holdridge": hz_names,
        "cloud_types": [{"name": n, "what": w} for n, w in CLOUDS],
        "soils": [{"name": n, "what": w, "colour": c} for n, w, c in SOILS],
        "marine": [{"name": n, "what": w} for n, w in MARINE],
        "warmth": WATERMARK,
        "regions": ne["region_names"],
        "seas": ne["sea_names"],
        "months": MONTHS,
        "sources": [
            {"what": "realms, biomes and ecoregions", "who": "Dinerstein et al. 2017, An Ecoregion-Based Approach to Protecting Half the Terrestrial Realm (RESOLVE Ecoregions 2017)", "license": "CC BY 4.0", "url": ECO_URL},
            {"what": "monthly temperature, rain, snow, sea ice, humidity, wind, vegetation displacement height, soil wetness", "who": "NASA Langley POWER project, MERRA-2 climatology", "license": "public; cite NASA POWER", "url": "https://nasa-power.s3.amazonaws.com/"},
            {"what": "monthly cloud amount and optical depth, aerosol optical depth, clear-sky days, albedo", "who": "NASA Langley POWER project, CERES SYN1deg climatology", "license": "public; cite NASA POWER", "url": "https://nasa-power.s3.amazonaws.com/"},
            {"what": "elevation and ocean depth", "who": "Mapzen / Linux Foundation terrain tiles on AWS Open Data (SRTM, GMTED, ETOPO1 and others)", "license": "open, with attribution", "url": "https://registry.opendata.aws/terrain-tiles/"},
            {"what": "land, lakes, rivers, glaciers, ice shelves, salt flats, reefs, named regions and seas", "who": "Natural Earth", "license": "public domain", "url": "https://github.com/nvkelso/natural-earth-vector"},
        ],
    }
    (out / "atlas.json").write_text(json.dumps(atlas, ensure_ascii=False))
    stats = {"land cells": int(land.sum()), "ecoregions present": int(len(np.unique(eco[land]))),
             "koppen classes present": int(len(np.unique(kop[land]))), "holdridge zones present": int(len(np.unique(hz[land])))}
    print(json.dumps(stats))


if __name__ == "__main__":
    main()
