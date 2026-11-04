// pb_garden.js - the track half a court further out, its lights, the gardens between it and the courts, the Donut
// button off on the track, and the portal (the artist, 4 Nov 2026: "Have spotlight floodlights lights along the corners
// of the track and accent linear lighting along the edges of the track. Take the donut button off when the coupe is
// driving on the track. Make the track a half a court length back and have beautiful plants and flowers fill in the
// space but in a mix style of a Japanese Gardens and Claude Monet's house garden where he painted his Lillie's ...
// make an almost invisible tunnel, like the black hole in the movie interstellar and have it be a portal ... For now have
// the portal lead to the other holographic, Mr. Pearl artifact"). With one court won and four: the track's middle line
// half a court further out; eight floodlight towers round the bends, outside the berm and inside the ground; the edges'
// light strips built; every garden stretch built, nothing of it over a court's run-off, a floodlight's pole, the track
// or the staircase; the Donut button gone with the coupe on the track and back off it (Drift stays); at the portal, on
// foot, the way through to Holographic Mr Pearl (on the site its page), gone away from it and in a match; no errors.
// node pb_garden.js [port] [phone|desk]
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
  for (const won of [0, 3]) {
    await p.goto(url);
    // (a best lap from the shorter track, before it moved out (no w): dropped; one from this track: kept)
    await p.evaluate((w) => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: w, tut: 1, tips: 255, laps: w ? { n: w + 1, w: 2, t: [70000] } : { n: 1, t: [50000, 60000] } })); }, won);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
    const g = await p.evaluate(() => {
      const d = window.Pickleball.debug(), T = d.TRK, C = d.COURT, S = d.STAIR, N = d.courts.length, xR = (N - 1) * 12, o = { N };
      d.pause(true); d.run(0.2); d.draw();
      o.R = T.R; o.inner = T.R - T.W / 2;
      const ti = d.trkMeshInfo(); o.towers = ti.towers; o.led = ti.ledX + ti.ledZ;
      // (the towers: outside the berm, inside the ground)
      o.towerBad = []; const TW = []; for (let k = 0; k < 4; k++) { const a = Math.PI * (k + 0.5) / 4, rT = T.R + T.W / 2 + T.BERM + 1.5; TW.push([xR + rT * Math.sin(a), rT * Math.cos(a)], [T.XL - rT * Math.sin(a), -rT * Math.cos(a)]); }
      TW.forEach((t) => { const dd = d.trkAt(t[0], t[1]).d; if (dd < T.W + T.BERM || t[0] < d.BOUND.x0 || t[0] > xR + d.BOUND.past || Math.abs(t[1]) > d.BOUND.z1) { o.towerBad.push(t.map((v) => +v.toFixed(1))); } });
      // (the gardens: every stretch, nothing over a run-off, a pole, the track or the staircase)
      o.laps = d.laps();
      const keys = []; for (let k = 0; k < N; k++) { keys.push("c" + k + (k === N - 1 ? "e" : "")); } keys.push("L", "R" + N);
      o.bad = []; o.plants = 0; o.withWater = 0;
      keys.forEach((k) => {
        const ch = d.gdnChunk(k); if (ch.water) { o.withWater++; } o.plants += ch.foot.length;
        ch.foot.forEach((f) => {
          const [x, z, r] = f, td = d.trkAt(x, z).d;
          const where = k + " " + x.toFixed(1) + "," + z.toFixed(1);
          if (Math.abs(z) - r < C.L + 3.5 + 0.3 && x > -C.GAP / 2 - 0.5 && x < xR + C.GAP / 2 + 0.5) { o.bad.push("run-off " + where); }
          if (td + r > -0.05) { o.bad.push("track " + where); }
          const sd = Math.hypot(x - S.c[0], z - S.c[1]); if (sd - r < S.R1 + 0.3) { o.bad.push("stairs " + where); }
          for (let j = 0; j <= N; j++) { if (Math.hypot(x - (j - 0.5) * 12, Math.abs(z) - (C.L + 4)) < r + 0.2) { o.bad.push("pole " + where); } }
          const m = /^c(\d+)/.exec(k); if (m && z > 11.3 && z < 14.1 && Math.abs(x - +m[1] * 12) < 2) { o.bad.push("behind the court's middle " + where); }   // (the arch at the walk's end, off the cameras' line)
        });
        (ch.flats || []).forEach((f) => { [[f[0], f[1]], [f[2], f[1]], [f[2], f[3]], [f[0], f[3]]].forEach((q) => { if (d.trkAt(q[0], q[1]).d > -0.05) { o.bad.push("flat on the track " + k + " " + q.map((v) => v.toFixed(2)).join(",")); } }); });
      });
      o.bad = o.bad.slice(0, 5);
      return o;
    });
    check(Math.abs(g.R - (18.5 + 6.705)) < 1e-6 && g.inner > 21, `${g.N} court(s): the track half a court further out (its middle line ${g.R.toFixed(2)} m out, its inner edge ${g.inner.toFixed(1)} m)`);
    check(g.towers === 8 && !g.towerBad.length && g.led > 0, `eight floodlight towers round the bends, outside the berm and inside the ground ${JSON.stringify(g.towerBad)}; the edges' light strips (${g.led} vertices)`);
    check(g.plants > 200 * g.N && g.withWater >= g.N, `the gardens: ${g.plants} plants and stones, water in every stretch but none short`);
    check(!g.bad.length, `nothing of them over a court's run-off, a pole, the track (beds and walks too) or the staircase, nor behind a court's middle ${JSON.stringify(g.bad)}`);
    check(won ? g.laps && g.laps.t[0] === 70000 : g.laps === null, `the best laps: ${won ? "this track's kept" : "the shorter track's dropped"} (${JSON.stringify(g.laps)})`);
  }

  // the Donut button: off with the coupe on the track, back off it; the Drift stays
  const dn = await p.evaluate(() => {
    const d = window.Pickleball.debug(), c = d.car, T = d.TRK, o = {}, vis = (id) => { const e = document.getElementById(id); return !e.hidden && getComputedStyle(e).display !== "none"; };
    d.me.x = c.x + 1.6; d.me.z = c.z; d.run(0.05); d.rideToggle(); d.run(0.1);
    c.x = 0; c.z = T.R; c.yaw = Math.PI / 2; c.vh = c.yaw; c.v = 16; d.run(0.1); o.onTrack = { donut: vis("donut"), drift: vis("drift"), d: +d.trkAt(c.x, c.z).d.toFixed(1) };
    c.x = 0; c.z = 15; c.v = 10; d.run(0.1); o.offTrack = { donut: vis("donut"), drift: vis("drift"), d: +d.trkAt(c.x, c.z).d.toFixed(1) };
    c.x = d.PORTAL.c[0] + 0.4; c.z = d.PORTAL.c[2]; c.v = 0; d.run(0.2); o.portalInCar = vis("portal"); c.x = 0; c.z = 15; d.run(0.1);
    c.v = 0; d.run(0.2); d.rideToggle(); d.run(0.2); return o;
  });
  check(!dn.onTrack.donut && dn.onTrack.drift, `the coupe on the track: no Donut button, the Drift there (${JSON.stringify(dn.onTrack)})`);
  check(dn.offTrack.donut && dn.offTrack.drift, `off it again: the Donut button back (${JSON.stringify(dn.offTrack)})`);
  check(!dn.portalInCar, "the coupe at the portal: no way through (it is for him on foot)");

  // the portal: on foot in it, the way through; away, gone; in a match, gone
  const pt = await p.evaluate(() => {
    const d = window.Pickleball.debug(), P = d.PORTAL, a = document.getElementById("portal"), vis = () => !a.hidden && getComputedStyle(a).display !== "none", o = {};
    d.me.x = 0; d.me.z = 12; d.run(0.2); o.away = vis();
    d.me.x = P.c[0] + 0.5; d.me.z = P.c[2]; d.run(0.2); o.at = vis(); o.href = a.href; o.text = a.textContent; o.target = a.target; o.say = document.getElementById("say").textContent;
    const r = a.getBoundingClientRect(); o.box = [r.left, r.top, r.width, r.height]; o.W = innerWidth; o.H = innerHeight;
    return o;
  });
  // (the keyboard's way: the link focused, Enter opens it)
  await p.focus("#portal");
  const pop = await Promise.all([p.context().waitForEvent("page", { timeout: 8000 }).catch(() => null), p.keyboard.press("Enter")]).then((r) => r[0]);
  pt.enter = !!pop; if (pop) { await pop.close(); }
  Object.assign(pt, await p.evaluate(() => {
    const d = window.Pickleball.debug(), P = d.PORTAL, a = document.getElementById("portal"), vis = () => !a.hidden && getComputedStyle(a).display !== "none", o = {};
    d.me.x = 0; d.me.z = 12; d.run(0.2); o.after = vis();
    d.enter(d.courts.length - 1); d.run(0.3); d.me.x = P.c[0]; d.me.z = P.c[2]; d.run(0.1); o.match = vis() && !!d.court.m;
    return o;
  }));
  check(!pt.away && pt.at && /\/worlds\/rocket\/index\.html$/.test(pt.href) && pt.target === "_blank" && /Holographic Mr Pearl/.test(pt.text), `in the portal, on foot: the way through to Holographic Mr Pearl (on the site its page: ${pt.href}); away from it, none`);
  check(pt.box[0] >= 8 && pt.box[0] + pt.box[2] <= pt.W - 8 && pt.box[3] >= 44 && /portal/i.test(pt.say), `the way through inside the screen, a finger's height ${JSON.stringify(pt.box)}, and said ("${pt.say}")`);
  check(pt.enter, "the way through by the keyboard: focused, Enter opens it");
  check(!pt.after && !pt.match, "left behind: gone; in a match: gone");
  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
