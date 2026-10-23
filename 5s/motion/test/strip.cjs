#!/usr/bin/env node
/* strip.cjs: frame strips (and checks) for the 5s Motion Lab families.
 *
 * Usage
 *   node 5s/motion/test/strip.cjs --family <id> [--style <s>] [--theme light|dark] [--frames 10] [--size 200]
 *                                 [--param k=v ...] [--seed <s>] [--dpr 1] [--out file.png]
 *       one row: the family rendered at evenly spaced t from 0 to 1 (t labelled under each frame)
 *   node 5s/motion/test/strip.cjs --all [--theme ...] [--frames 8] [--size 140] [--param k=v ...] [--out file.png]
 *       one row per registered family (each at its default style unless --param style=... fits it)
 *   node 5s/motion/test/strip.cjs --styles --family <id> [...]
 *       one row per style of the family
 *   node 5s/motion/test/strip.cjs --check [--family <id>] [--param k=v ...]
 *       asserts, per family (every family, or the one named), in both themes and every style:
 *         - no console errors or page errors while loading and rendering
 *         - determinism: the same t renders pixel-identical frames, before and after other frames
 *         - the frame at t = 1 is not blank (something differs from the background)
 *         - loops are seamless: t = 0 and t = 1 match (families with loop: true)
 *           and stay so under outElastic easing, still moving mid-cycle (not parked at rest)
 *         - Motion.render leaves the context as it found it (transform, alpha)
 *       exits 1 if anything fails.
 *
 * It serves 5s/motion with python3 -m http.server on a free port in 8970-8999 (or $STRIP_PORT), opens a blank
 * page that loads marks.js and every families/*.js, renders there, writes the PNG and stops the server.
 * --param values: numbers stay numbers, true/false become booleans, anything else is a string
 *   (e.g. --param palette=keep --param intensity=0.9 --param ribbon=false).
 * Default output: $TMPDIR/5s-motion-strips/<family>[-<style>]-<theme>.png (the path is printed).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const MOTION = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const a = { frames: null, size: null, theme: 'light', params: {}, dpr: 1 };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error(k + ' needs a value'); return argv[++i]; };
    if (k === '--family') a.family = next();
    else if (k === '--style') a.style = next();
    else if (k === '--theme') a.theme = next();
    else if (k === '--frames') a.frames = parseInt(next(), 10);
    else if (k === '--size') a.size = parseInt(next(), 10);
    else if (k === '--seed') a.seed = next();
    else if (k === '--dpr') a.dpr = parseFloat(next());
    else if (k === '--out') a.out = next();
    else if (k === '--all') a.all = true;
    else if (k === '--styles') a.styles = true;
    else if (k === '--check') a.check = true;
    else if (k === '--param') {
      const kv = next(), eq = kv.indexOf('=');
      if (eq < 1) throw new Error('--param wants k=v, got ' + kv);
      const key = kv.slice(0, eq), raw = kv.slice(eq + 1);
      a.params[key] = raw === 'true' ? true : raw === 'false' ? false : (raw !== '' && !isNaN(Number(raw)) ? Number(raw) : raw);
    } else if (k === '--help' || k === '-h') a.help = true;
    else throw new Error('unknown argument ' + k);
  }
  if (a.style) a.params.style = a.style;
  if (!['light', 'dark'].includes(a.theme)) throw new Error('--theme is light or dark');
  return a;
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
  if (process.env.STRIP_PORT) return parseInt(process.env.STRIP_PORT, 10);
  const start = 8970 + Math.floor(Math.random() * 30);
  for (let k = 0; k < 30; k++) {
    const p = 8970 + ((start - 8970 + k) % 30);
    if (await portFree(p)) return p;
  }
  throw new Error('no free port in 8970-8999 (set STRIP_PORT)');
}

function waitFor(url, ms) {
  const until = Date.now() + ms;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(url, (res) => { res.resume(); if (res.statusCode === 200) resolve(); else retry(); });
      req.on('error', retry);
      req.setTimeout(500, () => { req.destroy(); });
    };
    const retry = () => { if (Date.now() > until) reject(new Error('server did not start: ' + url)); else setTimeout(tryOnce, 100); };
    tryOnce();
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.family && !args.all && !args.check)) {
    const head = fs.readFileSync(__filename, 'utf8').split('*/')[0];
    console.log(head.replace(/^#!.*\n/, '').replace(/^\/\* ?|^ \* ?/gm, ''));
    process.exit(args.help ? 0 : 2);
  }
  const famDir = path.join(MOTION, 'families');
  const famFiles = fs.existsSync(famDir) ? fs.readdirSync(famDir).filter((f) => f.endsWith('.js')).sort() : [];

  const port = await pickPort();
  const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', MOTION], { stdio: 'ignore' });
  const stop = () => { try { server.kill(); } catch (e) { /* gone */ } };
  process.on('exit', stop);
  process.on('SIGINT', () => { stop(); process.exit(130); });
  const base = `http://127.0.0.1:${port}`;
  let browser;
  let failed = false;
  try {
    await waitFor(base + '/marks.js', 8000);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push('pageerror: ' + (e && e.message ? e.message : String(e))));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
    const html = '<!doctype html><meta charset="utf-8"><title>strip</title><body style="margin:0">' +
      '<script src="marks.js"></script>' + famFiles.map((f) => `<script src="families/${f}"></script>`).join('') + '</body>';
    await page.route(base + '/__strip__.html', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: html }));
    await page.goto(base + '/__strip__.html', { waitUntil: 'load' });
    const loaded = await page.evaluate(() => (typeof Motion === 'undefined' ? null : Motion.families.map((f) => f.id)));
    if (!loaded) throw new Error('marks.js did not load: ' + errors.join('; '));
    if (args.family && !loaded.includes(args.family)) throw new Error(`no family "${args.family}" (registered: ${loaded.join(', ') || 'none'})` + (errors.length ? '\n' + errors.join('\n') : ''));

    if (args.check) {
      const ids = args.family ? [args.family] : loaded;
      const loadErrors = errors.splice(0);
      const report = await page.evaluate(runChecks, { ids, size: args.size || 160, params: args.params });
      const runErrors = errors.splice(0);
      if (loadErrors.length) { failed = true; console.log('FAIL loading families:\n  ' + loadErrors.join('\n  ')); }
      for (const r of report) {
        const bad = r.problems.length > 0;
        if (bad) failed = true;
        console.log(`${bad ? 'FAIL' : 'PASS'} ${r.id}: ${r.notes.join('; ')}` + (bad ? '\n  - ' + r.problems.join('\n  - ') : ''));
      }
      if (runErrors.length) { failed = true; console.log('FAIL errors while rendering:\n  ' + runErrors.join('\n  ')); }
      if (!ids.length) console.log('(no families registered)');
      console.log(failed ? 'check: FAILED' : `check: all ${ids.length} famil${ids.length === 1 ? 'y' : 'ies'} pass`);
    } else {
      let rows;
      if (args.all) rows = loaded.map((id) => ({ id }));
      else if (args.styles) rows = (await page.evaluate((id) => Motion.get(id).styles, args.family)).map((s) => ({ id: args.family, style: s }));
      else rows = [{ id: args.family }];
      const frames = args.frames || (args.all ? 8 : 10);
      const size = args.size || (args.all ? 140 : 200);
      const url = await page.evaluate(drawStrip, { rows, frames, size, theme: args.theme, params: args.params, seed: args.seed, dpr: args.dpr });
      if (errors.length) { failed = true; console.log('errors:\n  ' + errors.join('\n  ')); }
      const name = args.all ? `all-${args.theme}` : args.styles ? `${args.family}-styles-${args.theme}`
        : `${args.family}${args.params.style ? '-' + args.params.style : ''}-${args.theme}`;
      const out = path.resolve(args.out || path.join(os.tmpdir(), '5s-motion-strips', name + '.png'));
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
      console.log(out);
    }
  } finally {
    if (browser) await browser.close();
    stop();
  }
  process.exit(failed ? 1 : 0);
}

/* --- in the page --------------------------------------------------------------------------------- */

function drawStrip({ rows, frames, size, theme, params, seed, dpr }) {
  const pal = Marks.palette('logo', theme);
  const S = size, gap = Math.max(4, Math.round(S * 0.04)), labelH = 18, headH = 26, margin = 12;
  const left = rows.length > 1 ? 150 : 0;
  const W = margin * 2 + left + frames * S + (frames - 1) * gap;
  const H = margin * 2 + headH + rows.length * (S + labelH + gap) - gap;
  const c = document.createElement('canvas');
  c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const ctx = c.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const sheet = theme === 'dark' ? '#1B1826' : '#ECEAF2';
  const text = pal.ink, muted = Marks.mix(pal.ink, sheet, 0.45);
  ctx.fillStyle = sheet; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'middle';
  const font = (px, w) => `${w || 400} ${px}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  // header
  const first = Motion.get(rows[0].id);
  const shared = Object.keys(params).filter((k) => k !== 'style').map((k) => `${k}=${params[k]}`).join(' ');
  let head;
  if (rows.length === 1) {
    const p = Motion.resolve(rows[0].id, Object.assign({}, params, rows[0].style ? { style: rows[0].style } : {}));
    head = `${first.name} (${first.id}) · ${p.style} · ${theme} · ${p.duration} ms${first.loop ? ' loop' : ''} · seed ${seed == null ? first.id : seed}${shared ? ' · ' + shared : ''}`;
  } else {
    head = `${rows.every((r) => r.id === rows[0].id) ? first.name + ' styles' : 'All families'} · ${theme}${shared ? ' · ' + shared : ''}`;
  }
  ctx.fillStyle = text; ctx.font = font(14, 600);
  ctx.fillText(head, margin, margin + headH / 2 - 2);
  rows.forEach((row, r) => {
    const fam = Motion.get(row.id);
    const p = Object.assign({}, params, row.style ? { style: row.style } : {});
    if (p.style && !fam.styles.includes(p.style)) delete p.style;
    const y = margin + headH + r * (S + labelH + gap);
    if (left) {
      const style = Motion.resolve(row.id, p).style;
      ctx.fillStyle = text; ctx.font = font(13, 600);
      ctx.fillText(row.style ? row.style : fam.name, margin, y + S / 2 - 9);
      ctx.fillStyle = muted; ctx.font = font(11);
      ctx.fillText(row.style ? fam.id : `${fam.id} · ${style}`, margin, y + S / 2 + 9);
    }
    for (let i = 0; i < frames; i++) {
      const t = frames === 1 ? 1 : i / (frames - 1);
      const x = margin + left + i * (S + gap);
      ctx.save();
      ctx.translate(x, y);
      Motion.render(ctx, row.id, t, p, { w: S, h: S, dpr, theme, seed: seed == null ? undefined : seed });
      ctx.restore();
      ctx.fillStyle = muted; ctx.font = font(11);
      const label = 't=' + t.toFixed(2);
      ctx.fillText(label, x + S / 2 - ctx.measureText(label).width / 2, y + S + labelH / 2 + 1);
    }
  });
  return c.toDataURL('image/png');
}

function runChecks({ ids, size, params }) {
  const S = size;
  // Software canvases throughout, and one warm-up render of every family first: Chromium rasterizes a GPU
  // canvas (here Marks' scratch layers) slightly differently until a readback moves it to software, which
  // would look like non-determinism in whichever frame happens to come first.
  const canvas = () => { const c = document.createElement('canvas'); c.width = S; c.height = S; c.getContext('2d', { willReadFrequently: true }); return c; };
  for (const id of ids) for (const theme of ['light', 'dark']) for (const style of Motion.get(id).styles) {
    try { const c = canvas(); Motion.render(c.getContext('2d'), id, 0.5, Object.assign({}, params, { style }), { w: S, h: S, theme, seed: 'warm' }); c.getContext('2d').getImageData(0, 0, 1, 1); } catch (e) { /* reported below */ }
  }
  const frame = (id, t, p, theme, c) => {
    c = c || canvas();
    const ctx = c.getContext('2d');
    Motion.render(ctx, id, t, p, { w: S, h: S, dpr: 1, theme, seed: 'check' });
    return c;
  };
  const pixels = (c) => c.getContext('2d').getImageData(0, 0, S, S).data;
  const same = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };
  const diffShare = (a, b, tol) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > tol) n++; return n / (a.length / 4); };
  const out = [];
  for (const id of ids) {
    const fam = Motion.get(id), problems = [], notes = [];
    let ink = Infinity;
    for (const theme of ['light', 'dark']) {
      for (const style of fam.styles) {
        const p = Object.assign({}, params, { style });   // --param (e.g. look=iterations iteration=7) applies to every style
        try {
          const tag = `${style}/${theme}`;
          const a = pixels(frame(id, 0.37, p, theme));
          const scratch = canvas();
          for (const t of [0, 0.9, 0.5, 1, 0.12]) frame(id, t, p, theme, scratch);
          const b = pixels(frame(id, 0.37, p, theme, scratch));
          if (!same(a, b)) problems.push(`${tag}: t=0.37 differs between two renders (not deterministic, or state leaks between frames)`);
          const c1 = frame(id, 1, p, theme);
          const bg = Marks.palette(Motion.resolve(id, p).palette, theme, p.look === 'iterations' ? p.iteration || 1 : undefined).bg;
          const bgc = canvas();
          const bx = bgc.getContext('2d'); bx.fillStyle = bg; bx.fillRect(0, 0, S, S);
          const share = diffShare(pixels(c1), pixels(bgc), 24);
          ink = Math.min(ink, share);
          if (share < 0.005) problems.push(`${tag}: the frame at t=1 is blank`);
          if (fam.loop) {
            const seam = diffShare(pixels(frame(id, 0, p, theme)), pixels(c1), 24);
            if (seam > 0.002) problems.push(`${tag}: loop seam: t=0 and t=1 differ on ${(seam * 100).toFixed(1)}% of pixels`);
            // under an ease-out (Generate hands loops these too) a loop stays seamless and still moves mid-cycle
            const pe = Object.assign({}, p, { easing: 'outElastic' }), e0 = pixels(frame(id, 0, pe, theme));
            if (diffShare(e0, pixels(frame(id, 1, pe, theme)), 24) > 0.002) problems.push(`${tag}: loop seam breaks under outElastic`);
            if (Math.max(...[0.25, 0.5, 0.75].map((t) => diffShare(e0, pixels(frame(id, t, pe, theme)), 24))) < 0.005) problems.push(`${tag}: under outElastic the loop sits still mid-cycle`);
          }
          const cc = canvas(), ctx = cc.getContext('2d');
          ctx.globalAlpha = 0.8;
          Motion.render(ctx, id, 0.5, p, { w: S, h: S, theme, seed: 'check' });
          const m = ctx.getTransform();
          if (m.a !== 1 || m.b !== 0 || m.c !== 0 || m.d !== 1 || m.e !== 0 || m.f !== 0 || ctx.globalAlpha !== 0.8) problems.push(`${tag}: render did not restore the context`);
        } catch (e) {
          problems.push(`${style}/${theme}: threw ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`);
        }
      }
    }
    notes.push(`${fam.styles.length} styles x 2 themes`, 'deterministic', `t=1 shows ${(ink * 100).toFixed(1)}%+ of the frame`, fam.loop ? 'loop seamless' : 'one-shot');
    out.push({ id, problems, notes });
  }
  return out;
}

main().catch((e) => { console.error(e && e.stack ? e.stack : e); process.exit(1); });
