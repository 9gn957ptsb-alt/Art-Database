#!/usr/bin/env python3
"""Where the characters' artists are from: the transcendental side of the characters.

The artist, 1 Oct 2026: "Establish a correspondence between the Artist associated with animals and
plants and where their artwork is located throughout the world. Even though the plants and animals
associated with the artist, even the artist themselves, may not be local to where the museum is
located, implement both a local aspect of where the museum is in addition to the transcendental
aspect of non-native artist and their plants and animals to that area."

For every artist in docs/v2/characters/characters.json (the cast and the backlog), this reads from
Wikidata (CC0) where the artist was born (P19), worked (P937) and lived (P551), each with its
coordinates (P625) and a name a reader knows it by ("Lexington, Virginia"; "Bradford, United
Kingdom"), and writes docs/v2/characters/homes.json — a small public file that
scripts/build_characters.py reads, with no network, to give each artist the plants of home.

The artist's Wikidata item is the one scripts/fetch_history_wikidata.py matched to the Artsy artist
(data/wikidata/matches.json, private; almost all by Artsy's own artist id on the item). Nothing is
guessed: an artist with no match, or a home with no coordinates, is left without, and the file says
so. Only Wikidata's facts are written, each with the property it came from.

    python3 scripts/fetch_artist_homes.py
"""

import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "docs" / "v2" / "characters" / "homes.json"
SAVES = ROOT / "data" / "artsy_saves_raw.json"
MATCHES = ROOT / "data" / "wikidata" / "matches.json"
API = "https://www.wikidata.org/w/api.php"
UA = "ArtistWebsite/1.0 (characters' homes; https://9gn957ptsb-alt.github.io/Art-Database/v2/)"
US = "Q30"
US_STATE = "Q35657"


CACHE = ROOT / "data" / "wikidata" / "homes_cache.json"
_cache = json.loads(CACHE.read_text()) if CACHE.exists() else {}


def get(ids, props="labels|claims"):
    out = {q: _cache[q] for q in ids if q in _cache}
    ids = [q for q in ids if q not in _cache]
    for k in range(0, len(ids), 40):
        q = urllib.parse.urlencode({"action": "wbgetentities", "ids": "|".join(ids[k:k + 40]),
                                    "props": props, "languages": "en", "format": "json"})
        req = urllib.request.Request(API + "?" + q, headers={"User-Agent": UA})
        for attempt in range(6):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    got = json.load(r).get("entities", {})
                out.update(got)
                _cache.update(got)
                CACHE.write_text(json.dumps(_cache))
                break
            except Exception as err:
                if attempt == 5:
                    raise
                wait = getattr(err, "headers", None) and err.headers.get("Retry-After")
                time.sleep(int(wait) if wait and str(wait).isdigit() else 10 + attempt * 10)
        time.sleep(1.5)
    return out


def label(e):
    return (e.get("labels", {}).get("en") or {}).get("value")


def values(e, p):
    out = []
    for c in e.get("claims", {}).get(p, []):
        if c.get("rank") == "deprecated":
            continue
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if v is not None:
            out.append(v)
    return out


def ids_of(e, p):
    return [v["id"] for v in values(e, p) if isinstance(v, dict) and "id" in v]


def current(e, p):
    """The values of a property that hold now: the preferred ones, else those with no end (P582)."""
    claims = [c for c in e.get("claims", {}).get(p, []) if c.get("rank") != "deprecated"]
    pref = [c for c in claims if c.get("rank") == "preferred"]
    if not pref:
        pref = [c for c in claims if "P582" not in c.get("qualifiers", {})]
    out = []
    for c in pref:
        v = c.get("mainsnak", {}).get("datavalue", {}).get("value")
        if isinstance(v, dict) and "id" in v:
            out.append(v["id"])
    return out


def main():
    cast = json.loads((ROOT / "docs" / "v2" / "characters" / "characters.json").read_text())
    names = [c["artist"] for c in cast["cast"]] + [b["artist"] for b in cast.get("backlog", [])]
    slug_of = {}
    for it in json.loads(SAVES.read_text()):
        a = it.get("artist") or {}
        if a.get("name") in names and a["name"] not in slug_of:
            slug_of[a["name"]] = a["id"]
    matched = json.loads(MATCHES.read_text())["artists"]

    qids = {}
    for n in names:
        m = matched.get(slug_of.get(n, ""))
        if m and m.get("qid"):
            qids[n] = m["qid"]
    people = get(qids.values())

    # The places, and what each is in, up to a US state or a country.
    want = set()
    for q in qids.values():
        e = people.get(q, {})
        for p in ("P19", "P937", "P551"):
            want.update(ids_of(e, p))
    places = get(want)
    above = dict(places)
    # What each place is in, three steps up (a county, then its state) and its country.
    level = set()
    for e in places.values():
        level.update(ids_of(e, "P131"))
        level.update(current(e, "P17"))
    for _ in range(3):
        got = get(level - set(above))
        above.update(got)
        level = set()
        for e in got.values():
            level.update(ids_of(e, "P131"))

    def where(q):
        e = places.get(q)
        if not e:
            print("  not read:", q)
            return None
        ll = [v for v in values(e, "P625") if isinstance(v, dict) and "latitude" in v]
        if not ll:
            print("  no coordinates:", q, label(e))
            return None
        name = label(e)
        if not name:
            return None
        country = (current(e, "P17") or [None])[0]
        tail = None
        if country == US:
            # The state, as a reader in the US says it ("Lexington, Virginia"), up to three steps up.
            level = ids_of(e, "P131")
            for _ in range(3):
                hit = [a for a in level if US_STATE in ids_of(above.get(a, {}), "P31")]
                if hit:
                    tail = label(above[hit[0]])
                    break
                level = [b for a in level for b in ids_of(above.get(a, {}), "P131")]
        elif country and country in above:
            tail = label(above[country])
        full = name + (", " + tail if tail and tail != name else "")
        return {"name": name, "where": full, "wd": q,
                "ll": [round(ll[0]["latitude"], 4), round(ll[0]["longitude"], 4)]}

    out = {}
    for n in names:
        q = qids.get(n)
        if not q:
            out[n] = {"note": "no Wikidata item matched to the Artsy artist; home left empty"}
            continue
        e = people.get(q, {})
        born = [w for w in (where(x) for x in ids_of(e, "P19")) if w]
        worked = [w for w in (where(x) for x in ids_of(e, "P937")) if w]
        lived = [w for w in (where(x) for x in ids_of(e, "P551")) if w]
        rec = {"wd": q, "label": label(e)}
        if born:
            rec["born"] = born[0]
        if worked:
            rec["worked"] = worked
        if lived:
            rec["lived"] = lived
        rec["source"] = ("Wikidata " + q + ": place of birth (P19), work location (P937), residence (P551), "
                         "each place's coordinates (P625); matched to the Artsy artist by "
                         + matched[slug_of[n]]["how"])
        out[n] = rec
        print(n, "|", rec.get("born", {}).get("where"), "|",
              "; ".join(w["where"] for w in worked[:5]), "|", "; ".join(w["where"] for w in lived[:5]))

    OUT.write_text(json.dumps({
        "note": "Where each character's artist was born, worked and lived, from Wikidata (CC0 1.0), written by "
                "scripts/fetch_artist_homes.py. The plants of home are the birthplace's (scripts/build_characters.py).",
        "licence": "Wikidata's data: CC0 1.0 Universal",
        "artists": out,
    }, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
