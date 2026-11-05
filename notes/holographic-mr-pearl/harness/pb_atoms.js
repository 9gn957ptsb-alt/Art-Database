// pb_atoms.js - the garden in atoms (the artist, 5 Nov 2026: "Have the garden area graphics appear more realistic like
// these two images while maintains a very fine grain ASCII graphic like atoms"). From one fixed view of the open court's
// garden, with two courts won: its pixels in a grid of characters 3 by 5 a pixel apart (4 by 6 of the screen's own
// points to each, whatever its density); off the garden the characters lit on a darker ground of their own colour, in it
// (the inverse) dark ink in a pale ground; more than a few colours across it (its light, its sheen, its water); the
// court beside it in its characters as before. No errors. node pb_atoms.js [port] [phone|desk]
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
  await p.goto(`http://127.0.0.1:${port || 8817}/worlds/pickleball/index.html`);
  await p.evaluate(() => { localStorage.clear(); localStorage.setItem("pickleball-save-v1", JSON.stringify({ v: 2, won: 2, tut: 1, tips: 255 })); });
  await p.reload(); await p.waitForFunction(() => window.Pickleball && window.Pickleball.debug().me, null, { timeout: 120000 });
  const r = await p.evaluate(() => {
    const d = window.Pickleball.debug(), C = d.COURT, cv = document.getElementById("view"), g = cv.getContext("webgl2"), dpr = cv.width / cv.clientWidth, P = Math.max(1, Math.round(window.devicePixelRatio || 1));
    d.pause(true); for (let i = 0; i < 40; i++) { d.run(1 / 30); }   // (every chunk of the garden built, one a frame)
    const X = (d.courts.length - 1) * C.GAP; d.camAt([X + 2, 6.5, 24], 0, -0.42);
    const grab = () => { d.draw(); const w = g.drawingBufferWidth, h = g.drawingBufferHeight, px = new Uint8Array(w * h * 4); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px); return { w, h, px }; };
    const lum = (F, x, y) => { const j = (y * F.w + x) * 4; return F.px[j] * 0.299 + F.px[j + 1] * 0.587 + F.px[j + 2] * 0.114; };
    const win = (F, pt, R) => { const s = d.toScreen(pt); const cx = Math.round(s[0] * dpr), cy = F.h - 1 - Math.round(s[1] * dpr); return { x0: cx - R, x1: cx + R, y0: cy - R, y1: cy + R }; };
    const atoms = (F, W) => {   // (the mean light of the characters' pixels against their gaps, and the colours)
      let gl = 0, gn = 0, cl = 0, cn = 0; const hues = new Set();
      for (let y = W.y0; y <= W.y1; y++) { for (let x = W.x0; x <= W.x1; x++) { if (x < 0 || y < 0 || x >= F.w || y >= F.h) { continue; }
        const L = lum(F, x, y), gap = (x % (4 * P)) >= 3 * P || (y % (6 * P)) < P; if (gap) { gl += L; gn++; } else { cl += L; cn++; }
        const j = (y * F.w + x) * 4; hues.add((F.px[j] >> 4) + "," + (F.px[j + 1] >> 4) + "," + (F.px[j + 2] >> 4)); } }
      return { chars: +(cl / cn).toFixed(1), gaps: +(gl / gn).toFixed(1), hues: hues.size };
    };
    const R = Math.round(40 * dpr), walk = [X + 3.5, 0.01, 12.4], court = [X + 2, 0.01, 3.2];
    d.me.x = X - 4.5; d.me.z = C.L + 2.5; d.run(0.6); const out = grab(); const oA = atoms(out, win(out, walk, R)), oC = atoms(out, win(out, court, R));
    d.me.x = X - 9; d.me.z = C.L + 11; d.run(0.6); const inn = grab(); const iA = atoms(inn, win(inn, walk, R)), iC = atoms(inn, win(inn, court, R));
    d.camAt(null); return { P, out: oA, inn: iA, courtOut: oC, courtIn: iC };
  });
  check(await p.evaluate(() => window.Pickleball.debug().ascOk()), "the characters' pass compiled and running (not the plain picture)");
  check(r.out.chars > r.out.gaps * 1.12 && r.out.gaps > 4, `off the garden, its pixels in characters 3 by 5 a point apart (${r.P} device pixels to a point): lit ${r.out.chars} against their gaps ${r.out.gaps}, a ground of their own colour`);
  check(r.inn.chars < r.inn.gaps * 0.92 && r.inn.gaps > 120, `in the garden (its inverse): dark ink ${r.inn.chars} in a pale ground ${r.inn.gaps}`);
  check(r.out.hues >= 12 && r.inn.hues >= 12, `across the walk, many colours (${r.out.hues} and ${r.inn.hues}): its light, its sheen`);
  check(Math.abs(r.courtOut.chars - r.courtIn.chars) < 4 && Math.abs(r.courtOut.gaps - r.courtIn.gaps) < 4, `the court beside it as before, him in the garden or not (${JSON.stringify(r.courtOut)} / ${JSON.stringify(r.courtIn)})`);
  check(errs.length === 0, "no errors: " + errs.slice(0, 3).join(" | "));
  await b.close();
  console.log(bad ? bad + " FAILED" : "all ok");
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
