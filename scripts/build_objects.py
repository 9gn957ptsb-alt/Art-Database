#!/usr/bin/env python3
"""Merge the isometric objects into one payload for the single artifact.

One artifact holds every object. New objects are added here and republished to
the same URL rather than spawning another artifact.

Everything is isometric now, so there is one renderer kind: a grid of ramp-slot
indices per frame, plus a cycle of real colours behind each slot. A still
object's frames are its four quarter turns; a moving object's frames are its
animation. That is the same shape the flat `field` objects used, which is why
the artifact renders all of it with the machinery it already had.

Objects are filed two ways, and both go into the payload:

  * by CATEGORY — Formal for anything with a recognisable form doing a
    recognisable thing, Abstract for the panels, which are only themselves;
  * by FAMILY, the motion/utility axis in scripts/motion.py, which decides how
    fast an object's colour drifts.

Reads data/iso.json; writes data/objects.json and, by injecting it into
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
ISO_PATH = ROOT / "data" / "iso.json"
THUMBS_PATH = ROOT / "data" / "thumbs.json"
OUT_PATH = ROOT / "data" / "objects.json"
TEMPLATE_PATH = ROOT / "artifact" / "objects.template.html"
PAGE_PATH = ROOT / "artifact" / "objects.html"
PLACEHOLDER = "__OBJECTS__"

THUMB_EDGE = 76
THUMB_QUALITY = 52

FORMAL = ["amphora", "column", "scarab", "waterfall", "leaves", "bounce"]
ABSTRACT = ["colour-sound", "st-jaques", "colour-fractal", "spannungsbild", "chromorphose"]


def place(obj):
    """Attach the object's position on the motion/utility axis."""
    if obj["key"] not in PLACEMENTS:
        return obj
    family_key, motion, why = PLACEMENTS[obj["key"]]
    family = FAMILY_BY_KEY[family_key]
    obj.update({"family": family_key, "familyName": family["name"], "motion": motion,
                "why": why, "shares": family["shares"], "kin": kin(obj["key"])})
    return obj


def attach_thumbs(artworks):
    """Inline one small preview per work, shared across every object."""
    if not THUMBS_PATH.exists():
        print("no data/thumbs.json — previews fall back to the colour swatch")
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
    if not ISO_PATH.exists():
        sys.exit(f"{ISO_PATH} not found — run scripts/build_iso.py first.")
    src = json.loads(ISO_PATH.read_text())

    artworks = [[a[0], a[1], a[2], None] for a in src["artworks"]]
    by_key = {o["key"]: place(o) for o in src["objects"]}
    missing = [k for k in FORMAL + ABSTRACT if k not in by_key]
    if missing:
        sys.exit(f"missing from {ISO_PATH}: {', '.join(missing)}")

    thumbs = attach_thumbs(artworks)
    payload = {
        "cycleSteps": src["cycleSteps"],
        "artworks": artworks,
        "palette": src["palette"],
        "families": [{k: f[k] for k in ("key", "name", "motion", "utility", "shares")}
                     | {"reserved": bool(f.get("reserved"))} for f in FAMILIES],
        "themes": [
            {"key": "formal", "name": "Formal", "objects": [by_key[k] for k in FORMAL]},
            {"key": "abstract", "name": "Abstract", "objects": [by_key[k] for k in ABSTRACT]},
        ],
    }

    blob = json.dumps(payload, separators=(",", ":"))
    OUT_PATH.write_text(blob)
    print(f"Wrote {OUT_PATH} ({OUT_PATH.stat().st_size/1_000_000:.2f} MB)")

    template = TEMPLATE_PATH.read_text()
    if PLACEHOLDER not in template:
        sys.exit(f"{TEMPLATE_PATH} has no {PLACEHOLDER} placeholder.")
    PAGE_PATH.write_text(template.replace(PLACEHOLDER, blob.replace("</", "<\\/")))
    print(f"Wrote {PAGE_PATH} ({PAGE_PATH.stat().st_size/1_000_000:.2f} MB "
          f"against a 16 MB limit)")
    print(f"  {len(FORMAL) + len(ABSTRACT)} objects, {len(src['palette'])} colours "
          f"across {len(artworks)} works ({thumbs} previews)")


if __name__ == "__main__":
    main()
