#!/usr/bin/env python3
"""Where a painting was painted, as Wikidata documents it — the raw read for "Painted here".

Artist, 1 Oct 2026, sending van Gogh's *Tree Roots*, a postcard of the rue Daubigny and today's
street: "Evidence of where exactly plein air paintings were made … is a really great way to extend
a line of inquiry into a specific artwork or artist. Find all other instances of documented sites
that correspond to a specific artwork and use them as new explorations available for the viewer."

Reads Wikidata (CC0) through its query service, for
  1. the saved works matched to an item (data/wikidata/matches.json, by fetch_history_wikidata.py),
  2. every work on Wikidata by a saved artist (the artists that file found, by Artsy's artist id),
and asks each for
  P1259  coordinates of the point of view — where the painter stood (precision "view");
  P180   what it depicts, when that is a place with coordinates of its own (P625) that is small
         enough to stand at: a building or structure, a street or square, a garden or park, a
         bridge, a mountain, a cliff, a rock, a waterfall, a beach (precision "depicts");
  P1071  location of creation, with coordinates (precision "town" unless the place is one of the
         classes above).
With each statement its references (P854 reference URL, P248 stated in), the work's own picture
(P18, a Commons file), its English, French, Dutch and German Wikipedia articles, and of each
depicted place its picture (P18), its Commons category (P373) and its class.

Then, for each site with no picture of its own place (a point of view on its own), the nearest
items within 250 m that have a picture (wikibase:around) — a photograph near where the painter
stood, said as such, never as the painted view.

Then the Commons files' authors and licences (extmetadata), through www.wikidata.org's API, which
reads Commons as its shared file repository (commons.wikimedia.org itself is refused from the
session). Paced and retried: the Wikimedia APIs answer 429 to a shared address.

Everything is cached in data/sites/ (private, gitignored, like all of data/). build_sites.py
distils it into docs/v2/sites.json.
"""
import hashlib, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(DATA, 'sites')
CACHE = os.path.join(OUT, 'sparql')
UA = 'ArtDatabaseSites/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/)'
SPARQL = 'https://query.wikidata.org/sparql'
API = 'https://www.wikidata.org/w/api.php'

# Places one can stand at (P31/P279*). Rivers, seas, regions and towns are left out: their
# coordinate is a centroid or a mouth, not a place the painting was made.
SITE_CLASSES = {   # each checked against its English label on Wikidata
    'Q811979': 'built structure', 'Q41176': 'building', 'Q12280': 'bridge', 'Q79007': 'street',
    'Q174782': 'square', 'Q22698': 'park', 'Q1107656': 'garden', 'Q8502': 'mountain',
    'Q107679': 'cliff', 'Q34038': 'waterfall', 'Q40080': 'beach', 'Q16970': 'church building',
    'Q4989906': 'monument', 'Q39715': 'lighthouse', 'Q23413': 'castle', 'Q54050': 'hill',
    'Q185113': 'cape', 'Q207326': 'summit', 'Q8072': 'volcano', 'Q39816': 'valley',
    'Q133056': 'mountain pass', 'Q35666': 'glacier', 'Q190429': 'depression', 'Q188040': 'quarry',
    'Q38720': 'windmill', 'Q46831': 'mountain range', 'Q35509': 'cave',
}


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
    rows = [{k: v['value'] for k, v in b.items()} for b in json.loads(txt)['results']['bindings']]
    json.dump(rows, open(path, 'w'))
    time.sleep(1)
    return rows


def qid(u):
    return u.rsplit('/', 1)[-1] if u else None


def chunks(xs, n):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def works_query(filter_values, kind):
    """Every work in VALUES with a site of one kind ("view", "depicts" or "made"). One kind a query:
    a UNION of the three, or a coordinate path through a statement node, times out."""
    pat = {
        'view': '?w p:P1259 ?st . ?st ps:P1259 ?coord .',
        'depicts': '?w p:P180 ?st . ?st ps:P180 ?place . ?place wdt:P625 ?coord .',
        'made': '?w p:P1071 ?st . ?st ps:P1071 ?place . ?place wdt:P625 ?coord .',
    }[kind]
    return f'''
SELECT ?w ?place ?coord ?refurl ?stated ?creator ("{kind}" AS ?kind) WHERE {{
  {filter_values}
  {pat}
  OPTIONAL {{ ?w wdt:P170 ?creator }}
  OPTIONAL {{ ?st prov:wasDerivedFrom ?r .
             OPTIONAL {{ ?r pr:P854 ?refurl }} OPTIONAL {{ ?r pr:P248 ?stated }} }}
}}'''


def point(r):
    m = re.match(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)', r.get('coord', ''))
    if m:
        r['lon'], r['lat'] = m.group(1), m.group(2)
        return True
    return False


def main():
    os.makedirs(CACHE, exist_ok=True)
    m = json.load(open(os.path.join(DATA, 'wikidata', 'matches.json')))
    saved_items = {x['item']: x['id'] for x in m['matched']}
    artists = {}
    for slug, a in m['artists'].items():
        if a.get('qid'):
            artists[a['qid']] = a.get('name') or slug
    print(f'{len(saved_items)} saved works with an item; {len(artists)} saved artists on Wikidata')

    rows = []
    # 1. saved works
    for kind in ('view', 'depicts', 'made'):
        for ch in chunks(sorted(saved_items), 100):
            rows += sparql(works_query('VALUES ?w { ' + ' '.join('wd:' + q for q in ch) + ' }', kind))
    n_saved = len({qid(r['w']) for r in rows})
    print(f'  saved works with a site statement: {n_saved}')
    # 2. every work by a saved artist
    for kind in ('view', 'depicts', 'made'):
        for ch in chunks(sorted(artists), 25):
            rows += sparql(works_query('VALUES ?a { ' + ' '.join('wd:' + q for q in ch) + ' } ?w wdt:P170 ?a .', kind))
        print(f'  {kind}: {len(rows)} rows so far')
    rows = [r for r in rows if point(r)]
    works = sorted({qid(r['w']) for r in rows})
    print(f'  works by saved artists with a site statement: {len(works)}')

    # the places: their class, picture, Commons category
    places = sorted({qid(r['place']) for r in rows if r.get('place')})
    prow = []
    for ch in chunks(places, 150):
        prow += sparql(f'''
SELECT ?p ?c31 ?img ?cat ?label ?enwiki ?admL ?pc WHERE {{
  VALUES ?p {{ {' '.join('wd:' + q for q in ch)} }}
  OPTIONAL {{ ?p wdt:P31 ?c31 }}
  OPTIONAL {{ ?p wdt:P18 ?img }} OPTIONAL {{ ?p wdt:P373 ?cat }}
  OPTIONAL {{ ?p rdfs:label ?label FILTER(LANG(?label) = "en") }}
  OPTIONAL {{ ?p wdt:P131 ?adm . ?adm rdfs:label ?admL FILTER(LANG(?admL) = "en") }}
  OPTIONAL {{ ?p wdt:P625 ?pc }}
  OPTIONAL {{ ?enwiki schema:about ?p ; schema:isPartOf <https://en.wikipedia.org/> }}
}}''')
    # Which of their classes are places one can stand at: each class's own closure, forty classes a
    # query (a closure over many places at once times out).
    classes = sorted({qid(r['c31']) for r in prow if r.get('c31')})
    site_of = {}
    for ch in chunks(classes, 40):
        for r in sparql(f'''
SELECT ?c ?s WHERE {{
  VALUES ?c {{ {' '.join('wd:' + q for q in ch)} }}
  VALUES ?s {{ {' '.join('wd:' + q for q in SITE_CLASSES)} }}
  ?c wdt:P279* ?s .
}}'''):
            site_of.setdefault(qid(r['c']), qid(r['s']))
    # And which are water, a settlement or a country or state: never a site, whatever else they are.
    not_site = set()
    for ch in chunks(classes, 40):
        for r in sparql(f'''
SELECT ?c WHERE {{
  VALUES ?c {{ {' '.join('wd:' + q for q in ch)} }}
  VALUES ?s {{ wd:Q15324 wd:Q486972 wd:Q6256 wd:Q107390 wd:Q10864048 }}
  ?c wdt:P279* ?s .
}}'''):
            not_site.add(qid(r['c']))
    nots = {qid(r['p']) for r in prow if qid(r.get('c31')) in not_site}
    for r in prow:
        c = qid(r.get('c31'))
        if c in site_of and qid(r['p']) not in nots:
            r['cls'] = 'http://www.wikidata.org/entity/' + site_of[c]
    print(f'  places read: {len(places)}')

    # the works themselves: labels and facts, then their articles (one query of all of it times out)
    wrow = []
    for ch in chunks(works, 60):
        vals = ' '.join('wd:' + q for q in ch)
        wrow += sparql(f'''
SELECT ?w ?label ?labelfr ?creatorL ?inception ?img ?collL WHERE {{
  VALUES ?w {{ {vals} }}
  OPTIONAL {{ ?w rdfs:label ?label FILTER(LANG(?label) = "en") }}
  OPTIONAL {{ ?w rdfs:label ?labelfr FILTER(LANG(?labelfr) = "fr") }}
  OPTIONAL {{ ?w wdt:P170 ?creator . ?creator rdfs:label ?creatorL FILTER(LANG(?creatorL) = "en") }}
  OPTIONAL {{ ?w wdt:P571 ?inception }}
  OPTIONAL {{ ?w wdt:P18 ?img }}
  OPTIONAL {{ ?w wdt:P195 ?coll . ?coll rdfs:label ?collL FILTER(LANG(?collL) = "en") }}
}}''')
        wrow += sparql(f'''
SELECT ?w ?article ?lang WHERE {{
  VALUES ?w {{ {vals} }}
  ?article schema:about ?w ; schema:inLanguage ?lang ; schema:isPartOf ?site .
  VALUES ?site {{ <https://en.wikipedia.org/> <https://fr.wikipedia.org/> <https://nl.wikipedia.org/> <https://de.wikipedia.org/> }}
}}''')
    print(f'  works read: {len(works)}')

    # labels of what the references cite
    stated = sorted({qid(r['stated']) for r in rows if r.get('stated')})
    srow = []
    for ch in chunks(stated, 300):
        srow += sparql(f'''SELECT ?s ?label WHERE {{ VALUES ?s {{ {' '.join('wd:' + q for q in ch)} }}
  ?s rdfs:label ?label FILTER(LANG(?label) = "en") }}''')

    json.dump({'rows': rows, 'places': prow, 'works': wrow, 'stated': srow,
               'saved_items': saved_items, 'artists': artists},
              open(os.path.join(OUT, 'raw.json'), 'w'))
    print('wrote data/sites/raw.json')

    if '--near' in sys.argv or '--all' in sys.argv:
        near_pictures()
    if '--files' in sys.argv or '--all' in sys.argv:
        file_meta()
    if '--wiki' in sys.argv or '--all' in sys.argv:
        wiki_text()


def wiki_text():
    """The text of each English Wikipedia article build_sites.py wants (data/sites/want_wiki.json)."""
    want = json.load(open(os.path.join(OUT, 'want_wiki.json')))
    path = os.path.join(OUT, 'wiki.json')
    have = json.load(open(path)) if os.path.exists(path) else {}
    todo = [u for u in want if u not in have]
    print(f'  articles: {len(todo)} to read of {len(want)}')
    for i, u in enumerate(todo):
        title = urllib.parse.unquote(u.rsplit('/wiki/', 1)[-1])
        q = urllib.parse.urlencode({'action': 'query', 'format': 'json', 'prop': 'extracts', 'explaintext': 1,
                                    'redirects': 1, 'titles': title})
        d = json.loads(get('https://en.wikipedia.org/w/api.php?' + q))
        pg = list(d['query']['pages'].values())[0]
        have[u] = {'title': pg.get('title', title.replace('_', ' ')), 'text': pg.get('extract', '')}
        if i % 20 == 0:
            json.dump(have, open(path, 'w'))
        time.sleep(1.2)
    json.dump(have, open(path, 'w'))
    print(f'  articles read: {len(have)}')


def near_pictures():
    """Items with a picture within 250 m of each point of view that has no depicted place."""
    raw = json.load(open(os.path.join(OUT, 'raw.json')))
    pts = {}
    for r in raw['rows']:
        if r['kind'] == 'view':
            pts[(round(float(r['lat']), 5), round(float(r['lon']), 5))] = 1
    out = {}
    for i, (lat, lon) in enumerate(sorted(pts)):
        rows = sparql(f'''
SELECT ?p ?img ?label ?d WHERE {{
  SERVICE wikibase:around {{ ?p wdt:P625 ?loc . bd:serviceParam wikibase:center "Point({lon} {lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "0.25" . bd:serviceParam wikibase:distance ?d . }}
  ?p wdt:P18 ?img . OPTIONAL {{ ?p rdfs:label ?label FILTER(LANG(?label) = "en") }}
}} ORDER BY ?d LIMIT 6''')
        out[f'{lat},{lon}'] = rows
        if i % 50 == 0:
            print(f'  near {i}/{len(pts)}')
    json.dump(out, open(os.path.join(OUT, 'near.json'), 'w'))


def file_meta():
    """Author and licence of every Commons file build_sites.py wants to show (data/sites/want_files.json)."""
    want = json.load(open(os.path.join(OUT, 'want_files.json')))
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
                          'date': v('DateTimeOriginal'), 'desc': v('ImageDescription'),
                          'credit': v('Credit'), 'w': ii.get('width'), 'h': ii.get('height'),
                          'missing': not p.get('imageinfo')}
        json.dump(have, open(path, 'w'))
        time.sleep(3)
    print(f'  files read: {len(have)}')


if __name__ == '__main__':
    if sys.argv[1:2] == ['--only']:
        for a in sys.argv[2:]:
            {'near': near_pictures, 'files': file_meta, 'wiki': wiki_text}[a]()
    else:
        main()
