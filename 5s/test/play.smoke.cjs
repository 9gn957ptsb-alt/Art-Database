/* 5s play and board smoke test (Playwright + node:test).
 *
 *   node --test 5s/test/play.smoke.cjs
 *
 * Serves 5s/ itself and opens test/play.html, the harness for src/play.js and src/board.js (the deck
 * from 5s/dist, or the fixture when there is no build; an example taste). The boards are deterministic,
 * so this file plans every move in Node with the same engine (src/match.js) and checks the page
 * against it after each one.
 *   SHOTS   folder for screenshots (default <tmp>/5s-play-shots); PORT  the port to serve on (default: any free one)
 *   FONTS   optional folder holding css.css and the font files (named by md5 of url + "\n"), for true type in shots
 *
 * The board: two columns at 390, five at 1280, every tile at its own proportions, lazy images with their
 * sizes, sections by kind, then clusters, paintings and "Not put together yet" once there are pairings.
 * The map: thirty levels climbing, in DOM order, the next one first. The game: a bounce, then swaps by
 * touch drag, tap-tap, Enter and an arrow, Shift+arrow and mouse drags; the Sound button and M; H;
 * a cascade with the CPU slowed 4x within the frame budget (p95 <= 20 ms); a special and a combo;
 * the Pass booster; reduced motion (tiles only ever sit on cells) and its dashed hint; out of moves,
 * Five more, out again, Map; a win, the finale and the level end (stars, score, hearts, a booster
 * earned, Keep this painting), Next level and Your board; light and dark. The clock (SPEC "Set: the clock
 * and the kingdom"): the card's choice (Off, Ten seconds), the ring standing before the first swap, while
 * tiles move, while hidden and for a sheet; text only under reduced motion; Five more's time; running out
 * (the page's time moved on); the level end's In time and not in time lines, Another way and See it
 * in your kingdom; the list of levels' "in time" and Kingdom. Map while the winning tiles fall and during the
 * finale keeps the win; a last move that runs out stays a loss.
 */
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const http = require('node:http');
const crypto = require('node:crypto');

let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;

const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.resolve(process.env.SHOTS || path.join(os.tmpdir(), '5s-play-shots'));
const FONTS = process.env.FONTS || '';
const F = require(path.join(ROOT, 'src', 'engine.js'));
const M = require(path.join(ROOT, 'src', 'match.js'));
const B = require(path.join(ROOT, 'src', 'board.js'));
const FIXTURE = process.env.DECK === 'fixture' || !fs.existsSync(path.join(ROOT, 'dist', 'deck.json'));
const deck = JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE ? 'test/fixture' : 'dist', 'deck.json'), 'utf8'));
const NOW = Date.UTC(2026, 9, 22, 12); // the harness's
const taste = F.exampleState(deck, NOW);
const fmt = (n) => Math.round(n).toLocaleString('en-GB');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
const secsOf = (t) => { const [m, s] = t.split(':').map(Number); return m * 60 + s; };

// ---------------------------------------------------------------- the same games, in Node
function start(n, plays) { const lv = M.level(n); return M.newGame(lv, M.pieces(taste, deck, lv.suits), '5s:' + n + ':' + plays); }
const waves = (r) => Math.max(0, ...r.steps.filter((s) => s.e === 'wave').map((s) => s.n));
const isCombo = (r) => r.steps.some((s) => s.e === 'fire' && /\+/.test(s.sp));
const pick = {
  hint: (g) => M.hint(g),
  paint: (g) => { let b = null, bp = -1; for (const [x, y] of M.moves(g)) { const k = M.swap(g, x, y).steps.filter((s) => s.e === 'paint').length; if (k > bp) { bp = k; b = [x, y]; } } return b; },
  worst: (g) => { let b = null, bv = Infinity; for (const [x, y] of M.moves(g)) { const r = M.swap(g, x, y); const v = r.game.goals[0].have * 1e6 + r.game.score; if (v < bv) { bv = v; b = [x, y]; } } return b; },
  combo: (g) => {
    let mk = null;
    for (const [x, y] of M.moves(g)) { const r = M.swap(g, x, y); if (isCombo(r)) return [x, y]; if (!mk && r.steps.some((s) => s.e === 'make')) mk = [x, y]; }
    return mk || M.hint(g);
  },
};
function plan(g, how, max) {
  const out = [];
  while (g.state === 'play' && out.length < (max || 99)) {
    const m = pick[how](g);
    if (!m) break;
    const r = M.swap(g, m[0], m[1]);
    out.push({ a: m[0], b: m[1], r, waves: waves(r), combo: isCombo(r), make: r.steps.some((s) => s.e === 'make') });
    g = r.game;
  }
  return out;
}
function find(n, how, ok, max) {
  for (let p = 0; p < 40; p++) { const g = start(n, p); const pl = plan(g, how, max); if (ok(pl, g)) return { p, g, pl }; }
  throw new Error('no board found for level ' + n);
}

// ---------------------------------------------------------------- serving and the page
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };
let server, browser, BASE;
before(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  server = await new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!p.startsWith(ROOT + path.sep) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(+process.env.PORT || 0, '127.0.0.1', () => res(s));
  });
  BASE = 'http://127.0.0.1:' + server.address().port + '/test/play.html';
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

async function open(o, query, hash) {
  const ctx = await browser.newContext({
    viewport: { width: o.w || 390, height: o.h || 844 }, deviceScaleFactor: 2, colorScheme: o.dark ? 'dark' : 'light',
    reducedMotion: o.reduce ? 'reduce' : 'no-preference', hasTouch: !!o.touch, isMobile: !!o.touch,
  });
  const page = await ctx.newPage();
  // skip(ms) moves the page's performance.now on, so the game's clock jumps (Playwright's clock.fastForward
  // dropped timers set while it fired, now and then: the live region's words never came)
  if (o.skip) await page.addInitScript(() => { const now = performance.now.bind(performance); let off = 0; performance.now = () => now() + off; window.__skip = (ms) => { off += ms; }; });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  if (FONTS) {
    const css = fs.readFileSync(path.join(FONTS, 'css.css'), 'utf8');
    await page.route(/fonts\.googleapis\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: css }));
    await page.route(/fonts\.gstatic\.com/, (r) => {
      const f = path.join(FONTS, crypto.createHash('md5').update(r.request().url() + '\n').digest('hex').slice(0, 12) + '.woff2');
      return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'font/woff2', body: fs.readFileSync(f) }) : r.abort();
    });
  } else await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const q = new URLSearchParams(query || '');
  if (FIXTURE) q.set('deck', 'fixture');
  await page.goto(BASE + (q.toString() ? '?' + q : '') + (hash || ''));
  await page.waitForFunction(() => (window.harness && window.harness.ready) || window.harnessError);
  assert.equal(await page.evaluate(() => window.harnessError || ''), '');
  const cdp = await ctx.newCDPSession(page);
  return { ctx, page, cdp, errors };
}
async function shot(page, name) { // once the pictures in view have loaded
  await page.waitForFunction(() => [...document.images].every((i) => { const r = i.getBoundingClientRect(); return i.complete || r.bottom < 0 || r.top > innerHeight; }), null, { timeout: 5000 }).catch(() => {});
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}
const calls = (page, kind) => page.evaluate((k) => window.harness.calls.filter((c) => c[0] === k).map((c) => c[1]), kind);
async function centre(page, i) { const b = await page.locator('.fp-gc[data-i="' + i + '"]').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function play(page) {
  await page.locator('dialog[open] [data-play]').click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
}
const dirKey = (a, b, cols) => (b === a + 1 ? 'ArrowRight' : b === a - 1 ? 'ArrowLeft' : b === a + cols ? 'ArrowDown' : 'ArrowUp');

async function swapBy(how, page, cdp, a, b, cols) {
  const A = await centre(page, a), Bc = await centre(page, b);
  if (how === 'touch') {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: A.x, y: A.y }] });
    for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: A.x + (Bc.x - A.x) * k / 6, y: A.y + (Bc.y - A.y) * k / 6 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else if (how === 'mouse') {
    await page.mouse.move(A.x, A.y); await page.mouse.down();
    await page.mouse.move(Bc.x, Bc.y, { steps: 6 }); await page.mouse.up();
  } else if (how === 'tap') {
    await page.touchscreen.tap(A.x, A.y); await sleep(120); await page.touchscreen.tap(Bc.x, Bc.y);
  } else if (how === 'enter') {
    await page.focus('.fp-gc[data-i="' + a + '"]'); await page.keyboard.press('Enter'); await page.keyboard.press(dirKey(a, b, cols));
  } else {
    await page.focus('.fp-gc[data-i="' + a + '"]'); await page.keyboard.press('Shift+' + dirKey(a, b, cols));
  }
}
// After a counted move the page shows the engine's moves and score once the board has settled.
async function settled(page, g) {
  await page.waitForFunction(([m, s]) => {
    const mv = document.querySelector('.fp-moves b'), sc = document.querySelector('.fp-score > b');
    return mv && mv.textContent === String(m) && sc.textContent === s;
  }, [g.moves, fmt(g.score)], { timeout: 20000 });
}

// ---------------------------------------------------------------- the board

test('masonry: columns from the width, shortest column first (ties: the leftmost)', () => {
  const L = B.masonry(358, [1, 0.5, 1, 1]);
  assert.equal(L.cols, 2);
  const w = (358 - 8) / 2;
  assert.deepEqual(L.at.map((p) => [p.x, p.y]), [[0, 0], [w + 8, 0], [w + 8, w * 0.5 + 8], [0, w + 8]]);
  assert.equal(B.masonry(1000, [1]).cols, 5);
  assert.equal(B.masonry(200, [1]).cols, 2);
  assert.equal(B.masonry(520, [1]).cols, 3);
});

test('board: by kind at 390, each tile at its own proportions, lazy images with sizes', async () => {
  const { ctx, page, errors } = await open({ touch: true }, '', '#board');
  await page.waitForSelector('.fb-tile');
  const heads = await page.locator('.fb-head').allTextContents();
  const kinds = ['Images', 'Objects', 'Spaces', 'Surfaces', 'Colours'];
  assert.ok(heads.length >= 3 && heads.every((h, i) => kinds.indexOf(h) >= 0 && (i === 0 || kinds.indexOf(h) > kinds.indexOf(heads[i - 1]))), 'sections by kind, in order: ' + heads);
  const m = await page.evaluate(() => {
    const out = { cols: [], bad: [], imgs: [] };
    for (const sec of document.querySelectorAll('.fb-m')) out.cols.push(new Set([...sec.children].map((t) => Math.round(t.getBoundingClientRect().left))).size);
    for (const t of document.querySelectorAll('.fb-tile[data-id]')) {
      const c = window.FiveS.card(window.harness.state, window.harness.deck, t.dataset.id);
      const want = c.kind === 'colour' ? 4 / 3 : c.w && c.h ? c.h / c.w : 1;
      const r = t.getBoundingClientRect();
      if (Math.abs(r.height / r.width - want) > 0.02) out.bad.push(t.dataset.id);
    }
    for (const i of document.querySelectorAll('.fb-tile img')) out.imgs.push([i.loading, i.decoding, !!i.getAttribute('width'), !!i.getAttribute('height')].join());
    return out;
  });
  assert.ok(m.cols.every((n) => n === 2 || n === 1), 'two columns at 390: ' + m.cols);
  assert.deepEqual(m.bad, [], 'tiles at their own proportions');
  assert.ok(m.imgs.length && m.imgs.every((s) => s === 'lazy,async,true,true'), 'lazy, async, sized images');
  const first = page.locator('.fb-tile[data-id]').first();
  assert.equal(await first.getAttribute('aria-haspopup'), 'dialog');
  assert.match(await first.getAttribute('aria-label'), /^(Image|Object|Space|Surface|Colour): /);
  await first.click();
  assert.equal((await calls(page, 'open')).length, 1);
  await shot(page, 'board-390-light');
  await page.evaluate(() => window.scrollTo(0, document.querySelector('.fb-sec:nth-child(2)').offsetTop));
  await sleep(400);
  await shot(page, 'board-390-light-objects');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('board: clusters, paintings and the rest at 1280 in dark', async () => {
  const { ctx, page, errors } = await open({ w: 1280, h: 800, dark: true }, 'assoc=1', '#board');
  await page.waitForSelector('.fb-tile');
  const want = await page.evaluate(() => window.FiveSMatch.clusters(window.harness.state, window.harness.deck));
  assert.ok(want.clusters.length >= 2, 'the sample pairings make clusters');
  const heads = await page.locator('.fb-head').allTextContents();
  assert.deepEqual(heads.slice(0, want.clusters.length), want.clusters.map((c) => c.label));
  assert.equal(heads[want.clusters.length], 'Paintings you made');
  assert.equal(heads[want.clusters.length + 1], 'Not put together yet');
  assert.equal(heads.length, want.clusters.length + 2);
  const meta = await page.locator('.fb-meta').first().textContent();
  assert.match(meta, /^\d+ things · put together \d+ times?( · \d+ kept)?$/);
  assert.match(await page.locator('.fb-meta').allTextContents().then((x) => x.join('|')), / · \d+ kept/, 'a hearted pairing says so');
  const cols = await page.evaluate(() => new Set([...document.querySelectorAll('.fb-m')].pop().children.length && [...[...document.querySelectorAll('.fb-m')].pop().children].map((t) => Math.round(t.getBoundingClientRect().left))).size);
  assert.equal(cols, 5, 'five columns at 1280');
  const p = page.locator('.fb-painting');
  assert.match(await p.getAttribute('aria-label'), /^Painting: Level 7, \d+ \w{3}$/);
  const box = await p.boundingBox();
  assert.ok(Math.abs(box.height / box.width - 1) < 0.02, 'a painting at cols:rows');
  await p.click();
  assert.deepEqual(await calls(page, 'painting'), [0]);
  await shot(page, 'board-1280-dark-clusters');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---------------------------------------------------------------- the map

test('map: thirty levels climbing, in order, scrolled to the next', async () => {
  const { ctx, page, errors } = await open({ dark: true, touch: true }, 'stars=3,2,1&time=41', '#map');
  await page.waitForSelector('.fp-node');
  await sleep(300);
  const ns = await page.locator('.fp-node button').evaluateAll((bs) => bs.map((b) => [+b.dataset.n, b.getAttribute('aria-label'), b.getAttribute('aria-disabled'), Math.round(b.getBoundingClientRect().top)]));
  assert.equal(ns.length, 30);
  assert.deepEqual(ns.map((x) => x[0]), Array.from({ length: 30 }, (_, i) => i + 1), 'DOM order 1..30');
  assert.deepEqual(ns.slice(0, 5).map((x) => x[1]), ['Level 1, 3 of 3 stars, in time', 'Level 2, 2 of 3 stars', 'Level 3, 1 of 3 stars', 'Level 4, Next', 'Level 5, Not yet']);
  assert.equal(ns[4][2], 'true');
  assert.match(await page.textContent('.fp-node.is-done .fp-nl'), /^★★★3 of 3 stars, in time$/);
  await page.click('.fp-kingdom');
  assert.deepEqual(await calls(page, 'kingdom'), [true], 'Kingdom in the top bar');
  assert.ok(ns[29][3] < ns[0][3], 'the path climbs: level 30 above level 1');
  assert.ok(await page.evaluate(() => document.querySelector('.fp-scroll').scrollTop > 0), 'scrolled to the next level');
  assert.equal(await page.locator('.fp-ep').count(), 6);
  await shot(page, 'map-390-dark');
  await page.locator('[data-n="5"]').click({ force: true });
  assert.equal(await page.locator('dialog[open]').count(), 0, 'a level not yet open does nothing');
  await page.locator('[data-n="4"]').click();
  await page.waitForSelector('dialog[open] .sheet-title');
  assert.equal(await page.locator('dialog[open] .sheet-title').textContent(), 'Level 4');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---------------------------------------------------------------- the game

test('level 1 by touch at 390: bounce, drag, tap-tap, keys, sound, hint, a cascade in budget, the win', async () => {
  const L1 = find(1, 'hint', (pl) => pl.length && pl[pl.length - 1].r.game.state === 'won' && pl.slice(4, -1).some((x) => x.waves >= 3));
  const { ctx, page, cdp, errors } = await open({ touch: true }, 'plays=' + L1.p, '#level=1');
  await page.waitForSelector('dialog[open]');
  const card = await page.locator('dialog[open]').textContent();
  assert.match(card, new RegExp('Score ' + fmt(M.level(1).goals[0].n)));
  assert.match(card, /15 moves/);
  assert.match(card, /Swap two neighbours/, 'the coach line');
  await shot(page, 'level1-card-390');
  await play(page);
  assert.equal(await page.getAttribute('.fp-grid', 'aria-label'), 'Level 1 board, 7 by 7');
  assert.equal(await page.locator('.fp-gc').count(), 49);
  assert.equal(await page.locator('.fp-gc[tabindex="0"]').count(), 1, 'one tab stop');
  assert.match(await page.getAttribute('.fp-gc[data-i="0"]', 'aria-label'), /^.+, .+\. Row 1, column 1\.$/);
  assert.equal(await page.locator('.fp-coach').count(), 1);
  await shot(page, 'level1-start-390');

  // A swap that makes no line slides back and spends nothing.
  let g = L1.g;
  let bad = null;
  for (let i = 0; i < 48 && !bad; i++) if (i % 7 < 6 && !M.canSwap(g, i, i + 1)) bad = [i, i + 1];
  await swapBy('touch', page, cdp, bad[0], bad[1], 7);
  await page.waitForFunction(() => /No line there/.test(document.querySelector('.fp-live').textContent));
  assert.equal(await page.textContent('.fp-moves b'), '15');

  const ways = ['touch', 'tap', 'enter', 'shift'];
  for (let k = 0; k < L1.pl.length; k++) {
    const mv = L1.pl[k];
    const how = ways[k] || 'shift';
    const timed = k >= 4 && mv.waves >= 3 && !L1.timed;
    if (timed) {
      L1.timed = true;
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => { window.__ft = []; window.__rec = true; let last = 0; const f = (t) => { if (last) window.__ft.push(t - last); last = t; if (window.__rec) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    }
    await swapBy(how, page, cdp, mv.a, mv.b, 7);
    if (timed) { await sleep(350); await shot(page, 'level1-cascade-390'); }
    g = mv.r.game;
    await settled(page, g);
    if (timed) {
      const ft = await page.evaluate(() => { window.__rec = false; return window.__ft; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const s = ft.slice().sort((x, y) => x - y), p95 = s[Math.floor(s.length * 0.95)];
      console.log('# cascade of ' + mv.waves + ' waves, 4x CPU: ' + ft.length + ' frames, p95 ' + p95.toFixed(1) + ' ms');
      assert.ok(p95 <= 20, 'p95 frame time ' + p95.toFixed(1) + ' ms <= 20 ms');
    }
    assert.equal((await calls(page, 'associate')).length, g.groups.length, 'one onAssociate per juxtaposition');
    if (k === 0) assert.equal(await page.locator('.fp-coach').count(), 0, 'the coach goes with the first swap');
    if (k === 1) {
      await page.click('.fp-snd');
      assert.equal(await page.getAttribute('.fp-snd', 'aria-pressed'), 'false');
      assert.deepEqual((await calls(page, 'opts')).pop(), { sound: false, hints: true });
      await page.keyboard.press('m');
      assert.equal(await page.getAttribute('.fp-snd', 'aria-pressed'), 'true');
    }
    if (k === 2) {
      await page.keyboard.press('h');
      await page.waitForFunction(() => /^Hint: /.test(document.querySelector('.fp-live').textContent));
    }
    if (k === 3) await shot(page, 'level1-play-390');
  }
  assert.ok(L1.timed, 'a cascade was timed');
  const fin = M.finale(g).game, res = M.result(fin);
  await page.waitForSelector('dialog[open] .sheet-title', { timeout: 30000 });
  assert.equal(await page.textContent('dialog[open] .sheet-title'), 'Level 1 done.');
  const end = await page.textContent('dialog[open]');
  assert.match(end, new RegExp(res.stars + ' of 3 stars'));
  assert.match(end, new RegExp('Score ' + fmt(res.score) + ' · Best ' + fmt(res.score)));
  const ends = await calls(page, 'end');
  assert.equal(ends.length, 1);
  assert.equal(ends[0].won, true);
  if (res.stars === 3) assert.match(end, /You earned a Pass\./);
  // The clock: played at once, so in time; the building is the first of the ways, and Another way shows the next.
  assert.equal(ends[0].clock, 75);
  assert.ok(ends[0].secs >= 1 && ends[0].secs < 75, 'secs ' + ends[0].secs);
  assert.equal(await page.textContent('dialog[open] .fp-endclock'), 'In time: ' + mss(75 - ends[0].secs) + ' to spare. Best ' + mss(ends[0].secs) + '.');
  const bw = M.buildChoices(taste, deck, ends[0], undefined);
  assert.equal(bw.length, 3);
  assert.match(await page.textContent('dialog[open] .fp-btext'), new RegExp('^Built: .+, ' + ['one storey', 'two storeys', 'three storeys'][res.stars - 1] + ', flying a flag\\.$'));
  assert.deepEqual(await page.evaluate(() => [window.harness.state.saga.built, window.harness.state.saga.time]), [[bw[0]], [ends[0].secs]]);
  await page.locator('dialog[open] [data-way]').click();
  assert.equal(await page.textContent('dialog[open] .fp-wayn'), '2 of 3');
  assert.deepEqual(await calls(page, 'build'), [bw[1]]);
  assert.deepEqual(await page.evaluate(() => window.harness.state.saga.built), [bw[1]], 'whichever shows is the building');
  const hearts = page.locator('dialog[open] .fp-heart');
  // most things first; a group inside one already shown is not shown again
  const shown = [];
  for (const g of res.groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.ids.length - a.g.ids.length || a.i - b.i).map((x) => x.g)) {
    if (shown.length < 6 && !shown.some((x) => g.ids.every((id) => x.ids.includes(id)))) shown.push(g);
  }
  assert.equal(await hearts.count(), shown.length);
  assert.deepEqual(await page.$$eval('dialog[open] .fp-groups p', (ps) => ps.map((p) => p.textContent.split(': ')[0])), shown.map((g) => g.label));
  if (res.groups.length) {
    await hearts.first().click();
    assert.equal(await hearts.first().getAttribute('aria-pressed'), 'true');
    assert.equal((await calls(page, 'heart'))[0].on, true);
  }
  await shot(page, 'level1-end-390');
  await page.locator('dialog[open] [data-next]').click();
  assert.deepEqual(await calls(page, 'next'), [2]);
  await page.waitForSelector('dialog[open] .sheet-title');
  assert.equal(await page.textContent('dialog[open] .sheet-title'), 'Level 2');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('level 2 in reduced motion and dark: tiles only sit on cells, out of moves, Five more, Map', async () => {
  const L2 = find(2, 'worst', (pl) => pl.length && pl[pl.length - 1].r.game.state === 'out');
  const { ctx, page, errors } = await open({ touch: true, reduce: true, dark: true }, 'plays=' + L2.p, '#level=2');
  await page.waitForSelector('dialog[open]');
  await play(page);
  assert.deepEqual([await page.locator('.fp-cring').count(), await page.textContent('.fp-time')], [0, mss(5 * 14)], 'reduced motion: the time in text, no ring');
  // The hint is a static dashed outline after five seconds.
  await page.waitForFunction(() => document.querySelectorAll('.fp-t.fp-hint').length === 2, null, { timeout: 8000 });
  await shot(page, 'level2-hint-reduced-dark');
  await page.evaluate(() => {
    window.__pos = []; window.__rec = true;
    const f = () => { for (const t of document.querySelectorAll('.fp-t')) window.__pos.push(t.style.transform); if (window.__rec) requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  let g = L2.g;
  for (const mv of L2.pl) { await swapBy('shift', page, null, mv.a, mv.b, 7); g = mv.r.game; if (g.state === 'play') await settled(page, g); }
  const off = await page.evaluate(() => {
    window.__rec = false;
    const pitch = parseFloat(getComputedStyle(document.querySelector('.fp-board')).getPropertyValue('--cell')) + 3;
    return window.__pos.filter((tr) => {
      const m = /translate3d\(([-\d.]+)px, ?([-\d.]+)px/.exec(tr), s = /scale\(([\d.]+)\)/.exec(tr);
      if (!m) return false;
      const fx = (+m[1] - 12) / pitch, fy = (+m[2] - 12) / pitch;
      return Math.abs(fx - Math.round(fx)) > 0.02 || Math.abs(fy - Math.round(fy)) > 0.02 || (s && +s[1] !== 1 && +s[1] !== 1.08);
    }).length;
  });
  assert.equal(off, 0, 'under reduced motion nothing slides, falls or pops');
  await page.waitForSelector('dialog[open] .sheet-title');
  assert.equal(await page.textContent('dialog[open] .sheet-title'), 'Out of moves.');
  const left = g.goals[0].n - g.goals[0].have;
  assert.match(await page.textContent('dialog[open] .fp-left'), new RegExp('^' + left + ' more '));
  await shot(page, 'level2-out-dark');
  const atOut = await page.textContent('.fp-time');
  await sleep(1500);
  assert.equal(await page.textContent('.fp-time'), atOut, 'the clock stands while a sheet is open');
  await page.locator('dialog[open] [data-more]').click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await page.textContent('.fp-moves b'), '5');
  const more = secsOf(await page.textContent('.fp-time')) - secsOf(atOut);
  assert.ok(more >= 24 && more <= 25, 'Five more adds 25 seconds: ' + more);
  assert.deepEqual(await calls(page, 'boost'), ['more']);
  g = M.boost(g, 'more').game;
  for (const mv of plan(g, 'worst')) { await swapBy('shift', page, null, mv.a, mv.b, 7); g = mv.r.game; if (g.state === 'play') await settled(page, g); }
  await page.waitForSelector('dialog[open] .sheet-title');
  assert.equal(await page.locator('dialog[open] [data-more]').count(), 0, 'Five more once a level');
  assert.equal(await page.getAttribute('.fp-boost[data-b="more"]', 'aria-label'), 'Five more, 0 held, used this level');
  await page.locator('dialog[open] [data-map]').click();
  const ends = await calls(page, 'end');
  assert.equal(ends.length, 1);
  assert.equal(ends[0].won, false);
  assert.deepEqual(await calls(page, 'map'), [true]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('level 3 by mouse at 1280: a special, a combo, the Pass booster, then Map', async () => {
  const L3 = find(3, 'combo', (pl) => pl.findIndex((x) => x.combo) >= 0 && pl.findIndex((x) => x.combo) < 8, 12);
  const upto = L3.pl.findIndex((x) => x.combo);
  const { ctx, page, errors } = await open({ w: 1280, h: 800 }, 'plays=' + L3.p, '#level=3');
  await page.waitForSelector('dialog[open]');
  assert.match(await page.textContent('dialog[open]'), /Line up four for a stripe/);
  await play(page);
  let g = L3.g, shotSpecial = false;
  for (let k = 0; k <= upto; k++) {
    const mv = L3.pl[k];
    await swapBy('mouse', page, null, mv.a, mv.b, 7);
    g = mv.r.game;
    await settled(page, g);
    const specials = await page.locator('.fp-t[class*="fp-sp-"], .fp-t.fp-mark').count();
    const want = g.cells.filter((c) => c.t && c.t.sp).length;
    assert.equal(specials, want, 'specials on the board after move ' + (k + 1));
    if (want && !shotSpecial && k < upto) { shotSpecial = true; await shot(page, 'level3-special-1280'); }
  }
  await shot(page, 'level3-after-combo-1280');
  // The Pass booster: press it, then a tile.
  await page.click('.fp-boost[data-b="pass"]');
  assert.equal(await page.getAttribute('.fp-boost[data-b="pass"]', 'aria-pressed'), 'true');
  let target = g.cells.findIndex((c) => c.t && !c.t.sp && !c.t.held);
  const T = await centre(page, target);
  await page.mouse.click(T.x, T.y);
  g = M.boost(g, 'pass', target).game;
  await page.waitForFunction((s) => document.querySelector('.fp-score > b').textContent === s, fmt(g.score), { timeout: 20000 });
  assert.deepEqual(await calls(page, 'boost'), ['pass']);
  assert.equal(await page.isDisabled('.fp-boost[data-b="pass"]'), true, 'none left');
  await page.click('.fp-back');
  const ends = await calls(page, 'end');
  assert.equal(ends.length, 1);
  assert.equal(ends[0].won, false);
  assert.deepEqual(await calls(page, 'map'), [true]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('level 8 at 390: the coach makes the mark, and the mark clears a frame', async () => {
  const { ctx, page, errors } = await open({ touch: true }, '', '#level=8');
  await page.waitForSelector('dialog[open]');
  assert.match(await page.textContent('dialog[open]'), /Line up five for the mark/);
  await play(page);
  let g = start(8, 0);
  const [a, b] = M.hint(g, 'mark');
  let r = M.swap(g, a, b);
  assert.ok(r.steps.some((s) => s.e === 'make' && s.tile.sp === 'mark'), 'the coach hint makes the mark');
  await swapBy('shift', page, null, a, b, 8);
  g = r.game;
  await settled(page, g);
  const mark = g.cells.findIndex((c) => c.t && c.t.sp === 'mark');
  assert.equal(await page.locator('.fp-t.fp-mark').count(), g.cells.filter((c) => c.t && c.t.sp === 'mark').length);
  assert.match(await page.getAttribute('.fp-gc[data-i="' + mark + '"]', 'aria-label'), /^The mark: /);
  await page.waitForFunction(() => !document.querySelector('.fp-mark img.fp-logo')).catch(() => {});
  assert.equal(await page.locator('.fp-mark img.fp-logo').count(), 0, 'a failed logo leaves only the drawn tile');
  await shot(page, 'level8-mark-390');
  const nb = [mark + 1, mark - 1, mark + 8, mark - 8].find((j) => j >= 0 && j < 64 && Math.abs((j % 8) - (mark % 8)) <= 1 && M.canSwap(g, mark, j));
  r = M.swap(g, mark, nb);
  assert.ok(r.steps.some((s) => s.e === 'fire' && s.sp === 'mark+tile'));
  await swapBy('shift', page, null, mark, nb, 8);
  await sleep(250);
  await shot(page, 'level8-mark-fires-390');
  g = r.game;
  await settled(page, g);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('nothing kept: the board is empty and level 1 plays with swatches of the frame colours', async () => {
  const { ctx, page, errors } = await open({ touch: true }, 'empty=1', '#board');
  await page.waitForSelector('.fb', { state: 'attached' });
  assert.equal(await page.locator('.fb-tile').count(), 0);
  await page.evaluate(() => { location.hash = 'level=1'; });
  await page.waitForSelector('dialog[open]');
  await play(page);
  assert.equal(await page.locator('.fp-t').count(), 49);
  const chips = await page.locator('.fp-legend li').allTextContents();
  assert.equal(chips.length, 4);
  assert.ok(chips.every((c) => / · your colours$/.test(c)), chips.join('|'));
  assert.match(await page.getAttribute('.fp-gc[data-i="0"]', 'aria-label'), /, a swatch\./);
  await shot(page, 'level1-nothing-kept-390');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('level 6: paint, the finale, keep the painting, and Your board shows it', async () => {
  const L6 = find(6, 'paint', (pl) => pl.length && pl[pl.length - 1].r.game.state === 'won');
  const { ctx, page, errors } = await open({ touch: true }, 'plays=' + L6.p, '#level=6');
  await page.waitForSelector('dialog[open]');
  await play(page);
  assert.equal(await page.locator('.fp-c.fp-h1').count(), 25, 'the centre 5x5 hatched');
  let g = L6.g;
  for (const mv of L6.pl) { await swapBy('shift', page, null, mv.a, mv.b, 7); g = mv.r.game; await settled(page, g); }
  assert.equal(await page.locator('.fp-c.fp-done').count(), 25, 'every paint cell solid');
  await shot(page, 'level6-painted-390');
  await page.waitForSelector('dialog[open] .fp-paint', { timeout: 30000 });
  await page.locator('dialog[open] [data-keep]').click();
  assert.equal((await calls(page, 'keepPainting')).length, 1);
  assert.equal(await page.textContent('dialog[open] [data-keep]'), 'Kept on your board');
  await shot(page, 'level6-end-390');
  await page.locator('dialog[open] [data-board]').click();
  await page.waitForSelector('.fb-painting');
  assert.match(await page.locator('.fb-head').allTextContents().then((x) => x.join('|')), /Paintings you made/);
  await shot(page, 'board-after-painting-390');
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---------------------------------------------------------------- the clock

test('the clock: Off and Ten seconds in the card; it runs only while the board waits', async () => {
  const lv = M.level(4), g0 = start(4, 0);
  const { ctx, page, errors } = await open({ touch: true, skip: true }, '', '#level=4');
  const skip = (ms) => page.evaluate((m) => window.__skip(m), ms);
  await page.waitForSelector('dialog[open]');
  const card = page.locator('dialog[open]');
  const statusH = () => page.locator('.fp-status').evaluate((e) => Math.round(e.getBoundingClientRect().height));
  assert.equal(await card.locator('.fp-clockset input:checked').getAttribute('value'), '5', 'five seconds a move until the person chooses');
  assert.equal(await card.locator('.fp-clockline').textContent(), mss(5 * lv.moves) + ' for this level, five seconds a move. It stops while tiles move and never ends a level. Beat it and your building flies a flag.');
  assert.deepEqual([await page.locator('.fp-cring').count(), await page.textContent('.fp-time'), await statusH()], [1, mss(5 * lv.moves), 76]);
  await card.locator('.fp-clockset label').nth(0).click();
  assert.deepEqual([await page.locator('.fp-time, .fp-cring, .fp-has-clock, .fp-clocked').count()], [0], 'Off: the status as it was');
  assert.ok((await statusH()) < 76);
  assert.equal(await card.locator('.fp-clockline').textContent(), 'No clock for this level.');
  assert.deepEqual((await calls(page, 'opts')).pop(), { sound: true, hints: true, clock: 0 });
  await card.locator('.fp-clockset label').nth(2).click();
  assert.deepEqual((await calls(page, 'opts')).pop(), { sound: true, hints: true, clock: 10 });
  const total = 10 * lv.moves;
  assert.deepEqual([await page.getAttribute('.fp-time', 'role'), await page.getAttribute('.fp-time', 'aria-label')], ['timer', 'Clock ' + mss(total)]);
  await shot(page, 'clock-card-390');
  await play(page);
  const left = async () => secsOf(await page.textContent('.fp-time'));
  const runs = () => page.evaluate(() => /stroke-dashoffset/.test(document.querySelector('.fp-rf').style.transition));
  await skip(30000);
  assert.equal(await runs(), false, 'nothing runs before the first counted swap');
  const [mv] = plan(g0, 'hint', 1);
  await swapBy('shift', page, null, mv.a, mv.b, 7);
  assert.equal(await runs(), false, 'it stands while tiles move');
  await skip(30000);
  await settled(page, mv.r.game);
  assert.ok(total - (await left()) <= 1, 'the time before the first swap and while tiles moved cost nothing');
  assert.equal(await runs(), true, 'the ring drains while the board waits');
  await skip(10000);
  await page.waitForFunction((t) => { const [m, x] = document.querySelector('.fp-time').textContent.split(':').map(Number); return m * 60 + x <= t; }, total - 10);
  const l1 = await left();
  assert.ok(l1 >= total - 12, 'ten seconds waiting: ' + (total - l1));
  const hide = (on) => page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, on);
  await hide(true);
  assert.equal(await runs(), false, 'it stands while the page is hidden');
  await skip(30000);
  await hide(false);
  assert.ok(l1 - (await left()) <= 1, 'hidden cost no time');
  assert.equal(await runs(), true);
  await shot(page, 'clock-running-390');
  await page.click('.fp-back');
  const ends = await calls(page, 'end');
  assert.equal(ends[0].clock, total);
  assert.ok(ends[0].secs >= 10 && ends[0].secs <= 13, 'secs ' + ends[0].secs);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the clock runs out: Time, play on; the win is not in time, keeps no time and still builds', async () => {
  const L = find(1, 'hint', (pl) => pl.length > 2 && pl[pl.length - 1].r.game.state === 'won');
  const { ctx, page, errors } = await open({ w: 1280, h: 800, dark: true, skip: true }, 'plays=' + L.p, '#level=1');
  const skip = (ms) => page.evaluate((m) => window.__skip(m), ms);
  await page.waitForSelector('dialog[open]');
  await play(page);
  let g = L.g;
  const live = (t) => page.waitForFunction((x) => document.querySelector('.fp-live').textContent === x, t);
  for (const [k, mv] of L.pl.entries()) {
    await swapBy('shift', page, null, mv.a, mv.b, 7);
    g = mv.r.game;
    await settled(page, g);
    if (k) continue;
    await skip(56000);
    await live('20 seconds on the clock.');
    await skip(20000);
    await live('Time. Play on: nothing is lost.');
    assert.deepEqual([await page.textContent('.fp-time'), await page.getAttribute('.fp-time', 'aria-label'), await page.textContent('.fp-say')], ['Time', 'Clock Time', 'Time. Play on.']);
    assert.equal(await page.textContent('.fp-moves b'), String(g.moves), 'no move is lost');
    await shot(page, 'clock-time-1280-dark');
  }
  await page.waitForSelector('dialog[open] .fp-endclock', { timeout: 30000 });
  const ends = await calls(page, 'end');
  assert.ok(ends[0].won && ends[0].clock === 75 && ends[0].secs > 75, JSON.stringify([ends[0].secs, ends[0].clock]));
  assert.equal(await page.textContent('dialog[open] .fp-endclock'), mss(ends[0].secs) + '. The clock gave 1:15. Race it again.');
  assert.match(await page.textContent('dialog[open] .fp-btext'), /^Built: .+, (one storey|two storeys|three storeys)\.$/, 'no flag');
  assert.deepEqual(await page.evaluate(() => window.harness.state.saga.time), [], 'not in time keeps no time');
  await shot(page, 'clock-not-in-time-1280-dark');
  await page.locator('dialog[open] [data-kingdom]').click();
  assert.deepEqual(await calls(page, 'kingdom'), [1]);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// The level's Map left before the win's sheet: the win is recorded from the engine as the move lands, with its
// finale's score, stars, time and building (SPEC "A win builds at once"); a last move that runs out stays a loss.
test('Map while the winning tiles fall or during the finale keeps the win; a last move that runs out stays a loss', async () => {
  const L = find(10, 'hint', (pl) => pl.length > 1 && pl.length <= 6 && pl[pl.length - 1].r.game.state === 'won'   // a fifth level: an area
    && pl[pl.length - 1].r.game.groups.length > pl[pl.length - 2].r.game.groups.length);   // whose winning move puts things together too
  const res = M.result(M.finale(L.pl[L.pl.length - 1].r.game).game);
  const ways = M.buildChoices(taste, deck, res, undefined);
  const saga0 = { stars: Array(9).fill(2), best: Array(9).fill(6000), boost: { pass: 1, turn: 1, more: 1 }, plays: L.p, day: null, time: [], built: [] };
  // Map tapped: mid-cascade (the board not yet settled on the last move) or once the finale's "All set." shows;
  // or the level closed mid-cascade without Back (the app's stopPlay, as Example mode switching does)
  async function lastMoveThenMap(page, pl, when) {
    for (const mv of pl.slice(0, -1)) { await swapBy('shift', page, null, mv.a, mv.b, mv.r.game.cols); await settled(page, mv.r.game); }
    const last = pl[pl.length - 1];
    await swapBy('shift', page, null, last.a, last.b, last.r.game.cols);
    if (when === 'finale') await page.waitForFunction(() => [...document.querySelectorAll('.fp-word')].some((e) => e.textContent === 'All set.'), null, { timeout: 20000 });
    const shown = await page.evaluate((closed) => { const m = document.querySelector('.fp-moves b').textContent; if (closed) location.hash = 'board'; else document.querySelector('.fp-back').click(); return m; }, when === 'closed');
    if (when !== 'finale') assert.equal(shown, String(pl[pl.length - 2].r.game.moves), 'tapped while the tiles still fell');
    await page.waitForSelector(when === 'closed' ? '#h-play' : '.fp-mapview');
    await sleep(800);   // nothing more is recorded once the level has gone
  }
  for (const when of ['cascade', 'finale', 'closed']) {
    const { ctx, page, errors } = await open({ touch: true }, 'stars=' + saga0.stars + '&plays=' + L.p, '#level=10');
    await page.waitForSelector('dialog[open]');
    await play(page);
    await lastMoveThenMap(page, L.pl, when);
    const ends = await calls(page, 'end');
    assert.equal(ends.length, 1, when + ': recorded once');
    assert.deepEqual([ends[0].won, ends[0].stars, ends[0].score], [true, res.stars, res.score], when + ': the win, with its finale score');
    assert.ok(ends[0].secs >= 1 && ends[0].secs <= ends[0].clock, when + ': in time ' + ends[0].secs);
    const rec = M.recordLevel(saga0, Object.assign({}, res, { secs: ends[0].secs, clock: ends[0].clock }));
    assert.deepEqual(await page.evaluate(() => window.harness.state.saga), M.build(rec.saga, 10, ways[0] ?? null), when + ': stars, best, time, boosters and the building saved');
    assert.equal((await calls(page, 'associate')).length, L.pl[L.pl.length - 1].r.game.groups.length, when + ': every pairing the moves made, the last one too');
    if (when === 'closed') assert.equal(await page.textContent('#h-play'), 'Play level 11', when + ': level 11 next');
    else assert.equal(await page.locator('.fp-mapview .fp-node.is-next button').getAttribute('data-n'), '11', when + ': the area built, level 11 next');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  const O = find(2, 'worst', (pl) => pl.length > 1 && pl[pl.length - 1].r.game.state === 'out');
  const { ctx, page, errors } = await open({ reduce: true }, 'plays=' + O.p, '#level=2');
  await page.waitForSelector('dialog[open]');
  await play(page);
  await lastMoveThenMap(page, O.pl, 'cascade');
  const ends = await calls(page, 'end');
  assert.deepEqual([ends.length, ends[0].won], [1, false], 'out of moves: a loss');
  assert.deepEqual(await page.evaluate(() => [window.harness.state.saga.stars, window.harness.state.saga.plays]), [[], O.p + 1]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

// ---------------------------------------------------------------- Set, inside out (FiveSPlay.mountSet)
// SPEC-set-inside-out §3, §4, §6, §10.4, §13, with the artist's answers: no stars anywhere; a turn is noticed in
// words and rewards nothing. The harness (?set=1) hands the page FiveSRelate.table of the same taste; each test reads
// that table back and plans every move in Node with the same engine (src/relate.js), then checks the page against it.

const RL = require(path.join(ROOT, 'src', 'relate.js'));
const SMALLER = 'Nothing more comes in: the board gets smaller now.';
const TAGS = { again: 'Said before, it holds', turn: 'A turn', brought: 'Only you have this one', shared: 'Someone else too',
  apart: 'You see them apart', agree: 'Others’ words agree', yours: 'Your own eye', first: 'You’re the first' };
const STOREYS = ['one storey', 'two storeys', 'three storeys'];
const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const dot = (s) => (/[.…!?]$/.test(s) ? s : s + '.');
const settle = () => sleep(350);   // the two rise, fade or fly: let it finish before a screenshot
const phaseIs = (page, p, timeout) => page.waitForFunction((x) => { const b = document.querySelector('.fp-set'); return !!b && x.split('|').includes(b.dataset.phase); }, p, { timeout: timeout || 15000 });
const slotsOn = (page) => page.$$eval('.fs-pl', (bs) => bs.map((b) => b.dataset.id || null));
const nameOf = (page, id) => page.evaluate((x) => window.harness.name(x), id);
const toGo = (g) => g.slots.filter(Boolean).length - 1 + g.pile;
const onBoard = (g) => g.slots.map((id, i) => (id ? i : -1)).filter((i) => i >= 0);
async function placeAt(page, i) { const b = await page.locator('.fs-pl[data-i="' + i + '"]').boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }
async function setLevel(page) { await page.waitForSelector('dialog[open] [data-play]'); return page.evaluate(() => window.harness.level); }
async function setPlay(page) { await page.locator('dialog[open] [data-play]').click(); await phaseIs(page, 'idle'); }
const touch = (cdp, type, p) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: p ? [{ x: p.x, y: p.y }] : [] });
async function carry(how, page, cdp, i, j) {   // place i carried onto place j
  const A = await placeAt(page, i), B = await placeAt(page, j);
  if (how === 'mouse') { await page.mouse.move(A.x, A.y); await page.mouse.down(); await page.mouse.move(B.x, B.y, { steps: 8 }); await page.mouse.up(); return; }
  await touch(cdp, 'touchStart', A);
  for (let k = 1; k <= 8; k++) { await touch(cdp, 'touchMove', { x: A.x + (B.x - A.x) * k / 8, y: A.y + (B.y - A.y) * k / 8 }); await sleep(12); }
  await touch(cdp, 'touchEnd');
}
// The answer on the page is the engine's, the person's own words first; returns what say() gives.
async function answered(page, g, T, x, y, s, w) {
  const r = RL.say(g, T, x, y, s, w);
  await phaseIs(page, 'answer');
  assert.equal(await page.textContent('.fs-said'), RL.saidText(T.vocab, T.aspectOf, s, w));
  assert.equal(await page.textContent('.fs-eye p'), r.answer.line);
  return r;
}
const timeAtMost = (page, t) => page.waitForFunction((x) => { const [m, s] = document.querySelector('.fp-time').textContent.split(':').map(Number); return m * 60 + s <= x; }, t, { timeout: 3000 }).catch(() => {});
async function goOnTo(page, p) { await page.locator('.fs-tapon').click(); await phaseIs(page, p || 'idle'); }

test('Set level 1 by touch at 390 x 664: three ways in, the coach, carry, flick, tap then tap, keys, in what, your word, the answers, the level end', async () => {
  const { ctx, page, cdp, errors } = await open({ touch: true, w: 390, h: 664 }, 'set=1', '#level=1');
  const L = await setLevel(page), T = L.table, ways = RL.leads(T, 1);
  const card = await page.textContent('dialog[open]');
  assert.doesNotMatch(card, /\bstars?\b|★|☆/i, 'no stars on the card');
  assert.match(card, /Sort · What you kept\./);
  assert.match(card, /Carry one picture onto another, then say how they go\. The one you carry is set; the other stays\. Every pairing counts\./);
  assert.match(card, new RegExp(RL.COACH[1]));
  assert.deepEqual(await page.$$eval('dialog[open] .fs-way', (bs) => bs.map((b) => [b.dataset.lead, b.getAttribute('aria-pressed')])), ways.map((w, i) => [w.id, String(!i)]));
  // Start from: another way in deals the board again around it, and nothing is saved
  await page.locator('dialog[open] .fs-way').nth(1).click();
  let g = RL.newGame(RL.level(1), T, L.seed, ways[1].id);
  assert.deepEqual(await slotsOn(page), g.slots);
  assert.equal(await page.textContent('dialog[open] .fs-count'), (6 + g.pile) + ' of your things · ' + g.moves + ' moves · one stays.');
  assert.deepEqual(await calls(page, 'relate'), []);
  await shot(page, 'set-card-390');
  await setPlay(page);
  assert.equal(await page.textContent('.fs-say1'), RL.COACH[1], 'the coach line');
  assert.equal(await page.locator('.fs-ghost.fs-hand').count(), 1, 'the ghost hand');
  assert.equal(await page.getAttribute('.fs-places', 'aria-label'), 'Level 1 board, 2 by 3. 6 pictures. 5 to go.');
  assert.equal(await page.locator('.fs-pl[role="gridcell"][tabindex="0"]').count(), 1, 'one tab stop');
  assert.match(await page.getAttribute('.fs-pl[data-i="3"]', 'aria-label'), /^.+\. Row 2, column 2\.$/);
  await shot(page, 'set-board-390');

  // 1. carry, Alike, an aspect
  let [i, j] = onBoard(g), x = g.slots[i], y = g.slots[j];
  await carry('touch', page, cdp, i, j);
  await phaseIs(page, 'saying');
  assert.equal(await page.textContent('.fs-names'), (await nameOf(page, x)) + ' · onto · ' + (await nameOf(page, y)));
  assert.equal(await page.getAttribute('.fs-ask', 'aria-label'), 'How do they go? ' + (await nameOf(page, x)) + ' and ' + (await nameOf(page, y)) + '.');
  assert.equal(await page.textContent('.fs-sayrow'), 'Put back');
  await page.click('.fs-sbtn[data-s="1"]');
  assert.equal(await page.textContent('.fs-q2'), 'Alike in what?');
  assert.deepEqual(await page.$$eval('.fs-chip:not(.fs-mine):not(.fs-drawn):not(.fs-add)', (bs) => bs.map((b) => b.textContent)), ['Layout', 'Line', 'Light', 'Mass', 'Mood']);
  assert.deepEqual(await page.$$eval('.fs-chip.fs-drawn', (bs) => bs.map((b) => b.textContent)), RL.chips(T, g, x, y, 1).others);
  await settle();
  await shot(page, 'set-after-alike-390');
  await page.click('.fs-chip[data-w="1"]');
  let r = await answered(page, g, T, x, y, 1, 1);
  assert.deepEqual(await calls(page, 'relate'), [{ x, y, s: 1, w: 1 }], 'saved at once');
  assert.equal(await page.textContent('.fs-sayrow'), (await nameOf(page, x)) + ' is set. ' + (await nameOf(page, y)) + ' stays.');
  await settle();
  await shot(page, 'set-other-eyes-390');
  await goOnTo(page);
  g = r.game;
  assert.deepEqual(await slotsOn(page), g.slots, 'the carried one is set; the other stays');
  assert.ok(!r.arrival && (await page.textContent('.fs-say2')) === SMALLER, 'level 1 has no pile: the board gets smaller');
  assert.equal(await page.locator('.fs-pl.is-gone').count(), 1);
  assert.equal(await page.textContent('.fp-moves b'), String(toGo(g)));
  assert.equal(await page.textContent('.fs-made'), '1 made · 1 alike');
  assert.equal(await page.locator('.fs-ghost').count(), 0, 'the coach goes with the first set');
  await page.waitForFunction((t) => document.querySelector('.fp-live').textContent === t,
    [RL.saidText(T.vocab, T.aspectOf, 1, 1), r.answer.line, (await nameOf(page, y)) + ' stays.', SMALLER, toGo(g) + ' to go.'].join(' '));
  assert.equal(await page.locator('.fs-last:not([hidden]) img').count(), 2, 'the last pairing in the status');
  await page.click('.fs-last');   // it opens that pairing and its answer again, until a tap
  await phaseIs(page, 'answer');
  assert.deepEqual([await page.textContent('.fs-said'), await page.textContent('.fs-eye p')], [RL.saidText(T.vocab, T.aspectOf, 1, 1), r.answer.line]);
  await goOnTo(page);

  // 2. a flick toward a neighbour, Unlike, Go on
  [i, j] = (() => { for (const a of onBoard(g)) if (a % 2 === 0 && g.slots[a + 1]) return [a, a + 1]; return null; })();
  x = g.slots[i]; y = g.slots[j];
  const A = await placeAt(page, i);
  await touch(cdp, 'touchStart', A);
  for (let k = 1; k <= 2; k++) await touch(cdp, 'touchMove', { x: A.x + 35 * k, y: A.y });   // quick (well over 0.5 px/ms), and still inside its own place
  await touch(cdp, 'touchEnd');
  await phaseIs(page, 'saying');
  assert.equal(await page.textContent('.fs-names'), (await nameOf(page, x)) + ' · onto · ' + (await nameOf(page, y)), 'a flick sets it with the picture it points at');
  await page.click('.fs-sbtn[data-s="-1"]');
  assert.equal(await page.textContent('.fs-q2'), 'Unlike in what?');
  assert.deepEqual(await page.$$eval('.fs-chip.fs-drawn', (bs) => bs.map((b) => b.textContent)), RL.chips(T, g, x, y, -1).others);
  await settle();
  await shot(page, 'set-after-unlike-390');
  await page.click('[data-goon]');
  r = await answered(page, g, T, x, y, -1, 0);
  await goOnTo(page);
  g = r.game;

  // 3. tap then tap, Alike, + Your word
  [i, j] = onBoard(g); x = g.slots[i]; y = g.slots[j];
  let P = await placeAt(page, i);
  await page.touchscreen.tap(P.x, P.y);
  await phaseIs(page, 'lifted');
  await page.waitForFunction((t) => document.querySelector('.fp-live').textContent === t, 'Lifted: ' + (await nameOf(page, x)) + '. Now choose the one to set it with.');
  assert.match(await page.getAttribute('.fs-pl[data-i="' + i + '"]', 'aria-label'), / Lifted\. Row \d, column \d\.$/);
  P = await placeAt(page, j);
  await page.touchscreen.tap(P.x, P.y);
  await phaseIs(page, 'saying');
  await page.click('.fs-sbtn[data-s="1"]');
  await page.click('[data-add]');
  const field = page.locator('.fs-word');
  assert.deepEqual(await field.evaluate((f) => [getComputedStyle(f).fontSize, f.maxLength, f.getAttribute('enterkeyhint'), f.getAttribute('aria-label'), document.activeElement === f]), ['16px', 24, 'done', 'Your word', true]);
  await field.fill('a held breath');
  await page.keyboard.press('Enter');
  assert.deepEqual(await calls(page, 'word'), ['a held breath']);
  T.vocab = await page.evaluate(() => window.harness.state.saga.words);
  assert.deepEqual(T.vocab, ['a held breath']);
  r = await answered(page, g, T, x, y, 1, 10);
  assert.equal(await page.textContent('.fs-said'), 'Alike: ‘a held breath’.');
  await goOnTo(page);
  g = r.game;

  // 4. by keys: Enter lifts, an arrow moves the target, Enter sets; their own word comes first; Escape goes on
  const dirs = [[1, 'ArrowRight'], [2, 'ArrowDown'], [-1, 'ArrowLeft'], [-2, 'ArrowUp']];
  let key;
  [i, j, key] = (() => { for (const a of onBoard(g)) for (const [d, k] of dirs) { const b = a + d; if (g.slots[b] && (Math.abs(d) === 2 || Math.floor(a / 2) === Math.floor(b / 2))) return [a, b, k]; } return null; })();
  x = g.slots[i]; y = g.slots[j];
  await page.focus('.fs-pl[data-i="' + i + '"]');
  await page.keyboard.press('Enter');
  await phaseIs(page, 'lifted');
  await page.keyboard.press(key);
  assert.equal(await page.locator('.fs-pl.is-target').getAttribute('data-i'), String(j), 'the arrow moves the target');
  await page.keyboard.press('Enter');
  await phaseIs(page, 'saying');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'fs-ask', 'the focus moves to How do they go?');
  await page.focus('.fs-sbtn[data-s="1"]');
  await page.keyboard.press('Enter');
  assert.equal(await page.textContent('.fs-chip.fs-mine'), 'a held breath', 'the person’s own words come first');
  await page.focus('.fs-chip.fs-mine');
  await page.keyboard.press('Enter');
  r = await answered(page, g, T, x, y, 1, 10);
  await page.keyboard.press('Escape');
  await phaseIs(page, 'idle');
  g = r.game;
  assert.equal(await page.evaluate(() => document.activeElement.dataset.i), String(j), 'the focus comes back to the one that stayed');

  // 5. Shift+arrow sets with a neighbour at once; Unlike in mood; the board is set
  [i, j, key] = (() => { for (const a of onBoard(g)) for (const [d, k] of dirs) { const b = a + d; if (g.slots[b] && (Math.abs(d) === 2 || Math.floor(a / 2) === Math.floor(b / 2))) return [a, b, k]; } return null; })();
  x = g.slots[i]; y = g.slots[j];
  await page.focus('.fs-pl[data-i="' + i + '"]');
  await page.keyboard.press('Shift+' + key);
  await phaseIs(page, 'saying');
  await page.click('.fs-sbtn[data-s="-1"]');
  await page.click('.fs-chip[data-w="5"]');
  r = await answered(page, g, T, x, y, -1, 5);
  assert.equal(r.game.state, 'done');
  await page.locator('.fs-tapon').click();
  g = r.game;

  // the level end: no stars; what stayed; the building; every relation side by side with its line, Keep
  await page.waitForSelector('dialog[open] .fs-made');
  const res = RL.result(g, T), ends = await calls(page, 'end'), info = (await calls(page, 'endInfo'))[0];
  assert.equal(ends.length, 1);
  assert.deepEqual([ends[0].won, ends[0].stars, ends[0].used, ends[0].clock], [true, 1, 5, 25], 'the won-level marker, never shown');
  assert.equal(await page.textContent('dialog[open] .sheet-title'), 'Level 1 done.');
  const end = await page.textContent('dialog[open]');
  assert.doesNotMatch(end, /\bstars?\b|★|☆/i, 'no stars at the level end');
  assert.match(await page.textContent('dialog[open] .fp-endclock'), /^(In time: \d:\d\d to spare\. Your building flies a flag\.|\d:\d\d\. The clock gave 0:25\. Race it again\.)$/);
  assert.equal(await page.textContent('dialog[open] .fs-stay b'), dot(await nameOf(page, res.stayed)));
  assert.match(await page.textContent('dialog[open] .fs-stay p'), /You never carried it: everything else was set beside it\.$/);
  const flag = info.inTime ? ', flying a flag' : '';
  assert.equal(await page.textContent('dialog[open] .fp-btext'), 'Built: ' + (await nameOf(page, info.build.ways[0])) + ', ' + STOREYS[info.build.storeys[0] - 1] + flag + '.', 'storeys from relations');
  assert.equal(await page.textContent('dialog[open] .fs-made').then(() => page.locator('dialog[open] .fs-sec h3, dialog[open] .fp-sec h3').allTextContents()).then((hs) => hs.find((t) => /^What you made/.test(t))), 'What you made · 5');
  assert.deepEqual(await page.$$eval('dialog[open] .fs-made:not(.fs-others) .fs-mline', (ps) => ps.map((p) => p.textContent)), res.made.map((m) => RL.saidText(T.vocab, T.aspectOf, m.s, m.w)));
  assert.deepEqual(await page.$$eval('dialog[open] .fs-made:not(.fs-others) .fs-tag', (bs) => bs.map((b) => b.textContent)), res.made.map((m) => TAGS[m.kind]));
  assert.equal(await page.locator('dialog[open] .fs-made:not(.fs-others) li').first().locator('img').count(), 2, 'side by side');
  const tag = page.locator('dialog[open] .fs-tag').first();
  await tag.click();
  assert.equal(await tag.getAttribute('aria-expanded'), 'true');
  assert.equal(await page.locator('dialog[open] .fs-eyeline:not([hidden])').first().textContent(), res.made[0].line, 'the tag opens that eye’s line in place');
  await page.locator('dialog[open] .fp-heart').first().click();
  assert.deepEqual(await calls(page, 'heart'), [{ ids: [res.made[0].x, res.made[0].y], on: true }]);
  assert.equal(await page.locator('dialog[open] .fs-others li').count(), res.others.length);
  if (info.build.ways.length > 1) {
    await page.locator('dialog[open] [data-way]').click();
    assert.deepEqual(await calls(page, 'build'), [info.build.ways[1]]);
    assert.equal(await page.textContent('dialog[open] .fp-wayn'), '2 of ' + info.build.ways.length);
  }
  await page.evaluate(() => { document.querySelector('dialog[open] .sheet-body').scrollTop = 0; });
  await shot(page, 'set-end-390');
  await page.evaluate(() => { document.querySelector('dialog[open] .sheet-body').scrollTop = 520; });
  await shot(page, 'set-end-390-made');
  await page.locator('dialog[open] [data-next]').click();
  assert.deepEqual(await calls(page, 'next'), [2]);
  await page.waitForFunction(() => { const t = document.querySelector('dialog[open] .sheet-title'); return t && t.textContent === 'Level 2'; });
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Set: every picture whole in its place at 390 x 664, 390 x 844 and 1280 x 800, and nothing scrolls', async () => {
  for (const [w, h, cols] of [[390, 664, 2], [390, 844, 2], [1280, 800, 3]]) {
    const { ctx, page, errors } = await open({ w, h, touch: w < 600 }, 'set=1', '#level=7');
    await setLevel(page);
    if (h === 844) await page.locator('dialog[open] .fp-clockset label').nth(0).click();   // the clock off: the board takes the room
    await setPlay(page);
    if (h === 844) {
      assert.equal(await page.locator('.fp-time, .fp-cring').count(), 0);
      assert.deepEqual([await page.getAttribute('.fp-boost[data-b="more"]', 'aria-disabled'), await page.getAttribute('.fp-boost[data-b="more"]', 'aria-label')], ['true', 'Five more, 1 held. The clock is off.']);
      await page.click('.fp-boost[data-b="more"]', { force: true });   // greyed, yet a tap says why
      assert.equal(await page.textContent('.fs-say1'), 'The clock is off.');
    }
    await page.waitForFunction(() => [...document.querySelectorAll('.fs-pl img')].every((i) => i.complete && i.naturalWidth > 0));
    const m = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('.fs-pl')) {
        const im = b.querySelector('img'), r = b.getBoundingClientRect();
        if (!im) continue;
        const q = im.getBoundingClientRect();
        out.push({ inside: q.left >= r.left - 1 && q.right <= r.right + 1 && q.top >= r.top - 1 && q.bottom <= r.bottom + 1,
          off: Math.abs(q.height - (q.width * im.naturalHeight) / im.naturalWidth), fills: Math.abs(q.width - r.width) < 1 || Math.abs(q.height - r.height) < 1, ph: r.height });
      }
      const f = document.querySelector('.fp-set');
      return { out, scroll: f.scrollHeight - f.clientHeight, page: document.documentElement.scrollHeight - innerHeight, wide: document.documentElement.scrollWidth - innerWidth,
        cols: new Set([...document.querySelectorAll('.fs-pl')].map((b) => Math.round(b.getBoundingClientRect().left))).size };
    });
    const at = w + 'x' + h + ': ';
    assert.equal(m.out.length, 6, at + 'six pictures');
    assert.ok(m.out.every((p) => p.inside), at + 'every picture inside its place');
    assert.ok(m.out.every((p) => p.off <= 1), at + 'every picture at its own proportions (±1 px): ' + m.out.map((p) => p.off.toFixed(2)));
    assert.ok(m.out.every((p) => p.fills), at + 'each as large as its place allows');
    assert.ok(m.out.every((p) => p.ph >= 110), at + 'places at least 110 px tall');
    assert.deepEqual([m.scroll, m.page, m.wide, m.cols], [0, 0, 0, cols], at + 'nothing scrolls; ' + cols + ' columns');
    await shot(page, 'set-board-' + w + 'x' + h);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('Set: Look is a still press (a move carries instead); the clock starts at the first press, runs during Look, stands while saying', async () => {
  const { ctx, page, cdp, errors } = await open({ touch: true, skip: true }, 'set=1', '#level=2');
  const skip = (ms) => page.evaluate((x) => window.__skip(x), ms);
  const left = async () => secsOf(await page.textContent('.fp-time'));
  const L = await setLevel(page), T = L.table;
  let g = RL.newGame(RL.level(2), T, L.seed, L.lead);
  await setPlay(page);
  const total = 5 * g.moves;
  await skip(20000);
  await sleep(1100);
  assert.equal(await left(), total, 'nothing runs before the first press');
  // Look: held still for 400 ms
  const [i, j] = onBoard(g), A = await placeAt(page, i), B = await placeAt(page, j);
  await touch(cdp, 'touchStart', A);
  await sleep(420);
  assert.equal(await page.locator('.fs-look:not([hidden])').count(), 1, 'a still press opens Look');
  assert.equal(await page.textContent('.fs-lname'), await nameOf(page, g.slots[i]));
  await page.waitForFunction(() => /^Look: /.test(document.querySelector('.fp-live').textContent));
  if (T.words[g.slots[i]].length) assert.match(await page.textContent('.fs-lwords'), /^In others’ words: /);
  await shot(page, 'set-look-390');
  await skip(5000);
  await timeAtMost(page, total - 5);
  assert.ok((await left()) <= total - 5, 'the clock runs on during Look');
  await touch(cdp, 'touchEnd');
  await phaseIs(page, 'idle');
  assert.equal(await page.locator('.fs-look:not([hidden])').count(), 0, 'letting go closes it');
  // a move at 200 ms carries instead
  await touch(cdp, 'touchStart', A);
  await sleep(200);
  await touch(cdp, 'touchMove', { x: A.x + (B.x - A.x) * 0.2, y: A.y + (B.y - A.y) * 0.2 });
  await sleep(300);
  assert.equal(await page.locator('.fs-look:not([hidden])').count(), 0, 'no Look once it moved');
  assert.equal(await page.locator('.fs-pl.is-carry.is-home').count(), 1, 'carried, its place dashed');
  await touch(cdp, 'touchMove', B);
  assert.equal(await page.locator('.fs-pl.is-target').getAttribute('data-i'), String(j), 'the one under the finger takes the ring');
  await touch(cdp, 'touchEnd');
  await phaseIs(page, 'saying');
  const t0 = await left();
  await skip(20000);
  await sleep(1100);
  assert.equal(await left(), t0, 'it stands while saying');
  await page.click('.fs-sbtn[data-s="1"]');
  await page.click('.fs-chip[data-w="3"]');
  const r = await answered(page, g, T, g.slots[i], g.slots[j], 1, 3);
  await skip(20000);
  await sleep(1100);
  assert.equal(await left(), t0, 'and while the answer shows');
  await goOnTo(page);
  g = r.game;
  await skip(10000);
  await timeAtMost(page, t0 - 9);
  assert.ok((await left()) <= t0 - 9, 'it runs again while the person looks for a pair');
  // L looks at the focused picture; Escape closes it; H says the hint (a line, nothing leans)
  await page.focus('.fs-pl[data-i="' + onBoard(g)[0] + '"]');
  await page.keyboard.press('l');
  assert.equal(await page.locator('.fs-look:not([hidden])').count(), 1);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.fs-look:not([hidden])').count(), 0);
  await page.keyboard.press('h');
  assert.equal(await page.textContent('.fs-say1'), 'Any two can go together. Which two would you hang side by side?');
  assert.equal(await page.locator('.fs-pl.is-target, .fs-pl.is-lift').count(), 0, 'nothing leans');
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Set in reduced motion and dark: nothing lifts, follows or flies, answers fade in place, no thread', async () => {
  const { ctx, page, cdp, errors } = await open({ touch: true, reduce: true, dark: true }, 'set=1', '#level=7');
  const L = await setLevel(page), T = L.table;
  let g = RL.newGame(RL.level(7), T, L.seed, L.lead);
  await setPlay(page);
  assert.deepEqual([await page.locator('.fp-cring').count(), await page.textContent('.fp-time')], [0, mss(5 * g.moves)], 'the time in text, no ring');
  await page.evaluate(() => {
    window.__seen = { moved: 0, threads: 0, flies: 0 }; window.__rec = true;
    const f = () => {
      for (const p of document.querySelectorAll('.fs-pic, .fs-dpic')) if (/translate|scale/.test(p.style.transform)) window.__seen.moved++;
      window.__seen.threads += document.querySelectorAll('.fs-thread').length; window.__seen.flies += document.querySelectorAll('.fs-fly').length;
      if (window.__rec) requestAnimationFrame(f);
    };
    requestAnimationFrame(f);
  });
  for (let k = 0; k < 2; k++) {
    const [i, j] = onBoard(g), x = g.slots[i], y = g.slots[j];
    const A = await placeAt(page, i), B = await placeAt(page, j);
    await touch(cdp, 'touchStart', A);
    for (let s = 1; s <= 6; s++) { await touch(cdp, 'touchMove', { x: A.x + (B.x - A.x) * s / 6, y: A.y + (B.y - A.y) * s / 6 }); await sleep(12); }
    assert.equal(await page.locator('.fs-pl.is-target').getAttribute('data-i'), String(j), 'the target ring still follows');
    await touch(cdp, 'touchEnd');
    await phaseIs(page, 'saying');
    await page.click('.fs-sbtn[data-s="' + (k ? -1 : 1) + '"]');
    await page.click('.fs-chip[data-w="' + (k + 1) + '"]');
    const r = await answered(page, g, T, x, y, k ? -1 : 1, k + 1);
    if (r.arrival) assert.ok((await page.textContent('.fs-arrive')).startsWith('In: ' + dot(await nameOf(page, r.arrival.id))));
    if (!k) { await settle(); await shot(page, 'set-answer-reduced-dark'); }
    await goOnTo(page);
    g = r.game;
    assert.deepEqual(await slotsOn(page), g.slots);
  }
  const seen = await page.evaluate(() => { window.__rec = false; return window.__seen; });
  assert.deepEqual(seen, { moved: 0, threads: 0, flies: 0 }, 'under reduced motion nothing lifts, follows, rises or flies, and there is no thread');
  await shot(page, 'set-board-reduced-dark');
  await page.evaluate(() => { location.hash = 'level=1'; });   // level 1's ghost hand is an arrow
  await setPlay(page);
  assert.match(await page.textContent('.fs-ghost.fp-arrow'), /^[←→↑↓]$/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Set boosters by mouse at 1280: Pass, Turn (a turn noticed in words, Note why, no reward) and Five more; Map leaves an unfinished play', async () => {
  const { ctx, page, errors } = await open({ w: 1280, h: 800 }, 'set=1&rel=3', '#level=7');
  const left = async () => secsOf(await page.textContent('.fp-time'));
  const L = await setLevel(page), T = L.table;
  assert.equal(Object.keys(T.rel).length, 3, 'three relations said before');
  let g = RL.newGame(RL.level(7), T, L.seed, L.lead);
  await setPlay(page);
  // Pass: press it, then a picture: it leaves, set beside nothing; one comes in from the pile
  await page.click('.fp-boost[data-b="pass"]');
  assert.equal(await page.getAttribute('.fp-boost[data-b="pass"]', 'aria-pressed'), 'true');
  assert.equal(await page.textContent('.fs-say1'), 'Pass: press a picture and it leaves.');
  const i = onBoard(g)[0], gone = g.slots[i];
  const P = await placeAt(page, i);
  await page.mouse.click(P.x, P.y);
  const rp = RL.pass(g, T, i);
  await phaseIs(page, 'idle');
  g = rp.game;
  assert.deepEqual(await slotsOn(page), g.slots);
  assert.equal(await page.textContent('.fs-say1'), (await nameOf(page, gone)) + ' leaves, set beside nothing.');
  assert.equal(await page.textContent('.fs-say2'), rp.arrival ? 'In: ' + dot(await nameOf(page, rp.arrival.id)) : 'The board gets smaller.');
  assert.equal(await page.textContent('.fp-moves b'), String(toGo(g)));
  assert.deepEqual(await calls(page, 'boost'), ['pass']);
  assert.deepEqual(await calls(page, 'relate'), [], 'a pass is no relation');
  // Turn: the oldest relation from before comes back over the board; said the other way, it is a turn
  const b = RL.back(g, T);
  assert.ok(b && g.slots.indexOf(b.a) < 0, 'Turn has a pair to bring back, its first thing not on the board');
  await page.click('.fp-boost[data-b="turn"]');
  await phaseIs(page, 'saying');
  assert.equal(await page.textContent('.fs-q'), 'You said: ' + low1(RL.saidText(T.vocab, T.aspectOf, b.s, b.w)) + ' And now?');
  assert.equal(await page.textContent('.fs-names'), (await nameOf(page, b.a)) + ' · and · ' + (await nameOf(page, b.b)));
  await page.click('.fs-sbtn[data-s="' + -b.s + '"]');
  await page.click('[data-goon]');
  const rt = await answered(page, g, T, b.a, b.b, -b.s, 0);
  assert.equal(rt.answer.kind, 'turn');
  assert.deepEqual([await page.textContent('.fs-eye.is-turn b'), await page.locator('.fs-ask [data-note]').count()], ['A turn', 1], 'a turn says so, in violet, with Note why');
  assert.doesNotMatch(await page.textContent('.fs-ask'), /\bstars?\b|★/i, 'a turn rewards nothing');
  await settle();
  await shot(page, 'set-turn-1280');
  await page.click('.fs-ask [data-note]');
  assert.deepEqual(await calls(page, 'note'), [{ ids: [b.a, b.b] }]);
  await sleep(2200);
  assert.equal(await page.getAttribute('.fp-set', 'data-phase'), 'answer', 'a turn waits for a tap');
  await goOnTo(page);
  assert.deepEqual(await slotsOn(page), g.slots, 'the board does not change');
  g = rt.game;
  assert.deepEqual(await calls(page, 'relate'), [{ x: b.a, y: b.b, s: -b.s, w: 0 }]);
  assert.equal(await page.isDisabled('.fp-boost[data-b="turn"]'), true, 'none left');
  // Five more: five seconds a move, five moves more, once a level
  const t0 = await left();
  await page.click('.fp-boost[data-b="more"]');
  const more = (await left()) - t0;
  assert.ok(more >= 24 && more <= 25, 'Five more adds 25 seconds: ' + more);
  assert.deepEqual(await calls(page, 'boost'), ['pass', 'turn', 'more']);
  assert.deepEqual([await page.isDisabled('.fp-boost[data-b="more"]'), await page.getAttribute('.fp-boost[data-b="more"]', 'aria-label')], [true, 'Five more, 0 held']);
  await shot(page, 'set-boosters-1280');
  await page.click('.fp-back');
  const ends = await calls(page, 'end');
  assert.deepEqual([ends.length, ends[0].won, ends[0].stars], [1, false, 0], 'left midway: an unfinished play; every pairing already saved');
  assert.deepEqual(await calls(page, 'map'), [true]);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('Set: the first board under six kept: pairing works, nothing leaves, no clock, Keep one in Sort', async () => {
  const { ctx, page, errors } = await open({ touch: true }, 'set=1&keep=4', '#first');
  await page.waitForSelector('.fs-free .fs-pl');
  const T = (await page.evaluate(() => window.harness.level)).table;
  assert.equal(T.pool.length, 4);
  assert.deepEqual(await slotsOn(page), T.pool.concat([null, null]));
  assert.deepEqual(await page.$$eval('.fs-pl.is-keep', (bs) => bs.map((b) => b.textContent)), ['+Keep one in Sort', '+Keep one in Sort']);
  assert.equal(await page.locator('.fp-time, .fp-boosts, .fp-top, .fp-cring').count(), 0, 'no clock, no boosters, no level');
  assert.equal(await page.locator('dialog[open]').count(), 0, 'no level card');
  const K = await placeAt(page, 5);
  await page.touchscreen.tap(K.x, K.y);
  assert.deepEqual(await calls(page, 'sort'), [true], 'an empty place opens Sort');
  const A = await placeAt(page, 0), B = await placeAt(page, 1);
  await page.touchscreen.tap(A.x, A.y); await sleep(120); await page.touchscreen.tap(B.x, B.y);
  await phaseIs(page, 'saying');
  await page.click('.fs-sbtn[data-s="1"]');
  await page.click('.fs-chip[data-w="2"]');
  const ans = RL.answer(T, { made: [] }, T.pool[0], T.pool[1], 1, 2);
  await phaseIs(page, 'answer');
  assert.equal(await page.textContent('.fs-eye p'), ans.line);
  await settle();
  await shot(page, 'set-first-answer-390');
  await goOnTo(page);
  assert.deepEqual(await slotsOn(page), T.pool.concat([null, null]), 'nothing leaves the first board');
  assert.equal(await page.textContent('.fs-lastrow p'), RL.saidText(T.vocab, T.aspectOf, 1, 2) + ' ' + ans.line, 'the last pairing under the board');
  assert.deepEqual(await calls(page, 'relate'), [{ x: T.pool[0], y: T.pool[1], s: 1, w: 2 }]);
  assert.deepEqual(await calls(page, 'end'), []);
  await shot(page, 'set-first-390');
  assert.deepEqual(errors, []);
  await ctx.close();
  for (const k of [1, 0]) {   // the lines round the first board are the app's (ui.smoke)
    const o = await open({ dark: true }, 'set=1&keep=' + k, '#first');
    await o.page.waitForSelector('.fs-free .fs-pl');
    assert.equal(await o.page.locator('.fs-free .fs-pl img').count(), k);
    assert.equal(await o.page.locator('.fs-pl.is-keep').count(), 6 - k);
    assert.deepEqual(o.errors, []);
    await o.ctx.close();
  }
});

test('Set level 7 by mouse at 1280 in dark: arrivals say why they came, the board gets smaller to the one that stays, the level end', async () => {
  const { ctx, page, errors } = await open({ w: 1280, h: 800, dark: true }, 'set=1&stars=1,1,1,1,1,1', '#level=7');
  const L = await setLevel(page), T = L.table;
  let g = RL.newGame(RL.level(7), T, L.seed, L.lead), smaller = false, k = 0, arrivals = 0;
  assert.ok(g.pile >= 1, 'level 7 has a pile');
  await setPlay(page);
  for (;;) {
    const [i, j] = onBoard(g), x = g.slots[i], y = g.slots[j], s = k % 2 ? -1 : 1, w = (k % 5) + 1;
    await carry('mouse', page, null, i, j);
    await phaseIs(page, 'saying');
    await page.click('.fs-sbtn[data-s="' + s + '"]');
    await page.click('.fs-chip[data-w="' + w + '"]');
    const r = await answered(page, g, T, x, y, s, w);
    if (r.arrival) {
      arrivals++;
      assert.equal(await page.textContent('.fs-arrive'), 'In: ' + dot(await nameOf(page, r.arrival.id)) + (r.arrival.line ? ' ' + r.arrival.line : ''), 'an arrival says why it came');
      if (arrivals === 1) { await settle(); await shot(page, 'set-arrival-1280-dark'); }
    }
    if (r.game.state === 'done') { await page.locator('.fs-tapon').click(); g = r.game; break; }
    await goOnTo(page);
    assert.deepEqual(await slotsOn(page), r.game.slots, 'move ' + (k + 1));
    assert.equal(await page.textContent('.fs-say2'), r.arrival ? r.arrival.line || '' : smaller ? '' : SMALLER);
    if (!r.arrival) smaller = true;
    assert.equal(await page.textContent('.fp-moves b'), String(toGo(r.game)));
    g = r.game; k++;
  }
  assert.ok(arrivals >= 1 && smaller, 'arrivals, then the board got smaller');
  await page.waitForSelector('dialog[open] .fs-made');
  const res = RL.result(g, T), info = (await calls(page, 'endInfo'))[0];
  assert.equal(await page.textContent('dialog[open] .sheet-title'), 'Level 7 done.');
  assert.doesNotMatch(await page.textContent('dialog[open]'), /\bstars?\b|★|☆/i);
  assert.equal(await page.locator('dialog[open] .fs-made:not(.fs-others) li').count(), res.made.length);
  assert.equal(await page.locator('dialog[open] .fs-others li').count(), res.others.length);
  if (res.others.length) assert.match(await page.textContent('dialog[open]'), /Other eyesSomeone else put these together\./);
  assert.equal(await page.locator('dialog[open] .fs-next').count(), (info.ask ? 1 : 0) + (info.sortAFive ? 1 : 0));
  assert.equal(await page.locator('dialog[open] [data-sort]').count(), info.sortAFive ? 1 : 0);
  await shot(page, 'set-end-1280-dark');
  await page.locator('dialog[open] [data-kingdom]').click();
  assert.deepEqual(await calls(page, 'kingdom'), [7]);
  assert.equal(await page.locator('dialog[open]').count(), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});
