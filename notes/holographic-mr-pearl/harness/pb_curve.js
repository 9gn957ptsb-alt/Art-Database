// pb_curve.js - how hard each court is (28 Oct 2026; the artist: "each court gets progressively harder. By the time you
// get to court 10, the game should be very hard"). Two players run the courts: the ideal one (pb_game's bot: always on
// the ring Mr Plan's shot comes down to, serving hard or into the ace zone) and a human one (it reads the ring a fifth of
// a second late, stands up to 0.9 m off it, and stops the serve's bar with a tenth of a second's slack). For each court
// it plays matches and counts points and matches won. node pb_curve.js [port] [matches] [courts...]
const { chromium } = require("playwright");
const [port, nArg, ...ls] = process.argv.slice(2);
const N = +(nArg || 6), LEVELS = ls.length ? ls.map(Number) : [1, 2, 3, 5, 7, 10, 13, 16, 20];
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 } }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await p.evaluate(() => window.Pickleball.debug().pause(true));
  const rows = [];
  for (const level of LEVELS) {
    for (const who of ["ideal", "human"]) {
      const r = await p.evaluate(({ level, who, N }) => {
        const d = window.Pickleball.debug(), C = d.COURT, me = d.me, out = { level, who, pts: 0, won: 0, mw: 0, ml: 0, why: {} };
        let seed = level * 7919 + (who === "human" ? 1 : 0); const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const begin = () => { const k = d.courts.length - 1; d.enter(k); d.run(0.4); const m = d.court.m; m.level = level; m.sk = d.skill(level); return m; };
        let m = begin(), last = [0, 0], seen = { t: -9, x: 0, z: 0 }, serves = 0, lastFire = -99, said = "";
        for (let i = 0; i < 60 * 900 && out.mw + out.ml < N; i++) {
          if (!d.court.m) { m = begin(); last = [0, 0]; }
          m = d.court.m;
          let tx = 0.6, tz = C.L - 1.2;
          const inc = m.balls.filter((q) => !q.dead && q.last === "them" && q.mark)[0];
          if (inc) {
            if (who === "ideal") { tx = inc.mark.x - 0.5; tz = inc.mark.z + 1.2; }
            else { if (d.gt() - seen.t > 0.2 || seen.id !== inc.id) { if (seen.id !== inc.id) { seen.read = d.gt() + 0.2; } seen.id = inc.id; seen.t = d.gt(); seen.x = inc.mark.x - 0.5 + (rnd() - 0.5) * 1.8; seen.z = inc.mark.z + 1.2 + (rnd() - 0.5) * 1.8; }
                   if (d.gt() >= seen.read) { tx = seen.x; tz = seen.z; } else { tx = me.x; tz = me.z; } }
          }
          const dx = tx - me.x, dz = tz - me.z, L = Math.hypot(dx, dz);
          d.input.stick = L > 0.2 ? { id: -1, x: 0, y: 0, dx: dx / L * 60 * Math.min(1, L / 2), dy: dz / L * 60 * Math.min(1, L / 2) } : null;
          const u = d.meter(), want = 1 + (serves % 3), slack = who === "human" ? 0.1 : 0;
          const stopAt = serves % 2 ? [d.SERVE.ACE[0] + 0.01 - slack, d.SERVE.ACE[1] - 0.01 + slack] : [0.45 - slack, 0.7 + slack];
          const fire = u != null && u >= stopAt[0] && u <= stopAt[1] && (m.served + m.tosses.length) < want && i - lastFire > 12;
          if (fire) { lastFire = i; }
          const was = m.phase;
          d.run(1 / 60, fire);
          if (was === "serve" && d.court.m && d.court.m.phase !== "serve") { serves++; }
          const s = document.getElementById("say").textContent;
          if (s !== said) { said = s; const key = s.replace(/[0-9]+/g, "#").split(".")[0].slice(0, 40); out.why[key] = (out.why[key] || 0) + 1; }
          const m2 = d.court.m;
          if (!m2 || m2 !== m) { if (!m2) { out.mw++; } continue; }   // (the match won: its last point already counted)
          if (m2.you !== last[0] || m2.them !== last[1]) {
            if (m2.you > last[0]) { out.pts += m2.you - last[0]; out.won += m2.you - last[0]; }
            if (m2.them > last[1]) { out.pts += m2.them - last[1]; if (m2.them >= C.WIN) { out.ml++; } }
            last = [m2.you, m2.them];
          }
        }
        return out;
      }, { level, who, N });
      rows.push(r);
      const top = Object.entries(r.why).sort((x, y) => y[1] - x[1]).slice(0, 4).map((e) => e[1] + " " + e[0]).join("; ");
      console.log(`court ${String(level).padStart(2)}  ${who.padEnd(5)}  points ${String(r.won).padStart(3)}/${String(r.pts).padEnd(3)} ${(100 * r.won / Math.max(1, r.pts)).toFixed(0).padStart(3)}%   matches won ${r.mw} lost ${r.ml}   ${top}`);
    }
  }
  console.log(errs.length ? "ERRORS " + errs.slice(0, 2).join(" | ") : "no errors");
  require("fs").writeFileSync(require("path").join(require("os").tmpdir(), "pb_curve.json"), JSON.stringify(rows, null, 1));
  await b.close();
})().catch((e) => { console.error(e); process.exit(2); });
