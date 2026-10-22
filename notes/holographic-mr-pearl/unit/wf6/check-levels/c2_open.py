"""Independent check of corners + opening: hole = parent triangle minus the corner children's filled outlines."""
import sys, math, json, numpy as np
sys.path.insert(0, sys.argv[1])
import drawing2d as D2, ladder as LD
u = math.sqrt(2/3)/3
POL = D2.polygons(1/9)
SIL = [P for t, P in POL if t >= 0]; HOL = [P for t, P in POL if t < 0]
def placed(fr, polys):
    s = fr.scale() * (-1 if fr.inv else 1)
    return [P * s + fr.ab for P in polys]
def grid(ext, W):
    px = 2*ext/W
    ys, xs = np.mgrid[0:W, 0:W]
    return -ext + (xs+.5)*px, ext - (ys+.5)*px, px
def mask(A, B, polys):
    m = np.zeros(A.shape, bool)
    for Q in polys:
        m ^= D2.inside(Q, A, B) if False else np.zeros(A.shape, bool)
    for Q in polys:
        m |= D2.inside(Q, A, B)
    return m
def faces(A, B, fr):   # silhouette minus own holes
    s = mask(A, B, placed(fr, SIL)); h = mask(A, B, placed(fr, HOL)); return s & ~h
def filled(A, B, fr):
    return mask(A, B, placed(fr, SIL + HOL))
def tri(A, B, side, inv=False):
    h = side*math.sqrt(3)/2; sg = -1 if inv else 1
    V = np.array([[0, 2*h/3*sg], [-side/2, -h/3*sg], [side/2, -h/3*sg]])
    return D2.inside(V, A, B)
out = {}
for m in (3, 4, 5, 6):
    top = LD.Fr((0, 0), m)
    kids = [top.corner(k, 0.0) for k in 'ABC']
    # children as leaves at their own scale (a level-(m-1) frame drawn as the drawing scaled F(m+3)/8)
    ext = LD.F(m+4)*u*0.62
    A, B, px = grid(ext, 900)
    par = tri(A, B, LD.F(m+4)*u)
    fk = [filled(A, B, k) for k in kids]
    fc = [faces(A, B, k) for k in kids]
    cov = fk[0] | fk[1] | fk[2]
    hole = par & ~cov
    # keep only the central component: points within the inverted triangle of side F(m)+margin around centre
    central = hole & tri(A, B, LD.F(m)*u*1.6, inv=True)
    g = top.opening()
    gf = filled(A, B, g); gfaces = faces(A, B, g)
    a1 = math.sqrt(3)/4*(LD.F(m)*u)**2/px**2
    ov = [(fk[i] & fk[j]).sum() for i, j in ((0,1),(1,2),(2,0))]
    a_ov = math.sqrt(3)/4*(LD.F(m+1)*u)**2/px**2
    out[m] = dict(px_per_u=round(u/px, 2), hole_px=int(central.sum()), hole_analytic=round(a1, 1),
                  opening_filled_px=int(gf.sum()), opening_outside_hole=int((gf & ~central).sum()),
                  opening_over_child_faces=int((gfaces & (fc[0]|fc[1]|fc[2])).sum()),
                  opening_over_child_filled=int((gf & cov).sum()),
                  hole_left_open_pct=round(100*(central & ~gf).sum()/central.sum(), 2),
                  outside_parent=int((cov & ~par).sum()),
                  sibling_overlap_px=[int(x) for x in ov], sibling_overlap_full_tri=round(a_ov, 1),
                  overlap_short_pct=round(100*(1-np.mean(ov)/a_ov), 2),
                  other_uncovered_px=int((hole & ~central).sum()))
    print(m, out[m])
json.dump(out, open('c2_open.json', 'w'), indent=1)
