"""Distil the private Artsy dump into the land's vocabulary.

Reads data/artsy_saves_raw.json — the artist's full saved-works list, which is
private and stays out of git — and writes docs/v2/land.json, a small derived
file holding only what the land needs: the material words, and for each word a
handful of works with their three colours and a thumbnail.

    python3 scripts/build_land.py
"""

import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "artsy_saves_raw.json"
OUT = ROOT / "docs" / "v2" / "land.json"

CDN = "https://d32dm0rphc51dk.cloudfront.net/"

# A word has to gather this many works to be worth standing on.
MIN_WORKS = 20
# How many works travel with each word. The land only needs enough to feel
# inexhaustible; the dump has far more than any visitor will reach.
PER_WORD = 16

# Dropped from the medium strings: grammar, and the words that describe how a
# work is put together rather than what it is made of.
STOP = {
    "a", "an", "and", "the", "of", "on", "in", "with", "onto", "over", "under",
    "from", "to", "by", "at", "or", "for", "into", "off", "out", "up", "as",
    "its", "it", "his", "her", "their", "this", "that", "these", "those",
    "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    "ten", "each", "both", "all", "some", "other", "another", "various",
    "mixed", "media", "medium", "work", "works", "artwork", "piece", "pieces",
    "series", "set", "part", "edition", "editions", "unique", "signed",
    "numbered", "framed", "unframed", "mounted", "laid", "applied", "printed",
    "hand", "handmade", "made", "used", "including", "included", "approx",
    "size", "sizes", "dimensions", "variable", "overall", "installation",
    "view", "detail", "image", "images", "front", "back", "recto", "verso",
    "left", "right", "top", "bottom", "side", "sides", "inside", "outside",
    "cm", "mm", "in", "inches", "x", "h", "w", "d", "no", "not", "n",
    "artist", "artists", "studio", "courtesy", "collection", "private",
    "after", "before", "circa", "ca", "c", "und", "auf", "mit", "sur", "et",
}

# Plurals and spellings that name the same material.
SAME = {
    "papers": "paper", "canvases": "canvas", "canvasses": "canvas",
    "panels": "panel", "boards": "board", "prints": "print",
    "lithographs": "lithograph", "etchings": "etching",
    "screenprints": "screenprint", "silkscreen": "screenprint",
    "silkscreens": "screenprint", "serigraph": "screenprint",
    "serigraphs": "screenprint", "woodcuts": "woodcut",
    "engravings": "engraving", "drypoints": "drypoint",
    "aquatints": "aquatint", "monotypes": "monotype",
    "photographs": "photograph", "photo": "photograph",
    "photos": "photograph", "photographic": "photograph",
    "colours": "colour", "colors": "colour", "color": "colour",
    "coloured": "colour", "colored": "colour",
    "pigments": "pigment", "crayons": "crayon", "pencils": "pencil",
    "inks": "ink", "dyes": "dye", "glazes": "glaze", "threads": "thread",
    "fabrics": "fabric", "textiles": "textile", "woods": "wood",
    "metals": "metal", "steels": "steel", "sheets": "sheet",
    "plates": "plate", "blocks": "block", "tiles": "tile",
    "gelatine": "gelatin", "aluminium": "aluminum",
    "watercolours": "watercolour", "watercolors": "watercolour",
    "watercolor": "watercolour", "gouaches": "gouache",
    "acrylics": "acrylic", "oils": "oil", "chalks": "chalk",
    "pastels": "pastel", "charcoals": "charcoal", "glasses": "glass",
    "ceramics": "ceramic", "bronzes": "bronze", "marbles": "marble",
    "stones": "stone", "clays": "clay", "resins": "resin",
    "plastics": "plastic", "papercuts": "papercut", "collages": "collage",
}

WORD = re.compile(r"[a-z]+")

# Widest first — later versions are the fallbacks if a work lacks the earlier.
VERSIONS = ["small", "medium", "square", "medium_rectangle", "large",
            "normalized", "main"]


def words(medium):
    """The material words in one medium string."""
    flat = unicodedata.normalize("NFKD", medium or "")
    flat = flat.encode("ascii", "ignore").decode()
    seen = []
    for w in WORD.findall(flat.lower()):
        w = SAME.get(w, w)
        if len(w) < 3 or w in STOP or w in seen:
            continue
        seen.append(w)
    return seen


def thumb(rec):
    """'<key>/<version>' for the default image, or None."""
    images = rec.get("images") or []
    image = next((i for i in images if i.get("is_default")),
                 images[0] if images else None)
    if not image:
        return None
    url = image.get("image_url") or ""
    if not url.startswith(CDN):
        return None
    key = url[len(CDN):].split("/")[0]
    have = set(image.get("image_versions") or [])
    version = next((v for v in VERSIONS if v in have), None)
    return f"{key}/{version}" if version else None


def usable_works(raw):
    """The saved works that can carry the interaction: three colours and a picture."""
    out = []
    for rec in raw:
        colours = rec.get("dominant_colors") or []
        key = thumb(rec)
        if len(colours) < 3 or not key:
            continue
        out.append({
            "s": rec.get("id") or "",
            "t": rec.get("title") or "Untitled",
            "a": (rec.get("artist") or {}).get("name") or "",
            "y": rec.get("date") or "",
            "m": rec.get("medium") or "",
            "c": [c.lower() for c in colours[:3]],
            "i": key,
            "w": words(rec.get("medium")),
        })
    return out


def gather(usable, rarity):
    """Give each word its works, spreading the crowd rather than repeating it.

    A work is offered to its rarest word first, so that 'wove' and 'gelatin'
    are not left holding the same sixteen works as 'paper'.
    """
    gathered = defaultdict(list)

    def scarcest(work):
        return min((rarity[w] for w in work["w"] if w in rarity), default=10 ** 9)

    for work in sorted(usable, key=scarcest):
        mine = sorted((w for w in work["w"] if w in rarity), key=lambda w: rarity[w])
        for w in mine:
            if len(gathered[w]) < PER_WORD:
                gathered[w].append(work)
                break

    # Words still short take whatever else carries them.
    by_word = defaultdict(list)
    for work in usable:
        for w in work["w"]:
            if w in rarity:
                by_word[w].append(work)
    for w in rarity:
        have = {work["s"] for work in gathered[w]}
        for work in by_word[w]:
            if len(gathered[w]) >= PER_WORD:
                break
            if work["s"] not in have:
                gathered[w].append(work)
                have.add(work["s"])

    return gathered


def build():
    raw = json.loads(RAW.read_text())
    usable = usable_works(raw)

    counts = Counter(w for work in usable for w in work["w"])
    rarity = {w: n for w, n in counts.items() if n >= MIN_WORKS}
    gathered = gather(usable, rarity)

    # One works table; the terms index into it, so a work carried by several
    # words is stored once.
    index, table, terms = {}, [], []
    for w in sorted(rarity):
        picks = []
        for work in gathered[w]:
            if work["s"] not in index:
                index[work["s"]] = len(table)
                table.append({k: work[k] for k in ("s", "t", "a", "y", "m", "c", "i")})
            picks.append(index[work["s"]])
        terms.append({"w": w, "n": counts[w], "k": picks})

    return {
        "cdn": CDN,
        "saved": len(raw),
        "usable": len(usable),
        "vocabulary": len(counts),
        "min": MIN_WORKS,
        "terms": terms,
        "works": table,
    }


if __name__ == "__main__":
    land = build()
    OUT.write_text(json.dumps(land, separators=(",", ":"), ensure_ascii=False))
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB")
    print(f"{land['saved']} saved, {land['usable']} usable, "
          f"{land['vocabulary']} words seen, {len(land['terms'])} kept, "
          f"{len(land['works'])} works carried")
