// pb_measure.js - three numbers the artist asked to move (28 Oct 2026): "I want 33% more color", "I need to be able to
// see the ball 33% better", "can you stabilize the perspective 50% more when moving". The same moments every run:
//   colour   the frame's mean chroma (max - min of a pixel's channels, 0..1) and its share of black pixels, in three views
//   pearl    the pearl's light: in a window round each pearl in play, the light above the window's own background (its
//            median), summed, the frame drawn with the pearls against the same frame with them hidden
//   camera   his eye through a shuffle (the stick hard left and right, 0.4 s each, 6 s) and a sprint: the eye's jitter
//            (its lateral position less its own one-second mean, as a root mean square, and its acceleration's), and how
//            far off the middle of the screen he goes in a sprint (his middle, in the screen's half widths)
// node pb_measure.js [port] [label]
const { chromium } = require("playwright");
const [port, label] = process.argv.slice(2);
const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, DESK = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const out = { label: label || "", colour: {}, pearl: {}, camera: {} };
  // (PB_ONLY: one of colour, pearl, camera; PB_SET: a JSON of ASC values to try, PB_CAM of CAM values, for tuning)
  const ONLY = process.env.PB_ONLY || "", SET = process.env.PB_SET ? JSON.parse(process.env.PB_SET) : null, CAMSET = process.env.PB_CAM ? JSON.parse(process.env.PB_CAM) : null;
  const open = async (view) => { const p = await b.newPage(view); await p.goto(url); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 }); await p.evaluate((set) => { const d = window.Pickleball.debug(); d.pause(true); if (set && d.ASC) { Object.assign(d.ASC, set); } if (set && set.cam && d.CAM) { Object.assign(d.CAM, set.cam); } }, SET); return p; };
  const rally = () => { const d = window.Pickleball.debug(); d.enter(0); d.run(2.5); d.toServe();
    for (let i = 0; i < 200; i++) { const u = d.meter(); if (u != null && u >= 0.5 && u <= 0.7) { d.run(1 / 60, true); break; } d.run(1 / 60); }
    for (let i = 0; i < 400; i++) { d.run(1 / 60); const m = d.court.m; if (m && m.balls.some((q) => !q.dead && q.last === "them" && q.y > 1)) { break; } } };
  const stats = async (p) => p.evaluate(() => {
    const d = window.Pickleball.debug(); d.draw();
    const v = document.getElementById("view"), c = document.createElement("canvas"); c.width = v.width; c.height = v.height;
    const g = c.getContext("2d"); g.drawImage(v, 0, 0); const px = g.getImageData(0, 0, c.width, c.height).data;
    // (and colourfulness, M, as Hasler and Süsstrunk measure it ("Measuring colourfulness in natural images", 2003):
    // the opponent channels rg = R - G and yb = (R + G) / 2 - B, M = sqrt(var rg + var yb) + 0.3 sqrt(mean rg² + mean yb²))
    let ch = 0, black = 0, n = 0, srg = 0, syb = 0, qrg = 0, qyb = 0;
    for (let i = 0; i < px.length; i += 4 * 3) { const r = px[i], gg = px[i + 1], bb = px[i + 2], mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb); ch += (mx - mn) / 255; if (mx < 12) { black++; } n++;
      const rg = r - gg, yb = 0.5 * (r + gg) - bb; srg += rg; syb += yb; qrg += rg * rg; qyb += yb * yb; }
    const mrg = srg / n, myb = syb / n, vrg = qrg / n - mrg * mrg, vyb = qyb / n - myb * myb;
    return { chroma: +(ch / n).toFixed(4), black: +(black / n).toFixed(3), M: +(Math.sqrt(vrg + vyb) + 0.3 * Math.sqrt(mrg * mrg + myb * myb)).toFixed(2) };
  });
  // colour
  if (!ONLY || ONLY === "colour") for (const [name, view, setup] of [["phone walk", PHONE, () => window.Pickleball.debug().run(1.5)], ["phone rally", PHONE, rally], ["desk rally", DESK, rally]]) {
    const p = await open(view); await p.evaluate(setup); out.colour[name] = await stats(p); await p.close();
  }
  // pearl: the frame (the view's canvas, characters) with the pearls and without, in a window round each
  if (!ONLY || ONLY === "pearl") for (const [name, view] of [["phone rally", PHONE], ["desk rally", DESK]]) {
    const p = await open(view); await p.evaluate(rally);
    // (five moments of the rally, 0.15 s apart, averaged: one frame's pearl can sit half behind something)
    const samples = [];
    for (let sI = 0; sI < 5; sI++) {
    if (sI) { await p.evaluate(() => window.Pickleball.debug().run(0.15)); }
    const r = await p.evaluate(() => {
      const d = window.Pickleball.debug(), m = d.court.m, v = document.getElementById("view");
      const grab = () => { d.draw(); const c = document.createElement("canvas"); c.width = v.width; c.height = v.height; const g = c.getContext("2d"); g.drawImage(v, 0, 0); const h = document.getElementById("hud"); g.drawImage(h, 0, 0, c.width, c.height); return g.getImageData(0, 0, c.width, c.height).data; };
      const W = v.width, H = v.height, live = m.balls.filter((q) => !q.dead);
      const with_ = grab(); const keep = live.map((q) => q.x); live.forEach((q) => { q.x += 1000; }); const without = grab(); live.forEach((q, i) => { q.x = keep[i]; }); d.draw();
      const vp = d.vp ? d.vp() : null; let total = 0, peak = 0; const rad = Math.round(H * 0.035);
      live.forEach((q) => {
        const s = d.toScreen([q.x, q.y, q.z]); if (!s) { return; }
        const cx = Math.round(s[0] / v.clientWidth * W), cy = Math.round(s[1] / v.clientHeight * H);
        for (let y = cy - rad; y <= cy + rad; y++) { for (let x = cx - rad; x <= cx + rad; x++) { if (x < 0 || y < 0 || x >= W || y >= H) { continue; } const i = (y * W + x) * 4;
          const a = (with_[i] + with_[i + 1] + with_[i + 2]) / 765, o = (without[i] + without[i + 1] + without[i + 2]) / 765, e = Math.max(0, a - o); total += e; peak = Math.max(peak, e); } }
      });
      void vp; return { pearls: live.length, light: +total.toFixed(1), peak: +peak.toFixed(3) };
    });
    samples.push(r); }
    out.pearl[name] = { pearls: samples.map((q) => q.pearls).join(","), light: +(samples.reduce((a, q) => a + q.light, 0) / samples.length).toFixed(1), each: samples.map((q) => q.light) }; await p.close();
  }
  // camera: the shuffle and the sprint, his eye each frame
  if (!ONLY || ONLY === "camera") { const p = await open(PHONE);
    if (CAMSET) { await p.evaluate((c) => Object.assign(window.Pickleball.debug().CAM, c), CAMSET); }
  out.camera = await p.evaluate(() => {
    const d = window.Pickleball.debug(), me = d.me; d.run(1.0);
    const eyes = [], offs = [], stick = (dx) => { d.input.stick = dx ? { id: -1, x: 0, y: 0, dx: dx * 60, dy: 0 } : null; };
    const step = () => { d.run(1 / 60); d.draw(); const c = d.camNow(); eyes.push(c.e[0]); const s = d.toScreen([me.x, 1.0, me.z]); offs.push(s ? (s[0] / innerWidth - 0.5) * 2 : 9); };
    // (the eye's jitter through a run of reversals: its lateral place less its own one-second mean, and its acceleration)
    const shake = (half) => { eyes.length = 0; for (let k = 0; k < Math.round(6 / (half / 60)); k++) { stick(k % 2 ? 1 : -1); for (let i = 0; i < half; i++) { step(); } } stick(0); for (let i = 0; i < 60; i++) { d.run(1 / 60); }
      const sh = eyes.slice(), n = sh.length, w = 30; let hp = 0, acc = 0;
      for (let i = w; i < n - w; i++) { let s = 0; for (let j = i - w; j <= i + w; j++) { s += sh[j]; } hp += Math.pow(sh[i] - s / (2 * w + 1), 2); }
      for (let i = 1; i < n - 1; i++) { acc += Math.pow((sh[i + 1] - 2 * sh[i] + sh[i - 1]) * 3600, 2); }
      return [Math.sqrt(hp / (n - 2 * w)), Math.sqrt(acc / (n - 2))]; };
    const juke = shake(15), shuffle = shake(24);   // jukes: 0.25 s each way; the shuffle: 0.4 s
    eyes.length = 0; offs.length = 0;
    stick(1); for (let i = 0; i < 90; i++) { step(); } stick(-1); for (let i = 0; i < 90; i++) { step(); } stick(0); for (let i = 0; i < 40; i++) { step(); }   // the sprint: 1.5 s right, 1.5 s left
    const off = Math.max(...offs.map(Math.abs));
    return { jukeJitter: +juke[0].toFixed(4), jukeAccel: +juke[1].toFixed(2), jitter: +shuffle[0].toFixed(4), accel: +shuffle[1].toFixed(2), sprintOff: +off.toFixed(2) };
  });
  await p.close(); }
  console.log(JSON.stringify(out));
  await b.close();
})();
