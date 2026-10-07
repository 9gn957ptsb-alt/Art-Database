"""The artist's hand, from data: how a native character is laid, and in what inks.

A native character is drawn after its place's native artist (natives.py). Two
things come from the artist's saved works, and nothing is invented:

- **The mark** (`mode_of`): what the works are made with, read from each
  work's medium in its public history (and Find's category when the medium
  says nothing), the commonest winning — ink or pen a line; oil or acrylic
  leaning strokes; a screenprint, lithograph, etching or woodcut flat plates
  with the key line printed a cell off register (Warhol's eagle); collage or
  cut paper cut pieces with the ground between them (Matisse's squirrel);
  a photograph grain; watercolour or gouache washes, pooled darker at the
  edges; graphite, pencil, charcoal or pastel hatching; sculpture, bronze or
  ceramic modelled bands (Kapoor's slug); anything else a dither.
- **The inks** (`inks_for`): the colours measured off the artist's works
  (`c`, up to three a work) — each colour of the real animal (its coat, its
  pale parts, its dark marks, its eye) taken by the artist's colour nearest it
  in Lab, the way every cell of the globe wears the saved work nearest its
  material; a step the artist's colours do not give is that colour worked
  toward the artist's own darkest or lightest. After the ground (no native
  artist), the inks are the place's: its DIRT soil and its plants' look.
"""

import math
import re

from draw import bayer, flat, offset_line, ramp, strokes, unline

STEPS = {"coat": "Rrg", "far": "dR", "pale": "Ww", "dark": "kK", "eye": "y"}

# ---- the mark --------------------------------------------------------------------

MEDIA = [
    ("cut", r"collage|cut[- ]paper|papier[s]? d[ée]coup|découpage"),
    ("plates", r"screen ?print|silk ?screen|serigraph|lithograph|etching|aquatint|engraving|woodcut|linocut|drypoint|mezzotint|intaglio|relief print"),
    ("grain", r"photograph|gelatin silver|chromogenic|c-print|inkjet|pigment print|platinum|albumen|archival|dye transfer|daguerreotype|polaroid"),
    ("wash", r"watercolou?r|gouache|ink wash|sumi"),
    ("hatch", r"graphite|pencil|charcoal|pastel|crayon|conté|chalk|silverpoint"),
    ("line", r"\bink\b|\bpen\b|marker|felt[- ]tip|ballpoint"),
    ("strokes", r"\boil\b|acrylic|tempera|encaustic|enamel|alkyd|distemper"),
    ("bands", r"bronze|ceramic|stoneware|porcelain|marble|sculpture|steel|aluminium|aluminum|resin|fiberglass|wax|plaster|terracotta|cast "),
]
CATEGORY = {"Painting": "strokes", "Print": "plates", "Photography": "grain", "Sculpture": "bands",
            "Drawing, Collage or other Work on Paper": "hatch", "Posters": "plates", "Installation": "bands"}
SAID = {"line": "ink and pen: a line", "strokes": "oil and acrylic: leaning strokes",
        "plates": "prints: flat plates, the key line off register", "cut": "collage: cut pieces, the ground between",
        "grain": "photographs: a grain", "wash": "watercolour: washes pooled at the edges",
        "hatch": "graphite and charcoal: hatching", "bands": "sculpture: modelled bands", "dither": "a dither",
        "ground": "the place's own soil"}
ORDER = ["strokes", "plates", "grain", "hatch", "wash", "line", "cut", "bands", "dither"]


def mode_of_work(medium, category):
    m = (medium or "").lower()
    for mode, rx in MEDIA:
        if re.search(rx, m):
            return mode
    return CATEGORY.get(category, "dither")


def mode_of(works):
    """works: [(medium, category)]; the commonest mark, and how many works make it."""
    count = {}
    for med, cat in works:
        k = mode_of_work(med, cat)
        count[k] = count.get(k, 0) + 1
    if not count:
        return "dither", 0
    known = [k for k in count if k != "dither"] or list(count)       # a work whose medium says nothing does not vote
    best = sorted(known, key=lambda k: (-count[k], ORDER.index(k)))[0]
    return best, count[best]


# ---- the hand ---------------------------------------------------------------------

def hsh(i, j, s=0):
    n = (i * 73856093) ^ (j * 19349663) ^ (s * 83492791)
    n &= 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFFFFFF) % 1024 / 1024.0


DARKER = {"g": "r", "r": "R", "R": "d", "d": "d", "w": "W", "W": "W", "K": "k", "k": "k"}


class Hand:
    def __init__(self, mode):
        self.mode = mode
        self.deep = "." if mode == "cut" else ("o" if mode == "line" else "d")
        self.cache = {}

    def paint_for(self, role):
        if role in self.cache:
            return self.cache[role]
        steps = STEPS[role]
        m = self.mode
        if role == "eye":
            f = lambda x, y, light, i, j: "y"
        elif m == "strokes":
            f = strokes(steps)
        elif m in ("plates", "cut"):
            f = flat(steps)
        elif m == "bands":
            f = strokes(steps, angle=math.pi, width=2.0, swing=1.1)
        elif m == "grain":
            def f(x, y, light, i, j, steps=steps):
                n = len(steps)
                k = int(math.floor(light * n - 0.5 + (hsh(i, j, 17) - 0.5) * 1.5 + 0.5))
                return steps[max(0, min(n - 1, k))]
        elif m == "wash":
            r = ramp(steps)
            f = lambda x, y, light, i, j, r=r: r(x, y, min(1.0, light + 0.18), i, j)
        elif m == "hatch":
            def f(x, y, light, i, j, steps=steps):
                n = len(steps)
                k = min(n - 1, int(light * n + 0.25))
                if (i + j) % 3 == 0 and light < 0.74:
                    k -= 1
                if (i - j) % 4 == 0 and light < 0.46:
                    k -= 1
                return steps[max(0, k)]
        elif m == "line":
            def f(x, y, light, i, j, steps=steps, role=role):
                if role == "dark":
                    return "k"
                return steps[-1] if light > 0.3 else steps[max(0, len(steps) - 2)]
        else:
            f = ramp(steps)
        self.cache[role] = f
        return f

    def lay(self, role, x, y, light, i, j):
        return self.paint_for(role)(x, y, light, i, j)

    def finish(self, rows):
        m = self.mode
        if m == "plates":
            return offset_line(rows, 1, 1, "y")
        if m == "cut":
            return unline(rows)
        if m == "line":
            return [r.replace("p", "o") for r in rows]
        if m == "wash":
            h, w = len(rows), len(rows[0])
            out = [list(r) for r in rows]
            for j in range(h):
                for i in range(w):
                    ch = rows[j][i]
                    if ch in ".op":
                        continue
                    for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                        aa, bb = i + a, j + b
                        if not (0 <= aa < w and 0 <= bb < h) or rows[bb][aa] in ".op":
                            out[j][i] = DARKER.get(ch, ch)
                            break
            return unline(["".join(r) for r in out])
        return rows


# ---- colour ------------------------------------------------------------------------

def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[k:k + 2], 16) for k in (0, 2, 4))


def hexs(c):
    return "#%02x%02x%02x" % tuple(max(0, min(255, int(round(v)))) for v in c)


def lab(c):
    def lin(v):
        v /= 255.0
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = (lin(v) for v in c)
    x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047
    y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883

    def f(t):
        return t ** (1 / 3) if t > 0.008856 else 7.787 * t + 16 / 116
    fx, fy, fz = f(x), f(y), f(z)
    return (116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz))


def dist(a, b):
    return math.sqrt(sum((p - q) ** 2 for p, q in zip(a, b)))


def mix(a, b, t):
    return tuple(a[k] + (b[k] - a[k]) * t for k in range(3))


def shade(c, dl):
    """A colour lightened or darkened by dl in Lab's L, roughly: toward black or white."""
    return mix(c, (0, 0, 0), -dl / 60.0) if dl < 0 else mix(c, (255, 255, 255), dl / 80.0)


def nearest(cols, target, avoid=()):
    t = lab(target)
    best = None
    for c in cols:
        if c in avoid:
            continue
        d = dist(lab(c), t)
        if best is None or d < best[0] or (d == best[0] and c < best[1]):
            best = (d, c)
    return best[1] if best else target


def ladder(cols, base, steps):
    """A ramp from the artist's colours: for each wanted lightness offset from the
    species' colour, the artist's colour nearest that; where it gives no step of its
    own, the chosen one worked toward the artist's darkest or lightest."""
    darkest = min(cols, key=lambda c: (lab(c)[0], c))
    lightest = max(cols, key=lambda c: (lab(c)[0], c))
    out = []
    for dl in steps:
        c = nearest(cols, shade(base, dl))
        out.append(c)
    # each step must stand apart from its neighbour, darkest first
    fixed = [out[0]]
    for n in range(1, len(out)):
        c = out[n]
        if lab(c)[0] < lab(fixed[-1])[0] + 6:
            c = mix(fixed[-1], lightest, 0.32)
            if lab(c)[0] < lab(fixed[-1])[0] + 4:
                c = shade(fixed[-1], 9)
        fixed.append(c)
    if lab(fixed[0])[0] > lab(fixed[-1])[0] - 6:
        fixed[0] = mix(fixed[0], darkest, 0.5)
    return fixed


def inks_for(cols, real):
    """The character's inks: each of the animal's real colours (real: coat, pale,
    dark, eye) taken by the artist's nearest, the steps of the coat ladder from them."""
    cols = sorted(set(cols))
    coat = ladder(cols, real["coat"], (-24, 0, 12, 24))
    pale = ladder(cols, real["pale"], (0, 10))
    dark = ladder(cols, real["dark"], (0, 12))
    eye = nearest(cols, real.get("eye", real["dark"]))
    # the chalk outline: a pale of the artist's, so the figure reads on a dark ground
    chalk = nearest(cols, (150, 146, 140))
    if lab(chalk)[0] < 48:
        chalk = mix(chalk, (200, 196, 188), 0.5)
    pen2 = nearest(cols, shade(real["coat"], -30))
    vivid = max(cols, key=lambda c: (math.hypot(lab(c)[1], lab(c)[2]), c))
    return {"coat": [hexs(c) for c in coat], "white": [hexs(c) for c in pale], "black": [hexs(c) for c in dark],
            "eye": hexs(eye), "pen": [hexs(chalk), hexs(pen2)], "box": hexs(vivid)}
