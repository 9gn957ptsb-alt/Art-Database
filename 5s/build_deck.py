#!/usr/bin/env python3
"""Build the 5s deck from the art database.

    artworks.db + Artsy artist genes + Artsy images  ->  dist/deck.json, dist/img/*.webp, dist/logo.webp

The deck is drawn from the artist's 5,021 Artsy saves: 80 cards per kind (image, object, space,
surface, colour) where the data allows. Every network result is cached under data/5s/ (artist genes,
gene families, downloaded images, texture analysis), so a re-run is cheap and the script can be
stopped and resumed at any point. Output goes to 5s/dist/, which is gitignored with data/: both hold
Artsy-derived material and the repository is public.

How the cards are chosen (greedy, seeded, so the same caches give the same deck):
  - eligible: an image, three Artsy colours and a title; not Ephemera, Reproduction, Books and
    Portfolios, Video/Film/Animation, Performance Art or Other (a missing category is inferred from
    the medium when that is unambiguous, e.g. "oil on canvas" -> Painting).
  - space first (scarcest): Architecture; Installations that name a room or a site or are made of
    light; pictures whose artists carry place genes (landscapes, cityscapes, interiors, ...) and whose
    titles name a place but not a figure. Then object (Design, Sculpture, Textiles, Jewelry, Fashion,
    3-D Mixed Media), surface (the best texture window of the likeliest works), image (the other
    pictures) and colour (any unused work, aimed at an even spread of chords and hues).
  - at most 2 cards per artist across the deck and 1 per kind; every card a different work; each
    pick weighs its quality against how under-represented its chord, hue, era and place still are.
  - surfaces skip artists of words and faces (text, typography, portrait genes), crops with lines of
    lettering, and a short list of works seen in review of the contact sheets.

After the Artsy cards come the artist's Architectural Authority bookmarks: buildings.json holds the
choices for each (hero photo, surface crop, materials, genes), data/aa/ the pages and photos that
gather_buildings.py fetched. Each gives a space card (b001...; an object card where buildings.json says
"kind": "object") and, where a crop was chosen, a surface card (m001...); their colours come from the app's own k-means (src/bring.js, through node).

Usage:  python3 5s/build_deck.py [--fetch-only] [--no-logo] [--out DIR]
"""
import argparse
import base64
import colorsys
import io
import json
import math
import random
import re
import sqlite3
import subprocess
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
DATA = REPO / "data" / "5s"
DB = DATA / "artworks.db"
IMG_CACHE = DATA / "images"
ARTISTS_JSON = DATA / "artist_genes.json"
FAMILIES_JSON = DATA / "gene_families.json"
TEXTURE_JSON = DATA / "texture_analysis.json"
DIST = HERE / "dist"
OUT_IMG = DIST / "img"
LOGO_SRC = HERE / "logo-source.jpg"
BUILDINGS_JSON = HERE / "buildings.json"   # the buildings' curated choices (committed)
AA = REPO / "data" / "aa"                  # their pages and photos, from gather_buildings.py
BRING_JS = HERE / "src" / "bring.js"       # the app's own colour k-means

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
            r"photograph\w*|\bphoto\b|salt(?:ed)? paper print|fujiflex|diasec|carbon print")
MATERIAL_TABLE = [
    ("screenprint", r"screen ?-?print\w*|silk ?-?screen\w*|serigraph\w*|pochoir|stencil|kappazuri"),
    ("lithograph", r"lithograph\w*|\blitho\b|offset"),
    ("woodcut", r"woodcut|wood ?block|wood engraving|linocut|lino ?cut|linoleum cut|relief print"),
    ("etching", r"etching(?! paper)|aquatint|drypoint|engraving|intaglio|mezzotint|soft[- ]ground|"
                r"collagraph|carborundum"),
    ("plastic", r"acrylic (?:glass|sheet|box|case|cube|block|panel|mirror)|plexi\w*|perspex|lucite|"
                r"plastic\w*|polycarbonate|polyurethane|polystyrene|polyethylene|polypropylene|vinyl|"
                r"\bpvc\b|silicone|\babs\b|rubber|foam|nylon"),
    ("pastel", r"pastel|(?<!black )chalk"),
    ("oil", r"\boils?\b|oil ?stick"),
    ("acrylic", r"acrylic|dispersion|synthetic polymer"),
    ("watercolour", r"water ?colou?r"),
    ("gouache", r"gouache"),
    ("ink", r"\binks?\b|sumi|felt[- ]tip|marker"),
    ("graphite", r"graphite|pencil|silverpoint"),
    ("charcoal", r"charcoal|conté|conte crayon|black chalk"),
    ("tempera", r"tempera"),
    ("canvas", r"canvas"),
    ("linen", r"linen|leinen"),
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
    ("neon", r"\bneon\b|fluorescent|\bled\b|light ?bulbs?"),
    ("video", r"\bvideo\b|\bfilm\b|animation|\btv\b|television"),
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
    return out[:5]                            # in the order the medium names them; at most five


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
    close = pairs[0][0]
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
            score = float(score * (1 - min(1.0, max(0.0, bf - 0.15) * 2.0)))
            if best is None or score > best["score"]:
                best = {"score": score, "x": x / aw, "y": y / ah, "w": win / aw, "h": win / ah,
                        "density": float(edge[y, x]), "white": wf, "line": float(line),
                        "evenness": evenness}
    return best


def _components(mask):
    """4-connected components of a boolean array: list of (x0, y0, x1, y1, area)."""
    h, w = mask.shape
    seen = np.zeros_like(mask, dtype=bool)
    flat, seen_f = mask.ravel(), seen.ravel()
    out = []
    for start in np.flatnonzero(flat):
        if seen_f[start]:
            continue
        seen_f[start] = True
        stack = [start]
        x0 = y0 = 10 ** 9
        x1 = y1 = -1
        area = 0
        while stack:
            i = stack.pop()
            y, x = divmod(int(i), w)
            area += 1
            x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
            for j, ok in ((i - 1, x > 0), (i + 1, x < w - 1), (i - w, y > 0), (i + w, y < h - 1)):
                if ok and flat[j] and not seen_f[j]:
                    seen_f[j] = True
                    stack.append(j)
        out.append((x0, y0, x1 + 1, y1 + 1, area))
    return out


def text_rows(im):
    """Rows of letter-like marks in an image: a cheap stand-in for OCR, to keep text off Surfaces.

    Thresholds the image (Otsu), takes small components shaped like letters, groups them by shared
    baseline and height, and counts rows holding a chain of four or more with letter-like spacing and
    varied widths (a row of identical dots or stitches is not text).
    """
    g = np.asarray(im.convert("L").resize((256, 256), Image.LANCZOS), dtype=np.float32)
    hist, edges = np.histogram(g, 64, (0, 256))
    p = hist / max(1, hist.sum())
    omega, mu = np.cumsum(p), np.cumsum(p * np.arange(64))
    between = (mu[-1] * omega - mu) ** 2 / (omega * (1 - omega) + 1e-9)
    t = edges[int(np.argmax(between)) + 1]
    best = 0
    for mask in (g < t, g > t):
        share = mask.mean()
        if share > 0.6 or share < 0.01:
            continue
        letters = []
        for x0, y0, x1, y1, area in _components(mask):
            cw, ch = x1 - x0, y1 - y0
            if 7 <= ch <= 44 and 0.15 * ch <= cw <= 1.6 * ch and 0.12 <= area / (cw * ch) <= 0.8:
                letters.append((x0, y1, x1, ch, cw, area / (cw * ch)))
        rows = []
        for c in sorted(letters, key=lambda c: c[1]):
            for r in rows:
                if abs(r["base"] - c[1]) <= 3 and 0.7 <= c[3] / r["h"] <= 1.45:
                    r["items"].append(c)
                    break
            else:
                rows.append({"base": c[1], "h": c[3], "items": [c]})
        n = 0
        for r in rows:
            items = sorted(r["items"])
            chain = longest = 1
            for a, b in zip(items, items[1:]):
                chain = chain + 1 if b[0] - a[2] <= 1.2 * r["h"] else 1
                longest = max(longest, chain)
            widths = np.array([c[4] for c in items], dtype=np.float32)
            fills = np.array([c[5] for c in items], dtype=np.float32)
            if longest >= 4 and widths.std() / widths.mean() > 0.18 and fills.mean() < 0.65:
                n += 1
        best = max(best, n)
    return best


def edge_density(im512):
    a = np.asarray(im512.convert("L").filter(ImageFilter.GaussianBlur(1.0)), dtype=np.float32) / 255
    gy, gx = np.gradient(a)
    return float((np.hypot(gx, gy) > 0.03).mean())


# ----------------------------------------------------------------------------------------------
# kinds
# ----------------------------------------------------------------------------------------------

# Gene slugs (from the genes actually fetched for these artists) that mark work as places or
# buildings, weighted by how surely they do.
PLACE_GENES = {
    # buildings, rooms, cities
    "representations-of-architecture": 3, "architecture-1": 3, "interiors": 3, "cityscapes": 3,
    "city-scenes": 3, "the-city": 3, "urbanization": 2, "architectures-effects": 3, "suburbia": 3,
    "bedrooms-and-bathrooms": 3, "the-domestic-and-domesticity": 1, "spaces-of-the-art-world": 2,
    "the-artists-studio": 2, "vacant-and-vacated-spaces": 3, "emphasis-on-linear-perspective": 2,
    "reduced-scale-architecture": 3, "design-slash-architecture-study": 3, "brutalism": 3,
    "international-style": 3, "reinforced-concrete-construction": 3, "steel-slash-iron-frame-construction": 3,
    "engineering-slash-construction-and-design": 2, "christian-art-and-architecture": 1,
    # land, water, the view out
    "landscapes": 3, "atmospheric-landscapes": 3, "abstract-landscape": 2, "waterscapes": 3,
    "en-plein-air": 2, "rural-life": 2, "the-american-west": 2, "hudson-river-school": 3,
    "barbizon-school": 2, "luminism": 2, "the-sublime": 2, "nautical": 2, "figures-in-nature": 1,
    "aerial-view": 3, "panorama": 3, "topographic-photography": 3, "new-topographics": 3,
    "dusseldorf-school-of-photography": 2, "new-american-color-photography": 2, "street-photography": 1,
    "travel-slash-tourism": 1, "documentary-travel-photography": 2, "nature": 1, "water": 1,
    # made spaces
    "land-art": 3, "light-and-space-movement": 3, "site-specific-art": 3, "immersive": 3,
    "installation": 1, "wall-sculpture-and-installation": 1, "murals-and-wall-drawings": 1,
    "outdoor-art": 1,
}
# Gene slugs that promise a good Surface: paint handling, pattern, material.
TEXTURE_GENES = {
    "densely-textured-or-haptic-surface": 3, "impasto": 3, "sculptural-use-of-paint": 3,
    "allover-composition": 2, "patterns": 2, "dense-composition": 2, "highly-detailed": 1,
    "rough": 2, "cracked": 3, "creased-crinkled-wrinkled": 3, "woven-slash-perforated": 3,
    "photographs-of-surfaces": 3, "natural-fibers": 2, "focus-on-materials": 2, "textile-arts": 2,
    "large-brushstrokes-slash-loose-brushwork": 2, "gestural": 1, "splattered-slash-dripped": 2,
    "stains-slash-washes": 1, "dotted": 2, "repetition": 1, "grid": 1, "striped": 1, "marbleized": 3,
    "pulled-scraped-and-scratched": 3, "tangled-forms": 2, "fractal-like-slash-kaleidoscopic": 2,
    "patinated-and-oxidized": 3, "mimicking-ruined-materials": 2, "pointillism": 2, "divisionist": 2,
    "contemporary-gestural-abstraction": 1, "action-painting": 1, "art-informel": 2, "dansaekhwa": 1,
    "embroidery": 3, "tapestry-and-wall-hanging": 3, "use-of-fabric": 2, "organic-material": 1,
    "use-of-common-materials": 1, "collage": 1, "layered-images": 1, "scattered-composition": 1,
}
PLACE_TITLE = (r"\b(interiors?|rooms?|houses?|home|buildings?|streets?|city|cities|cityscapes?|landscapes?|"
               r"views?|gardens?|bridges?|church|cathedral|chapel|towers?|fa[cç]ade|windows?|harbou?rs?|port|"
               r"beach|road|village|skyline|avenue|park|river|lake|mountains?|valley|coast|sea|seascape|bay|"
               r"hills?|fields?|forest|woods|canyon|desert|plaza|courtyard|corridor|staircase|stairs|"
               r"pavilion|villa|temple|ruins?|palace|museum|studio|kitchen|bedroom|apartment|hotel|"
               r"station|highway|boulevard|island|pool|cabin|barn|farm|town|downtown|suburbs?|"
               r"lighthouse|dock|pier|alley|caf[eé]|salon|reading room|meadow|stream|waterfall|cliffs?|"
               r"shore|lagoon|canal|piazza|skyscraper|architecture)\b")
# Titles that name a figure or a thing first: not a place, whatever else they say.
FIGURE_TITLE = (r"\b(nude|naked|torso|portrait|self-portrait|head|bust|woman|women|man|men|girl|boy|"
                r"bathers?|christ|saint|madonna|venus|temptation|still life|flowers|vase|figure study|"
                r"study of a|lovers?|mother|child|lightning)\b")
# What makes an Installation a place you could stand in rather than a thing on a wall: a title that
# names a room or a site, or a medium of light.
INSTALL_TITLE = (r"\b(room|rooms|space|site|environment|immersive|walk-in|garden|pavilion|house|corridor|"
                 r"chamber)\b")
INSTALL_MEDIUM = r"\b(light|lights|fluorescent|neon|led|daylight|projection|projected|apertures?)\b"
FLAT_PAINT = r"^\s*(oil|acrylic|tempera|watercolou?r|gouache|fresco|ink)\b.*\bon (canvas|panel|paper|linen|board|silk)\b"
OBJECT_MEDIUM = (r"bronze|stoneware|earthenware|porcelain|ceramic|terracotta|marble|cast|carved|"
                 r"welded|steel|wood(?!cut)|glass|resin|plaster|found object|assemblage|clay|iron|"
                 r"aluminum|aluminium|brass|copper|fiberglass|vase|bowl|vessel|chair|lamp|table")
FLAT_MEDIUM = r"\bon (?:canvas|paper|panel|board|linen|wood panel|masonite)\b|print|photograph"


def place_marks(genes):
    return sum(PLACE_GENES.get(g, 0) for g in genes)


def has_place_title(w):
    return bool(re.search(PLACE_TITLE, (w.get("title") or "").lower()))


def space_strength(w):
    """0..1: how surely a work reads as a place."""
    if w["_cat"] == "Architecture":
        return 1.0
    g = min(place_marks(w["_genes_all"]), 9) / 9
    if w["_cat"] == "Installation":
        return 0.7 + 0.3 * g
    return min(1.0, 0.45 + 0.45 * g + (0.1 if has_place_title(w) else 0))


def installation_is_space(w):
    title, med = (w.get("title") or "").lower(), (w.get("medium") or "").lower()
    if re.search(r"sculpture|wall piece|relief", f"{title} {med}"):
        return False
    return bool(re.search(INSTALL_TITLE, title) or re.search(INSTALL_MEDIUM, med) or has_place_title(w)
                or place_marks(w["_genes_all"]) >= 3)


def kind_candidates(w):
    """The whole-card kinds a work could be. Object and space come first; image is the rest."""
    cat = w["_cat"]
    med = (w.get("medium") or "").lower()
    title = (w.get("title") or "").lower()
    kinds = []
    if cat in ("Design/Decorative Art", "Fashion Design and Wearable Art") and \
            re.search(r"\b(caf[eé]|interior|salon|pavilion|apartment)\b|\broom\b(?! divider)", title) and \
            not re.search(r"\b(chair|table|lamp|sofa|cabinet|desk|stool|bench|rug|carpet|wardrobe|divider|"
                          r"shelf|shelving|screen)\b", title):
        return ["space"]                      # a designed room, not a piece of furniture
    if cat == "Textile Arts" and re.search(r"jacquard|tapestry", med):
        return ["image"]                      # a picture woven flat: it reads as an image
    if cat in OBJECT_CATEGORIES and not re.search(FLAT_PAINT, med):
        kinds.append("object")
    elif cat == "Mixed Media" and (w.get("depth_cm") or 0) >= 8 and re.search(OBJECT_MEDIUM, med) \
            and not re.search(FLAT_MEDIUM, med):
        kinds.append("object")
    if cat == "Architecture" or (cat == "Installation" and installation_is_space(w)):
        kinds.append("space")
    elif cat in PICTURE_CATEGORIES and cat != "Posters":
        if place_marks(w["_genes_all"]) >= 3 and has_place_title(w) and not re.search(FIGURE_TITLE, title):
            kinds.append("space")
    if (cat in PICTURE_CATEGORIES or (cat in OBJECT_CATEGORIES and "object" not in kinds)) \
            and "object" not in kinds:
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

    def pick(self, kind, pool, quality, n=PER_KIND, validate=None, weights=None, targets=None, qweight=1.6):
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
                s = qweight * quality(w)
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
# build
# ----------------------------------------------------------------------------------------------

def annotate(works, artists, families):
    for w in works:
        genes = []
        for a in artist_ids(w):
            for g in (artists.get(a) or {}).get("genes") or []:
                if g and g.get("slug") and g["slug"] not in genes:
                    genes.append(g["slug"])
        w["_genes_all"] = genes
        w["_genes"] = [g for g in genes if (families.get(g) or {}).get("family") in KEPT_FAMILIES]
        nat = next((a.get("nationality") for a in w["artists"] if (a.get("nationality") or "").strip()), None)
        if not nat:
            nat = next(((artists.get(a) or {}).get("nationality") for a in artist_ids(w)
                        if ((artists.get(a) or {}).get("nationality") or "").strip()), None)
        w["_place"] = place_of(nat)
        w["_year"] = parse_year(w.get("date"))
        w["_era"] = era_of(w["_year"])
        w["_cat"] = category_of(w)
        w["_materials"] = materials_of(w.get("medium"))
        w["colours"] = w["colours"][:3]
        w["_attr"] = {"chord": chord_of(w["colours"]), "hue": main_hue(w["colours"]),
                      "era": w["_era"] or "unknown", "place": w["_place"] or "unknown",
                      "cat": w["_cat"]}
        w["_kinds"] = kind_candidates(w)


def gene_quality(w):
    """Cards whose artists carry aesthetic genes teach the taste model more."""
    return min(len(w["_genes"]), 6) / 6


def whole_ok(w):
    """Download the work's 'larger' image (or 'large') and check it can be a whole card."""
    p = best_source(w, ("larger", "large"))
    if not p:
        return None
    try:
        im = open_rgb(p)
    except Exception:
        return None
    W, H = im.size
    if max(W, H) < 480 or not (0.3 <= W / H <= 3.3):
        return None
    a = np.asarray(im.resize((64, 64)), dtype=np.float32) / 255
    if a.std() < 0.05:                       # a near-blank image gives nothing to judge
        return None
    return {"src": str(p)}


SURFACE_CAT_PRIOR = {"Painting": 1.0, "Textile Arts": 1.2, "Mixed Media": 0.9, "Sculpture": 0.6,
                     "Design/Decorative Art": 0.6, "Drawing, Collage or other Work on Paper": 0.5,
                     "Photography": 0.5, "Print": 0.35, "Installation": 0.3, "Architecture": 0.3,
                     "Posters": 0.0}
TACTILE = {"oil", "textile", "wool", "ceramic", "wood", "stone", "marble", "bronze", "felt", "cotton",
           "silk", "plaster", "concrete", "linen", "leather", "porcelain", "glass", "resin", "copper",
           "iron", "steel", "mixed media", "found objects", "paper", "pastel", "charcoal"}


# Artists whose work is about words, signs or faces: a crop of theirs is likely to hold text or a
# face, not a texture.
SURFACE_SKIP_GENES = {
    "text", "language", "typography", "written-word", "printed-matter", "graphic-design",
    "advertising-and-brands", "personal-writing-systems", "graffiti-and-street-art", "comic-slash-cartoon",
    "engagement-with-mass-media", "celebrity", "pop-art", "political-pop", "appropriation",
    "infographics-and-diagrams", "maps-slash-networks", "photomontage", "digital-culture",
    "individual-portrait", "portrait", "group-portrait", "self-portrait", "face", "bible-story", "nude",
    "eye-contact", "classical-figure", "illustration", "narrative",
}
SURFACE_SKIP_MEDIUM = r"collage|d[ée]collage|poster|newspaper|magazine|stamps?\b|photomontage|book|letter|text"


# Bodies and photographic realism: the best-textured window is likely a limb or a machine part.
# Painters who also work abstractly or with heavy paint keep their place.
SURFACE_FIGURE_GENES = {"human-figure", "the-body", "body-parts", "mutated-bodies", "attenuated-figure",
                        "bathers", "erotic", "photorealistic", "hyperrealism"}
ABSTRACT_GENES = {"abstract-art", "abstract-painting", "abstract-expressionism", "contemporary-gestural-abstraction",
                  "gestural", "action-painting", "art-informel", "color-field-painting", "primary-abstraction",
                  "allover-composition", "impasto", "large-brushstrokes-slash-loose-brushwork",
                  "densely-textured-or-haptic-surface", "patterns", "post-impressionism", "impressionism",
                  "abstract-landscape"}
# Seen in review of the contact sheets: lettering too large or too sparse for text_rows() to catch
# (Ceulers, Horndeski, Zelehoski), and crops that landed on a figure or a still life (Picasso, Dalí,
# Nurmivaara).
SURFACE_SKIP_WORKS = {
    "michiel-ceulers-close-to-you-remembering-the-carpenter-slash-only-yesterday-the-carpenters-story",
    "pablo-picasso-la-vie-life", "salvador-dali-invisible-lion-horse-sleeping-woman",
    "gregory-horndeski-perception-no-2", "michael-zelehoski-black-and-blue-1", "emilia-nurmivaara-new-space",
}


def surface_ok(w):
    genes = set(w["_genes_all"])
    if w["id"] in SURFACE_SKIP_WORKS or SURFACE_SKIP_GENES & genes:
        return False
    if SURFACE_FIGURE_GENES & genes and not ABSTRACT_GENES & genes:
        return False
    text = f"{w.get('medium') or ''} {w.get('title') or ''}".lower()
    return not re.search(SURFACE_SKIP_MEDIUM, text) and w["_cat"] != "Posters"


def surface_prior(w):
    g = sum(TEXTURE_GENES.get(x, 0) for x in w["_genes_all"])
    m = 0.4 if TACTILE & set(w["_materials"]) else 0.0
    return SURFACE_CAT_PRIOR.get(w["_cat"], 0.3) + 1.5 * min(g, 8) / 8 + m


class TextureCache:
    def __init__(self):
        self.data = load_json(TEXTURE_JSON, {})
        self.dirty = 0

    def get(self, key, compute):
        if key not in self.data:
            self.data[key] = compute()
            self.dirty += 1
            if self.dirty % 25 == 0:
                self.save()
        return self.data[key]

    def save(self):
        save_json(TEXTURE_JSON, self.data)


def prescreen_surfaces(pool, tex, n_candidates=720, rng=None):
    """Analyse the 'large' images of the likeliest surface works; return {id: analysis}."""
    ranked = sorted((w for w in pool if surface_ok(w)),
                    key=lambda w: -(surface_prior(w) + 0.8 * rng.random()))[:n_candidates]
    todo = [w for w in ranked if f"{w['id']}|large|0.25" not in tex.data]
    log(f"surface: prescreening {len(ranked)} works ({len(todo)} new)")
    with ThreadPoolExecutor(3) as ex:
        for k, _ in enumerate(ex.map(lambda w: cached_image(w, "large"), todo)):
            if (k + 1) % 50 == 0:
                log(f"  downloaded {k + 1}/{len(todo)}")
    out = {}
    for w in ranked:
        def compute(w=w):
            p = cached_image(w, "large")
            if not p:
                return None
            try:
                return analyse_texture(open_rgb(p), 0.25)
            except Exception as e:
                log(f"  analysis failed for {w['id']}: {e}")
                return None
        res = tex.get(f"{w['id']}|large|0.25", compute)
        if res:
            out[w["id"]] = res
    tex.save()
    return out


def surface_make(w, tex, min_score):
    """Find the crop at native pixels on the 'normalized' image (or 'larger')."""
    p = cached_image(w, "normalized") or cached_image(w, "larger")
    if not p:
        return None
    im = open_rgb(p)
    W, H = im.size
    side = max(384, round(0.25 * min(W, H)))
    if side > 0.8 * min(W, H):
        return None
    frac = side / min(W, H)
    res = tex.get(f"{w['id']}|{p.name.split('.')[-2]}|{frac:.4f}", lambda: analyse_texture(im, frac))
    if not res or res["score"] < min_score:
        return None
    x0 = min(W - side, max(0, round(res["x"] * W)))
    y0 = min(H - side, max(0, round(res["y"] * H)))
    crop = im.crop((x0, y0, x0 + side, y0 + side))
    a = np.asarray(crop.resize((128, 128)), dtype=np.float32) / 255
    L = a @ np.array([0.2126, 0.7152, 0.0722], dtype=np.float32)
    white = float(((L > 0.92) & ((a.max(2) - a.min(2)) < 0.08)).mean())
    if white > 0.10 or L.std() < 0.04:
        return None
    small = crop.resize((256, 256), Image.LANCZOS)
    if max(text_rows(small), text_rows(small.transpose(Image.Transpose.ROTATE_90))) >= 2:
        return None                           # lines of lettering, across or up the crop

    return {"src": str(p), "box": (x0, y0, side), "size": (W, H), "score": res["score"]}


def build(works, artists, families):
    rng = random.Random(SEED)
    annotate(works, artists, families)
    by_id = {w["id"]: w for w in works}
    pk = Picker(rng)
    spread = {"chord": 1.0, "hue": 1.0, "era": 0.8, "place": 0.6, "cat": 0.6}

    # 1. space: the scarcest kind goes first
    pool = [w for w in works if "space" in w["_kinds"]]
    log(f"space: {len(pool)} candidates "
        f"({sum(1 for w in pool if w['_cat'] in SPACE_CATEGORIES)} architecture/installation)")
    pk.pick("space", pool, lambda w: 0.75 * space_strength(w) + 0.25 * gene_quality(w),
            validate=lambda w: whole_ok(w), weights=spread)

    # 2. object
    pool = [w for w in works if "object" in w["_kinds"]]
    log(f"object: {len(pool)} candidates")
    pk.pick("object", pool, lambda w: 0.5 + 0.5 * gene_quality(w), validate=lambda w: whole_ok(w),
            weights=spread)

    # 3. surface: any work not used whole, whose image gives a good texture crop
    tex = TextureCache()
    pool = [w for w in works if w["id"] not in pk.used_works and pk.allowed(w, "surface")]
    screened = prescreen_surfaces(pool, tex, rng=random.Random(SEED + 1))
    scores = sorted(r["score"] for r in screened.values())
    ref = scores[int(0.9 * (len(scores) - 1))] if scores else 1.0
    floor = scores[int(0.5 * (len(scores) - 1))] if scores else 0.0
    log(f"surface: {len(screened)} analysed; score median {scores[len(scores) // 2]:.4f}, "
        f"p90 {ref:.4f}; keeping those above {floor:.4f}")
    spool = [by_id[i] for i, r in screened.items() if r["score"] >= floor]
    pk.pick("surface", spool, lambda w: min(1.0, screened[w["id"]]["score"] / ref),
            validate=lambda w: surface_make(w, tex, 0.6 * floor),
            weights={"chord": 1.0, "hue": 2.0, "era": 0.5, "place": 0.4, "cat": 0.5}, qweight=2.2)
    tex.save()

    # 4. image: the other pictures
    pool = [w for w in works if "image" in w["_kinds"]]
    log(f"image: {len(pool)} candidates")
    pk.pick("image", pool, lambda w: 0.5 + 0.5 * gene_quality(w), validate=lambda w: whole_ok(w),
            weights=spread)

    # 5. colour: any work not otherwise used, spread over every chord and round the wheel
    pool = [w for w in works if colour_spread(w["colours"]) >= 0.12]
    chords = ["monochrome", "neutral", "accent", "analogous", "complementary", "split"]
    hues = HUE_NAMES + ["neutral"]
    targets = {"chord": {c: math.ceil(PER_KIND / len(chords)) for c in chords},
               "hue": {h: math.ceil(PER_KIND / len(hues)) for h in hues}}
    log(f"colour: {len(pool)} candidates")
    def colour_quality(w):
        # three clearly different colours; a first colour (the wall in Set) that is not near-black/white
        first = lum(w["colours"][0])
        return min(1.0, colour_spread(w["colours"]) / 0.45) * (1.0 if 0.1 < first < 0.9 else 0.7)

    pk.pick("colour", pool, colour_quality,
            validate=lambda w: (lambda p: {"src": str(p)} if p else None)(best_source(w, ("large", "larger"))),
            weights={"chord": 2.0, "hue": 1.6, "era": 0.4, "place": 0.3}, targets=targets)

    write_deck(pk, families, artists)


def kmeans_colours(images):
    """Three dominant colours of each image by the app's own k-means (bring.js dominantColours, run
    in node), on a 96 px copy as the app takes one."""
    small = []
    for im in images:
        s = min(1, 96 / max(im.size))
        c = im.resize((max(1, round(im.width * s)), max(1, round(im.height * s))), Image.LANCZOS)
        small.append(base64.b64encode(c.convert("RGBA").tobytes()).decode())
    js = ("const B = require(process.argv[1])._internals;"
          "const ins = JSON.parse(require('fs').readFileSync(0, 'utf8'));"
          "console.log(JSON.stringify(ins.map((b) => B.dominantColours(Buffer.from(b, 'base64')))));")
    out = subprocess.run(["node", "-e", js, str(BRING_JS)], input=json.dumps(small),
                         capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def building_cards(cards, thumbs, lo, hi):
    """The Architectural Authority bookmarks (buildings.json + data/aa/): a space card per building
    from its hero photo (ids b001...; an object card where the entry has "kind": "object") and a surface card per chosen crop (m001...), made as the Artsy
    cards are; appended to cards and thumbs. Returns the genes the deck may not know yet."""
    blds = json.loads(BUILDINGS_JSON.read_text())
    raw = {b["slug"]: b for b in json.loads((AA / "buildings.raw.json").read_text())["buildings"]}
    made = []
    for kind, letter in (("space", "b"), ("surface", "m")):
        n = 0
        for b in blds:
            pick = b["hero"] if kind == "space" else (b["surface"] or {}).get("photo")
            if not pick:
                continue
            r = raw[b["slug"]]
            i = [u.rsplit("/", 1)[1] for u in r["photos"]].index(pick)
            n += 1
            cid = f"{letter}{n:03d}"
            m = b["materials"]
            medium = ", ".join(m[:-1]) + " and " + m[-1] if len(m) > 1 else "".join(m)
            card = {
                # a bookmark of things, not a building (buildings.json "kind": "object"), is shown as one
                "id": cid, "kind": b.get("kind", kind) if kind == "space" else kind, "work": b["slug"], "url": r["url"], "title": b["name"],
                "artist": b["architect"], "date": str(b["year"]) if b["year"] else None, "year": b["year"],
                "era": b["era"], "category": b["category"], "medium": medium[:1].upper() + medium[1:],
                "materials": m, "place": b["place"], "colours": None, "genes": b["genes"],
                "img": f"img/{cid}.webp", "w": None, "h": None, "thumb": len(cards),
                "source": "Architectural Authority", "cdn": r["photos"][i],
            }
            src = AA / r["img"][i]
            im = open_rgb(src)
            if kind == "space":
                im.thumbnail((720, 720), Image.LANCZOS)
                im.save(OUT_IMG / f"{cid}.webp", "WEBP", quality=68, method=6)
                card.update(w=im.width, h=im.height)
            else:
                W, H = im.size
                x, y, cw, ch = b["surface"]["crop"]
                side = round(min(cw * W, ch * H))  # the chosen box is near square: its centred square
                x0 = min(W - side, max(0, round((x + cw / 2) * W - side / 2)))
                y0 = min(H - side, max(0, round((y + ch / 2) * H - side / 2)))
                im = im.crop((x0, y0, x0 + side, y0 + side)).resize((512, 512), Image.LANCZOS)
                im.save(OUT_IMG / f"{cid}.webp", "WEBP", quality=70, method=6)
                card.update(w=512, h=512,
                            crop=[round(x0 / W, 4), round(y0 / H, 4), round(side / W, 4), round(side / H, 4)],
                            texture=round(min(1.0, max(0.0, (edge_density(im) - lo) / max(1e-6, hi - lo))), 2))
            made.append((card, im))
            cards.append(card)
            thumbs.append(src)
    for (card, _), colours in zip(made, kmeans_colours([im for _, im in made])):
        card["colours"] = colours
    return {g["slug"]: g for b in blds for g in b["new_genes"]}


def add_others(cards, head, data=DATA):
    """Set's other eyes (SPEC "Set, inside out"), only in this git-ignored build: each picture's composition and
    feeling words (card comp, feel), the words' aspects (head words) and the lookers' pairs (head rhymes:
    [a, b, 1 yes | 0 partly, their line]). Without data/5s's pairs, tags and words it ships none, and Set still plays."""
    files = [data / n for n in ("pairs.json", "composition_tags.json", "words.json")]
    if not all(f.exists() for f in files):
        log("set: no pairs.json, composition_tags.json or words.json in data/5s: the deck ships no other eyes")
        return
    P, T, A = (json.loads(f.read_text()) for f in files)
    pics = {c["id"]: c for c in cards if c["kind"] != "colour" and c.get("img")}
    for c in pics.values():
        t = (T.get(c["work"]) or {}).get(c["kind"]) or {}
        c["comp"] = [w for w in t.get("comp", []) if w in A]
        c["feel"] = [w for w in t.get("feel", []) if w in A]
    pinned, rows = P.get("works") or {}, []   # works: the deck the pairs were judged on; an id that moved is dropped
    for x in P["pairs"]:
        a, b = sorted((x["a"], x["b"]))
        if a in pics and b in pics and pics[a]["work"] != pics[b]["work"] and all(pinned.get(i) in (None, pics[i]["work"]) for i in (a, b)):
            rows.append([a, b, 1 if x["verdict"] == "yes" else 0, re.sub(r"^Both: ", "", x["share"])])
    head["words"], head["rhymes"] = A, rows
    log(f"set: {len(rows)} lookers' pairs of {len(P['pairs'])}; words on {sum(1 for c in pics.values() if c['comp'] or c['feel'])} of {len(pics)} pictures")


ROOM_TEXT, ROOM_SAY = 40, 120   # a room's names (walls, paint, opening, floor, spots); its one caption line


def corners_w(q):
    """Heckbert's square onto the quad q (the page's sq2quad): the homography's w at the plane's four corners. Every corner
    is in front of the camera when all four are > 0; a quad with no area gives zeros."""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = q
    area = (x0 * y1 - x1 * y0) + (x1 * y2 - x2 * y1) + (x2 * y3 - x3 * y2) + (x3 * y0 - x0 * y3)
    sx, sy = x0 - x1 + x2 - x3, y0 - y1 + y2 - y3
    dx1, dx2, dy1, dy2 = x1 - x2, x3 - x2, y1 - y2, y3 - y2
    den = dx1 * dy2 - dx2 * dy1
    if abs(area) < 1e-6 or abs(den) < 1e-12:
        return [0, 0, 0, 0]
    g, h = ((sx * dy2 - dx2 * sy) / den, (dx1 * sy - sx * dy1) / den) if abs(sx) > 1e-9 or abs(sy) > 1e-9 else (0, 0)
    return [1, 1 + g, 1 + g + h, 1 + h]


def clean_room(r, bad):
    """A marked interior (SPEC-room-from-structure 2.2: points in percent of the photo, sizes in cm) as the page reads it:
    numbers to 1 decimal; a plane with a corner behind the camera, a spot naming no plane, a polygon of fewer than 3
    points or with a point outside the photo, and a name longer than ROOM_TEXT are dropped, each told to bad(what)."""
    num = lambda v: isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)
    pt = lambda p, lo=0, hi=100: isinstance(p, list) and len(p) == 2 and all(num(v) and lo <= v <= hi for v in p)
    rd = lambda p: [round(v, 1) for v in p]
    text = lambda s, n=ROOM_TEXT: isinstance(s, str) and 0 < len(s) <= n and s == " ".join(s.split())

    def polys(ps, what):
        ps = ps if isinstance(ps, list) else []
        ok = [[rd(p) for p in poly] for poly in ps if isinstance(poly, list) and len(poly) >= 3 and all(pt(p) for p in poly)]
        if len(ok) < len(ps):
            bad(f"{len(ps) - len(ok)} of {what}")
        return ok

    out = {"inside": True}
    for k, n in (("say", ROOM_SAY), ("walls", ROOM_TEXT)):
        if text(r.get(k), n):
            out[k] = r[k]
        elif k in r:
            bad(k)
    out["planes"] = {}
    for pid, p in (r.get("planes") or {}).items():
        q, size = (p or {}).get("q"), (p or {}).get("size")
        if (isinstance(q, list) and len(q) == 4 and all(pt(c, -1000, 1000) for c in q) and min(corners_w(q)) > 0
                and isinstance(size, list) and len(size) == 2 and all(num(v) and 0 < v <= 10000 for v in size)):
            out["planes"][pid] = {"q": [rd(c) for c in q], "size": rd(size)}
        else:
            bad(f"plane {pid}")
    paint = r.get("paint")
    if isinstance(paint, dict):   # null: never painted (its walls are the work), and the colour is its light
        ps = polys(paint.get("polys"), "its paint")
        paint = {"polys": ps, "name": paint["name"]} if ps and text(paint.get("name")) else None
    out["paint"] = paint if isinstance(paint, dict) else None
    fl = r.get("floor")
    if isinstance(fl, dict):
        out["floor"] = {}
        if text(fl.get("what")):
            out["floor"]["what"] = fl["what"]
        if "outline" in fl and polys([fl["outline"]], "its floor"):
            out["floor"]["outline"] = [rd(p) for p in fl["outline"]]
        if num(fl.get("band")) and 0 < fl["band"] <= 1:
            out["floor"]["band"] = round(fl["band"], 2)
    op = r.get("opening")
    if isinstance(op, dict):
        ps = polys(op.get("polys"), "its opening")
        if ps and text(op.get("name")):
            out["opening"] = {"polys": ps, "name": op["name"]}
    if pt(r.get("sun"), -100, 200):
        out["sun"] = rd(r["sun"])
    out["spots"] = {}
    for k, sp in (r.get("spots") or {}).items():
        sp = sp if isinstance(sp, dict) else {}
        placed = k not in ("paint", "floor")   # a thing is placed on a plane; paint and floor only mark where to press
        ok = (re.fullmatch(r"[a-z][a-z0-9]{0,11}", k) and pt(sp.get("at"))
              and (sp.get("plane") in out["planes"] if placed or "plane" in sp else True)
              and (not placed or text(sp.get("name"))) and ("top" not in sp or (num(sp["top"]) and 0 <= sp["top"] <= 100))
              and ("box" not in sp or (isinstance(sp["box"], list) and len(sp["box"]) == 2 and all(num(v) and 0 < v <= 10000 for v in sp["box"]))))
        if not ok:
            bad(f"spot {k}")
            continue
        o = {"plane": sp["plane"]} if "plane" in sp else {}
        o["at"] = rd(sp["at"])
        if placed:
            o["name"] = sp["name"]
        if "top" in sp:
            o["top"] = round(sp["top"], 1)
        if "box" in sp:
            o["box"] = rd(sp["box"])
        out["spots"][k] = o
    return out


def add_roles(cards, data=DATA):
    """What each card is and its relation to setting up a room (SPEC-room-from-structure 2.2), only in this git-ignored
    build: card role (one or two of roles.ROLES, the first is where it goes) and what (a short noun phrase) from
    roles.json, judged by eye and kept whole by roles.py, and on each interior (first role room) its marked room from
    planes.json (clean_room). Without roles.json it ships none: the page's word rules and kinds decide, and Set works."""
    from roles import ROLES, WHAT_MAX   # beside this file
    path, planes = data / "roles.json", data / "planes.json"
    if not path.exists():
        log(f"rooms: no roles.json in {data}: roles come from kinds")
        return
    R = json.loads(path.read_text())["cards"]
    P = json.loads(planes.read_text())["rooms"] if planes.exists() else {}
    n, marked, used = 0, [], set()
    for c in cards:
        e = (R.get(c["work"]) or {}).get(c["kind"])
        if not isinstance(e, dict):
            continue
        n += 1
        role = []
        for r in e.get("role") or []:
            if r in ROLES and r not in role:
                role.append(r)
        if role:
            c["role"] = role[:2]
        what = e.get("what")
        if isinstance(what, str) and 0 < len(what) <= WHAT_MAX and what == " ".join(what.split()):
            c["what"] = what
        room = P.get(c["work"]) or e.get("room")
        if c["kind"] != "space" or role[:1] != ["room"] or not isinstance(room, dict):
            continue
        used.add(c["work"])
        bad = []
        r = clean_room(room, bad.append)
        if bad:
            log(f"rooms: {c['id']} {c['work']}: dropped {', '.join(bad)}")
        if r["planes"]:
            c["room"] = r
            marked.append(c["id"])
    rooms = [c["id"] for c in cards if c.get("role", [""])[0] == "room"]
    log(f"rooms: roles on {n} of {len(cards)} cards; {len(rooms)} interiors, {len(marked)} marked: {' '.join(marked) or 'none'}")
    if set(P) - used:
        log(f"rooms: marked but not an interior in this deck, left out: {', '.join(sorted(set(P) - used))}")


def write_deck(pk, families, artists):
    for old in OUT_IMG.glob("*.webp"):
        if re.fullmatch(r"[iosucbm]\d{3}\.webp|atlas\.webp", old.name):
            old.unlink()
    cards, thumbs = [], []
    for kind in KINDS:
        for n, (w, extra) in enumerate(pk.cards[kind], 1):
            cid = f"{LETTER[kind]}{n:03d}"
            card = {
                "id": cid, "kind": kind, "work": w["id"],
                "url": w.get("artsy_url") or f"https://www.artsy.net/artwork/{w['id']}",
                "title": w.get("title"), "artist": artist_display(w), "date": w.get("date"),
                "year": w["_year"], "era": w["_era"], "category": w["_cat"], "medium": w.get("medium"),
                "materials": w["_materials"], "place": w["_place"], "colours": w["colours"],
                "genes": w["_genes"], "img": None, "w": None, "h": None, "thumb": len(cards), "source": "Artsy",
            }
            if w.get("image_url"):
                # the work's own image on Artsy's CDN, as the database stores it (the 'large' version):
                # the hub page a person publishes on github.io shows it from there, never a copy
                card["cdn"] = w["image_url"]
            if kind in ("image", "object", "space"):
                im = open_rgb(extra["src"])
                im.thumbnail((720, 720), Image.LANCZOS)
                im.save(OUT_IMG / f"{cid}.webp", "WEBP", quality=68, method=6)
                card.update(img=f"img/{cid}.webp", w=im.width, h=im.height)
            elif kind == "surface":
                im = open_rgb(extra["src"])
                x0, y0, side = extra["box"]
                W, H = extra["size"]
                crop = im.crop((x0, y0, x0 + side, y0 + side)).resize((512, 512), Image.LANCZOS)
                crop.save(OUT_IMG / f"{cid}.webp", "WEBP", quality=70, method=6)
                card.update(img=f"img/{cid}.webp", w=512, h=512,
                            crop=[round(x0 / W, 4), round(y0 / H, 4), round(side / W, 4), round(side / H, 4)],
                            texture=edge_density(crop))
            cards.append(card)
            thumbs.append(w)
    # texture: edge density of the crop, scaled so the deck's surfaces spread over 0..1
    dens = sorted(c["texture"] for c in cards if c["kind"] == "surface")
    if dens:
        lo, hi = dens[0], dens[-1]
        for c in cards:
            if c["kind"] == "surface":
                c["texture"] = round((c["texture"] - lo) / max(1e-6, hi - lo), 2)
    # after the Artsy cards, on their texture scale, so their ids, cells and fields stay as they were
    new_genes = building_cards(cards, thumbs, lo, hi)
    # the atlas: every card's work as a 128 px square, 20 columns
    cols, cell = 20, 128
    rows = math.ceil(len(cards) / cols)
    atlas = Image.new("RGB", (cols * cell, rows * cell), (238, 236, 242))
    for k, w in enumerate(thumbs):
        p = w if isinstance(w, Path) else best_source(w, ("large", "larger", "normalized"))
        im = open_rgb(p)
        th = ImageOps.fit(im, (cell, cell), Image.LANCZOS)
        atlas.paste(th, ((k % cols) * cell, (k // cols) * cell))
    atlas.save(OUT_IMG / "atlas.webp", "WEBP", quality=72, method=6)
    used = sorted({g for c in cards for g in c["genes"]})
    families = {**new_genes, **families}
    genes = {}
    for g in used:
        name = (families.get(g) or {}).get("name")
        if not name:
            name = next((x["name"] for v in artists.values() for x in (v.get("genes") or [])
                         if x and x.get("slug") == g), g)
        genes[g] = {"name": name, "family": families[g]["family"]}
    head = {"version": 1, "built": date.today().isoformat(),
            "source": "The art database: Artsy saves and Architectural Authority bookmarks",
            "atlas": {"src": "img/atlas.webp", "cell": cell, "cols": cols}, "genes": genes}
    add_others(cards, head)
    add_roles(cards)
    text = json.dumps(head, ensure_ascii=False, separators=(",", ":"))[:-1]
    text += ',"cards":[\n' + ",\n".join(json.dumps(c, ensure_ascii=False, separators=(",", ":"))
                                         for c in cards) + "\n]}\n"
    (DIST / "deck.json").write_text(text)
    report(cards)


def report(cards):
    from collections import Counter
    log("\n== deck ==")
    for kind in KINDS:
        ks = [c for c in cards if c["kind"] == kind]
        log(f"{kind:8s} {len(ks):3d}  chords {dict(Counter(chord_of(c['colours']) for c in ks))}")
        log(f"{'':8s}      hues {dict(Counter(main_hue(c['colours']) for c in ks))}")
        log(f"{'':8s}      eras {dict(Counter(c['era'] for c in ks))}")
        log(f"{'':8s}      places {dict(Counter(c['place'] for c in ks).most_common(8))}")
    log(f"chords overall {dict(Counter(chord_of(c['colours']) for c in cards))}")
    log(f"eras overall {dict(Counter(c['era'] for c in cards))}")
    files = [p for p in DIST.rglob("*") if p.is_file() and (p.parent == OUT_IMG or p.name in ("deck.json", "logo.webp"))]
    log(f"files {len(files)}, {sum(p.stat().st_size for p in files) / 1e6:.1f} MB "
        f"(deck.json {(DIST / 'deck.json').stat().st_size / 1e3:.0f} kB)")


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
    global DIST, OUT_IMG
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--fetch-only", action="store_true", help="fetch and cache genes, then stop")
    ap.add_argument("--no-logo", action="store_true")
    ap.add_argument("--out", type=Path, default=DIST, help="output folder (default 5s/dist)")
    args = ap.parse_args()
    DIST, OUT_IMG = args.out, args.out / "img"

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
