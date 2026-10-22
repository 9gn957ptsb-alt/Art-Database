"""ortho ray caster for Convex primitives: returns depth t, tone, face id, bar/beam id, normal per pixel"""
from geom import *


def view_basis(dirv, up):
    d = np.asarray(dirv, float); d = d / np.linalg.norm(d)
    u = np.asarray(up, float); u = u - d * (u @ d); u /= np.linalg.norm(u)
    r = np.cross(d, u)
    return d, u, r


def cast(prims, centre, d, u, r, A, B, far=30.0):
    """A, B: image-plane coordinates (along r, u) of each pixel, any shape"""
    shp = A.shape
    O = centre + A[..., None] * r + B[..., None] * u - d * far
    O = O.reshape(-1, 3); A1 = A.ravel(); B1 = B.ravel()
    n = O.shape[0]
    best = np.full(n, np.inf); tone = np.full(n, -1); fid = np.full(n, -1); beam = np.full(n, -1)
    nrm = np.zeros((n, 3))
    for p in prims:
        ca = (p.corners - centre) @ r; cb = (p.corners - centre) @ u
        sel = np.nonzero((A1 >= ca.min() - 1e-3) & (A1 <= ca.max() + 1e-3) & (B1 >= cb.min() - 1e-3) & (B1 <= cb.max() + 1e-3))[0]
        if sel.size == 0: continue
        Os = O[sel]
        num = p.w[None, :] - Os @ p.N.T
        den = np.broadcast_to(d @ p.N.T, num.shape)
        with np.errstate(divide='ignore', invalid='ignore'):
            t = num / den
        enter = np.where(den < 0, t, -np.inf); leave = np.where(den > 0, t, np.inf)
        tn = enter.max(-1); tf = leave.min(-1); ax = enter.argmax(-1)
        ok = ((den != 0) | (num >= 0)).all(-1)
        hit = ok & (tn <= tf) & (tf > 0) & (tn < best[sel])
        hs = sel[hit]
        best[hs] = tn[hit]; tone[hs] = p.tone[ax[hit]]; fid[hs] = p.fid[ax[hit]]; beam[hs] = p.beam
        nrm[hs] = p.N[ax[hit]]
    return dict(t=best.reshape(shp), tone=tone.reshape(shp), fid=fid.reshape(shp), beam=beam.reshape(shp), n=nrm.reshape(shp + (3,)))


def drawing_view(prims, shape=(630, 1200), f=FIT):
    A, B = pix_ab(shape, f)
    return cast(prims, C, D, U, RV, A, B)


def turned(prims, deg, size=700, span=3.4, below=False, up_axis=None):
    """the drawing view turned deg about the up axis (U, through C); below: the eye under the figure"""
    def rot(axis, ang):
        axis = axis / np.linalg.norm(axis); K = np.array([[0, -axis[2], axis[1]], [axis[2], 0, -axis[0]], [-axis[1], axis[0], 0]])
        return np.eye(3) + math.sin(ang) * K + (1 - math.cos(ang)) * K @ K
    if below:
        Rm = rot(RV, math.radians(deg))
    else:
        Rm = rot(U if up_axis is None else up_axis, math.radians(deg))
    d = Rm @ D; u = Rm @ U; r = np.cross(d, u)
    g = np.linspace(-span / 2, span / 2, size)
    A, B = np.meshgrid(g, -g)
    return cast(prims, C, d, u, r, A, B), (d, u, r)
