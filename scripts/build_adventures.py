"""The catalogue of escape adventures (docs/worlds/rocket/catalogue.json).

Rocket makes an adventure, by a seed, from what the site holds (adventure.js):
a crash outside one of the museums or one of the Architectural Authority's
buildings the site has modelled, with the pieces of a rocket hidden behind
the saved works hung there. This lists what each can be made from, so the
game can offer them all without asking the server for directories:

- every museum with a model (docs/v2/models/), an interior (docs/v2/interiors/),
  a ground (docs/v2/grounds/) and at least six hung works whose histories
  (docs/v2/histories/) are kept;
- every building of docs/v2/architecture.json with a model and a ground;
- every city of docs/v2/cityplaces.json, for the hunt in its streets;
- a pool of saved works with histories, to hang in the buildings.

    python3 scripts/build_adventures.py
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "docs" / "v2"
OUT = ROOT / "docs" / "worlds" / "rocket" / "catalogue.json"


def main():
    histories = {p.stem for p in (V2 / "histories").glob("*.json")}
    models = {p.stem for p in (V2 / "models").glob("*.json")}
    grounds = {p.stem for p in (V2 / "grounds").glob("*.json")}
    museums = json.load(open(V2 / "museums.json"))["museums"]

    out_m = []
    for m in museums:
        slug = m["slug"]
        ip = V2 / "interiors" / (slug + ".json")
        if slug not in models or slug not in grounds or not ip.exists():
            continue
        it = json.load(open(ip))
        hung = [w for w in it.get("works", []) if w.get("id") in histories and w.get("room")]
        if len(hung) < 6:
            continue
        out_m.append({"slug": slug, "name": m["name"], "where": m.get("where", ""), "lat": float(m["lat"]), "lon": float(m["lon"]),
                      "floors": len(it.get("floors", [])), "works": len(hung)})

    out_b = []
    for b in json.load(open(V2 / "architecture.json"))["buildings"]:
        # The Architectural Authority's buildings only (a hand one is not theirs, and Rocket says they are).
        if not b.get("hand") and b["slug"] in models and b["slug"] in grounds:
            # The model's own name for what it is (the Walt Disney Concert Hall, not the article's "Frank Gehry 1929–2025").
            name = json.load(open(V2 / "models" / (b["slug"] + ".json"))).get("name") or b["name"]
            out_b.append({"slug": b["slug"], "name": name, "where": b.get("where") or b.get("country", ""),
                          "lat": float(b["lat"]), "lon": float(b["lon"])})

    cities = [{"key": p["key"], "slug": p["slug"], "name": p["name"]}
              for p in json.load(open(V2 / "cityplaces.json"))["places"] if p.get("slug") and p.get("n")]

    seen, pool = set(), []
    for m in museums:
        for w in m["works"]:
            if w["id"] in histories and w["id"] not in seen and w.get("i"):
                seen.add(w["id"])
                pool.append({k: w.get(k) for k in ("id", "t", "a", "y", "m", "i")})

    cat = {"note": "Made by scripts/build_adventures.py from the site's museums, interiors, models, grounds, architecture and histories.",
           "museums": sorted(out_m, key=lambda x: x["name"]), "buildings": sorted(out_b, key=lambda x: x["name"]),
           "cities": sorted(cities, key=lambda x: x["name"]), "pool": pool}
    OUT.write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")))
    print(len(out_m), "museums,", len(out_b), "buildings,", len(cities), "cities,", len(pool), "works in the pool;",
          round(OUT.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    main()
