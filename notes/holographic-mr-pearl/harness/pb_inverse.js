// pb_inverse.js - the garden's inverse look (the artist, 4 Nov 2026: "When you walk onto the garden area with Mr. Pearl or
// driving through it in the coupe, I want the aesthetic of everything that falls visually within that region, defining
// the garden, to be the opposite in presence as far as brightness [and] detail to the current ASCII aesthetic ... but just
// in the garden area. Areas outside of that garden area remain in the same aesthetic as it currently is"). With two
// courts won: the region (gdnAt) holds every shrub, flower and flat of the garden and none of the courts, their run-offs
// and seams, the track or his starting place; off at the start, on as he walks onto it (faded in, steadily, within its
// time), off as he leaves, on in the coupe driven through it; from one fixed view, with him in it the garden's ground
// many times lighter than with him out of it, the courts' just as they were, and a still frame still. No errors.
// node pb_inverse.js [port] [phone|desk]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port, kind] = process.argv.slice(2);
const desk = kind === "desk";
const VIEW = desk ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  await seed(p);
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 2, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });

  // 1. the region: the garden's every part in it, the courts, run-offs, seams, track and his start not
  const rg = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT, N = d.courts.length, o = { out: [], miss: [] }; d.pause(true); d.run(0.3);
    const keys = []; for (let k = 0; k < N; k++) { keys.push("c" + k + (k === N - 1 ? "e" : "")); } keys.push("L", "R" + N);
    let n = 0;
    keys.forEach((k) => { const ch = d.gdnChunk(k); ch.foot.forEach((f) => { n++; if (!d.gdnAt(f[0], f[1])) { o.miss.push(k + " " + f[0].toFixed(1) + "," + f[1].toFixed(1)); } });
      ch.flats.forEach((q) => { n++; const cx = (q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, cz = (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4; if (!d.gdnAt(cx, cz)) { o.miss.push(k + " flat " + cx.toFixed(1) + "," + cz.toFixed(1)); } }); });
    o.n = n;
    const not = [];
    for (let k = 0; k < N; k++) { const cx = k * C.GAP; not.push([cx, 0], [cx + 2, 5], [cx - 5.4, 10.1], [cx + 5.4, -10.1], [cx + 5.9, 0], [cx + 5.9, 10.6], [cx + 5.9, -10.9]); }   // (to the block's edge: the right end's garden begins past the open court's)
    not.push([0, -25.2], [5, 25.2], [-15 - 25.2, 0], [(N - 1) * 12 + 25.2, 0], [2.2, C.L + 3]);   // (the track's middle line, round both bends; his start)
    not.forEach((q) => { if (d.gdnAt(q[0], q[1])) { o.out.push(q.map((v) => +v.toFixed(1))); } });
    o.miss = o.miss.slice(0, 5); return o;
  });
  check(rg.n > 200 && !rg.miss.length, `the garden's region holds all ${rg.n} of its shrubs, flowers and flats ${JSON.stringify(rg.miss)}`);
  check(!rg.out.length, `and none of the courts, their run-offs and seams, the track or his start ${JSON.stringify(rg.out)}`);

  // 2. on and off: at the start off; onto it, faded in within its time, steadily; off it, faded out; in the coupe, on
  const fd = await p.evaluate(() => {
    const d = window.Pickleball.debug(), G = d.GINV, C = d.COURT, o = {};
    d.me.x = 2.2; d.me.z = C.L + 3; d.run(0.6); o.start = { on: G.on, u: G.u };
    d.me.x = 3; d.me.z = 15; const us = []; for (let i = 0; i < 40; i++) { d.run(1 / 60); us.push(G.u); }
    o.inOn = G.on; o.full = us.findIndex((u) => u >= 1); o.mono = us.every((u, i) => i === 0 || u >= us[i - 1]); o.fade = G.FADE;
    o.step = Math.max(...us.map((u, i) => (i ? u - us[i - 1] : u)));
    d.me.x = 3; d.me.z = 8; for (let i = 0; i < 40; i++) { d.run(1 / 60); } o.outU = G.u; o.outOn = G.on;
    const c = d.car; c.mode = "ground"; c.x = 9; c.z = 16; c.yaw = Math.PI / 2; c.vh = c.yaw; c.v = 0; d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); d.rideToggle(); d.run(0.6);
    o.car = { mode: d.ride.mode, on: G.on, u: G.u }; d.rideToggle(); d.run(0.2); d.me.x = 3; d.me.z = 8; d.run(0.6);
    return o;
  });
  check(!fd.start.on && fd.start.u === 0, `at his start, on the court's run-off: the look as it is (${JSON.stringify(fd.start)})`);
  check(fd.inOn && fd.mono && fd.full > 0 && fd.full <= Math.ceil(fd.fade * 60) + 2 && fd.step < 0.1, `onto the garden: its inverse faded in, steadily, in ${fd.full} frames (at most ${fd.step.toFixed(3)} a frame)`);
  check(!fd.outOn && fd.outU === 0, "off it again: faded out, the look as it is");
  check(fd.car.mode === "car" && fd.car.on && fd.car.u === 1, `driven through it in the coupe: on (${JSON.stringify(fd.car)})`);

  // 3. one fixed view, him in the garden and out of it: the garden's ground lighter many times over, the courts' the same
  const lk = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT, cv = document.getElementById("view"), g = cv.getContext("webgl2"), dpr = cv.width / cv.clientWidth;
    const X = (d.courts.length - 1) * C.GAP;   // (the open court: empty between games, the won ones play on by themselves)
    d.camAt([X + 2, 6.5, 24], 0, -0.42);
    const pts = { walk: [X + 3.5, 0.01, 12.4], water: [X + 1.2, 0.01, 15.4], court: [X + 2, 0.01, 3.2], runoff: [X + 2.8, 0.01, 8.8] };   // (near the view's middle: a phone's too)
    const read = () => {
      d.draw(); const w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(w * h * 4); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
      const o = {}; let sum = 0; for (let i = 0; i < px.length; i += 4097) { sum += px[i]; }
      Object.keys(pts).forEach((k) => { const s = d.toScreen(pts[k]); if (!s) { o[k] = null; return; } const cx = Math.round(s[0] * dpr), cy = h - 1 - Math.round(s[1] * dpr), R = Math.round(14 * dpr); let t = 0, n = 0;
        for (let y = cy - R; y <= cy + R; y++) { for (let x = cx - R; x <= cx + R; x++) { if (x < 0 || y < 0 || x >= w || y >= h) { continue; } const j = (y * w + x) * 4; t += (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114); n++; } }
        o[k] = n ? +(t / n).toFixed(1) : null; });
      o.sum = sum; return o;
    };
    d.me.x = X - 4.5; d.me.z = C.L + 2.5; d.run(0.6); const out = read();
    d.me.x = X - 9; d.me.z = C.L + 11; d.run(0.6); const inn = read(), inn2 = read();   // (in the canal, off to the side of the view's line)
    d.camAt(null); d.me.x = 2.2; d.me.z = C.L + 3; d.run(0.6);
    return { out, inn, still: inn.sum === inn2.sum };
  });
  const r = (k) => lk.inn[k] / Math.max(1, lk.out[k]);
  check(lk.out.walk != null && r("walk") > 2.5 && r("water") > 2.5 && lk.inn.walk > 110, `from one view, him in the garden: its walk ${r("walk").toFixed(1)}x and its water ${r("water").toFixed(1)}x lighter (${JSON.stringify(lk.out)} -> ${JSON.stringify(lk.inn)})`);
  check(Math.abs(lk.inn.court - lk.out.court) < 6 && Math.abs(lk.inn.runoff - lk.out.runoff) < 6, `and the court and its run-off as they were (${lk.out.court} / ${lk.inn.court}, ${lk.out.runoff} / ${lk.inn.runoff})`);
  check(lk.still, "in the garden, a still frame still");

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
