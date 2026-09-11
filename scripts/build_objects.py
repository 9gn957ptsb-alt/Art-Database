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
THEME_PATH = ROOT / "data" / "theme_ancient.json"
FALL_PATH = ROOT / "data" / "waterfall.json"
OUT_PATH = ROOT / "data" / "objects.json"

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
    "amphora": {"grid": "30 × 42", "ramp": "papyrus, black-figure, umber, 4 terracotta steps, bone",
                "backing": "22–563 real colours per ramp step",
                "lessons": ["A narrow shading falloff splits a round form into a light half "
                            "and a dark half with a seam down the middle."]},
    "scarab": {"grid": "34 × 28", "ramp": "dark stone, outline, bronze, 4 gold steps, 2 lapis",
               "backing": "27–64 real colours per ramp step",
               "lessons": ["Blue is scarce here (8% of all colours), so it reads best as a "
                           "small inlay accent rather than a field."]},
    "column": {"grid": "26 × 46", "ramp": "dark ground, crack, 4 limestone steps, deep shadow",
               "backing": "64 real colours per ramp step — the collection's deepest seam",
               "lessons": ["The ground must silhouette: a background at the same value as the "
                           "object turns it into stripes.",
                           "Flutes need hard steps. A soft cylinder gradient at this "
                           "resolution reads as blur, not carved stone."]},
    "waterfall": {"grid": "32 × 44 × 96 frames", "ramp": "designed lightness field, not a ramp",
                  "backing": "blues, cyans, teals (180–250°) plus every neutral",
                  "lessons": ["Foam must ignore the hue phase — white water is white in any light.",
                              "Hue penalty has to scale with saturation, or warm greys drag a "
                              "blue scene tan.",
                              "Matching on lightness alone speckles; prefer the band's hue."]},
}


def remap(src, artworks, artwork_index, palette, palette_index):
    """Fold one source file's local tables into the shared ones."""
    local_palette = []
    for hex_color, art_i in src["palette"]:
        entry = src["artworks"][art_i]
        art_id = entry[0]
        if art_id not in artwork_index:
            artwork_index[art_id] = len(artworks)
            # id, title, artist, thumbnail (may be absent in either source)
            artworks.append([art_id, entry[1], entry[2], entry[3] if len(entry) > 3 else None])
        elif len(entry) > 3 and entry[3] and not artworks[artwork_index[art_id]][3]:
            artworks[artwork_index[art_id]][3] = entry[3]
        key = (hex_color, art_id)
        if key not in palette_index:
            palette_index[key] = len(palette)
            palette.append([hex_color, artwork_index[art_id]])
        local_palette.append(palette_index[key])
    return local_palette


def main():
    for path in (THEME_PATH, FALL_PATH):
        if not path.exists():
            sys.exit(f"{path} not found — run its build script first.")

    theme = json.loads(THEME_PATH.read_text())
    fall = json.loads(FALL_PATH.read_text())

    artworks, artwork_index, palette, palette_index = [], {}, [], {}

    theme_map = remap(theme, artworks, artwork_index, palette, palette_index)
    ancient = []
    for obj in theme["objects"]:
        key = obj["name"].lower()
        ancient.append({
            "key": key, "name": obj["name"], "kind": "shimmer",
            "cols": obj["cols"], "rows": obj["rows"],
            "grid": obj["grid"], "phases": obj["phases"],
            "cycles": [[theme_map[i] for i in cyc] for cyc in obj["cycles"]],
            "note": NOTES[key], "built": BUILT[key],
        })

    fall_map = remap(fall, artworks, artwork_index, palette, palette_index)
    waterfall = {
        "key": "waterfall", "name": "Waterfall", "kind": "frames",
        "cols": fall["columns"], "rows": fall["rows"],
        "frames": fall["frames"], "frameMs": fall["frameMs"],
        "cells": [[fall_map[i] for i in frame] for frame in fall["cells"]],
        "note": NOTES["waterfall"], "built": BUILT["waterfall"],
    }

    payload = {
        "cycleFrames": theme["cycleFrames"],
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
    thumbs = sum(1 for a in artworks if a[3])
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB)")
    print(f"  {len(payload['themes'])} themes, "
          f"{sum(len(t['objects']) for t in payload['themes'])} objects")
    print(f"  {len(palette)} colours across {len(artworks)} works ({thumbs} with previews)")


if __name__ == "__main__":
    main()
