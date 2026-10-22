"""pmodel.py - Holographic Mr Pearl as convex primitives (see prims.py), built in cover-1 pixel units and
converted to metres by S.

Frame (both units): x to his left (image right on the covers), y backward (he faces -y, toward the camera of
the covers), z up; feet at z = 0; the origin is on the ground directly under the head's centre (the body
stands under the head: holographic mode's "move the body there" puts this point under the hologram).

Cover-1 pixel (u, v) -> model (x, z) = (u - U0, V0 - v), with
    U0 = 581.18   the head centre's column (circle fit, wf5/material/py/head.json)
    V0 = 1160     the ground under the right trouser hem
and px -> m by S = (V0 - head top) / phi = 490.70 px/m: the top of the sphere stands at phi metres
(the block is 1 m, phi is the unit's ratio). Depth y is not visible on the covers; it is set by relations:
contact (guitar back on the belly, hands on the strings and the neck), equal lengths (both upper arms, both
forearms, both legs), and the torso's depth = DEPTH_RATIO of its width.
"""
import json, math, copy
import numpy as np
from prims import unit, frame_z, Rz, Rx, Ry, transform

PHI = (1 + 5 ** 0.5) / 2
U0, V0 = 581.18, 1160.0
HEAD_CV, HEAD_R_PX = 486.56, 120.54              # circle fit on cover 1 (rms 1.0 px)
S = (V0 - (HEAD_CV - HEAD_R_PX)) / PHI            # 490.70 px per metre


def P(u, v, y=0.0):
    """cover-1 pixel (+ depth in px) -> model px"""
    return np.array([u - U0, y, V0 - v], float)


# ============================================================== parameters (px unless noted)
K0 = dict(
    # ---- head (fixed by the circle fit, not fitted) and its painted eyes
    FACE_YAW=0.0,          # pose: 0 at rest; cover 1: 50, cover 2: 45 (eye midpoint)
    EYE_SEP=29.3,          # deg between the eye centres (cover 1 29.3-29.7, cover 2 28.7-29.4)
    EYE_EL=0.0,            # deg above the equator (measured +1.2 / +0.2)
    EYE_HW=0.080,          # half-width, units of R, tangent plane (c1 0.0775, c2 0.0821)
    EYE_HH=0.220,          # half-height, units of R (c1 0.220, c2 0.219)
    # ---- hat: rests where the head's section equals the crown opening
    HAT_TIP=33.0,          # deg, pushed straight back from the face
    HAT_DYAW=3.0,          # deg, lean direction off straight-back (fit)
    CROWN_RB=109.7,        # crown opening radius (= head section at the brim root)
    CROWN_R=87.1,          # crown radius where the dome starts
    CROWN_H=101.0,         # crown height above the brim root
    CROWN_ZM=0.44,         # straight taper over this fraction of the height, dome above
    BRIM_R=194.5,          # brim outer radius
    BRIM_DROOP=12.0,       # rim this far below the root plane (spherical dish)
    BRIM_T=5.0,            # brim thickness
    LIP=3.2,               # rolled edge (torus minor radius)
    # ---- torso
    DEPTH_RATIO=0.72,      # torso depth / width
    COLLAR=(589.0, 632.0, 603.0, 31.0, 27.0),   # u, v_bottom, v_top, r_bottom, r_top
    CHEST=(592.0, 735.0, 82.0, 106.0),           # u, v, rx, rz
    YOKE=(598.0, 668.0, 92.0, 35.0),             # shoulder yoke: u, v, rx, rz
    WAIST=(610.0, 835.0, 76.0, 61.0),
    HIPS=(624.0, 852.0, 75.0, 36.0),
    # ---- arms (joints in cover-1 px; elbow depth solved by equal lengths)
    SH_R=(512.0, 670.0), SH_L=(684.0, 674.0), R_SH=28.0,
    EL_R=(468.0, 742.0), EL_L=(702.0, 790.0), R_EL=24.0,
    WR_R=(566.0, 781.0), WR_L=(768.0, 772.0), R_WR=21.0,
    CUFF_R_EXTRA=2.5, CUFF_LEN=16.0,
    # ---- hands (gloves): palm centre offset along the forearm, radii, fingers
    PALM=(19.0, 14.0, 21.0), FINGER_R=8.0, FINGER_L=22.0,
    # ---- legs
    HIP_R=(578.0, 856.0), HIP_L=(668.0, 856.0),
    KNEE_R=(566.0, 990.0), KNEE_L=(700.0, 985.0),
    HEM_R=(551.0, 1158.0), HEM_L=(742.0, 1142.0),
    R_THIGH=36.0, R_KNEE=38.0, R_HEM=72.0,
    SHOE=(30.0, 64.0, 22.0),                     # half width, half length, half height
    SHOE_YAW_R=-8.0, SHOE_YAW_L=58.0,   # each foot turned out: the right toward -x, the left toward +x
    SHOE_FWD=0.35,                       # toe out of the hem, fraction of the shoe's half-length
    # ---- guitar (an acoustic: two bouts and a waist, neck, headstock 3+3)
    G_TAIL=(443.0, 872.0), G_ANG=25.5, G_FWD=5.0, G_TILT=14.0,
    G_LEN=232.0, G_RL=92.0, G_RU=72.0, G_WAIST=58.0, G_T=46.0,
    G_NECK=225.0, G_NECK_W=25.0, G_HEAD=84.0, G_HEAD_W=40.0,
)


def eye_dirs(K, face):
    """unit vectors of the two eye centres for a face direction 'face' (horizontal unit vector)"""
    out = []
    for sgn in (-1, 1):   # -1: his right eye (nearer the face line toward his right), +1: his left eye
        a = math.radians(sgn * K['EYE_SEP'] / 2)
        f = Rz(math.degrees(a)) @ face     # rotate toward his left for +
        e = math.radians(K['EYE_EL'])
        out.append(unit(f * math.cos(e) + np.array([0, 0, math.sin(e)])))
    return out


def face_dir(K):
    """the face's direction: -y at rest, turned to his left (toward +x) by FACE_YAW"""
    a = math.radians(K['FACE_YAW'])
    return np.array([math.sin(a), -math.cos(a), 0.0])


class Builder:
    def __init__(self):
        self.prims = []

    def add(self, part, group, kind, **g):
        d = dict(part=part, group=group, kind=kind)
        for k, v in g.items():
            if isinstance(v, np.ndarray):
                v = v.tolist()
            d[k] = v
        self.prims.append(d)
        return d


def head_and_hat(B, K, C, R, hat_on_head=True, hat_offset=np.zeros(3)):
    f = face_dir(K)
    B.add('head', 'pearl', 'sphere', c=C, r=R)
    # the hat: its axis leans back from the face by HAT_TIP (lean direction -f turned by HAT_DYAW)
    back = Rz(K['HAT_DYAW']) @ (-f)
    ax = unit(np.array([0, 0, 1.0]) * math.cos(math.radians(K['HAT_TIP'])) + back * math.sin(math.radians(K['HAT_TIP'])))
    Rh = frame_z(ax, hint=-f)
    rb = K['CROWN_RB']
    h = math.sqrt(max(R * R - rb * rb, 0.0))       # the crown's opening circle lies on the sphere
    root = C + ax * h + hat_offset
    H, zm, cr = K['CROWN_H'], K['CROWN_ZM'], K['CROWN_R']
    z0 = H * zm
    B.add('hat_crown_taper', 'hat', 'cappedcone', a=root - ax * 2.0, b=root + ax * z0, ra=rb + 1.5, rb=cr)
    B.add('hat_crown_dome', 'hat', 'dome', c=root + ax * z0, R=Rh, radii=[cr, cr, H - z0])
    B.add('hat_band', 'band', 'cappedcone', a=root + ax * 1.0, b=root + ax * min(14.0, z0 * 0.9),
          ra=rb + 3.0, rb=rb + 3.0 + (cr - rb) * min(14.0, z0 * 0.9) / max(z0, 1e-6))
    Rb, dr = K['BRIM_R'], max(K['BRIM_DROOP'], 0.05)
    Rs = (Rb * Rb + dr * dr) / (2 * dr)
    B.add('hat_brim', 'hat', 'dish', c=root, R=Rh, Rs=Rs, t=K['BRIM_T'], r_in=rb - 4.0, r_out=Rb)
    drop = Rs - math.sqrt(Rs * Rs - Rb * Rb)
    B.add('hat_brim_lip', 'hat', 'torus', c=root - ax * drop, R=Rh, major=Rb, minor=K['LIP'])
    return dict(axis=ax, root=root, Rs=Rs, h=h)


def solve_elbow_depths(K, wr_y_R, wr_y_L):
    """equal upper arms and equal forearms (his arms are one length): elbow depths yR, yL and the lengths.
    Shoulders at y = 0, wrists at the given depths. With projected lengths dR, dL (upper) and eR, eL (fore):
        dR^2 + yR^2 = dL^2 + yL^2            and      eR^2 + (yR - wR)^2 = eL^2 + (yL - wL)^2
    solved by a 1D scan over yR; of the solutions, the one with the shortest arms is taken."""
    SR, SL = P(*K['SH_R']), P(*K['SH_L'])
    ER0, EL0 = P(*K['EL_R']), P(*K['EL_L'])
    WR, WL = P(*K['WR_R'], wr_y_R), P(*K['WR_L'], wr_y_L)
    pr = lambda a, b: float(np.hypot(a[0] - b[0], a[2] - b[2]))
    dR, dL, eR, eL = pr(SR, ER0), pr(SL, EL0), pr(ER0, WR), pr(EL0, WL)
    yR = np.linspace(-260.0, 260.0, 4161)
    q = dR * dR - dL * dL + yR * yR
    sols = []
    for sgn in (-1.0, 1.0):
        ok = q >= 0
        yL = sgn * np.sqrt(np.where(ok, q, 0.0))
        g = eR * eR + (yR - wr_y_R) ** 2 - eL * eL - (yL - wr_y_L) ** 2
        g = np.where(ok, g, np.nan)
        idx = np.nonzero((g[:-1] * g[1:] <= 0) & np.isfinite(g[:-1]) & np.isfinite(g[1:]))[0]
        for i in idx:
            t = g[i] / (g[i] - g[i + 1]) if g[i] != g[i + 1] else 0.0
            y1 = yR[i] + t * (yR[i + 1] - yR[i])
            y2 = sgn * np.sqrt(max(dR * dR - dL * dL + y1 * y1, 0.0))
            Lu = float(np.hypot(dR, y1)); Lf = float(np.hypot(eR, y1 - wr_y_R))
            sols.append((Lu + Lf, y1, y2, Lu, Lf))
    if not sols:
        return 0.0, 0.0, None, None
    best = min(sols)
    return best[1], best[2], best[3], best[4]


def build(k=None, hat_on_head=True, head_lift=0.0, with_head=True, with_hat=True, hat_lift=None):
    """Mr Pearl in cover-1 px. head_lift (px) raises the head (holographic mode); hat rides with the head when
    hat_on_head, else stays where it was on the body. Returns (prims, info)."""
    K = dict(K0)
    if k:
        K.update(k)
    B = Builder()
    info = {}
    C0 = np.array([0.0, 0.0, V0 - HEAD_CV])
    R = HEAD_R_PX
    C = C0 + np.array([0, 0, head_lift])
    # ------------------------------------------------ head and hat
    if with_head or with_hat:
        B2 = Builder()
        hi = head_and_hat(B2, K, C0, R)
        lift_hat = head_lift if hat_on_head else (0.0 if hat_lift is None else hat_lift)
        for pr in B2.prims:
            if pr['part'] == 'head':
                if with_head:
                    B.prims.append(transform(pr, np.eye(3), [0, 0, head_lift]))
            elif with_hat:
                B.prims.append(transform(pr, np.eye(3), [0, 0, lift_hat]))
        info['hat'] = dict(axis=hi['axis'].tolist(), root=(hi['root'] + [0, 0, lift_hat]).tolist(), Rs=hi['Rs'], h=hi['h'])
    info['head'] = dict(c=C.tolist(), r=R, face=face_dir(K).tolist(),
                        eyes=[e.tolist() for e in eye_dirs(K, face_dir(K))])
    # ------------------------------------------------ neck and collar
    u, vb, vt, rb_, rt_ = K['COLLAR']
    B.add('neck', 'neck', 'cappedcone', a=P(u, vb + 6), b=C0 + np.array([0, 0, -R * 0.80]), ra=17.0, rb=17.0)
    B.add('collar', 'jacket', 'cappedcone', a=P(u, vb), b=P(u, vt), ra=rb_, rb=rt_)
    # ------------------------------------------------ torso (depth = DEPTH_RATIO x width)
    dr = K['DEPTH_RATIO']
    cu, cv, crx, crz = K['CHEST']
    chest_depth = crx * dr
    for name, key in (('chest', 'CHEST'), ('yoke', 'YOKE'), ('waist', 'WAIST')):
        uu, vv, rx, rz = K[key]
        ry = rx * dr
        if name == 'yoke':
            # the yoke is the chest's own top: as deep as the chest is at the yoke's height (no ridge in front)
            f = min(abs(vv - cv) / crz, 0.95)
            ry = min(ry, chest_depth * math.sqrt(1 - f * f))
        B.add(name, 'jacket', 'ellipsoid', c=P(uu, vv), R=np.eye(3), radii=[rx, ry, rz])
    uu, vv, rx, rz = K['HIPS']
    B.add('hips', 'trousers', 'ellipsoid', c=P(uu, vv), R=np.eye(3), radii=[rx, rx * dr, rz])
    chest_front = -K['WAIST'][2] * dr          # the belly's front plane (the guitar's back rests here)
    # ------------------------------------------------ guitar (placed first: the hands are set on it)
    g = guitar(B, K, chest_front)
    info['guitar'] = {k_: (v.tolist() if isinstance(v, np.ndarray) else v) for k_, v in g.items() if k_ != 'G'}
    # wrists: the strumming wrist sits over the top at the right hand, the fretting wrist in front of the neck
    top_y = g['top_y_at']
    wr_y_R = top_y(P(*K['WR_R'])) - K['PALM'][1] * 1.6
    wr_y_L = top_y(P(*K['WR_L'])) - K['PALM'][1] * 0.6
    yR, yL, L_ua, L_fa = solve_elbow_depths(K, wr_y_R, wr_y_L)
    info['arms'] = dict(elbow_y=[yR, yL], upper_arm=L_ua, forearm=L_fa)
    # ------------------------------------------------ arms
    for side, sh, el, wr, wy, ey in (('right', 'SH_R', 'EL_R', 'WR_R', wr_y_R, yR), ('left', 'SH_L', 'EL_L', 'WR_L', wr_y_L, yL)):
        Sp, Ep, Wp = P(*K[sh]), P(*K[el], ey), P(*K[wr], wy)
        B.add('shoulder_' + side, 'jacket', 'sphere', c=Sp, r=K['R_SH'])
        B.add('upper_arm_' + side, 'jacket', 'roundcone', a=Sp, b=Ep, ra=K['R_SH'] * 0.96, rb=K['R_EL'])
        B.add('forearm_' + side, 'jacket', 'roundcone', a=Ep, b=Wp, ra=K['R_EL'], rb=K['R_WR'])
        d = unit(Wp - Ep)
        B.add('cuff_' + side, 'jacket', 'cappedcone', a=Wp - d * K['CUFF_LEN'], b=Wp, ra=K['R_WR'] + K['CUFF_R_EXTRA'],
              rb=K['R_WR'] + K['CUFF_R_EXTRA'] * 1.4)
        glove(B, K, side, Wp, d, g)
    # ------------------------------------------------ legs (equal length: the left foot's depth follows)
    legs(B, K, info)
    strap(B, K, g)
    return B.prims, info


def guitar(B, K, chest_front):
    ang, fwd, tilt = math.radians(K['G_ANG']), math.radians(K['G_FWD']), math.radians(K['G_TILT'])
    a = unit([math.cos(ang), -math.tan(fwd), math.sin(ang)])          # long axis, toward the headstock
    n0 = np.array([0, -1.0, 0]); n0 = unit(n0 - np.dot(n0, a) * a)
    b0 = np.cross(a, n0)
    n = unit(n0 * math.cos(tilt) - b0 * math.sin(tilt))                 # top's normal: toward the camera, up a little
    b = np.cross(n, a)
    Rg = np.c_[a, b, n]
    T = K['G_T']
    tail = P(*K['G_TAIL'])
    # the back of the guitar rests on the belly: back plane at y = chest_front - 2 at the waist of the guitar
    tail[1] = 0.0
    G = lambda s, w=0.0, h=0.0: tail + a * s + b * w + n * h
    probe = G(K['G_LEN'] * 0.5, 0, -T / 2)
    tail[1] += (chest_front - 2.0) - probe[1]
    Lb, rl, ru = K['G_LEN'], K['G_RL'], K['G_RU']
    B.add('guitar_lower_bout', 'guitar', 'cappedcone', a=G(rl, 0, -T / 2), b=G(rl, 0, T / 2), ra=rl, rb=rl)
    B.add('guitar_upper_bout', 'guitar', 'cappedcone', a=G(Lb - ru, 0, -T / 2), b=G(Lb - ru, 0, T / 2), ra=ru, rb=ru)
    wl = (Lb - ru) - rl
    B.add('guitar_waist', 'guitar', 'roundbox', c=G(rl + wl / 2), R=Rg, half=[wl / 2 + 10, K['G_WAIST'], T / 2], round=4.0)
    B.add('guitar_soundhole', 'dark', 'cappedcone', a=G(Lb - ru - 4, 0, T / 2 - 0.5), b=G(Lb - ru - 4, 0, T / 2 + 0.8), ra=21.0, rb=21.0)
    B.add('guitar_bridge', 'dark', 'roundbox', c=G(rl - 12, 0, T / 2 + 1.5), R=Rg, half=[6.0, 34.0, 2.5], round=1.0)
    Ln, nw = K['G_NECK'], K['G_NECK_W']
    B.add('guitar_neck', 'fretboard', 'roundbox', c=G(Lb + Ln / 2 - 8, 0, T / 2 - 7), R=Rg, half=[Ln / 2 + 8, nw / 2, 7.0], round=3.0)
    Lh, hw = K['G_HEAD'], K['G_HEAD_W']
    hc = G(Lb + Ln + Lh / 2, 0, T / 2 - 9)
    B.add('guitar_head', 'fretboard', 'roundbox', c=hc, R=Rg, half=[Lh / 2, hw / 2, 4.5], round=2.5)
    for kk in range(3):
        for sgn in (-1, 1):
            p0 = G(Lb + Ln + 16 + kk * 24, sgn * (hw / 2), T / 2 - 9)
            B.add('guitar_tuner_%d%s' % (kk + 1, 'l' if sgn > 0 else 'r'), 'tuner', 'capsule', a=p0, b=p0 + b * sgn * 9.0, r=4.2)
    top_plane_c = G(0, 0, T / 2)

    def top_y_at(p):
        """depth (y) of the guitar's top surface (plane) at the screen point of p"""
        # solve for y: (p + (0,t,0) - top_plane_c) . n = 0
        return p[1] + (np.dot(top_plane_c - p, n)) / n[1]
    return dict(a=a, b=b, n=n, R=Rg, tail=tail, G=G, top_y_at=top_y_at, neck_c=G(Lb + Ln / 2, 0, T / 2 - 7))


def glove(B, K, side, W, d, g):
    """a puffy cartoon glove at wrist W, forearm direction d"""
    pa, pb, pc = K['PALM']
    n = g['n']
    if side == 'right':
        # strumming: the hand continues the forearm over the top, fingers curl down onto the strings
        c = W + d * pc * 0.9
        Rp = frame_z(d, hint=-n)
        B.add('glove_right_palm', 'glove', 'ellipsoid', c=c, R=Rp, radii=[pa, pb, pc])
        down = unit(np.cross(d, n))        # across the strings, toward the floor side of the guitar
        if down[2] > 0:
            down = -down
        for i in range(4):
            base = c + d * (pc * 0.55) + down * (-pa * 0.75 + i * pa * 0.5) - n * 2.0
            tip = base + unit(d * 0.35 + n * 0.85 + down * 0.15) * (K['FINGER_L'] * 0.8)
            tip = base + unit(d * 0.6 - (-n) * 0.0 + down * 0.25) * K['FINGER_L']
            B.add('glove_right_finger%d' % (i + 1), 'glove', 'capsule', a=base, b=tip, r=K['FINGER_R'])
        tb = c - down * pa * 0.9 - n * 4.0
        B.add('glove_right_thumb', 'glove', 'capsule', a=tb, b=tb + unit(d * 0.9 - down * 0.3) * K['FINGER_L'] * 0.95,
              r=K['FINGER_R'] * 1.08)
    else:
        # fretting: palm under the neck, fingers over the fretboard, thumb above the neck
        c = W + d * pc * 0.9
        Rp = frame_z(d, hint=-n)
        B.add('glove_left_palm', 'glove', 'ellipsoid', c=c, R=Rp, radii=[pa, pb, pc])
        a_ = g['a']; bdir = g['b']             # b: across the neck, toward its upper (bass) edge
        for i in range(4):
            base = c + d * (pc * 0.5) - a_ * (i - 1.5) * K['FINGER_R'] * 2.05
            tip = base + unit(bdir * 0.85 + d * 0.3 - n * 0.2) * K['FINGER_L']
            B.add('glove_left_finger%d' % (i + 1), 'glove', 'capsule', a=base, b=tip, r=K['FINGER_R'])
        tb = c + bdir * pb * 0.6 + n * 6.0
        B.add('glove_left_thumb', 'glove', 'capsule', a=tb, b=tb + unit(bdir * 0.7 + d * 0.5) * K['FINGER_L'] * 0.9,
              r=K['FINGER_R'] * 1.08)


def legs(B, K, info):
    HR, HL = P(*K['HIP_R']), P(*K['HIP_L'])
    KR, KL = P(*K['KNEE_R']), P(*K['KNEE_L'])
    BR, BL = P(*K['HEM_R']), P(*K['HEM_L'])
    # equal legs: hip->knee->hem lengths of the left equal the right's; the right leg is in the frontal plane,
    # the left knee and hem move in depth to make up its shorter projection (solved in closed form)
    LuR, LlR = np.linalg.norm(KR - HR), np.linalg.norm(BR - KR)
    du = np.linalg.norm(KL - HL); dl = np.linalg.norm(BL - KL)
    yk = -math.sqrt(max(LuR * LuR - du * du, 0.0))          # the left knee comes forward
    KL = KL + np.array([0, yk, 0])
    dl2 = np.linalg.norm((BL - KL)[[0, 2]])
    yb = yk + (-1) * 0.0
    # the hem keeps the lower-leg length: forward or back of the knee, whichever is nearer the body plane
    s = math.sqrt(max(LlR * LlR - dl2 * dl2, 0.0))
    yb = yk + s if abs(yk + s) < abs(yk - s) else yk - s
    BL = BL + np.array([0, yb, 0])
    info['legs'] = dict(thigh=LuR, shin=LlR, left_knee_y=yk, left_hem_y=yb)
    for side, Hp, Kp, Bp in (('right', HR, KR, BR), ('left', HL, KL, BL)):
        B.add('thigh_' + side, 'trousers', 'roundcone', a=Hp, b=Kp, ra=K['R_THIGH'], rb=K['R_KNEE'])
        B.add('flare_' + side, 'trousers', 'cappedcone', a=Kp, b=Bp, ra=K['R_KNEE'], rb=K['R_HEM'])
    # shoes under the hems: sole on the ground (the left on its rock, at its hem's height)
    hw, hl, hh = K['SHOE']
    for side, Bp, yaw in (('right', BR, K['SHOE_YAW_R']), ('left', BL, K['SHOE_YAW_L'])):
        # the toe comes out of the hem along the foot's own direction (yaw > 0 turns it to his left, +x)
        toe = Rz(yaw) @ np.array([0.0, -1.0, 0.0])
        c = Bp + toe * hl * K['SHOE_FWD'] + np.array([0, 0, hh * 0.95])
        B.add('shoe_' + side, 'shoe', 'ellipsoid', c=c, R=Rz(yaw), radii=[hw, hl, hh])


def strap(B, K, g):
    """the strap lies on him: from the neck heel up over his left shoulder, across his back, round his right hip to
    the tail button (points on the jacket's surface, 5 px proud)"""
    G = g['G']; Lb = K['G_LEN']
    dr = K['DEPTH_RATIO']
    yu, yv, yrx, yrz = K['YOKE']
    cu, cv, crx, crz = K['CHEST']
    wu, wv, wrx, wrz = K['WAIST']
    heel = G(Lb + 10, -K['G_NECK_W'] * 0.2, -K['G_T'] / 2 + 4)
    over = P(yu + yrx * 0.45, yv - yrz * 0.92 - 5, 0.0)                 # on top of his left shoulder
    back_hi = P(yu + yrx * 0.30, yv + 10, crx * dr * 0.80 + 5)          # down his back
    back_mid = P(cu - crx * 0.15, cv + 20, crx * dr + 5)
    side = P(wu - wrx - 5, wv, wrx * dr * 0.25)                          # round his right hip
    tailb = G(0, 0, 0)
    pts = [heel, over, back_hi, back_mid, side, tailb]
    for i, (p0, p1) in enumerate(zip(pts[:-1], pts[1:])):
        B.add('strap_%d' % (i + 1), 'strap', 'capsule', a=p0, b=p1, r=5.0)


# ============================================================== conversion

def to_metres(prims):
    out = []
    for pr in prims:
        q = transform(pr, np.eye(3), [0, 0, 0], 1.0 / S)
        for key in ('c', 'a', 'b'):
            if key in q:
                q[key] = [round(v, 5) for v in q[key]]
        for key in ('r', 'ra', 'rb', 'round', 'major', 'minor', 'Rs', 't', 'r_in', 'r_out'):
            if key in q:
                q[key] = round(q[key], 5)
        for key in ('radii', 'half'):
            if key in q:
                q[key] = [round(v, 5) for v in q[key]]
        if 'R' in q:
            q['R'] = [[round(v, 6) for v in row] for row in q['R']]
        out.append(q)
    return out


GROUP_COLOURS = {
    'pearl': (0.93, 0.92, 0.96), 'eye': (0.05, 0.05, 0.07), 'hat': (0.95, 0.86, 0.66),
    'band': (0.72, 0.62, 0.78), 'jacket': (0.80, 0.84, 0.97), 'trousers': (0.78, 0.93, 0.95),
    'glove': (0.99, 0.99, 0.99), 'shoe': (0.97, 0.80, 0.86), 'guitar': (0.93, 0.70, 0.42),
    'fretboard': (0.33, 0.22, 0.16), 'dark': (0.12, 0.10, 0.10), 'tuner': (0.85, 0.80, 0.55),
    'strap': (0.10, 0.10, 0.12), 'neck': (0.25, 0.22, 0.25),
}

if __name__ == '__main__':
    prims, info = build({'FACE_YAW': 50.0})
    print(len(prims), 'primitives')
    print(json.dumps({k: v for k, v in info.items() if k in ('arms', 'legs')}, indent=1))
    print('S = %.3f px/m, R = %.4f m, head centre z = %.4f m' % (S, HEAD_R_PX / S, (V0 - HEAD_CV) / S))
