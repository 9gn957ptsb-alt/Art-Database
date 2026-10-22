#!/usr/bin/env python3
"""Export the residential database for the web tool (format rdb-web/1).

    python3 residential/tools/export_web.py [--out DIR] [--projects DIR] [--prefix data/]
                                            [--no-thumbs] [--strict]

Compiles every residential/projects/*.json with rdb.compile_project and writes

  DIR/library.json     every project (with its .skp download link), every room with its size,
                       and per room type the spread of areas, heights and plan sides
  DIR/res/<slug>.json  one project: its groups and solids exactly as rdb.py emits them (specs
                       in metres, world coordinates, realised by primitives.py) and its rooms,
                       each with its outlines and the solids it owns
  DIR/res/<slug>.png   a small axonometric (preview.py axon), at most 480 px wide and 80 KB

Paths inside library.json are DIR-relative with --prefix in front ("data/" by default, for a
page that serves DIR as data/). A project file that cannot be read or compiled (for example one
another session is still writing), or that holds NaN or Infinity (which Python's json reads but
a browser's JSON.parse rejects), is skipped with a warning; the export never stops for it.
Files are written atomically, and res/ files no project uses any more are removed.
Default DIR: residential/build/web (not committed). Units: metres, z up.
"""
import argparse
import datetime
import json
import math
import os
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image
from shapely.geometry import Polygon

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import preview  # noqa: E402
import primitives  # noqa: E402
import rdb  # noqa: E402

ROOT = HERE.parent
SCHEMA = "rdb-web/1"
BRANCH = "claude/art-database-photos-ilnaf7"
SKP_URL = "https://github.com/9gn957ptsb-alt/Art-Database/raw/" + BRANCH + "/residential/skp/{slug}.skp"
# where SKP_URL redirects to; this host answers with Access-Control-Allow-Origin: *, so a page can fetch() it
SKP_RAW_URL = "https://raw.githubusercontent.com/9gn957ptsb-alt/Art-Database/" + BRANCH + "/residential/skp/{slug}.skp"
AA_ARTICLE = "https://www.thearchitecturalauthority.com/article/{slug}"
THUMB_W, THUMB_MAX_BYTES = 480, 80 * 1024


def r4(v):
    return round(float(v), 4)


def ring4(pts):
    """A plan ring rounded to 0.1 mm, counter-clockwise (shapely hands inner rings back clockwise)."""
    ring = [[r4(x), r4(y)] for x, y in pts]
    return ring[::-1] if rdb.signed_area(ring) < 0 else ring


# ---------- compiling, with each solid's owner room ----------

def compile_with_owners(p):
    """rdb.compile_project(p), plus for every leaf the id of the room that built it (None for a
    level's Exterior or the Site).

    rdb.py puts a room's solids in the group [project, level, room name], so two rooms with the
    same name on one level share a group and their solids cannot be told apart by group. The
    owner is therefore recorded while compiling: rdb calls clear_height(room) as it starts each
    room, element_solids(element) for each project element (hosted elements name their room),
    and realises each leaf exactly once as it emits it. Returns (plan, index, warnings, owners,
    exact) where exact is False if that record does not fit the plan (owners then come from group
    membership instead)."""
    marks, count = [], [0]
    elements = {id(e) for e in p.get("elements", [])}
    o_realize, o_height, o_elem = rdb.Leaf.realize, rdb.clear_height, rdb.element_solids

    def realize(self):
        count[0] += 1
        return o_realize(self)

    def clear_height(r, *a, **k):
        marks.append((count[0], r.id))
        return o_height(r, *a, **k)

    def element_solids(e, *a, **k):
        if id(e) in elements:                      # a project element, not a room fixture
            marks.append((count[0], e.get("room")))
        return o_elem(e, *a, **k)

    rdb.Leaf.realize, rdb.clear_height, rdb.element_solids = realize, clear_height, element_solids
    try:
        plan, index, warnings = rdb.compile_project(p)
    finally:
        rdb.Leaf.realize, rdb.clear_height, rdb.element_solids = o_realize, o_height, o_elem

    n = len(plan["leaves"])
    owners = [None] * n
    bounds = marks + [(n, None)]
    for (start, who), (end, _) in zip(bounds, bounds[1:]):
        for i in range(start, min(end, n)):
            owners[i] = who
    room_group = room_groups(plan, index)
    sub = subtrees(plan["groups"])
    in_room = {g for gr in room_group.values() for g in sub[gr]}
    exact = count[0] == n and all(
        (lf["g"] in sub[room_group[owners[i]]]) if owners[i] in room_group else
        (owners[i] is None and lf["g"] not in in_room)
        for i, lf in enumerate(plan["leaves"]))
    if not exact:                                  # rdb changed how it emits: fall back to groups
        by_group = {}
        for rid, g in room_group.items():
            for d in sub[g]:
                by_group.setdefault(d, rid)
        owners = [by_group.get(lf["g"]) for lf in plan["leaves"]]
    return plan, index, warnings, owners, exact


def room_groups(plan, index):
    """room id -> index of its group in plan['groups']."""
    by_path = {"/".join(g["path"]): k for k, g in enumerate(plan["groups"])}
    return {row["room_id"]: by_path[row["group_path"]] for row in index}


def subtrees(groups):
    """group index -> set of itself and all its descendant groups."""
    children = {}
    for k, g in enumerate(groups):
        if g["parent"] is not None:
            children.setdefault(g["parent"], []).append(k)
    out = {}
    for k in range(len(groups)):
        seen, todo = set(), [k]
        while todo:
            q = todo.pop()
            if q not in seen:
                seen.add(q)
                todo += children.get(q, [])
        out[k] = seen
    return out


# ---------- rooms ----------

def plan_sides(inner):
    """(w, d): sides of the minimum-area rectangle around a polygon, w >= d, metres."""
    try:
        poly = Polygon(inner)
        if not poly.is_valid:
            poly = poly.buffer(0)
        rect = poly.minimum_rotated_rectangle
        if rect.geom_type == "Polygon":
            c = list(rect.exterior.coords)
            a, b = math.dist(c[0], c[1]), math.dist(c[1], c[2])
        else:
            x0, y0, x1, y1 = poly.bounds
            a, b = x1 - x0, y1 - y0
    except Exception:
        xs, ys = [q[0] for q in inner], [q[1] for q in inner]
        a, b = max(xs) - min(xs), max(ys) - min(ys)
    return round(max(a, b), 2), round(min(a, b), 2)


def spread(values):
    q = np.percentile(np.array(values, float), [0, 25, 50, 75, 100])
    return {k: round(float(v), 2) for k, v in zip(("min", "p25", "median", "p75", "max"), q)}


# ---------- thumbnails ----------

def framed(plan, owners):
    """The plan cut down to the house for its thumbnail: the solids the rooms own, plus any other
    solid that reaches within a margin of them and is not much longer than the house itself
    (a pool stays; a 110 m approach path or a far garden wall, which would shrink the house to a
    speck, does not). Returns the plan itself when nothing is left out."""
    boxes = []
    for lf in plan["leaves"]:
        V, _ = primitives.realize(lf["k"], lf["s"])
        xs, ys = [q[0] for q in V], [q[1] for q in V]
        boxes.append((min(xs), min(ys), max(xs), max(ys)))
    own = [b for b, who in zip(boxes, owners) if who is not None]
    if not own:
        return plan
    x0, y0 = min(b[0] for b in own), min(b[1] for b in own)
    x1, y1 = max(b[2] for b in own), max(b[3] for b in own)
    size = max(x1 - x0, y1 - y0)
    m = max(6.0, 0.35 * size)
    keep = [lf for lf, b, who in zip(plan["leaves"], boxes, owners)
            if who is not None or (b[0] <= x1 + m and b[2] >= x0 - m and b[1] <= y1 + m and b[3] >= y0 - m
                                   and max(b[2] - b[0], b[3] - b[1]) <= 2.5 * max(size, 8.0))]
    if len(keep) == len(plan["leaves"]):
        return plan
    return dict(plan, leaves=keep)


def tmp_name(path):
    """A temporary file next to path, unique to this process (two exports may run at once)."""
    return path.with_name(f"{path.name}.{os.getpid()}.tmp")


def thumbnail(plan, out, tmpdir):
    """Axonometric at 960 px (preview.axon supersamples it 2x), downscaled to 480 px wide and
    reduced to a palette until the PNG is at most 80 KB. Returns the bytes written."""
    big = Path(tmpdir) / "axon.png"
    preview.axon(plan, big, size=(960, 686))
    im = Image.open(big).convert("RGB")
    tmp = tmp_name(out)
    for w in (THUMB_W, 400, 320, 240):
        sm = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
        for colours in (256, 128, 64, 32):
            q = sm.quantize(colours, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
            q.save(tmp, "PNG", optimize=True)
            size = tmp.stat().st_size
            if size <= THUMB_MAX_BYTES:
                os.replace(tmp, out)
                return size
            tmp.unlink(missing_ok=True)
    raise RuntimeError("thumbnail stays over 80 KB")


# ---------- export ----------

def non_finite(obj, where=""):
    """Path of the first NaN or Infinity in a parsed JSON value (Python's json accepts them, a
    browser's JSON.parse does not), or None."""
    if isinstance(obj, float):
        return None if math.isfinite(obj) else (where or "/")
    if isinstance(obj, dict):
        items = obj.items()
    elif isinstance(obj, list):
        items = enumerate(obj)
    else:
        return None
    for k, v in items:
        hit = non_finite(v, f"{where}/{k}")
        if hit:
            return hit
    return None


def write_json(path, obj):
    tmp = tmp_name(path)
    data = json.dumps(obj, separators=(",", ":"), ensure_ascii=False, allow_nan=False).encode("utf-8")
    try:
        tmp.write_bytes(data)
        os.replace(tmp, path)
    finally:
        tmp.unlink(missing_ok=True)
    return len(data)


def export_project(path, skp_dir):
    """Compile one project file. Returns (library project, library rooms, res document, plan,
    owner room id per leaf, notes)."""
    p = rdb.load(path)
    bad = non_finite(p)
    if bad:
        raise rdb.Problem(f"non-finite number (NaN or Infinity) at {bad}")
    slug = p["slug"]
    if path.stem != slug:
        raise rdb.Problem(f"slug {slug!r} does not match the file name")
    plan, index, warnings, owners, exact = compile_with_owners(p)
    if not plan["leaves"] or not index:
        raise rdb.Problem("no rooms or solids yet (project still being written?)")
    notes = [f"compiler: {w}" for w in warnings]
    if not exact:
        notes.append("solids assigned to rooms by group (rdb.py emission order changed); "
                     "same-named rooms on one level share their solids")
    groups = plan["groups"]
    room_group = room_groups(plan, index)
    shared = {}
    for row in index:
        shared.setdefault(row["group_path"], []).append(row["room_id"])
    for gp, ids in shared.items():
        if len(ids) > 1:
            notes.append(f"rooms {', '.join(ids)} share the SketchUp group {gp!r} (same name on one level)")
    p2d = {r["id"]: r for r in plan["plan2d"]}
    owned = {}
    for i, who in enumerate(owners):
        if who is not None:
            owned.setdefault(who, []).append(i)

    res_rooms, lib_rooms = [], []
    for row in index:
        rid = row["room_id"]
        d2 = p2d[rid]
        g = room_group[rid]
        w, d = plan_sides(d2["inner"])
        res_rooms.append({"room_id": rid, "name": row["name"], "type": row["type"], "level": row["level"],
                          "group": g, "origin": groups[g]["origin"],
                          "outline": ring4(d2["outline"]), "inner": ring4(d2["inner"]),
                          "area": row["area_m2"], "height": row["clear_height_m"], "outdoor": row["outdoor"],
                          "leaves": owned.get(rid, [])})
        lib_rooms.append({"key": f"{slug}#{rid}", "slug": slug, "project": row["project"], "room_id": rid,
                          "name": row["name"], "type": row["type"], "level": row["level"],
                          "outdoor": row["outdoor"], "area": row["area_m2"], "height": row["clear_height_m"],
                          "w": w, "d": d, "doors": row["doors"], "windows": row["windows"],
                          "confidence": row["confidence"]})

    bb = plan["totals"]["bbox_in"]
    acc = p.get("accuracy") or {}
    has_skp = (skp_dir / f"{slug}.skp").is_file()
    lib_project = {"slug": slug, "name": p["name"], "architect": p.get("architect"),
                   "location": p.get("location"), "year": p.get("year"),
                   "accuracy": {"level": acc.get("level"), "basis": acc.get("basis")},
                   "rooms": len(index), "solids": len(plan["leaves"]), "levels": plan["levels"],
                   "bbox": [[round(c / rdb.IN, 3) for c in bb[0]], [round(c / rdb.IN, 3) for c in bb[1]]],
                   "skp_url": SKP_URL.format(slug=slug) if has_skp else None,
                   "skp_raw_url": SKP_RAW_URL.format(slug=slug) if has_skp else None,
                   "aa_url": (p.get("aa") or {}).get("url") or AA_ARTICLE.format(slug=slug),
                   "warnings": len(warnings)}
    res = {"schema": SCHEMA, "slug": slug, "name": p["name"], "materials": plan["materials"],
           "levels": plan["levels"], "bbox_in": bb, "groups": groups, "leaves": plan["leaves"],
           "rooms": res_rooms}
    try:                                    # browsers' JSON.parse rejects NaN and Infinity
        json.dumps([lib_project, lib_rooms, res], allow_nan=False)
    except ValueError:
        raise rdb.Problem("non-finite number (NaN or Infinity) in the compiled project") from None
    return lib_project, lib_rooms, res, plan, owners, notes


def export(out, projects_dir, skp_dir, prefix="data/", thumbs=True, log=print):
    out = Path(out)
    res_dir = out / "res"
    res_dir.mkdir(parents=True, exist_ok=True)
    projects, rooms, skipped = [], [], []
    sizes = {"res_json": 0, "res_png": 0}
    keep = set()
    with tempfile.TemporaryDirectory() as tmpdir:
        for path in sorted(Path(projects_dir).glob("*.json")):
            try:
                lib_project, lib_rooms, res, plan, owners, notes = export_project(path, skp_dir)
            except Exception as e:                  # half-written, invalid or failing project
                msg = f"{type(e).__name__}: {e}"
                log(f"warning: skipped {path.name}: {msg}")
                skipped.append({"file": path.name, "reason": msg[:300]})
                continue
            slug = lib_project["slug"]
            for n in notes:
                log(f"note: {slug}: {n}")
            try:
                sizes["res_json"] += write_json(res_dir / f"{slug}.json", res)
            except Exception as e:
                msg = f"{type(e).__name__}: {e}"
                log(f"warning: skipped {path.name}: cannot write its export: {msg}")
                skipped.append({"file": path.name, "reason": msg[:300]})
                continue
            keep.add(f"{slug}.json")
            lib_project["file"] = f"{prefix}res/{slug}.json"
            lib_project["thumb"] = None
            if thumbs:
                try:
                    sizes["res_png"] += thumbnail(framed(plan, owners), res_dir / f"{slug}.png", tmpdir)
                    keep.add(f"{slug}.png")
                    lib_project["thumb"] = f"{prefix}res/{slug}.png"
                except Exception as e:
                    log(f"warning: {slug}: no thumbnail: {type(e).__name__}: {e}")
            elif (res_dir / f"{slug}.png").is_file():
                keep.add(f"{slug}.png")
                lib_project["thumb"] = f"{prefix}res/{slug}.png"
            projects.append(lib_project)
            rooms += lib_rooms

    types = {}
    for r in rooms:
        types.setdefault(r["type"], []).append(r)
    library = {"schema": SCHEMA,
               "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "projects": projects,
               "types": {t: {"count": len(rs), "area": spread([r["area"] for r in rs]),
                             "height": spread([r["height"] for r in rs]), "w": spread([r["w"] for r in rs]),
                             "d": spread([r["d"] for r in rs]), "rooms": [r["key"] for r in rs]}
                         for t, rs in sorted(types.items())},
               "rooms": rooms,
               "skipped": skipped}
    sizes["library"] = write_json(out / "library.json", library)
    removed = []
    for f in sorted(res_dir.iterdir()):
        if f.is_file() and f.suffix in (".json", ".png") and f.name not in keep:
            f.unlink(missing_ok=True)
            removed.append(f.name)
    for f in res_dir.glob(f"*.{os.getpid()}.tmp"):
        f.unlink(missing_ok=True)
    if removed:
        log(f"removed {len(removed)} unused res files: {', '.join(removed)}")
    n_leaves = sum(pr["solids"] for pr in projects)
    log(f"export_web: {len(projects)} projects, {len(rooms)} rooms, {n_leaves} solids, "
        f"{sum(1 for pr in projects if pr['thumb'])} thumbnails, {len(skipped)} skipped; "
        f"library.json {sizes['library'] / 1024:.1f} KB, res/*.json {sizes['res_json'] / 1024:.1f} KB, "
        f"res/*.png {sizes['res_png'] / 1024:.1f} KB -> {out}")
    return library, sizes


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", default=str(ROOT / "build" / "web"))
    ap.add_argument("--projects", default=str(ROOT / "projects"))
    ap.add_argument("--skp", default=str(ROOT / "skp"))
    ap.add_argument("--prefix", default="data/", help="put in front of res/ paths in library.json")
    ap.add_argument("--no-thumbs", action="store_true", help="keep existing thumbnails instead of rendering")
    ap.add_argument("--strict", action="store_true", help="exit 1 if any project was skipped")
    a = ap.parse_args(argv)
    library, _ = export(a.out, a.projects, Path(a.skp), a.prefix, thumbs=not a.no_thumbs)
    return 1 if a.strict and library["skipped"] else 0


if __name__ == "__main__":
    sys.exit(main())
