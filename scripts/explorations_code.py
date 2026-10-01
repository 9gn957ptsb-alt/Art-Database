#!/usr/bin/env python3
"""Exploration codes (ex·…), read as docs/v2/explorations.js reads them.

The two must stay in step: the bits, the alphabets, the order of the kinds,
the check. A code is: version (2 bits, 1), a check (5: FNV-1a of the stops,
"k:id" and a relay stop's ":from", joined by "|", & 31), whether it is
titled (1; then the title's length (5) and each letter (5) in TITLE_ABC),
the number of stops (6), and each stop: its kind (3, KINDS) and its index
into that kind's public list (as many bits as the list needs), a relay stop
then the stop it was joined at (6). Lists: w finding.json's works, t
cities.json's towns, m museums.json, v voices.json's voices, h finding.json's
threads, a the cast (characters.json), r explorations.json's relay rows.

    python3 scripts/explorations_code.py "ex·0F3A-…"     prints the stops
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, "docs", "v2")
B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
TITLE_ABC = " abcdefghijklmnopqrstuvwxyz'-.&·"
KINDS = ["w", "t", "m", "v", "h", "a", "r", "|"]


def load(*p):
    with open(os.path.join(V2, *p)) as f:
        return json.load(f)


def lists():
    f = load("finding.json")
    ex = load("explorations.json") if os.path.exists(os.path.join(V2, "explorations.json")) else {"relay": []}
    return {
        "w": [w[0] for w in f["w"]],
        "t": [t[0] for t in load("cities.json")["towns"]],
        "m": [m["slug"] for m in load("museums.json")["museums"]],
        "v": [v[0] for v in load("voices.json")["voices"]],
        "h": [t[0] for t in f["t"]],
        "a": [c["id"] for c in load("characters", "characters.json")["cast"]],
        "r": [r[0] + ":" + r[1] for r in ex.get("relay", [])],
        "|": [""],
    }


def bits_for(n):
    n = max(2, n)
    b = 1
    while (1 << b) < n:
        b += 1
    return b


def check(stops):
    s = "|".join(st[0] + ":" + (st[1] or "") + (":" + str(st[2] if len(st) > 2 else 0) if st[0] == "r" else "")
                 for st in stops)
    h = 2166136261
    for ch in s:
        h ^= ord(ch)
        h = (h * 16777619) & 0xFFFFFFFF
    return h & 31


def decode(text, L=None):
    m = re.match(r"^\s*ex\s*[·.\-:\s/]+\s*([0-9a-z][0-9a-z\-\s]{2,})\s*$", text, re.I)
    if not m:
        return None
    body = re.sub(r"[\s\-]", "", m.group(1).upper()).replace("O", "0").replace("I", "1").replace("L", "1")
    L = L or lists()
    bits = []
    for c in body:
        v = B32.find(c)
        if v < 0:
            return None
        bits += [(v >> k) & 1 for k in range(4, -1, -1)]
    pos = [0]

    def take(n):
        if pos[0] + n > len(bits):
            raise ValueError("short")
        v = 0
        for b in bits[pos[0]:pos[0] + n]:
            v = v * 2 + b
        pos[0] += n
        return v
    try:
        if take(2) != 1:
            return None
        total = take(5)
        title = ""
        if take(1):
            title = "".join(TITLE_ABC[take(5)] for _ in range(take(5)))
            small = {"of", "the", "and", "by", "in", "to", "a", "at", "on", "for", "from", "with", "de", "la", "le", "van", "von"}
            title = " ".join(w if i and w in small else w[:1].upper() + w[1:] for i, w in enumerate(title.split(" ")))
        stops = []
        for _ in range(take(6)):
            k = KINDS[take(3)]
            if k == "|":
                stops.append(["|", ""])
                continue
            i = take(bits_for(len(L[k])))
            if i >= len(L[k]):
                return None
            st = [k, L[k][i]]
            if k == "r":
                st.append(take(6))
            stops.append(st)
    except ValueError:
        return None
    if len(bits) - pos[0] >= 5 or not stops:
        return None
    return {"title": title or "An exploration", "stops": stops, "stale": check(stops) != total}


if __name__ == "__main__":
    x = decode(sys.argv[1])
    print(json.dumps(x, ensure_ascii=False, indent=1) if x else "not an exploration code")
