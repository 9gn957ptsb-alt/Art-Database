"""The repertory: each scene a set on a clod of DIRT, its people, and its lines.

A scene is a function of (t, speaking): t runs 0..FRAMES-1 round a loop, and speaking
is the index of whoever has the line, or None between lines. Everything that moves —
a ghost rising and falling, mist, a cape in the wind, an arm raised on a line — is a
function of those two, so every frame is drawn from scratch.

The lines are Shakespeare's.
"""

import math

import numpy as np

from figure import (Figure, Extra, sword, dagger, skull, candle, staff, tankard, lantern, scroll, flowers, bauble,
                    wings, spade, nose, flower_crown, ladle)
from sets import (v, wall, merlons, rampart, tower, lit_window, arch_cut, rock, tree, steps, plane_water,
                  flagpole, gable, hcyl, glow_arch, ivy, bush, cypress, column, cauldron, barrel, headstone,
                  toadstool, log, ship, table, bench, torch)
from stage import (Scene, clod, clouds, disc, mist, glow, sky, rain, bolt, flash, sparks, ground_z, night, smoke)
from engine import Union, Cut, Rough, Moved, box, cylinder, cone, sphere, ellipsoid, capsule, torus, custom, fbm, _len
from palette import MAT

FRAMES = 4
TAU = math.pi * 2

NIGHT_CLOUD = ["#0a0d1e", "#121934", "#1c2650", "#28366a", "#384a86", "#5064a0"]
STORM_CLOUD = ["#0c0f18", "#161c2a", "#222a3e", "#323c54", "#48546e", "#66728c"]
MOON = ["#6e7898", "#a4acc8", "#d4d9ea", "#f2f4fb", "#ffffff"]


def yaw_to(frm, to, toward_camera=0.0):
    """The yaw that faces from one point to another, turned a little toward the viewer."""
    a = math.atan2(to[1] - frm[1], to[0] - frm[0])
    cam = math.pi / 4
    d = (cam - a + math.pi) % TAU - math.pi
    return a + d * toward_camera


# ---- Hamlet: the Ghost ----------------------------------------------------------------------------

def ghost(t, speaking):
    w, d = 100, 86
    phase = t / FRAMES * TAU
    parts = [clod(w, d, depth=23, seed=4, top="path", top_rough=1.0)]
    parts += rampart(4, 5, w - 6, 5, 0.5, 15, "stone", thick=5)
    parts += rampart(5, 4, 5, d - 8, 0.5, 15, "stone", thick=5)
    parts += tower((13, 13, 0), 12.5, 58, "stone", roof="slate", roof_h=28, crenel=False)
    parts += lit_window(13 + 12.5 * 0.72, 13 + 12.5 * 0.72, 40, on="y", w=2.6, h=5.0)
    parts += lit_window(13 + 12.3, 13, 24, on="x", w=2.6, h=5.0)
    parts += flagpole((13, 13, 85), 12, "banner_red", wave=phase)
    # The keep, square, on the far wall.
    parts.append(box(v(58, 1, 0), v(80, 18, 46), MAT["stone"]))
    parts += merlons(58, 17, 80, 17, 46, "stone", thick=2.4, w=3.0, gap=2.4, h=3.6)
    parts += merlons(80, 1, 80, 18, 46, "stone", thick=2.4, w=3.0, gap=2.4, h=3.6)
    for x in (63, 71):
        parts += lit_window(x + 2, 18.2, 28, on="y", w=2.6, h=5.2)
    parts += lit_window(80.2, 9, 34, on="x", w=2.6, h=5.2)
    parts.append(Cut(box(v(66, 16, 0), v(74, 19, 12), MAT["stone"]), box(v(67.5, 15, 0), v(72.5, 21, 9.5), 0)))
    parts.append(box(v(67.5, 17.5, 0), v(72.5, 18.5, 9.4), MAT["wood_dark"]))
    parts.append(rock((w - 4, d - 12, -3), 9, seed=3))
    parts.append(rock((18, d - 2, -4), 8, seed=5))
    parts.append(rock((w - 16, d + 1, -6), 6, seed=8))

    bob = math.sin(phase) * 1.4
    gpos = (36, 60, 3.5 + bob)
    hpos = (72, 44, 0.8)
    point = speaking == 1
    ghost_fig = Figure(at=gpos, yaw=yaw_to(gpos, hpos, 0.35),
                       skin="ghost", hair="ghost", beard="ghost", top="ghost", skirt="ghost", skirt_len=0.55,
                       legs="ghost", boots="ghost", cape="ghost", cape_len=1.0, cape_flare=1.8 + bob * 0.5,
                       crown="ghost", collar="ghost", breathe=bob * 0.3, belt="ghost",
                       arms={"right": {"up": (100 if point else 25, 8 if point else 12), "fore": (104 if point else 40, 6)},
                             "left": {"up": (10, 12), "fore": (25, 8)}})
    recoil = speaking == 0
    wind = 2.2 + math.sin(phase + 1) * 1.4
    hamlet = Figure(buttons="steel", cuffs="white", at=hpos, yaw=yaw_to(hpos, gpos, 0.45), skin="skin_pale", hair="hair_black", hair_style="short",
                    top="black", legs="black", boots="black", cape="black", cape_flare=wind, collar="white",
                    belt="black", breathe=math.sin(phase),
                    arms={"left": {"up": (120 if recoil else 60, 30), "fore": (150 if recoil else 95, 20)},
                          "right": {"up": (40 if recoil else 18, 18), "fore": (80 if recoil else 30, 10)}})

    def before(f, t):
        sky(f, NIGHT_CLOUD, top=0.0, bottom=0.66, width=0.98, seed=11, stars=0.012, puffs=10)
        disc(f, (96, -6, 104), 10, MOON)
        glow(f, [(96, -6, 104)], (200, 214, 255), radius=24, strength=0.45)

    def after(f, t):
        glow(f, [ghost_fig.world((0, 0, 30))], (150, 200, 255), radius=30, strength=0.6)
        mist(f, (50, 46, -8), 150, 30, t, seed=2, amount=0.85)

    return Scene("ghost", parts, {1: hamlet, 2: ghost_fig}, ghosts=(2,), night=0.72, before=before, after=after,
                 extent=[(-10, -20, 120, 6), (110, -10, 60, 6), (-20, 90, 40, 6), (50, 46, -16, 0)])


GHOST = {
    "key": "ghost",
    "play": "Hamlet",
    "title": "The Ghost",
    "where": "The battlements of Elsinore",
    "build": ghost,
    "cast": ["Hamlet", "Ghost"],
    "lines": [
        [0, "Angels and ministers of grace defend us!"],
        [1, "I am thy father's spirit, doom'd for a certain term to walk the night."],
        [1, "Remember me."],
        [0, "Remember thee? Ay, thou poor ghost."],
    ],
}



DUSK = ["#120a22", "#1e123a", "#2c1c52", "#3e2a68", "#56407e", "#745c96"]
DREAM = ["#120a24", "#1e1040", "#2c1a58", "#3c286e", "#523a84", "#6e549c"]
WITCH = ["#090c0a", "#111a14", "#1a281e", "#243828", "#334a36", "#46604a"]
MOON_RED = ["#5a1e1a", "#8e3a2a", "#c46a4a", "#e8a07a", "#f8d0b0"]


def at_ground(node, x, y, lift=0.0):
    return (x, y, ground_z(node, x, y) + lift)


# ---- Romeo and Juliet: the balcony ----------------------------------------------------------------

def balcony(t, speaking):
    w, d = 96, 82
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=22, seed=7, top="grass")
    parts = [ground]
    parts.append(box(v(4, 2, 0), v(w - 6, 14, 64), MAT["stone_warm"]))
    parts.append(gable(4, 2, w - 6, 14, 64, 9, "terracotta", ridge="x"))
    parts.append(box(v(2, 2, 0), v(14, d - 22, 46), MAT["stone_warm"]))
    parts.append(gable(2, 2, 14, d - 22, 46, 8, "terracotta", ridge="y"))
    # The balcony, carried on corbels, with its balustrade.
    parts.append(box(v(33, 14, 27.5), v(69, 31, 30.5), MAT["stone_warm"]))
    for x in (35, 45, 55, 65):
        parts.append(box(v(x, 14, 22), v(x + 2.4, 18, 27.5), MAT["stone_warm"]))
    for x in np.arange(34.2, 68.5, 2.6):
        parts.append(cylinder(v(x, 29.6, 30.5), 0.7, 4.4, MAT["stone_warm"]))
    for y in np.arange(16.5, 29.5, 2.6):
        parts.append(cylinder(v(33.9, y, 30.5), 0.7, 4.4, MAT["stone_warm"]))
        parts.append(cylinder(v(68.1, y, 30.5), 0.7, 4.4, MAT["stone_warm"]))
    parts.append(box(v(33, 29, 34.8), v(69, 31, 36.2), MAT["stone_warm"]))
    parts.append(box(v(33, 14, 34.8), v(34.8, 31, 36.2), MAT["stone_warm"]))
    parts.append(box(v(67.2, 14, 34.8), v(69, 31, 36.2), MAT["stone_warm"]))
    parts += glow_arch(58, 14, 30.5, 9, 15, on="y")
    parts += lit_window(14.2, 30, 24, on="x", w=3.0, h=5.5)
    parts += lit_window(14.2, 48, 24, on="x", w=3.0, h=5.5)
    parts += lit_window(24, 14.2, 40, on="y", w=3.0, h=5.5)
    parts += lit_window(78, 14.2, 40, on="y", w=3.0, h=5.5)
    parts += ivy(16, 38, 0, 42, 14, seed=3, n=34, flowers=5)
    parts += ivy(64, 70, 0, 30, 14, seed=4, n=12)
    parts += ivy(20, 40, 0, 20, 14, seed=5, n=10, face="x")
    parts.append(box(v(46, 27, 0.2), v(56, d - 4, 1.9), MAT["flags_warm"]))
    parts += bush((26, 36, 0.8), 5.5, seed=1, flowers=10)
    parts += bush((80, 34, 0.8), 5.0, seed=2, flowers=9)
    parts += bush((24, 66, 0.8), 4.5, seed=3, flowers=7)
    parts += cypress((88, 24, 0.5), 50, 6, seed=4)

    jpos = (44, 21, 30.6)
    rpos = at_ground(ground, 44, 66, -0.2)
    says = speaking == 1
    juliet = Figure(trim="gold", cuffs="gold", at=jpos, yaw=yaw_to(jpos, rpos, 0.5), skin="skin_pale", hair="hair_brown", hair_style="long",
                    top="white", skirt="white", skirt_len=1.0, skirt_flare=0.8, sleeves="sky", belt="gold",
                    breathe=math.sin(phase),
                    arms={"left": {"up": (115, 35), "fore": (140, 25)} if says else {"up": (35, 12), "fore": (85, 0)},
                          "right": {"up": (40, -5), "fore": (125, -45)} if says else {"up": (35, 12), "fore": (85, 0)}})
    reach = speaking == 0
    romeo = Figure(buttons="gold", cuffs="white", at=rpos, yaw=yaw_to(rpos, jpos, 0.3), skin="skin", hair="hair_brown", hair_style="curls",
                   top="royal", sleeves="royal", legs="royal", boots="leather", cape="red", cape_flare=1.2,
                   collar="white", belt="leather", breathe=math.sin(phase + 1),
                   arms={"right": {"up": (150, 18), "fore": (165, 10)} if reach else {"up": (120, 20), "fore": (140, 15)},
                         "left": {"up": (30, 20), "fore": (110, -30)}},
                   props=[sword("left", 11, angle=(160, 20))] if False else [])

    def before(f, t):
        sky(f, DUSK, top=0.0, bottom=0.6, width=0.96, seed=21, stars=0.01, puffs=8)
        disc(f, (98, -12, 104), 9, MOON)

    return Scene("balcony", parts, {1: romeo, 2: juliet}, night=0.5, before=before,
                 lights=[(58, 15, 38), (14.5, 30, 27), (14.5, 48, 27), (24, 14.5, 43), (78, 14.5, 43)],
                 extent=[(-6, -24, 118, 6), (110, -6, 70, 6), (-22, 84, 30, 6)])


# ---- Macbeth: the witches -------------------------------------------------------------------------

def witches(t, speaking):
    w, d = 88, 76
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=21, seed=9, top="heath")
    parts = [ground]
    parts.append(rock((12, 14, 0), 5, seed=1, squash=2.6, amp=1.2))
    parts.append(rock((30, 6, 0), 4.4, seed=2, squash=3.0, amp=1.2))
    parts.append(rock((6, 34, 0), 4.0, seed=3, squash=2.2, amp=1.2))
    parts.append(rock((76, 62, -2), 6, seed=4))
    parts += tree((72, 14, 0.5), 34, seed=7, dead=True)
    cpos = (50, 48, 0.6)
    parts += cauldron(cpos, 8.5, t=t)

    spots = [(28, 28, "charcoal", 1.2), (22, 64, "purple", 1.0), (70, 30, "moss_cloth", 1.3)]
    figs = {}
    for i, (x, y, cloak, hunch) in enumerate(spots):
        pos = at_ground(ground, x, y, -0.3)
        talk = speaking == i
        stir = i == 0
        arms = {"left": {"up": (70, 20), "fore": (110, 10)}, "right": {"up": (70, -10), "fore": (100, -20)}}
        if talk:
            arms = {"left": {"up": (130, 40), "fore": (160, 30)}, "right": {"up": (120, 30), "fore": (150, 20)}}
        stir_to = (cpos[0] + math.cos(phase) * 3, cpos[1] + math.sin(phase) * 3, 14)
        props = [ladle("right", stir_to)] if stir and not talk else []
        if i == 1:
            props.append(nose("skin_green"))
        figs[i + 1] = Figure(at=pos, yaw=yaw_to(pos, cpos, 0.35), skin="skin_green", hair="hair_grey",
                             hair_style="long", top=cloak, skirt=cloak, skirt_len=1.0, skirt_flare=1.1,
                             hood=cloak, stoop=hunch, arms=arms, props=props,
                             breathe=math.sin(phase + i * 2))

    def before(f, t):
        sky(f, WITCH, top=0.0, bottom=0.62, width=0.96, seed=31, stars=0.004, puffs=9)
        disc(f, (92, -8, 96), 9, MOON_RED)
        if t == 2:
            bolt(f, (f.alpha.shape[1] * 0.18, 8), (f.alpha.shape[1] * 0.24, f.alpha.shape[0] * 0.42), seed=3)

    def after(f, t):
        glow(f, [(cpos[0], cpos[1], 16)], (140, 230, 90), radius=40, strength=0.55)
        glow(f, [(cpos[0], cpos[1], 3)], (255, 170, 80), radius=18, strength=0.6)
        smoke(f, (cpos[0], cpos[1], 17), t, rise=70, puffs=7, width=12)
        mist(f, (44, 38, -6), 120, 22, t, colour=(150, 190, 140), seed=5, amount=0.6)

    return Scene("witches", parts, figs, night=0.62, before=before, after=after,
                 extent=[(-6, -24, 110, 6), (100, -10, 60, 6), (-22, 80, 30, 6)])


# ---- The Tempest: the storm -----------------------------------------------------------------------

def tempest(t, speaking):
    w, d = 104, 90
    phase = t / FRAMES * TAU
    base = clod(w, d, depth=21, seed=13, top=None, earth="sea")

    def sea_fn(p):
        x, y, z = p[:, 0], p[:, 1], p[:, 2]
        wave = (np.sin(x * 0.32 + y * 0.12 + phase) * 1.3 + np.sin(y * 0.4 - x * 0.1 - phase * 1.3) * 0.9 +
                np.sin((x + y) * 0.9 + phase * 2) * 0.35)
        q = np.abs(p[:, :2] - np.array([w / 2, d / 2])) - np.array([w / 2 - 1.5, d / 2 - 1.5])
        side = _len(np.maximum(q, 0)) + np.minimum(q.max(1), 0) + (fbm(p, 7, 3) - 0.5) * 2.4
        return np.maximum((z - 1.4 - wave) * 0.6, np.maximum(side, -z - 3))
    sea = custom(sea_fn, (-2, -2, -3), (w + 2, d + 2, 5), MAT["storm_sea"])
    parts = [base, sea]
    for k in range(9):
        a = k * 2.3 + t * 0.7
        fx, fy = 12 + (k * 37 % 80), 14 + (k * 53 % 66)
        parts.append(ellipsoid(v(fx + math.sin(a) * 2, fy, 2.2 + math.sin(fx * 0.32 + fy * 0.12 + phase) * 1.3),
                               v(3.2, 1.2, 0.7), MAT["foam"]))
    isle = Union([rock((22, 22, -2), 17, seed=6, squash=0.85, amp=2.2), rock((34, 12, -3), 10, seed=8, squash=0.7)])
    parts.append(isle)
    roll = 0.2 * math.sin(phase)
    parts.append(ship(v(70, 60, -1.0 + math.sin(phase + 1) * 0.8), yaw=-0.5, roll=roll, pitch=0.08 * math.cos(phase),
                      scale=1.4))

    ppos = (22, 22, ground_z(isle, 22, 22) - 0.4)
    conj = speaking == 0
    prospero = Figure(trim="gold", cuffs="gold", at=ppos, yaw=yaw_to(ppos, (70, 58), 0.35), skin="skin_old", hair="hair_white",
                      hair_style="long", beard="hair_white", beard_len=2.0, top="purple", skirt="purple",
                      skirt_len=1.0, skirt_flare=1.05, sleeves="purple", cape="royal", cape_flare=2.5 + math.sin(phase) * 1.5,
                      belt="gold", collar="gold",
                      arms={"right": {"up": (165 if conj else 120, 15), "fore": (175 if conj else 150, 10)},
                            "left": {"up": (110 if conj else 40, 40), "fore": (130 if conj else 90, 30)}},
                      props=[staff("right", "magic", 24)])
    ang = phase + 0.5
    apos = (58 + math.cos(ang) * 14, 40 + math.sin(ang) * 10, 24 + math.sin(phase * 2) * 3)
    ariel = Figure(at=apos, yaw=yaw_to(apos, ppos, 0.4), height=0.55, skin="ghost", hair="ghost", hair_style="long",
                   top="ghost", skirt="ghost", skirt_len=1.0, skirt_flare=0.8,
                   arms={"left": {"up": (140, 40), "fore": (160, 30)}, "right": {"up": (120, 40), "fore": (150, 30)}})
    arwings = wings(ariel, 9.0, math.sin(phase * 2))
    mariners = Extra([], anchor=(70, 60, 44))

    lightning = t in (1, 3)

    def before(f, t):
        sky(f, STORM_CLOUD, top=0.0, bottom=0.62, width=0.98, seed=41, puffs=12)
        if lightning:
            W = f.alpha.shape[1]
            bolt(f, (W * (0.72 if t == 1 else 0.3), 6), (W * (0.66 if t == 1 else 0.36), f.alpha.shape[0] * 0.45), seed=t)

    def after(f, t):
        rain(f, t, seed=4, amount=1.1)
        if lightning:
            flash(f, 0.16)
        glow(f, [prospero.light], (170, 150, 255), radius=22, strength=0.6)
        glow(f, [ariel.world((0, 0, 30))], (150, 200, 255), radius=16, strength=0.5)

    return Scene("tempest", parts, {1: prospero, 2: mariners, 3: ariel, 4: arwings}, ghosts=(3, 4), night=0.55,
                 before=before, after=after,
                 extent=[(-6, -24, 118, 6), (112, -10, 70, 6), (-22, 90, 30, 6)])


# ---- Hamlet: Yorick -------------------------------------------------------------------------------

def yorick(t, speaking):
    w, d = 94, 80
    phase = t / FRAMES * TAU
    ground = Cut(clod(w, d, depth=28, seed=12, top="grass"), box(v(38, 33, -20), v(56, 47, 6), 0))
    parts = [ground]
    parts.append(Rough(ellipsoid(v(30, 56, 0), v(8, 6, 4.5), MAT["dirt_top"]), 1.0, 2.0, 4))
    parts += ivy(8, 28, 0, 24, 9, seed=21, n=14)
    parts.append(Cut(box(v(6, 3, 0), v(62, 9, 30), MAT["stone"]),
                     Union([glow_hole for glow_hole in [box(v(26, 0, 12), v(34, 12, 24), 0)]])))
    parts.append(hcyl((30, 6, 24), 4, 4, "y", "stone"))
    parts.append(box(v(26.5, 5.5, 12), v(33.5, 6.5, 26), MAT["iron"]))
    parts.append(Rough(box(v(6, 3, 26), v(62, 9, 34), MAT["stone"]), 2.6, 5.0, 9))
    parts += tree((80, 16, 0.5), 30, crown=13, mat="ivy", seed=11)
    for (x, y, cross, hh) in ((14, 24, False, 8), (24, 20, True, 11), (12, 44, False, 7), (70, 26, True, 10),
                              (86, 64, False, 7), (62, 64, False, 8)):
        parts += headstone((x, y, 0.5), 5.0, hh, cross=cross)
    parts.append(Rough(box(v(36, 31, 0.3), v(58, 33.5, 1.8), MAT["dirt_top"]), 0.6, 1.5, 2))

    hpos = at_ground(ground, 22, 66, -0.3)
    gpos = (47, 40, -19.5)
    opos = at_ground(ground, 80, 42, -0.3)
    talk = speaking == 0
    hamlet = Figure(buttons="steel", cuffs="white", at=hpos, yaw=yaw_to(hpos, gpos, 0.55), skin="skin_pale", hair="hair_black",
                    top="black", legs="black", boots="black", cape="black", cape_flare=0.8, collar="white",
                    belt="black", breathe=math.sin(phase),
                    arms={"right": {"up": (95 if talk else 80, -10), "fore": (130 if talk else 110, -20)},
                          "left": {"up": (30, 20), "fore": (60, 10)} if not talk else {"up": (60, 40), "fore": (90, 40)}},
                    props=[skull("right", (1.6, 0, 1.4))])
    horatio = Figure(buttons="gold", at=opos, yaw=yaw_to(opos, hpos, 0.45), skin="skin", hair="hair_brown", beard="hair_brown",
                     beard_len=0.6, top="brown", legs="brown", boots="leather", cape="moss_cloth", collar="cream",
                     belt="leather", breathe=math.sin(phase + 2),
                     arms={"left": {"up": (60, 20), "fore": (95, -30)} if speaking == 1 else {"up": (15, 10), "fore": (30, 5)}})
    dig = speaking == 2
    digger = Figure(at=gpos, yaw=yaw_to(gpos, hpos, 0.5), skin="skin_old", hair="hair_grey", hair_style="bald",
                    beard="hair_grey", beard_len=0.8, top="leather", legs="brown", boots="leather",
                    sleeves="cream", breathe=math.sin(phase + 1),
                    arms={"right": {"up": (70 + 10 * math.sin(phase), -10), "fore": (110, -10)},
                          "left": {"up": (120 if dig else 60, 30), "fore": (150 if dig else 90, 20)}},
                    props=[spade("right")])

    return Scene("yorick", parts, {1: hamlet, 2: horatio, 3: digger},
                 extent=[(-10, 90, 20, 4), (100, -6, 30, 4)])


# ---- Romeo and Juliet: the quarrel ----------------------------------------------------------------

def quarrel(t, speaking):
    w, d = 96, 80
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=21, seed=17, top="flags_warm", top_rough=1.0)
    parts = [ground]
    parts.append(box(v(3, 2, 0), v(44, 14, 40), MAT["plaster"]))
    parts.append(gable(3, 2, 44, 14, 40, 8, "terracotta", ridge="x"))
    parts.append(box(v(52, 2, 0), v(92, 14, 34), MAT["stone_warm"]))
    parts.append(gable(52, 2, 92, 14, 34, 7, "terracotta", ridge="x"))
    parts.append(Cut(box(v(44, 4, 0), v(52, 12, 30), MAT["stone_warm"]), box(v(45.5, 0, 0), v(50.5, 16, 12), 0)))
    parts.append(hcyl((48, 8, 12), 2.5, 4.5, "y", "stone_warm"))
    parts.append(box(v(2, 2, 0), v(12, d - 24, 30), MAT["plaster"]))
    parts.append(gable(2, 2, 12, d - 24, 30, 6, "terracotta", ridge="y"))
    for x in (10, 22, 34):
        parts += lit_window(x, 14.2, 22, on="y", w=3.0, h=5.0, mat="wood_dark")
        parts.append(box(v(x - 3.4, 14, 21), v(x - 1.8, 15, 28), MAT["green"]))
        parts.append(box(v(x + 1.8, 14, 21), v(x + 3.4, 15, 28), MAT["green"]))
    for x in (60, 72, 84):
        parts += glow_arch(x, 14, 3, 5, 10, on="y", mat="wood_dark")
        parts += lit_window(x, 14.2, 20, on="y", w=2.6, h=4.6, mat="wood_dark")
    parts.append(box(v(56, 14, 14), v(92, 20, 14.8), MAT["red"]))            # an awning
    parts += [cylinder(v(48, 30, 0.5), 7, 4.0, MAT["stone_warm"]),
              cylinder(v(48, 30, 3.6), 5.8, 0.6, MAT["water"]),
              cylinder(v(48, 30, 0.5), 1.2, 11, MAT["stone_warm"]),
              cylinder(v(48, 30, 11), 3.0, 1.2, MAT["stone_warm"])]
    parts += cypress((90, 30, 0.5), 38, 5, seed=6)
    parts += barrel((20, 30, 0.5))

    tpos = at_ground(ground, 34, 58, -0.3)
    mpos = at_ground(ground, 62, 44, -0.3)
    lunge = math.sin(phase)
    tyb_talk, mer_talk = speaking == 0, speaking == 1
    tybalt = Figure(buttons="gold", cuffs="white", at=tpos, yaw=yaw_to(tpos, mpos, 0.35), skin="skin", hair="hair_black", beard="hair_black",
                    beard_len=0.4, top="black", sleeves="red", legs="black", boots="leather", cape="red",
                    cape_flare=1.4 + lunge, collar="white", belt="gold", stride=12 * lunge,
                    arms={"right": {"up": (100 + 12 * lunge, -12), "fore": (100 + 8 * lunge, -18)},
                          "left": {"up": (120 if tyb_talk else 70, 50), "fore": (150 if tyb_talk else 120, 40)}},
                    props=[sword("right", 16)])
    mercutio = Figure(buttons="gold", cuffs="white", at=mpos, yaw=yaw_to(mpos, tpos, 0.35), skin="skin", hair="hair_red", hair_style="curls",
                      top="yellow", sleeves="orange", legs="green", boots="leather", cape="green",
                      cape_flare=1.4 - lunge, collar="white", belt="leather", stride=-12 * lunge,
                      arms={"right": {"up": (95 - 12 * lunge, -12), "fore": (105 - 8 * lunge, -12)},
                            "left": {"up": (140 if mer_talk else 80, 45), "fore": (160 if mer_talk else 120, 35)}},
                      props=[sword("right", 16)])

    return Scene("quarrel", parts, {1: tybalt, 2: mercutio}, extent=[(-10, 84, 24, 4), (100, -6, 30, 4)])


# ---- A Midsummer Night's Dream: the wood ----------------------------------------------------------

def wood(t, speaking):
    w, d = 94, 80
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=21, seed=15, top="grass")
    parts = [ground]
    parts += toadstool((20, 60, 0.5), 15, 9, seed=1)
    parts += toadstool((26, 12, 0.5), 9, 5.5, seed=2)
    parts += toadstool((50, 10, 0.5), 11, 6.5, seed=3)
    parts += toadstool((86, 64, 0.5), 6, 4, seed=4)
    parts += toadstool((10, 30, 0.5), 7, 4.5, seed=5)
    parts += log((56, 72, 3), (78, 76, 3), 3.2, seed=2)
    parts += tree((80, 12, 0.5), 38, crown=14, seed=17)
    parts += bush((86, 36, 0.8), 5, seed=6, flowers=8, bloom=("lily", "flower_white"))
    parts += bush((8, 40, 0.8), 4.5, seed=7, flowers=6, bloom=("lily", "flower_white"))
    ptop = 15 + 9 * 0.62 - 0.6

    tpos = at_ground(ground, 36, 30, -0.3)
    bpos = at_ground(ground, 66, 42, -0.3)
    kpos = (20, 60, ptop)
    titania = Figure(trim="gold", cuffs="gold", at=tpos, yaw=yaw_to(tpos, bpos, 0.4), skin="skin_pale", hair="hair_blonde", hair_style="long",
                     top="sky", skirt="white", skirt_len=1.0, skirt_flare=1.05, sleeves="white", belt="gold",
                     breathe=math.sin(phase),
                     arms={"right": {"up": (110, -10), "fore": (120, -20)} if speaking == 0 else {"up": (60, -5), "fore": (90, -15)},
                           "left": {"up": (40, 20), "fore": (80, 10)}},
                     props=[flower_crown()])
    twings = wings(titania, 12.0, math.sin(phase * 2) * 0.6)
    bottom = Figure(at=bpos, yaw=yaw_to(bpos, tpos, 0.5), skin="skin", ass_head=True, top="brown", legs="brown",
                    boots="leather", belt="leather", sleeves="cream", girth=1.1,
                    arms={"left": {"up": (120, 40), "fore": (150, 30)} if speaking == 1 else {"up": (20, 15), "fore": (40, 10)},
                          "right": {"up": (20, 15), "fore": (40, 10)}})
    puck = Figure(at=kpos, yaw=yaw_to(kpos, (60, 50), 0.6), height=0.78, skin="skin", hair="hair_red",
                  hair_style="curls", top="green", legs="green", boots="leather", hat="laurel",
                  breathe=math.sin(phase * 2),
                  arms={"left": {"up": (150, 40), "fore": (165, 30)}, "right": {"up": (140 if speaking == 2 else 60, 40),
                                                                                 "fore": (160 if speaking == 2 else 90, 30)}})
    rnd = np.random.default_rng(7)
    flies = []
    for k in range(14):
        x0, y0, z0 = rnd.uniform(5, 90), rnd.uniform(5, 76), rnd.uniform(8, 40)
        a = phase + k
        flies.append((x0 + math.cos(a) * 2.5, y0 + math.sin(a) * 2.5, z0 + math.sin(a * 2) * 2))

    def before(f, t):
        sky(f, DREAM, top=0.0, bottom=0.62, width=0.96, seed=51, stars=0.012, puffs=8)
        disc(f, (96, -6, 100), 10, MOON)

    def after(f, t):
        sparks(f, flies)
        glow(f, [titania.world((0, 0, 30))], (200, 190, 255), radius=20, strength=0.35)

    return Scene("wood", parts, {1: titania, 2: bottom, 3: puck, 4: twings}, ghosts=(4,), night=0.5,
                 before=before, after=after,
                 extent=[(-6, -24, 110, 6), (100, -10, 60, 6), (-22, 84, 30, 6)])


# ---- Macbeth: the sleepwalking --------------------------------------------------------------------

def spot(t, speaking):
    w, d = 86, 74
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=21, seed=19, top="slate", top_rough=0.8)
    parts = [ground]
    parts.append(Cut(box(v(3, 2, 0), v(w - 4, 10, 46), MAT["stone"]),
                     Union([box(v(60, 0, 0.5), v(70, 14, 18), 0), hcyl((65, 6, 18), 5, 6, "y", "stone")])))
    parts.append(box(v(2, 2, 0), v(10, d - 6, 46), MAT["stone"]))
    parts.append(box(v(20, 10, 16), v(40, 11, 38), MAT["banner_red"]))
    parts.append(box(v(19, 10, 37), v(41, 11.5, 38.5), MAT["gold"]))
    parts += torch((10.4, 36, 22), t)
    parts += torch((50, 10.4, 22), t + 1)
    # A bed with its posts and hangings.
    parts.append(box(v(12, 30, 0.5), v(30, 54, 7), MAT["wood_dark"]))
    parts.append(box(v(12.5, 30.5, 7), v(29.5, 53.5, 9), MAT["cloth_table"]))
    parts.append(box(v(12, 30, 9), v(16, 54, 12), MAT["crimson"]))
    for (x, y) in ((12, 30), (29, 30), (12, 53), (29, 53)):
        parts.append(box(v(x, y, 0.5), v(x + 1.4, y + 1.4, 30), MAT["wood_dark"]))
    parts.append(box(v(11.5, 29.5, 29), v(30.5, 55, 32), MAT["crimson"]))
    parts.append(box(v(11.5, 29.5, 16), v(13, 55, 30), MAT["crimson"]))

    walk = math.sin(phase) * 2.0
    lpos = at_ground(ground, 50 + walk, 46 - walk * 0.5, -0.3)
    dpos = at_ground(ground, 63, 16, -0.3)
    gpos = at_ground(ground, 70, 20, -0.3)
    rub = math.sin(phase * 2)
    lady = Figure(trim="cream", at=lpos, yaw=yaw_to(lpos, (90, 70), 0.3), skin="skin_pale", hair="hair_red", hair_style="long",
                  top="white", skirt="white", skirt_len=1.0, skirt_flare=1.0, sleeves="white",
                  breathe=math.sin(phase),
                  arms={"right": {"up": (70, -5), "fore": (100, -10)},
                        "left": {"up": (70 + rub * 10, 5), "fore": (100 + rub * 15, -40)} if speaking != 0
                        else {"up": (120, 40), "fore": (140, 30)}},
                  props=[candle("right")])
    doctor = Figure(at=dpos, yaw=yaw_to(dpos, lpos, 0.5), skin="skin_old", hair="hair_grey", beard="hair_grey",
                    beard_len=1.2, top="black", skirt="black", skirt_len=0.8, hat="cap", hat_colour="black",
                    collar="white", arms={"left": {"up": (90 if speaking == 1 else 20, 30), "fore": (100 if speaking == 1 else 40, 10)}})
    gentle = Figure(at=gpos, yaw=yaw_to(gpos, lpos, 0.5), skin="skin", hair="hair_brown", top="charcoal",
                    skirt="charcoal", skirt_len=1.0, veil="white", collar="white",
                    arms={"right": {"up": (40, -10), "fore": (130, -40)} if speaking == 2 else {"up": (20, 10), "fore": (60, 10)}})

    def after(f, t):
        glow(f, [(10.4 + 0.8, 36.8, 29), (50.8, 11.2, 29)], (255, 170, 80), radius=16, strength=0.55)

    return Scene("spot", parts, {1: lady, 2: doctor, 3: gentle}, night=0.7, after=after,
                 light_colour=(255, 210, 130), extent=[(-10, 78, 24, 4), (90, -6, 50, 4)])


# ---- Julius Caesar: the forum ---------------------------------------------------------------------

def forum(t, speaking):
    w, d = 100, 86
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=22, seed=23, top="marble_floor", top_rough=0.8)
    parts = [ground]
    parts.append(box(v(16, 6, 0.5), v(60, 34, 9), MAT["marble"]))
    parts += steps(60, 12, 0.5, 16, 4, rise=2.1, run=2.8, mat="marble", dir="x")
    for x in (20, 32, 44, 56):
        parts += column((x, 9, 9), 30, 2.2)
    parts.append(box(v(16, 5, 39), v(60, 14, 43), MAT["marble"]))
    parts.append(gable(16, 5, 60, 14, 43, 6, "marble", ridge="x", eave=0.8))
    for x in (26, 38, 50):
        parts.append(box(v(x - 2.5, 10.5, 20), v(x + 2.5, 11.5, 38), MAT["banner_red"]))
        parts.append(box(v(x - 2.8, 10.2, 37.6), v(x + 2.8, 11.8, 38.8), MAT["gold"]))
    # Caesar, on his bier, under his mantle.
    parts.append(box(v(12, 50, 0.5), v(22, 70, 5.5), MAT["wood_dark"]))
    parts.append(Rough(capsule(v(17, 52, 7.5), v(17, 68, 7.2), 3.4, MAT["cloth_table"]), 0.6, 1.5, 3))
    parts.append(Rough(ellipsoid(v(17, 59, 10), v(3.6, 4, 1.4), MAT["blood"]), 0.4, 1.0, 5))
    parts.append(sphere(v(17, 70, 7.6), 2.6, MAT["skin_pale"]))
    parts.append(torus(v(17, 70, 8.6), 2.4, 0.6, MAT["leaf"]))
    parts += column((92, 20, 0.5), 18, 1.8, capital=True)
    parts += bush((90, 76, 0.8), 4.5, seed=9, flowers=0)

    apos = (38, 22, 9.0)
    talk = speaking == 0
    antony = Figure(trim="purple_trim", at=apos, yaw=yaw_to(apos, (70, 66), 0.4), skin="skin", hair="hair_brown", hair_style="curls",
                    top="toga", skirt="toga", skirt_len=1.0, skirt_flare=0.95, sleeves="toga", belt="purple_trim",
                    collar="purple_trim", legs="toga", breathe=math.sin(phase),
                    arms={"left": {"up": (110, 50), "fore": (125, 40)} if talk else {"up": (40, 20), "fore": (95, 10)},
                          "right": {"up": (100, 45), "fore": (115, 40)} if talk else {"up": (60, 15), "fore": (80, 0)}})
    crowd = {}
    spots = [((60, 50), "brown", "hair_black", None, "cream"), ((74, 44), "moss_cloth", "hair_brown", None, "brown"),
             ((58, 68), "orange", "hair_grey", "white", "cream"), ((80, 62), "cream", "hair_brown", None, "moss_cloth")]
    for i, ((x, y), cloth, hair, veil, legs) in enumerate(spots):
        pos = at_ground(ground, x, y, -0.3)
        cheer = speaking == i + 1
        crowd[i + 2] = Figure(at=pos, yaw=yaw_to(pos, apos, 0.25), skin=("skin", "skin_old", "skin", "skin")[i],
                              hair=hair, top=cloth, skirt=cloth, skirt_len=0.6 if not veil else 1.0, legs=legs,
                              boots="leather", veil=veil, belt="leather", breathe=math.sin(phase + i),
                              arms={"left": {"up": (150, 30), "fore": (165, 20)} if cheer else {"up": (15, 10), "fore": (35, 5)},
                                    "right": {"up": (15, 10), "fore": (35, 5)}})
    figs = {1: antony}
    figs.update(crowd)
    return Scene("forum", parts, figs, extent=[(-10, 90, 20, 4), (104, -6, 30, 4)])


# ---- King Lear: the storm -------------------------------------------------------------------------

def lear(t, speaking):
    w, d = 90, 76
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=21, seed=25, top="heath")
    parts = [ground]
    parts.append(rock((14, 16, -1), 9, seed=11))
    parts.append(rock((8, 44, -1), 6, seed=12))
    parts.append(rock((78, 64, -2), 7, seed=13))
    parts += tree((32, 10, 0.5), 30, seed=19, dead=True)
    parts.append(box(v(62, 6, 0.5), v(84, 22, 16), MAT["wood_dark"]))
    parts.append(gable(62, 6, 84, 22, 16, 9, "thatch", ridge="x"))
    parts.append(box(v(70, 21.5, 0.5), v(76, 22.5, 11), MAT["black"]))

    lpos = at_ground(ground, 32, 40, -0.3)
    fpos = at_ground(ground, 70, 46, -0.3)
    wind = 3 + math.sin(phase) * 1.5
    rage = speaking != 1
    lear_fig = Figure(trim="gold", cuffs="fur", at=lpos, yaw=yaw_to(lpos, (90, 60), 0.4), skin="skin_old", hair="hair_white", hair_style="long",
                      beard="hair_white", beard_len=2.2, top="royal", skirt="royal", skirt_len=1.0, skirt_flare=1.05,
                      cape="royal", cape_flare=wind, collar="fur", crown="gold", belt="gold",
                      breathe=math.sin(phase),
                      arms={"left": {"up": (160 if rage else 60, 30), "fore": (170 if rage else 90, 25)},
                            "right": {"up": (155 if rage else 60, 30), "fore": (168 if rage else 90, 25)}})
    fool = Figure(at=fpos, yaw=yaw_to(fpos, lpos, 0.5), skin="skin", hair="hair_brown", top="red", sleeves="yellow",
                  legs="green", boots="red", hat="jester", motley=("red", "yellow", "green"), stoop=1.0,
                  collar="yellow", breathe=math.sin(phase * 2),
                  arms={"left": {"up": (60, -10), "fore": (120, -60)}, "right": {"up": (70, 10), "fore": (100, 30)}},
                  props=[bauble("right")])
    lightning = t in (1, 3)

    def before(f, t):
        sky(f, STORM_CLOUD, top=0.0, bottom=0.62, width=0.98, seed=61, puffs=12)
        if lightning:
            W = f.alpha.shape[1]
            bolt(f, (W * (0.3 if t == 1 else 0.76), 6), (W * (0.34 if t == 1 else 0.7), f.alpha.shape[0] * 0.44), seed=10 + t)

    def after(f, t):
        rain(f, t, seed=6, amount=1.2)
        if lightning:
            flash(f, 0.14)

    return Scene("lear", parts, {1: lear_fig, 2: fool}, night=0.5, before=before, after=after,
                 extent=[(-6, -24, 110, 6), (100, -10, 60, 6), (-22, 80, 30, 6)])


# ---- Henry IV: Falstaff ---------------------------------------------------------------------------

def falstaff(t, speaking):
    w, d = 88, 76
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=21, seed=27, top="wood", top_rough=0.4)
    parts = [ground]
    parts.append(box(v(3, 2, 0), v(w - 4, 10, 42), MAT["plaster"]))
    parts.append(box(v(2, 2, 0), v(10, d - 6, 42), MAT["plaster"]))
    for x in (4, 22, 40, 58, 76):
        parts.append(box(v(x, 9.6, 0), v(x + 2.2, 10.6, 42), MAT["wood_dark"]))
    for y in (20, 38, 56):
        parts.append(box(v(9.6, y, 0), v(10.6, y + 2.2, 42), MAT["wood_dark"]))
    parts.append(box(v(3, 9.6, 30), v(w - 4, 10.6, 32), MAT["wood_dark"]))
    parts.append(box(v(9.6, 2, 30), v(10.6, d - 6, 32), MAT["wood_dark"]))
    # The hearth.
    parts.append(Cut(box(v(46, 8, 0.5), v(66, 14, 22), MAT["stone"]), box(v(49, 10, 0.5), v(63, 18, 13), 0)))
    parts.append(box(v(44, 8, 22), v(68, 15, 24), MAT["wood_dark"]))
    for k in range(4):
        fl = 3 + 1.4 * math.sin(t * 2.2 + k * 1.9)
        parts.append(ellipsoid(v(52 + k * 2.6, 13, 2 + fl / 2), v(1.4, 1.4, fl), MAT["flame"]))
    parts.append(capsule(v(50, 13, 1.4), v(62, 13, 1.4), 1.0, MAT["wood_dark"]))
    parts += barrel((18, 18, 0.5))
    parts += barrel((18, 28, 0.5))
    parts += barrel((18, 23, 8.5))
    parts += table((50, 42, 0.5), 20, 11, 9)
    for (x, y) in ((54, 45), (60, 47), (66, 44)):
        parts += [cylinder(v(x, y, 9.5), 1.6, 3.6, MAT["iron"]), cylinder(v(x, y, 13), 1.3, 0.5, MAT["foam"])]
    parts.append(ellipsoid(v(63, 50, 11), v(2.6, 2.0, 1.4), MAT["bone"]))
    parts += bench((50, 56, 0.5), 18)

    fpos = at_ground(ground, 36, 50, -0.3)
    hpos = at_ground(ground, 70, 30, -0.3)
    toast = speaking == 0
    fal = Figure(buttons="gold", cuffs="cream", at=fpos, yaw=yaw_to(fpos, hpos, 0.45), skin="skin", hair="hair_white", beard="hair_white",
                 beard_len=1.4, top="orange", sleeves="brown", legs="brown", boots="leather", belt="leather", fat=1.8,
                 hat="wide", hat_colour="red", breathe=math.sin(phase) * 1.5,
                 arms={"right": {"up": (150 if toast else 100, -20), "fore": (165 if toast else 120, -20)},
                       "left": {"up": (40, 40), "fore": (100, -40)}},
                 props=[tankard("right"), nose()])
    hal = Figure(buttons="gold", cuffs="white", at=hpos, yaw=yaw_to(hpos, fpos, 0.45), skin="skin", hair="hair_brown", top="green", sleeves="green",
                 legs="green", boots="leather", cape="red", collar="white", belt="gold",
                 breathe=math.sin(phase + 1),
                 arms={"left": {"up": (100, 30), "fore": (110, 10)} if speaking == 1 else {"up": (20, 15), "fore": (95, -40)},
                       "right": {"up": (20, 15), "fore": (95, -40)}})

    def after(f, t):
        glow(f, [(56, 13, 6)], (255, 160, 70), radius=26, strength=0.6)

    return Scene("falstaff", parts, {1: fal, 2: hal}, after=after, extent=[(-10, 80, 24, 4), (92, -6, 50, 4)])


# ---- Hamlet: Ophelia ------------------------------------------------------------------------------

def ophelia(t, speaking):
    w, d = 94, 80
    phase = t / FRAMES * TAU
    channel = custom(lambda p: np.abs((p[:, 0] - p[:, 1] * 0.55) - 26) - 11 + (fbm(p, 6, 3) - 0.5) * 3,
                     (-10, -10, -6), (110, 100, 8), 0)
    cut = Cut(Union([channel]), box(v(-20, -20, -40), v(130, 110, -4), 0))
    ground = Cut(clod(w, d, depth=22, seed=29, top="grass"), cut)
    parts = [ground]
    water_fn = lambda p: np.maximum(np.maximum(np.abs((p[:, 0] - p[:, 1] * 0.55) - 26) - 11.5,
                                               np.abs(p[:, 2] + 2.2) - 0.6),
                                    np.maximum(np.maximum(-p[:, 0] + 1, p[:, 0] - w + 1), np.maximum(-p[:, 1] + 1, p[:, 1] - d + 1)))
    parts.append(custom(water_fn, (0, 0, -3), (w, d, -1), MAT["water"]))
    rnd = np.random.default_rng(3)
    for k in range(9):
        y = rnd.uniform(8, 72)
        x = 26 + y * 0.55 + rnd.uniform(-8, 8)
        parts.append(cylinder(v(x, y, -1.8), 2.2, 0.3, MAT["leaf"]))
        if k % 2 == 0:
            parts.append(sphere(v(x + 0.4, y, -1.0), 0.9, MAT["lily"]))
    # The willow, leaning over the brook, its strands hanging.
    trunk = [capsule(v(72, 14, 0.5), v(64, 20, 26), 2.4, MAT["wood_dark"], r1=1.6)]
    crown = [Rough(ellipsoid(v(62, 22, 30), v(12, 11, 6), MAT["leaf"]), 1.2, 2.4, 5)]
    for k in range(16):
        a = k / 16 * math.pi * 2
        top = v(62 + math.cos(a) * 10, 22 + math.sin(a) * 9, 27)
        sway = math.sin(phase + k) * 0.8
        crown.append(capsule(top, top + v(sway, 0, -12 - (k % 3) * 3), 1.0, MAT["leaf"], r1=0.5))
    parts += trunk + crown
    parts += bush((12, 30, 0.8), 5, seed=11, flowers=10, bloom=("flower_white", "lily", "flower_red"))
    parts += bush((80, 60, 0.8), 5, seed=12, flowers=10, bloom=("flower_white", "lily"))
    parts += bush((14, 64, 0.8), 4, seed=13, flowers=6, bloom=("flower_red", "lily"))
    for k in range(10):
        x, y = rnd.uniform(4, 30), rnd.uniform(4, 70)
        if abs((x - y * 0.55) - 26) < 13:
            continue
        parts.append(capsule(v(x, y, 1), v(x + 0.6, y, 9 + rnd.uniform(0, 4)), 0.35, MAT["leaf"], r1=0.15))

    opos = (50, 40, -2.4)
    offer = speaking == 0
    oph = Figure(trim="lily", at=opos, yaw=yaw_to(opos, (100, 90), 0.2), skin="skin_pale", hair="hair_blonde", hair_style="long",
                 top="white", skirt="white", skirt_len=1.0, skirt_flare=1.35, sleeves="white", belt="lily",
                 breathe=math.sin(phase),
                 arms={"left": {"up": (100, 30), "fore": (110, 20)} if offer else {"up": (70, 25), "fore": (100, 10)},
                       "right": {"up": (40, -20), "fore": (80, -30)}},
                 props=[flowers("left"), flower_crown()])

    return Scene("ophelia", parts, {1: oph}, extent=[(-10, 84, 24, 4), (100, -6, 50, 4)])


def line(who, text):
    return [who, text]


# ---- Henry V: the Chorus, after Universal Everything's Transfiguration ----------------------------

LOOKS = ["fire_body", "water_body", "bubble", "smoke_body", "blossom", "grain", "marble", "dirt_top"]
BUBBLE = ["#4a6a8a", "#9cc8e4", "#e2f6ff", "#ffffff"]


def chorus(t, speaking, look=0):
    """The wooden O: the Globe's stage, its tiring house and galleries, on a clod of DIRT. The
    Chorus walks toward you down the boards and never arrives, and what it is made of keeps
    changing — fire, water, bubbles, smoke, flowers, wood, marble, the soil itself."""
    w, d = 104, 92
    phase = t / FRAMES * TAU
    mat = LOOKS[look % len(LOOKS)]
    ground = clod(w, d, depth=22, seed=41, top="path", top_rough=0.8)
    parts = [ground]
    # The tiring house along the back: plaster between timbers, two doors, a gallery over them.
    doors = Union([arch_cut(32, 11, 0, 9, 17, on="y"), arch_cut(74, 11, 0, 9, 17, on="y")])
    parts.append(Cut(box(v(12, 2, 0), v(w - 4, 11, 46), MAT["plaster"]), doors))
    for x in (32, 74):
        parts.append(box(v(x - 4.5, 5.5, 0), v(x + 4.5, 6.5, 17), MAT["wood_dark"]))
    for x in (12, 22, 42, 53, 64, 84, w - 6):
        parts.append(box(v(x, 10.6, 0), v(x + 2, 11.6, 46), MAT["wood_dark"]))
    parts.append(box(v(12, 10.6, 21), v(w - 4, 11.6, 22.6), MAT["wood_dark"]))
    parts.append(box(v(12, 10.6, 44), v(w - 4, 11.6, 46), MAT["wood_dark"]))
    parts.append(box(v(12, 11, 24), v(w - 4, 17, 25.4), MAT["wood_dark"]))
    for x in np.arange(14, w - 5, 4.0):
        parts.append(box(v(x, 16, 25.4), v(x + 0.9, 17, 30), MAT["wood_dark"]))
    parts.append(box(v(12, 16, 30), v(w - 4, 17.2, 31.2), MAT["wood_dark"]))
    parts.append(gable(12, 1, w - 4, 13, 46, 9, "thatch", ridge="x"))
    # The galleries down the side: the wooden O.
    parts.append(box(v(2, 11, 0), v(11, d - 10, 40), MAT["plaster"]))
    for y in np.arange(13, d - 10, 11.0):
        parts.append(box(v(10.6, y, 0), v(11.6, y + 2, 40), MAT["wood_dark"]))
    for z in (13.0, 26.0):
        parts.append(box(v(11, 11, z), v(16, d - 10, z + 1.3), MAT["wood_dark"]))
        for y in np.arange(12, d - 10, 3.5):
            parts.append(box(v(15, y, z + 1.3), v(16, y + 0.8, z + 5.2), MAT["wood_dark"]))
        parts.append(box(v(15, 11, z + 5.2), v(16.2, d - 10, z + 6.3), MAT["wood_dark"]))
    parts.append(gable(1, 11, 13, d - 10, 40, 8, "thatch", ridge="y"))
    # The stage: boards thrust out into the yard, and the two pillars that hold up the heavens
    # over the back of it.
    parts.append(box(v(22, 11, 0), v(88, 64, 7), MAT["wood"]))
    parts.append(box(v(22, 11, 38), v(88, 26, 40), MAT["royal"]))
    for k in range(9):                                     # the heavens, painted with stars
        parts.append(sphere(v(26 + (k * 37) % 60, 13 + (k * 5) % 12, 40.1), 0.55, MAT["gold"]))
    parts += column((30, 25, 7), 31, r=1.7, mat="marble")
    parts += column((80, 25, 7), 31, r=1.7, mat="marble")
    # The groundlings, in the yard, watching.
    crowd = []
    for i, (gx, gy, top_, hair_) in enumerate(((96, 22, "brown", "hair_brown"), (97, 42, "moss_cloth", "hair_black"),
                                              (34, 80, "teal", "hair_red"), (20, 84, "cream", "hair_blonde"))):
        gp = at_ground(ground, gx, gy, -0.3)
        crowd.append(Figure(at=gp, yaw=yaw_to(gp, (55, 38), 0.1), height=0.85, skin="skin", hair=hair_,
                            top=top_, legs="brown", boots="leather", hat="cap" if i % 2 else None,
                            arms={"left": {"up": (10, 10), "fore": (30, 6)}, "right": {"up": (10, 10), "fore": (30, 6)}}))

    stride = math.sin(phase) * 26
    swing = math.sin(phase) * 30
    step = abs(math.cos(phase)) * 0.7
    cpos = (60, 50, 7.0 + step)
    fig = Figure(at=cpos, yaw=math.pi / 4, height=1.3, skin=mat, hair=mat, hair_style="long", top=mat, legs=mat,
                 boots=mat, cape=mat, cape_len=0.95, cape_flare=1.2 + math.cos(phase) * 0.9, collar=mat,
                 belt=mat, stride=stride, breathe=step,
                 arms={"right": {"up": (swing + 10, 12), "fore": (swing + 26, 8)},
                       "left": {"up": (-swing + 10, 12), "fore": (-swing + 26, 8)}})
    head = fig.world(fig.head_c + np.array([0, 0, 2.0]))
    hands = [fig.world(np.array([2.0 + swing * 0.1, side * 7.0, 17.0])) for side in (1, -1)]

    def after(f, t_):
        if mat == "fire_body":
            glow(f, [head], (255, 150, 60), radius=30, strength=0.55)
            sparks(f, [head + np.array([math.sin(k * 2.1 + t_) * 5, math.cos(k * 1.7) * 5, 6 + ((k * 5 + t_ * 3) % 16)])
                       for k in range(6)], colour=(255, 236, 150), halo=(255, 140, 40))
        elif mat == "water_body":
            sparks(f, [hand + np.array([0, 0, -3 - ((k * 4 + t_ * 3) % 12)]) for hand in hands for k in range(2)],
                   colour=(210, 240, 255), halo=(90, 160, 210))
        elif mat == "bubble":
            for k in range(5):
                rise = ((k * 7 + t_ * 3) % 24)
                disc(f, head + np.array([math.sin(k * 2.3) * 9, math.cos(k * 1.9) * 9, rise - 4]), 1.6 + (k % 3) * 0.7,
                     BUBBLE, craters=False)
        elif mat == "smoke_body":
            smoke(f, head, t_, colour=(196, 196, 206), rise=34, puffs=5, seed=4, width=9)
        elif mat == "blossom":
            sparks(f, [cpos + np.array([math.sin(k * 1.3) * 12, math.cos(k * 2.2) * 12, 30 - ((k * 6 + t_ * 4) % 30)])
                       for k in range(7)], colour=(255, 214, 226), halo=(230, 120, 160))
        elif mat == "dirt_top":
            sparks(f, [hand + np.array([0, 0, -2 - ((k * 5 + t_ * 3) % 14)]) for hand in hands for k in range(2)],
                   colour=(150, 104, 64), halo=(90, 60, 36))

    figures = {1: fig}
    for i, g in enumerate(crowd):
        figures[i + 2] = g
    return Scene("chorus", parts, figures, ghosts=(1,) if mat == "smoke_body" else (), after=after,
                 extent=[(60, 50, 80, 10), (20, 92, 0, 6), (110, 20, 0, 6)])


CHORUS = {
    "key": "chorus",
    "play": "Henry V",
    "title": "The Chorus",
    "where": "This wooden O",
    "build": chorus,
    "looks": LOOKS,
    "after": "Universal Everything, Transfiguration",
    "cast": ["Chorus"],
    "lines": [
        [0, "O for a Muse of fire, that would ascend the brightest heaven of invention!"],
        [0, "A kingdom for a stage, princes to act, and monarchs to behold the swelling scene!"],
        [0, "Can this cockpit hold the vasty fields of France?"],
        [0, "Piece out our imperfections with your thoughts."],
    ],
}


REPERTORY = [
    GHOST,
    CHORUS,
    {"key": "witches", "play": "Macbeth", "title": "The Witches", "where": "A heath, in thunder",
     "build": witches, "cast": ["First Witch", "Second Witch", "Third Witch"],
     "lines": [line(0, "When shall we three meet again, in thunder, lightning, or in rain?"),
               line(1, "Double, double toil and trouble;"),
               line(2, "Fire burn and cauldron bubble."),
               line(0, "Fair is foul, and foul is fair."),
               line(1, "By the pricking of my thumbs, something wicked this way comes.")]},
    {"key": "balcony", "play": "Romeo and Juliet", "title": "The Balcony", "where": "Capulet's orchard",
     "build": balcony, "cast": ["Romeo", "Juliet"],
     "lines": [line(0, "But soft! What light through yonder window breaks? It is the east, and Juliet is the sun."),
               line(1, "O Romeo, Romeo, wherefore art thou Romeo?"),
               line(1, "Deny thy father and refuse thy name."),
               line(0, "I take thee at thy word.")]},
    {"key": "tempest", "play": "The Tempest", "title": "The Storm", "where": "An island, and a ship at sea",
     "build": tempest, "cast": ["Prospero", "Mariners", "Ariel"],
     "lines": [line(1, "All lost! To prayers, to prayers! All lost!"),
               line(2, "Full fathom five thy father lies; of his bones are coral made."),
               line(0, "We are such stuff as dreams are made on, and our little life is rounded with a sleep.")]},
    {"key": "yorick", "play": "Hamlet", "title": "Yorick", "where": "A churchyard",
     "build": yorick, "cast": ["Hamlet", "Horatio", "Gravedigger"],
     "lines": [line(2, "This same skull, sir, was Yorick's skull, the King's jester."),
               line(0, "Alas, poor Yorick! I knew him, Horatio: a fellow of infinite jest, of most excellent fancy."),
               line(0, "Where be your gibes now? your gambols? your songs?"),
               line(1, "E'en so, my lord.")]},
    {"key": "quarrel", "play": "Romeo and Juliet", "title": "The Quarrel", "where": "A public place in Verona",
     "build": quarrel, "cast": ["Tybalt", "Mercutio"],
     "lines": [line(0, "Mercutio, thou consort'st with Romeo."),
               line(1, "Consort? What, dost thou make us minstrels?"),
               line(0, "I am for you."),
               line(1, "A plague o' both your houses!")]},
    {"key": "wood", "play": "A Midsummer Night's Dream", "title": "The Wood", "where": "A wood near Athens",
     "build": wood, "cast": ["Titania", "Bottom", "Puck"],
     "lines": [line(2, "Lord, what fools these mortals be!"),
               line(0, "What angel wakes me from my flowery bed?"),
               line(1, "I have had a most rare vision."),
               line(2, "If we shadows have offended, think but this, and all is mended.")]},
    {"key": "spot", "play": "Macbeth", "title": "The Sleepwalking", "where": "Dunsinane, a room in the castle",
     "build": spot, "cast": ["Lady Macbeth", "Doctor", "Gentlewoman"],
     "lines": [line(1, "Look, how she rubs her hands."),
               line(2, "It is an accustomed action with her, to seem thus washing her hands."),
               line(0, "Out, damned spot! Out, I say!"),
               line(0, "What's done cannot be undone. To bed, to bed, to bed!")]},
    {"key": "forum", "play": "Julius Caesar", "title": "The Forum", "where": "Rome, the Forum",
     "build": forum, "cast": ["Antony", "First Citizen", "Second Citizen", "Third Citizen", "Fourth Citizen"],
     "lines": [line(0, "Friends, Romans, countrymen, lend me your ears;"),
               line(0, "I come to bury Caesar, not to praise him."),
               line(1, "Methinks there is much reason in his sayings."),
               line(0, "This was the most unkindest cut of all."),
               line(2, "O piteous spectacle!")]},
    {"key": "lear", "play": "King Lear", "title": "The Storm", "where": "A heath, in a storm",
     "build": lear, "cast": ["Lear", "Fool"],
     "lines": [line(0, "Blow, winds, and crack your cheeks! Rage! Blow!"),
               line(1, "Here's a night pities neither wise men nor fools."),
               line(0, "I am a man more sinned against than sinning.")]},
    {"key": "falstaff", "play": "Henry IV", "title": "Falstaff", "where": "The Boar's Head, Eastcheap",
     "build": falstaff, "cast": ["Falstaff", "Prince Hal"],
     "lines": [line(1, "Thou art so fat-witted with drinking of old sack."),
               line(0, "The better part of valour is discretion."),
               line(0, "If sack and sugar be a fault, God help the wicked!"),
               line(0, "Banish plump Jack, and banish all the world.")]},
    {"key": "ophelia", "play": "Hamlet", "title": "Ophelia", "where": "A brook, and a willow",
     "build": ophelia, "cast": ["Ophelia"],
     "lines": [line(0, "There's rosemary, that's for remembrance; pray you, love, remember."),
               line(0, "And there is pansies, that's for thoughts."),
               line(0, "Lord, we know what we are, but know not what we may be.")]},
]


# ---- the library itself ---------------------------------------------------------------------------

def folger(t, speaking, lift=0.0, gait=None):
    """The Folger Shakespeare Library on East Capitol Street: a long, low block of white marble,
    Paul Cret's, 1932 — nine tall windows behind aluminium grilles between fluted pilasters,
    nine carved panels under them, and Puck on his plinth at the west end of the lawn.

    And under it, folded, six legs: now and then it stands up on them and walks, after
    Universal Everything's Walking City (and Archigram's before it). `lift` is how far it has
    stood up; `gait` is where it is in a stride, or None when it is not walking."""
    w, d = 124, 62
    phase = t / FRAMES * TAU
    ground = clod(w, d, depth=20, seed=31, top="grass")
    parts = [ground]
    parts.append(box(v(6, 3, 0.4), v(118, 34, 2.2), MAT["marble_floor"]))
    parts.append(box(v(10, 5, 0), v(114, 24, 30), MAT["marble"]))
    parts.append(box(v(8, 4, 0), v(22, 26, 33), MAT["marble"]))
    parts.append(box(v(102, 4, 0), v(116, 26, 33), MAT["marble"]))
    parts.append(box(v(9.4, 23, 28.5), v(114.6, 25.4, 30.5), MAT["marble"]))
    parts.append(box(v(7.4, 3.4, 32.4), v(116.6, 26.6, 33.6), MAT["marble"]))
    xs = np.linspace(24, 100, 10)
    for i, x in enumerate(xs):
        parts.append(box(v(x - 1.3, 24, 2), v(x + 1.3, 25.6, 28.5), MAT["marble"]))
        if i < len(xs) - 1:
            m = (x + xs[i + 1]) / 2
            parts.append(box(v(m - 2.6, 23.6, 11.5), v(m + 2.6, 24.4, 27.5), MAT["iron"]))
            for z in np.arange(13.5, 27.5, 3.0):
                parts.append(box(v(m - 2.6, 24.2, z), v(m + 2.6, 24.6, z + 0.5), MAT["steel"]))
            parts.append(box(v(m - 0.25, 24.2, 11.5), v(m + 0.25, 24.6, 27.5), MAT["steel"]))
            parts.append(Rough(box(v(m - 3.0, 24, 3.5), v(m + 3.0, 25.0, 9.0), MAT["marble"]), 0.35, 0.8, i))
    for x in (15, 109):
        parts.append(box(v(x - 3, 25.6, 1.8), v(x + 3, 26.4, 16), MAT["iron"]))
        parts.append(box(v(x - 3.8, 25.4, 16), v(x + 3.8, 26.6, 18), MAT["marble"]))
        parts += steps(x - 5, 26, 0.4, 10, 3, rise=0.7, run=2.4, mat="marble", dir="y") if False else []
    parts += cypress((4, 8, 0.5), 30, 4.5, seed=31)
    parts += cypress((120, 8, 0.5), 30, 4.5, seed=32)
    parts += bush((30, 44, 0.8), 4.0, seed=33, flowers=4, bloom=("flower_white",))
    parts += bush((94, 44, 0.8), 4.0, seed=34, flowers=4, bloom=("flower_white",))
    # Puck, on his plinth over a basin, at the west end.
    parts.append(cylinder(v(14, 48, 0.4), 6.0, 2.2, MAT["marble"]))
    parts.append(cylinder(v(14, 48, 2.0), 5.0, 0.5, MAT["water"]))
    parts.append(box(v(12.5, 46.5, 2.0), v(15.5, 49.5, 7.0), MAT["marble"]))
    bob = 0.0 if gait is None else abs(math.sin(gait * TAU)) * 1.4
    up = lift + bob
    puck = Figure(at=(14, 48, 7.0 + up), yaw=0.9, height=0.34, skin="marble", hair="marble", hair_style="curls",
                  top="marble", legs="marble", boots="marble",
                  arms={"left": {"up": (150, 40), "fore": (165, 30)}, "right": {"up": (60, 30), "fore": (90, 20)}})
    body = [Moved(Union(parts), (0, 0, up))] if up else parts
    body += walking_legs(w, d, up, gait)
    return Scene("folger", body, {1: puck},
                 extent=[(0, 70, 10, 4), (130, 0, 30 + LIBRARY_LIFT, 4), (0, 70, -20 - LIBRARY_LEG, 4),
                         (130, 0, -20 - LIBRARY_LEG, 4)])


LIBRARY_LIFT = 26.0          # how far it stands up
LIBRARY_LEG = 10.0           # how far below the clod its feet are


def walking_legs(w, d, up, gait):
    """Six legs under the clod, three a side, in steel with iron knees. Folded when it sits;
    walking, they go in the tripod an insect uses — three down, three swinging."""
    out = []
    floor = -20.0 - LIBRARY_LEG
    L1 = L2 = 21.0
    for i, x in enumerate((24.0, 62.0, 100.0)):
        for side, y in ((-1, 12.0), (1, d - 12.0)):
            hip = np.array([x, y, -12.0 + up])
            group = (i + (side > 0)) % 2
            fx, lift_ = 0.0, 0.0
            if gait is not None:
                ph = (gait + 0.5 * group) % 1.0
                if ph < 0.5:
                    fx = 8.0 - 16.0 * (ph / 0.5)
                else:
                    s_ = (ph - 0.5) / 0.5
                    fx = -8.0 + 16.0 * s_
                    lift_ = math.sin(math.pi * s_) * 7.0
            foot = np.array([x + fx, y + side * (9.0 + up * 0.25), floor + lift_])
            # The knee: up and out from the line between hip and foot.
            dvec = foot - hip
            dist = min(np.linalg.norm(dvec), L1 + L2 - 0.1)
            dirn = dvec / max(np.linalg.norm(dvec), 1e-6)
            out_ = np.array([0.0, side, 0.9])
            out_ = out_ - dirn * (out_ @ dirn)
            out_ = out_ / max(np.linalg.norm(out_), 1e-6)
            a = (L1 * L1 + dist * dist - L2 * L2) / (2 * dist)
            hgt = math.sqrt(max(0.0, L1 * L1 - a * a))
            knee = hip + dirn * a + out_ * hgt
            out.append(capsule(hip, knee, 1.7, MAT["steel"]))
            out.append(capsule(knee, foot + np.array([0, 0, 1.2]), 1.35, MAT["iron"], r1=1.1))
            out.append(sphere(knee, 2.1, MAT["iron"]))
            out.append(cylinder(foot, 2.4, 1.2, MAT["iron"]))
    return out


FOLGER = {"key": "folger", "play": "", "title": "Folger Shakespeare Library", "where": "East Capitol Street",
          "build": folger, "cast": [], "lines": [],
          "moves": {"stand": [{"lift": LIBRARY_LIFT * k / 3} for k in (1, 2, 3)],
                    "walk": [{"lift": LIBRARY_LIFT, "gait": k / 4} for k in range(4)]},
          "after": "Universal Everything, Walking City"}
