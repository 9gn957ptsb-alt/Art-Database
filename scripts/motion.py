#!/usr/bin/env python3
"""The motion/utility spectrum, and the machinery objects share along it.

Every generated object sits somewhere on one axis: how much it moves, which
tracks how much it is *for*. A painting barely moves because it has almost no
utility beyond being looked at; a hammer moves a great deal because its whole
point is the swing. Objects near each other on that axis turn out to need the
same machinery — falling water and falling leaves are one descent engine with
two payloads; a bouncing bunny and a bouncing basketball would be one arc.

That is not a taxonomy for its own sake. It is how storage stays small:

  * kin share BUILD code, so a new object in an existing family is a spec, not
    a second engine (falling leaves reuses the pools, noise and easing here);
  * kin share STORED FORM, so the family's renderer kind is written once and
    every member of the family costs only its own parameters. Falling leaves as
    a particle program is ~20 KB; the same animation stored the way the
    waterfall is stored — one full grid per frame — would be about 2 MB.

Identity comes first: a painting used as a hammer is a clever thought, but for
image generation what the object *is* governs how it is drawn, so the axis
records the motion the object actually has, not the motion it could be put to.

Nothing here renders anything. It is the shared vocabulary plus the colour kit
that build_sprites.py, build_gerstner.py, build_waterfall.py and
build_leaves.py all draw on.
"""

import colorsys
import math
import sqlite3
from bisect import bisect_left

# --------------------------------------------------------------- the spectrum
# ``motion`` is the position on the axis, 0 (inert) to 1 (all swing). ``kind``
# is the renderer form the whole family shares; adding a member costs its
# parameters and nothing else.

FAMILIES = [
    {
        "key": "panel", "name": "Panel", "kind": "sprite", "motion": 0.04,
        "utility": "Nothing to do but be looked at. The lowest utility there is, "
                   "and so the least motion: only the colour itself drifts.",
        "shares": "grid + per-slot colour cycles",
    },
    {
        "key": "vessel", "name": "Vessel", "kind": "sprite", "motion": 0.18,
        "utility": "Holds, wears or bears. Used, but used by standing still — a jar "
                   "at rest, an amulet worn, a shaft under load.",
        "shares": "grid + per-slot colour cycles",
    },
    {
        "key": "descent", "name": "Descent", "kind": "descent", "motion": 0.62,
        "utility": "Falls, and is useful in the falling. Water and leaves are the "
                   "same event with different payloads: a continuous sheet and a "
                   "set of discrete bodies.",
        "shares": "lightness pools, wrapping noise, gravity and drift",
    },
    {
        "key": "bounce", "name": "Bounce", "kind": "descent", "motion": 0.78,
        "utility": "Falls and returns. A bouncing bunny and a bouncing basketball "
                   "are one arc with two silhouettes — the arc is written, the "
                   "silhouettes are not.",
        "shares": "the descent engine, plus a restitution arc",
        "reserved": True,
    },
    {
        "key": "strike", "name": "Strike", "kind": "descent", "motion": 0.94,
        "utility": "Swung at something. The top of the axis, because the motion is "
                   "the entire point of the object — a hammer is its swing.",
        "shares": "the descent engine, plus a pivot",
        "reserved": True,
    },
]

# object key -> (family, its own position on the axis, why it sits there)
PLACEMENTS = {
    "colour-sound": ("panel", 0.04,
                     "A painting. It is used by being looked at, so the only thing "
                     "that moves is which real colour is standing in for each step."),
    "amphora":      ("vessel", 0.14, "Holds oil or wine, and does it by not moving."),
    "scarab":       ("vessel", 0.20, "Worn — it travels, but only because its wearer does."),
    "column":       ("vessel", 0.10, "Bears a roof. Enormous purpose, almost no movement."),
    "waterfall":    ("descent", 0.58,
                     "Falls continuously. Higher than a leaf because the sheet never "
                     "stops or rests; it is the same motion at every instant."),
    "leaves":       ("descent", 0.66,
                     "Falls discretely, and each leaf yaws as it goes, so there is "
                     "more motion in it than in the sheet even though it is slower."),
}

FAMILY_BY_KEY = {f["key"]: f for f in FAMILIES}


def kin(object_key):
    """The other objects that share this one's machinery."""
    family = PLACEMENTS[object_key][0]
    return [k for k, v in PLACEMENTS.items() if v[0] == family and k != object_key]


# ------------------------------------------------------------- the colour kit
# Shared so that a family's members are matched against the collection the same
# way. Duplicating these was how the waterfall and the sprites drifted apart.

def hsl(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return h * 360, s, l


def load_colors(conn):
    """Every dominant colour in the collection, with the work it came from."""
    rows = conn.execute(
        """SELECT c.hex, c.r, c.g, c.b, c.artwork_id, a.title, a.artist_name
           FROM artwork_colors c JOIN artworks a ON a.id = c.artwork_id"""
    ).fetchall()
    out = []
    for hex_color, r, g, b, artwork_id, title, artist in rows:
        h, s, l = hsl(r, g, b)
        out.append({"hex": hex_color, "h": h, "s": s, "l": l, "rgb": (r, g, b),
                    "id": artwork_id, "title": title or "Untitled",
                    "artist": artist or "Unknown artist"})
    return out


def open_colors(db_path):
    conn = sqlite3.connect(db_path)
    try:
        return load_colors(conn)
    finally:
        conn.close()


def slot_cycle(colors, target, slot_min=20, slot_max=48, tol_start=10, tol_stop=56):
    """Real colours close enough to a ramp step that a whole flat region can be
    repainted with any of them without the shape appearing to change.

    Returned as a there-and-back sequence so the cycle never jumps at the wrap.
    """
    tol, near = tol_start, []
    while tol <= tol_stop:
        near = [c for c in colors
                if abs(c["rgb"][0] - target[0]) <= tol
                and abs(c["rgb"][1] - target[1]) <= tol
                and abs(c["rgb"][2] - target[2]) <= tol]
        if len(near) >= slot_min:
            break
        tol += 5
    if not near:
        near = sorted(colors, key=lambda c: sum((c["rgb"][i] - target[i]) ** 2
                                                for i in range(3)))[:slot_min]
    near.sort(key=lambda c: sum((c["rgb"][i] - target[i]) ** 2 for i in range(3)))
    near = near[:slot_max]
    return near[::2] + near[1::2][::-1], tol


class Pool:
    """A set of colours searchable by lightness, then by hue."""

    def __init__(self, colors):
        self.items = sorted(colors, key=lambda c: c["l"])
        self.keys = [c["l"] for c in self.items]

    def __len__(self):
        return len(self.items)

    def nearest(self, target, rng, spread=4, hue_ref=None):
        """Matching on lightness alone speckles: a wide band holds many hues at
        the same lightness, so neighbouring blocks land on unrelated colours.
        Preferring the band's hue keeps large soft areas reading as one
        atmosphere. Neutrals carry a discounted distance, because a true grey
        belongs in any light — but a warm grey still reads warm, and enough of
        them drag a blue scene tan.
        """
        if not self.items:
            return None
        i = bisect_left(self.keys, target)
        candidates = self.items[max(0, i - spread):min(len(self.items), i + spread + 1)]
        if not candidates:
            return None
        if hue_ref is None:
            return candidates[rng.randrange(len(candidates))]

        def hue_distance(c):
            d = abs(c["h"] - hue_ref) % 360
            d = min(d, 360 - d)
            weight = 1.0 if c["s"] >= 0.12 else max(0.12, c["s"] / 0.12)
            return d * weight

        candidates.sort(key=hue_distance)
        return candidates[rng.randrange(min(len(candidates), 3))]


def periodic_smooth(rng, length, octaves=(24, 8, 3), weights=(0.55, 0.3, 0.15)):
    """Value noise that wraps exactly, so a loop has no seam."""
    out = [0.0] * length
    for step, weight in zip(octaves, weights):
        n = max(2, length // step)
        pts = [rng.random() for _ in range(n)]
        for i in range(length):
            t = i / length * n
            a = int(math.floor(t)) % n
            b = (a + 1) % n
            f = t - math.floor(t)
            f = f * f * (3 - 2 * f)
            out[i] += weight * (pts[a] * (1 - f) + pts[b] * f)
    lo, hi = min(out), max(out)
    return [(v - lo) / (hi - lo) if hi > lo else 0.5 for v in out]


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a) if b != a else 0.0))
    return t * t * (3 - 2 * t)
