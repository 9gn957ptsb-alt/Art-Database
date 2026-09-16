/* The land — a world you turn.

   Two sources, and they do different jobs.

   ../works.json is Matthew's. Its `terms` give the world its words, and a word
   links to his works that share it. Each work is also a landmass: its own
   words sit on it, so the geography is the works.

   land.json is the token supply, built from the Artsy saves. A token is one of
   those works boiled down to the three colours it reduces to. The creature
   turns one up as it grazes; hold it to condense it, throw it to repaint the
   creature. Artsy works are tokens and nothing else — they are never what a
   word links to.

   The sphere is painted on a canvas and the words stand on it as real DOM, so
   they stay legible, focusable and clickable. Both use the same projection.

   No build step and no dependencies: the page is served as it is written. */

(function () {
  "use strict";

  var stage = document.getElementById("stage");
  var canvas = document.getElementById("world");
  var ctx = canvas.getContext("2d");
  var land = document.getElementById("land");
  var loading = document.getElementById("land-loading");
  var creature = document.getElementById("creature");
  var graze = document.getElementById("graze");
  var grazeCard = document.getElementById("graze-card");
  var grazePlate = document.getElementById("graze-plate");
  var grazeTitle = document.getElementById("graze-title");
  var grazeMeta = document.getElementById("graze-meta");
  var grazeHint = document.getElementById("graze-hint");
  var token = document.getElementById("token");
  var seam = document.getElementById("seam");
  var seamWord = document.getElementById("seam-word");
  var seamCount = document.getElementById("seam-count");
  var seamList = document.getElementById("seam-list");
  var seamClose = document.getElementById("seam-close");

  // The background: an off-white, barely there where it meets the sphere's
  // contour, giving way to the off-black opposite it as it goes out.
  var OFF_WHITE = "243, 241, 234";
  var OFF_BLACK = "#0c0e14";

  // The sphere is washed on rather than painted over: its blues and greens
  // are held at this much, so the gradient behind comes through them.
  var GLOBE_ALPHA = 0.68;

  // The faces a word can be wearing. Each word keeps being re-rolled, so no
  // word holds one for long.
  var FACES = [
    '"Anton", Impact, sans-serif',
    '"Archivo", Helvetica, Arial, sans-serif',
    '"Bebas Neue", Impact, sans-serif',
    '"Courier Prime", Courier, monospace',
    '"DM Serif Display", Georgia, serif',
    '"Newsreader", Georgia, serif',
    '"Playfair Display", Georgia, serif',
    '"Space Mono", Menlo, monospace'
  ];

  var ROLL_MIN = 2400;   // how long a word keeps a face before taking another
  var ROLL_MAX = 7600;

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));  // the angle that spaces a spiral

  var TILT = 27 * RAD;       // the north pole leans toward the viewer
  var COS_T = Math.cos(TILT);
  var SIN_T = Math.sin(TILT);

  // The sphere's middle sits well below the floor of the room, so the only
  // surface anyone can see is its crown. The words live there.
  var LAT_TOP = 87 * RAD;
  var LAT_LOW = 41 * RAD;

  var GRAZE_MIN = 2800;      // how long the creature stays with a word
  var GRAZE_MAX = 5600;
  var HOLD = 380;            // press this long and the token condenses
  var FREE = 6000;           // how long the world stays where you left it

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var supply = null;    // land.json — the tokens
  var mine = null;      // works.json — the artist's works
  var vocabulary = [];  // [{ word, works, lat, lon, mass, el }]
  var masses = [];      // one landmass per work

  var here = 0;         // which word the creature is standing on
  var offering = null;  // the token currently turned up
  var walkTimer = null;

  var spin = 0;         // the world's rotation
  var wanted = 0;       // where it is easing to
  var freeUntil = 0;    // while the viewer is turning it, it follows nobody
  var beast = { lat: 0, lon: 0 };
  var goal = { lat: 0, lon: 0 };

  var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;

  /* ---- reading ---------------------------------------------------------- */

  function thumb(tok) { return supply.cdn + tok.i + ".jpg"; }

  function tokenLine(tok) {
    return [tok.a, tok.y].filter(Boolean).join(", ");
  }

  function workLine(work) {
    var bits = [work.medium];
    if (work.dimensions) {
      bits.push(work.dimensions + (work.unframed ? " (unframed)" : ""));
    }
    return bits.filter(Boolean).join(", ");
  }

  /* The world's words, in the order the works introduce them. */
  function readVocabulary() {
    var order = [];
    var held = {};

    mine.works.forEach(function (work) {
      (work.terms || []).forEach(function (term) {
        if (!held[term]) {
          held[term] = [];
          order.push(term);
        }
        held[term].push(work);
      });
    });

    return order.map(function (term) {
      return { word: term, works: held[term] };
    });
  }

  /* ---- laying the world out --------------------------------------------- */

  /* Words are spread down a spiral from near the pole to below the equator,
     which keeps them evenly spaced and all on the face that is lit. */
  function survey() {
    var n = vocabulary.length;
    var sinTop = Math.sin(LAT_TOP);
    var sinLow = Math.sin(LAT_LOW);

    vocabulary.forEach(function (ground, i) {
      var f = (i + 0.5) / n;
      ground.lat = Math.asin(sinTop - f * (sinTop - sinLow));
      ground.lon = (i * GOLDEN) % TAU;
    });

    // A landmass per work, sitting under that work's own words.
    masses = mine.works.map(function (work, i) {
      var own = vocabulary.filter(function (g) {
        return g.works.indexOf(work) !== -1;
      });
      var x = 0, y = 0, z = 0;
      own.forEach(function (g) {
        var weight = 1 / g.works.length;
        x += Math.cos(g.lat) * Math.cos(g.lon) * weight;
        y += Math.cos(g.lat) * Math.sin(g.lon) * weight;
        z += Math.sin(g.lat) * weight;
      });
      var len = Math.sqrt(x * x + y * y + z * z) || 1;
      return {
        lat: Math.asin(z / len),
        lon: Math.atan2(y / len, x / len),
        size: 0.20 + 0.035 * own.length,
        tone: i % 2 ? "111, 154, 60" : "195, 212, 82"
      };
    });

    // Islands on the lower flanks. No word stands on them — they are there
    // because a world is not all one continent.
    for (var k = 0; k < 6; k += 1) {
      masses.push({
        lat: (24 + k * 3.5) * RAD,
        lon: (k * 2.4 + 0.7) % TAU,
        size: 0.10 + (k % 3) * 0.035,
        tone: k % 2 ? "195, 212, 82" : "111, 154, 60"
      });
    }
  }

  /* ---- the projection ---------------------------------------------------- */

  /* Spin about the axis, then lean the pole toward the viewer. Returns screen
     coordinates and the depth: 1 dead in front, 0 at the limb, negative
     round the back. */
  function project(lat, lon) {
    var a = lon - spin;
    var cosLat = Math.cos(lat);
    var x = cosLat * Math.sin(a);
    var y = Math.sin(lat);
    var z = cosLat * Math.cos(a);

    var y2 = y * COS_T - z * SIN_T;
    var z2 = y * SIN_T + z * COS_T;

    return { x: cx + x * R, y: cy - y2 * R, z: z2 };
  }

  function geometry() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The sphere rises out of the floor: it is wider than the room, its top
    // sits a little under halfway down, and its middle is far below the
    // bottom edge — so what shows is the crown, curving away on both sides.
    R = Math.max(W * 0.52, H * 0.42, 200);
    cx = W / 2;
    cy = H * 0.42 + R;

    // Type scales with the world, so a phone gets a legible globe. Which
    // face and how big relative to the rest is the word's own business.
    dressAll();

  }

  /* ---- how a word is dressed --------------------------------------------- */

  /* Every word wears a face and a size of its own, and keeps taking new ones
     for as long as the page is open. Size is rolled rather than read off how
     many works carry the word, so the count no longer shows in the type —
     that is what the panel is for. */
  function roll(ground) {
    ground.face = FACES[Math.floor(Math.random() * FACES.length)];
    ground.weight = Math.random() < 0.45 ? 700 : 400;
    ground.factor = 0.55 + Math.random() * 1.85;
    dress(ground);

    if (still) { return; }   // one face, held, for anyone who asked for calm
    ground.timer = window.setTimeout(function () { roll(ground); },
      ROLL_MIN + Math.random() * (ROLL_MAX - ROLL_MIN));
  }

  function dress(ground) {
    if (!ground.el || !ground.face) { return; }
    var size = (R / 620) * 19 * ground.factor;
    ground.el.style.fontFamily = ground.face;
    ground.el.style.fontWeight = String(ground.weight);
    ground.el.style.fontSize = Math.max(11, size).toFixed(2) + "px";
  }

  function dressAll() { vocabulary.forEach(dress); }

  /* ---- painting the world ------------------------------------------------ */

  function paint(now) {
    ctx.clearRect(0, 0, W, H);

    // The room is nothing but the falling-off of the off-white. Its inner
    // radius is R, so the gradient starts exactly on the sphere's contour.
    ctx.fillStyle = OFF_BLACK;
    ctx.fillRect(0, 0, W, H);

    // Brightest on the contour, falling away both outward into the room and
    // inward under the sphere — so the translucent blues and greens have a
    // gradient to pick up rather than a flat black.
    var out = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.6);
    out.addColorStop(0, "rgba(" + OFF_WHITE + ", 0.015)");
    out.addColorStop(0.44, "rgba(" + OFF_WHITE + ", 0.06)");
    out.addColorStop(0.625, "rgba(" + OFF_WHITE + ", 0.19)");   // the contour
    out.addColorStop(0.78, "rgba(" + OFF_WHITE + ", 0.05)");
    out.addColorStop(1, "rgba(" + OFF_WHITE + ", 0)");
    ctx.fillStyle = out;
    ctx.fillRect(0, 0, W, H);

    // What the creature stands on is the brightest part of the sphere.
    var lit = project(beast.lat, beast.lon);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.globalAlpha = GLOBE_ALPHA;

    var base = ctx.createRadialGradient(
      lit.x, lit.y, R * 0.04, cx, cy, R * 1.2);
    base.addColorStop(0, "#3f9fd0");
    base.addColorStop(0.22, "#1d6ea8");
    base.addColorStop(0.58, "#0d3f74");
    base.addColorStop(1, "#04142c");
    ctx.fillStyle = base;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    masses.forEach(function (mass) {
      var p = project(mass.lat, mass.lon);
      if (p.z <= 0.02) { return; }

      var fade = Math.min(1, p.z * 1.5);
      var rx = mass.size * R * (0.34 + 0.66 * p.z);
      var ry = mass.size * R * (0.62 + 0.38 * p.z);

      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(rx, ry));
      g.addColorStop(0, "rgba(" + mass.tone + ", " + (0.92 * fade).toFixed(3) + ")");
      g.addColorStop(0.55, "rgba(" + mass.tone + ", " + (0.55 * fade).toFixed(3) + ")");
      g.addColorStop(1, "rgba(" + mass.tone + ", 0)");

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((mass.lon + mass.lat) * 0.7);
      ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));
      ctx.beginPath();
      ctx.arc(0, 0, Math.max(rx, ry), 0, TAU);
      ctx.restore();
      ctx.fillStyle = g;
      ctx.fill();
    });

    // The pale weather that drifts over it.
    var drift = ctx.createRadialGradient(
      lit.x, lit.y, R * 0.02, lit.x, lit.y, R * 0.5);
    drift.addColorStop(0, "rgba(233, 240, 226, 0.34)");
    drift.addColorStop(0.6, "rgba(233, 240, 226, 0.08)");
    drift.addColorStop(1, "rgba(233, 240, 226, 0)");
    ctx.fillStyle = drift;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // Limb darkening: the edge of a sphere turns away from every light.
    var limb = ctx.createRadialGradient(cx, cy, R * 0.52, cx, cy, R);
    limb.addColorStop(0, "rgba(12, 14, 20, 0)");
    limb.addColorStop(0.78, "rgba(12, 14, 20, 0.26)");
    limb.addColorStop(1, "rgba(12, 14, 20, 0.6)");
    ctx.fillStyle = limb;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    ctx.restore();   // drops the clip and the globe's alpha together

    // The thin bright edge where the sphere ends.
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = "rgba(190, 220, 235, 0.32)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();

  }

  /* ---- standing things on it --------------------------------------------- */

  function placeWords() {
    vocabulary.forEach(function (ground) {
      var el = ground.el;
      var p = project(ground.lat, ground.lon);

      // Turned away, or so far round the side that it would be cut in half by
      // the edge of the room: either way it waits until the world brings it
      // back rather than showing as a fragment.
      if (p.z <= 0.04 || p.x < 36 || p.x > W - 36) {
        el.style.visibility = "hidden";
        el.dataset.behind = "true";
        return;
      }

      var fade = 0.36 + 0.64 * Math.min(1, (p.z - 0.04) / 0.3);
      var scale = 0.64 + 0.36 * p.z;

      el.style.visibility = "visible";
      delete el.dataset.behind;
      el.style.opacity = fade.toFixed(3);
      el.style.zIndex = String(20 + Math.round(p.z * 30));
      el.style.transform =
        "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)" +
        " translate(-50%,-50%) scale(" + scale.toFixed(3) + ")";
    });
  }

  function placeCreature() {
    var p = project(beast.lat, beast.lon);
    var near = 0.72 + 0.46 * Math.max(0, p.z);
    var scale = near * Math.max(0.5, Math.min(1.15, R / 620));

    creature.style.opacity = p.z <= 0 ? "0" : "1";
    creature.style.transform =
      "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)" +
      " translate(-50%,-92%) scale(" + scale.toFixed(3) + ")";

    return p;
  }

  /* ---- the turning ------------------------------------------------------- */

  function shortest(from, to) {
    var d = (to - from) % TAU;
    if (d > Math.PI) { d -= TAU; }
    if (d < -Math.PI) { d += TAU; }
    return d;
  }

  var last = { x: 0 };

  function frame(now) {
    // The world turns to keep the creature in the light, unless the viewer is
    // turning it themselves.
    if (now > freeUntil) {
      wanted = beast.lon;
    }
    spin += shortest(spin, wanted) * (still ? 1 : 0.055);

    // The creature crosses the surface toward the word it is heading for.
    var ease = still ? 1 : 0.055;
    beast.lat += (goal.lat - beast.lat) * ease;
    beast.lon += shortest(beast.lon, goal.lon) * ease;

    var moved = beast.lon - last.x;
    if (Math.abs(moved) > 0.0015) {
      creature.dataset.facing = moved > 0 ? "right" : "left";
      last.x = beast.lon;
    }

    paint(now);
    placeWords();
    var p = placeCreature();
    if (!graze.hidden) { positionGraze(p); }

    requestAnimationFrame(frame);
  }

  /* ---- the walk ---------------------------------------------------------- */

  function standOn(index) {
    var ground = vocabulary[index];
    if (!ground) { return; }

    vocabulary.forEach(function (g) { delete g.el.dataset.grazed; });
    ground.el.dataset.grazed = "true";
    here = index;

    goal.lat = ground.lat;
    goal.lon = ground.lon;
  }

  function walk() {
    delete creature.dataset.grazing;

    // Wherever it goes next, it is somewhere else — the world is small enough
    // that any word is a short walk.
    var next = here;
    while (next === here && vocabulary.length > 1) {
      next = Math.floor(Math.random() * vocabulary.length);
    }
    standOn(next);

    walkTimer = window.setTimeout(function () {
      creature.dataset.grazing = "true";
      offering = null;          // new ground, something new to turn up
      if (!graze.hidden) { offer(); }
      walkTimer = window.setTimeout(
        walk, GRAZE_MIN + Math.random() * (GRAZE_MAX - GRAZE_MIN));
    }, still ? 1 : 1800);
  }

  function hold() { window.clearTimeout(walkTimer); }
  function resume() {
    hold();
    walkTimer = window.setTimeout(walk, GRAZE_MIN);
  }

  /* ---- what it turns up --------------------------------------------------- */

  /* Where the word the creature is standing on is one an Artsy medium also
     says — paper, photograph, tape — it turns up something that shares it.
     Otherwise it turns up whatever is in the general supply. */
  function pick() {
    var ground = vocabulary[here];
    var keys = (ground && supply.byTerm[ground.word]) || supply.pool;
    if (!keys || !keys.length) { return null; }
    return supply.tokens[keys[Math.floor(Math.random() * keys.length)]] || null;
  }

  function positionGraze(p) {
    var width = graze.offsetWidth || 168;
    var height = graze.offsetHeight || 190;
    var x = Math.max(8, Math.min(p.x - width / 2, W - width - 8));
    var y = p.y - creature.offsetHeight - height - 6;
    if (y < 8) { y = p.y + 16; }
    graze.style.left = Math.round(x) + "px";
    graze.style.top = Math.round(y) + "px";
  }

  function offer() {
    if (!offering) { offering = pick(); }
    if (!offering) { hideGraze(); return; }

    grazePlate.src = thumb(offering);
    grazePlate.alt = offering.t + (offering.a ? " by " + offering.a : "");
    grazeTitle.textContent = offering.t;
    grazeMeta.textContent = tokenLine(offering);
    grazeHint.textContent = "Hold to condense";
    delete graze.dataset.condensing;

    graze.hidden = false;
    positionGraze(project(beast.lat, beast.lon));
  }

  function hideGraze() {
    graze.hidden = true;
    delete graze.dataset.condensing;
  }

  /* ---- condensing and throwing ------------------------------------------- */

  var holdTimer = null;
  var carrying = null;

  function condense(tok, x, y) {
    carrying = tok;
    token.style.setProperty("--t1", tok.c[0]);
    token.style.setProperty("--t2", tok.c[1]);
    token.style.setProperty("--t3", tok.c[2]);
    delete token.dataset.thrown;
    token.hidden = false;
    moveToken(x, y);
    graze.dataset.condensing = "true";
    grazeHint.textContent = "Throw it at the creature";
  }

  function moveToken(x, y) {
    token.style.left = Math.round(x - token.offsetWidth / 2) + "px";
    token.style.top = Math.round(y - token.offsetHeight / 2) + "px";
  }

  function wear(tok) {
    creature.style.setProperty("--c1", tok.c[0]);
    creature.style.setProperty("--c2", tok.c[1]);
    creature.style.setProperty("--c3", tok.c[2]);
    creature.dataset.struck = "true";
    window.setTimeout(function () { delete creature.dataset.struck; }, 460);
  }

  function landedOn(x, y) {
    var box = creature.getBoundingClientRect();
    var pad = 30;
    return x >= box.left - pad && x <= box.right + pad &&
           y >= box.top - pad && y <= box.bottom + pad;
  }

  function release(clientX, clientY) {
    if (!carrying) { return; }

    if (landedOn(clientX, clientY)) {
      wear(carrying);
      token.hidden = true;
    } else {
      token.dataset.thrown = "true";
      window.setTimeout(function () { token.hidden = true; }, 320);
    }

    hideGraze();
    carrying = null;
    resume();
  }

  grazeCard.addEventListener("pointerdown", function (event) {
    if (!offering) { return; }
    event.preventDefault();
    event.stopPropagation();          // this is a hold, not a turn of the world
    var tok = offering;
    var x = event.clientX;
    var y = event.clientY;

    // Capture now, so the throw can carry the token past the card's own box.
    try { grazeCard.setPointerCapture(event.pointerId); } catch (e) {}

    holdTimer = window.setTimeout(function () { condense(tok, x, y); }, HOLD);
  });

  grazeCard.addEventListener("pointermove", function (event) {
    if (!carrying) { return; }
    moveToken(event.clientX, event.clientY);
  });

  ["pointerup", "pointercancel"].forEach(function (name) {
    grazeCard.addEventListener(name, function (event) {
      window.clearTimeout(holdTimer);
      release(event.clientX, event.clientY);
    });
  });

  // Keyboard: Enter on the token condenses and applies it in one move.
  grazeCard.tabIndex = 0;
  grazeCard.setAttribute("role", "button");
  grazeCard.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") { return; }
    event.preventDefault();
    if (!offering) { return; }
    wear(offering);
    hideGraze();
    resume();
  });

  /* ---- showing and hiding what it turned up ------------------------------ */

  function show() { hold(); offer(); }

  creature.addEventListener("pointerenter", show);
  creature.addEventListener("focus", show);
  creature.addEventListener("pointerdown", function (event) {
    event.stopPropagation();
  });

  creature.addEventListener("pointerleave", function () {
    if (carrying) { return; }
    window.setTimeout(function () {
      if (!carrying && !graze.matches(":hover")) { hideGraze(); resume(); }
    }, 220);
  });

  creature.addEventListener("blur", function () {
    if (!carrying && !graze.contains(document.activeElement)) {
      hideGraze();
      resume();
    }
  });

  graze.addEventListener("pointerleave", function () {
    if (carrying) { return; }
    window.setTimeout(function () {
      if (!carrying && !creature.matches(":hover") && !graze.matches(":hover")) {
        hideGraze();
        resume();
      }
    }, 220);
  });

  /* ---- turning it by hand ------------------------------------------------ */

  var turning = null;

  stage.addEventListener("pointerdown", function (event) {
    turning = { id: event.pointerId, x: event.clientX, spin: spin, moved: 0 };
    stage.dataset.turning = "true";
    try { stage.setPointerCapture(event.pointerId); } catch (e) {}
  });

  stage.addEventListener("pointermove", function (event) {
    if (!turning || event.pointerId !== turning.id) { return; }
    var dx = event.clientX - turning.x;
    turning.moved = Math.max(turning.moved, Math.abs(dx));
    // A drag across the whole sphere turns it about half way round.
    wanted = turning.spin - (dx / Math.max(R, 1)) * Math.PI;
    spin = wanted;
    freeUntil = performance.now() + FREE;
  });

  ["pointerup", "pointercancel"].forEach(function (name) {
    stage.addEventListener(name, function (event) {
      if (!turning || event.pointerId !== turning.id) { return; }
      turning = null;
      delete stage.dataset.turning;
    });
  });

  /* ---- what a word is standing on: the artist's works -------------------- */

  function openSeam(index) {
    var ground = vocabulary[index];
    if (!ground) { return; }

    seamWord.textContent = ground.word;
    seamCount.textContent = ground.works.length +
      (ground.works.length === 1 ? " work" : " works");

    seamList.textContent = "";
    ground.works.forEach(function (work) {
      var item = document.createElement("li");
      item.className = "seam-item";

      var link = document.createElement("a");
      link.href = "index.html#" + work.slug;

      var plate = document.createElement("img");
      plate.className = "seam-plate";
      plate.loading = "lazy";
      plate.src = "../images/" + work.slug + ".jpg";
      plate.alt = work.alt + ".";

      var title = document.createElement("h3");
      title.textContent = work.title;

      var year = document.createElement("p");
      year.textContent = work.year;

      var detail = document.createElement("p");
      detail.textContent = workLine(work);

      link.appendChild(plate);
      link.appendChild(title);
      link.appendChild(year);
      link.appendChild(detail);
      item.appendChild(link);
      seamList.appendChild(item);
    });

    seam.hidden = false;
    seamClose.focus();
  }

  seamClose.addEventListener("click", function () { seam.hidden = true; });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !seam.hidden) { seam.hidden = true; }
  });

  /* ---- growing it -------------------------------------------------------- */

  function grow() {
    var fragment = document.createDocumentFragment();

    vocabulary.forEach(function (ground, index) {
      var n = ground.works.length;

      var el = document.createElement("button");
      el.type = "button";
      el.className = "plot";
      el.textContent = ground.word;
      el.setAttribute("aria-label",
        ground.word + " — " + n + (n === 1 ? " work" : " works"));

      el.addEventListener("click", function () { openSeam(index); });
      el.addEventListener("pointerdown", function (event) {
        event.stopPropagation();      // clicking a word is not a turn
      });
      // Tabbing to a word turns the world until it is facing you.
      el.addEventListener("focus", function () {
        wanted = ground.lon;
        freeUntil = performance.now() + FREE;
      });

      ground.el = el;
      fragment.appendChild(el);
    });

    land.insertBefore(fragment, creature);
  }

  /* ---- starting ---------------------------------------------------------- */

  var settle = null;
  window.addEventListener("resize", function () {
    window.clearTimeout(settle);
    settle = window.setTimeout(geometry, 140);
  });

  function read(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) {
        throw new Error(url + ": " + response.status + " " + response.statusText);
      }
      return response.json();
    });
  }

  Promise.all([read("../works.json"), read("land.json")])
    .then(function (both) {
      mine = both[0];
      supply = both[1];

      vocabulary = readVocabulary();
      if (!vocabulary.length) { throw new Error("the works carry no terms"); }

      survey();
      grow();
      loading.remove();
      vocabulary.forEach(function (ground) { roll(ground); });
      geometry();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(geometry);
      }

      creature.hidden = false;
      var start = Math.floor(Math.random() * vocabulary.length);
      standOn(start);
      beast.lat = goal.lat;
      beast.lon = goal.lon;
      spin = wanted = beast.lon;
      creature.dataset.grazing = "true";

      requestAnimationFrame(frame);
      walkTimer = window.setTimeout(walk, GRAZE_MIN);
    })
    .catch(function (error) {
      loading.textContent = "The world could not be read (" + error.message + ").";
    });
})();
