#!/usr/bin/env python3
"""Keep the repository level with the Artsy saves collection.

This does not poll for what looks new. Every run walks the *entire* saves
collection, builds the complete set of saved artwork ids, and compares it with
what the repository holds — in both directions. A save is missing if Artsy has
it and we do not; a save has been removed if we have it and Artsy does not. Both
are drift, both are repaired, and the run only reports success once a second,
independent pass proves the two sides match.

Why a full walk. The previous version read one page and stopped once sixty
already-known works had gone by. That is a guess about how far out of order a
save can land, and a guess is exactly what cannot be relied on: a save landing
sixty-one works deep was missed permanently and nothing would ever have noticed.
Fifty-one pages cost about half a minute once a day. The guarantee is worth more.

The saves endpoint returns a bare JSON list with no total-count field, so there
is no cheap invariant to check instead — completeness has to be walked.

Ordering note the append depends on: the endpoint returns the collection
*oldest-first* by default and ``sort=-created_at`` reverses it. The artwork's own
``last_saved_at`` records when *anyone* last saved that work, so popular pieces
read as saved today and it can never be used to find new saves.

Only the works Matt saved himself. From 1 to 14 Oct 2026 a run saved every work by
the artists he follows; he chose (22 Oct 2026) to keep those off for now. They are
one block of the listing, their ids in data/follow_saves/run_ids.json (private,
gitignored here: copied in from the site's data/, kept in the private repository
art-database-data). The walk still reads every page, and then sets them aside, so
the both-ways diff stays exact over what is left. Without the file the walk would
add some fifty thousand works, so the script refuses to run.

Full chain per run: walk the collection -> set the run's works aside -> diff both
directions -> repair the raw dump -> normalize -> thumbnails for the new works ->
search page -> voxels -> objects page -> verify.

Usage:
    python3 scripts/sync_artsy_saves.py            # reconcile, repair, verify
    python3 scripts/sync_artsy_saves.py --check    # report drift, change nothing
    python3 scripts/sync_artsy_saves.py --full     # re-fetch every record's fields
    python3 scripts/sync_artsy_saves.py --verify   # check local consistency only

Exit status is the point: non-zero means the two sides are not level, or the
repository is internally inconsistent. A green run means checked, not assumed.
"""

import argparse
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_artsy_saves import DEFAULT_USER_ID, extract_records  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW_PATH = DATA / "artsy_saves_raw.json"
DB_PATH = DATA / "artworks.db"
OBJECTS_PATH = DATA / "objects.json"
THUMBS_PATH = DATA / "thumbs.json"
RUN_IDS_PATH = DATA / "follow_saves" / "run_ids.json"
SCRIPTS = ROOT / "scripts"

BASE = "https://api.artsy.net/api/v1"
PATH = "collection/saved-artwork/artworks"
PAGE_SIZE = 100
DELAY_SECONDS = 0.4
# A ceiling on the walk, not a cutoff on the comparison: at 100 per page this is
# 100,000 works. Reaching it means the endpoint is looping, not that we're done.
MAX_PAGES = 1000
# Refuse to delete more than this fraction of the collection in one run without
# being told to. Unsaving is legitimate; a truncated API response is not, and the
# two look identical from here.
SHRINK_LIMIT = 0.10
# And to add more than this fraction without being told to: the saving run's works
# are set aside only by their ids, so a stale or wrong id file would let fifty
# thousand of them in, and nothing after the write could tell.
GROWTH_LIMIT = 0.10
# A walk of ~580 pages meets a dropped connection or a 5xx now and then.
RETRIES = 4


def request_page(session, user_id, page, size):
    params = {
        "size": size, "page": page, "user_id": user_id,
        "private": "true", "sort": "-created_at",
    }
    for attempt in range(RETRIES):
        wait = 2 ** (attempt + 1)
        try:
            response = session.get(f"{BASE}/{PATH}", params=params, timeout=60)
        except requests.exceptions.ProxyError as exc:
            sys.exit(f"Egress proxy refused api.artsy.net. Detail: {exc}")
        except (requests.exceptions.ConnectionError, requests.exceptions.Timeout) as exc:
            if attempt == RETRIES - 1:
                sys.exit(f"Page {page}: {exc}")
            print(f"  page {page}: {type(exc).__name__}, again in {wait}s", flush=True)
            time.sleep(wait)
            continue
        if (response.status_code == 429 or response.status_code >= 500) and attempt < RETRIES - 1:
            print(f"  page {page}: HTTP {response.status_code}, again in {wait}s", flush=True)
            time.sleep(wait)
            continue
        break
    if response.status_code in (401, 403):
        sys.exit(
            f"Artsy returned {response.status_code}. The proxy attached no valid "
            f"X-ACCESS-TOKEN — the environment credential may have been revoked.\n"
            f"Body: {response.text[:300]}"
        )
    if not response.ok:
        sys.exit(f"HTTP {response.status_code}: {response.text[:300]}")
    return response.json()


def walk_collection(session, user_id):
    """Read every page, newest-first. Returns the complete record list.

    Exits rather than returning a short list: a partial walk read as complete
    would be reported as deletions and quietly wipe good rows.
    """
    records, seen, page = [], set(), 1
    while page <= MAX_PAGES:
        body = request_page(session, user_id, page, PAGE_SIZE)
        batch = extract_records(body)
        if not batch:
            print(f"  page {page}: empty — end of collection")
            return records
        fresh = [r for r in batch if r.get("id") not in seen]
        if not fresh:
            sys.exit(
                f"Page {page} re-served records already seen. The endpoint is "
                f"ignoring `page`; the walk cannot be trusted, so nothing was changed."
            )
        seen.update(r.get("id") for r in fresh)
        records.extend(fresh)
        if page % 10 == 0 or page == 1:
            print(f"  page {page}: {len(records)} records", flush=True)
        page += 1
        time.sleep(DELAY_SECONDS)
    sys.exit(f"Walked {MAX_PAGES} pages without reaching the end. Refusing to guess.")


def db_ids():
    if not DB_PATH.exists():
        return None
    with sqlite3.connect(DB_PATH) as conn:
        return {row[0] for row in conn.execute("SELECT id FROM artworks")}


def describe(record):
    artist = (record.get("artist") or {}).get("name") or "Unknown artist"
    return f"{artist} — {record.get('title')}"


def run(script, *args):
    result = subprocess.run([sys.executable, str(SCRIPTS / script), *args], cwd=str(ROOT))
    if result.returncode != 0:
        sys.exit(f"{script} failed with exit code {result.returncode}")


def rebuild():
    """Everything downstream of the raw dump, in dependency order."""
    run("normalize_artsy_saves.py")
    run("fetch_thumbnails.py", "--only-missing", "--edge", "112", "--quality", "58")
    run("build_artifact.py")
    run("export_voxels.py")
    run("build_objects.py")


def load_run_ids(path):
    if not path.exists():
        sys.exit(
            f"{path} not found: the ids of the saving run's works, which are kept off.\n"
            f"Copy it in from the site's data/ (data/follow_saves/run_ids.json there, or "
            f"follow_saves/run_ids.json in the private repository art-database-data)."
        )
    ids = json.loads(path.read_text())
    if not isinstance(ids, list) or not ids or not all(isinstance(i, str) and len(i) == 24 for i in ids):
        sys.exit(f"{path} is not a list of Artsy _ids; refusing to guess which works to set aside.")
    return set(ids)


def verify(remote_ids=None, run_ids=None):
    """Prove the repository is level. Returns a list of failures, empty if sound."""
    problems = []

    raw = json.loads(RAW_PATH.read_text())
    raw_ids = {r.get("id") for r in raw}
    if len(raw_ids) != len(raw):
        problems.append(f"raw dump holds {len(raw)} records but only {len(raw_ids)} distinct ids")
    leaked = {r.get("_id") for r in raw} & (run_ids or set())
    if leaked:
        problems.append(f"{len(leaked)} of the saving run's works are in the raw dump")

    if remote_ids is not None:
        missing = remote_ids - raw_ids
        extra = raw_ids - remote_ids
        if missing:
            problems.append(f"{len(missing)} saved work(s) still absent from the raw dump")
        if extra:
            problems.append(f"{len(extra)} record(s) in the raw dump are no longer saved")

    local_db = db_ids()
    if local_db is None:
        problems.append(f"{DB_PATH} does not exist")
    else:
        if local_db - raw_ids:
            problems.append(f"{len(local_db - raw_ids)} database row(s) have no raw record")
        if raw_ids - local_db:
            problems.append(f"{len(raw_ids - local_db)} raw record(s) never reached the database")

    if OBJECTS_PATH.exists() and local_db is not None:
        objects = json.loads(OBJECTS_PATH.read_text())
        works = objects.get("artworks") or []
        ids = [w[0] for w in works]
        orphans = [i for i in ids if i not in local_db]
        if orphans:
            problems.append(
                f"{len(orphans)} artwork(s) linked from the objects page are no longer "
                f"in the collection (first: {orphans[0]})"
            )
        palette = objects.get("palette") or []
        out_of_range = [p for p in palette if not (0 <= p[1] < len(works))]
        if out_of_range:
            problems.append(f"{len(out_of_range)} palette entr(ies) point past the artwork list")

    return problems


def report(problems, ok_message):
    if problems:
        print("\nNOT LEVEL:")
        for problem in problems:
            print(f"  - {problem}")
        return 1
    print(f"\n{ok_message}")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true",
                        help="report drift and change nothing; non-zero exit if any")
    parser.add_argument("--full", action="store_true",
                        help="replace every record's fields, not just the id set")
    parser.add_argument("--verify", action="store_true",
                        help="check local consistency only; no network")
    parser.add_argument("--allow-shrink", action="store_true",
                        help=f"permit removing more than {SHRINK_LIMIT:.0%} of the collection")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument("--allow-growth", action="store_true",
                        help=f"permit adding more than {GROWTH_LIMIT:.0%} of the collection")
    parser.add_argument("--run-ids", type=Path, default=RUN_IDS_PATH,
                        help="the saving run's ids, set aside after the walk")
    args = parser.parse_args()

    if args.verify:
        run_ids = load_run_ids(args.run_ids) if args.run_ids.exists() else None
        if run_ids is None:
            print(f"{args.run_ids} not found: not checking for the saving run's works.")
        return report(verify(run_ids=run_ids), "Level: raw dump, database and objects page agree.")
    run_ids = load_run_ids(args.run_ids)

    if not RAW_PATH.exists():
        sys.exit(f"{RAW_PATH} not found. Run scripts/fetch_artsy_saves.py for the first import.")

    existing = json.loads(RAW_PATH.read_text())
    known = {r.get("id") for r in existing}

    print(f"Walking the saves collection ({len(known)} held locally)...")
    with requests.Session() as session:
        session.headers.update({"Accept": "application/vnd.artsy-v2+json"})
        walked = walk_collection(session, args.user_id)

    # Set aside by Artsy's _id (the run's file holds _ids; "id" is the slug).
    remote = [r for r in walked if r.get("_id") not in run_ids]
    remote_ids = {r.get("id") for r in remote}
    print(f"Artsy holds {len(walked)} saved work(s); {len(walked) - len(remote)} of them the "
          f"saving run's, set aside; {len(remote_ids)} saved by hand.")

    added = [r for r in remote if r.get("id") not in known]
    removed = [r for r in existing if r.get("id") not in remote_ids]

    if added:
        print(f"\n{len(added)} missing save(s):")
        for record in added:
            print(f"  + {describe(record)}")
    if removed:
        print(f"\n{len(removed)} work(s) no longer saved:")
        for record in removed:
            print(f"  - {describe(record)}")
    if not added and not removed:
        print("\nId sets already match.")

    if args.check:
        problems = verify(remote_ids, run_ids)
        print("\n--check: nothing written.")
        return report(problems, "Level: Artsy, raw dump, database and objects page agree.")

    if removed and not args.allow_shrink:
        share = len(removed) / max(len(known), 1)
        if share > SHRINK_LIMIT:
            sys.exit(
                f"\nRefusing to drop {len(removed)} of {len(known)} records ({share:.0%}) in "
                f"one run — a truncated response looks exactly like a mass un-save from here. "
                f"Re-run and confirm with --allow-shrink if the removals are real."
            )

    if added and not args.allow_growth:
        share = len(added) / max(len(known), 1)
        if share > GROWTH_LIMIT:
            sys.exit(
                f"\nRefusing to add {len(added)} to {len(known)} records ({share:.0%}) in one "
                f"run — the saving run's works are set aside only by their ids, and a stale or "
                f"wrong id file looks exactly like this. Re-run with --allow-growth if he really "
                f"saved them."
            )

    if args.full:
        # Take Artsy's copy of every field, not just the ids. Oldest-first on disk.
        merged = list(reversed(remote))
    elif added or removed:
        # Keep the records we hold byte-for-byte and in the order they were saved;
        # append the missing ones oldest-first, drop the un-saved ones.
        merged = [r for r in existing if r.get("id") in remote_ids] + list(reversed(added))
    else:
        merged = None

    if merged is not None:
        RAW_PATH.write_text(json.dumps(merged, indent=2))
        print(f"\nRaw dump now holds {len(merged)} records. Rebuilding...")
        rebuild()
    else:
        print("\nNothing to repair; verifying anyway.")

    problems = verify(remote_ids, run_ids)
    return report(problems, "Level: Artsy, raw dump, database and objects page agree.")


if __name__ == "__main__":
    sys.exit(main())
