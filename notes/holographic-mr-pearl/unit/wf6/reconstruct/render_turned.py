from render import *
KIND = 'smootherstep'
views = [('drawing view', 0, False), ('turned 20', 20, False), ('turned 45', 45, False), ('turned 90', 90, False), ('turned 180', 180, False), ('from below', 75, True)]
variants = [('V3 closed, curved (this form)', build('V3', kind=KIND)[0]), ('V1 literal: Az, By, Cy slid by m', build('V1', kind=KIND)[0]), ('drawn reading: near ends cut straight', build_cut())]
SZ = 520
rows = []
for vname, prims in variants:
    for mode in (['identity', 'mix'] if vname.startswith('V3') else ['identity']):
        tiles = []
        for title, deg, below in views:
            R, _ = turned(prims, deg, size=SZ, span=3.6, below=below)
            img = picture(R, mode)
            tiles.append(label(img, '%s | %s%s' % (title, vname.split(':')[0].split(',')[0], '' if mode == 'identity' else ' | tone mixed by normal'), 14))
        row = Image.new('RGB', (SZ * len(views), SZ), 'white')
        for i, t in enumerate(tiles): row.paste(t, (i * SZ, 0))
        rows.append((vname, mode, row))
        row.save(OUT + 'turned_%s_%s.png' % (vname.split()[0].replace(':', ''), mode))
sheet = Image.new('RGB', (SZ * len(views), SZ * len(rows)), 'white')
for i, (_, _, r) in enumerate(rows): sheet.paste(r, (0, i * SZ))
sheet.save(OUT + 'turned_sheet_all.png')
print('ok')
