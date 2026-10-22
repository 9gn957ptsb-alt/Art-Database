# For every pixel of the original: which of the nine beams cover it there, and which face each shows; which
# of them shows the original's tone. A pixel the straight model gets wrong is fixable by depth (curves) only
# if some beam covering it shows the right tone.
import sys, numpy as np, math
sys.path.insert(0, '/home/user/site/scripts')
import figure_studies as fs
from PIL import Image
cls = np.load('cls.npy')
H, s, cx, cy, k = np.load('fitb.npy')
fs.H = H
F = fs.figure()
names = []
for b in F:
    ax = 'xyz'[int(np.argmax(np.linalg.norm(b.E, axis=1)))]
    names.append(b.part + ax)
ys, xs = np.mgrid[0:cls.shape[0], 0:cls.shape[1]]
d = np.array([-1.0, -1, -1]); d /= np.linalg.norm(d)
u = np.array([0, -1.0, 1]); u -= d * (u @ d); u /= np.linalg.norm(u)
r = np.cross(d, u)
a = (xs - cx) / s; bb = -(ys - cy) / (s * k)
O = fs.CENTRE + a[..., None] * r + bb[..., None] * u - d * 50
D = np.broadcast_to(d, O.shape)
tones = np.stack([fs.cast([b], O, D) for b in F])      # (9, H, W): -1 or the face tone of that beam alone
np.save('tones.npy', tones)
model = fs.cast(F, O, D)
inside = cls >= -1
cover = tones >= 0
ok_any = (tones == cls[None]).any(0)
wrong = (model != cls) & (cls != -2)
print('pixels the straight model gets wrong:', wrong.sum())
print('  of which some covering beam shows the right tone (fixable by depth):', (wrong & ok_any).sum())
print('  of which the original is ground but a beam covers it:', (wrong & (cls == -1)).sum())
print('  of which the original has a face no beam can show there:', (wrong & ~ok_any & (cls >= 0)).sum())
# overlaps: pairs of beams covering the same pixel
for i in range(9):
    for j in range(i + 1, 9):
        both = cover[i] & cover[j] & (cls >= 0)
        if both.sum() < 50: continue
        wi = both & (tones[i] == cls) & (tones[j] != cls)
        wj = both & (tones[j] == cls) & (tones[i] != cls)
        print('%-3s %-3s overlap %6d  original shows %-3s %6d, %-3s %6d' % (names[i], names[j], both.sum(), names[i], wi.sum(), names[j], wj.sum()))
