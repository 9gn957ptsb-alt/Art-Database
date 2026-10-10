#!/usr/bin/env python3
"""Find photographs of each museum's galleries, and read the colour of their walls off them.

The artist, 10 Oct 2026: "I want the interior walls of all the museums to be [what] they are in
real life if you can find photos of the interiors, if not, just make it a [basic] white and make
the ceiling white as well which should actually look gray when considering shadows of interiors".

Public sources only, and no photograph copied anywhere:
  wd     each museum's Wikidata item (CC0), through the query service: a museum within 1.5 km of
         its point whose name agrees, else Wikidata's own search on its name (run by the query
         service) checked against the point; its Commons category (P373), and the category it is
         filed under where that is the museum's main one; its image of the interior (P5775).
  files  Commons' category pages, as anyone reads them: the museum's subcategories about its
         inside (Interior of …, its rooms, galleries, halls, salles, zalen, Säle …, three levels
         down, rooms first, exhibitions after, the past never) and the files listed in them, and
         Commons' search under its main category for gallery, room, interior and the local word;
         views of a numbered room first, a reproduction of one work never; P5775's file first.
         Twenty a museum.
  read   a vision model (OpenAI's, MODEL below) looks at each, fetching Commons' 960 px thumbnail
         itself, and says whether it shows the museum's gallery walls as they are now, their paint
         as it is in daylight ("white" for a white wall under any light, else #rrggbb), the era of
         the works on them, the room where the title or category names one, and how sure it is.
  credit each photograph used: its file page's author, licence and date.
  hand   scripts/finishes_hand.json: what was read, with the credits — build_finishes.py writes
         docs/v2/interiors/finishes.json from it.

Wikimedia's action API and its thumbnails answer 429 to the session's shared address (10 Oct 2026);
its query service and its pages do not, and the model's servers fetch the thumbnails themselves.
Caches in data/interiors/ (gitignored).

  python3 scripts/fetch_interior_photos.py [--only wd files read credit hand] [--slug museum-…] [--jobs 4]
      [--again]   (a museum the hand file has is read again only with --again or --slug)
"""
import argparse
import hashlib
import html
import json
import math
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data', 'interiors')
PHOTOS = os.path.join(DATA, 'photos')
UA = 'ArtDatabaseInteriors/1.0 (https://9gn957ptsb-alt.github.io/Art-Database/)'
SPARQL = 'https://query.wikidata.org/sparql'
WIKI = 'https://commons.wikimedia.org/wiki/'

# A subcategory worth opening: it is about the inside, its rooms or what is shown in them.
INSIDE = re.compile(r'interior|inside|innen|int[ée]rieur|interieur|galler|salle|saal|s[äa]le\b|\bsala\b|salas|zaal|zalen|'
                    r'\brooms?\b|\bhalls?\b|wing|floor|level|rotunda|atrium|court|exhibition|installation|display|'
                    r'staircase|stairs|ausstellung|tentoonstelling|exposici|esposizion|mostra|vleugel|fl[üu]gel|'
                    r'\baile\b|\bala\b|pavilion|pavillon|museum building|main building', re.I)
# … and not about its collection, its outside or its people.
NOT_INSIDE = re.compile(r'paintings|drawings|prints|engravings|photographs (in|of|by|from)|sculptures? (in|by|of)|'
                        r'\bworks\b|collections?\b|objects|artefacts|artifacts|exterior|fa[cç]ade|aerial|by night|'
                        r'at night|people|visitors|staff|directors|logo|signs|maps|plans\b|construction|history of|'
                        r'\bvideos?\b|audio|by year|\bin \d{4}\b|\d{4} in |coins|medals|manuscripts|books|textiles|'
                        r'costumes|furniture|ceramics|porcelain|vases|armou?r|weapons|jewel|fossils|specimens|'
                        r'skeletons|mummies|stained glass|tapestr|clocks|instruments|\bcars\b|vehicles|aircraft|'
                        r'ships|models of|portraits|busts|statues|reliefs|\bicons\b|altarpieces|frescos?\b|'
                        r'catalogs?|catalogues?|library|archives?\b|restaurant|caf[eé]|shop\b|garden|park\b|'
                        r'opening|renovation|reopening|events?\b|concerts?|lectures?|uses of|templates?|'
                        r'datasets|images from|media from|files from|scans|documents|letters|postcards|stamps|'
                        r'quality images|valued images|featured pictures|panoramics?\b|360', re.I)
FILE_OK = re.compile(r'\.(jpe?g|png|tiff?|webp)$', re.I)


def get(url, data=None, accept='application/json', tries=9, binary=False):
    wait = 5
    for _ in range(tries):
        req = urllib.request.Request(url, data=data, headers={'User-Agent': UA, 'Accept': accept})
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                body = r.read()
                return body if binary else body.decode('utf-8')
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                ra = e.headers.get('Retry-After')
                time.sleep(min(int(ra), 120) if ra and ra.isdigit() else wait)
                wait = min(wait * 2, 120)
                continue
            if e.code in (400, 403, 404, 410):
                return None
            raise
        except Exception:
            time.sleep(wait)
            wait = min(wait * 2, 120)
    raise RuntimeError('gave up: ' + url[:200])


def cached(name, fetch):
    os.makedirs(os.path.join(DATA, 'cache'), exist_ok=True)
    path = os.path.join(DATA, 'cache', hashlib.sha1(name.encode()).hexdigest()[:20] + '.json')
    if os.path.exists(path):
        return json.load(open(path))
    got = fetch()
    json.dump(got, open(path, 'w'))
    return got


def sparql(q):
    def run():
        txt = get(SPARQL, data=urllib.parse.urlencode({'query': q}).encode(), accept='application/sparql-results+json')
        time.sleep(1.2)
        return [{k: v['value'] for k, v in b.items()} for b in json.loads(txt)['results']['bindings']] if txt else []
    return cached('sparql:' + q, run)


def page(title):
    """A Commons page's HTML, as a reader gets it."""
    url = WIKI + urllib.parse.quote(title.replace(' ', '_'), safe=':/(),\'!')

    def run():
        txt = get(url, accept='text/html')
        time.sleep(1.2)
        return txt or ''
    return cached('page:' + url, run)


def fold(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z0-9 ]+', ' ', s)


ARTICLES = {'the', 'of', 'and', 'de', 'du', 'des', 'la', 'le', 'les', 'di', 'del', 'della', 'y', 'e', 'at', 'in',
            'for', 'd', 'c', 'dc', 'van', 'der', 'den', 'het', 'im', 'am', 'zu', 'fur', 'und'}


def words(s):
    return {w for w in fold(s).split() if w not in ARTICLES and len(w) > 1}


def agree(name, label):
    """How far a label is the museum's name: their words' overlap over their union (Jaccard), the name
    taken before its first comma ("National Gallery of Art, Washington, D.C." is "National Gallery of Art")."""
    a, b = words(name.split(',')[0]), words(label)
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


ITEM_FIELDS = '''
  OPTIONAL { ?item rdfs:label ?label . FILTER(LANG(?label) IN ("en", "fr", "de", "es", "it", "nl", "da", "sv", "pt", "ru", "ja", "ko", "zh", "mul")) }
  OPTIONAL { ?item wdt:P373 ?cat }
  OPTIONAL { ?item wdt:P5775 ?int }
  OPTIONAL { ?home wdt:P466 ?item . ?home wdt:P373 ?homecat }'''


def find_item(m):
    """The museum's Wikidata item: a museum within 1.5 km whose name agrees, else the search."""
    q = '''SELECT ?item ?label ?dist ?cat ?int ?homecat WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?loc . bd:serviceParam wikibase:center "Point(%f %f)"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "1.5" . bd:serviceParam wikibase:distance ?dist . }
  ?item wdt:P31/wdt:P279* wd:Q33506 .%s
}''' % (m['lon'], m['lat'], ITEM_FIELDS)
    rows = sparql(q)
    best, score = None, 0.0
    for r in rows:
        s = agree(m['name'], r.get('label', '')) - float(r.get('dist', 0)) * 0.05
        if s > score:
            best, score = r, s
    how = 'near'
    if not best or score < 0.6:
        name = m['name'].split(',')[0].replace('"', '')
        q2 = '''SELECT ?item ?label ?dist ?cat ?int ?homecat WHERE {
  SERVICE wikibase:mwapi { bd:serviceParam wikibase:api "EntitySearch" ; wikibase:endpoint "www.wikidata.org" ;
    mwapi:search "%s" ; mwapi:language "en" . ?item wikibase:apiOutputItem mwapi:item . }
  ?item wdt:P625 ?loc .
  BIND(geof:distance(?loc, "Point(%f %f)"^^geo:wktLiteral) AS ?dist) FILTER(?dist < 3)%s
}''' % (name, m['lon'], m['lat'], ITEM_FIELDS)
        rows2 = sparql(q2)
        for r in rows2:
            s = agree(m['name'], r.get('label', '')) - float(r.get('dist', 0)) * 0.05
            if s > score:
                best, score, how = r, s, 'search'
        rows = rows + rows2
    if not best or score < 0.5:
        return None
    qid = best['item'].rsplit('/', 1)[-1]
    mine = [r for r in rows if r['item'] == best['item']]
    pick = lambda k: sorted({r[k] for r in mine if r.get(k)})
    return {'qid': qid, 'qhow': how, 'qscore': round(score, 2), 'label': best.get('label'),
            'cat': (pick('cat') or [None])[0], 'homecat': pick('homecat'),
            'int': [urllib.parse.unquote(u.rsplit('/', 1)[-1]) for u in pick('int')]}


SUB = re.compile(r'<bdi dir="ltr"><a href="/wiki/Category:([^"#?]+)"')
BOX = re.compile(r'<li class="gallerybox".*?</li>', re.S)
FILE_HREF = re.compile(r'href="/wiki/File:([^"]+)" class="mw-file-description"')
THUMB = re.compile(r'src="https://(?:thumb|upload)\.wikimedia\.org/(wikipedia/commons/thumb/[0-9a-f]/[0-9a-f]{2}/[^/"]+)/')
SIZE = re.compile(r'data-file-width="(\d+)" data-file-height="(\d+)"')


def unq(s):
    return urllib.parse.unquote(html.unescape(s)).replace('_', ' ')


def category(name):
    """A category page: its subcategories and its files (the first page of each, as listed)."""
    t = page('Category:' + name)
    a = t.find('id="mw-subcategories"')
    ends = [k for k in (t.find('id="mw-pages"'), t.find('id="mw-category-media"'), t.find('id="catlinks"')) if k > a]
    subs = [unq(s) for s in SUB.findall(t[a:min(ends)])] if a >= 0 and ends else []
    files = []
    for box in BOX.findall(t):
        f, th, sz = FILE_HREF.search(box), THUMB.search(box), SIZE.search(box)
        if not f or not th:
            continue
        title = unq(f.group(1))
        base = th.group(1)
        files.append({'title': title, 'thumb': 'https://upload.wikimedia.org/' + base + '/250px-' +
                      base.rsplit('/', 1)[-1] + ('.jpg' if re.search(r'\.tiff?$', base, re.I) else ''),
                      'w': int(sz.group(1)) if sz else None, 'h': int(sz.group(2)) if sz else None})
    return subs, files


# How likely a category is to show its galleries' walls as they are now: its rooms first, its
# inside, its floors; temporary exhibitions after; the past (a year before 2000, "historic") never.
ROOMISH = re.compile(r'\broom\b|\bgallery\s*\d|\bgalleries\b|gallery of|salle|saal|s[äa]le\b|\bsala\b|salas|zaal|zalen|'
                     r'\bhalls?\b|rotunda|wing|vleugel|fl[üu]gel|\baile\b|\bala\b|\d', re.I)
INSIDEISH = re.compile(r'interior|inside|innen|int[ée]rieur|interieur|by room|rooms', re.I)
FLOORISH = re.compile(r'floor|level|etage|étage|stock|piso|planta|verdieping', re.I)
SHOWISH = re.compile(r'exhibition|tentoonstelling|ausstellung|exposition|exposici|esposizion|mostra|installation', re.I)
PAST = re.compile(r'historic|history|former|old\b|\b1[0-8]\d\d\b|\b19[0-9]\d\b|online|virtual|travel', re.I)


def rank(cat):
    if PAST.search(cat):
        return -9
    return ((3 if ROOMISH.search(cat) else 0) + (2 if INSIDEISH.search(cat) else 0) +
            (1 if FLOORISH.search(cat) else 0) - (3 if SHOWISH.search(cat) else 0))


CATLINKS = re.compile(r'href="/wiki/Category:([^"#?]+)"')


def parents(name):
    """A category's own categories (its page's foot): where a museum's P373 is a part of its main one."""
    t = page('Category:' + name)
    a = t.find('id="catlinks"')
    return [unq(c) for c in CATLINKS.findall(t[a:])] if a >= 0 else []


def inside_cats(cats, depth=3):
    """The categories' subcategories about the inside, three levels down, best first."""
    seen, out, frontier = set(cats), [], list(cats)
    for _ in range(depth):
        nxt = []
        for c in frontier:
            for s in category(c)[0]:
                if s in seen:
                    continue
                seen.add(s)
                if INSIDE.search(s) and not NOT_INSIDE.search(s) and rank(s) > -9:
                    out.append(s)
                    nxt.append(s)
        # The likeliest first, and not too many pages a museum.
        frontier = sorted(nxt, key=lambda c: -rank(c))[:12]
    return sorted(out, key=lambda c: -rank(c))


# Archival and historic photographs (the Rijksmuseum's RP-F, HA- …): not the walls as they are.
OLD_FILE = re.compile(r'\bRP-[A-Z]-|\bHA-\d|\bSK-[A-Z]-|\b1[0-8]\d\d\b|\b19[0-8]\d\b|\bc\. ?19|engraving|drawing|'
                      r'plan\b|plattegrond|section|doorsnede|postcard|ansichtkaart|lithograph|painting by', re.I)


def by_title(t, w=None, h=None):
    """A file's record from its title alone: Commons' thumbnail path is the md5 of its name."""
    u = t.replace(' ', '_')
    d = hashlib.md5(u.encode()).hexdigest()
    base = 'wikipedia/commons/thumb/' + d[0] + '/' + d[:2] + '/' + urllib.parse.quote(u)
    return {'title': t, 'w': w, 'h': h,
            'thumb': 'https://upload.wikimedia.org/' + base + '/250px-' + urllib.parse.quote(u) +
            ('.jpg' if re.search(r'\.tiff?$', t, re.I) else '')}


HIT = re.compile(r'<div class="mw-search-result-heading"><a href="/wiki/File:([^"]+)"(.*?)</li>', re.S)
SIZEWORDS = re.compile(r'(\d[\d,]*)\s*[×x]\s*(\d[\d,]*)')
LOCAL = {'FR': 'salle', 'BE': 'zaal', 'NL': 'zaal', 'DE': 'saal', 'AT': 'saal', 'CH': 'saal', 'ES': 'sala',
         'IT': 'sala', 'PT': 'sala', 'MX': 'sala', 'DK': 'sal', 'SE': 'sal', 'NO': 'sal', 'RU': 'hall'}


def search_files(cat, word):
    """Commons' own search, as its page answers anyone: files anywhere under the category with the word."""
    q = 'deepcat:"%s" %s' % (cat, word)
    url = 'https://commons.wikimedia.org/w/index.php?' + urllib.parse.urlencode(
        {'search': q, 'title': 'Special:Search', 'ns6': '1', 'limit': '60', 'fulltext': '1'})

    def run():
        txt = get(url, accept='text/html') or ''
        time.sleep(1.2)
        return txt
    t = cached('search:' + url, run)
    out = []
    for name_, rest in HIT.findall(t):
        sz = SIZEWORDS.search(re.sub(r'<[^>]+>', ' ', rest))
        w, h = (int(sz.group(1).replace(',', '')), int(sz.group(2).replace(',', ''))) if sz else (None, None)
        out.append(by_title(unq(name_), w, h))
    return out


# A reproduction of one work, as Commons titles them: "Artist - Title - Museum", "… - Google Art Project".
ARTWORK = re.compile(r'google art project|^[^-]{3,60} - [^-]{3,} - |\(\s*national gallery of art\s*\)$|'
                     r'\bMET\s+[A-Za-z]{0,4}\d|\bNGA\s+\d+|\bA\d{5}\b|\bDP\d{5,}|\bLCCN\d+|^(design|perspective|study|sketch|elevation|section|'
                     r'plan|drawing|project) (for|of)\b', re.I)
NUMBERED_ROOM = re.compile(r'\b(gallery|room|salle|saal|sala|zaal|sal|hall)\s*[a-z]?\d', re.I)


def choose(row, per):
    """The files most likely to show a gallery's walls: P5775 first, then the inside categories round-robin,
    three a category at most, the best categories first."""
    picked, seen = [], set()

    stems = {}

    def add(rec, cat, why):
        if rec['title'] in seen or not FILE_OK.search(rec['title']) or OLD_FILE.search(rec['title']):
            return False
        if ARTWORK.search(rec['title']):
            return False
        # A series ("Blue Room Bikes 5", "… 6", "… 8"): the same room, twice at most. Only a trailing
        # number makes a series: "Gallery 28, …" and "Gallery 30, …" are two rooms.
        stem = re.sub(r'(?:[\s_\-]*[\(\[]?\d+[\)\]]?)+$', '', re.sub(r'\.\w+$', '', rec['title'].lower()))
        stem = re.sub(r'[\W_]+', ' ', stem).strip()
        if stems.get(stem, 0) >= 2:
            return False
        if rec.get('w') and rec.get('h') and min(rec['w'], rec['h']) < 700:
            return False
        if NOT_INSIDE.search(rec['title']) and not INSIDE.search(rec['title']):
            return False
        seen.add(rec['title'])
        stems[stem] = stems.get(stem, 0) + 1
        picked.append(dict(rec, cat=cat, why=why))
        return True

    for t in row.get('int') or []:
        add(by_title(t), None, 'P5775')
    # The museum's own category, and its main one where its P373 is one part of it ("National Gallery of
    # Art" is filed under "National Gallery of Art (Washington, D.C.)"); then the categories of the
    # buildings it occupies (P466 on the building), for their rooms. Never a place it is in.
    own = [row['cat']] if row.get('cat') else []
    for c in list(own):
        for p in parents(c):
            if p not in own and (fold(c) in fold(p) or agree(row.get('name') or c, p) >= 0.6):
                own.append(p)
    roots = own + [c for c in row.get('homecat') or [] if c and c not in own]
    cats = inside_cats(roots) if roots else []
    # Eighteen categories at most, spread through the ranked list (a museum by room has seventy).
    spread = cats if len(cats) <= 18 else [cats[round(i * (len(cats) - 1) / 17)] for i in range(18)]
    lists = [(c, category(c)[1]) for c in spread]
    # Files in the museum's own category whose title says inside, if its subcategories gave too few.
    if roots and sum(len(l) for _, l in lists) < per:
        for c in roots:
            lists.append((c, [f for f in category(c)[1] if INSIDE.search(f['title'])]))
    # And Commons' search under the museum's main category, for galleries, rooms and the inside (its
    # numbered galleries mostly come this way: "Gallery 30, National Gallery of Art.jpg").
    if own:
        main = own[-1]
        for word in ['gallery', 'room', 'interior', LOCAL.get(row.get('cc') or '', '')]:
            if word:
                hits = [f for f in search_files(main, word) if not ARTWORK.search(f['title'])]
                if hits:
                    lists.insert(0, ('search: ' + word, hits))
    # Within a category, views of a room before photographs of one thing in it.
    name = words(row.get('name') or '') | words(row.get('label') or '')

    def view(f):
        t = f['title']
        return ((3 if NUMBERED_ROOM.search(t) else 0) + (2 if VIEWISH.search(t) else 0) +
                (1 if words(t) & name else 0) - (2 if THINGISH.search(t) else 0) -
                (3 if OUTSIDE.search(t) else 0) - (5 if ARTWORK.search(t) else 0))
    lists = [(c, sorted(l, key=lambda f: -view(f))) for c, l in lists]
    took = {c: 0 for c, _ in lists}
    i = 0
    while len(picked) < per and any(i < len(l) for _, l in lists):
        for c, l in lists:
            cap = 5 if c.startswith('search: ') else 3
            if i < len(l) and took[c] < cap and len(picked) < per and view(l[i]) >= 0 and \
                    add(l[i], None if c.startswith('search: ') else c, 'search' if c.startswith('search: ') else 'category'):
                took[c] += 1
        i += 1
    return picked, cats


OUTSIDE = re.compile(r'exterior|fa[cç]ade|\bface\b|avenue|street|\bstraat\b|\brue\b|aerial|panoram|\b360\b|night|outside|'
                     r'entrance|seen from|view from|skyline|garden|park\b|square|plaza|platz|plein|from the air|drone', re.I)
VIEWISH = re.compile(r'\broom\b|zaal|salle|\bsaal\b|\bsala\b|galler|interior|int[ée]rieur|interieur|innen|\bhall\b|'
                     r'view|overview|vista|installation|exhibition|ausstellung|tentoonstelling|exposition|wing|floor|'
                     r'level|atrium|staircase|\(\d{8,}\)', re.I)
THINGISH = re.compile(r'\bby\b|\bdoor\b [A-Z]|painting|portrait|still life|stilleven|landscape|landschap|vase|bowl|\bkom\b|'
                      r'cup\b|plate\b|dish\b|snuifdoos|reliquai|statue|sculpture|beeld\b|bust\b|detail|signature|'
                      r'\b[A-Z]{2}-[A-Z]-\d|\b[A-Z]{2}-[A-Z]{2,}-\d|\bSK-|\bBK-|\bAK-|\bNG\d|inv\.|accession', re.I)


# The reading: a vision model looks at each photograph (fetched by its own servers from Commons'
# 960 px thumbnail: Commons refuses this session's address its thumbnails) and says whether it shows the
# museum's gallery walls as they are now, their paint as it is (not the photograph's cast), the era of the
# works on them, and the room where the title or category names one.
OPENAI = 'https://api.openai.com/v1/responses'
MODEL = 'gpt-5.5'
READ_SCHEMA = {
    'type': 'object', 'additionalProperties': False,
    'required': ['walls', 'why', 'paint', 'name', 'art', 'room', 'confidence'],
    'properties': {
        'walls': {'type': 'boolean'},
        'why': {'type': 'string'},
        'paint': {'type': 'string', 'pattern': '^(white|#[0-9a-fA-F]{6})$'},
        'name': {'type': 'string'},
        'art': {'type': 'string', 'enum': ['old', '19c', 'modern', 'now', 'mixed', 'none']},
        'room': {'type': ['string', 'null']},
        'confidence': {'type': 'string', 'enum': ['high', 'medium', 'low']},
    },
}
ASK = (
    'This photograph is on Wikimedia Commons, titled "{title}", in the category "{cat}", of {museum}.\n'
    'Answer about it, as JSON:\n'
    "walls: true only if it shows the museum's own gallery walls as they are today: a room where works of art "
    'are shown, the walls clearly seen. False for an exterior, a close-up of one work or object, a historic or '
    'black-and-white photograph, a dinner or event set up in a room, a cafe, shop, office, library or store, '
    'a lobby, hall or staircase with no works on its walls, a room in another building, a drawing or plan, '
    'a period room (a historic room re-erected in the museum, panelled or papered as it was).\n'
    'why: a few words.\n'
    'paint: the colour the walls are painted (or hung with fabric) as they are in daylight, not as the '
    "photograph's light shows them: a white or off-white wall under warm or cool light is \"white\". Else "
    '"#rrggbb" for the paint itself. Judge the wall behind the works, not the works, floor or ceiling.\n'
    'name: that colour in plain words.\n'
    'art: the era of most works on those walls: old (before 1800), 19c (1800-1900), modern (1900-1970), '
    'now (after 1970), mixed, or none.\n'
    'room: the gallery or room number or name, only if the title or category names it, else null.\n'
    'confidence: high, medium or low that the paint is right.'
)


def thumb_at(f, width):
    return re.sub(r'/\d+px-', '/%dpx-' % width, f['thumb'], count=1)


def vision(f, museum):
    """One photograph's reading, cached."""
    key = 'read:' + MODEL + ':' + f['title']
    path = os.path.join(DATA, 'read', hashlib.sha1(key.encode()).hexdigest()[:20] + '.json')
    if os.path.exists(path):
        return json.load(open(path))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    text = ASK.format(title=f['title'], cat=f.get('cat') or 'none', museum=museum)
    got, width = None, None
    for width in (960, 500, 250):
        body = {'model': MODEL, 'reasoning': {'effort': 'low'},
                'input': [{'role': 'user', 'content': [{'type': 'input_text', 'text': text},
                                                        {'type': 'input_image', 'image_url': thumb_at(f, width)}]}],
                'text': {'format': {'type': 'json_schema', 'name': 'walls', 'schema': READ_SCHEMA, 'strict': True}}}
        req = urllib.request.Request(OPENAI, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'})
        wait = 5
        got = None
        for _ in range(5):
            try:
                with urllib.request.urlopen(req, timeout=180) as r:
                    d = json.load(r)
                out = [c.get('text') for o in d.get('output', []) for c in (o.get('content') or [])
                       if c.get('type') == 'output_text']
                got = json.loads(out[0]) if out else {'error': 'no answer'}
                break
            except urllib.error.HTTPError as e:
                msg = e.read()[:400].decode('utf-8', 'replace')
                if e.code in (429, 500, 502, 503):
                    time.sleep(wait)
                    wait = min(wait * 2, 60)
                    continue
                got = {'error': '%d %s' % (e.code, msg)}
                break
            except Exception as e:
                time.sleep(wait)
                wait = min(wait * 2, 60)
                got = {'error': str(e)[:200]}
        # An image the model's servers could not fetch at that size: a smaller one.
        if got and 'error' in got and ('download' in got['error'].lower() or 'image' in got['error'].lower()):
            continue
        break
    if got and 'error' not in got:
        got['model'] = MODEL
        got['w'] = width
        json.dump(got, open(path, 'w'))
    return got


def credit(title):
    """A file page's author, licence and date, as its page says them."""
    # Commons writes its ids and classes with "&#95;" for "_".
    t = page('File:' + title).replace('&#95;', '_')

    def cell(key):
        m = re.search(r'id="fileinfotpl_%s"[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>' % key, t, re.S)
        return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', m.group(1)))).strip() if m else ''
    lic = re.findall(r'<span class="licensetpl_short"[^>]*>(.*?)</span>', t, re.S)
    lic = [re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html.unescape(x))).strip() for x in lic]
    by = re.sub(r'\s*\(\s*talk\s*\|\s*contribs\s*\)', '', cell('aut'))
    by = re.sub(r'^No machine-readable author provided\.\s*(.+?)\s+assumed.*$', r'\1', by)
    return {'by': by[:140], 'date': cell('date')[:60], 'lic': next((x for x in lic if x), ''),
            'page': WIKI + urllib.parse.quote('File:' + title.replace(' ', '_'))}


def hand_rows(idx, museums, kept=None):
    """scripts/finishes_hand.json: each museum's photographs as they were read, with their credits — what
    build_finishes.py writes finishes.json from. Never a photograph, only what was read off it."""
    out = {'note': ("Each museum's photographs of its galleries on Wikimedia Commons, as they were read for the "
                    "colour of its walls (scripts/fetch_interior_photos.py: found through its Wikidata item's "
                    "Commons category; read by %s, which fetched each from Commons itself; credits from each "
                    "file's page). use: it shows the museum's gallery walls as they are now. paint: \"white\" or "
                    "the paint's colour. art: the era of the works on those walls. No photograph is copied." % MODEL),
           'museums': {}}
    for m in museums:
        row = idx.get(m['slug']) or {}
        photos = []
        for f in row.get('files') or []:
            r = f.get('read') or {}
            if not r:
                continue
            use = bool(r.get('walls')) and r.get('confidence') != 'low'
            if not use:
                # Looked at and not used: why, in the model's words.
                photos.append({'t': f['title'], 'use': False, 'why': r.get('why')})
                continue
            photos.append({'t': f['title'], 'cat': f.get('cat'), 'use': True, 'why': r.get('why'),
                           'paint': r.get('paint'), 'name': r.get('name'), 'art': r.get('art'), 'room': r.get('room'),
                           'conf': r.get('confidence'), 'u': f.get('page'), 'by': f.get('by'), 'lic': f.get('lic'),
                           'd': f.get('date')})
        if photos:
            out['museums'][m['slug']] = {'qid': row.get('qid'), 'cat': row.get('cat'), 'read': row.get('read_on'),
                                         'model': MODEL, 'photos': photos}
        elif kept and m['slug'] in kept:
            # Read in an earlier run, not this one: kept as it was.
            out['museums'][m['slug']] = kept[m['slug']]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--only', nargs='*', default=['wd', 'files', 'read', 'credit', 'hand'])
    ap.add_argument('--slug', nargs='*')
    ap.add_argument('--per', type=int, default=20)
    ap.add_argument('--jobs', type=int, default=4)
    ap.add_argument('--today')
    ap.add_argument('--again', action='store_true', help='read museums the hand file already has, too')
    a = ap.parse_args()
    hand_path = os.path.join(ROOT, 'scripts', 'finishes_hand.json')
    kept = json.load(open(hand_path)).get('museums', {}) if os.path.exists(hand_path) else {}
    from concurrent.futures import ThreadPoolExecutor
    museums = json.load(open(os.path.join(ROOT, 'docs', 'v2', 'museums.json')))['museums']
    every = museums
    if a.slug:
        museums = [m for m in museums if m['slug'] in a.slug]
    os.makedirs(DATA, exist_ok=True)
    idx_path = os.path.join(DATA, 'index.json')
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    today = a.today or time.strftime('%Y-%m-%d', time.gmtime())

    import threading
    lock = threading.Lock()

    def save():
        with lock:
            tmp = idx_path + '.tmp'
            json.dump(idx, open(tmp, 'w'), indent=1, ensure_ascii=False)
            os.replace(tmp, idx_path)

    def one(n, m):
        # A museum read in an earlier run (its row in the hand file, none here) is not read again
        # unless asked: the weekly run reads only museums new to museums.json.
        if m['slug'] in kept and not (idx.get(m['slug']) or {}).get('files') and not a.again and not a.slug:
            return
        # Each museum's row worked on as a copy and put back whole, so a save never sees it half done.
        with lock:
            row = json.loads(json.dumps(idx.get(m['slug']) or {'name': m['name']}))
        row['cc'] = (m.get('where') or '').rsplit(', ', 1)[-1][:2]
        try:
            if 'wd' in a.only and 'qid' not in row:
                row.update(find_item(m) or {'qid': None})
            if 'files' in a.only and row.get('qid') and 'files' not in row:
                row['files'], row['cats'] = choose(row, a.per)
            if 'read' in a.only:
                todo = [f for f in row.get('files') or [] if not f.get('read')]
                with ThreadPoolExecutor(max_workers=4) as readers:
                    for f, r in zip(todo, readers.map(lambda f: vision(f, m['name']), todo)):
                        if r and 'error' not in r:
                            f['read'] = r
                            row['read_on'] = today
            if 'credit' in a.only:
                for f in row.get('files') or []:
                    r = f.get('read') or {}
                    if r.get('walls') and r.get('confidence') != 'low' and not f.get('lic'):
                        f.update(credit(f['title']))
        except Exception as e:  # one museum's failure is said, the rest go on
            row['error'] = str(e)[:200]
        with lock:
            idx[m['slug']] = row
        used = sum(1 for f in row.get('files') or [] if (f.get('read') or {}).get('walls'))
        print('%3d %-58s %-10s %2d files, %2d of walls %s' % (n, m['slug'][:58], row.get('qid'),
                                                               len(row.get('files') or []), used, row.get('error', '')),
              flush=True)

    # A few museums at once (Commons' pages are paced in each).
    with ThreadPoolExecutor(max_workers=max(1, a.jobs)) as pool:
        for k, fut in enumerate([pool.submit(one, n, m) for n, m in enumerate(museums)]):
            fut.result()
            if k % 4 == 3:
                save()
    save()
    if 'hand' in a.only:
        hand = hand_rows(idx, every, kept)
        path = hand_path
        # A line a photograph, so a week's reading shows as the lines it changed.
        rows = list(hand['museums'].items())
        lines = ['{"note": %s,' % json.dumps(hand['note'], ensure_ascii=False), ' "museums": {']
        for i, (slug, row) in enumerate(rows):
            head = json.dumps({k: v for k, v in row.items() if k != 'photos'}, ensure_ascii=False)
            lines.append('  %s: %s, "photos": [' % (json.dumps(slug), head[:-1]))
            ph = row.get('photos') or []
            lines += ['   %s%s' % (json.dumps(x, ensure_ascii=False), ',' if j < len(ph) - 1 else '') for j, x in enumerate(ph)]
            lines.append('  ]}' + (',' if i < len(rows) - 1 else ''))
        lines.append(' }}')
        with open(path, 'w') as fh:
            fh.write('\n'.join(lines) + '\n')
        print('finishes_hand.json: %d museums read' % len(hand['museums']))


if __name__ == '__main__':
    main()
