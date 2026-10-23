// swoosh.js - the swoosh the guitar leaves (22 Oct 2026), seen from his side in each of the three styles, the swing
// running free (smash.js holds the swing still for its keyframes, and a held guitar leaves none). node swoosh.js
// desk|phone outdir port. Shots at frames 6, 8 and 11 after the tap (the strike is at frame 10).
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8843 });
  const D = (fn, arg) => P.evaluate(fn, arg);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; });
  await frames(P, 4);
  // open level ground near where he stands, off the homage and the tree (as smash.js finds it)
  const site = await D(() => {
    const d = window.Rocket.debug(), w = d.w, S = w.SOLID, x0 = Math.floor(d.P.x), z0 = Math.floor(d.P.z), hm = d.homage(), hb = hm && hm.box, tr = d.underTree();
    const off = (cx, cz) => !(hb && cx >= hb[0] - 4 && cx <= hb[2] + 4 && cz >= hb[1] - 4 && cz <= hb[3] + 4) && Math.hypot(cx + 0.5 - tr.x, cz + 0.5 - tr.z) > 4;
    for (let r = 0; r < 60; r++) for (let a = 0; a < Math.max(1, 8 * r); a++) {
      const th = a / Math.max(1, 8 * r) * 2 * Math.PI, x = Math.floor(x0 + Math.cos(th) * r), z = Math.floor(z0 + Math.sin(th) * r);
      for (let y = 60; y > 2; y--) {
        if (!S[w.get(x, y - 1, z)]) { continue; }
        let ok = true;
        for (let dx = -4; dx <= 4 && ok; dx++) for (let dz = -4; dz <= 4 && ok; dz++) {
          if (!S[w.get(x + dx, y - 1, z + dz)] || w.get(x + dx, y - 1, z + dz) === 6 || !off(x + dx, z + dz)) { ok = false; }
          for (let k = 0; k < 4 && ok; k++) { if (w.get(x + dx, y + k, z + dz) !== 0) { ok = false; } }
        }
        if (ok) { return { x, y, z }; }
        break;
      }
    }
    return null;
  });
  if (!site) { console.log("FAIL no site"); await browser.close(); process.exit(1); }
  const said = [];
  for (const [st, k] of [["sweep", 0.1], ["slam", 0.5], ["spin", 0.9]]) {
    // he faces north (-z), a brick a step ahead at his waist; the camera to his left, looking across him
    await D((s) => { const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = performance.now() - b.dur * 1000 - 1; }
      d.w.set(s.x, s.y, s.z - 1, 9); d.remeshAt(s.x, s.z - 1);
      Object.assign(d.P, { x: s.x + 0.5, y: s.y, z: s.z + 0.5, vx: 0, vy: 0, vz: 0, yaw: Math.PI / 2, face: 0, pitch: -0.229, want: 0 }); }, site);
    await frames(P, 12);
    await D((k) => { window.__rnd = window.__rnd || Math.random; Math.random = () => k; }, k);
    await D((s) => { const d = window.Rocket.debug(), q = d.screenOf([s.x + 0.5, s.y + 0.5, s.z]); if (q) { d.act(q[0], q[1], false); } }, site);
    await D(() => { Math.random = window.__rnd; });
    const got = await D(() => { const s = window.Rocket.debug().swing(); return s && s.style; });
    said.push(st + ": " + got);
    for (const f of [6, 2, 3]) { await frames(P, f); await P.screenshot({ path: `${out}/${st}_f${f === 6 ? 6 : f === 2 ? 8 : 11}.png` }); }
    await P.waitForFunction(() => !window.Rocket.debug().swing());
    await frames(P, 4);
  }
  console.log(said.join("; "));
  console.log("errors " + JSON.stringify(errors));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
