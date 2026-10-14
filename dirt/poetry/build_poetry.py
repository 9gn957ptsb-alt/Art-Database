#!/usr/bin/env python3
"""DRIFT Poetry: the pages of Picture Poetry laid on DRIFT.

DRIFT Poetry is DRIFT's own page, exactly as published, with the pages of Picture Poetry laid over its ground
(layer.js, beside this file). It is built from the two artifacts as they stand, so whenever either changes it is built
again from both (UPDATE.md says how):

    python3 dirt/poetry/build_poetry.py --drift DRIFT.html --out OUT [--sources SOURCES.json]

DRIFT.html is DRIFT's page as published (read it back with the Artifact tool). The pages come from
dirt/private/poetry/, which is never committed: Picture Poetry's page images and photographs as it publishes them,
pages.json and overlays/ (capture_pages.js: what its data says about each page, and its buildings and characters as
it draws them), and poems.json (the poems, transcribed from the page images). OUT gets index.html (DRIFT's page with
the pages laid on it) and poetry/: each page's photograph and its ink, poems.json, and sources.json (the versions of
DRIFT and Picture Poetry it was built from, from SOURCES.json, and a fingerprint of each page image), so the next build
can begin from the artifact alone and say which pages are new or changed.

Each page is measured from its image: its paper (its commonest colour), its photograph (where Picture Poetry's data
sets it, or else the largest patch unlike the paper), its ink (the far end of its own colours from the paper: darker
on a light page, lighter on a dark one) and its poem (the run of ink lines with the most ink in it, outside the
photograph and the figures). Its photograph becomes the paint, 600 by 800 pixels, mipmapped on the GPU (one wider
than tall lies on its side). Everything else on the page, its type, its rules, its buildings and characters, becomes
the ink: the page with its paper taken away, each pixel's own colour kept (so a coloured rule keeps its colour), at
three quarters of the page's size so the poems stay sharp.
"""
import argparse
import hashlib
import html
import io
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
PRIVATE = HERE.parent / "private" / "poetry"
PHOTO = (600, 800)
INK_K = 0.75
G = 2584.0                      # a page to each square this wide (plane pixels): pages lie apart, with DRIFT between

# The accent each page's halftone, brushstrokes and kaleidoscopes lean to, and the still it leans to (0 the halftone
# and the disc, 1 coming apart, 2 the cloud and the kaleidoscopes, 3 torn), by its name; a page not named here takes
# the most vivid colour of its photograph, and a still from its name's hash.
ACCENT = {
    "Boiling": (176, 96, 58),                  # its brick
    "Innocence as an Act": (206, 124, 168),    # the lens flare's rose
    "For What": (200, 160, 104),               # the cloud light
    "Neither Where Nor When": (160, 158, 62),  # the sunlit lawn
    "What too came devoured": (176, 70, 72),   # the lighthouse's lantern
    "Discourse to the Athenians": (199, 128, 39),   # the gold of the creature crossing the globes
}
LEAN = {"Boiling": 1, "Innocence as an Act": 2, "For What": 3, "Neither Where Nor When": 3,
        "What too came devoured": 0, "Discourse to the Athenians": 0}   # the disc among the globes and the stars


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def measure(page, entry):
    """Where the page sets its photograph and its poem, and the colours of its paper and its ink (page pixels)."""
    a = np.asarray(page).astype(np.float32)
    H, W, _ = a.shape
    free = np.ones((H, W), bool)                       # neither photograph nor building nor character
    for o in entry["objects"]:
        x0, y0, x1, y1 = o["box"]
        free[max(0, y0 - 8):y1 + 8, max(0, x0 - 8):x1 + 8] = False
    q = (a // 8).astype(np.int32)
    key = (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]

    def paper_of(mask):                                # the commonest colour
        vals, counts = np.unique(key[mask], return_counts=True)
        return a[(key == vals[np.argmax(counts)]) & mask].mean(0)

    if entry.get("photoRect"):
        photo = tuple(int(v) for v in entry["photoRect"])
    else:                                              # the largest coherent patch unlike the paper
        dist = np.sqrt(((a - paper_of(free)) ** 2).sum(-1))
        k = 8
        small = dist[:H // k * k, :W // k * k].reshape(H // k, k, W // k, k).mean((1, 3)) > 24
        small = ndimage.binary_opening(small, iterations=2)
        lab, n = ndimage.label(small)
        if not n:
            raise SystemExit(f"page {entry['n']}: no photograph found")
        sl = ndimage.find_objects(lab)[int(np.argmax(ndimage.sum(small, lab, range(1, n + 1))))]
        photo = (sl[1].start * k, sl[0].start * k, min(W, sl[1].stop * k), min(H, sl[0].stop * k))
    x0, y0, x1, y1 = photo
    free[max(0, y0 - 34):y1 + 34, max(0, x0 - 34):x1 + 34] = False
    paper = paper_of(free)
    lp, L = float(lum(paper)), lum(a)
    far = (L - lp) if lp < 128 else (lp - L)           # toward the ink: lighter on a dark page, darker on a light one
    cand = free & (far > 0)
    thr = np.percentile(far[cand], 99.5)
    ink = np.median(a[cand & (far >= thr * 0.95)], 0)
    t = np.clip(far / max(1.0, abs(float(lum(ink)) - lp)), 0, 1) * free
    m = t > 0.5
    rows = np.where(m.sum(1) >= 3)[0]
    if not len(rows):
        raise SystemExit(f"page {entry['n']}: no poem found")
    runs = np.split(rows, np.where(np.diff(rows) >= 144)[0] + 1)   # a gap of 144 pixels between runs of lines
    run = max(runs, key=lambda r: m[r].sum())
    cols = np.where(m[run.min():run.max() + 1].sum(0) >= 3)[0]
    text = (int(cols.min()), int(run.min()), int(cols.max()) + 1, int(run.max()) + 1)
    return {"photo": photo, "text": text, "paper": tuple(int(round(v)) for v in paper),
            "ink": tuple(int(round(v)) for v in ink)}


def ink_layer(page, spec, over):
    """The page with its paper taken away: each pixel's own colour, as much of it as is not paper, and the buildings
    and characters over it; premultiplied while it is made, straight alpha in the PNG."""
    a = np.asarray(page).astype(np.float32)
    H, W, _ = a.shape
    paper = np.array(spec["paper"], np.float32)
    lp, li = float(lum(paper)), float(lum(np.array(spec["ink"], np.float32)))
    d = (lp - lum(a)) if li < lp else (lum(a) - lp)
    cover = np.clip((d - 6.0) / max(1.0, abs(lp - li) - 6.0), 0.0, 1.0)
    x0, y0, x1, y1 = spec["photo"]
    cover[max(0, y0 - 2):y1 + 2, max(0, x0 - 2):x1 + 2] = 0.0          # the photograph is the paint's
    rgb = np.clip(a - paper * (1.0 - cover[..., None]), 0.0, 255.0 * cover[..., None])
    o = np.asarray(over.convert("RGBA").resize((W, H), Image.LANCZOS)).astype(np.float32) / 255.0
    oa = o[..., 3:4]
    rgb = o[..., :3] * 255.0 * oa + rgb * (1.0 - oa)                  # the figures over the type
    alpha = oa[..., 0] + cover * (1.0 - oa[..., 0])
    pm = np.dstack([rgb, alpha * 255.0])
    size = (round(W * INK_K), round(H * INK_K))
    small = np.asarray(Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), "RGBA").resize(size, Image.LANCZOS)).astype(np.float32)
    al = small[..., 3:4] / 255.0
    straight = np.where(al > 0.004, small[..., :3] / np.maximum(al, 1e-6), 0.0)
    out = Image.fromarray(np.clip(np.dstack([straight, small[..., 3:4]]), 0, 255).astype(np.uint8), "RGBA")
    if W > H:
        out = out.transpose(Image.Transpose.ROTATE_270)                  # on its side: a quarter turn clockwise
    return out


def vivid(img):
    """The most vivid colour a photograph holds: the middle of its most vivid two thousandths (by chroma, leaning to
    the bright), so a small bright thing in a dark picture still counts."""
    a = np.asarray(img.convert("RGB")).reshape(-1, 3).astype(np.float32)
    score = (a.max(1) - a.min(1)) * (0.4 + a.max(1) / 255.0)
    return tuple(int(v) for v in np.median(a[score >= np.percentile(score, 99.8)], 0))


def name_of(p):
    return p.get("title") or p.get("label") or (p.get("signature") or "").lstrip("—") or "Page %d" % p["n"]


def build(drift, out, sources):
    out = Path(out)
    (out / "poetry").mkdir(parents=True, exist_ok=True)
    book = json.loads((PRIVATE / "pages.json").read_text(encoding="utf-8"))["pages"]
    poems = {p["n"]: p for p in json.loads((PRIVATE / "poems.json").read_text(encoding="utf-8"))["pages"]}
    missing = [e["n"] for e in book if e["n"] not in poems]
    if missing:
        raise SystemExit(f"pages {missing} have no poem in poems.json: transcribe them from their page images first")
    pages, sr = [], []
    for e in book:
        n, p = e["n"], poems[e["n"]]
        page = Image.open(PRIVATE / e["img"]).convert("RGB")
        W, H = page.size
        spec = measure(page, e)
        ph = page.crop(spec["photo"])
        turned = ph.width > ph.height
        if turned:
            ph = ph.transpose(Image.Transpose.ROTATE_270)
        ph.resize(PHOTO, Image.LANCZOS).save(out / "poetry" / f"photo-{n}.jpg", "JPEG", quality=86, optimize=True, progressive=True)
        ink_layer(page, spec, Image.open(PRIVATE / "overlays" / f"over-{n}.png")).save(out / "poetry" / f"ink-{n}.png", "PNG", optimize=True)
        name = name_of(p)
        accent = ACCENT.get(name) or vivid(page.crop(spec["photo"]))
        lean = LEAN.get(name, int(hashlib.sha256(name.encode()).hexdigest(), 16) % 4)
        pages.append({"n": n, "name": name, "size": [W, H], "turned": W > H, "photoTurned": turned,
                      "photoR": list(spec["photo"]), "textR": list(spec["text"]), "paper": list(spec["paper"]),
                      "accent": list(accent), "lean": lean, "photo": f"poetry/photo-{n}.jpg", "ink": f"poetry/ink-{n}.png"})
        print(f"page {n} ({name}): photograph {spec['photo']}, poem {spec['text']}, paper {spec['paper']}, ink {spec['ink']}, accent {accent}, still {lean}")
        body = html.escape(" ".join(p["lines"])) if p.get("prose") else "<br>".join(html.escape(line) for line in p["lines"])
        sign = "<br><br>" + html.escape(p["signature"]) if p.get("signature") else ""
        sr.append("<h2>%s</h2><p>%s%s</p>" % (html.escape(name), body, sign))
    spec = {"G": G, "photoSize": list(PHOTO), "inkSize": [round(1080 * INK_K), round(1920 * INK_K)], "pages": pages}
    page = Path(drift).read_text(encoding="utf-8")
    if page.lstrip().lower().startswith("<!doctype html>") and "<body>" in page:
        # read back from the artifact, the page comes wrapped in the skeleton the artifact serves it in, which
        # publishing adds again: take it off
        page = page[page.index("<body>") + len("<body>"):]
        page = page.rstrip()
        if page.endswith("</body></html>"):
            page = page[:-len("</body></html>")]
        page = page.strip() + "\n"
    if page.count("<title>DRIFT</title>") != 1:
        raise SystemExit("DRIFT's page has no <title>DRIFT</title> to rename: has DRIFT's page changed shape?")
    if "const GLG" not in page or 'id="stage"' not in page or 'id="field"' not in page:
        raise SystemExit("DRIFT's page lacks GLG, #stage or #field, which the pages are laid with: see layer.js")
    page = page.replace("<title>DRIFT</title>", "<title>DRIFT Poetry</title>", 1)
    layer = (HERE / "layer.js").read_text(encoding="utf-8").replace("__POETRY__", json.dumps(spec, separators=(",", ":")))
    src = json.loads(Path(sources).read_text(encoding="utf-8")) if sources else {}
    # each page image's fingerprint, kept with the sources, so the next build can say which pages are new or changed
    src["pages"] = {e["img"]: hashlib.sha256((PRIVATE / e["img"]).read_bytes()).hexdigest()[:16] for e in book}
    before = PRIVATE / "sources.json"
    if before.exists():
        was = json.loads(before.read_text(encoding="utf-8")).get("pages", {})
        for e in book:
            if e["img"] not in was:
                print(f"page {e['n']} is new since the last build: its poem in poems.json must be read from its image")
            elif was[e["img"]] != src["pages"][e["img"]]:
                print(f"page {e['n']} has changed since the last build: check its poem in poems.json against its image")
    page += ('\n<section aria-label="The poems of Picture Poetry, which lie on this plane" style="position:absolute;width:1px;'
             'height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">'
             + "".join(sr) + "</section>\n"
             + '<script type="application/json" id="drift-poetry-sources">' + json.dumps(src).replace("</", "<\\/") + "</script>\n"
             + '<script id="drift-poetry">\n' + layer + "</script>\n")
    (out / "index.html").write_text(page, encoding="utf-8")
    shutil.copy(PRIVATE / "poems.json", out / "poetry" / "poems.json")
    for f in (out / "poetry" / "sources.json", PRIVATE / "sources.json"):
        f.write_text(json.dumps(src, indent=1) + "\n", encoding="utf-8")
    print(out / "index.html", "%.2f MB" % (len(page.encode("utf-8")) / 1e6), "+",
          "%.2f MB of pages" % (sum(f.stat().st_size for f in (out / "poetry").iterdir()) / 1e6))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--drift", required=True, help="DRIFT's page as published")
    ap.add_argument("--out", required=True)
    ap.add_argument("--sources", help="the versions of DRIFT and Picture Poetry it is built from (JSON)")
    a = ap.parse_args()
    build(a.drift, a.out, a.sources)
