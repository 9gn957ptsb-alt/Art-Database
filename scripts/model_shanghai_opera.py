#!/usr/bin/env python3
"""The Shanghai Grand Opera House (Snøhetta, 2026), as a model of the site's parts.

    python3 scripts/model_shanghai_opera.py      # writes docs/v2/models/shanghai-grand-opera-house-by-snohetta.json

The first building of the Architecture layer added by hand (scripts/architecture_hand.json): the artist asked for
it (21 Oct 2026) and it is not among his Architectural Authority bookmarks. No photograph or drawing of the built
house could be read from the session (snohetta.com and the architecture press are refused), so the model is built
from what could be read, and says which is which (`notes`):

- the plan: OpenStreetMap's outline (way 1316877742, ODbL), which Overture's ground round it agrees with, and
  Sentinel-2 (L2A, tile 51RUQ, 8 and 14 October 2026), where the white roof fills that outline and paved fingers
  run from its west side toward the Huangpu;
- the heights: 45 m at most (World Construction Network), the roof's public platform 28 m (SmartShanghai) to
  about 40 m (Xinhua) up, reached by a double-helix stair in a round well of 22-32 m radius turning about 295°;
  three halls (2,000, 1,200 and 1,000 seats), so three stage towers; full-height glass under a continuous white
  roof;
- the arrangement: Snøhetta's own film of the design (2019; its YouTube stills) seen from above — the round well
  about 35 m south of the outline's middle, three stage-tower boxes in the south and east, the roof's ribs fanning
  north and west;
- guessed: which way the roof winds (here it climbs clockwise from the plaza in the west round to its top in the
  south-south-west, as a stair that turns that way would), every height between the plaza and the top, which
  tower is which hall, where the glass stands.

x runs east, y south, z up, metres; 0,0 is the point in architecture.json, north up (an exact building is set into
its plot in the plot's own frame). Same bytes every run; numpy-free, shapely only.
"""
import json
import math
from pathlib import Path

import shapely
from shapely.geometry import LineString, Point, Polygon

ROOT = Path(__file__).resolve().parent.parent
SLUG = "shanghai-grand-opera-house-by-snohetta"
OUT = ROOT / "docs" / "v2" / "models" / f"{SLUG}.json"

# OpenStreetMap way 1316877742, its nodes in order (lon, lat).
OUTLINE = [
    (121.4651551, 31.1794225), (121.4651924, 31.1793266), (121.4653092, 31.1792707), (121.4675508, 31.1799219),
    (121.4676255, 31.1799859), (121.4676115, 31.1801617), (121.4674620, 31.1804853), (121.4673500, 31.1807290),
    (121.4673266, 31.1809967), (121.4672566, 31.1813323), (121.4672425, 31.1815480), (121.4672052, 31.1816240),
    (121.4659910, 31.1820475), (121.4656641, 31.1814282), (121.4654726, 31.1810247), (121.4652718, 31.1803374),
]

VOXEL = 3.4
SITE = [408, 360]

HUB = (-3.0, 35.0)           # the stair's well, 35 m south of the outline's middle (the film)
WELL = 32.0                  # its radius: the stair turns between 22 and 32 m out; the court it rings is open
STAIR = (22.0, 32.0)         # the stair's ring, round the court's wall
TURN = 295.0                 # degrees the stair, and the roof with it, turns
PLAZA = 3.4                  # the roof's foot, a voxel over the plaza
TOP = 30.6                   # the roof's top: 28 m (SmartShanghai) to ~40 (Xinhua); nine voxels
BLADES = 20                  # the fan's leaves
START = 180.0                # the roof's foot faces west, toward the river and the fingers (degrees, east = 0, north = 90)
GLASS_UNDER = 20.4           # a leaf at least this high stands on glass ...
GLASS_H = 13.6               # ... this tall
GLASS_IN = 6.8               # set this far back under the roof's edge
TOWERS = [                   # the stage towers: middle (x, y south), size, height; which hall each is, guessed
    ((46.0, 88.0), (30.6, 27.2), 44.2),
    ((-36.0, 100.0), (27.2, 27.2), 40.8),
    ((70.0, -12.0), (23.8, 27.2), 37.4),
]
LOW = 10.2                   # the hall in the gap between the roof's foot and its top
FINGERS = [                  # paved fingers west (Sentinel-2): bearing of the tip from the hub in degrees, its reach
    (179.0, 197.0), (168.0, 200.0), (159.0, 210.0), (152.0, 222.0), (140.0, 175.0),
]


def local(lon, lat, at):
    """Metres east and south of the point, as build_grounds.py and overture_outline.py reckon them."""
    return ((lon - at["lon"]) * 111320.0 * math.cos(math.radians(at["lat"])), -(lat - at["lat"]) * 111320.0)


def ring(poly):
    """A shapely polygon's outline as [[x, y], ...], 0.1 m, without the closing point."""
    pts = list(poly.exterior.coords)[:-1]
    return [[round(x, 1), round(y, 1)] for x, y in pts]


def polys(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    return [g for g in getattr(geom, "geoms", []) if g.geom_type == "Polygon" and g.area > 1]


def prism(geom, z, h, m, **more):
    out = []
    for p in polys(geom):
        part = {"prism": ring(p), "z": round(z, 2), "h": round(h, 2), "m": m}
        holes = [[[round(x, 1), round(y, 1)] for x, y in list(r.coords)[:-1]] for r in p.interiors]
        if holes:
            part["holes"] = holes
        part.update(more)
        out.append(part)
    return out


def pcut(geom, z, h):
    out = []
    for p in polys(geom):
        part = {"pcut": ring(p), "z": round(z, 2), "h": round(h, 2)}
        holes = [[[round(x, 1), round(y, 1)] for x, y in list(r.coords)[:-1]] for r in p.interiors]
        if holes:
            part["holes"] = holes
        out.append(part)
    return out


def wedge(a0, a1, r=400.0, at=HUB):
    """The fan's leaf between two bearings (degrees, east = 0, counter-clockwise as on a map, north up). y is south,
    so a bearing's y is minus its sine."""
    lo, hi = min(a0, a1), max(a0, a1)
    pts = [at]
    steps = max(2, int((hi - lo) / 3) + 1)
    for i in range(steps + 1):
        a = math.radians(lo + (hi - lo) * i / steps)
        pts.append((at[0] + r * math.cos(a), at[1] - r * math.sin(a)))
    return Polygon(pts)


def snap(z):
    return round(z / VOXEL) * VOXEL


def model():
    at = json.loads((ROOT / "scripts" / "architecture_hand.json").read_text())["buildings"]
    at = next(b for b in at if b["slug"] == SLUG)
    house = Polygon([local(lon, lat, at) for lon, lat in OUTLINE])
    parts = []

    # The plaza: paved fingers from the roof's foot to the river side, under everything.
    for bearing, reach in FINGERS:
        a = math.radians(bearing)
        tip = (HUB[0] + reach * math.cos(a), HUB[1] - reach * math.sin(a))
        nx, ny = -math.sin(a), -math.cos(a)                 # across the finger (y south)
        root_w, tip_w = 9.0, 4.5
        finger = Polygon([(HUB[0] + nx * root_w, HUB[1] + ny * root_w), (tip[0] + nx * tip_w, tip[1] + ny * tip_w),
                          (tip[0] - nx * tip_w, tip[1] - ny * tip_w), (HUB[0] - nx * root_w, HUB[1] - ny * root_w)])
        parts += prism(finger.difference(house), 0, VOXEL, "paving")
    apron = house.buffer(10.0, join_style="mitre").difference(house)
    parts += prism(apron, 0, VOXEL, "paving")

    # The roof: a fan of leaves round the well, climbing clockwise from the plaza in the west through north and
    # east to its top in the south-south-west; each leaf a step higher than the last.
    step = TURN / BLADES
    for i in range(BLADES):
        a1 = START - i * step                               # clockwise is a falling bearing
        a0 = a1 - step
        h = snap(PLAZA + (TOP - PLAZA) * (i + 1) / BLADES)
        leaf = house.intersection(wedge(a0, a1))
        parts += prism(leaf, 0, h, "white")
    # The fan's ribs: a raised line along every fold between two leaves, from the well's edge to the roof's.
    for i in range(1, BLADES):
        a = math.radians(START - i * step)
        h = snap(PLAZA + (TOP - PLAZA) * (i + 1) / BLADES) + VOXEL
        rib = LineString([HUB, (HUB[0] + 400 * math.cos(a), HUB[1] - 400 * math.sin(a))]).buffer(VOXEL / 2 + 0.1, cap_style="flat")    # a voxel wide, so the fold reads unbroken
        parts += prism(rib.intersection(house).difference(Point(HUB).buffer(WELL + 2.0)), 0, h, "white")
    # The gap the stair leaves between the roof's top and its foot: a lower hall, its face to the top glazed.
    g0, g1 = START - TURN, START - 360                     # from the top's edge round to the foot's, the short way
    gap = house.intersection(wedge(g1, g0))
    parts += prism(gap, 0, LOW, "white")

    # Glass under the high leaves: the roof's edge cut back and glass set in under it.
    high = Polygon()
    for i in range(BLADES):
        h = snap(PLAZA + (TOP - PLAZA) * (i + 1) / BLADES)
        if h >= GLASS_UNDER:
            a1 = START - i * step
            high = high.union(wedge(a1 - step, a1))
    band = house.difference(house.buffer(-GLASS_IN, join_style="mitre")).intersection(high)
    parts += pcut(band, PLAZA, GLASS_H - PLAZA)                # the floor under the overhang kept at the plaza's
    parts += prism(band, 0, PLAZA, "paving")
    pane = house.buffer(-GLASS_IN + 0.1, join_style="mitre").difference(house.buffer(-GLASS_IN - VOXEL, join_style="mitre"))
    parts += prism(pane.intersection(high), 0, GLASS_H, "glass")
    # The top leaf's face to the gap: glass, the height of the lower hall's roof up (the 1,000-seat hall's glass
    # wall is about 13 m high; where it stands is not known).
    top_edge = house.intersection(wedge(g0 - 3.0, g0 + 0.5)).difference(Point(HUB).buffer(WELL))
    parts += prism(top_edge, LOW, snap(TOP - LOW - VOXEL), "glass")

    # The stage towers, standing through the roof, inside the plan.
    for (cx, cy), (w, d), h in TOWERS:
        tower = Polygon([(cx - w / 2, cy - d / 2), (cx + w / 2, cy - d / 2), (cx + w / 2, cy + d / 2), (cx - w / 2, cy + d / 2)])
        parts += prism(tower.intersection(house), 0, h, "white")

    # The well: an open court, its stair winding up round its wall from the plaza to the roof's top.
    parts += pcut(Point(HUB).buffer(WELL, 32), PLAZA, 60.0)
    ring_ = Point(HUB).buffer(STAIR[1], 32).difference(Point(HUB).buffer(STAIR[0], 32))
    flights = 16
    for i in range(flights):
        a1 = START - i * TURN / flights
        h = snap(PLAZA + (TOP - PLAZA) * (i + 1) / flights)
        parts += prism(ring_.intersection(wedge(a1 - TURN / flights, a1)), h - VOXEL, VOXEL, "white")
    parts.append({"cyl": [HUB[0], HUB[1], 0, STAIR[0], PLAZA], "m": "paving"})

    # The park round it (Expo Culture Park): trees where the plaza and the house are not, in rows the satellite's
    # green suggests but does not count.
    keep = house.buffer(16.0)
    paved = [p for p in parts if p.get("m") == "paving" and "prism" in p]
    paved = shapely.union_all([Polygon(p["prism"]) for p in paved]).buffer(4.0)
    trees = []
    for j in range(-6, 7):
        for i in range(-7, 8):
            x = i * 26.0 + (13.0 if j % 2 else 0.0) + 7.0 * math.sin(i * 1.7 + j * 2.3)
            y = j * 26.0 + 7.0 * math.cos(i * 2.9 - j * 1.1)
            if abs(x) > SITE[0] / 2 - 10 or abs(y) > SITE[1] / 2 - 10:
                continue
            p = Point(x, y)
            if keep.contains(p) or paved.contains(p):
                continue
            h = 9.0 + 4.0 * (0.5 + 0.5 * math.sin(x * 0.37 + y * 0.53))
            trees.append({"tree": [round(x, 1), round(y, 1), round(h, 1), round(h * 0.42, 1)]})
    parts += trees

    glass = f"under every leaf {GLASS_UNDER:g} m or more up, {GLASS_H:g} m tall, {GLASS_IN:g} m back"
    notes = (
        "Built from sources, no photograph of the built house read (snohetta.com and the architecture press are "
        "refused to the session); scripts/model_shanghai_opera.py writes it, and its docstring lists them. "
        "Plan: OpenStreetMap way 1316877742 (ODbL), which Overture's ground agrees with; Sentinel-2 of 8 and 14 "
        "October 2026 shows the white roof filling it and paved fingers running west from it toward the Huangpu. "
        "Heights: 45 m at most (World Construction Network), the roof's public platform 28 m (SmartShanghai) to "
        "about 40 m (Xinhua), here 30.6; a double-helix stair in a round well (22-32 m radius, about 295 degrees) "
        "climbs to it, here one helix (the two do not part at 3.4 m a voxel); three halls of 2,000, 1,200 and "
        "1,000 seats, so three stage towers, 37-44 m; full-height glass under the white roof (UHPC). Placed after "
        "Snøhetta's film of the design (2019) seen from above: the well about 35 m south of the outline's middle, "
        "the towers in the south and east, the roof's ribs fanning north and west. Guessed: the way the roof winds "
        "(clockwise up from the plaza in the west to its top in the south-south-west), every height between, "
        f"which tower is which hall, where the glass stands ({glass}), the "
        "lower hall in the gap between the roof's top and foot and its glazed face (the 1,000-seat hall's glass "
        "wall is about 13 m high; where it stands is not known), the red public hall behind the glass (13,000 m2, "
        "not drawn), the park's trees. Refine from photographs and drawings when they can be read."
    )
    return {
        "slug": SLUG,
        "name": "Shanghai Grand Opera House",
        "voxel": VOXEL,
        "site": SITE,
        "ground": "grass",
        "parts": parts,
        "notes": notes,
    }


if __name__ == "__main__":
    m = model()
    OUT.write_text(json.dumps(m, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{OUT.relative_to(ROOT)}: {len(m['parts'])} parts")
