#!/usr/bin/env python3
"""Draw a labelled pixel grid over a plan image (or a zoomed crop of it), so wall positions
can be read off in pixels and turned into metres with the plan's scale.

    python3 residential/tools/grid.py IMAGE OUT.png [--step 50] [--crop X0 Y0 X1 Y1] [--zoom 2]

Grid labels are in the original image's pixel coordinates, also inside a crop.
"""
import sys

from PIL import Image, ImageDraw, ImageFont


def main(src, out, *rest):
    arg = lambda k, n=1, d=None: rest[rest.index(k) + 1: rest.index(k) + 1 + n] if k in rest else d
    step = int(arg("--step", 1, ["50"])[0])
    zoom = float(arg("--zoom", 1, ["1"])[0])
    img = Image.open(src).convert("RGB")
    x0, y0, x1, y1 = map(int, arg("--crop", 4, [0, 0, img.width, img.height]))
    img = img.crop((x0, y0, x1, y1))
    if zoom != 1:
        img = img.resize((int(img.width * zoom), int(img.height * zoom)), Image.LANCZOS)
    dr = ImageDraw.Draw(img, "RGBA")
    try:
        f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
    except OSError:
        f = ImageFont.load_default()
    first_x = (x0 // step + 1) * step
    for gx in range(first_x, x1, step):
        px = (gx - x0) * zoom
        major = gx % (step * 5) == 0
        dr.line([(px, 0), (px, img.height)], fill=(255, 0, 0, 160 if major else 70), width=1)
        dr.text((px + 2, 2), str(gx), fill=(200, 0, 0, 255), font=f)
    first_y = (y0 // step + 1) * step
    for gy in range(first_y, y1, step):
        py = (gy - y0) * zoom
        major = gy % (step * 5) == 0
        dr.line([(0, py), (img.width, py)], fill=(0, 90, 255, 160 if major else 70), width=1)
        dr.text((2, py + 2), str(gy), fill=(0, 60, 200, 255), font=f)
    img.save(out)
    print(out, img.size)


if __name__ == "__main__":
    main(*sys.argv[1:])
