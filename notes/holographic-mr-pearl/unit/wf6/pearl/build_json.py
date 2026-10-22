"""build_json.py - write pearl.json: Holographic Mr Pearl as primitives in metres, with the relation that sets each
property, the covers' measurements and disagreements, poses, holographic mode, material, palette, levels."""
import json, math, os
import numpy as np
import pmodel as M
from views import model_m
from fit import load_params
import levels as LV
import sil

HERE = os.path.dirname(os.path.abspath(__file__))
PHI = M.PHI
W = lambda *a: os.path.join(HERE, *a)


def r4(x):
    return [round(float(v), 4) for v in x]


RELATIONS = {
    'head': 'the one perfect sphere: centre and radius from a robust circle fit of the head outline on cover 1 (98 edge points, '
            'rms 1.0 px); never built from units; eyes painted on it',
    'hat_crown_taper': 'crown opening = the head\'s cross-section where the hat rests (its base circle lies on the sphere); '
                       'taper, dome radius and height fitted to the cover-1 silhouette',
    'hat_crown_dome': 'half-ellipsoid on the taper; radius and height fitted to the cover-1 silhouette',
    'hat_band': 'a band 14 px (cover 1) tall at the crown\'s foot, 3 px proud of it',
    'hat_brim': 'wide curved brim: a slice of a sphere (the rim droops by BRIM_DROOP at BRIM_R), at the crown\'s foot; radius '
                'and droop fitted to the cover-1 silhouette; axis tipped straight back from the face by HAT_TIP',
    'hat_brim_lip': 'the rolled edge both covers show round the brim',
    'neck': 'short dark neck inside the collar, up into the sphere; seen only as the dark gap under the head',
    'collar': 'stand-up band collar under the head (cover 1: 50 px wide, 29 px tall)',
    'chest': 'jacket chest; width and height fitted to the cover-1 silhouette; depth = DEPTH_RATIO x width',
    'yoke': 'shoulder yoke (the line from collar to shoulders); fitted; depth = DEPTH_RATIO x width',
    'waist': 'jacket waist behind the guitar; its front is the plane the guitar\'s back rests on',
    'hips': 'trouser seat where the legs part (cover 1 v 865)',
    'shoulder_': 'shoulder joints at y = 0 (the body plane); one radius for both (symmetry)',
    'upper_arm_': 'round cone shoulder -> elbow; both upper arms one length (the elbow depths are solved from it)',
    'forearm_': 'round cone elbow -> wrist; both forearms one length; the wrist rests on the guitar (right: over the top, '
                'left: in front of the neck)',
    'cuff_': 'sleeve cuff at the wrist',
    'glove_': 'puffy cartoon glove: palm ellipsoid along the forearm, four fingers and a thumb (right: strumming over the '
              'sound hole; left: fretting, fingers over the fretboard, thumb over the neck)',
    'thigh_': 'round cone hip -> knee; one thigh radius and knee radius for both legs (symmetry)',
    'flare_': 'flared bell-bottom, knee -> hem (capped cone), one hem radius for both legs; both legs one length (the left '
              'knee and hem depths are solved from it; where the fitted hem lies farther from the knee than the shin is long, the hem rises under its column until the shins are equal - check-pearl, 16 Oct: the left hem hangs 0.034 m over its shoe)',
    'shoe_': 'shoe under the hem, both soles on the ground (z = 0) whatever the hem height; the left turned out',
    'guitar_lower_bout': 'acoustic guitar body: lower bout; long axis and size fitted to the cover-1 silhouette; its back '
                         'rests on the belly',
    'guitar_upper_bout': 'upper bout', 'guitar_waist': 'the waist between the bouts',
    'guitar_soundhole': 'sound hole (cover 2 shows it; cover 1 hides it under the hand)', 'guitar_bridge': 'bridge',
    'guitar_neck': 'neck and fretboard, body to nut; length and width fitted', 'guitar_head': 'headstock; fitted',
    'guitar_tuner': 'tuners, three a side (both covers)',
    'strap_': 'strap from the neck heel over his left shoulder, down his back to the tail button (both covers show it '
              'crossing his chest to the left shoulder)',
}


PALETTE = [
    dict(hex='#9eb2ca', where='his pearl body colour under the film (PEARL_BASE, linear 0.343 0.447 0.590), fitted on the head'),
    dict(hex='#c0b4b0', where='the head seen whole (median, cover 1; cover 2 #b4aba8)'),
    dict(hex='#9c949e', where='the face centre, where the film is seen square-on (theta < 25 deg; cover 2 #97939b)'),
    dict(hex='#fefefe', where='the key highlight (top 1% lightness, both covers)'),
    dict(hex='#fff5c1', where='the cream rim, lower left, from the key light (theta > 62 deg; cover 2 #fffad4)'),
    dict(hex='#f6d9a3', where='the gold rim, upper right, from the setting sun (cover 2 #ead471)'),
    dict(hex='#737986', where='the dark mottle, thickest-film shade (bottom 5% lightness; cover 2 #6e737e)'),
    dict(hex='#7799ce', where='film blue (cover 1, 964 px of the head; cover 2 #6798d2)'),
    dict(hex='#8ee8f8', where='film cyan (cover 1; cover 2 #71e1f3)'),
    dict(hex='#a28ed0', where='film violet (cover 1; cover 2 #9183c2)'),
    dict(hex='#d998c6', where='film magenta-pink (cover 1; cover 2 #be769a)'),
    dict(hex='#f3b897', where='film peach-orange (cover 1; cover 2 #eaa883)'),
    dict(hex='#fadca3', where='film gold, the commonest film colour (cover 1, 1247 px; cover 2 #f1d88e)'),
    dict(hex='#dce9a4', where='film green, rarest (cover 1, 24 px; cover 2 #d1e190): second-order Newton green barely shows'),
    dict(hex='#281c16', where='the painted eyes, black glass (cover 1; cover 2 #241b19)'),
    dict(hex='#8b5029', where='the eyes\' amber glint (cover 1; cover 2 #845636)'),
    dict(hex='#7b8995', where='hat crown on cover 1 (median): the sky reflected in the film'),
    dict(hex='#d8ad7f', where='hat brim on cover 1 (median): the sunset reflected in the film'),
    dict(hex='#b7a8a0', where='jacket, cover 1 median (its base #c7ccd3)'),
    dict(hex='#c0b1b1', where='trousers, cover 1 median (base #b5adc0)'),
    dict(hex='#e3dab2', where='gloves, cover 1 median (base #fbffdf): cream, the least filmed part'),
    dict(hex='#9d8b8a', where='guitar body, cover 1 median (base #c7bdc6): the same film on the guitar'),
    dict(hex='#573e31', where='fretboard, neck and headstock (cover 1 median; plain dark gloss)'),
    dict(hex='#503f35', where='the strap (cover 1 median; plain dark gloss)'),
    dict(hex='#c8b3a4', where='tuners (cover 1 median)'),
    dict(hex='#473d38', where='sound hole and bridge (cover 2; cover 1 hides the hole under the hand)'),
]


def relation_of(part):
    for k in sorted(RELATIONS, key=len, reverse=True):
        if part.startswith(k):
            return RELATIONS[k]
    return ''


def main():
    p = load_params()
    K = dict(M.K0); K.update(p)
    rest = dict(p); rest['FACE_YAW'] = 0.0
    pm, head, info = model_m(rest)
    for q in pm:
        q['relation'] = relation_of(q['part'])
    c1 = dict(p); c1['FACE_YAW'] = 50.0
    pm1, head1, info1 = model_m(c1)
    hat1 = [q for q in pm1 if q['part'].startswith('hat_')]
    c2 = dict(p); c2['FACE_YAW'] = 45.0
    pm2, head2, info2 = model_m(c2)
    # silhouette scores (cover-1 pose)
    prims_px, _ = M.build(c1)
    s_all = sil.iou(prims_px, (360, 290, 960, 1180))[0]
    regions = {'hat+head': (370, 300, 790, 612), 'torso+arms': (430, 600, 960, 950), 'legs': (440, 900, 860, 1170), 'feet': (440, 1060, 880, 1170)}
    s_reg = {k: round(float(sil.iou(prims_px, b)[0]), 4) for k, b in regions.items()}
    eyes = json.load(open(W('meas', 'eyes.json')))
    bases = json.load(open(W('bases.json'))) if os.path.exists(W('bases.json')) else {}
    lv = LV.summary(pm)
    R = M.HEAD_R_PX / M.S
    hat_axis_rest = np.array(info['hat']['axis'])
    out = dict(
        name='Holographic Mr Pearl - the test form (wf6/pearl)',
        date='2026-10-16 (run 2; run 1 15 Oct)',
        frame='metres; z up; feet on z = 0; he faces -y; +x is his left (the covers\' image right); the origin is the ground '
              'point under the head\'s centre (the body stands under the head)',
        scale=dict(
            relation='the top of the sphere stands at phi metres (the block is 1 m, phi the unit\'s ratio); every other length is '
                     'its ratio to that on cover 1',
            px_per_m_cover1=round(M.S, 3), head_top_m=round(PHI, 4), cover1_ground_v=M.V0, cover1_head_column_u=M.U0,
            consequences=dict(head_centre_z=round((M.V0 - M.HEAD_CV) / M.S, 4), head_radius=round(R, 4),
                              hat_top_z=None, shoulder_joint_z=round((M.V0 - K['SH_R'][1]) / M.S, 4)),
            alternative='for a head top at 1.70 m multiply every length by 1.0507'),
        head=dict(
            kind='sphere', centre=r4(head['c']), radius=round(R, 4), relation=RELATIONS['head'],
            the_only_perfect_sphere=True,
            face_yaw_deg=dict(rest=0.0, cover1=50.0, cover2=45.0,
                              relation='the face line is the midpoint of the two eyes; turned toward his left on both covers; at '
                                       'rest it looks along -y'),
            eyes=dict(
                painted=True,
                shape='ellipse in the plane tangent to the sphere at the eye centre: (x/hw)^2 + (y/hh)^2 <= 1, x along the '
                      'horizontal tangent, y along the meridian (vertical)',
                half_width_R=K['EYE_HW'], half_height_R=K['EYE_HH'],
                half_width_m=round(K['EYE_HW'] * R, 4), half_height_m=round(K['EYE_HH'] * R, 4),
                width_m=round(2 * K['EYE_HW'] * R, 4), height_m=round(2 * K['EYE_HH'] * R, 4),
                separation_deg=K['EYE_SEP'], each_off_face_line_deg=K['EYE_SEP'] / 2, elevation_deg=K['EYE_EL'],
                spacing_m_chord=round(2 * R * math.sin(math.radians(K['EYE_SEP'] / 2)), 4),
                height_z_m=round((M.V0 - M.HEAD_CV) / M.S + R * math.sin(math.radians(K['EYE_EL'])), 4),
                centres_rest=[r4(e) for e in info['head']['eyes']],
                paint='#281c16 black glass (cover 2 #241b19), glint #8b5029',
                relation='both covers: on the equator (cover 1 +1.2 deg, cover 2 +0.2), 29.3 deg apart (c1 29.3-29.7, c2 '
                         '28.7-29.4), half-width 0.080 R (c1 0.0775, c2 0.0821), half-height 0.220 R (c1 0.2201, c2 0.2194), '
                         'measured from the nearer eye by moments of its dark pixels mapped onto the sphere',
                measured=eyes)),
        hat=dict(
            relation='rests on the head where the sphere\'s section equals the crown opening; pushed straight back from the face '
                     'by HAT_TIP; rides with the face\'s yaw',
            tip_deg=round(K['HAT_TIP'], 2), lean_off_straight_back_deg=round(K['HAT_DYAW'], 2),
            crown_opening_radius_m=round(K['CROWN_RB'] / M.S, 4),
            seat_height_above_centre_m=round(math.sqrt(max(M.HEAD_R_PX ** 2 - K['CROWN_RB'] ** 2, 0)) / M.S, 4),
            crown_radius_m=round(K['CROWN_R'] / M.S, 4), crown_height_m=round(K['CROWN_H'] / M.S, 4),
            crown_taper_fraction=round(K['CROWN_ZM'], 3),
            brim_radius_m=round(K['BRIM_R'] / M.S, 4), brim_droop_m=round(K['BRIM_DROOP'] / M.S, 4),
            brim_sphere_radius_m=round(info['hat']['Rs'] / M.S, 3), brim_thickness_m=round(K['BRIM_T'] / M.S, 4),
            axis_rest=r4(hat_axis_rest), axis_cover1=r4(info1['hat']['axis']),
            primitives_cover1=hat1),
        body=dict(
            depth_relations=['torso depth = %.2f x its width' % K['DEPTH_RATIO'],
                             'the guitar\'s back rests on the jacket\'s front (waist plane)',
                             'the right wrist sits over the guitar top, the left in front of the neck',
                             'both upper arms one length (%.3f m), both forearms one length (%.3f m): the elbows\' depths follow'
                             % (info['arms']['upper_arm'] / M.S, info['arms']['forearm'] / M.S),
                             'both legs one length (thigh %.3f m, shin %.3f m): the left knee and hem depths follow'
                             % (info['legs']['thigh'] / M.S, info['legs']['shin'] / M.S),
                             'paired parts share their sizes (bilateral symmetry); only the pose differs'],
            arms=dict(elbow_y_m=r4(np.array(info['arms']['elbow_y']) / M.S), upper_arm_m=round(info['arms']['upper_arm'] / M.S, 4),
                      forearm_m=round(info['arms']['forearm'] / M.S, 4)),
            legs={k: round(v / M.S, 4) for k, v in info['legs'].items()},
            guitar={k: (r4(v) if isinstance(v, list) else v) for k, v in info['guitar'].items() if k in ('a', 'b', 'n', 'tail')}),
        primitives=pm,
        primitive_kinds='sphere{c,r} ellipsoid{c,R,radii} capsule{a,b,r} roundcone{a,b,ra,rb} cappedcone{a,b,ra,rb} '
                        'roundbox{c,R,half,round} torus{c,R,major,minor} dome{c,R,radii: half-ellipsoid local z>=0} '
                        'dish{c,R,Rs,t,r_in,r_out: sphere radius Rs centred at c - Rs z_local, thickness t, cut to '
                        'r_in..r_out from the local z axis}; R = 3x3 rows, columns are the local axes (world = c + R local); '
                        'all convex; exact GLSL SDFs in gen_glsl.py (SDF_LIB)',
        poses=dict(
            rest='face yaw 0; the guitar pose (he always holds his guitar in the test form)',
            cover1=dict(face_yaw_deg=50.0, changes='eyes (paint) and hat turn with the face about the vertical through the head '
                                                   'centre; hat primitives in hat.primitives_cover1'),
            cover2=dict(face_yaw_deg=45.0)),
        holographic_mode=dict(
            rule='the head disengages and is the hologram; the headless body stays where it was, vulnerable; "move the body '
                 'there" brings it back under the head (the origin, the ground point under the head\'s centre, is where it goes)',
            lift_shown_m=round(2 * R, 4), lift_relation='one head diameter: the moment the head has cleared its seat',
            option_A=dict(name='the hat rides with the head', moves=['head', 'hat_*'], stays=['everything else'],
                          reads='the hologram keeps his silhouette (sphere and hat); the body is left bare-necked',
                          renders=['holo_A.png', 'render_holo_flat.png']),
            option_B=dict(name='the hat stays on the body', moves=['head'],
                          stays=['hat_* (falls onto the body: hat_settle.json)', 'everything else'],
                          hat_drop=json.load(open(W('hat_settle.json'))) if os.path.exists(W('hat_settle.json')) else None,
                          reads='the hologram is the pure sphere alone - nothing built rides with the one perfect form; with '
                                'the head gone nothing holds the hat, so it falls straight down until its hollow crown rests on '
                                'the bare neck, its brim over the shoulders: the body wears the hat where the head was',
                          variant_held='the hat held in the air exactly where it was (the run-2 render) is the other reading: it '
                                       'needs a rule that holds it, which nothing in the model gives',
                          renders=['holo_B.png', 'render_holo_flat.png'])),
        material=dict(glsl='pearl.glsl', function='vec3 pearl(vec3 n, vec3 v, vec3 l, vec3 base)',
                      bases=bases.get('report', {}),
                      bases_relation='each part\'s colour under the film is fitted so the material\'s median over that part\'s '
                                     'cover-1 pixels equals the part\'s measured median (fit_bases.py), its chroma capped at '
                                     'OKLab 0.08 (a base may be tinted, the film makes the colour); the hat, its band and the '
                                     'shoes take the jacket\'s base: cover 2 shows them as one pearl cloth, and on cover 1 the '
                                     'hat\'s fit is spoiled by the one-colour world (crown reflects sky #7b8995, brim sunset '
                                     '#d8ad7f) and the shoes show on 883 px only',
                      pattern=json.load(open(W('mat', 'flow_summary.json'))) if os.path.exists(W('mat', 'flow_summary.json')) else None,
                      webgl=json.load(open(W('gl', 'compile_check.json'))) if os.path.exists(W('gl', 'compile_check.json')) else None),
        palette=PALETTE,
        fit=dict(silhouette_iou_cover1=round(float(s_all), 4), regions=s_reg,
                 method='front orthographic silhouette (convex hulls) against the wf5 reference mask (sky mask for head and hat, '
                        'traced polygon for the body), group-wise Nelder-Mead (fit.py, fit_params.json)'),
        levels=dict(rule=LV.__doc__.strip(), parts=lv),
        covers=dict(
            cover1=dict(head_circle_px=[581.18, 486.56, 120.54], head_diameters_tall=3.29, face_yaw=50, eyes_sep=29.5),
            cover2=dict(head_circle_px=[596.42, 466.35, 139.40], head_diameters_tall=2.99, face_yaw=45, eyes_sep=29.0),
            disagreements=[
                'head size: cover 1 is 3.29 head-diameters tall to the head top, cover 2 is 2.99 (its head is 10% bigger '
                'against the body) - chose cover 1, the overlay reference; cover 2 would make R 0.2707 m at the same height',
                'face yaw: 50 deg (cover 1) vs 45 (cover 2) - a pose, not a form: the rest pose looks straight ahead',
                'eye size and spacing agree within the measurement (sep 29.3-29.7 vs 28.7-29.4 deg; half-width 0.0775 vs 0.0821 R)',
                'the eyes lean about 10 deg on both covers (more on the far eye); read as the covers\' camera above the head, '
                'since the artist calls them vertical: modelled vertical',
                'guitar: cover 1 shows an electro-acoustic with pickguard and the hole hidden by the hand; cover 2 an acoustic '
                'with a round sound hole - modelled as the acoustic with a sound hole; its long axis 25.5 (c1) vs 27.9 deg (c2) '
                '- fitted to cover 1',
                'the hat brim reads a little wider on cover 2 (1.63 R vs 1.55 R by the earlier study) - fitted to cover 1',
                'the covers are perspective pictures by an unknown lens; treated as orthographic (the head\'s outline is a '
                'circle to 1 px, so the lens is long)']),
    )
    from prims import hull_points
    Pz = np.array([[0, 0, 1.0], [1.0, 0, 0]])
    out['scale']['consequences']['hat_top_z'] = round(float(max(hull_points(q, Pz)[:, 0].max() for q in pm if q['part'].startswith('hat_'))), 4)
    out['scale']['consequences']['hat_top_z_cover1'] = round(float(max(hull_points(q, Pz)[:, 0].max() for q in pm1 if q['part'].startswith('hat_'))), 4)
    json.dump(out, open(W('pearl.json'), 'w'), indent=1)
    print('pearl.json: %d primitives, IoU %.4f' % (len(pm), s_all), s_reg)


if __name__ == '__main__':
    main()
