/* The logo in motion: the artist's opening pick from the Motion Lab (its db, motion/picks, kept in motion-picks.json),
 * drawn at rest as the logo, the 5, the s and the glass in their own colours on nothing, and played once every 30 seconds
 * (the artist, 28 Oct 2026: "Just have the logo doing an animation every 30 seconds in the top left corner"; "Make sure
 * the logo has no background besides the colors making it"). build_page.py builds dist/motion.js from the lab's marks.js,
 * the pick's family, the pick and this file.
 *
 *   FiveSMotion.logo(canvas, {every})   draws the logo at the canvas's CSS size; every ms (0: never) it plays the pick
 *                                       once, never under Reduce Motion or while the page is hidden. false: nothing drawn.
 *   FiveSMotion.pick                    the pick it draws
 *
 * Every logo is drawn again when the theme changes (the app's data-theme, or the system's).
 */
(function () {
  'use strict';
  const PICK = (window.FiveSMotionPicks || {}).launch || null;
  const mq = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const drawn = new Set();   // the logos' rest draws, for a theme change

  function theme() {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function redrawAll() {
    for (const f of drawn) { if (f.canvas.isConnected) f(); else drawn.delete(f); }
  }
  try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll); } catch (e) { /* old Safari */ }
  try { new MutationObserver(redrawAll).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* none */ }

  function logo(cv, opts) {
    opts = opts || {};
    const M = window.Motion;
    if (!cv || !PICK || !M || !M.get(PICK.family)) return false;
    const ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return false;
    const side = Math.max(16, Math.round(cv.clientWidth || cv.width));
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    cv.width = side * dpr; cv.height = side * dpr;
    const draw = (t) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, side, side);
      M.render(ctx, PICK.family, t, PICK.params, { w: side, h: side, dpr, theme: theme(), transparent: true,
        seed: PICK.seed == null ? 'launch' : PICK.seed, direction: PICK.direction });
    };
    let playing = false;
    const rest = () => { if (!playing) draw(1); };
    rest.canvas = cv;
    try { rest(); } catch (e) { return false; }
    drawn.add(rest);
    const every = Math.max(0, opts.every || 0);
    if (every) {
      const dur = Math.max(200, M.resolve(PICK.family, PICK.params).duration || 1000);
      const timer = setInterval(() => {
        if (!cv.isConnected) { clearInterval(timer); return; }
        if (playing || document.hidden || mq.matches) return;
        playing = true;
        cv.setAttribute('data-playing', '');
        let t0 = null;
        const frame = (ts) => {
          if (t0 === null) t0 = ts;
          const t = Math.min(1, (ts - t0) / dur);
          try { draw(t); } catch (e) { playing = false; cv.removeAttribute('data-playing'); rest(); return; }
          if (t < 1) requestAnimationFrame(frame);
          else { playing = false; cv.removeAttribute('data-playing'); }
        };
        requestAnimationFrame(frame);
      }, every);
    }
    return true;
  }

  window.FiveSMotion = Object.freeze({ logo, pick: PICK });
})();
