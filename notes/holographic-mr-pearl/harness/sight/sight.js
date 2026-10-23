// sight.js - the sight and the throw in the game (wf15 spec section 6.1, 6.3): node sight.js desk|phone outdir port
// Every case on a level arena built ahead of him (lib.js), each printed ok / FAIL, the frames photographed; writes
// results.json and log.txt in outdir.
const L = require("./lib.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
const phone = view === "phone";
const R = { view, cases: {} };
const deg = (r) => r * 180 / Math.PI, rad = (d) => d * Math.PI / 180;
(async () => {
  const G = await L.start(view, port, out);
  const { P, D, say, check, shot } = G;
  const frames = G.frames;
  const K = await D(() => { const d = window.Rocket.debug(); return { sc: d.sightConsts, c: d.consts, PEARL: d.pearl().PEARL, W: innerWidth, H: innerHeight, T35: Math.tan(35 * Math.PI / 180) }; });
  R.consts = K; say("consts " + JSON.stringify(K));
  const PHI = (1 + Math.sqrt(5)) / 2, f = K.H / 2 / K.T35, kDrag = 2 * K.T35 / K.H;
  const { site, cell } = await L.arena(G, 44);
  R.site = site; say("arena " + JSON.stringify(site));
  await L.recorder(G);
  const home = { x: site.x + 0.5, y: site.y, z: site.z + 0.5, yaw: site.yaw };
  const S = () => D(() => window.Rocket.debug().sight());
  const geo = () => D(() => {
    const d = window.Rocket.debug(), c = d.cam(), H = d.pearl().PEARL, l = c.last, seat = [d.P.x, d.P.y + H.headY, d.P.z];
    const fd = [Math.sin(l.yaw) * Math.cos(l.pitch), Math.sin(l.pitch), -Math.cos(l.yaw) * Math.cos(l.pitch)];
    return { eye: c.eye, seat, f: fd, yaw: l.yaw, pitch: l.pitch, camD: c.camD, blend: c.blend && { dur: c.blend.dur, pitchTo: c.blend.pitchTo }, drawMe: c.drawMe,
             P: { x: d.P.x, y: d.P.y, z: d.P.z, yaw: d.P.yaw, pitch: d.P.pitch, face: d.P.face, walked: d.P.walked } };
  });
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a) => Math.hypot(a[0], a[1], a[2]);
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const lookDir = (yaw, pitch) => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const thirdEye = (g) => { const dd = lookDir(g.P.yaw, g.P.pitch - K.c.AIM); return [g.P.x - K.c.TP_D * dd[0], g.P.y + K.PEARL.top / 2 - K.c.TP_D * dd[1], g.P.z - K.c.TP_D * dd[2]]; };
  const ui = () => D(() => ({ pressed: document.getElementById("v-sight").getAttribute("aria-pressed"), data: document.body.dataset.sight || "", bar: getComputedStyle(document.querySelector(".bar")).display,
    sightBtn: getComputedStyle(document.getElementById("v-sight")).display, pearls: document.getElementById("pearls").hidden ? "" : document.getElementById("pearls").textContent }));
  const toasts = () => D(() => (window.__toasts || []).splice(0));
  // the right finger, or the mouse: a tap on the canvas at (x, y), away from the stick's zone on a phone
  const TX = phone ? 300 : K.W / 2, TY = phone ? 300 : K.H / 2;
  const tap = async (x, y) => { x = x == null ? TX : x; y = y == null ? TY : y; if (phone) { await G.touch("touchStart", [{ x, y, id: 7 }]); await G.touch("touchEnd", []); } else { await P.mouse.click(x, y); } };
  const tapEl = async (sel) => {
    const b = await D((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
    if (phone) { await G.touch("touchStart", [{ x: b.x, y: b.y, id: 8 }]); await G.touch("touchEnd", []); } else { await P.click(sel); }
  };
  const key = (k) => D((k) => { document.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); document.dispatchEvent(new KeyboardEvent("keyup", { key: k, bubbles: true })); return { now: performance.now(), V: window.__V, f: window.__frames }; }, k);
  const clear = () => D(() => { const d = window.Rocket.debug(); d.clearPearls(); });
  const settle = async () => { await frames(18); };
  const ids = (list) => D((l) => l.map((c) => window.Rocket.debug().w.get(c[0], c[1], c[2])), list);
  const putBack = async (list, was) => { const by = {}; list.forEach((c, i) => { (by[was[i]] = by[was[i]] || []).push(c); }); for (const b of Object.keys(by)) { await L.setB(G, by[b], +b); } };
  // the pearl's centre touching within a cell (the cell grown by its radius)
  const nearCell = (c) => (q) => q.x > c[0] - 0.15 && q.x < c[0] + 1.15 && q.z > c[2] - 0.15 && q.z < c[2] + 1.15 && q.y > c[1] - 0.15 && q.y < c[1] + 1.15;
  const raiseNow = async () => { await D(() => window.Rocket.debug().raiseSight(true)); await settle(); };
  const lowerNow = async () => { await D(() => window.Rocket.debug().raiseSight(false)); await settle(); };

  // ---- 01 third person, the sight down, on the level run
  await L.stand(G, Object.assign({}, home, { pitch: K.c.REST || -0.229 }));
  await shot("01_third_down", 6);

  // ---- 1. raise and lower, every way
  {
    const ways = phone ? ["button", "R", "Escape"] : ["button", "R", "Escape", "rmb-click", "rmb-held"];
    R.cases.raise = [];
    for (const way of ways) {
      await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await frames(3);
      const p0 = (await geo()).P.pitch;
      if (way === "button") { await tapEl("#v-sight"); }
      else if (way === "R" || way === "Escape") { await key("r"); }
      else { await P.mouse.move(K.W / 2, K.H / 2); await P.mouse.down({ button: "right" }); }
      if (way === "rmb-click") { await frames(3); await P.mouse.up({ button: "right" }); }
      const u1 = await ui(), g1 = await geo();
      await frames(18);
      if (way === "rmb-held") { await frames(7); }
      const g2 = await geo(), s2 = await S();
      const dist = len(sub(g2.eye, g2.seat)), off = len(cross(sub(g2.seat, g2.eye), g2.f));
      const res = { way, up: { ui: u1, blend: g1.blend, dist, offLine: off, pitch0: p0, pitch: g2.P.pitch, ease: s2.ease } };
      check(u1.pressed === "true" && u1.data === "true" && u1.bar === "none", way + ": raised, aria-pressed, body[data-sight], the bar hidden (" + JSON.stringify(u1) + ")");
      check(g1.blend && Math.abs(g1.blend.dur - K.sc.T_VIEW) < 1e-9 && g1.blend.pitchTo === null, way + ": the blend over T_VIEW " + (g1.blend && g1.blend.dur.toFixed(4)) + " s, pitchTo null");
      check(Math.abs(dist - PHI) < 0.001 && off < 0.001, way + ": the eye phi behind the seat (" + dist.toFixed(5) + " m), on the look line (" + (off * 1000).toFixed(3) + " mm off)");
      check(Math.abs(g2.P.pitch - p0) < 1e-9, way + ": the pitch unchanged by the raise (" + p0.toFixed(4) + " -> " + g2.P.pitch.toFixed(4) + ")");
      // and down
      if (way === "button") { await tapEl("#v-sight"); }
      else if (way === "R") { await key("r"); }
      else if (way === "Escape") { await key("Escape"); }
      else if (way === "rmb-click") { await P.mouse.down({ button: "right" }); await frames(2); await P.mouse.up({ button: "right" }); }
      else { await P.mouse.up({ button: "right" }); }
      const u3 = await ui(), g3 = await geo();
      await frames(18);
      const g4 = await geo(), te = thirdEye(g4);
      res.down = { ui: u3, blend: g3.blend, pitch: g4.P.pitch, eyeOff: len(sub(g4.eye, te)) };
      check(u3.pressed === "false" && u3.data === "" && u3.bar !== "none", way + ": lowered (" + JSON.stringify(u3) + ")");
      check(g3.blend && Math.abs(g3.blend.pitchTo - Math.max(K.c.TP_DOWN, Math.min(K.c.TP_UP, g3.P.pitch))) < 1e-9, way + ": lowered, the blend's pitchTo clamped (" + (g3.blend && g3.blend.pitchTo) + ")");
      check(g4.P.pitch >= K.c.TP_DOWN - 1e-9 && g4.P.pitch <= K.c.TP_UP + 1e-9 && res.down.eyeOff < 0.001, way + ": after, the pitch within third person's and the camera thirdCam's (" + (res.down.eyeOff * 1000).toFixed(3) + " mm off)");
      R.cases.raise.push(res);
      if (way === "rmb-held") { say("rmb held: up while held " + JSON.stringify(s2.up)); check(s2.up === true, "rmb-held: up while held (25 frames)"); }
    }
  }
  // ---- 02-05: the raise held at 1/4, 1/2, 3/4, then up and still
  await L.stand(G, Object.assign({}, home, { pitch: 0 })); await frames(3);
  await D(() => window.Rocket.debug().raiseSight(true));
  for (const [s, name] of [[0.25, "02_raise_quarter"], [0.5, "03_raise_half"], [0.75, "04_raise_three_quarters"]]) {
    await D((s) => window.Rocket.debug().holdView(s), s);
    await shot(name, 3);
  }
  await D(() => window.Rocket.debug().holdView(null));
  await settle(); await frames(6);
  await shot("05_up_still", 2);
  // ---- 2. the glass
  {
    const g = await geo(), s = await S(), D2 = len(sub(s.head, g.eye)), rw = f * K.PEARL.headR / Math.sqrt(D2 * D2 - K.PEARL.headR * K.PEARL.headR);
    const want = phone ? 92.57 : 78.97;
    const v = sub(s.inHand, g.eye), r = [Math.cos(g.yaw), 0, Math.sin(g.yaw)], up = cross(r, g.f), right = deg(Math.atan2(dot(v, r), dot(v, g.f))), over = deg(Math.atan2(dot(v, up), dot(v, g.f)));
    R.cases.glass = { rw, want, D: D2, inHand: { right, over } };
    check(Math.abs(rw - want) < 1, "the window's radius " + rw.toFixed(2) + " px (" + want + " ± 1)");
    check(Math.abs(right - 13.1) < 0.5 && Math.abs(over - 1.5) < 0.5, "the pearl in his glove " + right.toFixed(2) + " deg right of the mark, " + over.toFixed(2) + " deg over it (13.1, 1.5 ± 0.5)");
    await D(() => window.Rocket.debug().holdView(0.49)); await frames(2);
    const h49 = (await geo()).drawMe.head;
    await D(() => window.Rocket.debug().holdView(0.5)); await frames(2);
    const h50 = (await geo()).drawMe.head;
    await D(() => window.Rocket.debug().holdView(null)); await frames(2);
    const hUp = (await geo()).drawMe.head;
    await D(() => window.Rocket.debug().raiseSight(false)); await frames(1);
    const hDown = (await geo()).drawMe.head;
    R.cases.glass.head = { h49, h50, hUp, hDown };
    check(h49 === true && h50 === false && hUp === false && hDown === true, "the head drawn to the raise's half, not from it, again at once when lowered (" + JSON.stringify(R.cases.glass.head) + ")");
    await settle();
  }
  // ---- 3. the drag, raised and lowered
  {
    R.cases.drag = {};
    const drag = async (dx, dy) => {
      const x0 = phone ? 300 : K.W * 0.62, y0 = phone ? 400 : K.H * 0.4;
      const a = await geo(), c0 = await D(() => window.Rocket.debug().carried());
      if (phone) { await G.touch("touchStart", [{ x: x0, y: y0, id: 9 }]); await G.touch("touchMove", [{ x: x0 + dx, y: y0 + dy, id: 9 }]); await G.touch("touchEnd", []); }
      else { await P.mouse.move(x0, y0); await P.mouse.down(); await P.mouse.move(x0 + dx, y0 + dy); await P.mouse.up(); }
      const b = await geo(), c1 = await D(() => window.Rocket.debug().carried());
      return { dyaw: b.P.yaw - a.P.yaw, dpitch: b.P.pitch - a.P.pitch, thrown: c0 - c1 };
    };
    await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow();
    const r1 = await drag(100, 0), r2 = await drag(0, -50);
    await lowerNow(); await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await frames(3);
    const r3 = await drag(100, 0);
    R.cases.drag = { up: r1, upPitch: r2, down: r3, k: kDrag };
    check(Math.abs(r1.dyaw - 100 * kDrag) < 1e-6 && r1.thrown === 0, "raised, a drag of 100 px turns the look " + r1.dyaw.toFixed(6) + " (100 x 2 tan 35 / " + K.H + " = " + (100 * kDrag).toFixed(6) + "), nothing thrown");
    check(Math.abs(r2.dpitch - 50 * kDrag) < 1e-6, "raised, a drag up of 50 px raises the pitch " + r2.dpitch.toFixed(6) + " (" + (50 * kDrag).toFixed(6) + ")");
    check(Math.abs(r3.dyaw - 0.55) < 1e-6, "lowered, the same drag turns it " + r3.dyaw.toFixed(6) + " (0.55)");
  }
  // ---- 4. the hold: a point held still for a beat comes to the mark
  {
    await L.stand(G, Object.assign({}, home, { pitch: 0 }));
    const bricks = [cell(9, 1, 0), cell(9, 1, 1)];
    await L.setB(G, bricks, 9);
    await raiseNow(); await frames(4);
    const tgt = bricks[1], face = [tgt[0] + 0.5 - site.ax * 0.5, tgt[1] + 0.5, tgt[2] + 0.5 - site.az * 0.5];
    const sc = await D((p) => window.Rocket.debug().screenOf(p), face);
    const fromMark = Math.hypot(sc[0] - K.W / 2, sc[1] - K.H / 2);
    await shot("14a_hold_before", 1);
    if (phone) { await G.touch("touchStart", [{ x: sc[0], y: sc[1], id: 10 }]); } else { await P.mouse.move(sc[0], sc[1]); await P.mouse.down(); }
    await frames(22);
    const mid = await S();
    await frames(16);
    const s = await S(), g = await geo(), ang = deg(Math.acos(Math.min(1, dot(g.f, sub(face, g.eye)) / len(sub(face, g.eye)))));
    if (phone) { await G.touch("touchEnd", []); } else { await P.mouse.up(); }
    await frames(3);
    const c = await D(() => window.Rocket.debug().carried());
    await shot("14b_hold_after", 1);
    const onIt = s.hit && s.hit.x === tgt[0] && s.hit.y === tgt[1] && s.hit.z === tgt[2];
    R.cases.hold = { face, screen: sc, fromMark, turnAt22: mid.turn, hit: s.hit, angleDeg: ang, carried: c };
    check(mid.turn === true, "the hold came at the beat: the turn running at frame 22");
    check(onIt || ang < 0.2, "the point held (" + fromMark.toFixed(0) + " px from the mark) is under the crux: hit " + JSON.stringify(s.hit && [s.hit.x, s.hit.y, s.hit.z]) + ", " + ang.toFixed(4) + " deg off");
    check(c === 5, "released after the hold, nothing thrown (carried " + c + ")");
    // a press moved 12 px within the beat: no turn
    const a = await geo(), x0 = K.W / 2 + 80, y0 = K.H / 2;
    if (phone) { await G.touch("touchStart", [{ x: x0, y: y0, id: 11 }]); await frames(5); await G.touch("touchMove", [{ x: x0 + 12, y: y0, id: 11 }]); }
    else { await P.mouse.move(x0, y0); await P.mouse.down(); await frames(5); await P.mouse.move(x0 + 12, y0); }
    await frames(22);
    const s2 = await S(), b = await geo();
    if (phone) { await G.touch("touchEnd", []); } else { await P.mouse.up(); }
    R.cases.hold.moved = { turn: s2.turn, dyaw: b.P.yaw - a.P.yaw };
    check(!s2.turn && Math.abs(b.P.yaw - a.P.yaw - 12 * kDrag) < 1e-6, "a press moved 12 px within the beat: no turn (the look turned by the drag alone, " + (b.P.yaw - a.P.yaw).toFixed(6) + ")");
    await L.setB(G, bricks, 0);
  }
  // ---- 5. the arrows (a computer)
  if (!phone) {
    await L.stand(G, Object.assign({}, home, { pitch: 0 })); await frames(2);
    const run = async (k, n) => {
      const a = await D((k) => { document.dispatchEvent(new KeyboardEvent("keydown", { key: k })); window.__f0 = window.__frames; const d = window.Rocket.debug(); return { yaw: d.P.yaw, pitch: d.P.pitch, walked: d.P.walked, x: d.P.x, z: d.P.z }; }, k);
      await frames(n);
      const b = await D((k) => { document.dispatchEvent(new KeyboardEvent("keyup", { key: k })); const d = window.Rocket.debug(); return { n: window.__frames - window.__f0, yaw: d.P.yaw, pitch: d.P.pitch, walked: d.P.walked, x: d.P.x, z: d.P.z }; }, k);
      return { n: b.n, dyaw: b.yaw - a.yaw, dpitch: b.pitch - a.pitch, walked: Math.hypot(b.x - a.x, b.z - a.z) };
    };
    const rate = 2 * Math.asin(K.PEARL.headR / PHI) / K.sc.BEAT;
    const r1 = await run("ArrowRight", 20), r2 = await run("ArrowUp", 10);
    await D(() => { window.Rocket.debug().P.pitch = 0; });
    const r3 = await run("w", 10);
    R.cases.arrows = { rate, right: r1, up: r2, w: r3 };
    check(Math.abs(r1.dyaw / (r1.n * 0.025) - rate) / rate < 0.02, "ArrowRight held " + r1.n + " frames: " + (r1.dyaw / (r1.n * 0.025)).toFixed(4) + " rad/s (2 asin(R/phi) / BEAT = " + rate.toFixed(4) + ", ± 2 %); over 20 frames " + (rate * 0.5).toFixed(4) + " rad");
    check(r2.dpitch > 0 && Math.abs(r2.dpitch / (r2.n * 0.025) - rate) / rate < 0.02 && r2.walked < 1e-6, "ArrowUp raises the pitch (" + r2.dpitch.toFixed(4) + ") and does not walk (" + r2.walked.toFixed(4) + " m)");
    check(r3.walked > 0.5, "W still walks (" + r3.walked.toFixed(2) + " m in " + r3.n + " frames)");
    await lowerNow();
  }
  // ---- 6. the throw: a tap, the pearl out at once from his glove, landing where predict() said
  {
    await clear();
    await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow(); await frames(4);
    const pr = await D(() => window.Rocket.debug().predict());
    await tap();
    const a = await D(() => { const d = window.Rocket.debug(); return { carried: d.carried(), n: d.pearls().length, H: d.pearls()[0] && d.pearls()[0].from.H, hand: d.hand() }; });
    await D(() => window.Rocket.debug().holdFling(0.25)); await frames(1);
    await shot("11_fling_quarter_pearl_out", 0);
    await D(() => window.Rocket.debug().holdFling(null));
    await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
    const first = (await D(() => window.Rocket.debug().pearls()[0].first)), err = len(sub([first.x, first.y, first.z], [pr.at.x, pr.at.y, pr.at.z]));
    R.cases.throw = { tap: a, predicted: pr.at, first, err, launch: pr.L && { th: deg(pr.L.th), vel: pr.L.vel } };
    check(a.carried === 4 && a.n === 1, (phone ? "a tap" : "a left click") + " with the sight up throws at once (carried " + a.carried + ", " + a.n + " out)");
    check(a.H && len(sub(a.H, a.hand)) < 1e-9, "the pearl leaves from his raised glove (from.H = hand())");
    check(err < 0.01, "its first touch " + (err * 1000).toFixed(2) + " mm from predict()'s, " + Math.hypot(first.x - home.x, first.z - home.z).toFixed(2) + " m off, launched " + deg(pr.L.th).toFixed(2) + " deg");
    if (!phone) {
      await frames(21);
      await P.keyboard.press("t"); const c1 = await D(() => window.Rocket.debug().carried());
      await frames(21);
      await D(() => document.activeElement && document.activeElement.blur());
      await P.keyboard.press("Enter"); const c2 = await D(() => window.Rocket.debug().carried());
      await frames(21);
      await D(() => document.getElementById("notes-btn").focus());
      await P.keyboard.press("Enter"); await frames(2);
      const c3 = await D(() => ({ carried: window.Rocket.debug().carried(), notes: !document.getElementById("notes").hidden }));
      await D(() => { document.getElementById("notes").hidden = true; document.activeElement.blur(); });
      R.cases.throw.keys = { T: c1, Enter: c2, notesEnter: c3 };
      check(c1 === 3 && c2 === 2, "T and Enter throw (carried " + c1 + ", then " + c2 + ")");
      check(c3.carried === 2 && c3.notes, "Enter with the focus on Notes opens Notes and throws nothing (" + JSON.stringify(c3) + ")");
    }
  }
  // ---- 7. one a beat, the kept tap
  {
    R.cases.rate = {};
    await clear(); await frames(21);
    await L.recOn(G, true);
    await tap();
    const t1 = await D(() => ({ f: window.__frames, thrown: window.Rocket.debug().sight().thrown }));
    await frames(3); await tap();
    const kept = (await S()).next;
    await P.waitForFunction(() => window.Rocket.debug().pearls().length >= 2, null, { timeout: 600000 });
    await frames(2);
    let rec = await L.recs(G); await L.recOn(G, false);
    // the frame the first was thrown in: the last recorded at or before its time (read from outside after the tap, a
    // frame can pass before the read)
    const f1 = rec.filter((r) => r.V <= t1.thrown).pop(), f2 = rec.find((r) => r.n >= 2), expect = rec.find((r) => r.V >= t1.thrown + 480);
    R.cases.rate.two = { f1: f1 && f1.f, read: t1.f, f2: f2 && f2.f, dframes: f1 && f2 && f2.f - f1.f, expectFrame: expect && expect.f, kept };
    check(kept === true && f1 && f2 && f2.f - f1.f === 20 && f2.f === expect.f, "two taps 3 frames apart: the second kept, thrown " + (f1 && f2 && f2.f - f1.f) + " frames after the first (20: BEAT at 25 ms)");
    // five taps in a beat throw two
    // (dispatched in the page on the game's own frames: from outside, the software renderer's frames run on between
    // taps, and five taps 3 frames apart had spread over more than a beat)
    await clear(); await frames(21);
    const tapF = await D((a) => new Promise((done) => {
      const cv = document.getElementById("view"), f0 = window.__frames, out = []; let i = 0;
      const go = () => {
        if (window.__frames - f0 >= i * 3) {
          const o = { pointerId: 60 + i, pointerType: a.type, isPrimary: true, button: 0, buttons: 1, clientX: a.x, clientY: a.y, bubbles: true };
          cv.dispatchEvent(new PointerEvent("pointerdown", o)); cv.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 })));
          out.push(window.__frames - f0); i += 1;
        }
        if (i < 5) { requestAnimationFrame(go); } else { done(out); }
      };
      go();
    }), { type: phone ? "touch" : "mouse", x: TX, y: TY });
    await frames(30);
    const five = await D(() => 5 - window.Rocket.debug().carried());
    R.cases.rate.five = { thrown: five, tapFrames: tapF };
    check(five === 2, "five taps in a beat (at frames " + tapF.join(", ") + ") throw two (" + five + ")");
    // a tap at the raise's frame 5 is thrown when the arm is up
    await clear(); await lowerNow(); await frames(21);
    await L.recOn(G, true);
    const kr = await key("r");
    await frames(5); await tap();
    const keptR = (await S()).next;
    await P.waitForFunction(() => window.Rocket.debug().pearls().length >= 1, null, { timeout: 600000 });
    await frames(2);
    rec = await L.recs(G); await L.recOn(G, false);
    const fr = rec.find((r) => r.n >= 1), exR = rec.find((r) => r.V >= kr.now + K.sc.T_VIEW * 1000);
    R.cases.rate.raise = { raiseFrame: kr.f, eventMsIntoFrame: kr.now - kr.V, thrownFrame: fr && fr.f, after: fr && fr.f - kr.f, expectAfter: exR && exR.f - kr.f, kept: keptR };
    check(keptR && fr && fr.f === exR.f, "a tap at the raise's frame 5 is kept and thrown " + (fr && fr.f - kr.f) + " frames after the raise, as the arm comes up (T_VIEW 15.8 frames after the raise, which came " + (kr.now - kr.V).toFixed(1) + " ms into its frame: " + (exR && exR.f - kr.f) + ")");
  }
  // ---- 8. converging: a wall at 13 m (level) and at 21 m (10 deg up), the pearl on the mark's upright
  {
    R.cases.converge = [];
    for (const [s0, pitch] of [[13, 0], [21, 10]]) {
      const wall = [];
      for (let q = -3; q <= 3; q++) for (let k = 0; k < 10; k++) { wall.push(cell(s0, q, k)); }
      await L.setB(G, wall, 9); await clear();
      await L.stand(G, Object.assign({}, home, { pitch: rad(pitch) })); await frames(6);
      const s = await S();
      await D(() => window.Rocket.debug().throwAt());
      await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
      const p = (await D(() => window.Rocket.debug().pearls()[0])), r = [Math.cos(p.from.yaw), 0, Math.sin(p.from.yaw)];
      const lat = dot(sub([p.first.x, p.first.y, p.first.z], p.from.eye), r), handLat = dot(sub(p.from.H, p.from.eye), r);
      const res = { at: s0, pitch, hitWall: s.hit && Math.abs((s.hit.x - site.x) * site.ax + (s.hit.z - site.z) * site.az - s0) < 0.5, range: Math.hypot(p.first.x - home.x, p.first.z - home.z), lateralCm: lat * 100, parallelCm: handLat * 100, firstCell: p.first.cell };
      R.cases.converge.push(res);
      check(res.hitWall && Math.abs(lat) < 0.02, "a wall at " + s0 + " m (aimed " + pitch + " deg): the crux on it, the pearl's first touch " + (lat * 100).toFixed(2) + " cm off the crux's upright (parallel: " + (handLat * 100).toFixed(1) + " cm)");
      await L.setB(G, wall, 0);
    }
    await clear();
  }
  // ---- 9. the feet, and the farthest throw
  {
    const table = [[0, [10.44, null, null], 12.58], [10, [10.24, 12.66, 16.5], 20.78], [20, [9.84, 12.17, 15.72], 28.43], [45, [8.06, 10.05, 12.89], 34.84], [39.5, null, 35.32]];
    R.cases.feet = [];
    for (const [pitch, feet, lands] of table) {
      await L.stand(G, Object.assign({}, home, { pitch: rad(pitch) })); await frames(7);
      const s = await S(), range = s.land ? Math.hypot(s.land.x - home.x, s.land.z - home.z) : null;
      const okFeet = !feet || feet.every((v, i) => v == null ? s.feet[i] == null : s.feet[i] != null && Math.abs(s.feet[i] - v) <= 0.3);
      R.cases.feet.push({ pitch, feet: s.feet, want: feet, lands: range, wantLands: lands, launch: s.launched && deg(s.launched.th), hit: s.hit });
      check(!s.hit && okFeet && range != null && Math.abs(range - lands) <= 0.3, "aimed " + pitch + " deg up, nothing within the throw: the feet " + JSON.stringify(s.feet.map((v) => v == null ? null : +v.toFixed(2))) + " (" + JSON.stringify(feet) + " ± 0.3), comes down " + (range && range.toFixed(2)) + " m (" + lands + "), launched " + (s.launched && deg(s.launched.th).toFixed(2)) + " deg");
      if (pitch === 39.5) { await shot("10_up_39_5_sky", 1); }
    }
  }
  // the aim at a point: the yaw from his head over it, and the pitch turned until the arc's first touch is where asked
  const aimLand = async (T, test) => {
    // (halving the pitch on the range: the landing's own angle from his head changes too little with its range on
    // flat ground for a step on the angle to come to it)
    const g0 = await geo(), yaw = Math.atan2(T[0] - g0.seat[0], -(T[2] - g0.seat[2])), want = Math.hypot(T[0] - g0.seat[0], T[2] - g0.seat[2]);
    let lo = -1.2, hi = 0.75, s = null;
    for (let i = 0; i < 16; i++) {
      const pitch = (lo + hi) / 2;
      await D((a) => { const d = window.Rocket.debug(); d.P.yaw = a.yaw; d.P.pitch = a.pitch; }, { yaw, pitch }); await frames(4);
      s = await S();
      if (s.land && test(s.land)) { return s; }
      const got = s.land ? Math.hypot(s.land.x - g0.seat[0], s.land.z - g0.seat[2]) : 1e9;
      if (got < want) { lo = pitch; } else { hi = pitch; }
    }
    return s;
  };
  // the crux on a point: the look from the head's seat through it (the sight's line passes the head's centre)
  const aimCrux = async (T) => {
    const g0 = await geo(), yaw = Math.atan2(T[0] - g0.seat[0], -(T[2] - g0.seat[2])), pitch = Math.atan2(T[1] - g0.seat[1], Math.hypot(T[0] - g0.seat[0], T[2] - g0.seat[2]));
    await D((a) => { const d = window.Rocket.debug(); d.P.yaw = a.yaw; d.P.pitch = a.pitch; }, { yaw, pitch }); await frames(4);
    return S();
  };
  // ---- 10. where it lands: a work beyond LOOK, a piece lying as a block, water, a block, a note
  // (the crux is put on the target for what the tag says, then held over it for the throw, as the feet show: past
  // the zero the pearl comes down under the sight's line)
  {
    R.cases.lands = {};
    // a work, from a stand beyond nine metres with nothing between
    const work = await D(() => {
      const d = window.Rocket.debug(), w = d.w, S = w.SOLID, H = d.pearl().PEARL.headY;
      for (let i = 0; i < d.paintings.length; i++) {
        const p = d.paintings[i], n = p.axis === "x" ? [p.dir, 0] : [0, p.dir], C = [p.cx, (p.y0 + p.y1) / 2, p.cz];
        for (let dd = 18; dd >= 9.6; dd -= 0.4) {
          const sx = C[0] + n[0] * dd, sz = C[2] + n[1] * dd, X = Math.floor(sx), Z = Math.floor(sz);
          for (let y = Math.floor(p.y0) - 2; y <= Math.floor(p.y0) + 1; y++) {
            if (!S[w.get(X, y - 1, Z)] || S[w.get(X, y, Z)] || S[w.get(X, y + 1, Z)] || w.get(X, y - 1, Z) === 6) { continue; }
            const e = [sx, y + H, sz], v = [C[0] - e[0], C[1] - e[1], C[2] - e[2]], L2 = Math.hypot(v[0], v[1], v[2]);
            let clear = true;
            for (let t = 0.3; t < L2 - 0.3 && clear; t += 0.1) { if (S[w.get(Math.floor(e[0] + v[0] * t / L2), Math.floor(e[1] + v[1] * t / L2), Math.floor(e[2] + v[2] * t / L2))]) { clear = false; } }
            // and the sight's camera behind him clear, and the arc's room over the line
            const b = [sx - n[0] * 1.7, y + H, sz - n[1] * 1.7];
            if (S[w.get(Math.floor(b[0]), Math.floor(b[1]), Math.floor(b[2]))]) { clear = false; }
            if (clear) { return { i, title: p.f.title, C, stand: { x: sx, y, z: sz }, dist: L2, rect: { axis: p.axis, plane: p.plane, dir: p.dir, u0: p.u0, u1: p.u1, y0: p.y0, y1: p.y1 } }; }
          }
        }
      }
      return null;
    });
    say("work " + JSON.stringify(work));
    if (!check(!!work, "a work with a stand beyond nine metres and nothing between")) { R.cases.lands.work = null; }
    else {
      await clear(); await lowerNow();
      await L.stand(G, { x: work.stand.x, y: work.stand.y, z: work.stand.z, yaw: Math.atan2(work.C[0] - work.stand.x, -(work.C[2] - work.stand.z)), pitch: 0 });
      await frames(4); await raiseNow();
      const onWork = (q) => { const r = work.rect, u = r.axis === "x" ? q.z : q.x; return u > r.u0 + 0.05 && u < r.u1 - 0.05 && q.y > r.y0 + 0.05 && q.y < r.y1 - 0.05; };
      const sNow = await aimCrux(work.C);
      await shot("07_on_a_work", 1);
      const s = await aimLand(work.C, onWork);
      await frames(3);
      const al0 = await D(() => window.Rocket.debug().alarms()); await toasts();
      await D(() => window.Rocket.debug().throwAt());
      await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
      await frames(3);
      const al1 = await D(() => window.Rocket.debug().alarms()), said = await toasts(), label = await D(() => document.getElementById("label").hidden);
      await shot("13_landed_on_work_toast", 0);
      R.cases.lands.work = { title: work.title, dist: work.dist, tag: sNow.tag, hit: sNow.hit, landOnWork: !!(s && s.land && onWork(s.land)), alarms: [al0, al1], said, labelHidden: label };
      check(sNow.hit && sNow.hit.work === work.title && /One of the works he saved/.test(sNow.tag), "the crux on " + work.title + " " + work.dist.toFixed(1) + " m off, the tag says what it is (" + sNow.tag + ")");
      check(al0 === al1 && label && said.some((t) => t.indexOf("Your pearl struck " + work.title) === 0), "the pearl struck the work: " + JSON.stringify(said) + "; alarms " + al0 + " -> " + al1 + ", the label closed");
      await lowerNow(); await clear();
    }
    // a piece lying as a block: one of his, on the arena (the piece is the rocket's own; the copy stands in for where
    // the place hid it, which is behind a roof, a tree's leaves or water)
    {
      const pc = await D(() => { const d = window.Rocket.debug(), Pl = window.RocketPlace; d.notes.forEach((n) => { d.known[n.k + ":" + n.i] = 1; });
        const l = d.pieces.filter((p) => d.found.indexOf(p.k) < 0 && (d.place.kind === "city" || !Pl.roomAt(d.place, p.x + 0.5, p.y, p.z + 0.5))); return l[0] || d.pieces[0]; });
      const pid = [22, 23, 24, 25][pc.k], c = cell(12, 0, 0);
      await L.setB(G, [c], pid);
      await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow();
      const s = await aimLand([c[0] + 0.5 - site.ax * 0.5, c[1] + 0.5, c[2] + 0.5 - site.az * 0.5], nearCell(c));
      await frames(3);
      const sNow = await S();
      await shot("08_on_a_piece", 1);
      await toasts();
      await D(() => window.Rocket.debug().throwAt());
      await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
      await frames(12);
      const r = await D((k) => { const d = window.Rocket.debug(); return { marked: !!d.marked()[k], found: d.found.slice(), near: document.getElementById("near").textContent, name: d.adv.pieces[k].name, first: d.pearls()[0].first }; }, pc.k);
      const said = await toasts();
      R.cases.lands.piece = Object.assign({ k: pc.k, tag: sNow.tag, said }, r);
      check(r.marked && r.found.indexOf(pc.k) < 0 && said.some((t) => /Your pearl rang on a piece of your rocket/.test(t)), "a piece: it rings (" + JSON.stringify(said) + "), marked, not taken");
      check(r.near.indexOf(r.name.replace(/^The /, "")) >= 0, "the arrow at the top names the marked piece first (" + r.near + ")");
      await L.setB(G, [c], 0); await lowerNow(); await clear();
    }
    // water: a pool two deep at 10 to 13 m
    {
      const pool = [], floorC = [];
      for (let s0 = 10; s0 <= 13; s0++) for (let q = -2; q <= 2; q++) { pool.push(cell(s0, q, -1), cell(s0, q, -2)); floorC.push(cell(s0, q, -3)); }
      const wasPool = await ids(pool), wasFloor = await ids(floorC);
      await L.setB(G, floorC, 3); await L.setB(G, pool, 6);
      await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow();
      const T = cell(11, 0, -1);
      const sNow = await aimCrux([T[0] + 0.5, T[1] + 0.9, T[2] + 0.5]);
      await shot("09_on_water", 1);
      const sl = await aimLand([T[0] + 0.5, T[1] + 0.9, T[2] + 0.5], (q) => { const a = (q.x - site.x) * site.ax + (q.z - site.z) * site.az; return a > 10.3 && a < 12.5; });
      say("water aim " + JSON.stringify(sl && { land: sl.land, hit: sl.hit, pitch: (await geo()).P.pitch }));
      await frames(3);
      await toasts();
      await D(() => window.Rocket.debug().throwAt());
      await frames(8);
      await shot("12_in_flight_trail", 0);
      await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.state === "rest"; }, null, { timeout: 600000 });
      const p = await D(() => window.Rocket.debug().pearls()[0]), said = await toasts(), bottom = site.y - 2, R0 = 3 * K.sc.U * 0 + 3 * Math.pow(PHI, -7);
      R.cases.lands.water = { tag: sNow.tag, hit: sNow.hit, rest: [p.x, p.y, p.z], wet: p.wet, bottom, said, dy: p.y - (bottom + R0) };
      check(sNow.hit && sNow.hit.water, "the crux on the water (" + sNow.tag + ")");
      check(p.wet && Math.abs(p.y - (bottom + R0)) < 0.01 && said.some((t) => /^Your pearl sinks/.test(t)) && !said.some((t) => /^Your pearl struck/.test(t)), "water: it sinks and lies on the bottom (y " + p.y.toFixed(4) + ", bottom + R " + (bottom + R0).toFixed(4) + "), " + JSON.stringify(said));
      await putBack(pool, wasPool); await putBack(floorC, wasFloor); await lowerNow(); await clear();
    }
    // a block (brick, of no section): what it struck, by name
    {
      const c = cell(10, 0, 0), c2 = cell(10, 0, 1);
      await L.setB(G, [c, c2], 9);
      await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow();
      await aimLand([c[0] + 0.5 - site.ax * 0.5, c[1] + 1, c[2] + 0.5 - site.az * 0.5], (q) => nearCell(c)(q) || nearCell(c2)(q));
      await toasts();
      await D(() => window.Rocket.debug().throwAt());
      await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
      await frames(2);
      const said = await toasts(), first = await D(() => window.Rocket.debug().pearls()[0].first);
      R.cases.lands.block = { said, first };
      check(said.some((t) => /^Your pearl struck /.test(t)) && first.b === 9, "a block: " + JSON.stringify(said));
      await L.setB(G, [c, c2], 0); await lowerNow(); await clear();
    }
    // a note lying on the ground 7 m off, as the place lays them (a sheet in the air cell over a block): the pearl
    // falls on it and says so (at its speed it seldom stays there)
    {
      const nc = cell(7, 0, 0);
      const wasN = await ids([nc]);
      await L.setB(G, [nc], 26);
      await L.stand(G, Object.assign({}, home, { pitch: -0.2 })); await raiseNow();
      const sl = await aimLand([nc[0] + 0.5, nc[1] + 0.05, nc[2] + 0.5], (q) => Math.floor(q.x) === nc[0] && Math.floor(q.z) === nc[2]);
      say("note aim " + JSON.stringify(sl && sl.land));
      await toasts();
      await D(() => window.Rocket.debug().throwAt());
      await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.first; }, null, { timeout: 600000 });
      await frames(3);
      const p = await D(() => window.Rocket.debug().pearls()[0]), said = await toasts();
      R.cases.lands.note = { first: p.first, said };
      check(p.first.note && said.some((t) => /^Your pearl fell on a note/.test(t)), "a note: the pearl falls on it and says so (" + JSON.stringify(said) + ")");
      await putBack([nc], wasN); await lowerNow(); await clear();
    }
  }
  // ---- 11. back in the glove: walked into, tapped with the sight lowered, not through a wall
  {
    R.cases.back = {};
    await clear();
    await L.stand(G, Object.assign({}, home, { pitch: -0.2 })); await raiseNow();
    await D(() => window.Rocket.debug().throwAt());
    await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.state === "rest"; }, null, { timeout: 600000 });
    const p0 = await D(() => window.Rocket.debug().pearls()[0]);
    await lowerNow();
    // walk into it: stood two metres short of it, facing it, W held
    const dx = p0.x - home.x, dz = p0.z - home.z, Ld = Math.hypot(dx, dz), yaw = Math.atan2(dx, -dz);
    await L.stand(G, { x: p0.x - dx / Ld * 2, y: home.y, z: p0.z - dz / Ld * 2, yaw, pitch: -0.229 }); await frames(2); await toasts();
    await P.keyboard.down("w");
    await P.waitForFunction(() => window.Rocket.debug().carried() === 5, null, { timeout: 120000 }).catch(() => {});
    await P.keyboard.up("w");
    const c1 = await D(() => window.Rocket.debug().carried()), s1 = await toasts();
    R.cases.back.walked = { carried: c1, said: s1 };
    check(c1 === 5 && s1.some((t) => /^A pearl back in your hand: 5 of 5/.test(t)), "walked into, a pearl is back in the glove (" + JSON.stringify(s1) + ")");
    // a tap on one 3 m off, the sight lowered
    const tapOn = async (q) => {
      if (phone) { const sc = await D((p) => window.Rocket.debug().screenOf(p), q); await tap(sc[0], sc[1]); return sc; }
      // on a computer the click acts at the crosshair: the look turned till the crosshair is on it
      for (let i = 0; i < 6; i++) { await D((p) => { const d = window.Rocket.debug(), e = d.cam().eye, v = [p[0] - e[0], p[1] - e[1], p[2] - e[2]]; d.P.yaw = Math.atan2(v[0], -v[2]); d.P.pitch = Math.atan2(v[1], Math.hypot(v[0], v[2])); }, q); await frames(2); }
      await tap(); return null;
    };
    await L.stand(G, Object.assign({}, home, { pitch: -0.5 })); await raiseNow();
    await aimLand(cell(3, 0, 0).map((v, i) => v + (i === 1 ? 0 : 0.5)), (q) => Math.hypot(q.x - home.x, q.z - home.z) < 3.6);
    await D(() => window.Rocket.debug().throwAt());
    await P.waitForFunction(() => { const p = window.Rocket.debug().pearls()[0]; return p && p.state === "rest"; }, null, { timeout: 600000 });
    const p1 = await D(() => window.Rocket.debug().pearls()[0]);
    await lowerNow();
    // stood 3 m short of where it lies, facing it
    const ex = p1.x - home.x, ez = p1.z - home.z, el = Math.hypot(ex, ez), near = { x: p1.x - ex / el * 3, y: home.y, z: p1.z - ez / el * 3, yaw: Math.atan2(ex, -ez), pitch: -0.229 };
    const dist1 = 3;
    // a wall between first: the tap meets the wall, nothing back
    const mid = [Math.floor((near.x + p1.x) / 2), home.y, Math.floor((near.z + p1.z) / 2)], wallB = [mid, [mid[0], mid[1] + 1, mid[2]], [mid[0], mid[1] + 2, mid[2]]];
    await L.stand(G, near); await frames(2);
    await L.setB(G, wallB, 9); await frames(3);
    const cw0 = await D(() => window.Rocket.debug().carried());
    await tapOn([p1.x, p1.y, p1.z]); await frames(3);
    const cw1 = await D(() => window.Rocket.debug().carried());
    await P.waitForFunction(() => !window.Rocket.debug().swing(), null, { timeout: 600000 });
    await L.setB(G, wallB, 0); await frames(3);
    R.cases.back.wall = { dist: dist1, before: cw0, after: cw1 };
    check(cw1 === cw0, "a tap on a pearl behind a wall: nothing back (carried " + cw0 + " -> " + cw1 + ")");
    await L.stand(G, near); await frames(3); await toasts();
    await tapOn([p1.x, p1.y, p1.z]); await frames(3);
    const ct = await D(() => window.Rocket.debug().carried()), st = await toasts();
    R.cases.back.tapped = { dist: dist1, carried: ct, said: st };
    check(ct === cw0 + 1, "the sight lowered, a tap on one " + dist1.toFixed(1) + " m off takes it back (" + cw0 + " -> " + ct + ")");
  }
  // ---- 12. none left
  {
    await clear(); await L.stand(G, Object.assign({}, home, { pitch: 0.2 })); await raiseNow();
    for (let i = 0; i < 5; i++) { await D(() => window.Rocket.debug().throwAt()); await frames(21); }
    await toasts();
    const sixth = await D(() => window.Rocket.debug().throwAt()), said = await toasts();
    await frames(3);
    const s = await S();
    R.cases.none = { sixth, said, tag: s.tag };
    check(!sixth && said.indexOf("No pearl in your hand: pick one up again where it lies (walk to it, or tap it with the sight lowered).") >= 0, "the sixth throw: none left (" + JSON.stringify(said) + ")");
    check(/No pearl in your hand: walk to one, or tap it with the sight lowered/i.test(s.tag), "the tag's act line says so (" + s.tag + ")");
    await lowerNow(); await clear();
  }
  // ---- 13. the smash and the throw
  {
    const c = cell(1, 0, 0);
    await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await frames(3);
    await L.setB(G, [c], 9); await frames(2);
    const face = [c[0] + 0.5 - site.ax * 0.5, c[1] + 0.5, c[2] + 0.5 - site.az * 0.5];
    await D((p) => { const d = window.Rocket.debug(), s = d.screenOf(p); d.act(s[0], s[1], false); }, face);
    const sw0 = await D(() => window.Rocket.debug().swing());
    await P.waitForFunction(() => { const s = window.Rocket.debug().swing(); return s && s.u >= 0.5; }, null, { timeout: 600000 });
    await key("r");
    const sw1 = await D(() => window.Rocket.debug().swing());
    await frames(24);
    const id = await D((c) => window.Rocket.debug().w.get(c[0], c[1], c[2]), c), s = await S(), sw2 = await D(() => window.Rocket.debug().swing());
    R.cases.smash = { started: !!sw0, ret: sw1 && sw1.ret, id, ease: s.ease, after: sw2 };
    check(!!sw0 && sw1 && sw1.ret && id === 9 && s.ease === 1 && !sw2, "sight down a tap starts a swing; raised at u 0.5 the swing is let go (ret), the block stands, the arm comes up (ease " + s.ease + ")");
    // with the sight up, a tap on that block throws
    const c0 = await D(() => window.Rocket.debug().carried());
    if (phone) { const sc = await D((p) => window.Rocket.debug().screenOf(p), face); await tap(sc[0], sc[1]); } else { await tap(); }
    await frames(2);
    const r = await D(() => ({ carried: window.Rocket.debug().carried(), swing: window.Rocket.debug().swing() }));
    R.cases.smash.up = Object.assign({ before: c0 }, r);
    check(r.carried === c0 - 1 && !r.swing, "sight up, a tap on that block throws, no swing (" + JSON.stringify(R.cases.smash.up) + ")");
    await frames(20); await L.setB(G, [c], 0); await lowerNow(); await clear();
  }
  // ---- 14. the hologram: no sight, no throw
  {
    await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await raiseNow();
    await D((v) => window.Rocket.debug().holoLeft(v), 150);
    await tapEl("#v-holo"); await frames(2);
    const s0 = await S(), h0 = await D(() => window.Rocket.debug().head()), u0 = await ui();
    await toasts();
    await key("r"); await frames(1); const tR = await toasts();
    await key("t"); await frames(1); const tT = await toasts();
    let tM = [];
    if (!phone) { await P.mouse.move(K.W / 2, K.H / 2); await P.mouse.down({ button: "right" }); await frames(1); await P.mouse.up({ button: "right" }); await frames(1); tM = await toasts(); }
    else { await D(() => { const c = document.getElementById("view"), o = { pointerId: 61, pointerType: "mouse", button: 2, buttons: 2, bubbles: true, clientX: 200, clientY: 300 }; c.dispatchEvent(new PointerEvent("pointerdown", o)); c.dispatchEvent(new PointerEvent("pointerup", Object.assign({}, o, { buttons: 0 }))); }); await frames(1); tM = await toasts(); }
    const ta = await D(() => window.Rocket.debug().throwAt()); const tA = await toasts();
    await shot("16_hologram_no_sight", 2);
    const B = "As the hologram you can look and read. To take, build, break or throw, leave the hologram (Holo, or H): your body follows your head.";
    R.cases.holo = { sight: s0.up, head: h0 && h0.phase, ui: u0, R: tR, T: tT, rmb: tM, throwAt: ta, throwSaid: tA };
    check(!s0.up && !!h0 && u0.sightBtn === "none", "Holo with the sight up: the sight down at once, the head out, the Sight button not displayed (" + JSON.stringify(u0) + ")");
    check(tR.indexOf(B) >= 0 && tT.indexOf(B) >= 0 && tM.indexOf(B) >= 0 && ta === false, "as the hologram R, T and the right button say it is barred; throwAt() false");
    await tapEl("#v-holo");
    await P.waitForFunction(() => !window.Rocket.debug().head(), null, { timeout: 600000 });
    await frames(3);
    const s1 = await S();
    check(!s1.up, "Holo again: the body follows, the sight still down");
    R.cases.holo.after = s1.up;
  }
  // ---- 15. a stone of the homage, and where you woke: his eyes, the sight's camera raised, his eyes again lowered
  {
    R.cases.stones = [];
    const spots = await D(() => { const d = window.Rocket.debug(), h = d.homage(), t = d.underTree(), out = []; if (h && h.stands.length) { out.push({ name: "stone", at: h.stands[0].at }); } out.push({ name: "where you woke", at: [t.x, t.y, t.z], tree: true }); return out; });
    for (const sp of spots) {
      if (sp.tree) { await D(() => { window.Rocket.debug().sky().away = true; }); }
      await L.stand(G, { x: sp.at[0], y: sp.at[1], z: sp.at[2], yaw: home.yaw, pitch: 0 }); await frames(22); await L.endBlend(P); await frames(3);
      const g0 = await geo(), st0 = await D(() => window.Rocket.debug().stone());
      const eyes0 = len(sub(g0.eye, [g0.P.x, g0.P.y + 1.62, g0.P.z]));
      await key("r"); await frames(20);
      const g1 = await geo();
      await key("r"); await frames(1); const g2 = await geo(); await frames(20);
      const g3 = await geo(), st3 = await D(() => window.Rocket.debug().stone()), eyes3 = len(sub(g3.eye, [g3.P.x, g3.P.y + 1.62, g3.P.z]));
      const res = { name: sp.name, stone0: st0, eyes0, sightDist: len(sub(g1.eye, g1.seat)), camD: g1.camD, loweredPitchTo: g2.blend && g2.blend.pitchTo, stone3: st3, eyes3 };
      R.cases.stones.push(res);
      check(st0 && eyes0 < 1e-6 && Math.abs(res.sightDist - Math.min(PHI, g1.camD)) < 0.001 && res.sightDist > 0.5 && st3 && eyes3 < 1e-6, sp.name + ": his eyes (" + eyes0.toFixed(4) + "), raised the sight's camera " + res.sightDist.toFixed(3) + " m from the seat, lowered his eyes again (" + eyes3.toFixed(4) + ")");
      await frames(2);
      const g4 = await D(() => { const c = window.Rocket.debug().cam(); return c.blend && c.blend.pitchTo; });
      check(res.loweredPitchTo === null || g2.blend === null, sp.name + ": lowered there, the blend's pitch left as it is (" + res.loweredPitchTo + ")");
      await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await frames(25); await L.endBlend(P); await frames(3);
    }
  }
  // ---- 16. a wall at his back
  {
    const wall = [];
    for (let q = -2; q <= 2; q++) for (let k = 0; k < 5; k++) { wall.push(cell(-2, q, k)); }
    await L.setB(G, wall, 9);
    await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow(); await frames(4);
    const g = await geo(), s = await S(), D2 = len(sub(s.head, g.eye)), rw = f * K.PEARL.headR / Math.sqrt(Math.max(1e-8, D2 * D2 - K.PEARL.headR * K.PEARL.headR));
    const solid = await D((e) => { const d = window.Rocket.debug(), w = d.w, rc = 0.08 * Math.sqrt(1 + Math.pow(Math.tan(35 * Math.PI / 180), 2) * (1 + Math.pow(innerWidth / innerHeight, 2)));
      for (let i = 0; i < 8; i++) { const b = w.get(Math.floor(e[0] + (i & 1 ? rc : -rc)), Math.floor(e[1] + (i & 2 ? rc : -rc)), Math.floor(e[2] + (i & 4 ? rc : -rc))); if (b !== 0 && b !== 6) { return true; } } return false; }, g.eye);
    R.cases.wallBehind = { camD: g.camD, rw, solid };
    await shot("17_wall_at_his_back", 1);
    check(g.camD < PHI && rw > (phone ? 92.6 : 79.0) && !solid, "a wall at his back: the camera pulled in (" + g.camD.toFixed(3) + " m), the window larger (" + rw.toFixed(1) + " px), never in a block");
    await lowerNow(); await L.setB(G, wall, 0);
  }
  // ---- 15b (photograph) lowered again
  await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await frames(4);
  await shot("15_lowered_again", 1);
  // ---- 06 dragging: the figure open, no ring
  {
    await L.stand(G, Object.assign({}, home, { pitch: 0 })); await raiseNow(); await frames(4);
    const x0 = phone ? 260 : K.W * 0.6, y0 = phone ? 420 : K.H * 0.45;
    // (moved in the page on the game's own frames, 10 px a frame: from outside the renderer's frames ran on between
    // moves and the drag was slower than it was meant to be)
    const s = await D((a) => new Promise((done) => {
      const cv = document.getElementById("view"), o = (x, b) => ({ pointerId: 71, pointerType: a.type, isPrimary: true, button: 0, buttons: b, clientX: x, clientY: a.y, bubbles: true });
      cv.dispatchEvent(new PointerEvent("pointerdown", o(a.x, 1)));
      const f0 = window.__frames; let i = 0;
      const go = () => { if (window.__frames > f0 + i) { i += 1; cv.dispatchEvent(new PointerEvent("pointermove", Object.assign(o(a.x + 10 * i, 1), { button: -1 }))); }
        if (i < 10) { requestAnimationFrame(go); } else { requestAnimationFrame(() => done(window.Rocket.debug().sight())); } };
      go();
    }), { type: phone ? "touch" : "mouse", x: x0, y: y0 });
    await shot("06_dragging_open", 0);
    await D((a) => document.getElementById("view").dispatchEvent(new PointerEvent("pointerup", { pointerId: 71, pointerType: a.type, isPrimary: true, button: 0, buttons: 0, clientX: a.x + 100, clientY: a.y, bubbles: true })), { type: phone ? "touch" : "mouse", x: x0, y: y0 });
    R.cases.dragOpen = { theta: deg(s.theta) };
    check(s.theta > rad(3), "dragging, the figure opens (theta " + deg(s.theta).toFixed(1) + " deg), the ring gone (steady " + (1 - Math.min(1, Math.max(0, (deg(s.theta) - 1) / 2))).toFixed(2) + ")");
    await lowerNow();
  }
  // ---- 17. reduced motion
  {
    await P.emulateMedia({ reducedMotion: "reduce" });
    await clear(); await L.stand(G, Object.assign({}, home, { pitch: 0 })); await frames(2);
    await D(() => window.Rocket.debug().raiseSight(true)); await frames(1);
    const g = await geo(), s = await S();
    const x0 = phone ? 260 : K.W * 0.6, y0 = phone ? 420 : K.H * 0.45;
    if (phone) { await G.touch("touchStart", [{ x: x0, y: y0, id: 13 }]); } else { await P.mouse.move(x0, y0); await P.mouse.down(); }
    for (let i = 1; i <= 8; i++) { if (phone) { await G.touch("touchMove", [{ x: x0 + 6 * i, y: y0, id: 13 }]); } else { await P.mouse.move(x0 + 6 * i, y0); } await frames(1); }
    const sd = await S();
    await shot("19_reduced_motion_dragging", 0);
    if (phone) { await G.touch("touchEnd", []); } else { await P.mouse.up(); }
    await frames(2);
    await L.recOn(G, true);
    await D(() => window.Rocket.debug().throwAt()); const t1 = await D(() => ({ f: window.__frames, thrown: window.Rocket.debug().sight().thrown }));
    await frames(1); const fl = (await S()).fling;
    await D(() => window.Rocket.debug().throwAt());
    await P.waitForFunction(() => window.Rocket.debug().pearls().length >= 2, null, { timeout: 600000 }); await frames(1);
    const rec = await L.recs(G); await L.recOn(G, false);
    const f2 = rec.find((r) => r.n >= 2);
    R.cases.reduced = { blend: g.blend, ease: s.ease, theta: sd.theta, land: !!sd.land, fling: fl, second: f2 && f2.f - t1.f };
    check(g.blend === null && s.ease === 1, "reduced motion: the raise at once (blend " + JSON.stringify(g.blend) + ", ease " + s.ease + ")");
    check(sd.theta === 0 && sd.land, "reduced motion, dragging: the figure stays closed (theta 0) and the landing ring is there");
    check(fl === 0 && f2 && f2.f - t1.f === 20, "reduced motion: no fling (" + fl + "), the rate still one a beat (" + (f2 && f2.f - t1.f) + " frames)");
    await D(() => window.Rocket.debug().raiseSight(false)); await frames(2);
    await P.emulateMedia({ reducedMotion: "no-preference" });
    await clear();
  }
  // ---- 11 (end). put out by the guards: all five and none lying
  {
    await L.stand(G, Object.assign({}, home, { pitch: 0.1 })); await raiseNow();
    await D(() => window.Rocket.debug().throwAt()); await frames(21); await D(() => window.Rocket.debug().throwAt()); await frames(4);
    const before = await D(() => ({ carried: window.Rocket.debug().carried(), n: window.Rocket.debug().pearls().length }));
    await D(() => window.Rocket.debug().putOut());
    const after = await D(() => ({ carried: window.Rocket.debug().carried(), n: window.Rocket.debug().pearls().length, up: window.Rocket.debug().sight().up }));
    R.cases.back.putOut = { before, after };
    check(after.carried === 5 && after.n === 0 && !after.up, "put out by the guards, he comes to with all five and none lying (" + JSON.stringify(before) + " -> " + JSON.stringify(after) + ")");
    await D(() => window.Rocket.debug().skip());
    await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
    await frames(4); await L.endBlend(P); await frames(4);
  }
  // ---- 19. frame time: the sight up, still and dragging, against down; predict's own time
  {
    const ft = async (n) => { await D(() => { window.__ft.length = 0; }); await frames(n); const a = await D(() => window.__ft.slice()); a.sort((x, y) => x - y); return +a[a.length >> 1].toFixed(1); };
    await L.stand(G, Object.assign({}, home, { pitch: -0.229 })); await frames(4);
    const down = await ft(40);
    await raiseNow();
    const up = await ft(40);
    const x0 = phone ? 260 : K.W * 0.6, y0 = phone ? 420 : K.H * 0.45;
    if (phone) { await G.touch("touchStart", [{ x: x0, y: y0, id: 14 }]); } else { await P.mouse.move(x0, y0); await P.mouse.down(); }
    await D(() => { window.__ft.length = 0; });
    for (let i = 1; i <= 40; i++) { if (phone) { await G.touch("touchMove", [{ x: x0 + 2 * i, y: y0, id: 14 }]); } else { await P.mouse.move(x0 + 2 * i, y0); } await frames(1); }
    const dragA = await D(() => window.__ft.slice()); dragA.sort((x, y) => x - y);
    if (phone) { await G.touch("touchEnd", []); } else { await P.mouse.up(); }
    const pred = await D(() => { const d = window.Rocket.debug(), t0 = Date.now(); for (let i = 0; i < 50; i++) { d.predict(); } return (Date.now() - t0) / 50; });
    R.frameMs = { down, up, dragging: +dragA[dragA.length >> 1].toFixed(1), predictMs: pred };
    say("frame callback median ms " + JSON.stringify(R.frameMs));
    check(pred <= 2, "predict() takes " + pred.toFixed(2) + " ms (2 ms the budget; it runs a frame in three)");
    await lowerNow();
  }
  check(G.errors.length === 0, "no page errors or WebGL warnings " + JSON.stringify(G.errors));
  R.errors = G.errors; R.bad = G.bad;
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(R, null, 1));
  fs.writeFileSync(`${out}/log.txt`, G.log.join("\n") + "\n");
  await G.browser.close();
  console.log(G.bad.length ? "FAILED: " + G.bad.join("; ") : "ALL OK");
  process.exit(G.bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); fs.writeFileSync(`${out}/results.json`, JSON.stringify(R, null, 1)); process.exit(1); });
