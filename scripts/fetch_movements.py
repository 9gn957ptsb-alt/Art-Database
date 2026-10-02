#!/usr/bin/env python3
"""The movements' raw read from Wikidata (CC0).

The artist, 2 Oct 2026, on "lives that cross are the start of a social graph of art history. The
cities where many lives overlap (Paris in 1906, New York in 1950) are the movements themselves, so a
movement becomes a place and a time on the dial": "Yes great idea about using overlaps of artist
residencies during a time period to define art and social movements."

For every saved artist with a matched Wikidata item (data/studios/artists.json, written by
fetch_studios.py), this reads through the query service:

  1. P135 movement — each artist's movements, and of each movement its English label and its dates
     (P580 start, P582 end, P571 inception, P576 dissolved), so a cluster is named after a movement
     only where most of its members share one whose years overlap the cluster's;
  2. the artist's dated affiliations that put them in a town in a year: P69 educated at, P108
     employer, P463 member of, P1416 affiliation — each statement with its P580/P582/P585
     qualifiers — and of each institution its point (P625, else its P131 town's, else its P159
     headquarters') and English label. A school, an academy, a workshop or a college with dates is
     where the artist was then: the Bauhaus, Black Mountain College, the Académie Julian;
  3. P19 place of birth, with its point and label: a movement's artists' birthplaces, lit on the
     globe when it is opened (where they came from).

Everything is cached in data/movements/ (gitignored, like all of data/). build_movements.py distils
it, with the studios and the lives, into docs/v2/movements.json.

    python3 scripts/fetch_movements.py
"""
import hashlib, json, os, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'movements')
CACHE = os.path.join(OUT, 'sparql')
UA = 'ArtDatabaseMovements/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/)'
SPARQL = 'https://query.wikidata.org/sparql'


def get(url, data=None, accept='application/json', tries=8):
    wait = 5
    for i in range(tries):
        req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': accept})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                ra = e.headers.get('Retry-After')
                time.sleep(int(ra) if ra and ra.isdigit() else wait)
                wait = min(wait * 2, 120)
                continue
            raise
        except Exception:
            time.sleep(wait)
            wait = min(wait * 2, 120)
    raise RuntimeError('gave up: ' + url[:200])


def sparql(q):
    key = hashlib.sha1(q.encode()).hexdigest()[:16]
    path = os.path.join(CACHE, key + '.json')
    if os.path.exists(path):
        return json.load(open(path))
    body = urllib.parse.urlencode({'query': q}).encode()
    txt = get(SPARQL, data=body, accept='application/sparql-results+json')
    rows = [{k: v['value'].replace('http://www.wikidata.org/entity/', '') for k, v in b.items()}
            for b in json.loads(txt)['results']['bindings']]
    json.dump(rows, open(path, 'w'))
    time.sleep(1)
    return rows


def chunks(xs, n):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


MOVES = '''SELECT ?a ?m WHERE {{ VALUES ?a {{ {vals} }} ?a wdt:P135 ?m . }}'''

MOVE_DETAILS = '''
SELECT ?m ?label ?start ?end ?inception ?dissolved WHERE {{
  VALUES ?m {{ {vals} }}
  OPTIONAL {{ ?m rdfs:label ?label FILTER(LANG(?label) = "en") }}
  OPTIONAL {{ ?m wdt:P580 ?start }} OPTIONAL {{ ?m wdt:P582 ?end }}
  OPTIONAL {{ ?m wdt:P571 ?inception }} OPTIONAL {{ ?m wdt:P576 ?dissolved }}
}}'''

# One property a query: a UNION of them times out on a hundred artists.
AFFIL = '''SELECT ?a ?org ?start ?end ?pit ("{p}" AS ?prop) WHERE {{ VALUES ?a {{ {vals} }}
  ?a p:{p} ?st . ?st ps:{p} ?org .
  OPTIONAL {{ ?st pq:P580 ?start }} OPTIONAL {{ ?st pq:P582 ?end }} OPTIONAL {{ ?st pq:P585 ?pit }}
  FILTER(BOUND(?start) || BOUND(?end) || BOUND(?pit)) }}'''

BORN = '''SELECT ?a ?pl ?label ?coord WHERE {{ VALUES ?a {{ {vals} }}
  ?a wdt:P19 ?pl . ?pl wdt:P625 ?coord .
  OPTIONAL {{ ?pl rdfs:label ?label FILTER(LANG(?label) = "en") }} }}'''

ORGS = '''
SELECT ?o ?label ?coord ?inCoord ?inLabel ?hqCoord WHERE {{
  VALUES ?o {{ {vals} }}
  OPTIONAL {{ ?o rdfs:label ?label FILTER(LANG(?label) = "en") }}
  OPTIONAL {{ ?o wdt:P625 ?coord }}
  OPTIONAL {{ ?o wdt:P131 ?in . ?in wdt:P625 ?inCoord .
             OPTIONAL {{ ?in rdfs:label ?inLabel FILTER(LANG(?inLabel) = "en") }} }}
  OPTIONAL {{ ?o wdt:P159 ?hq . ?hq wdt:P625 ?hqCoord }}
}}'''


def main():
    os.makedirs(CACHE, exist_ok=True)
    artists = json.load(open(os.path.join(DATA, 'studios', 'artists.json')))
    qids = sorted(artists)
    print('artists', len(qids), file=sys.stderr)
    moves = []
    for part in chunks(qids, 120):
        moves += sparql(MOVES.format(vals=' '.join('wd:' + q for q in part)))
    mq = sorted({r['m'] for r in moves})
    details = []
    for part in chunks(mq, 150):
        details += sparql(MOVE_DETAILS.format(vals=' '.join('wd:' + q for q in part)))
    print('movement statements', len(moves), 'movements', len(mq), file=sys.stderr)
    affil = []
    for p in ('P69', 'P108', 'P463', 'P1416'):
        for part in chunks(qids, 100):
            affil += sparql(AFFIL.format(p=p, vals=' '.join('wd:' + q for q in part)))
    oq = sorted({r['org'] for r in affil if r['org'].startswith('Q')})
    orgs = []
    for part in chunks(oq, 120):
        orgs += sparql(ORGS.format(vals=' '.join('wd:' + q for q in part)))
    print('dated affiliations', len(affil), 'institutions', len(oq), file=sys.stderr)
    born = []
    for part in chunks(qids, 150):
        born += sparql(BORN.format(vals=' '.join('wd:' + q for q in part)))
    print('birthplaces', len({r['a'] for r in born}), file=sys.stderr)
    json.dump({'moves': moves, 'details': details, 'affil': affil, 'orgs': orgs, 'born': born},
              open(os.path.join(OUT, 'wd.json'), 'w'), ensure_ascii=False, indent=0, sort_keys=True)


if __name__ == '__main__':
    main()
