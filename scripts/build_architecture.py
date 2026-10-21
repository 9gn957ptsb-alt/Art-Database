"""Distil the private Architectural Authority dump into the site's public buildings.

Reads data/architecture_saves_raw.json — the artist's bookmarks, private and
gitignored — and writes docs/v2/architecture.json, which is small and committed.

Each bookmark is a magazine article about a building. The list is all the token
buys; a building's place in the world is public, and comes from the article's own
page (/article/<slug>), which needs no login. City and country there are geocoded
to a point once and cached, so the world can carry the building where it really
stands, the way the collages sit in their cities.

What is written is only what the globe needs — title, where it is, its point, its
year and firm where the page gives them, and the link back. Nothing says it was a
saved/bookmarked list; it is just the architecture the artist keeps an eye on.

    python3 scripts/fetch_architecture_saves.py   # first, with AA_TOKEN set
    python3 scripts/build_architecture.py          # then this

Geocoding uses nominatim.openstreetmap.org; that host must be allowed under the
environment's Network access. Results are cached in data/geocode_cache.json, so it
is only paid once per city.

A building the artist names that is not among the bookmarks (21 Oct 2026, the Shanghai Grand Opera House:
not in the Architectural Authority at all) is added by hand in scripts/architecture_hand.json, each entry as it
is written here, its point from the map, its link to its own source and that source's name (`source`: the page
says "Read it at …"), marked `"hand": true`. Every build appends them after the bookmarks; `--hand` merges them
into the existing file alone, without reading the bookmarks again. Rocket's sections and adventures keep to the
Architectural Authority's buildings (scripts/build_sections.js, scripts/build_adventures.py).

    python3 scripts/build_architecture.py --hand
"""

import json
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "architecture_saves_raw.json"
CACHE = ROOT / "data" / "geocode_cache.json"
INDEX = ROOT / "data" / "article_index.json"
OUT = ROOT / "docs" / "v2" / "architecture.json"
HAND = ROOT / "scripts" / "architecture_hand.json"

SITE = "https://www.thearchitecturalauthority.com"
ARTICLE = SITE + "/article/{slug}"
SITEMAP = SITE + "/sitemap.xml"
NOMINATIM = "https://nominatim.openstreetmap.org/search"

# Field-name variants, the way the app's own reader tolerates camel / snake / Pascal.
def pick(obj, names, default=""):
    for name in names:
        if isinstance(obj, dict) and obj.get(name) not in (None, ""):
            return obj[name]
    return default


def load_raw():
    if not RAW.exists():
        sys.exit(
            f"{RAW.relative_to(ROOT)} is not there. Run fetch_architecture_saves.py "
            "first (with AA_TOKEN set in the environment)."
        )
    return json.loads(RAW.read_text(encoding="utf-8"))


def load_cache():
    try:
        return json.loads(CACHE.read_text(encoding="utf-8"))
    except (FileNotFoundError, ValueError):
        return {}


def find_object(text, key):
    """Pull the JSON object that follows "key": out of a page, tolerating the
    backslash-escaping Next.js uses when it inlines data into HTML."""
    flat = text.replace('\\"', '"')
    marker = '"%s":' % key
    start = flat.find(marker)
    if start < 0:
        return None
    i = flat.find("{", start)
    if i < 0:
        return None
    depth = 0
    for j in range(i, min(len(flat), i + 4000)):
        if flat[j] == "{":
            depth += 1
        elif flat[j] == "}":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(flat[i:j + 1])
                except ValueError:
                    return None
    return None


def find_string(text, key):
    m = re.search(r'\\?"%s\\?"\s*:\s*\\?"((?:[^"\\]|\\.){0,200}?)\\?"' % re.escape(key), text)
    return m.group(1).replace('\\u0026', '&').strip() if m else ""


def page_id(text):
    m = re.search(r'\\?"articleId\\?"\s*:\s*(\d+)', text)
    return int(m.group(1)) if m else None


def article_index(session, wanted):
    """The bookmarks name articles only by number. Each public article page says
    its own number (articleId), so walk the sitemap's article pages once and
    keep number -> slug, cached in data/article_index.json."""
    try:
        index = {int(k): v for k, v in json.loads(INDEX.read_text(encoding="utf-8")).items()}
    except (FileNotFoundError, ValueError):
        index = {}
    if wanted <= set(index):
        return index
    try:
        r = session.get(SITEMAP, timeout=45)
        slugs = re.findall(r"<loc>%s/article/([^<]+)</loc>" % re.escape(SITE), r.text)
    except requests.RequestException as exc:
        print(f"  ! could not read the sitemap ({exc})")
        slugs = []
    known = set(index.values())
    for slug in slugs:
        if wanted <= set(index):
            break
        if slug in known:
            continue
        try:
            page = session.get(ARTICLE.format(slug=slug), timeout=45)
        except requests.RequestException:
            continue
        number = page_id(page.text) if page.status_code == 200 else None
        if number is not None:
            index[number] = slug
        time.sleep(0.2)
    INDEX.parent.mkdir(parents=True, exist_ok=True)
    INDEX.write_text(json.dumps(index, indent=2), encoding="utf-8")
    return index


def article_place(session, slug):
    """Fetch a public article page and read where its building is."""
    try:
        r = session.get(ARTICLE.format(slug=slug), timeout=45)
    except requests.RequestException as exc:
        print(f"  ! {slug}: could not fetch article page ({exc})")
        return None
    if r.status_code != 200:
        print(f"  ! {slug}: article page returned {r.status_code}")
        return None
    loc = find_object(r.text, "articleLocation") or {}
    year = find_string(r.text, "yearCompleted") or find_string(r.text, "year")
    return {
        "title": find_string(r.text, "title"),
        "city": pick(loc, ["city", "cityName", "City"]),
        "state": pick(loc, ["state", "stateName", "State"]),
        "country": pick(loc, ["country", "countryName", "Country"]),
        "year": year,
    }


# The articles give a town at best. Where a building is a public place, its
# own spot was looked up by hand (23-24 Sep 2026) and is kept here, with where
# it came from; its point is then the building rather than the town. Private
# homes are never pinned closer than their town (the artist's choice, 24 Sep
# 2026): the site and this repository are public.
#   precision: "exact" (the building), "street" (its block), "district",
#   "town", "region" (department or province, when no town is given).
SPOTS = {
    # OpenStreetMap: Naman Retreat, Đường Trường Sa; the spa is in its grounds.
    "embracing-nature-naman-pure-spa-by-mia-design-studio":
        {"lat": 15.9697, "lon": 108.2854, "precision": "exact"},
    # Zaratán town hall: c/ Trasiglesia 9, behind San Pedro Apóstol. The street
    # is not in OpenStreetMap, so the point is the church beside it.
    "honouring-memory-centro-cultural-los-lavaderos-by-modulo-arquitectos-and-amd-arquitectos":
        {"lat": 41.6615, "lon": -4.7827, "precision": "street"},
    # The winery's listing: La Masía, Villa Agrícola, Gualtallary. Only the
    # district is on the map.
    "escala-humana-wines-winery-by-estudio-monte-arquitectura-estudio-rare-and-unamuno-arquitectura":
        {"lat": -33.3853, "lon": -69.2771, "precision": "district"},
    # The clinic's own site and Guía del Dentista: C. de la Alcaparra 35, 47008
    # Valladolid; OpenStreetMap has the house number (24 Sep 2026).
    "the-precision-of-the-subtle-clinica-dental-apolonia-by-jga-arquitectura":
        {"lat": 41.6135, "lon": -4.7603, "precision": "exact"},
    # University of Jyväskylä's Main Building (Päärakennus, Alvar Aalto 1954–56),
    # Seminaarinkatu 15: OpenStreetMap's "Jyväskylän yliopiston päärakennus (C)" via
    # Nominatim (13 Oct 2026). A public university building.
    "timeless-architecture-university-of-jyvskyl-campus-by-alvar-aalto":
        {"lat": 62.23643, "lon": 25.73230, "precision": "exact"},
    # Centro de Innovación UC Anacleto Angelini (ELEMENTAL, 2014), Av. Vicuña Mackenna 4860, Campus San
    # Joaquín of the Pontificia Universidad Católica: OpenStreetMap building way 157740163 (height 44 m,
    # 11 levels) via Nominatim, the point its own (15 Oct 2026). A public university building.
    "redefining-work-environments-the-uc-innovation-center-by-elemental":
        {"lat": -33.49775, "lon": -70.61525, "precision": "exact"},
    # Museo Chileno de Arte Precolombino (the Real Casa de Aduana, Bandera 361, Santiago centro): OpenStreetMap
    # node 1297763053 "Museo de Arte Precolombino" via Nominatim (15 Oct 2026). A public museum.
    "renovation-pre-columbian-museum-by-smiljan-radic":
        {"lat": -33.43902, "lon": -70.65220, "precision": "exact"},
    # BEEAH Group Headquarters (Zaha Hadid Architects, Sharjah): OpenStreetMap way 1077753326 "BEEAH Group
    # Headquarters" via Nominatim (20 Oct 2026). A public corporate building.
    "sustainable-innovation-the-headquarters-of-beeah-group-by-zaha-hadid-architect":
        {"lat": 25.28533, "lon": 55.65271, "precision": "exact"},
    # Anantara Mina Al Arab resort, Ras Al Khaimah: OpenStreetMap node 11601727670 "Anantara Mina Al Arab" (tourism=hotel)
    # via Nominatim (20 Oct 2026). A public resort.
    "beachfront-retreat-anantara-mina-al-arab-ras-al-khaimah-resort-by-anantara-hotels-and-resorts":
        {"lat": 25.72184, "lon": 55.85107, "precision": "exact"},
    # Medika 10 (6a Avenida, Zona 10, Guatemala City): OpenStreetMap building way 400891967 "Medika 10" via Nominatim
    # (20 Oct 2026). A public medical and commercial building.
    "light-and-connection-medika-10-by-paredes-aleman-arquitectos":
        {"lat": 14.60934, "lon": -90.50960, "precision": "exact"},
    # Pueblo Serena shopping centre, Monterrey: OpenStreetMap way 306773379 (landuse=retail) "Pueblo Serena" via
    # Nominatim (20 Oct 2026). A public shopping centre.
    "unconventional-center-pueblo-serena-by-carranza-y-ruiz-arquitectura":
        {"lat": 25.57598, "lon": -100.24862, "precision": "exact"},
    # Rue Jean-Bart: the article's location block gives no city, only the country, but its own heading says
    # "Paris, France"; a block of homes, so Paris's middle only (OpenStreetMap relation 71525 via Nominatim,
    # 20 Oct 2026) — never its street.
    "parisian-elegance-rue-jean-bart-by-jean-christophe-quinton":
        {"lat": 48.8535, "lon": 2.3484, "precision": "town"},
    # The Le Cèdre Socio-Cultural Center: the article names only the department (Hauts-de-Seine) — OpenStreetMap
    # relation 7449 via Nominatim, 20 Oct 2026; the department's middle, not the building.
    "the-final-piece-the-le-cdre-socio-cultural-center-by-guillaume-ramillien":
        {"lat": 48.8402, "lon": 2.1986, "precision": "region"},
}


def hand_entries():
    """The buildings the artist named by hand (architecture_hand.json), as they are written into the file."""
    if not HAND.exists():
        return []
    rows = json.loads(HAND.read_text(encoding="utf-8")).get("buildings", [])
    out = []
    for row in rows:
        entry = {k: v for k, v in row.items() if not k.startswith("_")}   # "_sources" and notes stay in the table
        entry["hand"] = True
        out.append(entry)
    return out


def with_hand(buildings):
    """The bookmarks' buildings, then the hand ones not already among them."""
    have = {b["slug"] for b in buildings}
    return buildings + [h for h in hand_entries() if h["slug"] not in have]


def short_name(title):
    """"Roots of the Mountain – Casa LL by RA! Arquitectura" -> "Casa LL"."""
    name = re.split(r"\s[–—]\s", title, maxsplit=1)[-1]
    name = re.split(r"\sby\s", name, maxsplit=1)[0]
    return re.split(r"\sin\s", name, maxsplit=1)[0].strip() or title


def nominatim(session, params):
    try:
        r = session.get(NOMINATIM, params={"format": "json", "limit": 1, **params},
                        headers={"User-Agent": "art-database-build/1.0 (matthew livingston site)"},
                        timeout=45)
        hit = r.json()[0] if r.status_code == 200 and r.json() else None
    except (requests.RequestException, ValueError, IndexError):
        # Not cached: a refused or failed request is not an answer.
        raise LookupError("geocoder unreachable")
    time.sleep(1.0)  # Nominatim asks for no more than one request a second
    return {"lat": round(float(hit["lat"]), 4), "lon": round(float(hit["lon"]), 4)} if hit else None


def geocode(session, cache, city, state, country):
    """The town if there is one; otherwise the department or province. Never
    the country alone — the middle of a country is nowhere in particular."""
    key = ", ".join([p for p in (city, state, country) if p]).lower()
    if not key or not (city or state):
        return None
    if cache.get(key) and "precision" in cache[key] and cache[key].get("v") == 2:
        return cache[key]
    try:
        point = None
        if city:
            params = {"city": city, "country": country}
            if state:
                params["state"] = state
            point = nominatim(session, params)
            precision = "town"
            if not point:                      # "Departamento de X" is not a city
                point = nominatim(session, {"q": ", ".join(p for p in (city, state, country) if p)})
                precision = "region"
        if not point and state:
            point = (nominatim(session, {"state": state, "country": country}) or
                     nominatim(session, {"state": re.sub(r"(?i)\s*department\b|\bdepartamento de\s*", "", state).strip(),
                                         "country": country}))
            precision = "region"
    except LookupError:
        return None
    cache[key] = dict(point, precision=precision, v=2) if point else None
    return cache[key]


def main():
    if "--hand" in sys.argv:
        # Only the hand table: the bookmarks' buildings as they stand in the file, then the hand ones.
        current = json.loads(OUT.read_text(encoding="utf-8")).get("buildings", []) if OUT.exists() else []
        buildings = with_hand([b for b in current if not b.get("hand")])
        OUT.write_text(json.dumps({"buildings": buildings}, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"Wrote {len(buildings)} building(s), {sum(1 for b in buildings if b.get('hand'))} by hand, "
              f"to {OUT.relative_to(ROOT)}")
        return
    saves = load_raw()
    cache = load_cache()
    session = requests.Session()
    wanted = {int(row["article_id"]) for row in saves
              if isinstance(row, dict) and not pick(row, ["slug", "Slug"])
              and str(row.get("article_id", "")).isdigit()}
    index = article_index(session, wanted) if wanted else {}
    missing = sorted(wanted - set(index))
    if missing:
        print(f"  · no public article page found for id(s) {missing}")
    buildings = []
    for row in saves:
        if not isinstance(row, dict):
            continue
        slug = str(pick(row, ["slug", "Slug"]))
        if not slug and str(row.get("article_id", "")).isdigit():
            slug = index.get(int(row["article_id"]), "")
        title = str(pick(row, ["title", "Title", "headline", "Headline"]))
        if not slug:
            continue
        place = article_place(session, slug)
        if not place:
            continue
        title = title or place["title"]
        point = SPOTS.get(slug) or geocode(session, cache, place["city"], place["state"],
                                           place["country"])
        where = ", ".join(p for p in (place["city"] or place["state"], place["country"]) if p)
        entry = {
            "title": title,
            "name": short_name(title),
            "slug": slug,
            "url": ARTICLE.format(slug=slug),
            "city": place["city"],
            "country": place["country"],
            "where": where,
        }
        if place["year"]:
            entry["year"] = place["year"]
        if point:
            entry["lat"] = point["lat"]
            entry["lon"] = point["lon"]
            entry["precision"] = point["precision"]
        else:
            print(f"  · {slug}: no point for {place['city']!r}, {place['country']!r} "
                  "(kept without one; allow nominatim.openstreetmap.org to place it)")
        buildings.append(entry)
        print(f"  + {title or slug}  —  {place['city']}, {place['country']}")

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")

    buildings = with_hand(buildings)
    placed = [b for b in buildings if "lat" in b]
    OUT.write_text(json.dumps({"buildings": buildings}, indent=2, ensure_ascii=False),
                   encoding="utf-8")
    print(f"\nWrote {len(buildings)} building(s) ({len(placed)} placed) to "
          f"{OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
