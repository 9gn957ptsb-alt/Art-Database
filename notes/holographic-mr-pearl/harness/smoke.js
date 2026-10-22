const { open, frames, state, sleep } = require("./game.js");
const [view, out] = process.argv.slice(2);
(async () => {
  const { browser, P, errors } = await open({ view });
  console.log("pearl", JSON.stringify(await P.evaluate(() => window.Rocket.debug().pearl())));
  await P.evaluate(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro(), null, { timeout: 600000 });
  await frames(P, 2); await sleep(3200); await frames(P, 2);
  console.log(JSON.stringify(await state(P)));
  await P.screenshot({ path: out });
  console.log("errors", JSON.stringify(errors));
  await browser.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
