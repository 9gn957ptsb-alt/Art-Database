// pb_replay.js - the courts won play again what was played (the artist, 28 Oct 2026: "Make sure that the games that are
// repeating are repeating the actual motions of the game in which you won"). The ideal player plays court one until it
// is won, keeping where he and Mr Plan were every frame and the stroke each was in; then, the court won, for 20 s of its
// loop, his stand-in and its Mr Plan must be where they were then (the recording is 20 a second, so between its
// frames a little apart), in the same stroke, with its pearls and its score. node pb_replay.js [port]
const { chromium } = require("playwright");
const [port] = process.argv.slice(2);
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT, me = d.me, pl = d.plans[0]; d.pause(true);
    d.enter(0); d.run(0.5);
    const log = []; let lastFire = -99, won = false;
    for (let i = 0; i < 60 * 240 && !won; i++) {
      const m = d.court.m; if (!m) { won = true; break; }
      let tx = 0.6, tz = C.L - 1.2;
      if (m.phase === "serve" && !m.meterOn) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 2 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire);
      log.push([d.gt(), me.x, me.z, pl.x, pl.z, me.move, pl.move]);
    }
    d.input.stick = null;
    if (!won) { return { won: false }; }
    const cv = d.courts[0], R = cv.rec;
    if (!R) { return { won: true, rec: false }; }
    // the log's place at an original time (linear between its frames)
    const at = (t, j) => { let lo = 0, hi = log.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (log[mid][0] <= t) { lo = mid; } else { hi = mid; } } const a = log[lo], c = log[hi], u = c[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (c[0] - a[0]))) : 0; return [a[j] + (c[j] - a[j]) * u, a[j + 1] + (c[j + 1] - a[j + 1]) * u, a[j >= 3 ? 6 : 5]]; };
    let maxE = 0, sumE = 0, n = 0, sameMove = 0, moves = 0, pearlsSeen = 0, scores = new Set(), maxEp = 0;
    const st = d.stands[0];
    for (let i = 0; i < 60 * 20; i++) {
      d.run(1 / 60);
      const T = st.replayT; if (T == null) { continue; }
      const e = at(T, 1), ep = at(T, 3), err = Math.hypot(st.x - e[0], st.z - e[1]), errp = Math.hypot(pl.x - ep[0], pl.z - ep[1]);
      maxE = Math.max(maxE, err); maxEp = Math.max(maxEp, errp); sumE += err; n++;
      if (e[2]) { moves++; if (st.move === e[2]) { sameMove++; } }
      pearlsSeen += (cv.rp || []).length > 0 ? 1 : 0; scores.add(cv.you + "-" + cv.them);
    }
    return { won: true, rec: true, frames: R.count, dur: +R.dur.toFixed(1), bursts: R.fx.length, n, maxE: +maxE.toFixed(3), meanE: +(sumE / Math.max(1, n)).toFixed(4), maxEplan: +maxEp.toFixed(3), sameMove, moves, pearlsSeen, scores: [...scores].slice(0, 8) };
  });
  console.log(JSON.stringify(r));
  check(r.won && r.rec, "court one won, and its match kept");
  if (r.rec) {
    check(r.maxE < 0.25 && r.meanE < 0.05, `his stand-in where he was (largest gap ${r.maxE} m, mean ${r.meanE} m over ${r.n} frames)`);
    check(r.maxEplan < 0.25, `its Mr Plan where he was (largest gap ${r.maxEplan} m)`);
    check(r.moves === 0 || r.sameMove >= 0.9 * r.moves, `in the same strokes (${r.sameMove} of ${r.moves} frames in a stroke)`);
    check(r.pearlsSeen > 0, `its pearls in play (${r.pearlsSeen} frames)`);
    check(r.scores.length > 1, "its score as it went: " + r.scores.join(" "));
  }
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();
