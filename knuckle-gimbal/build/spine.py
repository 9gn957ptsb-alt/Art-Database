# The grip's carbon spine: one part from the hinge barrel, through the silicone body, into the track's hinge-side wall, so
# the hinge, the track and the rings make one carbon frame. It replaces the SketchUp model's Grip Core Tab, which stopped
# 5.4 mm short of the track and left the grip hanging on silicone (the check of 12 Nov 2026).
# Grip frame (outlines.py): s from the hinge axis, y along it, w through the thickness (palm face w = -1.75).
# Between the barrel and the body (s 1.9 to 5.5) it stays inside the old tab's outline (w -1.6 to 1.6), so the arm's end
# block and the fitted hand meet nothing new. It enters the body 1.7 mm thick (w -0.1 to 1.6), steeply through the body's
# palm-side round, thickens to 3.5 mm (w -0.75 to 2.75) under at least 0.5 mm of silicone (1 mm from s 7), and runs 1.3 mm into
# the track's wall (s 14.2 to 15.5, where the wall is 3.8 mm thick behind its stop bumps); the two are meant as one part.
# Two 2.4 mm holes through it key the silicone. Its edges are rounded 0.5 mm.
# As a script, run after pack.py in the same folder: swaps the Grip Core Tab in mesh_meta.json and mesh_b64.txt for the
# spine. Needs numpy, trimesh (with manifold3d), triangle.
import base64, json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_ns = {"math": math}
for _f in ("gen.py", "outlines.py"):
    exec(open(os.path.join(HERE, _f)).read(), _ns)
fillet, ccw, plate_mesh = _ns["fillet"], _ns["ccw"], _ns["plate_mesh"]

HALF_Y = 7.5                                  # half its width along the hinge axis: the barrel's length between the lugs
# its side profile (s, w), corner radii
PROFILE = [(1.9, -1.6), (3.5, -1.6), (5.8, -0.1), (8.5, -0.75), (15.5, -0.75), (15.5, 2.75), (7.5, 2.75), (6.0, 1.6), (1.9, 1.6)]
RADII = [0.0, 1.0, 0.4, 1.5, 0.5, 0.5, 1.5, 0.8, 0.0]
HOLES, HOLE_R = [(11.3, -3.5), (11.3, 3.5)], 1.2     # keying holes through the thickness: (s, y), radius
POSE_AX, AXIS_Z = 79.25, 16.5                  # the packed mesh's pose: grip frame (s, y, w) -> viewer (AX - w, y, AXIS_Z - s)

def palm_top(s):
    # the profile's w range at s, corners ignored (for voxel masks)
    lo = np.interp(s, [1.9, 3.5, 5.8, 8.5, 15.5], [-1.6, -1.6, -0.1, -0.75, -0.75])
    hi = np.interp(s, [1.9, 6.0, 7.5, 15.5], [1.6, 1.6, 2.75, 2.75])
    return lo, hi
def inside(S, Y, W):
    # boolean mask of grid points inside the spine (corners and holes ignored)
    lo, hi = palm_top(S)
    m = (S >= PROFILE[0][0]) & (S <= PROFILE[4][0]) & (np.abs(Y) <= HALF_Y) & (W >= lo) & (W <= hi)
    for s0, y0 in HOLES:
        m &= np.hypot(S - s0, Y - y0) > HOLE_R
    return m

def mesh():
    # the spine as a closed trimesh in the grip frame
    import trimesh, triangle as tr
    out = ccw(fillet(PROFILE, RADII, 0.3))
    verts, tris, bottom, topf, groups = plate_mesh(math, out, [], 0.5, 0.5, -HALF_Y, HALF_Y, 0.0, 3)
    V = np.array(verts); F = [list(t) for t in tris]
    for outer, inners in (bottom, topf):
        P2 = np.array([[V[i][0], V[i][1]] for i in outer])
        res = tr.triangulate({"vertices": P2, "segments": np.array([(k, (k + 1) % len(outer)) for k in range(len(outer))])}, "p")
        assert len(res["vertices"]) == len(P2)
        F += [[outer[a], outer[b], outer[c]] for a, b, c in res["triangles"]]
    m = trimesh.Trimesh(V[:, [0, 2, 1]], np.array(F), process=True)       # plate (s, w, along y) -> (s, y, w)
    trimesh.repair.fix_normals(m)
    for s0, y0 in HOLES:
        c = trimesh.creation.cylinder(radius=HOLE_R, height=12.0, sections=32); c.apply_translation([s0, y0, 1.0])
        m = m.difference(c, engine="manifold")
    assert m.is_watertight and m.volume > 0
    return m

def viewer_mesh():
    # the spine in the packed mesh's pose (viewer frame)
    m = mesh().copy(); V = m.vertices
    m.vertices = np.c_[POSE_AX - V[:, 2], V[:, 1], AXIS_Z - V[:, 0]]
    m.invert() if m.volume < 0 else None
    import trimesh; trimesh.repair.fix_normals(m)
    return m

if __name__ == "__main__":
    meta = json.load(open("mesh_meta.json")); q = np.frombuffer(base64.b64decode(open("mesh_b64.txt").read()), "<i2")
    m = viewer_mesh(); T = m.vertices[m.faces]
    new = np.round(T * 100).astype("<i2").reshape(-1)
    parts, chunks, off, swapped = [], [], 0, False
    for p in meta["parts"]:
        if p["name"] in ("Grip Core Tab", "Grip Spine"):
            if swapped: continue
            chunk, p = new, {"name": "Grip Spine", "group": "knuckle", "mat": "cf"}; swapped = True
        else:
            chunk = q[p["start"]:p["start"] + p["count"]]
        parts.append({**p, "start": off, "count": int(chunk.size)}); chunks.append(chunk); off += chunk.size
    assert swapped, "no Grip Core Tab in mesh_meta.json"
    meta["parts"] = parts
    json.dump(meta, open("mesh_meta.json", "w"))
    open("mesh_b64.txt", "w").write(base64.b64encode(np.concatenate(chunks).astype("<i2").tobytes()).decode())
    print("Grip Spine: %d triangles, %.0f mm3, s %.1f..%.1f mm" % (len(m.faces), m.volume, *(AXIS_Z - m.bounds[::-1, 2])))
