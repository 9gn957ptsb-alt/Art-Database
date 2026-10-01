#!/usr/bin/env python3
"""Write docs/v2/explorations.json — the hunts, the explorations sent in, and
the relay's index.

The artist, 1 Oct 2026, on the idea "the catalogue writers are their own kind
of explorer. Wildenstein spent decades finding every Monet. Following him is
following the hunt itself, a map of where Monets were found": "Implement your
idea, that is a great example of a pre-established exploration adventure for
viewers to take. Branching off of that idea, there should be a way for a
viewer to create their own explorations and save them and share them with
others." And, the same day, on the relay ("an exploration that ends where
another begins"): "that's great to connect one exploration with another,
building a relay system as one ends and another begins relative to a time,
place, artwork, character, etc…"

The hunts. A cataloguer is a voice (voices.json) who wrote on eight works or
more, three quarters of them by one artist, at least half of them in a
catalogue (its title says catalogue, raisonné, Werkverzeichnis, œuvre,
complete, graphic work …, or it is cited by a number: "Bloch 145", "no. 223").
Two cataloguers of one catalogue (the works nearly the same: Feilchenfeldt,
Warman and Nash's online Cézanne) are one hunt under the one with most works.
The hunt is that artist's works among theirs, in catalogue-number order where
the record gives numbers (else by date), each stop where the work was when the
catalogue was made: the last owner or holder the history names at or before
the catalogue's year (else a show within three years of it); where that is
not recorded, it says so and the stop is where the work is now. Every line is
made only of the record's words (who, where, the catalogue's title, its number,
the years); nothing is invented.

Sent in. A code a visitor sends the artist, which he gives a session, is
decoded (`--add CODE`, with `--title` and `--by`) into
scripts/explorations_sent.json as ids and keys, so a later rebuild of the
indices cannot move it; it is published here under "made". See
docs/v2/EXPLORATIONS.md.

The relay. `relay` indexes every published exploration — the hunts, the
walks (characters/walks.json), the voices' routes (voices/<id>.json, their
places in time) and the sent — by what its stops are: city, year, work (an
index into finding.json's works), and its artist, animal and voice, so the
page can offer, when any exploration ends, those that begin (or pass) where
it ended. Rows: [kind, id, title, artist, animal, voice, n, stops], each stop
[key, year or 0, work index or -1]; a voice's route gives its first and last
stops only. Public files only; the same bytes every run.

Painted here. `sites` are the site explorations build_sites.py made from
the documented painting sites (sites.json): per artist and place, and per
artist — each stop one point, its works (indexes into sites.json's rows),
its word for the sentence (the place painted, else the work's short title).
They are added to the relay last ("s"), so the indexes of the rows before
them, which codes carry, do not move.
"""
import argparse
import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, "docs", "v2")
OUT = os.path.join(V2, "explorations.json")
SENT = os.path.join(ROOT, "scripts", "explorations_sent.json")

MIN_WORKS = 8
ONE_ARTIST = 0.75
CATALOGUED = 0.5
SAME_HUNT = 0.8          # Jaccard of two cataloguers' works: one catalogue, one hunt
SHOW_YEARS = 3
PARTICLES = {"de", "van", "von", "da", "di", "del", "der", "le", "la"}

CAT = re.compile(r"catalog|raisonn|werkverzeichnis|oeuvre|œuvre|graphic work|graphische|complete|"
                 r"sämtliche|samtliche|opera completa|peintre[- ]graveur|tout l|the paintings of|"
                 r"the drawings of|the prints of|lithograph|gravé|grave\b|printed graphic", re.I)

NOTE = ("Explorations (docs/v2/explorations.js). hunts: a cataloguer's hunt — the works of one artist they "
        "catalogued, in catalogue order, each stop where the work was when the catalogue was made (key: a "
        "cities.json town; y: the catalogue's year; no: its number; lines: what is said, from the record's own "
        "words; now: where it is now). made: explorations sent in by visitors as codes, decoded (stops: "
        "[kind, id], kind w work, t town, m museum, v voice, h thread, a animal). relay: every published "
        "exploration by its stops, for the handoffs — [kind h hunt, w walk, v a voice's route, x sent; id; "
        "title; artist; animal; voice; number of stops; stops [[key, year or 0, work index into finding.json "
        "or -1]]], a voice's route by its first and last stops; s a site exploration. sites: the site explorations "
        "(Painted here, sites.json): stops [{key, ll, y, w word, s [sites.json rows]}]. Written by "
        "scripts/build_explorations.py.")


def load(*p):
    with open(os.path.join(V2, *p)) as f:
        return json.load(f)


def surname(name):
    w = name.split(" ")
    k = len(w) - 1
    while k > 0 and w[k - 1].lower() in PARTICLES:
        k -= 1
    return " ".join(w[k:])


KNOWN_AS = {"Rembrandt van Rijn": "Rembrandt"}


def plural(artist, n):
    s = KNOWN_AS.get(artist) or surname(artist)
    s = s[0].upper() + s[1:] if s.split(" ")[0].lower() not in PARTICLES else s
    if n == 1:
        return "1 " + s
    return str(n) + " " + (s if re.search(r"[sxz]$", s) else s + "s")


def year_of(v):
    m = re.match(r"\s*(\d{4})", str(v or ""))
    return int(m.group(1)) if m else 0


NUM = [
    re.compile(r"^\s*([A-Z]{0,3})\s*(\d{1,5})([a-z]?)\s*$"),
    re.compile(r"\bnos?\.?\s*([A-Z]{0,2})\s*(\d{1,5})([a-z]?)\b", re.I),
    re.compile(r"\bnr\.?\s*()(\d{1,5})([a-z]?)\b", re.I),
    re.compile(r"\bn\.\s*()(\d{1,5})([a-z]?)\b"),
    re.compile(r"\bcat\.\s*(?:no\.?\s*)?()(\d{1,5})([a-z]?)\b", re.I),
    re.compile(r"\bplate\s+()(\d{1,5})([a-z]?)\b", re.I),
    re.compile(r"\b(F|JH|FWN|SD|RWC|V|L|R|B|G|M|W|D)\s?(\d{1,5})([a-z]?)\b"),
]
SHORT = re.compile(r"^(?:ref\.?:?\s*)?[A-Za-zÀ-ÿ.'\s-]{2,32}?,?\s(\d{1,5})([a-z]?)\b", re.I)


def number(cite, name=None):
    """A catalogue number out of a citation: ("223", 223, "") or None. After
    the cataloguer's own surname ("Bloch 1865", "Bastian, 59") any number is one."""
    c = str(cite or "").replace("\n", " ")
    if name:
        m = re.search(re.escape(name) + r",?\s+(?:no\.?\s*)?(\d{1,5})([a-z]?)\b", c)
        if m:
            return (m.group(1) + m.group(2), int(m.group(1)), m.group(2))
    for rx in NUM:
        m = rx.search(c)
        if m:
            pre, n, suf = m.group(1), m.group(2), m.group(3)
            if 1800 <= int(n) <= 2030 and not pre and rx is not NUM[0]:
                continue
            return ((pre + " " if pre else "") + n + suf, int(n), suf)
    if len(c) <= 48:
        m = SHORT.match(c)
        if m and not (1800 <= int(m.group(1)) <= 2030):
            return (m.group(1) + m.group(2), int(m.group(1)), m.group(2))
    return None


def is_cat(act, name=None):
    return bool(CAT.search(act.get("t") or "")) or number(act.get("cite"), name) is not None


def cataloguers(index):
    out = []
    for row in index["voices"]:
        if not isinstance(row[3], int) or row[3] < MIN_WORKS or "w" not in row[2]:
            continue
        v = load("voices", row[0] + ".json")
        arts = collections.Counter(w[2] for w in v["works"])
        artist, n = arts.most_common(1)[0]
        if n < ONE_ARTIST * len(v["works"]):
            continue
        acts = [a for a in v["acts"] if a["r"] == "w"]
        cat = {a["w"] for a in acts if is_cat(a, surname(v["name"]))}
        if len(cat) < CATALOGUED * len(v["works"]):
            continue
        out.append((v, artist))
    return out


def merge(cands):
    """Cataloguers of one catalogue are one hunt, under the one with most works."""
    cands = sorted(cands, key=lambda c: (-len(c[0]["works"]), c[0]["id"]))
    groups = []
    for v, artist in cands:
        mine = {w[0] for w in v["works"] if w[2] == artist}
        for g in groups:
            if g["artist"] != artist:
                continue
            j = len(mine & g["ids"]) / float(len(mine | g["ids"]))
            if j >= SAME_HUNT:
                g["with"].append(v)
                break
        else:
            groups.append({"lead": v, "with": [], "artist": artist, "ids": mine})
    return groups


def short_place(e):
    return str(e.get("w") or "").split(",")[0]


def found_at(h, y):
    """Where the work was in year y: the last owner or holder at or before it,
    else a show within SHOW_YEARS of it. (event, how) or (None, None)."""
    ev = h.get("events", [])
    best = None
    for e in ev:
        if e.get("k") not in ("owned", "held"):
            continue
        ey = year_of(e.get("y"))
        if not ey or ey > y:
            continue
        if not (e.get("who") or e.get("v")):
            continue
        if best is None or ey >= year_of(best.get("y")):
            best = e
    if best is not None:
        return best, "with"
    shows = [e for e in ev if e.get("k") == "exhibited" and e.get("p") and year_of(e.get("y"))
             and abs(year_of(e.get("y")) - y) <= SHOW_YEARS]
    if shows:
        shows.sort(key=lambda e: (abs(year_of(e.get("y")) - y), year_of(e.get("y"))))
        return shows[0], "shown"
    return None, None


def same_holder(a, b):
    if a.get("p") != b.get("p"):
        return False
    if a.get("m") and a.get("m") == b.get("m"):
        return True
    f = lambda e: re.sub(r"^the ", "", (e.get("who") or e.get("v") or "").lower())[:16]
    return bool(f(a)) and f(a) == f(b)


def now_at(h):
    """Where it is now: the latest holder, owner or listing with a place."""
    best = None
    for e in h.get("events", []):
        if e.get("k") not in ("held", "owned", "listed") or not e.get("p"):
            continue
        ey = year_of(e.get("y"))
        if not ey:
            continue
        if best is None or ey > year_of(best.get("y")) or (ey == year_of(best.get("y")) and e.get("k") == "held"):
            best = e
    return best


def hunt_for(g, towns, work_ix):
    lead = g["lead"]
    artist = g["artist"]
    who = surname(lead["name"])
    per = collections.defaultdict(list)    # work id -> its catalogue acts, across the group's voices
    for v in [lead] + g["with"]:
        for a in v["acts"]:
            if a["r"] != "w":
                continue
            w = v["works"][a["w"]]
            if w[2] != artist:
                continue
            per[w[0]].append((a, w, surname(v["name"])))
    # The catalogue's year: each work's earliest catalogue act with a real citation; the commonest as fallback.
    years = collections.Counter()
    for acts in per.values():
        ys = [a["y"] for a, _, _ in acts if a.get("y") and CAT.search(a.get("t") or "") and len(str(a.get("cite") or "")) > 12]
        if ys:
            years[min(ys)] += 1
    common = years.most_common(1)[0][0] if years else 0
    titles = collections.Counter(a.get("t") for acts in per.values() for a, _, _ in acts if a.get("t") and CAT.search(a["t"]))
    g_title = titles.most_common(1)[0][0] if titles else ""
    stops = []
    for wid, acts in per.items():
        catacts = [a for a, _, nm in acts if is_cat(a, nm)]
        names = {id(a): nm for a, _, nm in acts}
        if not catacts:
            continue
        real = [a for a in catacts if a.get("y") and CAT.search(a.get("t") or "") and len(str(a.get("cite") or "")) > 12]
        first = min(real, key=lambda a: (a["y"], a.get("t") or "")) if real else None
        y = first["y"] if first else common
        nos = [number(a.get("cite"), names[id(a)]) for a in sorted(catacts, key=lambda a: (a.get("y") or 9999, a.get("t") or ""))]
        no = next((n for n in nos if n), None)
        title = (first or next((a for a in catacts if a.get("t")), {})).get("t") or g_title
        try:
            h = load("histories", wid + ".json")
        except (OSError, ValueError):
            continue
        work = acts[0][1]
        fe, how = found_at(h, y) if y else (None, None)
        ne = now_at(h)
        # Where the stop is: where it was found, else where it is now, else where the
        # cataloguer's own record places the work (held or listed, never the imprint).
        here = [a.get("p") for a in catacts if a.get("pr") in ("held", "work") and a.get("p")]
        key = next((k for k in [(fe or {}).get("p"), (ne or {}).get("p")] + here if k in towns), None)
        if not key:
            continue
        lines = []
        cat = ("No. " + no[0] + " · " if no else "") + (title or "the catalogue") + \
            (", " + str(y) if y and not re.search(r"\b1[89]\d\d|\b20\d\d", title) else "")
        lines.append(cat)
        if fe and how == "with":
            holder = fe.get("who") or fe.get("v")
            place = short_place(fe)
            s = "In " + str(y) + " " + who + " found it with " + holder + (", " + place if place else "")
            ey = year_of(fe.get("y"))
            if ey and ey < y:
                s += " · there since " + str(ey)
            if not fe.get("p"):
                s += " · where, the record does not say"
            lines.append(s)
        elif fe and how == "shown":
            lines.append("In " + str(y) + " it was shown: " + (fe.get("t") or "a show") +
                         (", " + (fe.get("v") or "") if fe.get("v") else "") + ", " + short_place(fe) +
                         ", " + str(year_of(fe.get("y"))))
        else:
            lines.append(("Where it was in " + str(y) + " is not recorded") if y else "Where it was then is not recorded")
        if ne:
            holder = ne.get("who") or ne.get("v") or ""
            if fe and (ne is fe or same_holder(fe, ne)):
                lines.append("It is there still")
            else:
                museum = ne.get("m") or ne.get("k") == "held"
                lines.append("Now: " + ("listed by " if ne.get("k") == "listed" and not museum else "") + holder +
                             (", " + short_place(ne) if short_place(ne) and short_place(ne) not in holder else ""))
        else:
            lines.append("Now: recorded in " + towns[key][1])
        stops.append({"w": wid, "key": key, "y": y or 0, "no": no[0] if no else "", "_n": (no[1], no[2]) if no else None,
                      "_d": year_of(h.get("date")) or work[4] or 9999, "_t": work[1] or "",
                      "now": (ne or {}).get("p") or "", "lines": lines})
    numbered = sum(1 for s in stops if s["_n"])
    if numbered >= 0.6 * len(stops):
        stops.sort(key=lambda s: (s["_n"] is None, s["_n"] or (0, ""), s["_d"], s["_t"], s["w"]))
        order = "catalogue"
    else:
        stops.sort(key=lambda s: (s["_d"], s["_t"], s["w"]))
        order = "date"
    for s in stops:
        del s["_n"], s["_d"], s["_t"]
    if len(stops) < 5:
        return None
    with_names = [x["name"] for x in g["with"]]
    by = lead["name"] + ("" if not with_names else " with " + " and ".join(
        [", ".join(with_names[:-1]), with_names[-1]] if len(with_names) > 1 else with_names))
    return {"id": "hunt-" + lead["id"], "kind": "hunt", "title": who + "’s hunt · " + plural(artist, len(stops)),
            "by": by, "voice": lead["id"], "voices": [lead["id"]] + [x["id"] for x in g["with"]],
            "artist": artist, "order": order, "y": common, "stops": stops}


def sent_list(work_ix):
    if not os.path.exists(SENT):
        return []
    with open(SENT) as f:
        return json.load(f).get("explorations", [])


def relay_index(hunts, walks, made, index, finding_ix, cast_by_artist, towns):
    rows = []
    museum_town = {slug: k for k, t in towns.items() for slug in (t[6] or [])}
    for h in hunts:
        rows.append(["h", h["id"], h["title"], h["artist"], (cast_by_artist.get(h["artist"]) or ""), h["voice"],
                     len(h["stops"]), [[s["key"], s["y"], finding_ix.get(s["w"], -1)] for s in h["stops"]]])
    for w in walks:
        rows.append(["w", w["id"], w["title"], w["artist"], w["animal"], "", len(w["stops"]),
                     [[s["key"], 0, finding_ix.get((s.get("works") or [None])[0], -1)] for s in w["stops"]]])
    for x in made:
        st = []
        for s in x["stops"]:
            k, i = s[0], s[1]
            if k == "t" and i in towns:
                st.append([i, 0, -1])
            elif k == "w" and i in finding_ix:
                st.append(["", 0, finding_ix[i]])
            elif k == "m" and i in museum_town:
                st.append([museum_town[i], 0, -1])
        if st:
            rows.append(["x", x["id"], x["title"], "", "", "", len(x["stops"]), st])
    for row in index["voices"]:
        if not isinstance(row[3], int) or row[3] < 2:
            continue
        try:
            v = load("voices", row[0] + ".json")
        except (OSError, ValueError):
            continue
        places = [p for p in v.get("places", []) if p[0] in towns]
        if len(places) < 2:
            continue
        ends = [places[0], places[-1]]
        rows.append(["v", v["id"], v["name"], "", "", v["id"], len(places),
                     [[p[0], p[8] or 0, -1] for p in ends]])
    return rows


def site_explorations(finding_ix):
    path = os.path.join(V2, "sites.json")
    if not os.path.exists(path):
        return [], []
    d = load("sites.json")
    rows = d["sites"]
    out, relay = [], []
    for e in d["explorations"]:
        stops = []
        for ll, key, ids in e["stops"]:
            first = rows[ids[0]]
            word = (first.get("what") if first.get("pr") in ("site", "street") else None) or \
                re.split(r"[,:(]", first.get("t") or "Untitled")[0].strip()
            stops.append({"key": key, "ll": ll, "y": first.get("d") or 0, "w": word, "s": ids})
        out.append({"id": e["id"], "kind": "sites", "title": e["title"], "artist": e["artist"],
                    "place": e["place"], "stops": stops})
        relay.append(["s", e["id"], e["title"], e["artist"], "", "", len(stops),
                      [[st["key"], st["y"], finding_ix.get(rows[st["s"][0]].get("w") or "", -1)] for st in stops]])
    return out, relay


def sentence_words(h, name_of):
    return [name_of.get(s["key"], s["key"]).split(",")[0] for s in h["stops"]]


def add_sent(code, title, by):
    """Decode a visitor's exploration code into scripts/explorations_sent.json."""
    sys.path.insert(0, os.path.join(ROOT, "scripts"))
    from explorations_code import decode  # noqa: E402
    x = decode(code)
    if not x or x["stale"]:
        sys.exit("not an exploration code this map knows (made against an earlier map, or a letter out): " + code)
    data = {"note": "Explorations sent in by visitors and published by the artist (docs/v2/EXPLORATIONS.md). "
                    "Decoded: stops [kind, id]; never edited by hand except a title or a credit.",
            "explorations": []}
    if os.path.exists(SENT):
        with open(SENT) as f:
            data = json.load(f)
    ids = {e["id"] for e in data["explorations"]}
    n = 1
    while "sent-%d" % n in ids:
        n += 1
    data["explorations"].append({"id": "sent-%d" % n, "title": title or x["title"], "by": by or "a visitor",
                                 "code": code, "stops": x["stops"]})
    with open(SENT, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("added sent-%d:" % n, title or x["title"], len(x["stops"]), "stops")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--add", help="an exploration code a visitor sent, to publish")
    ap.add_argument("--title")
    ap.add_argument("--by")
    args = ap.parse_args()
    if args.add:
        add_sent(args.add, args.title, args.by)
    index = load("voices.json")
    towns = {t[0]: t for t in load("cities.json")["towns"]}
    name_of = {k: t[1] for k, t in towns.items()}
    finding = load("finding.json")["w"]
    finding_ix = {w[0]: i for i, w in enumerate(finding)}
    cast = load("characters", "characters.json")["cast"]
    cast_by_artist = {c["artist"]: c["id"] for c in cast}
    walks = load("characters", "walks.json")["walks"]
    hunts = []
    for g in merge(cataloguers(index)):
        h = hunt_for(g, towns, finding_ix)
        if h:
            hunts.append(h)
    hunts.sort(key=lambda h: (-len(h["stops"]), h["id"]))
    made = sent_list(finding_ix)
    sites, site_relay = site_explorations(finding_ix)
    out = {"note": NOTE, "hunts": hunts, "made": made, "sites": sites,
           "relay": relay_index(hunts, walks, made, index, finding_ix, cast_by_artist, towns) + site_relay}
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    for h in hunts:
        known = sum(1 for s in h["stops"] if "not recorded" not in s["lines"][1])
        print("%-40s %-28s %3d stops, %2d found-places, by %s (%s order)" % (h["title"], h["artist"], len(h["stops"]),
              known, h["by"], h["order"]))
        print("     ", " | ".join(h["stops"][0]["lines"]))
    print("site explorations:", len(sites))
    print("relay rows:", len(out["relay"]), " bytes:", os.path.getsize(OUT))
    if len(out["relay"]) > 511:
        sys.exit("the relay has more rows than a code's 9 bits can name: " + str(len(out["relay"])))


if __name__ == "__main__":
    main()
