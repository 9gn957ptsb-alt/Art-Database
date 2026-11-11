# The grip versions' parts (variants.py) as closed meshes in the grip frame, for check_grip.py and hand_fit.py.
# Needs numpy, shapely, trimesh, triangle.
import math, os
import numpy as np, trimesh, triangle as tr
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
NS = {"math": math}
for f in ("gen.py", "outlines.py", "pinky_data.py", "variants.py"):
    exec(open(os.path.join(HERE, f)).read(), NS)

def mesh(spec):
    # (material, group, verts, tris, faces) -> trimesh; the planar faces are triangulated as SketchUp would fill them
    mat, grp, verts, tris, faces = spec
    V = np.array(verts, float); F = [list(t) for t in tris]
    for outer, inners in faces:
        loops = [outer] + inners
        P2 = np.array([[V[i][0], V[i][1]] for L in loops for i in L]); segs, off = [], 0
        for L in loops:
            segs += [(off + k, off + (k + 1) % len(L)) for k in range(len(L))]; off += len(L)
        args = {"vertices": P2, "segments": np.array(segs)}
        if inners: args["holes"] = np.array([list(Polygon([(V[i][0], V[i][1]) for i in L]).representative_point().coords[0]) for L in inners])
        res = tr.triangulate(args, "p"); assert len(res["vertices"]) == len(P2), "triangulator added points"
        idx = [i for L in loops for i in L]; F += [[idx[t[0]], idx[t[1]], idx[t[2]]] for t in res["triangles"]]
    m = trimesh.Trimesh(V, np.array(F), process=True); trimesh.repair.fix_normals(m)
    return m

def variant_meshes():
    # {"well": {name: (material, group, mesh)}, "tang": {...}}
    return {k: {n: (s[0], s[1], mesh(s)) for n, s in parts.items()} for k, parts in NS["variant_parts"]().items()}

VARIANTS = NS["VARIANTS"]
