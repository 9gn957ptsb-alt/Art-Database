"""independent head circle fit: radial edge search from a rough centre, robust Kasa circle fit."""
import numpy as np, json
from PIL import Image, ImageDraw
U = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/'
C = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/'
def bil(a, x, y):
    x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = x - x0; fy = y - y0
    return (a[y0, x0] * (1 - fx) * (1 - fy) + a[y0, x0 + 1] * fx * (1 - fy) + a[y0 + 1, x0] * (1 - fx) * fy + a[y0 + 1, x0 + 1] * fx * fy)
out = {}
for name, c0, r0, angs in (('pearl-1', (585, 490), 120, np.r_[-75:95:1.5]), ('pearl-2', (596, 470), 139, np.r_[-75:95:1.5])):
    im = np.asarray(Image.open(U + name + '.png').convert('RGB')).astype(float)
    L = im.mean(2)
    pts = []
    for side in (1, -1):   # image right half and left half (angle measured from +x, v down)
        for a in angs:
            th = np.radians(a); dx = side * np.cos(th); dy = np.sin(th)   # a>0: below the centre
            rs = np.arange(r0 * 0.8, r0 * 1.2, 0.25)
            x = c0[0] + rs * dx; y = c0[1] + rs * dy
            prof = bil(L, x, y)
            g = -np.gradient(prof)      # bright head -> darker outside
            k = np.argmax(g)
            if g[k] > 6: pts.append((x[k], y[k], a, side))
    P = np.array(pts)
    X, Y = P[:, 0], P[:, 1]; w = np.ones(len(X), bool)
    for it in range(6):
        A = np.c_[2 * X[w], 2 * Y[w], np.ones(w.sum())]; b = X[w] ** 2 + Y[w] ** 2
        cx, cy, k = np.linalg.lstsq(A, b, rcond=None)[0]; r = np.sqrt(k + cx * cx + cy * cy)
        res = np.hypot(X - cx, Y - cy) - r
        s = 1.4826 * np.median(np.abs(res[w]))
        w = np.abs(res) < max(2.5 * s, 1.0)
    out[name] = dict(c=[round(cx, 1), round(cy, 1)], r=round(r, 1), rms_inliers=round(float(np.sqrt((res[w] ** 2).mean())), 2), n=int(w.sum()), of=len(X))
    img = Image.fromarray(im.astype(np.uint8)); d = ImageDraw.Draw(img)
    d.ellipse((cx - r, cy - r, cx + r, cy + r), outline=(255, 0, 255))
    for (x, y, _, _), ok in zip(pts, w): d.point((x, y), fill=(0, 255, 0) if ok else (255, 0, 0))
    img.crop((int(cx - r - 60), int(cy - r - 60), int(cx + r + 60), int(cy + r + 60))).resize((2 * int(r + 60) * 2, 2 * int(r + 60) * 2)).save(C + 'headfit_' + name + '.png')
print(json.dumps(out))
json.dump(out, open(C + 'headfit.json', 'w'))
