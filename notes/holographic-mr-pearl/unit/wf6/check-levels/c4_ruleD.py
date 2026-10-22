"""Rule D re-implemented from the result's own words (not ladder.py), relative levels only, then K."""
import sys, math, json, collections
sys.path.insert(0, sys.argv[1])
import info as I
PHI = (1 + 5 ** .5) / 2
def W(n):
    ps = n.get('parts') or []
    return 1 if not ps else sum(W(p) for p in ps)
def place(node, lev, path, out, inopen=0):
    """node fills a frame at relative level lev. out: list of (lev, kind, key, openings on path)."""
    ps = node.get('parts') or []
    out.append(('frame', lev, node.get('kind'), node.get('key'), inopen, node))
    if not ps:
        out.append(('leaf', lev, node.get('kind'), node.get('key'), inopen, node)); return
    if len(ps) == 1:
        place(ps[0], lev, path, out, inopen); return   # one part fills the frame
    rec = {'key': str(node.get('key')) + ' (record)', 'kind': 'record'}
    items = [(W(p), i, p) for i, p in enumerate(ps)]
    if len(ps) % 2 == 1:
        out.append(('leaf', lev - 4, 'record', rec['key'], inopen + 1, rec))
    else:
        items.append((1, len(ps), rec))
    # join three at a time, lightest first (ties: files' order); heaviest at A, then B, then C
    seq = len(items) + 1
    trees = [(w, i, ('leaf', p)) for w, i, p in items]
    while len(trees) > 1:
        trees.sort(key=lambda t: (t[0], t[1]))
        three, trees = trees[:3], trees[3:]
        three.sort(key=lambda t: (-t[0], t[1]))
        trees.append((sum(t[0] for t in three), seq, ('join', [t[2] for t in three]))); seq += 1
    def go(t, lev):
        if t[0] == 'leaf': place(t[1], lev, path, out, inopen)
        else:
            for sub in t[1]: go(sub, lev - 1)
    go(trees[0][2], lev)
def run(root):
    out = []; place(root, 0, '', out)
    leaves = [o for o in out if o[0] == 'leaf']
    K = 2 - min(o[1] for o in leaves)
    # size error: for every node frame with parts, each part's first frame
    first = {}
    for o in out:
        if o[0] == 'frame': first.setdefault(id(o[5]), o[1])
    errs = []
    def walk(n):
        for p in n.get('parts') or []:
            e = (first[id(p)] - first[id(n)]) - math.log(W(p) / W(n)) / (2 * math.log(PHI)); errs.append(abs(e)); walk(p)
    walk(root)
    return dict(K=K, across=round(F(K + 4) / 8, 2), leaves=len(leaves), leaf_levels=dict(sorted(collections.Counter(o[1] + K for o in leaves).items())),
                rel_levels=dict(sorted(collections.Counter(o[1] for o in leaves).items())),
                mean_err=round(sum(errs) / len(errs), 3), max_err=round(max(errs), 3), max_open=max(o[4] for o in out),
                opening_kinds=sorted({o[2] for o in leaves if o[4]}))
def F(n):
    a, b = 0, 1
    for _ in range(n): a, b = b, a + b
    return a
def planet(details=True):
    t = I.full_planet()
    if not details:
        for c in t['parts']:
            for p in c['parts']:
                for w in p['parts']: w['parts'] = []
    t['parts'] = [c for c in t['parts'] if c['parts'] and any(p['parts'] for p in c['parts'])]
    for c in t['parts']: c['parts'] = [p for p in c['parts'] if p['parts']]
    return t
eq = lambda n: {'key': 'x', 'kind': 'node', 'parts': [{'key': str(i), 'kind': 'leaf'} for i in range(n)]}
res = {}
for name, t in (('12 equal', eq(12)), ('40 equal', eq(40)), ('toy 3x3x3x4', I.toy(3)), ('planet works', planet(False)), ('planet details', planet(True))):
    res[name] = run(t); print(name, res[name])
t = planet(True); print('cities', len(t['parts']), 'all cities in cityplaces', len(I.cp), 'places', sum(len(c['parts']) for c in t['parts']),
      'works', sum(len(p['parts']) for c in t['parts'] for p in c['parts']))
json.dump(res, open('c4_ruleD.json', 'w'), indent=1)
