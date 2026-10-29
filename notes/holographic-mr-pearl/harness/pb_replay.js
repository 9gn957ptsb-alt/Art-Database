// pb_replay.js - the courts won play again what was played (the artist, 28 Oct 2026: "Make sure that the games that are
// repeating are repeating the actual motions of the game in which you won"). The ideal player plays court one until it
// is won, keeping where he and Mr Plan were every frame and the stroke each was in; then, the court won, for 20 s of its
// loop, his stand-in and its Mr Plan must be where they were then (the recording is 20 a second, so between its
// frames a little apart), in the same stroke at the same stride, with its pearls where they were and its score as it was
// then. And kept (the artist, 29 Oct 2026: "I want the games that you have won to save even when I go out of the
// artifact so they are always replaying"): the save holds the match; after a reload the court plays the same match again
// (where they were, in the same strokes, its score); twenty matches in a save: the newest twelve come back, the save under
// 3 MiB. node pb_replay.js [port]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port] = process.argv.slice(2);
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
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
      if ((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < 2)) { const s = d.serveSpot(); tx = s[0]; tz = s[1]; }
      const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0]; if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
      const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
      d.input.stick = L > 0.1 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
      const u = d.meter(), fire = u != null && u >= 0.45 && u <= 0.66 && (m.served + m.tosses.length) < 2 && i - lastFire > 12; if (fire) { lastFire = i; }
      d.run(1 / 60, fire);
      const m2 = d.court.m || m, gt = d.gt();
      log.push([gt, me.x, me.z, pl.x, pl.z, me.move, pl.move, me.stepL, pl.stepL, m2.balls.filter((q) => !q.dead || gt - q.deadT <= 0.3).map((q) => [q.x, q.y, q.z]), m2.you + "-" + m2.them]);
    }
    d.input.stick = null;
    if (!won) { return { won: false }; }
    const cv = d.courts[0], R = cv.rec;
    if (!R) { return { won: true, rec: false }; }
    // the log's place at an original time (linear between its frames)
    const at = (t, j) => { let lo = 0, hi = log.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (log[mid][0] <= t) { lo = mid; } else { hi = mid; } } const a = log[lo], c = log[hi], u = c[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (c[0] - a[0]))) : 0; return [a[j] + (c[j] - a[j]) * u, a[j + 1] + (c[j + 1] - a[j + 1]) * u, a[j >= 3 ? 6 : 5]]; };
    const near = (t) => { let lo = 0, hi = log.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (log[mid][0] <= t) { lo = mid; } else { hi = mid; } } return log[lo]; };
    let maxE = 0, sumE = 0, n = 0, sameMove = 0, moves = 0, pearlsSeen = 0, scores = new Set(), maxEp = 0;
    const fx0 = d.fx().length; let fxMore = 0, fxPrev = fx0;
    let strideSum = 0, strideN = 0, fast = 0, fastLong = 0, pearlN = 0, pearlSum = 0, pearlFar = 0, scoreOff = 0;
    const st = d.stands[0], samples = [];
    for (let i = 0; i < 60 * 20; i++) {
      d.run(1 / 60);
      const T = st.replayT;
      if (T != null) { samples.push([T, st.x, st.z, pl.x, pl.z, st.move ? st.move.kind + "@" + st.move.tc.toFixed(2) : "", cv.you + "-" + cv.them]); } const nf = d.fx().length; if (nf > fxPrev) { fxMore++; } fxPrev = nf; if (T == null) { continue; }
      const e = at(T, 1), ep = at(T, 3), err = Math.hypot(st.x - e[0], st.z - e[1]), errp = Math.hypot(pl.x - ep[0], pl.z - ep[1]);
      maxE = Math.max(maxE, err); maxEp = Math.max(maxEp, errp); sumE += err; n++;
      if (e[2]) { moves++; if (st.move === e[2]) { sameMove++; } }
      pearlsSeen += (cv.rp || []).length > 0 ? 1 : 0; scores.add(cv.you + "-" + cv.them);
      // the stride: as long as it was then (a sprint replayed with a walk's steps slides its feet)
      const L0 = near(T); strideSum += Math.abs(st.stepL - L0[7]) + Math.abs(pl.stepL - L0[8]); strideN += 2; if (L0[7] > 1) { fast++; if (st.stepL > 0.8) { fastLong++; } }
      // each pearl shown: by one that was in play then (a bounce between the recording's frames cuts its corner)
      (cv.rp || []).forEach((q) => { const ds = L0[9].concat(near(T + 1 / 60)[9]).map((b) => Math.hypot(q[0][0] - b[0], q[0][1] - b[1], q[0][2] - b[2])); const e = ds.length ? Math.min(...ds) : 9; pearlN++; pearlSum += e; if (e > 0.75) { pearlFar++; } });
      // the score: as it stood then (at a change, either side of it)
      const sc = cv.you + "-" + cv.them; if (sc !== L0[10] && sc !== near(T - 0.06)[10] && sc !== near(T + 0.06)[10]) { scoreOff++; }
    }
    return { won: true, rec: true, frames: R.count, dur: +R.dur.toFixed(1), bursts: R.fx.length, n, maxE: +maxE.toFixed(3), meanE: +(sumE / Math.max(1, n)).toFixed(4), maxEplan: +maxEp.toFixed(3), sameMove, moves, pearlsSeen, scores: [...scores].slice(0, 8),
             strideMean: +(strideSum / Math.max(1, strideN)).toFixed(3), fast, fastLong, pearlN, pearlMean: +(pearlSum / Math.max(1, pearlN)).toFixed(3), pearlFar, scoreOff, fxMore, samples };
  });
  const samples = r.samples || []; delete r.samples;
  console.log(JSON.stringify(r));
  check(r.won && r.rec, "court one won, and its match kept");
  if (r.rec) {
    check(r.maxE < 0.25 && r.meanE < 0.05, `his stand-in where he was (largest gap ${r.maxE} m, mean ${r.meanE} m over ${r.n} frames)`);
    check(r.maxEplan < 0.25, `its Mr Plan where he was (largest gap ${r.maxEplan} m)`);
    check(r.moves === 0 || r.sameMove >= 0.9 * r.moves, `in the same strokes (${r.sameMove} of ${r.moves} frames in a stroke)`);
    check(r.strideMean < 0.05 && r.fastLong >= 0.95 * r.fast, `at the same stride (mean gap ${r.strideMean} m; at a run, ${r.fastLong} of ${r.fast} frames in long strides)`);
    check(r.pearlsSeen > 0 && r.pearlMean < 0.1 && r.pearlFar <= 0.02 * r.pearlN, `its pearls where they were (${r.pearlN} shown, mean gap ${r.pearlMean} m, ${r.pearlFar} over 0.75 m)`);
    check(r.bursts > 0 && r.fxMore > 0, `its bursts kept (${r.bursts}) and bursting again in the loop (${r.fxMore} frames with new sparks)`);
    check(r.scores.length > 1 && r.scoreOff === 0, `its score as it went (${r.scoreOff} frames off): ` + r.scores.join(" "));
  }
  // kept: in the save, and played again after a reload
  if (r.rec) {
    const sv = await p.evaluate(() => { const d = window.Pickleball.debug(); d.state(); const s = localStorage.getItem("pickleball-save-v1") || "{}", o = JSON.parse(s); return { len: s.length, keys: Object.keys(o.recs || {}), one: o.recs && o.recs["0"] ? JSON.stringify(o.recs["0"]).length : 0 }; });
    check(sv.keys.includes("0") && sv.len < 512000, `the save holds court one's match (${sv.one} characters for ${r.frames} frames; the save ${sv.len})`);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    const back = await p.evaluate((samples) => {
      const d = window.Pickleball.debug(); d.pause(true); const cv = d.courts[0], st = d.stands[0], pl = d.plans[0];
      if (!cv.rec || !cv.won) { return { rec: false }; }
      const find = (t) => { let lo = 0, hi = samples.length - 1; while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (samples[mid][0] <= t) { lo = mid; } else { hi = mid; } } return [lo, hi]; };
      const at = (t, j) => { const [lo, hi] = find(t), a = samples[lo], c = samples[hi], u = c[0] > a[0] ? Math.max(0, Math.min(1, (t - a[0]) / (c[0] - a[0]))) : 0; return [a[j] + (c[j] - a[j]) * u, a[j + 1] + (c[j + 1] - a[j + 1]) * u]; };
      let maxE = 0, n = 0, moves = 0, same = 0, scoreOff = 0;
      for (let i = 0; i < 60 * 20; i++) {
        d.run(1 / 60); const T = st.replayT;
        if (T == null || T < samples[0][0] || T > samples[samples.length - 1][0]) { continue; }
        const e = at(T, 1), ep = at(T, 3); maxE = Math.max(maxE, Math.hypot(st.x - e[0], st.z - e[1]), Math.hypot(pl.x - ep[0], pl.z - ep[1])); n++;
        const [lo, hi] = find(T), mv = st.move ? st.move.kind + "@" + st.move.tc.toFixed(2) : "";
        if (samples[lo][5] || samples[hi][5]) { moves++; if (mv === samples[lo][5] || mv === samples[hi][5]) { same++; } }
        const sc = cv.you + "-" + cv.them; if (sc !== samples[lo][6] && sc !== samples[hi][6]) { scoreOff++; }
      }
      return { rec: true, frames: cv.rec.count, n, maxE: +maxE.toFixed(4), moves, same, scoreOff };
    }, samples);
    check(back.rec && back.frames === r.frames, `after a reload court one still has its match (${back.frames} frames)`);
    check(back.n > 600 && back.maxE < 0.02, `and plays it again where they were (${back.n} frames, the largest gap ${back.maxE} m)`);
    check(back.moves === 0 || back.same >= 0.95 * back.moves, `in the same strokes (${back.same} of ${back.moves})`);
    check(back.scoreOff === 0, `with its score as it went (${back.scoreOff} frames off)`);
    // twenty matches in a save (as an older version kept): the newest twelve come back, and the save written again keeps
    // only the newest that fit under 500 KiB (the artist, 29 Oct 2026: "Cap it then at 500 KiB")
    const put = await p.evaluate(() => { const o = JSON.parse(localStorage.getItem("pickleball-save-v1")), r0 = o.recs["0"]; o.won = 20; o.recs = {}; for (let k = 0; k < 20; k++) { o.recs[k] = r0; } const s = JSON.stringify(o); try { localStorage.setItem("pickleball-save-v1", s); return s.length; } catch (e) { return -1; } });
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    const bg = await p.evaluate(() => { const d = window.Pickleball.debug(); d.pause(true); const kept = d.courts.filter((c) => c.rec).map((c) => c.k), s = d.state(); return { kept, len: s.length, saved: Object.keys(JSON.parse(s).recs).map(Number).sort((a, b) => a - b) }; });
    check(put > 0 && bg.kept.length === 12 && bg.kept[0] === 8 && bg.kept[11] === 19, `twenty in a save (${put} characters): the newest twelve come back (${bg.kept.join(" ")})`);
    check(bg.len < 512000 && bg.saved.length > 0 && bg.saved.every((k, i) => k === 20 - bg.saved.length + i), `the save under 500 KiB: the newest that fit (${bg.len} characters, ${bg.saved.length} matches: ${bg.saved.join(" ")})`);
    await p.evaluate(() => localStorage.clear());
  }
  check(!errs.length, "no errors: " + errs.slice(0, 2).join(" | "));
  console.log(bad ? bad + " FAILED" : "all ok");
  await b.close(); process.exit(bad ? 1 : 0);
})();
