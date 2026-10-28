// chars.js - the unit's studies in characters (artist, 27 Oct 2026: "Characters are the answer to the basic unit study,
// still conduct those studies on that shape"; asked which, "Both"): the four beside the tree drawn again with a
// character as the unit, each seen from its stone's eye, with Glyph Light on and off.
// node chars.js desk|phone outdir port [hash]
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
  await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); });
  await frames(P, 10);
  const C = await D(() => window.Rocket.debug().chars());
  check(C.count > 150 && C.apex > 0.05 && C.apex < 0.4, "the studies drawn in characters (" + JSON.stringify(C) + ")");
  const st = await D(() => { const s = window.Rocket.debug().studies(); return s && s.figures.map((f) => {
    const q = s.stands.filter((x) => x.i === f.i)[0], P0 = f.mesh.pos, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let j = 0; j < P0.length; j += 3) { for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], P0[j + k]); hi[k] = Math.max(hi[k], P0[j + k]); } }
    return { at: [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2], H: hi[1] - lo[1], eye: q.eye, name: q.name }; })
    .concat((s.sphere || []).length ? [{ at: s.sphere.reduce((a, c) => [a[0] + c[0] / s.sphere.length, a[1] + c[1] / s.sphere.length, a[2] + c[2] / s.sphere.length], [0, 0, 0]), H: 6, eye: s.stands.filter((x) => /sphere/i.test(x.name))[0].eye, name: "The sphere of the unit" }] : []); });
  const kinds = await D(() => { const s = window.Rocket.debug().studies(); return s.stands.map((q) => q.name + ": " + (s.figures.some((f) => f.i === q.i) ? "figure" : (s.sphere || []).length && /sphere/i.test(q.name) ? "blocks, now characters" : "empty plinth")); });
  say("studies here: " + kinds.join("; "));
  say("studies " + JSON.stringify(st));
  check(st && st.length >= 3, "the studies in characters, each seen (" + (st && st.map((q) => q.name).join(", ")) + ")");
  for (let i = 0; st && i < st.length; i++) {
    // from the stone's eye, two and a half heights of the study off along that line, looking at its middle
    await D((q) => { const d = window.Rocket.debug(), dx = q.at[0] - q.eye[0], dz = q.at[2] - q.eye[2], L = Math.hypot(dx, dz) || 1, yaw = Math.atan2(dx, -dz), back = Math.max(4, 2.5 * q.H);
      Object.assign(d.P, { x: q.at[0] - dx / L * back, y: q.eye[1] - 1.6, z: q.at[2] - dz / L * back, vx: 0, vy: 0, vz: 0, yaw, face: yaw, pitch: Math.atan2(q.at[1] - q.eye[1], back) }); }, st[i]);
    await frames(P, 12);
    await P.screenshot({ path: `${out}/0${i + 1}_study_glyphs.png` });
    await D(() => window.Rocket.debug().glyph(0)); await frames(P, 2);
    await P.screenshot({ path: `${out}/0${i + 1}_study_picture.png` });
    await D(() => window.Rocket.debug().glyph(1));
  }
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
