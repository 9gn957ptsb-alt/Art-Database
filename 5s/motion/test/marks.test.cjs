#!/usr/bin/env node
/* marks.test.cjs: Playwright checks of 5s/motion/marks.js (the Marks engine and the Motion registry).
 *
 *   node 5s/motion/test/marks.test.cjs
 *
 * Loads marks.js into a blank Chromium page and checks: API completeness and freezing; points() lengths,
 * end points and even spacing; length(); resample(); morph(); stroke() drawing partial strokes with the
 * gradient spread along the whole stroke and even translucency; ribbon(); rng determinism; palettes in
 * both themes; easing end points; mix(); fit(); Motion.register validation; Motion.render clamping,
 * restoring the context, determinism and reduced motion; the Iterations look (presets, palettes, the stroke's
 * profile/caps/cut, the glass, render's look param). Then, with the families loaded: the 15 favorites resolve to
 * exactly their saved params, no defaults carry a look, and no family's cache leaks between looks. Exits 1 on any failure.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const MARKS = path.resolve(__dirname, '..', 'marks.js');

function suite() {
  const out = [];
  const check = (name, fn) => {
    try {
      const r = fn();
      if (r === true) out.push({ name, ok: true });
      else out.push({ name, ok: false, detail: typeof r === 'string' ? r : JSON.stringify(r) });
    } catch (e) { out.push({ name, ok: false, detail: String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
  };
  const close = (a, b, eps) => Math.abs(a - b) <= (eps == null ? 1e-9 : eps);
  const M = Marks;
  const NAMES = ['bar', 'body', 's', 'ribbon', 'd1', 'd2', 'd3', 'd4', 'frame'];
  const HEX = /^#[0-9a-f]{6}$/i;

  // --- API ------------------------------------------------------------------------------------
  check('api: Marks has every member of the spec', () => {
    const fns = ['points', 'length', 'morph', 'stroke', 'ribbon', 'palette', 'rng', 'mix', 'fit'];
    const missing = fns.filter((f) => typeof M[f] !== 'function');
    if (M.W !== 1000) return 'Marks.W is ' + M.W;
    if (!M.ease || typeof M.ease !== 'object') return 'no Marks.ease';
    return missing.length ? 'missing ' + missing.join(', ') : true;
  });
  check('api: Marks.paths is {bar, body, s, ribbon, d1, d2, d3, d4, frame} as path strings', () => {
    const keys = Object.keys(M.paths).sort().join(',');
    if (keys !== NAMES.slice().sort().join(',')) return 'keys ' + keys;
    const bad = NAMES.filter((k) => typeof M.paths[k] !== 'string' || !/^\s*M/.test(M.paths[k]));
    return bad.length ? 'not path data: ' + bad : true;
  });
  check('api: Marks.ease has linear, inCubic, outCubic, inOutCubic, outQuint, inOutQuint, outBack(k), outElastic(k), spring(s, d), steps(n)', () => {
    const plain = ['linear', 'inCubic', 'outCubic', 'inOutCubic', 'outQuint', 'inOutQuint'];
    const made = ['outBack', 'outElastic', 'spring', 'steps'];
    const bad = plain.filter((k) => typeof M.ease[k] !== 'function' || typeof M.ease[k](0.5) !== 'number')
      .concat(made.filter((k) => typeof M.ease[k] !== 'function' || typeof M.ease[k]() !== 'function'));
    return bad.length ? 'bad: ' + bad : true;
  });
  check('api: Motion has register, families, get, defaults, render', () => {
    const bad = ['register', 'get', 'defaults', 'render'].filter((f) => typeof Motion[f] !== 'function');
    if (!Array.isArray(Motion.families)) bad.push('families');
    return bad.length ? 'missing ' + bad : true;
  });
  check('api: Marks and Motion (and their tables) are frozen', () => {
    const objs = { Marks: M, Motion, paths: M.paths, ease: M.ease, widths: M.widths, MOMENTS: Motion.MOMENTS };
    const notFrozen = Object.keys(objs).filter((k) => !Object.isFrozen(objs[k]));
    try { M.W = 5; } catch (e) { /* strict callers throw */ }
    try { M.paths.bar = 'M 0 0 L 1 1'; } catch (e) { /* ok */ }
    if (M.W !== 1000 || !/^M 3/.test(M.paths.bar)) return 'mutated';
    return notFrozen.length ? 'not frozen: ' + notFrozen : true;
  });

  // --- geometry -------------------------------------------------------------------------------
  check('points(): n points for n = 2, 3, 17, 128, 400 on every path', () => {
    for (const k of NAMES) for (const n of [2, 3, 17, 128, 400]) {
      const p = M.points(k, n);
      if (p.length !== n) return `${k} n=${n} gave ${p.length}`;
      if (p.some((q) => !Array.isArray(q) || q.length !== 2 || !isFinite(q[0]) || !isFinite(q[1]))) return `${k} n=${n} has a bad point`;
    }
    return M.points('bar').length === 128 ? true : 'default n is not 128';
  });
  check('points(): first and last points are the path ends, inside mark space', () => {
    const b = M.points('bar', 50);
    if (!close(b[0][0], 326, 1e-6) || !close(b[0][1], 231, 1e-6) || !close(b[49][0], 616, 1e-6) || !close(b[49][1], 229, 1e-6)) return JSON.stringify([b[0], b[49]]);
    const f = M.points('frame', 64);
    if (!close(f[0][0], f[63][0], 1e-6) || !close(f[0][1], f[63][1], 1e-6)) return 'frame is not closed';
    for (const k of NAMES) for (const q of M.points(k, 200)) if (q[0] < 0 || q[0] > 1000 || q[1] < 0 || q[1] > 1000) return k + ' leaves mark space at ' + q;
    return true;
  });
  check('points(): evenly spaced by arc length', () => {
    const n = 300;
    for (const k of NAMES) {
      const p = M.points(k, n), L = M.length(k), step = L / (n - 1);
      const d = []; for (let i = 1; i < n; i++) d.push(Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
      const max = Math.max(...d), within = d.filter((x) => Math.abs(x - step) <= step * 0.02).length / d.length;
      if (max > step * 1.0005) return `${k}: a step of ${max.toFixed(3)} > arc step ${step.toFixed(3)}`;
      if (within < 0.97) return `${k}: only ${(within * 100).toFixed(1)}% of steps within 2% of ${step.toFixed(3)}`;
    }
    return true;
  });
  check('length(): matches a fine resampling; the letters have plausible lengths', () => {
    for (const k of NAMES) {
      const p = M.points(k, 4000); let s = 0;
      for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (!close(s, M.length(k), M.length(k) * 0.001)) return `${k}: ${s} vs ${M.length(k)}`;
    }
    const L = (k) => M.length(k);
    if (!(L('bar') > 250 && L('bar') < 350)) return 'bar ' + L('bar');
    if (!(L('body') > 1000 && L('body') < 1600)) return 'body ' + L('body');
    if (!(L('frame') > 3300 && L('frame') < 3550)) return 'frame ' + L('frame');
    return true;
  });
  check('points(): returns fresh arrays (callers may mutate)', () => {
    const a = M.points('s', 10); a[0][0] = -999; a.push([0, 0]);
    const b = M.points('s', 10);
    return b.length === 10 && b[0][0] !== -999 ? true : 'shared state';
  });
  check('points(): accepts raw SVG path data (absolute, relative, H/V/S/Q/T/Z)', () => {
    const a = M.points('M 0 0 L 100 0', 3);
    if (!close(a[1][0], 50) || !close(a[1][1], 0)) return 'line ' + JSON.stringify(a);
    const r = M.points('m 10 10 h 100 v 100 h -100 z', 5);
    const want = [[10, 10], [110, 10], [110, 110], [10, 110], [10, 10]];
    if (r.some((q, i) => !close(q[0], want[i][0], 1e-6) || !close(q[1], want[i][1], 1e-6))) return 'relative square ' + JSON.stringify(r);
    if (!close(M.length('M 0 0 Q 50 0 100 0 T 200 0'), 200, 1e-6)) return 'Q/T';
    if (!close(M.length('M 0 0 C 10 0 20 0 30 0 S 50 0 60 0'), 60, 1e-6)) return 'C/S';
    let threw = false; try { M.points('nope', 4); } catch (e) { threw = true; }
    return threw ? true : 'unknown names should throw';
  });
  check('resample(): any polyline, evenly by arc length', () => {
    const r = M.resample([[0, 0], [100, 0], [100, 100]], 5);
    const want = [[0, 0], [50, 0], [100, 0], [100, 50], [100, 100]];
    return r.every((q, i) => close(q[0], want[i][0], 1e-9) && close(q[1], want[i][1], 1e-9)) ? true : JSON.stringify(r);
  });
  check('morph(): t=0 is a, t=1 is b, t=0.5 the midpoints, n kept', () => {
    const a = M.points('d4', 64), b = M.points('d3', 64);
    const m0 = M.morph(a, b, 0), m1 = M.morph(a, b, 1), mh = M.morph(a, b, 0.5);
    if (m0.length !== 64 || m1.length !== 64 || mh.length !== 64) return 'length';
    for (let i = 0; i < 64; i++) {
      if (!close(m0[i][0], a[i][0]) || !close(m0[i][1], a[i][1])) return 't=0 at ' + i;
      if (!close(m1[i][0], b[i][0]) || !close(m1[i][1], b[i][1])) return 't=1 at ' + i;
      if (!close(mh[i][0], (a[i][0] + b[i][0]) / 2) || !close(mh[i][1], (a[i][1] + b[i][1]) / 2)) return 't=0.5 at ' + i;
    }
    const u = M.morph(M.points('bar', 10), M.points('s', 30), 0.5);
    return u.length === 30 ? true : 'unequal lists not resampled to the longer: ' + u.length;
  });
  check('at(), transform(), bbox() helpers', () => {
    const a = M.at([[0, 0], [100, 0], [100, 100]], 0.75);
    if (!close(a.x, 100, 1e-9) || !close(a.y, 50, 1e-9) || !close(a.angle, Math.PI / 2, 1e-9)) return 'at ' + JSON.stringify(a);
    const t = M.transform([[600, 500]], { scale: 2, origin: [500, 500], x: 10 });
    if (!close(t[0][0], 710) || !close(t[0][1], 500)) return 'transform ' + t;
    const b = M.bbox('bar');
    return b[0] < 326 - 60 && b[2] > 616 + 60 ? true : 'bbox ' + b;
  });

  // --- drawing --------------------------------------------------------------------------------
  const S = 400;
  // software canvases (willReadFrequently): Chromium's first GPU canvases rasterize slightly differently
  const fresh = () => { const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, S, S); M.fit(x, S, S, 0); return { c, x }; };
  const px = (c, mx, my) => { const d = c.getContext('2d').getImageData(Math.round(mx * S / 1000), Math.round(my * S / 1000), 1, 1).data; return [d[0], d[1], d[2]]; };
  const dark = (c) => { const d = c.getContext('2d').getImageData(0, 0, S, S).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) n++; return n; };
  check('stroke(): draws partial strokes from `from` to `to`', () => {
    const bar = M.points('bar', 100), w = M.widths.bar;
    const f = fresh(); M.stroke(f.x, bar, { width: w, colours: '#000' }); const full = dark(f.c);
    const h = fresh(); M.stroke(h.x, bar, { width: w, colours: '#000', from: 0, to: 0.5 }); const half = dark(h.c);
    const g = fresh(); M.stroke(g.x, bar, { width: w, colours: '#000', from: 0.5, to: 1 }); const back = dark(g.c);
    if (!(full > 1000)) return 'full stroke drew ' + full;
    if (!(half / full > 0.4 && half / full < 0.65)) return `first half covers ${(half / full).toFixed(2)} of the full stroke`;
    if (!(back / full > 0.4 && back / full < 0.65)) return `second half covers ${(back / full).toFixed(2)}`;
    const end = M.at(bar, 0.95), start = M.at(bar, 0.05);
    if (px(h.c, end.x, end.y)[0] < 200) return 'the first half reached the end';
    if (px(h.c, start.x, start.y)[0] > 60) return 'the first half missed the start';
    if (px(g.c, start.x, start.y)[0] < 200 || px(g.c, end.x, end.y)[0] > 60) return 'the second half is in the wrong place';
    const z = fresh(); M.stroke(z.x, bar, { width: w, colours: '#000', from: 0.3, to: 0.3 }); M.stroke(z.x, bar, { width: w, colours: '#000', from: 0.6, to: 0.4 });
    M.stroke(z.x, bar, { width: w, colours: '#000', alpha: 0 });
    return dark(z.c) === 0 ? true : 'empty strokes drew pixels';
  });
  check('stroke(): the gradient runs along the whole stroke, so a partial stroke keeps its colours', () => {
    const bar = M.points('bar', 100), w = M.widths.bar, cols = ['#ff0000', '#0000ff'];
    const f = fresh(); M.stroke(f.x, bar, { width: w, colours: cols });
    const a = M.at(bar, 0.05), b = M.at(bar, 0.95), m = M.at(bar, 0.6);
    const ca = px(f.c, a.x, a.y), cb = px(f.c, b.x, b.y);
    if (!(ca[0] > 200 && ca[2] < 60 && cb[2] > 200 && cb[0] < 60)) return 'full stroke ends ' + ca + ' / ' + cb;
    const h = fresh(); M.stroke(h.x, bar, { width: w, colours: cols, from: 0.5, to: 1 });
    const cm = px(h.c, m.x, m.y), ce = px(h.c, b.x, b.y);
    if (!(cm[0] > 70 && cm[0] < 140 && cm[2] > 115 && cm[2] < 185)) return 'at 60% of a 50..100% stroke the colour should be 60% blue, got ' + cm;
    if (!(ce[2] > 200 && ce[0] < 60)) return 'end colour ' + ce;
    const s = fresh(); M.stroke(s.x, bar, { width: w, colours: [[0, '#ff0000'], [0.2, '#00ff00'], [1, '#00ff00']] });
    const c3 = px(s.c, m.x, m.y);
    if (!(c3[1] > 200 && c3[0] < 40)) return 'positioned stops ' + c3;
    const sh = fresh(); M.stroke(sh.x, bar, { width: w, colours: cols, shift: 0.5 });
    const c4 = px(sh.c, m.x, m.y), c5 = px(sh.c, b.x, b.y), c6 = px(sh.c, a.x, a.y);
    return c4[0] > 200 && c4[2] < 60 && c5[0] > 110 && c5[0] < 165 && c5[2] > 90 && c5[2] < 140 && c6[0] > 230 ? true : 'shift 0.5 should slide red halfway along: ' + [c6, c4, c5].join(' / ');
  });
  check('stroke(): translucent gradient strokes are even (no darker joints or self-overlaps)', () => {
    const body = M.points('body', 160);
    const f = fresh(); M.stroke(f.x, body, { width: M.widths.body, colours: ['#000000', '#000001'], alpha: 0.5 });
    const vals = [];
    for (let i = 2; i < 158; i += 3) { const q = body[i]; vals.push(px(f.c, q[0], q[1])[0]); }
    const lo = Math.min(...vals), hi = Math.max(...vals);
    return lo >= 120 && hi <= 136 ? true : `values ${lo}..${hi}, want about 128`;
  });
  check('stroke(): a collapsed stroke is a dot; square and butt caps draw', () => {
    const f = fresh(); M.stroke(f.x, [[500, 500], [500, 500]], { width: 100, colours: '#000' });
    if (px(f.c, 500, 500)[0] > 40 || px(f.c, 540, 500)[0] > 40 || px(f.c, 560, 500)[0] < 200) return 'dot';
    const g = fresh(); M.stroke(g.x, [[300, 500], [700, 500]], { width: 100, colours: ['#000', '#111'], cap: 'butt' });
    if (px(g.c, 290, 500)[0] < 200 || px(g.c, 310, 500)[0] > 60) return 'butt cap';
    const h = fresh(); M.stroke(h.x, [[300, 500], [700, 500]], { width: 100, colours: ['#000', '#111'], cap: 'square' });
    return px(h.c, 260, 540)[0] < 60 ? true : 'square cap';
  });
  check('ribbon(): draws, is deterministic for the same t, and moves with t', () => {
    const r = (t, o) => { const f = fresh(); M.ribbon(f.x, t, o || {}); return f.c.getContext('2d').getImageData(0, 0, S, S).data; };
    const a = r(0.3), b = r(0.3), c = r(0.55), e = r(0.3, { along: 0.4 }), n = r(0.3, { along: [0.5, 0.5] });
    let same = true, moved = 0, ink = 0, partial = 0, none = 0;
    for (let i = 0; i < a.length; i += 4) {
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) same = false;
      if (Math.abs(a[i] - c[i]) > 8) moved++;
      if (a[i] < 245) ink++;
      if (e[i] < 245) partial++;
      if (n[i] < 255) none++;
    }
    if (!same) return 'not deterministic';
    if (ink < 2000) return 'drew too little: ' + ink;
    if (moved < 200) return 'did not move with t';
    if (!(partial > ink * 0.15 && partial < ink * 0.75)) return `along 0.4 drew ${(partial / ink).toFixed(2)} of the ribbon`;
    return none === 0 ? true : 'an empty along range drew pixels';
  });
  check('mark(): draws the whole logo and a layer() composites once', () => {
    const f = fresh(); M.mark(f.x, { palette: 'logo', frame: true });
    const bar = px(f.c, 470, 230), s = px(f.c, 857, 752), frame = px(f.c, 500, 21), paper = px(f.c, 500, 100);
    if (!(bar[0] > 200 && bar[2] < 120)) return 'bar ' + bar;
    if (!(s[0] > 200 && s[2] < 120)) return 's ' + s;
    if (!(frame[2] > 180 && frame[0] < 120)) return 'frame ' + frame;
    if (paper[0] < 245) return 'paper ' + paper;
    const g = fresh(); M.layer(g.x, { alpha: 0.5 }, (c) => { c.fillStyle = '#000'; c.fillRect(100, 100, 400, 400); c.fillRect(300, 300, 400, 400); });
    const v1 = px(g.c, 200, 200)[0], v2 = px(g.c, 400, 400)[0];
    return Math.abs(v1 - v2) <= 1 && v1 > 120 && v1 < 136 ? true : `layer overlap ${v1} vs ${v2}`;
  });

  // --- randomness, colour, easing, layout ------------------------------------------------------
  check('rng(): same seed, same sequence; different seeds differ; values in [0, 1)', () => {
    const take = (seed) => { const r = M.rng(seed); return Array.from({ length: 200 }, () => r()); };
    const a = take('pulse:42'), b = take('pulse:42'), c = take('pulse:43'), d = take(42), e = take(42);
    if (a.some((x, i) => x !== b[i])) return 'string seed not repeatable';
    if (d.some((x, i) => x !== e[i])) return 'number seed not repeatable';
    if (a.every((x, i) => x === c[i])) return 'different seeds gave the same sequence';
    if (a.concat(c, d).some((x) => !(x >= 0 && x < 1))) return 'value out of [0, 1)';
    const mean = a.concat(c, d).reduce((s, x) => s + x, 0) / 600;
    return mean > 0.42 && mean < 0.58 ? true : 'mean ' + mean;
  });
  check('palette(): every palette in both themes has five, s, ribbon colour lists, bg and ink', () => {
    const okStop = (s) => (typeof s === 'string' && HEX.test(s)) || (Array.isArray(s) && typeof s[0] === 'number' && HEX.test(s[1]));
    for (const name of ['logo', 'keep', 'pass', 'turn', 'ink', 'paper', 'inverse']) for (const theme of ['light', 'dark']) {
      const p = M.palette(name, theme);
      for (const k of ['five', 'bar', 'body', 's', 'ribbon', 'frame']) if (!Array.isArray(p[k]) || !p[k].length || !p[k].every(okStop)) return `${name}/${theme}.${k} ${JSON.stringify(p[k])}`;
      for (const k of ['bg', 'ink']) if (!HEX.test(p[k])) return `${name}/${theme}.${k} ${p[k]}`;
    }
    return M.PALETTES.length === 7 ? true : 'PALETTES ' + M.PALETTES;
  });
  check('palette(): the app tokens for each theme', () => {
    const L = M.palette('logo', 'light'), D = M.palette('logo', 'dark');
    if (L.bg !== '#FAF9FC' || L.ink !== '#16131F' || D.bg !== '#100E18' || D.ink !== '#EEEBF5') return 'paper/ink ' + [L.bg, L.ink, D.bg, D.ink];
    if (M.palette('ink', 'light').five.join() !== '#16131F' || M.palette('ink', 'dark').five.join() !== '#EEEBF5') return 'ink palette';
    if (M.palette('paper', 'light').five.join() !== '#FAF9FC' || M.palette('paper', 'light').bg !== '#7350EE') return 'paper palette';
    if (M.palette('inverse', 'light').bg !== '#100E18' || M.palette('inverse', 'dark').bg !== '#FAF9FC') return 'inverse';
    if (!M.palette('keep', 'light').body.includes('#F28A3C') || !M.palette('keep', 'dark').body.includes('#FF9B55')) return 'keep is ember';
    if (!M.palette('pass', 'light').body.includes('#2F6BE0') || !M.palette('turn', 'dark').body.includes('#A78BFF')) return 'pass cobalt / turn iris';
    if (M.palette('nonsense', 'light') !== L) return 'unknown names should fall back to logo';
    return Object.isFrozen(L) && Object.isFrozen(L.five) ? true : 'palettes should be frozen';
  });
  check('ease: every curve maps 0 to 0 and 1 to 1 (factories with any arguments)', () => {
    const E = M.ease, curves = {};
    for (const k of ['linear', 'inQuad', 'outQuad', 'inOutQuad', 'inCubic', 'outCubic', 'inOutCubic', 'outQuint', 'inOutQuint', 'inOutSine', 'outExpo']) curves[k] = E[k];
    Object.assign(curves, { 'outBack()': E.outBack(), 'outBack(3)': E.outBack(3), 'outElastic()': E.outElastic(), 'outElastic(6)': E.outElastic(6),
      'spring()': E.spring(), 'spring(100,8)': E.spring(100, 8), 'spring(300,40)': E.spring(300, 40), 'spring(170,60)': E.spring(170, 60),
      'steps()': E.steps(), 'steps(1)': E.steps(1), 'steps(8)': E.steps(8) });
    for (const name of M.EASES) curves['easing(' + name + ')'] = M.easing(name);
    for (const k of Object.keys(curves)) {
      const f = curves[k];
      if (!close(f(0), 0, 1e-9) || !close(f(1), 1, 1e-9)) return `${k}: f(0)=${f(0)} f(1)=${f(1)}`;
      if (!close(f(-0.5), 0, 1e-9) || !close(f(1.5), 1, 1e-9)) return `${k} does not clamp its input`;
      for (let i = 0; i <= 100; i++) if (!isFinite(f(i / 100))) return k + ' not finite at ' + i;
    }
    return true;
  });
  check('ease: in/out curves are monotone; outBack, outElastic and spring overshoot; steps step', () => {
    const mono = (f) => { let p = -1; for (let i = 0; i <= 200; i++) { const v = f(i / 200); if (v < p - 1e-12) return false; p = v; } return true; };
    for (const k of ['linear', 'inQuad', 'outQuad', 'inOutQuad', 'inCubic', 'outCubic', 'inOutCubic', 'outQuint', 'inOutQuint', 'inOutSine', 'outExpo']) if (!mono(M.ease[k])) return k + ' not monotone';
    const peak = (f) => Math.max(...Array.from({ length: 201 }, (_, i) => f(i / 200)));
    if (!(peak(M.ease.outBack()) > 1.05)) return 'outBack';
    if (!(peak(M.ease.outElastic()) > 1.05)) return 'outElastic';
    if (!(peak(M.ease.spring(170, 12)) > 1.05)) return 'spring';
    if (!mono(M.ease.spring(170, 60))) return 'an overdamped spring should not overshoot';
    const s = M.ease.steps(4);
    return s(0.3) === 0.25 && s(0.99) === 0.75 ? true : 'steps';
  });
  check('mix(), colourAt(), rgba()', () => {
    if (M.mix('#000000', '#ffffff', 0.5) !== '#808080') return M.mix('#000000', '#ffffff', 0.5);
    if (M.mix('#f00', '#00f', 0) !== '#ff0000' || M.mix('#f00', '#00f', 1) !== '#0000ff') return 'ends';
    if (M.colourAt(['#000000', '#ffffff'], 0.25) !== '#404040') return 'colourAt ' + M.colourAt(['#000000', '#ffffff'], 0.25);
    return M.rgba('#7350EE', 0.5) === 'rgba(115,80,238,0.5)' ? true : M.rgba('#7350EE', 0.5);
  });
  check('fit(): centres mark space in a box, keeping its aspect, and applies the transform', () => {
    const r = M.fit(null, 400, 200, 10);
    if (!close(r.scale, 0.18) || !close(r.ox, 110) || !close(r.oy, 10)) return JSON.stringify(r);
    const c = document.createElement('canvas').getContext('2d');
    M.fit(c, 400, 200, 10);
    const m = c.getTransform();
    return close(m.a, 0.18, 1e-6) && close(m.e, 110, 1e-6) && close(m.f, 10, 1e-6) ? true : 'transform ' + [m.a, m.e, m.f];
  });

  // --- Motion -------------------------------------------------------------------------------------
  const good = () => ({
    id: 'zz-test', name: 'Test', idea: 'A bar crosses the box.', why: 'Testing.', moments: ['load'], styles: ['a', 'b'],
    params: { duration: { default: 1000, min: 100, max: 3000, step: 50 }, size: { default: 0.5, min: 0, max: 1, step: 0.1 } },
    reduced: 'still', loop: false,
    draw(ctx, t, p, env) {
      const r = env.rng();
      ctx.fillStyle = 'rgb(' + Math.floor(r * 255) + ',0,0)';
      ctx.fillRect(t * 900, 400, 100, 200 * (p.style === 'b' ? 2 : 1));
    }
  });
  check('Motion.register(): rejects bad definitions', () => {
    const bad = [
      ['no draw', (d) => { delete d.draw; }], ['bad id', (d) => { d.id = 'Zz Test'; }], ['no idea', (d) => { d.idea = ''; }],
      ['unknown moment', (d) => { d.moments = ['lunch']; }], ['no styles', (d) => { d.styles = []; }],
      ['reduced', (d) => { d.reduced = 'blink'; }], ['loop', (d) => { d.loop = 'yes'; }],
      ['no duration', (d) => { delete d.params.duration; }], ['default out of range', (d) => { d.params.size.default = 2; }],
      ['option default', (d) => { d.params.mode = { default: 'x', options: ['y'] }; }], ['no step', (d) => { delete d.params.size.step; }],
      ['style mismatch', (d) => { d.params.style = { default: 'a', options: ['a', 'c'] }; }], ['bad param', (d) => { d.params.k = { default: {} }; }]
    ];
    for (const [name, mutate] of bad) {
      const d = good(); mutate(d);
      let threw = false; try { Motion.register(d); } catch (e) { threw = true; }
      if (!threw) return 'accepted: ' + name;
    }
    return Motion.get('zz-test') === null ? true : 'a rejected family was registered';
  });
  check('Motion.register(): accepts a good one; defaults include the shared options; duplicates throw', () => {
    const f = Motion.register(good());
    if (!Object.isFrozen(f) || !Object.isFrozen(f.params)) return 'not frozen';
    const d = Motion.defaults('zz-test');
    const want = { palette: 'logo', ribbon: true, weight: 0.75, intensity: 0.6, easing: 'outCubic', style: 'a', duration: 1000, size: 0.5 };
    for (const k of Object.keys(want)) if (d[k] !== want[k]) return `default ${k} = ${d[k]}`;
    if (!Motion.families.some((x) => x.id === 'zz-test') || Motion.get('zz-test') !== f) return 'not listed';
    if (!Motion.forMoment('load').some((x) => x.id === 'zz-test')) return 'forMoment';
    const r = Motion.resolve('zz-test', { size: 5, style: 'nope', palette: 'keep', ribbon: 'false', extra: 1 });
    if (r.size !== 1 || r.style !== 'a' || r.palette !== 'keep' || r.ribbon !== false || r.extra !== 1) return 'resolve ' + JSON.stringify(r);
    let threw = false; try { Motion.register(good()); } catch (e) { threw = true; }
    return threw ? true : 'duplicate id accepted';
  });
  const shot = (t, p, env) => {
    const c = document.createElement('canvas'); c.width = 200; c.height = 200;
    const x = c.getContext('2d', { willReadFrequently: true });
    Motion.render(x, 'zz-test', t, p, Object.assign({ w: 200, h: 200, seed: 7 }, env || {}));
    return { c, x, d: x.getImageData(0, 0, 200, 200).data };
  };
  const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  check('Motion.render(): clamps t, fills the background, restores the context, is deterministic', () => {
    if (!eq(shot(-1).d, shot(0).d) || !eq(shot(2).d, shot(1).d)) return 't not clamped';
    if (!eq(shot(0.4).d, shot(0.4).d)) return 'not deterministic (env.rng must be fresh per frame)';
    if (eq(shot(0.4).d, shot(0.4, {}, { seed: 8 }).d)) return 'the seed does not reach env.rng';
    const s = shot(0.5, {}, { theme: 'dark' });
    const corner = s.x.getImageData(1, 1, 1, 1).data;
    if (corner[0] !== 0x10 || corner[1] !== 0x0e || corner[2] !== 0x18) return 'dark background ' + Array.from(corner);
    const m = s.x.getTransform();
    if (m.a !== 1 || m.e !== 0 || m.f !== 0 || s.x.globalAlpha !== 1) return 'context not restored';
    const tr = document.createElement('canvas'); tr.width = 200; tr.height = 200;
    Motion.render(tr.getContext('2d', { willReadFrequently: true }), 'zz-test', 0.5, {}, { w: 200, h: 200, transparent: true });
    return tr.getContext('2d').getImageData(1, 1, 1, 1).data[3] === 0 ? true : 'transparent still filled';
  });
  check('Motion.render(): env.reduced plays the reduced version (still: the end frame)', () => {
    return eq(shot(0.1, {}, { reduced: true }).d, shot(1).d) ? true : 'reduced still is not the end frame';
  });
  // --- the Iterations look (23 Oct 2026) ---------------------------------------------------------
  check('look: Marks.ITERATIONS holds the twenty presets in the sheet\'s order, frozen; Motion.LOOKS; Marks.paths5s', () => {
    const I = M.ITERATIONS;
    if (!Array.isArray(I) || I.length !== 20 || !Object.isFrozen(I) || !Object.isFrozen(I[0].params)) return 'ITERATIONS';
    if (I.some((x, i) => x.n !== i + 1 || x.params.iteration !== i + 1 || x.params.look !== 'iterations' || !['cloth', 'sail', 'crystal', 'wave'].includes(x.params.fold))) return 'a preset';
    if (I[6].cell !== 'r2c2' || !/crystal/.test(I[6].label)) return 'cell 7 ' + I[6].cell + ' ' + I[6].label;
    if (Motion.LOOKS.join() !== 'classic,iterations' || !Object.isFrozen(Motion.LOOKS)) return 'LOOKS';
    return ['bar', 'body', 's', 'glass'].every((k) => /^M /.test(M.paths5s[k])) && /^M 3/.test(M.paths.bar) ? true : 'paths5s';
  });
  check('look: palette(name, theme, n) is its own palette (name~in, white ground); palette(name, theme) is untouched', () => {
    const L = M.palette('logo', 'light'), I7 = M.palette('logo', 'light', 7);
    if (L !== M.palette('logo', 'light') || L.bg !== '#FAF9FC' || L.look || L.name !== 'logo') return 'classic logo changed';
    if (I7.name !== 'logo~i7' || I7.base !== 'logo' || I7.bg !== '#FEFEFE' || !I7.look || I7.look.n !== 7 || !Object.isFrozen(I7)) return 'logo~i7 ' + I7.name + ' ' + I7.bg;
    if (M.palette('logo', 'light', 7) !== I7 || M.palette('logo', 'light', '7') !== I7) return 'not cached';
    if (M.palette('logo', 'light', 0).look.n !== 1 || M.palette('logo', 'light', 99).look.n !== 20) return 'iteration not clamped';
    if (M.palette('logo', 'dark', 7).bg !== '#100E18' || M.palette('paper', 'light', 7).bg !== '#7350EE') return 'dark / paper ground';
    if (M.palette('inverse', 'light', 7).bg !== '#100E18' || M.palette('inverse', 'dark', 7).bg !== '#FEFEFE') return 'inverse ground';
    if (!M.palette('ink', 'light', 7).look.mono || M.palette('keep', 'light', 7).body !== M.palette('keep', 'light').body) return 'ink mono / keep keeps its letters';
    const v = M.palette('logo', 'light', 1), p = M.palette('logo', 'light', 11);   // vivid 1 vs vivid 0.04
    const sat = (h) => { const c = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(...c) - Math.min(...c); };
    return sat(M.colourAt(v.body, 0.2)) > sat(M.colourAt(p.body, 0.2)) + 40 ? true : 'pastel is not paler';
  });
  check('look: points() tags make no difference outside the look (a tagged and an untagged bar draw the same pixels)', () => {
    const a = fresh(), b = fresh(), bar = M.points('bar', 100);
    M.stroke(a.x, bar, { width: M.widths.bar, colours: M.palette('logo', 'light').bar, alpha: 0.7 });
    M.stroke(b.x, bar.map((q) => q.slice()), { width: M.widths.bar, colours: M.palette('logo', 'light').bar, alpha: 0.7 });
    const da = a.c.getContext('2d').getImageData(0, 0, S, S).data, db = b.c.getContext('2d').getImageData(0, 0, S, S).data;
    return da.every((x, i) => x === db[i]) ? true : 'differ';
  });
  check('look: stroke() profile, caps and cut', () => {
    const line = M.resample([[200, 500], [800, 500]], 60);
    const f = fresh(); M.stroke(f.x, line, { width: 100, colours: ['#000', '#010101'], profile: [[0, 1], [1, 0.4]], caps: ['round', 'butt'] });
    if (px(f.c, 250, 545)[0] > 60 || px(f.c, 750, 545)[0] < 200 || px(f.c, 750, 515)[0] > 60) return 'profile';
    if (px(f.c, 160, 500)[0] > 60 || px(f.c, 812, 500)[0] < 200) return 'caps';
    const g = fresh(); M.stroke(g.x, line, { width: 100, colours: '#000', cut: [[760, 450], [700, 550]] });
    if (px(g.c, 690, 500)[0] > 60 || px(g.c, 780, 500)[0] < 200 || px(g.c, 400, 500)[0] > 60) return 'cut';
    return true;
  });
  check('look: stroke() letter hints: ignored in classic; in the look a family\'s own copy of a letter lands on it, cut and all', () => {
    // one family, four ways to draw the body: the tagged classic array; the sheet's centreline with a letter hint; that
    // hinted copy moved by its points (its blade must move with it) against the rest drawing moved by the context
    Motion.register({
      id: 'zz-letter', name: 'Letter', idea: 'A body.', why: 'Testing.', moments: ['load'], styles: ['tagged', 'hint', 'moved', 'shifted'],
      params: { duration: { default: 1000, min: 100, max: 3000, step: 50 } }, reduced: 'still', loop: false,
      draw(ctx, t, p, env) {
        const w = M.widths.body * 0.75, look = !!env.palette.look, colours = env.palette.body;
        const pts = look && p.style !== 'tagged' ? M.points(M.paths5s.body, 160) : M.points('body', 160);
        if (p.style === 'moved') { M.stroke(ctx, pts.map((q) => [q[0] + 60, q[1] - 40]), { width: w, colours, letter: 'body' }); return; }
        if (p.style === 'shifted') ctx.translate(60, -40);
        M.stroke(ctx, pts, { width: w, colours, letter: 'body' });
      }
    });
    const frame = (style, look) => { const c = document.createElement('canvas'); c.width = 240; c.height = 240; const x = c.getContext('2d', { willReadFrequently: true }); Motion.render(x, 'zz-letter', 0.5, Object.assign({ style, ribbon: false }, look ? { look: 'iterations', iteration: 1 } : {}), { w: 240, h: 240 }); return x.getImageData(0, 0, 240, 240).data; };
    const share = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]) > 24) n++; return n / (a.length / 4); };
    if (!eq(frame('tagged', false), frame('hint', false))) return 'a letter hint changed a classic frame';
    const rest = share(frame('tagged', true), frame('hint', true));
    if (rest > 0.002) return 'the hinted sheet body differs from the engine\'s own at rest on ' + (100 * rest).toFixed(2) + '%';
    const moved = share(frame('moved', true), frame('shifted', true));
    if (moved > 0.004) return 'a moved copy does not carry its blade and weight: ' + (100 * moved).toFixed(2) + '%';
    const bare = share(frame('tagged', true), frame('moved', true));
    return bare > 0.02 ? true : 'the moved copy did not move';
  });
  check('look: Marks.mark with a look palette draws the sheet\'s 5s and glass; glass() is deterministic and honours alpha and along', () => {
    const f = fresh(); M.mark(f.x, { palette: M.palette('logo', 'light', 1) });
    const tip = px(f.c, 650, 240), glass = px(f.c, 640, 650), bar = px(f.c, 470, 233);
    if (!(tip[2] > tip[0])) return 'no blade: past the cut is not glass ' + tip;   // the classic bar's round cap covers (650, 240)
    if (!(glass[2] > 150 && glass[2] > glass[0] + 50)) return 'no glass core ' + glass;
    if (!(bar[0] > 240 && bar[2] < 120)) return 'bar ' + bar;
    const g = (o) => { const c = fresh(); M.glass(c.x, 0.3, Object.assign({ iteration: 6 }, o)); return c.c.getContext('2d').getImageData(0, 0, S, S).data; };
    const a = g(), b = g(), n = g({ alpha: 0 }), h = g({ along: 0.4 });
    let same = true, ink = 0, none = 0, part = 0;
    for (let i = 0; i < a.length; i += 4) { if (a[i] !== b[i]) same = false; if (a[i] < 250) ink++; if (n[i] < 255) none++; if (h[i] < 250) part++; }
    if (!same) return 'not deterministic';
    if (none) return 'alpha 0 drew';
    return part > ink * 0.1 && part < ink * 0.8 ? true : 'along 0.4 drew ' + (part / ink).toFixed(2);
  });
  check('look: Motion.render with look: iterations draws the look; resolve passes look and iteration through', () => {
    const r = Motion.resolve('zz-test', { look: 'iterations', iteration: 7 });
    if (r.look !== 'iterations' || r.iteration !== 7 || 'look' in Motion.defaults('zz-test') || 'look' in Motion.SHARED) return 'resolve';
    const c = shot(0.5, { look: 'iterations', iteration: 7 }).x.getImageData(1, 1, 1, 1).data;
    if (c[0] !== 254 || c[1] !== 254 || c[2] !== 254) return 'ground ' + Array.from(c);
    const k = shot(0.5, { look: 'classic' }).x.getImageData(1, 1, 1, 1).data;
    return k[0] === 0xFA && k[1] === 0xF9 && k[2] === 0xFC ? true : 'classic ground ' + Array.from(k);
  });
  check('Motion.MOMENTS lists the sixteen moments of the spec', () => {
    const ids = Motion.MOMENTS.map((m) => m.id).join(',');
    return ids === 'launch,load,five-start,keep,pass,undo,turn,five-done,streak,split,bring,set-pin,tab,path,seed,empty' ? true : ids;
  });
  return out;
}

// with the families loaded: saved params replay exactly, and the look leaves no trace in a classic frame
function lookSuite(favorites) {
  const out = [];
  const check = (name, fn) => {
    try { const r = fn(); out.push(r === true ? { name, ok: true } : { name, ok: false, detail: typeof r === 'string' ? r : JSON.stringify(r) }); }
    catch (e) { out.push({ name, ok: false, detail: String(e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e) }); }
  };
  const canon = (o) => JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k]]));
  check('look: each of the 15 favorites resolves to exactly its saved params (no look key)', () => {
    if (favorites.length !== 15) return favorites.length + ' favorites';
    const bad = favorites.filter((f) => { const r = Motion.resolve(f.family, f.params); return canon(r) !== canon(f.params) || 'look' in r || 'iteration' in r; });
    return bad.length ? 'changed: ' + bad.map((f) => f.family + '/' + f.params.style).join(', ') : true;
  });
  check('look: no family\'s defaults carry look or iteration; the shared options are as before', () => {
    const bad = Motion.families.filter((f) => { const d = Motion.defaults(f.id); return 'look' in d || 'iteration' in d; }).map((f) => f.id);
    if (bad.length) return 'look in defaults: ' + bad;
    return Object.keys(Motion.SHARED).join() === 'palette,ribbon,weight,intensity,easing' ? true : 'SHARED ' + Object.keys(Motion.SHARED);
  });
  check('look: no cache leaks between looks (every family and style: classic, iterations 7 and 14, classic again, at t = 0.5 and 1)', () => {
    const S = 72, c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d', { willReadFrequently: true });
    const frame = (id, t, p) => { x.setTransform(1, 0, 0, 1, 0, 0); Motion.render(x, id, t, p, { w: S, h: S, seed: 'leak' }); return x.getImageData(0, 0, S, S).data; };
    const bad = [];
    for (const f of Motion.families) for (const style of f.styles) for (const t of [0.5, 1]) {
      frame(f.id, t, { style });   // warm up: a scratch layer's first use rasterizes slightly differently (see strip.cjs)
      const a = frame(f.id, t, { style });
      frame(f.id, t, { style, look: 'iterations', iteration: 7 }); frame(f.id, t, { style, look: 'iterations', iteration: 14, palette: 'keep' });
      const b = frame(f.id, t, { style });
      if (!a.every((v, i) => v === b[i])) bad.push(f.id + '/' + style + '@' + t);
    }
    return bad.length ? 'a classic frame changed after the look: ' + bad.join(', ') : true;
  });
  // The artist, 23 Oct 2026: "the .75 line weight is consistently the line weight the entire time from beginning to
  // end". The look's letters are the sheet's shapes at the family's line weight, so at any weight they carry about
  // the classic letters' ink (they bolded to the sheet's weight before: 1.39 times the ink at 0.75).
  const S = 240, cv = document.createElement('canvas'); cv.width = S; cv.height = S;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const inkOf = (paint) => { cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, S, S); paint(); const d = cx.getImageData(0, 0, S, S).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; };
  check('look: the letters keep the family\'s line weight (the still mark\'s ink against the classic mark\'s, weights 0.6 to 1.4)', () => {
    const bad = [];
    for (const w of [0.6, 0.75, 1, 1.4]) {
      const at = (o) => inkOf(() => { const f = Marks.fit(cx, S, S, 0.04); cx.setTransform(f.scale, 0, 0, f.scale, f.ox, f.oy); Marks.mark(cx, Object.assign({ ribbon: false, weight: w }, o)); });
      const r = at({ palette: Marks.palette('logo', 'light', 7) }) / at({});
      if (r < 0.85 || r > 1.1) bad.push('weight ' + w + ': ' + r.toFixed(2));
    }
    return bad.length ? 'the look\'s ink over classic: ' + bad.join(', ') : true;
  });
  check('look: Draw lands without a jump (the 5\'s ink just before and after it lands, every style, ribbon off)', () => {
    const bad = [];
    for (const style of Motion.get('draw').styles) {
      // transparent: the ground is opaque and would count as ink. A steady draw moves about 1% a hundredth; the old landing jumped 18%
      const ink = (t) => inkOf(() => Motion.render(cx, 'draw', t, { style, weight: 0.75, ribbon: false, look: 'iterations', iteration: 7 }, { w: S, h: S, seed: 'land', transparent: true }));
      const last = ink(1);
      let prev = ink(0), worst = 0;
      for (let i = 1; i <= 100; i++) { const n = ink(i / 100); worst = Math.max(worst, Math.abs(n - prev) / last); prev = n; }
      if (worst > 0.08) bad.push(style + ' changes ' + Math.round(worst * 100) + '% of its ink in one hundredth');
    }
    return bad.length ? bad.join('; ') : true;
  });
  return out;
}

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    await page.addScriptTag({ path: MARKS });
    const results = await page.evaluate(suite);
    const fams = fs.readdirSync(path.join(path.dirname(MARKS), 'families')).filter((f) => f.endsWith('.js') && f !== 'zz-test.js').sort();
    for (const f of fams) await page.addScriptTag({ path: path.join(path.dirname(MARKS), 'families', f) });
    const favorites = JSON.parse(fs.readFileSync(path.join(__dirname, 'favorites.json'), 'utf8')).favorites;
    results.push(...await page.evaluate(lookSuite, favorites));
    for (const r of results) {
      if (!r.ok) failed++;
      console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.name}${r.ok ? '' : '\n       ' + r.detail}`);
    }
    if (errors.length) { failed++; console.log('FAIL page errors:\n  ' + errors.join('\n  ')); }
    console.log(`\n${results.length - (failed && results.filter((r) => !r.ok).length)}/${results.length} passed` + (failed ? ' — FAILED' : ''));
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
