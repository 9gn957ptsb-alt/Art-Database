#!/usr/bin/env python3
"""DRIFT Poetry: Picture Poetry taken into DRIFT.

DRIFT Poetry is DRIFT's own page, exactly as published, with Picture Poetry taken into it in pieces (layer.js, beside
this file, says how): the poems a line at a time in DRIFT's moving parts (the swimmers write them, the calm country's
lines open into them, the gesture carries them), the photographs into DRIFT's collage, the buildings standing on the
ground and turning under a swipe, with the creatures that stood by them. It is built from the two artifacts as they
stand, so whenever either changes it is built again from both (UPDATE.md says how):

    python3 dirt/poetry/build_poetry.py --drift DRIFT.html --out OUT [--sources SOURCES.json]

DRIFT.html is DRIFT's page as published (read it back with the Artifact tool). Picture Poetry comes from
dirt/private/poetry/, which is never committed: its page images and photographs as it publishes them, pages.json and
overlays/ (capture_pages.js: what its data says about each page, and its creatures as it draws them), buildings.json
and models.js (its buildings and the code that draws them, which layer.js draws live and turns), and poems.json (the
poems, transcribed from the page images). OUT gets index.html (DRIFT's page with Picture Poetry in it) and poetry/:
each page's photograph, the creatures' sheet, poems.json, and sources.json (the versions of DRIFT and Picture Poetry
it was built from, from SOURCES.json, and a fingerprint of each page image), so the next build can begin from the
artifact alone and say which pages are new or changed.

Each page's photograph is found from its data (or, where the data does not set it, as the largest patch of the page
unlike its paper) and cut from the page image upright, at most 1024 pixels on its long side, for DRIFT's collage to
take in. Each creature is cut from its page's overlay, a few pixels round its box, onto one sheet. And for the book
each plot opens into (layer.js), each page's paper, ink and rule are read from its image, with where each line of its
poem begins (typeset), and the book's notes on its buildings, creatures and photograph go in beside it.

The page also asks DRIFT's engine, before it begins, for the letters (window.DRIFT_WORDS; WORDS in ground-gl.js),
which layer.js draws the glyphs of and hands over.
"""
import argparse
import hashlib
import html
import json
import shutil
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

HERE = Path(__file__).resolve().parent
PRIVATE = HERE.parent / "private" / "poetry"
PHOTO_MAX = 1024                # a photograph's long side, at most (pixels)
CREATURE_PAD = 3                # pixels kept round a creature's box when it is cut out


def lum(a):
    return a[..., 0] * 0.299 + a[..., 1] * 0.587 + a[..., 2] * 0.114


def photo_rect(page, entry):
    """Where the page sets its photograph (page pixels): where Picture Poetry's data sets it, or else the largest
    coherent patch unlike the paper (its commonest colour), away from its buildings and creatures."""
    if entry.get("photoRect"):
        return tuple(int(v) for v in entry["photoRect"])
    a = np.asarray(page).astype(np.float32)
    H, W, _ = a.shape
    free = np.ones((H, W), bool)
    for o in entry["objects"]:
        x0, y0, x1, y1 = o["box"]
        free[max(0, y0 - 8):y1 + 8, max(0, x0 - 8):x1 + 8] = False
    q = (a // 8).astype(np.int32)
    key = (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]
    vals, counts = np.unique(key[free], return_counts=True)
    paper = a[(key == vals[np.argmax(counts)]) & free].mean(0)
    dist = np.sqrt(((a - paper) ** 2).sum(-1))
    k = 8
    small = dist[:H // k * k, :W // k * k].reshape(H // k, k, W // k, k).mean((1, 3)) > 24
    small = ndimage.binary_opening(small, iterations=2)
    lab, n = ndimage.label(small)
    if not n:
        raise SystemExit(f"page {entry['n']}: no photograph found")
    sl = ndimage.find_objects(lab)[int(np.argmax(ndimage.sum(small, lab, range(1, n + 1))))]
    return (sl[1].start * k, sl[0].start * k, min(W, sl[1].stop * k), min(H, sl[0].stop * k))


def hexof(c):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in c)


def typeset(page, entry, rect, poem):
    """How the page sets its poem, for the book a plot opens into (layer.js prints it so): its paper (the commonest
    colour away from its photograph, buildings and creatures), its ink (the strong strokes of its type), the colour of
    the rule under its title, and where each of its lines lies across the page (page pixels, from the leftmost), which
    keeps a page's indents (page 4's cascade, page 2's wander). The lines are found as bands of rows holding ink, a
    rule as a band a few pixels high; when the bands are not as many as the poem's title, lines and signature (or the
    poem is prose, set as a block), the lines are set flush."""
    a = np.asarray(page).astype(np.float32)
    H, W, _ = a.shape
    free = np.ones((H, W), bool)
    x0, y0, x1, y1 = rect
    free[max(0, y0 - 6):y1 + 6, max(0, x0 - 6):x1 + 6] = False
    for o in entry["objects"]:
        bx0, by0, bx1, by1 = o["box"]
        free[max(0, by0 - 8):by1 + 8, max(0, bx0 - 8):bx1 + 8] = False
    q = (a // 8).astype(np.int32)
    key = (q[..., 0] << 10) | (q[..., 1] << 5) | q[..., 2]
    vals, counts = np.unique(key[free], return_counts=True)
    paper = a[(key == vals[np.argmax(counts)]) & free].mean(0)
    dist = np.sqrt(((a - paper) ** 2).sum(-1))
    ink = (dist > 48) & free
    on = ink.sum(1) >= 1
    bands, rules, y = [], [], 0
    while y < H:
        if on[y]:
            s = y
            while y < H and on[y]:
                y += 1
            cols = np.nonzero(ink[s:y].any(0))[0]
            bx0, bx1 = int(cols[0]), int(cols[-1]) + 1
            if y - s <= 4 and bx1 - bx0 > 60 and ink[s:y, bx0:bx1].mean() > 0.5:
                rules.append((s, y, bx0, bx1))
            elif y - s >= 4 and ink[s:y].sum() >= 12:
                bands.append((bx0, bx1))
        y += 1
    strong = ink & (dist > 90)
    inkc = a[strong].mean(0) if strong.any() else 255 - paper
    rule = a[rules[0][0]:rules[0][1], rules[0][2]:rules[0][3]].reshape(-1, 3).mean(0) if rules else (paper + inkc) / 2
    lines = [l for l in poem["lines"] if l.strip()]
    title = 1 if poem.get("title") else 0
    x = None
    if not poem.get("prose") and len(bands) == title + len(lines) + (1 if poem.get("signature") else 0):
        ls = bands[title:title + len(lines)]
        left = min(b[0] for b in ls)
        x = [[b[0] - left, b[1] - left] for b in ls]
    return {"paper": hexof(paper), "ink": hexof(inkc), "rule": hexof(rule), "x": x, "found": len(bands)}


def creatures(book, size_of):
    """Each page's creatures cut from its overlay (page pixels, the overlay laid at the page image's size), packed in
    a row onto one sheet: the sheet, and per creature its page (index in the book), its box with the margin, and where
    it lies on the sheet."""
    cuts, out = [], []
    for i, e in enumerate(book):
        over = Image.open(PRIVATE / "overlays" / f"over-{e['n']}.png").convert("RGBA").resize(size_of[e["n"]], Image.LANCZOS)
        for o in e["objects"]:
            if o["kind"] not in ("char", "character"):
                continue
            x0, y0, x1, y1 = o["box"]
            box = [max(0, x0 - CREATURE_PAD), max(0, y0 - CREATURE_PAD), min(over.width, x1 + CREATURE_PAD), min(over.height, y1 + CREATURE_PAD)]
            cuts.append(over.crop(box))
            out.append({"page": i, "note": o.get("note"), "box": box})
    if not cuts:
        return None, []
    W, H = sum(c.width for c in cuts) + 2 * len(cuts), max(c.height for c in cuts)
    sheet, x = Image.new("RGBA", (W, H), (0, 0, 0, 0)), 0
    for c, o in zip(cuts, out):
        sheet.paste(c, (x, 0))
        o["sheet"] = [x, 0, c.width, c.height]
        x += c.width + 2
    return sheet, out


def name_of(p):
    return p.get("title") or p.get("label") or (p.get("signature") or "").lstrip("—") or "Page %d" % p["n"]


def build(drift, out, sources):
    out = Path(out)
    (out / "poetry").mkdir(parents=True, exist_ok=True)
    for f in (out / "poetry").glob("ink-*.png"):                       # (the pages' ink, from before they came apart)
        f.unlink()
    book = json.loads((PRIVATE / "pages.json").read_text(encoding="utf-8"))["pages"]
    poems = {p["n"]: p for p in json.loads((PRIVATE / "poems.json").read_text(encoding="utf-8"))["pages"]}
    missing = [e["n"] for e in book if e["n"] not in poems]
    if missing:
        raise SystemExit(f"pages {missing} have no poem in poems.json: transcribe them from their page images first")
    pages, sr, size_of = [], [], {}
    for e in book:
        n, p = e["n"], poems[e["n"]]
        page = Image.open(PRIVATE / e["img"]).convert("RGB")
        size_of[n] = page.size
        rect = photo_rect(page, e)
        ph = page.crop(rect)
        k = min(1.0, PHOTO_MAX / max(ph.size))
        if k < 1.0:
            ph = ph.resize((round(ph.width * k), round(ph.height * k)), Image.LANCZOS)
        ph.save(out / "poetry" / f"photo-{n}.jpg", "JPEG", quality=86, optimize=True, progressive=True)
        name = name_of(p)
        ts = typeset(page, e, rect, p)
        # each page as its book prints it (layer.js): its poem whole (the empty lines between stanzas kept), its
        # colours and its lines' places, and the note on its photograph
        pages.append({"n": n, "name": name, "photo": f"poetry/photo-{n}.jpg", "title": p.get("title"),
                      "signature": p.get("signature"), "prose": bool(p.get("prose")), "lines": p["lines"],
                      "paper": ts["paper"], "ink": ts["ink"], "rule": ts["rule"], "x": ts["x"], "photoNote": e.get("photoNote")})
        print(f"page {n} ({name}): photograph {rect}, {ph.width} by {ph.height}; paper {ts['paper']}, ink {ts['ink']}, "
              + ("its lines' places read" if ts["x"] else f"set flush ({ts['found']} bands of type)"))
        body = html.escape(" ".join(p["lines"])) if p.get("prose") else "<br>".join(html.escape(line) for line in p["lines"])
        sign = "<br><br>" + html.escape(p["signature"]) if p.get("signature") else ""
        sr.append("<h2>%s</h2><p>%s%s</p>" % (html.escape(name), body, sign))
    # the poems themselves, for the letters (layer.js breaks them into lines; WORDS in ground-gl.js writes them)
    verse = [{"name": name_of(poems[e["n"]]), "n": e["n"], "lines": [l for l in poems[e["n"]]["lines"] if l.strip()],
              "prose": bool(poems[e["n"]].get("prose"))} for e in book]
    spec = {"pages": pages, "poems": verse}
    # the buildings, drawn live and turned by a swipe (layer.js), by Picture Poetry's own model code: where each stands on
    # its page (page pixels), what it is made of, and the soil it is made of (capture_pages.js takes them from the book)
    bld = json.loads((PRIVATE / "buildings.json").read_text(encoding="utf-8"))
    spec["buildings"] = [{"page": i, "slug": o["model"], "box": o["box"], "hit": o["hit"], "note": o["note"],
                          "name": bld["notes"][o["note"]]["name"], "sub": bld["notes"][o["note"]]["sub"]}
                         for i, e in enumerate(book) for o in e["objects"] if o["kind"] == "model"]
    # the book's notes on its buildings, creatures and photographs, which the books print
    used = {o["note"] for e in book for o in e["objects"]} | {e.get("photoNote") for e in book}
    spec["notes"] = {k: v for k, v in bld["notes"].items() if k in used}
    if any("body" not in v for v in spec["notes"].values()):
        raise SystemExit("buildings.json has the notes' names only: run capture_pages.js again for the whole notes")
    spec["models"] = {s: bld["models"][s] for s in {b["slug"] for b in spec["buildings"]}}
    spec["dirt"] = bld["dirt"]
    # and the creatures that stood by them
    sheet, chars = creatures(book, size_of)
    if sheet is not None:
        sheet.save(out / "poetry" / "creatures.png", "PNG", optimize=True)
        spec["chars"], spec["charSheet"] = chars, "poetry/creatures.png"
        print(f"{len(chars)} creatures, on a sheet {sheet.width} by {sheet.height}")
    models = (PRIVATE / "models.js").read_text(encoding="utf-8")
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
        raise SystemExit("DRIFT's page lacks GLG, #stage or #field, which Picture Poetry is laid in with: see layer.js")
    if "verse: () =>" not in page:
        raise SystemExit("DRIFT's engine has no swimmers' lines (GLG.verse, WORDS in ground-gl.js): publish DRIFT from this repository first")
    # the new title; before any of DRIFT's scripts, the letters asked of its engine (WORDS in ground-gl.js); and the
    # type: Picture Poetry's own (its capitals, and the light italic of its poems), and DRIFT's serif upright too, for
    # the books' notes
    page = page.replace("<title>DRIFT</title>", "<title>DRIFT Poetry</title>\n<script>window.DRIFT_WORDS = true;</script>\n"
                        '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400'
                        '&family=Poppins:ital,wght@0,500;1,300&display=swap">', 1)
    if page.index("<script") != page.index("<script>window.DRIFT_WORDS"):
        raise SystemExit("one of DRIFT's scripts runs before its title, so before the letters are asked for: has DRIFT's page changed shape?")
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
    page += ('\n<section aria-label="The poems of Picture Poetry, which drift through this plane" style="position:absolute;width:1px;'
             'height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0">'
             + "".join(sr) + "</section>\n"
             + '<script type="application/json" id="drift-poetry-sources">' + json.dumps(src).replace("</", "<\\/") + "</script>\n"
             + '<script id="picture-poetry-models">\n' + models.replace("</script", "<\\/script") + "</script>\n"
             + '<script id="drift-poetry">\n' + layer + "</script>\n")
    (out / "index.html").write_text(page, encoding="utf-8")
    shutil.copy(PRIVATE / "poems.json", out / "poetry" / "poems.json")
    for f in (out / "poetry" / "sources.json", PRIVATE / "sources.json"):
        f.write_text(json.dumps(src, indent=1) + "\n", encoding="utf-8")
    print(out / "index.html", "%.2f MB" % (len(page.encode("utf-8")) / 1e6), "+",
          "%.2f MB of photographs and creatures" % (sum(f.stat().st_size for f in (out / "poetry").iterdir()) / 1e6))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--drift", required=True, help="DRIFT's page as published")
    ap.add_argument("--out", required=True)
    ap.add_argument("--sources", help="the versions of DRIFT and Picture Poetry it is built from (JSON)")
    a = ap.parse_args()
    build(a.drift, a.out, a.sources)
