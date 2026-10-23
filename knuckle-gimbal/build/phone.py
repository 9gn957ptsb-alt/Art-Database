# An orange iPhone 17 Pro Max for the viewer's "Phone" box, clipped to the puck's MagSafe face.
# Size from Apple's tech specs: 163.4 x 78.0 x 8.75 mm. The camera bar's height above the back (about 2.5 mm, lenses about
# 4.2 mm) comes from measurements of dummy units; how far the bar runs down the back, the lens, flash and button positions,
# the corner radius and the colour are estimates from photos. Apple doesn't publish where the MagSafe ring sits, so the
# phone is centred on the puck.
# As a script it writes phone_meta.json and phone_b64.txt (packed like pack.py's mesh) into the current folder;
# hand_fit.py imports it for sdf(). Needs numpy, trimesh, triangle, networkx.
import base64, json, math, os
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gen.py")).read()); exec(open(os.path.join(HERE, "outlines.py")).read())

W, L, D = 78.0, 163.4, 8.75              # body: x, y, z (z = 0 is the back, the puck's side; the screen faces -z)
CORNER, EDGE, GLASS = 12.5, 1.2, 0.55     # plan corner radius, edge round-over, front glass thickness
BAR_Y0, BAR_INSET, BAR_H, BAR_R = 37.7, 0.8, 2.5, 5.0     # camera bar: lower edge, inset from the sides, height, lower corners
LENSES, LENS_R, LENS_GLASS, LENS_H = [(-24.5, 70.5), (-24.5, 50.5), (-7.5, 60.5)], 7.6, 5.9, 4.2
FLASH, LIDAR = (24.0, 70.5, 3.2), (24.0, 51.0, 3.6)
# buttons: (side, y from, y to); +x is the grip's side (left of the screen), -x the other
BUTTONS = [("Action Button", 1, 41.0, 48.0), ("Volume Up", 1, 25.0, 37.0), ("Volume Down", 1, 10.0, 22.0),
           ("Side Button", -1, 14.0, 36.0), ("Camera Control", -1, -38.0, -25.0)]

def rrect(x0, y0, x1, y1, r):
    return ccw(fillet([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], [r] * 4, 0.4))
def disc(cx, cy, r, n=48):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
def plate(outline, holes, R, z0, z1, nq=3, axes=(0, 1, 2)):
    # a rounded-edge plate (gen.plate_mesh) as a closed triangle list; axes maps (outline a, outline b, thickness) to (x, y, z)
    import triangle as tr
    verts, tris, bottom, topf, groups = plate_mesh(math, outline, holes, R, min(R, 0.4), z0, z1, 0.0, nq)
    V = np.array(verts); F = [list(t) for t in tris]
    for outer, inners in (bottom, topf):
        loops = [outer] + inners
        P2 = np.array([[V[i][0], V[i][1]] for Lp in loops for i in Lp]); segs, off = [], 0
        for Lp in loops:
            segs += [(off + k, off + (k + 1) % len(Lp)) for k in range(len(Lp))]; off += len(Lp)
        args = {"vertices": P2, "segments": np.array(segs)}
        if inners: args["holes"] = np.array([np.mean([[V[i][0], V[i][1]] for i in Lp], axis=0) for Lp in inners])
        res = tr.triangulate(args, "p"); assert len(res["vertices"]) == len(P2)
        idx = [i for Lp in loops for i in Lp]; F += [[idx[t[0]], idx[t[1]], idx[t[2]]] for t in res["triangles"]]
    out = np.zeros_like(V); out[:, axes[0]], out[:, axes[1]], out[:, axes[2]] = V[:, 0], V[:, 1], V[:, 2]
    return out, np.array(F)
def parts():
    # name -> (material, vertices, faces)
    P = {}
    P["Phone Frame"] = ("ph", *plate(rrect(-W / 2, -L / 2, W / 2, L / 2, CORNER), [], EDGE, -D + GLASS, 0.0, 4))
    P["Phone Screen"] = ("sc", *plate(rrect(-W / 2 + EDGE, -L / 2 + EDGE, W / 2 - EDGE, L / 2 - EDGE, CORNER - EDGE), [], 0.4, -D, -D + GLASS, 2))
    bar = ccw(fillet([(-W / 2 + BAR_INSET, BAR_Y0), (W / 2 - BAR_INSET, BAR_Y0), (W / 2 - BAR_INSET, L / 2 - BAR_INSET), (-W / 2 + BAR_INSET, L / 2 - BAR_INSET)],
                     [BAR_R, BAR_R, CORNER - BAR_INSET, CORNER - BAR_INSET], 0.4))
    P["Camera Bar"] = ("ph", *plate(bar, [], 1.0, 0.0, BAR_H, 3))
    for i, (x, y) in enumerate(LENSES):
        P["Lens Ring %d" % (i + 1)] = ("lr", *plate(ccw(disc(x, y, LENS_R)), [cw(disc(x, y, LENS_GLASS))], 0.6, BAR_H, LENS_H, 2))
        P["Lens %d" % (i + 1)] = ("lg", *plate(ccw(disc(x, y, LENS_GLASS)), [], 0.3, BAR_H, LENS_H - 0.3, 2))
    P["Flash"] = ("fl", *plate(ccw(disc(*FLASH)), [], 0.3, BAR_H, BAR_H + 0.3, 2))
    P["LiDAR"] = ("lg", *plate(ccw(disc(*LIDAR)), [], 0.3, BAR_H, BAR_H + 0.4, 2))
    for name, side, y0, y1 in BUTTONS:
        # outline in the side's (y, z) plane, standing 0.6 mm proud of the frame
        x0 = side * (W / 2 - 0.2); x1 = side * (W / 2 + 0.6)
        P[name] = ("ph" if name != "Camera Control" else "lg", *plate(rrect(y0, -D / 2 - 1.6, y1, -D / 2 + 1.6, 1.5), [], 0.3, min(x0, x1), max(x0, x1), 2, axes=(1, 2, 0)))
    return P

def sdf(p):
    # signed distance (mm) from points p (n x 3, viewer coords) to the phone: body, camera bar, lenses and buttons
    def rbox(q, x0, y0, x1, y1, r, z0, z1):
        c = np.array([(x0 + x1) / 2, (y0 + y1) / 2]); h = np.array([(x1 - x0) / 2 - r, (y1 - y0) / 2 - r])
        d = np.abs(q[:, :2] - c) - h
        d2 = np.linalg.norm(np.maximum(d, 0), axis=1) + np.minimum(d.max(1), 0) - r
        dz = np.abs(q[:, 2] - (z0 + z1) / 2) - (z1 - z0) / 2
        e = np.stack([d2, dz], 1)
        return np.linalg.norm(np.maximum(e, 0), axis=1) + np.minimum(e.max(1), 0)
    d = rbox(p, -W / 2, -L / 2, W / 2, L / 2, CORNER, -D, 0.0)
    d = np.minimum(d, rbox(p, -W / 2 + BAR_INSET, BAR_Y0, W / 2 - BAR_INSET, L / 2 - BAR_INSET, BAR_R, 0.0, BAR_H))
    for x, y in LENSES:
        d = np.minimum(d, rbox(p, x - LENS_R, y - LENS_R, x + LENS_R, y + LENS_R, LENS_R, BAR_H, LENS_H))
    for name, side, y0, y1 in BUTTONS:
        x0, x1 = sorted((side * (W / 2 - 0.2), side * (W / 2 + 0.6)))
        d = np.minimum(d, rbox(p[:, [1, 2, 0]], y0, -D / 2 - 1.6, y1, -D / 2 + 1.6, 1.5, x0, x1))
    return d

if __name__ == "__main__":
    import trimesh
    chunks, meta, off = [], [], 0
    for name, (mat, V, F) in parts().items():
        m = trimesh.Trimesh(V, F, process=True); trimesh.repair.fix_normals(m)
        assert m.is_watertight and m.volume > 0, name
        T = m.vertices[m.faces]                      # outward winding, as pack.py writes the SketchUp parts
        q = np.round(T * 100).astype("<i2").reshape(-1)
        chunks.append(q); meta.append({"name": name, "group": "phone", "mat": mat, "start": off, "count": int(q.size)}); off += q.size
    allq = np.concatenate(chunks)
    json.dump({"parts": meta, "source": "iPhone 17 Pro Max reference (phone.py)"}, open("phone_meta.json", "w"), separators=(",", ":"))
    open("phone_b64.txt", "w").write(base64.b64encode(allq.tobytes()).decode())
    print("phone parts", len(meta), "| triangles", off // 9, "| bytes", allq.nbytes)
