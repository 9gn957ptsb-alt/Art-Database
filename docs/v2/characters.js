/* The characters — who comes out of the wave in a city, and who lives where.

   The artist, 1 Oct 2026: "When I click on the screen when viewing a city
   there's a cool wave of purple or blue pixels that echo from the places I
   touched. It's moments like that which we can tie character generation
   into the website through DIRT along with corresponding plants and
   artists … Nothing too much, start with one character."

   So: now and then, out of that wave, one character steps from the middle
   of the ring and goes off along the ground and out of view, and round the
   ring the plants of that city's own biome and realm rise in DIRT dots,
   crowns seen from above in their stratum's shape, and after a while sink
   back. Each is an animal of DIRT's grammar drawn after one of DIRT's
   artists (characters/characters.json says why): its dots are the soil
   where it stands worked into the artist's inks, it moves in its own gait
   (the fox trots, the bison walks, the squirrel bounds, the eagle flies up
   and away, the slug crawls and goes back into the soil), and some leave
   something of their artist behind (Twombly's writing after the fox, the
   dark trace of Kapoor's wax after the slug). Pressed, one stops and looks
   at you, is framed in its artist's ink, and a quiet line says what it is.
   Nothing links anywhere.

   The correspondence (the artist, 1 Oct 2026: "Establish a correspondence
   between the Artist associated with animals and plants and where their
   artwork is located throughout the world … When an animal comes up that
   is associated with an artist, I want you to be able to use that animal as
   an additional way to navigate through the globe"). Each character's
   artist has a map (characters/artists.json): every city where the artist's
   saved works are held or have been, and home, from Wikidata, with the
   plants of home. A character comes to the cities on its artist's map: the
   first wave in one of them brings it. Anywhere else it comes only now and
   then, as a guide toward the nearest. Round the ring rise two plantings:
   the city's own and, among them, home's (in the artist's inks, outlined in
   chalk). Pressed, it offers to be followed (land.js, `Land.follow`).

   Hometowns (the artist, 1 Oct 2026: "I want there to be other animals
   besides the fox as well. Perhaps attributing artists to their hometown is
   a good way to introduce new animals to scenes when on route of an
   artwork. It's okay to have more than one animal present at a time, but
   too many can be overwhelming and distracting"). An artist's home town is
   the city of the site within 25 km of the birthplace (artists.json's
   home.key: Brooklyn is New York, Bradford is Leeds, Pittsburgh is
   Pittsburgh); the artist's animal lives there:
   - a journey that arrives there (a door, Near here, a history's stop, a
     walk, following) is met by it: it comes in from the side the journey
     came from (a slow one comes up out of the soil there) and stands by
     the city's middle, looks, sits, and after φ⁶ s goes on;
   - a journey that passes over it (a town the way names as it goes) shows
     it there, small, far below, looking up, while the town is named;
   - a work's history that has been there shows it, small, sitting at that
     stop, once the work's first look is over;
   - going down into it any other way, it is there at rest, sitting, one
     visit in φ²;
   - a wave there brings it before any other.
   Only drawn characters, each once a visit to a city.

   A crowd, never: at most two animals on a phone and three on a desktop,
   counting one being followed; a second never comes within φ³ s of the
   last; each keeps its own height and side (one comes in below or across
   from another, never on it). Two that meet face each other a while, and if
   their artists' works share something the threads know (a show, an owner,
   a writing, a sale, a museum: artists.json's pairs), a line between them
   says it, the thing itself a door to its thread. After a wave's animal
   has gone, no wave brings one for φ⁸–φ⁹ s. Under reduced motion no one
   comes.

   Data: characters/characters.json (the cast, each with its moves),
   characters/<id>.json (its poses, a letter a cell), characters/plants.json,
   characters/artists.json (each artist's map and home, and the pairs), all
   written by scripts/build_characters.py; cities.json for where the home
   towns are. land.js says when a wave is fired (`Characters.wave`), where
   a followed animal is to be (`Characters.guide`), and, through
   `Land.where`, `Land.journey` and `Land.at`, where you are and are going. */

(function () {
  "use strict";

  var PHI = (1 + Math.sqrt(5)) / 2;
  var BASE = "characters/";
  var FPS = 8;                         // the trot's held frames, steps() timing (a character's moves.fps)
  var SPEED = 58;                      // CSS px a second at the trot: a journey, not a race
  var RISE = 1100;                     // plants rising or sinking, ms
  var STAND = Math.pow(PHI, 4) * 1000; // plants stand at least this long
  var SAY = Math.pow(PHI, 5) * 1000;   // the line stays this long when pressed
  var REST = [Math.pow(PHI, 8) * 1000, Math.pow(PHI, 9) * 1000];
  var GAP = Math.pow(PHI, 3) * 1000;   // never two comings closer than this
  var HOME_STAY = Math.pow(PHI, 6) * 1000;   // a home animal that met a journey stays this long
  var AT_REST = 1 / (PHI * PHI);       // the chance a home animal is seen at rest, going down any other way
  var LIGHT = [-0.62, -0.78];          // toward the light: up and to the left
  var CELL = 2;                        // CSS px a dot of the plants
  var APART = 120;                     // CSS px: two animals never stand nearer than this
  var MEET = 104;                      // ... except two that meet, this far apart, facing

  var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var GUIDE = 1 / Math.pow(PHI, 3);    // the chance one comes, as a guide, to a city not on its artist's map
  var NEAR_KM = 30;                    // a collage's city is a city of the map this near
  var cast = null, plants = null, artists = null, sprites = {};
  var towns = null, townIx = null;     // cities.json, read when a home town is needed
  var loading = null, townsLoading = null;
  var crowd = [];                      // the characters out now
  var restUntil = 0, lastCame = -1e9;
  var visit = { key: null, waved: false, seen: {} };
  var canvas = null, g = null, dpr = 1, W = 0, H = 0;
  var says = null, saying = null, pair = null;
  var prefer = null;                   // the checks: the one a wave brings, when it may
  var raf = 0;
  var spriteCache = {};

  /* ---- reading the files ----------------------------------------------- */

  function get(name) {
    return fetch(name).then(function (r) {
      if (!r.ok) { throw new Error(name + " " + r.status); }
      return r.json();
    });
  }

  function load() {
    if (loading) { return loading; }
    loading = Promise.all([get(BASE + "characters.json"), get(BASE + "plants.json"),
                           get(BASE + "artists.json").catch(function () { return null; })]).then(function (got) {
      cast = got[0];
      plants = got[1];
      artists = got[2];
      return Promise.all(cast.cast.map(function (c) {
        return get(BASE + c.id + ".json").then(function (s) { sprites[c.id] = s; }, function () {});
      }));
    }).catch(function () { cast = null; });
    return loading;
  }

  function loadTowns() {
    if (townsLoading) { return townsLoading; }
    townsLoading = get("cities.json").then(function (c) {
      towns = c.towns;
      townIx = {};
      towns.forEach(function (t, i) { townIx[t[0]] = i; });
    }, function () { towns = []; townIx = {}; });
    return townsLoading;
  }

  function townOf(key) {
    var i = townIx && townIx[key];
    return i === undefined || !towns ? null : { key: key, name: towns[i][1], lat: towns[i][3], lon: towns[i][4] };
  }

  // A character's moves: its gait's speed and frames, its pause, how it leaves, what it leaves behind.
  function moves(c) {
    var m = c.moves || {};
    return { speed: m.speed || 1, fps: m.fps || FPS, pause: m.pause === undefined ? "back" : m.pause,
             leave: m.leave || "edge", lift: m.lift || 0, trail: m.trail || null };
  }

  function drawn() { return cast ? cast.cast.filter(function (c) { return sprites[c.id]; }) : []; }

  function cap() { return W && W < 720 ? 2 : 3; }

  function outNow(id) { return crowd.filter(function (o) { return o.c.id === id && o.state !== "gone"; })[0]; }

  // Whether one more may come now: room in the crowd, not the same animal, not too soon.
  function room(id, now) {
    var live = crowd.filter(function (o) { return o.state !== "gone"; });
    return !still && live.length < cap() && !outNow(id) && now - lastCame >= GAP;
  }

  /* ---- colour ------------------------------------------------------------ */

  function rgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function mix(a, b, t) {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function css(c, jitter) {
    var j = jitter || 0;
    return "rgb(" + Math.max(0, Math.min(255, Math.round(c[0] + j))) + "," +
      Math.max(0, Math.min(255, Math.round(c[1] + j))) + "," +
      Math.max(0, Math.min(255, Math.round(c[2] + j))) + ")";
  }

  function hash(i, j, s) {
    var n = (i * 73856093) ^ (j * 19349663) ^ ((s || 0) * 83492791);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) % 1024 / 1024;
  }

  var BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function bayer(i, j) { return (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16; }

  /* ---- where we are ------------------------------------------------------ */

  // The plants file's nearest place to a point, within a degree and a half.
  function placeAt(lat, lon) {
    if (!plants) { return null; }
    var best = null, bd = 2.25;
    plants.places.forEach(function (p) {
      var dl = p[0] - lat, dn = ((p[1] - lon + 540) % 360) - 180;
      dn *= Math.cos(lat * Math.PI / 180);
      var d = dl * dl + dn * dn;
      if (d < bd) { bd = d; best = p; }
    });
    if (!best) { return null; }
    var set = plants.sets[best[2]];
    var soil = plants.soils[best[4]];
    return { set: set, eco: plants.ecoregions[best[3]], soil: soil[0], soilRgb: rgb(soil[1]) };
  }

  /* ---- the artist's map ----------------------------------------------------

     Where the artist's works are or have been (artists.json), and home. */

  function mapOf(c) {
    var m = artists && artists.artists && artists.artists[c.artist];
    return m && m.places && m.places.length ? m : null;
  }

  function km(lat1, lon1, lat2, lon2) {
    var r = Math.PI / 180;
    var h = Math.pow(Math.sin((lat2 - lat1) * r / 2), 2) +
      Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.pow(Math.sin((lon2 - lon1) * r / 2), 2);
    return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  // The map's row for a city: by its key, or (a collage's city) within 30 km.
  function rowHere(m, city) {
    if (!m || !city) { return null; }
    var hit = null;
    m.places.forEach(function (r) {
      if (hit) { return; }
      if (r[0] === city.key || km(r[3], r[4], city.lat, city.lon) < NEAR_KM) { hit = r; }
    });
    return hit;
  }

  function nearestRow(m, lat, lon) {
    var best = null;
    m.places.forEach(function (r) {
      var d = km(r[3], r[4], lat, lon);
      if (!best || d < best.km) { best = { row: r, km: d }; }
    });
    return best;
  }

  // Home: where the artist was born, and the plants there (plants.json's set).
  function homeOf(m) {
    var h = m && m.home;
    if (!h || !h.plants || !plants) { return null; }
    var set = plants.sets[h.plants[0]];
    return set ? { where: h.where, name: h.name, set: set } : null;
  }

  // The artist's inks for the plants of home: the dark of the drawing, then
  // the writing's two inks (Twombly's pale greens of Roman Notes), else the coat.
  function homeLook(c) {
    var k = c.after.inks;
    if (k.home) { return k.home; }
    var w = k.writing || [k.coat[2], k.coat[1]];
    return [k.black[0], w[w.length - 1], w[0]];
  }

  // The site's city an artist was born in (or within 25 km of), if any.
  function homeKey(c) {
    var a = artists && artists.artists && artists.artists[c.artist];
    return a && a.home && a.home.key || null;
  }

  function homesOf(key) {
    return drawn().filter(function (c) { return homeKey(c) === key; });
  }

  // What two artists' saved works share, as the threads know it (artists.json's pairs).
  function pairOf(a, b) {
    var p = artists && artists.pairs;
    if (!p) { return null; }
    var k = [a, b].sort().join("|");
    var got = p[k];
    return got && got.length ? got[0] : null;
  }

  /* ---- the canvas -------------------------------------------------------- */

  function setUp() {
    if (canvas) { return true; }
    var tiles = document.getElementById("tiles");
    var stage = document.getElementById("stage");
    if (!tiles || !stage) { return false; }
    canvas = document.createElement("canvas");
    canvas.className = "world world-tiles characters";
    canvas.id = "characters";
    canvas.setAttribute("aria-hidden", "true");
    tiles.parentNode.insertBefore(canvas, tiles.nextSibling);
    g = canvas.getContext("2d");

    says = document.createElement("p");
    says.className = "character-says";
    says.setAttribute("aria-live", "polite");
    says.hidden = true;
    stage.appendChild(says);

    pair = document.createElement("p");
    pair.className = "character-pair";
    pair.setAttribute("aria-live", "polite");
    pair.hidden = true;
    pair.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    stage.appendChild(pair);

    // Leaving the city ends the visit and takes everyone with it, but the
    // one being followed, and the ones seen from a journey or a history.
    var land = document.getElementById("land");
    if (land && window.MutationObserver) {
      new MutationObserver(function () {
        if (land.dataset.at !== "city") { endVisit(); }
      }).observe(land, { attributes: true, attributeFilter: ["data-at"] });
    }
    return true;
  }

  // Each character pressed through its own bare button, which follows it.
  function hitFor(o) {
    var stage = document.getElementById("stage");
    var b = document.createElement("button");
    b.type = "button";
    b.className = "character";
    b.hidden = true;
    b.setAttribute("aria-label", o.c.name + " — press to see what it is");
    b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    b.addEventListener("click", function (event) { event.stopPropagation(); press(o); });
    if (stage) { stage.appendChild(b); }
    return b;
  }

  function size() {
    var d = Math.min(3, window.devicePixelRatio || 1);
    var w = window.innerWidth, h = window.innerHeight;
    if (w !== W || h !== H || d !== dpr) {
      W = w; H = h; dpr = d;
      if (canvas) {
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
      }
      spriteCache = {};
    }
  }

  /* ---- the sprite, in DIRT ------------------------------------------------

     Each cell of a pose is one dot: the artist's ink for what it is (the
     coat, the white, the black, the eye, the pen), the soil of the place
     worked a fifth of the way into it, a little grain per dot, and every
     tenth dot or so a size smaller, so it reads as DIRT's weave and not as
     paint. Drawn once per pose, way, size and place, at the screen's own
     pixels. One seen far below (from a journey, at a history's stop) is
     drawn at half size: one screen pixel a cell. */

  function inkFor(c) {
    var k = c.after.inks;
    return {
      d: rgb(k.coat[0]), R: rgb(k.coat[1]), r: rgb(k.coat[2]), g: rgb(k.coat[3]),
      W: rgb(k.white[0]), w: rgb(k.white[1]),
      k: rgb(k.black[0]), K: rgb(k.black[1]),
      y: rgb(k.eye), o: rgb(k.pen[0]), p: rgb(k.pen[1])
    };
  }

  function sprite(c, pose, n, dir, here, scale) {
    var s = sprites[c.id];
    if (!s.poses[pose]) { pose = "stand"; }
    n = n % s.poses[pose].length;
    scale = scale || 1;
    var key = c.id + "|" + pose + "|" + n + "|" + dir + "|" + scale + "|" + (here ? here.soil : "");
    if (spriteCache[key]) { return spriteCache[key]; }
    var rows = s.poses[pose][n];
    var px = Math.max(1, Math.round(s.cell * dpr * scale));
    var cv = document.createElement("canvas");
    cv.width = s.w * px;
    cv.height = s.h * px;
    var x = cv.getContext("2d");
    var ink = c._ink || (c._ink = inkFor(c));
    var soil = here ? here.soilRgb : [120, 100, 80];
    for (var j = 0; j < rows.length; j += 1) {
      for (var i = 0; i < rows[j].length; i += 1) {
        var ch = rows[j].charAt(i);
        if (ch === "." || !ink[ch]) { continue; }
        var line = ch === "o" || ch === "p";
        var col = mix(ink[ch], soil, line ? 0.08 : 0.2);
        var h = hash(i, j, 7);
        x.fillStyle = css(col, line ? 0 : (h - 0.5) * 10);
        var ii = dir > 0 ? i : s.w - 1 - i;
        var d = px;
        // A dot now and then a little smaller, as DIRT's are, never leaving a gap
        // wide enough to read as a mark of its own.
        if (!line && px > 3 && hash(i, j, 3) < 0.1) { d = px - 1; }
        x.fillRect(ii * px, j * px, d, d);
      }
    }
    spriteCache[key] = { cv: cv, px: px, w: s.w, h: s.h, foot: s.foot };
    return spriteCache[key];
  }

  /* ---- the plants ---------------------------------------------------------

     Round the ring, the place's own plants rise, a crown at a time, each in
     the shape DIRT's grammar gives its stratum (a lobed broadleaf, a
     conifer's star, an umbrella, a palm, a column, tussocks, a cushion, a
     rosette, reeds, a mangrove), coloured from the biome's own look and lit
     from the upper left, its shadow down and to the right, in dots on a
     grid of their own. They come up a row at a time out of the soil and go
     back down it. */

  function crownAt(shape, dx, dy, R, seed) {
    var rho = Math.sqrt(dx * dx + dy * dy), th = Math.atan2(dy, dx);
    var a0 = seed * 6.283;
    switch (shape) {
      case "cone":
        return rho < R * (0.55 + 0.45 * Math.pow(Math.abs(Math.cos(4 * th + a0)), 4));
      case "umbrella":
        return rho < R * (0.96 + 0.04 * Math.cos(7 * th + a0)) && Math.abs(dy) < R * 0.8;
      case "palm": {
        var k = (th + a0) / (Math.PI / 4);
        var off = Math.abs(k - Math.round(k)) * (Math.PI / 4) * rho;
        return rho < R && off < R * 0.16 * (1.15 - rho / R) + 0.6;
      }
      case "column":
        return rho < R * 0.45;
      case "tussock": {
        for (var t = 0; t < 4; t += 1) {
          var ta = a0 + t * 2.4, tr = R * 0.45;
          var ex = dx - Math.cos(ta) * tr, ey = dy - Math.sin(ta) * tr;
          if (ex * ex + ey * ey < R * R * 0.12) { return true; }
        }
        return false;
      }
      case "cushion":
        return (dx * dx) / (R * R) + (dy * dy) / (R * R * 0.55) < 1;
      case "rosette":
        return rho < R * (0.35 + 0.65 * Math.pow(Math.abs(Math.cos(6.5 * th + a0)), 2));
      case "reed":
        return rho < R && hash(Math.round(dx), Math.round(dy), 11) < 0.42;
      case "mangrove":
        return rho < R * (0.86 + 0.08 * Math.cos(9 * th + a0) + 0.06 * Math.cos(4 * th));
      default:     // lobed
        return rho < R * (0.82 + 0.12 * Math.cos(5 * th + a0) + 0.06 * Math.cos(13 * th + a0 * 2));
    }
  }

  function makeCrown(shape, R, look, soil, seed, opts) {
    // In plant cells (CELL px), relative to the crown's middle.
    opts = opts || {};
    var n = Math.ceil(R / CELL) + 1;
    var dots = [], shade = [];
    var lo = look.map(rgb);
    var worked = opts.soil === undefined ? 0.15 : opts.soil;   // how much of the soil here is in it
    var inside = {};
    for (var jj = -n; jj <= n; jj += 1) {
      for (var ii = -n; ii <= n; ii += 1) {
        if (crownAt(shape, ii * CELL, jj * CELL, R, seed)) { inside[ii + "," + jj] = true; }
      }
    }
    var line = opts.outline ? css(rgb(opts.outline)) : null;
    var drop = Math.max(1, Math.round((shape === "umbrella" ? 0.6 : shape === "column" ? 0.7 : 0.3) * R / CELL));
    for (var j = -n; j <= n; j += 1) {
      for (var i = -n; i <= n; i += 1) {
        var dx = i * CELL, dy = j * CELL;
        if (!crownAt(shape, dx, dy, R, seed)) { continue; }
        var l = 0.5 + 0.5 * (dx * LIGHT[0] + dy * LIGHT[1]) / R;
        if (shape === "column") { l *= 0.55; }
        var v = l * 3 - 0.5, k = Math.floor(v);
        if (v - k > bayer(i, j)) { k += 1; }
        k = Math.max(0, Math.min(2, k));
        // A crown from elsewhere is outlined in chalk, as the fox is.
        // Drawn on its shadow side only, so the inks show.
        var edge = line && !(inside[(i + 1) + "," + j] && inside[i + "," + (j + 1)]);
        dots.push({ i: i, j: j, c: edge ? line : css(mix(lo[k], soil, worked), (hash(i, j, seed * 97 | 0) - 0.5) * 16),
                    small: !edge && hash(i, j, 5) < 0.3 });
        shade.push({ i: i + drop, j: j + drop });
      }
    }
    var lowest = -n, highest = n;
    return { dots: dots, shade: shade, shadeC: css(mix(lo[0], [0, 0, 0], 0.45)), top: lowest, bottom: highest };
  }

  function growPlants(x, y, r, here, seed, home) {
    var out = [];
    if (!here || !here.set.strata.length) { return out; }
    var strata = here.set.strata;
    var total = strata.reduce(function (a, s) { return a + s[3]; }, 0);
    var n = Math.min(13, 7 + Math.round(total * 3));
    var ring = Math.max(56, r);
    var a = seed * 6.283;
    // The plants of the artist's home, among the city's own: a few, in the
    // artist's inks, outlined in chalk, of no soil here, each half a golden
    // angle from a native crown; and only where home is not this same ground.
    var away = home && home.set !== here.set && home.set.strata.length ? home : null;
    var homeEvery = away ? Math.max(2, Math.floor(n / 3)) : 0;
    for (var k = 0; k < n; k += 1) {
      a += 2.39996;                                  // the golden angle
      if (away && k % homeEvery === 1) { out.push.apply(out, homeCrown(x, y, ring, away, a + 1.19998, k, seed)); }
      var pick = hash(k, 1, seed * 1000 | 0) * total, s = strata[0];
      for (var q = 0; q < strata.length; q += 1) { pick -= strata[q][3]; if (pick <= 0) { s = strata[q]; break; } }
      var R = Math.max(5, Math.min(18, 4 + s[2] * 0.3));
      var d = ring * (0.92 + 0.42 * hash(k, 2, seed * 1000 | 0)) + R * 0.5;
      var cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.82;
      if (cx < -R || cx > W + R || cy < -R || cy > H + R) { continue; }
      var crown = makeCrown(s[1], R, here.set.look, here.soilRgb, hash(k, 3, seed * 1000 | 0));
      crown.x = Math.round(cx / CELL) * CELL;
      crown.y = Math.round(cy / CELL) * CELL;
      crown.delay = k * 90;
      crown.stratum = s;
      out.push(crown);
    }
    return out;
  }

  function homeCrown(x, y, ring, home, a, k, seed) {
    var hs = home.set.strata;
    var s = hs[Math.floor(hash(k, 4, seed * 1000 | 0) * hs.length) % hs.length];
    var R = Math.max(9, Math.min(16, 6 + s[2] * 0.3));
    var d = ring * (0.98 + 0.3 * hash(k, 5, seed * 1000 | 0)) + R * 0.5;
    var cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.82;
    if (cx < -R || cx > W + R || cy < -R || cy > H + R) { return []; }
    var crown = makeCrown(s[1], R, home.look, [0, 0, 0], hash(k, 6, seed * 1000 | 0),
                          { soil: 0, outline: home.chalk });
    crown.x = Math.round(cx / CELL) * CELL;
    crown.y = Math.round(cy / CELL) * CELL;
    crown.delay = k * 90 + 140;
    crown.stratum = s;
    crown.home = true;
    return [crown];
  }

  // How much of a crown is up: 0 to 1 coming up, and back down again.
  function upness(p, now) {
    var t = now - p.born - p.crownDelay;
    if (t < 0) { return 0; }
    var up = Math.min(1, t / RISE);
    if (p.sinkAt && now > p.sinkAt + p.crownDelay) { up = Math.max(0, 1 - (now - p.sinkAt - p.crownDelay) / RISE); }
    return Math.floor(up * 8) / 8;                  // in held steps
  }

  function drawPlants(o, now) {
    var px = Math.max(1, Math.round(CELL * dpr));
    var anyUp = false;
    // Following, the plantings stand where it waits, and move with the city under it.
    var sx = 0, sy = 0;
    if (o.anchor && o.target) { sx = o.target.x - o.anchor.x; sy = o.target.y - o.anchor.y; }
    if (o.mode === "follow" && (o.hidden || o.state === "run")) { return false; }
    o.plants.forEach(function (c) {
      var up = upness({ born: o.plantBorn || o.born, crownDelay: c.delay, sinkAt: o.sinkAt }, now);
      if (up <= 0) { return; }
      anyUp = true;
      var rows = c.bottom - c.top + 1;
      var cut = c.bottom - Math.ceil(rows * up);    // rows above this are not up yet
      var ox = Math.round((c.x + sx) * dpr), oy = Math.round((c.y + sy) * dpr);
      g.globalAlpha = 0.42;
      g.fillStyle = c.shadeC;
      c.shade.forEach(function (s) {
        if (s.j - 1 <= cut) { return; }
        g.fillRect(ox + s.i * px, oy + s.j * px, px, px);
      });
      g.globalAlpha = 1;
      c.dots.forEach(function (d) {
        if (d.j <= cut) { return; }
        g.fillStyle = d.c;
        var sz = d.small && px > 1 ? px - Math.max(1, Math.round(px / 3)) : px;
        g.fillRect(ox + d.i * px, oy + d.j * px, sz, sz);
      });
    });
    return anyUp;
  }

  /* ---- what it leaves behind ------------------------------------------------

     Twombly's line, after the fox: a pen that loops as it goes, leaning
     right, pointed at the turns, two lines to a row in two inks, lifting
     between phrases, in single pixels, fading in steps. Kapoor's trace,
     after the slug: a line of his dark along the ground, a glint in it now
     and then, drying in steps, slower. The others leave nothing. */

  function drawTrail(o, now) {
    var w = o.writing;
    if (!w.length) { return false; }
    return o.mv.trail === "slime" ? drawSlime(o, now) : drawWriting(o, now);
  }

  function drawWriting(o, now) {
    var w = o.writing;
    var inks = o.c.after.inks.writing || [o.c.after.inks.pen[0]];
    var px = Math.max(1, Math.round(dpr));
    var live = false;
    for (var line = 0; line < 2; line += 1) {
      g.fillStyle = inks[line % inks.length];
      for (var k = 1; k < w.length; k += 1) {
        var age = now - w[k].at, life = 4200;
        if (age > life) { continue; }
        live = true;
        g.globalAlpha = [0.9, 0.66, 0.42, 0.2][Math.min(3, Math.floor(age / life * 4))];
        // Between two samples the pen goes on in fine steps, so it is a line.
        for (var q = 0; q < 1; q += 0.125) {
          var s = w[k - 1].s + (w[k].s - w[k - 1].s) * q;
          var u = s / 5.2 + line * 2.1;
          // Lifting between phrases: every fifth loop or so the pen is up.
          if (Math.floor(u / (Math.PI * 2)) % 5 === 4) { continue; }
          var lx = s - o.dir * 8 * Math.sin(u);
          var ly = -4.2 * (1 - Math.cos(u)) + line * 4;
          lx += o.dir * 0.32 * -ly;               // leaning right as it writes
          var x = Math.round((o.x0 + o.dir * lx) * dpr), y = Math.round((w[k].y + 6 + ly) * dpr);
          g.fillRect(x, y, px, px);
        }
      }
    }
    g.globalAlpha = 1;
    while (w.length && now - w[0].at > 4400) { w.shift(); }
    return live;
  }

  function drawSlime(o, now) {
    var w = o.writing, inks = o.c.after.inks.writing;
    var px = Math.max(1, Math.round(dpr)), life = 9000, live = false;
    for (var k = 1; k < w.length; k += 1) {
      var age = now - w[k].at;
      if (age > life) { continue; }
      live = true;
      g.globalAlpha = [0.85, 0.6, 0.38, 0.18][Math.min(3, Math.floor(age / life * 4))];
      for (var q = 0; q < 1; q += 0.25) {
        var s = w[k - 1].s + (w[k].s - w[k - 1].s) * q;
        var x = Math.round((o.x0 + o.dir * s) * dpr), y = Math.round((w[k].y - 1) * dpr);
        g.fillStyle = Math.round(s) % 11 === 0 ? inks[1] : inks[0];
        g.fillRect(x, y, px, px * 2);
      }
    }
    g.globalAlpha = 1;
    while (w.length && now - w[0].at > life + 200) { w.shift(); }
    return live;
  }

  /* ---- where they stand ---------------------------------------------------- */

  function live() { return crowd.filter(function (o) { return o.state !== "gone"; }); }

  // What is in the way on the screen: the city's column, the dial of years,
  // the banner, the walk's strip. A character never stands under them.
  function obstacles() {
    var out = [];
    ["#art-col", "#art-time", "#building-time", ".walk-strip", "#banner"].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (!el || el.hidden || !el.getClientRects().length) { return; }
      var r = el.getBoundingClientRect();
      if (r.width && r.height) { out.push(r); }
    });
    // The city's own marks: a museum's diamond and its name are its way in.
    var land = document.getElementById("land");
    if (land) {
      Array.prototype.forEach.call(land.querySelectorAll(".city"), function (el) {
        if (el.hidden || el.style.visibility === "hidden" || el.dataset.on === "false") { return; }
        var r = el.getBoundingClientRect();
        if (r.width && r.height && r.right > 0 && r.left < W && r.bottom > 0 && r.top < H) { out.push(r); }
      });
    }
    return out;
  }

  // A place to stand near (x, y) that keeps clear of the others and of what
  // is on the screen: there, below, above, across.
  function seat(x, y, except) {
    var tries = [[0, 0], [0, 52], [0, -52], [APART, 26], [-APART, 26], [APART, -26], [-APART, -26], [0, 104],
                 [-APART * 1.6, 0], [APART * 1.6, 0], [0, -104], [-APART, -78]];
    var obs = obstacles();
    for (var k = 0; k < tries.length; k += 1) {
      var cx = Math.max(48, Math.min(W - 48, x + tries[k][0]));
      var cy = Math.max(110, Math.min(H - 24, y + tries[k][1]));
      var under = obs.some(function (r) { return cx + 44 > r.left && cx - 44 < r.right && cy + 6 > r.top && cy - 56 < r.bottom; });
      if (under) { continue; }
      var clear = live().every(function (o) {
        return o === except || o.mode === "far" || o.hidden ||
          Math.abs(o.x - cx) >= APART || Math.abs(o.y - cy) >= 44;
      });
      if (clear) { return { x: cx, y: cy }; }
    }
    return null;
  }

  // One standing still on the screen, that a newcomer could go and meet.
  function standing(except) {
    return live().filter(function (o) {
      return o !== except && o.mode !== "far" && !o.hidden && !o.meet &&
        (o.state === "wait" || o.stopped) && o.x > 40 && o.x < W - 40;
    })[0] || null;
  }

  function aim(o) {
    if (o.meet && o.meet.state !== "gone") {
      if (!o.meetOff) {
        // Beside it, facing, a little lower: the side with room, clear of the dial and the names.
        var side = o.meet.x > W / 2 ? -1 : 1, obs = obstacles();
        var tries = [[side, 14], [-side, 14], [side, -44], [-side, -44], [side, 64], [-side, 64]];
        o.meetOff = { x: side * MEET, y: 14 };
        for (var k = 0; k < tries.length; k += 1) {
          var cx = o.meet.x + tries[k][0] * MEET, cy = o.meet.y + tries[k][1];
          if (cx < 48 || cx > W - 48 || cy < 110 || cy > H - 24) { continue; }
          if (obs.some(function (r) { return cx + 44 > r.left && cx - 44 < r.right && cy + 6 > r.top && cy - 56 < r.bottom; })) { continue; }
          o.meetOff = { x: tries[k][0] * MEET, y: tries[k][1] };
          break;
        }
      }
      return { x: o.meet.x + o.meetOff.x, y: o.meet.y + o.meetOff.y };
    }
    if (o.geo && window.Land && Land.at) {
      var p = Land.at(o.geo.lat, o.geo.lon);
      if (!p || p.z <= 0) { return null; }
      return { x: p.x + o.geo.dx, y: p.y + o.geo.dy };
    }
    return o.tx !== undefined ? { x: o.tx, y: o.ty } : null;
  }

  /* ---- coming ------------------------------------------------------------- */

  function make(c, mode, x, y, extra) {
    var now = performance.now();
    var m = mapOf(c);
    var home = homeOf(m);
    if (home) { home.look = homeLook(c); home.chalk = c.after.inks.pen[0]; }
    var o = {
      c: c, mv: moves(c), mode: mode, here: null, born: now, x0: x, x: x, y: y, dir: 1, alt: 0,
      city: null, map: m, home: home, row: null, guide: null, scale: 1,
      pose: "stand", n: 0, state: "out", since: now, s: 0, looked: false,
      plants: [], writing: [], sinkAt: 0, stopped: false, hidden: false
    };
    for (var k in extra || {}) { if (Object.prototype.hasOwnProperty.call(extra, k)) { o[k] = extra[k]; } }
    if (mode !== "far") { o.hit = hitFor(o); }
    crowd.push(o);
    lastCame = now;
    visit.seen[c.id] = true;
    loop();
    return o;
  }

  function newVisit(key) {
    visit = { key: key, waved: false, seen: {}, said: {} };
  }

  function wave(x, y, city) {
    if (still || !city || !isFinite(x) || !isFinite(y)) { return; }
    var key = city.key || "";
    if (visit.key !== key) { newVisit(key); }
    if (visit.waved) { return; }
    var now = performance.now();
    if (now < restUntil) { return; }
    if (!setUp()) { return; }
    size();
    if (!room("", now)) { return; }
    visit.waved = true;
    load().then(function () {
      if (!cast || !cast.cast.length) { return; }
      var land = document.getElementById("land");
      if (land && land.dataset.at !== "city") { return; }
      // A home town's own animal first; then the animals of the artists
      // whose maps the city is on; anywhere else, now and then, a guide.
      var free = drawn().filter(function (c) { return !visit.seen[c.id] && !outNow(c.id); });
      // In a place of a life (Lives' "Enter ›"): only that artist's own animal, never a guide
      // of another's — a Twombly fox trotting off over Picasso's Fontainebleau left its pen
      // line there with nothing to say for it (2 Oct 2026).
      var lw = window.Land && Land.where ? Land.where() : null;
      if (lw && lw.life) {
        free = free.filter(function (c) { return c.artist === lw.life.name; });
        if (!free.length) { return; }
      }
      if (prefer) { free.sort(function (p, q) { return (q.id === prefer) - (p.id === prefer); }); }
      var mine = free.filter(function (c) { return homeKey(c) === key; });
      if (!mine.length) { mine = free.filter(function (c) { return rowHere(mapOf(c), city); }); }
      var c, guide = null;
      if (mine.length) {
        c = prefer && mine[0].id === prefer ? mine[0] : mine[Math.floor(Math.random() * mine.length)];
      } else {
        if (!free.length || Math.random() > GUIDE || (lw && lw.life)) { return; }
        c = free[Math.floor(Math.random() * free.length)];
        if (mapOf(c)) { guide = nearestRow(mapOf(c), city.lat, city.lon); }
      }
      if (!room(c.id, performance.now())) { return; }
      come(c, x, y, city.r || 60, placeAt(city.lat, city.lon), city, guide);
    });
  }

  // Out of the wave: off by the nearer side, unless that is too close to be
  // seen going; on a phone, always to the left, away from the dial of years.
  // A guide goes the way its artist's nearest city lies, east or west. If
  // another stands still on the screen, it goes to meet it instead.
  function come(c, x, y, r, here, city, guide) {
    var dir = x > W / 2 ? 1 : -1;
    if (Math.abs((dir > 0 ? W : 0) - x) < 140) { dir = -dir; }
    if (W < 600) { dir = -1; }
    if (guide && city) {
      dir = ((guide.row[4] - city.lon + 540) % 360) - 180 >= 0 ? 1 : -1;
      guide.way = dir > 0 ? "east" : "west";
    }
    var at = seat(x, y) || { x: x, y: y };
    var o = make(c, "wave", at.x, at.y, { dir: dir, here: here, city: city || null, guide: guide });
    o.row = rowHere(o.map, city);
    o.plants = growPlants(x, y, r, here, Math.random(), o.home);
    var other = standing(o);
    if (other) { o.meet = other; }
  }

  // A journey arrived in an artist's home town: its animal comes to meet it.
  function comeHome(c, t, trip) {
    var from = trip && townOf(trip.from);
    var dir = from ? (((t.lon - from.lon + 540) % 360) - 180 >= 0 ? 1 : -1) : (Math.random() < 0.5 ? 1 : -1);
    var p = window.Land && Land.at ? Land.at(t.lat, t.lon) : null;
    if (!p || p.z <= 0) { return; }
    var spot = seat(p.x + 56, p.y + 72);
    if (!spot) { return; }
    var slow = moves(c).speed < 0.5;
    var here = placeAt(t.lat, t.lon);
    // In from that edge, or from behind the city's column where the column is.
    var edge = dir > 0 ? -50 : W + 50;
    var col = document.getElementById("art-col");
    if (dir < 0 && col && !col.hidden && col.getClientRects().length) {
      var cr = col.getBoundingClientRect();
      if (cr.height > H / 2 && cr.left > W / 2) { edge = cr.left + 30; }
    }
    var o = make(c, "home", slow ? spot.x : edge, spot.y, {
      dir: dir, here: here, city: { key: t.key, lat: t.lat, lon: t.lon, name: t.name },
      geo: { lat: t.lat, lon: t.lon, dx: spot.x - p.x, dy: spot.y - p.y }, state: slow ? "out" : "in",
      alt: moves(c).lift, atHome: true
    });
    o.row = rowHere(o.map, o.city);
    var other = standing(o);
    if (other) { o.meet = other; }
    o.plants = growPlants(spot.x, spot.y, 64, here, Math.random(), o.home);
    o.plantBorn = performance.now() + 900;
  }

  // Gone down into an artist's home town another way: now and then it is there, at rest.
  function comeRest(c, t) {
    var p = window.Land && Land.at ? Land.at(t.lat, t.lon) : null;
    if (!p || p.z <= 0) { return; }
    var spot = seat(p.x + 56, p.y + 72);
    if (!spot) { return; }
    var o = make(c, "rest", spot.x, spot.y, {
      dir: p.x + 56 > W / 2 ? -1 : 1, here: placeAt(t.lat, t.lon),
      city: { key: t.key, lat: t.lat, lon: t.lon, name: t.name },
      geo: { lat: t.lat, lon: t.lon, dx: spot.x - p.x, dy: spot.y - p.y }, atHome: true
    });
    o.row = rowHere(o.map, o.city);
  }

  // Seen far below, from a journey passing over its home or at a history's stop.
  function comeFar(c, t, kind, until) {
    var o = make(c, "far", 0, 0, {
      scale: 0.5, geo: { lat: t.lat, lon: t.lon, dx: -22, dy: 2 }, here: placeAt(t.lat, t.lon),
      farKind: kind, until: until, dir: -1, city: { key: t.key, name: t.name }
    });
    return o;
  }

  /* ---- hometowns, from where you are and where you are going --------------- */

  var trip = null;                     // the journey under way: { from, to, passed }
  var hist = null;                     // the work whose history is open: { id, at, keys, done }

  function arrive(key, viaTrip) {
    loadTowns().then(function () {
      var t = townOf(key);
      if (!t || visit.key !== key) { return; }
      var homes = homesOf(key).filter(function (c) { return !visit.seen[c.id] && !outNow(c.id); });
      if (!homes.length) { return; }
      var c = homes[Math.floor(Math.random() * homes.length)];
      if (!setUp()) { return; }
      size();
      if (!room(c.id, performance.now())) { return; }
      if (viaTrip) {
        visit.seen[c.id] = true;
        window.setTimeout(function () {
          if (visit.key === key && room(c.id, performance.now() + GAP)) { comeHome(c, t, viaTrip); }
        }, 900);
      } else {
        visit.seen[c.id] = true;            // decided once a visit, seen or not
        if (Math.random() < AT_REST) { comeRest(c, t); }
      }
    });
  }

  function passOver(key) {
    loadTowns().then(function () {
      var t = townOf(key);
      if (!t || !setUp()) { return; }
      size();
      if (live().some(function (o) { return o.mode === "far"; })) { return; }
      var c = homesOf(key).filter(function (k) { return room(k.id, performance.now()); })[0];
      if (c) { comeFar(c, t, "pass", performance.now() + 3200); }
    });
  }

  function historyStops(id, now) {
    if (!hist || hist.id !== id) {
      hist = { id: id, at: now, keys: null, done: false };
      var h = hist;
      Promise.all([get("histories/" + id + ".json"), loadTowns()]).then(function (got) {
        var keys = [];
        (got[0].events || []).forEach(function (e) { if (e.p && keys.indexOf(e.p) < 0) { keys.push(e.p); } });
        h.keys = keys;
      }, function () { h.keys = []; });
      return;
    }
    // After the work's first look (9 s), once.
    if (hist.done || !hist.keys || now - hist.at < 9000) { return; }
    hist.done = true;
    if (!setUp()) { return; }
    size();
    for (var k = 0; k < hist.keys.length; k += 1) {
      var t = townOf(hist.keys[k]);
      var c = t && homesOf(t.key).filter(function (x) { return room(x.id, now); })[0];
      if (c) { comeFar(c, t, "stop", 0).work = id; return; }
    }
  }

  function poll() {
    if (still || !window.Land || !Land.where) { return; }
    if (!cast) { load(); return; }
    var w = Land.where(), now = performance.now();
    var j = Land.journey ? Land.journey() : null;
    if (j && !j.done && j.to) {
      if (!trip || trip.to !== j.to) { trip = { from: j.from, to: j.to, passed: {} }; }
      (j.passed || []).forEach(function (key) {
        if (!trip.passed[key]) { trip.passed[key] = true; passOver(key); }
      });
    }
    if (w.at === "work" && !w.flying && w.work) { historyStops(w.work, now); } else { hist = null; }
    if (!w.flying && w.at === "town" && w.key) {
      var back = visit.key === w.key && visit.left && now - visit.left < 60000;
      if (visit.key !== w.key || (visit.left && !back)) {
        var via = trip && trip.to === w.key ? trip : null;
        newVisit(w.key);
        arrive(w.key, via);
      }
      visit.left = 0;
      trip = null;
    }
  }

  /* ---- pressed ------------------------------------------------------------- */

  function press(o) {
    if (!o || o.state === "gone") { return; }
    var now = performance.now();
    // Following: pressed again, it is let go, and goes its own way.
    if (o.mode === "follow") {
      if (window.Land && Land.unfollow) { Land.unfollow(); } else { release(o, now); }
      return;
    }
    if (o.stopped) { goOn(o, now); return; }
    if (saying && saying !== o && saying.stopped) { goOn(saying, now); }
    o.stopped = true;
    o.stopAt = now;
    o.pose = "look";
    o.n = 0;
    o.alt = 0;
    saying = o;
    says.textContent = line(o);
    var canFollow = o.map && window.Land && Land.follow;
    if (canFollow) {
      var go = document.createElement("button");
      go.type = "button";
      go.className = "character-follow";
      go.textContent = "Follow";
      go.setAttribute("aria-label", "Follow the " + o.c.name.toLowerCase() + " through " + o.c.artist + "'s works");
      go.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      go.addEventListener("click", function (event) { event.stopPropagation(); follow(o); });
      says.appendChild(document.createTextNode(" "));
      says.appendChild(go);
    }
    says.hidden = false;
    placeSays(o);
    o.sayUntil = now + SAY * (canFollow ? PHI : 1);
  }

  /* Following: land.js turns the column into the artist's map and says
     where the animal is to be (guide); here it only runs and waits. One is
     followed at a time: another being followed is let go. */
  function follow(o) {
    if (!o || !o.map || !window.Land) { return; }
    var now = performance.now();
    crowd.forEach(function (x) { if (x !== o && x.mode === "follow") { release(x, now); } });
    o.mode = "follow";
    o.stopped = false;
    o.meet = null;
    o.geo = null;
    o.state = "wait";
    o.waitSince = now;
    o.atKey = o.city ? (o.row ? o.row[0] : o.city.key) : null;
    o.sinkAt = Math.max(now, o.born + RISE);      // the wave's plantings go back down
    o.writing = [];
    says.hidden = true;
    saying = null;
    o.hit.setAttribute("aria-label", o.c.name + " — press to let it go, and stop following " + o.c.artist);
    var ids = {};
    o.map.works.forEach(function (w) { ids[w[0]] = true; });
    Land.follow({ artist: o.c.artist, animal: o.c.name, map: o.map, ids: ids, home: o.home ? o.home.where : "", cast: o.c.id });
  }

  function follower() { return crowd.filter(function (o) { return o.mode === "follow" && o.state !== "gone"; })[0] || null; }

  /* A walk (walks.js) is led by its animal without a wave: the character
     comes out following, hidden until land.js says where it is to be. What
     is handed back is what Land.follow takes. A character already following
     is kept. Under reduced motion nothing is drawn, and the walk still has
     its map. A walk is asked for, so it is let in even to a full crowd: the
     one out longest makes way. */
  function lead(id) {
    return load().then(function () {
      var c = cast && cast.cast.filter(function (k) { return k.id === id; })[0];
      var m = c && mapOf(c);
      if (!m) { return null; }
      var home = homeOf(m);
      var f = follower();
      if (!(f && f.c.id === id) && !still && sprites[c.id] && setUp()) {
        var now = performance.now();
        if (f) { remove(f); }
        var mine = outNow(id);
        if (mine) { remove(mine); }
        size();
        while (live().length >= cap()) { remove(live()[0]); }
        var o = make(c, "follow", W / 2, H * 0.7, { state: "wait", waitSince: now, looked: true, hidden: true, atKey: null });
        o.hit.setAttribute("aria-label", c.name + " — press to let it go, and stop following " + c.artist);
      }
      var ids = {};
      m.works.forEach(function (w) { ids[w[0]] = true; });
      return { artist: c.artist, animal: c.name, map: m, ids: ids, home: home ? home.where : "", cast: c.id };
    });
  }

  // Let go: off by the nearer side, its plantings sinking.
  function release(o, now) {
    if (!o) { return; }
    o.mode = "wave";
    o.hidden = false;
    o.stopped = false;
    leave(o, now);
    o.looked = true;
    o.sinkAt = Math.max(now, (o.plantBorn || o.born) + RISE);
    if (saying === o) { says.hidden = true; saying = null; }
    loop();
  }

  /* Where land.js wants the followed one, each frame: running ahead along a
     journey ({x, y, dir, run}), waiting by the museum or gallery holding the
     work ({x, y, key, lat, lon, name}), or nowhere (null: in a museum, a
     work's history). Arriving in a city of the map, the two plantings rise
     round where it waits. */
  function guide(p) {
    var o = follower();
    if (!o) { return; }
    if (!p) { o.hidden = true; return; }
    size();
    o.hidden = false;
    var now = performance.now();
    if (p.run) {
      o.state = "run";
      o.x = p.x; o.y = p.y;
      if (p.dir) { o.dir = p.dir; }
      o.target = null;
      o.atKey = null;
      return;
    }
    if (o.state === "run") { o.state = "wait"; o.waitSince = now; }
    o.target = p;
    if (o.atKey !== p.key) {
      o.atKey = p.key;
      o.city = { key: p.key, lat: p.lat, lon: p.lon, name: p.name };
      o.here = placeAt(p.lat, p.lon);
      o.row = rowHere(o.map, o.city);
      o.atHome = homeKey(o.c) === p.key;
      o.anchor = { x: p.x, y: p.y };
      // Never let a planting break the frame that called it (land.js's).
      try { o.plants = still ? [] : growPlants(p.x, p.y, 72, o.here, Math.random(), o.home); } catch (e) { o.plants = []; }
      o.plantBorn = now + 600;
      o.sinkAt = now + 600 + STAND + RISE;
    }
    loop();
  }

  function goOn(o, now) {
    o.stopped = false;
    if (saying === o) { says.hidden = true; saying = null; }
    if (o.mode === "home" || o.mode === "rest" || o.meet) { o.meet = null; leave(o, now); return; }
    o.lastMove = now;
    o.state = "trot";
    o.since = now;
  }

  // Off, its own way: along the ground and out of view, up into the sky, or back into the soil.
  function leave(o, now) {
    o.state = "trot";
    o.geo = null;
    o.x0 = o.x;
    o.s = 0;
    o.since = now;
    o.lastMove = now;
    o.dir = o.x > W / 2 ? 1 : -1;
    if (W < 600) { o.dir = -1; }
    o.writing = [];
    o.looked = true;
    if (!o.sinkAt && o.plants.length) { o.sinkAt = Math.max(now, (o.plantBorn || o.born) + STAND); }
  }

  function andList(names) {
    return names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names[names.length - 1] : names[0];
  }

  function surname(name) {
    var words = name.split(" "), k = words.length - 1;
    while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(words[k - 1])) { k -= 1; }
    return words.slice(k).join(" ");
  }

  /* What it is, whose hand, and the two plantings: "Red fox · after Cy
     Twombly, of Lexington, Virginia · dogwood from Lexington among Munich's
     European beech and pedunculate oak · 10 of the artist's works have been
     here"; at home: "Bald eagle · after Andy Warhol, of Pittsburgh,
     Pennsylvania · at home in Pittsburgh". */
  function line(o) {
    var bits = [o.c.name, "after " + o.c.artist + (o.home ? ", of " + o.home.where : "")];
    var names = [], homes = [];
    o.plants.forEach(function (p) {
      var nm = p.stratum[4][0];
      var list = p.home ? homes : names;
      if (nm && list.indexOf(nm) < 0) { list.push(nm); }
    });
    var town = o.city && o.city.name ? o.city.name.split(",")[0] : "";
    var local = names.length ? (town ? town + "’s " : "") + andList(names.slice(0, 3)) : "";
    if (o.atHome && town) {
      bits.push("at home in " + town + (names.length ? ", among " + andList(names.slice(0, 2)) : ""));
    } else if (homes.length) {
      bits.push(andList(homes.slice(0, 2)) + " from " + o.home.name + (local ? " among " + local : ""));
    } else if (o.home && o.here && o.home.set === o.here.set && names.length) {
      bits.push("at home among " + andList(names.slice(0, 3)));
    } else if (names.length) {
      bits.push("among " + local);
    }
    if (!o.home && o.here) { bits.push(o.here.set.biome); }
    var n = o.row ? o.row[5].length : 0;
    if (n) {
      bits.push(n + (n === 1 ? " of the artist’s works has" : " of the artist’s works have") + " been here");
    } else if (o.guide) {
      bits.push("the nearest of the artist’s works: " + o.guide.row[1] + ", " +
                Math.round(o.guide.km).toLocaleString("en") + " km " + o.guide.way);
    }
    return bits.join(" · ");
  }

  function bounds(o) {
    var s = sprites[o.c.id];
    var k = o.scale || 1;
    var w = s.w * s.cell * k, h = s.h * s.cell * k;
    return { x: o.x - w / 2, y: o.y - o.alt - s.foot[1] * s.cell * k, w: w, h: h };
  }

  function placeSays(o) {
    var b = bounds(o);
    var sw = says.offsetWidth || 220, sh = says.offsetHeight || 30;
    var left = o.dir > 0 ? b.x - sw - 10 : b.x + b.w + 10;
    if (left < 16) { left = b.x + b.w + 10; }
    if (left + sw > W - 16) { left = Math.max(16, b.x - sw - 10); }
    var top = Math.max(16, Math.min(H - sh - 16, b.y + b.h / 2 - sh / 2));
    says.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
  }

  /* ---- two that meet --------------------------------------------------------

     A newcomer that went to meet one standing still: once both are still,
     facing, a line between them names what their artists' works share, if
     the threads know: "Red fox and bald eagle · Twombly and Warhol: both
     written of in Forty Are Better Than One, 2009", the thing itself a door
     to its thread. Once a visit for a pair; nothing if nothing is known. */

  var KIND_SAID = {
    show: function (p) { return "both shown in “" + p[2] + "”" + (p[3] ? ", " + p[3].split(",")[0] : "") + (p[4] ? ", " + p[4] : ""); },
    owner: function (p) { return "both owned by " + p[2]; },
    writing: function (p) { return "both written of in " + p[2] + (p[4] ? ", " + p[4] : ""); },
    sale: function (p) { return "both offered in " + p[2]; },
    museum: function (p) { return "both held by " + p[2]; }
  };

  function meetings(now) {
    if (!pair) { return; }
    if (!pair.hidden) {
      var a = pair._a, b = pair._b;
      if (now > pair._until || !a || !b || a.state === "gone" || b.state === "gone" || a.hidden || b.hidden) {
        pair.hidden = true;
        return;
      }
      placePair(a, b);
      return;
    }
    live().forEach(function (o) {
      var m = o.meet;
      if (!pair.hidden || !m || m.state === "gone" || o.state !== "wait" || m.hidden) { return; }
      var key = [o.c.artist, m.c.artist].sort().join("|");
      visit.said = visit.said || {};
      if (visit.said[key]) { return; }
      visit.said[key] = true;
      var p = pairOf(o.c.artist, m.c.artist);
      o.until = Math.max(o.until || 0, now + (p ? SAY * PHI : SAY));
      if (m.until) { m.until = Math.max(m.until, o.until); }
      if (!p) { return; }
      pair.textContent = "";
      pair.appendChild(document.createTextNode(m.c.name + " and " + o.c.name.toLowerCase() + " · " +
        surname(m.c.artist) + " and " + surname(o.c.artist) + ": "));
      var said = (KIND_SAID[p[1]] || KIND_SAID.museum)(p);
      if (window.Land && Land.thread) {
        var door = document.createElement("button");
        door.type = "button";
        door.className = "character-pair-door";
        door.textContent = said;
        door.addEventListener("click", function (event) { event.stopPropagation(); pair.hidden = true; Land.thread(p[0]); });
        pair.appendChild(door);
      } else {
        pair.appendChild(document.createTextNode(said));
      }
      pair._a = m; pair._b = o; pair._until = now + SAY * PHI; pair._obs = null;
      pair.hidden = false;
      placePair(m, o);
    });
  }

  function placePair(a, b) {
    var ba = bounds(a), bb = bounds(b);
    var pw = pair.offsetWidth || 240, ph = pair.offsetHeight || 30;
    var mid = (ba.x + ba.w / 2 + bb.x + bb.w / 2) / 2;
    // Under the two, where the ground is theirs; above them if there is no
    // room, or if the dial or the column is there.
    var left = Math.max(16, Math.min(W - pw - 16, mid - pw / 2));
    var below = Math.max(ba.y + ba.h, bb.y + bb.h) + 8, above = Math.min(ba.y, bb.y) - ph - 6;
    var obs = pair._obs || (pair._obs = obstacles());
    var hits = function (t) {
      if (t < 70 || t + ph > H - 16) { return 99; }
      // The column and the dial count for more than any number of names.
      return obs.reduce(function (n, r) {
        var over = left + pw > r.left && left < r.right && t + ph > r.top && t < r.bottom;
        return n + (over ? (r.width > 120 && r.height > 120 ? 50 : 1) : 0);
      }, 0);
    };
    var top = hits(below) <= hits(above) ? below : above;
    pair.style.transform = "translate(" + Math.round(left) + "px," + Math.round(top) + "px)";
  }

  /* ---- moving -------------------------------------------------------------- */

  function gaitFrame(o, now) { return Math.floor(now / (1000 / o.mv.fps)) % 4; }

  function step(o, now) {
    var t = now - o.since;
    var dt = Math.min(80, now - (o.lastMove || now));
    o.lastMove = now;
    if (o.mode === "follow") { stepFollow(o, now, dt); return; }
    if (o.mode === "far") { stepFar(o, now); return; }
    if (o.stopped) {
      // Looking at you; then it rests; then it goes on.
      if (now - o.stopAt > 2600) { o.pose = "sit"; }
      if (now > o.sayUntil) { goOn(o, now); }
      return;
    }
    var mv = o.mv;
    if (o.state === "out") {
      o.pose = o.mode === "rest" ? "sit" : "stand";
      if (o.geo) { var a0 = aim(o); if (a0) { o.x = a0.x; o.y = a0.y; } }
      if (t > 700) {
        o.since = now;
        if (o.mode === "rest") { o.state = "wait"; o.waitSince = now - 6000; }
        else if (o.meet || o.mode === "home") {
          o.state = o.mode === "home" && !o.meet ? "wait" : "in";
          o.waitSince = now;
          if (o.state === "wait") { o.until = now + HOME_STAY; }
        }
        else { o.state = "trot"; o.x0 = o.x; }
      }
      return;
    }
    if (o.state === "in") {
      var tg = aim(o);
      if (!tg) { leave(o, now); return; }
      var dx = tg.x - o.x, dy = tg.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1.5) {
        var go = Math.min(d, SPEED * mv.speed * PHI * dt / 1000);
        o.x += dx / d * go;
        o.y += dy / d * go;
        if (Math.abs(dx) > 1) { o.dir = dx > 0 ? 1 : -1; }
        o.alt = mv.lift * Math.min(1, d / 120);
        o.pose = "trot";
        o.n = gaitFrame(o, now);
      } else {
        o.x = tg.x; o.y = tg.y; o.alt = 0;
        o.state = "wait";
        o.waitSince = now;
        if (o.mode === "home") { o.until = now + HOME_STAY; }
        if (o.meet) {
          o.dir = o.meet.x > o.x ? 1 : -1;
          if (o.meet.mode !== "follow" || o.meet.state === "wait") { o.meet.dir = -o.dir; }
          o.until = Math.max(o.until || 0, now + SAY);
        }
      }
      return;
    }
    if (o.state === "wait") {
      var at = aim(o);
      if (at && !o.meet) { o.x = at.x; o.y = at.y; }
      var waited = now - (o.waitSince || now);
      o.pose = o.meet ? (waited > 2400 ? "look" : "stand") : waited > 4200 ? "sit" : waited > 1600 ? "look" : "stand";
      o.n = 0;
      if (o.meet && o.meet.state === "gone") { o.meet = null; }
      if (o.until && now > o.until && o.mode !== "rest") { o.meet = null; leave(o, now); }
      return;
    }
    if (o.state === "pause") {
      o.pose = mv.pause;
      if (t > 1500) { o.state = "trot"; o.since = now; }
      return;
    }
    if (o.state === "sink") {
      if (t > 1200) { gone(o, now); }
      return;
    }
    if (o.state === "trot") {
      o.s += SPEED * mv.speed * Math.max(1 / PHI, Math.min(1, W / 1000)) * dt / 1000;   // slower across a phone
      o.x = o.x0 + o.dir * o.s;
      o.pose = "trot";
      o.n = gaitFrame(o, now);
      if (mv.leave === "rise") { o.alt = Math.min(mv.lift, o.s * 0.6) + Math.max(0, o.s - 60) * 0.5; }
      if (mv.trail && (!o.writing.length || o.s - (mv.trail === "slime" ? 6 : 18) - o.writing[o.writing.length - 1].s >= (mv.trail === "slime" ? 2 : 3))) {
        o.writing.push({ s: o.s - (mv.trail === "slime" ? 6 : 18), y: o.y, at: now });
      }
      // Once, a little way off, it stops and looks back (or grazes, or sits up).
      if (mv.pause && !o.looked && o.s > 110 * Math.min(1, mv.speed)) { o.looked = true; o.state = "pause"; o.since = now; return; }
      if (mv.leave === "sink" && t > Math.pow(PHI, 6) * 1000) { o.state = "sink"; o.since = now; return; }
      var half = sprites[o.c.id].w * sprites[o.c.id].cell / 2;
      if (o.x < -half - 10 || o.x > W + half + 10 || o.y - o.alt < -60) { gone(o, now); }
    }
  }

  function gone(o, now) {
    o.state = "gone";
    if (o.hit) { o.hit.hidden = true; }
    if (!o.sinkAt) { o.sinkAt = Math.max(now, o.born + STAND); }
  }

  // Following: running along the way, or to where it waits, then standing, then sitting.
  function stepFollow(o, now, dt) {
    if (o.hidden) { return; }
    if (o.state === "run") { o.pose = "trot"; o.n = gaitFrame(o, now); o.alt = o.mv.lift; return; }
    var tg = o.target;
    if (!tg) { o.pose = "stand"; return; }
    var dx = tg.x - o.x, dy = tg.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
    if (d > 1.5) {
      var go = Math.min(d, SPEED * PHI * PHI * dt / 1000);
      o.x += dx / d * go;
      o.y += dy / d * go;
      if (Math.abs(dx) > 1) { o.dir = dx > 0 ? 1 : -1; }
      o.alt = o.mv.lift * Math.min(1, d / 120);
      o.pose = "trot";
      o.n = gaitFrame(o, now);
      o.waitSince = now;
    } else {
      o.x = tg.x; o.y = tg.y; o.alt = 0;
      var waited = now - (o.waitSince || now);
      o.pose = waited > 4200 ? "sit" : waited > 1600 ? "look" : "stand";
      o.n = 0;
    }
  }

  // Far below: held to its town as the world turns; a passing one looks up, a history's sits.
  function stepFar(o, now) {
    var p = window.Land && Land.at ? Land.at(o.geo.lat, o.geo.lon) : null;
    var w = window.Land && Land.where ? Land.where() : {};
    var over = o.farKind === "pass" ? now > o.until : !(w.at === "work" && w.work === o.work);
    if (over) { remove(o); return; }
    o.hidden = !p || p.z < 0.08;
    if (!o.hidden) { o.x = p.x + o.geo.dx; o.y = p.y + o.geo.dy; }
    o.pose = o.farKind === "pass" ? "look" : "sit";
    if (o.state === "out" && now - o.born > 700) { o.state = "wait"; }
  }

  /* ---- drawn ---------------------------------------------------------------- */

  function draw(now) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.imageSmoothingEnabled = false;
    var busy = false;
    // The nearer (lower on the screen) over the farther.
    crowd.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (o) {
      busy = drawPlants(o, now) || busy;
      busy = drawTrail(o, now) || busy;
      if (o.state === "gone" || o.hidden) { if (o.hit) { o.hit.hidden = true; } return; }
      busy = true;
      var sp = sprite(o.c, o.pose, o.n, o.dir, o.here, o.scale);
      var b = bounds(o);
      var x = Math.round(b.x * dpr), y = Math.round(b.y * dpr);
      var h = sp.cv.height;
      if (o.state === "out" && !o.stopped) {
        // Coming out: it rises out of the soil a row at a time.
        var up = Math.min(1, Math.floor((now - o.born) / 600 * 8) / 8);
        var hh = Math.round(h * up);
        if (hh > 0) { g.drawImage(sp.cv, 0, h - hh, sp.cv.width, hh, x, y + h - hh, sp.cv.width, hh); }
      } else if (o.state === "sink") {
        // Going back into it, a row at a time.
        var down = Math.min(1, Math.floor((now - o.since) / 1200 * 8) / 8);
        var keep = Math.round(h * (1 - down));
        if (keep > 0) { g.drawImage(sp.cv, 0, 0, sp.cv.width, keep, x, y + h - keep, sp.cv.width, keep); }
      } else {
        g.drawImage(sp.cv, x, y);
      }
      if (o.stopped) { box(o, b); }
      if (o.hit) {
        o.hit.hidden = false;
        o.hit.style.transform = "translate(" + Math.round(b.x + b.w * 0.15) + "px," + Math.round(b.y + b.h * 0.2) + "px)";
        o.hit.style.width = Math.round(b.w * 0.7) + "px";
        o.hit.style.height = Math.round(b.h * 0.8) + "px";
      }
    });
    return busy;
  }

  // A frame round it in its artist's ink (Twombly's red box round a plate),
  // drawn by hand, a little over at the corners.
  function box(o, b) {
    var px = Math.max(1, Math.round(dpr));
    g.fillStyle = o.c.after.inks.box;
    var x0 = Math.round((b.x + 2) * dpr), y0 = Math.round((b.y + 4) * dpr);
    var x1 = Math.round((b.x + b.w - 2) * dpr), y1 = Math.round((b.y + b.h + 2) * dpr);
    var over = Math.round(3 * dpr);
    g.fillRect(x0 - over, y0, x1 - x0 + over * 2, px);
    g.fillRect(x0, y1, x1 - x0 + over, px);
    g.fillRect(x0, y0 - over, px, y1 - y0 + over);
    g.fillRect(x1, y0, px, y1 - y0 + over * 2);
  }

  function loop() {
    if (raf) { return; }
    var tick = function (now) {
      raf = 0;
      if (!crowd.length) { return; }
      size();
      crowd.slice().forEach(function (o) { step(o, now); });
      var any = crowd.some(function (o) { return o.stopped; });
      if (now - (loop.last || 0) >= 1000 / 24 || any) {
        draw(now);
        loop.last = now;
        meetings(now);
        // Gone, and nothing of it left on the ground: forgotten.
        crowd.slice().forEach(function (o) {
          if (o.state === "gone" && o.mode !== "follow" && o.sinkAt && now > o.sinkAt + RISE + 1400 &&
              !(o.writing.length && now - o.writing[o.writing.length - 1].at < 9200)) { remove(o); }
        });
        if (!crowd.length) { g.clearRect(0, 0, canvas.width, canvas.height); return; }
      }
      if (saying && saying.stopped) { placeSays(saying); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function remove(o) {
    var k = crowd.indexOf(o);
    if (k < 0) { return; }
    crowd.splice(k, 1);
    if (o.hit && o.hit.parentNode) { o.hit.parentNode.removeChild(o.hit); }
    if (saying === o) { says.hidden = true; saying = null; }
    if (pair && (pair._a === o || pair._b === o)) { pair.hidden = true; }
    crowd.forEach(function (x) { if (x.meet === o) { x.meet = null; } });
    // After a wave's animal, the long rest before a wave brings another.
    if (o.mode === "wave") { restUntil = Math.max(restUntil, performance.now() + REST[0] + Math.random() * (REST[1] - REST[0])); }
  }

  // Out of the city: all go but the followed one and those seen from a journey or a history.
  function endVisit() {
    visit.left = performance.now();
    crowd.slice().forEach(function (o) { if (o.mode !== "follow" && o.mode !== "far") { remove(o); } });
    if (says) { says.hidden = true; saying = null; }
    if (pair) { pair.hidden = true; }
    if (g && !crowd.length) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, canvas.width, canvas.height); }
  }

  /* ---- the chimera: any three of the cast, as an exquisite corpse ------------

     The artist, 1 Oct 2026, of the relay he approved: "really work on the
     three Artist Chimera, it should be the most refined and well portrayed
     character on the entire site"; and of what it is for: "I like the idea
     of ritual and using the animals to generate games".

     Every character is drawn in three parts (characters/parts/<id>.json,
     by scripts/characters/chimera.py): its head, its body, its
     hindquarters, each part drawn so that its back and its belly cross the
     two folds at the marks every part agrees on, so any head joins any body
     joins any hindquarters. Here the three are laid side by side at the
     folds, each part's cells in its own artist's inks worked with the soil,
     the folds drawn faintly through it, as creases in the paper.

     The head sets the gaze, the body the carriage, the hindquarters the
     pace: it walks at its hindquarters' speed and frames (the slug's glide
     is slow, the bison's plod is steady), and every part keeps its own
     idles (the bison's blink and ear, the eagle's breath and its wings half
     raised, the slug's foot rippling). Pressed, it stops, the head turns to
     you, the body eases, the hindquarters answer last, and its line says
     what it is.

     The game (corpse.js) asks for one with Characters.chimera([head, body,
     tail], { seed, month }); unfold() is its metamorphosis, after Ovid:
     each parent's instinct in turn, head, body, hindquarters, then a rest
     none of the three alone would hold. Characters.meet(a, b) is the
     ritual of two that meet, by their heads' animals. Each behaviour is in
     the character's ethogram (characters.json): documented, never invented. */

  var RES = 1.5;                           // a chimera's cells to a character's (chimera.py)
  var partsData = {};
  var chimeras = [];
  var chCv = null, chG = null, chRaf = 0, chDpr = 1;
  var SLOTS = ["head", "body", "hind"];
  var chCache = {};

  function partsOf(id) {
    if (!partsData[id]) { partsData[id] = get(BASE + "parts/" + id + ".json").catch(function () { return null; }); }
    return partsData[id];
  }

  function castOf(id) { return cast ? cast.cast.filter(function (c) { return c.id === id; })[0] : null; }

  function seasonOf(month) {
    // The stag's antlers: cast in March and April, in velvet May to August, hard the rest.
    return month >= 3 && month <= 4 ? "cast" : month >= 5 && month <= 8 ? "velvet" : null;
  }

  function behaviour(c, role) {
    var e = (c && c.ethogram) || [];
    return e.filter(function (b) { return b.role === role; })[0] || null;
  }

  // The name, in the Surrealist manner, from what each part brings:
  // "The Bowed Mantle That Leaves a Trace".
  function chimeraName(cs) {
    var w = function (c, k) { return (c.chimera && c.chimera[k]) || c.name; };
    return "The " + w(cs[0], "head") + " " + w(cs[1], "body") + " " + w(cs[2], "hind");
  }

  // Three parts side by side at the folds: rows of letters, which part each cell is, the folds.
  function layout(P, season) {
    var head = P[0], body = P[1], hind = P[2];
    if (!layout.memo) { layout.memo = {}; }
    var key = head.id + body.id + hind.id + (season || "");
    if (layout.memo[key]) { return layout.memo[key]; }
    var left = 0, right = 0, heads = head[(season && head["head@" + season]) ? "head@" + season : "head"];
    Object.keys(hind.hind).forEach(function (n) { left = Math.max(left, -hind.hind[n][0] + 1); });
    Object.keys(heads).forEach(function (n) { right = Math.max(right, heads[n][0] + (heads[n][1][0] || "").length); });
    var hip = left, neck = left + body.len;
    var out = { hip: hip, neck: neck, w: neck + right + 1, h: body.rows, ground: body.ground, heads: heads };
    layout.memo[key] = out;
    return out;
  }

  function compose(ch, names) {
    var L = ch.L, w = L.w, h = L.h;
    var cells = [], who = [];
    for (var j = 0; j < h; j += 1) { cells.push(new Array(w).fill(".")); who.push(new Array(w).fill(-1)); }
    var order = [[2, ch.P[2].hind, L.hip], [1, ch.P[1].body, L.hip], [0, L.heads, L.neck]];
    order.forEach(function (o) {
      var slot = o[0], src = o[1], at = o[2];
      if (ch.folded && ch.folded[slot]) { return; }
      var got = src[names[slot]] || src.stand0;
      var x0 = got[0], rows = got[1];
      for (var j = 0; j < rows.length; j += 1) {
        var r = rows[j];
        for (var i = 0; i < r.length; i += 1) {
          var k = r.charAt(i);
          if (k === ".") { continue; }
          var c = at + x0 + i;
          if (c < 0 || c >= w) { continue; }
          if ((k === "o" || k === "p") && cells[j][c] !== "." && cells[j][c] !== "o" && cells[j][c] !== "p") { continue; }
          cells[j][c] = k;
          who[j][c] = slot;
        }
      }
    });
    return { cells: cells, who: who };
  }

  // Drawn in DIRT, as sprite() draws a character: each cell a dot of its
  // part's artist's ink worked with the soil, a little grain, now and then
  // a dot a size smaller; and the two folds, faint, through it and past it.
  function chimeraSprite(ch, names, dir, px) {
    var key = ch.key + "|" + names.join(",") + "|" + dir + "|" + px + "|" + (ch.here ? ch.here.soil : "") + "|" + (ch.folded || []).join("");
    if (chCache[key]) { return chCache[key]; }
    var L = ch.L, got = compose(ch, names);
    var cv = document.createElement("canvas");
    cv.width = L.w * px;
    cv.height = L.h * px;
    var x = cv.getContext("2d");
    var soil = ch.here ? ch.here.soilRgb : [120, 100, 80];
    var top = L.h, bottom = 0;
    for (var j = 0; j < L.h; j += 1) {
      for (var i = 0; i < L.w; i += 1) {
        var k = got.cells[j][i];
        if (k === ".") { continue; }
        top = Math.min(top, j); bottom = Math.max(bottom, j);
        var ink = ch.inks[got.who[j][i]][k];
        if (!ink) { continue; }
        var line = k === "o" || k === "p";
        var col = mix(ink, soil, line ? 0.08 : 0.2);
        x.fillStyle = css(col, line ? 0 : (hash(i, j, 7) - 0.5) * 10);
        var ii = dir > 0 ? i : L.w - 1 - i;
        var d = !line && px > 3 && hash(i, j, 3) < 0.1 ? px - 1 : px;
        x.fillRect(ii * px, j * px, d, d);
      }
    }
    // The folds: a crease of the paper's pale through the figure, every
    // other cell, and a little past it above and below.
    var paper = [234, 223, 205];
    [L.hip, L.neck].forEach(function (c) {
      var cc = dir > 0 ? c : L.w - c;
      for (var j = Math.max(0, top - 3); j <= Math.min(L.h - 1, bottom + 2); j += 1) {
        if (j % 2) { continue; }
        var on = got.cells[j][Math.min(L.w - 1, c)] !== "." || got.cells[j][Math.max(0, c - 1)] !== ".";
        x.globalAlpha = on ? 0.3 : 0.16;
        x.fillStyle = css(paper);
        x.fillRect(Math.round(cc * px - Math.max(1, px / 3) / 2), j * px, Math.max(1, Math.round(px / 3)), px);
      }
      x.globalAlpha = 1;
    });
    var keys = Object.keys(chCache);
    if (keys.length > 240) { keys.slice(0, 120).forEach(function (k2) { delete chCache[k2]; }); }
    chCache[key] = { cv: cv, w: L.w, h: L.h, ground: L.ground };
    return chCache[key];
  }

  /* ---- the canonical chimera, drawn fine -------------------------------------

     "The Bowed Mantle That Leaves a Trace" (the bison's head after de
     Kooning, the eagle's body after Warhol, the slug's hindquarters after
     Kapoor) is drawn twice over, cell by cell (parts/canonical/, by
     scripts/characters/canonical.py from references kept out of the
     repository): large, about 190 cells long, for its unfolding and
     whenever it is presented, and small, about 70, for walking in a city
     and along the globe. Each pose is a whole drawing, the three parts in
     register: standing, the wing raised (present), mantled, the head into
     the wind, four of a walk, looking at you, lying down, and the rest none
     of the three would hold alone (settle). Living things are laid over
     them here: a blink, a breath, the slug's foot rippling, its trace
     drying in steps behind it. Each cell is its artist's ink, worked a
     little with the soil it stands on: de Kooning's strokes keep a grain,
     Warhol's plates and Kapoor's bands are flat; Warhol's key line is
     printed a cell off register. The folds are creases of the paper: a
     pale line, the cells just before it a step darker, and a few dots of
     it above and below the figure. */

  var FINE = { "bison-eagle-slug": true };
  var fineFiles = {};
  var WALK_FINE = ["walkA", "passB", "walkB", "passA"];

  function unrle(s) {
    var out = [], n = "";
    for (var i = 0; i < s.length; i += 1) {
      var c = s.charAt(i);
      if (c >= "0" && c <= "9") { n += c; continue; }
      var k = n ? parseInt(n, 10) : 1;
      for (var q = 0; q < k; q += 1) { out.push(c); }
      n = "";
    }
    return out;
  }

  function fineOf(ids) {
    var key = ids.join("-");
    if (!FINE[key]) { return Promise.resolve(null); }
    if (!fineFiles[key]) {
      fineFiles[key] = get(BASE + "parts/canonical/" + key + ".json").then(function (J) {
        var F = { id: key, rgb: {}, slot: J.slots, memo: {} };
        Object.keys(J.inks).forEach(function (k) { F.rgb[k] = rgb(J.inks[k]); });
        ["large", "small"].forEach(function (sc) {
          var S = { frames: {}, folds: J[sc + "Folds"], w: 0, h: 0, ground: 0 };
          Object.keys(J[sc]).forEach(function (name) {
            var fr = J[sc][name], rows = fr.rows.map(unrle);
            var w = 0;
            rows.forEach(function (r) { w = Math.max(w, r.length); });
            rows.forEach(function (r) { while (r.length < w) { r.push("."); } });
            S.frames[name] = { rows: rows, key: fr.key, inner: fr.inner || [], ground: fr.ground, dx: fr.dx || 0 };
            S.w = Math.max(S.w, w); S.h = Math.max(S.h, rows.length); S.ground = fr.ground;
          });
          // Where the slug's tail ends, on the ground: where its trace begins.
          var st = S.frames.stand, tail = S.w;
          for (var j = Math.max(0, st.ground - 3); j < Math.min(st.rows.length, st.ground + 1); j += 1) {
            st.rows[j].forEach(function (k, i) { if (k !== "." && F.slot[k] === 2) { tail = Math.min(tail, i); } });
          }
          S.tail = tail;
          F[sc] = S;
        });
        return F;
      }).catch(function () { return null; });
    }
    return fineFiles[key];
  }

  // A pose's cells with the living changes laid over: a blink, a breath, the slug's ripple (0-7).
  function fineCells(F, sc, name, v) {
    var S = F[sc], fr = S.frames[name] || S.frames.stand;
    var mk = sc + name + (v.blink ? "b" : "") + (v.breath ? "r" : "") + (v.ripple >= 0 ? "w" + v.ripple : "");
    if (F.memo[mk]) { return F.memo[mk]; }
    var rows = fr.rows.map(function (r) { return r.slice(); });
    var h = rows.length, w = rows[0].length, g = fr.ground;
    var slotOf = function (k) { return k === "." ? -1 : F.slot[k]; };
    if (v.blink) {
      // The lid comes down: the eye's dark and light become the coat, a dark lash under.
      for (var j = 0; j < h; j += 1) {
        for (var i = 0; i < w; i += 1) {
          if (rows[j][i] === "K" || rows[j][i] === "W") {
            rows[j][i] = j + 1 < h && (rows[j + 1][i] === "K" || rows[j + 1][i] === "W") ? "C" : "A";
          }
        }
      }
    }
    if (v.breath) {
      // The eagle's back rises a cell (not its feet, not the head).
      var cut = g - Math.round(g * 0.18);
      var out = rows.map(function (r) { return r.slice(); });
      for (var j2 = 1; j2 < cut; j2 += 1) {
        for (var i2 = 0; i2 < w; i2 += 1) {
          var k2 = rows[j2][i2];
          if (slotOf(k2) === 1 && "lmntu".indexOf(k2) < 0) { out[j2 - 1][i2] = k2; }
        }
      }
      rows = out;
    }
    if (v.ripple >= 0) {
      // The slug's foot ripples: a long wave runs back along it, its crest
      // lifting the back a cell and paling the foot's edge under it.
      var hip = S.folds.hip - fr.dx, lam = Math.max(8, Math.round(w * 0.11));
      var out3 = rows.map(function (r) { return r.slice(); });
      for (var i3 = 0; i3 < Math.min(w, hip - 1); i3 += 1) {
        var ph = Math.sin((i3 / lam) * Math.PI * 2 + v.ripple * Math.PI / 4);
        if (ph < 0.7) { continue; }
        for (var j3 = 1; j3 < g; j3 += 1) {
          if (slotOf(rows[j3][i3]) === 2) {
            if (rows[j3 - 1][i3] === ".") { out3[j3 - 1][i3] = rows[j3][i3]; }
            break;
          }
        }
        for (var j5 = g + 1; j5 > 0; j5 -= 1) {
          if (rows[j5] && rows[j5][i3] === "O") { out3[j5][i3] = "R"; break; }
        }
      }
      rows = out3;
    }
    F.memo[mk] = rows;
    return rows;
  }

  var FINE_OX = 2, FINE_OY = 1;           // room round it for the key line off register

  function fineSprite(o, sc, name, v, dir, px) {
    var F = o.fine, ch = o.ch, S = F[sc], fr = S.frames[name] || S.frames.stand;
    var fold = ch.folded ? ch.folded.join("") : "";
    var key = "F" + sc + name + JSON.stringify(v) + dir + "|" + px + "|" + (ch.here ? ch.here.soil : "") + fold;
    if (chCache[key]) { return chCache[key]; }
    var rows = fineCells(F, sc, name, v);
    var W = S.w + FINE_OX * 2, H = S.h + FINE_OY + 1;
    var cv = document.createElement("canvas");
    cv.width = W * px;
    cv.height = H * px;
    var x = cv.getContext("2d");
    var soil = ch.here ? ch.here.soilRgb : [120, 100, 80];
    var paper = [234, 223, 205];
    var folds = [S.folds.hip, S.folds.neck];
    var hidden = function (k) { return ch.folded && ch.folded[F.slot[k]]; };
    var X = function (i) { var c = i + fr.dx + FINE_OX; return dir > 0 ? c : W - 1 - c; };
    var top = H, bottom = 0;
    for (var j = 0; j < rows.length; j += 1) {
      for (var i = 0; i < rows[j].length; i += 1) {
        var k = rows[j][i];
        if (k === "." || hidden(k)) { continue; }
        var slot = F.slot[k], col = mix(F.rgb[k], soil, slot === 0 ? 0.1 : 0.05);
        var c = i + fr.dx;
        if (folds.indexOf(c) >= 0) { col = mix(col, paper, 0.11); }
        else if (folds.indexOf(c + 1) >= 0) { col = mix(col, [0, 0, 0], 0.1); }
        top = Math.min(top, j); bottom = Math.max(bottom, j);
        x.fillStyle = css(col, slot === 0 ? (hash(i, j, 7) - 0.5) * 12 : 0);
        x.fillRect(X(i) * px, (j + FINE_OY) * px, px, px);
      }
    }
    // Warhol's key line, a cell off register (up, and back from the way it faces).
    if (!hidden("Y")) {
      // The drawn line inside the plates (the feathers' edges) printed fainter than the one round it.
      x.fillStyle = css(mix(mix(F.rgb.Y, F.rgb.c, 0.38), soil, 0.05));
      fr.inner.forEach(function (p) {
        var r1 = p[1] - 1;
        if (r1 < 0) { return; }
        x.fillRect(X(p[0] - 1) * px, (r1 + FINE_OY) * px, px, px);
      });
      x.fillStyle = css(mix(F.rgb.Y, soil, 0.05));
      fr.key.forEach(function (p) {
        var c2 = p[0] - 1, r2 = p[1] - 1;
        if (r2 < 0 || (rows[p[1]] && rows[p[1]][p[0]] !== "." && hidden(rows[p[1]][p[0]]))) { return; }
        x.fillRect(X(c2) * px, (r2 + FINE_OY) * px, px, px);
      });
    }
    // The folds: a few dots of the crease above and below the figure.
    if (top <= bottom) {
      folds.forEach(function (c3) {
        for (var j4 = Math.max(0, top - 4); j4 <= Math.min(S.h, bottom + 2); j4 += 2) {
          var r4 = rows[j4];
          if (r4 && r4[c3 - fr.dx] && r4[c3 - fr.dx] !== "." && !hidden(r4[c3 - fr.dx])) { continue; }
          x.globalAlpha = 0.14;
          x.fillStyle = css(paper);
          x.fillRect(X(c3 - fr.dx) * px + Math.floor(px / 3), (j4 + FINE_OY) * px, Math.max(1, Math.round(px / 3)), px);
        }
      });
      x.globalAlpha = 1;
    }
    var keys = Object.keys(chCache);
    if (keys.length > 240) { keys.slice(0, 120).forEach(function (k5) { delete chCache[k5]; }); }
    chCache[key] = { cv: cv, w: W, h: H, ground: fr.ground + FINE_OY };
    return chCache[key];
  }

  // Which pose, and what lives over it, now.
  function fineNow(o, now) {
    var t = now - o.since, v = { blink: false, breath: false, ripple: -1 };
    var fps = Math.max(3, o.pace.fps * 0.55);
    var step = Math.floor(now / (1000 / fps));
    if (o.state === "walk") {
      v.ripple = (64 - (step % 8)) % 8;
      return { name: WALK_FINE[step % 4], v: v };
    }
    if (o.state === "act") {
      var u = t / o.actMs;
      if (o.actSlot === 0) { return { name: u < 0.14 || u > 0.88 ? "stand" : "wind", v: v }; }
      if (o.actSlot === 1) { return { name: u < 0.12 ? "stand" : u < 0.26 || u > 0.9 ? "present" : "mantle", v: v }; }
      v.ripple = (64 - (step % 8)) % 8;
      return { name: "stand", v: v };
    }
    if (o.state === "settle") { return { name: "settle", v: { blink: false, breath: Math.floor(now / 1700) % 2 === 1, ripple: -1 } }; }
    if (o.state === "rest") { return { name: "rest", v: v }; }
    if (o.state === "present") { return { name: "present", v: v }; }
    if (o.state === "ritual") { return { name: Math.floor(t / 420) % 2 ? "wind" : "stand", v: v }; }
    if (o.state === "pressed") {
      if (t > 3600 && t < 5200) { v.ripple = (64 - (step % 8)) % 8; }
      return { name: t > 450 && t < 3600 ? "look" : t >= 3600 && t < 4300 ? "present" : "stand", v: v };
    }
    // Standing: it breathes; now and then a blink, the wing raised and settled, a look.
    var idle = o.idle;
    if (now > idle.next) {
      var r = Math.random();
      idle.name = r < 0.45 ? "blink" : r < 0.75 ? "present" : r < 0.9 ? "look" : "wind";
      idle.until = now + ({ blink: 170, present: 1100, look: 2200, wind: 1500 })[idle.name];
      idle.next = now + Math.pow(PHI, 3) * 1000 * (0.5 + Math.random() * 0.8);
    }
    v.breath = Math.floor(now / 1700) % 2 === 1;
    var name = "stand";
    if (now < idle.until) { if (idle.name === "blink") { v.blink = true; } else { name = idle.name; v.breath = false; } }
    if (o.look && now < o.look) { name = "look"; }
    return { name: name, v: v };
  }

  function fineScale(o) { return o.big ? "large" : "small"; }

  function finePx(o) {
    var S = o.fine[fineScale(o)];
    if (o.big) {
      var fitW = (window.innerWidth - 32) * chDpr / (S.w + FINE_OX * 2);
      var fitH = window.innerHeight * 0.46 * chDpr / (S.h + 2);
      return Math.max(1, Math.floor(Math.min(3 * chDpr, fitW, fitH)));
    }
    return Math.max(1, Math.round((o.far ? 1 : 4 / 3) * chDpr));
  }

  function fineBounds(o) {
    var S = o.fine[fineScale(o)], px = finePx(o) / chDpr;
    var W = S.w + FINE_OX * 2, c = (S.folds.hip + S.folds.neck) / 2 + FINE_OX;
    return { x: o.x - (o.dir > 0 ? c : W - c) * px, y: o.y - (S.ground + FINE_OY) * px, w: W * px, h: (S.h + FINE_OY + 1) * px, px: px };
  }

  // The calm ground it is presented on: the soil laid in a band of dots,
  // fading at its ends, the world behind dimmed, so it stands clear of the globe.
  function fineGround(o, b, now) {
    var a = Math.min(1, (now - o.born) / 700);
    var cx = (b.x + b.w / 2) * chDpr, gy = o.y * chDpr, rw = b.w * 0.62 * chDpr, rh = b.h * 0.8 * chDpr;
    var rad = Math.max(rw, rh) * 1.15;
    var grad = chG.createRadialGradient(cx, gy - rh * 0.35, 0, cx, gy - rh * 0.35, rad);
    grad.addColorStop(0, "rgba(16,11,8," + (0.9 * a) + ")");
    grad.addColorStop(0.6, "rgba(16,11,8," + (0.72 * a) + ")");
    grad.addColorStop(1, "rgba(16,11,8,0)");
    chG.fillStyle = grad;
    chG.fillRect(cx - rad, gy - rh * 0.35 - rad, rad * 2, rad * 2);       // the whole of it: no edge
    var soil = o.ch.here ? o.ch.here.soilRgb : [96, 66, 44];
    var px = finePx(o), n = Math.round(b.w * chDpr / px);
    var x0 = Math.round(b.x * chDpr);
    for (var i = -6; i < n + 6; i += 1) {
      var edge = Math.min(1, Math.min(i + 6, n + 6 - i) / 18);
      for (var j = 0; j < 4; j += 1) {
        var hsh = hash(i, j, 41);
        if (hsh > 0.62 - j * 0.1) { continue; }
        chG.globalAlpha = a * edge * (0.55 - j * 0.1);
        chG.fillStyle = css(mix(soil, [24, 16, 11], 0.15 + j * 0.15), (hash(i, j, 5) - 0.5) * 14);
        chG.fillRect(x0 + i * px, gy + j * px, px, px);
      }
    }
    chG.globalAlpha = 1;
  }

  // Its trace on the ground behind it, drying in steps: wet with a glint,
  // dark, half gone into the soil, a ghost, gone.
  function fineTrail(o, b, now) {
    if (!o.trail || !o.trail.length) { return; }
    var px = finePx(o), F = o.fine;
    var wet = F.rgb.x, glint = F.rgb.z, soil = o.ch.here ? o.ch.here.soilRgb : [96, 66, 44];
    o.trail = o.trail.filter(function (t) { return now - t.at < 9000; });
    o.trail.forEach(function (t, n) {
      var age = Math.floor((now - t.at) / 1500);
      var col = age === 0 && n % 5 === 0 ? glint : age <= 1 ? wet : mix(wet, soil, Math.min(0.85, (age - 1) * 0.28));
      chG.globalAlpha = age <= 2 ? 0.9 : Math.max(0, 0.9 - (age - 2) * 0.22);
      chG.fillStyle = css(col);
      var gx = Math.round(t.x * chDpr / px) * px, gy = Math.round(t.y * chDpr / px) * px;
      chG.fillRect(gx, gy - px, px * (o.big ? 2 : 1), px);
    });
    chG.globalAlpha = 1;
  }

  // A cell of trace where its tail is now, when it has moved a cell.
  function layTrail(o, now) {
    if (!o.trail) { return; }
    var b = fineBounds(o), S = o.fine[fineScale(o)];
    var tx = o.dir > 0 ? b.x + (S.tail + FINE_OX) * b.px : b.x + b.w - (S.tail + FINE_OX) * b.px;
    var last = o.trail[o.trail.length - 1];
    if (!last || Math.abs(last.x - tx) >= b.px || Math.abs(last.y - o.y) >= b.px) { o.trail.push({ x: tx, y: o.y, at: now }); }
  }

  function drawFine(o, now) {
    var sc = fineScale(o), px = finePx(o), f = fineNow(o, now);
    var sp = fineSprite(o, sc, f.name, f.v, o.dir, px);
    var b = fineBounds(o);
    if (o.big) { fineGround(o, b, now); }
    if (o.state === "walk") { layTrail(o, now); }
    fineTrail(o, b, now);
    var x = Math.round(b.x * chDpr), y = Math.round(b.y * chDpr);
    if (o.state === "ritual" && o.spin) {
      chG.save();
      chG.translate(x + sp.cv.width / 2, y + sp.cv.height / 2);
      chG.rotate(o.spin(now));
      chG.drawImage(sp.cv, -sp.cv.width / 2, -sp.cv.height / 2);
      chG.restore();
    } else {
      chG.globalAlpha = o.unfolding ? Math.min(1, (now - o.born) / 600) : 1;
      chG.drawImage(sp.cv, x, y);
      chG.globalAlpha = 1;
    }
    if (o.hit) {
      o.hit.hidden = !!o.big;
      o.hit.style.transform = "translate(" + Math.round(b.x + b.w * 0.1) + "px," + Math.round(b.y + b.h * 0.3) + "px)";
      o.hit.style.width = Math.round(b.w * 0.8) + "px";
      o.hit.style.height = Math.round(b.h * 0.6) + "px";
    }
    if (o.says && !o.says.hidden) {
      var sw = o.says.offsetWidth || 220;
      var left = Math.max(16, Math.min(window.innerWidth - sw - 16, b.x + b.w / 2 - sw / 2));
      o.says.style.transform = "translate(" + Math.round(left) + "px," + Math.round(Math.max(16, b.y + b.h * 0.25 - 34)) + "px)";
    }
  }

  function chSetUp() {
    if (chCv) { return; }
    chCv = document.createElement("canvas");
    chCv.className = "chimeras";
    chCv.setAttribute("aria-hidden", "true");
    chCv.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:86;image-rendering:pixelated";
    document.body.appendChild(chCv);
    chG = chCv.getContext("2d");
  }

  function chSize() {
    var d = Math.min(3, window.devicePixelRatio || 1);
    var w = Math.round(window.innerWidth * d), h = Math.round(window.innerHeight * d);
    if (chCv.width !== w || chCv.height !== h || d !== chDpr) { chCv.width = w; chCv.height = h; chDpr = d; chCache = {}; }
  }

  // Where its feet are, its size: `big` a presentation (the unfolding), else a city's.
  function cellPx(o) {
    var css_ = o.big ? (window.innerWidth < 720 ? 3.2 : 4.4) : (o.far ? 1 : 2 / RES);
    return Math.max(1, Math.round(css_ * chDpr));
  }

  function chBounds(o) {
    if (o.fine) { return fineBounds(o); }
    // Its feet's middle is the middle of its body.
    var L = o.L, px = cellPx(o) / chDpr, c = L.hip + o.ch.P[1].len / 2;
    return { x: o.x - (o.dir > 0 ? c : L.w - c) * px, y: o.y - L.ground * px, w: L.w * px, h: L.h * px, px: px };
  }

  // Which frame each part shows now.
  function namesNow(o, now) {
    var t = now - o.since;
    var pace = o.pace;
    if (o.state === "walk") {
      var f = Math.floor(now / (1000 / pace.fps)) % 6;
      return ["walk" + f, "walk" + f, "walk" + f];
    }
    if (o.state === "act") {
      var a = Math.min(3, Math.floor(t / (o.actMs / 4)));
      var n = ["stand0", "stand0", "stand0"];
      n[o.actSlot] = "act" + a;
      return n;
    }
    if (o.state === "settle") { return ["rest", "act3", "rest"]; }
    if (o.state === "ritual") { return o.ritualNames || ["ritual" + (Math.floor(t / 420) % 2), "stand0", "stand0"]; }
    if (o.state === "pressed") {
      return [t > 500 && t < 4200 ? "look" : "stand0", t > 2000 && t < 5000 ? "stand2" : "stand0",
              t > 3500 && t < 5000 ? "stand2" : "stand0"];
    }
    if (o.state === "rest") { return ["rest", "rest", "rest"]; }
    if (o.state === "present") { return ["present", "present", "present"]; }
    // Standing: breathing in the body, a blink, an ear, the wings half
    // raised now and then, the foot or the tail moving: each part its own.
    var idle = o.idle;
    if (now > idle.next) {
      var slot = Math.floor(Math.random() * 4);
      idle.slot = slot === 3 ? 0 : slot;
      idle.name = slot === 3 ? "stand1" : "stand2";
      idle.until = now + (idle.slot === 1 ? 2400 : idle.name === "stand1" ? 160 : 700);
      idle.next = now + Math.pow(PHI, 3) * 1000 * (0.6 + Math.random() * 0.8);
    }
    var names = ["stand0", Math.floor(now / 1600) % 2 ? "stand1" : "stand0", "stand0"];
    if (now < idle.until) { names[idle.slot] = idle.name; }
    if (o.look && now < o.look) { names[0] = "look"; }
    return names;
  }

  function chLoop() {
    if (chRaf) { return; }
    var tick = function (now) {
      chRaf = 0;
      chimeras = chimeras.filter(function (o) { return !o.gone; });
      if (!chimeras.length) { if (chG) { chG.clearRect(0, 0, chCv.width, chCv.height); } return; }
      chSize();
      chG.setTransform(1, 0, 0, 1, 0, 0);
      chG.clearRect(0, 0, chCv.width, chCv.height);
      chG.imageSmoothingEnabled = false;
      chimeras.forEach(function (o) { stepChimera(o, now); drawChimera(o, now); });
      chRaf = requestAnimationFrame(tick);
    };
    chRaf = requestAnimationFrame(tick);
  }

  function stepChimera(o, now) {
    if (!o.ready) { return; }
    // The game's stage put away: so is the chimera on it.
    if (o.big && o.stageEl && o.stageEl.hidden && now - o.born > 1500) { o.big = false; o.hidden = true; }
    var dt = Math.min(80, now - (o.last || now));
    o.last = now;
    if (o.route) { stepRoute(o, now); return; }
    if (o.target && o.state === "walk") {
      var dx = o.target.x - o.x, dy = o.target.y - o.y, d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1.5) {
        o.x = o.target.x; o.y = o.target.y; o.state = "stand"; o.since = now;
        var done = o.target.done; o.target = null; if (done) { done(); }
      } else {
        var go = Math.min(d, SPEED * o.pace.speed * dt / 1000);
        o.x += dx / d * go; o.y += dy / d * go;
        if (Math.abs(dx) > 1) { o.dir = dx > 0 ? 1 : -1; }
      }
    }
    // The slug's hindquarters glide in their act: it eases forward and lays its trace.
    if (o.fine && o.state === "act" && o.actSlot === 2) {
      o.x += o.dir * (o.big ? 7 : 3) * dt / 1000;
      layTrail(o, now);
    }
    if (o.state === "act" && now - o.since > o.actMs) { o.state = "stand"; o.since = now; if (o.actDone) { var f = o.actDone; o.actDone = null; f(); } }
    if (o.state === "pressed" && now - o.since > 6000) { o.state = "stand"; o.since = now; if (o.says) { o.says.hidden = true; } }
  }

  // Along a route on the globe (the corpse's legs), small, at its hindquarters' pace.
  function stepRoute(o, now) {
    var R = o.route, w = window.Land;
    if (!w || !w.at) { return; }
    var u = Math.min(1, (now - R.t0) / R.dur);
    var pts = R.pts, seg = Math.min(pts.length - 2, Math.floor(u * (pts.length - 1)));
    if (seg < 0) { return; }
    var f = u * (pts.length - 1) - seg, a = pts[seg], b = pts[seg + 1];
    var lat = a[0] + (b[0] - a[0]) * f, lon = a[1] + ((((b[1] - a[1]) + 540) % 360) - 180) * f;
    var p = w.at(lat, lon), q = w.at(b[0], b[1]);
    o.hidden = !p || p.z <= 0;
    if (p) { o.x = p.x; o.y = p.y - 2; }
    if (q && p && Math.abs(q.x - p.x) > 0.5) { o.dir = q.x > p.x ? 1 : -1; }
    o.state = u < 1 ? "walk" : "stand";
    if (u >= 1 && !R.ended) { R.ended = now; if (R.done) { R.done(); } }
    if (R.ended && now - R.ended > Math.pow(PHI, 6) * 1000) { o.route = null; o.hidden = true; }
  }

  function drawChimera(o, now) {
    if (!o.ready || o.hidden) { if (o.hit) { o.hit.hidden = true; } return; }
    if (o.fine) { drawFine(o, now); return; }
    var px = cellPx(o);
    var names = namesNow(o, now);
    var sp = chimeraSprite(o.ch, names, o.dir, px);
    var b = chBounds(o);
    var x = Math.round(b.x * chDpr), y = Math.round(b.y * chDpr);
    if (o.state === "ritual" && o.spin) {
      chG.save();
      chG.translate(x + sp.cv.width / 2, y + sp.cv.height / 2);
      chG.rotate(o.spin(now));
      chG.drawImage(sp.cv, -sp.cv.width / 2, -sp.cv.height / 2);
      chG.restore();
    } else if (o.unfolding) {
      chG.globalAlpha = Math.min(1, (now - o.born) / 600);
      chG.drawImage(sp.cv, x, y);
      chG.globalAlpha = 1;
    } else {
      chG.drawImage(sp.cv, x, y);
    }
    if (o.trail && o.state === "walk") { o.trail.push({ x: o.x - o.dir * b.w * 0.42, y: o.y, at: now }); }
    if (o.trail && o.fine) { return; }
    if (o.trail) {
      o.trail = o.trail.filter(function (t) { return now - t.at < 9000; });
      chG.fillStyle = css(rgb(o.ch.cs[2].after.inks.black[0]));
      o.trail.forEach(function (t) {
        chG.globalAlpha = 0.5 * Math.max(0, 1 - Math.floor((now - t.at) / 1500) / 6);
        chG.fillRect(Math.round(t.x * chDpr), Math.round(t.y * chDpr) - px, px * 2, px);
      });
      chG.globalAlpha = 1;
    }
    if (o.hit) {
      o.hit.hidden = !!o.big;
      o.hit.style.transform = "translate(" + Math.round(b.x + b.w * 0.1) + "px," + Math.round(b.y + b.h * 0.3) + "px)";
      o.hit.style.width = Math.round(b.w * 0.8) + "px";
      o.hit.style.height = Math.round(b.h * 0.6) + "px";
    }
    if (o.says && !o.says.hidden) {
      var sw = o.says.offsetWidth || 220;
      var left = Math.max(16, Math.min(window.innerWidth - sw - 16, b.x + b.w / 2 - sw / 2));
      o.says.style.transform = "translate(" + Math.round(left) + "px," + Math.round(Math.max(16, b.y + b.h * 0.25 - 34)) + "px)";
    }
  }

  // The tempo of everything it does: its hindquarters' (the slug's φ² slower).
  function tempoOf(c) {
    var s = moves(c).speed;
    return Math.max(1, Math.min(PHI * PHI, 1 / Math.sqrt(s)));
  }

  function chimera(ids, opts) {
    opts = opts || {};
    ids = (ids || []).slice(0, 3);
    if (ids.length !== 3) { return null; }
    var o = {
      ids: ids, x: opts.x || window.innerWidth / 2, y: opts.y || window.innerHeight * 0.6, dir: opts.dir || 1,
      state: "stand", since: performance.now(), born: performance.now(), idle: { next: 0, until: 0 },
      big: false, far: false, hidden: !!opts.hidden, ready: false, legs: opts.legs || null,
      month: opts.month || (new Date().getMonth() + 1), trail: null
    };
    o.ready_ = Promise.all([load(), partsOf(ids[0]), partsOf(ids[1]), partsOf(ids[2]), fineOf(ids)]).then(function (got) {
      var P = got.slice(1, 4);
      o.fine = got[4] || null;
      var cs = ids.map(castOf);
      if (P.some(function (p) { return !p; }) || cs.some(function (c) { return !c; })) { return false; }
      var season = ids[0] === "deer" ? seasonOf(o.month) : null;
      o.ch = { P: P, cs: cs, L: layout(P, season), key: ids.join("-") + (season || ""),
               inks: cs.map(function (c) { return c._ink || (c._ink = inkFor(c)); }),
               here: opts.lat !== undefined ? placeAt(opts.lat, opts.lon) : (opts.here || null) };
      o.L = o.ch.L;
      o.name = chimeraName(cs);
      var hm = moves(cs[2]);
      o.pace = { speed: hm.speed, fps: Math.max(4, Math.min(10, hm.fps * 1.5)), tempo: tempoOf(cs[2]) };
      if (hm.trail === "slime") { o.trail = []; }
      o.ready = true;
      return true;
    });
    chSetUp();
    var stage = document.getElementById("stage") || document.body;
    var hit = document.createElement("button");
    hit.type = "button";
    hit.className = "character";
    hit.hidden = true;
    hit.style.position = "fixed";
    hit.style.zIndex = "87";
    hit.setAttribute("aria-label", "A chimera — press to see what it is");
    hit.addEventListener("pointerdown", function (e) { e.stopPropagation(); });
    hit.addEventListener("click", function (e) { e.stopPropagation(); api.press(); });
    document.body.appendChild(hit);
    o.hit = hit;
    chimeras.push(o);
    chLoop();

    function pressLine() {
      var cs = o.ch.cs, legs = o.legs || [];
      var part = ["its head", "its body", "its tail"];
      var bits = [o.name, cs.map(function (c, i) {
        return (i ? c.name.charAt(0).toLowerCase() + c.name.slice(1) : c.name) + " after " + surname(c.artist);
      }).join(", ").replace(/american/, "American")];
      var where = legs.map(function (l, i) { return l && l.name ? part[i] + " from " + l.name.split(",")[0] : null; }).filter(Boolean);
      if (where.length) { bits.push(where.join(", ")); }
      return bits.join(" · ");
    }

    var api = {
      ids: ids,
      ready: o.ready_,
      get name() { return o.name || ""; },
      // Where its feet stand (CSS px), and which way it faces.
      at: function (x, y, dir) { o.x = x; o.y = y; if (dir) { o.dir = dir; } o.hidden = false; o.route = null; return api; },
      face: function (dir) { o.dir = dir < 0 ? -1 : 1; return api; },
      show: function () { o.hidden = false; return api; },
      hide: function () { o.hidden = true; return api; },
      // On a city's soil: its dots take the soil there.
      soil: function (lat, lon) { o.ready_.then(function () { o.ch.here = placeAt(lat, lon); chCache = {}; }); return api; },
      // A pose held: "stand", "look", "back", "rest", "present", "settle".
      pose: function (name) { o.state = name === "look" ? "stand" : name; o.since = performance.now(); if (name === "look") { o.look = performance.now() + 4000; } return api; },
      // Walk to a point on the screen, or along a route on the globe ([[lat, lon], ...] or legs of them).
      walk: function (to, ms) {
        return o.ready_.then(function () {
          return new Promise(function (done) {
            o.hidden = false;
            if (Array.isArray(to)) {
              var pts = [];
              (Array.isArray(to[0] && to[0][0]) ? to : [to]).forEach(function (leg) {
                leg.forEach(function (p) { if (!pts.length || pts[pts.length - 1] !== p) { pts.push(p); } });
              });
              if (pts.length < 2) { done(); return; }
              o.big = false;
              o.far = true;
              o.unfolding = false;
              o.route = { pts: pts, t0: performance.now(), dur: ms || 13000 * o.pace.tempo, done: done };
            } else {
              o.route = null;
              o.state = "walk";
              o.since = performance.now();
              o.target = { x: to.x, y: to.y, done: done };
            }
          });
        });
      },
      // One part's instinct (its ethogram's), as the unfolding plays it.
      act: function (slot) {
        var i = typeof slot === "number" ? slot : SLOTS.indexOf(slot);
        return o.ready_.then(function () {
          return new Promise(function (done) {
            o.state = "act"; o.actSlot = i; o.since = performance.now();
            o.actMs = 2600 * o.pace.tempo * 0.8;
            o.actDone = done;
          });
        });
      },
      // What a behaviour of one part is called, in plain words ("the squirrel buried something here").
      said: function (slot, role) {
        var c = o.ch && o.ch.cs[typeof slot === "number" ? slot : SLOTS.indexOf(slot)];
        var b = behaviour(c, role || "instinct");
        return b ? b.said : "";
      },
      /* The unfolding: the sheet opened a part at a time, and each parent
         doing what it does by instinct as it is seen, head, body,
         hindquarters; then the whole settles into a rest none of the three
         alone would hold (the head down, the body still doing its own, the
         hindquarters at rest). Large, at the middle of the screen, or at
         { x, y }. onStep(i, { slot, id, animal, artist, behaviour, said })
         for i 0, 1, 2, and 3 when it has settled. Its tempo is its
         hindquarters'. */
      unfold: function (onStep, at) {
        return o.ready_.then(function (ok) {
          if (!ok) { return false; }
          var W = window.innerWidth, H = window.innerHeight;
          o.big = true; o.far = false; o.route = null; o.hidden = false; o.unfolding = true;
          if (o.says) { o.says.hidden = true; }
          o.x = at && at.x !== undefined ? at.x : W / 2;
          o.y = at && at.y !== undefined ? at.y : (W <= 720 ? H * 0.42 : H * 0.62);
          o.dir = 1;
          o.born = performance.now();
          o.stageEl = document.querySelector(".corpse-stage");
          o.ch.folded = [true, true, true];
          chCache = {};
          var step = 2600 * o.pace.tempo;
          var tell = function (i) {
            var c = o.ch.cs[i], b = behaviour(c, "instinct");
            if (onStep) {
              try { onStep(i, { slot: SLOTS[i], id: c.id, animal: c.name, artist: c.artist, behaviour: b ? b.name : "", said: b ? b.said : "" }); } catch (e) { /* the game's own */ }
            }
          };
          return new Promise(function (done) {
            [0, 1, 2].forEach(function (i) {
              window.setTimeout(function () {
                o.ch.folded[i] = false;
                o.state = "act"; o.actSlot = i; o.since = performance.now(); o.actMs = step * 0.8;
                tell(i);
              }, 600 * o.pace.tempo + i * step);
            });
            window.setTimeout(function () {
              o.ch.folded = null;
              o.state = "settle"; o.since = performance.now();
              if (onStep) { try { onStep(3, { slot: null, name: o.name, said: "it settled as none of the three would alone" }); } catch (e) { /* the game's own */ } }
              done(true);
            }, 600 * o.pace.tempo + 3 * step);
          });
        });
      },
      // Large and still, for a moment of its own (the unfolding's end, a sheet).
      present: function (on) { o.big = on !== false; o.state = o.big ? "present" : "stand"; o.since = performance.now(); return api; },
      // Pressed: it stops, the head turns to you, the body eases its wings
      // or its coat, the hindquarters answer last; the line says what it is.
      press: function () {
        if (!o.ready || o.big) { return; }
        o.state = "pressed"; o.since = performance.now(); o.target = null;
        if (!o.says) {
          o.says = document.createElement("p");
          o.says.className = "chimera-says";
          o.says.style.cssText = "position:fixed;left:0;top:0;z-index:88;margin:0;padding:3px 8px;border-radius:3px;" +
            "background:rgba(15,10,7,0.8);color:#eadfcd;font-family:var(--mono,monospace);font-size:10px;line-height:1.4;" +
            "letter-spacing:0.04em;pointer-events:none;max-width:min(300px,calc(100vw - 32px));box-sizing:border-box";
          document.body.appendChild(o.says);
        }
        o.says.textContent = pressLine();
        o.says.hidden = false;
      },
      line: function () { return o.ready ? pressLine() : ""; },
      // Drawn once into a canvas of one's own (the preview, a sheet): the
      // pose of each part ("walk3", or [head, body, hind]), a cell `px` device px.
      draw: function (ctx, x, y, names, px, dir) {
        if (!o.ready) { return null; }
        if (typeof names === "string") { names = [names, names, names]; }
        var sp = chimeraSprite(o.ch, names, dir || 1, px || 4);
        ctx.drawImage(sp.cv, x, y);
        return { w: sp.cv.width, h: sp.cv.height, ground: sp.ground * (px || 4) };
      },
      // The canonical one, drawn fine: a pose of the large or small drawing
      // ("stand", "mantle", "walkA" ...), with { blink, breath, ripple 0-7 }.
      fine: function () { return o.fine ? Object.keys(o.fine.large.frames) : null; },
      drawFine: function (ctx, x, y, name, px, dir, scale, v) {
        if (!o.ready || !o.fine) { return null; }
        v = v || {};
        var sp = fineSprite(o, scale || "large", name, { blink: !!v.blink, breath: !!v.breath, ripple: v.ripple >= 0 ? v.ripple : -1 }, dir || 1, px || 3);
        ctx.drawImage(sp.cv, x, y);
        return { w: sp.cv.width, h: sp.cv.height, ground: sp.ground * (px || 3) };
      },
      // Where it is, for the game and the checks.
      state: function () { return { name: o.name, ids: ids, x: o.x, y: o.y, state: o.state, big: o.big, hidden: !!o.hidden, w: o.L ? o.L.w : 0 }; },
      close: function () {
        o.gone = true;
        if (o.hit && o.hit.parentNode) { o.hit.parentNode.removeChild(o.hit); }
        if (o.says && o.says.parentNode) { o.says.parentNode.removeChild(o.says); }
      },
      _o: o
    };
    api.remove = api.close;
    return api;
  }

  /* Two that meet: the ritual of their heads' animals (each a documented
     courtship or contest, in the ethogram). Two foxes' heads gekker, side
     on; eagles lock talons and fall turning; bison meet head to head;
     stags roar and walk side by side; slugs circle and lunge; squirrels
     chase round and round. Drawn where the game's ritual box is, else at
     the middle of the screen. Resolves when it is over, with the line. */
  function meet(a, b, opts) {
    opts = opts || {};
    if (Array.isArray(a)) { a = chimera(a); }
    if (Array.isArray(b)) { b = chimera(b); }
    if (!a || !b) { return Promise.resolve(null); }
    return Promise.all([a.ready, b.ready]).then(function () {
      var A = a._o, B = b._o;
      var kind = A.ch.cs[0].id;
      var W = window.innerWidth, H = window.innerHeight;
      var box = document.querySelector(".corpse-ritual:not([hidden])");
      var r = box ? box.getBoundingClientRect() : null;
      var cx = opts.x || (r ? r.left + r.width / 2 : W / 2), cy = opts.y || (r ? r.top + 66 : H * 0.6);
      var t0 = performance.now(), dur = 7000 * Math.max(A.pace.tempo, B.pace.tempo);
      [A, B].forEach(function (o, n) {
        o.big = false; o.far = false; o.route = null; o.hidden = false;
        o.x = cx + (n ? 70 : -70); o.y = cy; o.dir = n ? -1 : 1;
        o.state = "ritual"; o.since = t0; o.spin = null;
      });
      var path_ = {
        fox: function (o, n, u) { o.x = cx + (n ? 1 : -1) * (46 - 10 * Math.min(1, u * 3)); o.ritualNames = ["ritual" + (Math.floor(u * 22 + n) % 2), "stand0", "stand2"]; },
        eagle: function (o, n, u) {
          var fall = Math.max(0, u - 0.3) / 0.7;
          o.y = cy - 40 + fall * 40; o.x = cx + (n ? 16 : -16);
          o.spin = fall > 0 && fall < 1 ? function (now) { return ((now - t0) / 400) * (n ? -1 : 1); } : null;
          o.ritualNames = ["ritual1", fall > 0 ? "present" : "act3", "stand0"];
        },
        bison: function (o, n, u) { var p = u < 0.4 ? u / 0.4 : 1; o.x = cx + (n ? 1 : -1) * (70 - 40 * p + (u > 0.4 ? 3 * Math.abs(Math.sin(u * 30)) : 0)); o.ritualNames = ["ritual" + (u > 0.4 ? 1 : 0), "stand0", "stand0"]; },
        deer: function (o, n, u) { o.dir = 1; o.y = cy + (n ? 10 : -10); o.x = cx - 60 + u * 120; o.ritualNames = u > 0.5 && u < 0.7 ? ["ritual1", "stand0", "stand0"] : ["walk" + (Math.floor(u * 60) % 6), "walk" + (Math.floor(u * 60) % 6), "walk" + (Math.floor(u * 60) % 6)]; },
        slug: function (o, n, u) { var a2 = u * Math.PI * 2 + (n ? Math.PI : 0); o.x = cx + Math.cos(a2) * 40; o.y = cy + Math.sin(a2) * 8; o.dir = Math.sin(a2) > 0 ? -1 : 1; o.ritualNames = ["ritual" + (u > 0.8 ? 1 : 0), "stand0", "walk" + (Math.floor(u * 40) % 6)]; },
        squirrel: function (o, n, u) { var a2 = u * Math.PI * 6 + (n ? 0.9 : 0); o.x = cx + Math.cos(a2) * 50; o.y = cy + Math.sin(a2) * 10; o.dir = Math.sin(a2) > 0 ? -1 : 1; o.ritualNames = ["stand0", "walk" + (Math.floor(u * 90) % 6), "walk" + (Math.floor(u * 90) % 6)]; }
      }[kind] || function (o, n) { o.dir = n ? -1 : 1; o.ritualNames = ["look", "stand0", "stand0"]; };
      var rit = behaviour(A.ch.cs[0], "ritual");
      return new Promise(function (done) {
        (function tick() {
          var u = Math.min(1, (performance.now() - t0) / dur);
          [A, B].forEach(function (o, n) { path_(o, n, u); });
          if (u < 1) { window.setTimeout(tick, 40); return; }
          [A, B].forEach(function (o, n) { o.state = "stand"; o.spin = null; o.dir = n ? -1 : 1; o.since = performance.now(); });
          done({ ritual: rit ? rit.name : "", said: rit ? rit.said : "" });
        })();
      });
    });
  }

  window.Characters = {
    wave: wave,
    // land.js, while following: where the animal is to be, and the end of it.
    guide: guide,
    following: function () { return !!follower(); },
    // walks.js: the animal leads a walk; and the cast, read.
    lead: lead,
    cast: function () { return load().then(function () { return cast && cast.cast; }); },
    artists: function () { return load().then(function () { return artists; }); },
    unfollowed: function () { var f = follower(); if (f) { release(f, performance.now()); } },
    // The exquisite corpse (corpse.js): a chimera of three of the cast, the
    // ritual of two that meet, and each animal's documented behaviours.
    chimera: chimera,
    meet: meet,
    ethogram: function (id) { var c = castOf(id); return (c && c.ethogram) || []; },
    // For the preview (scripts/preview_character.js): the files, read,
    // and one pose drawn as the page draws it, on a place's soil and plants.
    load: load,
    preview: function (ctx, o) {
      var c = cast.cast.filter(function (k) { return k.id === o.id; })[0];
      var here = placeAt(o.lat, o.lon);
      var keep = dpr;
      dpr = o.scale;
      spriteCache = {};
      if (o.plants && here) {
        here.set.strata.forEach(function (st, k) {
          var cr = makeCrown(st[1], Math.max(5, Math.min(18, 4 + st[2] * 0.3)), here.set.look, here.soilRgb, 0.3 + k * 0.2);
          var px = Math.max(1, Math.round(CELL * dpr));
          var ox = o.x + k * 44 * dpr, oy = o.y;
          ctx.globalAlpha = 0.42; ctx.fillStyle = cr.shadeC;
          cr.shade.forEach(function (d) { ctx.fillRect(ox + d.i * px, oy + d.j * px, px, px); });
          ctx.globalAlpha = 1;
          cr.dots.forEach(function (d) { ctx.fillStyle = d.c; ctx.fillRect(ox + d.i * px, oy + d.j * px, px, px); });
        });
      } else {
        var sp = sprite(c, o.pose, o.n || 0, o.dir || 1, here, 1);
        ctx.drawImage(sp.cv, o.x, o.y);
      }
      dpr = keep;
      spriteCache = {};
      return here && { soil: here.soil, soilRgb: here.soilRgb, biome: here.set.biome, realm: here.set.realm,
                       eco: here.eco, strata: here.set.strata.map(function (st) { return st[0] + " (" + st[1] + "): " + st[4].join(", "); }) };
    },
    _state: function () {
      var all = crowd.map(function (o) {
        return { id: o.c.id, pose: o.pose, state: o.state, mode: o.mode, x: o.x, y: o.y, hidden: !!o.hidden,
                 line: line(o), plants: o.plants.length, meet: o.meet ? o.meet.c.id : null, far: o.farKind || null,
                 home: o.plants.filter(function (p) { return p.home; }).length, guide: !!o.guide };
      });
      var first = all[0] ? Object.assign({}, all[0]) : null;
      if (first) { first.crowd = all; first.pair = pair && !pair.hidden ? pair.textContent : null; first.visit = visit.key; }
      return first;
    },
    _prefer: function (id) { prefer = id || null; },
    // The checks: bring one now, by id, in a mode ("home" in the city you are in, "rest", or a wave).
    _come: function (id, mode) {
      return Promise.all([load(), loadTowns()]).then(function () {
        var c = cast.cast.filter(function (k) { return k.id === id; })[0];
        var w = window.Land && Land.where ? Land.where() : {};
        var t = w.key && townOf(w.key);
        if (!c || !t || !setUp()) { return false; }
        size();
        lastCame = -1e9;
        if (mode === "rest") { comeRest(c, t); } else { comeHome(c, t, null); }
        return true;
      });
    }
  };

  // Where you are and where you are going, read a few times a second.
  if (!still) {
    window.addEventListener("load", function () { window.setTimeout(load, 4000); });
    window.setInterval(poll, 300);
  }
})();
