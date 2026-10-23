# Sliding-ring grip outlines in the grip's own frame: s from the hinge axis, y along it (0 = arm centreline), mm.
# Pure Python (math only), shared by the local checks and the SketchUp build.
SC, RO, RI, LO, LI, CWR = 29.0, 13.3, 11.8, 11.75, 10.5, 1.5
TRAVEL, WALL, STOP_H, STOP_FLAT, STOP_RAMP = 8.0, 15.5, 2.5, 8.8, 2.4
Y_HOME, NUB = -23.34, 10.0
YC = -(Y_HOME - TRAVEL)                     # end-semicircle centres of the track
S_IN, S_OUT, BULGE = 5.5, 52.0, 1.5
Y_END = YC + (SC - WALL) + 1.4 + 7.4         # end caps 7.4 mm past the slot
WMIN = -1.75
WT0, WT1 = WMIN + 8.0 - 4.5 * 6.0 / 40.0, 4.5 / 40.0

def area(p):
    a = 0.0
    for i in range(len(p)):
        a += p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1]
    return a / 2.0
def ccw(p):
    return p if area(p) > 0 else p[::-1]
def cw(p):
    return p[::-1] if area(p) > 0 else p
def resample(dense, n):
    # dense: closed polyline (list of points, first != last); returns n points evenly spaced along it
    pts = dense + [dense[0]]
    cum = [0.0]
    for i in range(1, len(pts)):
        cum.append(cum[-1] + math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    L = cum[-1]; out = []; j = 0
    for k in range(n):
        t = L * k / n
        while cum[j + 1] < t: j += 1
        f = (t - cum[j]) / max(1e-12, cum[j + 1] - cum[j])
        out.append((pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f))
    return out
def arcpts(cx, cy, r, a0, a1, step=0.1):
    n = max(2, int(abs(a1 - a0) * r / step))
    return [(cx + r * math.cos(a0 + (a1 - a0) * i / n), cy + r * math.sin(a0 + (a1 - a0) * i / n)) for i in range(n)]
def linepts(p, q, step=0.1):
    n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / step))
    return [(p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n) for i in range(n)]
def stadium(r, n):
    d = []
    d += linepts((SC + r, -YC), (SC + r, YC))
    d += arcpts(SC, YC, r, 0.0, math.pi)
    d += linepts((SC - r, YC), (SC - r, -YC))
    d += arcpts(SC, -YC, r, math.pi, 2 * math.pi)
    return resample(d, n)
def stop_h(y):
    a = abs(y)
    if a <= STOP_FLAT: return STOP_H
    if a >= STOP_FLAT + STOP_RAMP: return 0.0
    return STOP_H * 0.5 * (1 + math.cos(math.pi * (a - STOP_FLAT) / STOP_RAMP))
TR0 = -(Y_HOME + NUB)
def ripple(y):
    a = abs(y)
    if a < TR0 - 1.0 or a > TR0 + TRAVEL + 1.0: return 0.0
    return 0.5 * math.cos(math.pi * (a - TR0) / 2.0) ** 2
def frame_inner():
    n = int(round(2 * YC / 0.4))
    ys = [YC - 2 * YC * i / n for i in range(n + 1)]
    left = [(WALL - ripple(y) + stop_h(y), y) for y in ys]
    right = [(2 * SC - WALL + ripple(y) - stop_h(y), y) for y in ys[::-1]]
    r = SC - WALL
    bot = [(SC + r * math.cos(math.pi + math.pi * i / 40), -YC + r * math.sin(math.pi + math.pi * i / 40)) for i in range(1, 40)]
    top = [(SC + r * math.cos(math.pi * i / 40), YC + r * math.sin(math.pi * i / 40)) for i in range(1, 40)]
    return left + bot + right + top
def body_outline(n=200):
    rh, rc = 7.0, 12.0
    u = (Y_END ** 2 - BULGE ** 2) / (2 * BULGE); Rb = u + BULGE; c0 = S_OUT - u        # big arc of the outer edge
    cy_ = Y_END - rc; cx_ = c0 + math.sqrt((Rb - rc) ** 2 - cy_ ** 2)                    # outer corner centre (top)
    phi = math.atan2(cy_, cx_ - c0)                                                     # tangent direction from the big centre
    d = []
    d += arcpts(S_IN + rh, -Y_END + rh, rh, math.pi, 1.5 * math.pi)
    d += linepts((S_IN + rh, -Y_END), (cx_, -Y_END))
    d += arcpts(cx_, -cy_, rc, 1.5 * math.pi, 2 * math.pi - phi)
    d += arcpts(c0, 0.0, Rb, -phi, phi, 0.05)
    d += arcpts(cx_, cy_, rc, phi, 0.5 * math.pi)
    d += linepts((cx_, Y_END), (S_IN + rh, Y_END))
    d += arcpts(S_IN + rh, Y_END - rh, rh, 0.5 * math.pi, math.pi)
    d += linepts((S_IN, Y_END - rh), (S_IN, -Y_END + rh))
    return ccw(resample(d, n))
def circle(cy, r, n=56):
    return [(SC + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
def carriage(cy, flip):
    # D-shaped carbon carriage: round end away from the centre, flat end (stop face) toward it
    sg = -1.0 if flip else 1.0
    p = [(SC + RO * math.cos(math.pi + math.pi * i / 48), RO * math.sin(math.pi + math.pi * i / 48)) for i in range(48)]
    p += [(SC + RO, (RO - CWR) * i / 6) for i in range(6)]
    p += [(SC + RO - CWR + CWR * math.cos(0.5 * math.pi * i / 6), RO - CWR + CWR * math.sin(0.5 * math.pi * i / 6)) for i in range(6)]
    p += [(SC + RO - CWR - 2 * (RO - CWR) * i / 14, RO) for i in range(14)]
    p += [(SC - RO + CWR + CWR * math.cos(0.5 * math.pi + 0.5 * math.pi * i / 6), RO - CWR + CWR * math.sin(0.5 * math.pi + 0.5 * math.pi * i / 6)) for i in range(6)]
    p += [(SC - RO, RO - CWR - (RO - CWR) * i / 6) for i in range(6)]
    return ccw([(a, cy + sg * b) for a, b in p])
# Fin on the palm face (w < WMIN) at each ring's outer end, between the ring finger and the little finger; it slides with its ring.
FIN_IN, FIN_T, FIN_S0, FIN_S1 = 11.8, 3.5, 22.0, 36.0     # inner face from the ring centre, thickness, base span in s
ROOT_IN, ROOT_H, FIN_H, FIN_TIP = 11.85, 1.5, 10.0, 2.5   # root clears the liner (LO); blade height; tip narrowing per side
W_FACE = WMIN - 0.3                                       # carriage palm face; the root sits on it
def fillet(poly, radii, step):
    # round the corners of a closed polygon; radius 0 leaves a corner sharp. Keep step coarse: SketchUp merges edges under 0.03 mm
    out = []
    for i in range(len(poly)):
        p, c, q = poly[i - 1], poly[i], poly[(i + 1) % len(poly)]; r = radii[i]
        if r <= 0:
            out.append(c); continue
        a = (p[0] - c[0], p[1] - c[1]); b = (q[0] - c[0], q[1] - c[1])
        la, lb = math.hypot(*a), math.hypot(*b); a = (a[0] / la, a[1] / la); b = (b[0] / lb, b[1] / lb)
        th = math.acos(max(-1.0, min(1.0, a[0] * b[0] + a[1] * b[1]))); d = r / math.tan(th / 2)
        bis = (a[0] + b[0], a[1] + b[1]); lbis = math.hypot(*bis); h = r / math.sin(th / 2)
        o = (c[0] + bis[0] / lbis * h, c[1] + bis[1] / lbis * h)
        t0, t1 = (c[0] + a[0] * d, c[1] + a[1] * d), (c[0] + b[0] * d, c[1] + b[1] * d)
        a0, a1 = math.atan2(t0[1] - o[1], t0[0] - o[0]), math.atan2(t1[1] - o[1], t1[0] - o[0])
        while a1 - a0 > math.pi: a1 -= 2 * math.pi
        while a0 - a1 > math.pi: a1 += 2 * math.pi
        out += arcpts(o[0], o[1], r, a0, a1, step) + [t1]
    return out
def fin_root(cy, flip):
    # carbon saddle on the carriage's outer wall: inner edge follows the liner, outer edge is the blade's outer face
    sg = -1.0 if flip else 1.0
    arc = [(s, -math.sqrt(ROOT_IN ** 2 - (s - SC) ** 2)) for s in [FIN_S1 - (FIN_S1 - FIN_S0) * i / 10 for i in range(11)]]
    corners = [(FIN_S0, -(FIN_IN + FIN_T)), (FIN_S1, -(FIN_IN + FIN_T))]
    p = fillet(corners + arc, [1.5, 1.5, 0.6] + [0] * 9 + [0.6], 0.4)     # coarse arc so the acute ends can be rounded
    return ccw([(a, cy + sg * b) for a, b in p])
def fin_blade():
    # silicone blade in the (s, w) plane; it is extruded along y through the fin's thickness
    w0 = W_FACE - ROOT_H; w1 = w0 - FIN_H
    p = [(FIN_S0, w0), (FIN_S1, w0), (FIN_S1 - FIN_TIP, w1), (FIN_S0 + FIN_TIP, w1)]
    return ccw(fillet(p, [0, 0, 3.0, 3.0], 0.4))
def grip_parts():
    # name -> (material, group, outline, holes, R, RH, wbot, wt0, wt1, nq, swap)
    # swap: the outline is (s, w) and the plate runs along y between wbot and wt0 (the fin blades)
    P = {}
    P["Grip Body"] = ("si", "knuckle", body_outline(), [cw(stadium(SC - WALL + 1.4, 132))], 3.0, 2.0, WMIN, WT0, WT1, 4, False)
    P["Track Frame"] = ("cf", "knuckle", ccw(stadium(SC - WALL + 1.3, 132)), [cw(frame_inner())], 0.3, 0.3, WMIN + 0.3, WT0 - 0.3, WT1, 2, False)
    for tag, cy, flip in (("Bottom", Y_HOME, False), ("Top", -Y_HOME, True)):
        sg = -1.0 if flip else 1.0
        P["Ring Slider " + tag] = ("cf", "ring" + tag[0], carriage(cy, flip), [cw(circle(cy, RI))], 0.5, 0.5, WMIN - 0.3, WT0 + 0.3, WT1, 2, False)
        P["Ring Liner " + tag] = ("si", "ring" + tag[0], ccw(circle(cy, LO)), [cw(circle(cy, LI))], 0.3, 0.6, WMIN - 0.6, WT0 + 0.6, WT1, 2, False)
        P["Ring Fin Root " + tag] = ("cf", "ring" + tag[0], fin_root(cy, flip), [], 0.4, 0.4, W_FACE - ROOT_H, W_FACE, 0.0, 2, False)
        ya, yb = cy - sg * FIN_IN, cy - sg * (FIN_IN + FIN_T)
        P["Ring Fin " + tag] = ("si", "ring" + tag[0], fin_blade(), [], 1.2, 1.2, min(ya, yb), max(ya, yb), 0.0, 4, True)
    return P
