#!/usr/bin/env python3
"""Bring in new Architectural Authority bookmarks, end to end.

The same as the Artsy saves: bookmark a building on the site and it arrives
here with nothing to copy. Each step is a script already in this folder; this
runs them in order and says what is left for a person (or a scheduled
session) to do — model the new buildings from their photographs.

  1. fetch_architecture_saves.py   the bookmarks (signs itself in with
                                    AA_REFRESH_TOKEN; see that script)
  2. build_architecture.py          place each on the globe (docs/v2/architecture.json)
  3. build_grounds.py               the ground under each new one, in DIRT
  4. fetch_reference_photos.py      the new ones' photographs, into data/ (private)

    python3 scripts/update_buildings.py

Prints the buildings that have no model yet (docs/v2/models/<slug>.json).
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
MODELS = ROOT / "docs" / "v2" / "models"
BUILDINGS = ROOT / "docs" / "v2" / "architecture.json"


def run(*args):
    print("\n$", " ".join(args), flush=True)
    done = subprocess.run([sys.executable, *args], cwd=ROOT)
    if done.returncode:
        sys.exit(f"stopped: {args[0]} failed")


def main():
    before = {b["slug"] for b in json.loads(BUILDINGS.read_text(encoding="utf-8"))["buildings"]}
    run(str(SCRIPTS / "fetch_architecture_saves.py"))
    run(str(SCRIPTS / "build_architecture.py"))
    after = json.loads(BUILDINGS.read_text(encoding="utf-8"))["buildings"]
    new = [b for b in after if b["slug"] not in before]
    run(str(SCRIPTS / "build_grounds.py"))                 # skips grounds already cut
    for b in [b for b in after if not (MODELS / (b["slug"] + ".json")).exists()]:
        run(str(SCRIPTS / "fetch_reference_photos.py"), "--only", b["slug"])

    unmodelled = [b for b in after if not (MODELS / (b["slug"] + ".json")).exists()]
    print(f"\n{len(after)} buildings; {len(new)} new this run.")
    if unmodelled:
        print("To model (docs/v2/models/MODELS.md, photographs in data/photos/<slug>/):")
        for b in unmodelled:
            print(f"  {b['slug']}  —  {b.get('name')}, {b.get('where')} ({b.get('precision')})")
    else:
        print("Every building has a model.")


if __name__ == "__main__":
    main()
