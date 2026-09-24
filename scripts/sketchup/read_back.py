# Run as build_model code in the Trimble SketchUp connector. Reads every
# group's faces back as triangles, grouped by front material, in metres, with
# y flipped so it runs south as the site's models do.
IN = 0.0254
out = {}
for g in model.get_entities().get_groups():
    for f in g.get_entities().get_faces():
        m = f.get_front_material()
        name = m.get_name() if m else "none"
        pts = [v.get_position() for v in f.get_vertices()]
        if len(pts) < 3:
            continue
        rec = out.setdefault(name, {"keys": {}, "v": [], "f": []})
        idx = []
        for p in pts:
            k = (round(p.x * IN, 2), round(-p.y * IN, 2), round(p.z * IN, 2))
            if k not in rec["keys"]:
                rec["keys"][k] = len(rec["v"]) // 3
                rec["v"] += [k[0], k[1], k[2]]
            idx.append(rec["keys"][k])
        for i in range(1, len(idx) - 1):
            rec["f"] += [idx[0], idx[i], idx[i + 1]]
result = {n: {"v": r["v"], "f": r["f"]} for n, r in out.items()}
