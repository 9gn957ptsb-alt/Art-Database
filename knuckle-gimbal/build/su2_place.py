# Places both versions in the Grip group, in the hold pose: each in its own group on its own tag, and a scene per version
# that hides the other. SketchUp only; the text above it (gen.py, outlines.py, pinky_data.py, variants.py) builds the parts.
MM = 1/25.4
ZP = 8.75
E = 45.0
AZ = 16.5
AX = 34.25 + E
part = session_state["part"]
mats = {m.get_name(): m for m in model.get_materials()}
MATS = {"si": mats["Soft-Touch Silicone"], "cf": mats["Carbon Fiber Twill"]}
top_grp = [g for g in model.get_entities().get_groups() if g.get_name() == "Knuckle"][0]
grip = [g for g in top_grp.get_entities().get_groups() if g.get_name() == "Grip"][0]
def lo(ids):
    lp = LoopInput()
    for i in ids: lp.add_vertex_index(i)
    return lp
parts_by_variant = variant_parts(); vols = {}             # first, so a mistyped outline stops it before anything is placed
layers = []
for key, gname, tag in VARIANTS:
    L = Layer(); L.set_name(tag); layers.append(L)
model.add_layers(layers)
for (key, gname, tag), L in zip(VARIANTS, layers):
    vg = Group(); grip.get_entities().add_group(vg); vg.set_name(gname); vg.set_layer(L)
    for name, (mat, grp, verts, tris, faces) in parts_by_variant[key].items():
        gi = GeometryInput()
        gi.set_vertices([SUPoint3D((AX - w) * MM, y * MM, (ZP + AZ - s) * MM) for (s, y, w) in verts])
        for t in tris:
            _, gi = gi.add_face(lo(t))
        for outer, inners in faces:
            fi, gi = gi.add_face(lo(outer))
            for h in inners:
                gi = gi.face_add_inner_loop(fi, lo(h))
        v = part(vg, name, gi, MATS[mat]).compute_volume()
        vols[gname + " / " + name] = None if v is None else round(v / MM ** 3 / 1000, 3)
scenes = []
for key, gname, tag in VARIANTS:
    sc = Scene(); sc.set_name(tag); scenes.append(sc)
model.add_scenes(scenes)
for sc, L in zip(scenes, layers):
    sc.set_use_camera(False); sc.set_use_hidden_layers(True)
    for other in layers:
        if other is not L: sc.add_layer(other)     # a layer added to a scene is hidden in it
model.set_active_scene(scenes[0])
for L in layers[1:]:
    L.set_visibility(False)                           # the file opens showing the first version
result = {"not_solid": [k for k, v in vols.items() if v is None], "cm3": vols, "tags": [L.get_name() for L in layers],
          "scenes": [sc.get_name() for sc in scenes]}
