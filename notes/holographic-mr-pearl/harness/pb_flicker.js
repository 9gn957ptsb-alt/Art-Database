// pb_flicker.js - how much the characters flicker (28 Oct 2026; the design judge: "no hysteresis, so edge strokes,
// line strokes (_ / - / blank) and the small-figure and far-figure thresholds can flicker"). The game paused and stepped
// a frame at a time (debug().run(1/60), debug().draw()); after each frame every cell's character is read back from the
// pass's own cells texture (found by watching the WebGL calls, so the game needs no hook of its own), at the octave the
// setting pass actually shows there, on the finest grid (a cell an octave up counts as the four, or sixteen, it covers).
// A blank is the same at any octave (black). Per scene: the share of cells whose character (or its octave) changed
// from the frame before, and the flip-backs, a cell going A -> B -> A within 6 frames (the oscillation that reads as
// flicker; a thing passing over a cell makes one too, so the cells that flipped back three times or more are counted
// apart: those are the flicker). Four scenes, 120 frames each, on a phone (390x844 @3) and a desk (1440x900 @1):
//   a_rally_still  the camera held still behind court one during a rally (things move; the courts do not)
//   b_empty_still  the camera held still on an empty part of court one (nothing moves: both numbers must be 0)
//   c_walk_side    his own third-person camera while he walks slowly sideways (the stick held)
//   d_scope_serve  the Scope at the serve while the bar runs
// node pb_flicker.js port [outfile]   (outfile: the numbers as JSON; beside it, <outfile>_<view>_<scene>.png, the last
// frame with every cell that flipped back marked in red, brighter the more often; PB_VIEWS=phone or desk: one view)
const { chromium } = require("playwright");
const fs = require("fs");
const [port, outfile] = process.argv.slice(2);
const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
const FRAMES = 120, BACK = 6;
// (run in the page before the game: the cells texture is the one a framebuffer takes at a level over 0; its size from
// texStorage2D; the cell's size in device pixels from the setting pass's one uniform2i)
const hook = () => {
  const P = WebGL2RenderingContext.prototype, fbt = P.framebufferTexture2D, ts = P.texStorage2D, u2i = P.uniform2i;
  const F = window.__fl = { info: new Map(), cells: null, cell: null, fbt };
  P.texStorage2D = function (t, levels, fmt, w, h) { F.info.set(this.getParameter(this.TEXTURE_BINDING_2D), { levels, w, h }); return ts.apply(this, arguments); };
  P.framebufferTexture2D = function (tg, at, tt, tex, level) { if (level > 0 && tex) { F.cells = tex; } return fbt.apply(this, arguments); };
  P.uniform2i = function (loc, x, y) { F.cell = [x, y]; return u2i.apply(this, arguments); };
};
// (in the page: read this frame's cells, fold them into the fine grid's states, count changes and flip-backs)
const readFrame = (BACK) => {
  const F = window.__fl, c = document.getElementById("view"), gl = c.getContext("webgl2"), I = F.info.get(F.cells);
  if (!F.fb) { F.fb = gl.createFramebuffer(); }
  const was = gl.getParameter(gl.FRAMEBUFFER_BINDING), lv = [];
  gl.bindFramebuffer(gl.FRAMEBUFFER, F.fb);
  for (let k = 0; k < I.levels; k++) {
    const w = I.w >> k, h = I.h >> k, px = new Uint8Array(w * h * 4);
    F.fbt.call(gl, gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, F.cells, k);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px); lv.push({ w, px });
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, was);
  const W = Math.ceil(c.width / F.cell[0]), H = Math.ceil(c.height / F.cell[1]), N = W * H, s = new Uint16Array(N);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      // the setting pass's rule: the largest octave whose cell is one (alpha's top bit), else the finest
      let k = I.levels - 1, a = 0;
      for (; k >= 0; k--) { const L = lv[k]; a = L.px[(((j >> k) * L.w) + (i >> k)) * 4 + 3]; if (a >= 128 || k === 0) { break; } }
      s[j * W + i] = (a & 63) ? k * 64 + (a & 63) : 0;   // (a blank is black at any octave)
    }
  }
  const S = window.__st || (window.__st = { W, H, N, hist: [], frames: 0, changed: 0, flips: 0, heat: new Uint16Array(N), pairs: {} });
  if (S.N === N) {
    const h = S.hist;
    if (h.length) {
      const p = h[h.length - 1];
      for (let n = 0; n < N; n++) {
        if (s[n] === p[n]) { continue; }
        S.changed++;
        for (let b = 2; b <= BACK && b <= h.length; b++) {
          if (h[h.length - b][n] === s[n]) { S.flips++; S.heat[n]++; const key = s[n] + ">" + p[n]; S.pairs[key] = (S.pairs[key] || 0) + 1; break; }
        }
      }
      S.frames++;
    }
    h.push(s); if (h.length > BACK) { h.shift(); }
  }
  return null;
};
const scenes = {
  a_rally_still: {
    setup: () => {
      const d = window.Pickleball.debug(); d.enter(0); d.run(2.5);
      for (let i = 0; i < 400 && !(d.court.m && d.court.m.meterOn); i++) { d.run(1 / 60); }
      for (let i = 0; i < 200; i++) { const u = d.meter(); if (u != null && u >= 0.5 && u <= 0.7) { d.run(1 / 60, true); break; } d.run(1 / 60); }
      for (let i = 0; i < 400; i++) { d.run(1 / 60); const m = d.court.m; if (m && m.balls.some((b) => !b.dead && b.last === "them" && b.y > 1)) { break; } }
      d.camAt([0, 4.5, 13], 0, -0.32);
    } },
  b_empty_still: {
    // (he is sent off behind the camera: on a desk's wide view his edge showed at its side)
    setup: () => { const d = window.Pickleball.debug(); d.run(1.5); d.me.x = -40; d.run(0.2); d.camAt([-3, 5, 3], Math.PI / 2, -0.9); } },
  c_walk_side: {
    setup: () => { const d = window.Pickleball.debug(); d.run(1.5); d.input.stick = { id: -1, x: 0, y: 0, dx: 1.5, dy: 0 }; d.run(0.6); } },
  d_scope_serve: {
    setup: () => {
      const d = window.Pickleball.debug(); d.enter(0); d.run(2.5);
      for (let i = 0; i < 400 && !(d.court.m && d.court.m.meterOn); i++) { d.run(1 / 60); }
      d.run(0.4);
    } },
};
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const views = { phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
                  desk: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } };
  const res = {}, errs = [];
  for (const [vn, view] of Object.entries(views).filter(([n]) => !process.env.PB_VIEWS || process.env.PB_VIEWS.split(",").includes(n))) {
    for (const [sn, sc] of Object.entries(scenes)) {
      const p = await b.newPage(view);
      p.on("pageerror", (e) => errs.push(String(e)));
      await p.addInitScript(hook);
      await p.goto(url);
      await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
      await p.evaluate(() => window.Pickleball.debug().pause(true));
      await p.evaluate(sc.setup);
      const t0 = Date.now();
      // (one frame drawn and read before counting: the first is measured against it)
      for (let f = 0; f <= FRAMES; f++) {
        await p.evaluate((BACK) => { const d = window.Pickleball.debug(); d.run(1 / 60); d.draw(); }, BACK);
        await p.evaluate(readFrame, BACK);
      }
      const r = await p.evaluate(() => {
        const S = window.__st, g = window.Pickleball.debug().glyphs, name = (v) => (v >> 6) + ":" + JSON.stringify(g[v & 63]);
        const pairs = Object.entries(S.pairs).sort((x, y) => y[1] - x[1]).slice(0, 8).map(([k, n]) => k.split(">").map((v) => name(+v)).join(" <-> ") + " " + n);
        return { cells: S.N, frames: S.frames, changedShare: +(S.changed / (S.N * S.frames)).toFixed(5), flipBacks: S.flips, flipCells: S.heat.reduce((a, v) => a + (v > 0 ? 1 : 0), 0), oscCells: S.heat.reduce((a, v) => a + (v >= 3 ? 1 : 0), 0), top: pairs };
      });
      r.msPerFrame = Math.round((Date.now() - t0) / (FRAMES + 1));
      res[vn + " " + sn] = r;
      console.log(vn.padEnd(6), sn.padEnd(14), "changed", (100 * r.changedShare).toFixed(3).padStart(7) + "%", "flip-backs", String(r.flipBacks).padStart(6), "in", String(r.flipCells).padStart(5), "of", r.cells, "cells,", String(r.oscCells).padStart(5), "3+ times |", r.top.slice(0, 4).join(" | "));
      if (outfile) {
        // the last frame, every cell that flipped back marked
        await p.evaluate(() => {
          const S = window.__st, F = window.__fl, c = document.getElementById("view"), o = document.createElement("canvas"), dpr = c.width / c.clientWidth;
          o.width = c.width; o.height = c.height; Object.assign(o.style, { position: "fixed", left: "0", top: "0", width: c.clientWidth + "px", height: c.clientHeight + "px", zIndex: 99, pointerEvents: "none" });
          const x = o.getContext("2d"); x.strokeStyle = "rgba(255,40,40,0.9)";
          for (let n = 0; n < S.N; n++) { if (S.heat[n]) { x.globalAlpha = Math.min(1, 0.25 + S.heat[n] / 8); x.lineWidth = Math.max(1, dpr); x.strokeRect((n % S.W) * F.cell[0] + 0.5, Math.floor(n / S.W) * F.cell[1] + 0.5, F.cell[0] - 1, F.cell[1] - 1); } }
          document.body.appendChild(o);
        });
        await p.screenshot({ path: `${outfile.replace(/\.json$/, "")}_${vn}_${sn}.png` });
      }
      await p.close();
    }
  }
  await b.close();
  if (outfile) { fs.writeFileSync(outfile, JSON.stringify(res, null, 1)); }
  const still = res["phone b_empty_still"], still2 = res["desk b_empty_still"];
  const ok = [still, still2].filter(Boolean).every((q) => !q.flipBacks && !q.changedShare) && (still || still2);
  console.log(errs.length ? "ERRORS " + errs.slice(0, 3).join(" | ") : "no errors");
  console.log(ok ? "the still scene is still (b: 0 changed, 0 flip-backs on both)" : "FAIL: the still scene changed");
  process.exit(ok && !errs.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
