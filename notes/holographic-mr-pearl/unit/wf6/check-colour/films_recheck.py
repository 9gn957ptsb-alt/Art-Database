import sys, json, numpy as np
sys.path.insert(0, '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/colour')
import os; os.chdir('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/colour')
from films import *
ss=2
L,O,D = drawing_layers(ss)
cols = layer_colours(L,D)
orig = vector_original(ss)
has = L['n']>=1
fig = has | (orig>=0)
otone = np.where(orig>=0, C8[np.clip(orig,0,2)], 255)/255.0
res={}
for how in ['opaque','recursive','average','multiply','add','screen','golden']:
    g = compose(mix(cols,L['n'],how), np.ones(3))[...,0]
    d = np.abs(g-otone)[fig]*255
    res[how]=dict(mae=round(float(d.mean()),2), share_exact_le2=round(float((d<=2).mean()),4), share_off_gt32=round(float((d>32).mean()),4), rmse=round(float(np.sqrt((d**2).mean())),2))
    print(how, res[how])
print('figure px (ss2)', int(fig.sum()), 'n>=2 share', float((L['n']>=2)[fig].mean()))
json.dump(res, open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-colour/films_recheck.json','w'), indent=1)
