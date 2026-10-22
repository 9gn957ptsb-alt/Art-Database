# UNPUENTE's bridge (Paolini Arquitectos, Calamuchita, Argentina), for the
# Artist Website's model docs/v2/models/balance-and-permanence-unpuente-by-paolini-arquitectos.json:
# the steel-grating deck and timber-slat parapets that cross from the street
# (north) to the door as a long S, seen straight down in the article's
# overhead photograph. The house itself is ordinary parts; only this ribbon
# needs a mesh. Run as build_model code (clean: true) in the Trimble SketchUp
# connector; see README.md. Inches; X east, Y north, Z up. Written in the
# site's metres with y running SOUTH (the model's axes), turned into
# SketchUp's by P().
#
# Where it goes (the model's frame, 0,0 the middle of the site): the street
# edge at y = -28.5 and the door at y = -3.5. In the photograph the deck
# runs straight along the east side of the lawn, swings west between the
# stone wings (the west wing's east face is x = -1.5, the east wing's west
# face x = 3) and bows back toward the door. 1.2 m clear between parapets,
# 2.2 m over all, at street level (z 3.0 to 3.25). The parapets are 1.1 m of
# timber slats; drawn here as solid walls 0.5 m thick because the site
# draws at 0.5 m a voxel and a thinner wall would fall between its columns.
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
    """A closed group from metre vertices and triangles."""
    g = Group(); ents.add_group(g); g.set_name(name)
    geom = GeometryInput()
    geom.set_vertices([P(*v) for v in verts])
    for (a, b, c) in tris:
        lp = LoopInput(); lp.add_vertex_index(a); lp.add_vertex_index(b); lp.add_vertex_index(c)
        _, geom = geom.add_face(lp)
    g.get_entities().fill(geom, weld_vertices=True)
    for f in g.get_entities().get_faces():
        f.set_front_material(m); f.set_back_material(m)
    return g


# The deck's centre line: x as a smooth function of y (south), through these.
KNOTS = [(-28.5, 4.0), (-24.0, 4.0), (-20.0, 3.2), (-17.0, 1.8), (-14.0, 0.8),
         (-11.5, 0.0), (-9.0, -0.2), (-6.5, 0.5), (-3.5, 1.6)]


def centre(y):
    for i in range(len(KNOTS) - 1):
        y0, x0 = KNOTS[i]
        y1, x1 = KNOTS[i + 1]
        if y <= y1 or i == len(KNOTS) - 2:
            def slope(k):
                if k == 0:
                    return 0.0
                if k == len(KNOTS) - 1:
                    return 0.0
                return (KNOTS[k + 1][1] - KNOTS[k - 1][1]) / (KNOTS[k + 1][0] - KNOTS[k - 1][0])
            h = y1 - y0
            t = (y - y0) / h
            m0, m1 = slope(i) * h, slope(i + 1) * h
            h00, h10 = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t
            h01, h11 = -2 * t ** 3 + 3 * t ** 2, t ** 3 - t ** 2
            return h00 * x0 + h10 * m0 + h01 * x1 + h11 * m1
    return KNOTS[-1][1]


STEP = 0.4
YS = [KNOTS[0][0] + i * STEP for i in range(int((KNOTS[-1][0] - KNOTS[0][0]) / STEP) + 1)]
YS.append(KNOTS[-1][0])


def ribbon(name, a, b, z0, z1, m):
    """A closed solid along the path: its section from lateral offset a to b
    (metres, across the path) and height z0 to z1."""
    verts, rings = [], []
    for y in YS:
        dx = (centre(y + 0.05) - centre(y - 0.05)) / 0.1
        ln = math.sqrt(dx * dx + 1)
        nx, ny = 1 / ln, -dx / ln
        x = centre(y)
        k = len(verts)
        for (o, z) in ((a, z0), (b, z0), (b, z1), (a, z1)):
            verts.append((x + o * nx, y + o * ny, z))
        rings.append([k, k + 1, k + 2, k + 3])
    tris = []
    for r0, r1 in zip(rings, rings[1:]):
        for e in range(4):
            f = (e + 1) % 4
            tris += [(r0[e], r0[f], r1[f]), (r0[e], r1[f], r1[e])]
    r = rings[0]
    tris += [(r[0], r[2], r[1]), (r[0], r[3], r[2])]
    r = rings[-1]
    tris += [(r[0], r[1], r[2]), (r[0], r[2], r[3])]
    return tri_group(name, verts, tris, m)


grating = mat("Grating", 118, 116, 112)
slats = mat("Slats", 122, 78, 52)

ribbon("Deck", -0.85, 0.85, 2.95, 3.25, grating)
ribbon("Parapet_west", -1.1, -0.6, 3.0, 4.3, slats)
ribbon("Parapet_east", 0.6, 1.1, 3.0, 4.3, slats)

# True isometric: parallel projection down the (1, -1, -1) diagonal.
d = 60 * M
cam = Camera()
cam.set_orientation(SUPoint3D(d, -d, d), SUPoint3D(0, 0, 0), SUVector3D(0, 0, 1))
cam.enable_perspective(False)
model.set_camera(cam)

bad = [g.get_name() for g in ents.get_groups() if g.compute_volume() is None]
result = {"groups": [g.get_name() for g in ents.get_groups()], "not_solid": bad}
