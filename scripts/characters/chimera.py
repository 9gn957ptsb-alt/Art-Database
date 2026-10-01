"""The chimera: any three of the cast, as an exquisite corpse.

The artist, 1 Oct 2026, of the relay he approved ("the exquisite corpse":
three legs, each player bringing an animal, the three stitched into one
hybrid drawn in DIRT): "really work on the three Artist Chimera, it should
be the most refined and well portrayed character on the entire site. It's
gotta be good, like really good."

A Surrealist corpse is drawn on a folded sheet: each player draws a part,
folds it under, and leaves only the ends of the lines crossing the fold for
the next to go on from. So here. Every character of the cast is drawn whole
in its own file; this cuts it, at two folds, into three parts — the head
(and neck), the body (the forequarters, with the forelegs or wings), and the
hindquarters (the hind legs, the tail, the foot) — and draws each part on
its own, so that any head joins any body joins any hindquarters:

- The folds are vertical creases in the side-on picture. At each, the
  agreed marks are fixed: where the back crosses it and where the belly
  does (NECK and HIP below, in cells above the ground). Every part is drawn
  so that its own back and belly cross the crease there — warped toward
  them near the crease, itself again a few cells on — so the masses run on
  from one part into the next, as the lines of a corpse run on past the
  fold, without any part knowing the others.
- Each part is in its own scale (its character's CHIMERA_SCALE, nudged
  toward the agreed marks), its own artist's hand and inks; its ground is
  the common ground, so legs and feet stand on it.
- Limbs reach a little past the crease (a foreleg stepping forward under
  the head); everything else is cut at it, as the paper cuts it.

Each character module gives `rig(pose, k)` (its whole figure in one of the
chimera's poses, as parts, and how far it is lowered when it rests),
`SEAMS` (the x of each fold in its own picture, and a height inside the
body there) and `CHIMERA_SCALE`. Poses (FRAMES): a walk in six frames, a
stand with two idles, a pause, a look at you, a rest and the presentation
pose for the unfolding.

The page (docs/v2/characters.js) lays the three parts side by side at the
creases, each part's cells in its own character's inks worked with the
soil, and draws the creases faintly, as folds in the paper.
"""

import importlib
import inspect
import math

from draw import light_at

RES = 1.5                      # cells of a chimera's picture to a cell of a character's own
CH = 30                        # the picture's height, in a character's cells
ROWS = int(CH * RES)           # ... and in its own
G = 28.6                       # the ground line, in cells from the top
NECK = (G - 15.2, G - 7.4)     # where the back and the belly cross the neck's fold
HIP = (G - 13.6, G - 6.8)      # ... and the hip's
GIVE = 0.35                    # how much of its own height a part keeps at a fold
DROP = 4.6                     # how far the folds' marks come down when it rests
FALL = 3.6                     # cells over which a part comes back to itself from a fold
MARGIN = 5                     # how far a limb may reach past its fold
POSES = [("walk", k) for k in range(6)] + [("stand", 0), ("stand", 1), ("stand", 2),
                                            ("back", 0), ("look", 0), ("rest", 0), ("present", 0)]
NAMES = ["walk%d" % k for k in range(6)] + ["stand0", "stand1", "stand2", "back", "look", "rest", "present"]
SLOTS = ("head", "body", "hind")


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def clamp(v, a, b):
    return max(a, min(b, v))


def is_limb(part, slot):
    return getattr(part, "limb", None) == slot


def section(parts, x, hint, h):
    """Where the body (not its limbs) is crossed at x: its top and bottom,
    the run of cells containing the height `hint`, or the nearest run."""
    trunk = [p for p in parts if getattr(p, "limb", None) is None]
    ys = [k * 0.1 for k in range(int(h * 10) + 1)]
    inside = [any(p.sdf(x, y) <= 0 for p in trunk) for y in ys]
    runs, start = [], None
    for y, ok in zip(ys, inside):
        if ok and start is None:
            start = y
        if not ok and start is not None:
            runs.append((start, y))
            start = None
    if start is not None:
        runs.append((start, ys[-1]))
    if not runs:
        return (hint - 2.0, hint + 2.0)
    return min(runs, key=lambda r: 0 if r[0] <= hint <= r[1] else min(abs(r[0] - hint), abs(r[1] - hint)))


class Rig:
    """One character's three parts: their scales and the maps from the
    chimera's picture into the character's own."""

    def __init__(self, cid):
        self.id = cid
        self.mod = importlib.import_module(cid)
        m = self.mod
        self.g = m.GROUND
        self.base = getattr(m, "CHIMERA_SCALE", 1.0)
        parts, _ = self.pose("stand", 0, "body")
        (nx, ny), (hx, hy) = m.SEAMS["neck"], m.SEAMS["hip"]
        tn, bn = section(parts, nx, ny, m.H)
        th, bh = section(parts, hx, hy, m.H)
        rn = (NECK[1] - NECK[0]) / ((bn - tn) * self.base)
        rh = (HIP[1] - HIP[0]) / ((bh - th) * self.base)
        self.s = {
            "head": self.base * clamp(math.sqrt(rn), 1.0, 1.22),
            "hind": self.base * clamp(math.sqrt(rh), 0.82, 1.22),
            "body": self.base * clamp(math.sqrt(math.sqrt(rn * rh)), 0.82, 1.22),
        }
        self.cols = max(9, int(round((nx - hx) * self.s["body"] * RES)))
        self.len = self.cols / RES

    def pose(self, pose, k, slot):
        if "slot" in inspect.signature(self.mod.rig).parameters:
            return self.mod.rig(pose, k, slot=slot)
        return self.mod.rig(pose, k)

    def native(self, slot, X, Y, secs, drop):
        """The point of the character's own picture under (X, Y) of the
        chimera's, X counted from the part's anchor (the neck's fold for
        the head, the hip's for the body and the hindquarters)."""
        m = self.mod
        nx, hx = m.SEAMS["neck"][0], m.SEAMS["hip"][0]
        s = self.s[slot]
        if slot == "head":
            x = nx + X / s
        elif slot == "hind":
            x = hx + X / s
        else:
            x = hx + X * (nx - hx) / self.len
        free = self.g - (G - Y) / s

        def seam(std, sec):
            T, B = std[0] + drop, std[1] + drop
            t, b = sec
            # The agreed marks hold, but give a little: a part much taller or
            # deeper than the marks keeps some of it (a hump over the fold).
            ft, fb = G - (self.g - t) * s, G - (self.g - b) * s
            T, B = T + (ft - T) * GIVE, B + (fb - B) * GIVE
            if Y < T:
                return t - (T - Y) / s
            if Y <= B:
                return t + (Y - T) * (b - t) / (B - T)
            return b + (Y - B) * (self.g - b) / max(0.5, G - B)
        y = free
        if slot == "head":
            w = smooth(1 - X / FALL)
            y = free + w * (seam(NECK, secs["neck"]) - free)
        elif slot == "hind":
            fall = max(FALL, 0.55 * self.hind_len())
            w = smooth(1 - (-X) / fall)
            y = free + w * (seam(HIP, secs["hip"]) - free)
        else:
            wh = smooth(1 - X / FALL)
            wn = smooth(1 - (self.len - X) / FALL)
            y = free + wh * (seam(HIP, secs["hip"]) - free) + wn * (seam(NECK, secs["neck"]) - free)
        return x, y

    def hind_len(self):
        if not hasattr(self, "_hl"):
            parts, _ = self.pose("stand", 0, "hind")
            hx = self.mod.SEAMS["hip"][0]
            left = hx
            for i in range(int(hx * 4)):
                x = i * 0.25
                if any(p.sdf(x, y * 0.5) <= 0 for p in parts for y in range(int(self.mod.H * 2))):
                    left = x
                    break
            self._hl = (hx - left) * self.s["hind"]
        return self._hl

    def layer(self, slot, pose, k):
        """One part in one pose: rows of letters over the columns it covers,
        and the first column's place from its anchor."""
        m = self.mod
        parts, ndrop = self.pose(pose, k, slot)
        drop = DROP if pose == "rest" else 0.0
        secs = {
            "neck": section(parts, m.SEAMS["neck"][0], m.SEAMS["neck"][1] + ndrop, m.H),
            "hip": section(parts, m.SEAMS["hip"][0], m.SEAMS["hip"][1] + ndrop, m.H),
        }
        M = int(MARGIN * RES)
        if slot == "head":
            lo, hi = -M, int(34 * RES)
            keep = (0, 99)
        elif slot == "body":
            lo, hi = -M, self.cols + M
            keep = (0, self.len)
        else:
            lo, hi = -int(34 * RES), M
            keep = (-99, 0)
        w = hi - lo
        cells = [["." for _ in range(w)] for _ in range(ROWS)]
        owner = [[-1] * w for _ in range(ROWS)]
        edge = [[False] * w for _ in range(ROWS)]
        for c in range(w):
            X = (lo + c + 0.5) / RES
            inside = keep[0] <= X < keep[1]
            for j in range(ROWS):
                Y = (j + 0.5) / RES
                x, y = self.native(slot, X, Y, secs, drop)
                for n, part in enumerate(parts):
                    if not inside and not is_limb(part, slot):
                        continue
                    if inside and getattr(part, "limb", None) not in (None, slot) and \
                            not self.reaches(part, slot, X):
                        continue
                    d = part.sdf(x, y)
                    if d > 0.0:
                        continue
                    cells[j][c] = part.paint(x, y, light_at(part.sdf, x, y, d), c + lo + 64, j)
                    owner[j][c] = n
                    edge[j][c] = d > -0.9 / RES
        deep = getattr(m, "DEEP", "d")
        for j in range(ROWS):
            for c in range(w):
                n = owner[j][c]
                if n < 0 or not edge[j][c]:
                    continue
                for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    a, b = c + di, j + dj
                    if 0 <= a < w and 0 <= b < ROWS and owner[b][a] >= 0 and \
                            parts[owner[b][a]].group < parts[n].group and cells[j][c] not in "kKy":
                        cells[j][c] = deep
                        break
        # The outline, as raster draws it, but never on the far side of a fold
        # (unless round a limb that reaches over it).
        out = [row[:] for row in cells]
        for j in range(ROWS):
            for c in range(w):
                if cells[j][c] != ".":
                    continue
                X = (lo + c + 0.5) / RES
                own = keep[0] <= X < keep[1]
                lit, near = 0, False
                for di, dj, kk in ((1, 0, 1), (0, 1, 1), (-1, 0, -1), (0, -1, -1)):
                    a, b = c + di, j + dj
                    if 0 <= a < w and 0 <= b < ROWS and cells[b][a] != ".":
                        if own or (owner[b][a] >= 0 and is_limb(parts[owner[b][a]], slot)):
                            near = True
                            lit += kk
                if near:
                    out[j][c] = "p" if lit > 0 else "o"
        rows = ["".join(r) for r in out]
        finish = getattr(m, "finish", None)
        if finish:
            rows = finish(rows)
            if slot != "hind" or True:
                rows = self.clip_finish(rows, lo, keep, parts, slot)
        # Crop to the columns used.
        used = [c for c in range(w) if any(r[c] != "." for r in rows)]
        if not used:
            return [0, [""] * ROWS]
        a, b = used[0], used[-1] + 1
        return [lo + a, [r[a:b] for r in rows]]

    def reaches(self, part, slot, X):
        # A limb of another part, inside this part's columns: not ours to draw.
        return False

    def clip_finish(self, rows, lo, keep, parts, slot):
        """A finish (a key line printed off register) may push a cell over
        the fold: it stays on its own side."""
        out = []
        for r in rows:
            line = list(r)
            for c, ch in enumerate(line):
                X = lo + c + 0.5
                if ch != "." and not (keep[0] - 1 <= X < keep[1] + 1) and ch in "y":
                    pass
            out.append("".join(line))
        return out


def build(cid):
    rig = Rig(cid)
    out = {"id": cid, "len": rig.cols, "scale": {k: round(v, 3) for k, v in rig.s.items()}}
    for slot in SLOTS:
        out[slot] = {name: rig.layer(slot, pose, k) for name, (pose, k) in zip(NAMES, POSES)}
    return out


def compose(layers, names=None):
    """Lay three parts side by side at their folds: layers is
    (head, body, hind) as build() gives them; names the pose of each
    (one name for all, or three). Returns rows of letters, rows of which
    part each cell is (0 head, 1 body, 2 hind, or "."), and the folds' columns."""
    head, body, hind = layers
    if names is None or isinstance(names, str):
        names = (names or "stand0",) * 3
    left = max(-hind["hind"][n][0] for n in NAMES) + 1
    right = max(head["head"][n][0] + len(head["head"][n][1][0]) for n in NAMES)
    hip, neck = left, left + body["len"]
    w = neck + right + 1
    cells = [["."] * w for _ in range(ROWS)]
    who = [["."] * w for _ in range(ROWS)]
    for slot, src, at, name, tag in (("hind", hind, hip, names[2], "2"), ("body", body, hip, names[1], "1"),
                                     ("head", head, neck, names[0], "0")):
        x0, rows = src[slot][name]
        for j, r in enumerate(rows):
            for i, ch in enumerate(r):
                if ch == ".":
                    continue
                c = at + x0 + i
                if not 0 <= c < w:
                    continue
                if ch in "op" and cells[j][c] not in ".op":
                    continue
                cells[j][c] = ch
                who[j][c] = tag
    return ["".join(r) for r in cells], ["".join(r) for r in who], (hip, neck)
