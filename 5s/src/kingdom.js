/* 5s kingdom: Set's kingdom map (SPEC.md, "Set: the clock and the kingdom", "The kingdom map").
 *
 * A drafting table you roam: one island for each area of five levels (Seed's ground, drawn by
 * ground.js), the level path through their plots, the person's buildings on the plots they won, and
 * the next area under cloud. Pan and zoom by drag, pinch, wheel, the Zoom buttons and the keys; every
 * level is also a button, in order, in one list. It never writes state: the callbacks do.
 *
 * FiveSKingdom.mount(el, {saga, palette: {kept, passed, surfaces}, thing(id) -> {name, colours} | null,
 *   drawHome(canvas) -> Promise<{description}> | null, theme, reduce, focus, reveal,
 *   onLevel(n), onBack(), onList(), onHome()}) -> {update({saga, palette, theme}), destroy()}
 * Styles: play.css (under .fk). Browser only: window.FiveSKingdom (load after ground.js and match.js).
 */
(function (root) {
  'use strict';

  const BOX_W = 520, BOX_H = 380;          // an island's box, in world px (1 world px = 1 CSS px at zoom 1)
  const DX = 120, DY = 340;                // area k's centre: x = k even ? -DX : +DX, y = -(k + 1) * DY
  const Z_MIN = 0.5, Z_MAX = 1.5, Z_STEP = 1.25, PAN = 64, TAP = 8, SETTLE_MS = 150, MAX_DRAWN = 8;
  const LIFT = 58;                         // world px from a plot's tile up to its pin's foot: clears three storeys and a flag
  const EASE_MS = 260;
  const KEYS = { ArrowLeft: [1, 0], ArrowRight: [-1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const starText = (n) => '★★★'.slice(0, n) + '<i>' + '★★★'.slice(0, 3 - n) + '</i>';   // unearned ones dim: clearer than ☆ at 10 px
  const SVG_BACK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5m5.5-5.5L5 12l5.5 5.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVG_MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  const SVG_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12M12 6v12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  const areaOf = (k) => root.FiveSMatch.area(k);
  const centreOf = (k) => (k === 'home' ? [0, 0] : [k % 2 ? DX : -DX, -(k + 1) * DY]);

  function mount(el, opts) {
    const MX = root.FiveSMatch, G = root.FiveSGround;
    let o = Object.assign({}, opts);
    const mq = root.matchMedia ? root.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduce = () => (o.reduce != null ? !!o.reduce : !!(mq && mq.matches));

    const box = document.createElement('div');
    box.className = 'fp fk';
    box.innerHTML = '<div class="fp-top"><button type="button" class="btn btn-quiet fp-back">' + SVG_BACK + '<span>Your board</span></button>' +
      '<h2 class="fp-title">Your kingdom</h2><button type="button" class="btn btn-quiet fk-list">Levels</button></div>' +
      '<p class="fk-line"></p>' +
      '<div class="fk-stage"><div class="fk-foot"><button type="button" class="btn btn-keep btn-big fk-play"></button>' +
      '<button type="button" class="iconbtn fk-zo" aria-label="Zoom out">' + SVG_MINUS + '</button>' +
      '<button type="button" class="iconbtn fk-zi" aria-label="Zoom in">' + SVG_PLUS + '</button></div>' +
      '<div class="fk-map" role="region" tabindex="0" aria-label="Your kingdom, a map: arrow keys move it, + and − zoom, Home finds the next level">' +
      '<div class="fk-table"></div></div></div><p class="visually-hidden fk-live" aria-live="polite"></p>';
    el.appendChild(box);
    const $ = (s) => box.querySelector(s);
    const map = $('.fk-map'), table = $('.fk-table'), foot = $('.fk-foot'), live = $('.fk-live');
    $('.fp-back').addEventListener('click', () => o.onBack && o.onBack());
    $('.fk-list').addEventListener('click', () => o.onList && o.onList());
    $('.fk-play').addEventListener('click', () => o.onLevel && o.onLevel(next));
    $('.fk-zo').addEventListener('click', () => zoomBy(1 / Z_STEP));
    $('.fk-zi').addEventListener('click', () => zoomBy(Z_STEP));

    // ---------------------------------------------------------- the world: islands, the path, the cloud, the nodes
    let isles = [], nodes = [], next = 1, bounds = null, homeOn = false, noHome = false;
    // The opening zoom: an island fits the map's width and its height above the foot (a phone on its side, a short
    // window: by width alone it opened at 1.2, the island cut off and the next level under Play).
    const z0 = clamp(0.9 * Math.min((map.clientWidth || 390) / BOX_W, ((map.clientHeight || 760) - foot.offsetHeight - 16) / BOX_H), Z_MIN, 1.2);
    const layouts = new Map();   // k -> FiveSGround.layout: the area's shape never changes

    function specOf(k) {
      const pal = o.palette || {}, sf = pal.surfaces || [], saga = o.saga || {};
      const stars = saga.stars || [], time = saga.time || [], built = saga.built || [];
      const surfaces = [];
      for (let q = 0; q < Math.min(4, sf.length); q++) surfaces.push(sf[(3 * k + q) % sf.length]);
      const houses = [];
      for (let p = 0; p < 5; p++) {
        const i = 5 * k + p;
        if (i >= stars.length) break;
        const th = built[i] && o.thing ? o.thing(built[i]) : null;
        const c = (th && th.colours) || [];
        houses.push({ plot: p, wall: c[0] || MX.TOKENS[k % 6].hex, trim: c[1], accent: c[2], storeys: clamp(stars[i] | 0, 1, 3), flag: time[i] > 0, name: th ? th.name : 'a plain house' });
      }
      return { rand: MX.prng('area:' + k), size: 9, kept: pal.kept || [], passed: pal.passed || [], surfaces, theme: o.theme === 'dark' ? 'dark' : 'light', plots: 5, houses };
    }

    function build() {
      const saga = o.saga || {};
      const stars = saga.stars || [], time = saga.time || [], built = saga.built || [];
      next = stars.length + 1;
      const found = Math.floor(stars.length / 5) + 1;          // areas 0..found-1; area `found` is under cloud
      const nextArea = areaOf(Math.floor(stars.length / 5));
      $('.fk-line').textContent = 'Every level you win builds one of your things. Next: level ' + next + ', in ' + nextArea.name + '.';
      $('.fk-play').textContent = 'Play level ' + next;
      box.dataset.theme = o.theme === 'dark' ? 'dark' : 'light';

      homeOn = typeof o.drawHome === 'function' && !noHome;
      isles = [];
      if (homeOn) isles.push({ k: 'home' });
      for (let k = 0; k < found; k++) isles.push({ k });
      let html = '', lis = '';
      const pts = homeOn ? [[0, 0]] : [];
      nodes = [];
      for (const it of isles) {
        const [cx, cy] = centreOf(it.k);
        it.x = cx - BOX_W / 2; it.y = cy - BOX_H / 2; it.cx = cx; it.cy = cy;
        if (it.k === 'home') {
          html += '<div class="fk-isle fk-home" style="left:' + it.x + 'px;top:' + it.y + 'px"><canvas role="img" aria-label="Your ground"></canvas>' +
            '<button type="button" class="fk-homel" style="left:16px;top:' + BOX_H * 0.66 + 'px">Your ground</button></div>';
          continue;
        }
        const a = areaOf(it.k);
        if (!layouts.has(it.k)) layouts.set(it.k, G.layout(specOf(it.k), BOX_W, BOX_H));
        html += '<div class="fk-isle" style="left:' + it.x + 'px;top:' + it.y + 'px"><canvas role="img" aria-label="' +
          esc(a.name + ', levels ' + a.from + ' to ' + a.to + ': an island.') + '"></canvas></div>' +
          '<p class="fk-aname' + (it.k % 2 ? '' : ' is-r') + '" aria-hidden="true" style="left:' + (it.x + BOX_W * (it.k % 2 ? 0.75 : 0.25)) + 'px;top:' + (it.y + BOX_H * 0.86) + 'px"><b>' + esc(a.name) + '</b><span>' + a.from + '–' + a.to + '</span></p>';
        const pins = [];
        layouts.get(it.k).plots.forEach((p, q) => {
          const n = a.from + q, i = n - 1, x = it.x + p.x, y = it.y + p.y;
          pts.push([x, y]);
          let up = 0;   // world px above LIFT, so pins never cover each other at the opening zoom
          for (const e of pins) if (Math.abs(x - e.x) * z0 < 40 && Math.abs(y - up - e.top) * z0 < 46) up = y - e.top + 46 / z0;
          pins.push({ x, top: y - up });
          const done = n < next, isNext = n === next, s = done ? clamp(stars[i] | 0, 1, 3) : 0;
          const th = done && built[i] && o.thing ? o.thing(built[i]) : null;
          const label = 'Level ' + n + ', ' + a.name + ', ' + (done ? s + ' of 3 stars' + (time[i] > 0 ? ', in time' : '') + '. Built: ' + (th ? th.name : 'a plain house') + '.' : isNext ? 'Next.' : 'Not yet.');
          nodes.push({ n, x, y: y - LIFT - up });
          lis += '<li class="fk-node ' + (done ? 'is-done' : isNext ? 'is-next' : 'is-not') + '" style="left:' + x + 'px;top:' + (y - LIFT - up) + 'px;--up:' + Math.round(up) + ';z-index:' + Math.round(y + 50000) + '">' +
            '<button type="button" data-n="' + n + '" aria-label="' + esc(label) + '"' + (done || isNext ? '' : ' aria-disabled="true"') + '><b>' + n + '</b>' +
            (done ? '<span class="fk-st">' + starText(s) + '</span>' : isNext ? '<span>Next</span>' : '') + '</button></li>';
        });
      }
      // A cloud bank across the table over the next area, its words above the last area found; nothing beyond it.
      const ca = areaOf(found), [ccx, ccy] = centreOf(found), cw = BOX_W + 2 * DX, cl = -cw / 2;
      pts.push([ccx, ccy]);
      const cloud = '<div class="fk-cloud" style="left:' + cl + 'px;top:' + (ccy - BOX_H / 2) + 'px;width:' + cw + 'px"><p style="left:' + (centreOf(found - 1)[0] - cl) + 'px">Under cloud: ' + esc(ca.name) + '. Win level ' + (5 * found) + ' to find it.</p></div>';
      // The path through the plots: the logo's ribbon under the islands, a dotted trail over them.
      let d = 'M' + pts[0][0] + ' ' + pts[0][1];
      for (let q = 1; q < pts.length - 1; q++) d += 'Q' + pts[q][0] + ' ' + pts[q][1] + ' ' + (pts[q][0] + pts[q + 1][0]) / 2 + ' ' + (pts[q][1] + pts[q + 1][1]) / 2;
      d += 'L' + pts[pts.length - 1][0] + ' ' + pts[pts.length - 1][1];
      const xs = isles.map((it) => it.x), ys = isles.map((it) => it.y).concat(ccy - BOX_H / 2);
      const b = bounds = { x0: Math.min(cl, ...xs), y0: Math.min(...ys), x1: Math.max(cl + cw, ...xs.map((x) => x + BOX_W)), y1: Math.max(...ys) + BOX_H };
      const M = 3200;   // the table reaches past the kingdom by more than a view at the lowest zoom
      table.innerHTML = '<div class="fk-grid" style="left:' + (b.x0 - M) + 'px;top:' + (b.y0 - M) + 'px;width:' + (b.x1 - b.x0 + 2 * M) + 'px;height:' + (b.y1 - b.y0 + 2 * M) + 'px"></div>' +
        '<svg class="fk-road" aria-hidden="true" width="1" height="1"><path class="fp-rb1" d="' + d + '"/><path class="fp-rb2" d="' + d + '"/></svg>' + html +
        '<svg class="fk-trail" aria-hidden="true" width="1" height="1"><path d="' + d + '"/></svg>' + cloud + '<ol class="fk-nodes" aria-label="Levels">' + lis + '</ol>';
      const els = table.querySelectorAll('.fk-isle');
      isles.forEach((it, q) => { it.el = els[q]; it.cv = els[q].querySelector('canvas'); it.drawn = false; });
      const hb = $('.fk-homel');
      if (hb) hb.addEventListener('click', () => o.onHome && o.onHome());
    }

    // ---------------------------------------------------------- drawing, lazily: near the view, at most MAX_DRAWN
    let queue = [], busy = false, alive = true;
    function release(it) { it.drawn = false; it.gen = (it.gen || 0) + 1; it.el.classList.remove('is-drawn'); it.cv.width = 0; it.cv.height = 0; }
    function settle() {
      const v = view(), far = around(v, 3), near = around(v, 1);
      const vx = v.x0 + v.w / 2, vy = v.y0 + v.h / 2;
      const d = (it) => Math.hypot(it.cx - vx, it.cy - vy);
      const keep = isles.filter((it) => hits(it, far)).sort((a, b) => d(a) - d(b)).slice(0, MAX_DRAWN);
      for (const it of isles) if (it.drawn && keep.indexOf(it) < 0) release(it);
      queue = keep.filter((it) => !it.drawn && (hits(it, near) || it.k === o.reveal));
      pump();
    }
    async function pump() {
      if (busy) return;
      busy = true;
      while (queue.length && alive) {
        const it = queue.shift();
        if (it.drawn) continue;
        it.drawn = true;
        const gen = it.gen = (it.gen || 0) + 1;
        let job = null, grows = false;
        if (it.k === 'home') {
          job = o.drawHome(it.cv);
          if (!job) { noHome = true; build(); place(); break; }   // nothing judged yet: no home island
        } else {
          const spec = specOf(it.k);
          grows = spec.grow = it.k === o.reveal && !reduce();
          job = G.render(it.cv, spec);
        }
        if (it.k === o.reveal) o.reveal = null;   // it grows once
        const done = (res) => {
          if (!alive || it.gen !== gen) return;
          it.el.classList.add('is-drawn');
          const a = it.k === 'home' ? null : areaOf(it.k);
          if (res && res.description) it.cv.setAttribute('aria-label', (a ? a.name + ', levels ' + a.from + ' to ' + a.to + '. ' : 'Your ground. ') + res.description);
        };
        const safe = Promise.resolve(job).catch(() => null);
        if (grows) { it.el.classList.add('is-drawn'); safe.then(done); }   // the grow runs on; the queue does not wait for it
        else done(await safe);
      }
      busy = false;
    }
    const around = (v, k) => ({ x0: v.x0 - k * v.w, y0: v.y0 - k * v.h, x1: v.x0 + (k + 1) * v.w, y1: v.y0 + (k + 1) * v.h });
    const hits = (it, r) => it.x < r.x1 && it.x + BOX_W > r.x0 && it.y < r.y1 && it.y + BOX_H > r.y0;

    // ---------------------------------------------------------- the view: one transform a frame
    let W = 1, H = 1, z = 1, tx = 0, ty = 0, shownZ = 0, raf = 0, anim = null, settleT = 0;
    const footH = () => foot.offsetHeight + 16;
    const view = () => ({ x0: -tx / z, y0: -ty / z, w: W / z, h: H / z });
    function clampView() {
      z = clamp(z, Z_MIN, Z_MAX);
      if (!bounds) return;
      const cy0 = (H - footH()) / 2;
      const cx = clamp((W / 2 - tx) / z, bounds.x0, bounds.x1), cy = clamp((cy0 - ty) / z, bounds.y0, bounds.y1);
      tx = W / 2 - cx * z; ty = cy0 - cy * z;
    }
    function frame(t) {
      raf = 0;
      if (anim) {
        const k = clamp((t - anim.t0) / EASE_MS, 0, 1), e = 1 - Math.pow(1 - k, 3);
        z = anim.z0 + (anim.z1 - anim.z0) * e; tx = anim.x0 + (anim.x1 - anim.x0) * e; ty = anim.y0 + (anim.y1 - anim.y0) * e;
        if (k < 1) raf = requestAnimationFrame(frame); else anim = null;
      }
      table.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + z.toFixed(4) + ')';
      if (z !== shownZ) { table.style.setProperty('--z', z.toFixed(4)); shownZ = z; }
    }
    function place() {
      clampView();
      if (!raf) raf = requestAnimationFrame(frame);
      clearTimeout(settleT);
      settleT = setTimeout(settle, SETTLE_MS);
    }
    // A move to (tx, ty, z): eased, or at once under reduced motion.
    function moveTo(nz, ntx, nty) {
      const s = { z, tx, ty };
      z = nz; tx = ntx; ty = nty; clampView();
      if (!reduce()) anim = { t0: performance.now(), z0: s.z, x0: s.tx, y0: s.ty, z1: z, x1: tx, y1: ty };
      else anim = null;
      if (anim) { z = s.z; tx = s.tx; ty = s.ty; }
      place();
    }
    const stopAnim = () => { if (anim) { anim = null; } };
    function centreOn(wx, wy, nz) { nz = clamp(nz || z, Z_MIN, Z_MAX); moveTo(nz, W / 2 - wx * nz, (H - footH()) / 2 - wy * nz); }
    function zoomAt(px, py, f) {
      stopAnim();
      const nz = clamp(z * f, Z_MIN, Z_MAX), wx = (px - tx) / z, wy = (py - ty) / z;
      z = nz; tx = px - wx * nz; ty = py - wy * nz; place();
    }
    function zoomBy(f) {   // from where an eased move is going, so quick presses each count
      const [z0, x0, y0] = anim ? [anim.z1, anim.x1, anim.y1] : [z, tx, ty];
      const nz = clamp(z0 * f, Z_MIN, Z_MAX), px = W / 2, py = (H - footH()) / 2, wx = (px - x0) / z0, wy = (py - y0) / z0;
      moveTo(nz, px - wx * nz, py - wy * nz);
    }
    function panBy(dx, dy) { stopAnim(); tx += dx; ty += dy; place(); }
    const nodeOf = (n) => nodes.find((x) => x.n === n);
    function findNext() { const nd = nodeOf(next); if (nd) centreOn(nd.x, nd.y + LIFT / 2); }

    // ---------------------------------------------------------- gestures: drag, pinch, wheel; a press under 8 px is a tap
    const ptrs = new Map();
    let press = null, pinch = null, eatClick = false;
    const local = (e) => { const r = map.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    function pinchStart() {
      const [a, b] = Array.from(ptrs.values());
      pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] };
    }
    map.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      stopAnim();
      ptrs.set(e.pointerId, local(e));
      if (ptrs.size === 1) press = { id: e.pointerId, at: local(e), moved: false };
      else if (ptrs.size === 2) {
        if (press) press.moved = true;
        for (const id of ptrs.keys()) try { map.setPointerCapture(id); } catch (err) { /* already up */ }
        pinchStart();
      }
    });
    map.addEventListener('pointermove', (e) => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const p = local(e);
      ptrs.set(e.pointerId, p);
      if (ptrs.size >= 2 && pinch) {
        const [a, b] = Array.from(ptrs.values());
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        tx += m[0] - pinch.m[0]; ty += m[1] - pinch.m[1];
        zoomAt(m[0], m[1], d / pinch.d);
        pinch = { d, m };
        return;
      }
      if (!press || press.id !== e.pointerId) return;
      if (!press.moved) {
        if (Math.hypot(p[0] - press.at[0], p[1] - press.at[1]) < TAP) return;
        press.moved = true;
        map.classList.add('is-drag');
        try { map.setPointerCapture(e.pointerId); } catch (err) { /* gone */ }
        panBy(p[0] - press.at[0], p[1] - press.at[1]);
        return;
      }
      panBy(p[0] - prev[0], p[1] - prev[1]);
    });
    function up(e) {
      if (!ptrs.delete(e.pointerId)) return;
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 1 && press) { const [id, p] = Array.from(ptrs.entries())[0]; press = { id, at: p, moved: true }; }
      if (!ptrs.size) {
        if (press && press.moved) { eatClick = true; setTimeout(() => { eatClick = false; }, 0); }
        press = null;
        map.classList.remove('is-drag');
      }
    }
    map.addEventListener('pointerup', up);
    map.addEventListener('pointercancel', up);
    map.addEventListener('click', (e) => { if (eatClick) { e.preventDefault(); e.stopPropagation(); } }, true);
    map.addEventListener('wheel', (e) => {
      e.preventDefault();
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
      if (e.ctrlKey || e.metaKey) { const [x, y] = local(e); zoomAt(x, y, Math.exp(-e.deltaY * k * 0.01)); }
      else panBy(-e.deltaX * k, -e.deltaY * k);
    }, { passive: false });
    map.addEventListener('click', (e) => {
      const b = e.target.closest('[data-n]');
      if (b && b.getAttribute('aria-disabled') !== 'true' && o.onLevel) o.onLevel(+b.dataset.n);
    });

    // ---------------------------------------------------------- keys: arrows pan, + and - zoom, Home finds the next level
    map.addEventListener('keydown', (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const k = KEYS[e.key];
      if (k) panBy(k[0] * PAN, k[1] * PAN);
      else if (e.key === '+' || e.key === '=') zoomBy(Z_STEP);
      else if (e.key === '-' || e.key === '_' || e.key === '−') zoomBy(1 / Z_STEP);
      else if (e.key === 'Home') findNext();
      else return;
      e.preventDefault();
    });
    // A focused node is panned into view (clear of the foot's buttons).
    map.addEventListener('focusin', (e) => {
      const b = e.target.closest('[data-n]');
      if (!b) return;
      const r = b.getBoundingClientRect(), m = map.getBoundingClientRect();
      if (r.left < m.left + 8 || r.right > m.right - 8 || r.top < m.top + 8 || r.bottom > m.bottom - footH()) {
        const nd = nodeOf(+b.dataset.n);
        if (nd) centreOn(nd.x, nd.y + LIFT / 2);
      }
    });
    map.addEventListener('scroll', () => { map.scrollTop = 0; map.scrollLeft = 0; });   // focus never scrolls the map: it pans

    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => {
      const cx = (W / 2 - tx) / z, cy = ((H - footH()) / 2 - ty) / z;
      W = map.clientWidth || 1; H = map.clientHeight || 1;
      tx = W / 2 - cx * z; ty = (H - footH()) / 2 - cy * z;
      place();
    }) : null;

    // ---------------------------------------------------------- open: centred on the level just played, else the next
    build();
    W = map.clientWidth || 1; H = map.clientHeight || 1;
    z = z0;
    // A new area found opens on its first level: on the level that found it, the new island was half off a phone's screen.
    const first = nodeOf(o.reveal != null ? 5 * o.reveal + 1 : o.focus) || nodeOf(next);
    if (first) { tx = W / 2 - first.x * z; ty = (H - footH()) / 2 - (first.y + LIFT / 2) * z; }
    place();
    if (ro) ro.observe(map);
    if (o.reveal != null) { const w = 'A new area: ' + areaOf(o.reveal).name + '.'; setTimeout(() => { live.textContent = w; }, 400); }

    return {
      update(nx) {
        o = Object.assign(o, nx);
        build(); place();
      },
      destroy() {
        alive = false;
        clearTimeout(settleT);
        if (raf) cancelAnimationFrame(raf);
        if (ro) ro.disconnect();
        box.remove();
      },
    };
  }

  root.FiveSKingdom = Object.freeze({ version: 1, mount });
})(typeof window !== 'undefined' ? window : globalThis);
