# The phones the Knuckle is shown with in the viewer's "Phone" picker, and that hand_range.py keeps the hand clear of:
#   promax   an orange iPhone 17 Pro Max, 163.4 x 78.0 x 8.75 mm (Apple's tech specs)
#   duo      the iPhone Duo folded, 84.1 x 117.8 x 11.3 mm, 254 g, its MagSafe ring on the puck
#   duoOpen  the iPhone Duo open, 164.6 x 117.8 mm, on the Duo plate
# Viewer frame: x along the arm (+x is the grip's side), y the phone's long axis as held, z = 0 the puck's MagSafe face,
# the screen toward -z. Apple doesn't publish where the Pro Max's MagSafe ring sits, so it is centred on the puck.
# The Duo follows Apple's iPhone Duo Dimensional Drawings (developer.apple.com, 9 Sep 2026): its ring sits on the back of
# the camera half only, so open it is 40.9 mm from the fold and the phone's weight would hang that far off the puck's roll
# axis (Apple's Accessory Design Guidelines, 23.1.3: the ring alone does not hold the open Duo). The Duo plate snaps onto
# that ring and onto the alignment magnet below it, grips the camera half's back with a silicone pad, and carries a second
# ring for the puck where the phone and the plate balance. It stands 1.2 mm off the hinge and the cover screen: the
# guidelines say a mount must not press on the hinge, and must not cover the cover screen's active area either, which the
# plate and the puck still do over about 21 x 55 mm beside the fold. Open, the phone goes on the plate with its fold along
# the arm, so the arm reaches across its 117.8 mm height, past its long bottom edge. Apple publishes no centre of mass: the
# open Duo's is taken 2.5 mm from the fold toward the camera half at mid-height (an estimate from the parts each half
# carries, +-4 mm across and +-3 mm along).
# The Pro Max's camera bar height (about 2.5 mm, lenses about 4.2 mm) comes from measurements of dummy units; its other
# camera, button and corner details and both phones' colours are estimates (the Duo is Apple's Night Sky swatch).
# As a script it writes phone_meta.json and phone_b64.txt (packed like pack.py's mesh) into the current folder;
# hand_range.py imports it for sdf(). Needs numpy, shapely, trimesh, triangle, networkx.
import base64, json, math, os
import numpy as np
from shapely.geometry import LineString, Point, Polygon, box
from shapely.ops import unary_union

HERE = os.path.dirname(os.path.abspath(__file__))
exec(open(os.path.join(HERE, "gen.py")).read()); exec(open(os.path.join(HERE, "outlines.py")).read())

EDGE, GLASS = 1.2, 0.55                   # edge round-over, front glass thickness
MODELS = {"promax": "iPhone 17 Pro Max", "duo": "iPhone Duo, folded", "duoOpen": "iPhone Duo, open"}

# ---------- iPhone 17 Pro Max ----------
W, L, D = 78.0, 163.4, 8.75              # body: x, y, z (z = 0 is the back, the puck's side; the screen faces -z)
CORNER = 12.5                             # plan corner radius
BAR_Y0, BAR_INSET, BAR_H, BAR_R = 37.7, 0.8, 2.5, 5.0     # camera bar: lower edge, inset from the sides, height, lower corners
LENSES, LENS_R, LENS_GLASS, LENS_H = [(-24.5, 70.5), (-24.5, 50.5), (-7.5, 60.5)], 7.6, 5.9, 4.2
FLASH, LIDAR = (24.0, 70.5, 3.2), (24.0, 51.0, 3.6)
# buttons: (side, y from, y to); +x is the grip's side (left of the screen), -x the other
BUTTONS = [("Action Button", 1, 41.0, 48.0), ("Volume Up", 1, 25.0, 37.0), ("Volume Down", 1, 10.0, 22.0),
           ("Side Button", -1, 14.0, 36.0), ("Camera Control", -1, -38.0, -25.0)]

# ---------- iPhone Duo, from Apple's drawing ----------
# Drawing coordinates on the camera half's back: u from its free edge toward the hinge, v from the top, mm.
DW, DH, DT, DUO_G = 84.10, 117.80, 11.30, 254.0   # folded: free edge to the spine, height, thickness; grams
DU_AX, DHALF, DGAP = 82.2, 5.48, 0.34             # the fold axis from each free edge (open); each half's thickness; the gap
                                                  # between the halves folded (2 x 5.48 + 0.34 = 11.30; Apple markets 5.2 mm open)
DR_OUT, DR_HINGE, DROLL = 12.4, 3.0, 2.1          # plan corners at the free edge (a spline, about R 12.4) and the hinge; edge roll
                                                  # (2.74 on the drawing; 2.1 here, so it fits the halves' bodies under their glass)
DHINGE = 2.73                                     # the hinge band, either side of the fold axis
RING = (41.30, 61.31)                             # the MagSafe ring's centre (its 61.50 mm keepout circle)
CLOCK = (38.30, 92.49, 44.30, 111.80)             # the alignment magnet: Apple's 6.00 mm clocking magnet, 31.18-50.49 mm below the ring
DCAM_TOP = (4.94, 4.70, 60.56, 25.80, 10.55, 3.64)  # camera plateau's flat top: u0, v0, u1, v1, end radius; its height
DCAM_FOOT = 8.81                                  # its fillet meets the glass 8.81 mm out from the flat top all round (R 19.36 ends,
                                                  # Detail D), cut off by the top and free-edge rolls; the fillet's profile is a guess
DLENSES, DLENS_D, DLENS_H = [(15.25, 15.25), (32.98, 15.25)], 16.20, 5.72
DFLASH, DFLASH_H = (49.58, 19.70, 3.75), 4.73
# buttons, all on the camera half: (name, edge, centre, span, proud); "free" the free edge (centre from the top), "top" the
# top edge (centre from the free edge); their centrelines are 2.5-3.1 mm from the parting line between the halves
DBUTTONS = [("Side Button", "free", 42.87, 18.68, 0.45), ("Camera Control", "free", 84.97, 17.10, 0.1),
            ("Volume Up", "top", 39.75, 10.88, 0.45), ("Volume Down", "top", 26.37, 10.88, 0.45)]
DCG = (DU_AX - 2.5, DH / 2)                       # open: the centre of mass estimate (see above)

# ---------- the Duo plate ----------
PLATE_T, PAD_T = 1.5, 1.2                 # carbon plate (0.8 mm magnets between 0.35 mm skins); silicone pad: also its gap over
                                          # the hinge and the cover screen, and over the camera fillet's foot
ARRAY_R = 27.05                           # Apple's MagSafe accessory array, 54.10/46.00 mm, one on each side of the plate
CF_DENSITY, SI_DENSITY, MAG_DENSITY = 1.55e-3, 1.12e-3, 7.5e-3       # g/mm3: carbon/epoxy, silicone, NdFeB
ARRAY_G = math.pi * (ARRAY_R ** 2 - 23.0 ** 2) * 0.8 * MAG_DENSITY   # 3.8 g each
CLOCK_G = 6.0 * 19.31 * 0.8 * MAG_DENSITY                            # 0.7 g
ZB = -(PLATE_T + PAD_T)                   # the open Duo's back
def cam_outline(t):
    # the camera plateau's outline a fraction t of the way from the fillet's foot (0) to the flat top (1), drawing coordinates
    u0, v0, u1, v1, r, h = DCAM_TOP; vc = (v0 + v1) / 2       # the flat top is a pill: its ends are semicircles
    return LineString([(u0 + r, vc), (u1 - r, vc)]).buffer(r + (1 - t) * DCAM_FOOT, 64).intersection(box(3.0, 1.0, DU_AX, DH))
def foot():
    return cam_outline(0.0)
def plate_shapes(C):
    # in drawing coordinates, with the puck's ring at C: the carbon (round both rings and the alignment magnet, kept off the
    # camera fillet where it rises over 1 mm) and the pad (the camera half only, 4 mm short of the fold, off the fillet)
    body = unary_union([Point(RING).buffer(28.0, 128), Point(C).buffer(28.0, 128)]).convex_hull
    # the tab round Apple's clocking magnet crosses the Taptic Engine keepout's edge (u 44.05) by 0.75 mm: allowed, since
    # that keepout is for magnetic material and the magnet itself runs to u 44.30
    tab = box(CLOCK[0] - 3.0, RING[1], CLOCK[2] + 0.8, CLOCK[3] + 1.0)
    carbon = unary_union([body, tab]).difference(foot().buffer(-2.1, 64)).buffer(-2.0, 64).buffer(2.0, 64)
    pad = carbon.intersection(box(-50, -50, DU_AX - 4.0, 250)).difference(foot().buffer(0.5, 64)).buffer(-0.6, 64)
    return carbon, pad
def balance():
    # the puck's ring goes where the open phone and the plate (carbon, pad, magnets, the puck's ring included) balance
    C = DCG
    for _ in range(40):
        carbon, pad = plate_shapes(C)
        # the magnets take 0.8 mm of the carbon's 1.5 mm where they sit
        cf = (carbon.area * PLATE_T - (2 * math.pi * (ARRAY_R ** 2 - 23.0 ** 2) + 6.0 * 19.31) * 0.8) * CF_DENSITY
        m = [(DUO_G, DCG), (cf, carbon.centroid.coords[0]), (pad.area * PAD_T * SI_DENSITY, pad.centroid.coords[0]),
             (ARRAY_G, RING), (ARRAY_G, C), (CLOCK_G, ((CLOCK[0] + CLOCK[2]) / 2, (CLOCK[1] + CLOCK[3]) / 2))]
        M = sum(a for a, _ in m); C = (sum(a * p[0] for a, p in m) / M, sum(a * p[1] for a, p in m) / M)
    carbon, pad = plate_shapes(C)
    assert carbon.geom_type == "Polygon" and pad.geom_type == "Polygon" and carbon.contains(Point(C).buffer(ARRAY_R + 0.5)) \
        and carbon.contains(Point(RING).buffer(ARRAY_R + 0.5)) and carbon.contains(box(*CLOCK).buffer(0.2)), "the plate must hold its magnets"
    return C, M - DUO_G, carbon, pad
PUCK, PLATE_G, PLATE_C, PLATE_P = balance()

# drawing coordinates to the viewer, seen from behind (+z): folded, the ring on the puck's axis and the spine toward the grip;
# open on the plate, the puck's ring on the axis, the fold along the arm and the camera half below it (a rotation, not a mirror)
fold_xy = lambda u, v: (u - RING[0], RING[1] - v)
open_xy = lambda u, v: (v - PUCK[1], u - PUCK[0])

def rrect(x0, y0, x1, y1, r):
    return ccw(fillet([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], [r] * 4, 0.4))
def disc(cx, cy, r, n=48):
    return [(cx + r * math.cos(2 * math.pi * k / n), cy + r * math.sin(2 * math.pi * k / n)) for k in range(n)]
def plate(outline, holes, R, z0, z1, nq=3, axes=(0, 1, 2)):
    # a rounded-edge plate (gen.plate_mesh) as a closed triangle list; axes maps (outline a, outline b, thickness) to (x, y, z);
    # R may be a list, one radius per outline point
    import triangle as tr
    verts, tris, bottom, topf, groups = plate_mesh(math, outline, holes, R, min(R if not isinstance(R, list) else min(R), 0.4), z0, z1, 0.0, nq)
    V = np.array(verts); F = [list(t) for t in tris]
    for outer, inners in (bottom, topf):
        loops = [outer] + inners
        P2 = np.array([[V[i][0], V[i][1]] for Lp in loops for i in Lp]); segs, off = [], 0
        for Lp in loops:
            segs += [(off + k, off + (k + 1) % len(Lp)) for k in range(len(Lp))]; off += len(Lp)
        args = {"vertices": P2, "segments": np.array(segs)}
        if inners: args["holes"] = np.array([np.mean([[V[i][0], V[i][1]] for i in Lp], axis=0) for Lp in inners])
        res = tr.triangulate(args, "p"); assert len(res["vertices"]) == len(P2)
        idx = [i for Lp in loops for i in Lp]; F += [[idx[t[0]], idx[t[1]], idx[t[2]]] for t in res["triangles"]]
    out = np.zeros_like(V); out[:, axes[0]], out[:, axes[1]], out[:, axes[2]] = V[:, 0], V[:, 1], V[:, 2]
    return out, np.array(F)
def loft(loops, heights):
    # a closed solid through stacked outlines (each ccw, same point count, starting at the same place) at the given heights
    import triangle as tr
    n = len(loops[0]); V = [(x, y, z) for Lp, z in zip(loops, heights) for x, y in Lp]; F = []
    for k in range(len(loops) - 1):
        for j in range(n):
            a, b = k * n + j, k * n + (j + 1) % n; F += [(a, b, b + n), (a, b + n, a + n)]
    for k, flip in ((0, True), (len(loops) - 1, False)):
        res = tr.triangulate({"vertices": np.array(loops[k]), "segments": np.array([(j, (j + 1) % n) for j in range(n)])}, "p")
        assert len(res["vertices"]) == n
        F += [((k * n + c, k * n + b, k * n + a) if flip else (k * n + a, k * n + b, k * n + c)) for a, b, c in res["triangles"]]
    return np.array(V), np.array(F)
def start_at(pts):
    # resampled loops start at their point of largest x + y, so stacked loops line up
    k = max(range(len(pts)), key=lambda i: pts[i][0] + pts[i][1]); return pts[k:] + pts[:k]

def parts_promax():
    P = {}
    P["Phone Frame"] = ("ph", *plate(rrect(-W / 2, -L / 2, W / 2, L / 2, CORNER), [], EDGE, -D + GLASS, 0.0, 4))
    P["Phone Screen"] = ("sc", *plate(rrect(-W / 2 + EDGE, -L / 2 + EDGE, W / 2 - EDGE, L / 2 - EDGE, CORNER - EDGE), [], 0.4, -D, -D + GLASS, 2))
    bar = ccw(fillet([(-W / 2 + BAR_INSET, BAR_Y0), (W / 2 - BAR_INSET, BAR_Y0), (W / 2 - BAR_INSET, L / 2 - BAR_INSET), (-W / 2 + BAR_INSET, L / 2 - BAR_INSET)],
                     [BAR_R, BAR_R, CORNER - BAR_INSET, CORNER - BAR_INSET], 0.4))
    P["Camera Bar"] = ("ph", *plate(bar, [], 1.0, 0.0, BAR_H, 3))
    for i, (x, y) in enumerate(LENSES):
        P["Lens Ring %d" % (i + 1)] = ("lr", *plate(ccw(disc(x, y, LENS_R)), [cw(disc(x, y, LENS_GLASS))], 0.6, BAR_H, LENS_H, 2))
        P["Lens %d" % (i + 1)] = ("lg", *plate(ccw(disc(x, y, LENS_GLASS)), [], 0.3, BAR_H, LENS_H - 0.3, 2))
    P["Flash"] = ("fl", *plate(ccw(disc(*FLASH)), [], 0.3, BAR_H, BAR_H + 0.3, 2))
    P["LiDAR"] = ("lg", *plate(ccw(disc(*LIDAR)), [], 0.3, BAR_H, BAR_H + 0.4, 2))
    for name, side, y0, y1 in BUTTONS:
        # outline in the side's (y, z) plane, standing 0.6 mm proud of the frame
        x0 = side * (W / 2 - 0.2); x1 = side * (W / 2 + 0.6)
        P[name] = ("ph" if name != "Camera Control" else "lg", *plate(rrect(y0, -D / 2 - 1.6, y1, -D / 2 + 1.6, 1.5), [], 0.3, min(x0, x1), max(x0, x1), 2, axes=(1, 2, 0)))
    return P

# ---------- the Duo's parts, built in drawing coordinates and mapped by xy ----------
def mapped(pts, xy):
    return ccw([xy(u, v) for u, v in pts])
def half_outline(u_hinge):
    # one half's plan from its free edge (u = 0) to u_hinge: the free edge's corners round, the hinge side's tight; per-point radii
    o = fillet([(0, 0), (0, DH), (u_hinge, DH), (u_hinge, 0)], [DR_OUT, DR_OUT, DR_HINGE, DR_HINGE], 0.5)
    return o, [DROLL if u < u_hinge - DR_HINGE - 0.5 else 0.8 for u, v in o]
def duo_camera(P, xy, zb):
    # the plateau: a loft from the fillet's foot on the glass up to the flat top (a concave fillet, height ~ t squared), then
    # the lenses and the flash
    h = DCAM_TOP[5]; loops, hs = [], []
    for k in range(9):
        t = k / 8; o = list(cam_outline(t).exterior.coords)[:-1]
        loops.append(start_at(mapped(resample(ccw(o), 200), xy)))
        hs.append(zb + h * t * t)
    P["Camera Plateau"] = ("du", *loft(loops, hs))
    for i, (u, v) in enumerate(DLENSES):
        c = xy(u, v); R_ = DLENS_D / 2
        P["Lens Ring %d" % (i + 1)] = ("lr", *plate(ccw(disc(*c, R_)), [cw(disc(*c, R_ - 1.4))], 0.5, zb + h - 0.2, zb + DLENS_H, 2))
        P["Lens %d" % (i + 1)] = ("lg", *plate(ccw(disc(*c, R_ - 1.4)), [], 0.3, zb + h - 0.2, zb + DLENS_H - 0.3, 2))
    c = xy(DFLASH[0], DFLASH[1])
    P["Flash"] = ("fl", *plate(ccw(disc(*c, DFLASH[2] / 2 + 0.6)), [], 0.3, zb + h - 0.2, zb + DFLASH_H, 2))
def duo_buttons(P, xy, zb):
    for name, edge, c, span, proud in DBUTTONS:
        zc = zb - DHALF + 2.8                                   # about the middle of the camera half's edge
        if edge == "free":
            a, b = xy(-proud, c - span / 2), xy(0.3, c + span / 2)
        else:
            a, b = xy(c - span / 2, -proud), xy(c + span / 2, 0.3)
        x0, x1 = sorted((a[0], b[0])); y0, y1 = sorted((a[1], b[1]))
        P[name] = ("du", *plate(ccw([(x0, y0), (x1, y0), (x1, y1), (x0, y1)]), [], 0.15, zc - 1.2, zc + 1.2, 1))
def parts_duo():
    # folded: the camera half at the back (z 0 to -5.48), the cover-screen half in front, the hinge's spine toward the grip
    P = {}; zb = 0.0
    o, rad = half_outline(DU_AX - 1.0)
    P["Camera Half"] = ("du", *plate(mapped(o, fold_xy), [], rad[::-1] if area([fold_xy(*p) for p in o]) < 0 else rad, zb - DHALF, zb, 4))
    P["Fold Gap"] = ("lg", *plate(mapped(fillet([(0.8, 0.8), (0.8, DH - 0.8), (DU_AX - 1.5, DH - 0.8), (DU_AX - 1.5, 0.8)], [DR_OUT - 0.8] * 2 + [1.0] * 2, 0.5), fold_xy),
                                  [], 0.2, zb - DHALF - DGAP - 0.2, zb - DHALF + 0.2, 1))
    P["Cover Half"] = ("du", *plate(mapped(o, fold_xy), [], rad[::-1] if area([fold_xy(*p) for p in o]) < 0 else rad, zb - DT + 0.4, zb - DHALF - DGAP, 4))
    P["Cover Screen"] = ("sc", *plate(mapped(fillet([(1.33, 1.33), (1.33, DH - 1.33), (DU_AX - 1.33, DH - 1.33), (DU_AX - 1.33, 1.33)], [DR_OUT - 1.33] * 2 + [1.5] * 2, 0.5), fold_xy),
                                      [], 0.3, zb - DT, zb - DT + 0.4, 2))
    # the hinge's spine: a rounded cover along the closed edge, 1.23 mm short of the top and bottom
    a, b = fold_xy(DU_AX - 1.6, 1.23), fold_xy(DW, DH - 1.23)
    P["Hinge Spine"] = ("hg", *plate(ccw([(b[1], zb - DT + 0.2), (a[1], zb - DT + 0.2), (a[1], zb - 0.2), (b[1], zb - 0.2)]), [], 1.3, a[0], b[0], 2, axes=(1, 2, 0)))
    duo_camera(P, fold_xy, zb); duo_buttons(P, fold_xy, zb)
    return P
def parts_duo_open():
    # open on the plate: the camera half (its back glass, the ring) below the fold, the cover-screen half above, the hinge's
    # band between them, flush with the backs; the inner screen across both on the front
    P = {}; zb = ZB
    o, rad = half_outline(DU_AX - 0.17)
    mirror = lambda pts: [(2 * DU_AX - u, v) for u, v in pts]
    flip = lambda m, r: r[::-1] if area(m) < 0 else r
    mb = [open_xy(*p) for p in o]; ma = [open_xy(*p) for p in mirror(o)]
    P["Camera Half"] = ("du", *plate(ccw(mb), [], flip(mb, rad), zb - DHALF + 0.4, zb, 4))
    P["Cover Half"] = ("du", *plate(ccw(ma), [], flip(ma, rad), zb - DHALF + 0.4, zb - 0.5, 4))
    ci = fillet([(1.33, 1.33), (1.33, DH - 1.33), (DU_AX - 1.33, DH - 1.33), (DU_AX - 1.33, 1.33)], [DR_OUT - 1.33] * 2 + [1.5] * 2, 0.5)
    P["Cover Screen"] = ("sc", *plate(mapped(mirror(ci), open_xy), [], 0.3, zb - 0.5, zb, 2))
    s = fillet([(2.71, 2.71), (2.71, DH - 2.71), (2 * DU_AX - 2.71, DH - 2.71), (2 * DU_AX - 2.71, 2.71)], [DR_OUT - 2.71] * 4, 0.5)
    P["Inner Screen"] = ("sc", *plate(mapped(s, open_xy), [], 0.3, zb - DHALF, zb - DHALF + 0.4, 2))
    P["Hinge Band"] = ("hg", *plate(mapped([(DU_AX - DHINGE, 1.23), (DU_AX + DHINGE, 1.23), (DU_AX + DHINGE, DH - 1.23), (DU_AX - DHINGE, DH - 1.23)], open_xy),
                                    [], 0.4, zb - DHALF + 0.6, zb - 0.05, 2))
    duo_camera(P, open_xy, zb); duo_buttons(P, open_xy, zb)
    return P
def parts_plate():
    # the Duo plate: carbon on the puck's side with the two magnet arrays and the alignment magnet inside it, a silicone pad on
    # the phone's side
    c = start_at(mapped(resample(list(PLATE_C.exterior.coords)[:-1], 220), open_xy))
    p = start_at(mapped(resample(list(PLATE_P.exterior.coords)[:-1], 180), open_xy))
    return {"Duo Plate": ("cf", *plate(c, [], 0.5, -PLATE_T, 0.0, 3)), "Duo Plate Pad": ("si", *plate(p, [], 0.4, ZB, -PLATE_T, 2))}

def parts(model):
    return {"promax": parts_promax, "duo": parts_duo, "duoOpen": parts_duo_open}[model]()

def rbox(q, x0, y0, x1, y1, r, z0, z1):
    c = np.array([(x0 + x1) / 2, (y0 + y1) / 2]); h = np.array([(x1 - x0) / 2 - r, (y1 - y0) / 2 - r])
    d = np.abs(q[:, :2] - c) - h
    d2 = np.linalg.norm(np.maximum(d, 0), axis=1) + np.minimum(d.max(1), 0) - r
    dz = np.abs(q[:, 2] - (z0 + z1) / 2) - (z1 - z0) / 2
    e = np.stack([d2, dz], 1)
    return np.linalg.norm(np.maximum(e, 0), axis=1) + np.minimum(e.max(1), 0)
def box_of(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]; return min(xs), min(ys), max(xs), max(ys)
def sdf(p, model="promax"):
    # signed distance (mm) from points p (n x 3, viewer coords) to the phone; the Duo's body and camera as rounded boxes (its
    # buttons stand under 0.5 mm proud on edges away from the grip), and, open, the Duo plate
    if model == "promax":
        d = rbox(p, -W / 2, -L / 2, W / 2, L / 2, CORNER, -D, 0.0)
        d = np.minimum(d, rbox(p, -W / 2 + BAR_INSET, BAR_Y0, W / 2 - BAR_INSET, L / 2 - BAR_INSET, BAR_R, 0.0, BAR_H))
        for x, y in LENSES:
            d = np.minimum(d, rbox(p, x - LENS_R, y - LENS_R, x + LENS_R, y + LENS_R, LENS_R, BAR_H, LENS_H))
        for name, side, y0, y1 in BUTTONS:
            x0, x1 = sorted((side * (W / 2 - 0.2), side * (W / 2 + 0.6)))
            d = np.minimum(d, rbox(p[:, [1, 2, 0]], y0, -D / 2 - 1.6, y1, -D / 2 + 1.6, 1.5, x0, x1))
        return d
    f = foot().bounds
    if model == "duo":
        x0, y0, x1, y1 = box_of([fold_xy(0, 0), fold_xy(DW, DH)])
        d = rbox(p, x0, y0, x1, y1, DR_HINGE, -DT, 0.0)
        cx0, cy0, cx1, cy1 = box_of([fold_xy(f[0], f[1]), fold_xy(f[2], f[3])])
        return np.minimum(d, rbox(p, cx0, cy0, cx1, cy1, 6.0, 0.0, DLENS_H))
    x0, y0, x1, y1 = box_of([open_xy(0, 0), open_xy(2 * DU_AX, DH)])
    d = rbox(p, x0, y0, x1, y1, DR_HINGE, ZB - DHALF, ZB)
    cx0, cy0, cx1, cy1 = box_of([open_xy(f[0], f[1]), open_xy(f[2], f[3])])
    d = np.minimum(d, rbox(p, cx0, cy0, cx1, cy1, 6.0, ZB, ZB + DLENS_H))
    px0, py0, px1, py1 = box_of(mapped(list(PLATE_C.exterior.coords)[:-1], open_xy))
    return np.minimum(d, rbox(p, px0, py0, px1, py1, 8.0, ZB, 0.0))

if __name__ == "__main__":
    import trimesh
    chunks, meta, off = [], [], 0
    def add(name, group, model, mat, V, F):
        global off
        m = trimesh.Trimesh(V, F, process=True); trimesh.repair.fix_normals(m)
        assert m.is_watertight and m.volume > 0, (model, name)
        T = m.vertices[m.faces]                      # outward winding, as pack.py writes the SketchUp parts
        q = np.round(T * 100).astype("<i2").reshape(-1)
        chunks.append(q); meta.append({"name": name, "group": group, "model": model, "mat": mat, "start": off, "count": int(q.size)}); off += q.size
    for model in MODELS:
        for name, (mat, V, F) in parts(model).items(): add(name, "phone", model, mat, V, F)
    for name, (mat, V, F) in parts_plate().items(): add(name, "plate", "duoOpen", mat, V, F)
    allq = np.concatenate(chunks)
    ring = open_xy(*RING)
    info = {"models": MODELS, "plate": {"puck_from_ring": round(math.dist(PUCK, RING), 2), "puck_from_fold": round(DU_AX - PUCK[0], 2), "grams": round(PLATE_G, 1),
                                        "t": PLATE_T + PAD_T, "carbon_mm2": round(PLATE_C.area), "pad_mm2": round(PLATE_P.area), "ring_xy": [round(c, 2) for c in ring]}}
    json.dump({"parts": meta, "source": "phones: iPhone 17 Pro Max and iPhone Duo references (phone.py)", **info}, open("phone_meta.json", "w"), separators=(",", ":"))
    open("phone_b64.txt", "w").write(base64.b64encode(allq.tobytes()).decode())
    print("phone parts", len(meta), "| triangles", off // 9, "| bytes", allq.nbytes, "|", info)
