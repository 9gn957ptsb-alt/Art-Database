// nose.js - his nose as the sight's aim (artist, 23 Oct 2026: "his nose is a small contour like a section cut that gets
// filled when poche-ing a wall ... to establish a usable point to aim"): with the sight up, the nose's triangle below the
// crux is solid (the drawing's black), its contour white, the words name it, and a throw still goes where it points.
// node nose.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8815, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } const d = window.Rocket.debug(); d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); d.P.pitch = 0.05; });
  await frames(P, 4);
  await D(() => { window.__toasts.length = 0; window.Rocket.debug().raiseSight(true); });
  const K = await D(() => window.Rocket.debug().sightConsts);
  await frames(P, Math.ceil(K.T_VIEW * 40) + 8);
  const r = await D(() => {
    const hud = document.getElementById("hud"), c = hud.getContext("2d"), k = hud.width / innerWidth;
    const f = innerHeight / 2 / Math.tan(35 * Math.PI / 180), u = window.Rocket.debug().sightConsts.U * f, h = 3 * u * Math.sqrt(3) / 2;
    const cx = innerWidth / 2, cy = innerHeight / 2;
    const px = (x, y) => Array.from(c.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data);
    return { u, h, k, mid: px(cx, cy + h * 0.66), left: px(cx - 0.3 * u, cy + h * 0.8), right: px(cx + 0.3 * u, cy + h * 0.8), base: [-1.5, -1, -0.5, 0, 0.5, 1, 1.5].map((dy) => px(cx, cy + h + dy)).sort((a, b) => b[0] - a[0])[0], toasts: window.__toasts.slice(), on: window.Rocket.debug().sight().on };
  });
  say("nose " + JSON.stringify(r));
  const solid = (q) => q[3] > 230 && q[0] < 50 && q[1] < 50 && q[2] < 50;
  check(r.on && solid(r.mid) && solid(r.left) && solid(r.right), "the sight up: the nose under the crux is solid black (" + r.h.toFixed(1) + " px tall, u " + r.u.toFixed(2) + ")");
  check(r.base[3] > 200 && r.base[0] > 150, "its contour is the mark's white line (" + r.base + ")");
  check(r.toasts.some((t) => /your nose the aim/.test(t)), "the words name it (" + JSON.stringify(r.toasts) + ")");
  await P.screenshot({ path: `${out}/nose_sight.png` });
  const z = await D(() => ({ x: innerWidth / 2 - 60, y: innerHeight / 2 - 40, width: 120, height: 120 }));
  await P.screenshot({ path: `${out}/nose_zoom.png`, clip: z });
  // a throw goes where the nose points: the arc's first point ahead on the camera's line, the pearl out of the glove
  const t = await D(() => { const d = window.Rocket.debug(); const ok = d.throwAt(); return { ok }; });
  await frames(P, 6);
  const t2 = await D(() => ({ flying: window.Rocket.debug().sight().fling !== undefined, toasts: window.__toasts.slice() }));
  check(t.ok, "a tap throws as before (" + JSON.stringify(t2.toasts.slice(-1)) + ")");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
