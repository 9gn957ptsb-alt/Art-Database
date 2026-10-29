// pb_super.js - the super return (the artist, 28 Oct 2026: "I want a button in the top right corner that allows you to
// use your superpower and automatically win the point"). The button in the top right while a match is on; a press wins
// the point it is used in, once a game, from the serve, in a rally of one pearl and in a rally of three (the other two
// held, then played on); pictures through it. node pb_super.js outdir [port] [phone|desk]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [out, port, kind] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const VIEW = kind === "desk" ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const D = (f, a) => p.evaluate(f, a);
  await D(() => window.Pickleball.debug().pause(true));
  const btn = () => D(() => { const e = document.getElementById("super"), r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { shown: cs.display !== "none", disabled: e.disabled, pressed: e.getAttribute("aria-pressed"), x: r.left, y: r.top, w: r.width, h: r.height, W: innerWidth, H: innerHeight }; });
  // (the game is paused for the stepping, and paused it takes no input: running for the press, as a player presses it)
  const press = async () => { await D(() => window.Pickleball.debug().pause(false)); await p.click("#super"); await D(() => window.Pickleball.debug().pause(true)); };
  let q = await btn();
  check(!q.shown, "off the courts the button is not there");
  await D(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(0.6); d.draw(); });
  q = await btn();
  check(q.shown && !q.disabled, "on a court it is there and ready");
  check(q.x + q.w > q.W - 40 && q.y < 40 && q.w >= 44 && q.h >= 44, "in the top right corner, a finger's size: " + JSON.stringify(q));
  const where = await D(() => { const d = window.Pickleball.debug(); d.draw(); const r = d.hud().strip, s = document.getElementById("super").getBoundingClientRect(); return { right: r.x + r.w, sl: s.left }; });
  check(where.right <= where.sl, "the courts' squares at the top stop short of it: " + JSON.stringify(where));

  // 1. at the serve: a press, and the point is his
  const one = async (label, setup) => {
    const r0 = await D(setup);
    await press();
    const r = await D((label) => {
      const d = window.Pickleball.debug(), m = d.court.m, y0 = m.you, t0 = m.them, live0 = m.balls.filter((z) => !z.dead).length;
      d.run(1 / 60);
      const started = m.phase === "super", sp = m.sup, others = m.balls.filter((z) => !z.dead && z !== sp.ball).map((z) => [z.x, z.y, z.z]);
      let maxY = 0, peak = 0, held = true;
      for (let i = 0; i < 60 * 3 && m.phase === "super"; i++) {
        d.run(1 / 60); maxY = Math.max(maxY, d.me.y);
        const o = m.balls.filter((z) => !z.dead && z !== sp.ball);
        o.forEach((z, j) => { if (others[j] && Math.hypot(z.x - others[j][0], z.y - others[j][1], z.z - others[j][2]) > 1e-6) { held = false; } });
        if (m.sup.struck && !peak) { peak = 1; }
      }
      return { label, started, maxY: +maxY.toFixed(2), struck: !!m.sup.struck, you: m.you - y0, them: m.them - t0, phase: m.phase, avail: m.sup.avail, live0, liveAfter: m.balls.filter((z) => !z.dead).length, held, say: document.getElementById("say").textContent.slice(0, 60) };
    }, label);
    return { r0, r };
  };
  let res = await one("serve", () => { const d = window.Pickleball.debug(); d.run(0.2); return d.court.m.phase; });
  check(res.r.started && res.r.struck && res.r.you === 1 && res.r.them === 0, "at the serve: a press, the super return, the point his: " + JSON.stringify(res.r));
  check(res.r.maxY > 3.5, "he leaps high: " + res.r.maxY + " m");
  q = await btn();
  check(q.shown && q.disabled, "spent: the button there but not to be pressed until the next game");
  const again = await D(() => { const d = window.Pickleball.debug(); d.court.m.sup.armed = false; return d.court.m.sup.avail; });
  check(again === false, "once a game");
  // 2. a new game: a new one; in a rally of three pearls, the other two held while it plays, then played on
  await D(() => { const d = window.Pickleball.debug(); d.newSuper(); d.run(1.6); });
  const r3 = await D(() => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me; let m = d.court.m, lastFire = -99;
    for (let i = 0; i < 60 * 20; i++) {
      m = d.court.m; if (!m) { break; }
      let tx = 0.6, tz = C.L - 1.2; if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 3)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }   // (on the mark while it serves: off it the serve is over)
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 3 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire);
      if (m.balls.filter((z) => !z.dead).length === 3 && m.balls.some((z) => !z.dead && z.last === "them")) { d.input.stick = null; return { ok: true, phase: m.phase }; }
    }
    d.input.stick = null; return { ok: false };
  });
  check(r3.ok, "three pearls in play, one on its way to him");
  if (r3.ok) {
    res = await one("rally of three", () => 0);
    check(res.r.started && res.r.you + res.r.them >= 1 && res.r.you >= 1, "in a rally of three: the point his: " + JSON.stringify(res.r));
    check(res.r.held, "the other pearls held where they were while it played");
    check(res.r.liveAfter >= 1 && res.r.phase === "rally", "and played on after it");
  }
  // 3. pictures through it (a fresh game, at the serve): the gathering, the leap, the strike, the comet, the landing
  await D(() => {
    const d = window.Pickleball.debug();
    for (let i = 0; i < 2400; i++) { const m = d.court.m; if (!m) { d.enter(d.courts.length - 1); d.run(0.6); continue; } if (m.phase === "serve" && !m.balls.some((z) => !z.dead)) { break; } d.run(1 / 60); }
    d.run(0.3); d.newSuper();
  });
  await press();
  const times = [0.25, 0.9, 1.34, 1.55, 1.75, 2.3];
  let tPrev = 0;
  for (const t of times) {
    await D((dt) => { const d = window.Pickleball.debug(); d.run(dt); d.draw(); }, t - tPrev); tPrev = t;
    await p.screenshot({ path: `${out}/super_${String(t.toFixed(2)).replace(".", "_")}.png` });
  }
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();
