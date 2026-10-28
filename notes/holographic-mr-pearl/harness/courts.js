// courts.js - the courts (artist, 27 Oct 2026: a game with his hat for the racket, a pearl for the ball, a serve every
// point, the nemesis better each level; and the manager: ten courts side by side, each won playing on by itself and
// building the Trojan horse, a court that loses a match down until played again a level up; 28 Oct 2026: pickleball,
// "so the court is smaller and you can maintain the perspectives of Mr Pearl to play").
// A tap on the net near where he wakes takes him there; his views there are his own (the third person at rest, the
// Scope); court one's match is played by a bot that walks at his walk to where the nemesis's pearl will be met (as a
// player would, the ring showing where it comes down) and serves with T, every shot's bounce and the hitter's place
// recorded against the two-bounce rule and the kitchen.
// node courts.js desk|phone outdir port [hash]
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
  const shot = (n) => P.screenshot({ path: `${out}/${n}.png` });
  await D(() => { try { localStorage.clear(); } catch (e) { /* none */ } });
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await D(() => { document.getElementById("notes").hidden = true; const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = -1e9; } d.guards().forEach((g) => Object.assign(g, { mode: "hold", holdT: 1e9 })); });
  await frames(P, 10);
  // ---- the net near where he wakes
  const g = await D(() => { const d = window.Rocket.debug(), g = d.gate(), t = d.underTree(); return g && { x: g.x, y: g.y, z: g.z, n: g.n, fromTree: Math.hypot(g.x - t.x, g.z - t.z) }; });
  check(!!g && g.fromTree >= 7 && g.fromTree <= 23, "a net stands near where he wakes (" + JSON.stringify(g) + ")");
  if (!g) { throw new Error("no net"); }
  // stood four metres off it on the tree's side, facing it: seen; walked through it, nothing (a tap takes him, 28 Oct)
  const walkOn = () => view === "phone" ? D(() => { const cv = document.getElementById("view"), W = innerWidth, H = innerHeight; cv.dispatchEvent(new PointerEvent("pointerdown", { pointerId: 50, pointerType: "touch", clientX: W * 0.15, clientY: H * 0.85, bubbles: true })); cv.dispatchEvent(new PointerEvent("pointermove", { pointerId: 50, pointerType: "touch", clientX: W * 0.15, clientY: H * 0.85 - 80, bubbles: true })); }) : P.keyboard.down("w");
  const walkOff = () => view === "phone" ? D(() => { document.getElementById("view").dispatchEvent(new PointerEvent("pointerup", { pointerId: 50, pointerType: "touch", clientX: innerWidth * 0.15, clientY: innerHeight * 0.85 - 80, bubbles: true })); }) : P.keyboard.up("w");
  const standOff = (k) => D((a) => { const d = window.Rocket.debug(), g = a.g; Object.assign(d.P, { x: g.x + g.n[0] * a.k, y: g.y, z: g.z + g.n[1] * a.k, vx: 0, vy: 0, vz: 0, yaw: Math.atan2(-g.n[0], g.n[1]), face: Math.atan2(-g.n[0], g.n[1]), pitch: -0.25 }); }, { g, k });
  await standOff(2.5); await frames(P, 8);
  await walkOn(); await frames(P, 60); await walkOff(); await frames(P, 4);
  const through = await D(() => { const d = window.Rocket.debug(), g = d.gate(); return { court: !!d.court(), v: (d.P.x - g.x) * g.n[0] + (d.P.z - g.z) * g.n[1] }; });
  check(!through.court && through.v < 0, "walked through the net he stays in the place (" + JSON.stringify(through) + ")");
  // the world's third person at rest, measured from his head, to compare with the courts' own
  await standOff(4); await D(() => { const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } }); await frames(P, 30);
  const tpWorld = await D(() => { const d = window.Rocket.debug(), c = d.cam(), h = d.sight().head; return Math.hypot(c.eye[0] - h[0], c.eye[1] - h[1], c.eye[2] - h[2]); });
  await shot("01_the_net");
  // the tap on the net: on a phone where it is seen, on a computer at the crosshair, the view turned to it
  const aimAt = (q) => D((q) => { const d = window.Rocket.debug();
    for (let i = 0; i < 3; i++) { const c = d.cam(), e = c.eye, v = [q[0] - e[0], q[1] - e[1], q[2] - e[2]]; d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2])); } }, q);
  const screenOf = (q) => D((q) => { const d = window.Rocket.debug(), c = d.cam(), y = c.last.yaw, p = c.last.pitch;
    const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)], r = [Math.cos(y), 0, Math.sin(y)];
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]], v = [q[0] - c.eye[0], q[1] - c.eye[1], q[2] - c.eye[2]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], z = dot(v, f), k = 1 / Math.tan(35 * Math.PI / 180), W = innerWidth, H = innerHeight;
    return { x: (dot(v, r) / z * k * H / W * 0.5 + 0.5) * W, y: (1 - (dot(v, u) / z * k * 0.5 + 0.5)) * H }; }, q);
  const tap = (x, y) => D((a) => { const cv = document.getElementById("view"), o = { pointerId: 71, pointerType: a.v === "phone" ? "touch" : "mouse", button: 0, buttons: 1, clientX: a.x, clientY: a.y, bubbles: true };
    cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); }, { v: view, x, y });
  const gm = [g.x, g.y + 0.45, g.z];
  if (view !== "phone") { await aimAt(gm); await frames(P, 4); }
  const gs = await screenOf(gm);
  await tap(view === "phone" ? gs.x : 0, view === "phone" ? gs.y : 0); await frames(P, 3);
  const c0 = await D(() => { const d = window.Rocket.debug(); return { on: !!d.court(), body: document.body.dataset.court, P: [d.P.x, d.P.z], where: document.getElementById("where").textContent }; });
  check(c0.on && c0.body === "true", "a " + (view === "phone" ? "tap" : "click") + " on the net: the courts (" + JSON.stringify(c0) + ", the net at " + JSON.stringify({ x: Math.round(gs.x), y: Math.round(gs.y) }) + ")");
  // the place's acts wait there: Build and Launch, a work's label and the hologram hidden; the Scope stays; launch refused
  const acts = await D(() => { const hid = (q) => { const e = document.querySelector(q); return !e || getComputedStyle(e).display === "none"; };
    const d = window.Rocket.debug(); if (d.launch) { d.launch(); } return { foot: hid(".foot"), label: hid(".label"), scope: hid("#v-sight"), holo: hid("#v-holo"), ignite: !!d.ignite() }; });
  check(acts.foot && acts.label && !acts.scope && acts.holo && !acts.ignite, "on the courts the place's acts wait, the Scope stays (" + JSON.stringify(acts) + ")");
  // his views: the third person at rest as in the place; the Scope (the button, R): his head the glass, the crux the aim
  await frames(P, 30);
  const tpCourt = await D(() => { const d = window.Rocket.debug(), c = d.cam(), h = d.sight().head; return Math.hypot(c.eye[0] - h[0], c.eye[1] - h[1], c.eye[2] - h[2]); });
  check(Math.abs(tpCourt - tpWorld) < 0.15, "on the courts his third person at rest, as in the place (" + tpCourt.toFixed(2) + " m from his head; " + tpWorld.toFixed(2) + " in the place)");
  await shot("02_the_courts");
  if (view === "phone") { await P.tap("#v-sight"); } else { await P.keyboard.press("r"); }
  await frames(P, 40);
  const sc = await D(() => { const d = window.Rocket.debug(), c = d.cam(), h = d.sight().head; return { scope: d.court().scope, d: Math.hypot(c.eye[0] - h[0], c.eye[1] - h[1], c.eye[2] - h[2]), head: c.drawMe.head, pressed: document.getElementById("v-sight").getAttribute("aria-pressed") }; });
  check(sc.scope && sc.d < tpCourt * 0.6 && !sc.head && sc.pressed === "true", "the Scope on the courts: the camera behind his head on the look, the head the glass (" + JSON.stringify(sc) + ")");
  await shot("02b_the_courts_scope");
  // (looked up as far as the Scope goes, its camera stays over the court)
  const p0 = await D(() => { const d = window.Rocket.debug(), p = d.P.pitch; d.P.pitch = 1.2; return p; });
  await frames(P, 3);
  const lowest = await D((p0) => { const d = window.Rocket.debug(), y = d.cam().eye[1]; d.P.pitch = p0; return y; }, p0);
  check(lowest >= 0.15, "the Scope looked up as far as it goes: its camera over the court (" + lowest.toFixed(2) + " m)");
  if (view === "phone") { await P.tap("#v-sight"); } else { await P.keyboard.press("r"); }
  await frames(P, 40);
  const sc2 = await D(() => window.Rocket.debug().court().scope);
  check(sc2 === false, "the Scope lowered again");
  if (view === "desk") {
    // the right button: a click raises it, a second lowers it, as in the place
    const rc = async () => { await D(() => { const cv = document.getElementById("view"), o = { pointerId: 9, pointerType: "mouse", button: 2, buttons: 2, clientX: 300, clientY: 300, bubbles: true }; cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); }); await frames(P, 10); return D(() => window.Rocket.debug().court().scope); };
    const rb1 = await rc(), rb2 = await rc();
    check(rb1 === true && rb2 === false, "on the courts a right click raises the Scope and a second lowers it (" + rb1 + ", " + rb2 + ")");
  }
  await frames(P, 30); await shot("02_the_courts");
  // ---- court one: onto it, the match; the serve
  const K = await D(() => window.Rocket.debug().courtConsts);
  await D(() => { const d = window.Rocket.debug(), c = d.courtAt(0); d.P.x = c[0]; d.P.z = c[2] + 6; });
  await frames(P, 3);
  const m0 = await D(() => { const d = window.Rocket.debug(), m = d.court().m, c = d.courtAt(0); return m && { k: m.k, level: m.level, phase: m.phase, lx: d.P.x - c[0], lz: d.P.z - c[2] }; });
  check(m0 && m0.k === 0 && m0.level === 1 && m0.phase === "serve" && m0.lz > K.L, "onto court one: level one, he stands to serve behind the baseline (" + JSON.stringify(m0) + ")");
  await shot("03_to_serve");
  // the serve: a tap on a phone, a click on a computer
  await D((v) => { const cv = document.getElementById("view"), r = cv.getBoundingClientRect(), o = { pointerId: 70, pointerType: v === "phone" ? "touch" : "mouse", button: 0, buttons: 1, clientX: r.left + r.width * 0.6, clientY: r.top + r.height * 0.4, bubbles: true };
    cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); }, view);
  await frames(P, 6);
  const t0 = await D(() => window.Rocket.debug().court().m.phase);
  await shot("04_the_toss");
  await P.waitForFunction(() => { const m = window.Rocket.debug().court().m; return m && m.phase === "rally"; }, null, { timeout: 60000 });
  const sv = await D(() => { const d = window.Rocket.debug(), m = d.court().m, c = d.courtAt(0), L = d.ballLands(m.ball, 0); return { lx: L.x - c[0], lz: L.z - c[2], n: m.n, rally: m.rally, y: m.ball.y }; });
  check(t0 === "toss" && sv.rally === 1 && sv.lz < -K.K && sv.lz > -K.L && sv.lx < 0 && sv.lx > -K.HW, "a " + (view === "phone" ? "tap" : "click") + " serves underhand, across, past the kitchen (" + JSON.stringify(sv) + ")");
  await frames(P, 2); await shot("05_served");
  // ---- the bot plays the match out: at his walk to where the pearl is to be met; T to serve
  await D(() => {
    window.__bot = { on: true, served: 0, hits: [], prev: null };
    const WALK = 4.3;
    (function bot() {
      const d = window.Rocket.debug(), c = d.court(), B = window.__bot;
      if (B.on && c && c.m) {
        const m = c.m, b = m.ball, cc = d.courtAt(m.k), K = d.courtConsts, P = d.P;
        // each hit: the shot's number, whether it had bounced, where its hitter stood (from the net)
        if (B.prev && m.rally === B.prev.rally + 1 && m.rally >= 2) { B.hits.push({ n: m.rally, bounced: B.prev.bounces, z: m.rally % 2 ? B.prev.pz : B.prev.nz }); }
        B.prev = { rally: m.rally, bounces: b ? b.bounces : 0, pz: Math.abs(P.z - cc[2]), nz: Math.abs(m.nem.z - cc[2]) };
        if (m.phase === "serve" && window.__frames % 8 === 0) { document.dispatchEvent(new KeyboardEvent("keydown", { key: "t", bubbles: true })); B.served += 1; }
        let tx = cc[0] - K.HAT, tz = cc[2] + K.L - 1;
        if (m.phase === "rally" && b && b.last === "them") {
          if (b.bounces === 0) { const L = d.ballLands(b, m.k); if (L) { tx = L.x + L.after.vx * 0.3 - K.HAT; tz = L.z + L.after.vz * 0.3; } }
          else { tx = b.x + b.vx * 0.2 - K.HAT; tz = b.z + b.vz * 0.2; }
        }
        if (m.phase === "rally" || m.phase === "point") {
          tz = Math.max(cc[2] + 0.4, Math.min(cc[2] + K.L + 3, tz));
          const dx = tx - P.x, dz = tz - P.z, L = Math.hypot(dx, dz), s = Math.min(L, WALK * 0.025);
          if (L > 1e-3) { P.x += dx / L * s; P.z += dz / L * s; }
        }
      }
      requestAnimationFrame(bot);
    })();
  });
  let rallyShot = false;
  for (let i = 0; i < 160; i++) {
    await frames(P, 25);
    const s = await D(() => { const d = window.Rocket.debug(), c = d.court(), m = c && c.m; return { m: m && { you: m.you, them: m.them, rally: m.rally, phase: m.phase, last: m.ball && m.ball.last, hit: m.hit, V: window.__V }, up: d.courts()[0].up, best: d.courts().best }; });
    if (!rallyShot && s.m && s.m.phase === "rally" && s.m.rally >= 3 && s.m.last === "you") { rallyShot = true; await shot("06_rally_his_return"); }
    if (s.up) { break; }
  }
  const won = await D(() => { const d = window.Rocket.debug(), c = d.courts(); return { up: c[0].up, won: c[0].won, best: c.best, m: !!d.court().m, where: document.getElementById("where").textContent, toasts: (window.__toasts || []).slice(-4) }; });
  check(won.won && won.up && !won.m && won.best >= 2, "level one played out and won: court one plays on by itself (" + JSON.stringify(won) + ")");
  // the rules, shot by shot: the serve and its return taken after their bounce; no volley from the kitchen
  const H = await D(() => window.__bot.hits);
  const two = H.filter((h) => h.n === 2 || h.n === 3), vol = H.filter((h) => h.n >= 4 && h.bounced === 0);
  check(H.length >= 4 && two.every((h) => h.bounced === 1) && vol.every((h) => h.z > K.K), "the two-bounce rule and the kitchen kept: " + H.length + " shots, " + two.length + " returns and third shots all after a bounce, " + vol.length + " volleys, none from the kitchen");
  await D(() => { window.__bot.on = false; });
  // ---- the manager's side: court one powers the horse; a lost match takes its tool and it waits a level up
  const h0 = await D(() => window.Rocket.debug().horse().work);
  await frames(P, 200);
  const h1 = await D(() => window.Rocket.debug().horse().work);
  check(h1 - h0 > 4 && h1 - h0 < 6, "court one up builds the horse: " + (h1 - h0).toFixed(2) + " court-seconds in 5 s");
  // (he stands on court one as it plays: its loss does not pull him into a match)
  await D(() => { const d = window.Rocket.debug(), c = d.courtAt(0); d.P.x = c[0]; d.P.z = c[2] + 6; });
  await frames(P, 3);
  const fell = await D(() => { const d = window.Rocket.debug(), c = d.courts()[0], L0 = c.level; c.level = 40; let now = performance.now(), n = 0;
    while (c.up && n < 400) { now += 9000; d.courtsSim(0, now); n += 1; } return { up: c.up, level: c.level, from: 40, lost: c.lost, n, said: document.getElementById("toast").textContent }; });
  await frames(P, 3);
  const pulled = await D(() => !!window.Rocket.debug().court().m);
  check(!pulled, "standing on court one as its stand-in loses: no match pulls him in (" + pulled + ")");
  check(!fell.up && fell.level === 41 && fell.lost === 1 && /no more hammers/.test(JSON.stringify(fell.said)), "a court at a high level loses a match: down, its hammers gone, a level up (" + JSON.stringify(fell) + ")");
  // (put back: up, at level two, as if played again)
  await D(() => { const c = window.Rocket.debug().courts()[0]; Object.assign(c, { up: true, level: 2, you: 0, them: 0 }); window.Rocket.debug().horse().work = window.Rocket.debug().courtConsts.WORK * 0.55; });
  // the horse, half built, seen from court two's baseline, turned to it
  await D(() => { const d = window.Rocket.debug(), c = d.courtAt(1), H = [d.courtAt(0)[0] + 4.5 * d.courtConsts.GAP, d.courtAt(0)[2] - d.courtConsts.L - 70], x = c[0], z = c[2] + d.courtConsts.L + 3, yaw = Math.atan2(H[0] - x, -(H[1] - z));
    Object.assign(d.P, { x, z, yaw, face: yaw, pitch: 0.12 }); });
  await frames(P, 4); await shot("07_courts_and_the_horse");
  await D(() => { const d = window.Rocket.debug(), c = d.courtAt(1); Object.assign(d.P, { x: c[0], z: c[2] + d.courtConsts.L + 3, yaw: 0, face: 0, pitch: -0.2 }); });
  await frames(P, 4); await shot("07b_court_two");
  // ---- court two: a stronger nemesis
  const sk = await D(() => { const d = window.Rocket.debug(); return [d.nemSkill(1), d.nemSkill(2), d.nemSkill(10)]; });
  check(sk[1].v > sk[0].v && sk[1].err < sk[0].err && sk[2].T < sk[1].T && sk[2].wide > sk[1].wide, "the nemesis better each level (speed " + sk.map((q) => q.v.toFixed(2)).join(", ") + "; misses " + sk.map((q) => q.err.toFixed(3)).join(", ") + ")");
  await D(() => { const d = window.Rocket.debug(), c = d.courtAt(1); d.P.x = c[0]; d.P.z = c[2] + 6; });
  await frames(P, 3);
  const m2 = await D(() => { const m = window.Rocket.debug().court().m; return m && { k: m.k, level: m.level }; });
  check(m2 && m2.k === 1 && m2.level === 2, "onto court two: its match, level two (" + JSON.stringify(m2) + ")");
  // in a match he cannot leave the court: walked back, held at its back
  await D(() => { const d = window.Rocket.debug(); d.P.z += 40; });
  await frames(P, 2);
  const held = await D(() => { const d = window.Rocket.debug(), c = d.courtAt(1); return { lz: d.P.z - c[2], on: !!d.court().m }; });
  check(held.on && held.lz <= K.L + 3.51, "a match on: he cannot leave its court (" + JSON.stringify(held) + ")");
  // ---- back: the match given up only by the page (the test's own: no button does it), then the net behind court one
  await D(() => { const d = window.Rocket.debug(); d.court().m = null; const c = d.courtAt(0); Object.assign(d.P, { x: c[0] + 2.2, z: c[2] + d.courtConsts.L + 6, yaw: Math.PI, face: Math.PI }); });
  await walkOn();
  await P.waitForFunction(() => !window.Rocket.debug().court(), null, { timeout: 60000 }).catch(() => null);
  await walkOff();
  await frames(P, 20);
  const back = await D(() => { const d = window.Rocket.debug(), g = d.gate(); return { court: !!d.court(), body: document.body.dataset.court || null, off: Math.hypot(d.P.x - g.x, d.P.z - g.z), up: d.courts()[0].up }; });
  check(!back.court && !back.body && back.off < 4 && back.up, "back through the net behind court one: in the place by its net, court one still playing (" + JSON.stringify(back) + ")");
  await shot("08_back");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
