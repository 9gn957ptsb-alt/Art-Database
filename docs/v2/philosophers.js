/* The philosophers (philosophers.js).

   The artist, 15 Oct 2026: "Add Character as a category filter and Philosophers category as well.
   Introduce notable philosophers as character relative to their native country or city."

   philosophers.json (scripts/build_philosophers.py) gives 216 notable philosophers, Wikidata's, each at
   their birthplace, with how they are to be drawn (`look`): a figure 24 cells by 40, three quarters
   turned, its feet on the ground of where it was born — a third of its cloth and the ground under it the
   DIRT soil there — dressed by the rule of the time and place of its birth (a chiton, a toga, a hanfu and
   a scholar's cap, a robe and a turban, a monk's habit, a doublet, a periwig, a powdered wig and a long
   coat, a frock coat, a suit) and, for the best known, with an emblem of their own life or work, its
   source said on its card (Diogenes' lantern, Spinoza's lens, Kierkegaard's umbrella, Zhuangzi's
   butterfly). Drawn here, cell by cell, outlined in the night's dark so it reads over sea, land or a
   roof, in the poses the page asks for: stand, walk (four frames), think (a hand to the chin).

   On the globe (land.js, the Philosophers layer) each is a mark at the birthplace: the figure, small, and
   the name it goes by; pressed, its card (`open`): the figure large on its soil, now and then thinking,
   its name and years, where it was born, Wikidata's line, the emblem and its source, the soil and two of
   the plants of its birthplace, and its three ways on (KINDS.md, "philosopher"): ◎ the city where it was
   born, ∵ the philosophers of its time (lives that overlapped), ○ the saved artists born in the same place.
   In a city (skyline.js) the philosophers born there walk its streets: all of them while its dial rests
   at now, those alive in the year it is turned to. Find finds them by name ("Philosophers").

   window.Philosophers: load, people, byQ, figure, draw, open, close, yearSaid. */
(function () {
  "use strict";
  var W = 24, H = 40, CX = 10;          // the figure's cells; its middle column
  var data = null, ask = null, byQ = {};
  var cache = {};

  function load() {
    if (data) { return Promise.resolve(data); }
    if (!ask) {
      ask = fetch("philosophers.json").then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        data = d || { people: [] };
        data.people.forEach(function (r) { byQ[r[0]] = r; });
        return data;
      }).catch(function () { ask = null; return { people: [] }; });
    }
    return ask;
  }

  function rgb(h) {
    if (!h) { return [128, 112, 96]; }
    if (Array.isArray(h)) { return h; }
    var m = /^#?([0-9a-f]{6})$/i.exec(h);
    if (!m) { return [128, 112, 96]; }
    var n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(c, k) { return [c[0] * k, c[1] * k, c[2] * k]; }
  function lift(c, k) { return [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k]; }
  function mix(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }

  var INK = [22, 16, 12], SHOE = [42, 34, 28], WHITE = [236, 230, 218], GOLD = [196, 160, 80], WOOD = [122, 90, 58],
      IRON = [120, 120, 124], GLASS = [168, 204, 222], FLAME = [244, 168, 60], FLAME2 = [255, 226, 130], RED = [168, 48, 42];

  /* ---- a figure, cell by cell ---------------------------------------------------------------- */
  function paint(look, pose, frame) {
    var cells = new Array(W * H), sk = rgb(look.sk), hc = rgb(look.hc), c1 = rgb(look.c1), c2 = rgb(look.c2);
    function put(x, y, c) { if (x >= 0 && y >= 0 && x < W && y < H && c) { cells[y * W + x] = c; } }
    function rect(x0, y0, x1, y1, c) { for (var y = y0; y <= y1; y += 1) { for (var x = x0; x <= x1; x += 1) { put(x, y, c); } } }
    function get(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? cells[y * W + x] : null; }
    var d = look.d || "suit", walking = pose === "walk", thinking = pose === "think", f = walking ? frame % 4 : 0;
    var up = look.e === "stars" && !walking;          // looking up at the stars
    var robe = /^(chiton|toga|hanfu|kimono|kesa|robe|thobe|gown|habit|dress|sari|caftan|tunic)$/.test(d);
    var knee = /^(frock|justaucorps|coat)$/.test(d), hip = /^(suit|jacket|turtleneck|doublet)$/.test(d);
    var c = CX, top = 12;
    var sway = walking ? [0, 1, 0, -1][f] : 0;

    // Legs and feet.
    var legs = d === "frock" && look.h === "wig" || d === "justaucorps" ? WHITE : d === "doublet" ? shade(c1, 0.8) : shade(c1, 0.7);
    if (d === "frock" && look.h !== "wig") { legs = shade(c1, 0.85); }
    var stride = walking ? [[-3, 2], [-1, 1], [1, -2], [-1, 1]][f] : [-1, 1];
    var footC = look.bare ? shade(sk, 0.9) : SHOE;
    if (!robe) {
      var hipY = hip ? 24 : 29;
      rect(c - 2 + Math.min(0, stride[0] + 1), hipY, c - 1 + Math.min(0, stride[0] + 1), 36, legs);
      rect(c + 1 + Math.max(0, stride[1] - 1), hipY, c + 2 + Math.max(0, stride[1] - 1), 36, shade(legs, 1.05));
      if (d === "doublet") { rect(c - 3, 22, c + 3, 26, shade(c1, 0.95)); }   // the trunk hose
    }
    rect(c - 3 + (walking ? stride[0] + 1 : 0), 37, c - 1 + (walking ? stride[0] + 1 : 0), 38, footC);
    rect(c + 1 + (walking ? stride[1] - 1 : 0), 37, c + 3 + (walking ? stride[1] - 1 : 0), 38, shade(footC, 1.1));

    // The body: a robe to the ankles, else a coat to the knee or the hip.
    var hem = robe ? 36 : knee ? 29 : hip ? 25 : 24;
    for (var y = top; y <= hem; y += 1) {
      var t = (y - top) / Math.max(1, hem - top);
      var half = robe ? 3 + Math.round(2.2 * t) : knee ? 3 + Math.round(1.4 * Math.max(0, t - 0.35) / 0.65) : 3;
      if (d === "dress" || d === "sari") { half = y < 21 ? 3 - (y > 17 ? 1 : 0) : 3 + Math.round(3 * (y - 21) / (hem - 21)); }
      var off = y > 26 ? sway : 0;
      rect(c - half + off, y, c + half + off, y, c1);
    }
    // What each dress has of its own.
    if (d === "chiton") {
      // The himation over the left shoulder and round the back, the right arm bare.
      for (var yy = top; yy <= 33; yy += 1) {
        var w0 = c - 5 + Math.round((yy - top) * 0.05), w1 = c - 1 + Math.round((yy - top) * 0.28);
        if (yy < 16) { w1 = c + 1; }
        rect(w0 < c - 5 ? c - 5 : w0, yy, Math.min(c + 4, w1), yy, c2);
      }
    } else if (d === "toga") {
      for (var ty = top; ty <= 30; ty += 1) { put(c - 2 + Math.round((ty - top) * 0.35), ty, shade(c2, 1)); }
      rect(c - 4, top, c - 2, 18, shade(c1, 0.92));
    } else if (d === "hanfu" || d === "kimono") {
      for (var hy = top; hy <= top + 3; hy += 1) { put(c + (hy - top), hy, c2); put(c + (hy - top) - 1, hy, c2); }
      rect(c - 3, 20, c + 3, 21, c2);                      // the sash, the obi
    } else if (d === "kesa") {
      rect(c + 1, top, c + 3, top + 3, sk);                // the right shoulder bare
      for (var ky = top; ky <= 34; ky += 1) { put(c - 4 + Math.round((ky - top) * 0.3), ky, shade(c1, 0.8)); }
    } else if (d === "thobe") {
      for (var by2 = top; by2 <= 35; by2 += 1) { rect(c - 3 - Math.round((by2 - top) * 0.09), by2, c - 1, by2, c2); }
    } else if (d === "habit") {
      rect(c, top, c + 1, hem, c2);                         // the scapular
      rect(c - 3, top - 1, c - 1, top + 1, c2);             // the hood, down
      rect(c - 3, 21, c + 3, 21, WHITE);                    // the belt
    } else if (d === "gown") {
      rect(c - 1, top, c + 1, top + 1, shade(c2, 0.7));
    } else if (d === "doublet") {
      rect(c - 3, 11, c + 3, 12, c2);                       // the ruff, the collar
      for (var dy = 14; dy <= 21; dy += 2) { put(c + 1, dy, GOLD); }
    } else if (d === "justaucorps" || d === "frock") {
      rect(c, 11, c + 1, 14, c2);                           // the cravat
      if (look.h === "wig") { rect(c + 1, 14, c + 2, 23, lift(c1, 0.35)); }   // the waistcoat
      rect(c + 2, 21, c + 3, 22, shade(c1, 0.75));          // a pocket flap
    } else if (d === "suit" || d === "jacket") {
      rect(c, 12, c + 1, 14, WHITE);
      if (d === "suit") { rect(c, 15, c, 20, shade(c2, 0.4)); }   // the tie
    } else if (d === "turtleneck") {
      rect(c - 2, 10, c + 2, 12, c1);
      rect(c - 3, 24, c + 3, 25, shade(c2, 1));
    } else if (d === "coat") {
      rect(c - 3, 20, c + 3, 20, shade(c1, 0.7));           // the belt
      rect(c + 1, 12, c + 3, 14, shade(c1, 1.1));           // the lapel
    } else if (d === "dress") {
      rect(c - 1, 12, c + 1, 13, c2);
    } else if (d === "sari") {
      for (var sy = top; sy <= 30; sy += 1) { put(c - 3 + Math.round((sy - top) * 0.32), sy, c2); put(c - 2 + Math.round((sy - top) * 0.32), sy, c2); }
    } else if (d === "caftan") {
      rect(c - 5, 35, c + 5, 36, c2); rect(c - 1, 12, c + 2, 14, c2);
    } else if (d === "tunic") {
      for (var fy = 20; fy <= 36; fy += 3) { rect(c - 6, fy, c + 6, fy, shade(c1, 0.82)); }
      rect(c - 3, top, c + 3, top, c2);
    } else if (d === "robe") {
      for (var ry = 13; ry <= 26; ry += 3) { put(c + 1, ry, shade(c1, 0.6)); }
    }

    // The back arm, a sliver behind; the front arm by the pose and what it holds.
    var sleeve = d === "chiton" ? sk : d === "kesa" ? c1 : shade(c1, 0.9);
    var wide = /^(hanfu|kimono|gown|habit|thobe|robe|caftan)$/.test(d);
    rect(c - 4, 13, c - 4, 22 + (walking ? [-1, 0, 1, 0][f] : 0), shade(sleeve, 0.78));
    var e = thinking ? null : look.e, held = e && /^(book|scroll|slips|tablet|notebook|quill|cup|lens|lyre|astrolabe|flowers|fire|heart|wheel|box|bowl|staff)$/.test(e);
    var hand;
    if (thinking) {
      rect(c + 3, 13, c + 4, 17, sleeve); rect(c + 3, 13, c + 3, 16, sleeve);
      rect(c + 4, 12, c + 4, 16, sleeve);
      hand = [c + 3, 10];
      rect(c + 3, 10, c + 4, 11, sk);
    } else if (held) {
      rect(c + 3, 13, c + 4, 17, sleeve);
      rect(c + 4, 17, c + 6, 18, sleeve);
      if (wide) { rect(c + 4, 18, c + 6, 19, shade(sleeve, 0.9)); }
      hand = [c + 7, 17];
      rect(c + 7, 17, c + 7, 18, sk);
    } else {
      var sw = walking ? [1, 0, -1, 0][f] : 0;
      rect(c + 3, 13, c + 4, 21, sleeve);
      if (wide) { rect(c + 5, 18, c + 5, 21, shade(sleeve, 0.9)); }
      hand = [c + 4 + sw, 22];
      rect(c + 3 + sw, 22, c + 4 + sw, 23, sk);
    }

    // The head: the face turned toward where it goes, the neck under it.
    var hy0 = 4 + (thinking ? 1 : 0);
    rect(c, hy0 + 7, c + 1, hy0 + 7, shade(sk, 0.85));
    rect(c - 1, hy0, c + 2, hy0, sk);
    rect(c - 2, hy0 + 1, c + 3, hy0 + 5, sk);
    rect(c - 1, hy0 + 6, c + 2, hy0 + 6, sk);
    put(c + 4, hy0 + 4, sk);                                // the nose
    var eyeY = hy0 + (up ? 2 : 3);
    put(c + 2, eyeY, INK);
    put(c + 2, hy0 + 5, shade(sk, 0.7));                    // the mouth
    put(c - 1, hy0 + 3, shade(sk, 0.8));                    // the ear
    // Hair.
    var hh = look.h || "short";
    if (hh === "short" || hh === "curly" || hh === "long" || hh === "bun" || hh === "quiff" || hh === "topknot") {
      rect(c - 1, hy0 - 1, c + 2, hy0 - 1, hc);
      rect(c - 2, hy0, c + 2, hy0, hc);
      rect(c - 2, hy0 + 1, c - 1, hy0 + 3, hc);
      if (hh === "curly") { put(c - 2, hy0 - 1, hc); put(c + 1, hy0 - 2, hc); put(c - 1, hy0 - 2, hc); put(c + 3, hy0, hc); }
      if (hh === "long") { rect(c - 3, hy0 + 1, c - 2, hy0 + 8, hc); rect(c - 2, hy0 + 4, c - 1, hy0 + 7, hc); }
      if (hh === "bun") { rect(c - 4, hy0 - 1, c - 2, hy0 + 1, hc); }
      if (hh === "quiff") { rect(c, hy0 - 3, c + 3, hy0 - 2, hc); put(c + 3, hy0 - 1, hc); }
      if (hh === "topknot") { rect(c, hy0 - 3, c + 1, hy0 - 2, hc); }
    } else if (hh === "bald") {
      rect(c - 2, hy0 + 2, c - 2, hy0 + 4, hc); put(c - 1, hy0 + 2, hc);
    } else if (hh === "tonsure") {
      rect(c - 2, hy0 + 1, c - 1, hy0 + 3, hc); rect(c, hy0, c + 2, hy0, shade(hc, 1)); put(c - 1, hy0, hc);
    } else if (hh === "wig") {
      var wc = hc;
      rect(c - 1, hy0 - 1, c + 2, hy0 - 1, wc); rect(c - 2, hy0, c + 2, hy0, wc);
      rect(c - 3, hy0 + 1, c - 1, hy0 + 4, wc);             // the rolls at the side
      rect(c - 3, hy0 + 6, c - 2, hy0 + 8, shade(wc, 0.85)); // the queue
      put(c - 3, hy0 + 5, INK);                             // its ribbon
    }
    // Beard.
    var bb = look.b || "none";
    if (bb === "moustache") { rect(c + 2, hy0 + 4, c + 3, hy0 + 4, hc); }
    else if (bb === "short") { rect(c - 1, hy0 + 4, c + 3, hy0 + 6, hc); put(c + 2, hy0 + 5, shade(sk, 0.7)); }
    else if (bb === "full") { rect(c - 1, hy0 + 4, c + 3, hy0 + 7, hc); rect(c, hy0 + 8, c + 2, hy0 + 8, hc); }
    else if (bb === "long") { rect(c - 1, hy0 + 4, c + 3, hy0 + 7, hc); rect(c, hy0 + 8, c + 2, hy0 + 11, hc); put(c + 1, hy0 + 12, hc); }
    // Glasses.
    if (look.g) { rect(c + 1, eyeY, c + 3, eyeY, INK); put(c + 2, eyeY, GLASS); }
    // What is on the head.
    var hd = look.hd;
    if (hd === "guan") { rect(c - 1, hy0 - 4, c + 2, hy0 - 2, INK); put(c + 3, hy0 - 3, GOLD); }
    else if (hd === "turban") { rect(c - 2, hy0 - 3, c + 3, hy0 + 1, d === "kesa" ? c2 : WHITE); put(c - 2, hy0 - 1, shade(WHITE, 0.85)); rect(c - 1, hy0 - 4, c + 2, hy0 - 4, d === "kesa" ? c2 : WHITE); }
    else if (hd === "cap") { rect(c - 2, hy0 - 2, c + 2, hy0, shade(c2 && d === "gown" ? c1 : [40, 34, 30], 1)); }
    else if (hd === "beret") { rect(c - 3, hy0 - 2, c + 2, hy0 - 1, [36, 32, 32]); put(c, hy0 - 3, [36, 32, 32]); }
    else if (hd === "hat") { rect(c - 1, hy0 - 4, c + 2, hy0 - 1, [34, 30, 28]); rect(c - 3, hy0 - 1, c + 4, hy0 - 1, [34, 30, 28]); }
    else if (hd === "laurel") { for (var lx = c - 2; lx <= c + 2; lx += 1) { put(lx, hy0 - 1, (lx & 1) ? [92, 128, 64] : [60, 96, 44]); } put(c - 2, hy0, [60, 96, 44]); put(c + 3, hy0, [92, 128, 64]); }
    else if (hd === "veil") { rect(c - 2, hy0 - 1, c + 2, hy0, c2); rect(c - 4, hy0 - 1, c - 2, hy0 + 9, c1); rect(c - 3, hy0 - 2, c + 1, hy0 - 2, c1); }
    else if (hd === "mitre") { rect(c - 1, hy0 - 5, c + 2, hy0 - 1, WHITE); put(c, hy0 - 6, WHITE); put(c + 1, hy0 - 6, WHITE); rect(c, hy0 - 5, c + 1, hy0 - 1, GOLD); }
    else if (hd === "fur") { rect(c - 2, hy0 - 3, c + 3, hy0, [58, 44, 34]); put(c - 2, hy0 - 4, [58, 44, 34]); put(c + 1, hy0 - 4, [58, 44, 34]); put(c + 3, hy0 - 4, [58, 44, 34]); }
    else if (hd === "band") { rect(c - 2, hy0, c + 3, hy0, GOLD); }

    // The emblem.
    var hx = hand[0], hyy = hand[1], fl = walking ? f : (frame || 0);
    switch (e) {
      case "book": rect(hx - 1, hyy - 3, hx + 2, hyy + 1, [118, 48, 40]); rect(hx + 2, hyy - 3, hx + 2, hyy + 1, WHITE); break;
      case "notebook": rect(hx - 1, hyy - 2, hx + 1, hyy + 1, [52, 50, 60]); put(hx + 1, hyy - 2, WHITE); break;
      case "scroll": rect(hx, hyy - 5, hx + 1, hyy + 2, [226, 214, 186]); rect(hx, hyy - 6, hx + 1, hyy - 6, WOOD); rect(hx, hyy + 3, hx + 1, hyy + 3, WOOD); break;
      case "slips": for (var sx = 0; sx < 4; sx += 1) { rect(hx - 1 + sx, hyy - 4, hx - 1 + sx, hyy + 1, sx & 1 ? [186, 160, 96] : [210, 186, 120]); } rect(hx - 1, hyy - 2, hx + 2, hyy - 2, [90, 70, 40]); break;
      case "tablet": rect(hx - 1, hyy - 4, hx + 2, hyy + 1, [176, 140, 98]); for (var tx = hx - 1; tx <= hx + 2; tx += 2) { put(tx, hyy - 2, [130, 100, 70]); put(tx + 1, hyy, [130, 100, 70]); } break;
      case "quill": put(hx, hyy, WHITE); for (var qx = 1; qx <= 4; qx += 1) { put(hx + qx, hyy - qx, WHITE); put(hx + qx + 1, hyy - qx, shade(WHITE, 0.82)); } break;
      case "cup": rect(hx - 1, hyy - 2, hx + 1, hyy, [150, 146, 136]); put(hx, hyy + 1, [150, 146, 136]); break;
      case "lens": rect(hx, hyy - 2, hx + 1, hyy - 1, GLASS); put(hx + 1, hyy - 2, WHITE); put(hx - 1, hyy - 1, IRON); break;
      case "lyre": rect(hx, hyy - 6, hx, hyy, GOLD); rect(hx + 3, hyy - 6, hx + 3, hyy, GOLD); rect(hx, hyy, hx + 3, hyy, GOLD); for (var lx2 = hx + 1; lx2 <= hx + 2; lx2 += 1) { rect(lx2, hyy - 5, lx2, hyy - 1, WHITE); } rect(hx - 1, hyy - 7, hx + 4, hyy - 7, GOLD); break;
      case "astrolabe": rect(hx - 1, hyy - 3, hx + 2, hyy, GOLD); put(hx, hyy - 2, INK); put(hx + 1, hyy - 1, INK); put(hx + 1, hyy - 4, GOLD); break;
      case "flowers": rect(hx + 1, hyy - 5, hx + 1, hyy, [70, 110, 60]); put(hx, hyy - 6, [214, 120, 150]); put(hx + 2, hyy - 6, [236, 210, 90]); put(hx + 1, hyy - 7, [180, 140, 220]); put(hx + 2, hyy - 4, [214, 120, 150]); break;
      case "fire": rect(hx, hyy - 3, hx + 1, hyy - 1, FLAME); put(hx + (fl & 1), hyy - 4, FLAME2); put(hx + ((fl + 1) & 1), hyy - 5, FLAME); put(hx, hyy - 2, FLAME2); break;
      case "heart": rect(hx - 1, hyy - 2, hx + 1, hyy - 1, RED); put(hx, hyy, RED); put(hx - 1, hyy - 3, RED); put(hx + 1, hyy - 3, RED); put(hx, hyy - 4 - (fl & 1), FLAME); break;
      case "wheel": rect(hx - 1, hyy - 4, hx + 3, hyy - 4, WOOD); rect(hx - 1, hyy, hx + 3, hyy, WOOD); rect(hx - 1, hyy - 3, hx - 1, hyy - 1, WOOD); rect(hx + 3, hyy - 3, hx + 3, hyy - 1, WOOD); put(hx + 1, hyy - 2, WOOD); put(hx, hyy - 3, WOOD); put(hx + 2, hyy - 1, WOOD); break;
      case "box": rect(hx - 1, hyy - 3, hx + 3, hyy, WOOD); put(hx, hyy - 2, GOLD); put(hx + 2, hyy - 2, GOLD); break;
      case "bowl": rect(hx - 5, hyy, hx - 1, hyy, [70, 52, 36]); rect(hx - 4, hyy + 1, hx - 2, hyy + 1, [70, 52, 36]); break;
      case "staff": rect(hx + 1, 2, hx + 1, 38, WOOD); break;
      case "stick": for (var k = 0; k <= 15; k += 1) { put(hx + 1 + Math.round(k * 0.12), hyy + k, [74, 56, 40]); } put(hx, hyy, [74, 56, 40]); break;
      case "umbrella": rect(hx + 1, hyy - 3, hx + 1, 37, [34, 30, 32]); rect(hx + 2, hyy + 2, hx + 2, hyy + 10, [44, 40, 44]); put(hx, hyy - 3, [34, 30, 32]); put(hx, hyy - 2, [34, 30, 32]); break;
      case "hammer": rect(hx, hyy - 1, hx, hyy + 6, WOOD); rect(hx - 2, hyy - 2, hx + 2, hyy - 1, IRON); break;
      case "hoe": for (var hk = 0; hk <= 20; hk += 1) { put(hx + Math.round(hk * 0.2), hyy - 6 + hk, WOOD); } rect(hx + 4, 36, hx + 6, 37, IRON); break;
      case "sword": for (var wk = 0; wk <= 13; wk += 1) { put(hx - 1 + Math.round(wk * 0.45), hyy - 2 + wk, [150, 112, 70]); } break;
      case "pipe": rect(c + 4, hy0 + 5, c + 5, hy0 + 5, [96, 64, 40]); put(c + 5, hy0 + 4, [96, 64, 40]); if (!walking || f < 2) { put(c + 6, hy0 + 2 - (fl & 1), [200, 196, 190]); put(c + 7, hy0 + 1 - (fl & 1), [170, 166, 160]); } break;
      case "lantern": rect(hx - 1, hyy + 2, hx + 1, hyy + 5, FLAME2); rect(hx - 1, hyy + 2, hx + 1, hyy + 2, IRON); rect(hx - 1, hyy + 5, hx + 1, hyy + 5, IRON); put(hx, hyy + 1, IRON); break;
      case "dog": rect(c + 7, 33, c + 11, 35, WHITE); rect(c + 11, 31, c + 13, 33, WHITE); put(c + 13, 32, INK); rect(c + 7, 36, c + 7, 38, WHITE); rect(c + 10, 36, c + 10, 38, WHITE); put(c + 6, 32, WHITE); put(c + 6, 31, WHITE); break;
      case "ladder": for (var lk = 0; lk <= 28; lk += 1) { put(c + 7 + Math.round(lk * 0.12), 38 - lk, WOOD); put(c + 10 + Math.round(lk * 0.12), 38 - lk, WOOD); if (lk % 4 === 2) { rect(c + 8 + Math.round(lk * 0.12), 38 - lk, c + 9 + Math.round(lk * 0.12), 38 - lk, shade(WOOD, 0.85)); } } break;
      case "rock": rect(c + 7, 31, c + 13, 38, [120, 112, 100]); rect(c + 8, 29, c + 12, 30, [120, 112, 100]); rect(c + 9, 28, c + 11, 28, [134, 126, 114]); put(c + 9, 32, [100, 94, 84]); break;
      case "stars": [[c + 6, 1], [c + 10, 3], [c + 13, 0], [c + 4, 0]].forEach(function (s, i) { if ((i + fl) % 3 !== 0) { put(s[0], s[1], FLAME2); } }); break;
      case "butterfly":
        var bx = c + 6 + [0, 1, 1, 0][fl % 4], byy = 2 + [0, 0, 1, 1][fl % 4];
        put(bx, byy, INK);
        if (fl % 2) { put(bx - 1, byy - 1, [236, 170, 60]); put(bx + 1, byy - 1, [236, 170, 60]); put(bx - 1, byy, [196, 120, 40]); put(bx + 1, byy, [196, 120, 40]); }
        else { put(bx - 1, byy, [236, 170, 60]); put(bx + 1, byy, [236, 170, 60]); }
        break;
    }

    // Light from the upper left: the back half a step darker.
    var out = new Uint8ClampedArray(W * H * 4);
    for (var yy2 = 0; yy2 < H; yy2 += 1) {
      for (var xx = 0; xx < W; xx += 1) {
        var col = cells[yy2 * W + xx];
        if (!col) { continue; }
        var k2 = xx < c - 1 ? 0.84 : xx > c + 2 ? 1.04 : 1;
        var o = (yy2 * W + xx) * 4;
        out[o] = Math.min(255, col[0] * k2); out[o + 1] = Math.min(255, col[1] * k2); out[o + 2] = Math.min(255, col[2] * k2); out[o + 3] = 255;
      }
    }
    // The outline: every empty cell beside a filled one, the night's dark.
    for (var y3 = 0; y3 < H; y3 += 1) {
      for (var x3 = 0; x3 < W; x3 += 1) {
        if (cells[y3 * W + x3]) { continue; }
        if (get(x3 - 1, y3) || get(x3 + 1, y3) || get(x3, y3 - 1) || get(x3, y3 + 1)) {
          var o3 = (y3 * W + x3) * 4;
          out[o3] = INK[0]; out[o3 + 1] = INK[1]; out[o3 + 2] = INK[2]; out[o3 + 3] = 225;
        }
      }
    }
    return out;
  }

  // A figure as a canvas of its cells (a pixel a cell), facing right (dir 1) or left (-1).
  function figure(q, pose, frame, dir) {
    var r = byQ[q];
    if (!r) { return null; }
    var key = q + "|" + (pose || "stand") + "|" + (frame || 0) + "|" + (dir < 0 ? "l" : "r");
    if (cache[key]) { return cache[key]; }
    var px = paint(r[11], pose || "stand", frame || 0);
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var g = cv.getContext("2d"), im = g.createImageData(W, H);
    if (dir < 0) {
      for (var y = 0; y < H; y += 1) {
        for (var x = 0; x < W; x += 1) {
          var a = (y * W + x) * 4, b = (y * W + (W - 1 - x)) * 4;
          im.data[b] = px[a]; im.data[b + 1] = px[a + 1]; im.data[b + 2] = px[a + 2]; im.data[b + 3] = px[a + 3];
        }
      }
    } else { im.data.set(px); }
    g.putImageData(im, 0, 0);
    cache[key] = cv;
    return cv;
  }
  // Drawn on another's canvas (its transform the device's pixels a CSS pixel), its feet at (x, y), u CSS px a cell.
  function draw(g, q, x, y, pose, frame, dir, u) {
    var cv = figure(q, pose, frame, dir);
    if (!cv) { return null; }
    var w = W * u, h = H * u, fx = dir < 0 ? (W - 1 - CX) : CX;
    var bx = Math.round(x - (fx + 0.5) * u), by = Math.round(y - 39 * u);
    var was = g.imageSmoothingEnabled;
    g.imageSmoothingEnabled = false;
    g.drawImage(cv, bx, by, w, h);
    g.imageSmoothingEnabled = was;
    return { x: bx, y: by, w: w, h: h };
  }

  function yearSaid(y) {
    if (y === null || y === undefined) { return ""; }
    return y <= 0 ? (1 - y) + " BCE" : String(y);
  }
  function lifeSaid(r) {
    var b = r[3], d = r[4];
    if (d === null || d === undefined) { return "born " + yearSaid(b); }
    if (b <= 0 && d <= 0) { return (1 - b) + "–" + (1 - d) + " BCE"; }
    return yearSaid(b) + "–" + yearSaid(d);
  }

  /* ---- the card -------------------------------------------------------------------------------- */
  var card = null, cardQ = null, cardTimer = 0, cardCanvas = null;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text) { e.textContent = text; } return e; }
  function close() {
    if (!card) { return; }
    window.clearInterval(cardTimer);
    card.remove();
    card = null;
    cardQ = null;
  }
  function open(q, at) {
    return load().then(function () {
      var r = byQ[q];
      if (!r) { return; }
      close();
      cardQ = q;
      card = el("section", "phil-card");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-label", r[1]);
      var x = el("button", "phil-close", "×");
      x.type = "button";
      x.setAttribute("aria-label", "Close");
      x.addEventListener("click", close);
      card.appendChild(x);
      // The figure, large, on a strip of its birthplace's soil.
      var stage = el("div", "phil-stage");
      stage.style.setProperty("--soil", r[13] && r[13][1] ? r[13][1] : "#8a7660");
      cardCanvas = document.createElement("canvas");
      cardCanvas.className = "phil-figure";
      var u = 3, dpr = Math.min(3, window.devicePixelRatio || 1);
      cardCanvas.width = Math.round(W * u * dpr); cardCanvas.height = Math.round(H * u * dpr);
      cardCanvas.style.width = W * u + "px"; cardCanvas.style.height = H * u + "px";
      cardCanvas.setAttribute("role", "img");
      cardCanvas.setAttribute("aria-label", r[1] + ", drawn in the dress of their time and place" + (r[12] ? ", with " + r[11].e : ""));
      stage.appendChild(cardCanvas);
      card.appendChild(stage);
      var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var tick = 0;
      function paintCard() {
        var g = cardCanvas.getContext("2d");
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        g.clearRect(0, 0, W * u, H * u);
        var pose = !still && tick % 9 >= 6 ? "think" : "stand";
        draw(g, q, CX * u + u / 2, H * u - u, pose, tick, 1, u);
        tick += 1;
      }
      paintCard();
      if (!still) { cardTimer = window.setInterval(paintCard, 700); }
      var words = el("div", "phil-words");
      words.appendChild(el("h2", "phil-name", r[1]));
      words.appendChild(el("p", "phil-years", lifeSaid(r) + " · born in " + r[5]));
      words.appendChild(el("p", "phil-desc", r[8].charAt(0).toUpperCase() + r[8].slice(1)));
      if (r[12]) { words.appendChild(el("p", "phil-said", r[12])); }
      var ground = r[13] && r[13][0] ? "On " + r[5] + "'s " + r[13][0] + (r[14] && r[14].length ? ", among " + r[14].join(" and ") : "") + " — DIRT Earth's soil and plants where they were born." : "";
      if (ground) { words.appendChild(el("p", "phil-ground", ground)); }
      // The three ways on (KINDS.md, "philosopher"): the city where they were born, the philosophers of
      // their time, the saved artists born in the same place.
      var three = el("div", "phil-three");
      three.setAttribute("role", "group");
      three.setAttribute("aria-label", "From " + r[2]);
      var panel = el("div", "phil-list");
      panel.hidden = true;
      if (r[10] && window.Land && Land.town) {
        var go = el("button", "phil-go", "◎ " + townName(r[10], r[5]) + " ›");
        go.type = "button";
        go.setAttribute("aria-label", "Into " + townName(r[10], r[5]) + ", where " + r[2] + " was born");
        go.addEventListener("click", function () { close(); Land.town(r[10]); });
        three.appendChild(go);
      }
      var time = ofTheirTime(r);
      if (time.length) {
        three.appendChild(tab("∵ Of their time · " + time.length, function () {
          return time.map(function (o) { return row(o.r[1], lifeSaid(o.r) + " · born in " + o.r[5], function () { open(o.r[0]); }); });
        }));
      }
      var bornTab = tab("○ Born there too", null);
      bornTab.hidden = true;
      three.appendChild(bornTab);
      bornThere(r).then(function (list) {
        if (!list.length || !bornTab.isConnected) { return; }
        bornTab.textContent = "○ Born there too · " + list.length;
        bornTab.hidden = false;
        bornTab._rows = function () {
          return list.map(function (L) { return row(L[1], [L[2], L[3]].filter(Boolean).join("–") + " · a life", function () { close(); if (window.Lives && Lives.open) { Lives.open(L[0]); } }); });
        };
      });
      function tab(words, rows) {
        var b = el("button", "phil-tab", words);
        b.type = "button";
        b.setAttribute("aria-expanded", "false");
        b._rows = rows;
        b.addEventListener("click", function () {
          var was = b.getAttribute("aria-expanded") === "true";
          Array.prototype.forEach.call(three.querySelectorAll(".phil-tab"), function (o) { o.setAttribute("aria-expanded", "false"); });
          panel.textContent = "";
          panel.hidden = was;
          if (was) { return; }
          b.setAttribute("aria-expanded", "true");
          (b._rows ? b._rows() : []).forEach(function (e) { panel.appendChild(e); });
        });
        return b;
      }
      function row(name, sub, go) {
        var b = el("button", "phil-row");
        b.type = "button";
        b.appendChild(el("span", "phil-row-name", name));
        b.appendChild(el("span", "phil-row-sub", sub));
        b.addEventListener("click", go);
        return b;
      }
      words.appendChild(three);
      words.appendChild(panel);
      words.appendChild(el("p", "phil-source", "Wikidata (CC0); the dress is the rule of their time and place."));
      card.appendChild(words);
      document.body.appendChild(card);
      try { x.focus({ preventScroll: true }); } catch (e) {}
      void at;
    });
  }
  // The philosophers whose lives overlapped this one's, the nearest in years first (the living as living now).
  function ofTheirTime(r) {
    var now = new Date().getFullYear(), b = r[3], d = r[4] === null || r[4] === undefined ? now : r[4];
    return data.people.filter(function (o) {
      if (o === r) { return false; }
      var ob = o[3], od = o[4] === null || o[4] === undefined ? now : o[4];
      return ob <= d && od >= b;
    }).map(function (o) { return { r: o, gap: Math.abs(o[3] - b) }; })
      .sort(function (x, y) { return x.gap - y.gap || y.r[9] - x.r[9]; }).slice(0, 34);
  }
  // The saved artists born in the same place: the Artists layer's mark there (lives.json: a town's births
  // within 40 km), its lives most saved first.
  var livesAsk = null;
  function bornThere(r) {
    if (!livesAsk) { livesAsk = fetch("lives.json").then(function (x) { return x.ok ? x.json() : null; }).catch(function () { livesAsk = null; return null; }); }
    return livesAsk.then(function (L) {
      if (!L || !L.marks) { return []; }
      var best = null, bd = 40;
      L.marks.forEach(function (m) {
        var dy = (m[0] - r[6]) * 111, dx = (m[1] - r[7]) * 111 * Math.cos(r[6] * Math.PI / 180), km = Math.sqrt(dx * dx + dy * dy);
        if (km < bd) { bd = km; best = m; }
      });
      if (!best) { return []; }
      return (best[4] || []).map(function (i) { return L.lives[i]; }).filter(Boolean)
        .sort(function (a, b) { return (b[5] || 0) - (a[5] || 0); }).map(function (x) { return [x[0], x[1], x[2], x[3]]; });
    });
  }

  /* ---- Find: a philosopher by name; "philosophers" for all ------------------------------------- */
  var field = document.getElementById("finder-field");
  var found = document.getElementById("finder-found");
  function fold(t) { return " " + String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " "; }
  function offer() {
    if (!field || !found) { return; }
    var text = field.value, t = fold(text);
    if (t.trim().length < 3) { return; }
    load().then(function () {
      if (field.value !== text) { return; }
      var old = found.querySelector(".phil-found");
      if (old) { old.remove(); }
      var all = /^ (philosophers?|philosophy) $/.test(t);
      var toks = t.split(" ").filter(Boolean);
      var rows = data.people.filter(function (r) {
        if (all) { return true; }
        var hay = fold(r[1] + " " + r[2]);
        return toks.every(function (k) { return hay.indexOf(" " + k) >= 0; });
      });
      if (!rows.length) { return; }
      var box = el("div", "explore-found phil-found");
      box.appendChild(el("p", "finder-group", "Philosophers" + (all ? " · " + rows.length + ", each at their birthplace" : "")));
      rows.slice(0, all ? 216 : 5).forEach(function (r) {
        var b = el("button", "finder-row finder-line studio-cat");
        b.type = "button";
        b.appendChild(el("span", "studio-cat-name", r[1]));
        b.appendChild(el("span", "studio-cat-meta", lifeSaid(r) + " · born in " + r[5]));
        b.addEventListener("click", function (event) {
          event.stopPropagation();
          // On the world: its Philosophers, turned to where they were born; then their card.
          if (window.Land && Land.where && Land.where().at === "world") {
            if (Land.chooseLayer) { Land.chooseLayer("philosophers"); }
            if (Land.globeAt) { Land.globeAt(r[6], r[7]); }
          }
          open(r[0]);
        });
        box.appendChild(b);
      });
      found.appendChild(box);
    });
  }
  if (field) { field.addEventListener("input", function () { window.setTimeout(offer, 380); }); }
  if (found && window.MutationObserver) {
    new MutationObserver(function () { if (field && !found.querySelector(".phil-found")) { offer(); } })
      .observe(found, { childList: true });
  }

  function townName(key, fallback) {
    var t = window.Land && Land.townName ? Land.townName(key) : null;
    return t || fallback;
  }
  document.addEventListener("keydown", function (event) { if (event.key === "Escape" && card) { close(); event.stopPropagation(); } }, true);

  window.Philosophers = {
    load: load,
    people: function () { return data ? data.people : []; },
    byQ: function (q) { return byQ[q] || null; },
    figure: figure,
    draw: draw,
    open: open,
    close: close,
    showing: function () { return cardQ; },
    yearSaid: yearSaid,
    lifeSaid: lifeSaid,
    size: { w: W, h: H, cx: CX }
  };
})();
