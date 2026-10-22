import numpy as np, sys
sys.path.insert(0,'.')
from common import *
for N in (1,3):
    occ=np.ones((N,N,N),bool)
    O,D,shape,px=drawing_view((N/2,)*3,1.9*N,360,360)
    r=walk(occ,O,D,film='face',stop_after=2,K=4)
    v=colour(r,'face',np.full(len(O),np.nan))
    cov=np.isfinite(v)
    img=np.where(cov,v,240).reshape(shape)
    save(np.repeat(img[...,None],3,2).astype(np.uint8),'t_face_cube%d.png'%N)
    vals,cnt=np.unique(v[cov],return_counts=True)
    print(N,'tests',r['tests'][cov].mean(),'colours',dict(zip(vals.astype(int),np.round(cnt/cov.sum(),3))))
