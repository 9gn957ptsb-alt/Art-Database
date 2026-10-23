#!/usr/bin/env node
/* embed.smoke.cjs: the Motion Lab mounted inside another page with MotionLab.mount (test/embed.html).
 *
 *   node 5s/motion/test/embed.smoke.cjs [--shots DIR] [--no-build]
 *
 * Builds dist/ (python3 build.py), serves it with test/embed.html beside it on a free port in 8975-8979
 * ($EMBED_PORT overrides). The host page styles the lab's class names, its body and its buttons on purpose,
 * and runs its own hash router and document click handler. Checks, at 1440 x 900 light and dark and 390 x 844:
 *   - the lab looks as on its own page: the chrome's computed styles match dev.html's (and screenshots of both)
 *   - the host is unaffected: its .top, .brand and .mode keep their styles, its hash, router and click handler work
 *   - the lab works inside: its views switch without touching the host's hash, the stage draws, its keys work
 *     only while focus is inside it, the chrome follows the page's data-theme
 *   - the lab adds no document- or window-level click, input, change, keydown, pointerup or hashchange listener
 *   - picks and favorites save to the db it was given (motion/picks), or through claude.use('db') without one;
 *     the db's duplicate favorites read as one pool
 *   - unmount stops every clock and db listener, still writes a change that was waiting, leaves the host
 *     empty; mounting again works
 * Screenshots go to --shots (default $TMPDIR/5s-motion-embed-shots). Exits 1 when anything fails.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawnSync } = require('child_process');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const MOTION = path.resolve(__dirname, '..');
const DIST = path.join(MOTION, 'dist');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHOTS = path.resolve(opt('--shots', path.join(os.tmpdir(), '5s-motion-embed-shots')));
const FAVORITES = require('./favorites.json').favorites;

let failures = 0, passes = 0;
function ok(cond, name, detail) {
  if (cond) { passes++; console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : '')); }
  else { failures++; console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : '')); }
  return !!cond;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}
async function pickPort() {
  if (process.env.EMBED_PORT) return parseInt(process.env.EMBED_PORT, 10);
  for (let p = 8975; p <= 8979; p++) if (await portFree(p)) return p;
  throw new Error('no free port in 8975-8979 (set EMBED_PORT)');
}
// dist/ at the root, with test/embed.html beside it
function serve(port) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.webp': 'image/webp', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'embed.html';
    const file = name === 'embed.html' ? path.join(__dirname, 'embed.html') : path.join(DIST, path.normalize(name));
    if (!file.startsWith(DIST) && name !== 'embed.html') { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, body) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
      res.end(body);
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server)));
}

// the artist's 15 favorites as the db held them: under the moments they were starred on, each moment's
// list saved again in the db's own key order (reversed here), so the lab must read 26 as one pool of 15
function storedFavorites() {
  const stars = {};
  const rev = (o) => Object.keys(o).reverse().reduce((x, k) => { x[k] = o[k]; return x; }, {});
  for (const f of FAVORITES) { const { found, ...v } = f; (stars[found] = stars[found] || []).push(v); }
  for (const m of Object.keys(stars)) stars[m] = stars[m].concat(stars[m].slice(0, 6).map((v) => Object.assign(rev(v), { params: rev(v.params) })));
  return { picks: {}, stars, v: 1 };
}

// before the page: record document/window listeners once __watch is set, count animation frames run,
// and make fake dbs (one handed to mount, one behind window.claude)
const INIT = (seedClaudeDoc) => `(() => {
  const added = window.__added = [];
  const add = EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, o) {
    if (window.__watch && (this === document || this === window)) added.push((this === document ? 'document:' : 'window:') + type);
    return add.call(this, type, fn, o);
  };
  window.__rafRuns = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf((t) => { window.__rafRuns++; cb(t); });
  const makeDb = (seed) => {
    const fake = { writes: [], docs: {}, listening: 0 };
    if (seed) fake.docs['motion/picks'] = seed;
    const subs = {};
    const snap = (p) => ({ id: 'picks', exists: !!fake.docs[p], data: () => JSON.parse(JSON.stringify(fake.docs[p])), metadata: { hasPendingWrites: false } });
    fake.db = { doc: (p) => ({
      path: p,
      set: async (d) => { fake.writes.push({ path: p, data: JSON.parse(JSON.stringify(d)) }); fake.docs[p] = JSON.parse(JSON.stringify(d)); setTimeout(() => (subs[p] || []).forEach((f) => f(snap(p))), 10); },
      onSnapshot(next) { (subs[p] = subs[p] || []).push(next); fake.listening++; setTimeout(() => next(snap(p)), 30); let on = true; return () => { if (on) { on = false; fake.listening--; subs[p] = subs[p].filter((f) => f !== next); } }; }
    }) };
    return fake;
  };
  window.__given = makeDb(null);
  window.__claudeDb = makeDb(${JSON.stringify(seedClaudeDoc || null)});
  window.claude = { use: async (n) => (n === 'db' ? window.__claudeDb.db : null) };
})();`;

const SHADOW = "document.querySelector('#motion-host').shadowRoot";
const inShadow = (page, fn, arg) => page.evaluate(`(${fn})(${SHADOW}, ${JSON.stringify(arg === undefined ? null : arg)})`);
const click = (page, sel) => page.locator('#motion-host').locator(sel).first().click();
const INK = (root, sel) => {
  const c = root.querySelector(sel);
  if (!c || !c.width) return 0;
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let ink = 0, n = 0;
  const step = Math.max(1, Math.floor((c.width * c.height) / 40000));
  for (let i = 0; i < d.length; i += 4 * step) { n++; if (Math.abs(d[i] - d[0]) + Math.abs(d[i + 1] - d[1]) + Math.abs(d[i + 2] - d[2]) > 36) ink++; }
  return ink / n;
};
// the computed styles that show "looks as on its own page" (no heights that follow the host's size)
const PROPS = ['display', 'font-family', 'font-size', 'font-style', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'color', 'background-color', 'padding-left', 'padding-top', 'border-top-width', 'border-top-style', 'border-radius', 'width'];
const STYLE_OF = (root, a) => a.sels.map((sel) => {
  const el = root.querySelector(sel);
  if (!el) return sel + ': missing';
  const cs = getComputedStyle(el);
  return sel + ' ' + a.props.map((p) => p + '=' + cs.getPropertyValue(p)).join(' ') + (/^\.(top|mode|play|brand)$/.test(sel) ? ' height=' + cs.height : '');
});
const SELS = {
  moments: ['.top', '.brand', '.brand-word', '.mode', '.mode[aria-current]', '.rail', '.mo', '.mo-name', '.panel', '.play', '.seg button', '.btn-primary', '.h1', '.select'],
  explore: ['.sheet', '.cell', '.cell-load', '.cell-name', '.cell-star', '.wild'],
  foryou: ['.trends', '.fy-read', '.chip', '.fy-h', '.cell-why']
};

async function newContext(browser, o) {
  const ctx = await browser.newContext({ viewport: o.viewport || { width: 1440, height: 900 }, colorScheme: o.scheme || 'light', deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(INIT(o.claudeDoc));
  return ctx;
}
async function openHost(ctx, base, errs) {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(base + '/embed.html');
  await page.waitForFunction(() => window.MotionLab && typeof MotionLab.mount === 'function');
  return page;
}
async function mount(page, withDb) {
  await page.evaluate((give) => { window.__watch = true; MotionLab.mount(document.getElementById('motion-host'), give ? { embedded: true, db: window.__given.db } : { embedded: true }); }, withDb);
  await page.waitForFunction(() => { const r = document.querySelector('#motion-host').shadowRoot; return r && r.querySelector('#family-select option'); });
  await page.waitForTimeout(300);
}
async function standaloneStyles(browser, base, view, viewport, scheme) {
  const ctx = await browser.newContext({ viewport, colorScheme: scheme, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  await page.goto(base + '/dev.html#' + view);
  await page.waitForFunction(() => window.MotionLab && document.querySelector('#family-select option'));
  await page.waitForTimeout(400);
  // the same selectors and properties, read from the document here and from the shadow root there
  const styles = await page.evaluate(`(${STYLE_OF})(document, ${JSON.stringify({ sels: SELS[view], props: PROPS })})`);
  await page.screenshot({ path: path.join(SHOTS, 'standalone-' + viewport.width + '-' + scheme + '-' + view + '.png') });
  await ctx.close();
  return styles;
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!args.includes('--no-build')) {
    const r = spawnSync('python3', [path.join(MOTION, 'build.py')], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
  }
  const port = await pickPort();
  const server = await serve(port);
  const base = 'http://127.0.0.1:' + port;
  const browser = await chromium.launch();
  try {
    for (const scheme of ['light', 'dark']) {
      console.log('\n1440 x 900, ' + scheme + ': mounted with a db');
      const errs = [];
      const ctx = await newContext(browser, { scheme });
      const page = await openHost(ctx, base, errs);
      const hostBefore = await page.evaluate(() => ({ top: getComputedStyle(document.querySelector('.top')).backgroundColor, brand: getComputedStyle(document.querySelector('.brand')).fontSize, body: getComputedStyle(document.body).fontFamily, hash: location.hash }));
      await mount(page, true);
      ok(await inShadow(page, (r) => !!r.querySelector('.lab') && r.querySelectorAll('#family-select option').length === Motion.families.length), scheme + ': the lab renders in a shadow root on the host, every family in its select');

      // looks as on its own page
      for (const view of ['moments', 'explore', 'foryou']) {
        if (view !== 'moments') await click(page, '.mode[data-mode="' + view + '"]');
        await page.waitForTimeout(500);
        const here = await page.evaluate(`(${STYLE_OF})(${SHADOW}, ${JSON.stringify({ sels: SELS[view], props: PROPS })})`);
        const there = await standaloneStyles(browser, base, view, { width: 1440, height: 900 }, scheme);
        const diff = here.filter((s, i) => s !== there[i]);
        ok(diff.length === 0, scheme + ': ' + view + ' has the same computed styles as the lab on its own page', diff.slice(0, 2).join(' || ') + (diff.length ? ' vs ' + there[here.indexOf(diff[0])] : ''));
        await page.screenshot({ path: path.join(SHOTS, 'embed-1440-' + scheme + '-' + view + '.png') });
      }
      ok((await page.evaluate(() => location.hash)) === hostBefore.hash, scheme + ': moving between the lab\'s views leaves the host\'s hash alone', JSON.stringify(await page.evaluate(() => location.hash)));
      ok((await page.evaluate(() => MotionLab.ui.view)) === 'foryou', scheme + ': the lab routes its views inside');

      // the host is unaffected
      const hostAfter = await page.evaluate(() => ({ top: getComputedStyle(document.querySelector('.top')).backgroundColor, brand: getComputedStyle(document.querySelector('.brand')).fontSize, body: getComputedStyle(document.body).fontFamily }));
      ok(hostAfter.top === hostBefore.top && hostAfter.brand === hostBefore.brand && hostAfter.body === hostBefore.body, scheme + ': the host keeps its own .top, .brand and body styles', JSON.stringify(hostAfter));
      const labTop = await inShadow(page, (r) => getComputedStyle(r.querySelector('.top')).backgroundColor);
      ok(labTop !== hostAfter.top, scheme + ': and the host\'s styles do not reach the lab', labTop);
      const clicks0 = await page.evaluate(() => window.hostClicks);
      await page.click('header.top a.mode[href="#lab"]');
      await page.waitForTimeout(100);
      ok((await page.evaluate(() => location.hash)) === '#lab' && (await page.textContent('#route')) === '#lab', scheme + ': the host\'s own router still works');
      ok((await page.evaluate(() => MotionLab.ui.view)) === 'foryou', scheme + ': and the host\'s hash does not move the lab');
      ok((await page.evaluate(() => window.hostClicks)) > clicks0, scheme + ': the host\'s document click handler still hears clicks');
      const listeners = await page.evaluate(() => window.__added.filter((x) => /:(click|input|change|keydown|keyup|pointerup|hashchange)$/.test(x)));
      ok(listeners.length === 0, scheme + ': the lab adds no document or window listeners for clicks, input or keys', listeners.join(' '));

      // keys only while focus is inside
      await click(page, '.mode[data-mode="moments"]');
      await page.waitForTimeout(200);
      await page.locator('#motion-host').locator('#stage-canvas').click();
      const p0 = await page.evaluate(() => MotionLab.stage.playing);
      await page.keyboard.press('Space');
      await page.waitForTimeout(80);
      const p1 = await page.evaluate(() => MotionLab.stage.playing);
      ok(p1 === !p0, scheme + ': with focus inside, Space plays or pauses the stage');
      await page.keyboard.press(']');
      await page.waitForTimeout(150);
      ok((await page.evaluate(() => MotionLab.stage.t)) === 1, scheme + ': ] jumps to the end');
      const ink = await page.evaluate(`(${INK})(${SHADOW}, '#stage-canvas')`);
      ok(ink > 0.02, scheme + ': the stage draws the finished mark', 'ink ' + ink.toFixed(3));
      await page.click('#route');
      await page.keyboard.press('Space');
      await page.waitForTimeout(80);
      ok((await page.evaluate(() => MotionLab.stage.playing)) === p1, scheme + ': with focus on the host, the lab ignores its keys');

      // picks and favorites go to the db it was given
      await click(page, '#pick-btn');
      await click(page, '[data-act="star-stage"]');
      await page.waitForTimeout(1300);
      const w = await page.evaluate(() => window.__given.writes);
      const last = w[w.length - 1];
      const moment = await page.evaluate(() => MotionLab.ui.moment);
      ok(last && last.path === 'motion/picks' && last.data.picks[moment] && Object.values(last.data.stars).flat().length === 1, scheme + ': a pick and a favorite save to motion/picks in the given db', w.length + ' write(s)');
      ok((await page.evaluate(() => window.__claudeDb.writes.length)) === 0, scheme + ': and nothing to the page\'s own db');

      // the chrome follows the page's theme
      const other = scheme === 'light' ? 'dark' : 'light';
      await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), other);
      await page.waitForTimeout(100);
      const bg = await page.evaluate(() => getComputedStyle(document.querySelector('#motion-host')).backgroundColor);
      ok(bg === (other === 'dark' ? 'rgb(16, 14, 24)' : 'rgb(250, 249, 252)'), scheme + ': the lab\'s colours follow the page\'s data-theme', bg);
      await page.evaluate(() => document.documentElement.removeAttribute('data-theme'));

      // unmount: a waiting change is still written, then nothing runs
      await click(page, '[data-act="star-stage"]');
      const before = await page.evaluate(() => window.__given.writes.length);
      await page.evaluate(() => MotionLab.unmount());
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => ({ writes: window.__given.writes.length, stars: Object.values(window.__given.docs['motion/picks'].stars).flat().length, listening: window.__given.listening, children: document.querySelector('#motion-host').shadowRoot.childNodes.length, running: MotionLab.running }));
      ok(after.writes === before + 1 && after.stars === 0, scheme + ': unmount still writes the change that was waiting', JSON.stringify(after));
      ok(after.listening === 0 && after.children === 0 && !after.running, scheme + ': unmount stops listening to the db and empties the host');
      const r0 = await page.evaluate(() => window.__rafRuns);
      await page.mouse.click(700, 500);
      await page.keyboard.press('Space');
      await sleep(600);
      const r1 = await page.evaluate(() => window.__rafRuns);
      ok(r1 === r0, scheme + ': after unmount no animation frame runs', r0 + ' -> ' + r1);
      ok(errs.length === 0, scheme + ': no console errors', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    console.log('\nmounted without a db: claude.use(\'db\'), holding the artist\'s favorites with duplicates');
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const errs = [];
      const ctx = await newContext(browser, { viewport: { width: w, height: h }, claudeDoc: storedFavorites() });
      const page = await openHost(ctx, base, errs);
      await mount(page, false);
      await page.waitForTimeout(300);
      ok((await page.evaluate(() => MotionLab.pool.length)) === FAVORITES.length, w + ': the page\'s db is read and its favorites are one pool of ' + FAVORITES.length);
      await click(page, '.mode[data-mode="foryou"]');
      await page.waitForTimeout(900);
      ok(/15 favorites/.test(await inShadow(page, (r) => r.querySelector('#trends').textContent)), w + ': For you reads them');
      ok((await page.evaluate(() => { const h = document.querySelector('#motion-host'); return document.documentElement.scrollWidth <= innerWidth && h.scrollWidth <= h.clientWidth; })), w + ': no horizontal scroll, in the lab or on the host page');
      await page.screenshot({ path: path.join(SHOTS, 'embed-' + w + '-foryou-favorites.png') });
      await click(page, '.mode[data-mode="moments"]');
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(SHOTS, 'embed-' + w + '-moments.png') });
      // mount again after unmount
      await page.evaluate(() => MotionLab.unmount());
      await mount(page, false);
      ok(await inShadow(page, (r) => !!r.querySelector('#stage-canvas')), w + ': it mounts again after unmount');
      await page.evaluate(() => MotionLab.unmount());
      ok((await page.evaluate(() => window.__claudeDb.listening)) === 0, w + ': and unmounts again cleanly');
      ok(errs.length === 0, w + ': no console errors', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.close();
  }
  console.log('\n' + passes + ' passed, ' + failures + ' failed. Screenshots: ' + SHOTS);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
