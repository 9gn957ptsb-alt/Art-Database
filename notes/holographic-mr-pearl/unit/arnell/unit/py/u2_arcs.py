"""(2) Scales and dynamic relationships (p20): circles falling by phi in the golden rectangle's squares, beside the
ladder's frames; and the reconstruct bend redrawn as arcs of stated circles in place of the free (quintic) curve."""
import sys, json, math
ARN = sys.argv[1]
sys.path.insert(0, ARN + "/unit/py")
import common as C
import numpy as np
S = C.S
sys.path.insert(0, S + "wf6/reconstruct")
import geom as G
import nest as N
F, U, PHI = C.F, C.U, C.PHI
SQ3, SQ2 = math.sqrt(3), math.sqrt(2)
res = {}

# ---------------- A. Fibonacci squares hold the ladder's circles exactly
# square side F(k) w with w = 2u/sqrt3  ->  inscribed circle radius F(k) u/sqrt3 = circumradius of a level k-4 frame
w = 2 * U / SQ3
rows = []
for k in range(2, 11):
    m = k - 4
    side = F(k) * w
    rows.append(dict(square_F=F(k), level=m, circle_R_block=side / 2, frame_outline_u=F(k),
                     ratio_to_next_smaller=(F(k) / F(k - 1)) if k > 2 else None,
                     golden_square_side_block=F(10) * w * PHI ** (k - 10), pct_off_golden=100 * (F(k) * w / (F(10) * w * PHI ** (k - 10)) - 1)))
res["fibonacci_squares"] = rows
res["fibonacci_squares_note"] = ("square side F(k)*(2u/sqrt3): its inscribed circle is exactly the holding circle of a level k-4 frame "
                                 "(R = F(k)u/sqrt3) and the frame is inscribed in it (vertices on the circle). Against true golden squares "
                                 "(side falling by phi) the Fibonacci squares are off by the ladder's own error.")
# row on one ground line: incircle radius R/2 tangent to the ground <=> the frame's base on the ground
res["row_rule"] = "frames of falling level stand on one ground line: base on the line <=> incircle (r = R/2) tangent to it"

# ---------------- B. the bend: arc - straight - arc
th = math.acos(-1 / 3)                 # 109.47 deg
d = SQ2 / 3                            # chord of the joggle (perpendicular to the axis), as reconstruct
rho = d / (2 * (1 - 1 / math.cos(th)))  # = d/8
ell = -2 * rho * math.tan(th)          # = 1/3
ax_adv = 2 * rho * math.sin(th) + ell * math.cos(th)
lat = 2 * rho * (1 - math.cos(th)) + ell * math.sin(th)
s = 1 / 3

def arc_curve(n=4000):
    """centreline in (X axial, Y = lateral toward -(e_i+e_j)/sqrt2), from (0,0) to (0,d); arc length param"""
    L1 = rho * th; Ltot = 2 * L1 + ell
    t = np.linspace(0, Ltot, n)
    X = np.zeros(n); Y = np.zeros(n); phi = np.zeros(n)
    a = t <= L1
    ph = t[a] / rho; X[a] = rho * np.sin(ph); Y[a] = rho * (1 - np.cos(ph)); phi[a] = ph
    b = (t > L1) & (t <= L1 + ell)
    X1, Y1 = rho * math.sin(th), rho * (1 - math.cos(th))
    q = t[b] - L1; X[b] = X1 + q * math.cos(th); Y[b] = Y1 + q * math.sin(th); phi[b] = th
    c = t > L1 + ell
    q = Ltot - t[c]; ph = q / rho                  # the mirror (point reflection through the midpoint)
    X[c] = 0 - rho * np.sin(ph); Y[c] = d - rho * (1 - np.cos(ph)); phi[c] = ph
    return X, Y, phi

X, Y, PH = arc_curve()
sig = X + Y / SQ2                       # the drawing-invariant coordinate (from the span start)
fv = Y / (SQ2 * s)
assert np.all(np.diff(sig) > 0), "sightline order broken"
T = sig / sig[-1]
def smooth_arc(t, kind="arc"):
    t = np.clip(t, 0, 1)
    if kind == "arc":
        return np.interp(t, T, fv)
    return ORIG(t, kind)
ORIG = G.smooth
G.smooth = smooth_arc

def stats_profile(kind):
    t = np.linspace(0, 1, 20001)
    f = smooth_arc(t, kind)
    fp = np.gradient(f, t)
    sg = t / 3; Xa = sg - s * f; Ya = SQ2 * s * f        # back to the centreline
    dX, dY = np.gradient(Xa, t), np.gradient(Ya, t)
    ang = np.degrees(np.arctan2(dY, dX))
    ddX, ddY = np.gradient(dX, t), np.gradient(dY, t)
    kap = np.abs(dX * ddY - dY * ddX) / (dX ** 2 + dY ** 2) ** 1.5
    inner = slice(200, -200)
    # angle between path and the line of sight (thinness of the swept beam)
    tang3 = np.stack([dX, dY], 1); tang3 /= np.linalg.norm(tang3, axis=1)[:, None]
    mvec = np.array([1, -SQ2]) / SQ3   # -m in (X, Y): -(1,1,1) = -e_k - sqrt2 * n_hat, Y points along -n_hat
    cosm = np.abs(tang3 @ mvec)
    return dict(max_fprime_t=float(fp.max()), max_bend_deg=float(ang.max()), min_radius=float(1 / kap[inner].max()),
                min_angle_to_sight_deg=float(np.degrees(np.arccos(cosm.max()))), centreline_length=float(np.sum(np.hypot(np.diff(Xa), np.diff(Ya)))))

res["bend_arcs"] = dict(theta_deg=math.degrees(th), theta_rule="cos theta = -1/3 (the tetrahedral angle 109.47)",
                        rho=rho, rho_rule="rho = chord/8 = sqrt2/24", straight=ell, straight_rule="1/3 = the free span = the hole side (1-6H)",
                        straight_direction_3d="-(e_k + 2 e_i + 2 e_j)/3 (a unit lattice vector of the H-grid: displacement (1,2,2)/9)",
                        arc1_end_3d="(e_k - e_i - e_j)/18 = (H/2)(1,-1,-1) in the beam's frame",
                        arc_centres_3d="-(e_i+e_j)/24 and -(7/24)(e_i+e_j) from the span start",
                        check_axial_advance=ax_adv, check_lateral=lat, chord=d,
                        arcs=dict(stats_profile("arc"), min_radius=rho,
                                  min_radius_check_from_arclength=float(1 / np.max(np.abs(np.diff(PH)) / np.hypot(np.diff(X), np.diff(Y)))),
                                  min_radius_note="analytic rho; the interp-based finite difference gives a spurious 0.0115 at the joins"), quintic=stats_profile("smootherstep"),
                        continuity="arcs: G1 (tangent continuous), curvature jumps 0 -> 1/rho at the four joins; quintic: C2",
                        per_level="in a level-m frame every bend is the leaf's scaled by F(m+4)/8: rho_m = (sqrt2/24) F(m+4)/8, a Fibonacci ladder of circles like p20's")

# ---- build V3 with both profiles and look
from caster import cast, turned, drawing_view
import render as RN
from measure import mismatch
from PIL import Image
out_tiles = {}
for kind in ("smootherstep", "arc"):
    prims, recs = G.build("V3", n=64, kind=kind)
    tone = drawing_view(prims)
    res.setdefault("drawing_mismatch", {})[kind] = mismatch(tone["tone"])[0]
    tiles = []
    for deg in (0, 30, 60, 90):
        R, _ = turned(prims, deg, size=380, span=3.6)
        tiles.append(Image.fromarray(RN.picture(R, "identity")))
    out_tiles[kind] = tiles
json.dump(res, open(C.OUT + "u2_arcs.json", "w"), indent=1, default=float)

# ---------------- render
from PIL import Image, ImageDraw
TRI = N.TRI
def frame(pic, m, ctr, inv):
    sg = -1 if inv else 1
    if m <= 2:
        pic.figure(tuple(ctr), F(m + 4) / 8, inv, width=0.3)
        return
    for kk in "CBA":
        frame(pic, m - 1, ctr + sg * F(m + 2) / 3 * TRI[kk], inv)
    frame(pic, m - 4, ctr, not inv)

# Fibonacci tiling: squares F(10)..F(2) whirling (left, top-right, ...): use golden-rectangle order like p20
Wd, Hd = 1300, 820
sq = [F(k) * w for k in range(10, 1, -1)]   # 55..1
Wr, Hr = sq[0] + sq[1], sq[0]
kpx = (Wd - 40) / Wr
pic = C.Pic(Wd, Hd, kpx, 20, 20 + Hr * kpx)
x0, y0, x1, y1 = 0.0, 0.0, Wr, Hr            # remaining rectangle
dirs = ["L", "T", "R", "B"]
placed = []
for i, sd in enumerate(sq):
    dr = dirs[i % 4]
    if dr == "L":
        bx, by = x0, y0; x0 += sd
    elif dr == "T":
        bx, by = x0, y1 - sd; y1 -= sd
    elif dr == "R":
        bx, by = x1 - sd, y0; x1 -= sd
    else:
        bx, by = x0, y0; y0 += sd
    placed.append((bx, by, sd))
for (bx, by, sd), k in zip(placed, range(10, 1, -1)):
    pic.line([(bx, by), (bx + sd, by), (bx + sd, by + sd), (bx, by + sd), (bx, by)], col=(60, 60, 60), width=1)
    cx, cy, R = bx + sd / 2, by + sd / 2, sd / 2
    m = k - 4
    ctr = np.array([cx, cy - 0.0])
    if m >= 2:
        frame(pic, m, ctr, False)
    elif m >= -1:
        pic.figure((cx, cy), F(m + 4) / 8)
    pic.circle(cx, cy, R, col=(30, 70, 160), width=1.6)
    if sd * kpx > 60:
        pic.text(bx + sd * 0.03, by + sd * 0.97, f"F={F(k)}  level {m}", sz=13, col=(30, 70, 160))
A = pic.done()

# bend plot
Wb, Hb = 640, 820
kb = 1050
bp = C.Pic(Wb, Hb, kb, 330, 140)
Xq = []
t = np.linspace(0, 1, 400)
for kind, col in (("smootherstep", (150, 150, 150)), ("arc", (200, 30, 40))):
    f = smooth_arc(t, kind)
    sg = t / 3
    Xa = sg - s * f; Ya = SQ2 * s * f
    pts = list(zip(Xa, -Ya))
    bp.line(pts, col=col, width=3 if kind == "arc" else 2)
bp.circle(0, -rho, rho, col=(30, 70, 160), width=1.2)
bp.circle(0, -(d - rho), rho, col=(30, 70, 160), width=1.2)
bp.dot(0, -rho, 3, (30, 70, 160)); bp.dot(0, -(d - rho), 3, (30, 70, 160))
bp.line([(-0.25, 0), (0.25, 0)], col=(180, 180, 180)); bp.line([(-0.25, -d), (0.25, -d)], col=(180, 180, 180))
# sight line direction through the midpoint
mx, my = 0, -d / 2
v = np.array([1, SQ2]) / SQ3      # plot coords (X, -Y): the sight line m = e_k + sqrt2 n_hat
bp.line([(mx - 0.2 * v[0], my - 0.2 * v[1]), (mx + 0.2 * v[0], my + 0.2 * v[1])], col=(30, 140, 90), width=1)
bp.text(10, 10, "one beam's bend in its own plane (axis -> right, the slide back -> down)", sz=13, px=True)
bp.text(10, 30, "grey: the quintic (smootherstep) of wf6/reconstruct (free curve)", sz=13, col=(110, 110, 110), px=True)
bp.text(10, 50, f"red: arc r=sqrt2/24 turning {math.degrees(th):.2f} (cos=-1/3), straight 1/3, arc", sz=13, col=(200, 30, 40), px=True)
bp.text(10, 70, "blue: the two stated circles; green: the line of sight", sz=13, col=(30, 70, 160), px=True)
ba = res["bend_arcs"]
bp.text(10, 690, f"arcs:    max bend {ba['arcs']['max_bend_deg']:.2f}  min radius {ba['arcs']['min_radius']:.4f}  max f' {ba['arcs']['max_fprime_t']:.3f}", sz=13, col=(200, 30, 40), px=True)
bp.text(10, 710, f"quintic: max bend {ba['quintic']['max_bend_deg']:.2f}  min radius {ba['quintic']['min_radius']:.4f}  max f' {ba['quintic']['max_fprime_t']:.3f}", sz=13, col=(110, 110, 110), px=True)
bp.text(10, 730, f"closest to the sight line: arcs {ba['arcs']['min_angle_to_sight_deg']:.2f} deg, quintic {ba['quintic']['min_angle_to_sight_deg']:.2f} deg", sz=13, px=True)
bp.text(10, 750, f"drawing view, wrong px vs the original: arcs {res['drawing_mismatch']['arc']['wrong']}, quintic {res['drawing_mismatch']['smootherstep']['wrong']}", sz=13, px=True)
B = bp.done()

right = Image.new("RGB", (Wd + Wb + 20, max(Hd, Hb) + 400), (250, 248, 243))
right.paste(A, (0, 0)); right.paste(B, (Wd + 20, 0))
dr = ImageDraw.Draw(right)
for r_, kind in enumerate(("smootherstep", "arc")):
    for i, tl in enumerate(out_tiles[kind]):
        tl = tl.resize((205, 205), Image.LANCZOS)
        right.paste(tl, (20 + i * 212 + r_ * 980, Hd + 40))
    dr.text((20 + r_ * 980, Hd + 15), ("V3 quintic" if kind != "arc" else "V3 arcs") + ": turned 0 / 30 / 60 / 90 about the up axis",
            fill=(20, 20, 20), font=C.font(15))
left = C.page_crop(20, (165, 1155, 3168, 3696), right.height)
foot = [
    "p20: circles inscribed in the golden rectangle's squares fall by phi (page: 1.630 1.607 1.641 1.602).",
    "Unit: the Fibonacci tiling (squares 1,1,2,3,5,8,13,21,34,55 x 2u/sqrt3) holds the ladder EXACTLY: each square's circle is a level's holding circle and the frame is inscribed in it",
    "  (square F(k) -> level k-4). Against true golden squares the tiling is off by the ladder's own error: " +
    ", ".join(f"{r['square_F']}: {r['pct_off_golden']:+.2f}%" for r in rows[-6:]) + " (from the top square down).",
    f"Curves: each of the 9 beams' bends as arc - straight - arc: arcs of radius sqrt2/24 = chord/8 turning arccos(-1/3) = 109.47 deg, the straight 1/3 along -(1,2,2)/3.",
    f"  Exact: axial advance {ax_adv:.1e}, lateral {lat:.6f} = sqrt2/3. Drawing unchanged (same wrong px as the quintic). Min radius {ba['arcs']['min_radius']:.4f} vs {ba['quintic']['min_radius']:.4f} (x{ba['arcs']['min_radius']/ba['quintic']['min_radius']:.2f}), max bend +1.2 deg;",
    "  cost: G1 not C2 (curvature jumps at 4 joins), and the straight part runs 15.8 deg off the sight line (quintic 17.0 at its steepest) for the whole third.",
]
out = C.side_by_side(left, right, "u2  Scales and dynamic relationships (p20)  ->  the ladder in the Fibonacci squares, and the bends as arcs of stated circles", foot)
out.save(C.OUT + "img/u2_squares_arcs.png")
print(json.dumps({k: res[k] for k in ("bend_arcs", "drawing_mismatch")}, indent=1, default=float))
