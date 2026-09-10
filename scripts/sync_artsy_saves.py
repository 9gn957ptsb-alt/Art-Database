#!/usr/bin/env python3
"""Pull newly saved artworks from Artsy and fold them into the database.

Artsy publishes no webhook for saves, so this polls. It is cheap because it walks
the collection newest-first and stops as soon as it has seen enough consecutive
artworks it already holds — a normal run reads one page.

Ordering note, which the incremental logic depends on: the saves endpoint returns
the collection *oldest-first* by default, and ``sort=-created_at`` reverses it. The
artwork's own ``last_saved_at`` cannot be used to find new saves — it records when
anyone at all last saved that work, so popular pieces read as saved today.

Full chain per run: fetch new saves -> append to the raw dump -> normalize ->
fetch thumbnails for the new works only -> rebuild the page.

Usage:
    python3 scripts/sync_artsy_saves.py            # incremental
    python3 scripts/sync_artsy_saves.py --full     # re-fetch everything
    python3 scripts/sync_artsy_saves.py --check    # report new saves, change nothing
"""

import argparse
import json
import subprocess
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_artsy_saves import DEFAULT_USER_ID, extract_records  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "data" / "artsy_saves_raw.json"
SCRIPTS = ROOT / "scripts"

BASE = "https://api.artsy.net/api/v1"
PATH = "collection/saved-artwork/artworks"
PAGE_SIZE = 100
DELAY_SECONDS = 0.4
# Stop once this many already-known works have gone by; guards against a save that
# lands out of order without walking all fifty pages every run.
STOP_AFTER_KNOWN = 60


def request_page(session, user_id, page, size):
    params = {
        "size": size, "page": page, "user_id": user_id,
        "private": "true", "sort": "-created_at",
    }
    try:
        response = session.get(f"{BASE}/{PATH}", params=params, timeout=60)
    except requests.exceptions.ProxyError as exc:
        sys.exit(f"Egress proxy refused api.artsy.net. Detail: {exc}")
    if response.status_code in (401, 403):
        sys.exit(
            f"Artsy returned {response.status_code}. The proxy attached no valid "
            f"X-ACCESS-TOKEN — the environment credential may have been revoked.\n"
            f"Body: {response.text[:300]}"
        )
    if not response.ok:
        sys.exit(f"HTTP {response.status_code}: {response.text[:300]}")
    return response.json()


def fetch_new(session, user_id, known):
    """Walk newest-first, collecting works not already held."""
    new, seen_known, page = [], 0, 1
    while True:
        records = extract_records(request_page(session, user_id, page, PAGE_SIZE))
        if not records:
            break
        for record in records:
            if record.get("id") in known:
                seen_known += 1
            else:
                new.append(record)
        print(f"  page {page}: {len(new)} new so far, {seen_known} known seen")
        if seen_known >= STOP_AFTER_KNOWN:
            break
        page += 1
        time.sleep(DELAY_SECONDS)
    return new


def run(script, *args):
    result = subprocess.run(
        [sys.executable, str(SCRIPTS / script), *args], cwd=str(ROOT)
    )
    if result.returncode != 0:
        sys.exit(f"{script} failed with exit code {result.returncode}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--full", action="store_true", help="re-fetch the whole collection")
    parser.add_argument("--check", action="store_true", help="report new saves, change nothing")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    args = parser.parse_args()

    if args.full:
        run("fetch_artsy_saves.py")
        run("normalize_artsy_saves.py")
        run("fetch_thumbnails.py", "--only-missing", "--edge", "112", "--quality", "58")
        run("build_artifact.py")
        return

    if not RAW_PATH.exists():
        sys.exit(f"{RAW_PATH} not found. Run with --full for the first import.")

    existing = json.loads(RAW_PATH.read_text())
    known = {r.get("id") for r in existing}

    with requests.Session() as session:
        session.headers.update({"Accept": "application/vnd.artsy-v2+json"})
        new = fetch_new(session, args.user_id, known)

    if not new:
        print("No new saves.")
        return

    # Newest-first from the API; the raw dump runs oldest-first, so reverse and append.
    new.reverse()
    print(f"\n{len(new)} new save(s):")
    for record in new:
        artist = (record.get("artist") or {}).get("name") or "Unknown artist"
        print(f"  {artist} — {record.get('title')}")

    if args.check:
        print("\n--check: nothing written.")
        return

    RAW_PATH.write_text(json.dumps(existing + new, indent=2))
    run("normalize_artsy_saves.py")
    run("fetch_thumbnails.py", "--only-missing", "--edge", "112", "--quality", "58")
    run("build_artifact.py")
    print(f"\nSynced {len(new)} new artwork(s).")


if __name__ == "__main__":
    main()
