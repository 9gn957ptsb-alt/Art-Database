"""Rule A (bottom-up golden Huffman) vs rule B (top-down golden split) on the toy, a city of 12, a place of 40,
London, and the whole planet (works; works with 4 details)."""
import json, math, copy, numpy as np, collections
import ladder as LD, info as I
def stats(lay):
    e = LD.size_error(lay)
    w = np.array([x[0] for x in e], float); d = np.array([x[1] for x in e])
    lv = collections.Counter(f.m for f in lay['leaves'])
    return dict(K=lay['K'], planet_outline_over_leaf=round(LD.F(lay['K'] + 4) / 8, 2), leaves=len(lay['leaves']),
                openings_used=lay['openings_used'], leaf_levels=dict(sorted(lv.items())),
                mean_abs_err_levels=round(float(np.abs(d).mean()), 3), weighted_mean_abs_err=round(float((np.abs(d) * w).sum() / w.sum()), 3),
                max_abs_err=round(float(np.abs(d).max()), 3))
def node(n, key, ws=None):
    return {'key': key, 'kind': 'place', 'parts': [{'key': '%s %d' % (key, i), 'kind': 'work', 'parts': [{'key': 'd', 'kind': 'detail'}] * 0} if ws is None else
                                                    {'key': '%s %d' % (key, i), 'kind': 'work', 'parts': [{'key': 'd%d' % j, 'kind': 'detail'} for j in range(ws[i])]} for i in range(n)]}
def planet(details):
    t = I.full_planet()
    for c in t['parts']:
        for p in c['parts']:
            for w in p['parts']:
                if not details: w['parts'] = []
    t['parts'] = [c for c in t['parts'] if c['parts'] and any(p['parts'] for p in c['parts'])]
    for c in t['parts']: c['parts'] = [p for p in c['parts'] if p['parts']]
    return t
def london():
    t = I.full_planet(); c = next(c for c in t['parts'] if c['key'] == 'London')
    for p in c['parts']:
        for w in p['parts']: w['parts'] = []
    c['parts'] = [p for p in c['parts'] if p['parts']]; return c
cases = {'toy 3x3x3 works': lambda: (lambda t: [[w.__setitem__('parts', []) for p in c['parts'] for w in p['parts']] for c in t['parts']] and t)(I.toy(3)),
         'toy 3x3x3x4 details': lambda: I.toy(3),
         'a city of 12 equal places': lambda: node(12, 'place'),
         'a place of 40 equal works': lambda: node(40, 'work'),
         'London: museums by works': london,
         'planet: works': lambda: planet(False),
         'planet: works with 4 details': lambda: planet(True)}
if __name__ == '__main__':
    out = {}
    if __name__ != "__main__": cases = cases
    
    for name, mk in cases.items():
        out[name] = {}
        for rule, fn in (('A huffman', LD.layout), ('B split', LD.layout_split)):
            t = mk(); out[name][rule] = stats(fn(t))
        print(name); [print('   ', r, s) for r, s in out[name].items()]
    json.dump(out, open('q_rules.json', 'w'), indent=1)
