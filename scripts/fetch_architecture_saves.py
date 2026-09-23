#!/usr/bin/env python3
"""Fetch the artist's Architectural Authority bookmarks and write the raw dump to disk.

The Architectural Authority (the "A. Authority" app / thearchitecturalauthority.com)
is not a connector, so there is no proxy-injected credential the way there is for
Artsy. Instead this script reads a bearer token the artist stores in the
environment and sends it itself, exactly as the app's own front end does:

    GET /api/account-data/Social/me/bookmarks
    Authorization: Bearer <token>

The token is read from the environment variable AA_TOKEN. It is set in the cloud
environment's settings (the environment menu in the session title bar, then Edit),
never pasted into a chat and never written to the repo. A session started after it
is set picks it up. The token is the artist's own session token for his own saved
list; treat the dump it produces as private.

The bookmarks are magazine articles the artist saved, each about a building. This
script keeps only the list, raw; scripts/build_architecture.py turns it into the
small public file the site reads (each article's location comes from its public
page, which needs no token).

Usage:
    python3 scripts/fetch_architecture_saves.py --probe   # inspect one record first
    python3 scripts/fetch_architecture_saves.py           # full run
"""

import argparse
import json
import os
import sys
from pathlib import Path

import requests

# The app calls the API through its own origin (Next.js rewrites /api/... to the
# api. host); either works through the proxy, and the site origin is the one the
# browser actually uses, so a token minted there is certain to be accepted.
BASE = os.environ.get(
    "AA_BASE", "https://www.thearchitecturalauthority.com/api/account-data"
)
PATH = "Social/me/bookmarks"
TOKEN_VAR = "AA_TOKEN"          # the access token (or the one the Network tab shows)
ID_TOKEN_VAR = "AA_ID_TOKEN"    # optional: the id token, tried if the first is refused
OUT = Path(__file__).resolve().parent.parent / "data" / "architecture_saves_raw.json"

# The list may come back plain, wrapped, or paged; these are the keys the app's
# own reader tries, in order.
LIST_KEYS = ["list", "List", "items", "Items", "bookmarks", "Bookmarks",
             "data", "Data", "results", "Results"]


def clean(value):
    value = (value or "").strip().strip('"')
    # Accept a bare token or one copied with its "Bearer " prefix.
    return value[len("Bearer "):].strip() if value.lower().startswith("bearer ") else value


def tokens():
    """The tokens to try, in order. The site keeps two (an access token and an
    id token); which one its API wants is not worth a round trip to find out,
    since each change to the environment needs a new session."""
    found = [(name, clean(os.environ.get(name))) for name in (TOKEN_VAR, ID_TOKEN_VAR)]
    found = [(name, value) for name, value in found if value]
    if not found:
        sys.exit(
            f"No {TOKEN_VAR} in the environment.\n"
            "Store the Architectural Authority token in the environment's settings "
            "(the cloud environment menu in the session title bar, then Edit — as an "
            f"environment variable named {TOKEN_VAR}), then start a new session so it "
            "is picked up. Do not paste it into the chat."
        )
    return found


def unwrap(body):
    """Return the list of bookmarks from whatever envelope the API used."""
    if isinstance(body, list):
        return body
    if isinstance(body, dict):
        for key in LIST_KEYS:
            if isinstance(body.get(key), list):
                return body[key]
        # A single-object response is a list of one.
        if body:
            return [body]
    return []


def fetch(session, tok, last):
    """GET the list with one token. Returns the body, or None if the token was
    refused and there is another one to try."""
    url = f"{BASE}/{PATH}"
    try:
        response = session.get(url, headers={"Authorization": f"Bearer {tok}"}, timeout=60)
    except requests.exceptions.ProxyError as exc:
        sys.exit(
            "The egress proxy refused the connection to the Architectural Authority.\n"
            "This environment must allow thearchitecturalauthority.com (and "
            "*.thearchitecturalauthority.com) under Network access.\n"
            f"Detail: {exc}"
        )

    if response.status_code in (401, 403) and not last:
        return None
    if response.status_code in (401, 403):
        sys.exit(
            f"The API returned {response.status_code} for every token given: they are "
            f"wrong or have expired (these tokens usually last about an hour).\nCopy "
            f"fresh ones into {TOKEN_VAR} (and {ID_TOKEN_VAR}) in the environment's "
            f"settings, start a new session, and run this soon after.\n"
            f"Body: {response.text[:300]}"
        )
    if response.status_code != 200:
        sys.exit(f"Unexpected {response.status_code} from {url}\nBody: {response.text[:300]}")

    try:
        return response.json()
    except ValueError:
        sys.exit(f"The API did not return JSON.\nBody: {response.text[:300]}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--probe", action="store_true",
                        help="fetch, then print one record and the field names, without saving")
    args = parser.parse_args()

    session = requests.Session()
    order = tokens()
    body = None
    for i, (name, tok) in enumerate(order):
        body = fetch(session, tok, last=(i == len(order) - 1))
        if body is not None:
            print(f"Accepted: {name}")
            break
    saves = unwrap(body)

    if args.probe:
        print(f"{len(saves)} bookmark(s).")
        if saves:
            print("\nfirst record:")
            print(json.dumps(saves[0], indent=2, ensure_ascii=False)[:1600])
            print("\nkeys seen across records:")
            keys = sorted({k for row in saves if isinstance(row, dict) for k in row})
            print(", ".join(keys) or "(records are not objects)")
        return

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(saves, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {len(saves)} bookmark(s) to {OUT.relative_to(OUT.parent.parent)}")


if __name__ == "__main__":
    main()
