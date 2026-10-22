"""(1) Tangent circles at one point (p6) beside the ladder's levels closing from one eye.
The circle that holds a level-m frame = the circumcircle of its outline (side F(m+4) u)."""
import sys, json, math, itertools
sys.path.insert(0, sys.argv[1] + "/unit/py")
import common as C
import numpy as np
import nest as N

U, F = C.U, C.F
SQ3 = math.sqrt(3)
TRI = N.TRI
res = {}

# --- the drawing's own outline envelope
allp = np.concatenate([p for t, p in C.POLYS])
btop = allp[:, 1].max(); bbot = allp[:, 1].min()
# left outer edge through (-0.9979,-0.4714) slope sqrt3 -> value at a=0
lv = [p for t, p in C.POLYS if t == 0][0]
pa, pb = lv[0], lv[-1]                       # (-0.9979,-0.4714) .. (-0.0907,1.0999)
slope = (pb[1] - pa[1]) / (pb[0] - pa[0])
apex_b = pb[1] + slope * (0 - pb[0])
R2 = 8 * U / SQ3
res["drawing"] = dict(outline_side_u=round((apex_b - bbot) * 2 / SQ3 / U, 6), outer_edge_slope_deg=math.degrees(math.atan(slope)),
                      envelope_apex_b=apex_b, circumradius_8u_over_sqrt3=R2, centroid_b=bbot + (apex_b - bbot) / 3,
                      drawn_tip_b=btop, apex_above_tip_block=apex_b - btop, apex_above_tip_in_u=(apex_b - btop) / U,
                      top_cut_width_u=2 * 0.0907 / U)

# --- 3D: which edges meet at the envelope apex (straight lattice model: left bar x=y=1 along z, right bar x=z=0 along y)
H = 1 / 9
def ab(p):
    x, y, z = p
    return np.array([((y - x) - (x - z)) / math.sqrt(6), ((z - y) + 4 / 3) / math.sqrt(2)])
best = {}
for name, fixed, ax in (("left", {0: 1, 1: 1}, 2), ("right", {0: 0, 2: 0}, 1)):
    for s1, s2 in itertools.product((-H, H), repeat=2):
        idx = list(fixed.keys())
        p0 = np.zeros(3); p0[idx[0]] = fixed[idx[0]] + s1; p0[idx[1]] = fixed[idx[1]] + s2
        e = np.zeros(3); e[ax] = 1
        A0, A1 = ab(p0), ab(p0 + e)
        # distance of the drawn edge line from the outline's apex
        d = A1 - A0; n = np.array([-d[1], d[0]]) / np.linalg.norm(d)
        dist = abs(np.dot(np.array([0, apex_b]) - A0, n))
        if name not in best or dist < best[name][0]:
            t = np.dot(np.array([0, apex_b]) - A0, d) / np.dot(d, d)
            best[name] = (dist, (p0 + t * e).tolist())
pl, pr = np.array(best["left"][1]), np.array(best["right"][1])
sep = pl - pr
res["apex_3d"] = dict(left_outer_edge_point=pl.round(6).tolist(), right_outer_edge_point=pr.round(6).tolist(),
                      drawn_line_misfit=[best["left"][0], best["right"][0]], separation=sep.round(6).tolist(),
                      separation_len=float(np.linalg.norm(sep)), parallel_to_sight=bool(np.allclose(np.cross(sep, [1, 1, 1]), 0, atol=1e-9)))

# --- the ladder: A-chain frames from a root level K down to the leaf (2) and the leaf's tribar (1)
K = 6
chain = []
c = np.zeros(2)
for m in range(K, 0, -1):
    R = F(m + 4) * U / SQ3
    chain.append(dict(level=m, centre_b=float(c[1]), R=R, apex=float(c[1] + R), outline_u=F(m + 4)))
    c = c + F(m + 2) / 3 * TRI["A"]
for i in range(1, len(chain)):
    P, Q = chain[i - 1], chain[i]
    Q["tangency_err"] = abs((Q["centre_b"] - P["centre_b"]) - (P["R"] - Q["R"]))
    Q["R_ratio_parent"] = P["R"] / Q["R"]
res["A_chain"] = chain
res["A_chain_max_apex_spread"] = max(x["apex"] for x in chain) - min(x["apex"] for x in chain)
# every corner child is tangent to its parent at its corner (B, C): check one level
for k in "BC":
    m = 4
    Rp = F(m + 4) * U / SQ3; Rc = F(m + 3) * U / SQ3
    cc = F(m + 2) / 3 * TRI[k]
    res[f"corner_{k}_tangency_err"] = abs(np.linalg.norm(cc) - (Rp - Rc))
res["opening"] = "the level m-4 copy is concentric with its parent (same centre): R ratio F(m)/F(m+4) -> phi^-4; concentric circles never touch"
res["head"] = ("a circle of the same pencil on the other side of the common tangent (centre above the apex) touches every "
               "level's circle at the apex from outside; the pencil fixes the point and the tangent, not the radius")

json.dump(res, open(C.OUT + "u1_crux.json", "w"), indent=1)

# ---------------- render
def frame(pic, m, ctr, inv, order="CBA"):
    sg = -1 if inv else 1
    if m <= 2:
        pic.figure(tuple(ctr), F(m + 4) / 8, inv)
        return
    for k in order:
        frame(pic, m - 1, ctr + sg * F(m + 2) / 3 * TRI[k], inv)
    frame(pic, m - 4, ctr, not inv)

Rk = chain[0]["R"]
W, Hh = 1300, 1080
rh = R2 * 0.9
k = (Hh - 60) / (2 * Rk + 2 * rh)
pic = C.Pic(W, Hh, k, 470, 30 + (chain[0]['apex'] + 2 * rh) * k)
frame(pic, K, np.zeros(2), False)
cols = [(30, 70, 160), (40, 120, 170), (30, 140, 110), (150, 110, 30), (190, 60, 40), (120, 40, 140)]
for x, col in zip(chain, cols):
    pic.circle(0, x["centre_b"], x["R"], col=col, width=2.2)
    pic.dot(0, x["centre_b"], 2.5, col)
apex = chain[0]["apex"]
# the head: same pencil, other side (radius free: drawn at R2/phi as one choice)
rh = R2 * 0.9
pic.circle(0, apex + rh, rh, col=(200, 30, 40), width=2.0)
pic.line([(-1.4 * Rk / 3, apex), (1.4 * Rk / 3, apex)], col=(200, 30, 40), width=1)
pic.dot(0, apex, 4, (200, 30, 40))
pic.line([(0, -Rk * 1.02), (0, apex + 2 * rh)], col=(150, 150, 150), width=1)
for i, (x, col) in enumerate(zip(chain, cols)):
    lab = f"level {x['level']}: outline F({x['level']+4}) = {x['outline_u']} u" + ("  (the leaf = the drawing)" if x['level'] == 2 else "") + ("  (the drawing's top tribar)" if x['level'] == 1 else "")
    pic.text(W - 520, 14 + 20 * i, lab, sz=14, col=col, px=True)
pic.text(W - 520, 14 + 20 * 7, "red: the head's circle, same pencil, other side:\ntouches every level at the crux; its radius is free", sz=14, col=(200, 30, 40), px=True)
right = pic.done()

# zoom of the crux on the leaf
k2 = 300
z = C.Pic(420, 420, k2, 210, 170 + apex * k2)
z.figure((0, chain[-2]["centre_b"]), 1.0)  # the leaf at the apex (level-2 frame centre)
for x, col in zip(chain, cols):
    z.circle(0, x["centre_b"], x["R"], col=col, width=1.6)
z.circle(0, apex + rh, rh, col=(200, 30, 40), width=1.6)
z.dot(0, apex, 4, (200, 30, 40))
z.text(10, 8, f"zoom: the crux is the outline's apex, {res['drawing']['apex_above_tip_in_u']:.4f} u above the drawn tip", sz=12, px=True)
zi = z.done()
right.paste(zi, (W - 430, 330))
from PIL import ImageDraw
ImageDraw.Draw(right).rectangle([W - 430, 330, W - 10, 750], outline=(160, 160, 160))

left = C.page_crop(6, (132, 1254, 3102, 3380), Hh)
d = res["drawing"]
foot = [
    "p6: circles on one axis, sized by years from 2009, all touching at 2009 (true tangency, centres on the axis, no ratio).",
    f"Unit: a level-m frame's holding circle = its outline's circumcircle, R_m = F(m+4) u / sqrt3. Its A-corner child shares the apex: centre offset F(m+2)u/sqrt3, "
    f"so apex = (F(m+2)+F(m+3)) u/sqrt3 = R_m.",
    f"  -> every level of the A-chain touches at ONE point, exactly (max apex spread {res['A_chain_max_apex_spread']:.1e}); radii fall 8/5, 13/8, 21/13, 34/21, 55/34 -> phi.",
    f"The point: the outline's apex, {d['apex_above_tip_in_u']:.4f} u = u/sqrt3 above the drawn tip (not drawn: the bar ends cut it). In 3D it is where the left bar's and the right bar's",
    f"  outer edges meet in the picture only: their points there differ by (1+2H)(1,1,1) = {res['apex_3d']['separation_len']:.4f} along the line of sight: the top corner's closure, seen from one eye only.",
    "Only one frame per level touches there (the A-line = rule D's heaviest part at each level). Every other frame touches its own parent at its own corner; the opening copy is concentric (no touch).",
]
out = C.side_by_side(left, right, "u1  The tangent circles at one point (p6)  ->  the ladder's levels all touching at the crux", foot)
out.save(C.OUT + "img/u1_crux_tangent.png")
print(json.dumps(res, indent=1)[:3500])
