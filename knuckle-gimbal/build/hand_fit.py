# Fits the WebXR generic left hand (hand/left.glb, MIT licence in hand/LICENSE.md) to the grip in the SketchUp pose
# and writes hand_meta.json and hand_b64.txt into the current folder for build_page.py.
# Index and ring fingers go through the rings, the middle finger through the gap over the hinge, the palm faces the phone,
# and the fingers close around the lower half of the grip. Poses: open, fist, and the ring finger's ring slid 8 mm.
# Every skin vertex is checked against a distance field of the grip parts (and boxes for the phone, puck and arm).
# Needs numpy, scipy, shapely, pygltflib.
import base64, json, math, os, sys
import numpy as np
import shapely
from pygltflib import GLTF2
from scipy.ndimage import distance_transform_edt, map_coordinates
from scipy.optimize import least_squares
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gen.py")).read()); exec(open(os.path.join(HERE, "outlines.py")).read())
AX, AZ = 34.25 + 45.0, 16.5                     # hinge axis in the SketchUp pose; viewer coords are mm with z from the phone back
ZR = AZ - SC                                    # height of the ring axes (s = SC)
YR = -Y_HOME                                    # ring centres at y = +-YR
FINGERS = ["index-finger", "middle-finger", "ring-finger", "pinky-finger"]

# ---------- hand model ----------
g = GLTF2().load(os.path.join(HERE, "hand", "left.glb")); blob = g.binary_blob()
def acc(i):
    a = g.accessors[i]; bv = g.bufferViews[a.bufferView]; assert not bv.byteStride
    dt = {5126: np.float32, 5121: np.uint8, 5123: np.uint16}[a.componentType]
    n = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a.type]
    return np.frombuffer(blob, dtype=dt, count=a.count * n, offset=(bv.byteOffset or 0) + (a.byteOffset or 0)).reshape(a.count, n)
for n in g.nodes:                               # the joints and the mesh hang straight off an untransformed armature
    if n.skin is not None or n.name == "Armature":
        assert not n.translation and not n.rotation and not n.scale, n.name
prim = g.meshes[0].primitives[0]
V = acc(prim.attributes.POSITION).astype(float) * 1000.0
NRM = acc(prim.attributes.NORMAL).astype(float)
JS = acc(prim.attributes.JOINTS_0).astype(int); WS = acc(prim.attributes.WEIGHTS_0).astype(float)
TRI = acc(prim.indices).reshape(-1, 3).astype(int)
skin = g.skins[0]; NAMES = [g.nodes[j].name for j in skin.joints]
def qmat(q):
    x, y, z, w = q
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])
def mquat(R):
    t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2; return np.array([(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, 0.25 * s])
    i = int(np.argmax(np.diag(R))); j, k = (i + 1) % 3, (i + 2) % 3
    s = math.sqrt(1.0 + R[i, i] - R[j, j] - R[k, k]) * 2; q = np.zeros(4)
    q[i] = 0.25 * s; q[j] = (R[j, i] + R[i, j]) / s; q[k] = (R[k, i] + R[i, k]) / s; q[3] = (R[k, j] - R[j, k]) / s
    return q
REST = {}
for j in skin.joints:
    n = g.nodes[j]; M = np.eye(4); M[:3, :3] = qmat(n.rotation); M[:3, 3] = np.array(n.translation) * 1000.0
    REST[n.name] = M
CHAINS = [["thumb-metacarpal", "thumb-phalanx-proximal", "thumb-phalanx-distal", "thumb-tip"]] + \
         [[f + "-metacarpal", f + "-phalanx-proximal", f + "-phalanx-intermediate", f + "-phalanx-distal", f + "-tip"] for f in FINGERS]
ORDER = ["wrist"] + [b for c in CHAINS for b in c]
PARENT = {"wrist": None}
for c in CHAINS:
    PARENT[c[0]] = "wrist"
    for a, b in zip(c, c[1:]): PARENT[b] = a
BI = {b: i for i, b in enumerate(ORDER)}
J = np.array([[BI[NAMES[k]] for k in row] for row in JS])     # joints remapped to ORDER
RW = np.array([REST[b] for b in ORDER]); IBM = np.linalg.inv(RW)
LOC = np.array([RW[0] if PARENT[b] is None else np.linalg.inv(REST[PARENT[b]]) @ REST[b] for b in ORDER])
DOM = J[np.arange(len(J)), WS.argmax(1)]                       # dominant bone of each vertex

def rx(a): c, s = math.cos(a), math.sin(a); return np.array([[1, 0, 0], [0, c, -s], [0, s, c]])
def ry(a): c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1, 0], [-s, 0, c]])
def rz(a): c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])
def rvec(v):
    th = np.linalg.norm(v)
    if th < 1e-12: return np.eye(3)
    k = v / th; K = np.array([[0, -k[2], k[1]], [k[2], 0, -k[0]], [-k[1], k[0], 0]])
    return np.eye(3) + math.sin(th) * K + (1 - math.cos(th)) * K @ K
# joint frames: -z runs along the bone, +y out of the back of the hand, +x toward the thumb side (this is a left hand)
def joint(flex=0.0, abd=0.0, roll=0.0):
    # roll about the bone, then swing sideways (positive: toward the little finger), then curl toward the palm.
    # Swinging before curling lets a bent finger still move sideways; real knuckles allow little of that when bent,
    # so the report prints how much each pose asks for.
    return rx(math.radians(-flex)) @ ry(math.radians(abd)) @ rz(math.radians(roll))

def world(G, rots):
    Wp = np.zeros((len(ORDER), 4, 4))
    for i, b in enumerate(ORDER):
        p = PARENT[b]
        M = G @ RW[0] if p is None else Wp[BI[p]] @ LOC[i]
        R = rots.get(b)
        if R is not None: M = M.copy(); M[:3, :3] = M[:3, :3] @ R
        Wp[i] = M
    return Wp
VH = np.c_[V, np.ones(len(V))]
def skinned(Wp, normals=False):
    S = Wp @ IBM
    out = np.zeros((len(V), 3))
    for k in range(4):
        Sk = S[J[:, k]]
        out += WS[:, k, None] * np.einsum("vab,vb->va", Sk[:, :3, :], VH)
    if not normals: return out
    nr = np.zeros((len(V), 3))
    for k in range(4):
        nr += WS[:, k, None] * np.einsum("vab,vb->va", S[J[:, k]][:, :3, :3], NRM)
    return out, nr / np.linalg.norm(nr, axis=1, keepdims=True)
def G_of(x6):
    G = np.eye(4); G[:3, :3] = rvec(np.array(x6[:3])); G[:3, 3] = x6[3:6]; return G

# ---------- grip distance field (grip frame s, y, w; viewer x = AX - w, z = AZ - s) ----------
H = 0.4
S_AX = np.arange(-4.0, 64.0 + 1e-9, H); Y_AX = np.arange(-64.0, 64.0 + 1e-9, H); W_AX = np.arange(-24.0, 20.0 + 1e-9, H)
def grip_sdf(slide):
    occ = np.zeros((len(S_AX), len(Y_AX), len(W_AX)), bool)
    SS, YY = np.meshgrid(S_AX, Y_AX, indexing="ij"); SW, WW = np.meshgrid(S_AX, W_AX, indexing="ij")
    for name, (mat, grp, outline, holes, R, RH, wbot, wt0, wt1, nq, swap) in grip_parts().items():
        dy = -slide if grp == "ringB" else 0.0
        if swap:
            m2 = shapely.contains_xy(Polygon(outline), SW, WW)
            occ |= m2[:, None, :] & ((Y_AX >= wbot + dy) & (Y_AX <= wt0 + dy))[None, :, None]
        else:
            poly = Polygon([(a, b + dy) for a, b in outline], [[(a, b + dy) for a, b in h] for h in holes])
            m2 = shapely.contains_xy(poly, SS, YY)
            occ |= m2[:, :, None] & ((W_AX[None, :] >= wbot) & (W_AX[None, :] <= wt0 + wt1 * S_AX[:, None]))[:, None, :]
    # hinge barrel (r 2.2 about s = w = 0) and core tab (s 1.9..8.8, |w| <= 1.6), both |y| <= 7.5
    S3, Y3, W3 = np.meshgrid(S_AX, Y_AX, W_AX, indexing="ij")
    occ |= (np.hypot(S3, W3) <= 2.2) & (np.abs(Y3) <= 7.5)
    occ |= (S3 >= 1.9) & (S3 <= 8.8) & (np.abs(W3) <= 1.6) & (np.abs(Y3) <= 7.5)
    return (distance_transform_edt(~occ) - distance_transform_edt(occ)) * H
def box_sdf(p, lo, hi):
    c = (np.array(lo) + np.array(hi)) / 2; e = (np.array(hi) - np.array(lo)) / 2
    q = np.abs(p - c) - e
    return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0)
def scene_sdf(p, sdf):
    s, w = AZ - p[:, 2], AX - p[:, 0]
    idx = np.vstack([(s - S_AX[0]) / H, (p[:, 1] - Y_AX[0]) / H, (w - W_AX[0]) / H])
    d = map_coordinates(sdf, idx, order=1, mode="nearest")
    d = np.minimum(d, box_sdf(p, (-39, -81.7, -8.75), (39, 81.7, 0.0)))                  # phone
    rp = np.hypot(p[:, 0], p[:, 1]); zc = np.clip(p[:, 2], 0, 11.5)
    puck = np.where((p[:, 2] >= 0) & (p[:, 2] <= 11.5), rp - 28.0, np.hypot(np.maximum(rp - 28.0, 0), p[:, 2] - zc))
    d = np.minimum(d, puck)
    return np.minimum(d, box_sdf(p, (-24, -12.8, 11.5), (AX + 2.6, 12.8, AZ + 2.4)))     # rail, arm and hinge fork
SDF = {mm: grip_sdf(float(mm)) for mm in range(0, int(TRAVEL) + 1, 2)}     # the ring slide's 2 mm clicks

# ---------- pose parameters ----------
OPEN_PIP, OPEN_DIP = 30.0, 15.0
def rots_from(q):
    # q: dict of named angles in degrees
    r = {}
    for f in FINGERS:
        r[f + "-phalanx-proximal"] = joint(q.get(f + ".mcp", 0), q.get(f + ".abd", 0), q.get(f + ".roll", 0))
        r[f + "-phalanx-intermediate"] = joint(q.get(f + ".pip", 0))
        r[f + "-phalanx-distal"] = joint(q.get(f + ".dip", 0))
    r["thumb-metacarpal"] = joint(q.get("thumb.cmc", 0), q.get("thumb.cmca", 0), q.get("thumb.cmcr", 0))
    r["thumb-phalanx-proximal"] = joint(q.get("thumb.mcp", 0))
    r["thumb-phalanx-distal"] = joint(q.get("thumb.ip", 0))
    return r
def bone(Wp, b): return Wp[BI[b], :3, 3]
def seg_dist(a0, a1, b0, b1):
    # closest distance between segments a0a1 and b0b1 (sampled; plenty for a penalty)
    t = np.linspace(0, 1, 9)
    A = a0 + np.outer(t, a1 - a0); Bp = b0 + np.outer(t, b1 - b0)
    return np.min(np.linalg.norm(A[:, None, :] - Bp[None, :, :], axis=2))
# finger segments as capsules: half the measured skin widths of this hand (proximal, middle, end), mm
SEGS = {f: [(f + "-phalanx-proximal", f + "-phalanx-intermediate"), (f + "-phalanx-intermediate", f + "-phalanx-distal"), (f + "-phalanx-distal", f + "-tip")] for f in FINGERS}
SEGS["thumb"] = [("thumb-metacarpal", "thumb-phalanx-proximal"), ("thumb-phalanx-proximal", "thumb-phalanx-distal"), ("thumb-phalanx-distal", "thumb-tip")]
RAD = {"index-finger": (9.6, 8.3, 7.0), "middle-finger": (9.6, 8.3, 7.0), "ring-finger": (8.8, 7.8, 6.8), "pinky-finger": (7.4, 6.8, 6.0), "thumb": (11.0, 9.5, 8.0)}
PAIRS = [("index-finger", "middle-finger"), ("middle-finger", "ring-finger"), ("ring-finger", "pinky-finger"), ("thumb", "index-finger")]
NEAR = {("thumb", "index-finger"): [(1, 0), (1, 1), (1, 2), (2, 0), (2, 1), (2, 2)]}     # the thumb's base sits beside the index knuckle by nature
def pen(P, sdf, sel, clear):
    d = scene_sdf(P[sel], sdf)
    return np.maximum(0.0, clear - d)

BONES_V = lambda names: np.isin(DOM, [BI[b] for b in names])
FINGER_V = {f: BONES_V([f + s for s in ("-phalanx-proximal", "-phalanx-intermediate", "-phalanx-distal", "-tip")]) for f in FINGERS}
END_V = {f: BONES_V([f + s for s in ("-phalanx-intermediate", "-phalanx-distal", "-tip")]) for f in FINGERS}
THUMB_V = BONES_V(CHAINS[0])
PALM_V = BONES_V(["wrist"] + [f + "-metacarpal" for f in FINGERS])
PALM_FACE = AX - WMIN               # x of the grip's palm face; the little finger and the thumb stay on this side of it
def keep_palm_side(P, sel, clear=0.5):
    # only where the grip is: past its ends or its edges there is nothing to go through
    p = P[sel]; over = (np.abs(p[:, 1]) < Y_END) & (p[:, 2] < AZ - S_IN) & (p[:, 2] > AZ - S_OUT - BULGE)
    return np.where(over, np.maximum(0.0, PALM_FACE + clear - p[:, 0]), 0.0)
def apart_of(Wp, pairs):
    # neighbouring fingers may touch (skin gives about 1 mm) but not pass through each other
    r = []
    for a, b in pairs:
        for i, j in NEAR.get((a, b), [(i, j) for i in range(3) for j in range(3)]):
                (a0, a1), (b0, b1) = SEGS[a][i], SEGS[b][j]
                d = seg_dist(bone(Wp, a0), bone(Wp, a1), bone(Wp, b0), bone(Wp, b1))
                r.append(2.0 * max(0.0, RAD[a][i] + RAD[b][j] - 1.0 - d))
    return r
def solve(fun, x0, lb, ub, scale=3.0):
    return least_squares(fun, np.clip(np.asarray(x0, float), lb, ub), bounds=(lb, ub), x_scale=scale, max_nfev=400).x

# 1. wrist placement and the knuckles that thread the index and ring fingers through the rings and the middle one through the gap
THREE = FINGERS[:3]
KA = [f + "." + a for f in THREE for a in ("mcp", "abd", "roll")]
NAT = {f + ".mcp": 85.0 for f in THREE}
REST_POSE = {"pinky-finger.mcp": 30, "pinky-finger.pip": 40, "pinky-finger.dip": 20}
def qA(x):
    q = dict(REST_POSE); q.update(zip(KA, x[6:]))
    for f in THREE: q[f + ".pip"], q[f + ".dip"] = OPEN_PIP, OPEN_DIP
    return q
def ring_line(Wp, f, yc):
    a, b = bone(Wp, f + "-phalanx-proximal"), bone(Wp, f + "-phalanx-intermediate")
    out = []
    for X in (70.0, 80.0):
        t = (X - a[0]) / (b[0] - a[0]); p = a + t * (b - a); out += [p[1] - yc, p[2] - ZR]
    return out, (a + b) / 2
SEL_A = PALM_V | BONES_V([f + "-phalanx-proximal" for f in THREE])
RING_MID = AX - (WMIN + WT0 + WT1 * SC) / 2                        # x of the rings' mid-plane
def resA(x, wpen=4.0):
    q = qA(x); Wp = world(G_of(x[:6]), rots_from(q)); P = skinned(Wp)
    r = []
    for f, yc, wgt in (("index-finger", YR, 1.0), ("ring-finger", -YR, 1.0), ("middle-finger", 0.0, 0.5)):
        l, mid = ring_line(Wp, f, yc); r += [wgt * v for v in l]
        if f != "middle-finger": r.append(0.5 * (mid[0] - RING_MID))              # each ring sits at the middle of its phalanx
        ax_ = Wp[BI[f + "-phalanx-intermediate"], :3, 0]; r += [2.0 * ax_[0], 2.0 * ax_[2]]   # the finger curls in its own plane
    r += [0.03 * (x[6 + i] - NAT.get(k, 0.0)) for i, k in enumerate(KA)]
    r += [v * wpen / 4.0 for v in apart_of(Wp, PAIRS[:2])]
    return np.r_[r, wpen * pen(P, SDF[0], SEL_A, 0.3)]
def kabsch(A_, B_):
    ca, cb = A_.mean(0), B_.mean(0); U, _, Vt = np.linalg.svd((A_ - ca).T @ (B_ - cb))
    D = np.diag([1, 1, np.sign(np.linalg.det(Vt.T @ U.T))]); R = Vt.T @ D @ U.T
    return R, cb - R @ ca
def rotvec_of(R):
    q = mquat(R); th = 2 * math.acos(max(-1, min(1, q[3])))
    return np.zeros(3) if th < 1e-9 else q[:3] / math.sin(th / 2) * th
x0 = np.zeros(6 + len(KA)); x0[6:] = [NAT.get(k, 0.0) for k in KA]
x0[6 + KA.index("index-finger.abd")], x0[6 + KA.index("ring-finger.abd")] = -10.0, 10.0     # start spread, inside the bores
Wr = world(np.eye(4), rots_from(qA(x0))); src, dst = [], []
for f, yc in (("index-finger", YR), ("middle-finger", 0.0), ("ring-finger", -YR)):
    a, b = bone(Wr, f + "-phalanx-proximal"), bone(Wr, f + "-phalanx-intermediate"); L = np.linalg.norm(b - a)
    src += [a, b]; dst += [(RING_MID + L / 2, yc, ZR), (RING_MID - L / 2, yc, ZR)]
R0, t0 = kabsch(np.array(src), np.array(dst)); x0[:3] = rotvec_of(R0); x0[3:6] = t0
LB = np.r_[[-10] * 3, [-400] * 3, [60, -25, -25] * 3]; UB = np.r_[[10] * 3, [400] * 3, [100, 25, 25] * 3]
XS = np.r_[[0.05] * 3, [2.0] * 3, [3.0] * len(KA)]
# thread the fingers first, then let the grip push the skin out: thin walls would otherwise trap a finger half in a bore
xa = solve(lambda x: resA(x, 0.0), x0, LB, UB, XS)
xa = solve(resA, xa, LB, UB, XS)
GA = G_of(xa[:6]); QA = qA(xa)

# 2. each pose, part by part: the three threaded fingers, then the little finger, then the thumb
def fingers_pose(base, pip_target, dip_ratio):
    K = [f + "." + j for f in THREE for j in ("pip", "dip")]
    sel = END_V["index-finger"] | END_V["middle-finger"] | END_V["ring-finger"]
    def res(x):
        q = dict(base); q.update(zip(K, x)); Wp = world(GA, rots_from(q)); P = skinned(Wp)
        r = []
        for f in THREE: r += [0.02 * (q[f + ".pip"] - pip_target), 0.05 * (q[f + ".dip"] - dip_ratio * q[f + ".pip"])]
        return np.r_[r, apart_of(Wp, PAIRS[:2]), 4.0 * pen(P, SDF[0], sel, 0.5)]
    x = solve(res, [pip_target, dip_ratio * pip_target] * 3, [0, 0] * 3, [105, 80] * 3)
    q = dict(base); q.update(zip(K, x)); return q
# The little finger has no hole, and its knuckle sits too close to the grip's palm face to curl past it, so it can only lie
# along that face. Contact is too abrupt for a local solver here, so its pose is picked from a grid: least collision first,
# then the most natural curl.
PK = ["pinky-finger." + j for j in ("mcp", "abd", "pip", "dip")]
PINKY_SEL = FINGER_V["pinky-finger"] | BONES_V(["pinky-finger-metacarpal"])
def pinky_pose(base, pip_want, sdf=SDF[0], near=None):
    best = None
    for mcp in range(0, 31, 5):
        for abd in np.arange(-10, 36, 2.5):
            for pip in range(0, 91, 10):
                for dip in range(0, 61, 15):
                    q = dict(base); q.update(zip(PK, (mcp, abd, pip, dip))); q["pinky-finger.roll"] = 0.0
                    Wp = world(GA, rots_from(q)); P = skinned(Wp)
                    worst = max([0.0, -scene_sdf(P[PINKY_SEL], sdf).min(), keep_palm_side(P, PINKY_SEL, 0.0).max()] + [v / 2 for v in apart_of(Wp, PAIRS[2:3])])
                    cost = max(worst - 0.5, 0) * 10 + 0.01 * abs(pip - pip_want) + 0.005 * abs(dip - 0.6 * pip) + 0.004 * abs(abd - 5) + 0.004 * mcp
                    if near: cost += 0.004 * sum(abs(v - n) for v, n in zip((mcp, abd, pip, dip), near))   # small steps between clicks
                    if best is None or cost < best[0]: best = (cost, q)
    return best[1]
THUMB_K = ["thumb." + j for j in ("cmc", "cmca", "cmcr", "mcp", "ip")]
def thumb_pose(base, rest_on_grip):
    def res(x):
        q = dict(base); q.update(zip(THUMB_K, x)); Wp = world(GA, rots_from(q)); P = skinned(Wp)
        r = [0.02 * v for v in x]
        if rest_on_grip:   # pad on the grip's palm face, between the index ring and the grip's end
            tip = bone(Wp, "thumb-tip")[None, :]; r += [0.5 * (scene_sdf(tip, SDF[0])[0] - 6.5), 0.1 * (tip[0, 1] - (YR + 15.0))]
        return np.r_[r, apart_of(Wp, PAIRS[3:]), 4.0 * pen(P, SDF[0], THUMB_V, 0.5), 4.0 * keep_palm_side(P, THUMB_V)]
    best = None
    for start in ([0, 0, 0, 0, 0], [20, 0, 0, 20, 20], [-20, 0, -20, 10, 10], [10, 15, 0, 30, 30]):
        x = solve(res, start, [-40, -40, -45, -10, -10], [60, 40, 45, 70, 85]); c = float((res(x) ** 2).sum())
        if best is None or c < best[0]: best = (c, x)
    q = dict(base); q.update(zip(THUMB_K, best[1])); return q
QO = thumb_pose(pinky_pose(fingers_pose(QA, OPEN_PIP, 0.5), 20), False)
QB = thumb_pose(pinky_pose(fingers_pose(QA, 95.0, 0.7), 60), True)

# 3. the ring finger's ring slid in its 2 mm clicks: the ring finger swings with it, and the fin pushes the little finger along.
# Fitted from both the open and the closed hand; the viewer blends them like the poses.
KC = ["ring-finger.abd", "ring-finger.mcp"]
KS = KC + PK
STEPS = list(range(2, int(TRAVEL) + 1, 2))
def resC(x, base, mm, wpen=4.0):
    q = dict(base); q.update(zip(KC, x)); Wp = world(GA, rots_from(q)); P = skinned(Wp)
    l, mid = ring_line(Wp, "ring-finger", -YR - mm)
    r = list(l) + [0.01 * (x[0] - base[KC[0]]), 0.03 * (x[1] - base[KC[1]])]
    return np.r_[r, [v * wpen / 4.0 for v in apart_of(Wp, PAIRS[1:2])], wpen * pen(P, SDF[mm], END_V["ring-finger"] | BONES_V(["ring-finger-phalanx-proximal"]), 0.3)]
CLB, CUB = [-25, 55], [50, 100]
def slid(base, pip_want):
    # angle changes at each click, measured from this pose; each click starts from the one before
    out, prev = {}, dict(base)
    for mm in STEPS:
        xc = solve(lambda x: resC(x, base, mm, 0.0), [prev[k] for k in KC], CLB, CUB)    # follow the ring first, then settle
        xc = solve(lambda x: resC(x, base, mm), xc, CLB, CUB)
        q = dict(prev); q.update(zip(KC, xc)); q = pinky_pose(q, pip_want, SDF[mm], near=[prev[k] for k in PK])
        out[mm] = {k: float(q[k] - base[k]) for k in KS}; prev = q
    return out
DO, DB = slid(QO, 20), slid(QB, 60)

# ---------- report: every pose the viewer can show (Fingers 0, 50, 100 %, every click) ----------
KEYS = sorted(set(QO) | set(QB))
def blend(c, mm):
    # as the viewer does it: angles straight between open and closed, plus the click's change
    q = {k: QO.get(k, 0.0) + (QB.get(k, 0.0) - QO.get(k, 0.0)) * c for k in KEYS}
    if mm:
        for k in KS: q[k] += DO[mm][k] + (DB[mm][k] - DO[mm][k]) * c
    return q
def state(c, mm):
    Wp = world(GA, rots_from(blend(c, mm))); P = skinned(Wp); return Wp, P, scene_sdf(P, SDF[mm])
worst = 0.0
for c in (0.0, 0.5, 1.0):
    for mm in [0] + STEPS:
        Wp, P, d = state(c, mm)
        l, _ = ring_line(Wp, "ring-finger", -YR - mm); li, _ = ring_line(Wp, "index-finger", YR)
        deep = {}
        for i in np.where(d < 0)[0]: deep[ORDER[DOM[i]]] = round(max(deep.get(ORDER[DOM[i]], 0), -float(d[i])), 2)
        cross = [round(v / 2.0 + 1.0, 1) for v in apart_of(Wp, PAIRS) if v > 0]
        worst = max(worst, max(0, -d.min()))
        print(f"fingers {c * 100:3.0f}% ring {mm} mm: skin into grip or phone {max(0, -d.min()):.2f} mm {deep} | finger overlap mm {cross} | "
              f"ring finger off its ring {max(abs(v) for v in l):.2f} mm, index {max(abs(v) for v in li):.2f} mm")
for nm, q in (("open", QO), ("closed", QB)):
    print(nm, {k: round(float(v), 1) for k, v in q.items()})
print("full slide adds (open / closed):", {k: (round(DO[STEPS[-1]][k], 1), round(DB[STEPS[-1]][k], 1)) for k in KS})
Wp, P, d = state(1.0, 0)
print("wrist", bone(Wp, "wrist").round(1), "| fingertips", {f: bone(Wp, f + "-tip").round(1).tolist() for f in FINGERS + ["thumb"]})
assert worst < 1.0, worst
# with a hand in it the grip needs the arm out further: the fingers must clear the phone's edge in every pose
PHONE = ((-39, -81.7, -8.75), (39, 81.7, 0.0))
def phone_gap(E):
    return min(box_sdf(state(c, mm)[1] + np.array([E - 45.0, 0, 0]), *PHONE).min() for c in (0.0, 0.5, 1.0) for mm in [0] + STEPS)
MIN_E = next(E for E in range(20, 51) if phone_gap(E) >= 1.0)
print("arm extension needed with the hand: %d mm (fingers %.1f mm off the phone there)" % (MIN_E, phone_gap(MIN_E)))

# ---------- output ----------
def angles(q):
    # [flex, abduction, roll] in degrees per bone; the viewer builds each joint as joint() does here
    a = {}
    for f in FINGERS:
        a[f + "-phalanx-proximal"] = [q.get(f + ".mcp", 0), q.get(f + ".abd", 0), q.get(f + ".roll", 0)]
        a[f + "-phalanx-intermediate"] = [q.get(f + ".pip", 0), 0, 0]
        a[f + "-phalanx-distal"] = [q.get(f + ".dip", 0), 0, 0]
    a["thumb-metacarpal"] = [q.get("thumb.cmc", 0), q.get("thumb.cmca", 0), q.get("thumb.cmcr", 0)]
    a["thumb-phalanx-proximal"] = [q.get("thumb.mcp", 0), 0, 0]
    a["thumb-phalanx-distal"] = [q.get("thumb.ip", 0), 0, 0]
    return {b: [round(float(v), 3) for v in t] for b, t in a.items()}
JOINT_BONE = {"mcp": "-phalanx-proximal", "abd": "-phalanx-proximal", "pip": "-phalanx-intermediate", "dip": "-phalanx-distal"}
def slide_table(D):
    # per bone, [flex, abduction] added at each click: 0, 2, 4, 6, 8 mm
    t = {}
    for k in KS:
        f, j = k.split("."); row = t.setdefault(f + JOINT_BONE[j], [[0.0, 0.0] for _ in range(len(STEPS) + 1)])
        for i, mm in enumerate(STEPS): row[i + 1][1 if j == "abd" else 0] = round(row[i + 1][1 if j == "abd" else 0] + D[mm][k], 3)
    return t
meta = {"source": "WebXR generic-hand left.glb (@webxr-input-profiles/assets 1.0.20), MIT licence, Copyright (c) 2019 Amazon",
        "bones": [{"name": b, "parent": -1 if PARENT[b] is None else BI[PARENT[b]], "rest": [round(float(v), 5) for v in RW[i].reshape(-1)]} for i, b in enumerate(ORDER)],
        "root": [round(float(v), 6) for v in GA.reshape(-1)],
        "open": angles(QO), "fist": angles(QB),
        "slideOpen": slide_table(DO), "slideFist": slide_table(DB),
        "minE": int(MIN_E), "verts": int(len(V)), "tris": int(len(TRI))}
assert np.abs(V).max() * 100 < 32767
pos = np.round(V * 100).astype("<i2"); idx = TRI.astype("<u2")
nrm = np.round(NRM * 127).astype("i1"); jj = J.astype("u1"); ww = np.round(WS * 255).astype(int)
ww[np.arange(len(ww)), ww.argmax(1)] += 255 - ww.sum(1)                # weights sum to exactly 255
raw = pos.tobytes() + idx.tobytes() + nrm.tobytes() + jj.tobytes() + ww.astype("u1").tobytes()
json.dump(meta, open("hand_meta.json", "w"), separators=(",", ":"))
open("hand_b64.txt", "w").write(base64.b64encode(raw).decode())
print("wrote hand_meta.json and hand_b64.txt:", len(raw), "bytes")
