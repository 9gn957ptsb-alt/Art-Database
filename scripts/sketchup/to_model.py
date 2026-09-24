#!/usr/bin/env python3
"""Put meshes read back from SketchUp (read_back.py's saved result) into a
building model, replacing its parts but keeping its trees.

    python3 scripts/sketchup/to_model.py <saved build_model result> <model.json>
"""
import json
import sys

# SketchUp material name -> the site's material (docs/v2/models.js).
MATERIALS = {
    "Stainless": "steel", "Steel_shade": "metal", "Glass": "glass",
    "Limestone": "stone", "Plaster": "render", "Concrete": "concrete",
}


def main(saved, model_path):
    d = json.loads(open(saved, encoding="utf-8").read())
    if isinstance(d, list):                      # the tool's text wrapper
        d = json.loads(d[0]["text"])
    meshes = d.get("result", d)
    model = json.load(open(model_path, encoding="utf-8"))
    trees = [p for p in model.get("parts", []) if "tree" in p]
    model["parts"] = [{"mesh": {"v": r["v"], "f": r["f"]}, "m": MATERIALS.get(name, "concrete")}
                      for name, r in meshes.items()] + trees
    json.dump(model, open(model_path, "w", encoding="utf-8"), separators=(",", ":"))
    print(model_path, {name: len(r["f"]) // 3 for name, r in meshes.items()}, "triangles")


if __name__ == "__main__":
    main(*sys.argv[1:3])
