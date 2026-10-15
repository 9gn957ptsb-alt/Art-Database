#!/usr/bin/env python3
"""Notable philosophers, where they were born, from Wikidata (CC0), for the Philosophers layer.

The artist, 15 Oct 2026: "Add Character as a category filter and Philosophers category as well.
Introduce notable philosophers as character relative to their native country or city."

Notable: a human whose occupation is philosopher (P106 Q4964182), whose English description says
"philosopher" (Wikidata files many scientists and writers as philosophers too: Einstein is a physicist),
and who has 70 Wikipedia articles or more (sitelinks), with a place of birth that has a point (P19, P625).
Then, for each, their gender (P21, for the figure's dress), the movements they belong to (P135) and
their notable works (P800), as labels.

Cached in data/philosophers/ (raw answers, never committed; the public file is written by
build_philosophers.py). Paced, and retried where the query service asks.

    python3 scripts/fetch_philosophers.py           # read what is not cached
    python3 scripts/fetch_philosophers.py --again   # read it all again
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "philosophers"
ENDPOINT = "https://query.wikidata.org/sparql"
UA = "ArtistWebsite/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/v2/; philosophers layer)"
MIN_SITELINKS = 70

BASE = """
SELECT ?p ?pLabel ?desc ?n ?born ?bornPrec ?died ?bp ?bpLabel ?coord ?country ?countryLabel WHERE {
  ?p wdt:P106 wd:Q4964182; wikibase:sitelinks ?n; wdt:P31 wd:Q5 .
  FILTER(?n >= %d)
  ?p schema:description ?desc . FILTER(LANG(?desc) = "en")
  FILTER(CONTAINS(LCASE(?desc), "philosopher"))
  OPTIONAL { ?p p:P569/psv:P569 ?bv . ?bv wikibase:timeValue ?born ; wikibase:timePrecision ?bornPrec . }
  OPTIONAL { ?p wdt:P570 ?died . }
  ?p wdt:P19 ?bp . ?bp wdt:P625 ?coord .
  OPTIONAL { ?bp wdt:P17 ?country . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}
"""

DETAILS = """
SELECT ?p ?g ?gLabel ?m ?mLabel ?w ?wLabel WHERE {
  VALUES ?p { %s }
  { ?p wdt:P21 ?g . } UNION { ?p wdt:P135 ?m . } UNION { ?p wdt:P800 ?w . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". }
}
"""


def sparql(query, tries=5):
    data = urllib.parse.urlencode({"query": query, "format": "json"}).encode()
    for k in range(tries):
        req = urllib.request.Request(ENDPOINT, data=data, headers={
            "User-Agent": UA, "Accept": "application/sparql-results+json",
            "Content-Type": "application/x-www-form-urlencoded"})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            wait = int(e.headers.get("Retry-After") or 0) or 5 * (k + 1)
            print(f"  query service {e.code}; waiting {wait} s")
            time.sleep(wait)
        except Exception as e:  # a timeout, a reset
            print(f"  query service: {e}; again")
            time.sleep(5 * (k + 1))
    raise SystemExit("The query service did not answer.")


def labels(qids):
    """English labels the query service's label service left as bare ids: read as rdfs:label through the
    query service itself (the action API answers 429 to the session's address), English, else the label
    Wikidata keeps for every language ("mul", where a name is the same in all of them)."""
    out = {}
    for k in range(0, len(qids), 80):
        part = " ".join("wd:" + q for q in qids[k:k + 80])
        q = 'SELECT ?x ?l WHERE { VALUES ?x { %s } ?x rdfs:label ?l . FILTER(LANG(?l) = "en" || LANG(?l) = "mul") }' % part
        for r in sparql(q)["results"]["bindings"]:
            x = r["x"]["value"].rsplit("/", 1)[1]
            if r["l"].get("xml:lang") == "en" or x not in out:
                out[x] = r["l"]["value"]
        time.sleep(1)
    return out


def main():
    again = "--again" in sys.argv
    CACHE.mkdir(parents=True, exist_ok=True)
    base = CACHE / "base.json"
    if again or not base.exists():
        print("Reading the philosophers ...")
        base.write_text(json.dumps(sparql(BASE % MIN_SITELINKS)), encoding="utf-8")
    rows = json.loads(base.read_text(encoding="utf-8"))["results"]["bindings"]
    qids = sorted({r["p"]["value"].rsplit("/", 1)[1] for r in rows})
    print(f"  {len(qids)} philosophers")
    det = CACHE / "details.json"
    if again or not det.exists():
        print("Reading their genders, movements and works ...")
        out = []
        for k in range(0, len(qids), 60):
            part = " ".join("wd:" + q for q in qids[k:k + 60])
            out.extend(sparql(DETAILS % part)["results"]["bindings"])
            time.sleep(2)
        det.write_text(json.dumps(out), encoding="utf-8")
    # Labels the label service left as ids: the philosophers', their places', their works'.
    lab = CACHE / "labels.json"
    known = json.loads(lab.read_text(encoding="utf-8")) if lab.exists() and not again else {}
    bare = set()
    for r in rows:
        for key, idk in (("pLabel", "p"), ("bpLabel", "bp")):
            v = (r.get(key) or {}).get("value", "")
            q = r[idk]["value"].rsplit("/", 1)[1]
            if v == q and q not in known:
                bare.add(q)
    for r in json.loads(det.read_text(encoding="utf-8")):
        for key, idk in (("mLabel", "m"), ("wLabel", "w"), ("gLabel", "g")):
            if idk in r:
                v = (r.get(key) or {}).get("value", "")
                q = r[idk]["value"].rsplit("/", 1)[1]
                if v == q and q not in known:
                    bare.add(q)
    if bare:
        print(f"Reading {len(bare)} labels the label service left bare ...")
        known.update(labels(sorted(bare)))
        lab.write_text(json.dumps(known, ensure_ascii=False, indent=0), encoding="utf-8")
    print("Done: data/philosophers/ (base.json, details.json, labels.json).")


if __name__ == "__main__":
    main()
