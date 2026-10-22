// stick_game.js - the water stick in the game on a phone, driven by real touch events: node stick_game.js outdir [port]
const { open, frames, state } = require("./game.js");
const fs = require("fs");
const [out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const bad = [], log = [];
const check = (ok, what) => { const l = (ok ? "ok   " : "FAIL ") + what; console.log(l); log.push(l); if (!ok) { bad.push(what); } };
(async () => {
  const { browser, P, errors } = await open({ view: "phone", virtual: 25, port: port ? +port : 8803 });
  const D = (fn, a) => P.evaluate(fn, a);
  await D(() => window.Rocket.debug().skip());
  await P.waitForFunction(() => !window.Rocket.debug().intro());
  await D(() => { document.getElementById("notes").hidden = true; });
  await frames(P, 40);
  check(!(await D(() => document.getElementById("joy"))), "no disc and knob (#joy) on the page");
  const cdp = await P.context().newCDPSession(P);
  const touch = (type, x, y) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id: 1 }] });
  const X = 90, Y = 660;
  const p0 = await D(() => { const p = window.Rocket.debug().P; return { x: p.x, z: p.z }; });
  const shot = async (name, n) => { await frames(P, n || 2); await P.screenshot({ path: `${out}/${name}.png`, clip: { x: 0, y: 440, width: 300, height: 404 } }); };
  await touch("touchStart", X, Y); await shot("1_landed", 3);
  await touch("touchMove", X, Y - 14); await shot("2_gentle_up", 6);
  await touch("touchMove", X, Y - 40); await shot("3_full_up", 8);
  const p1 = await D(() => { const p = window.Rocket.debug().P; return { x: p.x, z: p.z }; });
  check(Math.hypot(p1.x - p0.x, p1.z - p0.z) > 0.3, "pushed up, he walks (" + Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(2) + " m)");
  await touch("touchMove", X + 28, Y - 28); await frames(P, 3);
  await touch("touchMove", X + 40, Y); await shot("4_full_right", 8);
  await frames(P, 40); await shot("5_full_right_1s", 1);
  await touch("touchEnd"); await shot("6_lifted_0.2s", 8);
  await shot("7_lifted_0.6s", 16);
  const p2 = await D(() => { const p = window.Rocket.debug().P; return { x: p.x, z: p.z }; });
  await frames(P, 20);
  const p3 = await D(() => { const p = window.Rocket.debug().P; return { x: p.x, z: p.z }; });
  check(Math.hypot(p3.x - p2.x, p3.z - p2.z) < 0.05, "let go, he stops");
  await shot("8_gone_1.5s", 30);
  // landing again at once while the last one still fades
  await touch("touchStart", X, Y); await touch("touchMove", X - 30, Y - 20); await shot("9_again", 6); await touch("touchEnd");
  // the right thumb still looks and taps
  const yaw0 = await D(() => window.Rocket.debug().P.yaw);
  await touch("touchStart", 300, 400); await touch("touchMove", 330, 400); await frames(P, 3); await touch("touchEnd"); await frames(P, 3);
  const yaw1 = await D(() => window.Rocket.debug().P.yaw);
  check(Math.abs(yaw1 - yaw0) > 0.05, "the right thumb still turns the view");
  check(errors.length === 0, "no page errors " + JSON.stringify(errors));
  fs.writeFileSync(`${out}/log.txt`, log.join("\n") + "\n");
  await browser.close();
  console.log(bad.length ? "FAILED: " + bad.join("; ") : "ALL OK");
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
