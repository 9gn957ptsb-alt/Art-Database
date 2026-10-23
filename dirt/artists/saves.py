#!/usr/bin/env python3
"""The saves into data/artworks.db: step 1 of the coworker's week (COWORKER.md).

Only the works Aries saved himself (his choice, 23 Oct 2026: "Only my saves"). From 1 to 14 October 2026 a run on
his account saved every work by the artists he follows, some fifty thousand; ranked by every save, DIRT took in Frank
Stella, Karel Appel and Wayne Thiebaud on 6 October and KAWS, Honoré Daumier and Banksy on 14 October, for works he
had not chosen (4, 1, 0, 0, 0 and 1 of his own). So this no longer walks Artsy. It takes Color Middling's list of his
saves (data/artsy_saves_raw.json on the branch claude/artsy-import-rwgk8s), which that branch's daily reconcile keeps
level with Artsy, the run's works set aside by their ids. It is an LFS file, read with `git lfs smudge` (a few seconds), never written into this branch.

Then it normalizes them into data/artworks.db with the normalizer from the same branch, read with `git show` and run
in memory, patched for an open-ended price ("from $5,000", a price_cents list holding a null), which would otherwise
stop it.

    git fetch origin claude/artsy-import-rwgk8s
    python3 dirt/artists/saves.py
"""
import json
import subprocess
import sys
import types
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
BRANCH = "origin/claude/artsy-import-rwgk8s"
SAVES = BRANCH + ":data/artsy_saves_raw.json"
NORMALIZER = BRANCH + ":scripts/normalize_artsy_saves.py"
OUT = REPO / "data" / "artsy_saves_raw.json"


def fetch():
    pointer = subprocess.run(["git", "show", SAVES], cwd=REPO, capture_output=True)
    if pointer.returncode:
        sys.exit(f"Cannot read {SAVES} ({pointer.stderr.decode().strip()}); run git fetch origin claude/artsy-import-rwgk8s")
    got = subprocess.run(["git", "lfs", "smudge", "data/artsy_saves_raw.json"], cwd=REPO, input=pointer.stdout,
                         capture_output=True)
    if got.returncode:
        sys.exit(f"git lfs could not fetch the saves ({got.stderr.decode().strip()[:300]}); "
                 f"apt-get install -y git-lfs if it is missing")
    records = json.loads(got.stdout)
    if not isinstance(records, list) or len({r.get("id") for r in records}) != len(records) or len(records) < 1000:
        sys.exit(f"{SAVES} is not a list of saves; data/artsy_saves_raw.json is left as it was.")
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_bytes(got.stdout)
    print(f"{len(records)} saves, his own, from Color Middling's list", flush=True)


def open_price(record):
    """price_cents as a (low, high) pair, a bound left empty where the range is open."""
    cents = record.get("price_cents")
    if not isinstance(cents, list) or not cents:
        return None, None
    known = [c for c in cents if isinstance(c, (int, float))]
    if not known:
        return None, None
    if len(known) < len(cents):                  # an open-ended range ("from X"): keep the bound that is given
        lo, hi = cents[0], cents[-1]
        return (lo if isinstance(lo, (int, float)) else None), (hi if isinstance(hi, (int, float)) else None)
    return min(known), max(known)


def normalize():
    src = subprocess.run(["git", "show", NORMALIZER], cwd=REPO, capture_output=True, text=True)
    if src.returncode:
        sys.exit(f"Cannot read the normalizer ({src.stderr.strip()}); run git fetch origin claude/artsy-import-rwgk8s")
    norm = types.ModuleType("normalize_artsy_saves")
    norm.__file__ = str(REPO / "scripts" / "normalize_artsy_saves.py")   # so it finds data/ as it would there
    exec(compile(src.stdout, NORMALIZER, "exec"), norm.__dict__)
    norm.price_cents_range = open_price
    norm.main()


if __name__ == "__main__":
    fetch()
    normalize()
