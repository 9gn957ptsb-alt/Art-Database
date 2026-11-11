# Rounded-edge plate generator. Pure Python, no imports: the same text runs inside SketchUp.
def plate_mesh(math, outline, holes, R, RH, wbot, wt0, wt1, nq):
    # outline counter-clockwise, holes clockwise, points (s, y) in mm.
    # Bottom face flat at w = wbot, top face the plane w = wt0 + wt1 * s.
    # R, RH: edge radii of the outline and the holes (R, and RH for a single hole, may also be lists: one radius per point); nq: segments per quarter round.
    hyp = math.hypot
    def left_normals(base):
        out = []
        m = len(base)
        for j in range(m):
            a, b, c = base[j - 1], base[j], base[(j + 1) % m]
            e1 = (b[0] - a[0], b[1] - a[1]); l1 = hyp(e1[0], e1[1]); n1 = (-e1[1] / l1, e1[0] / l1)
            e2 = (c[0] - b[0], c[1] - b[1]); l2 = hyp(e2[0], e2[1]); n2 = (-e2[1] / l2, e2[0] / l2)
            n = (n1[0] + n2[0], n1[1] + n2[1]); ln = hyp(n[0], n[1]); n = (n[0] / ln, n[1] / ln)
            k = 1.0 / max(0.6, n[0] * n2[0] + n[1] * n2[1])
            out.append((n[0] * k, n[1] * k))
        return out
    def top(s):
        return wt0 + wt1 * s
    def rings(base, rad):
        nrm = left_normals(base)
        rv = rad if isinstance(rad, list) else [rad] * len(base)
        def ring(delta, wf):
            # delta(r): inward offset and wf(s, r): height, for a point whose edge radius is r
            out = []
            for j in range(len(base)):
                r = rv[j]; d = delta(r)
                s = base[j][0] + nrm[j][0] * d; y = base[j][1] + nrm[j][1] * d
                out.append((s, y, wf(s, r)))
            return out
        if max(rv) <= 0:
            return [ring(lambda r: 0.0, lambda s, r: wbot), ring(lambda r: 0.0, lambda s, r: top(s))]
        rs = [ring(lambda r: r, lambda s, r: wbot)]
        for k in range(1, nq + 1):
            a = math.radians(270.0 - 90.0 * k / nq)
            rs.append(ring(lambda r, a=a: r + r * math.cos(a), lambda s, r, a=a: wbot + r + r * math.sin(a)))
        for k in range(0, nq + 1):
            a = math.radians(180.0 - 90.0 * k / nq)
            rs.append(ring(lambda r, a=a: r + r * math.cos(a), lambda s, r, a=a: top(s) - r + r * math.sin(a)))
        return rs
    groups = [rings(outline, R)]
    for h in holes:
        groups.append(rings(h, RH))
    verts, tris, firsts, lasts = [], [], [], []
    for rs in groups:
        m = len(rs[0]); start = len(verts)
        for r in rs:
            verts.extend(r)
        for a in range(len(rs) - 1):
            o, p = start + a * m, start + (a + 1) * m
            for j in range(m):
                j2 = (j + 1) % m
                tris.append((o + j, o + j2, p + j2)); tris.append((o + j, p + j2, p + j))
        firsts.append([start + j for j in range(m)])
        lasts.append([start + (len(rs) - 1) * m + j for j in range(m)])
    bottom = (firsts[0][::-1], [f[::-1] for f in firsts[1:]])
    top_face = (lasts[0], lasts[1:])
    return verts, tris, bottom, top_face, groups
