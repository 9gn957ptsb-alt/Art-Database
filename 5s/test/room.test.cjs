// 5s room: src/room.js, the photo room (SPEC-room-from-structure §4, §7.2, §8).
//
//   node --test 5s/test/room.test.cjs
//
// The pure part in Node: the perspective (corners and their inverse round-trip, scale growing toward the camera),
// the guessed box (inside the photo, every corner in front of the camera), how a thing goes by the place it is in,
// and the words, on the synthetic fixture's cards through the engine's own whatIs.
// Then mount in Chromium (Playwright), on the fixture's rooms with app.css: the layers each place draws, the
// pointer buttons (aria-hidden, at least 44 px, onPick), update, rugs shot from above, at an angle and filling their
// photo, a Surface On a wall with the other walls painted, the guess for an unmarked or brought room and its light, a
// pinned mini, a photo that fails, a photo the canvas cannot read (another origin), resizing, Reduce Motion,
// Step in's gate, light and dark at 390 and 1280. No server: the page's files are answered from 5s/ by
// Playwright's routes. Saves screenshots for a person to look at.
// Environment: ROOM_SHOTS (default: <tmpdir>/5s-room-shots).
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');                       // 5s/
const R = require('../src/room.js');
const F = require('../src/engine.js');
const DECK = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixture', 'deck.json'), 'utf8'));
const card = (id) => DECK.cards.find((c) => c.id === id);
const thing = (id) => { const c = card(id); return Object.assign({ id, src: c.img ? 'test/fixture/' + c.img : null, w: c.w, h: c.h, colours: c.colours }, F.whatIs(c)); };
const SHOTS = process.env.ROOM_SHOTS || path.join(os.tmpdir(), '5s-room-shots');
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, (msg || '') + ': ' + a + ' vs ' + b);
// The homography's w at the unit square's corners (the deck build's corners_w): all > 0 is every corner in front.
const cornersW = (q) => { const H = R.sq2quad(q); return [1, 1 + H[6], 1 + H[6] + H[7], 1 + H[7]]; };

// ---------------------------------------------------------------- pure

test('the quad corners land, and the inverse brings them back (the mock\'s self-check)', () => {
  const quads = [[[10, 5], [90, 12], [80, 70], [5, 60]], [[0, 0], [1, 0], [1, 1], [0, 1]], card('s001').room.planes.f.q,
    card('s003').room.planes.f.q, R.boxFromGuess({ vp: [30, 40], floor: 70 }, 720, 480).planes.f.q];
  for (const q of quads) {
    const H = R.sq2quad(q), I = R.inv(H);
    [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], k) => {
      const p = R.apply(H, u, v);
      assert.ok(Math.hypot(p[0] - q[k][0], p[1] - q[k][1]) < 1e-6, 'corner ' + k);
      const b = I(p[0], p[1]);
      assert.ok(Math.hypot(b[0] - u, b[1] - v) < 1e-6, 'inverse ' + k);
    });
    const m = R.m3d(H, 400, 300);
    assert.match(m, /^matrix3d\((-?[\d.e-]+,){15}-?[\d.e-]+\)$/);
  }
});

test('a plane\'s scale is positive across a floor and grows toward the camera; toCm undoes toPx', () => {
  for (const room of [card('s001').room, card('s003').room, R.boxFromGuess({ vp: [60, 42], floor: 66 }, 600, 520)]) {
    const P = R.planeOf(room, 'f', 600, 520);
    let last = 0;
    for (let k = 0; k <= 10; k++) {   // from the far edge (plane y 0) to the near one
      const s = P.scale(P.W / 2, P.Hh * k / 10);
      assert.ok(s > 0, 'positive');
      assert.ok(s >= last - 1e-9, 'nearer is bigger');
      last = s;
      const px = P.toPx(P.W * 0.3, P.Hh * k / 10), cm = P.toCm(...px);
      near(cm[0], P.W * 0.3, 1e-6, 'x'); near(cm[1], P.Hh * k / 10, 1e-6, 'y');
    }
    assert.equal(R.planeOf(room, 'nope', 600, 520), null);
  }
});

test('boxFromGuess stays inside the photo and puts every corner in front of the camera', () => {
  for (const vx of [0, 12, 50, 88, 100]) for (const vy of [0, 20, 45, 70, 100]) for (const fl of [0, 30, 60, 90, 100]) {
    for (const [w, h] of [[720, 480], [480, 720], [600, 600]]) {
      const g = R.boxFromGuess({ vp: [vx, vy], floor: fl }, w, h), tag = [vx, vy, fl, w, h].join(',');
      assert.equal(g.guess, true);
      assert.equal(g.paint, null, 'its walls stay its own; the colour is its light');
      for (const [id, p] of Object.entries(g.planes)) {
        assert.ok(cornersW(p.q).every((x) => x > 0), 'in front: ' + id + ' ' + tag);
        assert.ok(p.size.every((x) => x > 0 && x < 10000), 'sizes: ' + id + ' ' + tag);
      }
      const inside = (pt) => pt.every((v) => v >= 0 && v <= 100);
      assert.ok(g.floor.outline.every(inside), 'the floor outline ' + tag);
      for (const [k, sp] of Object.entries(g.spots)) {
        assert.ok(inside(sp.at), 'spot ' + k + ' ' + tag);
        if (sp.plane) assert.ok(g.planes[sp.plane], 'its plane exists');
        if (sp.top != null) assert.ok(sp.top >= 0 && sp.top <= sp.at[1], 'the ceiling is above the lamp ' + tag);
      }
      assert.ok(g.spots.hang.at[1] < g.planes.f.q[0][1], 'the picture hangs above the floor line ' + tag);
      // the far wall stands on the floor's far edge, and the floor's sides run to where the room points
      assert.deepEqual(g.planes.w1.q[3], g.planes.f.q[0]);
      assert.deepEqual(g.planes.w1.q[2], g.planes.f.q[1]);
    }
  }
  // one vanishing point: the floor's sides meet at vp (a level camera, so the far edge is level)
  const g = R.boxFromGuess({ vp: [40, 45], floor: 65 }, 720, 480), [tl, , , bl] = g.planes.f.q, [tr, , br] = [g.planes.f.q[1], 0, g.planes.f.q[2]];
  const at = (a, b, y) => a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
  near(at(bl, tl, 45), 40, 1e-6, 'left side'); near(at(br, tr, 45), 40, 1e-6, 'right side');
  near(tl[1], 65, 1e-9, 'floor line');
});

test('howIn: a thing goes by the place it is in', () => {
  assert.equal(R.howIn('picture', thing('o003')), 'hang', 'a wall hanging is hung');
  assert.equal(R.howIn('picture', thing('i001')), 'hang');
  assert.equal(R.howIn('window', thing('s010')), 'see');
  assert.equal(R.howIn('wall', thing('c001')), 'paint');
  assert.equal(R.howIn('floor', thing('u001')), 'lay');
  assert.equal(R.howIn('object', thing('o001')), 'lay', 'a rug is laid');
  assert.equal(R.howIn('object', thing('o002')), 'light', 'a pendant lights it');
  assert.equal(R.howIn('object', thing('o006')), 'light', 'a floor lamp lights it');
  assert.equal(R.howIn('object', thing('o005')), 'set', 'a vase is set on a top');
  assert.equal(R.howIn('object', thing('o009')), 'stand');
  assert.equal(R.howIn('object', thing('o008')), 'light', 'an `art, light` neon in the object place goes by its other role');
  assert.equal(R.howIn('object', thing('o007')), 'stand', 'a `thing, art` dish stands');
  assert.equal(R.howIn('object', null), 'stand');
});

test('words: the room\'s own names, said by the place', () => {
  const s1 = card('s001').room, s3 = card('s003').room;
  const w = (m, k, id, as) => R.words(m, k, id ? thing(id) : null, as);
  assert.deepEqual(w(s1, 'picture', 'i001'), { rel: 'hung on the back wall', line: 'A painting, hung on the back wall' });
  assert.deepEqual(w(s1, 'window', 's010'), { rel: 'seen through the tall window', line: 'A bay at low tide, seen through the tall window' });
  assert.deepEqual(w(s3, 'window', 's010'), { rel: 'hung beside it', line: 'A bay at low tide, hung beside it' }, 'no window: beside the picture');
  assert.equal(w(s1, 'object', 'o002').line, 'A pendant lamp, lighting the room, over the middle');
  assert.equal(w(s1, 'object', 'o006').line, 'A floor lamp, lighting the room, by the back wall', 'a lamp with no ceiling role stands');
  assert.equal(w(s1, 'object', 'o001').line, 'A rug, laid in the middle');
  assert.equal(w(s1, 'object', 'o005').line, 'A vase, standing by the back wall', 'no table top marked: it stands');
  assert.equal(w(s3, 'object', 'o005').line, 'A vase, set on the table');
  assert.equal(w(s1, 'object', 'o009').line, 'A sculpture, standing by the back wall');
  // the walls: painted where plaster is marked, else its light; its own when chosen
  const tan = Object.assign(thing('c001'), { what: 'tan, olive and off-white' });
  assert.deepEqual(R.words(s1, 'wall', tan, {}), { rel: 'painted on the back wall', line: 'Tan, painted on the back wall' }, 'painted by default');
  assert.deepEqual(R.words(s1, 'wall', tan, { wall: 'light' }), { rel: 'its light', line: 'Its own: white plaster. Your tan is its light' });
  assert.deepEqual(R.words(s1, 'wall', tan, { wall: 'own' }), { rel: 'its own', line: 'Its own: white plaster' });
  assert.deepEqual(R.words(s3, 'wall', tan, { wall: 'paint' }), { rel: 'its light', line: 'Its own: timber panels. Your tan is its light' }, 'never painted where none is marked');
  assert.deepEqual(R.words(s1, 'wall', null, {}), { rel: 'its own', line: 'Its own: white plaster' });
  // the floor: its own first; a Surface laid, or on the painted wall
  assert.deepEqual(w(s1, 'floor', 'u003', {}), { rel: 'its own', line: 'Its own: oak boards' }, 'its own by default');
  assert.deepEqual(w(s1, 'floor', 'u003', { floor: 'laid' }), { rel: 'laid as its floor', line: 'Grey stone, laid as its floor' });
  assert.deepEqual(w(s1, 'floor', 'u003', { floor: 'wall' }), { rel: 'laid on the back wall', line: 'Grey stone, laid on the back wall' });
  assert.deepEqual(w(s1, 'wall', null, { wall: 'paint', floor: 'wall' }), { rel: 'its own', line: 'Its own: white plaster' });
  assert.equal(R.words(s1, 'wall', tan, { floor: 'wall' }).rel, 'its light', 'a surface on the wall: the colour is its light');
  assert.equal(w(s3, 'floor', 'u003', { floor: 'wall' }).line, 'Its own: grey stone', 'nothing painted to lay it on');
  // empty places: no line (the app's own words stay)
  for (const k of ['picture', 'window', 'object']) assert.equal(w(s1, k, null).line, null, k);
  // an unmarked room, or a brought one, says the guess's words
  for (const m of [null, undefined, { vp: [50, 45], floor: 60 }, { planes: {} }]) {
    assert.equal(w(m, 'picture', 'i001').line, 'A painting, hung on the far wall');
    assert.equal(w(m, 'window', 's010').line, 'A bay at low tide, hung beside it');
    assert.equal(w(m, 'object', 'o002').line, 'A pendant lamp, lighting the room, from the ceiling');
    assert.equal(w(m, 'object', 'o009').line, 'A sculpture, standing on the right');
    assert.equal(w(m, 'object', 'o001').line, 'A rug, laid on the floor');
    assert.equal(R.words(m, 'wall', tan, {}).line, 'Its own walls. Your tan is its light');
    assert.equal(w(m, 'floor', 'u001', {}).line, 'Its own floor');
  }
  // plain words: no "5s", no gendered pronouns
  const all = JSON.stringify(['picture', 'window', 'object', 'wall', 'floor'].map((k) => R.words(s1, k, thing('o002'), {})));
  assert.ok(!/5s|\b(he|she|his|her|him)\b/i.test(all), all);
});

// s001's photo marked with a second wall (the left one), painted too: a Surface On a wall goes on the picture's wall
// and the paint stays on the other.
const TWO = (() => {
  const m = JSON.parse(JSON.stringify(card('s001').room));
  m.planes.w2 = { q: [[0, 0], [25, 15], [25, 60], [0, 100]], size: [250, 300] };
  m.paint = { polys: [m.paint.polys[0], [[2, 3], [23, 16], [23, 58], [2, 95]]], name: 'the white walls' };
  return m;
})();

test('a Surface on a wall: on the picture\'s wall, the paint moves to the other walls, or becomes the light', () => {
  assert.ok(cornersW(TWO.planes.w2.q).every((x) => x > 0), 'the made-up wall is in front of the camera');
  const tan = Object.assign(thing('c001'), { what: 'tan, olive and off-white' }), stone = thing('u003');
  assert.deepEqual(R.words(TWO, 'floor', stone, { floor: 'wall' }), { rel: 'laid on the picture’s wall', line: 'Grey stone, laid on the picture’s wall' });
  assert.deepEqual(R.words(TWO, 'wall', tan, { floor: 'wall' }), { rel: 'painted on the other walls', line: 'Tan, painted on the other walls' });
  assert.deepEqual(R.words(TWO, 'wall', tan, {}), { rel: 'painted on the white walls', line: 'Tan, painted on the white walls' }, 'both walls painted otherwise');
  assert.equal(R.words(TWO, 'wall', tan, { wall: 'light', floor: 'wall' }).rel, 'its light', 'as light stays its light');
  // paint marked only on a wall the picture is not on: the surface goes there, and the colour is its light
  const left = Object.assign({}, TWO, { paint: { polys: [TWO.paint.polys[1]], name: 'the left wall' } });
  assert.deepEqual(R.words(left, 'floor', stone, { floor: 'wall' }), { rel: 'laid on the left wall', line: 'Grey stone, laid on the left wall' });
  assert.equal(R.words(left, 'wall', tan, { floor: 'wall' }).rel, 'its light');
});

// ---------------------------------------------------------------- mount, in a browser

let playwright = null;
try { playwright = require('playwright'); } catch (e) { try { playwright = require('/opt/node22/lib/node_modules/playwright'); } catch (e2) { playwright = null; } }

const HOME = 'http://room.test', OTHER = 'http://other.test';   // answered from 5s/ by routes; OTHER is another origin
const PAGE = `<!doctype html>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>room test</title>
<link rel="stylesheet" href="/src/app.css">
<style>body { margin: 0; background: var(--paper); color: var(--ink); } #wrap { box-sizing: border-box; padding: 16px; width: 390px; } .mini { width: 160px; }</style>
<div id="wrap"><div id="r"></div></div>
<div id="minis" style="padding:16px"></div>
<script src="/src/engine.js"></script>
<script src="/src/room.js"></script>
<script>
window.T = {
  deck: null, picks: [], fails: 0, steps: 0, h: null,
  async init() { this.deck = await (await fetch('/test/fixture/deck.json')).json(); },
  card(id) { return this.deck.cards.find((c) => c.id === id); },
  thing(id, origin) { const c = this.card(id); return Object.assign({ id, src: c.img ? (origin || '') + '/test/fixture/' + c.img : null, w: c.w, h: c.h, colours: c.colours }, FiveS.whatIs(c)); },
  // a picture drawn here, as a data URL (same origin, so the canvas can read it)
  draw(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d')); return c.toDataURL('image/png'); },
  rug(src) { return { id: 'rug-' + src.length, src, w: 400, h: 400, colours: ['#aa3322'], what: 'a rug', roles: ['textile', 'floor'], key: 'object', how: 'lay', cm: 200 }; },
  opts(room, set, o) {
    const c = this.card(room), x = o || {};
    const things = {};
    for (const [k, id] of Object.entries(set)) things[k] = id ? this.thing(id, x.thingOrigin) : null;
    return Object.assign({ id: room, src: (x.origin || '') + '/test/fixture/' + c.img, w: c.w, h: c.h, marks: 'marks' in x ? x.marks : c.room || null, things,
      name: c.title, onPick: (k) => this.picks.push(k), onFail: () => { this.fails++; } }, x.more || {});
  },
  async mount(room, set, o) {
    if (this.h) this.h.destroy();
    const el = document.getElementById('r'); el.className = 'proom';
    this.h = FiveSRoom.mount(el, this.opts(room, set, o));
    const ok = await this.h.ready;
    return { ok, ...this.look(el) };
  },
  async mini(room, set) {
    const el = document.createElement('div'); el.className = 'proom mini'; document.getElementById('minis').appendChild(el);
    const h = FiveSRoom.mount(el, Object.assign(this.opts(room, set), { interactive: false }));
    await h.ready;
    return this.look(el);
  },
  look(el) {
    const q = (s) => el.querySelectorAll(s).length, ph = el.querySelector('.photo'), box = el.getBoundingClientRect();
    const hits = [...el.querySelectorAll('.rhit')].map((b) => { const r = b.getBoundingClientRect(); return { key: b.dataset.key, w: r.width, h: r.height, hidden: b.getAttribute('aria-hidden'), tab: b.tabIndex, shown: !b.hidden, cx: (r.left + r.width / 2 - box.left) / box.width * 100, cy: (r.top + r.height / 2 - box.top) / box.height * 100 }; });
    const rel = (s) => { const n = el.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return { x: (r.left - box.left) / box.width * 100, y: (r.top - box.top) / box.height * 100, w: r.width / box.width * 100, h: r.height / box.height * 100 }; };
    const paint = el.querySelector('.paint');
    return {
      ready: el.dataset.ready || null, elHidden: el.getAttribute('aria-hidden'), w: box.width, h: box.height,
      photo: ph ? { role: ph.getAttribute('role'), alt: ph.alt, hidden: ph.getAttribute('aria-hidden') } : null,
      n: { paint: q('.paint'), light: q('.lightwash'), laid: q('.laid'), shade: q('.shade'), view: q('.viewclip'), hung: q('.hung'), framed: q('.hung.framed'), photoFrame: q('.hung.photo'), bare: q('.hung.bare'),
        rug: q('.rug'), upright: q('.upright'), whole: q('.upright.whole'), base: q('.base'), foot: q('.foot'), glow: q('.glow'), rname: q('.rname'), stepin: q('.stepin'), fade: q('.rfade') },
      paintMask: paint ? (paint.style.webkitMaskImage || paint.style.maskImage || '') : '', paintClip: paint ? paint.style.clipPath : '',
      hits, upright: rel('.upright'), hung: rel('.hung.framed') || rel('.hung'), rug: rel('.rug'),
      layersHidden: [...el.querySelectorAll('.rlayer')].every((l) => l.getAttribute('aria-hidden') === 'true'),
      pics: [...el.querySelectorAll('.hung img')].map((i) => i.getAttribute('src')),
    };
  },
};
</script>`;

const MIME = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
async function serve(route) {
  const u = new URL(route.request().url());
  if (u.pathname === '/' || u.pathname === '/room.html') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: PAGE });
  const file = path.join(ROOT, decodeURIComponent(u.pathname));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not here' });
  return route.fulfill({ contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
}

let browser = null;
async function newPage({ width = 390, height = 844, theme = 'light', reducedMotion = 'no-preference' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, reducedMotion, deviceScaleFactor: 2 });
  await ctx.route(HOME + '/**', serve);
  await ctx.route(OTHER + '/**', serve);
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(HOME + '/room.html');
  await page.evaluate(() => T.init());
  return { ctx, page, errors };
}
const SET1 = { wall: 'c001', window: 's010', picture: 'i001', floor: 'u001', object: 'o002' };

const browserTest = (name, fn) => test(name, { skip: playwright ? false : 'Playwright is not installed', timeout: 60000 }, fn);

test.before(async () => {
  if (!playwright) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  browser = await playwright.chromium.launch();
});
test.after(async () => { if (browser) await browser.close(); });

browserTest('a marked room: each thing where what it is belongs, the photo labelled, the buttons for pointers only', async () => {
  const { ctx, page, errors } = await newPage();
  const r = await page.evaluate((s) => T.mount('s001', s, { more: { label: 'Fixture space 1, by You: your room, a white hall with a tall window.' } }), SET1);
  assert.equal(r.ok, true); assert.equal(r.ready, '1');
  assert.deepEqual(r.photo, { role: 'img', alt: 'Fixture space 1, by You: your room, a white hall with a tall window.', hidden: null });
  assert.equal(r.layersHidden, true, 'the drawn layers are aria-hidden');
  near(r.w, 358, 0.5, 'width'); near(r.h, 358 * 520 / 600, 1, 'the photo\'s aspect');
  assert.equal(r.n.paint, 1, 'its plaster is painted'); assert.match(r.paintMask, /^url\("blob:/, 'through the likeness mask');
  assert.equal(r.n.light, 0);
  assert.equal(r.n.view, 1, 'the view through its one pane'); assert.equal(r.n.framed, 1, 'the painting hung, framed');
  assert.equal(r.n.laid, 0, 'the floor is its own until a Surface is chosen');
  assert.equal(r.n.upright, 1); assert.equal(r.n.glow, 1, 'the pendant lights it'); assert.equal(r.n.foot, 0, 'a hanging lamp casts no foot shadow');
  assert.equal(r.n.rname, 1); assert.equal(r.n.stepin, 0, 'no Step in without the gate');
  // in perspective, at its spot: the picture centred on the hang spot, the lamp hung from the marked ceiling
  const spots = (await page.evaluate(() => T.card('s001').room.spots));
  near(r.hung.x + r.hung.w / 2, spots.hang.at[0], 1, 'picture x'); near(r.hung.y + r.hung.h / 2, spots.hang.at[1], 1, 'picture y');
  near(r.upright.y, spots.light.top, 0.5, 'the lamp hangs from the ceiling');
  near(r.upright.x + r.upright.w / 2, spots.light.at[0], 1, 'over its spot');
  // five pointer buttons: aria-hidden, out of the tab order, at least 44 x 44, over what they press
  assert.deepEqual(r.hits.map((h) => h.key), ['wall', 'floor', 'window', 'picture', 'object']);
  for (const h of r.hits) {
    assert.equal(h.hidden, 'true'); assert.equal(h.tab, -1); assert.ok(h.shown);
    assert.ok(h.w >= 43.5 && h.h >= 43.5, h.key + ' ' + h.w + 'x' + h.h);
  }
  near(r.hits[3].cx, spots.hang.at[0], 1.5, 'the picture\'s button');
  near(r.hits[0].cx, spots.paint.at[0], 0.5); near(r.hits[1].cy, spots.floor.at[1], 0.5);
  for (const k of ['wall', 'floor', 'window', 'picture', 'object']) await page.$eval('.rhit[data-key="' + k + '"]', (b) => b.click());
  assert.deepEqual(await page.evaluate(() => T.picks), ['wall', 'floor', 'window', 'picture', 'object']);
  await page.locator('#wrap').screenshot({ path: path.join(SHOTS, 'room-s001-390-light.png') });
  // the topmost button wins where they overlap: a tap on the lamp picks the object
  const lamp = await page.locator('.upright').boundingBox();
  await page.mouse.click(lamp.x + lamp.width / 2, lamp.y + lamp.height / 2);
  assert.equal(await page.evaluate(() => T.picks[T.picks.length - 1]), 'object');
  assert.deepEqual(errors, []);
  await ctx.close();
});

browserTest('update redraws one place, fading in; the walls and the floor follow as', async () => {
  const { ctx, page, errors } = await newPage();
  await page.evaluate((s) => T.mount('s001', s), SET1);
  const look = () => page.evaluate(() => T.look(document.getElementById('r')));
  await page.evaluate(() => T.h.update('picture', T.thing('i002')));
  let r = await look();
  assert.deepEqual(r.pics, ['/test/fixture/img/i002.webp']); assert.ok(r.n.fade >= 1, 'it fades in');
  assert.equal(r.n.paint, 1, 'the rest stays');
  await page.evaluate(() => T.h.update('picture', T.thing('o003')));
  r = await look(); assert.equal(r.n.bare, 1, 'a wall hanging hangs with no frame');
  await page.evaluate(() => T.h.update('as', { wall: 'light' }));
  r = await look(); assert.equal(r.n.paint, 0); assert.equal(r.n.light, 1, 'as light');
  await page.evaluate(() => T.h.update('as', { wall: 'own' }));
  r = await look(); assert.equal(r.n.paint + r.n.light, 0, 'its own walls');
  await page.evaluate(() => T.h.update('as', { wall: 'paint', floor: 'laid' }));
  r = await look(); assert.equal(r.n.laid, 1, 'a Surface laid as its floor'); assert.equal(r.n.shade, 1, 'under the photo\'s own floor light'); assert.equal(r.n.paint, 1);
  assert.match(await page.$eval('.laid .tiles', (d) => d.style.backgroundImage), /u001\.webp/);
  await page.locator('#wrap').screenshot({ path: path.join(SHOTS, 'room-s001-laid.png') });
  await page.evaluate(() => T.h.update('as', { wall: 'paint', floor: 'wall' }));
  r = await look(); assert.equal(r.n.laid, 1, 'laid on the painted wall'); assert.equal(r.n.paint, 0); assert.equal(r.n.light, 1, 'the colour becomes its light');
  await page.evaluate(() => T.h.update('object', T.thing('o001')));
  r = await look(); assert.equal(r.n.rug, 1, 'a rug lies flat'); assert.equal(r.n.upright, 0);
  await page.evaluate(() => T.h.update('object', T.thing('o006')));
  r = await look(); assert.equal(r.n.upright, 1); assert.equal(r.n.glow, 1); assert.equal(r.n.foot, 1, 'a floor lamp stands, glowing');
  await page.evaluate(() => T.h.update('object', T.thing('o009')));
  r = await look(); assert.equal(r.n.glow, 0); assert.equal(r.n.foot, 1);
  const stand = await page.evaluate(() => T.card('s001').room.spots.stand.at);
  near(r.upright.y + r.upright.h, stand[1], 0.5, 'its foot on the spot');
  await page.evaluate(() => T.h.update('object', null));
  r = await look(); assert.equal(r.n.upright, 0); assert.ok(r.hits.find((h) => h.key === 'object').shown, 'an empty place can still be pressed');
  await page.evaluate(() => T.h.update('window', null));
  r = await look(); assert.equal(r.n.view, 0);
  assert.deepEqual(r.hits.map((h) => h.key), ['wall', 'floor', 'window', 'picture', 'object'], 'the buttons keep their order');
  assert.deepEqual(errors, []);
  await ctx.close();
});

browserTest('a rug shot at an angle lies as its cut-out, one that fills its photo lies whole; On a wall keeps the other walls painted; a guessed room\'s light', async () => {
  const { ctx, page, errors } = await newPage();
  await page.evaluate((s) => T.mount('s001', s), SET1);
  const look = () => page.evaluate(() => T.look(document.getElementById('r')));
  // a rhombus on white: a rug shot at an angle, already in perspective
  await page.evaluate(() => T.h.update('object', T.rug(T.draw(400, 400, (x) => {
    x.fillStyle = '#fff'; x.fillRect(0, 0, 400, 400); x.fillStyle = '#a33';
    x.beginPath(); x.moveTo(40, 200); x.lineTo(200, 120); x.lineTo(360, 200); x.lineTo(200, 280); x.fill();
  }))));
  let r = await look();
  assert.equal(r.n.rug, 0); assert.equal(r.n.upright, 1, 'it lies as its cut-out'); assert.equal(r.n.foot + r.n.base + r.n.glow, 0, 'no shadow, base or glow');
  const lay = await page.evaluate(() => T.card('s001').room.spots.lay.at);
  near(r.upright.x + r.upright.w / 2, lay[0], 0.5, 'centred on its spot: x'); near(r.upright.y + r.upright.h / 2, lay[1], 0.5, 'y');
  // a pattern on a dark field that fills its photo: the whole photo lies flat, not the pattern cut from it
  await page.evaluate(() => T.h.update('object', T.rug(T.draw(300, 400, (x) => {
    x.fillStyle = '#111'; x.fillRect(0, 0, 300, 400); x.fillStyle = '#c22';
    for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) { x.beginPath(); x.arc(30 + 60 * i, 25 + 58 * j, 24, 0, 7); x.fill(); }
  }))));
  r = await look();
  assert.equal(r.n.rug, 1); assert.equal(r.n.upright, 0);
  assert.match(await page.$eval('.rug', (d) => d.style.backgroundImage), /^url\("data:image\/png/, 'its own photo');
  // On a wall in a room painted on two walls: the surface on the picture's wall, the paint stays on the other
  r = await page.evaluate(([s, m]) => T.mount('s001', s, { marks: m, more: { as: { floor: 'wall' } } }), [Object.assign({}, SET1, { floor: 'u003' }), TWO]);
  assert.equal(r.n.laid, 1); assert.equal(r.n.paint, 1, 'the other wall stays painted'); assert.equal(r.n.light, 0);
  assert.match(r.paintMask, /^url\("blob:/);
  const tiles = await page.evaluate(() => {
    const el = document.getElementById('r'), b = el.getBoundingClientRect(), t = el.querySelector('.laid .tiles').getBoundingClientRect();
    return [(t.left - b.left) / b.width * 100, (t.top - b.top) / b.height * 100, t.width / b.width * 100, t.height / b.height * 100];
  });
  [25, 15, 50, 45].forEach((v, i) => near(tiles[i], v, 0.5, 'tiled in the picture\'s wall\'s perspective ' + i));
  await page.locator('#wrap').screenshot({ path: path.join(SHOTS, 'room-s001-on-a-wall.png') });
  // the photo unreadable, two painted stretches on the one wall: one clip each, and the colour is its light
  const halves = Object.assign({}, await page.evaluate(() => T.card('s001').room), { paint: { polys: [[[25, 15], [50, 15], [50, 60], [25, 60]], [[50, 15], [75, 15], [75, 60], [50, 60]]], name: 'the back wall' } });
  r = await page.evaluate(([s, m]) => T.mount('s001', s, { marks: m, origin: 'http://other.test', thingOrigin: 'http://other.test', more: { as: { floor: 'wall' } } }), [Object.assign({}, SET1, { floor: 'u003' }), halves]);
  assert.equal(r.n.laid, 2); assert.equal(r.n.paint, 0); assert.equal(r.n.light, 1);
  assert.deepEqual(await page.$$eval('.laid', (ds) => ds.map((d) => /^polygon\(/.test(d.style.clipPath))), [true, true]);
  // a guessed room's daylight comes from the photo's brightest part
  const sunny = await page.evaluate(() => T.draw(400, 300, (x) => { x.fillStyle = '#222'; x.fillRect(0, 0, 400, 300); x.fillStyle = '#fff'; x.beginPath(); x.arc(320, 60, 40, 0, 7); x.fill(); }));
  r = await page.evaluate(([s, src]) => T.mount('s005', s, { marks: null, more: { id: 'sunny', src, w: 400, h: 300 } }), [SET1, sunny]);
  assert.equal(r.ok, true); assert.equal(r.n.light, 1);
  const sun = await page.evaluate(() => T.h.room.sun);
  near(sun[0], 80, 5, 'its light, x'); near(sun[1], 20, 7, 'its light, y');
  assert.deepEqual(errors, []);
  await ctx.close();
});

browserTest('a room never painted, with no window: its light, the view beside the picture, a vase on the table', async () => {
  const { ctx, page, errors } = await newPage({ theme: 'dark' });
  const r = await page.evaluate(() => T.mount('s003', { wall: 'c002', window: 's010', picture: 'i002', floor: 'u001', object: 'o005' }));
  assert.equal(r.ok, true);
  assert.equal(r.n.paint, 0); assert.equal(r.n.light, 1, 'paint: null, so the colour is its light');
  assert.equal(r.n.view, 0); assert.equal(r.n.photoFrame, 1, 'the view hangs beside it');
  const room = await page.evaluate(() => T.card('s003').room);
  // the picture fills the marked box (160 x 110 cm on a 500 cm wall, 60 % of the photo wide)
  // i002 is 600 x 720: 83 x 100 cm, scaled to fill the 160 x 110 cm box, so 92 x 110 cm on the 500 x 330 cm wall
  const [bw, bh] = room.spots.hang.box, s = Math.min(bw / (100 * 600 / 720), bh / 100);
  const wallW = room.planes.w1.q[1][0] - room.planes.w1.q[0][0], wallH = room.planes.w1.q[2][1] - room.planes.w1.q[0][1];
  near(r.hung.h, 100 * s / 330 * wallH, 0.3, 'fills the box: height'); near(r.hung.w, 100 * 600 / 720 * s / 500 * wallW, 0.3, 'width');
  near(r.upright.y + r.upright.h, room.spots.set.top, 0.5, 'set on the marked top');
  assert.equal(r.n.foot, 0, 'no floor shadow under a thing on a table');
  await page.locator('#wrap').screenshot({ path: path.join(SHOTS, 'room-s003-390-dark.png') });
  assert.deepEqual(errors, []);
  await ctx.close();
});

browserTest('an unmarked room and a brought one are guessed; a pinned mini is quiet', async () => {
  const { ctx, page, errors } = await newPage();
  let r = await page.evaluate((s) => T.mount('s005', s), SET1);
  assert.equal(r.ok, true);
  const g = await page.evaluate(() => ({ guess: T.h.room.guess, paint: T.h.room.paint, f: T.h.room.planes.f.q }));
  assert.equal(g.guess, true); assert.equal(g.paint, null);
  assert.equal(r.n.light, 1, 'the walls stay its own; the colour is its light');
  assert.equal(r.n.photoFrame, 1, 'the view hangs beside the picture'); assert.equal(r.n.framed, 1);
  assert.equal(r.photo.alt, 'Fixture space 5: your room.', 'the default label');
  await page.locator('#wrap').screenshot({ path: path.join(SHOTS, 'room-s005-guess.png') });
  // a brought room's own floor lines (own.room) are used as they are
  r = await page.evaluate((s) => T.mount('s007', s, { marks: { vp: [40, 42], floor: 70 } }), SET1);
  const b = await page.evaluate(() => T.h.room.planes.f.q);
  near(b[0][1], 70, 1e-6, 'the floor line'); assert.equal(r.ok, true);
  // a mini: everything aria-hidden, no buttons, no name
  const m = await page.evaluate((s) => T.mini('s001', s), SET1);
  assert.equal(m.elHidden, 'true'); assert.equal(m.hits.length, 0); assert.equal(m.n.rname, 0);
  assert.equal(m.photo.hidden, 'true'); assert.equal(m.photo.alt, '');
  assert.equal(m.n.paint, 1, 'drawn as the room is'); near(m.w, 160, 0.5); near(m.h, 160 * 520 / 600, 1);
  assert.deepEqual(errors, []);
  await ctx.close();
});

browserTest('a photo that fails tells the app; one the canvas cannot read is clipped instead', async () => {
  const { ctx, page, errors } = await newPage();
  const r = await page.evaluate((s) => T.mount('s001', s, { more: { src: '/test/fixture/img/none.webp' } }), SET1);
  assert.equal(r.ok, false); assert.equal(r.ready, 'fail');
  assert.equal(await page.evaluate(() => T.fails), 1);
  // another origin: the paint is clipped to its outline, the lamp stands whole on its base, an unmarked room takes the default guess
  const x = await page.evaluate((s) => T.mount('s001', s, { origin: 'http://other.test', thingOrigin: 'http://other.test' }), Object.assign({}, SET1, { object: 'o009' }));
  assert.equal(x.ok, true); assert.equal(x.n.paint, 1);
  assert.equal(x.paintMask, ''); assert.match(x.paintClip, /^polygon\(/);
  assert.equal(x.n.whole, 1); assert.equal(x.n.base, 1);
  await page.evaluate((s) => T.h.update('as', { floor: 'laid' }), null);
  assert.match(await page.$eval('.laid', (d) => d.style.clipPath), /^polygon\(/, 'the laid floor is clipped to its outline');
  const y = await page.evaluate((s) => T.mount('s005', s, { origin: 'http://other.test' }), SET1);
  assert.equal(y.ok, true);
  near(await page.evaluate(() => T.h.room.planes.f.q[0][1]), 63, 1e-9, 'the default guess');
  assert.deepEqual(errors, []);
  await ctx.close();
});

browserTest('it keeps the photo\'s aspect when the box changes; Reduce Motion stops the fade; Step in only through its gate', async () => {
  const { ctx, page, errors } = await newPage({ reducedMotion: 'reduce' });
  await page.evaluate((s) => T.mount('s001', s), SET1);
  await page.evaluate(() => { document.getElementById('wrap').style.width = '632px'; });
  await page.waitForFunction(() => Math.abs(document.getElementById('r').getBoundingClientRect().height - 600 * 520 / 600) < 1);
  const sc = await page.$eval('.rstage', (s) => s.style.transform);
  assert.equal(sc, 'scale(' + 600 / 600 + ')');
  await page.evaluate(() => T.h.update('picture', T.thing('i003')));
  const dur = await page.$eval('.rfade', (n) => getComputedStyle(n).animationDuration);
  assert.ok(parseFloat(dur) < 0.01, 'no fade under Reduce Motion: ' + dur);
  const gl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
  const r = await page.evaluate((s) => T.mount('s001', s, { more: { stepIn: () => { T.steps++; } } }), SET1);
  assert.equal(r.n.stepin, gl ? 1 : 0, 'Step in shows only where a WebGL context can be made');
  if (gl) {
    assert.equal(await page.textContent('.stepin'), 'Step in');
    const bb = await page.locator('.stepin').boundingBox(); assert.ok(bb.height >= 44);
    await page.click('.stepin'); assert.equal(await page.evaluate(() => T.steps), 1);
  }
  await page.evaluate(() => T.h.destroy());
  assert.equal(await page.$eval('#r', (el) => el.children.length), 0, 'destroy empties it');
  assert.deepEqual(errors, []);
  await ctx.close();
  const p2 = await newPage();
  await p2.page.evaluate((s) => T.mount('s001', s), SET1);
  await p2.page.evaluate(() => T.h.update('picture', T.thing('i003')));
  assert.equal(await p2.page.$eval('.rfade', (n) => getComputedStyle(n).animationDuration), '0.15s', 'a 150 ms fade otherwise');
  await p2.ctx.close();
});

browserTest('light and dark at 390 and 1280: the photo reads the same, the labels keep their fixed tokens', async () => {
  for (const [width, theme] of [[390, 'light'], [390, 'dark'], [1280, 'light'], [1280, 'dark']]) {
    const { ctx, page, errors } = await newPage({ width, height: 900, theme });
    if (width > 400) await page.evaluate(() => { document.getElementById('wrap').style.width = '752px'; });
    const r = await page.evaluate((s) => T.mount('s001', s), Object.assign({}, SET1, { object: 'o006' }));
    assert.equal(r.ok, true);
    const label = await page.$eval('.rname', (n) => { const s = getComputedStyle(n); return [s.backgroundColor, s.color]; });
    assert.deepEqual(label, ['rgba(255, 255, 255, 0.72)', 'rgb(22, 19, 31)']);
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
    assert.ok(scroll, 'no sideways scroll');
    await page.locator('#wrap').screenshot({ path: path.join(SHOTS, 'room-s001-' + width + '-' + theme + '.png') });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
