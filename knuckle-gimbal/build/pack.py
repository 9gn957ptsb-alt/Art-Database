import json, base64, sys, numpy as np, mapbox_earcut as earcut, trimesh, triangle as tr
F = sys.argv[1]
raw = open(F).read(); print("chars read:", len(raw), "of", len(raw))
r = json.loads(raw)["result"]
MAT = {"Carbon Fiber Twill":"cf","Anodized Aluminum":"al","Copper Windings":"cu","Battery Pouch":"bat","Circuit Board":"pcb","Port Black":"port","Stainless Steel":"st","Status LED":"led","Soft-Touch Silicone":"si"}
GROUP = {"MagSafe Face":"rotor","Motor Rotor Can":"rotor","Motor Stator":"stator","Curved Battery":"battery","Control Board":"board",
         "Puck Shell":"shell","USB-C Port":"shell","Mode Button":"shell","Status LED":"shell","Slide Rail":"shell",
         "Arm Stage 1":"stage1","Arm Stage 2":"stage2","End Block":"stage2","Hinge Lug Top":"stage2","Hinge Lug Bottom":"stage2",
         "Hinge Bolt M2":"stage2","Bolt Head":"stage2","Nyloc Nut":"stage2","Grip Body":"knuckle","Grip Core Tab":"knuckle","Hinge Barrel":"knuckle",
         "Track Frame":"knuckle","Ring Slider Bottom":"ringB","Ring Liner Bottom":"ringB","Ring Slider Top":"ringT","Ring Liner Top":"ringT",
         "Ring Fin Root Bottom":"ringB","Ring Fin Bottom":"ringB","Ring Fin Root Top":"ringT","Ring Fin Top":"ringT"}
def tri_face(outer, inners, n):
    n = np.array(n, float); n /= np.linalg.norm(n)
    a = np.array([1.0, 0, 0]) if abs(n[0]) < 0.9 else np.array([0, 1.0, 0])
    u = np.cross(n, a); u /= np.linalg.norm(u); v = np.cross(n, u)
    rings = [np.array(outer, float).reshape(-1, 3)] + [np.array(i, float).reshape(-1, 3) for i in inners]
    pts3 = np.vstack(rings); pts2 = np.stack([pts3 @ u, pts3 @ v], axis=1)
    if len(rings) > 1:   # faces with holes: constrained triangulation (earcut drops triangles in thin strips)
        segs, off = [], 0
        for r_ in rings:
            n_ = len(r_); segs += [(off + k, off + (k + 1) % n_) for k in range(n_)]; off += n_
        seeds = [pts2[sum(len(x) for x in rings[:i]):sum(len(x) for x in rings[:i + 1])].mean(axis=0) for i in range(1, len(rings))]
        res = tr.triangulate({"vertices": pts2, "segments": np.array(segs), "holes": np.array(seeds)}, "p")
        assert len(res["vertices"]) == len(pts2), "triangulator added points"
        idx = res["triangles"]
    else:
        idx = earcut.triangulate_float64(pts2, np.cumsum([len(x) for x in rings]).astype(np.uint32)).reshape(-1, 3)
    out = []
    for a_, b_, c_ in idx:
        A, B, C = pts3[a_], pts3[b_], pts3[c_]
        if np.dot(np.cross(B - A, C - A), n) < 0: B, C = C, B
        out.append([A, B, C])
    return out
parts, chunks, off, tot = [], [], 0, 0
for p in r["parts"]:
    name = p["path"][-1]
    T = np.array([t for f in p["faces"] for t in tri_face(*f)])
    m = trimesh.Trimesh(vertices=T.reshape(-1, 3), faces=np.arange(len(T) * 3).reshape(-1, 3), process=True)
    assert m.is_watertight, name
    q = np.round(T * 100).astype(np.int16).reshape(-1)
    chunks.append(q); parts.append({"name": name, "group": GROUP[name], "mat": MAT[p["material"]], "start": off, "count": int(q.size)})
    off += q.size; tot += len(T)
allq = np.concatenate(chunks)
lo, hi = allq.reshape(-1, 3).min(0) / 100, allq.reshape(-1, 3).max(0) / 100
json.dump({"parts": parts, "pose": r["pose"], "source": r["source"]}, open("mesh_meta.json", "w"))
open("mesh_b64.txt", "w").write(base64.b64encode(allq.astype("<i2").tobytes()).decode())
print("parts", len(parts), "| triangles", tot, "| all watertight | x range", lo[0], hi[0])
