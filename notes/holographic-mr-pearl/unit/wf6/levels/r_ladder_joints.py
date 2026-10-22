"""Close-ups of the three joints of a level-3 frame (A over B at right-middle, B over C at bottom-middle, C over A at
left-middle, by the cyclic tilt) and the opening, with the woven unit at H = 1/9."""
import numpy as np, math
from PIL import Image
import nest as N, ladder as LD, r_ladder as R
fr = LD.nest_frames(3, 2, openings=True)
prm = R.prims_of(fr)
s = LD.F(5) / 3       # the level-3 frame's side in L... joints at s * (_rm, _bm, _lm)
tiles = []
for name, J in (('right-middle joint (A over B?)', N._rm), ('bottom-middle (B over C?)', N._bm), ('left-middle (C over A?)', N._lm), ('the opening (level -1, inverted)', np.zeros(2))):
    c = J * s; sp = 0.75
    O, D = N.lv.drawing_rays(c[0] - sp, c[0] + sp, c[1] - sp * 0.8, c[1] + sp * 0.8, 520)
    tone, idx = N.lv.cast(prm, O, D, want_level=True)
    img = N.picture(tone, idx)
    img = R.film(img, tone, idx, fr, lambda f: {'A': 2, 'B': 3, 'C': 4}.get(f.path[:1], -1))
    tiles.append(R.label(img, name))
Image.fromarray(np.concatenate(tiles, 1)).save('ladder_joints.png')
