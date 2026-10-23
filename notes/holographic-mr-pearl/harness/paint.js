// paint.js - the world painted as Cezanne paints (CLAUDE.md) against the drawing alone, from the same places: under the
// tree, by the building, close to his back. node paint.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8815, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
  await frames(P, 40);
  for (const [name, set] of [["wake", null], ["building", "door"]]) {
    if (set) { await D(() => { const d = window.Rocket.debug(), dr = d.place.door || d.place.centre; Object.assign(d.P, { x: dr.x + 4, z: dr.z + 4, yaw: Math.atan2(-4, 4) + Math.PI, pitch: -0.1 }); const b = d.cam().blend; if (b) { b.t0 = -1e9; } }); await frames(P, 40); }
    for (const v of [0, 1]) {
      await D((v) => window.Rocket.debug().paint(v), v);
      await frames(P, 3);
      await P.screenshot({ path: `${out}/${name}_paint${v}.png` });
    }
  }
  console.log("errors " + JSON.stringify(errors));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
