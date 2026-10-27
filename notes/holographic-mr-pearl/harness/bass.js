// bass.js - the bass he holds, the Taylor GS Mini-e Koa Bass (artist, 26 Oct 2026): he turned to the camera, seen
// close, and a close-up of the bass. node bass.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const fs = require("fs");
const [view, out, port, hash] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8815, hash: hash || "form/15/7" });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); });
  await frames(P, 6);
  await D(() => { const d = window.Rocket.debug(); d.P.face = d.P.yaw + Math.PI; d.P.want = null; d.P.pitch = -0.15; });
  await frames(P, 30);
  await D(() => { const t = document.getElementById("toast"); t.classList.remove("show"); t.style.display = "none"; });
  await frames(P, 2);
  await P.screenshot({ path: `${out}/bass_front.png` });
  const c = await D(() => { const d = window.Rocket.debug(), s = d.screenOf([d.P.x, d.P.y + 0.75, d.P.z]); return s; });
  if (c) { await P.screenshot({ path: `${out}/bass_close.png`, clip: { x: Math.max(0, c[0] - 90), y: Math.max(0, c[1] - 90), width: 180, height: 180 } }); }
  console.log("errors " + JSON.stringify(errors));
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
