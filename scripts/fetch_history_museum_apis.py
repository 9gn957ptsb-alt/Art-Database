#!/usr/bin/env python3
"""The saved works' histories as five museums keep them — the museum layer of the artworks' histories.

Reads, for every work in the private saves dump (data/artsy_saves_raw.json, with Artsy's fuller record
from fetch_artwork_histories.py in data/histories/artsy/works/), the open collection APIs of

  * the Art Institute of Chicago (api.artic.edu; CC0): provenance_text, exhibition_history,
    publication_history, credit line, the object's date;
  * the Cleveland Museum of Art (openaccess-api.clevelandart.org; CC0): provenance (dated, with
    footnotes), exhibitions (current and legacy), citations, credit line and accession date;
  * SMK, Statens Museum for Kunst (api.smk.dk): exhibitions (with venues and dates), documentation
    (the literature), acquisition date;
  * Yale, through LUX (lux.collections.yale.edu, Linked Art): the Yale University Art Gallery's and
    the Yale Center for British Art's provenance, exhibitions, citations and credit line;
  * the Metropolitan Museum of Art (collectionapi.metmuseum.org; CC0): no provenance or exhibitions
    in the API, so a match gives only where it is held (credit line, accession year and number) and
    when it was made.

How it matches. A wrong match would put another artwork's history on this one, so the evidence must
be strong:

  * the same artist (surname, and the other names or initials, or the same birth year; a museum's
    "after", "copy", "follower", "circle", "school", "workshop", "studio", "manner" or "style" is not
    the artist) AND the same title (normalised: case, accents, punctuation, a leading article; a
    bracketed alternative counts as a title) AND a compatible date (within two years);
  * where Artsy names the museum — as the partner that listed the work, or its collecting
    institution, or its own record's link or accession number — that is enough, with the museum's
    record found by the link or number ("exact"), by title ("strong"), or, when the titles only share
    their words, by a single candidate whose date agrees ("probable");
  * where Artsy does not name the museum, the dimensions must agree as well ("strong"), the work must
    not be a print, photograph, poster, cast or other multiple (an impression in another collection is
    not this object), and it must not be one a gallery or auction house had for sale (a museum's
    object is not on the market). Everything else is rejected, and the doubtful ones are listed in
    data/museum_apis_cache/report.json with why.
  * a work Artsy says is held by some other collection, or shown as a loan from one, is not looked
    for at all. Two candidates that fit equally well are no match.

How it searches: the Art Institute by title words and artist (msearch, 25 queries a request — its
limit is 60 requests a minute); Cleveland by artist; SMK by artist surname; LUX by title and artist;
the Met by title intersected with artist (and directly by the object number Artsy links to).

Writes one file per matched work, private like the saves (data/ is never committed):
data/histories/museums/<file>.json (the same file name as data/histories/artsy/works/), with the
source credited, how it matched, and every event in the museum's own words (text verbatim; dates,
places and names only as the source gives them). The HTTP answers are cached under
data/museum_apis_cache/, so a second run reads nothing again (--refresh does).

    python3 scripts/fetch_history_museum_apis.py [--only artsy-id ...] [--museums aic,cma,smk,lux,met]
                                                 [--threads 8] [--refresh]
"""

import argparse
import hashlib
import html
import json
import re
import sys
import threading
import time
import unicodedata
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_artwork_histories import filename  # noqa: E402

SAVES = ROOT / "data" / "artsy_saves_raw.json"
WORKS = ROOT / "data" / "histories" / "artsy" / "works"
OUT = ROOT / "data" / "histories" / "museums"
CACHE = ROOT / "data" / "museum_apis_cache"
REPORT = CACHE / "report.json"

AGENT = ("Art-Database artwork-history reader (+https://github.com/9gn957ptsb-alt/Art-Database; "
         "art-database@users.noreply.github.com)")

AIC = "https://api.artic.edu/api/v1/"
CMA = "https://openaccess-api.clevelandart.org/api/artworks/"
MET = "https://collectionapi.metmuseum.org/public/collection/v1/"
SMK = "https://api.smk.dk/api/v1/"
LUX = "https://lux.collections.yale.edu/"

# Each host: the fewest seconds between two requests, and how many at once.
HOSTS = {"api.artic.edu": (1.1, 1), "openaccess-api.clevelandart.org": (0.15, 3),
         "collectionapi.metmuseum.org": (0.12, 3), "api.smk.dk": (0.15, 3),
         "lux.collections.yale.edu": (0.1, 4)}

AIC_LIST = ["id", "title", "alt_titles", "artist_title", "artist_display", "artist_titles", "date_start",
            "date_end", "date_display", "main_reference_number", "dimensions", "medium_display",
            "credit_line", "artwork_type_title", "fiscal_year_deaccession", "edition"]
AIC_FULL = AIC_LIST + ["provenance_text", "exhibition_history", "publication_history", "place_of_origin",
                       "catalogue_display"]
CMA_LIST = ["id", "accession_number", "title", "creation_date", "creation_date_earliest",
            "creation_date_latest", "technique", "type", "measurements", "dimensions", "url", "creditline",
            "creators", "legal_status", "alternate_titles"]
SMK_LIST = ["object_number", "titles", "production", "production_date", "dimensions", "object_names",
            "techniques", "frontend_url"]

# Who holds what, as Artsy's partner names and credits spell them.
MUSEUMS = {
    "aic": re.compile(r"(?<!school of the )art institute of chicago", re.I),
    "cma": re.compile(r"cleveland museum of art", re.I),
    "met": re.compile(r"metropolitan museum of art", re.I),
    "smk": re.compile(r"statens museum for kunst|national gallery of denmark|\bSMK\b"),
    "yuag": re.compile(r"yale university art gallery", re.I),
    "ycba": re.compile(r"yale center for british art", re.I),
}
API_OF = {"aic": "aic", "cma": "cma", "met": "met", "smk": "smk", "yuag": "lux", "ycba": "lux"}
NAMES = {"aic": "Art Institute of Chicago", "cma": "Cleveland Museum of Art",
         "met": "The Metropolitan Museum of Art", "smk": "SMK – Statens Museum for Kunst",
         "yuag": "Yale University Art Gallery", "ycba": "Yale Center for British Art"}
# A credit that is an exhibition, not a holding: a quoted show, "… at …", a run of dates.
EXHIBITION = re.compile(r'^\s*["“]|["”] at |\bat the\b|\d{4}\s*[-–]\s*\d{2,4}|\(\d{4}|'
                        r"\b(19|20)\d\d\b|:\s", re.I)
NOT_HELD = re.compile(r"private|courtesy|collection of|estate", re.I)

MULTIPLE_CATEGORIES = {"Print", "Photography", "Posters", "Reproduction", "Books and Portfolios",
                       "Ephemera or Merchandise"}
MULTIPLE_MEDIUM = re.compile(r"\b(bronze|cast|edition|lithograph|etching|engraving|woodcut|linocut|"
                             r"screenprint|silkscreen|serigraph|aquatint|drypoint|mezzotint|intaglio|"
                             r"photograph|gelatin|albumen|platinum print|chromogenic|pigment print|"
                             r"inkjet|giclee|giclée|c-print|offset|poster|multiple|impression)\b", re.I)
QUALIFIED = re.compile(r"\b(after|copy|copied|follower|followers|circle|school|workshop|studio|manner|"
                       r"style|imitator|pupil|efter|reproduction)\b", re.I)

STOP = {"the", "a", "an", "of", "and", "in", "on", "at", "with", "to", "for", "from", "de", "la", "le",
        "les", "du", "des", "l", "d", "el", "il", "lo", "der", "die", "das", "den", "het", "een", "van",
        "von", "y", "e", "et", "und", "by", "or", "no", "nr", "s"}
ARTICLES = {"the", "a", "an", "le", "la", "les", "l", "il", "lo", "el", "der", "die", "das", "het",
            "los", "las", "un", "une"}
PARTICLES = {"van", "von", "de", "der", "den", "di", "da", "del", "della", "des", "du", "la", "le",
             "ter", "ten", "y", "e", "el", "al", "dos", "das", "st", "saint"}
SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "younger", "elder", "the", "father", "son"}
GENERIC = {"untitled", "composition", "abstraction", "abstract", "landscape", "portrait", "self",
           "still", "life", "study", "studies", "nude", "nudes", "head", "figure", "figures", "sketch",
           "drawing", "painting", "print", "photograph", "flowers", "flower", "seascape", "interior",
           "woman", "man", "girl", "boy", "tree", "trees", "bather", "bathers", "horse", "horses",
           "street", "view", "sans", "titre", "ohne", "titel", "senza", "titolo", "sin", "titulo",
           "work", "series", "sheet", "number", "no", "detail", "two", "three", "blue", "red",
           "white", "black", "green", "yellow", "grey", "gray", "sea", "sky", "garden", "river",
           "house", "houses", "city", "night", "day", "morning", "evening", "face", "heads", "women",
           "men", "couple", "mother", "child", "children", "dancer", "dancers", "vase", "fruit",
           "apples", "bottle", "bottles", "table", "chair", "window", "door", "wall", "field",
           "fields", "mountain", "mountains", "lake", "boat", "boats", "harbor", "harbour", "beach",
           "rocks", "waves", "clouds", "sun", "moon", "light", "form", "forms", "shape", "shapes",
           "line", "lines", "color", "colour", "plate", "object", "objects", "model", "models",
           "reclining", "standing", "seated", "sitting", "young", "old", "large", "small", "big"}

COUNTRIES = {"france": "FR", "spain": "ES", "germany": "DE", "italy": "IT", "england": "GB",
             "scotland": "GB", "wales": "GB", "united kingdom": "GB", "uk": "GB", "great britain": "GB",
             "netherlands": "NL", "the netherlands": "NL", "holland": "NL", "belgium": "BE",
             "switzerland": "CH", "austria": "AT", "denmark": "DK", "danmark": "DK", "sweden": "SE",
             "norway": "NO", "finland": "FI", "russia": "RU", "japan": "JP", "china": "CN",
             "canada": "CA", "mexico": "MX", "usa": "US", "u.s.a.": "US", "united states": "US",
             "united states of america": "US", "australia": "AU", "ireland": "IE", "portugal": "PT",
             "greece": "GR", "czech republic": "CZ", "poland": "PL", "hungary": "HU", "brazil": "BR",
             "argentina": "AR", "israel": "IL", "south korea": "KR", "korea": "KR", "india": "IN",
             "iceland": "IS", "luxembourg": "LU", "monaco": "MC"}

MONTHS = {"jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3, "apr": 4, "april": 4,
          "may": 5, "jun": 6, "june": 6, "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9,
          "sept": 9, "september": 9, "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12,
          "december": 12}
MONTH = (r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|"
         r"Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)")

_lock = threading.Lock()
_key_locks = {}
_hosts = {}
_local = threading.local()


# ---------------------------------------------------------------- reading, politely, with a cache

def session():
    if not hasattr(_local, "s"):
        _local.s = requests.Session()
        _local.s.headers.update({"User-Agent": AGENT, "Accept": "application/json"})
    return _local.s


def host_gate(host):
    with _lock:
        if host not in _hosts:
            gap, n = HOSTS.get(host, (0.2, 2))
            _hosts[host] = {"gap": gap, "sem": threading.Semaphore(n), "next": 0.0, "lock": threading.Lock()}
        return _hosts[host]


def cache_path(api, key):
    return CACHE / api / (hashlib.sha1(key.encode()).hexdigest() + ".json")


def fetch(api, url, params=None, body=None, refresh=False):
    """GET (or POST a JSON body) and return the parsed answer, None when the thing is not there.
    Every answer is kept in data/museum_apis_cache/<api>/ and read from there next time."""
    key = url + "?" + urllib.parse.urlencode(params or {}, doseq=True) + ("#" + json.dumps(body, sort_keys=True)
                                                                          if body is not None else "")
    path = cache_path(api, key)
    with _lock:
        klock = _key_locks.setdefault(str(path), threading.Lock())
    with klock:
        if path.exists() and not refresh:
            j = json.loads(path.read_text())
            return j.get("answer")
        gate = host_gate(urllib.parse.urlparse(url).hostname)
        answer, last = None, None
        for attempt in range(7):
            with gate["sem"]:
                with gate["lock"]:
                    wait = gate["next"] - time.time()
                    if wait > 0:
                        time.sleep(wait)
                    gate["next"] = time.time() + gate["gap"]
                try:
                    if body is not None:
                        r = session().post(url, params=params, json=body, timeout=90)
                    else:
                        r = session().get(url, params=params, timeout=90)
                except requests.RequestException as e:
                    last = str(e)
                    r = None
            if r is not None:
                if r.status_code == 404:
                    answer = None
                    break
                ctype = r.headers.get("content-type", "")
                # The Met's firewall answers 403 with a page of HTML when it wants a pause.
                if r.status_code in (403, 429) or r.status_code >= 500 or "json" not in ctype:
                    last = f"{r.status_code} {ctype}"
                    if r.status_code == 400:
                        answer = None
                        break
                else:
                    try:
                        answer = r.json()
                        break
                    except ValueError:
                        last = "not JSON"
            time.sleep(min(120, 3 * 2 ** attempt))
        else:
            raise RuntimeError(f"no answer from {url} ({last})")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps({"key": key, "answer": answer}, ensure_ascii=False))
        return answer


# ---------------------------------------------------------------- words, names, dates and sizes

def fold(s):
    s = unicodedata.normalize("NFKD", str(s or ""))
    s = "".join(c for c in s if not unicodedata.combining(c)).lower()
    return s.replace("&", " and ").replace("æ", "ae").replace("ø", "o").replace("œ", "oe").replace("ß", "ss")


def words(s):
    return re.findall(r"[a-z0-9]+", fold(s))


def normtitle(s):
    w = words(s)
    while w and w[0] in ARTICLES and len(w) > 1:
        w = w[1:]
    return " ".join(w)


def title_variants(*titles):
    """Every way a title can be read: whole, without its brackets, and each bracketed alternative."""
    out = set()
    for t in titles:
        if not t or not isinstance(t, str):
            continue
        t = t.replace("\n", " ")
        pieces = {t, re.sub(r"\s*[\(\[][^\)\]]*[\)\]]", "", t)}
        pieces |= set(re.findall(r"[\(\[]([^\)\]]+)[\)\]]", t))
        for p in list(pieces):
            pieces |= set(re.split(r"\s+/\s+|\s+=\s+", p))
        for p in pieces:
            n = normtitle(p)
            if n and re.search(r"[a-z]", n):
                out.add(n)
    return out


def significant(n):
    return {w for w in n.split() if w not in STOP}


def generic(n):
    sig = significant(n)
    return not sig or all(w in GENERIC or w.isdigit() or re.fullmatch(r"[ivxlc]+", w) for w in sig) \
        or (len(sig) == 1 and len(next(iter(sig))) <= 5)


def title_match(a, b):
    """'exact' when a reading of one title is a reading of the other; 'fuzzy' when the significant
    words of the one are all among the other's (two words at least); else None."""
    if a & b:
        return "exact"
    best = None
    for x in a:
        for y in b:
            sx, sy = significant(x), significant(y)
            small, big = (sx, sy) if len(sx) <= len(sy) else (sy, sx)
            if len(small) >= 2 and small <= big and not generic(" ".join(small)):
                best = "fuzzy"
    return best


def name_words(n):
    n = re.sub(r"\(.*?\)|\[.*?\]", " ", str(n or ""))
    if "," in n and n.count(",") == 1 and not re.search(r",\s*(jr|sr)\b", n, re.I):
        last, first = n.split(",", 1)     # SMK and indexes write "Surname, Forename"
        n = first + " " + last
    return [w for w in words(n) if w not in SUFFIXES]


def surname(n):
    w = [x for x in name_words(n) if x not in PARTICLES]
    return w[-1] if w else ""


def birth_year(s):
    m = re.search(r"\b(1[0-9]{3}|20[0-2][0-9])\b", str(s or ""))
    return int(m.group(1)) if m else None


def artist_match(artists, names, births=()):
    """Does one of Artsy's artists appear among the museum's names for the maker?"""
    births = [b for b in births if b]
    for a in artists:
        aw = name_words(a["name"])
        sn = surname(a["name"])
        if not sn:
            continue
        others = [t for t in aw if t != sn and t not in PARTICLES]
        ab = birth_year(a.get("birthday"))
        for n in names:
            m = set(name_words(n))
            # "Rembrandt (Rembrandt van Rijn)" — the words inside the brackets count too
            m |= set(words(" ".join(re.findall(r"\((.*?)\)", str(n)))))
            if sn not in m:
                continue
            same_names = all(t in m or (len(t) == 1 and any(x.startswith(t) for x in m))
                             or any(len(x) == 1 and t.startswith(x) for x in m) for t in others)
            if ab and births and all(abs(ab - b) > 2 for b in births):
                continue          # the same surname, another person
            if same_names or (ab and births):
                return True
    return False


def year_range(s):
    """The years a date string covers: '1905–6' is 1905–1906, '1890s' 1890–1899, 'c. 1915-1926' ..."""
    t = fold(s)
    out = []
    for m in re.finditer(r"(?<!\d)(\d{3})0s", t):
        out += [int(m.group(1) + "0"), int(m.group(1) + "9")]
    for m in re.finditer(r"(?<!\d)(1[0-9]{3}|20[0-3][0-9])(?:\s*[-–/]\s*(\d{1,4}))?(?!\d)", t):
        y = int(m.group(1))
        out.append(y)
        if m.group(2):
            e = m.group(2)
            e = int(str(y)[:4 - len(e)] + e) if len(e) < 4 else int(e)
            if y <= e <= y + 100:
                out.append(e)
    return (min(out), max(out)) if out else None


def dates_agree(a, b, slack=2):
    if not a or not b:
        return None
    return a[0] - slack <= b[1] and b[0] - slack <= a[1]


def to_cm(v, unit):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return None
    return {"mm": v / 10, "cm": v, "m": v * 100, "in": v * 2.54}.get(unit, v)


def sizes_in(text):
    """Every 'h × w (× d) cm' (or mm) in a text, as (h, w) in centimetres."""
    out = []
    for m in re.finditer(r"(\d+(?:[.,]\d+)?)\s*[x×X]\s*(\d+(?:[.,]\d+)?)(?:\s*[x×X]\s*\d+(?:[.,]\d+)?)?\s*(cm|mm)\b",
                         str(text or "")):
        h, w = (float(m.group(i).replace(",", ".")) for i in (1, 2))
        f = 0.1 if m.group(3) == "mm" else 1
        out.append((h * f, w * f))
    return out


def sizes_agree(a, b):
    if not a or not b:
        return None

    def near(x, y):
        return abs(x - y) <= max(1.5, 0.03 * max(x, y))
    for h, w in a:
        for H, W in b:
            if (near(h, H) and near(w, W)) or (near(h, W) and near(w, H)):
                return True
    return False


def plain(s):
    """A source's text with its markup taken off and its spaces made single; the words stay as they are."""
    s = html.unescape(re.sub(r"<[^>]+>", "", str(s or "")))
    return re.sub(r"\s+", " ", s).strip()


# ---------------------------------------------------------------- the saved works

def load_works(only=None):
    works = []
    for s in json.loads(SAVES.read_text()):
        if not s.get("id") or (only and s["id"] not in only):
            continue
        p = WORKS / filename(s["id"])
        r = json.loads(p.read_text()) if p.exists() else {}
        artists = [{"name": a.get("name"), "birthday": a.get("birthday")}
                   for a in (r.get("artists") or s.get("artists") or []) if isinstance(a, dict) and a.get("name")]
        partner = r.get("partner") or s.get("partner") or {}
        ci = (r.get("collecting_institution") or s.get("collecting_institution") or "").strip()
        info = r.get("additional_information") or ""
        dims = s.get("dimensions") or {}
        sizes = []
        if s.get("height_cm") and s.get("width_cm"):
            sizes.append((float(s["height_cm"]), float(s["width_cm"])))
        for t in (dims.get("cm") if isinstance(dims, dict) else dims, info):
            sizes += sizes_in(t)
        for es in s.get("edition_sets") or []:
            sizes += sizes_in((es.get("dimensions") or {}).get("cm") if isinstance(es, dict) else "")
        medium = r.get("medium") or s.get("medium") or ""
        category = r.get("category") or s.get("category") or ""
        w = {
            "id": s["id"], "title": r.get("title") or s.get("title") or "",
            "date": r.get("date") or s.get("date") or "", "artists": artists,
            "category": category, "medium": medium, "sizes": sizes,
            "partner": partner.get("name") or "", "partner_type": partner.get("type") or "",
            "ci": ci, "info": info,
            "text": " ".join([ci, info, r.get("blurb") or "", r.get("provenance") or ""]),
            "multiple": category in MULTIPLE_CATEGORIES or bool(MULTIPLE_MEDIUM.search(medium))
                        or bool(s.get("edition_sets_count")),
            "for_sale": partner.get("type") in ("Gallery", "Auction") or bool(s.get("sale_ids"))
                        or bool(s.get("forsale")) or bool(s.get("sold")),
        }
        w["titles"] = title_variants(w["title"])
        w["years"] = year_range(w["date"])
        w["holder"], w["held_how"] = holder(w)
        w["met_ids"] = sorted(set(re.findall(r"metmuseum\.org/art/collection/search/(\d+)", w["text"])))
        works.append(w)
    return works


def which(text):
    return [k for k, rx in MUSEUMS.items() if rx.search(text or "")]


def holder(w):
    """Who Artsy says holds the work: one of the museums here, 'other' (someone else), or None (it
    doesn't say, or only that it was shown somewhere)."""
    coll = re.search(r"Collection:\s*([^\n]+)", w["info"])
    ci = w["ci"]
    if ci and not EXHIBITION.search(ci):
        if NOT_HELD.search(ci):
            return "other", "collecting institution: " + ci
        hit = which(ci)
        return (hit[0], "collecting institution: " + ci) if hit else ("other", "collecting institution: " + ci)
    if coll:
        hit = which(coll.group(1))
        return (hit[0], "Collection: " + coll.group(1).strip()) if hit else ("other", "Collection: " + coll.group(1).strip())
    hit = which(w["partner"])
    if hit:
        if ci:          # the museum listed it for a show: a loan, perhaps; perhaps its own
            return None, "listed by " + w["partner"] + " for " + ci
        return hit[0], "listed by " + w["partner"]
    return None, ""


# ---------------------------------------------------------------- candidates, museum by museum
# Each candidate: {museum, record, url, titles, names, births, qualified, years, sizes, accession, raw}

def aic_query(title, name, loose=False):
    q = {"bool": {"must": [
        {"match": {"title": {"query": title, "operator": "or", "minimum_should_match": "60%"}}
         if loose else {"match": {"title": {"query": title, "operator": "and"}}},
        {"match": {"artist_display": {"query": name}}}]}}
    return {"resources": "artworks", "query": q, "limit": 20, "fields": AIC_LIST}


def aic_queries(w):
    qs = []
    for a in w["artists"][:2]:
        sn = surname(a["name"])
        if not sn:
            continue
        for t in sorted(w["titles"], key=len, reverse=True)[:3]:
            qs.append(aic_query(t, sn))
        if w["holder"] == "aic":
            qs.append(aic_query(max(w["titles"], key=len, default=w["title"]), sn, loose=True))
    return qs


def aic_prefetch(works, refresh):
    """Fill the cache for every Art Institute query, 25 to a request (it allows 60 requests a minute)."""
    todo, seen = [], set()
    for w in works:
        for q in aic_queries(w):
            k = json.dumps(q, sort_keys=True)
            if k in seen:
                continue
            seen.add(k)
            if refresh or not cache_path("aic", AIC + "search#" + k).exists():
                todo.append(q)
    print(f"  aic: {len(todo)} searches to make", flush=True)
    for i in range(0, len(todo), 25):
        chunk = todo[i:i + 25]
        answer = fetch("aic-msearch", AIC + "msearch", body=chunk, refresh=True)
        if not isinstance(answer, list) or len(answer) != len(chunk):
            continue
        for q, a in zip(chunk, answer):
            k = json.dumps(q, sort_keys=True)
            p = cache_path("aic", AIC + "search#" + k)
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(json.dumps({"key": k, "answer": a}, ensure_ascii=False))
        # the msearch answers are kept one by one; the batch itself need not be
        cache_path("aic-msearch", AIC + "msearch?#" + json.dumps(chunk, sort_keys=True)).unlink(missing_ok=True)
        if i // 25 % 20 == 0:
            print(f"  aic: {i + len(chunk)} of {len(todo)}", flush=True)


def aic_candidate(d):
    return {"museum": "aic", "record": str(d["id"]), "url": f"https://www.artic.edu/artworks/{d['id']}",
            "titles": title_variants(d.get("title"), *(d.get("alt_titles") or [])),
            "names": [d.get("artist_display") or "", d.get("artist_title") or ""] + (d.get("artist_titles") or []),
            "births": [birth_year(x) for x in re.findall(r"\b1[0-9]{3}\b", d.get("artist_display") or "")[:1]],
            "qualified": bool(QUALIFIED.search((d.get("artist_display") or "").split("\n")[0][:40])),
            "years": (d.get("date_start"), d.get("date_end") or d.get("date_start")) if d.get("date_start") else
                     year_range(d.get("date_display")),
            "sizes": sizes_in(d.get("dimensions")), "accession": d.get("main_reference_number") or "",
            "deaccessioned": bool(d.get("fiscal_year_deaccession")), "raw": d}


def aic_candidates(w, refresh):
    out = {}
    for q in aic_queries(w):
        k = json.dumps(q, sort_keys=True)
        p = cache_path("aic", AIC + "search#" + k)
        a = json.loads(p.read_text())["answer"] if p.exists() else None
        for d in (a or {}).get("data") or []:
            out[str(d["id"])] = aic_candidate(d)
    return list(out.values())


def cma_candidate(d):
    creators = d.get("creators") or []
    dims = []
    for part in (d.get("dimensions") or {}).values():
        if isinstance(part, dict) and part.get("height") and part.get("width"):
            dims.append((part["height"] * 100, part["width"] * 100))
    dims += sizes_in(d.get("measurements"))
    return {"museum": "cma", "record": d.get("accession_number") or str(d.get("id")),
            "url": d.get("url") or f"https://clevelandart.org/art/{d.get('accession_number')}",
            "titles": title_variants(d.get("title"), *(d.get("alternate_titles") or [])),
            "names": [c.get("description") or "" for c in creators],
            "births": [birth_year(re.search(r"\((.*)\)", c.get("description") or "").group(1))
                       if re.search(r"\((.*)\)", c.get("description") or "") else None for c in creators],
            "qualified": any(QUALIFIED.search((c.get("qualifier") or "") + " " + (c.get("role") or ""))
                             for c in creators[:1]),
            "years": (d.get("creation_date_earliest"), d.get("creation_date_latest"))
                     if d.get("creation_date_earliest") else year_range(d.get("creation_date")),
            "sizes": dims, "accession": d.get("accession_number") or "",
            "deaccessioned": (d.get("legal_status") or "") == "deaccessioned", "raw": d}


def cma_candidates(w, refresh):
    out = {}
    for a in w["artists"][:2]:
        sn = surname(a["name"])
        if not sn:
            continue
        skip = 0
        while skip < 1000:
            j = fetch("cma", CMA, {"artists": a["name"], "limit": 100, "skip": skip,
                                   "fields": ",".join(CMA_LIST)}, refresh=refresh) or {}
            data = j.get("data") or []
            mine = [d for d in data if any(sn in words(c.get("description")) for c in d.get("creators") or [])]
            for d in mine:
                out[d.get("accession_number") or str(d.get("id"))] = cma_candidate(d)
            if len(data) < 100 or not mine:
                break
            skip += 100
    if w["holder"] == "cma":
        for acc in set(re.findall(r"\b(\d{4}\.\d+(?:\.\d+)?)\b", w["text"])):
            d = (fetch("cma", CMA + acc, refresh=refresh) or {}).get("data")
            if d:
                out[d.get("accession_number")] = cma_candidate(d)
    return list(out.values())


def smk_candidate(d):
    prod = [p for p in d.get("production") or [] if p.get("creator")]
    sizes, parts = [], {}
    for x in d.get("dimensions") or []:
        parts.setdefault(x.get("part"), {})[x.get("type")] = to_cm(x.get("value"), x.get("unit"))
    for p in parts.values():
        if p.get("height") and p.get("width"):
            sizes.append((p["height"], p["width"]))
    pd = (d.get("production_date") or [{}])[0]
    years = year_range((pd.get("start") or "")[:4] + "-" + (pd.get("end") or "")[:4]) if pd.get("start") else None
    return {"museum": "smk", "record": d.get("object_number"),
            "url": d.get("frontend_url") or f"https://open.smk.dk/artwork/image/{d.get('object_number')}",
            "titles": title_variants(*[t.get("title") for t in d.get("titles") or []]),
            "names": [p.get("creator") for p in prod[:1]],
            "births": [birth_year(p.get("creator_date_of_birth")) for p in prod[:1]],
            "qualified": any(QUALIFIED.search(p.get("creator_role") or "") for p in prod[:1]),
            "years": years, "sizes": sizes, "accession": d.get("object_number") or "", "raw": d}


def smk_candidates(w, refresh):
    out = {}
    for a in w["artists"][:2]:
        sn = surname(a["name"])
        if len(sn) < 2:
            continue
        offset = 0
        while offset < 1000:
            j = fetch("smk", SMK + "art/search/", {"keys": sn, "offset": offset, "rows": 100, "lang": "en",
                                                   "fields": SMK_LIST}, refresh=refresh) or {}
            items = j.get("items") or []
            for d in items:
                if any(sn == surname(p.get("creator")) for p in (d.get("production") or [])[:1]):
                    out[d["object_number"]] = smk_candidate(d)
            if len(items) < 100:
                break
            offset += 100
    return list(out.values())


def met_ids(params, refresh):
    q = params.pop("q")
    params["q"] = q            # the Met reads q only when it comes last
    j = fetch("met", MET + "search", params, refresh=refresh) or {}
    return set(j.get("objectIDs") or [])


def met_candidate(d):
    names = [d.get("artistDisplayName") or ""] + [c.get("name") or "" for c in d.get("constituents") or []
                                                   if (c.get("role") or "").lower() in ("artist", "")]
    sizes = []
    for m in d.get("measurements") or []:
        em = m.get("elementMeasurements") or {}
        if em.get("Height") and em.get("Width"):
            sizes.append((em["Height"], em["Width"]))
    sizes += sizes_in(d.get("dimensions"))
    return {"museum": "met", "record": str(d.get("objectID")), "url": d.get("objectURL") or
            f"https://www.metmuseum.org/art/collection/search/{d.get('objectID')}",
            "titles": title_variants(d.get("title")), "names": names,
            "births": [birth_year(d.get("artistBeginDate"))],
            "qualified": bool(QUALIFIED.search((d.get("artistPrefix") or "") + " " + (d.get("artistRole") or ""))),
            "years": (d.get("objectBeginDate"), d.get("objectEndDate")) if d.get("objectBeginDate") is not None
                     and d.get("objectEndDate") else year_range(d.get("objectDate")),
            "sizes": sizes, "accession": d.get("accessionNumber") or "", "raw": d}


def met_candidates(w, refresh):
    ids = set(int(i) for i in w["met_ids"])
    by_artist = set()
    for a in w["artists"][:2]:
        sn = surname(a["name"])
        if not sn:
            continue
        raw = [x for x in re.findall(r"[^\W\d_]+", a["name"]) if fold(x) == sn]
        for key in {sn} | set(raw):
            by_artist |= met_ids({"artistOrCulture": "true", "q": key}, refresh)
    if by_artist:
        for t in sorted(w["titles"], key=len, reverse=True)[:3]:
            ids |= met_ids({"title": "true", "q": t}, refresh) & by_artist
    out = []
    for i in sorted(ids)[:60]:
        d = fetch("met", MET + f"objects/{i}", refresh=refresh)
        if d and d.get("objectID"):
            out.append(met_candidate(d))
    return out


def lux_owner(d):
    labels = [o.get("_label") or "" for o in d.get("current_owner") or []]
    for k in ("yuag", "ycba"):
        if any(MUSEUMS[k].search(x) for x in labels):
            return k
    return None


def lux_statements(d, *kinds):
    out = []
    for r in d.get("referred_to_by") or []:
        labels = [c.get("_label") or "" for c in r.get("classified_as") or []]
        if any(l in kinds for l in labels) and r.get("content"):
            out.append(r["content"])
    return out


def lux_candidate(d):
    owner = lux_owner(d)
    names, births = [], []
    prod = d.get("produced_by") or {}
    for part in [prod] + (prod.get("part") or []):
        for c in part.get("carried_out_by") or []:
            lab = c.get("_label") or ""
            names.append(re.sub(r"^[A-Za-z ]+:\s*", "", lab))
            births.append(birth_year(re.search(r"\(([^)]*)\)", lab).group(1)) if re.search(r"\(([^)]*)\)", lab) else None)
    roles = [c.get("_label") or "" for part in (prod.get("part") or []) for c in part.get("classified_as") or []]
    ts = prod.get("timespan") or {}
    years = (int(ts["begin_of_the_begin"][:4]), int(ts["end_of_the_end"][:4])) \
        if ts.get("begin_of_the_begin") and ts.get("end_of_the_end") else None
    acc = next((i.get("content") for i in d.get("identified_by") or [] if i.get("type") == "Identifier"
                and any(c.get("_label") == "Accession Number" for c in i.get("classified_as") or [])), "")
    page = next((a.get("id") for s in d.get("subject_of") or [] for dc in s.get("digitally_carried_by") or []
                 for a in dc.get("access_point") or [] if "yale.edu" in (a.get("id") or "")
                 and "manifest" not in (a.get("id") or "")), None)
    sizes = []
    for t in lux_statements(d, "Dimension Statement", "Dimensions"):
        sizes += sizes_in(t)
    return {"museum": owner or "lux", "record": acc or d.get("id"), "url": page or d.get("id"), "lux": d.get("id"),
            "titles": title_variants(*[i.get("content") for i in d.get("identified_by") or [] if i.get("type") == "Name"]),
            "names": names, "births": births,
            "qualified": any(QUALIFIED.search(r) for r in roles) or any(QUALIFIED.search(n[:30]) for n in
                                                                        [c.get("_label") or "" for p in (prod.get("part") or [])
                                                                         for c in p.get("carried_out_by") or []][:1]),
            "years": years, "sizes": sizes, "accession": acc, "raw": d}


def lux_candidates(w, refresh):
    ids = []
    for a in w["artists"][:2]:
        sn = surname(a["name"])
        if not sn:
            continue
        for t in sorted(w["titles"], key=len, reverse=True)[:2]:
            q = json.dumps({"AND": [{"name": t}, {"producedBy": {"name": sn}}]})
            j = fetch("lux", LUX + "api/search/item", {"q": q}, refresh=refresh) or {}
            ids += [x["id"] for x in j.get("orderedItems") or []]
    out = []
    for i in list(dict.fromkeys(ids))[:20]:
        d = fetch("lux", i, refresh=refresh)
        if d and lux_owner(d):
            out.append(lux_candidate(d))
    return out


FINDERS = {"aic": aic_candidates, "cma": cma_candidates, "smk": smk_candidates, "met": met_candidates,
           "lux": lux_candidates}


# ---------------------------------------------------------------- judging a candidate

def judge(w, c):
    """(confidence, how) for a candidate that is this work; ('reject', why) for one that nearly is;
    None for one that is plainly something else."""
    if not artist_match(w["artists"], c["names"], c["births"]):
        return None
    t = title_match(w["titles"], c["titles"])
    acc = c["accession"] and len(c["accession"]) >= 5 and re.search(
        r"(?<![\w.])" + re.escape(c["accession"]) + r"(?![\w]|\.\d)", w["text"])
    linked_id = c["museum"] == "met" and c["record"] in w["met_ids"]
    if not t and not acc and not linked_id:
        return None
    d = dates_agree(w["years"], c["years"])
    s = sizes_agree(w["sizes"], c["sizes"])
    linked = w["holder"] == c["museum"]
    facts = []
    if linked:
        facts.append(w["held_how"])
    facts.append({"exact": "same title", "fuzzy": "title words shared", None: "title differs"}[t])
    facts.append("same artist")
    facts.append({True: "date agrees", False: "date differs", None: "date not given on both"}[d])
    facts.append({True: "dimensions agree", False: "dimensions differ", None: "dimensions not on both"}[s])
    how = ", ".join(facts)
    if c["qualified"]:
        return "reject", "the museum gives it to the artist's circle, school or a copy: " + how
    if linked_id:
        return "exact", "Artsy's record links to this Met object; " + how
    if acc and d is not False:
        return "exact", f"accession number {c['accession']} in Artsy's record; " + how
    if d is False:
        return "reject", how
    if linked:
        if t == "exact" and d and s is not False:
            return ("strong" if s or not generic(min(w["titles"], key=len)) else "probable"), how
        if t == "exact" and s is not False:
            return "probable", how
        if t and d:
            return "probable", how
        return "reject", how
    if w["holder"] not in (None,):
        return "reject", "Artsy says it is held elsewhere (" + w["held_how"] + "); " + how
    if w["multiple"]:
        return "reject", "a print, photograph, cast or other multiple, and Artsy does not name this museum's impression; " + how
    if w["for_sale"] and not c.get("deaccessioned"):
        return "reject", f"offered by {w['partner'] or 'a dealer'} ({w['partner_type']}), so not a museum's object; " + how
    if t == "exact" and d and s:
        return "strong", how
    return "reject", how


RANK = {"exact": 3, "strong": 2, "probable": 1}


def match_work(w, museums, refresh):
    """Look for the work where it may be, judge every candidate, and settle on one or none."""
    apis = sorted({API_OF[m] for m in museums})
    if w["holder"] == "other":
        return None, [], []
    if w["holder"] in API_OF:
        apis = [a for a in apis if a == API_OF[w["holder"]]]
    good, doubtful = [], []
    for api in apis:
        try:
            cands = FINDERS[api](w, refresh)
        except RuntimeError as e:
            doubtful.append({"museum": api, "record": "", "why": "could not search: " + str(e)})
            continue
        for c in cands:
            if c["museum"] not in museums:
                continue
            v = judge(w, c)
            if not v:
                continue
            if v[0] == "reject":
                doubtful.append({"museum": c["museum"], "record": c["record"], "url": c["url"],
                                 "their_title": next(iter(sorted(c["titles"], key=len, reverse=True)), ""),
                                 "why": v[1]})
            else:
                good.append((v[0], v[1], c))
    if not good:
        return None, doubtful, []
    good.sort(key=lambda g: (RANK[g[0]], w["holder"] == g[2]["museum"], sizes_agree(w["sizes"], g[2]["sizes"]) is True),
              reverse=True)
    top = good[0]
    rivals = [g for g in good[1:] if RANK[g[0]] == RANK[top[0]] and (w["holder"] == g[2]["museum"]) ==
              (w["holder"] == top[2]["museum"]) and (sizes_agree(w["sizes"], g[2]["sizes"]) is True) ==
              (sizes_agree(w["sizes"], top[2]["sizes"]) is True)]
    if rivals:
        for g in [top] + rivals:
            doubtful.append({"museum": g[2]["museum"], "record": g[2]["record"], "url": g[2]["url"],
                             "why": "more than one record fits equally well: " + g[1]})
        return None, doubtful, good
    for g in good[1:]:
        doubtful.append({"museum": g[2]["museum"], "record": g[2]["record"], "url": g[2]["url"],
                         "why": "a weaker candidate than the one matched: " + g[1]})
    return top, doubtful, good


# ---------------------------------------------------------------- the museums' words as events

def split_top(text, sep=";"):
    """Split on sep where it is not inside brackets."""
    out, depth, cur = [], 0, ""
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth = max(0, depth - 1)
        if ch == sep and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return [x.strip() for x in out if x.strip(" .;\n")]


def iso(y, m=None, d=None):
    return f"{y:04d}" + (f"-{m:02d}" if m else "") + (f"-{d:02d}" if m and d else "")


SKIP_NUM = re.compile(r"(cat|no|nos|p|pp|fig|figs|pl|pls|lot|vol|n°|nr|ill|inv|op)\.?\s*$", re.I)


def date_mentions(text):
    """The dates a text gives, in order, as (year, month, day); a month or day without a year takes the
    year of the next date that has one ('Oct. 29–Dec. 10, 1942')."""
    t = text
    found = []
    pat = re.compile(
        r"(?P<iso>(?P<iy>\d{4})-(?P<im>\d{2})-(?P<id>\d{2}))"
        r"|(?P<dmy>(?P<dd>\d{1,2})\s+(?P<dm>" + MONTH + r")\.?,?\s+(?P<dy>\d{4}))"
        r"|(?P<md>(?P<m>" + MONTH + r")\.?(?:\s+(?P<d>\d{1,2})(?:st|nd|rd|th)?(?!\d))?"
        r"(?:\s*[-–]\s*(?P<d2>\d{1,2})(?!\d)(?!\s*[-–]))?(?:,?\s+(?P<y>\d{4}))?)"
        r"|(?P<year>(?<![\d/])\d{4}(?![\d]))", re.I)
    for m in pat.finditer(t):
        if m.group("iso"):
            found.append([int(m.group("iy")), int(m.group("im")), int(m.group("id"))])
        elif m.group("dmy"):
            found.append([int(m.group("dy")), MONTHS[m.group("dm").lower()[:4].rstrip(".")] if m.group("dm").lower()[:4] in MONTHS
                          else MONTHS[m.group("dm").lower()[:3]], int(m.group("dd"))])
        elif m.group("md"):
            name = m.group("m").lower()
            mo = MONTHS.get(name) or MONTHS.get(name[:4]) or MONTHS.get(name[:3])
            if not (m.group("d") or m.group("y")) and name in ("may", "march"):
                continue          # a word, not a month
            y = int(m.group("y")) if m.group("y") else None
            day = int(m.group("d")) if m.group("d") and 1 <= int(m.group("d")) <= 31 else None
            found.append([y, mo, day])
            if m.group("d2"):
                found.append([y, mo, int(m.group("d2"))])
        else:
            y = int(m.group("year"))
            if not 1200 <= y <= 2035 or SKIP_NUM.search(t[max(0, m.start() - 6):m.start()]):
                continue
            found.append([y, None, None])
    nxt = None
    for f in reversed(found):
        if f[0] is None:
            f[0] = nxt
        else:
            nxt = f[0]
    return [tuple(f) for f in found if f[0]]


def dates(text, prefer_months=True):
    """start, end and circa for an event's text."""
    t = re.sub(r"[\(\[]\s*(?:b\.|born|d\.|died|active|fl\.)?\s*\d{4}\s*[-–]\s*(?:\d{4})?\s*[\)\]]", " ", text)
    t = re.sub(r"\((?:born|died|b\.|d\.)\s*\d{4}\)", " ", t)
    ms = date_mentions(t)
    if not ms:
        return "", "", False
    if prefer_months and any(m[1] for m in ms):
        ms = [m for m in ms if m[1]]
    circa = bool(re.search(r"\b(c\.|ca\.|circa|about|around|by)\s*(" + MONTH + r"\.?\s*)?\d", t, re.I))
    start = iso(*ms[0])
    end = iso(*ms[-1]) if len(ms) > 1 and ms[-1] != ms[0] else ""
    if len(ms) == 1 and re.search(r"\b(until|till|to|through)\s+(" + MONTH + r"\.?\s*\d{0,2},?\s*)?\d{4}", t, re.I):
        return "", start, circa
    return start, end, circa


def country_of(part):
    return COUNTRIES.get(fold(part).strip(" .").strip(), "")


ORGISH = re.compile(r"\b(gallery|galleries|galerie|museum|company|co\.|inc|ltd|collection|foundation|"
                    r"society|school|sons|club|trust|bank|associates|& |and|university|library)\b", re.I)


def place_after(parts):
    """City and country from the parts of a text after a name: the part before a country, else the
    first part when it reads like a place."""
    for i, p in enumerate(parts):
        c = country_of(p)
        if c:
            city = parts[i - 1].strip() if i > 0 else ""
            if re.search(r"\d", city) or ORGISH.search(city) or len(city.split()) > 4:
                city = ""
            return city, c
    if parts:
        p = parts[0].strip()
        if re.fullmatch(r"[A-Z][\w'’.-]+(?: [A-Z][\w'’.-]+){0,2}", p) and not ORGISH.search(p) \
                and not re.search(r"\d", p):
            return p, ""
    return "", ""


PROTECT = [(r",\s*(Jr|Sr|Inc|Ltd|Esq|S\.A|Co)\b\.?", r" \1."), ]


def who_and_place(seg):
    s = re.sub(r"\[[^\]]*\]", " ", seg)
    s = s.strip().strip("()").strip()
    for a, b in PROTECT:
        s = re.sub(a, b, s)
    s = re.sub(r"\s*\((?:\d{4}|b\.|born|died|d\.)[^)]*\)", "", s)
    parts = [p.strip() for p in s.split(",")]
    first = parts[0]
    lead = re.match(r"^(?:and\s+)?(?:(?:probably|possibly|presumably|perhaps)\s+)?(.*)$", first, re.I).group(1)
    m = list(re.finditer(r"\b(?:to|by|with|from)\s+(?=[A-Z\"“'‘]|the\b|his\b|her\b|their\b)", lead))
    verbish = re.match(r"^(?:by|sold|purchased|bought|given|gift|bequeathed|consigned|placed|returned|acquired|"
                       r"transferred|exchanged|with|created|inherited|lent|deposited|confiscated|seized|"
                       r"restituted|possibly|probably|to)\b", lead, re.I)
    if verbish and m:
        who = lead[m[-1].end():]
    elif verbish:
        who = ""
    else:
        who = lead
    who = re.sub(r"\s*\([^)]*\)", "", who).strip(" .;:")
    who = re.sub(r"^(?:his|her|their)\s+\w+,?\s+", "", who)
    if who and not re.match(r"[A-Z\"“'‘]|the\b", who):
        who = ""
    city, country = place_after(parts[1:])
    return who, city, country


def provenance_kind(seg):
    if re.match(r"\s*created by\b", seg, re.I):
        return "made"
    if re.search(r"\b(sold|sale|auction|purchased|bought|lot\s+\d)", seg, re.I):
        return "sold"
    return "owned"


def ev(kind, text, field, order, **kw):
    e = {"kind": kind, "text": text, "field": field, "start": "", "end": "", "circa": False, "who": "",
         "title": "", "venue": "", "city": "", "country": "", "publication": "", "pages": "", "note": "",
         "url": "", "order": order}
    for k, v in kw.items():
        if v not in (None,):
            e[k] = v
    return e


def provenance_events(segments, field, notes=None):
    out = []
    for i, seg in enumerate(segments, 1):
        text = plain(seg)
        start, end, circa = dates(re.sub(r"\[[^\]]*\]", " ", text), prefer_months=False)
        who, city, country = who_and_place(text)
        note = ""
        if notes:
            refs = re.findall(r"\[(\w{1,3})\]", text)
            note = " ".join(notes[r] for r in refs if r in notes)
        out.append(ev(provenance_kind(text), text, field, i, start=start, end=end, circa=circa, who=who,
                      city=city, country=country, note=note))
    return out


def split_notes(text):
    """A provenance with its notes after it ('… Notes: [1] …'): the chain, and the notes by mark."""
    body, _, tail = re.split(r"\s+(Notes?:)\s+", text, maxsplit=1) + ["", ""] if re.search(r"\s+Notes?:\s+", text) \
        else [text, "", ""]
    notes = {}
    for m in re.finditer(r"\[(\w{1,3})\]\s*(.*?)(?=\s*\[\w{1,3}\]\s|$)", tail, re.S):
        notes[m.group(1)] = plain(m.group(2))
    return body, notes


def publication_parts(text):
    """Author, title, publication, pages and date of a bibliography entry, as its own words give them."""
    t = text
    who = title = publication = ""
    q = re.search(r"[“\"]([^”\"]+?)[,.]?[”\"]", t)
    em = re.findall(r"<(?:em|i)>(.*?)</(?:em|i)>", t)
    flat = plain(t)
    if q:
        title = plain(q.group(1)).strip(" ,.")
        who = plain(t[:q.start()]).strip(" ,.:")
        after = t[q.end():]
        em_after = re.findall(r"<(?:em|i)>(.*?)</(?:em|i)>", after)
        if em_after:
            publication = plain(em_after[0]).strip(" ,.")
        else:
            publication = plain(re.split(r"[,(]", plain(after).lstrip(" ,.in"), 1)[0]).strip(" ,.")
    elif em:
        title = plain(em[0]).strip(" ,.")
        who = plain(t[:t.find("<")]).strip(" ,.:")
    else:
        parts = re.split(r",\s{2,}|,\s+(?=\()| \(", flat, 1)
        head = parts[0]
        if ", " in head:
            who, title = head.split(", ", 1)
        else:
            title = head
    if len(who) > 120 or re.search(r"\d{4}", who):
        who = ""
    pages = ", ".join(re.findall(r"\bpp?\.\s*[\dixvlc]+(?:\s*[-–]\s*\d+)?(?:,\s*\d+(?:\s*[-–]\s*\d+)?)*", flat))
    paren = re.findall(r"\(([^()]*\b\d{4}\b[^()]*)\)", flat)
    src = paren[-1] if paren else (flat[flat.find(title) + len(title):] if title and title in flat else flat)
    ms = date_mentions(src)
    start = iso(*ms[-1]) if paren and ms else (iso(*ms[0]) if ms else "")
    return who, title, publication, pages, start


def written_events(entries, field):
    out = []
    for i, (raw, extra) in enumerate(entries, 1):
        text = plain(raw)
        who, title, pub, pages, start = publication_parts(raw)
        if extra.get("pages"):
            pages = extra["pages"]
        out.append(ev("written", text + (" " + extra["suffix"] if extra.get("suffix") else ""), field, i,
                      start=start, who=who, title=title, publication=pub, pages=pages, url=extra.get("url") or ""))
    return out


def made_event(text, field, years, who, place=""):
    if not text:
        return []
    circa = bool(re.search(r"\b(c\.|ca\.|circa|about)", text, re.I))
    s = str(years[0]) if years and years[0] else ""
    e = str(years[1]) if years and years[1] and years[1] != years[0] else ""
    return [ev("made", text, field, 1, start=s, end=e, circa=circa, who=who, city="", note=place)]


def aic_events(c, refresh):
    d = (fetch("aic", AIC + f"artworks/{c['raw']['id']}", {"fields": ",".join(AIC_FULL)}, refresh=refresh)
         or {}).get("data") or c["raw"]
    out = made_event(d.get("date_display"), "date_display", (d.get("date_start"), d.get("date_end")),
                     d.get("artist_title") or "", "place_of_origin: " + d["place_of_origin"] if d.get("place_of_origin") else "")
    if d.get("provenance_text"):
        body, notes = split_notes(d["provenance_text"])
        out += provenance_events(split_top(body.replace("\n", " ")), "provenance_text", notes)
    order = 0
    for para in re.split(r"\n\s*\n", d.get("exhibition_history") or ""):
        if not para.strip():
            continue
        segs = split_top(para)
        head_title = ""
        for j, seg in enumerate(segs):
            order += 1
            text = plain(seg)
            url = (re.search(r'href="([^"]+)"', seg) or [None, ""])[1]
            em = re.search(r"<em>(.*?)</em>", seg)
            title = venue = city = ""
            after = text
            if em:
                title = plain(em.group(1))
                pre = plain(seg[:em.start()]).strip(" ,")
                after = plain(seg[em.end():])
                bits = [b.strip() for b in pre.split(",") if b.strip()]
                if len(bits) >= 2:
                    city, venue = bits[0], ", ".join(bits[1:])
                elif bits:
                    venue = bits[0]
            elif j > 0:
                first = date_mentions(text)
                m = re.search(r",\s*(?:opened\s+|closed\s+)?" + MONTH + r"\.?\s|,\s*\d{4}", text)
                pre = text[:m.start()] if m else ""
                if ", as " in pre:
                    venue, title = pre.split(", as ", 1)
                elif pre and first:
                    venue = pre
                    title = head_title
            if j == 0:
                head_title = title
            start, end, circa = dates(after)
            out.append(ev("exhibited", text, "exhibition_history", order, start=start, end=end, circa=circa,
                          title=title, venue=venue.strip(), city=city, url=url))
    pubs = [(p, {}) for p in re.split(r"\n\s*\n", d.get("publication_history") or "") if p.strip()]
    out += written_events(pubs, "publication_history")
    if d.get("credit_line"):
        out.append(ev("held", plain(d["credit_line"]), "credit_line", 1, venue="Art Institute of Chicago",
                      note="main reference number " + (d.get("main_reference_number") or "")))
    source = {"name": "Art Institute of Chicago - collection data (CC0)",
              "url": f"https://www.artic.edu/artworks/{d['id']}",
              "licence": "CC0 1.0 (https://creativecommons.org/publicdomain/zero/1.0/); Terms and Conditions of artic.edu"}
    return source, out


def cma_events(c, refresh):
    acc = c["raw"].get("accession_number")
    d = (fetch("cma", CMA + urllib.parse.quote(acc), refresh=refresh) or {}).get("data") or c["raw"]
    who = "; ".join(x.get("description") or "" for x in d.get("creators") or [])
    out = made_event(d.get("creation_date"), "creation_date",
                     (d.get("creation_date_earliest"), d.get("creation_date_latest")), who)
    for p in sorted(d.get("provenance") or [], key=lambda x: x.get("sortorder") or 0):
        text = plain(p.get("description"))
        if not text:
            continue
        i = len([e for e in out if e["field"] == "provenance"]) + 1
        e = provenance_events([text], "provenance")[0]
        e["order"] = i
        if p.get("date") and re.fullmatch(r"\d{4}(-\d{2}(-\d{2})?)?", str(p["date"]).strip()):
            e["start"] = str(p["date"]).strip()
        notes = [plain(f) for f in (p.get("footnotes") or []) if plain(f)]
        cites = [plain(x) for x in (p.get("citations") or []) if plain(x)]
        e["note"] = " ".join(notes + cites)
        out.append(e)
    ex = d.get("exhibitions") or {}
    for i, x in enumerate(ex.get("current") or [], 1):
        desc = x.get("description") or ""
        text = plain(desc)
        m = re.search(r"</i>\.?\s*(.*)$", desc, re.S)
        rest = plain(m.group(1)) if m else text
        rest_venue = re.sub(r"\s*\((?:organizer|organiser)\)", "", re.sub(r"\s*\([^()]*\d{4}[^()]*\)\.?\s*$", "", rest))
        bits = [b.strip() for b in rest_venue.split(",") if b.strip()]
        venue = bits[0] if bits else ""
        city, country = place_after(bits[1:]) if len(bits) > 1 else ("", "")
        start, end, circa = dates(rest)
        if x.get("opening_date"):
            start = x["opening_date"][:10]
        out.append(ev("exhibited", text, "exhibitions.current", i, start=start, end=end if end != start else "",
                      circa=circa, title=plain(x.get("title")), venue=venue, city=city, country=country))
    for i, x in enumerate(ex.get("legacy") or [], 1):
        text = plain(x.get("description") if isinstance(x, dict) else x)
        if not text:
            continue
        start, end, circa = dates(text)
        out.append(ev("exhibited", text, "exhibitions.legacy", i, start=start, end=end, circa=circa))
    cites = [(x.get("citation") or "", {"pages": plain(x.get("page_number")), "url": x.get("url") or ""})
             for x in d.get("citations") or [] if x.get("citation")]
    out += written_events(cites, "citations")
    if d.get("creditline"):
        out.append(ev("held", plain(d["creditline"]), "creditline", 1,
                      start=(d.get("accession_date") or "")[:10], venue="Cleveland Museum of Art",
                      note="accession number " + (d.get("accession_number") or "")))
    source = {"name": "Cleveland Museum of Art - Open Access collection data (CC0)",
              "url": d.get("url") or c["url"], "licence": "CC0 1.0 (Cleveland Museum of Art Open Access)"}
    return source, out


def smk_date(v, precision):
    if not v:
        return ""
    day = v[:10]
    p = (precision or "")[:10]
    if p == day or not p:
        return day
    if p.endswith("-12-31") and day.endswith("-01-01"):
        return day[:4]
    return day[:7] if day[:7] == p[:7] else day[:4]


def smk_events(c, refresh):
    num = c["raw"]["object_number"]
    j = fetch("smk", SMK + "art/", {"object_number": num, "lang": "en"}, refresh=refresh) or {}
    d = (j.get("items") or [c["raw"]])[0]
    prod = [p.get("creator") for p in d.get("production") or [] if p.get("creator")]
    pd = (d.get("production_date") or [{}])[0]
    out = made_event(pd.get("period"), "production_date",
                     ((pd.get("start") or "")[:4] or None, (pd.get("end") or "")[:4] or None), prod[0] if prod else "")
    for i, x in enumerate(d.get("exhibitions") or [], 1):
        text = ", ".join(v for v in (x.get("exhibition"), x.get("venue")) if v)
        s, e = (x.get("date_start") or "")[:10], (x.get("date_end") or "")[:10]
        out.append(ev("exhibited", text, "exhibitions", i, start=s, end=e if e != s else "",
                      title=x.get("exhibition") or "", venue=x.get("venue") or ""))
    for i, x in enumerate(d.get("documentation") or [], 1):
        text = ", ".join(v for v in (x.get("author"), x.get("title"), x.get("year_of_publication"), x.get("notes")) if v)
        out.append(ev("written", text, "documentation", i, start=(x.get("year_of_publication") or "")[:4],
                      who=x.get("author") or "", title=x.get("title") or "", pages=x.get("notes") or "",
                      note=("shelfmark " + x["shelfmark"]) if x.get("shelfmark") else ""))
    if d.get("acquisition_date"):
        out.append(ev("held", f"{num}; acquisition_date {smk_date(d['acquisition_date'], d.get('acquisition_date_precision'))}",
                      "acquisition_date", 1, start=smk_date(d["acquisition_date"], d.get("acquisition_date_precision")),
                      venue="Statens Museum for Kunst", note="object number " + num +
                      ("; " + d["responsible_department"] if d.get("responsible_department") else "")))
    source = {"name": "SMK - Statens Museum for Kunst, open collection data (api.smk.dk)",
              "url": d.get("frontend_url") or c["url"],
              "licence": "SMK Open; terms: " + (d.get("rights") or "https://www.smk.dk/en/section/use-of-smk-material/")}
    return source, out


def lux_events(c, refresh):
    d = c["raw"]
    owner = NAMES.get(c["museum"], "")
    prod = d.get("produced_by") or {}
    ts = prod.get("timespan") or {}
    dt = next((n.get("content") for n in ts.get("identified_by") or [] if n.get("content")), "")
    who = "; ".join(c2.get("_label") or "" for p in [prod] + (prod.get("part") or []) for c2 in p.get("carried_out_by") or [])
    out = made_event(dt, "produced_by", c["years"], who)
    for stmt in lux_statements(d, "Provenance Statement", "Provenance"):
        body, notes = split_notes(stmt)
        out += provenance_events(split_top(body), "Provenance", notes)
    order = 0
    for x in lux_statements(d, "Exhibitions (events)", "Exhibition History", "Exhibitions"):
        order += 1
        text = plain(x)
        m = re.search(r",?\s*(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})\s*$", text)
        start, end = (m.group(1), m.group(2)) if m else ("", "")
        if not m:
            start, end, _ = dates(text)
        rest = text[:m.start()] if m else text
        parts = [p.strip() for p in rest.split(", ")]
        title = venue = city = ""
        if len(parts) >= 4 and re.search(r"\.$|^[A-Z]{2,3}$", parts[-1]) or (len(parts) >= 4 and country_of(parts[-1])):
            title, venue, city = ", ".join(parts[:-3]), parts[-3], parts[-2]
        out.append(ev("exhibited", text, "Exhibitions (events)", order, start=start, end=end, title=title,
                      venue=venue, city=city, country=country_of(parts[-1]) if parts else ""))
    for mem in d.get("member_of") or []:
        lab = mem.get("_label") or ""
        m = re.match(r'YCBA Exhibit set for "(.*) \((.*), (\d{4}-\d{2}-\d{2}) - (\d{4}-\d{2}-\d{2})\)"$', lab)
        if m:
            order += 1
            out.append(ev("exhibited", f"{m.group(1)} ({m.group(2)}, {m.group(3)} - {m.group(4)})", "member_of",
                          order, start=m.group(3), end=m.group(4), title=m.group(1), venue=m.group(2)))
    cites = [(x, {}) for x in lux_statements(d, "Citation", "Citations")]
    out += written_events(cites, "Citation")
    for cl in lux_statements(d, "Credit Line"):
        out.append(ev("held", plain(cl), "Credit Line", 1, venue=owner,
                      note=("accession number " + c["accession"]) if c["accession"] else ""))
    source = {"name": f"{owner} - collection data via LUX: Yale Collections Discovery",
              "url": c["url"], "licence": "Yale University open access (LUX, lux.collections.yale.edu); "
                                          "record: " + d.get("id", "")}
    return source, out


def met_events(c, refresh):
    d = c["raw"]
    who = d.get("artistDisplayName") or ""
    out = made_event(d.get("objectDate"), "objectDate", (d.get("objectBeginDate"), d.get("objectEndDate")), who)
    repo = d.get("repository") or ""
    bits = [b.strip() for b in repo.split(",")]
    if d.get("creditLine"):
        out.append(ev("held", d["creditLine"], "creditLine", 1, start=str(d.get("accessionYear") or "")[:4],
                      venue=bits[0] if bits else "The Metropolitan Museum of Art",
                      city=bits[1] if len(bits) > 1 else "",
                      note="accession number " + (d.get("accessionNumber") or "")))
    source = {"name": "The Metropolitan Museum of Art - Collection API (Open Access, CC0)",
              "url": d.get("objectURL") or c["url"], "licence": "CC0 1.0 (The Met Open Access)"}
    return source, out


EVENTS = {"aic": aic_events, "cma": cma_events, "smk": smk_events, "met": met_events,
          "yuag": lux_events, "ycba": lux_events}


# ---------------------------------------------------------------- the run

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="*", help="Artsy ids to read (default: every saved work)")
    ap.add_argument("--museums", default="aic,cma,smk,lux,met")
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--refresh", action="store_true", help="ask the museums again, not the cache")
    args = ap.parse_args()
    wanted = set()
    for m in args.museums.split(","):
        wanted |= {"yuag", "ycba"} if m == "lux" else {m}
    works = load_works(set(args.only) if args.only else None)
    OUT.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    held = {}
    for w in works:
        held[w["holder"] or "none"] = held.get(w["holder"] or "none", 0) + 1
    print(f"{len(works)} works; Artsy says held by: {held}", flush=True)
    if "aic" in wanted:
        aic_prefetch([w for w in works if w["holder"] in (None, "aic")], args.refresh)
        print(f"  aic searched in {time.time() - t0:.0f} s", flush=True)

    done = [0]

    def one(w):
        top, doubtful, _ = match_work(w, wanted, args.refresh)
        with _lock:
            done[0] += 1
            if done[0] % 250 == 0:
                print(f"  {done[0]} of {len(works)} works looked for ({time.time() - t0:.0f} s)", flush=True)
        return w, top, doubtful

    with ThreadPoolExecutor(args.threads) as pool:
        results = list(pool.map(one, works))

    report = {"matched": [], "rejected": [], "unmatched_held": []}
    written = set()
    counts = {}
    for w, top, doubtful in results:
        for dbt in doubtful:
            report["rejected"].append(dict(dbt, id=w["id"], title=w["title"], date=w["date"],
                                           artist=", ".join(a["name"] for a in w["artists"])))
        if not top:
            if w["holder"] in NAMES:
                report["unmatched_held"].append({"id": w["id"], "title": w["title"], "museum": w["holder"],
                                                 "artist": ", ".join(a["name"] for a in w["artists"])})
            continue
        conf, how, c = top
        try:
            source, events = EVENTS[c["museum"]](c, args.refresh)
        except RuntimeError as e:
            print(f"  could not read {c['url']}: {e}", flush=True)
            continue
        rec = {"id": w["id"], "source": source,
               "match": {"record": c["record"], "how": how, "confidence": conf}, "events": events}
        name = filename(w["id"])
        (OUT / name).write_text(json.dumps(rec, ensure_ascii=False, indent=1))
        written.add(name)
        for e in events:
            counts[e["kind"]] = counts.get(e["kind"], 0) + 1
        report["matched"].append({"id": w["id"], "title": w["title"], "artist": ", ".join(a["name"] for a in w["artists"]),
                                  "museum": c["museum"], "record": c["record"], "url": c["url"],
                                  "confidence": conf, "how": how, "events": len(events)})
    if not args.only:
        for p in OUT.glob("*.json"):
            if p.name not in written:
                p.unlink()
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=1))
    by_museum = {}
    for m in report["matched"]:
        by_museum[m["museum"]] = by_museum.get(m["museum"], 0) + 1
    by_conf = {}
    for m in report["matched"]:
        by_conf[m["confidence"]] = by_conf.get(m["confidence"], 0) + 1
    print(f"{len(report['matched'])} works matched {by_museum} {by_conf}; "
          f"{sum(counts.values())} events {counts}; {len(report['rejected'])} doubtful candidates rejected; "
          f"{len(report['unmatched_held'])} works Artsy says these museums hold were not found; "
          f"{time.time() - t0:.0f} s", flush=True)


if __name__ == "__main__":
    main()
