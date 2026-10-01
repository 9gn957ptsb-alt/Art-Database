"""Writes docs/v2/corpses.json — the published exquisite corpses.

No server: a visitor sends the artist a corpse code (corpse·…); a session
adds it here, and the corpse is published — listed in Find ("corpse"), its
chimera living on its route's cities, where a viewer's own may meet it, its
squirrel's buried work surfacing in others' games, its slug's trail on the
globe, its bison's wallows in the ground (docs/v2/CORPSE.md).

    python3 scripts/build_corpses.py                       # rebuild from the sent list
    python3 scripts/build_corpses.py --add CODE [--by NAME]

The sent list (scripts/corpses_sent.json) keeps each corpse decoded (ids,
not indexes), so later moves in finding.json or cities.json never change a
published corpse. Public files only; same bytes every run.
"""

import argparse
import json
import os

from corpse_code import decode, lists

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, "docs", "v2")
SENT = os.path.join(ROOT, "scripts", "corpses_sent.json")
OUT = os.path.join(V2, "corpses.json")
VERB_ORDER = ["sold", "offered", "made", "held", "owned", "exhibited", "listed", "other"]
VERB = {"sold": "sold", "offered": "offered", "made": "made", "held": "held", "owned": "kept",
        "exhibited": "showed", "listed": "listed", "other": "saw"}
NOTE = ("The exquisite corpse (docs/v2/corpse.js). made: corpses sent in as codes and published, decoded "
        "({id, title (its sentence), by, code, legs: [{a animal, by, stops [[work id, city key, year]], "
        "buried [[work id, city key, year]]}]}). caches: the squirrels' buried works, surfacing in other games "
        "([work id, city key, year, month 0-11, corpse id]). trails: the slugs' trails ([corpse id, [city keys]]). "
        "wallows: the bison's ([city key, corpse id]). Written by scripts/build_corpses.py from "
        "scripts/corpses_sent.json; see CORPSE.md.")


def short_title(t):
    import re
    t = re.sub(r"\s*[\[(].*?[\])]\s*", " ", t or "")
    t = re.sub(r"\s+", " ", t).strip()
    w = t.split(" ")
    return " ".join(w[:6]) + "…" if len(w) > 7 else t


def sentence(legs, titles, towns):
    """The page's sentence: leg one's first city, leg two's rarest verb, leg three's last title."""
    def place(key):
        with open(os.path.join(V2, "places", key + ".json")) as f:
            return json.load(f)
    best = None
    for s in legs[1]["stops"]:
        for r in place(s[1]).get("works", []):
            if r[0] == s[0]:
                for v in r[8]:
                    if v in VERB and (best is None or VERB_ORDER.index(v) < VERB_ORDER.index(best)):
                        best = v
    t = short_title(titles.get(legs[2]["stops"][-1][0], "")) or "Untitled"
    art = "an " if t.lower().startswith("untitled") else "" if t.split(" ")[0].lower() in ("the", "a", "an") else "the "
    return "%s %s %s%s." % (towns[legs[0]["stops"][0][1]], VERB[best or "other"], art, t)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--add")
    ap.add_argument("--by", default="a visitor")
    ap.add_argument("--month", type=int, help="the month a squirrel buried its work (0-11); default the month sent")
    args = ap.parse_args()
    sent = json.load(open(SENT)) if os.path.exists(SENT) else []
    works, towns, cast = lists()
    if args.add:
        c = decode(args.add, works, towns, cast)
        if c["stale"]:
            raise SystemExit("the check fails: made against an earlier map, or a letter out")
        if len(c["legs"]) != 3:
            raise SystemExit("only a complete corpse (three legs) is published")
        import datetime
        sent.append({"code": c["code"], "by": args.by, "legs": c["legs"],
                     "month": args.month if args.month is not None else datetime.date.today().month - 1})
        with open(SENT, "w") as f:
            json.dump(sent, f, ensure_ascii=False, indent=1)
            f.write("\n")
    with open(os.path.join(V2, "finding.json")) as f:
        titles = {w[0]: w[1] for w in json.load(f)["w"]}
    with open(os.path.join(V2, "cities.json")) as f:
        names = {t[0]: t[1].split(",")[0] for t in json.load(f)["towns"]}
    made, caches, trails, wallows = [], [], [], []
    for i, s in enumerate(sent):
        cid = "p%d" % (i + 1)
        made.append({"id": cid, "title": sentence(s["legs"], titles, names), "by": s["by"], "code": s["code"],
                     "legs": s["legs"]})
        prev = None
        for leg in s["legs"]:
            keys = [k for k in ([prev] if prev else []) + [st[1] for st in leg["stops"]] if k]
            if leg["a"] == "squirrel":
                caches.extend([b[0], b[1], b[2], s.get("month", 9), cid] for b in leg["buried"])
            if leg["a"] == "slug":
                trails.append([cid, keys])
            if leg["a"] == "bison":
                wallows.extend([st[1], cid] for st in leg["stops"])
            if leg["stops"]:
                prev = leg["stops"][-1][1]
    out = {"note": NOTE, "made": made, "caches": caches, "trails": trails, "wallows": wallows}
    with open(OUT, "w") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")
    print("corpses:", len(made), " caches:", len(caches), " trails:", len(trails), " wallows:", len(wallows))


if __name__ == "__main__":
    main()
