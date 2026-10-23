#!/usr/bin/env python3
"""Page the Artsy API for saved artworks and write the raw responses to disk.

Authentication is handled outside this process. The cloud environment stores the
Artsy user token as an API credential, and Anthropic's agent proxy attaches the
``X-ACCESS-TOKEN`` header to matching requests after they leave the session. This
script therefore sends no token of its own and must never be given one.

Endpoint and header names were taken from Artsy's own open-source GraphQL API:
  - collection/saved-artwork/artworks  (src/lib/loaders/loaders_with_authentication/gravity.ts)
  - X-ACCESS-TOKEN                     (src/lib/apis/gravity.ts)

Only the works the artist saved himself are written. Since October 2026 the account also holds the saving
run's works (scripts/save_followed_artworks.py: every work by the artists he follows, about 53,000), and he chose
(22 Oct 2026) to keep them off the site for now. The listing runs oldest first, so the run's works are one block
in it: their ids are in data/follow_saves/run_ids.json (private, kept in the private repository
9gn957ptsb-alt/art-database-data). The script pages up to the block, finds its end by halving, and pages on
from there: about 60 pages instead of 580. A work saved by hand after the run comes after the block and is kept;
one saved by hand while the run was saving (1-14 Oct 2026) is inside it and cannot be told from the run's.

Usage:
    python3 scripts/fetch_artsy_saves.py --probe    # inspect one record's shape first
    python3 scripts/fetch_artsy_saves.py            # full run
"""

import argparse
import json
import math
import sys
import time
from pathlib import Path

import requests

BASE = "https://api.artsy.net/api/v1"
PATH = "collection/saved-artwork/artworks"
DEFAULT_USER_ID = "5a296eb67622dd4a817fccf9"
OUT = Path(__file__).resolve().parent.parent / "data" / "artsy_saves_raw.json"
RUN = OUT.parent / "follow_saves" / "run_ids.json"     # the saving run's works, one block in the listing (private)

# Gravity caps page size; 100 is the conventional maximum.
PAGE_SIZE = 100
# Be a considerate client: Artsy is doing us a favour serving 40+ sequential pages.
DELAY_SECONDS = 0.5


def request_page(session, user_id, page, size):
    """Fetch one page. Returns the decoded body, or exits with a useful message."""
    params = {"size": size, "page": page, "user_id": user_id, "private": "true"}
    url = f"{BASE}/{PATH}"

    try:
        response = session.get(url, params=params, timeout=60)
    except requests.exceptions.ProxyError as exc:
        sys.exit(
            "The egress proxy refused the connection to api.artsy.net (403 Forbidden).\n"
            "This session's environment does not allow that domain. Run this from a "
            "session whose environment has Network access: Custom with api.artsy.net in "
            "Allowed domains.\n"
            f"Detail: {exc}"
        )

    if response.status_code in (401, 403):
        sys.exit(
            f"Artsy returned {response.status_code}. The proxy did not attach a valid "
            f"X-ACCESS-TOKEN.\nCheck the environment's API credential: header name "
            f"X-ACCESS-TOKEN, empty prefix, allowed website api.artsy.net.\n"
            f"Body: {response.text[:400]}"
        )
    if response.status_code == 404:
        sys.exit(
            f"404 from {url}.\nThe path or the user_id may be wrong. Re-check against "
            f"the saves URL, and try dropping --user-id so the token identifies the user."
        )
    if not response.ok:
        sys.exit(f"HTTP {response.status_code} from {url}\nBody: {response.text[:400]}")

    return response.json()


def extract_records(body):
    """Pull the artwork list out of the body without assuming one envelope shape."""
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in ("_embedded", "body", "results", "artworks", "data"):
            nested = body.get(key)
            if isinstance(nested, list):
                return nested
            if isinstance(nested, dict):
                for inner in ("artworks", "results"):
                    if isinstance(nested.get(inner), list):
                        return nested[inner]
    return []


def probe(session, user_id):
    """Fetch a single record and report its shape, so normalisation isn't guesswork."""
    body = request_page(session, user_id, page=1, size=1)
    print("Top-level type:", type(body).__name__)
    if isinstance(body, dict):
        print("Top-level keys:", sorted(body.keys()))

    records = extract_records(body)
    print(f"Records found on page: {len(records)}")
    if not records:
        print("\nNo records extracted. Full body below so the envelope can be identified:")
        print(json.dumps(body, indent=2)[:4000])
        return

    print("\nFirst record's keys:")
    print(json.dumps(sorted(records[0].keys()), indent=2))
    print("\nFirst record in full:")
    print(json.dumps(records[0], indent=2)[:4000])


def fetch_all(session, user_id, run):
    """Every saved record but the saving run's: page up to the run's block, halve to its end, page on from there."""
    kept, seen, every, reads = [], set(), set(), [0]

    def page_of(page):
        reads[0] += 1
        records = extract_records(request_page(session, user_id, page=page, size=PAGE_SIZE))
        time.sleep(DELAY_SECONDS)
        return records

    def again(records):
        """Guard against an endpoint that ignores `page` and re-serves a page it has already given."""
        ids = {r.get("id") for r in records}
        if ids and ids <= every:
            print("A page returned only records already seen; stopping.")
            return True
        every.update(ids)
        return False

    def inside(records):
        return bool(records) and all(r.get("_id") in run for r in records)

    def keep(records):
        new = [r for r in records if r.get("_id") not in run and r.get("id") not in seen]
        seen.update(r.get("id") for r in new)
        kept.extend(new)

    page = 1
    while True:
        records = page_of(page)
        if not records or again(records):
            return kept, reads[0]
        if inside(records):
            break
        keep(records)
        print(f"page {page}: kept {len(kept)}")
        page += 1
    # Within the block every page is the run's, and the block is no longer than the run: its end is before hi.
    lo, hi = page, page + math.ceil(len(run) / PAGE_SIZE) + 1
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if inside(page_of(mid)):
            lo = mid
        else:
            hi = mid
    print(f"pages {page}-{lo}: the saving run's, skipped")
    page = hi
    while True:
        records = page_of(page)
        if not records or again(records):
            return kept, reads[0]
        keep(records)
        print(f"page {page}: kept {len(kept)}")
        page += 1


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true", help="inspect one record and exit")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID, help="Artsy user id")
    args = parser.parse_args()

    with requests.Session() as session:
        session.headers.update({"Accept": "application/vnd.artsy-v2+json"})

        if args.probe:
            probe(session, args.user_id)
            return

        if not RUN.exists():
            sys.exit(f"{RUN.relative_to(OUT.parent.parent)} is missing: restore data/ from the private repository "
                     "9gn957ptsb-alt/art-database-data (its README says how). Without it every work of the saving "
                     "run would be written as one the artist saved himself.")
        run = set(json.loads(RUN.read_text()))
        records, reads = fetch_all(session, args.user_id, run)

    if not records:
        sys.exit("No records fetched. Run with --probe to inspect the response shape.")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(records, indent=2))
    print(f"\nWrote {len(records)} records to {OUT} ({reads} pages read; the saving run's {len(run)} left out)")


if __name__ == "__main__":
    main()
