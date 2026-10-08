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

then build_grounds.py for the ground under every new place, build_built_years.py
for when its buildings went up (the timeline), fetch_reference_photos.py for
the new Architectural Authority buildings' photographs, into data/ (private),
and build_interiors.py for the museums' insides: a shell for every new museum,
and where each museum's own records say its saved works hang today, read
again (the walk; docs/v2/interiors/INTERIORS.md). Interiors are for museums
only: a new kind of building never gets them by default, and a private home
never does.

    python3 scripts/update_buildings.py

A kind whose source fails (a refused token) is reported and the rest carry on.
Prints the buildings that have no model yet (docs/v2/models/<slug>.json),
kind by kind, most important first; then each museum's interior tier and the
saved works its records place in rooms not drawn yet.
"""

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCRIPTS = ROOT / "scripts"
MODELS = ROOT / "docs" / "v2" / "models"
INTERIORS = ROOT / "docs" / "v2" / "interiors"

KINDS = [
    {"kind": "architecture", "file": "architecture.json", "key": "buildings",
     "steps": ["fetch_architecture_saves.py", "build_architecture.py"]},
    {"kind": "museums", "file": "museums.json", "key": "museums",
     "steps": ["fetch_artsy_saves.py", "build_museums.py"],
     # Paused 6 Oct 2026: the artist asked for every work by the 878 artists he follows to be
     # saved on Artsy (scripts/save_followed_artworks.py, ~100,000 works, a day's run). Read
     # back daily, they would all flow into museums.json — a half-saved set, too large to fetch
     # or build in one pass — before he has decided how they belong on the site. museums.json
     # stays as it is (built from the works he saved himself); delete this key to resume.
     "paused": "the Artsy saves now hold every work by the artists he follows; "
               "waiting on the artist's decision about how they appear on the site"},
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
        if k.get("paused"):
            print(f"\n{k['kind']}: intake paused — {k['paused']} (KINDS in update_buildings.py)", flush=True)
            new[k["kind"]] = []
            continue
        if all(run(str(SCRIPTS / step)) for step in k["steps"]):
            new[k["kind"]] = [p for p in places(k) if p["slug"] not in before]
        else:
            failed.append(k["kind"])
    run(str(SCRIPTS / "build_grounds.py"))                 # skips grounds already cut
    run(str(SCRIPTS / "build_built_years.py"))             # and dates their buildings, for the timeline
    for b in places(KINDS[0]):
        if not (MODELS / (b["slug"] + ".json")).exists():
            run(str(SCRIPTS / "fetch_reference_photos.py"), "--only", b["slug"])
    # The museums' insides: a shell for each new one, and where the works hang today.
    run(str(SCRIPTS / "build_interiors.py"), "--stubs", "--refresh")
    # And the arranged museums (INTERIORS.md, "Arranged"): their works hung again by the rule after the
    # records were read, and any new museum's shell laid out, so every museum can be walked up to.
    print("\n$ node scripts/build_interiors_arranged.js", flush=True)
    subprocess.run(["node", str(SCRIPTS / "build_interiors_arranged.js")], cwd=ROOT)

    for k in KINDS:
        every = places(k)
        todo = [b for b in every if not (MODELS / (b["slug"] + ".json")).exists()]
        print(f"\n{k['kind']}: {len(every)}; {len(new.get(k['kind'], []))} new this run; "
              f"{len(todo)} without a model.")
        for b in todo[:12]:
            print(f"  {b['slug']}  —  {b.get('name')}, {b.get('where')} ({b.get('precision')})")
        if len(todo) > 12:
            print(f"  … and {len(todo) - 12} more")
    interiors()
    if failed:
        print("\nFailed to bring in:", ", ".join(failed))


def interiors():
    """Each museum's interior tier, and the saved works its records place in rooms not drawn yet
    (most first): the first to raise a tier (models/REFINE.md, Interiors)."""
    tiers, waiting = {}, []
    for m in places(KINDS[1]):
        path = INTERIORS / (m["slug"] + ".json")
        doc = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
        tier = doc.get("tier", "none")
        tiers[tier] = tiers.get(tier, 0) + 1
        away = [w for w in doc.get("works") or [] if w.get("how") == "elsewhere"]
        if away:
            waiting.append((len(away), m["slug"], tier, away))
    print("\ninteriors: " + ", ".join(f"{v} {k}" for k, v in sorted(tiers.items())))
    waiting.sort(key=lambda x: (-x[0], x[1]))
    for n, slug, tier, away in waiting:
        rooms = sorted({w.get("said") or "" for w in away})
        print(f"  {slug} ({tier}): {n} placed in rooms not drawn — " + "; ".join(rooms[:6]) +
              (f"; … and {len(rooms) - 6} more rooms" if len(rooms) > 6 else ""))


if __name__ == "__main__":
    main()
