"""independent check: own raster of vector.json, form.json hexes cast with figure_studies.cast"""
import sys, json, math
sys.path.insert(0, '/home/user/site/scripts')
import numpy as np, figure_studies as fs
S='/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/'
OUT=S+'wf6/check-reconstruct/'
v=json.load(open(S+'wf1/vectorize/vector.json')); f=v['fit']
cls=np.load(S+'unit/cls.npy'); holes_cls=np.load(S+'wf3/colour-albers/cls_holes.npy')
ys,xs=np.mgrid[0:630,0:1200].astype(float)
A=(xs-f['cx'])/f['s']; B=-(ys-f['cy'])/(f['s']*f['k'])
def inpoly(P):
    P=np.array(P); ins=np.zeros(A.shape,bool)
    for i in range(len(P)):
        x0,y0=P[i]; x1,y1=P[(i+1)%len(P)]
        c=((y0>B)!=(y1>B))
        with np.errstate(divide='ignore',invalid='ignore'):
            xi=x0+(B-y0)*(x1-x0)/(y1-y0)
        ins^= c & (A<xi)
    return ins
mine=np.full(A.shape,-1); rid=np.full(A.shape,-1)
for d in v['drawn']:
    m=inpoly(d['polygon']); mine[m]=d['tone']; rid[m]=d['id']
np.save(OUT+'my_vec_tone.npy',mine)
vt=np.load(S+'wf6/reconstruct/vec_tone.npy')
print('my raster vs their vec_tone differing px:', int((mine!=vt).sum()))
HOLES=(rid>=9)
def mism(t):
    tt=t.copy(); tt[HOLES&(tt==-1)]=2; valid=cls!=-2
    m=(tt!=cls)&valid; fig=((cls>=0)|(tt>=0))&valid
    m2=(t!=holes_cls)&valid; fig2=((holes_cls>=0)|(t>=0))&valid
    return int(m.sum()),int(fig.sum()),round(100*m.sum()/fig.sum(),3), int(m2.sum()), round(100*m2.sum()/fig2.sum(),3)
print('my vector raster mismatch (wrong, fig, pct, wrong_vs_cls_holes, pct):', mism(mine))
# form.json hexes, own caster
F=json.load(open(S+'wf6/reconstruct/form.json'))
hexes=[fs.Hex(np.array(h)) for b in F['beams'] for h in b['hexes']]
print('hexes in form.json:', len(hexes))
C=np.array(F['view']['centre']); d=np.array(F['view']['d']); u=np.array(F['view']['u']); r=np.array(F['view']['r'])
def render(A,B):
    O=C+A[...,None]*r+B[...,None]*u-d*30
    tone=np.full(A.shape,-1)
    # chunk rows
    for y0 in range(0,A.shape[0],90):
        sl=slice(y0,y0+90)
        tone[sl]=fs.cast(hexes,O[sl],np.broadcast_to(d,O[sl].shape))
    return tone
T=render(A,B); np.save(OUT+'form_json_tone.npy',T)
print('form.json cast vs my vector raster differing px:', int((T!=mine).sum()))
print('form.json cast mismatch:', mism(T))
