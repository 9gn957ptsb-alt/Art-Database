"""(b) in the drawing, from pixels: the silhouettes of copies placed by the two relations, at 2400 px across."""
import json, math, numpy as np
import drawing2d as D2, nest as N
H = N.HG; PHI = N.PHI; L = N.LL
POL = D2.polygons(H)
SIL = [P for t, P in POL if t >= 0]
HOLES = [P for t, P in POL if t < 0]
W = 2400
a0, a1, b0, b1 = -1.5, 1.5, -1.2, 1.6
px = (a1 - a0) / W
ys, xs = np.mgrid[0:int((b1 - b0) / px), 0:W]
A = a0 + (xs + 0.5) * px; B = b1 - (ys + 0.5) * px
def sil(scale=1.0, centre=(0, 0), turn=False, polys=SIL):
    m = np.zeros(A.shape, bool)
    for P in polys:
        Q = P * scale * (-1 if turn else 1) + np.asarray(centre)
        lo, hi = Q.min(0), Q.max(0)
        box = (A >= lo[0]) & (A <= hi[0]) & (B >= lo[1]) & (B <= hi[1])
        if box.any():
            sub = D2.inside(Q, A[box], B[box]); idx = np.nonzero(box); m[idx[0][sub], idx[1][sub]] = True
    return m
def area_px(m): return int(m.sum())
out = {'px_per_cell': 1 / px}
parent = sil()
holes = [sil(polys=[P]) for P in HOLES]
g, r = N.g_of(H), N.r_of(H)
# ---- IN ----
kids = [sil(g, N.TRI[k]) for k in 'ABC'] + [sil(g, N.GAP, turn=True)]
over = [area_px(parent & k) for k in kids]
hole_area = [area_px(h) for h in holes]
fill = []
for h in holes:
    best = max(kids, key=lambda k: area_px(k & h))
    fill.append(dict(hole=area_px(h), covered_by_copy=area_px(best & h), copy_outside_hole=area_px(best & ~h)))
# the copy's own outline (its silhouette with its holes filled) vs the hole
kid_outline = [sil(g, N.TRI[k], polys=SIL + HOLES) for k in 'ABC'] + [sil(g, N.GAP, turn=True, polys=SIL + HOLES)]
corner_open = [area_px(h & ~ko) for h, ko in zip(holes, kid_outline)]
side_hole = (1 - 6 * H) * L
cut = 2 * H * g * L
out['IN'] = dict(scale=g, scale_is='phi^-4', overlap_with_parent_faces_px=over, holes=fill, hole_area_px=hole_area,
                 hole_left_open_at_its_corners_px=corner_open,
                 analytic=dict(hole_side=side_hole, copy_corner_cut=cut, corner_cut_over_hole_side=cut / side_hole,
                               open_fraction=3 * cut ** 2 / side_hole ** 2))
print('IN: copies at g = %.5f (phi^-4 = %.5f)' % (g, PHI ** -4))
print('   overlap of each copy with the parent faces, px:', over, ' (a pixel is %.4f cell)' % px)
print('   hole area px', hole_area, '; left open at the hole corners (the copy\'s cut corners), px', corner_open)
print('   analytic: corner cut 2Hg = %.4f L = %.1f%% of the hole side; open fraction %.2f%%' % (cut / L, 100 * cut / side_hole, 100 * 3 * cut ** 2 / side_hole ** 2))
# ---- OF ----
sibs = [sil(r, N.TRI[k]) for k in 'ABC']
sib_outline = [sil(r, N.TRI[k], polys=SIL + HOLES) for k in 'ABC']
pair = {'AB': area_px(sibs[0] & sibs[1]), 'BC': area_px(sibs[1] & sibs[2]), 'CA': area_px(sibs[2] & sibs[0])}
pair_outline = {'AB': area_px(sib_outline[0] & sib_outline[1]), 'BC': area_px(sib_outline[1] & sib_outline[2]), 'CA': area_px(sib_outline[2] & sib_outline[0])}
S = (2 + 6 * H)                                   # the parent's outline side, in L
tri_area = lambda side: math.sqrt(3) / 4 * (side * L) ** 2 / px ** 2
comp = sibs[0] | sibs[1] | sibs[2]
parent_outline = sil(polys=SIL + HOLES)
# the composite's central gap: the uncovered region of the parent's outline round the centre
gapm = parent_outline & ~(sib_outline[0] | sib_outline[1] | sib_outline[2])
gap_side_meas = math.sqrt(area_px(gapm) * 4 / math.sqrt(3)) * px / L
out['OF'] = dict(scale=r, scale_is='phi^-1', sibling_overlap_px=pair, sibling_outline_overlap_px=pair_outline,
                 analytic_outline_overlap_px=tri_area(S * PHI ** -3), composite_gap_side_L=gap_side_meas,
                 analytic_gap_side_L=S * PHI ** -4, figure_gap_side_L=1 - 6 * H)
print('OF: copies at r = %.5f (1/phi = %.5f)' % (r, 1 / PHI))
print('   sibling outlines overlap, px:', pair_outline, ' analytic triangle of side phi^-3 S: %.0f px' % tri_area(S * PHI ** -3))
print('   sibling faces overlap (what the joints order), px:', pair)
print('   the composite\'s central gap: side %.4f L (analytic S phi^-4 = %.4f L; the figure\'s own gap 1-6H = %.4f L)' % (gap_side_meas, S * PHI ** -4, 1 - 6 * H))
# ---- ON: the copy at r laid on tribar A, across the parent's left bar ----
# sample along the perpendicular to the left outer bar at its upper half
ON = sil(r, N.TRI['A'])
# left bar runs along direction (cos60, sin60) in (a, b); its outward normal is (-sin60, cos60)
nrm = np.array([-math.sin(math.radians(60)), math.cos(math.radians(60))])
base = np.array([-0.30, 0.42])               # a point inside the left bar's upper half
ts = np.linspace(-0.25, 0.25, 4001)
pts = base + ts[:, None] * nrm
ia = ((pts[:, 0] - a0) / px).astype(int); ib = ((b1 - pts[:, 1]) / px).astype(int)
on_par = parent[ib, ia]; on_kid = ON[ib, ia]
def run(mask):
    i = np.nonzero(mask)[0]; return (ts[i.max()] - ts[i.min()]) if len(i) else 0.0
wp, wk = run(on_par), run(on_kid & (ts > -1))
# the copy's outer bar: the first run of its pixels from the outer edge
i = np.nonzero(on_kid)[0]
runs = np.split(i, np.nonzero(np.diff(i) > 1)[0] + 1)
outer = max(runs, key=lambda q: ts[q].max())
wk_outer = ts[outer].max() - ts[outer].min()
par_i = np.nonzero(on_par)[0]; prun = np.split(par_i, np.nonzero(np.diff(par_i) > 1)[0] + 1); pout = max(prun, key=lambda q: ts[q].max())
wp_outer = ts[pout].max() - ts[pout].min()
out['ON'] = dict(parent_bar_across=wp_outer, copy_outer_bar_across=wk_outer, ratio=wk_outer / wp_outer, analytic=1 / PHI,
                 outer_edges_offset=float(ts[outer].max() - ts[pout].max()))
print('ON: across the left bar: parent bar %.4f, the copy\'s outer bar %.4f, ratio %.4f (1/phi %.4f); outer edges %.4f apart' % (wp_outer, wk_outer, wk_outer / wp_outer, 1 / PHI, ts[outer].max() - ts[pout].max()))
# ---- along a bar: does any phi-power copy fit the bar's width? ----
bar = 2 * math.sqrt(3) * H                          # drawn width across a bar, in L
fits = {k: (2 + 6 * H) * PHI ** -k * math.sqrt(3) / 2 / bar for k in range(2, 7)}
out['ALONG'] = dict(bar_across_L=bar, copy_height_over_bar={('phi^-%d' % k): round(v, 4) for k, v in fits.items()})
print('ALONG: a copy\'s height / the bar width at phi^-k:', {k: round(v, 3) for k, v in fits.items()})
json.dump(out, open('q_b.json', 'w'), indent=1)
