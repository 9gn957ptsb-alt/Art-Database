#!/usr/bin/env python3
"""DIRT's Earth is the Artist Website's globe: one Earth, two ways in.

The website's globe (docs/ on the branch claude/artist-website-dev-s92irf: the globe, its places and collages, and
going down into DIRT Earth and its streets) is taken as it stands on that branch and written beside DIRT's page, under
world/, so the page's Earth button opens exactly what the website shows. Nothing of it is rewritten; it is copied.
Run it before every publish of DIRT, so the two never drift apart.

    python3 dirt/world_files.py --out dirt/private/world     # then publish the page with these files (see --list)

--list prints the files as the Artifact tool's `files` map ({"world/...": "<path>"}).
"""

import argparse
import io
import json
import subprocess
import tarfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRANCH = "claude/artist-website-dev-s92irf"


def export(out, ref):
    out = Path(out)
    subprocess.run(["git", "fetch", "-q", "origin", BRANCH], cwd=HERE.parent, check=False)
    tar = subprocess.run(["git", "archive", ref, "docs"], cwd=HERE.parent, check=True, capture_output=True).stdout
    n = 0
    with tarfile.open(fileobj=io.BytesIO(tar)) as t:
        for m in t.getmembers():
            if not m.isfile() or m.name.endswith(".md") or "/." in m.name:
                continue
            dest = out / m.name[len("docs/"):]
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(t.extractfile(m).read())
            n += 1
    return n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "private" / "world"))
    ap.add_argument("--ref", default=f"origin/{BRANCH}")
    ap.add_argument("--list", action="store_true", help="print the Artifact files map")
    args = ap.parse_args()
    n = export(args.out, args.ref)
    out = Path(args.out)
    if args.list:
        files = {"world/" + str(p.relative_to(out)): str(p) for p in sorted(out.rglob("*")) if p.is_file()}
        print(json.dumps(files, indent=1))
    else:
        print(n, "files of the website's globe in", out)


if __name__ == "__main__":
    main()
