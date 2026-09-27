#!/usr/bin/env python3
"""The history of every saved artwork, for the Artist Website: where it has been, every show it was
in, every sale, and what has been written about it — dated, placed on the Earth, and each with its
sources. (Artist's request and decisions, 27 Sep 2026: see CLAUDE.md, "Artwork histories".)

Reads, all private in data/histories/:
  artsy/       Artsy's record, shows, sales, fairs and partner locations (fetch_artwork_histories.py)
  parsed/      the provenance, exhibition history and literature Artsy's partners wrote, read into
               events by the parsing workflow and kept only where check_parsed_histories.py passes them
  <source>/    one file per work from each further source (fetch_history_*.py: the National Gallery
               of Art's open data, museum APIs, Wikidata, catalogues raisonnés, scholarship,
               criticism), each {"id", "source", "match", "events"}

and writes, public:
  docs/v2/artworks.json            every work: title, artist, date, picture, where it is last known
                                   to be, how many events and places
  docs/v2/histories/<_id>.json     one work's events in order, merged across sources, each with a
                                   place where one is known, and its sources

Places are Artsy's own coordinates where it has them (shows, fairs, partners), else the museum's
point from museums.json, else the named city geocoded once on Nominatim (cached in
data/histories/geocode.json). Nothing is placed more exactly than its source says.

    python3 scripts/build_artwork_histories.py [--only artsy-id] [--no-geocode]
"""

import argparse
import glob
import json
import re
import sys
import time
import unicodedata
import urllib.parse
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_artwork_histories import filename  # noqa: E402
from check_parsed_histories import problems  # noqa: E402

DATA = ROOT / "data" / "histories"
SAVES = ROOT / "data" / "artsy_saves_raw.json"
MUSEUMS = ROOT / "docs" / "v2" / "museums.json"
OUT = ROOT / "docs" / "v2" / "histories"
INDEX = ROOT / "docs" / "v2" / "artworks.json"
GEOCODE = DATA / "geocode.json"
CDN = "https://d32dm0rphc51dk.cloudfront.net/"
AGENT = {"User-Agent": "Art-Database/1.0 (artist website; github.com/9gn957ptsb-alt/Art-Database)"}
ORDER = {"made": 0, "owned": 1, "held": 1, "exhibited": 2, "offered": 2, "sold": 2, "written": 3, "other": 4}


def norm(t):
    t = unicodedata.normalize("NFKD", str(t or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def tokens(t):
    stop = {"the", "a", "an", "of", "and", "et", "de", "la", "le", "les", "du", "des", "in", "at", "und", "der",
            "die", "das", "il", "di", "e", "y", "el", "exhibition", "exposition", "ausstellung", "mostra"}
    return {w for w in norm(t).split() if w not in stop and len(w) > 1}


def alike(a, b, at=0.5):
    ta, tb = tokens(a), tokens(b)
    return bool(ta and tb) and len(ta & tb) / min(len(ta), len(tb)) >= at


def year(v):
    m = re.match(r"(\d{4})", str(v or ""))
    return m.group(1) if m else ""


def day(v):
    """An Artsy timestamp as a date (YYYY-MM-DD)."""
    m = re.match(r"(\d{4}-\d\d-\d\d)", str(v or ""))
    return m.group(1) if m else ""


# ---- places ----------------------------------------------------------------------------------------

class Places:
    """Coordinates for a named place, cached: Nominatim once per name, politely."""

    def __init__(self, online=True):
        self.cache = json.loads(GEOCODE.read_text()) if GEOCODE.exists() else {}
        self.online = online
        self.museums = {}
        if MUSEUMS.exists():
            for m in json.loads(MUSEUMS.read_text()).get("museums", []):
                self.museums[norm(m["name"])] = (m["lat"], m["lon"], m.get("where") or "")
        self.dirty = 0

    def museum(self, name):
        n = norm(name)
        if not n:
            return None
        if n in self.museums:
            return self.museums[n]
        for k, v in self.museums.items():             # "Musée du Louvre" in "Musée du Louvre, Paris"
            if len(k) > 8 and (k in n or n in k):
                return v
        return None

    def city(self, city, country=""):
        key = f"{city}|{country}".lower()
        if key in self.cache:
            return self.cache[key]
        if not self.online or not city:
            return None
        q = {"q": city, "format": "jsonv2", "limit": 1, "addressdetails": 1, "featureType": "settlement"}
        if country:
            q["countrycodes"] = country.lower()
        time.sleep(1.1)
        try:
            r = requests.get("https://nominatim.openstreetmap.org/search?" + urllib.parse.urlencode(q),
                             headers=AGENT, timeout=60).json()
        except Exception:
            return None
        hit = None
        if r:
            a = r[0].get("address") or {}
            name = a.get("city") or a.get("town") or a.get("village") or a.get("municipality") or city
            hit = [round(float(r[0]["lat"]), 4), round(float(r[0]["lon"]), 4),
                   ", ".join(x for x in (name, (a.get("country_code") or "").upper()) if x)]
        self.cache[key] = hit
        self.dirty += 1
        if self.dirty % 25 == 0:
            self.save()
        return hit

    def save(self):
        GEOCODE.parent.mkdir(parents=True, exist_ok=True)
        GEOCODE.write_text(json.dumps(self.cache, ensure_ascii=False, indent=0))


def artsy_place(place):
    """An Artsy location as (lat, lon, "City, CC"), or None."""
    if not place:
        return None
    c = place.get("coordinates") or {}
    where = ", ".join(x.strip() for x in (place.get("city"), place.get("country")) if x and x.strip())
    if c.get("lat") is not None and c.get("lng") is not None:
        return (round(c["lat"], 4), round(c["lng"], 4), where)
    return (None, None, where) if where else None


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
                    "place": artsy_place(s.get("place")), "src": [src], "field": "artsy show"})
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
                    "place": artsy_place(s.get("place")), "src": [src], "field": "artsy sale"})
    if partner.get("name"):
        pp = DATA / "artsy" / "partners" / filename(partner["id"]) if partner.get("id") else None
        locs = json.loads(pp.read_text()).get("locations") if pp and pp.exists() else []
        kind = "held" if partner.get("type") == "Institution" else "offered"
        out.append({"kind": kind, "start": day(saved.get("published_at")), "who": partner["name"],
                    "note": {"Gallery": "listed by the gallery", "Auction": "listed by the auction house"}
                    .get(partner.get("type"), "listed"),
                    "place": artsy_place(next((l for l in locs or [] if l), None)), "src": [src],
                    "field": "artsy listing"})
    ci = (w.get("collecting_institution") or "").strip()
    if ci:
        m = re.match(r'^[“"](.+?)[”"]\s+at\s+(.+?)(?:\s*\((\d{4})(?:\s*[-–]\s*(\d{4}))?\))?\s*$', ci)
        if m:                                         # an exhibition credit: "Title" at Venue, City (2015)
            out.append({"kind": "exhibited", "title": m.group(1), "venue": m.group(2), "start": m.group(3) or "",
                        "end": m.group(4) or "", "text": ci, "src": [src], "field": "collecting_institution"})
        elif not re.search(r"private collection", ci, re.I):
            out.append({"kind": "held", "who": ci, "text": ci, "src": [src], "field": "collecting_institution"})
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
    """(lat, lon, where) for an event, as exactly as its source allows."""
    if ev.get("place"):
        lat, lon, where = ev["place"]
        if lat is None and where:
            city, _, cc = where.rpartition(", ")
            hit = places.city(city or where, cc if len(cc) == 2 else "")
            return tuple(hit) if hit else None
        return ev["place"]
    m = places.museum(ev.get("venue") or (ev.get("who") if ev.get("kind") == "held" else ""))
    if m:
        return m
    if ev.get("city"):
        hit = places.city(ev["city"], ev.get("country") or "")
        return tuple(hit) if hit else None
    return None


def same(a, b):
    """Two sources telling of one event."""
    if a["kind"] != b["kind"] and {a["kind"], b["kind"]} != {"offered", "sold"}:
        return False
    ya, yb = year(a.get("start")), year(b.get("start"))
    if ya and yb and ya != yb:
        return False
    if a["kind"] in ("owned", "held"):
        return alike(a.get("who"), b.get("who"), 0.6)
    if a["kind"] == "written":
        return bool(ya and yb) and alike(a.get("title") or a.get("text"), b.get("title") or b.get("text"), 0.6)
    if a["kind"] in ("exhibited", "offered", "sold"):
        if not (ya and yb):
            return False
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
        twin["src"] = sorted(set(twin["src"]) | set(ev["src"]))
        for k in ("start", "end", "who", "title", "venue", "city", "country", "publication", "pages", "url", "place"):
            if not twin.get(k) and ev.get(k):
                twin[k] = ev[k]
        if len(ev.get("start") or "") > len(twin.get("start") or "") and year(ev["start"]) == year(twin.get("start")):
            twin["start"] = ev["start"]
    return out


def chronology(events):
    """In time: dated events by their start; an undated one keeps its place in its source's sequence
    (a provenance is written in order), sorting with the event before it."""
    last, keyed = "", []
    for i, ev in enumerate(events):
        y = year(ev.get("start"))
        if y:
            last = y
        keyed.append(((y or last or "9999"), ORDER.get(ev["kind"], 4) if not y else 0, i, ev))
    keyed.sort(key=lambda t: (t[0], t[1], t[2]))
    return [t[3] for t in keyed]


def public(ev, places):
    out = {"k": ev["kind"]}
    for k, short in (("start", "y"), ("end", "e"), ("who", "who"), ("title", "t"), ("venue", "v"),
                     ("publication", "pub"), ("pages", "pg"), ("note", "n"), ("url", "u")):
        v = str(ev.get(k) or "").strip()
        if v:
            out[short] = v
    if ev.get("circa"):
        out["c"] = 1
    if ev.get("text") and ev.get("field") not in ("artsy show", "artsy sale", "artsy listing"):
        out["q"] = ev["text"]
    p = placed(ev, places)
    if p and p[0] is not None:
        out["ll"] = [p[0], p[1]]
    where = (p[2] if p else "") or ", ".join(x for x in (ev.get("city"), ev.get("country")) if x)
    if where:
        out["w"] = where
    out["s"] = ev["src"]
    return out


def build(saved, parsed, places):
    w = json.loads((DATA / "artsy" / "works" / filename(saved["id"])).read_text())
    sources, events = [], artsy_events(w, saved, [])
    sources.append({"name": "Artsy", "url": f"https://www.artsy.net/artwork/{w['id']}"})
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
            events.append(dict(ev, src=[s]))
    events = chronology(merge(events))
    pub = [public(ev, places) for ev in events]
    return w, sources, pub


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--only")
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
        saves = [s for s in saves if s["id"] == args.only]
    OUT.mkdir(parents=True, exist_ok=True)
    index = []
    for n, saved in enumerate(saves):
        w, sources, events = build(saved, parsed, places)
        key = w.get("_id") or saved.get("_id")
        img = (w.get("image") or "").replace(CDN, "").replace("/:version.jpg", "")
        artists = [a["name"] for a in w.get("artists") or [] if a.get("name")]
        last = next((e for e in reversed(events) if e.get("ll")), None)
        record = {"id": key, "slug": w["id"], "title": w.get("title") or "Untitled", "artists": artists,
                  "date": w.get("date") or "", "medium": w.get("medium") or "", "dimensions": (w.get("dimensions") or {}).get("in") if isinstance(w.get("dimensions"), dict) else "",
                  "image": img, "events": events, "sources": sources}
        (OUT / f"{key}.json").write_text(json.dumps(record, ensure_ascii=False, separators=(",", ":")))
        index.append({"id": key, "t": record["title"], "a": ", ".join(artists), "y": record["date"], "i": img,
                      "k": w.get("category") or "", "n": len(events),
                      "p": len({tuple(e["ll"]) for e in events if e.get("ll")}),
                      **({"ll": last["ll"], "w": last.get("w", "")} if last else {})})
        if n % 250 == 0:
            print(f"  {n}/{len(saves)}", flush=True)
    places.save()
    if not args.only:
        INDEX.write_text(json.dumps({"cdn": CDN, "works": index}, ensure_ascii=False, separators=(",", ":")))
    events = sum(i["n"] for i in index)
    print(f"{len(index)} works, {events} events; {sum(1 for i in index if i.get('ll'))} placed on the Earth")


if __name__ == "__main__":
    main()
