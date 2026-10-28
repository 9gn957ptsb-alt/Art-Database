// pb_moves.js - Mr Pearl's moves, one picture each, seen from his side: ready, sprint, skid, split-step, lunge, dive
// (and its roll), leap (the overhead), the backflip; plain (the cells as they are) and in the ASCII pass.
// node pb_moves.js outdir [port]
const { chromium } = require("playwright");
const fs = require("fs");
const [out, port] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 640, height: 480 } }), errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me);
  await p.evaluate(() => window.Pickleball.debug().pause(true));
  const shot = async (name, plain, setup) => {
    const info = await p.evaluate(([src, plain]) => {
      const d = window.Pickleball.debug(), me = d.me;
      (new Function("d", "me", src))(d, me);
      d.camAt([me.x + 4.2, 1.1, me.z + 0.6], -Math.PI / 2 - 0.12, -0.04, plain); d.draw();
      return { y: +me.y.toFixed(2), v: +me.speed.toFixed(1), drop: +me.drop.toFixed(2), move: me.move && me.move.reach };
    }, [setup, plain]);
    await p.screenshot({ path: `${out}/${name}${plain ? "_plain" : ""}.png` });
    console.log(name, plain ? "plain" : "ascii", JSON.stringify(info));
  };
  const reset = "me.x = 30; me.z = 12; me.vx = me.vz = me.vy = me.y = 0; me.yaw = 0; me.move = null; me.celeb = null; me.spin = null; me.want = null; d.step(me, 1.0);";
  const moves = [
    ["01_ready", reset],
    ["02_sprint", reset + "me.yaw = -Math.PI / 2; me.faceTo = -Math.PI / 2; me.want = { vel: [-13, 0] }; d.step(me, 0.55); me.x = 30;"],
    ["03_skid", reset + "me.yaw = -Math.PI / 2; me.faceTo = -Math.PI / 2; me.want = { vel: [-13, 0] }; d.step(me, 0.6); me.want = { vel: [0, 0] }; d.step(me, 0.12); me.x = 30;"],
    ["04_split", reset + "d.split(me); d.step(me, 0.17);"],
    ["05_lunge", reset + "d.swing(me, { tc: d.gt() + 0.26, p: [me.x + 0.4, 0.55, me.z - 1.9], kind: 'drive', reach: 'lunge', aim: [0, 0, -1] }); d.step(me, 0.26);"],
    ["06_dive", reset + "d.swing(me, { tc: d.gt() + 0.3, p: [me.x - 0.2, 0.35, me.z - 3.4], kind: 'dig', reach: 'dive', aim: [0, 0.3, -1] }); d.step(me, 0.3);"],
    ["07_dive_roll", reset + "d.swing(me, { tc: d.gt() + 0.3, p: [me.x - 0.2, 0.35, me.z - 3.4], kind: 'dig', reach: 'dive', aim: [0, 0.3, -1] }); d.step(me, 0.62);"],
    ["08_leap", reset + "d.swing(me, { tc: d.gt() + 0.62, p: [me.x + 0.3, 3.3, me.z - 0.5], kind: 'overhead', reach: 'leap', aim: [0, -0.3, -1] }); d.step(me, 0.56);"],
    ["09_overhead_hit", reset + "d.swing(me, { tc: d.gt() + 0.62, p: [me.x + 0.3, 3.3, me.z - 0.5], kind: 'overhead', reach: 'leap', aim: [0, -0.3, -1] }); d.step(me, 0.66);"],
    ["10_drive_wind", reset + "d.swing(me, { tc: d.gt() + 0.28, p: [me.x + 0.7, 0.9, me.z - 0.3], kind: 'drive', aim: [0, 0.2, -1] }); d.step(me, 0.16);"],
    ["11_drive_hit", reset + "d.swing(me, { tc: d.gt() + 0.28, p: [me.x + 0.7, 0.9, me.z - 0.3], kind: 'drive', aim: [0, 0.2, -1] }); d.step(me, 0.3);"],
    ["12_flip_a", reset + "d.celebrate(me, true); d.step(me, 0.3);"],
    ["13_flip_b", reset + "d.celebrate(me, true); d.step(me, 0.5);"],
  ];
  for (const [n, s] of moves) { await shot(n, true, s); }
  for (const [n, s] of moves.filter((m) => /sprint|dive_roll|leap|flip_a|lunge/.test(m[0]))) { await shot(n, false, s); }
  console.log(errors.length ? "ERRORS " + errors.join(" | ") : "no errors");
  await b.close();
})();
