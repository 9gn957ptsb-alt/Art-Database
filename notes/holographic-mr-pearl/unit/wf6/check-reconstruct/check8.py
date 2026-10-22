"""check8: 3x3 supersampled drawing view of the primary ARCS form vs the straight-cut reading."""
import sys; sys.path.insert(0, sys.argv[1])
from render import *
import json
f = dict(FIT); f['s'] *= 3; f['cx'] = f['cx'] * 3 + 1; f['cy'] = f['cy'] * 3 + 1
Ta = drawing_view(build('V3', kind='arcs', n=96)[0], (1890, 3600), f)['tone']
Tc = drawing_view(build_cut(), (1890, 3600), f)['tone']
out = dict(samples=int(Ta.size), differing=int((Ta != Tc).sum()), figure_samples=int((Ta >= 0).sum()))
print(out); json.dump(out, open(sys.argv[2] + '/check8.json', 'w'))
