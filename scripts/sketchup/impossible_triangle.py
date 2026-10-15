# The impossible triangle of three tribars round an inverted gap (the artist's
# drawing, 15 Oct 2026), built as a real object: six square bars on the edges
# of a cube lattice, which close into the drawing only when seen down the
# (1, 1, 1) diagonal in parallel projection. It is Rocket's building block
# (docs/worlds/rocket/, FIGURE in rocket.js): one block, 40 in across.
# Run as build_model code (clean: true) in the Trimble SketchUp connector; see
# README.md. Inches; X east, Y north, Z up.
#
# The lattice cell is 18 in and the bars 4 in square (half a bar, 2 in, is
# 0.11 of a cell, the drawing's proportion). Three long bars, one along each
# axis, run the block's whole width and make the outer frame; three short ones
# make the pinwheel inside. Where bars meet, one runs through and the other
# stops at its face, so no two solids overlap. A bar's faces take the drawing's
# tones by the axis they face: X grey, Y black, Z white.

ents = model.get_entities()
S, H = 18.0, 2.0
SIZE = 2 * S + 2 * H                     # 40 in

BARS = [   # name, part, (x0, y0, z0), (x1, y1, z1)
    ("Frame_Y", "Outer frame", (18, 0, 18), (22, 40, 22)),
    ("Frame_X", "Outer frame", (0, 18, 0), (40, 22, 4)),
    ("Frame_Z", "Outer frame", (36, 18, 4), (40, 22, 40)),
    ("Inner_X", "Inner bars", (22, 18, 18), (36, 22, 22)),
    ("Inner_Z", "Inner bars", (18, 18, 4), (22, 22, 18)),
    ("Inner_Y", "Inner bars", (36, 22, 18), (40, 40, 22)),
]


def get_or_create_material(name, r, g, b, a=255):
    existing = {m.get_name(): m for m in model.get_materials()}
    if name in existing:
        return existing[name]
    mat = Material(); mat.set_name(name); mat.set_color(SUColor(r, g, b, a)); model.add_materials([mat])
    return mat


TONE = [get_or_create_material("Tone_X_grey", 128, 128, 128),
        get_or_create_material("Tone_Y_black", 0, 0, 0),
        get_or_create_material("Tone_Z_white", 255, 255, 255)]


def make_quad_box(w, d, h):
    geom = GeometryInput()
    geom.set_vertices([SUPoint3D(0, 0, 0), SUPoint3D(w, 0, 0), SUPoint3D(w, d, 0), SUPoint3D(0, d, 0),
                       SUPoint3D(0, 0, h), SUPoint3D(w, 0, h), SUPoint3D(w, d, h), SUPoint3D(0, d, h)])
    for fv in [[0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7], [0, 3, 2, 1]]:
        loop = LoopInput()
        for i in fv:
            loop.add_vertex_index(i)
        _, geom = geom.add_face(loop)
    return geom


def translate(x, y, z):
    return SUTransformation([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1])


# Impossible triangle > Outer frame, Inner bars > six bars (leaf solids).
figure = Group(); ents.add_group(figure); figure.set_name("Impossible triangle")
parts = {}
for name, part, lo, hi in BARS:
    if part not in parts:
        g = Group(); figure.get_entities().add_group(g); g.set_name(part); parts[part] = g
    bar = Group(); parts[part].get_entities().add_group(bar); bar.set_name(name)
    bar.get_entities().fill(make_quad_box(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]), weld_vertices=True)
    bar.set_transform(translate(*lo))
    for f in bar.get_entities().get_faces():
        n = f.get_normal()
        a = [abs(n.x), abs(n.y), abs(n.z)]
        m = TONE[a.index(max(a))]
        f.set_front_material(m); f.set_back_material(m)


# Every bar a closed, outward solid.
def check(bar):
    ents_ = bar.get_entities()
    ok = bar.compute_volume() is not None
    for e in ents_.get_edges():
        fs = e.get_faces()
        if len(fs) != 2 or e.is_reversed_in_face(fs[0]) == e.is_reversed_in_face(fs[1]):
            ok = False
    signed = 0.0
    for f in ents_.get_faces():
        n = f.get_normal(); vs = f.get_vertices()
        c = [sum(v.get_position().x for v in vs) / len(vs), sum(v.get_position().y for v in vs) / len(vs),
             sum(v.get_position().z for v in vs) / len(vs)]
        signed += f.get_area() * (n.x * c[0] + n.y * c[1] + n.z * c[2])
    if signed < 0:
        for f in ents_.get_faces():
            f.reverse()
    return ok, bar.compute_volume()


solids = {}
for g in parts.values():
    for bar in g.get_entities().get_groups():
        solids[bar.get_name()] = check(bar)

# The look of the drawing: flat tones (no sun on the faces), black lines, paper.
ro = model.get_rendering_options(); si = model.get_shadow_info()
for k, v in [("RENDER_MODE", TypedValue(int_value=2)), ("EDGE_DISPLAY_MODE", TypedValue(int_value=1)),
             ("EDGE_COLOR_MODE", TypedValue(int_value=0)), ("FOREGROUND_COLOR", TypedValue(color_value=SUColor(0, 0, 0, 255))),
             ("DRAW_SILHOUETTES", TypedValue(bool_value=True)), ("SILHOUETTE_WIDTH", TypedValue(int_value=2)),
             ("DRAW_DEPTH_QUE", TypedValue(bool_value=False)), ("DRAW_HORIZON", TypedValue(bool_value=False)),
             ("DRAW_GROUND", TypedValue(bool_value=False)), ("DISPLAY_SKETCH_AXES", TypedValue(bool_value=False)),
             ("BACKGROUND_COLOR", TypedValue(color_value=SUColor(240, 236, 228, 255))),
             ("MODEL_TRANSPARENCY", TypedValue(bool_value=False)), ("AMBIENT_OCCLUSION", TypedValue(bool_value=False)),
             ("HIGHLIGHT_COLOR", TypedValue(color_value=SUColor(0, 1, 255, 255))),
             ("LOCKED_COLOR", TypedValue(color_value=SUColor(255, 0, 0, 255)))]:
    ro[RenderingOptionKey[k]] = v
for k, v in [("DISPLAY_SHADOWS", TypedValue(bool_value=False)), ("USE_SUN_FOR_ALL_SHADING", TypedValue(bool_value=True)),
             ("LIGHT", TypedValue(int_value=0)), ("DARK", TypedValue(int_value=100))]:
    si[ShadowInfoKey[k]] = v
model.get_styles().get_active_style().set_name("The drawing")


def norm(v):
    l = math.sqrt(sum(c * c for c in v))
    return [c / l for c in v]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


# The drawing: parallel projection down the (1, 1, 1) diagonal, the camera
# rolled so the triangle stands on its base as drawn (image up is (0, -1, 1)).
# Its three corners are the lattice points (0,0,0)=(1,1,1), (0,2,0)=(-1,1,-1)
# and (1,1,-1); the target is their middle, so the triangle sits centred.
D = 400.0
target = (26.0, 20.0, 14.0)
f = norm([-1, -1, -1])
eye = [target[i] - D * f[i] for i in range(3)]
up = norm([0, -1, 1])
drawing = Camera()
drawing.set_orientation(SUPoint3D(*eye), SUPoint3D(*target), SUVector3D(*up))
drawing.enable_perspective(False)
drawing.set_orthographic_frustum_height(46.0)

# Turned: a three-quarter view from the south-east, Z up, where the bars show
# they never meet.
turn = norm([1.0, -0.62, 0.5])
centre = (SIZE / 2, SIZE / 2, SIZE / 2)
dist = 150.0
turned = Camera()
turned.set_orientation(SUPoint3D(*[centre[i] + dist * turn[i] for i in range(3)]), SUPoint3D(*centre), SUVector3D(0, 0, 1))
turned.enable_perspective(True)
turned.set_perspective_frustum_fov(30.0)

scenes = []
for nm in ["The drawing", "Turned"]:
    sc = Scene(); sc.set_name(nm); scenes.append(sc)
model.add_scenes(scenes)
for sc, cam in zip(scenes, [drawing, turned]):
    sc.set_use_camera(True); sc.set_camera(cam); sc.set_use_hidden_layers(False)
model.set_active_scene(scenes[0])

opening = Camera()
opening.set_orientation(SUPoint3D(*eye), SUPoint3D(*target), SUVector3D(*up))
opening.enable_perspective(False)
opening.set_orthographic_frustum_height(46.0)
model.set_camera(opening)

# Handedness: in the drawing the grey side (Frame_Z, the post) is on the left
# and the white-topped side (Frame_Y) on the right. Image-right is f x up for
# this rolled camera.
o = model.get_camera().get_orientation()
fw = norm([o[1].x - o[0].x, o[1].y - o[0].y, o[1].z - o[0].z])
right = cross(fw, [o[2].x, o[2].y, o[2].z])
post, side = (38.0, 20.0, 22.0), (20.0, 20.0, 20.0)
dot = sum((post[i] - side[i]) * right[i] for i in range(3))
chirality = {"post_vs_side_dot": dot, "verdict": "LEFT" if dot < 0 else "RIGHT", "ok": dot < 0}

result = {
    "solids": solids,
    "chirality": chirality,
    "camera": {"eye": [o[0].x, o[0].y, o[0].z], "target": [o[1].x, o[1].y, o[1].z], "up": [o[2].x, o[2].y, o[2].z],
               "perspective": model.get_camera().is_perspective(),
               "ortho_height": model.get_camera().get_orthographic_frustum_height()},
    "scenes": [(sc.get_name(), sc.get_use_camera(), sc.get_camera().is_perspective()) for sc in scenes],
}
