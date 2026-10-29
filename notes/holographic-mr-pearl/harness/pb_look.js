// pb_look.js - the same six pictures every time, to judge how the game looks (28 Oct 2026: "The graphics for the
// Pickleball game [are] not refined enough, I can't make anything out as the user. Make sure it looks hyper polished").
// The game paused and stepped by its own debug hooks, so each run is the same moment. node pb_look.js outdir [port]
const { chromium } = require("playwright");
const seed = require("./pb_seed");
const [out, port] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
async function page(b, view) {
  const p = await b.newPage(view), errs = [];
  await seed(p);   // (past the walk-through: pb_walk.js tests it)
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(url);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  await p.evaluate(() => window.Pickleball.debug().pause(true));
  return { p, errs };
}
const shot = async (p, n) => { await p.evaluate(() => window.Pickleball.debug().draw()); await p.screenshot({ path: `${out}/${n}.png` }); };
// to a rally: onto court one, serve one pearl hard, until Mr Plan's return is on its way back
const rally = () => { const d = window.Pickleball.debug(); d.enter(0); d.run(2.5);
  d.toServe();
  for (let i = 0; i < 200; i++) { const u = d.meter(); if (u != null && u >= 0.5 && u <= 0.7) { d.run(1 / 60, true); break; } d.run(1 / 60); }
  for (let i = 0; i < 400; i++) { d.run(1 / 60); const m = d.court.m; if (m && m.balls.some((b) => !b.dead && b.last === "them" && b.y > 1)) { break; } } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] }), all = [];
  const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
  const desk = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
  let { p, errs } = await page(b, phone); all.push(errs);
  await p.evaluate(() => window.Pickleball.debug().run(1.5));
  await shot(p, "1_phone_walk");                                   // where the game starts: in front of court one
  await p.evaluate(rally); await shot(p, "2_phone_rally");          // a rally, his third person
  await p.close();
  ({ p, errs } = await page(b, phone)); all.push(errs);
  await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(2.5); d.toServe(); d.run(0.4); });
  await shot(p, "3_phone_serve");                                   // the serve: the bar
  await p.close();
  ({ p, errs } = await page(b, desk)); all.push(errs);
  await p.evaluate(rally); await shot(p, "4_desk_rally");
  // Mr Plan close, from in front of him (the figure: can he be made out?)
  await p.evaluate(() => { const d = window.Pickleball.debug(), pl = d.plans[0]; d.camAt([pl.x + 1.2, 1.5, pl.z + 3.4], -0.33, -0.12); });
  await shot(p, "5_desk_plan_close");
  await p.close();
  // the courts from above and behind, five won and the sixth open: the row of them, each under its floodlights
  ({ p, errs } = await page(b, desk)); all.push(errs);
  await p.evaluate(() => { const d = window.Pickleball.debug(); for (let k = 0; k < 5; k++) { d.enter(d.courts.length - 1); d.run(0.5); d.winCourt(); } d.run(3); d.camAt([20, 14, 34], 0.35, -0.42); });
  await shot(p, "6_desk_courts_wide");
  await p.close(); await b.close();
  const e = all.flat();
  console.log(e.length ? "ERRORS " + e.slice(0, 3).join(" | ") : "six pictures, no errors: " + out);
})().catch((e) => { console.error(e); process.exit(2); });
