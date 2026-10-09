#!/usr/bin/env python3
"""Save, on Artsy, every artwork by every artist the artist follows — skipping editions
and prints that are not the artist's own work or not part of their history.

The artist's request (3 Oct 2026): "In Artsy can you favorite all of the artworks by all of
the artists I follow that way all their works are available to you through artsy", and,
told it was 875 artists and ~180,000 works: "Skip editions and prints that were not done by
the artist or are not relevant to the artists historical narrative. Besides that go ahead
and save all artworks for all the artists I follow".

Authentication is the environment's: the agent proxy adds Artsy's X-ACCESS-TOKEN to requests
to api.artsy.net. This script sends no token of its own.

Kept: everything unique (paintings, drawings, sculpture, photographs …), and prints and
editions the artist made in their lifetime. Skipped (each counted by its reason):
  - category Reproduction, Posters, Ephemera or Merchandise
  - an open edition
  - a work dated after the artist's death (posthumous editions, casts, restrikes)
  - words that say it is not the artist's hand: "after <artist>", "d'après", "posthumous",
    "restrike", "facsimile", "reproduction", "offset", "poster", "estate stamp",
    "stamped signature", "signed in the plate", "printed signature", "authorized by the estate"
Already saved works are left alone. Progress is kept in data/follow_saves/ (private, never
committed), so a run that is stopped resumes where it was.

The most important first, and one print of a work (the artist, 8 Oct 2026, told Robert Indiana alone
had 1,650 works to save: "Do most important works at least and make sure you don't save different
prints of the same work"):
  - each artist's works are read in Artsy's own order of importance (sort=-iconicity), and only the
    first TOP distinct works are kept;
  - two listings are the same work when their titles agree once a print's colourway, proof, state,
    edition and catalogue number are taken away ("LOVE (red version from the Book of Love)" and
    "LOVE" are one; a generic title — "Untitled" — also needs the same year and size); the most
    important listing is the one saved, and none is saved where another print of it already is.
    `--dupes` counts the extra prints already saved for the artists done before this rule (it saves
    and removes nothing); removing them is the artist's call.

Nothing on the market (the artist, 9 Oct 2026: "Make sure when you save an artwork you are not adding
them to my watch list or inquiring for their price"): a work for sale, on hold or open to an offer is
never saved — a gallery sends offers to everyone who saved its works in the last 30 days, and Artsy
emails each one — and neither is a lot in a sale that is not over, since a saved lot is a lot watched.
The run sends no inquiry and never has. `--market` lists the saved works that are on the market,
the artist's own saves apart from the run's, and changes nothing.

    python3 scripts/save_followed_artworks.py --dry      # count only, save nothing
    python3 scripts/save_followed_artworks.py            # save
"""

import argparse
import json
import re
import signal
import sys
import time
from pathlib import Path

import requests

BASE = "https://api.artsy.net/api/v1"
USER = "5a296eb67622dd4a817fccf9"
DIR = Path(__file__).resolve().parent.parent / "data" / "follow_saves"
STATE = DIR / "state.json"
# The saved set, kept between runs: listing it again (100 a page) took longer than the container lived.
HAVE = DIR / "have.json"
LOG = DIR / "log.jsonl"
DELAY = 0.35

TOP = 200                       # the most important distinct works kept for an artist
DUPES = DIR / "dupes.json"
SKIP_CATEGORIES = {"Reproduction", "Posters", "Ephemera or Merchandise"}
PRINTLIKE = {"Print", "Multiple", "Edition", "Photography", "Ephemera or Merchandise"}
GENERIC = re.compile(r"^(untitled|ohne titel|sans titre|senza titolo|sin titulo|sem titulo|no title|"
                     r"composition|abstract|abstraction|study|portrait|landscape|still life|figure|head|nude|"
                     r"self portrait|flowers?)$")
PROOF_WORDS = re.compile(
    r"\b(trial|artist'?s|printer'?s|bon a tirer|hors commerce|proofs?|states?|editions?|ed|signed|"
    r"numbered|variants?|versions?|colou?r ?ways?|colou?rs?|impressions?|tests?|set of \d+|"
    r"(a|t|p|h)\.? ?(p|c)\.?|bat|\d+ ?/ ?\d+|edition of \d+)\b", re.I)
NOT_HIS = re.compile(
    r"d['’]apr[eè]s|posthum|re-?strike|facsimile|reproduction|\boffset\b|\bposter\b|"
    r"estate[- ]stamp|stamped signature|signed in the plate|plate[- ]signed|printed signature|"
    r"authori[sz]ed by the (estate|foundation)|\bestate edition\b",
    re.I,
)

S = requests.Session()
S.verify = "/root/.ccr/ca-bundle.crt"


class Hung(Exception):
    pass


def hung(signum, frame):
    raise Hung()


def call(method, path, params=None, tries=6, fatal=True):
    wait = 2.0
    for _ in range(tries):
        # A request can hang past its timeout (9 Oct 2026: a DELETE sat in poll for half an hour while
        # the same DELETE by hand answered in a second): after 90 s it is given up, its connection with it.
        signal.signal(signal.SIGALRM, hung)
        signal.alarm(90)
        try:
            r = S.request(method, f"{BASE}/{path}", params=params, timeout=60)
        except Hung:
            r = None
            S.close()
        except requests.RequestException:
            r = None
        finally:
            signal.alarm(0)
        if r is None:
            time.sleep(wait); wait *= 2; continue
        if r.status_code == 429 or r.status_code >= 500:
            time.sleep(wait); wait = min(wait * 2, 120); continue
        return r
    if not fatal:
        return None
    raise SystemExit(f"Artsy kept refusing {method} {path}")


def year_of(date):
    m = re.search(r"(1[0-9]{3}|20[0-9]{2})", date or "")
    return int(m.group(1)) if m else None


def work_key(a, artist=None):
    """One key for every listing of one work: a print's colourway, proof, state, edition and
    catalogue number (its parentheses) taken away; a generic title keeps its year and size too."""
    import unicodedata
    t = unicodedata.normalize("NFKD", a.get("title") or "").encode("ascii", "ignore").decode().lower()
    t = t.replace("\u2019", "'")
    printlike = (a.get("category") in PRINTLIKE or a.get("unique") is False
                 or "edition" in (a.get("attribution_class") or ""))
    if printlike:
        t = re.sub(r"[(\[][^)\]]*[)\]]", " ", t)
        t = PROOF_WORDS.sub(" ", t)
    t = re.sub(r"[^a-z0-9]+", " ", t).strip()
    if artist:
        # a gallery's title that names the artist ("Robert Indiana - HOPE Wall") is the work's own
        name = re.sub(r"[^a-z0-9]+", " ", unicodedata.normalize("NFKD", artist.get("name") or "")
                      .encode("ascii", "ignore").decode().lower()).strip()
        if name and t.startswith(name + " "):
            t = t[len(name) + 1:].strip()
        elif name and t.endswith(" " + name):
            t = t[: -len(name) - 1].strip()
    if printlike and t and not GENERIC.match(t):
        return "p:" + t
    size = "%s×%s" % (round(a.get("height_cm") or 0), round(a.get("width_cm") or 0))
    return "w:%s|%s|%s" % (t, year_of(a.get("date")) or "", size if (not t or GENERIC.match(t)) else "")


def ranked(artist, top=TOP):
    """The artist's works in Artsy's own order of importance, until `top` distinct works that pass
    the rules have been read (or there are no more)."""
    out, keys, page = [], set(), 1
    while len(keys) < top:
        r = call("GET", f"artist/{artist['id']}/artworks",
                 {"size": 100, "page": page, "published": "true", "sort": "-iconicity"})
        if r.status_code != 200:
            break
        d = r.json()
        if not d:
            break
        for a in d:
            out.append(a)
            if not reason_to_skip(a, artist):
                keys.add(work_key(a, artist))
        page += 1
        time.sleep(DELAY)
    return out


def reason_to_skip(a, artist):
    if a.get("category") in SKIP_CATEGORIES:
        return "category:" + a["category"]
    if a.get("attribution_class") == "open edition":
        return "open edition"
    death = year_of(artist.get("deathday") or "")
    y = year_of(a.get("date"))
    if death and y and y > death:
        return "after the artist's death"
    text = " ".join(str(a.get(k) or "") for k in ("title", "medium", "blurb", "manufacturer"))
    if NOT_HIS.search(text):
        return "not the artist's hand"
    surname = (artist.get("name") or "").split()[-1:] or [""]
    if surname[0] and re.search(r"\(?\bafter\s+(\w+\s+){0,2}" + re.escape(surname[0]) + r"\b", text, re.I):
        return "not the artist's hand"
    return on_the_market(a)


SALES = DIR / "sales.json"
_sales = None


def sale_open(sid):
    """Whether a sale is not over (a preview or open auction, or one Artsy will not say is closed)."""
    global _sales
    if _sales is None:
        _sales = json.loads(SALES.read_text()) if SALES.exists() else {}
    if sid not in _sales:
        r = call("GET", f"sale/{sid}", tries=3, fatal=False)
        d = r.json() if r is not None and r.status_code == 200 else {}
        _sales[sid] = d.get("auction_state") or "unknown"
        SALES.write_text(json.dumps(_sales))
    return _sales[sid] != "closed"


def on_the_market(a):
    """The artist, 9 Oct 2026: "I have been getting a lot of emails from artsy saying I inquired for the
    price of artwork. Make sure when you save an artwork you are not adding them to my watch list or
    inquiring for their price." The run never inquired (no inquiry on the account since November 2024),
    but a saved work a gallery has for sale goes on that gallery's list of works saved in the last 30
    days, which it sends offers from ("Thank you so much for your interest in this artwork. We've
    extended a small discount for you": 1,411 bulk offers from 265 galleries, 6-9 Oct), and a saved lot
    in an auction is a lot watched. So neither is saved: nothing for sale, on hold or open to an offer,
    and nothing in a sale that is not over."""
    if (a.get("forsale") or a.get("acquireable") or a.get("offerable") or a.get("partner_offerable")
            or a.get("offerable_from_inquiry") or (a.get("availability") or "") in ("for sale", "on hold")):
        return "for sale"
    if any(sale_open(sid) for sid in a.get("sale_ids") or []):
        return "in an auction"
    return None


def followed():
    out, page = [], 1
    while True:
        d = call("GET", "me/follow/artists", {"size": 100, "page": page}).json()
        if not d:
            return out
        out += [f.get("artist", f) for f in d]
        page += 1
        time.sleep(DELAY)


def saved_ids():
    ids, page = set(), 1
    while True:
        d = call("GET", "collection/saved-artwork/artworks",
                 {"user_id": USER, "private": "true", "size": 100, "page": page}).json()
        if not d:
            return ids
        ids |= {a["_id"] for a in d}
        page += 1
        time.sleep(DELAY)


def artworks(artist):
    """Every published work of the artist; other sorts fill in if the default order is capped."""
    seen, want = {}, artist.get("published_artworks_count") or 0
    for sort in (None, "-date", "date", "-published_at", "published_at"):
        page = 1
        while True:
            p = {"size": 100, "page": page, "published": "true"}
            if sort:
                p["sort"] = sort
            r = call("GET", f"artist/{artist['id']}/artworks", p)
            if r.status_code != 200:
                break
            d = r.json()
            if not d:
                break
            for a in d:
                seen[a["_id"]] = a
            page += 1
            time.sleep(DELAY)
        if len(seen) >= want:
            break
    return list(seen.values())


def count_dupes(state, have):
    """For the artists done before the one-print rule: the prints saved beside another print of the
    same work. Counts and lists them in data/follow_saves/dupes.json; saves and removes nothing."""
    out = json.loads(DUPES.read_text()) if DUPES.exists() else {}
    for aid in state["done"]:
        if aid in out:
            continue
        r = call("GET", f"artist/{aid}")
        if r.status_code != 200:
            continue
        artist = r.json()
        groups = {}
        for a in artworks(artist):
            if a["_id"] in have:
                groups.setdefault(work_key(a, artist), []).append(a["_id"])
        extra = [i for ids in groups.values() for i in ids[1:]]
        out[aid] = {"name": artist.get("name"), "saved": sum(len(v) for v in groups.values()),
                    "works": len(groups), "extra": extra}
        DUPES.write_text(json.dumps(out))
        print(f"{artist.get('name')}: {len(extra)} extra prints of {len(groups)} works", flush=True)
    n = sum(len(v["extra"]) for v in out.values())
    print(f"dupes total: {n} extra prints across {len(out)} artists", flush=True)


PLAN = DIR / "unsave_plan.json"
UNSAVED = DIR / "unsaved.json"
OWN = DIR.parent / "artsy_saves_raw.json"


def same_print(a, artist):
    """The one-print key, stricter for removing than for saving: a print's title (its colourway, proof,
    state and edition taken away) and its year — Kusama's Pumpkins of 1982 and 1990 are two works."""
    k = work_key(a, artist)
    return k + "|" + str(year_of(a.get("date")) or "?") if k.startswith("p:") else k


def by_importance(artist):
    """Every published work of the artist in Artsy's own order of importance; other sorts fill in
    (at the end, as the least important) where that order is capped."""
    seen, order = {}, []
    want = artist.get("published_artworks_count") or 0
    for sort in ("-iconicity", None, "-date", "date"):
        page = 1
        while True:
            p = {"size": 100, "page": page, "published": "true"}
            if sort:
                p["sort"] = sort
            r = call("GET", f"artist/{artist['id']}/artworks", p)
            if r.status_code != 200:
                break
            d = r.json()
            if not d:
                break
            for a in d:
                if a["_id"] not in seen:
                    seen[a["_id"]] = a
                    order.append(a)
            page += 1
            time.sleep(DELAY)
        if len(seen) >= want:
            break
    return order


def plan_unsave(have):
    """The artist, 8 Oct 2026, told 13,864 extra prints were saved for the artists done before the
    one-print rule: "Unsave the roughly 13.900 extra prints". For each of those artists: the saved
    listings grouped by `same_print`; in a group of two or more, the most important listing is kept
    (Artsy's order), and every work the artist saved himself (artsy_saves_raw.json) is kept whatever
    it is; the rest are to be unsaved. Writes the plan; removes nothing."""
    own = {w["_id"] for w in json.loads(OWN.read_text())}
    dupes = json.loads(DUPES.read_text())
    plan = json.loads(PLAN.read_text()) if PLAN.exists() else {}
    for aid, v in dupes.items():
        if aid in plan or not v["extra"]:
            continue
        r = call("GET", f"artist/{aid}")
        if r.status_code != 200:
            continue
        artist = r.json()
        groups = {}
        for a in by_importance(artist):
            if a["_id"] in have:
                groups.setdefault(same_print(a, artist), []).append(a)
        rows, spared = [], 0
        for key, g in groups.items():
            if len(g) < 2:
                continue
            # A generic title ("Untitled", "Composition") is told apart only by its year and size: two
            # different photographs can share both. Saving, that may skip one; removing, it is left alone.
            if key.startswith("w:") and key.rsplit("|", 1)[-1]:
                spared += len(g) - 1
                continue
            mine = [a for a in g if a["_id"] in own]
            keep = mine or g[:1]
            for a in g:
                if a in keep or a["_id"] in own:
                    continue
                rows.append([a["_id"], a["id"], a.get("title") or "", a.get("date") or "", keep[0].get("title") or ""])
        plan[aid] = {"name": artist.get("name"), "groups": sum(1 for g in groups.values() if len(g) > 1),
                     "remove": rows, "counted": len(v["extra"]), "spared": spared}
        PLAN.write_text(json.dumps(plan))
        print(f"{artist.get('name')}: {len(rows)} to unsave, {spared} generic-titled spared (counted {len(v['extra'])})", flush=True)
    n = sum(len(p["remove"]) for p in plan.values())
    print(f"plan total: {n} to unsave across {sum(1 for p in plan.values() if p['remove'])} artists; "
          f"{sum(p.get('spared', 0) for p in plan.values())} generic-titled spared", flush=True)


def unsave(have):
    """Unsaves what the plan lists, keeping a record of each, so a restart goes on from there."""
    plan = json.loads(PLAN.read_text())
    done = set(json.loads(UNSAVED.read_text())) if UNSAVED.exists() else set()
    own = {w["_id"] for w in json.loads(OWN.read_text())}
    n = 0
    skipped = {}
    for aid, p in plan.items():
        # Artsy times out on some works (8 Oct 2026: every try at a Banksy print answered 502 "upstream
        # request failed" after 30 s): a work it keeps refusing is left for a later run, and an artist
        # whose works it refuses four times running is left whole, so the rest go on.
        failed_here = 0
        for _id, slug, title, date, kept in p["remove"]:
            if _id in done or _id in own:
                continue
            if failed_here >= 4:
                skipped[p["name"]] = skipped.get(p["name"], 0) + 1
                continue
            r = call("DELETE", f"collection/saved-artwork/artwork/{slug}", {"user_id": USER}, tries=3, fatal=False)
            if r is None or r.status_code not in (200, 201, 204, 404):
                print(f"failed {r.status_code if r is not None else 'repeatedly'}: {p['name']} · {title}", flush=True)
                failed_here += 1
                continue
            failed_here = 0
            done.add(_id)
            have.discard(_id)
            n += 1
            if n % 25 == 0:
                UNSAVED.write_text(json.dumps(sorted(done)))
                HAVE.write_text(json.dumps(sorted(have)))
            time.sleep(DELAY)
        UNSAVED.write_text(json.dumps(sorted(done)))
        HAVE.write_text(json.dumps(sorted(have)))
        print(f"{p['name']}: unsaved {sum(1 for r in p['remove'] if r[0] in done)} of {len(p['remove'])}", flush=True)
    for name, k in skipped.items():
        print(f"left for a later run: {name}, {k} (Artsy refused its works)", flush=True)
    print(f"unsaved total: {len(done)}", flush=True)


MARKET = DIR / "market.json"


def market():
    """Reads every saved work and lists those on the market (`on_the_market`), the artist's own saves
    (artsy_saves_raw.json) apart from the run's. Changes nothing."""
    own = {w["_id"] for w in json.loads(OWN.read_text())}
    out, n, page = {"for sale": [], "in an auction": []}, 0, 1
    while True:
        r = call("GET", "collection/saved-artwork/artworks",
                 {"user_id": USER, "private": "true", "size": 100, "page": page})
        d = r.json() if r.status_code == 200 else []
        if not d:
            break
        for a in d:
            n += 1
            why = on_the_market(a)
            if why:
                out[why].append([a["_id"], a["id"], a.get("title") or "", a["_id"] in own])
        if page % 50 == 0:
            print(f"{n} read; {len(out['for sale'])} for sale, {len(out['in an auction'])} in an auction", flush=True)
        page += 1
        time.sleep(DELAY)
    MARKET.write_text(json.dumps(out))
    for why, rows in out.items():
        mine = sum(1 for r in rows if r[3])
        print(f"{why}: {len(rows)} ({mine} saved by the artist, {len(rows) - mine} by the run)", flush=True)
    print(f"market total: {n} saved works read", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true")
    ap.add_argument("--dupes", action="store_true", help="count the extra prints already saved; change nothing")
    ap.add_argument("--plan-unsave", action="store_true", help="list the extra prints to unsave; change nothing")
    ap.add_argument("--unsave", action="store_true", help="unsave what the plan lists")
    ap.add_argument("--market", action="store_true",
                    help="list the saved works for sale or in a sale not over; change nothing")
    args = ap.parse_args()
    DIR.mkdir(parents=True, exist_ok=True)
    if args.market:
        market()
        return
    state = json.loads(STATE.read_text()) if STATE.exists() else {"done": [], "counts": {}}
    if args.dupes:
        count_dupes(state, set(json.loads(HAVE.read_text())) if HAVE.exists() else saved_ids())
        return
    if args.plan_unsave or args.unsave:
        have = set(json.loads(HAVE.read_text())) if HAVE.exists() else saved_ids()
        if args.plan_unsave:
            plan_unsave(have)
        else:
            unsave(have)
        return
    done = set(state["done"])
    arts = followed()
    print(f"{len(arts)} artists followed", flush=True)
    have = set(json.loads(HAVE.read_text())) if HAVE.exists() else saved_ids()
    HAVE.write_text(json.dumps(sorted(have)))
    print(f"{len(have)} already saved", flush=True)
    log = LOG.open("a")
    for i, artist in enumerate(arts, 1):
        if artist["id"] in done:
            continue
        works = ranked(artist)
        c = {"works": len(works), "saved": 0, "had": 0}
        # A work one of whose prints is saved already is not saved again in another print.
        kept = {work_key(a, artist) for a in works if a["_id"] in have}
        taken = set()
        for a in works:
            why = reason_to_skip(a, artist)
            if why:
                c[why] = c.get(why, 0) + 1
                continue
            k = work_key(a, artist)
            if a["_id"] in have:
                c["had"] += 1
                taken.add(k)
                continue
            if k in kept:
                c["another print of a work kept"] = c.get("another print of a work kept", 0) + 1
                continue
            if len(taken) >= TOP:
                c["beyond the most important"] = c.get("beyond the most important", 0) + 1
                continue
            kept.add(k)
            taken.add(k)
            if not args.dry:
                r = call("POST", f"collection/saved-artwork/artwork/{a['id']}", {"user_id": USER})
                if r.status_code not in (200, 201):
                    c["failed"] = c.get("failed", 0) + 1
                    log.write(json.dumps({"artist": artist["id"], "work": a["id"], "status": r.status_code}) + "\n")
                    continue
                have.add(a["_id"])
                time.sleep(DELAY)
                # A big artist (Robert Indiana: 1,650 to save) outlasts the container; what is saved is kept
                # every 25, so a restart goes on from there instead of saving the same works again.
                if c["saved"] % 25 == 24:
                    HAVE.write_text(json.dumps(sorted(have)))
            c["saved"] += 1
        state["counts"][artist["id"]] = c
        print(f"[{i}/{len(arts)}] {artist.get('name')}: {c}", flush=True)
        if not args.dry:
            done.add(artist["id"])
            state["done"] = sorted(done)
            STATE.write_text(json.dumps(state))
            HAVE.write_text(json.dumps(sorted(have)))
    tot = {}
    for c in state["counts"].values():
        for k, v in c.items():
            tot[k] = tot.get(k, 0) + v
    print("total", tot, flush=True)


if __name__ == "__main__":
    sys.exit(main())
