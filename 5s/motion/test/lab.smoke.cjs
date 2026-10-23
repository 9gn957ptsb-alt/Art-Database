#!/usr/bin/env node
/* lab.smoke.cjs: Playwright smoke test for the 5s Motion Lab (5s/motion/index.html + lab.js + lab.css).
 *
 *   node 5s/motion/test/lab.smoke.cjs [--shots DIR] [--no-build] [--quick]
 *
 * Builds dist/ (python3 build.py), serves it on a free port in 8950-8959 ($LAB_PORT overrides), and checks,
 * at 1440 x 900 and 390 x 844 in light and dark:
 *   - no console errors or page errors; no horizontal scroll in any view
 *   - every registered family is selectable and draws on the stage
 *   - the scrubber changes the frame (frames are pure functions of t)
 *   - Generate gives 12 different variants; the same seed reproduces them; a variant loads into the stage
 *   - star; "Use for <moment>" with a note; Copy spec contains the pick; the Board shows it
 *   - a reload keeps the picks (localStorage path)
 *   - a faked window.claude: db receives motion/picks, a stored doc is adopted, read-only viewers are told;
 *     Save spec and Record go through downloads
 *   - Pause all stops the clock; under prefers-reduced-motion nothing plays until Play
 *   - keyboard: Space, Left/Right (one frame), [ and ]
 *   - For you, at both sizes and themes, with a faked db holding the artist's 15 favorites (test/favorites.json)
 *     saved twice in two key orders: one pool of 15, the reading, More like your favorites (only the favored
 *     families and Phases), Something different (none of them; the new families high), every cell draws;
 *     a star from For you joins the pool, the reading follows and the db gets it; a cell loads onto the stage;
 *     with no favorites, a starter sheet of twelve families; the Board's pool
 *   - the Iterations look (23 Oct 2026), at both sizes and themes: the stage starts in it on the sheet's white ground,
 *     the Look control and the twenty as a radiogroup (click, arrows), Classic takes the look away and back again;
 *     every family's rest pose in Explore sits on its look palette's ground; For you's "Your favorites in the
 *     Iterations look" (each favorite as starred beside its twin); a favorite toggled to Iterations and back is the
 *     same favorite and no saved favorite changes; a starred twin keeps the look
 * Screenshots go to --shots (default $TMPDIR/5s-motion-lab-shots). Exits 1 when anything fails.
 * Google Fonts requests are answered with an empty stylesheet (the sandbox has no route to them).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const MOTION = path.resolve(__dirname, '..');
const DIST = path.join(MOTION, 'dist');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const SHOTS = path.resolve(opt('--shots', path.join(os.tmpdir(), '5s-motion-lab-shots')));
const QUICK = args.includes('--quick');

let failures = 0, passes = 0;
function ok(cond, name, detail) {
  if (cond) { passes++; console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : '')); }
  else { failures++; console.log('  FAIL ' + name + (detail ? '  (' + detail + ')' : '')); }
  return !!cond;
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.once('listening', () => s.close(() => resolve(true)));
    s.listen(port, '127.0.0.1');
  });
}
async function pickPort() {
  if (process.env.LAB_PORT) return parseInt(process.env.LAB_PORT, 10);
  for (let p = 8950; p <= 8959; p++) if (await portFree(p)) return p;
  throw new Error('no free port in 8950-8959 (set LAB_PORT)');
}
function waitFor(url, ms) {
  const until = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const once = () => {
      const req = http.get(url, (res) => { res.resume(); if (res.statusCode === 200) resolve(); else retry(); });
      req.on('error', retry);
      req.setTimeout(500, () => req.destroy());
    };
    const retry = () => { if (Date.now() > until) reject(new Error('server did not start: ' + url)); else setTimeout(once, 100); };
    once();
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FAVORITES = require('./favorites.json').favorites;
const NEW_FAMILIES = ['stamp', 'dive', 'neon', 'tiles', 'swarm', 'cast'];
// the artist's 15 favorites as the db held them: under the moments they were starred on, each moment's
// list saved again in the db's own key order (reversed here), so the lab must read 26 as one pool of 15
function storedFavorites() {
  const stars = {};
  const rev = (o) => Object.keys(o).reverse().reduce((x, k) => { x[k] = o[k]; return x; }, {});
  for (const f of FAVORITES) { const { found, ...v } = f; (stars[found] = stars[found] || []).push(v); }
  for (const m of Object.keys(stars)) stars[m] = stars[m].concat(stars[m].slice(0, 6).map((v) => Object.assign(rev(v), { params: rev(v.params) })));
  return { picks: {}, stars, v: 1 };
}

// a fake window.claude (db + user + downloads) for the capability paths; state kept on window.__fake
function fakeClaude(o) {
  o = o || {};
  return `(() => {
    const seed = ${JSON.stringify(o.seedDoc || null)};
    const fake = window.__fake = { writes: [], saves: [], docs: {} };
    if (seed) fake.docs['motion/picks'] = seed;
    const listeners = {};
    const snap = (p) => ({ id: p.split('/').pop(), exists: !!fake.docs[p], data: () => fake.docs[p] ? JSON.parse(JSON.stringify(fake.docs[p])) : undefined, metadata: { fromCache: false, hasPendingWrites: false } });
    const db = Object.freeze({
      doc(p) {
        return {
          id: p.split('/').pop(), path: p,
          get: async () => snap(p),
          set: async (d) => { fake.writes.push({ path: p, data: JSON.parse(JSON.stringify(d)) }); fake.docs[p] = JSON.parse(JSON.stringify(d)); setTimeout(() => (listeners[p] || []).forEach((f) => f(snap(p))), 10); },
          update: async (d) => { fake.docs[p] = Object.assign({}, fake.docs[p], d); },
          delete: async () => { delete fake.docs[p]; },
          onSnapshot(next) { (listeners[p] = listeners[p] || []).push(next); setTimeout(() => next(snap(p)), 30); return () => {}; }
        };
      },
      collection() { throw new Error('not in the fake'); }
    });
    const user = Object.freeze({ can: async () => ${o.canWrite === false ? 'false' : 'true'}, id: async () => 'u_test', isOwner: async () => true, canEdit: async () => true, me: async () => ({ id: 'u_test', name: '', isOwner: true, canEdit: true }) });
    const downloads = Object.freeze({ save: async (r) => { const size = typeof r.data === 'string' ? r.data.length : (r.data && r.data.size) || 0; const text = typeof r.data === 'string' ? r.data : null; fake.saves.push({ filename: r.filename, size, text }); return { status: 'saved' }; } });
    window.claude = { use: (name) => new Promise((res) => setTimeout(() => res(name === 'db' ? db : name === 'user' ? user : name === 'downloads' ? downloads : null), 50)) };
  })();`;
}
// captures what Copy spec writes to the clipboard
const CLIPBOARD = `(() => { window.__clip = []; try { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.__clip.push(t); } } }); } catch (e) {} })();`;

// pixel summary of a canvas: ink = share of pixels unlike the corner one; hash of a sample grid
const CANVAS_INFO = (sel) => {
  const c = document.querySelector(sel);
  if (!c || !c.width) return { ink: 0, hash: 0 };
  const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
  const r0 = d[0], g0 = d[1], b0 = d[2];
  let ink = 0, n = 0, h = 2166136261;
  const step = Math.max(1, Math.floor((c.width * c.height) / 40000));
  for (let i = 0; i < d.length; i += 4 * step) {
    n++;
    if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 36) ink++;
    h = Math.imul(h ^ (d[i] + 7 * d[i + 1] + 13 * d[i + 2] + 17 * d[i + 3]), 16777619) >>> 0;
  }
  return { ink: ink / n, hash: h };
};

// the colour of a canvas's pixel (1, 1): the ground, where nothing is drawn over it
const PIX = (sel) => { const d = document.querySelector(sel).getContext('2d').getImageData(1, 1, 1, 1).data; return '#' + [d[0], d[1], d[2]].map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(); };
// params with their keys sorted (the db hands them back in another order)
const canon = (o) => JSON.stringify(Object.keys(o).sort().reduce((x, k) => { x[k] = o[k]; return x; }, {}));

async function newContext(browser, o) {
  const ctx = await browser.newContext({
    viewport: o.viewport || { width: 1440, height: 900 }, colorScheme: o.scheme || 'light',
    reducedMotion: o.reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1
  });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (o.claude) await ctx.addInitScript(fakeClaude(o.claude));
  await ctx.addInitScript(CLIPBOARD);
  return ctx;
}
async function open(ctx, base, hash, errs) {
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(base + '/dev.html' + (hash || ''));
  await page.waitForFunction(() => window.MotionLab && document.querySelector('#family-select option'));
  await page.waitForTimeout(250);
  return page;
}
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
const shot = (page, name, full) => page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: !!full });
const lab = (page, expr) => page.evaluate(expr);
async function pauseStage(page) { if (await lab(page, () => MotionLab.stage.playing)) await page.click('#t-play'); }
async function scrubTo(page, v) {
  await page.$eval('#t-scrub', (el, val) => { el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, v);
  await page.waitForTimeout(80);
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true });
  if (!args.includes('--no-build')) {
    const r = spawnSync('python3', [path.join(MOTION, 'build.py')], { encoding: 'utf8' });
    if (r.status !== 0) { console.error(r.stdout + r.stderr); process.exit(1); }
    console.log(r.stdout.trim().split('\n').slice(-1)[0]);
  }
  const port = await pickPort();
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', DIST], { stdio: 'ignore' });
  const stop = () => { try { server.kill(); } catch (e) { /* gone */ } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(130); });
  const base = 'http://127.0.0.1:' + port;
  let browser;
  try {
    await waitFor(base + '/dev.html', 8000);
    browser = await chromium.launch();

    /* ---------------------------------------------------------------- every size and theme */
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      for (const scheme of ['light', 'dark']) {
        const tag = w + '-' + scheme;
        console.log('\n' + w + ' x ' + h + ', ' + scheme);
        const errs = [];
        const ctx = await newContext(browser, { viewport: { width: w, height: h }, scheme });
        const page = await open(ctx, base, '#moments', errs);
        ok(await noHScroll(page), tag + ': no horizontal scroll on Moments');
        await shot(page, tag + '-moments', w < 800);
        await pauseStage(page);
        await page.evaluate(() => document.activeElement && document.activeElement.blur());
        await page.keyboard.press(']');
        await page.waitForTimeout(80);
        const info = await page.evaluate(CANVAS_INFO, '#stage-canvas');
        ok(info.ink > 0.02, tag + ': the stage draws the finished mark', 'ink ' + info.ink.toFixed(3));

        // the Iterations look: the stage starts in it, on the sheet's white ground; the twenty; Classic and back
        const sv = await lab(page, () => MotionLab.stage.variant);
        const dark = (await lab(page, () => MotionLab.ui.theme)) === 'dark';
        ok(sv.params.look === 'iterations' && sv.params.iteration === 1, tag + ': with nothing picked the stage is in the Iterations look, iteration 1');
        const white = dark ? '#100E18' : '#FEFEFE';
        ok((await page.evaluate(PIX, '#stage-canvas')) === white && (await page.$eval('#stage', (e) => getComputedStyle(e).backgroundColor)) === (dark ? 'rgb(16, 14, 24)' : 'rgb(254, 254, 254)'), tag + ': on the sheet\'s ground, the canvas and the stage around it', white);
        ok((await page.getAttribute('[data-act=look][data-value=iterations]', 'aria-pressed')) === 'true', tag + ': the Look control says Iterations');
        ok((await page.$$eval('.iters[role=radiogroup] .iter[role=radio]', (b) => b.length)) === 20 && (await page.getAttribute('.iter[aria-checked=true]', 'aria-label')) === 'Iteration 1: vivid cloth', tag + ': the picker holds the twenty as radios, the first checked');
        const thumbs = await page.$$eval('.iter canvas', (cs) => cs.map((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 16) if (d[i] + d[i + 1] + d[i + 2] < 600) n++; return n; }));
        ok(thumbs.every((n) => n > 100) && (await page.$eval('.iter', (b) => b.getBoundingClientRect().width)) >= 24, tag + ': each is a drawn thumbnail, a 24 px target or more');
        const hl = (await page.evaluate(CANVAS_INFO, '#stage-canvas')).hash;
        await page.click('.iter[data-value="7"]');
        await page.waitForTimeout(120);
        ok((await lab(page, () => MotionLab.stage.variant.params.iteration)) === 7 && (await page.getAttribute('.iter[data-value="7"]', 'aria-checked')) === 'true' && (await page.evaluate(CANVAS_INFO, '#stage-canvas')).hash !== hl, tag + ': a preset puts its iteration on the stage', await page.textContent('#o-iteration'));
        await page.keyboard.press('ArrowRight');
        await page.keyboard.press('ArrowDown');
        await page.waitForTimeout(80);
        ok((await lab(page, () => MotionLab.stage.variant.params.iteration)) === 13 && (await page.evaluate(() => document.activeElement.dataset.value)) === '13', tag + ': arrows move through the twenty (right one, down a row), focus following');
        await shot(page, tag + '-look', w < 800);
        await page.click('[data-act=look][data-value=classic]');
        await page.$eval('#stage', (e) => e.scrollIntoView({ block: 'center' }));   // a canvas out of sight is not redrawn
        await page.waitForTimeout(150);
        const cl = await lab(page, () => MotionLab.stage.variant.params);
        ok(!('look' in cl) && !('iteration' in cl) && !(await page.$('.iter')) && (await page.evaluate(PIX, '#stage-canvas')) === (dark ? '#100E18' : '#FAF9FC'), tag + ': Classic takes the look away (no look keys) and the classic ground comes back');
        await page.click('[data-act=look][data-value=iterations]');
        await page.waitForTimeout(120);
        ok((await lab(page, () => MotionLab.stage.variant.params.iteration)) === 13, tag + ': Iterations again comes back on the iteration it left');
        await page.click('#t-play');
        if (w < 800) {
          await page.selectOption('#moment-select', 'turn');
          await page.waitForTimeout(150);
          ok((await page.textContent('#stage-h')) === 'A turn', tag + ': the moment select changes the stage');
        } else {
          await page.click('.mo[data-moment="turn"]');
          await page.waitForTimeout(150);
          ok((await page.textContent('#stage-h')) === 'A turn', tag + ': the moments rail changes the stage');
        }
        await page.click('[data-act=app][data-value=app]');
        await page.waitForTimeout(250);
        ok(await noHScroll(page), tag + ': no horizontal scroll In the app');
        await shot(page, tag + '-in-the-app', w < 800);
        await page.click('[data-act=app][data-value=mark]');
        for (const view of ['explore', 'board']) {
          await page.click('.mode[data-mode="' + view + '"]');
          await page.waitForTimeout(500);
          ok(await noHScroll(page), tag + ': no horizontal scroll on ' + view);
          ok(await page.isVisible('#view-' + view + ' h1'), tag + ': ' + view + ' shows its heading');
          await shot(page, tag + '-' + view, w < 800);
        }
        ok(errs.length === 0, tag + ': no console errors', errs.slice(0, 3).join(' | '));
        await ctx.close();
        if (QUICK) break;
      }
    }

    /* ---------------------------------------------------------------- the working lab, 1440 light */
    console.log('\nthe lab at work (1440 light, no capabilities: the localStorage path)');
    {
      const errs = [];
      const ctx = await newContext(browser, {});
      const page = await open(ctx, base, '#moments', errs);

      // every registered family
      const fams = await lab(page, () => Motion.families.map((f) => f.id));
      const opts = await page.$$eval('#family-select option', (o) => o.map((x) => x.value));
      ok(fams.length >= 1 && fams.every((f) => opts.includes(f)) && opts.length === fams.length, 'every registered family is in the family select', fams.length + ' families: ' + fams.join(' '));
      await pauseStage(page);
      const hashes = new Set();
      const blank = [];
      for (const f of fams) {
        await page.selectOption('#family-select', f);
        await page.waitForTimeout(60);
        const cur = await lab(page, () => MotionLab.stage.variant.family);
        const inf = await page.evaluate(CANVAS_INFO, '#stage-canvas');
        if (cur !== f || inf.ink < 0.01) blank.push(f + (cur !== f ? ' (not selected)' : ' (blank)'));
        hashes.add(inf.hash);
      }
      ok(blank.length === 0, 'every family selects and draws its rest pose on the stage', blank.join(', '));
      ok(hashes.size >= Math.min(fams.length, 2), 'families draw different frames', hashes.size + ' distinct of ' + fams.length);

      // scrub
      await page.click('.mo[data-moment="launch"]');
      await pauseStage(page);
      await scrubTo(page, 150);
      const a = await page.evaluate(CANVAS_INFO, '#stage-canvas');
      const ta = await lab(page, () => MotionLab.stage.t);
      await scrubTo(page, 700);
      const b = await page.evaluate(CANVAS_INFO, '#stage-canvas');
      const tb = await lab(page, () => MotionLab.stage.t);
      ok(a.hash !== b.hash, 'the scrubber changes the frame', 't ' + ta.toFixed(3) + ' -> ' + tb.toFixed(3));
      ok(Math.abs(ta - 0.15) < 0.002 && Math.abs(tb - 0.7) < 0.002, 'the scrubber sets t exactly');
      await scrubTo(page, 150);
      ok((await page.evaluate(CANVAS_INFO, '#stage-canvas')).hash === a.hash, 'the same t draws the same frame');

      // keyboard
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      const before = await lab(page, () => MotionLab.stage.playing);
      await page.keyboard.press('Space');
      await page.waitForTimeout(60);
      ok((await lab(page, () => MotionLab.stage.playing)) === !before, 'Space plays and pauses the stage');
      await page.keyboard.press('Space');
      await page.waitForTimeout(60);
      await scrubTo(page, 500);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      const dur = await lab(page, () => MotionLab.stage.variant.params.duration);
      const t0 = await lab(page, () => MotionLab.stage.t);
      await page.keyboard.press('ArrowRight');
      const t1 = await lab(page, () => MotionLab.stage.t);
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowLeft');
      const t2 = await lab(page, () => MotionLab.stage.t);
      const fr = 1000 / 60 / dur;
      ok(Math.abs(t1 - t0 - fr) < 1e-6 && Math.abs(t0 - t2 - fr) < 1e-6, 'Right and Left step one frame', 'frame = ' + fr.toFixed(4) + ' of t');
      await page.keyboard.press(']');
      ok(Math.abs((await lab(page, () => MotionLab.stage.t)) - 1) < 1e-9, '] jumps to the end');
      await page.keyboard.press('[');
      ok((await lab(page, () => MotionLab.stage.t)) < 1e-9, '[ jumps to the start');
      await page.focus('#t-scrub');
      await page.keyboard.press('ArrowRight');
      ok(Math.abs((await lab(page, () => MotionLab.stage.t)) - fr) < 1e-6, 'arrows on the scrubber step one frame');

      // reduced motion toggle on the stage
      await page.click('#t-reduced');
      await page.waitForTimeout(80);
      ok(await page.isVisible('#stage-note') && /Reduced motion/.test(await page.textContent('#stage-note')), 'the Reduced motion toggle says what plays instead', await page.textContent('#stage-note'));
      ok(/Reduced motion/.test(await page.getAttribute('#stage-canvas', 'aria-label')), 'the stage canvas text says so too');
      await shot(page, 'lab-reduced-toggle');
      await page.click('#t-reduced');

      // explore: generate, reproduce, load, star
      await page.click('.mo[data-moment="turn"]');
      await page.click('.mode[data-mode="explore"]');
      await page.waitForTimeout(300);
      await page.click('[data-act="generate"]');
      await page.waitForTimeout(500);
      const sheet1 = await lab(page, () => MotionLab.sheet);
      const seed1 = await page.inputValue('#batch-seed');
      const key = (v) => v.family + JSON.stringify(v.params) + v.direction;
      ok(sheet1.length === 12, 'Generate gives 12 variants', 'seed ' + seed1);
      ok(new Set(sheet1.map(key)).size === 12, 'the 12 are all different (family and params, seed aside)');
      const cells = await page.$$eval('#sheet .cell', (c) => c.length);
      ok(cells === 12, 'the contact sheet shows 12');
      const inks = [];
      // a frame can be one colour mid-gesture (Dive inside the bowl), so a blank cell is looked at again
      for (let i = 1; i <= 12; i++) {
        let ink = 0;
        for (let k = 0; k < 5 && ink <= 0.01; k++) { if (k) await page.waitForTimeout(250); ink = (await page.evaluate(CANVAS_INFO, '#sheet .cell:nth-child(' + i + ') canvas')).ink; }
        inks.push(ink);
      }
      ok(inks.every((x) => x > 0.01), 'every variant in the sheet draws', inks.map((x) => x.toFixed(2)).join(' '));
      ok(sheet1.filter((v) => v.wild).length === 3 || (await lab(page, () => Motion.forMoment('turn').length)) === 0, 'three of them are wildcards', sheet1.filter((v) => v.wild).map((v) => v.family).join(' '));
      await shot(page, 'lab-explore-turn');
      await page.click('[data-act="generate"]');
      await page.waitForTimeout(300);
      const sheet2 = await lab(page, () => MotionLab.sheet);
      ok(sheet2.map(key).join() !== sheet1.map(key).join(), 'Generate again gives a new twelve', 'seed ' + (await page.inputValue('#batch-seed')));
      await page.fill('#batch-seed', seed1);
      await page.press('#batch-seed', 'Enter');
      await page.waitForTimeout(300);
      const sheet3 = await lab(page, () => MotionLab.sheet);
      ok(sheet3.map(key).join() === sheet1.map(key).join() && sheet3.map((v) => v.seed).join() === sheet1.map((v) => v.seed).join(), 'the same seed reproduces the same twelve');
      await page.fill('#batch-seed', sheet1[6].seed);
      await page.press('#batch-seed', 'Enter');
      await page.waitForTimeout(250);
      const found = await page.$eval('#sheet .cell:nth-child(7)', (e) => e.classList.contains('found'));
      const again = await lab(page, () => MotionLab.sheet[6]);
      ok(found && key(again) === key(sheet1[6]) && again.seed === sheet1[6].seed, "a variant's own seed brings it back, marked in the sheet", sheet1[6].seed);
      const c4 = await page.evaluate(CANVAS_INFO, '#sheet .cell:nth-child(4) canvas');
      ok(c4.ink > 0.01, 'a reproduced variant draws');
      // star the 2nd
      await page.click('#sheet .cell:nth-child(2) .cell-star');
      ok((await page.getAttribute('#sheet .cell:nth-child(2) .cell-star', 'aria-pressed')) === 'true', 'a variant can be starred');
      ok((await lab(page, () => (MotionLab.data.stars.turn || []).length)) === 1, 'the star is kept for the moment');
      await page.click('[data-act="source"][data-value="starred"]');
      await page.waitForTimeout(200);
      ok((await page.$$eval('#sheet .cell', (c) => c.length)) === 1, 'Starred shows the starred variant');
      await page.click('[data-act="source"][data-value="all"]');
      await page.waitForTimeout(300);
      const famCount = await lab(page, () => Motion.families.length);
      ok((await page.$$eval('#sheet .cell', (c) => c.length)) === famCount, 'All families shows one of every family', famCount + '');
      await page.fill('#batch-seed', seed1);
      await page.press('#batch-seed', 'Enter');
      await page.waitForTimeout(300);
      // load the 5th into the stage
      const v5 = sheet1[4];
      await page.click('#sheet .cell:nth-child(5) .cell-load');
      await page.waitForTimeout(250);
      const st = await lab(page, () => ({ view: MotionLab.ui.view, v: MotionLab.stage.variant }));
      ok(st.view === 'moments' && st.v.family === v5.family && st.v.seed === v5.seed && JSON.stringify(st.v.params) === JSON.stringify(v5.params), 'clicking a variant loads it into the stage', v5.family + ' ' + v5.seed);
      ok((await page.inputValue('#p-seed')) === v5.seed, 'the panel shows its seed');

      // pick with a note
      await page.fill('#pick-note', 'The turn, literally.');
      await page.click('#pick-btn');
      await page.waitForTimeout(150);
      const famName = await lab(page, () => Motion.get(MotionLab.stage.variant.family).name);
      ok((await page.textContent('#live')) === 'Picked ' + famName + ' for A turn', 'Use for A turn announces the pick', await page.textContent('#live'));
      const pick = await lab(page, () => MotionLab.data.picks.turn);
      ok(pick && pick.family === v5.family && pick.note === 'The turn, literally.' && pick.seed === v5.seed && pick.style === v5.params.style, 'the pick keeps family, style, params, seed and the note');
      ok(/The turn, literally/.test(await page.textContent('#pick-status')), 'the stage says what is picked');
      ok(/turn|Flip|·/.test(await page.textContent('.mo[data-moment="turn"] .mo-pick')) && !(await page.$eval('.mo[data-moment="turn"] .mo-thumb', (e) => e.classList.contains('empty'))), 'the rail shows the pick as a live thumbnail');
      await page.waitForTimeout(200);
      let railInk = 0;   // looked at again when the frame is one colour mid-gesture (Dive inside the bowl)
      for (let k = 0; k < 6 && railInk <= 0.01; k++) { if (k) await page.waitForTimeout(250); railInk = (await page.evaluate(CANVAS_INFO, '.mo[data-moment="turn"] canvas')).ink; }
      ok(railInk > 0.01, 'the rail thumbnail draws', v5.family);
      await shot(page, 'lab-picked');

      // copy spec
      await page.click('.handback-top [data-act="copy"]');
      await page.waitForTimeout(100);
      const clip = await lab(page, () => window.__clip.slice(-1)[0]);
      let spec = null;
      try { spec = JSON.parse(clip); } catch (e) { /* not json */ }
      ok(spec && spec.format === '5s-motion' && spec.picks.turn && spec.picks.turn.family === v5.family && spec.picks.turn.note === 'The turn, literally.' && spec.picks.turn.params && spec.picks.turn.seed === v5.seed, 'Copy spec holds the pick (moment -> family, style, params, seed, note)');
      ok(/Copied the spec/.test(await page.textContent('#live')), 'Copy spec announces itself');

      // board
      await page.click('.mode[data-mode="board"]');
      await page.waitForTimeout(400);
      const cellIdx = await lab(page, () => Motion.MOMENTS.findIndex((m) => m.id === 'turn') + 1);
      const famTxt = await page.textContent('#board-grid .bcell:nth-child(' + cellIdx + ') .bcell-fam');
      ok(famTxt && famTxt.indexOf(famName) === 0, 'the Board shows the pick', famTxt);
      ok(/The turn, literally/.test(await page.textContent('#board-grid .bcell:nth-child(' + cellIdx + ')')), 'the Board shows the note');
      ok((await page.evaluate(CANVAS_INFO, '#board-grid .bcell:nth-child(' + cellIdx + ') canvas')).ink > 0.01, 'the picked cell plays the motion');
      await shot(page, 'lab-board');
      // the board's own play/pause
      await page.click('#board-play');
      ok((await lab(page, () => MotionLab.groups().board.playing)) === false, 'the Board has one Play/Pause for all');
      await page.click('#board-play');

      // pause all
      await page.click('.mode[data-mode="moments"]');
      await page.waitForTimeout(200);
      if (!(await lab(page, () => MotionLab.stage.playing))) await page.click('#t-play');
      await page.waitForTimeout(200);
      ok(await lab(page, () => MotionLab.running), 'the clock runs while something plays');
      await page.click('#pause-all');
      await page.waitForTimeout(250);
      const f1 = await lab(page, () => MotionLab.frames), h1 = (await page.evaluate(CANVAS_INFO, '#stage-canvas')).hash;
      await page.waitForTimeout(500);
      const f2 = await lab(page, () => MotionLab.frames), h2 = (await page.evaluate(CANVAS_INFO, '#stage-canvas')).hash;
      ok(!(await lab(page, () => MotionLab.running)) && f1 === f2 && h1 === h2, 'Pause all stops the clock', 'frames ' + f1 + ' -> ' + f2);
      ok((await page.textContent('#pause-all')).trim() === 'Play all', 'the button then reads Play all');
      await page.click('#pause-all');
      await page.waitForTimeout(150);
      ok(await lab(page, () => MotionLab.running), 'Play all starts it again');

      // offscreen and hidden canvases are not drawn: Explore's canvases are gone; the rail thumbnail of a moment scrolled out of view does not draw
      const d1 = await lab(page, () => MotionLab.draws);
      await page.waitForTimeout(300);
      const d2 = await lab(page, () => MotionLab.draws);
      const visible = await page.evaluate(() => Array.from(document.querySelectorAll('canvas')).filter((c) => { const r = c.getBoundingClientRect(); return r.width > 0 && r.bottom > 0 && r.top < innerHeight && c.__player; }).length);
      ok((d2 - d1) / Math.max(1, visible) < 25, 'only canvases on screen are drawn', (d2 - d1) + ' draws in 300 ms for ' + visible + ' visible canvases');

      // the app view
      await page.click('[data-act=app][data-value=app]');
      await page.waitForTimeout(200);
      ok(/Shown in the app/.test(await page.getAttribute('#stage-canvas', 'aria-label')), 'In the app describes the staging in text');
      await shot(page, 'lab-in-the-app-turn');
      await page.click('[data-act=app][data-value=mark]');

      // reload: the localStorage path keeps the picks
      await page.reload();
      await page.waitForFunction(() => window.MotionLab);
      await page.waitForTimeout(300);
      const kept = await lab(page, () => MotionLab.data.picks.turn);
      ok(kept && kept.family === v5.family && kept.note === 'The turn, literally.', 'a reload keeps the picks (localStorage)');
      ok((await lab(page, () => (MotionLab.data.stars.turn || []).length)) === 1, 'a reload keeps the stars');
      ok((await lab(page, () => MotionLab.ui.moment)) === 'turn' && /The turn, literally/.test(await page.textContent('#pick-status')), 'a reload returns to the moment and its pick');
      ok(/1 pick/.test(await page.textContent('#savestate')), 'the save state says where picks live', await page.textContent('#savestate'));

      // the copy fallback when the clipboard refuses
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => Promise.reject(new Error('no')) } }); });
      await page.click('.handback-top [data-act="copy"]');
      await page.waitForTimeout(150);
      ok(await page.isVisible('#copy-dialog') && /"picks"/.test(await page.inputValue('#copy-text')), 'when copying is refused, the spec opens selected in a dialog');
      await page.keyboard.press('Escape');
      ok(!(await page.isVisible('#copy-dialog')), 'Escape closes it');
      // hidden where unsupported: no downloads here
      ok(!(await page.isVisible('.handback-top [data-act="save-spec"]')) && !(await page.isVisible('.handback-top [data-act="record"]')), 'Save spec and Record are hidden without downloads');

      ok(errs.length === 0, 'no console errors while working', errs.slice(0, 3).join(' | '));
      await ctx.close();
    }

    /* ---------------------------------------------------------------- reduced motion */
    console.log('\nprefers-reduced-motion: reduce');
    {
      const errs = [];
      const ctx = await newContext(browser, { reduced: true });
      const page = await open(ctx, base, '#moments', errs);
      await page.waitForTimeout(600);
      const g = await lab(page, () => MotionLab.groups());
      ok(Object.keys(g).every((k) => !g[k].playing), 'nothing autoplays');
      ok(!(await lab(page, () => MotionLab.running)), 'the clock is stopped');
      ok((await page.evaluate(CANVAS_INFO, '#stage-canvas')).ink > 0.02, 'the stage shows the finished mark, still');
      ok((await page.getAttribute('#t-play', 'aria-label')) === 'Play', 'the stage offers Play');
      await page.click('.mode[data-mode="explore"]');
      await page.waitForTimeout(400);
      ok(!(await lab(page, () => MotionLab.running)), 'Explore autoplays nothing');
      // at rest, every family in the Iterations look sits on its look palette's ground (the sheet's white, paper's iris)
      await page.click('[data-act="source"][data-value="all"]');
      await page.waitForTimeout(300);
      const nAll = await page.$$eval('#sheet .cell', (c) => c.length), grounds = [];
      for (let i = 1; i <= nAll; i++) {
        const sel = '#sheet .cell:nth-child(' + i + ') canvas';
        await page.$eval(sel, (c) => c.scrollIntoView({ block: 'center' }));
        await page.waitForTimeout(60);
        const v = await lab(page, () => MotionLab.sheet);
        const want = await page.evaluate((x) => Marks.palette(x.params.palette, MotionLab.ui.theme, x.params.iteration).bg.toUpperCase(), v[i - 1]);
        const got = await page.evaluate(PIX, sel);
        if (v[i - 1].params.look !== 'iterations' || got !== want) grounds.push(v[i - 1].family + ' ' + got + ' vs ' + want);
      }
      ok(grounds.length === 0 && nAll > 0, 'All families: each in the Iterations look, at rest on its ground', grounds.slice(0, 4).join(', ') || nAll + ' families');
      await page.click('.mode[data-mode="board"]');
      await page.waitForTimeout(300);
      // the clock also runs while it paints the tiles' still frames the first time; on a busy machine that outlasts 300 ms
      await page.waitForFunction(() => !MotionLab.running, null, { timeout: 3000 }).catch(() => {});
      const gb = await lab(page, () => MotionLab.groups());
      ok(!(await lab(page, () => MotionLab.running)) && Object.keys(gb).every((k) => !gb[k].playing), 'the Board autoplays nothing');
      await shot(page, 'reduced-board');
      await page.click('.mode[data-mode="moments"]');
      await page.waitForTimeout(200);
      await page.click('#t-play');
      await page.waitForTimeout(150);
      ok(await lab(page, () => MotionLab.running && MotionLab.stage.playing), 'Play starts the stage');
      ok(errs.length === 0, 'no console errors', errs.join(' | '));
      await ctx.close();
    }

    /* ---------------------------------------------------------------- For you and the pool */
    console.log('\nFor you, with the artist\'s favorites stored twice over (a faked db)');
    // every cell of a list draws once it is on screen (looked at again when a frame is one colour mid-gesture)
    const cellsDraw = async (page, list, n) => {
      const blank = [];
      for (let i = 1; i <= n; i++) {
        const sel = list + ' .cell:nth-child(' + i + ') canvas';
        await page.$eval(sel, (c) => c.scrollIntoView({ block: 'center' }));
        let ink = 0;
        for (let k = 0; k < 6 && ink <= 0.01; k++) { await page.waitForTimeout(k ? 250 : 120); ink = (await page.evaluate(CANVAS_INFO, sel)).ink; }
        if (ink <= 0.01) blank.push(i);
      }
      return blank;
    };
    const favFams = new Set(FAVORITES.map((f) => f.family));
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      for (const scheme of ['light', 'dark']) {
        const tag = 'for-you-' + w + '-' + scheme;
        const errs = [];
        const ctx = await newContext(browser, { viewport: { width: w, height: h }, scheme, claude: { seedDoc: storedFavorites() } });
        const page = await open(ctx, base, '#foryou', errs);
        await page.waitForFunction(() => MotionLab.pool.length > 0);
        await page.waitForTimeout(400);
        ok((await lab(page, () => MotionLab.pool.length)) === 15, tag + ': 26 stored favorites read as one pool of 15');
        const read = await page.textContent('#trends');
        ok(/15 favorites in 6 families: Echo 6/.test(read) && /Most of them/.test(read) && /Not in the pool yet/.test(read), tag + ': the reading names the families and what they share', read.slice(0, 90));
        ok(/follows the moments you were on/.test(read) && /Intensity/.test(read) && /Palette/.test(read) && /Easing/.test(read), tag + ': it reads the options, and tempo only with its caveat');
        const fy = await lab(page, () => MotionLab.foryou);
        ok(fy.like.length === 12 && fy.far.length === 8, tag + ': twelve more like them, eight different', fy.like.length + ' + ' + fy.far.length);
        ok(fy.like.every((c) => favFams.has(c.family) || c.family === 'phases') && [...favFams].every((f) => fy.like.some((c) => c.family === f)), tag + ': More like holds every favored family (and Phases), nothing else', fy.like.map((c) => c.family + '/' + c.params.style).join(' '));
        ok(fy.far.every((c) => !favFams.has(c.family)) && fy.far.filter((c) => NEW_FAMILIES.includes(c.family)).length >= 3, tag + ': Something different holds none of them, and the new families rank high', fy.far.map((c) => c.family).join(' '));
        ok(await noHScroll(page), tag + ': no horizontal scroll');
        await shot(page, tag, w < 800);
        const blank = (await cellsDraw(page, '#fy-like', 12)).concat((await cellsDraw(page, '#fy-far', 8)).map((i) => 'far ' + i));
        ok(blank.length === 0, tag + ': every cell draws', blank.join(', '));
        // Your favorites in the Iterations look: each favorite exactly as starred, beside its twin in the look
        const tw = fy.twins, favCanon = new Set(FAVORITES.map((f) => f.family + canon(f.params)));
        const sameBut = (a, b) => a.family === b.family && a.seed === b.seed && a.direction === b.direction && JSON.stringify(Object.assign({}, a.params, { look: undefined, iteration: undefined })) === JSON.stringify(b.params);
        ok(tw.length === 30 && tw.every((c, i) => (i % 2 ? c.params.look === 'iterations' && sameBut(c, tw[i - 1]) : !('look' in c.params) && favCanon.has(c.family + canon(c.params)))), tag + ': Your favorites in the Iterations look: all 15 as starred, each beside its twin (the same plus the look)', tw.length + ' cells');
        const its = tw.filter((c, i) => i % 2).map((c) => c.params.iteration);
        ok(new Set(its).size === 15 && its.every((n, i) => !i || n === (its[i - 1] % 20) + 1), tag + ': the twins take turns through the twenty', its.join(' '));
        const pressed = await page.$$eval('#fy-twins .cell-star', (b) => b.map((x) => x.getAttribute('aria-pressed')));
        ok(pressed.every((p, i) => p === (i % 2 ? 'false' : 'true')), tag + ': the originals show their stars, the twins wait for one');
        const tBlank = await cellsDraw(page, '#fy-twins', w === 1440 && scheme === 'light' ? 30 : 4);
        ok(tBlank.length === 0, tag + ': the pairs draw', tBlank.join(', '));
        await page.$eval('#fy-twins-h', (e) => e.scrollIntoView({ block: 'start' }));
        await page.waitForTimeout(400);
        await shot(page, tag + '-twins');
        if (w === 1440) await page.evaluate(() => { document.querySelector('#view-foryou').scrollTop = 1e5; });
        await page.waitForTimeout(300);
        if (w === 1440) await shot(page, tag + '-sheets');
        if (w === 1440 && scheme === 'light') {
          // a star from For you joins the pool; the reading follows; the db gets it
          const writes0 = await lab(page, () => window.__fake.writes.length);
          await page.$eval('#fy-like .cell:nth-child(1) .cell-star', (b) => b.scrollIntoView({ block: 'center' }));
          await page.click('#fy-like .cell:nth-child(1) .cell-star');
          await page.waitForTimeout(100);
          ok((await page.getAttribute('#fy-like .cell:nth-child(1) .cell-star', 'aria-pressed')) === 'true', 'a variant in For you can be starred');
          ok((await lab(page, () => MotionLab.pool.length)) === 16 && /16 favorites/.test(await page.textContent('#trends')), 'it joins the pool and the reading follows at once');
          await page.waitForTimeout(1200);
          const last = await lab(page, () => window.__fake.writes.slice(-1)[0]);
          ok(last && (await lab(page, () => window.__fake.writes.length)) > writes0 && Object.values(last.data.stars).flat().length === 16, 'the db gets the pool of 16, without the duplicates');
          // new ideas
          const seed0 = fy.seed;
          await page.click('[data-act="foryou-more"]');
          await page.waitForTimeout(300);
          const fy2 = await lab(page, () => MotionLab.foryou);
          ok(fy2.seed !== seed0 && fy2.like.map((c) => c.seed).join() !== fy.like.map((c) => c.seed).join(), 'New ideas draws another set', seed0 + ' -> ' + fy2.seed);
          // a cell loads onto the stage
          const far0 = fy2.far[0];
          await page.$eval('#fy-far .cell:nth-child(1) .cell-load', (b) => b.scrollIntoView({ block: 'center' }));
          await page.click('#fy-far .cell:nth-child(1) .cell-load');
          await page.waitForTimeout(250);
          const st = await lab(page, () => ({ view: MotionLab.ui.view, v: MotionLab.stage.variant }));
          ok(st.view === 'moments' && st.v.family === far0.family && st.v.seed === far0.seed, 'a cell of For you loads onto the stage', far0.family + ' ' + far0.seed);
          // the Board's pool
          await page.click('.mode[data-mode="board"]');
          await page.waitForTimeout(500);
          ok((await page.$$eval('#board-pool .cell', (c) => c.length)) === 16 && (await page.textContent('#pool-count')) === '16', 'the Board shows the pool first, every favorite');
          ok((await page.evaluate(CANVAS_INFO, '#board-pool .cell:nth-child(1) canvas')).ink > 0.01, 'the pool plays');
          await shot(page, 'board-pool');
          await page.click('#board-pool .cell:nth-child(1) .cell-star');
          await page.waitForTimeout(150);
          ok((await page.$$eval('#board-pool .cell', (c) => c.length)) === 15 && (await lab(page, () => MotionLab.pool.length)) === 15, 'unstarring in the pool takes it out');

          // favorites stay as they were saved: one loaded, toggled to Iterations and back, is the same favorite
          await page.click('.mode[data-mode="foryou"]');
          await page.waitForTimeout(500);
          const data0 = await lab(page, () => JSON.stringify(MotionLab.data));
          const orig = (await lab(page, () => MotionLab.foryou.twins))[0];
          await page.$eval('#fy-twins .cell:nth-child(1) .cell-load', (b) => b.scrollIntoView({ block: 'center' }));
          await page.click('#fy-twins .cell:nth-child(1) .cell-load');
          await page.waitForTimeout(250);
          const starOn = () => page.getAttribute('[data-act="star-stage"]', 'aria-pressed');
          const stageP = () => lab(page, () => MotionLab.stage.variant.params);
          ok(canon(await stageP()) === canon(orig.params) && (await starOn()) === 'true' && (await page.getAttribute('[data-act=look][data-value=classic]', 'aria-pressed')) === 'true', 'a favorite loads exactly as starred: classic, starred', orig.family + '/' + orig.params.style);
          await page.click('[data-act=look][data-value=iterations]');
          await page.waitForTimeout(150);
          ok((await stageP()).look === 'iterations' && (await starOn()) === 'false', 'in the Iterations look it is a new variant, not yet starred');
          await page.click('.iter[data-value="14"]');
          await page.click('[data-act=look][data-value=classic]');
          await page.waitForTimeout(150);
          ok(canon(await stageP()) === canon(orig.params) && (await starOn()) === 'true', 'back in Classic it is the same favorite, starred again');
          ok((await lab(page, () => JSON.stringify(MotionLab.data))) === data0 && (await lab(page, () => MotionLab.pool.length)) === 15, 'and no saved favorite changed');
          await shot(page, 'look-toggled-back');
          // starring a twin keeps it in the look
          await page.click('.mode[data-mode="foryou"]');
          await page.waitForTimeout(500);
          const twin = (await lab(page, () => MotionLab.foryou.twins))[1];
          await page.$eval('#fy-twins .cell:nth-child(2) .cell-star', (b) => b.scrollIntoView({ block: 'center' }));
          await page.click('#fy-twins .cell:nth-child(2) .cell-star');
          await page.waitForTimeout(150);
          const newest = (await lab(page, () => MotionLab.pool))[0];
          ok(newest.params.look === 'iterations' && newest.params.iteration === twin.params.iteration && canon(newest.params) === canon(twin.params) && (await lab(page, () => MotionLab.pool.length)) === 16, 'a starred twin joins the pool in the look', 'iteration ' + twin.params.iteration);
          const read2 = await page.textContent('#trends');
          ok(/1 of them is in the Iterations look, mostly iteration \d+/.test(read2) && /Iterations look\s*1/.test(await page.textContent('#trends .fy-axes')), 'the reading says how many are in the look, and mostly which iteration');
          await page.waitForTimeout(1200);
          const lastW = await lab(page, () => window.__fake.writes.slice(-1)[0]);
          ok(Object.values(lastW.data.stars).flat().some((v) => v.params.look === 'iterations' && v.params.iteration === twin.params.iteration), 'the db gets it with its look');
        }
        ok(errs.length === 0, tag + ': no console errors', errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
    }
    {
      console.log('\nFor you with no favorites');
      const errs = [];
      const ctx = await newContext(browser, { claude: { seedDoc: { picks: {}, stars: {}, v: 1 } } });
      const page = await open(ctx, base, '#foryou', errs);
      await page.waitForTimeout(500);
      ok(/No favorites yet/.test(await page.textContent('#trends')), 'For you says there are no favorites yet');
      const like = await lab(page, () => MotionLab.foryou.like);
      ok(like.length === 12 && new Set(like.map((c) => c.family)).size === 12, 'and offers a starter sheet of twelve different families', like.map((c) => c.family).join(' '));
      ok(!(await page.isVisible('#fy-far-wrap')) && /starter/.test(await page.textContent('#fy-like-h')), 'with no Something different yet');
      ok((await cellsDraw(page, '#fy-like', 12)).length === 0, 'every starter cell draws');
      await page.evaluate(() => { document.querySelector('#view-foryou').scrollTop = 0; });
      await shot(page, 'for-you-none');
      await page.click('#fy-like .cell:nth-child(3) .cell-star');
      await page.waitForTimeout(150);
      ok(/More like/.test(await page.textContent('#fy-like-h')) && /1 favorite in 1 family/.test(await page.textContent('#trends')), 'the first star turns the starter sheet into More like your favorites');
      await page.click('.mode[data-mode="board"]');
      await page.waitForTimeout(300);
      ok((await page.$$eval('#board-pool .cell', (c) => c.length)) === 1, 'and the Board\'s pool holds it');
      ok(errs.length === 0, 'no console errors', errs.join(' | '));
      await ctx.close();
    }

    /* ---------------------------------------------------------------- capabilities (a faked window.claude) */
    console.log('\nwith db, user and downloads (a faked window.claude)');
    {
      const errs = [];
      const stored = { picks: { launch: { family: 'pulse', style: 'heartbeat', params: { style: 'heartbeat', duration: 2400 }, seed: 'from-db', direction: 'right', note: 'stored', at: '2026-10-21T10:00:00.000Z' } }, stars: {}, v: 1 };
      const ctx = await newContext(browser, { claude: { seedDoc: stored } });
      const page = await open(ctx, base, '#moments', errs);
      await page.waitForTimeout(400);
      const d = await lab(page, () => MotionLab.data);
      ok(d.picks.launch && d.picks.launch.seed === 'from-db', 'a stored motion/picks is adopted');
      ok(/saved to the lab/.test(await page.textContent('#savestate')), 'the save state says the lab has the picks', await page.textContent('#savestate'));
      ok(await page.isVisible('.handback-top [data-act="save-spec"]'), 'Save spec appears with downloads');
      const canRec = await page.evaluate(() => typeof MediaRecorder === 'function' && !!HTMLCanvasElement.prototype.captureStream);
      ok((await page.isVisible('.handback-top [data-act="record"]')) === canRec, 'Record appears where MediaRecorder and downloads both are');
      await page.click('.mo[data-moment="keep"]');
      await page.fill('#pick-note', 'a small yes');
      await page.click('#pick-btn');
      await page.waitForTimeout(1400);
      const w = await lab(page, () => window.__fake.writes);
      const last = w[w.length - 1];
      ok(last && last.path === 'motion/picks' && last.data.v === 1 && last.data.picks.keep && last.data.picks.keep.note === 'a small yes' && last.data.picks.launch, 'db receives motion/picks with the new pick and the stored one', w.length + ' write(s)');
      ok(w.length <= 2, 'writes are debounced', w.length + ' write(s)');
      await page.click('.handback-top [data-act="save-spec"]');
      await page.waitForTimeout(200);
      const saves = await lab(page, () => window.__fake.saves);
      const s = saves.find((x) => x.filename === '5s-motion.json');
      ok(s && /"keep"/.test(s.text) && /a small yes/.test(s.text), 'Save spec saves 5s-motion.json through downloads');
      if (canRec) {
        await page.click('.handback-top [data-act="record"]');
        await page.waitForFunction(() => window.__fake.saves.some((x) => /\.webm$/.test(x.filename)), null, { timeout: 15000 }).catch(() => {});
        const rec = (await lab(page, () => window.__fake.saves)).find((x) => /\.webm$/.test(x.filename));
        ok(rec && rec.size > 1000, 'Record saves a WebM clip of the stage through downloads', rec ? rec.filename + ' ' + rec.size + ' bytes' : 'nothing saved');
      }
      ok(errs.length === 0, 'no console errors', errs.join(' | '));
      await ctx.close();
    }
    {
      const errs = [];
      const ctx = await newContext(browser, { claude: { canWrite: false, seedDoc: { picks: {}, stars: {}, v: 1 } } });
      const page = await open(ctx, base, '#moments', errs);
      await page.waitForTimeout(500);
      ok(/View only/.test(await page.textContent('#savestate')), 'a viewer who cannot write is told once, quietly', await page.textContent('#savestate'));
      await page.click('#pick-btn');
      await page.waitForTimeout(1200);
      ok((await lab(page, () => window.__fake.writes.length)) === 0, 'and nothing is written to db for them');
      ok(errs.length === 0, 'no console errors', errs.join(' | '));
      await ctx.close();
    }
  } finally {
    if (browser) await browser.close();
    stop();
  }
  console.log('\n' + passes + ' passed, ' + failures + ' failed. Screenshots: ' + SHOTS);
  process.exit(failures ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
