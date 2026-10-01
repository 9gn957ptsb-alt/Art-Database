#!/usr/bin/env python3
"""The history of every saved artwork, for the Artist Website: where it has been, every show it was
in, every sale, and what has been written about it — dated, placed on the Earth, and each with its
sources — and the threads that join one work's history to another's. (Artist's request and
decisions, 27 Sep 2026: see CLAUDE.md, "Artwork histories".)

Reads, all private in data/histories/:
  artsy/       Artsy's record, shows, sales, fairs and partner locations (fetch_artwork_histories.py)
  parsed/      the provenance, exhibition history and literature Artsy's partners wrote, read into
               events by the parsing workflow and kept only where check_parsed_histories.py passes them
  <source>/    one file per work from each further source (fetch_history_*.py: the National Gallery
               of Art's open data, museum APIs, Wikidata, catalogues raisonnés, scholarship,
               criticism), each {"id", "source", "match", "events"}

and writes, public:
  docs/v2/histories/<_id>.json     one work's events in order, merged across sources, each with a
                                   place where one is known, its sources and its threads; and what
                                   has been said of it, quoted (`said`: artwork_said.py, with the
                                   museum labels and Wikipedia openings fetch_artwork_said.py caches)
  docs/v2/threads/<tid>.json       a thread: the works that share one show, sale, owner, museum,
                                   writing or artist, in the order they arrived
  docs/v2/places.json              every place a work has been, most visited first
  docs/v2/places/<p>.json          one place: its institutions, and the works that passed through them
  docs/v2/finding.json             what Find searches: every work and every thread, in brief

and, after a full build, docs/v2/cities.json (build_cities.py): the towns of the Museums layer.

Places are Artsy's own coordinates where it has them (shows, fairs, partners), else the museum's
point from museums.json, else the named city geocoded once on Nominatim (cached in
data/histories/geocode.json). Nothing is placed more exactly than its source says, a writing is
never placed (it is not travel), and nothing about price is ever written.

    python3 scripts/build_artwork_histories.py [--only artsy-id] [--no-geocode]
"""

import argparse
import datetime
import glob
import hashlib
import html
import json
import math
import re
import statistics
import sys
import time
import unicodedata
import urllib.parse
from collections import Counter
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_artwork_histories import filename  # noqa: E402
from check_parsed_histories import problems  # noqa: E402
from build_museums import ALIASES as MUSEUM_ALIASES  # noqa: E402
import artwork_said  # noqa: E402

DATA = ROOT / "data" / "histories"
SAVES = ROOT / "data" / "artsy_saves_raw.json"
MUSEUMS = ROOT / "docs" / "v2" / "museums.json"
SITE = ROOT / "docs" / "v2"
OUT = SITE / "histories"
THREADS = SITE / "threads"
PLACES = SITE / "places"
GEOCODE = DATA / "geocode.json"
CDN = "https://d32dm0rphc51dk.cloudfront.net/"
AGENT = {"User-Agent": "Art-Database/1.0 (artist website; github.com/9gn957ptsb-alt/Art-Database)"}
NOMINATIM = "https://nominatim.openstreetmap.org/"
NOW = datetime.date.today().year
ORDER = {"made": 0, "owned": 1, "held": 1, "listed": 1, "exhibited": 2, "offered": 2, "sold": 2,
         "written": 3, "other": 4}

# Country names as sources write them, to ISO-2, so that every place is "City, CC": Artsy's shows
# say "United States" where its partners say "US", and there must be one New York.
COUNTRY = {
    "united states": "US", "united states of america": "US", "usa": "US", "u s a": "US", "us": "US",
    "america": "US", "united kingdom": "GB", "uk": "GB", "u k": "GB", "england": "GB", "scotland": "GB",
    "wales": "GB", "great britain": "GB", "britain": "GB", "northern ireland": "GB", "france": "FR",
    "germany": "DE", "deutschland": "DE", "italy": "IT", "italia": "IT", "spain": "ES", "espana": "ES",
    "switzerland": "CH", "schweiz": "CH", "suisse": "CH", "netherlands": "NL", "the netherlands": "NL",
    "holland": "NL", "belgium": "BE", "belgique": "BE", "austria": "AT", "osterreich": "AT",
    "denmark": "DK", "sweden": "SE", "norway": "NO", "finland": "FI", "iceland": "IS", "ireland": "IE",
    "portugal": "PT", "greece": "GR", "poland": "PL", "czech republic": "CZ", "czechia": "CZ",
    "hungary": "HU", "romania": "RO", "russia": "RU", "russian federation": "RU", "ukraine": "UA",
    "turkey": "TR", "turkiye": "TR", "israel": "IL", "lebanon": "LB", "egypt": "EG",
    "united arab emirates": "AE", "uae": "AE", "qatar": "QA", "saudi arabia": "SA", "india": "IN",
    "china": "CN", "hong kong": "HK", "taiwan": "TW", "japan": "JP", "south korea": "KR", "korea": "KR",
    "republic of korea": "KR", "north korea": "KP", "singapore": "SG", "thailand": "TH",
    "malaysia": "MY", "indonesia": "ID", "philippines": "PH", "vietnam": "VN", "australia": "AU",
    "new zealand": "NZ", "canada": "CA", "mexico": "MX", "brazil": "BR", "argentina": "AR",
    "chile": "CL", "colombia": "CO", "peru": "PE", "uruguay": "UY", "venezuela": "VE", "cuba": "CU",
    "south africa": "ZA", "nigeria": "NG", "senegal": "SN", "morocco": "MA", "monaco": "MC",
    "luxembourg": "LU", "liechtenstein": "LI", "malta": "MT", "cyprus": "CY", "slovenia": "SI",
    "croatia": "HR", "serbia": "RS", "lithuania": "LT", "latvia": "LV", "estonia": "EE",
    "georgia": "GE", "vatican city": "VA", "vatican": "VA", "holy see": "VA", "san marino": "SM",
}

# A venue that is only a page on the web: the work was never there, so it gets no place. ("Only
# Exhibition, IT" sat at Kolkata's coordinates.)
ONLINE = re.compile(r"\b(only exhibition|online|viewing room|artsy|virtual)\b", re.I)

# The partner's own texts, read by the parsing workflow: a place must be in their words.
PARTNER_FIELDS = {"provenance", "exhibition_history", "literature", "additional_information", "blurb"}

# Partners that list pictures of works they never held: an image agency.
NOT_HOLDERS = ["Art Resource"]

# One city under the names sources and Nominatim give it.
CITY_NAMES = {
    "city of new york": "New York", "new york city": "New York", "nyc": "New York",
    "manhattan": "New York", "brooklyn": "New York", "greater london": "London",
    "city of london": "London", "city of westminster": "London", "westminster": "London",
    "washington d c": "Washington", "washington dc": "Washington",
    "district of columbia": "Washington", "city of utica": "Utica", "gainsville": "Gainesville",
    "ciudad autonoma de buenos aires": "Buenos Aires", "admiralty": "Hong Kong",
    "nordhavn": "Copenhagen", "milano": "Milan", "firenze": "Florence", "roma": "Rome",
    "venezia": "Venice", "torino": "Turin", "napoli": "Naples", "genova": "Genoa", "koln": "Cologne",
    "munchen": "Munich", "wien": "Vienna", "zurich": "Zurich", "geneve": "Geneva", "bruxelles": "Brussels",
    "den haag": "The Hague", "warszawa": "Warsaw", "praha": "Prague", "lisboa": "Lisbon",
    "sevilla": "Seville", "st louis": "Saint Louis", "ciudad de mexico": "Mexico City",
    "copenhagen k": "Copenhagen", "copenhagen v": "Copenhagen", "kobenhavn": "Copenhagen",
    "st petersburg": "Saint Petersburg", "taipei city": "Taipei", "ixelles elsene": "Ixelles",
}

# US states, so a provenance's "Guilford, CT" is looked up in Connecticut.
US_STATES = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California",
    "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware", "FL": "Florida", "GA": "Georgia",
    "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts",
    "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont",
    "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "Conn.": "Connecticut", "Mass.": "Massachusetts", "Calif.": "California", "Penn.": "Pennsylvania",
    "Pa.": "Pennsylvania", "Va.": "Virginia", "Md.": "Maryland", "Ill.": "Illinois",
    "Mich.": "Michigan", "Wis.": "Wisconsin", "Minn.": "Minnesota", "N.J.": "New Jersey",
    "N.Y.": "New York", "Fla.": "Florida", "Ga.": "Georgia", "Tex.": "Texas", "Colo.": "Colorado",
    "Ariz.": "Arizona", "Ore.": "Oregon", "Del.": "Delaware", "R.I.": "Rhode Island",
    "N.H.": "New Hampshire", "Vt.": "Vermont", "N.C.": "North Carolina", "S.C.": "South Carolina",
}
US_STATES.update({v: v for v in list(US_STATES.values())})

# Show titles that many unrelated shows share: such a show is the same show only at the same venue.
GENERIC_SHOWS = re.compile(
    r"^(winter |summer |spring |autumn |fall |holiday |annual |inaugural |gallery )?"
    r"(group (show|exhibition)|show|exhibition|selections?|highlights|masterpieces|masterworks|"
    r"new works?|recent works?|selected works|small works|works on paper|new acquisitions|"
    r"gallery artists|collection|prints( and multiples)?|contemporary art|modern art)"
    r"( \d{4})?$")

# Owners that are nobody in particular: never a thread, never gathered. (Private owners are named
# only as the published provenance names them.)
OWNER_STOP = re.compile(
    r"present owner|current owner|privat|particuli|particular|anonym|descent|inheritance|by bequest|"
    r"unknown|studio|publisher|the nation\b|previous owner|former owner|corporate collection|"
    r"^(a|an|one|another|several|various) |^(gallery|collection|dealer|museum|foundation)$|"
    r"^(the )?(artist|sitter|family|estate|heirs?|widow|son|daughter|children|owner|collector)\b|"
    r"^(his|her|their|its) |^(the )?artist s |^estate of the artist|^thence|^sale\b|^acquired\b")

# One owner under two names.
OWNER_ALIASES = {
    "galerie durand ruel": "durand ruel", "durand ruel cie": "durand ruel", "durand ruel et cie": "durand ruel",
    "m s rau antiques": "m s rau",
    "durand ruel galleries": "durand ruel", "durand ruel and cie": "durand ruel",
    "ambroise vollard": "vollard", "galerie vollard": "vollard",
    "m knoedler co": "knoedler", "m knoedler and co": "knoedler", "knoedler co": "knoedler",
    "knoedler and company": "knoedler", "m knoedler co inc": "knoedler",
    "paul mellon collection": "paul mellon", "mr and mrs paul mellon": "paul mellon",
    "wildenstein co": "wildenstein", "wildenstein and co": "wildenstein",
    "galerie bernheim jeune": "bernheim jeune", "bernheim jeune cie": "bernheim jeune",
    "leo castelli gallery": "leo castelli", "castelli gallery": "leo castelli",
    "sidney janis": "sidney janis gallery",
}

# What a price looks like in a source's words: nothing about price is ever written, so a clause that
# names one is left out of the note and the quotation (titles stand as they are).
PRICE = re.compile(r"[£$€¥]\s?\d|\d\s?(?:[Ff]rancs?|fr\.|FF|[Dd]ollars?|[Pp]ounds?|[Gg]uineas?|gns\b|[Ll]ire|"
                   r"[Mm]arks?\b|DM\b|USD|EUR|GBP|CHF|[Ff]lorins?|[Gg]uilders?|fl\.)|"
                   r"\b(?:prices?|priced|estimate|[Ss]old for|[Bb]ought for|[Pp]urchased for)\b")

# Threads within one work, rarest first; on a tie, this order, and the artist always last.
RANK = {"show": 0, "sale": 1, "owner": 2, "writing": 3, "museum": 4, "artist": 9}


def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def slug(t):
    return norm(t).replace(" ", "-")


def tokens(t):
    stop = {"the", "a", "an", "of", "and", "et", "de", "la", "le", "les", "du", "des", "in", "at", "und", "der",
            "die", "das", "il", "di", "e", "y", "el", "exhibition", "exposition", "ausstellung", "mostra"}
    return {w for w in norm(t).split() if w not in stop and len(w) > 1}


def alike(a, b, at=0.5):
    ta, tb = tokens(a), tokens(b)
    return bool(ta and tb) and len(ta & tb) / min(len(ta), len(tb)) >= at


def year(v):
    """The year a date starts with, if it is a year a work could have seen."""
    m = re.match(r"(\d{4})", str(v or ""))
    return m.group(1) if m and 1000 <= int(m.group(1)) <= NOW else ""


def when(v):
    """A date as far as it is known, for ordering: "1970", "1970-02", "1970-05-01"."""
    if not year(v):
        return ""
    return re.match(r"\d{4}(?:-\d\d(?:-\d\d)?)?", str(v)).group(0)


def day(v):
    """An Artsy timestamp as a date (YYYY-MM-DD)."""
    m = re.match(r"(\d{4}-\d\d-\d\d)", str(v or ""))
    return m.group(1) if m else ""


def iso(cc):
    """A country as sources write it, as ISO-2 ("" when unknown)."""
    c = (cc or "").strip()
    if re.fullmatch(r"[A-Za-z]{2}", c):
        return c.upper()
    return COUNTRY.get(norm(c), "")


def unpriced(text):
    """A source's words without the clauses that name a price."""
    if not PRICE.search(text):
        return text
    text = re.sub(r"\s*[(\[][^()\[\]]*[)\]]", lambda m: "" if PRICE.search(m.group()) else m.group(), text)

    def without(text, sep, inner=None):
        parts, out = re.split("(" + sep + ")", text), []
        for n in range(0, len(parts), 2):
            part = parts[n]
            if PRICE.search(part) and inner:
                part = without(part, inner)
            if part and not PRICE.search(part):
                out += ([parts[n - 1]] if out else []) + [part]
        return "".join(out)
    return without(text, r";\s*", r",\s+").strip(" ;,")     # "12,000 francs" is one clause


# A dealer's note on a title ("(Sale was £2,350)", "**ON SALE**"): not the title, and about price.
SALE_NOTE = re.compile(r"\bon sale\b|special price|sale price", re.I)


def untagged(title):
    """A work's title without the bracketed clause or starred shout that prices or sells it."""
    t = re.sub(r"\s*[(\[][^()\[\]]*[)\]]",
               lambda m: "" if PRICE.search(m.group()) or SALE_NOTE.search(m.group()) else m.group(), title or "")
    t = re.sub(r"\s*\*+\s*on sale\s*\*+\s*", " ", t, flags=re.I)
    return t.strip(" -–—,;") or (title or "")


def city_name(name):
    """A town's one name: "Town of Southampton" is Southampton, "Milano" and "Brooklyn" as CITY_NAMES say."""
    name = re.sub(r"\s*\(.*?\)", "", name or "")
    name = re.sub(r"^(town|city|village|borough|municipality) of ", "", re.sub(r"\s+", " ", name.strip(" ,")), flags=re.I)
    if name.islower():
        name = name.title()
    return CITY_NAMES.get(norm(name), name)


def renamed(hit):
    """A cached answer, its town under its one name (the names may have changed since it was cached)."""
    if not hit:
        return hit
    name, _, cc = hit[2].rpartition(", ")
    return [hit[0], hit[1], ", ".join(x for x in (city_name(name or hit[2]), cc if name else "") if x)]


def km(a, b):
    la, lb = math.radians(a[0]), math.radians(b[0])
    h = math.sin((lb - la) / 2) ** 2 + math.cos(la) * math.cos(lb) * math.sin(math.radians(b[1] - a[1]) / 2) ** 2
    return 12742 * math.asin(math.sqrt(min(1, h)))


def region_in(ev):
    """A US state written after the city in the source's own words ("Guilford, CT")."""
    if ev.get("region"):
        return ev["region"]
    city, text = ev.get("city") or "", ev.get("text") or ""
    if not city or iso(ev.get("country")) not in ("", "US"):
        return ""
    names = "|".join(re.escape(k) for k in sorted(US_STATES, key=len, reverse=True))
    m = re.search(re.escape(city) + r",\s*(" + names + r")(?![A-Za-z])", text)
    return US_STATES[m.group(1)] if m else ""


# ---- places ----------------------------------------------------------------------------------------

class Places:
    """Coordinates for a named place, cached: Nominatim once per name, politely."""

    def __init__(self, online=True):
        self.cache = json.loads(GEOCODE.read_text()) if GEOCODE.exists() else {}
        self.online = online
        self.museums, self.by_slug = [], {}
        if MUSEUMS.exists():
            for m in json.loads(MUSEUMS.read_text()).get("museums", []):
                city, _, cc = (m.get("where") or "").rpartition(",")
                head = re.sub(r"\s*\(.*?\)", "", m["name"].split(",")[0])
                keys = {norm(m["name"]), norm(head), norm(re.sub(r"\s*\(.*?\)", "", m["name"]))}
                keys |= {k[4:] for k in keys if k.startswith("the ")}
                rec = {"slug": m["slug"], "name": m["name"], "keys": {k for k in keys if k},
                       "ll": (m["lat"], m["lon"]), "city": city_name(city), "cc": iso(cc)}
                self.museums.append(rec)
                self.by_slug[m["slug"]] = rec
        self.dirty = 0
        self.last = 0.0

    def ask(self, path, q):
        wait = self.last + 1.05 - time.time()           # Nominatim's rule: one a second
        if wait > 0:
            time.sleep(wait)
        self.last = time.time()
        try:
            r = requests.get(NOMINATIM + path + "?" + urllib.parse.urlencode(q), headers=AGENT, timeout=60)
            return r.json() if r.ok else None
        except Exception:
            return None

    def museum(self, name, near=None):
        """The site museum a venue or holder names, only when its whole name is in it ("Phillips" the
        auction house is not the Phillips Collection), and not one of that name in another city."""
        n = norm(name)
        if not n:
            return None
        if near is None and "," in name:               # "National Gallery of Art, London": the town it names
            town = self.city(name.rsplit(",", 1)[1])
            near = tuple(town[:2]) if town else None
        low = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
        for alias, pid in MUSEUM_ALIASES.items():
            if low.startswith(alias) and "museum-" + pid in self.by_slug:
                return self.by_slug["museum-" + pid]
        best, size = None, 0
        for m in self.museums:
            for k in m["keys"]:
                if k == n:
                    hit = True
                elif len(k) > 8 and f" {k} " in f" {n} ":
                    before, rest = f" {n} ".split(f" {k} ", 1)
                    before = before.split()
                    # "National Gallery" is not "National Gallery of Canada", nor "Museum of Modern Art" the
                    # "National Museum of Modern Art"
                    hit = not rest.startswith("of ") and not (
                        before and before[-1] != "the" and k.split()[0] in ("museum", "museo", "musee", "gallery", "national"))
                else:
                    hit = False
                if hit and len(k) > size:
                    best, size = m, len(k)
        if best and near and km(near, best["ll"]) > 60:
            return None
        return best

    def city(self, city, country="", region=""):
        """[lat, lon, "City, CC"] for a named town, in its region and country when the source gives them."""
        city = re.sub(r"\s+", " ", (city or "").strip(" ,"))
        if not city or ONLINE.search(city):
            return None
        key = f"{city}|{region}|{country}".lower()
        if key in self.cache:
            return renamed(self.cache[key])
        if not self.online:
            return None
        q = {"q": ", ".join(x for x in (city, region) if x), "format": "jsonv2", "limit": 1,
             "addressdetails": 1, "featureType": "settlement", "accept-language": "en"}
        if country:
            q["countrycodes"] = country.lower()
        r = self.ask("search", q)
        if r is None:
            return None                                 # not answered: ask again next time
        hit = None
        if r:
            a = r[0].get("address") or {}
            name = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or city
            if r[0].get("addresstype") in ("city", "town", "village", "hamlet") and r[0].get("name"):
                name = r[0]["name"]                         # the town itself, not its municipality
            cc = (a.get("country_code") or "").upper()
            if not country or cc == country:
                hit = [round(float(r[0]["lat"]), 4), round(float(r[0]["lon"]), 4),
                       ", ".join(x for x in (city_name(name), cc) if x)]
        self.cache[key] = hit
        self.dirty += 1
        if self.dirty % 25 == 0:
            self.save()
        return renamed(hit)

    def check(self, lat, lon, cc):
        """Whether a point is in the country its source says: a reverse lookup, cached by the
        hundredth of a degree. A point that cannot be asked about stands."""
        if not cc:
            return True
        key = f"@{lat:.2f},{lon:.2f}"
        if key not in self.cache:
            if not self.online:
                return True
            r = self.ask("reverse", {"lat": f"{lat:.2f}", "lon": f"{lon:.2f}", "format": "jsonv2",
                                     "zoom": 3, "accept-language": "en"})
            if r is None:
                return True
            self.cache[key] = ((r.get("address") or {}).get("country_code") or "").upper()
            self.dirty += 1
        got = self.cache[key]
        return not got or got == cc

    def save(self):
        GEOCODE.parent.mkdir(parents=True, exist_ok=True)
        GEOCODE.write_text(json.dumps(self.cache, ensure_ascii=False, indent=0))


def artsy_place(place):
    """An Artsy location as {lat, lon, city, cc, src}, or None — and None for a page on the web."""
    if not place:
        return None
    city = (place.get("city") or "").strip()
    if len(city) <= 2 or re.fullmatch(r"[\d\s-]+", city) or (
            city in US_STATES.values() and city not in ("New York", "Washington")):
        city = ""                                       # a postcode, or a state, is not a town
    if city and ONLINE.search(city):
        return None
    c = place.get("coordinates") or {}
    has = c.get("lat") is not None and c.get("lng") is not None
    if not (has or city):
        return None
    return {"lat": round(c["lat"], 4) if has else None, "lon": round(c["lng"], 4) if has else None,
            "city": city, "cc": iso(place.get("country")), "src": place.get("source") or "own"}


# ---- the events of one work ------------------------------------------------------------------------

def artsy_events(w, saved, sources):
    """What Artsy itself records: the shows, sales and the listing, and the collecting institution."""
    out = []
    partner = w.get("partner") or {}
    src = add_source(sources, "Artsy", f"https://www.artsy.net/artwork/{w['id']}")
    made = year(re.sub(r"^\D*", "", w.get("date") or ""))
    if made:                                           # its date, as its record gives it; where, only if a source says
        out.append({"kind": "made", "start": made, "circa": bool(re.search(r"\b(c|ca|circa)\b\.?", w.get("date") or "", re.I)),
                    "text": w.get("date"), "src": [src], "field": "date"})
    for sid in w.get("show_ids") or []:
        p = DATA / "artsy" / "shows" / filename(sid)
        if not p.exists():
            continue
        s = json.loads(p.read_text())
        if not s.get("name"):
            continue
        fair = s.get("fair") or {}
        out.append({"kind": "exhibited", "start": day(s.get("start_at")), "end": day(s.get("end_at")),
                    "title": s.get("name"), "venue": (s.get("partner") or {}).get("name") or "",
                    "note": ("at " + fair["name"]) if fair.get("name") and fair["name"] not in s["name"] else "",
                    "place": artsy_place(s.get("place")), "src": [src], "field": "artsy show", "show": sid})
    for sid in w.get("sale_ids") or []:
        p = DATA / "artsy" / "sales" / filename(sid)
        if not p.exists():
            continue
        s = json.loads(p.read_text())
        if not s.get("name"):
            continue
        out.append({"kind": "offered", "start": day(s.get("start_at")), "end": day(s.get("end_at")),
                    "title": s.get("name"), "who": (s.get("partner") or {}).get("name") or "",
                    "note": "at auction" if s.get("is_auction") else "",
                    "place": artsy_place(s.get("place")), "src": [src], "field": "artsy sale", "sale": sid})
    if partner.get("name"):                           # the listing: where it was offered, never an acquisition
        pp = DATA / "artsy" / "partners" / filename(partner["id"]) if partner.get("id") else None
        locs = json.loads(pp.read_text()).get("locations") if pp and pp.exists() else []
        loc = next((l for l in locs or [] if l), None)
        ev = {"kind": "listed", "start": day(saved.get("published_at")), "who": partner["name"],
              "note": {"Gallery": "listed by the gallery", "Auction": "listed by the auction house",
                       "Institution": "listed by the museum"}.get(partner.get("type"), "listed"),
              "place": artsy_place(dict(loc, source="partner")) if loc else None, "src": [src],
              "field": "artsy listing", "partner": partner.get("id") or "", "ptype": partner.get("type") or ""}
        if any(h.lower() in partner["name"].lower() for h in NOT_HOLDERS):
            ev.update(kind="other", note="listed by an image agency", place=None)
        out.append(ev)
    ci = (w.get("collecting_institution") or "").strip()
    if ci:
        m = re.match(r'^[“"](.+?)[”"]\s+at\s+(.+?)(?:\s*\((\d{4})(?:\s*[-–]\s*(\d{4}))?\))?\s*$', ci)
        if m:                                         # an exhibition credit: "Title" at Venue, City (2015)
            out.append({"kind": "exhibited", "title": m.group(1), "venue": m.group(2), "start": m.group(3) or "",
                        "end": m.group(4) or "", "text": ci, "src": [src], "field": "collecting_institution"})
        elif not re.search(r"private collection", ci, re.I):
            out.append({"kind": "held", "who": ci, "text": ci, "src": [src], "field": "collecting_institution"})
    for i, ev in enumerate(out):
        ev["order"] = i + 1
    return out


def add_source(sources, name, url="", licence=""):
    for i, s in enumerate(sources):
        if s["name"] == name and s.get("url", "") == url:
            return i
    sources.append({k: v for k, v in (("name", name), ("url", url), ("licence", licence)) if v})
    return len(sources) - 1


def load_parsed():
    """The parsed partner texts, work by work, only the events that pass their check."""
    out = {}
    for path in sorted(glob.glob(str(DATA / "parsed" / "batch*.json"))):
        try:
            data = json.loads(Path(path).read_text())
        except json.JSONDecodeError:
            print(f"  ! {Path(path).name} is not JSON; skipped", flush=True)
            continue
        for entry in data.get("works") or []:
            out[entry.get("id")] = entry.get("events") or []
    return out


def other_sources():
    """Every further source's folder under data/histories/ (not artsy/ or parsed/)."""
    return sorted(p for p in DATA.iterdir() if p.is_dir() and p.name not in ("artsy", "parsed"))


def placed(ev, places):
    """Where an event was, as exactly as its source allows: {ll, w, pr, m}. pr is "venue" (the venue's
    own point, or a site museum's), "office" (where the listing partner is: the work may never have
    been there) or "city" (the named town). A writing is named but never placed."""
    kind = ev["kind"]
    if kind == "exhibited" and (ONLINE.search(ev.get("venue") or "") or ONLINE.search(ev.get("title") or "")):
        return {}
    if ONLINE.search(ev.get("city") or ""):
        return {}
    cc, region = iso(ev.get("country")), region_in(ev)
    cc = cc or ("US" if region else "")
    city = ev.get("city") or ""
    if city and cc and ev.get("field") in PARTNER_FIELDS and norm(city) not in norm(ev.get("text")):
        alone = places.city(city)                       # a town the partner's words do not name ("Milano" is
        if alone and not alone[2].endswith(", " + cc):  # Milan), in another country: the reading erred
            city = ""
    town = places.city(city, cc, region) if city else None
    pl = ev.get("place")
    if pl and pl["city"] and not town:
        town = places.city(pl["city"], pl["cc"])
    near = (pl["lat"], pl["lon"]) if pl and pl["lat"] is not None else (tuple(town[:2]) if town else None)
    m = None
    if ev.get("partner") and "museum-" + ev["partner"] in places.by_slug and ev.get("ptype") == "Institution":
        m = places.by_slug["museum-" + ev["partner"]]    # a site museum's own listing is its collection
    elif kind not in ("made", "offered", "sold", "listed", "other", "written"):
        m = places.museum(ev.get("venue") or (ev.get("who") if kind == "held" else ""), near)
    if m:
        name = places.city(m["city"], m["cc"])
        return {"ll": list(m["ll"]), "w": name[2] if name else ", ".join(x for x in (m["city"], m["cc"]) if x),
                "pr": "venue", "m": m["slug"]}
    out = {}
    if pl and pl["lat"] is not None:
        pt = (pl["lat"], pl["lon"])
        if town and km(pt, town) < 150:
            out = {"ll": list(pt), "w": town[2]}
        elif places.check(pl["lat"], pl["lon"], pl["cc"]):  # a town of that name elsewhere: Artsy's point stands
            out = {"ll": list(pt), "w": ", ".join(x for x in (city_name(pl["city"]), pl["cc"]) if x)}
        elif town:                                        # Artsy's point is not in its country: the town's
            out = {"ll": town[:2], "w": town[2], "pr": "city"}
        if out and "pr" not in out:
            out["pr"] = "office" if pl["src"] == "partner" else "venue"
    elif town:
        out = {"ll": town[:2], "w": town[2], "pr": "city"}
    else:
        city = city_name(city or (pl or {}).get("city") or "")
        cc = cc or (pl or {}).get("cc") or ""
        w = ", ".join(x for x in (city, cc or (ev.get("country") or "").strip()) if x)
        out = {"w": w} if w else {}
    if kind == "written":                               # a writing is never travel
        out.pop("ll", None)
        out.pop("pr", None)
    return out


def same(a, b):
    """Two sources telling of one event. A listing is only ever itself."""
    if a["kind"] != b["kind"] and {a["kind"], b["kind"]} != {"offered", "sold"}:
        return False
    ya, yb = year(a.get("start")), year(b.get("start"))
    if ya and yb and ya != yb:
        return False
    if a["kind"] == "listed":
        return False
    if a["kind"] in ("owned", "held"):
        return alike(a.get("who"), b.get("who"), 0.6)
    if a["kind"] == "written":
        return bool(ya and yb) and alike(a.get("title") or a.get("text"), b.get("title") or b.get("text"), 0.6)
    if a["kind"] in ("exhibited", "offered", "sold"):
        if not (ya and yb):                            # an undated credit of a dated show: the same title
            return len(tokens(a.get("title"))) >= 3 and alike(a.get("title"), b.get("title"), 0.8)
        return alike(a.get("title"), b.get("title"), 0.5) or (
            bool(a.get("venue")) and alike(a.get("venue"), b.get("venue"), 0.7) and a.get("start", "")[:7] == b.get("start", "")[:7])
    return norm(a.get("text")) == norm(b.get("text")) and bool(a.get("text"))


def merge(events):
    out = []
    for ev in events:
        twin = next((o for o in out if same(o, ev)), None)
        if twin is None:
            out.append(ev)
            continue
        if year(ev.get("start")) and not year(twin.get("start")):   # the dated telling leads; the other fills in
            n = out.index(twin)
            ev, twin = twin, dict(ev)
            out[n] = twin
        twin["src"] = sorted(set(twin["src"]) | set(ev["src"]))
        for k in ("start", "end", "who", "title", "venue", "city", "country", "region", "publication", "pages",
                  "url", "place", "show", "sale"):
            if not twin.get(k) and ev.get(k):
                twin[k] = ev[k]
        if len(ev.get("start") or "") > len(twin.get("start") or "") and year(ev["start"]) == year(twin.get("start")):
            twin["start"] = ev["start"]
    return out


def chronology(events):
    """In time, by the full date as far as it is known ("1 May 1970" after the February show), then by
    its place in its source's text. An undated event keeps its place in its source's sequence (a
    provenance is written in order): it takes the key of the dated event before it there, else of the
    one after it, else of the event before it overall."""
    keys = [None] * len(events)
    for i, ev in enumerate(events):
        d = when(ev.get("start"))
        if d:
            keys[i] = (d, ev.get("order") or 0, 0, i)
    groups = {}
    for i, ev in enumerate(events):
        groups.setdefault((tuple(ev["src"]), ev.get("field")), []).append(i)
    for idx in groups.values():
        idx.sort(key=lambda i: (events[i].get("order") or 0, i))
        for n, i in enumerate(idx):
            if keys[i]:
                continue
            before = next((keys[j] for j in reversed(idx[:n]) if keys[j] and keys[j][2] == 0), None)
            after = next((keys[j] for j in idx[n + 1:] if keys[j] and keys[j][2] == 0), None)
            if before:
                keys[i] = (before[0], before[1], 1, i)
            elif after:
                keys[i] = (after[0], after[1], -1, i)
    # An undated making (printing, casting) goes with the work's dated making, never after the last
    # listing that happens to precede it in the order the sources were read.
    made = next((keys[i] for i, ev in enumerate(events) if ev["kind"] == "made" and keys[i] and keys[i][2] == 0), None)
    for i in range(len(events)):
        if not keys[i]:
            prev = keys[i - 1] if i else None
            if events[i]["kind"] == "made":
                keys[i] = (made[0], made[1], 1, i) if made else ("", 0, ORDER["made"], i)
            else:
                keys[i] = (prev[0], prev[1], 1, i) if prev else ("", 0, ORDER.get(events[i]["kind"], 4), i)
    return [events[i] for i in sorted(range(len(events)), key=lambda i: keys[i])]


def public(ev, places):
    out = {"k": ev["kind"]}
    for k, short in (("start", "y"), ("end", "e"), ("who", "who"), ("title", "t"), ("venue", "v"),
                     ("publication", "pub"), ("pages", "pg"), ("note", "n"), ("url", "u")):
        v = html.unescape(str(ev.get(k) or "")).strip()
        if k in ("start", "end") and not year(v):
            continue
        if k == "note":
            v = unpriced(v)
        if v:
            out[short] = v
    if ev.get("circa"):
        out["c"] = 1
    if ev.get("text") and ev.get("field") not in ("artsy show", "artsy sale", "artsy listing"):
        q = unpriced(html.unescape(ev["text"]))
        if q:
            out["q"] = q
    where = placed(ev, places)
    if where.get("ll"):
        out["ll"] = [round(where["ll"][0], 4), round(where["ll"][1], 4)]
    if where.get("w"):
        out["w"] = where["w"]
        if out.get("ll") and "," in where["w"]:
            out["p"] = slug(where["w"])
    for k in ("pr", "m"):
        if where.get(k) and out.get("ll"):
            out[k] = where[k]
    if ev.get("order"):
        out["o"] = ev["order"]
    out["s"] = ev["src"]
    return out


def mend_year(ev, made):
    """A year read off the start of a range in a title ("Poussin, 1594-1665", "Creativity in Art and
    Science, 1860-1960") that puts an event before the work was made: the source's own later year
    instead (a writing's last, as a citation ends in its year), else no year."""
    y = year(ev.get("start"))
    if not y or not made or ev.get("kind") in ("made", "other") or int(y) >= made - 1:
        return
    text = html.unescape(str(ev.get("text") or ""))
    span = re.search(r"\b" + y + r"\s*[-–—]\s*\d{2,4}\b", text)
    if not span:
        return
    rest = text[:span.start()] + " " + text[span.end():]
    later = [v for v in re.findall(r"\b(1\d{3}|20\d{2})\b", rest) if made - 1 <= int(v) <= NOW]
    ev["start"] = (later[-1] if ev.get("kind") == "written" else later[0]) if later else ""
    if not ev["start"] or year(ev.get("end")) < ev["start"]:
        ev.pop("end", None)


_COMMON = None


def common_texts():
    """The partners' texts given to three works or more: a series' standard paragraph, not this work's."""
    global _COMMON
    if _COMMON is None:
        texts = []
        for f in (DATA / "artsy" / "works").glob("*.json"):
            w = json.loads(f.read_text())
            texts += [w.get("additional_information") or "", w.get("blurb") or ""]
        _COMMON = artwork_said.generic(texts)
    return _COMMON


def build(saved, parsed, places):
    """One work's record, in memory: its public events and, beside them, what the threads need."""
    w = json.loads((DATA / "artsy" / "works" / filename(saved["id"])).read_text())
    sources = []
    events = artsy_events(w, saved, sources)
    writer = (w.get("partner") or {}).get("name") or "the listing partner"
    good = [ev for ev in parsed.get(w["id"], []) if not problems(ev, w)]
    if good:
        s = add_source(sources, f"{writer}, on Artsy", f"https://www.artsy.net/artwork/{w['id']}")
        for ev in good:
            events.append(dict(ev, src=[s]))
    for folder in other_sources():
        p = folder / filename(w["id"])
        if not p.exists():
            continue
        rec = json.loads(p.read_text())
        s = add_source(sources, rec["source"]["name"], rec["source"].get("url", ""), rec["source"].get("licence", ""))
        for ev in rec.get("events") or []:
            ev = dict(ev, src=[s])
            if ev.get("kind") == "held" and any(h.lower() in (ev.get("who") or "").lower() for h in NOT_HOLDERS):
                ev["kind"] = "other"
            events.append(ev)
    made = re.search(r"\d{4}", w.get("date") or "")
    for ev in events:
        mend_year(ev, int(made.group()) if made else 0)
    events = chronology(merge(events))
    pub = [public(ev, places) for ev in events]
    img = (w.get("image") or "").replace(CDN, "").replace("/:version.jpg", "")
    title = untagged(w.get("title") or "Untitled")
    if title != (w.get("title") or "Untitled"):
        for src in sources:
            if w["id"] in src.get("url", ""):
                src.pop("url")
    # Artsy's slug spells the title out, a price and all; kept only when the title stands as it was.
    return {"id": w.get("_id") or saved.get("_id"), "slug": w["id"] if title == (w.get("title") or "Untitled") else "",
            "title": title,
            "artists": [a["name"] for a in w.get("artists") or [] if a.get("name")],
            "date": w.get("date") or "", "medium": untagged(unpriced(w.get("medium") or "")),
            "dimensions": (w.get("dimensions") or {}).get("in") if isinstance(w.get("dimensions"), dict) else "",
            "image": img, "c": [c for c in (saved.get("dominant_colors") or []) if re.fullmatch(r"#[0-9a-fA-F]{6}", c or "")][:3],
            "events": pub, "sources": sources,
            # What has been said of it, in the words of who said it (artwork_said.py).
            "said": artwork_said.said_of(w, common_texts()),
            "_ev": events, "_cat": w.get("category") or ""}


def attach_strays(records):
    """An Artsy point with no town named takes the nearest place within 40 km; else it is not placed."""
    known = {}
    for r in records:
        for e in r["events"]:
            if e.get("p"):
                known.setdefault(e["p"], (e["ll"], e["w"]))
    for r in records:
        for e in r["events"]:
            if e.get("ll") and not e.get("p"):
                best = min(known.items(), key=lambda kv: km(e["ll"], kv[1][0]), default=None)
                if best and km(e["ll"], best[1][0]) < 40:
                    e["p"], e["w"] = best[0], best[1][1]
                else:
                    for k in ("ll", "pr", "m"):
                        e.pop(k, None)


# ---- the second pass: threads ----------------------------------------------------------------------

def stops_of(events):
    """Consecutive placed events at one place make a stop (writings never do)."""
    stops = []
    for i, e in enumerate(events):
        if not e.get("p") or e["k"] == "written":
            continue
        if stops and stops[-1]["p"] == e["p"]:
            stops[-1]["idx"].append(i)
        else:
            stops.append({"p": e["p"], "idx": [i]})
    return stops


def around(stops, i):
    """The stops before and after event i (or the stop holding it): place keys, 0 for none."""
    for n, s in enumerate(stops):
        if i in s["idx"]:
            return (stops[n - 1]["p"] if n else 0), (stops[n + 1]["p"] if n + 1 < len(stops) else 0)
    before = [s for s in stops if s["idx"][0] < i]
    after = [s for s in stops if s["idx"][0] > i]
    return (before[-1]["p"] if before else 0), (after[0]["p"] if after else 0)


# An owner described rather than named ("New York art collector who was friends with the artist",
# "the late owner"): nobody a thread could gather.
OWNER_DESCRIBED = re.compile(r"\b(collector|the late|former|present|private|anonymous)\b", re.I)


def owner_key(who):
    bare = re.sub(r"^(the|a|an)\s+", "", (who or "").strip(), flags=re.I)
    if OWNER_DESCRIBED.search(who or "") or (bare != (who or "").strip() and not re.search(r"[A-Z]", bare)):
        return ""
    k = norm(re.sub(r"\(.*?\)", "", who or ""))
    k = re.sub(r"^(the|la|le|les|il|el)\s+", "", k)
    k = re.sub(r"\s+(inc|ltd|llc|sa|ag|gmbh)$", "", k)
    if not k or len(k) < 4 or OWNER_STOP.search(k) or OWNER_STOP.search(norm(who)):
        return ""
    return OWNER_ALIASES.get(k, k)


def city_of(w):
    return (w or "").rpartition(", ")[0] or ""


def thread_keys(rec):
    """(event index or None, kind, key, name, at, y, ll) for every thread this work could share.
    Not threads: a gallery's plain listing (a catalogue, not a connection), the same city in the same
    year, one venue across unrelated shows."""
    for i, (ev, e) in enumerate(zip(rec["_ev"], rec["events"])):
        k, y = e["k"], year(e.get("y"))
        ll = e.get("ll")
        if k == "exhibited" and e.get("t"):
            t = norm(e["t"])
            generic = bool(GENERIC_SHOWS.match(t)) or len(t.split()) <= 2
            if generic and ev.get("show"):
                key = "id:" + ev["show"]
            elif generic:
                if not (e.get("v") and y):
                    continue
                key = "v:" + norm(e["v"]) + "|" + t + "|" + y
            else:
                key = "t:" + t + "|" + y
            v, c = e.get("v") or "", city_of(e.get("w"))
            at = f"{v}, {c}" if v and c and c not in v else (v or c)
            yield i, "show", key, e["t"], at, y, ll
        elif k in ("offered", "sold"):
            if ev.get("sale"):
                key = "id:" + ev["sale"]
            elif e.get("t") and y:
                t = norm(e["t"])
                key = "t:" + t + "|" + y + ("|" + norm(e.get("who")) if len(t.split()) <= 2 else "")
            elif e.get("who") and len(when(e.get("y"))) == 10:
                key = "d:" + norm(e["who"]) + "|" + when(e["y"])        # the house on the day
            else:
                continue
            name = e.get("t") or e.get("who")
            yield i, "sale", key, name, ", ".join(x for x in (e.get("who"), city_of(e.get("w"))) if x), y, ll
        elif k == "owned" and e.get("who"):
            # "Hector Brame; Paul Mellon" is two owners, each their own thread.
            for who in (x.strip() for x in e["who"].split(";")):
                key = owner_key(who)
                if key and key not in {norm(a) for a in rec["artists"]}:     # the artist's own hands: not a thread
                    yield i, "owner", key, who, city_of(e.get("w")), y, None
        elif k in ("held", "listed") and e.get("m"):
            yield i, "museum", e["m"], None, "", y, ll
        elif k == "written" and y and (e.get("t") or e.get("pub")):
            author = norm(e.get("who")).split()
            key = norm(e.get("t") or e.get("pub")) + "|" + y + ("|" + author[-1] if author else "")
            yield i, "writing", key, e.get("t") or e.get("pub"), e.get("who") or "", y, None
    for a in rec["artists"]:
        if norm(a):
            yield None, "artist", norm(a), a, "", year(rec["date"]), None


def tid_of(kind, key):
    return hashlib.sha1(f"{kind}|{key}".encode()).hexdigest()[:8]


def link_threads(records, places):
    """Keep every key two or more works share; give each work its threads, rarest first, and each
    event the indices of the threads it belongs to."""
    groups = {}
    for rec in records:
        for i, kind, key, name, at, y, ll in thread_keys(rec):
            g = groups.setdefault((kind, key), {"members": {}, "name": Counter(), "at": Counter(),
                                                "y": Counter(), "ll": Counter()})
            g["members"].setdefault(rec["id"], []).append(i)
            if name:
                g["name"][name] += 1
            if at:
                g["at"][at] += 1
            if y:
                g["y"][y] += 1
            if ll:
                g["ll"][tuple(ll)] += 1
    for (kind, key) in [k for k in groups if k[0] == "show" and k[1].startswith("t:") and k[1].endswith("|")]:
        dated = [k for k in groups if k[0] == "show" and k[1].startswith(key[:-1] + "|") and k != (kind, key)]
        if len(dated) == 1:                                 # an undated mention of the one dated show of that title
            g, into = groups.pop((kind, key)), groups[dated[0]]
            for wid, idx in g["members"].items():
                into["members"].setdefault(wid, []).extend(idx)
            for c in ("name", "at", "y", "ll"):
                into[c].update(g[c])
    threads = {}
    for (kind, key), g in groups.items():
        if len(g["members"]) < 2:
            continue
        tid = tid_of(kind, key)
        assert tid not in threads, f"thread id {tid} twice"
        if kind == "museum":
            m = places.by_slug[key]
            name, at, ll = m["name"], ", ".join(x for x in (m["city"], m["cc"]) if x), list(m["ll"])
        else:
            name = g["name"].most_common(1)[0][0]
            at = g["at"].most_common(1)[0][0] if g["at"] else ""
            ll = list(g["ll"].most_common(1)[0][0]) if g["ll"] else None
        y = int(g["y"].most_common(1)[0][0]) if g["y"] else 0
        threads[tid] = {"id": tid, "k": kind, "key": key, "name": name, "at": at, "y": y, "ll": ll,
                        "members": g["members"]}
    by_id = {r["id"]: r for r in records}
    for t in threads.values():
        t["n"] = len(t["members"])
    for rec in records:
        mine = [t for t in threads.values() if rec["id"] in t["members"]]
        set_threads(rec, mine, lambda t: t["n"] - 1)
    return threads, by_id


def set_threads(rec, mine, others):
    mine.sort(key=lambda t: (t["k"] == "artist", others(t), RANK[t["k"]], t["name"]))
    rec["threads"] = [{k: v for k, v in (("id", t["id"]), ("k", t["k"]), ("name", t["name"]), ("at", t["at"]),
                                         ("y", t["y"]), ("ll", t["ll"]), ("n", others(t))) if v or k in ("n", "y")}
                      for t in mine]
    for e in rec["events"]:
        e.pop("x", None)
    for n, t in enumerate(mine):
        for i in t["members"].get(rec["id"], []) if "members" in t else t["idx"]:
            if i is not None:
                x = rec["events"][i].setdefault("x", [])
                if n not in x:
                    x.append(n)


# ---- the writers -----------------------------------------------------------------------------------

def history_of(rec):
    out = {k: rec[k] for k in ("id", "slug", "title", "artists", "date", "medium", "dimensions", "image")}
    if rec["c"]:
        out["c"] = rec["c"]
    if rec.get("said"):
        out["said"] = rec["said"]
    out["events"] = rec["events"]
    out["sources"] = rec["sources"]
    out["threads"] = rec.get("threads", [])
    out["asof"] = datetime.date.today().isoformat()
    return out


def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def write_histories(records):
    OUT.mkdir(parents=True, exist_ok=True)
    for rec in records:
        dump(OUT / f"{rec['id']}.json", history_of(rec))


def row(rec):
    return [rec["id"], rec["title"], ", ".join(rec["artists"]), rec["image"]]


def write_threads(threads, by_id):
    THREADS.mkdir(parents=True, exist_ok=True)
    for old in THREADS.glob("*.json"):
        old.unlink()
    for t in threads.values():
        works = []
        for wid, idx in t["members"].items():
            rec = by_id[wid]
            i = next((i for i in idx if i is not None), None)
            if i is None:                                   # the artist: arrives when it was made
                y, order, prev, nxt = int(year(rec["date"]) or 0), when(rec["date"]) or "9999", 0, 0
            else:
                e = rec["events"][i]
                y, order = int(year(e.get("y")) or 0), when(e.get("y")) or "9999"
                prev, nxt = around(stops_of(rec["events"]), i)
            works.append((order, row(rec) + [y, prev, nxt]))
        works.sort(key=lambda w: w[0])
        out = {k: t[k] for k in ("id", "k", "name", "at", "y", "ll")}
        out["works"] = [w for _, w in works]
        dump(THREADS / f"{t['id']}.json", out)


def gather_places(records):
    """Every place, with the works that have been there and what happened at each venue."""
    places = {}
    for rec in records:
        stops = stops_of(rec["events"])
        for i, e in enumerate(rec["events"]):
            if not e.get("p") or e["k"] == "written":
                continue
            p = places.setdefault(e["p"], {"w": e["w"], "pts": [], "works": {}, "venues": {}})
            p["pts"].append(e["ll"])
            venue = e.get("v") or (e.get("who") if e["k"] in ("held", "listed", "offered", "sold") or e.get("m") else "") or ""
            p["works"].setdefault(rec["id"], []).append((i, venue, e))
        for pk in {e.get("p") for e in rec["events"] if e.get("p")}:
            if pk not in places or rec["id"] not in places[pk]["works"]:
                continue
            mine = [n for n, s in enumerate(stops) if s["p"] == pk]
            places[pk]["works"][rec["id"]] = (places[pk]["works"][rec["id"]],
                                              stops[mine[0] - 1]["p"] if mine and mine[0] else 0,
                                              stops[mine[-1] + 1]["p"] if mine and mine[-1] + 1 < len(stops) else 0)
    return places


def write_places(records):
    PLACES.mkdir(parents=True, exist_ok=True)
    for old in PLACES.glob("*.json"):
        old.unlink()
    by_id = {r["id"]: r for r in records}
    museums = {m["slug"]: m["name"] for m in json.loads(MUSEUMS.read_text())["museums"]} if MUSEUMS.exists() else {}
    places = gather_places(records)
    listing = []
    for pk, p in places.items():
        name, _, cc = p["w"].rpartition(", ")
        ll = [round(statistics.median(x[0] for x in p["pts"]), 4), round(statistics.median(x[1] for x in p["pts"]), 4)]
        listing.append([pk, name, cc, ll[0], ll[1], len(p["works"])])
        # The institutions, in the order they came into the story; a work's owners with no venue are "".
        venues = {}
        for wid, (evs, prev, nxt) in p["works"].items():
            names = {norm(v): v for _, v, e in evs if v}
            for i, v, e in evs:
                if not v and e["k"] == "owned" and norm(e.get("who")) in names:
                    v = names[norm(e["who"])]
                y = int(year(e.get("y")) or 0)
                # A site museum is one venue under all its names.
                d = venues.setdefault(e.get("m") or norm(v), {"name": museums.get(e.get("m"), v), "m": e.get("m") or "",
                                                               "ys": [], "rows": {}})
                if y:
                    d["ys"].append(y)
                r = d["rows"].setdefault(wid, {"ys": [], "kinds": [], "prev": prev, "next": nxt})
                if y:
                    r["ys"].append(y)
                if e["k"] not in r["kinds"]:
                    r["kinds"].append(e["k"])
        order = sorted(venues.values(), key=lambda d: (min(d["ys"]) if d["ys"] else 9999, d["name"] == "", d["name"]))
        out_v, out_w = [], []
        for n, d in enumerate(order):
            out_v.append([d["name"], d["m"], min(d["ys"]) if d["ys"] else 0, max(d["ys"]) if d["ys"] else 0])
            for wid, r in sorted(d["rows"].items(), key=lambda kv: (min(kv[1]["ys"]) if kv[1]["ys"] else 9999)):
                rec = by_id[wid]
                out_w.append(row(rec) + [rec["c"][0] if rec["c"] else "", n,
                                         min(r["ys"]) if r["ys"] else 0, max(r["ys"]) if r["ys"] else 0,
                                         r["kinds"], r["prev"], r["next"]])
        dump(PLACES / f"{pk}.json", {"p": pk, "w": p["w"], "ll": ll, "venues": out_v, "works": out_w})
    listing.sort(key=lambda x: (-x[5], x[1]))
    journeys = sorted((r for r in records if len(stops_of(r["events"])) >= 2),
                      key=lambda r: (-len(stops_of(r["events"])), r["id"]))
    dump(SITE / "places.json", {"works": len(records), "places": listing, "j": [r["id"] for r in journeys]})
    return listing


def write_finding(records, threads, listing):
    at = {p[0]: n for n, p in enumerate(listing)}
    cats = sorted({r["_cat"] for r in records if r["_cat"]})
    ci = {c: n for n, c in enumerate(cats)}
    w = []
    for r in records:
        ps = []
        for e in r["events"]:
            if e.get("p") and e["k"] != "written" and at[e["p"]] not in ps:
                ps.append(at[e["p"]])
        w.append([r["id"], r["title"], ", ".join(r["artists"]), r["date"], r["image"], ps, len(r["events"]),
                  ci.get(r["_cat"], -1)])
    t = [[x["id"], x["k"], x["name"], x["at"], x["y"], x["n"]]
         for x in sorted(threads.values(), key=lambda x: (-x["n"], x["name"]))]
    dump(SITE / "finding.json", {"cdn": CDN, "k": cats, "w": w, "t": t})


def old_threads(rec):
    """For --only: this work's threads as the last full build left them."""
    mine = []
    for i, kind, key, name, at, y, ll in thread_keys(rec):
        tid = tid_of(kind, key)
        path = THREADS / f"{tid}.json"
        if not path.exists():
            continue
        tf = json.loads(path.read_text())
        t = next((t for t in mine if t["id"] == tid), None)
        if t is None:
            n = len(tf["works"]) - (1 if any(w[0] == rec["id"] for w in tf["works"]) else 0)
            t = dict({k: tf[k] for k in ("id", "k", "name", "at", "y", "ll")}, n=n, idx=[])
            mine.append(t)
        t["idx"].append(i)
    set_threads(rec, mine, lambda t: t["n"])


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only", help="one work (its Artsy slug or _id): rewrite its history, keep the threads")
    ap.add_argument("--no-geocode", action="store_true")
    args = ap.parse_args()
    places = Places(online=not args.no_geocode)
    parsed = load_parsed()
    saves, seen = [], set()
    for s in json.loads(SAVES.read_text()):
        if s.get("id") and s["id"] not in seen:
            seen.add(s["id"])
            saves.append(s)
    if args.only:
        saves = [s for s in saves if args.only in (s["id"], s.get("_id"))]
        if not saves:
            sys.exit(f"No saved work {args.only}")
    records = []
    for n, saved in enumerate(saves):
        records.append(build(saved, parsed, places))
        if n % 250 == 0:
            print(f"  {n}/{len(saves)}", flush=True)
    places.save()
    attach_strays(records)
    if args.only:
        old_threads(records[0])
        write_histories(records)
        print(f"{records[0]['id']}: {len(records[0]['events'])} events, {len(records[0]['threads'])} threads")
        return
    threads, by_id = link_threads(records, places)
    write_histories(records)
    write_threads(threads, by_id)
    listing = write_places(records)
    write_finding(records, threads, listing)
    import build_cities                                 # the Museums layer's towns come from these places
    build_cities.main()
    stale = SITE / "artworks.json"                      # superseded by places.json and finding.json
    if stale.exists():
        stale.unlink()
    events = sum(len(r["events"]) for r in records)
    placed_ = sum(1 for r in records if any(e.get("p") for e in r["events"]))
    kinds = Counter(t["k"] for t in threads.values())
    print(f"{len(records)} works, {events} events; {placed_} placed on the Earth, "
          f"{sum(1 for r in records if len(stops_of(r['events'])) >= 2)} with two stops or more")
    print(f"{len(threads)} threads: " + ", ".join(f"{k} {kinds[k]}" for k in RANK if kinds[k]))
    print(f"{len(listing)} places")


if __name__ == "__main__":
    main()
