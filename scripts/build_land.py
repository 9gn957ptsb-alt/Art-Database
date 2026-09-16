"""Distil the private Artsy dump into the land's token supply.

The land's words and the works they link to are Matthew's own — they come from
`docs/works.json` and this script does not touch them. What it builds is the
other half: the token objects. A token is one Artsy work boiled down to the
three colours it reduces to, turned up by the creature as it grazes and thrown
at it to repaint it. Artsy works appear nowhere else on the site.

Reads data/artsy_saves_raw.json, which is private, gitignored and stays on the
machine that fetched it. Writes docs/v2/land.json, which is small and is what
gets committed.

    python3 scripts/build_land.py
"""

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "artsy_saves_raw.json"
WORKS = ROOT / "docs" / "works.json"
OUT = ROOT / "docs" / "v2" / "land.json"

CDN = "https://d32dm0rphc51dk.cloudfront.net/"

# Tokens the creature can turn up under a given word, where the dump has works
# whose medium names it — 'paper', 'photograph', 'tape', 'watercolour'.
PER_TERM = 12
# And the general supply, for the words no Artsy medium ever says.
POOL = 160

# Widest first — later versions are the fallbacks if a work lacks the earlier.
VERSIONS = ["small", "medium", "square", "medium_rectangle", "large",
            "normalized", "main"]

WORD = re.compile(r"[a-z]+")


def flatten(text):
    flat = unicodedata.normalize("NFKD", text or "")
    return flat.encode("ascii", "ignore").decode().lower()


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
    """The saved works that can be a token: three colours and a picture."""
    out = []
    for rec in raw:
        colours = rec.get("dominant_colors") or []
        key = thumb(rec)
        if len(colours) < 3 or not key:
            continue
        medium = rec.get("medium") or ""
        out.append({
            "s": rec.get("id") or "",
            "t": rec.get("title") or "Untitled",
            "a": (rec.get("artist") or {}).get("name") or "",
            "y": rec.get("date") or "",
            "m": medium,
            "c": [c.lower() for c in colours[:3]],
            "i": key,
            "_w": set(WORD.findall(flatten(medium))),
        })
    return out


def vocabulary():
    """The land's words — the artist's own, from his works."""
    works = json.loads(WORKS.read_text())["works"]
    seen = []
    for work in works:
        for term in work.get("terms", []):
            if term not in seen:
                seen.append(term)
    return seen


def build():
    raw = json.loads(RAW.read_text())
    usable = usable_works(raw)
    terms = vocabulary()

    index, tokens = {}, []

    def keep(work):
        if work["s"] not in index:
            index[work["s"]] = len(tokens)
            tokens.append({k: work[k] for k in ("s", "t", "a", "y", "m", "c", "i")})
        return index[work["s"]]

    # Where a word is one an Artsy medium actually says, the creature can turn
    # up something that shares it. Multi-word terms — 'boarding pass', 'film
    # strip' — match nothing, and fall through to the general supply.
    by_term = {}
    for term in terms:
        want = set(WORD.findall(flatten(term)))
        if len(want) != 1:
            continue
        picks = [w for w in usable if want <= w["_w"]][:PER_TERM]
        if picks:
            by_term[term] = [keep(w) for w in picks]

    # The general supply, spread across the dump rather than taken off the top.
    step = max(1, len(usable) // POOL)
    pool = [keep(w) for w in usable[::step][:POOL]]

    return {
        "cdn": CDN,
        "saved": len(raw),
        "usable": len(usable),
        "byTerm": by_term,
        "pool": pool,
        "tokens": tokens,
    }


if __name__ == "__main__":
    land = build()
    OUT.write_text(json.dumps(land, separators=(",", ":"), ensure_ascii=False))
    print(f"{OUT.relative_to(ROOT)}  {OUT.stat().st_size / 1024:.0f} KB")
    print(f"{land['saved']} saved, {land['usable']} usable, "
          f"{len(land['tokens'])} tokens carried, "
          f"{len(land['byTerm'])} of the artist's words matched by an Artsy medium")
