// smash.js - the guitar smash in the game (the prototype on its own server): node smash.js desk|phone outdir port
// Every case of the design: a block a step ahead at his waist, low (the ground) and at his head, one five metres off
// (the blow within REACH), one beyond REACH; each must break exactly at the strike, half a beat after the tap (SWING, since 22 Oct 2026; and each of the three styles). Rapid taps
// (one kept, the latest), the chain (a beat after, swung back), walking (the legs walk on), in water (the swing at
// SWIM / WALK), the target changed before the strike, the hologram mid-swing, and a real tap or click. The keyframes
// are photographed in third person. Writes log.txt and results.json in outdir.
const { open, frames, state } = require("./game.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const log = [], bad = [], results = { view, cases: {} };
const say = (l) => { console.log(l); log.push(l); };
const check = (ok, what) => { say((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad.push(what); } return ok; };
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8843 });
  const D = (fn, arg) => P.evaluate(fn, arg);
  let n = 0;
  const shot = async (name, wait) => {
    if (wait) { await frames(P, wait); }
    const file = `${out}/${String(++n).padStart(2, "0")}_${name}.png`;
    await P.screenshot({ path: file });
    say("shot " + file);
  };
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; });
  await frames(P, 4);
  await D(() => { const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = performance.now() - b.dur * 1000 - 1; } });
  await P.waitForFunction(() => !window.Rocket.debug().cam().blend);
  await frames(P, 4);
  const K = await D(() => window.Rocket.debug().smashConsts());
  say("consts " + JSON.stringify(K));
  results.consts = K;
  // a recorder: after each of the game's frames (rAF order: the game's frame, then this), what the swing and the
  // watched cells are
  await D(() => {
    window.__rec = []; window.__watch = []; window.__recOn = false;
    (function rec() {
      if (window.__recOn) {
        const d = window.Rocket.debug(), s = d.swing();
        window.__rec.push({ f: window.__frames, t: performance.now(), u: s ? s.u : null, struck: s ? s.struck : null, broke: s ? s.broke : null, side: s ? s.side : null, ret: s ? s.ret : null,
          ids: window.__watch.map((c) => d.w.get(c[0], c[1], c[2])), shards: d.shards().length, face: d.P.face, walked: d.P.walked, wet: d.P.wet, x: d.P.x, z: d.P.z, pose: s && s.pose });
      }
      requestAnimationFrame(rec);
    })();
  });
  // open level ground: a run 9 blocks long and 5 wide, nothing over it for 4 blocks; he stands at its start facing along it
  const site = await D(() => {
    const d = window.Rocket.debug(), w = d.w, S = w.SOLID, x0 = Math.floor(d.P.x), z0 = Math.floor(d.P.z);
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    // not on the homage (its stones turn the view to his eyes) nor by his tree (where you woke, the same)
    const hm = d.homage(), hb = hm && hm.box, tr = d.underTree();
    const off = (cx, cz) => !(hb && cx >= hb[0] - 4 && cx <= hb[2] + 4 && cz >= hb[1] - 4 && cz <= hb[3] + 4) && Math.hypot(cx + 0.5 - tr.x, cz + 0.5 - tr.z) > 4;
    for (let r = 0; r < 60; r++) for (let a = 0; a < Math.max(1, 8 * r); a++) {
      const th = a / Math.max(1, 8 * r) * 2 * Math.PI, x = Math.floor(x0 + Math.cos(th) * r), z = Math.floor(z0 + Math.sin(th) * r);
      for (let y = 60; y > 2; y--) {
        if (!S[w.get(x, y - 1, z)]) { continue; }
        for (const [ax, az] of dirs) {
          const px = -az, pz = ax; let ok = true;
          for (let s = -1; s <= 9 && ok; s++) for (let q = -2; q <= 2 && ok; q++) {
            const cx = x + ax * s + px * q, cz = z + az * s + pz * q;
            if (!S[w.get(cx, y - 1, cz)] || w.get(cx, y - 1, cz) === 6 || !off(cx, cz)) { ok = false; }
            for (let k = 0; k < 4 && ok; k++) { if (w.get(cx, y + k, cz) !== 0) { ok = false; } }
          }
          if (ok) { return { x, y, z, ax, az, px, pz, yaw: Math.atan2(ax, -az) }; }
        }
        break;
      }
    }
    return null;
  });
  say("site " + JSON.stringify(site));
  if (!site) { check(false, "found open level ground"); throw new Error("no site"); }
  // stood at the run's start facing along it, the camera's easing (the wake-up's, a stone's) ended so it is over his head
  const stand = (q) => D((q) => { const d = window.Rocket.debug(), b = d.cam().blend; if (b) { b.t0 = performance.now() - b.dur * 1000 - 1; } Object.assign(d.P, { x: q.x + 0.5, y: q.y, z: q.z + 0.5, vx: 0, vy: 0, vz: 0, yaw: q.yaw, face: q.yaw, pitch: -0.229, want: null }); }, q);
  const cell = (s, k, dy, q) => [site.x + site.ax * s + site.px * (q || 0), site.y + (dy || 0), site.z + site.az * s + site.pz * (q || 0)];
  const setB = (c, b) => D((a) => { const d = window.Rocket.debug(); d.w.set(a.c[0], a.c[1], a.c[2], a.b); d.remeshAt(a.c[0], a.c[2]); }, { c, b });
  const BRICK = 9, STONE = 3, WATER = 6, AIR = 0;
  // the screen point of the middle of a block's face toward him, and a tap there (act, as a tap acts)
  const faceTo = (c) => [c[0] + 0.5 - site.ax * 0.5, c[1] + 0.5, c[2] + 0.5 - site.az * 0.5];
  const tapAt = (p) => D((p) => { const d = window.Rocket.debug(), s = d.screenOf(p); if (!s) { return null; } d.act(s[0], s[1], false); return s; }, p);
  const rec = async (on, watch) => D((a) => { window.__rec = []; window.__watch = a.watch || []; window.__recOn = a.on; }, { on, watch });
  const recs = () => D(() => window.__rec.slice());
  // one case: the block put, a tap on it, frames recorded until the swing is done
  const strikeCase = async (name, c, opts) => {
    opts = opts || {};
    await stand(opts.at || site); await frames(P, 3);
    if (opts.setup) { await opts.setup(); await frames(P, 2); }
    await setB(c, opts.b || BRICK); await frames(P, 2);
    await rec(true, [c]);
    const t0 = await D(() => performance.now());
    const scr = await tapAt(opts.face || faceTo(c));
    const swing0 = await D(() => window.Rocket.debug().swing());
    if (opts.during) { await opts.during(); }
    await P.waitForFunction(() => { const s = window.Rocket.debug().swing(); return !s; }, null, { timeout: 900000 });
    await frames(P, 2);
    const R = await recs(); await rec(false);
    const firstAir = R.findIndex((r) => r.ids[0] !== (opts.b || BRICK));
    const strikeAt = R.findIndex((r) => r.struck);
    const res = { name, cell: c, tapScreen: scr, startedSwing: !!swing0, frames: R.length, strikeFrame: strikeAt + 1, airFrame: firstAir + 1,
                  strikeMs: strikeAt >= 0 ? +(R[strikeAt].t - t0).toFixed(1) : null, uAtStrike: strikeAt >= 0 ? R[strikeAt].u : null,
                  uBefore: strikeAt > 0 ? R[strikeAt - 1].u : null, shardsAfter: strikeAt >= 0 && R[strikeAt + 1] ? R[strikeAt + 1].shards : null,
                  maxShards: Math.max(0, ...R.map((r) => r.shards)), finalId: R.length ? R[R.length - 1].ids[0] : null, walked: R.length ? R[R.length - 1].walked - R[0].walked : 0,
                  faces: R.filter((r, i) => i % 4 === 0).map((r) => +r.face.toFixed(3)), sides: [...new Set(R.map((r) => r.side))] };
    results.cases[name] = res;
    say(name + " " + JSON.stringify(res));
    return { res, R };
  };
  const BEATF = Math.ceil(K.SWING * 1000 / 25 - 1e-9);   // frames from the tap to the strike at 25 ms a frame (half a beat since 22 Oct)
  // ---- 1. a block a step ahead at his waist: the keyframes photographed, then the strike timed
  {
    const c = cell(1, 0, 0);
    await stand(site); await frames(P, 3);
    await setB(c, BRICK); await frames(P, 3);
    await shot("waist_00_rest", 1);
    await tapAt(faceTo(c));
    for (const [u, name] of [[0.25, "coil"], [0.5, "top_right"], [0.75, "downswing"], [0.9, "late_downswing"]]) {
      await D((u) => window.Rocket.debug().holdSwing(u), u);
      await shot("waist_" + String(Math.round(u * 100)).padStart(3, "0") + "_" + name, 3);
    }
    await D(() => window.Rocket.debug().holdSwing(1.0));
    await shot("waist_100_STRIKE", 2);
    await D(() => window.Rocket.debug().holdSwing(null));
    await shot("waist_110_bars", 2);
    await shot("waist_120_bars", 3);
    for (const [u, name] of [[1.25, "follow_through"], [1.5, "top_left"], [1.75, "return"]]) {
      await D((u) => window.Rocket.debug().holdSwing(u), u);
      await shot("waist_" + String(Math.round(u * 100)).padStart(3, "0") + "_" + name, 3);
    }
    await D(() => window.Rocket.debug().holdSwing(null));
    await P.waitForFunction(() => !window.Rocket.debug().swing());
    await shot("waist_200_rest", 2);
    const { res } = await strikeCase("waist_timed", cell(1, 0, 0));
    check(res.startedSwing, "waist: the tap starts a swing");
    check(res.airFrame === res.strikeFrame && res.strikeFrame === BEATF, "waist: the block breaks at the strike, frame " + res.strikeFrame + " after the tap (a beat is " + BEATF + " frames of 25 ms)");
    check(res.strikeMs >= K.SWING * 1000 - 1 && res.strikeMs < K.SWING * 1000 + 25 + 21, "waist: the strike " + res.strikeMs + " ms after the tap (half a beat " + K.SWING * 1000 + " ms)");
    check(res.uBefore < 1 && res.uAtStrike >= 1, "waist: still standing at u " + (res.uBefore || 0).toFixed(3) + ", gone at u " + (res.uAtStrike || 0).toFixed(3));
    check(res.shardsAfter === 6, "waist: six bars fly (" + res.shardsAfter + ")");
  }
  // ---- 1b. the three styles (22 Oct 2026: "3 baseline variations ... randomly used"): each forced (Math.random
  // stubbed), photographed at its keyframes, its strike timed, its pose checked (the slam's leap, the spin's turn)
  {
    results.cases.styles = {};
    const LEAPm = K.LEAP;
    for (const [k, st] of [[0.1, "sweep"], [0.5, "slam"], [0.9, "spin"]]) {
      const c = cell(1, 0, 0);
      await stand(site); await frames(P, 3);
      await setB(c, BRICK); await frames(P, 3);
      await D((k) => { window.__rnd = window.__rnd || Math.random; Math.random = () => k; }, k);
      await tapAt(faceTo(c));
      const poses = {};
      for (const u of [0.25, 0.5, 0.75, 0.95, 1.25, 1.5, 1.75]) {
        await D((u) => window.Rocket.debug().holdSwing(u), u);
        await frames(P, 2);
        poses[u] = await D(() => { const s = window.Rocket.debug().swing(); return s && Object.assign({ style: s.style }, s.pose); });
        await shot("style_" + st + "_" + String(Math.round(u * 100)).padStart(3, "0"), 1);
      }
      await D(() => window.Rocket.debug().holdSwing(null));
      await P.waitForFunction(() => !window.Rocket.debug().swing());
      await D(() => { Math.random = window.__rnd; });
      results.cases.styles[st] = poses;
      say(st + " " + JSON.stringify(poses));
      check(poses[0.5] && poses[0.5].style === st, st + ": the style taken (" + (poses[0.5] && poses[0.5].style) + ")");
      if (st === "slam") { check(Math.abs(poses[0.5].lift - LEAPm) < 1e-6 && poses[1.25].lift === 0 && Math.abs(poses[0.25].lift - 0.75 * LEAPm) < 1e-6, "slam: the leap's top at u 1/2 (" + poses[0.5].lift.toFixed(4) + " m = g SWING^2 / 8), down at the strike"); }
      else { check(poses[0.5].lift === 0, st + ": no leap"); }
      if (st === "spin") { check(Math.abs(Math.abs(poses[0.5].spin) - 1.5 * Math.PI) < 1e-6 && poses[1.25].spin === 0, "spin: three quarters of the turn to go at u 1/2 (" + poses[0.5].spin.toFixed(4) + "), none after the strike"); }
      else { check(poses[0.5].spin === 0, st + ": no spin"); }
      await D((k) => { window.__rnd = window.__rnd || Math.random; Math.random = () => k; }, k);
      const { res } = await strikeCase("style_" + st + "_timed", cell(1, 0, 0));
      await D(() => { Math.random = window.__rnd; });
      check(res.airFrame === res.strikeFrame && res.strikeFrame === BEATF && res.shardsAfter === 6, st + ": breaks at the strike, frame " + res.strikeFrame + " (" + BEATF + "), six bars");
    }
  }
  // ---- 2. low (the ground a block ahead) and 3. at his head, each photographed at its strike
  for (const [name, c] of [["low", cell(1, 0, -1)], ["head", cell(1, 0, 1)]]) {
    await stand(site); await frames(P, 3);
    await setB(c, BRICK); await frames(P, 2);
    await tapAt(name === "low" ? [c[0] + 0.5, c[1] + 1, c[2] + 0.5] : faceTo(c));
    await D(() => window.Rocket.debug().holdSwing(0.5));
    await shot(name + "_top_right", 3);
    await D(() => window.Rocket.debug().holdSwing(1.0));
    await shot(name + "_STRIKE", 2);
    await D(() => window.Rocket.debug().holdSwing(null));
    await shot(name + "_bars", 2);
    await P.waitForFunction(() => !window.Rocket.debug().swing());
    await frames(P, 2);
    // put the ground back for the next
    if (name === "low") { await setB(c, 1); }
    const { res } = await strikeCase(name + "_timed", c, { face: name === "low" ? [c[0] + 0.5, c[1] + 1, c[2] + 0.5] : faceTo(c), b: BRICK });
    check(res.airFrame === res.strikeFrame && res.strikeFrame === BEATF, name + ": breaks at the strike (frame " + res.strikeFrame + ")");
    if (name === "low") { await setB(c, 1); }
  }
  // ---- 4. five metres off (within REACH): the blow breaks it at the strike; 5. beyond REACH: no swing
  {
    const { res } = await strikeCase("far5", cell(5, 0, 0));
    check(res.airFrame === res.strikeFrame && res.strikeFrame === BEATF, "five metres off: breaks at the strike (frame " + res.strikeFrame + ")");
    await stand(site); await frames(P, 2);
    const c7 = cell(8, 0, 0); await setB(c7, BRICK); await frames(P, 2);
    await tapAt(faceTo(c7)); await frames(P, 3);
    const sw = await D(() => window.Rocket.debug().swing());
    const id7 = await D((c) => window.Rocket.debug().w.get(c[0], c[1], c[2]), c7);
    check(!sw && id7 === BRICK, "beyond REACH (8 ahead): no swing, the block stands");
    results.cases.beyond = { swing: sw, id: id7 };
    await setB(c7, AIR);
  }
  // ---- 6. rapid taps: A, then B, then C at once: A at the strike, C (the latest) a beat later, B never
  {
    await stand(site); await frames(P, 3);
    const A = cell(2, 0, 0, -1), Bc = cell(2, 0, 0, 0), C = cell(2, 0, 0, 1);
    for (const c of [A, Bc, C]) { await setB(c, BRICK); }
    await frames(P, 2);
    await rec(true, [A, Bc, C]);
    await tapAt(faceTo(A)); await tapAt(faceTo(Bc)); await tapAt(faceTo(C));
    const kept = await D(() => window.Rocket.debug().swing().next);
    await P.waitForFunction(() => !window.Rocket.debug().swing(), null, { timeout: 900000 });
    await frames(P, 2);
    const R = await recs(); await rec(false);
    const fa = R.findIndex((r) => r.ids[0] !== BRICK) + 1, fb = R.findIndex((r) => r.ids[1] !== BRICK) + 1, fc = R.findIndex((r) => r.ids[2] !== BRICK) + 1;
    results.cases.rapid = { kept, fa, fb, fc, sides: [...new Set(R.map((r) => r.side))] };
    say("rapid " + JSON.stringify(results.cases.rapid));
    check(JSON.stringify(kept) === JSON.stringify(C), "rapid: the latest tap is kept (" + JSON.stringify(kept) + ")");
    check(fa === BEATF && fb === 0 && Math.abs(fc - fa - K.SWING * 1000 / 25) <= 1.01, "rapid: A at frame " + fa + ", C half a beat later at " + fc + ", B never (" + fb + ")");
    for (const c of [A, Bc, C]) { await setB(c, AIR); }
  }
  // ---- 7. the chain: B tapped after A's strike, before its follow-through ends: a beat after A, swung back
  {
    await stand(site); await frames(P, 3);
    const A = cell(2, 0, 0, -1), Bc = cell(2, 0, 0, 1);
    await setB(A, BRICK); await setB(Bc, BRICK); await frames(P, 2);
    await rec(true, [A, Bc]);
    await tapAt(faceTo(A));
    await P.waitForFunction(() => { const s = window.Rocket.debug().swing(); return s && s.u >= 1.2; });
    await tapAt(faceTo(Bc));
    await D(() => window.Rocket.debug().holdSwing(1.4));
    await shot("chain_follow_through_B_kept", 2);
    await D(() => window.Rocket.debug().holdSwing(null));
    await P.waitForFunction(() => { const s = window.Rocket.debug().swing(); return s && s.side === -1 && s.u >= 0.75; });
    await D(() => window.Rocket.debug().holdSwing(0.8));
    await shot("chain_backhand_downswing", 2);
    await D(() => window.Rocket.debug().holdSwing(null));
    await P.waitForFunction(() => !window.Rocket.debug().swing(), null, { timeout: 900000 });
    await frames(P, 2);
    const R = await recs(); await rec(false);
    const fa = R.findIndex((r) => r.ids[0] !== BRICK) + 1, fb = R.findIndex((r) => r.ids[1] !== BRICK) + 1;
    results.cases.chain = { fa, fb, sides: [...new Set(R.map((r) => r.side))] };
    say("chain " + JSON.stringify(results.cases.chain));
    check(fa > 0 && fb > fa && results.cases.chain.sides.includes(-1), "chain: B breaks after A (frames " + fa + ", " + fb + "), swung back (the backhand)");
    for (const c of [A, Bc]) { await setB(c, AIR); }
  }
  // ---- 8. walking: W held, a block two ahead and one to his right: he turns to it, the legs walk on, it breaks at the strike
  {
    const c = cell(3, 0, 0, 1);
    await stand(site); await frames(P, 3);
    await setB(c, BRICK); await frames(P, 2);
    await P.keyboard.down("w"); await frames(P, 4);
    const { res, R } = await strikeCase("walking", c, { at: null, during: async () => {} }).catch(async (e) => { await P.keyboard.up("w"); throw e; });
    await P.keyboard.up("w");
    check(res.airFrame === res.strikeFrame && res.strikeFrame === BEATF, "walking: breaks at the strike (frame " + res.strikeFrame + ")");
    check(res.walked > 1, "walking: the legs walk on through the swing (" + res.walked.toFixed(2) + " m walked)");
    await setB(c, AIR);
  }
  // ---- 9. in water: the swing at SWIM / WALK, the strike at BEAT x WALK / SWIM
  {
    const pool = [];
    for (let s = -1; s <= 2; s++) for (let q = -1; q <= 1; q++) for (let k = 0; k < 2; k++) { pool.push(cell(s, 0, k, q)); }
    const c = cell(1, 0, 0);
    const { res } = await strikeCase("water", c, { setup: async () => { for (const p of pool) { await setB(p, WATER); } } });
    const wf = Math.ceil(K.SWING * 1000 / 25 * 4.3 / 2.2 - 1e-9);
    check(res.airFrame === res.strikeFrame && Math.abs(res.strikeFrame - wf) <= 1, "water: breaks at the strike, frame " + res.strikeFrame + " (SWING x WALK / SWIM is " + wf + " frames)");
    for (const p of pool) { await setB(p, AIR); }
    await setB(c, AIR);
  }
  // ---- 10. the target changed before the strike: taken away, then replaced by another block
  {
    const c = cell(1, 0, 0);
    let r = await strikeCase("changed_air", c, { during: async () => { await P.waitForFunction(() => window.Rocket.debug().swing().u >= 0.5); await setB(c, AIR); } });
    check(r.res.finalId === AIR && r.res.maxShards === 0, "changed: taken away before the strike, nothing breaks, no bars");
    r = await strikeCase("changed_stone", c, { during: async () => { await P.waitForFunction(() => window.Rocket.debug().swing().u >= 0.5); await setB(c, STONE); } });
    check(r.res.finalId === STONE && r.res.maxShards === 0, "changed: replaced by stone before the strike, the stone stands");
    await setB(c, AIR);
  }
  // ---- 11. the hologram mid-swing: nothing breaks; the arms go back to rest
  {
    const c = cell(1, 0, 0);
    await stand(site); await frames(P, 3);
    await setB(c, BRICK); await frames(P, 2);
    await D((v) => window.Rocket.debug().holoLeft(v), 150);
    await tapAt(faceTo(c));
    await P.waitForFunction(() => window.Rocket.debug().swing().u >= 0.5);
    await D(() => window.Rocket.debug().toggle());
    await frames(P, 30);
    const id = await D((c) => window.Rocket.debug().w.get(c[0], c[1], c[2]), c);
    const sw = await D(() => window.Rocket.debug().swing());
    check(id === BRICK && !sw, "hologram mid-swing: the block stands, the swing let go (" + JSON.stringify(sw) + ")");
    await shot("holo_mid_swing_let_go", 1);
    await D(() => window.Rocket.debug().toggle());
    await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 900000 });
    await frames(P, 4);
    await setB(c, AIR);
  }
  // ---- 12. a real tap (phone) or click (desk) on a block: the swing starts and the block breaks at the strike
  {
    const c = cell(2, 0, 0);
    await stand(site); await frames(P, 3);
    await setB(c, BRICK); await frames(P, 3);
    if (view === "phone") {
      const s = await D((p) => window.Rocket.debug().screenOf(p), faceTo(c));
      await P.touchscreen.tap(s[0], s[1]);
    } else {
      // turn the view until the crosshair is on the block (the camera moves as the look turns: a few rounds)
      for (let i = 0; i < 6; i++) {
        await D((p) => { const d = window.Rocket.debug(), e = d.cam().eye, v = [p[0] - e[0], p[1] - e[1], p[2] - e[2]]; d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2])); }, [c[0] + 0.5, c[1] + 0.5, c[2] + 0.5]);
        await frames(P, 2);
      }
      say("aim " + await D(() => window.Rocket.debug().aim()));
      await P.mouse.click(view === "desk" ? 640 : 195, view === "desk" ? 360 : 422);
    }
    await frames(P, 2);
    const sw = await D(() => window.Rocket.debug().swing());
    await P.waitForFunction(() => !window.Rocket.debug().swing(), null, { timeout: 900000 }).catch(() => {});
    await frames(P, 2);
    const id = await D((c) => window.Rocket.debug().w.get(c[0], c[1], c[2]), c);
    check(!!sw && id === AIR, (view === "phone" ? "a real tap" : "a real click") + ": the swing started and the block broke (" + JSON.stringify(sw && sw.at) + ")");
  }
  const ft = await D(() => window.__ft.slice(-200));
  ft.sort((a, b) => a - b);
  results.frameMs = { median: ft[ft.length >> 1], p90: ft[Math.floor(ft.length * 0.9)], max: ft[ft.length - 1] };
  say("frame callback ms " + JSON.stringify(results.frameMs));
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  results.errors = errors; results.bad = bad;
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); log.push("FAIL " + e.stack); fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n"); fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 1)); process.exit(1); });
