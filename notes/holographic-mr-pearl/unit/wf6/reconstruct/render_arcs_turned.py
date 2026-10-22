from render import *
views = [('drawing_view', 0, False), ('turned_20', 20, False), ('turned_45', 45, False), ('turned_90', 90, False), ('turned_180', 180, False), ('from_below', 75, True)]
SZ = 640
prims = build('V3', kind='arcs', n=96)[0]
for title, deg, below in views:
    R, (d, u, r) = turned(prims, deg, size=SZ, span=3.4, below=below)
    a = label(picture(R, 'identity'), '%s | arcs | tone = the section edge it is swept from' % title, 14)
    b = label(picture(R, 'mix'), '%s | arcs | tone mixed by the turned normal (sum n_i^2 tone_i)' % title, 14)
    im = Image.new('RGB', (SZ * 2, SZ), 'white'); im.paste(a, (0, 0)); im.paste(b, (SZ, 0))
    im.save(OUT + 'arcs_%s.png' % title)
# comparison sheet
SZ = 440
variants = [('V3 arcs (this form)', prims), ('V3 quintic', build('V3', kind='smootherstep')[0]), ('V1 literal (3 beams slid by m)', build('V1', kind='smootherstep')[0]), ('drawn reading: near ends cut straight', build_cut())]
sheet = Image.new('RGB', (SZ * len(views), SZ * len(variants)), 'white')
for i, (vn, pr) in enumerate(variants):
    for j, (title, deg, below) in enumerate(views):
        R, _ = turned(pr, deg, size=SZ, span=3.6, below=below)
        sheet.paste(label(picture(R, 'identity'), '%s | %s' % (title, vn), 12), (j * SZ, i * SZ))
sheet.save(OUT + 'compare_sheet.png')
print('ok')
