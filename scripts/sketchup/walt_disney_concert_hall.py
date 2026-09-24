# Walt Disney Concert Hall (Frank Gehry, 2003), for the Gehry tribute on the
# Artist Website. Run as build_model code (clean: true) in the Trimble
# SketchUp connector; see README.md. Inches; X east, Y north, Z up.
M = 1 / 0.0254   # metres -> inches
ents = model.get_entities()


def mat(name, r, g, b, a=255):
    existing = {m.get_name(): m for m in model.get_materials()}
    if name in existing:
        return existing[name]
    m = Material(); m.set_name(name); m.set_color(SUColor(r, g, b, a)); model.add_materials([m])
    return m


def tri_group(name, verts, tris, m):
    """A group from metre vertices and triangles, softened so it reads as one surface."""
    g = Group(); ents.add_group(g); g.set_name(name)
    geom = GeometryInput()
    geom.set_vertices([SUPoint3D(x * M, y * M, z * M) for (x, y, z) in verts])
    for (a, b, c) in tris:
        lp = LoopInput(); lp.add_vertex_index(a); lp.add_vertex_index(b); lp.add_vertex_index(c)
        _, geom = geom.add_face(lp)
    g.get_entities().fill(geom, weld_vertices=True)
    for f in g.get_entities().get_faces():
        f.set_front_material(m); f.set_back_material(m)
    for e in g.get_entities().get_edges():
        if len(e.get_faces()) == 2:
            e.set_soft(True); e.set_smooth(True)
    return g


def box(name, x0, y0, z0, x1, y1, z1, m):
    v = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
         (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]
    t = []
    for a, b, c, d in [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [0, 3, 2, 1]]:
        t += [(a, b, c), (a, c, d)]
    return tri_group(name, v, t, m)


def sail(name, cx, cy, r, a0, a1, z0, h, flare, thick, m, nu=14, nv=8, twist=0.0, bow=0.0):
    """A curved steel petal, closed: an arc in plan (centre cx, cy, radius r,
    angles a0..a1 degrees) rising h from z0, curling outward by `flare` at the
    top (cubic: upright low, turning out high), its top edge rising toward one
    end (`twist`) and bowing up in the middle (`bow`); `thick` inward."""
    verts = []

    def ring(t, rr):
        out = []
        for i in range(nu + 1):
            u = i / nu
            ang = math.radians(a0 + (a1 - a0) * u)
            hz = h * (1 + twist * (u - 0.5) + bow * (1 - (2 * u - 1) ** 2))
            rad = rr + flare * t ** 3
            out.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang), z0 + hz * t))
        return out
    outer = []; inner = []
    for j in range(nv + 1):
        t = j / nv
        s = len(verts); verts += ring(t, r); outer.append(list(range(s, s + nu + 1)))
        s = len(verts); verts += ring(t, r - thick); inner.append(list(range(s, s + nu + 1)))
    tris = []
    for j in range(nv):
        for i in range(nu):
            a, b, c, d = outer[j][i], outer[j][i + 1], outer[j + 1][i + 1], outer[j + 1][i]
            tris += [(a, b, c), (a, c, d)]
            a, b, c, d = inner[j][i], inner[j][i + 1], inner[j + 1][i + 1], inner[j + 1][i]
            tris += [(a, c, b), (a, d, c)]
    for i in range(nu):
        a, b, c, d = outer[0][i], outer[0][i + 1], inner[0][i + 1], inner[0][i]
        tris += [(a, c, b), (a, d, c)]
        a, b, c, d = outer[nv][i], outer[nv][i + 1], inner[nv][i + 1], inner[nv][i]
        tris += [(a, b, c), (a, c, d)]
    for j in range(nv):
        a, b, c, d = outer[j][0], outer[j + 1][0], inner[j + 1][0], inner[j][0]
        tris += [(a, b, c), (a, c, d)]
        a, b, c, d = outer[j][nu], outer[j + 1][nu], inner[j + 1][nu], inner[j][nu]
        tris += [(a, c, b), (a, d, c)]
    return tri_group(name, verts, tris, m)


def roof(name, cx, cy, rx, ry, z, h, m, n=20):
    """A low elliptical dome, closed underneath."""
    verts = []; rings = []
    for (t, s) in [(0, 1.0), (0.5, 0.92), (0.85, 0.7), (1.0, 0.0)]:
        k = len(verts)
        if s == 0:
            verts.append((cx, cy, z + h)); rings.append([k] * n); continue
        for i in range(n):
            a = 2 * math.pi * i / n
            verts.append((cx + rx * s * math.cos(a), cy + ry * s * math.sin(a), z + h * t))
        rings.append(list(range(k, k + n)))
    tris = []
    for q in range(len(rings) - 1):
        for i in range(n):
            i2 = (i + 1) % n
            a, b, c, d = rings[q][i], rings[q][i2], rings[q + 1][i2], rings[q + 1][i]
            tris += [(a, b, c)] if c == d else [(a, b, c), (a, c, d)]
    cb = len(verts); verts.append((cx, cy, z))
    for i in range(n):
        tris.append((cb, rings[0][(i + 1) % n], rings[0][i]))
    return tri_group(name, verts, tris, m)


steel = mat("Stainless", 176, 180, 186)
shade = mat("Steel_shade", 150, 154, 162)
glass = mat("Glass", 110, 140, 160, 140)
lime = mat("Limestone", 214, 202, 180)

P = 6.0   # podium, metres
box("Podium", -50, -40, 0, 50, 40, P, lime)
box("Lobby_glass", -24, -24, P, 20, -8, P + 7, glass)
for k in range(4):   # the broad stair down the podium's east side
    box("Stair_%d" % k, 50, -34, 0, 50 + (4 - k) * 1.5, -8, P * (4 - k) / 5, lime)
roof("Hall_roof", 0, 10, 20, 17, P, 26, shade)

# The petals round the hall, from the back clockwise:
# (name, centre x, centre y, radius, from, to angle, base, height, flare, twist, bow)
for (nm, cx, cy, r, a0, a1, z0, h, fl, tw, bw) in [
    ("Sail_back_W",   -4, 12, 21,  95, 150, P, 40,  5,  0.20, 0.10),
    ("Sail_back_E",    5, 13, 20,  45, 100, P, 36,  6, -0.25, 0.10),
    ("Sail_back_mid",  0, 10, 23,  70, 115, P, 30,  8,  0.10, 0.15),
    ("Sail_W_hi",     -8,  8, 19, 140, 195, P, 30,  7,  0.30, 0.05),
    ("Sail_W_lo",    -10,  4, 22, 165, 225, P, 20, 10,  0.40, 0.00),
    ("Sail_E_hi",      8, 10, 18,   0,  55, P, 28,  8, -0.30, 0.05),
    ("Sail_E_lo",     10,  6, 21, -35,  15, P, 20,  9,  0.35, 0.00),
    ("Sail_front_W",  -6,  2, 24, 205, 250, P + 3, 17, 11,  0.45, 0.10),
    ("Sail_front_mid", 2,  2, 25, 240, 285, P + 2, 22, 10, -0.30, 0.10),
    ("Sail_front_E",   8,  4, 22, 275, 325, P + 2, 18, 11,  0.40, 0.05),
]:
    sail(nm, cx, cy, r, a0, a1, z0, h, fl, 0.9, steel, twist=tw, bow=bw)

# The drum at the entrance corner: a petal curled into a ring, and its cap.
sail("Drum_shell", 30, -15, 9, -170, 150, P, 17, 3, 0.9, steel, nu=20, twist=0.25, bow=0.1)
roof("Drum_cap", 30, -15, 9, 9, P + 15, 3, shade, n=16)

# True isometric: parallel projection down the (1, -1, -1) diagonal.
d = 250 * M
cam = Camera()
cam.set_orientation(SUPoint3D(d, -d, d), SUPoint3D(0, 0, 0), SUVector3D(0, 0, 1))
cam.enable_perspective(False)
model.set_camera(cam)

result = {"groups": [g.get_name() for g in ents.get_groups()]}
