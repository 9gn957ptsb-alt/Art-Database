"""Closed, curved form of the artist's figure (wf6/reconstruct).

Every beam is a straight square bar (half-width H) from a node along one axis, whose points are slid along the
line of sight m = (1,1,1) by s * f(sigma), sigma the drawing-invariant coordinate along the beam:
    sigma(p) = (p-P)_k - ((p-P)_i + (p-P)_j)/2     (k the beam's axis, i, j the other two)
Points on one sightline have one sigma, so every sightline through a beam is moved rigidly: the beam's own drawing
(which face shows where) never changes; only its depth against other beams does.
"""
import math, json, sys
import numpy as np

SCR = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/'
UNIT = SCR + 'unit/'
OUT = SCR + 'wf6/reconstruct/'
H = 1 / 9
M3 = np.ones(3)                                   # the slide direction (towards the eye), unnormalised
NH = M3 / math.sqrt(3)
D = -NH
U = np.array([0, -1.0, 1]) / math.sqrt(2)
RV = np.cross(D, U)                               # (-2,1,1)/sqrt6
C = np.array([1 / 3, 1, -1 / 3])
FIT = dict(s=250.65, cx=599.375, cy=375.14844, k=1.0393)
E = np.eye(3)
AX = 'xyz'
# the nine beams of the straight model: name, axis, start node (straight model), bar it belongs to
BEAMS = [('Ay', 1, (0, 0, 0), 'right'), ('By', 1, (0, 1, 0), 'right'),
         ('Bx', 0, (-1, 1, -1), 'bottom'), ('Cx', 0, (0, 1, -1), 'bottom'),
         ('Cz', 2, (1, 1, -1), 'left'), ('Az', 2, (1, 1, 0), 'left'),
         ('Ax', 0, (0, 1, 0), 'middle'), ('Cy', 1, (1, 1, 0), 'inner_left'), ('Bz', 2, (0, 1, -1), 'inner_right')]
NAMES = [b[0] for b in BEAMS]


def others(k):
    return [(k + 1) % 3, (k + 2) % 3]


def sigma_of(p, P, k):
    q = np.asarray(p, float) - np.asarray(P, float)
    i, j = others(k)
    return q[..., k] - (q[..., i] + q[..., j]) / 2


def smooth(t, kind='smoothstep'):
    t = np.clip(t, 0, 1)
    if kind == 'smoothstep':
        return t * t * (3 - 2 * t)
    if kind == 'smootherstep':
        return t ** 3 * (t * (6 * t - 15) + 10)
    if kind == 'linear':
        return t
    if kind == 'cosine':
        return (1 - np.cos(np.pi * t)) / 2
    if kind == 'arcs':          # normalised: t = X / (1/3), f = Y / (1/3)  (valid for s = L = 1/3, i.e. V3)
        return np.interp(t, _AX * 3, _AY * 3)
    raise ValueError(kind)


def dsmooth(t, kind='smoothstep'):
    t = np.clip(t, 0, 1)
    if kind == 'smoothstep':
        return 6 * t * (1 - t)
    if kind == 'smootherstep':
        return 30 * t * t * (t - 1) ** 2
    if kind == 'linear':
        return np.ones_like(t)
    if kind == 'cosine':
        return np.pi / 2 * np.sin(np.pi * t)


# ---- arc, straight, arc (Arnell's method: every curve an arc of a stated circle) ------------------------------
# In the beam's bend plane (e_k, lateral -(e_i+e_j)/sqrt2) the centreline turns by THETA = arccos(-1/3) on a circle
# of radius RHO = sqrt2/24, runs straight for LSTR = 1/3 (the hole side), and turns back by THETA on the same radius.
# Set by: chord sqrt2/3 perpendicular to the axis (V3), straight part = free span 1/3 -> tan(THETA/2) = sqrt2.
THETA = math.acos(-1 / 3); RHO = math.sqrt(2) / 24; LSTR = 1 / 3


def arc_path(npt=20001):
    """points (along-axis a_k, lateral l) of arc-straight-arc from the span start; returns X (sigma offset), Y (slide)"""
    n1 = npt // 3
    ph = np.linspace(0, THETA, n1)
    a1 = RHO * np.sin(ph); l1 = RHO * (1 - np.cos(ph))
    tt = np.linspace(0, 1, n1)[1:]
    a2 = a1[-1] + LSTR * math.cos(THETA) * tt; l2 = l1[-1] + LSTR * math.sin(THETA) * tt
    # second arc: mirror of the first through the chord's midpoint
    a3 = -a1[::-1][1:] + 0.0; l3 = math.sqrt(2) / 3 - l1[::-1][1:]
    a = np.concatenate([a1, a2, a3]); l = np.concatenate([l1, l2, l3])
    Y = l / math.sqrt(2); X = a + Y
    return X, Y, a, l


_AX, _AY, _, _ = arc_path()


def R3(p):
    """A third of a turn about the line of sight through C: x -> z -> y -> x (grey -> white -> black -> grey)."""
    Mt = np.array([[0, 1, 0], [0, 0, 1], [1, 0, 0]], float)
    q = np.asarray(p, float) - C
    return q @ Mt.T + C


def pix_ab(shape=(630, 1200), f=FIT):
    ys, xs = np.mgrid[0:shape[0], 0:shape[1]].astype(float)
    return (xs - f['cx']) / f['s'], -(ys - f['cy']) / (f['s'] * f['k'])


# ---------------------------------------------------------------------------------------------------------------
# convex primitives: halfspaces n.x <= w, each face with a tone (world axis it faced where straight) and an id

class Convex:
    def __init__(self, N, w, tone, fid, corners, beam, bar):
        self.N = np.asarray(N, float); self.w = np.asarray(w, float)
        self.tone = np.asarray(tone, int); self.fid = np.asarray(fid, int)
        self.corners = np.asarray(corners, float); self.beam = beam; self.bar = bar


def hex_convex(P, beam_i, bar):
    """P: 8 corners, index 4*bx+2*by+bz, bit per WORLD axis. Face pair k -> tone k, id beam*3+k."""
    P = np.asarray(P, float)
    mid = P.mean(0)
    N, w, tone, fid = [], [], [], []
    for k in range(3):
        u, v = (k + 1) % 3, (k + 2) % 3
        for side in (0, 1):
            ring = []
            for bu, bv in ((0, 0), (1, 0), (1, 1), (0, 1)):
                bits = [0, 0, 0]; bits[k], bits[u], bits[v] = side, bu, bv
                ring.append(P[4 * bits[0] + 2 * bits[1] + bits[2]])
            ring = np.array(ring)
            n = np.cross(ring[1] - ring[0], ring[3] - ring[0])
            if np.linalg.norm(n) < 1e-12:
                n = np.cross(ring[2] - ring[1], ring[0] - ring[1])
            n /= np.linalg.norm(n)
            if n @ (ring.mean(0) - mid) < 0: n = -n
            N.append(n); w.append(n @ ring.mean(0)); tone.append(k); fid.append(beam_i * 3 + k)
    return Convex(N, w, tone, fid, P, beam_i, bar)


def corner_index(k, along, a, b):
    i, j = others(k)
    bits = [0, 0, 0]; bits[k] = along; bits[i] = int(a > 0); bits[j] = int(b > 0)
    return 4 * bits[0] + 2 * bits[1] + bits[2]


def ring_at(P, k, sig=None, t=None, shift=0.0):
    """four corners (dict by (a,b)) of the slice sigma=sig, or of the cap t=t, slid by shift*m"""
    i, j = others(k)
    out = {}
    for a in (-H, H):
        for b in (-H, H):
            tt = (sig + (a + b) / 2) if sig is not None else t
            out[(a, b)] = np.asarray(P, float) + tt * E[k] + a * E[i] + b * E[j] - shift * M3
    return out


def hex_between(P, k, r0, r1, beam_i, bar):
    Q = np.zeros((8, 3))
    for (a, b), p in r0.items(): Q[corner_index(k, 0, a, b)] = p
    for (a, b), p in r1.items(): Q[corner_index(k, 1, a, b)] = p
    return hex_convex(Q, beam_i, bar)


def build_beam(beam_i, P, k, bar, s, span=(3 * H, 1 - 3 * H), n=64, kind='smoothstep'):
    """the beam from P along axis k (straight reference), slid by s*f(sigma) along -m; returns convexes and the
    centreline record"""
    P = np.asarray(P, float)
    if abs(s) < 1e-12:
        lo = P - H; hi = P + H; hi[k] += 1
        r0 = ring_at(P, k, t=-H); r1 = ring_at(P, k, t=1 + H)
        return [hex_between(P, k, r0, r1, beam_i, bar)], dict(sig=[-H, 1 + H], f=[0, 0])
    s0, s1 = span
    sig = np.linspace(s0, s1, n + 1)
    fv = smooth((sig - s0) / (s1 - s0), kind)
    out = [hex_between(P, k, ring_at(P, k, t=-H), ring_at(P, k, sig=s0), beam_i, bar)]
    for m_ in range(n):
        out.append(hex_between(P, k, ring_at(P, k, sig=sig[m_], shift=s * fv[m_]), ring_at(P, k, sig=sig[m_ + 1], shift=s * fv[m_ + 1]), beam_i, bar))
    out.append(hex_between(P, k, ring_at(P, k, sig=s1, shift=s), ring_at(P, k, t=1 + H, shift=s), beam_i, bar))
    return out, dict(sig=sig.tolist(), f=fv.tolist())


def nodes_V3():
    """start node of each beam in the closed symmetric form: every beam is e_k - m/3"""
    Q0 = np.zeros(3); J0 = E[1] - M3 / 3; Q1 = 2 * E[1] - 2 * M3 / 3; J1 = Q1 + E[0] - M3 / 3
    Q2 = J1 + E[0] - M3 / 3; J2 = Q2 + E[2] - M3 / 3
    return {'Ay': Q0, 'By': J0, 'Bx': Q1, 'Cx': J1, 'Cz': Q2, 'Az': J2, 'Ax': J0, 'Cy': J2, 'Bz': J1}, \
        dict(Q0=Q0, J0=J0, Q1=Q1, J1=J1, Q2=Q2, J2=J2)


def build(variant, n=64, kind='smoothstep', span=(3 * H, 1 - 3 * H)):
    prims, recs = [], {}
    if variant == 'V3':
        st, _ = nodes_V3()
        S = {nm: 1 / 3 for nm in NAMES}
    elif variant == 'V1':
        st = {nm: np.array(P, float) for nm, k, P, bar in BEAMS}
        S = {nm: (1.0 if nm in ('Az', 'By', 'Cy') else 0.0) for nm in NAMES}
    elif variant == 'straight':
        st = {nm: np.array(P, float) for nm, k, P, bar in BEAMS}
        S = {nm: 0.0 for nm in NAMES}
    for bi, (nm, k, P0, bar) in enumerate(BEAMS):
        pr, rec = build_beam(bi, st[nm], k, bar, S[nm], span, n, kind)
        rec.update(start=st[nm].tolist(), axis=AX[k], s=S[nm], bar=bar)
        prims += pr; recs[nm] = rec
    return prims, recs


def build_cut():
    """the drawn reading: straight model, the three near ends cut by planes that contain the line of sight"""
    prims, _ = build('straight')
    cuts = {'Az': [((1, 0, -1), 2 * H, -1)],                       # keep x - z >= 2H  -> -(x-z) <= -2H
            'By': [((0, -1, 1), -2 + 2 * H, -1)],                  # keep z - y >= -2+2H
            'Cy': [((0, -1, 1), -2 + 2 * H, -1), ((-1, 1, 0), 1 - 2 * H, 1)]}   # and y - x <= 1-2H
    for p in prims:
        nm = NAMES[p.beam]
        for (nv, c, sgn) in cuts.get(nm, []):
            nv = np.array(nv, float) * sgn
            w = c * sgn
            nn = np.linalg.norm(nv)
            p.N = np.vstack([p.N, nv / nn]); p.w = np.append(p.w, w / nn)
            p.tone = np.append(p.tone, -3); p.fid = np.append(p.fid, 900 + p.beam)
    return prims
