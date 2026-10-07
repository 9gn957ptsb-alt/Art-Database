"""Every place its own character: native artist, native animal, native plants.

The artist, 7 Oct 2026: "The red fox is coming up all around the globe.
Remember that I want a different character for each place based on native
artists and vegetation." (And 1 Oct: "tie character generation into the
website through DIRT along with corresponding plants and artists"; "a local
aspect of where the museum is in addition to the transcendental aspect of
non-native artist"; "attributing artists to their hometown is a good way to
introduce new animals".)

For every place of the site — the Museums layer's cities (cities.json), the
collages' cities, the notable lives' places (lifeplaces.json) and every saved
artist's birthplace (lives/), a place within 25 km of a city being that city —
this chooses, from public files only and the same every run:

- **its native artist**: the saved artist born there (the life's Wikidata
  birthplace within 40 km), the most saved first, one not already another
  place's (the others are kept, `others`); else one of the region (born within
  300 km, in the same country, the least used nearby first, then the most
  saved), said so; else none, and the character is "after the ground";
- **its native animal**: a species of DIRT's grammar for the place's biome and
  realm (dirt/earth/out/grammar.json, its life by height and kind), drawn by a
  body plan (species.py, rigs.py), chosen so that within 300 km no two places
  share the same animal after the same artist and the same animal is avoided
  where another can be had; the source is the grammar's line;
- **its plants**: plants.json's set for the place (unchanged);
- **its drawing**: the species' body plan in its poses, painted in the
  artist's hand and inks (hands.py), the poses as a letter a cell, rows
  run-length coded (a run is its count then its letter; no letter is a digit).

The six drawn by hand are the natives of their artists' home towns
(characters.json's `native`): their places' files name them (`cast`).

Writes docs/v2/characters/places/<key>.json (one a place, read on the wave)
and docs/v2/characters/maps/<life id>.json (each native artist's map, for
following, as artists.json's rows), and returns the index rows plants.json
carries (each place's key, so the page finds a place's file).
"""

import json
import math
import re
from pathlib import Path

import hands
import rigs
import species as SP

ROOT = Path(__file__).resolve().parents[2]
V2 = ROOT / "docs" / "v2"
OUT = V2 / "characters"
NATIVE_KM = 40          # an artist born this near a place is its own
MERGE_KM = 25           # a birthplace or a life's place this near a city is that city
REGION_KM = 300         # an artist of the region; and how far apart two characters must differ
SPREAD_KM = 700         # the same animal is avoided this far round, where another can be had


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def slug(s):
    import unicodedata
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def hsh(*parts):
    n = 2166136261
    for ch in "|".join(str(p) for p in parts):
        n = ((n ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return n / 4294967296.0


def rle(row):
    out, k = [], 0
    while k < len(row):
        ch, n = row[k], 1
        while k + n < len(row) and row[k + n] == ch:
            n += 1
        out.append((str(n) if n > 1 else "") + ch)
        k += n
    return "".join(out)


# ---- the places -------------------------------------------------------------------

def births():
    lives = json.loads((V2 / "lives.json").read_text())["lives"]
    saved = {r[0]: r[5] for r in lives}
    out = []
    for f in sorted((V2 / "lives").glob("*.json")):
        d = json.loads(f.read_text())
        if not d.get("b") or not d["b"][1]:
            continue
        bp = [p for p in d.get("periods", []) if "born" in p.get("how", [])]
        bkey = bp[0].get("key") if bp else None
        cc = bkey.rsplit("-", 1)[-1].upper() if bkey else None
        out.append({"id": d["id"], "name": d["name"], "where": d["b"][0], "ll": (d["b"][1][0], d["b"][1][1]),
                    "saved": saved.get(d["id"], 0), "cc": cc, "q": d.get("q")})
    return out


def collage_places():
    land = (V2 / "land.js").read_text(encoding="utf-8")
    return [(m.group(1), m.group(2), float(m.group(3)), float(m.group(4)))
            for m in re.finditer(r'\{ slug: "([^"]+)",\s*where: "([^"]+)",\s*lat: (-?[\d.]+),\s*lon: (-?[\d.]+) \}', land)]


def site_places(born):
    """Every place: key, name, ll, cc, kind; in the order they choose (the most important first)."""
    cities = json.loads((V2 / "cities.json").read_text())
    places = [{"key": t[0], "name": t[1], "ll": (t[3], t[4]), "cc": t[2], "kind": "town"} for t in cities["towns"]]

    def near(ll):
        best = None
        for p in places:
            d = km(ll, p["ll"])
            if best is None or d < best[0]:
                best = (d, p)
        return best

    for s, where, lat, lon in collage_places():
        d, p = near((lat, lon))
        if d > MERGE_KM:
            places.append({"key": "collage-" + s, "name": where, "ll": (lat, lon), "cc": p["cc"] if d < 200 else None, "kind": "collage"})
    for q in json.loads((V2 / "lifeplaces.json").read_text())["places"]:
        d, p = near((q["lat"], q["lon"]))
        if d > MERGE_KM:
            places.append({"key": q["slug"], "name": q["name"], "ll": (q["lat"], q["lon"]),
                           "cc": p["cc"] if d < 150 else None, "kind": "life"})
    taken = set(p["key"] for p in places)
    for b in sorted(born, key=lambda b: (-b["saved"], b["id"])):
        d, p = near(b["ll"])
        if d <= MERGE_KM:
            continue
        key = "born-" + slug(b["where"])
        n = 2
        while key in taken:
            key = "born-" + slug(b["where"]) + "-" + str(n)
            n += 1
        taken.add(key)
        places.append({"key": key, "name": b["where"], "ll": b["ll"], "cc": b["cc"], "kind": "born"})
    return places


# ---- the native artist --------------------------------------------------------------

def choose_artists(places, born, fixed):
    used = {}                                   # artist id -> place keys
    out = {}
    for p in places:
        if p["key"] in fixed:
            f = fixed[p["key"]]
            out[p["key"]] = f
            if f.get("id"):
                used.setdefault(f["id"], []).append(p)
    for p in places:
        if p["key"] in out:
            continue
        here = sorted(((km(p["ll"], b["ll"]), b) for b in born), key=lambda x: (x[0], x[1]["id"]))
        native = [(d, b) for d, b in here if d <= NATIVE_KM]
        if native:
            native.sort(key=lambda x: (-x[1]["saved"], x[0], x[1]["id"]))
            free = [x for x in native if x[1]["id"] not in used] or native
            d, b = free[0]
            others = [x[1]["name"] for x in native if x[1]["id"] != b["id"]][:8]
            out[p["key"]] = {"id": b["id"], "artist": b["name"], "how": "born", "born": b["where"], "km": round(d),
                             "others": others}
            used.setdefault(b["id"], []).append(p)
            continue
        region = [(d, b) for d, b in here if d <= REGION_KM and b["cc"] and p["cc"] and b["cc"] == p["cc"]]
        if region:
            def uses(b):
                return sum(1 for q in used.get(b["id"], []) if km(q["ll"], p["ll"]) <= REGION_KM)
            region.sort(key=lambda x: (uses(x[1]), -x[1]["saved"], x[0], x[1]["id"]))
            d, b = region[0]
            out[p["key"]] = {"id": b["id"], "artist": b["name"], "how": "region", "born": b["where"], "km": round(d),
                             "others": []}
            used.setdefault(b["id"], []).append(p)
            continue
        out[p["key"]] = {"id": None, "artist": None, "how": "ground"}
    return out


# ---- the native animal ----------------------------------------------------------------

MISSING = set()                 # the grammar's animals for the site's places with no row in species.py yet


def candidates(grammar, biome, realm):
    b = grammar["biomes"].get(str(biome))
    if not b:
        return []
    out = []
    for height, kinds in b["life"].items():
        for kind, by in kinds.items():
            if kind not in SP.KINDS:
                continue
            for name in by.get(realm) or by.get("*") or []:
                if name in SP.CAST:
                    continue
                if name not in SP.SPECIES:
                    MISSING.add(name)
                    continue
                out.append({"key": name, "kind": kind, "height": height,
                            "source": "dirt/earth/out/grammar.json, biome %s (%s), %s, %s.%s: %s" % (biome, b["name"], realm, height, kind, name)})
    return out


def choose_species(places, sets, artists, grammar):
    chosen = {}
    done = []
    for p in places:
        st = sets.get(p["key"])
        if not st or artists[p["key"]].get("cast"):
            continue
        cands = [c for c in candidates(grammar, st["biome_n"], st["realm"]) if SP.lives_at(c["key"], p["ll"][0], p["ll"][1])]
        if not cands:
            continue
        who = artists[p["key"]].get("id") or "ground"
        best = None
        for c in cands:
            score = SP.KINDS[c["kind"]] + 0.35 * hsh(p["key"], c["key"])
            bad = False
            pen = 0.0                            # the nearest place already with this animal counts, not how many
            for q, qs, qwho in done:
                d = km(p["ll"], q["ll"])
                if d > SPREAD_KM or qs != c["key"]:
                    continue
                if qwho == who and d <= REGION_KM:
                    bad = True
                    break
                pen = max(pen, 1.4 * (1 - d / SPREAD_KM))
            score -= pen
            if bad:
                continue
            if best is None or score > best[0]:
                best = (score, c)
        if best is None:
            continue
        chosen[p["key"]] = best[1]
        done.append((p, best[1]["key"], who))
    return chosen


# ---- the artist's map, for following ---------------------------------------------------

def artist_works(finding):
    by = {}
    for w in finding["w"]:
        names = [w[2]] + [x.strip() for x in re.split(r",| and | & ", w[2]) if x.strip() and x.strip() != w[2]]
        for n in names:
            by.setdefault(n, []).append(w)
    return by


def make_map(name, works, home, cities, museums, histories, plant_row):
    town = {r[0]: r for r in cities["towns"]}
    venue_ll = {k: {v[0]: (v[1], v[2]) for v in vs} for k, vs in cities["venues"].items()}
    yr = lambda w: int(re.search(r"\d{4}", w[3] or "").group(0)) if re.search(r"\d{4}", w[3] or "") else 0
    works = sorted(works, key=lambda w: (yr(w) or 9999, w[0]))
    index = {w[0]: i for i, w in enumerate(works)}
    at = {}
    for w in works:
        h = histories(w[0])
        for e in (h or {}).get("events", []):
            k = e.get("p")
            if k not in town:
                continue
            m = re.search(r"\d{4}", str(e.get("y") or ""))
            y = int(m.group(0)) if m else 0
            got = at.setdefault(k, {})
            i = index[w[0]]
            if i not in got or (y and (not got[i] or y < got[i])):
                got[i] = y
    held = {}
    for mu in museums:
        ids = sorted(index[x["id"]] for x in mu.get("works", []) if x["id"] in index)
        if ids:
            held[mu["slug"]] = ids
    rows = {}
    for k, got in at.items():
        r = town[k]
        mus = sorted(([s, held[s]] for s in r[6] if s in held), key=lambda x: (-len(x[1]), x[0]))
        wait = ["m", mus[0][0]] if mus else None
        if not wait and r[9]:
            pf = json.loads((V2 / "places" / (k + ".json")).read_text())
            count = {}
            for row in pf["works"]:
                if row[0] in index and row[5] in venue_ll.get(k, {}):
                    count.setdefault(row[5], set()).add(row[0])
            if count:
                vi = sorted(count, key=lambda v: (-len(count[v]), v))[0]
                ll = venue_ll[k][vi]
                wait = ["v", pf["venues"][vi][0], ll[0], ll[1]]
        ids = sorted(got, key=lambda i: (got[i] or 9999, i))
        first = min((y for y in got.values() if y), default=0)
        rows[k] = [k, r[1], r[2], r[3], r[4], ids, [[m[0], len(m[1])] for m in mus], wait, first]
    left = sorted(rows.values(), key=lambda r: (-len(r[5]), r[0]))
    here = home["ll"]
    route = []
    while left:
        nxt = min(left, key=lambda r: (km(here, (r[3], r[4])), r[0]))
        route.append(nxt)
        left.remove(nxt)
        here = (nxt[3], nxt[4])
    return {
        "artist": name,
        "works": [[w[0], w[1], w[4], yr(w)] for w in works],
        "held": sum(len(v) for v in held.values()),
        "places": route,
        "home": {"where": home["where"], "name": home["where"].split(",")[0], "ll": list(home["ll"]),
                 "plants": plant_row, "wd": home.get("q")},
        "source": "born: Wikidata %s (P19), through the life (lives/)" % (home.get("q") or ""),
    }


# ---- the hand -------------------------------------------------------------------------------

def hand_of(works, histories, cats):
    media, colours = [], []
    for w in works:
        h = histories(w[0]) or {}
        cat = cats[w[5][0]] if w[5] and w[5][0] < len(cats) else ""
        media.append((h.get("medium") or "", cat))
        for c in h.get("c") or []:
            colours.append(hands.rgb(c))
    mode, n = hands.mode_of(media)
    return mode, n, len(media), colours


# ---- moves ----------------------------------------------------------------------------------

def moves_of(sp):
    plan, p = sp["plan"], sp["p"]
    size = p.get("size", 1.0)
    if plan == "quad":
        g = p.get("gait", "trot")
        speed = {"walk": 0.68, "trot": 1.0, "bound": 1.45}[g] * (0.85 + 0.25 * min(1.2, size))
        return {"speed": round(speed, 2), "fps": {"walk": 6, "trot": 8, "bound": 10}[g], "pause": "back", "leave": "edge", "gait": g}
    if plan == "hopper":
        return {"speed": 1.5, "fps": 6, "pause": "back", "leave": "edge", "gait": "hop"}
    if plan == "bird":
        if p.get("gait") == "fly":
            return {"speed": 2.4, "fps": 8 if not p.get("bill_len", 0) > 2.5 or p.get("legs", 2) > 2 else 12, "pause": None,
                    "leave": "rise", "lift": 30, "gait": "fly"}
        return {"speed": 0.55 if p.get("legs", 2) > 6 and not p.get("ratite") else 1.2, "fps": 6, "pause": "back", "leave": "edge", "gait": "walk"}
    if plan == "lizard":
        return {"speed": 0.7 if p.get("croc") else 1.3, "fps": 10, "pause": "back", "leave": "edge", "gait": "scurry"}
    if plan == "frog":
        return {"speed": 0.9, "fps": 6, "pause": "back", "leave": "edge", "gait": "hop"}
    if plan == "crab":
        return {"speed": 0.6, "fps": 8, "pause": "back", "leave": "edge", "gait": "sidle"}
    if plan == "snake":
        return {"speed": 0.42, "fps": 6, "pause": "back", "leave": "edge", "gait": "slither"}
    form = p.get("form")
    if form in ("butterfly", "bee", "moth", "fly"):
        return {"speed": 1.6, "fps": 10, "pause": None, "leave": "rise", "lift": 26, "gait": "fly"}
    return {"speed": 0.4, "fps": 10, "pause": "back", "leave": "edge", "gait": "crawl"}


# ---- all ------------------------------------------------------------------------------------

def build(cast, plant_of, place_sets, grammar):
    """cast: characters.json; plant_of(key) -> [set, eco, soil] row for a place; place_sets: key -> set info
    ({biome_n, realm, set, soil_rgb, look}). Returns the places (for plants.json's index) and a report."""
    born = births()
    places = site_places(born)
    by_id = {b["id"]: b for b in born}
    # the six drawn by hand, at their artists' home towns
    fixed = {}
    for c in cast["cast"]:
        n = c.get("native")
        if not n:
            continue
        if n.get("key"):
            k = n["key"]
        else:
            k = min(places, key=lambda p: (km(p["ll"], n["ll"]), p["key"]))
            k = k["key"] if km(k["ll"], n["ll"]) <= MERGE_KM else None
        if not k:
            continue
        aid = next((b["id"] for b in born if b["name"] == c["artist"]), None)
        fixed[k] = {"id": aid, "artist": c["artist"], "how": "born", "born": n["where"], "cast": c["id"], "others": []}
    return places, fixed, born, by_id


def write_all(cast, places, fixed, born, plant_rows, sets_of, grammar):
    finding = json.loads((V2 / "finding.json").read_text())
    cats = finding["k"]
    cities = json.loads((V2 / "cities.json").read_text())
    museums = json.loads((V2 / "museums.json").read_text())["museums"]
    hcache = {}

    def histories(i):
        if i not in hcache:
            f = V2 / "histories" / (i + ".json")
            hcache[i] = json.loads(f.read_text()) if f.exists() else None
        return hcache[i]
    by_name = artist_works(finding)
    artists = choose_artists(places, born, fixed)
    species = choose_species(places, sets_of, artists, grammar)
    (OUT / "places").mkdir(exist_ok=True)
    (OUT / "maps").mkdir(exist_ok=True)
    for old in list((OUT / "places").glob("*.json")) + list((OUT / "maps").glob("*.json")):
        old.unlink()
    geo_cache, rows_cache = {}, {}
    maps_done = {}
    by_id = {b["id"]: b for b in born}
    stats = {"born": 0, "region": 0, "ground": 0, "cast": 0, "none": 0, "bytes": 0, "maps": 0, "species": set(), "modes": {}}
    index = []
    for p in places:
        a = artists[p["key"]]
        st = sets_of.get(p["key"])
        rec = {"key": p["key"], "name": p["name"], "ll": [round(p["ll"][0], 4), round(p["ll"][1], 4)], "kind": p["kind"]}
        if a.get("cast"):
            rec["cast"] = a["cast"]
            rec["native"] = {"artist": a["artist"], "how": "born", "born": a["born"]}
            stats["cast"] += 1
        elif p["key"] in species and st:
            sp = SP.get(species[p["key"]]["key"])
            c = species[p["key"]]
            if a["artist"]:
                works = by_name.get(a["artist"], [])
                mode, n_mode, n_works, colours = hand_of(works, histories, cats)
                if len(set(colours)) < 3:
                    colours += [st["soil_rgb"]] + [hands.rgb(x) for x in st["look"]]
                    colours_said = "the artist's colours, and the soil here where they are too few"
                else:
                    colours_said = "the colours of %d saved works" % n_works
                said = hands.SAID[mode] + (" (%d of %d works)" % (n_mode, n_works) if n_works else "")
            else:
                mode, said = "dither", hands.SAID["ground"]
                colours = [st["soil_rgb"], hands.mix(st["soil_rgb"], (0, 0, 0), 0.45), hands.mix(st["soil_rgb"], (255, 255, 255), 0.4)] + \
                    [hands.rgb(x) for x in st["look"]]
                colours_said = "the soil and the plants of the place"
            real = {k: hands.rgb(v) for k, v in sp["col"].items()}
            inks = hands.inks_for(colours, real)
            ck = (sp["key"], mode)
            if ck not in rows_cache:
                if sp["key"] not in geo_cache:
                    geo_cache[sp["key"]] = rigs.geometries(sp)
                rows_cache[ck] = rigs.poses(geo_cache[sp["key"]], hands.Hand(mode))
            poses, w, h = rows_cache[ck]
            mv = moves_of(sp)
            rec["native"] = {k: a[k] for k in ("artist", "how", "born", "km", "others") if a.get(k) is not None}
            if a.get("id"):
                rec["native"]["id"] = a["id"]
            rec["species"] = {"name": sp["name"], "latin": sp["latin"], "plan": sp["plan"], "kind": c["kind"],
                              "grammar": c["key"], "source": c["source"], "looks": "Wikipedia: " + sp["wiki"]}
            rec["hand"] = {"mode": mode, "said": said, "inks": colours_said}
            rec["inks"] = inks
            rec["moves"] = mv
            rec["sprite"] = {"w": w, "h": h, "cell": rigs.CELL, "foot": [w // 2, round(h - 1.4, 1)],
                             "poses": {k: [[rle(r) for r in fr] for fr in v] for k, v in poses.items()}}
            stats[a["how"]] += 1
            stats["species"].add(sp["key"])
            stats["modes"][mode] = stats["modes"].get(mode, 0) + 1
            if a.get("id") and a["id"] not in maps_done:
                b = by_id[a["id"]]
                works = by_name.get(a["artist"], [])
                if works:
                    m = make_map(a["artist"], works, b, cities, museums, histories, plant_rows.get(a["id"]))
                    if m["places"]:
                        (OUT / "maps" / (a["id"] + ".json")).write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")) + "\n")
                        stats["maps"] += 1
                        maps_done[a["id"]] = m
                    else:
                        maps_done[a["id"]] = None
                else:
                    maps_done[a["id"]] = None
            if a.get("id") and maps_done.get(a["id"]):
                rec["map"] = a["id"]
                row = next((r for r in maps_done[a["id"]]["places"] if r[0] == p["key"]), None)
                rec["here"] = len(row[5]) if row else 0
        else:
            stats["none"] += 1
            continue
        text = json.dumps(rec, ensure_ascii=False, separators=(",", ":"))
        (OUT / "places" / (p["key"] + ".json")).write_text(text + "\n")
        stats["bytes"] += len(text) + 1
        index.append(p)
    natives_of = {}
    for p in places:
        a = artists[p["key"]]
        if a.get("artist") and a["how"] == "born" and (OUT / "places" / (p["key"] + ".json")).exists():
            natives_of.setdefault(a["artist"], p["key"])
    return index, natives_of, stats
