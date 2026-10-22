import numpy as np
from common import *
cls = np.load(UNIT + 'cls.npy'); cc = np.load(S + 'wf3/colour-albers/cls_clean.npy'); ho = np.load(S + 'wf3/colour-albers/cls_holes.npy')
dr = np.load(OUT + 'drawn_cls.npy').astype(int)
print('cls', np.unique(cls, return_counts=True))
print('holes', np.unique(ho, return_counts=True))
v = cls != -2
for nm, ref in [('cls', cls), ('cls_clean', cc), ('cls_holes', ho)]:
    w = (dr != ref) & v & (ref != -2)
    print(nm, 'wrong (excluding -2 in cls and ref):', int(w.sum()))
# where are cls_clean's -1 vs cls?
print('cls_clean vs cls differ where cls valid:', int(((cc != cls) & v).sum()))
from collections import Counter
w = (dr != cls) & v
print(Counter(zip(cls[w].tolist(), dr[w].tolist())).most_common(10))
