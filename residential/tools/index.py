#!/usr/bin/env python3
"""Write residential/index.json: every room of every project, compiled fresh, with whether
its project's .skp exists yet.

    python3 residential/tools/index.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rdb  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def main():
    rooms, projects = [], []
    for path in sorted((ROOT / "projects").glob("*.json")):
        p = rdb.load(path)
        plan, index, warnings = rdb.compile_project(p)
        built = (ROOT / "skp" / f"{p['slug']}.skp").exists()
        for r in index:
            r["built"] = built
        rooms += index
        projects.append({"slug": p["slug"], "name": p["name"], "architect": p.get("architect"),
                         "location": p.get("location"), "accuracy": p.get("accuracy", {}).get("level"),
                         "rooms": len(index), "solids": plan["totals"]["leaves"], "warnings": len(warnings),
                         "skp": f"residential/skp/{p['slug']}.skp" if built else None})
    out = {"projects": projects, "rooms": rooms}
    (ROOT / "index.json").write_text(json.dumps(out, indent=1, ensure_ascii=False))
    print(f"{len(projects)} projects, {len(rooms)} rooms -> {ROOT / 'index.json'}")


if __name__ == "__main__":
    main()
