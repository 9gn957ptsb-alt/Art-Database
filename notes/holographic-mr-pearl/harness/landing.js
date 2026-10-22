// landing.js - out of the hologram the body follows the head (21 Oct 2026): node landing.js desk|phone outdir [port]
// Copied from wf10/build/scripts/landing.js and changed for "The body follows the head, not the other way around",
// one button (Holo, H) instead of Third / First / Holo, no "Bring the body here", no V or G, and the hologram's speed
// doubled. It requires the harness's own game.js where it is.
const { open, frames, state } = require("/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/scripts/game.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [];
const PHI = (1 + Math.sqrt(5)) / 2, WALK = 4.3;
(async () => {
  // The view the game kept before (first person) is set before the page loads: it must come back as third person.
  const { browser, P, errors } = await open({ view, virtual: 25, port: port ? +port : 8803, init: () => { try { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("rocket-view", "first"); sessionStorage.setItem("seeded", "1"); } } catch (e) { /* none */ } } });
  const D = (fn, arg) => P.evaluate(fn, arg);
  let n = 0;
  const shot = async (name, wait) => {
    await frames(P, wait || 2);
    const s = await state(P);
    await P.screenshot({ path: `${out}/${String(++n).padStart(2, "0")}_${name}.png` });
    const line = name + " " + JSON.stringify(s); console.log(line); log.push(line);
    return s;
  };
  const tap = async (sel) => { if (view === "phone") { await P.tap(sel); } else { await P.click(sel); } };
  const check = (ok, what) => { const l = (ok ? "ok   " : "FAIL ") + what; console.log(l); log.push(l); if (!ok) { bad.push(what); } };
  const near = (a, b, e) => Math.abs(a - b) < (e || 1e-6);
  // past the wake-up, the notes shut
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; });
  await frames(P, 30);
  // ---- the page: one button, no Return, no Bring, no First
  const page = await D(() => { const b = document.getElementById("v-holo"); return { ret: !!document.getElementById("return"), bring: !!document.getElementById("bring"), pov: document.querySelectorAll("[data-pov]").length,
    buttons: document.querySelectorAll(".views button").length, pressed: b && b.getAttribute("aria-pressed"), role: b && b.getAttribute("role"), title: b && b.title, text: b && b.textContent.trim(),
    kept: localStorage.getItem("rocket-view"), keys: document.querySelector(".keys").textContent }; });
  check(!page.ret && !page.bring, "no Return and no Bring the body here on the page");
  check(page.pov === 0 && page.buttons === 1 && page.text === "Holo", "one button, Holo (" + page.buttons + " buttons, " + page.pov + " [data-pov])");
  check(page.pressed === "false" && page.role === null, "the button is a toggle, not pressed (aria-pressed " + page.pressed + ")");
  check(/\(H\)$/.test(page.title || ""), "its title says what it does and its key (" + page.title + ")");
  check(!/\bV\b|\bG\b|first person/i.test(page.keys), "the start card's keys name no V, G or first person");
  const s0 = await state(P);
  const wake = await D(() => { const d = window.Rocket.debug(), s = d.sky(); return { stone: d.stone(), away: s && s.away, said: s && s.said, d: s ? Math.hypot(d.P.x - s.eye[0], d.P.z - s.eye[2]) : null }; });
  check(wake.stone === false && !wake.away && !wake.said, "come to where you woke, the view is not his eyes yet, nothing said (" + JSON.stringify(wake) + ")");
  check(s0.pov === "third" && page.kept === null && s0.camD > 1, "a kept first person comes back as third person (pov " + s0.pov + ", kept " + page.kept + ", camD " + s0.camD + ")");
  const C = await D(() => { const d = window.Rocket.debug(); return { headY: d.pearl().PEARL.headY, c: d.consts }; });
  check(near(C.c.HOLO_V, 2 * PHI * PHI * WALK, 1e-9) && near(C.c.HOLO_V_IN, 2 * PHI * WALK, 1e-9), "twice the speed: " + C.c.HOLO_V.toFixed(3) + " m/s out of doors, " + C.c.HOLO_V_IN.toFixed(3) + " in a room");
  // V and G no longer do anything
  await P.keyboard.press("v"); await P.keyboard.press("g"); await frames(P, 4);
  const sv = await state(P);
  check(sv.pov === "third" && sv.head === null && sv.camD > 1, "V and G do nothing (pov " + sv.pov + ")");
  // An open spot of ground some way off, for the head to go to.
  const spot = async (r0) => D((r0) => {
    const d = window.Rocket.debug(), w = d.w, S = w.SOLID;
    for (let r = r0; r < r0 + 30; r++) for (let a = 0; a < 16; a++) {
      const x = Math.floor(d.P.x + Math.cos(a / 16 * 6.283) * r), z = Math.floor(d.P.z + Math.sin(a / 16 * 6.283) * r);
      for (let y = 60; y > 1; y--) { if (S[w.get(x, y - 1, z)]) { let free = true; for (let k = 0; k < 3; k++) if (S[w.get(x, y + k, z)]) free = false; for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) if (S[w.get(x + dx, y, z + dz)] || S[w.get(x + dx, y + 1, z + dz)]) free = false; if (free) return { x: x + 0.5, y: y, z: z + 0.5 }; break; } }
    }
    return null;
  }, r0);
  const goOut = async () => {
    await tap("#v-holo");
    await frames(P, 3);
    await D(() => { const h = window.Rocket.debug().head(); h.t0 = performance.now() - 2000; });
    await P.waitForFunction(() => { const h = window.Rocket.debug().head(); return h && h.phase === "free"; });
    check(await D(() => document.getElementById("v-holo").getAttribute("aria-pressed") === "true"), "out: the button is pressed");
  };
  // One way out: into the hologram, the head put over a spot (high: 9 m up, to fall), then how() sets the body out.
  // live: the bar is let run frame by frame and timed; else it is stepped through by its clock.
  const outBy = async (name, how, o) => {
    o = o || {};
    await goOut();
    const q = o.at ? await o.at() : await spot(8 + n);
    await D((a) => { const d = window.Rocket.debug(), h = d.head(); h.x = a.q.x; h.z = a.q.z; h.y = a.q.y + a.headY + (a.high ? 9 : 0.02); d.P.pitch = -0.3; }, { q, headY: C.headY, high: o.high });
    await frames(P, 3);
    const before = await D(() => { const d = window.Rocket.debug(), h = d.head(); return { head: { x: h.x, y: h.y, z: h.z }, body: { x: d.P.x, y: d.P.y, z: d.P.z }, left: d.holoLeft() }; });
    await how();
    const set = await D(() => { const d = window.Rocket.debug(), h = d.head(); return h && { phase: h.phase, fl: h.flight && { from: h.flight.from, to: h.flight.to, t0: h.flight.t0, exact: h.flight.exact }, face: d.P.face, yaw: h.yaw, body: { x: d.P.x, y: d.P.y, z: d.P.z }, left: d.holoLeft() }; });
    const s1 = await shot(name + "_sets_out", 1);
    const said = s1.said + " " + s1.toast;
    check(set && set.phase === "follow" && set.fl, name + ": the body sets out (phase " + (set && set.phase) + ")");
    if (!set || !set.fl) { return null; }
    check(near(set.body.x, before.body.x, 0.01) && near(set.body.z, before.body.z, 0.01), name + ": it sets out from where it stood");
    check(near(set.fl.from[0], before.body.x, 1e-9) && near(set.fl.from[2], before.body.z, 1e-9), name + ": its way starts at the body");
    if (!o.wall) { check(near(set.fl.to[0], before.head.x, 1e-9) && near(set.fl.to[2], before.head.z, 1e-9) && near(set.fl.to[1], before.head.y - C.headY, 1e-9) && set.fl.exact, name + ": it goes to the spot under the head, exactly"); }
    check(near(set.face, set.yaw, 1e-9), name + ": facing the head's yaw");
    check(o.says.test(said) && (o.wall || !/nearest place it fits/.test(said)), name + ": says so (" + said.trim() + ")");
    // a second press while it is on its way does nothing; nor does trying to move the head
    if (o.again) { await o.again(); }
    await P.keyboard.down("w"); await frames(P, 4);
    const mid0 = await D(() => { const d = window.Rocket.debug(), h = d.head(); return { phase: h.phase, t0: h.flight.t0, head: { x: h.x, y: h.y, z: h.z }, left: d.holoLeft(), pov: d.pov(), harm: d.harm("a test, mid-flight") }; });
    await P.keyboard.up("w");
    check(mid0.phase === "follow" && mid0.t0 === set.fl.t0, name + ": a second press and a key to move do nothing on its way");
    check(near(mid0.head.x, before.head.x, 1e-9) && near(mid0.head.y, before.head.y, 1e-9) && near(mid0.head.z, before.head.z, 1e-9), name + ": the head holds where it is");
    check(mid0.pov === "holo" && mid0.harm === true, name + ": the view stays with the head, and harm to the body counts on its way");
    // half way: on the straight line, eased, not fallen (no physics on it), the time standing
    if (!o.live) { await D(() => { const h = window.Rocket.debug().head(); h.flight.t0 = performance.now() - window.Rocket.debug().consts.BAR * 1000 * 0.5; }); }
    else { await P.waitForFunction((t0) => performance.now() - t0 > window.Rocket.debug().consts.BAR * 500, set.fl.t0); }
    await frames(P, 1);
    const mid = await D(() => { const d = window.Rocket.debug(), h = d.head(), f = h.flight; return { phase: h.phase, P: { x: d.P.x, y: d.P.y, z: d.P.z, vy: d.P.vy, ground: d.P.ground }, u: (performance.now() - f.t0) / 1000 / d.consts.BAR, left: d.holoLeft() }; });
    const s2 = await shot(name + "_on_its_way", 1);
    const f = set.fl, L = Math.hypot(f.to[0] - f.from[0], f.to[1] - f.from[1], f.to[2] - f.from[2]);
    const along = ((mid.P.x - f.from[0]) * (f.to[0] - f.from[0]) + (mid.P.y - f.from[1]) * (f.to[1] - f.from[1]) + (mid.P.z - f.from[2]) * (f.to[2] - f.from[2])) / (L * L);
    const off = Math.hypot(mid.P.x - (f.from[0] + (f.to[0] - f.from[0]) * along), mid.P.y - (f.from[1] + (f.to[1] - f.from[1]) * along), mid.P.z - (f.from[2] + (f.to[2] - f.from[2]) * along));
    const sm = (s) => { s = Math.max(0, Math.min(1, s)); return s * s * (3 - 2 * s); };
    check(mid.phase === "follow" && off < 1e-6, name + ": on its way, on the straight line (" + off.toExponential(1) + " m off it, " + L.toFixed(2) + " m in all)");
    check(Math.abs(along - sm(mid.u)) < 0.04, name + ": eased (" + along.toFixed(3) + " of the way at " + mid.u.toFixed(3) + " of the bar; smooth gives " + sm(mid.u).toFixed(3) + ")");
    check(mid.P.vy === 0 && mid.P.ground === false, name + ": no physics on it (vy " + mid.P.vy + ")");
    check(near(mid.left, set.left, 1e-9) && near(mid0.left, set.left, 1e-9), name + ": the time stands on its way (" + set.left.toFixed(3) + " at the set-out, " + mid.left.toFixed(3) + " half way)");
    // come: after one bar
    if (!o.live) { await D(() => { const h = window.Rocket.debug().head(); h.flight.t0 = performance.now() - window.Rocket.debug().consts.BAR * 1000 * 0.97; }); }
    await P.waitForFunction(() => { const h = window.Rocket.debug().head(); return !h || h.phase !== "follow"; }, null, { timeout: 1800000 });
    const come = await D(() => { const d = window.Rocket.debug(), h = d.head(); return h && { phase: h.phase, took: (h.t0 - h.flight.t0) / 1000, to: h.flight.to, P: { x: d.P.x, y: d.P.y, z: d.P.z }, left: d.holoLeft() }; });
    check(come && come.phase === "home", name + ": come, the head settles onto it (phase " + (come && come.phase) + ")");
    if (come) {
      if (o.live) { check(come.took >= C.c.BAR - 1e-6 && come.took < C.c.BAR + 0.026, name + ": it took one bar (" + come.took.toFixed(3) + " s; a bar is " + C.c.BAR.toFixed(3) + " s, a frame 0.025)"); }
      check(near(come.P.x, come.to[0], 1e-9) && near(come.P.z, come.to[2], 1e-9), name + ": it stopped where it was going");
      check(near(come.left, set.left, 1e-9), name + ": the time stood all the way (" + come.left.toFixed(3) + ")");
    }
    await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 1800000 });
    if (o.high) { await P.waitForFunction(() => window.Rocket.debug().P.ground, null, { timeout: 1800000 }); }
    await frames(P, 20);
    const e = await shot(name + "_landed", 2);
    check(e.head === null && e.pov === "third", name + ": back in third person (" + e.pov + ")");
    check(await D(() => document.getElementById("v-holo").getAttribute("aria-pressed") === "false"), name + ": the button not pressed");
    if (!o.wall) { check(near(e.P.x, before.head.x, 0.01) && near(e.P.z, before.head.z, 0.01), name + ": the body is where the head was (" + e.P.x + "," + e.P.z + " vs " + before.head.x.toFixed(3) + "," + before.head.z.toFixed(3) + ")"); }
    if (!o.high && !o.wall) { check(Math.abs(e.P.y - (before.head.y - C.headY)) < 0.3, name + ": at the head's height (" + e.P.y + " vs " + (before.head.y - C.headY).toFixed(3) + ")"); }
    if (o.high) { check(e.P.y < before.head.y - C.headY - 8, name + ": it fell, unhurt, to the ground (" + e.P.y + ")"); }
    return { before, set, e };
  };
  // 1. the button, the bar let run and timed; a second press on its way
  await D(() => { const d = window.Rocket.debug(); d.holoLeft(d.consts.HOLO_T); });
  await outBy("button", () => tap("#v-holo"), { live: true, again: () => tap("#v-holo"), says: /Your body follows your head\./ });
  // 2. H, and H again on its way
  await outBy("key_h", () => P.keyboard.press("h"), { again: () => P.keyboard.press("h"), says: /Your body follows your head\./ });
  // 3. high in the air: it stops there and falls, unhurt
  await outBy("high", () => tap("#v-holo"), { high: true, says: /Your body follows your head\./ });
  // 4. the time up
  await D(() => { const d = window.Rocket.debug(); d.holoLeft(d.consts.HOLO_T); });
  await outBy("time_up", async () => { await D(() => window.Rocket.debug().holoLeft(0.05)); await frames(P, 3); }, { says: /The time is up: your body follows your head\./ });
  // 5. the head in a wall: to the nearest place it fits
  await D(() => { const d = window.Rocket.debug(); d.holoLeft(d.consts.HOLO_T); });
  const wall = await D(() => {
    const d = window.Rocket.debug(), w = d.w, S = w.SOLID, x0 = Math.floor(d.P.x), z0 = Math.floor(d.P.z);
    for (let r = 2; r < 40; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
      const x = x0 + dx, z = z0 + dz;
      for (let y = 4; y < 50; y++) { let ok = true; for (let k = 0; k < 3; k++) if (!S[w.get(x, y + k, z)]) ok = false; if (ok && !S[w.get(x + 1, y, z)] && !S[w.get(x + 1, y + 1, z)]) return { x: x + 0.5, y: y, z: z + 0.5 }; }
    }
    return null;
  });
  if (wall) {
    await outBy("wall", () => tap("#v-holo"), { wall: true, at: async () => wall, says: /Your body follows your head, to the nearest place it fits\./ });
    const fits = await D(() => { const d = window.Rocket.debug(), w = d.w, S = w.SOLID, P = d.P; let hit = false; for (let by = Math.floor(P.y); by <= Math.floor(P.y + 1.79); by++) for (let bz = Math.floor(P.z - 0.3); bz <= Math.floor(P.z + 0.3); bz++) for (let bx = Math.floor(P.x - 0.3); bx <= Math.floor(P.x + 0.3); bx++) if (S[w.get(bx, by, bz)]) hit = true; return !hit; });
    check(fits, "wall: the body fits where it came");
  } else { check(false, "wall: no wall found to put the head in"); }
  // 6. a head still lifting: it settles back, the body where it was
  await D(() => { const d = window.Rocket.debug(); d.holoLeft(d.consts.HOLO_T); });
  await frames(P, 4);
  const p0 = await D(() => { const d = window.Rocket.debug(); return { x: d.P.x, y: d.P.y, z: d.P.z }; });
  await tap("#v-holo");
  await frames(P, 2);
  const ph = await D(() => window.Rocket.debug().head().phase);
  await tap("#v-holo");
  const ph2 = await D(() => window.Rocket.debug().head().phase);
  await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 1800000 });
  await frames(P, 4);
  const s8 = await shot("lift_left", 2);
  check(ph === "lift" && ph2 === "home" && Math.hypot(s8.P.x - p0.x, s8.P.z - p0.z) < 0.01 && s8.pov === "third", "while lifting: it settles back, the body unmoved (" + ph + " → " + ph2 + ")");
  // 7. the speed, twice what it was: level out of doors, the stick held, then let go
  await D(() => { const d = window.Rocket.debug(); d.holoLeft(d.consts.HOLO_T); });
  await goOut();
  const run = await D(() => {
    const d = window.Rocket.debug(), h = d.head(), w = d.w;
    // high over the middle of the place, out of any room, looking along the longer way
    h.x = w.SX / 2; h.z = w.SZ / 2; h.y = Math.min(d.consts.holoTop - 5, d.P.y + 30); h.vx = h.vy = h.vz = 0;
    d.P.pitch = 0; d.P.yaw = w.SX > w.SZ ? Math.PI / 2 : Math.PI;
    return { x: h.x, y: h.y, z: h.z };
  });
  await P.keyboard.down("w");
  await frames(P, 60);
  const a = await D(() => { const h = window.Rocket.debug().head(); return { x: h.x, y: h.y, z: h.z, f: window.__frames }; });
  await frames(P, 20);
  // let go inside the page, so the coast is measured from exactly where the key came up
  const b = await D(() => { document.dispatchEvent(new KeyboardEvent("keyup", { key: "w" })); const h = window.Rocket.debug().head(); return { x: h.x, y: h.y, z: h.z, f: window.__frames, v: Math.hypot(h.vx, h.vy, h.vz) }; });
  await P.keyboard.up("w");
  const v = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) / ((b.f - a.f) * 0.025);
  check(Math.abs(v - C.c.HOLO_V) / C.c.HOLO_V < 0.02, "the hologram flies at twice phi^2 his walk out of doors (" + v.toFixed(2) + " m/s, " + C.c.HOLO_V.toFixed(2) + " asked; it was " + (C.c.HOLO_V / 2).toFixed(2) + ")");
  await frames(P, 120);
  const c = await D(() => { const h = window.Rocket.debug().head(); return { x: h.x, y: h.y, z: h.z, v: Math.hypot(h.vx, h.vy, h.vz) }; });
  const coast = Math.hypot(c.x - b.x, c.y - b.y, c.z - b.z);
  check(c.v < 0.05 && Math.abs(coast - b.v * C.c.T_LIFT) < 0.5, "let go, it comes to rest in " + coast.toFixed(2) + " m (its speed by T_LIFT: " + (b.v * C.c.T_LIFT).toFixed(2) + " m; in a room " + (C.c.HOLO_V_IN * C.c.T_LIFT).toFixed(2) + " m, inside the 9 m a work is read from)");
  await tap("#v-holo");
  await D(() => { const d = window.Rocket.debug(), h = d.head(); if (h && h.flight) { h.flight.t0 = performance.now() - d.consts.BAR * 1000 * 0.97; } });
  await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 1800000 });
  await P.waitForFunction(() => window.Rocket.debug().P.ground, null, { timeout: 1800000 });
  await frames(P, 4);
  // 8. the guards put you out while the body is on its way: it is cleared, and you come to under your tree
  await D(() => { const d = window.Rocket.debug(); d.holoLeft(d.consts.HOLO_T); });
  await goOut();
  const q8 = await spot(12);
  await D((a) => { const d = window.Rocket.debug(), h = d.head(); h.x = a.q.x; h.z = a.q.z; h.y = a.q.y + a.headY + 0.02; }, { q: q8, headY: C.headY });
  await frames(P, 2);
  await tap("#v-holo");
  await frames(P, 6);
  const ph8 = await D(() => window.Rocket.debug().head() && window.Rocket.debug().head().phase);
  await D(() => window.Rocket.debug().putOut());
  const lay = await D(() => { const d = window.Rocket.debug(), at = d.underTree(); return { head: d.head(), intro: !!d.intro(), pov: d.pov(), holo: document.body.dataset.holo || null, pressed: document.getElementById("v-holo").getAttribute("aria-pressed"), P: { x: d.P.x, z: d.P.z }, at: { x: at.x, z: at.z } }; });
  check(ph8 === "follow" && lay.head === null && lay.intro && lay.pov === "third" && !lay.holo && lay.pressed === "false" && near(lay.P.x, lay.at.x, 1e-6) && near(lay.P.z, lay.at.z, 1e-6),
        "put out on its way: the flight cleared, the head back on him, you lie under your tree (" + ph8 + " → head " + lay.head + ", intro " + lay.intro + ")");
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await frames(P, 120);
  const w8 = await shot("put_out_awake", 2);
  const st8 = await D(() => window.Rocket.debug().stone());
  check(st8 === false, "come to again where you woke: not his eyes until you have walked off");
  check(w8.head === null && w8.pov === "third" && near(w8.P.x, lay.at.x, 0.01) && near(w8.P.z, lay.at.z, 0.01), "come to again: third person, under the tree, nothing still flying (" + w8.P.x + "," + w8.P.z + ")");
  check(w8.drawMe && w8.drawMe.body === true && w8.camD > 1, "and he is seen again from over his head (camD " + w8.camD + ")");
  check(errors.length === 0, "no page errors and no WebGL warnings " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\nFAIL " + e + "\n"); process.exit(1); });
