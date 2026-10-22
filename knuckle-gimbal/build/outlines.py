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
def grip_parts():
    # name -> (material, group, outline, holes, R, RH, wbot, wt0, wt1, nq)
    P = {}
    P["Grip Body"] = ("si", "knuckle", body_outline(), [cw(stadium(SC - WALL + 1.4, 132))], 3.0, 2.0, WMIN, WT0, WT1, 4)
    P["Track Frame"] = ("cf", "knuckle", ccw(stadium(SC - WALL + 1.3, 132)), [cw(frame_inner())], 0.3, 0.3, WMIN + 0.3, WT0 - 0.3, WT1, 2)
    for tag, cy, flip in (("Bottom", Y_HOME, False), ("Top", -Y_HOME, True)):
        P["Ring Slider " + tag] = ("cf", "ring" + tag[0], carriage(cy, flip), [cw(circle(cy, RI))], 0.5, 0.5, WMIN - 0.3, WT0 + 0.3, WT1, 2)
        P["Ring Liner " + tag] = ("si", "ring" + tag[0], ccw(circle(cy, LO)), [cw(circle(cy, LI))], 0.3, 0.6, WMIN - 0.6, WT0 + 0.6, WT1, 2)
    return P
