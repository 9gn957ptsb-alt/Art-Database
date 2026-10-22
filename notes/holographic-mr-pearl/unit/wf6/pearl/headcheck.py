import json, numpy as np
from PIL import Image, ImageDraw
U = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/'
HJ = json.load(open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/material/py/head.json'))
E = json.load(open('meas/eyes.json'))
tiles = []
for k in ('1', '2'):
    im = Image.open(U + 'pearl-%s.png' % k).convert('RGB')
    cx, cy, r = HJ[k]['cx'], HJ[k]['cy'], HJ[k]['r']
    big = im.resize((im.width * 2, im.height * 2), Image.LANCZOS)
    d = ImageDraw.Draw(big)
    s = 2
    d.ellipse([(cx - r) * s, (cy - r) * s, (cx + r) * s, (cy + r) * s], outline=(255, 0, 200), width=2)
    d.line([(cx - r) * s, cy * s, (cx + r) * s, cy * s], fill=(0, 255, 0), width=1)
    for e in E[k]['thr0.32']:
        # draw the eye ellipse back on the image: centre direction and half sizes in the tangent plane
        az, el = np.radians(e['az']), np.radians(e['el'])
        ev = np.array([np.sin(az) * np.cos(el), np.sin(el), np.cos(az) * np.cos(el)])
        up = np.array([0, 1.0, 0]); up -= ev * (up @ ev); up /= np.linalg.norm(up)
        side = np.cross(up, ev)
        pts = []
        for t in np.linspace(0, 2 * np.pi, 60):
            q = ev * np.sqrt(max(1 - (e['half_w'] * np.cos(t)) ** 2 - (e['half_h'] * np.sin(t)) ** 2, 0)) + side * e['half_w'] * np.cos(t) + up * e['half_h'] * np.sin(t)
            pts.append(((cx + q[0] * r) * s, (cy - q[1] * r) * s))
        d.line(pts + [pts[0]], fill=(0, 255, 255), width=1)
    c = big.crop((int((cx - 1.35 * r) * s), int((cy - 1.6 * r) * s), int((cx + 1.35 * r) * s), int((cy + 1.2 * r) * s)))
    c = c.resize((540, int(540 * c.height / c.width)), Image.LANCZOS)
    tiles.append(c)
W = sum(t.width for t in tiles); H = max(t.height for t in tiles)
out = Image.new('RGB', (W + 10, H), (20, 20, 20))
x = 0
for t in tiles:
    out.paste(t, (x, 0)); x += t.width + 10
out.save('meas/head_circles_both.png')
print(out.size)
