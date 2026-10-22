import json, math, numpy as np, time, colorsys
from PIL import Image, ImageDraw, ImageFont
import nest as N, info as I
import unit as U
H = N.HG
u = N.unit(H, 'woven', 12)
def font(sz):
    for p in ('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/usr/share/fonts/dejavu/DejaVuSans.ttf'):
        try: return ImageFont.truetype(p, sz)
        except Exception: pass
    return ImageFont.load_default()
F12, F14, F18 = font(12), font(14), font(18)
def prims_indexed(leaves, u):
    out = []
    for i, cp in enumerate(leaves):
        perm = np.abs(cp.M).argmax(0); tone = tuple(int(perm[k]) for k in range(3))
        for nm, tb, cs in u:
            for C in cs: out.append(U.Prim(cp.map(C), tone, nm, i))
    return out
def ancestors(frames_by_leaf):
    pass
CITY_HUE = {'New York': (214, 69, 46), 'Paris': (46, 104, 196), 'Amsterdam': (222, 168, 32)}
def leaf_path(tree, res):
    # each leaf frame's info is its node; find its city and place by walking the tree
    owner = {}
    for c in tree['parts']:
        for p in c['parts']:
            for w in p['parts']:
                owner[id(w)] = (c['key'], p['key'], w['key'])
                for d in w.get('parts', []):
                    owner[id(d)] = (c['key'], p['key'], w['key'])
    return [owner.get(id(f.info)) for f in res['leaves']]
def film(img, tone, idx, paths, places_order):
    out = img.astype(float)
    for i, pth in enumerate(paths):
        if pth is None: continue
        m = (idx == i) & (tone >= 0)
        if not m.any(): continue
        base = np.array(CITY_HUE[pth[0]], float)
        k = places_order[pth[0]].index(pth[1])
        hsv = colorsys.rgb_to_hsv(*(base / 255)); col = np.array(colorsys.hsv_to_rgb(hsv[0], hsv[1] * (1 - 0.28 * k), min(1, hsv[2] * (1 + 0.12 * k)))) * 255
        a = 0.55
        out[m] = out[m] * (1 - a) + col * a
    return np.clip(out, 0, 255).astype(np.uint8)
tree = I.toy(3)
places_order = {c['key']: [p['key'] for p in c['parts']] for c in tree['parts']}
results = {}
for name, depth in (('works', 3), ('details', 4)):
    t = json.loads(json.dumps(tree))
    if depth == 3:
        for c in t['parts']:
            for p in c['parts']:
                for w in p['parts']: w['parts'] = []
    res = N.place_huffman(t, N.Frame(1.0, N.CENTRE.copy()), H)
    t0 = time.time()
    prm = prims_indexed(res['leaves'], u)
    W = 1100
    ext = (-1.45, 1.45, -1.05, 1.62)
    O, Dv = N.lv.drawing_rays(*ext, W)
    tone, idx, dep = N.lv.cast(prm, O, Dv, want_level=True, want_depth=True)
    print(name, len(res['leaves']), 'leaves; cast %.1fs' % (time.time() - t0), flush=True)
    paths = leaf_path(t, res)
    img = N.picture(tone, idx)
    np.save('tree_%s_tone.npy' % name, tone); np.save('tree_%s_idx.npy' % name, idx)
    results[name] = dict(res=res, tree=t, tone=tone, idx=idx, img=img, paths=paths, ext=ext, W=W, dep=dep)
    Image.fromarray(img).save('tree_%s_drawing.png' % name)
    fimg = film(img, tone, idx, paths, places_order)
    # labels: city names at their corner frames, places at theirs
    im = Image.fromarray(fimg); d = ImageDraw.Draw(im)
    a0, a1, b0, b1 = ext; h = tone.shape[0]
    def px(ab): return ((ab[0] - a0) / (a1 - a0) * W, (b1 - ab[1]) / (b1 - b0) * h)
    for f in res['frames']:
        nd = f.info
        if nd.get('kind') not in ('city', 'place'): continue
        ab = np.array([(f.c - N.CENTRE) @ N.RV, (f.c - N.CENTRE) @ N.UPV])
        x, y = px(ab)
        if nd['kind'] == 'city':
            off = {'New York': (0, -0.95), 'Paris': (0.95, -0.55), 'Amsterdam': (-0.95, -0.55)}[nd['key']]
            # put the city's name outside the figure, beside its corner
            xx, yy = px(ab + np.array(off) * f.s * 1.25)
            d.text((xx - 40, yy - 9), nd['key'], fill=(0, 0, 0), font=F18)
    im.save('tree_%s_levels.png' % name)
json.dump({k: dict(leaves=len(v['res']['leaves']), gaps_used=v['res']['gaps_used'], joins=v['res']['joins'],
                   sizes=sorted(set(round(-math.log(f.s) / math.log(N.PHI), 3) for f in v['res']['leaves']))) for k, v in results.items()},
          open('r_tree.json', 'w'), indent=1)
import pickle
pickle.dump({k: dict(paths=v['paths'], ext=v['ext'], W=v['W']) for k, v in results.items()}, open('tree_meta.pkl', 'wb'))
