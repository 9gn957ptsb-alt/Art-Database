#!/usr/bin/env python3
"""Turn a compiled build plan into the build_model calls that place it in SketchUp.

    python3 residential/tools/engine.py build/<slug>.plan.json OUTDIR [--max-chars 60000]

Writes OUTDIR/00-setup.py, 01-rooms.py ... and 99-finish.py. Run them in order as
build_model code (the first with clean: true), then save_model with filename <slug>.skp.
The setup call carries primitives.py, so SketchUp builds each solid with exactly the code
the compiler checked. Each rooms call reports any solid whose volume is not the volume the
compiler expected.
"""
import ast
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent

GLUE = r'''
IN = 39.37007874015748


def _rdb_mat(name):
    cache = session_state["rdb_matobjs"]
    if name in cache:
        return cache[name]
    for m in model.get_materials():
        if m.get_name() == name:
            cache[name] = m
            return m
    c = session_state["rdb_mattbl"].get(name, [200, 200, 200, 255])
    m = Material()
    m.set_name(name)
    m.set_color(SUColor(c[0], c[1], c[2], c[3]))
    model.add_materials([m])
    cache[name] = m
    return m


def _rdb_layer(name):
    cache = session_state["rdb_layers"]
    if name not in cache:
        lay = Layer()
        lay.set_name(name)
        model.add_layers([lay])
        cache[name] = lay
    return cache[name]


def _rdb_tv(v):
    if isinstance(v, bool):
        return TypedValue(bool_value=v)
    if isinstance(v, int):
        return TypedValue(int_value=v)
    if isinstance(v, float):
        return TypedValue(double_value=v)
    return TypedValue(string_value=str(v))


def _rdb_attrs(g, attrs):
    if not attrs or session_state.get("rdb_attr_ok") is False:
        return
    try:
        d = g.get_attribute_dictionary("residential_db")
        for k in attrs:
            d[k] = _rdb_tv(attrs[k])
        session_state["rdb_attr_ok"] = True
    except Exception:
        session_state["rdb_attr_ok"] = False


def _rdb_group(i):
    gs = session_state["rdb_gobjs"]
    if i in gs:
        return gs[i]
    G = session_state["rdb_groups"][i]
    if G["parent"] is None:
        ents, po = model.get_entities(), [0.0, 0.0, 0.0]
    else:
        ents = _rdb_group(G["parent"]).get_entities()
        po = session_state["rdb_groups"][G["parent"]]["origin"]
    g = Group()
    ents.add_group(g)
    g.set_name(G["path"][-1])
    o = G["origin"]
    t = [(o[k] - po[k]) * IN for k in range(3)]
    if abs(t[0]) + abs(t[1]) + abs(t[2]) > 1e-9:
        g.set_transform(SUTransformation([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, t[0], t[1], t[2], 1]))
    if G.get("tag"):
        g.set_layer(_rdb_layer(G["tag"]))
    _rdb_attrs(g, G.get("attrs"))
    gs[i] = g
    return g


def _rdb_leaf(L):
    V, F = realize(L["k"], L["s"])
    gi = L["g"]
    g = _rdb_group(gi)
    o = session_state["rdb_groups"][gi]["origin"]
    lg = Group()
    g.get_entities().add_group(lg)
    geom = GeometryInput()
    geom.set_vertices([SUPoint3D((p[0] - o[0]) * IN, (p[1] - o[1]) * IN, (p[2] - o[2]) * IN) for p in V])
    for fc in F:
        lp = LoopInput()
        for i in fc[1]:
            lp.add_vertex_index(i)
        fi, geom = geom.add_face(lp)
        for h in fc[2:]:
            il = LoopInput()
            for i in h:
                il.add_vertex_index(i)
            geom = geom.face_add_inner_loop(fi, il)
    lg.get_entities().fill(geom, weld_vertices=True)
    lg.set_name(L["n"])
    if L.get("t"):
        lg.set_layer(_rdb_layer(L["t"]))
    base = _rdb_mat(L["m"])
    special = []
    for fc in F:
        if fc[0] and fc[0] != L["m"]:
            pts = [V[i] for i in fc[1]]
            n = _newell(pts)
            ln = math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2])
            n = (n[0] / ln, n[1] / ln, n[2] / ln)
            p = pts[0]
            off = (n[0] * (p[0] - o[0]) + n[1] * (p[1] - o[1]) + n[2] * (p[2] - o[2])) * IN
            special.append((n, off, fc[0]))
    for face in lg.get_entities().get_faces():
        mat = base
        if special:
            nn = face.get_normal()
            ln = math.sqrt(nn.x * nn.x + nn.y * nn.y + nn.z * nn.z) or 1.0
            q = face.get_vertices()[0].get_position()
            for n, off, mname in special:
                dp = (nn.x * n[0] + nn.y * n[1] + nn.z * n[2]) / ln
                po = (nn.x * q.x + nn.y * q.y + nn.z * q.z) / ln
                if (dp > 0.999 and abs(po - off) < 0.5) or (dp < -0.999 and abs(po + off) < 0.5):
                    mat = _rdb_mat(mname)
                    break
        face.set_front_material(mat)
        face.set_back_material(mat)
    return lg.compute_volume()


def _rdb_run(chunk):
    out = {"ok": 0, "bad": []}
    for L in chunk:
        where = session_state["rdb_groups"][L["g"]]["path"][-1]
        try:
            vol = _rdb_leaf(L)
            exp = L["vol"] * IN ** 3
            if vol is None or abs(vol - exp) > 0.01 * exp + 2.0:
                out["bad"].append([where, L["n"], None if vol is None else round(vol, 1), round(exp, 1)])
            else:
                out["ok"] += 1
        except Exception as e:
            out["bad"].append([where, L["n"], "error", str(e)[:160]])
    return out
'''

SETUP_TAIL = r'''
session_state["rdb_groups"] = GROUPS
session_state["rdb_mattbl"] = MATS
session_state["rdb_matobjs"] = {}
session_state["rdb_layers"] = {}
session_state["rdb_gobjs"] = {}
for _i in range(len(GROUPS)):
    _rdb_group(_i)
for _name in MATS:
    _rdb_mat(_name)
session_state["rdb_run"] = _rdb_run
result = {"groups": len(GROUPS), "materials": len(MATS), "attributes_written": session_state.get("rdb_attr_ok")}
'''

FINISH = r'''
LEVEL_TAGS = %(level_tags)r
BBOX = %(bbox)r
lay = session_state["rdb_layers"]
scenes = []
for name in ["All levels"] + [t.replace("Level · ", "") for t in LEVEL_TAGS]:
    sc = Scene()
    sc.set_name(name)
    scenes.append(sc)
model.add_scenes(scenes)
(xmin, ymin, zmin), (xmax, ymax, zmax) = BBOX
cx, cy = (xmin + xmax) / 2, (ymin + ymax) / 2
w, d, h = xmax - xmin, ymax - ymin, zmax - zmin
fov = 35.0
az, el = math.radians(-50), math.radians(35)
dx, dy, dz = math.cos(az) * math.cos(el), math.sin(az) * math.cos(el), math.sin(el)
rl = math.sqrt(dx * dx + dy * dy)
rx, ry = -dy / rl, dx / rl
ux, uy, uz = -dz * ry, dz * rx, dx * ry - dy * rx
hx = abs(rx) * w + abs(ry) * d
vx = abs(ux) * w + abs(uy) * d + abs(uz) * h
hv = math.radians(fov / 2)
hh = math.atan(1.6 * math.tan(hv))
dist = max((vx / 2) / math.tan(hv), (hx / 2) / math.tan(hh)) * 1.25
eye = SUPoint3D(cx + dist * dx, cy + dist * dy, (zmin + zmax) / 2 + dist * dz)
target = SUPoint3D(cx, cy, zmin + h * 0.4)
for k, sc in enumerate(scenes):
    cam = Camera()
    cam.set_orientation(eye, target, SUVector3D(0, 0, 1))
    cam.enable_perspective()
    cam.set_perspective_frustum_fov(fov)
    sc.set_use_camera(True)
    sc.set_camera(cam)
    if k > 0:
        sc.set_use_hidden_layers(True)
        for j, t in enumerate(LEVEL_TAGS):
            if j != k - 1 and t in lay:
                sc.add_layer(lay[t])
        for t in ("Roofs",):
            if t in lay:
                sc.add_layer(lay[t])
model.set_active_scene(scenes[0])
D = {"EDGE_DISPLAY_MODE": TypedValue(int_value=1), "EDGE_COLOR_MODE": TypedValue(int_value=0),
     "RENDER_MODE": TypedValue(int_value=2), "MODEL_TRANSPARENCY": TypedValue(bool_value=False),
     "MATERIAL_TRANSPARENCY": TypedValue(bool_value=True), "DRAW_DEPTH_QUE": TypedValue(bool_value=False),
     "DRAW_SILHOUETTES": TypedValue(bool_value=True), "SILHOUETTE_WIDTH": TypedValue(int_value=2),
     "DISPLAY_SKETCH_AXES": TypedValue(bool_value=False),
     "HIGHLIGHT_COLOR": TypedValue(color_value=SUColor(0, 1, 255, 255)),
     "LOCKED_COLOR": TypedValue(color_value=SUColor(255, 0, 0, 255)),
     "SKY_COLOR": TypedValue(color_value=SUColor(180, 200, 220, 255)),
     "HORIZON_COLOR": TypedValue(color_value=SUColor(210, 215, 210, 255)),
     "GROUND_COLOR": TypedValue(color_value=SUColor(170, 185, 155, 255)),
     "GROUND_TRANSPARENCY": TypedValue(int_value=40), "DRAW_HORIZON": TypedValue(bool_value=True),
     "DRAW_GROUND": TypedValue(bool_value=False),
     "FACE_FRONT_COLOR": TypedValue(color_value=SUColor(235, 230, 220, 255)),
     "FACE_BACK_COLOR": TypedValue(color_value=SUColor(160, 165, 175, 255)),
     "FOREGROUND_COLOR": TypedValue(color_value=SUColor(40, 40, 45, 255)),
     "AMBIENT_OCCLUSION": TypedValue(bool_value=False)}
ro = model.get_rendering_options()
for k in D:
    ro[RenderingOptionKey[k]] = D[k]
si = model.get_shadow_info()
for k, v in (("DISPLAY_SHADOWS", TypedValue(bool_value=True)), ("LIGHT", TypedValue(int_value=80)), ("DARK", TypedValue(int_value=65))):
    si[ShadowInfoKey[k]] = v
model.get_styles().get_active_style().set_name("Residential database")
cam = Camera()
cam.set_orientation(eye, target, SUVector3D(0, 0, 1))
cam.enable_perspective()
cam.set_perspective_frustum_fov(fov)
model.set_camera(cam)
c = model.get_camera()
result = {"scenes": [s.get_name() for s in scenes], "perspective": c.is_perspective(),
          "fov": c.get_perspective_frustum_fov(), "attributes_written": session_state.get("rdb_attr_ok")}
'''


def compact_source(path):
    """primitives.py without docstrings and comments, checked to hold no import."""
    tree = ast.parse(Path(path).read_text())
    for node in ast.walk(tree):
        body = getattr(node, "body", None)
        if isinstance(body, list) and body and isinstance(body[0], ast.Expr) and isinstance(getattr(body[0], "value", None), ast.Constant) \
                and isinstance(body[0].value.value, str):
            node.body = body[1:] or [ast.Pass()]
    src = ast.unparse(tree)
    for bad in ("import ", "__", "eval(", "exec(", "open(", "setattr(", "type("):
        if bad in src:
            raise SystemExit(f"primitives.py contains '{bad}', which build_model rejects")
    return src


def build_calls(plan, max_chars=60000):
    engine = compact_source(HERE / "primitives.py") + "\n" + GLUE
    setup = engine + f"\nGROUPS = {plan['groups']!r}\nMATS = {plan['materials']!r}\n" + SETUP_TAIL
    calls = [setup]
    chunk, size = [], 0
    for lf in plan["leaves"]:
        item = {k: lf[k] for k in ("g", "n", "m", "k", "s", "vol")}
        if lf.get("t"):
            item["t"] = lf["t"]
        text = repr(item)
        if chunk and size + len(text) > max_chars:
            calls.append(chunk)
            chunk, size = [], 0
        chunk.append(item)
        size += len(text) + 2
    if chunk:
        calls.append(chunk)
    out = [calls[0]] + ['result = session_state["rdb_run"](' + repr(c) + ')\n' for c in calls[1:]]
    level_tags = [g["tag"] for g in plan["groups"] if g.get("tag", "") and g["tag"].startswith("Level · ")]
    out.append(FINISH % {"level_tags": level_tags, "bbox": plan["totals"]["bbox_in"]})
    return out


def main(plan_path, outdir, *rest):
    plan = json.load(open(plan_path))
    mc = int(rest[rest.index("--max-chars") + 1]) if "--max-chars" in rest else 60000
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    for old in out.glob("*.py"):
        old.unlink()
    calls = build_calls(plan, mc)
    names = ["00-setup.py"] + [f"{k:02d}-rooms.py" for k in range(1, len(calls) - 1)] + ["99-finish.py"]
    for name, code in zip(names, calls):
        (out / name).write_text(code)
        print(f"{out / name}  {len(code):,} chars")
    print(f"then save_model filename={plan['slug']}.skp")


if __name__ == "__main__":
    main(*sys.argv[1:])
