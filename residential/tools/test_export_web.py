#!/usr/bin/env python3
"""Check a web export (export_web.py) against the compiler and the room index.

    python3 residential/tools/test_export_web.py [--out DIR] [--fresh]

DIR is the export directory (default residential/build/web); --fresh exports into a temporary
directory first and checks that instead. Checks:
  volumes   every leaf's primitives.py volume equals its vol (1e-6 relative; vol is stored
            rounded to 1e-6 m3, so the difference may also be up to that rounding)
  counts    rooms, groups and leaves equal a fresh rdb.compile_project of the project file
  rooms     every room's leaves belong to its group or the group's descendants, no leaf has two
            rooms, every solid inside a room group belongs to a room, origins are their group's
  index     library rooms match residential/index.json (a project missing from index.json, or
            whose rows differ only because index.json is older than the project, is reported
            as stale rather than failed)
  library   room types, sizes and thumbnails are consistent and within limits
A project file changed after its export is reported as stale, not failed. Exits 1 on failure.
"""
import argparse
import json
import math
import sys
import tempfile
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import export_web  # noqa: E402
import primitives  # noqa: E402
import rdb  # noqa: E402

primitives.math = math
ROOT = HERE.parent
MAX_FILE = 8 * 1024 * 1024            # half the 16 MB artifact file limit


class Report:
    def __init__(self):
        self.fail, self.stale, self.counts = [], [], {}

    def check(self, name, ok, msg):
        self.counts[name] = self.counts.get(name, 0) + 1
        if not ok:
            self.fail.append(f"{name}: {msg}")
        return ok


def same(a, b):
    """Equal after a JSON round trip (tuples vs lists)."""
    return json.loads(json.dumps(a)) == json.loads(json.dumps(b))


def check_project(R, out, lp, projects_dir):
    slug = lp["slug"]
    res_path = out / "res" / f"{slug}.json"
    if not R.check("library", res_path.exists(), f"{slug}: {res_path} missing"):
        return
    R.check("library", res_path.stat().st_size < MAX_FILE, f"{slug}: res file over 8 MB")
    res = json.loads(res_path.read_text(encoding="utf-8"))
    R.check("library", res.get("schema") == export_web.SCHEMA and res.get("slug") == slug,
            f"{slug}: res schema/slug {res.get('schema')}/{res.get('slug')}")
    R.check("library", lp["file"].endswith(f"res/{slug}.json"), f"{slug}: file {lp['file']}")
    groups, leaves, rooms = res["groups"], res["leaves"], res["rooms"]

    # volumes: the JS port of primitives.py must reproduce these
    for i, lf in enumerate(leaves):
        V, F = primitives.realize(lf["k"], lf["s"])
        vol, bad = rdb.mesh_stats(V, F)
        R.check("volumes", abs(vol - lf["vol"]) <= max(1e-6 * abs(lf["vol"]), 5e-7 + 1e-12),
                f"{slug} leaf {i} ({lf['n']}): primitives {vol:.9f} vs vol {lf['vol']}")
        R.check("volumes", 0 <= lf["g"] < len(groups), f"{slug} leaf {i}: group {lf['g']} out of range")

    # counts against a fresh compile of the project file
    src = projects_dir / f"{slug}.json"
    fresh = None
    try:
        plan, index, _ = rdb.compile_project(rdb.load(src))
        fresh = (plan, index)
    except Exception as e:
        R.stale.append(f"{slug}: project file no longer compiles ({type(e).__name__}: {e}); export not re-checked")
    if fresh:
        plan, index = fresh
        newer = src.stat().st_mtime > res_path.stat().st_mtime
        checks = [
            (len(rooms) == plan["totals"]["rooms"] == len(index) == lp["rooms"],
             f"rooms {len(rooms)} / plan {plan['totals']['rooms']} / library {lp['rooms']}"),
            (len(leaves) == plan["totals"]["leaves"] == lp["solids"],
             f"leaves {len(leaves)} / plan {plan['totals']['leaves']} / library {lp['solids']}"),
            (same(groups, plan["groups"]), "groups differ from the compiled plan"),
            (same(leaves, plan["leaves"]), "leaves differ from the compiled plan"),
            (same(res["materials"], plan["materials"]) and same(res["levels"], plan["levels"])
             and same(res["bbox_in"], plan["totals"]["bbox_in"]), "materials/levels/bbox differ"),
            ([r["room_id"] for r in rooms] == [r["room_id"] for r in index], "room order or ids differ"),
        ]
        for ok, msg in checks:
            if not ok and newer:
                R.stale.append(f"{slug}: project changed after its export ({msg}); rerun export_web.py")
                break
            R.check("counts", ok, f"{slug}: {msg}")

    # rooms own solids of their own group (or its descendants) only
    children = {}
    for k, g in enumerate(groups):
        if g["parent"] is not None:
            children.setdefault(g["parent"], []).append(k)

    def subtree(k):
        out_, todo = set(), [k]
        while todo:
            q = todo.pop()
            if q not in out_:
                out_.add(q)
                todo += children.get(q, [])
        return out_
    owner = {}
    room_area = set()
    for r in rooms:
        g = r["group"]
        if not R.check("rooms", 0 <= g < len(groups), f"{slug} {r['room_id']}: group {g} out of range"):
            continue
        sub = subtree(g)
        room_area |= sub
        R.check("rooms", r["origin"] == groups[g]["origin"], f"{slug} {r['room_id']}: origin is not its group's")
        R.check("rooms", (groups[g].get("attrs") or {}).get("room_id") in {q["room_id"] for q in rooms if q["group"] == g},
                f"{slug} {r['room_id']}: group {g} is not this room's group")
        R.check("rooms", len(r["outline"]) >= 3 and len(r["inner"]) >= 3, f"{slug} {r['room_id']}: outline/inner")
        R.check("rooms", rdb.signed_area(r["outline"]) > 0 and rdb.signed_area(r["inner"]) > 0,
                f"{slug} {r['room_id']}: rings not counter-clockwise")
        for i in r["leaves"]:
            if not R.check("rooms", 0 <= i < len(leaves), f"{slug} {r['room_id']}: leaf {i} out of range"):
                continue
            R.check("rooms", leaves[i]["g"] in sub,
                    f"{slug} {r['room_id']}: leaf {i} ({leaves[i]['n']}) is in group {leaves[i]['g']}, not under {g}")
            R.check("rooms", i not in owner, f"{slug}: leaf {i} owned by {owner.get(i)} and {r['room_id']}")
            owner[i] = r["room_id"]
    for i, lf in enumerate(leaves):
        if lf["g"] in room_area:
            R.check("rooms", i in owner, f"{slug}: leaf {i} ({lf['n']}) in a room group belongs to no room")


def check_index(R, library, index_path, projects_dir):
    idx = json.loads(index_path.read_text(encoding="utf-8"))
    by_slug_idx, by_slug_lib = {}, {}
    for row in idx["rooms"]:
        by_slug_idx.setdefault(row["slug"], {})[f"{row['slug']}#{row['room_id']}"] = row
    for r in library["rooms"]:
        by_slug_lib.setdefault(r["slug"], {})[r["key"]] = r

    def as_index(r):
        return {"project": r["project"], "room_id": r["room_id"], "name": r["name"], "type": r["type"],
                "level": r["level"], "area_m2": r["area"], "clear_height_m": r["height"], "doors": r["doors"],
                "windows": r["windows"], "outdoor": r["outdoor"], "confidence": r["confidence"]}
    fields = list(as_index(library["rooms"][0]).keys()) if library["rooms"] else []
    for slug in sorted(set(by_slug_idx) | set(by_slug_lib)):
        lib, ix = by_slug_lib.get(slug), by_slug_idx.get(slug)
        if lib is None:
            src = projects_dir / f"{slug}.json"
            try:
                rdb.compile_project(rdb.load(src))
            except Exception as e:
                R.stale.append(f"index: {slug} is in index.json but its project file fails now ({type(e).__name__})")
                continue
            R.check("index", False, f"{slug} is in index.json and compiles, but is missing from the library")
            continue
        if ix is None:
            R.stale.append(f"index: {slug} is not in index.json yet (run tools/index.py)")
            continue
        diff = []
        if set(lib) != set(ix):
            diff.append(f"room keys differ: only library {sorted(set(lib) - set(ix))}, only index {sorted(set(ix) - set(lib))}")
        for k in sorted(set(lib) & set(ix)):
            a, b = as_index(lib[k]), {f: ix[k].get(f) for f in fields}
            if a != b:
                diff.append(f"{k}: " + ", ".join(f"{f} {a[f]!r} vs {b[f]!r}" for f in fields if a[f] != b[f]))
        if not diff:
            R.check("index", True, "")
            continue
        try:                                        # stale index.json, or a wrong export?
            _, fresh, _ = rdb.compile_project(rdb.load(projects_dir / f"{slug}.json"))
            fresh_rows = {f"{slug}#{row['room_id']}": {f: row.get(f) for f in fields} for row in fresh}
            if fresh_rows == {k: as_index(v) for k, v in lib.items()}:
                R.stale.append(f"index: index.json is older than {slug}'s project file (run tools/index.py)")
                continue
        except Exception:
            pass
        R.check("index", False, f"{slug}: " + "; ".join(diff[:5]))


def check_library(R, out, library):
    R.check("library", library.get("schema") == export_web.SCHEMA, f"schema {library.get('schema')}")
    R.check("library", (out / "library.json").stat().st_size < MAX_FILE, "library.json over 8 MB")
    keys = [r["key"] for r in library["rooms"]]
    R.check("library", len(keys) == len(set(keys)), "duplicate room keys")
    R.check("library", sum(t["count"] for t in library["types"].values()) == len(keys), "type counts do not sum to rooms")
    by_key = {r["key"]: r for r in library["rooms"]}
    for t, info in library["types"].items():
        R.check("library", info["count"] == len(info["rooms"]) and all(by_key[k]["type"] == t for k in info["rooms"]),
                f"type {t}: room list")
        for f in ("area", "height", "w", "d"):
            s = info[f]
            R.check("library", s["min"] <= s["p25"] <= s["median"] <= s["p75"] <= s["max"], f"type {t}: {f} spread order")
    per_project = {}
    for r in library["rooms"]:
        per_project[r["slug"]] = per_project.get(r["slug"], 0) + 1
        R.check("library", r["w"] >= r["d"] > 0 and r["w"] * r["d"] >= r["area"] - 0.05 * max(1, r["area"]),
                f"{r['key']}: w {r['w']} d {r['d']} area {r['area']}")
    for lp in library["projects"]:
        R.check("library", per_project.get(lp["slug"], 0) == lp["rooms"], f"{lp['slug']}: room rows")
        (lo, hi) = lp["bbox"]
        R.check("library", all(lo[k] < hi[k] for k in range(3)), f"{lp['slug']}: bbox {lp['bbox']}")
        skp = ROOT / "skp" / f"{lp['slug']}.skp"
        R.check("library", (lp["skp_url"] is not None) == skp.exists(), f"{lp['slug']}: skp_url vs {skp}")
        if lp.get("thumb"):
            png = out / "res" / f"{lp['slug']}.png"
            if R.check("library", png.exists(), f"{lp['slug']}: thumbnail missing"):
                with Image.open(png) as im:
                    R.check("library", im.width <= 480 and png.stat().st_size <= 80 * 1024,
                            f"{lp['slug']}: thumbnail {im.width} px, {png.stat().st_size} bytes")


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT / "build" / "web"))
    ap.add_argument("--projects", default=str(ROOT / "projects"))
    ap.add_argument("--index", default=str(ROOT / "index.json"))
    ap.add_argument("--fresh", action="store_true", help="export into a temporary directory and check that")
    a = ap.parse_args(argv)
    projects_dir = Path(a.projects)
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(a.out)
        if a.fresh:
            out = Path(tmp)
            export_web.export(out, projects_dir, ROOT / "skp", log=lambda m: print("  export:", m))
        library = json.loads((out / "library.json").read_text(encoding="utf-8"))
        R = Report()
        check_library(R, out, library)
        for lp in library["projects"]:
            check_project(R, out, lp, projects_dir)
        check_index(R, library, Path(a.index), projects_dir)
    for s in library.get("skipped", []):
        R.stale.append(f"export skipped {s['file']}: {s['reason']}")
    for name in ("volumes", "counts", "rooms", "index", "library"):
        bad = sum(1 for f in R.fail if f.startswith(name + ":"))
        print(f"{'FAIL' if bad else 'ok  '} {name:8s} {R.counts.get(name, 0)} checks, {bad} failed")
    for f in R.fail[:40]:
        print("  FAIL", f)
    if len(R.fail) > 40:
        print(f"  ... {len(R.fail) - 40} more")
    for s in R.stale:
        print("  note", s)
    n_leaves = sum(lp["solids"] for lp in library["projects"])
    print(f"test_export_web: {len(library['projects'])} projects, {len(library['rooms'])} rooms, "
          f"{n_leaves} solids; {len(R.fail)} failures, {len(R.stale)} notes")
    return 1 if R.fail else 0


if __name__ == "__main__":
    sys.exit(main())
