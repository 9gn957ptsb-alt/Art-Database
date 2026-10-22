# Step 5. Export every face (outer and inner loops, normal) for the web viewer. The result is large and lands in a tool-results file; pass that file to pack.py.
MM = 1/25.4
ZP = 8.75
top = [g for g in model.get_entities().get_groups() if g.get_name() == "Knuckle"][0]
def P(v):
    p = v.get_position()
    return [round(p.x / MM, 2), round(p.y / MM, 2), round(p.z / MM - ZP, 2)]
parts = []
def walk(grp, path):
    for k in grp.get_entities().get_groups():
        walk(k, path + [k.get_name()])
    faces = grp.get_entities().get_faces()
    if not faces:
        return
    mat = faces[0].get_front_material()
    fl = []
    for f in faces:
        n = f.get_normal()
        outer = [c for v in f.get_outer_loop().get_vertices() for c in P(v)]
        inner = [[c for v in lp.get_vertices() for c in P(v)] for lp in f.get_inner_loops()]
        fl.append([outer, inner, [round(n.x, 4), round(n.y, 4), round(n.z, 4)]])
    parts.append({"path": path, "material": mat.get_name() if mat else None, "faces": fl})
walk(top, [])
result = {"source": "knuckle (SketchUp)", "units": "mm, z from phone back", "pose": {"extension_mm": 45.0, "grip_deg": 90.0, "hinge_axis": [79.25, 0.0, 16.5], "ring_home_y": 23.34}, "parts": parts}
