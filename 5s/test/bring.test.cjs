// 5s bring-in: src/bring.js in a real browser (Playwright + Chromium).
//
//   node --test 5s/test/bring.test.cjs
//
// Generates test images with Python (Pillow + numpy), serves a small page that loads bring.js from a
// scratch directory, and checks FiveSBring.process(), newId() and the three stores (IndexedDB, memory,
// and a fake db that enforces the db path grammar).
// Environment: BRING_SCRATCH (default: <tmpdir>/5s-bring-test), BRING_PORT (default 8750).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, execFileSync } = require('node:child_process');

let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const SRC = path.join(__dirname, '..', 'src', 'bring.js');
const SCRATCH = process.env.BRING_SCRATCH || path.join(os.tmpdir(), '5s-bring-test');
const WWW = path.join(SCRATCH, 'www');
const PORT = Number(process.env.BRING_PORT || 8750);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const UNREADABLE = "This file isn't an image we can read.";

// ------------------------------------------------------------------ fixtures (Pillow)

const GEN = String.raw`
import sys, os, numpy as np
from PIL import Image
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
rng = np.random.default_rng(5)

def save(a, name, **kw):
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(os.path.join(out, name), **kw)

# photo-like: three colour fields (50 / 30 / 20 %) with a soft gradient and grain
A, B, C = (196, 85, 58), (47, 93, 124), (232, 217, 176)
h, w = 480, 640
a = np.zeros((h, w, 3), np.float32)
a[:240] = A
a[240:, :int(w * 0.6)] = B
a[240:, int(w * 0.6):] = C
a += np.linspace(-8, 8, w)[None, :, None]
a += rng.normal(0, 5, a.shape)
save(a, 'photo.jpg', quality=92)

# near uniform
a = np.full((400, 500, 3), (122, 139, 108), np.float32) + rng.integers(-2, 3, (400, 500, 1))
save(a, 'flat.png')

# tall and wide
t = np.linspace(0, 1, 1200)[:, None, None]
a = (1 - t) * np.array([30, 60, 90]) + t * np.array([220, 180, 140]) + np.zeros((1200, 300, 3))
a += rng.normal(0, 4, a.shape)
save(a, 'tall.png')
x = np.arange(1600)[None, :, None]
a = np.where((x // 40) % 2 == 0, np.array([20, 120, 80]), np.array([240, 230, 210])) + np.zeros((200, 1600, 3))
a += rng.normal(0, 4, a.shape)
save(a, 'wide.png')

# alpha: a grainy red disc on transparency
yy, xx = np.mgrid[:400, :400]
disc = (yy - 200) ** 2 + (xx - 200) ** 2 <= 140 ** 2
rgba = np.zeros((400, 400, 4), np.float32)
rgba[..., :3] = np.array([214, 40, 40]) + rng.normal(0, 8, (400, 400, 3))
rgba[..., 3] = np.where(disc, 255, 0)
save(rgba, 'alpha.png')

# half flat, half coarse noise (blocks survive the downsample)
a = np.full((600, 800, 3), 128, np.float32)
blocks = rng.integers(0, 256, (100, 67, 1)).repeat(6, 0).repeat(6, 1)[:600, :402]
a[:, 400:] = blocks[:, :400] + rng.normal(0, 10, (600, 400, 3))
save(a, 'halfnoise.png')

# a large photo-like JPEG: sky, ground, a dark block
h, w = 3000, 4000
a = np.zeros((h, w, 3), np.float32)
s = np.linspace(0, 1, 1200)[:, None, None]
a[:1200] = (1 - s) * np.array([90, 140, 210]) + s * np.array([190, 210, 230])
g = rng.normal(0, 22, (1800 // 4, w // 4, 1)).repeat(4, 0).repeat(4, 1)
a[1200:] = np.array([120, 90, 60]) + g
a[1500:2400, 2600:3400] = (40, 38, 45)
a += rng.normal(0, 3, a.shape)
save(a, 'big.jpg', quality=90)

# EXIF orientation 6 (stored 600 x 300, shown 300 x 600): stored left half red, right half blue
a = np.zeros((300, 600, 3), np.uint8)
a[:, :300] = (220, 30, 30)
a[:, 300:] = (30, 30, 220)
im = Image.fromarray(a)
ex = Image.Exif()
ex[0x0112] = 6
im.save(os.path.join(out, 'exif.jpg'), quality=92, exif=ex.tobytes())

# per-pixel colour noise: the hardest thing to compress (the size cap must step down)
save(rng.integers(0, 256, (900, 1200, 3)), 'noise.png')

# not images
open(os.path.join(out, 'notimage.txt'), 'w').write('hello, this is not a picture\n')
open(os.path.join(out, 'corrupt.jpg'), 'wb').write(b'\xff\xd8\xff\xe0' + bytes(rng.integers(0, 256, 4000, dtype=np.uint8)))
`;

const PAGE = `<!doctype html><meta charset="utf-8"><title>bring test</title>
<input type="file" id="f" accept="image/*" multiple>
<script src="bring.js"></script>
<script>
window.T = {
  async file(name, type) {
    const r = await fetch('fx/' + name);
    const b = await r.blob();
    return new File([b], name, { type: type === undefined ? b.type : type });
  },
  async run(fileOrName, type) {
    const f = typeof fileOrName === 'string' ? await T.file(fileOrName, type) : fileOrName;
    const t0 = performance.now();
    try {
      const r = await FiveSBring.process(f);
      return { ok: true, ms: performance.now() - t0, r };
    } catch (e) {
      return { ok: false, message: e.message, code: e.code, isError: e instanceof Error };
    }
  },
  async look(url, pts) {   // the size of a data URL image, and its pixels at fractional points
    const img = new Image();
    img.src = url;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = (pts || []).map(([fx, fy]) => Array.from(g.getImageData(Math.min(c.width - 1, Math.floor(fx * c.width)), Math.min(c.height - 1, Math.floor(fy * c.height)), 1, 1).data));
    return { w: c.width, h: c.height, type: url.slice(5, url.indexOf(';')), px };
  },
  // A stand-in for claude.use("db"): the path grammar, set/get/delete, one log, injectable failures.
  fakeDb(latency) {
    const SEG = /^[A-Za-z0-9_\\-.~:@+]+$/;
    const docs = new Map(), log = [], inflight = new Map(), failWrites = [], failReads = [];
    let maxInflight = 0;
    const wait = () => new Promise((r) => setTimeout(r, latency || 5));
    function check(p, even) {
      const segs = p.split('/');
      if (segs.length % 2 !== (even ? 0 : 1)) throw new TypeError('path ' + p + ' has ' + segs.length + ' segments');
      if (segs.length > 16 || p.length > 1000) throw new TypeError('path too long');
      for (const s of segs) if (!SEG.test(s) || s === '.' || s === '..' || s.length > 200) throw new TypeError('bad segment ' + s);
    }
    const db = {
      doc(p) {
        if (typeof p !== 'string') throw new TypeError('path must be a string');
        check(p, true);
        const write = async (op, fn) => {
          log.push([op, p]);
          const n = (inflight.get(p) || 0) + 1;
          inflight.set(p, n);
          maxInflight = Math.max(maxInflight, n);
          try {
            await wait();
            const f = failWrites.shift();
            if (f) throw f;
            fn();
          } finally { inflight.set(p, inflight.get(p) - 1); }
        };
        return Object.freeze({
          id: p.split('/').pop(), path: p,
          async get() {
            log.push(['get', p]);
            await wait();
            const f = failReads.shift();
            if (f) throw f;
            if (!docs.has(p)) return { id: p.split('/').pop(), exists: false, data: () => undefined, metadata: { fromCache: false, hasPendingWrites: false } };
            const body = Object.freeze(JSON.parse(docs.get(p)));
            return { id: p.split('/').pop(), exists: true, data: () => body, metadata: { fromCache: false, hasPendingWrites: false } };
          },
          set(data) {
            if (!data || typeof data !== 'object' || Array.isArray(data)) return Promise.reject({ code: 'invalid_argument', message: 'body must be an object' });
            const json = JSON.stringify(data);
            if (json.length > 262144) return Promise.reject({ code: 'invalid_argument', message: 'document over 256 KiB' });
            return write('set', () => docs.set(p, json));
          },
          delete() { return write('delete', () => docs.delete(p)); },
        });
      },
      collection(p) { check(p, false); return Object.freeze({ path: p }); },
    };
    return { db: Object.freeze(db), docs, log, failWrites, failReads, stats: () => ({ maxInflight }) };
  },
};
</script>`;

// ------------------------------------------------------------------ setup

let server, browser;

function rgb(hex) { return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); }
function dist(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(ORIGIN + '/index.html'); if (r.ok) return; } catch (e) { /* not yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('test server did not start on ' + ORIGIN);
}

async function newPage(init) {
  const ctx = await browser.newContext();
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(ORIGIN + '/index.html');
  await page.waitForFunction(() => !!window.FiveSBring && !!window.T);
  return { ctx, page, errors };
}

test.before(async () => {
  fs.mkdirSync(path.join(WWW, 'fx'), { recursive: true });
  fs.copyFileSync(SRC, path.join(WWW, 'bring.js'));
  fs.writeFileSync(path.join(WWW, 'index.html'), PAGE);
  const gen = path.join(SCRATCH, 'make_bring_fixtures.py');
  fs.writeFileSync(gen, GEN);
  execFileSync('python3', [gen, path.join(WWW, 'fx')], { stdio: 'inherit' });
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', WWW], { stdio: 'ignore' });
  await waitForServer();
  browser = await playwright.chromium.launch();
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

// ------------------------------------------------------------------ process()

const results = {};

test('process: every fixture, sizes, caps, shapes', async () => {
  const { ctx, page, errors } = await newPage();
  for (const name of ['photo.jpg', 'flat.png', 'tall.png', 'wide.png', 'alpha.png', 'halfnoise.png', 'big.jpg', 'exif.jpg']) {
    const out = await page.evaluate((n) => T.run(n), name);
    assert.ok(out.ok, name + ': ' + out.message);
    const r = out.r;
    results[name] = r;
    assert.equal(r.kindGuess, 'image');
    assert.ok(Math.max(r.w, r.h) <= 720, `${name}: ${r.w}x${r.h}`);
    assert.ok(r.img.startsWith('data:image/webp;base64,'), name + ': img is WebP');
    assert.ok(r.img.length < 180000, `${name}: img ${r.img.length} chars`);
    assert.ok(r.thumb.startsWith('data:image/webp;base64,'));
    const im = await page.evaluate((u) => T.look(u), r.img);
    assert.deepEqual([im.w, im.h], [r.w, r.h], name + ': w, h are the img size');
    const th = await page.evaluate((u) => T.look(u), r.thumb);
    assert.deepEqual([th.w, th.h], [128, 128], name + ': thumb is 128 square');
    assert.equal(r.colours.length, 3);
    for (const c of r.colours) assert.match(c, /^#[0-9a-f]{6}$/);
    const [x, y, cw, ch] = r.crop;
    assert.ok(x >= 0 && y >= 0 && cw > 0 && ch > 0 && x + cw <= 1.0001 && y + ch <= 1.0001, `${name}: crop ${r.crop}`);
    // the window is square in pixels, a quarter of the shorter edge
    const side = Math.min(r.w, r.h) / 4;
    assert.ok(Math.abs(cw * r.w - ch * r.h) <= 2.5, `${name}: crop square (${cw * r.w} x ${ch * r.h})`);
    assert.ok(Math.abs(cw * r.w - side) <= 3, `${name}: crop side ${cw * r.w} vs ${side}`);
    assert.ok(r.texture >= 0 && r.texture <= 1);
  }
  for (const [n, r] of Object.entries(results)) {
    console.log(`# ${n}: ${r.w}x${r.h} img ${r.img.length} thumb ${r.thumb.length} colours ${r.colours.join(' ')} crop ${r.crop.join(',')} texture ${r.texture}`);
  }
  // sizes and orientation
  assert.deepEqual([results['tall.png'].w, results['tall.png'].h], [180, 720]);
  assert.deepEqual([results['wide.png'].w, results['wide.png'].h], [720, 90]);
  assert.deepEqual([results['big.jpg'].w, results['big.jpg'].h], [720, 540]);
  assert.deepEqual([results['photo.jpg'].w, results['photo.jpg'].h], [640, 480]);
  assert.deepEqual([results['exif.jpg'].w, results['exif.jpg'].h], [300, 600], 'EXIF orientation 6 is applied');
  const ex = await page.evaluate((u) => T.look(u, [[0.5, 0.1], [0.5, 0.9]]), results['exif.jpg'].img);
  assert.ok(ex.px[0][0] > 150 && ex.px[0][2] < 90, 'rotated: red on top ' + ex.px[0]);
  assert.ok(ex.px[1][2] > 150 && ex.px[1][0] < 90, 'rotated: blue below ' + ex.px[1]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('process: colours match the known dominant colours', () => {
  const p = results['photo.jpg'].colours.map(rgb);
  const want = [[196, 85, 58], [47, 93, 124], [232, 217, 176]];   // 50 / 30 / 20 %
  want.forEach((c, i) => assert.ok(dist(p[i], c) < 20, `photo colour ${i}: ${results['photo.jpg'].colours[i]} vs ${c}`));
  const f = results['flat.png'].colours.map(rgb);
  assert.ok(dist(f[0], [122, 139, 108]) < 6, 'flat colour ' + results['flat.png'].colours[0]);
  for (const c of f) assert.ok(dist(c, [122, 139, 108]) < 12, 'flat is one colour (padded): ' + results['flat.png'].colours);
  const a = results['alpha.png'].colours.map(rgb);
  for (const c of a) assert.ok(dist(c, [214, 40, 40]) < 30, 'alpha: transparency ignored: ' + results['alpha.png'].colours);
  const big = results['big.jpg'].colours.map(rgb);
  assert.ok(dist(big[0], [120, 90, 60]) < 40, 'big: the ground leads ' + results['big.jpg'].colours);
  const wide = results['wide.png'].colours.map(rgb);
  const stripes = [[20, 120, 80], [240, 230, 210]];
  stripes.forEach((s) => assert.ok(wide.slice(0, 2).some((c) => dist(c, s) < 20), 'wide stripes ' + results['wide.png'].colours));
});

test('process: the surface crop finds texture and skips the flat and the margins', () => {
  const [x, y, w, h] = results['halfnoise.png'].crop;
  assert.ok(x >= 0.5, 'half-flat/half-noisy: crop on the noisy half: ' + results['halfnoise.png'].crop);
  assert.ok(x + w <= 0.96 + 1e-4 && y >= 0.04 - 1e-4 && y + h <= 0.96 + 1e-4, 'off the outer 4%');
  assert.ok(results['halfnoise.png'].texture >= 0.3, 'the noisy half has texture: ' + results['halfnoise.png'].texture);
  const big = results['big.jpg'];
  assert.ok(big.crop[1] >= 0.4, 'big: the crop is on the grainy ground, not the smooth sky: ' + big.crop);
  assert.ok(big.texture > results['photo.jpg'].texture && big.texture >= 0.3, 'big: ground texture ' + big.texture);
  const fl = results['flat.png'];
  assert.ok(fl.texture <= 0.05, 'flat texture ' + fl.texture);
  assert.ok(Math.abs(fl.crop[0] + fl.crop[2] / 2 - 0.5) < 0.01 && Math.abs(fl.crop[1] + fl.crop[3] / 2 - 0.5) < 0.01, 'flat: the centre window ' + fl.crop);
  // the alpha disc: the window sits inside the opaque disc (radius 0.35 of the side)
  const a = results['alpha.png'].crop;
  const corners = [[a[0], a[1]], [a[0] + a[2], a[1]], [a[0], a[1] + a[3]], [a[0] + a[2], a[1] + a[3]]];
  for (const [cx, cy] of corners) assert.ok(Math.hypot(cx - 0.5, cy - 0.5) <= 0.35 + 0.01, 'alpha crop inside the disc ' + a);
  for (const n of ['photo.jpg', 'tall.png', 'wide.png', 'big.jpg', 'halfnoise.png', 'alpha.png']) {
    const c = results[n].crop;
    assert.ok(c[0] >= 0.04 - 1e-4 && c[1] >= 0.04 - 1e-4 && c[0] + c[2] <= 0.96 + 1e-4 && c[1] + c[3] <= 0.96 + 1e-4, n + ' crop off the margins ' + c);
  }
});

test('process: alpha is kept in WebP', async () => {
  const { ctx, page } = await newPage();
  const px = await page.evaluate((u) => T.look(u, [[0.5, 0.5], [0.02, 0.02]]), results['alpha.png'].thumb);
  assert.ok(px.px[0][3] === 255 && px.px[0][0] > 150, 'thumb centre is the red disc ' + px.px[0]);
  assert.ok(px.px[1][3] < 10, 'thumb corner stays transparent ' + px.px[1]);
  await ctx.close();
});

test('process: a hard-to-compress image still fits the cap (quality, then size, steps down)', async () => {
  const { ctx, page } = await newPage();
  const out = await page.evaluate(() => T.run('noise.png'));
  assert.ok(out.ok, out.message);
  const r = out.r;
  console.log(`# noise.png: ${r.w}x${r.h} img ${r.img.length} chars`);
  assert.ok(r.img.length < 180000, 'under the cap: ' + r.img.length);
  assert.ok(Math.max(r.w, r.h) <= 720 && Math.max(r.w, r.h) >= 240);
  assert.ok(Math.abs(r.w / r.h - 4 / 3) < 0.02, 'aspect kept');
  const im = await page.evaluate((u) => T.look(u), r.img);
  assert.deepEqual([im.w, im.h], [r.w, r.h]);
  await ctx.close();
});

test('process: JPEG where WebP cannot be encoded, flattened on white', async () => {
  const { ctx, page, errors } = await newPage(() => {
    const td = HTMLCanvasElement.prototype.toDataURL, tb = HTMLCanvasElement.prototype.toBlob;
    const t = (type) => (type === 'image/webp' ? 'image/png' : type);   // as a browser without a WebP encoder answers
    HTMLCanvasElement.prototype.toDataURL = function (type, q) { return td.call(this, t(type), q); };
    HTMLCanvasElement.prototype.toBlob = function (cb, type, q) { return tb.call(this, cb, t(type), q); };
  });
  const out = await page.evaluate(() => T.run('alpha.png'));
  assert.ok(out.ok, out.message);
  assert.ok(out.r.img.startsWith('data:image/jpeg;base64,'), out.r.img.slice(0, 30));
  assert.ok(out.r.thumb.startsWith('data:image/jpeg;base64,'));
  assert.ok(out.r.img.length < 180000);
  const px = await page.evaluate((u) => T.look(u, [[0.5, 0.5], [0.02, 0.02]]), out.r.img);
  assert.ok(px.px[0][0] > 150 && px.px[0][1] < 90, 'centre red ' + px.px[0]);
  assert.ok(px.px[1][0] > 240 && px.px[1][1] > 240 && px.px[1][2] > 240, 'transparent corner is white ' + px.px[1]);
  assert.deepEqual(out.r.colours, results['alpha.png'].colours, 'analysis does not depend on the encoder');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('process: without createImageBitmap, an <img> decodes it (EXIF still applied)', async () => {
  const { ctx, page } = await newPage(() => { window.createImageBitmap = undefined; });
  const ex = await page.evaluate(() => T.run('exif.jpg'));
  assert.ok(ex.ok, ex.message);
  assert.deepEqual([ex.r.w, ex.r.h], [300, 600]);
  const px = await page.evaluate((u) => T.look(u, [[0.5, 0.1], [0.5, 0.9]]), ex.r.img);
  assert.ok(px.px[0][0] > 150 && px.px[1][2] > 150, 'red on top, blue below');
  const ph = await page.evaluate(() => T.run('photo.jpg'));
  assert.deepEqual([ph.r.w, ph.r.h], [640, 480]);
  ph.r.colours.forEach((c, i) => assert.ok(dist(rgb(c), rgb(results['photo.jpg'].colours[i])) < 6, 'same colours by either decoder'));
  const bad = await page.evaluate(() => T.run('corrupt.jpg'));
  assert.equal(bad.message, UNREADABLE);
  await ctx.close();
});

test('process: rejects non-images with a plain message', async () => {
  const { ctx, page } = await newPage();
  for (const [name, type] of [['notimage.txt', undefined], ['corrupt.jpg', undefined], ['notimage.txt', 'image/png'], ['notimage.txt', '']]) {
    const out = await page.evaluate(([n, t]) => T.run(n, t), [name, type]);
    assert.equal(out.ok, false, name);
    assert.equal(out.isError, true);
    assert.equal(out.message, UNREADABLE, name + ' as ' + type);
    assert.equal(out.code, 'unreadable');
  }
  const empty = await page.evaluate(() => T.run(new File([], 'empty.png', { type: 'image/png' })));
  assert.equal(empty.message, UNREADABLE);
  const none = await page.evaluate(async () => { try { await FiveSBring.process(null); return 'resolved'; } catch (e) { return e.message; } });
  assert.equal(none, UNREADABLE);
  // a rejected file does not block the next one
  const after = await page.evaluate(() => T.run('photo.jpg'));
  assert.equal(after.ok, true);
  await ctx.close();
});

test('process: deterministic for the same file, by fetch or by the file picker', async () => {
  const { ctx, page } = await newPage();
  const a = await page.evaluate(() => T.run('photo.jpg'));
  const b = await page.evaluate(() => T.run('photo.jpg'));
  assert.deepEqual(a.r, b.r);
  assert.deepEqual(a.r, results['photo.jpg'], 'same result in a fresh page');
  await page.setInputFiles('#f', [path.join(WWW, 'fx', 'halfnoise.png'), path.join(WWW, 'fx', 'photo.jpg')]);
  const picked = await page.evaluate(async () => {
    const files = Array.from(document.getElementById('f').files);
    return Promise.all(files.map((f) => FiveSBring.process(f)));   // concurrent calls queue
  });
  assert.deepEqual(picked[0], results['halfnoise.png']);
  assert.deepEqual(picked[1], results['photo.jpg']);
  await ctx.close();
});

test('process: a 4000 x 3000 JPEG well under 1.5 s', async () => {
  const { ctx, page } = await newPage();
  const times = [];
  for (let i = 0; i < 3; i++) {
    const out = await page.evaluate(() => T.run('big.jpg'));
    assert.ok(out.ok);
    times.push(Math.round(out.ms));
  }
  console.log('# big.jpg process() ms:', times.join(', '));
  assert.ok(times[0] < 1500, 'first run ' + times[0] + ' ms');
  assert.ok(times.slice().sort((x, y) => x - y)[1] < 1000, 'median ' + times);
  await ctx.close();
});

// ------------------------------------------------------------------ newId

test('newId: "y" + 5 base36 characters, varied', async () => {
  const { ctx, page } = await newPage();
  const ids = await page.evaluate(() => Array.from({ length: 300 }, () => FiveSBring.newId()));
  for (const id of ids) assert.match(id, /^y[0-9a-z]{5}$/);
  assert.equal(new Set(ids).size, ids.length);
  const chars = new Set(ids.join('').slice(1));
  assert.ok(chars.size >= 30, 'uses the base36 alphabet');
  await ctx.close();
});

// ------------------------------------------------------------------ stores

test('store: IndexedDB round-trips and persists across a reload', async () => {
  const { ctx, page, errors } = await newPage();
  const one = await page.evaluate(async () => {
    const r = await FiveSBring.process(await T.file('photo.jpg'));
    const s = FiveSBring.store({ db: null, uid: null });
    const kind0 = s.kind;
    const ready = await s.ready;
    await s.put('yabc12', { img: r.img, thumb: r.thumb, at: 1761050000 });
    const got = await s.get('yabc12');
    const thumb = await s.thumb('yabc12');
    const missing = await s.get('yzzzzz');
    return { kind0, ready, kind: s.kind, same: got.img === r.img && got.thumb === r.thumb && got.at === 1761050000, thumbOk: thumb === r.thumb, missing, img: r.img };
  });
  assert.deepEqual([one.kind0, one.ready, one.kind], ['device', 'device', 'device']);
  assert.ok(one.same && one.thumbOk);
  assert.equal(one.missing, null);
  await page.reload();
  await page.waitForFunction(() => !!window.FiveSBring);
  const two = await page.evaluate(async (img) => {
    const s = FiveSBring.store({ db: null, uid: null });
    const got = await s.get('yabc12');
    const raw = await new Promise((res) => {
      const q = indexedDB.open('5s');
      q.onsuccess = () => {
        const t = q.result.transaction('own', 'readonly').objectStore('own').get('yabc12');
        t.onsuccess = () => { res(Object.keys(t.result).sort()); q.result.close(); };
      };
    });
    await s.remove('yabc12');
    return { persisted: !!got && got.img === img, raw, after: await s.get('yabc12'), thumbAfter: await s.thumb('yabc12') };
  }, one.img);
  assert.ok(two.persisted, 'image survives a reload');
  assert.deepEqual(two.raw, ['at', 'img', 'thumb'], 'stored as {img, thumb, at} in db "5s", store "own"');
  assert.equal(two.after, null);
  assert.equal(two.thumbAfter, null);
  await page.reload();
  await page.waitForFunction(() => !!window.FiveSBring);
  assert.equal(await page.evaluate(() => FiveSBring.store({}).get('yabc12')), null, 'removed for good');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('store: memory when there is no IndexedDB, and when it fails to open', async () => {
  const none = await newPage(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
  const a = await none.page.evaluate(async () => {
    const s = FiveSBring.store({ db: null, uid: null });
    const k = s.kind;
    await s.put('ymem01', { img: 'data:image/webp;base64,AAAA', thumb: 'data:image/webp;base64,BBBB', at: 5 });
    const got = await s.get('ymem01');
    const th = await s.thumb('ymem01');
    await s.remove('ymem01');
    return { k, ready: await s.ready, got, th, after: await s.get('ymem01') };
  });
  assert.equal(a.k, 'visit');
  assert.equal(a.ready, 'visit');
  assert.deepEqual(a.got, { img: 'data:image/webp;base64,AAAA', thumb: 'data:image/webp;base64,BBBB', at: 5 });
  assert.equal(a.th, 'data:image/webp;base64,BBBB');
  assert.equal(a.after, null);
  await none.ctx.close();

  const broken = await newPage(() => {
    const idb = window.indexedDB;
    Object.defineProperty(window, 'indexedDB', { configurable: true, value: { open() { throw new Error('SecurityError'); }, deleteDatabase: idb.deleteDatabase.bind(idb) } });
  });
  const b = await broken.page.evaluate(async () => {
    const s = FiveSBring.store({ db: null, uid: null });
    const seen = [];
    s.onKind((k) => seen.push(k));
    const k0 = s.kind;
    const ready = await s.ready;
    await s.put('ymem02', { img: 'data:image/png;base64,CCCC', thumb: null, at: 7 });
    return { k0, ready, kind: s.kind, seen, got: await s.get('ymem02') };
  });
  assert.deepEqual([b.k0, b.ready, b.kind], ['device', 'visit', 'visit']);
  assert.deepEqual(b.seen, ['visit']);
  assert.deepEqual(b.got, { img: 'data:image/png;base64,CCCC', thumb: null, at: 7 });
  await broken.ctx.close();
});

test('store: private documents at data/users/<uid>/own-<id>, one write at a time', async () => {
  const { ctx, page, errors } = await newPage();
  const r = await page.evaluate(async () => {
    const F = T.fakeDb(20);
    const s = FiveSBring.store({ db: F.db, uid: 'user_01:a@b' });
    const v = { img: 'data:image/webp;base64,IMG1', thumb: 'data:image/webp;base64,TH1', at: 1761050000 };
    const writing = s.put('yq7k2a', v);
    const reads0 = F.log.filter((e) => e[0] === 'get').length;
    const whileWriting = await s.get('yq7k2a');   // a write in flight reads back at once
    const pendingRead = whileWriting && whileWriting.img === v.img && F.log.filter((e) => e[0] === 'get').length === reads0;
    await writing;
    const body = JSON.parse(F.docs.get('data/users/user_01:a@b/own-yq7k2a'));
    const got = await s.get('yq7k2a');
    const logBefore = F.log.length;
    const th = await s.thumb('yq7k2a');
    const cachedThumb = F.log.length === logBefore;
    // five puts at once to one document: never two in flight, the last one wins
    const many = [1, 2, 3, 4, 5].map((i) => s.put('yq7k2b', { img: 'data:image/webp;base64,V' + i, thumb: null, at: i }));
    await Promise.all(many);
    const last = JSON.parse(F.docs.get('data/users/user_01:a@b/own-yq7k2b'));
    const setsB = F.log.filter((e) => e[0] === 'set' && e[1].endsWith('own-yq7k2b')).length;
    // two documents at once may overlap
    await Promise.all([s.put('yq7k2c', v), s.put('yq7k2d', v)]);
    await s.remove('yq7k2a');
    const gone = await s.get('yq7k2a');
    return { kind: s.kind, pendingRead, body, got, th, cachedThumb, last, setsB, gone, log: F.log, stats: F.stats(), paths: Array.from(F.docs.keys()) };
  });
  assert.equal(r.kind, 'private');
  assert.ok(r.pendingRead, 'get() during a put answers from the write in flight');
  assert.deepEqual(r.body, { img: 'data:image/webp;base64,IMG1', thumb: 'data:image/webp;base64,TH1', at: 1761050000 });
  assert.deepEqual(r.got, r.body);
  assert.equal(r.th, r.body.thumb);
  assert.ok(r.cachedThumb, 'thumb() is cached');
  assert.equal(r.last.img, 'data:image/webp;base64,V5');
  assert.ok(r.setsB <= 2, 'queued writes coalesce: ' + r.setsB + ' sets');
  assert.equal(r.stats.maxInflight, 1, 'one write at a time per document');
  assert.equal(r.gone, null);
  for (const [op, p] of r.log) {
    const segs = p.split('/');
    assert.equal(segs.length, 4, p);
    assert.match(p, /^data\/users\/user_01:a@b\/own-y[0-9a-z]{5}$/, op + ' ' + p);
  }
  assert.ok(r.log.some(([op, p]) => op === 'delete' && p.endsWith('own-yq7k2a')));
  assert.deepEqual(r.paths.sort(), ['data/users/user_01:a@b/own-yq7k2b', 'data/users/user_01:a@b/own-yq7k2c', 'data/users/user_01:a@b/own-yq7k2d']);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('store: db rejections: unavailable retried, quota said plainly, invalid_argument falls back to the device', async () => {
  const { ctx, page } = await newPage();
  const r = await page.evaluate(async () => {
    const v = { img: 'data:image/webp;base64,IMG', thumb: 'data:image/webp;base64,TH', at: 1 };
    const out = {};
    // unavailable once: retried, saved
    let F = T.fakeDb(5);
    let s = FiveSBring.store({ db: F.db, uid: 'u1' });
    F.failWrites.push({ code: 'unavailable', message: 'blip' });
    await s.put('yaaaa1', v);
    out.retried = F.log.filter((e) => e[0] === 'set').length === 2 && F.docs.has('data/users/u1/own-yaaaa1');
    // quota_exceeded: a plain message, nothing changes
    F.failWrites.push({ code: 'quota_exceeded', message: 'database full' });
    try { await s.put('yaaaa2', v); out.quota = 'resolved'; } catch (e) { out.quota = [e.message, e.code, s.kind]; }
    // a bad uid never reaches the db
    const bad = T.fakeDb(5);
    const sb = FiveSBring.store({ db: bad.db, uid: 'not/a/segment' });
    out.badUid = [sb.kind, await sb.ready];
    await sb.put('yaaaa3', v);
    out.badUidLog = bad.log.length;
    // no uid, or no db: the device
    out.noUid = FiveSBring.store({ db: F.db, uid: null }).kind;
    out.noDb = FiveSBring.store({ db: null, uid: 'u1' }).kind;
    // invalid_argument (e.g. a view-only member): this visit falls back to the device
    F = T.fakeDb(5);
    s = FiveSBring.store({ db: F.db, uid: 'u2' });
    const seen = [];
    s.onKind((k) => seen.push(k));
    F.failWrites.push({ code: 'invalid_argument', message: 'cannot write here' });
    await s.put('yaaaa4', v);
    const n = F.log.length;
    await s.put('yaaaa5', v);
    out.fallback = { kind: s.kind, seen, dbUntouched: F.log.length === n, docs: F.docs.size };
    const dev = FiveSBring.store({ db: null, uid: null });
    out.onDevice = [(await dev.get('yaaaa4')) !== null, (await dev.get('yaaaa5')) !== null];
    out.readBack = (await s.get('yaaaa4')) !== null;
    // a revoked grant also falls back
    F = T.fakeDb(5);
    s = FiveSBring.store({ db: F.db, uid: 'u3' });
    F.failWrites.push({ code: 'revoked', message: 'gone' });
    await s.put('yaaaa6', v);
    out.revoked = s.kind;
    // a builder TypeError (a path the store refuses) counts as invalid_argument
    const throwing = Object.freeze({ doc() { throw new TypeError('bad path'); }, collection() { throw new TypeError('bad'); } });
    s = FiveSBring.store({ db: throwing, uid: 'u4' });
    await s.put('yaaaa7', v);
    out.typeError = s.kind;
    // invalid input is refused plainly
    try { await s.put('bad/id', v); } catch (e) { out.badId = e.message; }
    try { await s.put('yaaaa8', { img: 'javascript:alert(1)' }); } catch (e) { out.badImg = e.message; }
    try { await s.put('yaaaa9', { img: 'data:image/webp;base64,' + 'A'.repeat(260000) }); } catch (e) { out.tooBig = [e.message, e.code]; }
    return out;
  });
  assert.ok(r.retried, 'unavailable is retried once');
  assert.deepEqual(r.quota, ["There's no room left to keep more images. Remove something you've brought in, then try again.", 'full', 'private']);
  assert.deepEqual(r.badUid, ['device', 'device']);
  assert.equal(r.badUidLog, 0);
  assert.equal(r.noUid, 'device');
  assert.equal(r.noDb, 'device');
  assert.deepEqual(r.fallback, { kind: 'device', seen: ['device'], dbUntouched: true, docs: 0 });
  assert.deepEqual(r.onDevice, [true, true]);
  assert.ok(r.readBack);
  assert.equal(r.revoked, 'device');
  assert.equal(r.typeError, 'device');
  assert.ok(r.badId && r.badImg && r.tooBig, JSON.stringify(r));
  assert.equal(r.tooBig[1], 'too_large');
  await ctx.close();
});

test('store: migrateFrom copies device and visit images into the private store', async () => {
  const { ctx, page } = await newPage();
  const r = await page.evaluate(async () => {
    const dev = FiveSBring.store({ db: null, uid: null });
    await dev.ready;
    const v = (i) => ({ img: 'data:image/webp;base64,M' + i, thumb: 'data:image/webp;base64,T' + i, at: i });
    await dev.put('ymig01', v(1));
    await dev.put('ymig02', v(2));
    const F = T.fakeDb(5);
    const priv = FiveSBring.store({ db: F.db, uid: 'me' });
    // before migrating, the private store still shows device images
    const fallThrough = (await priv.get('ymig01')) !== null;
    const n = await priv.migrateFrom(dev, ['ymig01', 'ymig02', 'ymissing', 'ymig01']);
    const again = await priv.migrateFrom(dev, ['ymig01', 'ymig02']);
    const self = await dev.migrateFrom(FiveSBring.store({ db: null, uid: null }), ['ymig01']);
    // a visit store (no IndexedDB) migrates too
    const visitN = await (async () => {
      const F2 = T.fakeDb(5);
      const p2 = FiveSBring.store({ db: F2.db, uid: 'me' });
      const fakeVisit = { kind: 'visit', get: async (id) => (id === 'yvis01' ? v(9) : null) };
      const c = await p2.migrateFrom(fakeVisit, ['yvis01', 'yvis02']);
      return [c, Array.from(F2.docs.keys())];
    })();
    // remove() on the private store clears the device copy too
    await priv.remove('ymig02');
    const devAfter = await dev.get('ymig02');
    const sets = F.log.filter((e) => e[0] === 'set').map((e) => e[1]);
    return { fallThrough, n, again, self, visitN, sets, docs: Array.from(F.docs.keys()).sort(), devAfter, body: JSON.parse(F.docs.get('data/users/me/own-ymig01')) };
  });
  assert.ok(r.fallThrough);
  assert.equal(r.n, 2);
  assert.equal(r.again, 0, 'already there: nothing copied twice');
  assert.equal(r.self, 0, 'device to device: nothing to copy');
  assert.deepEqual(r.visitN, [1, ['data/users/me/own-yvis01']]);
  assert.deepEqual(r.sets, ['data/users/me/own-ymig01', 'data/users/me/own-ymig02']);
  assert.deepEqual(r.docs, ['data/users/me/own-ymig01']);
  assert.deepEqual(r.body, { img: 'data:image/webp;base64,M1', thumb: 'data:image/webp;base64,T1', at: 1 });
  assert.equal(r.devAfter, null);
  await ctx.close();
});
