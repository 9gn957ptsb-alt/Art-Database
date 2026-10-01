#!/usr/bin/env python3
"""Where the saved artists worked — the raw read for the studios.

The artist, 1 Oct 2026: "Give a site to artist studios to catalogue individual artists with
specific locations".

For every artist of the saved works whose Wikidata item scripts/fetch_history_wikidata.py matched
(data/wikidata/matches.json, almost all by Artsy's own artist id on the item), this reads from
Wikidata (CC0) through its query service:

  1. the artist's own statements of place — P937 work location and P551 residence — with their
     qualifiers (P580 start, P582 end, P585 point in time) and references (P854 reference URL,
     P248 stated in);
  2. the buildings that name the artist: P466 occupant (with its start and end), P127 owned by,
     P138 named after — the studio, the house, the house museum (build_studios.py decides which
     of them are a studio or a house, never a school or a street named after them);
  3. of every building found, what it is (P31), where it is (P625; P131 and that place's point,
     for the town a private studio is placed at), its photographs (P18, P5775 interior), its
     heritage listing (P1435), official website (P856), inception (P571) and its English
     Wikipedia article.

Then the opening of each building's English Wikipedia article (the REST summary, CC BY-SA) for a
short quotation, and the Commons files' authors and licences (extmetadata), through
www.wikidata.org's API, which reads Commons as its shared file repository (commons.wikimedia.org
is refused from the session). Paced and retried: the Wikimedia APIs answer 429 to a shared address.

Everything is cached in data/studios/ (private, gitignored, like all of data/).
build_studios.py distils it into docs/v2/studios.json.

    python3 scripts/fetch_studios.py            # all
    python3 scripts/fetch_studios.py --only wiki|files
"""
import functools, hashlib, json, os, sys, time, urllib.parse, urllib.request, urllib.error

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'studios')
CACHE = os.path.join(OUT, 'sparql')
UA = 'ArtDatabaseStudios/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/)'
SPARQL = 'https://query.wikidata.org/sparql'
API = 'https://www.wikidata.org/w/api.php'
WIKI = 'https://en.wikipedia.org/api/rest_v1/page/summary/'


def get(url, data=None, accept='application/json', tries=8):
    wait = 5
    for i in range(tries):
        req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': accept})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
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


def saved_artists():
    """The saved artists with a matched item: {qid: {name, slug, birth, death}}."""
    finding = json.load(open(os.path.join(ROOT, 'docs', 'v2', 'finding.json')))
    names = set()
    for w in finding['w']:
        for a in str(w[2]).split(', '):
            names.add(a)
    m = json.load(open(os.path.join(DATA, 'wikidata', 'matches.json')))['artists']
    out = {}
    for slug, v in m.items():
        if v.get('qid') and v.get('name') in names:
            out[v['qid']] = {'name': v['name'], 'slug': slug, 'birth': v.get('birth'),
                             'death': v.get('death'), 'how': v.get('how'), 'confidence': v.get('confidence')}
    return out


CLAIMS = '''
SELECT ?a ?prop ?st ?pl ?start ?end ?pit ?rank WHERE {{
  VALUES ?a {{ {vals} }}
  {{ ?a p:P937 ?st . ?st ps:P937 ?pl . BIND("P937" AS ?prop) }}
  UNION {{ ?a p:P551 ?st . ?st ps:P551 ?pl . BIND("P551" AS ?prop) }}
  OPTIONAL {{ ?st wikibase:rank ?rank }}
  OPTIONAL {{ ?st pq:P580 ?start }} OPTIONAL {{ ?st pq:P582 ?end }} OPTIONAL {{ ?st pq:P585 ?pit }}
}}'''

REFS = '''
SELECT ?st ?refurl ?stated WHERE {{
  VALUES ?a {{ {vals} }}
  {{ ?a p:P937 ?st }} UNION {{ ?a p:P551 ?st }}
  ?st prov:wasDerivedFrom ?r .
  OPTIONAL {{ ?r pr:P854 ?refurl }} OPTIONAL {{ ?r pr:P248 ?stated }}
}}'''

# The buildings that name the artist, one property a query (a UNION of them times out).
BUILDINGS = {
    'P466': '''SELECT ?a ?s ?start ?end ("P466" AS ?how) WHERE {{ VALUES ?a {{ {vals} }}
  ?s p:P466 ?st . ?st ps:P466 ?a . ?s wdt:P625 ?c .
  OPTIONAL {{ ?st pq:P580 ?start }} OPTIONAL {{ ?st pq:P582 ?end }} }}''',
    'P127': '''SELECT ?a ?s ("P127" AS ?how) WHERE {{ VALUES ?a {{ {vals} }} ?s wdt:P127 ?a . ?s wdt:P625 ?c . }}''',
    'P138': '''SELECT ?a ?s ("P138" AS ?how) WHERE {{ VALUES ?a {{ {vals} }} ?s wdt:P138 ?a . ?s wdt:P625 ?c . }}''',
}

DETAILS = '''
SELECT ?s ?label ?labelfr ?desc ?cls ?clsLabel ?coord ?in ?inLabel ?inCoord ?img ?inner ?heritage
       ?site ?inception ?enwiki ?addr WHERE {{
  VALUES ?s {{ {vals} }}
  OPTIONAL {{ ?s rdfs:label ?label FILTER(LANG(?label) = "en") }}
  OPTIONAL {{ ?s rdfs:label ?labelfr FILTER(LANG(?labelfr) = "mul" || LANG(?labelfr) = "fr") }}
  OPTIONAL {{ ?s schema:description ?desc FILTER(LANG(?desc) = "en") }}
  OPTIONAL {{ ?s wdt:P31 ?cls . ?cls rdfs:label ?clsLabel FILTER(LANG(?clsLabel) = "en") }}
  OPTIONAL {{ ?s wdt:P625 ?coord }}
  OPTIONAL {{ ?s wdt:P131 ?in . OPTIONAL {{ ?in rdfs:label ?inLabel FILTER(LANG(?inLabel) = "en") }}
             OPTIONAL {{ ?in wdt:P625 ?inCoord }} }}
  OPTIONAL {{ ?s wdt:P18 ?img }}
  OPTIONAL {{ ?s wdt:P5775 ?inner }}
  OPTIONAL {{ ?s wdt:P1435 ?heritage }}
  OPTIONAL {{ ?s wdt:P856 ?site }}
  OPTIONAL {{ ?s wdt:P571 ?inception }}
  OPTIONAL {{ ?s wdt:P6375 ?addr }}
  OPTIONAL {{ ?enwiki schema:about ?s ; schema:isPartOf <https://en.wikipedia.org/> }}
}}'''

PLACES = '''
SELECT ?pl ?label ?cls ?clsLabel ?in ?inLabel ?coord ?iso ?sub WHERE {{
  VALUES ?pl {{ {vals} }}
  OPTIONAL {{ ?pl wdt:P625 ?coord }} OPTIONAL {{ ?pl wdt:P297 ?iso }} OPTIONAL {{ ?pl wdt:P300 ?sub }}
  OPTIONAL {{ ?pl rdfs:label ?label FILTER(LANG(?label) = "en") }}
  OPTIONAL {{ ?pl wdt:P31 ?cls . ?cls rdfs:label ?clsLabel FILTER(LANG(?clsLabel) = "en") }}
  OPTIONAL {{ ?pl wdt:P17 ?in . ?in rdfs:label ?inLabel FILTER(LANG(?inLabel) = "en") }}
}}'''

STATED = '''
SELECT ?x ?label WHERE {{ VALUES ?x {{ {vals} }} ?x rdfs:label ?label FILTER(LANG(?label) = "en") }}'''


def vals(ids):
    return ' '.join('wd:' + q for q in ids)


def main():
    os.makedirs(CACHE, exist_ok=True)
    artists = saved_artists()
    json.dump(artists, open(os.path.join(OUT, 'artists.json'), 'w'))
    qs = sorted(artists)
    print(f'{len(qs)} saved artists with an item')
    claims, refs, buildings = [], [], []
    for i, ch in enumerate(chunks(qs, 60)):
        claims += sparql(CLAIMS.format(vals=vals(ch)))
        refs += sparql(REFS.format(vals=vals(ch)))
        for q in BUILDINGS.values():
            buildings += sparql(q.format(vals=vals(ch)))
        print(f'  artists {min((i + 1) * 60, len(qs))}/{len(qs)}: {len(claims)} claims, {len(buildings)} buildings')
    json.dump(claims, open(os.path.join(OUT, 'claims.json'), 'w'))
    json.dump(refs, open(os.path.join(OUT, 'refs.json'), 'w'))
    json.dump(buildings, open(os.path.join(OUT, 'buildings.json'), 'w'))

    # Every place an artist's statement names, and every building: what it is.
    places = sorted({r['pl'] for r in claims if r.get('pl', '').startswith('Q')})
    prow = []
    for ch in chunks(places, 150):
        prow += sparql(PLACES.format(vals=vals(ch)))
    json.dump(prow, open(os.path.join(OUT, 'places.json'), 'w'))
    stated = sorted({r['stated'] for r in refs if r.get('stated', '').startswith('Q')})
    srow = []
    for ch in chunks(stated, 200):
        srow += sparql(STATED.format(vals=vals(ch)))
    json.dump(srow, open(os.path.join(OUT, 'stated.json'), 'w'))
    # A residence or work location that is itself a building (a villa, a mas) is read in full too.
    small = set()
    by = {}
    for r in prow:
        by.setdefault(r['pl'], set()).add(r.get('clsLabel', ''))
    BUILT = ('villa', 'house', 'building', 'castle', 'mas', 'studio', 'mansion', 'palace', 'palazzo',
             'farmhouse', 'manor', 'apartment', 'hôtel particulier', 'private mansion', 'château', 'museum',
             'tower', 'loft', 'barn', 'chapel', 'residence', 'cottage', 'hotel', 'estate', 'abbey')
    for pl, cl in by.items():
        if any(any(b in c.lower() for b in BUILT) for c in cl):
            small.add(pl)
    items = sorted(small | {r['s'] for r in buildings})
    print(f'  {len(items)} buildings to read')
    drow = []
    for ch in chunks(items, 25):
        drow += sparql(DETAILS.format(vals=vals(ch)))
    json.dump(drow, open(os.path.join(OUT, 'details.json'), 'w'))
    artist_text()
    wiki_text()
    file_meta()


def wiki_text():
    """The opening of each building's English Wikipedia article (CC BY-SA), for quotation."""
    want_p = os.path.join(OUT, 'want_wiki.json')
    if not os.path.exists(want_p):
        print('  no want_wiki.json yet: run build_studios.py, then --only wiki')
        return
    want = json.load(open(want_p))
    path = os.path.join(OUT, 'wiki.json')
    have = json.load(open(path)) if os.path.exists(path) else {}
    todo = [t for t in want if t not in have]
    print(f'  wiki: {len(todo)} to read of {len(want)}')
    for t in todo:
        txt = get(WIKI + urllib.parse.quote(t.replace(' ', '_'), safe=''))
        d = json.loads(txt) if txt else {}
        have[t] = {'extract': d.get('extract'), 'url': ((d.get('content_urls') or {}).get('desktop') or {}).get('page'),
                   'title': d.get('title')}
        json.dump(have, open(path, 'w'))
        time.sleep(0.5)


ARTWIKI = '''
SELECT ?a ?enwiki WHERE {{ VALUES ?a {{ {vals} }}
  ?enwiki schema:about ?a ; schema:isPartOf <https://en.wikipedia.org/> . }}'''
WAPI = 'https://en.wikipedia.org/w/api.php'


def artist_text():
    """Each artist's English Wikipedia article, as plain text (CC BY-SA): build_studios.py quotes
    from it only the sentences that say "studio" and name one of the artist's places."""
    artists = json.load(open(os.path.join(OUT, 'artists.json')))
    rows = []
    for ch in chunks(sorted(artists), 150):
        rows += sparql(ARTWIKI.format(vals=vals(ch)))
    path = os.path.join(OUT, 'artist_wiki.json')
    have = json.load(open(path)) if os.path.exists(path) else {}
    todo = [r for r in rows if r['a'] not in have]
    print(f'  artist articles: {len(todo)} to read of {len(rows)}')
    for k, r in enumerate(todo):
        title = urllib.parse.unquote(r['enwiki'].rsplit('/', 1)[-1]).replace('_', ' ')
        q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'format': 'json',
                                    'redirects': 1, 'titles': title})
        txt = get(WAPI + '?' + q)
        pages = (json.loads(txt).get('query') or {}).get('pages', {}) if txt else {}
        page = next(iter(pages.values()), {})
        have[r['a']] = {'title': page.get('title', title), 'text': page.get('extract') or '',
                        'url': r['enwiki']}
        if k % 20 == 0:
            json.dump(have, open(path, 'w'))
            print(f'    {k}/{len(todo)}')
        time.sleep(0.4)
    json.dump(have, open(path, 'w'))


def file_meta():
    """Author and licence of every Commons file build_studios.py wants to show (want_files.json)."""
    want_p = os.path.join(OUT, 'want_files.json')
    if not os.path.exists(want_p):
        print('  no want_files.json yet: run build_studios.py, then --only files')
        return
    want = json.load(open(want_p))
    path = os.path.join(OUT, 'files.json')
    have = json.load(open(path)) if os.path.exists(path) else {}
    todo = [f for f in want if f not in have]
    print(f'  files: {len(todo)} to read of {len(want)}')
    for ch in chunks(todo, 40):
        q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'imageinfo',
                                    'iiprop': 'extmetadata|size', 'iiextmetadatalanguage': 'en',
                                    'titles': '|'.join('File:' + f for f in ch)})
        d = json.loads(get(API + '?' + q))
        norm = {n['to']: n['from'] for n in d['query'].get('normalized', [])}
        for p in d['query']['pages'].values():
            name = norm.get(p['title'], p['title'])[5:]
            ii = (p.get('imageinfo') or [{}])[0]
            em = ii.get('extmetadata', {})
            v = lambda k: (em.get(k) or {}).get('value')
            have[name] = {'artist': v('Artist'), 'licence': v('LicenseShortName'), 'url': v('LicenseUrl'),
                          'date': v('DateTimeOriginal'), 'w': ii.get('width'), 'h': ii.get('height'),
                          'missing': not p.get('imageinfo')}
        json.dump(have, open(path, 'w'))
        time.sleep(3)
    print(f'  files read: {len(have)}')


print = functools.partial(print, flush=True)


if __name__ == '__main__':
    if sys.argv[1:2] == ['--only']:
        for a in sys.argv[2:]:
            {'wiki': wiki_text, 'files': file_meta, 'artists': artist_text}[a]()
    else:
        main()
