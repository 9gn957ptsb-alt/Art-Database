// land.js - a phone on its side (844 x 390): the window's radius, the column of Sight and Holo from the top, the
// tag clear of it; photographed (18). node land.js outdir port
const L = require("./lib.js");
const fs = require("fs");
const [out, port] = process.argv.slice(2);
(async () => {
  const G = await L.start("phone", port, out);
  const { P, D, say, check, shot } = G;
  await P.setViewportSize({ width: 844, height: 390 });
  await D(() => window.dispatchEvent(new Event("resize")));
  await G.frames(6); await L.endBlend(P); await G.frames(3);
  const { site } = await L.arena(G, 44);
  await L.stand(G, { x: site.x + 0.5, y: site.y, z: site.z + 0.5, yaw: site.yaw, pitch: 0 });
  await G.frames(4);
  await D(() => window.Rocket.debug().raiseSight(true));
  await G.frames(22);
  const r = await D(() => {
    const d = window.Rocket.debug(), s = d.sight(), e = d.cam().eye, R = d.pearl().PEARL.headR, D2 = Math.hypot(s.head[0] - e[0], s.head[1] - e[1], s.head[2] - e[2]);
    const f = innerHeight / 2 / Math.tan(35 * Math.PI / 180), rect = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(Math.round); };
    return { W: innerWidth, H: innerHeight, rw: f * R / Math.sqrt(D2 * D2 - R * R), sight: rect("v-sight"), holo: rect("v-holo"), tag: rect("sight-tag"), tagShown: !document.getElementById("sight-tag").hidden };
  });
  say("landscape " + JSON.stringify(r));
  await shot("18_on_its_side", 1);
  check(Math.abs(r.rw - 42.78) < 1, "on its side the window's radius " + r.rw.toFixed(2) + " px (42.8 ± 1)");
  check(r.sight[1] < r.holo[1] && r.sight[3] <= r.holo[1] - 5, "the column runs down from the top: Sight, then Holo, 6 px between (" + JSON.stringify([r.sight, r.holo]) + ")");
  const overlap = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  check(!overlap(r.tag, r.sight) && !overlap(r.tag, r.holo), "the words under the glass clear of the buttons");
  check(G.errors.length === 0, "no page errors " + JSON.stringify(G.errors));
  fs.writeFileSync(`${out}/results.json`, JSON.stringify({ r, errors: G.errors, bad: G.bad }, null, 1));
  fs.writeFileSync(`${out}/log.txt`, G.log.join("\n") + "\n");
  await G.browser.close();
  console.log(G.bad.length ? "FAILED: " + G.bad.join("; ") : "ALL OK");
  process.exit(G.bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
