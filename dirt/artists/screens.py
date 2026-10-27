#!/usr/bin/env python3
"""The screenshots Claude sent Aries, recovered from the sessions' transcripts, to be quilted into DRIFT as works are.

Aries, 27 Oct 2026: "I want you to collage all of the screenshots that you sent me throughout my code sessions start
implementing those screenshots into DRIFT just like you implement Artist works from Artsy."

A file sent with SendUserFile is not kept: its record in the transcript holds only its name, size and caption, and the
container that held it is gone. But Claude looks at an image before sending it (a Read), and the Read's result keeps
the image, scaled to at most 2000 pixels. So a sent image is recovered by finding the Read of the same file (the same
path, or else the same size in bytes) before the send, in the same session. An image sent without being looked at is
lost.

    python3 dirt/artists/screens.py page SESSION_ID PAGE WORK   # one saved page of list_events (newest first or not)
    python3 dirt/artists/screens.py join WORK SCREENS            # the sends matched; new images into SCREENS

`page` reads a page of mcp__claude-code-remote__list_events as the harness saves it (a file holding {"ccr": {...}})
and keeps what matters in WORK (sends.jsonl, reads.jsonl, and each Read image in WORK/img/). `join` matches every
send of an image to its Read and adds what it had not yet to SCREENS (dirt/private/screens/): the image, as a JPEG at
most 1280 pixels on its long side, and its row in screens.json (session, title, when, the path it was sent as, its
caption). Pages that come back inline are small and hold no image: only their first_id is needed, to page on.
"""
import base64
import hashlib
import json
import re
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

IMG = re.compile(r"\.(png|jpe?g|gif|webp)$", re.I)


def images(x, acc):
    if isinstance(x, dict):
        if x.get("type") == "image" and isinstance(x.get("source"), dict):
            acc.append(x["source"])
        for v in x.values():
            images(v, acc)
    elif isinstance(x, list):
        for v in x:
            images(v, acc)
    return acc


def page(sid, path, work):
    s = Path(path).read_text()
    d = json.loads(s[s.index('{"ccr"'):s.rindex("}}") + 2])["ccr"]
    work.mkdir(parents=True, exist_ok=True)
    (work / "img").mkdir(exist_ok=True)
    sends, reads = [], []
    for e in d.get("data", []):
        body = next(v for k, v in e.items() if k != "created_at")
        ic = body.get("internal_anthropic_catchall", {})
        content = (ic.get("message") or {}).get("content")
        if not isinstance(content, list):
            continue
        at = e["created_at"]
        for c in content:
            if c.get("type") == "tool_use" and c.get("name") == "SendUserFile":
                inp = c.get("input") or {}
                sends.append({"sid": sid, "at": at, "id": c.get("id"), "files": inp.get("files") or [], "caption": inp.get("caption", "")})
            elif c.get("type") == "tool_use" and c.get("name") == "Read" and IMG.search((c.get("input") or {}).get("file_path") or ""):
                reads.append({"sid": sid, "at": at, "id": c.get("id"), "path": c["input"]["file_path"]})
            elif c.get("type") == "tool_result":
                tur = ic.get("tool_use_result")
                row = {"sid": sid, "at": at, "result": c.get("tool_use_id")}
                if isinstance(tur, dict) and "attachments" in tur:
                    row["sent"] = [{k: a.get(k) for k in ("path", "size", "isImage")} for a in tur["attachments"] or []]
                if isinstance(tur, dict) and isinstance(tur.get("file"), dict):
                    row["size"] = tur["file"].get("originalSize")
                for src in images(c, []):
                    if src.get("type") == "base64" and src.get("data"):
                        raw = base64.b64decode(src["data"])
                        f = work / "img" / f"{hashlib.sha1(raw).hexdigest()[:16]}.bin"
                        if not f.exists():
                            f.write_bytes(raw)
                        row.setdefault("img", []).append(f.name)
                if len(row) > 3:
                    reads.append(row)
    for name, rows in (("sends", sends), ("reads", reads)):
        with open(work / f"{name}.jsonl", "a") as f:
            for r in rows:
                f.write(json.dumps(r) + "\n")
    print(sid[8:16], len(d.get("data", [])), "events", len(sends), "sends", "first_id", d.get("first_id"), "has_more", d.get("has_more"))


def join(work, out):
    load = lambda n: [json.loads(l) for l in open(work / f"{n}.jsonl")] if (work / f"{n}.jsonl").exists() else []
    sends, rows = load("sends"), load("reads")
    result = {r["result"]: r for r in rows if "result" in r}
    looked = [dict(r, **result.get(r["id"], {})) for r in rows if "path" in r]   # each Read with what it showed
    out.mkdir(parents=True, exist_ok=True)
    man = out / "screens.json"
    have = json.loads(man.read_text()) if man.exists() else []
    known = {(h["sid"], h["send"], h["sent_as"]) for h in have}
    titles = json.loads((work / "titles.json").read_text()) if (work / "titles.json").exists() else {}
    added = lost = 0
    for s in sends:
        att = {a["path"]: a for a in (result.get(s["id"], {}).get("sent") or [])}
        for p in s["files"]:
            a = att.get(p, {})
            if not (a.get("isImage") or IMG.search(p)) or (s["sid"], s["id"], p) in known:
                continue
            cands = [r for r in looked if r["sid"] == s["sid"] and r.get("img") and r["at"] <= s["at"] and r["path"] == p] \
                or [r for r in looked if r["sid"] == s["sid"] and r.get("img") and r["at"] <= s["at"] and a.get("size") and r.get("size") == a["size"]]
            if not cands:
                lost += 1
                print("lost (never looked at):", s["sid"][8:16], s["at"][:16], Path(p).name)
                continue
            best = max(cands, key=lambda r: r["at"])
            im = Image.open(work / "img" / best["img"][0]).convert("RGB")
            im.thumbnail((1280, 1280), Image.LANCZOS)
            name = f"{s['at'][:10]}_{s['sid'][8:16]}_{re.sub(r'[^A-Za-z0-9_-]+', '-', Path(p).stem)[:40]}.jpg"
            buf = BytesIO()
            im.save(buf, "JPEG", quality=86)
            (out / name).write_bytes(buf.getvalue())
            have.append({"file": name, "sid": s["sid"], "title": titles.get(s["sid"], ""), "at": s["at"], "send": s["id"],
                         "sent_as": p, "caption": s["caption"], "matched": "path" if best["path"] == p else "size"})
            known.add((s["sid"], s["id"], p))
            added += 1
    man.write_text(json.dumps(sorted(have, key=lambda h: h["at"]), indent=1, ensure_ascii=False))
    print(added, "added,", lost, "lost,", len(have), "in", man)


if __name__ == "__main__":
    cmd, *a = sys.argv[1:]
    if cmd == "page":
        page(a[0], a[1], Path(a[2]))
    elif cmd == "join":
        join(Path(a[0]), Path(a[1]))
    else:
        raise SystemExit(__doc__)
