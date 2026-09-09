#!/usr/bin/env python3
"""Query the normalized artworks database (data/artworks.db).

Examples:
    python3 scripts/search_artworks.py "ocean"
    python3 scripts/search_artworks.py --artist "Rudy Autio"
    python3 scripts/search_artworks.py --category Painting --forsale
    python3 scripts/search_artworks.py --color "#3a6ea5" --color-tolerance 40
"""

import argparse
import sqlite3
import sys
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "artworks.db"


def hex_to_rgb(hex_color):
    h = hex_color.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def color_distance(a, b):
    return sum((x - y) ** 2 for x, y in zip(a, b)) ** 0.5


def run_query(conn, args):
    where = []
    params = []
    joins = []

    base = "SELECT DISTINCT a.* FROM artworks a"

    if args.query:
        joins.append("JOIN artworks_fts f ON f.id = a.id")
        where.append("artworks_fts MATCH ?")
        params.append(args.query)

    if args.artist:
        joins.append("JOIN artwork_artists aa ON aa.artwork_id = a.id")
        where.append("aa.artist_name LIKE ?")
        params.append(f"%{args.artist}%")

    if args.category:
        where.append("a.category LIKE ?")
        params.append(f"%{args.category}%")

    if args.medium:
        where.append("a.medium LIKE ?")
        params.append(f"%{args.medium}%")

    if args.forsale:
        where.append("a.forsale = 1")

    sql = base
    if joins:
        sql += " " + " ".join(joins)
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY a.last_saved_at DESC"

    rows = conn.execute(sql, params).fetchall()

    if args.color:
        target = hex_to_rgb(args.color)
        colors_by_artwork = {}
        for row in conn.execute("SELECT artwork_id, r, g, b FROM artwork_colors"):
            colors_by_artwork.setdefault(row["artwork_id"], []).append(
                (row["r"], row["g"], row["b"])
            )

        matched = []
        for row in rows:
            best = min(
                (color_distance(target, c) for c in colors_by_artwork.get(row["id"], [])),
                default=None,
            )
            if best is not None and best <= args.color_tolerance:
                matched.append((best, row))
        matched.sort(key=lambda pair: pair[0])
        rows = [row for _, row in matched]

    return rows[: args.limit]


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("query", nargs="?", help="full-text search across title/artist/medium/category/blurb")
    parser.add_argument("--artist", help="filter by artist name (substring)")
    parser.add_argument("--category", help="filter by category (substring)")
    parser.add_argument("--medium", help="filter by medium (substring)")
    parser.add_argument("--forsale", action="store_true", help="only currently for-sale works")
    parser.add_argument("--color", help="hex color, e.g. #3a6ea5 — sorts/filters by nearest dominant color")
    parser.add_argument("--color-tolerance", type=float, default=60.0, help="max RGB distance for --color (default 60)")
    parser.add_argument("--limit", type=int, default=20, help="max results (default 20)")
    args = parser.parse_args()

    if not DB_PATH.exists():
        sys.exit(f"{DB_PATH} not found. Run scripts/normalize_artsy_saves.py first.")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        rows = run_query(conn, args)
    finally:
        conn.close()

    if not rows:
        print("No matches.")
        return

    for row in rows:
        artist = row["artist_name"] or "Unknown artist"
        date = row["date"] or "n.d."
        price = row["price_display"] or row["availability"] or ""
        print(f"{row['title']} — {artist} ({date}) [{row['category'] or 'Uncategorized'}] {price}")
        print(f"  {row['artsy_url']}")

    print(f"\n{len(rows)} result(s)")


if __name__ == "__main__":
    main()
