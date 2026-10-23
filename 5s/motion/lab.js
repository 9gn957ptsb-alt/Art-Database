/* 5s Motion Lab: the lab.
 *
 * Where the artist finds the mark's second life: every moment a person passes through in 5s, every
 * registered family that could fill it, played, scrubbed, compared, tuned, picked and handed back.
 *
 *  - Families come from the Motion registry (marks.js + families.js): whatever registers appears.
 *  - One shared requestAnimationFrame clock drives every canvas. Canvases are "players" in four
 *    groups (stage, sheet, rail, board), each with its own play state and position; a player is drawn
 *    only while it is on screen (IntersectionObserver) and its group plays, or when it changed.
 *    The stage draws every frame; the others share what is left of the frame (oldest first), so a
 *    sheet of twelve stays in sync at a lower rate and never stalls the stage or the page.
 *    When nothing plays the clock stops. Under prefers-reduced-motion nothing plays until Play.
 *  - Frames are pure functions of t (Motion.render), so the scrubber is frame-accurate.
 *  - Picks and stars are one db document `motion/picks` = {picks, stars, v: 1}, mirrored into
 *    localStorage so a view without db still works.
 *  - For you reads the favorites (one pool, every moment's stars) on the brief's descriptor axes and
 *    proposes variants like them and unlike them.
 *  - The lab runs on its own page (root = document, views in location.hash) or mounted into a host's
 *    shadow root by MotionLab.mount(host, {db}) (views kept inside, listeners on the shadow root only).
 */
(function () {
'use strict';

const doc = document;

function createLab(root, opts) {
  opts = opts || {};
  const embedded = !!opts.embedded;
  const $ = (s, r) => (r || root).querySelector(s);
  const $$ = (s, r) => Array.from((r || root).querySelectorAll(s));
  const M = window.Marks, MO = window.Motion;
  const lab = $('#lab');
  if (!lab) return null;
  if (!M || !MO) {
    lab.innerHTML = '<p style="padding:24px">The motion engine did not load (marks.js). Reload the page to try again.</p>';
    return null;
  }

  /* ============================================================== constants */

  const STORE_KEY = '5s.motion.v1';
  const UI_KEY = '5s.motion.ui.v1';
  const DOC_PATH = 'motion/picks';
  const VIEWS = ['moments', 'explore', 'board', 'foryou'];
  const GROUPS = ['stage', 'sheet', 'rail', 'board', 'foryou'];
  const LEAD = 260;          // ms of rest before a one-shot starts, when it repeats
  const HOLD = 1000;         // ms the finished mark holds before a one-shot repeats
  const FRAME = 1000 / 60;
  const BUDGET = 14;         // ms per animation frame for drawing; the stage first, the rest share what is left
  const SHARED = ['palette', 'ribbon', 'weight', 'intensity', 'easing'];
  const MOMENTS = MO.MOMENTS;
  const MOMENT = {};
  for (const m of MOMENTS) MOMENT[m.id] = m;
  const MOMENT_PALETTE = { keep: 'keep', pass: 'pass', turn: 'turn', streak: 'keep', 'five-done': 'keep', path: 'turn', undo: 'ink', tab: 'ink', empty: 'ink' };
  const EASE_POOL = ['outCubic', 'outQuint', 'inOutCubic', 'outBack', 'spring', 'outExpo', 'inOutSine', 'outElastic', 'inOutQuint'];
  const REDUCED_WORDS = {
    fade: 'the finished mark fades in, nothing moves',
    cut: 'the first frame, then the last, no motion between',
    still: 'the rest pose, held still'
  };
  const HINTS = {
    duration: 'one run, in milliseconds',
    weight: 'stroke weight',
    intensity: 'how big the gesture is',
    ribbon: 'the violet ribbon through the 5 and the s'
  };

  const reduceMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const darkMQ = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const PREFERS_REDUCED = !!(reduceMQ && reduceMQ.matches);

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const human = (k) => { const s = String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[-_]/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase(); };
  const decimals = (step) => { const s = String(step); const i = s.indexOf('.'); return i < 0 ? 0 : s.length - i - 1; };
  const snap = (x, spec) => {
    const v = Math.min(spec.max, Math.max(spec.min, spec.min + Math.round((x - spec.min) / spec.step) * spec.step));
    return parseFloat(v.toFixed(decimals(spec.step)));
  };

  function lsGet(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked: this visit only */ } }

  /* ============================================================== data: picks and stars */

  function cleanVariant(v) {
    if (!v || typeof v !== 'object' || typeof v.family !== 'string' || !v.params || typeof v.params !== 'object') return null;
    const out = { family: v.family, style: typeof v.style === 'string' ? v.style : (v.params.style || ''), params: v.params, seed: v.seed == null ? '' : String(v.seed), direction: v.direction === 'left' ? 'left' : 'right' };
    if (typeof v.note === 'string') out.note = v.note.slice(0, 160);
    if (typeof v.at === 'string') out.at = v.at;
    return out;
  }
  function cleanData(d) {
    const out = { picks: {}, stars: {}, v: 1 };
    const seenStar = new Set();
    if (!d || typeof d !== 'object') return out;
    for (const m of MOMENTS) {
      const p = d.picks && cleanVariant(d.picks[m.id]);
      if (p) out.picks[m.id] = p;
      const s = d.stars && Array.isArray(d.stars[m.id]) ? d.stars[m.id].map(cleanVariant).filter(Boolean).filter((v) => { const k = vkey(v); if (seenStar.has(k)) return false; seenStar.add(k); return true; }) : [];
      if (s.length) out.stars[m.id] = s;
    }
    return out;
  }
  // The database hands params back with their keys in another order, so a variant's key sorts them;
  // otherwise one favorite saved twice reads as two (it did: 26 stars were 15 favorites).
  const canon = (x) => JSON.stringify(x, (k, val) => (val && typeof val === 'object' && !Array.isArray(val) ? Object.keys(val).sort().reduce((o, key) => { o[key] = val[key]; return o; }, {}) : val));
  const vkey = (v) => v.family + '|' + v.seed + '|' + canon(v.params) + '|' + (v.direction || 'right');
  const sameData = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const hasAny = (d) => Object.keys(d.picks).length > 0 || Object.keys(d.stars).length > 0;

  // local picks made before the db answered are kept: per moment the later pick wins; stars are a union
  function mergeData(remote, local) {
    const out = clone(remote);
    for (const id of Object.keys(local.picks)) {
      const a = out.picks[id], b = local.picks[id];
      if (!a || String(b.at || '') > String(a.at || '')) out.picks[id] = clone(b);
    }
    for (const id of Object.keys(local.stars)) {
      const seen = new Set((out.stars[id] || []).map(vkey));
      const add = local.stars[id].filter((v) => !seen.has(vkey(v)));
      if (add.length) out.stars[id] = (out.stars[id] || []).concat(clone(add));
    }
    return out;
  }

  let data = cleanData(lsGet(STORE_KEY));

  /* ============================================================== ui state */

  const saved = lsGet(UI_KEY) || {};
  const pageDark = () => {
    const t = doc.documentElement.getAttribute('data-theme');
    if (t === 'dark') return true;
    if (t === 'light') return false;
    return !!(darkMQ && darkMQ.matches);
  };
  const ui = {
    view: 'moments',
    moment: MOMENT[saved.moment] ? saved.moment : 'launch',
    theme: saved.theme === 'dark' || saved.theme === 'light' ? saved.theme : (pageDark() ? 'dark' : 'light'),
    speed: [0.25, 0.5, 1, 2].includes(saved.speed) ? saved.speed : 1,
    loop: saved.loop !== false,
    app: saved.app === true,
    reduced: false,
    source: 'generate',
    batch: saved.batch && typeof saved.batch === 'object' ? saved.batch : {},
    forSeed: typeof saved.forSeed === 'string' ? saved.forSeed : '',
    recording: false
  };
  function saveUi() { lsSet(UI_KEY, { moment: ui.moment, theme: ui.theme, speed: ui.speed, loop: ui.loop, app: ui.app, batch: ui.batch, forSeed: ui.forSeed }); }

  /* ============================================================== variants */

  function lengthRange(m) {
    const r = /([\d.]+)\s*[–-]\s*([\d.]+)\s*s/.exec((m && m.length) || '');
    return r ? [parseFloat(r[1]) * 1000, parseFloat(r[2]) * 1000] : null;
  }
  const directionFor = (moment) => (moment === 'pass' ? 'left' : 'right');
  const famOk = (id) => !!MO.get(id);

  // a family's defaults, with the duration brought inside the moment's length
  function tuned(famId, moment) {
    const fam = MO.get(famId);
    const p = MO.defaults(famId);
    const r = lengthRange(MOMENT[moment]);
    if (r && !fam.loop) {
      const d = fam.params.duration;
      p.duration = snap(Math.min(Math.max(p.duration, r[0]), r[1]), d);
    }
    return p;
  }
  function baseVariant(moment, famId) {
    return { family: famId, params: tuned(famId, moment), seed: famId, direction: directionFor(moment) };
  }
  function defaultFamily(moment) {
    const fits = MO.forMoment(moment);
    if (fits.length) return fits[0].id;
    const all = MO.families;
    return all.length ? all[0].id : null;
  }

  // one variant, all of it drawn from its seed: the same (moment, family, seed) always gives the same variant
  function genVariant(moment, famId, seed, styleHint) {
    const fam = MO.get(famId);
    const r = M.rng('variant|' + moment + '|' + famId + '|' + seed);
    const pick = (arr) => arr[Math.min(arr.length - 1, Math.floor(r() * arr.length))];
    const p = tuned(famId, moment);
    p.style = styleHint == null ? pick(fam.styles) : fam.styles[styleHint % fam.styles.length];
    const d = fam.params.duration, rg = lengthRange(MOMENT[moment]);
    const rd = r();
    if (!fam.loop && rg && Math.max(d.min, rg[0]) <= Math.min(d.max, rg[1])) {
      const lo = Math.max(d.min, rg[0]), hi = Math.min(d.max, rg[1]);
      p.duration = snap(lo + rd * (hi - lo), d);
    } else {
      p.duration = snap(p.duration * (0.8 + 0.4 * rd), d);
    }
    p.intensity = snap(0.35 + 0.6 * r(), fam.params.intensity);
    p.weight = snap(0.85 + 0.3 * r(), fam.params.weight);
    const re = r(), easings = EASE_POOL.filter((e) => fam.params.easing.options.includes(e));
    const ee = pick(easings.length ? easings : fam.params.easing.options);
    if (re < 0.55) p.easing = ee;
    const rp = r(), mp = MOMENT_PALETTE[moment], others = M.PALETTES.filter((x) => x !== 'logo');
    const op = pick(others);
    p.palette = rp < 0.6 ? 'logo' : rp < 0.82 && mp ? mp : op;
    p.ribbon = r() < 0.85;
    for (const key of Object.keys(fam.params)) {
      if (key === 'style' || key === 'duration' || SHARED.includes(key)) continue;
      const spec = fam.params[key], roll = r(), val = r();
      if (Array.isArray(spec.options)) { if (roll < 0.45) p[key] = spec.options[Math.min(spec.options.length - 1, Math.floor(val * spec.options.length))]; }
      else if (typeof spec.default === 'number') { if (roll < 0.55) p[key] = snap(spec.min + val * (spec.max - spec.min), spec); }
      else if (typeof spec.default === 'boolean') { if (roll < 0.3) p[key] = !spec.default; }
    }
    return { family: famId, params: MO.resolve(famId, p), seed: String(seed), direction: directionFor(moment) };
  }

  function shuffle(a, r) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  const pad2 = (n) => (n < 10 ? '0' : '') + n;

  // twelve variants for a moment from a batch seed: the fitting families first (styles rotated so
  // repeats differ), then three wildcards from families made for other moments
  function batchFor(moment, B) {
    const fits = MO.forMoment(moment).map((f) => f.id);
    const others = MO.families.map((f) => f.id).filter((id) => !fits.includes(id));
    if (!fits.length && !others.length) return [];
    const r = M.rng('batch|' + moment + '|' + B);
    shuffle(fits, r); shuffle(others, r);
    const nWild = fits.length ? Math.min(3, others.length) : 12;
    const offset = {};
    for (const id of fits.concat(others)) offset[id] = Math.floor(r() * 4);
    const out = [];
    for (let i = 0; i < 12; i++) {
      let famId, rep, wild;
      if (i < 12 - nWild) { famId = fits[i % fits.length]; rep = Math.floor(i / fits.length); wild = false; }
      else { const k = i - (12 - nWild); famId = others[k % others.length]; rep = Math.floor(k / others.length); wild = true; }
      const v = genVariant(moment, famId, B + '-' + pad2(i + 1), rep + offset[famId]);
      v.wild = wild;
      out.push(v);
    }
    return out;
  }
  function newBatchSeed() {
    const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    let s = '';
    try { const a = new Uint32Array(4); crypto.getRandomValues(a); for (const x of a) s += abc[x % abc.length]; }
    catch (e) { for (let i = 0; i < 4; i++) s += abc[Math.floor(Math.random() * abc.length)]; }
    return s;
  }

  /* drafts: what is on the stage for each moment (the pick, or an edit of it, or a family's defaults) */
  const drafts = {};
  function cur() {
    let v = drafts[ui.moment];
    if (v && famOk(v.family)) return v;
    const p = data.picks[ui.moment];
    if (p && famOk(p.family)) v = { family: p.family, params: MO.resolve(p.family, p.params), seed: p.seed, direction: p.direction };
    else { const f = defaultFamily(ui.moment); v = f ? baseVariant(ui.moment, f) : null; }
    drafts[ui.moment] = v;
    return v;
  }
  const pickVariant = (moment) => {
    const p = data.picks[moment];
    return p && famOk(p.family) ? { family: p.family, params: MO.resolve(p.family, p.params), seed: p.seed, direction: p.direction } : null;
  };

  /* ============================================================== the shared clock */

  const groups = {};
  for (const g of GROUPS) groups[g] = { playing: !PREFERS_REDUCED, pos: PREFERS_REDUCED ? null : 0, cycle: LEAD + HOLD + 1000 };
  const players = new Set();
  let raf = 0, lastNow = 0, frames = 0, draws = 0;
  const shown = {};

  const io = typeof IntersectionObserver === 'function'
    ? new IntersectionObserver((entries) => {
      for (const e of entries) { const p = e.target.__player; if (p) { p.visible = e.isIntersecting; if (p.visible) p.dirty = true; } }
      wake();
    })
    : null;
  const ro = typeof ResizeObserver === 'function'
    ? new ResizeObserver((entries) => { for (const e of entries) { const p = e.target.__player; if (p) size(p); } wake(); })
    : null;

  function size(p) {
    const r = p.canvas.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    let dpr = Math.min(p.maxDpr || 2, Math.max(1, window.devicePixelRatio || 1));
    const cap = p.maxPixels ? (p.pixels || p.maxPixels) : 0;
    if (cap && w * h * dpr * dpr > cap) dpr = Math.max(p.minDpr || 1, Math.sqrt(cap / Math.max(1, w * h)));
    if (w !== p.w || h !== p.h || dpr !== p.dpr) {
      p.w = w; p.h = h; p.dpr = dpr;
      p.canvas.width = Math.max(1, Math.round(w * dpr));
      p.canvas.height = Math.max(1, Math.round(h * dpr));
      p.dirty = true;
    }
  }

  function addPlayer(canvas, group, getSpec, opts) {
    const p = Object.assign({ canvas, ctx: canvas.getContext('2d'), group, getSpec, visible: !io, dirty: true, w: 0, h: 0, dpr: 1, pad: 0.12, t: 1, drawnAt: 0 }, opts || {});
    canvas.__player = p;
    players.add(p);
    if (io) io.observe(canvas);
    if (ro) ro.observe(canvas);
    size(p);
    wake();
    return p;
  }
  function removePlayer(p) {
    players.delete(p);
    if (io) io.unobserve(p.canvas);
    if (ro) ro.unobserve(p.canvas);
    p.canvas.__player = null;
  }
  function dirtyGroup(g) { for (const p of players) if (!g || p.group === g) p.dirty = true; wake(); }

  let dead = false;          // set by unmount: nothing wakes the clock again
  function wake() { if (!raf && !dead) raf = requestAnimationFrame(tick); }

  function tick(now) {
    raf = 0;
    const dt = lastNow ? Math.min(64, Math.max(0, now - lastNow)) : 0;
    lastNow = now;
    frames++;
    for (const g of GROUPS) shown[g] = false;
    for (const p of players) if (p.visible && p.w > 0) shown[p.group] = true;
    let live = false;
    for (const g of GROUPS) {
      const G = groups[g];
      if (!G.playing || !shown[g]) continue;
      if (G.pos == null) G.pos = 0;
      G.pos += dt * (g === 'stage' ? ui.speed : 1);
      live = true;
    }
    stageStop();
    let left = false;
    const t0 = performance.now();
    const queue = [];
    for (const p of players) {
      if (!p.visible || p.w <= 0) continue;
      if (!groups[p.group].playing && !p.dirty) continue;
      // a one-shot holding its first or last frame has nothing new to draw (frames are pure functions of t)
      if (!p.dirty && !ui.recording && tOf(p) === p.t) continue;
      if (p.group === 'stage') { const c0 = performance.now(); drawPlayer(p); p.dirty = false; p.drawnAt = now; adapt(p, performance.now() - c0); }
      else queue.push(p);
    }
    // the rest, the longest-waiting first, while the frame has time (always at least one)
    queue.sort((a, b) => (a.drawnAt || 0) - (b.drawnAt || 0));
    for (let i = 0; i < queue.length; i++) {
      if (i > 0 && performance.now() - t0 > BUDGET) break;
      const p = queue[i];
      drawPlayer(p); p.dirty = false; p.drawnAt = now;
    }
    for (const p of players) if (p.dirty && p.visible && p.w > 0) left = true;
    if (shown.stage) syncTransport();
    if (live || left) raf = requestAnimationFrame(tick);
    else lastNow = 0;
  }

  // while the stage plays, its resolution follows its draw time (frames are pure, so only sharpness changes);
  // paused or scrubbed, it draws at full resolution
  function adapt(p, cost) {
    if (!p.maxPixels) return;
    const playing = groups.stage.playing;
    if (!playing) {
      if (p.pixels && p.pixels < p.maxPixels) { p.pixels = p.maxPixels; p.ema = 0; size(p); p.dirty = true; }
      return;
    }
    p.ema = p.ema ? p.ema * 0.85 + cost * 0.15 : cost;
    p.cool = (p.cool || 0) - 1;
    if (p.cool > 0) return;
    const cur = p.pixels || p.maxPixels;
    let next = cur;
    if (p.ema > 20 || p.ema < 8) next = Math.min(p.maxPixels, Math.max(p.minPixels, cur * Math.min(1.3, Math.max(0.45, 13 / p.ema))));
    if (Math.abs(next - cur) / cur > 0.05) { p.pixels = next; p.ema = 0; p.cool = 6; size(p); }
  }

  // a stage that does not loop stops at the end of its run
  function stageStop() {
    const G = groups.stage;
    if (!G.playing || ui.loop || ui.recording) return;
    const v = cur();
    if (!v) return;
    if (G.pos >= v.params.duration) { G.pos = v.params.duration; G.playing = false; renderPlayStates(); }
  }

  function stageT(v, fam) {
    const G = groups.stage;
    if (G.pos == null) return 1;
    const dur = v.params.duration;
    const looping = ui.loop || ui.recording;
    if (!looping) return clamp01(G.pos / dur);
    // a loop paused exactly on its end (] or the scrubber's far end) shows its end, not its start again
    if (fam.loop) return !G.playing && G.pos > 0 && G.pos % dur === 0 ? 1 : (G.pos % dur) / dur;
    const local = G.pos % (LEAD + dur + HOLD);
    return clamp01((local - LEAD) / dur);
  }
  function setStageT(t) {
    const v = cur(); if (!v) return;
    const fam = MO.get(v.family), dur = v.params.duration;
    t = clamp01(t);
    groups.stage.pos = (fam.loop || !ui.loop) ? t * dur : LEAD + t * dur;
    dirtyGroup('stage');
  }
  function groupT(g, p, v, fam) {
    const G = groups[g];
    if (G.pos == null) return 1;
    const dur = v.params.duration;
    if (fam.loop) return (G.pos % dur) / dur;
    const cycle = g === 'rail' ? LEAD + dur + HOLD : G.cycle;
    return clamp01(((G.pos % cycle) - LEAD) / dur);
  }
  function syncCycle(g, variants) {
    let longest = 0;
    for (const v of variants) { const f = v && MO.get(v.family); if (f && !f.loop) longest = Math.max(longest, v.params.duration); }
    groups[g].cycle = LEAD + (longest || 1000) + HOLD;
  }

  function tOf(p) {
    const spec = p.getSpec(), v = spec && spec.variant, fam = v && MO.get(v.family);
    if (!fam) return -1;
    return p.group === 'stage' ? stageT(v, fam) : groupT(p.group, p, v, fam);
  }

  const warned = new Set();
  function drawPlayer(p) {
    const ctx = p.ctx, spec = p.getSpec();
    const v = spec && spec.variant;
    const fam = v && MO.get(v.family);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (!fam) { ctx.clearRect(0, 0, p.canvas.width, p.canvas.height); p.t = -1; return; }
    const t = p.group === 'stage' ? stageT(v, fam) : groupT(p.group, p, v, fam);
    p.t = t;
    draws++;
    try {
      ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
      if (spec.app) drawApp(ctx, p.w, p.h, spec, t, p.dpr);
      else {
        MO.render(ctx, v.family, t, v.params, {
          w: p.w, h: p.h, dpr: p.dpr, theme: spec.theme, seed: v.seed, direction: v.direction,
          reduced: !!spec.reduced, pad: Math.round(Math.min(p.w, p.h) * p.pad)
        });
      }
    } catch (e) {
      const key = v.family + ':' + (e && e.message);
      if (!warned.has(key)) { warned.add(key); console.warn('[Motion Lab] ' + v.family + ' could not draw: ' + (e && e.message)); }
      ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0);
      ctx.fillStyle = M.palette('logo', spec.theme).bg;
      ctx.fillRect(0, 0, p.w, p.h);
      ctx.fillStyle = M.palette('logo', spec.theme).ink;
      ctx.font = '500 12px Figtree, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(fam.name + ' could not draw this frame', p.w / 2, p.h / 2);
    }
  }

  /* ============================================================== In the app: a phone that stages each moment */

  const APP = {
    light: { paper: '#FAF9FC', paper2: '#F1EEF6', raised: '#FFFFFF', ink: '#16131F', ink2: '#57516A', line: '#E2DEEA', lineStrong: '#8C86A0',
      ember: '#F28A3C', flare: '#E5482B', iris: '#7350EE', cobalt: '#2F6BE0', keepInk: '#C2361A', keepTint: '#FCE4D6', passInk: '#2A5FCC',
      passTint: '#E4ECFB', irisInk: '#5B3BD6', irisTint: '#EEE8FE', scrim: 'rgba(22,19,31,0.46)', bezel: '#1C1925', surround: '#ECE8F3', shadow: 'rgba(40,28,70,0.28)' },
    dark: { paper: '#100E18', paper2: '#191624', raised: '#1F1B2D', ink: '#EEEBF5', ink2: '#ABA5BD', line: '#2D2840', lineStrong: '#6E6788',
      ember: '#FF9B55', flare: '#FF6B4D', iris: '#A78BFF', cobalt: '#6C9DFF', keepInk: '#FF8A6A', keepTint: '#3A1F18', passInk: '#8DB2FF',
      passTint: '#17233D', irisInk: '#BCA8FF', irisTint: '#261D48', scrim: 'rgba(4,3,9,0.66)', bezel: '#2B2738', surround: '#07060B', shadow: 'rgba(0,0,0,0.6)' }
  };
  const WORK_A = ['#1E3A4C', '#D8CBB1', '#C4562F'];   // a Colour card's chord: three bands, 3:2:1
  const WORK_B = ['#3B2F5C', '#E7B8A5', '#8FA98B'];
  const WORK_C = ['#2F4A3A', '#C9A227', '#E9E4D8'];
  const FONT = { body: 'Figtree, ui-sans-serif, system-ui, sans-serif', display: 'Unbounded, "Arial Black", system-ui, sans-serif', mono: '"Martian Mono", ui-monospace, monospace' };
  const ease = M.ease;

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  function fillRR(c, x, y, w, h, r, fill) { rr(c, x, y, w, h, r); c.fillStyle = fill; c.fill(); }
  function strokeRR(c, x, y, w, h, r, stroke, lw, dash) {
    rr(c, x, y, w, h, r); c.strokeStyle = stroke; c.lineWidth = lw || 1.5;
    if (dash) c.setLineDash(dash);
    c.stroke(); c.setLineDash([]);
  }
  function txt(c, s, x, y, o) {
    o = o || {};
    c.save();
    c.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    c.fillStyle = o.color || '#000';
    c.font = (o.weight || 500) + ' ' + (o.size || 14) + 'px ' + FONT[o.font || 'body'];
    c.textAlign = o.align || 'left';
    c.textBaseline = o.base || 'alphabetic';
    c.fillText(s, x, y);
    c.restore();
  }
  function bar(c, x, y, w, h, colour, alpha) {
    c.save(); c.globalAlpha *= alpha == null ? 1 : alpha; fillRR(c, x, y, w, h, h / 2, colour); c.restore();
  }

  function statusBar(c, C) {
    txt(c, '9:41', 34, 31, { size: 15, weight: 600, color: C.ink });
    for (let i = 0; i < 4; i++) fillRR(c, 290 + i * 6, 25 - i * 2.5, 4, 6 + i * 2.5, 1.2, C.ink);
    strokeRR(c, 322, 18, 25, 13, 4, C.ink, 1.2);
    fillRR(c, 324.5, 20.5, 18, 8, 2, C.ink);
  }
  function brandMark(c, x, y, s) {
    const img = $('.brand-logo');
    if (img && img.complete && img.naturalWidth) {
      c.save(); rr(c, x, y, s, s, s * 0.26); c.clip(); c.drawImage(img, x, y, s, s); c.restore();
    } else {
      c.save(); c.translate(x, y); M.fit(c, s, s, 0); M.mark(c, { frame: true }); c.restore();
    }
  }
  function topBar(c, C, o) {
    o = o || {};
    brandMark(c, 16, 58, 34);
    if (o.title !== false) txt(c, o.title || "Today's five", 62, 81, { size: 16, weight: 700, color: C.ink });
    if (o.counter) txt(c, o.counter, 62, 97, { size: 11, color: C.ink2, font: 'mono', weight: 400 });
    // the Path chip
    const hot = o.path;
    rr(c, 280, 58, 94, 36, 18);
    if (hot) { c.fillStyle = C.irisTint; c.fill(); }
    c.strokeStyle = hot ? C.iris : C.lineStrong; c.lineWidth = 1.5; c.stroke();
    txt(c, 'Path', 296, 81, { size: 14, weight: 600, color: C.ink });
    txt(c, o.pathText || '3/8', 333, 81, { size: 12, color: C.ink, font: 'mono', weight: 400 });
  }
  const TABS = ['Sort', 'Split', 'Set', 'See', 'Seed'];
  function tabIcon(c, i, x, y, colour) {
    c.save(); c.strokeStyle = colour; c.fillStyle = colour; c.lineWidth = 1.7; c.lineJoin = 'round';
    if (i === 0) { strokeRR(c, x - 6.5, y - 9, 13, 15, 3, colour, 1.7); c.beginPath(); c.moveTo(x - 4, y + 9); c.lineTo(x + 4, y + 9); c.stroke(); }
    else if (i === 1) { fillRR(c, x - 8, y - 8, 7, 7, 1.6, colour); strokeRR(c, x + 1, y - 8, 7, 7, 1.6, colour, 1.6); strokeRR(c, x - 8, y + 1, 7, 7, 1.6, colour, 1.6); strokeRR(c, x + 1, y + 1, 7, 7, 3.5, colour, 1.6); }
    else if (i === 2) { c.strokeRect(x - 8.5, y - 7.5, 17, 15); c.beginPath(); c.moveTo(x - 8.5, y + 3); c.lineTo(x + 8.5, y + 3); c.stroke(); c.fillRect(x + 2, y - 4, 4, 3.4); }
    else if (i === 3) { c.beginPath(); c.arc(x - 3.5, y, 5, 0, Math.PI * 2); c.fill(); c.beginPath(); c.arc(x + 3.5, y, 5, 0, Math.PI * 2); c.stroke(); }
    else { c.beginPath(); c.moveTo(x, y - 6); c.lineTo(x + 8.2, y - 1.3); c.lineTo(x, y + 3.5); c.lineTo(x - 8.2, y - 1.3); c.closePath(); c.stroke(); c.beginPath(); c.moveTo(x - 8.2, y - 1.3); c.lineTo(x - 8.2, y + 2); c.lineTo(x, y + 7); c.lineTo(x + 8.2, y + 2); c.lineTo(x + 8.2, y - 1.3); c.stroke(); }
    c.restore();
  }
  function tabBar(c, C, active, o) {
    o = o || {};
    c.fillStyle = C.paper; c.fillRect(0, 746, 390, 98);
    c.fillStyle = C.line; c.fillRect(0, 746, 390, 1);
    if (o.indicator != null) fillRR(c, o.indicator - 30, 754, 60, 30, 15, C.irisTint);
    for (let i = 0; i < 5; i++) {
      const x = 39 + i * 78, on = i === active;
      if (o.skip !== i) tabIcon(c, i, x, 769, on ? C.ink : C.ink2);
      txt(c, TABS[i], x, 801, { size: 11, weight: on ? 700 : 500, color: on ? C.ink : C.ink2, align: 'center' });
    }
    fillRR(c, 128, 828, 134, 5, 2.5, C.ink);
  }
  function colourCard(c, C, x, y, w, h, chord, o) {
    o = o || {};
    c.save();
    c.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    if (o.shadow !== false) { c.shadowColor = C.shadow; c.shadowBlur = 18; c.shadowOffsetY = 6; }
    fillRR(c, x, y, w, h, 28, chord[0]);
    c.shadowColor = 'transparent';
    rr(c, x, y, w, h, 28); c.clip();
    c.fillStyle = chord[1]; c.fillRect(x, y + h * 0.5, w, h * (2 / 6) + 1);
    c.fillStyle = chord[2]; c.fillRect(x, y + h * (5 / 6), w, h / 6 + 1);
    c.restore();
  }
  function sortButtons(c, C, o) {
    o = o || {};
    const y = 622, h = 54;
    strokeRR(c, 24, y, 166, h, 27, C.cobalt, 2);
    c.beginPath(); c.arc(80, y + 27, 8, 0, Math.PI * 2); c.strokeStyle = C.passInk; c.lineWidth = 2; c.stroke();
    txt(c, 'Pass', 96, y + 33, { size: 17, weight: 700, color: C.passInk });
    fillRR(c, 200, y, 166, h, 27, C.ember);
    c.beginPath(); c.arc(254, y + 27, 9, 0, Math.PI * 2); c.fillStyle = '#16131F'; c.fill();
    txt(c, 'Keep', 270, y + 33, { size: 17, weight: 700, color: '#16131F' });
    if (o.dim) { c.fillStyle = C.paper; c.globalAlpha = o.dim; c.fillRect(0, y - 4, 390, h + 8); c.globalAlpha = 1; }
  }
  function scrim(c, C, a) { c.save(); c.globalAlpha = a == null ? 1 : a; c.fillStyle = C.scrim; c.fillRect(0, 0, 390, 844); c.restore(); }
  function sheetPanel(c, C, y) {
    c.save(); c.shadowColor = C.shadow; c.shadowBlur = 24;
    rr(c, 0, y, 390, 900 - y, 28); c.fillStyle = C.raised; c.fill(); c.restore();
    fillRR(c, 175, y + 10, 40, 5, 2.5, C.line);
  }
  function card(c, C, dx, rot, chord, alpha) {
    c.save();
    c.translate(195 + dx, 360); c.rotate(rot); c.translate(-195, -360);
    colourCard(c, C, 32, 120, 326, 478, chord, { alpha });
    c.restore();
  }
  const sm = (a, b, x) => M.smoothstep(a, b, x);

  // each scene draws the app around the moment and says where the mark plays: {x, y, size} in points
  const SCENES = {
    launch(c, C, t) {
      return { x: 195, y: 392, size: 230, after() { txt(c, 'Five quick judgments a day', 195, 560, { size: 15, color: C.ink2, align: 'center', alpha: sm(0.55, 1, t) }); } };
    },
    load(c, C) {
      topBar(c, C, { counter: 'Getting the deck' });
      fillRR(c, 32, 120, 326, 478, 28, C.paper2);
      strokeRR(c, 32, 120, 326, 478, 28, C.line, 1.5, [6, 6]);
      bar(c, 120, 470, 150, 9, C.line); bar(c, 145, 490, 100, 9, C.line);
      sortButtons(c, C, { dim: 0.6 });
      tabBar(c, C, 0);
      return { x: 195, y: 320, size: 170, after() { txt(c, "Getting today's five", 195, 446, { size: 15, weight: 600, color: C.ink2, align: 'center' }); } };
    },
    'five-start'(c, C, t) {
      topBar(c, C, { counter: '1 of 5' });
      colourCard(c, C, 44, 132, 302, 470, WORK_B, { alpha: 0.5, shadow: false });
      colourCard(c, C, 38, 126, 314, 474, WORK_C, { alpha: 0.75, shadow: false });
      fillRR(c, 32, 120, 326, 478, 28, C.paper);
      strokeRR(c, 32, 120, 326, 478, 28, C.lineStrong, 1.5, [7, 7]);
      // the five-second ring around the counter, waiting
      c.beginPath(); c.arc(230, 76, 15, 0, Math.PI * 2); c.strokeStyle = C.line; c.lineWidth = 3; c.stroke();
      txt(c, '1', 230, 81, { size: 13, weight: 700, color: C.ink, align: 'center' });
      sortButtons(c, C);
      tabBar(c, C, 0);
      return { x: 195, y: 358, size: 190 };
    },
    keep(c, C, t) { return SCENES.__swipe(c, C, t, 1); },
    pass(c, C, t) { return SCENES.__swipe(c, C, t, -1); },
    __swipe(c, C, t, dir) {
      topBar(c, C, { counter: '2 of 5' });
      card(c, C, 0, 0, WORK_B, 1);
      const e = ease.inCubic(t);
      card(c, C, dir * 470 * e, dir * 0.3 * e, WORK_A, 1);
      // the word on the edge it goes to (never colour alone), shown while the card is in flight
      c.save();
      c.globalAlpha = sm(0, 0.18, t) * (1 - sm(0.8, 1, t));
      if (dir > 0) { fillRR(c, 268, 140, 82, 34, 17, C.keepTint); txt(c, 'Keep', 309, 163, { size: 15, weight: 700, color: C.keepInk, align: 'center' }); }
      else { fillRR(c, 40, 140, 82, 34, 17, C.passTint); txt(c, 'Pass', 81, 163, { size: 15, weight: 700, color: C.passInk, align: 'center' }); }
      c.restore();
      sortButtons(c, C);
      tabBar(c, C, 0);
      return { x: 195, y: 360, size: 180 };
    },
    undo(c, C, t) {
      topBar(c, C, { counter: '2 of 5' });
      card(c, C, 0, 0, WORK_B, 1);
      const e = ease.outCubic(t);
      card(c, C, 470 * (1 - e), 0.3 * (1 - e), WORK_A, 1);
      // the reveal strip with Undo
      c.save(); c.shadowColor = C.shadow; c.shadowBlur = 16; fillRR(c, 16, 616, 358, 76, 18, C.raised); c.restore();
      txt(c, 'Kept: Untitled, 1968', 32, 646, { size: 14, weight: 600, color: C.ink });
      bar(c, 32, 660, 120, 8, C.line);
      strokeRR(c, 270, 634, 88, 40, 20, C.lineStrong, 1.5);
      txt(c, 'Undo', 314, 659, { size: 14, weight: 700, color: C.ink, align: 'center' });
      tabBar(c, C, 0);
      return { x: 195, y: 360, size: 180 };
    },
    turn(c, C, t) {
      topBar(c, C, { counter: '3 of 5' });
      colourCard(c, C, 32, 120, 326, 400, WORK_A, { alpha: 0.28, shadow: false });
      fillRR(c, 16, 532, 358, 196, 22, C.irisTint);
      strokeRR(c, 16, 532, 358, 196, 22, C.iris, 1.5);
      txt(c, 'A turn.', 34, 568, { size: 19, weight: 700, color: C.irisInk });
      txt(c, 'You kept this though you pass', 34, 596, { size: 15, color: C.irisInk });
      txt(c, 'most Geometric works.', 34, 618, { size: 15, color: C.irisInk });
      strokeRR(c, 34, 650, 120, 44, 22, C.iris, 1.5);
      txt(c, 'Note why', 94, 677, { size: 14, weight: 700, color: C.irisInk, align: 'center' });
      tabBar(c, C, 0);
      return { x: 195, y: 318, size: 230 };
    },
    'five-done'(c, C, t) {
      topBar(c, C, { title: 'Five sorted', counter: '5 of 5' });
      const kept = [true, false, true, true, false], chords = [WORK_A, WORK_B, WORK_C, WORK_A, WORK_C];
      for (let i = 0; i < 5; i++) {
        const x = 22 + i * 71, y = 404, a = sm(0.1 + i * 0.1, 0.5 + i * 0.1, t);
        if (kept[i]) { c.save(); rr(c, x, y, 62, 62, 12); c.clip(); c.fillStyle = chords[i][0]; c.fillRect(x, y, 62, 62); c.fillStyle = chords[i][1]; c.fillRect(x, y + 31, 62, 21); c.fillStyle = chords[i][2]; c.fillRect(x, y + 52, 62, 10); c.restore(); }
        else strokeRR(c, x + 1, y + 1, 60, 60, 12, C.lineStrong, 1.5);
        txt(c, kept[i] ? 'Kept' : 'Passed', x + 31, y + 84, { size: 12, weight: 600, color: C.ink2, align: 'center', alpha: 0.4 + 0.6 * a });
      }
      txt(c, '0:41 in all · 1 turn · 7 parts', 195, 530, { size: 14, color: C.ink2, align: 'center' });
      fillRR(c, 24, 566, 342, 52, 26, C.ink);
      txt(c, 'Another five', 195, 598, { size: 16, weight: 700, color: C.paper, align: 'center' });
      strokeRR(c, 24, 630, 342, 52, 26, C.lineStrong, 1.5);
      txt(c, 'Set what you kept', 195, 662, { size: 16, weight: 700, color: C.ink, align: 'center' });
      tabBar(c, C, 0);
      return { x: 195, y: 252, size: 200 };
    },
    streak(c, C) {
      brandMark(c, 16, 58, 34);
      txt(c, "Today's five", 62, 81, { size: 16, weight: 700, color: C.ink });
      fillRR(c, 190, 54, 184, 44, 22, C.keepTint);
      txt(c, '5 days in a row', 300, 81, { size: 14, weight: 700, color: C.keepInk, align: 'center' });
      card(c, C, 0, 0, WORK_C, 1);
      sortButtons(c, C);
      tabBar(c, C, 0);
      return { x: 212, y: 76, size: 62 };
    },
    split(c, C, t) {
      topBar(c, C, { counter: '2 of 5' });
      colourCard(c, C, 32, 120, 326, 478, WORK_A, { alpha: 0.35, shadow: false });
      sortButtons(c, C);
      tabBar(c, C, 0, { indicator: 117 });
      return {
        x: 195, y: 330, size: 190,
        after() {
          // the card's parts fly to the Split tab: three colour chips and a material word
          const parts = [WORK_A[0], WORK_A[1], WORK_A[2]];
          for (let i = 0; i < 3; i++) {
            const u = ease.inOutCubic(clamp01((t - 0.15 - i * 0.1) / 0.6));
            if (u <= 0) continue;
            const x0 = 150 + i * 45, y0 = 470, x2 = 117, y2 = 770, cx = 60 + i * 50, cy = 560;
            const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x2;
            const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y2;
            const r = 15 * (1 - 0.55 * u);
            c.save(); c.globalAlpha = 1 - sm(0.85, 1, u);
            c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = parts[i]; c.fill();
            c.strokeStyle = C.paper; c.lineWidth = 2; c.stroke(); c.restore();
          }
        }
      };
    },
    bring(c, C, t) {
      topBar(c, C, { title: 'Split', counter: 'Your database' });
      bar(c, 24, 130, 220, 10, C.line); bar(c, 24, 150, 160, 10, C.line);
      tabBar(c, C, 1);
      scrim(c, C, 1);
      sheetPanel(c, C, 236);
      txt(c, 'Bring in your own', 24, 284, { size: 19, weight: 700, color: C.ink });
      txt(c, 'Photos, screenshots, pins, saves. Private to you.', 24, 308, { size: 13, color: C.ink2 });
      fillRR(c, 24, 330, 342, 240, 20, C.paper2);
      strokeRR(c, 24, 330, 342, 240, 20, C.lineStrong, 1.5, [7, 7]);
      const chords = [WORK_B, WORK_A, WORK_C];
      for (let i = 0; i < 3; i++) {
        const x = 24 + i * 118, y = 592;
        c.save(); rr(c, x, y, 106, 74, 12); c.clip(); c.fillStyle = chords[i][0]; c.fillRect(x, y, 106, 74); c.fillStyle = chords[i][1]; c.fillRect(x, y + 37, 106, 25); c.fillStyle = chords[i][2]; c.fillRect(x, y + 62, 106, 12); c.restore();
        bar(c, x, y + 84, 106, 5, C.line);
        bar(c, x, y + 84, 106 * clamp01((t - i * 0.18) / 0.5), 5, C.iris);
      }
      fillRR(c, 24, 712, 342, 52, 26, C.ink);
      txt(c, 'Add to my database', 195, 744, { size: 16, weight: 700, color: C.paper, align: 'center' });
      return { x: 195, y: 450, size: 170 };
    },
    'set-pin'(c, C) {
      txt(c, 'Set', 24, 92, { size: 24, weight: 600, color: C.ink, font: 'display' });
      txt(c, 'Every place in the room offers three.', 24, 120, { size: 14, color: C.ink2 });
      // the room as an elevation: wall, cornice, window, a picture frame (where the mark is hung), floor
      c.save(); rr(c, 24, 142, 342, 400, 16); c.clip();
      c.fillStyle = '#D9CBB0'; c.fillRect(24, 142, 342, 400);
      c.fillStyle = '#B5532E'; c.fillRect(24, 142, 342, 20);
      c.fillStyle = '#1E3A4C'; c.fillRect(24, 438, 342, 8);
      c.fillStyle = '#6E5845'; c.beginPath(); c.moveTo(24, 446); c.lineTo(366, 446); c.lineTo(366, 542); c.lineTo(24, 542); c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 1;
      for (let i = 0; i <= 8; i++) { c.beginPath(); c.moveTo(24 + i * 42.75, 446); c.lineTo(195 + (i - 4) * 70, 542); c.stroke(); }
      fillRR(c, 44, 214, 96, 150, 4, '#2A2420');
      const sky = c.createLinearGradient(0, 220, 0, 358); sky.addColorStop(0, '#9CC3D9'); sky.addColorStop(1, '#E9D8B8');
      c.fillStyle = sky; c.fillRect(50, 220, 84, 138);
      c.fillStyle = '#2A2420'; c.fillRect(90, 220, 4, 138); c.fillRect(50, 287, 84, 4);
      c.save(); c.shadowColor = 'rgba(0,0,0,0.25)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
      fillRR(c, 178, 196, 168, 190, 3, '#2A2420'); c.restore();
      fillRR(c, 186, 204, 152, 174, 2, '#F7F5F0');
      c.restore();
      fillRR(c, 24, 566, 342, 52, 26, C.ink);
      txt(c, 'Pin this set', 195, 598, { size: 16, weight: 700, color: C.paper, align: 'center' });
      tabBar(c, C, 2);
      return { x: 262, y: 291, size: 128, bg: '#F7F5F0' };
    },
    tab(c, C, t) {
      topBar(c, C, { counter: '2 of 5' });
      card(c, C, 0, 0, WORK_C, 0.85);
      sortButtons(c, C);
      const at = 39 + 78 * ease.inOutCubic(t);
      tabBar(c, C, t < 0.5 ? 0 : 1, { indicator: at, skip: 1 });
      return { x: 117, y: 768, size: 52, soft: 0.48 };
    },
    path(c, C, t) {
      topBar(c, C, { counter: '3 of 5', path: true, pathText: '4/8' });
      card(c, C, 0, 0, WORK_B, 1);
      tabBar(c, C, 0);
      scrim(c, C, 1);
      sheetPanel(c, C, 300);
      txt(c, 'The Path', 24, 350, { size: 20, weight: 600, color: C.ink, font: 'display' });
      txt(c, '4 of 8', 366, 350, { size: 12, color: C.ink2, align: 'right', font: 'mono', weight: 400 });
      const y = 612;
      c.fillStyle = C.line; c.fillRect(46, y - 1, 298, 2);
      for (let i = 0; i < 8; i++) {
        const x = 46 + i * (298 / 7);
        c.beginPath(); c.arc(x, y, 11, 0, Math.PI * 2);
        if (i < 3) { c.fillStyle = C.iris; c.fill(); }
        else if (i === 3) { c.fillStyle = C.paper; c.fill(); c.lineWidth = 2.5; c.strokeStyle = C.ember; c.stroke(); c.beginPath(); c.arc(x, y, 11 * sm(0.4, 1, t), 0, Math.PI * 2); c.fillStyle = C.ember; c.fill(); }
        else { c.fillStyle = C.raised; c.fill(); c.lineWidth = 1.5; c.strokeStyle = C.lineStrong; c.stroke(); }
      }
      txt(c, 'Pin a set and say what it is for', 24, 668, { size: 15, weight: 600, color: C.ink });
      txt(c, 'Done', 24, 692, { size: 13, weight: 700, color: C.keepInk, alpha: sm(0.6, 1, t) });
      return { x: 195, y: 482, size: 160 };
    },
    seed(c, C, t) {
      txt(c, 'Seed', 24, 92, { size: 24, weight: 600, color: C.ink, font: 'display' });
      txt(c, '5S-4F2A-9C1E', 24, 122, { size: 13, color: C.ink2, font: 'mono', weight: 400 });
      // true isometry: 30 degrees, every axis equal
      const tw = 50, th = tw * Math.tan(Math.PI / 6), N = 6, ox = 195, oy = 420;
      const lands = ['#C4562F', '#D8CBB1', '#8FA98B', '#C9A227', '#E7B8A5'];
      const grow = ease.outCubic(clamp01(t * 1.2));
      for (let s = 0; s < 2 * N - 1; s++) {
        for (let i = 0; i < N; i++) {
          const j = s - i; if (j < 0 || j >= N) continue;
          const water = (i + j < 2) || (i === N - 1 && j > 2) || (j === N - 1 && i > 3);
          const hgt = water ? 0 : (5 + 11 * (0.5 + 0.5 * Math.sin(i * 1.7 + j * 2.3))) * grow;
          const x = ox + (i - j) * tw / 2, y = oy + (i + j) * th / 2 - hgt;
          const col = water ? C.cobalt : lands[(i * 3 + j * 5) % lands.length];
          if (hgt > 0.5) {
            c.fillStyle = M.mix(col, '#000000', 0.25); c.beginPath(); c.moveTo(x - tw / 2, y + th / 2); c.lineTo(x, y + th); c.lineTo(x, y + th + hgt); c.lineTo(x - tw / 2, y + th / 2 + hgt); c.fill();
            c.fillStyle = M.mix(col, '#000000', 0.4); c.beginPath(); c.moveTo(x + tw / 2, y + th / 2); c.lineTo(x, y + th); c.lineTo(x, y + th + hgt); c.lineTo(x + tw / 2, y + th / 2 + hgt); c.fill();
          }
          c.fillStyle = water ? M.mix(col, C.paper, 0.35) : col;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x + tw / 2, y + th / 2); c.lineTo(x, y + th); c.lineTo(x - tw / 2, y + th / 2); c.closePath(); c.fill();
          c.strokeStyle = 'rgba(0,0,0,0.12)'; c.lineWidth = 0.8; c.stroke();
        }
      }
      txt(c, 'Land: 12 surfaces you kept. Water: the colours you passed.', 195, 640, { size: 12, color: C.ink2, align: 'center' });
      tabBar(c, C, 4);
      return { x: 195, y: 300, size: 200 };
    },
    empty(c, C) {
      txt(c, 'Split', 24, 92, { size: 24, weight: 600, color: C.ink, font: 'display' });
      txt(c, 'Everything you kept, broken into its parts.', 24, 120, { size: 14, color: C.ink2 });
      strokeRR(c, 24, 146, 342, 360, 20, C.lineStrong, 1.5, [7, 7]);
      txt(c, 'Nothing here yet', 195, 418, { size: 17, weight: 700, color: C.ink, align: 'center' });
      txt(c, 'Sort your first five to fill this.', 195, 442, { size: 14, color: C.ink2, align: 'center' });
      strokeRR(c, 105, 460, 180, 40, 20, C.lineStrong, 1.5);
      txt(c, 'Bring in your own', 195, 485, { size: 14, weight: 700, color: C.ink, align: 'center' });
      strokeRR(c, 24, 528, 342, 180, 20, C.line, 1.5, [7, 7]);
      bar(c, 44, 552, 90, 9, C.line);
      tabBar(c, C, 1);
      return { x: 195, y: 290, size: 170 };
    }
  };
  const SCENE_WORDS = {
    launch: 'the splash screen, the mark alone in the middle',
    load: 'the Sort tab while the deck loads, the mark on the empty card',
    'five-start': 'the Sort tab before the first card, the mark where it will land',
    keep: 'the Sort tab, a card flying right, Keep on the right edge',
    pass: 'the Sort tab, a card flying left, Pass on the left edge',
    undo: 'the Sort tab, the card coming back, the reveal strip with Undo',
    turn: 'the Sort tab, the violet reveal strip that says A turn',
    'five-done': 'the Five sorted summary with its row of five tiles',
    streak: 'the Sort header, beside the streak',
    split: 'the Sort tab, the card\'s parts flying to the Split tab',
    bring: 'the Bring in your own sheet while images are read',
    'set-pin': 'the Set tab, hung in the picture frame of the room',
    tab: 'the tab bar, moving from Sort to Split',
    path: 'the Path sheet, a milestone reached',
    seed: 'the Seed tab, above the isometric ground',
    empty: 'an empty Split tab, inviting the first five'
  };

  let off = null;
  function drawApp(ctx, W, H, spec, t, dpr) {
    const C = APP[spec.theme] || APP.light;
    const v = spec.variant;
    ctx.fillStyle = C.surround; ctx.fillRect(0, 0, W, H);
    const k = Math.min((H * 0.92) / 868, (W * 0.92) / 414);
    const pw = 414 * k, ph = 868 * k, px = (W - pw) / 2, py = (H - ph) / 2;
    ctx.save();
    ctx.shadowColor = C.shadow; ctx.shadowBlur = 40 * k; ctx.shadowOffsetY = 14 * k;
    fillRR(ctx, px, py, pw, ph, 60 * k, C.bezel);
    ctx.restore();
    ctx.save();
    ctx.translate(px + 12 * k, py + 12 * k);
    ctx.scale(k, k);
    rr(ctx, 0, 0, 390, 844, 48); ctx.clip();
    ctx.fillStyle = C.paper; ctx.fillRect(0, 0, 390, 844);
    const scene = SCENES[spec.moment] || SCENES.empty;
    const at = scene(ctx, C, t) || { x: 195, y: 400, size: 180 };
    markAt(ctx, v, t, spec, at, k * dpr);
    if (at.after) at.after();
    statusBar(ctx, C);
    ctx.restore();
  }

  // the mark, rendered into a box twice its size and feathered at the edges so motion leaving the box fades
  function markAt(ctx, v, t, spec, at, pxPerPt) {
    const pal = M.palette(v.params.palette, spec.theme);
    if (pal.name === 'paper' || pal.name === 'inverse') {   // marks made for another ground sit on a tile of it
      fillRR(ctx, at.x - at.size * 0.56, at.y - at.size * 0.56, at.size * 1.12, at.size * 1.12, at.size * 0.26, pal.bg);
    }
    const B = at.size * 2, side = Math.max(2, Math.ceil(B * pxPerPt));
    if (!off) off = doc.createElement('canvas');
    if (off.width !== side || off.height !== side) { off.width = side; off.height = side; }
    const o = off.getContext('2d');
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'source-over';
    o.clearRect(0, 0, side, side);
    o.setTransform(pxPerPt, 0, 0, pxPerPt, 0, 0);
    MO.render(o, v.family, t, v.params, { w: B, h: B, dpr: pxPerPt, theme: spec.theme, seed: v.seed, direction: v.direction, reduced: !!spec.reduced, transparent: true, pad: (B - at.size) / 2 });
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.globalCompositeOperation = 'destination-in';
    const g = o.createRadialGradient(side / 2, side / 2, side * (at.soft || 0.36), side / 2, side / 2, side * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    o.fillStyle = g; o.fillRect(0, 0, side, side);
    o.globalCompositeOperation = 'source-over';
    ctx.drawImage(off, at.x - B / 2, at.y - B / 2, B, B);
  }

  /* ============================================================== DOM: moments rail and select */

  const els = {
    list: $('#moment-list'), select: $('#moment-select'), railCount: $('#rail-count'),
    stage: $('#stage'), stageCanvas: $('#stage-canvas'), stageNote: $('#stage-note'), stageH: $('#stage-h'), meta: $('#moment-meta'), vline: $('#variant-line'),
    play: $('#t-play'), scrub: $('#t-scrub'), time: $('#t-time'), loop: $('#t-loop'), reduced: $('#t-reduced'),
    pickStatus: $('#pick-status'), pickNote: $('#pick-note'), pickBtn: $('#pick-btn'), starStage: $('[data-act="star-stage"]'),
    famSelect: $('#family-select'), famIdea: $('#fam-idea'), famWhy: $('#fam-why'), famFacts: $('#fam-facts'), params: $('#params'),
    sheet: $('#sheet'), sheetEmpty: $('#sheet-empty'), exploreH: $('#explore-h'), exploreSub: $('#explore-sub'), batchSeed: $('#batch-seed'), starCount: $('#star-count'),
    sheetPlay: $('#sheet-play'), board: $('#board-grid'), boardPlay: $('#board-play'), pauseAll: $('#pause-all'),
    live: $('#live'), save1: $('#savestate'), save2: $('#savestate-foot'), dialog: $('#copy-dialog'), copyText: $('#copy-text'),
    pool: $('#board-pool'), poolCount: $('#pool-count'), poolEmpty: $('#pool-empty'),
    trends: $('#trends'), fyLike: $('#fy-like'), fyLikeH: $('#fy-like-h'), fyLikeSub: $('#fy-like-sub'), fyFar: $('#fy-far'), fyFarWrap: $('#fy-far-wrap'),
    fySeed: $('#fy-seed'), fyPlay: $('#foryou-play')
  };

  let liveTimer = 0;
  function say(msg) {
    els.live.textContent = '';
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { els.live.textContent = msg; }, 30);
  }

  const railPlayers = {};
  function buildRail() {
    els.list.innerHTML = MOMENTS.map((m) =>
      '<li><button type="button" class="mo" data-act="moment" data-moment="' + m.id + '">' +
      '<span class="mo-thumb"><canvas aria-hidden="true"></canvas></span>' +
      '<span class="mo-text"><span class="mo-name">' + esc(m.name) + '</span><span class="mo-feel">' + esc(m.feel) + '</span>' +
      '<span class="mo-pick"></span></span></button></li>').join('');
    els.select.innerHTML = MOMENTS.map((m) => '<option value="' + m.id + '">' + esc(m.name) + ' · ' + esc(m.feel) + '</option>').join('');
    for (const m of MOMENTS) {
      const btn = $('.mo[data-moment="' + m.id + '"]', els.list);
      railPlayers[m.id] = addPlayer($('canvas', btn), 'rail', () => ({ variant: pickVariant(m.id), theme: ui.theme }), { pad: 0.02, maxDpr: 2 });
    }
  }
  function renderRail() {
    let n = 0;
    for (const m of MOMENTS) {
      const btn = $('.mo[data-moment="' + m.id + '"]', els.list);
      const p = data.picks[m.id], ok = p && famOk(p.family);
      if (p) n++;
      btn.setAttribute('aria-current', m.id === ui.moment ? 'true' : 'false');
      $('.mo-thumb', btn).classList.toggle('empty', !ok);
      const line = $('.mo-pick', btn);
      line.className = 'mo-pick ' + (p ? 'has' : 'none');
      line.textContent = p ? (ok ? MO.get(p.family).name : p.family) + ' · ' + (p.style || '') + (ok ? '' : ' (not loaded)') : 'No pick yet';
      railPlayers[m.id].dirty = true;
    }
    els.railCount.textContent = n + ' of 16 picked';
    els.select.value = ui.moment;
    wake();
  }

  /* ============================================================== stage */

  let stagePlayer = null;
  function stageSpec() { return { variant: cur(), theme: ui.theme, reduced: ui.reduced, app: ui.app, moment: ui.moment }; }

  function describe(v, m) {
    const fam = v && MO.get(v.family);
    if (!fam) return 'No family is loaded for ' + m.name + '.';
    return m.name + ' (' + m.feel + '): ' + fam.name + ', ' + v.params.style + '. ' + fam.idea + (ui.app ? ' Shown in the app: ' + SCENE_WORDS[m.id] + '.' : '') + (ui.reduced ? ' Reduced motion: ' + REDUCED_WORDS[fam.reduced] + '.' : '');
  }

  function renderStageInfo() {
    const m = MOMENT[ui.moment], v = cur(), fam = v && MO.get(v.family);
    els.stageH.textContent = m.name;
    els.meta.innerHTML = esc(m.feel) + ' · ' + esc(m.where) + ' · <span class="len">' + esc(m.length) + '</span>';
    els.vline.innerHTML = fam
      ? '<b>' + esc(fam.name) + '</b> · ' + esc(v.params.style) + ' · ' + esc(v.params.duration) + ' ms · seed ' + esc(v.seed)
      : 'No family yet';
    els.stageCanvas.setAttribute('aria-label', describe(v, m));
    els.stage.style.background = v ? (ui.app ? APP[ui.theme].surround : M.palette(v.params.palette, ui.theme).bg) : '';
    const note = [];
    if (ui.reduced && fam) note.push('Reduced motion: ' + REDUCED_WORDS[fam.reduced]);
    if (fam && ui.app) note.push('In the app: ' + SCENE_WORDS[m.id]);
    els.stageNote.hidden = !note.length;
    els.stageNote.textContent = note.join(' · ');
    lab.dataset.app = ui.app ? 'true' : 'false';
    renderPickStatus();
    if (stagePlayer) { stagePlayer.dirty = true; wake(); }
  }

  function renderPickStatus() {
    const m = MOMENT[ui.moment], p = data.picks[ui.moment], v = cur();
    els.pickBtn.textContent = 'Use for ' + m.name;
    let html;
    if (!p) html = 'No pick yet for <b>' + esc(m.name) + '</b>.';
    else {
      const fam = MO.get(p.family), same = v && vkey(v) === vkey(Object.assign({}, p, { params: famOk(p.family) ? MO.resolve(p.family, p.params) : p.params }));
      html = (same ? 'On the stage: the pick for ' : 'Picked for ') + esc(m.name) + ': <b>' + esc(fam ? fam.name : p.family) + '</b> · ' + esc(p.style) +
        ' <span class="mono">seed ' + esc(p.seed) + '</span>' + (p.note ? ' <q>' + esc(p.note) + '</q>' : '') +
        (same ? '' : ' <button type="button" class="linkish" data-act="show-pick">Show the pick</button>') +
        ' <button type="button" class="linkish" data-act="clear-pick">Clear</button>';
    }
    els.pickStatus.innerHTML = html;
    const starred = v && isStarred(v);
    setStar(els.starStage, starred);
  }
  function setStar(btn, on) {
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const use = $('use', btn);
    if (use) use.setAttribute('href', on ? '#i-star-on' : '#i-star');
    const label = $('span', btn);
    if (label) label.textContent = on ? 'Starred' : 'Star';
  }

  function syncTransport() {
    const v = cur(); if (!v) return;
    const fam = MO.get(v.family); if (!fam) return;
    const t = stageT(v, fam);
    if (root.activeElement !== els.scrub || !scrubbing) els.scrub.value = String(Math.round(t * 1000));
    const s = (t * v.params.duration / 1000).toFixed(2), total = (v.params.duration / 1000).toFixed(2);
    const text = s + ' / ' + total + ' s';
    if (els.time.textContent !== text) els.time.textContent = text;
    els.scrub.setAttribute('aria-valuetext', s + ' of ' + total + ' seconds');
  }

  function renderPlayStates() {
    const st = groups.stage.playing;
    els.play.setAttribute('aria-label', st ? 'Pause' : 'Play');
    $('use', els.play).setAttribute('href', st ? '#i-pause' : '#i-play');
    for (const [btn, g] of [[els.sheetPlay, 'sheet'], [els.boardPlay, 'board'], [els.fyPlay, 'foryou']]) {
      const on = groups[g].playing;
      $('use', btn).setAttribute('href', on ? '#i-pause' : '#i-play');
      $('span', btn).textContent = on ? 'Pause' : 'Play';
    }
    const any = GROUPS.some((g) => groups[g].playing);
    $('use', els.pauseAll).setAttribute('href', any ? '#i-pause' : '#i-play');
    $('span', els.pauseAll).textContent = any ? 'Pause all' : 'Play all';
    lab.dataset.playing = any ? 'true' : 'false';
  }
  function renderToggles() {
    for (const b of $$('[data-act="speed"]')) b.setAttribute('aria-pressed', String(parseFloat(b.dataset.value) === ui.speed));
    for (const b of $$('[data-act="theme"]')) b.setAttribute('aria-pressed', String(b.dataset.value === ui.theme));
    for (const b of $$('[data-act="app"]')) b.setAttribute('aria-pressed', String((b.dataset.value === 'app') === ui.app));
    for (const b of $$('[data-act="source"]')) b.setAttribute('aria-pressed', String(b.dataset.value === ui.source));
    els.loop.setAttribute('aria-checked', String(ui.loop));
    els.reduced.setAttribute('aria-checked', String(ui.reduced));
  }

  function setPlaying(g, on) {
    const G = groups[g];
    if (on && G.pos == null) G.pos = 0;
    if (on && g === 'stage' && !ui.loop) {
      const v = cur();
      if (v && G.pos >= v.params.duration) G.pos = 0;
    }
    G.playing = on;
    renderPlayStates();
    dirtyGroup(g);
  }

  /* ============================================================== panel: family and parameters */

  function buildFamilySelect() {
    const fits = MO.forMoment(ui.moment), rest = MO.families.filter((f) => !fits.includes(f));
    const opt = (f) => '<option value="' + f.id + '">' + esc(f.name) + '</option>';
    let html = '';
    if (fits.length) html += '<optgroup label="Made for ' + esc(MOMENT[ui.moment].name) + '">' + fits.map(opt).join('') + '</optgroup>';
    if (rest.length) html += '<optgroup label="' + (fits.length ? 'Other families' : 'Every family') + '">' + rest.map(opt).join('') + '</optgroup>';
    els.famSelect.innerHTML = html;
    const v = cur();
    if (v) els.famSelect.value = v.family;
  }

  function paletteSwatch(name) {
    const pal = M.palette(name, ui.theme);
    const stops = (pal.five || []).map((s) => (Array.isArray(s) ? s[1] : s));
    const g = stops.length > 1 ? 'linear-gradient(135deg,' + stops.join(',') + ')' : stops[0];
    const bg = pal.bg;
    return 'background:' + (name === 'paper' || name === 'inverse' ? 'radial-gradient(circle at 50% 50%,' + (stops[0] || '#fff') + ' 34%,' + bg + ' 36%)' : g);
  }

  function paramControl(key, spec, value, fam) {
    const id = 'p-' + key;
    const hint = HINTS[key] ? '<span class="hint">' + esc(key === 'duration' && fam.loop ? 'one loop, in milliseconds' : HINTS[key]) + '</span>' : '';
    if (Array.isArray(spec.options)) {
      if (key === 'easing') {
        return '<div class="param" data-key="easing"><label for="' + id + '">Easing</label><output class="mono" id="o-easing">' + esc(value) + '</output>' +
          '<div class="easing-row"><select class="select" id="' + id + '" data-param="easing">' + spec.options.map((o) => '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' +
          '<canvas class="curve" id="curve" width="168" height="104" role="img" aria-label="The ' + esc(value) + ' curve"></canvas></div></div>';
      }
      if (key === 'palette') {
        return '<div class="param" data-key="palette"><span class="plabel" id="l-palette">Palette</span><output class="mono" id="o-palette">' + esc(value) + '</output>' +
          '<div class="swatches" role="group" aria-labelledby="l-palette">' + spec.options.map((o) =>
            '<button type="button" class="swatch" data-act="palette" data-value="' + esc(o) + '" aria-pressed="' + (o === value) + '" aria-label="' + esc(o) + '" title="' + esc(o) + '"><span style="' + paletteSwatch(o) + '"></span></button>').join('') + '</div></div>';
      }
      const short = spec.options.length <= 4 && spec.options.every((o) => String(o).length <= 12);
      if (short) {
        return '<div class="param" data-key="' + esc(key) + '"><span class="plabel" id="l-' + esc(key) + '">' + esc(human(key)) + '</span>' +
          '<div class="seg" role="group" aria-labelledby="l-' + esc(key) + '" style="--cols:' + (spec.options.length === 4 ? 2 : spec.options.length) + '">' + spec.options.map((o) =>
            '<button type="button" data-act="opt" data-key="' + esc(key) + '" data-value="' + esc(o) + '" aria-pressed="' + (o === value) + '">' + esc(o) + '</button>').join('') + '</div>' + hint + '</div>';
      }
      return '<div class="param" data-key="' + esc(key) + '"><label for="' + id + '">' + esc(human(key)) + '</label><span></span>' +
        '<select class="select" id="' + id + '" data-param="' + esc(key) + '">' + spec.options.map((o) => '<option' + (o === value ? ' selected' : '') + '>' + esc(o) + '</option>').join('') + '</select>' + hint + '</div>';
    }
    if (typeof spec.default === 'boolean') {
      return '<div class="param" data-key="' + esc(key) + '"><span class="plabel" id="l-' + esc(key) + '">' + esc(human(key)) + '</span>' +
        '<button type="button" class="toggle" role="switch" id="' + id + '" data-act="bool" data-key="' + esc(key) + '" aria-checked="' + (!!value) + '" aria-labelledby="l-' + esc(key) + '"><span class="knob" aria-hidden="true"></span><span class="tv">' + (value ? 'On' : 'Off') + '</span></button>' + hint + '</div>';
    }
    const unit = key === 'duration' ? ' ms' : '';
    return '<div class="param" data-key="' + esc(key) + '"><label for="' + id + '">' + esc(human(key)) + '</label>' +
      '<output class="mono" id="o-' + esc(key) + '" for="' + id + '">' + esc(fmt(value, spec)) + unit + '</output>' +
      '<input type="range" id="' + id + '" data-param="' + esc(key) + '" min="' + spec.min + '" max="' + spec.max + '" step="' + spec.step + '" value="' + value + '">' + hint + '</div>';
  }
  const fmt = (v, spec) => Number(v).toFixed(decimals(spec.step));

  function buildPanel() {
    buildFamilySelect();
    const v = cur();
    const fam = v && MO.get(v.family);
    if (!fam) {
      els.famIdea.textContent = 'No motion families are loaded yet.';
      els.famWhy.textContent = ''; els.famFacts.textContent = ''; els.params.innerHTML = '';
      return;
    }
    els.famIdea.textContent = fam.idea;
    els.famWhy.textContent = fam.why;
    els.famFacts.textContent = 'Made for ' + fam.moments.map((id) => MOMENT[id] ? MOMENT[id].name : id).join(', ') + ' · ' + (fam.loop ? 'a loop' : 'one shot') + ' · reduced motion: ' + fam.reduced;
    const own = Object.keys(fam.params).filter((k) => k !== 'style' && k !== 'duration' && !SHARED.includes(k));
    let html = '<div class="group"><p class="group-h">' + esc(fam.name) + '<button type="button" class="btn btn-quiet" data-act="reset"><svg class="ic" aria-hidden="true"><use href="#i-reset"/></svg>Defaults</button></p>';
    html += paramControl('style', fam.params.style, v.params.style, fam);
    html += paramControl('duration', fam.params.duration, v.params.duration, fam);
    for (const k of own) html += paramControl(k, fam.params[k], v.params[k], fam);
    html += '</div><div class="group"><p class="group-h">Shared</p>';
    html += paramControl('palette', fam.params.palette, v.params.palette, fam);
    html += paramControl('ribbon', fam.params.ribbon, v.params.ribbon, fam);
    html += paramControl('weight', fam.params.weight, v.params.weight, fam);
    html += paramControl('intensity', fam.params.intensity, v.params.intensity, fam);
    html += paramControl('easing', fam.params.easing, v.params.easing, fam);
    html += '<div class="param"><span class="plabel" id="l-dir">Direction</span><div class="seg" role="group" aria-labelledby="l-dir" style="--cols:2">' +
      '<button type="button" data-act="direction" data-value="left" aria-pressed="' + (v.direction === 'left') + '">Left (pass)</button>' +
      '<button type="button" data-act="direction" data-value="right" aria-pressed="' + (v.direction !== 'left') + '">Right (keep)</button></div></div>';
    html += '<div class="param"><label for="p-seed">Seed</label><span></span><div class="seed-row"><input type="text" class="input" id="p-seed" maxlength="24" value="' + esc(v.seed) + '" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="icon-btn" data-act="new-seed" aria-label="New seed" title="New seed"><svg class="ic" aria-hidden="true"><use href="#i-dice"/></svg></button></div><span class="hint">same seed, same frames</span></div>';
    html += '</div>';
    els.params.innerHTML = html;
    drawCurve();
  }

  function drawCurve() {
    const cv = $('#curve'); if (!cv) return;
    const v = cur(); if (!v) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height;
    const cs = getComputedStyle(lab);
    const ink = cs.getPropertyValue('--ink-3').trim() || '#888', iris = cs.getPropertyValue('--iris').trim() || '#7350EE', line = cs.getPropertyValue('--line').trim() || '#ddd';
    c.clearRect(0, 0, W, H);
    const f = M.easing(v.params.easing);
    const x0 = 14, x1 = W - 14, yb = H - 22, yt = 22;   // y = 0 at yb, y = 1 at yt; room above and below for overshoot
    c.strokeStyle = line; c.lineWidth = 2;
    c.beginPath(); c.moveTo(x0, yb); c.lineTo(x1, yb); c.moveTo(x0, yt); c.lineTo(x1, yt); c.stroke();
    c.strokeStyle = iris; c.lineWidth = 4; c.lineJoin = 'round'; c.beginPath();
    for (let i = 0; i <= 80; i++) { const u = i / 80, y = f(u); const X = x0 + u * (x1 - x0), Y = yb - y * (yb - yt); if (i) c.lineTo(X, Y); else c.moveTo(X, Y); }
    c.stroke();
    c.fillStyle = ink;
    for (const [x, y] of [[x0, yb], [x1, yt]]) { c.beginPath(); c.arc(x, y, 4, 0, Math.PI * 2); c.fill(); }
    cv.setAttribute('aria-label', 'The ' + v.params.easing + ' curve');
  }

  function setParam(key, value, opts) {
    const v = cur(); if (!v) return;
    const next = Object.assign({}, v.params, { [key]: value });
    v.params = MO.resolve(v.family, next);
    if (key === 'easing') { drawCurve(); const o = $('#o-easing'); if (o) o.textContent = v.params.easing; }
    if (key === 'palette') { for (const b of $$('[data-act="palette"]')) b.setAttribute('aria-pressed', String(b.dataset.value === v.params.palette)); const o = $('#o-palette'); if (o) o.textContent = v.params.palette; }
    if (!(opts && opts.quiet)) renderStageInfo();
    dirtyGroup('stage');
  }

  function setFamily(famId) {
    if (!famOk(famId)) return;
    const old = cur();
    const v = baseVariant(ui.moment, famId);
    if (old) { v.seed = old.seed === old.family ? famId : old.seed; v.direction = old.direction; }
    drafts[ui.moment] = v;
    buildPanel();
    renderStageInfo();
    restartStage();
  }

  function restartStage() {
    const G = groups.stage;
    G.pos = G.playing ? 0 : null;
    dirtyGroup('stage');
  }

  function loadVariant(v, how) {
    drafts[ui.moment] = { family: v.family, params: MO.resolve(v.family, v.params), seed: String(v.seed), direction: v.direction === 'left' ? 'left' : 'right' };
    buildPanel();
    renderStageInfo();
    restartStage();
    if (how) say(how);
  }

  function selectMoment(id, opts) {
    if (!MOMENT[id]) return;
    ui.moment = id;
    saveUi();
    const p = data.picks[id];
    els.pickNote.value = p && p.note ? p.note : '';
    buildPanel();
    renderStageInfo();
    renderRail();
    restartStage();
    if (ui.view === 'explore') buildSheet();
    if (opts && opts.announce) say(MOMENT[id].name + ': ' + MOMENT[id].feel);
  }

  /* ============================================================== picks and stars */

  function variantRecord(v) {
    return { family: v.family, style: v.params.style, params: clone(v.params), seed: String(v.seed), direction: v.direction };
  }
  function change(fn) {
    fn(data);
    lsSet(STORE_KEY, data);
    queueSave();
    renderRail();
    renderPickStatus();
    renderStarCount();
    if (ui.view === 'board') buildBoard();
    liveForYou(false);
    setSaveState();
  }
  function pickNow() {
    const v = cur(); if (!v) return;
    const fam = MO.get(v.family), m = MOMENT[ui.moment];
    const note = els.pickNote.value.trim().slice(0, 120);
    change((d) => { d.picks[ui.moment] = Object.assign(variantRecord(v), { note, at: new Date().toISOString() }); });
    say('Picked ' + fam.name + ' for ' + m.name);
  }
  // Favorites are one pool, used anywhere in 5s: a star made on any moment shows on every moment, and
  // unstarring takes it out of the pool wherever it was found. Each star still records the moment it
  // was found on (stars stay keyed by moment, so the saved shape is unchanged).
  function toggleStar(v, moment) {
    const key = vkey(v);
    const was = isStarred(v);
    change((d) => {
      if (was) {
        for (const m of Object.keys(d.stars)) {
          const list = d.stars[m].filter((s) => vkey(s) !== key);
          if (list.length) d.stars[m] = list; else delete d.stars[m];
        }
      } else {
        const list = d.stars[moment] || [];
        list.unshift(Object.assign(variantRecord(v), { at: new Date().toISOString() }));
        d.stars[moment] = list;
      }
    });
    say((was ? 'Unstarred ' : 'Starred ') + MO.get(v.family).name + ' · ' + v.params.style + (was ? '' : ': a favorite, used anywhere in 5s'));
    return !was;
  }
  function allStars() {
    const seen = new Set(), out = [];
    for (const m of Object.keys(data.stars)) for (const s of data.stars[m]) { const k = vkey(s); if (!seen.has(k)) { seen.add(k); out.push(Object.assign({ found: m }, s)); } }
    return out.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));
  }
  function isStarred(v) { const k = vkey(v); return Object.keys(data.stars).some((m) => data.stars[m].some((s) => vkey(s) === k)); }
  function renderStarCount() { els.starCount.textContent = String(allStars().length); }

  /* ============================================================== explore: the contact sheet */

  let sheetVariants = [];
  let sheetPlayers = [];
  function buildSheet() {
    for (const p of sheetPlayers) removePlayer(p);
    sheetPlayers = [];
    const m = MOMENT[ui.moment];
    els.exploreH.textContent = 'Explore: ' + m.name;
    if (!ui.batch[ui.moment]) { ui.batch[ui.moment] = newBatchSeed(); saveUi(); }
    els.batchSeed.value = ui.batch[ui.moment];
    const fits = MO.forMoment(ui.moment);
    let list;
    if (ui.source === 'all') {
      const all = fits.concat(MO.families.filter((f) => !fits.includes(f)));
      list = all.map((f) => Object.assign(baseVariant(ui.moment, f.id), { wild: !fits.includes(f) }));
      els.exploreSub.textContent = 'One of every family, at its defaults, for ' + m.name + ' (' + m.feel + '). ' + (fits.length ? 'Families made for other moments are marked Wildcard.' : 'No family was made for this moment yet: every one is a wildcard.');
    } else if (ui.source === 'starred') {
      list = allStars().filter((s) => famOk(s.family)).map((s) => ({ family: s.family, params: MO.resolve(s.family, s.params), seed: s.seed, direction: s.direction, wild: !fits.some((f) => f.id === s.family) }));
      els.exploreSub.textContent = 'All your favorites, from every moment, newest first. They are the ones 5s will use, anywhere.';
    } else {
      list = batchFor(ui.moment, ui.batch[ui.moment]);
      els.exploreSub.textContent = 'Twelve variants for ' + m.name + ' (' + m.feel + ') from seed ' + ui.batch[ui.moment] + ': ' + (fits.length ? 'nine from the families made for it and three wildcards.' : 'no family was made for this moment yet, so all twelve are wildcards.') + ' All play on one clock.';
    }
    sheetVariants = list;
    syncCycle('sheet', list);
    els.sheetEmpty.hidden = list.length > 0;
    if (!list.length) els.sheetEmpty.textContent = ui.source === 'starred' ? 'No favorites yet. Star a variant in the sheet or on the stage and it will wait here, whatever moment you are on.' : 'No motion families are loaded yet.';
    els.sheet.innerHTML = list.map((v, i) => {
      const fam = MO.get(v.family);
      return '<li class="cell">' +
        '<button type="button" class="cell-load" data-act="load" data-i="' + i + '" aria-label="Load into the stage: ' + esc(fam.name) + ', ' + esc(v.params.style) + ', seed ' + esc(v.seed) + (v.wild ? ', a wildcard' : '') + '. ' + esc(fam.idea) + '"><canvas aria-hidden="true"></canvas>' + (v.wild ? '<span class="wild" aria-hidden="true">Wildcard</span>' : '') + '</button>' +
        '<div class="cell-meta"><p class="cell-name">' + esc(fam.name) + ' <span class="style">· ' + esc(v.params.style) + '</span></p>' +
        '<button type="button" class="cell-star" data-act="star" data-i="' + i + '" aria-pressed="false" aria-label="Star ' + esc(fam.name) + ', ' + esc(v.params.style) + ', seed ' + esc(v.seed) + '"><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg></button>' +
        '<p class="cell-seed"><span>' + esc(v.seed) + '</span><span>' + esc(v.params.duration) + ' ms</span></p></div></li>';
    }).join('');
    $$('.cell', els.sheet).forEach((li, i) => {
      sheetPlayers.push(addPlayer($('canvas', li), 'sheet', () => ({ variant: sheetVariants[i], theme: ui.theme }), { pad: 0.1, maxDpr: 1.5 }));
      setStar($('.cell-star', li), isStarred(list[i]));
    });
    groups.sheet.pos = groups.sheet.playing ? 0 : null;
    renderStarCount();
    renderToggles();
  }

  /* ============================================================== board */

  let boardPlayers = [];
  function buildBoard() {
    for (const p of boardPlayers) removePlayer(p);
    boardPlayers = [];
    const vs = MOMENTS.map((m) => pickVariant(m.id));
    // a moment with no pick shows what its stage holds, faintly, so the system has a shape before anything is picked
    const ghosts = MOMENTS.map((m, i) => {
      if (vs[i]) return null;
      const d = drafts[m.id], f = defaultFamily(m.id);
      return d && famOk(d.family) ? d : f ? baseVariant(m.id, f) : null;
    });
    const shownV = vs.map((v, i) => v || ghosts[i]);
    // the pool first: every favorite, which 5s uses at any moment
    const pool = allStars().filter((s) => famOk(s.family)).map((s) => ({ v: { family: s.family, params: MO.resolve(s.family, s.params), seed: s.seed, direction: s.direction }, why: MOMENT[s.found] ? 'Starred on ' + MOMENT[s.found].name : '' }));
    els.poolCount.textContent = String(pool.length);
    els.poolEmpty.hidden = pool.length > 0;
    boardPlayers = fyCells(els.pool, 'pool', pool, 'board');
    syncCycle('board', shownV.filter(Boolean).concat(pool.map((c) => c.v)));
    els.board.innerHTML = MOMENTS.map((m, i) => {
      const p = data.picks[m.id], v = vs[i], fam = v && MO.get(v.family), g = ghosts[i], gf = g && MO.get(g.family);
      const label = fam ? 'Open ' + m.name + ' on the stage: ' + fam.name + ', ' + v.params.style + ', ' + v.params.duration + ' ms, seed ' + v.seed + '. ' + fam.idea
        : 'No pick yet for ' + m.name + (gf ? '; its stage holds ' + gf.name + '. ' + gf.idea : '') + ' Open it to choose.';
      return '<li class="bcell"><button type="button" class="bcell-open' + (fam ? '' : ' empty') + '" data-act="open-moment" data-moment="' + m.id + '" aria-label="' + esc(label) + '">' +
        '<canvas aria-hidden="true"></canvas></button>' +
        '<div class="bcell-text"><p class="bcell-moment">' + esc(m.name) + '</p><p class="bcell-feel">' + esc(m.feel) + ' · <span class="nowrap">' + esc(m.length) + '</span></p>' +
        (p ? '' : '<p class="bcell-none">No pick yet' + (gf ? ' <span class="mono">· ' + esc(gf.name) + '</span>' : '') + '</p>') +
        (p ? '<p class="bcell-fam" title="' + esc((p.params && p.params.duration) + ' ms · seed ' + p.seed) + '">' + esc(fam ? fam.name : p.family) + ' · ' + esc(p.style) + '</p>' : '') +
        (p && p.note ? '<p class="bcell-note">' + esc(p.note) + '</p>' : '') + '</div></li>';
    }).join('');
    $$('.bcell', els.board).forEach((li, i) => {
      if (shownV[i]) boardPlayers.push(addPlayer($('canvas', li), 'board', () => ({ variant: shownV[i], theme: ui.theme }), { pad: 0.1, maxDpr: 1.5 }));
    });
    groups.board.pos = groups.board.playing ? 0 : null;
  }

  /* ============================================================== for you: the favorites read, and what they suggest */

  // The descriptor axes of 5s/handoff/motion-brief.json, each value as a phrase that follows "Most of them",
  // and every family's value on each axis, in the axes' order. A family missing here still works: it
  // counts as halfway on every axis (and its favorites are left out of the axis counts).
  const AXES = [
    ['space', 'Where', { 'in-place': "stay inside the mark's own footprint", travel: 'send the mark away and bring it back', field: 'fill the whole frame around the mark' }],
    ['time', 'Time', { trace: 'show several instants of the mark at once', sequence: 'step through states one at a time', single: 'are one body in one gesture' }],
    ['change', 'Change', { transform: 'turn one shape into another', multiply: 'multiply the mark, then resolve into one', build: 'make the mark', break: 'take it apart and back', reveal: 'uncover, fill or light it where it stands', move: 'move it with its shape intact', modulate: 'change only its light, scale or surround', impact: 'hit' }],
    ['texture', 'Texture', { line: 'are made of outlines', solid: 'are full-weight flat bodies', particle: 'are made of specks', paper: 'are cards and die-cut layers', light: 'are glow and shadow', liquid: 'pour and melt' }],
    ['energy', 'Energy', { calm: 'are calm', lively: 'are lively', explosive: 'are explosive' }],
    ['rhythm', 'Rhythm', { beats: 'count in beats', continuous: 'move in one smooth curve', snap: 'hit once, then settle' }],
    ['dimension', 'Depth', { flat: 'are flat', layered: 'overlap and stack', volume: 'have real depth' }],
    ['actor', 'Who moves', { whole: 'move the mark as one', letters: 'move the 5 and the s separately', parts: 'move its pieces', copies: 'multiply it into copies', surround: 'move what is around the letters' }],
    ['arc', 'Ends', { return: 'start and end on the still mark', arrive: 'arrive and end on the still mark', stage: 'end on their own staging' }]
  ];
  const TAGS = {
    swipe: 'travel single move solid lively snap flat whole return',
    pulse: 'in-place single modulate light calm continuous flat whole return',
    fill: 'in-place single reveal liquid calm continuous flat whole arrive',
    negative: 'field single reveal paper lively continuous layered surround arrive',
    rewind: 'travel trace move line lively continuous flat copies arrive',
    flip: 'in-place single move solid lively continuous volume whole return',
    draw: 'in-place single build line calm continuous flat letters arrive',
    count: 'in-place sequence transform solid lively beats flat letters return',
    ring: 'in-place single transform line lively continuous flat parts return',
    stack: 'in-place sequence build paper lively beats layered parts arrive',
    echo: 'in-place trace multiply line lively beats layered copies arrive',
    path: 'field sequence move particle calm beats flat whole stage',
    split: 'travel single break particle explosive continuous flat parts return',
    collage: 'in-place sequence build paper lively beats layered parts stage',
    morph: 'in-place single transform solid lively continuous flat letters return',
    three: 'travel single multiply solid lively continuous flat copies return',
    pin: 'field single move paper lively continuous layered whole stage',
    grow: 'field single build solid lively continuous volume whole arrive',
    ribbon: 'in-place single modulate light calm continuous layered surround return',
    phases: 'in-place trace transform paper lively beats layered copies return',
    stamp: 'in-place single impact paper explosive snap volume whole return',
    dive: 'field single move solid explosive continuous volume whole return',
    neon: 'field single reveal light lively beats flat whole arrive',
    tiles: 'field sequence reveal paper lively continuous layered parts arrive',
    swarm: 'field single break particle explosive continuous flat parts return',
    cast: 'field single modulate light calm continuous volume surround return'
  };
  // the styles refined from the favorites' trends (the brief's refinements); Phases is the hybrid of both
  const REFINED = ['echo/extrude', 'echo/strata', 'echo/riso', 'rewind/boomerang', 'rewind/spool', 'count/tally', 'count/dial', 'morph/revolve', 'morph/doubles', 'morph/shell'];
  const tagsOf = (id) => (TAGS[id] ? TAGS[id].split(' ') : null);
  const styleOf = (f) => f.style || (f.params && f.params.style) || '';
  const famName = (id) => (MO.get(id) ? MO.get(id).name : id);
  const tally = (list, f) => { const m = new Map(); for (const x of list) { const k = f(x); m.set(k, (m.get(k) || 0) + 1); } return Array.from(m).sort((a, b) => b[1] - a[1]); };
  const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null; };
  const andList = (xs) => (xs.length > 1 ? xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1] : xs[0] || '');

  // how many favorites take each value on each axis
  function profile(pool) {
    const prof = AXES.map(() => ({}));
    let n = 0;
    for (const f of pool) { const t = tagsOf(f.family); if (!t) continue; n++; t.forEach((v, i) => { prof[i][v] = (prof[i][v] || 0) + 1; }); }
    return { prof, n };
  }
  // 0..1: on average over the axes, the share of the favorites that agree with this family
  function affinity(id, P) {
    const t = tagsOf(id);
    if (!t || !P.n) return 0.5;
    return t.reduce((s, v, i) => s + (P.prof[i][v] || 0) / P.n, 0) / t.length;
  }
  // the pool's leanings on the shared options, given to the variants made for it
  function leanings(pool) {
    const nums = (k) => pool.map((f) => f.params && f.params[k]).filter((x) => typeof x === 'number');
    const top = (k) => { const t = tally(pool.filter((f) => f.params && f.params[k] != null), (f) => f.params[k]); return t.length ? t[0][0] : null; };
    return { intensity: median(nums('intensity')), weight: median(nums('weight')), palette: top('palette'), ribbon: top('ribbon') };
  }
  function leaned(id, style, L, seed) {
    const p = Object.assign(MO.defaults(id), { style });
    for (const k of ['intensity', 'weight', 'palette', 'ribbon']) if (L[k] != null) p[k] = L[k];
    return { family: id, params: MO.resolve(id, p), seed: String(seed), direction: 'right' };
  }
  // a favorite retuned: its family and style, its params nudged by the seed, and another tempo
  // (the favorites' durations follow the moments they were starred on, so tempo is not read as taste)
  function retune(f, seed) {
    const fam = MO.get(f.family), r = M.rng('retune|' + seed);
    const p = MO.resolve(f.family, f.params);
    for (const key of Object.keys(fam.params)) {
      const spec = fam.params[key];
      if (key === 'style' || key === 'palette' || key === 'ribbon') continue;
      const roll = r(), val = r();
      if (key === 'duration') { const lo = Math.max(spec.min, 400), hi = Math.min(spec.max, 2000); if (lo <= hi) p.duration = snap(lo + val * (hi - lo), spec); }
      else if (Array.isArray(spec.options)) { const o = key === 'easing' ? EASE_POOL.filter((e) => spec.options.includes(e)) : spec.options; if (roll < 0.3 && o.length) p[key] = o[Math.floor(val * o.length)]; }
      else if (typeof spec.default === 'number') { if (roll < 0.6) p[key] = snap(p[key] + (val * 2 - 1) * 0.25 * (spec.max - spec.min), spec); }
      else if (typeof spec.default === 'boolean') { if (roll < 0.2) p[key] = !p[key]; }
    }
    return { family: f.family, params: MO.resolve(f.family, p), seed: String(seed), direction: f.direction === 'left' ? 'left' : 'right' };
  }

  // More like your favorites: each favorite retuned, the favored families' other styles (the refined
  // ones among them) and the hybrid Phases, ranked by affinity on the axes and by how often the family
  // was starred; every favored family once, then the best, at most three per family
  function likeList(pool, seed) {
    const P = profile(pool), L = leanings(pool), r = M.rng('like|' + seed);
    const share = (id) => pool.filter((f) => f.family === id).length / pool.length;
    const own = new Set(pool.map((f) => f.family + '/' + styleOf(f)));
    const all = [];
    let k = 0;
    const add = (v, badge, why, bonus) => all.push({ v, badge, why, score: affinity(v.family, P) + 0.3 * share(v.family) + bonus + 0.02 * r() });
    for (const f of pool) {
      const v = retune(f, seed + '-' + pad2(++k));
      add(v, 'Retuned', 'Your ' + famName(f.family) + ' · ' + styleOf(f) + ', at ' + v.params.duration + ' ms', 0.03);
    }
    for (const id of Array.from(new Set(pool.map((f) => f.family).concat('phases'))).filter(famOk)) {
      for (const s of MO.get(id).styles) {
        if (own.has(id + '/' + s)) continue;
        const refined = REFINED.includes(id + '/' + s), hybrid = id === 'phases';
        add(leaned(id, s, L, seed + '-' + pad2(++k)), hybrid ? 'Hybrid' : refined ? 'Refined' : 'Other style',
          hybrid ? 'Traces and transformation at once' : refined ? 'Refined from your favorites' : 'Another ' + famName(id), refined ? 0.03 : 0.01);
      }
    }
    all.sort((a, b) => b.score - a.score);
    const out = [], per = {};
    for (const c of all) if (!per[c.v.family]) { per[c.v.family] = 1; out.push(c); }
    for (const c of all) { if (out.length >= 12) break; if (!out.includes(c) && per[c.v.family] < 3) { per[c.v.family]++; out.push(c); } }
    return out.sort((a, b) => b.score - a.score).slice(0, 12);
  }
  // Something different: the families furthest from the pool on the axes, at the pool's intensity
  function farList(pool, seed) {
    const P = profile(pool), L = leanings(pool), r = M.rng('far|' + seed);
    const have = new Set(pool.map((f) => f.family));
    return MO.families.filter((f) => !have.has(f.id)).map((f, i) => {
      const s = f.styles[Math.floor(r() * f.styles.length)], t = tagsOf(f.id);
      const fresh = t ? t.filter((v, j) => !P.prof[j][v]) : [];
      return { v: leaned(f.id, s, L, seed + '-d' + pad2(i + 1)), why: fresh.length ? 'New to you: ' + fresh.slice(0, 4).join(', ') : t ? 'Unlike most of your favorites' : 'Not yet described on the axes', score: 1 - affinity(f.id, P) + 0.01 * r() };
    }).sort((a, b) => b.score - a.score).slice(0, 8);
  }
  // with no favorites yet: twelve families as unlike one another as the axes allow
  function starterList(seed) {
    const r = M.rng('start|' + seed);
    const ids = shuffle(MO.families.map((f) => f.id), r);
    const diff = (a, b) => { const x = tagsOf(a), y = tagsOf(b); return x && y ? x.filter((v, i) => v !== y[i]).length : AXES.length / 2; };
    const chosen = ids.slice(0, 1);
    while (chosen.length < Math.min(12, ids.length)) {
      let best = null, far = -1;
      for (const id of ids) if (!chosen.includes(id)) { const d = Math.min(...chosen.map((c) => diff(id, c))); if (d > far) { far = d; best = id; } }
      chosen.push(best);
    }
    return chosen.map((id, i) => {
      const f = MO.get(id), t = tagsOf(id);
      return { v: { family: id, params: MO.resolve(id, { style: f.styles[Math.floor(r() * f.styles.length)] }), seed: seed + '-' + pad2(i + 1), direction: 'right' }, why: t ? [t[2], t[3], t[4]].join(' · ') : '' };
    });
  }

  function chip(label, n, of, cls) {
    return '<span class="chip' + (cls ? ' ' + cls : '') + '" style="--s:' + (of ? n / of : 0).toFixed(3) + '">' + esc(label) + ' <b>' + n + '</b></span>';
  }
  function chips(rows, of) { return rows.map(([k, n], i) => chip(String(k), n, of, i === 0 ? 'lead' : '')).join(''); }

  // the reading, computed from the pool as it is now
  function renderTrends() {
    const pool = allStars(), n = pool.length;
    if (!n) {
      els.trends.innerHTML = '<p class="fy-read">No favorites yet. Star any animation (here, in Explore or on the stage) and this page reads them: the families and styles, what they share on the axes, the options you leaned on, and what is missing. Until then, a sheet as varied as the axes allow.</p>';
      return;
    }
    const P = profile(pool);
    const fams = tally(pool, (f) => f.family);
    const famText = fams.map(([id, c]) => famName(id) + ' ' + c + ' (' + tally(pool.filter((f) => f.family === id), styleOf).map(([s, k]) => s + (k > 1 ? ' ' + k : '')).join(', ') + ')');
    const most = [], split = [];
    AXES.forEach(([, , words], i) => {
      const top = Object.entries(P.prof[i]).sort((a, b) => b[1] - a[1]);
      if (!top.length) return;
      if (top[0][1] >= 0.6 * P.n) most.push(words[top[0][0]] + ' (' + top[0][1] + ' of ' + P.n + ')');
      else if (top[1]) split.push([top[0][1] + top[1][1], top[0][1] + ' ' + words[top[0][0]] + ' and ' + top[1][1] + ' ' + words[top[1][0]]]);
    });
    split.sort((a, b) => b[0] - a[0]);
    const missing = [];
    AXES.forEach(([, , words], i) => { for (const v of Object.keys(words)) if (!P.prof[i][v]) missing.push(v); });
    let read = '<b>' + n + (n === 1 ? ' favorite' : ' favorites') + '</b> in ' + fams.length + (fams.length === 1 ? ' family' : ' families') + ': ' + esc(andList(famText)) + '.';
    if (P.n >= 3 && most.length) read += ' Most of them ' + esc(andList(most)) + '.';
    if (P.n >= 3 && split.length) read += ' Elsewhere they split: ' + esc(split.slice(0, 3).map((s) => s[1]).join('; ')) + '.';
    if (P.n < n) read += ' ' + (n - P.n) + ' of them ' + (n - P.n === 1 ? 'is' : 'are') + ' in a family not yet described on the axes.';
    if (P.n && missing.length) read += ' Not in the pool yet: ' + esc(andList(missing)) + '. Something different starts there.';

    const nums = (k) => pool.map((f) => f.params && f.params[k]).filter((x) => typeof x === 'number');
    const opt = (k) => tally(pool.filter((f) => f.params && f.params[k] != null), (f) => f.params[k]);
    const ins = nums('intensity'), durs = nums('duration');
    const rib = pool.filter((f) => f.params && f.params.ribbon !== false).length;
    const found = tally(pool, (f) => f.found).map(([m, c]) => (MOMENT[m] ? MOMENT[m].name : m) + ' ' + c);
    let rows = '<dt>Families</dt><dd>' + chips(fams.map(([id, c]) => [famName(id), c]), n) + '</dd>';
    rows += '<dt>Styles</dt><dd>' + chips(tally(pool, (f) => famName(f.family) + ' · ' + styleOf(f)), n) + '</dd>';
    let axes = '';
    AXES.forEach(([, label, words], i) => {
      const vals = Object.keys(words).map((v) => [v, P.prof[i][v] || 0]).sort((a, b) => b[1] - a[1]);
      axes += '<dt>' + esc(label) + '</dt><dd>' + vals.map(([v, c], j) => chip(v, c, P.n, c ? (j === 0 ? 'lead' : '') : 'none')).join('') + '</dd>';
    });
    if (ins.length) axes += '<dt>Intensity</dt><dd><span class="fy-note">median ' + median(ins) + ' · ' + ins.filter((x) => x >= 1).length + ' of ' + ins.length + ' at full · lowest ' + Math.min(...ins) + '</span></dd>';
    axes += '<dt>Palette</dt><dd>' + chips(opt('palette'), n) + '</dd>';
    axes += '<dt>Ribbon</dt><dd><span class="fy-note">on in ' + rib + ' of ' + n + '</span></dd>';
    axes += '<dt>Weight</dt><dd>' + chips(opt('weight'), n) + '</dd>';
    axes += '<dt>Easing</dt><dd>' + chips(opt('easing'), n) + '</dd>';
    let tempo = '';
    if (durs.length) {
      tempo = '<dt>Tempo</dt><dd><span class="fy-note">' + Math.min(...durs) + '–' + Math.max(...durs) + ' ms, median ' + median(durs) +
        '. This follows the moments you were on when you starred them (' + esc(found.join(', ')) + '): the lab fits each animation to its moment\'s length, so it says where you browsed, not what you like. The retuned variants below try other tempos.</span></dd>';
    }
    els.trends.innerHTML = '<p class="fy-read">' + read + '</p><dl class="fy-facts">' + rows + '</dl><dl class="fy-facts fy-axes">' + axes + '</dl>' + (tempo ? '<dl class="fy-facts">' + tempo + '</dl>' : '');
  }

  // a cell of For you or of the Board's pool: plays on its group's clock, loads onto the stage, takes a star
  const fyLists = { like: [], far: [], pool: [] };
  function fyCells(el, key, items, group) {
    fyLists[key] = items;
    el.innerHTML = items.map((c, i) => {
      const v = c.v, fam = MO.get(v.family);
      return '<li class="cell">' +
        '<button type="button" class="cell-load" data-act="fy-load" data-list="' + key + '" data-i="' + i + '" aria-label="Load into the stage: ' + esc(fam.name) + ', ' + esc(v.params.style) + ', seed ' + esc(v.seed) + (c.why ? '. ' + esc(c.why) : '') + '. ' + esc(fam.idea) + '"><canvas aria-hidden="true"></canvas>' + (c.badge ? '<span class="wild" aria-hidden="true">' + esc(c.badge) + '</span>' : '') + '</button>' +
        '<div class="cell-meta"><p class="cell-name">' + esc(fam.name) + ' <span class="style">· ' + esc(v.params.style) + '</span></p>' +
        '<button type="button" class="cell-star" data-act="fy-star" data-list="' + key + '" data-i="' + i + '" aria-pressed="false" aria-label="Star ' + esc(fam.name) + ', ' + esc(v.params.style) + ', seed ' + esc(v.seed) + '"><svg class="ic" aria-hidden="true"><use href="#i-star"/></svg></button>' +
        '<p class="cell-seed"><span>' + esc(v.seed) + '</span><span>' + esc(v.params.duration) + ' ms</span></p>' +
        (c.why ? '<p class="cell-why">' + esc(c.why) + '</p>' : '') + '</div></li>';
    }).join('');
    return $$('.cell', el).map((li, i) => {
      setStar($('.cell-star', li), isStarred(items[i].v));
      return addPlayer($('canvas', li), group, () => ({ variant: fyLists[key][i] && fyLists[key][i].v, theme: ui.theme }), { pad: 0.1, maxDpr: 1.5 });
    });
  }
  function refreshStars() {
    for (const b of $$('[data-act="fy-star"]')) { const c = fyLists[b.dataset.list][+b.dataset.i]; if (c) setStar(b, isStarred(c.v)); }
  }

  let fyPlayers = [], fyNone = null;
  function buildForYou() {
    for (const p of fyPlayers) removePlayer(p);
    if (!ui.forSeed) { ui.forSeed = newBatchSeed(); saveUi(); }
    const pool = allStars().filter((f) => famOk(f.family));
    fyNone = !pool.length;
    renderTrends();
    els.fyLikeH.textContent = fyNone ? 'A varied starter sheet' : 'More like your favorites';
    els.fyLikeSub.textContent = fyNone
      ? 'Twelve families, each as unlike the others as the axes allow. Star the ones that move you.'
      : 'Your favorites retuned (other tempos and settings), the other styles of the families you starred, the styles refined from your trends, and the hybrid Phases, ranked by how much they share with your favorites.';
    const like = fyNone ? starterList(ui.forSeed) : likeList(pool, ui.forSeed);
    const far = fyNone ? [] : farList(pool, ui.forSeed);
    els.fyFarWrap.hidden = fyNone;
    fyPlayers = fyCells(els.fyLike, 'like', like, 'foryou').concat(fyCells(els.fyFar, 'far', far, 'foryou'));
    els.fySeed.textContent = ui.forSeed;
    syncCycle('foryou', like.concat(far).map((c) => c.v));
    groups.foryou.pos = groups.foryou.playing ? 0 : null;
  }
  // as the pool changes: the reading and the stars follow; the sheets stay put unless the db brought new data
  // or the pool went from empty to not
  function liveForYou(rebuild) {
    if (ui.view !== 'foryou') return;
    if (rebuild || fyNone !== !allStars().some((f) => famOk(f.family))) buildForYou();
    else { renderTrends(); refreshStars(); }
  }

  /* ============================================================== views */

  function setView(v) {
    if (!VIEWS.includes(v)) v = 'moments';
    ui.view = v;
    lab.dataset.view = v;
    $('#view-moments').hidden = v !== 'moments';
    $('#view-explore').hidden = v !== 'explore';
    $('#view-board').hidden = v !== 'board';
    $('#view-foryou').hidden = v !== 'foryou';
    for (const a of $$('.mode')) { if (a.dataset.mode === v) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
    if (!embedded) doc.title = (v === 'moments' ? '' : v === 'explore' ? 'Explore · ' : v === 'board' ? 'Board · ' : 'For you · ') + '5s Motion Lab';
    if (v === 'explore') buildSheet();
    if (v === 'board') buildBoard();
    if (v === 'foryou') buildForYou();
    dirtyGroup();
  }
  function route() { setView((location.hash || '').replace(/^#/, '')); }
  // on its own page a view is a hash; mounted in a host, the host's hash is left alone
  function go(v) { if (!embedded) location.hash = '#' + v; setView(v); }

  /* ============================================================== hand back: copy, save, record */

  function specJson() {
    const picks = {}, stars = {};
    for (const m of MOMENTS) {
      const p = data.picks[m.id];
      if (p) picks[m.id] = { moment: m.name, family: p.family, style: p.style, params: p.params, seed: p.seed, direction: p.direction, note: p.note || '', at: p.at || null };
      if (data.stars[m.id] && data.stars[m.id].length) stars[m.id] = data.stars[m.id];
    }
    return JSON.stringify({ format: '5s-motion', v: 1, made: new Date().toISOString().slice(0, 10), picks, stars }, null, 2);
  }

  let returnFocus = null;
  function copySpec(btn) {
    const text = specJson();
    const n = Object.keys(data.picks).length;
    const done = () => say('Copied the spec: ' + n + (n === 1 ? ' pick' : ' picks'));
    const fallback = () => openCopy(text, btn);
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  function openCopy(text, btn) {
    returnFocus = btn || null;
    els.copyText.value = text;
    els.dialog.hidden = false;
    els.copyText.focus();
    els.copyText.select();
  }
  function closeCopy() {
    els.dialog.hidden = true;
    if (returnFocus && returnFocus.focus) returnFocus.focus();
  }

  const caps = { downloads: null };
  const canRecord = () => !!(caps.downloads && typeof MediaRecorder === 'function' && HTMLCanvasElement.prototype.captureStream);
  function refreshNeeds() {
    for (const el of $$('[data-needs]')) el.hidden = el.dataset.needs === 'downloads' ? !caps.downloads : !canRecord();
  }
  async function saveSpec() {
    if (!caps.downloads) return;
    try {
      await caps.downloads.save({ filename: '5s-motion.json', data: specJson() });
      say('Saved 5s-motion.json');
    } catch (e) { downloadError(e, 'the spec'); }
  }
  function downloadError(e, what) {
    const code = e && e.code;
    if (code === 'declined') say('Not saved: ' + what + ' was declined.');
    else if (code === 'rate_limited') say('A save is already waiting for an answer. Try again in a moment.');
    else if (code === 'unavailable' || code === 'not_granted' || code === 'capability_disabled' || code === 'capability_removed') { caps.downloads = null; refreshNeeds(); say('Saving files is not available here.'); }
    else say('Could not save ' + what + '.');
  }

  async function record() {
    if (!canRecord() || ui.recording) return;
    const v = cur(); if (!v) return;
    const fam = MO.get(v.family), m = MOMENT[ui.moment];
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    const type = types.find((t) => { try { return MediaRecorder.isTypeSupported(t); } catch (e) { return false; } });
    let stream, rec;
    try {
      stream = els.stageCanvas.captureStream(60);
      rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: 8000000 } : undefined);
    } catch (e) { say('Recording is not available here.'); return; }
    const chunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    const stopped = new Promise((res) => { rec.onstop = res; });
    const length = (fam.loop ? v.params.duration * 2 : LEAD + v.params.duration + HOLD) / ui.speed;
    ui.recording = true;
    lab.dataset.recording = 'true';
    for (const l of $$('.rec-label')) l.textContent = 'Recording…';
    for (const b of $$('[data-act="record"]')) b.disabled = true;
    groups.stage.pos = 0; groups.stage.playing = true; renderPlayStates(); dirtyGroup('stage');
    say('Recording ' + fam.name + ' for ' + m.name);
    rec.start(100);
    await new Promise((res) => setTimeout(res, length + 120));
    try { rec.stop(); } catch (e) { /* already stopped */ }
    await stopped;
    try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* gone */ }
    ui.recording = false;
    delete lab.dataset.recording;
    for (const l of $$('.rec-label')) l.textContent = 'Record';
    for (const b of $$('[data-act="record"]')) b.disabled = false;
    if (dead) return;   // unmounted while recording: no file to offer
    const blob = new Blob(chunks, { type: 'video/webm' });
    if (!blob.size) { say('The recording came out empty.'); return; }
    try {
      await caps.downloads.save({ filename: '5s-motion-' + ui.moment + '-' + v.family + '-' + v.params.style + '.webm', data: blob });
      say('Saved the clip');
    } catch (e) { downloadError(e, 'the clip'); }
  }

  /* ============================================================== persistence: db motion/picks, localStorage mirror */

  let dbRef = null, readOnly = false, localOnly = false, dirty = false, inflight = false, saveTimer = 0, firstSnap = true, retries = 0, lastSaved = 0;
  const told = new Set();
  function tellOnce(key, msg) { if (told.has(key)) return; told.add(key); say(msg); }

  function setSaveState() {
    const n = Object.keys(data.picks).length;
    const picks = n + (n === 1 ? ' pick' : ' picks');
    let s;
    if (readOnly) s = 'View only · the picks are the artist\'s';
    else if (!dbRef || localOnly) s = picks + ' · saved in this browser' + (localOnly ? ' only' : '');
    else if (dirty || inflight) s = 'Saving…';
    else s = picks + ' · saved to the lab';
    els.save1.textContent = s; els.save2.textContent = s;
  }
  function queueSave() {
    if (!dbRef || readOnly || localOnly) return;
    dirty = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, 700);
  }
  async function flush() {
    saveTimer = 0;
    if (inflight || !dirty || !dbRef) return;
    inflight = true; dirty = false;
    setSaveState();
    const body = clone(data);
    try {
      await dbRef.set(body);
      retries = 0; lastSaved = Date.now();
    } catch (e) {
      const code = e && e.code;
      if ((code === 'unavailable' || code === 'resource_exhausted') && retries < 3) { retries++; dirty = true; }
      else if (code === 'invalid_argument' || code === 'transform_error') { readOnly = true; tellOnce('ro', 'View only: your picks stay in this browser.'); }
      else { localOnly = true; tellOnce('local', 'Saved in this browser only.'); }
    } finally {
      inflight = false;
      if (dirty && !localOnly && !readOnly && !saveTimer) {
        if (dead) flush();   // unmounted while a write was out: the change made meanwhile goes now
        else saveTimer = setTimeout(flush, retries ? 1200 + 600 * retries : 700);
      }
      setSaveState();
    }
  }
  function adopt(next) {
    data = next;
    lsSet(STORE_KEY, data);
    renderRail(); renderPickStatus(); renderStarCount();
    if (ui.view === 'board') buildBoard();
    if (ui.view === 'explore' && ui.source === 'starred') buildSheet();
    liveForYou(true);
    setSaveState();
  }
  function onSnap(snap) {
    if (dead) return;
    const remote = snap && snap.exists ? cleanData(snap.data()) : null;
    if (firstSnap) {
      firstSnap = false;
      if (remote) {
        const merged = readOnly ? remote : mergeData(remote, data);
        adopt(merged);
        if (!readOnly && !sameData(merged, remote)) queueSave();
      } else if (!readOnly && hasAny(data)) queueSave();
      if (readOnly) tellOnce('ro', 'View only: these are the artist\'s picks. What you pick here stays in this browser.');
      setSaveState();
      return;
    }
    if (snap.metadata && snap.metadata.hasPendingWrites) return;
    if (dirty || inflight) return;
    if (remote && !sameData(remote, data)) adopt(remote);
  }
  function onSnapErr() { dbRef = null; setSaveState(); }

  function use(name) {
    try {
      const c = window.claude;
      if (!c || typeof c.use !== 'function') return Promise.resolve(null);
      return Promise.resolve(c.use(name)).catch(() => null);
    } catch (e) { return Promise.resolve(null); }
  }
  let unsub = null;
  async function lightUp() {
    use('downloads').then((d) => { if (!dead && d && typeof d.save === 'function') { caps.downloads = d; refreshNeeds(); } });
    // mounted in a host: the db it was given, else the page's own (the same doc either way)
    const pair = await Promise.all([opts.db ? Promise.resolve(opts.db) : use('db'), use('user')]);
    const db = pair[0], user = pair[1];
    if (dead) return;
    if (!db || typeof db.doc !== 'function') { setSaveState(); return; }
    let can = null;
    if (user && typeof user.can === 'function') { try { can = await user.can('data.write'); } catch (e) { can = null; } }
    if (dead) return;
    readOnly = can === false;
    try { dbRef = db.doc(DOC_PATH); } catch (e) { dbRef = null; return; }
    try { unsub = dbRef.onSnapshot(onSnap, onSnapErr); } catch (e) { dbRef = null; }
    setSaveState();
  }

  // stops every clock, observer, timer and listener; a change still waiting is written first
  function unmount() {
    if (dead) return;
    dead = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (io) io.disconnect();
    if (ro) ro.disconnect();
    players.clear();
    clearTimeout(liveTimer); clearTimeout(infoTimer);
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = 0; flush(); }
    try { if (typeof unsub === 'function') unsub(); } catch (e) { /* already gone */ }
    listening.abort();
  }

  /* ============================================================== events */

  let scrubbing = false;
  function onClick(e) {
    const a = embedded && e.target.closest('a[href^="#"]');
    if (a) { e.preventDefault(); setView(a.getAttribute('href').slice(1)); return; }
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    const act = el.dataset.act, val = el.dataset.value;
    switch (act) {
      case 'moment': selectMoment(el.dataset.moment, { announce: true }); break;
      case 'play': setPlaying('stage', !groups.stage.playing); break;
      case 'replay': groups.stage.pos = 0; setPlaying('stage', true); break;
      case 'frame-prev': step(-1); break;
      case 'frame-next': step(1); break;
      case 'speed': ui.speed = parseFloat(val); saveUi(); renderToggles(); break;
      case 'loop': { const t = stageTNow(); ui.loop = !ui.loop; saveUi(); renderToggles(); setStageT(t); break; }
      case 'theme': ui.theme = val === 'dark' ? 'dark' : 'light'; saveUi(); renderToggles(); renderStageInfo(); buildPanelSwatches(); dirtyGroup(); break;
      case 'app': ui.app = val === 'app'; saveUi(); renderToggles(); renderStageInfo(); break;
      case 'reduced': ui.reduced = !ui.reduced; renderToggles(); renderStageInfo(); break;
      case 'pick': pickNow(); break;
      case 'star-stage': { const v = cur(); if (v) { toggleStar(v, ui.moment); renderPickStatus(); } break; }
      case 'show-pick': { const p = pickVariant(ui.moment); if (p) loadVariant(p, 'Showing the pick for ' + MOMENT[ui.moment].name); break; }
      case 'clear-pick': clearPickAsk(el); break;
      case 'clear-yes': { const m = MOMENT[ui.moment]; change((d) => { delete d.picks[ui.moment]; }); say('Cleared the pick for ' + m.name); break; }
      case 'clear-no': renderPickStatus(); break;
      case 'source': ui.source = val; renderToggles(); buildSheet(); break;
      case 'generate': ui.source = 'generate'; ui.batch[ui.moment] = newBatchSeed(); saveUi(); buildSheet(); say('Twelve new variants from seed ' + ui.batch[ui.moment]); break;
      case 'load': {
        const v = sheetVariants[+el.dataset.i]; if (!v) break;
        go('moments');
        loadVariant(v, 'Loaded ' + MO.get(v.family).name + ' · ' + v.params.style + ', seed ' + v.seed + ', into the stage');
        els.play.focus();
        break;
      }
      case 'star': { const v = sheetVariants[+el.dataset.i]; if (v) setStar(el, toggleStar(v, ui.moment)); if (ui.source === 'starred') buildSheet(); break; }
      case 'sheet-play': setPlaying('sheet', !groups.sheet.playing); break;
      case 'board-play': setPlaying('board', !groups.board.playing); break;
      case 'foryou-play': setPlaying('foryou', !groups.foryou.playing); break;
      case 'foryou-more': ui.forSeed = newBatchSeed(); saveUi(); buildForYou(); say('New ideas from seed ' + ui.forSeed); break;
      case 'fy-load': {
        const c = fyLists[el.dataset.list][+el.dataset.i]; if (!c) break;
        go('moments');
        loadVariant(c.v, 'Loaded ' + MO.get(c.v.family).name + ' · ' + c.v.params.style + ', seed ' + c.v.seed + ', into the stage');
        els.play.focus();
        break;
      }
      case 'fy-star': { const c = fyLists[el.dataset.list][+el.dataset.i]; if (c) setStar(el, toggleStar(c.v, ui.moment)); break; }
      case 'open-moment': go('moments'); selectMoment(el.dataset.moment, { announce: true }); els.play.focus(); break;
      case 'pause-all': {
        const any = GROUPS.some((g) => groups[g].playing);
        for (const g of GROUPS) { const G = groups[g]; if (!any && G.pos == null) G.pos = 0; G.playing = !any; }
        renderPlayStates(); dirtyGroup();
        say(any ? 'Paused everything' : 'Playing everything');
        break;
      }
      case 'copy': copySpec(el); break;
      case 'copy-close': closeCopy(); break;
      case 'save-spec': saveSpec(); break;
      case 'record': record(); break;
      case 'opt': setParam(el.dataset.key, val); for (const b of $$('[data-act="opt"][data-key="' + el.dataset.key + '"]')) b.setAttribute('aria-pressed', String(b.dataset.value === val)); if (el.dataset.key === 'style') restartStage(); break;
      case 'bool': { const v = cur(); const on = !v.params[el.dataset.key]; setParam(el.dataset.key, on); el.setAttribute('aria-checked', String(on)); $('.tv', el).textContent = on ? 'On' : 'Off'; break; }
      case 'palette': setParam('palette', val); break;
      case 'direction': { const v = cur(); v.direction = val === 'left' ? 'left' : 'right'; for (const b of $$('[data-act="direction"]')) b.setAttribute('aria-pressed', String(b.dataset.value === v.direction)); renderStageInfo(); restartStage(); break; }
      case 'new-seed': { const v = cur(); v.seed = newBatchSeed(); $('#p-seed').value = v.seed; renderStageInfo(); dirtyGroup('stage'); break; }
      case 'reset': { const v = cur(); const nv = baseVariant(ui.moment, v.family); nv.seed = v.seed; nv.direction = v.direction; drafts[ui.moment] = nv; buildPanel(); renderStageInfo(); restartStage(); say('Back to the defaults for ' + MO.get(v.family).name); break; }
      default: break;
    }
  }
  function buildPanelSwatches() {
    for (const b of $$('[data-act="palette"]')) { const s = $('span', b); if (s) s.setAttribute('style', paletteSwatch(b.dataset.value)); }
  }
  function clearPickAsk(el) {
    const m = MOMENT[ui.moment];
    const span = doc.createElement('span');
    span.innerHTML = 'Clear the pick for ' + esc(m.name) + '? <button type="button" class="linkish" data-act="clear-yes">Clear it</button> <button type="button" class="linkish" data-act="clear-no">Keep it</button>';
    el.replaceWith(span);
    $('[data-act="clear-no"]', span).focus();
  }
  function stageTNow() { const v = cur(); return v ? stageT(v, MO.get(v.family)) : 0; }
  function step(dir) {
    const v = cur(); if (!v) return;
    if (groups.stage.playing) setPlaying('stage', false);
    const t = stageTNow();
    setStageT(t + dir * FRAME / v.params.duration);
    syncTransport();
  }
  function jump(to) {
    setStageT(to);
    syncTransport();
  }

  function onInput(e) {
    const el = e.target;
    if (el === els.scrub) {
      scrubbing = true;
      if (groups.stage.playing) setPlaying('stage', false);
      setStageT(parseInt(el.value, 10) / 1000);
      syncTransport();
      return;
    }
    if (el.id === 'p-seed') {
      const v = cur(); if (!v) return;
      v.seed = el.value.trim() || '0';
      renderStageInfo();
      dirtyGroup('stage');
      return;
    }
    const key = el.dataset && el.dataset.param;
    if (key && el.type === 'range') {
      const v = cur(); const fam = MO.get(v.family);
      const val = parseFloat(el.value);
      setParam(key, val, { quiet: true });
      const o = $('#o-' + key);
      if (o) o.textContent = fmt(v.params[key], fam.params[key]) + (key === 'duration' ? ' ms' : '');
      scheduleInfo();
    }
  }
  let infoTimer = 0;
  function scheduleInfo() { clearTimeout(infoTimer); infoTimer = setTimeout(renderStageInfo, 120); }
  function onChange(e) {
    const el = e.target;
    if (el === els.scrub) { scrubbing = false; return; }
    if (el === els.select) { selectMoment(el.value, { announce: true }); return; }
    if (el === els.famSelect) { setFamily(el.value); say('Family: ' + MO.get(el.value).name); return; }
    const key = el.dataset && el.dataset.param;
    if (key && el.tagName === 'SELECT') setParam(key, el.value);
  }

  function onKey(e) {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!els.dialog.hidden) {
      if (e.key === 'Escape') { e.preventDefault(); closeCopy(); }
      else if (e.key === 'Tab') {
        const items = [els.copyText, $('[data-act="copy-close"]', els.dialog)];
        const i = items.indexOf(root.activeElement);
        e.preventDefault();
        items[(i + (e.shiftKey ? items.length - 1 : 1)) % items.length].focus();
      }
      return;
    }
    const el = e.target, tag = el && el.tagName;
    const isScrub = el === els.scrub;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || (el && el.isContentEditable)) return;
    if (tag === 'INPUT' && !isScrub) return;
    const onControl = tag === 'BUTTON' || tag === 'A';
    const key = e.key;
    if (key === ' ' || key === 'Spacebar') {
      if (onControl) return;
      e.preventDefault();
      const g = ui.view === 'explore' ? 'sheet' : ui.view === 'board' ? 'board' : ui.view === 'foryou' ? 'foryou' : 'stage';
      setPlaying(g, !groups[g].playing);
      return;
    }
    if (ui.view !== 'moments') return;
    if (key === 'ArrowLeft' || key === 'ArrowRight') { e.preventDefault(); step(key === 'ArrowLeft' ? -1 : 1); }
    else if (key === '[') { e.preventDefault(); jump(0); }
    else if (key === ']') { e.preventDefault(); jump(1); }
  }

  /* ============================================================== boot */

  function boot(snapshot) {
    if (snapshot && snapshot.drafts && typeof snapshot.drafts === 'object') {
      for (const k of Object.keys(snapshot.drafts)) { const v = snapshot.drafts[k]; if (MOMENT[k] && v && famOk(v.family)) drafts[k] = v; }
    }
    if (snapshot && MOMENT[snapshot.moment]) ui.moment = snapshot.moment;
    buildRail();
    stagePlayer = addPlayer(els.stageCanvas, 'stage', stageSpec, { pad: 0.17, maxPixels: 1.4e6, minPixels: 2e5, minDpr: 1 });
    renderToggles();
    renderPlayStates();
    els.pickNote.value = data.picks[ui.moment] && data.picks[ui.moment].note ? data.picks[ui.moment].note : '';
    buildPanel();
    renderStageInfo();
    renderRail();
    renderStarCount();
    refreshNeeds();
    setSaveState();
    const failed = Array.isArray(window.MotionLoadErrors) ? window.MotionLoadErrors : [];
    if (failed.length) {
      const el = $('#load-errors');
      el.textContent = 'Not loaded: ' + failed.map((f) => f.file + ' (' + f.error + ')').join('; ');
      el.hidden = false;
    }
    if (embedded) setView(VIEWS.includes(opts.view) ? opts.view : 'moments');
    else route();
    // on its own page the lab listens on the document; mounted, on its shadow root only, so keys reach it
    // only while focus is inside it (the lab itself takes focus on a click anywhere in it)
    if (embedded) lab.tabIndex = -1;
    const on = (target, type, fn) => target.addEventListener(type, fn, { signal: listening.signal });
    on(root, 'click', onClick);
    on(root, 'input', onInput);
    on(root, 'change', onChange);
    on(root, 'keydown', onKey);
    on(root, 'pointerup', () => { scrubbing = false; });
    $('#seedform').addEventListener('submit', (e) => {
      e.preventDefault();
      const raw = els.batchSeed.value.trim().toLowerCase();
      const one = /^([a-z0-9]{1,12})-(\d{1,2})$/.exec(raw);
      const s = one ? one[1] : raw.replace(/[^a-z0-9]/g, '').slice(0, 12);
      if (!s) { els.batchSeed.value = ui.batch[ui.moment] || ''; return; }
      ui.batch[ui.moment] = s; ui.source = 'generate'; saveUi(); buildSheet();
      const n = one ? parseInt(one[2], 10) : 0;
      if (n >= 1 && n <= sheetVariants.length) {
        const li = $('#sheet .cell:nth-child(' + n + ')');
        li.classList.add('found');
        $('.cell-load', li).focus();
        const v = sheetVariants[n - 1];
        say('Variant ' + v.seed + ': ' + MO.get(v.family).name + ' · ' + v.params.style + ', number ' + n + ' of the twelve from seed ' + s);
      } else say('Twelve variants from seed ' + s);
    });
    if (!embedded) on(window, 'hashchange', route);
    if (reduceMQ && reduceMQ.addEventListener) on(reduceMQ, 'change', (e) => { if (e.matches) { for (const g of GROUPS) groups[g].playing = false; renderPlayStates(); dirtyGroup(); } });
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(() => { if (!dead) { dirtyGroup('stage'); drawCurve(); } });
    const logo = $('.brand-logo');
    if (logo) logo.addEventListener('load', () => dirtyGroup('stage'));
    lightUp();
  }

  const listening = new AbortController();
  boot(opts.snapshot || {});

  // the lab, for tests and for Claude reading it back (window.MotionLab hands these on)
  const asCell = (c) => Object.assign(clone(c.v), { badge: c.badge || '', why: c.why || '' });
  return {
    get frames() { return frames; },
    get draws() { return draws; },
    get running() { return !!raf; },
    get data() { return clone(data); },
    get ui() { return { view: ui.view, moment: ui.moment, theme: ui.theme, speed: ui.speed, loop: ui.loop, app: ui.app, reduced: ui.reduced, source: ui.source, batch: ui.batch[ui.moment] }; },
    get stage() { const v = cur(); return { playing: groups.stage.playing, t: stageTNow(), variant: v && clone(v) }; },
    get sheet() { return sheetVariants.map((v) => clone(v)); },
    get pool() { return clone(allStars()); },
    get foryou() { return { seed: ui.forSeed, like: fyLists.like.map(asCell), far: fyLists.far.map(asCell), pool: fyLists.pool.map(asCell) }; },
    groups: () => clone(groups),
    batchFor: (moment, seed) => batchFor(moment, seed),
    spec: specJson,
    hot: () => ({ moment: ui.moment, drafts: clone(drafts) }),
    unmount
  };
}

/* ================================================================ the page's own lab, or one mounted in a host */

let inst = null, mounted = null;
const pageLab = doc.getElementById('lab');

// MotionLab.mount(host, {embedded: true, db, view}): the lab in a shadow root on host, styled by its own
// lab.css (built into lab-markup.js with the markup), its views kept inside, db the database to keep
// motion/picks in (default: claude.use('db')). The page provides the fonts, and logo.webp beside it.
function mount(host, o) {
  if (pageLab) throw new Error('MotionLab.mount: this page runs its own lab');
  const mk = window.MotionLabMarkup;
  if (!host || typeof host.attachShadow !== 'function' || !mk) throw new Error('MotionLab.mount(host, {db}) needs an element and lab-markup.js');
  unmount();
  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + mk.css + '</style>' + mk.html;
  // the lab's chrome follows the page's data-theme, as on its own page (its colour tokens are on :host)
  const mirror = () => { const t = doc.documentElement.getAttribute('data-theme'); if (t) host.setAttribute('data-theme', t); else host.removeAttribute('data-theme'); };
  mirror();
  const watch = typeof MutationObserver === 'function' ? new MutationObserver(mirror) : null;
  if (watch) watch.observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  inst = createLab(root, Object.assign({}, o, { embedded: true }));
  mounted = { root, watch, lab: inst };
  return Object.freeze({ unmount });
}
function unmount() {
  if (!mounted) return;
  const m = mounted;
  mounted = null;
  if (m.lab) m.lab.unmount();
  if (m.watch) m.watch.disconnect();
  m.root.innerHTML = '';
  if (inst === m.lab) inst = null;
}

if (pageLab) {
  const hot = window.claude && window.claude.hot;
  const start = (snapshot) => { inst = createLab(doc, { snapshot: snapshot || {} }); };
  try { if (hot && typeof hot.snapshot === 'function') hot.snapshot(() => (inst ? inst.hot() : {})); } catch (e) { /* no hot updates here */ }
  if (hot && typeof hot.ready === 'function') { try { hot.ready(start); } catch (e) { start({}); } }
  else start((hot && hot.data) || {});
}

const api = { mount, unmount, groups: () => (inst ? inst.groups() : undefined), batchFor: (m, s) => (inst ? inst.batchFor(m, s) : []), spec: () => (inst ? inst.spec() : '') };
for (const k of ['frames', 'draws', 'running', 'data', 'ui', 'stage', 'sheet', 'pool', 'foryou']) Object.defineProperty(api, k, { enumerable: true, get: () => (inst ? inst[k] : undefined) });
window.MotionLab = Object.freeze(api);
})();
