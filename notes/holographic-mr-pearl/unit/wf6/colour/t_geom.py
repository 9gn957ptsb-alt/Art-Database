import numpy as np, time
from common import *
cc = np.load(S + 'wf3/colour-albers/cls_clean.npy')
holes = np.load(S + 'wf3/colour-albers/cls_holes.npy')
print('cls_clean values', np.unique(cc, return_counts=True), 'holes', holes.dtype, np.unique(holes)[:5])
t = time.time()
O, D = drawing_rays()
res = {}
for kind in ('model', 'drawn'):
    L = layers(bars(kind), O, D, K=4, merge=True)
    tone = np.where(L['n'] > 0, L['ax'][0], -1)
    res[kind] = (tone, L)
    valid = cc != -2
    wrong = (tone != cc) & valid
    print(kind, 'wrong px', int(wrong.sum()), 'of fig', int(((cc >= 0) & valid).sum()), 'layers count hist', np.bincount(L['n'].ravel()), '%.1fs' % (time.time() - t))
dr = raster_drawn()
valid = cc != -2
print('raster_drawn wrong', int(((dr != cc) & valid).sum()))
np.save(OUT + 'drawn_cls.npy', dr.astype(np.int8))
# crossings of the straight model: two or more solids along the ray
L = res['model'][1]
print('pixels with >=2 layers (straight model):', int((L['n'] >= 2).sum()), ' >=3:', int((L['n'] >= 3).sum()))
