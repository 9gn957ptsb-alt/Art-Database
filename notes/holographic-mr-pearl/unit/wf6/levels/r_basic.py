import numpy as np, time
from PIL import Image, ImageDraw
import nest as N
H = N.HG
u = N.unit(H, 'woven')
root = N.Copy(level=0)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 7 * max(len(l) for l in txt.split('\n')), 14 * (txt.count('\n') + 1) + 4), fill=(255, 255, 255)); d.text((4, 2), txt, fill=(0, 0, 0)); return np.array(im)
tiles = []
# 1. IN: parent + holes, gap by point reflection
for gap in ('pref', 'r180'):
    cps = [root] + N.holes(root, H, gap=gap)
    t0 = time.time()
    tone, lev, dep = N.drawing_view(N.prims(cps, u), w=620)
    print('IN', gap, '%.1fs' % (time.time() - t0))
    tiles.append(label(N.picture(tone, lev), 'IN: 4 copies at phi^-4 in the openings\ngap copy: %s' % {'pref': 'point reflection (lattice, lit by axis)', 'r180': 'half turn about the sight line (tones carried)'}[gap]))
# 2. IN two levels
cps = [root]; cur = [root]
for L in range(2):
    nxt = []
    for p in cur: nxt += N.holes(p, H, gap='pref')
    cps += nxt; cur = nxt
tone, lev, dep = N.drawing_view(N.prims(cps, u), w=620)
tiles.append(label(N.picture(tone, lev), 'IN twice: 4 at phi^-4, 16 at phi^-8'))
Image.fromarray(np.concatenate(tiles, 1)).save('r_in.png')
# 3. OF: corners, 1, 2, 3 levels (only the leaves drawn)
tiles = []
for depth_ in (1, 2, 3):
    cur = [root]
    for L in range(depth_):
        nxt = []
        for p in cur: nxt += N.corners(p, H)
        cur = nxt
    tone, lev, dep = N.drawing_view(N.prims(cur, u), w=620)
    tiles.append(label(N.picture(tone, lev), 'OF x%d: %d copies at phi^-%d at the corners' % (depth_, 3 ** depth_, depth_)))
Image.fromarray(np.concatenate(tiles, 1)).save('r_of.png')
