import json, numpy as np
from PIL import Image
import lv, drawing2d as D
import unit as U
C = D.target('cls')
fit = json.load(open('q_a3.json'))['thirds']['fit']; H = D.H9
O, Dv = U.drawing_rays_for_original(*fit)
rows = []
col = {-1: (255, 255, 255), 0: (128, 128, 128), 1: (0, 0, 0), 2: (236, 236, 236), -2: (255, 255, 255)}
def pic(t):
    a = np.zeros(t.shape + (3,), np.uint8)
    for kk, c in col.items(): a[t == kk] = c
    return a
for Dsh in [0.0, 1 + 6 * H]:
    u = lv.unit(H, D=Dsh)
    t, lev, dep = lv.cast(lv.prims_of([lv.Copy()], u), O, Dv, want_level=True, want_depth=True)
    m = (t != C) & (C != -2) & (C != 2)
    im = pic(t); im[m] = (230, 40, 40)
    crop = (slice(70, 560), slice(330, 870))
    rows.append(np.concatenate([pic(C)[crop], pic(t)[crop], im[crop]], 1))
Image.fromarray(np.concatenate(rows, 0)).save('dbg_closure.png')
