import sys
from caster import *
cls = np.load(UNIT + 'cls.npy')
holes_cls = np.load(SCR + 'wf3/colour-albers/cls_holes.npy')
_rid = np.load(OUT + 'vec_rid.npy'); _vt = np.load(OUT + 'vec_tone.npy')
HOLES = (_rid >= 9) & (_vt == -1)          # the four drawn hole polygons (vectorize's convention, 8440 px)
VEC = _vt


def mismatch(tone):
    """vectorize/final_metrics.py convention: vs cls, paper in the four holes counts as 2 (cls's label for it)"""
    tt = tone.copy(); tt[HOLES & (tt == -1)] = 2
    valid = cls != -2
    m = (tt != cls) & valid
    fig = ((cls >= 0) | (tt >= 0)) & valid
    # and against the corrected classes (holes are paper)
    m2 = (tone != holes_cls) & valid
    fig2 = ((holes_cls >= 0) | (tone >= 0)) & valid
    return dict(wrong=int(m.sum()), figure_px=int(fig.sum()), pct=round(100 * m.sum() / fig.sum(), 3),
                px_differing_from_vector_reading=int((tone != VEC).sum()),
                wrong_holes_as_paper=int(m2.sum()), pct_holes_as_paper=round(100 * m2.sum() / fig2.sum(), 3)), m


if __name__ == '__main__':
    import pickle
    res = {}
    vec_t = None
    for var in ['straight', 'cut', 'V3', 'V1']:
        prims = build_cut() if var == 'cut' else build(var)[0]
        R = drawing_view(prims)
        mm, m = mismatch(R['tone'])
        res[var] = mm; print(var, mm, flush=True)
        np.save(OUT + 'tone_%s.npy' % var, R['tone'])
    json.dump(res, open(OUT + 'mismatch_first.json', 'w'), indent=1)
