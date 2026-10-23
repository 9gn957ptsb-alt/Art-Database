/* 5s play and board smoke test (Playwright + node:test).
 *
 *   node --test 5s/test/play.smoke.cjs
 *
 * Serves 5s/ itself and opens test/play.html, the harness for src/play.js and src/board.js (the deck
 * from 5s/dist, or the fixture when there is no build; an example taste). The boards are deterministic,
 * so this file plans every move in Node with the same engine (src/match.js) and checks the page
 * against it after each one.
 *   SHOTS   folder for screenshots (default <tmp>/5s-play-shots)
 *   FONTS   optional folder holding css.css and the font files (named by md5 of url + "\n"), for true type in shots
 *
 * The board: two columns at 390, five at 1280, every tile at its own proportions, lazy images with their
 * sizes, sections by kind, then clusters, paintings and "Not put together yet" once there are pairings.
 * The map: thirty levels climbing, in DOM order, the next one first. The game: a bounce, then swaps by
 * touch drag, tap-tap, Enter and an arrow, Shift+arrow and mouse drags; the Sound button and M; H;
 * a cascade with the CPU slowed 4x within the frame budget (p95 <= 20 ms); a special and a combo;
 * the Pass booster; reduced motion (tiles only ever sit on cells) and its dashed hint; out of moves,
 * Five more, out again, Map; a win, the finale and the level end (stars, score, hearts, a booster
 * earned, Keep this painting), Next level and Your board; light and dark.
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
    }).listen(0, '127.0.0.1', () => res(s));
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
  const { ctx, page, errors } = await open({ dark: true, touch: true }, 'stars=3,2,1', '#map');
  await page.waitForSelector('.fp-node');
  await sleep(300);
  const ns = await page.locator('.fp-node button').evaluateAll((bs) => bs.map((b) => [+b.dataset.n, b.getAttribute('aria-label'), b.getAttribute('aria-disabled'), Math.round(b.getBoundingClientRect().top)]));
  assert.equal(ns.length, 30);
  assert.deepEqual(ns.map((x) => x[0]), Array.from({ length: 30 }, (_, i) => i + 1), 'DOM order 1..30');
  assert.deepEqual(ns.slice(0, 5).map((x) => x[1]), ['Level 1, 3 of 3 stars', 'Level 2, 2 of 3 stars', 'Level 3, 1 of 3 stars', 'Level 4, Next', 'Level 5, Not yet']);
  assert.equal(ns[4][2], 'true');
  assert.match(await page.textContent('.fp-node.is-done .fp-nl'), /^★★★3 of 3 stars$/);
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
  const hearts = page.locator('dialog[open] .fp-heart');
  assert.equal(await hearts.count(), Math.min(6, res.groups.length));
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
  await page.locator('dialog[open] [data-more]').click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  assert.equal(await page.textContent('.fp-moves b'), '5');
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
