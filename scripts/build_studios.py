#!/usr/bin/env python3
"""The studios: where each saved artist worked, as the record has it — docs/v2/studios.json.

The artist, 1 Oct 2026: "Give a site to artist studios to catalogue individual artists with
specific locations".

Reads what scripts/fetch_studios.py cached in data/studios/ (private) and the hand table
scripts/studios_hand.json (each entry with its sources), and writes one small public file:

  artists   the catalogue: every saved artist with at least one place, most saved first —
            [artsy slug, name, Wikidata item, born, died, saved works, [rows in time order], span]
  studios   one row a place an artist worked or lived, in time order within the artist:
            kind     studio · house (a building that names the artist: occupant, owner, named
                     after) · worked (P937 work location) · lived (P551 residence) · lived and worked
            name, place, ll [lat, lon], pr (exact · street · district · town), why (the privacy
            reason, in words), y0, y1, yt (the years in words), key + km (the nearest city of
            cities.json, for flying there), q (the Wikidata item), photos (Commons files: f, by,
            lic, of — shown live, never copied), said (quotations: q, by, in, url), src (sources),
            works ([saved work id, how]: how 'record' — its own history says it was made in this
            town; 'site' — Painted here (sites.json) puts its painting within 25 km; 'dated' — its
            date falls in this place's years and in no other dated place of the artist's)
  marks     the globe's marks: [lat, lon, label, aria, [rows], pr] — an exact studio its own mark,
            named by the artist; the town-level places of many artists one mark a town
  explorations  one a catalogued artist with two places or more, each place a stop, in time order

Privacy (the artist's rule for this layer, 1 Oct 2026): a studio that is now public — a museum, a
house museum, a listed building, one with an official website for visits — is placed exactly. A
historic studio of an artist dead fifty years or more (died 1976 or before) is placed where its
item puts it; so is a studio (never a home) of an artist dead thirty years. Anything else of a
living or recently dead artist — a residence, a private studio — is placed at its town only (its
item's administrative town, else the nearest city of cities.json within 40 km), and said so, and
shows no photograph and no quotation that would place it closer. An artist with no death date
and born after 1900 is taken as living.

Same bytes every run. No network.

    python3 scripts/build_studios.py
"""
import collections, glob, html, json, math, os, re, unicodedata, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'docs', 'v2')
D = os.path.join(ROOT, 'data', 'studios')
HAND = os.path.join(ROOT, 'scripts', 'studios_hand.json')
OUT = os.path.join(V2, 'studios.json')
NOW = 2026

NOTE = ("The studios (docs/v2/studios.js): where each saved artist worked, from Wikidata (CC0; P937 work "
        "location, P551 residence, and the buildings that name the artist: P466 occupant, P127 owned by, "
        "P138 named after), Wikipedia (CC BY-SA, quoted with its link) and a hand table with its sources "
        "(scripts/studios_hand.json). Photographs are Wikimedia Commons files under their own licences, shown "
        "live from Commons, never copied. Privacy: public studios exact; historic studios of artists long dead "
        "where their item puts them; any other studio or home of a living or recently dead artist at its town "
        "only. Written by scripts/build_studios.py.")


def load(path, default=None):
    if not os.path.exists(path):
        return default
    return json.load(open(path))


def fold(s):
    s = unicodedata.normalize('NFD', str(s or ''))
    return ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()


def year(v):
    m = re.match(r'^(-?)(\d{1,4})', v or '')
    if not m or m.group(1):
        return None
    y = int(m.group(2))
    return y if 1000 <= y <= NOW else None


def point(v):
    m = re.match(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)', v or '')
    return (round(float(m.group(2)), 5), round(float(m.group(1)), 5)) if m else None


def dist(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371 * math.asin(min(1, math.sqrt(h)))


def commons(url):
    if not url or 'Special:FilePath/' not in url:
        return None
    return urllib.parse.unquote(url.split('Special:FilePath/', 1)[1]).replace('_', ' ')


def strip(h):
    t = re.sub(r'<[^>]+>', '', h or '')
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()


def surname(name):
    w = name.split()
    k = len(w) - 1
    while k > 0 and w[k - 1].lower() in ('de', 'van', 'von', 'da', 'di', 'del', 'der', 'le', 'la'):
        k -= 1
    return ' '.join(w[k:])


def sentences(text):
    text = re.sub(r'\n+=+[^=\n]+=+\n*', '\n', text or '')
    out = []
    for para in text.split('\n'):
        out += [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z“"(])', para) if s.strip()]
    return out


# What an item is, by its classes' English labels.
REGION = {'country', 'sovereign state', 'continent', 'state of the united states', 'region of france',
          'region of italy', 'autonomous community of spain', 'province of spain', 'province of italy',
          'department of france', 'county of england', 'ceremonial county of england', 'state of germany',
          'canton of switzerland', 'state', 'federated state', 'province', 'region', 'county',
          'county of new york', 'county of california', 'county of pennsylvania', 'administrative region',
          'historical region', 'geographic region', 'cultural region', 'state of mexico', 'state of brazil',
          'state of australia', 'province of canada', 'oblast of russia', 'federal subject of russia',
          'constituent country of the united kingdom', 'country within the united kingdom', 'island country',
          'archipelago', 'mountain range', 'ocean', 'sea', 'river', 'peninsula', 'metropolitan area',
          'land of austria', 'region of england', 'unitary authority of england', 'kingdom', 'empire',
          'historical country', 'former administrative territorial entity', 'state of india',
          'prefecture of japan', 'province of the netherlands', 'autonomous region', 'voivodeship of poland'}
STREETY = ('street', 'avenue', 'boulevard', 'riverfront', 'quay', 'road', 'lane', 'alley', 'rue', 'square')
DISTRICTY = ('arrondissement', 'neighborhood', 'neighbourhood', 'quarter', 'district', 'ward', 'rione',
             'quartier', 'suburb', 'section of', 'hamlet')
BUILT = ('villa', 'house', 'building', 'castle', ' mas', 'mas ', 'studio', 'atelier', 'mansion', 'palace',
         'palazzo', 'farmhouse', 'manor', 'apartment', 'hôtel particulier', 'château', 'tower', 'loft', 'barn',
         'residence', 'cottage', 'estate', 'glyptotheque', 'hotel', 'chalet', 'townhouse', 'row house')
REJECT = ('street', 'avenue', 'school', 'lycée', 'educational', 'crater', 'park', 'stop', 'station', 'statue',
          'sculpture', 'monument', 'memorial', 'plaque', 'mural', 'lake', 'asteroid', 'organization', 'award',
          'exhibition', 'hospital', 'bridge', 'fountain', 'ship', 'company', 'university', 'college', 'library',
          'theatre', 'theater', 'cinema', 'square', 'garden', 'roundabout', 'traffic circle', 'road', 'boulevard',
          'institut', 'painting', 'work of art', 'artwork', 'film', 'promenade', 'reservoir', 'archive', 'prize',
          'foundation', 'tram', 'bus', 'municipality', 'commune', 'city', 'town', 'village', 'gallery')
PUBLIC = ('museum', 'glyptotheque', 'historic house museum', 'house museum', 'tourist attraction',
          'cultural property', 'national historic landmark', 'heritage', 'monument historique')
STUDIO_RE = re.compile(r'\b(studios?|atelier|ateliers|estudio|taller|werkstatt|factory)\b', re.I)
HOME_RE = re.compile(r'\b(house|home|maison|casa|haus|huis|villa|mas|residence|birthplace)\b', re.I)


def main():
    artists = load(os.path.join(D, 'artists.json'), {})
    claims = load(os.path.join(D, 'claims.json'), [])
    refs = load(os.path.join(D, 'refs.json'), [])
    prow = load(os.path.join(D, 'places.json'), [])
    srow = load(os.path.join(D, 'stated.json'), [])
    brow = load(os.path.join(D, 'buildings.json'), [])
    drow = load(os.path.join(D, 'details.json'), [])
    wiki = load(os.path.join(D, 'wiki.json'), {})
    files = load(os.path.join(D, 'files.json'), {})
    artwiki = load(os.path.join(D, 'artist_wiki.json'), {})
    hand = load(HAND, {'studios': [], 'drop': []})
    towns = load(os.path.join(V2, 'cities.json'))['towns']
    finding = load(os.path.join(V2, 'finding.json'))
    sites = load(os.path.join(V2, 'sites.json'), {'sites': []})

    def nearest(ll):
        best, bk = None, 1e9
        for t in towns:
            k = dist(ll, (t[3], t[4]))
            if k < bk:
                best, bk = t, k
        return best, bk

    # ---- the saved works, by artist ----
    works_by = collections.defaultdict(list)
    saved = collections.Counter()
    for w in finding['w']:
        for a in str(w[2]).split(', '):
            saved[a] += 1
            m = re.search(r'\b(1[0-9]{3}|20[0-2][0-9])\b', str(w[3] or ''))
            works_by[a].append((w[0], int(m.group(1)) if m else None))
    made_at = {}
    for p in sorted(glob.glob(os.path.join(V2, 'histories', '*.json'))):
        h = json.load(open(p))
        for e in h.get('events', []):
            if e.get('k') == 'made' and e.get('p'):
                made_at[h['id']] = e['p']
                break
    site_at = collections.defaultdict(list)
    for s in sites.get('sites', []):
        if s.get('w') and s.get('ll') and s.get('pr') != 'town':
            site_at[s['w']].append(tuple(s['ll']))

    # ---- Wikidata, indexed ----
    ref_by = collections.defaultdict(list)
    stated = {r['x']: r['label'] for r in srow}
    for r in refs:
        ref_by[r['st']].append(r)
    place = {}
    for r in prow:
        p = place.setdefault(r['pl'], {'label': None, 'cls': set(), 'country': None, 'll': None, 'region': False})
        p['label'] = p['label'] or r.get('label')
        if r.get('clsLabel'):
            p['cls'].add(r['clsLabel'].lower())
        p['country'] = p['country'] or r.get('inLabel')
        p['ll'] = p['ll'] or point(r.get('coord'))
        if r.get('iso') or r.get('sub'):
            p['region'] = True
    item = {}
    for r in drow:
        d = item.setdefault(r['s'], {'label': None, 'cls': set(), 'll': None, 'in': None, 'inll': None,
                                     'img': set(), 'inner': set(), 'heritage': False, 'site': None,
                                     'inception': None, 'enwiki': None, 'desc': None, 'addr': None})
        d['label'] = d['label'] or r.get('label') or r.get('labelfr')
        d['desc'] = d['desc'] or r.get('desc')
        if r.get('clsLabel'):
            d['cls'].add(r['clsLabel'].lower())
        d['ll'] = d['ll'] or point(r.get('coord'))
        if r.get('in') and not d['in']:
            d['in'], d['inll'] = r.get('inLabel'), point(r.get('inCoord'))
        for k in ('img', 'inner'):
            if r.get(k):
                d[k].add(commons(r[k]))
        d['heritage'] = d['heritage'] or bool(r.get('heritage'))
        d['site'] = d['site'] or r.get('site')
        d['inception'] = d['inception'] or year(r.get('inception'))
        d['enwiki'] = d['enwiki'] or r.get('enwiki')
        d['addr'] = d['addr'] or r.get('addr')

    def is_region(p):
        return p['region'] or bool(p['cls'] & REGION) or any(c.startswith('county') for c in p['cls'])

    def has(cls, words):
        return any(any(w in c for w in words) for c in cls)

    def is_building(d):
        text = ' '.join([d.get('label') or '', d.get('desc') or ''])
        if not (has(d['cls'], BUILT) or STUDIO_RE.search(text)):
            return False
        if d['cls'] and all(any(w in c for w in REJECT) for c in d['cls']) and not STUDIO_RE.search(text):
            return False
        # A museum named after an artist is not their studio unless it says it was their house or studio.
        if has(d['cls'], ('museum',)) and not has(d['cls'], BUILT) and not (STUDIO_RE.search(text) or HOME_RE.search(text)):
            return False
        return True

    def is_public(d):
        return bool(has(d['cls'], PUBLIC) or d['heritage'] or d['site'])

    def living(a):
        return not a.get('death') and not (a.get('birth') and a['birth'] < 1900)

    def died_by(a, y):
        return bool(a.get('death') and a['death'] <= y)

    def ref_list(sts):
        out, seen = [], set()
        for st in sts:
            for r in ref_by.get(st, []):
                if r.get('refurl') and r['refurl'] not in seen:
                    seen.add(r['refurl'])
                    out.append({'name': urllib.parse.urlparse(r['refurl']).netloc.replace('www.', ''), 'url': r['refurl']})
                if r.get('stated') and r['stated'] in stated and stated[r['stated']] not in seen:
                    seen.add(stated[r['stated']])
                    out.append({'name': stated[r['stated']], 'url': 'https://www.wikidata.org/wiki/' + r['stated']})
        return out[:4]

    drop = {(x['artist'], x['place']): x['why'] for x in hand.get('drop', [])}

    # ---- the rows, per artist ----
    rows = collections.defaultdict(list)          # qid -> [row]
    by_claim = collections.defaultdict(lambda: {'props': set(), 'y': [], 'sts': []})
    for r in claims:
        if r.get('rank', '').endswith('DeprecatedRank') or not r.get('pl', '').startswith('Q'):
            continue
        g = by_claim[(r['a'], r['pl'])]
        g['props'].add(r['prop'])
        g['sts'].append(r['st'])
        for k in ('start', 'end', 'pit'):
            y = year(r.get(k))
            if y:
                g['y'].append((k, y))

    def years_of(ys):
        starts = [y for k, y in ys if k in ('start', 'pit')]
        ends = [y for k, y in ys if k in ('end', 'pit')]
        y0 = min(starts) if starts else None
        y1 = max(ends) if ends else None
        return y0, y1

    def wd_src(q, what):
        return {'name': 'Wikidata ' + q + (' · ' + what if what else ''), 'url': 'https://www.wikidata.org/wiki/' + q}

    def town_of(d, ll):
        """A private place's town: its item's administrative town, else the nearest city within 40 km."""
        if d and d.get('in') and d.get('inll') and dist(d['inll'], ll) < 40:
            return d['in'], d['inll']
        t, k = nearest(ll)
        if k <= 40:
            return t[1], (t[3], t[4])
        return None, None

    for (a, pl), g in sorted(by_claim.items()):
        art = artists.get(a)
        if not art or (a, pl) in drop:
            continue
        p = place.get(pl)
        d = item.get(pl)
        kind = 'lived and worked' if len(g['props']) == 2 else ('worked' if 'P937' in g['props'] else 'lived')
        y0, y1 = years_of(g['y'])
        src = [wd_src(a, ' · '.join(sorted({'P937': 'work location', 'P551': 'residence'}[x] for x in g['props'])))]
        src += ref_list(g['sts'])
        if d and d['ll'] and is_building(d):
            rows[a].append({'from': 'building', 'q': pl, 'd': d, 'how': g['props'], 'kind0': kind,
                            'y0': y0, 'y1': y1, 'src': src})
            continue
        if not p or not p['ll'] or is_region(p):
            continue
        pr = 'street' if has(p['cls'], STREETY) else 'district' if has(p['cls'], DISTRICTY) else 'town'
        rows[a].append({'from': 'claim', 'q': pl, 'name': p['label'], 'place': p['label'], 'country': p['country'],
                        'll': p['ll'], 'pr': pr, 'kind': kind, 'y0': y0, 'y1': y1, 'src': src})

    seen_b = set()
    bl = collections.defaultdict(lambda: {'how': set(), 'y': []})
    for r in brow:
        g = bl[(r['a'], r['s'])]
        g['how'].add(r['how'])
        for k in ('start', 'end'):
            y = year(r.get(k))
            if y:
                g['y'].append((k, y))
    for (a, s), g in sorted(bl.items()):
        art = artists.get(a)
        d = item.get(s)
        if not art or not d or not d['ll'] or (a, s) in drop or not is_building(d):
            continue
        if g['how'] == {'P138'}:
            # Named after the artist, and nothing more: only when the artist's own record has them
            # working or living within 30 km, or the item says it was their studio.
            near = any(x.get('ll') and dist(x['ll'], d['ll']) < 30 for x in rows[a] if x['from'] == 'claim')
            text = (d['label'] or '') + ' ' + (d['desc'] or '')
            if not (near or STUDIO_RE.search(text)):
                continue
        y0, y1 = years_of(g['y'])
        what = ' · '.join(sorted({'P466': 'occupant', 'P127': 'owned by', 'P138': 'named after'}[h] for h in g['how']))
        rows[a].append({'from': 'building', 'q': s, 'd': d, 'how': g['how'], 'kind0': None, 'y0': y0, 'y1': y1,
                        'src': [wd_src(s, what)]})

    # The hand table: what Wikidata does not link, each with its sources.
    by_name = {v['name']: q for q, v in artists.items()}
    for h in hand.get('studios', []):
        a = by_name.get(h['artist'])
        if not a:
            continue
        d = item.get(h.get('q')) if h.get('q') else None
        rows[a].append({'from': 'hand', 'q': h.get('q'), 'd': d, 'hand': h, 'how': set(), 'kind0': None,
                        'y0': h.get('y0'), 'y1': h.get('y1'), 'src': h.get('src', [])})

    # ---- each row made whole: kind, point, privacy, pictures, words ----
    out_rows = []
    cat = []
    for a in sorted(rows, key=lambda q: (-saved[artists[q]['name']], artists[q]['name'])):
        art = artists[a]
        name = art['name']
        made = []
        for x in rows[a]:
            h = x.get('hand') or {}
            d = x.get('d')
            if d:
                text = ' '.join([d['label'] or '', d['desc'] or ''] + sorted(d['cls']))
                kind = h.get('kind') or ('studio' if STUDIO_RE.search(text) else 'house')
                ll = d['ll']
                public = is_public(d) or h.get('public')
                if public:
                    pr, why = 'exact', 'open to visitors' if has(d['cls'], ('museum', 'glyptotheque')) or d['site'] else 'a listed building'
                elif died_by(art, NOW - 50):
                    pr, why = 'exact', 'a historic place: the artist died in %d' % art['death']
                elif kind == 'studio' and died_by(art, NOW - 30):
                    pr, why = 'exact', 'a historic studio: the artist died in %d' % art['death']
                else:
                    pr, why = 'town', ('the studio’s address is private' if kind == 'studio' else 'a home: its address is private')
                label = h.get('name') or d['label'] or ''
                inn = d.get('in')
                if pr == 'town':
                    tn, tll = town_of(d, ll)
                    if not tn:
                        continue
                    row = {'kind': kind, 'name': tn, 'place': tn, 'll': list(tll), 'pr': 'town', 'why': why,
                           'q': None}
                else:
                    row = {'kind': kind, 'name': label, 'place': h.get('place') or inn or '', 'll': list(ll), 'pr': pr,
                           'why': why, 'q': x['q']}
                    if d.get('inception'):
                        row['built'] = d['inception']
                    photos = []
                    for f, of in [(f, 'now') for f in sorted(d['img'])][:2] + [(f, 'inside') for f in sorted(d['inner'])][:1]:
                        fm = files.get(f) or {}
                        if fm.get('missing'):
                            continue
                        when = of
                        fy = year(strip(fm.get('date') or '')[:4]) if fm.get('date') else None
                        if fy and fy < 1960:
                            when = 'then'
                        photos.append({'f': f, 'by': strip(fm.get('artist'))[:80] or None, 'lic': fm.get('licence'),
                                       'of': when})
                    if photos:
                        row['photos'] = photos
                    said = []
                    w = wiki.get(urllib.parse.unquote((d.get('enwiki') or '').rsplit('/', 1)[-1]).replace('_', ' '))
                    if w and w.get('extract'):
                        ss = sentences(w['extract'])
                        q = ' '.join(ss[:2])
                        if len(q) > 360:
                            q = ss[0]
                        said.append({'q': q, 'by': 'Wikipedia', 'in': w.get('title'), 'url': w.get('url')})
                    said += h.get('said', [])
                    if said:
                        row['said'] = said
                    if d.get('site'):
                        x['src'] = x['src'] + [{'name': urllib.parse.urlparse(d['site']).netloc.replace('www.', ''), 'url': d['site']}]
            elif h:
                row = {'kind': h.get('kind', 'studio'), 'name': h.get('name') or h.get('place'), 'place': h.get('place'),
                       'll': h['ll'], 'pr': h.get('pr', 'town'), 'why': h.get('why') or 'only the town is given', 'q': None}
                if h.get('said'):
                    row['said'] = h['said']
            else:
                pr = x['pr']
                why = 'the record names the town only'
                ll = x['ll']
                nm = x['name']
                if pr in ('street', 'district') and not died_by(art, NOW - 50):
                    t, k = nearest(ll)
                    if k > 40:
                        continue
                    nm, ll, pr = t[1], (t[3], t[4]), 'town'
                    why = 'only the town is given: the address is private'
                elif pr == 'street':
                    why = 'the street, as the record gives it'
                elif pr == 'district':
                    why = 'the district, as the record gives it'
                row = {'kind': x['kind'], 'name': nm, 'place': nm, 'll': list(ll), 'pr': pr, 'why': why, 'q': x['q']}
                if x.get('country'):
                    row['country'] = x['country']
            row['kind'] = row['kind'] if not x.get('kind0') or row['kind'] == 'studio' else row['kind']
            row['y0'], row['y1'] = x['y0'], x['y1']
            if h.get('yt'):
                row['yt'] = h['yt']
            row['src'] = x['src'] + ([] if x['from'] != 'building' or not x.get('kind0') else [])
            row['_from'] = x['from']
            made.append(row)

        # A town of the record with a building of the artist's in it is that building.
        keep = []
        for r in made:
            if r['_from'] == 'claim' and r['pr'] == 'town':
                inside = [b for b in made if b is not r and b['_from'] != 'claim' and b['pr'] != 'town' and dist(b['ll'], r['ll']) < 15]
                if inside:
                    for b in inside:
                        if b['y0'] is None and r['y0'] is not None:
                            b['y0'], b['y1'] = r['y0'], r['y1']
                        b['src'] = b['src'] + [s for s in r['src'] if s not in b['src']]
                    continue
            # Two rows of one place, the same town (a private building and the record's town): one.
            twin = [k for k in keep if k['pr'] == 'town' and r['pr'] == 'town' and dist(k['ll'], r['ll']) < 2]
            if twin:
                k = twin[0]
                k['src'] = k['src'] + [s for s in r['src'] if s not in k['src']]
                if k['y0'] is None:
                    k['y0'], k['y1'] = r['y0'], r['y1']
                if r['kind'] in ('studio', 'house') and k['kind'] not in ('studio', 'house'):
                    k['kind'], k['why'] = r['kind'], r['why']
                elif r['kind'] != k['kind'] and {r['kind'], k['kind']} == {'worked', 'lived'}:
                    k['kind'] = 'lived and worked'
                if r.get('said'):
                    k['said'] = (k.get('said') or []) + r['said']
                continue
            keep.append(r)
        made = keep
        if not made:
            continue
        # Time order: dated first by their first year, the rest after in the record's order.
        made.sort(key=lambda r: (r['y0'] is None and r['y1'] is None, r['y0'] or r['y1'] or 0))

        # The artist's own article: a sentence that says "studio" and names this place.
        aw = artwiki.get(a) or {}
        ss = [s for s in sentences(aw.get('text', '')) if STUDIO_RE.search(s) and 30 < len(s) < 420]
        for r in made:
            if r['pr'] == 'town' and r['kind'] in ('studio', 'house') and r.get('why', '').endswith('private'):
                pass   # a private studio's sentence would place it closer than its town: only the town's name
            words = [r['place']] if r.get('place') else []
            hit = [s for s in ss if any(w and re.search(r'\b' + re.escape(w) + r'\b', s) for w in words)]
            if r['pr'] == 'town' and r.get('why', '').endswith('private'):
                hit = [s for s in hit if not re.search(r'\d+\s+[A-Z][a-z]+ (Street|Avenue|Road|Lane)', s)]
            if hit:
                r['said'] = (r.get('said') or []) + [{'q': hit[0], 'by': 'Wikipedia', 'in': aw.get('title'), 'url': aw.get('url')}]

        # Works made there.
        dated = [r for r in made if r['y0'] or r['y1']]
        for r in made:
            r['works'] = []
        for wid, wy in works_by.get(name, []):
            claimed = set()
            for i, r in enumerate(made):
                if made_at.get(wid) and made_at[wid] == nearest(r['ll'])[0][0]:
                    r['works'].append([wid, 'record'])
                    claimed.add(i)
                elif any(dist(ll, r['ll']) < 25 for ll in site_at.get(wid, [])):
                    r['works'].append([wid, 'site'])
                    claimed.add(i)
            if claimed or not wy:
                continue
            inside = [r for r in dated if (r['y0'] or r['y1']) <= wy <= (r['y1'] or r['y0'])]
            if len(inside) == 1:
                inside[0]['works'].append([wid, 'dated'])

        base = len(out_rows)
        for r in made:
            t, k = nearest(r['ll'])
            r['key'], r['km'] = t[0], round(k, 1)
            if r['y0'] and r['y1'] and r['y0'] != r['y1']:
                r.setdefault('yt', '%d–%d' % (r['y0'], r['y1']))
            elif r['y0'] and not r['y1']:
                r.setdefault('yt', 'from %d' % r['y0'])
            elif r['y1'] and not r['y0']:
                r.setdefault('yt', 'until %d' % r['y1'])
            elif r['y0']:
                r.setdefault('yt', str(r['y0']))
            r['a'] = len(cat)
            r['id'] = 'st-%s-%d' % (art['slug'], len(out_rows) - base)
            del r['_from']
            for k2 in [k2 for k2, v in r.items() if v in (None, [], '')]:
                del r[k2]
            out_rows.append(r)
        ys = [y for r in made for y in (r.get('y0'), r.get('y1')) if y]
        span = ('%d–%d' % (min(ys), max(ys)) if ys and min(ys) != max(ys) else str(ys[0]) if ys else '')
        cat.append([art['slug'], name, a, art.get('birth'), art.get('death'), saved[name],
                    list(range(base, len(out_rows))), span])

    # ---- the globe's marks ----
    marks = []
    towns_m = collections.OrderedDict()
    for i, r in enumerate(out_rows):
        if r['pr'] != 'town':
            nm = cat[r['a']][1]
            marks.append([r['ll'][0], r['ll'][1], surname(nm), nm + '’s ' + (r['kind'] if r['kind'] in ('studio', 'house') else 'place') + ', ' + (r.get('name') or ''), [i], r['pr']])
        else:
            k = (round(r['ll'][0], 2), round(r['ll'][1], 2))
            towns_m.setdefault(k, []).append(i)
    for (lat, lon), ids in towns_m.items():
        ids.sort(key=lambda i: (-cat[out_rows[i]['a']][5], cat[out_rows[i]['a']][1]))
        first = cat[out_rows[ids[0]]['a']][1]
        n = len({out_rows[i]['a'] for i in ids})
        label = surname(first) + (' +%d' % (n - 1) if n > 1 else '')
        aria = out_rows[ids[0]]['place'] + ': ' + ', '.join(sorted({cat[out_rows[i]['a']][1] for i in ids})[:6]) + (' and others' if n > 6 else '')
        marks.append([lat, lon, label, aria, ids, 'town'])
    # The most saved first: they are named first when there is room.
    marks.sort(key=lambda m: (-max(cat[out_rows[i]['a']][5] for i in m[4]), m[5] == 'town', m[2]))

    # ---- one exploration an artist ----
    explorations = []
    for c in cat:
        rs = [out_rows[i] for i in c[6]]
        stops, last = [], None
        for i, r in zip(c[6], rs):
            if last is not None and stops and stops[-1]['w'] == r['place']:
                stops[-1]['o'].append(i)
                continue
            stops.append({'key': r['key'], 'll': r['ll'], 'y': r.get('y0') or r.get('y1') or 0, 'w': r.get('place') or r.get('name'), 'o': [i]})
            last = r
        if len(stops) < 2:
            continue
        names = []
        for s in stops:
            if s['w'] not in names:
                names.append(s['w'])
        title = surname(c[1]) + ': ' + ', '.join(names[:3]) + (' …' if len(names) > 3 else '')
        explorations.append({'id': 'studios-' + c[0], 'title': title, 'artist': c[1], 'n': len(stops), 'stops': stops})

    data = {'note': NOTE, 'artists': cat, 'studios': out_rows, 'marks': marks, 'explorations': explorations}
    txt = json.dumps(data, ensure_ascii=False, separators=(',', ':'), sort_keys=False)
    open(OUT, 'w').write(txt)

    # What the fetcher should read next: the buildings' articles and the photographs.
    want_wiki = sorted({urllib.parse.unquote(d['enwiki'].rsplit('/', 1)[-1]).replace('_', ' ')
                        for d in item.values() if d.get('enwiki')})
    want_files = sorted({f for r in out_rows for f in []} | {f for d in item.values() for f in (d['img'] | d['inner']) if f})
    json.dump(want_wiki, open(os.path.join(D, 'want_wiki.json'), 'w'))
    json.dump(want_files, open(os.path.join(D, 'want_files.json'), 'w'))

    pr = collections.Counter(r['pr'] for r in out_rows)
    kinds = collections.Counter(r['kind'] for r in out_rows)
    all_saved = len([a for a in saved])
    print(f'{len(cat)} of {all_saved} saved artists catalogued ({len(artists)} with a Wikidata item); '
          f'{len(out_rows)} places; {dict(pr)}; {dict(kinds)}; {len(marks)} marks; '
          f'{len(explorations)} explorations; {sum(len(r.get("works", [])) for r in out_rows)} works placed; '
          f'{sum(1 for r in out_rows if r.get("photos"))} with photographs; {len(txt) // 1024} KB')


if __name__ == '__main__':
    main()
