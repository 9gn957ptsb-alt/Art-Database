#!/usr/bin/env python3
"""The Shanghai Grand Opera House (Snøhetta, 2026), as a model of the site's parts.

    python3 scripts/model_shanghai_opera.py      # writes docs/v2/models/shanghai-grand-opera-house-by-snohetta.json

The first building of the Architecture layer added by hand (scripts/architecture_hand.json): the artist asked for
it (21 Oct 2026) and it is not among his Architectural Authority bookmarks. Its sources (reference only: no
photograph is ever copied into the repository), and what each gave:

- the plan: OpenStreetMap's outline (way 1316877742, ODbL), which Overture's ground round it agrees with;
- where things stand on it: ArchDaily's straight-down aerial of the roof under construction (8 Nov 2023, its
  "Unveiling New Images" article, picture 3), fitted to that outline by rotation and scale (about 165 degrees, 4.0
  pixels a metre, 5.7 m between the two outlines): the hub of the fan, at (-33, 41) m east and north of the outline's
  middle, the three stage towers' corners, the cantilever's straight edge; Sentinel-2 of 14 October 2026 shows
  their shadows where the fit puts them;
- the form: the photographs of the finished house in ArchDaily's "First Look" (Feb 2026) and "Nears Completion"
  (Jul 2026) articles and Archinect's post the artist sent (LinkedIn, 21 Oct 2026): a white roof over glass walls
  between white fins; three white stage towers, finned, the largest in the south-west; on the north side a fan of
  stepped leaves that comes down from the high roof by the north-east tower, over the north, to a plaza by the
  river on the west, its eave lower as it goes; there, at the hub, the spiral stair, a twisted cone whose top ring
  sweeps out over the fan and joins the high west wing, whose curved glass wall faces the plaza; Snøhetta's renders
  of 2019 (ArchDaily, "Evokes the Image of an Unfolding Fan") show the same;
- the words: Dezeen (Jul 2025: "a sculptural staircase that spirals over a sloping roof to meet it at its highest
  point"; "the building's accessible roof wraps around the spiral staircase, forming a second stepped route between
  the top of the rooftop and a plaza next to the Huangpu River"), ArchDaily (the landscape's radial layout, "a
  spiralling stairway connects the ground to a sweeping roofscape"), Snøhetta's own page (146,786 m2, three
  auditoriums of 4,200 seats);
- the figures: 45.5 m at the highest and a footprint of about 271 by 251 m (Metalocus, through a search's summary,
  its page refused to the session), 409 steps to the roof (the Chinese press, the same way), a cantilever of 30 m.

Estimated from the photographs, not measured: the high roof's height (27.2 m, its glass walls 20.4 m to a fascia
of two voxels), the fan's eave at each angle, the stair's flare; not resolved at 3.4 m a voxel: which way the stair
itself turns, its steps, the oculus under it.

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

HUB = (-33.0, -41.0)         # the fan's hub, where the stair stands: 33 m west and 41 m north of the middle (the aerial)
ROOF_H = 27.2                # the high roof (estimated: glass walls about 20 m to a deep fascia); eight voxels
FASCIA = 6.8                 # the high roof's edge, its glass set back this far under it
FAN = (20.0, 140.0)          # the stepped fan, angles from east, anticlockwise as on a map: at its full height by the
                             # north-east tower (20), down to the plaza (140) — seen from above it climbs clockwise
NOTCH = (140.0, 205.0)       # the plaza cutting in under the stair, to the high west wing's glass wall (205: the
                             # aerial's straight edge)
BOWL = (10.0, 70.0)          # the fan steps up from the hub: nothing at 10 m out, full height at 70 m
LEAF = 5.0                   # the fan's leaves, degrees
TERRACE = 3.4                # its rings, metres
STAIR = (6.0, 0.6, 14.0)     # the twisted cone: radius at the plaza, its flare a metre up, the free space round it
RING = (14.0, 26.0, 20.0, 205.0)  # the stair's top ring: radii, and the angles it sweeps over the fan to the wing
# The stage towers: their corners as the aerial has them (x east, y south), their heights (the highest 45.5 m:
# Metalocus); which hall each is, guessed (the largest the 2,000-seat main hall's).
TOWERS = [
    ([(-23.4, 104.7), (-92.1, 95.1), (-68.3, 31.5), (-23.2, 37.3)], 44.2),
    ([(98.7, 47.2), (56.0, 70.6), (16.4, 35.1), (55.3, 1.6)], 40.8),
    ([(87.2, -53.3), (41.3, -51.5), (34.2, -101.5), (82.2, -101.4)], 37.4),
]
LEAN = 0.12                  # the towers' faces above the roof lean in this many metres a metre up
FINGERS = [(-200.0, -67.0), (-200.0, -42.0), (-200.0, -8.0), (-200.0, 33.0)]   # paved fingers' tips (Sentinel-2)
RAYS = 9.0                   # the high roof's rays from the hub, degrees apart


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


def floor_v(z):
    return math.floor(z / VOXEL + 1e-9) * VOXEL


def fan_height(a, r):
    """The fan's top at an angle and a distance from the hub: down the leaves anticlockwise from the high roof to the
    plaza, and up the terraces from the hub."""
    by_a = ROOF_H * (FAN[1] - a) / (FAN[1] - FAN[0])
    by_r = ROOF_H * (r - BOWL[0]) / (BOWL[1] - BOWL[0])
    return floor_v(max(0.0, min(ROOF_H, by_a, by_r)))


def reach(house, a):
    """How far the outline is from the hub at an angle."""
    far = (HUB[0] + 600 * math.cos(math.radians(a)), HUB[1] - 600 * math.sin(math.radians(a)))
    cut = LineString([HUB, far]).intersection(house.exterior)
    pts = [cut] if cut.geom_type == "Point" else [g for g in getattr(cut, "geoms", []) if g.geom_type == "Point"]
    return max((Point(HUB).distance(p) for p in pts), default=0.0)


def model():
    at = json.loads((ROOT / "scripts" / "architecture_hand.json").read_text())["buildings"]
    at = next(b for b in at if b["slug"] == SLUG)
    house = Polygon([local(lon, lat, at) for lon, lat in OUTLINE])
    inner = house.buffer(-FASCIA, join_style="mitre")
    edge = house.difference(inner)
    parts = []

    # The plaza by the river: under the stair, out to the fingers, and an apron round the house.
    plaza = wedge(NOTCH[0] - 15.0, NOTCH[1] + 20.0, r=130.0).difference(house)
    parts += prism(plaza, 0, VOXEL, "paving")
    for tx, ty in FINGERS:
        a = math.atan2(ty - HUB[1], tx - HUB[0])
        nx, ny = -math.sin(a), math.cos(a)
        w0, w1 = 7.0, 4.0
        finger = Polygon([(HUB[0] + nx * w0, HUB[1] + ny * w0), (tx + nx * w1, ty + ny * w1),
                          (tx - nx * w1, ty - ny * w1), (HUB[0] - nx * w0, HUB[1] - ny * w0)])
        parts += prism(finger.difference(house), 0, VOXEL, "paving")
    parts += prism(house.buffer(10.0, join_style="mitre").difference(house), 0, VOXEL, "paving")
    parts += prism(house.intersection(wedge(*NOTCH)).union(disc(STAIR[2]).intersection(house)), 0, VOXEL, "paving")

    # The roof, terrace by terrace: the high roof round the south and east at its full height; the fan on the north
    # stepping down its leaves anticlockwise to the plaza, and up its terraces from the hub.
    high = house.intersection(wedge(NOTCH[1], FAN[0] + 360.0)).difference(disc(STAIR[2]))
    cells = []
    a = FAN[0]
    while a < FAN[1] - 1e-9:
        r = 0.0
        while r < 220.0:
            cell = wedge(a, a + LEAF, r=r + TERRACE).difference(disc(r)) if r > 0 else wedge(a, a + LEAF, r=TERRACE)
            cells.append((cell, fan_height(a + LEAF / 2, r + TERRACE / 2)))
            r += TERRACE
        a += LEAF
    fan = house.intersection(wedge(*FAN))
    levels = int(round(ROOF_H / VOXEL))
    terraces = []
    for k in range(1, levels + 1):
        z = k * VOXEL
        up = shapely.union_all([c for c, h in cells if h >= z - 1e-6] or [Polygon()])
        terraces.append(high.union(fan.intersection(up)))
        parts += prism(terraces[-1], z - VOXEL, VOXEL, "white")

    # Rays from the hub, as lines in the roof's top wherever it is, high roof and fan (the photographs' lit
    # grooves on the one, the leaves' joints on the other).
    rays = []
    a = FAN[0] + RAYS / 2
    while a < FAN[0] + 360.0:
        if not (NOTCH[0] - RAYS / 2 < a < NOTCH[1] + RAYS / 2):
            ray = LineString([HUB, (HUB[0] + 400 * math.cos(math.radians(a)), HUB[1] - 400 * math.sin(math.radians(a)))])
            rays.append(ray.buffer(VOXEL / 2 + 0.1, cap_style="flat"))
        a += RAYS
    rays = shapely.union_all(rays).difference(disc(STAIR[2] + 12.0))
    for k, terrace in enumerate(terraces):
        top = terrace.difference(terraces[k + 1]) if k + 1 < len(terraces) else terrace
        parts += prism(rays.intersection(top), k * VOXEL, VOXEL, "concrete")

    # Glass under the eaves, between white fins: the high roof's edge set back FASCIA; under the fan, as high as
    # its leaf's eave leaves room for, and none where the leaves come down to the plaza.
    glass_line = house.buffer(-FASCIA + 0.1, join_style="mitre").difference(house.buffer(-FASCIA - VOXEL, join_style="mitre"))
    spans = [(NOTCH[1], FAN[0] + 360.0, ROOF_H - FASCIA)]
    a = FAN[0]
    while a < FAN[1] - 1e-9:
        eave = fan_height(a + LEAF / 2, reach(house, a + LEAF / 2) - FASCIA / 2)
        spans.append((a, a + LEAF, eave - VOXEL))
        a += LEAF
    for a0, a1, top in spans:
        if top < 2 * VOXEL:
            continue
        sector = wedge(a0, a1)
        parts += pcut(edge.intersection(sector), VOXEL, top - VOXEL)
        parts += prism(edge.intersection(sector), 0, VOXEL, "paving")
        parts += prism(glass_line.intersection(sector), 0, top, "glass")
    # The high west wing's face to the plaza: its tall curved glass wall (the 1,000-seat hall's), under the roof.
    notch = house.intersection(wedge(*NOTCH)).union(disc(STAIR[2]).intersection(house))
    face = high.intersection(notch.buffer(FASCIA))
    parts += pcut(face, VOXEL, ROOF_H - FASCIA - VOXEL)
    parts += prism(face, 0, VOXEL, "paving")
    parts += prism(high.intersection(notch.buffer(FASCIA + VOXEL)).difference(notch.buffer(FASCIA)), 0, ROOF_H - FASCIA, "glass")
    # The fins: white, a voxel square, every three voxels along the glass.
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

    # The stage towers, standing through the roof, white and finned (their tops grey, as the photographs have them).
    for corners, h in TOWERS:
        tower = Polygon(corners)
        tower = shapely.affinity.scale(tower, 0.92, 0.92, origin="centroid").intersection(house.buffer(-3.0))
        parts += prism(tower, 0, ROOF_H, "white")
        # Above the roof their faces lean in a little, as the photographs have them; the lean's top, grey.
        rise = h - ROOF_H - VOXEL
        parts += prism(tower, ROOF_H, rise, "white", taper=LEAN)
        parts += prism(tower.buffer(-LEAN * rise, join_style="mitre"), h - VOXEL, VOXEL, "metal")

    # The spiral stair at the hub: a twisted cone flaring up from the plaza, open toward the fan and the plaza ...
    parts += pcut(disc(STAIR[2]).intersection(house), VOXEL, 60.0)
    k = 0
    while (k + 1) * VOXEL <= ROOF_H - VOXEL + 1e-6:
        r = STAIR[0] + STAIR[1] * (k + 0.5) * VOXEL
        cone = disc(STAIR[0]).union(disc(r).intersection(wedge(FAN[0], NOTCH[1])))
        parts += prism(cone, k * VOXEL, VOXEL, "white")
        k += 1
    # ... and its top ring sweeping out over the fan and the plaza to the high west wing.
    top_ring = disc(RING[1]).difference(disc(RING[0])).intersection(wedge(RING[2], RING[3]))
    parts += prism(top_ring, ROOF_H - VOXEL, VOXEL, "white")

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

    notes = (
        "From photographs of the finished house and of its roof under construction, read 21 Oct 2026 (ArchDaily's "
        "articles; Archinect's post the artist sent; Snøhetta's renders of 2019), the words of Dezeen, ArchDaily and "
        "Snøhetta's page, and OpenStreetMap's outline (way 1316877742); scripts/model_shanghai_opera.py writes it, and "
        "its docstring says what each source gave. Placed by ArchDaily's straight-down aerial of 2023, fitted to the "
        "outline (within about 6 m): the hub of the fan 33 m west and 41 m north of the middle, the three stage towers "
        "(the largest in the south-west, 44.2 m: the highest point is 45.5 m, Metalocus), the stair's straight end. "
        "The high roof round the south and east (27.2 m, estimated from the photographs: glass walls about 20 m "
        "between white fins, under a deep white fascia) carries rays from the hub. On the north the stepped fan comes "
        "down, leaf by leaf, from the high roof by the north-east tower to the plaza by the river on the west, its "
        "eave lower as it goes, and its terraces step up from the hub (Dezeen: the roof wraps round the stair, a "
        "second stepped route between the rooftop and the plaza); seen from above it climbs clockwise from the "
        "plaza. At the hub the spiral stair, a twisted cone flaring from the plaza, its top ring sweeping out over "
        "the fan to the high west wing and its straight end cantilevered over the plaza (30 m). Estimated: every "
        "height but the highest, the fan's eaves, the stair's flare. Not resolved at 3.4 m a voxel: which way the "
        "stair itself turns (the press calls it a double spiral), its 409 steps, the oculus under it, the red "
        "public hall behind the glass. The park's trees are the site's."
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
