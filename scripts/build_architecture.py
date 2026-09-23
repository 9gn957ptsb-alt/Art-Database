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
OUT = ROOT / "docs" / "v2" / "architecture.json"

SITE = "https://www.thearchitecturalauthority.com"
ARTICLE = SITE + "/article/{slug}"
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
        "city": pick(loc, ["city", "cityName", "City"]),
        "state": pick(loc, ["state", "stateName", "State"]),
        "country": pick(loc, ["country", "countryName", "Country"]),
        "year": year,
    }


def geocode(session, cache, city, state, country):
    key = ", ".join([p for p in (city, state, country) if p]).lower()
    if not key:
        return None
    if key in cache:
        return cache[key]
    params = {"format": "json", "limit": 1, "city": city, "country": country}
    if state:
        params["state"] = state
    try:
        r = session.get(NOMINATIM, params=params,
                        headers={"User-Agent": "art-database-build/1.0 (matthew livingston site)"},
                        timeout=45)
        hit = r.json()[0] if r.status_code == 200 and r.json() else None
    except (requests.RequestException, ValueError, IndexError):
        hit = None
    cache[key] = ({"lat": round(float(hit["lat"]), 4), "lon": round(float(hit["lon"]), 4)}
                  if hit else None)
    time.sleep(1.0)  # Nominatim asks for no more than one request a second
    return cache[key]


def main():
    saves = load_raw()
    cache = load_cache()
    session = requests.Session()
    buildings = []
    for row in saves:
        if not isinstance(row, dict):
            continue
        slug = str(pick(row, ["slug", "Slug"]))
        title = str(pick(row, ["title", "Title", "headline", "Headline"]))
        if not slug:
            continue
        place = article_place(session, slug)
        if not place:
            continue
        point = geocode(session, cache, place["city"], place["state"], place["country"])
        entry = {
            "title": title,
            "slug": slug,
            "url": ARTICLE.format(slug=slug),
            "city": place["city"],
            "country": place["country"],
        }
        if place["year"]:
            entry["year"] = place["year"]
        if point:
            entry["lat"] = point["lat"]
            entry["lon"] = point["lon"]
        else:
            print(f"  · {slug}: no point for {place['city']!r}, {place['country']!r} "
                  "(kept without one; allow nominatim.openstreetmap.org to place it)")
        buildings.append(entry)
        print(f"  + {title or slug}  —  {place['city']}, {place['country']}")

    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")

    placed = [b for b in buildings if "lat" in b]
    OUT.write_text(json.dumps({"buildings": buildings}, indent=2, ensure_ascii=False),
                   encoding="utf-8")
    print(f"\nWrote {len(buildings)} building(s) ({len(placed)} placed) to "
          f"{OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
