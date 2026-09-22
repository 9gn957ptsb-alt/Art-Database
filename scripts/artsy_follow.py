#!/usr/bin/env python3
"""Follow artists on Artsy, from their page slugs.

The one thing in here that writes anything: POST follow/artist. It talks to
api.artsy.net and to nothing else, which is the whole point of it being a
script rather than a curl command — a session can be given permission to run
this without being given permission to POST to the internet at large. See
.claude/settings.json.

Authentication is handled outside this process, exactly as in
fetch_artsy_saves.py: the cloud environment holds the Artsy user token and
Anthropic's agent proxy attaches it to requests leaving the session. This
script sends no token of its own and must never be given one.

Endpoints, from Artsy's own open-source API (gravity):
  GET  /api/v1/me/follow/artists   what is already followed
  GET  /api/v1/artist/<slug>       confirm a slug is the artist meant
  POST /api/v1/me/follow/artist    follow one, body {"artist_id": "<slug>"}

Usage:
    python3 scripts/artsy_follow.py --check amy-sherald jenny-holzer
    python3 scripts/artsy_follow.py amy-sherald jenny-holzer
    python3 scripts/artsy_follow.py --from-file slugs.txt
    python3 scripts/artsy_follow.py --unfollow amy-sherald

A slug is the last part of an artsy.net/artist/... URL. Following is
reversible — that is what --unfollow is for — but it is still a change to a
real account, so --check prints exactly what would happen and changes nothing.
"""

import argparse
import sys
import time
from pathlib import Path

import requests

BASE = "https://api.artsy.net/api/v1"
DELAY_SECONDS = 0.25


def following(session):
    """Every artist the account already follows, by slug."""
    seen = {}
    offset = 0
    while True:
        reply = session.get(f"{BASE}/me/follow/artists",
                            params={"size": 100, "offset": offset}, timeout=30)
        reply.raise_for_status()
        page = reply.json()
        if not isinstance(page, list) or not page:
            break
        for row in page:
            artist = row.get("artist") or row
            if artist.get("id"):
                seen[artist["id"]] = artist.get("name")
        if len(page) < 100:
            break
        offset += 100
    return seen


def look_up(session, slug):
    """The artist behind a slug, or None if there is no such page."""
    reply = session.get(f"{BASE}/artist/{slug}", timeout=30)
    if reply.status_code == 404:
        return None
    reply.raise_for_status()
    return reply.json()


def describe(artist):
    bits = [artist.get("nationality"), artist.get("birthday")]
    return "%s (%s)" % (artist.get("name"),
                        ", ".join(b for b in bits if b) or "no dates")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("slugs", nargs="*", help="artsy.net/artist/<slug>")
    parser.add_argument("--from-file", help="a file of slugs, one per line")
    parser.add_argument("--check", action="store_true",
                        help="say what would happen and change nothing")
    parser.add_argument("--unfollow", action="store_true",
                        help="unfollow instead of follow")
    args = parser.parse_args()

    slugs = list(args.slugs)
    if args.from_file:
        text = Path(args.from_file).read_text()
        slugs += [line.strip() for line in text.splitlines()
                  if line.strip() and not line.startswith("#")]
    if not slugs:
        parser.error("give at least one slug, or --from-file")

    session = requests.Session()
    already = following(session)
    print("the account follows %d artists" % len(already))

    did, skipped, missing = 0, 0, []
    for slug in slugs:
        artist = look_up(session, slug)
        if not artist:
            missing.append(slug)
            print("  %-26s NO SUCH PAGE" % slug)
            continue

        has = slug in already
        want = not args.unfollow
        if has == want:
            skipped += 1
            print("  %-26s %s — already %s" %
                  (slug, describe(artist), "followed" if has else "not followed"))
            continue

        if args.check:
            print("  %-26s %s — would %s" %
                  (slug, describe(artist), "unfollow" if args.unfollow else "follow"))
            continue

        if args.unfollow:
            reply = session.delete(f"{BASE}/me/follow/artist/{slug}", timeout=30)
        else:
            reply = session.post(f"{BASE}/me/follow/artist",
                                 json={"artist_id": slug}, timeout=30)
        ok = reply.status_code in (200, 201, 204)
        did += ok
        print("  %-26s %s — %s" % (slug, describe(artist),
              ("unfollowed" if args.unfollow else "followed") if ok
              else "FAILED %d %s" % (reply.status_code, reply.text[:120])))
        time.sleep(DELAY_SECONDS)

    print()
    verb = "would have " if args.check else ""
    print("%s%s %d, left alone %d%s" %
          (verb, "unfollowed" if args.unfollow else "followed", did, skipped,
           ", no page for %d" % len(missing) if missing else ""))
    return 1 if missing else 0


if __name__ == "__main__":
    sys.exit(main())
