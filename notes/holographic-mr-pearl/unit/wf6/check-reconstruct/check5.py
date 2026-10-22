import sys; sys.path.insert(0, sys.argv[1])
from render import *
import json
phi=(1+5**.5)/2; out={}
for nm,H6 in [('H=1/9',6/9),('6H=1/phi',1/phi)]:
    seq=[1-H6,H6,1,1+H6,2+H6]
    out[nm]=dict(seq=seq,sums=[seq[i]+seq[i+1]-seq[i+2] for i in range(3)],ratios=[seq[i+1]/seq[i] for i in range(4)],
                 in_thirds=[x*3 for x in seq], fig_times_phi4_minus_hole=(seq[4]*phi**-4-seq[0]))
F=[1,1]
for _ in range(12): F.append(F[-1]+F[-2])
out['bend_scale_F(m+4)/8_ratios']=[F[m+4]/F[m+3] for m in range(0,8)]
prims=build('V3',kind='arcs',n=96)[0]
R=drawing_view(prims); t=R['tone']; s=snap_tone(R['n'],t)
fig=(t>=0)
out['snap_changed_pct_of_figure_px']=round(100*((s!=t)&fig).sum()/fig.sum(),2)
print(json.dumps(out,indent=1)); json.dump(out,open(sys.argv[2]+'check5.json','w'),indent=1)
