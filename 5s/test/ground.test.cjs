// 5s ground: src/ground.js in a real browser (Playwright + Chromium).
//
//   node --test 5s/test/ground.test.cjs
//
// Serves 5s/ (src/ and the synthetic fixture's images) with python3 -m http.server, renders
// FiveSGround on a page with the fixture's surfaces (test/fixture/img/u00*.webp) at 340 and 900 px
// wide, DPR 1 and 2, light and dark, with and without a house, with 0 surfaces and 0 passed colours,
// failing images and tiny canvases; checks determinism, the true isometry (edges at 30 degrees, not
// the 2:1 games convention), that nothing touches the canvas's edges, the grow and stop(), and that
// the page logs no console errors. Saves screenshots for a person to look at.
// Environment: GROUND_PORT (default 8761), GROUND_SHOTS (default: <tmpdir>/5s-ground-shots).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require('/opt/node22/lib/node_modules/playwright'); }

const ROOT = path.join(__dirname, '..');                       // 5s/
const PORT = Number(process.env.GROUND_PORT || 8761);
const ORIGIN = `http://127.0.0.1:${PORT}`;
const PAGE_URL = ORIGIN + '/__ground_test__.html';
const SHOTS = process.env.GROUND_SHOTS || path.join(os.tmpdir(), '5s-ground-shots');

// The fixture's taste: warm kept colours, cool passed ones; ten Surface crops.
const KEPT = ['#c4622d', '#e8b07a', '#d9822b', '#f2d0a4', '#cf7a3c', '#4a8a9a', '#e0a040'];
const PASSED = ['#2f5d8a', '#9cc3e4', '#132a40', '#3b6fb6', '#d7e6f5', '#5560a8', '#c3c7ea'];
const SURFACES = Array.from({ length: 10 }, (_, k) => ({ src: `test/fixture/img/u${String(k + 1).padStart(3, '0')}.webp`, crop: null }));
const SURFACES_PLUS_BROKEN = SURFACES.concat([{ src: 'test/fixture/img/no-such-surface.webp', crop: null }]);
const HOUSE = { wall: '#2f6f73', trim: '#b5452a', accent: '#f3e1b8' };
const SEED = '5S-4F2A-9C1E';

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>ground test</title>
<style>
  :root { --bg: #FAF9FC; }
  @media (prefers-color-scheme: dark) { :root { --bg: #100E18; } }
  html, body { margin: 0; background: var(--bg); }
  #wrap { padding: 16px; width: 340px; }
  #c { display: block; width: 100%; aspect-ratio: 16 / 11; }
</style>
<div id="wrap"><canvas id="c"></canvas></div>
<script src="/src/engine.js"></script>
<script src="/src/ground.js"></script>
<script>
window.T = {
  // A spec from plain options; rand is a fresh seeded PRNG every time (FiveS.prng, the app's own).
  spec(o) {
    return {
      rand: FiveS.prng(o.seed),
      surfaces: o.surfaces, kept: o.kept, passed: o.passed, house: o.house,
      size: o.size, grow: !!o.grow, theme: o.theme,
    };
  },
  layout(w, aspect) {
    document.getElementById('wrap').style.width = w + 'px';
    document.getElementById('c').style.aspectRatio = aspect || '16 / 11';
  },
  stats(c) {
    const W = c.width, H = c.height;
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    let painted = 0, edge = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = d[(y * W + x) * 4 + 3];
        if (a) painted++;
        if (a && (x < 2 || y < 2 || x >= W - 2 || y >= H - 2)) edge++;
      }
    }
    return { W, H, painted: painted / (W * H), edge };
  },
  // The slopes of the plinth's two bottom edges, from its opaque silhouette (the soft shadow is
  // translucent): true isometry gives tan 30 = 0.5774; the 2:1 games convention would give 0.5.
  slopes(c) {
    const W = c.width, H = c.height;
    const d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const op = (x, y) => d[(y * W + x) * 4 + 3] === 255;
    let minX = W, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (op(x, y)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y > maxY) maxY = y; }
    const lowest = (x) => { for (let y = H - 1; y >= 0; y--) if (op(x, y)) return y; return -1; };
    let bx = 0, bn = 0;
    for (let x = 0; x < W; x++) if (op(x, maxY)) { bx += x; bn++; }
    bx /= bn;
    // Measure a little inside the corners, where anti-aliasing does not round them.
    const inset = Math.round((bx - minX) * 0.15);
    const xl = minX + inset, xr = maxX - inset;
    const left = (lowest(Math.round(bx - inset)) - lowest(xl)) / (Math.round(bx - inset) - xl);
    const right = (lowest(Math.round(bx + inset)) - lowest(xr)) / (xr - Math.round(bx + inset));
    return { left, right };
  },
  async run(o) {
    const c = document.getElementById('c');
    const t0 = performance.now();
    const r = await FiveSGround.render(c, T.spec(o));
    return { r, ms: performance.now() - t0, url: c.toDataURL(), stats: T.stats(c) };
  },
};
</script>`;

let server, browser;

function waitForServer() {
  return new Promise((resolve, reject) => {
    const until = Date.now() + 10000;
    const poke = () => {
      http.get(ORIGIN + '/src/ground.js', (res) => { res.resume(); res.statusCode === 200 ? resolve() : retry(); }).on('error', retry);
    };
    const retry = () => (Date.now() > until ? reject(new Error('server did not start')) : setTimeout(poke, 100));
    poke();
  });
}

// A page at a DPR, colour scheme and motion preference; console errors and page errors collected.
async function newPage({ dpr = 1, theme = 'light', reducedMotion = 'no-preference', allow = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 }, deviceScaleFactor: dpr, colorScheme: theme, reducedMotion });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !allow.some((a) => m.text().includes(a))) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.route(PAGE_URL, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE }));
  await page.goto(PAGE_URL);
  await page.waitForFunction(() => !!window.FiveSGround && !!window.FiveS && !!window.T);
  return { ctx, page, errors };
}

const base = (o = {}) => Object.assign({ seed: SEED, surfaces: SURFACES, kept: KEPT, passed: PASSED, house: HOUSE, theme: 'light' }, o);

async function shot(page, name) {
  const file = path.join(SHOTS, name + '.png');
  await page.locator('#wrap').screenshot({ path: file });
  return file;
}

function checkWords(r, { house, n = 9 }) {
  assert.equal(r.land + r.water, n * n, 'every tile is land or water');
  assert.ok(r.land >= 1 && r.water >= 1, `land ${r.land}, water ${r.water}`);
  assert.equal(r.house, house);
  assert.ok(r.description.includes(`Land: ${r.land} tile`), r.description);
  assert.ok(r.description.includes(`Water: ${r.water} tile`), r.description);
  assert.equal(/A house in [a-z ]+ with an? [a-z ]+ roof, on the highest ground\./.test(r.description), house, r.description);
  assert.ok(!/\b(he|she|his|her|him)\b/i.test(r.description));
}

test.before(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
  await waitForServer();
  browser = await playwright.chromium.launch();
});

test.after(async () => {
  if (browser) await browser.close();
  if (server) server.kill();
});

test('the API: one frozen global with render and stop; no text drawn, no Math.random', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'ground.js'), 'utf8');
  assert.ok(!/fillText|strokeText/.test(src), 'no text is drawn on the canvas');
  assert.ok(!/Math\.random/.test(src.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, '')), 'Math.random is never used');
  const { ctx, page, errors } = await newPage();
  const api = await page.evaluate(() => ({ frozen: Object.isFrozen(FiveSGround), keys: Object.keys(FiveSGround).sort() }));
  assert.deepEqual(api, { frozen: true, keys: ['render', 'stop'] });
  const bad = await page.evaluate(() => FiveSGround.render(null, {}).then(() => 'resolved', (e) => e.name));
  assert.equal(bad, 'TypeError');
  // Math.random throws: rendering never calls it.
  const r = await page.evaluate(async (o) => { Math.random = () => { throw new Error('Math.random used'); }; return (await T.run(o)).r; }, base());
  checkWords(r, { house: true });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the matrix: 340 and 900 px, DPR 1 and 2, light and dark, with and without a house', async () => {
  for (const dpr of [1, 2]) {
    for (const theme of ['light', 'dark']) {
      const { ctx, page, errors } = await newPage({ dpr, theme });
      for (const w of [340, 900]) {
        await page.evaluate((w) => T.layout(w), w);
        for (const house of [true, false]) {
          const out = await page.evaluate((o) => T.run(o), base({ theme, house: house ? HOUSE : null }));
          const cssH = Math.round(w * 11 / 16);
          assert.ok(Math.abs(out.stats.W - w * dpr) <= 1, `bitmap width ${out.stats.W} for ${w} px at DPR ${dpr}`);
          assert.ok(Math.abs(out.stats.H - cssH * dpr) <= 2, `bitmap height ${out.stats.H} for ${cssH} px at DPR ${dpr}`);
          assert.equal(out.stats.edge, 0, 'nothing drawn on the canvas edge');
          assert.ok(out.stats.painted > 0.3 && out.stats.painted < 0.85, 'painted share ' + out.stats.painted);
          checkWords(out.r, { house });
          assert.ok(out.r.description.includes('from 10 surfaces you kept'), out.r.description);
          assert.ok(out.r.description.includes('colours you passed'), out.r.description);
          const name = `ground-${w}-dpr${dpr}-${theme}-${house ? 'house' : 'nohouse'}`;
          await shot(page, name);
          console.log(`# ${name}: ${Math.round(out.ms)} ms. ${out.r.description}`);
        }
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  }
});

test('true isometry: the plinth\'s edges run at 30 degrees', async () => {
  const { ctx, page, errors } = await newPage({ dpr: 2 });
  await page.evaluate(() => T.layout(900));
  await page.evaluate((o) => T.run(o), base());
  const s = await page.evaluate(() => T.slopes(document.getElementById('c')));
  const want = Math.tan(Math.PI / 6);
  assert.ok(Math.abs(s.left - want) < 0.01, `left edge slope ${s.left} (want ${want.toFixed(4)}; 2:1 would be 0.5)`);
  assert.ok(Math.abs(s.right - want) < 0.01, `right edge slope ${s.right}`);
  console.log(`# slopes: left ${s.left.toFixed(4)}, right ${s.right.toFixed(4)} (tan 30 = ${want.toFixed(4)})`);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('determinism: the same spec gives the same pixels; another seed does not', async () => {
  const a = await newPage({ dpr: 2 });
  await a.page.evaluate(() => T.layout(340));
  const one = await a.page.evaluate((o) => T.run(o), base());
  const two = await a.page.evaluate((o) => T.run(o), base());
  const other = await a.page.evaluate((o) => T.run(o), base({ seed: '5S-0000-0001' }));
  assert.equal(one.url, two.url, 'same spec, same canvas: identical');
  assert.notEqual(one.url, other.url, 'another seed: different');
  assert.notEqual(one.r.description + one.url, other.r.description + other.url);
  // A fresh page (cold image cache) draws the same pixels.
  const b = await newPage({ dpr: 2 });
  await b.page.evaluate(() => T.layout(340));
  const three = await b.page.evaluate((o) => T.run(o), base());
  assert.equal(one.url, three.url, 'same spec on a fresh page: identical');
  assert.deepEqual(one.r, three.r);
  // Same at 900 px, dark, without a house.
  await a.page.evaluate(() => T.layout(900));
  await b.page.evaluate(() => T.layout(900));
  const d1 = await a.page.evaluate((o) => T.run(o), base({ theme: 'dark', house: null }));
  const d2 = await b.page.evaluate((o) => T.run(o), base({ theme: 'dark', house: null }));
  assert.equal(d1.url, d2.url);
  assert.deepEqual(a.errors, []);
  assert.deepEqual(b.errors, []);
  await a.ctx.close();
  await b.ctx.close();
});

test('no surfaces: the land in plain kept colours', async () => {
  for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await newPage({ theme });
    await page.evaluate(() => T.layout(900));
    const out = await page.evaluate((o) => T.run(o), base({ theme, surfaces: [] }));
    checkWords(out.r, { house: true });
    assert.match(out.r.description, /Land: \d+ tiles in \d+ colours you kept\./);
    assert.ok(!out.r.description.includes('surface'));
    assert.equal(out.stats.edge, 0);
    await shot(page, `ground-900-nosurfaces-${theme}`);
    console.log('# ' + out.r.description);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('no passed colours: a default deep water from the theme', async () => {
  for (const theme of ['light', 'dark']) {
    const { ctx, page, errors } = await newPage({ theme });
    await page.evaluate(() => T.layout(900));
    const out = await page.evaluate((o) => T.run(o), base({ theme, passed: [] }));
    checkWords(out.r, { house: true });
    assert.match(out.r.description, /Water: \d+ tiles of plain deep water\./);
    assert.equal(out.stats.edge, 0);
    await shot(page, `ground-900-nopassed-${theme}`);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // Nothing kept, nothing passed, no surfaces, no house: still a ground.
  const { ctx, page, errors } = await newPage();
  await page.evaluate(() => T.layout(340));
  const out = await page.evaluate((o) => T.run(o), base({ surfaces: [], kept: [], passed: [], house: null }));
  checkWords(out.r, { house: false });
  assert.match(out.r.description, /Land: \d+ tiles of plain ground\. Water: \d+ tiles of plain deep water\.$/);
  assert.ok(out.stats.painted > 0.3);
  await shot(page, 'ground-340-empty-light');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('surfaces: a data URL and a brought thing\'s crop; images that fail fall back to colours', async () => {
  const { ctx, page, errors } = await newPage({ allow: ['Failed to load resource'] });
  await page.evaluate(() => T.layout(900));
  const out = await page.evaluate(async (o) => {
    // A small checked texture as a data URL, like a brought thing's image.
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#3b6fb6' : '#e9e6df'; g.fillRect(x * 8, y * 8, 8, 8); }
    o.surfaces = [{ src: c.toDataURL('image/png'), crop: null }, { src: 'test/fixture/img/i001.webp', crop: [0.3, 0.3, 0.25, 0.25] }];
    return T.run(o);
  }, base());
  assert.ok(out.r.description.includes('from 2 surfaces you kept'), out.r.description);
  await shot(page, 'ground-900-dataurl-and-crop');
  // Every image fails: the land falls back to the kept colours, and says so.
  const failed = await page.evaluate((o) => T.run(o), base({
    surfaces: [{ src: 'test/fixture/img/no-such-surface.webp' }, { src: 'data:image/png;base64,AAAA' }, { src: '' }],
  }));
  checkWords(failed.r, { house: true });
  assert.match(failed.r.description, /Land: \d+ tiles in \d+ colours? you kept\./);
  assert.ok(failed.stats.painted > 0.3);
  await shot(page, 'ground-900-images-failed');
  // Some fail: only the drawn ones are counted.
  const some = await page.evaluate((o) => T.run(o), base({ surfaces: SURFACES_PLUS_BROKEN }));
  assert.ok(some.r.description.includes('from 10 of the 11 surfaces you kept'), some.r.description);
  assert.deepEqual(errors, []);
  await ctx.close();
});
test('tiny canvases and sizes', async () => {
  const { ctx, page, errors } = await newPage({ dpr: 2 });
  for (const [w, aspect] of [[1, '1'], [12, '4 / 3'], [40, '4 / 3'], [120, '1'], [320, '16 / 11'], [340, '3 / 1'], [200, '1 / 2']]) {
    await page.evaluate(([w, a]) => T.layout(w, a), [w, aspect]);
    const out = await page.evaluate((o) => T.run(o), base());
    checkWords(out.r, { house: true });
    assert.equal(out.stats.edge, 0, `nothing on the edge at ${w} px (${aspect})`);
    if (w >= 40) assert.ok(out.stats.painted > 0.1, `drawn at ${w} px`);
    if (w === 120 || w === 320) await shot(page, w === 120 ? 'ground-120-square' : 'ground-320-dpr2-light-house');
  }
  // A canvas outside the document keeps its bitmap size; a zero-size one draws nothing and still answers.
  const detached = await page.evaluate(async (o) => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 200;
    const r = await FiveSGround.render(c, T.spec(o));
    const z = document.createElement('canvas');
    z.width = 0; z.height = 0;
    const rz = await FiveSGround.render(z, T.spec(o));
    return { r, w: c.width, h: c.height, stats: T.stats(c), rz };
  }, base());
  assert.deepEqual([detached.w, detached.h], [300, 200]);
  assert.equal(detached.stats.edge, 0);
  assert.ok(detached.stats.painted > 0.3);
  assert.equal(detached.rz.land + detached.rz.water, 81);
  // Board sizes.
  await page.evaluate(() => T.layout(900));
  for (const n of [1, 3, 5, 14]) {
    const out = await page.evaluate((o) => T.run(o), base({ size: n }));
    if (n > 1) checkWords(out.r, { house: true, n });
    else assert.deepEqual([out.r.land, out.r.water], [1, 0]);
    assert.equal(out.stats.edge, 0);
    if (n === 5 || n === 14) await shot(page, `ground-900-size${n}`);
  }
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('grow: animates once, ends on the same pixels; skipped under reduced motion; stop() finishes it', async () => {
  const { ctx, page, errors } = await newPage();
  await page.evaluate(() => T.layout(900));
  const still = await page.evaluate((o) => T.run(o), base());
  // A frame mid-grow, for the eye, then the end.
  const grown = await page.evaluate(async (o) => {
    const c = document.getElementById('c');
    const t0 = performance.now();
    const p = FiveSGround.render(c, T.spec(Object.assign(o, { grow: true })));
    await new Promise((r) => setTimeout(r, 700));
    const mid = c.toDataURL();
    window.__mid = mid;
    await p;
    return { ms: performance.now() - t0, mid, url: c.toDataURL() };
  }, base());
  assert.ok(grown.ms > 1200, 'the grow takes its time: ' + grown.ms);
  assert.notEqual(grown.mid, still.url, 'mid-grow differs');
  assert.equal(grown.url, still.url, 'the last frame is the still render');
  await page.evaluate(async (u) => {
    const img = new Image();
    img.src = u;
    await img.decode();
    const c = document.getElementById('c');
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    c.getContext('2d').drawImage(img, 0, 0);
  }, grown.mid);
  await shot(page, 'ground-900-grow-mid');
  // stop(): resolves at once, on the final frame.
  const stopped = await page.evaluate(async (o) => {
    const c = document.getElementById('c');
    const p = FiveSGround.render(c, T.spec(Object.assign(o, { grow: true })));
    await new Promise((r) => setTimeout(r, 300));
    const t0 = performance.now();
    FiveSGround.stop();
    await p;
    return { ms: performance.now() - t0, url: c.toDataURL() };
  }, base());
  assert.ok(stopped.ms < 200, 'stop() resolves the render: ' + stopped.ms);
  assert.equal(stopped.url, still.url);
  // A second render on the same canvas supersedes a growing one.
  const superseded = await page.evaluate(async (o) => {
    const c = document.getElementById('c');
    const p1 = FiveSGround.render(c, T.spec(Object.assign({}, o, { grow: true })));
    const p2 = FiveSGround.render(c, T.spec(Object.assign({}, o, { seed: '5S-0000-0001' })));
    const [r1, r2] = await Promise.all([p1, p2]);
    return { r1, r2, url: c.toDataURL() };
  }, base());
  const other = await page.evaluate((o) => T.run(o), base({ seed: '5S-0000-0001' }));
  assert.equal(superseded.url, other.url, 'the later render wins');
  assert.deepEqual(superseded.r2, other.r);
  assert.deepEqual(errors, []);
  await ctx.close();
  // Reduced motion: no grow, the still image straight away.
  const rm = await newPage({ reducedMotion: 'reduce' });
  await rm.page.evaluate(() => T.layout(900));
  const quick = await rm.page.evaluate((o) => T.run(Object.assign(o, { grow: true })), base());
  assert.ok(quick.ms < 1000, 'no animation under reduced motion: ' + quick.ms);
  assert.equal(quick.url, still.url);
  assert.deepEqual(rm.errors, []);
  await rm.ctx.close();
});
