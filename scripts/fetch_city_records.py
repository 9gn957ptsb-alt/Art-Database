#!/usr/bin/env python3
"""The cities' own building years, from sources that do not answer the Claude sessions.

The artist, 8 Oct 2026: "Right now there are plenty of places in which the map does not show up
before a certain date, many European cities do not show up until the 1940s or 60s. Use any available
information you have across the Internet to fill in the geographical maps of cities that are blank
before a certain date." Several cities publish when their buildings went up — a year a building, or
a period a block or a census section — on servers the sessions' network does not reach (Spain's
Catastro answers nothing; others are not on its list). This runs where they answer: on GitHub's
runners (.github/workflows/city-records.yml), or anywhere with a route to them.

For every ground (docs/v2/grounds/<slug>.json, the squares build_grounds.py cuts round the cities'
skylines, the museums, the buildings and the lives' places) that a source in SOURCES covers, it reads
the source over the square and gives each building cell the year of the outline (or block, or section)
it stands in — the same join build_built_years.py makes for the sources that do answer the session
(join_years) — and writes

    records/years/<slug>.json   {sources, licence, read, floor, n, side, cells: {cell index: year}}

with only the cells a source dates (a year; -1 for "old": a source's open first class, "before 1919",
whose year is its `floor`). Building cells are indexed i * n + j, row i from the north. Nothing
personal is read or kept: years and outlines only, and only the years are written. build_built_years.py
reads these after the city's own source and before OpenStreetMap's dates and the satellites.

    python3 scripts/fetch_city_records.py [--only slug] [--source name] [--list]
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_built_years as B  # noqa: E402
from build_grounds import local  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GROUNDS = ROOT / "docs" / "v2" / "grounds"
OUT = ROOT / "records" / "years"
DATA = ROOT / "data" / "records"          # downloads, not committed (and on a runner, thrown away)

# (name builtFrom gives it, licence, (south, west, north, east), floor or None, reader(box) -> answer)
# An answer is build_built_years' ("polys", [(year, ring [(lon, lat)...])]) or ("points", [(lat, lon,
# year[, radius m])]); a year of -1 is "old" (before the floor). Readers are added below as their
# sources are confirmed (see the docstring of each).
SOURCES = []


def cells_of(place, g):
    """The ground's building cells: their indexes and their middles (lat, lon)."""
    n, side = g["n"], g["side"]
    cell = side / n
    half = side / 2
    _, to_deg = local(place["lat"], place["lon"])
    idx = [k for k in range(n * n) if g["kind"][k] == "b"]
    pts = [to_deg((k % n + 0.5) * cell - half, half - (k // n + 0.5) * cell) for k in idx]
    lon = np.array([p[0] for p in pts])
    lat = np.array([p[1] for p in pts])
    return idx, lat, lon, cell


def square(place, g):
    _, to_deg = local(place["lat"], place["lon"])
    half = g["side"] / 2
    w, s = to_deg(-half, -half)
    e, n = to_deg(half, half)
    return (s, w, n, e)


def places():
    out = []
    for f in B.PLACES:
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            out += [p for p in d.get("buildings", d.get("museums", d.get("places", [])))
                    if isinstance(p.get("lat"), (int, float))]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--only", help="one ground's slug")
    ap.add_argument("--source", help="one source, by (part of) its name")
    ap.add_argument("--list", action="store_true", help="list the grounds each source covers, and stop")
    args = ap.parse_args()
    todo = []
    for name, licence, (s, w, n, e), floor, reader in SOURCES:
        if args.source and args.source.lower() not in name.lower():
            continue
        for p in places():
            if args.only and p["slug"] != args.only:
                continue
            if s <= p["lat"] <= n and w <= p["lon"] <= e and (GROUNDS / (p["slug"] + ".json")).exists():
                todo.append((name, licence, floor, reader, p))
    if args.list:
        for name, _, _, _, p in todo:
            print(f"{name}: {p['slug']}")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    DATA.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y-%m-%d", time.gmtime())
    done = {}
    for name, licence, floor, reader, p in todo:
        g = json.loads((GROUNDS / (p["slug"] + ".json")).read_text(encoding="utf-8"))
        idx, lat, lon, cell = cells_of(p, g)
        if not idx:
            continue
        try:
            got = reader(square(p, g))
        except Exception as exc:          # one source failing keeps none of the others back
            print(f"  ! {name} · {p['slug']}: {type(exc).__name__}: {exc}", flush=True)
            continue
        years = B.join_years(got, lat, lon, cell)
        if years is None:
            print(f"  · {name} · {p['slug']}: nothing in its square", flush=True)
            continue
        rec = done.setdefault(p["slug"], {"sources": [], "licence": [], "read": stamp, "floor": None,
                                          "n": g["n"], "side": g["side"], "cells": {}})
        took = 0
        for k, y in zip(idx, years.tolist()):
            if y and str(k) not in rec["cells"]:          # the first source listed for a place wins
                rec["cells"][str(k)] = int(y)
                took += 1
        if took:
            rec["sources"].append(name)
            rec["licence"].append(licence)
            if floor and any(v < 0 for v in rec["cells"].values()):
                rec["floor"] = max(rec["floor"] or 0, floor)
        dated = sum(1 for y in years.tolist() if y > 0)
        old = sum(1 for y in years.tolist() if y < 0)
        print(f"  + {name} · {p['slug']}: {dated} of {len(idx)} cells dated, {old} old", flush=True)
    for slug, rec in done.items():
        if rec["cells"]:
            (OUT / (slug + ".json")).write_text(json.dumps(rec, separators=(",", ":"), sort_keys=True),
                                               encoding="utf-8")
    print(f"\nWrote {sum(1 for r in done.values() if r['cells'])} record(s) into {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
