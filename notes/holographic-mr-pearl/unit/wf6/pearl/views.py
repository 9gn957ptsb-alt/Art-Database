"""views.py - study renders of the model (metres): front, side, three-quarter, back; and the overlay on cover 1."""
import json, sys, os, json, time, math
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pmodel as M
from render import ortho_camera, render_flat, edge_mask, trace, eye_mask
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
REF1 = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/pearl-1.png'


def model_m(params, **kw):
    prims, info = M.build(params, **kw)
    pm = M.to_metres(prims)
    h = info['head']
    head = dict(c=(np.array(h['c']) / M.S).tolist(), r=h['r'] / M.S, eyes=h['eyes'],
                hw=params.get('EYE_HW', M.K0['EYE_HW']), hh=params.get('EYE_HH', M.K0['EYE_HH']))
    return pm, head, info


def label(img, text, sub=None):
    im = Image.fromarray(img)
    d = ImageDraw.Draw(im)
    d.text((12, 10), text, fill=(40, 40, 40), font=ImageFont.truetype(FONT, 18))
    if sub:
        d.text((12, 34), sub, fill=(90, 90, 90), font=ImageFont.truetype(FONT.replace('-Bold', ''), 13))
    return im


VIEWS = {
    'front': ((0, 1, 0), 'front (from -y)'),
    'side': ((1, 0, 0), 'side (from his right, -x)'),
    'threequarter': (tuple(-np.array([-math.sin(math.radians(40)) * math.cos(math.radians(12)), -math.cos(math.radians(40)) * math.cos(math.radians(12)), math.sin(math.radians(12))])), 'three-quarter (his front-left, 40 deg round, 12 deg above)'),
    'back': ((0, -1, 0), 'back (from +y)'),
}


def standard_views(params, out, tag='', W=640, H=760, scale=380, which=('front', 'side', 'threequarter'), sub=None, **kw):
    pm, head, info = model_m(params, **kw)
    paths = {}
    for k in which:
        vd, title = VIEWS[k]
        t0 = time.time()
        cam = ortho_camera(vd, (0, 0, 1), scale, W, H, (0.0, 0, 0.92), (W / 2, H / 2))
        img, pid, dep = render_flat(pm, cam, head=head)
        p = os.path.join(out, 'render_%s%s.png' % (k, tag))
        label(img, title, sub).save(p)
        paths[k] = p
        print(k, '%.1fs' % (time.time() - t0), flush=True)
    return paths


def overlay(params, out, name='overlay_front_on_pearl1.png', alpha=0.5):
    ref = np.asarray(Image.open(REF1).convert('RGB'))
    H, W = ref.shape[:2]
    pm, head, info = model_m(params)
    # cover-1 pixel scale: model metres -> px by S, origin at (U0, V0)
    cam = ortho_camera((0, 1, 0), (0, 0, 1), M.S, W, H, (0, 0, 0), (M.U0, M.V0))
    img, pid, dep = render_flat(pm, cam, head=head, outline=False)
    mask = pid >= 0
    edge = edge_mask(pid, dep, 0.02)
    sil = np.zeros_like(mask)
    sil[1:, :] |= mask[1:, :] != mask[:-1, :]
    sil[:, 1:] |= mask[:, 1:] != mask[:, :-1]
    blend = ref.astype(float).copy()
    blend[mask] = blend[mask] * (1 - alpha) + img[mask].astype(float) * alpha
    blend[edge & mask] = blend[edge & mask] * 0.3
    k = sil.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            k |= np.roll(np.roll(sil, dy, 0), dx, 1)
    blend[k] = [255, 40, 200]
    Image.fromarray(blend.astype(np.uint8)).save(os.path.join(out, name))
    return mask


if __name__ == '__main__':
    from fit import load_params
    p = load_params()
    if 'test' in sys.argv:
        standard_views(p, os.path.join(HERE, 'meas'), tag='_test', W=320, H=380, scale=190, which=('front',))


def holo_flat(params, out_path, W=420, H=640, scale=230):
    """flat study renders of holographic mode: A (hat rides) and B (hat stays), the head lifted one diameter"""
    R = M.HEAD_R_PX
    hs = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'hat_settle.json')
    DROP = json.load(open(hs))['drop_px'] if os.path.exists(hs) else 0.0   # hat_settle.py: the hat falls onto the body
    vd = VIEWS['threequarter'][0]
    cams = ortho_camera(vd, (0, 0, 1), scale, W, H, (0.0, 0, 1.05), (W / 2, H / 2))
    tiles = []
    configs = [
        ('rest', dict(), 'rest: head seated'),
        ('A_lift', dict(head_lift=2 * R, hat_on_head=True), 'A: head lifts, hat rides'),
        ('A_body', dict(with_head=False, with_hat=False), 'A: body left, bare collar'),
        ('B_lift', dict(head_lift=2 * R, hat_on_head=False, hat_lift=-DROP), 'B: bare sphere lifts, hat falls'),
        ('B_body', dict(with_head=False, with_hat=True, hat_on_head=False, hat_lift=-DROP), 'B: body left, wearing the hat'),
    ]
    for name, kw, title in configs:
        pm, head, info = model_m(params, **kw)
        if not kw.get('with_head', True):
            head = None
        img, pid, dep = render_flat(pm, cams, head=head)
        if 'lift' in name:
            # a dashed guide from the seat to the lifted head: annotation, not geometry
            im = Image.fromarray(img); d = ImageDraw.Draw(im)
            from render import project
            seat = np.array([0, 0, (M.V0 - M.HEAD_CV) / M.S]); up = seat + np.array([0, 0, 2 * R / M.S])
            a, b = project(cams, seat)[0], project(cams, up)[0]
            for t in np.arange(0, 1, 0.08):
                p0 = a + (b - a) * t; p1 = a + (b - a) * min(t + 0.04, 1)
                d.line([tuple(p0), tuple(p1)], fill=(60, 120, 230), width=2)
            img = np.asarray(im)
        tiles.append(label(img, title))
    S = Image.new('RGB', (len(tiles) * W + (len(tiles) - 1) * 6, H), (255, 255, 255))
    for i, t in enumerate(tiles):
        S.paste(t, (i * (W + 6), 0))
    S.save(out_path)
    return out_path
