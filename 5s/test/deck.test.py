"""Self-check for 5s/build_deck.py with the buildings: builds the deck into a temporary folder (about two
minutes, from the caches in data/5s/ and data/aa/) and checks it against 5s/dist/deck.json.
Run: python3 5s/test/deck.test.py"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np

FIVE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FIVE))
from build_deck import KEPT_FAMILIES, corners_w, era_of  # noqa: E402
from roles import ROLES  # noqa: E402


def plane(r, pid, w, h):
    """room.js's planeOf: a marked plane's cm to the w x h photo's px (sq2quad's homography) and back, and the px per cm
    across the view at a point (what stands upright there is sized by it)"""
    (x0, y0), (x1, y1), (x2, y2), (x3, y3) = [(x / 100 * w, y / 100 * h) for x, y in r["planes"][pid]["q"]]
    W, Hh = r["planes"][pid]["size"]
    sx, sy, dx1, dx2, dy1, dy2 = x0 - x1 + x2 - x3, y0 - y1 + y2 - y3, x1 - x2, x3 - x2, y1 - y2, y3 - y2
    den = dx1 * dy2 - dx2 * dy1
    g, k = (sx * dy2 - dx2 * sy) / den, (dx1 * sy - sx * dy1) / den
    M = np.array([[x1 - x0 + g * x1, x3 - x0 + k * x3, x0], [y1 - y0 + g * y1, y3 - y0 + k * y3, y0], [g, k, 1]]) @ np.diag([1 / W, 1 / Hh, 1])
    to = lambda m: lambda x, y: (lambda v: v[:2] / v[2])(m @ [x, y, 1])
    to_px, to_cm = to(M), to(np.linalg.inv(M))

    def scale(x, y):
        a, b = to_px(x + 1, y) - to_px(x, y), to_px(x, y + 1) - to_px(x, y)
        return abs(a[0] * b[1] - a[1] * b[0]) / np.hypot(a[1], b[1])
    return W, Hh, to_px, to_cm, scale


old = json.loads((FIVE / "dist" / "deck.json").read_text())
# dist may already hold the buildings: compare against its Artsy cards only (no source is Artsy)
old["cards"] = [c for c in old["cards"] if c.get("source", "Artsy") == "Artsy"]
blds = json.loads((FIVE / "buildings.json").read_text())
assert [b["slug"] for b in blds] == sorted({b["slug"] for b in blds}), "buildings.json: sorted, one entry per slug"

with tempfile.TemporaryDirectory() as out:
    subprocess.run([sys.executable, str(FIVE / "build_deck.py"), "--no-logo", "--out", out], check=True,
                   stdout=subprocess.DEVNULL)
    deck = json.loads((Path(out) / "deck.json").read_text())
    cards = deck["cards"]
    ids = [c["id"] for c in cards]
    assert len(ids) == len(set(ids)) and not any(i.startswith("y") for i in ids), "ids unique, none 'y...'"
    assert [c["thumb"] for c in cards] == list(range(len(cards)))

    # the Artsy cards: first, in the same order, every field as it was, plus source
    artsy = [c for c in cards if c["source"] == "Artsy"]
    assert cards[:len(artsy)] == artsy and len(artsy) == len(old["cards"])
    for a, b in zip(old["cards"], artsy):
        for k, v in a.items():
            assert json.dumps(b.get(k), ensure_ascii=False) == json.dumps(v, ensure_ascii=False), (a["id"], k)

    # the buildings: a space card each (b001...; object where the entry says so), a surface card for each
    # chosen crop (m001...)
    bld = cards[len(artsy):]
    by = {b["slug"]: b for b in blds}
    assert [(c["work"], c["kind"]) for c in bld if c["kind"] != "surface"] == [(b["slug"], b.get("kind", "space")) for b in blds]
    assert [c["work"] for c in bld if c["kind"] == "surface"] == [b["slug"] for b in blds if b["surface"]]
    for c in bld:
        b = by[c["work"]]
        assert c["source"] == "Architectural Authority" and c["category"] == b["category"], c["id"]
        assert re.fullmatch(r"[bm]\d{3}", c["id"]) and c["id"][0] == "bm"[c["kind"] == "surface"], c["id"]
        assert c["url"] == "https://www.thearchitecturalauthority.com/article/" + c["work"], c["id"]
        assert c["cdn"].startswith("https://s3.amazonaws.com/api.thelocalproject/public/Articles/"), c["id"]
        assert (Path(out) / c["img"]).is_file() and c["w"] and c["h"], c["id"]
        assert len(c["colours"]) == 3 and all(re.fullmatch(r"#[0-9a-f]{6}", h) for h in c["colours"]), c["id"]
        assert c["genes"] and all(deck["genes"].get(g, {}).get("family") in KEPT_FAMILIES for g in c["genes"]), c["id"]
        assert c["era"] == era_of(c["year"]) and c["title"] == b["name"] and c["materials"] == b["materials"], c["id"]
        if c["kind"] == "surface":
            assert (c["w"], c["h"]) == (512, 512) and 0 <= c["texture"] <= 1, c["id"]
            x, y, w, h = c["crop"]
            assert min(x, y) >= 0 and x + w <= 1.0001 and y + h <= 1.0001, c["id"]
    assert "Architectural Authority" in deck["source"]

    # Set's other eyes, when data/5s holds pairs, tags and words: pairs of pictures of different works, words the deck knows
    pics = {c["id"]: c for c in cards if c["kind"] != "colour" and c.get("img")}
    for a, b, v, line in deck.get("rhymes", []):
        assert a < b and a in pics and b in pics and pics[a]["work"] != pics[b]["work"], (a, b)
        assert v in (0, 1) and line and not line.startswith("Both: "), (a, b)
    assert all(w in deck.get("words", {}) for c in pics.values() for w in c.get("comp", []) + c.get("feel", []))
    others = f", {len(deck['rhymes'])} lookers' pairs" if "rhymes" in deck else ", no other eyes (no data/5s pairs)"

    # See it as a room, when data/5s holds roles.json (and planes.json): what each card is, and the interiors' marked rooms
    inside = lambda p: isinstance(p, list) and len(p) == 2 and all(0 <= v <= 100 for v in p)
    for c in cards:
        role, what = c.get("role", []), c.get("what")
        assert len(role) <= 2 and len(set(role)) == len(role) and all(r in ROLES for r in role), (c["id"], role)
        assert what is None or (0 < len(what) <= 40 and "\n" not in what), (c["id"], what)
        assert not ("textile" in role and "floor" not in role and re.search(r"\b(rug|carpet|kilim|mat)s?\b", what or "")), (c["id"], "a rug is laid")
        if "room" not in c:
            continue
        r = c["room"]
        assert c["kind"] == "space" and role[0] == "room" and r["planes"], c["id"]
        for pid, pl in r["planes"].items():
            assert len(pl["q"]) == 4 and min(corners_w(pl["q"])) > 0 and all(v > 0 for v in pl["size"]), (c["id"], pid)
        for k, sp in r["spots"].items():
            assert inside(sp["at"]) and (k in ("paint", "floor") or sp["plane"] in r["planes"]), (c["id"], k)
        polys = (r["paint"] or {}).get("polys", []) + (r.get("opening") or {}).get("polys", []) + [(r.get("floor") or {}).get("outline", [[0, 0]] * 3)]
        assert all(len(p) >= 3 and all(inside(x) for x in p) for p in polys), c["id"]
        names = [sp.get("name") for sp in r["spots"].values()] + [(r["paint"] or {}).get("name"), (r.get("opening") or {}).get("name"), r.get("walls"), (r.get("floor") or {}).get("what")]
        assert all(n is None or len(n) <= 40 for n in names), (c["id"], names)
        # what is hung at a spot stays in the photo and on its own plane, scaled to fill the spot's box as room.js hangs it:
        # a 100 cm picture, landscape and portrait, and in a room with no window a 60 cm view at hang2
        w, h, S = c["w"], c["h"], r["spots"]
        hung = [("hang", 100, 4 / 3), ("hang", 100, 3 / 4)] + ([("hang2", 60, 4 / 3)] if not r.get("opening") and "hang2" in S else [])
        for k, cm, ar in hung:
            W, Hh, to_px, to_cm, _ = plane(r, S[k]["plane"], w, h)
            cx, cy = to_cm(S[k]["at"][0] / 100 * w, S[k]["at"][1] / 100 * h)
            fw, fh = (cm, cm / ar) if ar >= 1 else (cm * ar, cm)
            s = min(S[k]["box"][0] / fw, S[k]["box"][1] / fh) if S[k].get("box") else 1
            cs = [(cx + i * fw * s / 2, cy + j * fh * s / 2) for i, j in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
            assert all(-1 <= x <= W + 1 and -1 <= y <= Hh + 1 for x, y in cs), (c["id"], k, ar, "off its plane")
            assert all(0 <= x <= w and 0 <= y <= h for x, y in (to_px(*p) for p in cs)), (c["id"], k, ar, "out of the photo")
        # a 112 cm pendant at the light spot, filling its box, is at least 8% of the photo's height
        if "light" in S:
            *_, to_cm, scale = plane(r, "f", w, h)
            hpx = (min(S["light"]["box"]) if S["light"].get("box") else 112) * scale(*to_cm(S["light"]["at"][0] / 100 * w, S["light"]["at"][1] / 100 * h))
            assert hpx >= 0.08 * h, (c["id"], "the pendant is too small to see", f"{hpx / h:.1%}")
        # a 200 cm rug laid at the lay spot stays within its floor's sides and far edge (where the floor is narrower
        # than the rug, it may overhang both sides evenly); toward the camera it may run out of the photo
        if "lay" in S:
            W, Hh, _, to_cm, _ = plane(r, S["lay"]["plane"], w, h)
            cx, cy = to_cm(S["lay"]["at"][0] / 100 * w, S["lay"]["at"][1] / 100 * h)
            tol = (200 - W) / 2 + 1 if W < 200 else 1   # 1 cm, as the hung checks allow
            assert cx - 100 >= -tol and cx + 100 <= W + tol and cy - 100 >= -tol, (c["id"], "a rug laid here runs through a wall", round(cx), round(cy), W)
    rooms = [c["id"] for c in cards if "room" in c]
    roles = f", roles on {sum(1 for c in cards if 'role' in c)} cards, {len(rooms)} marked rooms" if any("role" in c for c in cards) else ", no roles (no data/5s roles.json)"
print(f"ok: {len(artsy)} Artsy cards unchanged, {len(bld)} building cards{others}{roles}")
