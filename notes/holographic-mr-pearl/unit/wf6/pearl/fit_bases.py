"""fit_bases.py - each part's colour under the film, set by its measured colour on cover 1.

For every group, the cover-1 pixels the model's front view gives to that group (cover-1 pose, eroded 3 px from
any break, inside the reference silhouette) give a measured median (OKLab). The group's base (linear RGB) is
fitted so that the pearl material's median over the same pixels, normals and pattern equals it. The head keeps
the fitted PEARL_BASE (it was fitted on the head itself). Dark parts (strap, fretboard, sound hole, bridge, tuners,
neck) take a plain dark gloss whose base is fitted the same way. -> bases.json, meas/bases_check.png"""
import json, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pmodel as M
from views import model_m
from render import ortho_camera, trace, pearl_shade, render_pearl, PEARL_BASE, DARK_GROUPS
sys.path.append('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py')
from colour import srgb_to_oklab, oklab_to_srgb, srgb_to_lin, lin_to_srgb
from fit import load_params

REF1 = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/pearl-1.png'
F5 = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/form/meas/'


def hexs(c):
    c = np.clip(np.asarray(c, float), 0, 1)
    return '#%02x%02x%02x' % tuple(int(round(x * 255)) for x in c)


C_MAX = 0.08     # a base may be tinted, not saturated: the film makes the colour


def limit_chroma(b):
    """clamp a linear-RGB base to OKLab chroma <= C_MAX (keeping its lightness and hue)"""
    lab = srgb_to_oklab(np.clip(lin_to_srgb(np.clip(b, 0, 1)), 0, 1))
    C = np.hypot(lab[1], lab[2])
    if C > C_MAX:
        lab = lab.copy(); lab[1:] *= C_MAX / C
        b = srgb_to_lin(np.clip(oklab_to_srgb(lab), 0, 1))
    return b


# one pearl cloth: cover 2 shows the hat, its band and the shoes in the suit's own film (same colours, same
# swirls); on cover 1 the hat's up-facing brim takes a warm reflection our one-colour world cannot give it, and the
# shoes show on 883 px at the hems -- so they take the jacket's base instead of a fit of their own
SAME_AS = {'hat': 'jacket', 'band': 'jacket', 'shoe': 'jacket'}

# parts hidden on cover 1 are measured where a cover shows them
ELSEWHERE = {
    'dark': ('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/pearl-2.png', (628, 792, 645, 801), None,
             'cover 2 sound hole (cover 1 hides it under the right glove)'),
    'neck': (REF1, (575, 603, 610, 616), 0.25, 'cover 1, the dark inside of the collar under the head (darkest quarter)'),
}


def erode(m, k=3):
    out = m.copy()
    for _ in range(k):
        o2 = out.copy()
        o2[1:, :] &= out[:-1, :]; o2[:-1, :] &= out[1:, :]; o2[:, 1:] &= out[:, :-1]; o2[:, :-1] &= out[:, 1:]
        out = o2
    return out


def main():
    p = load_params(); p['FACE_YAW'] = 50.0
    pm, head, info = model_m(p)
    ref = np.asarray(Image.open(REF1).convert('RGB')).astype(float) / 255
    H, W = ref.shape[:2]
    cam = ortho_camera((0, 1, 0), (0, 0, 1), M.S, W, H, (0, 0, 0), (M.U0, M.V0))
    tr = trace(pm, cam)
    o, d, depth, pid, nrm = tr
    pid2 = pid.reshape(H, W)
    refmask = np.load(F5 + 'ref_mask.npy')
    V = np.stack([cam['r'], cam['u'], -cam['f']])
    hc = np.asarray(head['c']); hr = head['r']
    groups = sorted(set(q['group'] for q in pm), key=lambda g: (g in SAME_AS, g))
    gid = np.array([pm[i]['group'] if i >= 0 else '' for i in pid])
    bases, report = {}, {}
    for g in groups:
        if g == 'pearl':
            continue
        m2 = (gid.reshape(H, W) == g)
        m2 = erode(m2, 3) & refmask
        idx = np.nonzero(m2.ravel())[0]
        where = 'cover 1, the model\'s own front-view pixels of this part'
        if g in ELSEWHERE:
            path, (x0, y0, x1, y1), q, where = ELSEWHERE[g]
            px = srgb_to_oklab(np.asarray(Image.open(path).convert('RGB')).astype(float)[y0:y1, x0:x1].reshape(-1, 3) / 255)
            if q is not None:
                px = px[px[:, 0] <= np.quantile(px[:, 0], q)]
            target = np.median(px, 0)
            if len(idx) < 30:
                idx = np.nonzero((gid == g))[0][:200]
        else:
            if len(idx) < 30:
                continue
            target = np.median(srgb_to_oklab(ref.reshape(-1, 3)[idx]), 0)
        if len(idx) == 0:
            b = srgb_to_lin(np.clip(oklab_to_srgb(target), 0, 1))
            bases[g] = b.round(4).tolist()
            report[g] = dict(pixels=0, measured=hexs(oklab_to_srgb(target)), where=where, base_linear=b.round(4).tolist(), base_srgb=hexs(lin_to_srgb(b)))
            print('%-10s (hidden) measured %s  base %s' % (g, report[g]['measured'], report[g]['base_srgb']), flush=True)
            continue
        pw = o[idx] + depth[idx, None] * d
        nv = nrm[idx] @ V.T
        if g in DARK_GROUPS:
            key = np.array([-0.91561, -0.34202, 0.21138]); sun = np.array([0.95616, 0.01745, 0.29233])
            lam = 0.3 + 0.9 * np.clip(nv @ key, 0, None) + 0.6 * np.clip(nv @ sun, 0, None)
            ndv = np.clip(nv[:, 2], 1e-4, 1); F = 0.04 + 0.96 * (1 - ndv) ** 5
            refl = F[:, None] * np.array([8.195, 3.052, 0.309]) * 0.04
            b = srgb_to_lin(np.clip(oklab_to_srgb(target), 0, 1))
            for _ in range(8):
                col = b[None] * lam[:, None] + refl
                med = np.median(srgb_to_oklab(np.clip(lin_to_srgb(np.clip(col, 0, 1)), 0, 1)), 0)
                cur = srgb_to_lin(np.clip(oklab_to_srgb(med), 0, 1))
                tl = srgb_to_lin(np.clip(oklab_to_srgb(target), 0, 1))
                b = np.clip(b * (tl + 1e-4) / (cur + 1e-4), 0.0, 1.0)
        elif g in SAME_AS:
            b = np.asarray(bases[SAME_AS[g]], float)
            q = (pw - hc) / hr
            col = pearl_shade(nv, q, b)
            med = np.median(srgb_to_oklab(np.clip(lin_to_srgb(np.clip(col, 0, 1)), 0, 1)), 0)
            where = 'the %s base (one pearl cloth, cover 2); cover-1 measure kept for the record' % SAME_AS[g]
        else:
            b = PEARL_BASE.copy()
            q = (pw - hc) / hr
            for _ in range(10):
                col = pearl_shade(nv, q, b)
                med = np.median(srgb_to_oklab(np.clip(lin_to_srgb(np.clip(col, 0, 1)), 0, 1)), 0)
                cur = srgb_to_lin(np.clip(oklab_to_srgb(med), 0, 1)); tl = srgb_to_lin(np.clip(oklab_to_srgb(target), 0, 1))
                b = limit_chroma(np.clip(b * (tl + 1e-3) / (cur + 1e-3), 0.01, 1.0))
            col = pearl_shade(nv, q, b)
            med = np.median(srgb_to_oklab(np.clip(lin_to_srgb(np.clip(col, 0, 1)), 0, 1)), 0)
        dE = float(np.linalg.norm(med - target))
        bases[g] = b.round(4).tolist()
        report[g] = dict(pixels=int(len(idx)), measured=hexs(oklab_to_srgb(target)), where=where, base_linear=b.round(4).tolist(),
                         base_srgb=hexs(lin_to_srgb(b)), rendered_median=hexs(oklab_to_srgb(med)), dE=round(dE, 4))
        print('%-10s %6d px  measured %s  base %s  rendered %s  dE %.4f' % (g, len(idx), report[g]['measured'], report[g]['base_srgb'],
                                                                      report[g]['rendered_median'], dE), flush=True)
    if 'band' not in bases and 'hat' in bases and False:
        bases['band'] = bases['hat']; report['band'] = dict(report['hat']); report['band']['where'] = 'the hat\'s (the band is hidden by the brim)'
    # the head, for the record
    idx = np.nonzero((erode(gid.reshape(H, W) == 'pearl', 3) & refmask).ravel())[0]
    report['pearl'] = dict(pixels=int(len(idx)), measured=hexs(oklab_to_srgb(np.median(srgb_to_oklab(ref.reshape(-1, 3)[idx]), 0))),
                           base_linear=PEARL_BASE.round(4).tolist(), base_srgb=hexs(lin_to_srgb(PEARL_BASE)))
    json.dump(dict(bases=bases, report=report), open('bases.json', 'w'), indent=1)
    # check image: cover 1 | the pearl render with these bases, same pose and scale (crop to the figure)
    img, _, _ = render_pearl(pm, cam, head, bases, trace_out=tr)
    box = (360, 290, 960, 1180)
    a = Image.open(REF1).convert('RGB').crop(box); b_ = Image.fromarray(img).crop(box)
    out = Image.new('RGB', (a.width * 2 + 10, a.height + 26), (12, 14, 24))
    dr = ImageDraw.Draw(out); F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15)
    out.paste(a, (0, 26)); out.paste(b_, (a.width + 10, 26))
    dr.text((6, 5), 'cover 1', fill=(230, 230, 230), font=F)
    dr.text((a.width + 16, 5), 'model, pearl material (numpy twin of pearl.glsl), bases fitted per part', fill=(230, 230, 230), font=F)
    out.save('meas/bases_check.png')


if __name__ == '__main__':
    main()
