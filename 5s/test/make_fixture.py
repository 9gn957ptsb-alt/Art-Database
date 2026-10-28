#!/usr/bin/env python3
"""Write a synthetic 50-card deck (10 per kind) for tests: test/fixture/deck.json + img/.

Nothing in it is real: titles say "Fixture", colours and genes are chosen to give the taste
model clear patterns (warm/organic vs cool/geometric) so engine tests can assert on them.
"""
import json, random, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent / "fixture"
IMG = HERE / "img"
IMG.mkdir(parents=True, exist_ok=True)
rng = random.Random(5)

WARM = [["#c4622d", "#e8b07a", "#5a2e1a"], ["#d9822b", "#f2d0a4", "#7a3b1d"], ["#b5452a", "#e7c39b", "#3b1f14"],
        ["#cf7a3c", "#f6e3c4", "#6b3a22"], ["#e0a040", "#8a4b20", "#f3e1b8"]]
COOL = [["#2f5d8a", "#9cc3e4", "#132a40"], ["#3b6fb6", "#d7e6f5", "#1b2f4f"], ["#4a8a9a", "#c9e2e6", "#1d3a40"],
        ["#5560a8", "#c3c7ea", "#20234a"], ["#2a7f7a", "#bfe3dc", "#0f3532"]]
NEUTRAL = [["#c0c2c1", "#a7a6a1", "#bbbbbb"], ["#e9e6df", "#8c8a85", "#3a3936"]]
GENES = {
    "biomorphic": ("Biomorphic", "Visual Qualities"),
    "organic": ("Organic", "Visual Qualities"),
    "geometric": ("Geometric", "Visual Qualities"),
    "hard-edge": ("Hard-Edged", "Visual Qualities"),
    "minimalism": ("Minimalism", "Styles and Movements"),
    "arts-and-crafts": ("Arts and Crafts Movement", "Styles and Movements"),
    "interiors": ("Interiors", "Subject Matter"),
    "landscapes": ("Landscapes", "Subject Matter"),
    "handmade": ("Handcrafted Furniture and Design", "Design Concepts and Techniques"),
}
KINDS = [("image", "i", "Painting", ["oil", "canvas"]), ("object", "o", "Design/Decorative Art", ["wood"]),
         ("space", "s", "Architecture", ["concrete"]), ("surface", "u", "Painting", ["oil"]),
         ("colour", "c", "Print", ["screenprint"])]
ERAS = [(1650, "Before 1800"), (1890, "1800s"), (1925, "1900–45"), (1960, "1945–69"), (1985, "1970–99"),
        (2005, "2000s"), (2018, "2010s–now")]
PLACES = ["Japan", "United States", "France", "Netherlands", "Mexico", "Nigeria"]


def draw(path, colours, w, h, kind, warm):
    im = Image.new("RGB", (w, h), colours[0])
    d = ImageDraw.Draw(im)
    if kind == "surface":
        for _ in range(900):
            x, y = rng.randrange(w), rng.randrange(h)
            r = rng.randrange(2, 9)
            d.ellipse([x - r, y - r, x + r, y + r], fill=rng.choice(colours))
        im = im.filter(ImageFilter.GaussianBlur(0.8))
    elif warm:
        d.ellipse([w * .2, h * .2, w * .8, h * .75], fill=colours[1])
        d.ellipse([w * .4, h * .35, w * .65, h * .6], fill=colours[2])
    else:
        d.rectangle([w * .15, h * .2, w * .55, h * .8], fill=colours[1])
        d.rectangle([w * .5, h * .35, w * .85, h * .65], fill=colours[2])
    im.save(path, "WEBP", quality=70)


cards, atlas_cells = [], []
for kind, letter, category, mats in KINDS:
    for n in range(10):
        warm = n % 2 == 0
        colours = (WARM if warm else COOL)[n // 2 % 5] if n < 9 else NEUTRAL[n % 2]
        year, era = ERAS[(n + len(cards)) % len(ERAS)]
        genes = (["biomorphic", "organic", "arts-and-crafts", "handmade"] if warm
                 else ["geometric", "hard-edge", "minimalism"])[: 2 + n % 2]
        genes = genes + (["interiors"] if kind == "space" else ["landscapes"] if n % 3 == 0 else [])
        cid = f"{letter}{n + 1:03d}"
        w, h = (512, 512) if kind == "surface" else (600, 720 if n % 2 else 520)
        card = {
            "id": cid, "kind": kind, "work": f"fixture-{cid}", "url": f"https://www.artsy.net/artwork/fixture-{cid}",
            "cdn": f"https://images.example.org/fixture/{cid}/large.jpg",  # stands in for Artsy's CDN address
            "title": f"Fixture {kind} {n + 1}", "artist": f"Fixture Artist {len(cards) + 1}", "date": str(year),
            "year": year, "era": era, "category": category, "medium": ", ".join(mats),
            "materials": mats if warm else (["steel"] if kind == "object" else mats),
            "place": PLACES[n % len(PLACES)], "colours": colours, "genes": genes,
            "img": None if kind == "colour" else f"img/{cid}.webp", "w": None if kind == "colour" else w,
            "h": None if kind == "colour" else h, "thumb": len(cards),
        }
        if kind == "surface":
            card["crop"] = [0.3, 0.3, 0.25, 0.25]
            card["texture"] = round(0.3 + 0.06 * n, 2)
        if kind != "colour":
            draw(IMG / f"{cid}.webp", colours, w, h, kind, warm)
            # Set's other eyes, synthetic (SPEC "Set, inside out"): each picture's words, as the deck build ships them
            card["comp"] = ["a round heart", "soft curls"] if warm else ["a lattice", "heavy blocks"]
            card["feel"] = ["sunny"] if warm else ["shady"]
        atlas_cells.append(colours)
        cards.append(card)

cell, cols = 128, 10
rows = (len(cards) + cols - 1) // cols
atlas = Image.new("RGB", (cell * cols, cell * rows), "#ffffff")
for i, colours in enumerate(atlas_cells):
    tile = Image.new("RGB", (cell, cell), colours[0])
    ImageDraw.Draw(tile).rectangle([32, 32, 96, 96], fill=colours[1])
    atlas.paste(tile, ((i % cols) * cell, (i // cols) * cell))
atlas.save(IMG / "atlas.webp", "WEBP", quality=70)

deck = {"version": 1, "built": "fixture", "source": "Synthetic fixture (not real works)",
        "atlas": {"src": "img/atlas.webp", "cell": cell, "cols": cols},
        "genes": {k: {"name": v[0], "family": v[1]} for k, v in GENES.items()}, "cards": cards}
# Set's other eyes, synthetic words (the real ones stay in data/5s): their aspects, and lookers' pairs [a, b, 1 yes | 0 partly, line]
deck["words"] = {"a round heart": "layout", "soft curls": "line", "a lattice": "layout", "heavy blocks": "mass",
                 "sunny": "mood", "shady": "mood"}
line = lambda k: "a round heart, soft curls · sunny" if k % 2 else "a lattice, heavy blocks · shady"
deck["rhymes"] = ([[f"i{k:03d}", f"s{k:03d}", 1, line(k)] for k in range(1, 10)] +
                  [[f"o{k:03d}", f"u{k:03d}", 1, line(k)] for k in range(1, 10)] +
                  [[f"i{k:03d}", f"o{k:03d}", 0, "a round heart" if k % 2 else "a lattice"] for k in range(1, 10)])

# What each card is in a room, and two marked interiors (SPEC-room-from-structure 2.2), synthetic: written as
# data/5s/roles.json and planes.json are, then put on the cards by the deck build's own add_roles.
OBJECTS = [(["textile", "floor"], "a rug"), (["light", "ceiling"], "a pendant lamp"), (["textile"], "a wall hanging"),
           (["furniture"], "an armchair"), (["thing"], "a vase"), (["light", "furniture"], "a floor lamp"),
           (["thing", "art"], "a ceramic dish"), (["art", "light"], "a neon in a box"), (["thing"], "a sculpture"),
           (["furniture"], "a table")]
SPACES = [(["room"], "a white hall"), (["building"], "a concrete house"), (["room"], "a timber living room"),
          (["building"], "a glass pavilion"), (["room"], "a dining room"), (["building"], "a stone barn"),
          (["room"], "a stair hall"), (["building"], "a tower"), (["room", "art"], "a painting of a studio"),
          (["view", "art"], "a bay at low tide")]
SURFACES = [(["floor"], "oak boards"), (["walls"], "a painted surface"), (["floor", "walls"], "grey stone"),
            (["walls", "floor"], "concrete")] + [(["walls"], "a painted surface")] * 6
roles = {}
for c in cards:
    k, n = c["kind"], int(c["id"][1:]) - 1
    e = {"image": ((["textile", "art"], "a tapestry") if n == 8 else (["art"], "a painting")), "object": OBJECTS[n],
         "space": SPACES[n], "surface": SURFACES[n], "colour": (["walls", "light"], None)}[k]
    roles[c["work"]] = {k: {"role": e[0], **({"what": e[1]} if e[1] else {})}}
planes = {
    "fixture-s001": {"inside": True, "say": "a white hall with a tall window", "walls": "white plaster",
                     "planes": {"w1": {"q": [[25, 15], [75, 15], [75, 60], [25, 60]], "size": [400, 300]},
                                "f": {"q": [[25, 60], [75, 60], [100, 100], [0, 100]], "size": [400, 250]}},
                     "paint": {"polys": [[[25, 15], [75, 15], [75, 60], [25, 60]]], "name": "the back wall"},
                     "floor": {"what": "oak boards", "outline": [[25, 60], [75, 60], [100, 100], [0, 100]], "band": 0.9},
                     "opening": {"polys": [[[5, 18], [20, 24], [20, 56], [5, 60]]], "name": "through the tall window"},
                     "sun": [12, 38],
                     "spots": {"hang": {"plane": "w1", "at": [50, 35], "name": "on the back wall"},
                               "light": {"plane": "f", "at": [50, 72], "top": 8, "name": "over the middle"},
                               "stand": {"plane": "f", "at": [68, 88], "name": "by the back wall"},
                               "lay": {"plane": "f", "at": [45, 82], "name": "in the middle"},
                               "paint": {"at": [60, 25]}, "floor": {"at": [50, 95]}}},
    # its walls are the work: never painted, and no window (the view hangs beside the picture)
    "fixture-s003": {"inside": True, "say": "a timber living room", "walls": "timber panels",
                     "planes": {"w1": {"q": [[20, 10], [80, 10], [80, 55], [20, 55]], "size": [500, 330]},
                                "f": {"q": [[20, 55], [80, 55], [110, 100], [-10, 100]], "size": [500, 300]}},
                     "paint": None,
                     "floor": {"what": "grey stone", "outline": [[20, 55], [80, 55], [100, 85], [100, 100], [0, 100], [0, 85]], "band": 0.88},
                     "sun": [50, 5],
                     "spots": {"hang": {"plane": "w1", "at": [50, 30], "name": "on the panel wall", "box": [160, 110]},
                               "light": {"plane": "f", "at": [40, 75], "top": 5, "name": "over the table"},
                               "set": {"plane": "f", "at": [40, 80], "top": 70, "name": "on the table"},
                               "stand": {"plane": "f", "at": [72, 90], "name": "by the far wall"},
                               "lay": {"plane": "f", "at": [50, 85], "name": "on the floor"},
                               "paint": {"at": [30, 20]}, "floor": {"at": [50, 96]}}},
}
(HERE / "roles.json").write_text(json.dumps({"version": 1, "cards": roles}, indent=1, ensure_ascii=False) + "\n")
(HERE / "planes.json").write_text(json.dumps({"version": 1, "rooms": planes}, indent=1, ensure_ascii=False) + "\n")
sys.path.insert(0, str(HERE.parents[1]))
from build_deck import add_roles  # noqa: E402
add_roles(cards, HERE)
(HERE / "deck.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False))
print(f"wrote {len(cards)} cards to {HERE / 'deck.json'}")
