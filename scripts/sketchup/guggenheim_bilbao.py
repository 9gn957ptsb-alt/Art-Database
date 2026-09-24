# Guggenheim Museum Bilbao (Frank Gehry, 1997), the titanium only, for the
# Artist Website's model docs/v2/models/museum-guggenheim-museum-bilbao.json
# (whose limestone blocks, glass, river, bridge and plaza are ordinary parts).
# Run as build_model code (clean: true) in the Trimble SketchUp connector; see
# README.md. Inches; X east, Y north, Z up. Written in the site's metres with
# y running SOUTH (the model's axes), turned into SketchUp's by P().
#
# Where the forms are (the museum's own figures and the plan): the atrium,
# 50 m high, a bundle of curving titanium volumes round a glass-walled core
# facing the Nervión (north); the galleries round it as lobes; the 130 m
# "fish" gallery running east along the river under La Salve bridge to the
# tower. Every surface is a loft of rounded rings that swell, drift and turn
# as they rise — the way Gehry's CATIA surfaces lean and twist.
M = 1 / 0.0254   # metres -> inches
ents = model.get_entities()


def P(x, y, z):
    return SUPoint3D(x * M, -y * M, z * M)


def mat(name, r, g, b, a=255):
    existing = {m.get_name(): m for m in model.get_materials()}
    if name in existing:
        return existing[name]
    m = Material(); m.set_name(name); m.set_color(SUColor(r, g, b, a)); model.add_materials([m])
    return m


def tri_group(name, verts, tris, m):
    """A closed group from metre vertices and triangles, softened to one surface."""
    g = Group(); ents.add_group(g); g.set_name(name)
    geom = GeometryInput()
    geom.set_vertices([P(*v) for v in verts])
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


def ring(cx, cy, rx, ry, rot, z, n, p=2.6):
    """A rounded ring (a superellipse, exponent p) turned rot degrees."""
    out = []
    c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
    for i in range(n):
        a = 2 * math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        x = rx * (abs(ca) ** (2 / p)) * (1 if ca >= 0 else -1)
        y = ry * (abs(sa) ** (2 / p)) * (1 if sa >= 0 else -1)
        out.append((cx + x * c - y * s, cy + x * s + y * c, z))
    return out


def loft(name, sections, m, n=28, p=2.6):
    """A closed solid through rings bottom to top: sections are
    (cx, cy, rx, ry, rot, z). Flat cap below, a fan to the last ring's
    centre on top."""
    verts, rings = [], []
    for (cx, cy, rx, ry, rot, z) in sections:
        k = len(verts)
        verts += ring(cx, cy, rx, ry, rot, z, n, p)
        rings.append(list(range(k, k + n)))
    tris = []
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            tris += [(a[i], a[j], b[j]), (a[i], b[j], b[i])]
    for cap, top in ((rings[0], False), (rings[-1], True)):
        cx = sum(verts[i][0] for i in cap) / n
        cy = sum(verts[i][1] for i in cap) / n
        cz = verts[cap[0]][2]
        c = len(verts); verts.append((cx, cy, cz))
        for i in range(n):
            j = (i + 1) % n
            tris.append((cap[i], cap[j], c) if top else (cap[j], cap[i], c))
    return tri_group(name, verts, tris, m)


def petal(name, cx, cy, r, a0, a1, z0, h, flare, thick, m, nu=14, nv=8, twist=0.0):
    """A curling titanium sheet round (cx, cy): an arc in plan rising h,
    turning outward by `flare` toward the top, its top edge rising toward one
    end by `twist`. Closed, `thick` inward. (After the Disney Hall sails.)"""
    verts, outer, inner = [], [], []

    def row(t, rr):
        pts = []
        for i in range(nu + 1):
            u = i / nu
            ang = math.radians(a0 + (a1 - a0) * u)
            hz = h * (1 + twist * (u - 0.5))
            rad = rr + flare * t ** 2.5
            pts.append((cx + rad * math.cos(ang), cy + rad * math.sin(ang), z0 + hz * t))
        return pts
    for j in range(nv + 1):
        t = j / nv
        s = len(verts); verts += row(t, r); outer.append(list(range(s, s + nu + 1)))
        s = len(verts); verts += row(t, r - thick); inner.append(list(range(s, s + nu + 1)))
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


ti = mat("Titanium", 196, 198, 204)
ti_dark = mat("Titanium_shade", 160, 164, 172)
glass = mat("Glass", 110, 140, 160, 140)

AX, AY = -50, -30
# The atrium: the tallest bundle, swelling, leaning north over the glass wall
# and turning as it rises, its top blunt at about 50 m, the glass crown on it.
loft("Atrium_core", [(AX, AY, 15, 13, 0, 0), (AX - 1, AY - 1, 17, 14, 10, 16),
                     (AX - 3, AY - 3, 16, 13, 24, 32), (AX - 5, AY - 5, 13, 10, 38, 44),
                     (AX - 6, AY - 6, 9, 7, 48, 50)], ti, p=3.4)
loft("Atrium_crown", [(AX - 6, AY - 6, 8, 6, 48, 50), (AX - 7, AY - 7, 7, 5, 54, 53),
                      (AX - 8, AY - 8, 3, 2, 60, 55)], glass, n=20)

# Sails round the atrium, curling outward, tallest on the river side.
for (nm, a0, a1, r, h, fl, tw) in [
    ("Sail_N",   -135, -75, 18, 48, 10,  0.30),
    ("Sail_NE",   -80, -25, 17, 42, 11, -0.35),
    ("Sail_E",    -30,  25, 19, 34, 12,  0.40),
    ("Sail_SE",    20,  75, 20, 30, 13, -0.30),
    ("Sail_S",     70, 125, 19, 38, 11,  0.35),
    ("Sail_SW",   120, 175, 20, 33, 13, -0.40),
    ("Sail_W",    170, 230, 18, 42, 11,  0.30),
]:
    petal(nm, AX, AY, r, a0, a1, 0, h, fl, 1.2, ti_dark if h < 34 else ti, twist=tw)

# The galleries round the atrium: leaning, twisting volumes with rolled,
# blunt tops — boxier than pebbles (exponent 4), each turning as it rises.
loft("Gallery_pool", [(-78, -30, 12, 19, -10, 0), (-80, -32, 13, 20, -2, 10),
                      (-83, -35, 12, 18, 10, 18), (-85, -37, 9, 14, 20, 23)], ti, p=4)
loft("Gallery_river", [(-26, -42, 13, 14, 20, 0), (-28, -45, 14, 15, 30, 12),
                       (-31, -48, 12, 13, 44, 24), (-33, -50, 8, 9, 54, 30)], ti, p=4)
loft("Gallery_city", [(-66, -4, 14, 10, -20, 0), (-68, -2, 15, 11, -10, 12),
                      (-70, 0, 13, 9, 4, 21), (-71, 1, 9, 6, 14, 26)], ti_dark, p=4)
loft("Gallery_east", [(-24, -12, 18, 13, 10, 0), (-22, -14, 19, 13, 16, 11),
                      (-19, -17, 16, 11, 28, 21), (-17, -19, 11, 8, 38, 27)], ti, p=4)

# The fish: the long gallery east along the river, walls upright, its roof
# rolling over, then the tail swelling up under La Salve bridge.
loft("Fish_gallery", [(38, -30, 50, 14, 0, 0), (38, -30, 50, 14, 0, 9),
                      (37, -31, 48, 13, -2, 15), (35, -32, 42, 10, -3, 20),
                      (32, -33, 30, 7, -4, 23)], ti, n=40, p=5)
loft("Fish_tail", [(92, -32, 11, 12, 0, 0), (93, -34, 12, 13, 14, 11),
                   (95, -36, 11, 11, 32, 21), (97, -37, 7, 7, 50, 28)], ti, p=4)
loft("Fish_fin", [(10, -26, 16, 8, 8, 12), (8, -27, 15, 7, 16, 21),
                  (6, -28, 10, 5, 26, 28)], ti_dark, p=4)

# The tower's titanium cap at the end of the gallery.
loft("Tower_cap", [(114, -20, 7, 7, 0, 40), (114, -20, 7.5, 7.5, 20, 43),
                   (113, -21, 4, 4, 45, 47)], ti, p=4)

# True isometric: parallel projection down the (1, -1, -1) diagonal.
d = 400 * M
cam = Camera()
cam.set_orientation(SUPoint3D(d, -d, d), SUPoint3D(0, 0, 0), SUVector3D(0, 0, 1))
cam.enable_perspective(False)
model.set_camera(cam)

bad = [g.get_name() for g in ents.get_groups() if g.compute_volume() is None]
result = {"groups": [g.get_name() for g in ents.get_groups()], "not_solid": bad}
