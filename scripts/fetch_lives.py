#!/usr/bin/env python3
"""The raw read for the lives (docs/v2/lives.json; scripts/build_lives.py).

The artist, 2 Oct 2026: "Implement your idea for Picasso. Find other similar instances for notable
artists alike so that viewers can focus on lives of artists".

For each artist a life may be drawn for — every saved artist with ten saved works or more whose
Wikidata item scripts/fetch_studios.py matched (data/studios/artists.json), and every artist of a
cataloguer's hunt (docs/v2/explorations.json) — this reads:

  1. from Wikidata (CC0): place of birth (P19), place of death (P20), date of birth (P569) and of
     death (P570), and each place's point (P625) and label;
  2. the artist's English Wikipedia article as plain text (CC BY-SA), where data/studios/ has not
     read it already — build_lives.py quotes from it only whole sentences that put the artist in a
     place in a year.

Paced and retried (Wikimedia answers 429 to a shared address). Everything goes to data/lives/
(private, gitignored, like all of data/).

    python3 scripts/fetch_lives.py
"""
import json, os, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch_studios as fs  # get(), sparql(), chunks(), vals()

ROOT = fs.ROOT
OUT = os.path.join(ROOT, 'data', 'lives')
WAPI = 'https://en.wikipedia.org/w/api.php'


def candidates():
    st = json.load(open(os.path.join(ROOT, 'docs', 'v2', 'studios.json')))
    wd = json.load(open(os.path.join(ROOT, 'data', 'studios', 'artists.json')))
    by_name = {v['name']: q for q, v in wd.items()}
    qs = {r[2] for r in st['artists'] if r[5] >= 10 and r[2]}
    ex = json.load(open(os.path.join(ROOT, 'docs', 'v2', 'explorations.json')))
    for h in ex['hunts']:
        if h['artist'] in by_name:
            qs.add(by_name[h['artist']])
    return sorted(qs)


BD = '''
SELECT ?a ?aLabel ?born ?bornLabel ?bll ?died ?diedLabel ?dll ?b ?d WHERE {{ VALUES ?a {{ {vals} }}
  OPTIONAL {{ ?a wdt:P19 ?born . OPTIONAL {{ ?born wdt:P625 ?bll . }} }}
  OPTIONAL {{ ?a wdt:P20 ?died . OPTIONAL {{ ?died wdt:P625 ?dll . }} }}
  OPTIONAL {{ ?a wdt:P569 ?b . }}
  OPTIONAL {{ ?a wdt:P570 ?d . }}
  SERVICE wikibase:label {{ bd:serviceParam wikibase:language "en" . }} }}'''

ARTWIKI = '''
SELECT ?a ?enwiki WHERE {{ VALUES ?a {{ {vals} }}
  ?enwiki schema:about ?a ; schema:isPartOf <https://en.wikipedia.org/> . }}'''


def main():
    os.makedirs(OUT, exist_ok=True)
    qs = candidates()
    print(f'{len(qs)} artists')
    rows = []
    for ch in fs.chunks(qs, 40):
        rows += fs.sparql(BD.format(vals=fs.vals(ch)))
    json.dump(rows, open(os.path.join(OUT, 'wd.json'), 'w'), indent=0, sort_keys=True)
    print(f'  birth and death: {len(rows)} rows')
    have_st = json.load(open(os.path.join(ROOT, 'data', 'studios', 'artist_wiki.json')))
    path = os.path.join(OUT, 'wiki.json')
    have = json.load(open(path)) if os.path.exists(path) else {}
    links = []
    for ch in fs.chunks(qs, 150):
        links += fs.sparql(ARTWIKI.format(vals=fs.vals(ch)))
    todo = [r for r in links if r['a'] not in have and not (have_st.get(r['a']) or {}).get('text')]
    print(f'  articles: {len(todo)} to read')
    for k, r in enumerate(todo):
        title = urllib.parse.unquote(r['enwiki'].rsplit('/', 1)[-1]).replace('_', ' ')
        q = urllib.parse.urlencode({'action': 'query', 'prop': 'extracts', 'explaintext': 1, 'format': 'json',
                                    'redirects': 1, 'titles': title})
        txt = fs.get(WAPI + '?' + q)
        pages = (json.loads(txt).get('query') or {}).get('pages', {}) if txt else {}
        page = next(iter(pages.values()), {})
        have[r['a']] = {'title': page.get('title', title), 'text': page.get('extract') or '', 'url': r['enwiki']}
        json.dump(have, open(path, 'w'))
        print(f'    {k + 1}/{len(todo)} {title}', flush=True)
        time.sleep(2.5)


if __name__ == '__main__':
    main()
