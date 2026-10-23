#!/usr/bin/env python3
"""The Shanghai Grand Opera House (Snøhetta, 2026), as a model of the site's parts.

    python3 scripts/model_shanghai_opera.py      # writes docs/v2/models/shanghai-grand-opera-house-by-snohetta.json

The first building of the Architecture layer added by hand (scripts/architecture_hand.json): the artist asked for
it (21 Oct 2026) and it is not among his Architectural Authority bookmarks. Its sources (reference only: no
photograph or drawing is ever copied into the repository), and what each gave:

- the plan: OpenStreetMap's outline (way 1316877742, ODbL), which Overture's ground round it agrees with;
- where things stand on it: gooood's site plan (Snøhetta's drawing), registered to that outline at 2.83 pixels a
  metre both ways with north 18.8 degrees off: the stair's mast 32 m west and 36 m north of the outline's middle,
  and the straight deck over it; ArchDaily's straight-down aerial of the roof under construction (8 Nov 2023)
  fitted to the outline: the three stage towers' corners, the plaza's straight edge;
- the heights: ArchDaily's and gooood's elevations and sections and Metalocus's sections, each scaled from the
  45.5 m tower (Metalocus: "a maximum height of 45.50 meters"): the deck and the stair's top 29.3-29.9 m, level with
  the roof's highest point; the towers 45.5, 36.4 and 27.4 m (1 : 0.80 : 0.60); the roof's eaves 7-13 m over the
  north, 12.4 north-east, 12.5-16 east, 26.2-26.6 south, 27-28 west; the stair's rim 8.6 m due south, 16.3 west,
  24 north;
- the stair's turn: clockwise seen from above as it climbs, read by seven readers from unmirrored photographs
  (Snøhetta's own, Dezeen's, Archinect's, gooood's, Metalocus's, ArchDaily's, and films of the opening) and from
  the drawings, each checked again by another: gooood's straight-down photograph shows its lower half turn filling
  the circle south-east of the deck, its upper half ring north-west of it, rising to the deck's north-east end;
  the plans' cut through the stepped surfaces turns clockwise floor by floor (true 111/291, 175/355, 45/225);
- the roof: the same plans and elevations, and the photographs: one stepped surface climbing clockwise from the
  plaza on the west-north-west, over the north and east, to the high west wing; the press calls it and the stair
  a double spiral (双螺旋楼梯), "up the large spiral 204 steps to the roof platform, then down the small spiral 205
  steps" (Qiao Shanghai's film of its visit, 1 Oct 2026; the press's total, 409);
- the court: the plans and the photographs: a round plaza under the stair, ringed south, east and north by the
  foyer's curved glass about 25 m out, open to the park from south-west round west to north-north-west; at the
  stair's foot a dark half-disc of glass about 25 m across over a court sunk about 3 m beside the mast (gooood's and
  Metalocus's plans and sections; the night aerials). No source shows or names an oculus in the roof; the eye of
  the stair is closed, its treads converging on the mast;
- the park: Metalocus's site plan, its paved strips and rows of trees radiating from the hub to the river.

Estimated, not measured: the stair's radius at each height (16-30 m in the readings), the glass under each eave,
the court's size. Not drawn at 3.4 m a voxel: the stair's 205 steps and the roof's 204, its walking band and the
seat steps inside it twisting down into the throat (one surface here), the red foyer behind the glass.

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

# Angles are degrees from east, anticlockwise as on a map, north up; clockwise seen from above is the way they fall.
HUB = (-32.0, -36.0)         # the stair's mast and the hub of the roof's rays: gooood's site plan registered to the
                             # outline (2.83 px a metre both ways), 32 m west and 36 m north of the middle
TOP = 29.5                   # the top deck, the stair's top, the roof's highest point (29.3-29.9 m in the sections
                             # and elevations of ArchDaily, gooood and Metalocus, scaled from the 45.5 m tower)
STAIR = (29.0, 344.0)        # the stair: where its foot stands (true bearing 61, ENE, by the foyer's glass) and how
                             # far it turns, clockwise, to TOP at the deck's north-east end: ArchDaily's elevations put
                             # its rim at 8.6 m due south, 16.3 west, 24 north (0.086 m a degree throughout)
ROOF = (159.0, 294.0)        # the stepped roof: where it comes down to the plaza (true 291, WNW: the ground-floor plans'
                             # band) and how far it turns, clockwise, to the high west wing
ROOF_H = 27.2                # the roof at its highest, eight voxels (the eaves south and west 26.2-28 m)
FASCIA = 6.8                 # the roof's white edge, its glass set back this far under it
COURT = 23.0                 # the round plaza under the stair, open to the sky; its glass a voxel in under the roof's
                             # edge, about 25 m out (the ground plans)
PLAZA = (159.0, 205.0)       # where the court opens to the park: from the roof's foot to the high west wing's
                             # straight edge (205: the aerial's)
LEAF = 5.0                   # the roof's leaves, degrees
MAST = 2.0                   # the stair's hollow mast, about 4 m across (3.8-4.3 m in the sections)
RIM = (18.0, 26.0, 6.0)      # the stair's outer radius at its foot, and from 6 m up
DECK = (45.0, 32.0, 30.0, 5.0)  # the straight deck over the top: its line (45/225), how far it reaches north-east
                             # (a round end over the roof) and south-west (into the high roof), its width
DISC = 13.0                  # the dark half-disc in the plaza at the stair's foot, on the band's south-south-west side
# The stage towers: their corners as the aerial has them (x east, y south), their heights from ArchDaily's and
# gooood's elevations (the highest 45.5 m: Metalocus; 1 : 0.80 : 0.60): Harmony Hall's in the south-west, Soar
# Theatre's in the south-east, Open Stage's in the north-east.
TOWERS = [
    ([(-23.4, 104.7), (-92.1, 95.1), (-68.3, 31.5), (-23.2, 37.3)], 45.5),
    ([(98.7, 47.2), (56.0, 70.6), (16.4, 35.1), (55.3, 1.6)], 36.4),
    ([(87.2, -53.3), (41.3, -51.5), (34.2, -101.5), (82.2, -101.4)], 27.4),
]
LEAN = 0.12                  # the towers' faces above the roof lean in this many metres a metre up
FINGERS = [(-200.0, -67.0), (-200.0, -42.0), (-200.0, -8.0), (-200.0, 33.0)]   # paved fingers' tips (Sentinel-2)
RAYS = 9.0                   # the roof's rays from the hub, degrees apart


def local(lon, lat, at):
    """Metres east and south of the point, as build_grounds.py and overture_outline.py reckon them."""
    return ((lon - at["lon"]) * 111320.0 * math.cos(math.radians(at["lat"])), -(lat - at["lat"]) * 111320.0)


def ring(poly):
    """A shapely polygon's outline as [[x, y], ...], 0.1 m, without the closing point."""
    pts = list(poly.exterior.coords)[:-1]
    return [[round(x, 1), round(y, 1)] for x, y in pts]


def polys(geom):
    """The polygons of a shape, each simplified to a quarter of a metre (a fifteenth of a voxel)."""
    if geom.is_empty:
        return []
    geom = geom.simplify(0.25)
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom] if geom.area > 1 else []
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
    """The sector between two angles (degrees from east, anticlockwise as on a map, north up). y is south, so an
    angle's y is minus its sine."""
    lo, hi = min(a0, a1), max(a0, a1)
    pts = [at]
    steps = max(2, int((hi - lo) / 3) + 1)
    for i in range(steps + 1):
        a = math.radians(lo + (hi - lo) * i / steps)
        pts.append((at[0] + r * math.cos(a), at[1] - r * math.sin(a)))
    return Polygon(pts)


def disc(r, at=HUB):
    return Point(at).buffer(r, 32)


def turned(a, foot):
    """How far round from its foot a spiral has come at angle a: degrees, clockwise seen from above."""
    return (foot - a) % 360.0


def rise(s, turn):
    """The height a spiral has climbed when it has turned s of its turn degrees: evenly, to TOP."""
    return TOP * min(s, turn) / turn


def roof_top(a):
    """The roof's top at an angle round the hub: the stepped roof climbing clockwise from the plaza, leaf by leaf,
    to the high west wing; past TURN it is the high wing itself. Whole voxels, rounded up (the eaves measured at
    north 7-13 m, north-east 12.4, east 12.5-16, south 26.2-26.6, west 27-28)."""
    return min(ROOF_H, max(1, math.ceil(rise(turned(a, ROOF[0]), ROOF[1]) / VOXEL - 1e-9)) * VOXEL)


def glass_top(eave):
    """How high the glass goes under an eave: a voxel under it, and never above the high roof's glass."""
    return min(eave - VOXEL, ROOF_H - FASCIA)


def leaves():
    """The roof's leaves, each [a, a + LEAF), from the high west wing's edge round clockwise to the roof's foot."""
    a = PLAZA[1]
    out = []
    while a < PLAZA[0] + 360.0 - 1e-9:
        out.append(a % 360.0)
        a += LEAF
    return out


def model():
    at = json.loads((ROOT / "scripts" / "architecture_hand.json").read_text())["buildings"]
    at = next(b for b in at if b["slug"] == SLUG)
    house = Polygon([local(lon, lat, at) for lon, lat in OUTLINE])
    inner = house.buffer(-FASCIA, join_style="mitre")
    edge = house.difference(inner)
    court = disc(COURT).union(wedge(*PLAZA)).intersection(house)
    parts = []

    # The plaza by the river: under the stair, out to the fingers, and an apron round the house.
    plaza = wedge(PLAZA[0] - 15.0, PLAZA[1] + 20.0, r=130.0).difference(house)
    parts += prism(plaza, 0, VOXEL, "paving")
    for tx, ty in FINGERS:
        a = math.atan2(ty - HUB[1], tx - HUB[0])
        nx, ny = -math.sin(a), math.cos(a)
        w0, w1 = 7.0, 4.0
        finger = Polygon([(HUB[0] + nx * w0, HUB[1] + ny * w0), (tx + nx * w1, ty + ny * w1),
                          (tx - nx * w1, ty - ny * w1), (HUB[0] - nx * w0, HUB[1] - ny * w0)])
        parts += prism(finger.difference(house), 0, VOXEL, "paving")
    parts += prism(house.buffer(10.0, join_style="mitre").difference(house), 0, VOXEL, "paving")
    parts += prism(court, 0, VOXEL, "marble")

    # The roof, terrace by terrace: one stepped surface climbing clockwise from the plaza on the west-north-west,
    # low over the north (the fan), higher over the east, to the high roof round the south and the high west wing.
    tops = [(house.intersection(wedge(a, a + LEAF)).difference(court), roof_top(a + LEAF / 2)) for a in leaves()]
    levels = int(round(ROOF_H / VOXEL))
    terraces = []
    for k in range(1, levels + 1):
        z = k * VOXEL
        terraces.append(shapely.union_all([g for g, h in tops if h >= z - 1e-6] or [Polygon()]))
        parts += prism(terraces[-1], z - VOXEL, VOXEL, "white")

    # Rays from the hub, as lines in the roof's top wherever it is (the photographs' joints, lit at night).
    rays = []
    a = PLAZA[1] + RAYS / 2
    while a < PLAZA[0] + 360.0:
        ray = LineString([HUB, (HUB[0] + 400 * math.cos(math.radians(a)), HUB[1] - 400 * math.sin(math.radians(a)))])
        rays.append(ray.buffer(VOXEL / 2 + 0.1, cap_style="flat"))
        a += RAYS
    rays = shapely.union_all(rays).difference(disc(COURT + 2 * VOXEL))
    for k, terrace in enumerate(terraces):
        top = terrace.difference(terraces[k + 1]) if k + 1 < len(terraces) else terrace
        parts += prism(rays.intersection(top), k * VOXEL, VOXEL, "paving")

    # Glass under the eaves, leaf by leaf: round the outside set back FASCIA under the white edge, and round the
    # court a voxel in (the foyer's curved glass wall, which the plaza runs under the stair up to). None where the
    # leaves come down low.
    def band(shape, d):
        return shape.buffer(d, join_style="mitre").difference(shape).intersection(house)
    rims = [(edge, house.buffer(-FASCIA + 0.1, join_style="mitre").difference(house.buffer(-FASCIA - VOXEL, join_style="mitre")), "paving"),
            (band(court, VOXEL), band(court.buffer(VOXEL - 0.1, join_style="mitre"), VOXEL + 0.1), "marble")]
    spans = []
    for a in leaves():
        top = glass_top(roof_top(a + LEAF / 2))
        spans.append((a, a + LEAF, top))
        if top < 2 * VOXEL:
            continue
        sector = wedge(a, a + LEAF)
        for under, glass, floor in rims:
            parts += pcut(under.intersection(sector), VOXEL, top - VOXEL)
            parts += prism(under.intersection(sector), 0, VOXEL, floor)
            parts += prism(glass.intersection(sector), 0, top, "glass")
    # The fins: white, a voxel square, every three voxels along the outer glass.
    path = house.buffer(-FASCIA - VOXEL / 2, join_style="mitre").exterior
    s = 0.0
    while s < path.length:
        p = path.interpolate(s)
        ang = math.degrees(math.atan2(-(p.y - HUB[1]), p.x - HUB[0])) % 360.0
        top = None
        for a0, a1, t in spans:
            if (a0 <= ang < a1) or (a0 <= ang + 360.0 < a1):
                top = t
        if top and top >= 2 * VOXEL:
            parts += prism(Point(p.x, p.y).buffer(VOXEL / 2 + 0.1, cap_style="square"), 0, top, "white")
        s += 3 * VOXEL

    # The stage towers, standing through the roof, white and finned, their faces leaning in above it (their tops
    # grey, as the photographs have them).
    for corners, h in TOWERS:
        tower = Polygon(corners)
        tower = shapely.affinity.scale(tower, 0.92, 0.92, origin="centroid").intersection(house.buffer(-3.0))
        c = tower.centroid
        base = roof_top(math.degrees(math.atan2(-(c.y - HUB[1]), c.x - HUB[0])) % 360.0)
        parts += prism(tower, 0, base, "white")
        rise_ = h - base - VOXEL
        parts += prism(tower, base, rise_, "white", taper=LEAN)
        parts += prism(tower.buffer(-LEAN * rise_, join_style="mitre"), h - VOXEL, VOXEL, "metal")

    # In the plaza at the stair's foot, half a disc of dark glass over the sunken court beside the mast.
    parts += prism(wedge(ROOF[0], ROOF[0] + 180.0, r=DISC).difference(disc(MAST)), 0, VOXEL, "glass")

    # The spiral stair: a helicoid of steps cantilevered from its mast, one turn clockwise from the foyer's glass on
    # the east-north-east, its lower half bulging round the south-east toward the glass, its upper half ring sweeping
    # out over the plaza on the west and over the fan on the north to the deck's north-east end. (Its walking band,
    # 13-27 m out, and the seat steps inside it that twist down into the throat are one surface at 3.4 m a voxel.)
    n = int(math.ceil(TOP / VOXEL))
    for k in range(n):
        s0, s1 = STAIR[1] * k * VOXEL / TOP, min(STAIR[1], STAIR[1] * (k + 1) * VOXEL / TOP)
        sweep = wedge(STAIR[0] - s1 - 2.0, STAIR[0] - s0 + 2.0)
        rim = RIM[0] + (RIM[1] - RIM[0]) * min(1.0, rise(s1, STAIR[1]) / RIM[2])
        parts += prism(disc(rim).difference(disc(MAST)).intersection(sweep), k * VOXEL, VOXEL, "white")
    parts += prism(disc(MAST + 0.4), 0, n * VOXEL, "concrete")
    # The straight deck over the top, railed both sides: from a round end out over the roof on the north-east,
    # across the mast, into the high roof on the south-west, wider there.
    da = math.radians(DECK[0])
    ux, uy, nx, ny = math.cos(da), -math.sin(da), math.sin(da), math.cos(da)

    def on(t, w):
        return (HUB[0] + t * ux + w * nx, HUB[1] + t * uy + w * ny)
    w = DECK[3] / 2
    deck = Polygon([on(-DECK[2], -w - 0.8), on(-DECK[2], w + 0.8), on(0, w), on(DECK[1], w), on(DECK[1], -w), on(0, -w)])
    deck = deck.union(Point(on(DECK[1], 0)).buffer(w + 1.0, 24))
    parts += prism(deck, (n - 1) * VOXEL, VOXEL, "white")

    # The park round it (Expo Culture Park): west of the plaza, rows of trees radiating from the hub between the
    # paved fingers, as Metalocus's site plan draws them (five rows, four strips); elsewhere trees where the plaza
    # and the house are not, in rows the satellite's green suggests but does not count.
    keep = house.buffer(16.0)
    paved = [p for p in parts if p.get("m") == "paving" and "prism" in p]
    paved = shapely.union_all([Polygon(p["prism"]) for p in paved]).buffer(4.0)
    fingers = sorted(math.degrees(math.atan2(-(ty - HUB[1]), tx - HUB[0])) % 360.0 for tx, ty in FINGERS)
    rows = [2 * fingers[0] - (fingers[0] + fingers[1]) / 2] + [(a + b) / 2 for a, b in zip(fingers, fingers[1:])]
    rows.append(2 * fingers[-1] - (fingers[-2] + fingers[-1]) / 2)
    west = wedge(rows[0] - 4.0, rows[-1] + 4.0)
    spots = []
    for a in rows:
        r = 40.0
        while r < 260.0:
            spots.append((HUB[0] + r * math.cos(math.radians(a)), HUB[1] - r * math.sin(math.radians(a))))
            r += 11.0
    for j in range(-6, 7):
        for i in range(-7, 8):
            x = i * 26.0 + (13.0 if j % 2 else 0.0) + 7.0 * math.sin(i * 1.7 + j * 2.3)
            y = j * 26.0 + 7.0 * math.cos(i * 2.9 - j * 1.1)
            if not west.contains(Point(x, y)):
                spots.append((x, y))
    trees = []
    for x, y in spots:
        if abs(x) > SITE[0] / 2 - 10 or abs(y) > SITE[1] / 2 - 10:
            continue
        p = Point(x, y)
        if keep.contains(p) or paved.contains(p):
            continue
        h = 9.0 + 4.0 * (0.5 + 0.5 * math.sin(x * 0.37 + y * 0.53))
        trees.append({"tree": [round(x, 1), round(y, 1), round(h, 1), round(h * 0.42, 1)]})
    parts += trees

    notes = (
        "From the press's photographs and Snøhetta's drawings of the finished house, read 21 and 22 Oct 2026 "
        "(Snøhetta, Dezeen, Archinect, gooood, Metalocus, ArchDaily, films of the opening), and OpenStreetMap's "
        "outline (way 1316877742); scripts/model_shanghai_opera.py writes it, and its docstring says what each gave. "
        "The spiral stair turns clockwise as it climbs, about one turn round its mast from the foyer's glass on the "
        "east-north-east to the north-east end of a straight deck at 29.5 m that crosses its top and runs into the "
        "high west wing. The stepped roof is the second spiral: it climbs clockwise from the plaza on the "
        "west-north-west, low over the north (7-13 m), higher over the east, to 26-28 m round the south and the west; "
        "up its 204 steps and down the stair's 205 is the loop the press calls a double spiral (409 steps). The "
        "towers 45.5, 36.4 and 27.4 m. Under the stair a round plaza ringed by the foyer's glass, and at its foot a "
        "dark half-disc of glass over a sunken court; there is no oculus in the roof. Estimated: the stair's radius "
        "at each height, the glass under each eave. The park's trees are the site's, in the site plan's radial rows "
        "on the west."
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
    print(f"{OUT.relative_to(ROOT)}: {len(m['parts'])} parts, {OUT.stat().st_size // 1024} KB")
