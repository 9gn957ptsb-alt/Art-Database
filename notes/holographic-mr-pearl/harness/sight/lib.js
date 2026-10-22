// lib.js - what the sight's tests share: the game opened through the harness (with the frame's own virtual time
// kept as window.__V), a level arena built ahead of him, standing, blocks set, taps by touch and by mouse, a recorder.
const { open, frames, state } = require("../game.js");
const fs = require("fs");

// The game's frame is wrapped by the harness (it knows it by its name, "frame"); this wraps it once more, under the
// same name, to keep the virtual time the frame is given (window.__V), so an event's time can be set against it.
const KEEP_V = () => {
  const raf = window.requestAnimationFrame.bind(window);
  window.__V = 0;
  window.requestAnimationFrame = function (cb) {
    if (cb && cb.name === "frame") { const inner = cb; const frame = function (t) { window.__V = t; inner(t); }; return raf(frame); }
    return raf(cb);
  };
};

async function start(view, port, out) {
  fs.mkdirSync(out, { recursive: true });
  const g = await open({ view, virtual: 25, port: +port || 8803, init: KEEP_V });
  const { P } = g;
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; });
  await frames(P, 4);
  await endBlend(P);
  await frames(P, 4);
  const log = [], bad = [];
  const say = (l) => { console.log(l); log.push(l); };
  const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
  let n = 0;
  const shot = async (name, wait) => { if (wait) { await frames(P, wait); } const file = `${out}/${name}.png`; await P.screenshot({ path: file }); say("shot " + file); return file; };
  const cdp = await P.context().newCDPSession(P);
  const touch = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts });
  return Object.assign(g, { D, say, check, shot, log, bad, cdp, touch, frames: (k) => frames(P, k), state: () => state(P) });
}
function endBlend(P) { return P.evaluate(() => { const b = window.Rocket.debug().cam().blend; if (b) { b.hold = null; b.t0 = performance.now() - b.dur * 1000 - 1; } }); }

// A level run LEN blocks ahead (and 3 behind), 5 wide, the ground one block, the air 16 blocks over it, off the homage,
// the tree and the wreck: the nearest such run that needs the fewest blocks changed, then those blocks changed.
async function arena(G, LEN, WIDE) {
  WIDE = WIDE || 2;
  const site = await G.D((a) => { const LEN = a.LEN, WIDE = a.WIDE;
    const d = window.Rocket.debug(), w = d.w, S = w.SOLID, x0 = Math.floor(d.P.x), z0 = Math.floor(d.P.z);
    const hm = d.homage(), hb = hm && hm.box, tr = d.underTree(), wr = d.place.wreck;
    const bad = (cx, cz) => cx < 2 || cz < 2 || cx >= w.SX - 2 || cz >= w.SZ - 2 || (hb && cx >= hb[0] - 4 && cx <= hb[2] + 4 && cz >= hb[1] - 4 && cz <= hb[3] + 4) ||
      Math.hypot(cx + 0.5 - tr.x, cz + 0.5 - tr.z) < 5 || (Math.abs(cx - wr.x) <= 4 && Math.abs(cz - wr.z) <= 4);
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    let best = null;
    for (let r = 0; r < 30; r += 2) {
      for (let a = 0; a < Math.max(1, 4 * r); a++) {
        const th = a / Math.max(1, 4 * r) * 2 * Math.PI, x = Math.floor(x0 + Math.cos(th) * r), z = Math.floor(z0 + Math.sin(th) * r);
        let y = -1;
        for (let yy = Math.floor(d.P.y) + 4; yy > 1; yy--) { if (S[w.get(x, yy - 1, z)] && !S[w.get(x, yy, z)] && w.get(x, yy - 1, z) !== 6) { y = yy; break; } }
        if (y < 2 || y + 17 >= w.SY) { continue; }
        for (const [ax, az] of dirs) {
          const px = -az, pz = ax; let cost = 0, ok = true;
          for (let s = -3; s <= LEN && ok; s++) for (let q = -WIDE; q <= WIDE && ok; q++) {
            const cx = x + ax * s + px * q, cz = z + az * s + pz * q;
            if (bad(cx, cz)) { ok = false; break; }
            if (!S[w.get(cx, y - 1, cz)]) { cost += 1; }
            for (let k = 0; k < 16; k++) { if (w.get(cx, y + k, cz) !== 0) { cost += 1; } }
            if (best && cost >= best.cost) { ok = false; }
          }
          if (ok && (!best || cost < best.cost)) { best = { x, y, z, ax, az, px, pz, yaw: Math.atan2(ax, -az), cost }; }
        }
      }
      if (best && best.cost < 40) { break; }
    }
    return best;
  }, { LEN, WIDE });
  if (!site) { throw new Error("no arena"); }
  const changed = await G.D((a) => {
    const d = window.Rocket.debug(), w = d.w, S = w.SOLID, s0 = a.site, cols = {};
    const g = S[w.get(s0.x, s0.y - 1, s0.z)] ? w.get(s0.x, s0.y - 1, s0.z) : 1;
    for (let s = -3; s <= a.LEN; s++) for (let q = -a.WIDE; q <= a.WIDE; q++) {
      const cx = s0.x + s0.ax * s + s0.px * q, cz = s0.z + s0.az * s + s0.pz * q;
      if (!S[w.get(cx, s0.y - 1, cz)]) { w.set(cx, s0.y - 1, cz, g); cols[cx + "," + cz] = 1; }
      for (let k = 0; k < 16; k++) { if (w.get(cx, s0.y + k, cz) !== 0) { w.set(cx, s0.y + k, cz, 0); cols[cx + "," + cz] = 1; } }
    }
    Object.keys(cols).forEach((c) => { const [x, z] = c.split(",").map(Number); d.remeshAt(x, z); });
    return Object.keys(cols).length;
  }, { site, LEN, WIDE });
  site.changed = changed;
  const cell = (s, q, dy) => [site.x + site.ax * s + site.px * (q || 0), site.y + (dy || 0), site.z + site.az * s + site.pz * (q || 0)];
  return { site, cell };
}
// stood at a point facing yaw with the pitch given, the camera's blend ended
function stand(G, q) {
  return G.D((q) => { const d = window.Rocket.debug(), b = d.cam().blend; if (b && b.hold == null) { b.t0 = performance.now() - b.dur * 1000 - 1; }
    Object.assign(d.P, { x: q.x, y: q.y, z: q.z, vx: 0, vy: 0, vz: 0, yaw: q.yaw, face: q.yaw, pitch: q.pitch == null ? -0.229 : q.pitch, want: null }); }, q);
}
function setB(G, list, b) {
  return G.D((a) => { const d = window.Rocket.debug(), cols = {}; a.list.forEach((c) => { d.w.set(c[0], c[1], c[2], a.b); cols[c[0] + "," + c[2]] = 1; });
    Object.keys(cols).forEach((c) => { const [x, z] = c.split(",").map(Number); d.remeshAt(x, z); }); }, { list, b });
}
// a recorder after each of the game's frames (rAF order: the game's frame, then this)
async function recorder(G) {
  await G.D(() => {
    window.__rec = []; window.__recOn = false;
    (function rec() {
      if (window.__recOn) {
        const d = window.Rocket.debug(), s = d.sight();
        window.__rec.push({ f: window.__frames, V: window.__V, n: d.pearls().length, carried: d.carried(), ease: s.ease, up: s.up, next: s.next, ready: s.ready, fling: s.fling,
          yaw: d.P.yaw, pitch: d.P.pitch, walked: d.P.walked, x: d.P.x, z: d.P.z, theta: s.theta, turn: s.turn, swing: d.swing() && { u: d.swing().u, ret: d.swing().ret } });
      }
      requestAnimationFrame(rec);
    })();
  });
}
const recOn = (G, on) => G.D((on) => { window.__rec = []; window.__recOn = on; }, on);
const recs = (G) => G.D(() => window.__rec.slice());
module.exports = { start, endBlend, arena, stand, setB, recorder, recOn, recs, frames };
