#!/usr/bin/env python3
"""Which of the National Gallery of Art's West Building rooms connect, read off its visitor map.

The NGA's open data gives every public room's outline (build_interiors.py --nga) but nothing of what
joins them. Its printed visitor map (English, June 2025: data/plans/<slug>/nga-map-english-2025-06.pdf,
fetched from https://www.nga.gov/sites/default/files/2025-06/nga-map-english.pdf; reference only, never
committed) draws the walls between the rooms with their openings. The map is read, never copied:

  1. registration — the map's page (PDF points) against the NGA's own outlines (its map pixels), fitted
     once by scoring how many points along the outlines fall on the map's drawn separators; the result is
     REG below (scale x, scale y, offset x, offset y, in points);
  2. for each two rooms of a floor that face each other across 2.6 m or less, probes across the shared
     wall every 0.1 m: the map's pixels on the probe are read as the rooms' own paint (the galleries'
     pinks, the halls' white) or a wall (the greys, and between two galleries the white line the map
     draws); a probe that crosses no wall is open;
  3. each run of open probes 0.6 m long or more is a doorway: its middle is where the map shows it, its
     width the run's (at least 1.2 m, at most 4 m: the map is schematic), its head the rooms' (null).

A room the map paints grey (not open to visitors) is never joined; a run under 1 m is where two walls
meet at a corner, not a doorway. The openings are written into the floor's `open` with src ["nga-map",
"nga-rooms"], sure "reconstructed" and a note beginning with MARK; openings by hand (any other note) stay,
and a pair joined by hand is not read again. A reading the checker refuses (no wall found near it) is
dropped after writing (the checker is run, its errors read). Rooms the first reading leaves apart are read
again loosely. Then the file is checked as usual:

    python3 scripts/nga_map_doors.py [--dry]
    node scripts/check_interior.js docs/v2/interiors/museum-national-gallery-of-art-washington-dc.json
"""

import argparse
import json
import math
import re
import subprocess
import sys
from pathlib import Path

import numpy as np
import pymupdf
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import nearest_points

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_interiors as bi  # noqa: E402

SLUG = bi.NGA_SLUG
PDF = bi.ROOT / "data" / "plans" / SLUG / "nga-map-english-2025-06.pdf"
URL = "https://www.nga.gov/sites/default/files/2025-06/nga-map-english.pdf"
READ = "2026-10-08"
# floor -> (the PDF's page, sx, sy, tx, ty): NGA map pixel p -> PDF point p * s + t. Fitted 8 Oct 2026:
# 48% of the main floor's outline points within 0.8 pt of a drawn separator, 42% of the ground floor's.
REG = {"main": (4, 1.052, 1.048, 12.5, 201.75), "ground": (3, 1.052, 1.052, 11.5, 213.1)}
K = 8.0                                  # raster pixels a point
STEP = 0.1
PINK, WHITE, GREY, LIGHT, OTHER = 1, 2, 3, 4, 0


def shape(r):
    if "rect" in r:
        x, y, w, d = r["rect"]
        return box(x, y, x + w, y + d)
    if "poly" in r:
        return Polygon(r["poly"])
    cx, cy, rr = r["circle"]
    return Point(cx, cy).buffer(rr, 24)


class Page:
    def __init__(self, page_no, sx, sy, tx, ty):
        d = pymupdf.open(PDF)
        pix = d[page_no].get_pixmap(matrix=pymupdf.Matrix(K, K), alpha=False)
        img = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, 3).astype(int)
        self.H, self.W = img.shape[:2]
        R, G, B = img[..., 0], img[..., 1], img[..., 2]
        mean = (R + G + B) / 3
        cls = np.zeros((self.H, self.W), dtype=np.uint8)
        cls[(R - G > 15) & (B - G > 5)] = PINK
        cls[np.minimum(np.minimum(R, G), B) >= 228] = WHITE
        neutral = (np.abs(R - G) < 14) & (np.abs(G - B) < 20)
        cls[neutral & (mean >= 100) & (mean < 200)] = GREY
        cls[neutral & (mean >= 200) & (mean <= 245)] = LIGHT
        self.cls = cls
        self.reg = (sx, sy, tx, ty)

    def T(self, x, y):
        sx, sy, tx, ty = self.reg
        px, py = x / bi.NGA_M + bi.NGA_AT[0], y / bi.NGA_M + bi.NGA_AT[1]
        return ((px * sx + tx) * K, (py * sy + ty) * K)

    def paint(self, sh):
        """What the map paints a room: pink (a gallery), white (a hall), grey (not open)."""
        minx, miny, maxx, maxy = sh.bounds
        c = {PINK: 0, WHITE: 0, GREY: 0, LIGHT: 0, OTHER: 0}
        for i in range(12):
            for j in range(12):
                x = minx + (i + 0.5) * (maxx - minx) / 12
                y = miny + (j + 0.5) * (maxy - miny) / 12
                if not sh.contains(Point(x, y)):
                    continue
                X, Y = self.T(x, y)
                if 0 <= X < self.W and 0 <= Y < self.H:
                    c[int(self.cls[int(Y), int(X)])] += 1
        tot = sum(c.values()) or 1
        if c[PINK] >= 0.35 * tot:
            return "pink"
        if c[GREY] >= 0.5 * tot:
            return "grey"
        return "white"

    def wall_on(self, a, b, ta, tb, loose=False):
        """Whether the probe a-b crosses a wall: a run of wall paint 2 raster pixels long (3 when loose, where
        the map's light-grey screens, columns and stair hatching are not walls)."""
        (x0, y0), (x1, y1) = self.T(*a), self.T(*b)
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        xs = np.linspace(x0, x1, n).astype(int)
        ys = np.linspace(y0, y1, n).astype(int)
        ok = (xs >= 0) & (ys >= 0) & (xs < self.W) & (ys < self.H)
        v = self.cls[ys[ok], xs[ok]]
        if ta == "pink" and tb == "pink":
            bad = (v == WHITE) | (v == GREY) | ((v == LIGHT) & (not loose))
        elif "white" in (ta, tb) and "pink" in (ta, tb):
            bad = v == GREY
        else:
            bad = (v == GREY) | ((v == LIGHT) & (not loose))
        run = 0
        for x in bad:
            run = run + 1 if x else 0
            if run >= (3 if loose else 2):
                return True
        return False


MARK = "where the NGA's visitor map draws the wall open between them"


def read_here(o):
    """An opening this script wrote (and rewrites); any other is the hand's."""
    return (o.get("note") or "").startswith(MARK)


def depth(sh, p, ux, uy):
    """How far a probe reaches into a room from its edge: 0.45 of the room's depth that way, at most 2 m
    (the map's walls can stand a metre or two off the NGA's outlines)."""
    ln = LineString([(p.x + ux * 0.01, p.y + uy * 0.01), (p.x + ux * 60, p.y + uy * 60)]).intersection(sh)
    L = ln.length if not ln.is_empty else 0
    if ln.geom_type == "MultiLineString":
        near = [g.length for g in ln.geoms if g.distance(p) < 0.1]
        L = min(near) if near else min(g.length for g in ln.geoms)
    return max(0.3, min(2.0, 0.45 * L))


def read_floor(fl, page, only=None, loose=False):
    """The openings the map shows between the floor's rooms; with `only`, between pairs of which one room is
    in it (a second, looser reading for the rooms the first left with no way to the rest)."""
    rooms = [(r["id"], shape(r)) for r in fl["rooms"] if r.get("kind") not in ("closed", "void")]
    paint = {rid: page.paint(sh) for rid, sh in rooms}
    hand = {frozenset((o["a"], o["b"])) for o in fl.get("open") or [] if not read_here(o)}
    found = []
    for i in range(len(rooms)):
        for j in range(i + 1, len(rooms)):
            ia, A = rooms[i]
            ib, B = rooms[j]
            if only is not None and ia not in only and ib not in only:
                continue
            dist = A.distance(B)
            if dist > 2.6 or frozenset((ia, ib)) in hand:
                continue
            ta, tb = paint[ia], paint[ib]
            if "grey" in (ta, tb):
                continue
            bd = A.exterior
            pts = []
            for k in range(int(bd.length / STEP)):
                pa = bd.interpolate(k * STEP)
                if pa.distance(B) <= dist + 0.7:
                    pts.append((k * STEP, pa, nearest_points(pa, B.exterior)[1]))
            if not pts:
                continue
            runs, cur = [], [pts[0]]
            for a, b in zip(pts, pts[1:]):
                if b[0] - a[0] > STEP * 1.5:
                    runs.append(cur)
                    cur = [b]
                else:
                    cur.append(b)
            runs.append(cur)
            for run in runs:
                if len(run) * STEP < 0.8:
                    continue
                opens = []
                for s, pa, pb in run:
                    ux, uy = pb.x - pa.x, pb.y - pa.y
                    ln = math.hypot(ux, uy)
                    if ln < 0.05:
                        pn = bd.interpolate(min(s + STEP, bd.length))
                        ex, ey = pn.x - pa.x, pn.y - pa.y
                        el = math.hypot(ex, ey) or 1
                        ux, uy = -ey / el, ex / el
                        if B.distance(Point(pa.x + ux * 0.3, pa.y + uy * 0.3)) > \
                                B.distance(Point(pa.x - ux * 0.3, pa.y - uy * 0.3)):
                            ux, uy = -ux, -uy
                        a = (pa.x - ux * depth(A, pa, -ux, -uy), pa.y - uy * depth(A, pa, -ux, -uy))
                        b = (pa.x + ux * depth(B, pa, ux, uy), pa.y + uy * depth(B, pa, ux, uy))
                    else:
                        ux, uy = ux / ln, uy / ln
                        a = (pa.x - ux * depth(A, pa, -ux, -uy), pa.y - uy * depth(A, pa, -ux, -uy))
                        b = (pb.x + ux * depth(B, pb, ux, uy), pb.y + uy * depth(B, pb, ux, uy))
                    opens.append((s, not page.wall_on(a, b, ta, tb, loose), pa, pb))
                st, spans = None, []
                for s, op, pa, pb in opens + [(None, False, None, None)]:
                    if op and st is None:
                        st = [s, s, [(pa, pb)]]
                    elif op:
                        st[1] = s
                        st[2].append((pa, pb))
                    elif st is not None:
                        spans.append(st)
                        st = None
                for s0, s1, pp in spans:
                    w = s1 - s0 + STEP
                    if w < 0.6:
                        continue
                    mid = pp[len(pp) // 2]
                    at = [round((mid[0].x + mid[1].x) / 2, 2), round((mid[0].y + mid[1].y) / 2, 2)]
                    corner = min(Point(at).distance(Point(c)) for g in (A, B) for c in g.exterior.coords)
                    if w < 1.0 and corner < 1.2:
                        continue       # where two walls meet at a corner, not a doorway
                    found.append({"a": ia, "b": ib, "at": at, "w": w, "paint": ta + "/" + tb})
    # Two runs of one wall a label or an icon split are one doorway; doorways of one pair 2.5 m or more
    # apart are two.
    keep = []
    for f in sorted(found, key=lambda f: -f["w"]):
        if any(k["a"] == f["a"] and k["b"] == f["b"] and math.dist(k["at"], f["at"]) < 2.5 for k in keep):
            continue
        keep.append(f)
    keep.sort(key=lambda f: (f["a"], f["b"], f["at"]))
    return keep, paint


def choose(fl, found):
    """Every reading 1 m across or more; a narrower one (0.6-1 m on the schematic map) only where it is a
    room's or a group's one way to the rest: a gap a label or an icon narrowed, not a stray."""
    up = {r["id"]: r["id"] for r in fl["rooms"]}

    def root(x):
        while up[x] != x:
            up[x] = up[up[x]]
            x = up[x]
        return x
    for o in fl.get("open") or []:
        if o["a"] in up and o["b"] in up:
            up[root(o["a"])] = root(o["b"])
    out = [f for f in found if f["w"] >= 1.0]
    for f in out:
        up[root(f["a"])] = root(f["b"])
    for f in sorted((f for f in found if f["w"] < 1.0), key=lambda f: -f["w"]):
        if root(f["a"]) != root(f["b"]):
            out.append(f)
            up[root(f["a"])] = root(f["b"])
    return out


def alone(fl, found):
    """The walkable rooms not in the floor's largest group, by the openings so far."""
    walk = [r["id"] for r in fl["rooms"] if r.get("kind") not in ("closed", "void")]
    adj = {r: set() for r in walk}
    for o in list(fl.get("open") or []) + found:
        if o["a"] in adj and o["b"] in adj:
            adj[o["a"]].add(o["b"])
            adj[o["b"]].add(o["a"])
    seen, best = set(), set()
    for r in walk:
        if r in seen:
            continue
        comp, st = {r}, [r]
        while st:
            for y in adj[st.pop()]:
                if y not in comp:
                    comp.add(y)
                    st.append(y)
        seen |= comp
        if len(comp) > len(best):
            best = comp
    return set(walk) - best


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--dry", action="store_true", help="print, do not write")
    args = ap.parse_args()
    if not PDF.exists():
        sys.exit(f"the map is not here: fetch {URL} into {PDF}")
    path = bi.OUT / f"{SLUG}.json"
    doc = json.loads(path.read_text(encoding="utf-8"))
    srcs = {s["id"]: s for s in doc["sources"]}
    srcs["nga-map"] = {"id": "nga-map", "t": "the National Gallery of Art's visitor map (English, June 2025), "
                       "read for which rooms connect and where the walls between them open (never copied)",
                       "u": URL, "read": READ}
    doc["sources"] = list(srcs.values())
    _, sx, sy, tx, ty = REG["main"]
    doc.setdefault("from", {})["nga-map"] = {
        "px": [round(bi.NGA_AT[0] * sx + tx, 2), round(bi.NGA_AT[1] * sy + ty, 2)], "m": round(bi.NGA_M / sx, 5),
        "turn": 0,
        "why": "the map's pages in PDF points against the NGA's outlines in its map pixels (point = pixel × s + t), "
               "fitted by how many points along the outlines fall on the map's drawn separators: "
               + "; ".join(f"{k} page {v[0] + 1}, s {v[1]}/{v[2]}, t {v[3]}/{v[4]}" for k, v in REG.items())
               + "; px and m are the Main Floor's"}
    total = 0
    for fl in doc["floors"]:
        if fl["id"] not in REG:
            continue
        page = Page(*REG[fl["id"]])
        found, paint = read_floor(fl, page)
        hand = [o for o in fl.get("open") or [] if not read_here(o)]
        fl["open"] = hand
        found = choose(fl, found)
        # The rooms left apart from the floor's largest group are read again, loosely, for the way to it.
        apart = alone(fl, found)
        if apart:
            more, _ = read_floor(fl, page, only=apart, loose=True)
            more = [f for f in more if not any(k["a"] == f["a"] and k["b"] == f["b"] for k in found)]
            for f in more:
                f["loose"] = True
            found = choose(fl, found + [dict(f, w=min(f["w"], 0.99)) for f in more])
            print(f"  {fl['id']}: {len(apart)} rooms apart read again, {sum(1 for f in found if f.get('loose'))} "
                  "joined", flush=True)
        # What the map paints grey is not open to visitors (as it paints the closed G10-G15 'Temporarily
        # closed'): closed, never walked, unless a hand has opened it.
        hung = {w.get("room") for w in doc.get("works") or [] if w.get("how") == "museum"}
        for r in fl["rooms"]:
            if paint.get(r["id"]) == "grey" and r.get("kind") in ("gallery", None) and r["id"] not in hung:
                r["kind"] = "closed"
                r["src"] = list(dict.fromkeys((r.get("src") or []) + ["nga-map"]))
                r["note"] = "the NGA's visitor map (June 2025) paints it grey, as it paints what is not open"
        made = []
        for f in found:
            made.append({"a": f["a"], "b": f["b"], "at": f["at"], "w": round(min(4.0, max(1.2, f["w"])), 1),
                         "h": None, "kind": "door", "sure": "reconstructed", "src": ["nga-map", "nga-rooms"],
                         "note": f"{MARK}, {f['w']:.1f} m across on the map" +
                                 ("; read again loosely (its light-grey screens and hatching not taken for walls), "
                                  "as the room's only way to the rest" if f.get("loose") else "")})
        fl["open"] = hand + made
        total += len(made)
        print(f"  {fl['id']}: {len(made)} openings read off the map ({len(hand)} by hand kept)", flush=True)
    if args.dry:
        print(f"{total} openings", flush=True)
        return
    bi.write(path, doc)
    # What the checker cannot cut: a reading at a corner (within 1.2 m of one of the two rooms' corners) of a
    # pair it refuses goes; if none of the pair's readings is at a corner, the pair's readings all go.
    dropped = 0
    for _ in range(4):
        out = subprocess.run(["node", str(bi.ROOT / "scripts" / "check_interior.js"), str(path)], capture_output=True,
                             text=True).stdout
        bad = set(re.findall(r"error: opening (\S+) — (\S+) on (\S+): no wall", out))
        if not bad:
            break
        for fl in doc["floors"]:
            shapes = {r["id"]: shape(r) for r in fl["rooms"]}
            for a, b, fid in bad:
                if fid not in (fl["id"], fl.get("name")):
                    continue
                mine = [o for o in fl["open"] if o["a"] == a and o["b"] == b and read_here(o)]
                corners = [Point(c) for k in (a, b) for c in list(shapes[k].exterior.coords)]
                at_corner = [o for o in mine if min(Point(o["at"]).distance(c) for c in corners) < 1.2]
                for o in at_corner or mine:
                    fl["open"].remove(o)
                    dropped += 1
        bi.write(path, doc)
    print(f"{total - dropped} openings ({dropped} the checker could not cut dropped)", flush=True)


if __name__ == "__main__":
    main()
