"""holo.py - WebGL2 renders (pearl.glsl) of the rest pose and of holographic mode, two hat options.

  A  the hat rides with the head: head + hat lift off; the headless body is left bare-necked
  B  the hat stays on the body: the bare sphere lifts off; the hat stays exactly where it was
The lift shown is one head diameter (2R): the moment the head has just cleared its seat.
usage: python3 holo.py [W]   -> gl/*.png, holo_A.png, holo_B.png, render_gl_*.png"""
import json, os, sys, math, subprocess
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pmodel as M
from views import model_m
from fit import load_params
from make_view import write as write_page

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONTB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


def cam_from(az_deg, el_deg, dist, target, fov=28.0):
    """camera at azimuth az (0 = in front of him, on -y; + toward his left, +x), elevation el, looking at target"""
    a, e = math.radians(az_deg), math.radians(el_deg)
    dirv = -np.array([math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)])
    pos = np.asarray(target, float) - dirv * dist
    return dict(pos=pos.tolist(), dir=dirv.tolist(), up=[0, 0, 1], ortho_h=0.0, fov=fov)


def shoot(name, sc, W, H):
    html = os.path.join(HERE, 'gl', name + '.html'); png = os.path.join(HERE, 'gl', name + '.png')
    write_page(html, sc, W, H)
    r = subprocess.run(['node', os.path.join(HERE, 'shoot.js'), html, png, '900000'], capture_output=True, text=True)
    print(name, r.stdout.strip()[-200:], r.stderr.strip()[-300:], flush=True)
    if r.returncode != 0:
        raise SystemExit('GL failed: ' + r.stdout[-2000:])
    return png


def scene_for(p, bases, cam, **kw):
    pm, head, info = model_m(p, **kw)
    hl = kw.get('head_lift', 0.0) / M.S
    if kw.get('with_head', True):
        head = dict(head); head['c'] = [head['c'][0], head['c'][1], head['c'][2]]
    else:
        head = None
    seat = [0.0, 0.0, (M.V0 - M.HEAD_CV) / M.S]
    if head is None:
        head = dict(c=seat, r=M.HEAD_R_PX / M.S, eyes=[[0, -1.0, 0]], hw=1e-4, hh=1e-4)
    return dict(prims=pm, head=head, bases=bases, cam=cam, bg='sky', body_c=seat)


def sheet(paths, titles, out, title, notes=None):
    ims = [Image.open(p).convert('RGB') for p in paths]
    w, h = ims[0].size
    top = 64
    bot = 18 + (16 * len(notes) if notes else 0)
    S = Image.new('RGB', (len(ims) * w + (len(ims) - 1) * 8, h + top + bot), (10, 12, 22))
    d = ImageDraw.Draw(S)
    d.text((10, 8), title, fill=(240, 240, 240), font=ImageFont.truetype(FONTB, 20))
    for i, (im, t) in enumerate(zip(ims, titles)):
        S.paste(im, (i * (w + 8), top))
        d.text((i * (w + 8) + 8, top - 22), t, fill=(215, 215, 225), font=ImageFont.truetype(FONT, 15))
    if notes:
        for j, n in enumerate(notes):
            d.text((10, top + h + 6 + 16 * j), n, fill=(190, 190, 205), font=ImageFont.truetype(FONT, 13))
    S.save(out)
    return out


def main(W=720):
    p = load_params(); p['FACE_YAW'] = 0.0
    bases = json.load(open(os.path.join(HERE, 'bases.json')))['bases'] if os.path.exists(os.path.join(HERE, 'bases.json')) else {}
    R = M.HEAD_R_PX
    lift = 2 * R
    H = int(W * 1.25)
    tgt_body = [0.0, 0.0, 0.92]
    tgt_holo = [0.0, 0.0, 1.10]
    c3q = cam_from(35, 8, 5.4, tgt_body, 25)
    c3qh = cam_from(35, 8, 6.3, tgt_holo, 25)
    cfront = cam_from(0, 3, 5.4, tgt_body, 25)
    cside = cam_from(-90, 3, 5.4, tgt_body, 25)
    out = {}
    out['rest_front'] = shoot('rest_front', scene_for(p, bases, cfront), W, H)
    out['rest_side'] = shoot('rest_side', scene_for(p, bases, cside), W, H)
    out['rest_3q'] = shoot('rest_3q', scene_for(p, bases, c3q), W, H)
    out['A_lift'] = shoot('A_lift', scene_for(p, bases, c3qh, head_lift=lift, hat_on_head=True), W, H)
    out['A_body'] = shoot('A_body', scene_for(p, bases, c3q, with_head=False, with_hat=False), W, H)
    drop = json.load(open(os.path.join(HERE, 'hat_settle.json')))['drop_px']   # the hat falls onto the body (hat_settle.py)
    out['B_lift'] = shoot('B_lift', scene_for(p, bases, c3qh, head_lift=lift, hat_on_head=False, hat_lift=-drop), W, H)
    out['B_body'] = shoot('B_body', scene_for(p, bases, c3q, with_head=False, with_hat=True, hat_on_head=False, hat_lift=-drop), W, H)
    sheet([out['rest_front'], out['rest_side'], out['rest_3q']], ['front', 'side (from his right)', 'three-quarter (his front-left)'],
          os.path.join(HERE, 'render_gl_views.png'), 'Holographic Mr Pearl - primitive model, pearl.glsl (WebGL2), rest pose',
          ['Head: the one perfect sphere, R 0.2456 m, eyes painted on it. Everything else is the volume the base unit will fill.'])
    sheet([out['A_lift'], out['A_body']], ['the head lifts off, the hat riding with it', 'the headless body left behind (bare collar)'],
          os.path.join(HERE, 'holo_A.png'), 'Holographic mode, option A: the hat rides with the head',
          ['Lift shown: one head diameter (0.49 m). The hologram keeps his silhouette (hat and sphere); the body is left bare-necked.'])
    sheet([out['B_lift'], out['B_body']], ['the bare sphere lifts off; the hat falls onto the body', 'the headless body left behind, wearing the hat'],
          os.path.join(HERE, 'holo_B.png'), 'Holographic mode, option B: the hat stays on the body',
          ['The hologram is the pure sphere alone (nothing built rides with it). Nothing holds the hat then: it falls straight down',
           '0.43 m until its hollow crown rests on the bare neck, its brim over the shoulders (hat_settle.py).'])
    json.dump(out, open(os.path.join(HERE, 'gl', 'holo_out.json'), 'w'), indent=1)


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 720)
