#!/usr/bin/env python3
"""The saves, fresh from Artsy, into data/artworks.db: step 1 of the coworker's week (COWORKER.md).

Fetches every save as scripts/fetch_artsy_saves.py does (the proxy adds the token; this sends none), but four pages at
a time, and retries a page whose tunnel dropped, timed out or came back 5xx or 429: with forty thousand saves, four hundred
pages, a sequential run rarely gets through (the make-up run of 13 October 2026 was stopped by a 502 at page 103, then
by a dropped tunnel at page 337). A 401, 403, 404 or 407 is the credential, the path or the proxy's policy, and is
reported, never retried. Artsy's count of the saves runs behind them (on 14 October it said 42,562 with three more
full pages beyond), so after the pages it counts it goes on, page by page, until one comes back empty. It writes
data/artsy_saves_raw.json only when it has nearly every save Artsy counts.

Then it normalizes them into data/artworks.db with the normalizer from the branch claude/artsy-import-rwgk8s, read
with `git show` and run in memory (it is never written into this branch), patched for an open-ended price ("from
$5,000", a price_cents list holding a null), which would otherwise stop it.

    git fetch origin claude/artsy-import-rwgk8s
    python3 dirt/artists/saves.py
"""
import importlib.util
import json
import math
import subprocess
import sys
import threading
import time
import types
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

REPO = Path(__file__).resolve().parents[2]
NORMALIZER = "origin/claude/artsy-import-rwgk8s:scripts/normalize_artsy_saves.py"
THREADS = 4
TRIES = 8

spec = importlib.util.spec_from_file_location("fetch_artsy_saves", REPO / "scripts" / "fetch_artsy_saves.py")
fa = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fa)
local = threading.local()


def session():
    if not hasattr(local, "s"):
        local.s = requests.Session()
        local.s.headers.update({"Accept": "application/vnd.artsy-v2+json"})
    return local.s


def patiently(what, call):
    """call(), again after a pause when it fails in a way that passes (a dropped tunnel, a timeout, a 5xx or a 429)."""
    wait = 2
    for attempt in range(TRIES):
        try:
            return call()
        except SystemExit as e:                  # fetch_artsy_saves exits with a message on every failure it knows
            msg = str(e.code)
            detail = msg.split("Detail:")[-1]
            transient = msg.startswith(("HTTP 5", "HTTP 429")) or (msg.startswith("The egress proxy")
                                                                   and "403" not in detail and "407" not in detail)
            if not transient or attempt == TRIES - 1:
                raise
            why = msg.splitlines()[0][:80]
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout, ValueError) as e:
            policy = isinstance(e, requests.exceptions.ProxyError) and ("403" in str(e) or "407" in str(e))
            if policy or attempt == TRIES - 1:   # ValueError: a body cut off mid-JSON
                raise
            why = type(e).__name__
        print(f"{what}: {why}; again in {wait}s", flush=True)
        time.sleep(wait)
        wait = min(wait * 2, 60)


def total_saves():
    def ask():
        r = session().get(f"{fa.BASE}/{fa.PATH}", params={"size": 1, "page": 1, "user_id": fa.DEFAULT_USER_ID,
                                                           "private": "true", "total_count": 1}, timeout=60)
        if r.status_code >= 500 or r.status_code == 429:
            sys.exit(f"HTTP {r.status_code} counting the saves")
        if "X-Total-Count" not in r.headers:
            sys.exit(f"Artsy gave no count (HTTP {r.status_code}): {r.text[:300]}")
        return int(r.headers["X-Total-Count"])
    return patiently("count", ask)


def fetch():
    total = total_saves()
    pages = math.ceil(total / fa.PAGE_SIZE) + 1             # one more, for saves made while it runs
    print(f"Artsy counts {total} saves: pages 1 to {pages}", flush=True)

    def page(p):
        return fa.extract_records(patiently(f"page {p}", lambda: fa.request_page(session(), fa.DEFAULT_USER_ID, p,
                                                                                   fa.PAGE_SIZE)))
    ex = ThreadPoolExecutor(THREADS)
    try:
        got = list(ex.map(page, range(1, pages + 1)))      # in page order: the order they were saved
    finally:
        ex.shutdown(cancel_futures=True)                   # a page that fails for good stops the rest
    while got[-1]:                                          # the count runs behind: on, until a page comes back empty
        got.append(page(len(got) + 1))
    print(f"{len(got)} pages, the last empty", flush=True)
    records, seen = [], set()
    for recs in got:
        for rec in recs:
            if rec.get("id") not in seen:
                seen.add(rec.get("id"))
                records.append(rec)
    print(f"{len(records)} saves fetched", flush=True)
    if len(records) < 0.98 * total:
        sys.exit(f"Only {len(records)} of Artsy's {total}; data/artsy_saves_raw.json is left as it was.")
    fa.OUT.parent.mkdir(exist_ok=True)
    fa.OUT.write_text(json.dumps(records, indent=2))


def open_price(record):
    """price_cents as a (low, high) pair, a bound left empty where the range is open."""
    cents = record.get("price_cents")
    if not isinstance(cents, list) or not cents:
        return None, None
    known = [c for c in cents if isinstance(c, (int, float))]
    if not known:
        return None, None
    if len(known) < len(cents):                  # an open-ended range ("from X"): keep the bound that is given
        lo, hi = cents[0], cents[-1]
        return (lo if isinstance(lo, (int, float)) else None), (hi if isinstance(hi, (int, float)) else None)
    return min(known), max(known)


def normalize():
    src = subprocess.run(["git", "show", NORMALIZER], cwd=REPO, capture_output=True, text=True)
    if src.returncode:
        sys.exit(f"Cannot read the normalizer ({src.stderr.strip()}); run git fetch origin claude/artsy-import-rwgk8s")
    norm = types.ModuleType("normalize_artsy_saves")
    norm.__file__ = str(REPO / "scripts" / "normalize_artsy_saves.py")   # so it finds data/ as it would there
    exec(compile(src.stdout, NORMALIZER, "exec"), norm.__dict__)
    norm.price_cents_range = open_price
    norm.main()


if __name__ == "__main__":
    fetch()
    normalize()
