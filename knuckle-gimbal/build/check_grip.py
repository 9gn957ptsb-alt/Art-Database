# Checks the grip parts before they go to SketchUp: every offset ring simple, holes inside the outline,
# each part a closed solid, both rings inside the track at every click, the fins clear of the liners and the body. Needs numpy, shapely, trimesh, triangle.
import math, os, numpy as np, trimesh, triangle as tr
from shapely.geometry import Polygon
HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gen.py")).read()); exec(open(os.path.join(HERE, "outlines.py")).read())
P = grip_parts()
def build(name, spec):
    mat, grp, outline, holes, R, RH, wbot, wt0, wt1, nq, swap = spec
    verts, tris, bottom, topf, groups = plate_mesh(math, outline, holes, R, RH, wbot, wt0, wt1, nq)
    for gi, rs in enumerate(groups):
        for k, r in enumerate(rs):
            assert Polygon([(a, b) for a, b, _ in r]).is_valid, (name, gi, k)
    for k in range(len(groups[0])):
        outer = Polygon([(a, b) for a, b, _ in groups[0][k]])
        for gi in range(1, len(groups)):
            assert outer.contains(Polygon([(a, b) for a, b, _ in groups[gi][min(k, len(groups[gi]) - 1)]])), (name, "hole leaves", k)
    V = np.array(verts); F = [list(t) for t in tris]
    for outer, inners in (bottom, topf):
        loops = [outer] + inners
        P2 = np.array([[V[i][0], V[i][1]] for L in loops for i in L]); segs, off = [], 0
        for L in loops:
            segs += [(off + k, off + (k + 1) % len(L)) for k in range(len(L))]; off += len(L)
        args = {"vertices": P2, "segments": np.array(segs)}
        if inners: args["holes"] = np.array([list(Polygon([(V[i][0], V[i][1]) for i in L]).representative_point().coords[0]) for L in inners])
        res = tr.triangulate(args, "p"); assert len(res["vertices"]) == len(P2)
        idx = [i for L in loops for i in L]; F += [[idx[t[0]], idx[t[1]], idx[t[2]]] for t in res["triangles"]]
    if swap: V = V[:, [0, 2, 1]]                      # outline (s, w), plate along y -> (s, y, w)
    m = trimesh.Trimesh(V, np.array(F), process=True); trimesh.repair.fix_normals(m)
    assert m.is_watertight and m.volume > 0, name
    edge = min(math.dist(verts[t[i]], verts[t[(i + 1) % 3]]) for t in tris for i in range(3))
    assert edge > 0.1, (name, "edge too short for SketchUp", edge)
    print(f"{name:20s} tris {len(m.faces):6d} vol {m.volume/1000:6.2f} cm3 euler {m.euler_number} s {V[:,0].min():.2f}..{V[:,0].max():.2f} y {V[:,1].min():.2f}..{V[:,1].max():.2f} w {V[:,2].min():.2f}..{V[:,2].max():.2f}")
    return m
M = {n: build(n, s) for n, s in P.items()}
fin = Polygon(frame_inner())
for slide in (0, 2, 4, 6, 8):
    c = Polygon(carriage(Y_HOME - slide, False)); t = Polygon(carriage(-Y_HOME + slide, True))
    print("slide", slide, "bottom inside", fin.contains(c), round(fin.exterior.distance(c), 3), "| top inside", fin.contains(t), round(fin.exterior.distance(t), 3))
print("slot vs frame gap", round(Polygon(stadium(SC - WALL + 1.4, 132)).exterior.distance(Polygon(stadium(SC - WALL + 1.3, 132))), 3))
print("Y_END", round(Y_END, 2), "| grip", round(S_OUT + BULGE - S_IN, 1), "x", round(2 * Y_END, 1), "| triangles", sum(len(m.faces) for m in M.values()))
print("total grip volume cm3", round(sum(m.volume for m in M.values()) / 1000, 2), "| silicone", round((M["Grip Body"].volume + M["Ring Liner Top"].volume + M["Ring Liner Bottom"].volume + M["Ring Fin Top"].volume + M["Ring Fin Bottom"].volume) / 1000, 2))
for tag in ("Bottom", "Top"):
    root, blade, liner = M["Ring Fin Root " + tag], M["Ring Fin " + tag], M["Ring Liner " + tag]
    gap = Polygon(P["Ring Fin Root " + tag][2]).distance(Polygon(P["Ring Liner " + tag][2]))
    assert gap > 0.05, ("root touches liner", tag, gap)                       # the root sits beside the liner, not on it
    assert abs(root.bounds[1][2] - W_FACE) < 1e-6 and abs(blade.bounds[1][2] - root.bounds[0][2]) < 1e-6, tag   # stacked on the carriage face
    assert root.bounds[1][2] < WMIN - 0.25, tag                               # clears the body's palm face as it slides
    print(f"fin {tag:6s} root-liner gap {gap:.2f} | blade y {blade.bounds[0][1]:.2f}..{blade.bounds[1][1]:.2f} s {blade.bounds[0][0]:.2f}..{blade.bounds[1][0]:.2f} w {blade.bounds[0][2]:.2f}..{blade.bounds[1][2]:.2f}")
