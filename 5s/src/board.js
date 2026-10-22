/* 5s board: Set's mood board (SPEC.md, "Set: the board and the game", "The board").
 *
 * Everything the person keeps, at its own proportions, in a masonry of columns, grouped by what
 * they have put together in the game (FiveSMatch.clusters). Pictures and names come from the app's
 * callbacks, so nothing here assumes where a thing lives. Styles: play.css (under .fb).
 *
 * Browser: window.FiveSBoard (needs window.FiveS and window.FiveSMatch). Node: module.exports (masonry only).
 */
(function (root) {
  'use strict';

  const KINDS = ['image', 'object', 'space', 'surface', 'colour'];
  const KIND_LABEL = { image: 'Image', object: 'Object', space: 'Space', surface: 'Surface', colour: 'Colour' };
  const KIND_HEAD = { image: 'Images', object: 'Objects', space: 'Spaces', surface: 'Surfaces', colour: 'Colours' };
  const GAP = 8;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/i.test(h);
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : many || one + 's');

  // One stylesheet for the game and the board: play.css, next to this script, unless the page already has it.
  const here = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '';
  function ensureCss() { // -> a promise, settled once the styles apply
    const had = document.querySelector('[data-fives="play"]');
    if (had) return had.sheet || had.tagName === 'STYLE' ? Promise.resolve() : new Promise((r) => { had.addEventListener('load', r); had.addEventListener('error', r); });
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = here.replace(/[^/]*$/, 'play.css'); l.setAttribute('data-fives', 'play');
    const p = new Promise((r) => { l.onload = l.onerror = r; });
    document.head.appendChild(l);
    return p;
  }

  // columns = clamp(floor((width + 8) / 176), 2, 5); each tile into the shortest column so far (ties: the leftmost).
  function masonry(width, ratios) {
    const cols = Math.max(2, Math.min(5, Math.floor((width + GAP) / 176)));
    const w = (width - GAP * (cols - 1)) / cols;
    const hs = new Array(cols).fill(0);
    const at = ratios.map((r) => {
      let c = 0;
      for (let i = 1; i < cols; i++) if (hs[i] < hs[c] - 0.01) c = i;
      const h = w * r;
      const p = { x: c * (w + GAP), y: hs[c], w, h };
      hs[c] += h + GAP;
      return p;
    });
    return { cols, at, height: Math.max(0, Math.max.apply(null, hs) - GAP) };
  }

  function dayText(sec) {
    const d = new Date((sec || 0) * 1000);
    return d.getDate() + ' ' + MONTHS[d.getMonth()];
  }

  /** drawPainting(canvas, painting, cellPx): a kept painting ("6 hex per cell, '------' outside") into a
   *  canvas, cropped to the cells that were painted (a centre square is its own picture). */
  function drawPainting(cv, p, cell) {
    const s = cell || 8, hex = (i) => { const x = String(p.c || '').substr(i * 6, 6); return /^[0-9a-f]{6}$/i.test(x) ? '#' + x : null; };
    let c0 = p.cols, r0 = p.rows, c1 = -1, r1 = -1;
    for (let i = 0; i < p.cols * p.rows; i++) {
      if (!hex(i)) continue;
      const c = i % p.cols, r = Math.floor(i / p.cols);
      c0 = Math.min(c0, c); r0 = Math.min(r0, r); c1 = Math.max(c1, c); r1 = Math.max(r1, r);
    }
    if (c1 < 0) { c0 = r0 = 0; c1 = p.cols - 1; r1 = p.rows - 1; }
    cv.width = (c1 - c0 + 1) * s; cv.height = (r1 - r0 + 1) * s;
    const g = cv.getContext('2d');
    for (let i = 0; i < p.cols * p.rows; i++) {
      const h = hex(i);
      if (!h) continue;
      g.fillStyle = h;
      g.fillRect((i % p.cols - c0) * s, (Math.floor(i / p.cols) - r0) * s, s, s);
    }
    return cv;
  }

  function mount(el, opts) {
    const css = ensureCss();
    const F = root.FiveS, M = root.FiveSMatch;
    let o = Object.assign({}, opts);
    const shown = new Set();   // tiles fade in once, the first time they are shown
    const box = document.createElement('div');
    box.className = 'fb';
    el.appendChild(box);
    let sections = [];         // [{el, items:[{el, ratio}]}]
    let raf = 0, lastW = -1;

    function thingTile(id) {
      const c = F.card(o.state, o.deck, id);
      if (!c) return null;
      const first = (c.colours || []).filter(isHex)[0] || '#2A2438';
      const label = (KIND_LABEL[c.kind] || 'Thing') + ': ' + (o.name ? o.name(c) : c.title);
      let inner = '', ratio = 1;
      if (c.kind === 'colour') {
        const cs = (c.colours || []).filter(isHex);
        ratio = 4 / 3;
        inner = '<span class="fb-bands" aria-hidden="true">' + [0, 1, 2].map((i) => '<i style="background:' + (cs[i] || cs[cs.length - 1] || first) + '"></i>').join('') + '</span>';
      } else {
        if (c.w > 0 && c.h > 0) ratio = c.h / c.w;
        const src = o.image ? o.image(c) : null;
        if (src) inner = '<img src="' + esc(src) + '" alt="" loading="lazy" decoding="async" width="' + (c.w || 400) + '" height="' + (c.h || 400) + '">';
      }
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fb-tile';
      b.style.background = first;
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-label', label);
      b.dataset.id = id;
      b.innerHTML = inner;
      b.addEventListener('click', () => o.onOpen && o.onOpen(id, b));
      return { el: b, ratio, key: id };
    }

    function paintingTile(p, i) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'fb-tile fb-painting';
      b.setAttribute('aria-haspopup', 'dialog');
      b.setAttribute('aria-label', 'Painting: Level ' + p.n + ', ' + dayText(p.at));
      const cv = b.appendChild(drawPainting(document.createElement('canvas'), p));
      b.addEventListener('click', () => o.onPainting && o.onPainting(i, b));
      return { el: b, ratio: cv.height / cv.width, key: 'p' + p.at + ':' + i };
    }

    function section(head, meta, items) {
      items = items.filter(Boolean);
      if (!items.length) return;
      const s = document.createElement('section');
      s.className = 'fb-sec';
      s.innerHTML = '<h2 class="fb-head">' + esc(head) + '</h2>' + (meta ? '<p class="fb-meta">' + esc(meta) + '</p>' : '');
      const m = document.createElement('div');
      m.className = 'fb-m';
      for (const it of items) {
        if (!shown.has(it.key)) { it.el.classList.add('fb-in'); shown.add(it.key); }
        m.appendChild(it.el);
      }
      s.appendChild(m);
      box.appendChild(s);
      sections.push({ m, items });
    }

    function render() {
      box.textContent = '';
      sections = [];
      const st = o.state || {};
      const cl = M.clusters(st, o.deck);
      for (const c of cl.clusters) {
        section(c.label, plural(c.ids.length, 'thing') + ' · put together ' + plural(c.times, 'time') + (c.hearts ? ' · ' + c.hearts + ' kept' : ''), c.ids.map(thingTile));
      }
      const ps = Array.isArray(st.paintings) ? st.paintings : [];
      section('Paintings you made', plural(ps.length, 'painting'), ps.map(paintingTile));
      if (Array.isArray(st.assoc) && st.assoc.length) {
        section('Not put together yet', plural(cl.rest.length, 'thing'), cl.rest.map(thingTile));
      } else {
        const by = {};
        for (const id of cl.rest) { const c = F.card(st, o.deck, id); if (c) (by[c.kind] = by[c.kind] || []).push(id); }
        for (const k of KINDS) if (by[k]) section(KIND_HEAD[k], plural(by[k].length, 'thing'), by[k].map(thingTile));
      }
      lastW = -1;
      layout();
    }

    function layout() {
      const w = box.clientWidth;
      if (!w || w === lastW) return;
      lastW = w;
      for (const s of sections) {
        const L = masonry(w, s.items.map((it) => it.ratio));
        s.m.style.height = L.height + 'px';
        s.items.forEach((it, i) => {
          const p = L.at[i], st = it.el.style;
          st.left = p.x + 'px'; st.top = p.y + 'px'; st.width = p.w + 'px'; st.height = p.h + 'px';
        });
        s.m.dataset.cols = L.cols;
      }
    }

    const ro = new ResizeObserver(() => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; layout(); }); });
    ro.observe(box);
    render();
    css.then(() => { lastW = -1; layout(); });

    return {
      update(next) { o = Object.assign(o, next); render(); },
      destroy() { ro.disconnect(); if (raf) cancelAnimationFrame(raf); box.remove(); },
    };
  }

  const FiveSBoard = Object.freeze({ version: 1, mount, masonry, drawPainting });
  if (typeof module === 'object' && module.exports) module.exports = FiveSBoard;
  else root.FiveSBoard = FiveSBoard;
})(typeof self !== 'undefined' ? self : globalThis);
