// pb_walk.js - court one's walk-through, as the artist set it out (29 Oct 2026): "I want there to be a suggestive gesture
// of a finger touching the screen forward on the left side and I want the gold circle for the serve spot to show up
// immediately. When you get to the serve spot I want a golden arrow to point down to the ace region of the serve bar and
// the words "tap anywhere" to pop up. Make sure the walkthrough words are twice as big as they currently are. Once you
// tap to serve the game should freeze and then the words "serve up to three pearls at a time" to pop up and then a 3
// seconds later another text pops up that reads "tap anywhere to continue". Regardless of how many times a user taps on
// the first serve of the first game, only one ball should be served. Once you serve it, Mr Plan will use his super on his
// first return and after the animation for his super starts it should freeze and the words "Each player can use one
// super per game" after 3 seconds it should say "tap anywhere to continue". After the user taps the animation for Mr
// Plan's return should continue a little bit and right as the ball goes over the net the screen should freeze again and
// the words "Hit the return" should pop up as the same golden arrow should be pointing down above the bar but this time
// to the section labeled return. Once the user gets a chance to land the dot running in the bar into the return zone,
// the animation should continue for another split second before it freezes again and the words pop up "or use your super
// to counter" in which a golden arrow points to the super button in the top right. This will be a free super use that
// only happens in the first game ... Once Mr Pearl wins that first point and returns to the second serve the walkthrough
// is over and the user is winning 1-0 with another super". A bot that copies only what is on the screen plays it: the
// finger's push, a tap when the mark is under the arrow, a tap once "to continue" is up, the Super when the arrow points
// at it; on its way it taps where it should not (a fault's part of the bar, before "to continue", outside the return
// zone, beside the Super, and a burst of taps after its serve) and checks that each does nothing but say so. Then: 1 - 0,
// his Super back, Mr Plan's spent, the second serve; done kept; a reload after it has none; a court won ends it.
// node pb_walk.js outdir [port] [phone|land|desk]
const { chromium } = require("playwright");
const [out, port, kind] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const desk = kind === "desk";
const VIEW = desk ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : kind === "land" ? { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  const D = (f, a) => p.evaluate(f, a);
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png`, timeout: 240000 });
  const fresh = async () => {
    await p.goto(url); await D(() => localStorage.clear()); await p.reload();
    await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    await D(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(1 / 60); d.draw(); });
  };
  // what the HUD drew, the Super, the squares, the screen reader's sentence; and which words are not clear (of the
  // screen's edge, the Super and 6 px round it, the squares)
  const look = () => D(() => {
    const d = window.Pickleball.debug(); d.draw();
    const q = d.hud().cue || {}, e = document.getElementById("help"), r = e.getBoundingClientRect(), s = document.getElementById("super"), sr = s.getBoundingClientRect(), st = d.hud().strip, W = innerWidth, H = innerHeight, m = d.court.m;
    const meets = (A, B) => !!A && !!B && A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h, sup = { x: sr.left - 6, y: sr.top - 6, w: sr.width + 12, h: sr.height + 12 };
    const off = (q.items || []).filter((it) => it.what !== "pop" && (it.x < 11.5 || it.y < 11.5 || it.x + it.w > W - 11.5 || it.y + it.h > H - 11.5 || meets(it, sup) || meets(it, st))).map((it) => it.what + ":" + Math.round(it.x) + "," + Math.round(it.y));
    return { key: q.key, stop: q.stop, cont: q.cont, ghost: q.ghost, keys: q.keys || [], items: q.items || [], arrows: q.arrows || [], off, W, H, gt: d.gt(),
             sr: { text: e.textContent, w: r.width, h: r.height }, sup: { disabled: s.disabled, nudge: s.classList.contains("nudge") },
             meter: d.hud().meter, mark: d.hud().mark, strip: st, score: d.hud().score, say: document.getElementById("say").style.opacity,
             m: m && { phase: m.phase, you: m.you, them: m.them, served: m.served, tosses: m.tosses.length, meterOn: m.meterOn } };
  });

  // 0. a first game: court one's match on the first frame, its gold circle there at once, he beside it
  await fresh();
  let c = await look();
  check(c.m && c.m.phase === "serve" && c.mark && !c.mark.edge && c.mark.x > 0 && c.mark.x < c.W && c.mark.y < c.H, `the gold circle on the screen from the first frame (at ${c.mark && Math.round(c.mark.x)}, ${c.mark && Math.round(c.mark.y)})`);
  await D(() => window.Pickleball.debug().run(0.4));
  c = await look();
  check(c.key === "move" && c.ghost && c.ghost.finger && c.ghost.x < c.W / 2 && c.ghost.dy === -1 && (!desk || c.keys.some((k) => k.ch === "W" && k.lit)), `step one: a finger's ghost on the left half pushing forward${desk ? ", and W" : ""}`);
  check(!c.items.filter((x) => x.what !== "pop").length && c.sr.w <= 1.5 && /left half/.test(c.sr.text), `no words on it; its sentence for a screen reader only ("${c.sr.text.slice(0, 50)}")`);
  check(c.say === "0" && c.strip && c.strip.y <= 12, "the words under the squares quiet; the squares the top");
  check(c.score && c.score.you === 0 && c.score.them === 0 && c.score.x >= c.strip.x + c.strip.w && c.score.x + c.score.w <= c.W, `the score, 0 - 0, right of the squares (${JSON.stringify(c.score)})`);
  await shot("1_move");
  const ys = await D(() => { const d = window.Pickleball.debug(), y = []; for (let i = 0; i < 12; i++) { d.run(0.1); d.draw(); const g = d.hud().cue.ghost; if (g && g.shown) { y.push(Math.round(g.y)); } } return y; });
  check(ys.length > 4 && Math.max(...ys) - Math.min(...ys) > 40, `its touch moves forward up the screen, and lifts (${ys.join(" ")})`);

  // the bot: it does only what the screen shows, and taps where it should not on the way
  const bot = await D((desk) => {
    const d = window.Pickleball.debug(), T = d.tut(), C = d.cue(), S = document.getElementById("super"), seen = { steps: [], at: {}, faultTap: null, spam: null, early: {}, miss: null, frozen: {}, contAt: {}, plan: null, net: null, said: {}, hands: {}, presses: {}, pressBad: 0, supHand: null };
    let last = null, faulted = false, served = false, spamN = 0, hitMissed = false, besideDone = false;
    for (let f = 0; f < 60 * 150 && !T.done; f++) {
      if (f % 6) { d.run(1 / 60); continue; }   // (it looks ten times a second, as a person does)
      d.draw(); const q = d.hud().cue || {}, m = d.court.m, k = q.key;
      if (k !== last) {
        seen.steps.push(k); last = k;
        if (k) { const mb = d.hud().meter; seen.at[k] = { gt: d.gt(), items: (q.items || []).map((x) => ({ what: x.what, t: x.t, size: x.size, lines: x.lines })), arrows: (q.arrows || []).map((a) => ({ to: a.to, x: Math.round(a.x), y: Math.round(a.y), ang: +a.ang.toFixed(2) })), sr: document.getElementById("help").textContent, meter: mb && { y0: mb.y0, x0: mb.x0, cw: mb.cw, N: mb.N }, sup: S.disabled, nudge: S.classList.contains("nudge") }; }
      }
      if (q.stop) { const fr = seen.frozen[q.stop] || (seen.frozen[q.stop] = { gt: d.gt(), still: true }); if (d.gt() !== fr.gt) { fr.still = false; } }
      if (q.cont && seen.contAt[k] == null) { seen.contAt[k] = +(C.rt - T.sT).toFixed(2); seen.said[k] = document.getElementById("help").textContent; }
      d.input.stick = null; ["w", "a", "s", "d"].forEach((x) => { d.input.keys[x] = false; });
      let fire = false; const u = d.meter(), g = q.ghost, zone = (v) => v != null && v >= 0.72 && v < 0.84;
      if (g && g.hand) { seen.hands[k] = seen.hands[k] || { early: !q.cont && (k === "three" || k === "each"), x: Math.round(g.x), y: Math.round(g.y) }; if (g.press) { seen.presses[k] = (seen.presses[k] || 0) + 1; if ((k === "serve" && !zone(u)) || (k === "hit" && !zone(m.psup.uNow))) { seen.pressBad++; } } }
      if (k === "sup" && g && g.hand && !seen.supHand) { const r = S.getBoundingClientRect(); seen.supHand = { in: g.x >= r.left && g.x <= r.right && g.y >= r.top && g.y <= r.bottom }; }
      if (!served && m.served + m.tosses.length > 0) { served = true; }
      if (k === "move" && q.ghost && q.ghost.finger) {
        if (desk) { (q.keys || []).forEach((kc) => { if (kc.lit) { d.input.keys[kc.ch.toLowerCase()] = true; } }); } else { d.input.stick = { id: -1, x: 80, y: 700, dx: q.ghost.dx * 50, dy: q.ghost.dy * 50 }; }
      } else if (k === "serve" && (q.arrows || []).some((a) => a.to === "tap") && u != null && d.gt() >= m.meterT0) {
        if (!faulted && u < 0.09) { faulted = true; fire = true; seen.faultTap = { u: +u.toFixed(2) }; }   // (a fault's part: it should only say so)
        else if (faulted && seen.faultTap.after != null && g && g.hand && g.press) { fire = true; }   // (with the hand: as it presses)
      } else if (k === "three" || k === "each") {
        if (!q.cont && C.rt - T.sT > 1 && !seen.early[k]) { seen.early[k] = true; fire = true; }   // (too soon: nothing)
        else if (q.cont && g && g.hand && g.press) { fire = true; }
      } else if (k === "hit") {
        const v = m.psup.uNow;
        if (!hitMissed && v < 0.5) { hitMissed = true; fire = true; seen.miss = { u: +v.toFixed(2) }; }
        else if (hitMissed && seen.miss.pop != null && g && g.hand && g.press) { fire = true; }
      } else if (k === "sup" && (q.arrows || []).some((a) => a.to === "super")) {
        if (!besideDone) {   // (a tap beside the Super: an arrow to it, and nothing else)
          besideDone = true; const v = document.getElementById("view"), o = { pointerId: 9, clientX: 60, clientY: innerHeight / 2, bubbles: true, pointerType: desk ? "mouse" : "touch" };
          d.YT.paused = false; v.dispatchEvent(new PointerEvent("pointerdown", o)); v.dispatchEvent(new PointerEvent("pointerup", o)); d.YT.paused = true;
        } else if (T.stop === "sup" && g && g.hand && g.press) { d.YT.paused = false; if (desk) { window.dispatchEvent(new KeyboardEvent("keydown", { key: "e" })); window.dispatchEvent(new KeyboardEvent("keyup", { key: "e" })); } else { S.click(); } d.YT.paused = true; }
      }
      if (seen.faultTap && seen.faultTap.after == null && k === "serve" && !fire) { seen.faultTap.after = m.served + m.tosses.length; seen.faultTap.pop = (q.items || []).filter((x) => x.what === "pop").map((x) => x.t).join(","); }
      if (seen.miss && seen.miss.pop == null && k === "hit" && !fire) { seen.miss.pop = (q.items || []).filter((x) => x.what === "pop").map((x) => x.t).join(","); seen.miss.still = T.stop === "hit"; }
      if (served && spamN < 8 && m.phase !== "plansuper" && !T.stop) { spamN++; fire = true; }   // (a burst of taps after the serve)
      if (spamN >= 8 && !seen.spam) { seen.spam = { n: m.served + m.tosses.length, live: m.balls.filter((x) => !x.dead).length }; }
      if (m.phase === "plansuper" && !seen.plan) { seen.plan = { ballServe: !!m.psup.ball.serve, them: m.them }; }
      if (k === "each" && seen.plan && seen.plan.air == null) { seen.plan.air = +d.plans[0].y.toFixed(2); seen.plan.u = +(d.gt() - m.psup.t0).toFixed(2); }
      if (k === "hit" && !seen.net) { seen.net = { dz: +(m.psup.ball.z - (d.serveSpot()[1] - d.COURT.L - 0.4)).toFixed(2), struck: m.psup.struck }; seen.u0 = m.psup.uNow; }
      else if (k === "hit") { seen.uMoved = seen.uMoved || m.psup.uNow !== seen.u0; }
      d.run(1 / 60, fire);
    }
    d.input.stick = null; ["w", "a", "s", "d"].forEach((x) => { d.input.keys[x] = false; });
    return { done: T.done, ...seen };
  }, desk);
  console.log("     steps: " + bot.steps.join(" → "));
  const at = bot.at;
  check(bot.done && ["move", "serve", "three", "each", "hit", "go", "sup"].every((k) => bot.steps.includes(k)), "the bot, copying only the screen, plays it through: move, serve, three, each, hit, sup");
  const tapW = at.serve && at.serve.items.find((x) => x.what === "tap"), tapA = at.serve && at.serve.arrows.find((a) => a.to === "tap"), mz = at.serve && at.serve.meter;
  check(tapW && tapW.t === (desk ? "press space" : "tap anywhere") && tapW.size === 26, `on the mark: "${tapW && tapW.t}", at 26 px (twice the cues' 13)`);
  check(tapA && mz && Math.abs(tapA.x - (mz.x0 + 0.78 * mz.N * mz.cw)) < 2 && tapA.ang === 1.57 && tapA.y < mz.y0, "a gold arrow pointing down at the bar's ace zone, above the bar");
  check(bot.faultTap && bot.faultTap.after === 0 && /too soft/.test(bot.faultTap.pop), `a tap in a fault's part: only "too soft", no pearl, the bar runs on (${JSON.stringify(bot.faultTap)})`);
  check(bot.spam && bot.spam.n === 1 && bot.spam.live <= 1, `a burst of taps after the serve: one pearl (${JSON.stringify(bot.spam)})`);
  const th = at.three && at.three.items.find((x) => x.what === "three");
  check(th && th.t === "serve up to three pearls at a time" && th.size === 26 && bot.frozen.three && bot.frozen.three.still, `the serve struck: the game still, "${th && th.t}"`);
  check(bot.contAt.three >= 2.95 && bot.contAt.three < 3.3 && bot.early.three, `three seconds on (${bot.contAt.three} s), "${desk ? "press space" : "tap anywhere"} to continue"; a tap before then does nothing`);
  check(bot.plan && bot.plan.ballServe && bot.plan.them === 0, "Mr Plan's first return is his super: " + JSON.stringify(bot.plan));
  const ea = at.each && at.each.items.find((x) => x.what === "each");
  check(ea && ea.t === "Each player can use one super per game" && bot.plan.u >= 0.5 && bot.plan.u < 0.7 && bot.frozen.each && bot.frozen.each.still, `just into his super (${bot.plan.u} s, in the air ${bot.plan.air} m): still, "${ea && ea.t}"`);
  check(bot.contAt.each >= 2.95 && bot.contAt.each < 3.3 && bot.early.each && /continue/.test(bot.said.each || ""), `three seconds on, "to continue" (${bot.contAt.each} s), said to a screen reader too`);
  const hw = at.hit && at.hit.items.find((x) => x.what === "hit"), ha = at.hit && at.hit.arrows.find((a) => a.to === "hit"), hm = at.hit && at.hit.meter;
  check(bot.net && bot.net.struck && bot.net.dz >= 0 && bot.net.dz < 1.5 && bot.frozen.hit && bot.frozen.hit.still && hw && hw.t === "Hit the return", `his pearl just over the net: still, "${hw && hw.t}" (${JSON.stringify(bot.net)})`);
  check(ha && hm && Math.abs(ha.x - (hm.x0 + 0.78 * hm.N * hm.cw)) < 2 && ha.ang === 1.57 && ha.y < hm.y0 && bot.uMoved, "the same gold arrow at the counter's return zone, its mark running while the game stands");
  check(bot.miss && bot.miss.still && /missed/.test(bot.miss.pop), `a tap outside the return zone: "missed", and it runs on (${JSON.stringify(bot.miss)})`);
  const cw = at.sup && at.sup.items.find((x) => x.what === "counter"), ca = at.sup && at.sup.arrows.find((a) => a.to === "super");
  check(cw && cw.t === "or use your super to counter" && ca && ca.ang === -1.57 && !at.sup.sup && at.sup.nudge, `landed, a moment on, still again: "${cw && cw.t}", a gold arrow up at the Super, the Super ready`);
  check(at.go && at.sup && at.sup.gt - at.go.gt > 0.25 && at.sup.gt - at.go.gt < 0.5, `"another split second" between (${at.sup && at.go ? (at.sup.gt - at.go.gt).toFixed(2) : "?"} s of the game)`);
  const H = bot.hands;
  check(["serve", "three", "each", "hit", "sup"].every((k) => H[k] && !H[k].early && bot.presses[k] > 0), `a tapping hand each time a touch is wanted: ${["serve", "three", "each", "hit", "sup"].map((k) => k + (H[k] ? " " + bot.presses[k] + " presses" : " none")).join(", ")}; none before "to continue"`);
  check(bot.pressBad === 0, `at the bar the hand presses only while the mark is in the gold (${bot.pressBad} not)`);
  check(bot.supHand && bot.supHand.in, "at the Super, the hand's fingertip on the button: " + JSON.stringify(bot.supHand));
  const sentences = ["move", "serve", "three", "each", "hit", "sup"].map((k) => at[k] && at[k].sr);
  check(sentences.every((t) => t && t.length > 10), "each step's sentence for a screen reader: " + sentences.map((t) => (t || "").slice(0, 22)).join(" | "));

  // the end: 1 - 0, his Super back, Mr Plan's spent, the second serve; done kept
  const end = await D(() => { const d = window.Pickleball.debug(), m = d.court.m; for (let i = 0; i < 600 && !(m.phase === "serve" && m.n >= 1); i++) { d.run(1 / 60); } d.run(0.3); d.draw(); const sc = d.hud().score; const s = JSON.parse(localStorage.getItem("pickleball-save-v1") || "{}"); return { score: sc && sc.you + "-" + sc.them, phase: m.phase, n: m.n, you: m.you, them: m.them, sup: m.sup.avail, psup: m.psup.avail, on: d.tut().on, done: d.tut().done, tut: s.tut, tips: s.tips, key: d.hud().cue.key, say: document.getElementById("say").textContent, dis: document.getElementById("super").disabled }; });
  check(end.phase === "serve" && end.n === 1 && end.you === 1 && end.them === 0 && end.sup && !end.dis && !end.psup && !end.on && end.done, `the second serve: 1 - 0, another Super, Mr Plan's spent, the walk-through over (${JSON.stringify(end)})`);
  check(end.score === "1-0", "the score at the top reads 1 - 0: " + end.score);
  check(end.tut === 1 && (end.tips & 0b1001101) === 0b1001101 && /1 – 0/.test(end.say), "done kept with the save; the words under the squares say so");
  await shot("7_after");
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const rl = await D(() => { const d = window.Pickleball.debug(); d.pause(true); d.run(0.3); return { on: d.tut().on, m: !!d.court.m }; });
  check(!rl.on && !rl.m, "a reload after it: no walk-through: " + JSON.stringify(rl));

  // the stops by hand, for their pictures and their boxes
  await fresh();
  const toStop = (want) => D((want) => {
    const d = window.Pickleball.debug(), T = d.tut(), m = d.court.m;
    for (let i = 0; i < 60 * 40 && T.stop !== want; i++) {
      d.input.stick = !m.meterOn && m.phase === "serve" ? { id: -1, x: 80, y: 700, dx: 0, dy: -50 } : null;
      let fire = false;
      if (T.card === "serve" && d.meter() != null && d.gt() >= m.meterT0) { const u = d.meter(); fire = u >= 0.74 && u <= 0.82; if (fire) { d.draw(); } }
      if ((T.stop === "three" || T.stop === "each") && d.cue().rt - T.sT > 3.05) { fire = true; }
      if (T.stop === "hit") { const u = m.psup.uNow; fire = u >= 0.74 && u <= 0.82; }
      d.run(1 / 60, fire);
    }
    d.input.stick = null; d.run(T.stop === "three" || T.stop === "each" ? 3.1 : 0.2); return T.stop;
  }, want);
  for (const [st, name] of [["serve", "2_serve"], ["three", "3_three"], ["each", "4_each"], ["hit", "5_hit"], ["sup", "6_sup"]]) {
    if (st === "serve") { await D(() => { const d = window.Pickleball.debug(), m = d.court.m; for (let i = 0; i < 400 && !m.meterOn; i++) { d.input.stick = { id: -1, x: 80, y: 700, dx: 0, dy: -50 }; d.run(1 / 60); } d.input.stick = null; d.run(0.6); }); }
    else { const got = await toStop(st); if (got !== st) { check(false, `reached ${st} by hand (at ${got})`); continue; } }
    c = await look();
    check(!c.off.length && c.items.some((x) => x.what !== "pop"), `${st}: its words up, clear of the edge, the Super and the squares ${c.off.join(" ")}`);
    await shot(name);
  }
  const pz = await D(() => { const d = window.Pickleball.debug(); d.pause(true); document.getElementById("super").click(); return d.court.m.sup.armed; });
  check(!pz, "paused, a press of the Super does nothing");
  // a court won in it ends it, nothing left standing
  const wc = await D(() => { const d = window.Pickleball.debug(); d.winCourt(); d.run(0.5); d.draw(); const pl = d.hud().pearls.find((q) => q.k === 0); return { on: d.tut().on, done: d.tut().done, stop: d.tut().stop, courts: d.courts.length, cele: pl && +pl.cele.toFixed(2), up: pl && pl.up }; });
  check(!wc.on && wc.done && !wc.stop && wc.courts === 2, "a court won in it ends it: " + JSON.stringify(wc));
  check(wc.up && wc.cele > 0 && wc.cele < 1, "and its pearl, won, celebrates (the artist, 29 Oct 2026: \"a subtle celebratory animation every time you are victorious\"): " + wc.cele);
  await D(() => localStorage.clear());
  const g = await D(() => ["tc", "last", "u", "wd", "mb", "raw", "dt", "ck", "ab", "zx", "lines"].filter((k) => k in window));
  check(!g.length, "no stray globals: " + g.join(" "));
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();
