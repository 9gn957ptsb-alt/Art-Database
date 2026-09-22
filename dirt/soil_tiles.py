#!/usr/bin/env python3
"""DIRT tiles: a set of different collection-soil squares whose edges all line up.

This is an edge-matched (Wang) tile set. Every vertical tile edge has one of four colours and every
horizontal edge one of four more, and each colour is a whole object from a painting that straddles
the edge: a face split down its middle on the vertical edges, and a boat, a bridge, a building or an
angel split across on the horizontal ones. A tile shows the half on its own side, and the
neighbour that shares that edge colour shows the other half, so the object is continuous across
the join. There are sixteen tiles, one for every pairing of west and north edge. Laying a grid left
to right and top to bottom, each place takes the tile that matches the edges already down, so any
arrangement lines up.

A tile is made of zones, and each zone takes its soil from a source that the tiles meeting there
share:

  corners  one universal soil, so the four tiles meeting at a point agree
  edges    a soil per edge colour, carrying that colour's object across the join
  middle   a soil of the tile's own

The zone boundaries depend only on things both sides of an edge agree on, and zones simply abut,
clod against clod, so no frame shows. Clods are bigger than in the single tile, and where a clod's painting
has a face in it (OpenCV's Haar detector, checked by eye; see objects.json), the clod's cutout is
centred on that face, so the fragments read as things rather than patches of colour.

Colour mode keeps each clod to its painting's chocolate swatch. The eight straddling objects are
drawn in colour mode with only their painting's three colours, ranked by lightness, so they stay
legible without leaving the token. Everything this writes goes to dirt/private/, because the cutouts
reproduce other artists' images.

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
K = 4                 # edge colours per axis
A, D = 16, 10         # strip half-width in cells, and how far it wanders; it swells round the object
CZ = A + D + 4        # corner zone half-size (always wider than a strip near the corners)
OBJ_HALF = 46         # the straddling objects' half-thickness across their edge
CLODS = 130           # per source; fewer and bigger than the single tile's 220


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

def insert_object(lab, edge, obj, cx, cy, wmax, hmax, cid, rng):
    """Carve an object clod centred at (cx, cy) on the periodic grid. Returns its cell mask."""
    img = obj["img"]
    x0, y0, x1, y1 = obj["box"]
    ar = ((x1 - x0) * img.width) / ((y1 - y0) * img.height)
    w = min(wmax, hmax * ar)
    h = w / ar
    yy, xx = np.mgrid[0:N, 0:N].astype(float)
    u = cs.wrap(xx + 0.5 - cx) / (w / 2)
    v = cs.wrap(yy + 0.5 - cy) / (h / 2)
    wob = 1 + 0.22 * (cs.field(rng, 4, 26) - 0.5)       # a ragged, clod-like outline
    r = (np.abs(u) ** 3 + np.abs(v) ** 3) ** (1 / 3) / wob
    inside = r < 1
    lab[inside] = cid
    half = min(w, h) / 2
    edge[inside] = (1 - r[inside]) * half
    # The object's own image, resampled to one pixel a cell.
    crop = img.crop((int(x0 * img.width), int(y0 * img.height), int(x1 * img.width), int(y1 * img.height)))
    pix = np.asarray(crop.resize((max(1, round(w)), max(1, round(h))), Image.BOX), float)
    py = np.clip(((v + 1) / 2 * pix.shape[0]).astype(int), 0, pix.shape[0] - 1)
    px = np.clip(((u + 1) / 2 * pix.shape[1]).astype(int), 0, pix.shape[1] - 1)
    return inside, pix[py, px], r < 1 + 4 / half


def make_source(rng, pool, face_pool, images, obj=None, where=None):
    """A periodic N×N soil: clods, weave, colour and cutout. Optionally with one object carved in."""
    lab, edge, ox, oy = cs.clods(rng, CLODS)
    k = CLODS
    obj_mask = None
    if obj is not None:
        cx, cy, wmax, hmax = where
        obj_mask, obj_pix, obj_zone = insert_object(lab, edge, obj, cx, cy, wmax, hmax, k, rng)
        k += 1
    size = cs.weave(rng, edge)
    shade = cs.relief(edge)
    sizes = np.bincount(lab.ravel(), minlength=k)

    # Paintings: the biggest quarter of clods go to paintings with faces, centred on the face.
    order = [i for i in np.argsort(-sizes[:CLODS]) if sizes[i] > 0]
    n_face = len(order) // 4
    faces = list(rng.permutation(len(face_pool)))
    chocs = list(rng.permutation(len(pool)))
    meta = [None] * k
    colA = np.zeros((N, N, 3))
    colB = np.zeros((N, N, 3))
    glint_col = np.zeros((k, 3))
    has_glint = np.zeros(k, bool)
    for rank, i in enumerate(order):
        cells = lab == i
        p = face_pool[faces.pop()] if rank < n_face and faces else pool[chocs.pop()]
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
            fs = max((fx1 - fx0) * w, (fy1 - fy0) * h) * 1.25
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

    colA *= shade[..., None]
    colB *= shade[..., None]
    glint = (rng.random((N, N)) < 0.035) & (size > 0) & has_glint[lab]
    colA[glint] = glint_col[lab][glint]

    if obj is not None:
        i = CLODS
        work = obj["work"]
        meta[i] = dict(work=work, hex=obj["hex"], glint=None, kind="across:" + obj["kind"])
        # Colour mode: the object in its painting's own three colours, ranked by lightness.
        three = np.stack([rgb(c) for c in sorted(work["colors"], key=lambda c: lum(rgb(c)))])
        L = lum(obj_pix)
        cuts = np.quantile(L[obj_mask], [1 / 3, 2 / 3])
        tone = np.digitize(L, cuts)
        colA[obj_mask] = three[np.minimum(tone, len(three) - 1)][obj_mask]
        colB[obj_mask] = obj_pix[obj_mask]
        # Denser dots inside the object, so the picture is defined; toward its outline the ordinary
        # weave takes over again, so it dissolves into the soil instead of sitting on it.
        inner = obj_mask & (edge >= 4)
        size[inner] = np.where(size[inner] >= 2, 3, 2)
    zone = obj_zone if obj is not None else np.zeros((N, N), bool)
    return dict(lab=lab, size=size, colA=colA, colB=colB, meta=meta, zone=zone)


# ---- tiles --------------------------------------------------------------------------------------

def zones(srcs, west, east, north, south, a_fields, b_fields, corner_noise):
    """Per cell: which source it takes (0 corner, 1 west, 2 east, 3 north, 4 south, 5 middle)."""
    idx = np.arange(N)
    dxe_i = np.minimum(idx, N - 1 - idx)                 # same value either side of an edge
    X, Y = np.meshgrid(dxe_i, dxe_i)                     # X = distance to vertical edge, Y to horizontal
    cz = CZ + 6 * corner_noise[np.minimum(Y, N - 1), np.minimum(X, N - 1)]
    corner = (X + 0.5 < cz) & (Y + 0.5 < cz)
    yy, xx = np.mgrid[0:N, 0:N]
    a = A + D * (2 * np.where(xx < N // 2, a_fields[west][yy, X], a_fields[east][yy, X]) - 1)
    b = A + D * (2 * np.where(yy < N // 2, b_fields[north][Y, xx], b_fields[south][Y, xx]) - 1)
    # A strip is a thin wandering band that swells to take in its object whole.
    v_obj = np.where(xx < N // 2, srcs[1]["zone"], srcs[2]["zone"])
    h_obj = np.where(yy < N // 2, srcs[3]["zone"], srcs[4]["zone"])
    z = np.full((N, N), 5)
    hs = ~corner & ((Y + 0.5 < b) | h_obj)
    vs = ~corner & ~hs & ((X + 0.5 < a) | v_obj)
    z[vs & (xx < N // 2)] = 1
    z[vs & (xx >= N // 2)] = 2
    z[hs & (yy < N // 2)] = 3
    z[hs & (yy >= N // 2)] = 4
    z[corner] = 0
    return z


def compose(z, srcs):
    """Take each cell from its zone's source. Zones simply abut, clod against clod."""
    out = {key: np.zeros_like(srcs[0][key]) for key in ("size", "colA", "colB")}
    gid = np.zeros((N, N), int)
    for zi, s in enumerate(srcs):
        m = z == zi
        for key in out:
            out[key][m] = s[key][m]
        gid[m] = zi * 1000 + s["lab"][m]
    return out, gid


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--seed", type=int, default=11)
    ap.add_argument("--cache", default=str(HERE / "private" / "cache"))
    ap.add_argument("--out", default=str(HERE / "private" / "tiles"))
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

    span = N - 2 * (CZ + 6) - 8                        # room along an edge between the corners
    corner_src = make_source(rng, pool, face_pool, images)
    vert = [make_source(rng, pool, face_pool, images, obj(o), (0, N / 2, 2 * OBJ_HALF, span)) for o in spec["vertical"]]
    horiz = [make_source(rng, pool, face_pool, images, obj(o), (N / 2, 0, span, 2 * OBJ_HALF)) for o in spec["horizontal"]]
    a_fields = [cs.field(rng, 5, 30) for _ in range(K)]
    b_fields = [cs.field(rng, 5, 30) for _ in range(K)]
    corner_noise = cs.field(rng, 8, 40)

    blacks = rgb(ground_hex).astype(np.uint8)
    tiles = []
    for west in range(K):
        for north in range(K):
            east, south = int(rng.integers(K)), int(rng.integers(K))
            name = f"w{west}n{north}e{east}s{south}"
            middle = make_source(rng, pool, face_pool, images)
            srcs = [corner_src, vert[west], vert[east], horiz[north], horiz[south], middle]
            z = zones(srcs, west, east, north, south, a_fields, b_fields, corner_noise)
            t, gid = compose(z, srcs)
            # Local clod numbering for this tile, and who each clod came from.
            ids, local = np.unique(gid, return_inverse=True)
            clods = []
            for g in ids:
                m = srcs[g // 1000]["meta"][g % 1000]
                clods.append(dict(hex=m["hex"], glint=m["glint"], kind=m["kind"],
                                  work={k_: m["work"][k_] for k_ in ("id", "title", "artist", "date", "url")},
                                  cells=int((gid == g).sum())))
            assert len(clods) < 256, len(clods)
            for mode in ("colA", "colB"):
                img = cs.paint(t["size"], np.clip(t[mode], 0, 255).astype(np.uint8))
                img[img[..., 3] == 0, :3] = blacks
                img[..., 3] = 255
                Image.fromarray(img[..., :3]).save(out / f"{name}-{'colour' if mode == 'colA' else 'cutout'}.webp",
                                                    lossless=True, method=6)
            Image.fromarray(local.reshape(N, N).astype(np.uint8), "L").save(out / f"{name}-labels.png", optimize=True)
            tiles.append(dict(name=name, west=west, north=north, east=east, south=south, clods=clods))
            print(name, len(clods), "clods")

    manifest = dict(
        grid=N, cell=CELL, tile=T, colours=K,
        ground=dict(hex=ground_hex, work={k_: ground_work[k_] for k_ in ("id", "title", "artist", "date", "url")}),
        edges=dict(vertical=[dict(kind=o["kind"], id=o["id"], title=by_id[o["id"]]["title"], artist=by_id[o["id"]]["artist"]) for o in spec["vertical"]],
                   horizontal=[dict(kind=o["kind"], id=o["id"], title=by_id[o["id"]]["title"], artist=by_id[o["id"]]["artist"]) for o in spec["horizontal"]]),
        tiles=tiles,
    )
    (out / "tiles.json").write_text(json.dumps(manifest, ensure_ascii=False))
    print(out / "tiles.json")


if __name__ == "__main__":
    main()
