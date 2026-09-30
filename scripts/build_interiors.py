#!/usr/bin/env python3
"""Inside the museums: where each museum's saved works hang, and the rooms they hang in.

The walk inside a museum (docs/v2/walk.js, on docs/v2/walk-plan.js) reads one file for each museum
on the globe, docs/v2/interiors/<slug>.json; its format is docs/v2/interiors/INTERIORS.md. The
rooms, doorways, stairs and entrance in it are written by hand from the sources it cites. This
script writes only what the museums' own data gives, in place, and keeps everything else:

  works    every saved work the museum holds — the works museums.json gives it, those whose history
           says it held or listed them, and those its own records match (the National Gallery of
           Art's open data through data/nga/matches.json; the Art Institute, the Met, Cleveland and
           SMK through data/museum_apis_cache/report.json) — each with how the museum's own dated
           record places it, in the record's own words:
             museum     in a room drawn in this file, and sometimes on a wall of it;
             elsewhere  in a room the record names that is not drawn here (another building, a
                        room not drawn yet): listed, never hung;
             off        the record says in so many words that it is not on view;
             none       nothing says; the empty field is reported as what it is ('no location in
                        the NGA's open data'), never read as 'in storage'.
           The places come from the NGA's objects.csv and locations.csv (the room, and the wall as
           N, E, S, W or CENTER); the Met's GalleryNumber; the Art Institute's is_on_view and
           gallery_title; Cleveland's current_location; SMK's on_display and current_location_name
           (fetch_history_museum_apis.py --where reads these); Wikidata's P276 where it names a
           room; and HANGS below, a hand table of what a museum's own page for a work says. A place
           is matched to a room by the room's ref. Sizes are the museum's own measurement where it
           has one (never the framed one), else Artsy's; colours and the picture come from the
           work's history.
  asof     the day it ran.
  sources  the placement sources it cites (their ids end in -where), with the day each was read.

A work whose record now says another place than at the last run — moved, taken down, put up — goes
into that museum's interior log in docs/v2/models/ledger.json. The histories' Artsy slugs come from
the public files, and where one carries none, from the private Artsy records in data/.

  --stubs    every museum in museums.json without a file gets one: its model's shell, entered by
             the rule, no rooms, its works listed with why none hangs.
  --nga      the National Gallery of Art's West Building, both public floors: each public room's
             outline from the NGA's open data (preferred_locations.csv, CC0), put into metres in
             the model's frame (0.44385 m a map pixel, the Rotunda's centre on the model's dome,
             north up), merged by id. It owns each room's outline, id, ref, said, sure and tol, and
             rewrites them; its name, kind and src too, except that a room a hand has closed (or
             made a void) stays so, a name a hand has set to null stays null, and sources a hand
             has added to src are kept after the NGA's. Every other key on a room is the hand's.
  --refresh  read the NGA's open data again (when the copy is more than a day old), and where the
             other museums say each work is now (fetch_history_museum_apis.py --where --refresh),
             before placing the works: the daily run (scripts/update_buildings.py) does.
  --only     one museum.

Downloads go to data/ (private, never committed). It prints each museum's works by how.

    python3 scripts/build_interiors.py [--only slug] [--stubs] [--nga] [--refresh]
"""

import argparse
import csv
import datetime
import json
import re
import subprocess
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs" / "v2"
OUT = DOCS / "interiors"
MODELS = DOCS / "models"
HISTORIES = DOCS / "histories"
ARTSY_WORKS = ROOT / "data" / "histories" / "artsy" / "works"
NGA = ROOT / "data" / "nga"
APIS = ROOT / "data" / "museum_apis_cache"
WIKIDATA = ROOT / "data" / "wikidata"
NGA_BASE = "https://raw.githubusercontent.com/NationalGalleryOfArt/opendata/main/data/"
AGENT = "Art-Database interiors (github.com/9gn957ptsb-alt/Art-Database; NGA open data reader)"

NGA_SLUG = "museum-national-gallery-of-art-washington-dc"
# Each museum API's key in report.json, and the museum on the globe it is.
API_MUSEUM = {"met": "museum-the-metropolitan-museum-of-art", "aic": "museum-art-institute-of-chicago",
              "cma": "museum-cleveland-museum-of-art", "smk": "museum-statens-museum-for-kunst",
              "yuag": "museum-yale-university-art-gallery", "ycba": "museum-yale-center-for-british-art"}

# The placement sources, as the files name them.
WHERE_SOURCES = {
    "nga-where": {"t": "the National Gallery of Art's open data: the room and wall each object is on view in",
                  "u": "https://github.com/NationalGalleryOfArt/opendata", "licence": "CC0-1.0"},
    "met-where": {"t": "the Metropolitan Museum of Art's collection API: each object's gallery",
                  "u": "https://collectionapi.metmuseum.org/public/collection/v1/", "licence": "CC0-1.0"},
    "aic-where": {"t": "the Art Institute of Chicago's API: whether each work is on view, and in which gallery",
                  "u": "https://api.artic.edu/api/v1/", "licence": "CC0-1.0"},
    "cma-where": {"t": "the Cleveland Museum of Art's open access API: each work's current location",
                  "u": "https://openaccess-api.clevelandart.org/", "licence": "CC0-1.0"},
    "smk-where": {"t": "SMK's open API: whether each work is on display, and where",
                  "u": "https://api.smk.dk/api/v1/"},
    "wikidata-where": {"t": "Wikidata: the room each work is located in (P276)",
                       "u": "https://www.wikidata.org/", "licence": "CC0-1.0"},
}

# What a museum's own page for a work says about where it hangs, for museums whose pages a session
# can reach: Artsy work id -> {"museum": slug, "said": the page's words, "room": the room's key,
# "wall": n|e|s|w|centre|None, "url": the page, "read": the day it was read}.
HANGS = {}

# Wikidata's classes for a room of a building (room; room of a museum).
WD_ROOMS = {"Q180516", "Q15206795"}

# The NGA's map outlines: pixels of its floor maps (north up) to metres in the model's frame.
NGA_M = 0.44385            # 537 px of outlines (x 11-548) over the West Building's 238.35 m (782 ft)
NGA_AT = (279, 106)        # the Rotunda's centre, put on the model's dome at 0,0
NGA_FLOORS = {"1-wb-main": ("main", "Main Floor", 3.4), "2-wb-ground": ("ground", "Ground Floor", 0.0)}
# What is outside the building, or no room: the lawn west of it.
NGA_SKIP = {"WBL"}

TODAY = datetime.date.today().isoformat()


# ---------------------------------------------------------------- reading

def read_json(path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return default


def day_of(path):
    """The day a file was written: when what is in it was read."""
    p = Path(path)
    return time.strftime("%Y-%m-%d", time.gmtime(p.stat().st_mtime)) if p.exists() else None


def download(name, refresh=False):
    """One of the NGA's open data files, into data/nga/ (once, or again with --refresh when the copy is
    more than a day old: the NGA publishes about once a day, and objects.csv is 80 MB)."""
    path = NGA / name
    if path.exists() and (not refresh or time.time() - path.stat().st_mtime < 20 * 3600):
        return path
    NGA.mkdir(parents=True, exist_ok=True)
    print(f"  reading {NGA_BASE + name}", flush=True)
    tmp = path.with_suffix(".part")
    try:
        r = requests.get(NGA_BASE + name, headers={"User-Agent": AGENT}, timeout=600, stream=True)
        r.raise_for_status()
        with tmp.open("wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    except requests.RequestException as e:
        # Cut off or refused: the copy already here stands (the .part never replaces it half-read).
        tmp.unlink(missing_ok=True)
        if path.exists():
            print(f"  could not read it again ({e}); the copy of {day_of(path)} stands", flush=True)
            return path
        raise
    tmp.replace(path)
    return path


def histories():
    """Every saved work's public history, by its Artsy id; and the ids by Artsy slug. The museums'
    matches are keyed by slug, and some public histories carry none (179 on 30 Sep 2026), so the
    private Artsy records (data/histories/artsy/works/<slug>.json, each with its _id) fill them in."""
    by_id, by_slug = {}, {}
    for p in HISTORIES.glob("*.json"):
        h = read_json(p)
        if not h or "id" not in h:
            continue
        by_id[h["id"]] = h
        if h.get("slug"):
            by_slug[h["slug"]] = h["id"]
    for p in ARTSY_WORKS.glob("*.json"):
        if p.stem in by_slug:
            continue
        w = read_json(p) or {}
        if w.get("_id") in by_id and w.get("id") and w["id"] != w["_id"]:
            by_slug[w["id"]] = w["_id"]
            if not by_id[w["_id"]].get("slug"):
                by_id[w["_id"]]["slug"] = w["id"]         # in memory only; the public file is not touched
    return by_id, by_slug


# ---------------------------------------------------------------- sizes

NUM = r"(\d+(?:[.,]\d+)?(?:[\s-]+\d+/\d+)?|\d+/\d+)"
UNIT = r"(cm|mm|m|in|inches|\")?\.?"
BY = r"\s*(?:x|×|by)\s*"
MEASURE = re.compile(NUM + r"\s*" + UNIT + BY + NUM + r"\s*" + UNIT + "(?:" + BY + NUM + r"\s*" + UNIT + ")?", re.I)
LONE_UNIT = re.compile(r"(?:^|[\s\d.])(cm|mm|in|inches)\b", re.I)
LABELLED = re.compile(r"\b(H|W|D)\.?\s*" + NUM + r"\s*(cm|mm|in|inches)\b", re.I)
# One measure alone: a tondo's diameter, a small bronze's greatest extension, a height.
SINGLE = re.compile(r"\b(diameter|diam\.|greatest extension|height)\)?\s*:?\s*" + NUM + r"\s*(cm|mm|in|inches)\b", re.I)


def number(s):
    s = s.replace(",", ".").strip()
    m = re.fullmatch(r"(\d+(?:\.\d+)?)?[\s-]*(?:(\d+)/(\d+))?", s)
    if not m or not (m.group(1) or m.group(2)):
        return None
    return (float(m.group(1)) if m.group(1) else 0) + (int(m.group(2)) / int(m.group(3)) if m.group(2) else 0)


def parse_dims(text):
    """A work's size in cm as [w, h] or [w, h, d], from a statement of it: the first part not labelled
    framed or its mount; inches with their fractions, or cm; height first. The same rule as
    WalkPlan.dims() in the page: '23 5/8 × 31 3/8 in' -> [79.7, 60.0]. One measure alone is read too:
    'overall (diameter): 94.5 cm' -> [94.5, 94.5]; a greatest extension or a height -> [None, h]."""
    if not text:
        return None
    for part in re.split(r"[;\n\r|]+", str(text)):
        m = MEASURE.search(part)
        one = SINGLE.search(part) if not m else None
        if one and not re.search(r"\b(framed|frame|mount|mounted|mat)\b", part[:one.start()], re.I):
            v = number(one.group(2))
            if v:
                v = round(v * {"cm": 1, "mm": 0.1}.get(one.group(3).lower(), 2.54), 1)
                return [v, v] if one.group(1).lower().startswith("diam") else [None, v]
        if m and not re.search(r"\b(framed|frame|mount|mounted|mat)\b", part[:m.start()], re.I):
            unit = (m.group(6) or m.group(4) or m.group(2) or "").lower()
            if not unit:
                lone = LONE_UNIT.search(part[m.start():])
                unit = lone.group(1).lower() if lone else ""
            if not unit:
                continue
            k = {"cm": 1, "mm": 0.1, "m": 100}.get(unit, 2.54)
            h, w = number(m.group(1)), number(m.group(3))
            d = number(m.group(5)) if m.group(5) else None
            if not h or not w:
                continue
            out = [round(w * k, 1), round(h * k, 1)]
            if d:
                out.append(round(d * k, 1))
            return out
        # 'H. 46 in. (117 cm); W. 24 in. (61 cm); D. 16 1/2 in. (42 cm)', one measure a part
    got = {}
    for m in LABELLED.finditer(str(text)):
        k = {"cm": 1, "mm": 0.1}.get(m.group(3).lower(), 2.54)
        v = number(m.group(2))
        if v and m.group(1).upper() not in got:
            got[m.group(1).upper()] = round(v * k, 1)
    if got.get("H") and got.get("W"):
        return [got["W"], got["H"]] + ([got["D"]] if got.get("D") else [])
    return None


# ---------------------------------------------------------------- the file

KEY_ORDER = ["slug", "v", "building", "grid", "sources", "from", "enter", "floors", "pins", "notes",
             "works", "asof", "tier"]
FLOOR_ORDER = ["id", "name", "z", "sure", "src", "note", "rooms", "open", "things", "stairs", "lifts"]


def dumps(x):
    # Tight within a line: a museum of 181 rooms and 189 works has to stay under 96 KB.
    return json.dumps(x, ensure_ascii=False, separators=(",", ":"))


def write(path, doc):
    """The file in a stable layout: one source, room, opening or work a line."""
    keys = [k for k in KEY_ORDER if k in doc] + [k for k in doc if k not in KEY_ORDER]
    parts = []
    for k in keys:
        v = doc[k]
        if k in ("sources", "works") and isinstance(v, list) and v:
            parts.append(f'"{k}": [\n  ' + ",\n  ".join(dumps(x) for x in v) + "]")
        elif k == "floors" and isinstance(v, list) and v:
            fl = []
            for f in v:
                fkeys = [x for x in FLOOR_ORDER if x in f] + [x for x in f if x not in FLOOR_ORDER]
                bits = []
                for fk in fkeys:
                    fv = f[fk]
                    if fk in ("rooms", "open", "things", "stairs", "lifts") and isinstance(fv, list) and fv:
                        bits.append(f'"{fk}": [\n   ' + ",\n   ".join(dumps(x) for x in fv) + "]")
                    else:
                        bits.append(f'"{fk}": ' + dumps(fv))
                fl.append("{" + ",\n  ".join(bits) + "}")
            parts.append('"floors": [\n  ' + ",\n  ".join(fl) + "]")
        else:
            parts.append(f'"{k}": ' + dumps(v))
    text = "{" + ",\n ".join(parts) + "}\n"
    json.loads(text)                     # it must read back
    path.write_text(text, encoding="utf-8")
    return len(text.encode("utf-8"))


def cell_for(model):
    """The grid's cell: 0.5 m, a quarter for a small building, a metre past 300 m."""
    site = max((model or {}).get("site") or [60, 60])
    return 1.0 if site > 300 else 0.25 if site <= 40 else 0.5


def stub(m, model):
    return {"slug": m["slug"], "v": 1, "grid": {"cell": cell_for(model), "turn": 0},
            "sources": [{"id": "model", "t": "this museum's exterior model",
                         "u": f"models/{m['slug']}.json", "read": TODAY}],
            "enter": None, "floors": None, "pins": {},
            "notes": "Nothing published about its rooms has been read yet.",
            "works": [], "asof": TODAY, "tier": "shell"}


# ---------------------------------------------------------------- which works

def held_index(hist):
    """Each museum's works whose history says it held or listed them."""
    out = {}
    for hid, h in hist.items():
        for e in h.get("events") or []:
            if e.get("k") in ("held", "listed") and e.get("m"):
                ids = out.setdefault(e["m"], [])
                if hid not in ids:
                    ids.append(hid)
    return out


def held_works(m, hist, held_by, by_slug, nga_matches, api_matches):
    """The saved works a museum holds, museums.json's first (most recently saved first), then the
    rest by date."""
    ids = [w["id"] for w in m.get("works") or []]
    seen = set(ids)
    more = []
    for hid in held_by.get(m["slug"], []):
        if hid not in seen:
            more.append(hid)
            seen.add(hid)
    if m["slug"] == NGA_SLUG:
        for s in nga_matches:
            hid = by_slug.get(s)
            if hid and hid not in seen:
                more.append(hid)
                seen.add(hid)
    for s, mus in api_matches.items():
        hid = by_slug.get(s)
        if API_MUSEUM.get(mus) == m["slug"] and hid and hid not in seen:
            more.append(hid)
            seen.add(hid)
    more.sort(key=lambda i: (str(hist.get(i, {}).get("date") or ""), i))
    return ids + more


# ---------------------------------------------------------------- where the records put them

class NGAData:
    """The NGA's own record of where each of its objects is."""

    def __init__(self, refresh):
        self.ok = False
        try:
            objects = download("objects.csv", refresh)
            locations = download("locations.csv", refresh)
        except requests.RequestException as e:
            print(f"  the NGA's open data could not be read: {e}", flush=True)
            return
        self.read = day_of(objects)
        matches = read_json(NGA / "matches.json", {}) or {}
        self.record = {m["id"]: m["record"] for m in matches.get("matched") or []}
        want = set(self.record.values())
        csv.field_size_limit(1 << 30)
        self.objects = {}
        with objects.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row["objectid"] in want:
                    self.objects[row["objectid"]] = {k: row[k] for k in ("locationid", "dimensions", "classification",
                                                                         "medium", "title")}
        self.locations = {}
        with locations.open(newline="", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                self.locations[row["locationid"]] = row
        self.ok = True

    def place(self, artsy_slug):
        oid = self.record.get(artsy_slug)
        if not oid or oid not in self.objects:
            return None
        o = self.objects[oid]
        ref = {"museum": "nga", "object": oid}
        if not o["locationid"]:
            return {"how": "none", "said": "no location in the NGA's open data", "src": "nga-where",
                    "asof": self.read, "ref": ref, **self.extra(o)}
        loc = self.locations.get(o["locationid"])
        if not loc:
            return {"how": "none", "said": f"location {o['locationid']} is not in the NGA's locations",
                    "src": "nga-where", "asof": self.read, "ref": ref, **self.extra(o)}
        pos = (loc.get("unitposition") or "").strip()
        said = loc["description"] + (" · " + pos if pos else "")
        wall = {"N": "n", "E": "e", "S": "s", "W": "w"}.get(pos.upper()) if pos else None
        if pos and not wall:
            wall = "centre"               # CENTER, a baffle, the fountain: at the room's middle
        return {"how": "room", "site": loc.get("site") or "", "keys": [loc.get("room") or "", loc["description"]],
                "wall": wall, "said": said, "src": "nga-where", "asof": self.read, "ref": ref, **self.extra(o)}

    @staticmethod
    def extra(o):
        cm = parse_dims((o.get("dimensions") or "").split("\n")[0]) or parse_dims(o.get("dimensions"))
        out = {"cm": cm, "cmsrc": "nga" if cm else None}
        one = SINGLE.search(o.get("dimensions") or "")
        if cm and one and (cm[0] is None or cm[0] == cm[1]):
            k = one.group(1).lower()
            out["cmk"] = "diameter" if k.startswith("diam") else k
        if o.get("classification") == "Sculpture":
            out["free"] = True
        return out


def api_place(v):
    """Where the Art Institute, the Met, Cleveland or SMK says a work is now (where.json's entry)."""
    mus, wh, rec = v["museum"], v.get("where") or {}, str(v["record"])
    src = mus + "-where"
    ref = {"museum": mus, "object": rec}
    cm = v.get("cm") or parse_dims(v.get("dims"))
    base = {"src": src, "asof": v.get("read") or TODAY, "ref": ref, "cm": cm, "cmsrc": mus if cm else None}
    if (v.get("kind") or "").lower() == "sculpture":
        base["free"] = True
    if mus == "met":
        g = str(wh.get("GalleryNumber") or "").strip()
        if not g:
            return {"how": "none", "said": "no gallery in the Met's record", **base}
        # The Met's field is a bare number: said in plain words, the field as it came kept in ref.
        base["ref"] = dict(ref, field="GalleryNumber: " + g)
        return {"how": "room", "keys": [g, "Gallery " + g], "wall": None, "said": "Gallery " + g + ", in the Met's record",
                **base}
    if mus == "aic":
        if wh.get("is_on_view") is False:
            base["ref"] = dict(ref, field="is_on_view: false")
            return {"how": "off", "said": "not on view, in the Art Institute's record", **base}
        t = (wh.get("gallery_title") or "").strip()
        if not t:
            return {"how": "none", "said": "no gallery in the Art Institute's record", **base}
        num = re.sub(r"^Gallery\s+", "", t)
        return {"how": "room", "keys": [t, num, str(wh.get("gallery_id") or "")], "wall": None, "said": t, **base}
    if mus == "cma":
        loc = (wh.get("current_location") or "").strip()
        if not loc:
            return {"how": "none", "said": "no current location in Cleveland's record", **base}
        return {"how": "room", "keys": [loc, loc.split(" ")[0]], "wall": None, "said": loc, **base}
    if mus == "smk":
        if wh.get("on_display") is False:
            base["ref"] = dict(ref, field="on_display: false")
            return {"how": "off", "said": "not on display, in SMK's record", **base}
        loc = (wh.get("current_location_name") or "").strip()
        if not loc:
            return {"how": "none", "said": "no location in SMK's record", **base}
        return {"how": "room", "keys": [loc], "wall": None, "said": loc, **base}
    return None


class Wikidata:
    """Wikidata's P276 for a saved work, where it names a room."""

    def __init__(self):
        self.item = {m["id"]: m["item"] for m in (read_json(WIKIDATA / "matches.json", {}) or {}).get("matched") or []}
        self.facts = read_json(WIKIDATA / "facts.json", {}) or {}

    def place(self, artsy_slug):
        q = self.item.get(artsy_slug)
        path = WIKIDATA / "entities" / f"{q}.json" if q else None
        e = read_json(path) if path else None
        if not e:
            return None
        e = (e.get("entities") or {}).get(q, e)
        for s in (e.get("claims") or {}).get("P276") or []:
            v = ((s.get("mainsnak") or {}).get("datavalue") or {}).get("value")
            room = v.get("id") if isinstance(v, dict) else None
            f = self.facts.get(room) or {}
            if not room or not WD_ROOMS & set((f.get("p") or {}).get("P31") or []):
                continue
            label = (f.get("labels") or {}).get("en") or room
            return {"how": "room", "keys": [room, label], "wall": None, "said": label, "src": "wikidata-where",
                    "asof": day_of(path), "ref": {"museum": "wikidata", "object": q, "room": room}}
        return None


# ---------------------------------------------------------------- the works pass

def norm(s):
    return " ".join(str(s or "").lower().split())


def room_index(doc):
    """Every key a drawn room is known by, to its id and building."""
    out = {}
    for f in doc.get("floors") or []:
        for r in f.get("rooms") or []:
            for k in [r.get("id")] + list(r.get("ref") or []):
                if k:
                    out.setdefault(norm(k), r["id"])
    return out


def place_works(m, doc, hist, held_by, by_slug, nga, where, wd, nga_matches, api_matches):
    ids = held_works(m, hist, held_by, by_slug, nga_matches, api_matches)
    rooms = room_index(doc)
    building = doc.get("building")
    out, cited, objects = [], {}, {}
    # A record that could not be read today: the placements it gave at the last run stand.
    was = {w["id"]: w for w in doc.get("works") or []}
    unread = {"nga-where"} if m["slug"] == NGA_SLUG and not (nga and nga.ok) else set()
    for hid in ids:
        h = hist.get(hid) or {}
        s = h.get("slug")
        p = None
        old = was.get(hid)
        if old and old.get("src") in unread:
            w = dict(old)
            prev = next((x for x in doc.get("sources") or [] if x.get("id") == old["src"]), None)
            if prev:
                cited[old["src"]] = prev
            key = ((w.get("ref") or {}).get("museum"), (w.get("ref") or {}).get("object"))
            w.pop("same", None)
            if w.get("ref"):
                if key in objects:
                    w["same"] = objects[key]
                else:
                    objects[key] = hid
            out.append(w)
            continue
        if m["slug"] == NGA_SLUG and nga and nga.ok and s:
            p = nga.place(s)
        if not p and s in where and API_MUSEUM.get(where[s]["museum"]) == m["slug"]:
            p = api_place(where[s])
        if (not p or p["how"] == "none") and s:
            p = wd.place(s) or p
        hand = HANGS.get(hid)
        if hand and hand.get("museum") == m["slug"] and (not p or p["how"] == "none"):
            sid = "page-" + hid[:8]
            cited[sid] = {"id": sid, "t": m["name"] + "'s own page for the work", "u": hand["url"],
                          "read": hand["read"]}
            p = {"how": "room", "keys": [hand["room"]], "wall": hand.get("wall"), "said": hand["said"],
                 "src": sid, "asof": hand["read"]}
        if not p:
            p = {"how": "none", "said": "where it hangs has not been read yet", "src": None, "asof": TODAY}
        w = {"id": hid}
        if p["how"] == "room":
            rid = None
            other_building = building and p.get("site") and p["site"] != building
            if not other_building:
                for k in p.get("keys") or []:
                    if norm(k) in rooms:
                        rid = rooms[norm(k)]
                        break
            if rid:
                w.update({"how": "museum", "room": rid, "wall": p.get("wall")})
            else:
                w["how"] = "elsewhere"
        else:
            w["how"] = p["how"]
        w.update({"said": p["said"], "src": p["src"], "asof": p["asof"]})
        if p.get("ref"):
            w["ref"] = p["ref"]
            # Two saved works that are one object of the museum's hang once, and are listed once, as the
            # first, whatever their record says of it.
            key = (p["ref"].get("museum"), p["ref"].get("object"))
            if key in objects:
                w["same"] = objects[key]
            else:
                objects[key] = hid
        if w["how"] in ("museum", "elsewhere"):
            cm = p.get("cm")
            cmsrc = p.get("cmsrc")
            if not cm:
                cm = parse_dims(h.get("dimensions"))
                cmsrc = "artsy" if cm else None
            w.update({"t": h.get("title") or "", "a": ", ".join(h.get("artists") or []), "y": h.get("date") or "",
                      "m": h.get("medium") or "", "i": h.get("image") or "", "c": h.get("c") or [],
                      "cm": cm, "cmsrc": cmsrc})
            if p.get("free"):
                w["free"] = True
            if p.get("cmk") and cmsrc == p.get("cmsrc"):
                w["cmk"] = p["cmk"]
        if w.get("src") and w["src"] in WHERE_SOURCES:
            read = cited.get(w["src"], {}).get("read")
            cited[w["src"]] = dict({"id": w["src"]}, **WHERE_SOURCES[w["src"]],
                                   read=max(filter(None, [read, w["asof"]])) if (read or w["asof"]) else TODAY)
        out.append(w)
    # The sources the placements cite, in place of the ones they cited before.
    sources = [s for s in doc.get("sources") or []
               if not (s.get("id", "").endswith("-where") or s.get("id", "").startswith("page-"))]
    sources += [cited[k] for k in sorted(cited)]
    return out, sources


# ---------------------------------------------------------------- the NGA's rooms

def nga_kind(desc):
    d = desc.lower()
    for word, kind in (("rotunda", "rotunda"), ("garden court", "court"), ("sculpture hall", "hall"),
                       ("stair", "stair"), ("escalator", "lobby"), ("elevator", "lobby"), ("lobby", "lobby"),
                       ("hallway", "hall"), ("cafe", "cafe"), ("shop", "shop"), ("information", "lobby"),
                       ("gallery", "gallery"), ("room", "gallery")):
        if word in d:
            return kind
    return "gallery"


def nga_name(desc):
    """The room's name, as the NGA's own description gives it."""
    if " - " in desc:
        return desc.split(" - ", 1)[1].strip()
    return re.sub(r"^West (Main|Ground) Floor\s+", "", desc).strip()


def nga_shape(kind, coords):
    """A map outline in pixels to metres in the model's frame."""
    v = [float(x) for x in coords.replace(" ", "").split(",") if x != ""]
    def mx(px):
        return round((px - NGA_AT[0]) * NGA_M, 2)
    def my(py):
        return round((py - NGA_AT[1]) * NGA_M, 2)
    if kind == "rect" and len(v) == 4:
        x0, x1 = sorted((v[0], v[2]))
        y0, y1 = sorted((v[1], v[3]))
        # The sides from the rounded corners, so rooms that share a side share it exactly.
        return {"rect": [mx(x0), my(y0), round(mx(x1) - mx(x0), 2), round(my(y1) - my(y0), 2)]}, ("rect", x0, y0, x1, y1)
    if kind == "circle" and len(v) == 3:
        return {"circle": [mx(v[0]), my(v[1]), round(v[2] * NGA_M, 2)]}, ("circle", v[0], v[1], v[2])
    if kind == "poly" and len(v) >= 6:
        pts = [(v[i], v[i + 1]) for i in range(0, len(v) - 1, 2)]
        if len(pts) > 2 and pts[0] == pts[-1]:
            pts = pts[:-1]
        dedup = [p for i, p in enumerate(pts) if p != pts[i - 1]]
        return {"poly": [[mx(x), my(y)] for x, y in dedup]}, ("poly",) + tuple(x for p in dedup for x in p)
    return None, None


def nga_rooms():
    """Both West Building floors' public rooms, from the NGA's own outlines."""
    pref = download("preferred_locations.csv")
    locs = {}
    with download("locations.csv").open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            locs.setdefault(row["room"], []).append(row["description"])
    used = set(locs)
    rows = []
    with pref.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["locationtype"] != "room" or row["partof"] not in NGA_FLOORS or row["locationkey"] in NGA_SKIP:
                continue
            shape, key = nga_shape(row["mapshapetype"], row["mapshapecoords"] or "")
            if not shape:
                continue
            rows.append({"key": row["locationkey"], "desc": row["description"], "floor": NGA_FLOORS[row["partof"]][0],
                         "shape": shape, "sig": key})
    notes = []
    out = {}
    for fid in ("main", "ground"):
        mine = [r for r in rows if r["floor"] == fid]
        # One outline under several keys is one room, known by all of them.
        groups = {}
        for r in mine:
            groups.setdefault(r["sig"], []).append(r)
        rooms = []
        for sig, g in groups.items():
            g.sort(key=lambda r: r["key"])
            rooms.append({"keys": [r["key"] for r in g], "descs": [r["desc"] for r in g], "sig": sig,
                          "shape": dict(g[0]["shape"])})
        # A room drawn with its parts (Gallery 73 and 73A, 73B): the parts where the NGA places
        # objects in them, else the whole.
        def inside(a, b):              # a within b, a pixel's slack
            if a["sig"][0] != "rect" or b["sig"][0] != "rect" or a is b:
                return False
            _, ax0, ay0, ax1, ay1 = a["sig"]
            _, bx0, by0, bx1, by1 = b["sig"]
            return ax0 >= bx0 - 1 and ay0 >= by0 - 1 and ax1 <= bx1 + 1 and ay1 <= by1 + 1 and \
                (ax1 - ax0) * (ay1 - ay0) < 0.9 * (bx1 - bx0) * (by1 - by0)
        drop = set()
        for whole in rooms:
            parts = [r for r in rooms if inside(r, whole)]
            if len(parts) < 2:
                continue
            if any(k in used for p in parts for k in p["keys"]):
                drop.add(id(whole))
                notes.append(f"{'/'.join(whole['keys'])} is drawn as its parts {', '.join(p['keys'][0] for p in parts)}")
            else:
                for p in parts:
                    drop.add(id(p))
                    whole["keys"] += p["keys"]
                    whole["descs"] += p["descs"]
                notes.append(f"{whole['keys'][0]} is drawn whole; its parts are not used by the NGA's placements")
        rooms = [r for r in rooms if id(r) not in drop]
        # Outlines that overlap by a pixel or two are parted down the middle.
        for a in rooms:
            for b in rooms:
                if a is b or a["sig"][0] != "rect" or b["sig"][0] != "rect":
                    continue
                _, ax0, ay0, ax1, ay1 = a["sig"]
                _, bx0, by0, bx1, by1 = b["sig"]
                ox, oy = min(ax1, bx1) - max(ax0, bx0), min(ay1, by1) - max(ay0, by0)
                if ox <= 0 or oy <= 0:
                    continue
                if ox <= 2 and ox < oy and ax0 < bx0:
                    mid = (max(ax0, bx0) + min(ax1, bx1)) / 2
                    a["sig"] = ("rect", ax0, ay0, mid, ay1)
                    b["sig"] = ("rect", mid, by0, bx1, by1)
                elif oy <= 2 and oy < ox and ay0 < by0:
                    mid = (max(ay0, by0) + min(ay1, by1)) / 2
                    a["sig"] = ("rect", ax0, ay0, ax1, mid)
                    b["sig"] = ("rect", bx0, mid, bx1, by1)
                else:
                    continue
                for r in (a, b):
                    _, x0, y0, x1, y1 = r["sig"]
                    r["shape"] = nga_shape("rect", f"{x0},{y0},{x1},{y1}")[0]
                    r["parted"] = True
        made = []
        for r in rooms:
            key = r["keys"][0]
            refs = []
            for k in r["keys"]:
                refs.append(k)
                refs += locs.get(k, [])
            refs = list(dict.fromkeys(refs))
            room = {"id": key, "ref": refs, "name": nga_name(r["descs"][0]), "said": r["descs"][0],
                    "kind": nga_kind(r["descs"][0]), **r["shape"], "sure": "documented",
                    "src": ["nga-rooms", "length"], "tol": 1.0}
            made.append(room)
        made.sort(key=lambda r: r["id"])
        out[fid] = made
    return out, notes


def merge_nga(doc, model):
    rooms, notes = nga_rooms()
    doc.setdefault("building", "West Building")
    srcs = {s["id"]: s for s in doc.get("sources") or []}
    srcs["nga-rooms"] = {"id": "nga-rooms", "t": "the National Gallery of Art's open data: each public room's "
                         "outline on its floor maps", "u": "https://github.com/NationalGalleryOfArt/opendata",
                         "licence": "CC0-1.0", "read": day_of(NGA / "preferred_locations.csv") or TODAY}
    srcs.setdefault("length", {"id": "length", "t": "the West Building's published length, 782 ft (the model's "
                               "sources)", "read": "2026-09-24"})
    srcs.setdefault("model", {"id": "model", "t": "this museum's exterior model", "u": f"models/{NGA_SLUG}.json",
                              "read": TODAY})
    order = ["model", "nga-rooms", "length"]
    doc["sources"] = [srcs[k] for k in order if k in srcs] + [s for k, s in srcs.items() if k not in order]
    doc["from"] = {"nga-rooms": {"px": list(NGA_AT), "m": NGA_M, "turn": 0,
                                 "why": "map pixels, north up; 537 px of outlines (x 11-548) over the 238.35 m "
                                        "(782 ft) length; the Rotunda's centre on the model's dome"}}
    floors = {f["id"]: f for f in doc.get("floors") or []}
    for key, (fid, name, z) in NGA_FLOORS.items():
        f = floors.get(fid) or {"id": fid, "name": name, "z": z, "sure": "reconstructed", "src": ["model"],
                                "rooms": [], "open": [], "things": [], "stairs": [], "lifts": []}
        floors[fid] = f
        # Machine fields rewritten, hand fields kept; rooms by hand (their src has no nga-rooms) stay.
        old = {r["id"]: r for r in f.get("rooms") or []}
        kept = [r for r in f.get("rooms") or [] if "nga-rooms" not in (r.get("src") or [])]
        new = []
        for r in rooms[fid]:
            was = old.get(r["id"]) or {}
            hand = {k: v for k, v in was.items() if k not in ("id", "ref", "name", "said", "kind", "rect", "poly",
                                                               "circle", "sure", "src", "tol", "px")}
            if "nga-rooms" not in (was.get("src") or ["nga-rooms"]):
                continue                    # a room of that id written by hand: it stands
            room = dict(r, **hand)
            # What a hand may say over the NGA's own words: a room closed to visitors (or a void) is
            # never opened again; a source added to its src stays; a name taken back to null stays.
            if was.get("kind") in ("closed", "void"):
                room["kind"] = was["kind"]
            room["src"] = r["src"] + [x for x in was.get("src") or [] if x not in r["src"]]
            if "name" in was and was["name"] is None:
                room["name"] = None
            new.append(room)
        f["rooms"] = kept + new
    doc["floors"] = [floors[k] for k in ("main", "ground")] + [f for k, f in floors.items() if k not in ("main", "ground")]
    print(f"  NGA: {len(rooms['main'])} rooms on the Main Floor, {len(rooms['ground'])} on the Ground Floor", flush=True)
    for n in notes:
        print("   ", n, flush=True)
    return doc


# ---------------------------------------------------------------- what moved

PLACED = ("museum", "elsewhere")


def moves(old, new):
    """The works a museum has rehung since the last run, as lines for its interior log in the ledger:
    a work whose record now says another place, one taken down, one put up. A room newly drawn is not a
    move: the record's words are the same."""
    was = {w["id"]: w for w in old or []}
    out = []
    for w in new:
        o = was.get(w["id"])
        if not o or o.get("src") != w.get("src"):
            continue
        name = w.get("t") or o.get("t") or w["id"]
        if o["how"] in PLACED and w["how"] in PLACED and o.get("said") != w.get("said"):
            out.append(f"moved: {name}, from {o.get('said')} to {w.get('said')}")
        elif o["how"] in PLACED and w["how"] not in PLACED:
            out.append(f"taken down: {name}, was {o.get('said')}; now {w.get('said')}")
        elif o["how"] not in PLACED and w["how"] in PLACED:
            out.append(f"put up: {name}, {w.get('said')}")
    return out


def log_moves(found):
    """Each museum's moves into its interior's log in docs/v2/models/ledger.json, read just before it is
    written (the daily routine and the checker write there too), in the layout the other scripts use."""
    if not found:
        return
    path = MODELS / "ledger.json"
    ledger = read_json(path)
    if not ledger:
        return
    for slug, lines in found.items():
        entry = ledger.get(slug)
        if not entry:
            continue
        inside = entry.setdefault("interior", {"tier": "shell", "refined": None, "passes": 0, "rooms": {},
                                               "works": {}, "log": []})
        inside.setdefault("log", []).extend(f"{TODAY} {line}" for line in lines)
    path.write_text(json.dumps(ledger, indent=2) + "\n", encoding="utf-8")


# ---------------------------------------------------------------- the run

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", help="one museum's slug")
    ap.add_argument("--stubs", action="store_true", help="a shell file for every museum without one")
    ap.add_argument("--nga", action="store_true", help="the NGA West Building's rooms from its open data")
    ap.add_argument("--refresh", action="store_true", help="read the museums' data again")
    args = ap.parse_args()
    museums = (read_json(DOCS / "museums.json", {}) or {}).get("museums") or []
    if args.only:
        museums = [m for m in museums if m["slug"] == args.only]
        if not museums:
            sys.exit(f"no museum {args.only} in museums.json")
    OUT.mkdir(parents=True, exist_ok=True)
    if args.refresh:
        subprocess.run([sys.executable, str(ROOT / "scripts" / "fetch_history_museum_apis.py"), "--where", "--refresh"],
                       cwd=ROOT, check=False)
    hist, by_slug = histories()
    held_by = held_index(hist)
    where = (read_json(APIS / "where.json", {}) or {}).get("works") or {}
    api_matches = {m["id"]: m["museum"] for m in (read_json(APIS / "report.json", {}) or {}).get("matched") or []}
    nga_matches = [m["id"] for m in (read_json(NGA / "matches.json", {}) or {}).get("matched") or []]
    nga = None
    wd = Wikidata()
    totals = {"museum": 0, "elsewhere": 0, "off": 0, "none": 0}
    made, moved, done = 0, {}, []
    for m in museums:
        path = OUT / f"{m['slug']}.json"
        model = read_json(MODELS / f"{m['slug']}.json")
        doc = read_json(path)
        if doc is None:
            if not (args.stubs or (args.nga and m["slug"] == NGA_SLUG)):
                continue
            doc = stub(m, model)
            made += 1
        if args.nga and m["slug"] == NGA_SLUG:
            doc = merge_nga(doc, model)
        if m["slug"] == NGA_SLUG and nga is None:
            nga = NGAData(args.refresh)
        works, sources = place_works(m, doc, hist, held_by, by_slug, nga, where, wd, nga_matches, api_matches)
        lines = moves(doc.get("works"), works)
        if m["slug"] == NGA_SLUG and not nga.ok:
            lines.append("the NGA's open data could not be read; the placements read before stand")
        if lines:
            moved[m["slug"]] = lines
            for line in lines:
                print(f"    {line}", flush=True)
        done.append((m, path, doc, works, sources))
    # A work one museum's own record places, listed at another museum (the one that listed it on Artsy):
    # said there where it hangs, never left as 'not read'. From this run, else from the files as they are.
    placed = {}
    names = {m["slug"]: m["name"] for m in (read_json(DOCS / "museums.json", {}) or {}).get("museums") or []}
    ran = {m["slug"] for m, *_ in done}
    for f in sorted(OUT.glob("*.json")):
        d = read_json(f) or {}
        if d.get("slug") in ran:
            continue
        srcs = {x.get("id"): x for x in d.get("sources") or []}
        for w in d.get("works") or []:
            if w.get("how") in PLACED and w.get("src") in srcs:
                placed.setdefault(w["id"], (d["slug"], w["said"], srcs[w["src"]], w.get("asof")))
    for m, path, doc, works, sources in done:
        srcs = {x.get("id"): x for x in sources}
        for w in works:
            if w["how"] in PLACED and w.get("src") in srcs:
                placed.setdefault(w["id"], (m["slug"], w["said"], srcs[w["src"]], w.get("asof")))
    for m, path, doc, works, sources in done:
        for w in works:
            got = placed.get(w["id"])
            if w["how"] != "none" or w.get("src") or not got or got[0] == m["slug"]:
                continue
            slug, said, src, asof = got
            w.update({"said": f"at {names.get(slug, slug)}: {said}", "src": src["id"], "asof": asof, "at": slug})
            if not any(x.get("id") == src["id"] for x in sources):
                sources.append(dict(src))
        doc["works"] = works
        doc["sources"] = sources
        doc["asof"] = TODAY
        size = write(path, doc)
        by = {"museum": 0, "elsewhere": 0, "off": 0, "none": 0}
        for w in works:
            by[w["how"]] += 1
            totals[w["how"]] += 1
        line = ", ".join(f"{k} {v}" for k, v in by.items() if v)
        print(f"  {m['slug']}: {len(works)} works ({line}); {size // 1024} KB", flush=True)
    log_moves(moved)
    print(f"{made} new files; works: " + ", ".join(f"{k} {v}" for k, v in totals.items()) +
          (f"; {sum(len(v) for v in moved.values())} moved, put up or taken down" if moved else ""), flush=True)


if __name__ == "__main__":
    main()
