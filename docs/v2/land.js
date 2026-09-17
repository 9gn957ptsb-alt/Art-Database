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
  var trace = document.getElementById("trace");
  var traceTitle = document.getElementById("trace-title");
  var traceMeta = document.getElementById("trace-meta");
  var traceHint = document.getElementById("trace-hint");
  var seam = document.getElementById("seam");
  var seamWord = document.getElementById("seam-word");
  var seamCount = document.getElementById("seam-count");
  var seamList = document.getElementById("seam-list");
  var seamClose = document.getElementById("seam-close");

  // The sky is pale, not black: a cool white overhead easing to the faintest
  // warmth near the horizon, with the sphere set into it rather than against
  // it. The old dark ground made every colour on the globe shout.
  var SKY = ["#e9eaee", "#eff0f1", "#f2ece7", "#efe6e4", "#e6e5ec"];
  var INK = "#1b1d24";

  // The sphere is washed on rather than painted over: its blues and greens
  // are held at this much, so the gradient behind comes through them.
  var GLOBE_ALPHA = 0.68;

  // One family, and the range of weights it comes in. What distinguishes one
  // word from another is how many collages carry it — that sets the size, the
  // weight and the tracking together, so the type is calibrated to the data
  // instead of being dealt at random.
  var FACE = '"Space Grotesk", "Archivo", Helvetica, Arial, sans-serif';
  var WEIGHTS = [300, 400, 500, 600, 700];

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));  // the angle that spaces a spiral

  var TILT = 27 * RAD;       // the north pole leans toward the viewer
  var COS_T = Math.cos(TILT);
  var SIN_T = Math.sin(TILT);

  // The sphere's middle sits well below the floor of the room, so the only
  // surface anyone can see is its crown. The words live there.
  // Not right up to the pole: there every longitude is the same place, so
  // words sent there cannot be separated sideways at all.
  var LAT_TOP = 76 * RAD;
  // The floor of the band is worked out from the geometry in geometry(), not
  // fixed: it is the lowest latitude still above the bottom of the screen.
  var LAT_LOW = 34 * RAD;

  /* φ. The globe already sits by it — its contour meets the sides of the
     screen at 1/φ up. From here it also sets the type scale, the timings, the
     easing and the fades, so the proportions of the place agree with each
     other instead of each being picked by hand. */
  var PHI = (1 + Math.sqrt(5)) / 2;   // 1.618…
  var INV = 1 / PHI;                  // 0.618…
  var INV2 = INV * INV;               // 0.382…
  var INV3 = INV2 * INV;              // 0.236…
  var INV5 = INV2 * INV3;             // 0.0902…

  // The land on the sphere, after the pixelled reference the artist gave:
  // hot pink, lime, orange, cream, cornflower and lavender.
  // Barely there. The globe used to carry six saturated hues and shout over
  // everything standing on it; it is ground now, and the colour belongs to the
  // creature and to whatever gets thrown at it.
  var LANDS = [
    "150, 160, 184",
    "168, 172, 186",
    "158, 168, 178",
    "176, 174, 180"
  ];

  var GRAZE_MIN = 2600;                        // how long it stays with a word
  var GRAZE_MAX = Math.round(2600 * PHI);      // …and at most, a golden step on

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var supply = null;    // land.json — the tokens
  var mine = null;      // works.json — the artist's works
  var vocabulary = [];  // [{ word, works, lat, lon, mass, el }]
  var masses = [];      // one landmass per work

  var motes = [];       // everything the creature has thrown off, still in the air
  var MOTES = 150;      // as much as the air will hold at once
  var beat = 0;         // when the last frame was, so motes age in seconds
  var erupted = 0;      // when the ground last went up on its own

  var parts = [];       // the creature's twenty parts, each holding a colour
  var spawns = [];      // what has grown off it and now stands on the world
  var stamp = 0;        // which throw painted a part, so the oldest go first
  var PER_THROW = 3;    // parts repainted by one artwork — its three colours

  var here = 0;         // which word the creature is standing on
  var offering = null;  // the token currently turned up
  var recent = [];      // what it has turned up lately, so it stops repeating
  var RECALL = 14;      // how far back that memory goes
  var walkTimer = null;

  var spin = 0;         // the world's rotation
  var wanted = 0;       // where it is easing to
  var beast = { lat: 0, lon: 0 };
  var goal = { lat: 0, lon: 0 };

  var W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
  var fit = 1;          // how much every word comes down by so they all fit

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

  /* A spiral gives the words an even, unclustered start; relax() then pushes
     apart whichever of them still overlap once their real sizes are known. */
  function survey() {
    var n = vocabulary.length;
    var counts = vocabulary.map(function (v) { return v.works.length; });
    var high = Math.max.apply(null, counts);
    var low = Math.min.apply(null, counts);
    var span = high - low || 1;
    var sinTop = Math.sin(LAT_TOP);
    var sinLow = Math.sin(LAT_LOW);

    vocabulary.forEach(function (ground, i) {
      var f = (i + 0.5) / n;
      ground.lat = Math.asin(sinTop - f * (sinTop - sinLow));
      ground.lon = (i * GOLDEN) % TAU;
      ground.mass = (ground.works.length - low) / span;
    });

  }

  /* Bring every longitude back into one turn. */
  function wrap(a) {
    while (a > Math.PI) { a -= TAU; }
    while (a < -Math.PI) { a += TAU; }
    return a;
  }

  /* How much room a word wants, as angles: half its width and half its height
     on the sphere. Words are wide and short, which is the whole difficulty —
     treating each as a circle big enough to contain it, as the first attempt
     did, reserves several times the space it needs and leaves the crowd
     unfixable however hard they are pushed apart. */
  function room(ground) {
    var w = ground.el ? ground.el.offsetWidth : 60;
    var h = ground.el ? ground.el.offsetHeight : 20;
    return {
      x: (w / 2) / Math.max(R, 1) + 0.030,
      y: (h / 2) / Math.max(R, 1) + 0.026
    };
  }

  /* If the words genuinely cannot fit the band, bring them all down together
     until they can, rather than letting relax() fight an impossible crowd.
     Relative sizes are untouched, which is the part that carries meaning, and
     it re-reckons itself if the artist adds more objects later. */
  function fitToBand() {
    var band = TAU * (Math.sin(LAT_TOP) - Math.sin(LAT_LOW));
    var used = vocabulary.reduce(function (sum, ground) {
      var box = room(ground);
      return sum + 4 * box.x * box.y;
    }, 0);
    var have = band * 0.72;
    return used <= have ? 1 : Math.sqrt(have / used);
  }

  /* Landmasses follow the words, so they are worked out after the words have
     settled rather than where the spiral first put them. */
  function remass() {
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
        size: 0.11 + 0.016 * own.length,
        tone: LANDS[i % LANDS.length]
      };
    });

    // Islands on the lower flanks. No word stands on them — they are there
    // because a world is not all one continent.
    for (var k = 0; k < 6; k += 1) {
      masses.push({
        lat: (24 + k * 3.5) * RAD,
        lon: (k * 2.4 + 0.7) % TAU,
        size: 0.055 + (k % 3) * 0.022,
        tone: LANDS[(k + 3) % LANDS.length]
      });
    }
  }

  /* Forty words, some of them very large, do not fit a spiral without running
     into each other — the first pass had 'polaroid', 'photograph' and 'tape'
     printed on top of one another. So they are pushed apart on the sphere
     itself: each word is treated as a disc the size it actually measures on
     screen, and any two that overlap slide away from each other along the
     surface until they do not. Latitude is held inside the visible band, so
     nothing is shoved over the horizon to make room. */
  /* Push apart whichever words are printed on top of each other, on the
     sphere itself, along whichever axis they overlap least — sideways if they
     are shoulder to shoulder, up or down if they are stacked. Latitude is
     held inside the visible band, so nothing is shoved over the horizon to
     make room, and longitudes are squeezed by cos(lat) because near the pole
     two very different longitudes are the same place on screen. */
  function relax() {
    var box = vocabulary.map(room);

    for (var pass = 0; pass < 220; pass += 1) {
      var shifted = false;

      for (var i = 0; i < vocabulary.length; i += 1) {
        for (var j = i + 1; j < vocabulary.length; j += 1) {
          var a = vocabulary[i];
          var b = vocabulary[j];
          var squeeze = Math.max(0.08, Math.cos((a.lat + b.lat) / 2));

          var byLon = wrap(a.lon - b.lon) * squeeze;
          var byLat = a.lat - b.lat;
          var wantX = box[i].x + box[j].x;
          var wantY = box[i].y + box[j].y;
          var intoX = wantX - Math.abs(byLon);
          var intoY = wantY - Math.abs(byLat);
          if (intoX <= 0 || intoY <= 0) { continue; }

          shifted = true;
          if (intoX / wantX < intoY / wantY) {
            var sideways = (byLon >= 0 ? 1 : -1) * intoX * 0.25 / squeeze;
            a.lon += sideways;
            b.lon -= sideways;
          } else {
            var updown = (byLat >= 0 ? 1 : -1) * intoY * 0.25;
            a.lat += updown;
            b.lat -= updown;
          }
        }
      }

      vocabulary.forEach(function (ground) {
        ground.lat = Math.max(LAT_LOW, Math.min(LAT_TOP, ground.lat));
        ground.lon = wrap(ground.lon);
      });

      if (!shifted) { break; }
    }
  }

  /* ---- the projection ---------------------------------------------------- */

  /* Spin about the axis, then lean the pole toward the viewer. Returns screen
     coordinates and the depth: 1 dead in front, 0 at the limb, negative
     round the back. */
  function project(lat, lon) {
    var a = lon - spin;
    var cosLat = Math.cos(lat);
    var sinA = Math.sin(a);
    var cosA = Math.cos(a);
    var x = cosLat * sinA;
    var y = Math.sin(lat);
    var z = cosLat * cosA;

    var y2 = y * COS_T - z * SIN_T;
    var z2 = y * SIN_T + z * COS_T;

    // Which way the surface runs at this point, once projected — the
    // direction a word lying on it would read along, and how far the surface
    // is turned away from the viewer there. Dead ahead it is unturned and
    // `squash` is 1; at the horizon the surface is edge-on and a word on it
    // is compressed to the sine of the tilt, about 45 per cent.
    var tx = cosA;
    var ty = -sinA * SIN_T;

    // Past a quarter turn the surface runs away from the viewer, and a word
    // painted along it would be seen from behind — mirrored and upside down.
    // Since the leaning is the point and the mirroring is unreadable, the
    // direction is turned back so every word still reads left to right.
    if (tx < 0) { tx = -tx; ty = -ty; }

    var squash = Math.sqrt(tx * tx + ty * ty) || 1;

    return {
      x: cx + x * R,
      y: cy - y2 * R,
      z: z2,
      lie: Math.atan2(ty, tx) / RAD,
      squash: squash
    };
  }

  function geometry() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = stage.clientWidth;
    H = stage.clientHeight;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // A wider sphere, set so its contour meets the left and right edges of
    // the screen at the golden section — 1/φ of the way up, 0.618 — which is
    // what gives the words their room: the visible surface goes up by about
    // half again even though the band of latitudes on it is shallower.
    R = Math.max(W * 0.90, H * 0.70, 240);
    cx = W / 2;
    var flank = Math.sqrt(Math.max(1, R * R - cx * cx));
    cy = H * (1 - 1 / PHI) + flank;

    // Everything below this latitude is under the bottom of the screen. The
    // projection makes it exact: a point is at height (cy - y) / R when
    // sin(lat - tilt) equals it, so the lowest latitude worth placing a word
    // on is the tilt plus that arcsine, with a little margin.
    var sunk = Math.max(-1, Math.min(1, (cy - H) / R));
    LAT_LOW = Math.min(LAT_TOP - 8 * RAD, TILT + Math.asin(sunk) + 2 * RAD);

    // Type scales with the world, so a phone gets a legible globe. Which
    // face and how big relative to the rest is the word's own business.
    fit = 1;
    dressAll();          // at full size, to find out how much room they want
    fit = fitToBand();   // then all of them down by however much it takes
    dressAll();
    relax();
    remass();

  }

  /* ---- how a word is dressed --------------------------------------------- */

  /* Every word wears a face of its own, given once and kept. Its size is not
     a matter of taste: it is how many of the collages that object turns up in,
     so the world reads as what the works are made of most. */
  function dress(ground) {
    if (!ground.el) { return; }
    // How many collages carry the object decides how big its word is. The
    // curve is flattened a little so the one-off things — the joker, the
    // pull tab — are still legible rather than specks.
    // Measured against the screen, not against the sphere. Tied to R, widening
    // the globe simply scaled the words up with it and bought no room at all —
    // they went to 123px and the collisions trebled. Against the screen, a
    // wider globe is exactly what it should be: more surface, same type.
    // The scale is φ³ end to end: the word carried by all seven collages is
    // φ cubed — 4.236 times — the size of one carried by a single collage,
    // and every step between is a power of φ.
    var smallest = Math.min(W, H) / 53;
    var size = smallest * Math.pow(PHI, ground.mass * 3) * fit;
    var set = Math.round(ground.mass * (WEIGHTS.length - 1));

    ground.el.style.fontFamily = FACE;
    ground.el.style.fontWeight = String(WEIGHTS[set]);
    ground.el.style.fontSize = Math.max(13, size).toFixed(2) + "px";
    // Large type wants tighter tracking than small type. Letting one value
    // serve both is what makes a word cloud look untended.
    // Tracking tightens over the same run, from -1/φ⁹ to -1/φ⁵ of an em.
    ground.el.style.letterSpacing =
      (-Math.pow(INV, 9) - ground.mass * INV5).toFixed(4) + "em";
  }

  function dressAll() { vocabulary.forEach(dress); }

  /* ---- what it throws off -------------------------------------------------

     The creature is the thing that changes, so it is never still: it kicks
     the ground up as it walks, and every palette that goes on it comes back
     out as a burst of that work's own colours. Both grow with how much it is
     carrying — the fifth application throws far more than the first, and it
     keeps climbing, so the longer anyone stays the more the world is in the
     air. Past a few works the ground starts going up by itself.

     Each mote drifts across the screen and bounces on its own height above
     the surface, which is cheap and reads as dirt rather than as confetti
     hanging in space. */

  /* How far along it is. Grows without limit; nothing here ever finishes. */
  function degree() { return stamp; }

  /* Everything the creature is currently wearing, which is what it throws.
     Worked out when it changes, not when it is asked: it was being rebuilt
     out of the DOM on every footfall, which is most frames, and got dearer
     with every part that took a colour. */
  var worn = ["#ec4e98", "#b0d654", "#f8f0d6"];

  function repalette() {
    var out = [];
    parts.forEach(function (part) {
      if (part.token && part.el.style.fill) { out.push(part.el.style.fill); }
    });
    if (out.length) { worn = out; }
  }

  /* Colours picked up off the world — every coin the company leaves that
     someone collects — ride along with whatever the animal is wearing. */
  var gathered = [];

  function palette() { return gathered.length ? worn.concat(gathered) : worn; }

  function kick(x, y, colours, count, force, spread) {
    if (still) { return; }
    for (var i = 0; i < count; i += 1) {
      var away = (Math.random() - 0.5) * spread;
      motes.push({
        x: x,
        y: y,
        vx: Math.sin(away) * force * (0.5 + Math.random()),
        vy: (Math.random() - 0.7) * force * 0.5,
        h: 0,
        vh: force * (0.5 + Math.random() * 0.9),
        size: 2 + Math.random() * 2.5,
        tone: colours[Math.floor(Math.random() * colours.length)],
        life: 1
      });
    }
    if (motes.length > MOTES) { motes.splice(0, motes.length - MOTES); }
  }

  /* Motes age in seconds, not in frames. Counting frames looked the same
     until the air got busy: a slower frame made every mote live longer in
     real time, which left more of them in the air, which slowed the next
     frame further. Four throws in, it had fallen from 34 frames a second
     to two and was not coming back. */
  function stir(now) {
    var dt = Math.min(0.05, (now - beat) / 1000 || 0.016);
    beat = now;
    var pace = dt * 60;      // how many sixtieths of a second this frame took

    for (var i = motes.length - 1; i >= 0; i -= 1) {
      var m = motes[i];

      m.x += m.vx * pace;
      m.y += m.vy * pace;
      m.vx *= Math.pow(0.992, pace);
      m.vy *= Math.pow(0.992, pace);

      m.vh -= 0.68 * pace;    // falls back toward the surface it came off
      m.h += m.vh * pace;
      if (m.h <= 0) {         // and skips along it
        m.h = 0;
        m.vh *= -INV3;      // each skip a golden third of the last
        m.vx *= 0.72;
        m.vy *= 0.72;
        m.life -= 0.12;
        if (Math.abs(m.vh) < 0.6) { m.life -= 0.3; }
      }

      m.life -= INV * dt;
      if (m.life <= 0 || m.y - m.h > H + 120 || m.x < -120 || m.x > W + 120) {
        motes.splice(i, 1);
      }
    }
  }

  /* Drawn in runs of one colour and one opacity. Setting fillStyle from a
     colour string and globalAlpha per mote meant a couple of thousand state
     changes a frame, which was most of the cost of having any air at all. */
  function drawMotes() {
    if (!motes.length) { return; }

    var runs = {};
    motes.forEach(function (m) {
      var step = Math.max(1, Math.min(4, Math.ceil(m.life * 4)));
      var key = m.tone + "|" + step;
      (runs[key] || (runs[key] = [])).push(m);
    });

    Object.keys(runs).forEach(function (key) {
      var cut = key.lastIndexOf("|");
      ctx.fillStyle = key.slice(0, cut);
      ctx.globalAlpha = Number(key.slice(cut + 1)) / 4;
      runs[key].forEach(function (m) {
        ctx.fillRect(Math.round(m.x), Math.round(m.y - m.h), m.size, m.size);
      });
    });

    ctx.globalAlpha = 1;
  }

  /* The ground going up on its own, once it is carrying enough to matter. */
  function erupt(now) {
    var d = degree();
    if (still || d < 3 || now - erupted < Math.max(1400, 9000 - d * 700)) { return; }
    erupted = now;

    var ground = vocabulary[Math.floor(Math.random() * vocabulary.length)];
    if (!ground) { return; }
    var at = project(ground.lat, ground.lon);
    if (at.z <= 0.2) { return; }

    kick(at.x, at.y, palette(), Math.min(40, 10 + d * 3), 5 + d * 0.4, 1.1);
  }

  /* ---- painting the world ------------------------------------------------

     The sphere is six full-area gradients and one more for every landmass,
     and its diameter is wider than the window — a little over twenty million
     pixels of gradient. It used to be laid down again on every single frame,
     which is what set the ceiling on everything else the page wanted to do:
     wide open, nothing on it, it could not hold sixty frames a second.

     Nothing about it changes from frame to frame except where the light is,
     and the light follows the creature, which walks slowly. So it is drawn
     once onto a surface of its own and copied from there, and only drawn
     again when the light has actually moved, the world has been turned, or
     the window has changed shape. What is left per frame is one copy and a
     few hundred specks of dirt. */

  var sphere = document.createElement("canvas");
  var sctx = sphere.getContext("2d");
  var drawn = { x: -999, y: -999, w: 0, h: 0, r: 0, masses: -1 };

  function sphereStale(lit) {
    return Math.abs(lit.x - drawn.x) > 2 || Math.abs(lit.y - drawn.y) > 2 ||
           drawn.w !== W || drawn.h !== H || drawn.r !== R ||
           drawn.masses !== masses.length;
  }

  function drawSphere(lit) {
    if (sphere.width !== canvas.width || sphere.height !== canvas.height) {
      sphere.width = canvas.width;
      sphere.height = canvas.height;
    }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    paintSphere(sctx, lit);
    drawn.x = lit.x;
    drawn.y = lit.y;
    drawn.w = W;
    drawn.h = H;
    drawn.r = R;
    drawn.masses = masses.length;
  }

  function paint(now) {
    erupt(now);

    // What the creature stands on is the brightest part of the sphere.
    var lit = project(beast.lat, beast.lon);
    if (sphereStale(lit)) { drawSphere(lit); }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(sphere, 0, 0, W, H);

    stir(now);
    drawMotes();

    // No line where the sphere ends. It used to be drawn in, and a drawn edge
    // is the one thing that stops a horizon being a horizon: the sphere simply
    // ceases now, a shade off the sky it sits in.
  }

  /* Everything that makes the sphere, onto whichever surface is handed in. */
  function paintSphere(ctx, lit) {

    // The room is nothing but the falling-off of the off-white. Its inner
    // radius is R, so the gradient starts exactly on the sphere's contour.
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, SKY[0]);
    sky.addColorStop(INV3, SKY[1]);          // 0.236
    sky.addColorStop(INV2, SKY[2]);          // 0.382
    sky.addColorStop(INV, SKY[3]);           // 0.618
    sky.addColorStop(1, SKY[4]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // The sphere casts into the sky rather than glowing out of it: a soft
    // shadow just beyond the contour, which is what seats it.
    var seatShadow = ctx.createRadialGradient(cx, cy, R * 0.99, cx, cy, R * 1.06);
    seatShadow.addColorStop(0, "rgba(58, 64, 88, 0.045)");
    seatShadow.addColorStop(1, "rgba(58, 64, 88, 0)");
    ctx.fillStyle = seatShadow;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    ctx.globalAlpha = GLOBE_ALPHA;

    var base = ctx.createRadialGradient(
      lit.x, lit.y, R * 0.04, cx, cy, R * 1.2);
    base.addColorStop(0, "#eef0f3");
    base.addColorStop(0.24, "#e4e7ed");
    base.addColorStop(0.60, "#d8dce6");
    base.addColorStop(1, "#c6ccda");
    ctx.fillStyle = base;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    masses.forEach(function (mass) {
      var p = project(mass.lat, mass.lon);
      if (p.z <= 0.02) { return; }

      var fade = Math.min(1, p.z * 1.5) * 0.62;
      var rx = mass.size * R * (0.34 + 0.66 * p.z);
      var ry = mass.size * R * (0.62 + 0.38 * p.z);

      var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(rx, ry));
      g.addColorStop(0, "rgba(" + mass.tone + ", " + (0.92 * fade).toFixed(3) + ")");
      g.addColorStop(0.66, "rgba(" + mass.tone + ", " + (0.80 * fade).toFixed(3) + ")");
      g.addColorStop(0.88, "rgba(" + mass.tone + ", " + (0.30 * fade).toFixed(3) + ")");
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
    drift.addColorStop(0, "rgba(255, 255, 255, 0.28)");
    drift.addColorStop(0.6, "rgba(255, 255, 255, 0.07)");
    drift.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = drift;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    // Limb darkening: the edge of a sphere turns away from every light.
    var limb = ctx.createRadialGradient(cx, cy, R * 0.52, cx, cy, R);
    limb.addColorStop(0, "rgba(58, 64, 88, 0)");
    limb.addColorStop(0.74, "rgba(58, 64, 88, 0.035)");
    limb.addColorStop(1, "rgba(58, 64, 88, 0.09)");
    ctx.fillStyle = limb;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    ctx.restore();   // drops the clip and the globe's alpha together
  }

  /* ---- the blind side -----------------------------------------------------

     A sphere is an endless platform if you use the half of it nobody can see.
     A word that has gone round the back is taken up and put down again
     somewhere new on that far side, clear of whatever else is there, and comes
     round in a place it has never been. Keep turning and the land is never
     twice the same.

     This is how it squares with nothing moving: every replanting happens on
     the blind side, out of sight, and a word that can be seen is never
     touched. The regeneration is real and it is also invisible. */

  function blindSide() { return wrap(spin + Math.PI); }

  /* Is this somewhere nobody can see, with room to spare?

     Blindness here is not "round the back". With the pole leaning toward the
     viewer and the words in a band from about 53 to 76 degrees, no word ever
     gets properly behind the sphere — the deepest any of them reaches is
     -0.18, so an earlier version of this that waited for -0.6 never replanted
     anything at all. The blind side that actually exists is off the sides of
     the screen: the globe is far wider than the room it is shown in, so a
     great deal of its surface is out past the left and right edges at any
     moment. That is where the regeneration happens. */
  function outOfSight(lat, lon, margin) {
    var p = project(lat, lon);
    if (p.z <= -0.06) { return true; }              // as far back as it goes
    return p.x < -margin || p.x > W + margin;       // or well off the side
  }

  /* Far enough out that a turn cannot swing it into view before it is ready. */
  function blindMargin() { return Math.max(240, W * 0.34); }

  function replant(ground) {
    var wasLat = ground.lat;
    var wasLon = ground.lon;

    var away = blindSide();
    ground.lat = LAT_LOW + Math.random() * (LAT_TOP - LAT_LOW);
    ground.lon = wrap(away + (Math.random() - 0.5) * Math.PI * 0.8);

    // Put it down clear of its new neighbours rather than on top of them —
    // the same box separation the whole land was laid out with, for one word.
    var mine = room(ground);
    for (var pass = 0; pass < 50; pass += 1) {
      var clear = true;
      for (var i = 0; i < vocabulary.length; i += 1) {
        var other = vocabulary[i];
        if (other === ground) { continue; }
        var box = room(other);
        var squeeze = Math.max(0.18, Math.cos((ground.lat + other.lat) / 2));
        var byLon = wrap(ground.lon - other.lon) * squeeze;
        var byLat = ground.lat - other.lat;
        var wantX = mine.x + box.x;
        var wantY = mine.y + box.y;
        var intoX = wantX - Math.abs(byLon);
        var intoY = wantY - Math.abs(byLat);
        if (intoX <= 0 || intoY <= 0) { continue; }

        clear = false;
        if (intoX / wantX < intoY / wantY) {
          ground.lon = wrap(ground.lon + (byLon >= 0 ? 1 : -1) * intoX / squeeze);
        } else {
          ground.lat = Math.max(LAT_LOW, Math.min(LAT_TOP,
            ground.lat + (byLat >= 0 ? 1 : -1) * intoY));
        }
      }
      if (clear) { break; }
    }

    // If clearing its neighbours pushed it somewhere it could be seen, leave
    // it where it was and try again next time it goes round. A word appearing
    // out of nothing in front of someone is the one thing this must not do.
    if (!outOfSight(ground.lat, ground.lon, blindMargin())) {
      ground.lat = wasLat;
      ground.lon = wasLon;
      return false;
    }
    return true;
  }

  /* ---- standing things on it --------------------------------------------- */

  function placeWords() {
    vocabulary.forEach(function (ground) {
      var el = ground.el;
      var p = project(ground.lat, ground.lon);

      // Turned away, or cut in half by the edge of the room. Words used to be
      // dropped well before the horizon, because at full width they piled into
      // each other there; now they lie down on the surface instead, so they
      // can be carried all the way round.
      if (p.z <= 0.05 || p.x < 14 || p.x > W - 14) {
        el.style.visibility = "hidden";
        el.dataset.behind = "true";

        // Well round the back, and it has had its turn in front: put it down
        // somewhere new while nobody can see it happen.
        if (ground.shown && outOfSight(ground.lat, ground.lon, blindMargin())) {
          if (replant(ground)) { ground.shown = false; }
        }
        return;
      }

      if (p.z > 0.2) { ground.shown = true; }

      var fade = INV2 + INV * Math.min(1, (p.z - 0.05) / 0.32);
      var scale = 0.64 + 0.36 * p.z;

      el.style.visibility = "visible";
      delete el.dataset.behind;
      el.style.opacity = fade.toFixed(3);
      el.style.zIndex = String(20 + Math.round(p.z * 30));
      // Lie the word down on the sphere: turn it to follow the surface, then
      // compress it along its own reading direction by however much the
      // surface is foreshortened there. A word near the horizon is narrow and
      // leaning, the way it would be if it were painted on.
      el.style.transform =
        "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)" +
        " translate(-50%,-50%)" +
        " rotate(" + p.lie.toFixed(2) + "deg)" +
        " scale(" + (scale * p.squash).toFixed(3) + "," + scale.toFixed(3) + ")";
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
  var trod = { x: 0, y: 0, since: 0 };   // how far it has walked since it last kicked

  function frame(now) {
    // The world only turns when it is turned: by a drag, or by tabbing to a
    // word. It used to swing round to follow the creature, which meant every
    // word on it was always drifting.
    spin += shortest(spin, wanted) * (still ? 1 : INV5);

    // The creature crosses the surface toward the word it is heading for.
    var ease = still ? 1 : INV5;
    beast.lat += (goal.lat - beast.lat) * ease;
    beast.lon += shortest(beast.lon, goal.lon) * ease;

    var moved = beast.lon - last.x;
    if (Math.abs(moved) > 0.0015) {
      creature.dataset.facing = moved > 0 ? "right" : "left";
      last.x = beast.lon;
    }

    paint(now);
    placeWords();
    stepCompany(now);
    placeSpawns();
    var p = placeCreature();
    if (!graze.hidden) { positionGraze(p); }

    // Nothing it does is weightless: walking turns the ground over behind it,
    // and grazing keeps turning it over where it stands. Both get heavier the
    // more it is carrying.
    var gone = Math.sqrt((p.x - trod.x) * (p.x - trod.x) + (p.y - trod.y) * (p.y - trod.y));
    var heft = 1 + Math.min(degree(), 16) * 0.55;
    if (gone > 26) {
      kick(p.x, p.y + creature.offsetHeight * 0.06, palette(),
           Math.round(1 + heft), 1.6 + heft * 0.25, 1.5);
      trod.x = p.x;
      trod.y = p.y;
    } else if (creature.dataset.grazing && now - trod.since > 620) {
      trod.since = now;
      kick(p.x, p.y, palette(), Math.round(heft), 1.1 + heft * 0.14, 2.4);
    }

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

  /* Somewhere on the surface that is not a word: a tower it is being sent
     to, most often. */
  function standAt(lat, lon) {
    vocabulary.forEach(function (g) { delete g.el.dataset.grazed; });
    here = -1;
    goal.lat = lat;
    goal.lon = lon;
  }

  /* Which words are on the near face right now. */
  function facing() {
    var out = [];
    vocabulary.forEach(function (ground, i) {
      var p = project(ground.lat, ground.lon);
      if (p.z > 0.18 && p.x > 60 && p.x < W - 60) { out.push(i); }
    });
    return out;
  }

  function walk() {
    delete creature.dataset.grazing;

    // Since the world no longer swings round to follow it, it grazes only
    // where it can still be seen; otherwise it would wander round the back.
    var open = facing().filter(function (i) { return i !== here; });
    var next = open.length
      ? open[Math.floor(Math.random() * open.length)]
      : here;
    standOn(next);

    walkTimer = window.setTimeout(function () {
      creature.dataset.grazing = "true";
      offering = null;          // new ground, something new to turn up
      pressedOnce = false;
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

    // A word's own shelf can be as short as a couple of works, so without a
    // memory the creature turns up the same one over and over — which is what
    // kept it wearing a single artwork. Try the word's shelf first, fall back
    // to the whole supply, and only then allow a repeat.
    var tok = fresh(keys) || fresh(supply.pool) ||
      supply.tokens[keys[Math.floor(Math.random() * keys.length)]];
    if (!tok) { return null; }

    recent.push(tok.s);
    if (recent.length > RECALL) { recent.shift(); }
    return tok;
  }

  function fresh(keys) {
    if (!keys || !keys.length) { return null; }
    var order = keys.slice();
    for (var i = order.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = order[i]; order[i] = order[j]; order[j] = swap;
    }
    for (var k = 0; k < order.length; k += 1) {
      var tok = supply.tokens[order[k]];
      if (tok && recent.indexOf(tok.s) === -1) { return tok; }
    }
    return null;
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
    grazeHint.textContent = "Press twice to take its palette";
    delete graze.dataset.condensing;

    graze.hidden = false;
    positionGraze(project(beast.lat, beast.lon));
  }

  function hideGraze() {
    graze.hidden = true;
    delete graze.dataset.condensing;
  }

  /* ---- condensing and throwing ------------------------------------------- */

  var carrying = null;   // the palette in hand, once a double press has taken it
  var dragging = null;   // { id, el } while that palette is being moved
  var pressedOnce = false;  // whether the work on show has been pressed yet

  function condense(tok, x, y) {
    carrying = tok;
    token.style.setProperty("--t1", tok.c[0]);
    token.style.setProperty("--t2", tok.c[1]);
    token.style.setProperty("--t3", tok.c[2]);
    token.hidden = false;
    moveToken(x, y);
    graze.dataset.condensing = "true";
    grazeHint.textContent = "Drag it onto the creature";
  }

  function moveToken(x, y) {
    token.style.left = Math.round(x - token.offsetWidth / 2) + "px";
    token.style.top = Math.round(y - token.offsetHeight / 2) + "px";
  }

  /* ---- what the creature is wearing -------------------------------------- */

  /* The creature is twenty parts, not one coat. A throw repaints three of
     them — the three painted longest ago, picked with a little slack so the
     order is never quite the same — and each keeps hold of the artwork that
     gave it its colour. Nothing is ever finished: every throw covers the
     oldest three and pushes the rest further back, so the creature carries
     six or seven works at a time and the walk through them has no end. */
  var SVGNS = "http://www.w3.org/2000/svg";

  /* Each part starts as one block and becomes a group, so its shape can be
     rebuilt rather than merely recoloured. The block it began as is kept as
     its home: everything it grows into is measured from there. */
  function readParts() {
    parts = [].slice.call(creature.querySelectorAll("rect.part")).map(function (rect) {
      var group = document.createElementNS(SVGNS, "g");
      group.setAttribute("class", "part");
      group.setAttribute("data-part", rect.getAttribute("data-part"));
      rect.parentNode.insertBefore(group, rect);
      rect.removeAttribute("class");
      rect.removeAttribute("data-part");
      group.appendChild(rect);

      return {
        el: group,
        name: group.getAttribute("data-part"),
        home: {
          x: +rect.getAttribute("x"), y: +rect.getAttribute("y"),
          w: +rect.getAttribute("width"), h: +rect.getAttribute("height")
        },
        token: null, at: 0, form: 0
      };
    });
  }

  /* A small, repeatable source of randomness, so a given part and a given
     artwork always grow the same shape. */
  function seedFrom(text, salt) {
    var n = salt * 2654435761;
    for (var i = 0; i < text.length; i += 1) { n = (n * 31 + text.charCodeAt(i)) & 0x7fffffff; }
    return function () {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      return n / 0x7fffffff;
    };
  }

  function cell(into, x, y, w, h, tone) {
    var r = document.createElementNS(SVGNS, "rect");
    r.setAttribute("x", x.toFixed(2));
    r.setAttribute("y", y.toFixed(2));
    r.setAttribute("width", w.toFixed(2));
    r.setAttribute("height", h.toFixed(2));
    r.setAttribute("fill", tone);
    into.appendChild(r);
  }

  /* The part does not just take a colour, it takes a shape. Each time an
     artwork lands on it the block is rebuilt at a finer grain, loses a few
     cells so its outline stops being a rectangle, and puts out buds past
     where it used to end. Enough of those and it is no longer a block on an
     animal — it is a small structure of its own, which is the point. */
  function evolveShape(part, tok) {
    var home = part.home;
    var f = part.form;
    var g = part.el;
    var rnd = seedFrom(part.name + tok.s, f + 1);

    while (g.firstChild) { g.removeChild(g.firstChild); }

    // Two grains, and only two. The body is built at the established size and
    // stays there — letting it keep halving turned the animal into a cloud of
    // specks. Everything new arrives at half that, so fresh growth is legible
    // as fresh: fine pixels accreting around coarse mass.
    var coarse = Math.max(4, Math.sqrt((home.w * home.h) / 6));
    var fine = coarse / 2;

    // Whatever grew last time has settled, and is drawn at full size now.
    part.grown = (part.grown || []).concat(part.fresh || []);
    if (part.grown.length > 14) { part.grown = part.grown.slice(-14); }
    part.fresh = [];

    var cols = Math.max(1, Math.round(home.w / coarse));
    var rows = Math.max(1, Math.round(home.h / coarse));
    var cw = home.w / cols;
    var ch = home.h / rows;

    for (var r = 0; r < rows; r += 1) {
      for (var c = 0; c < cols; c += 1) {
        if (f > 1 && rnd() < 0.05 * Math.min(f, 2)) { continue; }   // a gap
        cell(g, home.x + c * cw, home.y + r * ch, cw, ch,
             tok.c[(r + c + f) % tok.c.length]);
      }
    }

    part.grown.forEach(function (bit) {
      cell(g, bit.x, bit.y, coarse, coarse, bit.tone);
    });

    // This round's growth, at the finer grain, put down against an edge.
    var buds = Math.min(3, f);
    for (var i = 0; i < buds; i += 1) {
      var side = Math.floor(rnd() * 4);
      var bx = home.x + (side === 1 ? home.w
                       : side === 3 ? -fine
                       : rnd() * Math.max(0, home.w - fine));
      var by = home.y + (side === 2 ? home.h
                       : side === 0 ? -fine
                       : rnd() * Math.max(0, home.h - fine));
      var tone = tok.c[i % tok.c.length];
      part.fresh.push({ x: bx, y: by, tone: tone });
      cell(g, bx, by, fine, fine, tone);
    }
  }

  /* The three parts painted longest ago, picked with a little slack so the
     order is never quite the same. */
  function stalest(n) {
    var queue = parts.slice().sort(function (a, b) { return a.at - b.at; });
    var pool = queue.slice(0, Math.min(queue.length, n + 5));
    var out = [];
    while (out.length < n && pool.length) {
      out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return out;
  }

  function wearPart(part, hex, tok) {
    part.token = tok;
    part.at = stamp;
    part.form += 1;
    part.el.style.fill = hex;
    evolveShape(part, tok);

    part.el.dataset.from = tok.s;
    part.el.setAttribute("tabindex", "0");
    part.el.setAttribute("role", "link");
    part.el.setAttribute("aria-label",
      part.name.replace("-", " ") + " — " + hex + ", from " + tok.t +
      (tok.a ? " by " + tok.a : "") + ". Opens on Artsy.");

    part.el.dataset.fresh = "true";
    window.setTimeout(function () { delete part.el.dataset.fresh; }, 1120);   /* past the 1097ms flare */
  }

  function wear(tok) {
    stamp += 1;
    stalest(PER_THROW).forEach(function (part, i) {
      wearPart(part, tok.c[i % tok.c.length], tok);
    });
    repalette();

    // Every single application leaves something else standing on the world,
    // and every third leaves two, so the company builds faster than the
    // animal does and there is always something new to press. What arrives
    // is decided in sprout(); see "the company" below.
    sprout(tok);
    if (stamp % 3 === 0) { sprout(tok); }

    creature.dataset.struck = "true";
    window.setTimeout(function () { delete creature.dataset.struck; }, 440);   /* past the 419ms jolt */

    // And it comes straight back out of the ground, in that work's colours
    // and every colour already on it. Each application throws more than the
    // last — the growth is geometric, so the fifth is a spray and the
    // fifteenth takes the screen.
    var at = project(beast.lat, beast.lon);
    var many = Math.min(80, Math.round(12 * Math.pow(1.3, Math.min(stamp, 15))));
    kick(at.x, at.y, tok.c.concat(palette()), many, 6 + Math.min(stamp, 14) * 0.8, 2.2);
  }

  /* ---- the company ---------------------------------------------------------

     The animal is where things come from, not the only thing there is. Every
     palette that lands on it leaves something else standing on the world: a
     small pixel thing built out of that artwork's three colours, never twice
     the same, because the pattern comes from the work's own id.

     What kind of thing it is, the work decides — the same work always wants
     to be the same creature — but the world has to have got far enough along
     for that kind to exist at all, so early on a work that wants to be a
     tower arrives as a hatchling and the rarer kinds turn up later.

     None of them are ornaments; each one is something to do. What they do is
     roughly what the games at the top of the charts are made of, because
     those games are nearly all made of colour and this world is nothing but
     colour — sorting it, matching it, stacking it, collecting it:

       hatchling  press it and it falls in behind the animal, or leaves the
                  line again. A herd builds up behind you.
       coin       press it and it is collected: its colour joins whatever the
                  animal throws off from then on.
       egg        press it three times and it breaks open into something else.
       gem        press it and it turns to its next colour. Three of one
                  colour standing close together burst, and leave a tower.
       tube       press one, then another, and the top band pours across.
                  A tube of a single colour is solved, and hatches.
       tower      press it and the animal walks over. Every palette fed to a
                  tower is another floor, and every floor keeps its work.

     They wander, and two of a kind that meet merge into one bigger one.
     Merged past the third size a thing stops being what it was and becomes
     the next kind along, so nothing in the company has a final form either —
     the same as the animal. A palette can be dropped on any of them instead
     of on the animal, which is how a thing is fed. */

  var KINDS = ["hatchling", "coin", "egg", "gem", "tube", "tower"];

  /* How far along the world has to be before a kind can appear at all. */
  var UNLOCK = { hatchling: 0, coin: 0, egg: 1, gem: 2, tube: 3, tower: 5 };

  var VERB = {
    hatchling: "press to call it along",
    coin: "press to collect it",
    egg: "press to crack it open",
    gem: "press to turn its colour",
    tube: "press it, then another, to pour",
    tower: "press to send the animal over"
  };

  var MAX_COMPANY = 40;      // as many as the world holds at once
  var BANDS = 4;             // how much a tube takes
  var TIERS = 3;             // sizes a thing goes through before it changes kind

  var train = [];            // what is walking behind the animal
  var pouring = null;        // the tube waiting for somewhere to pour
  var mingled = 0;           // when two of a kind were last seen to meet
  var strolled = 0;          // when the company last took a step

  function unit() {
    var read = parseFloat(getComputedStyle(document.body)
      .getPropertyValue("--w-spawn"));
    return read || 40;
  }

  function bandOf(list, i) { return list[i % list.length]; }

  /* Every one of them is drawn the same way: a list of cells on a small grid,
     which is the whole of the aesthetic and costs nothing to rebuild. */
  function pixels(cols, rows, cells) {
    var out = "";
    var shade = "";
    cells.forEach(function (c) {
      var w = c[3] || 1;
      var h = c[4] || 1;
      shade += '<rect x="' + (c[0] + 0.4) + '" y="' + (c[1] + 0.4) +
               '" width="' + w + '" height="' + h + '"/>';
      out += '<rect x="' + c[0] + '" y="' + c[1] +
             '" width="' + w + '" height="' + h +
             '" fill="' + c[2] + '"/>';
    });
    // The shadow is one flat group of offset cells under the figure. It reads
    // the same as a drop-shadow at this size and does not cost a filter.
    return '<svg viewBox="0 0 ' + (cols + 1) + " " + (rows + 1) +
           '" aria-hidden="true" focusable="false">' +
           '<g fill="rgba(24,26,40,0.28)">' + shade + "</g>" + out + "</svg>";
  }

  function stencil(rows, tone) {
    var cells = [];
    rows.forEach(function (row, y) {
      for (var x = 0; x < row.length; x += 1) {
        if (row.charAt(x) !== ".") { cells.push([x, y, tone(x, y, row.charAt(x))]); }
      }
    });
    return cells;
  }

  /* ---- the bestiary ------------------------------------------------------- */

  function drawHatchling(born) {
    var c = born.token.c;
    var n = 5 + Math.min(born.tier, TIERS) * 2;        // 7, 9, 11 across
    var rnd = seedFrom(born.token.s, 11 + born.tier);
    var half = Math.ceil(n / 2);
    var cells = [];
    for (var y = 0; y < n; y += 1) {
      for (var x = 0; x < half; x += 1) {
        var solid = y > n * 0.28 && y < n * 0.78;      // a body that holds together
        if (!solid && rnd() > 0.46) { continue; }
        var tone = bandOf(c, x + y + born.tier);
        cells.push([x, y, tone]);
        if (x !== n - 1 - x) { cells.push([n - 1 - x, y, tone]); }
      }
    }
    var eye = Math.max(1, Math.round(n * 0.3));
    cells.push([1, eye, INK], [n - 2, eye, INK]);
    return { cols: n, rows: n, cells: cells };
  }

  function drawCoin(born) {
    var c = born.token.c;
    var n = 5;
    var face = [
      "..x..",
      ".xox.",
      "xoooX",
      ".xox.",
      "..x.."
    ];
    var cells = stencil(face, function (x, y, ch) {
      return ch === "o" ? bandOf(c, 1) : ch === "X" ? bandOf(c, 2) : bandOf(c, 0);
    });
    return { cols: n, rows: n, cells: cells };
  }

  function drawEgg(born) {
    var c = born.token.c;
    var shell = [
      "..x..",
      ".xxx.",
      "xxxxx",
      "xxxxx",
      "xxxxx",
      "xxxxx",
      ".xxx."
    ];
    var cells = stencil(shell, function (x, y) { return bandOf(c, x + y); });
    // Each press takes a bite out of it, in a zigzag, so it reads as breaking.
    var breaks = [[[1, 3], [3, 4]], [[2, 2], [0, 4]], [[3, 2], [1, 5], [2, 5]]];
    for (var i = 0; i < Math.min(born.crack, breaks.length); i += 1) {
      breaks[i].forEach(function (gap) {
        cells = cells.filter(function (cell) {
          return !(cell[0] === gap[0] && cell[1] === gap[1]);
        });
      });
    }
    return { cols: 5, rows: 7, cells: cells };
  }

  function drawGem(born) {
    var tone = born.tone || born.token.c[0];
    var face = [
      "..x..",
      ".xox.",
      "xoooX",
      ".xXx.",
      "..x.."
    ];
    var cells = stencil(face, function (x, y, ch) {
      return ch === "o" ? lift(tone, 0.28) : ch === "X" ? lift(tone, -0.22) : tone;
    });
    return { cols: 5, rows: 5, cells: cells };
  }

  function drawTube(born) {
    var glass = "#7f8593";                         // dark enough to read as a rim
    var inside = "#f2f3f6";
    var rows = BANDS * 2 + 2;
    var cells = [[1, 0, inside, 3, rows - 1]];     // what it is holding nothing in
    for (var y = 0; y < rows; y += 1) {            // the two walls
      cells.push([0, y, glass], [4, y, glass]);
    }
    cells.push([1, rows - 1, glass, 3, 1]);        // and the bottom
    born.bands.forEach(function (tone, i) {        // filled from the bottom up
      var y = rows - 2 - i * 2;
      cells.push([1, y - 1, tone, 3, 2]);
    });
    return { cols: 5, rows: rows, cells: cells };
  }

  function drawTower(born) {
    var floors = born.stack.length || 1;
    var rows = floors * 2 + 2;
    var cells = [];
    born.stack.forEach(function (floor, i) {
      var y = rows - 3 - i * 2;
      cells.push([0, y, floor.tone, 7, 2]);
      cells.push([2, y, lift(floor.tone, 0.45)], [4, y, lift(floor.tone, 0.45)]);
    });
    if (!born.stack.length) { cells.push([0, rows - 3, born.token.c[0], 7, 2]); }
    cells.push([0, rows - 1, "#9ea3ad", 7, 1]);    // the ground it stands on
    return { cols: 7, rows: rows, cells: cells };
  }

  var DRAW = {
    hatchling: drawHatchling, coin: drawCoin, egg: drawEgg,
    gem: drawGem, tube: drawTube, tower: drawTower
  };

  /* A colour taken up toward white or down toward ink, for a facet or a
     lit window. */
  function lift(hex, by) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) { return hex; }
    var n = parseInt(m[1], 16);
    var out = [16, 8, 0].map(function (shift) {
      var v = (n >> shift) & 255;
      v = by >= 0 ? v + (255 - v) * by : v * (1 + by);
      return Math.max(0, Math.min(255, Math.round(v)));
    });
    return "#" + out.map(function (v) {
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }

  /* ---- putting one on the world ------------------------------------------- */

  function kindFor(tok) {
    var rnd = seedFrom(tok.s, 7);
    var want = Math.floor(rnd() * KINDS.length);
    while (want > 0 && UNLOCK[KINDS[want]] > stamp) { want -= 1; }
    return KINDS[want];
  }

  function label(born) {
    var tok = born.token;
    return "A " + born.kind + " grown off the creature, from " + tok.t +
           (tok.a ? " by " + tok.a : "") + ". " + VERB[born.kind] +
           "; hold it, or press O, to open the work on Artsy.";
  }

  function redraw(born) {
    var made = DRAW[born.kind](born);
    born.el.innerHTML = pixels(made.cols, made.rows, made.cells);
    var u = unit();
    born.el.style.width = (u * (made.cols + 1) / 7).toFixed(1) + "px";
    born.el.style.height = (u * (made.rows + 1) / 7).toFixed(1) + "px";
    born.el.dataset.kind = born.kind;
    born.el.setAttribute("aria-label", label(born));
  }

  function sprout(tok) {
    if (spawns.length >= MAX_COMPANY) { return null; }

    var el = document.createElement("div");
    el.className = "spawn";
    el.tabIndex = 0;
    el.setAttribute("role", "button");

    var born = {
      el: el,
      token: tok,
      kind: kindFor(tok),
      tier: 1,
      crack: 0,
      tone: tok.c[0],
      face: 0,
      bands: [tok.c[0], bandOf(tok.c, 1), bandOf(tok.c, 2)],
      stack: [{ tone: tok.c[0], token: tok }],
      following: false,
      held: false,
      to: null,
      next: 0,
      phase: Math.random() * TAU,     // so they do not all breathe together
      // Beside the animal, not under it: a thing born inside the animal's own
      // outline cannot be pressed until it has wandered clear.
      lat: Math.max(LAT_LOW, Math.min(LAT_TOP, beast.lat + (Math.random() - 0.5) * 0.2)),
      lon: wrap(beast.lon + (Math.random() < 0.5 ? -1 : 1) *
                (0.2 + Math.random() * 0.24))
    };

    redraw(born);
    wireCompany(born);
    spawns.push(born);
    land.insertBefore(el, creature);
    return born;
  }

  function banish(born) {
    var at = spawns.indexOf(born);
    if (at >= 0) { spawns.splice(at, 1); }
    var inLine = train.indexOf(born);
    if (inLine >= 0) { train.splice(inLine, 1); }
    if (pouring === born) { pouring = null; }
    if (born.el.parentNode) { born.el.parentNode.removeChild(born.el); }
  }

  function burstAt(born, tones) {
    var p = project(born.lat, born.lon);
    kick(p.x, p.y, tones || born.token.c, 18, 5, 2.4);
  }

  /* ---- what pressing one does --------------------------------------------- */

  function becomeNext(born) {
    var open = KINDS.filter(function (k) { return UNLOCK[k] <= stamp; });
    var at = open.indexOf(born.kind);
    born.kind = open[(at + 1) % open.length];
    born.tier = 1;
    born.crack = 0;
    born.bands = [born.token.c[0], bandOf(born.token.c, 1)];
    born.stack = [{ tone: born.tone, token: born.token }];
    born.face = 0;
    born.tone = born.token.c[0];
    redraw(born);
    burstAt(born);
  }

  function enlarge(born) {
    born.tier += 1;
    if (born.tier > TIERS) { becomeNext(born); return; }
    redraw(born);
    burstAt(born);
  }

  /* Three gems of one colour standing close together. */
  function matched(born) {
    return spawns.filter(function (other) {
      return other.kind === "gem" && other.tone === born.tone &&
             apart(other, born) < 0.34;
    });
  }

  function apart(a, b) {
    var dlat = a.lat - b.lat;
    var dlon = shortest(a.lon, b.lon) * Math.cos((a.lat + b.lat) / 2);
    return Math.sqrt(dlat * dlat + dlon * dlon);
  }

  function pour(from, into) {
    if (from === into || !from.bands.length) { return; }
    var tone = from.bands[from.bands.length - 1];
    var moved = 0;
    while (from.bands.length && into.bands.length < BANDS &&
           from.bands[from.bands.length - 1] === tone &&
           (!into.bands.length || into.bands[into.bands.length - 1] === tone)) {
      into.bands.push(from.bands.pop());
      moved += 1;
    }
    redraw(from);
    redraw(into);
    if (!moved) { return; }
    burstAt(into, [tone]);

    // A tube of one colour, filled to the top, is solved: it hatches.
    var solved = into.bands.length === BANDS && into.bands.every(function (b) {
      return b === tone;
    });
    if (solved) {
      into.kind = "hatchling";
      into.tier = Math.min(TIERS, into.tier + 1);
      redraw(into);
      burstAt(into, [tone]);
    }
    if (!from.bands.length) { banish(from); }
  }

  function playWith(born) {
    if (born.kind === "hatchling") {
      born.following = !born.following;
      if (born.following) { train.push(born); }
      else { train.splice(train.indexOf(born), 1); }
      born.el.dataset.following = born.following ? "true" : "";
      burstAt(born);
      return;
    }

    if (born.kind === "coin") {
      gathered.push(born.token.c[0]);
      if (gathered.length > 12) { gathered.shift(); }
      burstAt(born, born.token.c);
      banish(born);
      return;
    }

    if (born.kind === "egg") {
      born.crack += 1;
      if (born.crack >= 3) { becomeNext(born); return; }
      redraw(born);
      burstAt(born);
      return;
    }

    if (born.kind === "gem") {
      // Counted, not looked up: a work whose colours repeat would have stuck
      // on the first one for ever, since indexOf always found the same index.
      born.face = (born.face + 1) % born.token.c.length;
      born.tone = born.token.c[born.face];
      redraw(born);
      var three = matched(born);
      if (three.length >= 3) {
        var keep = three[0];
        var stack = three.map(function (g) {
          return { tone: g.tone, token: g.token };
        });
        three.slice(1).forEach(function (g) { burstAt(g, [g.tone]); banish(g); });
        keep.kind = "tower";
        keep.stack = stack;
        redraw(keep);
        burstAt(keep, [born.tone]);
      }
      return;
    }

    if (born.kind === "tube") {
      if (pouring && pouring !== born) {
        delete pouring.el.dataset.picked;
        pour(pouring, born);
        pouring = null;
      } else if (pouring === born) {
        delete born.el.dataset.picked;
        pouring = null;
      } else {
        pouring = born;
        born.el.dataset.picked = "true";
      }
      return;
    }

    if (born.kind === "tower") {
      standAt(born.lat, born.lon);
      resume();
    }
  }

  /* A palette dropped on one of them instead of on the animal. */
  function feed(born, tok) {
    born.token = tok;
    if (born.kind === "tower") {
      born.stack.push({ tone: tok.c[0], token: tok });
      if (born.stack.length > 9) { born.stack.shift(); }
      redraw(born);
      burstAt(born, tok.c);
      return;
    }
    if (born.kind === "tube") {
      if (born.bands.length < BANDS) { born.bands.push(tok.c[0]); }
      redraw(born);
      burstAt(born, tok.c);
      return;
    }
    if (born.kind === "gem") { born.tone = tok.c[0]; }
    if (born.kind === "egg") { born.crack += 1; }
    if (born.kind === "egg" && born.crack >= 3) { becomeNext(born); return; }
    enlarge(born);
  }

  /* ---- how they carry on by themselves ------------------------------------ */

  function inBand(lat) { return Math.max(LAT_LOW, Math.min(LAT_TOP, lat)); }

  function stepCompany(now) {
    var dt = Math.min(0.05, (now - strolled) / 1000 || 0.016);
    strolled = now;
    var creep = dt * 1.6;

    var dir = creature.dataset.facing === "left" ? 1 : -1;
    train.forEach(function (born, i) {
      var lat = inBand(beast.lat + (i % 2 ? 0.035 : -0.035));
      var lon = wrap(beast.lon + dir * 0.06 * (i + 1));
      born.lat += (lat - born.lat) * Math.min(1, creep * 3);
      born.lon = wrap(born.lon + shortest(born.lon, lon) * Math.min(1, creep * 3));
    });

    // Asked for stillness, they stand where they were put. The line behind
    // the animal still forms, because that is somewhere to be rather than
    // something moving.
    if (still) { return; }

    spawns.forEach(function (born) {
      if (born.following || born.kind === "tower") { return; }
      // Whatever is under the pointer holds still. They are small, they
      // wander, and a target that drifts out from under a thumb halfway
      // through a press is not a target.
      if (born.held || pouring === born) { return; }
      if (now > born.next) {
        born.next = now + 2400 + Math.random() * 5200;
        born.to = {
          lat: inBand(born.lat + (Math.random() - 0.5) * 0.16),
          lon: wrap(born.lon + (Math.random() - 0.5) * 0.3)
        };
      }
      if (!born.to) { return; }
      born.lat += (born.to.lat - born.lat) * Math.min(1, creep);
      born.lon = wrap(born.lon + shortest(born.lon, born.to.lon) * Math.min(1, creep));
    });

    if (now - mingled > 700) { mingled = now; mingle(); }
  }

  /* Two of a kind that have wandered into each other become one bigger one.
     Tubes and towers are left out of it: a tube is poured and a tower is
     stacked, and neither would be improved by merging. */
  function mingle() {
    for (var i = 0; i < spawns.length; i += 1) {
      var a = spawns[i];
      if (a.kind === "tube" || a.kind === "tower") { continue; }
      for (var j = i + 1; j < spawns.length; j += 1) {
        var b = spawns[j];
        if (b.kind !== a.kind || b.tier !== a.tier) { continue; }
        if (apart(a, b) > 0.06) { continue; }
        burstAt(b, b.token.c);
        banish(b);
        enlarge(a);
        return;                 // one meeting a sweep; there is no hurry
      }
    }
  }

  function placeSpawns() {
    spawns.forEach(function (born) {
      var p = project(born.lat, born.lon);
      if (p.z <= 0.05 || p.x < 14 || p.x > W - 14) {
        born.el.style.visibility = "hidden";
        return;
      }
      var scale = (0.5 + 0.5 * p.z) * Math.max(0.5, Math.min(1.2, R / 1100));

      // Whatever it does to show it is alive rides on this one transform: a
      // hatchling breathes, a coin turns over on its edge. Nothing here is a
      // separate animation, so nothing here keeps the compositor awake.
      var t = strolled / 1000;
      var life = "";
      if (still) { life = ""; }
      else if (born.kind === "hatchling" || born.kind === "egg") {
        life = " translateY(" +
               (Math.sin(t * 1.7 + born.phase) * 3.4).toFixed(2) + "%)";
      } else if (born.kind === "coin") {
        life = " scaleX(" +
               Math.max(0.09, Math.abs(Math.cos(t * 1.1 + born.phase))).toFixed(3) + ")";
      }

      born.el.style.visibility = "visible";
      born.el.style.opacity = (INV2 + INV * Math.min(1, (p.z - 0.05) / 0.3)).toFixed(3);
      born.el.style.transform =
        "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)" +
        // A tower stands on its base; everything else is carried a little
        // above the ground it is standing on.
        " translate(-50%," + (born.kind === "tower" ? "-100%" : "-92%") +
        ") scale(" + scale.toFixed(3) + ")" + life;
    });
  }

  /* ---- reaching one of them ----------------------------------------------- */

  function hitCompany(x, y) {
    for (var i = spawns.length - 1; i >= 0; i -= 1) {
      var born = spawns[i];
      if (born.el.style.visibility === "hidden") { continue; }
      var box = born.el.getBoundingClientRect();
      var pad = 10;
      if (x >= box.left - pad && x <= box.right + pad &&
          y >= box.top - pad && y <= box.bottom + pad) { return born; }
    }
    return null;
  }

  function openWork(born) {
    window.open("https://www.artsy.net/artwork/" + born.token.s, "_blank", "noopener");
  }

  /* Pressing plays with it; holding it opens the work it came from, so the
     press can mean something in the world and the work is still one gesture
     away. */
  function wireCompany(born) {
    var held = null;
    var opened = false;

    born.el.addEventListener("pointerenter", function () {
      born.held = true;
      showTraceAt(born.token, born.el, VERB[born.kind]);
    });
    born.el.addEventListener("pointerleave", function () {
      born.held = false;
      hideTrace();
    });
    born.el.addEventListener("focus", function () {
      born.held = true;
      showTraceAt(born.token, born.el, VERB[born.kind]);
    });
    born.el.addEventListener("blur", function () {
      born.held = false;
      hideTrace();
    });

    born.el.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
      opened = false;
      held = window.setTimeout(function () {
        opened = true;
        openWork(born);
      }, 550);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (name) {
      born.el.addEventListener(name, function () { window.clearTimeout(held); });
    });

    born.el.addEventListener("click", function (event) {
      event.stopPropagation();
      window.clearTimeout(held);
      if (opened) { opened = false; return; }
      playWith(born);
    });

    born.el.addEventListener("keydown", function (event) {
      if (event.key === "o" || event.key === "O" ||
          (event.key === "Enter" && event.shiftKey)) {
        event.preventDefault();
        event.stopPropagation();
        openWork(born);
        return;
      }
      if (event.key !== "Enter" && event.key !== " ") { return; }
      event.preventDefault();
      event.stopPropagation();
      playWith(born);
    });
  }

  /* ---- following a colour back ------------------------------------------- */

  function showTrace(part) {
    if (!part.token) { return; }
    showTraceAt(part.token, part.el);
  }

  function showTraceAt(tok, el, hint) {
    traceTitle.textContent = tok.t;
    traceMeta.textContent = tokenLine(tok);
    // On a colour worn by the animal the card is a way back to the work. On
    // something the company has left standing, the press does something in
    // the world instead, so the card says what, and how to reach the work.
    traceHint.textContent = hint ? hint + " · hold to open on Artsy" : "Open on Artsy";
    trace.hidden = false;

    var box = el.getBoundingClientRect();
    var w = trace.offsetWidth || 200;
    var h = trace.offsetHeight || 64;
    var x = Math.max(8, Math.min(box.left + box.width / 2 - w / 2, W - w - 8));
    // Under the part, so it does not fight the card above the creature.
    var y = box.bottom + 8;
    if (y + h > H - 8) { y = Math.max(8, box.top - h - 8); }

    trace.style.left = Math.round(x) + "px";
    trace.style.top = Math.round(y) + "px";
  }

  function hideTrace() { trace.hidden = true; }

  function follow(part) {
    if (!part.token) { return; }
    window.open("https://www.artsy.net/artwork/" + part.token.s, "_blank", "noopener");
  }

  function wireParts() {
    parts.forEach(function (part) {
      part.el.addEventListener("pointerenter", function () { showTrace(part); });
      part.el.addEventListener("pointerleave", hideTrace);
      part.el.addEventListener("focus", function () { showTrace(part); });
      part.el.addEventListener("blur", hideTrace);
      part.el.addEventListener("click", function (event) {
        event.stopPropagation();
        follow(part);
      });
      part.el.addEventListener("keydown", function (event) {
        if (event.key !== "Enter" && event.key !== " ") { return; }
        event.preventDefault();
        event.stopPropagation();
        follow(part);
      });
    });
  }

  function landedOn(x, y) {
    var box = creature.getBoundingClientRect();
    var pad = 30;
    return x >= box.left - pad && x <= box.right + pad &&
           y >= box.top - pad && y <= box.bottom + pad;
  }

  /* Nothing is put down until it is applied. A palette that misses the
     creature stays where it was dropped, so it can be picked up and tried
     again rather than having to be turned up from scratch. */
  function applyAt(x, y) {
    if (!carrying) { return; }

    // The animal is not the only thing a palette can be fed to: anything the
    // company has put on the world takes one as well, and grows by it. The
    // animal gets first refusal on its own square though, or a thing that
    // happened to be standing in front of it would intercept every throw.
    var box = creature.getBoundingClientRect();
    var onAnimal = x >= box.left && x <= box.right &&
                   y >= box.top && y <= box.bottom;
    var born = onAnimal ? null : hitCompany(x, y);
    if (born) {
      feed(born, carrying);
      carrying = null;
      offering = null;
      pressedOnce = false;
      token.hidden = true;
      hideGraze();
      resume();
      return;
    }

    if (!landedOn(x, y)) { return; }

    wear(carrying);
    carrying = null;
    offering = null;       // spent: the next press turns up something else
    pressedOnce = false;
    token.hidden = true;
    hideGraze();
    resume();
  }

  /* Clear the hand and the card, and let the creature get back to grazing. */
  function dismiss() {
    carrying = null;
    offering = null;
    dragging = null;
    pressedOnce = false;
    token.hidden = true;
    hideGraze();
    resume();
  }

  /* ---- the press model ---------------------------------------------------- */

  /* One press on the creature turns an artwork up, and it stays up — it used
     to be tied to hover, and since the creature never stops moving it flicked
     on and off under the pointer.

     A second press in quick succession takes that artwork's palette: it
     condenses into the token, which is then in hand. From there a single
     press drags it, and letting go over the creature applies it. */

  function beginDrag(event, el) {
    dragging = { id: event.pointerId, el: el };
    try { el.setPointerCapture(event.pointerId); } catch (e) {}
  }

  function onDragMove(event) {
    if (!dragging || event.pointerId !== dragging.id || !carrying) { return; }
    moveToken(event.clientX, event.clientY);
  }

  function onDragEnd(event) {
    if (!dragging || event.pointerId !== dragging.id) { return; }
    dragging = null;
    applyAt(event.clientX, event.clientY);
  }

  function watchDrag(el) {
    el.addEventListener("pointermove", onDragMove);
    ["pointerup", "pointercancel"].forEach(function (name) {
      el.addEventListener(name, onDragEnd);
    });
  }

  /* The two presses of the double, without a stopwatch between them. Timing
     the pair was the obvious way to read a double press and the wrong one:
     the creature moves, so on touch the second tap lands somewhere else, and
     any window tight enough to mean "double" is tight enough to miss. What
     the second press means is decided by what is already up instead, so it
     counts however long you take over it. */
  function press(event) {
    event.preventDefault();
    event.stopPropagation();     // a press here is not a turn of the world
    hold();                      // and the creature waits while you decide

    if (carrying) {              // a palette already in hand: move it
      beginDrag(event, event.currentTarget);
      moveToken(event.clientX, event.clientY);
      return;
    }

    if (offering && pressedOnce) {   // the second press: take its palette
      condense(offering, event.clientX, event.clientY);
      beginDrag(event, event.currentTarget);
      return;
    }

    // The first press. On a mouse the work is usually already up, because
    // moving onto the creature turns one up; counting that as the first press
    // would make a single press apply a palette outright. So the press is
    // counted, not the showing.
    if (!offering) { offer(); }
    pressedOnce = true;
    grazeHint.textContent = "Press again to take its palette";
  }

  creature.addEventListener("pointerdown", press);
  grazeCard.addEventListener("pointerdown", press);
  watchDrag(creature);
  watchDrag(grazeCard);

  /* The palette itself, once it is lying there: press it to pick it up. */
  token.addEventListener("pointerdown", function (event) {
    if (!carrying) { return; }
    event.preventDefault();
    event.stopPropagation();
    hold();
    beginDrag(event, token);
  });
  watchDrag(token);

  // Keyboard: Enter on the card takes the palette and applies it in one move.
  grazeCard.tabIndex = 0;
  grazeCard.setAttribute("role", "button");
  grazeCard.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" && event.key !== " ") { return; }
    event.preventDefault();
    if (!offering) { return; }
    wear(offering);
    offering = null;
    pressedOnce = false;
    hideGraze();
    resume();
  });

  /* ---- what it turned up stays up ---------------------------------------- */

  /* Hovering or focusing still turns something up, but nothing takes it away
     again on its own: it goes when it is applied, when the world is pressed,
     or on Escape. That is what stopped the flicker. */
  function show() { hold(); offer(); }

  creature.addEventListener("pointerenter", show);
  creature.addEventListener("focus", show);

  /* ---- turning it by hand ------------------------------------------------ */

  var turning = null;

  stage.addEventListener("pointerdown", function (event) {
    // Only reaches here when the press missed the creature, the card and the
    // token, all of which stop it. So: put down whatever was up.
    if (offering || carrying) { dismiss(); }
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

    // Opening a word also sends the creature to stand on it.
    hold();
    standOn(index);
    walkTimer = window.setTimeout(function () {
      creature.dataset.grazing = "true";
      walkTimer = window.setTimeout(walk, GRAZE_MAX);
    }, still ? 1 : 1800);

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
    if (event.key !== "Escape") { return; }
    if (!seam.hidden) { seam.hidden = true; return; }
    if (offering || carrying) { dismiss(); }
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
      geometry();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(geometry);
      }

      creature.hidden = false;
      readParts();
      wireParts();
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
