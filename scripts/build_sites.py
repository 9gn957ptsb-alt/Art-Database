#!/usr/bin/env python3
"""Write docs/v2/sites.json — "Painted here": where works were painted, as the record documents it.

Artist, 1 Oct 2026, with van Gogh's *Tree Roots*, a postcard of the rue Daubigny with the painting
laid into it, and the street today: "Evidence of where exactly plein air paintings were made … is a
really great way to extend a line of inquiry into a specific artwork or artist. Find all other
instances of documented sites that correspond to a specific artwork and use them as new
explorations available for the viewer. Photographs of specific sites preferred in addition to any
articles or commentary on the photograph of the site or painting."

Reads data/sites/ (fetch_painting_sites.py: Wikidata, CC0; the Commons files' authors and licences;
the English Wikipedia articles' text, CC BY-SA), scripts/sites_hand.json (sites documented by hand,
each with its sources), and the public files (histories/ for the saved works, cities.json). Nothing
in the output is invented: a point is Wikidata's (or, by hand, a source's), a quotation is the
source's own sentence, a photograph is a Commons file with its author and licence.

Precision (`pr`):
  view    Wikidata's "coordinates of the point of view" (P1259): where the painter stood.
  site    what the painting shows (P180) or where it was made (P1071), when that is a place one can
          stand at — a building, a bridge, a street, a garden, a cliff, a mountain … — at that
          place's own coordinates (P625). The ring is on the thing painted, not the easel.
  street  documented to a street only (by hand, with the source).
  town    only the town is documented (P1071 a settlement): said so, never drawn as a site.

Which works: the saved works matched to Wikidata (by fetch_history_wikidata.py), and every other
work on Wikidata by a saved artist ("find all other instances"); the latter are external records —
title, artist, date, museum, the Commons file of the painting — and never enter Find's works.

Explorations (kind "sites"): per artist and place (the depicted place's municipality, else the
town the work was made in, else the nearest site city within 30 km) with three sites or more —
"van Gogh in Auvers-sur-Oise · 12 sites" — and per artist overall with six or more across two
places; each stop a site (one point), its works in date order. Written into explorations.json by
build_explorations.py, which reads this file.

Public files only in the output; the same bytes every run.
"""
import collections, html, json, math, os, re, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'docs', 'v2')
RAW = os.path.join(ROOT, 'data', 'sites')
HAND = os.path.join(ROOT, 'scripts', 'sites_hand.json')
OUT = os.path.join(V2, 'sites.json')

NEAR_TOWN_KM = 150          # a site's city for flying to (the column is that city's directory)
PLACE_TOWN_KM = 30          # a site named by a site city when nothing else names its place
MIN_PLACE = 3
MIN_ARTIST = 6
QUOTE_MAX = 2

NOTE = ("Painted here (docs/v2/sites.js; scripts/build_sites.py). sites: one row a work — id (s + Wikidata "
        "item, or a hand id), q (Wikidata item), w (saved work's history id, or null: an external record), t, a, "
        "d, m (museum), img (Commons file of the painting, for external works), ll [lat, lon], pr (view: point of "
        "view; site: the place painted; street; town: only the town is known), what (the place painted), place "
        "(the place for grouping), key (cities.json town to fly to), km (its distance), photos [{f Commons file, "
        "of, by, lic, d metres from the point, when then|now}], said [{q quotation, by, in, url}], src [{name, url}]. "
        "explorations: [{id, title, artist, place, stops [[ll, key, [site row indexes]]]}].")

SAY = re.compile(r"\b(painted (?:it )?(?:at|in|from|on|near|while)|paint(?:ed|ing) (?:the )?(?:view|scene)|view from|"
                 r"vantage|viewpoint|point of view|location|located|site|spot|identified|looking (?:toward|towards|down|up|across)|"
                 r"depicts?|shows? (?:the|a)|stood|en plein air|plein air|motif|from (?:his|her) (?:window|room|studio|hotel))\b", re.I)


NARRATIVE = re.compile(r"\b(portrait|christ|jesus|madonna|virgin|holy|noli me|crucifi|annunciation|"
                       r"adoration|lamentation|deposition|resurrection|baptism|gethsemane|calvary|golgotha|"
                       r"magdalen|apostle|evangelist|martyr|nativity|pieta|pietà)\b", re.I)


DISTRICT = re.compile(r"arrondissement|borough|district|county|Manhattan|Brooklyn|Śródmieście|Mitte|Centrum|"
                      r"sestiere|San Marco|Castello|Dorsoduro|Cannaregio|Westminster|City of London|Kensington|"
                      r"\d", re.I)


def load(p):
    with open(p) as f:
        return json.load(f)


def qid(u):
    return u.rsplit('/', 1)[-1] if u else None


def file_of(u):
    if not u:
        return None
    return urllib.parse.unquote(u.rsplit('/Special:FilePath/', 1)[-1])


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 6371 * 2 * math.asin(min(1, math.sqrt(h)))


def year(s):
    m = re.match(r'\s*(-?\d{1,4})', s or '')
    return int(m.group(1)) if m else None


def clean_html(s):
    s = re.sub(r'<[^>]+>', ' ', s or '')
    return re.sub(r'\s+', ' ', html.unescape(s)).strip()


def licence(meta):
    if not meta or not (meta.get('licence') or meta.get('artist')):
        return None
    lic = meta.get('licence') or ''
    by = clean_html(meta.get('artist') or '')
    if len(by) > 80:
        by = by[:77].rsplit(' ', 1)[0] + ' …'
    return {'by': by or 'unknown', 'lic': lic or 'see Commons'}


def when(meta):
    """then: a photograph or postcard Commons dates before 1950; now otherwise (or undated: now)."""
    y = year(clean_html((meta or {}).get('date') or ''))
    return 'then' if y and 1830 < y < 1950 else 'now'


def sentences(text):
    text = re.sub(r'\n+', ' \n ', text or '')
    out = []
    for para in text.split(' \n '):
        if para.strip().startswith('=='):
            continue
        out += [s.strip() for s in re.split(r'(?<=[.!?])\s+(?=[A-Z“"(])', para) if s.strip()]
    return out


def quotes_from(article, words):
    """The article's own sentences that say where the work was painted: a site word and the place's name."""
    out = []
    for s in sentences(article.get('text')):
        if len(s) < 40 or len(s) > 420:
            continue
        if not SAY.search(s):
            continue
        if words and not any(w.lower() in s.lower() for w in words if w and len(w) > 3):
            continue
        out.append(s)
        if len(out) >= QUOTE_MAX:
            break
    return out


def main():
    raw = load(os.path.join(RAW, 'raw.json'))
    files = load(os.path.join(RAW, 'files.json')) if os.path.exists(os.path.join(RAW, 'files.json')) else {}
    near = load(os.path.join(RAW, 'near.json')) if os.path.exists(os.path.join(RAW, 'near.json')) else {}
    wiki = load(os.path.join(RAW, 'wiki.json')) if os.path.exists(os.path.join(RAW, 'wiki.json')) else {}
    hand = load(HAND)['sites'] if os.path.exists(HAND) else []
    towns = load(os.path.join(V2, 'cities.json'))['towns']
    matches = load(os.path.join(ROOT, 'data', 'wikidata', 'matches.json'))['matched']
    slug_to_id = {}
    for fn in sorted(os.listdir(os.path.join(V2, 'histories'))):
        h = load(os.path.join(V2, 'histories', fn))
        slug_to_id[h['slug']] = h['id']
    saved = {m['item']: slug_to_id.get(m['id']) for m in matches if slug_to_id.get(m['id'])}

    stated = {qid(r['s']): r['label'] for r in raw['stated']}
    places = {}
    for r in raw['places']:
        p = places.setdefault(qid(r['p']), {'cls': set(), 'img': None, 'cat': None, 'label': None, 'adm': None, 'wiki': None})
        if r.get('cls'):
            p['cls'].add(qid(r['cls']))
        p['img'] = p['img'] or file_of(r.get('img'))
        p['cat'] = p['cat'] or r.get('cat')
        p['label'] = p['label'] or r.get('label')
        p['adm'] = p['adm'] or r.get('admL')
        p['wiki'] = p['wiki'] or r.get('enwiki')
    works = {}
    for r in raw['works']:
        w = works.setdefault(qid(r['w']), {'t': None, 'a': None, 'd': None, 'img': None, 'm': None, 'arts': {}})
        w['t'] = w['t'] or r.get('label') or r.get('labelfr')
        w['a'] = w['a'] or r.get('creatorL')
        y = year(r.get('inception'))
        if y and (w['d'] is None or y < w['d']):
            w['d'] = y
        w['img'] = w['img'] or file_of(r.get('img'))
        w['m'] = w['m'] or r.get('collL')
        if r.get('article') and r.get('lang'):
            w['arts'].setdefault(r['lang'], r['article'])

    work_files = {w['img'] for w in works.values() if w['img']}
    painters = {a.split(' ')[-1].lower() for a in raw['artists'].values() if a}
    painters |= {(w['a'] or '').split(' ')[-1].lower() for w in works.values() if w['a']}
    painters.discard('')

    def painted_by_artist(meta):
        by = clean_html((meta or {}).get('artist') or '').lower()
        return any(re.search(r'\b' + re.escape(n) + r'\b', by) for n in painters if len(n) > 3) if by else False

    # Each work's candidate sites.
    cand = collections.defaultdict(list)
    for r in raw['rows']:
        q = qid(r['w'])
        ll = [round(float(r['lat']), 5), round(float(r['lon']), 5)]
        ref = []
        if r.get('refurl'):
            ref.append({'name': urllib.parse.urlparse(r['refurl']).hostname or r['refurl'], 'url': r['refurl']})
        if r.get('stated') and stated.get(qid(r['stated'])):
            ref.append({'name': stated[qid(r['stated'])]})
        p = places.get(qid(r.get('place'))) if r.get('place') else None
        if r['kind'] == 'view':
            cand[q].append((0, 'view', ll, None, None, ref))
        elif p and p['cls']:
            cand[q].append((1 if r['kind'] == 'depicts' else 2, 'site', ll, qid(r['place']), r['kind'], ref))
        elif r['kind'] == 'made' and p:
            cand[q].append((3, 'town', ll, qid(r['place']), 'made', ref))

    def near_town(ll):
        best = None
        for t in towns:
            d = km(ll, (t[3], t[4]))
            if best is None or d < best[0]:
                best = (d, t)
        return best

    hand_by_q = {h['q']: h for h in hand if h.get('q')}

    def narrative(q, best):
        """A place a story is set in, not one the painter stood before: a sacred or a portrait's subject
        (by the work's own title), or the Holy Land before 1800. Such a "depicts" is not a site."""
        if best[1] != 'site' or best[4] != 'depicts':
            return False
        t = (works.get(q) or {}).get('t') or ''
        if NARRATIVE.search(t):
            return True
        lat, lon = best[2]
        return 29 <= lat <= 34 and 34 <= lon <= 36.6 and ((works.get(q) or {}).get('d') or 0) < 1800
    rows = []
    want_files, want_wiki = set(), set()
    for q in sorted(set(cand) | set(hand_by_q), key=lambda x: int(x[1:]) if x[1:].isdigit() else 0):
        w = works.get(q) or {'t': None, 'a': None, 'd': None, 'img': None, 'm': None, 'arts': {}}
        hd = hand_by_q.get(q)
        cs = sorted(cand.get(q, []), key=lambda c: c[0])
        cs = [c for c in cs if not narrative(q, c)]
        if hd:
            best = (0, hd['pr'], hd['ll'], None, None, [])
        elif cs:
            best = cs[0]
        else:
            continue
        _, pr, ll, pq, how, ref = best
        p = places.get(pq) if pq else None
        if not (w['t'] and w['a']) and not hd:
            continue
        if pr == 'town' and not saved.get(q):
            continue            # an external work known only to its town is not a site
        row = {'id': 's' + q, 'q': q, 'w': saved.get(q), 't': (hd or {}).get('t') or w['t'], 'a': (hd or {}).get('a') or w['a'],
               'd': w['d'], 'm': w['m'], 'll': ll, 'pr': pr}
        if not row['w'] and w['img']:
            row['img'] = w['img']
            want_files.add(w['img'])
        what = (hd or {}).get('what') or (p['label'] if p and pr in ('site', 'town') else None)
        if what:
            row['what'] = what
        if how:
            row['how'] = how          # depicts | made
        # The place it is grouped by: the municipality of what it shows, else where it was made.
        made_town = None
        for c in cs:
            # the town it was made in names its place only if it is near the point (not a country's middle)
            if c[1] == 'town' and places.get(c[3]) and (pr == 'town' or km(ll, c[2]) <= 40):
                made_town = places[c[3]]['label']
                break
        nt = near_town(ll)
        # Named by the town it was made in (if near), else the site city it stands in (within 12 km: Paris,
        # not its arrondissement), else the municipality of what it shows, else a site city within 30 km.
        city = nt[1][1].split(',')[0] if nt else None
        adm = p['adm'] if p and pr == 'site' and p['adm'] else None
        if adm and DISTRICT.search(adm):
            adm = None if nt and nt[0] <= PLACE_TOWN_KM else adm
        place = (hd or {}).get('place') or made_town or adm or (city if nt and nt[0] <= PLACE_TOWN_KM else None)
        if place:
            row['place'] = place
        if nt and nt[0] <= NEAR_TOWN_KM:
            row['key'] = nt[1][0]
            row['km'] = round(nt[0], 1)
        # Photographs of the site.
        photos = []
        for ph in (hd or {}).get('photos', []):
            photos.append(dict(ph))
        if p and pr == 'site' and p['img']:
            photos.append({'f': p['img'], 'of': p['label'] or what or '', 'd': 0})
        if pr == 'view' and not photos:
            for n in near.get(f'{ll[0]},{ll[1]}', [])[:6]:
                f = file_of(n.get('img'))
                if not f or any(x['f'] == f for x in photos):
                    continue
                photos.append({'f': f, 'of': n.get('label') or '', 'd': int(round(float(n.get('d', 0)) * 1000))})
                if len(photos) >= 2:
                    break
        # Never a painting standing in for the site: a file that is any work's own picture, or one whose
        # author is a painter on this list (a place's picture on Wikidata is sometimes the painting).
        photos = [ph for ph in photos if ph['f'] not in work_files and not painted_by_artist(files.get(ph['f']))]
        for ph in photos:
            want_files.add(ph['f'])
            meta = licence(files.get(ph['f']))
            if meta and 'by' not in ph:
                ph.update(meta)
            if 'when' not in ph:
                ph['when'] = when(files.get(ph['f']))
        if photos:
            row['photos'] = photos[:3]
        # What is said: the hand's quotations, then the work's English article's sentences on its site.
        said = [dict(s) for s in (hd or {}).get('said', [])]
        art = w['arts'].get('en')
        if art and pr != 'town':
            want_wiki.add(art)
            a = wiki.get(art)
            if a and not said:
                words = [what] + ((p and [p['label']]) or []) + ([place] if pr == 'view' else [])
                for s in quotes_from(a, [x for x in words if x]):
                    said.append({'q': s, 'by': 'Wikipedia', 'in': '“' + a.get('title', '') + '”, English Wikipedia (CC BY-SA)', 'url': art})
        if said:
            row['said'] = said
        src = [{'name': 'Wikidata ' + q, 'url': 'https://www.wikidata.org/wiki/' + q}] if q.startswith('Q') else []
        src += ref + (hd or {}).get('src', [])
        seen, src2 = set(), []
        for s in src:
            k = s.get('url') or s['name']
            if k not in seen:
                seen.add(k)
                src2.append(s)
        row['src'] = src2
        rows.append(row)

    rows.sort(key=lambda r: (r['a'] or '', r['d'] or 9999, r['t'] or '', r['id']))
    ix = {r['id']: i for i, r in enumerate(rows)}

    # Explorations: a stop is one point, its works in date order.
    def stops_of(rs):
        by_pt = collections.OrderedDict()
        for r in sorted(rs, key=lambda r: (r['d'] or 9999, r['t'] or '')):
            by_pt.setdefault((r['ll'][0], r['ll'][1]), []).append(r)
        return [[list(k), v[0]['key'], [ix[r['id']] for r in v]] for k, v in by_pt.items()]

    def short_artist(a):
        words = a.split(' ')
        k = len(words) - 1
        while k > 0 and words[k - 1].lower() in ('van', 'de', 'von', 'da', 'di', 'del', 'der', 'la', 'le'):
            k -= 1
        return ' '.join(words[k:])

    good = [r for r in rows if r['pr'] in ('view', 'site', 'street') and r.get('key')]
    by_artist = collections.defaultdict(list)
    for r in good:
        by_artist[r['a']].append(r)
    exps = []
    for a in sorted(by_artist):
        rs = by_artist[a]
        by_place = collections.defaultdict(list)
        for r in rs:
            if r.get('place'):
                by_place[r['place']].append(r)
        for pl in sorted(by_place):
            st = stops_of(by_place[pl])
            if len(st) >= MIN_PLACE:
                exps.append({'id': 'sites-' + re.sub(r'[^a-z0-9]+', '-', (a + ' ' + pl).lower()).strip('-'),
                             'title': short_artist(a) + ' in ' + pl + ' · ' + str(len(st)) + ' sites',
                             'artist': a, 'place': pl, 'stops': st})
        st = stops_of(rs)
        if len(st) >= MIN_ARTIST and len({r.get('place') for r in rs}) >= 2:
            exps.append({'id': 'sites-' + re.sub(r'[^a-z0-9]+', '-', a.lower()).strip('-'),
                         'title': short_artist(a) + '’s painted places · ' + str(len(st)) + ' sites',
                         'artist': a, 'place': '', 'stops': st})
    exps.sort(key=lambda e: (-len(e['stops']), e['id']))

    out = {'note': NOTE, 'sites': rows, 'explorations': exps}
    with open(OUT, 'w') as f:
        json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
        f.write('\n')
    json.dump(sorted(want_files), open(os.path.join(RAW, 'want_files.json'), 'w'))
    json.dump(sorted(want_wiki), open(os.path.join(RAW, 'want_wiki.json'), 'w'))

    c = collections.Counter(r['pr'] for r in rows)
    print('sites:', len(rows), dict(c), ' saved works:', sum(1 for r in rows if r['w']),
          dict(collections.Counter(r['pr'] for r in rows if r['w'])))
    print('  with a photograph:', sum(1 for r in rows if r.get('photos')), ' quoted:', sum(1 for r in rows if r.get('said')))
    print('explorations:', len(exps))
    for e in exps[:60]:
        print('   ', e['title'])
    print('bytes:', os.path.getsize(OUT), ' files wanted:', len(want_files), ' articles wanted:', len(want_wiki))


if __name__ == '__main__':
    main()
