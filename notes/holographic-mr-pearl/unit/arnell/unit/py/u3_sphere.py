"""(3) Motion transforms 2D into 3D (p24) and the aisle spheres of bands (p26), applied to the unit.
The unit is drawn as a flat decal of the drawing (drawing2d polygons, H = 1/9), ray-cast orthographically."""
import sys, json, math
ARN = sys.argv[1]
sys.path.insert(0, ARN + "/unit/py")
import common as C
import numpy as np
from PIL import Image, ImageDraw
F, U, PHI = C.F, C.U, C.PHI
SQ3 = math.sqrt(3)
D = C.D
res = {}

# texture of the drawing (tones -1 paper, 0 grey, 1 black, 2 white), centroid at (450, 460)
TS = 400.0
TEX = D.raster(D.H9, (TS, 450.0, 460.0, 1.0), (720, 900))
R8 = 8 * U / SQ3              # holding circle of the leaf (block units)
HFIG = 8 * U * SQ3 / 2        # outline height
SFIG = 8 * U                  # outline side
TONE = np.array([[128, 128, 128], [14, 14, 14], [250, 250, 250]], float)

def tex(a, b):
    x = np.round(450 + a * TS).astype(int); y = np.round(460 - b * TS).astype(int)
    ok = (x >= 0) & (x < 900) & (y >= 0) & (y < 720)
    out = np.full(a.shape, -1)
    out[ok] = TEX[y[ok], x[ok]]
    return out

def camera(az, el, size, span):
    az, el = math.radians(az), math.radians(el)
    d = -np.array([math.cos(el) * math.sin(az), math.sin(el), math.cos(el) * math.cos(az)])  # looking toward -d0
    up0 = np.array([0, 1.0, 0])
    r = np.cross(d, up0); r /= np.linalg.norm(r)
    u = np.cross(r, d)
    g = np.linspace(-span / 2, span / 2, size)
    A, B = np.meshgrid(g, -g)
    O = A[..., None] * r + B[..., None] * u - d * 50
    return O.reshape(-1, 3), d, (size, size), r, u

def render(decals, az=25, el=18, size=640, span=3.2, spheres=(), light=(0.4, 0.8, 0.45), bg=(250, 248, 243)):
    O, d, shp, r, u = camera(az, el, size, span)
    n = O.shape[0]
    best = np.full(n, np.inf); col = np.tile(np.array(bg, float), (n, 1)); cover = np.zeros(n, bool)
    L = np.array(light) / np.linalg.norm(light)
    pr = O @ r; pu = O @ u
    for (c, ea, eb, sc, inv) in decals:
        c = np.asarray(c, float); ea = np.asarray(ea, float); eb = np.asarray(eb, float)
        nn = np.cross(ea, eb)
        cr, cu = c @ r, c @ u
        rad = 1.4 * R8 * sc
        sel = np.nonzero((np.abs(pr - cr) < rad) & (np.abs(pu - cu) < rad))[0]
        if sel.size == 0:
            continue
        den = d @ nn
        if abs(den) < 1e-9:
            continue
        t = ((c - O[sel]) @ nn) / den
        p = O[sel] + t[:, None] * d
        a = (p - c) @ ea / sc; b = (p - c) @ eb / sc
        if inv:
            a, b = -a, -b
        tn = tex(a, b)
        hit = (tn >= 0) & (t < best[sel])
        hs = sel[hit]
        best[hs] = t[hit]; cover[hs] = True
        shade = 0.72 + 0.28 * abs(nn @ L)
        if den > 0:   # the back of the decal
            shade *= 0.85
        col[hs] = TONE[tn[hit]] * shade + (1 - shade) * 40
    for (c, R, rgb) in spheres:
        c = np.asarray(c, float)
        oc = O - c
        bq = oc @ d; cq = (oc * oc).sum(1) - R * R
        disc = bq * bq - cq
        ok = disc >= 0
        t = -bq - np.sqrt(np.where(ok, disc, 0))
        hit = ok & (t < best)
        p = O[hit] + t[hit, None] * d
        nr = (p - c) / R
        lam = np.clip(nr @ L, 0, 1)
        spec = np.clip((nr @ (L - d) / np.linalg.norm(L - d)), 0, 1) ** 40
        best[hit] = t[hit]; cover[hit] = True
        col[hit] = np.array(rgb) * (0.35 + 0.65 * lam[:, None]) + 255 * spec[:, None] * 0.6
    img = np.clip(col, 0, 255).reshape(shp + (3,)).astype(np.uint8)
    return Image.fromarray(img), cover.reshape(shp)

def silhouette_stats(cover, span):
    H, W = cover.shape
    ys, xs = np.nonzero(cover)
    cy, cx = ys.mean(), xs.mean()
    ang = np.arctan2(ys - cy, xs - cx); rr = np.hypot(ys - cy, xs - cx)
    bins = np.linspace(-np.pi, np.pi, 361)
    idx = np.digitize(ang, bins)
    rmax = np.array([rr[idx == i].max() if np.any(idx == i) else np.nan for i in range(1, 361)])
    rmax = rmax[~np.isnan(rmax)]
    return dict(mean_r_px=float(rmax.mean()), rel_range=float((rmax.max() - rmax.min()) / rmax.mean()),
                rel_std=float(rmax.std() / rmax.mean()), fill_of_disc=float(cover.sum() / (math.pi * rmax.mean() ** 2)))

# ---------- (a) the figure turned about its median: N copies over 180 deg
def meridian(N, sc=1.0):
    out = []
    for i in range(N):
        al = math.pi * i / N
        ea = np.array([math.cos(al), 0, math.sin(al)])
        out.append(((0, 0, 0), ea, (0, 1, 0), sc, False))
    return out

res["meridian"] = dict(rule="N copies of the figure on planes through its vertical median, turned by 180/N deg each (p24: 180 deg suffices)",
                       limit="the swept outline is a CONE: apex at the holding sphere's pole (b = R), base circle radius R*sqrt3/2 at b = -R/2 (latitude -30)",
                       holding_sphere_R_block=R8, cone_apex_angle_deg=60.0,
                       N2="hull of 2 copies at 90 deg = a square pyramid: base diagonal = side S, base side S/sqrt2, height S*sqrt3/2; face slant/half-base = sqrt7 = 2.646 (not phi)",
                       sphere_touch="the cone meets the holding sphere only at the pole and along the latitude -30 circle",
                       cone_volume_fraction_of_sphere=float((1 / 3 * math.pi * (R8 * SQ3 / 2) ** 2 * (1.5 * R8)) / (4 / 3 * math.pi * R8 ** 3)),
                       closure="from an eye on the equator at a copy's azimuth only that copy closes; a copy turned by t opens by "
                               "0.151 (5 deg), 0.596 (20), 1.259 (45) of its own size (wf6/levels q_ladder_closure)")
tiles_a = []
for Nn in (2, 3, 5, 8):
    im, cov = render(meridian(Nn), az=20, el=16, size=420, span=3.0)
    dr = ImageDraw.Draw(im)
    # holding sphere outline (ortho: circle radius R8) and label
    k = 420 / 3.0; cx = cy = 210
    dr.ellipse([cx - R8 * k, cy - R8 * k, cx + R8 * k, cy + R8 * k], outline=(30, 70, 160), width=1)
    dr.text((10, 8), f"N = {Nn} copies, {180/Nn:.1f} deg apart" + ("  (hull: square pyramid)" if Nn == 2 else "") + ("  -> the cone" if Nn == 8 else ""),
            fill=(20, 20, 20), font=C.font(14))
    tiles_a.append(im)

# ---------- (b) the sphere of bands: B = F(k) latitude bands of equal height (Archimedes: equal area)
def bands(B, R):
    out = []; info = []
    h = 2 * R / B
    for j in range(B):
        z0, z1 = -R + j * h, -R + (j + 1) * h
        la0, la1 = math.asin(max(-1, z0 / R)), math.asin(min(1, z1 / R))
        lac = (la0 + la1) / 2
        ds = R * (la1 - la0)
        sc = ds / HFIG
        S = SFIG * sc
        p = max(1, round(2 * math.pi * R * math.cos(lac) / S))
        n = 2 * p
        info.append(dict(band=j, lat_deg=math.degrees(lac), arc_height=ds, figures=n))
        for i in range(n):
            lo = 2 * math.pi * i / n + (math.pi / n if j % 2 else 0)
            nr = np.array([math.cos(lac) * math.sin(lo), math.sin(lac), math.cos(lac) * math.cos(lo)])
            east = np.array([math.cos(lo), 0, -math.sin(lo)])
            north = np.cross(nr, east)
            c = nr * R
            inv = (i % 2 == 1)
            # an upright frame and an inverted one alternate along the band (the ladder's point reflection);
            # each is centred on the band so its outline spans it
            out.append((c, east, north, sc, inv))
    return out, info

def golden(N, R):
    out = []
    S = math.sqrt(16 * math.pi * R * R / (SQ3 * N))   # equal-area triangles
    sc = S / SFIG
    ga = math.pi * (3 - math.sqrt(5))                  # the golden angle, 137.51 deg
    for i in range(N):
        z = 1 - (2 * i + 1) / N
        la = math.asin(z); lo = i * ga
        nr = np.array([math.cos(la) * math.sin(lo), math.sin(la), math.cos(la) * math.cos(lo)])
        east = np.array([math.cos(lo), 0, -math.sin(lo)])
        north = np.cross(nr, east)
        out.append((nr * R, east, north, sc, False))
    return out, dict(N=N, golden_angle_deg=math.degrees(ga), side=S, scale=sc)

RS = 1.0
B = 13
dec_b, info_b = bands(B, RS)
dec_g, info_g = golden(144, RS)
im_b, cov_b = render(dec_b, az=25, el=18, size=520, span=2.6)
im_g, cov_g = render(dec_g, az=25, el=18, size=520, span=2.6)
im_h, cov_h = render([], az=25, el=18, size=520, span=2.6, spheres=[((0, 0, 0), RS, (236, 230, 220))])
res["bands"] = dict(rule="B = F(k) latitude bands of equal height 2R/B (Archimedes: equal area); each band a ring of figures alternating "
                         "upright and point-reflected (the ladder's opening rule), each figure as tall as its band's arc; 2*round(2 pi R cos(lat)/S) per band",
                    B=B, bands=info_b, total_figures=len(dec_b), silhouette=silhouette_stats(cov_b, 2.6),
                    count_rule="B = the largest Fibonacci number with 2R/B >= the leaf's height (1.886 blocks): bands never finer than the leaf, "
                               "so the facets never vanish at any size",
                    facet_sagitta=dict(pole=float(1 - math.cos(math.acos(1 - 2 / B) / 2)), equator=float(1 - math.cos(math.asin(1 / B)))))
res["golden_spiral"] = dict(info_g, rule="N = F(k) figures at z_i = 1-(2i+1)/N, longitude i * golden angle: equal area each; its visible spirals run in consecutive Fibonacci counts",
                            silhouette=silhouette_stats(cov_g, 2.6))
res["head"] = dict(rule="the circle turned about a diameter (p24): ray-cast, exactly round", silhouette=silhouette_stats(cov_h, 2.6))
tab = []
for Rb in (2, 5, 10, 20, 50, 100, 500):
    Bm = 2 * Rb / HFIG
    k = 1
    while F(k + 1) <= Bm:
        k += 1
    tab.append(dict(R_blocks=Rb, max_bands=round(Bm, 2), B=F(k) if F(k) >= 1 else 1))
res["band_count_table"] = tab

# ---------- cube: each tribar is a unit cube's edge path from a vertex to the opposite one
res["cube"] = dict(A_tribar="Ay (0,0,0)->(0,1,0), Ax ->(1,1,0), Az ->(1,1,1): three edges of the unit cube, ends a cube diagonal apart = the line of sight",
                   B_tribar="Bx (-1,1,-1)->(0,1,-1), Bz ->(0,1,0), By ->(0,2,0): ends differ by (1,1,1)",
                   C_tribar="Cx (0,1,-1)->(1,1,-1), Cz ->(1,1,0), Cy ->(1,2,0): ends differ by (1,1,1)",
                   reading="the impossible joint is the cube's main diagonal seen end on; the cube is each tribar's hidden solid; "
                           "a cube is 6 such paths (the 6 orders of x, y, z), which use all 12 edges")
json.dump(res, open(C.OUT + "u3_sphere.json", "w"), indent=1, default=float)

# cube diagram: drawing view (along (1,1,1)) and turned 30 deg
def proj(p, az):
    d = -np.array([1, 1, 1]) / SQ3
    up = np.array([0, -1, 1]) / math.sqrt(2)
    rr = np.cross(d, up)
    c, s_ = math.cos(math.radians(az)), math.sin(math.radians(az))
    K = np.array([[0, -up[2], up[1]], [up[2], 0, -up[0]], [-up[1], up[0], 0]])
    Rm = np.eye(3) + s_ * K + (1 - c) * K @ K
    d2 = Rm @ d; r2 = np.cross(d2, up)
    return np.array([p @ r2, p @ up])
cubes = []
for az in (0, 30):
    pc = C.Pic(300, 300, 95, 150, 150)
    V = [np.array(v, float) - 0.5 for v in np.ndindex(2, 2, 2)]
    E = [(i, j) for i in range(8) for j in range(i + 1, 8) if np.sum(np.abs(V[i] - V[j])) == 1]
    for i, j in E:
        pc.line([tuple(proj(V[i], az)), tuple(proj(V[j], az))], col=(170, 170, 170), width=1)
    path = [np.array(p, float) - 0.5 for p in ((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 1, 1))]
    cols = [(14, 14, 14), (128, 128, 128), (60, 60, 60)]
    for q in range(3):
        pc.line([tuple(proj(path[q], az)), tuple(proj(path[q + 1], az))], col=(200, 30, 40), width=4)
    pc.dot(*proj(path[0], az), 5, (30, 70, 160)); pc.dot(*proj(path[3], az), 3, (30, 140, 90))
    pc.text(8, 6, "tribar A = cube edges y, x, z" if az == 0 else "turned 30: the ends part", sz=13, px=True)
    pc.text(8, 276, "seen along (1,1,1): ends coincide" if az == 0 else "(0,0,0) blue, (1,1,1) green", sz=12, px=True)
    cubes.append(pc.done())

# ---------- compose
right = Image.new("RGB", (3 * 525 + 330, 1080), (250, 248, 243))
dr = ImageDraw.Draw(right)
for i, t in enumerate(tiles_a):
    right.paste(t, (i * 425, 30))
dr.text((10, 6), "(a) p24's rule on the unit: the figure turned about its median (blue: the holding sphere). The sweep gives the CONE, not the sphere.", fill=(20, 20, 20), font=C.font(15))
y2 = 480
dr.text((10, y2 - 24), f"(b) the sphere of bands, B = 13 (Fibonacci), {len(dec_b)} figures          (c) golden spiral, N = 144 figures          (d) his head: the one true sphere",
        fill=(20, 20, 20), font=C.font(15))
for i, im in enumerate((im_b, im_g, im_h)):
    right.paste(im, (i * 525, y2))
sb, sg, sh = res["bands"]["silhouette"], res["golden_spiral"]["silhouette"], res["head"]["silhouette"]
for i, sst in enumerate((sb, sg, sh)):
    dr.text((i * 525 + 10, y2 + 525), f"silhouette radius: range {100*sst['rel_range']:.1f}%  std {100*sst['rel_std']:.2f}%  of its mean",
            fill=(30, 70, 160), font=C.font(14))
for i, cimg in enumerate(cubes):
    right.paste(cimg, (3 * 525 + 15, y2 - 10 + i * 302))
dr.text((3 * 525 + 15, y2 - 28), "(e) the cube under each tribar", fill=(20, 20, 20), font=C.font(14))
left_a = C.page_crop(24, (363, 1023, 2046, 1650), 420)
left_b = C.page_crop(26, (198, 3696, 3036, 4686), 520)
left = Image.new("RGB", (max(left_a.width, left_b.width), right.height), "white")
left.paste(left_a, (0, 30)); left.paste(left_b, (0, y2))
# cube panels under the page crops
foot = [
    "p24: a sphere is a circle turned about a diameter.  p26: spheres built of flat ribbon bands (~15 rings), visibly built.",
    f"(a) The unit turned about its median sweeps a cone (apex angle 60, inside the holding sphere R = 8u/sqrt3 = {R8:.4f}, touching it only at the pole and latitude -30);"
    " 2 copies at 90 deg already hull a square pyramid. Rotation can never make the unit a sphere: only the circle (the head) does.",
    f"(b) Bands: B = F(k) equal-height bands (equal area), figures alternating upright / point-reflected. B = 13 here; the count rule is the largest Fibonacci B with band height 2R/B >= the leaf "
    "(1.886 blocks),",
    f"   so the facets never shrink below the drawing. Silhouette: bands {100*sb['rel_range']:.1f}% radius range, golden spiral {100*sg['rel_range']:.1f}%, head {100*sh['rel_range']:.1f}% (pixel limit).",
    "Cube: each tribar is three edges of a unit cube from one vertex to the opposite one; the impossible joint is that cube's diagonal seen end on (e).",
]
out = C.side_by_side(left, right, "u3  Motion transforms 2D into 3D (p24) and the aisle spheres of bands (p26)  ->  the unit's sphere, cone, pyramid and cube", foot)
out.save(C.OUT + "img/u3_sphere_bands.png")
print(json.dumps({k: res[k] for k in ("bands", "golden_spiral", "head", "band_count_table")}, indent=1, default=float)[:4000])
