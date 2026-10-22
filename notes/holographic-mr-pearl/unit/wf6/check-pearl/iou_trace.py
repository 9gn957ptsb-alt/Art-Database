"""independent IoU: ray-traced front silhouette (render.trace, exact SDFs) vs wf5 ref_mask, cover-1 pose,
compared to sil.py's convex-hull silhouettes. usage: python3 iou_trace.py"""
import sys, os, json, numpy as np
P = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/pearl'
sys.path.insert(0, P); os.chdir(P)
import pmodel as M, sil, views
from render import ortho_camera, trace
from fit import load_params
p = load_params(); c1 = dict(p); c1['FACE_YAW'] = 50.0
if len(sys.argv) > 1: c1.update(json.load(open(sys.argv[1])))
pm, head, info = views.model_m(c1)
u0, v0, u1, v1 = 360, 290, 960, 1180
cam = ortho_camera((0, 1, 0), (0, 0, 1), M.S, u1 - u0, v1 - v0, (0, 0, 0), (M.U0 - u0, M.V0 - v0))
o, d, depth, pid, nrm = trace(pm, cam)
m = (pid >= 0).reshape(v1 - v0, u1 - u0)
np.save('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-pearl/trace_mask.npy', m)
r = sil.REF[v0:v1, u0:u1]; c = sil.CARE[v0:v1, u0:u1]
def io(mm, rr, cc): return (mm & rr & cc).sum() / ((mm | rr) & cc).sum()
print('trace IoU figure box', round(io(m, r, c), 4))
regions = {'hat+head': (370, 300, 790, 612), 'torso+arms': (430, 600, 960, 950), 'legs': (440, 900, 860, 1170)}
for k, (a, b, e, f) in regions.items():
    sl = (slice(b - v0, f - v0), slice(a - u0, e - u0))
    print(k, round(io(m[sl], r[sl], c[sl]), 4))
pp, _ = M.build(c1)
print('hull IoU', round(float(sil.iou(pp, (u0, v0, u1, v1))[0]), 4))
print('no-care IoU (trace)', round((m & r).sum() / (m | r).sum(), 4))
