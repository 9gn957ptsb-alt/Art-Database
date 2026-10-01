#!/usr/bin/env python3
"""Write docs/v2/characters/walks.json — the walks published for everyone.

The artist, 1 Oct 2026, on following an animal as a form of reading: "a
trail you follow is an essay without words. Save a following as a route
someone else can walk: 'Twombly by fox, 32 cities.'" — "fantastic, really
great stuff, implement that".

A walk is a reading in sequence: whose animal, and its stops — a city (a
key of cities.json), the works opened there in order, and how long each was
looked at (seconds; 0 is the page's calm default). docs/v2/walks.js plays
them. Each character of the cast gets two from its artist's map
(characters/artists.json):

- the route: the artist's cities nearest-first from home, as the map gives
  them ("Twombly by fox");
- as the work travelled: the same cities in the order the artist's works
  first came to them, by the histories' years (a city with no year last,
  in route order).

At most three works a stop, earliest first, so a stop is read and not
listed. Walks the artist publishes himself (a walk code he sends a
session, decoded) are kept: any walk whose "by" is not "the route" is
carried over unchanged. Public files only; the same bytes every run.

Each walk is also given as its sentence (`sentence`, its lines), by the
rules docs/v2/walks.js reads it with (the page reads every walk, kept or
coded, the same way; keep the two in step): each stop a word, its city's
name; where nothing was opened a dash, lingering less than two median looks
(34 s) a comma, more a full stop, the last word a full stop (or its dash);
a line ends at a full stop and holds five words at most; three stops are a
tercet, a line each; a city said again a refrain (the page sets it in
italics; here it is marked *so*). A published stop's works are looked at for
the page's calm default, 17 s x phi each, so one work is a comma and two or
more a full stop.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CH = os.path.join(ROOT, "docs", "v2", "characters")
OUT = os.path.join(CH, "walks.json")
PER_STOP = 3
PARTICLES = {"de", "van", "von", "da", "di", "del", "der", "le", "la"}
PHI = (1 + 5 ** 0.5) / 2
LOOK = 17 * PHI                # seconds, a work's calm default look (walks.js LOOK)
FULL_S = 34                    # lingering this long is a full stop
LINE_WORDS = 5

NOTE = ("Walks published for everyone (docs/v2/walks.js). A walk is a reading in sequence: "
        "id, title, artist, animal (a cast id), by, stops: [{key (cities.json town), works "
        "[work ids, in order], s [seconds each was looked at; 0 is the page's calm default]}]. "
        "Written by scripts/build_walks.py from characters.json and artists.json: for each "
        "character its artist's route (nearest-first from home) and the same cities as the work "
        "travelled (by the year the artist's works first came there); at most three works a "
        "stop, earliest first. Walks by anyone but 'the route' are the artist's own, kept as they are. "
        "sentence: the walk as a sentence, its lines (each stop a word, its city; a dash where nothing "
        "was opened, a comma for a short stop, a full stop for a long one; *a refrain*), as walks.js reads it.")


def surname(name):
    words = name.split(" ")
    k = len(words) - 1
    while k > 0 and words[k - 1].lower() in PARTICLES:
        k -= 1
    return " ".join(words[k:])


def stop(m, row):
    ids = [m["works"][i][0] for i in row[5][:PER_STOP] if 0 <= i < len(m["works"])]
    return {"key": row[0], "works": ids, "s": [0] * len(ids)}


def sentence(w, name_of):
    """The walk's lines, as walks.js writes them."""
    n = len(w["stops"])
    words, seen = [], set()
    for i, st in enumerate(w["stops"]):
        works = st.get("works") or []
        linger = sum((st.get("s") or [0] * len(works))[k] or LOOK for k in range(len(works))) if works else -1
        p = " —" if linger < 0 else "." if i == n - 1 or linger >= FULL_S else ","
        word = name_of.get(st["key"], st["key"]).split(",")[0]
        words.append(("*" + word + "*" if st["key"] in seen else word) + p)
        seen.add(st["key"])
    lines, cur = [], []
    for x in words:
        cur.append(x)
        if n == 3 or x.endswith(".") or len(cur) >= LINE_WORDS:
            lines.append(" ".join(cur))
            cur = []
    if cur:
        lines.append(" ".join(cur))
    return lines


def main():
    cast = json.load(open(os.path.join(CH, "characters.json")))["cast"]
    artists = json.load(open(os.path.join(CH, "artists.json")))["artists"]
    kept = []
    if os.path.exists(OUT):
        kept = [w for w in json.load(open(OUT)).get("walks", []) if w.get("by") != "the route"]
    walks = []
    for c in cast:
        m = artists.get(c["artist"])
        if not m or not m.get("places"):
            continue
        animal = c["name"].split(" ")[-1].lower()
        title = surname(c["artist"]) + " by " + animal
        route = m["places"]
        walks.append({"id": c["id"] + "-route", "title": title, "artist": c["artist"], "animal": c["id"],
                      "by": "the route", "stops": [stop(m, r) for r in route]})
        order = sorted(range(len(route)), key=lambda i: (route[i][8] or 9999, i))
        walks.append({"id": c["id"] + "-travelled", "title": title + ", as the work travelled",
                      "artist": c["artist"], "animal": c["id"], "by": "the route",
                      "stops": [stop(m, route[i]) for i in order]})
    towns = json.load(open(os.path.join(ROOT, "docs", "v2", "cities.json")))["towns"]
    name_of = {t[0]: t[1] for t in towns}
    for w in walks + kept:
        w["sentence"] = sentence(w, name_of)
    out = {"note": NOTE, "walks": walks + kept}
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    for w in out["walks"]:
        print(w["id"], len(w["stops"]), "stops", sum(len(s["works"]) for s in w["stops"]), "works")
        print("   ", " / ".join(w["sentence"][:3]) + (" / …" if len(w["sentence"]) > 3 else ""))


if __name__ == "__main__":
    main()
