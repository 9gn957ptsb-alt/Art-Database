// pb_multi.js - the serve of two or three pearls (the artist, 28 Oct 2026: "Make sure that when I serve two or three
// balls, each ball counts as its own point and both players must play both balls"). The ideal player (pb_curve's: on
// the ring of the pearl that comes soonest) serves N pearls every serve; for every pearl it counts who struck it and
// how it ended, and for every point that the score moved by exactly one. A pearl that ends without the other side
// having gone for it (no stroke planned on it, not a fault of the side that struck it last), while two or more were in
// play, is "unplayed" (one pearl alone the player runs to: missing it is the game).
// node pb_multi.js [port] [pearls per serve] [courts...]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [port, nArg, ...ls] = process.argv.slice(2);
const NB = +(nArg || 3), LEVELS = ls.length ? ls.map(Number) : [1, 5, 10];
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await p.evaluate(() => window.Pickleball.debug().pause(true));
  let bad = 0;
  for (const level of LEVELS) {
    const r = await p.evaluate(({ level, NB }) => {
      const d = window.Pickleball.debug(), C = d.COURT, me = d.me, out = { level, balls: 0, unplayedByPlan: 0, unplayedByMe: 0, planStrokes: 0, myStrokes: 0, pointsYou: 0, pointsThem: 0, miscounts: 0, ends: {}, notes: [] };
      const begin = () => { d.enter(d.courts.length - 1); d.run(0.4); const m = d.court.m; m.level = level; m.sk = d.skill(level); return m; };
      const spot = () => (d.serveSpot ? d.serveSpot() : null);
      let m = begin(), seen = new Map(), lastFire = -99, last = [m.you, m.them], said = "", lastM = m;   // (a match the last court left on goes on: its score so far)
      for (let i = 0; i < 60 * 300; i++) {
        if (!d.court.m) { m = begin(); last = [m.you, m.them]; lastM = m; }
        m = d.court.m;
        // where to stand: the serve mark at the serve (when the game has one to run to), else the ring of the pearl that comes soonest
        let tx = 0.6, tz = C.L - 1.2;
        if (((m.phase === "serve" && !m.meterOn) || (m.meterOn && m.served + m.tosses.length < NB)) && spot()) { const s = spot(); tx = s[0]; tz = s[1]; }   // (and on it while there are pearls to serve)
        const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark).sort((a, c) => (a.mark.t || 0) - (c.mark.t || 0))[0];
        if (inc) { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
        const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
        d.input.stick = L > 0.08 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 1.5), dy: dz / L * 60 * Math.min(1, L / 1.5) } : null;
        const u = d.meter();
        let fire = u != null && u >= 0.4 && u <= 0.66 && (m.served + m.tosses.length) < NB && i - lastFire > 12;
        if (m.phase === "plansuper") { fire = u != null && Math.abs(u - (d.SERVE.ACE[0] + d.SERVE.ACE[1]) / 2) < 0.02; }   // (Mr Plan's super: the counter, in the ace zone)
        if (fire) { lastFire = i; }
        // what each pearl has seen: strokes planned on it, strokes made
        // (a pearl already ended when first seen was counted then)
        m.balls.forEach((q) => { if (!seen.has(q)) { seen.set(q, { planTried: false, meTried: false, planHits: 0, myHits: 0, last: q.last, dead: q.dead, counted: q.dead, multi: null }); out.balls++; } });
        d.run(1 / 60, fire);
        const m2 = d.court.m || m;
        if (m2.nc && seen.has(m2.nc.ball)) { seen.get(m2.nc.ball).planTried = true; }
        if (m2.pc && seen.has(m2.pc.ball)) { seen.get(m2.pc.ball).meTried = true; }
        seen.forEach((v, q) => { if (!q.dead && q.last === "you" && m2.nc && m2.nc.ball !== q) { v.planBusy = "was busy with #" + m2.nc.ball.id; } if (!q.dead && q.last === "them" && m2.pc && m2.pc.ball !== q) { v.meBusy = "was busy with #" + m2.pc.ball.id; } });
        const s = document.getElementById("say").textContent;
        seen.forEach((v, q) => {
          if (q.last !== v.last) { if (q.last === "them") { v.planHits++; out.planStrokes++; v.meTried = false; } else { v.myHits++; out.myStrokes++; v.planTried = false; } v.last = q.last; v.multi = m2.balls.filter((z) => !z.dead).length > 1; v.b = 0; }
          // (and whether it is still so when it comes down on the far side: a pearl alone by then is a rally of one)
          if (q.bounces !== (v.b || 0)) { if (q.bounces === 1) { v.multi = v.multi && m2.balls.filter((z) => !z.dead).length > 1; } v.b = q.bounces; }
          if (q.dead && !v.dead) {
            v.dead = true;
            if (q.cleared) { return; }   // (the match decided by another pearl: this one goes without a point)
            const why = s.split(".")[0].replace(/[0-9]+/g, "#").slice(0, 34);
            out.ends[why] = (out.ends[why] || 0) + 1;
            // unplayed: it was struck to a side that never went for it, and it did not end as the striker's fault
            const fault = /net|out|long|kitchen|fault/i.test(s.split(".")[0]);
            const busy = (who) => (who && who.ball !== q ? "busy with #" + who.ball.id : who ? "on it" : "free");
            if (!fault && q.last === "you" && !v.planTried && !q.ace && v.multi !== false && !/Super|super/.test(s)) { out.unplayedByPlan++; if (out.notes.length < 8) { out.notes.push("plan never went for #" + q.id + " (rally " + q.rally + ", serve " + !!q.serve + ", plan " + (v.planBusy || "free") + ", live " + m2.balls.filter((z) => !z.dead).length + ")"); } }
            if (!fault && q.last === "them" && !v.meTried && v.multi && !/Super|super/.test(s)) {   // (Mr Plan's super return is met by the bar, not by running)
              out.unplayedByMe++; if (out.notes.length < 8) { out.notes.push("he never went for #" + q.id + " (rally " + q.rally + ", he " + (v.meBusy || "free") + ")"); } }
            void busy;
          }
        });
        // every pearl that ends is one point, and only one: the points this frame against the pearls ended this frame (the
        // point that decides a match clears the pearls still up, without points)
        let ended = 0; seen.forEach((v) => { if (v.dead && !v.counted) { v.counted = true; ended++; } });
        const mm = d.court.m;
        if (mm && mm === lastM && mm.you + mm.them >= last[0] + last[1]) {
          const dy = mm.you - last[0], dt = mm.them - last[1], decided = (mm.you >= C.WIN || mm.them >= C.WIN) && dy + dt > 0;
          out.pointsYou += dy; out.pointsThem += dt;
          if (decided ? dy + dt !== 1 : dy + dt !== ended) { out.miscounts++; if (out.notes.length < 8) { out.notes.push("at " + d.gt().toFixed(2) + ": " + ended + " pearls ended, the score moved " + (dy + dt)); } }
        }
        last = mm ? [mm.you, mm.them] : [0, 0]; lastM = mm;
      }
      return out;
    }, { level, NB });
    console.log(JSON.stringify(r));
    r.youShare = (100 * r.pointsYou / Math.max(1, r.pointsYou + r.pointsThem)).toFixed(0) + "%";
    if (r.unplayedByPlan > 0 || r.unplayedByMe > 0 || r.miscounts > 0) { bad++; }
  }
  console.log(errs.length ? "ERRORS " + errs.slice(0, 2).join(" | ") : "no errors");
  console.log(bad ? "NOT OK: a pearl one side never went for, or a pearl that did not count as exactly one point" : "all ok");
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})();
