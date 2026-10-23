#!/usr/bin/env python3
"""Write a synthetic 50-card deck (10 per kind) for tests: test/fixture/deck.json + img/.

Nothing in it is real: titles say "Fixture", colours and genes are chosen to give the taste
model clear patterns (warm/organic vs cool/geometric) so engine tests can assert on them.
"""
import json, random
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
(HERE / "deck.json").write_text(json.dumps(deck, indent=1, ensure_ascii=False))
print(f"wrote {len(cards)} cards to {HERE / 'deck.json'}")
