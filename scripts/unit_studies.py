#!/usr/bin/env python3
"""The base unit's studies, made things to stand in a row beside the tree you wake under in Holographic Mr Pearl
(artist, 21 Oct 2026: "Regarding the unit studies, I want those units [studies] to be placed in holographic Mr.
[Pearl] right next to the tree lined up next to each other").

Each is its study's own result (the studies of 15-16 Oct 2026: their notes and checks are kept with the game's work in
progress), built from the figure the homage's first figure is (homage.json `one`: the lattice's nine beams, the game's
block seen down its diagonal), in the homage's form (homage.js: a mesh in cells of the lattice, z up, each vertex's
tone as weights of the drawing's grey, black and white; the eye it closes for and the drawing's up):

  crux    ARNELL 1 (BREATHTAKING, p. 6, tangent circles): the figure at levels 2, 3 and 4 (scaled F(m+4)/8 about the
          drawing's middle) moved up the drawing by R4 - Rm, so that their holding circles, radius Rm = F(m+4) u / sqrt3,
          all touch at the one point the figure closes from, the crux, and so do their apexes from the stone; the
          rings with them. Each is moved as far toward the eye as it is moved up, so the smaller stand in front.
  ladder  the Fibonacci ladder (wf6/levels): a level-4 frame holding three level-3 frames at its corners, each holding
          three leaves (the drawing, level 2), and in every opening the frame four levels down, upside down (-I):
          13 copies. Children at ab + sigma F(m+2)/3 TRI_k; each corner step tilts its copy along (1, 1, 1) by
          kappa ((a, b) - the parent's) . v_k, the drawing's own cyclic order (A over B over C over A), which never
          changes the drawing.
  curve   V3 (wf6/reconstruct): the nine beams, each slid back along the line of sight by a third in the third of its
          length that nothing in the drawing covers, on an arc, a straight run and an arc of stated circles
          (tan(theta/2) = sqrt2, the straight run 1/3): the closed curved form, closed for real.
  sphere  the solids' first sphere (wf6/solids): every block whose middle lies within F(4) = 3 of its middle, 136
          blocks of the place in six layers; the pearl he throws is the same sphere at his cells.

    python3 scripts/unit_studies.py        # writes docs/worlds/rocket/studies.json

Needs numpy.
"""
import json
import math
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROCKET = os.path.join(HERE, "..", "docs", "worlds", "rocket")
SQ2, SQ3, SQ6 = math.sqrt(2), math.sqrt(3), math.sqrt(6)
EYE = np.array([1, 1, 1]) / SQ3              # the drawing's eye (homage.json one)
UP = np.array([0, -1, 1]) / SQ2              # its up
RIGHT = np.array([-2, 1, 1]) / SQ6           # its right
M3 = np.ones(3)
CENTRE = np.array([1 / 3, 1, -1 / 3])        # the drawing's middle (its circumcentre) in the figure's axes
L = math.sqrt(2 / 3)                         # a lattice cell's edge as drawn
U = L / 3                                    # u: a third of it
TRI = {"A": (0.0, SQ2 / 3), "B": (L / 2, -SQ2 / 6), "C": (-L / 2, -SQ2 / 6)}
V = {"A": (1.0, 0.0), "B": (-0.5, -SQ3 / 2), "C": (-0.5, SQ3 / 2)}
KAPPA = 1 / (3 * L)


def F(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


def ab(p):
    q = np.asarray(p, float) - CENTRE
    return np.array([q @ RIGHT, q @ UP])


class Mesh:
    def __init__(self):
        self.P, self.W, self.T = [], [], []

    def quad(self, ring, w):
        n = len(self.P)
        for p in ring:
            self.P.append([float(c) for c in p]); self.W.append(list(w))
        self.T += [n, n + 1, n + 2, n, n + 2, n + 3]

    def box(self, corners):
        """corners[4 bx + 2 by + bz] (a box, or a box sheared); each face pair toned by its axis"""
        for k in range(3):
            i, j = (k + 1) % 3, (k + 2) % 3
            for side in (0, 1):
                ring = []
                for bi, bj in ((0, 0), (1, 0), (1, 1), (0, 1)):
                    bits = [0, 0, 0]; bits[k], bits[i], bits[j] = side, bi, bj
                    ring.append(corners[4 * bits[0] + 2 * bits[1] + bits[2]])
                w = [0, 0, 0]; w[k] = 1
                self.quad(ring, w)

    def out(self, **extra):
        d = {"v": [round(c * 1000) for p in self.P for c in p], "w": [round(c * 255) for p in self.W for c in p], "t": self.T}
        d.update(extra)
        return d


def corners(b):
    return [np.array([b[3 * (q >> 2 & 1)], b[1 + 3 * (q >> 1 & 1)], b[2 + 3 * (q & 1)]], float) for q in range(8)]


def crux(leaf):
    m = Mesh()
    for lv in (2, 3, 4):
        s, R = F(lv + 4) / 8, F(lv + 4) * U / SQ3
        move = (F(8) * U / SQ3 - R) * (UP + EYE)
        for b in leaf:
            m.box([s * (c - CENTRE) + CENTRE + move for c in corners(b)])
        # its holding circle: a thin square band in the drawing's plane, round the figure's middle
        c0, tw, N = CENTRE + move, 0.025, 96
        for q in range(N):
            ring = []
            for a in (q / N * 2 * math.pi, (q + 1) / N * 2 * math.pi):
                d = math.cos(a) * RIGHT + math.sin(a) * UP
                ring.append([c0 + d * (R - tw), c0 + d * (R + tw)])
            m.quad([ring[0][0], ring[0][1], ring[1][1], ring[1][0]], (0, 0, 1))
    return m


def ladder(leaf, top=4):
    m = Mesh()

    def place(lv, at, sig, tilts, scale=None):
        if lv <= 2 or scale is not None:
            s = scale if scale is not None else F(lv + 4) / 8
            for b in leaf:
                cs = []
                for c in corners(b):
                    p = sig * s * (c - CENTRE) + CENTRE + at[0] * RIGHT + at[1] * UP
                    depth = sum(KAPPA * ((ab(p) - pa) @ np.array(v)) for pa, v in tilts)
                    cs.append(p + depth * M3)
                m.box(cs)
            return
        for k in "ABC":
            t = np.array(TRI[k]) * F(lv + 2) / 3 * sig
            place(lv - 1, at + t, sig, tilts + [(at, V[k])])
        place(lv - 4, at, -sig, tilts, scale=F(lv) / 8)   # the opening: the frame four down, point-reflected

    place(top, np.zeros(2), 1, [])
    return m


# ---- V3 (wf6/reconstruct geom.py, the 'arcs' profile, n = 48: its bends in 16 slices an arc) ----------------------------------------------------
H = 1 / 9
THETA, RHO, LSTR = math.acos(-1 / 3), SQ2 / 24, 1 / 3
BEAMS = [("Ay", 1), ("By", 1), ("Bx", 0), ("Cx", 0), ("Cz", 2), ("Az", 2), ("Ax", 0), ("Cy", 1), ("Bz", 2)]


def arcs():
    n1 = 20001 // 3
    ph = np.linspace(0, THETA, n1)
    a1, l1 = RHO * np.sin(ph), RHO * (1 - np.cos(ph))
    tt = np.linspace(0, 1, n1)[1:]
    a2, l2 = a1[-1] + LSTR * math.cos(THETA) * tt, l1[-1] + LSTR * math.sin(THETA) * tt
    a3, l3 = -a1[::-1][1:], SQ2 / 3 - l1[::-1][1:]
    a, l = np.concatenate([a1, a2, a3]), np.concatenate([l1, l2, l3])
    Y = l / SQ2
    return (a + Y) * 3, Y * 3


def curve(n=48):
    AX, AY = arcs()
    E = np.eye(3)
    Q0 = np.zeros(3); J0 = E[1] - M3 / 3; Q1 = 2 * E[1] - 2 * M3 / 3; J1 = Q1 + E[0] - M3 / 3
    Q2 = J1 + E[0] - M3 / 3; J2 = Q2 + E[2] - M3 / 3
    start = {"Ay": Q0, "By": J0, "Bx": Q1, "Cx": J1, "Cz": Q2, "Az": J2, "Ax": J0, "Cy": J2, "Bz": J1}
    s, s0, s1 = 1 / 3, 3 * H, 1 - 3 * H
    m = Mesh()
    for nm, k in BEAMS:
        P, (i, j) = start[nm], ((k + 1) % 3, (k + 2) % 3)

        def ring(sig=None, t=None, shift=0.0):
            out = {}
            for a in (-H, H):
                for b in (-H, H):
                    tt = sig + (a + b) / 2 if sig is not None else t
                    out[(a, b)] = P + tt * E[k] + a * E[i] + b * E[j] - shift * M3
            return out

        sig = np.linspace(s0, s1, n + 1)
        f = np.interp((sig - s0) / (s1 - s0), AX, AY)
        rings = [ring(t=-H)] + [ring(sig=sig[q], shift=s * f[q]) for q in range(n + 1)] + [ring(t=1 + H, shift=s)]
        # the four sides of each length between two rings (toned by the axis they face across), and the two ends
        for q in range(len(rings) - 1):
            r0, r1 = rings[q], rings[q + 1]
            for ax, sides in ((i, [((-H, -H), (-H, H)), ((H, -H), (H, H))]), (j, [((-H, -H), (H, -H)), ((-H, H), (H, H))])):
                for c0, c1 in sides:
                    w = [0, 0, 0]; w[ax] = 1
                    m.quad([r0[c0], r0[c1], r1[c1], r1[c0]], w)
        w = [0, 0, 0]; w[k] = 1
        for r in (rings[0], rings[-1]):
            m.quad([r[(-H, -H)], r[(H, -H)], r[(H, H)], r[(-H, H)]], w)
    return m


def main():
    home = json.load(open(os.path.join(ROCKET, "homage.json")))
    leaf = home["one"]["boxes"]
    look = math.degrees(math.atan(1 / SQ2))      # 35.26: looked down on along the diagonal's slope, as the first
    view = {"eye": [round(c, 6) for c in EYE], "up": [round(c, 6) for c in UP], "look": round(look, 4)}
    # the ladder and the crux reach level 4: drawn with its frame the size of the drawing (the homage's first figure),
    # so a leaf is 8/21 of it (the homage's 0.55 m to a cell, homage.js SCALE, times F(6)/F(8))
    small = {"scale": round(0.55 * F(6) / F(8), 5)}
    sph = [[x, y, z] for y in range(6) for z in range(6) for x in range(6) if (x + .5 - 3) ** 2 + (y + .5 - 3) ** 2 + (z + .5 - 3) ** 2 <= 9]
    data = {
        "note": "The base unit's studies in a row beside the tree (scripts/unit_studies.py): meshes in cells of the "
                "lattice as homage.json's (v x1000, w x255, t), each with the eye it closes for; the sphere as blocks.",
        "studies": [
            dict(name="The ladder of levels", said="Each figure holds three of itself one size down at its corners and one "
                 "upside down, four sizes down, in its hole: lengths of 1, 2, 3, 5, 8 thirds of a block, then 2, 3, 5, 8, "
                 "13, then 3, 5, 8, 13, 21, each the sum of the two before. From this stone it is one drawing; walk round "
                 "it and its levels fan apart.", **view, **small, **ladder(leaf).out()),
            dict(name="The crux", said="The circles that hold the figure at three sizes, its outline 8, 13 and 21 thirds "
                 "of a block across, all touch at one point, the corner the drawing never draws: the crux. From this stone the three "
                 "figures meet there too; step off and they come apart.", **view, **small, **crux(leaf).out()),
            dict(name="The closed curve", said="Nine bars, each bent back a third of the way along your line of sight, in "
                 "the third of its length that nothing else in the drawing covers, on arcs of stated circles: it closes "
                 "for real. From here it is the drawing; from anywhere else, a zigzag.", **view, **curve().out()),
            dict(name="The sphere of the unit", said="Every block whose middle lies within three of its middle: 136 of "
                 "them, in six layers of 12, 24, 32, 32, 24 and 12. It never becomes the perfect sphere, which is his "
                 "head alone; the pearl he throws is this same sphere, built small.", blocks=sph),
        ],
    }
    path = os.path.join(ROCKET, "studies.json")
    with open(path, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    for s in data["studies"]:
        print(s["name"], len(s.get("v", [])) // 3, "vertices", len(s.get("t", [])) // 3, "triangles", len(s.get("blocks", [])), "blocks")
    print(path, os.path.getsize(path), "bytes")


if __name__ == "__main__":
    main()
