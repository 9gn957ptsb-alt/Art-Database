// pb_go.js - a court's number tapped, a teleport there (the artist, 5 Nov 2026: "I want to be able to click on any court
// number and teleport there"; first 28 Oct: "right beside it so that you only have to take three steps to be in the
// Golden Circle"). With three courts won (four courts): a button over each number's pearl, a finger's height, inside the
// screen; a real tap (a click on the desk) on a won court: behind its baseline, no match, its stand-in said; on the open
// court: beside its gold circle, three steps from it, no match till he steps on (then its match); in the coupe: the
// coupe there with him in it; by the keyboard (Enter, Space); in a match, gone, a press nothing; paused, nothing; in the
// walk-through, none. No errors. node pb_go.js [port] [phone|desk]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port, kind] = process.argv.slice(2);
const desk = kind === "desk";
const VIEW = desk ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  await seed(p);
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  const fresh = async (save) => {
    await p.goto(url); await p.evaluate((sv) => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify(sv)); }, save);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
    await p.evaluate(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.3); d.draw(); });
  };
  const tap = async (k, how) => {   // (a real tap, a click, or a key on the button for court k+1)
    await p.evaluate(() => { const d = window.Pickleball.debug(); d.draw(); d.YT.paused = false; });
    const q = await p.evaluate((kk) => { const e = [...document.querySelectorAll("#courts button")].find((x) => x.textContent === String(kk + 1)); if (!e) { return null; } const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, k);
    if (!q) { await p.evaluate(() => { window.Pickleball.debug().YT.paused = true; }); return false; }
    if (how === "key") { await p.evaluate((kk) => [...document.querySelectorAll("#courts button")].find((x) => x.textContent === String(kk + 1)).focus(), k); await p.keyboard.press(desk ? "Enter" : "Space"); }
    else if (desk) { await p.mouse.click(q[0], q[1]); }
    else { const cdp = await p.context().newCDPSession(p); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q[0], y: q[1], id: 9 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
    await p.waitForTimeout(120);
    await p.evaluate(() => { const d = window.Pickleball.debug(); d.YT.paused = true; d.run(0.05); d.draw(); });
    return true;
  };
  const where = () => p.evaluate(() => { const d = window.Pickleball.debug(), C = d.COURT; return { x: +d.me.x.toFixed(2), z: +d.me.z.toFixed(2), m: !!d.court.m, mode: d.ride.mode, car: [+d.car.x.toFixed(2), +d.car.z.toFixed(2)], say: document.getElementById("say").textContent, L: C.L }; });

  await fresh({ v: 2, won: 3, tut: 1, tips: 255 });
  // 1. the buttons: one over each number's pearl, a finger's height, inside the screen, named
  const bt = await p.evaluate(() => {
    const d = window.Pickleball.debug(), h = d.hud(), bs = [...document.querySelectorAll("#courts button")].map((e) => { const r = e.getBoundingClientRect(); return { t: e.textContent, l: e.getAttribute("aria-label"), r: [r.left, r.top, r.width, r.height] }; });
    const over = (h.pearls || []).every((pp) => bs.some((x) => x.t === String(pp.k + 1) && pp.x >= x.r[0] && pp.x <= x.r[0] + x.r[2] && pp.y >= x.r[1] && pp.y <= x.r[1] + x.r[3]));
    const vis = getComputedStyle(document.getElementById("courts")).visibility;
    return { n: bs.length, over, tall: bs.every((x) => x.r[3] >= 44), inside: bs.every((x) => x.r[0] >= 0 && x.r[0] + x.r[2] <= innerWidth && x.r[1] >= 0), labels: bs.map((x) => x.l), vis, pearls: (h.pearls || []).length };
  });
  check(bt.n === 4 && bt.over && bt.tall && bt.inside && bt.vis === "visible" && /Go to court 1/.test(bt.labels[0]), `a button over each court's number (${bt.n} of ${bt.pearls}), a finger's height, inside the screen, named ("${bt.labels[0]}")`);

  // 2. a won court: behind its baseline, no match, its stand-in said
  await tap(1, "tap"); const w2 = await where();
  check(Math.abs(w2.x - 12) < 0.6 && Math.abs(w2.z - (w2.L + 3)) < 0.6 && !w2.m && /court 2/.test(w2.say), `a tap on court 2 (won): there, behind its baseline (${w2.x}, ${w2.z}), no match, its stand-in said`);

  // 3. the open court: beside its gold circle, three steps from it, no match; stepped on, its match
  await tap(3, "tap"); const w4 = await where();
  const sd = Math.hypot(w4.x - (36 + 0.9), w4.z - (w4.L + 0.4));
  check(sd > 3 && sd < 6 && !w4.m, `a tap on court 4 (the open one): beside its gold circle, ${sd.toFixed(1)} m off (three steps), no match till he steps on`);
  const m4 = await p.evaluate(() => { const d = window.Pickleball.debug(), C = d.COURT; d.me.x = 36.9; d.me.z = C.L + 0.4; for (let i = 0; i < 30 && !d.court.m; i++) { d.run(1 / 30); } return d.court.m ? d.court.m.k : null; });
  check(m4 === 3, "stepped onto its circle: its match");

  // 4. in a match: gone, a press nothing
  const inM = await p.evaluate(() => { const e = document.getElementById("courts"); return getComputedStyle(e).visibility; });
  const before = await where(); await p.evaluate(() => { window.Pickleball.debug().courtGo(0); }); const after = await where();
  check(inM === "hidden" && after.m && Math.abs(after.x - before.x) < 0.01, `in a match the numbers are not buttons (${inM}), and a teleport there does nothing`);

  // 5. in the coupe: the coupe there, him in it
  await fresh({ v: 2, won: 3, tut: 1, tips: 255 });
  await p.evaluate(() => { const d = window.Pickleball.debug(), c = d.car; d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); d.rideToggle(); d.run(0.1); });
  await tap(2, "tap"); const w3 = await where();
  check(w3.mode === "car" && Math.abs(w3.car[0] - 24) < 4 && Math.abs(w3.car[1] - (w3.L + 6.2)) < 0.6 && Math.abs(w3.x - w3.car[0]) < 0.5, `in the coupe, a tap on court 3: the coupe there with him at its wheel (${JSON.stringify(w3.car)})`);
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.car.v = 0; d.rideToggle(); d.run(0.2); });

  // 6. by the keyboard, and the focus let go after it (Space and Enter the game's again)
  await tap(0, "key"); const wk = await where(); const foc = await p.evaluate(() => !!(document.activeElement && document.activeElement.closest && document.activeElement.closest("#courts")));
  check(Math.abs(wk.x - 0) < 0.6 && Math.abs(wk.z - (wk.L + 3)) < 0.6 && !foc, `by the keyboard (${desk ? "Enter" : "Space"}) on court 1's number: there (${wk.x}, ${wk.z}), the focus let go`);
  // 6b. in the coupe mid-donut: the donut cut short, there
  const dn = await p.evaluate(() => { const d = window.Pickleball.debug(), c = d.car; d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); if (d.ride.mode !== "car") { d.rideToggle(); d.run(0.1); } c.v = 0; d.ride.dnQ = true; d.run(0.3); return !!d.ride.dn; });
  await tap(1, "tap"); const wd = await p.evaluate(() => { const d = window.Pickleball.debug(); return { dn: !!d.ride.dn, mode: d.ride.mode, x: +d.car.x.toFixed(1) }; });
  check(dn && !wd.dn && wd.mode === "car" && Math.abs(wd.x - 12) < 0.6, `mid-donut, a tap on court 2: the donut cut short, the coupe there (${JSON.stringify(wd)})`);
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.car.v = 0; d.rideToggle(); d.run(0.2); });

  // 7. paused: nothing
  const pz0 = await where(); const qq = await p.evaluate(() => { const e = [...document.querySelectorAll("#courts button")].find((x) => x.textContent === "2"), r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (desk) { await p.mouse.click(qq[0], qq[1]); } else { const cdp = await p.context().newCDPSession(p); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: qq[0], y: qq[1], id: 10 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  await p.waitForTimeout(120); const pz1 = await where();
  check(Math.abs(pz1.x - pz0.x) < 0.01, "paused, a press does nothing");

  // 8. in the walk-through: no numbers to press
  const p2 = await b.newPage(VIEW); p2.on("pageerror", (e) => errs.push(String(e)));   // (no seed: a fresh save walks court one through)
  await p2.goto(url); await p2.evaluate(() => localStorage.clear()); await p2.reload(); await p2.waitForFunction(() => window.Pickleball && window.Pickleball.debug().running(), null, { timeout: 120000 });
  const tv = await p2.evaluate(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.3); d.draw(); return { on: d.tut().on, vis: getComputedStyle(document.getElementById("courts")).visibility }; });
  check(tv.on && tv.vis === "hidden", `in the walk-through, no numbers to press (${JSON.stringify(tv)})`);

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
