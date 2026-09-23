"""The colours and surfaces the theatre is made of.

Every ramp runs dark to light and was picked by hand toward the reference
sheet: deep, saturated cloth; cool stone; warm skin; gold that goes almost
white at the top. The earth is not a ramp at all but DIRT itself — the
collection soil the globe's land wears — read cell by cell off
docs/v2/dirt-land.png, so every scene stands on a clod of the same ground.
"""

from pathlib import Path

import numpy as np
from PIL import Image

from engine import Material, fbm, noise3, cellhash, hexes

ROOT = Path(__file__).resolve().parents[2]

_dirt = np.asarray(Image.open(ROOT / "docs" / "v2" / "dirt-land.png").convert("RGBA")).astype(np.float64)
_sea = np.asarray(Image.open(ROOT / "docs" / "v2" / "dirt-sea.png").convert("RGBA")).astype(np.float64)
GAP = np.array([38, 26, 20], float)          # the dark between DIRT's clods
SEA_GAP = np.array([14, 30, 44], float)


def _triplanar(p, n, cell):
    a = np.abs(n)
    top = (a[:, 2] >= a[:, 0]) & (a[:, 2] >= a[:, 1])
    side_x = (~top) & (a[:, 0] >= a[:, 1])
    u = np.where(top, p[:, 0], np.where(side_x, p[:, 1], p[:, 0]))
    v = np.where(top, p[:, 1], -p[:, 2] * 1.2)
    return (np.floor(u / cell).astype(int) % 256, np.floor(v / cell).astype(int) % 256)


def dirt_colour(tile, gap, cell=1.0, lift=0.0):
    def colour(p, n, frame, i, k):
        u, v = _triplanar(p, n, cell)
        c = tile[v, u]
        dot = c[:, 3] > 0
        rgb = np.where(dot[:, None], c[:, :3], gap)
        f = 0.50 + 0.62 * (i / max(k - 1, 1)) + lift
        return np.clip(rgb * f[:, None], 0, 255)
    return colour


# ---- surfaces -----------------------------------------------------------------------------------

def bricks(w=4.0, h=2.2, mortar=0.22, jitter=0.10, seed=1):
    """Coursed stone: the mortar drawn a step darker, each block a little different."""
    def tex(p, n, frame):
        a = np.abs(n)
        top = a[:, 2] > 0.7
        along = np.where(a[:, 0] > a[:, 1], p[:, 1], p[:, 0])
        z = p[:, 2]
        row = np.floor(z / h)
        off = (row % 2) * w * 0.5
        col = np.floor((along + off) / w)
        fz = z / h - row
        fx = (along + off) / w - col
        line = (fz < 0.18) | (fx < 0.12)
        # Flags on the top faces, bigger.
        tr = np.floor(p[:, 1] / (w * 1.3))
        tc = np.floor((p[:, 0] + (tr % 2) * w * 0.6) / (w * 1.3))
        tline = ((p[:, 1] / (w * 1.3) - tr) < 0.12) | (((p[:, 0] + (tr % 2) * w * 0.6) / (w * 1.3) - tc) < 0.10)
        var = (cellhash(col, row, 0, seed) - 0.5) * 2 * jitter
        tvar = (cellhash(tc, tr, 7, seed) - 0.5) * 2 * jitter
        out = np.where(top, np.where(tline, -mortar, tvar), np.where(line, -mortar, var))
        return out
    return tex


def flags(size=6.0, mortar=0.3, jitter=0.12, seed=4):
    """Paving: big flags on the top faces, coursed blocks on the sides."""
    side = bricks(size * 0.7, 2.4, mortar, jitter, seed)

    def tex(p, n, frame):
        top = np.abs(n[:, 2]) > 0.7
        r = np.floor(p[:, 1] / size)
        sx = p[:, 0] + (r % 2) * size * 0.5
        c = np.floor(sx / size)
        fr = p[:, 1] / size - r
        fc = sx / size - c
        line = (fr < 0.14) | (fc < 0.1)
        var = (cellhash(c, r, 3, seed) - 0.5) * 2 * jitter
        return np.where(top, np.where(line, -mortar, var), side(p, n, frame))
    return tex


def tiles_roof(seed=19):
    """Roof tiles: courses running across, each tile a little lit at its lower lip."""
    def tex(p, n, frame):
        row = np.floor(p[:, 2] / 1.6)
        along = p[:, 0] + p[:, 1]
        col = np.floor((along + (row % 2) * 1.2) / 2.4)
        fz = p[:, 2] / 1.6 - row
        return np.where(fz < 0.25, -0.28, (fz - 0.6) * 0.25) + (cellhash(col, row, 0, seed) - 0.5) * 0.12
    return tex


def spotted(seed=21):
    """A toadstool's cap: red on its ramp, white where the spots are."""
    red = hexes("#3a0608", "#700e12", "#a81c20", "#d8382e", "#f06a4a")
    white = hexes("#8a8078", "#c8c0b4", "#efe8de", "#fffaf2", "#ffffff")

    def colour(p, n, frame, i, k):
        c = cellhash(np.floor(p[:, 0] / 1.9), np.floor(p[:, 1] / 1.9), np.floor(p[:, 2] / 1.9), seed)
        return np.where((c > 0.8)[:, None], white[i], red[i])
    return colour


def spots(seed=21):
    def tex(p, n, frame):
        c = cellhash(np.floor(p[:, 0] / 1.9), np.floor(p[:, 1] / 1.9), np.floor(p[:, 2] / 1.9), seed)
        return np.where(c > 0.78, 3.0, 0.0)
    return tex


def speckle(amount=0.12, scale=1.4, seed=3, pips=0.0):
    def tex(p, n, frame):
        t = (fbm(p, scale * 3, seed) - 0.5) * 2 * amount
        if pips:
            t = t + np.where(cellhash(np.floor(p[:, 0] * 1.4), np.floor(p[:, 1] * 1.4), np.floor(p[:, 2] * 1.4), seed) > 1 - pips, 0.25, 0)
        return t
    return tex


def grass(seed=5):
    def tex(p, n, frame):
        blade = cellhash(np.floor(p[:, 0] * 1.3), np.floor(p[:, 1] * 1.3), 0, seed)
        tuft = (fbm(p, 6.0, seed) - 0.5) * 0.35
        return tuft + np.where(blade > 0.86, 0.22, np.where(blade < 0.10, -0.18, 0))
    return tex


def planks(w=2.6, seed=9):
    def tex(p, n, frame):
        a = np.abs(n)
        along = np.where(a[:, 2] > 0.7, p[:, 0], np.where(a[:, 0] > a[:, 1], p[:, 1], p[:, 0]))
        across = np.where(a[:, 2] > 0.7, p[:, 1], p[:, 2])
        row = np.floor(across / w)
        line = (across / w - row) < 0.16
        grain = (noise3(np.stack([along * 0.25, row * 9.1, row], 1), 1.0, seed) - 0.5) * 0.25
        return np.where(line, -0.3, grain)
    return tex


def water(seed=11, speed=1.0):
    def tex(p, n, frame):
        ph = frame * 0.8 * speed
        wave = np.sin(p[:, 0] * 0.55 + p[:, 1] * 0.25 + ph) * 0.5 + np.sin(p[:, 1] * 0.7 - p[:, 0] * 0.2 - ph * 1.3) * 0.5
        glint = cellhash(np.floor(p[:, 0] * 0.8 + frame * 3), np.floor(p[:, 1] * 0.8), frame, seed) > 0.975
        return wave * 0.14 + np.where(glint, 0.45, 0)
    return tex


def folds(depth=0.16, every=2.4):
    """Cloth: soft vertical folds that catch the light on their ridges."""
    def tex(p, n, frame):
        ang = np.arctan2(p[:, 1] - np.round(p[:, 1] / 50) * 50, p[:, 0] - np.round(p[:, 0] / 50) * 50)
        s = np.sin((p[:, 0] + p[:, 1]) / every * 1.3)
        return s * depth
    return tex


def ermine(seed=13):
    def tex(p, n, frame):
        spot = cellhash(np.floor(p[:, 0] / 1.6), np.floor(p[:, 1] / 1.6), np.floor(p[:, 2] / 1.6), seed) > 0.8
        return np.where(spot, -2.0, 0.1)
    return tex


def flicker(seed=17, amt=0.18):
    def tex(p, n, frame):
        return (cellhash(np.floor(p[:, 2] * 2), frame, 0, seed) - 0.5) * amt
    return tex


# ---- the palette ------------------------------------------------------------------------------

def build():
    M = {}

    def add(name, mat):
        M[name] = mat
        return mat

    # The ground.
    add("dirt", Material(["#20140e", "#3a2518", "#5a3a22", "#7a5230", "#9c6c3f"],
                         colour=dirt_colour(_dirt, GAP)))
    add("dirt_top", Material(["#20140e", "#3a2518", "#5a3a22", "#7a5230", "#9c6c3f"],
                             colour=dirt_colour(_dirt, GAP, lift=0.08)))
    add("sea", Material(["#0a1a28", "#12304a", "#1b4b6c", "#2a6f92", "#4a9fbe"],
                        colour=dirt_colour(_sea, SEA_GAP, lift=0.05)))
    add("grass", Material(["#1b2f1c", "#28462a", "#3d6832", "#5d8a3c", "#8ab052", "#b8d078"], tex=grass()))
    add("moss", Material(["#1c2b1a", "#2d4427", "#446235", "#648443"], tex=speckle(0.15, 1.0, 21)))
    add("path", Material(["#3a2e28", "#5c4a3c", "#7d6752", "#a08a6c", "#c2ac8a"], tex=flags(6.0, 0.3, 0.12, 4)))
    add("flags_warm", Material(["#4a3a2c", "#6e5842", "#94785a", "#b89a76", "#d8be98"], tex=flags(5.2, 0.28, 0.12, 14)))
    add("heath", Material(["#1e1414", "#34222a", "#4a3238", "#664648", "#86605a"], tex=speckle(0.2, 0.9, 61, 0.05)))
    add("terracotta", Material(["#3a140a", "#6a2612", "#9a3c1c", "#c45a2a", "#e0844a"], tex=tiles_roof()))
    add("plaster", Material(["#5a4e40", "#8c7c66", "#b8a68a", "#dccaaa", "#f2e4c8"], tex=speckle(0.07, 1.6, 63)))
    add("wing", Material(["#5a7aa8", "#8cb0d8", "#c0dcf2", "#e8f6ff", "#ffffff"], rim=0.4))
    add("toadstool", Material(["#3a0608", "#700e12", "#a81c20", "#d8382e", "#f06a4a"], colour=spotted()))
    add("stem", Material(["#6a6252", "#a09880", "#cfc6aa", "#efe8d2"]))
    add("purple_trim", Material(["#1a0620", "#34103e", "#541c64", "#7a2e8a", "#a054b0"]))
    add("marble_floor", Material(["#4e4a52", "#716c76", "#948e98", "#b6b0b8", "#d2ccd2", "#e8e2e6"], tex=flags(7.0, 0.3, 0.08, 71)))
    add("thatch", Material(["#3a2a10", "#5e4418", "#86642a", "#aa8840", "#ccaa5a"], tex=speckle(0.2, 0.6, 73, 0.06)))
    add("blood", Material(["#2a0204", "#4e060a", "#7a0c12", "#a41a1c"]))
    add("rock", Material(["#1e1c22", "#34323b", "#4d4a55", "#6a6772", "#8e8b95"], tex=speckle(0.16, 1.2, 23, 0.03)))

    # Stone and building.
    add("stone", Material(["#23232e", "#3a3a4a", "#565768", "#77788a", "#9c9dad", "#c4c4cf"], tex=bricks()))
    add("stone_warm", Material(["#2e2622", "#4a3e36", "#6c5c4e", "#8f7c68", "#b5a088", "#d8c6aa"], tex=bricks(4.2, 2.3, 0.2, 0.09, 6)))
    add("marble", Material(["#57535e", "#7f7b88", "#a4a0ac", "#c4c0ca", "#dcd9e2", "#eeecf2"], tex=speckle(0.06, 2.0, 25)))
    add("slate", Material(["#1a1b24", "#2a2c3a", "#3d4052", "#565a6e", "#747990"], tex=bricks(2.2, 1.4, 0.25, 0.06, 8)))
    add("wood", Material(["#24130b", "#3e2214", "#5c341d", "#7d4a28", "#a06636", "#c08448"], tex=planks()))
    add("wood_dark", Material(["#170c07", "#29160d", "#3f2415", "#58341f", "#744629"], tex=planks(2.0, 12)))
    add("iron", Material(["#101116", "#1f2029", "#34363f", "#51535e", "#7a7d88"], spec=0.6))
    add("gold", Material(["#3a2308", "#6e4610", "#a86f18", "#d9a22a", "#f4d25a", "#fff4b0"], spec=0.9))
    add("steel", Material(["#2a2e38", "#4a5060", "#727a8c", "#a2aaba", "#d6dce6", "#ffffff"], spec=1.1))
    add("water", Material(["#08182a", "#0e2c48", "#154868", "#1f6a8a", "#3a93ac", "#7cc8d2"], tex=water()))
    add("storm_sea", Material(["#050d18", "#0b1c30", "#123050", "#1c4a6c", "#2e6c8a", "#8fc2cc"], tex=water(31, 1.8)))
    add("foam", Material(["#5d7888", "#8eaab6", "#c4dae0", "#eef8fa", "#ffffff"], tex=speckle(0.2, 0.8, 33)))
    add("leaf", Material(["#10200f", "#1b3419", "#2a4d24", "#3d6a2e", "#5a8a3a", "#86ae4e"], tex=speckle(0.22, 0.9, 35, 0.05)))
    add("ivy", Material(["#0f1d10", "#1a311a", "#2a4a25", "#406a30", "#5e8c3c"], tex=speckle(0.25, 0.7, 37, 0.06)))
    add("flower_red", Material(["#4a0f14", "#8a1c22", "#c8323a", "#ee6a5a"]))
    add("flower_white", Material(["#8c8a96", "#c8c6d4", "#f2f0f8", "#ffffff"]))
    add("lily", Material(["#6a3a5a", "#b06a90", "#e8a8c4", "#fbe0ec"]))

    # Light that makes its own.
    add("flame", Material(["#8a2a08", "#e0620e", "#ff9a1e", "#ffd24a", "#fff6c0"], glow=True, tex=flicker()))
    add("candle", Material(["#6a5a48", "#a89880", "#d8ccb4", "#f4ecd8"]))
    add("window", Material(["#6a3a08", "#c87a18", "#f4b33a", "#ffe07a"], glow=True, tex=flicker(41, 0.1)))
    add("moon", Material(["#8a93b0", "#c2c8dc", "#e8ecf6", "#ffffff"], glow=True))
    add("glow_green", Material(["#1a4a14", "#3a8a1c", "#7ad030", "#c4f46a", "#f0ffc0"], glow=True, tex=flicker(43, 0.3)))
    add("ghost", Material(["#1e3462", "#34588e", "#5a86c0", "#92bce6", "#cfe6fa", "#ffffff"], rim=0.35, spec=0.5))
    add("magic", Material(["#3a2a8a", "#6a50d0", "#a08aff", "#e0d8ff"], glow=True, tex=flicker(47, 0.25)))
    add("lightning", Material(["#b0c8ff", "#e0ecff", "#ffffff"], glow=True))

    # People.
    add("skin", Material(["#4a261a", "#80472e", "#b87050", "#e09e76", "#f6c6a0", "#ffe2c8"]))
    add("skin_pale", Material(["#5a3a36", "#8e6660", "#c49a90", "#e8c4b8", "#fbe4da"]))
    add("skin_old", Material(["#4a2c22", "#7a4e3c", "#a8765c", "#cf9e80", "#ecc6a6"]))
    add("skin_green", Material(["#1f2a16", "#34471f", "#526a2c", "#768f40", "#a0b85a"]))
    add("hair_brown", Material(["#1c0f08", "#34200f", "#553418", "#7a4e26", "#9c6a38"]))
    add("hair_black", Material(["#08070a", "#15131a", "#252230", "#3a3648"]))
    add("hair_blonde", Material(["#5a3a10", "#a07020", "#d4a63a", "#f0d270", "#fff0b0"]))
    add("hair_red", Material(["#3a0e06", "#6e1e0c", "#a83a16", "#d8622a", "#f0924a"]))
    add("hair_white", Material(["#6a6878", "#9c9aac", "#cac8d8", "#eceaf4", "#ffffff"]))
    add("hair_grey", Material(["#2a2a32", "#4a4a56", "#6e6e7c", "#9696a4", "#bebecb"]))
    add("eye", Material(["#0a0608", "#140c10"]))

    add("red", Material(["#2a060c", "#540c16", "#86141f", "#b4242a", "#dc4238", "#f47a5c"], tex=folds(0.12)))
    add("crimson", Material(["#240410", "#4a0a1e", "#7a1230", "#a81e40", "#d23a56", "#ee6e7a"], tex=folds(0.12)))
    add("royal", Material(["#070b2a", "#101c56", "#1c3290", "#2e4ec0", "#4c74e0", "#86a6f4"], tex=folds(0.12)))
    add("sky", Material(["#10244a", "#1c3f76", "#2e62a4", "#4a8cc8", "#7cb6e4", "#b8dcf6"], tex=folds(0.12)))
    add("black", Material(["#07060b", "#12101a", "#221e2e", "#363046", "#4e4862", "#706a8a"], tex=folds(0.12)))
    add("charcoal", Material(["#0e0c10", "#1c1920", "#2c2832", "#403a48", "#5a5264"], tex=folds(0.1)))
    add("white", Material(["#5a5870", "#8c8aa4", "#b8b6cc", "#dcdae8", "#f4f2fa", "#ffffff"], tex=folds(0.1)))
    add("cream", Material(["#5a4a36", "#8c7656", "#bca47c", "#e0cca4", "#f6e8c8", "#fffaec"], tex=folds(0.1)))
    add("green", Material(["#0a1a0e", "#14301a", "#1e4a26", "#2e6a34", "#488e48", "#78b468"], tex=folds(0.12)))
    add("moss_cloth", Material(["#1a1e0c", "#2e3616", "#465222", "#627234", "#84944a"], tex=folds(0.12)))
    add("brown", Material(["#1c0f08", "#34200f", "#553418", "#7a4e26", "#a06a38", "#c48c52"], tex=folds(0.12)))
    add("leather", Material(["#1a0c06", "#2e160a", "#4a2610", "#6a3a1a", "#8e5428"], tex=speckle(0.06, 1.0, 51)))
    add("purple", Material(["#14061e", "#2a0e3e", "#461a66", "#6a2e92", "#9454bc", "#c08ae0"], tex=folds(0.12)))
    add("orange", Material(["#3a1404", "#6e2808", "#a8440e", "#d8681a", "#f49a3a"], tex=folds(0.12)))
    add("yellow", Material(["#4a3206", "#8a5e0c", "#c49016", "#eec02a", "#fae070"], tex=folds(0.1)))
    add("teal", Material(["#041a1e", "#0a3238", "#124e56", "#1e727a", "#3a9aa0"], tex=folds(0.12)))
    add("toga", Material(["#6a6458", "#9e9686", "#cac2b0", "#ebe4d4", "#fffaf0"], tex=folds(0.14, 1.8)))
    add("fur", Material(["#6a6878", "#a8a6b8", "#e4e2ee", "#ffffff"], tex=ermine()))
    add("bone", Material(["#5a5446", "#8e8672", "#c0b89e", "#e6e0c8", "#fbf8ea"]))
    add("ass", Material(["#1e1814", "#3a2e26", "#5a4a3e", "#7e6a5a", "#a4907c"], tex=speckle(0.08, 1.0, 55)))
    add("sail", Material(["#7a6e58", "#aea084", "#d8ccac", "#f2eace", "#fffaec"], tex=folds(0.08, 3.0)))
    add("cloth_table", Material(["#6a6878", "#a4a2b4", "#d4d2e0", "#f4f2fa", "#ffffff"]))
    add("banner_red", Material(["#2a060c", "#5a0c16", "#8a1a22", "#b82e30", "#dc5a44"], tex=folds(0.1, 2.0)))
    add("banner_blue", Material(["#070b2a", "#101c56", "#1c3290", "#2e4ec0", "#4c74e0"], tex=folds(0.1, 2.0)))
    add("smoke", Material(["#2a3a2a", "#4a6a44", "#7ab060", "#b4e08a", "#e4ffc8"], glow=True, tex=flicker(57, 0.35)))
    add("mist", Material(["#4a5670", "#6e7c9a", "#9aa8c4", "#c6d0e6", "#e8eef8"]))

    names = list(M.keys())
    index = {k: i for i, k in enumerate(names)}
    return [M[k] for k in names], index


MATERIALS, MAT = build()
