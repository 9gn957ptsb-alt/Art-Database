#!/usr/bin/env python3
"""The Art Institute of Chicago's galleries, from its own API's points for them.

The Art Institute publishes, for each of its galleries, its number, title, floor, whether it is closed, and
a latitude and longitude (api.artic.edu/api/v1/galleries, CC0): where each gallery is, but not its walls.
No plan of the building can be read from a session (www.artic.edu refuses it). So each gallery is drawn by
a stated rule, reconstructed and said so in its `said` and `note`:

  room      the floor nearer its point than any other gallery's point of that floor (its Voronoi cell),
            within 9 m of its point either way (a square of 18 m, about the size of the building's
            galleries), on the walk's 0.5 m grid, north up (Chicago's grid is);
  opening   between two galleries of one floor whose rooms share a wall 2 m long or more and whose numbers
            follow one another (201 and 202; 127A and 127B): numbered in the order they are walked, the
            rule the museum's numbering gives. A doorway at the middle of the shared wall, 2.4 by 3.0 m;
  entrance  the Art Institute's own point for its "Michigan Avenue entrance/steps", into the floor-1 gallery
            nearest it.

Each room is anchored on the Art Institute's own point (`anchor`), so where the guessed model stands off it,
the room stands where the museum says and the overreach is filed against the model. A closed gallery
(is_closed) is drawn closed. The gardens, the terrace and the restaurant are not drawn. No floor is joined
to another: no source read gives the stairs (the Grand Staircase is described, not placed), so only the
entrance floor is walked from the door; the others are drawn, their works hung, come into by a cut.

    python3 scripts/aic_rooms.py [--refresh]
    node scripts/check_interior.js docs/v2/interiors/museum-art-institute-of-chicago.json
"""

import argparse
import json
import math
import re
import sys
from pathlib import Path

import numpy as np
from scipy.spatial import Voronoi
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_interiors as bi  # noqa: E402

SLUG = "museum-art-institute-of-chicago"
CACHE = bi.ROOT / "data" / "plans" / SLUG / "galleries.json"
R_EARTH = 6371008.8
HALF = 9.0                       # m either way of a gallery's point
CELL = 0.5
FLOORS = {"LL": ("ll", "Lower Level", -4.5), "1": ("f1", "Floor 1", 0.0), "2": ("f2", "Floor 2", 6.0),
          "3": ("f3", "Floor 3", 12.0)}
OUTDOOR = re.compile(r"garden|terrace|restaurant|entrance|steps", re.I)


def galleries(refresh):
    if CACHE.exists() and not refresh:
        return json.loads(CACHE.read_text())
    out = []
    for page in (1, 2, 3):
        d = bi._get("https://api.artic.edu/api/v1/galleries",
                    {"limit": 100, "page": page, "fields": "id,title,number,floor,latitude,longitude,is_closed"})
        if not d or not d.get("data"):
            break
        out += d["data"]
        if page >= d["pagination"]["total_pages"]:
            break
    got = {"read": bi.TODAY, "galleries": out}
    CACHE.parent.mkdir(parents=True, exist_ok=True)
    CACHE.write_text(json.dumps(got))
    return got


def numkey(n):
    m = re.match(r"(\d+)([A-Za-z]?)", n or "")
    return (int(m.group(1)), m.group(2).upper()) if m else None


def follow(a, b):
    """Whether two gallery numbers follow one another: 201 and 202; 127, 127A and 127B."""
    ka, kb = numkey(a), numkey(b)
    if not ka or not kb:
        return False
    if ka[0] == kb[0]:
        return ka[1] != kb[1] and abs(ord(ka[1] or "@") - ord(kb[1] or "@")) == 1
    return abs(ka[0] - kb[0]) == 1 and not ka[1] and not kb[1]


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    got = galleries(args.refresh)
    mus = [m for m in json.loads((bi.DOCS / "museums.json").read_text())["museums"] if m["slug"] == SLUG][0]
    lat0, lon0 = mus["lat"], mus["lon"]

    def xy(g):
        return ((g["longitude"] - lon0) * math.pi / 180 * R_EARTH * math.cos(lat0 * math.pi / 180),
                -(g["latitude"] - lat0) * math.pi / 180 * R_EARTH)

    entrance = next((g for g in got["galleries"] if re.search(r"Michigan Avenue entrance", g["title"] or "")), None)
    path = bi.OUT / f"{SLUG}.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    floors = []
    for key, (fid, fname, z) in FLOORS.items():
        gs = [g for g in got["galleries"] if g["floor"] == key and g["latitude"] is not None
              and not OUTDOOR.search(g["title"] or "")]
        if len(gs) < 2:
            continue
        pts = np.array([xy(g) for g in gs])
        far = np.array([[-1e4, -1e4], [1e4, -1e4], [1e4, 1e4], [-1e4, 1e4]])
        vor = Voronoi(np.vstack([pts, far]))
        rooms, shapes = [], {}
        parts = {}
        for i, g in enumerate(gs):
            reg = vor.regions[vor.point_region[i]]
            if -1 in reg or not reg:
                continue
            cell = Polygon(vor.vertices[reg])
            sq = box(pts[i][0] - HALF, pts[i][1] - HALF, pts[i][0] + HALF, pts[i][1] + HALF)
            p = cell.intersection(sq)
            if p.is_empty:
                continue
            n = g["number"]
            num = n.rstrip("-") if n else None
            rid = ("G-" + num) if num else "N-" + re.sub(r"\W+", "-", g["title"].lower()).strip("-")
            # one gallery under two points (its API gives some two) is one room, round both
            parts.setdefault(rid, [g, num, []])[2].append(p)
        for rid, (g, num, ps) in sorted(parts.items()):
            p = unary_union(ps)
            if p.area < 9:
                continue
            # on the grid: the half-metre cells whose middles are in it, as one outline
            x0, y0, x1, y1 = p.bounds
            cells = [box(a, b, a + CELL, b + CELL)
                     for a in np.arange(math.floor(x0 / CELL) * CELL, x1, CELL)
                     for b in np.arange(math.floor(y0 / CELL) * CELL, y1, CELL)
                     if p.contains(Point(a + CELL / 2, b + CELL / 2))]
            if not cells:
                continue
            q = unary_union(cells)
            if q.geom_type == "MultiPolygon":
                q = max(q.geoms, key=lambda t: t.area)
            q = Polygon(q.exterior).simplify(0.01)
            title = g["title"]
            kind = "closed" if g.get("is_closed") else ("cafe" if re.search(r"caf", title, re.I) else
                                                        "gallery" if num else "hall")
            refs = [title, str(g["id"])] + ([num, "Gallery " + num] if num else [])
            rooms.append({"id": rid, "ref": list(dict.fromkeys(refs)), "name": title,
                          "said": f"{title}: the Art Institute's point for it, floor {key}" +
                                  ("; closed, in its record" if g.get("is_closed") else ""),
                          "kind": kind, "poly": [[round(a, 2), round(b, 2)] for a, b in list(q.exterior.coords)[:-1]],
                          "sure": "reconstructed", "src": ["aic-galleries"], "anchor": "aic-galleries", "tol": 6.0,
                          "note": "the floor nearer its point than any other gallery's, within 9 m of it: the rule"})
            shapes[rid] = (q, num)
        opens = []
        ids = sorted(shapes)
        for i, a in enumerate(ids):
            for b in ids[i + 1:]:
                (qa, na), (qb, nb) = shapes[a], shapes[b]
                if not follow(na, nb):
                    continue
                shared = qa.buffer(0.3).intersection(qb.buffer(0.3))
                if shared.is_empty:
                    continue
                L = max(shared.bounds[2] - shared.bounds[0], shared.bounds[3] - shared.bounds[1])
                if L < 2.0:
                    continue
                c = shared.centroid
                opens.append({"a": a, "b": b, "at": [round(c.x, 2), round(c.y, 2)], "w": 2.4, "h": 3.0, "kind": "door",
                              "sure": "reconstructed", "src": ["aic-galleries"],
                              "note": "numbered one after the other, sharing a wall: a doorway at its middle, the rule's "
                                      "2.4 by 3.0 m"})
        floors.append({"id": fid, "name": fname, "z": z, "sure": "reconstructed", "src": ["aic-galleries"],
                       "note": "its rooms are the Art Institute's galleries, drawn round its points by rule; its level "
                               "is ours", "rooms": sorted(rooms, key=lambda r: r["id"]), "open": opens,
                       "things": [], "stairs": [], "lifts": []})
        print(f"  {fname}: {len(rooms)} rooms, {len(opens)} openings", flush=True)
    f1 = next(f for f in floors if f["id"] == "f1")
    if entrance:
        ex, ey = xy(entrance)
        best = min(f1["rooms"], key=lambda r: Polygon(r["poly"]).exterior.distance(Point(ex, ey)) if r["kind"] != "closed" else 1e9)
        poly = Polygon(best["poly"])
        door = poly.exterior.interpolate(poly.exterior.project(Point(ex, ey)))
        dx, dy = ex - door.x, ey - door.y
        L = math.hypot(dx, dy) or 1
        at = [round(door.x + dx / L * 3, 2), round(door.y + dy / L * 3, 2)]
        f1["open"].insert(0, {"a": best["id"], "b": "outside", "at": [round(door.x, 2), round(door.y, 2)], "w": 3.0,
                              "h": 4.0, "kind": "door", "sure": "reconstructed", "src": ["aic-galleries"],
                              "note": "toward the Art Institute's own point for its Michigan Avenue entrance; the "
                                      "door's place on the room's edge and its size are ours"})
        doc["enter"] = {"floor": "f1", "at": at, "face": round(math.degrees(math.atan2(-dx, dy)) % 360, 1),
                        "door": [round(door.x, 2), round(door.y, 2)], "out": [[at[0] - 3, at[1] - 3, 6, 6]],
                        "sure": "reconstructed", "src": ["aic-galleries"],
                        "note": f"the Michigan Avenue entrance (the Art Institute's point for it), into {best['name']}"}
    doc["grid"] = {"cell": CELL, "turn": 0}
    doc["floors"] = floors
    srcs = {s["id"]: s for s in doc.get("sources") or []}
    srcs["aic-galleries"] = {"id": "aic-galleries", "t": "the Art Institute of Chicago's API: each gallery's number, "
                             "title, floor, point and whether it is closed", "u": "https://api.artic.edu/api/v1/galleries",
                             "licence": "CC0-1.0", "read": got["read"]}
    doc["sources"] = [srcs[k] for k in ("model", "aic-galleries") if k in srcs] + \
        [s for k, s in srcs.items() if k not in ("model", "aic-galleries")]
    doc["notes"] = ("Rooms: the Art Institute's own galleries, each drawn round the point its API gives for it by a "
                    "stated rule (the floor nearer its point than any other's, within 9 m), anchored on those points; "
                    "doorways only between galleries numbered one after the other that share a wall. No plan of the "
                    "building could be read, so walls, doorways and the stairs between floors are not known: only "
                    "Floor 1 is walked from the Michigan Avenue door; the other floors' works hang, come into by a cut. "
                    "The model, guessed, stands west of the museum's points.")
    bi.write(path, doc)


if __name__ == "__main__":
    main()
