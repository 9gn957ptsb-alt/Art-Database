#!/usr/bin/env python3
"""Draw a compiled build plan, to check it against its sources before building in SketchUp.

    python3 residential/tools/preview.py plan    build/<slug>.plan.json OUTDIR   # one PNG per level
    python3 residential/tools/preview.py overlay build/<slug>.plan.json SOURCE_ID IMAGE OUT.png
    python3 residential/tools/preview.py axon    build/<slug>.plan.json OUT.png [--cut] [--az DEG]

'overlay' draws the level's walls and room outlines over a source plan image, using the
project's calibration for that source (pixels per metre, the pixel of plan origin, rotation,
level). '--cut' leaves out roofs so the rooms show from above.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, str(Path(__file__).resolve().parent))
import primitives  # noqa: E402

primitives.math = math

IN = 39.37007874015748
FILL = {"living": (236, 226, 204), "dining": (236, 220, 196), "kitchen": (230, 214, 186), "bedroom": (214, 226, 236),
        "master_bedroom": (204, 220, 236), "bathroom": (206, 232, 232), "ensuite": (206, 232, 232), "wc": (206, 232, 232),
        "terrace": (226, 236, 214), "patio": (226, 236, 214), "balcony": (226, 236, 214), "courtyard": (220, 236, 210),
        "garage": (226, 226, 226), "hall": (238, 236, 230), "corridor": (238, 236, 230), "stair": (232, 230, 224)}


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def level_plan(plan, level, out, px_per_m=60, margin=1.5):
    rooms = [r for r in plan["plan2d"] if r["level"] == level]
    if not rooms:
        return None
    pts = [q for r in rooms for w in r["walls"] for q in w["quad"]] + [q for r in rooms for q in r["outline"]]
    minx, miny = min(p[0] for p in pts) - margin, min(p[1] for p in pts) - margin
    maxx, maxy = max(p[0] for p in pts) + margin, max(p[1] for p in pts) + margin
    W, H = int((maxx - minx) * px_per_m), int((maxy - miny) * px_per_m)
    img = Image.new("RGB", (W, H), (250, 250, 248))
    dr = ImageDraw.Draw(img)
    tx = lambda p: ((p[0] - minx) * px_per_m, (maxy - p[1]) * px_per_m)
    for gx in range(math.floor(minx), math.ceil(maxx) + 1):
        dr.line([tx((gx, miny)), tx((gx, maxy))], fill=(236, 236, 232) if gx % 5 else (220, 220, 214))
    for gy in range(math.floor(miny), math.ceil(maxy) + 1):
        dr.line([tx((minx, gy)), tx((maxx, gy))], fill=(236, 236, 232) if gy % 5 else (220, 220, 214))
    for r in rooms:
        dr.polygon([tx(p) for p in r["inner"]], fill=FILL.get(r["type"], (240, 238, 232)))
    for r in rooms:
        for w in r["walls"]:
            if w["kind"] in ("open", "abut"):
                continue
            col = {"ext": (40, 40, 44), "int": (90, 90, 96), "int_full": (90, 90, 96), "glass": (90, 150, 200),
                   "low": (140, 140, 140), "rail": (90, 150, 200)}.get(w["kind"], (60, 60, 60))
            dr.polygon([tx(p) for p in w["quad"]], fill=col)
            for p0, p1, typ in w["openings"]:
                c = (250, 250, 248) if typ in ("door", "opening") else (150, 200, 230)
                dr.line([tx(p0), tx(p1)], fill=c, width=max(3, int(0.3 * px_per_m)))
    f, fs = font(max(11, px_per_m // 4)), font(max(9, px_per_m // 5))
    for r in rooms:
        xs, ys = [p[0] for p in r["inner"]], [p[1] for p in r["inner"]]
        c = tx((sum(xs) / len(xs), sum(ys) / len(ys)))
        dr.text(c, r["name"], fill=(30, 30, 30), font=f, anchor="mm")
        dr.text((c[0], c[1] + px_per_m * 0.35), f"{r['area_m2']:.1f} m²", fill=(90, 90, 90), font=fs, anchor="mm")
    x0, y0 = 0.5 * px_per_m, H - 0.6 * px_per_m
    dr.rectangle([x0, y0, x0 + 5 * px_per_m, y0 + 6], fill=(30, 30, 30))
    dr.text((x0, y0 - 4), "5 m", fill=(30, 30, 30), font=fs, anchor="ls")
    dr.text((x0, 6), f"{plan['name']} · {level}", fill=(30, 30, 30), font=f, anchor="lt")
    img.save(out)
    return out


def overlay(plan, source, image, out):
    cal = plan["calibration"][source]
    s, (ox, oy), rot = cal["px_per_m"], cal["origin_px"], math.radians(cal.get("rot_deg", 0.0))
    img = Image.open(image).convert("RGB")
    lay = Image.new("RGBA", img.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(lay)
    tx = lambda p: (ox + s * (p[0] * math.cos(rot) - p[1] * math.sin(rot)),
                    oy - s * (p[0] * math.sin(rot) + p[1] * math.cos(rot)))
    for r in plan["plan2d"]:
        if r["level"] != cal["level"]:
            continue
        for w in r["walls"]:
            if w["kind"] not in ("open", "abut"):
                dr.polygon([tx(p) for p in w["quad"]], fill=(255, 0, 80, 70), outline=(255, 0, 80, 230))
        dr.line([tx(p) for p in r["outline"] + r["outline"][:1]], fill=(0, 120, 255, 230), width=2)
        xs, ys = [p[0] for p in r["inner"]], [p[1] for p in r["inner"]]
        dr.text(tx((sum(xs) / len(xs), sum(ys) / len(ys))), r["name"], fill=(0, 60, 200, 255), font=font(14), anchor="mm")
    Image.alpha_composite(img.convert("RGBA"), lay).convert("RGB").save(out)
    return out


def axon(plan, out, cut=False, az=-35.0, size=(1400, 1000)):
    leaves = [lf for lf in plan["leaves"] if not (cut and lf["n"].startswith("Roof"))]
    mats = plan["materials"]
    ang = math.radians(az)
    f = np.array([math.cos(ang) * math.cos(math.radians(32)), math.sin(ang) * math.cos(math.radians(32)), -math.sin(math.radians(32))])
    up = np.array([0.0, 0.0, 1.0])
    r_ = np.cross(f, up); r_ /= np.linalg.norm(r_)
    u_ = np.cross(r_, f)
    light = np.array([-0.4, -0.3, 0.86]); light /= np.linalg.norm(light)
    polys = []
    for lf in leaves:
        Vl, Fl = primitives.realize(lf["k"], lf["s"])
        V = np.array(Vl, float)
        for fc in Fl:
            m = mats.get(fc[0] or lf["m"], [200, 200, 200, 255])
            P = V[fc[1]]
            n = np.zeros(3)
            for i in range(len(P)):
                a, b = P[i], P[(i + 1) % len(P)]
                n += [(a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1])]
            ln = np.linalg.norm(n)
            if ln == 0 or n @ f > 0:
                continue
            n /= ln
            k = 0.5 + 0.5 * max(0.0, float(n @ light))
            col = tuple(int(min(255, c * k)) for c in m[:3])
            polys.append((P, [V[h] for h in fc[2:]], col, m[3] if len(m) > 3 else 255))
    allp = np.concatenate([p[0] for p in polys])
    xy = np.stack([allp @ r_, allp @ u_], 1)
    lo, hi = xy.min(0), xy.max(0)
    SS = 2
    W, H = size[0] * SS, size[1] * SS
    sc = min(W * 0.92 / (hi[0] - lo[0]), H * 0.92 / (hi[1] - lo[1]))
    off = np.array([W, H]) / 2 - (lo + hi) / 2 * sc * np.array([1, -1])
    zbuf = np.full((H, W), np.inf)
    ids = np.full((H, W), -1, np.int64)
    rgb = np.empty((H, W, 3)); rgb[:] = (236, 238, 241)
    glass = []
    to2d = lambda P: np.stack([P @ r_ * sc + off[0], -(P @ u_) * sc + off[1]], 1)
    for k, (P, holes, col, a) in enumerate(polys):
        S = to2d(P)
        Z = P @ f
        x0, y0 = np.floor(S.min(0)).astype(int)
        x1, y1 = np.ceil(S.max(0)).astype(int)
        x0, y0, x1, y1 = max(x0, 0), max(y0, 0), min(x1, W - 1), min(y1, H - 1)
        if x1 <= x0 or y1 <= y0:
            continue
        mask = Image.new("L", (x1 - x0 + 1, y1 - y0 + 1), 0)
        md = ImageDraw.Draw(mask)
        md.polygon([(float(x - x0), float(y - y0)) for x, y in S], fill=255)
        for h in holes:
            md.polygon([(float(x - x0), float(y - y0)) for x, y in to2d(np.array(h))], fill=0)
        m = np.array(mask) > 0
        if not m.any():
            continue
        # depth is linear in screen x, y on a planar face: fit it from the polygon's vertices
        A = np.c_[S, np.ones(len(S))]
        coef, *_ = np.linalg.lstsq(A, Z, rcond=None)
        yy, xx = np.nonzero(m)
        xx, yy = xx + x0, yy + y0
        zz = coef[0] * (xx + 0.5) + coef[1] * (yy + 0.5) + coef[2]
        if a < 255:
            glass.append((xx, yy, zz, col, a))
            continue
        win = zz < zbuf[yy, xx] - 1e-6
        xx, yy, zz = xx[win], yy[win], zz[win]
        zbuf[yy, xx] = zz
        ids[yy, xx] = k
        rgb[yy, xx] = col
    for xx, yy, zz, col, a in glass:
        win = zz < zbuf[yy, xx]
        al = a / 255
        rgb[yy[win], xx[win]] = rgb[yy[win], xx[win]] * (1 - al) + np.array(col) * al
    e = np.zeros((H, W), bool)
    e[:, 1:] |= ids[:, 1:] != ids[:, :-1]
    e[1:, :] |= ids[1:, :] != ids[:-1, :]
    rgb[e] = (45, 45, 50)
    Image.fromarray(rgb.clip(0, 255).astype(np.uint8)).resize(size, Image.LANCZOS).save(out)
    return out


def main(mode, plan_path, *rest):
    plan = json.load(open(plan_path))
    if mode == "plan":
        outdir = Path(rest[0]); outdir.mkdir(parents=True, exist_ok=True)
        for lv in plan["levels"]:
            o = level_plan(plan, lv["id"], outdir / f"{plan['slug']}-{lv['id']}.png")
            if o:
                print(o)
    elif mode == "overlay":
        print(overlay(plan, rest[0], rest[1], rest[2]))
    elif mode == "axon":
        az = float(rest[rest.index("--az") + 1]) if "--az" in rest else -35.0
        print(axon(plan, rest[0], cut="--cut" in rest, az=az))


if __name__ == "__main__":
    main(*sys.argv[1:])
