// glyph.js - Glyph Light (artist, 26 Oct 2026: the world as glowing glyphs, a couple of characters near and refined
// far) and the monarch (a loop: a turn and a half, a straight line, a turn and a half, the straight line back; near, a
// couple of characters; far, a monarch), and the bass he holds (the Taylor GS Mini-e Koa Bass) seen close.
// node glyph.js desk|phone outdir port [hash]
const { open, frames } = require("./game.js");
const PNG = require("./png.js");
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
  const G = await D(() => window.Rocket.debug().glyph());
  check(G.ON === 1 && G.fb, "Glyph Light is on, its picture made (" + JSON.stringify(G) + ")");
  await P.screenshot({ path: `${out}/01_wake_glyphs.png` });
  await D(() => window.Rocket.debug().glyph(0)); await frames(P, 2);
  await P.screenshot({ path: `${out}/02_wake_picture.png` });
  await D(() => window.Rocket.debug().glyph(1)); await frames(P, 2);
  // the monarch: its loop, a turn and a half and a straight line each way
  const M = await D(() => window.Rocket.debug().monarch());
  check(!!M, "the monarch flies over the lawn where you wake (" + JSON.stringify(M && { A: M.A, y: M.y }) + ")");
  const path = await D(() => new Promise((done) => { const d = window.Rocket.debug(), f0 = window.__frames, pts = [];
    const go = () => { const m = d.monarch(); pts.push(m.at); if (window.__frames - f0 >= 200) { done(pts); } else { requestAnimationFrame(go); } }; go(); }));
  let moved = 0; for (let i = 1; i < path.length; i++) { moved += Math.hypot(path[i][0] - path[i - 1][0], path[i][2] - path[i - 1][2]); }
  check(moved > 8 && moved < 14, "it flies at about 2.2 m/s (" + moved.toFixed(1) + " m in 5 s)");
  // near it, mid, far: its loop shifted so that it is that far in front of the camera, on the camera's line
  for (const [name, dist] of [["03_monarch_near", 0.9], ["04_monarch_mid", 3], ["04_monarch_far", 12]]) {
    await D((dist) => { const d = window.Rocket.debug(), c = d.cam(), m = d.monarch().at, y = c.last.yaw, p = c.last.pitch;
      const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)], t = [c.eye[0] + f[0] * dist, c.eye[1] + f[1] * dist, c.eye[2] + f[2] * dist];
      d.monarchShift([t[0] - m[0], t[1] - m[1], t[2] - m[2]]); }, dist);
    await frames(P, 1);
    await P.screenshot({ path: `${out}/${name}.png` });
    if (name.endsWith("near")) { await D(() => window.Rocket.debug().glyph(0)); await frames(P, 1); await P.screenshot({ path: `${out}/${name}_picture.png` }); await D(() => window.Rocket.debug().glyph(1)); }
  }
  // the bass, close: in front of him, a metre and a half off, the camera on his guitar
  await D(() => { const d = window.Rocket.debug(); d.P.pitch = -0.6; });
  await frames(P, 30);
  await P.screenshot({ path: `${out}/05_him_glyphs.png` });
  await D(() => window.Rocket.debug().glyph(0)); await frames(P, 2);
  await P.screenshot({ path: `${out}/06_him_picture.png` });
  await D(() => window.Rocket.debug().glyph(1)); await frames(P, 2);
  // his head left as it is (the one thing seen as it is): its pixels the same with the glyphs on and off, his body's not
  // (he turned to face the camera, seen level: his face below the hat's brim; from behind or above the hat covers it)
  await D(() => { const d = window.Rocket.debug(); d.P.pitch = 0.05; d.P.face = d.P.yaw + Math.PI; }); await frames(P, 20);
  const hs = await D(() => { const d = window.Rocket.debug(), c = d.cam(), h = d.sight().head, y = c.last.yaw, p = c.last.pitch;
    const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)], r = [Math.cos(y), 0, Math.sin(y)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], v = [h[0] - c.eye[0], h[1] - c.eye[1], h[2] - c.eye[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], z = dot(v, f), k = 1 / Math.tan(35 * Math.PI / 180), W = innerWidth, H = innerHeight;
    return { x: (dot(v, r) / z * k * H / W * 0.5 + 0.5) * W, y: (1 - (dot(v, u) / z * k * 0.5 + 0.5)) * H, r: 0.2457 / z * k * H / 2, W, H }; });
  say("before the head check: " + JSON.stringify(await D(() => { const g = window.Rocket.debug().glyph(); return { ON: g.ON, fb: g.fb, STORY: g.STORY, pitch: window.Rocket.debug().P.pitch }; })));
  const onB = await P.screenshot({ path: `${out}/08_head_on.png` }), on = onB.toString("base64");
  await D(() => window.Rocket.debug().glyph(0)); await frames(P, 2);
  const offB = await P.screenshot({ path: `${out}/08_head_off.png` }), off = offB.toString("base64");
  await D(() => window.Rocket.debug().glyph(1)); await frames(P, 2);
  // (compared here, decoded by png.js: read back in a page, the pictures came back blank)
  const A = PNG.decode(onB), Bo = PNG.decode(offB), kk = A.width / hs.W;
  const diff = { head: PNG.boxDiff(A, Bo, hs.x, hs.y + hs.r * 0.45, hs.r * 0.3, kk), body: PNG.boxDiff(A, Bo, hs.x, hs.y + hs.r * 2.6, hs.r * 0.5, kk) };
  check(diff.head < 3 && diff.body > 3 * Math.max(1, diff.head), "his head unglyphed: its pixels differ by " + diff.head.toFixed(2) + " with the glyphs on and off, his body's by " + diff.body.toFixed(2) + " (" + JSON.stringify({ x: Math.round(hs.x), y: Math.round(hs.y), r: Math.round(hs.r) }) + ")");
  // ---- the storyboard: every control of Glyph Light in the place, frame beside frame
  const SB = await D(() => window.Rocket.debug().glyphStory());
  const F = SB.frames, has = (k, n) => Array.from({ length: n }, (_, v) => F.some((q) => q[k] === v)).every(Boolean);
  const keys = Object.keys(F[0]), stepsOk = F.slice(1).filter((q, i) => keys.filter((k) => q[k] !== F[i][k]).length <= 1).length;
  // (ASCII only, the artist, 28 Oct 2026: "Mr Pearl uses ASCII only": no frame has a style of its own)
  check(F.length === SB.grid * SB.grid && F.every((q) => !("style" in q)) && has("set", 7) && has("mode", 4) && has("motion", 5) && F.some((q) => q.inv) && F.some((q) => q.auto),
    "a storyboard of " + F.length + " frames, ASCII in every one, every glyph set, colour mode and motion in it, an inverted frame and an auto-levelled one");
  check(F[0].set === 0 && F[0].mode === 0 && F[0].motion === 0 && stepsOk >= F.length * 0.8, "its first frame as Glyph Light came in; " + stepsOk + " of " + (F.length - 1) + " frames a step from the one before");
  // a few frames seen: he stands in each panel's middle, looking along its row
  const frameAt = (n) => { const g = SB.grid, j = Math.floor(n / g), i0 = n % g, i = j % 2 ? g - 1 - i0 : i0; return [SB.origin[0] + (i + 0.5) * SB.panel, SB.origin[1] + (j + 0.5) * SB.panel]; };
  for (const n of [1, 2, 9, 20, 41]) {
    const q = frameAt(n);
    await D((a) => { const d = window.Rocket.debug(), w = d.w, x = Math.floor(a.q[0]), z = Math.floor(a.q[1]); let y = w.SY - 2; while (y > 1 && !w.SOLID[w.get(x, y - 1, z)]) { y--; }
      Object.assign(d.P, { x: a.q[0], y, z: a.q[1], vx: 0, vy: 0, vz: 0, yaw: 1.2, face: 1.2, pitch: -0.3 }); const b = d.cam().blend; if (b) { b.t0 = -1e9; } }, { q });
    await frames(P, 12);
    await P.screenshot({ path: `${out}/07_frame_${String(n).padStart(2, "0")}.png` });
    say("frame " + n + ": " + JSON.stringify(F[n]));
  }
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
