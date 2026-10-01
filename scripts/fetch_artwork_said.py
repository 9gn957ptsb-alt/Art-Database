#!/usr/bin/env python3
"""Fetch what museums and Wikipedia say about the saved works, for the art view's "Said of it"
(artist, 1 Oct 2026; see artwork_said.py). Writes data/said/<artsy-slug>.json, a cache:
each {"id", "said": [{"k", "q", "by", "in", "u"}], "fetched"}.

  - The Art Institute of Chicago (api.artic.edu): the work's description — its label — for every
    saved work matched to an AIC record by fetch_history_museum_apis.py.
  - The Cleveland Museum of Art (openaccess-api.clevelandart.org): its wall text or description.
  - SMK (api.smk.dk): an English label, when it has one (never translated here).
  - Wikipedia (en.wikipedia.org's introductions, twenty to a request; CC BY-SA 4.0): the opening of the article on the
    work itself, for every work matched to a Wikidata item by fetch_history_wikidata.py whose item
    has an English article. The sentence that only restates "X is a painting by Y" is left out.

Only the source's own words are kept, cut at sentence ends. Free and keyless; one request at a
time, politely. Re-run with --refresh to fetch again.

    python3 scripts/fetch_artwork_said.py [--refresh] [--only slug]
"""

import argparse
import datetime
import html
import json
import re
import sys
import time
import urllib.parse
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "histories"
OUT = ROOT / "data" / "said"
UA = {"User-Agent": "ArtistWebsite-histories/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/v2/; research)"}
S = requests.Session()
S.headers.update(UA)

sys.path.insert(0, str(ROOT / "scripts"))
from artwork_said import sentences, flat  # noqa: E402
from fetch_artwork_histories import filename  # noqa: E402


def get(url, **kw):
    for n in range(4):
        try:
            r = S.get(url, timeout=30, **kw)
        except requests.RequestException:
            time.sleep(2 + 3 * n)
            continue
        if r.status_code == 429:
            time.sleep(5 + 10 * n)
            continue
        if r.status_code == 404:
            return None
        r.raise_for_status()
        time.sleep(0.25)
        return r.json()
    return None


def text_of(h):
    t = html.unescape(re.sub(r"<[^>]+>", " ", h or ""))
    return flat(t)


def excerpt(text, most=3, chars=620):
    """The opening sentences, whole, up to a few hundred characters."""
    out = []
    for s in sentences(text):
        if out and len(" ".join(out + [s])) > chars:
            break
        out.append(s)
        if len(out) >= most:
            break
    return " ".join(out)


def first_paragraph(h):
    paras = [text_of(p) for p in re.split(r"</p>\s*<p>|\n\s*\n", h or "") if text_of(p)]
    return paras[0] if paras else ""


def aic(record):
    d = get(f"https://api.artic.edu/api/v1/artworks/{record}", params={"fields": "id,title,description,short_description"})
    d = (d or {}).get("data") or {}
    q = excerpt(first_paragraph(d.get("description"))) or excerpt(text_of(d.get("short_description")))
    if not q:
        return None
    return {"k": "museum", "q": q, "by": "The Art Institute of Chicago", "in": "the museum's label",
            "u": f"https://www.artic.edu/artworks/{record}"}


def cleveland(record):
    d = get(f"https://openaccess-api.clevelandart.org/api/artworks/{urllib.parse.quote(record)}")
    d = (d or {}).get("data") or {}
    q = excerpt(text_of(d.get("wall_description"))) or excerpt(text_of(d.get("description")))
    if not q:
        return None
    return {"k": "museum", "q": q, "by": "The Cleveland Museum of Art",
            "in": "the museum's wall text" if d.get("wall_description") else "the museum's description",
            "u": d.get("url") or ""}


def smk(record):
    d = get("https://api.smk.dk/api/v1/art/", params={"object_number": record})
    items = (d or {}).get("items") or []
    for lab in (items[0].get("labels") or []) if items else []:
        if (lab.get("language") or "").lower().startswith("en") and lab.get("text"):
            return {"k": "museum", "q": excerpt(flat(lab["text"])), "by": "SMK – National Gallery of Denmark",
                    "in": "the museum's label", "u": items[0].get("frontend_url") or ""}
    return None


RESTATES = re.compile(r"\b(is|was)\s+(an?|the)\s+[^.]{0,80}\b(painting|portrait|drawing|sculpture|print|work|"
                      r"photograph|lithograph|etching|canvas|panel|fresco|watercolou?r|still life|landscape|"
                      r"self-portrait|triptych|diptych|series|object)\b[^.]{0,120}\bby\b", re.I)


def wiki_said(title, extract):
    ss = sentences(extract or "")
    if ss and RESTATES.search(ss[0]):
        ss = ss[1:]
    q = excerpt(" ".join(ss), most=2, chars=480)
    if len(q.split()) < 10:
        return None
    return {"k": "wiki", "q": q, "by": "Wikipedia", "in": f"“{title}”, CC BY-SA 4.0",
            "u": "https://en.wikipedia.org/wiki/" + urllib.parse.quote(title.replace(" ", "_"))}


def wikipedia_intros(titles):
    """The plain-text introductions of up to twenty articles a request (the action API's extracts)."""
    out = {}
    titles = sorted(set(titles))
    for i in range(0, len(titles), 20):
        chunk = titles[i:i + 20]
        d = get("https://en.wikipedia.org/w/api.php", params={
            "action": "query", "prop": "extracts", "exintro": 1, "explaintext": 1, "exlimit": 20,
            "titles": "|".join(chunk), "format": "json", "redirects": 1})
        q = (d or {}).get("query") or {}
        back = {}
        for m in (q.get("normalized") or []) + (q.get("redirects") or []):
            back[m["to"]] = back.get(m["from"], m["from"])
        for p in (q.get("pages") or {}).values():
            if p.get("extract"):
                asked = back.get(p["title"], p["title"])
                out[asked] = (p["title"], p["extract"])
        print(f"  wikipedia {min(i + 20, len(titles))}/{len(titles)}", flush=True)
    return out


def enwiki_titles(qids):
    out = {}
    qids = list(qids)
    for i in range(0, len(qids), 50):
        d = get("https://www.wikidata.org/w/api.php", params={
            "action": "wbgetentities", "ids": "|".join(qids[i:i + 50]), "props": "sitelinks",
            "sitefilter": "enwiki", "format": "json"})
        for q, e in ((d or {}).get("entities") or {}).items():
            t = ((e.get("sitelinks") or {}).get("enwiki") or {}).get("title")
            if t:
                out[q] = t
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--refresh", action="store_true")
    ap.add_argument("--only")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    jobs = {}                                          # slug -> [(fetcher, arg)]
    for f in sorted((DATA / "museums").glob("*.json")):
        rec = json.loads(f.read_text())
        name, record = rec["source"]["name"], (rec.get("match") or {}).get("record")
        if not record:
            continue
        fn = aic if "Art Institute of Chicago" in name else cleveland if "Cleveland" in name else smk if "SMK" in name else None
        if fn:
            jobs.setdefault(rec["id"], []).append((fn, record))
    qids = {}
    for f in sorted((DATA / "wikidata").glob("*.json")):
        rec = json.loads(f.read_text())
        q = (rec.get("match") or {}).get("record") or ""
        if re.fullmatch(r"Q\d+", q):
            qids[rec["id"]] = q
    if args.only:
        jobs = {k: v for k, v in jobs.items() if k == args.only}
        qids = {k: v for k, v in qids.items() if k == args.only}
    titles = enwiki_titles(set(qids.values()))
    todo = {slug: titles[q] for slug, q in qids.items() if q in titles and (args.refresh or not (OUT / filename(slug)).exists())}
    intros = wikipedia_intros(todo.values()) if todo else {}
    for slug, q in qids.items():
        if q in titles:
            t = titles[q]
            jobs.setdefault(slug, []).append((lambda t: wiki_said(*intros[t]) if t in intros else None, t))
    print(f"{len(jobs)} works to ask about ({len(titles)} with an English Wikipedia article)", flush=True)
    got = 0
    for n, (slug, todo) in enumerate(sorted(jobs.items())):
        path = OUT / filename(slug)
        if path.exists() and not args.refresh:
            got += bool(json.loads(path.read_text()).get("said"))
            continue
        said = [s for s in (fn(arg) for fn, arg in todo) if s]
        path.write_text(json.dumps({"id": slug, "said": said, "fetched": datetime.date.today().isoformat()},
                                   ensure_ascii=False, indent=1))
        got += bool(said)
        if n % 25 == 0:
            print(f"  {n}/{len(jobs)}", flush=True)
    print(f"{got} works with something said by a museum or Wikipedia")


if __name__ == "__main__":
    main()
