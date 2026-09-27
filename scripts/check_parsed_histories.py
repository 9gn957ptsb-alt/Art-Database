#!/usr/bin/env python3
"""Check the parsed artwork histories against the texts they were read from.

The parsing workflow reads what Artsy's partners wrote (provenance, exhibition history, literature)
into events in data/histories/parsed/batchNN.json. Nothing may stand there that the text does not
say, so every event is checked here: its "text" must be words of the field it names (verbatim, give
or take whitespace and quotes), its kind and dates well formed, and every work in a batch present.

    python3 scripts/check_parsed_histories.py [--show N]

Prints, batch by batch, the works and events, and every event that fails (with why); `good()` is
what build_artwork_histories.py uses to keep only the events that pass.
"""

import argparse
import glob
import json
import re
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from fetch_artwork_histories import filename  # noqa: E402

WORKS = ROOT / "data" / "histories" / "artsy" / "works"
PARSED = ROOT / "data" / "histories" / "parsed"
KINDS = {"made", "owned", "exhibited", "sold", "written", "held", "other"}
FIELDS = {"provenance", "exhibition_history", "literature", "additional_information", "blurb"}
DATE = re.compile(r"^(\d{4})(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$")


def squash(t):
    """Compare text loosely: case, whitespace, quote and dash styles, accents' composition."""
    t = unicodedata.normalize("NFKC", t or "").lower()
    t = re.sub(r"[‘’‚‛`´]", "'", t)
    t = re.sub(r"[“”„‟«»]", '"', t)
    t = re.sub(r"[‐-―−]", "-", t)
    return re.sub(r"\s+", " ", t).strip()


def problems(ev, work):
    out = []
    if ev.get("kind") not in KINDS:
        out.append(f"kind {ev.get('kind')!r}")
    field = ev.get("field")
    if field not in FIELDS:
        out.append(f"field {field!r}")
    else:
        text, src = squash(ev.get("text")), squash(work.get(field))
        if not text:
            out.append("no text")
        elif text not in src:
            # A quote the reader trimmed of an ellipsis or joined across lines: every piece must be there.
            parts = [p for p in re.split(r"\s*(?:\.\.\.|…)\s*", text) if p]
            if not parts or any(p not in src for p in parts):
                out.append("text not in the source")
    for k in ("start", "end"):
        v = (ev.get(k) or "").strip()
        if v and not DATE.match(v):
            out.append(f"{k} {v!r}")
    s, e = (ev.get("start") or "")[:4], (ev.get("end") or "")[:4]
    if s and e and e < s:
        out.append("ends before it starts")
    return out


def work_record(artsy_id):
    path = WORKS / filename(artsy_id)
    return json.loads(path.read_text()) if path.exists() else None


def good(artsy_id, events):
    """The events of one work that pass."""
    w = work_record(artsy_id) or {}
    return [ev for ev in events if not problems(ev, w)]


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--show", type=int, default=3, help="failing events to print per batch")
    args = ap.parse_args()
    total = bad = works = 0
    for path in sorted(glob.glob(str(PARSED / "batch*.json"))):
        try:
            data = json.loads(Path(path).read_text())
        except json.JSONDecodeError as exc:
            print(f"{Path(path).name}: not JSON ({exc})")
            continue
        shown, n_bad, n = 0, 0, 0
        for entry in data.get("works") or []:
            w = work_record(entry.get("id") or "")
            if w is None:
                print(f"  ! unknown work {entry.get('id')!r}")
                continue
            works += 1
            for ev in entry.get("events") or []:
                n += 1
                why = problems(ev, w)
                if why:
                    n_bad += 1
                    if shown < args.show:
                        print(f"  - {entry['id']}: {', '.join(why)} :: {str(ev.get('text'))[:120]!r}")
                        shown += 1
        total += n
        bad += n_bad
        print(f"{Path(path).name}: {len(data.get('works') or [])} works, {n} events, {n_bad} failing")
    print(f"\n{works} works, {total} events, {bad} failing ({bad / max(total, 1):.1%})")


if __name__ == "__main__":
    main()
