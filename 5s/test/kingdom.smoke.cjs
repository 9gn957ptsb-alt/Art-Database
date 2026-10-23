/* 5s kingdom smoke test (Playwright + node:test).
 *
 *   node --test 5s/test/kingdom.smoke.cjs
 *
 * Serves 5s/ itself and opens test/kingdom.html, the harness for src/kingdom.js (the deck from 5s/dist,
 * or the fixture when there is no build; an example taste; eight levels won). At 390 (touch) and 1280
 * (mouse), light and dark: the nodes in DOM order and labelled; the map opens on the next level; a drag
 * pans and never opens a level; a tap opens one; pinch, wheel and Ctrl+wheel; the Zoom buttons, the
 * arrows, Home and Tab; nodes of 24 px or more at zoom 0.5; the cloud's words; no console errors; a
 * p95 frame of at most 20 ms while panning with the CPU slowed 4x. Then reduced motion, nothing judged,
 * a new area found and the focus kept through a theme change; a short map (a phone on its side); Tab
 * panning to Your ground and the nodes at 3, 8 and 30 won; touch on the foot (a pinch, a drag, a tap)
 * and three fingers; the title at 320.
 *   SHOTS   folder for screenshots (default <tmp>/5s-kingdom-shots)
 *   FONTS   optional folder holding css.css and the font files (named by md5 of url + "\n"), for true type in
 *           shots and in the title's check (without it the title is measured in a fallback font)
 *   GROUND  optional ground.js to serve in place of src/ground.js
 *   PORT    the port to serve on (default: any free port)
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
const SHOTS = path.resolve(process.env.SHOTS || path.join(os.tmpdir(), '5s-kingdom-shots'));
const FONTS = process.env.FONTS || '';
const FIXTURE = process.env.DECK === 'fixture' || !fs.existsSync(path.join(ROOT, 'dist', 'deck.json'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg' };

let server, browser, BASE;
before(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  server = await new Promise((res) => {
    const s = http.createServer((req, rsp) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const p = url === '/src/ground.js' && process.env.GROUND ? path.resolve(process.env.GROUND) : path.join(ROOT, url);
      if ((p !== path.resolve(process.env.GROUND || '-') && !p.startsWith(ROOT + path.sep)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' });
      fs.createReadStream(p).pipe(rsp);
    }).listen(+process.env.PORT || 0, '127.0.0.1', () => res(s));
  });
  BASE = 'http://127.0.0.1:' + server.address().port + '/test/kingdom.html';
  browser = await chromium.launch();
});
after(async () => { if (browser) await browser.close(); if (server) server.close(); });

async function open(o, query) {
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
  await page.goto(BASE + (q.toString() ? '?' + q : ''));
  await page.waitForFunction(() => (window.harness && window.harness.ready) || window.harnessError);
  assert.equal(await page.evaluate(() => window.harnessError || ''), '');
  return { ctx, page, cdp: await ctx.newCDPSession(page), errors };
}
// Once the islands near the view are drawn (they land 150 ms after the view settles).
const drawn = (page) => page.waitForFunction(() => document.querySelectorAll('.fk-isle.is-drawn').length >= 2, null, { timeout: 15000 });
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, name + '.png') });
const calls = (page, kind) => page.evaluate((k) => window.harness.calls.filter((c) => c[0] === k).map((c) => c[1]), kind);
const zoom = (page) => page.evaluate(() => +document.querySelector('.fk-table').style.getPropertyValue('--z'));
const box = (page, sel) => page.locator(sel).boundingBox();
const mid = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
async function settle(page) { await sleep(420); }   // an eased move (260 ms) and a frame or two
// '' when the control is fully in view: inside the map and above the foot's buttons; else where it is.
const clear = (page, sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect(), m = document.querySelector('.fk-map').getBoundingClientRect(), f = document.querySelector('.fk-foot').getBoundingClientRect();
  return r.left >= m.left && r.right <= m.right && r.top >= m.top && r.bottom <= f.top ? '' : s + ' at ' + [r.left, r.top, r.right, r.bottom].map(Math.round) + ', the map clear of the foot ' + [m.left, m.top, m.right, f.top].map(Math.round);
}, sel);
const view = (page) => page.evaluate(() => { const m = /translate3d\(([-\d.]+)px, ([-\d.]+)px, 0px\) scale\(([\d.]+)\)/.exec(document.querySelector('.fk-table').style.transform); return [+m[1], +m[2], +m[3]]; });

for (const mode of [{ w: 390, h: 844, touch: true }, { w: 1280, h: 800 }]) {
  for (const dark of [false, true]) {
    const tag = mode.w + '-' + (dark ? 'dark' : 'light');
    test('kingdom at ' + tag + (mode.touch ? ' (touch)' : ' (mouse)'), async () => {
      const { ctx, page, cdp, errors } = await open(Object.assign({ dark }, mode));
      await drawn(page);
      await shot(page, 'kingdom-' + tag);

      // The words, and the nodes: one list, DOM order 1..15 (areas Sort and Split), labelled in words.
      assert.equal(await page.locator('.fp-title').textContent(), 'Your kingdom');
      assert.equal(await page.locator('.fk-line').textContent(), 'Every level you win builds one of your things. Next: level 9, in Split.');
      assert.equal(await page.locator('.fk-play').textContent(), 'Play level 9');
      const labels = await page.locator('ol.fk-nodes[aria-label="Levels"] > li > button').evaluateAll((bs) => bs.map((b) => [b.dataset.n, b.getAttribute('aria-label'), b.getAttribute('aria-disabled')]));
      assert.deepEqual(labels.map((l) => +l[0]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      assert.match(labels[0][1], /^Level 1, Sort, 3 of 3 stars, in time\. Built: .+\.$/);
      assert.match(labels[1][1], /^Level 2, Sort, 2 of 3 stars\. Built: .+\.$/);
      assert.equal(labels[3][1], 'Level 4, Sort, 1 of 3 stars, in time. Built: a plain house.');
      assert.equal(labels[8][1], 'Level 9, Split, Next.');
      assert.equal(labels[9][1], 'Level 10, Split, Not yet.');
      assert.equal(labels[9][2], 'true');
      assert.equal(await page.locator('.fk-cloud p').textContent(), 'Under cloud: Set. Win level 10 to find it.');
      assert.ok(await page.locator('.fk-cloud p').isVisible());
      const isle = await page.locator('.fk-isle.is-drawn canvas').first().getAttribute('aria-label');
      assert.match(isle, /An island on a plinth\./);

      // It opens on the next level: its node near the middle of the map above the foot's buttons.
      const mapB = await box(page, '.fk-map'), footB = await box(page, '.fk-foot');
      const n9 = mid(await box(page, '[data-n="9"]'));
      assert.ok(Math.abs(n9.x - (mapB.x + mapB.width / 2)) < 30, 'next level centred across: ' + n9.x);
      assert.ok(n9.y > mapB.y + 40 && n9.y < footB.y - 20, 'next level in view above the foot: ' + n9.y);
      assert.ok(Math.abs((await zoom(page)) - Math.min(1.2, Math.max(0.5, 0.9 * mapB.width / 520))) < 0.01);

      // A drag that starts on a node pans the table and never opens the level.
      const n8 = mid(await box(page, '[data-n="8"]'));
      if (mode.touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: n8.x, y: n8.y }] });
        for (let k = 1; k <= 8; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: n8.x - 10 * k, y: n8.y + 14 * k }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(n8.x, n8.y); await page.mouse.down();
        await page.mouse.move(n8.x - 80, n8.y + 112, { steps: 8 }); await page.mouse.up();
      }
      await sleep(80);
      const n8b = mid(await box(page, '[data-n="8"]'));
      assert.ok(Math.abs(n8b.x - (n8.x - 80)) < 3 && Math.abs(n8b.y - (n8.y + 112)) < 3, 'the drag moved the table with the pointer');
      assert.deepEqual(await calls(page, 'level'), []);

      // A tap opens a level (a second after the drag: a tap during a fling only stops it); a level not yet open does nothing.
      await sleep(1000);
      if (mode.touch) await page.touchscreen.tap(n8b.x, n8b.y); else await page.mouse.click(n8b.x, n8b.y);
      assert.deepEqual(await calls(page, 'level'), [8]);
      await page.locator('[data-n="10"]').click({ force: true });
      assert.deepEqual(await calls(page, 'level'), [8]);
      await page.locator('.fk-play').click();
      assert.deepEqual(await calls(page, 'level'), [8, 9]);

      // Pinch (touch) or Ctrl+wheel (mouse) zooms about the fingers or the pointer; the wheel pans.
      const z0 = await zoom(page);
      const c = { x: mapB.x + mapB.width / 2, y: mapB.y + mapB.height / 2 };
      if (mode.touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x - 40, y: c.y, id: 1 }, { x: c.x + 40, y: c.y, id: 2 }] });
        for (let k = 1; k <= 6; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x - 40 - 8 * k, y: c.y, id: 1 }, { x: c.x + 40 + 8 * k, y: c.y, id: 2 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(80);
        assert.ok(Math.abs((await zoom(page)) / z0 - 88 / 40) < 0.05, 'pinch zooms by the fingers\' spread: ' + (await zoom(page)) / z0);
      } else {
        await page.mouse.move(c.x, c.y);
        await page.keyboard.down('Control'); await page.mouse.wheel(0, 40); await page.keyboard.up('Control');
        await sleep(80);
        { const zw = await zoom(page); assert.ok(zw < z0 * 0.9 && zw > 0.5, 'Ctrl+wheel zooms out: ' + z0 + ' to ' + zw); }
        const before = mid(await box(page, '[data-n="5"]'));
        await page.mouse.wheel(0, 120); await sleep(80);
        const after = mid(await box(page, '[data-n="5"]'));
        assert.ok(before.y - after.y > 30 && Math.abs(after.x - before.x) < 1, 'the wheel pans: ' + (before.y - after.y));   // by deltaY in CSS px (120 / the scale factor)
      }

      // The keys: Home finds the next level, the arrows pan 64 px, + and − zoom.
      await page.locator('.fk-map').focus();
      await page.keyboard.press('Home'); await settle(page);
      const h9 = mid(await box(page, '[data-n="9"]'));
      assert.ok(Math.abs(h9.x - c.x) < 3, 'Home centres the next level');
      await page.keyboard.press('ArrowLeft'); await sleep(60);
      assert.ok(Math.abs(mid(await box(page, '[data-n="9"]')).x - (h9.x + 64)) < 2, 'ArrowLeft looks left: the table moves right 64 px');
      const zk = await zoom(page);
      await page.keyboard.press('Minus'); await settle(page);
      assert.ok(Math.abs((await zoom(page)) - Math.max(0.5, zk / 1.25)) < 0.01, '− zooms out');
      await page.keyboard.press('Equal'); await settle(page);
      assert.ok(Math.abs((await zoom(page)) - zk) < 0.01, '+ zooms in');
      // Two quick presses of a Zoom button each count: the second goes on from where the first is going.
      const [zb, zf] = zk * 1.5625 <= 1.5 ? ['.fk-zi', 1.5625] : ['.fk-zo', 1 / 1.5625];
      for (let k = 0; k < 2; k++) await (mode.touch ? page.locator(zb).tap() : page.locator(zb).click());
      await settle(page);
      assert.ok(Math.abs((await zoom(page)) - zk * zf) < 0.01, 'two quick presses of ' + zb + ': ' + zk + ' to ' + (await zoom(page)));

      // The Zoom buttons, down to 0.5: every node still at least 24 px, the cloud's words still shown.
      for (let k = 0; k < 6; k++) { await page.locator('.fk-zo').click(); await sleep(60); }
      await settle(page);
      assert.equal(await zoom(page), 0.5);
      for (const b of await page.locator('.fk-node button').all()) {
        const r = await b.boundingBox();
        assert.ok(r.width >= 24 && r.height >= 24, 'a node at zoom 0.5 is ' + r.width + ' px');
      }
      assert.ok(await page.locator('.fk-cloud p').isVisible());
      await drawn(page); await sleep(300);
      await shot(page, 'kingdom-' + tag + '-out');
      for (let k = 0; k < 8; k++) { await page.locator('.fk-zi').click(); await sleep(40); }
      await settle(page);
      assert.equal(await zoom(page), 1.5);
      await page.keyboard.press('Home');
      await sleep(600); await drawn(page); await sleep(400);
      await shot(page, 'kingdom-' + tag + '-in');

      // Tab goes from the map to the home island's label, then through the nodes in order; each is panned into view, clear of the foot.
      await page.locator('.fk-map').focus();
      await page.keyboard.press('Tab');
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('fk-homel')), 'Tab from the map lands on Your ground');
      await settle(page);
      assert.equal(await clear(page, '.fk-homel'), '');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.n), '1');
      await settle(page);
      assert.equal(await clear(page, '[data-n="1"]'), '');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.n), '2');

      // Panning never loses the kingdom: a long drag away still leaves part of it in view.
      await page.keyboard.press('Home'); await settle(page);
      await page.keyboard.press('Minus'); await page.keyboard.press('Minus'); await settle(page);
      for (let k = 0; k < 40; k++) await page.keyboard.press('ArrowRight');
      await sleep(100);
      const seen = await page.evaluate(() => { const m = document.querySelector('.fk-map').getBoundingClientRect(); return [...document.querySelectorAll('.fk-isle, .fk-cloud')].some((e) => { const r = e.getBoundingClientRect(); return r.right > m.left && r.left < m.right && r.bottom > m.top && r.top < m.bottom; }); });
      assert.ok(seen, 'some of the kingdom stays in view');

      // A p95 frame of at most 20 ms while panning, the CPU slowed 4x.
      await page.keyboard.press('Home'); await settle(page); await drawn(page); await sleep(300);
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
      await page.evaluate(() => { window.__ft = []; window.__rec = true; let last = 0; const f = (t) => { if (last) window.__ft.push(t - last); last = t; if (window.__rec) requestAnimationFrame(f); }; requestAnimationFrame(f); });
      const s0 = { x: c.x, y: c.y + 60 };
      if (mode.touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [s0] });
        for (let k = 1; k <= 40; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: s0.x + 60 * Math.sin(k / 6), y: s0.y + 9 * k }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(s0.x, s0.y); await page.mouse.down();
        for (let k = 1; k <= 40; k++) await page.mouse.move(s0.x + 60 * Math.sin(k / 6), s0.y + 9 * k);
        await page.mouse.up();
      }
      const ft = await page.evaluate(() => { window.__rec = false; return window.__ft; });
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
      const sorted = ft.slice().sort((a, b) => a - b), p95 = sorted[Math.floor(sorted.length * 0.95)];
      console.log('# panning at ' + tag + ', 4x CPU: ' + ft.length + ' frames, p95 ' + p95.toFixed(1) + ' ms');
      assert.ok(p95 <= 20, 'p95 frame time ' + p95.toFixed(1) + ' ms <= 20 ms');

      // The top bar and the home island's label.
      await page.locator('.fk-list').click();
      await page.locator('.fp-back').click();
      assert.deepEqual(await page.evaluate(() => window.harness.calls.filter((x) => x[0] === 'list' || x[0] === 'back').map((x) => x[0])), ['list', 'back']);
      assert.deepEqual(errors, []);
      await ctx.close();
    });
  }
}

test('reduced motion: a move lands at once; nothing judged: no home island; a new area found', async () => {
  const { ctx, page, errors } = await open({ reduce: true }, 'won=10&reveal=2&focus=10');
  await drawn(page);
  const mapB = await box(page, '.fk-map');
  assert.ok(Math.abs(mid(await box(page, '[data-n="11"]')).x - (mapB.x + mapB.width / 2)) < 3, 'a new area found opens on its first level, not on the level that found it');
  await page.locator('.fk-map').focus();
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Home'); await sleep(50);
  assert.ok(Math.abs(mid(await box(page, '[data-n="11"]')).x - (mapB.x + mapB.width / 2)) < 3, 'Home lands at once');
  assert.equal(await page.locator('.fk-cloud p').textContent(), 'Under cloud: See. Win level 15 to find it.');
  await page.waitForFunction(() => document.querySelector('.fk-live').textContent === 'A new area: Set.');
  assert.ok(await page.locator('.fk-home').count() === 1);
  await shot(page, 'kingdom-reveal-390');
  // update(): a new theme and a won level redraw the kingdom where it is, the focus on the node it was on.
  await page.locator('[data-n="11"]').focus();
  await page.evaluate(() => { const h = window.harness, s = h.saga; h.k.update({ theme: 'dark', saga: Object.assign({}, s, { stars: s.stars.concat(2), time: s.time.concat(0), built: s.built.concat(null) }) }); });
  assert.equal(await page.locator('.fk').getAttribute('data-theme'), 'dark');
  assert.equal(await page.locator('[data-n="11"]').getAttribute('aria-label'), 'Level 11, Set, 2 of 3 stars. Built: a plain house.');
  assert.equal(await page.locator('.fk-play').textContent(), 'Play level 12');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.n), '11', 'a theme change keeps the focus on its node');
  // On the home label too; and with the focus panned out of view, the view stays where the person left it.
  await page.locator('.fk-homel').focus();
  for (let k = 0; k < 12; k++) await page.keyboard.press('ArrowUp');
  await sleep(60);
  const v0 = await view(page);
  await page.evaluate(() => window.harness.k.update({ theme: 'light' }));
  await sleep(60);
  assert.ok(await page.evaluate(() => document.activeElement.classList.contains('fk-homel')), 'a theme change keeps the focus on Your ground');
  assert.deepEqual(await view(page), v0, 'and does not move the view');
  await drawn(page);
  assert.deepEqual(errors, []);
  await ctx.close();

  const e = await open({}, 'empty=1&won=0');
  await e.page.waitForFunction(() => document.querySelector('.fk-isle.is-drawn'));
  await sleep(300);
  assert.equal(await e.page.locator('.fk-home').count(), 0, 'no home island until something is judged');
  assert.equal(await e.page.locator('.fk-play').textContent(), 'Play level 1');
  assert.equal(await e.page.locator('[data-n="1"]').getAttribute('aria-label'), 'Level 1, Sort, Next.');
  await shot(e.page, 'kingdom-empty-390');
  assert.deepEqual(e.errors, []);
  await e.ctx.close();
});

test('a short map (a phone on its side, under the app bar and the tab bar): the next level opens in full above the foot', async () => {
  for (const [w, h] of [[568, 200], [844, 220]]) {
    for (const q of ['', 'focus=3']) {
      const { ctx, page, errors } = await open({ w, h, touch: true }, q);
      const mapH = (await box(page, '.fk-map')).height;
      assert.ok(mapH < 140, 'the map is short: ' + mapH);
      const sel = q ? '[data-n="3"]' : '.fk-node.is-next button';
      await sleep(60);
      assert.equal(await clear(page, sel), '', 'it opens in full at ' + w + 'x' + h + (q ? ', ' + q : ''));
      if (!q) {   // Home finds it there again, after a pan away
        await page.locator('.fk-map').focus();
        for (let k = 0; k < 3; k++) await page.keyboard.press('ArrowRight');
        await page.keyboard.press('Home'); await settle(page);
        assert.equal(await clear(page, sel), '', 'Home finds it in full at ' + w + 'x' + h);
      }
      assert.deepEqual(errors, []);
      await ctx.close();
    }
  }
});

test('Tab pans to what it focuses, Your ground too: 3, 8 and 30 won, at the opening zoom, at 1.5 and just after a zoom', async () => {
  for (const won of [3, 8, 30]) {
    const { ctx, page, errors } = await open({ reduce: true }, 'won=' + won);
    for (const how of ['0.675', '1.5', 'zoomed out and focused before a frame draws it']) {
      await page.locator('.fk-map').focus();
      await page.keyboard.press('Home');
      if (how === '1.5') for (let k = 0; k < 4; k++) await page.keyboard.press('Equal');
      await sleep(60);
      const at = ', ' + won + ' won, zoom ' + how;
      if (how.length < 6) assert.ok(Math.abs((await zoom(page)) - +how) < 0.001, 'zoom' + at);
      if (how.length < 6) await page.keyboard.press('Tab');
      else await page.evaluate(() => { const m = document.querySelector('.fk-map'); for (let k = 0; k < 2; k++) m.dispatchEvent(new KeyboardEvent('keydown', { key: '-', bubbles: true })); m.querySelector('.fk-homel').focus(); });
      await sleep(60);
      assert.ok(await page.evaluate(() => document.activeElement.classList.contains('fk-homel')), 'Tab from the map lands on Your ground' + at);
      assert.equal(await clear(page, '.fk-homel'), '', 'Your ground in view' + at);
      await page.keyboard.press('Tab'); await sleep(60);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.n), '1');
      assert.equal(await clear(page, '[data-n="1"]'), '', 'level 1 in view' + at);
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});

test('touch on the foot: a pinch with a finger on Play or Zoom zooms, a drag from Play pans, a tap still works; three fingers, one lifts: no jump', async () => {
  const { ctx, page, cdp, errors } = await open({ touch: true, reduce: true });
  const T = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
  const home = async () => {   // zoom 0.5, on the next level
    await page.locator('.fk-map').focus();
    for (let k = 0; k < 6; k++) await page.keyboard.press('Minus');
    await page.keyboard.press('Home'); await sleep(60);
  };
  for (const sel of ['.fk-zi', '.fk-play']) {
    await home();
    const p = mid(await box(page, sel)), f = { x: p.x - 120, y: p.y - 140 }, z0 = await zoom(page);
    await T('touchStart', [{ ...f, id: 1 }]);
    await T('touchStart', [{ ...f, id: 1 }, { ...p, id: 2 }]);
    for (let k = 1; k <= 6; k++) await T('touchMove', [{ x: f.x - 8 * k, y: f.y - 8 * k, id: 1 }, { x: p.x + 4 * k, y: p.y + 4 * k, id: 2 }]);
    await T('touchEnd', []);
    await sleep(80);
    const r = (await zoom(page)) / z0;
    assert.ok(r > 1.3, 'a pinch with one finger on ' + sel + ' zooms: x' + r.toFixed(3));
  }
  assert.deepEqual(await calls(page, 'level'), [], 'a pinch opens no level');
  // A tap on Zoom in or Play still works.
  await home();
  const z1 = await zoom(page);
  await page.locator('.fk-zi').tap(); await sleep(60);
  assert.ok(Math.abs((await zoom(page)) / z1 - 1.25) < 0.01, 'a tap on Zoom in zooms in');
  await page.locator('.fk-play').tap();
  assert.deepEqual(await calls(page, 'level'), [9]);
  // A drag that starts on Play pans the map and opens nothing.
  const p = mid(await box(page, '.fk-play')), v0 = await view(page);
  await T('touchStart', [p]);
  for (let k = 1; k <= 5; k++) await T('touchMove', [{ x: p.x, y: p.y - 12 * k }]);
  await T('touchEnd', []);
  await sleep(80);
  const v1 = await view(page);
  assert.ok(Math.abs(v1[1] - v0[1] + 60) < 2 && Math.abs(v1[0] - v0[0]) < 1, 'a drag from Play pans with the finger: ' + v0 + ' to ' + v1);
  assert.deepEqual(await calls(page, 'level'), [9], 'a drag from Play opens nothing');
  // Three fingers on the map, one lifts: the pinch goes on from the two left, so a 1 px move barely moves the view.
  await home();
  const c = mid(await box(page, '.fk-map')), f1 = { x: c.x - 60, y: c.y - 100, id: 1 }, f2 = { x: c.x + 60, y: c.y - 100, id: 2 }, f3 = { x: c.x, y: c.y + 20, id: 3 };
  await T('touchStart', [f1]);
  await T('touchStart', [f1, f2]);
  await T('touchStart', [f1, f2, f3]);
  await T('touchEnd', [f1]);   // finger 1 lifts (CDP releases the points named)
  await sleep(40);
  const d1 = await view(page);
  await T('touchMove', [{ ...f2, x: f2.x + 1 }, f3]);
  await sleep(60);
  const d2 = await view(page);
  await T('touchEnd', []);
  assert.ok(Math.abs(d2[2] / d1[2] - 1) < 0.01 && Math.abs(d2[0] - d1[0]) < 4 && Math.abs(d2[1] - d1[1]) < 4, 'one finger of three lifts, then a 1 px move: ' + d1 + ' to ' + d2);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test('the title reads in full at 320 px, the top bar no taller; one line at 375 and 390', async () => {
  for (const w of [320, 375, 390]) {
    const { ctx, page, errors } = await open({ w, h: 640, touch: true });
    await page.evaluate(() => document.fonts.ready);
    const t = await page.evaluate(() => { const t = document.querySelector('.fk .fp-title'); return { sw: t.scrollWidth, cw: t.clientWidth, h: t.getBoundingClientRect().height, top: document.querySelector('.fk .fp-top').getBoundingClientRect().height, unbounded: [...document.fonts].some((f) => /Unbounded/.test(f.family) && f.status === 'loaded') }; });
    console.log('# the title at ' + w + ': ' + JSON.stringify(t));
    assert.ok(t.sw <= t.cw, 'the title is not cut at ' + w + ': ' + t.sw + ' px in ' + t.cw);
    assert.equal(t.top, 56, 'the top bar stays 56 px at ' + w);
    if (w >= 375) assert.ok(t.h < 25, 'one line at ' + w + ': ' + t.h);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
});
