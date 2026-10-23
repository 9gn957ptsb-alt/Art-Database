// note.js - the note case alone (sight.js 10, the note): a pearl thrown onto a note lying on the ground 7 m off falls
// on it and says so. node note.js desk|phone outdir port
const L = require("./lib.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
(async () => {
  const G = await L.start(view, port, out);
  const { P, D, say, check } = G;
  const { site, cell } = await L.arena(G, 20);
  const home = { x: site.x + 0.5, y: site.y, z: site.z + 0.5, yaw: site.yaw };
  const nc = cell(7, 0, 0);
  await L.setB(G, [nc], 26);
  await L.stand(G, Object.assign({}, home, { pitch: -0.2 }));
  await D(() => window.Rocket.debug().raiseSight(true)); await G.frames(18);
  const seat = await D(() => { const d = window.Rocket.debug(); return [d.P.x, d.P.y + d.pearl().PEARL.headY, d.P.z]; });
  const T = [nc[0] + 0.5, nc[1] + 0.05, nc[2] + 0.5], yaw = Math.atan2(T[0] - seat[0], -(T[2] - seat[2])), want = Math.hypot(T[0] - seat[0], T[2] - seat[2]);
  let lo = -1.2, hi = 0.75, s = null;
  for (let i = 0; i < 16; i++) {
    const pitch = (lo + hi) / 2;
    await D((a) => { const d = window.Rocket.debug(); d.P.yaw = a.yaw; d.P.pitch = a.pitch; }, { yaw, pitch }); await G.frames(4);
    s = await D(() => window.Rocket.debug().sight());
    if (s.land && Math.floor(s.land.x) === nc[0] && Math.floor(s.land.z) === nc[2]) { break; }
    const got = s.land ? Math.hypot(s.land.x - seat[0], s.land.z - seat[2]) : 1e9;
    if (got < want) { lo = pitch; } else { hi = pitch; }
  }
  say("aim " + JSON.stringify(s.land));
  await D(() => { window.__toasts.length = 0; window.Rocket.debug().throwAt(); });
  await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
  await G.frames(3);
  const p = await D(() => window.Rocket.debug().pearls()[0]), said = await D(() => window.__toasts.slice());
  await G.shot("note_landed", 0);
  check(p.first.note && said.some((t) => /^Your pearl fell on a note/.test(t)), "a note: the pearl falls on it and says so (" + JSON.stringify(said) + ")");
  check(G.errors.length === 0, "no page errors " + JSON.stringify(G.errors));
  fs.writeFileSync(`${out}/log.txt`, G.log.join("\n") + "\n");
  await G.browser.close();
  console.log(G.bad.length ? "FAILED: " + G.bad.join("; ") : "ALL OK");
  process.exit(G.bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
