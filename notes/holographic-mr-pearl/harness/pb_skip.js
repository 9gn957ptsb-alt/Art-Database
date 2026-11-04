// pb_skip.js - the walk-through's Skip (the artist, 4 Nov 2026: "Add a skip button at the very beginning to skip the
// tutorial"). On a fresh save: Skip there from the first frame, a finger's size, inside the screen, clear of the Super,
// the courts' squares and the score; a real tap (a click on the desk) skips it: the walk-through done and saved, its
// match gone, he stands between games (no match begun by itself), Mr Plan at his baseline, the welcome said, Skip
// gone; court one then plays as any match (three pearls, both supers). Skipped while it stands still at a step too;
// by the keyboard (Space, Enter), nothing struck; paused, nothing; after a reload, none; a save already past it, none.
// node pb_skip.js [port] [phone|desk]
const { chromium } = require("playwright");
const [port, kind] = process.argv.slice(2);
const desk = kind === "desk";
const VIEW = desk ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  const fresh = async (save) => {
    await p.goto(url);
    await p.evaluate((sv) => { localStorage.clear(); if (sv) { localStorage.setItem("pickleball-save-v1", JSON.stringify(sv)); } }, save || null);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
    await p.evaluate(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.2); d.draw(); });
  };
  const box = () => p.evaluate(() => { const e = document.getElementById("skip"), r = e.getBoundingClientRect(), s = document.getElementById("super").getBoundingClientRect(), h = window.Pickleball.debug().hud();
    return { shown: !e.hidden && getComputedStyle(e).display !== "none", r: [r.left, r.top, r.width, r.height], W: innerWidth, H: innerHeight, sup: [s.left, s.top, s.width, s.height], strip: h && h.strip, score: h && h.score, text: e.textContent, sr: e.getAttribute("aria-label") }; });
  const meet = (a, q) => q && a[0] < q[0] + q[2] && q[0] < a[0] + a[2] && a[1] < q[1] + q[3] && q[1] < a[1] + a[3];
  const press = async (how) => {
    await p.evaluate(() => { window.Pickleball.debug().YT.paused = false; });
    const q = await p.evaluate(() => { const r = document.getElementById("skip").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    if (how === "key") { await p.focus("#skip"); await p.keyboard.press(desk ? "Enter" : "Space"); }
    else if (desk) { await p.mouse.click(q[0], q[1]); }
    else { const cdp = await p.context().newCDPSession(p); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q[0], y: q[1], id: 7 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
    await p.waitForFunction(() => !window.Pickleball.debug().tut().on, null, { timeout: 4000 }).catch(() => {});
    await p.evaluate(() => { window.Pickleball.debug().YT.paused = true; });
  };
  const after = () => p.evaluate(() => {
    const d = window.Pickleball.debug(), T = d.tut(), e = document.getElementById("skip"), pl = d.plans[0], C = d.COURT, o = {};
    o.on = T.on; o.done = T.done; o.stop = T.stop; o.hidden = e.hidden || getComputedStyle(e).display === "none";
    o.saved = (JSON.parse(localStorage.getItem("pickleball-save-v1") || "{}") || {}).tut; o.m = !!d.court.m; o.phase = document.body.dataset.phase;
    o.plan = +Math.hypot(pl.x - 0, pl.z - (-C.L - 0.6)).toFixed(2); o.say = document.getElementById("say").textContent;
    const g0 = d.gt(); d.run(0.6); o.ran = d.gt() > g0; o.mAfter = !!d.court.m; o.fire = d.input.fire;
    return o;
  });

  // 1. at the very beginning: there, its size, inside, clear of the rest
  await fresh(null);
  const b0 = await box();
  check(b0.shown && b0.text === "Skip tutorial" && /Skip the tutorial/.test(b0.sr), `a fresh save: Skip at the very beginning ("${b0.text}")`);
  check(b0.r[2] >= 44 && b0.r[3] >= 44 && b0.r[0] >= 0 && b0.r[1] >= 0 && b0.r[0] + b0.r[2] <= b0.W && b0.r[1] + b0.r[3] <= b0.H, `a finger's size, inside the screen ${JSON.stringify(b0.r.map(Math.round))}`);
  const st = b0.strip ? [b0.strip.x, b0.strip.y, b0.strip.w, b0.strip.h] : null, sc = b0.score ? [b0.score.x, b0.score.y, b0.score.w, b0.score.h] : null;
  check(!meet(b0.r, [b0.sup[0] - 6, b0.sup[1] - 6, b0.sup[2] + 12, b0.sup[3] + 12]) && !meet(b0.r, st) && !meet(b0.r, sc), `clear of the Super, the courts' squares and the score`);
  const words = await p.evaluate(() => { const h = window.Pickleball.debug().hud(), r = document.getElementById("skip").getBoundingClientRect(); return ((h.cue && h.cue.items) || []).filter((it) => it.what !== "pop" && it.x < r.right && r.left < it.x + it.w && it.y < r.bottom && r.top < it.y + it.h).length; });
  check(words === 0, `no walk-through words over it (${words})`);

  // 2. a real tap (a click on the desk): skipped, between games
  await press("tap");
  const a1 = await after();
  check(!a1.on && a1.done && a1.stop == null && a1.hidden && a1.saved === 1, `a tap on it: the walk-through done and saved, Skip gone (${JSON.stringify(a1)})`);
  check(!a1.m && a1.phase === "walk" && a1.ran && !a1.mAfter && a1.plan < 0.05 && /Mr Pearl vs Mr Plan/.test(a1.say), `between games: its match gone, no match begun by itself, the game running, Mr Plan at his baseline, the welcome said`);
  const m1 = await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(0.3); const m = d.court.m; return m ? { sup: m.sup && m.sup.avail, psup: m.psup && m.psup.avail, you: m.you, them: m.them, max: d.SERVE && d.SERVE.MAX } : null; });
  check(m1 && m1.sup && m1.psup && m1.you === 0 && m1.them === 0, `court one then a match as any: 0-0, both supers (${JSON.stringify(m1)})`);
  // (after a reload: none)
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
  const r1 = await p.evaluate(() => { const d = window.Pickleball.debug(), e = document.getElementById("skip"); return { on: d.tut().on, hidden: e.hidden || getComputedStyle(e).display === "none" }; });
  check(!r1.on && r1.hidden, "after a reload: no walk-through, no Skip");

  // 3. while it stands still at a step
  await fresh(null);
  await p.evaluate(() => { const T = window.Pickleball.debug().tut(); T.stop = "three"; T.sT = 0; T.seen.three = true; });
  await press("tap");
  const a2 = await after();
  check(!a2.on && a2.stop == null && !a2.m && a2.ran, `skipped while it stood still at a step: going again, between games (${JSON.stringify(a2)})`);

  // 4. by the keyboard: skipped, nothing struck
  await fresh(null);
  await press("key");
  const a3 = await after();
  const pearls = await p.evaluate(() => (window.Pickleball.debug().court.m ? window.Pickleball.debug().court.m.balls.length : 0));
  check(!a3.on && a3.hidden && !a3.m && !a3.fire && pearls === 0, `by the keyboard (${desk ? "Enter" : "Space"}): skipped, nothing struck (${JSON.stringify(a3)})`);

  // 5. paused: nothing
  await fresh(null);
  const q5 = await p.evaluate(() => { const r = document.getElementById("skip").getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  if (desk) { await p.mouse.click(q5[0], q5[1]); } else { const cdp = await p.context().newCDPSession(p); await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: q5[0], y: q5[1], id: 8 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
  await p.waitForTimeout(200);
  const a5 = await p.evaluate(() => window.Pickleball.debug().tut().on);
  check(a5, "paused, a press does nothing");

  // 6. a save already past it: none from the first frame
  await fresh({ v: 2, won: 0, tut: 1, tips: 255 });
  const b6 = await box();
  check(!b6.shown, "a save past the walk-through: no Skip");

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
