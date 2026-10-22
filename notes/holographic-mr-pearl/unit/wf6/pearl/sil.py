"""sil.py - front-view silhouettes of the model on cover 1 (convex hulls filled with PIL) and their fit.
Reference: wf5/form/meas/ref_mask.npy (sky mask for head + hat, hand-traced polygon for the body) and
ref_care.npy (pixels to score)."""
import numpy as np
from PIL import Image, ImageDraw
from prims import hull_points, convex_hull
import pmodel as M

F5 = '/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf5/form/meas/'
REF = np.load(F5 + 'ref_mask.npy')
CARE = np.load(F5 + 'ref_care.npy')
H, W = REF.shape
PROJ = np.array([[1.0, 0, 0], [0, 0, -1.0]])          # model px -> (u - U0, v - V0)


def poly_of(pr, ss=1):
    pts = hull_points(pr, PROJ)
    hull = convex_hull(pts)
    return [((x + M.U0) * ss, (y + M.V0) * ss) for x, y in hull]


def mask_of(prims, ss=1, box=None, parts=None):
    """union silhouette, optionally supersampled ss and limited to a box (u0, v0, u1, v1)"""
    if box is None:
        box = (0, 0, W, H)
    u0, v0, u1, v1 = box
    im = Image.new('L', ((u1 - u0) * ss, (v1 - v0) * ss), 0)
    d = ImageDraw.Draw(im)
    for pr in prims:
        if parts is not None and pr['part'] not in parts:
            continue
        poly = [(x - u0 * ss, y - v0 * ss) for x, y in poly_of(pr, ss)]
        if len(poly) >= 3:
            d.polygon(poly, fill=255)
    a = np.asarray(im, float) / 255.0
    if ss > 1:
        a = a.reshape(v1 - v0, ss, u1 - u0, ss).mean((1, 3))
    return a > 0.5


def iou(prims, box=None, ref=REF, care=CARE, ss=1):
    box = box or (0, 0, W, H)
    u0, v0, u1, v1 = box
    m = mask_of(prims, ss, box)
    r = ref[v0:v1, u0:u1]; c = care[v0:v1, u0:u1]
    inter = (m & r & c).sum(); uni = ((m | r) & c).sum()
    return inter / max(uni, 1), m


def diff_image(prims, path, box=None, scale=1):
    box = box or (0, 0, W, H)
    u0, v0, u1, v1 = box
    m = mask_of(prims, 2, box)
    r = REF[v0:v1, u0:u1]; c = CARE[v0:v1, u0:u1]
    img = np.zeros(m.shape + (3,), np.uint8)
    img[:] = (25, 25, 30)
    img[m & r] = (200, 200, 200)
    img[r & ~m] = (255, 60, 60)        # in the cover, missing from the model
    img[m & ~r] = (60, 130, 255)       # in the model, not in the cover
    img[~c] = (img[~c] * 0.4).astype(np.uint8)
    im = Image.fromarray(img)
    if scale != 1:
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    im.save(path)
    return path
