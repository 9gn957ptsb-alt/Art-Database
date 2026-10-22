# independent check of VS on voxel staircases: own exact DDA, own random planes/eyes
import numpy as np, json
C = np.array([128,0,255.])
rng = np.random.default_rng(7)
G=64
def rule(name,n,v):
    w = {'VS':np.maximum(n*v,0),'SQ':n*n,'L1':np.abs(n)}[name]
    return (w@C)/w.sum()
def measure(n,v,nray=4000):
    c0=np.full(3,G/2)
    idx=np.indices((G,G,G)).reshape(3,-1).T+0.5
    occ=(((idx-c0)@n)<0).reshape(G,G,G)
    # rays: start points on plane disc, back off along v
    a=np.cross(n,[1,0,0] if abs(n[0])<.9 else [0,1,0]); a/=np.linalg.norm(a); b=np.cross(n,a)
    r=14*np.sqrt(rng.random(nray)); th=2*np.pi*rng.random(nray)
    P=c0+np.outer(r*np.cos(th),a)+np.outer(r*np.sin(th),b)
    D=-v; O=P+v*40.0
    # exact DDA
    cell=np.floor(O).astype(int); step=np.sign(D).astype(int)
    tmax=np.where(D!=0,((cell+(step>0))-O)/np.where(D!=0,D,1),np.inf); tdel=np.where(D!=0,np.abs(1/np.where(D!=0,D,1)),np.inf)
    tmax=np.broadcast_to(tmax,(nray,3)).copy(); 
    face=np.full(nray,-1); alive=np.ones(nray,bool)
    for it in range(400):
        ax=np.argmin(tmax,1)
        rows=np.arange(nray)
        cell[rows,ax]+=step[ax]*alive
        tmax[rows,ax]+=tdel[ax]
        inb=np.all((cell>=0)&(cell<G),1)
        hit=alive&inb
        hh=np.zeros(nray,bool); hh[hit]=occ[cell[hit,0],cell[hit,1],cell[hit,2]]
        face[hh]=ax[hh]; alive&=~hh
        if not alive.any(): break
    ok=face>=0
    return C[face[ok]].mean(), ok.mean()
rows=[]
for k in range(40):
    n=rng.normal(size=3); n/=np.linalg.norm(n)
    v=rng.normal(size=3); v/=np.linalg.norm(v)
    if n@v<0.25: v=v-2*(v@n)*n if n@v<0 else v
    if n@v<0.25: continue
    m,hr=measure(n,v)
    nb=int(((n*v)<0).sum())
    rows.append(dict(meas=m,VS=rule('VS',n,v),SQ=rule('SQ',n,v),L1=rule('L1',n,v),back=nb,nv=float(n@v),hit=hr))
for nm in ['VS','SQ','L1']:
    e=np.array([abs(r[nm]-r['meas']) for r in rows]); print(nm,'mae',e.mean().round(2),'max',e.max().round(1))
for b in [0,1,2]:
    e=[abs(r['VS']-r['meas']) for r in rows if r['back']==b]; print('back',b,len(e),np.mean(e).round(2) if e else None)
json.dump(rows,open('/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf6/check-colour/vs_recheck.json','w'),indent=0)
