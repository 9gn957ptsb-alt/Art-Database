"""Checks of the Fibonacci ladder on the drawing's exact polygons (H = 1/9) and on pixels."""
import math, json, numpy as np
import drawing2d as D2, nest as N, ladder as LD
u = N.LL / 3
POL = D2.polygons(1 / 9)
SIL = [P for t, P in POL if t >= 0]; HOLES = [P for t, P in POL if t < 0]
out = {}
# 1. the drawing's own lengths in u
allP = np.concatenate(SIL)
apex = allP[allP[:, 1].argmax()]; bot = allP[:, 1].min(); left = allP[:, 0].min(); right = allP[:, 0].max()
outline_side = (right - left) / u
height = (apex[1] - bot) / (u * math.sqrt(3) / 2)
holes = []
for P in HOLES:
    c = P.mean(0); side = (P[:, 0].max() - P[:, 0].min()) / u
    holes.append(dict(centre_over_TRI=None, side_u=round(side, 6), centre=[round(c[0], 6), round(c[1], 6)]))
tri = {k: N.TRI[k].round(6).tolist() for k in 'ABC'}
out['drawing_in_u'] = dict(outline_side=round(outline_side, 6), outline_height_as_side=round(height, 6), holes=holes, TRI=tri,
                           tribar_separation_u=round(np.linalg.norm(N.TRI['A'] - N.TRI['B']) / u, 6))
print(out['drawing_in_u'])
# 2. pixels: a level-5 nest with openings, every leaf the drawing's polygons scaled F(m+4)/8 (inverted in openings)
lv = LD.nest_frames(5, 2, openings=True)
def placed(fr, polys):
    s = fr.scale() * (-1 if fr.inv else 1)
    return [P * s + fr.ab for P in polys]
W = 2000
ext = 1.45 * LD.F(9) / 8
a0, a1, b0, b1 = -ext, ext, -ext * 0.8, ext * 1.1
px = (a1 - a0) / W
ys, xs = np.mgrid[0:int((b1 - b0) / px), 0:W]
A = a0 + (xs + 0.5) * px; B = b1 - (ys + 0.5) * px
def mask(polys):
    m = np.zeros(A.shape, bool)
    for Q in polys:
        lo, hi = Q.min(0), Q.max(0)
        bx = (A >= lo[0]) & (A <= hi[0]) & (B >= lo[1]) & (B <= hi[1])
        if bx.any():
            i = np.nonzero(bx); m[i[0][D2.inside(Q, A[bx], B[bx])], i[1][D2.inside(Q, A[bx], B[bx])]] = True
    return m
def tri_mask(c, side, inv):
    # equilateral, apex up (or down if inv), centroid c
    h = side * math.sqrt(3) / 2; sg = -1 if inv else 1
    V = np.array([[0, 2 * h / 3 * sg], [-side / 2, -h / 3 * sg], [side / 2, -h / 3 * sg]]) + c
    return mask([V])
sil = [mask(placed(f, SIL)) for f in lv]
outl = [mask(placed(f, SIL + HOLES)) for f in lv]
ops = [i for i, f in enumerate(lv) if f.kind == 'opening']
cor = [i for i, f in enumerate(lv) if f.kind == 'leaf']
others = np.zeros(A.shape, int)
for i in cor: others += sil[i]
res_op = []
for i in ops:
    f = lv[i]
    # the parent's hole: the triangle of side F(m+4) (this frame's outline) centred here, inverted relative to the parent
    hole = tri_mask(f.ab, LD.F(f.m + 4) * u, f.inv)
    res_op.append(dict(level=f.m, side_u=LD.F(f.m + 4), opening_outline_px=int(outl[i].sum()), hole_px=int(hole.sum()),
                       outline_outside_hole_px=int((outl[i] & ~hole).sum()), hole_not_covered_px=int((hole & ~outl[i]).sum()),
                       overlap_with_corner_leaves_faces_px=int((sil[i] & (others > 0)).sum())))
out['openings'] = res_op
# the composite of corner leaves: its outline vs the level-5 outline triangle, and the uncovered gaps
top = tri_mask(np.zeros(2), LD.F(9) * u, False)
comp = np.zeros(A.shape, bool)
for i in cor: comp |= outl[i]
out['composite'] = dict(level5_outline_px=int(top.sum()), corner_outlines_outside_it_px=int((comp & ~top).sum()),
                        inside_it_not_covered_px=int((top & ~comp).sum()),
                        analytic_uncovered_px=round(sum(math.sqrt(3) / 4 * (LD.F(m) * u) ** 2 * 3 ** (5 - m) for m in (5, 4, 3)) / px ** 2, 1))
# sibling overlaps at the leaf level: triangles of side F(m+1) = F(4) = 3 u (for siblings in a level-3 frame)
sib = [i for i in cor if lv[i].path.startswith('AA')]
ov = (outl[sib[0]] & outl[sib[1]]).sum()
out['sibling_overlap_level3'] = dict(px=int(ov), analytic_px=round(math.sqrt(3) / 4 * (3 * u) ** 2 / px ** 2, 1), side_u=3)
out['px_per_u'] = u / px
print(json.dumps(out, indent=1))
json.dump(out, open('q_ladder.json', 'w'), indent=1)
