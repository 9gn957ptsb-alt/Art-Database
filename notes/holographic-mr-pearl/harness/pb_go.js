// pb_go.js - a court's number tapped takes him there (the artist, 28 Oct 2026: "I want you to be able to click on the
// court number and it teleport you to that location, I don't want it to automatically put you in the serving position
// but right beside it so that you only have to take three steps to be in the Golden Circle"). With twenty courts won:
// the open court's number, tapped as a finger taps it, puts him beside its gold circle, not on it, the ring in the
// picture beside him (not over his head), no floodlight's pole between the view and him, its match begun, and a walk to
// it straight ahead (W held on the desk, the stick pushed straight up at the keys' walking speed: the circle's pull takes
// it in) takes three steps, counted by his stride, to be on it; a won court's number, tapped by a second finger while
// the stick's thumb is down (a phone makes no click then), puts him behind that court's baseline to watch; on the desk
// Enter on a focused number; in a match the numbers are not there to tap; paused, a tap does nothing; the move tip is
// not taken for a walk; the buttons a finger's height and inside the screen. Taps are real: a finger at the button's
// middle, or the mouse. node pb_go.js outdir [port] [phone|tall|desk] (tall: 9:32, 360 by 1280)
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [out, port, kind] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const VIEW = kind === "desk" ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : kind === "tall" ? { viewport: { width: 360, height: 1280 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  await p.goto(url);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 20, rally: 4 })); });
  await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const D = (f, a) => p.evaluate(f, a);
  // (the floodlights' poles stand at each court's corners: the nearest to the line from the view's eye to him, in plan)
  const poles = () => D(() => {
    const d = window.Pickleball.debug(), C = d.COURT, e = d.camNow().e, me = d.me, n = d.courts.length; let best = 99;
    for (let j = 0; j <= n; j++) { for (const s of [-1, 1]) {
      const px = (j - 0.5) * C.GAP, pz = s * (C.L + 4), vx = me.x - e[0], vz = me.z - e[2], u = Math.max(0, Math.min(1, ((px - e[0]) * vx + (pz - e[2]) * vz) / (vx * vx + vz * vz)));
      best = Math.min(best, Math.hypot(e[0] + u * vx - px, e[2] + u * vz - pz)); } }
    return +best.toFixed(2);
  });
  await D(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.5); d.draw(); });
  // (a tap as a finger taps, at the button's middle, or the mouse's click, with the game awake (paused it takes no input;
  // the loop stays still, so nothing steps between); stick: a second finger's tap while the first holds the stick)
  const cdp = kind === "desk" ? null : await p.context().newCDPSession(p);
  const tapCourt = async (n, stick) => {
    const r = await D((n) => { const e = [...document.querySelectorAll("#courts button")].find((x) => x.textContent === String(n)); if (!e || getComputedStyle(e.parentNode).visibility === "hidden") { return null; } const q = e.getBoundingClientRect(), cx = q.left + q.width / 2, cy = q.top + q.height / 2; return { cx, cy, hit: document.elementFromPoint(cx, cy) === e }; }, n);
    const at = r || await D(() => { const q = document.querySelector("#courts button").getBoundingClientRect(); return { cx: q.left + q.width / 2, cy: q.top + q.height / 2 }; });
    // (the game awake until the button's own pointerup has been handled: under load a touch's events come late)
    await D(() => { window.Pickleball.debug().YT.paused = false; window.__up = 0; if (!window.__upL) { window.__upL = true; window.addEventListener("pointerup", (e) => { if (e.target.closest && e.target.closest("#courts, #super")) { window.__up++; } }); } });
    if (kind === "desk") { await p.mouse.click(at.cx, at.cy); }
    else if (stick) {
      const T = (type, pts) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: pts }), f1 = (y) => ({ x: 80, y, id: 1 }), f2 = { x: at.cx, y: at.cy, id: 2 };
      await T("touchStart", [f1(650)]); await T("touchMove", [f1(610)]); await T("touchStart", [f1(610), f2]); await T("touchMove", [f1(610)]); await T("touchEnd", []);
    } else { await p.touchscreen.tap(at.cx, at.cy); }
    await p.waitForFunction(() => window.__up > 0, null, { timeout: 8000 }).catch(() => {});
    await D(() => { const d = window.Pickleball.debug(); d.YT.paused = true; d.input.stick = null; });
    return !!(r && r.hit);
  };
  const btns = await D(() => [...document.querySelectorAll("#courts button")].map((e) => { const r = e.getBoundingClientRect(); return { n: e.textContent, x: r.left, y: r.top, w: r.width, h: r.height, label: e.getAttribute("aria-label") }; }));
  const W = await D(() => [innerWidth, innerHeight]);
  check(btns.length === 10 && btns[0].n === "12" && btns[9].n === "21", "twenty-one courts: the last ten's numbers are buttons (" + btns.map((q) => q.n).join(" ") + ")");
  check(btns.every((q) => q.h >= 48 && q.x >= 0 && q.y >= 0 && q.x + q.w <= W[0] && q.y + q.h <= W[1]), "a finger's height, inside the screen: " + JSON.stringify(btns[9]));
  // (his resting view, for after the jump: the eye TP.HEAD behind him)
  const start = await D(() => { const d = window.Pickleball.debug(), e = d.camNow().e; return { x: d.me.x, z: d.me.z, eyeOff: +Math.hypot(e[0] - d.me.x, e[2] - d.me.z).toFixed(2) }; });

  // 1. court 21, the open one: beside its gold circle, not on it; its match begun; three steps take him in
  const ok21 = await tapCourt(21);
  const r1 = await D(() => {
    const d = window.Pickleball.debug(); d.run(1 / 60); d.draw();
    const m = d.court.m, sp = m && d.serveSpot(), dist = sp ? Math.hypot(d.me.x - sp[0], d.me.z - sp[1]) : null, eye = d.camNow().e;
    // (beside him: the ring's middle further from his than four tenths of his height on the screen)
    const mk = d.hud().mark, hd = d.toScreen([d.me.x, 1.6, d.me.z]), ft = d.toScreen([d.me.x, 0, d.me.z]);
    return { k: m && m.k, phase: m && m.phase, locked: !!(m && m.meterOn), dist: dist && +dist.toFixed(2), mark: !!mk && !mk.edge, clear: !!mk && !!hd && !!ft && Math.abs(mk.x - hd[0]) > 0.4 * Math.abs(ft[1] - hd[1]), eyeOff: +Math.hypot(eye[0] - d.me.x, eye[2] - d.me.z).toFixed(2) };
  });
  check(ok21 && r1.k === 20 && r1.phase === "serve", `tapped, he is at court 21 and its match begins: ${JSON.stringify(r1)}`);
  check(!r1.locked && r1.dist > 4.4 && r1.dist < 5.1, `beside the gold circle, not on it (${r1.dist} m from its middle)`);
  const c1 = await poles();
  check(c1 > 1, `no floodlight's pole between the view and him (the nearest ${c1} m from the line)`);
  await p.screenshot({ path: `${out}/0_jump.png` });
  check(r1.mark && r1.clear, "the gold circle in the picture, beside him, not over his head");
  check(Math.abs(r1.eyeOff - start.eyeOff) < 0.5, `the view went with him (the eye ${r1.eyeOff} m from him, ${start.eyeOff} at rest)`);
  // (three steps: his stride's phase goes half a turn a step; straight ahead as the view stands, W on the desk, the
  // stick pushed straight up 27 px (the keys' walking speed) on a phone: the circle's pull takes it in)
  const r2 = await D((desk) => {
    const d = window.Pickleball.debug(), me = d.me, m = d.court.m, ph0 = me.phase; let t = 0, near = 99;
    for (let i = 0; i < 240 && !m.meterOn; i++) {
      if (desk) { d.input.keys.w = true; } else { d.input.stick = { id: -1, x: 0, y: 0, dx: 0, dy: -27 }; }
      d.run(1 / 60); t++; const s = d.serveSpot(); near = Math.min(near, Math.hypot(me.x - s[0], me.z - s[1]));
    }
    d.input.stick = null; d.input.keys.w = false;
    return { locked: m.meterOn, steps: +((me.phase - ph0) / Math.PI).toFixed(1), sec: +(t / 60).toFixed(2), near: +near.toFixed(2) };
  }, kind === "desk");
  check(r2.locked && r2.steps >= 2.5 && r2.steps <= 3.5, `straight ahead, three steps and he is on the circle: ${JSON.stringify(r2)}`);
  await p.screenshot({ path: `${out}/1_court21.png` });

  // 2. in a match the numbers are not there to tap
  const inMatch = await D(() => { const e = document.querySelector("#courts"); return getComputedStyle(e).visibility; });
  const r3 = await (async () => { const before = await D(() => window.Pickleball.debug().me.x); await tapCourt(15); return D((before) => ({ moved: Math.abs(window.Pickleball.debug().me.x - before) > 0.5, k: window.Pickleball.debug().court.m && window.Pickleball.debug().court.m.k }), before); })();
  check(inMatch === "hidden" && !r3.moved && r3.k === 20, `in a match the numbers do not move him (${inMatch}, ${JSON.stringify(r3)})`);

  // 3. a won court's number, between matches: beside that court to watch it, no match
  await D(() => { const d = window.Pickleball.debug(); d.winCourt(); d.run(0.5); d.draw(); });
  const ok15 = await tapCourt(15, true);
  // (and the court's middle in the picture, as he faces the net to watch)
  const r4 = await D(() => { const d = window.Pickleball.debug(); d.run(1 / 60); d.draw(); const cx = 14 * d.COURT.GAP, q = d.toScreen([cx, 0, 0]); return { m: !!d.court.m, x: +d.me.x.toFixed(2), cx, seen: !!q && q[0] > 0 && q[0] < innerWidth && q[1] > 0 && q[1] < innerHeight, say: document.getElementById("say").textContent.slice(0, 50) }; });
  const c4 = await poles();
  check(ok15 && !r4.m && Math.abs(r4.x - r4.cx) < 0.01 && r4.seen && c4 > 1, `a won court's number${kind === "desk" ? "" : ", tapped while the stick's thumb is down"}: behind court 15's baseline, its middle in the picture, no pole in the way (${c4} m), no match (${JSON.stringify(r4)})`);
  if (kind === "desk") {
    // (the keyboard: a number focused, Enter takes him there)
    await D(() => { const d = window.Pickleball.debug(); d.YT.paused = false; [...document.querySelectorAll("#courts button")].find((x) => x.textContent === "16").focus(); });
    await p.keyboard.press("Enter");
    const r4k = await D(() => { const d = window.Pickleball.debug(); d.YT.paused = true; return { x: +d.me.x.toFixed(2), cx: 15 * d.COURT.GAP, focus: document.activeElement && document.activeElement.textContent }; });
    check(Math.abs(r4k.x - r4k.cx) < 0.01 && r4k.focus !== "16", "the keyboard: a number focused, Enter takes him there: " + JSON.stringify(r4k));
  }
  await D(() => { const d = window.Pickleball.debug(); d.run(1); d.draw(); });
  await p.screenshot({ path: `${out}/2_court15.png` });

  // 4. paused, a tap does nothing (the first number shown: court 22 is open now, so the strip begins at 13)
  const r5 = await D(() => { const d = window.Pickleball.debug(), x0 = d.me.x; d.pause(true); const e = document.querySelector("#courts button"); ["pointerdown", "pointerup"].forEach((t) => e.dispatchEvent(new PointerEvent(t, { pointerId: 9, bubbles: true }))); e.click(); d.run(1 / 60); return { moved: Math.abs(d.me.x - x0) > 0.5 }; });
  check(!r5.moved, "paused, a tap does nothing");

  // 5. a fresh start: the jump is not taken for a walk, so the move tip stays until he moves
  await p.evaluate(() => localStorage.clear()); await p.reload();
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await D(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.5); d.draw(); });
  await tapCourt(1);
  const r6 = await D(() => { const d = window.Pickleball.debug(); d.run(0.5); const e = document.getElementById("help"); return { tip: e.hidden ? "" : e.textContent.slice(0, 40), k: d.court.m && d.court.m.k }; });
  check(r6.k === 0 && /Move/.test(r6.tip), `on a fresh start, court 1's number: its match, and the move tip still up (${JSON.stringify(r6)})`);
  await p.evaluate(() => localStorage.clear());
  check(start.x < 10, "he began at court 1, 240 m from court 21");
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();
