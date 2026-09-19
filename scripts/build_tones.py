"""Read each collage's own colours off its photograph.

The world's continents are his works. They were wearing one of four
blue-greys, which is not a colour so much as the absence of one, and at the
size a dot is drawn it left the land looking like weather rather than land.

The works themselves are right there in docs/images/, so the colours come
off them: each photograph is cut down, quantised, and the colours that are
actually doing something in it are kept — paper white and shadow black drop
out, since every collage has plenty of both and neither says which work it
is. What is left is four colours in the order the work uses them.

    python3 scripts/build_tones.py

Reads docs/works.json and docs/images/<slug>.jpg, writes docs/v2/tones.json.
Nothing here is metadata about the work; it is a measurement of the picture,
and the site is free to push it wherever it needs to for legibility.
"""

import json
import pathlib

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parent.parent
WORKS = HERE / "docs" / "works.json"
IMAGES = HERE / "docs" / "images"
OUT = HERE / "docs" / "v2" / "tones.json"

KEEP = 4
BOXES = 16


def hsl(rgb):
    r, g, b = [v / 255 for v in rgb]
    hi, lo = max(r, g, b), min(r, g, b)
    light = (hi + lo) / 2
    if hi == lo:
        return 0.0, 0.0, light
    d = hi - lo
    sat = d / (2 - hi - lo) if light > 0.5 else d / (hi + lo)
    if hi == r:
        hue = ((g - b) / d + (6 if g < b else 0)) / 6
    elif hi == g:
        hue = ((b - r) / d + 2) / 6
    else:
        hue = ((r - g) / d + 4) / 6
    return hue, sat, light


def tones(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((220, 220))
    # The mount and the wall around a photographed collage are not the work.
    w, h = im.size
    im = im.crop((int(w * 0.06), int(h * 0.06), int(w * 0.94), int(h * 0.94)))

    small = im.quantize(colors=BOXES, method=Image.Quantize.MEDIANCUT)
    pal = small.getpalette()[: BOXES * 3]
    counts = sorted(small.getcolors(), reverse=True)

    out = []
    for n, i in counts:
        rgb = tuple(pal[i * 3: i * 3 + 3])
        _, sat, light = hsl(rgb)
        # Paper and shadow are in every one of these and tell them apart not
        # at all; so is anything with no colour left in it.
        if light > 0.86 or light < 0.10:
            continue
        if sat < 0.06 and 0.3 < light < 0.72:
            continue
        # Nothing too near a colour already taken.
        if any(sum(abs(a - b) for a, b in zip(rgb, was)) < 60 for was in out):
            continue
        out.append(rgb)
        if len(out) == KEEP:
            break

    while len(out) < KEEP:
        out.append(out[-1] if out else (120, 120, 130))
    return ["#%02x%02x%02x" % c for c in out]


def main():
    works = json.loads(WORKS.read_text())["works"]
    found = {}
    for work in works:
        path = IMAGES / (work["slug"] + ".jpg")
        if not path.exists():
            print("no photograph for", work["slug"])
            continue
        found[work["slug"]] = tones(path)
        print("%-24s %s" % (work["slug"], " ".join(found[work["slug"]])))

    OUT.write_text(json.dumps({
        "note": ("Colours measured off each collage's own photograph by "
                 "scripts/build_tones.py. Not metadata — a measurement."),
        "tones": found
    }, indent=1) + "\n")
    print("wrote", OUT.relative_to(HERE), OUT.stat().st_size, "bytes")


if __name__ == "__main__":
    main()
