/* The mark in motion inside the app: the artist's pick for each of the sixteen moments, from the Motion Lab
 * (its db, motion/picks), kept in motion-picks.json. build_page.py builds dist/motion.js from the lab's marks.js,
 * the families the picks use, the picks and this file.
 *
 *   FiveSMotion.play(moment, at, {direction, size, loop, reduced})   at: an element, a selector or a DOMRect
 *   FiveSMotion.stop(moment)   FiveSMotion.picks
 *
 * A pick plays once over `at` (centred on it, at most `size` px square) on a canvas that takes no taps, is hidden
 * from VoiceOver and goes when it ends; a loop plays until stop(moment). Under Reduce Motion the family's own
 * reduced form plays (Motion.render's env.reduced). With no pick, no Motion or no canvas, nothing plays.
 */
(function () {
  'use strict';
  const PICKS = Object.freeze(window.FiveSMotionPicks || {});
  const live = new Map();
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function theme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function rectOf(at) {
    const el = typeof at === 'string' ? document.querySelector(at) : at;
    if (el && typeof el.getBoundingClientRect === 'function') {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) return r;
      return null;   // hidden: nothing to play over
    }
    if (el && el.width && el.height) return el;
    const w = window.innerWidth, h = window.innerHeight;
    return { left: 0, top: 0, width: w, height: h };
  }

  function stop(moment) {
    const p = live.get(moment);
    if (!p) return;
    live.delete(moment);
    cancelAnimationFrame(p.raf);
    p.canvas.remove();
  }

  function play(moment, at, opts) {
    opts = opts || {};
    const pick = PICKS[moment], M = window.Motion;
    if (!pick || !M || !M.get(pick.family)) return false;
    stop(moment);
    const r = rectOf(at);
    if (!r) return false;
    // an open dialog (a sheet) is in the top layer: a mark for something in it is drawn inside it, or it would sit under it
    const el = typeof at === 'string' ? document.querySelector(at) : at;
    const host = (el && el.closest && el.closest('dialog[open]')) || document.body;
    const o = host === document.body ? { left: 0, top: 0 } : host.getBoundingClientRect();
    const side = Math.round(Math.max(40, Math.min(opts.size || 160, r.width, r.height)));
    const cv = document.createElement('canvas');
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return false;
    const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
    cv.width = side * dpr; cv.height = side * dpr;
    cv.className = 'fives-motion';
    cv.setAttribute('aria-hidden', 'true');
    cv.setAttribute('data-moment', moment);
    cv.style.cssText = 'position:' + (host === document.body ? 'fixed' : 'absolute') + ';z-index:60;pointer-events:none;width:' + side +
      'px;height:' + side + 'px;left:' + Math.round(r.left - o.left + (host.scrollLeft || 0) + r.width / 2 - side / 2) +
      'px;top:' + Math.round(r.top - o.top + (host.scrollTop || 0) + r.height / 2 - side / 2) + 'px';
    host.appendChild(cv);
    const dur = Math.max(200, M.resolve(pick.family, pick.params).duration || 1000);
    const env = { w: side, h: side, dpr, theme: theme(), transparent: true, seed: pick.seed == null ? moment : pick.seed,
      direction: opts.direction || pick.direction, reduced: opts.reduced == null ? mq.matches : !!opts.reduced };
    const p = { canvas: cv, raf: 0 };
    live.set(moment, p);
    let t0 = null;
    const frame = (ts) => {
      if (live.get(moment) !== p) return;
      if (t0 === null) t0 = ts;
      const u = (ts - t0) / dur, t = opts.loop ? u % 1 : Math.min(1, u);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, side, side);
      try { M.render(ctx, pick.family, t, pick.params, env); } catch (e) { stop(moment); return; }
      if (!opts.loop && u >= 1) { p.raf = 0; setTimeout(() => { if (live.get(moment) === p) stop(moment); }, 160); return; }
      p.raf = requestAnimationFrame(frame);
    };
    p.raf = requestAnimationFrame(frame);
    return true;
  }

  window.FiveSMotion = Object.freeze({ play, stop, picks: PICKS, playing: () => [...live.keys()] });
})();
