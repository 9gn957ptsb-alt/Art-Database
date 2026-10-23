/* 5s play: Set's game in an element (SPEC.md, "Set: the board and the game").
 *
 * Candy Crush Saga's rules with the person's own things: the saga map (mountMap) and a level
 * (mount): the level card, the board, the out-of-moves sheet and the level end. Set, inside out
 * (mountSet, SPEC-set-inside-out): six whole pictures, one carried onto another, said alike or unlike
 * and in what; its rules are FiveSRelate's. mount stays for the shape game's return. The rules are
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
        e.innerHTML = '<i class="fp-fr"></i><b>5s</b><img class="fp-logo" src="logo.webp" alt="" draggable="false">';
        e.lastChild.onerror = function () { this.remove(); }; // a failed logo would show a broken-image icon over the drawn tile
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
        if (landing) report(game, landing);   // the landing move's pairings count, as when it settles
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
        // closed while a winning move still lands (the app's stopPlay: Example mode switched): the win is kept, as by Back
        if (started && !ended && landing && landing.state === 'won') {
          ended = true; clockSync(); report(game, landing);
          if (o.onEnd) o.onEnd(resultNow(MX.finale(landing).game));
        }
        loop.stop(); snd.close(); clearHint(); ro.disconnect(); clearTimeout(clk.t);
        document.removeEventListener('visibilitychange', onVis);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
        document.querySelectorAll('dialog.fp-sheet').forEach((d) => { if (d.open) d.close(); d.remove(); });
        box.remove();
      },
    };
    return api;
  }

  // ================================================================ Set, inside out: a level of six whole pictures
  // SPEC-set-inside-out §3, §4, §6 and §13, with the artist's answers (23 Oct 2026): no stars anywhere, and a turn is
  // noticed in words and rewards nothing. The rules are FiveSRelate's (pure); this draws them, takes the gestures and
  // keeps the clock. It never writes state: the callbacks do (onRelate at once, every pairing).

  const SET_WHY = { fresh: 'Kept, not set yet.', stayed: 'It stayed last level.', turn: 'A turn you kept in Sort.', thin: 'Set beside the fewest.', brought: 'Brought in by you.' };
  const SET_TAG = { again: 'Said before, it holds', turn: 'A turn', brought: 'Only you have this one', shared: 'Someone else too',
    apart: 'You see them apart', agree: 'Others’ words agree', yours: 'Your own eye', first: 'You’re the first' };
  const SET_HINT = 'Any two can go together. Which two would you hang side by side?';
  const SET_PASS = 'Pass: press a picture and it leaves.';
  const SET_SMALLER = 'Nothing more comes in: the board gets smaller now.';
  const SET_FULL = 'You have 60 words. Use one of them, or an aspect.';
  const GAP = 8, LIFT = 1.04, FOLLOW = 0.62, CARRY_PX = 12, LOOK_MS = 350, ANSWER_MS = 1600, HINT_MS = 10000;
  const up1 = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const low1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
  const dot = (s) => (/[.…!?]$/.test(s) ? s : s + '.');   // a short name may already end in "…"
  const sizeTo = (e, w, hh) => { e.style.width = w + 'px'; e.style.height = hh + 'px'; };

  // A whole picture at its own proportions: an <img> (its w and h, else read once it loads) or a Colour card's bands.
  function wholePic(p, cls) {
    let e;
    if (p && p.src) {
      e = new Image();
      e.alt = ''; e.draggable = false; e.decoding = 'async';
      e._r = p.w > 0 && p.h > 0 ? p.w / p.h : 0;
      if (!e._r) e.addEventListener('load', () => { e._r = e.naturalWidth / e.naturalHeight || 1; if (e._fit) e._fit(); }, { once: true });
      e.src = p.src;
    } else { e = h('span'); e.setAttribute('style', bandsBg(p && p.colours)); e._r = 4 / 3; }
    e.className = cls;
    return e;
  }
  // Whole inside W x H, never cropped; again when its proportions arrive.
  function fitPic(e, W, H) {
    e._fit = () => { const r = e._r || 1, w = Math.min(W, H * r); sizeTo(e, w, w / r); };
    e._fit();
    return e;
  }
  // Two side by side at one height, at most H tall and W wide together.
  function fitPair(a, b, H, W) {
    const go = () => { const ra = a._r || 1, rb = b._r || 1, hh = Math.min(H, (W - 6) / (ra + rb)); sizeTo(a, hh * ra, hh); sizeTo(b, hh * rb, hh); };
    a._fit = b._fit = go;
    go();
  }

  function mountSet(el, opts) {
    ensureCss();
    const RL = root.FiveSRelate, MX = M(), ASPECTS = root.FiveS.ASPECTS;
    const o = Object.assign({ boost: {}, opts: {} }, opts);
    const T = o.table, lv = RL.level(o.n || 1);
    const aspectOf = o.aspectOf || T.aspectOf || {};
    let game = o.free ? null : RL.newGame(lv, T, o.seed, o.lead);
    const free = !game;   // under six kept pictures: the first board, no level (pairing already works there)
    const mine = { made: [] };   // free mode keeps its relations here, where a Game would
    const fslots = T.pool.slice(0, 6).concat([null, null, null, null, null, null]).slice(0, 6);
    const slots = () => (free ? fslots : game.slots);
    const held = { pass: o.boost.pass | 0, turn: o.boost.turn | 0, more: o.boost.more | 0 };
    const set = { sound: o.opts.sound !== false, hints: o.opts.hints !== false };
    let pace = !free && PACES.some(([v]) => v === o.clock) ? o.clock : 0, paceChosen = false;
    let moves0 = game ? game.moves : 0;
    const clk = { used: 0, from: null, begun: false, paused: false, said20: false, saidOut: false, t: 0 };
    const optsNow = () => Object.assign({ sound: set.sound, hints: set.hints }, paceChosen ? { clock: pace } : {});
    const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    let reduce = o.opts.reduce != null ? !!o.opts.reduce : !!(mq && mq.matches);
    const onMq = (e) => { reduce = e.matches; clockDom(); };
    if (mq && mq.addEventListener) mq.addEventListener('change', onMq);
    const snd = makeSound(() => set.sound);
    const buzz = (k) => { if (set.sound && navigator.vibrate) try { navigator.vibrate(HAPTIC[k]); } catch (e) { /* not on this device */ } };
    const loop = makeLoop(() => false);
    const wait = (ms) => loop.run(ms, () => {});
    const name = (id) => (o.name ? o.name(id) : id);
    const maker = (id) => (o.by ? o.by(id) : null);
    const picOf = {};
    const pic = (id) => (id in picOf ? picOf[id] : (picOf[id] = o.pic ? o.pic(id) : null));
    const said = (s, w) => RL.saidText(T.vocab, aspectOf, s, w);   // the person's words: "Alike in line."
    const toGo = () => slots().filter(Boolean).length - 1 + (game ? game.pile : 0);

    // ---------------------------------------------------------- the frame
    const box = h('div', 'fp fp-set' + (free ? ' fs-free' : ''));
    box.innerHTML = (free ? ''   // the first board's lines and its Sort a five are the app's, around this view
      : '<div class="fp-top"><button type="button" class="btn btn-quiet fp-back">' + SVG_BACK + '<span>Map</span></button>' +
        '<h2 class="fp-title">Level ' + o.n + '</h2>' +
        '<button type="button" class="btn btn-quiet fp-snd" aria-pressed="' + set.sound + '">' + SVG_SOUND + '<span>Sound</span></button></div>' +
        '<div class="fp-status"><p class="fp-moves"><b></b> <span>to go</span></p><div class="fp-goals"><p><b>Set the board</b><span class="fs-made"></span></p></div>' +
        '<button type="button" class="fs-last" hidden></button></div>' +
        '<div class="fp-say fs-say"><p class="fs-say1"></p><p class="fs-say2"></p></div>') +
      '<div class="fs-stage"><div class="fs-board"><div class="fs-places" role="grid"></div><div class="fs-over" aria-hidden="true"></div></div></div>' +
      (free ? '<div class="fs-lastrow" hidden></div>' : '<div class="fp-boosts" role="group" aria-label="Boosters">' +
        BOOSTS.map((b) => '<button type="button" class="fp-boost" data-b="' + b.kind + '" disabled>' + b.glyph + '<span>' + b.word + '</span><b class="fp-n"></b></button>').join('') + '</div>') +
      '<div class="fs-ask" role="group" tabindex="-1" hidden></div><div class="fs-look" aria-hidden="true" hidden></div>' +
      '<p class="visually-hidden fp-live" aria-live="polite"></p>';
    el.appendChild(box);
    const $ = (s) => box.querySelector(s);
    const stage = $('.fs-stage'), boardEl = $('.fs-board'), grid = $('.fs-places'), over = $('.fs-over');
    const askEl = $('.fs-ask'), lookEl = $('.fs-look'), live = $('.fp-live');
    const tell = (text) => { live.textContent = ''; setTimeout(() => { live.textContent = text; }, 30); };
    if (!free) $('.fp-boosts').addEventListener('click', (e) => { const b = e.target.closest('[data-b]'); if (b && !b.disabled) useBoost(b.dataset.b); });

    // ---------------------------------------------------------- the places: 2 x 3 under 600 px wide, else 3 x 2
    let cols = 2, rows = 3, pw = 175, ph = 110, cells = [];
    const px = (i) => (i % cols) * (pw + GAP), py = (i) => Math.floor(i / cols) * (ph + GAP);
    function measure() {
      cols = (el.clientWidth || 390) >= 600 ? 3 : 2; rows = 6 / cols;
      const W = Math.min(840, stage.clientWidth || 358);
      pw = (W - GAP * (cols - 1)) / cols;
      ph = free ? Math.round(Math.max(110, Math.min(220, pw * 0.63))) : Math.max(110, Math.floor((stage.clientHeight - GAP * (rows - 1)) / rows));
      sizeTo(boardEl, W, rows * ph + GAP * (rows - 1));
    }
    const picEls = new Map();   // the board's pictures, one element a thing
    function boardPic(id) { if (!picEls.has(id)) picEls.set(id, wholePic(pic(id), 'fs-pic')); return picEls.get(id); }
    function build() {
      measure();
      grid.textContent = ''; cells = [];
      grid.setAttribute('aria-rowcount', rows); grid.setAttribute('aria-colcount', cols);
      for (let r = 0; r < rows; r++) {
        const row = h('div', 'fs-row');
        row.setAttribute('role', 'row'); row.setAttribute('aria-rowindex', r + 1);
        row.style.top = r * (ph + GAP) + 'px'; row.style.height = ph + 'px';
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, b = h('button', 'fs-pl');
          b.type = 'button'; b.setAttribute('role', 'gridcell'); b.setAttribute('aria-colindex', c + 1);
          b.dataset.i = i; b.tabIndex = -1; b.style.left = c * (pw + GAP) + 'px'; sizeTo(b, pw, ph);
          row.appendChild(b); cells[i] = b;
        }
        grid.appendChild(row);
      }
      for (let i = 0; i < 6; i++) draw(i);
      if (sel != null) cells[sel].classList.add('is-lift');
      if (ask && ask.i != null) cells[ask.i].classList.add('is-home');
      cells[fi != null ? fi : 0].tabIndex = 0;
      labels();
    }
    function draw(i, id) {   // place i as the game has it, or as given while a move lands
      const b = cells[i];
      if (!b) return;
      if (id === undefined) id = slots()[i];
      if (b._id !== id || (id && b.firstChild !== picEls.get(id))) {
        b._id = id; b.textContent = '';
        if (id) b.appendChild(boardPic(id));
        else if (free) b.innerHTML = '<span class="fs-keepin"><i aria-hidden="true">+</i>Keep one in Sort</span>';
      }
      b.dataset.id = id || '';
      b.classList.toggle('is-gone', !id && !free);
      b.classList.toggle('is-keep', !id && free);
      if (id) { const e = b.firstChild; e.style.transform = ''; e.style.opacity = ''; fitPic(e, pw, ph); }
    }

    // ---------------------------------------------------------- words for each place
    function relLines(id) {   // what the person has said of a thing, newest first: "alike in layout with Three Gardens House"
      const out = [], seen = new Set();
      const add = (a, b, s, w) => {
        const other = a === id ? b : b === id ? a : null;
        if (!other || seen.has(other)) return;
        seen.add(other); out.push(low1(said(s, w)).replace(/\.$/, '') + ' with ' + name(other));
      };
      const m = free ? mine.made : game.made;
      for (let k = m.length - 1; k >= 0; k--) add(m[k].x, m[k].y, m[k].s, m[k].w);
      Object.keys(T.rel).sort((a, b) => T.rel[b].at - T.rel[a].at).forEach((k) => { const ab = k.split('|'); add(ab[0], ab[1], T.rel[k].s, T.rel[k].w); });
      return out;
    }
    function thingWords(id) {
      const mk = maker(id), kind = o.kind ? o.kind(id) : null, ws = T.words[id] || [], rs = relLines(id).slice(0, 2);
      const who = T.src[id] === 'own' ? 'Brought in by you: ' + name(id) : (kind ? up1(kind) + ': ' : '') + name(id) + (mk ? ', by ' + mk : '');
      return dot(who) + (ws.length ? ' In others’ words: ' + ws.join(', ') + '.' : '') + (rs.length ? ' You said: ' + rs.join('; ') + '.' : '');
    }
    function cellLabel(i) {
      const id = slots()[i], where = ' Row ' + (Math.floor(i / cols) + 1) + ', column ' + (i % cols + 1) + '.';
      if (!id) return (free ? 'Keep one in Sort.' : 'Empty: set.') + where;
      return thingWords(id) + (sel === i ? ' Lifted.' : '') + where;
    }
    function labels() {
      for (let i = 0; i < 6; i++) if (cells[i]) cells[i].setAttribute('aria-label', cellLabel(i));
      const n = slots().filter(Boolean).length;
      grid.setAttribute('aria-label', (free ? 'Your first board, ' : 'Level ' + o.n + ' board, ') + cols + ' by ' + rows + '. ' + plural(n, 'picture') + '.' + (free ? '' : ' ' + toGo() + ' to go.'));
    }

    // ---------------------------------------------------------- the status, the say line and the last pairing
    let keep = ['', ''], sayT = 0;
    function sayShow(a, b, ms) {   // ms: for a while, then the move's own line again
      if (free) return;
      clearTimeout(sayT);
      $('.fs-say1').textContent = a || ''; $('.fs-say2').textContent = b || '';
      if (ms) sayT = setTimeout(() => sayShow(keep[0], keep[1]), ms);
    }
    function sayLine(a, b) { keep = [a || '', b || '']; sayShow(a, b); }
    function status() {
      labels();
      if (free) return;
      $('.fp-moves b').textContent = Math.max(0, toGo());
      const m = game.made, a = m.filter((x) => x.s > 0).length, u = m.length - a;
      $('.fs-made').textContent = m.length ? m.length + ' made · ' + [a ? a + ' alike' : '', u ? u + ' unlike' : ''].filter(Boolean).join(', ') : 'None made yet.';
      boosts();
    }
    let last = null;   // the last pairing: {x, y, s, w, ans, arr, smaller, back}
    function lastDraw() {
      if (!last) return;
      const dip = h('span', 'fs-dip'), a = wholePic(pic(last.x), 'fs-dpic'), b = wholePic(pic(last.y), 'fs-dpic');
      dip.append(a, b);
      if (free) {
        fitPair(a, b, 56, 140);
        const row = $('.fs-lastrow');
        row.hidden = false; row.textContent = '';
        row.append(dip, h('p', null, '<b>' + esc(said(last.s, last.w)) + '</b> ' + esc(last.ans.line)));
        return;
      }
      fitPair(a, b, 34, 96);
      const btn = $('.fs-last');
      btn.hidden = false; btn.textContent = ''; btn.appendChild(dip);
      btn.setAttribute('aria-label', 'Your last pairing: ' + name(last.x) + ' and ' + name(last.y) + '. Open it again.');
    }

    // ---------------------------------------------------------- the clock: the person's own time only
    // shortcut: a copy of mount's clock, merge when the shape game is deleted
    const clockSecs = () => pace * (moves0 + (game && game.more ? 5 : 0));
    const clockUsed = () => clk.used + (clk.from != null ? performance.now() - clk.from : 0);
    const clockLine = () => (pace ? mss(pace * moves0) + ' for this level. It stands while you say how two go, and never ends a level. Beat it and your building flies a flag.' : 'No clock for this level.');
    function clockDom() {   // the five-second ring around "to go", the time under it; reduced motion: the time only
      if (free) return;
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
    function clockSync() {   // banks the time run so far, then runs only while the person looks for a pair
      if (free) return;
      const now = performance.now();
      if (clk.from != null) clk.used += now - clk.from;
      clk.from = pace && clk.begun && started && !ended && !busy && !saying && !clk.paused && game.state === 'play' ? now : null;
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
    function clockTick() {
      clearTimeout(clk.t);
      const te = $('.fp-time');
      if (!te) return;
      const left = clockSecs() * 1000 - clockUsed(), text = left > 0 ? mss(Math.ceil(left / 1000)) : 'Time';
      if (te.textContent !== text) { te.textContent = text; te.setAttribute('aria-label', 'Clock ' + text); }
      if (clk.from == null) return;
      if (left > 0 && left <= 20000 && !clk.said20) { clk.said20 = true; tell('20 seconds on the clock.'); }
      if (left > 0) { clk.t = setTimeout(clockTick, ((Math.ceil(left) - 1) % 1000) + 1); return; }
      const f = $('.fp-rf');
      if (f) { f.style.transition = 'none'; f.style.strokeDashoffset = RING_C; }
      if (!clk.saidOut) { clk.saidOut = true; sayShow('Time. Play on.', '', 2000); tell('Time. Play on: nothing is lost.'); }
    }
    const resultNow = () => Object.assign(RL.result(game, T), { secs: pace && clk.begun ? Math.max(1, Math.ceil(clockUsed() / 1000)) : 0, clock: pace ? clockSecs() : 0 });
    const begin = () => { hintOff(); if (!free && started && !clk.begun) { clk.begun = true; clockSync(); } };

    // ---------------------------------------------------------- boosters
    function boostWhy(k) {   // why a booster cannot be used now ('' when it can)
      if (k === 'more') return !pace ? 'The clock is off.' : game.more ? 'Used this level.' : '';
      if (k === 'turn') return RL.back(game, T) ? '' : Object.keys(T.rel).length ? 'No earlier pair to bring back now.' : 'After your first pairing.';
      return slots().filter(Boolean).length > 1 ? '' : 'Nothing left to pass.';
    }
    function boosts() {
      if (free) return;
      const wrap = $('.fp-boosts'), can = started && !ended && (phase === 'idle' || phase === 'lifted');
      for (const b of BOOSTS) {
        const e = wrap.querySelector('[data-b="' + b.kind + '"]'), n = held[b.kind], why = n ? boostWhy(b.kind) : '';
        e.disabled = !n || !can;
        e.setAttribute('aria-disabled', why ? 'true' : 'false');
        e.querySelector('.fp-n').textContent = n;
        e.setAttribute('aria-label', b.word + ', ' + n + ' held' + (why ? '. ' + why : ''));
        e.setAttribute('aria-pressed', armed === b.kind ? 'true' : 'false');
      }
    }
    function useBoost(k) {
      if (!started || ended || (phase !== 'idle' && phase !== 'lifted')) return;
      const why = boostWhy(k);
      if (why) { sayShow(why, '', 2500); tell(why); return; }
      if (k === 'pass' && armed === 'pass') { disarm(); return; }
      putDown(true); begin();
      if (k === 'more') {
        held.more--; game.more = true;
        if (o.onBoost) o.onBoost('more');
        clockSync();
        const t = 'Five more: ' + plural(5 * pace, 'second') + ' more on the clock.';
        sayShow(t, '', 2500); tell(t); boosts();
      } else if (k === 'turn') {
        const b = RL.back(game, T);
        openAsk(b.a, b.b, b, null, null, null);
      } else { armed = 'pass'; sayShow(SET_PASS); tell(SET_PASS); boosts(); }
    }
    function disarm() { if (!armed) return; armed = null; sayShow(keep[0], keep[1]); boosts(); }
    async function passAt(i) {
      const id = slots()[i], r = RL.pass(game, T, i);
      armed = null;
      if (!id || r.game.passed.length === game.passed.length) { disarm(); return; }
      held.pass--;
      if (o.onBoost) o.onBoost('pass');
      setPhase('moving'); busy = true; clockSync();
      const e = cells[i].firstChild;
      await loop.run(reduce ? 150 : 200, (t) => { e.style.opacity = 1 - t; if (!reduce) e.style.transform = 'scale(' + (1 - 0.15 * t) + ')'; });
      game = r.game;
      draw(i);
      if (r.arrival) await arrive(i, null);
      busy = false;
      status();
      sayLine(name(id) + ' leaves, set beside nothing.', r.arrival ? 'In: ' + dot(name(r.arrival.id)) : 'The board gets smaller.');
      tell(keep.join(' ') + ' ' + toGo() + ' to go.');
      afterMove();
    }

    // ---------------------------------------------------------- lifting and the gestures
    let phase = free ? 'idle' : 'card', started = free, ended = false, busy = false, saying = false;
    let sel = null, target = null, armed = null, fi = null, ask = null, result = null, info = null, saidSmaller = false;
    function setPhase(p) { phase = p; box.dataset.phase = p; boosts(); }
    const pose = (e, x, y, s) => { if (e) e.style.transform = x || y || s !== 1 ? 'translate3d(' + x + 'px,' + y + 'px,0) scale(' + s + ')' : ''; };
    function lift(i, quiet) {
      if (sel != null && sel !== i) putDown(true);
      sel = i; cells[i].classList.add('is-lift'); setPhase('lifted');
      if (!reduce) pose(cells[i].firstChild, 0, 0, LIFT);
      snd.play('swap'); buzz('swap');
      if (!quiet) tell('Lifted: ' + name(slots()[i]) + '. Now choose the one to set it with.');
      labels();
    }
    function putDown(quiet) {
      aim(null);
      if (sel == null) return;
      const b = cells[sel];
      b.classList.remove('is-lift', 'is-home', 'is-carry');
      pose(b.firstChild, 0, 0, 1);
      sel = null; setPhase('idle');
      if (!quiet) tell('Put down.');
      labels();
    }
    function aim(i) {
      if (target != null && cells[target]) cells[target].classList.remove('is-target');
      target = i;
      if (i != null) cells[i].classList.add('is-target');
    }
    const canTouch = () => started && !ended && (phase === 'idle' || phase === 'lifted');
    const placeOf = (e) => { const b = e.target.closest && e.target.closest('.fs-pl'); return b && grid.contains(b) ? +b.dataset.i : null; };
    function placeAt(x, y) {   // the place under a point, from the layout (the carried picture never hides it)
      const r = boardEl.getBoundingClientRect(), lx = x - r.left, ly = y - r.top;
      for (let i = 0; i < 6; i++) if (lx >= px(i) && lx <= px(i) + pw && ly >= py(i) && ly <= py(i) + ph) return i;
      return null;
    }
    function flickTo(d) {   // a flick: 0.5 px/ms or more, toward a picture within 30° and at least 12° clearer than the next
      const b = d.pts[d.pts.length - 1], a = d.pts.find((p) => p[2] >= b[2] - 100) || d.pts[0], dt = b[2] - a[2];
      if (dt <= 0) return null;
      const vx = (b[0] - a[0]) / dt, vy = (b[1] - a[1]) / dt;
      if (Math.hypot(vx, vy) < 0.5) return null;
      const dir = Math.atan2(vy, vx), x0 = px(d.i) + pw / 2, y0 = py(d.i) + ph / 2, ang = [];
      slots().forEach((id, j) => {
        if (!id || j === d.i) return;
        let x = Math.abs(Math.atan2(py(j) + ph / 2 - y0, px(j) + pw / 2 - x0) - dir) * 180 / Math.PI;
        if (x > 180) x = 360 - x;
        ang.push([x, j]);
      });
      ang.sort((u, v) => u[0] - v[0]);
      return ang.length && ang[0][0] <= 30 && (ang.length < 2 || ang[1][0] - ang[0][0] >= 12) ? ang[0][1] : null;
    }
    let drag = null, ptrUp = 0;
    grid.addEventListener('pointerdown', (e) => {
      snd.wake();
      const i = placeOf(e);
      if (i == null || !canTouch() || drag) return;
      e.preventDefault();
      focusCell(i, true);
      begin();
      drag = { i, x: e.clientX, y: e.clientY, id: e.pointerId, pts: [[e.clientX, e.clientY, e.timeStamp]], carry: false, look: false, lookT: 0 };
      if (slots()[i]) drag.lookT = setTimeout(() => { if (drag && !drag.carry) { drag.look = true; openLook(slots()[drag.i]); } }, LOOK_MS);
      try { grid.setPointerCapture(e.pointerId); } catch (err) { /* synthetic pointers */ }
    });
    grid.addEventListener('pointermove', (e) => {
      const d = drag;
      if (!d || e.pointerId !== d.id || d.look) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y, dist = Math.hypot(dx, dy);
      d.pts.push([e.clientX, e.clientY, e.timeStamp]);
      if (d.pts.length > 12) d.pts.shift();
      if (dist > 6) clearTimeout(d.lookT);   // Look is a still press
      if (!d.carry) {
        if (dist < CARRY_PX || !slots()[d.i] || armed) return;
        d.carry = true;
        if (sel !== d.i) lift(d.i, true);
        cells[d.i].classList.add('is-home', 'is-carry');
      }
      if (!reduce) pose(cells[d.i].firstChild, dx * FOLLOW, dy * FOLLOW, LIFT);
      const t = placeAt(e.clientX, e.clientY);
      aim(t != null && t !== d.i && slots()[t] ? t : null);
    });
    const endDrag = (e) => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      drag = null; ptrUp = performance.now();
      clearTimeout(d.lookT);
      if (d.look) { closeLook(); return; }
      if (!d.carry) { if (e.type === 'pointerup') tap(d.i); return; }
      const t = e.type === 'pointerup' ? (target != null ? target : flickTo(d)) : null;
      cells[d.i].classList.remove('is-carry');
      aim(null);
      if (t != null) startSay(d.i, t); else home(d.i);
    };
    grid.addEventListener('pointerup', endDrag);
    grid.addEventListener('pointercancel', endDrag);
    // no click after a touch: the say panel opens under the finger as it lifts, and must not take that tap
    grid.addEventListener('touchend', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    // A click no pointer made: VoiceOver's double-tap
    grid.addEventListener('click', (e) => { const i = placeOf(e); if (i != null && performance.now() - ptrUp > 500) { begin(); tap(i); } });

    function home(i) {   // let go anywhere else: it glides home, nothing spent
      const e = cells[i].firstChild, m = /translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px/.exec((e && e.style.transform) || '');
      cells[i].classList.remove('is-home');
      const done = () => { putDown(true); tell('Put back. Nothing spent.'); };
      if (!m || reduce) { done(); return; }
      const x0 = +m[1], y0 = +m[2];
      setPhase('moving');
      loop.run(160, (t) => { const k = 1 - ease.out(t); pose(e, x0 * k, y0 * k, 1 + (LIFT - 1) * k); }).then(done);
    }
    function tap(i) {
      if (!canTouch()) return;
      const id = slots()[i];
      if (!id) { if (free && o.onSort) o.onSort(); return; }
      if (armed === 'pass') { passAt(i); return; }
      if (sel == null) lift(i);
      else if (sel === i) putDown();
      else startSay(sel, i);
    }

    // keys: the board is one tab stop; arrows move the focus (the target, once lifted); Enter or Space lifts and sets
    function focusCell(i, quiet) {
      if (!cells[i]) return;
      if (fi != null && cells[fi]) cells[fi].tabIndex = -1;
      fi = i; cells[i].tabIndex = 0;
      if (!quiet) cells[i].focus();
    }
    function stepFrom(i, dx, dy, full) {
      let c = i % cols, r = Math.floor(i / cols);
      for (;;) {
        c += dx; r += dy;
        if (c < 0 || r < 0 || c >= cols || r >= rows) return null;
        const j = r * cols + c;
        if (!full || slots()[j]) return j;
      }
    }
    grid.addEventListener('keydown', (e) => {
      const d = DIRS[e.key];
      if (d && fi != null) {
        e.preventDefault();
        if (!canTouch()) return;
        if (e.shiftKey) { const j = stepFrom(fi, d[0], d[1], true); if (j != null && slots()[fi]) { begin(); startSay(fi, j); } return; }
        const j = stepFrom(fi, d[0], d[1], !free);
        if (j == null) return;
        focusCell(j);
        if (sel != null) aim(j !== sel && slots()[j] ? j : null);
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && fi != null) {
        e.preventDefault();
        if (!canTouch()) return;
        begin();
        if (sel != null && fi !== sel && slots()[fi] && armed !== 'pass') startSay(sel, fi); else tap(fi);
      }
    });
    grid.addEventListener('focusin', (e) => { const i = placeOf(e); if (i != null && i !== fi) focusCell(i, true); });
    box.addEventListener('keydown', (e) => {
      snd.wake();
      if (e.target.closest('dialog, input')) return;
      const k = e.key, plain = !e.ctrlKey && !e.metaKey && !e.altKey;
      if (k === 'Escape') {
        if (!lookEl.hidden) closeLook();
        else if (phase === 'saying') putBack();
        else if (phase === 'answer') goOn();
        else { putDown(); disarm(); }
      } else if ((k === 'l' || k === 'L') && plain) {
        if (!lookEl.hidden) closeLook(); else if (fi != null && slots()[fi] && canTouch()) openLook(slots()[fi]);
      } else if ((k === 'h' || k === 'H') && plain && !free) showHint(true);
      else if ((k === 'm' || k === 'M') && plain && !free) toggleSound();
      else return;
      e.preventDefault();
    });
    box.addEventListener('pointerdown', () => snd.wake());

    // ---------------------------------------------------------- Look: press and hold still (or L); the clock runs on
    function openLook(id) {
      if (!id) return;
      const W = Math.max(160, stage.clientWidth - 32), H = Math.max(120, Math.min(stage.clientHeight || 300, 520) * 0.62);
      const inner = h('div', 'fs-lookin'), mk = maker(id), kind = o.kind ? o.kind(id) : null, ws = T.words[id] || [], rs = relLines(id);
      inner.appendChild(fitPic(wholePic(pic(id), 'fs-lpic'), W, H));
      inner.insertAdjacentHTML('beforeend', '<p class="fs-lname">' + esc(name(id)) + '</p>' +
        (T.src[id] === 'own' ? '<p class="small">Brought in by you</p>' : mk || kind ? '<p class="small">' + esc([mk, kind && up1(kind)].filter(Boolean).join(' · ')) + '</p>' : '') +
        (ws.length ? '<p class="fs-lwords"><span>In others’ words:</span> ' + esc(ws.join(', ')) + '</p>' : '') +
        (rs.length ? '<p class="fs-lsaid">You said: ' + esc(rs.join('; ')) + '.</p>' : ''));
      lookEl.textContent = '';
      lookEl.appendChild(inner);
      lookEl.style.top = stage.offsetTop + 'px'; lookEl.style.minHeight = stage.offsetHeight + 'px';
      lookEl.hidden = false;
      tell('Look: ' + thingWords(id));
    }
    function closeLook() { lookEl.hidden = true; lookEl.textContent = ''; }

    // ---------------------------------------------------------- How do they go? (the say panel)
    const askH = () => (free || box.clientHeight >= 720 ? 110 : 88);
    function startSay(i, j) {   // place i carried onto place j
      const x = slots()[i], y = slots()[j];
      if (!x || !y || i === j) return;
      if (sel != null && sel !== i) putDown(true);
      const from = [i, j].map((k) => cells[k].firstChild.getBoundingClientRect());
      sel = i; aim(null);
      cells[i].classList.remove('is-lift', 'is-carry');
      cells[i].classList.add('is-home');
      pose(cells[i].firstChild, 0, 0, 1);
      openAsk(x, y, null, i, j, from);
    }
    function openAsk(x, y, back, i, j, from) {
      ask = { x, y, back, i, j, s: 0, typing: false, full: false };
      saying = true; clockSync(); hintOff(); closeLook();
      setPhase('saying');
      box.classList.add('fs-saying');
      grid.inert = true;
      if ($('.fp-boosts')) $('.fp-boosts').inert = true;
      askEl.style.top = (free ? stage.offsetTop : $('.fs-say').offsetTop) + 'px';
      askEl.hidden = false;
      const q = back ? 'You said: ' + low1(said(back.s, back.w)) + ' And now?' : 'How do they go?';
      askEl.setAttribute('aria-label', q + ' ' + name(x) + ' and ' + name(y) + '.');
      askEl.innerHTML = '<div class="fs-askin"><div class="fs-sayrow"></div><p class="fs-names">' + esc(name(x)) + ' · ' + (back ? 'and' : 'onto') + ' · ' + esc(name(y)) + '</p>' +
        '<div class="fs-dip fs-dipask"></div><h3 class="fs-q">' + esc(q) + '</h3>' +
        '<div class="fs-two"><button type="button" class="fs-sbtn" data-s="1" aria-pressed="false">Alike</button><button type="button" class="fs-sbtn" data-s="-1" aria-pressed="false">Unlike</button></div>' +
        '<div class="fs-what"></div></div>';
      const dip = $('.fs-dipask'), a = wholePic(pic(x), 'fs-dpic'), b = wholePic(pic(y), 'fs-dpic');
      dip.append(a, b);
      fitPair(a, b, askH(), Math.min(480, dip.clientWidth || 340));
      renderWhat();
      grow();
      askEl.focus({ preventScroll: true });
      rise(from);
    }
    function grow() { if (free) box.style.minHeight = askEl.offsetTop + askEl.scrollHeight + 16 + 'px'; }
    function rise(from) {   // the two rise from their places; reduced motion: they appear in place
      const tos = Array.from(askEl.querySelectorAll('.fs-dipask > *')), rest = Array.from(askEl.querySelectorAll('.fs-askin > :not(.fs-dipask)'));
      if (reduce || !from) { askEl.style.opacity = 0; loop.run(150, (t) => { askEl.style.opacity = t; }).then(() => { askEl.style.opacity = ''; }); return; }
      const to = tos.map((e) => e.getBoundingClientRect());
      loop.run(240, (t) => {
        const k = ease.out(t);
        tos.forEach((e, n) => {
          const f = from[n], r = to[n], s = f.width / (r.width || 1);
          e.style.transformOrigin = '0 0';
          e.style.transform = 'translate3d(' + (f.left - r.left) * (1 - k) + 'px,' + (f.top - r.top) * (1 - k) + 'px,0) scale(' + (s + (1 - s) * k) + ')';
        });
        rest.forEach((e) => { e.style.opacity = k; });
      }).then(() => { tos.forEach((e) => { e.style.transform = ''; }); rest.forEach((e) => { e.style.opacity = ''; }); });
    }
    function renderWhat() {   // the say row, and "in what" once Alike or Unlike is chosen
      const a = ask;
      $('.fs-sayrow').innerHTML = a.s ? '<span>Tap one, or</span><button type="button" class="btn btn-quiet fs-goon" data-goon>Go on</button>'
        : '<button type="button" class="btn btn-quiet" data-putback>Put back</button>';
      askEl.querySelectorAll('[data-s]').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.s === a.s)));
      const what = $('.fs-what');
      if (!a.s) { what.innerHTML = ''; return; }
      const c = RL.chips(T, free ? mine : game, a.x, a.y, a.s);
      const chip = (k, v, text, cls) => '<button type="button" class="fs-chip' + (cls ? ' ' + cls : '') + '" data-' + k + '="' + esc(v) + '">' + esc(text) + '</button>';
      what.innerHTML = '<h3 class="fs-q2">' + (a.s > 0 ? 'Alike' : 'Unlike') + ' in what?</h3>' +
        (c.mine.length ? '<div class="fs-chips" role="group" aria-label="Your words"><span class="fs-lab" aria-hidden="true">Your words</span>' +
          c.mine.map((w) => chip('w', w, RL.wordOf(T.vocab, w), 'fs-mine')).join('') + '</div>' : '') +
        '<div class="fs-chips" role="group" aria-label="Aspects">' + c.aspects.map((w) => chip('w', w, up1(ASPECTS[w - 1]), '')).join('') + '</div>' +
        '<div class="fs-chips">' + (a.typing ? '<form class="fs-wordf"><input class="fs-word" type="text" maxlength="24" enterkeyhint="done" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="Your word"></form>'
          : '<button type="button" class="fs-chip fs-add" data-add>+ Your word</button>') + '</div>' +
        (a.full ? '<p class="fs-full" role="status">' + esc(SET_FULL) + '</p>' : '') +
        (c.others.length ? '<div class="fs-chips" role="group" aria-label="In others’ words"><span class="fs-lab" aria-hidden="true">In others’ words</span>' +
          c.others.map((t) => chip('o', t, t, 'fs-drawn')).join('') + '</div>' : '');
      grow();
    }
    function choose(s) {
      ask.s = s;
      snd.play('match', s > 0 ? 3 : 1);
      renderWhat();
    }
    function addWordThen(text) {
      const w = o.onWord ? o.onWord(text) : null;
      if (w == null) { ask.full = true; ask.typing = false; renderWhat(); return; }
      commit(ask.s, w);
    }
    askEl.addEventListener('click', (e) => {
      if (!ask) return;
      if (phase === 'answer') { if (!e.target.closest('[data-note]')) goOn(); return; }
      if (phase !== 'saying') return;
      const t = e.target.closest('button, input, form, .fs-dip');
      if (!t) {   // a tap outside the two: Put back, or Go on once Alike or Unlike is said
        if (ask.s) commit(ask.s, 0); else putBack();
        return;
      }
      if (t.matches('[data-putback]')) putBack();
      else if (t.matches('[data-goon]')) commit(ask.s, 0);
      else if (t.matches('[data-s]')) choose(+t.dataset.s);
      else if (t.matches('[data-w]')) commit(ask.s, +t.dataset.w);
      else if (t.matches('[data-o]')) addWordThen(t.dataset.o);
      else if (t.matches('[data-add]')) { ask.typing = true; renderWhat(); $('.fs-word').focus(); }
    });
    askEl.addEventListener('submit', (e) => { e.preventDefault(); const f = $('.fs-word'); if (f && f.value.trim()) addWordThen(f.value); });
    askEl.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && e.target.closest('input')) { e.preventDefault(); e.stopPropagation(); putBack(); }
      else if (phase === 'answer' && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) { e.preventDefault(); goOn(); }
    });
    function closeAsk() {
      askEl.hidden = true; askEl.textContent = ''; box.classList.remove('fs-saying'); box.style.minHeight = '';
      grid.inert = false;
      if ($('.fp-boosts')) $('.fp-boosts').inert = false;
    }
    function putBack() {
      if (!ask || phase !== 'saying') return;
      const back = ask.back, refocus = askEl.contains(document.activeElement);
      ask = null; closeAsk();
      saying = false; sel != null && cells[sel].classList.remove('is-home');
      putDown(true); setPhase('idle');
      if (refocus) focusCell(fi != null ? fi : 0);
      tell(back ? 'Not said again. Nothing spent.' : 'Put back. Nothing spent.');
      clockSync(); idleHint();
    }

    // ---------------------------------------------------------- the move said, then the other eyes
    let goR = null, goT = 0;
    function goOn() { clearTimeout(goT); const r = goR; goR = null; if (r) r(); }
    async function commit(s, w) {
      const a = ask;
      if (!a || phase !== 'saying' || !(s === 1 || s === -1)) return;
      setPhase('answer');
      let ans, arr = null;
      if (free) { ans = RL.answer(T, mine, a.x, a.y, s, w); mine.made.push({ x: a.x, y: a.y, s, w, kind: ans.kind, line: ans.line }); }
      else { const r = RL.say(game, T, a.x, a.y, s, w); ans = r.answer; arr = r.arrival; game = r.game; }
      if (a.back) { held.turn--; if (o.onBoost) o.onBoost('turn'); }
      if (o.onRelate) o.onRelate({ x: a.x, y: a.y, s, w });
      coachOff();
      if (ans.kind === 'turn') { snd.play('special'); buzz('special'); } else buzz('match');
      const smaller = !free && !a.back && !arr && !saidSmaller && game.state === 'play';
      if (smaller) saidSmaller = true;
      last = { x: a.x, y: a.y, s, w, ans, arr, smaller, back: !!a.back };
      if (arr) boardPic(arr.id);   // known now: its picture loads while the answer shows
      if (!free && game.state === 'done') { ended = true; result = resultNow(); info = o.onEnd ? o.onEnd(result) : null; }
      showAnswer(last, false);
      await new Promise((r) => { goR = r; if (ans.kind !== 'turn') goT = setTimeout(goOn, ANSWER_MS); });   // a turn waits: Note why is there
      await land(last, a);
    }
    function showAnswer(m, again) {
      const turn = m.ans.kind === 'turn';
      askEl.setAttribute('aria-label', said(m.s, m.w) + ' ' + name(m.x) + ' and ' + name(m.y) + '.');
      askEl.innerHTML = '<div class="fs-askin fs-answer"><div class="fs-sayrow">' + (again || free || m.back ? '' : esc(name(m.x)) + ' is set. ' + esc(name(m.y)) + ' stays.') + '</div>' +
        '<div class="fs-dip fs-dipask"></div><p class="fs-said">' + esc(said(m.s, m.w)) + '</p>' +
        '<div class="fs-eye' + (turn ? ' is-turn' : '') + '"><b>' + (turn ? 'A turn' : 'Other eyes') + '</b><p>' + esc(m.ans.line) + '</p>' +
        (turn && o.onNote ? '<button type="button" class="btn btn-quiet" data-note>Note why</button>' : '') + '</div>' +
        (m.arr && !again ? '<div class="fs-arrive"><span class="fs-apic"></span><p><b>In: ' + esc(dot(name(m.arr.id))) + '</b>' + (m.arr.line ? ' ' + esc(m.arr.line) : '') + '</p></div>'
          : m.smaller && !again ? '<p class="fs-arrive">' + esc(SET_SMALLER) + '</p>' : '') +
        '<p class="fs-tapon">Tap to go on</p></div>';
      const dip = $('.fs-dipask'), a = wholePic(pic(m.x), 'fs-dpic'), b = wholePic(pic(m.y), 'fs-dpic');
      dip.append(a, b);
      fitPair(a, b, free ? 110 : askH() + 22, Math.min(480, dip.clientWidth || 340));
      if (m.arr && !again) $('.fs-apic').appendChild(fitPic(wholePic(pic(m.arr.id), 'fs-dpic'), 72, 48));
      const nb = $('[data-note]');
      if (nb) nb.addEventListener('click', () => o.onNote({ ids: [m.x, m.y] }, nb));
      grow();
      askEl.focus({ preventScroll: true });
      if (reduce) { askEl.style.opacity = 0; loop.run(150, (t) => { askEl.style.opacity = t; }).then(() => { askEl.style.opacity = ''; }); }
    }
    // The answer closes: the carried one shrinks into the last pairing, and what arrives falls into its place.
    async function land(m, a) {
      setPhase('moving'); busy = true;
      const xEl = $('.fs-dipask > *'), from = xEl && xEl.getBoundingClientRect(), refocus = askEl.contains(document.activeElement);
      ask = null; closeAsk();
      if (sel != null) cells[sel].classList.remove('is-home');
      sel = null;
      if (!free && !m.back) {
        const old = cells[a.i].firstChild;
        if (reduce && old) await loop.run(150, (t) => { old.style.opacity = 1 - t; });
        draw(a.i, null);
        lastDraw();
        if (!reduce && from) await flyTo(xEl, from, $('.fs-last'));
        draw(a.i);
        if (m.arr) await arrive(a.i, a.j);
      } else lastDraw();
      busy = false; saying = false;
      status();
      if (!free) sayLine(said(m.s, m.w) + ' ' + m.ans.line, m.arr ? m.arr.line : m.smaller ? SET_SMALLER : '');
      const words = [said(m.s, m.w), m.ans.line];
      if (!free && !m.back) words.push(name(m.y) + ' stays.');
      if (m.arr) words.push(m.arr.line ? 'In: ' + name(m.arr.id) + ', ' + low1(m.arr.line) : 'In: ' + dot(name(m.arr.id)));
      else if (m.smaller) words.push(SET_SMALLER);
      if (!free) words.push(toGo() + ' to go.');
      tell(words.join(' '));
      if (refocus) focusCell(!free && !m.back && slots()[a.j] ? a.j : fi != null ? fi : 0);
      afterMove();
    }
    function afterMove() {
      if (!free && game.state === 'done') {
        if (!ended) { ended = true; result = resultNow(); info = o.onEnd ? o.onEnd(result) : null; }
        finish();
        return;
      }
      setPhase('idle'); clockSync(); idleHint();
    }
    function flyTo(src, from, to) {   // a copy of a picture from one place on the page to another, shrinking
      if (!to || to.hidden) return Promise.resolve();
      const b = box.getBoundingClientRect(), t = to.getBoundingClientRect(), e = src.cloneNode(false);
      e.className = 'fs-fly';
      Object.assign(e.style, { left: from.left - b.left + box.scrollLeft + 'px', top: from.top - b.top + box.scrollTop + 'px', width: from.width + 'px', height: from.height + 'px', transform: '' });
      box.appendChild(e);
      const dx = t.left - from.left, dy = t.top - from.top, s = Math.min(t.width / 2, t.height * (src._r || 1)) / from.width;
      return loop.run(260, (k) => { const q = ease.out(k); e.style.transform = 'translate3d(' + dx * q + 'px,' + dy * q + 'px,0) scale(' + (1 + (s - 1) * q) + ')'; e.style.opacity = 1 - 0.6 * q; }).then(() => e.remove());
    }
    function arrive(i, j) {   // an arrival falls into its place, with a thin thread from the picture that stayed
      const e = cells[i] && cells[i].firstChild;
      snd.play('paint');
      if (!e) return Promise.resolve();
      e.style.opacity = 0;
      if (reduce) return loop.run(150, (t) => { e.style.opacity = t; }).then(() => { e.style.opacity = ''; });
      let th = null, rot = '';
      if (j != null) {
        const x0 = px(j) + pw / 2, y0 = py(j) + ph / 2, x1 = px(i) + pw / 2, y1 = py(i) + ph / 2;
        th = h('i', 'fs-thread');
        Object.assign(th.style, { left: x0 + 'px', top: y0 + 'px', width: Math.hypot(x1 - x0, y1 - y0) + 'px' });
        rot = 'rotate(' + Math.atan2(y1 - y0, x1 - x0) + 'rad)';
        th.style.transform = rot + ' scaleX(0)';
        over.appendChild(th);
      }
      return loop.run(320, (t) => {
        if (th) th.style.transform = rot + ' scaleX(' + ease.out(Math.min(1, t * 1.6)) + ')';
        const k = Math.max(0, (t - 0.25) / 0.75);
        e.style.opacity = Math.min(1, k * 1.5);
        e.style.transform = 'translate3d(0,' + (-24 * (1 - ease.back(k))) + 'px,0)';
      }).then(() => {
        e.style.opacity = ''; e.style.transform = '';
        if (th) loop.run(300, (t) => { th.style.opacity = 1 - t; }).then(() => th.remove());
      });
    }
    // The last pairing, again (the status's diptych): its answer, until a tap
    $('.fs-last') && $('.fs-last').addEventListener('click', async () => {
      if (!last || !canTouch()) return;
      putDown(true); disarm();
      ask = { x: last.x, y: last.y };
      saying = true; clockSync(); setPhase('answer');
      box.classList.add('fs-saying'); grid.inert = true; $('.fp-boosts').inert = true;
      askEl.style.top = $('.fs-say').offsetTop + 'px'; askEl.hidden = false;
      showAnswer(last, true);
      await new Promise((r) => { goR = r; });
      ask = null; closeAsk(); saying = false;
      $('.fs-last').focus({ preventScroll: true });
      setPhase('idle'); clockSync(); idleHint();
    });

    // ---------------------------------------------------------- hints and the coach: a line only, nothing leans
    let hintT = 0;
    function hintOff() { clearTimeout(hintT); hintT = 0; }
    function idleHint() { hintOff(); if (set.hints && started && !ended && !free && phase === 'idle') hintT = setTimeout(() => showHint(false), HINT_MS); }
    function showHint(manual) { if (ended || free || !started) return; sayShow(SET_HINT, '', 5000); if (manual) tell(SET_HINT); }
    let coachEl = null;
    function coachOn() {
      if (!lv.coach || free) return;
      coachEl = h('div', 'fs-coach');
      over.appendChild(coachEl);
      sayLine(lv.coach, '');
      tell(lv.coach);
      if (o.n !== 1) return;
      const s = slots(), a = s.findIndex(Boolean), b = s.findIndex((id, k) => id && k > a);
      if (b < 0) return;   // level 1: the ghost hand carries the first place onto the second, the gesture only
      const hand = h('i', reduce ? 'fp-arrow fs-ghost' : 'fs-hand fs-ghost');
      coachEl.appendChild(hand);
      const x0 = px(a) + pw / 2, y0 = py(a) + ph / 2, x1 = px(b) + pw / 2, y1 = py(b) + ph / 2;
      if (reduce) {
        hand.textContent = Math.abs(x1 - x0) > Math.abs(y1 - y0) ? (x1 > x0 ? '→' : '←') : (y1 > y0 ? '↓' : '↑');
        hand.style.transform = 'translate3d(' + (x0 + x1) / 2 + 'px,' + (y0 + y1) / 2 + 'px,0) translate(-50%,-50%)';
        return;
      }
      const cycle = () => coachEl && loop.run(1600, (t) => {
        const k = t < 0.15 ? 0 : t > 0.7 ? 1 : ease.out((t - 0.15) / 0.55);
        hand.style.transform = 'translate3d(' + (x0 + (x1 - x0) * k) + 'px,' + (y0 + (y1 - y0) * k) + 'px,0) scale(' + (t < 0.15 ? 1.15 - t : 1) + ')';
        hand.style.opacity = t > 0.82 ? 1 - (t - 0.82) / 0.18 : 1;
      }).then(cycle);
      cycle();
    }
    function coachOff() { if (coachEl) { coachEl.remove(); coachEl = null; sayLine('', ''); } }

    function toggleSound() {
      set.sound = !set.sound;
      $('.fp-snd').setAttribute('aria-pressed', set.sound);
      if (set.sound) snd.wake(); else snd.pause();
      tell(set.sound ? 'Sound on.' : 'Sound off.');
      if (o.onOpts) o.onOpts(optsNow());
    }
    if (!free) {
      $('.fp-snd').addEventListener('click', toggleSound);
      $('.fp-back').addEventListener('click', () => {   // every pairing is already saved; leaving midway records an unfinished play
        if (started && !ended) { ended = true; goOn(); clockSync(); result = resultNow(); if (o.onEnd) o.onEnd(result); }
        if (o.onMap) o.onMap();
      });
    }

    // ---------------------------------------------------------- the level card
    let ready = Promise.resolve();
    function decode() {   // the board's pictures decode before Play
      const all = slots().filter(Boolean).map(boardPic).filter((e) => e.decode).map((e) => e.decode().catch(() => {}));
      ready = Promise.race([Promise.all(all), new Promise((r) => setTimeout(r, 2500))]);
    }
    function levelCard() {
      const A = MX.area(lv.k), ways = RL.leads(T, o.n);
      const count = () => '<b class="fp-big">' + (slots().filter(Boolean).length + game.pile) + '</b> of your things · <b class="fp-big">' + game.moves + '</b> moves · one stays.';
      const d = openSheet(box, 'Level ' + o.n,
        '<p class="fs-area">' + esc(A.name) + ' · ' + esc(A.line) + '</p>' +
        (ways.length > 1 ? '<section class="fp-sec"><h3 id="fs-from">Start from</h3><ul class="fs-ways" role="group" aria-labelledby="fs-from">' + ways.map((w) =>
          '<li><button type="button" class="fs-way" data-lead="' + esc(w.id) + '" aria-pressed="' + (w.id === game.lead) + '"><span class="fs-wpic"></span><b>' + esc(name(w.id)) + '</b><span>' + esc(SET_WHY[w.why] || '') + '</span></button></li>').join('') + '</ul></section>' : '') +
        '<p>Carry one picture onto another, then say how they go. The one you carry is set; the other stays. Every pairing counts.</p>' +
        '<p class="fs-count">' + count() + '</p>' +
        (lv.coach ? '<p class="fs-coachline">' + esc(lv.coach) + '</p>' : '') +
        (o.built ? '<p class="fp-builtline">Your building: ' + esc(o.built.name || 'a plain house') + ', ' + storeys(o.built.storeys) + '.' +
          (o.built.secs > 0 ? ' In time: best ' + mss(o.built.secs) + '.' : '') + '</p>' : '') +
        '<p class="small">Boosters: Pass ' + held.pass + ' · Turn ' + held.turn + ' · Five more ' + held.more + '</p>' +
        '<button type="button" class="switch" role="switch" aria-checked="' + set.hints + '" data-hints><span><b>Hints</b><br><span class="small">After ten seconds, a line. Nothing leans.</span></span><span class="track" aria-hidden="true"></span></button>' +
        '<fieldset class="fieldset-seg fp-clockset"><legend><b>Clock</b></legend><div class="seg">' + PACES.map(([v, w]) =>
          '<label' + (pace === v ? ' class="on"' : '') + '><input type="radio" name="fp-clock" value="' + v + '"' + (pace === v ? ' checked' : '') + '>' + w + '</label>').join('') +
        '</div><p class="small fp-clockline">' + esc(clockLine()) + '</p></fieldset>' +
        '<div class="actions"><button type="button" class="btn btn-keep btn-big" data-play data-autofocus>Play</button></div>',
        () => { if (o.onMap) o.onMap(); });
      d.querySelector('.sheet-body').scrollTop = 0;   // Play has the focus; the card opens at its top
      d.querySelectorAll('.fs-way').forEach((b) => b.querySelector('.fs-wpic').appendChild(fitPic(wholePic(pic(b.dataset.lead), 'fs-dpic'), 96, 64)));
      d.querySelectorAll('.fs-way').forEach((b) => b.addEventListener('click', () => {   // another way in: dealt again around it; nothing is saved
        game = RL.newGame(lv, T, o.seed, b.dataset.lead); moves0 = game.moves;
        d.querySelectorAll('.fs-way').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        d.querySelector('.fs-count').innerHTML = count();
        for (let i = 0; i < 6; i++) draw(i);
        status(); decode(); clockDom();
        tell('Starting from ' + dot(name(b.dataset.lead)));
      }));
      d.querySelector('[data-hints]').addEventListener('click', (e) => {
        set.hints = !set.hints;
        e.currentTarget.setAttribute('aria-checked', set.hints);
        if (o.onOpts) o.onOpts(optsNow());
      });
      d.querySelector('.fp-clockset').addEventListener('change', (e) => {
        pace = +e.target.value; paceChosen = true;
        d.querySelectorAll('.fp-clockset label').forEach((l) => l.classList.toggle('on', l.contains(e.target)));
        d.querySelector('.fp-clockline').textContent = clockLine();
        clockDom(); boosts();
        if (o.onOpts) o.onOpts(optsNow());
      });
      d.querySelector('[data-play]').addEventListener('click', async (e) => {
        const byKey = !e.detail;
        snd.wake();
        await ready;
        d.done();
        started = true;
        setPhase('idle'); status(); clockSync();
        const first = slots().findIndex(Boolean);
        focusCell(first >= 0 ? first : 0, !byKey);
        coachOn();
        idleHint();
      });
    }

    // ---------------------------------------------------------- the level's end
    async function finish() {
      setPhase('end'); hintOff(); coachOff(); clockSync();
      const k = slots().findIndex(Boolean);
      if (k >= 0) cells[k].classList.add('is-stay');
      snd.play('win', 0); buzz('win');
      await wait(reduce ? 200 : 700);
      endSheet();
    }
    function endSheet() {
      const r = result, rec = info, saga = rec && rec.saga, earned = (rec && rec.earned) || {};
      const got = [['pass', 'a Pass'], ['turn', 'a Turn'], ['more', 'Five more']].filter(([k]) => earned[k] > 0).map(([, w]) => w);
      const clockEnd = !r.clock || !rec ? null : rec.inTime ? 'In time: ' + mss(r.clock - r.secs) + ' to spare. Your building flies a flag.'
        : mss(r.secs) + '. The clock gave ' + mss(r.clock) + '. Race it again.';
      const ways = rec && rec.build && Array.isArray(rec.build.ways) ? rec.build.ways : null;
      const tall = (wi) => (rec.build.storeys && rec.build.storeys[wi]) || 1, flag = !!(saga && saga.time && saga.time[o.n - 1] > 0);
      const k = Math.floor((o.n - 1) / 5), A = MX.area(k), An = MX.area(k + 1);
      const builtText = (wi) => 'Built: ' + (ways[wi] ? name(ways[wi]) : 'a plain house') + ', ' + storeys(tall(wi)) + (flag ? ', flying a flag' : '') + '.';
      const builtPic = (id) => (id ? fitPic(wholePic(pic(id), 'fs-dpic'), 64, 48) : h('span', null, miniTile({ hex: MX.TOKENS[k % 6].hex, shape: 'square' }, null, 44)));
      const made = r.made, others = r.others, uid = 'fs' + Math.random().toString(36).slice(2, 7);
      let wi = 0;
      tell('Level ' + o.n + ' done. ' + (r.stayed ? name(r.stayed) + ' stayed. ' : '') + plural(made.length, 'pairing') + ' made.' + (clockEnd ? ' ' + clockEnd : ''));
      const d = openSheet(box, 'Level ' + o.n + ' done.',
        (clockEnd ? '<p class="fp-endclock">' + esc(clockEnd) + '</p>' : '') +
        (got.length ? '<p class="fp-earned">You earned ' + esc(got.length > 1 ? got.slice(0, -1).join(', ') + ' and ' + got[got.length - 1] : got[0]) + '.</p>' : '') +
        (r.stayed ? '<section class="fp-sec"><h3>What stayed</h3><div class="fs-stay"><span class="fs-spic"></span><p><b>' + esc(dot(name(r.stayed))) + '</b> You never carried it: everything else was set beside it.</p></div></section>' : '') +
        (ways ? '<section class="fp-sec"><h3>Your kingdom</h3>' +
          (rec.first && o.n % 5 === 0 ? '<p class="fp-earned">' + esc(A.name) + ', built.</p><p>A new area: ' + esc(An.name) + '. ' + esc(An.line) + '</p>' : '') +
          '<div class="fp-built"><span class="fp-bpic"></span><p class="fp-btext" aria-live="polite">' + esc(builtText(0)) + '</p></div>' +
          '<div class="actions">' + (ways.length > 1 ? '<button type="button" class="btn btn-quiet" data-way>Another way <span class="fp-wayn">1 of ' + ways.length + '</span></button>' : '') +
          (o.onKingdom ? '<button type="button" class="btn btn-iris" data-kingdom>See it in your kingdom</button>' : '') + '</div></section>' : '') +
        (made.length ? '<section class="fp-sec"><h3>What you made · ' + made.length + '</h3><ul class="fs-made">' + made.map((m, i) =>
          '<li><span class="fs-dip" data-m="' + i + '"></span><div class="fs-mtext"><p class="fs-mline">' + esc(said(m.s, m.w)) + '</p>' +
          '<button type="button" class="fs-tag' + (m.kind === 'turn' ? ' is-turn' : '') + '" aria-expanded="false" aria-controls="' + uid + '-' + i + '">' + esc(SET_TAG[m.kind] || 'Other eyes') + '</button>' +
          '<p class="fs-eyeline" id="' + uid + '-' + i + '" hidden>' + esc(m.line) + '</p><div class="fs-macts">' +
          '<button type="button" class="btn btn-quiet fp-heart" data-h="' + i + '" aria-pressed="false">' + SVG_HEART + '<span>Keep</span></button>' +
          (m.kind === 'turn' && o.onNote ? '<button type="button" class="btn btn-quiet" data-note="' + i + '">Note why</button>' : '') + '</div></div></li>').join('') + '</ul></section>' : '') +
        (others.length ? '<section class="fp-sec"><h3>Other eyes</h3><p class="small">Someone else put these together.</p><ul class="fs-made fs-others">' + others.map((x, i) =>
          '<li><span class="fs-dip" data-oe="' + i + '"></span><p class="fs-oline">' + esc(x.line) + '</p></li>').join('') + '</ul></section>' : '') +
        (rec && rec.ask ? '<p class="fs-next">Your next five in Sort holds one that follows from what you made here.</p>' : '') +
        (rec && rec.sortAFive ? '<p class="fs-next">Most of what you kept is already set. New things make new pairs.</p>' : '') +
        '<div class="actions fp-endact"><button type="button" class="btn btn-keep btn-big" data-next data-autofocus>Next level</button>' +
        '<button type="button" class="btn btn-big" data-again>Play again</button>' +
        (rec && rec.sortAFive && o.onSort ? '<button type="button" class="btn btn-big" data-sort>Sort a five</button>' : '') +
        '<button type="button" class="btn btn-big" data-board>Your board</button></div>',
        () => { if (o.onMap) o.onMap(); });
      const pair = (span, a, b) => { const x = wholePic(pic(a), 'fs-dpic'), y = wholePic(pic(b), 'fs-dpic'); span.append(x, y); fitPair(x, y, 64, 176); };
      d.querySelectorAll('[data-m]').forEach((s) => pair(s, made[+s.dataset.m].x, made[+s.dataset.m].y));
      d.querySelectorAll('[data-oe]').forEach((s) => pair(s, others[+s.dataset.oe].a, others[+s.dataset.oe].b));
      const sp = d.querySelector('.fs-spic');
      if (sp) sp.appendChild(fitPic(wholePic(pic(r.stayed), 'fs-dpic'), 150, 96));
      if (ways) d.querySelector('.fp-bpic').appendChild(builtPic(ways[0]));
      d.querySelectorAll('.fs-tag').forEach((b) => b.addEventListener('click', () => {   // the other eye's line, in place
        const on = b.getAttribute('aria-expanded') !== 'true';
        b.setAttribute('aria-expanded', String(on));
        d.querySelector('#' + b.getAttribute('aria-controls')).hidden = !on;
      }));
      d.querySelectorAll('.fp-heart').forEach((b) => b.addEventListener('click', () => {
        const on = b.getAttribute('aria-pressed') !== 'true', m = made[+b.dataset.h];
        b.setAttribute('aria-pressed', String(on));
        b.querySelector('span').textContent = on ? 'Kept' : 'Keep';
        if (o.onHeart) o.onHeart({ ids: [m.x, m.y], on });
      }));
      d.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => { const m = made[+b.dataset.note]; o.onNote({ ids: [m.x, m.y] }, b); }));
      const way = d.querySelector('[data-way]');
      if (way) way.addEventListener('click', () => {   // Irwin's three ways: whichever shows when the person leaves is the building
        wi = (wi + 1) % ways.length;
        const bp = d.querySelector('.fp-bpic');
        bp.textContent = ''; bp.appendChild(builtPic(ways[wi]));
        d.querySelector('.fp-btext').textContent = builtText(wi);
        way.querySelector('.fp-wayn').textContent = (wi + 1) + ' of ' + ways.length;
        if (o.onBuild) o.onBuild(ways[wi]);
      });
      const go = (sel_, fn) => { const b = d.querySelector(sel_); if (b) b.addEventListener('click', () => { d.done(); fn(); }); };
      go('[data-kingdom]', () => o.onKingdom(o.n));
      go('[data-next]', () => o.onNext && o.onNext(o.n + 1));
      go('[data-again]', () => o.onNext && o.onNext(o.n));
      go('[data-sort]', () => o.onSort());
      go('[data-board]', () => o.onBoard && o.onBoard());
    }

    // ---------------------------------------------------------- go
    clockDom(); build(); status(); decode();
    box.dataset.phase = phase;
    let lastW = stage.clientWidth, lastH = stage.clientHeight;
    const ro = new ResizeObserver(() => {   // the stage: the screen turned, or the status grew a clock
      if (stage.clientWidth === lastW && (free || stage.clientHeight === lastH)) return;
      lastW = stage.clientWidth; lastH = stage.clientHeight;
      requestAnimationFrame(() => { if (!drag && phase !== 'moving') { build(); if (sel != null && !reduce && cells[sel].firstChild) pose(cells[sel].firstChild, 0, 0, LIFT); } });
    });
    ro.observe(stage);
    // Paused by the page hiding or by the app (Set left); the page showing again resumes only what it paused itself.
    let appPaused = false;
    const halt = () => { loop.pause(); snd.pause(); hintOff(); clk.paused = true; clockSync(); };
    const resume = () => { loop.resume(); snd.resume(); idleHint(); clk.paused = false; clockSync(); };
    const onVis = () => (document.hidden ? halt() : !appPaused && resume());
    document.addEventListener('visibilitychange', onVis);
    if (!free) levelCard();

    return {
      pause() { appPaused = true; halt(); },
      resume() { appPaused = false; resume(); },
      destroy() {
        loop.stop(); snd.close(); hintOff(); clearTimeout(goT); clearTimeout(sayT); clearTimeout(clk.t); ro.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        if (mq && mq.removeEventListener) mq.removeEventListener('change', onMq);
        if (!free) document.querySelectorAll('dialog.fp-sheet').forEach((d) => { if (d.open) d.close(); d.remove(); });
        box.remove();
      },
    };
  }

  root.FiveSPlay = Object.freeze({ version: 1, mount, mountMap, mountSet });
})(typeof self !== 'undefined' ? self : globalThis);
