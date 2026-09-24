#!/usr/bin/env python3
"""The museums that hold the artist's saved works, for the globe.

The Artsy saves (data/artsy_saves_raw.json, private, fetched by
fetch_artsy_saves.py) say where a work is in two ways:

  * the partner that put it on Artsy — when that partner is a museum
    (Artsy's "Institution" partners in its "museums" category), the museum
    has it;
  * `collecting_institution` — for works put up by archives and dealers, the
    museum whose collection it is in ("Musée d'Orsay, Paris"). Exhibition
    credits ('"Picasso Sculpture" at Museum of Modern Art') and private
    collections are not holdings and are left out.

A museum is placed at its own address: Artsy's partner locations give the
coordinates of each museum partner (api.artsy.net, whose token the session's
proxy adds — this script sends none); a museum that is only named in a
credit is looked up once on nominatim.openstreetmap.org. Both are cached in
data/, which is never committed.

Writes docs/v2/museums.json — the museums and, under each, the saved works it
holds: title, artist, date, medium and a picture off Artsy's image CDN. The
artist asked for each museum to be referenced with the works he saved there
(24 Sep 2026). Nothing says it is a saved list.

    python3 scripts/build_museums.py
"""

import json
import math
import re
import sys
import time
import unicodedata
import urllib.parse
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "artsy_saves_raw.json"
LOCATIONS = ROOT / "data" / "artsy_partner_locations.json"
GEOCODE = ROOT / "data" / "museum_geocode_cache.json"
OUT = ROOT / "docs" / "v2" / "museums.json"

ARTSY = "https://api.artsy.net/api/v1/partner/{}/locations"
NOMINATIM = "https://nominatim.openstreetmap.org/search"
AGENT = "Art-Database/1.0 (artist website; github.com/9gn957ptsb-alt/Art-Database)"
CDN = "https://d32dm0rphc51dk.cloudfront.net/"

MUSEUM_CATEGORIES = {"museums", "university-museums-slash-educational-institutions"}
# Words that make a credit a museum's rather than a person's or a place's.
MUSEUMISH = re.compile(r"museum|mus[eé]e|museo|gallery|galerie|galleria|kunsthalle|"
                       r"nationalgalerie|pinacoteca|institute|kunsthaus|kunstmuseum|"
                       r"collection$|tate |fondation|foundation|centre|center",
                       re.I)
NOT_HELD = re.compile(r'^\s*["“]|" at |” at |\bat the\b|private|collection of|courtesy|'
                      r"estate|\d{4}\s*[-–]\s*\d{4}|\(\d{4}", re.I)
# Partners Artsy files as museums that are not ones: an auction house, a
# touring organisation, a picture agency, an association, a nameless lender.
NOT_MUSEUMS = {"christies-old-masters", "american-federation-of-arts", "rmn-grand-palais",
               "white-house-historical-association"}
NOT_MUSEUM_CREDITS = re.compile(r"^swiss foundation|^exhibition pavil", re.I)
# Credits that name a partner museum in other words.
ALIASES = {
    "musee national d'art moderne": "centre-pompidou",
    "musee national picasso": "musee-picasso-paris",
    "vincent van gogh museum": "van-gogh-museum",
    "richard artschwager!": "hammer-museum",
    "tate gallery": "tate-britain",
    "nationalgalerie, staatliche museen zu berlin": "alte-nationalgalerie",
}
# Credits Nominatim knows by another name.
QUERIES = {
    "Munson Williams Proctor Arts Institute, Utica": "Munson Museum Utica",
    "Galleria Nazionale d'Arte Moderna Rome": "Galleria Nazionale d'Arte Moderna e Contemporanea",
    "Galleria d'arte moderna di Bologna, Bologna": "MAMbo Bologna",
    "Musei Vaticani, Pinacoteca, Rome": "Pinacoteca Vaticana",
    "Galleria dell'Accademia, Venice": "Gallerie dell'Accademia Venezia",
}
# Where OpenStreetMap's first answer is the museum's other house (Belvedere 21).
ARTSY_RIGHT = {"Belvedere Museum"}
# And those it does not know at all, placed by hand at their doors.
SPOTS = {
    "Pushkin Museum of Fine Arts, Moscow": (55.7473, 37.6050, "Moscow, RU"),  # Volkhonka 12
}
# How many of a museum's works the page carries, most recently saved first.
WORKS_EACH = 34

VERSIONS = ["large", "medium", "larger", "normalized", "square", "small", "main"]


def flat(text):
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\(.*?\)", " ", text)
    text = re.sub(r"\b(the|of|de|du|del|di|d|and|art|arts|fine|museum|musee|museo|"
                  r"gallery|national|nationale|nacional)\b", " ", text)
    return " ".join(re.findall(r"[a-z0-9]+", text))


def picture(rec):
    images = rec.get("images") or []
    image = next((i for i in images if i.get("is_default")), images[0] if images else None)
    if not image:
        return None
    url = image.get("image_url") or ""
    if not url.startswith(CDN):
        return None
    have = set(image.get("image_versions") or [])
    version = next((v for v in VERSIONS if v in have), None)
    return url[len(CDN):].split("/")[0] + "/" + version if version else None


def load(path):
    return json.loads(path.read_text()) if path.exists() else {}


def partner_location(pid, cache, session):
    if pid not in cache:
        r = session.get(ARTSY.format(pid), timeout=60)
        cache[pid] = r.json() if r.ok else []
        time.sleep(0.3)
    for loc in sorted(cache[pid] or [], key=lambda l: l.get("position") or 99):
        c = loc.get("coordinates") or {}
        if isinstance(c.get("lat"), (int, float)) and c.get("lat"):
            where = ", ".join(x for x in (loc.get("city"), loc.get("country")) if x)
            return c["lat"], c["lng"], where
    return None


def geocode(credit, cache):
    """A credit looked up as it is, then as its first and last parts (the
    museum and its city), then as the museum alone."""
    if credit in SPOTS:
        return SPOTS[credit]
    if credit in QUERIES:
        return look_up(QUERIES[credit], cache)
    parts = [x.strip() for x in credit.split(",") if x.strip()]
    tries = [credit]
    if len(parts) > 2:
        tries.append(parts[0] + ", " + parts[-1])
    if len(parts) > 1:
        tries.append(parts[0])
    for name in tries:
        hit = look_up(name, cache)
        if hit:
            return hit
    return None


def look_up(name, cache):
    if name not in cache:
        q = urllib.parse.urlencode({"q": name, "format": "jsonv2", "limit": 1,
                                    "addressdetails": 1, "accept-language": "en"})
        r = requests.get(NOMINATIM + "?" + q, headers={"User-Agent": AGENT}, timeout=60)
        cache[name] = r.json() if r.ok else []
        time.sleep(1.1)                     # Nominatim's rule: one a second
    hits = cache[name] or []
    if not hits:
        return None
    h = hits[0]
    a = h.get("address") or {}
    town = a.get("city") or a.get("town") or a.get("village") or a.get("state") or ""
    where = ", ".join(x for x in (town, (a.get("country_code") or "").upper()) if x)
    return float(h["lat"]), float(h["lon"]), where


def checked(spot, name, cache):
    """Artsy's point, unless OpenStreetMap has the museum itself somewhere
    else in the same city — some partner addresses were geocoded to the
    city's middle (SFMOMA sat on City Hall). A museum of the same name in
    another city is some other museum, and Artsy's point stands."""
    if name in ARTSY_RIGHT:
        return spot
    bare = re.sub(r"\s*\(.*?\)", "", name).split(",")[0]
    osm = look_up(QUERIES.get(name, bare + ", " + spot[2].split(",")[0]), cache)
    if not osm:
        return spot
    dy = (osm[0] - spot[0]) * 111320
    dx = (osm[1] - spot[1]) * 111320 * math.cos(math.radians(spot[0]))
    far = math.hypot(dx, dy)
    return (osm[0], osm[1], spot[2]) if 150 < far < 30000 else spot


def slugify(text):
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode().lower()
    return "-".join(re.findall(r"[a-z0-9]+", text))[:60]


def main():
    if not RAW.exists():
        sys.exit("No data/artsy_saves_raw.json — run scripts/fetch_artsy_saves.py first.")
    raw = json.loads(RAW.read_text())
    locations, geocoded = load(LOCATIONS), load(GEOCODE)
    # A blank answer may have been Nominatim turning a busy client away; ask again.
    geocoded = {k: v for k, v in geocoded.items() if v}

    # The museums among the partners, and a way to know one by its name.
    partners = {}
    for rec in raw:
        p = rec.get("partner") or {}
        cats = {c.get("id") for c in p.get("partner_categories") or []}
        if (p.get("type") == "Institution" and cats & MUSEUM_CATEGORIES
                and p["id"] not in NOT_MUSEUMS):
            partners[p["id"]] = p["name"]
    by_name = {flat(n): pid for pid, n in partners.items()}

    def known(credit):
        """The partner museum a credit names, if it is one of them."""
        low = unicodedata.normalize("NFKD", credit).encode("ascii", "ignore").decode().lower()
        for alias, pid in ALIASES.items():
            if low.startswith(alias) and pid in partners:
                return pid
        head = flat(credit.split(",")[0])
        whole = flat(credit)
        for key, pid in by_name.items():
            if key and (key == head or key == whole or (len(key) > 8 and key in whole)):
                return pid
        return None

    held = {}                                  # museum key -> works
    names = {}
    for rec in raw:
        p = rec.get("partner") or {}
        credit = " ".join((rec.get("collecting_institution") or "").split())
        key = None
        if (credit and MUSEUMISH.search(credit) and not NOT_HELD.search(credit)
                and not NOT_MUSEUM_CREDITS.search(credit)):
            pid = known(credit)
            key = ("artsy", pid) if pid else ("named", credit)
        elif p.get("id") in partners:
            key = ("artsy", p["id"])
        if not key:
            continue
        names[key] = partners[key[1]] if key[0] == "artsy" else key[1]
        held.setdefault(key, []).append(rec)

    session = requests.Session()
    session.headers.update({"Accept": "application/vnd.artsy-v2+json"})
    museums, missed = {}, []
    for key, recs in held.items():
        name = names[key]
        spot = partner_location(key[1], locations, session) if key[0] == "artsy" else None
        if spot:
            spot = checked(spot, name, geocoded)
        if not spot:
            spot = geocode(name, geocoded)
        if not spot:
            missed.append(name)
            continue
        lat, lon, where = spot
        # Two credits for one museum (the partner and a spelling of it) meet
        # at the same door, and become one museum. Neighbours on one square
        # (the Van Gogh and the Stedelijk) stay two.
        slug = "museum-" + (key[1] if key[0] == "artsy" else slugify(name.split(",")[0]))
        m = museums.get(slug) or next(
            (m for m in museums.values()
             if abs(m["lat"] - lat) < 0.0003 and abs(m["lon"] - lon) < 0.0003), None)
        if not m:
            m = museums[slug] = {"slug": slug, "name": name.split(",")[0].strip()
                                 if key[0] == "named" else name,
                                 "where": where, "lat": round(lat, 5), "lon": round(lon, 5),
                                 "precision": "exact", "_recs": []}
        m["_recs"].extend(recs)

    out = []
    for m in museums.values():
        recs = sorted({r["id"]: r for r in m.pop("_recs")}.values(),
                      key=lambda r: r.get("last_saved_at") or "", reverse=True)
        works = []
        for r in recs:
            key = picture(r)
            if not key:
                continue
            works.append({"t": r.get("title") or "Untitled",
                          "a": (r.get("artist") or {}).get("name") or "",
                          "y": r.get("date") or "", "m": r.get("medium") or "",
                          "i": key})
        if not works:
            continue
        m["held"] = len(recs)
        m["works"] = works[:WORKS_EACH]
        out.append(m)
    out.sort(key=lambda m: -m["held"])

    LOCATIONS.write_text(json.dumps(locations))
    GEOCODE.write_text(json.dumps(geocoded))
    OUT.write_text(json.dumps({"cdn": CDN, "museums": out}, separators=(",", ":"),
                              ensure_ascii=False), encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB  "
          f"{len(out)} museums, {sum(m['held'] for m in out)} works held")
    for m in out:
        print(f"  {m['held']:4d}  {m['name']}  —  {m['where']}")
    if missed:
        print("Not found:", "; ".join(missed))


if __name__ == "__main__":
    main()
