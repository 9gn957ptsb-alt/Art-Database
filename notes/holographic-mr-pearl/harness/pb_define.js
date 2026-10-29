// pb_define.js - how defined the athletes are (28 Oct 2026; the artist: "It's still really hard to see anything,
// objects need to be three times as defined as they are now"). For each view: the frame drawn plainly (no characters)
// with and without Mr Pearl, and with and without Mr Plan, finds exactly where each stands (his footprint); the frame
// as the player sees it, in characters, is blurred by a cell (how a thing reads at a glance, before its characters are
// read), and his definition is the contrast of his footprint against a ring of ground around it, two cells wide:
// (inside - ring) / (ring + 0.05), the light he stands out by (D); and S, how closely that light keeps his shape.
// node pb_define.js [port] [label]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port, label] = process.argv.slice(2);
const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
const rally = () => { const d = window.Pickleball.debug(); d.enter(0); d.run(2.5);
  d.toServe();
  for (let i = 0; i < 200; i++) { const u = d.meter(); if (u != null && u >= 0.5 && u <= 0.7) { d.run(1 / 60, true); break; } d.run(1 / 60); }
  for (let i = 0; i < 400; i++) { d.run(1 / 60); const m = d.court.m; if (m && m.balls.some((b) => !b.dead && b.last === "them" && b.y > 1)) { break; } } };
const VIEWS = [
  { name: "phone rally", view: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, cell: 24, setup: rally },
  { name: "phone walk", view: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }, cell: 24, setup: () => window.Pickleball.debug().run(1.5) },
  { name: "desk rally", view: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, cell: 12, setup: rally },
  { name: "desk Mr Plan close", view: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }, cell: 12, setup: rally, after: () => { const d = window.Pickleball.debug(), pl = d.plans[0]; d.camAt([pl.x + 1.2, 1.5, pl.z + 3.4], -0.33, -0.12); } },
];
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), rows = [];
  for (const V of VIEWS) {
    const p = await b.newPage(V.view);
    await seed(p);   // (past the walk-through: pb_walk.js tests it)
    await p.goto(url);
    await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    await p.evaluate(() => window.Pickleball.debug().pause(true));
    await p.evaluate(V.setup);
    if (V.after) { await p.evaluate(V.after); }
    const r = await p.evaluate((cell) => {
      const d = window.Pickleball.debug(), cv = document.getElementById("view");
      d.draw(); const cam = d.camNow();
      const grab = (plain, hide) => { d.hide(hide); d.camAt(cam.e, cam.yaw, cam.pitch, plain); d.draw();
        const c = document.createElement("canvas"); c.width = cv.width; c.height = cv.height; const x = c.getContext("2d"); x.drawImage(cv, 0, 0);
        return x.getImageData(0, 0, c.width, c.height).data; };
      const W = cv.width, H = cv.height, all = grab(true, false), noMe = grab(true, "me"), noPlan = grab(true, "plan"), O = grab(false, false);
      d.hide(false); d.camAt(null);
      const lum = new Float32Array(W * H); for (let i = 0; i < W * H; i++) { lum[i] = (0.299 * O[4 * i] + 0.587 * O[4 * i + 1] + 0.114 * O[4 * i + 2]) / 255; }
      const box = (src, r) => { // three box passes ~ a gaussian of sigma r/sqrt(3)
        let a = Float32Array.from(src), t = new Float32Array(W * H);
        for (let pass = 0; pass < 3; pass++) {
          for (let y = 0; y < H; y++) { let s = 0; for (let x = -r; x <= r; x++) { s += a[y * W + Math.min(W - 1, Math.max(0, x))]; } for (let x = 0; x < W; x++) { t[y * W + x] = s / (2 * r + 1); s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)]; } }
          for (let x = 0; x < W; x++) { let s = 0; for (let y = -r; y <= r; y++) { s += t[Math.min(H - 1, Math.max(0, y)) * W + x]; } for (let y = 0; y < H; y++) { a[y * W + x] = s / (2 * r + 1); s += t[Math.min(H - 1, y + r + 1) * W + x] - t[Math.max(0, y - r) * W + x]; } }
        }
        return a; };
      const glance = box(lum, Math.round(cell / 2));
      const out = {};
      for (const [who, without] of [["Mr Pearl", noMe], ["Mr Plan", noPlan]]) {
        const F = new Float32Array(W * H); let n = 0;
        for (let i = 0; i < W * H; i++) { const dd = Math.abs(all[4 * i] - without[4 * i]) + Math.abs(all[4 * i + 1] - without[4 * i + 1]) + Math.abs(all[4 * i + 2] - without[4 * i + 2]); if (dd > 30) { F[i] = 1; n++; } }
        if (n < 20) { out[who] = null; continue; }
        const near = box(F, cell);   // (out to about two cells)
        let si = 0, ni = 0, sr = 0, nr = 0, sraw = 0;
        for (let i = 0; i < W * H; i++) { if (F[i]) { si += glance[i]; sraw += lum[i]; ni++; } else if (near[i] > 0.002) { sr += glance[i]; nr++; } }
        const inside = si / ni, ring = sr / Math.max(1, nr);
        // and his shape: the light seen at a glance, cut halfway between him and the ground round him, against where he
        // really stands (the share both cover of what either covers: 1 is his exact silhouette, a slab or a smudge less)
        const cut = (inside + ring) / 2; let both = 0, either = 0;
        for (let i = 0; i < W * H; i++) { if (!F[i] && !(near[i] > 0.002)) { continue; } const lit = glance[i] > cut; if (lit && F[i]) { both++; } if (lit || F[i]) { either++; } }
        out[who] = { px: n, inside: +inside.toFixed(3), ring: +ring.toFixed(3), raw: +(sraw / ni).toFixed(3), D: +((inside - ring) / (ring + 0.05)).toFixed(2), S: +(both / either).toFixed(2) };
      }
      return out;
    }, V.cell);
    rows.push({ view: V.name, r });
    console.log((label || "") + "  " + V.name.padEnd(20) + Object.entries(r).map(([k, v]) => v ? `${k}: D ${String(v.D).padStart(5)} S ${v.S} (in ${v.inside}, ring ${v.ring}, ${v.px} px)` : `${k}: not in view`).join("   "));
    await p.close();
  }
  await b.close();
  require("fs").writeFileSync(require("path").join(require("os").tmpdir(), "pb_define_" + (label || "x").replace(/\W/g, "") + ".json"), JSON.stringify(rows));
})().catch((e) => { console.error(e); process.exit(2); });
