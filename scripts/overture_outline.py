#!/usr/bin/env python3
"""The outlines of the buildings round a place, in the frame of its model — for tracing a footprint.

A model of a building with its own spot (a museum, a public building) is set into the plot round it with 0,0 on
its point and north up (docs/v2/models/MODELS.md), so the building's outline in the free map data — the same Overture
Maps buildings (largely OpenStreetMap) that scripts/build_grounds.py cuts the plot from — can be dropped into a
model as `prism` points just as it is. This prints them: x metres east of the point, y metres south of it, each
building and building part with its name, height and floors where the data has them, its area, and its outline
simplified to a tolerance (0.6 m by default), the courtyards as holes.

    python3 scripts/overture_outline.py museum-musee-du-petit-palais [--half 110] [--tol 0.6] [--png out.png]
                                                                       [--min-area 150] [--release latest]

--png draws the buildings and a 20 m grid (the point in red) to check the trace against the photographs and
`node scripts/fit_ground.js docs/v2/models/<slug>.json` (how much of the model stands on the plot's building cells).
Reads Overture's public bucket anonymously, one place at a time; nothing is written but the PNG.
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import shapely

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import build_grounds as G  # noqa: E402  (its frame, its release and its reader)


def place(slug):
    for file, key in (("architecture.json", "buildings"), ("museums.json", "museums")):
        for b in json.loads((ROOT / "docs" / "v2" / file).read_text(encoding="utf-8")).get(key, []):
            if b["slug"] == slug:
                return b
    sys.exit(f"{slug}: no such building or museum")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("slug")
    ap.add_argument("--half", type=float, default=110, help="metres each way from the point")
    ap.add_argument("--tol", type=float, default=0.6, help="simplification tolerance, metres")
    ap.add_argument("--min-area", type=float, default=150, help="leave out anything under this many m2")
    ap.add_argument("--png")
    ap.add_argument("--release", default=None, help="latest, or a release such as 2026-09-23.0")
    args = ap.parse_args()
    if args.release:
        G.use_release(args.release)
    b = place(args.slug)
    if b.get("precision") not in ("exact", "street"):
        print(f"note: {args.slug} is placed only at its {b.get('precision')}; its outline is not known from its point")
    to_m, to_deg = G.local(b["lat"], b["lon"])
    w, s = to_deg(-args.half, -args.half)
    e, n = to_deg(args.half, args.half)
    rows = []
    for kind in ("building", "building_part"):
        cols = ["height", "num_floors", "names", "class", "subtype"] if kind == "building" else ["height", "num_floors", "names"]
        try:
            for r in G.overture("buildings", kind, cols, (w, s, e, n)):
                rows.append((kind, r))
        except Exception as err:  # noqa: BLE001
            print(f"{kind}: not read ({err})")

    def local(geom):
        return shapely.transform(geom, lambda a: np.column_stack(((a[:, 0] - b["lon"]) * 111320.0 * np.cos(np.radians(b["lat"])),
                                                                  -(a[:, 1] - b["lat"]) * 111320.0)))

    out = []
    for kind, r in rows:
        g = local(shapely.from_wkb(r["geometry"]))
        if g.area < args.min_area:
            continue
        out.append((kind, r, g))
    out.sort(key=lambda t: t[2].centroid.x ** 2 + t[2].centroid.y ** 2)
    print(f"{args.slug}: Overture release {G.RELEASE}; the point is 0,0 (x east, y south, metres); "
          f"{len(out)} outlines of {args.min_area:.0f} m2 or more within {args.half:.0f} m")
    for kind, r, g in out:
        name = (r.get("names") or {}).get("primary") if isinstance(r.get("names"), dict) else r.get("names")
        c = g.centroid
        print(f"\n{kind} \"{name or ''}\" height {r.get('height')} floors {r.get('num_floors')} area {g.area:.0f} m2 "
              f"centre {c.x:.0f},{c.y:.0f}{' · holds the point' if g.contains(shapely.Point(0, 0)) else ''}")
        for p in ([g] if g.geom_type == "Polygon" else list(g.geoms)):
            sp = p.simplify(args.tol)
            print("  outline", json.dumps([[round(x, 1), round(y, 1)] for x, y in sp.exterior.coords[:-1]]))
            for h in sp.interiors:
                print("  hole   ", json.dumps([[round(x, 1), round(y, 1)] for x, y in h.coords[:-1]]))

    if args.png:
        from PIL import Image, ImageDraw
        half = args.half
        scale = min(8.0, 1000.0 / (2 * half))
        side = int(2 * half * scale)
        im = Image.new("RGB", (side, side), (238, 236, 236))
        dr = ImageDraw.Draw(im)
        px = lambda x, y: ((x + half) * scale, (y + half) * scale)  # noqa: E731
        for kind, r, g in out:
            for p in ([g] if g.geom_type == "Polygon" else list(g.geoms)):
                dr.polygon([px(x, y) for x, y in p.exterior.coords], fill=(200, 190, 180) if kind == "building" else None,
                           outline=(60, 60, 60) if kind == "building" else (30, 60, 200))
                for h in p.interiors:
                    dr.polygon([px(x, y) for x, y in h.coords], fill=(238, 236, 236), outline=(60, 60, 60))
        for g_ in range(-int(half) // 20 * 20, int(half) + 1, 20):
            a = (g_ + half) * scale
            dr.line([(a, 0), (a, side)], fill=(255, 150, 150) if g_ == 0 else (225, 215, 215))
            dr.line([(0, a), (side, a)], fill=(255, 150, 150) if g_ == 0 else (225, 215, 215))
            if g_ % 40 == 0:
                dr.text((a + 2, 2), str(g_), fill=(120, 0, 0))
                dr.text((2, a + 2), str(g_), fill=(120, 0, 0))
        im.save(args.png)
        print(f"\nmap: {args.png} ({scale:.1f} px a metre)")


if __name__ == "__main__":
    main()
