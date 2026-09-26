#!/usr/bin/env python3
"""Antiquity: the history of Greece and Rome, from the saved works, in the order of the history they show.

DRIFT puts the whole of it in a raindrop and behind the leaves of a tree (see dirt/README.md). This picks the saved
works that are that history or its afterlife, orders them by the time they show (not the time they were made): a
Bronze Age jar, the Trojan War and the wanderings of Ulysses, the Minotaur, Attic and Apulian vases, Bacchus, Roman
temples and triumphs, Commodus, the arch of Septimius Severus, the amphitheatre, the ruins, and Rome as painters and
Twombly came back to it; and writes each as a square image, a patch of its middle, for the page's texture array.
Images come from the collection's own image links; they and the output stay in dirt/private/ and are never committed.

    python3 dirt/artists/antiquity.py --db artworks.db --out dirt/private/antiquity
"""

import argparse
import io
import json
import sqlite3
import subprocess
from pathlib import Path

from PIL import Image

# (save_rank, the time it shows): the history, in order
HISTORY = [
    (4414, "Cyprus, 1200-800 BCE"),
    (173, "Troy: the death of Hektor"),
    (676, "Ulysses"),
    (318, "Crete: the Minotaur"),
    (4413, "Athens, 460-430 BCE"),
    (4411, "Apulia, 400-300 BCE"),
    (1970, "Bacchus"),
    (431, "Baia: a Roman temple"),
    (532, "Rome, 19 CE: Agrippina lands with the ashes of Germanicus"),
    (200, "Rome, 180-192 CE: Commodus"),
    (2264, "Rome, 203 CE: the arch of Septimius Severus"),
    (4220, "The amphitheatre"),
    (2962, "Ruins on a shore"),
    (4498, "Ruins"),
    (4069, "Rome, again: Roman Notes"),
    (642, "Rome, again: an interior"),
]
SIDE = 233


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", required=True)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()
    db, out = sqlite3.connect(args.db), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    made = []
    for rank, when in HISTORY:
        row = db.execute("select artist_name, title, date, image_url from artworks where save_rank = ?", (rank,)).fetchone()
        if not row or not row[3]:
            print("no image:", rank)
            continue
        url = row[3]
        data = subprocess.run(["curl", "-s", "-m", "30", url], capture_output=True).stdout   # as the other scripts fetch
        if len(data) < 1000:                                         # a missing image leaves a gap in the history
            print("could not fetch", rank)
            continue
        im = Image.open(io.BytesIO(data)).convert("RGB")
        s = min(im.size)                                             # the middle of it, square
        im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2))
        im = im.resize((SIDE, SIDE), Image.LANCZOS)
        f = f"a{len(made):02d}.jpg"
        im.save(out / f, quality=88)
        made.append({"file": f, "when": when, "artist": row[0], "title": row[1], "date": row[2]})
        print(f, when, "|", row[0], "|", row[1][:60])
    (out / "antiquity.json").write_text(json.dumps(made, indent=1, ensure_ascii=False))
    print(len(made), "in", out)


if __name__ == "__main__":
    main()
