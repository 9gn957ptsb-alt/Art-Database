# The grip's two little-finger versions, both built from today's parts (outlines.py) without the fins.
# 3. Open well: a well through each end of the grip beside the ring carriage, so the little finger curls through the grip.
#    A bar across each well's end holds the grip's outer half on; the ends are 4 mm longer so the bar sits past the curled
#    finger. The carriages get a saddle across their palm-side rim and a thinner outer wall there.
# 4. Sliding tang: the hinge-end corner relieved, and a soft nose on a carbon strap that rides with the ring carriage.
# Pure Python (math only): the same text runs in the SketchUp build (su2_grip.py) and in the local checks. The outlines
# that need polygon booleans come from pinky.py (pinky_data.py). Each part: name -> (material, group, verts, tris, faces),
# verts (s, y, w) in the grip frame, tris index triples, faces planar polygons (outer loop, [inner loops]) of indices.
RHOLE = SC - WALL + 1.4                       # the body's slot: its end arcs' radius about (SC, +-YC)
FACE = lambda s: WT0 + WT1 * s                # the grip's phone-side face
WELL = dict(s0=24.0, s1=44.5, y0=-37.0, corner=3.0, bridge=4.0, longer=4.0, bridge_R=1.5, round_out=4.0, round_in=1.0,
            teeth=((15.5, 16.5), (41.5, 42.5)), tooth_y=(-35.9, -37.0),
            notch=dict(theta=305.0, depth=3.0, Rc=10.0, r_in=8.0, r_out=17.0), trim=dict(d=0.5, a0=250.0, a1=325.0, R=0.3))
TANG = dict(cap=20.0, wall=4.1, clear=0.68, ns=15.3, nr=4.0, nk=2.0, into=0.7, y_out=-51.0, re_in=2.0, re_out=1.0,
            band=(180.0, 360.0), band_r=(11.95, 13.3), web_arc=(205.0, 275.0), strap=(0.3, 1.8))

def checksum(v):
    return sum(x * (i % 7 + 1) for i, x in enumerate(v))
def pairs(flat):
    return [(flat[i] / 100.0, flat[i + 1] / 100.0) for i in range(0, len(flat), 2)]
def flip_y(pts):
    return ccw([(a, -b) for a, b in pts])
def plate_part(mat, grp, outline, holes, R, RH, wbot, wt0, wt1, nq):
    verts, tris, bottom, top, groups = plate_mesh(math, outline, holes, R, RH, wbot, wt0, wt1, nq)
    return (mat, grp, verts, tris, [bottom, top])

# ---------- 3. Open well ----------
def notch_lift(cy, sg, wbot):
    # the saddle: a cylinder (radius Rc) whose axis runs radially at theta about the ring centre, dipping `depth` below the
    # liner's palm face; it lifts the palm face of the carriage and the liner where it passes
    n = WELL["notch"]; th = math.radians(n["theta"]); ux, uy = math.cos(th), sg * math.sin(th)
    wc = WMIN - 0.6 + n["depth"] - n["Rc"]
    def lift(s, y):
        ds, dy = s - SC, y - cy; t = ds * ux + dy * uy
        if t < n["r_in"] or t > n["r_out"]: return 0.0
        lat = math.hypot(ds - t * ux, dy - t * uy)
        if lat >= n["Rc"]: return 0.0
        return max(0.0, wc + math.sqrt(n["Rc"] ** 2 - lat ** 2) - wbot)
    return lift
def zipper(outer, inner, P, cs, cy):
    # triangles between two loops that both go once round (cs, cy), each point listed by index into P
    ang = lambda i: math.atan2(P[i][1] - cy, P[i][0] - cs)
    def unwrap(L, a0):
        k = min(range(len(L)), key=lambda j: (ang(L[j]) - a0) % (2 * math.pi)); L = L[k:] + L[:k]
        out, prev = [], None
        for i in L:
            a = ang(i)
            while prev is not None and a < prev: a += 2 * math.pi
            out.append((a, i)); prev = a
        return out + [(out[0][0] + 2 * math.pi, out[0][1])]
    a0 = ang(outer[0]); O, I = unwrap(outer, a0), unwrap(inner, a0)
    i = j = 0; tris = []
    while i < len(O) - 1 or j < len(I) - 1:
        if j == len(I) - 1 or (i < len(O) - 1 and O[i + 1][0] <= I[j + 1][0]):
            tris.append((O[i][1], O[i + 1][1], I[j][1])); i += 1
        else:
            tris.append((O[i][1], I[j + 1][1], I[j][1])); j += 1
    return tris
def notched_part(mat, grp, outline, hole, R, RH, wbot, wt0, wt1, nq, cy, sg):
    # a ring plate whose palm face (w = wbot) the saddle lifts: the palm-side rounds move up with it, and the palm face,
    # no longer flat, is closed with triangles between the two loops instead of one polygon
    verts, tris, bottom, top, groups = plate_mesh(math, outline, [hole], R, RH, wbot, wt0, wt1, nq)
    lift = notch_lift(cy, sg, wbot); verts = list(verts); start = 0
    for rs, base in zip(groups, (outline, hole)):
        m = len(rs[0])
        for k in range(nq + 1):
            for j in range(m):
                s, y, w = verts[start + k * m + j]; verts[start + k * m + j] = (s, y, w + lift(*base[j]))
        start += len(rs) * m
    out_loop, in_loops = bottom
    tris = list(tris) + [(a, c, b) for a, b, c in zipper(out_loop[::-1], in_loops[0], verts, SC, cy)]
    return (mat, grp, verts, tris, [top])
def carriage_trimmed(cy, flip):
    # carriage() with its outer wall cut back by d over the angles a0..a1 (about the ring centre, y measured away from the
    # grip's middle), where the little finger leans on it. Returns the outline and its edge radii (smaller where it is thin).
    t = WELL["trim"]; sg = -1.0 if flip else 1.0; a0, a1, r1 = math.radians(t["a0"]), math.radians(t["a1"]), RO - t["d"]
    arc = lambda r, b0, b1, n: [(SC + r * math.cos(b0 + (b1 - b0) * k / n), r * math.sin(b0 + (b1 - b0) * k / n)) for k in range(n)]
    e = math.radians(1.5)          # the steps lean 1.5 degrees each way, so every point is further round than the one before
    p = arc(RO, math.pi, a0 - e, 19) + [(SC + RO * math.cos(a0 - e), RO * math.sin(a0 - e))] + arc(r1, a0 + e, a1 - e, 40)
    p += [(SC + r1 * math.cos(a1 - e), r1 * math.sin(a1 - e))] + arc(RO, a1 + e, 2 * math.pi, 10)
    p += [(a, b - cy) for a, b in carriage(cy, False)[48:]]             # the straight sides and the flat end, as today
    out = ccw([(a, cy + sg * b) for a, b in p])
    return out, sector_radii(out, cy, sg, t["R"], 0.5)
def sector_radii(pts, cy, sg, r_in, r_out):
    # edge radius r_in for points within 4 degrees of the trimmed sector, r_out elsewhere
    t = WELL["trim"]
    return [r_in if t["a0"] - 4 <= math.degrees(math.atan2(sg * (y - cy), s - SC)) % 360 <= t["a1"] + 4 else r_out for s, y in pts]
def well_parts():
    hole = cw(pairs(WELL_HOLE)); rad = [r / 10.0 for r in WELL_BODY_R]
    P = {"Grip Body": plate_part("si", "knuckle", body_outline(y_end=Y_END + WELL["longer"]), [hole], rad, 2.0, WMIN, WT0, WT1, 4)}
    # the well cuts the carbon track's end arcs, so the track is two rails; stop teeth on each keep the carriages' end stop
    trk = [plate_part("cf", "knuckle", pairs(f), [], 0.3, 0.3, WMIN + 0.3, WT0 - 0.3, WT1, 2) for f in (WELL_TRACK_HINGE, WELL_TRACK_FREE)]
    n0 = len(trk[0][2])
    P["Track Frame"] = ("cf", "knuckle", trk[0][2] + trk[1][2], trk[0][3] + [(a + n0, b + n0, c + n0) for a, b, c in trk[1][3]],
                        trk[0][4] + [([i + n0 for i in o], [[i + n0 for i in h] for h in hs]) for o, hs in trk[1][4]])
    for tag, cy, flip in (("Bottom", Y_HOME, False), ("Top", -Y_HOME, True)):
        sg = -1.0 if flip else 1.0
        outline, rad = carriage_trimmed(cy, flip); bore = cw(circle(cy, RI, 112))
        P["Ring Slider " + tag] = notched_part("cf", "ring" + tag[0], outline, bore, rad, sector_radii(bore, cy, sg, WELL["trim"]["R"], 0.5),
                                               WMIN - 0.3, WT0 + 0.3, WT1, 2, cy, sg)
        P["Ring Liner " + tag] = notched_part("si", "ring" + tag[0], ccw(circle(cy, LO, 112)), cw(circle(cy, LI, 112)), 0.3, 0.6,
                                              WMIN - 0.6, WT0 + 0.6, WT1, 2, cy, sg)
    return P

# ---------- 4. Sliding tang ----------
def nose_y_in(s):
    # the nose's inboard end: the relieved wall grown by the running clearance (from pinky.py), bottom end
    k = (s - TANG_YIN_S0) / TANG_YIN_DS; i = max(0, min(len(TANG_YIN) - 2, int(math.floor(k)))); f = k - i
    return (TANG_YIN[i] + (TANG_YIN[i + 1] - TANG_YIN[i]) * f) / 100.0
def nose_section():
    # (s, w) teardrop: hull of the nose circle and a neck reaching `into` mm into the strap; returned as outward half-planes
    t = TANG; ns, nr, nk = t["ns"], t["nr"], t["nk"]; wm = (WMIN + FACE(ns)) / 2
    pts = [(ns + nr * math.cos(2 * math.pi * k / 512), wm + nr * math.sin(2 * math.pi * k / 512)) for k in range(512)]
    pts += [(ns - nk, FACE(ns - nk) + t["strap"][0] + t["into"]), (ns + nk, FACE(ns + nk) + t["strap"][0] + t["into"])]
    h = hull(pts); planes = []
    for i in range(len(h)):
        a, b = h[i], h[(i + 1) % len(h)]; ex, ey = b[0] - a[0], b[1] - a[1]; L = math.hypot(ex, ey)
        nx, ny = ey / L, -ex / L; planes.append((nx, ny, nx * a[0] + ny * a[1]))
    return (ns, wm), planes
def hull(points):
    pts = sorted(set(points))
    def cross(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def nose_part(sg):
    # the section swept along y from the inboard end (following the relieved wall) out to y_out; both ends rounded by
    # insetting the section along a quarter circle; where the nose is short (at its back) the rounds shrink to fit
    t = TANG; (cs, cw_), planes = nose_section(); nang, nring = 96, 8
    def ring(delta):
        out = []
        for k in range(nang):
            a = 2 * math.pi * k / nang; dx, dw = math.cos(a), math.sin(a)
            r = min((h - delta - nx * cs - ny * cw_) / (nx * dx + ny * dw) for nx, ny, h in planes if nx * dx + ny * dw > 1e-9)
            out.append((cs + r * dx, cw_ + r * dw))
        return out
    re_, ro = t["re_in"], t["re_out"]; yo = t["y_out"]
    def ys(s, end, u):
        k = min(1.0, (nose_y_in(s) - yo - 0.2) / (re_ + ro))
        return nose_y_in(s) - k * u if end == "in" else yo + k * u
    rings = []
    for q in range(nring):
        ph = 0.5 * math.pi * q / (nring - 1); rings.append((ring(re_ * (1 - math.sin(ph))), "in", re_ * (1 - math.cos(ph))))
    for q in range(nring - 1, -1, -1):
        ph = 0.5 * math.pi * q / (nring - 1); rings.append((ring(ro * (1 - math.sin(ph))), "out", ro * (1 - math.cos(ph))))
    V, F = [], []
    for pts, end, u in rings:
        V += [(s, ys(s, end, u), w) for s, w in pts]
    R_ = len(rings)
    for r in range(R_ - 1):
        for k in range(nang):
            a, b = r * nang + k, r * nang + (k + 1) % nang; F += [(a, b, b + nang), (a, b + nang, a + nang)]
    c0 = len(V); V.append((cs, ys(cs, "in", 0.0), cw_)); c1 = len(V); V.append((cs, ys(cs, "out", 0.0), cw_))
    for k in range(nang):
        F.append((c0, (k + 1) % nang, k)); F.append((c1, (R_ - 1) * nang + k, (R_ - 1) * nang + (k + 1) % nang))
    if sg < 0:
        V = [(s, -y, w) for s, y, w in V]; F = [(a, c, b) for a, b, c in F]
    return ("si", "ringB" if sg > 0 else "ringT", V, F, [])
def slab_part(mat, grp, outline, d0, d1):
    # a sharp-edged plate between the planes FACE + d0 and FACE + d1
    n = len(outline); V = [(s, y, FACE(s) + d0) for s, y in outline] + [(s, y, FACE(s) + d1) for s, y in outline]
    F = []
    for j in range(n):
        j2 = (j + 1) % n; F += [(j, j2, n + j2), (j, n + j2, n + j)]
    return (mat, grp, V, F, [(list(range(n))[::-1], []), (list(range(n, 2 * n)), [])])
def tang_parts():
    base = grip_parts(); P = {}
    hook = pairs(TANG_HOOK); rad = [r / 10.0 for r in TANG_HOOK_R]
    P["Grip Body"] = plate_part("si", "knuckle", hook, base["Grip Body"][3], rad, 2.0, WMIN, WT0, WT1, 4)
    for n in ("Track Frame", "Ring Slider Bottom", "Ring Liner Bottom", "Ring Slider Top", "Ring Liner Top"):
        mat, grp, outline, holes, R, RH, wbot, wt0, wt1, nq, swap = base[n]
        P[n] = plate_part(mat, grp, outline, holes, R, RH, wbot, wt0, wt1, nq)
    strap = pairs(TANG_STRAP); d0, d1 = TANG["strap"]
    P["Tang Strap Bottom"] = slab_part("cf", "ringB", strap, d0, d1)
    P["Tang Strap Top"] = slab_part("cf", "ringT", flip_y(strap), d0, d1)
    P["Tang Nose Bottom"] = nose_part(1.0)
    P["Tang Nose Top"] = nose_part(-1.0)
    return P

VARIANTS = (("well", "Open Well", "Open well"), ("tang", "Sliding Tang", "Sliding tang"))   # key, group name, tag and scene
def variant_parts():
    data = {"well_hole": WELL_HOLE, "well_track_hinge": WELL_TRACK_HINGE, "well_track_free": WELL_TRACK_FREE, "tang_hook": TANG_HOOK,
            "tang_strap": TANG_STRAP, "well_body_r": WELL_BODY_R, "tang_hook_r": TANG_HOOK_R, "tang_yin": TANG_YIN}
    bad = [k for k, v in data.items() if checksum(v) != PINKY_SUM[k]]
    assert not bad, "mistyped outline data: " + ", ".join(bad)
    return {"well": well_parts(), "tang": tang_parts()}
