#!/usr/bin/env python3
"""The theatre at the Folger: Shakespeare's scenes as isometric pixel art, standing on DIRT.

Every scene in scripts/theatre/scenes.py is drawn frame by frame by the renderer in
scripts/theatre/ — four frames round a loop between lines, and four more for each
person who has a line, in the pose they say it in. The page needs only what changes,
so each scene is written as one picture: the first frame whole, then every other frame
as the rectangle that differs from the frame it is laid over, packed alongside.

    python3 scripts/build_theatre.py [--only ghost,balcony] [--jobs 4]

Writes docs/v2/theatre/<key>.png for each scene and for the library itself, and
docs/v2/theatre/theatre.json, which says where everything is.
"""

import argparse
import json
import math
import sys
import time
from multiprocessing import Pool
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts" / "theatre"))

OUT = ROOT / "docs" / "v2" / "theatre"
PAD = 6


def specs():
    import scenes
    return scenes.REPERTORY + [scenes.FOLGER]


def spec_by(key):
    return [s for s in specs() if s["key"] == key][0]


def variants(spec):
    """Every other state a scene is drawn in besides its loop and its speakers: the Chorus's
    materials ("looks", each a loop of its own) and the library's standing and walking
    ("moves"). Returned as (kind, name, index, t, kwargs)."""
    out = []
    for i in range(1, len(spec.get("looks", []))):
        for t in range(FRAMES_):
            out.append(("look", i, t, t, {"look": i}))
    for name, frames in spec.get("moves", {}).items():
        for i, kw in enumerate(frames):
            out.append(("move", name, i, 0, kw))
    return out


FRAMES_ = 4


def frame_of(args):
    key, t, who, extra, origin, size = args
    from stage import image
    spec = spec_by(key)
    scene = spec["build"](t, who, **dict(extra))
    f = scene.draw(t, None if who is None else who + 1, origin=origin, size=size)
    return key, t, who, extra, np.asarray(image(f))


def geometry(key):
    import scenes
    from engine import project
    spec = spec_by(key)
    scene = spec["build"](0, None)
    origin, size = scene.bounds()
    # A scene drawn in other states must fit every one of them.
    for _, _, _, t, kw in variants(spec):
        o2, s2 = spec["build"](t, None, **kw).bounds()
        x0, y0 = min(origin[0], o2[0]), min(origin[1], o2[1])
        x1, y1 = max(origin[0] + size[0], o2[0] + s2[0]), max(origin[1] + size[1], o2[1] + s2[1])
        origin, size = (x0, y0), (x1 - x0, y1 - y0)
    origin = (origin[0] - PAD, origin[1] - PAD)
    size = (size[0] + 2 * PAD, size[1] + 2 * PAD)
    heads = []
    for i in range(len(spec["cast"])):
        fig = scene.figures.get(i + 1)
        if fig is None:
            heads.append(None)
            continue
        if hasattr(fig, "head_c"):
            top = fig.world(fig.head_c + np.array([0, 0, 6.0]))
        else:
            top = fig.anchor
        u, vv = project(top)
        heads.append([int(round(u - origin[0])), int(round(vv - origin[1]))])
    return origin, size, heads


def changed(a, b):
    """The rectangle where two frames differ, or None."""
    diff = np.any(a != b, axis=2)
    ys, xs = np.nonzero(diff)
    if not len(xs):
        return None
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def pack(pieces, width):
    """Shelf packing: pieces are (w, h); returns their (x, y) and the height used."""
    x = y = shelf = 0
    at = []
    for w, h in pieces:
        if x + w > width:
            x = 0
            y += shelf
            shelf = 0
        at.append((x, y))
        x += w
        shelf = max(shelf, h)
    return at, y + shelf


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--jobs", type=int, default=4)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    import scenes
    frames = scenes.FRAMES

    keys = [s["key"] for s in specs()]
    if args.only:
        keys = [k for k in keys if k in args.only.split(",")]

    t0 = time.time()
    geo = {k: geometry(k) for k in keys}
    jobs = []
    for k in keys:
        spec = spec_by(k)
        # The Chorus speaks as it walks: it has no pose of its own for a line.
        states = [None] + ([] if spec.get("looks") else sorted({line[0] for line in spec["lines"]}))
        for who in states:
            for t in range(frames):
                jobs.append((k, t, who, (), geo[k][0], geo[k][1]))
        for _, _, _, t, kw in variants(spec):
            jobs.append((k, t, None, tuple(sorted(kw.items())), geo[k][0], geo[k][1]))
    with Pool(args.jobs) as pool:
        done = pool.map(frame_of, jobs, chunksize=1)
    got = {(k, t, who, extra): img for k, t, who, extra, img in done}
    print("rendered %d frames in %.0fs" % (len(done), time.time() - t0))

    manifest_path = OUT / "theatre.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {"scenes": []}
    old = {s["key"]: s for s in manifest.get("scenes", [])}
    if "library" in manifest:
        old["folger"] = manifest["library"]

    for k in keys:
        spec = spec_by(k)
        origin, size, heads = geo[k]
        w, h = size
        base = got[(k, 0, None, ())]
        pieces = []                       # (kind, who, t, rect, array)
        for t in range(1, frames):
            r = changed(got[(k, t, None, ())], base)
            pieces.append(("idle", None, t, r, got[(k, t, None, ())]))
        speakers = [] if spec.get("looks") else sorted({line[0] for line in spec["lines"]})
        for who in speakers:
            for t in range(frames):
                r = changed(got[(k, t, who, ())], got[(k, t, None, ())])
                pieces.append(("speak", who, t, r, got[(k, t, who, ())]))
        for kind, name, i, t, kw in variants(spec):
            img = got[(k, t, None, tuple(sorted(kw.items())))]
            r = changed(img, base)
            pieces.append((kind, (name, i), t, r, img))
        sizes = [(r[2] - r[0], r[3] - r[1]) if r else (0, 0) for _, _, _, r, _ in pieces]
        width = max(w * 2, 256)
        at, used = pack([(w, h)] + [s for s in sizes if s[0]], width)
        sheet = np.zeros((used, width, 4), np.uint8)
        sheet[0:h, 0:w] = base
        idle = [None] * frames
        speak = {str(who): [None] * frames for who in speakers}
        looks = [[None] * frames for _ in spec.get("looks", [])]
        moves = {name: [None] * len(fr) for name, fr in spec.get("moves", {}).items()}
        slot = 1
        for (kind, who, t, r, img), (pw, ph) in zip(pieces, sizes):
            if not pw:
                continue
            sx, sy = at[slot]
            slot += 1
            sheet[sy:sy + ph, sx:sx + pw] = img[r[1]:r[3], r[0]:r[2]]
            entry = [sx, sy, pw, ph, r[0], r[1]]
            if kind == "idle":
                idle[t] = entry
            elif kind == "look":
                looks[who[0]][t] = entry
            elif kind == "move":
                moves[who[0]][who[1]] = entry
            else:
                speak[str(who)][t] = entry
        if looks:
            looks[0] = [None] + idle[1:]
        im = Image.fromarray(sheet, "RGBA")
        im.save(OUT / (k + ".png"), optimize=True)
        entry = {
            "key": k, "play": spec["play"], "title": spec["title"], "where": spec["where"],
            "cast": spec["cast"], "lines": spec["lines"],
            "w": w, "h": h, "sheet": k + ".png", "idle": idle, "speak": speak, "heads": heads,
        }
        if looks:
            entry["looks"] = looks
        if moves:
            entry["moves"] = moves
        if spec.get("after"):
            entry["after"] = spec["after"]
        # The first row the resting picture has anything in, so the page can set it where
        # it stood before it had room to stand up in.
        rows = np.nonzero(base[..., 3].any(1))[0]
        entry["top"] = int(rows[0]) if len(rows) else 0
        old[k] = entry
        kb = (OUT / (k + ".png")).stat().st_size / 1024
        print("%-9s %3dx%-3d sheet %4dx%-4d %5.0f KB" % (k, w, h, width, used, kb))

    order = [s["key"] for s in scenes.REPERTORY]
    out = {"frames": frames, "fps": 6,
           "scenes": [old[k] for k in order if k in old],
           "library": old.get("folger")}
    manifest_path.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    total = sum(p.stat().st_size for p in OUT.glob("*.png")) / 1024
    print("all sheets %.0f KB, %.0fs" % (total, time.time() - t0))


if __name__ == "__main__":
    main()
