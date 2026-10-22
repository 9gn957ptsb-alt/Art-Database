import sys; sys.path.insert(0, sys.argv[1])
from caster import *
vt=np.load(OUT+'vec_tone.npy')
res={}
for lo in [float(x) for x in sys.argv[3].split(",")]:
    pr,_=build('V3',kind='smootherstep',n=48,span=(lo*H,1-lo*H))
    t=drawing_view(pr)['tone']; res[lo]=int((t!=vt).sum()); print(lo,res[lo],flush=True)
import json; json.dump(res,open(sys.argv[2]+'span_test_%s.json'%sys.argv[3].replace(',','_'),'w'))
