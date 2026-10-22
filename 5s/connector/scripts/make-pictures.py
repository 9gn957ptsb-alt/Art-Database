# Writes test/pictures.mjs: PNG and JPEG files made by Pillow, with Pillow's own decoded
# RGBA pixels as the expected answer, for the connector's decoders (src/pixels.js).
# Run from 5s/connector: python3 -I scripts/make-pictures.py test/pictures.mjs  (needs Pillow)
import base64, io, sys, random
from PIL import Image, ImageOps

random.seed(5)
W, H = 32, 24

def pattern():
    im = Image.new('RGBA', (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            # gradients plus noise, so the encoder picks every PNG filter somewhere
            r = (x * 8 + random.randint(0, 20)) % 256
            g = (y * 10 + random.randint(0, 30)) % 256
            b = ((x ^ y) * 7 + random.randint(0, 15)) % 256
            a = 255 if x < 24 else (y * 11) % 256
            px[x, y] = (r, g, b, a)
    return im

base = pattern()
out = {}

def png(name, im, **kw):
    buf = io.BytesIO(); im.save(buf, 'PNG', **kw)
    data = buf.getvalue()
    back = Image.open(io.BytesIO(data)); back.load()
    rgba = back.convert('RGBA')
    out[name] = (data, rgba.tobytes(), rgba.size)

png('rgb8', base.convert('RGB'))
png('rgba8', base)
png('grey8', base.convert('L'))
png('grey1', base.convert('L').point(lambda v: 255 if v > 120 else 0).convert('1'))
g16 = Image.new('I;16', (W, H)); p = g16.load()
for y in range(H):
    for x in range(W): p[x, y] = (x * 2000 + y * 37) % 65536
png('grey16', g16)
# Pillow clips 16-bit grey at 255 when it converts; a browser shows the high byte, so expect that.
vals = bytes(v for y in range(H) for x in range(W) for v in ((((x * 2000 + y * 37) % 65536) >> 8),) * 3 + (255,))
out['grey16'] = (out['grey16'][0], vals, (W, H))
pal = base.convert('RGB').quantize(colors=4)
pal.info['transparency'] = 1
png('palette2', pal, bits=2, transparency=1)
png('palette8', base.convert('RGB').quantize(colors=200))
png('la8', base.convert('LA'))

def jpg(name, im, **kw):
    buf = io.BytesIO(); im.save(buf, 'JPEG', **kw)
    data = buf.getvalue()
    back = ImageOps.exif_transpose(Image.open(io.BytesIO(data))).convert('RGBA')
    out[name] = (data, back.tobytes(), back.size)

photo = Image.new('RGB', (60, 40))
pp = photo.load()
for y in range(40):
    for x in range(60):
        pp[x, y] = (200, 40, 40) if x < 30 else ((40, 160, 60) if y < 20 else (30, 50, 180))
jpg('jpeg_plain', photo, quality=92)
jpg('jpeg_progressive', photo, quality=92, progressive=True)
ex = Image.Exif(); ex[0x0112] = 6
jpg('jpeg_turned6', photo, quality=92, exif=ex.tobytes())

lines = ['// Made by Pillow (scripts/make-pictures.py): each picture file, and Pillow\'s own decoding of it',
         '// (RGBA, turned upright by its EXIF orientation), for the connector\'s decoders to match.',
         'const b = (s) => Uint8Array.from(Buffer.from(s, "base64"));',
         'export const PICTURES = {']
for name, (data, rgba, size) in out.items():
    lines.append('  %s: { w: %d, h: %d, file: b("%s"), rgba: b("%s") },' % (name, size[0], size[1], base64.b64encode(data).decode(), base64.b64encode(rgba).decode()))
lines.append('};')
open(sys.argv[1], 'w').write('\n'.join(lines) + '\n')
print({k: (len(v[0]), v[2]) for k, v in out.items()})
