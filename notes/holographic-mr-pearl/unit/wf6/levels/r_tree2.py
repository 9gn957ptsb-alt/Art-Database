"""The toy information tree (info.toy(3): 3 cities x 3 museums x 3 works [x 4 details]) laid out by ladder.layout."""
import json, math, colorsys, numpy as np
from PIL import Image, ImageDraw, ImageFont
import nest as N, ladder as LD, info as I, r_ladder as R
F16 = R.font(16); F12 = R.font(12)
HUE = {'New York': (214, 69, 46), 'Paris': (46, 104, 196), 'Amsterdam': (222, 168, 32)}
def owner(tree):
    o = {}
    for c in tree['parts']:
        for p in c['parts']:
            for w in p['parts']:
                o[id(w)] = (c['key'], p['key'], w['key'])
                for d in w.get('parts', []): o[id(d)] = (c['key'], p['key'], w['key'], d['key'])
    return o
def tint(path, order):
    base = np.array(HUE[path[0]], float) / 255; k = order[path[0]].index(path[1])
    h, s, v = colorsys.rgb_to_hsv(*base); return np.array(colorsys.hsv_to_rgb(h, s * (1 - 0.3 * k), min(1, v * (1 + 0.15 * k)))) * 255
out = {}
for name, with_details in (('works', False), ('details', True)):
    tree = I.toy(3)
    if not with_details:
        for c in tree['parts']:
            for p in c['parts']:
                for w in p['parts']: w['parts'] = []
    lay = LD.layout(tree)
    leaves = lay['leaves']; K = lay['K']
    own = owner(tree); order = {c['key']: [p['key'] for p in c['parts']] for c in tree['parts']}
    prm = R.prims_of(leaves)
    ext = LD.F(K + 4) / 8 * 1.32; W = 1100
    O, D = N.lv.drawing_rays(-ext, ext, -ext * 0.75, ext * 1.08, W)
    tone, idx = N.lv.cast(prm, O, D, want_level=True)
    img = N.picture(tone, idx)
    Image.fromarray(img).save('tree2_%s_drawing.png' % name)
    f = img.astype(float)
    for i, fr in enumerate(leaves):
        pth = own.get(id(fr.info)); m = (idx == i) & (tone >= 0)
        if pth is None or not m.any(): continue
        f[m] = np.round((f[m] + tint(pth, order)) / 2)
    im = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8)); d = ImageDraw.Draw(im)
    h = tone.shape[0]
    def px(ab): return ((ab[0] + ext) / (2 * ext) * W, (ext * 1.08 - ab[1]) / (ext * 1.83) * h)
    for fr in lay['frames']:
        if fr.kind == 'city':
            x, y = px(fr.ab + np.array({'A': (0, 1.0), 'B': (0.9, -0.62), 'C': (-0.9, -0.62)}[fr.path[-1]]) * LD.F(fr.m + 4) / 3 * N.LL * 0.62)
            d.text((x - 45, y - 10), '%s (level %d)' % (fr.info['key'], fr.m), fill=(0, 0, 0), font=F16)
    d.text((10, h - 60), 'planet: level %d (outline %d u = %.1f blocks); cities %s; places %s; works %s' % (
        K, LD.F(K + 4), LD.F(K + 4) / 8, sorted({f.m for f in lay['frames'] if f.kind == 'city'}),
        sorted({f.m for f in lay['frames'] if f.kind == 'place'}), sorted({f.m for f in lay['frames'] if f.kind == 'work'})), fill=(0, 0, 0), font=F16)
    if with_details:
        d.text((10, h - 36), 'details: corners (artist A, year B, medium C) level %s; title in the work\'s opening, level %s (one block, the drawing)' % (
            sorted({f.m for f in leaves if f.kind == 'detail' and not f.path.endswith('G')}), sorted({f.m for f in leaves if f.path.endswith('G')})), fill=(0, 0, 0), font=F16)
    im.save('tree2_%s_levels.png' % name)
    out[name] = dict(K=K, leaves=len(leaves), joins=lay['joins'], openings_used=lay['openings_used'],
                     leaf_levels=sorted({f.m for f in leaves}), planet_outline_u=LD.F(K + 4), planet_blocks=LD.F(K + 4) / 8,
                     by_kind={k: sorted({f.m for f in lay['frames'] if f.kind == k}) for k in ('planet', 'city', 'place', 'work', 'detail')},
                     names=[[c['key'], [[p['key'], [w['key'] for w in p['parts']]] for p in c['parts']]] for c in tree['parts']])
    print(name, {k: v for k, v in out[name].items() if k != 'names'}, flush=True)
json.dump(out, open('r_tree2.json', 'w'), indent=1)
