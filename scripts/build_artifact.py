#!/usr/bin/env python3
"""Build the standalone collection-browser page from data/artworks.db.

Reads the normalized database and injects a compact JSON payload into
``artifact/index.template.html``, writing ``artifact/color-middling.html`` —
a single self-contained file with no external data dependency.

Published artifacts block external images under CSP, so the page renders each
work from its dominant colors and real dimensions rather than its thumbnail,
and links out to Artsy per work.

Usage:
    python3 scripts/build_artifact.py
"""

import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "artworks.db"
TEMPLATE_PATH = ROOT / "artifact" / "index.template.html"
OUT_PATH = ROOT / "artifact" / "color-middling.html"

PLACEHOLDER = "__DATA__"

# Record layout, mirrored by the unpack step in the page's JavaScript. Packed as
# arrays rather than objects: at ~5k records the repeated keys cost more than the
# payload itself.
FIELDS = [
    "id",
    "title",
    "artist_name",
    "date",
    "category",
    "medium",
    "dimensions_cm",
    "width_cm",
    "height_cm",
    "partner_name",
    "price_display",
    "forsale",
    "last_saved_at",
]


def load_records(conn):
    colors = {}
    for row in conn.execute(
        "SELECT artwork_id, hex FROM artwork_colors ORDER BY artwork_id, position"
    ):
        colors.setdefault(row["artwork_id"], []).append(row["hex"])

    records = []
    for row in conn.execute(
        f"SELECT {', '.join(FIELDS)} FROM artworks ORDER BY last_saved_at DESC"
    ):
        record = [row[field] for field in FIELDS]
        # Trim the timestamp to a year; nothing in the page shows finer than that.
        record[-1] = (row["last_saved_at"] or "")[:4] or None
        record.append(colors.get(row["id"], []))
        records.append(record)
    return records


def main():
    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found. Run scripts/normalize_artsy_saves.py first.")
    if not TEMPLATE_PATH.exists():
        sys.exit(f"{TEMPLATE_PATH} not found.")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        records = load_records(conn)
    finally:
        conn.close()

    payload = json.dumps(
        {"fields": FIELDS + ["colors"], "records": records},
        separators=(",", ":"),
        ensure_ascii=False,
    )
    # Keep a literal </script> in the data from ending the host script element.
    payload = payload.replace("</", "<\\/")

    template = TEMPLATE_PATH.read_text()
    if PLACEHOLDER not in template:
        sys.exit(f"{TEMPLATE_PATH} has no {PLACEHOLDER} placeholder.")

    OUT_PATH.write_text(template.replace(PLACEHOLDER, payload))

    print(f"Built {OUT_PATH} from {len(records)} artworks")
    print(f"Page size: {OUT_PATH.stat().st_size / 1_000_000:.2f} MB")


if __name__ == "__main__":
    main()
