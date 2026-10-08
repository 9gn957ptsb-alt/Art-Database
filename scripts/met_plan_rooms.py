#!/usr/bin/env python3
"""The Metropolitan Museum of Art's galleries on its two main floors, read off its visitor floor plans.

The Met publishes no gallery geometry. What is public: its visitor floor plans ("Floor 1 and Mezzanines",
"Floor 2 and Floor 3"), each a picture of the numbered galleries with their walls and openings; where on
those pictures each gallery's number is printed (met-gallery-pixels.json, read off them by the
met-tour-project on GitHub); and, for 85 galleries, the point the Met's own map (maps.metmuseum.org) opens
on for that gallery, a latitude and longitude (galleryMaps.json, ARtifact on GitHub). All are reference
only, kept in data/plans/<slug>/ (gitignored); nothing of them is copied into the site. What is read:

  1. registration — each floor's plan pixels to metres in the model's frame by the affine that best puts
     the printed numbers on the Met's own map points (least squares, the worst residuals dropped until
     every one is within 4 m and 3× the median);
  2. the plan's walls — its thin blue-grey lines (text and icons, small and unjoined, set aside);
  3. the rooms — every gallery number a seed, and each floor pixel inside the model's footprint given to
     the seed it is nearest to by walking (never through a drawn wall), at most 30 m; so a room's outline
     follows the plan's walls where it has them and crosses the open floor midway where it has not. A few
     unnumbered spaces the plan names (the Great Hall) are seeds too. Each room is then the cells of the
     walk's grid (1 m, turned to the plan) whose middles are in it, as one polygon;
  4. the openings — wherever two rooms meet on open floor, not at a drawn wall: a doorway at the middle
     of that meeting, as wide as it (1.2 m to 4 m);
  5. the floors joined by the lifts the plan draws on both floors at one place.

Everything is reconstructed and said so: the plans are schematic, the registration is to 85 points of a
map, and a room's shape where the plan draws no wall is our rule (midway). A gallery the plan numbers
that is not inside the model, or under 6 m², is not drawn.

    python3 scripts/met_plan_rooms.py [--png dir]
    node scripts/check_interior.js docs/v2/interiors/museum-the-metropolitan-museum-of-art.json
"""

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage
from shapely.geometry import Point, Polygon, box
from shapely.ops import unary_union
from shapely import affinity

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_interiors as bi  # noqa: E402

SLUG = "museum-the-metropolitan-museum-of-art"
PLANS = bi.ROOT / "data" / "plans" / SLUG
READ = "2026-10-08"
R_EARTH = 6371008.8
CELL = 1.0
# The plan's floors: its picture, the floor's id, name and level (metres over the model's ground: Floor 1
# is entered from the Fifth Avenue steps, Floor 2 one gallery storey up; the model gives no floor levels,
# so the levels are ours), the unnumbered spaces the plan names (seed pixels), and the lifts the plan
# draws on both floors (pixel on each floor's picture).
FLOORS = {
    "1": {"img": "met-floor1.png", "id": "f1", "name": "Floor 1", "z": 0.0,
          "named": {"The Great Hall": (1010, 1205)},
          # the insets: Roof Garden, Modern and Contemporary mezzanine, American Wing mezzanine, Greek and
          # Roman mezzanine, and the title and notes (pixel boxes x0, y0, x1, y1)
          "insets": [(0, 0, 640, 70), (210, 70, 680, 215), (0, 225, 345, 500), (1400, 50, 1945, 365),
                     (30, 1360, 410, 1465), (490, 245, 810, 310)]},
    "2": {"img": "met-floor2.png", "id": "f2", "name": "Floor 2", "z": 8.0,
          "named": {},
          # the insets: the American Wing's and Asian Art's Floor 3, the title, the note on step-free access
          "insets": [(0, 0, 640, 80), (1300, 35, 1630, 215), (1490, 1260, 1790, 1360), (1795, 1215, 1885, 1415),
                     (1150, 1165, 1495, 1250)]},
}
# Lifts: (id, name, floor-1 pixel, floor-2 pixel), each drawn on both plans; the walk's lift is a 3 m
# square at the floor-1 point.
LIFTS = [("lift-great-hall-south", "elevator by the Great Hall", (1160, 1105), (1160, 945))]
# The 82nd Street entrance: the plan's arrow (outside) and the Great Hall's door (pixels, Floor 1).
ENTER = {"at": (998, 1330), "door": (998, 1290)}
MAX_WALK = 170               # plan pixels a room reaches from its number (about 30 m)
MIN_CELLS = 6


def model_xy(lat, lon, lat0, lon0):
    return ((lon - lon0) * math.pi / 180 * R_EARTH * math.cos(lat0 * math.pi / 180),
            -(lat - lat0) * math.pi / 180 * R_EARTH)


def register(fl, maps, pixels, lat0, lon0):
    """Pixel -> model metres, as a 3x2 matrix; and the points it rests on with their residuals."""
    pts = []
    for x in maps:
        u = x["mapURL"]
        m = re.search(r"floor=([^&#]+)", u)
        mm = re.search(r"#\d+(?:\.\d+)?/([-\d.]+)/([-\d.]+)", u)
        if not m or m.group(1) != fl or not mm or x["galleryNumber"] not in pixels.get(fl, {}):
            continue
        X, Y = model_xy(float(mm.group(1)), float(mm.group(2)), lat0, lon0)
        p = pixels[fl][x["galleryNumber"]]
        pts.append((x["galleryNumber"], p[0], p[1], X, Y))
    keep = list(pts)
    while True:
        A = np.array([[p[1], p[2], 1] for p in keep], float)
        B = np.array([[p[3], p[4]] for p in keep], float)
        sol, *_ = np.linalg.lstsq(A, B, rcond=None)
        res = np.linalg.norm(A @ sol - B, axis=1)
        worst = int(np.argmax(res))
        if res[worst] <= max(4.0, 3 * float(np.median(res))) or len(keep) <= 8:
            break
        keep.pop(worst)
    return sol, keep, res


def footprint(z):
    out = subprocess.run(["node", str(bi.ROOT / "scripts" / "interior_footprint.js"), SLUG, str(z)],
                         capture_output=True, text=True, check=True).stdout
    fp = json.loads(out)
    rows = fp["masks"][str(z)].split("\n")
    return fp, np.array([[c == "#" for c in r] for r in rows], bool)


def building_of(img, insets):
    """The plan's building in place: everything that is not its park, its street or the page's grey, closed
    up over the walls and words drawn on it, less the insets (the mezzanines and Floor 3, drawn apart from
    where they are), as its one large piece."""
    R, G, B = img[..., 0].astype(int), img[..., 1].astype(int), img[..., 2].astype(int)
    park = (np.abs(R - 232) < 10) & (np.abs(G - 240) < 8) & (np.abs(B - 216) < 10)
    grey = (np.abs(R - G) < 6) & (np.abs(G - B) < 6) & (R > 200) & (R < 236)
    m = ~park & ~grey
    for x0, y0, x1, y1 in insets:
        m[y0:y1, x0:x1] = False
    m = ndimage.binary_opening(m, structure=np.ones((5, 5)))
    lab, n = ndimage.label(m)
    if n:
        sizes = ndimage.sum(m, lab, index=np.arange(1, n + 1))
        m = lab == 1 + int(np.argmax(sizes))
    return ndimage.binary_fill_holes(m)


def walls_of(img):
    """The plan's drawn walls: its thin blue-grey lines. Text and icons are the same inks, but small and
    unjoined: a group of ink pixels whose box is under 20 px both ways and under 160 pixels (a digit, a
    letter) is set aside. The park and the street round the building are no floor."""
    R, G, B = img[..., 0].astype(int), img[..., 1].astype(int), img[..., 2].astype(int)
    ink = (R <= 182) & (B > R + 12) & (G > R) & (B - G < 48)
    lab, n = ndimage.label(ink, structure=np.ones((3, 3)))
    objs = ndimage.find_objects(lab)
    sizes = ndimage.sum(ink, lab, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    for i, sl in enumerate(objs):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        keep[i + 1] = not (max(h, w) < 20 and sizes[i] < 160)
    return keep[lab]


class Owner(dict):
    """Each grid cell (i, j) to the room holding it; and each room's cells (by)."""

    def __init__(self):
        super().__init__()
        self.by = {}

    def __setitem__(self, k, r):
        super().__setitem__(k, r)
        self.by.setdefault(r, []).append(k)


def seat(a, b, uv, owner, reach=3.0):
    """Where on the grid an opening between rooms a and b goes, near uv (grid metres): the middle between a
    cell of a and a cell of b that face each other along an axis across at most two cells of no room."""
    u, v = uv
    best = None
    for (i, j) in owner.by.get(a, ()):
        if abs(i + 0.5 - u) > reach + 2 or abs(j + 0.5 - v) > reach + 2:
            continue
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            for k in (1, 2, 3):
                o = owner.get((i + di * k, j + dj * k))
                if o == b:
                    m = (i + 0.5 + di * k / 2, j + 0.5 + dj * k / 2)
                    d = math.dist(m, uv)
                    if d <= reach and (best is None or d < best[0]):
                        best = (d, m)
                    break
                if o is not None:
                    break
    return best[1] if best else None


def grow(seeds, passable, steps):
    """Each passable pixel to the seed it is nearest to by walking (4-neighbour steps), up to `steps`."""
    lab = seeds.copy()
    st = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
    for _ in range(steps):
        grown = ndimage.grey_dilation(lab, footprint=st)
        new = (lab == 0) & passable & (grown > 0)
        if not new.any():
            break
        lab[new] = grown[new]
    return lab


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--png", help="a directory for pictures of the rooms read, over the plans")
    ap.add_argument("--dry", action="store_true")
    args = ap.parse_args()
    mus = [m for m in json.loads((bi.DOCS / "museums.json").read_text())["museums"] if m["slug"] == SLUG][0]
    lat0, lon0 = mus["lat"], mus["lon"]
    maps = json.loads((PLANS / "galleryMaps.json").read_text())
    pixels = json.loads((PLANS / "met-gallery-pixels.json").read_text())
    path = bi.OUT / f"{SLUG}.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    regs, floors, turn = {}, [], None
    for key, F in FLOORS.items():
        sol, kept, res = register(key, maps, pixels, lat0, lon0)
        regs[key] = sol
        print(f"  floor {key}: registered on {len(kept)} points, median {np.median(res):.1f} m, worst "
              f"{res.max():.1f} m", flush=True)
    # The rooms stay where the Met's own map puts them, not where the model is: the model (guessed, without
    # photographs) stands tens of metres off and lacks the Fifth Avenue front, which no turn, scale or shift
    # of the plan mends (tried: the best laid only half the building on it). So every room is anchored on
    # the Met's map points (INTERIORS.md, `anchor`), and its overreach is a finding for the model.
    for key, F in FLOORS.items():
        sol = regs[key]
        if turn is None:
            # The plan's own axes in the model's frame: its y axis (down the picture) is the grid's.
            ang = math.degrees(math.atan2(sol[1][1], sol[1][0]))
            turn = round(ang % 90, 1)
            ux = math.degrees(math.atan2(sol[0][1], sol[0][0]))
            print(f"  the plan's x axis at {ux:.1f}°, y at {ang:.1f}° from the model's x: grid turn {turn}", flush=True)
    cs, sn = math.cos(math.radians(turn)), math.sin(math.radians(turn))

    def to_grid(x, y):           # model frame -> the grid's (u along the turned x)
        return (x * cs + y * sn, -x * sn + y * cs)

    def from_grid(u, v):
        return (u * cs - v * sn, u * sn + v * cs)

    for key, F in FLOORS.items():
        sol = regs[key]
        img = np.array(Image.open(PLANS / F["img"]).convert("RGB"))
        H, W = img.shape[:2]
        # every pixel's model point, and whether it is the plan's building (not its insets)
        yy, xx = np.mgrid[0:H, 0:W]
        MX = xx * sol[0][0] + yy * sol[1][0] + sol[2][0]
        MY = xx * sol[0][1] + yy * sol[1][1] + sol[2][1]
        built = building_of(img, F["insets"])
        wall = walls_of(img)
        seeds = np.zeros((H, W), np.int32)
        names = {}
        for n, (px, py) in sorted(pixels.get(key, {}).items()):
            names[len(names) + 1] = ("gallery", n)
        for nm, (px, py) in F["named"].items():
            names[len(names) + 1] = ("named", nm)
        where = {}
        for k, (what, n) in names.items():
            px, py = (pixels[key][n] if what == "gallery" else F["named"][n])
            px, py = int(round(px)), int(round(py))
            if not (0 <= px < W and 0 <= py < H) or not built[py, px]:
                continue
            # the number's own ink is no wall
            wall[max(0, py - 12):py + 13, max(0, px - 22):px + 23] = False
            seeds[max(0, py - 3):py + 4, max(0, px - 3):px + 4] = k
            where[k] = (px, py)
        R_, G_, B_ = img[..., 0].astype(int), img[..., 1].astype(int), img[..., 2].astype(int)
        park = (np.abs(R_ - 232) < 10) & (np.abs(G_ - 240) < 8) & (np.abs(B_ - 216) < 10)
        street = (np.abs(R_ - G_) < 4) & (np.abs(G_ - B_) < 4) & (np.abs(R_ - 218) < 8)
        passable = built & ~wall & ~park & ~street
        lab = grow(seeds * passable, passable, MAX_WALK)
        # rooms on the grid: each 1 m cell whose middle is in the room
        xs, ys = MX[built], MY[built]
        gu, gv = to_grid(xs, ys)
        u0, u1 = math.floor(gu.min()) - 1, math.ceil(gu.max()) + 1
        v0, v1 = math.floor(gv.min()) - 1, math.ceil(gv.max()) + 1
        inv = np.linalg.inv(np.array([[sol[0][0], sol[0][1]], [sol[1][0], sol[1][1]]]))
        cells = {}
        for gu_ in np.arange(u0 + 0.5, u1, CELL):
            for gv_ in np.arange(v0 + 0.5, v1, CELL):
                mx, my = from_grid(gu_, gv_)
                px, py = (np.array([mx - sol[2][0], my - sol[2][1]]) @ inv)
                px, py = int(px), int(py)
                if 0 <= px < W and 0 <= py < H and lab[py, px] > 0:
                    cells.setdefault(int(lab[py, px]), []).append((gu_ - 0.5, gv_ - 0.5))
        rooms, ids, owner = [], {}, Owner()
        for k, cl in sorted(cells.items(), key=lambda t: names[t[0]][1]):
            what, n = names[k]
            if len(cl) < MIN_CELLS:
                continue
            g = unary_union([box(a, b, a + CELL, b + CELL) for a, b in cl])
            if g.geom_type == "MultiPolygon":
                g = max(g.geoms, key=lambda p: p.area)
            if g.area < MIN_CELLS:
                continue
            holes = sum(Polygon(h).area for h in g.interiors)
            if holes > 0.05 * g.area:
                print(f"    {n}: its cells ring {holes:.0f} m² of another room's; not drawn", flush=True)
                continue
            rid = ("G-" + n) if what == "gallery" else "N-" + re.sub(r"\W+", "-", n.lower()).strip("-")
            for a, b in cl:
                if g.contains(Point(a + CELL / 2, b + CELL / 2)):
                    owner[(round(a), round(b))] = rid
            # its outline less the cells' stairsteps, within 0.4 m (a cell is held by its middle)
            g = Polygon(g.exterior).simplify(0.4, preserve_topology=True)
            pts = [list(map(lambda t: round(t, 1), from_grid(a, b))) for a, b in list(g.exterior.coords)[:-1]]
            ids[k] = rid
            room = {"id": rid, "ref": [n, "Gallery " + n] if what == "gallery" else [n],
                    "name": ("Gallery " + n) if what == "gallery" else n,
                    "said": (n + ", on the Met's floor plan") if what == "gallery" else (n + ", as the Met's floor plan names it"),
                    "kind": "gallery" if what == "gallery" else "hall", "poly": pts,
                    "sure": "reconstructed", "src": ["met-plan", "met-pixels", "met-points"], "anchor": "met-points",
                    "tol": 3.0,
                    "note": "the cells nearest its number on the plan by walking, never through a drawn wall; "
                            "midway across open floor"}
            rooms.append(room)
        # openings: where two rooms meet on open floor
        meet = {}
        for dy, dx in ((0, 1), (1, 0)):
            a = lab[:H - dy, :W - dx]
            b = lab[dy:, dx:]
            hit = (a > 0) & (b > 0) & (a != b) & passable[:H - dy, :W - dx] & passable[dy:, dx:]
            ys_, xs_ = np.nonzero(hit)
            for y_, x_ in zip(ys_, xs_):
                p, q = int(a[y_, x_]), int(b[y_, x_])
                if p in ids and q in ids:
                    meet.setdefault((min(p, q), max(p, q)), []).append((x_, y_))
        opens = []
        for (p, q), pix in meet.items():
            pix = np.array(pix, float)
            # runs: pixels within 3 px of one another
            lab1 = np.zeros(len(pix), int) - 1
            c = 0
            for i in range(len(pix)):
                if lab1[i] >= 0:
                    continue
                st = [i]
                lab1[i] = c
                while st:
                    j = st.pop()
                    d = np.abs(pix - pix[j]).max(axis=1)
                    for k2 in np.nonzero((d <= 3) & (lab1 < 0))[0]:
                        lab1[k2] = c
                        st.append(k2)
                c += 1
            for r in range(c):
                run = pix[lab1 == r]
                ext = run.max(axis=0) - run.min(axis=0)
                L = math.hypot(*ext) * math.hypot(sol[0][0], sol[0][1])
                if L < 0.9:
                    continue
                mid = run[np.argmin(((run - run.mean(axis=0)) ** 2).sum(axis=1))]
                mx = mid[0] * sol[0][0] + mid[1] * sol[1][0] + sol[2][0]
                my = mid[0] * sol[0][1] + mid[1] * sol[1][1] + sol[2][1]
                # On the grid: the nearest place within 3 m where a cell of one faces a cell of the other
                # across at most two cells of neither (the wall the walk puts between them).
                at = seat(ids[p], ids[q], to_grid(mx, my), owner)
                if not at:
                    continue
                if any(o["a"] == ids[p] and o["b"] == ids[q] and math.dist(o["at"], at) < 2.5 for o in opens):
                    continue
                opens.append({"a": ids[p], "b": ids[q], "at": [round(c, 1) for c in from_grid(*at)],
                              "w": round(min(4.0, max(1.2, L)), 1), "h": None, "kind": "door" if L < 6 else "arch",
                              "sure": "reconstructed", "src": ["met-plan"], "note": f"open on the plan, {L:.1f} m"})
        opens.sort(key=lambda o: (o["a"], o["b"], o["at"]))
        floors.append({"id": F["id"], "name": F["name"], "z": F["z"], "sure": "reconstructed",
                       "src": ["met-plan", "model"],
                       "note": "its name and gallery numbers are the Met's plan's; its level is ours",
                       "rooms": rooms, "open": opens, "things": [], "stairs": [], "lifts": []})
        F["lab"], F["ids"], F["sol"], F["owner"] = lab, ids, sol, owner
        print(f"  {F['name']}: {len(rooms)} rooms, {len(opens)} openings", flush=True)
        if args.png:
            Path(args.png).mkdir(parents=True, exist_ok=True)
            rng = np.random.default_rng(1)
            pal = rng.integers(60, 230, (lab.max() + 1, 3)).astype(np.uint8)
            pal[0] = 0
            out = img.copy()
            sel = lab > 0
            out[sel] = (0.45 * out[sel] + 0.55 * pal[lab[sel]]).astype(np.uint8)
            out[wall] = (0, 0, 0)
            Image.fromarray(out).save(Path(args.png) / f"met-{key}.png")
    # lifts: a 3 m square at the floor-1 point, if each floor's room there is one room
    lifts = []
    for lid, nm, p1, p2 in LIFTS:
        s1 = FLOORS["1"]["sol"]
        mx = p1[0] * s1[0][0] + p1[1] * s1[1][0] + s1[2][0]
        my = p1[0] * s1[0][1] + p1[1] * s1[1][1] + s1[2][1]
        s2 = FLOORS["2"]["sol"]
        m2 = (p2[0] * s2[0][0] + p2[1] * s2[1][0] + s2[2][0], p2[0] * s2[0][1] + p2[1] * s2[1][1] + s2[2][1])
        print(f"  {lid}: floor 1 at {mx:.1f}, {my:.1f}; floor 2's at {m2[0]:.1f}, {m2[1]:.1f} "
              f"({math.dist((mx, my), m2):.1f} m apart)", flush=True)
        # its 3 m square: the nearest within 6 m that lies in one room on each floor, a cell clear of its walls
        u, vv = to_grid(mx, my)
        o1, o2 = FLOORS["1"]["owner"], FLOORS["2"]["owner"]
        best = None
        for i in range(math.floor(u) - 7, math.floor(u) + 6):
            for j in range(math.floor(vv) - 7, math.floor(vv) + 6):
                block = [(i + a, j + b) for a in range(-1, 4) for b in range(-1, 4)]
                r1 = {o1.get(c) for c in block}
                r2 = {o2.get(c) for c in block}
                if len(r1) == 1 and len(r2) == 1 and None not in r1 | r2:
                    d = math.dist((i + 1.5, j + 1.5), (u, vv))
                    if d <= 6 and (best is None or d < best[0]):
                        best = (d, i, j, r1.pop(), r2.pop())
        if not best:
            print(f"  {lid}: no place in one room on both floors near it; not drawn", flush=True)
            continue
        _, i, j, r1, r2 = best
        corner = from_grid(i, j)
        lifts.append({"id": lid, "name": nm, "rect": [round(corner[0], 2), round(corner[1], 2), 3, 3],
                      "floors": ["f1", "f2"], "sure": "reconstructed", "src": ["met-plan"],
                      "note": f"the lift the plan draws here on both floors, in {r1} and {r2}; its size and "
                              f"its place within {best[0]:.1f} m are ours"})
    floors[0]["lifts"] = lifts
    s1 = FLOORS["1"]["sol"]

    def P(p):
        return [round(p[0] * s1[0][0] + p[1] * s1[1][0] + s1[2][0], 2), round(p[0] * s1[0][1] + p[1] * s1[1][1] + s1[2][1], 2)]
    at, door = P(ENTER["at"]), P(ENTER["door"])
    # The door: the Great Hall's edge nearest the plan's arrow, facing it.
    o1 = FLOORS["1"]["owner"]
    hall = "N-the-great-hall"
    du, dv = to_grid(*door)
    au, av = to_grid(*at)
    step = (round((au - du) / max(1e-9, math.hypot(au - du, av - dv))), round((av - dv) / max(1e-9, math.hypot(au - du, av - dv))))
    if abs(step[0]) == abs(step[1]):
        step = (step[0], 0) if abs(au - du) > abs(av - dv) else (0, step[1])
    edge = min((c for c in o1.by.get(hall, []) if (c[0] + step[0], c[1] + step[1]) not in o1),
               key=lambda c: math.dist((c[0] + 0.5, c[1] + 0.5), (du, dv)))
    door = [round(t, 2) for t in from_grid(edge[0] + 0.5 + step[0] * 0.75, edge[1] + 0.5 + step[1] * 0.75)]
    at = [round(t, 2) for t in from_grid(edge[0] + 0.5 + step[0] * 4, edge[1] + 0.5 + step[1] * 4)]
    floors[0]["open"].insert(0, {"a": hall, "b": "outside", "at": door, "w": 3.0, "h": 4.0, "kind": "door",
                                 "sure": "reconstructed", "src": ["met-plan"],
                                 "note": "the plan's 82nd Street Entrance and Exit into the Great Hall; its width "
                                         "and head are ours"})
    face = round((math.degrees(math.atan2(door[0] - at[0], -(door[1] - at[1])))) % 360, 1)
    doc["grid"] = {"cell": CELL, "turn": turn}
    doc["enter"] = {"floor": "f1", "at": at, "face": face, "door": door, "out": [[at[0] - 3, at[1] - 3, 6, 6]],
                    "sure": "reconstructed", "src": ["met-plan"],
                    "note": "the plan's 82nd Street Entrance and Exit, up the steps into the Great Hall"}
    doc["floors"] = floors
    srcs = {s["id"]: s for s in doc.get("sources") or []}
    srcs["met-plan"] = {"id": "met-plan", "t": "the Met's visitor floor plans, 'Floor 1 and Mezzanines' and 'Floor 2 "
                        "and Floor 3', read for its numbered galleries, their walls and openings (never copied)",
                        "u": "https://github.com/tom4sg/met-tour-project (frontend/public)", "read": READ}
    srcs["met-pixels"] = {"id": "met-pixels", "t": "where each gallery's number is printed on those plans, as the "
                          "met-tour-project read them", "u": "https://github.com/tom4sg/met-tour-project "
                          "(frontend/public/met-gallery-pixels.json)", "read": READ}
    srcs["met-points"] = {"id": "met-points", "t": "the points the Met's own map opens on for 85 galleries "
                          "(maps.metmuseum.org links, gathered by the ARtifact project)",
                          "u": "https://github.com/norman8823/ARtifact (seed/json/galleryMaps.json)", "read": READ}
    order = ["model", "met-plan", "met-pixels", "met-points"]
    doc["sources"] = [srcs[k] for k in order if k in srcs] + [s for k, s in srcs.items() if k not in order]
    doc["from"] = {"met-plan": {"px": [0, 0], "m": round(math.hypot(s1[0][0], s1[0][1]), 5), "turn": round(
        math.degrees(math.atan2(s1[0][1], s1[0][0])), 1),
        "why": "each floor's plan pixels to the model's frame by the affine that puts its printed gallery "
               "numbers on the Met's own map points for them; px [0, 0] is the picture's corner; Floor 1: "
               + json.dumps([[round(c, 5) for c in r] for r in FLOORS["1"]["sol"].tolist()]) + ", Floor 2: "
               + json.dumps([[round(c, 5) for c in r] for r in FLOORS["2"]["sol"].tolist()])}}
    doc["building"] = "The Met Fifth Avenue"
    doc["notes"] = ("Rooms: the galleries the Met numbers on its visitor floor plans for Floor 1 and Floor 2, laid "
                    "into the model by the Met's own map points for 85 of them; each room the floor nearest its "
                    "number by walking, never through a wall the plan draws, so it follows the plan's walls where "
                    "there are any and crosses open floor midway; openings where two rooms meet on open floor. All "
                    "reconstructed. Not drawn: the mezzanines and Floor 3 (drawn in insets, not in place), the "
                    "Roof Garden. The rooms stand where the Met's own map puts them (anchored on its points), and "
                    "the model, guessed without photographs, stands off them and lacks the Fifth Avenue front: "
                    "the rooms past it are walled round and filed against the model. The two floors are joined by "
                    "the lift by the Great Hall; the grand staircase is not drawn (its run at this grid would be "
                    "longer than it is). Floor levels are ours.")
    if args.dry:
        return
    bi.write(path, doc)
    # An opening the walk cannot cut (its rooms' outlines, eased, no longer face there) goes.
    dropped = 0
    for _ in range(4):
        out = subprocess.run(["node", str(bi.ROOT / "scripts" / "check_interior.js"), str(path)], capture_output=True,
                             text=True).stdout
        bad = set(re.findall(r"error: opening (\S+) — (\S+) on (\S+): (?:no wall|the wall between)", out))
        if not bad:
            break
        for fl in doc["floors"]:
            n0 = len(fl["open"])
            fl["open"] = [o for o in fl["open"] if (o["a"], o["b"], fl["id"]) not in bad]
            dropped += n0 - len(fl["open"])
        bi.write(path, doc)
    print(f"  {dropped} openings the walk could not cut dropped", flush=True)


if __name__ == "__main__":
    main()
