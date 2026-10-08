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
import os
import math
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
               if not (s.get("id", "").endswith(("-where", "-collection")) or s.get("id", "").startswith("page-"))]
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


# ---------------------------------------------------------------- the collection on the walls

# Beside the saved works, each museum whose own open data says where its works hang carries a few hundred
# of its own on-view collection, chosen by its own highlight flags and hung by its own gallery numbers: the
# Met's highlights on view, the Art Institute's boosted ("essentials") works on view and then its other
# works on view, Cleveland's highlights on view, and the National Gallery's paintings and sculpture on view
# in the West Building (its open data has no highlight flag). Read with --collection into
# data/collections/<museum>.json (weekly is enough: the daily run reads them again on Mondays); hung from
# that copy on every run. An image is kept only where the museum says it is open access.
COLLECTIONS = ROOT / "data" / "collections"
COLLECTION_CAP = 300          # works a museum, at most
ROOM_CAP = 6                  # works a room, at most, before the next round
COLLECTION_SOURCES = {
    "met": ("met-collection", "the Metropolitan Museum of Art's collection API: its highlights on view, each with "
            "its gallery", "https://collectionapi.metmuseum.org/public/collection/v1.1/", "CC0-1.0"),
    "aic": ("aic-collection", "the Art Institute of Chicago's API: its works on view, the boosted ('essentials') "
            "first, each with its gallery and label", "https://api.artic.edu/api/v1/artworks",
            "CC0-1.0; descriptions CC BY 4.0"),
    "cma": ("cma-collection", "the Cleveland Museum of Art's open access API: its highlights on view, each with its "
            "current location and wall text", "https://openaccess-api.clevelandart.org/api/artworks/", "CC0-1.0"),
    "nga": ("nga-collection", "the National Gallery of Art's open data: its paintings and sculpture on view in the "
            "West Building, each with its room and wall, and its open-access images",
            "https://github.com/NationalGalleryOfArt/opendata", "CC0-1.0"),
}
COLLECTION_MUSEUM = {"met": "museum-the-metropolitan-museum-of-art", "aic": "museum-art-institute-of-chicago",
                     "cma": "museum-cleveland-museum-of-art", "nga": NGA_SLUG}
DESC_SRC = {"aic": "the Art Institute of Chicago's label", "cma": "the Cleveland Museum of Art's wall text"}


def _get(url, params=None, tries=4):
    for k in range(tries):
        try:
            r = requests.get(url, params=params, headers={"User-Agent": AGENT}, timeout=60)
            if r.status_code == 429 or r.status_code >= 500:
                time.sleep(2 + 3 * k)
                continue
            r.raise_for_status()
            return r.json()
        except (requests.RequestException, ValueError):
            time.sleep(2 + 3 * k)
    return None


def plain(html):
    """A label as words: its paragraphs' text, the markup gone, verbatim otherwise."""
    if not html:
        return None
    t = re.sub(r"</p>\s*<p[^>]*>", "\n\n", str(html))
    t = re.sub(r"<br\s*/?>", "\n", t)
    t = re.sub(r"<[^>]+>", "", t)
    t = t.replace("&nbsp;", " ").replace("&amp;", "&").replace("&quot;", '"').replace("&#39;", "'")
    t = re.sub(r"&#(\d+);", lambda m: chr(int(m.group(1))), t)
    t = re.sub(r"[ \t]+", " ", t)
    return t.strip() or None


def hsl_hex(c):
    """The Art Institute's dominant colour (h 0-360, s and l 0-100) as hex."""
    import colorsys
    if not c or c.get("h") is None:
        return None
    r, g, b = colorsys.hls_to_rgb(c["h"] / 360, c["l"] / 100, c["s"] / 100)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def fetch_met():
    ids, off = [], 0
    while True:
        d = _get("https://collectionapi.metmuseum.org/public/collection/v1.1/search",
                 {"isHighlight": "true", "isOnView": "true", "q": "*", "limit": 100, "offset": off})
        if not d or not d.get("objectIDs"):
            break
        ids += d["objectIDs"]
        off += 100
        if off >= (d.get("total") or 0):
            break
    out = []
    for n, oid in enumerate(ids):
        o = _get(f"https://collectionapi.metmuseum.org/public/collection/v1/objects/{oid}")
        time.sleep(0.08)
        if not o or not str(o.get("GalleryNumber") or "").strip():
            continue
        g = str(o["GalleryNumber"]).strip()
        cm = None
        for ms in o.get("measurements") or []:
            em = ms.get("elementMeasurements") or {}
            if (ms.get("elementName") or "").lower() in ("overall", "") and (em.get("Height") or em.get("Width")):
                cm = [round(em["Width"], 1) if em.get("Width") else None, round(em["Height"], 1) if em.get("Height") else None]
                if em.get("Depth"):
                    cm.append(round(em["Depth"], 1))
                break
        out.append({"object": str(oid), "rank": n, "keys": [g, "Gallery " + g], "wall": None,
                    "said": "Gallery " + g + ", in the Met's record", "field": "GalleryNumber: " + g,
                    "t": o.get("title") or "", "a": o.get("artistDisplayName") or o.get("culture") or "",
                    "y": o.get("objectDate") or "", "m": o.get("medium") or "", "cm": cm or parse_dims(o.get("dimensions")),
                    "img": o.get("primaryImageSmall") if o.get("isPublicDomain") and o.get("primaryImageSmall") else None,
                    "c": None, "desc": None, "credit": o.get("creditLine") or None, "url": o.get("objectURL"),
                    "free": (o.get("classification") or "").lower().startswith("sculpture") or None})
    return out


def fetch_aic():
    fields = ("id,title,gallery_id,gallery_title,is_boosted,image_id,is_public_domain,color,artist_title,"
              "artist_display,date_display,medium_display,dimensions,dimensions_detail,credit_line,description,"
              "classification_title")
    out, seen = [], set()
    for boosted in (True, False):
        flt = [{"term": {"is_on_view": True}}, {"exists": {"field": "gallery_id"}}]
        if boosted:
            flt.append({"term": {"is_boosted": True}})
        page = 1
        while len(out) < 900:
            d = _get("https://api.artic.edu/api/v1/artworks/search",
                     {"params": json.dumps({"query": {"bool": {"filter": flt}}}), "limit": 100, "page": page,
                      "fields": fields})
            if not d or not d.get("data"):
                break
            for o in d["data"]:
                if o["id"] in seen or not o.get("gallery_id"):
                    continue
                seen.add(o["id"])
                cm = parse_dims(o.get("dimensions"))
                for dd in ([] if cm else o.get("dimensions_detail") or []):
                    if (dd.get("height") or dd.get("width")) and not dd.get("clarification"):
                        cm = [dd.get("width"), dd.get("height")] + ([dd["depth"]] if dd.get("depth") else [])
                        break
                t = (o.get("gallery_title") or "").strip()
                out.append({"object": str(o["id"]), "rank": len(out), "boosted": bool(o.get("is_boosted")),
                            "keys": [t, re.sub(r"^Gallery\s+", "", t), str(o["gallery_id"])], "wall": None,
                            "said": t, "field": "gallery_id: " + str(o["gallery_id"]),
                            "t": o.get("title") or "", "a": o.get("artist_title") or (o.get("artist_display") or "").split("\n")[0],
                            "y": o.get("date_display") or "", "m": o.get("medium_display") or "",
                            "cm": cm,
                            "img": (f"https://www.artic.edu/iiif/2/{o['image_id']}/full/843,/0/default.jpg"
                                    if o.get("is_public_domain") and o.get("image_id") else None),
                            "c": [hsl_hex(o.get("color"))] if hsl_hex(o.get("color")) else None,
                            "desc": plain(o.get("description")), "credit": o.get("credit_line") or None,
                            "url": f"https://www.artic.edu/artworks/{o['id']}",
                            "free": (o.get("classification_title") or "").lower() in ("sculpture",) or None})
            if page >= (d.get("pagination") or {}).get("total_pages", 0) or (boosted is False and len(out) >= 900):
                break
            page += 1
            time.sleep(0.3)
    return out


def fetch_cma():
    out, skip = [], 0
    while True:
        d = _get("https://openaccess-api.clevelandart.org/api/artworks/",
                 {"highlight": 1, "currently_on_view": 1, "limit": 100, "skip": skip})
        if not d or not d.get("data"):
            break
        for o in d["data"]:
            loc = (o.get("current_location") or "").strip()
            if not loc:
                continue
            img = ((o.get("images") or {}).get("web") or {}).get("url") if o.get("share_license_status") == "CC0" else None
            cr = o.get("creators") or []
            out.append({"object": str(o["id"]), "rank": len(out), "keys": [loc, loc.split(" ")[0]], "wall": None,
                        "said": loc, "field": "current_location: " + loc, "t": o.get("title") or "",
                        "a": (cr[0].get("description") or "").split(" (")[0] if cr else (o.get("culture") or [""])[0],
                        "y": o.get("creation_date") or "", "m": o.get("technique") or "",
                        "cm": parse_dims(o.get("measurements")), "img": img, "c": None,
                        "desc": plain(o.get("wall_description") or o.get("description")),
                        "credit": o.get("creditline") or None, "url": o.get("url"),
                        "free": (o.get("type") or "").lower() == "sculpture" or None})
        skip += 100
        if skip >= ((d.get("info") or {}).get("total") or 0):
            break
        time.sleep(0.3)
    return out


def fetch_nga():
    """The NGA's paintings and sculpture on view in the West Building, from its open data."""
    objects, locations = download("objects.csv"), download("locations.csv")
    images = download("published_images.csv")
    locs = {}
    with locations.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            locs[row["locationid"]] = row
    csv.field_size_limit(1 << 30)
    pics = {}
    with images.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if row["viewtype"] == "primary" and row["openaccess"] == "1" and row["depictstmsobjectid"]:
                pics.setdefault(row["depictstmsobjectid"], row["iiifurl"])
    out = []
    with objects.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            loc = locs.get(row["locationid"] or "")
            if not loc or loc.get("site") != "West Building":
                continue
            cls = row.get("classification") or ""
            if cls not in ("Painting", "Sculpture"):
                continue
            pos = (loc.get("unitposition") or "").strip()
            wall = {"N": "n", "E": "e", "S": "s", "W": "w"}.get(pos.upper()) if pos else None
            if pos and not wall:
                wall = "centre"
            pic = pics.get(row["objectid"])
            cm = parse_dims((row.get("dimensions") or "").split("\n")[0]) or parse_dims(row.get("dimensions"))
            out.append({"object": row["objectid"], "rank": 0 if cls == "Painting" else 1,
                        "keys": [loc.get("room") or "", loc["description"]], "wall": wall,
                        "said": loc["description"] + (" · " + pos if pos else ""), "field": None,
                        "t": row.get("title") or "", "a": row.get("attribution") or "", "y": row.get("displaydate") or "",
                        "m": row.get("medium") or "", "cm": cm,
                        "img": (pic + "/full/!843,843/0/default.jpg") if pic else None, "c": None, "desc": None,
                        "credit": row.get("creditline") or None,
                        "url": f"https://www.nga.gov/collection/art-object-page.{row['objectid']}.html",
                        "free": cls == "Sculpture" or None})
    # the NGA's own order within a kind: paintings first, then by object id
    out.sort(key=lambda r: (r["rank"], int(r["object"])))
    for n, r in enumerate(out):
        r["rank"] = n
    return out


FETCH = {"met": fetch_met, "aic": fetch_aic, "cma": fetch_cma, "nga": fetch_nga}


def read_collection(mus, refresh):
    """A museum's on-view collection as read, from data/collections/ (read again with refresh)."""
    path = COLLECTIONS / f"{mus}.json"
    have = read_json(path)
    if have and not refresh:
        return have
    print(f"  reading {mus}'s collection on view", flush=True)
    rows = FETCH[mus]()
    if not rows and have:
        print(f"  {mus}: nothing came back; the copy of {have.get('read')} stands", flush=True)
        return have
    COLLECTIONS.mkdir(parents=True, exist_ok=True)
    got = {"read": TODAY, "works": rows}
    path.write_text(json.dumps(got, ensure_ascii=False), encoding="utf-8")
    return got


def collection_works(m, doc, saved, refresh=False):
    """The museum's own on-view works to hang beside the saved ones: those whose gallery is drawn here, at
    most ROOM_CAP a room a round and COLLECTION_CAP in all, in the museum's own order of highlight, spread
    through the rooms; none that is a saved work's object. Returns (works, source) or ([], None)."""
    mus = next((k for k, s in COLLECTION_MUSEUM.items() if s == m["slug"]), None)
    if not mus or not doc.get("floors"):
        return [], None
    got = read_collection(mus, refresh) if (refresh or (COLLECTIONS / f"{mus}.json").exists()) else None
    if not got:
        return [], None
    rooms = room_index(doc)
    closed = {r["id"] for f in doc["floors"] for r in f.get("rooms") or [] if r.get("kind") in ("closed", "void")}
    have = {(w.get("ref") or {}).get("object") for w in saved if (w.get("ref") or {}).get("museum") == mus}
    sid, t, u, lic = COLLECTION_SOURCES[mus]
    per = {}
    for r in sorted(got["works"], key=lambda r: r["rank"]):
        if r["object"] in have:
            continue
        rid = next((rooms[norm(k)] for k in r["keys"] if k and norm(k) in rooms), None)
        if rid and rid not in closed:
            per.setdefault(rid, []).append(r)
    chosen, rnd = [], 0
    while len(chosen) < COLLECTION_CAP and any(per.values()):
        # each round, each room its next few, the rooms in the order of their best work
        for rid in sorted(per, key=lambda k: per[k][0]["rank"] if per[k] else 1e9):
            take, per[rid] = per[rid][:ROOM_CAP if rnd == 0 else 2], per[rid][ROOM_CAP if rnd == 0 else 2:]
            for r in take:
                chosen.append((rid, r))
        rnd += 1
    chosen = chosen[:COLLECTION_CAP]
    out = []
    for rid, r in chosen:
        w = {"id": f"{mus}:{r['object']}", "kind": "collection", "how": "museum", "room": rid, "wall": r["wall"],
             "said": r["said"], "src": sid, "asof": got["read"],
             "ref": {"museum": mus, "object": r["object"], "url": r["url"]},
             "t": r["t"], "a": r["a"], "y": r["y"], "m": r["m"], "cm": r["cm"], "cmsrc": mus if r["cm"] else None,
             "img": r["img"], "c": r["c"], "desc": r["desc"], "descsrc": DESC_SRC.get(mus) if r["desc"] else None,
             "credit": r["credit"]}
        if r.get("field"):
            w["ref"]["field"] = r["field"]
        if r.get("free"):
            w["free"] = True
        out.append(w)
    src = {"id": sid, "t": t, "u": u, "licence": lic, "read": got["read"]}
    return out, src


# ---------------------------------------------------------------- OpenStreetMap's indoor mapping

# osm/indoor/<slug>.json, read on GitHub's runners by scripts/fetch_osm_indoor.py (ODbL): every feature
# in a square round the museum with an indoor, door or entrance tag, its geometry in degrees. With --osm:
#
#   read     each feature put into the model's frame (metres east and south of the museum's point);
#            only what stands within the model's site (and 10 m round it) is read. Its levels from
#            `level` (else `repeat_on`): '2', '0;1', '1-2', '0-2'; untagged is level 0; a level
#            between two (the Louvre's 0.25, an entresol) is not drawn, and said so.
#   rooms    indoor=room|area|corridor outlines (a stair space too, as a hall); a lift shaft
#            (highway=elevator) is a way between floors, not a room. Where two overlap, the room
#            keeps the floor and the area or corridor gives it up; a room that holds two others
#            or more is a wing (its name kept for them, see `wings`), not drawn; what is left of an
#            outline under 4 m² is not drawn. Outlines simplified to 0.2 m. Each room keeps the
#            mapped name, ref and tags (said), reconstructed, anchored on OpenStreetMap's points.
#   doors    door=* or entrance=* nodes within 1.5 m of two rooms of a level: an opening there
#            (its width the node's `width`, else 1.6 m, ours). Entrance nodes by one room on the
#            lowest level drawn: the way in, entrance=main first.
#   between  the lifts and stair spaces OpenStreetMap maps across levels: a lift in the walk on
#            every floor drawn where it lands inside one room.
#
# Then scripts/osm_interiors.js fits it to the model (the page's own compiler): each level's height
# from the model (the storey that gives the most mapped rooms headroom under the model's roof,
# 3.5-7 m, a level that height over the one below), rooms off the model's building dropped, the
# openings that cannot be cut dropped, rooms no door reaches joined by the rule (a doorway at the
# middle of the wall they share with a room already reached, 2.4 m: OpenStreetMap draws the two
# side by side and no door between them — said so, src osm-rule), and the way in. It reports how
# much of the model's floor the mapped rooms cover and how much of them the door reaches.
#
# A museum whose rooms no source gives (a shell, or rooms the site arranged) takes OpenStreetMap's
# plan when it is usable: rooms on at least half the model's floor area on the floors it maps
# (OSM_COVER), and at least two thirds of that area reached from the way in (OSM_REACH). Else
# the rooms stay as they are and the notes say what OpenStreetMap gave. A museum whose own data
# draws its rooms (the NGA, the Met, the Art Institute: OSM_OWN) gets only what joins them: OSM's
# doors between two of its rooms; the lifts OSM maps, where they land in one of its rooms on two
# floors or more; and inside a wing OSM maps as one room ("Alsdorf Galleries", ref 140-143), a
# doorway by the rule between its galleries that share a wall. Everything written here has
# osm-indoor (or osm-rule) in src and a note beginning OSM_MARK, and is rewritten each run.
OSM_INDOOR = ROOT / "osm" / "indoor"
OSM_MARK = "OpenStreetMap's indoor mapping"
OSM_FIT = ROOT / "scripts" / "osm_interiors.js"
R_EARTH = 6371008.8
OSM_COVER = 0.5
OSM_REACH = 2 / 3
OSM_MIN_ROOMS = 6
# The museums whose own data draws the rooms, and which of their floors each OSM level is.
OSM_OWN = {
    "museum-art-institute-of-chicago": {-1: "ll", 1: "f1", 2: "f2", 3: "f3"},
    "museum-the-metropolitan-museum-of-art": {1: "f1", 2: "f2"},
    "museum-national-gallery-of-art-washington-dc": {0: "ground", 1: "main"},
}
OSM_SOURCE = {"id": "osm-indoor", "t": "OpenStreetMap's indoor mapping of the building: its rooms, corridors, "
              "doors, lifts and levels, © OpenStreetMap contributors (ODbL)",
              "u": "https://www.openstreetmap.org/copyright", "licence": "ODbL-1.0"}
OSM_RULE = {"id": "osm-rule", "t": "the site's rule over OpenStreetMap's plan: where it draws two rooms side by side "
            "and no door between them, and one of them has no other way in, a doorway at the middle of the wall "
            "they share, 2.4 m wide; the height of a level from the model"}
ROOM_KIND = {"gallery": "gallery", "exhibition": "gallery", "collection": "gallery", "museum": "gallery",
             "hall": "hall", "corridor": "hall", "auditorium": "hall", "stairs": "hall", "lobby": "lobby",
             "entrance": "lobby", "reception": "lobby", "foyer": "lobby", "shop": "shop", "restaurant": "cafe",
             "cafe": "cafe", "café": "cafe", "bar": "cafe"}
ROOM_CLOSED = {"office", "storage", "technical", "kitchen", "utility", "staff", "private", "toilets", "toilet",
               "restroom", "cloakroom", "workshop", "laboratory", "server", "garage", "parking", "elevator"}


def osm_levels(tags):
    """The levels a feature is on, as numbers: '1', '0;1', '1-2', '0-2', '-1--1', '0.25'. Untagged: 0."""
    v = str(tags.get("level") or tags.get("repeat_on") or "").strip()
    if not v:
        return [0]
    out = []
    for part in v.split(";"):
        part = part.strip()
        m = re.fullmatch(r"(-?\d+(?:\.\d+)?)(?:\s*-\s*(-?\d+(?:\.\d+)?))?", part)
        if not m:
            continue
        a = float(m.group(1))
        if m.group(2) is not None:
            b = float(m.group(2))
            if a == int(a) and b == int(b):
                out += [float(x) for x in range(int(min(a, b)), int(max(a, b)) + 1)]
                continue
            out += [a, b]
        else:
            out.append(a)
    return sorted(set(out))


def osm_floor_id(lv):
    return "L" + str(int(lv)).replace("-", "m")


def osm_said(tags):
    keep = ("indoor", "room", "level", "repeat_on", "ref", "name", "name:en", "stairs", "highway", "access")
    return f"{OSM_MARK}: " + ", ".join(f"{k}={tags[k]}" for k in keep if k in tags)


def osm_kind(t):
    if t.get("access") in ("private", "no"):
        return "closed"
    if t.get("stairs") == "yes" or t.get("indoor") == "stairs":
        return "hall"
    if t.get("indoor") in ("corridor", "area"):
        r = (t.get("room") or "").lower()
        return "closed" if r in ROOM_CLOSED else ROOM_KIND.get(r, "hall")
    r = (t.get("room") or "").lower()
    if r in ROOM_CLOSED:
        return "closed"
    return ROOM_KIND.get(r, "gallery")


def osm_read(m, model):
    """OSM's features within the model's site, in its frame: rooms, doors, entrances and ways between floors."""
    from shapely.geometry import Polygon as SPolygon, box as sbox
    from shapely.validation import make_valid
    data = read_json(OSM_INDOOR / f"{m['slug']}.json")
    if not data or not data.get("features"):
        return None
    lat0, lon0 = m["lat"], m["lon"]
    k = math.cos(lat0 * math.pi / 180)

    def xy(c):
        return ((c[0] - lon0) * math.pi / 180 * R_EARTH * k, -(c[1] - lat0) * math.pi / 180 * R_EARTH)
    site = (model or {}).get("site") or [200, 200]
    hw, hd = site[0] / 2 + 10, (site[1] if len(site) > 1 else site[0]) / 2 + 10
    area_box = sbox(-hw, -hd, hw, hd)
    rooms, doors, lifts, entrances = [], [], [], []
    frac = 0
    for f in data["features"]:
        t, g = f["tags"], f["geometry"]
        levels = osm_levels(t)
        if g["type"] in ("Polygon", "MultiPolygon"):
            parts = [g["coordinates"]] if g["type"] == "Polygon" else g["coordinates"]
            polys = []
            for p in parts:
                ext = [xy(c) for c in p[0]]
                holes = [[xy(c) for c in h] for h in p[1:]]
                if len(ext) < 4:
                    continue
                sp = make_valid(SPolygon(ext, holes))
                for q in getattr(sp, "geoms", [sp]):
                    if q.geom_type == "Polygon" and q.area >= 1 and q.intersects(area_box):
                        polys.append(q)
            if not polys:
                continue
            lift = t.get("highway") == "elevator" or (t.get("room") or "").lower() == "elevator"
            stair = t.get("stairs") == "yes" or t.get("indoor") == "stairs" or (t.get("room") or "").lower() == "stairs"
            if lift or (stair and len([v for v in levels if v == int(v)]) > 1):
                big = max(polys, key=lambda q: q.area)
                c = big.representative_point()
                lifts.append({"id": f["id"], "kind": "lift" if lift else "stair", "x": round(c.x, 2), "y": round(c.y, 2),
                              "levels": levels, "poly": [[round(a, 2), round(b, 2)] for a, b in big.exterior.coords[:-1]]})
            if lift:
                continue
            if t.get("indoor") not in ("room", "area", "corridor", "stairs"):
                continue
            for lv in levels:
                if lv != int(lv):
                    frac += 1
                    continue
                for n, q in enumerate(polys):
                    rooms.append({"f": f, "lv": int(lv), "geom": q, "part": n if len(polys) > 1 else None})
        elif g["type"] == "Point":
            x, y = xy(g["coordinates"])
            if abs(x) > hw or abs(y) > hd:
                continue
            if t.get("highway") == "elevator":
                lifts.append({"id": f["id"], "kind": "lift", "x": round(x, 2), "y": round(y, 2), "levels": levels,
                              "poly": None, "untagged": "level" not in t and "repeat_on" not in t})
                continue
            ent = t.get("entrance")
            door = t.get("door") or (t.get("indoor") == "door" and "yes")
            if ent and ent not in ("emergency", "exit", "no", "service", "staff") and t.get("access") not in ("no", "private"):
                entrances.append({"id": f["id"], "x": x, "y": y, "main": ent == "main",
                                  "levels": levels, "tagged": "level" in t, "name": t.get("name")})
            if door and door != "no" or ent:
                w = None
                try:
                    w = float(str(t.get("width") or "").replace("m", "").strip())
                except ValueError:
                    w = None
                doors.append({"id": f["id"], "x": x, "y": y, "levels": levels, "tagged": "level" in t,
                              "w": w if w and 0.6 <= w <= 6 else None, "closed": t.get("access") in ("no", "private")})
    return {"read": data.get("read"), "rooms": rooms, "doors": doors, "lifts": lifts, "entrances": entrances,
            "frac": frac, "features": len(data["features"])}


def osm_rooms(got):
    """Each level's rooms, cleaned: overlaps given up, wings set aside, holes split. Returns
    ({level: [room spec]}, {level: [part openings]}, wings)."""
    from shapely.geometry import LineString
    from shapely.ops import split, unary_union
    by_lv = {}
    for r in got["rooms"]:
        by_lv.setdefault(r["lv"], []).append(r)
    out, parts, wings = {}, {}, []
    rank = {"room": 0, "stairs": 1, "corridor": 2, "area": 3}
    for lv, rs in sorted(by_lv.items()):
        # A room holding two others or more is a wing: its name is kept for them, it is not drawn.
        keep = []
        for r in rs:
            inside = [o for o in rs if o is not r and o["geom"].area < r["geom"].area * 0.8 and
                      o["geom"].intersection(r["geom"]).area >= 0.8 * o["geom"].area]
            if r["f"]["tags"].get("indoor") == "room" and len(inside) >= 2:
                wings.append({"id": r["f"]["id"], "lv": lv, "tags": r["f"]["tags"], "geom": r["geom"]})
                continue
            keep.append(r)
        keep.sort(key=lambda r: (rank.get(r["f"]["tags"].get("indoor"), 4), r["geom"].area))
        taken = []
        out[lv], parts[lv] = [], []
        for r in keep:
            g = r["geom"].buffer(0)
            if taken:
                g = g.difference(unary_union(taken)).buffer(0)
            pieces = [q for q in getattr(g, "geoms", [g]) if q.geom_type == "Polygon" and q.area >= 4]
            if not pieces:
                continue
            # A piece is kept where it is a fair part of the outline (a corridor cut by rooms keeps its runs).
            pieces = [q for q in pieces if q.area >= 0.08 * r["geom"].area or q.area >= 25]
            # Holes (an outline round a room drawn inside it) are split away: a line through each hole.
            flat = []
            for q in pieces:
                stack = [q]
                while stack:
                    p = stack.pop()
                    if not p.interiors:
                        flat.append(p)
                        continue
                    hx = p.interiors[0].centroid.x
                    b = p.bounds
                    cut = split(p, LineString([(hx, b[1] - 1), (hx, b[3] + 1)]))
                    stack += [c for c in cut.geoms if c.geom_type == "Polygon" and c.area >= 1]
            flat = [p.simplify(0.2, preserve_topology=True) for p in flat if p.area >= 4]
            flat = [p for p in flat if p.geom_type == "Polygon" and p.is_valid and len(p.exterior.coords) >= 4]
            if not flat:
                continue
            taken.append(r["geom"])
            t = r["f"]["tags"]
            fid = r["f"]["id"] + (f"-{r['part']}" if r["part"] is not None else "")
            base = f"O-{fid}" + (f"-{osm_floor_id(lv)}" if len(osm_levels(t)) > 1 else "")
            ref = t.get("ref")
            name = t.get("name:en") or t.get("name") or ref
            ids = []
            for n, p in enumerate(sorted(flat, key=lambda p: -p.area)):
                rid = base + ("" if len(flat) == 1 else "abcdefghijklmnopqrstuvwxyz"[n % 26] * (1 + n // 26))
                ids.append(rid)
                keys = [x for x in (ref, t.get("name"), t.get("name:en")) if x]
                if ref:
                    keys += [f"Gallery {ref}", f"Room {ref}", f"Sal {ref}", f"Salle {ref}", f"Saal {ref}", f"Sala {ref}"]
                out[lv].append({
                    "id": rid, "ref": list(dict.fromkeys(keys)), "name": name, "said": osm_said(t),
                    "kind": osm_kind(t),
                    "poly": [[round(a, 2), round(b, 2)] for a, b in p.exterior.coords[:-1]],
                    "sure": "reconstructed", "src": ["osm-indoor"], "anchor": "osm-indoor", "tol": 1.0,
                    "note": f"{OSM_MARK} ({r['f']['id']})", "_area": round(p.area, 1)})
            for a, b in zip(ids, ids[1:]):
                parts[lv].append((a, b))
    return out, parts, wings


def osm_turn(rooms):
    """The grid turned to the outlines' commonest direction, in (-45, 45]."""
    from collections import Counter
    turns = Counter()
    for r in rooms:
        poly = r["poly"]
        for (x0, y0), (x1, y1) in zip(poly, poly[1:] + poly[:1]):
            L = math.hypot(x1 - x0, y1 - y0)
            if L > 2:
                turns[round(math.degrees(math.atan2(y1 - y0, x1 - x0)) % 90)] += L
    if not turns:
        return 0
    t = turns.most_common(1)[0][0]
    return t - 90 if t > 45 else t


def osm_doors(rooms_lv, doors, lv):
    """The doors standing between two rooms of a level (both within 1.5 m), as openings."""
    from shapely.geometry import Point as SPoint, Polygon as SPolygon
    shapes = [(r["id"], SPolygon(r["poly"])) for r in rooms_lv]
    out, joined = [], set()
    for d in doors:
        if d["tagged"] and lv not in d["levels"]:
            continue
        if d["closed"]:
            continue
        p = SPoint(d["x"], d["y"])
        near = sorted((0.0 if s.contains(p) else s.exterior.distance(p), rid) for rid, s in shapes)
        near = [(dd, rid) for dd, rid in near if dd <= 1.5]
        if len(near) < 2:
            continue
        a, b = near[0][1], near[1][1]
        if frozenset((a, b)) in joined:
            continue
        joined.add(frozenset((a, b)))
        out.append({"a": a, "b": b, "at": [round(d["x"], 2), round(d["y"], 2)], "w": d["w"] or 1.6, "h": None,
                    "kind": "door", "sure": "reconstructed", "src": ["osm-indoor"],
                    "note": f"{OSM_MARK}: a door ({d['id']}) between them" + ("" if d["w"] else "; its width ours")})
    return out


def room_poly(r, turn):
    """A room's outline in the model's frame, whatever its shape is written as."""
    if r.get("poly"):
        return r["poly"]
    if r.get("rect"):
        x, y, w, d = r["rect"]
        a = math.radians(turn)
        ux, uy = (math.cos(a), math.sin(a)), (-math.sin(a), math.cos(a))
        return [[x, y], [x + w * ux[0], y + w * ux[1]], [x + w * ux[0] + d * uy[0], y + w * ux[1] + d * uy[1]],
                [x + d * uy[0], y + d * uy[1]]]
    if r.get("circle"):
        cx, cy, rr = r["circle"]
        return [[cx + rr * math.cos(k * math.pi / 8), cy + rr * math.sin(k * math.pi / 8)] for k in range(16)]
    return None


def osm_fit(doc, slug, mode, extra):
    """scripts/osm_interiors.js: the plan fitted to the model, as the walk compiles it. Returns (doc, report)."""
    payload = {"doc": doc, "slug": slug, "mode": mode, "osm": extra}
    res = subprocess.run(["node", str(OSM_FIT)], input=json.dumps(payload), capture_output=True, text=True, cwd=ROOT)
    if res.returncode != 0:
        raise RuntimeError(f"osm_interiors.js failed for {slug}: {res.stderr[-2000:]}")
    out = json.loads(res.stdout)
    return out["doc"], out["report"]


def osm_strip(doc):
    """What an earlier --osm run wrote into floors drawn from another source: its doors and lifts."""
    for fl in doc.get("floors") or []:
        fl["open"] = [o for o in fl.get("open") or [] if not (o.get("note") or "").startswith(OSM_MARK)]
        fl["lifts"] = [x for x in fl.get("lifts") or [] if not (x.get("note") or "").startswith(OSM_MARK)]
    doc["notes"] = re.sub(r"^" + re.escape(OSM_MARK) + r" \(read [^)]*\)[^¶]*¶ ?", "", doc.get("notes") or "")


def osm_drawn(doc):
    """Whether the file's floors are OpenStreetMap's (not the site's arrangement, not the museum's own)."""
    fls = doc.get("floors") or []
    return bool(fls) and all("osm-indoor" in (f.get("src") or []) and f.get("sure") != "arranged" for f in fls)


def osm_sources(doc, read, rule):
    srcs = [s for s in doc.get("sources") or [] if s.get("id") not in ("osm-indoor", "osm-rule")]
    srcs.append(dict(OSM_SOURCE, read=read))
    if rule:
        srcs.append(dict(OSM_RULE, read=TODAY))
    return srcs


def osm_pass(m, doc, model):
    """Rooms, doors and ways between floors from OpenStreetMap's indoor mapping (the comment above).
    Returns (lines, report) — report the fit, for the run's summary."""
    got = osm_read(m, model)
    if not got:
        return [], None
    slug = m["slug"]
    lines = []
    rooms_lv, parts_lv, wings = osm_rooms(got)
    n_rooms = sum(len(v) for v in rooms_lv.values())
    report = {"slug": slug, "features": got["features"], "rooms_read": n_rooms, "frac": got["frac"],
              "levels": sorted(rooms_lv)}
    if slug in OSM_OWN:
        # Only what joins the museum's own rooms.
        osm_strip(doc)
        lv_floor = OSM_OWN[slug]
        turn = (doc.get("grid") or {}).get("turn") or 0
        own_rooms = {f["id"]: f.get("rooms") or [] for f in doc.get("floors") or []}
        opens = {}
        for lv, fid in lv_floor.items():
            if fid in own_rooms:
                shaped = [{"id": r["id"], "poly": room_poly(r, turn)} for r in own_rooms[fid]
                          if r.get("kind") not in ("void", "closed")]
                opens[fid] = osm_doors([r for r in shaped if r["poly"]], got["doors"], lv)
        groups = []
        for w in wings + [{"id": r["f"]["id"], "lv": r["lv"], "tags": r["f"]["tags"], "geom": r["geom"]}
                          for r in got["rooms"] if r["f"]["tags"].get("ref") and "-" in r["f"]["tags"]["ref"]]:
            nums = []
            for part in re.split(r"[;,]", w["tags"].get("ref") or ""):
                mm = re.fullmatch(r"\s*(\d+)\s*(?:-\s*(\d+))?\s*", part)
                if mm:
                    a = int(mm.group(1))
                    b = int(mm.group(2) or a)
                    nums += list(range(a, b + 1))
            if nums:
                c = w["geom"].centroid
                groups.append({"id": w["id"], "name": w["tags"].get("name"), "ref": w["tags"].get("ref"),
                               "nums": sorted(set(nums)), "levels": osm_levels(w["tags"]),
                               "at": [round(c.x, 1), round(c.y, 1)],
                               "poly": [[round(a, 2), round(b, 2)] for a, b in w["geom"].exterior.coords[:-1]]})
        extra = {"read": got["read"], "opens": opens, "lifts": got["lifts"], "groups": groups, "entrances": got["entrances"],
                 "levels": {str(k): v for k, v in lv_floor.items()}}
        fitted, rep = osm_fit(dict(doc, sources=osm_sources(doc, got["read"], True)), slug, "own", extra)
        report.update(rep)
        if rep.get("added") or rep.get("entered"):
            # Only what was added (its note OSM_MARK): the museum's own rooms stay as written.
            got_fl = {f["id"]: f for f in fitted["floors"]}
            for fl in doc["floors"]:
                ff = got_fl.get(fl["id"]) or {}
                fl["open"] = (fl.get("open") or []) + [o for o in ff.get("open") or []
                                                       if (o.get("note") or "").startswith(OSM_MARK)]
                fl["lifts"] = (fl.get("lifts") or []) + [x for x in ff.get("lifts") or []
                                                         if (x.get("note") or "").startswith(OSM_MARK)]
            doc["enter"] = fitted["enter"]
            doc["sources"] = osm_sources(doc, got["read"], rep.get("rule"))
            lines.append(f"{rep['added']} ways from OpenStreetMap's indoor mapping between its own rooms "
                         f"({rep.get('doors', 0)} doors, {rep.get('lifts', 0)} lifts, {rep.get('rule', 0)} by the rule "
                         f"inside its mapped wings); reached {rep['reached_before']} → {rep['reached_after']} of {rep['rooms']} rooms")
        else:
            lines.append(f"OpenStreetMap's indoor mapping adds nothing that joins its rooms (reached {rep.get('reached_before')})")
        report["decision"] = "own"
        return lines, report
    if n_rooms < OSM_MIN_ROOMS:
        report["decision"] = "too few rooms"
        osm_note(doc, got, report)
        return [f"OpenStreetMap maps {n_rooms} rooms here: too few to walk; left as it is ({doc.get('tier')})"], report
    # The candidate: each integer level at 0 or over a floor.
    levels = [lv for lv in sorted(rooms_lv) if lv >= 0 and rooms_lv[lv]]
    if not levels:
        report["decision"] = "no level at or over the ground"
        osm_note(doc, got, report)
        return [f"OpenStreetMap maps rooms here only below the ground; left as it is ({doc.get('tier')})"], report
    all_rooms = [r for lv in levels for r in rooms_lv[lv]]
    cand = {k: v for k, v in doc.items() if k not in ("floors", "enter", "grid")}
    cand["grid"] = {"cell": cell_for(model), "turn": osm_turn(all_rooms)}
    cand["sources"] = osm_sources(doc, got["read"], True)
    cand["floors"] = []
    for lv in levels:
        rs = rooms_lv[lv]
        opens = [{"a": a, "b": b, "at": None, "kind": "part", "sure": "reconstructed", "src": ["osm-indoor"],
                  "note": f"{OSM_MARK}: one outline, split round a room drawn inside it"} for a, b in parts_lv[lv]]
        opens += osm_doors(rs, got["doors"], lv)
        cand["floors"].append({"id": osm_floor_id(lv), "name": f"Level {lv}", "z": lv * 4.5, "sure": "reconstructed",
                               "src": ["osm-indoor", "osm-rule"], "note": f"{OSM_MARK}'s level {lv}",
                               "rooms": rs, "open": opens, "things": [], "stairs": [], "lifts": [], "_lv": lv})
    for fl in cand["floors"]:
        for o in fl["open"]:
            if o["kind"] == "part":
                o["at"] = osm_seam(fl["rooms"], o["a"], o["b"])
    extra = {"read": got["read"], "entrances": got["entrances"], "lifts": got["lifts"],
             "wings": [{"name": w["tags"].get("name"), "lv": w["lv"]} for w in wings]}
    fitted, rep = osm_fit(cand, slug, "rooms", extra)
    report.update(rep)
    if os.environ.get("OSM_DEBUG_DIR"):
        Path(os.environ["OSM_DEBUG_DIR"], f"{slug}.fit.json").write_text(json.dumps(fitted), encoding="utf-8")
    # Usable: the floors it maps well (OSM_COVER of the model's floor there or more) are the museum's
    # floors walked; the others it maps are kept for what joins them (a lobby, a stair), never filled in.
    best = max([f["cover"] for f in rep.get("floors") or []] or [0])
    rep["cover_best"] = report["cover_best"] = best
    # A shell (nothing drawn inside) takes any plan it can walk, however much of the floor it covers:
    # the rest stays earth, as it was.
    shell = not doc.get("floors")
    ok = (rep.get("ok") and (shell or best >= OSM_COVER) and rep["reach"] >= OSM_REACH and rep["rooms"] >= OSM_MIN_ROOMS)
    report["decision"] = "osm" if ok else "kept"
    if not ok:
        osm_note(doc, got, report)
        why = rep.get("why") or (f"rooms on {round(100 * rep.get('cover', 0))}% of the model's floor, "
                                 f"{round(100 * rep.get('reach', 0))}% of them reached")
        return [f"OpenStreetMap's plan not taken ({why}); left as it is ({doc.get('tier')})"], report
    for k in ("grid", "floors", "enter", "sources"):
        doc[k] = fitted[k]
    for fl in doc["floors"]:
        for r in fl["rooms"]:
            r.pop("_area", None)
        fl.pop("_lv", None)
    doc["notes"] = osm_notes_text(got, rep, wings)
    lines.append(f"OpenStreetMap's plan taken: {rep['rooms']} rooms on {len(doc['floors'])} floors, "
                 f"{round(100 * rep['cover'])}% of the model's floor, {round(100 * rep['reach'])}% reached; "
                 f"{rep.get('doors', 0)} mapped doors, {rep.get('rule', 0)} by the rule, {rep.get('lifts', 0)} lifts")
    return lines, report


def osm_seam(rooms, a, b):
    from shapely.geometry import Polygon as SPolygon
    pa = SPolygon(next(r["poly"] for r in rooms if r["id"] == a))
    pb = SPolygon(next(r["poly"] for r in rooms if r["id"] == b))
    p = pa.boundary.intersection(pb.buffer(0.3))
    c = (p if not p.is_empty else pa).centroid
    return [round(c.x, 2), round(c.y, 2)]


OSM_WHY = {
    "too few rooms": "it maps too few rooms here",
    "no level at or over the ground": "it maps rooms here only below the ground",
}


def osm_note(doc, got, rep):
    """What OpenStreetMap gave, at the head of the notes of a museum that keeps its rooms. A museum whose
    rooms were OpenStreetMap's, whose plan no longer serves, goes back to its shell for the site to arrange."""
    if osm_drawn(doc):
        doc.update({"floors": None, "enter": None, "notes": "Nothing published about its rooms has been read yet."})
    osm_strip(doc)
    cover = rep.get("cover")
    why = OSM_WHY.get(rep.get("decision"))
    if not why:
        if not rep.get("rooms"):
            why = "none of its rooms stands on the museum's model (they are a neighbour's, or the model stands off)"
        elif rep.get("why"):
            why = rep["why"]
        else:
            why = (f"its best-mapped floor has rooms on {round(100 * rep.get('cover_best', cover or 0))}% of the "
                   f"model's floor there (half is wanted) and {round(100 * rep.get('reach', 0))}% of them are "
                   f"reached from a door (two thirds is wanted)")
    said = (f"{OSM_MARK} (read {got['read']}) was read: {got['features']} features round it, "
            f"{rep.get('rooms_read', 0)} rooms" +
            (f" on levels {', '.join(str(int(x)) if x == int(x) else str(x) for x in rep.get('levels') or [])}"
             if rep.get("levels") else "") +
            (f", {rep.get('rooms')} of them on the model" if rep.get("rooms") else "") +
            f" — not walked: {why}; so the rooms stay as they were.¶ ")
    doc["notes"] = said + (doc.get("notes") or "")


def osm_notes_text(got, rep, wings):
    fl = rep.get("floors") or []
    per = "; ".join(f"level {f['lv']}: {f['rooms']} rooms, {round(100 * f['cover'])}% of the model's floor at "
                    f"{f['z']} m" for f in fl)
    return (f"Drawn from {OSM_MARK} (read {got['read']}, © OpenStreetMap contributors, ODbL): every room, corridor "
            f"and hall its mappers drew inside the building, at the outlines they drew, with the names and numbers "
            f"they gave — {per}. Anchored on OpenStreetMap's coordinates; the model is guessed and is filed against "
            f"them where it stands off. Levels between two (an entresol) and below the ground are not drawn"
            + (f" ({got['frac']} features on such levels)" if got["frac"] else "") +
            f". Each level's height is the site's: {rep.get('storey')} m a level, the storey that gives the most of "
            f"the mapped rooms headroom under the model's roof. Doorways: {rep.get('doors', 0)} where OpenStreetMap "
            f"maps a door between two rooms; {rep.get('rule', 0)} by the rule where it draws two rooms side by side "
            f"and no door, one of them otherwise without a way in (osm-rule). Between floors: {rep.get('lifts', 0)} "
            f"lifts where it maps a lift or a stair across levels" + (", and one by the rule where it maps none"
                                                                       if rep.get("rule_lift") else "") +
            f". The way in: {rep.get('enter_said')}. {rep.get('reached')} of {rep.get('rooms')} rooms are reached "
            f"from it. Nothing of it is the museum's own plan: where the museum's records name a room by a number "
            f"OpenStreetMap gives, its works hang there; the rest are hung by the site, said so.")


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
    ap.add_argument("--osm", action="store_true", help="rooms and doors from osm/indoor/ (OpenStreetMap)")
    ap.add_argument("--osm-report", help="write how OpenStreetMap's plan fitted each museum to this JSON file")
    ap.add_argument("--osm-only", action="store_true", help="with --osm: only the museums osm/indoor/ covers")
    ap.add_argument("--collection", action="store_true",
                    help="read the museums' own on-view collections again (data/collections/)")
    args = ap.parse_args()
    museums = (read_json(DOCS / "museums.json", {}) or {}).get("museums") or []
    if args.only:
        museums = [m for m in museums if m["slug"] == args.only]
        if not museums:
            sys.exit(f"no museum {args.only} in museums.json")
    if args.osm and args.osm_only:
        museums = [m for m in museums if (OSM_INDOOR / f"{m['slug']}.json").exists()]
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
    osm_reports = []
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
        if args.osm:
            lines_osm, rep = osm_pass(m, doc, model)
            for line in lines_osm:
                print(f"    {line}", flush=True)
            if rep:
                osm_reports.append(rep)
            # What OpenStreetMap changed goes into the interior's log, as the moves do.
            if rep and rep.get("decision") in ("osm", "own") and lines_osm:
                moved.setdefault(m["slug"], []).extend(lines_osm)
        if m["slug"] == NGA_SLUG and nga is None:
            nga = NGAData(args.refresh)
        works, sources = place_works(m, doc, hist, held_by, by_slug, nga, where, wd, nga_matches, api_matches)
        lines = moves([w for w in doc.get("works") or [] if w.get("kind") != "collection"], works)
        coll, csrc = collection_works(m, doc, works, args.collection)
        works += coll
        if csrc:
            sources.append(csrc)
        if m["slug"] == NGA_SLUG and not nga.ok:
            lines.append("the NGA's open data could not be read; the placements read before stand")
        if lines:
            moved.setdefault(m["slug"], []).extend(lines)
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
        by = {"museum": 0, "elsewhere": 0, "off": 0, "none": 0, "collection": 0}
        for w in works:
            k = "collection" if w.get("kind") == "collection" else w["how"]
            by[k] += 1
            totals[k] = totals.get(k, 0) + 1
        line = ", ".join(f"{k} {v}" for k, v in by.items() if v)
        print(f"  {m['slug']}: {len(works)} works ({line}); {size // 1024} KB", flush=True)
    log_moves(moved)
    if osm_reports and args.osm_report:
        Path(args.osm_report).write_text(json.dumps(osm_reports, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{made} new files; works: " + ", ".join(f"{k} {v}" for k, v in totals.items()) +
          (f"; {sum(len(v) for v in moved.values())} moved, put up or taken down" if moved else ""), flush=True)


if __name__ == "__main__":
    main()
