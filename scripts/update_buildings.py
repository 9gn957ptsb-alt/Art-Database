#!/usr/bin/env python3
"""Bring in every kind of building on the globe, end to end.

Each kind is a source of places the artist keeps, and each has its own
intake; this runs them all, cuts the ground under anything new, and says what
is left for a person (or a scheduled session) to do — model the buildings
that have no model yet. A new kind of building is one more entry in KINDS.

  architecture   the Architectural Authority bookmarks
                 (fetch_architecture_saves.py signs itself in with
                 AA_REFRESH_TOKEN; build_architecture.py places them)
  museums        the museums that hold the works saved on Artsy
                 (fetch_artsy_saves.py — the proxy adds Artsy's token;
                 build_museums.py places them)

then build_grounds.py for the ground under every new place, and
fetch_reference_photos.py for the new Architectural Authority buildings'
photographs, into data/ (private).

    python3 scripts/update_buildings.py

A kind whose source fails (a refused token) is reported and the rest carry on.
Prints the buildings that have no model yet (docs/v2/models/<slug>.json),
kind by kind, most important first.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
MODELS = ROOT / "docs" / "v2" / "models"

KINDS = [
    {"kind": "architecture", "file": "architecture.json", "key": "buildings",
     "steps": ["fetch_architecture_saves.py", "build_architecture.py"]},
    {"kind": "museums", "file": "museums.json", "key": "museums",
     "steps": ["fetch_artsy_saves.py", "build_museums.py"]},
]


def run(*args):
    print("\n$", " ".join(args), flush=True)
    return subprocess.run([sys.executable, *args], cwd=ROOT).returncode == 0


def places(k):
    path = ROOT / "docs" / "v2" / k["file"]
    return json.loads(path.read_text(encoding="utf-8"))[k["key"]] if path.exists() else []


def main():
    failed, new = [], {}
    for k in KINDS:
        before = {p["slug"] for p in places(k)}
        if all(run(str(SCRIPTS / step)) for step in k["steps"]):
            new[k["kind"]] = [p for p in places(k) if p["slug"] not in before]
        else:
            failed.append(k["kind"])
    run(str(SCRIPTS / "build_grounds.py"))                 # skips grounds already cut
    for b in places(KINDS[0]):
        if not (MODELS / (b["slug"] + ".json")).exists():
            run(str(SCRIPTS / "fetch_reference_photos.py"), "--only", b["slug"])

    for k in KINDS:
        every = places(k)
        todo = [b for b in every if not (MODELS / (b["slug"] + ".json")).exists()]
        print(f"\n{k['kind']}: {len(every)}; {len(new.get(k['kind'], []))} new this run; "
              f"{len(todo)} without a model.")
        for b in todo[:12]:
            print(f"  {b['slug']}  —  {b.get('name')}, {b.get('where')} ({b.get('precision')})")
        if len(todo) > 12:
            print(f"  … and {len(todo) - 12} more")
    if failed:
        print("\nFailed to bring in:", ", ".join(failed))


if __name__ == "__main__":
    main()
