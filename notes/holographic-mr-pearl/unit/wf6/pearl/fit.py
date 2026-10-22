"""fit.py - fit the model's silhouette to cover 1, group by group (Nelder-Mead on 1 - IoU in a window, plus a
small weight on the whole figure so one group cannot spoil another). Progress is saved to fit_params.json
after every group (resumable). usage: python3 fit.py [rounds] [group ...]"""
import sys, json, os, time
import numpy as np
import pmodel as M, sil

HERE = os.path.dirname(os.path.abspath(__file__))
PF = os.path.join(HERE, 'fit_params.json')
POSE = {'FACE_YAW': 50.0}

GROUPS = {
    'hat': dict(box=(370, 300, 790, 612), params=[
        ('HAT_TIP', None, 2.0), ('HAT_DYAW', None, 4.0), ('CROWN_RB', None, 4.0), ('CROWN_R', None, 5.0),
        ('CROWN_H', None, 6.0), ('CROWN_ZM', None, 0.08), ('BRIM_R', None, 5.0), ('BRIM_DROOP', None, 4.0)]),
    'torso': dict(box=(430, 595, 760, 820), params=[
        ('YOKE', 0, 4), ('YOKE', 1, 4), ('YOKE', 2, 5), ('YOKE', 3, 4),
        ('CHEST', 0, 4), ('CHEST', 1, 6), ('CHEST', 2, 5),
        ('SH_R', 0, 5), ('SH_R', 1, 5), ('SH_L', 0, 5), ('SH_L', 1, 5), ('R_SH', None, 3),
        ('EL_R', 0, 5), ('EL_R', 1, 6), ('EL_L', 0, 5), ('EL_L', 1, 6), ('R_EL', None, 3)]),
    'hands': dict(box=(530, 660, 870, 880), params=[
        ('WR_R', 0, 5), ('WR_R', 1, 5), ('WR_L', 0, 5), ('WR_L', 1, 5), ('R_WR', None, 2),
        ('PALM', 0, 3), ('PALM', 2, 3), ('FINGER_R', None, 1.0), ('FINGER_L', None, 3.0)]),
    'guitar': dict(box=(425, 620, 960, 960), params=[
        ('G_TAIL', 0, 5), ('G_TAIL', 1, 5), ('G_ANG', None, 1.5), ('G_LEN', None, 8), ('G_RL', None, 5),
        ('G_RU', None, 5), ('G_WAIST', None, 5), ('G_NECK', None, 8), ('G_NECK_W', None, 2),
        ('G_HEAD', None, 6), ('G_HEAD_W', None, 3), ('G_TILT', None, 3)]),
    'shoes': dict(box=(440, 1060, 880, 1170), params=[
        ('SHOE', 0, 3), ('SHOE', 1, 5), ('SHOE', 2, 3), ('SHOE_FWD', None, 0.1),
        ('SHOE_YAW_R', None, 6), ('SHOE_YAW_L', None, 6), ('HEM_L', 1, 3), ('HEM_R', 1, 3)]),
    'legs': dict(box=(440, 820, 860, 1170), params=[
        ('HIP_R', 0, 4), ('HIP_L', 0, 4), ('HIP_R', 1, 5),
        ('KNEE_R', 0, 5), ('KNEE_R', 1, 8), ('KNEE_L', 0, 5), ('KNEE_L', 1, 8),
        ('HEM_R', 0, 5), ('HEM_R', 1, 3), ('HEM_L', 0, 5), ('HEM_L', 1, 3),
        ('R_THIGH', None, 3), ('R_KNEE', None, 3), ('R_HEM', None, 4),
        ('WAIST', 1, 6), ('WAIST', 2, 5), ('HIPS', 2, 5),
        ('SHOE', 0, 3), ('SHOE', 1, 5), ('SHOE_YAW_L', None, 6)]),
}


def load_params():
    if os.path.exists(PF):
        d = json.load(open(PF))
        return {k: (tuple(v) if isinstance(v, list) else v) for k, v in d.items()}
    return {}


def save_params(p):
    json.dump({k: (list(v) if isinstance(v, tuple) else v) for k, v in p.items()}, open(PF, 'w'), indent=1)


def get(p, name, idx):
    v = p.get(name, M.K0[name])
    return v if idx is None else v[idx]


def put(p, name, idx, val):
    if idx is None:
        p[name] = float(val)
    else:
        v = list(p.get(name, M.K0[name])); v[idx] = float(val); p[name] = tuple(v)


def objective(p, box, w_all=0.25):
    q = dict(p); q.update(POSE)
    prims, _ = M.build(q)
    s_box, _ = sil.iou(prims, box)
    s_all, _ = sil.iou(prims, (360, 290, 960, 1180))
    return (1 - s_box) + w_all * (1 - s_all), s_box, s_all


def nelder_mead(f, x0, steps, iters):
    n = len(x0)
    pts = [np.array(x0, float)] + [np.array(x0, float) + np.eye(n)[i] * steps[i] for i in range(n)]
    vals = [f(x) for x in pts]
    for it in range(iters):
        o = np.argsort(vals); pts = [pts[i] for i in o]; vals = [vals[i] for i in o]
        c = np.mean(pts[:-1], axis=0)
        xr = c + (c - pts[-1]); fr = f(xr)
        if fr < vals[0]:
            xe = c + 2 * (c - pts[-1]); fe = f(xe)
            pts[-1], vals[-1] = (xe, fe) if fe < fr else (xr, fr)
        elif fr < vals[-2]:
            pts[-1], vals[-1] = xr, fr
        else:
            xc = c + 0.5 * (pts[-1] - c); fc = f(xc)
            if fc < vals[-1]:
                pts[-1], vals[-1] = xc, fc
            else:
                pts = [pts[0]] + [pts[0] + 0.5 * (x - pts[0]) for x in pts[1:]]
                vals = [vals[0]] + [f(x) for x in pts[1:]]
    i = int(np.argmin(vals))
    return pts[i], vals[i]


def fit_group(p, gname, iters=None):
    g = GROUPS[gname]
    names = g['params']
    x0 = [get(p, n, i) for n, i, _ in names]
    steps = [s for _, _, s in names]
    def f(x):
        q = dict(p)
        for (n, i, _), v in zip(names, x):
            put(q, n, i, v)
        return objective(q, g['box'])[0]
    f0 = f(x0)
    xb, fb = nelder_mead(f, x0, steps, iters or 25 * len(names))
    if fb < f0:
        for (n, i, _), v in zip(names, xb):
            put(p, n, i, v)
    _, sb, sa = objective(p, g['box'])
    return f0, fb, sb, sa


if __name__ == '__main__':
    rounds = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    groups = sys.argv[2:] or ['hat', 'torso', 'guitar', 'hands', 'legs']
    p = load_params()
    t0 = time.time()
    _, _, s_all = objective(p, (0, 0, 10, 10))
    print('start: whole-figure IoU %.4f' % s_all, flush=True)
    for r in range(rounds):
        for gname in groups:
            f0, fb, sb, sa = fit_group(p, gname)
            save_params(p)
            print('round %d %-7s f %.4f -> %.4f   window IoU %.4f   figure IoU %.4f   (%.0fs)'
                  % (r + 1, gname, f0, fb, sb, sa, time.time() - t0), flush=True)
