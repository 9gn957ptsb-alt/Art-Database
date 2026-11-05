// pb_strip.js - the courts' pearls five at a time, scrolled (the artist, 5 Nov 2026: "Only 5 levels represented by the
// Pearl circles should be visible in the top left corner at a time. Make sure I am able to scroll left and right through
// the levels that way I am still able to click on level 1 to teleport there if need be"). With twelve courts won
// (thirteen): five pearls, the newest (9 to 13), the window inside the screen, the one at its left edge faded (more that
// way), a button for every court; on a phone a swipe, on the desk the wheel and a mouse's drag, back to court 1 (1 to 5,
// the right edge faded now), nothing teleported by a scroll; court 1's pearl tapped (clicked): he is at court 1, behind
// its baseline, no match; the row stays where it was put; by the keyboard (desk) a court's button focused brings it into
// the window and Enter goes there; a match begun: the newest in the window again, the one he plays among them, nothing
// faded. And (the review of 5 Nov 2026): a trackpad's small steps move it; a finger down a pearl does not teleport; a
// slow swipe off the newest is followed; on a 320 px phone the newest at rest is whole. With two won (three courts):
// three, no scroll, nothing faded. No errors.
// node pb_strip.js [port] [phone|desk]
const { chromium } = require("playwright");
const [port, kind] = process.argv.slice(2);
const desk = kind === "desk";
const VIEW = desk ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };
let bad = 0; const check = (ok, what) => { console.log((ok ? "ok   " : "FAIL ") + what); if (!ok) { bad++; } };
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage(VIEW), errs = [];
  p.on("pageerror", (e) => errs.push(String(e)));
  const url = `http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`;
  const load = async (won) => {
    await p.goto(url);
    await p.evaluate((w) => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: w, tut: 1, tips: 255 })); }, won);
    await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me && window.Pickleball.debug().running(), null, { timeout: 120000 });
    await p.waitForTimeout(600);
  };
  const st = async () => {
    // (the HUD drawn since the row last moved: on a slow software renderer a frame can take a while)
    await p.waitForFunction(() => { const h = window.Pickleball.debug().hud(), bx = document.getElementById("courts"); return h.strip && Math.abs(h.strip.sx - bx.scrollLeft) < 1; }, null, { timeout: 8000 }).catch(() => {});
    return read();
  };
  const read = () => p.evaluate(() => {
    const d = window.Pickleball.debug(), h = d.hud(), bx = document.getElementById("courts"), r = bx.getBoundingClientRect();
    return { strip: h.strip, ks: h.pearls.map((q) => q.k + 1), as: h.pearls.map((q) => q.a), pearls: h.pearls, box: [r.left, r.top, r.width, r.height], W: innerWidth, n: bx.children.length,
      me: [+d.me.x.toFixed(2), +d.me.z.toFixed(2)], m: !!d.court.m, L: d.COURT.L, say: document.getElementById("say").textContent };
  });
  const cdp = await p.context().newCDPSession(p);
  const swipe = async (s, dx) => {   // (a finger along the row: dx right brings the earlier courts in)
    const X = dx > 0 ? s.box[0] + 20 : s.box[0] + s.box[2] - 20, Y = s.box[1] + s.box[3] / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: X, y: Y, id: 4 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: X + (dx * i) / 10, y: Y, id: 4 }] }); await p.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(500);
  };
  const tap = async (x, y) => {
    if (desk) { await p.mouse.click(x, y); } else { await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 5 }] }); await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); }
    await p.waitForTimeout(400);
  };

  // 1. thirteen courts: five, the newest; the left edge faded
  await load(12);
  const s1 = await st();
  check(s1.ks.join(",") === "9,10,11,12,13" && s1.strip.cnt === 5 && s1.n === 13, `five pearls of thirteen, the newest: ${s1.ks} (a button for each of ${s1.n})`);
  check(s1.box[0] >= 0 && s1.box[0] + s1.box[2] <= s1.W && s1.box[3] >= 44 && Math.abs(s1.box[2] - 5 * (s1.strip.h + 5)) < 1.5, `the window inside the screen, five pearls wide, a finger's height ${JSON.stringify(s1.box.map(Math.round))}`);
  check(s1.as[0] < 0.7 && s1.as.slice(1).every((a) => a === 1), `the pearl at its left edge faded, more that way (${s1.as})`);

  // 2. scrolled back to court 1: a swipe (phone), the wheel and a mouse's drag (desk); nothing teleported by it
  if (desk) {
    await p.mouse.move(s1.box[0] + s1.box[2] / 2, s1.box[1] + s1.box[3] / 2);
    // (a trackpad's stream: thirty small steps 16 ms apart, sent in the page, as a trackpad sends them: the test's own
    // wheel waits on a frame, which on this software renderer is slower than any trackpad)
    await p.evaluate(() => new Promise((res) => { const bx = document.getElementById("courts"), r = bx.getBoundingClientRect(); let i = 0; const t = setInterval(() => { bx.firstElementChild.dispatchEvent(new WheelEvent("wheel", { deltaY: -4, deltaMode: 0, bubbles: true, cancelable: true, clientX: r.left + 40, clientY: r.top + 20 })); if (++i === 30) { clearInterval(t); res(); } }, 16); }));
    await p.waitForTimeout(600);
    const tp = await st(), stp = tp.strip.h + 5, rest = tp.strip.sx % stp;
    check(tp.strip.sx < s1.strip.sx - 60 && (rest < 1 || rest > stp - 1), `a trackpad's small steps move it (${s1.strip.sx} -> ${tp.strip.sx}), at rest on a whole pearl (${tp.ks})`);
    await p.mouse.wheel(0, 2000); await p.waitForTimeout(600);
    await p.mouse.wheel(0, -60); await p.waitForTimeout(500);
    const sw = await st(); check(sw.strip.sx < s1.strip.sx && sw.strip.sx > 0, `the wheel scrolls it back (${s1.strip.sx} -> ${sw.strip.sx}, ${sw.ks})`);
    const y = s1.box[1] + s1.box[3] / 2;
    await p.mouse.move(s1.box[0] + 30, y); await p.mouse.down(); for (let i = 1; i <= 10; i++) { await p.mouse.move(s1.box[0] + 30 + i * 40, y); await p.waitForTimeout(16); } await p.mouse.up(); await p.waitForTimeout(500);
  } else {
    // (a finger down a pearl, as a walk begun on it: no teleport; a slow swipe off the newest: the row follows it)
    const v0 = await st(), pv = v0.pearls[2];
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pv.x, y: pv.y, id: 6 }] });
    for (let i = 1; i <= 8; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: pv.x + i, y: pv.y + i * 8, id: 6 }] }); await p.waitForTimeout(16); }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(500);
    const v1 = await st(); check(v1.me[0] === v0.me[0] && v1.me[1] === v0.me[1], `a finger down a pearl: no teleport (${v0.me} / ${v1.me})`);
    const X = v0.box[0] + 40, Y = v0.box[1] + v0.box[3] / 2;
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: X, y: Y, id: 7 }] });
    for (let i = 1; i <= 40; i++) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: X + i, y: Y, id: 7 }] }); await p.waitForTimeout(30); }
    const v2 = await read();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await p.waitForTimeout(500);
    check(v2.strip.sx < v0.strip.sx - 15, `a slow swipe off the newest: the row follows the finger (${v0.strip.sx} -> ${v2.strip.sx})`);
    for (let i = 0; i < 4; i++) { await swipe(await st(), 150); }
  }
  const s2 = await st();
  check(s2.ks.join(",") === "1,2,3,4,5" && s2.as[4] < 0.7 && s2.as.slice(0, 4).every((a) => a === 1), `${desk ? "the wheel and a mouse's drag" : "a swipe"} back to court 1: ${s2.ks}, the right edge faded now (${s2.as})`);
  check(s2.me[0] === s1.me[0] && s2.me[1] === s1.me[1] && !s2.m, `nothing teleported by the scroll (${s1.me} / ${s2.me})`);

  // 3. court 1's pearl tapped: at court 1, behind its baseline, no match; the row where it was put
  const p1 = s2.pearls.find((q) => q.k === 0);
  await tap(p1.x, p1.y);
  const s3 = await st();
  check(Math.abs(s3.me[0]) < 0.6 && Math.abs(s3.me[1] - (s3.L + 3)) < 0.6 && !s3.m, `court 1's pearl ${desk ? "clicked" : "tapped"}: he is at court 1, behind its baseline, no match (${s3.me}; "${s3.say}")`);
  await p.waitForTimeout(1200);
  const s4 = await st();
  check(s4.ks[0] === 1, `the row stays where it was put (${s4.ks})`);

  // 4. by the keyboard (desk): court 12's button focused comes into the window, Enter goes there
  if (desk) {
    await p.evaluate(() => document.querySelectorAll("#courts button")[11].focus()); await p.waitForTimeout(300);
    const sk = await st(); check(sk.ks.includes(12), `court 12's button focused (Tab): in the window (${sk.ks})`);
    await p.keyboard.press("Enter"); await p.waitForTimeout(400);
    const sk2 = await st(); check(Math.abs(sk2.me[0] - 11 * 12) < 0.6 && !sk2.m, `and Enter: at court 12 (${sk2.me})`);
  }

  // 5. a match begun: the newest in the window again, the one he plays
  const s5 = await p.evaluate(() => { const d = window.Pickleball.debug(); d.enter(d.courts.length - 1); return d.courts.length; });
  await p.waitForFunction(() => { const d = window.Pickleball.debug(); return d.court.m && d.hud().pearls.some((q) => q.on); }, null, { timeout: 8000 }).catch(() => {});
  const s6 = await st();
  check(s6.as.every((a) => a === 1), `in a match nothing faded, the one he plays whole (${s6.as})`);
  check(s6.m && s6.ks[s6.ks.length - 1] === s5 && s6.pearls.some((q) => q.on && q.k === s5 - 1), `a match on the newest: the newest in the window again, the one he plays among them (${s6.ks}; match ${s6.m}, on ${JSON.stringify(s6.pearls.filter((q) => q.on).map((q) => q.k + 1))})`);

  // 6. the narrowest phone (320 wide): at rest the newest whole, only the far edge faded
  if (!desk) {
    await p.setViewportSize({ width: 320, height: 640 }); await load(13);
    const sn = await st();
    check(sn.as[sn.as.length - 1] === 1 && sn.as[0] < 0.7 && sn.ks[sn.ks.length - 1] === 14, `320 wide: the newest whole, the far edge faded (${sn.ks}: ${sn.as})`);
    await p.setViewportSize({ width: 390, height: 844 });
  }

  // 7. three courts: three, no scroll, nothing faded
  await load(2);
  const s7 = await st();
  check(s7.ks.join(",") === "1,2,3" && s7.strip.most === 0 && s7.as.every((a) => a === 1), `three courts: three, no scroll, nothing faded (${s7.ks}, ${s7.as})`);

  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
