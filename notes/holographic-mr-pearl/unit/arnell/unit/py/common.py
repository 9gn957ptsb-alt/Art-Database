"""Shared helpers for arnell/unit. Drawing coords (a, b) in block units, as wf6/levels/drawing2d.py."""
import sys, math
S = "/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/"
sys.path.insert(0, S + "wf6/levels")
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import drawing2d as D

PHI = (1 + 5 ** 0.5) / 2
LL = math.sqrt(2 / 3)
U = LL / 3                      # u = a third of a block edge as drawn
POLYS = D.polygons(D.H9)        # 13 polygons: tone 0 grey, 1 black, 2 white, -1 hole
TONECOL = {0: (128, 128, 128), 1: (12, 12, 12), 2: (250, 250, 250), -1: None}
OUT = S + "arnell/unit/"


def F(n):
    a, b = 0, 1
    for _ in range(n):
        a, b = b, a + b
    return a


def font(sz):
    for p in ['/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf']:
        try:
            return ImageFont.truetype(p, sz)
        except Exception:
            pass
    return ImageFont.load_default()


def page_crop(n, box, h=None):
    """box in 300 dpi px of page n (hi-NN.png); returns RGB image scaled to height h."""
    im = Image.open(S + f"arnell/pages/hi-{n:02d}.png").convert("RGB").crop(box)
    if h:
        im = im.resize((int(im.width * h / im.height), h), Image.LANCZOS)
    return im


class Pic:
    """Supersampled PIL canvas, world y up."""
    def __init__(s, W, H, k, ox, oy, ss=3, bg=(250, 248, 243)):
        s.W, s.H, s.ss = W, H, ss
        s.k, s.ox, s.oy = k * ss, ox * ss, oy * ss
        s.im = Image.new("RGB", (W * ss, H * ss), bg)
        s.d = ImageDraw.Draw(s.im)

    def P(s, x, y):
        return (s.ox + x * s.k, s.oy - y * s.k)

    def poly(s, pts, fill=None, outline=None, width=1):
        q = [s.P(x, y) for x, y in pts]
        s.d.polygon(q, fill=fill)
        if outline:
            s.d.line(q + [q[0]], fill=outline, width=int(width * s.ss), joint="curve")

    def line(s, pts, col=(0, 0, 0), width=1):
        s.d.line([s.P(x, y) for x, y in pts], fill=col, width=max(1, int(width * s.ss)), joint="curve")

    def circle(s, cx, cy, r, col=(30, 70, 160), width=1.5, fill=None):
        x0, y0 = s.P(cx - r, cy + r); x1, y1 = s.P(cx + r, cy - r)
        s.d.ellipse([x0, y0, x1, y1], outline=col, width=max(1, int(width * s.ss)), fill=fill)

    def dot(s, x, y, r=3, col=(200, 30, 40)):
        X, Y = s.P(x, y); r *= s.ss
        s.d.ellipse([X - r, Y - r, X + r, Y + r], fill=col)

    def text(s, x, y, t, sz=14, col=(20, 20, 20), px=False):
        X, Y = (x * s.ss, y * s.ss) if px else s.P(x, y)
        s.d.text((X, Y), t, fill=col, font=font(sz * s.ss))

    def figure(s, centre=(0, 0), scale=1.0, inv=False, outline=(40, 40, 40), width=0.6, tint=None):
        sg = -1 if inv else 1
        for tone, Pp in POLYS:
            if tone < 0:
                continue
            pts = [(centre[0] + sg * scale * a, centre[1] + sg * scale * b) for a, b in Pp]
            col = TONECOL[tone]
            if tint is not None:
                col = tuple(int(0.55 * c + 0.45 * t) for c, t in zip(col, tint))
            s.poly(pts, fill=col, outline=outline, width=width)

    def done(s):
        return s.im.resize((s.W, s.H), Image.LANCZOS)


def side_by_side(left, right, title, foot=(), bg=(255, 255, 255)):
    h = max(left.height, right.height)
    W = left.width + right.width + 60
    lines = list(foot)
    H = h + 70 + 22 * len(lines) + 20
    out = Image.new("RGB", (W, H), bg)
    d = ImageDraw.Draw(out)
    d.text((20, 12), title, fill=(10, 10, 10), font=font(22))
    d.text((20, 40), "left: the document's page (pdftoppm 300 dpi)    right: the base unit by the same method (numpy/PIL, by number)",
           fill=(90, 90, 90), font=font(14))
    out.paste(left, (20, 65 + (h - left.height) // 2))
    out.paste(right, (left.width + 40, 65 + (h - right.height) // 2))
    d.rectangle([20, 65, 20 + left.width, 65 + left.height], outline=(190, 190, 190))
    for i, t in enumerate(lines):
        d.text((20, h + 80 + 22 * i), t, fill=(20, 20, 20), font=font(15))
    return out
