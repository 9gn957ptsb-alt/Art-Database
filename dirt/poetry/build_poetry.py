#!/usr/bin/env python3
"""DIRT Poetry: the five pages of Picture Poetry, each laid whole on a plane painted in DIRT.

Builds one self-contained page from plane.html (beside this file) and the pages themselves, which stay private:
dirt/private/poetry/ holds Picture Poetry's page images, overlays/ (each page's buildings and characters as the
Picture Poetry artifact draws them over the page, captured on a transparent ground at the page image's size) and
poems.json (the poems as transcribed from the pages). Nothing of the pages is written into the repository; the built
page goes where it is told.

    python3 dirt/poetry/build_poetry.py OUT.html

Each page becomes two layers. Its photograph, cut from the page where the page sets it, becomes the paint: 600 by
800 pixels, mipmapped on the GPU (one wider than tall lies on its side). Everything else on the page, its type, its
rules and its buildings and characters, becomes the ink: the page with its paper taken away, kept at three
quarters of the page's size so the poems stay sharp (a page wider than tall lies on its side here too). The plane
knows where each page sets its photograph and its poem, measured from the page images.
"""
import base64
import html
import io
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
PRIVATE = HERE.parent / "private" / "poetry"
PHOTO = (600, 800)
INK_K = 0.75

# Each page, in its own image's pixels: where it sets its photograph and its poem (title, rule, lines and signature,
# left, top, right, bottom), its paper and its type's ink, and a block of colour it sets (page 4's sage), if any.
PAGES = [
    {"page": "page-1.jpg", "photo": (363, 688, 964, 1489), "text": (117, 214, 555, 593),
     "paper": (239, 240, 235), "ink": (47, 48, 41)},
    {"page": "page-2.jpg", "photo": (600, 0, 1920, 952), "text": (97, 393, 458, 708),
     "paper": (233, 236, 241), "ink": (36, 40, 46)},
    {"page": "page-3.jpg", "photo": (0, 0, 811, 1080), "text": (1150, 210, 1579, 831),
     "paper": (235, 239, 240), "ink": (40, 45, 46)},
    {"page": "page-4.jpg", "photo": (180, 180, 901, 1141), "text": (180, 1284, 775, 1752),
     "paper": (240, 240, 230), "ink": (42, 43, 31), "block": ((612, 1140, 1080, 1920), (220, 223, 212))},
    {"page": "page-5.jpg", "photo": (1083, 108, 1813, 1080), "text": (231, 170, 964, 492),
     "paper": (210, 217, 223), "ink": (31, 38, 44)},
]

# Each page's colours, measured from its photograph (k-means in RGB, 14 clusters, ranked by chroma and share): its
# paper, light, mid, a deep colour for the large fields (the photograph's own hue, deepened: Boiling's sunset to burnt
# orange, the second page's sky to deep blue, For What's sky to teal, the lawn's shade to a living green, the
# lighthouse's caisson to the slate of the sea), an accent for halftone, brush and kaleidoscope (Boiling's brick, the
# second page's lens-flare rose, For What's cloud light, the sunlit lawn, the lighthouse's lantern), and two pastels
# for torn pieces.
PALETTE = [
    [(240, 238, 231), (240, 213, 166), (176, 172, 144), (198, 110, 52), (176, 96, 58), (244, 214, 176), (210, 198, 224)],
    [(233, 236, 241), (168, 187, 215), (115, 149, 193), (48, 84, 168), (206, 124, 168), (196, 214, 240), (238, 200, 216)],
    [(235, 239, 240), (181, 209, 214), (174, 179, 169), (70, 128, 150), (200, 160, 104), (198, 226, 234), (244, 222, 196)],
    [(238, 239, 234), (221, 218, 210), (109, 118, 117), (62, 108, 54), (160, 158, 62), (218, 224, 160), (230, 214, 206)],
    [(226, 231, 234), (211, 219, 222), (164, 171, 171), (52, 78, 102), (176, 70, 72), (214, 196, 180), (200, 212, 224)],
]


def data_uri(im, fmt="JPEG", quality=86):
    buf = io.BytesIO()
    if fmt == "JPEG":
        im.save(buf, "JPEG", quality=quality, optimize=True, progressive=True)
        mime = "image/jpeg"
    else:
        im.save(buf, "PNG", optimize=True)
        mime = "image/png"
    return "data:%s;base64,%s" % (mime, base64.b64encode(buf.getvalue()).decode("ascii"))


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def ink_layer(spec, page, over):
    """The page with its paper taken away: the type as coverage of its ink, the buildings and characters over it."""
    a = np.asarray(page).astype(np.float32)
    H, W, _ = a.shape
    paper = np.empty_like(a)
    paper[...] = spec["paper"]
    if spec.get("block"):
        (x0, y0, x1, y1), c = spec["block"]
        paper[y0:y1, x0:x1] = c
    inkc = np.array(spec["ink"], np.float32)
    lp, li = lum(paper), float(lum(inkc))
    cover = np.clip((lp - lum(a) - 6.0) / (lp - li - 6.0), 0.0, 1.0)
    x0, y0, x1, y1 = spec["photo"]
    cover[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2] = 0.0         # the photograph is the paint's
    o = np.asarray(over.convert("RGBA").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    oa = o[..., 3:4]
    # premultiplied: the overlay over the type
    rgb = o[..., :3] * 255.0 * oa + inkc * cover[..., None] * (1.0 - oa)
    alpha = oa[..., 0] + cover * (1.0 - oa[..., 0])
    pm = np.dstack([rgb, alpha * 255.0])
    size = (round(W * INK_K), round(H * INK_K))
    small = np.asarray(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)).astype(np.float32)
    al = small[..., 3:4] / 255.0
    straight = np.where(al > 0.004, small[..., :3] / np.maximum(al, 1e-6), 0.0)  # straight alpha again, for the PNG
    out = Image.fromarray(np.clip(np.dstack([straight, small[..., 3:4]]), 0, 255).astype(np.uint8), "RGBA")
    if W > H:
        out = out.transpose(Image.Transpose.ROTATE_270)                  # on its side: a quarter turn clockwise
    return out


def build(out):
    poems = {p["n"]: p for p in json.loads((PRIVATE / "poems.json").read_text(encoding="utf-8"))["pages"]}
    over_dir = PRIVATE / "overlays"
    photos, inks, page_a, photo_r, text_r, paper, block, block_c, pages = [], [], [], [], [], [], [], [], []
    for n, spec in enumerate(PAGES, start=1):
        page = Image.open(PRIVATE / spec["page"]).convert("RGB")
        W, H = page.size
        ph = page.crop(spec["photo"])
        turned = ph.width > ph.height
        if turned:
            ph = ph.transpose(Image.Transpose.ROTATE_270)
        photos.append(data_uri(ph.resize(PHOTO, Image.LANCZOS)))
        inks.append(data_uri(ink_layer(spec, page, Image.open(over_dir / ("over-%d.png" % n))), "PNG"))
        page_a += [W, H, 1 if W > H else 0, 1 if turned else 0]
        photo_r += list(spec["photo"])
        text_r += list(spec["text"])
        paper += list(spec["paper"])
        b = spec.get("block")
        block += list(b[0]) if b else [0, 0, 0, 0]
        block_c += list(b[1]) if b else [0, 0, 0]
        p = poems[n]
        pages.append({"n": n, "title": p.get("title"), "signature": p.get("signature"), "label": p.get("label")})
    ink_size = [round(1080 * INK_K), round(1920 * INK_K)]
    assets = {
        "photos": photos, "inks": inks, "photoSize": list(PHOTO), "inkSize": ink_size,
        "pageA": page_a, "photoR": photo_r, "textR": text_r, "paper": paper, "block": block, "blockC": block_c,
        "palette": [v for pg in PALETTE for c in pg for v in c], "pages": pages,
    }
    sr = []
    for n in range(1, len(PAGES) + 1):
        p = poems[n]
        head = p.get("title") or (p.get("signature") or "").lstrip("—") or "Page %d" % n
        if p.get("prose"):
            body = html.escape(" ".join(p["lines"]))
        else:
            body = "<br>".join(html.escape(line) for line in p["lines"])
        sign = "<br><br>" + html.escape(p["signature"]) if p.get("signature") else ""
        sr.append("<h2>%s</h2><p>%s%s</p>" % (html.escape(head), body, sign))
    page = (HERE / "plane.html").read_text(encoding="utf-8")
    page = page.replace("__ASSETS__", json.dumps(assets, separators=(",", ":"))).replace("__POEMS_HTML__", "".join(sr))
    Path(out).write_text(page, encoding="utf-8")
    print(out, "%.2f MB" % (len(page.encode("utf-8")) / 1e6))


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "dirt-poetry.html")
