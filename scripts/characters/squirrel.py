"""The red squirrel (Sciurus vulgaris), side on, facing right — after Henri Matisse.

DIRT's backlog paired Matisse with the grey squirrel; the red is the one of
his own country (DIRT's grammar: Palearctic broadleaf and conifer crowns,
"red squirrels"), and the one that crosses the crowns of the Nord, where he
was born. Matisse cut his late pictures out of painted paper (Jazz, 1947;
the Oceania panels, 1946): flat shapes, one colour each, laid edge to edge
with the ground showing between them. DIRT's roster gives him grammar 9, cut
shapes. So the squirrel is cut, not drawn: no outline, no shading, each part
one flat ink, and where one piece lies over another a gap of the ground
between them, as between two pieces of paper (raster's deep step is the
ground itself). His inks from the roster: the yellow of his saved works,
the same yellow worked toward the dark for the coat, their cream for the
belly, their dark for the ear tufts and the eye.

As a red squirrel is made: a small rounded body, a big bushy tail held up in
an S over the back, tufted ears, a white belly, long hind feet. It bounds
(four frames of the half-bound: gathered, pushing off, stretched in the air,
landing on the forefeet), sits up on its haunches to look, turns to you,
and sits with its tail curled up its back and its paws at its mouth.

Letters: R the coat; r the tail; w the belly; k the tufts, the eye and the
claws.
"""

import math

from draw import Part, capsule, ellipse, path, raster, triangle, union, unline

W, H = 40, 26
GROUND = 24.6
CELL = 2

COAT = lambda *a: "R"
TAIL = lambda *a: "r"
BELLY = lambda *a: "w"
DARK = lambda *a: "k"


def head(cx, cy, front=False):
    if front:
        skull = ellipse(cx, cy, 2.8, 2.6)
        ears = union(triangle((cx - 2.8, cy - 0.6), (cx - 0.2, cy - 1.8), (cx - 2.0, cy - 6.0)),
                     triangle((cx + 0.2, cy - 1.8), (cx + 2.8, cy - 0.6), (cx + 2.0, cy - 6.0)))
        eyes = union(ellipse(cx - 1.0, cy - 0.2, 0.45, 0.5), ellipse(cx + 1.0, cy - 0.2, 0.45, 0.5))
        return [Part(ears, lambda x, y, l, i, j: "k" if y < cy - 4.2 else "R", 3), Part(skull, COAT, 3), Part(ellipse(cx, cy + 1.4, 1.0, 0.8), BELLY, 7),
                Part(eyes, DARK, 8)]
    skull = union(ellipse(cx, cy, 2.9, 2.6), ellipse(cx + 2.0, cy + 0.7, 1.6, 1.4))
    ear = triangle((cx - 2.6, cy - 0.6), (cx + 0.6, cy - 1.8), (cx - 1.4, cy - 6.0))

    def paint(x, y, light, i, j):
        return "k" if y < cy - 4.2 else "R"
    return [Part(union(ear, skull), paint, 3), Part(ellipse(cx + 1.0, cy - 0.4, 0.55, 0.55), DARK, 8)]


def tail(points, r0=1.7, r1=2.5):
    return Part(path(points, r0, r1), TAIL, 1)


def bound(k):
    """The half-bound: 0 gathered, 1 pushing off, 2 stretched, 3 landing."""
    if k == 0:
        bd = [Part(union(ellipse(19.0, 18.4, 4.6, 3.8), ellipse(22.6, 18.0, 2.6, 2.6)), COAT, 3)]
        hind = [Part(ellipse(17.0, 20.2, 3.0, 2.8), COAT, 3), Part(capsule((17.6, 23.4), (22.0, 24.0), 0.8, 0.6), COAT, 3)]
        fore = [Part(capsule((23.0, 20.0), (22.4, 24.0), 0.7, 0.6), COAT, 3)]
        t = tail([(14.6, 18.4), (10.4, 15.6), (10.6, 10.6), (14.2, 8.0)])
        h = head(25.6, 15.8)
    elif k == 1:
        bd = [Part(union(ellipse(20.0, 16.8, 5.6, 3.2, -0.25), ellipse(24.4, 15.2, 2.4, 2.2)), COAT, 3)]
        hind = [Part(ellipse(16.4, 18.4, 2.8, 2.6), COAT, 3), Part(capsule((15.4, 20.2), (11.8, 24.0), 0.9, 0.6), COAT, 3)]
        fore = [Part(capsule((25.0, 17.0), (28.6, 16.0), 0.7, 0.5), COAT, 3)]
        t = tail([(14.4, 16.0), (9.6, 15.2), (6.6, 11.8), (7.6, 8.2)])
        h = head(27.4, 13.0)
    elif k == 2:
        bd = [Part(union(ellipse(20.0, 15.4, 6.2, 2.8, -0.08), ellipse(25.0, 14.6, 2.4, 2.2)), COAT, 3)]
        hind = [Part(ellipse(15.6, 16.2, 2.6, 2.4), COAT, 3), Part(capsule((14.4, 17.4), (9.8, 19.2), 0.8, 0.6), COAT, 3)]
        fore = [Part(capsule((25.6, 16.0), (29.6, 18.4), 0.7, 0.5), COAT, 3)]
        t = tail([(13.6, 14.4), (8.4, 13.8), (5.0, 11.6), (4.2, 8.4)])
        h = head(28.0, 12.6)
    else:
        bd = [Part(union(ellipse(20.4, 16.6, 5.4, 3.2, 0.3), ellipse(24.6, 18.6, 2.4, 2.4)), COAT, 3)]
        hind = [Part(ellipse(16.0, 15.6, 2.6, 2.4), COAT, 3), Part(capsule((15.4, 16.6), (12.6, 18.4), 0.8, 0.6), COAT, 3)]
        fore = [Part(capsule((25.4, 20.0), (26.2, 24.0), 0.7, 0.6), COAT, 3)]
        t = tail([(14.0, 14.6), (10.0, 12.6), (9.0, 8.4), (11.6, 5.6)])
        h = head(27.2, 15.6)
    belly = Part(ellipse(21.6, (18.6 if k == 0 else 17.2), 2.6, 1.2), BELLY, 3.5)
    parts = [t] + fore + bd + [belly] + hind + h
    return unline(raster(parts, W, H, deep="."))


def upright(front=False, eating=False):
    """Sitting up on its haunches; eating, the paws at its mouth and the tail
    curled up its back."""
    body = union(ellipse(20.6, 18.0, 3.4, 5.0, 0.15), ellipse(19.4, 21.6, 3.8, 3.0))
    belly = ellipse(22.4, 18.4, 1.2, 3.4, 0.15)
    foot = capsule((18.6, GROUND - 0.6), (23.4, GROUND - 0.5), 0.8, 0.6)
    if eating:
        t = path([(16.6, 22.0), (13.4, 18.8), (14.0, 12.4), (17.4, 9.6), (19.2, 11.6)], 1.6, 2.2)
        paws = capsule((22.0, 15.6), (23.8, 12.8), 0.7, 0.6)
    else:
        t = path([(16.6, 22.0), (12.4, 19.6), (11.4, 13.6), (14.0, 9.6)], 1.7, 2.5)
        paws = capsule((22.4, 16.2), (23.4, 18.0), 0.6, 0.5)
    parts = [Part(t, TAIL, 1), Part(body, COAT, 3), Part(belly, BELLY, 4), Part(foot, COAT, 3), Part(paws, COAT, 3)]
    parts += head(22.0, 11.0, front=front) if front else head(22.4, 11.4)
    return unline(raster(parts, W, H, deep="."))


def stand():
    bd = [Part(union(ellipse(19.6, 18.6, 4.8, 3.4), ellipse(23.0, 18.0, 2.4, 2.6)), COAT, 3)]
    hind = [Part(ellipse(17.0, 20.0, 2.8, 2.6), COAT, 3), Part(capsule((17.2, 23.6), (21.0, 24.0), 0.8, 0.6), COAT, 3)]
    fore = [Part(capsule((23.6, 20.2), (24.0, 24.0), 0.7, 0.6), COAT, 3)]
    t = tail([(14.8, 18.8), (10.8, 16.0), (10.8, 10.8), (14.4, 7.6)])
    parts = [t] + fore + bd + [Part(ellipse(21.4, 20.2, 2.4, 1.0), BELLY, 3.5)] + hind + head(25.8, 15.4)
    return unline(raster(parts, W, H, deep="."))


def poses():
    return {
        "trot": [bound(k) for k in range(4)],
        "stand": [stand()],
        "back": [upright()],
        "look": [upright(front=True)],
        "sit": [upright(eating=True)],
    }


INKS = {"coat": ["#a5641e", "#c7792a", "#eec027", "#eec027"], "white": ["#e5ddc9", "#e5ddc9"],
        "black": ["#3f3134", "#51414a"], "eye": "#3f3134", "pen": ["#e5ddc9", "#e5ddc9"], "box": "#eec027"}
