#!/usr/bin/env python3
"""Grow the cities' skylines: list more cities, read their ground and its years, one at a time.

The daily buildings pass (docs/v2/models/REFINE.md, "The skylines") runs this. It lists the first
--top cities with museums (build_city_places.py), reads the ground of each that has none yet
(build_grounds.py --only city-<key>, one place at a time: the planet-wide files exhaust memory in
parallel), dates its buildings (build_built_years.py --only city-<key>), and writes who walks each
(build_city_artists.py). A city already read is left as it is unless --force.

    python3 scripts/update_skylines.py [--top 16] [--max 3] [--force]

--max is how many new cities a run reads (a city takes 2-6 minutes for its ground, and its years
as long again where a city's own records are read).
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
V2 = ROOT / "docs" / "v2"


def run(*args):
    print("  $", " ".join(args), flush=True)
    return subprocess.run([sys.executable] + list(args), cwd=ROOT).returncode


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--top", type=int, default=None, help="list this many cities (default: those listed now, plus --max)")
    ap.add_argument("--max", type=int, default=3)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    listed = json.loads((V2 / "cityplaces.json").read_text(encoding="utf-8"))["places"] if (V2 / "cityplaces.json").exists() else []
    top = args.top or (len([p for p in listed if (V2 / "grounds" / (p["slug"] + ".json")).exists()]) + args.max)
    run("scripts/build_city_places.py", "--top", str(top))
    places = json.loads((V2 / "cityplaces.json").read_text(encoding="utf-8"))["places"]
    done = 0
    for p in places:
        path = V2 / "grounds" / (p["slug"] + ".json")
        if path.exists() and not args.force:
            if "built" not in json.loads(path.read_text(encoding="utf-8")):
                run("scripts/build_built_years.py", "--only", p["slug"])
            continue
        if done >= args.max:
            break
        if run("scripts/build_grounds.py", "--only", p["slug"], "--force") == 0 and path.exists():
            run("scripts/build_built_years.py", "--only", p["slug"], "--force")
            done += 1
    run("scripts/build_city_artists.py")
    missing = [p["key"] for p in places if not (V2 / "grounds" / (p["slug"] + ".json")).exists()]
    print(f"{done} new skylines; still to read: {', '.join(missing) or 'none'}")


if __name__ == "__main__":
    main()
