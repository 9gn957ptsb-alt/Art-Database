"""Self-check for 5s/build_deck.py with the buildings: builds the deck into a temporary folder (about two
minutes, from the caches in data/5s/ and data/aa/) and checks it against 5s/dist/deck.json.
Run: python3 5s/test/deck.test.py"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

FIVE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(FIVE))
from build_deck import KEPT_FAMILIES, corners_w, era_of  # noqa: E402
from roles import ROLES  # noqa: E402

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
    rooms = [c["id"] for c in cards if "room" in c]
    roles = f", roles on {sum(1 for c in cards if 'role' in c)} cards, {len(rooms)} marked rooms" if any("role" in c for c in cards) else ", no roles (no data/5s roles.json)"
print(f"ok: {len(artsy)} Artsy cards unchanged, {len(bld)} building cards{others}{roles}")
