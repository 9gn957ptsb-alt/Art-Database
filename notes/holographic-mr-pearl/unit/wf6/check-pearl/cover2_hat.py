"""hat+head silhouette on cover 2 (head-matched scale, face yaw 45) against a sky mask of cover 2 around the head."""
import sys, os, json, numpy as np
from collections import deque
P = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl'
C = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/'
sys.path.insert(0, P); os.chdir(P)
import pmodel as M
from prims import hull_points, convex_hull
from fit import load_params
from PIL import Image, ImageDraw
im = np.asarray(Image.open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/pearl-2.png').convert('RGB')).astype(float)
res = {}
for name, cx, cy, r, yaw in (('pearl-2', 596.4, 466.3, 139.4, 45.0), ('pearl-1', 581.2, 486.6, 120.54, 50.0)):
    if name == 'pearl-1':
        im = np.asarray(Image.open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/unit/pearl-1.png').convert('RGB')).astype(float)
    k = r / M.HEAD_R_PX
    p = load_params(); p['FACE_YAW'] = yaw
    pr, info = M.build(p)
    hz = M.V0 - M.HEAD_CV
    PROJ = np.array([[1.0, 0, 0], [0, 0, -1.0]])
    box = (int(cx - 2.0 * r), int(cy - 1.75 * r), int(cx + 1.9 * r), int(cy + 0.9 * r))
    u0, v0, u1, v1 = box
    m = Image.new('L', (u1 - u0, v1 - v0), 0); d = ImageDraw.Draw(m)
    for q in pr:
        if q['group'] not in ('pearl', 'hat', 'band'): continue
        pts = hull_points(q, PROJ)          # (x, -z) in model px
        hull = convex_hull(pts)
        d.polygon([(cx + k * x - u0, cy + k * (y + hz) - v0) for x, y in hull], fill=255)
    m = np.asarray(m) > 0
    sub = im[v0:v1, u0:u1]
    sky = (sub[..., 2] - sub[..., 0] > 25) & (sub.mean(2) < 170)       # blue sky
    # the cover's head+hat = not sky, restricted to rows above the shoulders (v < cy + 0.9 r): fill holes by flood from edges
    # the sky reached from the box's top and sides; everything it does not reach is the figure (holes filled)
    seen = np.zeros_like(sky); H_, W_ = sky.shape
    qd = deque([(y, x) for y in range(H_) for x in (0, W_ - 1) if sky[y, x]] + [(0, x) for x in range(W_) if sky[0, x]])
    for y, x in qd: seen[y, x] = True
    while qd:
        y, x = qd.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H_ and 0 <= xx < W_ and sky[yy, xx] and not seen[yy, xx]:
                seen[yy, xx] = True; qd.append((yy, xx))
    fg = ~seen; ref = np.zeros_like(fg); qd = deque([(int(cy - v0), int(cx - u0))]); ref[qd[0]] = True
    while qd:
        y, x = qd.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            yy, xx = y + dy, x + dx
            if 0 <= yy < H_ and 0 <= xx < W_ and fg[yy, xx] and not ref[yy, xx] and yy < int(cy + 0.75 * r) - v0:
                ref[yy, xx] = True; qd.append((yy, xx))
    care = np.ones_like(ref); care[int(cy + 0.75 * r) - v0:, :] = False   # below the chin: body, not scored
    iou = (m & ref & care).sum() / ((m | ref) & care).sum()
    res[name] = dict(iou_hat_head=round(float(iou), 4), scale_px_per_m=round(r / (M.HEAD_R_PX / M.S), 1),
                     model_px=int((m & care).sum()), cover_px=int((ref & care).sum()))
    vis = sub.copy(); vis[ref & ~m] = [255, 60, 60]; vis[m & ~ref] = [60, 130, 255]; vis[~care] *= 0.4
    Image.fromarray(vis.astype(np.uint8)).save(C + 'hat_diff_%s.png' % name)
print(json.dumps(res, indent=1)); json.dump(res, open(C + 'cover2_hat.json', 'w'), indent=1)
