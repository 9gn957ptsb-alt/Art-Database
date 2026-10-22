"""cover2.py - the model on cover 2, two ways: matched by the head (cover 2's head circle) and matched by the
height (head top and feet). The gap between them is the covers' disagreement on the head's size."""
import json, numpy as np
from PIL import Image, ImageDraw, ImageFont
import pmodel as M
from views import model_m
from fit import load_params
from render import ortho_camera, render_flat
U = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/'
HJ = json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/head.json'))
p = load_params(); p['FACE_YAW'] = 45.0
pm, head, info = model_m(p)
ref = np.asarray(Image.open(U + 'pearl-2.png').convert('RGB'))
H, W = ref.shape[:2]
cx, cy, r2 = HJ['2']['cx'], HJ['2']['cy'], HJ['2']['r']
R = head['r']; zc = head['c'][2]
ground2 = 1160.0
tiles = []
for name, scale in (('matched by the head', r2 / R), ('matched by the height', (ground2 - (cy - r2)) / (zc + R))):
    # head centre on cover 2's circle centre for the first; head top and ground for the second
    if name.startswith('matched by the head'):
        anchor_px = (cx, cy); anchor_w = (0, 0, zc)
    else:
        anchor_px = (cx, ground2); anchor_w = (0, 0, 0)
    cam = ortho_camera((0, 1, 0), (0, 0, 1), scale, W, H, anchor_w, anchor_px)
    img, pid, dep = render_flat(pm, cam, head=head, outline=False)
    mask = pid >= 0
    sil = np.zeros_like(mask); sil[1:, :] |= mask[1:, :] != mask[:-1, :]; sil[:, 1:] |= mask[:, 1:] != mask[:, :-1]
    k = sil.copy()
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            k |= np.roll(np.roll(sil, dy, 0), dx, 1)
    o = ref.copy(); o[k] = (255, 40, 200)
    im = Image.fromarray(o).crop((300, 250, 960, 1254))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, im.width, 30], fill=(10, 12, 22))
    d.text((8, 6), 'cover 2, model %s (%.1f px/m)' % (name, scale), fill=(240, 240, 240), font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 15))
    tiles.append(im)
    print(name, 'scale %.1f px/m' % scale, 'feet at v %.0f' % (anchor_px[1] + (anchor_w[2]) * scale if name.startswith('matched by the head') else ground2))
out = Image.new('RGB', (tiles[0].width * 2 + 8, tiles[0].height), (10, 12, 22))
out.paste(tiles[0], (0, 0)); out.paste(tiles[1], (tiles[0].width + 8, 0))
out.save('meas/cover2_two_ways.png')
