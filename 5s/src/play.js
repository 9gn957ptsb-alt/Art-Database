/* 5s play: Set's game in an element (SPEC.md, "Set: the board and the game").
 *
 * Candy Crush Saga's rules with the person's own things: the saga map (mountMap) and a level
 * (mount): the level card, the board, the out-of-moves sheet and the level end. The rules are
 * FiveSMatch's (pure); this file draws them, takes the gestures, and owns sound (WebAudio,
 * synthesised), haptics, motion (one requestAnimationFrame loop, transform and opacity only, one
 * overlay canvas) and the hint timer. It never writes state: the callbacks do.
 * Styles: play.css (under .fp). Browser only: window.FiveSPlay.
 */
(function (root) {
  'use strict';

  const SHAPES = ['circle', 'petal', 'arch', 'hexagon', 'square', 'diamond'];
  const KIND_PL = { image: 'Images', object: 'Objects', space: 'Spaces', surface: 'Surfaces', colour: 'Colours' };
  const NOTES = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51]; // C major pentatonic, C5 to E6
  const IRIS = '#A78BFF';
  const SP_WORDS = { row: 'stripe: clears its row', col: 'stripe: clears its column', burst: 'burst: clears around it, twice', mark: 'the mark: swap it to clear a frame' };
  const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (n) => Math.round(n || 0).toLocaleString('en-GB');
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');
  const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const starText = (n) => '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
  const mss = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  const STOREYS = ['one storey', 'two storeys', 'three storeys'];
  const storeys = (n) => STOREYS[Math.max(1, Math.min(3, n | 0)) - 1];
  const PACES = [[0, 'Off'], [5, 'Five seconds a move'], [10, 'Ten seconds a move']];
  const RING_C = 150.8; // the five-second ring's circumference (r 24)
  const M = () => root.FiveSMatch;

  const SVG_SOUND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="fp-wave" d="M15.5 9a4 4 0 010 6M18 6.5a7.5 7.5 0 010 11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
  const SVG_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m5.5-5.5L5 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const SVG_HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/></svg>';
  const BOOSTS = [
    { kind: 'pass', word: 'Pass', glyph: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7.8" fill="none" stroke="currentColor" stroke-width="2"/></svg>' },
    { kind: 'turn', word: 'Turn', glyph: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 17c4.5 0 5-10 9.5-10S18 13 20 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M17 10l3 3-3 3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>' },
    { kind: 'more', word: 'Five more', glyph: '<b aria-hidden="true">+5</b>' },
  ];

  // One stylesheet for the game and the board: play.css, next to this script, unless the page already has it.
  const here = (document.currentScript && document.currentScript.src) || '';
  function ensureCss() { // -> a promise, settled once the styles apply
    const had = document.querySelector('[data-fives="play"]');
    if (had) return had.sheet || had.tagName === 'STYLE' ? Promise.resolve() : new Promise((r) => { had.addEventListener('load', r); had.addEventListener('error', r); });
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = here.replace(/[^/]*$/, 'play.css'); l.setAttribute('data-fives', 'play');
    const p = new Promise((r) => { l.onload = l.onerror = r; });
    document.head.appendChild(l);
    return p;
  }

  // ================================================================ sound and touch

  function makeSound(isOn) {
    let ac = null, out = null, voices = 0, nbuf = null, lastPaint = 0;
    function wake() {
      if (!isOn()) return;
      if (!ac) {
        const AC = root.AudioContext || root.webkitAudioContext;
        if (!AC) return;
        try { ac = new AC(); } catch (e) { return; }
        const comp = ac.createDynamicsCompressor();
        out = ac.createGain(); out.gain.value = 0.35;
        out.connect(comp); comp.connect(ac.destination);
      }
      if (ac.state === 'suspended' && !document.hidden) ac.resume().catch(() => {});
    }
    function voice(len, fn) {
      if (!ac || !isOn() || ac.state !== 'running' || voices >= 12) return; // at most 12 voices; extras are dropped
      voices++;
      const g = ac.createGain(); g.connect(out);
      fn(ac.currentTime + 0.01, g);
      setTimeout(() => { voices--; g.disconnect(); }, len * 1000 + 150);
    }
    function env(g, t, len, vol, attack) {
      const e = ac.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(vol, t + (attack || 0.005));
      e.gain.exponentialRampToValueAtTime(0.0001, t + len);
      e.connect(g);
      return e;
    }
    function osc(g, type, f0, f1, t, len, vol, attack, detune) {
      const o = ac.createOscillator();
      o.type = type; o.detune.value = detune || 0;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + len);
      o.connect(env(g, t, len, vol, attack)); o.start(t); o.stop(t + len + 0.03);
      return o;
    }
    function noise(g, type, f0, f1, t, len, vol) {
      if (!nbuf) {
        nbuf = ac.createBuffer(1, ac.sampleRate >> 1, ac.sampleRate);
        const d = nbuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; // noise texture only, not game logic
      }
      const s = ac.createBufferSource(); s.buffer = nbuf;
      const f = ac.createBiquadFilter(); f.type = type; f.Q.value = type === 'bandpass' ? 2 : 0.7;
      f.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + len);
      s.connect(f); f.connect(env(g, t, len, vol, 0.01)); s.start(t); s.stop(t + len + 0.03);
    }
    const pluck = (g, f, t, vol) => { osc(g, 'triangle', f, f, t, 0.22, vol || 0.3); osc(g, 'sine', f * 2, f * 2, t, 0.22, (vol || 0.3) * 0.4); };
    const bell = (g, f, t) => { osc(g, 'sine', f, f, t, 0.9, 0.25); osc(g, 'sine', f * 2, f * 2, t, 0.6, 0.08); osc(g, 'sine', f * 3, f * 3, t, 0.4, 0.04); };
    return {
      wake,
      pause() { if (ac && ac.state === 'running') ac.suspend().catch(() => {}); },
      resume() { if (ac && isOn() && ac.state === 'suspended') ac.resume().catch(() => {}); },
      close() { if (ac) ac.close().catch(() => {}); ac = null; },
      play(kind, n) {
        if (kind === 'swap') voice(0.06, (t, g) => osc(g, 'sine', 600, 900, t, 0.06, 0.08));
        else if (kind === 'bounce') voice(0.12, (t, g) => osc(g, 'triangle', 300, 200, t, 0.12, 0.16));
        else if (kind === 'match') voice(0.22, (t, g) => pluck(g, NOTES[Math.min(Math.max(n - 1, 0), 7)], t));
        else if (kind === 'special') voice(0.4, (t, g) => [0, 2, 4].forEach((k, i) => pluck(g, NOTES[k], t + i * 0.07, 0.22)));
        else if (kind === 'row' || kind === 'col') voice(0.25, (t, g) => noise(g, 'bandpass', 400, 4000, t, 0.25, 0.35));
        else if (kind === 'burst') voice(0.2, (t, g) => { osc(g, 'sine', 120, 60, t, 0.2, 0.6); noise(g, 'lowpass', 900, 300, t, 0.12, 0.25); });
        else if (kind === 'mark') voice(0.7, (t, g) => {
          NOTES.forEach((f, i) => osc(g, 'triangle', f, f, t + i * 0.05, 0.18, 0.12));
          const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1400; lp.connect(g);
          osc(lp, 'sawtooth', 261.6, 523.25, t, 0.6, 0.06, 0.02, -8); osc(lp, 'sawtooth', 261.6, 523.25, t, 0.6, 0.06, 0.02, 8);
        });
        else if (kind === 'paint') {
          const now = performance.now();
          if (now - lastPaint < 60) return; // at most one every 60 ms
          lastPaint = now;
          voice(0.08, (t, g) => noise(g, 'lowpass', 1200, 1200, t, 0.08, 0.12));
        } else if (kind === 'win') voice(0.4 + 0.3 * (n || 0) + 0.9, (t, g) => {
          [0, 1, 2, 3, 4].forEach((k) => pluck(g, NOTES[k], t + k * 0.09, 0.22));
          for (let s = 0; s < (n || 0); s++) bell(g, NOTES[5 + s], t + 0.55 + s * 0.3);
        });
        else if (kind === 'out') voice(0.7, (t, g) => { osc(g, 'sine', 523.25, 523.25, t, 0.3, 0.18, 0.02); osc(g, 'sine', 440, 440, t + 0.28, 0.4, 0.16, 0.02); });
      },
    };
  }

  const HAPTIC = { swap: 6, bounce: 4, match: 10, special: 18, mark: [12, 40, 12], win: [20, 60, 20, 60, 40] };

  // ================================================================ motion: one loop

  function makeLoop(drawFx) {
    const items = [];
    let id = 0, paused = false;
    const api = { scale: 1 }; // the finale plays faster
    function frame(now) {
      id = 0;
      for (const a of items.slice()) {
        if (a.t0 == null) a.t0 = now + a.delay;
        const t = a.dur > 0 ? (now - a.t0) / a.dur : 1;
        if (t < 0) continue;
        a.fn(t >= 1 ? 1 : t);
        if (t >= 1) { items.splice(items.indexOf(a), 1); a.res(); }
      }
      const more = drawFx(now);
      if ((items.length || more) && !paused) id = requestAnimationFrame(frame);
    }
    function kick() { if (!id && !paused) id = requestAnimationFrame(frame); }
    return Object.assign(api, {
      run(dur, fn, delay) { return new Promise((res) => { items.push({ dur: dur * api.scale, fn, delay: (delay || 0) * api.scale, t0: null, res }); kick(); }); },
      kick,
      pause() { paused = true; if (id) cancelAnimationFrame(id); id = 0; },
      resume() { paused = false; kick(); },
      stop() { paused = true; if (id) cancelAnimationFrame(id); items.length = 0; },
    });
  }

  const ease = {
    out: (t) => 1 - Math.pow(1 - t, 3),
    back: (t) => { const c = 1.4; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    lin: (t) => t,
  };

  // ================================================================ shared drawing

  // A thing's picture, from the app's thumb(id): an atlas cell, one image, or a Colour card's bands.
  function picStyle(th) {
    if (!th) return '';
    if (th.colours) return bandsBg(th.colours);
    if (th.src && th.cols != null && th.index != null) {
      const x = th.index % th.cols, y = Math.floor(th.index / th.cols);
      return 'background-image:url("' + th.src + '");background-size:calc(var(--p) * ' + th.cols + ') auto;background-position:calc(var(--p) * -' + x + ') calc(var(--p) * -' + y + ')';
    }
    if (th.src) return 'background-image:url("' + th.src + '");background-size:cover;background-position:50% 50%';
    return '';
  }
  function bandsBg(cs) {
    const c = (cs || []).filter((x) => /^#[0-9a-f]{6}$/i.test(x));
    if (!c.length) return '';
    const a = c[0], b = c[1] || a, d = c[2] || b;
    return 'background:linear-gradient(to bottom,' + a + ' 0 50%,' + b + ' 50% 83.3%,' + d + ' 83.3%)';
  }
  function shapeOf(suit) { return SHAPES.indexOf(suit && suit.shape) >= 0 ? suit.shape : 'square'; }

  // A small framed thumbnail of a thing, for the legend and the level end.
  function miniTile(suit, th, size) {
    return '<span class="fp-mini fp-s-' + shapeOf(suit) + '" style="--p:' + Math.round(size * 0.72) + 'px;width:' + size + 'px;height:' + size + 'px" aria-hidden="true">' +
      '<i class="fp-fr" style="background:' + (suit ? suit.hex : IRIS) + '"></i>' + (th ? '<i class="fp-pic" style=\'' + picStyle(th) + '\'></i>' : '') + '</span>';
  }

  function openSheet(host, title, body, onCancel) {
    const d = h('dialog', 'sheet fp-sheet');
    d.setAttribute('aria-label', title);
    d.innerHTML = '<div class="sheet-inner"><div class="sheet-head"><h2 class="sheet-title">' + esc(title) + '</h2>' +
      '<button type="button" class="iconbtn" data-x aria-label="Close">' + SVG_CLOSE + '</button></div><div class="sheet-body">' + body + '</div></div>';
    const cancel = () => { if (d.open) d.close(); d.remove(); if (onCancel) onCancel(); };
    d.addEventListener('cancel', (e) => { e.preventDefault(); cancel(); });
    d.querySelector('[data-x]').addEventListener('click', cancel);
    // At the top of the page, not inside the game's scrolling box: a phone browser placed a modal panel
    // there out of sight, leaving only the dimmed page (an iPhone, 23 Oct 2026).
    (host.ownerDocument || document).body.appendChild(d);
    try { d.showModal(); } catch (e) { d.setAttribute('open', ''); d.classList.add('fallback'); }
    // A tap on the dimmed page closes the panel, so no one is ever stuck behind it.
    d.addEventListener('click', (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) cancel();
    });
    const af = d.querySelector('[data-autofocus]');
    if (af) af.focus();
    requestAnimationFrame(() => keepOnScreen(d));
    d.done = () => { if (d.open) d.close(); d.remove(); };
    return d;
  }

  // Out of sight: pinned to the bottom of the screen (the app's dialog.sheet.fallback), and said if even that fails.
  function keepOnScreen(d) {
    if (!d.open) return;
    const vh = innerHeight || document.documentElement.clientHeight;
    const off = (r) => r.height < 40 || r.bottom <= 8 || r.top >= vh - 8;
    const r = d.getBoundingClientRect();
    if (!off(r)) return;
    d.classList.add('fallback');
    const r2 = d.getBoundingClientRect();
    if (off(r2) && typeof reportError === 'function') {
      reportError(new Error('The level panel opened out of sight (' + [r.top, r.bottom, r.height, vh].map(Math.round).join(', ') + '). Tap the dimmed page to close it.'));
    }
  }

  // ================================================================ the saga map

  function mountMap(el, opts) {
    const css = ensureCss();
    const M_ = M();
    let o = Object.assign({}, opts);
    const box = h('div', 'fp fp-mapview');
    box.innerHTML = '<div class="fp-top"><button type="button" class="btn btn-quiet fp-back">' + SVG_BACK + '<span>Your board</span></button>' +
      '<h2 class="fp-title">Levels</h2>' + (o.onKingdom ? '<button type="button" class="btn btn-quiet fp-kingdom">Kingdom</button>' : '<span class="fp-topgap"></span>') +
      '</div><div class="fp-scroll"><ol class="fp-map" aria-label="Levels"></ol></div>';
    el.appendChild(box);
    box.querySelector('.fp-back').addEventListener('click', () => o.onBack && o.onBack());
    if (o.onKingdom) box.querySelector('.fp-kingdom').addEventListener('click', () => o.onKingdom());
    const scroller = box.querySelector('.fp-scroll');
    const list = box.querySelector('.fp-map');
    list.addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (b && b.getAttribute('aria-disabled') !== 'true' && o.onLevel) o.onLevel(+b.dataset.n);
    });

    function render() {
      const saga = o.saga || {};
      const stars = Array.isArray(saga.stars) ? saga.stars : [];
      const next = stars.length + 1;
      const count = Math.max(30, Math.ceil(next / 5) * 5);
      const ROW = 96, HEAD = 76, PAD = 40;
      const eps = M_.EPISODES;
      const items = [];
      let y = PAD; // from the bottom
      for (let n = 1; n <= count; n++) {
        if ((n - 1) % 5 === 0) {
          const ep = n <= 30 ? eps.find((e) => n >= e.from && n <= e.to) : eps[eps.length - 1];
          items.push({ head: ep, from: n, y: y + 8 }); y += HEAD;
        }
        const x = 50 + 26 * Math.sin((n - 1) * 0.95);
        items.push({ n, x, y: y + ROW / 2 }); y += ROW;
      }
      const H = y + PAD;
      const pts = items.filter((it) => it.n).map((it) => [it.x, H - it.y]);
      let d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (let i = 1; i < pts.length; i++) {
        const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2;
        d += 'C' + x0 + ' ' + my + ',' + x1 + ' ' + my + ',' + x1 + ' ' + y1;
      }
      list.style.height = H + 'px';
      let html = '<li class="fp-ribbon" aria-hidden="true"><svg viewBox="0 0 100 ' + H + '" preserveAspectRatio="none"><path d="' + d + '" class="fp-rb1"/><path d="' + d + '" class="fp-rb2"/></svg></li>';
      for (const it of items) {
        if (it.head) {
          html += '<li class="fp-ep" style="top:' + (H - it.y - HEAD + 16) + 'px"><b>' + esc(it.head.name) + '</b><span>' + esc(it.head.line) + ' Levels ' + it.from + '–' + (it.from + 4) + '.</span></li>';
          continue;
        }
        const n = it.n, done = n < next, isNext = n === next;
        const s = done ? stars[n - 1] || 1 : 0;
        const inTime = done && Array.isArray(saga.time) && saga.time[n - 1] > 0 ? ', in time' : '';
        const label = 'Level ' + n + ', ' + (done ? s + ' of 3 stars' + inTime : isNext ? 'Next' : 'Not yet');
        const side = it.x < 50 ? 'r' : 'l';
        html += '<li class="fp-node ' + (done ? 'is-done' : isNext ? 'is-next' : 'is-not') + ' fp-side-' + side + '" style="top:' + (H - it.y - 28) + 'px;left:calc(' + it.x + '% - 28px)">' +
          '<button type="button" data-n="' + n + '" aria-label="' + esc(label) + '"' + (done || isNext ? '' : ' aria-disabled="true"') + '>' + n + '</button>' +
          (done ? '<span class="fp-nl" aria-hidden="true"><span class="fp-st">' + starText(s) + '</span>' + s + ' of 3 stars' + inTime + '</span>' : isNext ? '<span class="fp-nl" aria-hidden="true"><b>Next</b></span>' : '') + '</li>';
      }
      list.innerHTML = html;
      const nb = list.querySelector('[data-n="' + next + '"]');
      css.then(() => requestAnimationFrame(() => { if (nb) scroller.scrollTop = nb.parentNode.offsetTop - scroller.clientHeight / 2 + 28; }));
    }
    render();
    return {
      update(next) { o = Object.assign(o, next); render(); },
      destroy() { box.remove(); },
    };
  }

  // ================================================================ a level

  function mount(el, opts) {
    ensureCss();
    const MX = M();
    const o = Object.assign({ boost: {}, opts: {} }, opts);
    const level = MX.level(o.n);
    let game = MX.newGame(level, o.pieces, o.seed);
    const held = { pass: o.boost.pass | 0, turn: o.boost.turn | 0, more: o.boost.more | 0 };
    const set = { sound: o.opts.sound !== false, hints: o.opts.hints !== false };
    // The clock (SPEC "Set: the clock and the kingdom"): pace seconds a move; 0 is off. It ends nothing.
    let pace = PACES.some(([v]) => v === o.clock) ? o.clock : 0, paceChosen = false;
    const clk = { used: 0, from: null, begun: false, paused: false, said20: false, saidOut: false, t: 0 };
    const optsNow = () => Object.assign({ sound: set.sound, hints: set.hints }, paceChosen ? { clock: pace } : {}); // until chosen, the app's ring switch decides
    const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reduce = o.opts.reduce != null ? !!o.opts.reduce : !!(mq && mq.matches);
    const onMq = (e) => { reduce = e.matches; clockDom(); };
    if (mq && mq.addEventListener) mq.addEventListener('change', onMq);

    const snd = makeSound(() => set.sound);
    const buzz = (k) => { if (set.sound && navigator.vibrate) try { navigator.vibrate(HAPTIC[k]); } catch (e) { /* not on this device */ } };
    const thumbs = {};
    const thumb = (id) => (id in thumbs ? thumbs[id] : (thumbs[id] = o.thumb ? o.thumb(id) : null));
    const name = (id) => (o.name ? o.name(id) : id);

    // ---------------------------------------------------------- the frame
    const box = h('div', 'fp fp-level');
    box.innerHTML =
      '<div class="fp-top"><button type="button" class="btn btn-quiet fp-back">' + SVG_BACK + '<span>Map</span></button>' +
      '<h2 class="fp-title">Level ' + o.n + '</h2>' +
      '<button type="button" class="btn btn-quiet fp-snd" aria-pressed="' + set.sound + '">' + SVG_SOUND + '<span>Sound</span></button></div>' +
      '<div class="fp-status"><p class="fp-moves"><b></b><span>moves</span></p><div class="fp-goals"></div>' +
      '<div class="fp-score"><b></b><span class="fp-meter" aria-hidden="true"><i></i><s></s><s></s></span><span class="fp-sst"></span></div></div>' +
      '<p class="fp-say" aria-hidden="true"></p>' +
      '<div class="fp-boardwrap"><div class="fp-board"><div class="fp-cells" aria-hidden="true"></div><div class="fp-tiles" aria-hidden="true"></div>' +
      '<canvas class="fp-fx" aria-hidden="true"></canvas><div class="fp-grid" role="grid"></div><div class="fp-over" aria-hidden="true"></div></div></div>' +
      '<ul class="fp-legend" aria-label="Frames"></ul><div class="fp-boosts" role="group" aria-label="Boosters"></div>' +
      '<p class="visually-hidden fp-live" aria-live="polite"></p>';
    el.appendChild(box);
    const $ = (s) => box.querySelector(s);
    const board = $('.fp-board'), cellsL = $('.fp-cells'), tilesL = $('.fp-tiles'), grid = $('.fp-grid'), over = $('.fp-over'), cv = $('.fp-fx');
    const live = $('.fp-live'), sayEl = $('.fp-say');
    const ctx = cv.getContext('2d');
    const N = game.cols * game.rows;

    // ---------------------------------------------------------- geometry
    let pitch = 40, cellPx = 37, dpr = 1;
    const PAD = 12, GAP = 3;
    const cx = (i) => PAD + (i % game.cols) * pitch;
    const cy = (i) => PAD + Math.floor(i / game.cols) * pitch;
    function measure() {
      const avail = Math.min(480, Math.max(200, (el.clientWidth || 390) - 32));
      pitch = (avail - PAD * 2 + GAP) / game.cols;
      cellPx = pitch - GAP;
      const W = avail, H = PAD * 2 + game.rows * pitch - GAP;
      board.style.width = W + 'px'; board.style.height = H + 'px';
      board.style.setProperty('--cell', cellPx + 'px');
      board.style.setProperty('--p', (cellPx * 0.72) + 'px');
      dpr = Math.min(2, root.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // ---------------------------------------------------------- effects canvas
    const fx = [];
    let fxLive = false;
    function drawFx(now) {
      if (!fx.length && !fxLive) return false;
      ctx.clearRect(0, 0, cv.width / dpr, cv.height / dpr);
      for (let i = fx.length - 1; i >= 0; i--) {
        const f = fx[i];
        if (f.t0 == null) f.t0 = now;
        const t = (now - f.t0) / f.dur;
        if (t >= 1) { fx.splice(i, 1); continue; }
        if (t >= 0) f.draw(t);
      }
      fxLive = fx.length > 0;
      return fxLive;
    }
    const loop = makeLoop(drawFx);
    const addFx = (dur, draw, delay) => { fx.push({ dur, draw, t0: delay ? performance.now() + delay : null }); loop.kick(); };
    const wait = (ms) => loop.run(ms, () => {});

    function particles(i, colour, delay) {
      if (reduce) return;
      const x = cx(i) + cellPx / 2, y = cy(i) + cellPx / 2;
      const n = 6 + (i % 3), ps = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + i; ps.push([Math.cos(a), Math.sin(a), 2 + (k % 3)]); }
      addFx(420, (t) => {
        ctx.globalAlpha = 1 - t; ctx.fillStyle = colour;
        const d = cellPx * (0.2 + 0.9 * ease.out(t));
        for (const p of ps) { ctx.beginPath(); ctx.arc(x + p[0] * d, y + p[1] * d + 18 * t * t, p[2] * (1 - t * 0.5), 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
      }, delay);
    }
    function blast(cells, colour) { // reduced motion: blasts highlight their cells for 150 ms
      addFx(reduce ? 150 : 260, (t) => {
        ctx.globalAlpha = reduce ? 0.5 : 0.55 * (1 - t); ctx.fillStyle = colour;
        for (const c of cells) ctx.fillRect(cx(c) - 1, cy(c) - 1, cellPx + 2, cellPx + 2);
        ctx.globalAlpha = 1;
      });
    }
    function beam(i, sp, delay) {
      if (reduce) return;
      const x = cx(i) + cellPx / 2, y = cy(i) + cellPx / 2, W = cv.width / dpr, H = cv.height / dpr;
      addFx(200, (t) => {
        ctx.globalAlpha = 1 - t; ctx.fillStyle = '#FFFFFF';
        const th = cellPx * (0.5 - 0.35 * t);
        if (sp === 'row') ctx.fillRect(0, y - th / 2, W, th); else ctx.fillRect(x - th / 2, 0, th, H);
        ctx.globalAlpha = 1;
      }, delay);
    }
    function ring(i, r, delay) {
      if (reduce) return;
      const x = cx(i) + cellPx / 2, y = cy(i) + cellPx / 2;
      addFx(220, (t) => {
        ctx.globalAlpha = 1 - t; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(x, y, pitch * (0.4 + r * t), 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
      }, delay);
    }
    function ribbon(from, to, delay) { // the logo's ribbon arcs from the mark to each target
      if (reduce) return;
      const x0 = cx(from) + cellPx / 2, y0 = cy(from) + cellPx / 2, x1 = cx(to) + cellPx / 2, y1 = cy(to) + cellPx / 2;
      const mx = (x0 + x1) / 2 + (y1 - y0) * 0.3, my = (y0 + y1) / 2 - (x1 - x0) * 0.3 - 20;
      addFx(360, (t) => {
        const e = ease.out(Math.min(1, t * 1.6)), a = Math.max(0, t * 1.6 - 0.6);
        ctx.globalAlpha = 1 - Math.max(0, (t - 0.6) / 0.4);
        [['#A78BFF', 6], ['#6C9DFF', 3.5], ['#D9CCFF', 1.5]].forEach(([c, w]) => {
          ctx.strokeStyle = c; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.beginPath();
          for (let k = Math.floor(a * 16); k <= Math.round(e * 16); k++) {
            const u = k / 16, px = (1 - u) * (1 - u) * x0 + 2 * u * (1 - u) * mx + u * u * x1, py = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * my + u * u * y1;
            if (k === Math.floor(a * 16)) ctx.moveTo(px, py); else ctx.lineTo(px, py);
          }
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }, delay);
    }

    // ---------------------------------------------------------- tiles
    const byK = new Map();  // tile id -> element
    let at = [];            // cell -> element, as drawn
    const passEls = new Map();

    function place(e) { e.style.transform = 'translate3d(' + (e._x + (e._dx || 0)) + 'px,' + (e._y + (e._dy || 0)) + 'px,0) scale(' + e._s + ')'; e.style.opacity = e._o; }
    function tileLook(e, t) {
      const sig = [t.s, t.o, t.sw, t.sp, !!t.held].join('|');
      if (e._sig === sig) return;
      e._sig = sig;
      const suit = game.suits[t.s];
      if (t.sp === 'mark' || t.s < 0) {
        e.className = 'fp-t fp-mark';
        e.innerHTML = '<i class="fp-fr"></i><b>5s</b>';
        return;
      }
      e._hex = suit ? suit.hex : IRIS;
      e.className = 'fp-t fp-s-' + shapeOf(suit) + (t.held ? ' fp-held' : '') + (t.sp ? ' fp-sp-' + t.sp : '');
      const pic = t.o ? picStyle(thumb(t.o)) : t.sw != null && suit && suit.swatches ? bandsBg(suit.swatches[t.sw % suit.swatches.length]) : '';
      e.innerHTML = '<i class="fp-fr" style="background:' + (suit ? suit.hex : IRIS) + '"></i><i class="fp-pic" style=\'' + pic + '\'></i>' +
        (t.sp === 'row' || t.sp === 'col' ? '<i class="fp-bands"></i><i class="fp-glyph">' + (t.sp === 'row' ? '↔' : '↕') + '</i>' : '') +
        (t.sp === 'burst' ? '<i class="fp-ring"></i>' : '') + (t.held ? '<i class="fp-strap"></i>' : '');
    }
    function tileEl(t, i) {
      let e = byK.get(t.k);
      if (!e) {
        e = h('div', 'fp-t');
        e._x = cx(i); e._y = cy(i); e._s = 1; e._o = 1;
        byK.set(t.k, e);
        tilesL.appendChild(e);
      }
      tileLook(e, t);
      return e;
    }
    function dropEl(e) { byK.forEach((v, k) => { if (v === e) byK.delete(k); }); e.remove(); }

    function passEl(i, c) {
      let e = passEls.get(i);
      if (!c.pass) { if (e) { e.remove(); passEls.delete(i); } return; }
      if (!e) { e = h('div', 'fp-pass'); passEls.set(i, e); tilesL.appendChild(e); }
      e.style.transform = 'translate3d(' + cx(i) + 'px,' + cy(i) + 'px,0)';
      const sig = c.pass + '|' + c.pid;
      if (e._sig !== sig) {
        e._sig = sig;
        e.classList.toggle('fp-two', c.pass > 1);
        e.innerHTML = '<i class="fp-ppic" style=\'' + (c.pid ? picStyle(thumb(c.pid)) : '') + '\'></i>';
      }
    }

    function cellLook(i, c) {
      const e = cellEls[i];
      if (!e) return;
      const sig = [c.coats, c.first, c.colour].join('|');
      if (e._sig === sig) return;
      e._sig = sig;
      const fl = e.firstChild;
      let cls = 'fp-c';
      if (c.colour) { cls += ' fp-done'; fl.style.background = c.colour; fl.style.opacity = 1; fl.style.transform = 'none'; }
      else if (c.first) { cls += ' fp-h1'; fl.style.background = c.first; fl.style.opacity = 0.45; fl.style.transform = 'none'; }
      else if (c.coats > 0) { cls += c.coats > 1 ? ' fp-h2' : ' fp-h1'; fl.style.opacity = 0; }
      else fl.style.opacity = 0;
      e.className = cls;
    }

    // Everything drawn from the game as it stands (after each move, on resize, at the start).
    const cellEls = [];
    let gridCells = [];
    function build() {
      cellsL.textContent = '';
      cellEls.length = 0;
      grid.textContent = '';
      gridCells = [];
      grid.setAttribute('aria-label', 'Level ' + o.n + ' board, ' + game.cols + ' by ' + game.rows);
      grid.setAttribute('aria-rowcount', game.rows); grid.setAttribute('aria-colcount', game.cols);
      for (let r = 0; r < game.rows; r++) {
        const row = h('div', 'fp-row');
        row.setAttribute('role', 'row'); row.setAttribute('aria-rowindex', r + 1);
        row.style.top = (PAD + r * pitch) + 'px';
        for (let c = 0; c < game.cols; c++) {
          const i = r * game.cols + c;
          if (game.cells[i].hole) continue; // holes show the table and are not cells
          const ce = h('div', 'fp-c'); ce.appendChild(h('i', 'fp-fl'));
          ce.style.transform = 'translate3d(' + cx(i) + 'px,' + cy(i) + 'px,0)';
          cellsL.appendChild(ce); cellEls[i] = ce;
          const g = h('div', 'fp-gc');
          g.setAttribute('role', 'gridcell'); g.setAttribute('aria-colindex', c + 1); g.tabIndex = -1;
          g.dataset.i = i; g.style.left = (PAD + c * pitch) + 'px';
          row.appendChild(g); gridCells[i] = g;
        }
        grid.appendChild(row);
      }
    }
    function sync() {
      const live_ = new Set();
      at = new Array(N).fill(null);
      for (let i = 0; i < N; i++) {
        const c = game.cells[i];
        if (c.hole) continue;
        cellLook(i, c);
        passEl(i, c);
        if (c.t) {
          const e = tileEl(c.t, i);
          e._x = cx(i); e._y = cy(i); e._s = sel === i ? 1.08 : 1; e._o = 1; e._dx = e._dy = 0;
          e.style.willChange = '';
          e.classList.toggle('fp-sel', sel === i);
          place(e);
          at[i] = e; live_.add(c.t.k);
        }
      }
      byK.forEach((e, k) => { if (!live_.has(k)) { e.remove(); byK.delete(k); } });
      labels(); status();
    }

    // ---------------------------------------------------------- words for each cell
    function cellLabel(i) {
      const c = game.cells[i], t = c.t;
      const where = 'Row ' + (Math.floor(i / game.cols) + 1) + ', column ' + (i % game.cols + 1) + '.';
      const paint = c.colour ? ' Painted.' : c.first ? ' One coat of two.' : c.coats > 1 ? ' Unpainted, two coats.' : c.coats > 0 ? ' Unpainted.' : '';
      if (c.pass) return 'A pass, ' + plural(c.pass, 'layer') + (c.pid ? ': ' + name(c.pid) : '') + '. ' + where;
      if (!t) return 'Empty.' + paint + ' ' + where;
      if (t.sp === 'mark' || t.s < 0) return 'The mark: swap it with any tile to clear that frame.' + paint + ' ' + where;
      const suit = game.suits[t.s] || {};
      const thing = t.o ? name(t.o) : 'a swatch';
      return (t.held ? 'Held: ' : '') + suit.label + ', ' + thing + (t.sp ? ', ' + SP_WORDS[t.sp] : '') + '.' + (sel === i ? ' Selected.' : '') + paint + ' ' + where;
    }
    function labels() { for (let i = 0; i < N; i++) if (gridCells[i]) gridCells[i].setAttribute('aria-label', cellLabel(i)); }

    // ---------------------------------------------------------- status
    function goalWords(g) {
      if (g.type === 'score') return 'Score ' + fmt(g.n);
      if (g.type === 'paint') return 'Paint every cell';
      if (g.type === 'clear') return 'Clear every pass';
      return 'Collect ' + g.n + (g.kind ? ' ' + KIND_PL[g.kind] : ' · ' + ((game.suits[g.suit] || {}).label || ''));
    }
    function goalProgress(g) {
      const have = Math.min(g.have || 0, g.n);
      if (g.type === 'score') return fmt(Math.min(game.score, g.n)) + ' of ' + fmt(g.n);
      if (g.type === 'paint') return 'Paint ' + have + ' of ' + g.n;
      if (g.type === 'clear') return 'Cleared ' + have + ' of ' + g.n;
      return have + ' of ' + g.n;
    }
    function goalLeft(g) {
      const left = Math.max(0, g.n - (g.type === 'score' ? game.score : g.have || 0));
      if (!left) return '';
      if (g.type === 'score') return fmt(left) + ' points to go';
      if (g.type === 'paint') return plural(left, 'cell') + ' left to paint';
      if (g.type === 'clear') return plural(left, 'pass layer') + ' left';
      return left + ' more ' + (g.kind ? KIND_PL[g.kind] : (game.suits[g.suit] || {}).label);
    }
    function starsNow(sc) {
      const s = level.stars;
      return (s[0] ? sc >= s[0] : game.state !== 'play' && game.state !== 'out') + (sc >= s[1]) + (sc >= s[2]);
    }
    function status() {
      $('.fp-moves b').textContent = game.moves;
      $('.fp-moves span').textContent = game.moves === 1 ? 'move' : 'moves';
      $('.fp-goals').innerHTML = game.goals.map((g) => '<p><b>' + esc(goalWords(g)) + '</b><span>' + esc(goalProgress(g)) + '</span></p>').join('');
      const top = level.stars[2] || 1;
      const ss = box.querySelectorAll('.fp-meter s');
      ss[0].style.left = (100 * (level.stars[0] || level.stars[1] * 0.5) / top) + '%';
      ss[1].style.left = (100 * level.stars[1] / top) + '%';
      showScore(game.score);
      boosts();
    }
    function showScore(sc) {
      $('.fp-score b').textContent = fmt(sc);
      $('.fp-meter i').style.transform = 'scaleX(' + Math.min(1, sc / (level.stars[2] || 1)) + ')';
      const n = starsNow(sc);
      $('.fp-sst').textContent = starText(n);
      $('.fp-sst').setAttribute('aria-label', n + ' of 3 stars');
      $('.fp-score').setAttribute('aria-label', 'Score ' + fmt(sc) + ', ' + n + ' of 3 stars');
    }
    function say(text, ms) { // words in the status line (reduced motion) and booster instructions
      sayEl.textContent = text || '';
      clearTimeout(say.t);
      if (ms) say.t = setTimeout(() => { if (sayEl.textContent === text) sayEl.textContent = armed ? ARMED[armed] : ''; }, ms);
    }
    const tell = (text) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };

    // ---------------------------------------------------------- the clock: the person's own time only
    const clockSecs = () => pace * (level.moves + (game.more ? 5 : 0));
    const clockUsed = () => clk.used + (clk.from != null ? performance.now() - clk.from : 0);
    const clockLine = () => (pace ? mss(pace * level.moves) + ' for this level, ' + (pace === 5 ? 'five' : 'ten') +
      ' seconds a move. It stops while tiles move and never ends a level. Beat it and your building flies a flag.' : 'No clock for this level.');
    function clockDom() { // the five-second ring around Moves, the time under it; reduced motion: the time only
      const mv = $('.fp-moves');
      mv.querySelectorAll('.fp-cring, .fp-time').forEach((e) => e.remove());
      mv.classList.toggle('fp-clocked', !!pace && !reduce);
      $('.fp-status').classList.toggle('fp-has-clock', !!pace);
      if (pace && !reduce) {
        mv.insertAdjacentHTML('afterbegin', '<svg class="fp-cring" viewBox="0 0 56 56" aria-hidden="true"><defs><linearGradient id="fp-ring-grad" x1="0" y1="0" x2="1" y2="1">' +
          '<stop offset="0" style="stop-color:var(--ember-mark, #DE6A24)"/><stop offset="0.55" style="stop-color:var(--flare, #E5482B)"/><stop offset="1" style="stop-color:var(--iris, #7350EE)"/>' +
          '</linearGradient></defs><circle class="fp-rt" cx="28" cy="28" r="24"/><circle class="fp-rf" cx="28" cy="28" r="24"/></svg>');
      }
      if (pace) mv.insertAdjacentHTML('beforeend', '<span class="fp-time" role="timer"></span>');
      clockSync();
    }
    function clockSync() { // banks the time run so far, then runs only while the board waits: not while tiles move, a sheet is open or paused
      const now = performance.now();
      if (clk.from != null) clk.used += now - clk.from;
      clk.from = pace && clk.begun && started && !ended && !busy && !clk.paused && !outSheet && game.state === 'play' ? now : null;
      const f = $('.fp-rf');
      if (f) {
        const total = clockSecs() * 1000, left = Math.max(0, total - clk.used);
        f.style.transition = 'none';
        f.style.strokeDashoffset = RING_C * (1 - left / total);
        if (clk.from != null && left > 0) {
          getComputedStyle(f).strokeDashoffset; // the drain starts from here
          f.style.transition = 'stroke-dashoffset ' + Math.round(left) + 'ms linear';
          f.style.strokeDashoffset = RING_C;
        }
      }
      clockTick();
    }
    function clockTick() { // the time in text, once a second, and its two words
      clearTimeout(clk.t);
      const te = $('.fp-time');
      if (!te) return;
      const left = clockSecs() * 1000 - clockUsed(), text = left > 0 ? mss(Math.ceil(left / 1000)) : 'Time';
      if (te.textContent !== text) { te.textContent = text; te.setAttribute('aria-label', 'Clock ' + text); }
      if (clk.from == null) return;
      if (left > 0 && left <= 20000 && !clk.said20) { clk.said20 = true; tell('20 seconds on the clock.'); }
      if (left > 0) { clk.t = setTimeout(clockTick, ((Math.ceil(left) - 1) % 1000) + 1); return; }
      const f = $('.fp-rf');
      if (f) { f.style.transition = 'none'; f.style.strokeDashoffset = RING_C; } // empty, whatever the drawing's own timing
      if (!clk.saidOut) { clk.saidOut = true; say('Time. Play on.', 2000); tell('Time. Play on: nothing is lost.'); }
    }
    // The result as the app records it: the seconds used (whole, rounded up) and the seconds the clock gave.
    const resultNow = (g = game) => Object.assign(MX.result(g), { secs: pace && clk.begun ? Math.max(1, Math.ceil(clockUsed() / 1000)) : 0, clock: pace ? clockSecs() : 0 });

    // ---------------------------------------------------------- legend and boosters
    function legend() {
      $('.fp-legend').innerHTML = game.suits.map((s) => {
        const first = s.ids && s.ids[0];
        return '<li>' + miniTile(s, first ? thumb(first) : s.swatches && s.swatches[0] ? { colours: s.swatches[0] } : null, 26) +
          '<span>' + esc(s.label) + ' · ' + (s.ids && s.ids.length ? s.ids.length : 'your colours') + '</span></li>';
      }).join('');
    }
    function boosts() {
      const wrap = $('.fp-boosts');
      if (!wrap.firstChild) {
        wrap.innerHTML = BOOSTS.map((b) => '<button type="button" class="fp-boost" data-b="' + b.kind + '">' + b.glyph + '<span>' + b.word + '</span><b class="fp-n"></b></button>').join('');
        wrap.addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b && !b.disabled) useBoost(b.dataset.b); });
      }
      for (const b of BOOSTS) {
        const e = wrap.querySelector('[data-b="' + b.kind + '"]');
        const n = held[b.kind];
        const off = !n || !started || busy || game.state !== 'play' || (b.kind === 'more' && game.more);
        e.disabled = off;
        e.querySelector('.fp-n').textContent = n;
        e.setAttribute('aria-label', b.word + ', ' + n + ' held' + (b.kind === 'more' && game.more ? ', used this level' : ''));
        e.setAttribute('aria-pressed', armed === b.kind ? 'true' : 'false');
      }
    }

    // ---------------------------------------------------------- the steps, drawn
    const PHASE = { swap: 'swap', bounce: 'swap', shuffle: 'swap', fall: 'fall', drop: 'fall',
      match: 'hit', make: 'hit', fire: 'hit', clear: 'hit', paint: 'hit', block: 'hit', free: 'hit' };

    function moveTo(e, x, y, dur, fn, delay) {
      const x0 = e._x, y0 = e._y;
      if (reduce || dur <= 0) { e._x = x; e._y = y; place(e); return Promise.resolve(); }
      e.style.willChange = 'transform';
      return loop.run(dur, (t) => { const k = fn(t); e._x = x0 + (x - x0) * k; e._y = y0 + (y - y0) * k; place(e); if (t === 1) e.style.willChange = ''; }, delay);
    }
    function pop(e) {
      if (reduce) return Promise.resolve();
      const fl = h('i', 'fp-flash'); e.appendChild(fl);
      return loop.run(220, (t) => { e._s = 1.25 - 0.25 * ease.out(t); fl.style.opacity = 1 - t; place(e); if (t === 1) fl.remove(); });
    }
    function leave(e, delay) {
      if (reduce) return loop.run(150, (t) => { e._o = 1 - t; place(e); if (t === 1) dropEl(e); }, delay);
      e.style.willChange = 'transform, opacity';
      return loop.run(180, (t) => { e._s = t < 0.35 ? 1 + 0.15 * (t / 0.35) : 1.15 * (1 - (t - 0.35) / 0.65); e._o = 1 - t * t; place(e); if (t === 1) dropEl(e); }, delay);
    }
    function flood(i, colour, left, delay) {
      const e = cellEls[i];
      if (!e) return;
      const fl = e.firstChild;
      e._sig = null; // the next sync redraws this cell from the game
      fl.style.background = colour;
      const end = left > 0 ? 0.45 : 1;
      if (reduce) { fl.style.opacity = end; fl.style.transform = 'none'; if (!left) e.className = 'fp-c fp-done'; return; }
      loop.run(200, (t) => { fl.style.opacity = end; fl.style.transform = 'scale(' + ease.out(t) + ')'; if (t === 1 && !left) e.className = 'fp-c fp-done'; }, delay);
    }
    function scorePop(i, add) {
      if (reduce) return;
      const e = h('span', 'fp-pop', '+' + fmt(add));
      e.style.left = (cx(i) + cellPx / 2) + 'px'; e.style.top = cy(i) + 'px';
      over.appendChild(e);
      loop.run(500, (t) => { e.style.transform = 'translate3d(-50%,' + (-28 * ease.out(t)) + 'px,0)'; e.style.opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4; if (t === 1) e.remove(); });
    }
    function word(text) {
      if (!text) return;
      if (reduce) { say(text, 1200); return; }
      const e = h('p', 'fp-word', '<span>' + esc(text) + '</span>');
      over.appendChild(e);
      loop.run(960, (t) => {
        const ms = t * 960;
        const s = ms < 260 ? (ms < 170 ? 0.6 + 0.45 * (ms / 170) : 1.05 - 0.05 * ((ms - 170) / 90)) : 1;
        e.style.transform = 'translate3d(-50%,-50%,0) scale(' + s + ')';
        e.style.opacity = ms < 760 ? Math.min(1, ms / 120) : 1 - (ms - 760) / 200;
        if (t === 1) e.remove();
      });
    }

    async function playSteps(steps, quiet) {
      let pend = [], phase = null, wave = 1, waved = false;
      const delays = {};
      const flush = async () => { if (pend.length) await Promise.all(pend); pend = []; };
      let fires = 0, makes = 0; // the finale: a stripe made every 80 ms, fired every 120 ms
      for (let si = 0; si < steps.length; si++) {
        const s = steps[si];
        const ph = PHASE[s.e];
        if (ph === 'swap' || (ph === 'fall' && phase === 'hit')) await flush();
        if (ph === 'hit' && phase === 'fall') { await flush(); await wait(reduce ? 150 : 40); }
        if (ph) phase = ph;
        switch (s.e) {
          case 'swap': {
            const a = at[s.a], b = at[s.b];
            snd.play('swap'); buzz('swap');
            const ps = [];
            if (a) ps.push(moveTo(a, cx(s.b), cy(s.b), 160, ease.out));
            if (b) ps.push(moveTo(b, cx(s.a), cy(s.a), 160, ease.out));
            at[s.a] = b; at[s.b] = a;
            await Promise.all(ps);
            break;
          }
          case 'bounce': {
            const a = at[s.a], b = at[s.b];
            snd.play('bounce'); buzz('bounce');
            if (reduce || !a || !b) { say('No line there.', 1200); break; }
            const ax = cx(s.a), ay = cy(s.a), bx = cx(s.b), by = cy(s.b);
            const ux = Math.sign(bx - ax) * 4, uy = Math.sign(by - ay) * 4;
            await Promise.all([moveTo(a, bx + ux, by + uy, 160, ease.out), moveTo(b, ax - ux, ay - uy, 160, ease.out)]);
            await Promise.all([moveTo(a, ax, ay, 160, ease.back), moveTo(b, bx, by, 160, ease.back)]);
            break;
          }
          case 'wave':
            wave = s.n; fires = 0; waved = true;
            if (s.n > 1) { await flush(); await wait(reduce ? 150 : 40); }
            break;
          case 'match':
            snd.play('match', wave); buzz('match');
            break;
          case 'make': {
            if (quiet && !reduce && makes++) await wait(80);
            let e = at[s.cell];
            if (!e || !byK.has(s.tile.k)) {
              if (e && !byK.has(s.tile.k)) dropEl(e);
              e = tileEl(s.tile, s.cell); e._x = cx(s.cell); e._y = cy(s.cell); place(e);
            } else tileLook(e, s.tile);
            at[s.cell] = e;
            snd.play(s.tile.sp === 'mark' ? 'mark' : 'special'); buzz(s.tile.sp === 'mark' ? 'mark' : 'special');
            pend.push(pop(e));
            break;
          }
          case 'fire': {
            const sp = s.sp, c0 = s.cell, cells = s.cells || [];
            const base = quiet && !reduce ? Math.min(600, 120 * fires++) : 0;
            const mark = sp.indexOf('mark') === 0 && sp !== 'mark+mark', burst = /burst/.test(sp) && !/stripe/.test(sp);
            snd.play(sp.indexOf('mark') === 0 ? 'mark' : burst ? 'burst' : sp === 'stripe+burst' ? 'burst' : 'row');
            if (sp === 'row' || sp === 'col') beam(c0, sp, base);
            else if (sp === 'stripe+stripe') { beam(c0, 'row', base); beam(c0, 'col', base); }
            else if (sp === 'stripe+burst') for (const d of [-1, 0, 1]) { beam(c0 + d * game.cols, 'row', base); if ((c0 % game.cols) + d >= 0 && (c0 % game.cols) + d < game.cols) beam(c0 + d, 'col', base); }
            else if (burst) ring(c0, sp === 'burst' ? 1.6 : 2.8, base);
            else if (sp === 'mark+mark') ring(c0, Math.max(game.cols, game.rows), base);
            const step = mark ? Math.min(30, 900 / Math.max(1, cells.length)) : 25;
            const dist = (c) => Math.abs((c % game.cols) - (c0 % game.cols)) + Math.abs(Math.floor(c / game.cols) - Math.floor(c0 / game.cols));
            cells.forEach((c, k) => {
              const d = base + (mark ? k * step : burst ? 0 : step * dist(c));
              delays[c] = Math.max(delays[c] || 0, d);
              if (mark) ribbon(c0, c, d);
            });
            if (reduce) blast(cells, '#FFFFFF');
            break;
          }
          case 'clear': {
            const e = byK.get(s.k) || at[s.cell];
            const d = reduce ? 0 : delays[s.cell] || 0;
            delete delays[s.cell];
            if (at[s.cell] === e) at[s.cell] = null;
            if (e) { pend.push(leave(e, d)); particles(s.cell, e._hex || IRIS, d); }
            break;
          }
          case 'paint':
            snd.play('paint');
            flood(s.cell, s.colour, s.left, reduce ? 0 : delays[s.cell] || 0);
            break;
          case 'block': {
            const e = passEls.get(s.cell);
            if (e) {
              if (s.left > 0) { e.classList.toggle('fp-two', s.left > 1); e._sig = null; }
              else { passEls.delete(s.cell); pend.push(loop.run(reduce ? 150 : 200, (t) => { e.style.opacity = 1 - t; if (t === 1) e.remove(); })); }
            }
            break;
          }
          case 'free': {
            const e = at[s.cell];
            if (e) { e.classList.remove('fp-held'); const st = e.querySelector('.fp-strap'); if (st) st.remove(); e._sig = null; }
            break;
          }
          case 'fall': {
            const e = byK.get(s.k) || at[s.from];
            if (!e) break;
            if (at[s.from] === e) at[s.from] = null;
            at[s.to] = e;
            const rows = Math.max(1, Math.round(Math.abs(cy(s.to) - e._y) / pitch));
            pend.push(moveTo(e, cx(s.to), cy(s.to), 90 + 45 * rows, ease.back));
            break;
          }
          case 'drop': { // a new tile starts above its segment, as far up as the tiles that fill it (n)
            const e = tileEl(s.tile, s.cell);
            const n = s.n | 0;
            e._x = cx(s.cell); e._y = cy(s.cell) - (reduce ? 0 : n * pitch); e._s = 1; e._o = 0; place(e);
            at[s.cell] = e;
            pend.push(loop.run(reduce ? 150 : 120, (t) => { e._o = t; place(e); }));
            if (!reduce && n) pend.push(moveTo(e, cx(s.cell), cy(s.cell), 90 + 45 * n, ease.back));
            break;
          }
          case 'word':
            word(s.text);
            break;
          case 'score':
            if (s.cell != null && s.add) scorePop(s.cell, s.add);
            showScore(s.total); // the meter and the stars fill as the score rises
            if (quiet && !waved) { const mb = $('.fp-moves b'); mb.textContent = Math.max(0, +mb.textContent - 1); } // the finale: each move left becomes a stripe
            break;
          case 'shuffle': {
            const ps = [];
            for (const mv of s.moves || []) { const e = byK.get(mv[0]); if (e) ps.push(moveTo(e, cx(mv[1]), cy(mv[1]), 300, ease.out)); }
            await Promise.all(ps);
            break;
          }
          default: break;
        }
      }
      await flush();
    }

    // ---------------------------------------------------------- moves
    let busy = false, sel = null, armed = null, started = false, ended = false, swapsMade = 0, landing = null;
    const ARMED = { pass: 'Pass: press a tile and it leaves.', turn: 'Turn: swap any two neighbours.' };
    const neighbours = (a, b) => (Math.abs(a - b) === 1 && Math.floor(a / game.cols) === Math.floor(b / game.cols)) || Math.abs(a - b) === game.cols;
    const movable = (i) => { const c = game.cells[i]; return !!(c && !c.hole && c.t && !c.t.held && !c.pass); };
    const hasTile = (i) => { const c = game.cells[i]; return !!(c && !c.hole && c.t); };

    function select(i) {
      const prev = sel;
      sel = i;
      for (const j of [prev, i]) {
        if (j == null || !at[j]) continue;
        at[j]._s = sel === j ? 1.08 : 1; at[j].classList.toggle('fp-sel', sel === j);
        if (reduce) place(at[j]); else { const e = at[j]; const s0 = sel === j ? 1 : 1.08, s1 = sel === j ? 1.08 : 1; loop.run(80, (t) => { e._s = s0 + (s1 - s0) * t; place(e); }); }
      }
      if (gridCells[prev] && prev != null) { gridCells[prev].setAttribute('aria-selected', 'false'); gridCells[prev].setAttribute('aria-label', cellLabel(prev)); }
      if (i != null && gridCells[i]) { gridCells[i].setAttribute('aria-selected', 'true'); gridCells[i].setAttribute('aria-label', cellLabel(i)); tell('Selected. ' + cellLabel(i)); }
    }

    function report(prev, next) {
      for (const g of next.groups.slice(prev.groups.length)) {
        const su = next.suits[g.suit] || {};
        if (o.onAssociate) o.onAssociate({ ids: g.ids.slice(), key: su.key || null, label: su.label || '' });
      }
    }
    function sentence(steps) {
      let first = null, painted = 0;
      const words = [];
      for (const s of steps) {
        if (s.e === 'match' && !first) first = s;
        if (s.e === 'paint') painted++;
        if (s.e === 'word' && words.indexOf(s.text) < 0) words.push(s.text);
      }
      const parts = [];
      if (first) parts.push('Matched ' + first.cells.length + ' ' + ((game.suits[first.suit] || {}).label || '') + '.');
      if (painted) parts.push('Painted ' + painted + '.');
      return parts.concat(words, [plural(game.moves, 'move') + ' left.']).join(' ');
    }

    async function apply(r, kind) {
      if (!r || (!r.valid && !r.ok)) {
        if (r && r.steps && r.steps.length) await playSteps(r.steps);
        tell(kind === 'swap' ? 'No line there. No move spent.' : 'That booster can’t go there.');
        return false;
      }
      const prev = game;
      landing = r.game;   // the board this move lands on, for Back while its tiles still fall
      await playSteps(r.steps);
      landing = null;
      game = r.game;
      sync();
      report(prev, game);
      tell(sentence(r.steps));
      return true;
    }

    async function doSwap(a, b) {
      if (busy || ended || !hasTile(a) || !hasTile(b) || !neighbours(a, b)) return;
      if (armed === 'turn' && (!movable(a) || !movable(b))) return;
      busy = true; clockSync(); clearHint(); select(null);
      const turn = armed === 'turn';
      let r;
      if (turn) {
        r = MX.boost(game, 'turn', [a, b]);
        if (r.ok) { held.turn--; disarm(); if (o.onBoost) o.onBoost('turn'); }
      } else r = MX.swap(game, a, b);
      if (r.valid || r.ok) { coachOff(); clk.begun = true; } // the coach line covers a row: out of the way of the swap it taught
      const ok = await apply(r, turn ? 'boost' : 'swap');
      if (ok) swapsMade++;
      busy = false;
      settle();
    }

    async function useBoost(kind) {
      if (busy || ended) return;
      if (kind === 'more') {
        if (!held.more || game.more) return;
        const r = MX.boost(game, 'more');
        if (!r.ok) return;
        held.more--; if (o.onBoost) o.onBoost('more');
        game = r.game; clk.begun = true; sync();
        if (outSheet) { outSheet.done(); outSheet = null; }
        tell('Five more moves. ' + plural(game.moves, 'move') + ' left.');
        say('Five more moves.', 1200);
        settle();
        return;
      }
      if (armed === kind) { disarm(); return; }
      armed = kind; say(ARMED[kind]); tell(ARMED[kind]); boosts();
    }
    function disarm() { armed = null; say(''); boosts(); }
    async function passAt(i) {
      const c = game.cells[i];
      if (!c || c.hole || (!c.t && !c.pass)) return;
      busy = true; clockSync(); clearHint();
      const r = MX.boost(game, 'pass', i);
      if (r.ok) { held.pass--; clk.begun = true; if (o.onBoost) o.onBoost('pass'); }
      disarm();
      await apply(r, 'boost');
      busy = false;
      settle();
    }

    function settle() {
      status();
      if (game.state === 'won' && !ended) finish();
      else if (game.state === 'out' && !ended) showOut();
      else idle();
      clockSync();
    }

    // ---------------------------------------------------------- hints and the coach
    let hintT = 0, hintOn = null;
    function clearHint() {
      clearTimeout(hintT); hintT = 0;
      if (hintOn) { for (const i of hintOn) if (at[i]) { at[i].classList.remove('fp-hint'); at[i]._dx = at[i]._dy = 0; place(at[i]); } hintOn = null; }
    }
    function idle() {
      clearHint();
      if (set.hints && started && !ended && !busy && game.state === 'play') hintT = setTimeout(() => showHint(false), 5000);
    }
    function bestHint() { return coachPrefer() && !swapsMade ? MX.hint(game, coachPrefer()) || MX.hint(game) : MX.hint(game); }
    function showHint(manual) {
      clearHint();
      if (busy || ended || game.state !== 'play') return;
      const hv = bestHint();
      if (!hv) return;
      const [a, b] = hv, ea = at[a], eb = at[b];
      hintOn = [a, b];
      if (manual) tell('Hint: ' + cellLabel(a) + ' Swap it with ' + cellLabel(b));
      if (reduce) { if (ea) ea.classList.add('fp-hint'); if (eb) eb.classList.add('fp-hint'); }
      else {
        const ux = Math.sign(cx(b) - cx(a)) * 3, uy = Math.sign(cy(b) - cy(a)) * 3;
        loop.run(600, (t) => {
          const k = Math.sin(t * Math.PI * 2 * 2) > 0 ? Math.sin(t * Math.PI * 4) : 0;
          if (ea) { ea._dx = ux * k; ea._dy = uy * k; place(ea); }
          if (eb) { eb._dx = -ux * k; eb._dy = -uy * k; place(eb); }
        });
      }
      if (set.hints) hintT = setTimeout(() => showHint(false), 5000);
    }
    const COACH = {
      swap: 'Swap two neighbours to line up three in the same frame. Drag, or tap one then the other.',
      stripe: 'Line up four for a stripe. It clears its whole row or column.',
      burst: 'Make an L or a T for a burst. It bursts twice.',
      paint: 'A match paints the cells under it in your things’ colours. Paint them all.',
      mark: 'Line up five for the mark. Swap it with any tile to clear every tile in that frame.',
      pass: 'These are things you passed. Match beside them to clear them away.',
      held: 'Held tiles can’t move. Match through them to free them.',
    };
    const coachPrefer = () => (['stripe', 'burst', 'mark'].indexOf(level.coach) >= 0 ? level.coach : null);
    let coachEl = null;
    function coachOn() {
      if (!level.coach || !COACH[level.coach]) return;
      coachEl = h('div', 'fp-coach', '<p>' + esc(COACH[level.coach]) + '</p>');
      over.appendChild(coachEl);
      tell(COACH[level.coach]);
      const hv = bestHint();
      if (!hv) return;
      const [a, b] = hv;
      if (Math.floor(a / game.cols) >= game.rows / 2) coachEl.classList.add('fp-top-line');
      const hand = h('i', reduce ? 'fp-arrow' : 'fp-hand');
      coachEl.appendChild(hand);
      const x0 = cx(a) + cellPx / 2, y0 = cy(a) + cellPx / 2, x1 = cx(b) + cellPx / 2, y1 = cy(b) + cellPx / 2;
      if (reduce) {
        hand.textContent = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? (x1 > x0 ? '→' : '←') : (y1 > y0 ? '↓' : '↑');
        hand.style.transform = 'translate3d(' + ((x0 + x1) / 2) + 'px,' + ((y0 + y1) / 2) + 'px,0) translate(-50%,-50%)';
        return;
      }
      const cycle = () => coachEl && loop.run(1400, (t) => {
        const k = t < 0.15 ? 0 : t > 0.65 ? 1 : ease.out((t - 0.15) / 0.5);
        hand.style.transform = 'translate3d(' + (x0 + (x1 - x0) * k) + 'px,' + (y0 + (y1 - y0) * k) + 'px,0) scale(' + (t < 0.15 ? 1.1 - t : 1) + ')';
        hand.style.opacity = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1;
      }).then(cycle);
      cycle();
    }
    function coachOff() { if (coachEl) { coachEl.remove(); coachEl = null; } }

    // ---------------------------------------------------------- input
    let drag = null;
    function cellAt(e) { const g = e.target.closest && e.target.closest('[role="gridcell"]'); return g ? +g.dataset.i : null; }
    grid.addEventListener('pointerdown', (e) => {
      snd.wake();
      const i = cellAt(e);
      if (i == null || busy || ended || !started) return;
      e.preventDefault();
      focusCell(i, true);
      clearHint();
      drag = { i, x: e.clientX, y: e.clientY, id: e.pointerId, done: false };
      try { grid.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
    });
    grid.addEventListener('pointermove', (e) => {
      if (!drag || drag.done || e.pointerId !== drag.id || armed === 'pass') return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      const ax = Math.abs(dx) >= Math.abs(dy);
      const d = ax ? dx : dy;
      const el_ = at[drag.i];
      if (Math.abs(d) >= Math.max(10, 0.3 * pitch)) {
        drag.done = true;
        const c = drag.i % game.cols, r = Math.floor(drag.i / game.cols);
        const nc = c + (ax ? Math.sign(d) : 0), nr = r + (ax ? 0 : Math.sign(d));
        if (el_) { el_._dx = el_._dy = 0; place(el_); }
        if (nc >= 0 && nr >= 0 && nc < game.cols && nr < game.rows) doSwap(drag.i, nr * game.cols + nc);
        return;
      }
      if (el_ && movable(drag.i) && !reduce && Math.hypot(dx, dy) > 4) { // the tile follows the finger a little
        const lim = pitch * 0.18;
        el_._dx = ax ? Math.max(-lim, Math.min(lim, dx * 0.5)) : 0; el_._dy = ax ? 0 : Math.max(-lim, Math.min(lim, dy * 0.5)); place(el_);
      }
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const d = drag; drag = null;
      const el_ = at[d.i];
      if (el_) { el_._dx = el_._dy = 0; place(el_); }
      if (!d.done && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 10 && e.type === 'pointerup') tap(d.i);
    };
    grid.addEventListener('pointerup', endDrag);
    grid.addEventListener('pointercancel', endDrag);

    function tap(i) {
      if (busy || ended || !started) return;
      if (armed === 'pass') { passAt(i); return; }
      if (sel == null) { if (movable(i)) select(i); }
      else if (sel === i) { select(null); tell('Put down.'); }
      else if (neighbours(sel, i) && hasTile(i)) doSwap(sel, i);
      else if (movable(i)) select(i);
      else select(null);
    }

    let fi = null; // the focused cell (roving tabindex)
    function focusCell(i, quiet) {
      if (!gridCells[i]) return;
      if (fi != null && gridCells[fi]) gridCells[fi].tabIndex = -1;
      fi = i; gridCells[i].tabIndex = 0;
      if (!quiet) gridCells[i].focus();
    }
    function step(i, dx, dy) {
      let c = i % game.cols, r = Math.floor(i / game.cols);
      for (;;) {
        c += dx; r += dy;
        if (c < 0 || r < 0 || c >= game.cols || r >= game.rows) return null;
        const j = r * game.cols + c;
        if (gridCells[j]) return j;
      }
    }
    grid.addEventListener('keydown', (e) => {
      const d = DIRS[e.key];
      if (d && fi != null) {
        e.preventDefault();
        if (busy || ended) return;
        const nb = (fi % game.cols) + d[0] >= 0 && (fi % game.cols) + d[0] < game.cols ? fi + d[0] + d[1] * game.cols : -1;
        if (e.shiftKey || sel === fi) { if (nb >= 0 && nb < N) doSwap(fi, nb); return; }
        const j = step(fi, d[0], d[1]);
        if (j != null) focusCell(j);
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && fi != null) {
        e.preventDefault();
        if (armed === 'pass') { passAt(fi); return; }
        if (sel === fi) { select(null); tell('Put down.'); } else if (movable(fi)) select(fi);
      }
    });
    grid.addEventListener('focusin', (e) => { const i = cellAt(e); if (i != null && i !== fi) focusCell(i, true); });
    box.addEventListener('keydown', (e) => {
      snd.wake();
      if (e.target.closest('dialog')) return;
      if (e.key === 'Escape') { if (sel != null) { select(null); tell('Put down.'); } if (armed) disarm(); }
      else if ((e.key === 'h' || e.key === 'H') && !e.ctrlKey && !e.metaKey) showHint(true);
      else if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey) toggleSound();
      else return;
      e.preventDefault();
    });
    box.addEventListener('pointerdown', () => snd.wake());

    function toggleSound() {
      set.sound = !set.sound;
      $('.fp-snd').setAttribute('aria-pressed', set.sound);
      if (set.sound) snd.wake(); else snd.pause();
      tell(set.sound ? 'Sound on.' : 'Sound off.');
      if (o.onOpts) o.onOpts(optsNow());
    }
    $('.fp-snd').addEventListener('click', toggleSound);
    $('.fp-back').addEventListener('click', () => {
      if (started && !ended) { // mid-cascade, the move as it lands: a win made by it is recorded with its finale
        ended = true; clockSync();
        const g = landing || game;
        if (o.onEnd) o.onEnd(resultNow(g.state === 'won' ? MX.finale(g).game : g));
      }
      if (o.onMap) o.onMap();
    });

    // ---------------------------------------------------------- start: the level card
    // Up to 6, most things first (then the order made). A group whose things are all in one already shown adds no
    // pairing (hearts keep pairs), so it is not shown again: its Keep would disagree with the bigger group's.
    function endGroups(groups) {
      const out = [];
      for (const { g } of groups.map((g, i) => ({ g, i })).sort((a, b) => b.g.ids.length - a.g.ids.length || a.i - b.i)) {
        if (out.length < 6 && !out.some((x) => g.ids.every((id) => x.ids.includes(id)))) out.push(g);
      }
      return out;
    }
    function groupsHTML(groups) {
      const gs = endGroups(groups);
      if (!gs.length) return '';
      return '<section class="fp-sec"><h3>What you put together</h3><ul class="fp-groups">' + gs.map((g, i) => {
        const suit = game.suits.find((s) => s.key === g.key && s.label === g.label) || game.suits.find((s) => s.label === g.label);
        return '<li><span class="fp-gth">' + g.ids.map((id) => miniTile(suit, thumb(id), 36)).join('') + '</span>' +
          '<p>' + esc(g.label) + ': ' + esc(g.ids.map(name).join(', ')) + '</p>' +
          '<button type="button" class="btn btn-quiet fp-heart" data-g="' + i + '" aria-pressed="false">' + SVG_HEART + '<span>Keep</span></button></li>';
      }).join('') + '</ul></section>';
    }
    function wireHearts(d, groups) {
      const gs = endGroups(groups);
      d.querySelectorAll('.fp-heart').forEach((b) => b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on);
        b.querySelector('span').textContent = on ? 'Kept' : 'Keep';
        if (o.onHeart) o.onHeart({ ids: gs[+b.dataset.g].ids.slice(), on });
      }));
    }
    function legendHTML() {
      return '<ul class="fp-legend fp-legend-card">' + $('.fp-legend').innerHTML + '</ul>';
    }

    let ready = Promise.resolve();
    function decode() { // images are decoded before the level starts
      const srcs = new Set();
      for (const s of game.suits) for (const id of s.ids || []) { const th = thumb(id); if (th && th.src) srcs.add(th.src); }
      for (const c of game.cells) if (c.pid) { const th = thumb(c.pid); if (th && th.src) srcs.add(th.src); }
      const all = Array.from(srcs).slice(0, 60).map((src) => { const im = new Image(); im.src = src; return im.decode ? im.decode().catch(() => {}) : Promise.resolve(); });
      ready = Promise.race([Promise.all(all), new Promise((r) => setTimeout(r, 2500))]);
    }

    function levelCard() {
      const ep = M().EPISODES.find((e) => o.n >= e.from && o.n <= e.to) || M().EPISODES[M().EPISODES.length - 1];
      const d = openSheet(box, 'Level ' + o.n,
        '<p class="fp-ep-line">' + esc(ep.name) + ' · ' + esc(ep.line) + '</p>' +
        '<ul class="fp-goallist">' + game.goals.map((g) => '<li>' + esc(goalWords(g)) + '</li>').join('') + '</ul>' +
        '<p><b class="fp-big">' + game.moves + '</b> moves</p>' +
        (level.coach && COACH[level.coach] ? '<p class="fp-coachline">' + esc(COACH[level.coach]) + '</p>' : '') +
        '<section class="fp-sec"><h3>Your frames</h3>' + legendHTML() + '</section>' +
        (o.built ? '<p class="fp-builtline">Your building: ' + esc(o.built.name || 'a plain house') + ', ' + storeys(o.built.storeys) + '.' +
          (o.built.secs > 0 ? ' In time: best ' + mss(o.built.secs) + '.' : '') + '</p>' : '') +
        '<p class="small">Boosters: Pass ' + held.pass + ' · Turn ' + held.turn + ' · Five more ' + held.more + '</p>' +
        '<button type="button" class="switch" role="switch" aria-checked="' + set.hints + '" data-hints><span><b>Hints</b><br><span class="small">After five seconds, two tiles nudge.</span></span><span class="track" aria-hidden="true"></span></button>' +
        '<fieldset class="fieldset-seg fp-clockset"><legend><b>Clock</b></legend><div class="seg">' + PACES.map(([v, w]) =>
          '<label' + (pace === v ? ' class="on"' : '') + '><input type="radio" name="fp-clock" value="' + v + '"' + (pace === v ? ' checked' : '') + '>' + w + '</label>').join('') +
        '</div><p class="small fp-clockline">' + esc(clockLine()) + '</p></fieldset>' +
        '<div class="actions"><button type="button" class="btn btn-keep btn-big" data-play data-autofocus>Play</button></div>',
        () => { if (o.onMap) o.onMap(); });
      d.querySelector('[data-hints]').addEventListener('click', (e) => {
        set.hints = !set.hints;
        e.currentTarget.setAttribute('aria-checked', set.hints);
        if (o.onOpts) o.onOpts(optsNow());
      });
      d.querySelector('.fp-clockset').addEventListener('change', (e) => {
        pace = +e.target.value; paceChosen = true;
        d.querySelectorAll('.fp-clockset label').forEach((l) => l.classList.toggle('on', l.contains(e.target)));
        d.querySelector('.fp-clockline').textContent = clockLine();
        clockDom();
        if (o.onOpts) o.onOpts(optsNow());
      });
      d.querySelector('[data-play]').addEventListener('click', async (e) => {
        const byKey = !e.detail; // a key press: the board takes the focus; a tap leaves it unringed
        snd.wake();
        await ready;
        d.done();
        started = true;
        status();
        focusCell(firstCell(), !byKey);
        coachOn();
        idle();
      });
    }
    const firstCell = () => { for (let i = 0; i < N; i++) if (gridCells[i] && movable(i)) return i; return 0; };

    // ---------------------------------------------------------- the end
    let outSheet = null;
    function showOut() {
      snd.play('out');
      const left = game.goals.map(goalLeft).filter(Boolean);
      const canMore = held.more > 0 && !game.more;
      tell('Out of moves. ' + left.join('. ') + '.');
      outSheet = openSheet(box, 'Out of moves.',
        (left.length ? '<p class="fp-left">' + esc(left.join(' · ')) + '.</p>' : '') +
        '<p class="small">Nothing is lost. What you put together still counts.</p>' +
        groupsHTML(MX.result(game).groups) +
        '<div class="actions">' + (canMore ? '<button type="button" class="btn btn-keep btn-big" data-more data-autofocus>Five more</button>' : '') +
        '<button type="button" class="btn btn-big' + (canMore ? '' : ' btn-ink') + '" data-again' + (canMore ? '' : ' data-autofocus') + '>Try again</button>' +
        '<button type="button" class="btn btn-big" data-map>Map</button></div>',
        () => leaveTo('map'));
      wireHearts(outSheet, MX.result(game).groups);
      const m = outSheet.querySelector('[data-more]');
      if (m) m.addEventListener('click', () => useBoost('more'));
      outSheet.querySelector('[data-again]').addEventListener('click', () => leaveTo('again'));
      outSheet.querySelector('[data-map]').addEventListener('click', () => leaveTo('map'));
    }
    function leaveTo(where) {
      if (outSheet) { outSheet.done(); outSheet = null; }
      if (!ended) { ended = true; clockSync(); if (o.onEnd) o.onEnd(resultNow()); }
      if (where === 'again' && o.onNext) o.onNext(o.n); else if (where === 'map' && o.onMap) o.onMap();
    }

    async function finish() {
      ended = true; busy = true; clearHint(); coachOff(); boosts();
      // recorded now, from the engine: Back during the finale leaves before it ends (the clock stood since the move)
      const f = MX.finale(game), result = resultNow(f.game);
      const rec = o.onEnd ? o.onEnd(result) : null;
      await wait(reduce ? 150 : 300);
      loop.scale = 0.6;
      const hurry = () => { loop.scale = 0.2; }; // a tap hurries the finale
      box.addEventListener('pointerdown', hurry);
      await playSteps(f.steps, true);
      box.removeEventListener('pointerdown', hurry);
      loop.scale = 1;
      game = f.game;
      sync();
      const earned = (rec && (rec.earned || rec)) || {};
      for (const k of ['pass', 'turn', 'more']) held[k] = Math.min(9, held[k] + (earned[k] | 0));
      const saga = rec && rec.saga;
      const best = Math.max(result.score, (saga && saga.best && saga.best[o.n - 1]) || 0);
      snd.play('win', result.stars); buzz('win');
      word('Level ' + o.n + ' done.');
      if (result.painting && !reduce) { // the tiles lift away and leave the painting
        await loop.run(600, (t) => byK.forEach((e) => { e._o = 1 - t; e._dy = -14 * ease.out(t); place(e); }));
      } else await wait(reduce ? 200 : 600);
      if (result.stars === 3) { word('Three stars.'); await wait(reduce ? 0 : 500); }
      busy = false;
      const gotWords = [['pass', 'a Pass'], ['turn', 'a Turn'], ['more', 'Five more']].filter(([k]) => earned[k] > 0).map(([, w]) => w);
      // The clock's line: in time keeps a best and flies a flag, and earns nothing else.
      const bestT = saga && Array.isArray(saga.time) && saga.time[o.n - 1] > 0 ? saga.time[o.n - 1] : result.secs;
      const spare = result.clock - result.secs;
      const clockEnd = !result.clock || !rec ? null : rec.inTime
        ? ['In time: ' + mss(spare) + ' to spare. Best ' + mss(bestT) + '.', ' In time, ' + plural(spare, 'second') + ' to spare.']
        : [mss(result.secs) + '. The clock gave ' + mss(result.clock) + '. Race it again.', ' Not in time.'];
      // What the win built (the app chose the ways; ways[0] stands now), and an area built on its fifth level's first win.
      const ways = rec && rec.build && Array.isArray(rec.build.ways) ? rec.build.ways : null;
      const tall = (saga && saga.stars && saga.stars[o.n - 1]) || result.stars, flag = !!(saga && saga.time && saga.time[o.n - 1] > 0);
      const k = Math.floor((o.n - 1) / 5), A = MX.area(k), An = MX.area(k + 1);
      const builtText = (id) => 'Built: ' + (id ? name(id) : 'a plain house') + ', ' + storeys(tall) + (flag ? ', flying a flag' : '') + '.';
      const builtPic = (id) => miniTile(id ? null : { hex: MX.TOKENS[k % 6].hex, shape: 'square' }, id ? thumb(id) : null, 44);
      let wi = 0;
      tell('Level ' + o.n + ' done. ' + result.stars + ' of 3 stars. Score ' + fmt(result.score) + '.' + (clockEnd ? clockEnd[1] : ''));
      const d = openSheet(box, 'Level ' + o.n + ' done.',
        '<p class="fp-endstars"><span aria-hidden="true">' + starText(result.stars) + '</span> ' + result.stars + ' of 3 stars</p>' +
        '<p>Score ' + fmt(result.score) + ' · Best ' + fmt(best) + '</p>' +
        (clockEnd ? '<p class="fp-endclock">' + esc(clockEnd[0]) + '</p>' : '') +
        (gotWords.length ? '<p class="fp-earned">You earned ' + esc(gotWords.length > 1 ? gotWords.slice(0, -1).join(', ') + ' and ' + gotWords[gotWords.length - 1] : gotWords[0]) + '.</p>' : '') +
        (ways ? '<section class="fp-sec"><h3>Your kingdom</h3>' +
          (rec.first && o.n % 5 === 0 ? '<p class="fp-earned">' + esc(A.name) + ', built.</p><p>A new area: ' + esc(An.name) + '. ' + esc(An.line) + '</p>' : '') +
          '<div class="fp-built"><span class="fp-bpic">' + builtPic(ways[0]) + '</span><p class="fp-btext" aria-live="polite">' + esc(builtText(ways[0])) + '</p></div>' +
          '<div class="actions">' + (ways.length > 1 ? '<button type="button" class="btn btn-quiet" data-way>Another way <span class="fp-wayn">1 of ' + ways.length + '</span></button>' : '') +
          (o.onKingdom ? '<button type="button" class="btn btn-iris" data-kingdom>See it in your kingdom</button>' : '') + '</div></section>' : '') +
        (result.painting ? '<section class="fp-sec"><h3>Your painting</h3><canvas class="fp-paint" aria-label="The painting you made on this board"></canvas>' +
          '<p class="fp-keepmsg small" aria-live="polite"></p><div class="actions"><button type="button" class="btn btn-iris" data-keep>Keep this painting</button></div></section>' : '') +
        groupsHTML(result.groups) +
        '<div class="actions fp-endact"><button type="button" class="btn btn-keep btn-big" data-next data-autofocus>Next level</button>' +
        '<button type="button" class="btn btn-big" data-again>Play again</button><button type="button" class="btn btn-big" data-board>Your board</button></div>',
        () => { if (o.onMap) o.onMap(); });
      wireHearts(d, result.groups);
      if (result.painting) {
        const pc = d.querySelector('.fp-paint');
        if (root.FiveSBoard) root.FiveSBoard.drawPainting(pc, result.painting, 24);
        d.querySelector('[data-keep]').addEventListener('click', (e) => {
          const ok = o.onKeepPainting ? o.onKeepPainting(result.painting) : false;
          const msg = d.querySelector('.fp-keepmsg');
          if (ok) { e.currentTarget.disabled = true; e.currentTarget.textContent = 'Kept on your board'; msg.textContent = 'It is on your board now.'; }
          else msg.textContent = 'Your board holds 24 paintings. Remove one to keep this.';
        });
      }
      const way = d.querySelector('[data-way]');
      if (way) way.addEventListener('click', () => { // Irwin's three ways: whichever shows when the person leaves is the building
        wi = (wi + 1) % ways.length;
        d.querySelector('.fp-bpic').innerHTML = builtPic(ways[wi]);
        d.querySelector('.fp-btext').textContent = builtText(ways[wi]);
        way.querySelector('.fp-wayn').textContent = (wi + 1) + ' of ' + ways.length;
        if (o.onBuild) o.onBuild(ways[wi]);
      });
      const kg = d.querySelector('[data-kingdom]');
      if (kg) kg.addEventListener('click', () => { d.done(); o.onKingdom(o.n); });
      d.querySelector('[data-next]').addEventListener('click', () => { d.done(); if (o.onNext) o.onNext(o.n + 1); });
      d.querySelector('[data-again]').addEventListener('click', () => { d.done(); if (o.onNext) o.onNext(o.n); });
      d.querySelector('[data-board]').addEventListener('click', () => { d.done(); if (o.onBoard) o.onBoard(); });
    }

    // ---------------------------------------------------------- go
    measure(); build(); sync(); legend(); decode(); clockDom();
    let lastW = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastW) return;
      lastW = el.clientWidth;
      requestAnimationFrame(() => {
        measure(); build();
        for (const e of byK.values()) e._sig = null;
        for (const e of passEls.values()) e.remove();
        passEls.clear();
        if (!busy) sync();
        if (fi != null) focusCell(fi, true);
      });
    });
    ro.observe(el);
    // Paused by the page hiding or by the app (Set left); the page showing again resumes only what it paused itself.
    let appPaused = false;
    const halt = () => { loop.pause(); snd.pause(); clearTimeout(hintT); clk.paused = true; clockSync(); };
    const go = () => { loop.resume(); snd.resume(); idle(); clk.paused = false; clockSync(); };
    const onVis = () => (document.hidden ? halt() : !appPaused && go());
    document.addEventListener('visibilitychange', onVis);
    levelCard();

    const api = {
      pause() { appPaused = true; halt(); },
      resume() { appPaused = false; go(); },
      destroy() {
        loop.stop(); snd.close(); clearHint(); ro.disconnect(); clearTimeout(clk.t);
        document.removeEventListener('visibilitychange', onVis);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
        document.querySelectorAll('dialog.fp-sheet').forEach((d) => { if (d.open) d.close(); d.remove(); });
        box.remove();
      },
    };
    return api;
  }

  root.FiveSPlay = Object.freeze({ version: 1, mount, mountMap });
})(typeof self !== 'undefined' ? self : globalThis);
