/* The adventures: an escape made, by a seed, from what the site holds.

   The art database (the works saved on Artsy, docs/v2/museums.json and each
   work's history, docs/v2/histories/<id>.json) and the buildings the site
   has modelled (docs/v2/models/: the museums with their interiors, and the
   Architectural Authority's houses and studios) are the material. An
   adventure is a crash outside one of them and the pieces of a rocket
   hidden there, as in Clue: each piece is behind one of the works hung
   there, and the clues that lead to it are made from what the works are,
   the fewest that leave only one: when and in which century it was made,
   what it is made of, its colour, its size, the floor and the room it
   hangs in, and last, if nothing else will do, who made it or a word of its
   title. One clue is in the wreck's log; the rest lie about the rooms as
   notes to be found.

   A house or a studio has a roof and a garden and sometimes a pool, and
   some of its pieces are there instead. A city is the hunt it always was:
   a roof, a park, the water, a tree.

   Adventures.make(setting, seed, data) → the adventure (plain data).
   Adventures.facts(work, history) → what a work is, for the clues. */

(function (root) {
  "use strict";

  var PIECES = ["The engine", "The fuel tank", "The guidance computer", "The heat shield"];
  var VOICES = ["The wreck's log says", "A night guard's note says", "Pencilled on a gallery plan:", "A torn ticket reads", "A visitor's diary says",
                "Scratched on a bench:", "A cleaner's list says", "A note under the door says"];
  var ORD = ["ground", "first", "second", "third", "fourth", "fifth", "sixth"];
  var CENT = { 13: "thirteenth", 14: "fourteenth", 15: "fifteenth", 16: "sixteenth", 17: "seventeenth", 18: "eighteenth", 19: "nineteenth", 20: "twentieth", 21: "twenty-first" };
  var STOP = { the: 1, and: 1, with: 1, from: 1, "for": 1, "of": 1, "in": 1, "on": 1, "at": 1, "a": 1, "an": 1, "de": 1, "la": 1, "le": 1, "les": 1, "des": 1, "du": 1, "untitled": 1, "study": 1, "number": 1 };

  function rng(seed) {
    var s = (Math.floor(seed) >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function shuffle(list, r) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i -= 1) { var j = Math.floor(r() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---- what a work is ----------------------------------------------------- */

  function mediumOf(m) {
    m = (m || "").toLowerCase();
    if (/photograph|gelatin|albumen|c-print|chromogenic|platinum|daguerreotype|cyanotype|archival pigment|inkjet print/.test(m)) { return "photograph"; }
    if (/etching|lithograph|woodcut|engraving|screenprint|silkscreen|aquatint|drypoint|linocut|mezzotint|\bprint\b/.test(m)) { return "print"; }
    if (/bronze|marble|plaster|terracotta|sculpture|carved|cast\b|ceramic|porcelain/.test(m)) { return "sculpture"; }
    if (/watercolou?r/.test(m)) { return "watercolour"; }
    if (/gouache/.test(m)) { return "gouache"; }
    if (/pastel/.test(m)) { return "pastel"; }
    if (/acrylic/.test(m)) { return "acrylic"; }
    if (/tempera/.test(m)) { return "tempera"; }
    if (/\boil\b/.test(m)) { return "oil"; }
    if (/charcoal|pencil|graphite|chalk|ink|crayon|drawing|pen\b/.test(m)) { return "drawing"; }
    return m ? "mixed" : "";
  }
  var MED_TEXT = { oil: "an oil painting", watercolour: "a watercolour", gouache: "a gouache", pastel: "a pastel", acrylic: "painted in acrylic",
                   tempera: "painted in tempera", drawing: "a drawing", print: "a print", photograph: "a photograph", sculpture: "a sculpture", mixed: "in mixed media" };

  function colourOf(hex) {
    if (!hex || hex.length < 7) { return ""; }
    var r = parseInt(hex.substr(1, 2), 16) / 255, g = parseInt(hex.substr(3, 2), 16) / 255, b = parseInt(hex.substr(5, 2), 16) / 255;
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn, s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    var h = 0;
    if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; }
    if (l < 0.16) { return "black"; }
    if (l > 0.86 && s < 0.35) { return "white"; }
    if (s < 0.18) { return l > 0.6 ? "pale grey" : "grey"; }
    if ((h < 45 || h > 330) && l < 0.42 && s < 0.7) { return "brown"; }
    if (h < 15 || h >= 330) { return "red"; }
    if (h < 45) { return l < 0.5 ? "brown" : "orange"; }
    if (h < 70) { return l < 0.42 ? "olive" : "yellow"; }
    if (h < 165) { return "green"; }
    if (h < 255) { return "blue"; }
    return "purple";
  }

  // The longest side, in centimetres, from "6 1/2 × 9 3/5 in" or "31 × 25 cm".
  function sizeOf(dim) {
    if (!dim) { return 0; }
    var m = String(dim).match(/^(.*?)(cm|in)\b/);
    if (!m) { return 0; }
    var nums = m[1].split(/[×x]/).map(function (s) {
      var v = 0;
      s.trim().split(/\s+/).forEach(function (q) {
        if (/^\d+\/\d+$/.test(q)) { var f = q.split("/"); v += (+f[0]) / (+f[1]); } else if (/^\d+(\.\d+)?$/.test(q)) { v += +q; }
      });
      return v;
    }).filter(function (v) { return v > 0; });
    if (!nums.length) { return 0; }
    var mx = Math.max.apply(null, nums);
    return m[2] === "in" ? mx * 2.54 : mx;
  }
  // Width and height in centimetres: a museum's own record [w, h], or Artsy's "H × W in".
  function dimsOf(w, dim) {
    if (w && w.cm && w.cm[0] && w.cm[1]) { return [+w.cm[0], +w.cm[1]]; }
    var m = String(dim || "").match(/^(.*?)(cm|in)\b/);
    if (!m) { return null; }
    var k = m[2] === "in" ? 2.54 : 1, nums = m[1].split(/[×x]/).map(function (s) {
      var v = 0;
      s.trim().split(/\s+/).forEach(function (q) {
        if (/^\d+\/\d+$/.test(q)) { var f = q.split("/"); v += (+f[0]) / (+f[1]); } else if (/^\d+(\.\d+)?$/.test(q)) { v += +q; }
      });
      return v;
    }).filter(function (v) { return v > 0; });
    if (nums.length < 2) { return null; }
    return [nums[1] * k, nums[0] * k];
  }
  function sizeClass(cm) { return !cm ? "" : cm < 36 ? "small" : cm < 100 ? "middling" : "large"; }
  var SIZE_TEXT = { small: "small, no bigger than a sheet of paper", middling: "of a middling size", large: "large, wider than your arms" };

  function yearOf(y) { var m = String(y || "").match(/(1[2-9]\d\d|20[0-2]\d)/); return m ? +m[1] : 0; }

  function facts(w, h) {
    h = h || {};
    var artists = h.artists && h.artists.length ? h.artists : [w.a].filter(Boolean);
    var year = yearOf(h.date || w.y), med = mediumOf(h.medium || w.m), wh = dimsOf(w, h.dimensions);
    var cm = wh ? Math.max(wh[0], wh[1]) : sizeOf(h.dimensions);
    var title = h.title || w.t || "";
    var words = title.replace(/[^A-Za-zÀ-ÿ' ]/g, " ").split(/\s+/).filter(function (x) { return x.length >= 4 && !STOP[x.toLowerCase()]; });
    return {
      id: w.id, title: title, artist: artists[0] || "", year: year, century: year ? Math.floor((year - 1) / 100) + 1 : 0,
      decade: year ? Math.floor(year / 10) * 10 : 0, medium: med, colour: colourOf((h.c || w.c || [])[0]), size: sizeClass(cm), cm: cm,
      words: words, image: h.image || String(w.i || "").split("/")[0], colours: h.c || w.c || [], dims: h.dimensions || "",
      wcm: wh ? wh[0] : 0, hcm: wh ? wh[1] : 0
    };
  }

  /* ---- the clues ------------------------------------------------------------ */

  // "on Level 2", "on the Main Floor", "on the first floor".
  function onFloor(name) {
    if (/^(level|floor)\s/i.test(name)) { return "on " + name; }
    if (/(floor|level|storey)$/i.test(name)) { return "on the " + name; }
    return "on the " + name + " floor";
  }

  // Everything true of the target that may be said, each a clause and how much it gives away.
  function sayable(t, all) {
    var out = [];
    var add = function (key, give, clause, test) { out.push({ key: key, give: give, clause: clause, test: test }); };
    if (all.some(function (f) { return f.floor !== t.floor; }) && t.floorName) { add("floor", 0, onFloor(t.floorName), function (f) { return f.floor === t.floor; }); }
    if (t.century && CENT[t.century]) { add("century", 0, "made in the " + CENT[t.century] + " century", function (f) { return f.century === t.century; }); }
    if (t.medium) { add("medium", 0, "that is " + MED_TEXT[t.medium], function (f) { return f.medium === t.medium; }); }
    if (t.colour) { add("colour", 0, "that is mostly " + t.colour, function (f) { return f.colour === t.colour; }); }
    if (t.size) { add("size", 0, "that is " + SIZE_TEXT[t.size], function (f) { return f.size === t.size; }); }
    if (t.decade) { add("decade", 1, "made in the " + t.decade + "s", function (f) { return f.decade === t.decade; }); }
    if (t.year) {
      // A year that splits the others: before it or after it.
      var years = all.map(function (f) { return f.year; }).filter(Boolean);
      [10, 20, 25, 50].forEach(function (step) {
        var up = Math.ceil((t.year + 1) / step) * step, down = Math.floor(t.year / step) * step;
        if (years.some(function (y) { return y >= up; })) { add("before" + up, 1, "made before " + up, function (f) { return f.year && f.year < up; }); }
        if (down > 0 && years.some(function (y) { return y < down; })) { add("after" + down, 1, "made in " + down + " or later", function (f) { return f.year && f.year >= down; }); }
      });
    }
    var meds = {};
    all.forEach(function (f) { if (f.medium && f.medium !== t.medium) { meds[f.medium] = (meds[f.medium] || 0) + 1; } });
    Object.keys(meds).forEach(function (m) { add("notmed-" + m, 1, "that is not " + MED_TEXT[m], function (f) { return f.medium !== m; }); });
    var others = {};
    all.forEach(function (f) { if (f.artist && f.artist !== t.artist) { others[f.artist] = (others[f.artist] || 0) + 1; } });
    Object.keys(others).forEach(function (a) { add("notby-" + a, 1, "not by " + a, function (f) { return f.artist !== a; }); });
    if (t.roomName) { add("room", 2, "in " + t.roomName, function (f) { return f.room === t.room; }); }
    if (t.artist) { add("by", 2, "by " + t.artist, function (f) { return f.artist === t.artist; }); }
    t.words.forEach(function (w) { add("word-" + w, 3, "with the word ‘" + w + "’ in its title", function (f) { return f.title.toLowerCase().indexOf(w.toLowerCase()) >= 0; }); });
    return out;
  }

  // The fewest things to say that leave only the target: broad first, telling last.
  function clueSet(t, all) {
    var left = all.slice(), said = [], can = sayable(t, all), used = {};
    for (var step = 0; step < 5 && left.length > 1; step += 1) {
      var best = null;
      can.forEach(function (p) {
        if (used[p.key]) { return; }
        var keep = left.filter(p.test);
        if (keep.length >= left.length || keep.indexOf(t) < 0) { return; }
        // The least telling clause that still narrows it; among those, the one that narrows most.
        var score = p.give * 100 + keep.length - (keep.length === 1 && step < 1 ? -50 : 0);
        if (!best || score < best.score) { best = { p: p, keep: keep, score: score }; }
      });
      if (!best) { break; }
      used[best.p.key] = 1;
      said.push(best.p.clause);
      left = best.keep;
    }
    return left.length === 1 ? said : null;
  }

  /* ---- an adventure ----------------------------------------------------------- */

  // "the Musée d'Orsay", "the Metropolitan Museum of Art", but "Tate Britain".
  var BARE = /^(Tate |Turner Contemporary|Ordrupgaard|LACMA|SFMOMA|MoMA)/;
  function theName(name) { return /^The /.test(name) ? "the " + name.slice(4) : BARE.test(name) ? name : "the " + name; }

  function make(setting, seed, data) {
    var r = rng(seed * 2654435761 + 97), a = {
      setting: setting, seed: seed, kind: setting.kind, title: "", where: setting.where || setting.name, intro: [], pieces: []
    };
    var name = setting.name;
    if (setting.kind === "city") {
      a.title = "Escape from " + name;
      a.intro = ["Somewhere over " + name + ", the descent went wrong.", "You come to under a tree. Your capsule is in pieces.", name];
      a.pieces = PIECES.map(function (p, k) { return { k: k, name: p, hide: { type: ["roof", "park", "water", "tree"][k] }, clues: [] }; });
      return a;
    }
    var hung = (data.works || []).map(function (x) {
      var f = x.f || facts(x.work, x.history);
      f.room = x.room || ""; f.roomName = x.roomName || ""; f.floor = x.floor || 0;
      f.floorName = x.floorName !== undefined ? x.floorName : ORD[x.floor || 0] || "";
      f.work = x.work;
      return f;
    }).filter(function (f) { return f.image; });
    var voices = shuffle(VOICES.slice(1), r);
    var hideWorks = setting.kind === "museum" ? 4 : 2;
    var chosen = [];
    shuffle(hung, r).forEach(function (t) {
      if (chosen.length >= hideWorks) { return; }
      // Spread the pieces about: not two in one room if there is any other.
      if (chosen.some(function (c) { return c.f.room && c.f.room === t.room; }) && hung.length > 8) { return; }
      var cs = clueSet(t, hung);
      if (cs && cs.length >= 2) { chosen.push({ f: t, clues: cs }); }
    });
    if (chosen.length < hideWorks) {
      shuffle(hung, r).forEach(function (t) {
        if (chosen.length >= hideWorks || chosen.some(function (c) { return c.f === t; })) { return; }
        var cs = clueSet(t, hung);
        if (cs) { chosen.push({ f: t, clues: cs.length ? cs : ["hung here"] }); }
      });
    }
    var vi = 0;
    var phrase = function (piece, clause, first) {
      var v = first ? VOICES[0] : voices[vi++ % voices.length];
      return v + (/:$/.test(v) ? " " : " ") + piece.charAt(0).toLowerCase() + piece.slice(1) + " is behind a work " + clause + ".";
    };
    var k = 0;
    chosen.forEach(function (c) {
      var p = PIECES[k];
      a.pieces.push({ k: k, name: p, hide: { type: "work", id: c.f.id }, clues: c.clues.map(function (cl, i) { return phrase(p, cl, i === 0); }) });
      k += 1;
    });
    var over = setting.city || String(setting.where || "").split(",")[0];
    if (setting.kind === "museum") {
      a.title = "Escape from " + theName(name);
      a.intro = ["Somewhere over " + over + ", the descent went wrong.", "You come to under a tree outside " + theName(name) + ". Your capsule is in pieces, and the pieces are inside.", name];
    } else {
      a.title = "Escape from " + name;
      a.intro = ["Somewhere over " + over + ", the descent went wrong.", "You come to under a tree outside " + name.replace(/^The /, "the ") + ". Your capsule is in pieces.", name];
      var rest = [{ type: "roof", clue: "The wreck's log says one piece rolled onto the roof. Stack blocks to climb to it." },
                  data.pool ? { type: "pool", clue: "The wreck's log says one piece sank in the pool. Swim down for it." }
                            : { type: "garden", clue: "The wreck's log says one piece dug itself into the garden. Look for loose earth, and dig." }];
      rest.forEach(function (h) {
        if (k >= 4) { return; }
        a.pieces.push({ k: k, name: PIECES[k], hide: { type: h.type }, clues: [h.clue] });
        k += 1;
      });
    }
    // Whatever could not be hidden behind a work goes to the roof.
    while (a.pieces.length < 4) { a.pieces.push({ k: a.pieces.length, name: PIECES[a.pieces.length], hide: { type: "roof" }, clues: ["The wreck's log says one piece rolled onto the roof."] }); }
    a.hung = hung.map(function (f) { return { id: f.id, room: f.room, floor: f.floor }; });
    return a;
  }

  var api = { make: make, facts: facts, clueSet: clueSet, PIECES: PIECES, mediumOf: mediumOf, colourOf: colourOf, sizeOf: sizeOf, dimsOf: dimsOf, onFloor: onFloor, theName: theName };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; } else { root.Adventures = api; }
})(typeof window !== "undefined" ? window : this);
