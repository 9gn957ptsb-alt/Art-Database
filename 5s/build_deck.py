#!/usr/bin/env python3
"""Build the 5s deck from the art database.

    artworks.db + Artsy artist genes + Artsy images  ->  dist/deck.json, dist/img/*.webp, dist/logo.webp

The deck is drawn from the artist's 5,021 Artsy saves: 80 cards per kind (image, object, space,
surface, colour) where the data allows. Every network result is cached under data/5s/ (artist genes,
gene families, downloaded images, texture analysis), so a re-run is cheap and the script can be
stopped and resumed at any point. Output goes to 5s/dist/, which is gitignored with data/: both hold
Artsy-derived material and the repository is public.

Usage:  python3 5s/build_deck.py [--fetch-only] [--no-logo]
"""
import argparse
import colorsys
import io
import json
import math
import random
import re
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
DATA = REPO / "data" / "5s"
DB = DATA / "artworks.db"
IMG_CACHE = DATA / "images"
ARTISTS_JSON = DATA / "artist_genes.json"
FAMILIES_JSON = DATA / "gene_families.json"
TEXTURE_JSON = DATA / "texture_analysis.json"
SIZES_JSON = DATA / "image_sizes.json"
DIST = HERE / "dist"
OUT_IMG = DIST / "img"
LOGO_SRC = HERE / "logo-source.jpg"

GRAPHQL = "https://metaphysics-production.artsy.net/v2"
GENE_API = "https://api.artsy.net/api/v1/gene/"
UA = "5s-deck-builder/1 (a personal art database; low volume)"

PER_KIND = 80
KINDS = ["image", "object", "space", "surface", "colour"]
LETTER = {"image": "i", "object": "o", "space": "s", "surface": "u", "colour": "c"}
SEED = 5

EXCLUDED_CATEGORIES = {"Ephemera or Merchandise", "Reproduction", "Books and Portfolios",
                       "Video/Film/Animation", "Performance Art", "Other"}
OBJECT_CATEGORIES = {"Design/Decorative Art", "Sculpture", "Textile Arts", "Jewelry",
                     "Fashion Design and Wearable Art"}
SPACE_CATEGORIES = {"Architecture", "Installation"}
PICTURE_CATEGORIES = {"Painting", "Print", "Photography", "Drawing, Collage or other Work on Paper",
                      "Mixed Media", "Posters"}
KEPT_FAMILIES = {"Visual Qualities", "Design Concepts and Techniques", "Styles and Movements",
                 "Subject Matter"}

ERA_BUCKETS = [(1799, "Before 1800"), (1899, "1800s"), (1945, "1900–45"), (1969, "1945–69"),
               (1999, "1970–99"), (2009, "2000s"), (9999, "2010s–now")]


def log(*a):
    print(*a, flush=True)


# ----------------------------------------------------------------------------------------------
# cache helpers
# ----------------------------------------------------------------------------------------------

_json_lock = threading.Lock()


def load_json(path, default):
    try:
        return json.loads(Path(path).read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return default


def save_json(path, obj):
    with _json_lock:
        tmp = Path(str(path) + ".tmp")
        tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=0, sort_keys=True))
        tmp.replace(path)


def http(url, data=None, headers=None, tries=4, timeout=60):
    """GET (or POST with data) through the session proxy, with a few patient retries."""
    err = None
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers={"User-Agent": UA, **(headers or {})})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (400, 401, 403, 404, 410):
                raise
            err = e
        except Exception as e:  # network hiccup: wait and retry
            err = e
        time.sleep(2.0 * (attempt + 1))
    raise err


# ----------------------------------------------------------------------------------------------
# the works
# ----------------------------------------------------------------------------------------------

def load_works():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    colours = {}
    for r in con.execute("SELECT artwork_id, position, hex FROM artwork_colors ORDER BY artwork_id, position"):
        colours.setdefault(r["artwork_id"], []).append(r["hex"].lower())
    artists = {}
    for r in con.execute("SELECT * FROM artwork_artists ORDER BY artwork_id, position"):
        artists.setdefault(r["artwork_id"], []).append(dict(r))
    works = []
    for r in con.execute("SELECT * FROM artworks ORDER BY save_rank"):
        w = dict(r)
        w["colours"] = colours.get(w["id"], [])
        w["artists"] = artists.get(w["id"], [])
        works.append(w)
    con.close()
    return works


def artist_ids(w):
    ids = [a["artist_id"] for a in w["artists"] if a.get("artist_id")]
    if not ids and w.get("artist_id"):
        ids = [w["artist_id"]]
    return ids


def artist_display(w):
    names = [a["artist_name"] for a in w["artists"] if a.get("artist_name")]
    if not names:
        return w.get("artist_name") or "Unknown artist"
    if len(names) == 1:
        return names[0]
    if len(names) == 2:
        return f"{names[0]} and {names[1]}"
    return ", ".join(names[:-1]) + " and " + names[-1]


INFER_CATEGORY = [  # for works the database left without a category: only confident cases
    (r"gelatin silver|silver gelatin|chromogenic|c-print|archival pigment|pigment print|inkjet|ink-jet|"
     r"albumen|platinum print|palladium print|dye transfer|cibachrome|ilfochrome|polaroid|photograph",
     "Photography"),
    (r"lithograph|screenprint|screen print|silkscreen|serigraph|etching|aquatint|drypoint|woodcut|"
     r"linocut|engraving|intaglio", "Print"),
    (r"\boil on\b|\bacrylic on\b|\boil and\b|\bon canvas\b|\bon linen\b|tempera|dispersion on", "Painting"),
    (r"\bon paper\b|charcoal|pastel|pencil|graphite|watercolou?r|gouache|\bink on\b|collage",
     "Drawing, Collage or other Work on Paper"),
    (r"\bbronze\b|fired clay|stoneware|earthenware|porcelain|\bceramic\b|\bmarble\b|cast iron",
     "Sculpture"),
]


def category_of(w):
    if w.get("category"):
        return w["category"]
    med = (w.get("medium") or "").lower()
    for pat, cat in INFER_CATEGORY:
        if re.search(pat, med):
            return cat
    return None


def eligible(w):
    if not w.get("image_url") or len(w["colours"]) < 3 or not w.get("title"):
        return False
    cat = category_of(w)
    return bool(cat) and cat not in EXCLUDED_CATEGORIES


def image_url(w, size):
    return re.sub(r"/large\.jpg$", f"/{size}.jpg", w["image_url"])


# ----------------------------------------------------------------------------------------------
# artist genes (Artsy GraphQL) and gene families (Artsy v1 gene endpoint), cached
# ----------------------------------------------------------------------------------------------

def fetch_artists(ids):
    cache = load_json(ARTISTS_JSON, {})
    todo = [a for a in sorted(set(ids)) if a not in cache]
    log(f"artist genes: {len(ids)} artists, {len(todo)} to fetch")
    batch_size = 20
    for i in range(0, len(todo), batch_size):
        batch = todo[i:i + batch_size]
        fields = "nationality birthday genes { name slug }"
        q = " ".join(f"a{k}: artist(id: {json.dumps(a)}) {{ {fields} }}" for k, a in enumerate(batch))
        body = json.dumps({"query": "{ " + q + " }"}).encode()
        try:
            resp = json.loads(http(GRAPHQL, body, {"Content-Type": "application/json"}))
        except Exception as e:
            log(f"  batch {i // batch_size}: {e}; trying one by one")
            resp = {"data": {}}
            for k, a in enumerate(batch):
                one = json.dumps({"query": f"{{ a{k}: artist(id: {json.dumps(a)}) {{ {fields} }} }}"}).encode()
                try:
                    r1 = json.loads(http(GRAPHQL, one, {"Content-Type": "application/json"}))
                    resp["data"].update(r1.get("data") or {})
                except Exception as e1:
                    log(f"    {a}: {e1}")
                time.sleep(0.3)
        data = resp.get("data") or {}
        for k, a in enumerate(batch):
            v = data.get(f"a{k}")
            cache[a] = v if v else {"missing": True, "genes": []}
        save_json(ARTISTS_JSON, cache)
        log(f"  artists {min(i + batch_size, len(todo))}/{len(todo)}")
        time.sleep(0.5)
    return cache


def fetch_families(slugs):
    cache = load_json(FAMILIES_JSON, {})
    todo = sorted(s for s in set(slugs) if s not in cache)
    log(f"gene families: {len(set(slugs))} genes, {len(todo)} to fetch")
    done = [0]

    def one(slug):
        try:
            g = json.loads(http(GENE_API + slug, headers={"Accept": "application/json"}))
            v = {"name": g.get("name"), "family": (g.get("family") or {}).get("name")}
        except urllib.error.HTTPError as e:
            v = {"name": None, "family": None, "error": e.code}
        except Exception as e:
            log(f"  {slug}: {e}")
            return
        with _json_lock:
            cache[slug] = v
            done[0] += 1
        if done[0] % 50 == 0:
            save_json(FAMILIES_JSON, cache)
            log(f"  genes {done[0]}/{len(todo)}")
        time.sleep(0.25)

    with ThreadPoolExecutor(3) as ex:
        list(ex.map(one, todo))
    save_json(FAMILIES_JSON, cache)
    return cache


# ----------------------------------------------------------------------------------------------
# catalog: materials, era, place
# ----------------------------------------------------------------------------------------------

# Photographic process words are matched first and removed, so "gelatin silver print" is a
# photograph and not silver, and "inkjet" is not ink.
PHOTO_RE = (r"gelatin[- ]silver|silver[- ]gelatin|albumen(?: silver)?|silver dye bleach|dye destruction|"
            r"chromogenic|c-print|\bc print|type[- ]c\b|archival pigment|pigment print|pigmented inkjet|"
            r"ink-?jet|gicl[ée]e|digital (?:c-)?print|lambda|platinum|palladium|cyanotype|dye[- ]transfer|"
            r"dye[- ]sublimation|cibachrome|ilfochrome|polaroid|daguerreotype|tintype|photogravure|"
            r"photograph\w*|\bphoto\b|salt(?:ed)? paper print|fujiflex|diasec")
MATERIAL_TABLE = [
    ("screenprint", r"screen ?-?print\w*|silk ?-?screen\w*|serigraph\w*"),
    ("lithograph", r"lithograph\w*|\blitho\b|offset"),
    ("woodcut", r"woodcut|wood ?block|wood engraving|linocut|lino ?cut|linoleum cut|relief print"),
    ("etching", r"etching|aquatint|drypoint|engraving|intaglio|mezzotint|soft[- ]ground"),
    ("plastic", r"acrylic (?:glass|sheet|box|case|cube|block|panel|mirror)|plexi\w*|perspex|lucite|"
                r"plastic\w*|polycarbonate|polyurethane|polystyrene|polyethylene|polypropylene|vinyl|"
                r"\bpvc\b|silicone|\babs\b|rubber|foam|nylon"),
    ("pastel", r"pastel"),
    ("oil", r"\boils?\b|oil ?stick"),
    ("acrylic", r"acrylic"),
    ("watercolour", r"water ?colou?r"),
    ("gouache", r"gouache"),
    ("ink", r"\binks?\b|sumi|felt[- ]tip|marker"),
    ("graphite", r"graphite|pencil|silverpoint"),
    ("charcoal", r"charcoal|conté|conte crayon"),
    ("tempera", r"tempera"),
    ("canvas", r"canvas"),
    ("linen", r"linen"),
    ("panel", r"panel|masonite|hardboard|\bboard\b|\bmdf\b"),
    ("porcelain", r"porcelain|bone china"),
    ("ceramic", r"ceramic|stoneware|earthenware|terra ?-?cotta|\bclay\b|glazed?\b|raku|faience|majolica|"
                r"maiolica|slip\b"),
    ("marble", r"marble"),
    ("stone", r"\bstone\b|granite|limestone|sandstone|slate|basalt|onyx|travertine|alabaster|soapstone|"
              r"\bjade\b|obsidian|quartz"),
    ("concrete", r"concrete|cement"),
    ("plaster", r"plaster|stucco|hydrocal"),
    ("resin", r"resin|epoxy|fib(?:er|re) ?glass"),
    ("glass", r"glass|crystal"),
    ("bronze", r"bronze"),
    ("steel", r"steel"),
    ("iron", r"\biron\b|wrought"),
    ("aluminium", r"alumin(?:i)?um"),
    ("brass", r"brass"),
    ("copper", r"copper"),
    ("silver", r"silver|sterling"),
    ("gold", r"\bgold|gilt|gilded|gilding"),
    ("wood", r"\bwood(?!cut|block| engraving)\w*|walnut|\boak\b|teak|plywood|birch|maple|\bpine\b|beech|"
             r"mahogany|rosewood|\bash\b|cherry|bamboo|cedar|ebon\w*|veneer|timber|\belm\b|wenge|"
             r"palisander|jacaranda|rattan|cane\b|wicker"),
    ("wool", r"wool|mohair|cashmere|alpaca|merino"),
    ("silk", r"\bsilk\b(?! ?-?screen)"),
    ("cotton", r"cotton"),
    ("felt", r"\bfelt\b(?![- ]tip)"),
    ("leather", r"leather|suede|\bhide\b"),
    ("textile", r"textile|fabric|cloth|tapestry|embroider\w*|weav\w*|woven|thread|yarn|\brugs?\b|carpet|"
                r"quilt\w*|burlap|jute|hemp|denim|velvet|\blace\b|sisal|fib(?:er|re)s?\b|tuft\w*"),
    ("neon", r"\bneon\b|fluorescent (?:light|tube)"),
    ("video", r"\bvideo\b|\bfilm\b|animation"),
    ("found objects", r"found object\w*|readymade|ready-made|objects"),
    ("mixed media", r"mixed[- ]media|assemblage|collage|combine"),
    ("paper", r"paper|card ?board|cardstock|vellum|newsprint|newspaper|\bjapon\b|washi|rives|arches"),
]


def materials_of(medium):
    if not medium:
        return []
    text = medium.lower()
    found = []  # (position, family)
    m = re.search(PHOTO_RE, text)
    if m:
        found.append((m.start(), "photograph"))
        text = re.sub(PHOTO_RE, lambda x: " " * len(x.group(0)), text)
    for fam, pat in MATERIAL_TABLE:
        m = re.search(pat, text)
        if m:
            found.append((m.start(), fam))
            text = text[:m.start()] + " " * (m.end() - m.start()) + text[m.end():] if fam == "plastic" else text
    out = []
    for _, fam in sorted(found):
        if fam not in out:
            out.append(fam)
    # a printmaking process names its own paper; keep "paper" only when it is the support of a drawing
    # or a collage; keep at most five families
    return out[:5]


def parse_year(d):
    if not d:
        return None
    s = d.strip()
    m = re.search(r"(\d{1,4})\s*(?:BCE|B\.C\.E?\.?|BC)\b", s, re.I)
    if m:
        return -int(m.group(1))
    m = re.search(r"(?<!\d)(\d{4})(?!\d)", s)
    if m:
        y = int(m.group(1))
        if 500 <= y <= date.today().year:
            return y
    m = re.search(r"(\d{1,2})(?:st|nd|rd|th)\s+century", s, re.I)
    if m:
        return (int(m.group(1)) - 1) * 100 + 50
    return None


def era_of(y):
    if y is None:
        return None
    for top, name in ERA_BUCKETS:
        if y <= top:
            return name
    return None


DEMONYMS = {
    "american": "United States", "us": "United States", "usa": "United States",
    "french": "France", "british": "United Kingdom", "english": "United Kingdom",
    "scottish": "United Kingdom", "welsh": "United Kingdom", "spanish": "Spain", "catalan": "Spain",
    "italian": "Italy", "german": "Germany", "dutch": "Netherlands", "flemish": "Belgium",
    "japanese": "Japan", "japan": "Japan", "swiss": "Switzerland", "chinese": "China", "russian": "Russia",
    "south korean": "South Korea", "korean": "South Korea", "korea": "South Korea",
    "australian": "Australia", "colombian": "Colombia", "belgian": "Belgium", "swedish": "Sweden",
    "brazilian": "Brazil", "austrian": "Austria", "canadian": "Canada", "danish": "Denmark",
    "argentine": "Argentina", "argentinian": "Argentina", "hungarian": "Hungary", "finnish": "Finland",
    "cuban": "Cuba", "iranian": "Iran", "south african": "South Africa", "romanian": "Romania",
    "mexican": "Mexico", "guyanese": "Guyana", "kenyan": "Kenya", "chilean": "Chile",
    "armenian": "Armenia", "iraqi": "Iraq", "polish": "Poland", "venezuelan": "Venezuela",
    "uruguayan": "Uruguay", "singaporean": "Singapore", "puerto rican": "Puerto Rico",
    "hong kong": "Hong Kong", "portuguese": "Portugal", "lithuanian": "Lithuania",
    "indonesian": "Indonesia", "filipino": "Philippines", "ethiopian": "Ethiopia",
    "ukrainian": "Ukraine", "ukraninan": "Ukraine", "peruvian": "Peru", "pakistani": "Pakistan",
    "norwegian": "Norway", "israeli": "Israel", "irish": "Ireland", "indian": "India", "greek": "Greece",
    "egyptian": "Egypt", "bulgarian": "Bulgaria", "turkish": "Turkey", "taiwanese": "Taiwan",
    "lebanese": "Lebanon", "guatemalan": "Guatemala", "georgian": "Georgia", "bosnian": "Bosnia and Herzegovina",
    "beninese": "Benin", "zimbabwean": "Zimbabwe", "vietnamese": "Vietnam", "thai": "Thailand",
    "sudanese": "Sudan", "slovene": "Slovenia", "slovenian": "Slovenia", "nigerian": "Nigeria",
    "luxembourgish": "Luxembourg", "latvian": "Latvia", "ivorian": "Côte d'Ivoire", "czech": "Czechia",
    "cypriot": "Cyprus", "burkinabé": "Burkina Faso", "burkinabe": "Burkina Faso", "icelandic": "Iceland",
    "ghanaian": "Ghana", "senegalese": "Senegal", "malian": "Mali", "moroccan": "Morocco",
    "algerian": "Algeria", "tunisian": "Tunisia", "saudi": "Saudi Arabia", "emirati": "United Arab Emirates",
    "syrian": "Syria", "palestinian": "Palestine", "jordanian": "Jordan", "afghan": "Afghanistan",
    "bangladeshi": "Bangladesh", "sri lankan": "Sri Lanka", "nepalese": "Nepal", "malaysian": "Malaysia",
    "new zealand": "New Zealand", "new zealander": "New Zealand", "ecuadorian": "Ecuador",
    "bolivian": "Bolivia", "paraguayan": "Paraguay", "costa rican": "Costa Rica", "panamanian": "Panama",
    "dominican": "Dominican Republic", "haitian": "Haiti", "jamaican": "Jamaica", "trinidadian": "Trinidad and Tobago",
    "croatian": "Croatia", "serbian": "Serbia", "slovak": "Slovakia", "estonian": "Estonia",
    "belarusian": "Belarus", "macedonian": "North Macedonia", "albanian": "Albania", "maltese": "Malta",
    "mongolian": "Mongolia", "cameroonian": "Cameroon", "congolese": "DR Congo", "ugandan": "Uganda",
    "tanzanian": "Tanzania", "zambian": "Zambia", "mozambican": "Mozambique", "angolan": "Angola",
    "namibian": "Namibia", "botswanan": "Botswana", "native american": "United States",
    "indigenous australian": "Australia", "chickasaw": "United States", "tlingit": "United States",
    "salvadoran": "El Salvador", "honduran": "Honduras", "nicaraguan": "Nicaragua", "scandinavian": None,
}


def place_of(nationality):
    if not nationality or not nationality.strip() or nationality.strip().lower() == "unknown":
        return None
    t = nationality.strip()
    low = t.lower()
    # "Austrian-born British", "American (English born)": the later, adopted nationality
    m = re.search(r"-born\s+(.+)$", low)
    if m:
        low = m.group(1)
    low = re.sub(r"\(.*?\)", "", low).strip()
    if low in DEMONYMS and DEMONYMS[low]:
        return DEMONYMS[low]
    for multi in sorted((k for k in DEMONYMS if " " in k), key=len, reverse=True):
        if low.startswith(multi) and DEMONYMS[multi]:
            return DEMONYMS[multi]
    for part in re.split(r"[-/,\s]+|\band\b", low):
        part = part.strip()
        if part in DEMONYMS and DEMONYMS[part]:
            return DEMONYMS[part]
    return t


# ----------------------------------------------------------------------------------------------
# colour: hue names and chords (for spreading the deck; the app has its own FiveS.chord)
# ----------------------------------------------------------------------------------------------

HUE_NAMES = ["red", "orange", "yellow", "lime", "green", "mint", "cyan", "azure", "blue", "violet",
             "magenta", "rose"]


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))


def hsl(h):
    r, g, b = hex_rgb(h)
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    return hh * 360, ss, ll


def chroma(h):
    r, g, b = hex_rgb(h)
    return max(r, g, b) - min(r, g, b)


def is_neutral(h):
    _, s, l = hsl(h)
    return chroma(h) < 0.10 or s < 0.12 or l < 0.07 or l > 0.95


def hue_name(h):
    if is_neutral(h):
        return "neutral"
    hh, _, _ = hsl(h)
    return HUE_NAMES[int(((hh + 15) % 360) // 30)]


def hue_dist(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def chord_of(hexes):
    hues = [hsl(h)[0] for h in hexes if not is_neutral(h)]
    if not hues:
        return "neutral"
    if len(hues) == 1:
        return "accent"
    spread = max(hue_dist(a, b) for a in hues for b in hues)
    if spread <= 20:
        return "monochrome"
    if spread <= 60:
        return "analogous"
    if len(hues) == 2:
        return "complementary" if spread >= 140 else "split"
    # three hues: complementary when two of them sit together and the third faces them
    pairs = sorted(((hue_dist(hues[i], hues[j]), i, j) for i in range(3) for j in range(i + 1, 3)))
    close, i, j = pairs[0]
    k = 3 - i - j
    if close <= 30 and spread >= 140:
        return "complementary"
    return "split"


def main_hue(hexes):
    """The hue of the most chromatic of the three colours, or 'neutral'."""
    best = max(hexes, key=chroma)
    return hue_name(best)


def lum(h):
    r, g, b = hex_rgb(h)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def colour_spread(hexes):
    """How distinct the three colours are (min pairwise RGB distance, 0..~1.7)."""
    rgb = [np.array(hex_rgb(h)) for h in hexes]
    return min(float(np.linalg.norm(rgb[i] - rgb[j])) for i in range(3) for j in range(i + 1, 3))


# ----------------------------------------------------------------------------------------------
# images
# ----------------------------------------------------------------------------------------------

_last_fetch = [0.0]
_fetch_lock = threading.Lock()


def cached_image(w, size):
    """Path of the cached JPEG of a work at an Artsy size (large/larger/normalized), or None."""
    IMG_CACHE.mkdir(parents=True, exist_ok=True)
    path = IMG_CACHE / f"{w['id']}.{size}.jpg"
    bad = IMG_CACHE / f"{w['id']}.{size}.missing"
    if path.exists() and path.stat().st_size > 0:
        return path
    if bad.exists():
        return None
    with _fetch_lock:
        wait = 0.12 - (time.time() - _last_fetch[0])
        if wait > 0:
            time.sleep(wait)
        _last_fetch[0] = time.time()
    try:
        data = http(image_url(w, size), timeout=90)
        Image.open(io.BytesIO(data)).verify()
    except Exception as e:
        log(f"    no {size} image for {w['id']}: {e}")
        bad.write_text(str(e))
        return None
    path.write_bytes(data)
    return path


def open_rgb(path):
    im = Image.open(path)
    im.load()
    return im.convert("RGB")


def best_source(w, sizes=("larger", "large")):
    for s in sizes:
        p = cached_image(w, s)
        if p:
            return p
    return None


# ----------------------------------------------------------------------------------------------
# texture analysis: find the best square window for a Surface card
# ----------------------------------------------------------------------------------------------

def box_mean(a, k):
    """Mean over k x k boxes at every position (valid), via an integral image."""
    c = np.pad(a, ((1, 0), (1, 0))).cumsum(0).cumsum(1)
    return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k]) / (k * k)


def analyse_texture(im, side_frac=0.25, cells=4):
    """Score square windows (side = side_frac of the shorter side) for all-over texture.

    Works on a copy scaled so the window is 96 px. A window scores by the weakest of its 4x4
    sub-cells (so a window with a blank void, a background corner or a smooth sky loses), damped
    when a single line dominates it (a frame edge, a silhouette, a horizon), when much of it is
    near-white or near-black paper/ground (text, blank margins), and kept off the outer 9% (frames,
    mats, borders). Returns dict(score, x, y, s as fractions of the image, density).
    """
    W, H = im.size
    win = 96
    scale = win / (side_frac * min(W, H))
    aw, ah = max(win + 2, round(W * scale)), max(win + 2, round(H * scale))
    small = im.resize((aw, ah), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.8))
    a = np.asarray(small, dtype=np.float32) / 255.0
    L = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    mx, mn = a.max(2), a.min(2)
    sat = mx - mn
    gy, gx = np.gradient(L)
    G = np.hypot(gx, gy)
    # colour gradient too, so a texture of equal-lightness hues still counts
    cg = sum(np.hypot(*np.gradient(a[:, :, c])) for c in range(3)) / 3
    E = np.maximum(G, 0.7 * cg)
    cell = win // cells
    # per-cell mean energy and lightness std at every position, sampled on a stride grid
    e_cell = box_mean(E, cell)
    l_mean = box_mean(L, cell)
    l_sq = box_mean(L * L, cell)
    l_std = np.sqrt(np.maximum(l_sq - l_mean ** 2, 0))
    white = box_mean(((L > 0.90) & (sat < 0.10)).astype(np.float32), win)
    black = box_mean(((L < 0.06)).astype(np.float32), win)
    edge = box_mean((E > 0.045).astype(np.float32), win)
    margin_x, margin_y = int(0.09 * aw), int(0.09 * ah)
    stride = max(4, win // 8)
    best = None
    for y in range(margin_y, ah - win - margin_y + 1, stride):
        for x in range(margin_x, aw - win - margin_x + 1, stride):
            es = np.array([e_cell[y + j * cell, x + i * cell] for j in range(cells) for i in range(cells)])
            ss = np.array([l_std[y + j * cell, x + i * cell] for j in range(cells) for i in range(cells)])
            weakest = float(np.sort(es)[1])          # second-weakest cell: one soft cell is fine
            evenness = float(np.sort(es)[1] / (es.mean() + 1e-6))
            flat = float((ss < 0.025).mean())        # cells with almost no tonal change
            Ew = E[y:y + win, x:x + win]
            rows, cols = Ew.mean(1), Ew.mean(0)
            line = max(rows.max() / (rows.mean() + 1e-6), cols.max() / (cols.mean() + 1e-6))
            line_pen = max(0.0, min(1.0, (line - 2.2) / 2.5))
            wf, bf = float(white[y, x]), float(black[y, x])
            score = weakest * (0.5 + 0.5 * evenness)
            score *= (1 - line_pen * 0.75) * (1 - flat) * (1 - min(1.0, max(0.0, wf - 0.08) * 2.5))
            score *= (1 - min(1.0, max(0.0, bf - 0.15) * 2.0))
            if best is None or score > best["score"]:
                best = {"score": score, "x": x / aw, "y": y / ah, "w": win / aw, "h": win / ah,
                        "density": float(edge[y, x]), "white": wf, "line": float(line),
                        "evenness": evenness}
    return best


def edge_density(im512):
    a = np.asarray(im512.convert("L").filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255
    gy, gx = np.gradient(a)
    return float((np.hypot(gx, gy) > 0.03).mean())


# ----------------------------------------------------------------------------------------------
# kinds
# ----------------------------------------------------------------------------------------------

# Gene slugs (from the genes actually fetched) that mark an artist's work as places or buildings.
PLACE_GENES = {
    "architecture": 3, "architecture-1": 3, "architecture-in-art": 3, "interiors": 3, "interior": 3,
    "cityscapes": 3, "urban-scenes": 2, "urban-landscape": 3, "built-environment": 3,
    "landscapes": 2, "landscape": 2, "seascapes": 2, "light-and-space": 3, "land-art": 3,
    "site-specific": 2, "site-specific-installation": 2, "installation": 1, "immersive": 2,
    "rooms": 3, "buildings": 3, "skyscrapers": 3, "bridges": 3, "streets": 2, "street-scenes": 2,
    "american-landscape-photography": 3, "new-topographics": 3, "architectural-photography": 3,
    "architectural-forms": 2, "modernist-architecture": 3, "ruins": 2, "gardens": 2, "parks": 2,
    "the-american-west": 1, "suburbia": 2, "industrial-landscapes": 3, "nature-landscapes": 2,
    "hudson-river-school": 2, "plein-air-painting": 1, "impressionism": 1, "spatial-concerns": 2,
    "space": 1, "light-art": 2, "environmental-art": 2, "monuments": 2, "cities": 3, "travel": 1,
    "deserts": 2, "mountains": 2, "water": 1, "the-sea": 2, "coastal-scenes": 2, "beach-scenes": 2,
    "rural-life": 1, "domestic-interiors": 3, "views-through-windows": 3, "windows": 2,
}
PLACE_TITLE = (r"\b(interior|room|house|home|building|street|city|cityscape|landscape|view|garden|"
               r"bridge|church|cathedral|chapel|tower|fa[cç]ade|window|harbou?r|port|beach|road|village|"
               r"skyline|avenue|park|river|lake|mountain|valley|coast|sea|seascape|bay|hill|field|"
               r"forest|woods|canyon|desert|plaza|square|courtyard|corridor|hall|staircase|stairs|"
               r"pavilion|villa|temple|ruins?|palace|museum|gallery|studio|kitchen|bedroom|"
               r"apartment|hotel|station|highway|boulevard|rue|via|calle|paris|venice|new york|"
               r"los angeles|london|tokyo|rome|madrid|barcelona|kyoto|berlin|amsterdam|island|"
               r"pool|cabin|barn|farm|town|downtown|suburb|lighthouse|dock|pier|alley|square)s?\b")
OBJECT_MEDIUM = (r"bronze|stoneware|earthenware|porcelain|ceramic|terracotta|marble|cast|carved|"
                 r"welded|steel|wood(?!cut)|glass|resin|plaster|found object|assemblage|clay|iron|"
                 r"aluminum|aluminium|brass|copper|fiberglass|vase|bowl|vessel|chair|lamp|table")
FLAT_MEDIUM = r"\bon (?:canvas|paper|panel|board|linen|wood panel|masonite)\b|print|photograph"


def space_score(w, genes):
    cat = category_of(w)
    title = (w.get("title") or "").lower()
    gscore = sum(PLACE_GENES.get(g, 0) for g in genes)
    tscore = 3 if re.search(PLACE_TITLE, title) else 0
    if cat in SPACE_CATEGORIES:
        return 10 + gscore + tscore
    return gscore + tscore


def kind_candidates(w, genes):
    """The whole-card kinds a work could be: object, space, image (in that order of preference)."""
    cat = category_of(w)
    med = (w.get("medium") or "").lower()
    kinds = []
    if cat in OBJECT_CATEGORIES:
        kinds.append("object")
    elif cat == "Mixed Media" and (w.get("depth_cm") or 0) >= 8 and re.search(OBJECT_MEDIUM, med) \
            and not re.search(FLAT_MEDIUM, med):
        kinds.append("object")
    if cat in SPACE_CATEGORIES:
        kinds.append("space")
    elif cat in PICTURE_CATEGORIES and cat != "Posters":
        sc = space_score(w, genes)
        gmark = sum(PLACE_GENES.get(g, 0) for g in genes)
        title = (w.get("title") or "").lower()
        if gmark >= 2 and re.search(PLACE_TITLE, title):
            kinds.append("space")
    if cat in PICTURE_CATEGORIES and "object" not in kinds:
        kinds.append("image")
    return kinds


# ----------------------------------------------------------------------------------------------
# selection
# ----------------------------------------------------------------------------------------------

class Picker:
    """Greedy, spread-aware selection with the deck-wide artist rules."""

    def __init__(self, rng):
        self.rng = rng
        self.used_works = set()
        self.artist_total = {}
        self.artist_kind = {k: set() for k in KINDS}
        self.cards = {k: [] for k in KINDS}

    def allowed(self, w, kind):
        if w["id"] in self.used_works:
            return False
        for a in artist_ids(w) or [f"anon:{w['id']}"]:
            if self.artist_total.get(a, 0) >= 2 or a in self.artist_kind[kind]:
                return False
        return True

    def take(self, w, kind, extra=None):
        self.used_works.add(w["id"])
        for a in artist_ids(w) or [f"anon:{w['id']}"]:
            self.artist_total[a] = self.artist_total.get(a, 0) + 1
            self.artist_kind[kind].add(a)
        self.cards[kind].append((w, extra or {}))

    def pick(self, kind, pool, quality, n=PER_KIND, validate=None, weights=None, targets=None):
        """Pick n works of a kind from pool. quality(w) -> 0..1. validate(w) -> extra dict or None.

        Each step scores every allowed candidate by its quality plus how under-represented its
        chord, main hue, era and place still are in this kind's selection, with a little seeded noise.
        """
        weights = weights or {"chord": 1.0, "hue": 1.0, "era": 0.8, "place": 0.6}
        counts = {k: {} for k in weights}
        tried = set()
        while len(self.cards[kind]) < n:
            best, best_s = None, -1e9
            for w in pool:
                if w["id"] in tried or not self.allowed(w, kind):
                    continue
                s = 1.6 * quality(w)
                for attr, wt in weights.items():
                    v = w["_attr"][attr]
                    c = counts[attr].get(v, 0)
                    if targets and attr in targets:
                        tgt = targets[attr].get(v, 0)
                        s += wt * (1.0 if c < tgt else 0.0) - wt * 0.35 * c / max(1, tgt)
                    else:
                        s += wt / (1 + c)
                s += self.rng.random() * 0.35
                if s > best_s:
                    best, best_s = w, s
            if best is None:
                break
            tried.add(best["id"])
            extra = {}
            if validate:
                extra = validate(best)
                if extra is None:
                    continue
            self.take(best, kind, extra)
            for attr in weights:
                v = best["_attr"][attr]
                counts[attr][v] = counts[attr].get(v, 0) + 1
            if len(self.cards[kind]) % 10 == 0:
                log(f"  {kind}: {len(self.cards[kind])}/{n}")
        return self.cards[kind]


# ----------------------------------------------------------------------------------------------
# logo
# ----------------------------------------------------------------------------------------------

def build_logo(out, side=256):
    """Crop the logo to its rounded square and make the outside of the corners transparent.

    The source is a JPEG of a rounded square with a blue frame on white, its top edge clipped by a
    pixel or two. The frame's outer edges are found where the blue crosses half coverage, the square
    is completed upward from the measured width, and the corner radius is fitted to the outer edge of
    the two (unclipped) bottom corners. The alpha mask is a supersampled rounded square, inset half a
    pixel so no white JPEG fringe shows outside the frame.
    """
    im = open_rgb(LOGO_SRC)
    a = np.asarray(im, dtype=np.float32)
    H, W, _ = a.shape
    # coverage of the frame's blue: white (r ~ 252) -> 0, frame (r ~ 45..80) -> 1
    cov = np.clip((250.0 - a[:, :, 0]) / 180.0, 0, 1) * (a[:, :, 2] - a[:, :, 0] > 20)

    def crossing(profile):
        """Sub-pixel index where a 0..1 profile first rises through 0.5."""
        idx = np.where(profile >= 0.5)[0]
        if not len(idx):
            return None
        i = int(idx[0])
        if i == 0:
            return 0.0
        p0, p1 = profile[i - 1], profile[i]
        return i - 1 + (0.5 - p0) / max(1e-6, p1 - p0)

    mid = slice(int(H * 0.4), int(H * 0.6))
    lefts = [crossing(cov[y, :]) for y in range(mid.start, mid.stop)]
    rights = [W - 1 - crossing(cov[y, ::-1]) for y in range(mid.start, mid.stop)]
    xs = slice(int(W * 0.4), int(W * 0.6))
    bots = [H - 1 - crossing(cov[::-1, x]) for x in range(xs.start, xs.stop)]
    left, right, bot = float(np.median(lefts)), float(np.median(rights)), float(np.median(bots))
    size = right - left
    top = bot - size

    def fit_radius(edge_of_row, edge0):
        best = None
        rows = np.arange(0, 110)
        insets = []
        for d in rows:
            y = int(round(bot - d))
            e = edge_of_row(y)
            insets.append(None if e is None else abs(e - edge0))
        for R in np.arange(20, 140, 0.5):
            err, n = 0.0, 0
            for d, ins in zip(rows, insets):
                if ins is None or d >= R or d < 1:
                    continue
                pred = R - math.sqrt(max(0.0, R * R - (R - d) ** 2))
                err += (pred - ins) ** 2
                n += 1
            # rows above the corner should have no inset
            for d, ins in zip(rows, insets):
                if ins is not None and d >= R:
                    err += ins ** 2
                    n += 1
            if n and (best is None or err / n < best[0]):
                best = (err / n, R)
        return best[1]

    r_left = fit_radius(lambda y: crossing(cov[y, :]), left)
    def right_edge(y):
        c = crossing(cov[y, ::-1])
        return None if c is None else W - 1 - c

    r_right = fit_radius(right_edge, right)
    radius = (r_left + r_right) / 2
    # complete the clipped top by repeating the first rows, then resample the square
    pad = max(0, int(math.ceil(-top)) + 2)
    src = np.pad(np.asarray(im), ((pad, 0), (0, 0), (0, 0)), mode="edge")
    srcim = Image.fromarray(src)
    box = (left, top + pad, right, bot + pad)
    ss = 4
    big = srcim.transform((side * ss, side * ss), Image.EXTENT, box, Image.BICUBIC)
    rgb = big.resize((side, side), Image.LANCZOS).convert("RGBA")
    mask = Image.new("L", (side * ss, side * ss), 0)
    inset = 0.75 * ss
    rr = radius * side / size * ss
    ImageDraw.Draw(mask).rounded_rectangle([inset, inset, side * ss - 1 - inset, side * ss - 1 - inset],
                                           radius=rr - inset, fill=255)
    rgb.putalpha(mask.resize((side, side), Image.LANCZOS))
    rgb.save(out, "WEBP", lossless=True, quality=100, method=6)
    log(f"logo: frame x {left:.1f}..{right:.1f}, y {top:.1f}..{bot:.1f} ({size:.1f} px square, "
        f"top clipped by {max(0, -top):.1f} px), corner radius {r_left:.1f}/{r_right:.1f} px -> {out.name}")
    return {"box": [left, top, right, bot], "radius": radius}


# ----------------------------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--fetch-only", action="store_true", help="fetch and cache genes, then stop")
    ap.add_argument("--no-logo", action="store_true")
    args = ap.parse_args()

    DIST.mkdir(exist_ok=True)
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    if not args.no_logo:
        build_logo(DIST / "logo.webp")

    works = [w for w in load_works() if eligible(w)]
    log(f"works: {len(works)} eligible")
    ids = sorted({a for w in works for a in artist_ids(w)})
    artists = fetch_artists(ids)
    slugs = {g["slug"] for v in artists.values() for g in (v.get("genes") or []) if g and g.get("slug")}
    families = fetch_families(slugs)
    if args.fetch_only:
        return
    build(works, artists, families)


if __name__ == "__main__":
    main()
