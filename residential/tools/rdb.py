#!/usr/bin/env python3
"""Compile a residential project (residential/projects/<slug>.json) into a SketchUp
build plan: every room as its own group of closed solids (floor, its share of the
walls, glass, roof), placed by the connector engine (engine.py) without any
geometry math on the SketchUp side.

    python3 residential/tools/rdb.py residential/projects/<slug>.json [--out DIR]

Writes <DIR>/<slug>.plan.json (the build plan) and <DIR>/<slug>.rooms.json (the
room index rows), and prints warnings. Data is in metres; the plan is in inches.
SCHEMA.md describes the project format.
"""
import json
import math
import sys
from pathlib import Path

from shapely.geometry import Polygon
from shapely.ops import unary_union

sys.path.insert(0, str(Path(__file__).resolve().parent))
import primitives  # noqa: E402

primitives.math = math

IN = 39.37007874015748          # inches per metre
TOL = 0.01                      # metres: points closer than this are the same point
SILL_MIN = 0.012                # openings stay inner loops: never quite reach floor or top

MATERIALS = {
    "plaster": (238, 236, 230), "render": (242, 240, 235), "white": (250, 250, 248),
    "concrete": (178, 176, 170), "concrete_dark": (120, 120, 118), "brick": (160, 82, 60),
    "stone": (196, 184, 160), "travertine": (214, 200, 172), "marble": (232, 230, 226),
    "limestone": (222, 212, 190), "oak": (190, 150, 100), "walnut": (110, 78, 52),
    "timber": (168, 120, 78), "timber_dark": (95, 70, 50), "wood_floor": (178, 138, 92),
    "tile": (220, 218, 210), "terracotta": (190, 110, 75), "adobe": (200, 160, 120),
    "glass": (170, 205, 220, 90), "metal_dark": (60, 62, 66), "metal": (160, 164, 170),
    "steel": (140, 145, 150), "zinc": (130, 136, 140), "slate": (70, 74, 80),
    "roof_tile": (165, 85, 60), "thatch": (180, 150, 90), "water": (90, 160, 200, 140),
    "grass": (110, 150, 80), "gravel": (180, 172, 160), "earth": (150, 120, 90),
    "black": (30, 30, 32), "carpet": (150, 140, 130),
}
OUTDOOR = {"terrace", "patio", "courtyard", "balcony", "deck", "pool_area", "garden", "porch", "roof_terrace"}
WALLED = {"ext", "int", "int_full", "glass", "low", "rail"}


class Problem(Exception):
    pass


# ---------- small vector helpers (2D in metres) ----------

def sub(a, b): return (a[0] - b[0], a[1] - b[1])
def add(a, b): return (a[0] + b[0], a[1] + b[1])
def mul(a, s): return (a[0] * s, a[1] * s)
def dot(a, b): return a[0] * b[0] + a[1] * b[1]
def cross(a, b): return a[0] * b[1] - a[1] * b[0]
def norm(a): return math.hypot(a[0], a[1])
def unit(a):
    n = norm(a)
    return (a[0] / n, a[1] / n)
def left(d): return (-d[1], d[0])


def signed_area(pts):
    return sum(cross(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))) / 2


def intersect(p, d, q, e):
    den = cross(d, e)
    if abs(den) < 1e-9:
        return None
    t = cross(sub(q, p), e) / den
    return add(p, mul(d, t))


def plane_z(plane, x, y):
    a, b, c = plane
    return a * x + b * y + c


# ---------- solids: compact specs, realised by primitives.py ----------

def r4(v):
    return round(float(v), 4)


class Leaf:
    """One closed solid: a kind ('prism' or 'wall') and its spec, in world metres."""

    def __init__(self, name, mat, kind, spec):
        self.name, self.mat, self.kind, self.spec = name, mat, kind, spec

    def realize(self):
        return primitives.realize(self.kind, self.spec)


def mesh_stats(V, F):
    """(signed volume m3, number of edge uses that break closure)."""
    vol = 0.0
    uses = {}
    for fc in F:
        for lp in fc[1:]:
            pts = [V[i] for i in lp]
            for i in range(1, len(pts) - 1):
                a, b, c = pts[0], pts[i], pts[i + 1]
                vol += (a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0])
                        + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6
            for i in range(len(lp)):
                e = (lp[i], lp[(i + 1) % len(lp)])
                uses[e] = uses.get(e, 0) + 1
    bad = sum(1 for (a, b), c in uses.items() if c != 1 or uses.get((b, a), 0) != 1)
    return vol, bad


def prism(name, mat, rings, zb, zt, top_mat=None, bottom_mat=None, side_mat=None):
    """Polygon (outer ring + hole rings, metres) extruded between two planes zb, zt (a,b,c)."""
    spec = {"r": [[[r4(x), r4(y)] for x, y in r] for r in rings], "zb": [r4(c) for c in zb], "zt": [r4(c) for c in zt]}
    for k, v in (("mt", top_mat), ("mb", bottom_mat), ("ms", side_mat)):
        if v:
            spec[k] = v
    return Leaf(name, mat, "prism", spec)


# ---------- project loading and normalisation ----------

def load(path):
    p = json.load(open(path, encoding="utf-8"))
    if p.get("schema") != "residential-db/1":
        raise Problem("schema must be residential-db/1")
    return p


def defaults(p):
    d = {"ext_t": 0.30, "int_t": 0.12, "glass_t": 0.12, "slab": 0.30, "ground_slab": 0.25, "roof_t": 0.35,
         "door_h": 2.2, "window_sill": 0.9, "window_head": 2.3, "low_h": 1.0, "rail_h": 1.05,
         "ext_finish": "render", "int_finish": "plaster", "floor": "concrete", "roof_finish": "concrete",
         "frame": "metal_dark"}
    d.update(p.get("defaults", {}))
    return d


def material_table(p):
    mats = {k: list(v) + ([255] if len(v) == 3 else []) for k, v in MATERIALS.items()}
    for k, v in p.get("materials", {}).items():
        mats[k] = list(v) + ([255] if len(v) == 3 else [])
    return mats


class Room:
    def __init__(self, r, level, D):
        self.raw = r
        self.id, self.name, self.type = r["id"], r.get("name", r["id"]), r.get("type", "other")
        self.level = level
        pts = [tuple(map(float, q)) for q in r["outline"]]
        walls = list(r.get("walls") or [None] * len(pts))
        if len(walls) != len(pts):
            raise Problem(f"{self.id}: walls has {len(walls)} entries for {len(pts)} outline edges")
        walls = [dict(w) if isinstance(w, dict) else ({"kind": w} if isinstance(w, str) else {}) for w in walls]
        if signed_area(pts) < 0:                   # make counter-clockwise, remapping edges
            n = len(pts)
            pts = pts[::-1]
            old = walls
            walls = []
            for k in range(n):
                w = dict(old[(n - 2 - k) % n])
                L = norm(sub(pts[(k + 1) % n], pts[k]))
                w["openings"] = [dict(o, at=L - o["at"] - o["w"]) for o in w.get("openings", [])]
                walls.append(w)
        self.pts, self.walls = pts, walls
        self.ffl = level["elevation"] + float(r.get("ffl_offset", 0.0))
        self.D = D
        self.outdoor = self.type in OUTDOOR

    def poly(self):
        return Polygon(self.pts)


def split_edges(rooms):
    """Insert every other same-level room's vertices that lie on this room's edges, so shared
    wall stretches become whole edges. Sub-edges inherit the parent edge's wall spec."""
    for r in rooms:
        others = [q for o in rooms if o is not r and o.level["id"] == r.level["id"] for q in o.pts]
        pts, walls = [], []
        n = len(r.pts)
        for i in range(n):
            a, b = r.pts[i], r.pts[(i + 1) % n]
            d, L = unit(sub(b, a)), norm(sub(b, a))
            cuts = sorted({round(dot(sub(q, a), d), 4) for q in others
                           if abs(cross(d, sub(q, a))) < TOL and TOL < dot(sub(q, a), d) < L - TOL})
            bounds = [0.0] + cuts + [L]
            w = r.walls[i]
            for k in range(len(bounds) - 1):
                u0, u1 = bounds[k], bounds[k + 1]
                pts.append(add(a, mul(d, u0)))
                sw = {kk: vv for kk, vv in w.items() if kk != "openings"}
                sw["openings"] = [dict(o, at=o["at"] - u0) for o in w.get("openings", [])
                                  if u0 - TOL <= o["at"] + o["w"] / 2 < u1 - TOL]
                sw["_parent"] = i
                walls.append(sw)
        r.pts, r.walls = pts, walls


def neighbour_edges(rooms):
    """For each room edge, the other rooms' edges lying on the same line and overlapping it."""
    index = {}
    for r in rooms:
        n = len(r.pts)
        for i in range(n):
            a, b = r.pts[i], r.pts[(i + 1) % n]
            d, L = unit(sub(b, a)), norm(sub(b, a))
            hits = []
            for o in rooms:
                if o is r or o.level["id"] != r.level["id"] or abs(o.ffl - r.ffl) > 0.5:
                    continue
                m = len(o.pts)
                for j in range(m):
                    p, q = o.pts[j], o.pts[(j + 1) % m]
                    if abs(cross(d, sub(p, a))) > TOL or abs(cross(d, sub(q, a))) > TOL:
                        continue
                    u_p, u_q = dot(sub(p, a), d), dot(sub(q, a), d)
                    lo, hi = max(0, min(u_p, u_q)), min(L, max(u_p, u_q))
                    if hi - lo > TOL:
                        hits.append((o, j, lo, hi, u_q < u_p))
            index[(r.id, i)] = hits
    return index


def default_t(kind, D):
    return {"ext": D["ext_t"], "int": D["int_t"], "int_full": D["int_t"], "glass": D["glass_t"],
            "low": D["int_t"], "rail": 0.04, "open": 0.0}.get(kind, D["int_t"])


def resolve_walls(rooms, D, warn):
    """Decide who builds each wall and how thick it is, and mirror openings across shared walls.

    Two indoor rooms split an ordinary wall down its centreline (each owns half). Anything else
    shared is built once, full thickness, by one owner: the indoor room against an outdoor one,
    the lower room id for a glass, low or rail partition. The other side 'abuts': no solid, and
    its floor and clear area stop at the owner's face."""
    for r in rooms:
        for w in r.walls:
            w["_k"] = w.get("kind")
    nb = neighbour_edges(rooms)
    for r in rooms:
        n = len(r.pts)
        for i in range(n):
            w = r.walls[i]
            hits = nb[(r.id, i)]
            L = norm(sub(r.pts[(i + 1) % n], r.pts[i]))
            covered = sum(h[3] - h[2] for h in hits)
            shared = covered > L - 2 * TOL
            mine = w["_k"]
            builds = True
            if shared:
                o, j = hits[0][0], hits[0][1]
                theirs = o.walls[j]["_k"]
                ks = {mine, theirs} - {None}
                if "open" in ks or (r.outdoor and o.outdoor and not ks & {"low", "rail", "glass"}):
                    kind = "open"
                elif r.outdoor != o.outdoor:
                    owner_spec = o.walls[j] if r.outdoor else w
                    kind = owner_spec["_k"] if owner_spec["_k"] in ("ext", "glass", "low", "rail") else "ext"
                    t_owner = owner_spec.get("t", default_t(kind, D))
                    if r.outdoor:
                        kind, builds = "abut", False
                        w["t"] = t_owner
                elif ks & {"glass", "low", "rail"}:
                    kind = next(k for k in ("glass", "rail", "low") if k in ks)
                    if r.id > o.id:
                        t_owner = (w if mine == kind else o.walls[j]).get("t", default_t(kind, D))
                        kind, builds = "abut", False
                        w["t"] = t_owner
                else:
                    if "ext" in ks:
                        warn(f"{r.id} edge {i}: marked ext but shared with {o.id}; splitting it as an interior wall")
                    kind = "int"
                    ts = [x for x in (w.get("t"), o.walls[j].get("t")) if x is not None]
                    w["t"] = max(ts) if ts else D["int_t"]
            elif covered > TOL:
                warn(f"{r.id} edge {i}: only {covered:.2f} of {L:.2f} m shared with {hits[0][0].id}; owning it fully")
                kind = "int_full" if mine in (None, "int", "ext") and not r.outdoor else (mine or "open")
            else:
                kind = mine or ("open" if r.outdoor else "ext")
                if kind == "int":
                    kind = "int_full"
            t = float(w.get("t", default_t(kind, D)))
            ops = [dict(o) for o in w.get("openings", [])]
            if builds and kind != "open" and shared:          # mirror the neighbour's openings
                a = r.pts[i]
                d = unit(sub(r.pts[(i + 1) % n], a))
                for o, j, lo, hi, rev in hits:
                    p = o.pts[j]
                    for op in o.walls[j].get("openings", []):
                        u0 = dot(sub(p, a), d) + op["at"] if not rev else dot(sub(p, a), d) - op["at"] - op["w"]
                        if -TOL <= u0 and u0 + op["w"] <= L + TOL and all(abs(u0 - x["at"]) > 0.05 for x in ops):
                            ops.append(dict(op, at=u0))
            w.update(kind=kind, t=t, openings=ops if builds else [])


def offsets(kind, t):
    """(inward, outward) offset of the wall faces from the outline (the wall centreline)."""
    if kind == "open":
        return 0.0, 0.0
    if kind == "int":
        return t / 2, 0.0
    if kind == "abut":
        return t / 2, -t / 2
    return t / 2, t / 2


def corners(r):
    """Per edge, the wall's plan corners (outer start, outer end, inner end, inner start), plus
    the room's outer ring (slab) and inner ring (clear floor)."""
    n = len(r.pts)
    lines = []
    for i in range(n):
        a, b = r.pts[i], r.pts[(i + 1) % n]
        d = unit(sub(b, a))
        oi, oo = offsets(r.walls[i]["kind"], r.walls[i]["t"])
        lines.append((a, b, d, oi, oo))
    per = [dict() for _ in range(n)]
    outer, inner = [], []
    for i in range(n):
        pa, pb, pd, poi, poo = lines[i - 1]
        a, b, d, oi, oo = lines[i]
        nl, pnl = left(d), left(pd)
        if abs(cross(pd, d)) > 1e-6:
            pin = intersect(add(pa, mul(pnl, poi)), pd, add(a, mul(nl, oi)), d)
            pout = intersect(add(pa, mul(pnl, -poo)), pd, add(a, mul(nl, -oo)), d)
            per[i - 1]["in_e"] = per[i]["in_s"] = pin
            per[i - 1]["out_e"] = per[i]["out_s"] = pout
            inner.append(pin)
            outer.append(pout)
        else:                                      # straight run: square ends at the vertex
            per[i - 1]["in_e"] = add(a, mul(pnl, poi))
            per[i - 1]["out_e"] = add(a, mul(pnl, -poo))
            per[i]["in_s"] = add(a, mul(nl, oi))
            per[i]["out_s"] = add(a, mul(nl, -oo))
            for q in (per[i - 1]["in_e"], per[i]["in_s"]):
                if not inner or norm(sub(inner[-1], q)) > 1e-6:
                    inner.append(q)
            for q in (per[i - 1]["out_e"], per[i]["out_s"]):
                if not outer or norm(sub(outer[-1], q)) > 1e-6:
                    outer.append(q)
    return per, lines, outer, inner


def clear_height(r, levels_by_id, levels_sorted, D):
    if "height" in r.raw:
        return float(r.raw["height"])
    lv = r.level
    k = levels_sorted.index(lv)
    if k + 1 < len(levels_sorted):
        nxt = levels_sorted[k + 1]
        return nxt["elevation"] - nxt.get("slab", D["slab"]) - r.ffl
    return lv["height"] - D["roof_t"] - (r.ffl - lv["elevation"])


def top_planes(r, ch):
    """The ceiling as planes z = a*x + b*y + c relative to the room's floor; the lowest wins."""
    planes = r.raw.get("ceiling", {}).get("planes")
    if planes:
        return [tuple(map(float, pl)) for pl in planes]
    return [(0.0, 0.0, ch)]


def active_plane(planes, x, y):
    return min(range(len(planes)), key=lambda k: plane_z(planes[k], x, y))


def plane_regions(ring_poly, planes):
    """Split a polygon into the regions where each plane is the lowest."""
    if len(planes) == 1:
        return [(0, ring_poly)]
    out = []
    minx, miny, maxx, maxy = ring_poly.bounds
    big = max(maxx - minx, maxy - miny) * 4 + 10
    for k, pk in enumerate(planes):
        region = Polygon([(minx - big, miny - big), (maxx + big, miny - big), (maxx + big, maxy + big), (minx - big, maxy + big)])
        for m, pm in enumerate(planes):
            if m == k:
                continue
            # keep where pk <= pm: (ak-am) x + (bk-bm) y + (ck-cm) <= 0
            A, B, C = pk[0] - pm[0], pk[1] - pm[1], pk[2] - pm[2]
            region = region.intersection(half_plane(A, B, C, ring_poly.bounds, big))
        piece = ring_poly.intersection(region)
        if not piece.is_empty and piece.area > 1e-4:
            out.append((k, piece))
    return out


def half_plane(A, B, C, bounds, big):
    """Polygon approximating {A x + B y + C <= 0} over a generous window."""
    minx, miny, maxx, maxy = bounds
    cx, cy = (minx + maxx) / 2, (miny + maxy) / 2
    if abs(A) < 1e-12 and abs(B) < 1e-12:
        return Polygon([(cx - big, cy - big), (cx + big, cy - big), (cx + big, cy + big), (cx - big, cy + big)]) if C <= 0 else Polygon()
    n = (A / math.hypot(A, B), B / math.hypot(A, B))
    dist = -(A * cx + B * cy + C) / math.hypot(A, B)       # signed distance of centre to the line
    p0 = (cx + n[0] * dist, cy + n[1] * dist)              # foot of the centre on the line
    t = (-n[1], n[0])
    a = add(p0, mul(t, big))
    b = add(p0, mul(t, -big))
    return Polygon([a, b, add(b, mul(n, -2 * big)), add(a, mul(n, -2 * big))])


def rings_of(geom):
    polys = [geom] if geom.geom_type == "Polygon" else [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon"]
    out = []
    for pg in polys:
        if pg.area < 1e-4:
            continue
        out.append([list(pg.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in pg.interiors])
    return out


# ---------- walls ----------

def wall_solid(r, i, per, lines, planes, z0, D, mats, warn):
    w = r.walls[i]
    kind = w["kind"]
    if kind in ("open", "abut"):
        return []
    a, b, d, oi, oo = lines[i]
    nl = left(d)
    c = per[i]
    L = norm(sub(b, a))
    ext_mat = r.raw.get("ext_finish", D["ext_finish"]) if kind in ("ext", "low") else r.raw.get("finish", D["int_finish"])
    int_mat = r.raw.get("finish", D["int_finish"])
    if kind == "glass":
        return glass_wall(r, i, c, d, nl, L, oi, oo, planes, z0, D, w)
    if kind == "rail":
        h = float(w.get("h", D["rail_h"]))
        return [prism(f"Rail {i + 1}", "glass", [[c["out_s"], c["out_e"], c["in_e"], c["in_s"]]],
                      (0, 0, z0), (0, 0, z0 + h))]

    def top(p):
        if kind == "low":
            return z0 + float(w.get("h", D["low_h"]))
        return z0 + plane_z(planes[active_plane(planes, *p)], *p)

    # split the wall where the ceiling plane changes along its centreline
    cuts = [0.0, L]
    if kind != "low" and len(planes) > 1:
        steps = max(8, int(L / 0.05))
        prev = active_plane(planes, *a)
        for s in range(1, steps + 1):
            u = L * s / steps
            k = active_plane(planes, *add(a, mul(d, u)))
            if k != prev:
                lo, hi = L * (s - 1) / steps, u
                for _ in range(30):
                    mid = (lo + hi) / 2
                    if active_plane(planes, *add(a, mul(d, mid))) == prev:
                        lo = mid
                    else:
                        hi = mid
                cuts.insert(-1, (lo + hi) / 2)
                prev = k
    solids = []
    ops = sorted(w.get("openings", []), key=lambda o: o["at"])
    for k in range(len(cuts) - 1):
        u0, u1 = cuts[k], cuts[k + 1]

        def at(u, side):
            base = add(a, mul(nl, oi)) if side == "in" else add(a, mul(nl, -oo))
            return add(base, mul(d, u))
        os_ = c["out_s"] if k == 0 else at(u0, "out")
        oe = c["out_e"] if k == len(cuts) - 2 else at(u1, "out")
        is_ = c["in_s"] if k == 0 else at(u0, "in")
        ie = c["in_e"] if k == len(cuts) - 2 else at(u1, "in")
        name = f"Wall {i + 1}" + (f".{k + 1}" if len(cuts) > 2 else "") + f" ({kind})"
        if kind != "low":
            mid = add(a, mul(d, (u0 + u1) / 2))
            pl = planes[active_plane(planes, *mid)]
            top_abs = (pl[0], pl[1], pl[2] + z0)
        else:
            top_abs = (0.0, 0.0, z0 + float(w.get("h", D["low_h"])))
        zt_ref = lambda p, t=top_abs: plane_z(t, *p)
        if min(zt_ref(q) for q in (os_, oe, is_, ie)) < z0 + 0.1:
            warn(f"{r.id} wall {i + 1}: ceiling is at or below the floor here; wall skipped")
            continue
        reveals = []
        for op in ops:
            ou0, ou1 = op["at"], op["at"] + op["w"]
            if not (u0 - TOL <= (ou0 + ou1) / 2 < u1 + TOL):
                continue
            typ = op.get("type", "window")
            doorlike = typ in ("door", "opening", "glass_door")
            sill = float(op.get("sill", 0.0 if doorlike else D["window_sill"]))
            head = float(op.get("h", D["door_h"] if doorlike else D["window_head"] - sill)) + sill
            lim_lo = max(u0, *(dot(sub(q, a), d) for q in (os_, is_))) + 0.02
            lim_hi = min(u1, *(dot(sub(q, a), d) for q in (oe, ie))) - 0.02
            if ou0 < lim_lo or ou1 > lim_hi:
                warn(f"{r.id} wall {i + 1}: opening {op.get('name', typ)} at {ou0:.2f}-{ou1:.2f} clipped to {lim_lo:.2f}-{lim_hi:.2f}")
                ou0, ou1 = max(ou0, lim_lo), min(ou1, lim_hi)
                if ou1 - ou0 < 0.1:
                    continue
            pm = add(a, mul(d, (ou0 + ou1) / 2))
            ztop = zt_ref(pm) - z0
            sill = max(sill, SILL_MIN)
            head = min(head, ztop - SILL_MIN)
            if head - sill < 0.1:
                warn(f"{r.id} wall {i + 1}: opening {op.get('name', typ)} has no height under the ceiling; skipped")
                continue
            reveals.append(((ou0, ou1, sill, head), op, typ))
        spec = {"os": [r4(c) for c in os_], "oe": [r4(c) for c in oe], "is": [r4(c) for c in is_], "ie": [r4(c) for c in ie],
                "bo": [r4(c) for c in at(0.0, "out")], "bi": [r4(c) for c in at(0.0, "in")], "d": [round(d[0], 6), round(d[1], 6)],
                "z0": r4(z0), "pl": [round(top_abs[0], 6), round(top_abs[1], 6), r4(top_abs[2])],
                "ops": [[r4(a_), r4(b_), r4(c_), r4(e_)] for (a_, b_, c_, e_), _, _ in reveals],
                "mo": ext_mat if kind in ("ext", "int_full", "low") else int_mat, "mi": int_mat}
        solids.append(Leaf(name, int_mat, "wall", spec))
        for (ou0, ou1, sill, head), op, typ in reveals:
            glazed = op.get("glass", typ in ("window", "glass_door"))
            if glazed and kind != "int":
                cen = add(a, mul(nl, (oi - oo) / 2))
                gt = 0.024
                g0 = add(cen, mul(nl, gt / 2))
                g1 = add(cen, mul(nl, -gt / 2))
                ring = [add(g0, mul(d, ou0)), add(g0, mul(d, ou1)), add(g1, mul(d, ou1)), add(g1, mul(d, ou0))]
                solids.append(prism(f"{op.get('name', typ.replace('_', ' ').capitalize())} glass (wall {i + 1})", "glass", [ring],
                                    (0, 0, z0 + sill), (0, 0, z0 + head)))
    return solids


def glass_wall(r, i, c, d, nl, L, oi, oo, planes, z0, D, w):
    """Full-height glazing: sill and head frames, mullions, one pane per bay."""
    frame = r.raw.get("frame", D["frame"])
    spacing = float(w.get("mullions", 1.5))
    fh = 0.06
    pl = planes[active_plane(planes, *add(r.pts[i], mul(d, L / 2)))]
    zt = lambda p: z0 + plane_z(pl, *p)
    ring = [c["out_s"], c["out_e"], c["in_e"], c["in_s"]]
    sol = [prism(f"Glazing {i + 1} sill", frame, [ring], (0, 0, z0), (0, 0, z0 + fh))]
    top_b = (pl[0], pl[1], pl[2] + z0 - fh)
    sol.append(prism(f"Glazing {i + 1} head", frame, [ring], top_b, (pl[0], pl[1], pl[2] + z0)))
    u_s = dot(sub(c["in_s"], r.pts[i]), d)
    u_e = dot(sub(c["in_e"], r.pts[i]), d)
    u_s = max(u_s, dot(sub(c["out_s"], r.pts[i]), d))
    u_e = min(u_e, dot(sub(c["out_e"], r.pts[i]), d))
    bays = max(1, round((u_e - u_s) / spacing))
    mw = 0.05
    t = oi + oo
    cen = add(r.pts[i], mul(nl, (oi - oo) / 2))
    edges = [u_s + (u_e - u_s) * k / bays for k in range(bays + 1)]
    for k, u in enumerate(edges):
        if k in (0, bays):
            continue
        p0, p1 = add(cen, mul(d, u - mw / 2)), add(cen, mul(d, u + mw / 2))
        m_ring = [add(p0, mul(nl, -t / 2)), add(p1, mul(nl, -t / 2)), add(p1, mul(nl, t / 2)), add(p0, mul(nl, t / 2))]
        sol.append(prism(f"Glazing {i + 1} mullion {k}", frame, [m_ring], (0, 0, z0 + fh), (pl[0], pl[1], pl[2] + z0 - fh)))
    gt = 0.024
    for k in range(bays):
        ua = edges[k] + (mw / 2 if k > 0 else 0.0)
        ub = edges[k + 1] - (mw / 2 if k + 1 < bays else 0.0)
        g0, g1 = add(cen, mul(nl, gt / 2)), add(cen, mul(nl, -gt / 2))
        g_ring = [add(g0, mul(d, ua)), add(g0, mul(d, ub)), add(g1, mul(d, ub)), add(g1, mul(d, ua))]
        sol.append(prism(f"Glazing {i + 1} pane {k + 1}", "glass", [g_ring], (0, 0, z0 + fh), (pl[0], pl[1], pl[2] + z0 - fh)))
    return sol


# ---------- elements ----------

def element_solids(e, levels_by_id, D, warn):
    kind = e["kind"]
    lv = levels_by_id.get(e.get("level"), {"elevation": 0.0})
    base = lv["elevation"] + float(e.get("z", 0.0))
    name = e.get("name", e.get("id", kind))
    mat = e.get("mat")
    if kind in ("slab", "terrace", "deck", "roof", "canopy", "ground", "prism", "landing"):
        t = float(e.get("t", {"roof": D["roof_t"], "canopy": 0.2, "ground": 0.1}.get(kind, 0.2)))
        rings = [[tuple(map(float, q)) for q in e["outline"]]] + [[tuple(map(float, q)) for q in h] for h in e.get("holes", [])]
        if kind == "prism":
            z0, z1 = base, base + float(e["h"])
        else:
            z0, z1 = base - t, base
        default = {"roof": D["roof_finish"], "canopy": D["roof_finish"], "deck": "timber", "ground": "grass"}.get(kind, "concrete")
        return [prism(name, mat or default, rings, (0, 0, z0), (0, 0, z1))]
    if kind == "pool":
        rings = [[tuple(map(float, q)) for q in e["outline"]]]
        depth = float(e.get("depth", 1.5))
        return [prism(name, mat or "water", rings, (0, 0, base - depth), (0, 0, base - 0.05))]
    if kind == "column":
        x, y = map(float, e["at"])
        h = float(e["h"])
        if "d" in e:
            rr = float(e["d"]) / 2
            ring = [(x + rr * math.cos(2 * math.pi * k / 16), y + rr * math.sin(2 * math.pi * k / 16)) for k in range(16)]
        else:
            w_, d_ = map(float, e["size"])
            ring = [(x - w_ / 2, y - d_ / 2), (x + w_ / 2, y - d_ / 2), (x + w_ / 2, y + d_ / 2), (x - w_ / 2, y + d_ / 2)]
        return [prism(name, mat or "concrete", [ring], (0, 0, base), (0, 0, base + h))]
    if kind == "box":
        x, y = map(float, e["at"])
        w_, d_, h = map(float, e["size"])
        rot = math.radians(float(e.get("rot", 0.0)))
        cs, sn = math.cos(rot), math.sin(rot)
        ring = [(x + cs * px - sn * py, y + sn * px + cs * py) for px, py in ((0, 0), (w_, 0), (w_, d_), (0, d_))]
        return [prism(name, mat or "white", [ring], (0, 0, base), (0, 0, base + h))]
    if kind == "wall":
        pts = [tuple(map(float, q)) for q in e["path"]]
        t, h = float(e.get("t", D["ext_t"])), float(e["h"])
        out = []
        for k in range(len(pts) - 1):
            a, b = pts[k], pts[k + 1]
            nl = left(unit(sub(b, a)))
            ring = [add(a, mul(nl, -t / 2)), add(b, mul(nl, -t / 2)), add(b, mul(nl, t / 2)), add(a, mul(nl, t / 2))]
            out.append(prism(f"{name} {k + 1}", mat or D["ext_finish"], [ring], (0, 0, base), (0, 0, base + h)))
        return out
    if kind == "stair":
        return stair(e, base, name, mat, warn)
    warn(f"element {name}: unknown kind {kind}")
    return []


def stair(e, base, name, mat, warn):
    """Flights of steps; each flight: start [x,y] (bottom edge middle), dir_deg, width, steps,
    rise (total), going (per step). style 'solid' stacks blocks; 'treads' floats 50 mm treads."""
    out = []
    z = base
    for fi, fl in enumerate(e["flights"]):
        sx, sy = map(float, fl["start"])
        ang = math.radians(float(fl["dir_deg"]))
        d = (math.cos(ang), math.sin(ang))
        nl = left(d)
        W = float(fl["width"])
        n = int(fl["steps"])
        rise = float(fl["rise"]) / n
        g = float(fl["going"])
        z0 = base + float(fl.get("z", z - base))
        for k in range(n):
            p0 = add((sx, sy), mul(d, k * g))
            p1 = add((sx, sy), mul(d, (k + 1) * g))
            ring = [add(p0, mul(nl, -W / 2)), add(p1, mul(nl, -W / 2)), add(p1, mul(nl, W / 2)), add(p0, mul(nl, W / 2))]
            top = z0 + (k + 1) * rise
            bot = top - 0.05 if e.get("style", "solid") == "treads" else z0
            out.append(prism(f"{name} flight {fi + 1} step {k + 1:02d}", mat or "timber", [ring], (0, 0, bot), (0, 0, top)))
        z = z0 + n * rise
    for li, ld in enumerate(e.get("landings", [])):
        ring = [tuple(map(float, q)) for q in ld["outline"]]
        top = base + float(ld["z"])
        out.append(prism(f"{name} landing {li + 1}", mat or "timber", [ring], (0, 0, top - float(ld.get("t", 0.2))), (0, 0, top)))
    return out


# ---------- compile ----------

def compile_project(p):
    warnings = []
    warn = warnings.append
    D = defaults(p)
    mats = material_table(p)
    levels = sorted(p["levels"], key=lambda l: l["elevation"])
    levels_by_id = {l["id"]: l for l in levels}
    rooms = []
    ids = set()
    for r in p["rooms"]:
        if r["id"] in ids:
            raise Problem(f"duplicate room id {r['id']}")
        ids.add(r["id"])
        if r["level"] not in levels_by_id:
            raise Problem(f"{r['id']}: unknown level {r['level']}")
        room = Room(r, levels_by_id[r["level"]], D)
        if not room.poly().is_valid:
            raise Problem(f"{r['id']}: outline crosses itself")
        rooms.append(room)
    split_edges(rooms)
    resolve_walls(rooms, D, warn)

    # rooms on the same level must not overlap
    for i, a in enumerate(rooms):
        for b in rooms[i + 1:]:
            if a.level["id"] != b.level["id"]:
                continue
            ov = a.poly().intersection(b.poly()).area
            if ov > 0.05:
                warn(f"{a.id} and {b.id} overlap by {ov:.2f} m2")

    root = p["name"]
    groups, leaves, index, plan2d = [], [], [], []
    gid = {}

    def group(path, tag=None, attrs=None, origin=(0.0, 0.0, 0.0)):
        key = "/".join(path)
        if key not in gid:
            gid[key] = len(groups)
            parent = gid.get("/".join(path[:-1])) if len(path) > 1 else None
            groups.append({"path": path, "parent": parent, "tag": tag, "attrs": attrs or {},
                           "origin": [r4(c) for c in origin]})
        return gid[key]

    bbox = [[1e9] * 3, [-1e9] * 3]

    def emit(g, leaf, tag=None):
        V, F = leaf.realize()
        vol, bad = mesh_stats(V, F)
        for q in V:
            for k in range(3):
                bbox[0][k] = min(bbox[0][k], q[k])
                bbox[1][k] = max(bbox[1][k], q[k])
        if bad:
            warn(f"{groups[g]['path'][-1]} / {leaf.name}: not closed ({bad} edge uses)")
        if vol <= 0:
            warn(f"{groups[g]['path'][-1]} / {leaf.name}: non-positive volume {vol:.4f}")
        rec = {"g": g, "n": leaf.name, "m": leaf.mat, "k": leaf.kind, "s": leaf.spec, "vol": round(vol, 6)}
        if tag:
            rec["t"] = tag
        leaves.append(rec)

    group([root], tag=None, attrs={"slug": p["slug"], "schema": p["schema"]})
    level_name = {l["id"]: f"{l['id']} {l.get('name', '')}".strip() for l in levels}
    for l in levels:
        group([root, level_name[l["id"]]], tag=f"Level · {level_name[l['id']]}")

    slab_poly = {}
    for r in rooms:
        per, lines, outer, inner = corners(r)
        r._per, r._lines, r._outer, r._inner = per, lines, outer, inner
        slab_poly[r.id] = Polygon(outer).buffer(0)

    for r in rooms:
        ch = clear_height(r, levels_by_id, levels, D)
        planes = top_planes(r, ch)
        per, lines, outer, inner = r._per, r._lines, r._outer, r._inner
        clear = Polygon(inner).buffer(0)
        xs = [q[0] for q in outer]
        ys = [q[1] for q in outer]
        origin = (min(xs), min(ys), r.ffl)
        area = clear.area
        doors = sum(1 for w in r.walls for o in w.get("openings", []) if o.get("type") in ("door", "opening", "glass_door"))
        windows = sum(1 for w in r.walls for o in w.get("openings", []) if o.get("type", "window") == "window")
        attrs = {"room_id": r.id, "type": r.type, "level": r.level["id"], "area_m2": round(area, 2),
                 "clear_height_m": round(ch, 2), "confidence": r.raw.get("confidence", "medium"),
                 "sources": ",".join(r.raw.get("sources", []))}
        g = group([root, level_name[r.level["id"]], r.name], tag=f"Room · {r.type.replace('_', ' ').title()}",
                  attrs=attrs, origin=origin)
        # floor slab
        t = r.level.get("slab", D["ground_slab"] if r.level is levels[0] else D["slab"])
        t = float(r.raw.get("slab", t))
        floor_mat = r.raw.get("floor", "timber" if r.type in ("deck",) else D["floor"])
        for rings in rings_of(slab_poly[r.id]):
            emit(g, prism("Floor", floor_mat, rings, (0, 0, r.ffl - t), (0, 0, r.ffl)))
        # walls
        for i in range(len(r.pts)):
            for s in wall_solid(r, i, per, lines, planes, r.ffl, D, mats, warn):
                emit(g, s)
        # roof over whatever part no room above covers
        if r.raw.get("roof", not r.outdoor):
            above = [slab_poly[o.id] for o in rooms if o.ffl > r.ffl + 0.5 and o.level is not r.level]
            cover = slab_poly[r.id]
            if above and r.raw.get("roof") is None:
                cover = cover.difference(unary_union(above))
            rt = float(r.raw.get("roof_t", D["roof_t"]))
            roof_mat = r.raw.get("roof_finish", D["roof_finish"])
            for k, region in plane_regions(cover, planes):
                pl = planes[k]
                zb = (pl[0], pl[1], pl[2] + r.ffl)
                zt = (pl[0], pl[1], pl[2] + r.ffl + rt)
                for rings in rings_of(region):
                    emit(g, prism("Roof" + (f" {k + 1}" if len(planes) > 1 else ""), roof_mat, rings, zb, zt), tag="Roofs")
        for f in r.raw.get("fixtures", []):
            e = dict(f, level=r.level["id"], z=float(f.get("z", 0.0)) + (r.ffl - r.level["elevation"]))
            e.setdefault("kind", "box")
            for s in element_solids(e, levels_by_id, D, warn):
                emit(g, s)
        walls2d = []
        for i in range(len(r.pts)):
            a_, b_, d_, oi_, oo_ = lines[i]
            c_ = per[i]
            walls2d.append({"kind": r.walls[i]["kind"],
                            "quad": [c_["out_s"], c_["out_e"], c_["in_e"], c_["in_s"]],
                            "openings": [[add(a_, mul(d_, o["at"])), add(a_, mul(d_, o["at"] + o["w"])), o.get("type", "window")]
                                         for o in r.walls[i].get("openings", [])]})
        plan2d.append({"id": r.id, "name": r.name, "type": r.type, "level": r.level["id"], "area_m2": round(area, 2),
                       "inner": list(clear.exterior.coords)[:-1] if clear.geom_type == "Polygon" else inner,
                       "outline": r.pts, "walls": walls2d})
        index.append({"project": p["name"], "slug": p["slug"], "room_id": r.id, "name": r.name, "type": r.type,
                      "level": r.level["id"], "area_m2": round(area, 2), "clear_height_m": round(ch, 2),
                      "bbox_m": [round(min(xs), 2), round(min(ys), 2), round(max(xs), 2), round(max(ys), 2)],
                      "doors": doors, "windows": windows, "outdoor": r.outdoor,
                      "group_path": "/".join(groups[g]["path"]), "file": f"residential/skp/{p['slug']}.skp",
                      "confidence": r.raw.get("confidence", "medium")})

    for e in p.get("elements", []):
        host = e.get("room")
        if host:
            hr = next((r for r in rooms if r.id == host), None)
            if hr is None:
                raise Problem(f"element {e.get('id')}: unknown room {host}")
            g = gid["/".join([root, level_name[hr.level["id"]], hr.name])]
        else:
            lvl = e.get("level")
            path = [root, level_name[lvl], "Exterior"] if lvl in level_name else [root, "Site"]
            g = group(path, tag="Exterior")
        for s in element_solids(e, levels_by_id, D, warn):
            emit(g, s)

    used = sorted({lf["m"] for lf in leaves} | {lf["s"][k] for lf in leaves for k in ("mo", "mi", "mt", "mb", "ms") if lf["s"].get(k)})
    unknown = [m for m in used if m not in mats]
    if unknown:
        raise Problem(f"unknown materials {unknown}; add them to the project's materials")
    plan = {"slug": p["slug"], "name": p["name"], "materials": {m: mats[m] for m in used},
            "groups": groups, "leaves": leaves, "plan2d": plan2d,
            "levels": [{"id": l["id"], "name": l.get("name", ""), "elevation": l["elevation"]} for l in levels],
            "calibration": p.get("calibration", {}),
            "totals": {"rooms": len(rooms), "leaves": len(leaves),
                       "volume_m3": round(sum(lf["vol"] for lf in leaves), 3),
                       "bbox_in": [[round(c * IN, 2) for c in bbox[0]], [round(c * IN, 2) for c in bbox[1]]]}}
    return plan, index, warnings


def main(path, *rest):
    out = Path(rest[rest.index("--out") + 1]) if "--out" in rest else Path(path).parent.parent / "build"
    out.mkdir(parents=True, exist_ok=True)
    p = load(path)
    plan, index, warnings = compile_project(p)
    (out / f"{p['slug']}.plan.json").write_text(json.dumps(plan, separators=(",", ":")))
    (out / f"{p['slug']}.rooms.json").write_text(json.dumps(index, indent=1, ensure_ascii=False))
    for w in warnings:
        print("warning:", w)
    print(f"{p['slug']}: {plan['totals']['rooms']} rooms, {plan['totals']['leaves']} solids, "
          f"{len(warnings)} warnings -> {out}")


if __name__ == "__main__":
    main(*sys.argv[1:])
