# Studies of the artist's impossible triangle in 3D (artist, 15 Oct 2026: "Use the shape with itself to
# actually realize its 3D potential ... It's okay if all doesn't connect to itself. Explore different
# ways it can exist 3D"), in a row, each with the scene where it closes. The same ten as
# scripts/figure_studies.py (which writes them for the site and the game, and says what each is), built
# by the same rules; run as build_model code (clean: true) in the Trimble SketchUp connector, see README.md.
# Inches, X east, Y north, Z up. A cell of the lattice is 18 in and the beams 4 in square, as in
# impossible_triangle.py. Each study is a group of parts (tribars, copies, storeys), each part a group of
# beams, each beam a solid; the faces take the drawing's tones by the axis they face (X grey, Y black,
# Z white), as a light would give them, and a face turned off the axes (stretched, sheared, bent) keeps
# the tone it had in the figure.

CELL, H = 18.0, 0.11
ORDERS = [(1, 0, 2), (0, 2, 1), (2, 1, 0)]
OFFS = [[0, 0, 0], [0, 1, 0], [1, 1, 0]]
BASE = [[0, 0, 0], [0, 1, 0], [1, 1, 0]]
CONF = [(0, 0.0), (1, -1.0), (1, -1.0)]
R3, R2 = math.sqrt(3), math.sqrt(2)
NH = [1 / R3, 1 / R3, 1 / R3]                   # the line of sight, towards the eye
UPV = [0, -1 / R2, 1 / R2]                      # the drawing's up
CENTRE = [1 / 3, 1, -1 / 3]                     # the middle of the drawn triangle's corners
I3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]]
L = [I3, [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]]]


def add(a, b): return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
def sub(a, b): return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
def mul(a, s): return [a[0] * s, a[1] * s, a[2] * s]
def dot(a, b): return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
def cross(a, b): return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
def norm(a): l = math.sqrt(dot(a, a)); return [a[0] / l, a[1] / l, a[2] / l]
def apply(M, v): return [dot(M[0], v), dot(M[1], v), dot(M[2], v)]


RV = cross(mul(NH, -1), UPV)                    # the drawing's right


def box(c, E, tone=(0, 1, 2), part=""):
    return {"c": list(c), "E": [list(e) for e in E], "tone": list(tone), "part": part}


def aabb(lo, hi, part=""):
    return box(mul(add(lo, hi), 0.5), [[(hi[0] - lo[0]) / 2, 0, 0], [0, (hi[1] - lo[1]) / 2, 0], [0, 0, (hi[2] - lo[2]) / 2]], (0, 1, 2), part)


def moved(b, M=I3, t=(0, 0, 0), about=(0, 0, 0), part=None):
    """p -> M (p - about) + about + t; a pair of faces that faces a world axis afterwards takes its tone."""
    c = add(add(apply(M, sub(b["c"], about)), about), t)
    E = [apply(M, e) for e in b["E"]]
    tone = []
    for k in range(3):
        n = norm(cross(E[(k + 1) % 3], E[(k + 2) % 3]))
        j = max(range(3), key=lambda q: abs(n[q]))
        tone.append(j if abs(n[j]) > 0.999 else b["tone"][k])
    return box(c, E, tone, b["part"] if part is None else part)


def corners(b):
    if "P" in b:
        return b["P"]
    return [add(b["c"], add(add(mul(b["E"][0], sx), mul(b["E"][1], sy)), mul(b["E"][2], sz)))
            for sx in (-1, 1) for sy in (-1, 1) for sz in (-1, 1)]


def drawn_in(bs, eye, Fw, Uw, f, g, beta):
    """The beams as the drawing seen from one eye, in perspective: a point at (a, b) in the drawing and d along
    its line of sight goes to eye + (g (a R + b U) + f F) / (1 + beta d), on its ray from the eye, nearer for the
    nearer. Each beam keeps its eight corners (in the order corners() gives them) and its faces stay planes."""
    Fw = norm(Fw); Uw = norm(sub(Uw, mul(Fw, dot(Uw, Fw)))); Rw = cross(Fw, Uw)
    out = []
    for b in bs:
        P = []
        for p in corners(b):
            q = sub(p, CENTRE); a, bb, d = dot(q, RV), dot(q, UPV), dot(q, NH)
            P.append(add(eye, mul(add(add(mul(Rw, g * a), mul(Uw, g * bb)), mul(Fw, f)), 1.0 / (1 + beta * d))))
        out.append({"P": P, "tone": list(b["tone"]), "part": b["part"]})
    return out


def tribar(c, r, part=""):
    out, p = [], add(c, OFFS[r])
    for ax in ORDERS[r]:
        q = list(p); q[ax] += 1
        out.append(aabb([min(p[k], q[k]) - H for k in range(3)], [max(p[k], q[k]) + H for k in range(3)], part))
        p = q
    return out


def figure(conf=CONF, names="ABC"):
    return [b for (r, t), base, nm in zip(conf, BASE, names) for b in tribar(add(base, [t, t, t]), r, nm)]


def level(k):
    shape = tribar([0, 0, 0], 0)
    for j in range(1, k):
        s = 2 ** (j - 1)
        shape = [moved(b, L[r], t=mul(add(add(BASE[i], [t, t, t]), OFFS[r]), s)) for i, (r, t) in enumerate(CONF) for b in shape]
    return shape


def extent(bs, pts=()):
    ps = [p for b in bs for p in corners(b)] + list(pts)
    return [min(p[k] for p in ps) for k in range(3)], [max(p[k] for p in ps) for k in range(3)]


def framed(view, bs, pts):
    """An ortho view's centre and span from the study's own points, unless it names them."""
    kind, d, up, c, span = view
    if c is not None:
        return view
    d = norm(mul(d, -1))
    u = norm(sub(up, mul(d, dot(up, d))))
    r = cross(mul(d, -1), u)
    ps = [p for b in bs for p in corners(b)] + list(pts)
    m = mul([sum(p[k] for p in ps) for k in range(3)], 1.0 / len(ps))
    a = [dot(sub(p, m), r) for p in ps]; v = [dot(sub(p, m), u) for p in ps]
    c = add(add(m, mul(r, (min(a) + max(a)) / 2)), mul(u, (min(v) + max(v)) / 2))
    return (kind, view[1], up, c, 1.1 * max(max(a) - min(a), max(v) - min(v)))


def strut(p, q, w):
    a = mul(sub(q, p), 0.5)
    u = mul(norm(cross(a, [1, -1, 0])), w)
    v = mul(norm(cross(a, u)), w)
    return box(mul(add(p, q), 0.5), [a, u, v], (2, 2, 2), "Struts")


def quarter(k):
    c, s = round(math.cos(k * math.pi / 2)), round(math.sin(k * math.pi / 2))
    return [[c, -s, 0], [s, c, 0], [0, 0, 1]]


def bend(p):
    q = sub(p, CENTRE)
    a, b = dot(q, RV), dot(q, UPV)
    return add(p, mul(NH, 1.6 * a * a - 0.9 * b))


DIAG = ("ortho", [-1, -1, -1], [0, -1, 1], None, None)
F = figure()
STUDIES = []
STUDIES.append(("The figure", F, [], [DIAG]))
STUDIES.append(("Apart", [moved(b, t=mul([1, 1, 1], {"A": 0, "B": 2, "C": -2}[b["part"]])) for b in F], [], [DIAG]))
STUDIES.append(("Closed", F + [strut([0, 0, 0], [1, 1, 1], 0.8 * H), strut([-1, 1, -1], [0, 2, 0], 0.8 * H), strut([0, 1, -1], [1, 2, 0], 0.8 * H)], [], [DIAG]))
l3 = level(3)
STUDIES.append(("Figure of figures", [moved(b, part=["First figure", "Second figure", "Third figure"][i // 9]) for i, b in enumerate(l3)], [], [DIAG]))
STUDIES.append(("Three turns", [moved(b, part="The figure") for b in F] + [moved(b, L[1], about=CENTRE, part="Turned a third") for b in F] +
                [moved(b, L[2], about=CENTRE, part="Turned two thirds") for b in F], [], [DIAG]))
# The storeys turn about an upright in the middle of a cell, not on a beam: about a beam, the uprights of
# the storey below would line up with this one's from three of the corners and draw its legs on past their ends.
UPRIGHT = [0.5, 0.5, 0]
tower, tviews = [], []
for k, nm in enumerate(["Ground storey", "Second storey", "Third storey", "Top storey"]):
    M, rise = quarter(k), [0, 0, 3.2 * k]
    storey = [moved(b, M, t=rise, about=UPRIGHT, part=nm) for b in F]
    tower += storey
    tviews.append(framed(("ortho", apply(M, [-1, -1, -1]), apply(M, [0, -1, 1]), None, None), storey, [])[:4] + (3.0,))
STUDIES.append(("Tower", tower, [], tviews))
ST = [[I3[i][j] + 3 * NH[i] * NH[j] for j in range(3)] for i in range(3)]
STUDIES.append(("Drawn out", [moved(b, ST, about=CENTRE) for b in F], [], [DIAG]))
lofts = []
for b in F:
    k = max(range(3), key=lambda q: dot(b["E"][q], b["E"][q]))
    i, j = [a for a in range(3) if a != k]
    stations = [[bend(add(add(add(b["c"], mul(b["E"][k], -1 + 2 * m / 16.0)), mul(b["E"][i], x)), mul(b["E"][j], y)))
                 for (x, y) in ((-1, -1), (1, -1), (1, 1), (-1, 1))] for m in range(17)]
    lofts.append((stations, [b["tone"][j], b["tone"][i], b["tone"][k]], b["part"]))
STUDIES.append(("Bent", [], lofts, [DIAG]))
EYE = add(CENTRE, mul(NH, 9.0))
STUDIES.append(("One point", drawn_in(F, EYE, mul(NH, -1), UPV, 9.0, 1.0, 0.3), [], [("persp", EYE, CENTRE, [0, -1, 1], 26)]))
sib = []
for k, (conf, nm) in enumerate(zip([[(0, 0.0), (1, -1), (1, -1)], [(0, 0.0), (2, -1), (1, -1)], [(0, 0.0), (2, -1), (2, -1)]], ["First", "Second", "Third"])):
    sib += [moved(b, t=mul([-2, 1, 1], (k - 1) * 1.55), part=nm) for b in figure(conf)]
STUDIES.append(("Siblings", sib, [], [DIAG]))


# ---- in SketchUp ----------------------------------------------------------------------------------

ents = model.get_entities()


def get_or_create_material(name, r, g, b, a=255):
    existing = {m.get_name(): m for m in model.get_materials()}
    if name in existing:
        return existing[name]
    mat = Material(); mat.set_name(name); mat.set_color(SUColor(r, g, b, a)); model.add_materials([mat])
    return mat


TONE = [get_or_create_material("Tone_X_grey", 128, 128, 128), get_or_create_material("Tone_Y_black", 0, 0, 0),
        get_or_create_material("Tone_Z_white", 255, 255, 255)]
SIGNS = [(-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1)]
QUADS = [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [0, 3, 2, 1]]
PAIR = [1, 0, 1, 0, 2, 2]                       # the pair of faces each of QUADS is: y, x, y, x, z, z


def inches(p, off):
    return SUPoint3D(p[0] * CELL + off[0], p[1] * CELL + off[1], p[2] * CELL + off[2])


def solid_beam(parent, name, b, off):
    g = Group(); parent.get_entities().add_group(g); g.set_name(name)
    E = b["E"]
    geom = GeometryInput()
    geom.set_vertices([inches(add(b["c"], add(add(mul(E[0], sx), mul(E[1], sy)), mul(E[2], sz))), off) for (sx, sy, sz) in SIGNS])
    flip = dot(E[0], cross(E[1], E[2])) < 0
    for fv in QUADS:
        loop = LoopInput()
        for i in (list(reversed(fv)) if flip else fv):
            loop.add_vertex_index(i)
        _, geom = geom.add_face(loop)
    g.get_entities().fill(geom, weld_vertices=True)
    normals = [norm(cross(E[(k + 1) % 3], E[(k + 2) % 3])) for k in range(3)]
    for f in g.get_entities().get_faces():
        n = f.get_normal()
        k = max(range(3), key=lambda q: abs(n.x * normals[q][0] + n.y * normals[q][1] + n.z * normals[q][2]))
        m = TONE[b["tone"][k]]
        f.set_front_material(m); f.set_back_material(m)
    return g


def hex_beam(parent, name, b, off):
    """A beam drawn in towards an eye: its eight corners, six plane faces, each in the tone of its pair."""
    g = Group(); parent.get_entities().add_group(g); g.set_name(name)
    C = [b["P"][4 * (sx > 0) + 2 * (sy > 0) + (sz > 0)] for (sx, sy, sz) in SIGNS]
    geom = GeometryInput()
    geom.set_vertices([inches(p, off) for p in C])
    flip = dot(sub(C[1], C[0]), cross(sub(C[3], C[0]), sub(C[4], C[0]))) < 0
    for fv in QUADS:
        loop = LoopInput()
        for i in (list(reversed(fv)) if flip else fv):
            loop.add_vertex_index(i)
        _, geom = geom.add_face(loop)
    g.get_entities().fill(geom, weld_vertices=True)
    centres = [(inches(mul(add(add(C[q[0]], C[q[1]]), add(C[q[2]], C[q[3]])), 0.25), off), PAIR[n]) for n, q in enumerate(QUADS)]
    for f in g.get_entities().get_faces():
        vs = [v.get_position() for v in f.get_vertices()]
        cx, cy, cz = sum(v.x for v in vs) / len(vs), sum(v.y for v in vs) / len(vs), sum(v.z for v in vs) / len(vs)
        k = min(centres, key=lambda ct: (ct[0].x - cx) ** 2 + (ct[0].y - cy) ** 2 + (ct[0].z - cz) ** 2)[1]
        m = TONE[b["tone"][k]]
        f.set_front_material(m); f.set_back_material(m)
    return g


def bent_beam(parent, name, stations, tones, off):
    """17 stations of 4 corners: the sides and ends as triangles, softened where they bend, crisp at the corners."""
    g = Group(); parent.get_entities().add_group(g); g.set_name(name)
    pts = [p for st in stations for p in st]
    geom = GeometryInput(); geom.set_vertices([inches(p, off) for p in pts])
    tris = []
    for m in range(len(stations) - 1):
        for q in range(4):
            a, b, c, d = 4 * m + q, 4 * m + (q + 1) % 4, 4 * (m + 1) + (q + 1) % 4, 4 * (m + 1) + q
            tris += [((a, b, c), tones[0 if q % 2 == 0 else 1]), ((a, c, d), tones[0 if q % 2 == 0 else 1])]
    last = 4 * (len(stations) - 1)
    tris += [((0, 3, 2), tones[2]), ((0, 2, 1), tones[2]), ((last, last + 1, last + 2), tones[2]), ((last, last + 2, last + 3), tones[2])]
    for tri, t in tris:
        loop = LoopInput()
        for i in tri:
            loop.add_vertex_index(i)
        _, geom = geom.add_face(loop)
    g.get_entities().fill(geom, weld_vertices=True)
    # each face's tone: the triangle it is, found by its centre
    centres = []
    for tri, t in tris:
        c = [sum(pts[i][k] for i in tri) / 3.0 for k in range(3)]
        centres.append((inches(c, off), t))
    for f in g.get_entities().get_faces():
        vs = [v.get_position() for v in f.get_vertices()]
        cx, cy, cz = sum(v.x for v in vs) / len(vs), sum(v.y for v in vs) / len(vs), sum(v.z for v in vs) / len(vs)
        t = min(centres, key=lambda ct: (ct[0].x - cx) ** 2 + (ct[0].y - cy) ** 2 + (ct[0].z - cz) ** 2)[1]
        f.set_front_material(TONE[t]); f.set_back_material(TONE[t])
    for e in g.get_entities().get_edges():
        fs = e.get_faces()
        if len(fs) == 2:
            a, b = fs[0].get_normal(), fs[1].get_normal()
            if a.x * b.x + a.y * b.y + a.z * b.z > math.cos(math.radians(30)):
                e.set_soft(True); e.set_smooth(True)
    return g


groups, views, x = [], [], 0.0
for n, (name, bs, lf, vs) in enumerate(STUDIES):
    pts = [p for (st, t, nm) in lf for s in st for p in s]
    lo, hi = extent(bs, pts)
    off = [x - lo[0] * CELL, -(lo[1] + hi[1]) / 2 * CELL, -lo[2] * CELL]
    x += (hi[0] - lo[0]) * CELL + 48
    top = Group(); ents.add_group(top); top.set_name(str(n + 1) + ". " + name)
    parts = {}
    for i, b in enumerate(bs):
        if b["part"] not in parts:
            p = Group(); top.get_entities().add_group(p); p.set_name(b["part"] or "Beams"); parts[b["part"]] = p
        (hex_beam if "P" in b else solid_beam)(parts[b["part"]], (b["part"] or "Beam") + " " + str(i + 1), b, off)
    for i, (st, t, nm) in enumerate(lf):
        if nm not in parts:
            p = Group(); top.get_entities().add_group(p); p.set_name(nm); parts[nm] = p
        bent_beam(parts[nm], nm + " " + str(i + 1), st, t, off)
    groups.append(top)
    views.append([(framed(v, bs, pts), off) for v in vs])

# Every beam a closed solid, its faces outward.
bad = []
for top in groups:
    for p in top.get_entities().get_groups():
        for b in p.get_entities().get_groups():
            if b.compute_volume() is None:
                bad.append(top.get_name() + " / " + b.get_name())
                continue
            signed = 0.0
            for f in b.get_entities().get_faces():
                nn = f.get_normal(); vs = [v.get_position() for v in f.get_vertices()]
                signed += f.get_area() * (nn.x * sum(v.x for v in vs) + nn.y * sum(v.y for v in vs) + nn.z * sum(v.z for v in vs)) / len(vs)
            if signed < 0:
                for f in b.get_entities().get_faces():
                    f.reverse()

# The look of the drawing: flat tones (no sun on the faces), black lines, paper.
ro = model.get_rendering_options(); si = model.get_shadow_info()
for k, v in [("RENDER_MODE", TypedValue(int_value=2)), ("EDGE_DISPLAY_MODE", TypedValue(int_value=1)),
             ("EDGE_COLOR_MODE", TypedValue(int_value=0)), ("FOREGROUND_COLOR", TypedValue(color_value=SUColor(0, 0, 0, 255))),
             ("DRAW_SILHOUETTES", TypedValue(bool_value=True)), ("SILHOUETTE_WIDTH", TypedValue(int_value=2)),
             ("DRAW_DEPTH_QUE", TypedValue(bool_value=False)), ("DRAW_HORIZON", TypedValue(bool_value=False)),
             ("DRAW_GROUND", TypedValue(bool_value=False)), ("DISPLAY_SKETCH_AXES", TypedValue(bool_value=False)),
             ("BACKGROUND_COLOR", TypedValue(color_value=SUColor(240, 236, 228, 255))),
             ("MODEL_TRANSPARENCY", TypedValue(bool_value=False)), ("AMBIENT_OCCLUSION", TypedValue(bool_value=False)),
             ("HIGHLIGHT_COLOR", TypedValue(color_value=SUColor(0, 1, 255, 255))), ("LOCKED_COLOR", TypedValue(color_value=SUColor(255, 0, 0, 255)))]:
    ro[RenderingOptionKey[k]] = v
for k, v in [("DISPLAY_SHADOWS", TypedValue(bool_value=False)), ("USE_SUN_FOR_ALL_SHADING", TypedValue(bool_value=True)),
             ("LIGHT", TypedValue(int_value=0)), ("DARK", TypedValue(int_value=100))]:
    si[ShadowInfoKey[k]] = v
model.get_styles().get_active_style().set_name("The drawing")


def camera(view, off):
    kind = view[0]
    cam = Camera()
    if kind == "ortho":
        _, d, up, c, span = view
        d = norm(d); c = [c[k] * CELL + off[k] for k in range(3)]
        cam.set_orientation(SUPoint3D(*[c[k] - d[k] * 900 for k in range(3)]), SUPoint3D(*c), SUVector3D(*norm(up)))
        cam.enable_perspective(False); cam.set_orthographic_frustum_height(span * CELL)
    else:
        _, eye, target, up, fov = view
        cam.set_orientation(inches(eye, off), inches(target, off), SUVector3D(*norm(up)))
        cam.enable_perspective(True); cam.set_perspective_frustum_fov(fov)
    return cam


# Where the eye stands for each of the tower's views (it looks down the other way).
CORNER = ["from the north-east", "from the north-west", "from the south-west", "from the south-east"]
bbs = [g.get_bounding_box() for g in groups]
x0, x1 = min(b.min_point[0] for b in bbs), max(b.max_point[0] for b in bbs)
z1 = max(b.max_point[2] for b in bbs)
over = Camera()
over.set_orientation(SUPoint3D((x0 + x1) / 2 + (x1 - x0) * 0.25, -(x1 - x0) * 0.95, z1 * 1.6), SUPoint3D((x0 + x1) / 2, 0, z1 / 3), SUVector3D(0, 0, 1))
over.enable_perspective(True); over.set_perspective_frustum_fov(35)
names, cams = ["All the studies"], [over]
for n, (name, bs, lf, vs) in enumerate(STUDIES):
    for i, (v, off) in enumerate(views[n]):
        names.append(str(n + 1) + ". " + name + ((", " + CORNER[i]) if len(views[n]) > 1 else ""))
        cams.append(camera(v, off))
scenes = []
for nm in names:
    sc = Scene(); sc.set_name(nm); scenes.append(sc)
model.add_scenes(scenes)
for sc, cam in zip(scenes, cams):
    sc.set_use_camera(True); sc.set_camera(cam); sc.set_use_hidden_layers(False)
model.set_active_scene(scenes[0])
model.set_camera(over)

result = {"studies": [g.get_name() for g in groups], "scenes": names, "not_solid": bad[:10],
          "beams": sum(len(p.get_entities().get_groups()) for g in groups for p in g.get_entities().get_groups())}
