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
      for (let i = 1; i <= 12; i++) inks.push((await page.evaluate(CANVAS_INFO, '#sheet .cell:nth-child(' + i + ') canvas')).ink);
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
      ok((await page.evaluate(CANVAS_INFO, '.mo[data-moment="turn"] canvas')).ink > 0.01, 'the rail thumbnail draws');
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
      await page.click('.mode[data-mode="board"]');
      await page.waitForTimeout(300);
      ok(!(await lab(page, () => MotionLab.running)), 'the Board autoplays nothing');
      await shot(page, 'reduced-board');
      await page.click('.mode[data-mode="moments"]');
      await page.waitForTimeout(200);
      await page.click('#t-play');
      await page.waitForTimeout(150);
      ok(await lab(page, () => MotionLab.running && MotionLab.stage.playing), 'Play starts the stage');
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
