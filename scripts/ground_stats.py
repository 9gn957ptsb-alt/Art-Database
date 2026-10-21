#!/usr/bin/env python3
"""What each city's ground says about itself: its grain, how many building cells stand at the default two
storeys (Overture gives no height), how many are dated, its tallest cell, and which of the rules now in force
its file was made or repaired by (docs/v2/grounds/REFINE.md, "Where the grounds are weakest").

    python3 scripts/ground_stats.py [key ...]        # all the skylines, or the cities named (london-gb ...)

Columns: n (cells a side), cell (metres), bcells (building cells), at2% (share at two storeys), dated%
(share of building cells with a year), top (storeys of the tallest), then P parts (building_part read),
T tunnels (left off the surface), C culverts (covered watercourses left off it), H heights (Wikidata,
EUBUCCO), B bridges, and the day it was read.
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GROUNDS = ROOT / "docs" / "v2" / "grounds"


def main():
    wanted = set(sys.argv[1:])
    print(f"{'city':18s} {'n':>4s} {'cell':>5s} {'bcells':>7s} {'at2%':>5s} {'dated%':>6s} {'top':>4s} P T C H B  read")
    for path in sorted(GROUNDS.glob("city-*.json")):
        key = path.stem[len("city-"):]
        if wanted and key not in wanted:
            continue
        g = json.loads(path.read_text(encoding="utf-8"))
        kind = g["kind"]
        tall = [max(0, ord(c) - 48) for c in g["tall"]]
        nb = kind.count("b")
        two = sum(1 for k, t in zip(kind, tall) if k == "b" and t == 2)
        built = g.get("built") or []
        dated = sum(1 for y in built if y)
        top = max((t for k, t in zip(kind, tall) if k == "b"), default=0)
        flags = " ".join(("P" if g.get("parts") else "-", "T" if g.get("tunnels") else "-",
                          "C" if g.get("culverts") else "-", "H" if g.get("heights") else "-", "B" if g.get("bridges") else "-"))
        print(f"{key:18s} {g['n']:4d} {g['side'] / g['n']:5.1f} {nb:7d} {100 * two / max(1, nb):5.0f} "
              f"{100 * dated / max(1, len(built)) if built else 0:6.0f} {top:4d} {flags}  {g.get('read')}")


if __name__ == "__main__":
    main()
