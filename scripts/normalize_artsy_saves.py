#!/usr/bin/env python3
"""Normalize the raw Artsy saves dump into a searchable SQLite database.

Reads ``data/artsy_saves_raw.json`` (Artsy's raw, deeply-nested API shape —
see ``scripts/fetch_artsy_saves.py``) and writes ``data/artworks.db``: a flat,
indexed, full-text-searchable database of the same artworks.

The database has three tables:
  - ``artworks``       one row per saved artwork, with the fields worth
                        filtering or sorting on pulled up to top-level columns.
  - ``artwork_artists`` one row per (artwork, artist) pair, since some pieces
                        have multiple artists/cultural makers.
  - ``artwork_colors``  one row per (artwork, dominant color), since color is
                        a first-class way to browse this collection.
  - ``artworks_fts``    an FTS5 full-text index over title/artist/medium/
                        category/partner/blurb for keyword search.

Rebuilds from scratch every run, so it's safe to re-run after a fresh fetch.

Usage:
    python3 scripts/normalize_artsy_saves.py
"""

import json
import sqlite3
import sys
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
RAW_PATH = DATA_DIR / "artsy_saves_raw.json"
DB_PATH = DATA_DIR / "artworks.db"

SCHEMA = """
CREATE TABLE artworks (
    id                     TEXT PRIMARY KEY,
    title                  TEXT,
    artist_name            TEXT,
    artist_id              TEXT,
    partner_name           TEXT,
    partner_id             TEXT,
    category               TEXT,
    medium                 TEXT,
    date                   TEXT,
    width_cm               REAL,
    height_cm              REAL,
    depth_cm               REAL,
    diameter_cm            REAL,
    dimensions_in          TEXT,
    dimensions_cm          TEXT,
    is_unique              INTEGER,
    forsale                INTEGER,
    sold                   INTEGER,
    availability           TEXT,
    price_display          TEXT,
    price_currency         TEXT,
    price_cents_low        INTEGER,
    price_cents_high       INTEGER,
    sale_message           TEXT,
    blurb                  TEXT,
    collecting_institution TEXT,
    image_url              TEXT,
    artsy_url              TEXT,
    last_saved_at          TEXT,
    published_at           TEXT
);

CREATE INDEX idx_artworks_artist_name ON artworks(artist_name);
CREATE INDEX idx_artworks_category ON artworks(category);
CREATE INDEX idx_artworks_forsale ON artworks(forsale);
CREATE INDEX idx_artworks_last_saved_at ON artworks(last_saved_at);

CREATE TABLE artwork_artists (
    artwork_id  TEXT NOT NULL REFERENCES artworks(id),
    position    INTEGER NOT NULL,
    artist_id   TEXT,
    artist_name TEXT,
    nationality TEXT,
    years       TEXT
);

CREATE INDEX idx_artwork_artists_artwork_id ON artwork_artists(artwork_id);
CREATE INDEX idx_artwork_artists_name ON artwork_artists(artist_name);

CREATE TABLE artwork_colors (
    artwork_id TEXT NOT NULL REFERENCES artworks(id),
    position   INTEGER NOT NULL,
    hex        TEXT NOT NULL,
    r          INTEGER NOT NULL,
    g          INTEGER NOT NULL,
    b          INTEGER NOT NULL
);

CREATE INDEX idx_artwork_colors_artwork_id ON artwork_colors(artwork_id);

CREATE VIRTUAL TABLE artworks_fts USING fts5(
    id UNINDEXED,
    title,
    artist_names,
    medium,
    category,
    partner_name,
    blurb
);
"""


def to_bool_int(value):
    """Map Python truthy/None to 0/1/NULL for SQLite's integer booleans."""
    if value is None:
        return None
    return 1 if value else 0


def hex_to_rgb(hex_color):
    """'#f1d8bd' -> (241, 216, 189). Returns None for anything malformed."""
    h = (hex_color or "").lstrip("#")
    if len(h) != 6:
        return None
    try:
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return None


def collect_artists(record):
    """De-duplicate record['artists'] (falling back to the singular 'artist'),
    preserving order. Some records (design objects, etc.) carry a manufacturer
    or cultural maker instead of a formal artist — those are left out here and
    surfaced separately if ever needed, since they aren't structured the same way.
    """
    artists = record.get("artists") or []
    if not artists and record.get("artist"):
        artists = [record["artist"]]

    seen = set()
    deduped = []
    for artist in artists:
        if not isinstance(artist, dict):
            continue
        artist_id = artist.get("id") or artist.get("_id")
        if artist_id in seen:
            continue
        seen.add(artist_id)
        deduped.append(artist)
    return deduped


def pick_image_url(images):
    """Prefer a decent-sized real URL; fall back to the ':version' template."""
    if not images:
        return None
    image = images[0]
    urls = image.get("image_urls") or {}
    for size in ("large", "normalized", "medium", "large_rectangle", "square"):
        if urls.get(size):
            return urls[size]
    template = image.get("image_url")
    if template and ":version" in template:
        return template.replace(":version", "large")
    return template


def price_cents_range(record):
    cents = record.get("price_cents")
    if not isinstance(cents, list) or not cents:
        return None, None
    return min(cents), max(cents)


def normalize_record(record):
    """Flatten one raw Artsy record into the columns of the `artworks` table
    plus its related artists and colors."""
    artist = record.get("artist") or {}
    partner = record.get("partner") or {}
    dimensions = record.get("dimensions") or {}
    artists = collect_artists(record)
    price_low, price_high = price_cents_range(record)

    artwork_id = record.get("id")
    row = {
        "id": artwork_id,
        "title": record.get("title") or None,
        "artist_name": artist.get("name") or (artists[0]["name"] if artists else None),
        "artist_id": artist.get("id") or (artists[0].get("id") if artists else None),
        "partner_name": partner.get("name") or None,
        "partner_id": partner.get("id") or None,
        "category": record.get("category") or None,
        "medium": record.get("medium") or None,
        "date": record.get("date") or None,
        "width_cm": record.get("width_cm"),
        "height_cm": record.get("height_cm"),
        "depth_cm": record.get("depth_cm"),
        "diameter_cm": record.get("diameter_cm"),
        "dimensions_in": dimensions.get("in"),
        "dimensions_cm": dimensions.get("cm"),
        "is_unique": to_bool_int(record.get("unique")),
        "forsale": to_bool_int(record.get("forsale")),
        "sold": to_bool_int(record.get("sold")),
        "availability": record.get("availability") or None,
        "price_display": record.get("price") or None,
        "price_currency": record.get("price_currency") or None,
        "price_cents_low": price_low,
        "price_cents_high": price_high,
        "sale_message": record.get("sale_message") or None,
        "blurb": record.get("blurb") or None,
        "collecting_institution": record.get("collecting_institution") or None,
        "image_url": pick_image_url(record.get("images")),
        "artsy_url": f"https://www.artsy.net/artwork/{artwork_id}" if artwork_id else None,
        "last_saved_at": record.get("last_saved_at"),
        "published_at": record.get("published_at"),
    }

    artist_rows = [
        {
            "artwork_id": artwork_id,
            "position": position,
            "artist_id": a.get("id"),
            "artist_name": a.get("name"),
            "nationality": a.get("nationality") or None,
            "years": a.get("years") or None,
        }
        for position, a in enumerate(artists)
    ]

    color_rows = []
    for position, hex_color in enumerate(record.get("dominant_colors") or []):
        rgb = hex_to_rgb(hex_color)
        if rgb is None:
            continue
        color_rows.append(
            {
                "artwork_id": artwork_id,
                "position": position,
                "hex": hex_color,
                "r": rgb[0],
                "g": rgb[1],
                "b": rgb[2],
            }
        )

    return row, artist_rows, color_rows


def build_database(records, db_path):
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA)

        artwork_rows, artist_rows, color_rows, fts_rows = [], [], [], []
        skipped = 0
        for record in records:
            if not record.get("id"):
                skipped += 1
                continue
            row, artists, colors = normalize_record(record)
            artwork_rows.append(row)
            artist_rows.extend(artists)
            color_rows.extend(colors)
            fts_rows.append(
                (
                    row["id"],
                    row["title"],
                    ", ".join(a["artist_name"] for a in artists if a["artist_name"]),
                    row["medium"],
                    row["category"],
                    row["partner_name"],
                    row["blurb"],
                )
            )

        conn.executemany(
            f"""INSERT INTO artworks ({", ".join(artwork_rows[0].keys())})
                VALUES ({", ".join("?" for _ in artwork_rows[0])})""",
            [tuple(r.values()) for r in artwork_rows],
        )
        conn.executemany(
            """INSERT INTO artwork_artists
               (artwork_id, position, artist_id, artist_name, nationality, years)
               VALUES (:artwork_id, :position, :artist_id, :artist_name, :nationality, :years)""",
            artist_rows,
        )
        conn.executemany(
            """INSERT INTO artwork_colors (artwork_id, position, hex, r, g, b)
               VALUES (:artwork_id, :position, :hex, :r, :g, :b)""",
            color_rows,
        )
        conn.executemany(
            """INSERT INTO artworks_fts
               (id, title, artist_names, medium, category, partner_name, blurb)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            fts_rows,
        )
        conn.commit()
    finally:
        conn.close()

    return len(artwork_rows), skipped


def main():
    if not RAW_PATH.exists():
        sys.exit(
            f"{RAW_PATH} not found. Run scripts/fetch_artsy_saves.py first "
            "(and `git lfs pull` if it's checked out as an LFS pointer)."
        )

    records = json.loads(RAW_PATH.read_text())
    if not records:
        sys.exit(f"{RAW_PATH} contains no records.")

    written, skipped = build_database(records, DB_PATH)

    print(f"Normalized {written} artworks into {DB_PATH}")
    if skipped:
        print(f"Skipped {skipped} record(s) with no id.")
    print(f"Database size: {DB_PATH.stat().st_size / 1_000_000:.1f} MB")


if __name__ == "__main__":
    main()
