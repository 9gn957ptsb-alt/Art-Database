import json, numpy as np
import drawing2d as D
C = D.target('cls')
R = D.raster(D.H9, D.FIT9)
# holes as 2 (cls's label for enclosed paper)
Rh = R.copy()
for tone, P in D.polygons(D.H9):
    if tone < 0:
        s, cx, cy, k = D.FIT9
        ys, xs = np.mgrid[0:630, 0:1200].astype(float)
        a = (xs - cx) / s; b = -(ys - cy) / (s * k)
        Rh[D.inside(P, a, b)] = 2
valid = C != -2
w = ((Rh != C) & valid).sum(); n = ((Rh >= 0) | (C >= 0)).sum()
print('holes as 2 vs cls: wrong %d of %d = %.3f%%' % (w, n, 100 * w / n))
T = D.target('holes')
w2 = ((R != T) & (T != -2)).sum(); n2 = ((R >= 0) | (T >= 0)).sum()
print('holes as paper vs cls_holes: wrong %d of %d = %.3f%%' % (w2, n2, 100 * w2 / n2))
# where are the extra wrong pixels? around the holes?
m = (R != T) & (T != -2)
print('by class (cls_holes, drawn):', sorted(((int(a), int(b)), int(((T == a) & (R == b) & m).sum())) for a in (-1, 0, 1, 2) for b in (-1, 0, 1, 2) if ((T == a) & (R == b) & m).sum()))
