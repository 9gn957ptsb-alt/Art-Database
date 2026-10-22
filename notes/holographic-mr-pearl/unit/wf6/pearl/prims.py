"""prims.py - the primitive kinds of pearl.json, chosen so that each has an exact, cheap GLSL SDF.

Every primitive is convex, so its silhouette from any orthographic view is the convex hull of the projection of a
few sample points (used for fast silhouette fitting), and its exact SDF is used by the ray caster (numpy here,
GLSL in pearl_view.html).

Kinds (all lengths in the same unit as the points):
  sphere      c, r
  ellipsoid   c, R (3x3, columns = local axes), radii (a, b, c)       local frame
  capsule     a, b, r                                                 segment a-b swept by a ball r
  roundcone   a, b, ra, rb                                            hull of ball(a, ra) and ball(b, rb)
  cappedcone  a, b, ra, rb                                            frustum with flat ends (cylinder: ra = rb)
  roundbox    c, R, half (hx, hy, hz), round                          box with rounded edges, local frame
  torus       c, R, major, minor                                      ring in local xy (local z = axis)
  dome        c, R, radii (a, b, h)                                   half-ellipsoid, local z >= 0 (base at c)
  dish        c, R, Rs, t, r_in, r_out                                curved brim: sphere radius Rs centred at
                                                                       c - Rs z_loc, thickness t, cut to
                                                                       r_in <= distance from the local z axis <= r_out
"""
import numpy as np

KINDS = ('sphere', 'ellipsoid', 'capsule', 'roundcone', 'cappedcone', 'roundbox', 'torus', 'dome', 'dish')


def unit(v):
    v = np.asarray(v, float)
    return v / np.linalg.norm(v)


def frame_z(w, hint=(1, 0, 0)):
    """rotation (columns x, y, z) whose local z is w; local x as close to hint as possible"""
    w = unit(w)
    h = np.asarray(hint, float)
    if abs(np.dot(unit(h), w)) > 0.97:
        h = np.array([0, 1.0, 0]) if abs(w[1]) < 0.9 else np.array([1.0, 0, 0])
    x = unit(h - np.dot(h, w) * w)
    y = np.cross(w, x)
    return np.c_[x, y, w]


def Rz(a):
    a = np.radians(a); c, s = np.cos(a), np.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.0]])


def Rx(a):
    a = np.radians(a); c, s = np.cos(a), np.sin(a)
    return np.array([[1.0, 0, 0], [0, c, -s], [0, s, c]])


def Ry(a):
    a = np.radians(a); c, s = np.cos(a), np.sin(a)
    return np.array([[c, 0, s], [0, 1.0, 0], [-s, 0, c]])


# ---------------------------------------------------------------- numpy SDFs (world points p: (N,3))

def _loc(p, pr):
    return (p - np.asarray(pr['c'], float)) @ np.asarray(pr['R'], float)


def sdf(pr, p):
    k = pr['kind']
    if k == 'sphere':
        return np.linalg.norm(p - np.asarray(pr['c']), axis=1) - pr['r']
    if k == 'ellipsoid':
        q = _loc(p, pr); r = np.asarray(pr['radii'], float)
        k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
        return np.where(k1 > 1e-12, k0 * (k0 - 1.0) / np.maximum(k1, 1e-12), -r.min())
    if k == 'capsule':
        a, b = np.asarray(pr['a'], float), np.asarray(pr['b'], float)
        pa, ba = p - a, b - a
        h = np.clip(pa @ ba / (ba @ ba), 0, 1)
        return np.linalg.norm(pa - h[:, None] * ba, axis=1) - pr['r']
    if k == 'roundcone':
        return _sd_roundcone(p, np.asarray(pr['a'], float), np.asarray(pr['b'], float), pr['ra'], pr['rb'])
    if k == 'cappedcone':
        return _sd_cappedcone(p, np.asarray(pr['a'], float), np.asarray(pr['b'], float), pr['ra'], pr['rb'])
    if k == 'roundbox':
        q = np.abs(_loc(p, pr)) - (np.asarray(pr['half'], float) - pr['round'])
        return np.linalg.norm(np.maximum(q, 0), axis=1) + np.minimum(q.max(1), 0) - pr['round']
    if k == 'torus':
        q = _loc(p, pr)
        return np.hypot(np.hypot(q[:, 0], q[:, 1]) - pr['major'], q[:, 2]) - pr['minor']
    if k == 'dome':
        q = _loc(p, pr); r = np.asarray(pr['radii'], float)
        k0 = np.linalg.norm(q / r, axis=1); k1 = np.linalg.norm(q / (r * r), axis=1)
        de = np.where(k1 > 1e-12, k0 * (k0 - 1.0) / np.maximum(k1, 1e-12), -r.min())
        return np.maximum(de, -q[:, 2])
    if k == 'dish':
        q = _loc(p, pr)
        rad = np.hypot(q[:, 0], q[:, 1])
        ds = np.abs(np.linalg.norm(q - np.array([0, 0, -pr['Rs']]), axis=1) - pr['Rs']) - pr['t'] / 2
        return np.maximum(np.maximum(ds, rad - pr['r_out']), pr['r_in'] - rad)
    raise ValueError(k)


def _sd_roundcone(p, a, b, r1, r2):
    # IQ, sdRoundCone(p, a, b, r1, r2) - exact
    ba = b - a; l2 = ba @ ba; rr = r1 - r2; a2 = l2 - rr * rr; il2 = 1.0 / l2
    pa = p - a
    y = pa @ ba; z = y - l2
    xv = pa * l2 - np.outer(y, ba); x2 = np.einsum('ij,ij->i', xv, xv)
    y2 = y * y * l2; z2 = z * z * l2
    k = np.sign(rr) * rr * rr * x2
    out = np.where(np.sign(z) * a2 * z2 > k, np.sqrt(np.maximum(x2 + z2, 0)) * il2 - r2,
                   np.where(np.sign(y) * a2 * y2 < k, np.sqrt(np.maximum(x2 + y2, 0)) * il2 - r1,
                            (np.sqrt(np.maximum(x2 * a2 * il2, 0)) + y * rr) * il2 - r1))
    return out


def _sd_cappedcone(p, a, b, ra, rb):
    # IQ, sdCappedCone(p, a, b, ra, rb) - exact
    rba = rb - ra; ba = b - a; baba = ba @ ba
    pa = p - a
    papa = np.einsum('ij,ij->i', pa, pa); paba = pa @ ba / baba
    x = np.sqrt(np.maximum(papa - paba * paba * baba, 0))
    cax = np.maximum(0.0, x - np.where(paba < 0.5, ra, rb))
    cay = np.abs(paba - 0.5) - 0.5
    k = rba * rba + baba
    f = np.clip((rba * (x - ra) + paba * baba) / k, 0, 1)
    cbx = x - ra - f * rba
    cby = paba - f
    s = np.where((cbx < 0) & (cay < 0), -1.0, 1.0)
    return s * np.sqrt(np.minimum(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba))


def bound(pr):
    """(centre, radius) of a bounding sphere"""
    k = pr['kind']
    if k == 'sphere':
        return np.asarray(pr['c'], float), pr['r']
    if k in ('ellipsoid',):
        return np.asarray(pr['c'], float), max(pr['radii'])
    if k == 'dome':
        return np.asarray(pr['c'], float), max(pr['radii'])
    if k in ('capsule', 'roundcone', 'cappedcone'):
        a, b = np.asarray(pr['a'], float), np.asarray(pr['b'], float)
        r = pr['r'] if k == 'capsule' else max(pr['ra'], pr['rb'])
        return (a + b) / 2, np.linalg.norm(b - a) / 2 + r * (1.5 if k == 'cappedcone' else 1.0)
    if k == 'roundbox':
        return np.asarray(pr['c'], float), float(np.linalg.norm(pr['half']))
    if k == 'torus':
        return np.asarray(pr['c'], float), pr['major'] + pr['minor']
    if k == 'dish':
        return np.asarray(pr['c'], float), float(np.hypot(pr['r_out'], pr['t'] + pr['r_out'] ** 2 / pr['Rs']))
    raise ValueError(k)


# ---------------------------------------------------------------- silhouette hull points (2D, for a view)

def _circle3(c, n, r, m=48):
    """points of a circle centre c, normal n, radius r"""
    F = frame_z(n)
    t = np.linspace(0, 2 * np.pi, m, endpoint=False)
    return c + r * (np.outer(np.cos(t), F[:, 0]) + np.outer(np.sin(t), F[:, 1]))


def _disc2(c2, r, m=48):
    t = np.linspace(0, 2 * np.pi, m, endpoint=False)
    return c2 + r * np.c_[np.cos(t), np.sin(t)]


def hull_points(pr, P):
    """2D points whose convex hull is the primitive's silhouette under the projection P (2x3 rows = screen
    axes in world units, orthographic)."""
    k = pr['kind']
    pj = lambda X: np.atleast_2d(X) @ P.T
    if k == 'sphere':
        return _disc2(pj(pr['c'])[0], pr['r'], 64)
    if k == 'capsule':
        return np.r_[_disc2(pj(pr['a'])[0], pr['r']), _disc2(pj(pr['b'])[0], pr['r'])]
    if k == 'roundcone':
        return np.r_[_disc2(pj(pr['a'])[0], pr['ra']), _disc2(pj(pr['b'])[0], pr['rb'])]
    if k == 'cappedcone':
        a, b = np.asarray(pr['a'], float), np.asarray(pr['b'], float)
        n = b - a
        return pj(np.r_[_circle3(a, n, pr['ra'], 64), _circle3(b, n, pr['rb'], 64)])
    if k in ('ellipsoid', 'dome'):
        R = np.asarray(pr['R'], float); r = np.asarray(pr['radii'], float)
        th = np.linspace(0, np.pi if k == 'ellipsoid' else np.pi / 2, 25)
        ph = np.linspace(0, 2 * np.pi, 48, endpoint=False)
        T, Ph = np.meshgrid(th, ph)
        loc = np.c_[(np.sin(T) * np.cos(Ph)).ravel(), (np.sin(T) * np.sin(Ph)).ravel(), np.cos(T).ravel()] * r
        if k == 'dome':
            loc = np.r_[loc, np.c_[np.cos(ph), np.sin(ph), 0 * ph] * r]
        return pj(np.asarray(pr['c'], float) + loc @ R.T)
    if k == 'roundbox':
        R = np.asarray(pr['R'], float); h = np.asarray(pr['half'], float) - pr['round']
        cs = np.array([[sx, sy, sz] for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]) * h
        c2 = pj(np.asarray(pr['c'], float) + cs @ R.T)
        return np.concatenate([_disc2(q, pr['round'], 16) for q in c2]) if pr['round'] > 0 else c2
    if k == 'torus':
        R = np.asarray(pr['R'], float)
        ring = _circle3(np.asarray(pr['c'], float), R[:, 2], pr['major'], 96)
        return np.concatenate([_disc2(q, pr['minor'], 12) for q in pj(ring)])
    if k == 'dish':
        R = np.asarray(pr['R'], float); c = np.asarray(pr['c'], float); z = R[:, 2]
        drop = pr['Rs'] - np.sqrt(pr['Rs'] ** 2 - pr['r_out'] ** 2)
        pts = []
        for dz in (-pr['t'] / 2, pr['t'] / 2):
            pts.append(_circle3(c + z * (dz - drop), z, pr['r_out'] * (1 + 0 * dz), 128))
        drop_in = pr['Rs'] - np.sqrt(pr['Rs'] ** 2 - pr['r_in'] ** 2)
        pts.append(_circle3(c + z * (pr['t'] / 2 - drop_in), z, pr['r_in'], 64))
        return pj(np.concatenate(pts))
    raise ValueError(k)


def convex_hull(pts):
    """Andrew monotone chain; pts (N,2) -> hull vertices (M,2) counter-clockwise"""
    pts = np.unique(np.round(np.asarray(pts, float), 6), axis=0)
    if len(pts) < 3:
        return pts
    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(tuple(p))
    for p in pts[::-1]:
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(tuple(p))
    return np.array(lower[:-1] + upper[:-1])


# ---------------------------------------------------------------- transforms

def transform(pr, M, t, s=1.0):
    """apply p -> s M p + t to a primitive (M a rotation)"""
    q = dict(pr)
    M = np.asarray(M, float); t = np.asarray(t, float)
    for key in ('c', 'a', 'b'):
        if key in q:
            q[key] = (s * (M @ np.asarray(q[key], float)) + t).tolist()
    if 'R' in q:
        q['R'] = (M @ np.asarray(q['R'], float)).tolist()
    for key in ('r', 'ra', 'rb', 'round', 'major', 'minor', 'Rs', 't', 'r_in', 'r_out'):
        if key in q:
            q[key] = float(q[key]) * s
    for key in ('radii', 'half'):
        if key in q:
            q[key] = (np.asarray(q[key], float) * s).tolist()
    return q
