"""Fetch the Artsy genes of every saved work into data/genes/<artwork id>.json (private cache, never committed).

Genes are Artsy's own tags on a work: styles and movements ("Impressionism", "Pittura Metafisica"),
subjects, media, periods. build_styles.py keeps only the ones that are art movements or styles.
Usage: python3 scripts/fetch_work_genes.py  (resumes; the proxy supplies Artsy's key)
"""
import json, os, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "genes")
API = "https://api.artsy.net/api/genes?size=100&artwork_id="


def ids():
    return [os.path.splitext(f)[0] for f in sorted(os.listdir(os.path.join(ROOT, "docs", "v2", "histories")))
            if f.endswith(".json")]


def one(i):
    path = os.path.join(OUT, i + ".json")
    if os.path.exists(path):
        return 0
    for attempt in range(5):
        try:
            with urllib.request.urlopen(urllib.request.Request(API + i, headers={"Accept": "application/vnd.artsy-v2+json"}), timeout=40) as r:
                d = json.load(r)
            g = [{"id": x["id"], "name": x["name"], "display_name": x.get("display_name")}
                 for x in d.get("_embedded", {}).get("genes", [])]
            with open(path, "w") as f:
                json.dump(g, f)
            return 1
        except urllib.error.HTTPError as e:
            if e.code == 404:
                with open(path, "w") as f:
                    json.dump([], f)
                return 1
            time.sleep(2 ** attempt * 2)
        except Exception:
            time.sleep(2 ** attempt * 2)
    return 0


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    todo = ids()
    done = 0
    with ThreadPoolExecutor(4) as ex:
        for n, r in enumerate(ex.map(one, todo)):
            done += r
            if n % 250 == 0:
                print(n, "of", len(todo), "fetched", done, flush=True)
    print("done", len(os.listdir(OUT)), "cached")
