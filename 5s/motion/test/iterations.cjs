#!/usr/bin/env node
/* iterations.cjs: the Iterations look's twenty presets as one sheet, laid out like the artist's
 * reference/iterations.png (1536 x 1024, five columns by four rows), to hold them up against it.
 *
 *   node 5s/motion/test/iterations.cjs [--theme light|dark] [--out file.png]
 *       the still mark (Marks.mark, weight 0.75) in each of the twenty
 *   node 5s/motion/test/iterations.cjs --family <id> [--t 0.5] [--param k=v ...]
 *       a family's frame at t in each cell instead (params plus look: 'iterations', iteration: n)
 *   --compare   also writes <out>-compare.png (the reference's cell above each rendered cell) and prints, per
 *               cell, a colour-histogram distance to the reference (0 = same colours, 1 = none shared)
 *
 * Default output: $TMPDIR/5s-motion-strips/iterations-<theme>.png (the path is printed).
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const MOTION = path.resolve(__dirname, '..');
const REF = path.join(MOTION, 'reference', 'iterations.png');

const a = { theme: 'light', params: {}, t: 0.5 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const k = argv[i], next = () => argv[++i];
  if (k === '--theme') a.theme = next();
  else if (k === '--out') a.out = next();
  else if (k === '--family') a.family = next();
  else if (k === '--t') a.t = parseFloat(next());
  else if (k === '--compare') a.compare = true;
  else if (k === '--param') { const [key, raw] = next().split('='); a.params[key] = raw === 'true' ? true : raw === 'false' ? false : isNaN(Number(raw)) ? raw : Number(raw); }
  else { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0].replace(/^#!.*\n/, '').replace(/^\/\* ?|^ \* ?/gm, '')); process.exit(k === '--help' ? 0 : 2); }
}

// in the page: the sheet, and per cell the histogram distance to the reference
function sheet({ theme, family, t, params, ref }) {
  const W = 1536, H = 1024, S = 0.262;   // the reference's grid: cells 299 x 239 apart, marks about 262 px to the 1000 units
  const at = (i) => [30 + (i % 5) * 299, 32 + Math.floor(i / 5) * 239];
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = Marks.palette('logo', theme, 1).bg; ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 20; i++) {
    const [x, y] = at(i);
    ctx.setTransform(1, 0, 0, 1, x, y);
    if (family) Motion.render(ctx, family, t, Object.assign({}, params, { look: 'iterations', iteration: i + 1 }), { w: 1000 * S, h: 1000 * S, pad: 0, theme, seed: family, transparent: true });
    else { ctx.scale(S, S); Marks.mark(ctx, { palette: Marks.palette(params.palette || 'logo', theme, i + 1), weight: params.weight || 0.75 }); }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const out = { png: c.toDataURL('image/png') };
  if (!ref) return out;
  return new Promise((done) => {
    const img = new Image();
    img.onload = () => {
      const r = document.createElement('canvas'); r.width = W; r.height = H;
      const rx = r.getContext('2d', { willReadFrequently: true }); rx.drawImage(img, 0, 0);
      // colour histograms (8 x 8 x 8 bins) of each cell's box, both sheets; distance = 1 - histogram intersection
      const hist = (g, x, y) => {
        const d = g.getImageData(x, y, 299, 239).data, h = new Float64Array(512);
        for (let k = 0; k < d.length; k += 4) h[(d[k] >> 5) * 64 + (d[k + 1] >> 5) * 8 + (d[k + 2] >> 5)]++;
        return h.map((v) => v / (d.length / 4));
      };
      out.dist = [];
      for (let i = 0; i < 20; i++) {
        const [x, y] = at(i), p = hist(ctx, x - 10, y - 2), q = hist(rx, x - 10, y - 2);
        let s = 0; for (let k = 0; k < 512; k++) s += Math.min(p[k], q[k]);
        out.dist.push(1 - s);
      }
      // the compare sheet: each reference cell above its render, at twice the size
      const cmp = document.createElement('canvas'); cmp.width = 5 * 300 * 1.4; cmp.height = 8 * 240 * 1.4;
      const cx = cmp.getContext('2d'); cx.fillStyle = '#ddd'; cx.fillRect(0, 0, cmp.width, cmp.height);
      for (let i = 0; i < 20; i++) {
        const [x, y] = at(i), col = i % 5, row = Math.floor(i / 5);
        cx.drawImage(r, x - 10, y - 2, 299, 239, col * 420, row * 2 * 336, 418, 334);
        cx.drawImage(c, x - 10, y - 2, 299, 239, col * 420, (row * 2 + 1) * 336, 418, 334);
        cx.fillStyle = '#000'; cx.font = '600 16px sans-serif'; cx.fillText(String(i + 1), col * 420 + 6, row * 2 * 336 + 18);
      }
      out.cmp = cmp.toDataURL('image/png');
      done(out);
    };
    img.src = ref;
  });
}

(async () => {
  const browser = await chromium.launch();
  let failed = false;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ path: path.join(MOTION, 'marks.js') });
    if (a.family) for (const f of fs.readdirSync(path.join(MOTION, 'families')).filter((x) => x.endsWith('.js')).sort()) await page.addScriptTag({ path: path.join(MOTION, 'families', f) });
    const ref = a.compare ? 'data:image/png;base64,' + fs.readFileSync(REF).toString('base64') : null;
    const r = await page.evaluate(sheet, { theme: a.theme, family: a.family, t: a.t, params: a.params, ref });
    const out = path.resolve(a.out || path.join(os.tmpdir(), '5s-motion-strips', `iterations${a.family ? '-' + a.family : ''}-${a.theme}.png`));
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, Buffer.from(r.png.split(',')[1], 'base64'));
    console.log(out);
    if (r.dist) {
      const cmp = out.replace(/\.png$/, '') + '-compare.png';
      fs.writeFileSync(cmp, Buffer.from(r.cmp.split(',')[1], 'base64'));
      console.log(cmp);
      console.log('histogram distance per cell: ' + r.dist.map((d, i) => `${i + 1}:${d.toFixed(3)}`).join(' '));
      console.log('mean ' + (r.dist.reduce((s, d) => s + d, 0) / 20).toFixed(3));
    }
    if (errors.length) { failed = true; console.log('errors:\n  ' + errors.join('\n  ')); }
  } finally { await browser.close(); }
  process.exit(failed ? 1 : 0);
})();
