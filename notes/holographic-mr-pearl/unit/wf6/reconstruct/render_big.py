from render import *
prims = build('V3', kind='smootherstep')[0]
views = [('drawing_view', 0, False), ('turned_20', 20, False), ('turned_45', 45, False), ('turned_90', 90, False), ('turned_180', 180, False), ('from_below', 75, True)]
SZ = 640
for title, deg, below in views:
    R, (d, u, r) = turned(prims, deg, size=SZ, span=3.4, below=below)
    a = label(picture(R, 'identity'), '%s  (tone = the face\'s own axis)  eye dir %s' % (title, np.round(-d, 2).tolist()), 14)
    b = label(picture(R, 'mix'), '%s  (tone mixed by the turned normal, sum n_i^2 tone_i)' % title, 14)
    im = Image.new('RGB', (SZ * 2, SZ), 'white'); im.paste(a, (0, 0)); im.paste(b, (SZ, 0))
    im.save(OUT + 'V3_%s.png' % title)
print('ok')
