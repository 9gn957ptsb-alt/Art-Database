#!/usr/bin/env python3
"""Merge every generated object into one payload for the single artifact.

One artifact holds every object, whatever its theme — new objects are added
here and republished to the same URL rather than spawning another artifact.

Two kinds of object share one renderer:
  * ``shimmer`` — a still sprite whose palette breathes. Each cell walks its
    slot's cycle of near-identical real colours at its own phase.
  * ``frames``  — a precomputed animation, one full grid per frame.

Each object also carries a ``built`` record: the ramp it was designed against,
how many real colours backed each step, and the decisions behind it. That record
is what stops the next object from being designed blind, and it is read back
alongside the viewer's feedback from the artifact's database.

Reads data/theme_ancient.json and data/waterfall.json; writes data/objects.json.

Usage:
    python3 scripts/build_objects.py
"""

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPRITES_PATH = ROOT / "data" / "sprites.json"
THUMBS_PATH = ROOT / "data" / "thumbs.json"
FALL_PATH = ROOT / "data" / "waterfall.json"
OUT_PATH = ROOT / "data" / "objects.json"

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
    "waterfall": "The theme-less one: a motion rather than a thing. Blues and whites only, "
                 "falling a row at a time. Foam ignores the palette entirely, because real "
                 "whitewater is white in any light.",
}

BUILT = {
    "amphora": {"grid": "21 × 23", "ramp": "papyrus, black-figure, umber, 4 terracotta steps, bone",
                "backing": "22–563 real colours per ramp step",
                "lessons": ["A ramp that only changes value reads as flat clip art; the hue has to shift too — this shadow leans purple, the highlight leans warm ochre.",
                            "Per-cell colour variation is grit. A whole region holds one colour and changes as one."]},
    "scarab": {"grid": "19 × 20", "ramp": "dark stone, outline, bronze, 4 gold steps, 2 lapis",
               "backing": "27–64 real colours per ramp step",
               "lessons": ["A beetle is widest high, at the pronotum. Widest in the middle reads as a lozenge.",
                           "Legs must run unbroken from the body and be two pixels deep, or they read as specks."]},
    "column": {"grid": "17 × 26", "ramp": "dark ground, crack, 4 limestone steps, deep shadow",
               "backing": "64 real colours per ramp step — the collection's deepest seam",
               "lessons": ["The contour is traced from the silhouette, not computed per row — per-row outlines stack a dark band down every diagonal and bury the object.",
                           "Flutes need hard steps. A gradient at this resolution reads as blur, not carved stone."]},
    "waterfall": {"grid": "28 × 38 × 96 frames", "ramp": "designed lightness field, not a ramp",
                  "backing": "blues, cyans, teals (180–250°) plus every neutral",
                  "lessons": ["Foam must ignore the hue phase — white water is white in any light.",
                              "Hue penalty has to scale with saturation, or warm greys drag a "
                              "blue scene tan.",
                              "Matching on lightness alone speckles; prefer the band's hue."]},
}


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
    for path in (SPRITES_PATH, FALL_PATH):
        if not path.exists():
            sys.exit(f"{path} not found — run its build script first.")

    sprites = json.loads(SPRITES_PATH.read_text())
    fall = json.loads(FALL_PATH.read_text())

    artworks, artwork_index, palette, palette_index = [], {}, [], {}

    sprite_map = remap(sprites, artworks, artwork_index, palette, palette_index)
    ancient = []
    for obj in sprites["objects"]:
        ancient.append({
            "key": obj["key"], "name": obj["name"], "kind": "sprite",
            "cols": obj["cols"], "rows": obj["rows"], "grid": obj["grid"],
            "cycles": [[sprite_map[i] for i in cyc] for cyc in obj["cycles"]],
            "note": obj["note"], "built": BUILT[obj["key"]],
        })

    fall_map = remap(fall, artworks, artwork_index, palette, palette_index)
    waterfall = {
        "key": "waterfall", "name": "Waterfall", "kind": "frames",
        "cols": fall["columns"], "rows": fall["rows"],
        "frames": fall["frames"], "frameMs": fall["frameMs"],
        # -1 is a hole: no background, so only the water is drawn and only the
        # water is clickable.
        "cells": [[(fall_map[i] if i >= 0 else -1) for i in frame] for frame in fall["cells"]],
        "note": NOTES["waterfall"], "built": BUILT["waterfall"],
    }

    thumbs = attach_thumbs(artworks)

    payload = {
        "cycleSteps": sprites["cycleSteps"],
        "artworks": artworks,
        "palette": palette,
        "themes": [
            {"key": "ancient", "name": "Ancient",
             "blurb": "Chosen by the colours, not by taste. This collection holds 778 colours "
                      "near limestone and 485 near black-figure black, against 1 near pine "
                      "green — so ancient is what it can honestly render.",
             "objects": ancient},
            {"key": "abstract", "name": "Abstract",
             "blurb": "Objects that are a motion rather than a thing. Kept apart from the "
                      "themed ones because they answer to physics instead of to a period.",
             "objects": [waterfall]},
        ],
    }

    OUT_PATH.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB)")
    print(f"  {sum(len(t['objects']) for t in payload['themes'])} objects, "
          f"{len(palette)} colours across {len(artworks)} works ({thumbs} previews)")


if __name__ == "__main__":
    main()
