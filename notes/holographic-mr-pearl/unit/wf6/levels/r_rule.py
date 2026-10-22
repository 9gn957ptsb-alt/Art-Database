import json, numpy as np, time, colorsys
from PIL import Image, ImageDraw
import nest as N
H = N.HG
u = N.unit(H, 'woven', 12)
D = '/home/user/site/docs/v2/'
def label(img, txt):
    im = Image.fromarray(img); d = ImageDraw.Draw(im); d.rectangle((0, 0, 8 + 6 * max(len(l) for l in txt.split('\n')), 13 * (txt.count('\n') + 1) + 4), fill=(255, 255, 255)); d.text((4, 2), txt, fill=(0, 0, 0)); return np.array(im)
def tint_by_group(tone, lev, leaves, depthlev=1):
    """tint each leaf's pixels by the hue of its ancestor slot at a given depth (the part it belongs to)"""
    return None
cp = {c['key']: c for c in json.load(open(D + 'cityplaces.json'))['places']}
mu = {m['slug']: m for m in json.load(open(D + 'museums.json'))['museums']}
london = cp['london-gb']
city = {'key': 'London', 'parts': [{'key': mu[s]['name'], 'parts': [{'key': w['t']} for w in mu[s]['works']]} for s in london['museums'] if s in mu]}
cases = [
    ('a city with 12 places (equal)', {'key': 'c12', 'parts': [{'key': i} for i in range(12)]}),
    ('a place with 40 works (equal)', {'key': 'p40', 'parts': [{'key': i} for i in range(40)]}),
    ('London: its %d museums, sized by their works' % len(city['parts']), {'key': 'London', 'parts': [{'key': p['key'], 'w': len(p['parts'])} for p in city['parts']]}),
]
tiles = []
stats = {}
for name, node in cases:
    res = N.place_huffman(node, N.Frame(1.0, N.CENTRE.copy()), H)
    lv_ = sorted(res['leaves'], key=lambda f: -f.s)
    sizes = [round(-np.log(f.s) / np.log(N.PHI), 2) for f in res['leaves']]
    t0 = time.time()
    prm = N.prims(res['leaves'], u)
    # colour each leaf (part) by its own hue so the parts can be told apart: a translucent film over the tones
    for i, (f, p0) in enumerate(zip(res['leaves'], range(len(res['leaves'])))):
        pass
    tone, lev, dep = N.drawing_view(prm, w=520)
    img = N.picture(tone, lev)
    txt = '%s\n%d parts -> sizes phi^-%s; openings used %d' % (name, len(res['leaves']), ', '.join('%g' % s for s in sorted(set(sizes))), res['gaps_used'])
    tiles.append(label(img, txt))
    stats[name] = dict(parts=len(res['leaves']), sizes=sorted(sizes), gaps_used=res['gaps_used'], weights=[N.weight(p) for p in node['parts']])
    print(name, stats[name], '%.1fs' % (time.time() - t0), flush=True)
Image.fromarray(np.concatenate(tiles, 1)).save('r_rule.png')
json.dump(stats, open('r_rule.json', 'w'), indent=1)
