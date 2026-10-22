// smoke.js - open, raise the sight, throw, photograph: node smoke.js desk|phone outdir port
const { open, frames, state } = require("/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/scripts/game.js");
const fs = require("fs");
const [view, out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const { browser, P, errors } = await open({ view, virtual: 25, port: +port || 8803 });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; const b = window.Rocket.debug().cam().blend; if (b) { b.t0 = -1e9; } });
  await frames(P, 6);
  console.log("consts", JSON.stringify(await D(() => window.Rocket.debug().sightConsts)));
  await P.screenshot({ path: out + "/a_down.png" });
  await D(() => window.Rocket.debug().raiseSight(true));
  await frames(P, 20);
  console.log("sight", JSON.stringify(await D(() => window.Rocket.debug().sight())));
  await P.screenshot({ path: out + "/b_up.png" });
  await D(() => window.Rocket.debug().throwAt());
  await frames(P, 10);
  console.log("pearls", JSON.stringify(await D(() => window.Rocket.debug().pearls())));
  await P.screenshot({ path: out + "/c_thrown.png" });
  await frames(P, 30);
  console.log("pearls", JSON.stringify(await D(() => window.Rocket.debug().pearls().map((p) => [p.state, p.first]))));
  console.log("state", JSON.stringify(await state(P)));
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
