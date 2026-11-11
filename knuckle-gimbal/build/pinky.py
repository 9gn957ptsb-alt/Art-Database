# Works out the plan outlines of the grip's two little-finger versions that need polygon booleans, which the SketchUp
# build doesn't have, and writes them to pinky_data.py as plain lists (0.01 mm). The sizes are in variants.py.
# Then writes su2_grip.py, the SketchUp step: gen.py + outlines.py + pinky_data.py + variants.py + su2_place.py.
# Run after changing any of them. Needs shapely.
import math, os
from shapely.geometry import Polygon, Point, MultiPoint, LineString, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = ["gen.py", "outlines.py", "pinky_data.py", "variants.py", "su2_place.py"]
for f in ("gen.py", "outlines.py", "variants.py"):
    exec(open(os.path.join(HERE, f)).read())

def loop(geom, tol=0.01, min_edge=0.15):
    # exterior of a shapely polygon as a ccw point list: simplified to 0.01 mm, no edge under min_edge
    pts = list(geom.simplify(tol).exterior.coords)[:-1]
    out = []
    for p in pts:
        if not out or math.dist(out[-1], p) >= min_edge: out.append(p)
    if math.dist(out[0], out[-1]) < min_edge: out.pop()
    return ccw(out)
def mirror(g):
    return Polygon([(a, -b) for a, b in g.exterior.coords])

# ---------- 3. Open well: a well beside the ring carriage at each end, bridged at the end face ----------
W = WELL
body = Polygon(body_outline(y_end=Y_END + W["longer"]))
slot = Polygon(stadium(SC - WALL + 1.4, 132))
win = box(W["s0"], -90.0, W["s1"], W["y0"]).intersection(body.buffer(-W["bridge"], 64))
win = win.buffer(-W["corner"], 64).buffer(W["corner"], 64)
hole = unary_union([slot, win, mirror(win)])
hole = hole.buffer(W["round_out"], 64).buffer(-W["round_out"], 64).buffer(-W["round_in"], 64).buffer(W["round_in"], 64)
assert hole.geom_type == "Polygon" and not hole.interiors and body.contains(hole)
bridge = body.exterior.distance(hole)
# the outer edge's round comes down to W["bridge_R"] beside the bridges, so it and the well's R 2 edge fit the bar
rad = []
for p in body_outline(y_end=Y_END + W["longer"]):
    d = hole.exterior.distance(Point(p))
    t = min(1.0, max(0.0, (d - W["bridge"] - 0.5) / 3.0))
    rad.append(round(10 * (W["bridge_R"] + (3.0 - W["bridge_R"]) * t)))
track = Polygon(stadium(SC - WALL + 1.3, 132), [frame_inner()])
cut = track.difference(win).difference(mirror(win))
teeth = []
for sg in (1, -1):
    for a, b in W["teeth"]:
        teeth.append(box(a, min(sg * W["tooth_y"][0], sg * W["tooth_y"][1]), b, max(sg * W["tooth_y"][0], sg * W["tooth_y"][1])))
cut = unary_union([cut] + [t.intersection(track.buffer(0.6)) for t in teeth])
# round the rails' cut ends so no wedge is thinner than their R 0.3 edges allow (the well's corner meets the arc at a slant)
pieces = sorted((g.buffer(-0.5, 32).buffer(0.5, 32).buffer(0.5, 32).buffer(-0.5, 32) for g in cut.geoms), key=lambda g: g.centroid.x)
assert len(pieces) == 2 and not any(g.interiors for g in pieces)

# ---------- 4. Sliding tang: the relieved hinge-end corner and the strap's plan ----------
T = TANG
big = Polygon(body_outline(600))
R_CUT = RHOLE + T["wall"]
for sg in (1, -1):
    reg = box(-20.0, -90.0, T["cap"], -34.0).difference(Point(SC, -YC).buffer(R_CUT, 256))
    big = big.difference(reg if sg > 0 else mirror(reg))
hook = big.buffer(-5.0, 128).buffer(5.0, 128).buffer(2.0, 128).buffer(-2.0, 128)
hook_pts = ccw(resample(list(hook.exterior.coords)[:-1], 360))
orig = Polygon(body_outline(600)).exterior
hook_rad = [30 if orig.distance(Point(p)) < 0.05 else 20 for p in hook_pts]
for _ in range(2):   # ease the edge round between R 3 and R 2 over a few points
    hook_rad = [round((hook_rad[i - 1] + 2 * hook_rad[i] + hook_rad[(i + 1) % len(hook_rad)]) / 4) for i in range(len(hook_rad))]
cy = Y_HOME
def arcring(r, a0, a1, n=90):
    return [(SC + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
b0, b1 = T["band"]; r0, r1 = T["band_r"]
root = Polygon(arcring(r1, b0, b1) + arcring(r0, b0, b1)[::-1])
ns, nk = T["ns"], T["nk"]
grown = hook.buffer(T["clear"], 128)
def low_edge(s):
    # the relieved wall grown by the running clearance: lowest y of the body at s, bottom end
    seg = grown.intersection(LineString([(s, -60.0), (s, -20.0)]))
    return min(c[1] for g in getattr(seg, "geoms", [seg]) for c in g.coords)
YIN_S0, YIN_DS = 10.8, 0.2
yin = [round(100 * low_edge(YIN_S0 + YIN_DS * k)) for k in range(int(round((T["cap"] - YIN_S0) / YIN_DS)) + 1)]
top = max(low_edge(ns - nk + k * nk / 4) for k in range(9))
pad = box(ns - nk - 0.9, T["y_out"], ns + nk + 0.9, top)
web = MultiPoint(list(pad.exterior.coords) + arcring(r1, *T["web_arc"], n=30)).convex_hull
disc = Point(SC, cy).buffer(r0, 256)
strap = unary_union([root, web]).difference(disc).buffer(-0.6, 32).buffer(0.6, 32).difference(disc)
assert strap.geom_type == "Polygon" and not strap.interiors

# ---------- write ----------
DATA = {"well_hole": loop(hole, min_edge=0.25), "well_track_hinge": loop(pieces[0], min_edge=0.25), "well_track_free": loop(pieces[1], min_edge=0.25),
        "tang_hook": hook_pts, "tang_strap": loop(strap)}
RADII = {"well_body_r": rad, "tang_hook_r": hook_rad, "tang_yin": yin}
lines = ["# Generated by pinky.py from outlines.py and variants.py; don't edit. Plan outlines as (s, y) pairs in 0.01 mm, ccw;",
         "# edge radii in 0.1 mm, one per outline point; TANG_YIN the nose's inboard end (y, 0.01 mm) every TANG_YIN_DS mm of s.",
         "# PINKY_SUM guards against a mistyped number when the text is pasted."]
def ints(name, vals):
    s = ",".join(str(v) for v in vals); rows = []
    while s:
        cut_at = s.rfind(",", 0, 118) + 1 if len(s) > 118 else len(s)
        rows.append(s[:cut_at]); s = s[cut_at:]
    return name + " = [\n" + "\n".join(rows) + "]"
sums = {}
for k, pts in DATA.items():
    v = [round(c * 100) for p in pts for c in p]; lines.append(ints(k.upper(), v)); sums[k] = checksum(v)
for k, v in RADII.items():
    lines.append(ints(k.upper(), v)); sums[k] = checksum(v)
lines.append("TANG_YIN_S0, TANG_YIN_DS = %r, %r" % (YIN_S0, YIN_DS))
lines.append("PINKY_SUM = " + repr(sums))
open(os.path.join(HERE, "pinky_data.py"), "w").write("\n".join(lines) + "\n")
head = ("# Step 2. The grip's two little-finger versions, Open well and Sliding tang, each on its own tag and scene, in the hold pose.\n"
        "# Generated by pinky.py from " + ", ".join(SRC) + "; edit those, not this.\n")
open(os.path.join(HERE, "su2_grip.py"), "w").write(head + "".join("\n# ---------- " + f + " ----------\n" + open(os.path.join(HERE, f)).read() for f in SRC))
print("well: bridge %.2f mm, track pieces %s points, hole %d points | tang: hook %d points, strap %d points, %.1f mm2"
      % (bridge, [len(DATA[k]) for k in ("well_track_hinge", "well_track_free")], len(DATA["well_hole"]), len(hook_pts), len(DATA["tang_strap"]), strap.area))
print("su2_grip.py", os.path.getsize(os.path.join(HERE, "su2_grip.py")), "bytes")
