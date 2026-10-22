import sys, json, math, numpy as np
sys.path.insert(0, sys.argv[1])
import drawing2d as D2
cls = D2.target("cls"); print("fig px (cls>=0 or -2?)", int((cls>=0).sum()), int((cls==-2).sum()))
e = D2.wrong_cls(1/9, D2.FIT9); print("thirds at vectorize fit", e, 100*e/D2.FIG_PX)
p, e2 = D2.refit_cls(1/9, D2.FIT9); print("thirds refit", p, e2, 100*e2/D2.FIG_PX)
HG = 1/(6*D2.PHI)
p3, e3 = D2.refit_cls(HG, D2.FIT9); print("golden refit", p3, e3, 100*e3/D2.FIG_PX)
# my own lengths from polygons in u
LL = math.sqrt(2/3); u = LL/3
P = D2.polygons(1/9)
for t, Q in P:
    if t < 0:
        # side length = edge lengths
        d = np.linalg.norm(np.roll(Q, -1, 0) - Q, axis=1)
        print("hole edges u", (d/u).round(4))
allP = np.concatenate([Q for t, Q in P if t>=0])
print("extent a in u", (allP[:,0].max()-allP[:,0].min())/u, "b in u/(sqrt3/2)", (allP[:,1].max()-allP[:,1].min())/u/(math.sqrt(3)/2))
# outline envelope: support lines of the triangle: max along three outward normals
for ang in (90, 210, 330):
    n = np.array([math.cos(math.radians(ang)), math.sin(math.radians(ang))])
    print("support", ang, (allP@n).max()/u)
