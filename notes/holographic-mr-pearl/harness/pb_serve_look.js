// pb_serve_look.js - pictures of the serve (28 Oct 2026): the Scope up and the bar running under it, then three pearls
// in play, then the third person's view, now a quarter of the screen to his figure. node pb_serve_look.js outdir [port]
const { chromium } = require("playwright");
const [out, port] = process.argv.slice(2);
require("fs").mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me);
  await p.evaluate(() => window.Pickleball.debug().pause(true));
  const D = (f, a) => p.evaluate(f, a), shot = async (n) => { await D(() => window.Pickleball.debug().draw()); await p.screenshot({ path: `${out}/${n}.png` }); };
  await D(() => { const d = window.Pickleball.debug(); d.enter(0); d.run(2.5); });
  await shot("01_third_person");
  await D(() => { const d = window.Pickleball.debug(); for (let i = 0; i < 400 && !d.court.m.meterOn; i++) { d.run(1 / 60); } d.run(0.35); });
  await shot("02_serve_scope_bar");
  const info = await D(() => { const d = window.Pickleball.debug(), m = d.court.m;
    const fireAt = (lo, hi) => { for (let i = 0; i < 200; i++) { const u = d.meter(); if (u != null && u >= lo && u <= hi) { d.run(1 / 60, true); return u; } d.run(1 / 60); } return null; };
    const a = fireAt(0.5, 0.7), b2 = fireAt(d.SERVE.ACE[0] + 0.01, d.SERVE.ACE[1] - 0.01), c = fireAt(0.3, 0.6);
    return { stops: [a, b2, c], served: m.served + m.tosses.length, scope: d.view.scope }; });
  await shot("03_three_stopped");
  await D(() => window.Pickleball.debug().run(0.9));
  await shot("04_pearls_in_play");
  await D(() => window.Pickleball.debug().run(1.4));
  await shot("05_after_serve");
  console.log(JSON.stringify({ info, errs, live: await D(() => window.Pickleball.debug().court.m && window.Pickleball.debug().court.m.balls.filter((q) => !q.dead).length), scope: await D(() => window.Pickleball.debug().view.scope) }));
  await b.close();
})();
