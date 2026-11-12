# Where the grip can turn, with and without the hand in it, for each phone the holder is set up for (phone.py: the
# iPhone 17 Pro Max, the iPhone Duo folded, the iPhone Duo open on the Duo plate). The hand turns with the grip; the puck,
# arm and phone stay put. For every grip angle (1° steps) it finds the shortest arm extension at which every hand pose the
# viewer can show (fingers 0 to 100 % in quarters, every ring click; its skin's vertices and the middles of its triangles
# and edges) stays 1 mm clear of the phone and of the puck and arm (voxel distance fields of the packed mesh), and the
# shortest at which the grip alone (its vertices, triangle and edge middles, the ring at every click) stays 1 mm clear of
# the phone. It writes reach[phone] = {gripMin (the furthest the grip folds back with a hand in it), eHand (the arm
# extension needed with the hand at each angle from gripMin to 90°), eGrip (without the hand, at each angle from -180°
# to 90°)} into each version's entry in hand_meta.json.
# Run after pack.py and hand_fit.py, in the folder holding their output. Needs numpy, scipy, trimesh.
import base64, json, math, os
import numpy as np, trimesh
from scipy.ndimage import distance_transform_edt, map_coordinates

HERE = os.path.dirname(os.path.abspath(__file__))
import importlib.util
spec = importlib.util.spec_from_file_location("phone", os.path.join(HERE, "phone.py")); phone = importlib.util.module_from_spec(spec); spec.loader.exec_module(phone)
POSE_E, POSE_AX, AXIS_Z, CLEAR = 45.0, 79.25, 16.5, 1.0
E_MAX = 60                                   # the arm's longest extension, mm (viewer.html's Slide arm slider)

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
def pose(hv, c, slide):
    # hv: one version's entry in hand_meta.json
    t = slide / 2; n0 = min(3, int(t)); fr = t - n0; W, S = [], []
    at = lambda tab, j: tab[n0][j] + (tab[n0 + 1][j] - tab[n0][j]) * fr
    for i, b in enumerate(BONES):
        M = np.array(hv["root"]).reshape(4, 4) @ REST[i] if b["parent"] < 0 else W[b["parent"]] @ LOC[i]
        o, f, so, sf = hv["open"].get(b["name"]), hv["fist"].get(b["name"]), hv["slideOpen"].get(b["name"]), hv["slideFist"].get(b["name"])
        if o:
            d = [at(so, j) + (at(sf, j) - at(so, j)) * c for j in (0, 1)] if so else [0, 0]
            M = M @ joint(o[0] + (f[0] - o[0]) * c + d[0], o[1] + (f[1] - o[1]) * c + d[1], o[2] + (f[2] - o[2]) * c)
        W.append(M); S.append(M @ np.linalg.inv(REST[i]))
    S = np.array(S)
    return sum(wt[:, k, None] * np.einsum("vab,vb->va", S[jt[:, k]], rest)[:, :3] for k in range(4))

TRI = np.frombuffer(raw, "<u2", nt * 3, n * 6).reshape(-1, 3).astype(int)
def dense(P):
    # the skin's triangles are 5 to 9 mm across: add the middle of each and of its edges, so a face can't pass the phone unseen
    T = P[TRI]; return np.vstack([P, T.mean(1), (T[:, 0] + T[:, 1]) / 2, (T[:, 1] + T[:, 2]) / 2, (T[:, 2] + T[:, 0]) / 2])

# ---------- sweep: the viewer's knuckleMatrix, every angle the Grip slider has ----------
def turned(P, grip, E):
    d = math.radians(grip - 90); c, s = math.cos(d), math.sin(d)
    x, z = P[:, 0] - POSE_AX, P[:, 2] - AXIS_Z
    return np.c_[c * x + s * z + 34.25 + E, P[:, 1], -s * x + c * z + AXIS_Z]
def gap(HAND, grip, E, model):
    P = turned(HAND, grip, E)
    return min(STATIC(P).min(), STAGE1(P - [(E - POSE_E) / 2, 0, 0]).min(), STAGE2(P - [E - POSE_E, 0, 0]).min(), phone.sdf(P, model).min())
def grip_points(key):
    # one version's grip: its parts' vertices and the middles of their triangles and edges, the slid ring at every click
    out = []
    for p in mm["parts"]:
        if p["group"] not in ("knuckle", "ringB", "ringT") or p.get("variant", key) != key: continue
        T = q[p["start"]:p["start"] + p["count"]].reshape(-1, 3, 3)
        P = np.vstack([T.reshape(-1, 3), T.mean(1), (T[:, 0] + T[:, 1]) / 2, (T[:, 1] + T[:, 2]) / 2, (T[:, 2] + T[:, 0]) / 2])
        out += [P - [0, s, 0] for s in (0, 2, 4, 6, 8)] if p["group"] == "ringB" else [P]
    return np.unique(np.round(np.vstack(out), 2), axis=0)
for key, hv in hm["variants"].items():
    poses = [pose(hv, c, s) for c in (0.0, 0.25, 0.5, 0.75, 1.0) for s in (0, 2, 4, 6, 8)]
    HAND, DENSE, GRIP = np.vstack(poses), np.vstack([dense(P) for P in poses]), grip_points(key)
    hv.pop("gripMin", None); hv.pop("eHand", None); reach = {}
    for model in phone.MODELS:
        eg = [next((E for E in range(0, E_MAX + 1) if phone.sdf(turned(GRIP, a, E), model).min() >= CLEAR), None) for a in range(-180, 91)]
        assert None not in eg, (key, model, "the grip alone can't clear the phone at", [a for a, e in zip(range(-180, 91), eg) if e is None][:5])
        need = {}
        for grip in range(90, -181, -1):
            # scan on the vertices first (quick), then go on out until the triangles' points clear too (they can only be closer)
            E = next((E for E in range(eg[grip + 180], E_MAX + 1) if gap(HAND, grip, E, model) >= CLEAR), None)
            while E is not None and gap(DENSE, grip, E, model) < CLEAR: E = E + 1 if E < E_MAX else None
            if E is None: break
            need[grip] = E
        assert 90 in need, (key, model, "the hand can't clear the phone at the hold within", E_MAX, "mm")
        g0 = min(need); reach[model] = {"gripMin": g0, "eHand": [need[a] for a in range(g0, 91)], "eGrip": eg}
        print(key, model, "with the hand the grip turns from %d° to 90°; arm extension needed (mm):" % g0, {a: need[a] for a in need if a % 30 == 0 or a == g0},
              "| the grip alone:", {a: eg[a + 180] for a in range(-180, 91, 30)}, flush=True)
    hv["reach"] = reach
json.dump(hm, open("hand_meta.json", "w"), separators=(",", ":"))
