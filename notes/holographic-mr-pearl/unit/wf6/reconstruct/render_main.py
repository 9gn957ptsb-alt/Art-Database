from render import *
KIND = sys.argv[1] if len(sys.argv) > 1 else 'smootherstep'
prims, recs = build('V3', kind=KIND)
R = drawing_view(prims)
mm, m = mismatch(R['tone'])
print(mm)
# 1. beside the original (drawing view: tones, outline where the tone changes, as the original draws them)
tone = R['tone']
v = np.vectorize(TONE_RGB.get)(tone).astype(np.uint8)
e = edges(np.where(tone == -1, -1, tone))
v = np.where(e, 60, v).astype(np.uint8)
orig = Image.open(UNIT + 'original.jpg').convert('RGB')
W, Hh = orig.size
sheet = Image.new('RGB', (W * 2 + 20, Hh), 'white')
sheet.paste(orig, (0, 0)); sheet.paste(label(v, 'closed curved form, drawing view (ray-cast)', 22), (W + 20, 0))
sheet = label(sheet, 'original', 22)
sheet.save(OUT + 'closed_view_beside_original.png')
# 2. diff against cls
dimg = np.full(cls.shape + (3,), 255, np.uint8)
base = np.vectorize(TONE_RGB.get)(tone).astype(np.uint8)
dimg[...] = (255 - (255 - base[..., None]) * 0.25).astype(np.uint8)
tt = tone.copy(); tt[HOLES & (tt == -1)] = 2
valid = cls != -2
for (c_, t_), col in {(0, 2): (230, 0, 0), (0, -1): (255, 120, 0), (0, 1): (200, 0, 200), (1, 0): (0, 120, 255), (1, 2): (0, 180, 0), (1, -1): (0, 200, 200), (2, 0): (120, 60, 0), (2, 1): (0, 0, 0)}.items():
    dimg[(cls == c_) & (tt == t_) & valid] = col
other = m & ~np.isin(cls * 10 + tt, [2, -1, 1, 10, 12, 9, 20, 21])
dimg[other] = (255, 0, 255)
im = label(dimg, 'diff vs cls: %d wrong px = %.3f%% (floor 2.103%%); red cls grey/drawn white (outline strokes), orange grey/paper, blue black/grey ...' % (mm['wrong'], mm['pct']), 16)
im.save(OUT + 'diff_vs_cls.png')
np.save(OUT + 'tone_V3_final.npy', tone)
json.dump(mm, open(OUT + 'mismatch_V3.json', 'w'), indent=1)
