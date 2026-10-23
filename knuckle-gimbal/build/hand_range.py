# Where the grip can turn with the hand in it. The hand turns with the grip; the puck, arm and phone stay put.
# For every grip angle (1° steps) it finds the shortest arm extension at which every hand pose the viewer can show
# (fingers 0, 50, 100 %, every ring click) stays 1 mm clear of the phone (phone.py) and of the puck and arm (voxel
# distance fields of the packed SketchUp mesh). It adds gripMin (the furthest the grip folds back with a hand in it) and
# eHand (the arm extension needed at each angle from gripMin to 90°) to hand_meta.json.
# Run after pack.py and hand_fit.py, in the folder holding their output. Needs numpy, scipy, trimesh.
import base64, json, math, os
import numpy as np, trimesh
from scipy.ndimage import distance_transform_edt, map_coordinates

HERE = os.path.dirname(os.path.abspath(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("phone", os.path.join(HERE, "phone.py")); phone = importlib.util.module_from_spec(spec); spec.loader.exec_module(phone)
POSE_E, POSE_AX, AXIS_Z, CLEAR = 45.0, 79.25, 16.5, 1.0

# ---------- the packed mesh, by viewer group ----------
mm = json.load(open("mesh_meta.json")); q = np.frombuffer(base64.b64decode(open("mesh_b64.txt").read()), "<i2").astype(float) / 100
def tris(groups):
    return [q[p["start"]:p["start"] + p["count"]].reshape(-1, 3, 3) for p in mm["parts"] if p["group"] in groups]
class VoxSDF:
    # signed distance (mm) to a set of closed triangle meshes, on a 0.4 mm grid padded 6 mm; far away reads 1000
    def __init__(self, parts, h=0.4, pad=6.0):
        V = np.vstack([T.reshape(-1, 3) for T in parts]); self.lo, self.h = V.min(0) - pad, h
        shape = np.ceil((V.max(0) + pad - self.lo) / h).astype(int) + 1; occ = np.zeros(shape, bool)
        for T in parts:
            m = trimesh.Trimesh(T.reshape(-1, 3), np.arange(len(T) * 3).reshape(-1, 3), process=True)
            i = np.round((m.voxelized(h).fill().points - self.lo) / h).astype(int)
            i = i[(i >= 0).all(1) & (i < shape).all(1)]; occ[i[:, 0], i[:, 1], i[:, 2]] = True
        self.d = (distance_transform_edt(~occ) - distance_transform_edt(occ)) * h - h / 2
    def __call__(self, P):
        i = ((P - self.lo) / self.h).T; ok = ((i >= 0) & (i <= np.array(self.d.shape)[:, None] - 1)).all(0)
        out = np.full(len(P), 1000.0); out[ok] = map_coordinates(self.d, i[:, ok], order=1)
        return out
STATIC, STAGE1, STAGE2 = VoxSDF(tris({"rotor", "stator", "battery", "board", "shell"})), VoxSDF(tris({"stage1"})), VoxSDF(tris({"stage2"}))

# ---------- the hand, posed as the viewer's hand.pose() does ----------
hm = json.load(open("hand_meta.json")); raw = base64.b64decode(open("hand_b64.txt").read()); n, nt = hm["verts"], hm["tris"]
rest = np.c_[np.frombuffer(raw, "<i2", n * 3, 0).reshape(-1, 3) / 100.0, np.ones(n)]
jt = np.frombuffer(raw, "u1", n * 4, n * 9 + nt * 6).reshape(-1, 4); wt = np.frombuffer(raw, "u1", n * 4, n * 13 + nt * 6).reshape(-1, 4) / 255.0
BONES = hm["bones"]; REST = [np.array(b["rest"]).reshape(4, 4) for b in BONES]
LOC = [R if b["parent"] < 0 else np.linalg.inv(REST[b["parent"]]) @ R for b, R in zip(BONES, REST)]
def joint(f, a, r):
    f, a, r = map(math.radians, (-f, a, r))
    X = np.array([[1, 0, 0, 0], [0, math.cos(f), -math.sin(f), 0], [0, math.sin(f), math.cos(f), 0], [0, 0, 0, 1]])
    Y = np.array([[math.cos(a), 0, math.sin(a), 0], [0, 1, 0, 0], [-math.sin(a), 0, math.cos(a), 0], [0, 0, 0, 1]])
    Z = np.array([[math.cos(r), -math.sin(r), 0, 0], [math.sin(r), math.cos(r), 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])
    return X @ Y @ Z
def pose(c, slide):
    t = slide / 2; n0 = min(3, int(t)); fr = t - n0; W, S = [], []
    at = lambda tab, j: tab[n0][j] + (tab[n0 + 1][j] - tab[n0][j]) * fr
    for i, b in enumerate(BONES):
        M = np.array(hm["root"]).reshape(4, 4) @ REST[i] if b["parent"] < 0 else W[b["parent"]] @ LOC[i]
        o, f, so, sf = hm["open"].get(b["name"]), hm["fist"].get(b["name"]), hm["slideOpen"].get(b["name"]), hm["slideFist"].get(b["name"])
        if o:
            d = [at(so, j) + (at(sf, j) - at(so, j)) * c for j in (0, 1)] if so else [0, 0]
            M = M @ joint(o[0] + (f[0] - o[0]) * c + d[0], o[1] + (f[1] - o[1]) * c + d[1], o[2] + (f[2] - o[2]) * c)
        W.append(M); S.append(M @ np.linalg.inv(REST[i]))
    S = np.array(S)
    return sum(wt[:, k, None] * np.einsum("vab,vb->va", S[jt[:, k]], rest)[:, :3] for k in range(4))
HAND = np.vstack([pose(c, s) for c in (0.0, 0.5, 1.0) for s in (0, 2, 4, 6, 8)])

# ---------- sweep: the viewer's knuckleMatrix, every angle the Grip slider has ----------
def gap(grip, E):
    d = math.radians(grip - 90); c, s = math.cos(d), math.sin(d)
    x, z = HAND[:, 0] - POSE_AX, HAND[:, 2] - AXIS_Z
    P = np.c_[c * x + s * z + 34.25 + E, HAND[:, 1], -s * x + c * z + AXIS_Z]
    return min(STATIC(P).min(), STAGE1(P - [(E - POSE_E) / 2, 0, 0]).min(), STAGE2(P - [E - POSE_E, 0, 0]).min(), phone.sdf(P).min())
need = {}
for grip in range(90, -181, -1):
    e0 = 0 if grip <= 30 else math.ceil(20 * (grip - 30) / 60)       # the grip's own clearance, as the viewer's eMin()
    E = next((E for E in range(e0, 51) if gap(grip, E) >= CLEAR), None)
    if E is None: break
    need[grip] = E
GRIP_MIN = min(need)
print("with the hand the grip turns from %d° to 90°; arm extension needed (mm):" % GRIP_MIN, {a: need[a] for a in need if a % 15 == 0 or a == GRIP_MIN})
hm["gripMin"] = GRIP_MIN; hm["eHand"] = [need[a] for a in range(GRIP_MIN, 91)]
json.dump(hm, open("hand_meta.json", "w"), separators=(",", ":"))
