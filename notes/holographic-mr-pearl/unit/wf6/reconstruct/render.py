import sys
from caster import *
from PIL import Image, ImageDraw, ImageFont
from measure import mismatch, cls, HOLES
TONE_RGB = {-1: 255, 0: 128, 1: 0, 2: 255, -3: 200}
BARS = ['right', 'bottom', 'left', 'middle', 'inner_left', 'inner_right']


def edges(lab, extra=None):
    e = np.zeros(lab.shape, bool)
    e[:-1] |= lab[:-1] != lab[1:]; e[1:] |= lab[:-1] != lab[1:]
    e[:, :-1] |= lab[:, :-1] != lab[:, 1:]; e[:, 1:] |= lab[:, :-1] != lab[:, 1:]
    if extra is not None:
        e |= extra
    return e


def depth_jumps(t, thr):
    tt = np.where(np.isfinite(t), t, 1e3)
    e = np.zeros(t.shape, bool)
    e[:-1] |= np.abs(tt[:-1] - tt[1:]) > thr; e[:, :-1] |= np.abs(tt[:, :-1] - tt[:, 1:]) > thr
    return e


def mix_tone(n, tone):
    """Middling by the normal: sum n_i^2 * tone_i (x grey 128, y black 0, z white 255), per sRGB channel"""
    w = n ** 2
    v = w[..., 0] * 128 + w[..., 1] * 0 + w[..., 2] * 255
    return np.where(tone == -1, 255, v)


def snap_tone(n, tone):
    t = np.abs(n).argmax(-1)
    return np.where(tone == -1, -1, t)


def picture(R, mode='identity', outline=True, thr=0.3):
    tone = R['tone']
    if mode == 'identity':
        v = np.vectorize(TONE_RGB.get)(tone).astype(float)
    elif mode == 'mix':
        v = mix_tone(R['n'], tone)
    elif mode == 'snap':
        v = np.vectorize(TONE_RGB.get)(snap_tone(R['n'], tone)).astype(float)
    if outline:
        bar = np.where(tone == -1, -1, R['fid'] // 3 * 0 + R['beam'])
        # label: bar index and face pair (the same face of one bar joins without an edge)
        barid = np.where(R['beam'] >= 0, np.array([BARS.index(b[3]) for b in BEAMS] + [-1])[R['beam']], -1)
        lab = np.where(tone == -1, -1, barid * 10 + (R['fid'] % 3))
        e = edges(lab, depth_jumps(R['t'], thr))
        v = np.where(e, 40, v)
    return v.astype(np.uint8)


def label(img, text, size=18):
    im = Image.fromarray(img) if isinstance(img, np.ndarray) else img
    im = im.convert('RGB')
    d = ImageDraw.Draw(im)
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', size)
    except Exception:
        font = ImageFont.load_default()
    d.text((8, 6), text, fill=(200, 30, 30), font=font)
    return im
