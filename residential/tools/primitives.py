# Solid builders shared by the compiler (rdb.py) and the SketchUp engine (engine.py
# pastes this file into build_model code). Plain Python with no imports: the connector
# rejects import statements and pre-loads `math`, and rdb.py supplies math the same way.
# Every builder returns (vertices, faces): vertices are (x, y, z) in metres, faces are
# [material or None, outer loop, hole loops...] of vertex indices, wound outward.


def _area(r):
    s = 0.0
    for i in range(len(r)):
        a, b = r[i], r[(i + 1) % len(r)]
        s += a[0] * b[1] - a[1] * b[0]
    return s / 2


def _newell(pts):
    nx = ny = nz = 0.0
    for i in range(len(pts)):
        a, b = pts[i], pts[(i + 1) % len(pts)]
        nx += (a[1] - b[1]) * (a[2] + b[2])
        ny += (a[2] - b[2]) * (a[0] + b[0])
        nz += (a[0] - b[0]) * (a[1] + b[1])
    return (nx, ny, nz)


def _pz(pl, x, y):
    return pl[0] * x + pl[1] * y + pl[2]


def _mesh():
    return {"v": [], "f": [], "ix": {}}


def _vid(m, p):
    k = (round(p[0], 5), round(p[1], 5), round(p[2], 5))
    if k not in m["ix"]:
        m["ix"][k] = len(m["v"])
        m["v"].append(k)
    return m["ix"][k]


def _face(m, loops, outward, mat=None):
    ids = []
    for lp in loops:
        out = []
        for p in lp:
            i = _vid(m, p)
            if not out or out[-1] != i:
                out.append(i)
        while len(out) > 1 and out[0] == out[-1]:
            out.pop()
        ids.append(out)
    if len(ids[0]) < 3:
        return
    n = _newell([m["v"][i] for i in ids[0]])
    if n[0] * outward[0] + n[1] * outward[1] + n[2] * outward[2] < 0:
        ids = [lp[::-1] for lp in ids]
        n = (-n[0], -n[1], -n[2])
    rec = [mat, ids[0]]
    for lp in ids[1:]:
        if len(lp) < 3:
            continue
        h = _newell([m["v"][i] for i in lp])
        rec.append(lp if h[0] * n[0] + h[1] * n[1] + h[2] * n[2] < 0 else lp[::-1])
    m["f"].append(rec)


def prism(rings, zb, zt, mt=None, mb=None, ms=None):
    """A polygon (outer ring, then hole rings, [x, y] in metres) between planes zb and zt
    (z = a*x + b*y + c)."""
    m = _mesh()
    outer = rings[0] if _area(rings[0]) > 0 else rings[0][::-1]
    holes = [(h if _area(h) < 0 else h[::-1]) for h in rings[1:]]
    allr = [outer] + holes
    _face(m, [[(x, y, _pz(zt, x, y)) for x, y in r] for r in allr], (0, 0, 1), mt)
    _face(m, [[(x, y, _pz(zb, x, y)) for x, y in r] for r in allr], (0, 0, -1), mb)
    for r in allr:
        for i in range(len(r)):
            a, b = r[i], r[(i + 1) % len(r)]
            dx, dy = b[0] - a[0], b[1] - a[1]
            _face(m, [[(a[0], a[1], _pz(zb, a[0], a[1])), (b[0], b[1], _pz(zb, b[0], b[1])),
                     (b[0], b[1], _pz(zt, b[0], b[1])), (a[0], a[1], _pz(zt, a[0], a[1]))]], (dy, -dx, 0), ms)
    return m["v"], m["f"]


def wall(s):
    """One straight wall piece with rectangular openings cut through it as inner loops.
    s: os, oe, is, ie: plan corners (outer start/end, inner start/end); bo, bi: the outer
    and inner face lines' points at u = 0; d: unit direction; z0: bottom; pl: top plane;
    ops: [u0, u1, sill, head] (heights above z0); mo, mi: outer and inner face materials."""
    m = _mesh()
    d, z0, pl = s["d"], s["z0"], s["pl"]
    nl = (-d[1], d[0])
    top = lambda p: _pz(pl, p[0], p[1])

    def at(u, z, side):
        b = s["bi"] if side == "in" else s["bo"]
        return (b[0] + d[0] * u, b[1] + d[1] * u, z0 + z)
    os_, oe, is_, ie = s["os"], s["oe"], s["is"], s["ie"]
    holes_o, holes_i = [], []
    for u0, u1, zs, zh in s["ops"]:
        holes_o.append([at(u0, zs, "out"), at(u1, zs, "out"), at(u1, zh, "out"), at(u0, zh, "out")])
        holes_i.append([at(u0, zs, "in"), at(u1, zs, "in"), at(u1, zh, "in"), at(u0, zh, "in")])
    bo = [(os_[0], os_[1], z0), (oe[0], oe[1], z0)]
    to = [(oe[0], oe[1], top(oe)), (os_[0], os_[1], top(os_))]
    bi = [(is_[0], is_[1], z0), (ie[0], ie[1], z0)]
    ti = [(ie[0], ie[1], top(ie)), (is_[0], is_[1], top(is_))]
    _face(m, [bo + to] + holes_o, (-nl[0], -nl[1], 0), s.get("mo"))
    _face(m, [bi + ti] + holes_i, (nl[0], nl[1], 0), s.get("mi"))
    _face(m, [[bo[0], bo[1], bi[1], bi[0]]], (0, 0, -1))
    _face(m, [[to[1], to[0], ti[0], ti[1]]], (0, 0, 1))
    _face(m, [[bo[0], bi[0], ti[1], to[1]]], (-d[0], -d[1], 0))
    _face(m, [[bo[1], bi[1], ti[0], to[0]]], (d[0], d[1], 0))
    for u0, u1, zs, zh in s["ops"]:
        _face(m, [[at(u0, zs, "out"), at(u0, zs, "in"), at(u0, zh, "in"), at(u0, zh, "out")]], (d[0], d[1], 0))
        _face(m, [[at(u1, zs, "out"), at(u1, zs, "in"), at(u1, zh, "in"), at(u1, zh, "out")]], (-d[0], -d[1], 0))
        _face(m, [[at(u0, zs, "out"), at(u1, zs, "out"), at(u1, zs, "in"), at(u0, zs, "in")]], (0, 0, 1))
        _face(m, [[at(u0, zh, "out"), at(u1, zh, "out"), at(u1, zh, "in"), at(u0, zh, "in")]], (0, 0, -1))
    return m["v"], m["f"]


def realize(k, s):
    if k == "prism":
        return prism(s["r"], s["zb"], s["zt"], s.get("mt"), s.get("mb"), s.get("ms"))
    if k == "wall":
        return wall(s)
    raise Exception("unknown solid kind " + str(k))
