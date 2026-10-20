/* The artist's own animal in a life's place — "the place, then" — checked in a browser.

   The characters pass, 15 Oct 2026: in a life's place the art layer (z-index 80) lies over the stage, its panel is 95%
   dark and its clod takes the presses, so an animal in the stage was hidden under it and a press where it stood was the
   clod's; and Land.at never put a point on the clod. Now (characters.js, "In a life's place"; placethen.js, `at`, `here`)
   the canvas and the buttons stand in the place's panel while it is up, cut to the clod, and an animal told to stand at
   the place stands on the clod by its tile.

   For Dalí in New York, 1966–1968 (his ocellated lizard; a town's square), Warhol at the Factory, 1964–1987 (his bald
   eagle; an exact place with a caption of its own), Warhol in Pittsburgh, 1928 (home: the eagle at rest on the ground
   by the town's own point), Twombly in Rome, 1961–1963 (his red fox, the biggest drawing) and Pollock in Cody, 1912
   (his starling murmuration, the widest), at a phone's size (390×844, touch) and a desktop's (1440×900):

     at rest: the animal brought to stand on the clod (the town's point is on it) is drawn there, its button the
       topmost thing at its middle, wholly inside the clod's box, clear of the picture, the place's sentence and the
       dial, and shows over the panel (the canvas hidden and shown: its box differs); pressed, it stops and its line
       shows over everything, whole in the window;
     followed (the column's "Follow the …"): the animal waits on the clod by the place's tile, drawn, pressable, wholly
       inside the clod's box; the life's next place is entered and it waits by that tile, the canvas in the new
       panel; a press on it lets it go (as a followed animal is);
     the clod: a press on it away from the animal swings it a quarter turn; the canvas stands in the place's panel
       after the clod and under the tile, the lines in the art layer;
     gone: with the place put away ("The whole life ›", or up a level) they are all back in the stage, the canvas just
       after the pixel light;
     quiet: no page error.

     cd docs && python3 -m http.server 8941 &
     NODE_PATH=$(npm root -g) node scripts/check_place_animal.js [--port 8941] [--sizes 390x844,1440x900]
         [--only andy-warhol:0] [--shots DIR]

   Artsy's picture store, Commons, NASA and Google Fonts are stood in for or refused (page.route). Exits 1 on any failure. */
"use strict";
const { chromium } = require("playwright");
const fs = require("fs");

const args = process.argv.slice(2);
function arg(name, dflt) { const i = args.indexOf("--" + name); return i < 0 ? dflt : args[i + 1]; }
const PORT = +arg("port", 8941);
const SIZES = String(arg("sizes", "390x844,1440x900")).split(",");
const SHOTS = arg("shots", null);
const ONLY = arg("only", null);                 // one place: "andy-warhol:0"
const EXE = process.env.CHROMIUM || (fs.existsSync("/opt/pw-browsers/chromium-1194/chrome-linux/chrome") ? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" : undefined);
const PIC = '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#7a6a58"/></svg>';
const PLACES = [
  { life: "salvador-dali", k: 4, next: 5, animal: "lizard", name: "Dalí in New York, 1966–1968", rest: true },
  { life: "andy-warhol", k: 2, next: 1, animal: "eagle", name: "Warhol at the Factory, 1964–1987", rest: false, up: true },
  { life: "andy-warhol", k: 0, next: 1, animal: "eagle", name: "Warhol in Pittsburgh, 1928", rest: true },
  { life: "cy-twombly", k: 4, next: 3, animal: "fox", name: "Twombly in Rome, 1961–1963", rest: true, up: true },
  { life: "jackson-pollock", k: 0, next: 1, animal: "starling", name: "Pollock in Cody, 1912", rest: true }
];

let failed = 0;
function check(tag, ok, what, detail) {
  console.log((ok ? "  ok   " : "  FAIL ") + tag + " · " + what + (detail !== undefined ? " · " + JSON.stringify(detail) : ""));
  if (!ok) { failed += 1; }
}

// In the page: the boxes of what an animal must keep to or clear of, and its own, from its button (the hit box is
// the middle 70% by 80% of the animal's bounds, characters.js draw()).
function survey() {
  const R = (e) => { if (!e || !e.getClientRects().length) { return null; } const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const btns = [].slice.call(document.querySelectorAll("button.character")).filter((b) => !b.hidden);
  const lay = document.getElementById("characters") && document.getElementById("characters").parentNode;
  const out = { inPanel: !!lay && lay.className === "character-layer" && lay.previousElementSibling === document.querySelector(".pt-clod") &&
                  lay.nextElementSibling === document.querySelector(".pt-here") && lay.parentNode === document.querySelector(".pt-stage"),
                clod: R(document.querySelector(".pt-clod")), work: R(document.querySelector(".pt-work")), head: R(document.querySelector(".pt-head")),
                dial: R(document.getElementById("art-time")), col: R(document.getElementById("art-col")), tile: R(document.querySelector(".pt-here")),
                more: (() => { const m = document.querySelector(".pt-more"); return m && !m.hidden ? R(m) : null; })(), animals: [] };
  const cv = document.getElementById("characters");
  const dpr = cv ? cv.width / window.innerWidth : 1;
  const st = Characters._state();
  const crowd = (st && st.crowd) || [];
  btns.forEach((b) => {
    const q = b.getBoundingClientRect(), bw = q.width / 0.7, bh = q.height / 0.8;
    const bx = q.left - 0.15 * bw, by = q.top - 0.2 * bh;
    const cx = q.left + q.width / 2, cy = q.top + q.height / 2;
    const top = document.elementFromPoint(cx, cy);
    // What the canvas has drawn within the animal's bounds: the dots that are not clear.
    let dots = 0;
    if (cv) {
      const g = cv.getContext("2d"), x0 = Math.max(0, Math.round(bx * dpr)), y0 = Math.max(0, Math.round(by * dpr));
      const w = Math.min(cv.width - x0, Math.round(bw * dpr)), h = Math.min(cv.height - y0, Math.round(bh * dpr));
      if (w > 0 && h > 0) { const d = g.getImageData(x0, y0, w, h).data; for (let i = 3; i < d.length; i += 4) { if (d[i] > 40) { dots += 1; } } }
    }
    out.animals.push({ label: b.getAttribute("aria-label"), box: { l: bx, t: by, r: bx + bw, b: by + bh }, mid: { x: cx, y: cy }, top: top === b,
                       topIs: top && (top.tagName + "." + (top.className || top.id)), parent: b.parentNode.className || b.parentNode.id, dots: dots });
  });
  out.crowd = crowd.map((c) => ({ id: c.id, mode: c.mode, state: c.state, x: Math.round(c.x), y: Math.round(c.y), hidden: c.hidden }));
  return out;
}

// How many pixels differ markedly between two shots of the same box (decoded in the page): the panel is 95% dark, so the
// world under it bleeds a little through, and that is not a difference; an animal is.
function markedly(P, a, b) {
  return P.evaluate(async ([x, y]) => {
    const load = async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const bmp = await createImageBitmap(new Blob([bytes], { type: "image/png" }));
      const cv = document.createElement("canvas"); cv.width = bmp.width; cv.height = bmp.height;
      const g = cv.getContext("2d"); g.drawImage(bmp, 0, 0);
      return g.getImageData(0, 0, bmp.width, bmp.height).data;
    };
    const p = await load(x), q = await load(y);
    let n = 0;
    for (let i = 0; i < p.length; i += 4) { if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 90) { n += 1; } }
    return n;
  }, [a.toString("base64"), b.toString("base64")]);
}

// Whether the canvas shows over the panel: the animal's box, shot with the canvas hidden, shown and hidden again; the two
// hidden shots agree and the shown one is markedly another. The tile blinks, so it is put out of the shot.
async function seen(P, box) {
  const clip = { x: Math.max(0, box.l), y: Math.max(0, box.t), width: Math.max(8, box.r - box.l), height: Math.max(8, box.b - box.t) };
  const hide = (v) => P.evaluate((x) => { document.getElementById("characters").style.visibility = x; }, v);
  await P.evaluate(() => { const st = document.createElement("style"); st.id = "seen-style"; st.textContent = ".pt-here, .pt-here-label { visibility: hidden !important; }"; document.head.appendChild(st); });
  await hide("hidden"); const a = await P.screenshot({ clip });
  await hide(""); const b = await P.screenshot({ clip });
  await hide("hidden"); const c = await P.screenshot({ clip });
  await hide("");
  await P.evaluate(() => { const st = document.getElementById("seen-style"); if (st) { st.remove(); } });
  seen.got = { hiddenTwice: await markedly(P, a, c), shown: await markedly(P, a, b) };
  return seen.got.hiddenTwice < 5 && seen.got.shown > 150;
}

const inside = (a, c, m) => a.l >= c.l - m && a.r <= c.r + m && a.t >= c.t - m && a.b <= c.b + m;
const over = (a, c) => !!c && a.l < c.r && a.r > c.l && a.t < c.b && a.b > c.t;
// Where a follower's anchor (f) should stand: at the tile's offset (40 left, 40 below), moved only as far as keeps its box (a.box,
// measured at f) wholly on the clod, or centred on the clod where the box is bigger than it (characters.js, onClod).
function expectAnchor(a, f, tile, clod) {
  const want = { x: tile.x - 40, y: tile.y + 40 };
  const dx = want.x - f.x, dy = want.y - f.y;
  const fit = (lo, hi, clo, chi) => (hi - lo > chi - clo) ? ((clo + chi) - (lo + hi)) / 2 : lo < clo ? clo - lo : hi > chi ? chi - hi : 0;
  return { x: want.x + fit(a.box.l + dx, a.box.r + dx, clod.l, clod.r), y: want.y + fit(a.box.t + dy, a.box.b + dy, clod.t, clod.b) };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ["--disable-dev-shm-usage"] });
  for (const size of SIZES) {
    const [w, h] = size.split("x").map(Number), touch = w <= 720;
    for (const pl of PLACES.filter((q) => !ONLY || ONLY === q.life + ":" + q.k)) {
      const tag = size + " " + pl.name;
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: touch ? 2 : 1 });
      await ctx.addInitScript((l) => { try { localStorage.setItem("dial.seen", JSON.stringify(["l:" + l])); localStorage.setItem("globe-layer", "museums"); } catch (e) {} }, pl.life);
      await ctx.route(/cloudfront\.net|wikimedia|nasa\.gov|fonts\.(googleapis|gstatic)\.com/, (r) =>
        /\.(jpg|png)|FilePath/.test(r.request().url()) ? r.fulfill({ body: PIC, contentType: "image/svg+xml" }) : r.abort());
      const P = await ctx.newPage();
      const errors = [];
      P.on("pageerror", (e) => errors.push(e.message));
      const press = async (x, y) => { if (touch) { await P.touchscreen.tap(x, y); } else { await P.mouse.click(x, y); } };
      await P.goto("http://localhost:" + PORT + "/v2/?x=" + Date.now());
      await P.waitForTimeout(4000);
      await P.evaluate((l) => Lives.open(l), pl.life);
      for (let i = 0; i < 80; i++) { const r = await P.evaluate(() => Land.reading && Land.reading()); if (r && !r.flying && r.at) { break; } await P.waitForTimeout(300); }
      await P.waitForTimeout(1500);
      await P.evaluate(([l, k]) => Lives.enter(l, k), [pl.life, pl.k]);
      // The flight, the period's works, the column; then the clod drawn (it is read with the ground, a large file).
      for (let i = 0; i < 120; i++) {
        const ok = await P.evaluate(() => {
          const w = Land.where && Land.where(), s = window.PlaceThen && PlaceThen._state();
          return !!(w && !w.flying && s && s.ready && PlaceThen.here() && document.querySelector(".pt-door[data-kind=animal]"));
        });
        if (ok) { break; }
        await P.waitForTimeout(400);
      }
      await P.waitForTimeout(2500);
      const nm = await P.evaluate(async (id) => ((await Characters.cast()).filter((c) => c.id === id)[0] || {}).name || "", pl.animal);
      const up = await P.evaluate(() => !!(window.PlaceThen && PlaceThen.here()));
      check(tag, up, "the place is up and its clod drawn");
      if (!up) { errors.length && check(tag, false, "page errors", errors.slice(0, 2)); await ctx.close(); continue; }

      // At rest: the animal brought to the town's point, which is on the clod.
      if (pl.rest) {
        await P.evaluate(() => Characters._reset());
        await P.evaluate((id) => Characters._come(id, "rest"), pl.animal);
        let s = null;
        for (let i = 0; i < 60; i++) {
          await P.waitForTimeout(400);
          s = await P.evaluate(survey);
          const a = s.animals.filter((x) => (x.label || "").indexOf(nm) === 0)[0];
          if (a && s.crowd.some((c) => c.mode === "rest" && c.state === "wait")) { break; }
        }
        const a = s.animals.filter((x) => (x.label || "").indexOf(nm) === 0)[0];
        check(tag, !!a, "at rest: the animal is out", s.crowd);
        if (a) {
          check(tag, a.parent === "character-layer", "its button stands in the place's panel", a.parent);
          check(tag, a.top, "its button is the topmost thing at its middle", a.topIs);
          check(tag, inside(a.box, s.clod, 2), "it stands wholly on the clod", { box: a.box, clod: s.clod });
          check(tag, !over(a.box, s.work) && !over(a.box, s.head) && !over(a.box, s.dial) && !over(a.box, s.col) && !over(a.box, s.more),
                "clear of the picture, the place's sentence and the dial", { work: s.work, head: s.head });
          check(tag, a.dots > 150, "it is drawn there", a.dots);
          check(tag, s.inPanel, "the canvas stands in the place's panel, after the clod and under the tile");
          check(tag, await seen(P, a.box), "and it shows over the panel (the canvas, hidden and shown: the box differs)", seen.got);
          if (SHOTS) { await P.screenshot({ path: `${SHOTS}/animal_${w}_${pl.life}_${pl.k}_rest.png` }); }
          await press(a.mid.x, a.mid.y);
          await P.waitForTimeout(900);
          const said = await P.evaluate(() => {
            const e = document.querySelector(".character-says");
            if (!e || e.hidden) { return { text: "", none: true, at: document.getElementById("land").dataset.at, crowd: Characters._state() && Characters._state().crowd.map((c) => [c.id, c.mode, c.state, c.pose, Math.round(c.x), Math.round(c.y)]) }; }
            // (The line takes no press itself, so for the hit test it is let take one.)
            const q = e.getBoundingClientRect();
            e.style.pointerEvents = "auto";
            const top = document.elementFromPoint(q.left + 6, q.top + q.height / 2);
            e.style.pointerEvents = "";
            return { text: e.textContent, top: !!top && (top === e || e.contains(top)), box: [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)],
                     parent: e.parentNode.id || e.parentNode.className, stopped: Characters._state().crowd.some((c) => c.mode === "rest" && (c.pose === "look" || c.pose === "sit")) };
          });
          check(tag, !!said && said.text.indexOf(nm) === 0, "pressed: its line shows", said && (said.none ? said : said.text));
          check(tag, !!said && said.top, "the line is the topmost thing where it stands", said);
          check(tag, !!said && said.box[0] >= 0 && said.box[1] >= 0 && said.box[2] <= w && said.box[3] <= h, "the line is whole in the window", said && said.box);
          check(tag, !!said && said.stopped, "it stopped, and looks at you (or sits)");
          if (SHOTS) { await P.screenshot({ path: `${SHOTS}/animal_${w}_${pl.life}_${pl.k}_said.png` }); }
        }
      }

      // The clod: a press on it, away from the animals, swings it a quarter turn.
      {
        const s = await P.evaluate(survey);
        const c = s.clod, grid = [];
        for (let fy = 0.1; fy < 0.95; fy += 0.1) { for (let fx = 0.1; fx < 0.95; fx += 0.1) { grid.push([fx, fy]); } }
        let spot = null;
        for (const [fx, fy] of grid) {
          const x = c.l + (c.r - c.l) * fx, y = c.t + (c.b - c.t) * fy;
          const clear = s.animals.every((an) => x < an.box.l - 16 || x > an.box.r + 16 || y < an.box.t - 16 || y > an.box.b + 16) &&
                        (x < s.tile.l - 14 || x > s.tile.r + 14 || y < s.tile.t - 14 || y > s.tile.b + 14);
          const dialOver = s.dial && x > s.dial.l - 10 && x < s.dial.r + 10 && y > s.dial.t - 10 && y < s.dial.b + 10;
          const top = await P.evaluate(([px, py]) => { const e = document.elementFromPoint(px, py); return e && e.className; }, [x, y]);
          if (clear && !dialOver && top === "pt-clod") { spot = [x, y]; break; }
        }
        check(tag, !!spot, "a bare spot on the clod to press", spot);
        if (spot) {
          const before = await P.evaluate(() => document.querySelector(".pt-clod").toDataURL());
          await press(spot[0], spot[1]);
          await P.waitForTimeout(3600);
          const after = await P.evaluate(() => document.querySelector(".pt-clod").toDataURL());
          check(tag, before !== after, "a press on the clod away from the animal swings it");
        }
      }

      // Followed: the column's door.
      {
        await P.evaluate(() => Characters._reset());
        const door = await P.$(".pt-door[data-kind=animal]");
        check(tag, !!door, "the column offers the animal's door");
        if (door) {
          await door.scrollIntoViewIfNeeded();
          await door.click();
          let prev = null, s = null;
          for (let i = 0; i < 90; i++) {
            await P.waitForTimeout(600);
            s = await P.evaluate(survey);
            const f = s.crowd.filter((c) => c.mode === "follow")[0];
            const cur = f && [f.x, f.y];
            if (cur && prev && cur[0] === prev[0] && cur[1] === prev[1]) { break; }
            prev = cur;
          }
          await P.waitForTimeout(800);
          s = await P.evaluate(survey);
          const f = s.crowd.filter((c) => c.mode === "follow")[0];
          const a = s.animals.filter((x) => /press to let it go/.test(x.label || ""))[0];
          check(tag, !!f && !f.hidden && !!a, "followed: the animal is out and shown", s.crowd);
          if (f && a) {
            const tile = { x: (s.tile.l + s.tile.r) / 2, y: (s.tile.t + s.tile.b) / 2 };
            const ex = expectAnchor(a, f, tile, s.clod);
            check(tag, Math.abs(f.x - ex.x) <= 2.5 && Math.abs(f.y - ex.y) <= 2.5, "it waits by the place's tile, on the clod", { at: [f.x, f.y], want: [Math.round(ex.x), Math.round(ex.y)], tile: [Math.round(tile.x), Math.round(tile.y)] });
            check(tag, a.parent === "character-layer", "its button stands in the place's panel", a.parent);
            check(tag, a.top, "its button is the topmost thing at its middle", a.topIs);
            check(tag, inside(a.box, s.clod, 2), "it stands wholly on the clod", { box: a.box, clod: s.clod });
            check(tag, !over(a.box, s.work) && !over(a.box, s.head) && !over(a.box, s.dial) && !over(a.box, s.col) && !over(a.box, s.more), "clear of the picture, the place's sentence and the dial");
            check(tag, a.dots > 150, "it is drawn there", a.dots);
            check(tag, s.inPanel, "the canvas stands in the place's panel, after the clod and under the tile");
            check(tag, await seen(P, a.box), "and it shows over the panel (the canvas, hidden and shown: the box differs)", seen.got);
            if (SHOTS) { await P.screenshot({ path: `${SHOTS}/animal_${w}_${pl.life}_${pl.k}_followed.png` }); }
            // The next place of the life: the panel is made again, and the canvas, the buttons and the follower go with it.
            await P.evaluate(([l, k]) => Lives.enter(l, k), [pl.life, pl.next]);
            let n = null;
            for (let i = 0; i < 120; i++) {
              await P.waitForTimeout(500);
              n = await P.evaluate((k) => {
                const st = window.PlaceThen && PlaceThen._state(), w = Land.where && Land.where();
                return st && st.k === k && st.ready && !w.flying && PlaceThen.here() ? { k: st.k, panels: document.querySelectorAll(".pt").length } : null;
              }, pl.next);
              if (n) { break; }
            }
            check(tag, !!n && n.panels === 1, "the next place is up, the one panel", n);
            if (n) {
              let prev2 = null, t2 = null;
              for (let i = 0; i < 90; i++) {
                await P.waitForTimeout(600);
                t2 = await P.evaluate(survey);
                const g = t2.crowd.filter((c) => c.mode === "follow")[0];
                const cur = g && !g.hidden && [g.x, g.y];
                if (cur && prev2 && cur[0] === prev2[0] && cur[1] === prev2[1]) { break; }
                prev2 = cur;
              }
              const g2 = t2.crowd.filter((c) => c.mode === "follow")[0];
              const b2 = t2.animals.filter((x) => /press to let it go/.test(x.label || ""))[0];
              const tile2 = { x: (t2.tile.l + t2.tile.r) / 2, y: (t2.tile.t + t2.tile.b) / 2 };
              check(tag, t2.inPanel, "the canvas stands in the new panel");
              check(tag, !!g2 && !!b2 && b2.parent === "character-layer" && b2.top, "the follower is out there, its button topmost");
              const ex2 = g2 && b2 ? expectAnchor(b2, g2, tile2, t2.clod) : null;
              check(tag, !!ex2 && Math.abs(g2.x - ex2.x) <= 2.5 && Math.abs(g2.y - ex2.y) <= 2.5, "and it waits by the new place's tile, on its clod", ex2 && { at: [g2.x, g2.y], want: [Math.round(ex2.x), Math.round(ex2.y)], tile: [Math.round(tile2.x), Math.round(tile2.y)] });
              if (b2) { check(tag, inside(b2.box, t2.clod, 2), "and wholly on the new clod", { box: b2.box, clod: t2.clod }); }
              if (b2) { await press(b2.mid.x, b2.mid.y); } else { await P.evaluate(() => Land.unfollow()); }
            }
            await P.waitForTimeout(1200);
            const gone = await P.evaluate(() => !Land.following());
            check(tag, gone, "pressed, it is let go (a followed animal is)");
          }
        }
      }

      // Gone: the place put away, everything back in the stage.
      // (by "The whole life ›", or up a level: the banner's way back, Escape, a pinch)
      await P.evaluate(([l, up]) => { if (up) { Land.up(); } else { Lives.open(l, {}); } }, [pl.life, !!pl.up]);
      let back = null;
      for (let i = 0; i < 40; i++) {
        await P.waitForTimeout(400);
        back = await P.evaluate(() => {
          const cv = document.getElementById("characters"), tiles = document.getElementById("tiles"), stage = document.getElementById("stage");
          if (!cv) { return { none: true }; }
          return { placeGone: !document.querySelector(".pt"), canvasInStage: cv.parentNode === stage, afterTiles: cv.previousElementSibling === tiles,
                   buttons: [].slice.call(document.querySelectorAll("button.character")).filter((b) => b.getAttribute("aria-label") !== "A chimera — press to see what it is" && b.parentNode !== stage).length,
                   lines: [".character-says", ".character-pair"].filter((q) => { const e = document.querySelector(q); return e && e.parentNode !== stage; }).length };
        });
        if (back.none || (back.placeGone && back.canvasInStage)) { break; }
      }
      check(tag, back.none || (back.placeGone && back.canvasInStage && back.afterTiles && back.buttons === 0 && back.lines === 0), "the place put away: the canvas, buttons and lines are back in the stage", back);
      check(tag, errors.length === 0, "no page errors", errors.slice(0, 3));
      await ctx.close();
    }
  }
  await browser.close();
  console.log(failed ? failed + " failed" : "all passed");
  process.exit(failed ? 1 : 0);
})();
