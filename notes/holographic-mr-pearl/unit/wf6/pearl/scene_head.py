"""head close-up at cover-1 scale (S px/m), centred on the head, face yaw as cover 1 (50) by default"""
import json, sys, numpy as np
from fit import load_params
from views import model_m
import pmodel as M
p = load_params(); p['FACE_YAW'] = float(sys.argv[1]) if len(sys.argv) > 1 else 50.0
Hpx = int(sys.argv[2]) if len(sys.argv) > 2 else 400
pm, head, info = model_m(p)
keep = [q for q in pm if q['part'] == 'head' or q['part'].startswith('hat_')]
c = head['c']
zc = c[2] + 0.06
sc = dict(prims=keep, head=head, bases={'hat': [0.62, 0.52, 0.40], 'band': [0.45, 0.40, 0.55]},
          cam=dict(pos=[c[0], -5.0, zc], dir=[0, 1, 0], up=[0, 0, 1], ortho_h=Hpx / M.S), bg='sky')
json.dump(sc, open('gl/scene_head.json', 'w'))
# the matching crop of cover 1: centre (U0 + x*S, V0 - z*S)
u = M.U0 + c[0] * M.S; v = M.V0 - zc * M.S
json.dump(dict(u=u, v=v, H=Hpx), open('gl/scene_head_crop.json', 'w'))
