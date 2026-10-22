import numpy as np, sys
sys.path.insert(0,'.')
from common import *
occ=np.ones((1,1,1),bool)
O,D,shape,px=drawing_view((0.5,0.5,0.5),1.9,300,300)
r=walk(occ,O,D,film='none')
bg=np.full(len(O),236.0)
v=colour(r,'bare',bg)
img=np.repeat(v.reshape(shape)[...,None],3,2).astype(np.uint8)
save(img,'t_unit_drawing.png')
# compare with the drawing's tone layout roughly: fractions
print('fractions grey/black/white', [(v==t).mean() for t in (128,0,255)])
print('unit volume', unit_volume())
