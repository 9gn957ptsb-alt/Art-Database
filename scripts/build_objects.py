#!/usr/bin/env python3
"""Merge every generated object into one payload for the single artifact.

One artifact holds every object, whatever its theme — new objects are added here
and republished to the same URL rather than spawning another artifact.

Objects are filed two ways, and both go into the payload:

  * by THEME, which is what the object is of — Ancient, Abstract;
  * by FAMILY, which is how much it moves and therefore how it is stored. That
    axis lives in scripts/motion.py: a painting barely moves because it has
    almost no utility, a hammer moves a great deal because the swing is the whole
    point, and objects that sit near each other on it need the same machinery.

Three renderer kinds carry every object, one per family group:
  * ``sprite``  — a still grid whose palette breathes. Each region walks its
                  slot's cycle of near-identical real colours. Panels and vessels.
  * ``field``   — one grid of slot indices per frame, for a continuous body that
                  cannot be decomposed into parts. The waterfall.
  * ``descent`` — a program: sprites, a static part, and one track per falling
                  body, replayed by the renderer. Falling leaves, and whatever
                  falls next, for the cost of its tracks alone.

All three store slots, not colours, and resolve them through the same per-slot
cycles — which is what keeps a flat region flat and the payload small.

Each object also carries a ``built`` record — the ramp it was designed against,
how many real colours backed each step, and the decisions behind it. That record
is what stops the next object from being designed blind, and it is read back
alongside the viewer's feedback from the artifact's database.

Reads data/sprites.json, data/abstract.json, data/leaves.json and
data/falls.json; writes data/objects.json and, by injecting it into
artifact/objects.template.html, the publishable artifact/objects.html.

Usage:
    python3 scripts/build_objects.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from motion import FAMILIES, FAMILY_BY_KEY, PLACEMENTS, kin   # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SPRITES_PATH = ROOT / "data" / "sprites.json"
ABSTRACT_PATH = ROOT / "data" / "abstract.json"
LEAVES_PATH = ROOT / "data" / "leaves.json"
FALL_PATH = ROOT / "data" / "falls.json"
THUMBS_PATH = ROOT / "data" / "thumbs.json"
OUT_PATH = ROOT / "data" / "objects.json"
TEMPLATE_PATH = ROOT / "artifact" / "objects.template.html"
PAGE_PATH = ROOT / "artifact" / "objects.html"
PLACEHOLDER = "__OBJECTS__"

THUMB_EDGE = 76
THUMB_QUALITY = 52

NOTES = {
    "amphora": "A storage jar in terracotta and black-figure. The body slip, shoulder and "
               "foot are the collection's oranges and umbers; the figure band is its blacks; "
               "the lip and meander are bone.",
    "scarab": "A gold amulet with lapis inlay. Gold is the collection's ochres and yellows. "
              "Only 8% of these colours are blue at all, so blue is spent as inlay bands "
              "rather than as a field.",
    "column": "A weathered Doric shaft. Limestone is the collection's deepest seam — over "
              "1,600 near-neutral greys — which is why the flutes are cut as hard steps "
              "instead of blurred into a gradient.",
}

BUILT = {
    "amphora": {"grid": "21 x 23", "ramp": "papyrus, black-figure, umber, 4 terracotta steps, bone",
                "backing": "22-563 real colours per ramp step",
                "lessons": ["A ramp that only changes value reads as flat clip art; the hue has to shift too — this shadow leans purple, the highlight leans warm ochre.",
                            "Per-cell colour variation is grit. A whole region holds one colour and changes as one."]},
    "scarab": {"grid": "19 x 20", "ramp": "dark stone, outline, bronze, 4 gold steps, 2 lapis",
               "backing": "27-64 real colours per ramp step",
               "lessons": ["A beetle is widest high, at the pronotum. Widest in the middle reads as a lozenge.",
                           "Legs must run unbroken from the body and be two pixels deep, or they read as specks."]},
    "column": {"grid": "17 x 26", "ramp": "dark ground, crack, 4 limestone steps, deep shadow",
               "backing": "64 real colours per ramp step — the collection's deepest seam",
               "lessons": ["The contour is traced from the silhouette, not computed per row — per-row outlines stack a dark band down every diagonal and bury the object.",
                           "Flutes need hard steps. A gradient at this resolution reads as blur, not carved stone."]},
}

# A still object's colour drifts at a rate set by its place on the axis: the
# panel, which has the least motion of anything here, drifts slowest.
def sprite_interval(motion):
    return int(max(600, min(1500, round(1500 * (1 - motion)))))


def remap(src, artworks, artwork_index, palette, palette_index):
    """Fold one source file's local tables into the shared ones."""
    local = []
    for hex_color, art_i in src["palette"]:
        entry = src["artworks"][art_i]
        art_id = entry[0]
        if art_id not in artwork_index:
            artwork_index[art_id] = len(artworks)
            artworks.append([art_id, entry[1], entry[2], None])
        key = (hex_color, art_id)
        if key not in palette_index:
            palette_index[key] = len(palette)
            palette.append([hex_color, artwork_index[art_id]])
        local.append(palette_index[key])
    return local


def place(obj):
    """Attach the object's position on the motion/utility axis."""
    family_key, motion, why = PLACEMENTS[obj["key"]]
    family = FAMILY_BY_KEY[family_key]
    obj["family"] = family_key
    obj["familyName"] = family["name"]
    obj["motion"] = motion
    obj["why"] = why
    obj["shares"] = family["shares"]
    obj["kin"] = kin(obj["key"])
    return obj


def attach_thumbs(artworks):
    """Inline one small preview per work, shared across every object."""
    if not THUMBS_PATH.exists():
        print("no data/thumbs.json — previews will fall back to the colour swatch")
        return 0
    import base64, io
    from PIL import Image
    source = json.loads(THUMBS_PATH.read_text())
    made = 0
    for entry in artworks:
        uri = source.get(entry[0])
        if not uri or "," not in uri:
            continue
        try:
            raw = base64.b64decode(uri.split(",", 1)[1])
            img = Image.open(io.BytesIO(raw)).convert("RGB")
            img.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="WEBP", quality=THUMB_QUALITY, method=6)
            entry[3] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode("ascii")
            made += 1
        except Exception:
            continue
    return made


def main():
    paths = (SPRITES_PATH, ABSTRACT_PATH, LEAVES_PATH, FALL_PATH)
    for path in paths:
        if not path.exists():
            sys.exit(f"{path} not found — run its build script first.")
    sprites, abstract, leaves, fall = (json.loads(p.read_text()) for p in paths)

    artworks, artwork_index, palette, palette_index = [], {}, [], {}

    def sprite_objects(src, notes=None, built=None):
        local = remap(src, artworks, artwork_index, palette, palette_index)
        out = []
        for obj in src["objects"]:
            out.append(place({
                "key": obj["key"], "name": obj["name"], "kind": "sprite",
                "cols": obj["cols"], "rows": obj["rows"], "grid": obj["grid"],
                "cycles": [[local[i] for i in cyc] for cyc in obj["cycles"]],
                "frameMs": sprite_interval(PLACEMENTS[obj["key"]][1]),
                "note": obj.get("note") if notes is None else notes[obj["key"]],
                "built": obj.get("built") if built is None else built[obj["key"]],
            }))
        return out

    ancient = sprite_objects(sprites, NOTES, BUILT)
    panels = sprite_objects(abstract)

    fall_map = remap(fall, artworks, artwork_index, palette, palette_index)
    fall_src = fall["objects"][0]
    waterfall = place({
        "key": "waterfall", "name": "Waterfall", "kind": "field",
        "cols": fall_src["cols"], "rows": fall_src["rows"],
        "frames": fall_src["frames"], "frameMs": fall_src["frameMs"],
        # -1 is a hole: no sky, so only the water is drawn and only the water is
        # clickable.
        "cells": fall_src["cells"],
        "cycles": [[fall_map[i] for i in cyc] for cyc in fall_src["cycles"]],
        "note": fall_src["note"], "built": fall_src["built"],
    })

    leaf_map = remap(leaves, artworks, artwork_index, palette, palette_index)
    leaf_src = leaves["objects"][0]
    falling_leaves = place({
        "key": "leaves", "name": "Falling Leaves", "kind": "descent",
        "cols": leaf_src["cols"], "rows": leaf_src["rows"],
        "frames": leaf_src["frames"], "frameMs": leaf_src["frameMs"],
        "wrap": leaf_src["wrap"], "margin": leaf_src["margin"],
        "shapes": leaf_src["shapes"], "tints": leaf_src["tints"],
        "static": leaf_src["static"], "tracks": leaf_src["tracks"],
        "cycles": [[leaf_map[i] for i in cyc] for cyc in leaf_src["cycles"]],
        "note": leaf_src["note"], "built": leaf_src["built"],
    })

    thumbs = attach_thumbs(artworks)

    payload = {
        "cycleSteps": sprites["cycleSteps"],
        "artworks": artworks,
        "palette": palette,
        "families": [{k: f[k] for k in ("key", "name", "motion", "utility", "shares")}
                     | {"reserved": bool(f.get("reserved"))} for f in FAMILIES],
        # Two categories: things with a form, and panels that are only
        # themselves. The waterfall and the leaves are formal — they are a
        # recognisable thing doing a recognisable motion.
        "themes": [
            {"key": "formal", "name": "Formal",
             "objects": ancient + [waterfall, falling_leaves]},
            {"key": "abstract", "name": "Abstract", "objects": panels},
        ],
    }

    blob = json.dumps(payload, separators=(",", ":"))
    OUT_PATH.write_text(blob)
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB)")

    template = TEMPLATE_PATH.read_text()
    if PLACEHOLDER not in template:
        sys.exit(f"{TEMPLATE_PATH} has no {PLACEHOLDER} placeholder.")
    # Keep a literal </script> in the data from ending the host script element.
    PAGE_PATH.write_text(template.replace(PLACEHOLDER, blob.replace("</", "<\\/")))
    print(f"Wrote {PAGE_PATH} ({PAGE_PATH.stat().st_size/1_000_000:.2f} MB "
          f"against a 16 MB limit)")
    print(f"  {sum(len(t['objects']) for t in payload['themes'])} objects, "
          f"{len(palette)} colours across {len(artworks)} works ({thumbs} previews)")
    for family in FAMILIES:
        members = [k for k, v in PLACEMENTS.items() if v[0] == family["key"]]
        print(f"  {family['motion']:.2f} {family['name']:<8} "
              f"{', '.join(members) if members else '(reserved)'}")


if __name__ == "__main__":
    main()
