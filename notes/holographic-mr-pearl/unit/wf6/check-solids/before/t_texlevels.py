import sys; sys.path.insert(0,'.')
from common import *
N=21
occ=np.ones((N,N,N),bool)
O,D,shape,px=drawing_view((N/2,)*3,1.9*N,700,700)
ims=[]
r0=walk(occ,O[:200000],D[:200000],film='face',stop_after=2,K=4)
v0=colour(r0,'face',np.full(200000,np.nan))
for s in (1,3,8,21):
    r=walk_face(occ,O,D,tex=s)
    v=r['val']; cov=np.isfinite(v)
    if s==1: print('walk_face(1) vs walk face: px differing', np.nansum(np.abs(v[:200000]-v0)>0), 'of', np.isfinite(v0).sum())
    img=np.where(cov,v,240).reshape(shape)
    img=img.reshape(350,2,350,2).mean((1,3))
    ims.append(np.repeat(img[...,None],3,2).astype(np.uint8))
sheet([ims],'C3_cube21_texture_levels.png',[['cube F(8)=21 m, texture unit 1 m','texture unit F(4)=3 m (7 per edge)','texture unit F(6)=8 m (does not tile 21)','texture unit F(8)=21 m: one figure']])
