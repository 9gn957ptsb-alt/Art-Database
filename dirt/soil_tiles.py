#!/usr/bin/env python3
"""DIRT's ground: the ingredients of an infinite plane of collection soil, assembled in the browser.

The plane is a lattice of tiles whose edges always line up. Every vertical join on the lattice takes one
of five colours and every horizontal join one of five more, decided by the join's own position, so the
two tiles that share a join always agree on it. Each colour is a whole object from a painting that
straddles the join: a face split down its middle on the vertical joins, and a boat, a bridge, a building,
an angel or a footbridge split across on the horizontal ones. Any tile can be built anywhere, so the
plane has no edge and no starting point.

A tile is made of zones, and each zone takes its soil from a source that the tiles meeting there share:

  corners  one of three corner soils, chosen by the grid point, so the four tiles meeting there agree
  joins    the soil of the join's colour, carrying that colour's object across the join
  middle   one of 34 middle soils, chosen and sometimes mirrored by the tile's position, each with
           shapes of its own surfacing through it

The zone boundaries depend only on things both sides of a join agree on, and zones simply abut, clod
against clod, so no frame shows. This script makes the sources and the fields that shape the zones, and
writes them to dirt/private/plane/. build_soil_viewer.py puts them in the page, and the page assembles
tiles from them as the viewer moves.

The soil is made in the same hand as the Cutouts view: the same clods, weave and windows. An object is
not pasted on. It lies under the clods, and the clods over it become shards carrying their piece of it,
with the same cracks, gaps and light as the rest, and some left as plain soil, so it surfaces through
the dirt in pieces. Now and then an ordinary clod is centred on a face (OpenCV's Haar detector, checked
by eye; see objects.json), seen with enough of its surroundings to stay a fragment. Everything this
writes goes to dirt/private/, because the cutouts reproduce other artists' images.

    python3 dirt/soil_tiles.py --db path/to/artworks.db [--cache dir-of-medium-jpgs]
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import collection_soil as cs  # noqa: E402

HERE = Path(__file__).resolve().parent
N, CELL, T = cs.N, cs.CELL, cs.T
# Every number chosen here comes from the golden ratio: a Fibonacci number or a power of phi.
PHI = (1 + 5 ** 0.5) / 2
K = 5                           # join colours per axis (Fibonacci)
CORNERS = 3                     # corner soils; every grid point takes one (Fibonacci)
MIDDLES = 34                    # middle soils; every tile takes one, maybe mirrored (Fibonacci)
A, D = 13, 8                    # strip half-width in cells, and how far it wanders (Fibonacci)
CZ, CZ_WANDER = 21, 5           # corner zone half-size and wander (Fibonacci; A + D = 21)
OBJ_HALF = round(N / PHI ** 4)  # the straddling objects' half-thickness across their edge (37)
CLODS = 233                     # per source (Fibonacci), close to the Cutouts view's 220
BURIED = PHI ** -4              # share of an object's shards left as ordinary soil (0.146)
FACE_SHARE = PHI ** -5          # share of ordinary clods centred on a face (0.090)
SECOND = 1 / PHI                # chance a middle soil has a second shape surfacing (0.618)


def rgb(h):
    return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)


def lum(c):
    return 0.3 * c[..., 0] + 0.59 * c[..., 1] + 0.11 * c[..., 2]


# ---- images -------------------------------------------------------------------------------------

class Images:
    def __init__(self, cache):
        self.cache = Path(cache)
        self.mem = {}

    def get(self, url, size="medium"):
        url = url.replace("large.jpg", f"{size}.jpg")
        if url not in self.mem:
            name = url.split("/")[-2] + ("" if size == "medium" else "-" + size) + ".jpg"
            path = self.cache / name
            if not path.exists():
                self.cache.mkdir(parents=True, exist_ok=True)
                path.write_bytes(urllib.request.urlopen(url, timeout=60).read())
            self.mem[url] = Image.open(path).convert("RGB")
        return self.mem[url]


def detect_faces(works, images, out, not_faces):
    """Haar face boxes per painting, cached. Paintings listed in not_faces are skipped."""
    if out.exists():
        return json.loads(out.read_text())
    import cv2
    casc = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_alt2.xml")
    faces = {}
    for w in works:
        if w["id"] in not_faces:
            continue
        g = cv2.equalizeHist(cv2.cvtColor(np.asarray(images.get(w["image"])), cv2.COLOR_RGB2GRAY))
        h, wd = g.shape
        found = casc.detectMultiScale(g, 1.08, 6, minSize=(max(20, wd // 14),) * 2)
        if len(found):
            x, y, fw, fh = max(found, key=lambda f: f[2] * f[3])
            faces[w["id"]] = [x / wd, y / h, (x + fw) / wd, (y + fh) / h]
    out.write_text(json.dumps(faces))
    return faces


# ---- sources ------------------------------------------------------------------------------------

def lay_object(lab, obj, cx, cy, wmax, hmax, rng, taken=()):
    """Lay an object's image under the clods, centred at (cx, cy) on the periodic grid.

    The object is not carved out as one shape. The clods that fall mostly over it become shards of
    it, each carrying its own piece of the picture, and about a fifth of them stay ordinary soil, so
    the object comes up through the dirt in pieces rather than sitting on it. Returns the shard
    clods, the image at one pixel a cell, and the zone the object's strip has to swell to take in.
    """
    img = obj["img"]
    x0, y0, x1, y1 = obj["box"]
    ar = ((x1 - x0) * img.width) / ((y1 - y0) * img.height)
    w = min(wmax, hmax * ar)
    h = w / ar
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    u = cs.wrap(xx + 0.5 - cx) / (w / 2)
    v = cs.wrap(yy + 0.5 - cy) / (h / 2)
    wob = 1 + PHI ** -3 * (cs.field(rng, 5, 21) - 0.5)
    r = (np.abs(u) ** 3 + np.abs(v) ** 3) ** (1 / 3) / wob
    over = np.bincount(lab[r < 1], minlength=lab.max() + 1)
    total = np.bincount(lab.ravel(), minlength=lab.max() + 1)
    candidates = np.array([i for i in np.nonzero(over > 0.5 * np.maximum(total, 1))[0] if i not in taken], int)
    shards = candidates[rng.random(len(candidates)) > BURIED]
    crop = img.crop((int(x0 * img.width), int(y0 * img.height), int(x1 * img.width), int(y1 * img.height)))
    pix = np.asarray(crop.resize((max(1, round(w)), max(1, round(h))), Image.BOX), float)
    lo, hi = np.percentile(pix, [2, 98])                   # stretch its levels, so a dark portrait reads
    pix = np.clip((pix - lo) / max(hi - lo, 1) * 225 + 18, 0, 255)
    py = np.clip(((v + 1) / 2 * pix.shape[0]).astype(int), 0, pix.shape[0] - 1)
    px = np.clip(((u + 1) / 2 * pix.shape[1]).astype(int), 0, pix.shape[1] - 1)
    zone = np.isin(lab, candidates) | (r < 1)
    return set(shards.tolist()), pix[py, px], zone


def make_source(rng, pool, face_pool, images, objs=(), name=""):
    """A periodic N×N soil: clods, weave, colour and cutout, with the same hand as the Cutouts view.

    Objects can be laid under it (see lay_object) and their shards take their piece of them. Each is
    (obj, (cx, cy, wmax, hmax), how): "across" for one that straddles a join, "within" for a shape
    surfacing inside one tile. Only an "across" object widens the strip's zone.
    """
    lab, edge, ox, oy = cs.clods(rng, CLODS)
    zone = np.zeros((N, N), bool)
    owner = {}                                     # shard clod -> (object, its image, how)
    for obj, where, how in objs:
        got, pix, z = lay_object(lab, obj, *where, rng, taken=owner)
        owner.update({i: (obj, pix, how) for i in got})
        if how == "across":
            zone |= z
    shards = set(owner)
    size = cs.weave(rng, edge)
    shade = cs.relief(edge)
    sizes = np.bincount(lab.ravel(), minlength=CLODS)
    if shards:
        # Shards keep the weave but hold their dots a little fuller, so the picture carries.
        sh = np.isin(lab, list(shards)) & (edge >= 0.9)
        size[sh & (size > 0)] = np.maximum(size[sh & (size > 0)], 2)
        size[sh & (size == 0)] = 1

    # Paintings: now and then a clod is centred on a face, shown with its surroundings so it reads
    # as a fragment; the rest are windows onto where their painting is most chocolate.
    order = [i for i in rng.permutation(CLODS) if sizes[i] > 0 and i not in shards]
    faces = list(rng.permutation(len(face_pool)))
    chocs = list(rng.permutation(len(pool)))
    meta = [None] * CLODS
    colA = np.zeros((N, N, 3))
    colB = np.zeros((N, N, 3))
    glint_col = np.zeros((CLODS, 3))
    has_glint = np.zeros(CLODS, bool)
    for i in order:
        cells = lab == i
        p = face_pool[faces.pop()] if faces and rng.random() < FACE_SHARE else pool[chocs.pop()]
        meta[i] = dict(work=p["work"], hex=p["hex"], glint=p["glint"], kind="face" if p.get("face") else None)
        colA[cells] = rgb(p["hex"])
        if p["glint"]:
            glint_col[i] = rgb(p["glint"])
            has_glint[i] = True
        img = np.asarray(images.get(p["work"]["image"]), float)
        h, w = img.shape[:2]
        span = max(np.ptp(ox[cells]), np.ptp(oy[cells]), 4) + 1
        if p.get("face"):
            fx0, fy0, fx1, fy1 = p["face"]
            fs = max((fx1 - fx0) * w, (fy1 - fy0) * h) * PHI ** 2
            px = max(0.5, fs / span)
            cy_, cx_ = (fy0 + fy1) / 2 * h, (fx0 + fx1) / 2 * w
        else:
            px = max(1.0, 0.35 * min(h, w) / span)
            cy_, cx_ = cs.densest(img, p["hex"], span * px)
        ys = np.clip((cy_ + oy[cells] * px).astype(int), 0, h - 1)
        xs = np.clip((cx_ + ox[cells] * px).astype(int), 0, w - 1)
        r = max(0, int(px // 2))
        acc = np.zeros((cells.sum(), 3))
        for dy in (-r, 0, r):
            for dx in (-r, 0, r):
                acc += img[np.clip(ys + dy, 0, h - 1), np.clip(xs + dx, 0, w - 1)]
        colB[cells] = acc / 9

    for obj, _, how in objs:
        mine = [i for i, o in owner.items() if o[0] is obj]
        if not mine:
            continue
        work, pix = obj["work"], owner[mine[0]][1]
        # Colour mode: each shard is one flat colour, chosen from the painting's own three by how
        # light its piece of the picture is — a clod like any other, in the object's colours.
        three = np.stack([rgb(c) for c in sorted(work["colors"], key=lambda c: lum(rgb(c)))])
        means = {i: lum(pix[lab == i]).mean() for i in mine}
        cuts = np.quantile(list(means.values()), [1 / 3, 2 / 3])
        for i in mine:
            cells = lab == i
            meta[i] = dict(work=work, hex=obj["hex"], glint=None, kind=f"{how}:{obj['kind']}",
                           key=f"{name}:{i}" if how == "across" else None)
            colA[cells] = three[min(int(np.digitize(means[i], cuts)), len(three) - 1)]
            colB[cells] = pix[cells]

    colA *= shade[..., None]
    colB *= shade[..., None]
    glint = (rng.random((N, N)) < 0.035) & (size > 0) & has_glint[lab]
    colA[glint] = glint_col[lab][glint]
    return dict(lab=lab, size=size, colA=colA, colB=colB, meta=meta, zone=zone)


# ---- export -------------------------------------------------------------------------------------

def export(out, kinds, sources, fields, blacks, ground, spec, by_id):
    """Write each source as a colour image and a meta image, the fields as images, and a manifest."""
    works, windex = [], {}

    def ref(w):
        if w["id"] not in windex:
            windex[w["id"]] = len(works)
            works.append({k: w[k] for k in ("id", "title", "artist", "date", "url", "colors")})
        return windex[w["id"]]

    entries = []
    for sid, (kind, src) in enumerate(zip(kinds, sources)):
        size = src["size"].astype(np.uint8)
        col = np.clip(src["colB"], 0, 255).astype(np.uint8)
        col[size == 0] = blacks                     # the gaps are ground; keeping them plain helps the file
        Image.fromarray(col, "RGB").save(out / f"s{sid}-colour.webp", lossless=True, method=6)
        lab = src["lab"].astype(np.uint16)
        # Meta: clod number (low byte red, high byte green) and in blue the dot size plus, in bit 2,
        # whether the cell is part of a straddling object's zone. A canvas reads these back exactly.
        blue = (size & 3) | (src["zone"].astype(np.uint8) << 2)
        Image.fromarray(np.stack([lab & 255, lab >> 8, blue], -1).astype(np.uint8), "RGB").save(
            out / f"s{sid}-meta.png", optimize=True)
        clods = [[ref(m["work"]), m["kind"], m.get("key")] if m else [-1, None, None] for m in src["meta"]]
        entries.append(dict(kind=kind, clods=clods))

    images = []
    for g in range(0, len(fields), 3):
        chans = [np.round(f * 255) for f in fields[g:g + 3]]
        chans += [np.zeros((N, N))] * (3 - len(chans))
        Image.fromarray(np.stack(chans, -1).astype(np.uint8), "RGB").save(out / f"fields-{g // 3}.png", optimize=True)
        images.append(f"fields-{g // 3}.png")

    ids = lambda kind: [i for i, k in enumerate(kinds) if k == kind]
    manifest = dict(
        grid=N, colours=K,
        corners=ids("corner"), vertical=ids("vertical"), horizontal=ids("horizontal"), middles=ids("middle"),
        zone=dict(A=A, D=D, CZ=CZ, CZ_WANDER=CZ_WANDER), fields=images,
        ground=dict(hex=ground[1], work=ref(ground[0])),
        edges=dict(vertical=[dict(kind=o["kind"], id=o["id"], title=by_id[o["id"]]["title"], artist=by_id[o["id"]]["artist"]) for o in spec["vertical"][:K]],
                   horizontal=[dict(kind=o["kind"], id=o["id"], title=by_id[o["id"]]["title"], artist=by_id[o["id"]]["artist"]) for o in spec["horizontal"][:K]]),
        phi=dict(sink=PHI ** -3, sunk=PHI ** -2),
        works=works, sources=entries,
    )
    (out / "plane.json").write_text(json.dumps(manifest, ensure_ascii=False))
    return out / "plane.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--cache", default=str(HERE / "private" / "cache"))
    ap.add_argument("--out", default=str(HERE / "private" / "plane"))
    args = ap.parse_args()
    rng = np.random.default_rng(args.seed)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    spec = json.loads((HERE / "objects.json").read_text())
    images = Images(args.cache)

    works = cs.load_paintings(args.db)
    by_id = {w["id"]: w for w in works}
    pool, face_pool = [], []
    faces = detect_faces(works, images, out.parent / "faces.json", set(spec["not_faces"]))
    for w in works:
        choc = [c for c in w["colors"] if cs.is_chocolate(c)]
        loose = [c for c in w["colors"] if cs.is_chocolate(c, 0.08, 0.6)]
        pale = [c for c in w["colors"] if cs.is_warm_pale(c)]
        glint = max(pale, key=lambda c: cs.hls(c)[1]) if pale else None
        if choc:
            pool.append(dict(work=w, hex=min(choc, key=lambda c: abs(cs.hls(c)[0] - 25)), glint=glint))
        if w["id"] in faces and (choc or loose):
            face_pool.append(dict(work=w, hex=(choc or loose)[0], glint=glint, face=faces[w["id"]]))
    grounds = [(w, c) for w in works for c in w["colors"] if cs.is_chocolate(c, 0.04, 0.13)]
    ground_work, ground_hex = min(grounds, key=lambda wc: cs.hls(wc[1])[1] + abs(cs.hls(wc[1])[0] - 22) / 400)
    print(f"{len(pool)} chocolate paintings, {len(face_pool)} with faces")

    def obj(o):
        w = by_id[o["id"]]
        return dict(o, work=w, img=images.get(w["image"], "large"), hex=w["colors"][0])

    span = N - 2 * (CZ + CZ_WANDER) - 34               # room along an edge between the corners (Fibonacci margin)
    corners = [make_source(rng, pool, face_pool, images) for _ in range(CORNERS)]
    vert = [make_source(rng, pool, face_pool, images, [(obj(o), (0, N / 2, 2 * OBJ_HALF, span), "across")], f"v{c}")
            for c, o in enumerate(spec["vertical"][:K])]
    horiz = [make_source(rng, pool, face_pool, images, [(obj(o), (N / 2, 0, span, 2 * OBJ_HALF), "across")], f"h{c}")
             for c, o in enumerate(spec["horizontal"][:K])]

    # Shapes that surface inside single tiles: the hand-found ones and every checked face that is
    # not already on a join. Each is used once, so new shapes keep turning up across the set.
    on_joins = {o["id"] for o in spec["vertical"] + spec["horizontal"]}
    within = [dict(o) for o in spec["within"]]
    g2, g1 = PHI ** -2, PHI ** -1
    for wid, (x0, y0, x1, y1) in faces.items():
        if wid in on_joins or wid not in by_id:
            continue
        fw, fh = x1 - x0, y1 - y0
        within.append(dict(id=wid, kind="face", box=[max(0, x0 - fw * g2), max(0, y0 - fh * g1),
                                                     min(1, x1 + fw * g2), min(1, y1 + fh * g1)]))
    within = [within[i] for i in rng.permutation(len(within))]
    print(f"{len(within)} shapes to surface inside tiles")
    # Where they surface: the golden-section points of the tile, and how big: N/phi^4 alone, N/phi^5 as a pair.
    lo, hi = N * g2, N * g1
    one = [(N / 2, N / 2, 2 * N / PHI ** 4, 2 * N / PHI ** 4)]
    two = [(lo, lo, 2 * N / PHI ** 5, 2 * N / PHI ** 5), (hi, hi, 2 * N / PHI ** 5, 2 * N / PHI ** 5)]
    a_fields = [cs.field(rng, 5, 34) for _ in range(K)]
    b_fields = [cs.field(rng, 5, 34) for _ in range(K)]
    corner_noise = cs.field(rng, 8, 34)

    middles = []
    for m in range(MIDDLES):
        places = two if rng.random() < SECOND else one
        if rng.random() < PHI ** -2:
            places = [(N - x, y, w_, h_) for x, y, w_, h_ in places]      # the other diagonal
        mine = [(obj(within.pop()), p, "within") for p in places if within]
        middles.append(make_source(rng, pool, face_pool, images, mine, f"m{m}"))
        print(f"middle soil {m + 1} of {MIDDLES}: {len(mine)} shape(s) surfacing")

    kinds = ["corner"] * CORNERS + ["vertical"] * len(vert) + ["horizontal"] * len(horiz) + ["middle"] * len(middles)
    blacks = rgb(ground_hex).astype(np.uint8)
    path = export(out, kinds, corners + vert + horiz + middles, a_fields + b_fields + [corner_noise],
                  blacks, (ground_work, ground_hex), spec, by_id)
    print(path)


if __name__ == "__main__":
    main()
