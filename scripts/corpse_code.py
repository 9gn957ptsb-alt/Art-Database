"""Corpse codes (docs/v2/corpse.js), in Python: decode, encode, check.

A corpse travels as `corpse·` + Crockford base 32 in fours: version 3 bits
(1), a 5-bit check, the number of legs 2; each leg its animal (4 bits, the
index in characters/characters.json's cast), whether the site walked it (1),
its number of stops (3), whether it buried a work (1, then that stop); each
stop its work (13 bits, the index in finding.json's works), its city (10,
cities.json's towns) and its year (11, from 1000; 0 not recorded).

    python3 scripts/corpse_code.py CODE      # prints the corpse, decoded

The check is FNV-1a over "animal:work@city@year,..." per leg, joined by
"|", the buried stop last — as the page does it.
"""

import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, "docs", "v2")
B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
WB, TB, YB = 13, 10, 11


def lists():
    with open(os.path.join(V2, "finding.json")) as f:
        works = [w[0] for w in json.load(f)["w"]]
    with open(os.path.join(V2, "cities.json")) as f:
        towns = [t[0] for t in json.load(f)["towns"]]
    with open(os.path.join(V2, "characters", "characters.json")) as f:
        cast = [c["id"] for c in json.load(f)["cast"]]
    return works, towns, cast


def fnv(s):
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h


def check_of(legs):
    return fnv("|".join(
        leg["a"] + ":" + ",".join("%s@%s@%d" % (s[0], s[1], s[2] or 0) for s in leg["stops"] + leg["buried"])
        for leg in legs)) & 31


def body_of(code):
    text = code.strip()
    low = text.lower()
    if not low.startswith("corpse"):
        raise ValueError("not a corpse code")
    body = text[6:].lstrip("·.-:/ \t")
    body = body.upper().replace("-", "").replace(" ", "").replace("O", "0").replace("I", "1").replace("L", "1")
    return body


def decode(code, works=None, towns=None, cast=None):
    if works is None:
        works, towns, cast = lists()
    body = body_of(code)
    bits = []
    for ch in body:
        v = B32.index(ch)
        bits.extend((v >> k) & 1 for k in range(4, -1, -1))
    at = [0]

    def take(n):
        if at[0] + n > len(bits):
            raise ValueError("code too short")
        v = 0
        for b in bits[at[0]:at[0] + n]:
            v = v * 2 + b
        at[0] += n
        return v

    def stop():
        w, t, y = take(WB), take(TB), take(YB)
        return [works[w], towns[t], y + 1000 if y else 0]

    if take(3) != 1:
        raise ValueError("unknown version")
    total = take(5)
    legs = []
    for _ in range(take(2)):
        a = cast[take(4)]
        site = take(1)
        n = take(3)
        has_b = take(1)
        leg = {"a": a, "by": "site" if site else "a player", "stops": [], "buried": []}
        if has_b:
            leg["buried"].append(stop())
        for _ in range(n):
            leg["stops"].append(stop())
        legs.append(leg)
    if len(bits) - at[0] >= 5:
        raise ValueError("trailing characters")
    return {"legs": legs, "stale": check_of(legs) != total,
            "code": "corpse·" + "-".join(body[i:i + 4] for i in range(0, len(body), 4))}


def encode(legs, works=None, towns=None, cast=None):
    if works is None:
        works, towns, cast = lists()
    wi = {w: i for i, w in enumerate(works)}
    ti = {t: i for i, t in enumerate(towns)}
    ci = {c: i for i, c in enumerate(cast)}
    bits = []

    def put(v, n):
        bits.extend((v >> k) & 1 for k in range(n - 1, -1, -1))

    def stop(s):
        put(wi[s[0]], WB)
        put(ti[s[1]], TB)
        put(max(0, min(2047, s[2] - 1000)) if s[2] else 0, YB)

    put(1, 3)
    put(check_of(legs), 5)
    put(len(legs), 2)
    for leg in legs:
        put(ci[leg["a"]], 4)
        put(1 if leg.get("by", "").startswith("site") else 0, 1)
        put(len(leg["stops"]), 3)
        put(1 if leg["buried"] else 0, 1)
        if leg["buried"]:
            stop(leg["buried"][0])
        for s in leg["stops"]:
            stop(s)
    while len(bits) % 5:
        bits.append(0)
    out = "".join(B32[int("".join(map(str, bits[i:i + 5])), 2)] for i in range(0, len(bits), 5))
    return "corpse·" + "-".join(out[i:i + 4] for i in range(0, len(out), 4))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    print(json.dumps(decode(" ".join(sys.argv[1:])), ensure_ascii=False, indent=1))
