#!/usr/bin/env python3
"""DIRT Poetry: the four pages of Picture Poetry, painted in DIRT, on a plane.

Builds one self-contained page from plane.html (beside this file) and the pages themselves, which stay private:
dirt/private/poetry/ holds Picture Poetry's page and photo images and poems.json (the poems as transcribed from the
pages). Nothing of the pages is written into the repository; the built page goes where it is told.

    python3 dirt/poetry/build_poetry.py OUT.html

The photographs become the paint: each cropped square, 768 pixels, mipmapped on the GPU. The poems are taken from
the page images as they are set there (their face, sizes, indents, titles and rules), each cropped round its poem;
the page knows where its title, first line and line pitch fall, measured from the images, so a strip torn from a
page carries whole lines.
"""
import base64
import html
import io
import json
import sys
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PRIVATE = HERE.parent / "private" / "poetry"
PHOTO = 768
TEXT = (672, 688)

# Each page: where its photograph is (the file, and the square cropped from it), where its poem is (the crop round
# it, in the page image's pixels), the poem's left and right, its title's top (or -1), its first line's top, its
# line pitch and its lines (page 2's count runs on over its two empty lines to its signature).
PAGES = [
    {"photo": ("photo-1.jpg", (0, 120, 675, 795)), "page": "page-1.jpg", "crop": (85, 175, 600, 620),
     "x": (117, 554), "title": 214, "first": 327, "pitch": 27.4, "lines": 10},
    {"photo": ("photo-2.jpg", (30, 0, 705, 675)), "page": "page-2.jpg", "crop": (65, 360, 490, 735),
     "x": (97, 457), "title": -1, "first": 392, "pitch": 25.8, "lines": 13},
    {"photo": ("photo-3.jpg", (0, 112, 675, 787)), "page": "page-3.jpg", "crop": (1115, 175, 1615, 850),
     "x": (1150, 1579), "title": 210, "first": 333, "pitch": 31.67, "lines": 16},
    {"photo": ("page-4.jpg", (132, 136, 949, 953)), "page": "page-4.jpg", "crop": (100, 1140, 765, 1670),
     "x": (132, 726), "title": 1176, "first": 1287, "pitch": 28.33, "lines": 13},
]

# Each page's colours, measured from its photograph (k-means in RGB, 14 clusters, ranked by chroma and share): its
# paper (the page's own ground), light, mid, a deep colour for the large fields (the photograph's own hue, deepened:
# Boiling's sunset to burnt orange, the second page's sky to deep blue, For What's sky to teal, the lawn's shade to
# a living green), an accent for halftone, brush and kaleidoscope (Boiling's brick, the second page's lens-flare rose,
# For What's cloud light, the sunlit lawn), and two pastels for torn pieces.
PALETTE = [
    [(240, 238, 231), (240, 213, 166), (176, 172, 144), (198, 110, 52), (176, 96, 58), (244, 214, 176), (210, 198, 224)],
    [(233, 236, 241), (168, 187, 215), (115, 149, 193), (48, 84, 168), (206, 124, 168), (196, 214, 240), (238, 200, 216)],
    [(235, 239, 240), (181, 209, 214), (174, 179, 169), (70, 128, 150), (200, 160, 104), (198, 226, 234), (244, 222, 196)],
    [(238, 239, 234), (221, 218, 210), (109, 118, 117), (62, 108, 54), (160, 158, 62), (218, 224, 160), (230, 214, 206)],
]


def data_uri(im, quality=84):
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode("ascii")


def build(out):
    poems = json.loads((PRIVATE / "poems.json").read_text(encoding="utf-8"))["pages"]
    photos, texts, txt_a, txt_b, pages = [], [], [], [], []
    for spec, poem in zip(PAGES, poems):
        name, box = spec["photo"]
        photos.append(data_uri(Image.open(PRIVATE / name).convert("RGB").crop(box).resize((PHOTO, PHOTO), Image.LANCZOS)))
        page = Image.open(PRIVATE / spec["page"]).convert("RGB")
        crop = page.crop(spec["crop"])
        layer = Image.new("RGB", TEXT, page.getpixel((spec["crop"][0] + 4, spec["crop"][1] + 4)))
        layer.paste(crop, (0, 0))
        texts.append(data_uri(layer, quality=90))
        txt_a += [spec["crop"][0], spec["crop"][1], spec["x"][0], spec["x"][1]]
        txt_b += [spec["title"], spec["first"], spec["pitch"], spec["lines"]]
        pages.append({"n": poem["n"], "title": poem.get("title"), "signature": poem.get("signature")})
    assets = {
        "photos": photos, "texts": texts, "photoSize": PHOTO, "textSize": list(TEXT),
        "palette": [v for page in PALETTE for c in page for v in c], "txtA": txt_a, "txtB": txt_b, "pages": pages,
    }
    sr = []
    for poem in poems:
        head = poem.get("title") or (poem.get("signature") or "").lstrip("—")
        lines = "<br>".join(html.escape(l) for l in poem["lines"])
        sign = "<br><br>" + html.escape(poem["signature"]) if poem.get("signature") else ""
        sr.append("<h2>%s</h2><p>%s%s</p>" % (html.escape(head), lines, sign))
    page = (HERE / "plane.html").read_text(encoding="utf-8")
    page = page.replace("__ASSETS__", json.dumps(assets, separators=(",", ":"))).replace("__POEMS_HTML__", "".join(sr))
    Path(out).write_text(page, encoding="utf-8")
    print(out, "%.2f MB" % (len(page.encode("utf-8")) / 1e6))


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "dirt-poetry.html")
