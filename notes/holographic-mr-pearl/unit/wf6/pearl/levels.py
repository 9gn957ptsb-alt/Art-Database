"""levels.py - the level of the base unit each body part (not the head) would be built at.

Ladder (wf6/levels/levels.json): level m has lengths hole F(m), growth F(m+1), side F(m+2), tribar F(m+3),
outline F(m+4) in u = a third of a block edge as drawn; level 2 is the drawing itself (1,2,3,5,8 thirds) and is
ONE BLOCK, 1 m, the smallest leaf of the world. Above it a level is F(m+4)/8 blocks (-> phi^(m-2)).

Mr Pearl is smaller than one block in every part, so his parts are BELOW the world's smallest leaf. The ladder's own
integer levels degenerate there (level 1 = 1,1,2,3,5; level 0 = 0,1,1,2,3: hole 0), so a body part is built of the
LEAF ITSELF (the drawing at thirds, H = 1/9) scaled by phi^-k:

  t  = the part's least thickness (twice its smallest radius / half-size)
  k  = round(log_phi(1 m / t)): the golden step whose unit edge e_k = phi^-k m is nearest t (in ratio), so one
       unit spans the part's section and the part is a row of n = L / e_k units along its length;
  m  = 2 - k: the same step in the ladder's numbering (level 2 = the 1 m block);
  fill = e_k / 8: the copy that fills each unit's holes is the leaf at the size of its own hole (hole 1 u of an
       8 u outline, the ladder's "hole of level m = outline of level m-4", exact in integers); phi^-4 = 0.146 would
       overflow the thirds hole by 16.7% (wf6/levels q_holes), so the fill is 1/8, not phi^-4. The filled holes are
       what make the part read SOLID.

Seen in the game (rocket.js): a block's bars are 0.1 of its edge, and a face closes into its mean from where a bar
is 8 px wide to under 3.64 px (smoothstep(0.0125, 0.0275, uPx*dist), uPx = 2 tan(35 deg)/canvas height). So a unit
of edge e is drawn whole nearer than D_open = e / (80 * p1) and is its mean beyond D_mean = e / (36.4 * p1), with
p1 = 2 tan(35 deg) / canvas_px (pixel size at 1 m). For a 1600 px tall canvas: D_open = 14.3 e, D_mean = 31.4 e.

The whole figure: the head top at phi m; the hat top (1.70 m) is 1.05 phi; the shoulders at 1.01 m are one block.
"""
import json, math, sys
import numpy as np

PHI = (1 + 5 ** 0.5) / 2
CANVAS_PX = 1600   # a phone canvas's height in device pixels (800 CSS px at 2x)
P1 = 2 * math.tan(math.radians(35)) / CANVAS_PX   # pixel size at 1 m, FOV 70 deg (rocket.js)


def dims(pr):
    """(least thickness, length, description) in the units of the primitive"""
    k = pr['kind']
    if k == 'sphere':
        return 2 * pr['r'], 2 * pr['r']
    if k in ('ellipsoid',):
        r = sorted(pr['radii']); return 2 * r[0], 2 * r[2]
    if k == 'dome':
        r = pr['radii']; return min(2 * r[0], 2 * r[1], r[2]), max(2 * r[0], 2 * r[1], r[2])
    if k == 'capsule':
        L = float(np.linalg.norm(np.subtract(pr['b'], pr['a']))); return 2 * pr['r'], L + 2 * pr['r']
    if k in ('roundcone', 'cappedcone'):
        L = float(np.linalg.norm(np.subtract(pr['b'], pr['a'])))
        t = 2 * min(pr['ra'], pr['rb'])
        return min(t, L) if k == 'cappedcone' else t, max(L + (pr['ra'] + pr['rb'] if k == 'roundcone' else 0), 2 * max(pr['ra'], pr['rb']))
    if k == 'roundbox':
        h = sorted(pr['half']); return 2 * h[0], 2 * h[2]
    if k == 'torus':
        return 2 * pr['minor'], 2 * (pr['major'] + pr['minor'])
    if k == 'dish':
        return pr['t'], 2 * pr['r_out']
    raise ValueError(k)


def level_of(t):
    return int(round(math.log(1.0 / t, PHI)))


def table(prims):
    rows = []
    for pr in prims:
        if pr['part'] == 'head':
            continue
        t, L = dims(pr)
        k = level_of(t)
        e = PHI ** -k
        rows.append(dict(part=pr['part'], group=pr['group'], kind=pr['kind'], thickness_m=round(t, 4), length_m=round(L, 4),
                         level=k, unit_m=round(e, 4), units_along=round(L / e, 1), fill_level=k + 4,
                         fill_unit_m=round(PHI ** -(k + 4), 4)))
    return rows


# the parts as the body is read (several primitives make one part)
PART_OF = [
    ('hat brim', ('hat_brim',)), ('hat brim lip', ('hat_brim_lip',)), ('hat crown', ('hat_crown',)), ('hat band', ('hat_band',)),
    ('neck', ('neck',)), ('collar', ('collar',)), ('chest', ('chest',)), ('shoulder yoke', ('yoke',)), ('waist', ('waist',)),
    ('hips', ('hips',)), ('shoulders', ('shoulder_',)), ('upper arms', ('upper_arm_',)), ('forearms', ('forearm_',)),
    ('cuffs', ('cuff_',)), ('glove palms', ('glove_right_palm', 'glove_left_palm')), ('glove fingers', ('glove_right_finger', 'glove_left_finger')),
    ('glove thumbs', ('glove_right_thumb', 'glove_left_thumb')), ('thighs', ('thigh_',)), ('flared trousers (knee to hem)', ('flare_',)),
    ('shoes', ('shoe_',)), ('guitar body (bouts and waist)', ('guitar_lower_bout', 'guitar_upper_bout', 'guitar_waist')),
    ('guitar sound hole', ('guitar_soundhole',)), ('guitar bridge', ('guitar_bridge',)), ('guitar neck', ('guitar_neck',)),
    ('guitar headstock', ('guitar_head',)), ('guitar tuners', ('guitar_tuner',)), ('guitar strap', ('strap_',)),
]


PAINTED = {'guitar sound hole': 'the guitar body (level 5)', 'guitar bridge': 'the guitar body (level 5)'}


def summary(prims):
    rows = table(prims)
    out = []
    for name, prefixes in PART_OF:
        rr = [r for r in rows if any(r['part'] == p or (p.endswith('_') and r['part'].startswith(p)) or (r['part'].startswith(p) and r['part'][len(p):].isdigit()) or (r['part'].startswith(p) and r['part'][len(p):] in ('_taper','_dome','_1r','_1l','_2r','_2l','_3r','_3l')) for p in prefixes)]
        if not rr:
            continue
        t = min(r['thickness_m'] for r in rr); L = max(r['length_m'] for r in rr)
        k = level_of(t)
        painted = name in PAINTED
        out.append(dict(part=name, primitives=[r['part'] for r in rr], thickness_m=round(t, 4), length_m=round(L, 4), level=k,
                        unit_m=round(PHI ** -k, 4), units_along=round(L / PHI ** -k, 1), ladder_level=2 - k,
                        fill_unit_m=round(PHI ** -k / 8, 4),
                        drawn_within_m=round(PHI ** -k / (80 * P1), 2), mean_beyond_m=round(PHI ** -k / (36.4 * P1), 2),
                        build=('painted on the units of %s (it stands less than one of their units proud)' % PAINTED[name]) if painted else 'built'))
    return out


if __name__ == '__main__':
    prims = json.load(open(sys.argv[1]))['primitives'] if len(sys.argv) > 1 else None
    for r in summary(prims):
        print('%-32s t %.3f m  L %.3f m  k %2d (ladder %3d, unit %.4f m)  %5.1f units  fill %.4f m  drawn <%.2f m  mean >%.2f m'
              % (r['part'], r['thickness_m'], r['length_m'], r['level'], r['ladder_level'], r['unit_m'], r['units_along'], r['fill_unit_m'], r['drawn_within_m'], r['mean_beyond_m']))
