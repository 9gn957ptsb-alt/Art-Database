"""The artist's information as a tree (planet -> cities -> places -> works -> details), from the site's own files,
by fixed rules. Weights: how much each holds (its details)."""
import json
D = '/home/user/site/docs/v2/'
cp = json.load(open(D + 'cityplaces.json'))['places']
mu = {m['slug']: m for m in json.load(open(D + 'museums.json'))['museums']}
DETAIL_KEYS = [('t', 'title'), ('a', 'artist'), ('y', 'year'), ('m', 'medium')]


def work_node(w):
    return {'key': w.get('t', '?'), 'kind': 'work', 'parts': [{'key': '%s: %s' % (nm, w.get(k, '')), 'kind': 'detail'} for k, nm in DETAIL_KEYS]}


def place_node(m, works=None):
    ws = m['works'] if works is None else works
    return {'key': m['name'], 'kind': 'place', 'parts': [work_node(w) for w in ws]}


def city_node(c, places=None):
    ms = [mu[s] for s in c.get('museums', []) if s in mu] if places is None else places
    return {'key': c['name'], 'kind': 'city', 'parts': [place_node(m) for m in ms]}


def full_planet():
    return {'key': 'the planet', 'kind': 'planet', 'parts': [city_node(c) for c in cp]}


def held(m):
    return len(m['works'])


def toy(k=3):
    """A planet of k cities of k places of k works, by a fixed rule: the cities with at least k museums that hold at
    least k works each, the k that hold the most; in each, its k museums that hold the most; in each, its first k
    works in the museum's own list (ties: the files' order)."""
    def full(c):
        return [mu[s] for s in c.get('museums', []) if s in mu and held(mu[s]) >= k]
    cities = sorted([c for c in cp if len(full(c)) >= k], key=lambda c: -sum(held(m) for m in full(c)))[:k]
    out = {'key': 'the planet', 'kind': 'planet', 'parts': []}
    for c in cities:
        ms = sorted(full(c), key=lambda m: -held(m))[:k]
        out['parts'].append({'key': c['name'], 'kind': 'city', 'parts': [place_node(m, m['works'][:k]) for m in ms]})
    return out


if __name__ == '__main__':
    t = toy(3)
    for c in t['parts']:
        print(c['key'])
        for p in c['parts']:
            print('   ', p['key'], '|', ' / '.join(w['key'] for w in p['parts']))
