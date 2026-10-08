/* The place, then — a city entered from an artist's life — checked in a browser.

   The artist, 8 Oct 2026, of Dalí's life entered at New York: "When I am looking at a specific city that I
   clicked on while viewing a specific artist, I want to know first and foremost, all of the artworks that
   the artist made during their time in that city. That should be the primary information. From there
   subordinate information like where their studio was, an overview of the Artist time there in reference to
   historical writings or important art shows they participated in."

   For each place (Dalí in New York, 1966–1968; Picasso in Paris, 1907–1910; Dalí in Madrid, 1922–1925, where
   none of his saved works is placed), at a phone's size (390×844, touch) and a desktop's (1440×900):

     works first: the picture's works are the artist's own of the period, every one (the life's period lists
       them), none another artist's; a strip under the picture holds them all, the one shown ringed; a press
       on a square brings it up (the count follows);
     nothing else under it: the work's box holds the picture, its label, one line and the strip — no doors;
       the label touches the picture; on a phone the dial is not over the picture's box;
     then the rest, in order: the column says where the artist worked, then their time there, and only after
       them who else was there and the works others made there;
     none: with no work of the artist's placed there, it says so, and the strip is not shown;
     quiet: no page error.

     cd docs && python3 -m http.server 8898 &
     NODE_PATH=$(npm root -g) node scripts/check_placethen.js [--port 8898] [--sizes 390x844,1440x900]

   Artsy's picture store and Commons are stood in for (page.route). Exits 1 on any failure. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
const PORT = +arg("port", 8898);
const SIZES = String(arg("sizes", "390x844,1440x900")).split(",");
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#7a6a58"/></svg>';
const PLACES = [
  { life: "salvador-dali", k: 4, name: "Dalí in New York, 1966–1968" },
  { life: "pablo-picasso", k: 5, name: "Picasso in Paris, 1907–1910" },
  { life: "salvador-dali", k: 1, name: "Dalí in Madrid, 1922–1925", none: true }
];

let failed = 0;
function check(tag, ok, what, detail) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (detail !== undefined ? " · " + JSON.stringify(detail) : ""));
  if (!ok) { failed += 1; }
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--disable-dev-shm-usage"] });
  for (const size of SIZES) {
    const [w, h] = size.split("x").map(Number), touch = w <= 720;
    for (const pl of PLACES) {
      const tag = size + " " + pl.name;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: 2 });
      await ctx.addInitScript((l) => { try { localStorage.setItem("dial.seen", JSON.stringify(["l:" + l])); } catch (e) {} }, pl.life);
      await ctx.route(/cloudfront\.net|wikimedia|nasa\.gov|fonts\.(googleapis|gstatic)\.com/, (r) =>
        /\.(jpg|png)|FilePath/.test(r.request().url()) ? r.fulfill({ body: PIC, contentType: "image/svg+xml" }) : r.abort());
      const P = await ctx.newPage();
      const errors = [];
      P.on("pageerror", (e) => errors.push(e.message));
      await P.goto("http://localhost:" + PORT + "/v2/?x=" + Date.now());
      await P.waitForTimeout(4000);
      await P.evaluate((l) => Lives.open(l), pl.life);
      for (let i = 0; i < 80; i++) { const r = await P.evaluate(() => Land.reading && Land.reading()); if (r && !r.flying && r.at) { break; } await P.waitForTimeout(300); }
      await P.waitForTimeout(1500);
      await P.evaluate(([l, k]) => Lives.enter(l, k), [pl.life, pl.k]);
      for (let i = 0; i < 80; i++) {
        const ok = await P.evaluate(() => { const s = window.PlaceThen && PlaceThen._state(); const e = document.querySelector(".pt-work"); return !!(s && e && e.getClientRects().length); });
        if (ok) { break; }
        await P.waitForTimeout(400);
      }
      // The flight, the period's works (read with Painted here's sites, a large file) and the column's sections.
      for (let i = 0; i < 90; i++) {
        const ok = await P.evaluate(() => {
          const w = Land.where && Land.where(), s = PlaceThen._state();
          return !!(w && !w.flying && s && s.ready && document.querySelector(".life-then-head"));
        });
        if (ok) { break; }
        await P.waitForTimeout(400);
      }
      await P.waitForTimeout(2500);
      const m = await P.evaluate(([life, k]) => {
        const R = (e) => { if (!e || !e.getClientRects().length) { return null; } const b = e.getBoundingClientRect(); return { x: b.left, y: b.top, r: b.right, b: b.bottom }; };
        const s = PlaceThen._state();
        const strip = document.querySelector(".pt-strip");
        const work = document.querySelector(".pt-work");
        const kids = work ? [...work.children].filter((e) => e.getClientRects().length).map((e) => e.className) : [];
        const col = document.getElementById("art-col");
        const order = (sel) => { const e = col && col.querySelector(sel); return e ? [...col.querySelectorAll("*")].indexOf(e) : -1; };
        return {
          s: { items: s.items, own: s.own, i: s.i, count: s.count, list: s.list, others: s.others, othersShown: s.othersShown },
          strip: strip && !strip.hidden ? strip.children.length : 0, now: strip ? [...strip.querySelectorAll("[data-now]")].map((e) => +e.dataset.i) : [],
          kids, doorsInWork: work ? work.querySelectorAll(".pt-door").length : 0,
          pic: R(document.querySelector(".pt-pic")), label: R(document.querySelector(".pt-work .wall-label")),
          dial: R(document.getElementById("art-time")), none: (document.querySelector(".pt-none") || {}).textContent || "",
          where: order(".life-where-head"), then: order(".life-then-head"), also: order(".pt-col"),
          heads: col ? [...col.querySelectorAll(".town-section")].map((e) => e.textContent.trim()) : []
        };
      }, [pl.life, pl.k]);
      const life = await P.evaluate((l) => fetch("lives/" + l + ".json").then((r) => r.json()), pl.life);
      const per = life.periods[pl.k];
      const own = per.works.concat(per.prints).filter((i) => life.works[i][3]).length;
      if (pl.none) {
        check(tag, m.s.items === 0 && own === 0, "none of the artist's works here: none in the picture", { items: m.s.items, own });
        check(tag, /No work of .* is placed in /.test(m.none), "and it says so", m.none);
        check(tag, m.strip === 0, "no strip");
      } else {
        check(tag, m.s.items >= own && m.s.items > 0 && m.s.own === m.s.items, "the picture's works are the artist's own, every one", { items: m.s.items, period: own });
        check(tag, m.s.othersShown === 0, "none another artist's", m.s.othersShown);
        check(tag, m.strip === m.s.items && m.now.length === 1 && m.now[0] === m.s.i, "the strip holds them all, the one shown ringed", { strip: m.strip, now: m.now, i: m.s.i });
        check(tag, m.doorsInWork === 0 && m.kids.every((c) => /pt-picbox|pt-cap|pt-strip/.test(c)), "under the picture only its label, its line and the strip", m.kids);
        check(tag, m.label && m.pic && m.label.y >= m.pic.b - 2 && m.label.y - m.pic.b < 40, "the label touches the picture", { pic: m.pic && Math.round(m.pic.b), label: m.label && Math.round(m.label.y) });
        if (touch && m.dial && m.pic) {
          const over = m.dial.x < m.pic.r && m.dial.r > m.pic.x && m.dial.y < m.pic.b && m.dial.b > m.pic.y;
          check(tag, !over, "the dial is not over the picture", { dial: m.dial, pic: m.pic });
        }
        if (m.s.items > 2) {
          const sq = await P.evaluate(() => { const q = document.querySelectorAll(".pt-strip .pt-sq")[2]; q.scrollIntoView({ block: "nearest", inline: "nearest" }); const b = q.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
          if (touch) { await P.touchscreen.tap(sq[0], sq[1]); } else { await P.mouse.click(sq[0], sq[1]); }
          await P.waitForTimeout(900);
          const after = await P.evaluate(() => { const s = PlaceThen._state(); return { i: s.i, count: s.count, now: [...document.querySelectorAll(".pt-strip [data-now]")].map((e) => +e.dataset.i) }; });
          check(tag, after.i === 2 && after.now[0] === 2 && /^3 of /.test(after.count), "a square pressed is brought up, the count follows", after);
        }
      }
      check(tag, m.where >= 0 && m.then > m.where, "the column: where they worked, then their time there", m.heads.slice(0, 4));
      if (m.also >= 0) { check(tag, m.also > m.then, "who else and the others' works only after them", m.heads); }
      check(tag, !errors.length, "no page errors", errors.slice(0, 2));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(failed ? failed + " failed" : "all passed");
  process.exit(failed ? 1 : 0);
})();
