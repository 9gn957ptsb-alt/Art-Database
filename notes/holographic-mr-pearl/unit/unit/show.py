import sys, numpy as np
sys.path.insert(0, '/home/user/site/scripts')
import figure_studies as fs
from PIL import Image
cls = np.load('cls.npy'); Hh, Ww = cls.shape
p = np.load(sys.argv[1]) if len(sys.argv) > 1 else np.load('fitg.npy')
H, s, cx, cy, k = p
fs.H = H
boxes = fs.figure()
ys, xs = np.mgrid[0:Hh, 0:Ww]
d = np.array([-1.0, -1, -1]); d /= np.linalg.norm(d)
u = np.array([0, -1.0, 1]); u -= d * (u @ d); u /= np.linalg.norm(u)
r = np.cross(d, u)
a = (xs - cx) / s; b = -(ys - cy) / (s * k)
O = fs.CENTRE + a[..., None] * r + b[..., None] * u - d * 50
t = fs.cast(boxes, O, np.broadcast_to(d, O.shape))
col = {-1: (255, 255, 255), 0: (128, 128, 128), 1: (0, 0, 0), 2: (235, 235, 235), -2: (255, 0, 0)}
def pic(c):
    out = np.zeros(c.shape + (3,), np.uint8)
    for kk, v in col.items(): out[c == kk] = v
    return out
diff = np.zeros(cls.shape + (3,), np.uint8) + 255
m = (t != cls) & (cls != -2)
diff[m] = (220, 40, 40)
diff[~m & (cls >= 0)] = (200, 200, 200)
img = np.concatenate([pic(cls), pic(t), diff], 1)
Image.fromarray(img).crop((300, 60, 3600 - 300 - 0, 570)).save(sys.argv[2] if len(sys.argv) > 2 else 'overlay.png')
print('mismatch in figure', m.sum() / ((cls >= 0) | (t >= 0)).sum())
