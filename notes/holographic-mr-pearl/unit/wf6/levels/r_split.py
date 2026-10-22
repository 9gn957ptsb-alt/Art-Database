import numpy as np, time
from PIL import Image, ImageDraw
import nest as N
H = N.HG
u = N.unit(H, 'woven', 12)
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * max(len(l) for l in txt.split('\n')), 13 * (txt.count('\n') + 1) + 4), fill=(255, 255, 255)); d.text((4, 2), txt, fill=(0, 0, 0)); return np.array(im)
tiles = []
for n in (1, 2, 3, 4, 5, 6, 7, 9, 12, 13, 28, 40):
    node = {'key': 'n%d' % n, 'parts': [{'key': i, 'weight': 1} for i in range(n)]}
    res = N.place_tree(node, N.Frame(1.0, N.CENTRE.copy()), H)
    t0 = time.time()
    tone, lev, dep = N.drawing_view(N.prims(res['leaves'], u), w=380)
    sizes = sorted(set(round(-np.log(c.s) / np.log(N.PHI), 2) for c in res['leaves']))
    tiles.append(label(N.picture(tone, lev), 'n = %d: %d slots, %d open\nsizes phi^-%s' % (n, len(res['leaves']) + len(res['open']), len(res['open']), ', '.join('%g' % s for s in sizes))))
    print(n, 'leaves', len(res['leaves']), 'open', len(res['open']), 'sizes', sizes, '%.1fs' % (time.time() - t0), flush=True)
rows = [np.concatenate(tiles[i:i + 4], 1) for i in range(0, 12, 4)]
Image.fromarray(np.concatenate(rows, 0)).save('r_split.png')
