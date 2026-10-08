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
  var say = document.getElementById("say");
  var sayWho = document.getElementById("say-who");
  var sayLine = document.getElementById("say-line");
  var banner = document.getElementById("banner");
  var bannerBack = document.getElementById("banner-back");
  var bannerCity = document.getElementById("banner-city");
  var bannerUnder = document.getElementById("banner-under");
  var bannerBackTo = document.getElementById("banner-back-to");

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
  /* Five voices, from the things that only turn up once to the thing the
     collages are mostly made of. A word keeps the one its mass gives it. */
  var FACES = [
    { face: '"Space Grotesk", "Archivo", Helvetica, Arial, sans-serif',
      weight: 400 },
    { face: '"Instrument Serif", "Newsreader", Georgia, serif',
      weight: 400, slant: "italic" },
    { face: '"Syne", "Archivo", Helvetica, Arial, sans-serif',
      weight: 600 },
    { face: '"Fraunces", "Newsreader", Georgia, serif',
      weight: 700 },
    { face: '"Syne", "Archivo", Helvetica, Arial, sans-serif',
      weight: 800 }
  ];

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;
  var GOLDEN = Math.PI * (3 - Math.sqrt(5));  // the angle that spaces a spiral

  /* The world leans, and the lean is not fixed any more.

     It used to be: the north pole tipped 27 degrees toward the viewer and
     stayed there. The sphere is far wider than the window and sits low in
     it, so what was on the screen was a cap from about fifty degrees north
     to the pole — and every real place anybody wanted to stand in is south
     of that. Washington is at thirty-nine, Blacksburg at thirty-seven,
     Sydney at thirty-four the other way.

     So the lean is a thing you can move. Drag sideways and the world turns
     on its axis as it always did; drag up and down and it rolls the other
     way, north and south, and any latitude on the Earth can be brought into
     the window. The words keep the band they were laid out in — that is
     worked out once, at the lean the world rests at — so they are where
     they have always been and they simply go off the top of the screen when
     you walk south of them. */
  /* The lean it rests at. It used to be 27 degrees, which put the window on
     a cap from fifty degrees north to the pole — beautiful, and empty of
     everywhere anybody lives. At minus four the window is roughly eighteen
     to seventy-six degrees north, which is where six of the seven collages
     are, and the seventh is a long roll south. */
  var TILT = -4 * RAD;
  var tilt = TILT;           // and the lean it has now
  var COS_T = Math.cos(tilt);
  var SIN_T = Math.sin(tilt);
  var LEAN_LOW = -86 * RAD;  // far enough south to stand in Sydney
  var LEAN_TOP = 62 * RAD;

  // How far below the lean a latitude sits when it is comfortably in the
  // middle of the window: the visible band runs from about twenty degrees
  // above the lean to the pole, so this is the middle of it.
  var LOOK = 45 * RAD;

  // How far a word lies over, wherever the world has been rolled to.
  var LEAN_LOOK = Math.sin(27 * RAD);

  function lean(to) {
    tilt = Math.max(LEAN_LOW, Math.min(LEAN_TOP, to));
    COS_T = Math.cos(tilt);
    SIN_T = Math.sin(tilt);
  }

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

  // The land's colour is not a constant any more. Each landmass wears the
  // work it belongs to — see "a continent is a collage" below.

  var GRAZE_MIN = 2600;                        // how long it stays with a word
  var GRAZE_MAX = Math.round(2600 * PHI);      // …and at most, a golden step on

  var still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Held still by the viewer (WCAG 2.2.2; a11y.js, "Hold still"): kept per viewer, on by default
  // under reduced motion. Land.still(on) changes it while the page is open.
  try { var stillKept = localStorage.getItem("site.still"); if (stillKept === "1") { still = true; } else if (stillKept === "0") { still = false; } } catch (e) {}

  var supply = null;    // land.json — the tokens
  var architecture = null;   // architecture.json — the buildings (scripts/build_architecture.py)
  var museums = null;        // museums.json — the museums that hold the saved works (scripts/build_museums.py)
  var studios = null;        // studios.json — where the saved artists worked (scripts/build_studios.py; read when its layer is on)
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

  /* ---- two heights --------------------------------------------------------

     The globe is the view of the site: the Earth, the words the collages are
     made of, and a city on every landmass. Nothing happens up there. What
     happens is down in the cities — the creature, whatever grows off it, and
     the scenes they play — and going down into one is what you press a city
     to do.

     They are not two pages. There is one world and one projection, and the
     difference between them is how far away you are standing: the globe is
     the sphere at the size of the window, a city is the same sphere seven
     times bigger with that city under the middle of the screen, so what you
     were looking at from orbit becomes the ground you are standing on. The
     flight between them is the sphere growing, which is why it reads as
     going down to a place rather than as opening another page. */

  var baseR = 0;                 // the globe's own radius, before any zoom
  var zoom = 1;                  // and how much of it we are standing in
  var CITY_ZOOM = 7;
  var FLY = 1097;                // --beat-5, the same as everything slow
  var place = null;              // the city we are down in, or null
  var flying = false;
  var flyFrom = 1, flyTo = 1, flyAt = 0;
  var goingUp = false;           // the flight under way is back up to the world
  var flyK = 0;                  // how far down the flight is, 0 up to 1 at a place
  var hopFrom = null;            // where the world was held when a hop began
  var leanFrom = TILT, leanTo = TILT, leanWas = TILT;
  var spinWas = 0;
  var focus = { lat: 0, lon: 0 };
  var cities = [];
  var fit = 1;          // how much every word comes down by so they all fit

  /* ---- reading ---------------------------------------------------------- */

  function thumb(tok) { return tok.u || supply.cdn + tok.i + ".jpg"; }

  // Where a token's picture lives, and what that place is called.
  function tokenHref(tok) {
    return tok.href || "https://www.artsy.net/artwork/" + tok.s;
  }
  function tokenHome(tok) { return tok.href ? "NASA" : "Artsy"; }

  function tokenLine(tok) {
    return [tok.a, tok.y].filter(Boolean).join(", ");
  }

  /* ---- Hubble ---------------------------------------------------------------

     The colours the creature turns up and wears are the Hubble Space
     Telescope's now, not saved paintings. Every token is one of Hubble's own
     photographs — a galaxy, a nebula, a cluster — boiled down to the three
     colours it is most made of, and it leads back to that photograph in
     NASA's image library.

     They are read live, in the visitor's browser, from NASA's public image
     library (images-api.nasa.gov), which answers any page that asks. Each
     photograph's colours are measured off its own thumbnail as it arrives:
     the black of space is left out, so what is counted is the gas and the
     stars, and the three strongest colours that are not too like each other
     are its token. Until enough have been measured, and if NASA cannot be
     reached at all, the creature carries on with the saved paintings it had
     before. Nothing is stored and nothing is committed: the telescope is
     asked afresh every visit. */

  var HUBBLE_QUERIES = ["hubble galaxy", "hubble nebula", "hubble star cluster",
                        "hubble space telescope image"];
  var HUBBLE_NOT = /astronaut|servicing|sts-|shuttle|launch|crew|engineer|technician|clean ?room|mirror|mission|spacewalk|eva\b|logo|illustration|artist|concept|rendering|poster/i;
  var hubble = { tokens: [], seen: {}, measuring: 0 };

  function readHubble() {
    if (!window.fetch) { return; }
    HUBBLE_QUERIES.forEach(function (q, i) {
      window.setTimeout(function () {
        fetch("https://images-api.nasa.gov/search?media_type=image&q=" + encodeURIComponent(q))
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (d) {
            var items = (d && d.collection && d.collection.items) || [];
            items.forEach(function (item) {
              var data = item.data && item.data[0];
              var link = (item.links || []).filter(function (l) {
                return l.render === "image" || /thumb|small|medium/i.test(l.href || "");
              })[0];
              if (!data || !link || !data.nasa_id || hubble.seen[data.nasa_id]) { return; }
              var words = (data.title || "") + " " + (data.keywords || []).join(" ") +
                          " " + (data.description || "").slice(0, 200);
              if (HUBBLE_NOT.test(words)) { return; }
              if (!/hubble|hst\b/i.test(words)) { return; }
              hubble.seen[data.nasa_id] = true;
              measureHubble({
                s: data.nasa_id,
                t: (data.title || "Untitled").replace(/\s+/g, " ").trim(),
                a: "Hubble Space Telescope",
                y: (data.date_created || "").slice(0, 4),
                u: link.href.replace(/^http:/, "https:"),
                href: "https://images.nasa.gov/details/" + encodeURIComponent(data.nasa_id)
              });
            });
          })
          .catch(function () {});
      }, i * 400);
    });
  }

  /* The three colours a photograph is most made of, leaving out the black. */
  function measureHubble(tok) {
    if (hubble.measuring > 6) {                  // a few at a time
      window.setTimeout(function () { measureHubble(tok); }, 500);
      return;
    }
    hubble.measuring += 1;
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = function () {
      hubble.measuring -= 1;
      var colours = null;
      try { colours = strongest(img); } catch (e) { colours = null; }
      if (!colours) { return; }
      tok.c = colours;
      hubble.tokens.push(tok);
      // Once there are enough of them, they are the supply.
      if (hubble.tokens.length >= 12) {
        supply = {
          cdn: "",
          tokens: hubble.tokens,
          pool: hubble.tokens.map(function (t, i) { return i; }),
          byTerm: {}
        };
      }
    };
    img.onerror = function () { hubble.measuring -= 1; };
    img.src = tok.u;
  }

  function strongest(img) {
    var n = 40;
    var c = document.createElement("canvas");
    c.width = c.height = n;
    var g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, n, n);
    var px = g.getImageData(0, 0, n, n).data;      // throws if NASA will not share
    var bins = {};
    var lit = 0;
    for (var i = 0; i < px.length; i += 4) {
      var r = px[i], gr = px[i + 1], b = px[i + 2];
      if (r + gr + b < 90) { continue; }             // the black of space
      lit += 1;
      var key = (r >> 5) + "," + (gr >> 5) + "," + (b >> 5);
      var bin = bins[key] || (bins[key] = { n: 0, r: 0, g: 0, b: 0 });
      bin.n += 1; bin.r += r; bin.g += gr; bin.b += b;
    }
    if (lit < n * n * 0.04) { return null; }         // nearly all black: nothing to take
    var ranked = Object.keys(bins).map(function (k) {
      var bin = bins[k];
      return { n: bin.n, r: bin.r / bin.n, g: bin.g / bin.n, b: bin.b / bin.n };
    }).sort(function (p, q) { return q.n - p.n; });
    var chosen = [];
    ranked.forEach(function (bin) {
      if (chosen.length >= 3) { return; }
      var apart = chosen.every(function (o) {
        return Math.abs(o.r - bin.r) + Math.abs(o.g - bin.g) + Math.abs(o.b - bin.b) > 70;
      });
      if (apart) { chosen.push(bin); }
    });
    while (chosen.length < 3 && ranked.length) { chosen.push(ranked[chosen.length % ranked.length]); }
    return chosen.map(function (o) {
      return "#" + [o.r, o.g, o.b].map(function (v) {
        var h = Math.round(v).toString(16);
        return h.length < 2 ? "0" + h : h;
      }).join("");
    });
  }

  function workLine(work) {
    var bits = [work.medium];
    if (work.dimensions) {
      bits.push(work.dimensions + (work.unframed ? " (unframed)" : ""));
    }
    return bits.filter(Boolean).join(", ");
  }

  /* The world's words, in the order the works introduce them. */
  /* Not everything read off the collages gets to stand on the world. The
     globe carries what recurs — an object in two or more of them — and, on
     top of that, the few single ones that are somebody rather than something:
     the joker in the New York collage, the dog, the insect, the shoreline.
     Forty words was a field of small type; this is half that, at several
     times the size, which is what a word on a world should be. */
  var ALONE = ["playing card", "dog", "insect", "shoreline"];

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

    return order.filter(function (term) {
      return held[term].length > 1 || ALONE.indexOf(term) >= 0;
    }).map(function (term) {
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
    // A word lies down on the sphere, so near the limb it is turned as far as
    // eighty degrees from level and its footprint on the screen is nothing
    // like the box it takes up in latitude and longitude. Keeping them apart
    // by that box alone let the long ones lean into each other. So a word
    // also reserves a share of its own length upward and downward — not the
    // whole diagonal, which reserves so much that everything has to shrink to
    // fit, but enough that a word the width of a headline has somewhere to
    // lean.
    return {
      x: (w / 2) / Math.max(R, 1) + 0.030,
      y: (h / 2 + w * 0.17) / Math.max(R, 1) + 0.026
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

  /* ---- a continent is a collage -------------------------------------------

     Each landmass on the Earth is one of his works, coast to coast. The
     biggest goes to the first work, the next to the second, and round again
     through the islands, so every work has ground somewhere and no work's
     colour ever crosses a strait into another's.

     The colours are measured off the photographs of the collages themselves
     — scripts/build_tones.py — and then taken where they are wanted. Seven
     collages shot in the same light give seven browns, and seven browns on
     one globe is one brown, so what is kept from each is which of them is
     the warmer and which the cooler; they are then spread around the wheel
     far enough apart to be told from each other at the size a dot is. The
     artist's ruling, and it unlocked this: any colour for any object
     anywhere, so long as it works. */

  var measured = {};     // tones.json — what came off the photographs

  function readTones(data) {
    measured = (data && data.tones) || {};
  }

  function workHues() {
    var order = mine.works.map(function (work, i) {
      var own = measured[work.slug] || [];
      var lead = own.slice().sort(function (a, b) {
        return toHsl(b).s - toHsl(a).s;
      })[0];
      var c = lead ? toHsl(lead) : null;
      return {
        slug: work.slug,
        at: i,
        h: c && c.s > 0.04 ? c.h : (hash(work.slug) % 360) / 360
      };
    });

    // Warmest first, then given the whole wheel between them.
    var round = order.slice().sort(function (a, b) { return a.h - b.h; });
    var out = {};
    round.forEach(function (work, j) {
      out[work.slug] = (round[0].h + j / round.length) % 1;
    });
    return out;
  }

  /* ---- where the works are ------------------------------------------------

     The artist put them on the map himself, and these are the places he
     named. They are real coordinates: the world leans far enough now to
     reach any of them, which is what the leaning is for.

     Five of the seven are within a few hundred miles of each other on the
     east coast of America, so at the size the globe is drawn their marks
     sit close together and their names would print on top of one another.
     placeMarks below names every one of them it can, flipping a name to the
     left of its dot before it would run off the screen or the world, and
     stacks the two in Washington under one dot; the mark itself is always
     there to press. */

  var WHERE = [
    { slug: "amadeus",                where: "Sydney",        lat: -33.8688, lon: 151.2093 },
    { slug: "collage-with-portraits", where: "Washington",    lat: 38.8899,  lon: -77.0091 },
    { slug: "game-boy-advance",       where: "Washington",    lat: 38.9207,  lon: -77.0703 },
    { slug: "nyny",                   where: "New York",      lat: 40.7128,  lon: -74.0060 },
    { slug: "i",                      where: "San Francisco", lat: 37.7749,  lon: -122.4194 },
    { slug: "boston-spring",          where: "Boston",        lat: 42.3601,  lon: -71.0589 },
    { slug: "hey-amateur-collage",    where: "Blacksburg",    lat: 37.2296,  lon: -80.4139 }
  ];

  /* ---- and what the land wears --------------------------------------------

     Each dot of land takes the colour of whichever of his places is nearest
     it. Before, a whole landmass took one work, which was a good rule while
     the works had no addresses; now that they have, the map divides itself
     between them the way a map of anything does — by which one you are
     closest to. Australia is all Amadeus. North America is shared out along
     the coast between five collages, with a boundary running between each
     pair of them, and the west of it belongs to San Francisco.

     Colour is free here — the artist's ruling — so what is kept from each
     collage is its hue, measured off its own photograph and then spread
     around the wheel far enough that two neighbours can be told apart. */

  var WASHED = 10;       // how many landmasses get a wash of colour under them

  function remass() {
    masses = [];
    if (!continents.length) { return; }

    continents.forEach(function (mass, rank) {
      var at = nearestCity(mass.lat, mass.lon);
      var city = cities[at - 1];
      var hue = city ? city.hue : 0.09;
      masses[mass.id - 1] = {
        lat: mass.lat, lon: mass.lon, size: mass.size,
        slug: city ? city.slug : null,
        // A breath of colour under the weave, and only for the landmasses
        // big enough to be worth a gradient of their own.
        tone: rank < WASHED ? fromHsl(hue, 0.30, 0.70).join(",") : null,
        ink: fromHsl(hue, 0.46, 0.33).join(",")
      };
    });
  }

  /* Which of his places a point on the Earth is nearest. Chord length on the
     unit sphere rather than great-circle distance: the ordering is the same
     and there is no arccosine in it. */
  function nearestCity(lat, lon) {
    if (!cities.length) { return 0; }
    var cl = Math.cos(lat), sl = Math.sin(lat);
    var x = cl * Math.cos(lon), y = cl * Math.sin(lon), z = sl;
    var best = -2, at = 0;
    for (var i = 0; i < cities.length; i += 1) {
      var c = cities[i];
      if (c.ax === undefined) {
        var ccl = Math.cos(c.lat);
        c.ax = ccl * Math.cos(c.lon);
        c.ay = ccl * Math.sin(c.lon);
        c.az = Math.sin(c.lat);
      }
      var dot = x * c.ax + y * c.ay + z * c.az;
      if (dot > best) { best = dot; at = i; }
    }
    return at + 1;
  }

  /* The creature is out of the cities for now: the artist took it out on
     23 Sep 2026 and has not decided where it goes next. Everything it does
     is still here, and turning this back on puts it back down in every
     city, grazing, turning things up and throwing them. */
  var CREATURE = false;

  var LANDMARKS = [{
    slug: "folger",
    title: "Folger Shakespeare Library",
    where: "East Capitol Street, Washington",
    lat: 38.8890,
    lon: -77.0028,
    stage: true,                    // the plays are cast and played here
    piece: "folger",
    town: "washington-us"           // it stands in Washington, among its museums (cities.json)
  }];
  /* The Archive (the wall of monitors in Austin, where the moving images
     were) was taken off the globe at the artist's request, 25 Sep 2026:
     "it's irrelevant now". Its code stays (startArchive, CHANNELS); putting
     this back in LANDMARKS brings it back.
     { slug: "archive", title: "The Archive", where: "Austin, Texas",
       lat: 30.2672, lon: -97.7431, archive: true } */

  var BUILT = {
    "folger": function (o) {
      // The terrace it stands on.
      FLAT.floor(o, 0, 0, 26, 15, "folger");

      // A base course, and then the block: low and very long, which is the
      // whole character of the thing.
      put(o, 2, 8.5, 1, 22, 5.2, 1.0, 1);
      put(o, 2.7, 9.1, 2.0, 20.6, 4.0, 5.0, 0);

      // Nine pilasters along the north front, a relief panel between each
      // pair, and the tall narrow window over that.
      for (var i = 0; i < 9; i += 1) {
        var px = 3.3 + i * 2.35;
        put(o, px, 8.75, 2.0, 0.95, 0.5, 5.0, 0);
        if (i < 8) {
          put(o, px + 1.05, 8.95, 3.3, 1.3, 0.3, 1.7, 2);
          put(o, px + 1.25, 8.95, 5.9, 0.9, 0.3, 1.0, 2);
        }
      }

      // Cornice, inscription band, roof.
      put(o, 2.3, 8.6, 7.0, 21.4, 4.9, 0.45, 1);
      put(o, 2.5, 8.7, 7.45, 21.0, 4.7, 0.5, 0);
      put(o, 2.9, 9.1, 7.95, 20.2, 3.9, 0.35, 1);

      // The west door, and the steps down to the terrace.
      put(o, 3.4, 8.55, 2.0, 2.2, 0.4, 3.6, 2);
      FLAT.steps(o, 3.3, 5.9, 1, 2.4, 3);

      // The reading room end, a little proud of the rest.
      put(o, 20.4, 8.2, 1.6, 3.6, 5.6, 6.3, 0);
      put(o, 20.2, 8.1, 7.9, 4.0, 5.8, 0.5, 1);

      // The west garden: a low rail, and Puck on his plinth.
      FLAT.rail(o, 1.8, 4.8, 1, 6);
      put(o, 4.2, 2.4, 1, 1.8, 1.8, 1.1, 1);
      put(o, 4.7, 2.9, 2.1, 0.8, 0.8, 1.1, 0);
      put(o, 4.5, 3.1, 3.2, 1.2, 0.5, 0.5, 0);
      FLAT.toadstool(o, 7.4, 3.2, 1, 1);
      FLAT.toadstool(o, 9.0, 2.2, 1, 0.8);
    }
  };

  /* Marble. The hue is the landmass's — the library stands on whichever
     collage North America is wearing — and everything else about it is
     stone: hardly any colour, and a long way between the lit face and the
     shadowed one, which is what marble looks like in the sun. */
  function stone(hue) {
    return [rgbHex(fromHsl(hue, 0.08, 0.90)),
            rgbHex(fromHsl(hue, 0.13, 0.66)),
            rgbHex(fromHsl(hue, 0.20, 0.33))];
  }

  /* A mark on the globe: a dot and its name, as a button. Made again for
     every mark whenever found() runs (the window changing size, the fonts
     arriving). */
  var raiseOrder = 0;
  function raiseCity(city, real) {
    var el = document.createElement("button");
    el.className = "city";
    el.type = "button";
    el.dataset.kind = city.town ? "town" : city.museum ? "museum" : city.building ? "building" : city.studio ? "studio" : real ? "landmark" : "work";
    if (city.studio) { el.dataset.pr = city.studio[5]; }   // an exact studio, or a town of studios (land.css)
    if (city.layer) { el.dataset.layer = city.layer; }
    if (city.inTown) { el.dataset.intown = "true"; }     // named in its city, in the serif (land.css)
    // Unnamed until a naming pass gives it its name: made again (the window
    // changing size, the fonts arriving), every mark's name would otherwise
    // show for a moment before it was taken away.
    el.dataset.named = "false";
    if (city.town) {
      // A city's diamond is as big as its museums are many; a city of
      // galleries only is its tile of light, and the mark is its name.
      var many = city.town.museums.length;
      el.dataset.size = many >= 4 ? "3" : many >= 2 ? "2" : "1";
      if (city.tile) { el.dataset.tile = "true"; }
    }
    el.innerHTML = '<span class="city-dot" aria-hidden="true"></span>' +
                   '<span class="city-name"></span>';
    // A museum is named short in its city (SFMOMA, National Gallery of
    // Art); its full name is what is read out and what the banner says.
    el.lastChild.textContent = city.label || city.title;
    // Its visible name first (WCAG 2.5.3): what is read out begins with what is written.
    var seenName = city.label || city.title, saidName = city.aria || "Go down to " + city.title + ", " + city.where;
    el.setAttribute("aria-label", saidName.indexOf(seenName) === 0 ? saidName : seenName + " · " + saidName);

    city.el = el;
    city.name = el.lastChild;
    city.nw = 0;                     // its name's width, measured in one pass (measureNames)
    // A city of the Museums layer, and a museum, open their own way.
    el.addEventListener("click", function () {
      // In its city, a museum whose name found no room is named by a first
      // tap, which also lights its row; a second goes in. A phone has no
      // pointing at, and a museum is not gone into without knowing which.
      if (place && city.inTown && city.touched && art && art.kind === "town" &&
          art.tapped !== city.slug && city.el.dataset.named !== "true") {
        if (art.tapped) { lightMuseum(art.tapped, false); }
        art.tapped = city.slug;
        lightMuseum(city.slug, true);
        var r = el.firstChild.getBoundingClientRect();
        pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT, LILAC], 0.5, 89);
        return;
      }
      // Pressed on a reading's grown globe: the path goes on through this layer.
      if (grown) {
        cameLayer = layerOn;
        // A collage's site has no categories (no crumb back): its way back is the reading.
        if (city.work && art) { readingBack = readingWay(art, city); }
        var rg = el.firstChild.getBoundingClientRect();
        pulse(rg.left + rg.width / 2, rg.top + rg.height / 2, [LIGHT, LILAC], 0.6, 144);
      }
      if (city.open) { city.open(); } else if (place) { hopTo(city); } else { goDown(city); }
    });
    el.addEventListener("pointerdown", function (event) {
      city.touched = event.pointerType === "touch";
      // The stage takes the pointer on its way down, to turn the world
      // with; a press that lands on a city is not a turn, and if the
      // stage captures it the click never reaches the button at all.
      event.stopPropagation();
    });
    el.addEventListener("focus", function () {
      // Tabbed to: bring it round and roll to it, without going down into
      // it. Not when it was pressed — a press focuses it too, a moment
      // before the click, and turning the world then would lose the view
      // that coming back up is meant to return to. Never in a place: a
      // museum or a neighbour tabbed to in its city is already in view.
      if (place) { return; }
      var keyed = true;
      try { keyed = el.matches(":focus-visible"); } catch (e) {}
      if (!keyed) { return; }
      wanted = city.lon;
      lean(city.lat - LOOK);
    });
    if (city.museum || city.stage) {
      // In its city, a museum's mark and its row in the column answer each other.
      el.addEventListener("pointerenter", function () { lightMuseum(city.slug, true); });
      el.addEventListener("pointerleave", function () { if (!(art && art.tapped === city.slug)) { lightMuseum(city.slug, false); } });
      el.addEventListener("focus", function () { lightMuseum(city.slug, true); });
      el.addEventListener("blur", function () { lightMuseum(city.slug, false); });
    }
    cities.push(city);
    land.appendChild(el);

    // They come up one after another rather than all at once; a city in
    // its own run (city.rise), the one with the most museums first.
    raiseOrder += 1;
    var wait = city.rise !== undefined ? city.rise : 300 + raiseOrder * 150;
    window.setTimeout(function () { el.dataset.up = "true"; }, still ? 0 : wait);
  }

  function found() {
    cities.forEach(function (city) {
      if (city.el && city.el.parentNode) { city.el.parentNode.removeChild(city.el); }
    });
    cities = [];
    if (!mine) { return; }

    var hues = workHues();
    raiseOrder = 0;

    // The collages, each in the place the artist put it.
    WHERE.forEach(function (spot) {
      var work = null;
      mine.works.forEach(function (w) { if (w.slug === spot.slug) { work = w; } });
      if (!work) { return; }
      raiseCity({
        work: work, slug: work.slug, title: work.title, where: spot.where,
        lat: spot.lat * RAD, lon: wrap(spot.lon * RAD),
        layer: "collages", hue: hues[work.slug]
      }, false);
    });

    // And the places that are places rather than collages.
    LANDMARKS.forEach(function (mark) {
      raiseCity({
        work: null, slug: mark.slug, title: mark.title, where: mark.where,
        lat: mark.lat * RAD, lon: wrap(mark.lon * RAD),
        stage: mark.stage, piece: mark.piece, archive: mark.archive, real: true,
        // The Folger is a museum and library, and is shown with the museums
        // (artist, 24 Sep 2026): in Washington, among them, not on the globe.
        layer: mark.stage ? "museums" : undefined,
        townKey: mark.town, inTown: !!mark.town,
        // Pressed where it stands in its city, it opens as a museum does.
        open: mark.town ? function () { downToMuseum(mark.slug, {}); } : undefined,
        // A library is stone. It takes the hue of whichever collage it is
        // nearest — it stands four streets from two of them — and then
        // almost none of it.
        hue: hues[nearWork(mark)] || 0.09
      }, true);
    });

    // And the buildings the artist keeps an eye on, from the Architectural
    // Authority: each where it stands, or — a private home — in its town.
    // Pressing one goes down to it and it is seen from the air, in 3D.
    ((architecture && architecture.buildings) || []).forEach(function (b) {
      if (typeof b.lat !== "number" || typeof b.lon !== "number") { return; }
      raiseCity({
        work: null, slug: "building-" + b.slug, title: b.name || b.title, where: b.where,
        lat: b.lat * RAD, lon: wrap(b.lon * RAD), building: b, real: true,
        layer: "architecture", hue: hues[nearWork(b)] || 0.09
      }, true);
    });

    // And the museums that hold the works the artist has saved on Artsy,
    // each at its own door. Going down to one is the same as to a building —
    // the museum in DIRT — with the works it holds beside it. They stand in
    // their cities, not on the globe: the globe carries the cities.
    ((museums && museums.museums) || []).forEach(function (m) {
      if (typeof m.lat !== "number" || typeof m.lon !== "number") { return; }
      raiseCity({
        work: null, slug: m.slug, title: m.name, label: shortName(m), where: m.where,
        lat: m.lat * RAD, lon: wrap(m.lon * RAD), building: m, museum: m, real: true,
        layer: "museums", hue: hues[nearWork(m)] || 0.09,
        inTown: true, townKey: townOfSlug[m.slug], rise: 0,
        open: function () { downToMuseum(m.slug, {}); }
      }, true);
    });

    // And the artists, once lives.json has been read (the Artists layer):
    // each at the birthplace, named by surname; a town where several saved
    // artists were born one mark, "Paris · 47" (lives.js opens them: a life,
    // or the list of those born there).
    ((studios && studios.marks) || []).forEach(function (m, k) {
      raiseCity({
        work: null, slug: "born-" + k, title: m[2], label: m[2], aria: m[3], where: m[7] || m[3],
        lat: m[0] * RAD, lon: wrap(m[1] * RAD), studio: m, real: true,
        rank: 1 + 0.6 * Math.log(1 + (m[6] || 0)) / Math.LN10 + (m[5] === "town" ? 0.3 : 0.5),
        layer: "studios", hue: 0.09, rise: still ? 0 : 300 + Math.min(k, 55) * 34,
        open: function () { if (window.Lives && Lives.openMark) { Lives.openMark(m); } }
      }, true);
    });

    // And the cities, once cities.json has been read (the Museums layer).
    if (towns) { raiseTowns(); }
    filterGlobe();
    measureNames();
  }

  /* The Artists layer's file (lives.json: the birthplaces), read the first time the layer is on. */
  var studiosAsk = null;
  function studiosLayer() {
    if (layerOn !== "studios" || studios || studiosAsk) { return; }
    studiosAsk = read("lives.json").then(function (d) {
      studios = d;
      found();
      if (layerOn === "studios") { placeMarks(); groundPlaces(); }
    }).catch(function () { studiosAsk = null; });
  }

  /* ---- the filter -----------------------------------------------------------

     The globe carries the landmarks always, and one layer of everything
     else at a time, so it is never crowded and each kind reads as itself:
     the artist's own collages, the museums that hold the works he saved,
     or the architecture. A new kind of place is one more entry here and a
     `layer` on its marks. The choice is kept per viewer.

     The Museums layer is the cities now (artist, 29 Sep 2026: the artworks
     are "supposed to be within the museums section … have the cities
     displayed on the globe and then when you click on the city that is
     when it shows you the museums in that city"): see "the cities". */
  var ARTWORKS = true;                 // false: no histories, threads, Find or doors
  var LAYERS = [
    { key: "collages", label: "Collages" },
    { key: "museums", label: "Museums" },
    { key: "architecture", label: "Architecture" },
    // The studios (artist, 1 Oct 2026: "Give a site to artist studios to
    // catalogue individual artists with specific locations"): studios.js.
    // Since 2 Oct 2026 the Artists (artist: "I just want the Artist to be
    // located where they are born … when an artist is selected then all the
    // places relevant to them … show up and all the other places for other
    // artists do not show up"): one mark an artist, at the birthplace, a town
    // of several one mark with its count (lives.js); the studios are stops
    // inside a life. The key stays "studios", so a viewer's choice holds.
    { key: "studios", label: "Artists" }
  ];
  var LAYER_KEY = "globe-layer";
  var layerOn = "collages";
  try { layerOn = localStorage.getItem(LAYER_KEY) || layerOn; } catch (e) {}
  // Whoever last looked at the Artworks layer (27–29 Sep 2026; its pill and
  // its drawing are gone) lands on the one that holds it now.
  if (layerOn === "artworks") {
    layerOn = "museums";
    try { localStorage.setItem(LAYER_KEY, layerOn); } catch (e) {}
  }
  if (!LAYERS.some(function (l) { return l.key === layerOn; })) { layerOn = LAYERS[0].key; }
  var filterEl = document.getElementById("filter");
  // The viewer's stored choice (the front globe's), and the layer the path
  // being read came through: set by every press on a globe (the front one or
  // the reading's grown one), so a view opens its grown globe on it.
  var layerKept = layerOn, cameLayer = null;

  function filterGlobe() {
    cities.forEach(function (city) {
      // A museum (and the Folger) stands in its city, not on the globe.
      city.off = (!!city.layer && city.layer !== layerOn) || !!city.inTown;
      if (city.off) { city.el.style.visibility = "hidden"; city.shown = false; }
    });
    marksDirty = true;
    if (!filterEl) { return; }
    Array.prototype.forEach.call(filterEl.children, function (b) {
      if (!b.dataset.layer) { return; }
      b.setAttribute("aria-pressed", String(b.dataset.layer === layerOn));
      // On a reading's grown globe, the layer the path came through is marked.
      var came = grown && b.dataset.layer === (cameLayer || layerKept);
      if (came) { b.dataset.came = "true"; b.title = "The way you came"; } else { delete b.dataset.came; b.removeAttribute("title"); }
    });
  }

  if (filterEl) {
    LAYERS.forEach(function (l) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "filter-layer";
      b.dataset.layer = l.key;
      b.textContent = l.label;
      b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      b.addEventListener("click", function () {
        // Pressed again while its cities could not be read: read them again.
        if (layerOn === l.key && !(l.key === "museums" && !towns)) { return; }
        layerOn = l.key;
        var r0 = b.getBoundingClientRect();
        // On a reading's grown globe the choice is the reading's: not stored,
        // and the stored one comes back when the viewer goes up to the world.
        if (grown) {
          grownLayer();
          pulse(r0.left + r0.width / 2, r0.top + r0.height / 2, [LIGHT], 0.4, Math.max(W, H) * INV3);
          return;
        }
        layerKept = layerOn;
        try { localStorage.setItem(LAYER_KEY, layerOn); } catch (e) {}
        filterGlobe();
        placeMarks();
        groundPlaces();
        museumsLayer();
        studiosLayer();
        var r = b.getBoundingClientRect();
        pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT], 0.5, Math.max(W, H) * INV2);
      });
      filterEl.appendChild(b);
    });
  }

  /* Which collage a landmark is standing nearest, by the places they are in. */
  function nearWork(mark) {
    var best = null, near = Infinity;
    WHERE.forEach(function (spot) {
      var dLat = (spot.lat - mark.lat) * RAD;
      var dLon = (spot.lon - mark.lon) * RAD * Math.cos(mark.lat * RAD);
      var d = dLat * dLat + dLon * dLon;
      if (d < near) { near = d; best = spot.slug; }
    });
    return best;
  }

  /* ---- the names -------------------------------------------------------------

     Every mark is exactly where its place is: the middle of the dot is the
     projection of the real latitude and longitude, and nothing pushes it
     anywhere else. What makes room is the names, and they are few (artist,
     29 Sep 2026: the museums' names were "way too cluttered"): a name is
     written right of its dot, else left of it, and nowhere else; wholly on
     the Earth and wholly on the screen, clear of the pills at the foot; never
     over another name, nor over the dot of a place that matters more, nor
     ever over a city with museums, whose diamond is the way to them; and
     no more of them at once than the window has room for — seven on a
     phone. The rest keep their dots, and are named as the world turns or
     comes nearer. The collages are seven: each is named whenever it has
     room, lifted a line with a hairline back to its dot if it must be, and
     its dot is never let go.

     Nothing here reads the page's layout: every mark's size is measured
     once (measureNames), and a frame only works out where things go and
     writes what has moved. When the world is not moving it does nothing. */
  var SAME = 14;                        // closer than this is one point: the names stack
  var LINE = 16;                        // a name's line, and how far a stacked one steps down
  var KNOT = 13;                        // a city's diamond this near a kept one is tied into it:
                                        // 12 px, and the 0.3 px a mark may lag its point by
  var marksDirty = true;
  var marksAt = {};
  var safeFoot = 60;                    // the pills at the foot, from the bottom of the window
  var nameBoxes = [];                   // where the names are written, for the tiles to keep clear of

  /* The safe box's foot: the top of the filter pill, or of Find while it
     shows, less 8 px. Measured when they can be seen. */
  function measureSafe() {
    var foot = 0;
    [filterEl, artFind].forEach(function (b) {
      if (!b || b.hidden || b.dataset.grown) { return; }   // (moved onto a reading's enlarged globe)
      var r = b.getBoundingClientRect();
      if (r.height) { foot = Math.max(foot, H - r.top + 8); }
    });
    if (foot) { safeFoot = foot; }
    marksDirty = true;
  }

  function safeBox() {
    if (grown && grownAt) { return grownAt.box; }
    return { x0: 16, y0: 16, x1: W - 16, y1: H - safeFoot };
  }

  /* Every mark's measurements, in one pass: its width, its name's width and
     height, where its dot's middle is and how far the name starts from it. */
  function measureNames() {
    cities.forEach(function (c) {
      if (!c.el) { return; }
      var dot = c.el.firstChild, name = c.el.lastChild;
      c.w = c.el.offsetWidth;
      c.dx = dot.offsetLeft + dot.offsetWidth / 2;
      c.dh = dot.offsetWidth / 2;
      c.nw = name.offsetWidth;
      c.nh = name.offsetHeight;
      c.gap = name.offsetLeft - c.dx;
    });
    marksDirty = true;
    townDirty = true;
  }

  function hideMark(city) {
    if (city.shown === false) { return; }
    city.shown = false;
    city.el.style.visibility = "hidden";
  }

  /* A mark put down: its dot on (x, y), its name on the side given. */
  function putMark(city, x, y, side, opacity) {
    var el = city.el;
    var left = side === "left";
    if ((el.dataset.side === "left") !== left) {
      if (left) { el.dataset.side = "left"; } else { delete el.dataset.side; }
      city.px = null;
    }
    // Mirrored, the dot is the last thing in the mark, and the mark is put
    // down with its right-hand dot on the place.
    var at = left ? x - (city.w - city.dx) : x - city.dx;
    if (city.px === null || city.px === undefined || Math.abs(at - city.px) >= 0.3 || Math.abs(y - city.py) >= 0.3) {
      city.px = at;
      city.py = y;
      el.style.transform = "translate(" + at.toFixed(1) + "px," + y.toFixed(1) + "px) translate(0,-50%)";
    }
    var o = opacity.toFixed(2);
    if (city.op !== o) { city.op = o; el.style.opacity = o; }
    if (city.shown !== true) { city.shown = true; el.style.visibility = "visible"; }
  }

  function nameShown(city, on) {
    var v = on ? "true" : "false";
    if (city.el.dataset.named !== v) { city.el.dataset.named = v; }
    city.wasNamed = on;
  }

  // How many names the window has room for: seven on a phone, 21 at most.
  function nameBudget() {
    // On a reading's grown globe, as many as the area it is seen in has room for.
    if (grown && grownAt) {
      var g = grownAt.box;
      return Math.max(3, Math.min(21, Math.round(Math.max(0, g.x1 - g.x0) * Math.max(0, g.y1 - g.y0) / 46000)));
    }
    return Math.max(5, Math.min(21, Math.round(W * H / 46000)));
  }

  function placeMarks() {
    if (!marksDirty && marksAt.spin === spin && marksAt.tilt === tilt && marksAt.R === R &&
        marksAt.cx === cx && marksAt.cy === cy && marksAt.W === W && marksAt.H === H) { return; }
    marksDirty = false;
    marksAt = { spin: spin, tilt: tilt, R: R, cx: cx, cy: cy, W: W, H: H };
    var S = safeBox();
    var items = [];
    var finding = !!(finder && finder.found);
    cities.forEach(function (city, i) {
      if (city.off || !city.el) { return; }
      var p = project(city.lat, city.lon);
      var x = p.x, y = p.y;
      // A city of galleries is its tile: its name sits beside the lit cell.
      if (city.tile) { x = (Math.floor(x / CELL_PX) + 0.5) * CELL_PX; y = (Math.floor(y / CELL_PX) + 0.5) * CELL_PX; }
      if (p.z <= 0.12 || x < S.x0 || x > S.x1 || y < S.y0 || y > S.y1 || inAvoid(x, y, 6)) {
        if (city.knot) { city.knot = false; delete city.el.dataset.knot; }
        hideMark(city);
        return;
      }
      items.push({ city: city, x: x, y: y, z: p.z, turn: i });
    });

    // Knots: one diamond in any 12 px, the city that matters most kept;
    // the others are its tile until the world comes nearer.
    if (layerOn === "museums") {
      var kept = [];
      items.filter(function (it) { return it.city.town && !it.city.tile; })
        .sort(function (a, b) { return a.city.town.i - b.city.town.i; })
        .forEach(function (it) {
          var into = null;
          var tied = kept.some(function (k) {
            var dx = k.x - it.x, dy = k.y - it.y;
            if (dx * dx + dy * dy < KNOT * KNOT) { into = k.city; return true; }
            return false;
          });
          // Which diamond it is tied into: a press on its tile is that city's.
          it.city.knotTo = into;
          if (tied !== !!it.city.knot) {
            it.city.knot = tied;
            if (tied) { it.city.el.dataset.knot = "true"; } else { delete it.city.el.dataset.knot; }
          }
          if (tied) { it.knot = true; } else { kept.push(it); }
        });
      items = items.filter(function (it) {
        if (it.knot) { hideMark(it.city); return false; }
        return true;
      });
    }

    // The collages are seven: each is named whenever it has room, and its
    // dot is never let go. The rest are named as many at a time as the
    // window has room for.
    // The Artists are names only (artist, 3 Oct 2026: "There's still way too
    // many dots on the globe for the artist filter. I just want artist names
    // to be where they were born"): no mark stands for an artist unnamed, so
    // the window takes more names, and more as the world comes nearer.
    var rules = layerOn === "collages" ? { stack: true, keepDots: true, budget: Infinity, lifts: [-LINE, LINE, -2 * LINE, 2 * LINE] }
      : layerOn === "architecture" ? { stack: true, budget: nameBudget() }
      : layerOn === "studios" ? { namesOnly: true, budget: Math.round(nameBudget() * Math.min(2.6, Math.max(1.3, R / Math.max(1, base0)))) }
      : { budget: nameBudget() };
    rules.box = S;
    nameBoxes = nameMarks(items, rules);

    items.forEach(function (it) {
      var c = it.city;
      if (it.hidden || (rules.namesOnly && !it.side)) { hideMark(c); nameShown(c, false); return; }
      var dim = finding && c.town && !finder.found[c.town.key] ? 0.3 : 1;
      putMark(c, it.x, it.y, it.side || (c.el.dataset.side === "left" ? "left" : "right"),
              (INV2 + INV * Math.min(1, (it.z - 0.12) / 0.3)) * dim);
      nameShown(c, !!it.side);
      // A stacked name sits under the first, beside the first's dot; a
      // lifted one carries a hairline back to its dot.
      var dx = it.lead ? it.lead.x - it.x : 0, dy = it.lead ? it.lead.y - it.y + it.step * LINE + it.lift : 0;
      var shift = Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05 ? "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)" : "";
      if (c.shift !== shift) { c.shift = shift; c.name.style.transform = shift; }
      leadTo(c, it.side, it.side && it.lead === it ? it.lift : 0);
    });
  }

  /* A name lifted or dropped from its dot carries a hairline back to it,
     from the near edge of the name to the edge of the dot. */
  function leadTo(c, side, lift) {
    var mode = lift ? (lift < 0 ? "up" : "down") : "";
    if ((c.el.dataset.lift || "") !== mode) {
      if (mode) { c.el.dataset.lift = mode; } else { delete c.el.dataset.lift; }
    }
    if (!mode) { return; }
    var gap = c.gap || 10;
    var len = Math.max(0, Math.sqrt(gap * gap + lift * lift) - (c.dh || 4) - 2);
    var rot = Math.atan2(Math.abs(lift), gap) / RAD * ((lift < 0) === (side === "right") ? -1 : 1);
    var key = len.toFixed(1) + "|" + rot.toFixed(1);
    if (c.leadKey !== key) {
      c.leadKey = key;
      c.el.style.setProperty("--lead", len.toFixed(1) + "px");
      c.el.style.setProperty("--lead-rot", rot.toFixed(1) + "deg");
    }
  }

  /* The names, given out by priority: how much the place matters, how near
     the middle of the world it is, and a little more for a name already
     showing, so names hold steady while the world turns. rules.stack puts
     marks within 14 px under one dot with their names stacked, as one box;
     rules.keepDots never lets a dot go under a name (the collages). */
  function nameMarks(items, rules) {
    var S = rules.box;
    // Far off, no names. On a reading's grown globe, far is the area's: a
    // globe less than three fifths of the area across (a swapped one at
    // rest fills its place, and is named).
    var far = grown && grownAt ? R < 0.3 * Math.min(S.x1 - S.x0, S.y1 - S.y0) : R < base0 * INV2;
    var groups = [];
    items.forEach(function (it) {
      it.side = null;
      it.hidden = false;
      it.step = 0;
      it.lift = 0;
      it.lead = null;
      if (rules.stack) {
        for (var g = 0; g < groups.length; g += 1) {
          var L = groups[g].lead;
          if (Math.abs(L.x - it.x) < SAME && Math.abs(L.y - it.y) < SAME) {
            it.step = groups[g].members.length;
            it.lead = L;
            groups[g].members.push(it);
            return;
          }
        }
      }
      it.lead = it;
      groups.push({ lead: it, members: [it] });
    });
    groups.forEach(function (g) {
      var c = g.lead.city;
      g.pri = (c.rank || 1) * (0.3 + 0.7 * g.lead.z) * (c.wasNamed ? 1.25 : 1);
      g.w = 0;
      g.members.forEach(function (m) { g.w = Math.max(g.w, m.city.nw || 0); });
      g.h = Math.max(LINE, c.nh || 0) + (g.members.length - 1) * LINE;
    });
    groups.sort(function (a, b) { return b.pri - a.pri; });

    var given = [], dots = [], count = 0;
    function dotOf(m) { return { x: m.x, y: m.y, r: (m.city.dh || 4) + 3, lead: m.lead, town: m.city.town }; }
    // Dots that are never let go are never written over, whatever their rank.
    if (rules.keepDots) { items.forEach(function (m) { dots.push(dotOf(m)); }); }
    // The diamond of a city with museums is how its museums are reached, so a
    // name keeps off every one it can, whatever its rank (30 Sep 2026:
    // AMSTERDAM had hidden Otterlo). Where neither side is clear of them it
    // may cover a smaller city its own Near here lists, so what it hides is a
    // press away from where it leads; and only where that fails too, any
    // smaller city, let go for that pass (a city that matters more is never
    // left unnamed for one that matters less). `keep`: 2, off every diamond;
    // 1, off all but the near and smaller; 0, off the larger.
    var diamonds = rules.keepDots ? [] : items.filter(function (m) {
      return m.city.town && m.city.town.museums.length;
    }).map(dotOf);
    function onEarth(x, y) {
      var dx = x - cx, dy = y - cy;
      return dx * dx + dy * dy <= 0.96 * 0.96 * R * R;
    }
    function spare(t, o, keep) {
      return keep === 1 ? nearBy(t, o) : keep === 0 ? !!(t && o && o.rank < t.rank) : false;
    }
    function fits(b, lead, keep) {
      if (b.x0 < S.x0 || b.x1 > S.x1 || b.y0 < S.y0 || b.y1 > S.y1) { return false; }
      if (boxAvoid(b)) { return false; }
      if (!onEarth(b.x0, b.y0) || !onEarth(b.x1, b.y0) || !onEarth(b.x0, b.y1) || !onEarth(b.x1, b.y1)) { return false; }
      for (var k = 0; k < given.length; k += 1) {
        var o = given[k];
        if (b.x0 < o.x1 + 8 && o.x0 < b.x1 + 8 && b.y0 < o.y1 + 6 && o.y0 < b.y1 + 6) { return false; }
      }
      for (var d = 0; d < dots.length; d += 1) {
        var p = dots[d];
        if (p.lead && p.lead === lead) { continue; }        // its own stack
        if (b.x0 < p.x + p.r && p.x - p.r < b.x1 && b.y0 < p.y + p.r && p.y - p.r < b.y1) { return false; }
      }
      for (var q = 0; q < diamonds.length; q += 1) {
        var m = diamonds[q];
        if (m.lead === lead) { continue; }
        if (b.x0 < m.x + m.r && m.x - m.r < b.x1 && b.y0 < m.y + m.r && m.y - m.r < b.y1 &&
            !spare(lead.city.town, m.town, keep)) { return false; }
      }
      return true;
    }
    function under(it) {
      for (var k = 0; k < given.length; k += 1) {
        var o = given[k];
        if (it.x > o.x0 && it.x < o.x1 && it.y > o.y0 && it.y < o.y1) { return true; }
      }
      return false;
    }
    // How much of what is still to be named a name there would hide: the
    // places under it, each as much as it matters.
    function hides(b, lead) {
      var n = 0;
      items.forEach(function (m) {
        if (m.lead === lead || m.hidden) { return; }
        var r = (m.city.dh || 4) + 3;
        if (b.x0 < m.x + r && m.x - r < b.x1 && b.y0 < m.y + r && m.y - r < b.y1) { n += m.city.rank || 1; }
      });
      return n;
    }
    groups.forEach(function (g) {
      var L = g.lead;
      // A dot that falls under a name already given out is let go for now.
      if (!rules.keepDots && under(L)) {
        g.members.forEach(function (m) { m.hidden = true; });
        return;
      }
      if (!far && L.z >= 0.3 && count < rules.budget && g.w) {
        var gap = L.city.gap || 10;
        // Beside the dot, right or left; a collage may be lifted or dropped
        // a line or two, with a hairline back to its dot (rules.lifts).
        var lifts = [0].concat(rules.lifts || []);
        for (var k = 0; k < lifts.length && !L.side; k += 1) {
          var y0 = L.y + lifts[k] - Math.max(LINE, L.city.nh || 0) / 2;
          var right = { x0: L.x + gap, x1: L.x + gap + g.w, y0: y0, y1: y0 + g.h };
          var left = { x0: L.x - gap - g.w, x1: L.x - gap, y0: y0, y1: y0 + g.h };
          var okR = false, okL = false;
          for (var keep = 2; keep >= 0 && !okR && !okL; keep -= 1) {
            okR = fits(right, L, keep);
            okL = fits(left, L, keep);
            if (!diamonds.length) { break; }
          }
          var side = okR ? "right" : okL ? "left" : null;
          // Room on both sides: the side that hides less of the smaller
          // places, so a city's name is not written over a town of galleries
          // it could have left alone; on a tie, the side it had, so names do
          // not swap sides as the world turns.
          if (okR && okL && !rules.keepDots) {
            var hideR = hides(right, L), hideL = hides(left, L);
            var had = L.city.wasNamed && L.city.el.dataset.side === "left" ? "left" : "right";
            side = hideL < hideR ? "left" : hideR < hideL ? "right" : had;
          }
          if (side) {
            given.push(side === "right" ? right : left);
            count += 1;
            var lift = lifts[k];
            g.members.forEach(function (m) { m.side = side; m.lift = lift; });
          }
        }
      }
      // Names only: an artist unnamed is not drawn, so keeps nothing clear.
      if (!rules.keepDots && !(rules.namesOnly && !g.lead.side)) { g.members.forEach(function (m) { dots.push(dotOf(m)); }); }
    });
    return given;
  }

  /* The smaller cities with museums near one with museums: listed in its
     Near here, and the only diamonds its name may ever cover. As far as a
     diamond can be tied into it on this window while the world carries names
     (13 px at its smallest with names), and never less than 100 km: Princeton
     and New Haven from New York, Otterlo from Amsterdam. */
  function nearMuseums(t) {
    var km = Math.round(Math.max(100, Math.min(400, KNOT / (INV2 * Math.max(1, base0)) * 6371)));
    if (t.nearMus && t.nearMusKm === km) { return t.nearMus; }
    var out = {};
    if (t.museums.length) {
      towns.forEach(function (o) {
        if (o === t || !o.museums.length || o.rank >= t.rank) { return; }
        var d = Math.acos(Math.max(-1, Math.min(1, dot3(t.v, o.v)))) * 6371;
        if (d <= km) { out[o.key] = Math.max(1, Math.round(d)); }
      });
    }
    t.nearMus = out;
    t.nearMusKm = km;
    return out;
  }
  function nearBy(t, o) { return !!(t && o && t !== o && nearMuseums(t)[o.key]); }

  /* The flight. Nothing is torn down and nothing is built: the sphere grows
     under you until the city you pressed is the ground you are standing on,
     and shrinks back the same way. */

  /* A deep flight: down to a city of museums, framed far below a collage's
     city, and back up. The zoom is eased on a logarithmic scale, so every
     doubling of it takes as long as the last, and the world turns with it:
     going down, what you are flying to slides steadily to its seat as the
     ground swells, and never runs off the screen; going up, it pulls out
     first and turns back after; between two places too far apart to be seen
     together from the lower height, it rises until both fit and comes down
     again (a dip). Every other flight is as it always was. */
  var fly = { deep: false, kind: "", a: 0, m: 0, b: 0, dur: FLY, spin0: 0, dSpin: 0 };

  function planFlight(kind, zFit) {
    var a = Math.log(Math.max(1e-6, flyFrom)), b = Math.log(Math.max(1e-6, flyTo));
    var dip = kind === "hop" && zFit !== undefined && zFit < 0.8 * Math.min(flyFrom, flyTo);
    var ratio = Math.max(flyTo / flyFrom, flyFrom / flyTo);
    fly.deep = dip || ratio > CITY_ZOOM + 0.01;
    fly.kind = dip ? "dip" : kind === "hop" ? (flyTo > flyFrom ? "down" : "up") : kind;
    fly.a = a;
    fly.b = b;
    // The middle of the curve: halfway, or out to where both places fit.
    fly.m = dip ? 2 * Math.log(zFit) - (a + b) / 2 : (a + b) / 2;
    var travel = dip ? Math.exp(Math.abs(a - Math.log(zFit)) + Math.abs(b - Math.log(zFit))) : ratio;
    fly.dur = fly.deep ? FLY * Math.max(1, Math.min(1.6, 1 + 0.2 * Math.log(travel / 7) / Math.LN10)) : FLY;
    fly.spin0 = spin;
    fly.dSpin = shortest(spin, wanted);
  }

  function goDown(city) {
    if (flying || place) { return; }
    cameLayer = layerOn;            // the layer this path came through (the grown globe opens on it)
    if (readingBack && readingBack.to !== city) { readingBack = null; }
    settleSwing();
    if (route) { endRoute(); }
    if (!city.art) { artAsked = null; }   // pressed elsewhere: a view still being read is not flown to
    var from = project(city.lat, city.lon);
    pulse(from.x, from.y, [cityTone(city), LIGHT], 1, Math.max(W, H) * INV);
    place = city;
    focus.lat = city.lat;
    focus.lon = city.lon;
    // The view you are leaving, kept to come back up to: how far the world
    // was rolled, and which way round it was turned.
    leanWas = tilt;
    spinWas = wanted;
    wanted = city.lon;              // turn the world so the city faces you
    // And roll it until the city's own latitude is the one facing you, which
    // puts the place dead centre however far north or south it is.
    leanFrom = tilt;
    leanTo = city.lat;
    flyFrom = zoom;
    // An art view is framed at the height its history needs (see frameOf),
    // and a city at the height its museums need (townFrame).
    flyTo = city.zoomTo || CITY_ZOOM;
    goingUp = false;
    hopFrom = null;
    planFlight("down");
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
    hideGraze();
    closeDeck();
    passage(oneOf(["edges", "corner"]), [cityTone(city), LIGHT, LILAC], fly.dur * 0.9, from.y);
  }

  /* From one place to another without going back up: the world turns under
     you from the one to the other at the height of a city, and you arrive. */
  function hopTo(city) {
    if (flying) { return; }
    if (!place) { goDown(city); return; }
    if (readingBack && readingBack.to !== city) { readingBack = null; }
    if (!city.art) { artAsked = null; }
    stopTheatre();
    stopArchive();
    stopBuilding();
    stopArt();
    endScene();
    hold();
    hideGraze();
    showHere(false);
    spawns.forEach(function (born) { born.el.style.visibility = "hidden"; });
    banner.hidden = true;
    delete land.dataset.art;
    // The framing eases from wherever the last place held the world.
    hopFrom = { x: cx, y: cy };
    // How near the world must be to see both places at once, for a dip.
    var apart = Math.acos(Math.max(-1, Math.min(1, dot3(toVec(focus.lat, focus.lon), toVec(city.lat, city.lon)))));
    var band = artBand();
    var zFit = apart > 1e-9 ? 0.4 * Math.min(band.w, band.h) / apart / Math.max(1, baseR) : Infinity;
    // A work's history is framed on no one place: a way from it starts unnamed.
    // Nor is a museum named again on the way up to its own city, where its
    // mark stands named already.
    var home = city.art && city.art.kind === "town" && (place.museum || place.stage) && place.townKey === city.townKey;
    var was = { lat: focus.lat, lon: focus.lon, key: place.townKey || place.slug, town: place.townKey || null,
                name: (place.art && place.art.kind !== "town") || home ? "" : place.title };
    place = city;
    focus.lat = city.lat;
    focus.lon = city.lon;
    wanted = city.lon;
    leanFrom = tilt;
    leanTo = city.lat;
    flyFrom = zoom;
    flyTo = city.zoomTo || CITY_ZOOM;
    goingUp = false;
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
    // Between a city and its own museums (or two museums in one city) there
    // is no journey to make: the view only slides to its new seat.
    var inside = !!(was.town && was.town === city.townKey);
    if (still || inside) {
      planFlight("hop", zFit);
      passage(oneOf(["edges", "corner"]), [cityTone(city), LIGHT, LILAC], fly.dur * 0.9, H / 2);
    } else {
      setOut(was, city, apart, zFit);
    }
  }

  /* ---- the journey ---------------------------------------------------------

     From one place to another is a journey, not a cut: the world is not
     hidden and nothing is swept over it. You rise off the place you are
     leaving until both it and the next are in view, travel the great circle
     between them over the land itself, and come down onto the next. The
     land is woven again under you as you go, each piece fading into the
     last, so there is never an edge of it or a hole in it; the way is drawn
     in the light as it is travelled, ahead of you faint and behind you
     lit, and the towns it passes over are named as you pass them. It takes
     as long as the way is long, and the way stays lit a while after. */
  var journey = null;
  var route = null;
  var landFade = { old: null, at: 0 };
  var LAND_FADE = 360;
  var ROUTE_STEP = 900;                 // after arriving, the way steps down a level this often
  var JOURNEY_WORLD = 2.2;              // above this height the land is the world's own weave
  var clothOld = document.createElement("canvas"), cloth2Old = document.createElement("canvas");
  var oldCtxs = [clothOld.getContext("2d"), cloth2Old.getContext("2d")];
  var routeNames = el("div", "route-names");
  routeNames.setAttribute("aria-hidden", "true");
  stage.appendChild(routeNames);

  function setOut(was, city, apart, zFit) {
    var a = Math.log(Math.max(1e-6, flyFrom)), b = Math.log(Math.max(1e-6, flyTo));
    // High enough to see both ends at once, and always at least a little up:
    // the place you are leaving is seen from above before it is left.
    var top = Math.max(0.9, Math.min(zFit, Math.min(flyFrom, flyTo) / (PHI * PHI)));
    var km = apart * 6371;
    fly.kind = "journey";
    fly.deep = true;
    fly.a = a;
    fly.b = b;
    fly.m = Math.log(top);
    fly.dur = Math.max(4800, Math.min(11000, 4200 + 1800 * Math.log(1 + km / 20) / Math.LN10));
    fly.spin0 = spin;
    fly.dSpin = shortest(spin, wanted);
    var av = toVec(was.lat, was.lon), bv = toVec(city.lat, city.lon);
    journey = { av: av, bv: bv, om: apart, lift: Math.max(0, (a + b) / 2 - fly.m),
                wk: "", wc: null, wz: 0, wspan: 0, wAt: 0, pickAt: 0, fromKey: was.key,
                toKey: city.townKey || city.slug };
    clearRouteNames();
    route = { samples: routeArc(av, bv, apart), u: 0, doneAt: null, towns: [], av: av, bv: bv, om: apart,
              names: [routeName(city.title, city.lat, city.lon, "to")] };
    if (was.name) { route.names.push(routeName(was.name, was.lat, was.lon, "from")); }
    route.riders = [];
    boardRiders(route, was, city);
    tilesDirty = true;
  }

  function journeyZoom(went) {
    var s = went * went * (3 - 2 * went);
    return Math.exp(fly.a + (fly.b - fly.a) * s - journey.lift * 4 * s * (1 - s));
  }

  // Where along the way, and how high, at a moment of the flight.
  function stepJourney(went) {
    var J = journey;
    J.went = went;
    var s = went * went * (3 - 2 * went);
    zoom = journeyZoom(went);
    // The going starts once you are up and is done before you are down.
    var q = Math.max(0, Math.min(1, (went - 0.08) / 0.84));
    var u = q * q * q * (q * (q * 6 - 15) + 10);
    var v = slerp3(J.av, J.bv, J.om, u);
    focus.lat = latOf(v);
    focus.lon = lonOf(v);
    spin = focus.lon;
    lean(focus.lat);
    flyK = s;
    route.u = u;
  }

  function slerp3(a, b, om, u) {
    if (om < 1e-9) { return a; }
    var fa = Math.sin((1 - u) * om) / Math.sin(om), fb = Math.sin(u * om) / Math.sin(om);
    return norm3([a[0] * fa + b[0] * fb, a[1] * fa + b[1] * fb, a[2] * fa + b[2] * fb]);
  }

  // The way on the ground, close enough together to draw it at any height.
  function routeArc(av, bv, om) {
    var count = Math.max(24, Math.min(480, Math.ceil(om / (0.02 * RAD)) + 1));
    var s = new Float32Array(count * 4);
    for (var k = 0; k < count; k += 1) {
      var v = slerp3(av, bv, om, k / (count - 1));
      s[k * 4] = v[0]; s[k * 4 + 1] = v[1]; s[k * 4 + 2] = v[2]; s[k * 4 + 3] = 1;
    }
    return s;
  }

  /* The land under a journey: woven again wherever you have got to before
     any edge of it could come into view — wide enough for the height you
     will have climbed to in the next half second — and again, closer, once
     you have come down a third of a height into it; the one before fades. */
  function journeyLand(now) {
    var J = journey;
    if (bodyOn()) { return; }          // the body is the land, drawn where the world is, every frame
    if (zoom < JOURNEY_WORLD) {
      if (J.wk !== "world") {
        keepLand(now);
        if (worldWeave) { putWeave(worldWeave); } else { weave(); }
        J.wk = "world";
      }
      return;
    }
    var c = { lat: focus.lat, lon: focus.lon };
    var ahead = zoom;
    for (var k = 1; k <= 4; k += 1) {
      ahead = Math.min(ahead, journeyZoom(Math.min(1, J.went + k * 130 / fly.dur)));
    }
    if (J.wk === "patch") {
      var gone = Math.acos(Math.max(-1, Math.min(1, dot3(toVec(c.lat, c.lon), toVec(J.wc.lat, J.wc.lon)))));
      var here = project(c.lat, c.lon), reach = 0;
      [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (p) {
        reach = Math.max(reach, Math.sqrt((p[0] - here.x) * (p[0] - here.x) + (p[1] - here.y) * (p[1] - here.y)));
      });
      var covered = (J.wspan - gone) * R >= 1.04 * reach * (zoom / Math.max(1e-6, ahead));
      var coarse = zoom / J.wz > 1.35;
      if (covered && !(coarse && now - J.wAt > 240)) { return; }
    }
    keepLand(now);
    weave(c, { loose: true, margin: 1.2 * Math.max(1, zoom / ahead) });
    J.wk = "patch";
    J.wc = c;
    J.wz = zoom;
    J.wspan = woven.span;
    J.wAt = now;
  }

  // The land as it is now, kept to fade out under what comes next.
  function keepLand(now) {
    if (!wCount) { return; }
    landFade.old = takeWeave();
    landFade.at = now;
  }

  function routeName(text, lat, lon, kind) {
    var n = el("span", "route-name", text);
    n.dataset.kind = kind;
    routeNames.appendChild(n);
    return { el: n, lat: lat, lon: lon, kind: kind, until: Infinity, shown: false };
  }

  function clearRouteNames() {
    routeNames.textContent = "";
  }

  /* The towns the way passes over: the one that matters most near where you
     are is named a while, two at most at once, each once. */
  function passTowns(now) {
    if (!towns || now - journey.pickAt < 260) { return; }
    journey.pickAt = now;
    var live = route.names.filter(function (n) { return n.kind === "past" && n.until > now; });
    if (live.length >= 2) { return; }
    var here = project(focus.lat, focus.lon);
    var reach = 0.34 * Math.min(W, H);
    var best = null;
    towns.forEach(function (t) {
      if (t.key === journey.fromKey || t.key === journey.toKey || route.towns.indexOf(t) >= 0) { return; }
      var p = project(t.lat, t.lon);
      if (p.z < 0.08 || p.x < 16 || p.x > W - 140 || p.y < 90 || p.y > H - 40) { return; }
      var d = Math.sqrt((p.x - here.x) * (p.x - here.x) + (p.y - here.y) * (p.y - here.y));
      if (d > reach) { return; }
      if (!best || t.rank > best.rank) { best = t; }
    });
    if (!best) { return; }
    route.towns.push(best);
    var n = routeName(best.name, best.lat, best.lon, "past");
    n.el.appendChild(el("span", "route-name-n", " · " + best.n.toLocaleString("en") + (best.n === 1 ? " work" : " works")));
    n.until = now + 2600;
    route.names.push(n);
  }

  // The names beside their places, each frame; a name is let go in steps.
  function placeRouteNames(now) {
    route.names.forEach(function (n) {
      var p = project(n.lat, n.lon);
      var gone = n.until <= now || (n.kind === "to" && route.doneAt !== null) ||
                 (route.doneAt !== null && now - route.doneAt > 3 * ROUTE_STEP);
      var on = !gone && p.z >= 0.08 && p.x > -40 && p.x < W + 40 && p.y > 60 && p.y < H;
      if (on) { n.el.style.transform = "translate(" + Math.round(p.x + 11) + "px," + Math.round(p.y) + "px) translateY(-50%)"; }
      if (on !== n.shown) { n.shown = on; n.el.dataset.on = on ? "true" : "false"; }
    });
  }

  /* The way, into drawTiles' runs: behind you lit, with a head stepping
     down to it; ahead of you every other tile, faint; each end five tiles
     in a diamond; the towns it passes, a tile each. After arriving it steps
     down a level at a time and is gone. */
  function routeRuns(runs, t) {
    var cells = legCells(route);
    var count = cells.length / 3;
    var dim = 0;
    if (route.doneAt !== null) {
      dim = Math.floor((t - route.doneAt) / ROUTE_STEP);
      if (dim >= 4) { endRoute(); return; }
    }
    var cols = Math.ceil(W / CELL_PX), rows = Math.ceil(H / CELL_PX);
    function put(i, j, lvl) {
      lvl -= dim;
      if (lvl < 1 || i < 0 || j < 0 || i >= cols || j >= rows) { return; }
      var key = LIGHT + "|" + Math.min(4, lvl);
      (runs[key] || (runs[key] = [])).push(i, j);
    }
    var head = Math.round(route.u * (count - 1));
    for (var c = 0; c < count; c += 1) {
      if (!cells[c * 3 + 2]) { continue; }
      var i = cells[c * 3], j = cells[c * 3 + 1];
      if (c <= head) {
        var back = head - c;
        put(i, j, route.doneAt === null && back < 3 ? 4 - back : 2);
      } else if (!(c % 2)) {
        put(i, j, 1);
      }
    }
    [0, count - 1].forEach(function (c, e) {
      if (c < 0 || !cells[c * 3 + 2]) { return; }
      var i = cells[c * 3], j = cells[c * 3 + 1], lvl = e ? 4 : 3;
      put(i, j, lvl); put(i - 1, j, lvl - 1); put(i + 1, j, lvl - 1); put(i, j - 1, lvl - 1); put(i, j + 1, lvl - 1);
    });
    route.towns.forEach(function (tw) {
      var p = project(tw.lat, tw.lon);
      if (p.z >= 0.08) { put(Math.floor(p.x / CELL_PX), Math.floor(p.y / CELL_PX), 3); }
    });
  }

  /* The company a journey keeps: the works that made this same journey.
     Each place's file gives, for every work there, the place it came from
     and the place it went on to; a work that left the one for the other
     rides beside you the whole way, and a work that has been in both,
     whenever, keeps it when none made the trip. Five at most. They lift off
     the place you leave, follow you a little behind, fanned either side of
     the way, and gather at the place you come to; the one leading is named,
     and each takes the lead in turn. */
  function boardRiders(r, was, city) {
    var fromKey = was.town, toKey = city.townKey;
    if (!fromKey || !toKey || fromKey === toKey) { return; }
    Promise.all([readArt("places/" + fromKey + ".json"), readArt("places/" + toKey + ".json")]).then(function (both) {
      var A = both[0], B = both[1];
      if (route !== r || !A || !B) { return; }
      var picked = [], seen = {};
      var nameA = A.w ? A.w.split(",")[0] : was.name, nameB = B.w ? B.w.split(",")[0] : city.title;
      function add(row, line) {
        if (picked.length >= 5 || seen[row[0]] || !row[3]) { return; }
        seen[row[0]] = true;
        picked.push({ id: row[0], t: row[1], a: row[2], img: row[3], line: line });
      }
      // Following an animal, the artist's works lead: those that have been where you are going.
      if (following) {
        B.works.forEach(function (row) {
          if (following.ids[row[0]]) { add(row, following.artist + " \u00b7 " + nameB + (row[6] ? ", " + row[6] : "")); }
        });
      }
      A.works.forEach(function (row) {
        if (row[10] === toKey) { add(row, "left " + nameA + " for " + nameB + (row[7] ? ", " + row[7] : "")); }
      });
      B.works.forEach(function (row) {
        if (row[9] === fromKey) { add(row, "came to " + nameB + " from " + nameA + (row[6] ? ", " + row[6] : "")); }
      });
      var inB = {};
      B.works.forEach(function (row) { if (!inB[row[0]]) { inB[row[0]] = row; } });
      A.works.forEach(function (row) {
        var other = inB[row[0]];
        if (other) { add(row, nameA + (row[6] ? " " + row[6] : "") + " \u00b7 " + nameB + (other[6] ? " " + other[6] : "")); }
      });
      picked.forEach(function (w, i) {
        var fig = el("figure", "route-work");
        var img = document.createElement("img");
        img.alt = "";
        img.decoding = "async";
        img.src = ART_CDN + w.img + "/square.jpg";
        img.addEventListener("error", function () { fig.dataset.nopic = "true"; });
        fig.appendChild(img);
        fig.style.setProperty("--tone", "#eadfcd");
        routeNames.appendChild(fig);
        var cap = el("span", "route-work-cap");
        cap.appendChild(el("span", "route-work-title", w.t));
        cap.appendChild(el("span", "route-work-by", " \u2014 " + w.a));
        cap.appendChild(el("span", "route-work-line", w.line));
        routeNames.appendChild(cap);
        r.riders.push({ w: w, el: fig, cap: cap, i: i, shown: false, capShown: false });
      });
      r.boardedAt = performance.now();
    });
  }

  function placeRiders(now) {
    var r = route;
    if (!r.riders || !r.riders.length) { return; }
    var J = journey;
    var n = r.riders.length;
    // Each takes the lead for a while, in turn.
    var lead = Math.floor((now - (r.boardedAt || now)) / 2200) % n;
    var gone = r.doneAt !== null && now - r.doneAt > 2600;
    r.riders.forEach(function (rd) {
      var lag = 0.045 * (rd.i + 1);
      var u = r.doneAt === null ? Math.max(0, r.u - lag) : Math.min(1, 1 - lag + (now - r.doneAt) / 700);
      var av = r.av, bv = r.bv;
      var v = slerp3(av, bv, r.om, u), v2 = slerp3(av, bv, r.om, Math.min(1, u + 0.01));
      var p = project(latOf(v), lonOf(v)), q = project(latOf(v2), lonOf(v2));
      var dx = q.x - p.x, dy = q.y - p.y, len = Math.sqrt(dx * dx + dy * dy) || 1;
      var side = rd.i % 2 ? 1 : -1, far = 44 + 26 * Math.floor(rd.i / 2);
      // Gathered at the end: a small arc round the place arrived at.
      if (r.doneAt !== null) { far *= Math.max(0.55, 1 - (now - r.doneAt) / 1400); }
      var x = p.x - dy / len * far * side, y = p.y + dx / len * far * side;
      var on = !gone && p.z >= 0.08 && x > -30 && x < W + 30 && y > 70 && y < H + 30 && (r.u > 0.01 || r.doneAt !== null);
      if (on) { rd.el.style.transform = "translate(" + Math.round(x - 19) + "px," + Math.round(y - 19) + "px)"; }
      if (on !== rd.shown) { rd.shown = on; rd.el.dataset.on = on ? "true" : "false"; }
      var capOn = on && rd.i === lead && r.doneAt === null;
      if (capOn) {
        // On the rider's own side of the way, away from the line and its names.
        var out = -dy / len * side;
        var right = Math.abs(out) > 0.3 ? out > 0 : x < W * 0.55;
        var cw = rd.cw || (rd.cw = rd.cap.offsetWidth || 200);
        if (right && x + 26 + cw > W - 8) { right = false; }
        if (!right && x - 26 - cw < 8) { right = true; }
        rd.cap.dataset.side = right ? "right" : "left";
        rd.cap.style.transform = right ? "translate(" + Math.round(x + 26) + "px," + Math.round(y - 17) + "px)"
                                       : "translate(" + Math.round(x - 26) + "px," + Math.round(y - 17) + "px) translateX(-100%)";
      }
      if (capOn !== rd.capShown) { rd.capShown = capOn; rd.cap.dataset.on = capOn ? "true" : "false"; }
    });
  }

  function endRoute() {
    route = null;
    clearRouteNames();
    tilesDirty = true;
  }

  // Arrived: the way stays lit a while, and the last of the land fades.
  function endJourney(now) {
    keepLand(now);
    journey = null;
    if (route) { route.doneAt = now; route.u = 1; }
  }

  /* A collage's site pressed on a reading's grown globe: the categories'
     crumb that keeps the reading one press back everywhere else is not
     there (a collage is the artist's own, of no category), so the way back
     from it, the banner's and the pinch's, is the reading. */
  var readingBack = null;               // { to: the place, name, go }
  function readingWay(a, to) {
    var d = a.data || {}, title = String(d.title || (place && place.title) || "");
    var go = a.kind === "life" ? function () { openLife(d); }
      : a.kind === "movement" ? function () { openMovement(d); }
      : a.kind === "work" && d.id ? function () { openArt({ work: d.id }, {}); }
      : a.kind === "thread" && d.id ? function () { openArt({ thread: d.id }); }
      : null;
    if (!go || !title) { return null; }
    // A life by its artist's surname, as the sentences call them (voice.js:
    // bare of "(b. 1981)"; a name also in its own script, its whole Latin
    // name); anything else by its title.
    var name = title;
    if (a.kind === "life" && !d.born) {
      var bare = title.replace(/\s*\([^)]*\)\s*$/, "").trim(), east = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/;
      var w = bare.split(/\s+/).filter(function (x) { return x && !east.test(x); }), k = w.length - 1;
      if (east.test(bare) || k < 0) { name = w.join(" ") || bare; }
      else {
        while (k > 0 && /^(de|van|von|da|di|del|der|le|la|du|ter|ten)$/i.test(w[k - 1])) { k -= 1; }
        name = w.slice(k).join(" ");
      }
    }
    return { to: to, name: name, go: go };
  }

  /* One level up from where you are: from a collage's site pressed on a
     reading's grown globe, the reading; from a museum (or the theatre), its
     city, unless the city is only that museum; from a work's history opened
     in a museum or a city, that museum or city; else nothing, the world. */
  function levelUp() {
    if (!place) { return null; }
    if (readingBack && readingBack.to === place) { return { name: readingBack.name, go: readingBack.go }; }
    var home = (place.museum || place.stage) && towns && townBy[place.townKey];
    if (home) {
      return home.pass ? null : { name: home.name, go: function () { openTown(home.key, { museum: place.slug }); } };
    }
    var via = place.art && place.art.kind === "work" && place.art.via;
    var mc = via && via.museum && via.museum.slug && cityOf(via.museum.slug);
    if (mc && mc.museum) {
      return { name: shortName(mc.museum), go: function () { openMuseum(mc.slug, {}); } };
    }
    var t = via && via.place && towns && townBy[via.place];
    if (t) {
      return { name: t.name, go: t.pass ? function () { openMuseum(t.museums[0], {}); } : function () { openTown(t.key, {}); } };
    }
    return null;
  }

  function comeUp(all) {
    if (walkOn) { if (all === true) { walkClose("all"); } else { window.Walk.up(); } return; }
    if (flying || !place) { return; }
    if (route) { endRoute(); }
    artAsked = null;                // a view still being read is not flown to after you have left
    // One level at a time: up from a museum (or the theatre) is its city,
    // and up from a city is the world. A city that is only its museum is
    // passed through both ways.
    var up = !groundOn && levelUp();
    if (up) { up.go(); return; }
    // Up to the world: following an animal ends here (characters.js).
    if (following) { endFollowing(true); }
    comeUpFromGround();
    stopTheatre();
    stopBuilding();
    stopArt();
    goingUp = true;
    hopFrom = null;
    hold();                         // the walk stops where it is
    hideGraze();
    hereShown = false;
    dealHere();
    // Back out to the part of the world you were looking at when you went in.
    leanFrom = tilt;
    leanTo = leanWas;
    // The same face of the world you were looking at before you went down.
    wanted = spinWas;
    flyFrom = zoom;
    flyTo = 1;
    planFlight("up");
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
    passage(oneOf(["edges", "center", "rows"]), [LIGHT, LILAC, cityTone(place)], fly.dur * 0.9);
  }

  function arrive() {
    land.dataset.at = "city";
    // The globe's marks are not shown in a place: hidden, so none is tabbed
    // to unseen. A city of museums places its own (placeTown).
    cities.forEach(function (c) { if (c.el && !c.el.dataset.in) { hideMark(c); } });
    var seatX = place.seatAt ? place.seatAt.x * W : W / 2, seatY = place.seatAt ? place.seatAt.y * H : H * 0.62;
    pulse(seatX, seatY, [cityTone(place), LIGHT], 0.8, Math.max(W, H) * INV);
    banner.hidden = false;
    bannerCity.textContent = place.title;
    bannerCity.setAttribute("aria-label", place.title);   // its name, while the letters settle
    bannerUnder.textContent = place.where || "";
    bannerCity.disabled = !place.work;
    // The way back is one level up: a museum's city, unless the city is
    // only that museum; everywhere else, the world.
    var up = levelUp();
    if (bannerBackTo) { bannerBackTo.textContent = backName(up); }
    scramble(bannerCity, "decode", 120, 760);
    scramble(bannerUnder, "type", 380, 640);
    creature.hidden = !CREATURE;

    beast.lat = goal.lat = place.lat;
    beast.lon = goal.lon = place.lon;

    // The creature keeps to this work's own things: what it finds underfoot
    // here are the objects that collage is made of, and nothing else. An art
    // view is not a city: the whole world stays woven. A city of museums is.
    weave(groundHere());

    // Whatever is built here is built once and stays built.
    if (place.piece && !place.stage && !spawns.some(function (born) {
      return born.kind === "house" && born.home === place.slug;
    })) {
      houseFor(place);
    }

    place.terms = termsOf(place);
    if (CREATURE) {
      if (place.terms.length) { standOn(place.terms[0]); }
      creature.dataset.grazing = "true";
      resume();
    }

    // And the collage this place is, laid out beside whatever is going on,
    // once the creature has been put down and it is known where that is.
    if (place.work) {
      window.setTimeout(function () { if (place && !flying) { showHere(true); } }, 90);
    }
    if (place.stage) { startTheatre(); }
    if (place.archive) { startArchive(); }
    if (place.building) { startBuilding(place); }
    if (place.art) {
      land.dataset.art = place.art.kind;
      startArt(place);
    }
  }

  function leave() {
    stopTheatre();
    stopArchive();
    stopBuilding();
    stopArt();
    delete land.dataset.art;
    endScene();
    hold();
    // Whatever was standing in that city stays in it. placeSpawns stops
    // being called the moment we are off the ground, so they are put away
    // here rather than left showing at wherever they last stood.
    spawns.forEach(function (born) { born.el.style.visibility = "hidden"; });
    place = null;
    weave();
    creature.hidden = true;
    banner.hidden = true;
    land.dataset.at = "globe";
    showHere(false);
    grownOff();
    readingBack = null;
    // A layer chosen in a reading was the reading's: up at the world, the viewer's own comes back.
    cameLayer = null;
    if (layerOn !== layerKept) {
      layerOn = layerKept;
      filterGlobe();
      museumsLayer();
      studiosLayer();
    }
    measureSafe();                  // the pills are there to be measured again
    // How you got here, drawn once on the way out (the walk).
    if (artWalk.length > 1) { drawWalkOnce(); }
  }

  /* Which of the words on the globe are things this collage is made of. A
     place that is not a collage — the library — has all of them. */
  function termsOf(city) {
    var want = (city.work && city.work.terms) || [];
    var out = [];
    vocabulary.forEach(function (ground, i) {
      if (want.indexOf(ground.word) !== -1) { out.push(i); }
    });
    return out.length ? out : vocabulary.map(function (g, i) { return i; });
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

          // Who gives way. Splitting every correction down the middle meant
          // a word in all seven collages was shoved about by one that turns
          // up once, and with the sizes now eleven times apart the big ones
          // could not find room at all. The heavier word barely moves and the
          // light one goes round it, which is also the right hierarchy to
          // look at: the world is mostly made of a few things.
          var heftA = 1 + a.mass * 3;
          var heftB = 1 + b.mass * 3;
          var giveA = 2 * heftB / (heftA + heftB);
          var giveB = 2 * heftA / (heftA + heftB);

          shifted = true;
          if (intoX / wantX < intoY / wantY) {
            var sideways = (byLon >= 0 ? 1 : -1) * intoX * 0.25 / squeeze;
            a.lon += sideways * giveA;
            b.lon -= sideways * giveB;
          } else {
            var updown = (byLat >= 0 ? 1 : -1) * intoY * 0.25;
            a.lat += updown * giveA;
            b.lat -= updown * giveB;
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
    // The lean is not taken from the lean the world happens to have. It is
    // taken from the one it rests at, always. A word lying on the surface
    // ought to follow the surface, and it does — but the amount of the tip
    // that shows in it is proportional to the sine of the lean, so rolling
    // the world south to stand in Washington flattened every word on it.
    // The leaning is the point, so the words keep it at every latitude.
    var ty = -sinA * LEAN_LOOK;

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

  /* Where the sphere sits and how big it is, for whatever height we are at.
     At the globe its contour meets the sides of the screen at the golden
     section; in a city the point you came down to is a little below the
     middle, and everything between the two is a straight run from one
     framing to the other so the flight has no corner in it. */
  /* Where the globe sits, and how big it is, is dealt once each time the
     page is opened: a size between 1/phi and the square root of phi of the
     one it was designed at, and a nudge off centre of up to half of
     1/phi-cubed of the window either way. Down in a city the framing is the
     city's, and the nudge is flown out of on the way down. */
  /* How near the Earth is. It is dealt from a wide range — from
     1/phi-to-the-fourth of the size it was designed at, a small world far
     off in the sky, to the square root of phi, a horizon wider than the
     window — evenly on a logarithmic scale, so far and near come up as
     often as each other. And it does not stay put: every so often, while
     nobody is doing anything, it swings to another distance (see swing). */
  var SIZE_FAR = Math.pow(INV, 4);          // 0.146
  var SIZE_NEAR = Math.sqrt(PHI);           // 1.272
  var base0 = 1;                            // the designed radius, for this window

  function dealSeat() {
    var lo = Math.log(SIZE_FAR), hi = Math.log(SIZE_NEAR);
    var size = Math.exp(lo + Math.random() * (hi - lo));
    // A small world can wander further across the sky than a big one.
    var roam = size < INV ? INV2 : INV3;
    return {
      size: size,
      dx: (Math.random() - 0.5) * roam,
      dy: (Math.random() - 0.5) * roam
    };
  }

  var seat = dealSeat();

  /* Where the middle of the globe sits, up and down, for a given radius
     when it is not nudged: a big globe is set so its contour meets the
     sides of the window at the golden section, and a small one simply
     hangs in the middle of the sky. The one gives way to the other where
     they meet, so there is no jump between them. */
  function orbitFor(r) {
    var half = W / 2;
    var flank = Math.sqrt(Math.max(1, r * r - half * half));
    return Math.max(H * 0.5, H * (1 - 1 / PHI) + flank);
  }

  function reframe() {
    R = baseR * zoom;
    var down = Math.max(0, Math.min(1, (zoom - 1) / Math.max(0.001, CITY_ZOOM - 1)));
    var half = W / 2;
    // Where the place is held on the screen: a city a little below the
    // middle; an art view in the band beside its column (seatAt), at a
    // height that may be above or below the globe's own, so the way there is
    // measured by the flight (flyK), not by the zoom.
    var gx = half, gy = H * 0.62;
    if (place && place.seatAt) {
      down = flyK;
      gx = place.seatAt.x * W;
      gy = place.seatAt.y * H;
    } else if (hopFrom) {
      down = flyK;
    }
    cx = half + seat.dx * W * (1 - down);
    var orbit = orbitFor(R) + seat.dy * H;
    // Where the city is, at the lean we have now: dead centre once the lean
    // has arrived at its latitude, and travelling there smoothly before.
    var ground = gy + Math.sin(focus.lat - tilt) * R;
    if (hopFrom) {
      // From one place to the next: from where the last one was held.
      cx = hopFrom.x + (gx - hopFrom.x) * down;
      cy = hopFrom.y + (ground - hopFrom.y) * down;
      return;
    }
    cx += (gx - half) * down;
    cy = orbit + (ground - orbit) * down;
  }

  function geometry() {
    // Every pixel the screen has, up to three to one — a phone's full
    // density, and a 4K monitor's at two. It used to stop at two.
    W = stage.clientWidth;
    dpr = densityNow();
    H = stage.clientHeight;

    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // A wider sphere, set so its contour meets the left and right edges of
    // the screen at the golden section — 1/φ of the way up, 0.618 — which is
    // what gives the words their room: the visible surface goes up by about
    // half again even though the band of latitudes on it is shallower.
    base0 = Math.max(W * 0.90, H * 0.70, 240);
    baseR = base0 * seat.size;
    cx = W / 2;

    // Everything below this latitude is under the bottom of the screen. The
    // projection makes it exact: a point is at height (cy - y) / R when
    // sin(lat - tilt) equals it, so the lowest latitude worth placing a word
    // on is the tilt plus that arcsine, with a little margin. Worked out at
    // the globe's own framing whatever height the view happens to be flown
    // to, because the band is where the words live and the words are the
    // globe's.
    // Worked out for the globe at the size it was designed at, whatever size
    // it happens to be now: the words have one band to live in, and it does
    // not move every time the world comes nearer or goes further off.
    var flank = Math.sqrt(Math.max(1, base0 * base0 - cx * cx));
    // At the resting lean, whatever the world is leaning at now.
    // Kept above a little way south of the lean even when the globe is
    // dealt small enough for all of its face to be on the screen, or the
    // words would be sent to the far south to fill it.
    var sunk = Math.max(-INV, Math.min(1,
      (H * (1 - 1 / PHI) + flank - H) / base0));
    LAT_LOW = TILT + Math.asin(sunk) + 2 * RAD;

    // And a band of the same width above it — twenty-seven degrees, which is
    // what fills the window. It used to run to a fixed seventy-six degrees,
    // which was the right top while the world rested tipped well over; now
    // that it rests looking at the latitudes his places are in, a band up to
    // the pole would spread twenty-six words over twice the ground and leave
    // eight of them on the screen instead of sixteen.
    LAT_TOP = LAT_LOW + 27 * RAD;

    reframe();

    // Type scales with the world, so a phone gets a legible globe. Which
    // face and how big relative to the rest is the word's own business.
    fit = 1;
    dressAll();          // at full size, to find out how much room they want
    fit = fitToBand();   // then all of them down by however much it takes
    dressAll();
    relax();
    found();
    remass();
    // Down in a city of museums, it is framed again for the new window.
    if (place && place.art && place.art.kind === "town" && !flying) {
      var f = townFrame(place.art.town);
      zoom = f.zoomTo;
      place.seatAt = f.seatAt;
      reframe();
    }
    weave(groundHere());
    measureSafe();
  }

  /* The ground under a place, woven close: a city, a building, a museum or
     a city of museums; an art view is the whole world. */
  function groundHere() {
    return place && (!place.art || place.art.kind === "town") ? { lat: place.lat, lon: place.lon } : null;
  }

  /* ---- how a word is dressed --------------------------------------------- */

  /* Every word wears a face of its own, given once and kept. Its size is not
     a matter of taste: it is how many of the collages that object turns up in,
     so the world reads as what the works are made of most. */
  function dress(ground) {
    if (!ground.el) { return; }
    ground.pw = 0;                     // measured again next time it is placed
    // How many collages carry the object decides how big its word is. The
    // curve is flattened a little so the one-off things — the joker, the
    // pull tab — are still legible rather than specks.
    // Measured against the screen, not against the sphere. Tied to R, widening
    // the globe simply scaled the words up with it and bought no room at all —
    // they went to 123px and the collisions trebled. Against the screen, a
    // wider globe is exactly what it should be: more surface, same type.
    // The scale is φ⁵ end to end now, not φ³: the word carried by all seven
    // collages is eleven times the size of one carried by a single collage.
    // With half as many words on the world there is the room for it, and the
    // difference between a thing the work is made of and a thing that happens
    // to be in it should be the difference between a headline and a footnote.
    var smallest = Math.min(W, H) / 52;
    var size = smallest * Math.pow(PHI, ground.mass * 5) * fit;

    // And a face of its own, up a ladder from quiet to loud. One family in
    // five weights was legible and dull; five faces read as five different
    // kinds of voice, and which voice a word gets is not a roll — it is how
    // much of the work that object is.
    var rung = FACES[Math.min(FACES.length - 1,
                              Math.round(ground.mass * (FACES.length - 1)))];

    ground.el.style.fontFamily = rung.face;
    ground.el.style.fontWeight = String(rung.weight);
    ground.el.style.fontStyle = rung.slant || "normal";
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

  function palette() { return worn; }

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
        var sz = Math.max(2, Math.round(m.size));
        ctx.fillRect(Math.round(m.x), Math.round(m.y - m.h), sz, sz);
      });
    });

    ctx.globalAlpha = 1;
  }

  /* ---- the tiles ------------------------------------------------------------

     Pixel light, after the Ultracode band. Behind everything that stands on
     the world there is a grid of square tiles — thirteen pixels a cell, the
     Fibonacci number the spacing is built on, eleven of them lit and two
     left dark, so the gaps are always there — that nobody sees until
     something happens. Then the tiles light up round it and the light
     rolls outward in waves: a square blob first, then a front that travels
     with a ragged, stair-stepped edge, brightest at the leading edge and
     dying away behind, and two echoes after it, each 1/phi of the one
     before. Brightness comes in four steps, never in between, and the waves
     move in held frames, twenty-four to the second, the way a sprite does.

     Everything that used to happen smoothly now also lands like this: going
     down into a city, arriving, opening a word, tapping the sky, firing a
     small world, the creature turning a photograph up and putting it on,
     things coming up out of the ground and being fed, the squash. And while
     the creature grazes it keeps a slow beat of its own. */

  var tilesCanvas = document.getElementById("tiles");
  var tilesCtx = tilesCanvas.getContext("2d");
  var tilesHome = tilesCanvas;          // the light's own canvas; the walk lends another (lightInto)
  var CELL_PX = 13;                     // not TILE: that is the creature's iso unit
  var LIGHT = "#5e52c7";                // the default light: Ultracode's lavender
  var LEVELS = [0, 0.16, 0.3, 0.46, 0.64];
  var waves = [];
  var ringNow = null;          // the squash ring while it is held open
  var tilesDirty = false;
  var notes = [];
  var lastBeat = 0;

  function hash2(i, j) {
    var n = (i * 73856093) ^ (j * 19349663);
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) % 1024 / 1024;
  }

  /* Light going out from a point, in the colours given, three rings deep. */
  function pulse(x, y, tones, strength, reach) {
    if (still || !isFinite(x) || !isFinite(y)) { return; }
    tones = (tones && tones.length) ? tones : [LIGHT];
    strength = strength === undefined ? 1 : strength;
    reach = reach || Math.max(W, H) * INV2;
    var now = performance.now();
    [1, INV, INV2].forEach(function (k, i) {
      waves.push({
        x: x, y: y, at: now + i * 110,
        tone: tones[i % tones.length],
        strength: strength * k,
        reach: reach * (1 - i * 0.12),
        speed: reach / (FLY * 0.9)            // pixels a millisecond
      });
    });
    if (waves.length > 36) { waves.splice(0, waves.length - 36); }
  }

  /* Sparks and notes: the square sparks fly out and fall, the notes float
     up and drift, both in the colours given. */
  var GLYPHS = [
    ["...##.", "...#.#", "...#..", "...#..", ".###..", "####..", ".##..."],
    [".#####", ".#...#", ".#...#", ".#...#", "##..##", "##..##"]
  ];

  function sparkle(x, y, tones, count) {
    if (still || !isFinite(x) || !isFinite(y)) { return; }
    tones = (tones && tones.length) ? tones : [LIGHT];
    kick(x, y, tones, count || 14, 5.5, 2.6);
    var n = Math.max(1, Math.round((count || 14) / 7));
    for (var i = 0; i < n; i += 1) {
      notes.push({
        x: x + (Math.random() - 0.5) * 30, y: y - 10 - Math.random() * 12,
        vx: (Math.random() - 0.5) * 0.5, vy: -(0.55 + Math.random() * 0.45),
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
        tone: tones[Math.floor(Math.random() * tones.length)],
        life: 1, at: performance.now() + i * 90
      });
    }
    if (notes.length > 24) { notes.splice(0, notes.length - 24); }
  }

  function drawTiles(now) {
    // On the walk's canvas (lightInto) the grid is still the screen's.
    var box = tilesCanvas === tilesHome ? null : tilesCanvas.getBoundingClientRect();
    var pw = Math.round((box ? box.width : W) * dpr), ph = Math.round((box ? box.height : H) * dpr);
    if (tilesCanvas.width !== pw || tilesCanvas.height !== ph) {
      tilesCanvas.width = pw; tilesCanvas.height = ph; tilesDirty = true;
    }
    if (!waves.length && !notes.length && !trail.length && !tilesDirty &&
        !(art && art.dirty) && !(passing && passing.legs) && !walkShown && !route) { return; }
    var g = tilesCtx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pw, ph);
    g.setTransform(dpr, 0, 0, dpr, box ? -box.left * dpr : 0, box ? -box.top * dpr : 0);
    tilesDirty = false;

    // Held frames: the light moves twenty-four times a second, not sixty.
    var t = Math.floor(now / 42) * 42;
    var runs = {};
    var cols = Math.ceil(W / CELL_PX), rows = Math.ceil(H / CELL_PX);

    for (var k = waves.length - 1; k >= 0; k -= 1) {
      var w = waves[k];
      var age = t - w.at;
      if (age < 0) { continue; }
      var life = w.reach / w.speed;
      if (age > life) { waves.splice(k, 1); continue; }
      var fade = 1 - age / life;
      var r = age * w.speed;
      var band = CELL_PX * 3.2;
      var blob = age < 150 ? CELL_PX * 3.4 : 0;      // the square it starts as
      var span = r + CELL_PX * 2;
      var i0 = Math.max(0, Math.floor((w.x - span) / CELL_PX));
      var i1 = Math.min(cols - 1, Math.ceil((w.x + span) / CELL_PX));
      var j0 = Math.max(0, Math.floor((w.y - span) / CELL_PX));
      var j1 = Math.min(rows - 1, Math.ceil((w.y + span) / CELL_PX));
      for (var j = j0; j <= j1; j += 1) {
        for (var i = i0; i <= i1; i += 1) {
          var dx = Math.abs(i * CELL_PX + CELL_PX / 2 - w.x);
          var dy = Math.abs(j * CELL_PX + CELL_PX / 2 - w.y);
          // A square that has had its corners knocked off, and a ragged edge.
          var d = 0.72 * Math.max(dx, dy) + 0.28 * Math.sqrt(dx * dx + dy * dy) +
                  (hash2(i, j) - 0.5) * CELL_PX * 1.3;
          var lit = 0;
          if (d < blob) { lit = 1; }
          var front = r - d;
          if (front >= 0 && front < band) { lit = Math.max(lit, 1 - front / band); }
          if (!lit) { continue; }
          var level = Math.ceil(lit * w.strength * fade * 4);
          if (level < 1) { continue; }
          if (level > 4) { level = 4; }
          var key = w.tone + "|" + level;
          (runs[key] || (runs[key] = [])).push(i, j);
        }
      }
    }

    // A history's journey, in the same light (the journey, below).
    if (art || passing || walkShown) { drawJourney(runs, t); }
    if (route) { routeRuns(runs, t); }

    Object.keys(runs).forEach(function (key) {
      var cut = key.lastIndexOf("|");
      g.fillStyle = key.slice(0, cut);
      g.globalAlpha = LEVELS[Number(key.slice(cut + 1))];
      var run = runs[key];
      for (var n = 0; n < run.length; n += 2) {
        g.fillRect(run[n] * CELL_PX + 1, run[n + 1] * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
      }
    });

    // The squash ring, held open, as a ring of tiles that shimmers.
    if (ringNow) {
      var rg = ringNow;
      var ri0 = Math.max(0, Math.floor((rg.x - rg.r - CELL_PX) / CELL_PX));
      var ri1 = Math.min(cols - 1, Math.ceil((rg.x + rg.r + CELL_PX) / CELL_PX));
      var rj0 = Math.max(0, Math.floor((rg.y - rg.r - CELL_PX) / CELL_PX));
      var rj1 = Math.min(rows - 1, Math.ceil((rg.y + rg.r + CELL_PX) / CELL_PX));
      var flick = Math.floor(t / 84) % 2;
      g.fillStyle = LIGHT;
      for (var rj = rj0; rj <= rj1; rj += 1) {
        for (var ri = ri0; ri <= ri1; ri += 1) {
          var ex = ri * CELL_PX + CELL_PX / 2 - rg.x, ey = rj * CELL_PX + CELL_PX / 2 - rg.y;
          var off = Math.abs(Math.sqrt(ex * ex + ey * ey) - rg.r);
          if (off > CELL_PX * 0.75) { continue; }
          g.globalAlpha = LEVELS[((ri + rj + flick) % 2) ? 4 : 2];
          g.fillRect(ri * CELL_PX + 1, rj * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
        }
      }
    }

    if (art) { drawStops(g, t); }
    drawTrail(g, t);

    // The notes, in held frames, on a two-pixel grid.
    for (var q = notes.length - 1; q >= 0; q -= 1) {
      var o = notes[q];
      var a = t - o.at;
      if (a < 0) { continue; }
      var left = 1 - a / 1300;
      if (left <= 0) { notes.splice(q, 1); continue; }
      var nx = Math.round((o.x + o.vx * a / 16 + Math.sin(a / 260) * 4) / 2) * 2;
      var ny = Math.round((o.y + o.vy * a / 16) / 2) * 2;
      g.fillStyle = o.tone;
      g.globalAlpha = Math.min(1, LEVELS[Math.max(1, Math.ceil(left * 4))] * 1.5);
      o.glyph.forEach(function (row, yy) {
        for (var xx = 0; xx < row.length; xx += 1) {
          if (row.charAt(xx) === "#") { g.fillRect(nx + xx * 2, ny + yy * 2, 2, 2); }
        }
      });
    }
    g.globalAlpha = 1;
    tilesDirty = waves.length > 0 || notes.length > 0 || !!ringNow ||
                 !!(art && (art.playing || art.moving || art.anim)) ||
                 !!walkShown || !!(passing && passing.legs);
  }

  /* The creature's own beat, while it grazes: every phi-squared seconds a
     small pulse in the colours it is wearing, like the strum it is. */
  function beatOf(now) {
    if (!place || flying || still || !creature.dataset.grazing) { return; }
    if (now - lastBeat < Math.pow(PHI, 2) * 1000) { return; }
    lastBeat = now;
    var r = creature.getBoundingClientRect();
    if (!r.width) { return; }
    pulse(r.left + r.width / 2, r.top + r.height * 0.6, palette(), 0.42, Math.max(W, H) * INV3);
  }

  function beastAt() {
    var r = creature.getBoundingClientRect();
    // Its head: where the notes come off, clear of its body, which stands
    // over the light and would hide anything that started inside it.
    var right = creature.dataset.facing !== "left";
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, ok: r.width > 0,
             hx: r.left + r.width * (right ? 0.86 : 0.14), hy: r.top + r.height * 0.12 };
  }

  function cityTone(city) {
    if (city && city.tone) { return city.tone; }      // an art view: the work's own colour
    return rgbHex(fromHsl(city && city.hue !== undefined ? city.hue : 0.7, 0.55, 0.42));
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

  /* ---- the weave -----------------------------------------------------------

     The surface of the world is a field of dots, after Dorothy Napangardi.

     Her salt paintings — Mina Mina, the country she painted her whole life —
     are built entirely out of fine dots laid in strands: two families of
     lines crossing, gathering into ridges where they converge, parting to
     leave dark blocks between them, so that a flat canvas reads as a salt pan
     seen from above and shimmers as you move past it. Nothing in them is a
     shape filled in. Everything is the dots, and the spaces the dots leave.

     That is a way of making a surface out of exactly what this page is
     already made of, so the sphere is woven now rather than shaded. Two
     families of strands run over it, one down and one round, each warped so
     they gather and part; runs of dots are dropped to leave the dark blocks;
     and where a strand crosses a landmass it takes that mass's colour and
     sits heavier, so the land is a thickening in the weave instead of a wash
     laid over it. A pale dot among the dark ones every so often is what makes
     it glitter when the world turns.

     This is her way of building a surface, used on our own material. The
     designs are hers and her country's, and none of them are here.

     A hundred and thirty thousand dots is too many to hold as objects and far
     too many to run trigonometry over. Every dot's sine and cosine are worked
     out once, into typed arrays, and the turn of the world is then a pair of
     multiplications each — no trigonometry per dot, per frame, ever. And
     because the weave depends only on which way the world is facing, not on
     where the light is, it keeps its own surface and is redrawn only when the
     world is actually turned. */

  /* ---- the Earth ----------------------------------------------------------

     The globe is the Earth. Its shape comes from Natural Earth's 110m
     coastlines, rasterised by scripts/build_earth.py into a bitmap of land
     and sea — 512 by 256, about three quarters of a degree a cell — because
     a hundred and thirty thousand dots cannot each be tested against a
     hundred coastline polygons every time the world is turned. Its colour
     still comes from the artist's works, as everything on here does: the
     form is the Earth's, the palette is his.

     Land is not a flat fill either. Every dot knows how far inland it is,
     counted out of the mask when the weave is made, so the strands thicken
     from the coast inward the way density does in a salt painting — the
     middle of Asia is dense, an island is a thread. */

  var earth = null;              // { w, h, bits } once it has loaded
  var earthBits = null;

  var earthOwner = null;         // a continent number per cell, 0 at sea
  var continents = [];           // biggest first

  function readEarth(data) {
    earth = data;
    var raw = window.atob(data.bits);
    earthBits = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i += 1) { earthBits[i] = raw.charCodeAt(i); }
    mapLands();
  }

  function onLand(lat, lon) {
    if (!earthBits) { return 0; }
    // The mask starts at the date line (180 W), not at Greenwich. Reading
    // it from Greenwich put every continent half a world away from where it
    // is — Washington was standing on China — so longitude is taken from
    // 180 W here, as the mask was written.
    var x = Math.floor((wrap(lon) + Math.PI) / TAU * earth.w) % earth.w;
    var y = Math.floor((Math.PI / 2 - lat) / Math.PI * earth.h);
    if (x < 0) { x += earth.w; }
    if (y < 0) { y = 0; }
    if (y >= earth.h) { y = earth.h - 1; }
    var i = y * earth.w + x;
    return (earthBits[i >> 3] >> (i & 7)) & 1;
  }

  /* Which land is which. The mask says land or sea; this says Africa. Every
     run of land joined to itself is one continent, found by flooding out
     from each cell that has not been claimed yet — the map wraps at the
     date line, so the flood does too, or Chukotka and Alaska would be two
     halves of nothing.

     What it is for: a continent is one of his collages. Not the nearest
     work to a dot, which was what the land wore before and which bled one
     work's colour across a strait into another's; a whole landmass, coast
     to coast, in the colours of one work. */
  function mapLands() {
    var w = earth.w, h = earth.h, n = w * h;
    earthOwner = new Uint8Array(n);
    continents = [];

    var stack = new Int32Array(n);
    var cellLat = new Float64Array(h);
    var cellCos = new Float64Array(h);
    for (var y = 0; y < h; y += 1) {
      cellLat[y] = Math.PI / 2 - (y + 0.5) / h * Math.PI;
      cellCos[y] = Math.cos(cellLat[y]);
    }

    var id = 0;
    for (var start = 0; start < n; start += 1) {
      if (!(earthBits[start >> 3] >> (start & 7) & 1)) { continue; }
      if (earthOwner[start]) { continue; }
      if (id >= 250) { break; }          // the array only holds so many
      id += 1;

      var top = 0;
      stack[top] = start;
      top += 1;
      earthOwner[start] = id;

      var cells = 0, area = 0, sx = 0, sy = 0, sz = 0;
      while (top) {
        top -= 1;
        var at = stack[top];
        var ay = (at / w) | 0;
        var ax = at - ay * w;
        var lat = cellLat[ay];
        var lon = (ax + 0.5) / w * TAU - Math.PI;     // from 180 W
        cells += 1;
        area += cellCos[ay];
        // Summed as points on the sphere, so the wrap takes care of itself.
        sx += cellCos[ay] * Math.cos(lon);
        sy += cellCos[ay] * Math.sin(lon);
        sz += Math.sin(lat);

        for (var side = 0; side < 4; side += 1) {
          var nx = ax + (side === 0 ? 1 : side === 1 ? -1 : 0);
          var ny = ay + (side === 2 ? 1 : side === 3 ? -1 : 0);
          if (ny < 0 || ny >= h) { continue; }
          if (nx < 0) { nx = w - 1; } else if (nx >= w) { nx = 0; }
          var to = ny * w + nx;
          if (earthOwner[to]) { continue; }
          if (!(earthBits[to >> 3] >> (to & 7) & 1)) { continue; }
          earthOwner[to] = id;
          stack[top] = to;
          top += 1;
        }
      }

      var len = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      // Its area on the sphere, turned into the radius of a circle of the
      // same size — near enough for a wash of colour underneath it.
      var steres = area * (TAU / w) * (Math.PI / h);
      continents.push({
        id: id,
        cells: cells,
        lat: Math.asin(Math.max(-1, Math.min(1, sz / len))),
        lon: wrap(Math.atan2(sy, sx)),
        size: Math.min(0.62, Math.sin(Math.sqrt(steres / Math.PI)))
      });
    }

    continents.sort(function (a, b) { return b.cells - a.cells; });
  }

  function ownerAt(lat, lon) {
    if (!earthOwner) { return 0; }
    // The mask starts at the date line (180 W), not at Greenwich. Reading
    // it from Greenwich put every continent half a world away from where it
    // is — Washington was standing on China — so longitude is taken from
    // 180 W here, as the mask was written.
    var x = Math.floor((wrap(lon) + Math.PI) / TAU * earth.w) % earth.w;
    var y = Math.floor((Math.PI / 2 - lat) / Math.PI * earth.h);
    if (x < 0) { x += earth.w; }
    if (y < 0) { y = 0; }
    if (y >= earth.h) { y = earth.h - 1; }
    return earthOwner[y * earth.w + x];
  }


  /* How far into the land a point is: nought at sea, one well inland. Counted
     by looking outward in rings rather than by a proper distance transform,
     which is plenty at this size and costs nothing to write. */
  function inland(lat, lon) {
    if (!onLand(lat, lon)) { return 0; }
    var step = Math.PI / 256;              // three quarters of a degree, whatever the mask
    var hits = 0;
    var tries = 0;
    for (var ring = 1; ring <= 3; ring += 1) {
      for (var a = 0; a < 8; a += 1) {
        var th = a / 8 * TAU;
        var dlat = Math.cos(th) * step * ring * 2;
        var dlon = Math.sin(th) * step * ring * 2 /
                   Math.max(0.2, Math.cos(lat));
        tries += 1;
        hits += onLand(lat + dlat, lon + dlon);
      }
    }
    return tries ? hits / tries : 0;
  }

  // Water. Near enough to ink to stay out of the way, far enough into blue
  // to be water rather than a shadow.
  var SEA = fromHsl(0.575, 0.26, 0.21).join(",");

  var wSinLat = null, wCosLat = null, wSinLon = null, wCosLon = null;
  var wSalt = null, wTone = null, wGain = null;
  var wCount = 0;
  var wTones = [];

  /* ---- DIRT ---------------------------------------------------------------

     The land is DIRT — the collection soil made in its own session, where
     every clod is one saved painting in one of its three dominant colours,
     woven in this same dot hand. The sea is the same thing made again for
     water, out of the blues of the saved paintings. scripts/build_dirt.py
     writes both as a picture one pixel a cell: its colour the dot's colour,
     its alpha the dot's size, nothing where the soil leaves a gap.

     The weave decides where anything is seen at all. A dot of the weave
     that falls on land looks up the soil under it and wears that cell —
     colour, size, or nothing if the soil has a gap there — and a dot at sea
     does the same with the sea. So the soil is only ever visible through
     the threads: the silk is the transparency, and DIRT is what shows
     through it. */

  /* The globe is DIRT Earth's globe. Every dot of it wears what DIRT Earth
     dresses that place in this month: the paintings nearest the place's own
     colours (its biome, its soil, its season, snow and sea ice), from
     earth-dirt/earth-dirt-MM.png, half a degree a cell, colour and dot size.
     Close to, in a city, the dots are the fine tile's and each is dressed in
     its place's palette as DIRT Earth dresses its ground
     (earth-palette-MM.png: the dark, middle and light colour of every place,
     one band each). Going down further is DIRT Earth itself (dirt/). */
  var dirt = { land: null, sea: null, earth: null, pal: null };
  /* And it looks as DIRT Earth's globe does: an opaque globe of woven dots
     in each place's colours, lit from one side, on DIRT's near-black ground,
     with no glass over it. Everything that stands on it (the words, the
     places the collages are in, the buildings, the telescope, the weather)
     is as it was. DIRT_LOOK off is the pale glass globe of before. */
  var DIRT_LOOK = true;
  if (DIRT_LOOK) { document.documentElement.classList.add("dirt-look"); }
  var MONTH = ("0" + (new Date().getMonth() + 1)).slice(-2);
  var DIRT_ROUND = 2;          // the tile goes round the world twice…
  var DIRT_DOWN = 1;           // …and once from pole to pole

  function readTile(url) {
    return new Promise(function (done) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        var x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(img, 0, 0);
        done({ n: c.width, h: c.height, px: x.getImageData(0, 0, c.width, c.height).data });
      };
      // Without it the world is still woven, in the colours it had before.
      img.onerror = function () { done(null); };
      img.src = url;
    });
  }

  function cellOf(n, a) { return ((Math.floor(a) % n) + n) % n; }

  var wInk = null, wSize = null;
  var wInks = [];              // "r,g,b" for every colour the soil uses
  var wSplit = 0;              // where the strands down end and the round begin

  // Two surfaces, one for each family of threads, so each can be seen
  // through by its own amount.
  var cloth = document.createElement("canvas");
  var wctx = cloth.getContext("2d");
  var cloth2 = document.createElement("canvas");
  var wctx2 = cloth2.getContext("2d");
  var woven = { spin: null, w: 0, h: 0, r: 0 };

  /* The whole world, or one patch of it.

     Magnifying the world's own weave seven times turned the ground of a city
     into confetti: the same dots, seven times further apart and seven times
     bigger. So a city gets a weave of its own — the same cloth, woven over
     the patch of ground you can actually see, with every angle in it divided
     by how far down you are. A strand is then the same width on the screen,
     meanders the same distance and lies the same distance from its
     neighbour as it does up on the globe. It is not a different surface; it
     is the same surface, close to. */
  function weave(at, opts) {
    // Over the body of works (earth-body.js) every cell is already one
    // painting's clod, and a door: the dots woven over it said nothing more,
    // so there are none, and nothing to weave.
    if (bodyOn()) { woven.spin = null; return; }
    var lat = [];
    var lon = [];
    var salt = [];

    var rnd = seedFrom("mina mina", 3);

    var k = at ? 1 / zoom : 1;                 // every angle, at this height
    // The patch is what can be seen: a city of museums is framed far closer
    // than a collage's city, and its patch is as much smaller. It reaches
    // every corner of the window from where the place is held, so no edge of
    // it is ever in view; a wider patch is given more threads, up to half
    // again, so it keeps most of its closeness.
    var spanLat = 0, dense = 1;
    if (at) {
      var held = project(at.lat, at.lon);
      var reach = 0;
      [[0, 0], [W, 0], [0, H], [W, H]].forEach(function (c) {
        reach = Math.max(reach, Math.sqrt((c[0] - held.x) * (c[0] - held.x) + (c[1] - held.y) * (c[1] - held.y)));
      });
      var close = 0.115 * CITY_ZOOM / Math.max(CITY_ZOOM, zoom);
      spanLat = Math.min(1.3, Math.max(close, (opts && opts.margin || 1.12) * reach / Math.max(1, R)));
      dense = Math.min(1.45, spanLat / close) * (opts && opts.loose ? 0.72 : 1);
      woven.span = spanLat;
    }
    var spanLon = at ? Math.min(Math.PI, spanLat / Math.max(0.2, Math.cos(at.lat))) : 0;

    // Strands running down the world. Even steps in latitude are even steps
    // along the surface, so these keep their spacing wherever they fall.
    // Half again and more: phi times the threads of before, because the
    // globe is phi times more see-through than it was (see the patches), so
    // there is as much more of the land and sea as there is less of each dot.
    var strands = Math.round((at ? 150 * dense : 420) * PHI);
    var down = at ? Math.round(150 * dense) : 320;
    for (var i = 0; i < strands; i += 1) {
      var base = at
        ? at.lon - spanLon + (i / strands) * 2 * spanLon
        : (i / strands) * TAU;
      var wob = (0.05 + rnd() * 0.09) * k;
      // Divided by k, so the meander keeps its wavelength on the screen
      // rather than its wavelength on the sphere.
      var turns = (2 + Math.floor(rnd() * 4)) / k;
      var gap = 19 + Math.floor(rnd() * 15);
      var phase = Math.floor(rnd() * gap);
      for (var s = 0; s <= down; s += 1) {
        if (((s + phase) % gap) < 4) { continue; }         // a block of dark
        var la = at
          ? at.lat - spanLat + (s / down) * 2 * spanLat
          : -1.55 + (s / down) * 3.1;
        lat.push(la);
        lon.push(wrap(base + wob * Math.sin(turns * la)));
        salt.push((s + i) % 7 === 0 ? 1 : 0);
      }
    }

    var split = lat.length;

    // Strands running round it. Even steps in longitude are shorter steps the
    // nearer the pole, so these gather into a ridge toward the top of the
    // world by themselves — which is the part of her surfaces that does the
    // most work, and here it falls out of the geometry for nothing.
    var rings = Math.round((at ? 110 * dense : 240) * PHI);
    var round = at ? Math.round(180 * dense) : 520;
    for (var j = 0; j < rings; j += 1) {
      var lat0 = at
        ? at.lat - spanLat + ((j + 0.5) / rings) * 2 * spanLat
        : -1.55 + ((j + 0.5) / rings) * 3.1;
      var sway = (0.02 + rnd() * 0.05) * k;
      var beats = (3 + Math.floor(rnd() * 5)) / k;
      var hole = 17 + Math.floor(rnd() * 17);
      var off = Math.floor(rnd() * hole);
      for (var t = 0; t < round; t += 1) {
        if (((t + off) % hole) < 5) { continue; }
        var lo = at
          ? at.lon - spanLon + (t / round) * 2 * spanLon
          : (t / round) * TAU;
        lat.push(Math.max(-1.56, Math.min(1.56, lat0 + sway * Math.sin(beats * lo))));
        lon.push(wrap(lo));
        salt.push((t + j) % 8 === 0 ? 1 : 0);
      }
    }

    wCount = lat.length;
    wSinLat = new Float32Array(wCount);
    wCosLat = new Float32Array(wCount);
    wSinLon = new Float32Array(wCount);
    wCosLon = new Float32Array(wCount);
    wSalt = new Uint8Array(wCount);
    wTone = new Uint8Array(wCount);
    wGain = new Float32Array(wCount);
    wInk = new Uint16Array(wCount);
    wSize = new Uint8Array(wCount);
    wSplit = split;
    wInks = [];
    var inkAt = {};
    // In a city the soil is read closer, by as much as the weave is, so a
    // clod is the same size on the screen down there as it is from orbit.
    var near_ = at ? zoom : 1;

    // What each landmass is made of. No mixing toward ink here any more:
    // the ink was a correction for colours that were pale by accident, and
    // the colours are chosen now rather than inherited.
    wTones = masses.map(function (mass) { return mass.ink; });

    for (var k = 0; k < wCount; k += 1) {
      wSinLat[k] = Math.sin(lat[k]);
      wCosLat[k] = Math.cos(lat[k]);
      wSinLon[k] = Math.sin(lon[k]);
      wCosLon[k] = Math.cos(lon[k]);
      wSalt[k] = salt[k];

      // Where it falls on the Earth, and how far into it. A dot at sea is
      // bare ink; a dot on land wears the colour of whichever of the works
      // lies nearest and sits heavier the further inland it is.
      var deep = at ? inlandNear(lat[k], lon[k]) : inland(lat[k], lon[k]);
      wGain[k] = deep ? 0.25 + 0.75 * deep : 0;

      // Which land it is standing on, straight off the map. What colour that
      // land is was settled once, in remass, by which of his places is
      // nearest it — so a boundary between two colours is a coastline rather
      // than a line drawn halfway between two cities, which is what makes a
      // continent read as one thing rather than a pastel patchwork.
      wTone[k] = deep ? ownerAt(lat[k], lon[k]) : 0;

      var tile = deep ? dirt.land : dirt.sea;
      if (dirt.earth && !at) {
        // DIRT Earth's own dot for this place and month.
        var E = dirt.earth;
        var eu = cellOf(E.n, (lon[k] / TAU + 0.5) * E.n);
        var ev = Math.min(E.h - 1, Math.max(0, Math.floor((0.5 - lat[k] / Math.PI) * E.h)));
        var eo = (ev * E.n + eu) * 4;
        var esize = Math.round(E.px[eo + 3] / 85);
        wSize[k] = esize;
        if (esize) {
          var ergb = E.px[eo] + "," + E.px[eo + 1] + "," + E.px[eo + 2];
          if (inkAt[ergb] === undefined) { inkAt[ergb] = wInks.length; wInks.push(ergb); }
          wInk[k] = inkAt[ergb];
        }
      } else if (tile) {
        var u = cellOf(tile.n, (lon[k] / TAU + 0.5) * DIRT_ROUND * tile.n * near_);
        var v = cellOf(tile.n, (lat[k] / Math.PI + 0.5) * DIRT_DOWN * tile.n * near_);
        var o = (v * tile.n + u) * 4;
        var size = Math.round(tile.px[o + 3] / 85);
        wSize[k] = size;
        if (size) {
          var rgb = dirt.pal
            ? dressed(tile.px[o], tile.px[o + 1], tile.px[o + 2], lat[k], lon[k], !deep)
            : tile.px[o] + "," + tile.px[o + 1] + "," + tile.px[o + 2];
          if (inkAt[rgb] === undefined) { inkAt[rgb] = wInks.length; wInks.push(rgb); }
          wInk[k] = inkAt[rgb];
        }
      } else {
        wSize[k] = 255;          // no soil to read: woven as it was before
      }
    }

    woven.spin = null;      // it will have to be drawn again
    if (!at) { worldWeave = takeWeave(); }
  }

  /* A weave kept whole, to be laid down again or faded out: the world's own
     (kept whenever it is woven), and the one a journey is leaving behind. */
  var worldWeave = null;
  function takeWeave() {
    return { n: wCount, sl: wSinLat, cl: wCosLat, so: wSinLon, co: wCosLon, salt: wSalt, tone: wTone,
             gain: wGain, ink: wInk, size: wSize, split: wSplit, inks: wInks, tones: wTones };
  }
  function putWeave(o) {
    wCount = o.n; wSinLat = o.sl; wCosLat = o.cl; wSinLon = o.so; wCosLon = o.co; wSalt = o.salt;
    wTone = o.tone; wGain = o.gain; wInk = o.ink; wSize = o.size; wSplit = o.split; wInks = o.inks;
    wTones = o.tones;
    woven.spin = null;
  }

  /* Close to, the land map is far coarser than the patch: how far inland a
     point is, read once for each 1/64 of a degree and kept. */
  var inlandSeen = new Map();
  function inlandNear(la, lo) {
    var key = Math.round(la * 3667) * 40000 + Math.round(wrap(lo) * 3667);
    var v = inlandSeen.get(key);
    if (v === undefined) {
      if (inlandSeen.size > 200000) { inlandSeen.clear(); }
      v = inland(la, lo);
      inlandSeen.set(key, v);
    }
    return v;
  }

  /* A fine dot dressed in its place's palette, as DIRT Earth dresses its
     ground: where its lightness falls between the place's darkest and
     lightest colours (on even ground, the sea, closer to the middle). */
  var STOP_AT = [0, Math.pow(PHI, -4), 0.42, 1 - Math.pow(PHI, -4), 1];
  var dressSeen = new Map();
  function dressed(r, g, b, la, lo, even) {
    var P = dirt.pal, w = P.n, h = P.h / 3;
    var u = cellOf(w, (lo / TAU + 0.5) * w);
    var v = Math.min(h - 1, Math.max(0, Math.floor((0.5 - la / Math.PI) * h)));
    // The same soil colour in the same cell of the palette is dressed the
    // same way: worked out once.
    var key = ((((v * w + u) * 2 + (even ? 1 : 0)) * 256 + r) * 256 + g) * 256 + b;
    var got = dressSeen.get(key);
    if (got !== undefined) { return got; }
    if (dressSeen.size > 200000) { dressSeen.clear(); }
    got = dressedOnce(P, w, h, u, v, r, g, b, even);
    dressSeen.set(key, got);
    return got;
  }
  function dressedOnce(P, w, h, u, v, r, g, b, even) {
    var col = function (band) { var o = ((band * h + v) * w + u) * 4; return [P.px[o], P.px[o + 1], P.px[o + 2]]; };
    var dark = col(0), mid = col(1), light = col(2);
    var st = [dark.map(function (c) { return c / (PHI * PHI); }), dark, mid, light,
              light.map(function (c) { return c + (255 - c) / PHI; })];
    var t = Math.max(0, Math.min(1, (0.3 * r + 0.59 * g + 0.11 * b - 34) / 144));
    if (even) { t = 0.42 + (t - 0.42) / PHI; }
    var n = 0;
    while (n < 3 && t > STOP_AT[n + 1]) { n += 1; }
    var f = Math.max(0, Math.min(1, (t - STOP_AT[n]) / (STOP_AT[n + 1] - STOP_AT[n])));
    return [0, 1, 2].map(function (i) { return Math.round(st[n][i] + (st[n + 1][i] - st[n][i]) * f); }).join(",");
  }

  function clothStale() {
    // Woven loosely while the world is being turned by hand, and again in
    // full the moment it is let go. Half the dots at speed is invisible, and
    // it is the difference between turning the world and dragging it.
    if (woven.loose && !turning) { return true; }
    return woven.spin === null || Math.abs(woven.spin - spin) > 0.0015 ||
           woven.w !== W || woven.h !== H || woven.r !== R ||
           Math.abs(woven.cx - cx) > 0.5 || Math.abs(woven.cy - cy) > 0.5;
  }

  /* The whole field, onto its own surface, in runs of one colour: a hundred
     thousand dots is nothing, a hundred thousand changes of fillStyle is the
     whole cost of having a surface at all. */
  function drawCloth(into) {
    [into ? into[0].canvas : cloth, into ? into[1].canvas : cloth2].forEach(function (c) {
      if (c.width !== canvas.width || c.height !== canvas.height) {
        c.width = canvas.width;
        c.height = canvas.height;
      }
    });
    if (bodyOn()) {
      [into ? into[0] : wctx, into ? into[1] : wctx2].forEach(function (c) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.clearRect(0, 0, c.canvas.width, c.canvas.height);
      });
      if (!into) { woven.spin = spin; woven.loose = false; woven.w = W; woven.h = H; woven.r = R; woven.cx = cx; woven.cy = cy; }
      return;
    }

    var cosS = Math.cos(spin);
    var sinS = Math.sin(spin);
    // Off the globe's own radius, not this one's: the cloth is rewoven at
    // the right density for wherever we are standing, so a dot in it should
    // still be the size a dot is.
    // And it grows with the world: a near world is woven in bigger dots, so
    // the land keeps its presence however close it comes.
    var grain = Math.max(1, baseR / 440);
    var loose = turning || (journey && journey.wk === "world") ? 2 : 1;

    // The strands down onto one surface, the strands round onto the other.
    [[into ? into[0] : wctx, 0, wSplit], [into ? into[1] : wctx2, wSplit, wCount]].forEach(function (family) {
      var c = family[0];
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, W, H);
      var runs = {};

      for (var k = family[1]; k < family[2]; k += loose) {
        var size = wSize[k];
        if (!size) { continue; }          // the soil has a gap here

        // The same projection as everything else, with the trigonometry
        // taken out: sin(lon - spin) and cos(lon - spin) from the
        // angle-difference identities, over values worked out when the
        // weave was made.
        var sinA = wSinLon[k] * cosS - wCosLon[k] * sinS;
        var cosA = wCosLon[k] * cosS + wSinLon[k] * sinS;
        var y = wSinLat[k];
        var z = wCosLat[k] * cosA;
        var z2 = y * SIN_T + z * COS_T;
        if (z2 <= 0.04) { continue; }

        var px = cx + wCosLat[k] * sinA * R;
        if (px < -12 || px > W + 12) { continue; }
        var py = cy - (y * COS_T - z * SIN_T) * R;
        if (py < -12 || py > H + 12) { continue; }

        var lit = z2 > 0.54 ? 1 : (z2 - 0.04) * 2;
        var gain = wGain[k];
        var a, tone, dot = grain;

        if (size !== 255) {
          // DIRT: the soil's own colour, and its own dot size.
          // The land is the soil, close-woven and heavy the further in it
          // goes. The sea is its own soil, but only every other thread of
          // it and lighter, so open water still reads as open and the
          // coastline is where one gives way to the other.
          if (!gain && (k & 1)) { continue; }
          tone = wInks[wInk[k]];
          // Finer than the soil's own dots: 1/phi of the size, snapped to
          // whole device pixels, so on a sharp screen a small clod is a
          // single hair of a pixel rather than a crumb.
          dot = Math.max(1, Math.round((grain + size - 1) * Math.sqrt(INV) * dpr)) / dpr;
          a = DIRT_LOOK ? (gain ? 0.3 + 0.7 * lit : 0.08 + 0.26 * lit)
            : gain ? (0.74 + 0.26 * lit) * (0.82 + 0.18 * gain)
                   : (0.1 + 0.2 * lit);
        } else if (gain) {
          a = (0.22 + 0.42 * lit) * (0.5 + 1.0 * gain);
          tone = wSalt[k] ? "255,255,255"
               : (wTone[k] && wTones[wTone[k] - 1] ? wTones[wTone[k] - 1] : SEA);
        } else {
          if ((k & 3) !== 0) { continue; }
          a = (0.035 + 0.075 * lit);
          tone = wSalt[k] ? "255,255,255" : SEA;
        }

        var step = a < 0.04 ? 0 : Math.min(21, Math.round(a * 22));
        if (!step) { continue; }
        var key = tone + "|" + step + "|" + dot;
        var run = runs[key] || (runs[key] = []);
        run.push(px, py);
      }

      Object.keys(runs).forEach(function (key) {
        var bits = key.split("|");
        var d = Number(bits[2]);
        c.fillStyle = "rgb(" + bits[0] + ")";
        c.globalAlpha = Number(bits[1]) / 22;
        var run = runs[key];
        for (var i = 0; i < run.length; i += 2) {
          c.fillRect(Math.round(run[i] * dpr) / dpr, Math.round(run[i + 1] * dpr) / dpr, d, d);
        }
      });
      c.globalAlpha = 1;
    });

    if (into) { return; }
    woven.spin = spin;
    woven.loose = loose > 1;
    woven.w = W;
    woven.h = H;
    woven.r = R;
    woven.cx = cx;
    woven.cy = cy;
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
  var drawn = { x: -999, y: -999, cx: 0, cy: 0, w: 0, h: 0, r: 0, masses: -1 };

  function sphereStale(lit) {
    // How far the light may drift before the sphere is worth painting again.
    // In a city the same step of the creature carries the light seven times
    // further across the screen, and at that size the gradients are so broad
    // that nobody can see it move anyway.
    var slack = 5 * Math.max(1, zoom * 0.7);
    return Math.abs(lit.x - drawn.x) > slack || Math.abs(lit.y - drawn.y) > slack ||
           drawn.w !== W || drawn.h !== H || drawn.r !== R ||
           Math.abs(drawn.cx - cx) > 0.5 || Math.abs(drawn.cy - cy) > 0.5 ||
           drawn.masses !== masses.length || clothStale();
  }

  function drawSphere(lit) {
    if (sphere.width !== canvas.width || sphere.height !== canvas.height) {
      sphere.width = canvas.width;
      sphere.height = canvas.height;
    }
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.clearRect(0, 0, W, H);
    // With the body of materials (earth-body.js) the globe's body is painted
    // live in paint(), and its own grain is the grit.
    if (!bodyOn()) {
      paintSphere(sctx, lit);
      // The grit is baked into the body of the globe when it is painted, not
      // laid over it every frame; it only changes when the globe does.
      grit(sctx, nearness());
    }
    if (clothStale()) { drawCloth(); }
    drawn.x = lit.x;
    drawn.y = lit.y;
    drawn.cx = cx;
    drawn.cy = cy;
    drawn.w = W;
    drawn.h = H;
    drawn.r = R;
    drawn.masses = masses.length;
  }

  /* ---- the body of materials ----------------------------------------------

     The artist, 1 Oct 2026: "the colors overall in the entire globe need to
     be less pixelated and more reflective of the materials the represent".
     The body of the globe is what each place is made of, in the collection's
     own colours, painted smoothly by earth-body.js and lit by the real sun;
     DIRT's dots are woven over it as before. On a journey it carries the
     depth ("a bit more clarity, a bit more depth in space"): sharp where you
     are headed and soft round the edges, the month's cloud on a layer above
     the ground that swells past you as you come down, the land sharpening as
     you descend, the air thick at the limb, and stars far behind when high. */
  var bodyDiv = 1, bodyGone = false;   // bodyGone: only where WebGL 2 fails (sharpen never sets it)
  function bodyOn() { return DIRT_LOOK && !bodyGone && !!window.EarthBody && EarthBody.ready(); }

  // How high a journey is, 0 on the ground of a city to 1 with the world whole.
  function journeyHigh() { return Math.max(0, Math.min(1, 1 - Math.log(Math.max(1, zoom)) / Math.log(600))); }

  // On a journey: where it is sharp (a little ahead of you on the way), and how much.
  function journeyFocus() {
    if (!journey || !route) { return null; }
    var went = journey.went || 0;
    var v = slerp3(journey.av, journey.bv, journey.om, Math.min(1, route.u + 0.1));
    var p = project(latOf(v), lonOf(v));
    var amt = Math.min(1, went / 0.14) * (1 - Math.max(0, Math.min(1, (went - 0.78) / 0.2)));
    // Softer at the edges the higher you are; as you come down the land sharpens.
    var up = smooth01((journeyHigh() - 0.15) / 0.5);
    return { x: Math.max(0.2 * W, Math.min(0.8 * W, p.x)), y: Math.max(0.2 * H, Math.min(0.8 * H, p.y)),
             amt: 0.8 * up * amt * amt * (3 - 2 * amt), r: 0.5 * Math.sqrt(W * W + H * H) };
  }

  function drawBody(now) {
    if (sun.at < 0 || now - sun.at > 20000) {
      var s = sunNow(Date.now());
      sun.lat = s.lat; sun.lon = s.lon; sun.at = now;
    }
    var on = journey ? 1 : 0;
    var went = journey ? journey.went || 0 : 1;
    var high = on ? journeyHigh() : 0;
    // The cloud layer: as you come down it lies nearer you than the ground,
    // so it swells and slides past faster, and is gone before you land.
    var kc = Math.min(0.62, zoom / 260);
    var cloud = on * Math.max(0, Math.min(1, (zoom - 1.1) / 1.3)) * (1 - smooth01((kc - 0.18) / 0.22)) *
                (1 - smooth01((went - 0.8) / 0.17)) * 0.8;
    var stars = on * smooth01((high - 0.35) / 0.45) * (1 - smooth01((went - 0.85) / 0.15)) * 0.9;
    var sv = toVec(sun.lat, sun.lon);
    // How much the ground is a city's ground (lit evenly, seated dark under
    // the names): at each end of a journey what it is there; between, by
    // how high you are, so the sun comes back as you rise.
    var near = nearness();
    if (on) {
      var ends = Math.abs(went - 0.5) * 2;
      near += (1 - smooth01((high - 0.12) / 0.4) - near) * (1 - ends * ends * ends * ends);
    }
    if (flying && doorShown) { hideDoor(); }
    // Once the body has come, the world's dots are woven again in its colours.
    if (!bodyWoven && !place && !flying && !journey) { bodyWoven = true; weave(); }
    stepFeel(now, cloud, kc);
    return EarthBody.draw({
      // At the page's own density, so each cell's edge falls on a device
      // pixel (sharpen() steps it down on a machine that cannot keep up).
      W: W, H: H, dpr: dpr / (globeSmall() ? 1 : bodyDiv), cx: cx, cy: cy, R: R, spin: spin, sinT: SIN_T, cosT: COS_T,
      sun: sv, near: near, high: high, journey: on, time: still ? 0 : now / 1000,
      focus: journeyFocus(), cloud: cloud, shell: 1 / (1 - kc), stars: stars,
      starX: ((spin * 140) % 4000 + 4000) % 4000, starY: tilt * 140, light: 1,
      feel: [feel.glass, feel.grain, feel.damp, feel.dense], crisp: feel.crisp
    });
  }
  var bodyWoven = false;

  /* What a journey feels like, by what it is crossing (the artist's idea,
     1 Oct 2026): over the sea quiet and glassy, a slow shimmer; over desert
     a fine dry grain, matte; through cloud or high mountains damp and
     diffuse, a little cooler; over forest textured and dense; over ice
     bright and crisp. Read from what is under you as you go, and eased
     from one to the next over a second or so. */
  var feel = { glass: 0, grain: 0, damp: 0, dense: 0, crisp: 0, at: 0 };
  var FEELS = {
    "sea": { glass: 1 }, "shallow sea": { glass: 0.85 }, "lake": { glass: 0.7 },
    "desert": { grain: 1 }, "rock": { damp: 0.75, grain: 0.2 }, "forest": { dense: 1 }, "wetland": { dense: 0.6, glass: 0.3 },
    "grass": { grain: 0.25, dense: 0.25 }, "ice": { crisp: 1 }, "city": {}
  };
  function stepFeel(now, cloud, kc) {
    var dt = Math.min(0.1, Math.max(0, (now - (feel.at || now)) / 1000));
    feel.at = now;
    var want = { glass: 0, grain: 0, damp: 0, dense: 0, crisp: 0 };
    if (journey && !still) {
      var kind = EarthBody.kindAt(focus.lat, focus.lon);
      var f = kind ? (kind.snow ? { crisp: 1 } : FEELS[kind.kind] || {}) : {};
      Object.keys(f).forEach(function (n) { want[n] = f[n]; });
      // Passing through the cloud layer: damp.
      want.damp = Math.max(want.damp, cloud * smooth01((kc - 0.08) / 0.2));
    }
    var k = 1 - Math.exp(-dt / 0.9);
    ["glass", "grain", "damp", "dense", "crisp"].forEach(function (n) { feel[n] += (want[n] - feel[n]) * k; });
  }
  function smooth01(t) { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); }

  function paint(now) {
    erupt(now);

    // What the creature stands on is the brightest part of the sphere.
    var lit = project(beast.lat, beast.lon);
    if (!flying && !moving() && sphereStale(lit)) { drawSphere(lit); }
    // On a journey the body is painted where it is: slid or grown from where
    // it was, its edge would open onto the room behind it.
    if (journey && drawn.r && (Math.abs(cx - drawn.cx) > 1 || Math.abs(cy - drawn.cy) > 1 ||
        R < drawn.r * 0.998 || R > drawn.r * 1.06)) { drawSphere(lit); }
    // A swing magnifies what is drawn, and a world coming in from far off
    // grows six times over: past phi times, it is woven again at the size
    // it has got to, a few times on the way in, so it never goes to blocks.
    if ((moving() || journey) && drawn.r && (R / drawn.r > PHI || R / drawn.r < INV || !covered()) &&
        now - swungAt > 60) {
      swungAt = now;
      drawSphere(lit);
      veilSeen.spin = null;
    }

    // The room is the stage's own background now (land.css), so the canvas
    // starts clear and only the globe is painted on it.
    ctx.clearRect(0, 0, W, H);

    // The globe, and each family of its threads, each seen through by an
    // amount of its own that never settles — see flux().
    var body = DIRT_LOOK ? 1 : flux(now, FLUX_BODY, 0);
    // The threads, which carry the land, breathe higher up the scale than
    // the body does — between 1/phi and all the way there — so the land
    // has presence while the sphere under it stays glass.
    var down = DIRT_LOOK ? 1 : flux(now, FLUX_DOWN, GOLDEN, INV, 1);
    var round = DIRT_LOOK ? 1 : flux(now, FLUX_ROUND, 2 * GOLDEN, INV, 1);

    // Everything that is the globe goes onto a layer of its own first, so
    // the patches and the pulse can be taken out of all of it at once.
    if (layer.width !== canvas.width || layer.height !== canvas.height) {
      layer.width = canvas.width;
      layer.height = canvas.height;
    }
    var gctx = lctx;
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gctx.globalCompositeOperation = "source-over";
    gctx.globalAlpha = 1;
    gctx.clearRect(0, 0, W, H);
    // The body, by what each place is made of, where the world is now: on
    // its own canvas under this one, so it is never copied (earth-body.js).
    if (bodyOn()) { drawBody(now); }

    gctx.save();
    if ((flying || moving()) && drawn.r) {
      // Mid-flight the sphere is not painted again — a hundred thousand dots
      // and seven gradients a frame is not a flight, it is a slideshow. The
      // surface already drawn is magnified about the point being flown to,
      // which is what magnifying actually looks like, and the real thing is
      // laid down once on arrival.
      var grew = R / drawn.r;
      gctx.translate(cx, cy);
      gctx.scale(grew, grew);
      gctx.translate(-drawn.cx, -drawn.cy);
    }
    gctx.globalAlpha = body;
    gctx.drawImage(sphere, 0, 0, W, H);
    // On a journey the land is drawn where the world is now, every frame,
    // not magnified from where it was: it is what you are travelling over.
    var live = !!journey || !!landFade.old;
    // On the dive the body of works is the world: the woven dots, magnified
    // a hundred times over, would only be streaks across it.
    if (!live && !(dive.on && bodyOn())) {
      gctx.globalAlpha = down;
      gctx.drawImage(cloth, 0, 0, W, H);
      gctx.globalAlpha = round;
      gctx.drawImage(cloth2, 0, 0, W, H);
    }
    gctx.restore();
    if (live) {
      var f = landFade.old ? Math.min(1, (now - landFade.at) / LAND_FADE) : 1;
      if (landFade.old && f < 1) {
        var cur = takeWeave();
        putWeave(landFade.old);
        drawCloth(oldCtxs);
        putWeave(cur);
        // The piece left behind fades out over the new one, which is laid
        // down whole at once: a new piece is always the wider, so no edge of
        // the old one is ever seen against nothing.
        gctx.globalAlpha = down * (1 - f);
        gctx.drawImage(clothOld, 0, 0, W, H);
        gctx.globalAlpha = round * (1 - f);
        gctx.drawImage(cloth2Old, 0, 0, W, H);
      }
      if (clothStale()) { drawCloth(); }
      gctx.globalAlpha = down;
      gctx.drawImage(cloth, 0, 0, W, H);
      gctx.globalAlpha = round;
      gctx.drawImage(cloth2, 0, 0, W, H);
      if (f >= 1 && !journey) { landFade.old = null; drawn.r = 0; }
    }

    // The patches and the pulse, as a mask: kept where it is opaque, faded
    // where it is not.
    if (!DIRT_LOOK) { veil(now); }
    gctx.globalAlpha = 1;
    gctx.globalCompositeOperation = DIRT_LOOK ? "source-over" : "destination-in";
    gctx.imageSmoothingEnabled = true;
    if (DIRT_LOOK) {
      // no patches: DIRT's globe is whole
    } else if (moving() && veilSeen.r) {
      // The mask is magnified with everything else while the world swings.
      gctx.save();
      gctx.translate(cx, cy);
      gctx.scale(R / veilSeen.r, R / veilSeen.r);
      gctx.translate(-veilSeen.cx, -veilSeen.cy);
      gctx.drawImage(veilCanvas, 0, 0, W, H);
      gctx.restore();
    } else {
      gctx.drawImage(veilCanvas, 0, 0, W, H);
    }
    gctx.globalCompositeOperation = "source-over";

    // Grit into it, then part of it laid down soft — both more the further
    // down you are. See gritAndBlur.
    var near = nearness();
    var mist = DIRT_LOOK ? 0 : INV3 + (INV - INV3) * near;   // how much of it is blurred (none, in DIRT's look)
    var shrink = Math.pow(INV, 2 + 2 * near);       // and how far
    var sw = Math.max(1, Math.round(layer.width * shrink));
    var sh = Math.max(1, Math.round(layer.height * shrink));
    // Out of focus is out of focus: it is taken again every third frame,
    // not every frame, and nobody can see the difference in a haze.
    softTick = (softTick + 1) % 3;
    if (soft.width !== sw || soft.height !== sh) { soft.width = sw; soft.height = sh; softTick = 0; }
    if (!softTick || flying) {
      // Small, and on a canvas of its own under this one: the browser
      // stretches it back over the whole window itself, and a stretched
      // small picture is the blur. The shadow that seats the globe is in
      // here too, since it is only ever soft.
      softCtx.setTransform(sw / W, 0, 0, sh / H, 0, 0);
      softCtx.clearRect(0, 0, W, H);
      softCtx.imageSmoothingEnabled = true;
      seatShadow(softCtx, 1 / Math.max(mist, 0.1));
      softCtx.drawImage(layer, 0, 0, W, H);
    }
    if (Math.abs(softShown - mist) > 0.004) {
      softShown = mist;
      soft.style.opacity = mist.toFixed(3);
    }

    ctx.globalAlpha = 1 - mist;
    ctx.drawImage(layer, 0, 0, W, H);
    ctx.globalAlpha = 1;
    // On a journey the dots are sharp where you are headed and let go of
    // toward the edges, as the body under them is.
    var dof = bodyOn() ? journeyFocus() : null;
    if (dof && dof.amt > 0.01) {
      var fade = ctx.createRadialGradient(dof.x, dof.y, dof.r * 0.3, dof.x, dof.y, dof.r * 1.15);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0," + (0.8 * dof.amt).toFixed(3) + ")");
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";
    }
    living(now);
    if (layerOn === "museums" && (!place || grown) && towns) { drawTowns(now); }
    if (place && !flying && art && art.kind === "town" && !skyOn()) { drawVenues(); }
    if (following && place) { drawFollowed(); }
    placeGloss();
    placeHubble(now);

    if (place && !flying) { drawStage(ctx, now); }
    stir(now);
    drawMotes();
    drawRing(now);
    beatOf(now);
    drawTiles(now);

    // No line where the sphere ends. It used to be drawn in, and a drawn edge
    // is the one thing that stops a horizon being a horizon: the sphere simply
    // ceases now, a shade off the sky it sits in.
  }

  /* ---- the living world ---------------------------------------------------

     After the research the artist shared (23 Sep 2026): the world is not a
     model of the Earth held still. It is lit by the real sun, as it is at
     the moment it is looked at, so the night side is where night is and
     the land there has its lights on. It has weather — cloud carried round
     on the pattern the real winds make, trade winds and westerlies and
     polar easterlies, with storms that flash at night — after Radiohead and
     Universal Everything's PolyFauna. A company migrates between the places
     the collages are in, each moving the way a real animal moves, after
     Universal Everything's Migrations: once bodies nobody had seen
     (Systems.creature), now figures out of what the artist reads and loves
     (Systems.figure, COMPANY below). And a procession walks the rim of
     the world that never ends and never repeats, every walker made up as
     it steps over the horizon, after their Infinity.

     Up on the globe only. None of it goes down into a city. */

  var LIVING = !!(window.Systems && Systems.Noise);
  var sun = { lat: 0, lon: 0, at: -1e9 };
  var weatherCanvas = document.createElement("canvas");
  var weatherCtx = weatherCanvas.getContext("2d");
  var weatherImg = null;
  var weatherSeen = { key: "", at: -1e9, block: 4 };
  var CLOUD_W = 120, CLOUD_H = 60;
  var clouds = null;
  var skyNoise = LIVING ? new Systems.Noise((Math.random() * 1e9) | 0) : null;
  var nightLights = null;
  var storms = [];
  var flashes = [];
  var herd = [];
  var walkers = [];
  var walkerSeed = (Math.random() * 1e9) | 0;
  var livingAt = 0;
  var pointerAt = { x: -1e4, y: -1e4, at: -1e9 };
  var NIGHT = [30, 26, 66], DUSK = [226, 150, 146];
  var CLOUD_DAY = [253, 252, 250], CLOUD_NIGHT = [150, 146, 196];

  window.addEventListener("pointermove", function (event) {
    pointerAt.x = event.clientX; pointerAt.y = event.clientY; pointerAt.at = performance.now();
  }, { passive: true });
  window.addEventListener("pointerdown", function (event) {
    pointerAt.x = event.clientX; pointerAt.y = event.clientY; pointerAt.at = performance.now();
  }, { passive: true });

  /* Where the sun is overhead, now: its declination from the date and its
     longitude from the time (the low-precision solar position of the
     Astronomical Almanac, good to a fraction of a degree). */
  function sunNow(ms) {
    var d = ms / 86400000 - 10957.5;                   // days from noon, 1 Jan 2000
    var g = (357.529 + 0.98560028 * d) * RAD;
    var q = 280.459 + 0.98564736 * d;
    var L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD;
    var e = (23.439 - 0.00000036 * d) * RAD;
    var ra = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L));
    var gmst = (280.46061837 + 360.98564736629 * d) * RAD;
    return { lat: Math.asin(Math.sin(e) * Math.sin(L)), lon: wrap(ra - gmst) };
  }

  // The sun, turned and leant with the world as it is on the screen now.
  function sunView() {
    var a = sun.lon - spin, cl = Math.cos(sun.lat);
    var x = cl * Math.sin(a), y = Math.sin(sun.lat), z = cl * Math.cos(a);
    return [x, y * COS_T - z * SIN_T, y * SIN_T + z * COS_T];
  }

  // How far into the night a place is: 0 in daylight, 1 in full dark.
  function darkAt(lat, lon) {
    var dot = Math.sin(lat) * Math.sin(sun.lat) + Math.cos(lat) * Math.cos(sun.lat) * Math.cos(lon - sun.lon);
    return Math.max(0, Math.min(1, (0.03 - dot) / 0.15));
  }

  // The point of the surface under a point of the screen, or of the rim
  // nearest it when it is off the world.
  function surfaceAt(x, y) {
    var nx = (x - cx) / R, ny = -(y - cy) / R, d2 = nx * nx + ny * ny;
    if (d2 > 1) { var k = 1 / Math.sqrt(d2); nx *= k; ny *= k; d2 = 1; }
    var nz = Math.sqrt(Math.max(0, 1 - d2));
    var wy = ny * COS_T + nz * SIN_T, wz = -ny * SIN_T + nz * COS_T;
    return { lat: Math.asin(Math.max(-1, Math.min(1, wy))), lon: wrap(Math.atan2(nx, wz) + spin) };
  }

  function toVec(lat, lon) {
    var cl = Math.cos(lat);
    return [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)];
  }
  function norm3(v) {
    var n = Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]) || 1;
    return [v[0] / n, v[1] / n, v[2] / n];
  }
  function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function latOf(v) { return Math.asin(Math.max(-1, Math.min(1, v[1]))); }
  function lonOf(v) { return Math.atan2(v[0], v[2]); }
  // The way from p toward q, along the surface.
  function toward(p, q) {
    var k = dot3(p, q);
    return norm3([q[0] - p[0] * k, q[1] - p[1] * k, q[2] - p[2] * k]);
  }

  /* The winds, as the Earth has them in three bands a hemisphere: from the
     east near the equator, from the west in the middle latitudes, from the
     east again near the poles. In radians of longitude a second — far
     faster than the real ones, or nobody would see them move. */
  function windAt(lat) { return Math.cos(4 * lat) * -0.55 * RAD; }

  /* Where cloud gathers: along the equator, where the trade winds meet;
     hardly at all over the subtropics, which is where the deserts are; and
     thickly along the storm tracks of the fifties. */
  function cloudBias(lat) {
    var d = Math.abs(lat) / RAD;
    return 0.13 * Math.exp(-Math.pow(d / 7, 2)) - 0.1 * Math.exp(-Math.pow((d - 24) / 8, 2)) +
           0.09 * Math.exp(-Math.pow((d - 56) / 10, 2));
  }

  /* The cloud, a map of the whole world a few degrees to the cell. A field
     of cloud carried by the winds is sheared by them into streaks if it is
     carried for long, so two are carried, half a period apart, and each
     gives way to a fresh one while the other is at its strongest. A quarter
     of the rows is worked out each frame. */
  var CLOUD_CARRY = 150;
  function stepClouds(now) {
    if (!clouds) {
      clouds = { map: new Float32Array(CLOUD_W * CLOUD_H), row: 0 };
      for (var k = 0; k < 4; k += 1) { stepClouds(now); }
      return;
    }
    var t = (still ? 400 : now) / 1000;
    var ph = (t / CLOUD_CARRY) % 1, ph2 = (ph + 0.5) % 1;
    var n1 = Math.floor(t / CLOUD_CARRY), n2 = Math.floor(t / CLOUD_CARRY + 0.5);
    var w1 = 1 - Math.abs(2 * ph - 1), w2 = 1 - w1;
    var norm = 1 / Math.sqrt(w1 * w1 + w2 * w2);
    var rows = CLOUD_H / 4, f = 2.2;
    for (var j = clouds.row; j < clouds.row + rows; j += 1) {
      var lat = (0.5 - (j + 0.5) / CLOUD_H) * Math.PI;
      var cl = Math.cos(lat), sl = Math.sin(lat) * f;
      var wind = windAt(lat) * CLOUD_CARRY, bias = cloudBias(lat);
      for (var i = 0; i < CLOUD_W; i += 1) {
        var lon = (i + 0.5) / CLOUD_W * TAU - Math.PI;
        var a1 = lon - wind * ph, a2 = lon - wind * ph2;
        var v1 = w1 > 0.01 ? skyNoise.fbm(cl * Math.cos(a1) * f + n1 * 17.3, sl, cl * Math.sin(a1) * f + t * 0.006, 3) : 0.5;
        var v2 = w2 > 0.01 ? skyNoise.fbm(cl * Math.cos(a2) * f + n2 * 17.3, sl, cl * Math.sin(a2) * f + t * 0.006, 3) : 0.5;
        var v = 0.5 + ((v1 - 0.5) * w1 + (v2 - 0.5) * w2) * norm;
        var c = (v - (0.565 - bias)) / 0.15;
        clouds.map[j * CLOUD_W + i] = c <= 0 ? 0 : c >= 1 ? 1 : c * c * (3 - 2 * c);
      }
    }
    clouds.row = (clouds.row + rows) % CLOUD_H;
  }

  function cloudAt(lat, lon) {
    var u = (wrap(lon) + Math.PI) / TAU * CLOUD_W - 0.5, v = (0.5 - lat / Math.PI) * CLOUD_H - 0.5;
    var i0 = Math.floor(u), j0 = Math.max(0, Math.min(CLOUD_H - 2, Math.floor(v)));
    var fu = u - i0, fv = Math.max(0, Math.min(1, v - j0));
    var i1 = (i0 + 1 + CLOUD_W) % CLOUD_W;
    i0 = (i0 + CLOUD_W) % CLOUD_W;
    var m = clouds.map, a = m[j0 * CLOUD_W + i0], b = m[j0 * CLOUD_W + i1];
    var c = m[(j0 + 1) * CLOUD_W + i0], d = m[(j0 + 1) * CLOUD_W + i1];
    return (a + (b - a) * fu) * (1 - fv) + (c + (d - c) * fu) * fv;
  }

  /* Night and weather, worked out block by block over the disc — blocks a
     few pixels across, so the terminator and the cloud are pixel art like
     everything else — with each shade stepped and dithered. */
  function drawWeather(now, fade) {
    // At the grain of the body's own cells, crisp (never stretched smooth): a small globe's
    // weather is as fine as its cells, a near one's as coarse as before.
    var block = Math.max(3, Math.min(9, Math.round(R / 64)));
    if (bodyOn()) {
      var lv = EarthBody.levelFor(R, EarthBody.density());
      block = Math.max(1, Math.min(9, Math.round(Math.min(lv.drawn, R / 48))));
    }
    var key = [spin.toFixed(4), tilt.toFixed(4), R.toFixed(1), cx.toFixed(1), cy.toFixed(1), W, H].join();
    if (key !== weatherSeen.key || now - weatherSeen.at > 1000 / 12) {
      weatherSeen.key = key;
      weatherSeen.at = now;
      weatherSeen.block = block;
      var gw = Math.ceil(W / block), gh = Math.ceil(H / block);
      if (weatherCanvas.width !== gw || weatherCanvas.height !== gh) {
        weatherCanvas.width = gw;
        weatherCanvas.height = gh;
        weatherImg = weatherCtx.createImageData(gw, gh);
      }
      var d = weatherImg.data;
      d.fill(0);
      var sv = sunView();
      var x0 = Math.max(0, Math.floor((cx - R) / block)), x1 = Math.min(gw - 1, Math.ceil((cx + R) / block));
      var y0 = Math.max(0, Math.floor((cy - R) / block)), y1 = Math.min(gh - 1, Math.ceil((cy + R) / block));
      storms.length = 0;
      for (var j = y0; j <= y1; j += 1) {
        var ny = -((j + 0.5) * block - cy) / R;
        for (var i = x0; i <= x1; i += 1) {
          var nx = ((i + 0.5) * block - cx) / R, d2 = nx * nx + ny * ny;
          if (d2 >= 1) { continue; }
          var nz = Math.sqrt(1 - d2);
          var wy = ny * COS_T + nz * SIN_T, wz = -ny * SIN_T + nz * COS_T;
          var lat = Math.asin(wy), lon = Math.atan2(nx, wz) + spin;
          var lit = nx * sv[0] + ny * sv[1] + nz * sv[2];
          var dither = BAYER[(j & 7) * 8 + (i & 7)] / 64;
          var night = Math.max(0, Math.min(1, (0.03 - lit) / 0.15));
          // Continuous over the body of works (cloud is vapour, not pixels);
          // in three dithered steps over the old body.
          var nq = bodyOn() ? night : Math.min(3, Math.floor(night * 3 + dither)) / 3;
          var dusk = Math.max(0, 1 - Math.abs(lit + 0.02) / 0.07);
          var cloud = cloudAt(lat, lon);
          var cq = bodyOn() ? smooth01((cloud - 0.12) / 0.8) : Math.min(3, Math.floor(cloud * 3 + dither * 0.999)) / 3;
          if (cloud > 0.9 && storms.length < 96) { storms.push(i, j); }
          // The body of works is lit by the sun itself: over it the night is a breath.
          var an = bodyOn() ? 0.1 * nq : Math.max(0.3 * nq, 0.16 * (dusk > 0.5 ? 1 : dusk > 0.2 ? 0.5 : 0));
          var cn0 = nq > 0 ? NIGHT : DUSK;
          var ac = cq * (0.58 - 0.3 * nq);
          if (an <= 0 && ac <= 0) { continue; }
          var cc0 = CLOUD_DAY[0] + (CLOUD_NIGHT[0] - CLOUD_DAY[0]) * nq;
          var cc1 = CLOUD_DAY[1] + (CLOUD_NIGHT[1] - CLOUD_DAY[1]) * nq;
          var cc2 = CLOUD_DAY[2] + (CLOUD_NIGHT[2] - CLOUD_DAY[2]) * nq;
          var A = ac + an * (1 - ac);
          var o = (j * gw + i) * 4;
          d[o] = (cc0 * ac + cn0[0] * an * (1 - ac)) / A;
          d[o + 1] = (cc1 * ac + cn0[1] * an * (1 - ac)) / A;
          d[o + 2] = (cc2 * ac + cn0[2] * an * (1 - ac)) / A;
          d[o + 3] = A * 255;
        }
      }
      weatherCtx.putImageData(weatherImg, 0, 0);
    }
    block = weatherSeen.block;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(weatherCanvas, 0, 0, weatherCanvas.width * block, weatherCanvas.height * block);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    return block;
  }

  /* The lights of the night side: settled land, in clusters, and brighter
     where the words and the places are. */
  function makeLights() {
    nightLights = [];
    var seeds = 0;
    for (var tries = 0; seeds < 150 && tries < 20000; tries += 1) {
      var lat = Math.asin(2 * Math.random() - 1), lon = Math.random() * TAU - Math.PI;
      if (Math.abs(lat) > 70 * RAD || !onLand(lat, lon)) { continue; }
      seeds += 1;
      var n = 2 + Math.floor(Math.random() * 7);
      for (var k = 0; k < n; k += 1) {
        var la = lat + (Math.random() - 0.5) * 5 * RAD, lo = lon + (Math.random() - 0.5) * 7 * RAD;
        if (onLand(la, lo)) {
          nightLights.push({ lat: la, lon: lo, b: 0.3 + 0.7 * Math.pow(Math.random(), 2), k: Math.random() * TAU });
        }
      }
    }
    vocabulary.forEach(function (g) { nightLights.push({ lat: g.lat, lon: g.lon, b: 1, k: Math.random() * TAU }); });
    cities.forEach(function (c) {
      if (c.town || c.inTown) { return; }          // a city of the Museums layer is its own mark; a museum is in its city
      // Nor a birthplace, a building or a museum: a layer's marks are its own
      // (3 Oct 2026: the Artists layer carries only its names, and every
      // birthplace had been a gold cross on the night side). Kept by its
      // layer, not by the mark: found() makes the marks again, and the
      // lights are made once.
      if (c.studio || c.building || c.museum) { return; }
      nightLights.push({ lat: c.lat, lon: c.lon, b: 1.5, k: Math.random() * TAU, big: true, layer: c.layer || "" });
    });
  }

  var LAMP = ["#7b5a2c", "#d9a64e", "#fff1c4"];
  function drawLights(now, block, fade) {
    if (!nightLights) { if (earthBits && cities.length) { makeLights(); } else { return; } }
    var lamp = Math.max(bodyOn() ? 1 : 2, Math.round(block * 0.65));
    ctx.save();
    ctx.globalAlpha = fade;
    // The Artists layer is its names and nothing else (artist, 3 Oct 2026, of
    // Europe at night: "There's still way too many dots on the globe for the
    // artist filter. I just want artist names to be where they were born"):
    // no lamps on its night side, only the lightning.
    (layerOn === "studios" ? [] : nightLights).forEach(function (l) {
      if (l.layer && l.layer !== layerOn) { return; }   // a collage's light only on the Collages layer
      var dark = darkAt(l.lat, l.lon);
      if (dark <= 0.2) { return; }
      var p = project(l.lat, l.lon);
      if (p.z < 0.08) { return; }
      var twinkle = still ? 1 : 0.8 + 0.2 * (Math.sin(now / 700 + l.k * 7) > 0.6 ? 1 : 0);
      var level = l.b * dark * twinkle * (1 - 0.6 * cloudAt(l.lat, l.lon)) * Math.min(1, (p.z - 0.08) * 6);
      var step = level > 0.9 ? 2 : level > 0.45 ? 1 : level > 0.15 ? 0 : -1;
      if (step < 0) { return; }
      var x = Math.floor(p.x / lamp) * lamp, y = Math.floor(p.y / lamp) * lamp;
      ctx.fillStyle = LAMP[step];
      ctx.fillRect(x, y, lamp, lamp);
      if (l.big) {
        ctx.fillStyle = LAMP[Math.max(0, step - 1)];
        ctx.fillRect(x - lamp, y, lamp, lamp);
        ctx.fillRect(x + lamp, y, lamp, lamp);
        ctx.fillRect(x, y - lamp, lamp, lamp);
        ctx.fillRect(x, y + lamp, lamp, lamp);
      }
    });
    // Lightning, in the thickest of the cloud: a few blocks lit, off, lit
    // again, and gone.
    if (!still && storms.length && Math.random() < 0.025) {
      var s = Math.floor(Math.random() * storms.length / 2) * 2, cells = [], bx = storms[s], by = storms[s + 1];
      for (var c = 0; c < 3 + Math.random() * 6; c += 1) {
        cells.push(bx, by);
        bx += Math.round(Math.random() * 2 - 1);
        by += Math.random() < 0.6 ? 1 : 0;
      }
      flashes.push({ at: now, cells: cells });
    }
    flashes = flashes.filter(function (f) { return now - f.at < 260; });
    flashes.forEach(function (f) {
      var t = now - f.at;
      if ((t > 60 && t < 120) || t > 200) { return; }
      ctx.fillStyle = t < 60 ? "#f6f2ff" : LILAC;
      for (var i = 0; i < f.cells.length; i += 2) { ctx.fillRect(f.cells[i] * block, f.cells[i + 1] * block, block, block); }
    });
    ctx.restore();
  }

  /* The herd. One of each gait to start, each on its way from one of the
     places to another; arriving, it is sometimes born again as a body that
     has never been seen, and walks on. */
  function coloursFrom(city) {
    return dreamColours(((city && city.slug && measured[city.slug]) || []).slice(0, 3));
  }

  /* The company (artist's request, 23 Sep 2026: the characters "built more
     towards me"): in place of bodies nobody has seen, figures out of what he
     reads and loves — see S.figure in systems.js for who each one is. Only
     the metamorphosis changes, camel to lion to child and round again; the
     rest stay themselves. COMPANY = false brings back the invented herd.

     Sparingly (23 Sep 2026: "go a little bit easier"): one of them at a
     time, one journey each, then the world is empty for a while before the
     next comes. The metamorphosis makes its three journeys, camel, lion,
     child, and goes; the camel comes back on its next turn. */
  var COMPANY = true;
  var CAST = ["horse", "camel", "eagle", "road", "bat"];
  var BECOMES = { camel: "lion", lion: "child" };
  var castTurn = Math.floor(Math.random() * CAST.length);
  var castNext = 0;                  // when the next may come
  var CAST_GAP = [34, 89];           // seconds of empty world between them (Fibonacci)

  function darkCities() {
    return cities.filter(function (c) { return darkAt(c.lat, c.lon) > 0.55; });
  }
  // Where a member of the company goes next, from where it is.
  function nextFor(kind, from) {
    // never somewhere it is already standing (Washington has three places)
    var here = toVec(from.lat, from.lon);
    var others = cities.filter(function (c) { return dot3(toVec(c.lat, c.lon), here) < Math.cos(4 * RAD); });
    if (kind === "bat") {
      // only to where it is night; if nowhere else is, they stay and
      // circle the place they are
      var dark = darkCities().filter(function (c) { return others.indexOf(c) >= 0; });
      if (!dark.length) { return from; }
      others = dark;
    } else if (kind === "road") {
      var south = others.filter(function (c) { return c.lat < from.lat - 1; });   // they keep going south
      if (south.length) { others = south; }
    }
    return others[Math.floor(Math.random() * others.length)];
  }

  function newMember(kind, from, along) {
    var b = newBeast(null, from, along, kind);
    return b;
  }

  function newBeast(gait, from, along, kind) {
    var others = cities.filter(function (c) { return c !== from; });
    var to = kind ? nextFor(kind, from) : others[Math.floor(Math.random() * others.length)];
    var a = toVec(from.lat, from.lon), b = toVec(to.lat, to.lon);
    if (to === from) {                                       // circling: somewhere just by it
      b = norm3([b[0] + (Math.random() - 0.5) * 0.06, b[1] + (Math.random() - 0.5) * 0.06, b[2] + (Math.random() - 0.5) * 0.06]);
    }
    var P = a;
    if (along) {
      var k = Math.random() * 0.8;
      P = norm3([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
    }
    if (kind === "bat") {                                   // a little apart, as bats go
      P = norm3([P[0] + (Math.random() - 0.5) * 0.04, P[1] + (Math.random() - 0.5) * 0.04, P[2] + (Math.random() - 0.5) * 0.04]);
    }
    return {
      kind: kind || null,
      spec: kind ? Systems.figure(kind, (Math.random() * 1e9) | 0, coloursFrom(from))
                 : Systems.creature((Math.random() * 1e9) | 0, coloursFrom(from), gait),
      P: P, T: b, to: to, h: null, phase: Math.random(), flee: 0, facing: 1,
      born: performance.now(), rest: along ? 0 : 2 + Math.random() * 4, wander: Math.random() * 100
    };
  }

  function beastScale(spec) {
    var want = Math.max(12, Math.min(52, R * 0.075)) * (spec.size || 1);
    return Math.max(1, Math.round(want / Math.max(10, spec.fh * 0.8)));
  }

  function stepHerd(now, dt) {
    if (!herd.length) {
      if (cities.length < 2) { return; }
      if (COMPANY && Systems.figure) {
        if (!castNext) { castNext = now + 8000 + Math.random() * 13000; }
        if (now < castNext) { return; }
        var k = CAST[castTurn % CAST.length];
        castTurn += 1;
        var pool = k === "bat" ? darkCities() : cities;
        if (!pool.length) { return; }
        herd.push(newMember(k, pool[Math.floor(Math.random() * pool.length)], false));
      } else {
        Systems.GAITS.forEach(function (g) {
          herd.push(newBeast(g, cities[Math.floor(Math.random() * cities.length)], true));
        });
      }
    }
    var scared = now - pointerAt.at < 1500;
    if (COMPANY) {
      herd = herd.filter(function (b) {
        if (b.leaving && now - b.leaving > 1300) {
          castNext = now + (CAST_GAP[0] + Math.random() * (CAST_GAP[1] - CAST_GAP[0])) * 1000;
          return false;
        }
        return true;
      });
    }
    herd.forEach(function (b, n) {
      if (b.leaving) { return; }
      if (b.kind === "bat" && !b.until) { b.until = now + 21000 + Math.random() * 13000; }
      if (b.kind === "bat" && now > b.until) { b.leaving = now; return; }
      var s = beastScale(b.spec);
      if (b.kind === "bat") {
        // Out only in the dark. Where the day has come, they are gone, and
        // they come out again wherever it is night.
        var night = darkAt(latOf(b.P), lonOf(b.P)) > 0.5;
        if (!night && !b.hidden) { b.hidden = true; b.gone = now; }
        if (b.hidden) { b.leaving = now; return; }
      }
      var p = project(latOf(b.P), lonOf(b.P));
      if (scared && p.z > 0 && b.kind === "horse") {
        // The horse is not frightened off. Touched, it stops, and will not
        // be made to go on for a while.
        var hx = p.x - pointerAt.x, hy = p.y - pointerAt.y;
        if (hx * hx + hy * hy < Math.pow(60 + 20 * s, 2) && !b.rest) { b.rest = 4 + Math.random() * 5; }
      } else if (scared && p.z > 0) {
        var dx = p.x - pointerAt.x, dy = p.y - pointerAt.y;
        if (dx * dx + dy * dy < Math.pow(90 + 20 * s, 2)) {
          if (!b.flee) { sparkle(p.x, p.y - b.spec.fh * s * 0.6, [rgbHex(b.spec.colour.map(Math.round))], 5); }
          b.flee = 1.6;
          var q = surfaceAt(pointerAt.x, pointerAt.y);
          var Q = toVec(q.lat, q.lon);
          var away = toward(b.P, Q);
          b.away = [-away[0], -away[1], -away[2]];
        }
      }
      b.flee = Math.max(0, b.flee - dt);
      // Arrived, it stays a while before it sets off again, unless it is
      // frightened off.
      if (b.rest > 0 && !b.flee) { b.rest -= dt; return; }
      b.rest = 0;
      var want = b.flee > 0 && b.away ? b.away : toward(b.P, b.T);
      if (!b.flee) {
        // Not in a straight line: it wanders either side of the way.
        var th = Math.sin(now / 2900 + b.wander) * 0.7 + Math.sin(now / 1300 + b.wander * 2) * 0.25;
        var side = [b.P[1] * want[2] - b.P[2] * want[1], b.P[2] * want[0] - b.P[0] * want[2], b.P[0] * want[1] - b.P[1] * want[0]];
        var ct = Math.cos(th), st = Math.sin(th);
        want = [want[0] * ct + side[0] * st, want[1] * ct + side[1] * st, want[2] * ct + side[2] * st];
      }
      var h = b.h || want, k = b.flee > 0 ? 0.3 : 0.06;
      h = [h[0] + (want[0] - h[0]) * k, h[1] + (want[1] - h[1]) * k, h[2] + (want[2] - h[2]) * k];
      var c = dot3(h, b.P);
      b.h = norm3([h[0] - b.P[0] * c, h[1] - b.P[1] * c, h[2] - b.P[2] * c]);
      var px = b.spec.speed * s * (b.flee > 0 ? 2.4 : 1) * dt;           // pixels this frame
      var step = px / Math.max(40, R);
      b.P = norm3([b.P[0] + b.h[0] * step, b.P[1] + b.h[1] * step, b.P[2] + b.h[2] * step]);
      b.phase += b.spec.gait === "swoop" ? dt * (b.flee > 0 ? 3.2 : 1.6) * (b.spec.flap || 1) : px / (b.spec.stride * s);
      // Facing the way it is going, as it looks on the screen.
      var next = norm3([b.P[0] + b.h[0] * 0.01, b.P[1] + b.h[1] * 0.01, b.P[2] + b.h[2] * 0.01]);
      var from = project(latOf(b.P), lonOf(b.P)), to = project(latOf(next), lonOf(next));
      if (Math.abs(to.x - from.x) > 0.02) { b.facing = to.x > from.x ? 1 : -1; }
      if (dot3(b.P, b.T) > Math.cos(1.2 * RAD)) {
        var at = project(b.to.lat, b.to.lon);
        if (b.kind && BECOMES[b.kind]) {
          // Arriving, the spirit changes: camel, lion, child, and again.
          herd[n] = newMember(BECOMES[b.kind], b.to, false);
          if (at.z > 0.1) { pulse(at.x, at.y, [rgbHex(herd[n].spec.colour.map(Math.round)), LIGHT], 0.6, 140); }
        } else if (b.kind && b.kind !== "bat") {
          b.leaving = now;                                   // one journey, and gone
        } else if (b.kind) {
          var was = b.to;
          b.to = nextFor(b.kind, b.to);
          b.T = toVec(b.to.lat, b.to.lon);
          if (b.to === was) { b.T = norm3([b.T[0] + (Math.random() - 0.5) * 0.06, b.T[1] + (Math.random() - 0.5) * 0.06, b.T[2] + (Math.random() - 0.5) * 0.06]); }
          b.rest = b.kind === "bat" ? Math.random() : b.kind === "road" ? 6 + Math.random() * 8 : 3 + Math.random() * 7;
        } else if (Math.random() < 0.4) {
          herd[n] = newBeast(b.spec.gait, b.to, false);
          if (at.z > 0.1) { pulse(at.x, at.y, [rgbHex(herd[n].spec.colour.map(Math.round)), LIGHT], 0.45, 110); }
        } else {
          var others = cities.filter(function (c) { return c !== b.to; });
          b.to = others[Math.floor(Math.random() * others.length)];
          b.T = toVec(b.to.lat, b.to.lon);
          b.rest = 3 + Math.random() * 7;
        }
      }
    });
  }

  function drawHerd(now, fade) {
    var seen = [];
    herd.forEach(function (b) {
      var lat = latOf(b.P), lon = lonOf(b.P);
      var p = project(lat, lon);
      if (p.z < 0.12 || b.hidden) { return; }
      seen.push({ b: b, p: p, lat: lat, lon: lon });
    });
    seen.sort(function (a, c) { return a.p.y - c.p.y; });
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    seen.forEach(function (it) {
      var b = it.b, sp = b.spec, s = beastScale(sp);
      var edge = Math.min(1, (it.p.z - 0.12) / 0.14), born = Math.min(1, (now - b.born) / 600);
      if (b.leaving) { born = Math.min(born, Math.max(0, 1 - (now - b.leaving) / 1200)); }
      var a = Math.round(Math.min(edge, born) * 4) / 4 * fade;
      if (a <= 0) { return; }
      // Standing still, it stands on its feet (the first frame) — unless it
      // flies, and then it hovers.
      var frame = b.rest > 0 && sp.gait !== "swoop" ? 0 : Math.floor(((b.phase % 1) + 1) % 1 * sp.frames) % sp.frames;
      if (b.rest > 0 && sp.gait === "swoop") { b.phase += 0.012; }
      var sheet = darkAt(it.lat, it.lon) > 0.5 ? sp.night : sp.day;
      var x = Math.round(it.p.x), y = Math.round(it.p.y);
      ctx.globalAlpha = a * 0.22;
      ctx.fillStyle = "#1a1430";
      ctx.fillRect(x - Math.round(sp.fw * s * 0.28), y, Math.round(sp.fw * s * 0.56), s);
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(x, y);
      if (b.facing < 0) { ctx.scale(-1, 1); }
      ctx.drawImage(sheet, frame * sp.fw, 0, sp.fw, sp.fh,
                    -Math.round(sp.groundX * s), -Math.round(sp.groundY * s), sp.fw * s, sp.fh * s);
      ctx.restore();
    });
    ctx.restore();
  }

  /* The procession, over the top of the world from one horizon to the
     other. Positions are kept as angles round the rim, so it keeps its
     spacing however near or far the world is. */
  var ARC = 1.25;
  /* Off at the artist's request (23 Sep 2026: "too much"). The code stays,
     like the creature's, and the Archive's Infinity monitor still plays it. */
  var PROCESSION = false;
  function walkerScale(spec) {
    var want = Math.max(16, Math.min(46, R * 0.07));
    var k = Math.max(1, Math.round(want * dpr / Math.max(20, spec.fh * 0.85)));
    return k / dpr;
  }
  function newWalker(u) {
    var spec = Systems.person(walkerSeed, dreamColours([]));
    walkerSeed += 1;
    return { spec: spec, u: u, phase: Math.random(), gap: 0.4 + Math.random() * 1.3, jump: -1e9 };
  }
  function stepProcession(now, dt) {
    var v = 12;                                           // pixels a second
    if (!walkers.length) {
      for (var u = 2 * ARC; u > 0;) {
        var w = newWalker(u);
        walkers.unshift(w);
        u -= (w.spec.fw * walkerScale(w.spec) * (1 + w.gap)) / Math.max(60, R);
      }
    }
    walkers.forEach(function (w) {
      var s = walkerScale(w.spec);
      w.u += v * dt / Math.max(60, R);
      w.phase += v * dt / (w.spec.stride * s);
    });
    walkers = walkers.filter(function (w) { return w.u < 2 * ARC; });
    var last = walkers[0];
    if (!last || last.u > (last.spec.fw * walkerScale(last.spec) * (1 + last.gap)) / Math.max(60, R)) {
      walkers.unshift(newWalker(0));
    }
    if (now - pointerAt.at < 400) {
      walkers.forEach(function (w) {
        var th = -ARC + w.u;
        var x = cx + R * Math.sin(th), y = cy - R * Math.cos(th);
        var dx = x - pointerAt.x, dy = y - w.spec.fh * walkerScale(w.spec) * 0.5 - pointerAt.y;
        if (dx * dx + dy * dy < 900 && now - w.jump > 700) { w.jump = now; }
      });
    }
  }

  function drawProcession(now, fade) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    walkers.forEach(function (w) {
      var th = -ARC + w.u;
      var x = cx + R * Math.sin(th), y = cy - R * Math.cos(th);
      if (x < -60 || x > W + 60 || y < -60 || y > H + 60) { return; }
      var ends = Math.min(w.u, 2 * ARC - w.u) / 0.22;
      var a = Math.min(1, Math.round(Math.min(1, ends) * 4) / 4) * fade;
      if (a <= 0) { return; }
      var sp = w.spec, s = walkerScale(sp);
      var frame = Math.floor(((w.phase % 1) + 1) % 1 * sp.frames) % sp.frames;
      var jt = (now - w.jump) / 420;
      var up = jt < 1 ? Math.round(Math.sin(Math.PI * jt) * 7) * s : 0;
      ctx.globalAlpha = a;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(th);
      ctx.drawImage(sp.day, frame * sp.fw, 0, sp.fw, sp.fh,
                    -sp.groundX * s, -sp.groundY * s - up, sp.fw * s, sp.fh * s);
      ctx.restore();
    });
    ctx.restore();
  }

  function living(now) {
    var dt = Math.min(0.1, Math.max(0, (now - livingAt) / 1000));
    livingAt = now;
    if (!LIVING || !R) { return; }
    var fade = 1 - nearness();
    // On a journey the weather is only there while the world is seen whole:
    // enlarged, it is no longer weather but blocks.
    if (journey) { fade = Math.min(fade, Math.max(0, (PHI - zoom) / (PHI - 1))); }
    if (fade <= 0.02) { return; }
    if (now - sun.at > 20000) {
      var s = sunNow(Date.now());
      sun.lat = s.lat; sun.lon = s.lon; sun.at = now;
    }
    stepClouds(now);
    var block = drawWeather(now, fade);
    drawLights(now, block, fade);
    if (still || !cities.length) { return; }
    if (!place && !flying) {
      // With PASSING on, on the Museums layer the company rests, and in its
      // slot one travelled work draws its journey (once whoever is out has gone).
      if (PASSING && ARTWORKS && layerOn === "museums" && artPlaces && !herd.length) { stepPassing(now); }
      else { stepHerd(now, dt); }
      if (PROCESSION) { stepProcession(now, dt); }
    }
    drawHerd(now, fade);
    if (PROCESSION) { drawProcession(now, fade); }
  }

  /* ---- how much of the globe is there -------------------------------------

     The globe is not allowed to dominate. It is always partly see-through,
     and how see-through is never still: it breathes between 1/phi-squared
     and 1/phi — 0.382 and 0.618, the two halves of the golden cut — and
     never outside them.

     There are three of these breaths, and they are what make it silk. The
     body of the sphere is one; each of the two families of threads is
     another. They run on periods that are successive powers of phi — about
     seven, eleven and eighteen seconds — and are set apart from each other
     by the golden angle, so they drift in and out of step and never line up
     the same way twice. When the threads running down are at their fullest
     the ones running round are fading, and then the other way: that is
     what shot silk does as it moves, the warp and the weft taking the light
     in turn. */

  var FLUX_BODY = Math.pow(PHI, 4) * 1000;     // 6.85 s
  var FLUX_DOWN = Math.pow(PHI, 5) * 1000;     // 11.09 s
  var FLUX_ROUND = Math.pow(PHI, 6) * 1000;    // 17.94 s

  function flux(now, period, phase, lo, hi) {
    lo = lo === undefined ? INV2 : lo;
    hi = hi === undefined ? INV : hi;
    var mid = (lo + hi) / 2;
    if (still) { return mid; }
    return mid + (hi - mid) * Math.sin(TAU * now / period + phase);
  }

  /* ---- patches, and the pulse from pole to pole ---------------------------

     Two more ways the globe is let go of, and both are the golden ratio.

     The patches. One for every word on the globe, centred where the word
     lies — see wordPatches — so where the words are is where the
     transparency comes and goes. Each fades between 1/phi-squared and all
     the way there on a period of its own, between phi-cubed and
     phi-to-the-sixth seconds, and neighbouring patches blend into each
     other, so what is seen is large, slow weather of transparency moving
     over the world, gathered round what it says.

     The pulse. Independent of all of that, a band of fading runs down the
     world from beyond the North Pole to beyond the South and begins again,
     every phi-to-the-fifth seconds — eleven. It is about 1/phi-to-the-fourth
     of a half-turn wide, and at its deepest it leaves 1/phi-squared of the
     globe showing. It follows the latitudes, not the screen, so it curves
     over the sphere as a line of latitude does.

     Both are worked out on a coarse grid — one cell to every eight pixels —
     by running the projection backwards from each cell to the point of the
     Earth under it, and laid over the globe as a mask. What the grid knows
     about the Earth is kept until the world is turned; what changes every
     frame is thirteen numbers and a latitude. */

  var VEIL = 8;                         // pixels of the screen to a cell
  var PULSE = Math.pow(PHI, 5) * 1000;  // 11.09 s, north to south
  var PULSE_WIDE = Math.PI / Math.pow(PHI, 4);

  /* The patches are the words. Every word on the globe is the middle of a
     patch of its own, fixed to wherever the word lies and moving when the
     word is put down somewhere new; every point of the Earth belongs,
     softly, to whichever words are nearest it, so the whole globe is shared
     out between them. A word's patch is as big and as slow as the word:
     the one carried by all seven collages holds the widest ground and
     breathes over phi-to-the-sixth seconds; a word from a single collage a
     small patch over phi-cubed. They start a golden angle apart, in the
     order the collages introduce them. */
  var patches = [];
  var patchesAt = "";

  function wordPatches() {
    var key = vocabulary.map(function (g) {
      return g.lat.toFixed(4) + "," + g.lon.toFixed(4);
    }).join(";");
    if (key === patchesAt) { return false; }
    patchesAt = key;
    patches = vocabulary.map(function (ground, i) {
      var mass = Math.max(0, Math.min(1, ground.mass || 0));
      var wide = (INV3 + INV2 * mass) * PHI;          // ~22 to ~57 degrees
      var cl = Math.cos(ground.lat);
      return {
        x: cl * Math.cos(ground.lon), y: cl * Math.sin(ground.lon), z: Math.sin(ground.lat),
        spread: 2 / (wide * wide),
        period: Math.pow(PHI, 3 + 3 * mass) * 1000,
        phase: i * GOLDEN
      };
    });
    return true;
  }

  var veilCanvas = document.createElement("canvas");
  var vctx = veilCanvas.getContext("2d");
  var veilImage = null;
  var veilSeen = { spin: null, tilt: null, cx: 0, cy: 0, r: 0, w: 0, h: 0 };
  var veilLat = null, veilIn = null, veilWeights = null;
  var layer = document.createElement("canvas");
  var lctx = layer.getContext("2d");

  /* Which point of the Earth is under each cell, and how much of each patch
     is there. Only when the view has changed. */
  function veilLook() {
    var mw = Math.max(1, Math.ceil(W / VEIL));
    var mh = Math.max(1, Math.ceil(H / VEIL));
    if (veilCanvas.width !== mw || veilCanvas.height !== mh || !veilImage) {
      veilCanvas.width = mw;
      veilCanvas.height = mh;
      veilImage = vctx.createImageData(mw, mh);
      veilLat = new Float32Array(mw * mh);
      veilIn = new Uint8Array(mw * mh);
    }
    var P = patches.length;
    if (!veilWeights || veilWeights.length !== mw * mh * P) {
      veilWeights = new Float32Array(mw * mh * P);
    }
    var dots = new Float64Array(P);
    var cosS = Math.cos(spin), sinS = Math.sin(spin);
    for (var j = 0; j < mh; j += 1) {
      for (var i = 0; i < mw; i += 1) {
        var n = j * mw + i;
        var X = ((i + 0.5) * VEIL - cx) / R;
        var Y = (cy - (j + 0.5) * VEIL) / R;
        var d2 = X * X + Y * Y;
        if (d2 >= 1) { veilIn[n] = 0; continue; }
        veilIn[n] = 1;
        var Z = Math.sqrt(1 - d2);
        // The lean, undone.
        var y = Y * COS_T + Z * SIN_T;
        var z = -Y * SIN_T + Z * COS_T;
        // The spin, undone: this is the point in the Earth's own frame.
        var ex = z * cosS - X * sinS;
        var ey = X * cosS + z * sinS;
        veilLat[n] = Math.asin(Math.max(-1, Math.min(1, y)));
        // How near each word's patch this point is, as a log; then shared
        // out, measured from the nearest so the far side of the world does
        // not underflow to nobody's.
        var sum = 0, base = n * P, top = -Infinity;
        for (var p = 0; p < P; p += 1) {
          var pt = patches[p];
          var dot = ex * pt.x + ey * pt.y + y * pt.z;
          dots[p] = (dot - 1) * pt.spread;
          if (dots[p] > top) { top = dots[p]; }
        }
        for (p = 0; p < P; p += 1) {
          var w = Math.exp(dots[p] - top);
          veilWeights[base + p] = w;
          sum += w;
        }
        for (p = 0; p < P; p += 1) { veilWeights[base + p] /= (sum || 1); }
      }
    }
    veilSeen.spin = spin; veilSeen.tilt = tilt; veilSeen.cx = cx; veilSeen.cy = cy;
    veilSeen.r = R; veilSeen.w = W; veilSeen.h = H;
  }

  function veil(now) {
    if (wordPatches()) { veilSeen.spin = null; }     // a word has moved
    // A turn of less than about a tenth of a degree moves no cell anywhere
    // that matters, and the world eases toward where it is going for ever.
    if (veilSeen.spin === null || Math.abs(veilSeen.spin - spin) > 0.0015 ||
        Math.abs(veilSeen.tilt - tilt) > 0.0015 || Math.abs(veilSeen.cx - cx) > 0.5 ||
        Math.abs(veilSeen.cy - cy) > 0.5 || Math.abs(veilSeen.r - R) > 0.5 ||
        veilSeen.w !== W || veilSeen.h !== H) {
      // Not while the world swings: the mask is magnified along with it.
      if (!moving() || veilSeen.spin === null) { veilLook(); }
    }
    var t = still ? 0 : now;
    var amount = patches.map(function (pt) {
      return 0.5 + 0.5 * Math.sin(TAU * t / pt.period + pt.phase);
    });
    var at = (Math.PI / 2 + 2 * PULSE_WIDE) -
             (Math.PI + 4 * PULSE_WIDE) * ((t / PULSE) % 1);
    var deep = still ? 0 : 1 - INV2;
    var data = veilImage.data;
    var cells = veilIn.length;
    var room = wordRoom();
    for (var n = 0; n < cells; n += 1) {
      var o = n * 4;
      if (!veilIn[n]) { data[o + 3] = 255; continue; }
      var P = amount.length, base = n * P, mix = 0;
      for (var p = 0; p < P; p += 1) { mix += veilWeights[base + p] * amount[p]; }
      var show = INV2 + (1 - INV2) * mix;
      var off = (veilLat[n] - at) / PULSE_WIDE;
      show *= 1 - deep * Math.exp(-off * off);
      if (room) { show *= room[n]; }
      data[o + 3] = Math.round(show * 255);
    }
    vctx.putImageData(veilImage, 0, 0);
  }

  /* Room for the words. The land is what the page is made of, but the words
     are what it says, so where a word lies the land thins out under it: down
     to 1/phi-cubed of itself inside the word's own outline, coming back to
     full over a margin phi times the word's height, which is a clearing
     rather than a hole. A word that is fading out clears less. */
  var roomCells = null;

  function wordRoom() {
    if (place || moving() || !vocabulary.length) { return null; }
    var mw = veilCanvas.width, mh = veilCanvas.height;
    if (!roomCells || roomCells.length !== mw * mh) { roomCells = new Float32Array(mw * mh); }
    roomCells.fill(1);
    var any = false;
    vocabulary.forEach(function (ground) {
      var b = ground.box;
      if (!b || !ground.el || ground.el.style.visibility === "hidden") { return; }
      any = true;
      var margin = b.ry * 2 * PHI;
      var reach = Math.max(b.rx, b.ry) + margin;
      var i0 = Math.max(0, Math.floor((b.x - reach) / VEIL));
      var i1 = Math.min(mw - 1, Math.ceil((b.x + reach) / VEIL));
      var j0 = Math.max(0, Math.floor((b.y - reach) / VEIL));
      var j1 = Math.min(mh - 1, Math.ceil((b.y + reach) / VEIL));
      var c = Math.cos(b.rot), s_ = Math.sin(b.rot);
      var most = (1 - INV3) * Math.min(1, b.fade / INV);
      for (var j = j0; j <= j1; j += 1) {
        for (var i = i0; i <= i1; i += 1) {
          var dx = (i + 0.5) * VEIL - b.x, dy = (j + 0.5) * VEIL - b.y;
          // Into the word's own frame, then how far outside its outline.
          var u = Math.max(0, Math.abs(dx * c + dy * s_) - b.rx);
          var v = Math.max(0, Math.abs(-dx * s_ + dy * c) - b.ry);
          var out = Math.sqrt(u * u + v * v) / margin;
          if (out >= 1) { continue; }
          var ease = 1 - out * out * (3 - 2 * out);      // smooth to nothing
          var keep = 1 - most * ease;
          var n = j * mw + i;
          if (keep < roomCells[n]) { roomCells[n] = keep; }
        }
      }
    });
    return any ? roomCells : null;
  }

  /* ---- grit and blur ------------------------------------------------------

     The globe is finer than it was and it is also rougher, which is less of
     a contradiction than it sounds: soil is both. Two things are done to it
     after everything else, and both grow as you go down into a city.

     Grit: a field of specks — dark crumbs in the soil's own browns, and a
     few pale grains — laid only where the globe is, never on the sky. It is
     baked into the body of the globe when that is painted, at 1/phi-squared
     from orbit and all the way there on the ground, and its specks grow
     by phi on the way down, so close to, the ground is gravel.

     Blur: part of the globe is laid down a second time, out of focus — made
     small and stretched back up, which is a blur that costs almost nothing.
     From orbit 1/phi-squared of it is soft, shrunk to 1/phi-squared of its
     size; on the ground 1/phi of it is soft, shrunk to 1/phi-to-the-fourth.
     So the near ground has a depth of field, and the sharp dots sit in a
     haze of themselves. */

  var softTick = 0;

  function nearness() {
    var n = Math.max(0, Math.min(1, (zoom - 1) / Math.max(0.001, CITY_ZOOM - 1)));
    // An art view is framed above the cities: the living world stays mostly
    // alive. A city of museums is the ground.
    return place && place.art && place.art.kind !== "town" ? Math.min(n, INV3) : n;
  }

  var soft = document.getElementById("world-soft");
  var gloss = document.getElementById("world-gloss");
  var glossCtx = gloss.getContext("2d");
  var glossSeen = { cx: 0, cy: 0, r: 0, w: 0, h: 0, dpr: 0 };
  var softShown = -1;
  var softCtx = soft.getContext("2d");
  var gritTile = null, gritPattern = null, gritFor = null;

  function makeGrit() {
    var size = 144;
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var CRUMBS = ["42,29,20", "58,40,27", "31,22,16", "74,52,34", "96,70,46"];
    var rnd = seedFrom("grit", 5);
    for (var i = 0; i < size * size * 0.07; i += 1) {
      var x = Math.floor(rnd() * size), y = Math.floor(rnd() * size);
      var pale = rnd() < 0.12;
      var d = rnd() < 0.2 ? 2 : 1;
      g.fillStyle = pale ? "rgba(255,250,240," + (0.5 + 0.4 * rnd()).toFixed(2) + ")"
                         : "rgba(" + CRUMBS[Math.floor(rnd() * CRUMBS.length)] + "," +
                           (0.35 + 0.55 * rnd()).toFixed(2) + ")";
      g.fillRect(x, y, d, d);
    }
    return c;
  }

  function grit(g, near) {
    if (!gritTile) { gritTile = makeGrit(); }
    if (gritFor !== g) { gritPattern = g.createPattern(gritTile, "repeat"); gritFor = g; }
    if (!gritPattern) { return; }
    var grain = 1 + (PHI - 1) * near;
    // It turns with the world, so the gravel is on the ground rather than
    // on the glass in front of it.
    var slide = ((spin * R) % 144 + 144) % 144;
    try {
      gritPattern.setTransform(new DOMMatrix([grain, 0, 0, grain, -slide, 0]));
    } catch (e) {}
    g.save();
    g.globalCompositeOperation = "source-atop";
    g.globalAlpha = INV2 + (1 - INV2) * near;
    g.fillStyle = gritPattern;
    g.fillRect(0, 0, W, H);
    g.restore();
  }

  /* ---- the swing -----------------------------------------------------------

     The Earth changes distance. Every eleven to twenty-nine seconds — phi to
     the fifth to phi to the seventh — while nobody has touched anything for
     a while and nobody is down in a city, it swings to a new distance and a
     new place in the sky: sometimes a horizon, sometimes a small world far
     off. And when it is small enough to be seen whole, pressing it brings it
     in: the point pressed comes toward you and the world grows round it.

     A swing is not a slide. The size is eased on a logarithmic scale, the
     way a camera's zoom is, and a press overshoots and settles back, as a
     thing thrown at you would. And the whole view swings in perspective as
     it goes — leaning back and round in three dimensions and settling flat
     again — so the world comes at you rather than merely getting bigger.

     While it swings nothing is woven again: what is already drawn is
     magnified, as it is on the way down into a city, and the real thing is
     laid down the moment it comes to rest. */

  var swing = null;
  var swungAt = 0;
  var nextSwing = 0;
  var lastTouch = 0;
  var handledAt = -1e9;          // when the view was last pinched, scrolled or dragged
  var SWING_IDLE = Math.pow(PHI, 4) * 1000;      // 6.9 s of nobody doing anything
  var SIZE_MOST = PHI * PHI;                     // as near as it can be brought: 2.6

  var burst = document.getElementById("burst");
  var burstCtx = burst.getContext("2d");

  /* Anything that is moving the view right now: a swing, or a hand. While
     it is, what is drawn is magnified rather than woven again. */
  /* Does what was last drawn, magnified to where the world is now, still
     cover the part of the window the world is in? When it stops doing so —
     the world has grown or slid past the edge of the picture — it has to be
     drawn again, or the picture's edge shows. */
  function covered() {
    var g = R / drawn.r;
    var x0 = cx - drawn.cx * g, x1 = cx + (W - drawn.cx) * g;
    var y0 = cy - drawn.cy * g, y1 = cy + (H - drawn.cy) * g;
    var nx0 = Math.max(0, cx - R), nx1 = Math.min(W, cx + R);
    var ny0 = Math.max(0, cy - R), ny1 = Math.min(H, cy + R);
    return x0 <= nx0 + 1 && x1 >= nx1 - 1 && y0 <= ny0 + 1 && y1 >= ny1 - 1;
  }

  function moving() {
    return !!swing || performance.now() - handledAt < 180;
  }

  function swingWait() {
    return (Math.pow(PHI, 5) + Math.random() * (Math.pow(PHI, 7) - Math.pow(PHI, 5))) * 1000;
  }

  /* Never leave the world stranded. A big one keeps the middle of the
     window well inside it, so there is always ground in front of you; a
     small one keeps its near edge within reach of the middle. Whatever the
     view does, there is always something to press, pinch or drag. */
  function keepHold(t) {
    var r = base0 * t.size;
    var ox = W / 2 + t.dx * W, oy = orbitFor(r) + t.dy * H;
    var sx = W / 2, sy = H / 2;
    var ddx = ox - sx, ddy = oy - sy;
    var d = Math.sqrt(ddx * ddx + ddy * ddy);
    var most = r > Math.min(W, H) * 0.5 ? r * 0.72 : r + Math.min(W, H) * 0.28;
    if (d > most && d > 0) {
      ox = sx + ddx * most / d;
      oy = sy + ddy * most / d;
      t.dx = (ox - W / 2) / W;
      t.dy = (oy - orbitFor(r)) / H;
    }
    return t;
  }

  function setSeat(t) {
    seat.size = t.size; seat.dx = t.dx; seat.dy = t.dy;
    baseR = base0 * seat.size;
    reframe();
  }

  /* The seat that keeps a point of the screen over the same point of the
     world while the world is made bigger or smaller: zooming about it. */
  function seatAbout(px, py, size) {
    var r1 = base0 * size;
    var k = r1 / (base0 * seat.size);
    var c1x = px - k * (px - cx), c1y = py - k * (py - cy);
    return { size: size, dx: (c1x - W / 2) / W, dy: (c1y - orbitFor(r1)) / H };
  }

  /* Three ways to swing. A drift is the world changing distance on its own,
     slow and even. A bounce is a tap on the sky: a spring, over and back.
     A rocket is a press on a small world: it winds back, then fires —
     the world blows up toward you with the air streaking past, a flash and
     a ring going out, the whole view kicked in perspective and shaking as
     it lands, and a little spring at the end. */
  function swingTo(to, dur, kind) {
    to = keepHold(to);
    var rays = [];
    for (var i = 0; i < 84; i += 1) {
      rays.push({ a: Math.random() * TAU, len: 0.12 + Math.random() * 0.3,
                  off: Math.random() * 0.35, w: 0.6 + Math.random() * 2.2,
                  gold: Math.random() < 0.18 });
    }
    swing = {
      from: { size: seat.size, dx: seat.dx, dy: seat.dy },
      to: to, at: performance.now(), dur: still ? 1 : dur, kind: kind, last: 0,
      rays: rays,
      lx: (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.4 * Math.random()),
      ly: (Math.random() < 0.5 ? -1 : 1) * (0.6 + 0.4 * Math.random())
    };
    gloss.style.opacity = "0";
    stage.style.transition = "none";
  }

  function inOut(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }

  // A spring let go: shoots past, comes back, settles.
  function spring(p, stiff, wobble) {
    return 1 - Math.exp(-stiff * p) * Math.cos(wobble * p);
  }

  var WIND = 0.14;                 // the share of a rocket spent winding back

  function stepSwing(now) {
    if (!swing) { return; }
    var t = Math.min(1, (now - swing.at) / swing.dur);
    var e, kick = 0, speed = 0;
    if (swing.kind === "rocket") {
      if (t < WIND) {
        e = -0.09 * Math.sin(Math.PI / 2 * t / WIND);          // winding back
      } else {
        var q = (t - WIND) / (1 - WIND);
        e = spring(q, 6.4, 10.5);
        speed = Math.exp(-6.4 * q);                            // the thrust, dying
        kick = q;
      }
    } else if (swing.kind === "bounce") {
      e = spring(t, 5.2, 9);
    } else {
      e = inOut(t);
    }
    var f = swing.from, g = swing.to;
    setSeat({
      size: Math.exp(Math.log(f.size) + (Math.log(g.size) - Math.log(f.size)) * e),
      dx: f.dx + (g.dx - f.dx) * e,
      dy: f.dy + (g.dy - f.dy) * e
    });

    // The view in perspective. A drift leans gently; a bounce and a rocket
    // are kicked hard and settle, and a rocket shakes as it lands.
    var amp = (swing.kind === "drift" ? 6 : 12) * (1 - t);
    var wave = Math.sin(1.5 * Math.PI * t);
    var tf = "perspective(" + Math.round(Math.max(W, H) * (swing.kind === "rocket" ? INV : PHI)) + "px)" +
             " rotateX(" + (amp * wave * swing.lx).toFixed(2) + "deg)" +
             " rotateY(" + (amp * wave * swing.ly * INV).toFixed(2) + "deg)";
    if (swing.kind === "rocket" && kick > 0.18 && kick < 0.7) {
      var shake = 5 * (1 - (kick - 0.18) / 0.52);
      tf = "translate(" + ((Math.random() - 0.5) * shake).toFixed(1) + "px," +
           ((Math.random() - 0.5) * shake).toFixed(1) + "px) " + tf;
    }
    stage.style.transform = tf;
    // Motion blur while it is going fastest.
    stage.style.filter = speed > 0.05 ? "blur(" + (speed * 6).toFixed(2) + "px)" : "";

    drawBurst(swing, t, kick, speed);

    if (t >= 1) {
      swing = null;
      stage.style.transform = "";
      stage.style.filter = "";
      stage.style.transition = "";
      burstCtx.clearRect(0, 0, burst.width, burst.height);
      nextSwing = now + swingWait();
    }
  }

  /* A place pressed while the world is still swinging: the swing stops
     where it is, so the place is framed at the size the world really has
     when it is flown to, not one it is about to leave. */
  function settleSwing() {
    if (!swing) { return; }
    swing = null;
    stage.style.transform = "";
    stage.style.filter = "";
    stage.style.transition = "";
    burstCtx.clearRect(0, 0, burst.width, burst.height);
    nextSwing = performance.now() + swingWait();
  }

  /* The air going past: rays out of the middle of the window, a flash as
     it fires, and a ring blowing outward. Only for a rocket. */
  function drawBurst(sw, t, kick, speed) {
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (burst.width !== pw || burst.height !== ph) { burst.width = pw; burst.height = ph; }
    var g = burstCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (sw.kind !== "rocket" || t < WIND || kick > 0.62) { return; }
    var q = kick / 0.62;                 // 0 at the firing, 1 when the air has gone by
    // Held frames, like everything else made of pixels here.
    q = Math.floor(q * 18) / 18;
    var fx = W / 2, fy = H * INV;        // where it is flying to
    var D = Math.sqrt(W * W + H * H);
    var P = 3;                           // the streaks are made of three-pixel squares

    // The streaks: each a dotted line of square pixels on a three-pixel
    // grid, rushing outward, thinning and fading in steps as the air goes by.
    // (The ring and the light are the tiles' — pulse() fired them.)
    sw.rays.forEach(function (ray) {
      var r0 = D * (0.1 + ray.off + q * 0.9);
      var r1 = r0 + D * ray.len * (0.4 + speed);
      var ca = Math.cos(ray.a), sa = Math.sin(ray.a);
      g.fillStyle = ray.gold ? "#d6b05c" : "#ffffff";
      g.globalAlpha = LEVELS[Math.max(1, Math.ceil((1 - q) * 4))] * 2;
      var size = ray.w * (1 + speed) > 2.4 ? P * 2 : P;
      for (var rr = r0; rr < r1; rr += P * 2) {
        var px = Math.round((fx + ca * rr) / P) * P;
        var py = Math.round((fy + sa * rr) / P) * P;
        g.fillRect(px, py, size, size);
      }
    });
    g.globalAlpha = 1;
  }

  ["pointerdown", "keydown", "wheel"].forEach(function (name) {
    document.addEventListener(name, function () { lastTouch = performance.now(); },
                              { capture: true, passive: true });
  });

  function autoSwing(now) {
    if (!nextSwing) { nextSwing = now + swingWait(); return; }
    if (swing || now < nextSwing) { return; }
    if (place || flying || deckMode || turning || panning || pinch || still ||
        document.hidden || now - lastTouch < SWING_IDLE) {
      nextSwing = now + 1500;           // try again shortly
      return;
    }
    swingTo(dealSeat(), FLY * PHI * PHI, "drift");
  }

  /* Framing a route (the exquisite corpse's unfolding, corpse.js, through
     Land.frame): the world turned so the route's middle faces you, rolled
     so it stands a little above the window's middle, and drawn back, once,
     until every point of it is on the screen with room round it. The world
     holds still while it is framed (no drift) for `hold` ms. It is never
     brought nearer than the whole world in the window. */
  var framing = null;

  function frameRoute(pts, hold) {
    if (place || flying || !pts || !pts.length) { return false; }
    var x = 0, y = 0, z = 0;
    pts.forEach(function (p) {
      var la = p[0] * RAD, lo = p[1] * RAD;
      x += Math.cos(la) * Math.cos(lo); y += Math.cos(la) * Math.sin(lo); z += Math.sin(la);
    });
    var lat = Math.atan2(z, Math.sqrt(x * x + y * y)), lon = Math.atan2(y, x);
    var now = performance.now();
    framing = { pts: pts, lat: lat, lon: lon, at: now, until: now + (hold || 30000), sized: 0 };
    wanted = lon;
    nextSwing = now + (hold || 30000);
    return true;
  }

  function stepFraming(now) {
    if (!framing) { return; }
    if (place || flying || turning || pinch || now > framing.until) { framing = null; return; }
    nextSwing = Math.max(nextSwing, now + 1500);
    var p = project(framing.lat, framing.lon);
    if (p.z > 0) {
      var err = (p.y - H * 0.42) / Math.max(R, 1);
      if (Math.abs(err) > 0.002) { lean(tilt - Math.max(-0.03, Math.min(0.03, err * 0.25))); reframe(); }
    }
    // Drawn back until it all fits: twice, a beat apart, as the roll settles.
    if (!swing && framing.sized < 2 && now - framing.at > 700 + framing.sized * 1400) {
      framing.sized += 1;
      var x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, behind = 0;
      framing.pts.forEach(function (q) {
        var s2 = project(q[0] * RAD, wrap(q[1] * RAD));
        if (s2.z <= 0.05) { behind += 1; return; }
        x0 = Math.min(x0, s2.x); x1 = Math.max(x1, s2.x); y0 = Math.min(y0, s2.y); y1 = Math.max(y1, s2.y);
      });
      var k = 1;
      if (behind) { k = 0.62; }
      else if (x1 > x0 || y1 > y0) { k = Math.min(1.25, (W * 0.72) / Math.max(1, x1 - x0), (H * 0.5) / Math.max(1, y1 - y0)); }
      // Never nearer than the whole world in the window: a short route is framed on the globe, not in a city.
      k = Math.min(k, Math.min(W, H) * 0.46 / Math.max(R, 1));
      if (Math.abs(k - 1) > 0.06) {
        var size = Math.max(SIZE_FAR, Math.min(SIZE_NEAR, seat.size * k));
        swingTo({ size: size, dx: 0, dy: 0 }, FLY * PHI, "drift");
      }
    }
  }

  /* A press on a small world fires it at you, round the point pressed. */
  function pressGlobe(x, y) {
    if (place || flying || swing || deckMode) { return false; }
    if (R > Math.min(W, H) * 0.5) { return false; }     // not small enough
    if (!unproject(x, y)) { return false; }
    var size = 1 + Math.random() * (SIZE_NEAR - 1);
    var r1 = base0 * size;
    var k = r1 / R;
    // Where the point pressed should end up: the middle of the window, a
    // little above, where a big globe's land is.
    var tx = W / 2, ty = H * INV;
    var c1x = tx - k * (x - cx), c1y = ty - k * (y - cy);
    pulse(x, y, [LIGHT, "#d6b05c", LIGHT], 1.3, Math.max(W, H) * 0.9);
    sparkle(x, y, ["#d6b05c", LIGHT, "#ffffff"], 28);
    swingTo({
      size: size,
      dx: (c1x - W / 2) / W,
      dy: (c1y - orbitFor(r1)) / H
    }, FLY * PHI, "rocket");
    return true;
  }

  /* ---- the doors ------------------------------------------------------------

     The artist, 1 Oct 2026: "I still want you to be able to select an artwork
     from any pixel." Every cell of the globe wears one saved work's colour
     (earth-body.js), and is a door to it. Everything else that can be
     pressed is pressed first — a city, a gallery, a stop, the world brought
     in, the wave held and let go; only a plain quick tap on bare land or sea
     is the door's. Pointing at a cell (with a mouse, once it rests) or a
     first tap (on a touch screen) lights the cell and names its work small
     beside it; a second tap on the same cell, or a click, opens the work's
     history, flown to as anything else is. */
  var doorLabel = null;
  var doorShown = null;                 // { d: the door, x, y, at }
  var doorRest = 0;
  var HOVER = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  function doorable() {
    if (!bodyOn() || flying || swing || deckMode || dive.on || finder.open) { return false; }
    if (!place) { return true; }
    // In a city of museums or a work's history the ground is the globe's; not
    // in a collage's city (where a collage is read), a museum or a building.
    // Nor over a place gone down to in a life or a studio: it is that place,
    // in that year, and a saved work named at random over it is noise.
    if (art && art.kind === "town" && art.via && art.via.studio) { return false; }
    return !!(place.art && !buildingOn && !place.museum && !place.stage);
  }

  function doorAtPoint(x, y) {
    var at = unproject(x, y);
    return at ? EarthBody.doorAt(at.lat, at.lon, R) : null;
  }

  function showDoor(d, x, y) {
    if (!doorLabel) {
      doorLabel = el("p", "door-label");
      doorLabel.setAttribute("aria-live", "polite");
      doorLabel.hidden = true;
      land.appendChild(doorLabel);
    }
    doorShown = { d: d, x: x, y: y, at: performance.now() };
    EarthBody.light(d, 1);
    var shown = doorShown;
    readFinding().then(function (f) {
      if (doorShown !== shown) { return; }
      var w = f && f.byId[d.id];
      doorLabel.textContent = "";
      doorLabel.appendChild(el("span", "door-title", w ? w.t : "A saved work"));
      if (w && w.a) { doorLabel.appendChild(el("span", "door-by", w.a)); }
      doorLabel.hidden = false;
      // Beside the cell — right, left, above, below, the first clear of the
      // dial — inside the band the globe is shown in (clear of the column).
      var bw = doorLabel.offsetWidth, bh = doorLabel.offsetHeight, gap = 12;
      var band = place && art ? artBand() : { x: 0, y: 68, w: W, h: H - 136 };
      var avoid = [].slice.call(document.querySelectorAll(".dial")).map(function (e) { return e.getBoundingClientRect(); })
        .filter(function (r) { return r.width > 0; });
      var best = null;
      [[x + gap, y - bh / 2], [x - gap - bw, y - bh / 2], [x - bw / 2, y - gap - bh], [x - bw / 2, y + gap]].forEach(function (xy) {
        var lx = Math.max(band.x + 8, Math.min(band.x + band.w - bw - 8, xy[0]));
        var ly = Math.max(band.y + 8, Math.min(band.y + band.h - bh - 8, xy[1]));
        var cover = 0;
        avoid.forEach(function (r) {
          var ox = Math.min(lx + bw, r.right + 6) - Math.max(lx, r.left - 6), oy = Math.min(ly + bh, r.bottom + 6) - Math.max(ly, r.top - 6);
          if (ox > 0 && oy > 0) { cover += ox * oy; }
        });
        // never over the cell itself
        if (x > lx - 4 && x < lx + bw + 4 && y > ly - 4 && y < ly + bh + 4) { cover += bw * bh; }
        if (!best || cover < best.cover) { best = { x: lx, y: ly, cover: cover }; }
      });
      doorLabel.style.transform = "translate(" + Math.round(best.x) + "px," + Math.round(best.y) + "px)";
      doorLabel.dataset.on = "true";
    });
  }

  function hideDoor() {
    if (!doorShown) { return; }
    doorShown = null;
    if (bodyOn()) { EarthBody.light(null); }
    if (doorLabel) { delete doorLabel.dataset.on; doorLabel.hidden = true; }
  }

  function sameDoor(a, b) { return a && b && a.i === b.i && a.j === b.j && a.k === b.k; }

  // A quick tap on bare land or sea. True if the door took it.
  function pressDoor(x, y) {
    if (!doorable()) { return false; }
    var d = doorAtPoint(x, y);
    if (!d) { return false; }
    if (HOVER || (doorShown && sameDoor(doorShown.d, d))) {
      hideDoor();
      pulse(x, y, [LIGHT, LILAC], 0.5, 89);
      openArt({ work: d.id }, {});
      return true;
    }
    pulse(x, y, [LIGHT], 0.35, 55);
    showDoor(d, x, y);
    return true;
  }

  // With a mouse: the cell under the pointer is named once the pointer rests.
  function pointDoor(x, y) {
    if (!HOVER) { return; }
    clearTimeout(doorRest);
    if (doorShown && Math.abs(x - doorShown.x) + Math.abs(y - doorShown.y) > 6) { hideDoor(); }
    if (!doorable()) { return; }
    // The works' names are read the first time the pointer is on the world.
    if (!finding && !pointDoor.asked && unproject(x, y)) { pointDoor.asked = true; readFinding(); }
    doorRest = setTimeout(function () {
      if (!doorable() || turning || panning || pinch) { return; }
      // Only over the world itself: resting on a mark (a name on the globe, a
      // pill), the column or the dial, that is what is pointed at, not the
      // ground under it.
      var over = document.elementFromPoint(x, y);
      if (over && over !== canvas && over !== stage && over !== land && !(over.classList && over.classList.contains("world"))) {
        hideDoor();
        return;
      }
      var d = doorAtPoint(x, y);
      if (d) { showDoor(d, x, y); } else { hideDoor(); }
    }, 320);
  }

  /* A tap on the empty sky bounces the view somewhere new — near or far —
     which is also the way out of any view that has stopped being useful. */
  function pressSky(x, y) {
    // A tap on the sky puts Find away first.
    if (finder.open) { closeFinder(); return true; }
    if (place || flying || swing || deckMode) { return false; }
    if (unproject(x, y)) { return false; }
    pulse(x, y, [LIGHT], 0.8);
    swingTo(dealSeat(), FLY * PHI, "bounce");
    return true;
  }

  /* ---- by hand: pinch, scroll, and dragging the sky --------------------

     Up on the globe the view is yours to move as well as the world's. Two
     fingers pinch it nearer or further, about the point between them; a
     scroll wheel or a trackpad does the same about the pointer; dragging
     on the sky, off the world, carries the world across it. Dragging on
     the world still turns it. */

  var panning = null;
  var pinch = null;
  var fingers = {};

  function handle(t) {
    setSeat(keepHold(t));
    handledAt = performance.now();
    lastTouch = handledAt;
  }

  function pinchState() {
    var ids = Object.keys(fingers);
    if (ids.length < 2) { return null; }
    var a = fingers[ids[0]], b = fingers[ids[1]];
    var dx = a.x - b.x, dy = a.y - b.y;
    return { d: Math.max(20, Math.sqrt(dx * dx + dy * dy)),
             x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  stage.addEventListener("wheel", function (event) {
    if (place || flying || swing || deckMode || groundOn) { return; }
    event.preventDefault();
    var step = event.ctrlKey ? 0.012 : 0.0016;         // a trackpad pinch comes as ctrl+wheel
    if (dive.on || (seat.size >= SIZE_MOST - 1e-6 && event.deltaY < 0)) {
      // Past the globe's nearest: scrolling on is the dive; it settles when the scrolling stops.
      diveTo(dive.log - event.deltaY * step * (event.deltaMode === 1 ? 16 : 1), event.clientX, event.clientY);
      window.clearTimeout(dive.timer);
      if (dive.raw >= 1 || dive.log <= 0) { diveEnd(); }
      else { dive.timer = window.setTimeout(diveEnd, 520); }
      return;
    }
    var size = Math.max(SIZE_FAR * INV, Math.min(SIZE_MOST,
      seat.size * Math.exp(-event.deltaY * step)));
    handle(seatAbout(event.clientX, event.clientY, size));
  }, { passive: false });

  /* ---- the telescope ----  /* ---- the telescope --------------------------------------------------------

     Seen from far enough off, the Earth is a marble, and it has company:
     the Hubble Space Telescope, in orbit round it. It goes round once every
     phi-to-the-seventh seconds — twenty-nine — on a tilted ring a third
     again as wide as the world, passing in front of it and behind it; it
     turns slowly as it goes, and it is as big as the world is small. It is
     only there when the world is far off: as the Earth comes in, the
     telescope is left behind. Pressing it opens one of its own photographs.
     */

  var scope = document.getElementById("hubble");
  var ORBIT = Math.pow(PHI, 7) * 1000;
  var scopeShown = false;

  function placeHubble(now) {
    var far = base0 * INV;                  // nearer than this, it is not there
    var show = !place && !flying && R < far;
    var fade = show ? Math.min(1, (far - R) / (far * INV2)) : 0;
    if (!show || fade <= 0.01) {
      if (scopeShown) { scope.hidden = true; scopeShown = false; }
      return;
    }
    if (!scopeShown) { scope.hidden = false; scopeShown = true; }

    var t = still ? 0.3 : now / ORBIT;
    var a = TAU * t;
    var ring = R * (1.34 + 0.06 * Math.sin(TAU * t * PHI));
    var x = cx + Math.cos(a) * ring;
    var y = cy + Math.sin(a) * ring * 0.36 - R * 0.22 * Math.cos(a * 0.5);
    var front = Math.sin(a);                 // toward us when positive

    // Hidden by the world as it passes behind it.
    var seen = 1;
    if (front < 0) {
      var dx = x - cx, dy = y - cy;
      var inside = Math.sqrt(dx * dx + dy * dy) / R;
      seen = Math.max(0, Math.min(1, (inside - 0.86) / 0.22));
    }
    var size = Math.max(64, Math.min(200, R * 0.62)) * (0.84 + 0.16 * front);
    var turn = Math.sin(TAU * t * 2.2) * 14;         // a slow tumble
    var mirror = Math.cos(a + Math.PI / 2) < 0 ? -1 : 1;     // facing the way it goes
    scope.style.width = size.toFixed(1) + "px";
    scope.style.opacity = (fade * seen).toFixed(3);
    scope.style.zIndex = front < 0 ? "1" : "15";
    scope.style.pointerEvents = seen * fade > 0.3 ? "auto" : "none";
    scope.style.transform =
      "translate(" + (x - size / 2).toFixed(1) + "px," + (y - size * 0.25).toFixed(1) + "px)" +
      " rotate(" + turn.toFixed(2) + "deg) scale(" + mirror + ",1)";
  }

  scope.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
  scope.addEventListener("click", function () {
    var pool = hubble.tokens;
    var href = pool.length ? pool[Math.floor(Math.random() * pool.length)].href
                           : "https://images.nasa.gov/search?q=hubble&media=image";
    window.open(href, "_blank", "noopener");
  });

  /* ---- the clear coat -------------------------------------------------------

     Finish. Everything under this is matte — dots, soil, grit, haze — and a
     matte sphere reads as a model. What makes a surface look expensive is a
     clear coat over it, lit in a studio: one hard hot spot where the key
     light lands, a pair of long thin softbox strips beside it bent to the
     curve of the body, a dark band where the coat turns away from the
     light, and a knife-edge of reflected sky right at the rim.

     All of it is drawn on a canvas of its own over the globe, only when the
     globe moves on the screen, and the browser lays it on for free. It
     belongs to the globe seen whole; on the way down into a city it lifts
     off, and it comes back when you come up. */

  function drawGloss() {
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (gloss.width !== pw || gloss.height !== ph) { gloss.width = pw; gloss.height = ph; }
    var g = glossCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    g.save();
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.clip();

    // Where the key light lands: a point of the sphere up and to the left,
    // held a golden section down the part of the globe that is on the screen.
    var top = Math.max(0, cy - R), bottom = Math.min(H, cy + R);
    var hy = top + (bottom - top) * INV3;
    var ny = Math.max(-0.98, Math.min(0.98, (cy - hy) / R));
    var nx = -INV2 * Math.sqrt(1 - ny * ny);
    var hx = cx + nx * R;

    // The dark band where the coat turns from the light, and the edge of
    // sky it reflects right at the rim — the two together are what make the
    // contour crisp rather than soft.
    var rim = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R);
    rim.addColorStop(0, "rgba(20, 22, 30, 0)");
    rim.addColorStop(0.55, "rgba(20, 22, 30, 0.07)");
    rim.addColorStop(0.8, "rgba(20, 22, 30, 0)");
    rim.addColorStop(0.9, "rgba(255, 255, 255, 0.55)");
    rim.addColorStop(0.955, "rgba(255, 255, 255, 0.08)");
    rim.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = rim;
    g.fillRect(0, 0, W, H);

    // The bloom round the hot spot, and the hot spot.
    var bloom = g.createRadialGradient(hx, hy, 0, hx, hy, R * INV3);
    bloom.addColorStop(0, "rgba(255, 255, 255, 0.34)");
    bloom.addColorStop(INV2, "rgba(255, 255, 255, 0.08)");
    bloom.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = bloom;
    g.fillRect(0, 0, W, H);

    var spot = g.createRadialGradient(hx, hy, 0, hx, hy, Math.max(6, R * 0.022));
    spot.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    spot.addColorStop(0.5, "rgba(255, 255, 255, 0.42)");
    spot.addColorStop(1, "rgba(255, 255, 255, 0)");
    g.fillStyle = spot;
    g.fillRect(0, 0, W, H);

    // Two softbox strips, long and thin, laid along the curve of the body
    // through the hot spot: each is an arc of a circle concentric with the
    // globe, so it bends exactly as the surface does.
    var dist = Math.sqrt((hx - cx) * (hx - cx) + (hy - cy) * (hy - cy));
    var at = Math.atan2(hy - cy, hx - cx);
    [[-0.018, 0.5, 0.09], [0.02, 0.32, 0.06]].forEach(function (strip) {
      var r = dist + strip[0] * R;
      var sweep = strip[2] * Math.PI;
      var band = g.createRadialGradient(cx, cy, r - R * 0.006, cx, cy, r + R * 0.006);
      band.addColorStop(0, "rgba(255, 255, 255, 0)");
      band.addColorStop(0.5, "rgba(255, 255, 255, " + strip[1] + ")");
      band.addColorStop(1, "rgba(255, 255, 255, 0)");
      g.save();
      // Fade the ends of the strip out along its length.
      var ends = g.createLinearGradient(
        cx + Math.cos(at - sweep) * r, cy + Math.sin(at - sweep) * r,
        cx + Math.cos(at + sweep) * r, cy + Math.sin(at + sweep) * r);
      ends.addColorStop(0, "rgba(0,0,0,0)");
      ends.addColorStop(0.5, "rgba(0,0,0,1)");
      ends.addColorStop(1, "rgba(0,0,0,0)");
      g.beginPath();
      g.arc(cx, cy, r + R * 0.007, at - sweep, at + sweep);
      g.arc(cx, cy, r - R * 0.007, at + sweep, at - sweep, true);
      g.closePath();
      g.clip();
      g.fillStyle = band;
      g.fillRect(0, 0, W, H);
      g.globalCompositeOperation = "destination-in";
      g.fillStyle = ends;
      g.fillRect(0, 0, W, H);
      g.restore();
    });

    g.restore();
    glossSeen.cx = cx; glossSeen.cy = cy; glossSeen.r = R;
    glossSeen.w = W; glossSeen.h = H; glossSeen.dpr = dpr;
  }

  function placeGloss() {
    var whole = !place && !flying && !moving();
    gloss.style.opacity = whole ? "1" : "0";
    if (!whole) { return; }
    if (Math.abs(glossSeen.cx - cx) > 0.5 || Math.abs(glossSeen.cy - cy) > 0.5 ||
        Math.abs(glossSeen.r - R) > 0.5 || glossSeen.w !== W || glossSeen.h !== H ||
        glossSeen.dpr !== dpr) {
      drawGloss();
    }
  }

  /* The room the globe hangs in is the stage's background, in land.css —
     the same five stops of the sky it always had. All that is drawn for it
     here is the shadow just beyond the globe's contour, which is what seats
     it, and that goes on the soft canvas, where it belongs. */
  function seatShadow(ctx, boost) {
    var a = Math.min(1, 0.045 * boost);
    var g = ctx.createRadialGradient(cx, cy, R * 0.99, cx, cy, R * 1.06);
    g.addColorStop(0, "rgba(58, 64, 88, " + a.toFixed(3) + ")");
    g.addColorStop(1, "rgba(58, 64, 88, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  /* The body of the sphere, onto whichever surface is handed in. Its threads
     are woven onto surfaces of their own, by drawCloth. */
  function paintSphere(ctx, lit) {

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    if (DIRT_LOOK) {
      // DIRT's globe: a dark body, lit from where the light is, its edge
      // turning away into the ground it hangs in.
      var body = ctx.createRadialGradient(lit.x, lit.y, R * 0.04, cx, cy, R * 1.05);
      body.addColorStop(0, "#2a1f16");
      body.addColorStop(0.5, "#1a130d");
      body.addColorStop(1, "#0b0806");
      ctx.fillStyle = body;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.restore();
      return;
    }
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
      if (!mass || !mass.tone) { return; }
      var p = project(mass.lat, mass.lon);
      if (p.z <= 0.02) { return; }

      // A breath of colour under the weave, not the land itself. The land is
      // what the dots do over it — see drawWeave below.
      var fade = Math.min(1, p.z * 1.5) * 0.22;
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
    var clear = false;
    for (var pass = 0; pass < 50; pass += 1) {
      clear = true;
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

    // And if fifty passes did not get it clear, leave it where it was. It
    // used to take the spot anyway: the separation was only ever a nudge per
    // pass, so a word that could not find room simply came round the front
    // sitting on top of its neighbour. Now a replanting that does not work
    // does not happen, and it tries again next time round.
    if (!clear) {
      ground.lat = wasLat;
      ground.lon = wasLon;
      return false;
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

  /* The words are off the globe (artist's request, 23 Sep 2026): up there
     only what names a place is written. The words work at a collage's own
     site instead — see "the reading". GLOBE_WORDS = true puts them back. */
  var GLOBE_WORDS = false;

  function placeWords() {
    if (!GLOBE_WORDS) {
      vocabulary.forEach(function (ground) {
        ground.box = null;
        if (ground.el) { ground.el.style.visibility = "hidden"; ground.el.dataset.behind = "true"; }
      });
      return;
    }
    vocabulary.forEach(function (ground) {
      var el = ground.el;
      var p = project(ground.lat, ground.lon);

      // Turned away, or cut in half by the edge of the room. Words used to be
      // dropped well before the horizon, because at full width they piled into
      // each other there; now they lie down on the surface instead, so they
      // can be carried all the way round.
      if (p.z <= 0.05 || p.x < 14 || p.x > W - 14) {
        ground.box = null;
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

      // Two things take a word down: going round the edge, and being turned
      // away from you where it stands. The second is what `squash` measures —
      // 1 dead ahead, about 0.45 at the limb where the surface is edge-on —
      // so the more the roundness has distorted a word, the fainter it is.
      // It is also what makes the crowding at the horizon stop shouting.
      var fade = (INV2 + INV * Math.min(1, (p.z - 0.05) / 0.32)) *
                 (0.45 + 0.55 * p.squash);
      // And they are as near as the world is: a small world far off carries
      // small words, and the smallest of them are not written at all.
      var far = Math.min(1, R / Math.max(1, base0));
      var scale = (0.64 + 0.36 * p.z) * far;
      if (ground.ph && ground.ph * scale < 9) {
        ground.box = null;
        el.style.visibility = "hidden";
        return;
      }

      // A word may lie right up to the rim but not over it into the sky:
      // it fades as its outline reaches the edge of the world, and is gone
      // before any of it would hang off.
      if (ground.pw) {
        var edge = R - Math.sqrt((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy));
        var reach = Math.max(ground.ph * scale / 2,
          ground.pw * scale * p.squash / 2 * Math.abs(Math.sin(p.lie * RAD))) + 6;
        fade *= Math.max(0, Math.min(1, (edge - reach) / Math.max(1, reach)));
        if (fade < 0.02) {
          ground.box = null;
          el.style.visibility = "hidden";
          return;
        }
      }

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

      // Where it lies, for the land to make room around it (see veil).
      if (!ground.pw) { ground.pw = el.offsetWidth; ground.ph = el.offsetHeight; }
      ground.box = {
        x: p.x, y: p.y,
        rx: ground.pw * scale * p.squash / 2,
        ry: ground.ph * scale / 2,
        rot: p.lie * RAD,
        fade: fade
      };
    });
  }

  /* Where a thing on the ground stands in the stack: further down the screen
     is nearer the viewer. Forty to sixty-five, which leaves the words below
     and the banner above. */
  function depth(y) {
    return 42 + Math.round(Math.max(0, Math.min(1, y / Math.max(1, H))) * 23);
  }

  function placeCreature() {
    var p = project(beast.lat, beast.lon);
    var close = 0.72 + 0.46 * Math.max(0, p.z);
    var scale = close * Math.max(0.5, Math.min(place ? 1.85 : 1.15, R / 620));

    creature.style.opacity = p.z <= 0 ? "0" : "1";
    creature.style.zIndex = String(depth(p.y));
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

  /* As sharp as the screen can go, and never blurry (the artist, 8 Oct
     2026: "The globe is blurry for some reason. Make sure the globe is never
     blurry and consistently the same across all places"). Every globe starts
     at every pixel the screen has, up to three to one. A machine that cannot
     keep up is helped only where the globe is large — a small globe (the
     reading's lens, a far world: under 35 % of the window) is shaded over its
     own area alone (earth-body.js scissors to it) and always drawn at the
     screen's full density. A large globe steps down by whole divisors of the
     screen's density (3 → 1.5 → 1 on a phone, then the body alone by two),
     and the canvases are shown pixelated, so a coarser density is coarser
     crisp squares, never a stretched smear. The test is the frame's own work
     as well as the frame rate: Low Power Mode's 30 Hz cap with cheap frames
     is not slowness, so it is never stepped down for; under 26 frames a
     second it is, whatever the cause. It climbs back after good seconds
     (longer each time it had to step down again), and is held for three
     seconds after any change, a journey, a dive or a drag. */
  var densDiv = 1;
  var pace = { from: 0, frames: 0, work: 0, lastWork: 0, good: 0, bad: 0, best: 0, wait: 3, quietUntil: 0, held: false };
  function nativeDpr() { return Math.min(window.devicePixelRatio || 1, 3); }
  // A small globe: under 35 % of the window (the lens, a far world, a small front globe).
  function globeSmall() { return W > 0 && Math.PI * R * R < 0.35 * W * H; }
  function densityNow() {
    var n = nativeDpr();
    return globeSmall() ? n : Math.max(1, n / densDiv);
  }
  // The density changes with the globe's size (small: full) without a whole geometry().
  function setDensity() {
    var want = densityNow();
    if (want === dpr || !W) { return; }
    dpr = want;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawn.w = 0;
    marksDirty = true;
    tilesDirty = true;
  }

  function sharpen(now) {
    setDensity();
    if (pace.held || flying || moving() || deckMode || turning || document.hidden || journey || dive.on ||
        now < pace.quietUntil || globeSmall()) { pace.from = 0; return; }
    if (!pace.from) { pace.from = now; pace.frames = 0; pace.work = 0; return; }
    pace.frames += 1;
    pace.work += pace.lastWork;
    var span = now - pace.from;
    if (span < 2000) { return; }
    var fps = pace.frames * 1000 / span, work = pace.work / Math.max(1, pace.frames);
    pace.from = 0;
    var n = nativeDpr();
    /* Judged against the screen's own pace (the best window seen, so a 30 Hz
       Low Power cap is the norm there, not a slow device): slow is two windows
       running in a row well under it (or under 24 a second at all) with the
       frame's own work heavy, or far under it whatever the work. Back up once
       the windows are at the screen's pace again; the wait halves with each
       climb, so a hitch long ago does not hold a phone down for good. */
    pace.best = Math.max(pace.best * 0.995, Math.min(fps, 125));
    var ref = Math.max(24, pace.best);
    var slow = fps < Math.min(20, ref * 0.6) || ((fps < ref * 0.8 || fps < 24) && work > 10);
    if (slow) {
      pace.good = 0;
      pace.bad += 1;
      if (pace.bad < 2) { return; }
      pace.bad = 0;
      if (n / (densDiv + 1) >= 1 - 1e-6) { densDiv += 1; setDensity(); pace.wait = Math.min(12, pace.wait * 2); }
      else if (bodyOn() && bodyDiv < 2) { bodyDiv = 2; drawn.w = 0; pace.wait = Math.min(12, pace.wait * 2); }
      pace.quietUntil = now + 3000;
    } else if (fps >= ref * 0.9 && work < 8 && (densDiv > 1 || bodyDiv > 1)) {
      pace.bad = 0;
      pace.good += 1;
      if (pace.good >= pace.wait) {
        pace.good = 0;
        pace.wait = Math.max(3, Math.round(pace.wait / 2));
        if (bodyDiv > 1) { bodyDiv = 1; drawn.w = 0; } else { densDiv -= 1; setDensity(); }
        pace.quietUntil = now + 3000;
      }
    } else { pace.bad = 0; }
  }

  function frame(now) {
    var t0 = performance.now();
    frameWork(now);
    pace.lastWork = performance.now() - t0;
  }

  function frameWork(now) {
    autoSwing(now);
    stepFraming(now);
    stepSwing(now);
    sharpen(now);
    // While collages are laid over it the world holds still: it is behind
    // them, out of focus, and every frame spent on it is a frame the blur
    // has to be worked out again for nothing.
    if (deckMode && !flying) { requestAnimationFrame(frame); return; }
    // Inside a museum the world behind rests; only the pixel light goes on.
    if (walkOn && !flying) { drawTiles(now); requestAnimationFrame(frame); return; }

    // Going down into a city, or coming back up out of one. The sphere grows
    // or shrinks and its framing travels with it; everything else on here is
    // projected through the same two numbers and follows without being told.
    if (flying) {
      // A frame's clock can read a few milliseconds before the press that
      // started the flight; before its start the flight is at its start.
      var went = Math.max(0, Math.min(1, (now - flyAt) / fly.dur));
      if (journey) {
        stepJourney(went);
      } else if (fly.deep) {
        // In log space, the world turned as the height allows (see fly).
        var s = went * went * (3 - 2 * went);
        var lz = (1 - s) * (1 - s) * fly.a + 2 * s * (1 - s) * fly.m + s * s * fly.b;
        zoom = Math.exp(lz);
        var u = fly.kind === "down" ? 1 - (1 - s) * Math.exp(fly.a - lz)
              : fly.kind === "up" ? s * Math.exp(fly.b - lz) : s;
        u = Math.max(0, Math.min(1, u));
        spin = fly.spin0 + fly.dSpin * u;
        flyK = goingUp ? 1 - u : u;
        lean(leanFrom + (leanTo - leanFrom) * u);
      } else {
        var easing = 1 - Math.pow(1 - went, 3);
        zoom = flyFrom + (flyTo - flyFrom) * easing;
        flyK = goingUp ? 1 - easing : easing;
        lean(leanFrom + (leanTo - leanFrom) * easing);
      }
      reframe();
      if (journey) { journeyLand(now); passTowns(now); }
      if (went >= 1) {
        if (journey) { endJourney(now); }
        flying = false;
        hopFrom = null;
        if (fly.deep) { spin = wanted; fly.deep = false; }
        // Up or down is which way it was going, not the zoom: an art view's
        // height may be under the globe's own.
        if (goingUp) { goingUp = false; leave(); } else { flyK = 1; arrive(); }
        onward();
      }
    } else if (place) {
      flyK = 1;
    }

    // The world only turns when it is turned: by a drag, or by tabbing to a
    // word. It used to swing round to follow the creature, which meant every
    // word on it was always drifting.
    if (!flying || !fly.deep) { spin += shortest(spin, wanted) * (still ? 1 : (flying ? 0.16 : INV5)); }

    // The creature crosses the surface toward the word it is heading for.
    var ease = still ? 1 : INV5;
    beast.lat += (goal.lat - beast.lat) * ease;
    beast.lon += shortest(beast.lon, goal.lon) * ease;

    // The dive draws the world where the fingers have taken it (see the dive).
    if (dive.on) { diveFrame(now); } else { stepAim(now); }

    var moved = beast.lon - last.x;
    if (Math.abs(moved) > 0.0015) {
      creature.dataset.facing = moved > 0 ? "right" : "left";
      last.x = beast.lon;
    }

    paint(now);
    if (route) { placeRouteNames(now); placeRiders(now); }
    if (following) { guideFrame(now); }
    drawDials();

    // Up on the globe: the world, its words and its cities, and none of the
    // rest of it — not hidden but not running, which is most of what this
    // split is for. The words are left alone in a city too, because
    // replanting them at seven times the size would churn the whole
    // vocabulary every frame for something nobody can see.
    if (!place) { placeWords(); }
    if (place && !flying) { stepGrown(); } else if (grown) { grownOff(); }
    placeZooms();
    stepParts();
    if (!place || flying || grown) { placeMarks(); }
    if (!place || flying) { requestAnimationFrame(frame); return; }
    if (art && !dive.on) { stepArt(now); stepCityMap(now); placeStops(); if (art && art.kind === "town") { placeTown(); } }

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

    if (place) {
      // Down in a city the words are not lying on the ground to be walked to
      // — they are the language of the whole world, and the ground is this
      // one place. So it finds a thing underfoot and wanders a little way
      // off with it, rather than crossing a continent to reach a word.
      bannerUnder.textContent = (place.where ? place.where + " · " : "") +
                                "standing on " + ground.word;
      scramble(bannerUnder, "type", 0, 560);
      goal.lat = place.lat + (Math.random() - 0.5) * near(0.38);
      goal.lon = wrap(place.lon + (Math.random() - 0.5) * near(0.56));
      return;
    }

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
    // In a city what it can reach is the work's own things instead.
    var pool = place && place.terms ? place.terms : facing();

    // At the library it grazes the five words that cast a part more often
    // than chance. Its vocabulary there is the whole world's — a library has
    // everything in it — and five words in twenty-six meant a company of
    // two in sixteen throws, which cannot play a scene. Not too often
    // either: those five words cast five fixed parts, and five fixed parts
    // out of five different plays cannot play a scene between them. The rest
    // of the time the casting is left to whichever scene is nearest having
    // its people.
    if (place && place.stage && !troupeFull() && Math.random() < 0.78) {
      var casting = pool.filter(function (i) {
        return vocabulary[i] && GROUND[vocabulary[i].word] === "player";
      });
      if (casting.length) { pool = casting; }
    }

    var open = pool.filter(function (i) { return i !== here; });
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

    // Turning a photograph up is the strum: light out of the creature in
    // the photograph's three colours, and sparks and notes going up.
    if (graze.hidden) {
      var b = beastAt();
      if (b.ok && offering.c) {
        pulse(b.x, b.y, offering.c, 1, Math.max(W, H) * INV2);
        sparkle(b.hx, b.hy, offering.c, 16);
      }
    }
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
  /* ---- isometry ------------------------------------------------------------

     Everything that grows off the animal — and the animal itself — is drawn
     the way the objects in the Objects artifact are drawn: true isometry.

     Not a faked three-quarter view. The camera sits at azimuth 45 and
     elevation asin(1/root 3), 35.264 degrees, which is the one position where
     all three axes are foreshortened equally and every edge of a cube lands
     at 30 degrees from the horizontal. That projection comes out as two
     numbers: across the screen a cube runs (x - y) times cos 30, and down it
     runs (x + y) times a half, less its height. Nothing else is needed.

     The figures were all drawn flat, on grids of cells, and they stay drawn
     that way — a flat cell is simply extruded to a given depth and becomes a
     block. So every silhouette already worked out here, the animal's twenty
     parts, the hatchling, the players, the scenery, keeps its design and gains
     a body.

     Each block shows three faces, and they are painted from the back of the
     scene forward: with the camera on the (1,1,1) corner, depth is x + y + z,
     so sorting on that and painting in order is exact for cubes on a grid.

     The one departure from the artifact: there the faces of a block are filled
     flat, one colour for the whole region, because those objects fill a canvas
     and the form reads from the silhouette alone. These are forty pixels
     across on a turning globe, and a flat fill at that size collapses into a
     blob, so the three faces are separated a little — the top lit, the two
     sides stepped down. Same projection, same blocks, just enough light on
     them to keep the form. */

  var ISO_W = Math.cos(Math.PI / 6);      // 0.8660 across, per unit of x or y
  var ISO_H = 0.5;                        // and half that down
  var THICK = 3;                          // how deep a figure is, in its own cells
  var BEAST_THICK = 14;                   // the animal's grid is four times finer
  /* The grain has to come out at about a pixel a dot, two pixels apart, or
     it is either invisible or porridge — and the two grids are drawn at very
     different scales, so they need different tiles to arrive at the same
     dot. A figure's cell lands at about five pixels across, the animal's
     unit at about one and a half. */
  var TILE = 0.76;
  var BEAST_TILE = 2.8;
  var SET_TILE = 0.42;                    // a diorama is drawn larger again

  /* The top face, then the two that face the viewer. Order matters: the top
     is drawn last within a block so it sits over its own sides. */
  var FACE_LIFT = [-0.34, -0.14, 0.10];   // left, right, top

  function isoU(x, y) { return (x - y) * ISO_W; }
  function isoV(x, y, z) { return (x + y) * ISO_H - z; }

  function corner(x, y, z) {
    return isoU(x, y).toFixed(2) + "," + isoV(x, y, z).toFixed(2);
  }

  /* One block, as the three faces you can see of it. */
  function block(x, y, z, w, d, h, tone, tile) {
    var x1 = x + w, y1 = y + d, z1 = z + h;
    var faces = [
      // the side facing down-left, at y1
      [corner(x, y1, z), corner(x1, y1, z), corner(x1, y1, z1), corner(x, y1, z1)],
      // the side facing down-right, at x1
      [corner(x1, y, z), corner(x1, y1, z), corner(x1, y1, z1), corner(x1, y, z1)],
      // and the top
      [corner(x, y, z1), corner(x1, y, z1), corner(x1, y1, z1), corner(x, y1, z1)]
    ];
    var out = "";
    for (var i = 0; i < 3; i += 1) {
      var face = lift(tone, FACE_LIFT[i]);
      out += '<polygon points="' + faces[i].join(" ") +
             '" fill="' + (tile ? grained(face, i, tile) : face) + '"/>';
    }
    return out;
  }

  /* Far to near: with the camera on the (1,1,1) corner, depth is x + y + z. */
  function stack(boxes, depth, tile) {
    var d = depth || THICK;
    boxes.sort(function (a, b) {
      return (a.x + a.z) - (b.x + b.z);
    });
    var out = "";
    boxes.forEach(function (b) {
      out += block(b.x, 0, b.z, b.w, d, b.h, b.tone, tile);
    });
    return out;
  }

  /* What a grid of cells takes up once it is standing up and turned to the
     corner — so a drawing can be given a box that fits it exactly. */
  function isoBounds(cols, rows, depth) {
    var d = depth || THICK;
    return {
      x: isoU(0, d),
      y: isoV(0, 0, rows),
      w: isoU(cols, 0) - isoU(0, d),
      h: isoV(cols, d, 0) - isoV(0, 0, rows)
    };
  }

  function viewBox(cols, rows, depth) {
    var b = isoBounds(cols, rows, depth);
    return b.x.toFixed(2) + " " + b.y.toFixed(2) + " " +
           b.w.toFixed(2) + " " + b.h.toFixed(2);
  }

  /* ---- the grain on a block ------------------------------------------------

     The world's surface is a field of dots in strands, after Napangardi. The
     things standing on it were smooth, which made them look like objects laid
     on a drawing rather than things that came out of it — so the faces of
     every block are dotted too, in the same hand.

     Which of her surfaces, is the question, because they are not all one
     thing. The Mina Mina paintings are white dots on black in strands that
     crowd and part; Karntakurlangu Jukurrpa is a lattice of dotted cells on
     a warm brown; and Sandhill Country, a colour aquatint, is the one that
     decided this: a terracotta ground with black dots running in strands
     across it and pale pools opening between them, the dots swelling and
     shrinking along their own line. Three tones, not two — a ground, a dark
     mark, a pale pool — which is exactly what ramp() already gives us out of
     a work's three colours.

     None of it is drawn as extra shapes. A face is filled with a pattern
     whose ground is the face's own colour and whose dots sit over it, and the
     pattern is skewed onto that face's plane so the strands run along the
     block's own edges rather than across the screen. There are three planes
     and a handful of colours, so a figure needs a dozen patterns at most and
     not one shape more than it had.

     The projection gives the skews. A step along x moves (cos30, ½) on the
     screen, along y (-cos30, ½), along z (0, -1); a face spans two of those,
     and a pattern transform that maps the unit square onto that pair puts the
     dots on the block. */

  var GRAIN_FACE = [
    // the side facing down-left: spans x and z
    [ISO_W, ISO_H, 0, -1],
    // the side facing down-right: spans y and z
    [-ISO_W, ISO_H, 0, -1],
    // and the top: spans x and y
    [ISO_W, ISO_H, -ISO_W, ISO_H]
  ];

  var grains = {};          // "tone|face|tile" -> id
  var grainDefs = [];
  var grainCount = 0;

  function grainTile(id, face, tile, tone) {
    var m = GRAIN_FACE[face];
    var t = tile.toFixed(3);
    // Two rows of dots, staggered, so that skewed onto a face they run as
    // strands rather than sitting on a grid — and the dots do not match:
    // one heavier, one lighter, the way they swell and shrink along a line
    // in Sandhill Country. A pale pool opens between them.
    var dots = "";
    var at = [[0.22, 0.26, 0.135, 0.34], [0.72, 0.26, 0.095, 0.24],
              [0.47, 0.76, 0.125, 0.30], [0.97, 0.76, 0.085, 0.20]];
    at.forEach(function (d) {
      dots += '<circle cx="' + (d[0] * tile).toFixed(3) +
              '" cy="' + (d[1] * tile).toFixed(3) +
              '" r="' + (d[2] * tile).toFixed(3) +
              '" fill="rgba(20,22,28,' + d[3] + ')"/>';
    });
    dots += '<ellipse cx="' + (0.62 * tile).toFixed(3) +
            '" cy="' + (0.52 * tile).toFixed(3) +
            '" rx="' + (0.20 * tile).toFixed(3) +
            '" ry="' + (0.10 * tile).toFixed(3) +
            '" fill="rgba(255,255,255,0.30)"/>';

    return '<pattern id="' + id + '" patternUnits="userSpaceOnUse" ' +
           'width="' + t + '" height="' + t + '" patternTransform="matrix(' +
           m[0].toFixed(4) + "," + m[1].toFixed(4) + "," +
           m[2].toFixed(4) + "," + m[3].toFixed(4) + ',0,0)">' +
           '<rect width="' + t + '" height="' + t + '" fill="' + tone + '"/>' +
           dots + "</pattern>";
  }

  /* Colours near enough to each other share a pattern. Every work brings
     three tones, every tone is lit three ways for its three faces and drawn
     at two grains, so a page that has seen ten works wants a couple of
     hundred patterns — and at ninety, which was the old ceiling, half the
     company was falling back to flat colour without saying so. Rounding each
     channel to the nearest twelfth of a step is invisible and collapses most
     of that; the ceiling is higher as well. */
  function nearTone(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) { return hex; }
    var n = parseInt(m[1], 16);
    return "#" + [16, 8, 0].map(function (shift) {
      var v = Math.min(255, Math.round(((n >> shift) & 255) / 12) * 12);
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }

  /* A fill for one face: the colour, with her grain over it. */
  function grained(raw, face, tile) {
    var tone = nearTone(raw);
    var key = tone + "|" + face + "|" + tile;
    if (grains[key]) { return "url(#" + grains[key] + ")"; }
    if (grainCount > 260) { return raw; }
    var id = "g" + (grainCount += 1);
    grains[key] = id;
    grainDefs.push(grainTile(id, face, tile, tone));
    return "url(#" + id + ")";
  }

  /* Whatever patterns have been asked for so far, ready to go in a <defs>.

     They all live in one place — the animal's own drawing, which is on the
     page from the start and never taken off it — and everything else on the
     world points at them by name. A pattern held inside a figure would go
     when that figure was squashed, and take every other figure's grain with
     it. */
  function beastGrain() {
    var svg = creature.querySelector("svg");
    if (!svg) { return; }
    var defs = svg.querySelector("defs");
    if (!defs) {
      defs = document.createElementNS(SVGNS, "defs");
      svg.insertBefore(defs, svg.firstChild);
    }
    if (defs.childNodes.length !== grainDefs.length) {
      defs.innerHTML = grainDefs.join("");
    }
  }

  /* ---- nothing snaps -------------------------------------------------------

     Every drawing on here is rebuilt rather than animated: a palette goes on
     and the part is drawn again, a shape grows and it is drawn again, a scene
     goes up a course at a time and is drawn again each course. Rebuilt
     drawings replaced the old one between two frames, which is a cut, and a
     page of cuts reads as a slideshow however good each picture is.

     So a drawing is never replaced. The new one is laid over the old one and
     the old one dissolves under it, over about half a second on a curve with
     a long tail. A palette going onto the animal is now something you watch
     happen rather than something you notice has happened, and because every
     redraw goes through here it costs nothing to say it once. */

  var MELT = 678;          // --beat-4: the melt is on the same ladder as the rest

  function dissolve(host, markup, svg, ms) {
    var beat = ms || MELT;
    // Everything already in there is the old drawing, whether it came through
    // here or was laid down at the start; all of it goes, and it goes by
    // fading rather than by being removed.
    var was = [].slice.call(host.children);
    var skin = svg
      ? document.createElementNS(SVGNS, "g")
      : document.createElement("div");
    skin.setAttribute("class", "skin");
    if (ms) { skin.style.transitionDuration = ms + "ms"; }
    skin.innerHTML = markup;
    host.appendChild(skin);

    // On the next frame, so the browser has the old state to move from: a
    // skin appended and lit in the same frame has nothing to travel from and
    // arrives at full strength, which is the cut all this is here to avoid.
    // Frames stop in a hidden tab, so a timer stands behind the frame: a
    // drawing must never be left unlit, whichever of the two gets there.
    var lit = false;
    function light() {
      if (lit) { return; }
      lit = true;
      skin.setAttribute("class", "skin on");
      was.forEach(function (old) {
        var cls = old.getAttribute("class") || "";
        // Unlit: a skin at rest is transparent, so dropping "on" is the fade.
        old.setAttribute("class", cls.replace(/(^|\s)on(\s|$)/, " ").trim());
        old.setAttribute("data-melting", "true");
        if (ms) { old.style.transitionDuration = ms + "ms"; }
        window.setTimeout(function () {
          if (old.parentNode) { old.parentNode.removeChild(old); }
        }, beat + 60);
      });
    }
    window.requestAnimationFrame(light);
    window.setTimeout(light, 120);
  }

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

      var home = {
        x: +rect.getAttribute("x"), y: +rect.getAttribute("y"),
        w: +rect.getAttribute("width"), h: +rect.getAttribute("height")
      };
      var tone = window.getComputedStyle(rect).fill || "#ec4e98";
      rect.parentNode.removeChild(rect);

      // Standing up from the off: the flat rect it was laid out as becomes
      // one block, and every rebuild after this is blocks too. Through
      // dissolve even here, so a part holds one skin from its first frame
      // and every later redraw has a like thing to melt away.
      dissolve(group, block(home.x, 0, BEAST_GRID.rows - home.y - home.h,
                            home.w, BEAST_THICK, home.h, tone, BEAST_TILE), true);

      return {
        el: group, name: group.getAttribute("data-part"), home: home,
        token: null, at: 0, form: 0
      };
    });

    // The whole animal, seen from the corner, needs a box that fits it.
    var svg = creature.querySelector("svg");
    svg.setAttribute("viewBox",
      viewBox(BEAST_GRID.cols, BEAST_GRID.rows, BEAST_THICK));

    // And a footprint to match: an isometric animal is taller than a flat one
    // and not as wide, because it leans away from you.
    var fit = isoBounds(BEAST_GRID.cols, BEAST_GRID.rows, BEAST_THICK);
    creature.style.width = "176px";
    creature.style.height = (176 * fit.h / fit.w).toFixed(0) + "px";

    beastGrain();

    var eye = creature.querySelector(".c-eye");
    if (eye) {
      var ex = +eye.getAttribute("x"), ey = +eye.getAttribute("y");
      var ew = +eye.getAttribute("width"), eh = +eye.getAttribute("height");
      var box = document.createElementNS(SVGNS, "g");
      box.setAttribute("class", "c-eye");
      box.innerHTML = block(ex, 0, BEAST_GRID.rows - ey - eh, ew,
                            BEAST_THICK + 1.5, eh, "#241a33", BEAST_TILE);
      eye.parentNode.replaceChild(box, eye);
    }
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

  /* The animal is drawn on a grid 128 across and 96 down. A cell on it
     becomes a block the same way a cell of anything else does. */
  var BEAST_GRID = { cols: 128, rows: 96 };

  function cell(into, x, y, w, h, tone) {
    into.push({ x: x, z: BEAST_GRID.rows - y - h, w: w, h: h, tone: tone });
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
    var c = ramp(tok);      // the work's three, held apart — see ramp()
    var boxes = [];         // gathered, then sorted back to front by stack()

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
      for (var col = 0; col < cols; col += 1) {
        if (f > 1 && rnd() < 0.05 * Math.min(f, 2)) { continue; }   // a gap
        cell(boxes, home.x + col * cw, home.y + r * ch, cw, ch,
             c[(r + col + f) % 3]);
      }
    }

    part.grown.forEach(function (bit) {
      cell(boxes, bit.x, bit.y, coarse, coarse, bit.tone);
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
      var tone = c[i % 3];
      part.fresh.push({ x: bx, y: by, tone: tone });
      cell(boxes, bx, by, fine, fine, tone);
    }

    dissolve(g, stack(boxes, BEAST_THICK, BEAST_TILE), true);
    beastGrain();
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
      (tok.a ? " by " + tok.a : "") + ". Opens on " + tokenHome(tok) + ".");

    part.el.dataset.fresh = "true";
    window.setTimeout(function () { delete part.el.dataset.fresh; }, 1120);   /* past the 1097ms flare */
  }

  function wear(tok) {
    stamp += 1;
    stalest(PER_THROW).forEach(function (part, i) {
      wearPart(part, ramp(tok)[i % 3], tok);
    });
    repalette();

    // One thing per application, and only one. It used to leave two on every
    // third throw as well, which filled the world faster than anyone could
    // look at it. What arrives is decided by the ground it comes up out of;
    // see "what the ground grows" below.
    sprout(tok, underfoot());

    creature.dataset.struck = "true";
    window.setTimeout(function () { delete creature.dataset.struck; }, 440);   /* past the 419ms jolt */
    var bw = beastAt();
    if (bw.ok) {
      pulse(bw.x, bw.y, ramp(tok), 1.25, Math.max(W, H) * INV);
      sparkle(bw.hx, bw.hy, ramp(tok), 26);
    }

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
       player     press it and a scene goes up — see the troupe, below.
       egg        press it three times and it breaks open into something else.
       tube       press one, then another, and the top band pours across.
                  A tube of a single colour is solved, and hatches.
       tower      press it and the animal walks over. Every palette fed to a
                  tower is another floor, and every floor keeps its work.

     There were two more, a coin and a gem, and they are gone: five cells
     across is a speck, and a speck that can be pressed is a nuisance rather
     than a character. Five kinds, each big enough to be somebody.

     They wander, and two of a kind that meet merge into one bigger one.
     Merged past the third size a thing stops being what it was and becomes
     the next kind along, so nothing in the company has a final form either —
     the same as the animal. A palette can be dropped on any of them instead
     of on the animal, which is how a thing is fed. */

  var KINDS = ["hatchling", "player", "egg", "tube", "tower"];

  var VERB = {
    hatchling: "press to call it along",
    player: "press to cue a scene",
    set: "press to strike the scene",
    egg: "press to crack it open",
    tube: "press it, then another, to pour",
    tower: "press to send the animal over"
  };

  var MAX_COMPANY = 10;      // as many as the world holds at once
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
    // Every flat cell becomes a block, standing up: the drawing's row 0 is the
    // top of the figure, so it is the highest z.
    var boxes = cells.map(function (c) {
      var w = c[3] || 1;
      var h = c[4] || 1;
      return { x: c[0], z: rows - c[1] - h, w: w, h: h, tone: c[2] };
    });
    // No drawn shadow any more. An isometric block carries its own light on
    // three faces and sits on its own ground; a shadow offset behind it put a
    // second, flat figure under a solid one.
    return '<svg viewBox="' + viewBox(cols, rows) +
           '" aria-hidden="true" focusable="false">' +
           stack(boxes, THICK, TILE) + "</svg>";
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

  /* A hatchling is a small four-legged thing facing the way the animal
     faces, not a cloud of pixels. It used to be a mirrored random splat,
     which at that size read as a sheep, or as nothing — the shape is fixed
     now and only the colours and the trimmings come from the work, so the
     company reads as a company. */
  var BEAST_ART = [
    "........a",
    ".......aa",
    "a......aa",
    "aaaaaaaa.",
    ".aaaaaaa.",
    ".a.a.a.a.",
    ".a.a.a.a."
  ];

  /* The seed for anything grown out of the ground is the word and the work
     together, so the same object on the same word always comes up the same,
     and the same work on a different word comes up differently. */
  function grain(born, salt) {
    return seedFrom((born.ground || "") + born.token.s, salt);
  }

  function drawHatchling(born) {
    var c = ramp(born.token);
    var rnd = grain(born, 11);
    var crest = rnd() > 0.5;
    var tall = rnd() > 0.55;
    var cells = [];

    BEAST_ART.forEach(function (row, y) {
      for (var x = 0; x < row.length; x += 1) {
        if (row.charAt(x) !== "a") { continue; }
        cells.push([x, y + 1, bandOf(c, x + y + born.tier)]);
      }
    });
    if (crest) {                       // plates along the back
      [2, 4, 6].forEach(function (x) { cells.push([x, 2, bandOf(c, x)]); });
    }
    if (tall) {                        // or a neck instead
      cells.push([7, 1, bandOf(c, 1)], [8, 1, bandOf(c, 2)]);
    }
    cells.push([7, 2, INK]);           // the eye

    return { cols: 9, rows: BEAST_ART.length + 1, cells: cells };
  }

  function drawEgg(born) {
    var c = ramp(born.token);
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
    hatchling: drawHatchling, egg: drawEgg, tube: drawTube, tower: drawTower,
    player: function (born) { return drawPlayer(born); },
    set: function (born) { return drawSet(born); },
    house: function (born) { return drawHouse(born); }
  };

  /* Scenery stands over a figure. Everything else came up by 1 + 1/φ³ — the
     small things on here read as specks rather than as characters, and a
     speck that can be pressed is a nuisance, not a character. A player is
     the exception the other way: at fifteen cells tall it came out taller
     than the place it was standing in. */
  var BIG = { set: PHI, player: 1, house: PHI * 0.95 };
  var UP = 1 + INV3;                      // 1.236

  /* Growing shows in how big a thing is, not in how many cells it has. */
  function swell(born) {
    return born.kind === "hatchling"
      ? 1 + (Math.min(born.tier, TIERS) - 1) * INV3
      : 1;
  }

  /* A work's three colours, held apart so there is light in them.

     Artsy's dominant colours are honest and they are nearly all mid-tone:
     three browns, three greys. Three mid-tones next to each other is not a
     figure, it is a smudge — which is what the company looked like. So the
     three are sorted by how light they are and then pulled apart, the
     lightest up and the darkest down, hue untouched. The work's colours are
     still the work's colours; they are simply given the range a small shape
     needs to read as a shape at all. The air, the light, the object: the
     light was the part that was missing.

     Worked out once per work and kept, because a figure is redrawn every
     time it grows. */
  var ramps = {};

  /* ---- colour is free ------------------------------------------------------

     The artist's word on this: any colour for any object anywhere, so long as
     it works. That settles an argument the site kept having with itself. The
     colours measured off a work are honest and they are nearly all the same
     — seven collages photographed in the same light give seven browns, and
     seven browns is one brown. So what is kept from a work is which colour it
     is, not what value it came out at: the hue is the work's, and the
     lightness and the strength are whatever the thing being drawn needs.

     Everything below works in hue, strength and lightness, because those are
     the three things that have to be argued about separately. */

  function toHsl(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    var n = m ? parseInt(m[1], 16) : 0x808080;
    var r = ((n >> 16) & 255) / 255;
    var g = ((n >> 8) & 255) / 255;
    var b = (n & 255) / 255;
    var hi = Math.max(r, g, b), lo = Math.min(r, g, b);
    var l = (hi + lo) / 2;
    if (hi === lo) { return { h: 0, s: 0, l: l }; }
    var d = hi - lo;
    var sat = l > 0.5 ? d / (2 - hi - lo) : d / (hi + lo);
    var h = hi === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
          : hi === g ? ((b - r) / d + 2) / 6
          : ((r - g) / d + 4) / 6;
    return { h: h, s: sat, l: l };
  }

  function chan(p, q, t) {
    if (t < 0) { t += 1; }
    if (t > 1) { t -= 1; }
    if (t < 1 / 6) { return p + (q - p) * 6 * t; }
    if (t < 1 / 2) { return q; }
    if (t < 2 / 3) { return p + (q - p) * (2 / 3 - t) * 6; }
    return p;
  }

  function fromHsl(h, s, l) {
    h = ((h % 1) + 1) % 1;
    s = Math.max(0, Math.min(1, s));
    l = Math.max(0, Math.min(1, l));
    if (!s) {
      var v = Math.round(l * 255);
      return [v, v, v];
    }
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return [Math.round(chan(p, q, h + 1 / 3) * 255),
            Math.round(chan(p, q, h) * 255),
            Math.round(chan(p, q, h - 1 / 3) * 255)];
  }

  function rgbHex(rgb) {
    return "#" + rgb.map(function (v) {
      return (v < 16 ? "0" : "") + v.toString(16);
    }).join("");
  }

  /* A colour kept as itself in hue and put where it is wanted in everything
     else. A borrowed hue for the ones that have none: a grey's hue is
     whatever rounding left behind, and forcing strength into it turns that
     noise into a colour. */
  function tune(from, want, floor, borrow) {
    var c = toHsl(from);
    var h = c.s < 0.1 && borrow !== undefined ? borrow : c.h;
    return fromHsl(h, Math.max(floor, Math.min(0.72, c.s)), want);
  }

  function lumin(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) { return 0.5; }
    var n = parseInt(m[1], 16);
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) +
            0.0722 * (n & 255)) / 255;
  }

  function ramp(tok) {
    if (ramps[tok.s]) { return ramps[tok.s]; }
    var c = tok.c.slice().sort(function (a, b) { return lumin(b) - lumin(a); });
    while (c.length < 3) { c.push(c[0]); }

    // The work's own hues, at three lightnesses that are certainly three.
    // Lifting each colour a little from where it already was left plenty of
    // works with three mid-tones still, which on an isometric block means no
    // top, no left and no right — a silhouette in one colour.
    var lead = c.slice().sort(function (a, b) {
      return toHsl(b).s - toHsl(a).s;
    })[0];
    var borrow = toHsl(lead).s > 0.08 ? toHsl(lead).h : (hash(tok.s) % 360) / 360;

    ramps[tok.s] = [rgbHex(tune(c[0], 0.80, 0.26, borrow)),
                    rgbHex(tune(c[1], 0.54, 0.34, borrow)),
                    rgbHex(tune(c[2], 0.25, 0.38, borrow))];
    return ramps[tok.s];
  }

  /* Something to hang a hue on when a work has none of its own. */
  function hash(text) {
    var n = 2166136261;
    for (var i = 0; i < (text || "").length; i += 1) {
      n = ((n ^ text.charCodeAt(i)) * 16777619) >>> 0;
    }
    return n;
  }

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

  /* Five on the stage at the outside, arriving over the first dozen
     applications. It was eight, and eight was a crowd: a scene needs three
     at most, every part standing is one more small thing to look at, and a
     stage with five people on it is a company where one with eight is a
     queue. Ten things on the whole world, likewise, where it was
     twenty-four. */
  function company() {
    if (!place) { return []; }
    var slug = place.slug;
    return spawns.filter(function (born) {
      return born.home === slug && born.kind !== "house";
    });
  }

  function troupeFull() {
    var standing = company().filter(function (born) {
      return born.kind === "player";
    }).length;
    return standing >= Math.min(5, 1 + Math.floor(stamp / 3));
  }

  /* ---- what the ground grows ----------------------------------------------

     The words on the world are the things the collages are made of, read off
     the photographs one by one. Until now they were only somewhere to stand:
     the animal grazed on a word, the word decided which saved work it turned
     up, and after that the word had no further say in anything.

     It decides everything now. Whatever grows does so out of the ground it is
     standing on, and what the ground is made of is what grows:

       things that stack          a tower, which is a stack of them
         book page, cardboard, kraft paper, magazine, blueprint, ticket
       things wound or banded     a tube, which holds bands of colour —
                                  a barcode is one already, a map and a
                                  receipt are rolled, film is run through
         film strip, instant film, tape, foil, map, receipt, barcode
       things that are alive      a hatchling
         dog, insect, cloud, shoreline
       things with somebody in them  a player, who has a part to say
         handwriting, photograph, polaroid, sketch, playing card
       marks that are not yet anything  an egg, which opens into something
         paint, watercolour, sticker, qr code

     Six, seven, four, five and four of the twenty-six: no group so much
     bigger than the rest that the world fills up with one thing.

     So the whole thing runs the other way round now. Press a word and the
     animal walks to it; feed it a palette while it is standing there and that
     word is what comes up out of the ground. The collages decide the cast.

     Five of the words go further and cast a particular part, because those
     five are already about somebody: handwriting is the hand that wrote it,
     so it brings on the Chorus; a photograph is what is left of a person, so
     it brings on Hamlet; a polaroid, Juliet; a sketch, Jaques, who watches
     and describes; a playing card, Puck, for the joker in the New York
     collage that started all of this. Which means the repertory is not a
     lottery either — to get Hamlet on the world, walk the animal onto
     `photograph` and feed it. */

  var GROUND = {
    // things that stack
    "book page": "tower", "cardboard": "tower", "kraft paper": "tower",
    "magazine": "tower", "blueprint": "tower", "ticket": "tower",

    // things wound, rolled or run through in bands
    "film strip": "tube", "instant film": "tube", "tape": "tube",
    "foil": "tube", "map": "tube", "receipt": "tube", "barcode": "tube",

    // things that are alive
    "dog": "hatchling", "insect": "hatchling", "cloud": "hatchling",
    "shoreline": "hatchling",

    // things with somebody in them
    "handwriting": "player", "photograph": "player", "polaroid": "player",
    "sketch": "player", "playing card": "player",

    // marks that are not yet anything
    "paint": "egg", "watercolour": "egg", "sticker": "egg", "qr code": "egg"
  };

  /* The five words that are already about somebody. */
  var CASTS = {
    "handwriting": "Chorus",
    "photograph": "Hamlet",
    "polaroid": "Juliet",
    "sketch": "Jaques",
    "playing card": "Puck"
  };

  /* Where the animal is standing, which is the ground anything it throws off
     grows out of. */
  function underfoot() { return vocabulary[here] || null; }

  /* The plays have somewhere to be now: the library. Players are cast there
     and nowhere else, and the scenes go up on its terrace. Four other cities
     each running a company of actors nobody asked for was most of what made
     this too much to look at, and a Shakespeare library is the obvious place
     for the one company there should be. */
  function onStage() { return !!(place && place.stage); }

  function kindFor(tok, word) {
    var wants = word && GROUND[word];
    if (wants === "player" && !onStage()) { wants = null; }

    // The ground has the first word on it. A troupe that is already full is
    // the one thing that overrules it: a sixth photograph cannot bring on a
    // ninth player, so it brings on what the world is shortest of instead.
    // The kinds used to be let in one at a time as the world went on, which
    // was a way of making it vary before anything else did. The words vary by
    // themselves, and a gate on top of them meant standing on `book page`
    // could still hand you an egg, so the gate is gone.
    if (wants && !(wants === "player" && troupeFull())) { return wants; }

    var open = KINDS.filter(function (k) {
      return !(k === "player" && (troupeFull() || !onStage()));
    });
    if (!open.length) { return "hatchling"; }

    // Failing that, the work chooses, among the kinds the world is short of.
    // Left to a straight roll it ran to eight tubes and one of everything
    // else, which is a warehouse rather than a company.
    var tally = {};
    open.forEach(function (k) { tally[k] = 0; });
    spawns.forEach(function (born) {
      if (tally[born.kind] !== undefined) { tally[born.kind] += 1; }
    });
    var fewest = Math.min.apply(null, open.map(function (k) { return tally[k]; }));
    var short = open.filter(function (k) { return tally[k] <= fewest; });

    var rnd = seedFrom(tok.s, 7);
    return short[Math.floor(rnd() * short.length) % short.length];
  }

  function label(born) {
    if (born.kind === "house") {
      return "The " + (born.piece === "folger" ? "Folger Shakespeare Library"
                                               : born.piece) + ", standing here.";
    }
    var tok = born.token;
    var what = born.kind === "set"
      ? "A " + born.piece + ", built for the scene"
      : "A " + (born.role || born.kind) +
        (born.ground ? " grown on " + born.ground : " grown off the creature");
    return what + ", in the colours of " + tok.t +
           (tok.a ? " by " + tok.a : "") + ". " +
           VERB[born.kind] + "; hold it, or press O, to open it on " + tokenHome(tok) + ".";
  }

  function redraw(born) {
    // A diorama is redrawn every course as it goes up, so its melt is the
    // short beat: on the long one four half-faded copies of the same walls
    // stand inside each other and the whole thing goes grey while it rises.
    var beat = born.kind === "set" ? 259 : MELT;
    // Whatever it has just become, if it is a player it needs a part before
    // it can be drawn — and it keeps that part for good.
    if (born.kind === "player" && !born.role) {
      born.role = roleFor(born.token, born.ground);
    }
    var made = DRAW[born.kind](born);
    // A diorama arrives drawn, because it is built out of boxes in three
    // dimensions rather than a flat grid of cells extruded.
    dissolve(born.el, made.svg
      ? made.svg
      : pixels(made.cols, made.rows, made.cells), false, beat);
    beastGrain();          // any new patterns it asked for, into the one defs
    var fit = made.fit || isoBounds(made.cols, made.rows);
    var u = unit() * (BIG[born.kind] || UP) * swell(born);
    var wide = u * fit.w / 7;
    born.el.style.width = wide.toFixed(1) + "px";
    born.el.style.height = (wide * fit.h / fit.w).toFixed(1) + "px";
    born.el.dataset.kind = born.kind;
    born.el.setAttribute("aria-label", label(born));
  }

  function sprout(tok, gnd, at) {
    if (place && company().length >= MAX_COMPANY) { return null; }

    var el = document.createElement("div");
    el.className = "spawn";
    el.tabIndex = 0;
    el.setAttribute("role", "button");

    var born = {
      el: el,
      token: tok,
      ground: gnd ? gnd.word : null,        // the word it came up out of
      // and how many of the collages that word runs through, which is how
      // much of the work it is. A thing grown on a word that is everywhere
      // arrives with more of itself already built.
      roots: gnd ? gnd.works.length : 1,
      kind: kindFor(tok, gnd && gnd.word),
      tier: 1,
      crack: 0,
      tone: ramp(tok)[0],
      face: 0,
      bands: [],
      stack: [],
      following: false,
      held: false,
      to: null,
      next: 0,
      home: place ? place.slug : null,        // the city it grew in
      phase: Math.random() * TAU,     // so they do not all breathe together
      since: performance.now(),       // so it can rise rather than appear
      // Beside the animal, not under it — a thing born inside the animal's
      // own outline cannot be pressed until it has wandered clear — and well
      // beside it, because everything used to arrive in the same armful and
      // stay there. What the world makes by itself comes up beside its own
      // word instead, wherever on the sphere that word is standing.
      lat: at
        ? inBand(at.lat + (Math.random() - 0.5) * near(0.14))
        : inBand(beast.lat + (Math.random() - 0.5) * near(0.3)),
      lon: at
        ? wrap(at.lon + (Math.random() < 0.5 ? -1 : 1) *
               near(0.1 + Math.random() * 0.2))
        : wrap(beast.lon + (Math.random() < 0.5 ? -1 : 1) *
               near(0.22 + Math.random() * 0.5))
    };

    // A tube comes up with a band for every collage its word is in, and a
    // tower with a floor for each, so the deeper a thing runs through the
    // work the more of it is standing there to begin with.
    var deep = Math.max(1, Math.min(BANDS, born.roots));
    for (var i = 0; i < deep; i += 1) {
      born.bands.push(ramp(tok)[i % 3]);
      born.stack.push({ tone: ramp(tok)[(i + 1) % 3], token: tok });
    }

    redraw(born);
    wireCompany(born);
    spawns.push(born);
    land.insertBefore(el, creature);
    // It comes up out of the ground with a small burst of light.
    var up = project(born.lat, born.lon);
    if (up.z > 0) { pulse(up.x, up.y, ramp(tok), 0.6, Math.max(W, H) * INV3); }
    return born;
  }

  function banish(born) {
    if (playing && playing.cast.indexOf(born) >= 0) { endScene(); }
    var at = spawns.indexOf(born);
    if (at >= 0) { spawns.splice(at, 1); }
    var inLine = train.indexOf(born);
    if (inLine >= 0) { train.splice(inLine, 1); }
    if (pouring === born) { pouring = null; }

    // Out of the world at once, so nothing else has to know about it, but not
    // off the screen: it stops being placed each frame and melts where it
    // stood. A thing that vanishes between two frames was never there.
    var el = born.el;
    if (!el.parentNode) { return; }
    el.dataset.going = "true";
    // placeSpawns has been setting opacity and transform inline every frame
    // and has just stopped, so the melt has to be set inline too — a rule in
    // the stylesheet would lose to the inline values left standing there.
    el.style.transition = "opacity " + MELT + "ms cubic-bezier(0.22, 1, 0.36, 1)" +
                          ", transform " + MELT + "ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = (el.style.transform || "") + " scale(0.34)";
    el.style.opacity = "0";
    window.setTimeout(function () {
      if (el.parentNode) { el.parentNode.removeChild(el); }
    }, MELT + 60);
  }

  function burstAt(born, tones) {
    var p = project(born.lat, born.lon);
    tones = tones || born.token.c;
    kick(p.x, p.y, tones, 18, 5, 2.4);
    // And the light goes out from it in tiles, in the same colours.
    pulse(p.x, p.y, tones, 0.75, Math.max(W, H) * INV3);
    sparkle(p.x, p.y, tones, 7);
  }

  /* ---- what pressing one does --------------------------------------------- */

  /* The word decides what is born; growing past the third size is what moves
     a thing on from there. */
  function becomeNext(born) {
    var open = KINDS.slice();
    // A troupe that is already full does not need an understudy: a thing
    // growing past its third size skips the part and goes on to the next
    // kind. Without this the company filled up with players, because every
    // merge and every hatching could add one over the top of the cast.
    if (troupeFull() || !onStage()) {
      open = open.filter(function (k) { return k !== "player"; });
    }
    var at = open.indexOf(born.kind);
    born.kind = open[(at + 1) % open.length];
    born.tier = 1;
    born.crack = 0;
    var deep = Math.max(1, Math.min(BANDS, born.roots || 1));
    born.bands = [];
    born.stack = [];
    for (var i = 0; i < deep; i += 1) {
      born.bands.push(ramp(born.token)[i % 3]);
      born.stack.push({ tone: ramp(born.token)[(i + 1) % 3], token: born.token });
    }
    born.face = 0;
    born.tone = ramp(born.token)[0];
    redraw(born);
    burstAt(born);
  }

  function enlarge(born) {
    born.tier += 1;
    if (born.tier > TIERS) { becomeNext(born); return; }
    redraw(born);
    burstAt(born);
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

    if (born.kind === "egg") {
      born.crack += 1;
      if (born.crack >= 3) { becomeNext(born); return; }
      redraw(born);
      burstAt(born);
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

    if (born.kind === "set") {
      curtain = performance.now();
      endScene();
      strike();
      return;
    }

    if (born.kind === "player") {
      cue(born, performance.now());
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
      born.stack.push({ tone: ramp(tok)[1], token: tok });
      if (born.stack.length > 9) { born.stack.shift(); }
      redraw(born);
      burstAt(born, tok.c);
      return;
    }
    if (born.kind === "tube") {
      if (born.bands.length < BANDS) { born.bands.push(ramp(tok)[0]); }
      redraw(born);
      burstAt(born, tok.c);
      return;
    }
    // A player keeps its part and is dressed again in the new work. The
    // character survives the stroke; that is the whole idea of it.
    if (born.kind === "player" || born.kind === "set") {
      redraw(born);
      burstAt(born, ramp(tok));
      return;
    }
    if (born.kind === "egg") { born.crack += 1; }
    if (born.kind === "egg" && born.crack >= 3) { becomeNext(born); return; }
    enlarge(born);
  }

  /* ---- how they carry on by themselves ------------------------------------ */

  /* Everything the company does is measured in radians on the sphere, and
     every one of those numbers was picked by eye against the globe. Down in
     a city the same sphere is seven times bigger, so the same radian is
     seven times further across the screen: a wander became a march and two
     things that should have met never came near each other. So each of them
     is divided by how far down we are, and the world keeps its manners at
     both heights. */
  function near(rad) { return rad / zoom; }

  function inBand(lat) {
    // On the globe, the band the words live in. In a city, the ground you can
    // see out of the window — clamping to the globe's band down there would
    // fling everything that grows to the far north.
    if (place) {
      return Math.max(place.lat - near(0.6), Math.min(place.lat + near(0.6), lat));
    }
    return Math.max(LAT_LOW, Math.min(LAT_TOP, lat));
  }

  function stepCompany(now) {
    var dt = Math.min(0.05, (now - strolled) / 1000 || 0.016);
    strolled = now;
    var creep = dt * 1.6;

    stepScene(now);
    stepSets(now);

    // Anyone on their mark walks to it and stays there until the curtain.
    spawns.forEach(function (born) {
      if (!born.acting || !born.mark) { return; }
      born.lat += (born.mark.lat - born.lat) * Math.min(1, creep * 2.4);
      born.lon = wrap(born.lon + shortest(born.lon, born.mark.lon) *
                      Math.min(1, creep * 2.4));
    });

    var dir = creature.dataset.facing === "left" ? 1 : -1;
    train.forEach(function (born, i) {
      var lat = inBand(beast.lat + near(i % 2 ? 0.035 : -0.035));
      var lon = wrap(beast.lon + dir * near(0.06) * (i + 1));
      born.lat += (lat - born.lat) * Math.min(1, creep * 3);
      born.lon = wrap(born.lon + shortest(born.lon, lon) * Math.min(1, creep * 3));
    });

    // Asked for stillness, they stand where they were put. The line behind
    // the animal still forms, because that is somewhere to be rather than
    // something moving.
    if (still) { return; }

    spawns.forEach(function (born) {
      if (born.following || born.acting || born.kind === "house" ||
          born.kind === "tower" || born.kind === "set") { return; }
      // Whatever is under the pointer holds still. They are small, they
      // wander, and a target that drifts out from under a thumb halfway
      // through a press is not a target.
      if (born.held || pouring === born) { return; }
      if (now > born.next) {
        born.next = now + 2400 + Math.random() * 5200;
        born.to = {
          lat: inBand(born.lat + (Math.random() - 0.5) * near(0.24)),
          lon: wrap(born.lon + (Math.random() - 0.5) * near(0.5))
        };
      }
      if (!born.to) { return; }
      born.lat += (born.to.lat - born.lat) * Math.min(1, creep);
      born.lon = wrap(born.lon + shortest(born.lon, born.to.lon) * Math.min(1, creep));
    });

    if (now - mingled > 700) { mingled = now; mingle(); }
    ferment(now);
  }

  /* The world keeps making things on its own once it has any colour in it at
     all. Nothing here waits to be asked — it only waits to be squashed. */
  var fermented = 0;
  var FERMENT = Math.round(2600 * Math.pow(PHI, 4));   // about eighteen seconds

  function ferment(now) {
    if (still || !supply || !stamp || !place) { return; }
    if (now - fermented < FERMENT) { return; }
    fermented = now;
    if (company().length >= MAX_COMPANY) { return; }
    var keys = supply.pool;
    var tok = supply.tokens[keys[Math.floor(Math.random() * keys.length)]];

    // Which word it comes up on. Once the ground decides what grows, players
    // only arrive on the five words that are about somebody — and five words
    // in twenty-six meant the troupe stopped filling and the plays stopped
    // with it. So while there is room on the stage the world grows on those
    // words by choice, and on any word at all once the troupe is full. It is
    // still a word doing the casting either way.
    // Which word it comes up on. While there is room on the stage it favours
    // the five words that are about somebody, half the time, or the troupe
    // never fills. Otherwise it favours whatever the world has least of —
    // ten things is a small company, and eight of them being tubes is not a
    // company at all. Either way it is a word doing the choosing.
    // Only this collage's own things, because this is its city.
    var mineHere = (place.terms || []).map(function (i) { return vocabulary[i]; })
      .filter(Boolean);
    if (!mineHere.length) { mineHere = vocabulary; }

    var open = mineHere;
    var casting = mineHere.filter(function (g) {
      return GROUND[g.word] === "player";
    });

    if (onStage() && !troupeFull() && casting.length && Math.random() < 0.5) {
      open = casting;
    } else {
      var tally = {};
      KINDS.forEach(function (k) { tally[k] = 0; });
      company().forEach(function (born) {
        if (tally[born.kind] !== undefined) { tally[born.kind] += 1; }
      });
      var fewest = Math.min.apply(null, KINDS.filter(function (k) {
        return !(k === "player" && (troupeFull() || !onStage()));
      }).map(function (k) { return tally[k]; }));
      var short = mineHere.filter(function (g) {
        var k = GROUND[g.word];
        return k && tally[k] === fewest &&
               !(k === "player" && (troupeFull() || !onStage()));
      });
      if (short.length) { open = short; }
    }
    var gnd = open[Math.floor(Math.random() * open.length)];
    // The word it grows off is the collage's; where it comes up is here,
    // beside the animal, because the word itself is away on the globe.
    if (tok && gnd) { sprout(tok, gnd, { lat: beast.lat, lon: beast.lon }); }
  }

  /* Two of a kind that have wandered into each other become one bigger one.
     Tubes and towers are left out of it: a tube is poured and a tower is
     stacked, and neither would be improved by merging. */
  function mingle() {
    for (var i = 0; i < spawns.length; i += 1) {
      var a = spawns[i];
      if (a.kind === "tube" || a.kind === "tower" || a.kind === "house" ||
          a.kind === "player" || a.kind === "set") { continue; }
      for (var j = i + 1; j < spawns.length; j += 1) {
        var b = spawns[j];
        if (b.kind !== a.kind || b.tier !== a.tier) { continue; }
        if (apart(a, b) > near(0.06)) { continue; }
        burstAt(b, b.token.c);
        banish(b);
        enlarge(a);
        return;                 // one meeting a sweep; there is no hurry
      }
    }
  }

  function placeSpawns() {
    spawns.forEach(function (born) {
      // What grew in one city stays in that city. Nothing follows you up to
      // the globe, and nothing you left behind is in the way somewhere else.
      if (!place || born.home !== place.slug) {
        born.el.style.visibility = "hidden";
        return;
      }
      var p = project(born.lat, born.lon);
      if (p.z <= 0.05 || p.x < 14 || p.x > W - 14) {
        born.el.style.visibility = "hidden";
        return;
      }
      var scale = (0.5 + 0.5 * p.z) *
                  Math.max(0.5, Math.min(place ? 1.7 : 1.2, R / 1100));

      // Coming up: for the first three quarters of a second it is still on
      // its way out of the ground, so it arrives rather than appears.
      var age = (strolled - (born.since || 0)) / 1097;   // --beat-5
      if (age < 1) {
        var ease = age <= 0 ? 0 : 1 - Math.pow(1 - age, 3);
        scale *= 0.45 + 0.55 * ease;
      }

      // Whatever it does to show it is alive rides on this one transform: a
      // hatchling breathes. Nothing here is a separate animation, so nothing
      // here keeps the compositor awake.
      var t = strolled / 1000;
      var life = "";
      if (born.acting) {
        life = born.faces < 0 ? " scaleX(-1)" : "";
      } else if (still) { life = ""; }
      else if (born.kind === "hatchling" || born.kind === "egg") {
        life = " translateY(" +
               (Math.sin(t * 1.7 + born.phase) * 3.4).toFixed(2) + "%)";
      }

      born.el.style.visibility = "visible";
      born.el.style.opacity = (INV2 + INV * Math.min(1, (p.z - 0.05) / 0.3)).toFixed(3);
      // Who is in front of whom is where they are standing, not what they
      // are. Down in a city the animal is nearly two feet of screen and it
      // used to sit over the whole company: anything behind it could not be
      // pressed, because its cells take the press and its box is enormous.
      born.el.style.zIndex = String(depth(p.y) -
        (born.kind === "set" ? 8 : born.kind === "house" ? 12 : 0));
      born.el.style.transform =
        "translate(" + p.x.toFixed(1) + "px," + p.y.toFixed(1) + "px)" +
        // A tower stands on its base; everything else is carried a little
        // above the ground it is standing on.
        " translate(-50%," +
        (born.kind === "tower" || born.kind === "set" ||
         born.kind === "house" ? "-100%" : "-92%") +
        ") scale(" + scale.toFixed(3) + ")" + life;
    });
    placeSay();
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
    window.open(tokenHref(born.token), "_blank", "noopener");
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

  /* ---- the sets ------------------------------------------------------------

     A scene needs somewhere to happen, and somewhere is not three small props
     standing in a row. Each play's place is built as one diorama on its own
     plinth — a floor you can see the edge of, walls behind it, what the scene
     needs in front — the way an isometric sprite sheet gives you a whole
     castle on a diamond of ground rather than a castle-shaped object.

     It is built out of boxes in three dimensions rather than a flat drawing
     extruded, because a room has a floor at the bottom, walls at the back and
     furniture in front of them, and a single slab cannot say that. Everything
     else is as before: the same blocks, the same grain over them, the same
     three tones out of the work that cast the lead, so the balcony Juliet
     stands over is made of the same artwork she is. Stone takes the middle
     tone, anything lit or trimmed the lightest, openings and shadow the
     darkest.

     Ten places for sixteen scenes, because a play's scenes mostly happen
     somewhere the play has already been. They are composed out of a small
     vocabulary of flats — a floor, a wall, an arch, a column, steps, a rail,
     vines, a torch — so a set is a handful of lines rather than a hundred
     boxes written out. */

  /* Boxes are { x, y, z, w, d, h, t }: x runs right-and-down the screen, y
     left-and-down, z up, and t is which of the work's three tones — 0 the
     lightest, 1 the middle, 2 the darkest. */

  function put(into, x, y, z, w, d, h, t) {
    into.push({ x: x, y: y, z: z, w: w, d: d, h: h, t: t });
  }

  var FLAT = {
    /* The ground the whole thing stands on. It takes the work's darkest tone,
       so that what is built on it reads against it rather than disappearing
       into it — dark ground, light architecture, which is what makes an
       isometric tile read as a tile at all.

       It is not one box. A single slab gives a perfect rectangle, and a
       perfect rectangle is a platform; in a sprite sheet the ground is a
       chunky piece of land with its corners knocked off and its edge
       uneven. So it is laid as two-unit clods, the border ones dropped a
       little or missing altogether, which costs about fifty boxes and is
       the difference between a stage and a place. */
    floor: function (o, x, y, w, d, seed) {
      var rnd = seedFrom("ground" + (seed || ""), 9);
      for (var i = 0; i < w; i += 2) {
        for (var j = 0; j < d; j += 2) {
          var edge = Math.min(i, w - 2 - i, j, d - 2 - j) < 1.5;
          if (edge && rnd() < 0.34) { continue; }        // a bite out of it
          var drop = edge ? 0.3 : 0;
          var lift = rnd() < 0.16 ? 0.25 : 0;            // and the odd tussock
          put(o, x + i, y + j, -drop,
              Math.min(2, w - i), Math.min(2, d - j),
              0.8 + drop + lift, edge || rnd() < 0.22 ? 2 : 1);
        }
      }
    },

    /* A wall standing along the back of the floor, with its coping lit. */
    wall: function (o, x, y, z, w, h, gap) {
      put(o, x, y, z, w, 1.2, h, 1);
      put(o, x, y, z + h, w, 1.2, 0.5, 0);
      if (gap) {                                    // a window or a doorway
        put(o, x + w * 0.42, y - 0.1, z + h * 0.35, w * 0.2, 1.4, h * 0.42, 2);
      }
    },

    /* The same, running the other way. */
    side: function (o, x, y, z, d, h, gap) {
      put(o, x, y, z, 1.2, d, h, 1);
      put(o, x, y, z + h, 1.2, d, 0.5, 0);
      if (gap) {
        put(o, x - 0.1, y + d * 0.42, z + h * 0.35, 1.4, d * 0.2, h * 0.42, 2);
      }
    },

    /* Crenellations along the top of a wall. */
    crown: function (o, x, y, z, w) {
      for (var i = 0; i < w; i += 2) {
        put(o, x + i, y, z, 1, 1.2, 1.1, 0);
      }
    },

    /* A round arch: two piers and a lintel, with the opening dark behind. */
    arch: function (o, x, y, z, w, h) {
      put(o, x, y, z, 1.1, 1.2, h, 1);
      put(o, x + w - 1.1, y, z, 1.1, 1.2, h, 1);
      put(o, x, y, z + h, w, 1.2, 0.9, 0);
      put(o, x + 1.1, y + 0.2, z, w - 2.2, 0.8, h, 2);
    },

    column: function (o, x, y, z, h) {
      put(o, x, y, z, 1.3, 1.3, h, 1);
      put(o, x - 0.25, y - 0.25, z + h, 1.8, 1.8, 0.7, 0);
      put(o, x - 0.25, y - 0.25, z, 1.8, 1.8, 0.6, 0);
    },

    steps: function (o, x, y, z, w, n) {
      for (var i = 0; i < n; i += 1) {
        put(o, x, y + i, z + (n - 1 - i) * 0.9, w, 1, 0.9, i % 2 ? 1 : 0);
      }
    },

    /* A balcony: a slab carried out from a wall, with a rail along it. */
    balcony: function (o, x, y, z, w) {
      put(o, x, y, z, w, 2.6, 0.7, 1);
      put(o, x, y, z + 0.7, w, 0.5, 1.6, 0);
      for (var i = 0; i < w; i += 1.6) {
        put(o, x + i, y + 0.6, z + 0.7, 0.4, 0.4, 1.3, 0);
      }
      put(o, x, y, z + 2.3, w, 2.6, 0.4, 0);
    },

    rail: function (o, x, y, z, w) {
      put(o, x, y, z + 1.2, w, 0.4, 0.4, 0);
      for (var i = 0; i < w; i += 1.5) {
        put(o, x + i, y, z, 0.4, 0.4, 1.2, 1);
      }
    },

    /* Growth over stone: a scatter of small dark blocks. */
    vine: function (o, x, y, z, w, h, seed) {
      var rnd = seedFrom("vine" + seed, 5);
      for (var i = 0; i < w * 2.2; i += 1) {
        var vx = x + rnd() * w;
        var vz = z + rnd() * h;
        put(o, vx, y - 0.3, vz, 0.8, 0.5, 0.8, 2);
      }
    },

    torch: function (o, x, y, z) {
      put(o, x, y, z, 0.5, 0.5, 2.6, 1);
      put(o, x - 0.35, y - 0.35, z + 2.6, 1.2, 1.2, 1.2, 0);
    },

    table: function (o, x, y, z, w, d) {
      put(o, x, y, z + 1.8, w, d, 0.6, 0);
      put(o, x + 0.3, y + 0.3, z, 0.6, 0.6, 1.8, 1);
      put(o, x + w - 0.9, y + 0.3, z, 0.6, 0.6, 1.8, 1);
      put(o, x + 0.3, y + d - 0.9, z, 0.6, 0.6, 1.8, 1);
      put(o, x + w - 0.9, y + d - 0.9, z, 0.6, 0.6, 1.8, 1);
    },

    throne: function (o, x, y, z) {
      put(o, x, y, z, 4, 4, 1.2, 1);                 // the dais
      put(o, x + 0.6, y + 0.6, z + 1.2, 2.8, 2.8, 0.8, 0);
      put(o, x + 0.6, y + 2.6, z + 2, 2.8, 0.8, 3.4, 1);
      put(o, x + 0.6, y + 2.6, z + 5.4, 2.8, 0.8, 0.5, 0);
    },

    tomb: function (o, x, y, z, w, d) {
      put(o, x, y, z, w, d, 1.4, 1);
      put(o, x - 0.3, y - 0.3, z + 1.4, w + 0.6, d + 0.6, 0.6, 0);
      put(o, x + 0.6, y + 0.6, z + 2, w - 1.2, d - 1.2, 0.4, 2);
    },

    cauldron: function (o, x, y, z) {
      put(o, x, y, z, 3, 3, 0.5, 2);
      put(o, x + 0.3, y + 0.3, z + 0.5, 2.4, 2.4, 1.8, 1);
      put(o, x, y, z + 2.3, 3, 3, 0.5, 0);
      put(o, x + 1, y + 1, z + 3, 1, 1, 1.4, 0);     // what is rising off it
      put(o, x + 1.2, y + 1.2, z + 4.6, 0.7, 0.7, 1, 0);
    },

    /* A mound with a stone at its head. */
    mound: function (o, x, y, z, w, d) {
      put(o, x, y, z, w, d, 0.8, 1);
      put(o, x + 0.8, y + 0.8, z + 0.8, w - 1.6, d - 1.6, 0.7, 0);
      put(o, x + w * 0.35, y + d - 0.6, z + 1.5, w * 0.3, 0.6, 2.4, 1);
    },

    toadstool: function (o, x, y, z, s) {
      put(o, x + s * 0.3, y + s * 0.3, z, s * 0.4, s * 0.4, s * 0.9, 0);
      put(o, x, y, z + s * 0.9, s, s, s * 0.5, 2);
      put(o, x + s * 0.2, y + s * 0.2, z + s * 1.4, s * 0.6, s * 0.6, s * 0.25, 0);
    },

    log: function (o, x, y, z, w) {
      put(o, x, y, z, w, 1.6, 1.4, 1);
      put(o, x, y, z + 1.4, w, 1.6, 0.4, 0);
    },

    rock: function (o, x, y, z, w, d, h) {
      put(o, x, y, z, w, d, h, 1);
      put(o, x + 0.5, y + 0.5, z + h, w - 1, d - 1, 0.6, 0);
    }
  };

  /* ---- the places ---------------------------------------------------------

     Ten of them for sixteen scenes. A play's scenes mostly happen somewhere
     the play has already been, so the balcony is its own place but the
     prologue, the meeting, the quarrel and the nurse all happen in the same
     Verona street. */

  var PLACES = {
    "verona": function (o) {                 // a street: an arched wall, a well
      FLAT.floor(o, 0, 0, 15, 13, "verona");
      FLAT.wall(o, 1, 11.5, 1, 13, 5, true);
      FLAT.crown(o, 1, 11.5, 6.5, 13);
      FLAT.arch(o, 3, 11.4, 1, 5, 4.5);
      FLAT.rock(o, 9.5, 5.5, 1, 3.4, 3.4, 1.6);
      FLAT.rail(o, 9.8, 5.2, 2.6, 3);
      FLAT.torch(o, 1.6, 10.4, 1);
      FLAT.vine(o, 8, 11.4, 2, 5, 4.5, "verona");
    },

    "balcony": function (o) {                // a tower wall with a balcony
      FLAT.floor(o, 0, 0, 13, 12, "balcony");
      FLAT.wall(o, 1, 10.5, 1, 11, 10, false);
      FLAT.arch(o, 4.5, 10.4, 6.6, 4, 3.4);
      FLAT.balcony(o, 4, 8.2, 6, 5);
      FLAT.vine(o, 1.2, 10.4, 1, 10, 6, "balcony");
      FLAT.torch(o, 1.8, 9.4, 1);
    },

    "tomb": function (o) {                   // steps down to a slab
      FLAT.floor(o, 0, 0, 14, 12, "tomb");
      FLAT.wall(o, 1, 10.5, 1, 12, 4.5, true);
      FLAT.steps(o, 4, 6.5, 1, 6, 4);
      FLAT.tomb(o, 4.5, 2.5, 1, 5, 3.4);
      FLAT.torch(o, 2.2, 3, 1);
      FLAT.torch(o, 10.6, 3, 1);
    },

    "battlement": function (o) {             // Elsinore, at night
      FLAT.floor(o, 0, 0, 15, 11, "battlement");
      FLAT.wall(o, 1, 9.5, 1, 13, 4, false);
      FLAT.crown(o, 1, 9.5, 5.5, 13);
      FLAT.side(o, 1, 2, 1, 7.5, 4, false);
      FLAT.crown(o, 1, 2, 5.5, 2);
      FLAT.torch(o, 12.4, 8.4, 1);
    },

    "graveyard": function (o) {              // a mound, a stone, a skull
      FLAT.floor(o, 0, 0, 14, 12, "graveyard");
      FLAT.mound(o, 3, 6, 1, 6, 4);
      FLAT.mound(o, 9.5, 2.5, 1, 3.6, 3);
      FLAT.rock(o, 1, 2, 1, 2.4, 2.4, 1.2);
      put(o, 1.5, 2.5, 2.2, 1.4, 1.4, 1.2, 0);       // the skull on the stone
      FLAT.vine(o, 2, 9.4, 1, 10, 1.4, "grave");
    },

    "hall": function (o) {                   // Dunsinane: a throne on a dais
      FLAT.floor(o, 0, 0, 15, 13, "hall");
      FLAT.wall(o, 1, 11.5, 1, 13, 7, false);
      FLAT.column(o, 2.4, 8.5, 1, 7);
      FLAT.column(o, 11, 8.5, 1, 7);
      FLAT.throne(o, 5.5, 8.5, 1);
      put(o, 3.6, 11.4, 4.5, 1.6, 0.5, 4.5, 2);      // banners on the wall
      put(o, 9.8, 11.4, 4.5, 1.6, 0.5, 4.5, 2);
      FLAT.torch(o, 1.8, 10.4, 1);
      FLAT.torch(o, 12.6, 10.4, 1);
    },

    "chamber": function (o) {                // a basin on a stand, a candle
      FLAT.floor(o, 0, 0, 13, 11, "chamber");
      FLAT.wall(o, 1, 9.5, 1, 11, 6, true);
      FLAT.table(o, 4, 5.5, 1, 4.5, 3);
      put(o, 5.2, 6.4, 2.4, 2.2, 1.4, 0.8, 2);       // the basin
      FLAT.torch(o, 10.2, 8.4, 1);
      FLAT.arch(o, 1.6, 9.4, 1, 3.4, 4);
    },

    "wood": function (o) {                   // the Dream: toadstools and a log
      FLAT.floor(o, 0, 0, 14, 12, "wood");
      FLAT.log(o, 2.5, 4, 1, 7);
      FLAT.toadstool(o, 10, 7.5, 1, 3);
      FLAT.toadstool(o, 1.5, 8.5, 1, 2.2);
      FLAT.toadstool(o, 7.5, 9.5, 1, 1.6);
      FLAT.vine(o, 1, 10.6, 1, 12, 3, "wood");
    },

    "island": function (o) {                 // the Tempest: a rock over water
      FLAT.floor(o, 0, 0, 14, 12, "island");
      FLAT.rock(o, 6.5, 6.5, 1, 6, 4.4, 3.4);
      FLAT.rock(o, 2, 8, 1, 3.4, 3, 1.8);
      FLAT.steps(o, 7.5, 3.5, 1, 3.4, 3);
      put(o, 9.4, 8, 4.4, 0.6, 0.6, 4.6, 0);         // the staff, set upright
      FLAT.vine(o, 1, 11, 1, 12, 1.6, "island");
    },

    "arden": function (o) {                  // As You Like It: a log and a tree
      FLAT.floor(o, 0, 0, 13, 12, "arden");
      FLAT.log(o, 2, 4.5, 1, 6);
      put(o, 9.5, 8, 1, 1.8, 1.8, 6, 1);             // the trunk
      put(o, 7.6, 6.2, 7, 5.6, 5.2, 1.6, 2);         // and what is on it
      put(o, 8.4, 7, 8.6, 4, 3.6, 1.2, 2);
      FLAT.toadstool(o, 1.6, 9.5, 1, 1.8);
    }
  };

  /* Which place each scene is played in. */
  var SET_OF = {
    "Prologue": "verona", "The meeting": "verona", "The quarrel": "verona",
    "The nurse": "verona", "The balcony": "balcony", "The tomb": "tomb",
    "To be": "battlement", "Yorick": "graveyard",
    "The dagger": "hall", "Tomorrow": "hall", "The sticking-place": "hall",
    "The spot": "chamber",
    "What fools": "wood", "If we shadows": "wood",
    "Our revels": "island", "All the world": "arden"
  };

  /* ---- drawing one -------------------------------------------------------- */

  /* What a pile of boxes takes up once it is turned to the corner. */
  function boxBounds(boxes) {
    var xa = Infinity, xb = -Infinity, ya = Infinity, yb = -Infinity;
    var za = Infinity, zb = -Infinity;
    boxes.forEach(function (b) {
      if (b.x < xa) { xa = b.x; }
      if (b.x + b.w > xb) { xb = b.x + b.w; }
      if (b.y < ya) { ya = b.y; }
      if (b.y + b.d > yb) { yb = b.y + b.d; }
      if (b.z < za) { za = b.z; }
      if (b.z + b.h > zb) { zb = b.z + b.h; }
    });
    if (xa === Infinity) { return { x: 0, y: 0, w: 1, h: 1 }; }
    var u0 = isoU(xa, yb), u1 = isoU(xb, ya);
    var v0 = isoV(xa, ya, zb), v1 = isoV(xb, yb, za);
    return { x: u0, y: v0, w: u1 - u0, h: v1 - v0 };
  }

  /* Far to near, and every box carries its own depth — a floor is wide and
     flat, a column is narrow and tall, and they have to be sorted against
     each other properly or a wall is painted over what stands in front of it. */
  function build(boxes, tones, tile) {
    boxes.sort(function (a, b) {
      return (a.x + a.y + a.z) - (b.x + b.y + b.z);
    });
    var out = "";
    boxes.forEach(function (b) {
      out += block(b.x, b.y, b.z, b.w, b.d, b.h, tones[b.t] || tones[1], tile);
    });
    return out;
  }

  function drawSet(born) {
    var place = PLACES[born.piece] || PLACES.verona;
    var all = [];
    place(all);

    // Built from the ground up: only what has risen so far.
    var up = born.risen;
    var boxes = all.filter(function (b) { return b.z < up; });
    if (!boxes.length) { boxes = all.filter(function (b) { return b.z < 1.01; }); }

    var fit = boxBounds(all);          // the finished size, so it does not grow
    return {
      fit: fit,
      svg: '<svg viewBox="' + fit.x.toFixed(2) + " " + fit.y.toFixed(2) + " " +
           fit.w.toFixed(2) + " " + fit.h.toFixed(2) +
           '" aria-hidden="true" focusable="false">' +
           build(boxes, ramp(born.token), SET_TILE) + "</svg>"
    };
  }

  /* A landmark. Not a set that rises and is struck: a building that is
     standing there when you arrive and is still standing when you go. */
  function drawHouse(born) {
    var all = [];
    var make = BUILT[born.piece];
    if (make) { make(all); }
    var fit = boxBounds(all);
    return {
      fit: fit,
      svg: '<svg viewBox="' + fit.x.toFixed(2) + " " + fit.y.toFixed(2) + " " +
           fit.w.toFixed(2) + " " + fit.h.toFixed(2) +
           '" aria-hidden="true" focusable="false">' +
           build(all, born.stone, SET_TILE) + "</svg>"
    };
  }

  function houseFor(city) {
    var el = document.createElement("div");
    el.className = "spawn";

    var born = {
      el: el, token: null, kind: "house", piece: city.piece,
      home: city.slug, stone: stone(city.hue === undefined ? 0.09 : city.hue),
      tier: 1, crack: 0, bands: [], stack: [],
      following: false, held: false, to: null, next: 0, phase: 0,
      since: performance.now(),
      // Set well back from where anything stands, so the company plays in
      // front of it rather than inside it. The animal alone is half the
      // height of the screen down here, so "behind" has to mean properly
      // behind.
      lat: city.lat + near(0.21),
      lon: city.lon
    };

    redraw(born);
    spawns.push(born);
    land.insertBefore(el, creature);
    return born;
  }

  function placeHeight(piece) {
    var all = [];
    (PLACES[piece] || PLACES.verona)(all);
    var top = 0;
    all.forEach(function (b) { if (b.z + b.h > top) { top = b.z + b.h; } });
    return top;
  }

  /* One diorama for the scene, set a little behind the marks so the players
     stand in front of it rather than inside it. */
  function raise(def, cast, at) {
    var piece = SET_OF[def.name];
    if (!piece) { return; }

    var el = document.createElement("div");
    el.className = "spawn";
    el.tabIndex = 0;
    el.setAttribute("role", "button");

    var born = {
      el: el, token: cast[0].token, kind: "set", piece: piece,
      tier: 1, risen: 1.2, rose: 0, phase: 0, next: 0,
      lat: inBand(at.lat + near(0.055)), lon: at.lon
    };
    redraw(born);
    wireCompany(born);
    spawns.push(born);
    land.insertBefore(el, creature);
  }

  function strike() {
    spawns.slice().forEach(function (born) {
      if (born.kind !== "set") { return; }
      burstAt(born, ramp(born.token));
      banish(born);
    });
  }

  /* It goes up a course at a time, so a scene is seen to be built. */
  function stepSets(now) {
    spawns.forEach(function (born) {
      if (born.kind !== "set") { return; }
      if (born.risen >= placeHeight(born.piece)) { return; }
      // On a beat the melt can carry: a course laid every 110ms put five
      // half-faded copies of the same wall on top of each other. This way
      // one course is still dissolving as the next arrives, which is what
      // makes it read as rising rather than as a stack of redraws.
      if (now - born.rose < 259) { return; }
      born.rose = now;
      born.risen += 1.2;
      redraw(born);
    });
  }

  /* ---- the troupe ----------------------------------------------------------

     Not everything that grows off the animal has to be a game. Some of what
     comes out of it are players, and players do what players do: they find
     each other, take their marks, and act.

     Cézanne would sit an hour over one stroke, because a stroke had to hold
     the air, the light, the object, the composition, the character, the
     outline and the style all at once. That is the rule this whole page is
     built on and it is worth saying plainly where the characters come in: one
     palette applied is one stroke, and a stroke here carries a colour, an
     outline the animal did not have before, and — from here on — sometimes a
     character. Not a colour first and a figure later. The same gesture, the
     whole thing at once.

     Which is also why a player is never finished. Feed it another palette and
     it keeps its part and is dressed again in the new work's colours: the
     character survives the stroke, the way it survives a new production.
     Expressing what exists is an endless task.

     Twelve parts and sixteen scenes, out of six plays: Romeo and Juliet,
     Hamlet, Macbeth, A Midsummer Night's Dream, The Tempest, As You Like It.
     Half of the scenes are one person alone, which is deliberate — a
     soliloquy needs nobody else to have turned up, so the repertory keeps
     moving even when the troupe is small.

     Casting is toward a scene: whoever is missing from the scene nearest to
     being ready is who arrives next, so a troupe assembles rather than
     twelve people who never share a stage. It fills to eight over the first
     fourteen applications; after that a player is no likelier than a tube or
     a tower. Whichever castable scene has waited longest is the one that
     goes up, so the same two do not play over and over. Pressing any player
     cues a scene its cast can fill; alone, it gives its aside instead.
     The lines are Shakespeare's, which is to say they are everyone's. */

  var ROLES = ["Chorus", "Romeo", "Juliet", "Nurse", "Mercutio", "Tybalt",
               "Hamlet", "Macbeth", "Lady Macbeth", "Puck", "Prospero",
               "Jaques"];

  /* What each of them says when it is pressed and nobody else is ready. */
  var ASIDE = {
    "Chorus":       "Two households, both alike in dignity\u2026",
    "Romeo":        "He jests at scars that never felt a wound.",
    "Juliet":       "My only love sprung from my only hate!",
    "Nurse":        "My mistress is the sweetest lady.",
    "Mercutio":     "A plague o' both your houses!",
    "Tybalt":       "Peace? I hate the word.",
    "Hamlet":       "The rest is silence.",
    "Macbeth":      "Out, out, brief candle!",
    "Lady Macbeth": "What's done cannot be undone.",
    "Puck":         "Lord, what fools these mortals be!",
    "Prospero":     "We are such stuff as dreams are made on.",
    "Jaques":       "All the world's a stage."
  };

  /* Nine cells across, fifteen down, and every one of them drawn out of the
     three colours of the work that cast it:
       a  the gown or the doublet      b  what is lit on it — trim, a crown,
       c  a cloak, a shadow, a sword      a collar, a hem
       s  the face                     k  ink: hair, boots
       .  nothing

     They were seven by eleven and read as a person-shaped smudge beside a
     diorama. What makes a figure in a sprite sheet legible at this size is
     not detail, it is silhouette: a crown breaks the line of a head, a cloak
     falls wider than the body, a staff stands a cell clear of the arm. Every
     one of these is meant to be told from the others at a glance, by outline
     alone, before any colour arrives. */
  var PLAYER_ART = {
    "Chorus": [
      "...bbb...", "..bbbbb..", "..bsssb..", "..bsssb..", "..bbbbb..",
      ".aaaaaaa.", ".aaaaaaa.", ".aaaaaaa.", ".aaaaaaa.", ".aaaaaaa.",
      "aaaaaaaaa", "aaaaaaaaa", "aaaaaaaaa", "bbbbbbbbb", "..k...k.."
    ],
    "Romeo": [
      "...kkk...", "..kkkkk..", "..bsssb..", "...sss...", "..bbbbb..",
      "ccaaaaab.", "ccaaaaab.", "ccaaaaa.b", "ccaaaaa.b", "cc.aaa..b",
      "...a.a..b", "...a.a...", "...a.a...", "..kk.kk..", "........."
    ],
    "Juliet": [
      "..kkkkk..", ".kkkkkkk.", ".ksssssk.", ".ksssssk.", "..bbbbb..",
      "..aaaaa..", ".aaaaaaa.", ".aaaaaaa.", "aaaaaaaaa", "aaaaaaaaa",
      "aaaaaaaaa", "abbbbbbba", "aaaaaaaaa", "bbbbbbbbb", ".c.....c."
    ],
    "Nurse": [
      ".bbbbbbb.", ".bbbbbbb.", "..bsssb..", "...sss...", "..aaaaa..",
      ".aaaaaaa.", ".abbbbba.", ".abbbbba.", "aabbbbbaa", "aabbbbbaa",
      "aaaaaaaaa", "aaaaaaaaa", "aaaaaaaaa", "bbbbbbbbb", "..k...k.."
    ],
    "Mercutio": [
      "......c..", "...bbb.c.", "..bbbbb..", "...sss...", "..bbbbb..",
      ".caaaaac.", "bcaaaaacb", ".caaaaac.", "..aaaaa..", "..aaaaa..",
      "..a...a..", "..a...a..", "..a...a..", "..kk.kk..", "........."
    ],
    "Tybalt": [
      "...kkk..b", "..kkkkk.b", "..bsssb.b", "...sss..b", "..bbbbb.b",
      ".caaaaacb", ".caaaaac.", ".caaaaac.", "..aaaaa..", "..aaaaa..",
      "..a...a..", "..a...a..", "..a...a..", "..kk.kk..", "........."
    ],
    "Hamlet": [
      "...kkk...", "..kkkkk..", "..csssc..", "...sss...", "..ccccc..",
      ".ccccccc.", "bccccccc.", "bccccccc.", ".ccccccc.", "..ccccc..",
      "..c...c..", "..c...c..", "..c...c..", "..kk.kk..", "........."
    ],
    "Macbeth": [
      ".b.b.b...", "..bbb....", "..bsssb..", "...sss...", "..bbbbb..",
      ".aaaaaacc", ".aaaaaacc", ".aaaaaacc", "..aaaaacc", "..aaaaacc",
      "..a...acc", "..a...ac.", "..a...a..", "..kk.kk..", "........."
    ],
    "Lady Macbeth": [
      "..kkkkk..", ".kkkkkkk.", "..ksssk..", "...sss...", "..bbbbb..",
      "c.aaaaa..", "..aaaaa..", ".aaaaaaa.", ".aaaaaaa.", "aaaaaaaaa",
      "aaaaaaaaa", "aaaaaaaaa", "abbbbbbba", "bbbbbbbbb", "........."
    ],
    "Puck": [
      "..c...c..", "...c.c...", "..bsssb..", "...sss...", "..ababa..",
      "cbabababc", "..ababa..", "..ababa..", "..aba....", "..a.a....",
      ".a...a...", ".a...a...", ".k...k...", ".........", "........."
    ],
    "Prospero": [
      "...aaa..b", "..aaaaa.b", "..asssa.b", "..asssa.b", "..aaaaa.b",
      ".aaaaaa.b", ".aaaaaa.b", "bbbbbbb.b", ".aaaaaa.b", ".aaaaaa.b",
      "aaaaaaa.b", "aaaaaaa.b", "aaaaaaa..", "bbbbbbb..", "........."
    ],
    "Jaques": [
      ".bbbbbbb.", "..bbbbb..", "..bsssb..", "...sss...", "..bbbbb.b",
      ".caaaaacb", ".caaaaacb", ".caaaaacb", ".caaaaacb", "..aaaaa.b",
      "..a...a.b", "..a...a.b", "..a...a..", "..kk.kk..", "........."
    ]
  };

  function drawPlayer(born) {
    var c = ramp(born.token);
    var tone = {
      a: c[1],                       // the gown takes the middle tone
      b: c[0],                       // what is lit on it, the lightest
      c: c[2],                       // a cloak or a shadow, the darkest
      s: lift(c[0], 0.5),
      k: lift(c[2], -0.4)
    };
    var art = PLAYER_ART[born.role] || PLAYER_ART.Chorus;
    return { cols: 9, rows: 15, cells: stencil(art, function (x, y, ch) {
      return tone[ch] || c[1];
    }) };
  }

  /* Casting is toward a scene, not at random. Whoever is missing from
     whichever scene is nearest to being ready gets cast next, so a troupe
     assembles into something that can actually be played instead of
     collecting eight people who never share a stage. The work still chooses
     between the parts that would do — that is what the seed is for — and a
     part already standing is never cast twice while an empty one is left. */
  function roleFor(tok, word) {
    var rnd = seedFrom(tok.s, 23);
    var taken = {};
    // Who is standing HERE. A part being played in another city is not
    // spoken for in this one.
    company().forEach(function (born) { if (born.role) { taken[born.role] = true; } });

    // The ground casts, where the ground is already about somebody: the hand
    // that wrote it, what is left of a person, the joker in the New York
    // collage. It casts the first two parts; after that the scene decides,
    // because those five words cast five fixed parts out of five different
    // plays and five people from five plays cannot play a scene between
    // them — the company filled up and nothing was ever castable.
    var cast = word && CASTS[word];
    var standing = 0;
    company().forEach(function (born) { if (born.role) { standing += 1; } });
    if (cast && !taken[cast] && standing < 2) { return cast; }

    var wanted = null;
    var nearest = -1;
    SCENES.forEach(function (def) {
      var missing = def.cast.filter(function (role) { return !taken[role]; });
      if (!missing.length) { return; }
      // A scene nobody has seen yet outranks one that has already played,
      // and within that, the one closest to having its people. Counting
      // heads alone kept casting the same play's understudies.
      var score = (def.last ? 0 : 2) +
                  (def.cast.length - missing.length) / def.cast.length;
      if (score > nearest) { nearest = score; wanted = missing; }
    });
    if (wanted) { return wanted[Math.floor(rnd() * wanted.length) % wanted.length]; }

    var at = Math.floor(rnd() * ROLES.length);
    for (var i = 0; i < ROLES.length; i += 1) {
      var role = ROLES[(at + i) % ROLES.length];
      if (!taken[role]) { return role; }
    }
    return ROLES[at];
  }

  /* ---- the scenes ---------------------------------------------------------

     Marks are given as an offset in latitude and longitude from the middle of
     the stage, so they hold their places while the world turns and they read
     as standing on the sphere rather than on the screen. Juliet's mark in the
     balcony is simply higher up the world than Romeo's. */

  var SOLO = [[0, 0]];
  var FACING = [[0, -0.085], [0, 0.085]];

  /* Listed so the plays alternate. The world casts toward whichever
     scene is nearest to being ready and works down the list, so a list
     grouped by play would fill the stage with one play's people and
     never reach the rest. Interleaved, the fourth player to arrive is
     already from a fourth play. */
  var SCENES = [
    { name: "Prologue", play: "Romeo and Juliet",
      cast: ["Chorus"], marks: SOLO,
      beats: [
        [0, "Two households, both alike in dignity,"],
        [0, "In fair Verona, where we lay our scene,"],
        [0, "A pair of star-cross'd lovers take their life."]
      ] },

    { name: "To be", play: "Hamlet",
      cast: ["Hamlet"], marks: SOLO,
      beats: [
        [0, "To be, or not to be: that is the question."],
        [0, "Whether 'tis nobler in the mind to suffer"],
        [0, "The slings and arrows of outrageous fortune,"],
        [0, "Or to take arms against a sea of troubles."]
      ] },

    { name: "The meeting", play: "Romeo and Juliet",
      cast: ["Romeo", "Juliet"], marks: FACING,
      beats: [
        [0, "If I profane with my unworthiest hand"],
        [0, "This holy shrine, the gentle sin is this:"],
        [1, "Good pilgrim, you do wrong your hand too much."],
        [0, "Then move not while my prayer's effect I take."]
      ] },

    { name: "The dagger", play: "Macbeth",
      cast: ["Macbeth"], marks: SOLO,
      beats: [
        [0, "Is this a dagger which I see before me,"],
        [0, "The handle toward my hand? Come, let me clutch thee."],
        [0, "I have thee not, and yet I see thee still."]
      ] },

    { name: "What fools", play: "A Midsummer Night's Dream",
      cast: ["Puck"], marks: SOLO,
      beats: [
        [0, "Lord, what fools these mortals be!"],
        [0, "I'll put a girdle round about the earth"],
        [0, "In forty minutes."]
      ] },

    { name: "The balcony", play: "Romeo and Juliet",
      cast: ["Romeo", "Juliet"], marks: [[-0.015, -0.1], [0.075, 0.07]],
      beats: [
        [0, "But soft! What light through yonder window breaks?"],
        [0, "It is the east, and Juliet is the sun."],
        [1, "O Romeo, Romeo, wherefore art thou Romeo?"],
        [1, "Deny thy father and refuse thy name."],
        [0, "I take thee at thy word."]
      ] },

    { name: "Our revels", play: "The Tempest",
      cast: ["Prospero"], marks: SOLO,
      beats: [
        [0, "Our revels now are ended. These our actors,"],
        [0, "As I foretold you, were all spirits and"],
        [0, "Are melted into air, into thin air."],
        [0, "We are such stuff as dreams are made on."]
      ] },

    { name: "All the world", play: "As You Like It",
      cast: ["Jaques"], marks: SOLO,
      beats: [
        [0, "All the world's a stage,"],
        [0, "And all the men and women merely players."],
        [0, "They have their exits and their entrances."]
      ] },

    { name: "The quarrel", play: "Romeo and Juliet",
      cast: ["Tybalt", "Mercutio"], marks: FACING,
      beats: [
        [0, "Mercutio, thou consort'st with Romeo."],
        [1, "Consort? What, dost thou make us minstrels?"],
        [0, "I am for you."],
        [1, "A plague o' both your houses! I am sped."]
      ] },

    { name: "Tomorrow", play: "Macbeth",
      cast: ["Macbeth"], marks: SOLO,
      beats: [
        [0, "Tomorrow, and tomorrow, and tomorrow,"],
        [0, "Creeps in this petty pace from day to day,"],
        [0, "Out, out, brief candle! Life's but a walking shadow."]
      ] },

    { name: "The spot", play: "Macbeth",
      cast: ["Lady Macbeth"], marks: SOLO,
      beats: [
        [0, "Out, damned spot! Out, I say!"],
        [0, "Yet who would have thought the old man"],
        [0, "to have had so much blood in him?"]
      ] },

    { name: "The nurse", play: "Romeo and Juliet",
      cast: ["Nurse", "Juliet"], marks: FACING,
      beats: [
        [1, "Now, good sweet Nurse \u2014 why look'st thou sad?"],
        [0, "I am aweary. Give me leave awhile."],
        [1, "How art thou out of breath, when thou hast breath?"]
      ] },

    { name: "Yorick", play: "Hamlet",
      cast: ["Hamlet"], marks: SOLO,
      beats: [
        [0, "Alas, poor Yorick! I knew him, Horatio:"],
        [0, "A fellow of infinite jest, of most excellent fancy."],
        [0, "Where be your gibes now?"]
      ] },

    { name: "If we shadows", play: "A Midsummer Night's Dream",
      cast: ["Puck"], marks: SOLO,
      beats: [
        [0, "If we shadows have offended,"],
        [0, "Think but this, and all is mended:"],
        [0, "That you have but slumber'd here."]
      ] },

    { name: "The sticking-place", play: "Macbeth",
      cast: ["Macbeth", "Lady Macbeth"], marks: FACING,
      beats: [
        [0, "If we should fail?"],
        [1, "We fail?"],
        [1, "But screw your courage to the sticking-place,"],
        [1, "And we'll not fail."]
      ] },

    { name: "The tomb", play: "Romeo and Juliet",
      cast: ["Romeo", "Juliet"], marks: [[0, -0.07], [0, 0.07]],
      beats: [
        [0, "Here's to my love. Thus with a kiss I die."],
        [1, "O happy dagger! This is thy sheath."]
      ] }
  ];

  var playing = null;    // { def, cast, at, until, lat, lon }
  var curtain = 0;       // when the last scene came down
  var REST = Math.round(2600 * PHI * 2);   // how long the stage stays empty

  /* The middle of the near face, a golden third up the band of latitudes
     anyone can see, which is where there is room to stand. */
  function boards() {
    // In a city the boards are the ground in front of you. On the globe they
    // were a fixed latitude two fifths up the band, which is where they stay
    // if there is ever a scene up there again.
    if (place) {
      return { lat: place.lat - near(0.1), lon: place.lon };
    }
    return { lat: LAT_LOW + (LAT_TOP - LAT_LOW) * INV2, lon: wrap(spin) };
  }

  function players() {
    // Only the ones standing here. A player left in another city is not in
    // the wings, it is in another city.
    return company().filter(function (born) { return born.kind === "player"; });
  }

  /* Everyone a scene needs, or nothing. */
  function castFor(def) {
    var free = players().filter(function (born) { return !born.acting; });
    var out = [];
    for (var i = 0; i < def.cast.length; i += 1) {
      var want = def.cast[i];
      var found = null;
      for (var j = 0; j < free.length; j += 1) {
        if (free[j].role === want && out.indexOf(free[j]) < 0) { found = free[j]; break; }
      }
      if (!found) { return null; }
      out.push(found);
    }
    return out;
  }

  function dwell(line) {
    return Math.max(1800, Math.min(4200, 1200 + line.length * 46));
  }

  function beginScene(def, cast, now) {
    var at = boards();
    playing = { def: def, cast: cast, at: -1, until: now,
                lat: at.lat, lon: at.lon, since: now };
    raise(def, cast, at);
    cast.forEach(function (born, i) {
      born.acting = true;
      born.mark = { lat: at.lat + near(def.marks[i][0]),
                    lon: wrap(at.lon + near(def.marks[i][1])) };
      born.faces = def.marks[i][1] > 0 ? -1 : 1;
      born.el.dataset.acting = "true";
    });
  }

  function endScene() {
    if (!playing) { return; }
    playing.cast.forEach(function (born) {
      born.acting = false;
      born.mark = null;
      born.next = 0;                    // straight back to wandering
      delete born.el.dataset.acting;
      delete born.el.dataset.speaking;
    });
    playing = null;
    say.hidden = true;
    strike();
  }

  function stepScene(now) {
    if (!playing) {
      if (still || !onStage() || now - curtain < REST) { return; }
      // Whichever castable scene has waited longest goes up. Taking the
      // next one round the list meant the same two played over and over,
      // because the same two were the only ones whose people were standing.
      var best = null;
      var pick = null;
      for (var i = 0; i < SCENES.length; i += 1) {
        var def = SCENES[i];
        var cast = castFor(def);
        if (!cast) { continue; }
        if (!best || (def.last || 0) < (best.last || 0)) { best = def; pick = cast; }
      }
      if (best) { best.last = now; beginScene(best, pick, now); }
      return;
    }

    if (now < playing.until) { return; }

    playing.at += 1;
    if (playing.at >= playing.def.beats.length) {
      curtain = now;
      endScene();
      return;
    }

    var line = playing.def.beats[playing.at];
    var who = playing.cast[line[0]];
    playing.cast.forEach(function (born) { delete born.el.dataset.speaking; });
    who.el.dataset.speaking = "true";
    sayWho.textContent = who.role;
    sayLine.textContent = line[1];
    say.hidden = false;
    playing.until = now + dwell(line[1]);
  }

  /* ---- the ground a scene is played on -------------------------------------

     Looking at more of her work than the one painting changed what this
     could be. The Mina Mina canvases are white dots on black in strands that
     crowd and part; Karntakurlangu Jukurrpa is a lattice of dotted cells over
     a warm brown; Mina Mina Dreaming is nothing but horizontal strands, and
     all its variation is in how far apart they run. But Sandhill Country, a
     colour aquatint, is three-toned: a terracotta ground, black dots running
     in strands across it that swell and shrink along their own line, and pale
     pools opening between them.

     Three tones is what a work here already has, sorted by lightness. So a
     scene brings its own ground with it: when the players take their marks,
     the world under them thickens into a patch of that — the strands in the
     dark of the work that cast the lead, the pools in its lightest — and it
     comes up over about a second, the way the set does. It is not a platform
     drawn under them; it is the same surface the whole world is made of,
     gathered where something is happening. Which is what density means in
     her paintings: this is a place. */

  function drawStage(ctx, now) {
    if (!playing || !playing.cast.length || still) { return; }

    var p = project(playing.lat, playing.lon);
    if (p.z <= 0.08) { return; }

    var up = Math.min(1, (now - (playing.since || now)) / 900);
    if (up <= 0) { return; }

    var tone = ramp(playing.cast[0].token);
    var dark = tone[2];
    var pale = tone[0];

    var rx = R * 0.2 * (0.55 + 0.45 * p.z);
    var ry = rx * 0.3;
    var rows = 15;
    var step = Math.max(3, Math.round(rx / 34));
    var grain = Math.max(1, Math.round(R / 700));

    ctx.save();
    for (var j = -rows; j <= rows; j += 1) {
      var t = j / rows;
      var span = 1 - t * t;
      if (span <= 0.02) { continue; }
      var y = p.y + t * ry;
      var half = rx * Math.sqrt(span);

      // Every strand drifts a little, and they crowd toward the middle of the
      // patch rather than lying evenly, which is what makes it read as a
      // place rather than a disc.
      var drift = Math.sin(j * 1.7 + playing.at) * ry * 0.06;
      var thick = 0.35 + 0.65 * span;

      for (var x = -half; x <= half; x += step) {
        var edge = 1 - Math.abs(x) / (half + 0.001);
        var a = up * thick * edge * 0.78;
        if (a < 0.03) { continue; }

        // The pale pools open between the strands, in runs rather than one
        // dot at a time.
        var pool = Math.sin(x * 0.07 + j * 2.3) > 0.72;
        ctx.globalAlpha = Math.min(0.85, pool ? a * 1.45 : a);
        ctx.fillStyle = pool ? pale : dark;
        var big = (Math.round(x / step) + j) % 3 === 0 ? grain + 1 : grain;
        ctx.fillRect(Math.round(p.x + x), Math.round(y + drift), big, big);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /* The line stands over whoever is saying it. */
  function placeSay() {
    if (!playing || say.hidden) { return; }
    var line = playing.def.beats[playing.at];
    if (!line) { return; }
    var who = playing.cast[line[0]];
    var box = who.el.getBoundingClientRect();
    if (!box.width) { return; }
    var w = say.offsetWidth || 180;
    var x = Math.max(8, Math.min(box.left + box.width / 2 - w / 2, W - w - 8));
    var y = Math.max(8, box.top - (say.offsetHeight || 44) - 10);
    say.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  /* Pressing a player: if the cast for one of its scenes is standing, that
     scene goes up. Otherwise it says its own line and the rest ignore it. */
  function cue(born, now) {
    // Mid-scene, a press is not dead: it takes the next line. Pressing a
    // player while somebody is speaking used to do nothing at all, which
    // reads as a broken control rather than as a rule.
    if (playing) { playing.until = 0; return; }
    for (var i = 0; i < SCENES.length; i += 1) {
      var def = SCENES[i];
      if (def.cast.indexOf(born.role) < 0) { continue; }
      var cast = castFor(def);
      if (cast) { def.last = now; beginScene(def, cast, now); return; }
    }
    // Alone, then. An aside is still a performance.
    var at = boards();
    playing = {
      def: { name: "An aside", cast: [born.role], marks: [[0, 0]],
             beats: [[0, ASIDE[born.role] || "…"]] },
      cast: [born], at: -1, until: now,
      lat: born.lat, lon: born.lon, since: now
    };
    born.acting = true;
    born.mark = { lat: born.lat, lon: born.lon };    // says it where it stands
    born.faces = 1;
    born.el.dataset.acting = "true";
  }

  /* ---- squashing ----------------------------------------------------------

     The world builds up on its own now, so there has to be a way to put it
     back down that is quicker than the building. Press and hold anywhere on
     the ground and a ring opens under your thumb, growing while you hold it.
     Let go and everything inside it is squashed: the pixels burst and go
     into the air, and if there were two or more of them they come back down
     as one egg, which is something else again. A scene caught in the ring
     comes down with it, set and all.

     Pressing rather than holding still turns the world, and a press that
     moves is a turn, so nothing is lost by trying. The animal is never
     squashed; it is the one thing on here that is not excess. */

  var squashing = null;        // { id, x, y, since, ring }
  var SQUASH_WAIT = 260;       // holding this long opens the ring
  var SQUASH_MIN = 40;
  var SQUASH_MAX = 300;

  function squashRing(now) {
    // Only down in a city. Up on the globe there is nothing to squash and a
    // ring opening under the thumb would only be in the way of turning it.
    if (!squashing || !place) { return 0; }
    var held = now - squashing.since;
    if (held < SQUASH_WAIT) { return 0; }
    return Math.min(SQUASH_MAX, SQUASH_MIN + (held - SQUASH_WAIT) * 0.42);
  }

  /* The ring opened under a held press. It is drawn as tiles now (see
     drawTiles); all this does is say where it is. */
  function drawRing(now) {
    var r = squashRing(now);
    ringNow = r ? { x: squashing.x, y: squashing.y, r: r } : null;
    if (r) { tilesDirty = true; }
  }

  function squash(x, y, r) {
    pulse(x, y, [LIGHT], 1, r * PHI);
    // Now and then someone comes out of the wave (characters.js): only in a
    // city, never while a collage is being read or a flight is on.
    if (window.Characters && place && !flying && !reading && !deckMode &&
        (place.work || (art && art.kind === "town"))) {
      Characters.wave(x, y, { key: place.townKey || place.slug, lat: place.lat / RAD, lon: place.lon / RAD, r: r,
                              name: place.title });
    }
    var caught = [];
    spawns.forEach(function (born) {
      if (born.el.style.visibility === "hidden") { return; }
      if (born.kind === "house") { return; }   // the building stays
      var p = project(born.lat, born.lon);
      if (Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)) <= r) {
        caught.push(born);
      }
    });
    if (!caught.length) { return; }

    // A scene with any of it caught comes down whole, rather than losing one
    // player and carrying on with a hole where they stood.
    if (playing && caught.some(function (born) {
      return born.kind === "set" || playing.cast.indexOf(born) >= 0;
    })) {
      curtain = performance.now();
      endScene();
      strike();
      caught = caught.filter(function (born) { return spawns.indexOf(born) >= 0; });
    }

    var tones = [];
    var keep = null;
    var from = null;
    caught.forEach(function (born) {
      tones = tones.concat(ramp(born.token));
      if (!keep) { keep = born.token; from = born; }
      burstAt(born, ramp(born.token));
      banish(born);
    });

    kick(x, y, tones.length ? tones : palette(), 30, 7, 2.6);

    // Two or more of anything, squashed together, come back as one egg —
    // which is to say as something else, once somebody opens it.
    if (caught.length > 1 && keep) {
      // It keeps the ground the crowd was standing on: squashing a thing
      // does not take it off the word it grew out of.
      var born = sprout(keep, from && from.ground
        ? { word: from.ground, works: { length: from.roots || 1 } } : null);
      if (born) {
        born.kind = "egg";
        born.crack = 0;
        var at = unproject(x, y);
        if (at) { born.lat = at.lat; born.lon = at.lon; }
        redraw(born);
      }
    }
  }

  /* Where on the sphere a point on the screen is, if it is on it at all. */
  function unproject(x, y) {
    var dx = (x - cx) / R;
    var dy = (cy - y) / R;
    if (dx * dx + dy * dy > 1) { return null; }
    var z2 = Math.sqrt(1 - dx * dx - dy * dy);
    var yy = dy * COS_T + z2 * SIN_T;          // undo the lean
    var zz = -dy * SIN_T + z2 * COS_T;
    var lat = Math.asin(Math.max(-1, Math.min(1, yy)));
    return { lat: lat, lon: wrap(Math.atan2(dx, zz) + spin) };
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
    traceHint.textContent = hint ? hint + " · hold to open on " + tokenHome(tok)
                                 : "Open on " + tokenHome(tok);
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
    window.open(tokenHref(part.token), "_blank", "noopener");
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
    // A second finger down means the browser is being pinched, not that the
    // world is being turned. Let go of the turn and the squash and leave the
    // gesture to it, or the world spins while someone is trying to zoom.
    fingers[event.pointerId] = { x: event.clientX, y: event.clientY };
    // Two fingers that are the small globe's pinch (fingerDown): nothing else begins.
    if (lensPinch || cityPinch) { return; }
    if ((turning || panning) && Object.keys(fingers).length >= 2) {
      turning = null;
      panning = null;
      squashing = null;
      delete stage.dataset.turning;
      // Two fingers on the globe view pinch the world nearer or further.
      if (!place && !flying && !swing) {
        var at = pinchState();
        pinch = { d: at.d, x: at.x, y: at.y, size: seat.size };
      }
      return;
    }

    // A press on the sky, off the world, carries the world across it.
    if (!place && !flying && !swing && !unproject(event.clientX, event.clientY)) {
      if (offering || carrying) { dismiss(); }
      panning = { id: event.pointerId, x: event.clientX, y: event.clientY,
                  dx: seat.dx, dy: seat.dy, moved: 0, at: performance.now() };
      stage.dataset.turning = "true";
      try { stage.setPointerCapture(event.pointerId); } catch (e) {}
      return;
    }

    // Only reaches here when the press missed the creature, the card and the
    // token, all of which stop it. So: put down whatever was up.
    if (offering || carrying) { dismiss(); }
    turning = { id: event.pointerId, x: event.clientX, y: event.clientY,
                spin: spin, lean: tilt, moved: 0, at: performance.now() };
    squashing = { id: event.pointerId, x: event.clientX, y: event.clientY,
                  since: performance.now() };
    stage.dataset.turning = "true";
    try { stage.setPointerCapture(event.pointerId); } catch (e) {}
  });

  stage.addEventListener("pointermove", function (event) {
    if (!deckMode) {
      tread(event.clientX, event.clientY);
      dropHubble(event.clientX, event.clientY);
    }
    if (event.pointerType === "mouse") { pointDoor(event.clientX, event.clientY); }
    if (fingers[event.pointerId]) {
      fingers[event.pointerId].x = event.clientX;
      fingers[event.pointerId].y = event.clientY;
    }
    if (pinch) {
      var now2 = pinchState();
      if (now2 && !place && (dive.on || (seat.size >= SIZE_MOST - 1e-6 && now2.d > pinch.d))) {
        // Past the globe's nearest: the dive, as far as the fingers go.
        diveTo(dive.log + Math.log(now2.d / pinch.d), now2.x, now2.y);
        pinch.d = now2.d; pinch.x = now2.x; pinch.y = now2.y;
        if (dive.log <= 0) { diveEnd(); }
        return;
      }
      if (now2) {
        var size = Math.max(SIZE_FAR * INV, Math.min(SIZE_MOST, pinch.size * now2.d / pinch.d));
        var t = seatAbout(now2.x, now2.y, size);
        // And the pair of fingers drags it as it pinches.
        t.dx += (now2.x - pinch.x) / W;
        t.dy += (now2.y - pinch.y) / H;
        pinch.x = now2.x; pinch.y = now2.y;
        pinch.size = size; pinch.d = now2.d;
        handle(t);
      }
      return;
    }
    if (panning && event.pointerId === panning.id) {
      var mx = event.clientX - panning.x, my = event.clientY - panning.y;
      panning.moved = Math.max(panning.moved, Math.abs(mx), Math.abs(my));
      if (panning.moved > 6) {
        handle({ size: seat.size, dx: panning.dx + mx / W, dy: panning.dy + my / H });
      }
      return;
    }
    if (!turning || event.pointerId !== turning.id) { return; }
    // The world is turned from up on the globe. Down in a city you are
    // standing on one patch of ground, woven for that patch, and turning
    // would only walk you off the edge of it. A work's view is the whole
    // world: there it moves under the finger, one to one (artist, 1 Oct
    // 2026: "you should always be free to move around the globe").
    if (place) {
      if (!(ARTWORKS && art && (art.kind === "work" || readingOn() || cityMap())) || flying) { return; }
      // In the reading layout the world is only in the lens: a drag begun there.
      if (readingOn() && LENS && turning.lens === undefined) { turning.lens = inLens(turning.x, turning.y); }
      if (turning.lens === false) { return; }
      var wx = event.clientX - turning.x, wy = event.clientY - turning.y;
      turning.moved = Math.max(turning.moved, Math.abs(wx), Math.abs(wy));
      if (turning.moved < 6) { return; }
      squashing = null;
      art.glide = null;
      art.lens = null;
      if (window.Voice && Voice.handled) { Voice.handled(); }
      var rr = Math.max(R, 1);
      if (cityMap()) {
        // The city is a map (artist, 7 Oct 2026): moved under the finger, and let go with its speed.
        cityFling = null;
        var tnow = performance.now(), tdt = Math.max(1, tnow - (turning.lt || turning.at));
        var lx = turning.lx === undefined ? turning.x : turning.lx, ly = turning.ly === undefined ? turning.y : turning.ly;
        turning.vx = 0.6 * (turning.vx || 0) + 0.4 * (event.clientX - lx) / tdt;
        turning.vy = 0.6 * (turning.vy || 0) + 0.4 * (event.clientY - ly) / tdt;
        turning.lx = event.clientX; turning.ly = event.clientY; turning.lt = tnow;
        cityPan(event.clientX - lx, event.clientY - ly);
        return;
      }
      wanted = spin = turning.spin - wx / rr / Math.max(0.25, Math.cos(focus.lat));
      lean(turning.lean + wy / rr);
      focus.lat = tilt;
      reframe();
      art.dirty = true;
      return;
    }
    var dx = event.clientX - turning.x;
    var dy = event.clientY - turning.y;
    turning.moved = Math.max(turning.moved, Math.abs(dx), Math.abs(dy));
    // A press that moves is a turn, not a squash.
    if (squashing && turning.moved > 8) { squashing = null; }
    // A drag across the whole sphere turns it about half way round; a drag
    // down it rolls it north, which is to say it pulls the world down and
    // lets you see over the top of it.
    wanted = turning.spin - (dx / Math.max(R, 1)) * Math.PI;
    spin = wanted;
    lean(turning.lean + (dy / Math.max(R, 1)) * Math.PI * 0.62);
  });

  ["pointerup", "pointercancel"].forEach(function (name) {
    stage.addEventListener(name, function (event) {
      delete fingers[event.pointerId];
      if (pinch) {
        if (Object.keys(fingers).length < 2) { pinch = null; delete stage.dataset.turning; diveEnd(); }
        return;
      }
      if (panning && event.pointerId === panning.id) {
        var tap = panning.moved < 6 && performance.now() - panning.at < 450;
        panning = null;
        delete stage.dataset.turning;
        // The passing journey's head can arch out over the sky.
        if (tap && name === "pointerup" && !pressPassing(event.clientX, event.clientY)) { pressSky(event.clientX, event.clientY); }
        return;
      }
      if (!turning || event.pointerId !== turning.id) { return; }
      var was = turning;
      turning = null;
      delete stage.dataset.turning;
      if (cityMap() && was.moved >= 6) {
        cityLetGo(was);
        squashing = null;
        return;
      }

      // On the Museums layer a press on a city, named or not, goes down to
      // it; in a city, a press on a gallery's tile says what it is; in an
      // art view, a press on a stop goes to it.
      var k = -1, hit = null;
      if (name === "pointerup" && was.moved < 6) {
        if (venueLabel && !venueLabel.hidden) { venueLabel.hidden = true; }
        if (ARTWORKS && pressPassing(event.clientX, event.clientY)) { squashing = null; return; }
        if (place && !flying && art && art.kind === "town" && (hit = hitVenue(event.clientX, event.clientY))) {
          squashing = null;
          showVenue(hit);
          return;
        }
        if (grown && ARTWORKS && art && (k = hitStop(event.clientX, event.clientY)) >= 0) {
          squashing = null;
          chooseStop(k);
          return;
        }
        if (layerOn === "museums" && (!place || grown) && !flying && (hit = hitTown(event.clientX, event.clientY, event.pointerType !== "mouse"))) {
          squashing = null;
          if (grown) {
            cameLayer = layerOn;
            pulse(event.clientX, event.clientY, [LIGHT, LILAC], 0.6, 144);
          }
          openTown(hit.key);
          return;
        }
        if (ARTWORKS && art && !flying && (k = hitStop(event.clientX, event.clientY)) >= 0) {
          squashing = null;
          chooseStop(k);
          return;
        }
      }

      // The reading layout: the world is only in the lens. A plain tap on
      // the lens changes it with the picture (the big place the world's); a
      // press outside it, on the dark, is nobody's.
      if (readingOn() && LENS && name === "pointerup" && !flying) {
        if (!inLens(event.clientX, event.clientY)) { squashing = null; hideDoor(); return; }
        if (LENS_GLOBE && was.moved < 6 && performance.now() - was.at < 450) {
          // Two taps bring it home; one, at rest, changes it with the picture
          // once it is plain that no second is coming.
          var nowT = performance.now();
          window.clearTimeout(lensTapT);
          if (nowT - lensTapAt < 320) {
            lensTapAt = 0;
            squashing = null;
            hideDoor();
            lensHome();
            return;
          }
          lensTapAt = nowT;
          if (partsNow().globe !== "big" && !lensAway()) {
            squashing = null;
            hideDoor();
            lensTapT = window.setTimeout(function () { if (!lensAway()) { swapWithBig("globe"); } }, 320);
            return;
          }
        }
        if (!LENS_GLOBE && !lensSwapped && was.moved < 6 && performance.now() - was.at < 450) {
          squashing = null;
          hideDoor();
          setSwap(true);
          return;
        }
      }

      // A quick press that did not move, on a world small enough to be seen
      // whole, brings it in.
      if (name === "pointerup" && was.moved < 6 &&
          performance.now() - was.at < 450 &&
          pressGlobe(event.clientX, event.clientY)) {
        squashing = null;
        return;
      }

      if (squashing && squashing.id === event.pointerId) {
        var reach = squashRing(performance.now());
        var where = squashing;
        squashing = null;
        if (reach) { squash(where.x, where.y, reach); return; }
      }

      // A plain quick tap on the world, with a finger: the spot is ringed
      // and named, and spreading two fingers next dives there (the dive).
      if (name === "pointerup" && was.moved < 6 && performance.now() - was.at < 450 &&
          event.pointerType !== "mouse") { setAim(event.clientX, event.clientY); }
      // A plain quick tap on bare land or sea: the work in that cell.
      if (name === "pointerup" && was.moved < 6 && performance.now() - was.at < 450 &&
          pressDoor(event.clientX, event.clientY)) { return; }
      hideDoor();
    });
  });

  /* ---- the collages, dealt ------------------------------------------------

     The Artist Website is one page. There is no works page to be sent off
     to: a collage is shown where it is — in its city, with the world grown
     around it — or, all seven at once, laid out over the world when you ask
     for the collages. A word does the same with the works it is written on.

     Whichever it is, nothing is laid out the same way twice. Every collage
     comes as separate things — its photograph, its title, where it is, what
     it is made of and how big, its price, its notes, and whatever has been
     written about it — and each of those is put down somewhere new every
     time anything is pressed: the image at a new size, the words at new
     places around it and at new widths, so they break on new lines. They
     never land on each other. A thing that belongs to a collage lands next
     to that collage, so it can still be read as its caption.

     Writings are read from `writings` on a work in works.json — a list of
     { "text": ..., "by": ... } — and are dealt exactly like the rest. None
     are there yet; they are the artist's to add, and the page takes them as
     soon as they are. */

  var deck = document.getElementById("deck");
  var deckTable = document.getElementById("deck-table");
  var deckClose = document.getElementById("deck-close");
  var hereLayer = document.getElementById("here");

  var deckMode = null;         // "all", "word", or null when it is put away
  var deckWord = null;         // the word it was opened on, for "word"
  var hereShown = false;       // whether the collage in this city is out
  var bound = null;            // a city to go down into once the flight ends
  var turnsOf = {};            // quarter turns each collage is hung at
  var aspectOf = {};           // width over height, once its photograph is read
  var GAP = 13;                // --s-4: how close two things may come

  function between(a, b) { return a + Math.random() * (b - a); }

  function shuffled(list) {
    var out = list.slice();
    for (var i = out.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function clash(a, b, gap) {
    return a.x < b.x + b.w + gap && b.x < a.x + a.w + gap &&
           a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
  }

  function cityOf(slug) {
    for (var i = 0; i < cities.length; i += 1) {
      if (cities[i].slug === slug) { return cities[i]; }
    }
    return null;
  }

  function plateSrc(work) { return "../images/" + work.slug + ".jpg"; }

  /* The photographs are read ahead, quietly, so that the first time one is
     dealt its real shape is known and the box is cut to it. Until then a
     box is three by four, which is what they all are today, and the image
     is fitted inside it rather than stretched. */
  function readAhead() {
    (mine ? mine.works : []).forEach(function (work) {
      var probe = new Image();
      probe.decoding = "async";
      probe.onload = function () {
        if (probe.naturalWidth && probe.naturalHeight) {
          aspectOf[work.slug] = probe.naturalWidth / probe.naturalHeight;
        }
      };
      probe.src = plateSrc(work);
    });
  }

  /* Each collage is hung in any of four orientations — the works page used
     to open each at a random quarter turn, and the notes still say so — and
     it is hung the same way until someone turns it. */
  function turnsFor(slug) {
    if (turnsOf[slug] === undefined) { turnsOf[slug] = Math.floor(Math.random() * 4); }
    return turnsOf[slug];
  }

  /* ---- the orientation vote, carried over from the works page ---------- */

  var VOTED = "ml-orientation-vote:";

  function voted(title) {
    try { return localStorage.getItem(VOTED + title); } catch (e) { return null; }
  }

  function vote(work) {
    var v = mine.vote || {};
    if (!v.formId) { return; }
    var body = new FormData();
    body.append(v.workField, work.title);
    body.append(v.orientationField, String(turnsFor(work.slug) + 1));
    fetch("https://docs.google.com/forms/d/e/" + v.formId + "/formResponse", {
      method: "POST", mode: "no-cors", body: body
    }).catch(function () {});
    try { localStorage.setItem(VOTED + work.title, String(turnsFor(work.slug) + 1)); } catch (e) {}
  }

  /* ---- the pieces ------------------------------------------------------- */

  /* A piece is kept from one deal to the next when the same thing is dealt
     again, so pressing moves everything to its new place rather than
     wiping the table and setting it again. */
  function piece(host, pool, key, make) {
    var el = pool.els[key];
    if (!el) {
      el = make();
      el.dataset.key = key;
      el.dataset.fresh = "true";
      host.appendChild(el);
      pool.els[key] = el;
    }
    pool.used[key] = true;
    return el;
  }

  function textPiece(host, pool, key, cls, fill) {
    var el = piece(host, pool, key, function () {
      var p = document.createElement("p");
      p.className = "deal-text " + cls;
      return p;
    });
    fill(el);
    return el;
  }

  /* One of the few ways a line of text can be set. Which one a piece gets is
     dealt as well, along with how wide it may run. */
  var VOICES = ["plain", "large", "small", "tall"];
  var LONG = ["plain", "tall"];       // a paragraph is not set in capitals

  function setText(el, narrow, wide, voices) {
    voices = voices || VOICES;
    el.dataset.voice = voices[Math.floor(Math.random() * voices.length)];
    el.style.maxWidth = Math.round(between(narrow, wide)) + "px";
    // Never narrower than its longest word: one that cannot break would hang
    // out of its box, over whatever is dealt beside it, and out of its clip.
    if (el.scrollWidth > el.offsetWidth + 1) { el.style.maxWidth = Math.ceil(el.scrollWidth) + "px"; }
    el.style.textAlign = ["left", "left", "right", "center"][Math.floor(Math.random() * 4)];
  }

  function measure(el) {
    return { el: el, w: el.offsetWidth, h: el.offsetHeight };
  }

  /* What goes round a collage, in no order: the order is dealt. */
  function captionOf(host, pool, work, city, opts) {
    var out = [];
    var room = Math.max(160, Math.min(W - 2 * GAP, 320));

    out.push(textPiece(host, pool, work.slug + ":title", "deal-title", function (el) {
      el.innerHTML = "<em></em>, <span></span>";
      el.firstChild.textContent = work.title;
      el.lastChild.textContent = work.year;
      setText(el, 140, room);
    }));

    if (city && city.where) {
      out.push(textPiece(host, pool, work.slug + ":where", "deal-where", function (el) {
        el.textContent = city.where;
        setText(el, 90, room);
      }));
    }

    var line = workLine(work);
    if (line) {
      out.push(textPiece(host, pool, work.slug + ":detail", "deal-detail", function (el) {
        el.textContent = line;
        setText(el, 120, room);
      }));
    }

    if (work.availability) {
      out.push(textPiece(host, pool, work.slug + ":price", "deal-price", function (el) {
        el.textContent = work.availability;
        setText(el, 100, room);
      }));
    }

    var notes = (mine.notes && mine.notes[work.category]) || [];
    notes.forEach(function (note, i) {
      out.push(textPiece(host, pool, work.slug + ":note" + i, "deal-note", function (el) {
        el.textContent = note;
        setText(el, 150, room, LONG);
      }));
    });

    (work.writings || []).forEach(function (writing, i) {
      out.push(textPiece(host, pool, work.slug + ":writing" + i, "deal-writing", function (el) {
        el.textContent = "";
        var said = document.createElement("span");
        said.className = "deal-said";
        said.textContent = writing.text || String(writing);
        el.appendChild(said);
        if (writing.by) {
          var by = document.createElement("span");
          by.className = "deal-by";
          by.textContent = writing.by;
          el.appendChild(by);
        }
        setText(el, 200, Math.max(room, Math.min(W - 2 * GAP, 420)), LONG);
      }));
    });

    var v = mine.vote || {};
    if (v.formId && work.category === "Collage" && opts.vote) {
      var ballot = piece(host, pool, work.slug + ":vote", function () {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "deal-text deal-vote";
        b.addEventListener("click", function (event) {
          event.stopPropagation();
          vote(work);
          b.textContent = v.thanks || "Recorded";
          b.disabled = true;
        });
        return b;
      });
      if (voted(work.title)) {
        ballot.textContent = v.thanks || "Recorded";
        ballot.disabled = true;
      } else {
        ballot.textContent = v.prompt || "Prefer this orientation?";
      }
      ballot.style.maxWidth = "";
      out.push(ballot);
    }

    return out.map(measure);
  }

  /* The photograph, in a box cut to it at whatever quarter turn it is hung
     at, with the control that turns it. */
  function platePiece(host, pool, work, city, longSide, press) {
    var el = piece(host, pool, work.slug + ":plate", function () {
      var box = document.createElement("div");
      box.className = "deal-plate";

      var go = document.createElement("button");
      go.type = "button";
      go.className = "deal-go";
      var img = document.createElement("img");
      img.alt = work.alt + ".";
      img.draggable = false;
      img.decoding = "async";
      img.src = plateSrc(work);
      img.addEventListener("load", function () {
        if (img.naturalWidth && img.naturalHeight) {
          aspectOf[work.slug] = img.naturalWidth / img.naturalHeight;
        }
      });
      go.appendChild(img);
      go.addEventListener("pointerenter", function (event) { pointAt(box, go, event); });
      box.appendChild(go);

      var turn = document.createElement("button");
      turn.type = "button";
      turn.className = "deal-turn";
      turn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/></svg>';
      turn.addEventListener("click", function (event) {
        event.stopPropagation();
        turnsOf[work.slug] = (turnsFor(work.slug) + 1) % 4;
        box.dataset.turned = "true";
        redeal();
      });
      box.appendChild(turn);
      return box;
    });

    // What pressing the photograph does is decided by where it is dealt:
    // out on the table it takes you to its city; in its city it deals again.
    var go = el.firstChild;
    go.onclick = function (event) { event.stopPropagation(); press(); };
    go.setAttribute("aria-label", city && deckMode
      ? "Go to " + work.title + ", in " + city.where
      : work.title + " — press to lay it out again");

    var turns = turnsFor(work.slug);
    var turn = el.lastChild;
    turn.setAttribute("aria-label", "Turn " + work.title +
      " a quarter turn clockwise (showing orientation " + (turns + 1) + " of 4)");

    var a = aspectOf[work.slug] || 0.75;
    var iw = a <= 1 ? longSide * a : longSide;
    var ih = a <= 1 ? longSide : longSide / a;
    var side = turns % 2 === 1;
    var bw = side ? ih : iw, bh = side ? iw : ih;

    el.style.width = bw.toFixed(1) + "px";
    el.style.height = bh.toFixed(1) + "px";
    var img = go.firstChild;
    img.style.width = iw.toFixed(1) + "px";
    img.style.height = ih.toFixed(1) + "px";
    img.style.transform = "translate(-50%,-50%) rotate(" + turns * 90 + "deg)";
    el.dataset.orientation = String(turns + 1);

    return { el: el, w: bw, h: bh };
  }

  /* A collage and its caption, laid out as one group: the photograph first,
     then each piece of the caption dropped at random somewhere round it, as
     near as it will go without touching anything already down. */
  function cluster(things, maxW, maxH) {
    var head = things[0];
    var placed = [{ x: 0, y: 0, w: head.w, h: head.h, el: head.el }];
    // The group so far, which may not grow wider or taller than it is let.
    var x0 = 0, y0 = 0, x1 = head.w, y1 = head.h;
    maxW = maxW || Infinity;
    maxH = maxH || Infinity;
    for (var i = 1; i < things.length; i += 1) {
      var t = things[i];
      var reach = Math.min(head.w, head.h) * 0.22 + 8;
      var spot = null;
      for (var tries = 0; tries < 600 && !spot; tries += 1) {
        if (tries && tries % 40 === 0) { reach += 18; }
        var xlo = Math.max(-t.w - reach, x1 - maxW);
        var xhi = Math.min(head.w + reach, x0 + maxW - t.w);
        var ylo = Math.max(-t.h - reach, y1 - maxH);
        var yhi = Math.min(head.h + reach, y0 + maxH - t.h);
        if (xlo > xhi || ylo > yhi) { continue; }
        var c = {
          x: between(xlo, xhi),
          y: between(ylo, yhi),
          w: t.w, h: t.h, el: t.el
        };
        var ok = true;
        for (var k = 0; k < placed.length && ok; k += 1) {
          if (clash(c, placed[k], GAP * 0.62)) { ok = false; }
        }
        if (ok) { spot = c; }
      }
      if (!spot) {           // it will go underneath, then
        spot = { x: x0, y: y1 + GAP, w: t.w, h: t.h, el: t.el };
      }
      placed.push(spot);
      x0 = Math.min(x0, spot.x); y0 = Math.min(y0, spot.y);
      x1 = Math.max(x1, spot.x + spot.w); y1 = Math.max(y1, spot.y + spot.h);
    }
    placed.forEach(function (p) { p.x -= x0; p.y -= y0; });
    return { parts: placed, w: x1 - x0, h: y1 - y0 };
  }

  /* Groups dropped on the table at random, none on another, none on
     anything the table has to keep clear. When they will not fit the table
     is lengthened — it scrolls — unless it is not allowed to, and then
     whatever does not fit is reported back so it can be made smaller. */
  function scatter(groups, width, height, clear, grow) {
    var down = clear.slice();
    var tall = height;
    if (grow) {
      // Start with about a third more room than the pieces take up, so the table is
      // loose but not a long walk.
      var area = 0;
      groups.forEach(function (it) { area += (it.w + GAP) * (it.h + GAP); });
      tall = Math.max(height, area * 1.35 / width);
    }
    for (var g = 0; g < groups.length; g += 1) {
      var it = groups[g];
      var spot = null;
      for (var tries = 0; tries < 900 && !spot; tries += 1) {
        if (tries && tries % 60 === 0) {
          if (!grow) { break; }
          tall *= 1.05;
        }
        // Some things are kept to the first screen, so the table never
        // opens on an empty stretch of itself.
        var floor = it.first && tries < 450 ? Math.min(tall, height) : tall;
        var c = {
          x: between(GAP, Math.max(GAP, width - it.w - GAP)),
          y: between(GAP, Math.max(GAP, floor - it.h - GAP)),
          w: it.w, h: it.h
        };
        var ok = true;
        for (var k = 0; k < down.length && ok; k += 1) {
          if (clash(c, down[k], GAP)) { ok = false; }
        }
        if (ok) { spot = c; }
      }
      if (!spot) { return null; }
      it.x = spot.x;
      it.y = spot.y;
      down.push(spot);
    }
    var low = 0;
    groups.forEach(function (it) { low = Math.max(low, it.y + it.h); });
    return Math.max(height, low + GAP * 2);
  }

  function setDown(groups) {
    groups.forEach(function (it, n) {
      it.parts.forEach(function (p, m) {
        var el = p.el;
        el.style.transform = "translate(" + (it.x + p.x).toFixed(1) + "px," +
                                           (it.y + p.y).toFixed(1) + "px)";
        if (el.dataset.fresh) {
          // Things arriving come up where they land, one after another,
          // rather than sliding in from the corner all at once.
          el.getBoundingClientRect();
          var wait = still ? 0 : Math.round(n * 70 + m * 40 + Math.random() * 90);
          if (el.classList.contains("deal-plate")) { bringIn(el, wait); } else { enterText(el, wait); }
          requestAnimationFrame(function () {
            // Only the fade (and a caption's wipe) waits; a move never does,
            // or pressing again soon after would leave some of it standing.
            el.style.transitionDelay = "0ms, 0ms, 0ms, " + wait + "ms, " + wait + "ms";
            delete el.dataset.fresh;
            window.setTimeout(function () { el.style.transitionDelay = ""; },
                              wait + 700);
          });
        }
      });
    });
  }

  /* A photograph arrives a tile at a time: it is covered by a grid of
     nine-pixel tiles which come away in held frames, from one corner
     outward with a ragged edge, the tile just going catching the light in
     the lavender the rest of the pixel light is. */
  function pixelIn(box, wait) {
    if (still) { return; }
    var w = box.offsetWidth, h = box.offsetHeight;
    if (!w || !h) { return; }
    var veil = document.createElement("canvas");
    veil.className = "deal-veil";
    veil.setAttribute("aria-hidden", "true");
    var k = Math.min(window.devicePixelRatio || 1, 2);
    veil.width = Math.round(w * k);
    veil.height = Math.round(h * k);
    box.appendChild(veil);
    var g = veil.getContext("2d");
    g.setTransform(k, 0, 0, k, 0, 0);
    var cell = 9;
    var cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
    var ox = Math.random() < 0.5 ? 0 : cols, oy = Math.random() < 0.5 ? 0 : rows;
    var far = Math.sqrt(cols * cols + rows * rows) || 1;
    var order = new Float32Array(cols * rows);
    for (var j = 0; j < rows; j += 1) {
      for (var i = 0; i < cols; i += 1) {
        var d = Math.sqrt((i - ox) * (i - ox) + (j - oy) * (j - oy)) / far;
        order[j * cols + i] = 0.55 * d + 0.45 * hash2(i + 7, j + 11);
      }
    }
    var start = performance.now() + wait, dur = 680;
    function step(now) {
      if (!veil.parentNode) { return; }
      var q = Math.max(0, (now - start) / dur);
      q = Math.floor(q * 20) / 20;                   // held frames
      g.clearRect(0, 0, w, h);
      for (var n = 0; n < order.length; n += 1) {
        var th = order[n];
        if (th <= q) { continue; }
        var x = (n % cols) * cell, y = Math.floor(n / cols) * cell;
        if (th <= q + 0.07) {
          g.fillStyle = LIGHT;
          g.globalAlpha = 0.72;
        } else {
          g.fillStyle = "#f3f1ee";
          g.globalAlpha = 1;
        }
        g.fillRect(x, y, cell, cell);
      }
      g.globalAlpha = 1;
      if (q >= 1.08) { veil.parentNode.removeChild(veil); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- the repertoire ------------------------------------------------------

     Nothing on this page is shown the same way twice, so nothing arrives the
     same way twice either. Each thing that happens is answered by one of
     several animations, dealt at random every time, the way the collages
     themselves are dealt. Most are after demos Codrops publishes with their
     source (github.com/codrops, named below), redrawn in this page's own
     pixel hand: held frames, a grid, the lavender light.

       a photograph arriving    tiles, mosaic (ImagePixelLoading), cells
                                (PixelTransition), bands (PixelTransition,
                                its fifth), blocks (BlockRevealers), glitch
                                (CSSGlitchEffect), dither, interlace, lift
                                (SegmentEffect)
       a photograph pointed at  glitch, tilt (GlitchPerspective), echo (the
                                repetition hover in codrops-sketches), mosaic
       a line of text arriving  wipe, decode, type (LineTextHoverAnimations),
                                block (BlockRevealers), blur
                                (ScrollBlurTypography), rise
       a word pointed at        decode or type
       the pointer going by     a trail of lit tiles (GooeyCursor), and out in
                                space a trail of the telescope's photographs
                                (ImageTrailEffects)
       going down, coming up,   a curtain of cells across the whole window
       opening, closing         (PixelTransition's staggers)
       a button near the        leans toward it (Magnetic Buttons)
       pointer                                                                */

  function oneOf(list) { return list[Math.floor(Math.random() * list.length)]; }

  var COVER = "#f3f1ee";       // the table a photograph is laid on
  var MOUNT = "#e7e6e2";       // and the card behind it
  var LILAC = "#9d95e6";
  var GOLD = "#d6b05c";

  /* A canvas laid over a photograph's box, covered or clear. */
  function veilOver(box, covered) {
    var w = box.offsetWidth, h = box.offsetHeight;
    if (!w || !h) { return null; }
    var c = document.createElement("canvas");
    c.className = "deal-veil";
    c.setAttribute("aria-hidden", "true");
    var k = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(w * k);
    c.height = Math.round(h * k);
    box.appendChild(c);
    var g = c.getContext("2d");
    g.setTransform(k, 0, 0, k, 0, 0);
    if (covered) { g.fillStyle = COVER; g.fillRect(0, 0, w, h); }
    return { c: c, g: g, w: w, h: h };
  }

  /* The photograph as it hangs in its box, the same size and the same
     quarter turn, for drawing on a canvas. Nothing until it has loaded. */
  function artOf(box) {
    var img = box.querySelector(".deal-go img");
    if (!img || !img.complete || !img.naturalWidth) { return null; }
    return {
      img: img,
      w: parseFloat(img.style.width) || box.offsetWidth,
      h: parseFloat(img.style.height) || box.offsetHeight,
      turn: ((parseInt(box.dataset.orientation, 10) || 1) - 1) * Math.PI / 2
    };
  }

  function drawArt(g, art, w, h, s) {
    s = s || 1;
    g.fillStyle = MOUNT;
    g.fillRect(0, 0, w * s, h * s);
    g.save();
    g.translate(w * s / 2, h * s / 2);
    g.rotate(art.turn);
    g.drawImage(art.img, -art.w * s / 2, -art.h * s / 2, art.w * s, art.h * s);
    g.restore();
  }

  /* Plays one over a photograph: draw(veil, q, art, ms), q going from 0 to
     1 in `frames` held steps over `dur` ms, starting after `wait`. One that
     needs the picture starts once the picture is there, and gives up — the
     photograph simply shows — if it never comes. */
  function runVeil(box, wait, dur, frames, draw, opts) {
    opts = opts || {};
    var v = veilOver(box, opts.covered !== false);
    if (!v) { return null; }
    var start = performance.now() + wait, art = null, gaveUp = start + 1600, last = -1;
    function step(now) {
      if (!v.c.parentNode) { return; }
      if (opts.art && !art) {
        art = artOf(box);
        if (!art) {
          if (now > gaveUp) { v.c.parentNode.removeChild(v.c); return; }
          requestAnimationFrame(step);
          return;
        }
        start = Math.max(start, now);
      }
      var ms = now - start;
      if (ms >= dur) { v.c.parentNode.removeChild(v.c); return; }
      if (ms >= 0) {
        var q = Math.floor(ms / dur * frames) / frames;
        if (q !== last || opts.everyFrame) {
          last = q;
          v.g.clearRect(0, 0, v.w, v.h);
          draw(v, q, art, ms);
        }
      }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    return v;
  }

  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }

  /* The picture, drawn small and blown back up without smoothing. */
  function mosaicFrame(v, art, across, small) {
    var sw = Math.max(1, across), sh = Math.max(1, Math.round(across * v.h / v.w));
    small.width = sw;
    small.height = sh;
    var sg = small.getContext("2d");
    sg.imageSmoothingEnabled = true;
    drawArt(sg, art, v.w, v.h, sw / v.w);
    v.g.imageSmoothingEnabled = false;
    v.g.drawImage(small, 0, 0, sw, sh, 0, 0, v.w, v.h);
    v.g.imageSmoothingEnabled = true;
  }

  /* CSSGlitchEffect: slices of it knocked sideways, a flash of colour
     across it, thin lines of light, settling as q goes to 1. The same frame
     is drawn for the same step, so a held frame holds. */
  function glitchFrame(arriving) {
    var seed = Math.random() * 97;
    return function (v, q, art) {
      var g = v.g, w = v.w, h = v.h, f = Math.round(q * 40);
      var r = function (n) { return hash2(f * 13 + n, Math.floor(seed) + n * 7); };
      if (q >= 0.8) { drawArt(g, art, w, h); return; }
      if (arriving && q < 0.3) { g.fillStyle = COVER; g.fillRect(0, 0, w, h); }
      else { drawArt(g, art, w, h); }
      var n = 3 + Math.floor(r(1) * 4);
      for (var s = 0; s < n; s += 1) {
        var y = r(10 + s) * h, hh = (0.05 + r(20 + s) * 0.2) * h;
        var dx = (r(30 + s) - 0.5) * w * 0.28 * (1 - q);
        g.save();
        g.beginPath();
        g.rect(0, y, w, hh);
        g.clip();
        g.translate(dx, 0);
        drawArt(g, art, w, h);
        g.restore();
        if (r(40 + s) < 0.4) {
          g.globalAlpha = 0.3;
          g.fillStyle = r(50 + s) < 0.5 ? LIGHT : "#ff4f7a";
          g.fillRect(0, y, w, hh);
          g.globalAlpha = 1;
        }
      }
      for (var l = 0; l < 2; l += 1) {
        g.fillStyle = r(60 + l) < 0.5 ? LIGHT : "#ffffff";
        g.fillRect(r(70 + l) * w * 0.3, r(80 + l) * h, w * (0.3 + r(90 + l) * 0.7),
                   1 + Math.round(r(95 + l) * 2));
      }
      if (f % 9 === 4) {
        g.globalAlpha = 0.28;
        g.fillStyle = LIGHT;
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 1;
      }
    };
  }

  var BAYER = [0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
               12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
               3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
               15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21];

  /* How a photograph comes onto the table. */
  var ARRIVALS = {
    tiles: function (box, wait) { pixelIn(box, wait); },

    // ImagePixelLoading: a few blocks across, then twice as many, and twice
    // again, then the photograph — the first held longest.
    mosaic: function (box, wait) {
      var small = document.createElement("canvas");
      var across = [5, 10, 20, 45];
      runVeil(box, wait, 300 + 80 * across.length, 15, function (v, q, art, ms) {
        var n = ms < 300 ? 0 : Math.min(across.length - 1, 1 + Math.floor((ms - 300) / 80));
        mosaicFrame(v, art, across[n], small);
      }, { art: true });
    },

    // PixelTransition: a grid of coloured cells over it that shrink away,
    // staggered from the middle, from the edges, from a corner or row by row.
    cells: function (box, wait) {
      var w = box.offsetWidth, h = box.offsetHeight;
      var size = Math.max(14, Math.min(w, h) / 6);
      var cols = Math.ceil(w / size), rows = Math.ceil(h / size);
      var from = oneOf(["center", "edges", "corner", "rows"]);
      var ci = Math.random() < 0.5 ? 0 : cols - 1, cj = Math.random() < 0.5 ? 0 : rows - 1;
      var anchor = oneOf([[0.5, 0.5], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]);
      var half = Math.max(1, (Math.min(cols, rows) - 1) / 2);
      var tones = [LIGHT, LIGHT, LILAC, GOLD];
      var cells = [];
      for (var j = 0; j < rows; j += 1) {
        for (var i = 0; i < cols; i += 1) {
          var o;
          if (from === "center") {
            o = Math.sqrt(Math.pow((i - (cols - 1) / 2) / cols, 2) +
                          Math.pow((j - (rows - 1) / 2) / rows, 2)) * 1.4;
          } else if (from === "edges") {
            o = 1 - Math.min(i, cols - 1 - i, j, rows - 1 - j) / half;
          } else if (from === "corner") {
            o = Math.sqrt((i - ci) * (i - ci) + (j - cj) * (j - cj)) / Math.sqrt(cols * cols + rows * rows);
          } else {
            o = (j + hash2(i, j) * 5) / (rows + 5);
          }
          cells.push({ x: i * size, y: j * size, o: clamp01(o),
                       tone: tones[Math.floor(hash2(i + 3, j + 5) * tones.length)] });
        }
      }
      runVeil(box, wait, 760, 18, function (v, q) {
        cells.forEach(function (c) {
          var s = 1 - clamp01((q - c.o * 0.55) / 0.45);
          if (s <= 0) { return; }
          var side = size * s;
          v.g.fillStyle = c.tone;
          v.g.fillRect(c.x + (size - side) * anchor[0], c.y + (size - side) * anchor[1],
                       side + 0.5, side + 0.5);
        });
      });
    },

    // PixelTransition's fifth: bands that flare white as they open.
    bands: function (box, wait) {
      var rows = 14, down = Math.random() < 0.5;
      runVeil(box, wait, 620, 16, function (v, q) {
        var bh = v.h / rows;
        for (var j = 0; j < rows; j += 1) {
          var o = (down ? j : rows - 1 - j) / rows;
          var p = (q - o * 0.6) / 0.4;
          if (p >= 1) { continue; }
          if (p <= 0) {
            v.g.fillStyle = COVER;
            v.g.fillRect(0, j * bh, v.w, bh + 0.5);
            continue;
          }
          v.g.globalAlpha = 1 - p;
          v.g.fillStyle = "#ffffff";
          v.g.fillRect(0, j * bh, v.w, bh + 0.5);
          v.g.globalAlpha = (1 - p) * 0.5;
          v.g.fillStyle = LIGHT;
          v.g.fillRect(0, j * bh, v.w, bh + 0.5);
          v.g.globalAlpha = 1;
        }
      });
    },

    // BlockRevealers: a block of light runs over it and off again, a gold
    // one close behind, and the photograph is there once they have passed.
    blocks: function (box, wait) {
      var side = oneOf(["left", "right", "top", "bottom"]);
      var LAG = 0.12;
      function block(v, tone, t) {
        if (t <= 0 || t >= 1) { return; }
        var a = t < 0.5 ? 0 : (t - 0.5) / 0.5, b = t < 0.5 ? t / 0.5 : 1;
        var across = side === "left" || side === "right";
        var len = across ? v.w : v.h;
        var s0 = a * len, s1 = b * len;
        if (side === "right" || side === "bottom") { var k = s0; s0 = len - s1; s1 = len - k; }
        v.g.fillStyle = tone;
        if (across) { v.g.fillRect(s0, 0, s1 - s0, v.h); }
        else { v.g.fillRect(0, s0, v.w, s1 - s0); }
      }
      runVeil(box, wait, 820, 20, function (v, q) {
        if (q < 0.5 * (1 - LAG)) { v.g.fillStyle = COVER; v.g.fillRect(0, 0, v.w, v.h); }
        block(v, GOLD, (q - LAG) / (1 - LAG));
        block(v, LIGHT, q / (1 - LAG));
      });
    },

    glitch: function (box, wait) {
      runVeil(box, wait, 560, 12, glitchFrame(true), { art: true });
    },

    // An ordered dither: the covering comes away a pixel at a time in the
    // order a Bayer matrix gives, the pixels just going catching the light.
    dither: function (box, wait) {
      var px = 3;
      var small = document.createElement("canvas");
      var sg = null, data = null, cols = 0, rows = 0, order = null;
      runVeil(box, wait, 700, 18, function (v, q) {
        if (!data) {
          cols = Math.ceil(v.w / px);
          rows = Math.ceil(v.h / px);
          small.width = cols;
          small.height = rows;
          sg = small.getContext("2d");
          data = sg.createImageData(cols, rows);
          order = new Float32Array(cols * rows);
          for (var j = 0; j < rows; j += 1) {
            for (var i = 0; i < cols; i += 1) {
              order[j * cols + i] = (BAYER[(j % 8) * 8 + (i % 8)] / 64) * 0.86 +
                                    hash2(i >> 3, j >> 3) * 0.14;
            }
          }
        }
        var d = data.data, at = q * 1.1;
        for (var n = 0; n < order.length; n += 1) {
          var th = order[n], o = n * 4;
          if (th <= at - 0.1) { d[o + 3] = 0; continue; }
          if (th <= at) { d[o] = 94; d[o + 1] = 82; d[o + 2] = 199; d[o + 3] = 210; continue; }
          d[o] = 243; d[o + 1] = 241; d[o + 2] = 238; d[o + 3] = 255;
        }
        sg.putImageData(data, 0, 0);
        v.g.imageSmoothingEnabled = false;
        v.g.drawImage(small, 0, 0, cols, rows, 0, 0, cols * px, rows * px);
        v.g.imageSmoothingEnabled = true;
      });
    },

    // The way a picture used to come down a slow line: every eighth row
    // first, stretched to fill, then every fourth, every second, all of them.
    interlace: function (box, wait) {
      var full = document.createElement("canvas");
      var row = 3;
      runVeil(box, wait, 560, 4, function (v, q, art) {
        if (!full.width || full.width !== Math.round(v.w)) {
          full.width = Math.round(v.w);
          full.height = Math.round(v.h);
          drawArt(full.getContext("2d"), art, v.w, v.h);
        }
        var pass = Math.min(3, Math.floor(q * 4));
        var step = [8, 4, 2, 1][pass] * row;
        v.g.imageSmoothingEnabled = false;
        for (var y = 0; y < v.h; y += step) {
          v.g.drawImage(full, 0, y, full.width, Math.min(row, full.height - y), 0, y, v.w, step);
        }
        v.g.imageSmoothingEnabled = true;
        v.g.fillStyle = LIGHT;
        v.g.globalAlpha = 0.7;
        v.g.fillRect(0, Math.floor(hash2(pass, 3) * v.h / step) * step, v.w, 1);
        v.g.globalAlpha = 1;
      }, { art: true });
    },

    // SegmentEffect: pieces of it lift off it on their shadows and settle.
    lift: function (box, wait) {
      var segs = [];
      var n = 3 + Math.floor(Math.random() * 3);
      for (var s = 0; s < n; s += 1) {
        var sw = between(0.24, 0.52), sh = between(0.18, 0.42);
        segs.push({ x: between(0, 1 - sw), y: between(0, 1 - sh), w: sw, h: sh });
      }
      runVeil(box, wait, 1000, 24, function (v, q, art) {
        var g = v.g;
        drawArt(g, art, v.w, v.h);
        g.fillStyle = "rgba(20, 22, 30, " + (0.18 * Math.sin(Math.PI * q)).toFixed(3) + ")";
        g.fillRect(0, 0, v.w, v.h);
        segs.forEach(function (seg, i) {
          var up = Math.sin(Math.PI * clamp01((q - i * 0.07) / 0.72));
          if (up <= 0.01) { return; }
          var x = seg.x * v.w, y = seg.y * v.h, w = seg.w * v.w, h = seg.h * v.h;
          var mx = x + w / 2, my = y + h / 2, k = 1 + 0.05 * up;
          g.save();
          g.translate(mx, my - 4 * up);
          g.scale(k, k);
          g.translate(-mx, -my);
          g.shadowColor = "rgba(20, 22, 30, 0.35)";
          g.shadowBlur = 14 * up;
          g.shadowOffsetY = 6 * up;
          g.fillStyle = MOUNT;
          g.fillRect(x, y, w, h);
          g.shadowColor = "transparent";
          g.beginPath();
          g.rect(x, y, w, h);
          g.clip();
          drawArt(g, art, v.w, v.h);
          g.restore();
        });
      }, { art: true });
    }
  };

  /* After the research the artist shared on 23 Sep 2026 (see systems.js):
     four more ways for a photograph to come onto the table. */
  function sampled(art, cols) {
    var rows = Math.max(6, Math.round(cols * art.boxH / art.boxW));
    return { cols: cols, rows: rows, data: Systems.sample(art.img, cols, rows, art.turn) };
  }

  function pixelCanvas(v, k) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(v.w / k));
    c.height = Math.max(1, Math.round(v.h / k));
    return c;
  }

  /* The colours the dreaming is made of: whatever is asked for first, then
     the collection's, a few at a time. */
  function dreamColours(first) {
    var out = (first || []).slice();
    var pool = (supply && supply.tokens) || [];
    for (var i = 0; out.length < 8 && i < 60 && pool.length; i += 1) {
      var tok = pool[Math.floor(Math.random() * pool.length)];
      if (tok && tok.c && tok.c.length) { out.push(tok.c[Math.floor(Math.random() * tok.c.length)]); }
    }
    return out.length ? out : [LIGHT, GOLD, LILAC];
  }

  function workTones(box) {
    var key = box.dataset.key || "";
    var slug = key.split(":")[0];
    return measured[slug] || [];
  }

  var MORE_ARRIVALS = {
    // After Refik Anadol, Unsupervised: the collection's colours as a fluid
    // that condenses into the photograph.
    hallucination: function (box, wait) {
      var fluid = null;
      runVeil(box, wait, 1400, 28, function (v, q, art) {
        if (!fluid) {
          var c = document.createElement("canvas");
          c.width = v.w;
          c.height = v.h;
          fluid = new Systems.Hallucination(c, dreamColours(workTones(box)), { cell: 3 });
        }
        fluid.step(1 / 18);
        fluid.draw(v.g, v.w, v.h);
        var e = Systems.smooth(q * 1.4 - 0.3);
        if (e > 0) {
          v.g.globalAlpha = Math.round(e * 6) / 6;
          drawArt(v.g, art, v.w, v.h);
          v.g.globalAlpha = 1;
        }
      }, { art: true });
    },

    // After GMUNK, Synapse Code: it arrives as geometry — its cells stood up
    // as columns in the corner view — and lies down into itself.
    synapse: function (box, wait) {
      var s = null, small = null;
      runVeil(box, wait, 1300, 26, function (v, q, art) {
        if (!s) {
          art.boxW = v.w; art.boxH = v.h;
          s = sampled(art, 20);
          small = pixelCanvas(v, 2);
        }
        if (!s.data) { drawArt(v.g, art, v.w, v.h); return; }
        var sg = small.getContext("2d");
        sg.clearRect(0, 0, small.width, small.height);
        Systems.synapse(sg, s.data, s.cols, s.rows, small.width, small.height, 1 - q, (1 - q) * 1.6);
        v.g.fillStyle = COVER;
        v.g.fillRect(0, 0, v.w, v.h);
        v.g.imageSmoothingEnabled = false;
        v.g.drawImage(small, 0, 0, v.w, v.h);
        if (q > 0.82) {
          v.g.globalAlpha = Math.round((q - 0.82) / 0.18 * 4) / 4;
          drawArt(v.g, art, v.w, v.h);
          v.g.globalAlpha = 1;
        }
      }, { art: true });
    },

    // After Quayola: found again by triangles, a few big ones and then more
    // and more, until they are the picture.
    strata: function (box, wait) {
      var stages = null, s = null, small = null;
      runVeil(box, wait, 1200, 9, function (v, q, art) {
        if (!stages) {
          art.boxW = v.w; art.boxH = v.h;
          s = sampled(art, 48);
          stages = s.data ? Systems.strataStages(s.data, s.cols, s.rows, 8, Math.random() * 1e9 | 0) : [];
          small = pixelCanvas(v, 2);
        }
        var n = Math.floor(q * 9);
        if (n >= stages.length) { drawArt(v.g, art, v.w, v.h); return; }
        var sg = small.getContext("2d");
        var kx = small.width / s.cols, ky = small.height / s.rows;
        sg.clearRect(0, 0, small.width, small.height);
        stages[n].forEach(function (t) {
          sg.fillStyle = t[3];
          sg.beginPath();
          sg.moveTo(t[0][0] * kx, t[0][1] * ky);
          sg.lineTo(t[1][0] * kx, t[1][1] * ky);
          sg.lineTo(t[2][0] * kx, t[2][1] * ky);
          sg.closePath();
          sg.fill();
          if (n < 5) {
            sg.strokeStyle = "rgba(20, 16, 24, " + (0.3 - n * 0.05).toFixed(2) + ")";
            sg.lineWidth = 0.5;
            sg.stroke();
          }
        });
        v.g.imageSmoothingEnabled = false;
        v.g.drawImage(small, 0, 0, v.w, v.h);
      }, { art: true });
    },

    // After Universal Everything, Primordial: one cell, two, four... each in
    // the colour of the picture where it is, until they are the picture.
    primordial: function (box, wait) {
      var stages = null;
      runVeil(box, wait, 1300, 11, function (v, q, art) {
        if (!stages) {
          art.boxW = v.w; art.boxH = v.h;
          var s = sampled(art, 64);
          stages = s.data ? Systems.cellStages(s.data, s.cols, s.rows, 10, Math.random() * 1e9 | 0) : [];
        }
        var n = Math.floor(q * 11);
        if (n >= stages.length) { drawArt(v.g, art, v.w, v.h); return; }
        v.g.imageSmoothingEnabled = false;
        v.g.drawImage(stages[n], 0, 0, v.w, v.h);
      }, { art: true });
    }
  };
  Object.keys(MORE_ARRIVALS).forEach(function (k) { ARRIVALS[k] = MORE_ARRIVALS[k]; });

  function bringIn(box, wait) {
    if (still) { return; }
    ARRIVALS[oneOf(Object.keys(ARRIVALS))](box, wait);
  }

  /* Pointing at a photograph. */
  var POINTED = {
    glitch: function (box) { runVeil(box, 0, 420, 10, glitchFrame(false), { art: true, covered: false }); },

    // GlitchPerspective: it tips back into the table and up again, its
    // colours splitting as it goes (land.css).
    tilt: function (box, go) {
      go.dataset.pointed = "tilt";
      window.setTimeout(function () { delete go.dataset.pointed; }, 700);
    },

    // The repetition hover in codrops-sketches: the photograph inside itself,
    // four times over, drawing in and out again.
    echo: function (box) {
      runVeil(box, 0, 700, 14, function (v, q, art) {
        var g = v.g, up = Math.sin(Math.PI * q);
        drawArt(g, art, v.w, v.h);
        for (var n = 1; n <= 4; n += 1) {
          var s = 1 - (1 - Math.pow(0.8, n)) * up;
          if (s >= 0.995) { continue; }
          g.save();
          g.translate(v.w / 2, v.h / 2);
          g.scale(s, s);
          g.translate(-v.w / 2, -v.h / 2);
          g.shadowColor = "rgba(20, 22, 30, 0.3)";
          g.shadowBlur = 10;
          g.fillStyle = MOUNT;
          g.fillRect(0, 0, v.w, v.h);
          g.shadowColor = "transparent";
          drawArt(g, art, v.w, v.h);
          g.strokeStyle = LIGHT;
          g.globalAlpha = 0.8;
          g.lineWidth = 2 / s;
          g.strokeRect(0, 0, v.w, v.h);
          g.globalAlpha = 1;
          g.restore();
        }
      }, { art: true, covered: false });
    },

    mosaic: function (box) {
      var small = document.createElement("canvas");
      var across = [45, 18, 8, 18, 45];
      runVeil(box, 0, 84 * across.length, across.length, function (v, q, art) {
        mosaicFrame(v, art, across[Math.min(across.length - 1, Math.round(q * across.length))], small);
      }, { art: true, covered: false });
    }
  };

  // After GMUNK: pointed at, it stands up into geometry, its colours turning,
  // and lies back down.
  POINTED.synapse = function (box) {
    var s = null, small = null;
    runVeil(box, 0, 1000, 22, function (v, q, art) {
      if (!s) {
        art.boxW = v.w; art.boxH = v.h;
        s = sampled(art, 20);
        small = pixelCanvas(v, 2);
      }
      if (!s.data) { drawArt(v.g, art, v.w, v.h); return; }
      var up = Math.sin(Math.PI * q);
      var sg = small.getContext("2d");
      sg.clearRect(0, 0, small.width, small.height);
      Systems.synapse(sg, s.data, s.cols, s.rows, small.width, small.height, up, up * 2.4);
      v.g.fillStyle = MOUNT;
      v.g.fillRect(0, 0, v.w, v.h);
      v.g.imageSmoothingEnabled = false;
      v.g.drawImage(small, 0, 0, v.w, v.h);
    }, { art: true, covered: false });
  };

  // After Refik Anadol: it melts into the collection's colours and comes back.
  POINTED.melt = function (box) {
    var fluid = null;
    runVeil(box, 0, 1100, 22, function (v, q, art) {
      if (!fluid) {
        var c = document.createElement("canvas");
        c.width = v.w;
        c.height = v.h;
        fluid = new Systems.Hallucination(c, dreamColours(workTones(box)), { cell: 3 });
      }
      fluid.step(1 / 18);
      fluid.draw(v.g, v.w, v.h);
      v.g.globalAlpha = Math.round((1 - Math.sin(Math.PI * q)) * 5) / 5;
      drawArt(v.g, art, v.w, v.h);
      v.g.globalAlpha = 1;
    }, { art: true, covered: false });
  };

  function pointAt(box, go, event) {
    if (still || event.pointerType !== "mouse") { return; }
    if (box.querySelector(".deal-veil") || go.dataset.pointed) { return; }
    var now = performance.now();
    if (box.pointedAt && now - box.pointedAt < 900) { return; }
    box.pointedAt = now;
    POINTED[oneOf(Object.keys(POINTED))](box, go);
  }

  /* ---- words ------------------------------------------------------------ */

  var NOISE = "!<>-_\\/[]{}=+*^?#%&@$~:;░▒▓▚▞";

  function textNodesOf(el) {
    var out = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walk.nextNode()) { out.push(walk.currentNode); }
    return out;
  }

  /* A line of text, scrambled and put right. "decode": every letter is
     noise, and each settles into itself, more or less left to right.
     "type": written on behind a block cursor, the few letters ahead of it
     flickering, as LineTextHoverAnimations does it. The letters change
     twenty-four times a second; the text is put back exactly at the end. */
  function scramble(el, how, wait, dur) {
    if (still || !el) { return; }
    if (el.scrambling) { el.scrambling.stop(); }
    var nodes = textNodesOf(el);
    var texts = nodes.map(function (n) { return n.nodeValue; });
    var total = 0;
    texts.forEach(function (t) { total += t.length; });
    if (!total) { return; }
    dur = dur || Math.min(1100, 360 + total * 16);
    var start = performance.now() + (wait || 0);
    var seed = Math.floor(Math.random() * 1000);
    var raf = 0, last = -1;
    function put(t, tick) {
      var at = 0;
      nodes.forEach(function (node, n) {
        var src = texts[n], out = "";
        for (var i = 0; i < src.length; i += 1, at += 1) {
          var ch = src.charAt(i);
          if (ch === " " || ch === "\n" || ch === " ") { out += ch; continue; }
          var x = at / total;
          var noise = NOISE.charAt(Math.floor(hash2(at + tick * 3, seed) * NOISE.length));
          if (how === "type") {
            var head = t * (1 + 4 / total);
            if (x < head - 1 / total) { out += ch; }
            else if (x < head) { out += "█"; }
            else if (x < head + 3 / total) { out += noise; }
            else { out += " "; }
          } else {
            out += t >= 0.72 * x + 0.28 * hash2(at, seed + 7) ? ch : noise;
          }
        }
        if (node.nodeValue !== out) { node.nodeValue = out; }
      });
    }
    var job = {
      stop: function () {
        cancelAnimationFrame(raf);
        nodes.forEach(function (node, n) { node.nodeValue = texts[n]; });
        if (el.scrambling === job) { el.scrambling = null; }
      }
    };
    el.scrambling = job;
    function step(now) {
      var t = (now - start) / dur;
      if (t >= 1) { job.stop(); return; }
      var tick = Math.floor(now / 42);
      if (tick !== last) { last = tick; put(Math.max(0, t), tick); }
      raf = requestAnimationFrame(step);
    }
    put(0, Math.floor(performance.now() / 42));
    raf = requestAnimationFrame(step);
  }

  /* How a piece of text comes onto the table. "wipe" is the stepped wipe in
     land.css; the rest take it over. */
  var ENTRANCES = ["wipe", "decode", "type", "block", "blur", "rise"];
  var OPEN = "inset(-48px -100% -48px -48px)";

  function enterText(el, wait) {
    if (still || el.tagName === "BUTTON") { return; }
    var how = oneOf(ENTRANCES);
    if (how === "wipe") { return; }
    // Open it now, while it is still fresh and nothing is transitioning, so
    // that the wipe does not also run.
    el.style.clipPath = OPEN;
    void el.offsetWidth;
    if (how === "decode" || how === "type") {
      scramble(el, how, wait);
      return;
    }
    el.style.setProperty("--wait", wait + "ms");
    el.dataset.enter = how;
    if (how === "block") {
      var bar = document.createElement("span");
      bar.className = "deal-block";
      bar.setAttribute("aria-hidden", "true");
      bar.style.background = oneOf([LIGHT, LIGHT, GOLD]);
      el.appendChild(bar);
    }
    window.setTimeout(function () {
      delete el.dataset.enter;
      var b = el.querySelector(".deal-block");
      if (b) { b.parentNode.removeChild(b); }
    }, wait + 1300);
  }

  /* ---- the pointer ------------------------------------------------------ */

  // GooeyCursor, in tiles: the tile under the pointer lights, a neighbour
  // or two with it, and they go out in held steps behind it.
  var trail = [];

  function tread(x, y) {
    if (still) { return; }
    var i = Math.floor(x / CELL_PX), j = Math.floor(y / CELL_PX);
    var last = trail[trail.length - 1];
    if (last && last.i === i && last.j === j) { return; }
    var now = performance.now();
    trail.push({ i: i, j: j, at: now, tone: LIGHT, lvl: 4 });
    if (Math.random() < 0.6) {
      trail.push({ i: i + oneOf([-1, 0, 1]), j: j + oneOf([-1, 1]), at: now + 42, tone: LILAC, lvl: 3 });
    }
    if (trail.length > 90) { trail.splice(0, trail.length - 90); }
  }

  function drawTrail(g, t) {
    for (var m = trail.length - 1; m >= 0; m -= 1) {
      var c = trail[m], a = t - c.at;
      if (a < 0) { continue; }
      if (a > 560) { trail.splice(m, 1); continue; }
      var lv = Math.ceil(c.lvl * (1 - a / 560));
      if (lv < 1) { continue; }
      g.fillStyle = c.tone;
      g.globalAlpha = LEVELS[lv];
      g.fillRect(c.i * CELL_PX + 1, c.j * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    }
    g.globalAlpha = 1;
  }

  // ImageTrailEffects, out in space: while the world is small enough for
  // the telescope to be out, the pointer crossing the sky leaves the
  // telescope's photographs behind it.
  var trailLayer = document.getElementById("trail");
  var lastShot = null, shots = 0;

  function dropHubble(x, y) {
    if (still || !trailLayer || !scopeShown || place || flying || !hubble.tokens.length) { return; }
    var dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < R * R * 1.15) { return; }        // not over the world
    if (lastShot && Math.abs(x - lastShot.x) + Math.abs(y - lastShot.y) < 110) { return; }
    if (shots >= 7) { return; }
    lastShot = { x: x, y: y };
    var tok = oneOf(hubble.tokens);
    var im = document.createElement("img");
    im.className = "trail-shot";
    im.alt = "";
    im.decoding = "async";
    im.draggable = false;
    im.src = tok.u;
    im.style.width = Math.round(between(72, 128)) + "px";
    im.style.left = x.toFixed(0) + "px";
    im.style.top = y.toFixed(0) + "px";
    shots += 1;
    var gone = function () {
      if (im.parentNode) { im.parentNode.removeChild(im); shots -= 1; }
    };
    im.addEventListener("animationend", gone);
    im.addEventListener("error", gone);
    window.setTimeout(gone, 2400);
    trailLayer.appendChild(im);
  }

  /* ---- the sweep --------------------------------------------------------- */

  // PixelTransition across the whole window: a wave of squares that grow
  // and shrink as it passes, from the edges in, from the middle out, from a
  // corner or row by row, over the world and under whatever is dealt.
  var sweepCanvas = document.getElementById("sweep");
  var sweepCtx = sweepCanvas ? sweepCanvas.getContext("2d") : null;
  var sweepNow = null;

  function sweepCells(from, tones, dur) {
    if (still || !sweepCtx) { return; }
    var size = Math.max(48, Math.round(Math.max(W, H) / 14));
    var cols = Math.ceil(W / size), rows = Math.ceil(H / size);
    var ci = Math.random() < 0.5 ? 0 : cols - 1, cj = Math.random() < 0.5 ? 0 : rows - 1;
    var half = Math.max(1, (Math.min(cols, rows) - 1) / 2);
    var up = Math.random() < 0.5;
    var cells = [];
    for (var j = 0; j < rows; j += 1) {
      for (var i = 0; i < cols; i += 1) {
        var e = Math.min(i, cols - 1 - i, j, rows - 1 - j) / half;   // 0 at the edge
        var o, most = 1;
        if (from === "edges") { o = e; most = clamp01(1 - e * 1.5); }
        else if (from === "center") { o = 1 - e; }
        else if (from === "corner") {
          o = Math.sqrt((i - ci) * (i - ci) + (j - cj) * (j - cj)) / Math.sqrt(cols * cols + rows * rows);
        } else {
          o = (j + hash2(i, j) * 5) / (rows + 5);
          if (up) { o = 1 - o; }
        }
        if (most <= 0) { continue; }
        cells.push({ x: i * size, y: j * size, o: clamp01(o), most: most,
                     tone: tones[Math.floor(hash2(i + 9, j + 4) * tones.length)] });
      }
    }
    var first = !sweepNow;
    sweepNow = { cells: cells, size: size, at: performance.now(), dur: dur || 820,
                   anchor: oneOf([[0.5, 0.5], [0.5, 0], [0.5, 1], [0, 0.5], [1, 0.5]]) };
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (sweepCanvas.width !== pw || sweepCanvas.height !== ph) {
      sweepCanvas.width = pw;
      sweepCanvas.height = ph;
    }
    if (first) { requestAnimationFrame(drawSweep); }
  }

  function drawSweep(now) {
    var cu = sweepNow, g = sweepCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    if (!cu) { return; }
    var q = (Math.floor(now / 42) * 42 - cu.at) / cu.dur;
    if (q >= 1) { sweepNow = null; return; }
    g.globalAlpha = 0.88;
    cu.cells.forEach(function (c) {
      var u = (q - c.o * 0.55) / 0.45;
      if (u <= 0 || u >= 1) { return; }
      var s = Math.round(Math.sin(Math.PI * u) * c.most * 4) / 4;
      if (s <= 0) { return; }
      var side = cu.size * s;
      g.fillStyle = c.tone;
      g.fillRect(c.x + (cu.size - side) * cu.anchor[0], c.y + (cu.size - side) * cu.anchor[1], side, side);
    });
    g.globalAlpha = 1;
    requestAnimationFrame(drawSweep);
  }

  /* ---- datamatics ----------------------------------------------------------

     After Ryoji Ikeda: the site's own numbers as the picture, in black and
     white strips that open out of a line and close back into it. It is
     dealt among the sweeps, going down, coming up, opening and closing. */
  var dataCanvas = document.getElementById("datamatics");

  function siteNumbers() {
    var out = [];
    (mine ? mine.works : []).forEach(function (w) {
      out.push(w.slug, String(w.year || ""), w.dimensions || "", (measured[w.slug] || []).join(" "));
    });
    cities.forEach(function (c) {
      out.push(c.lat.toFixed(4) + " " + c.lon.toFixed(4), c.slug || "");
    });
    vocabulary.forEach(function (g) { out.push(g.word + " " + (g.mass || 0).toFixed(3)); });
    out.push(new Date().toISOString(), String(R.toFixed(2)), String(zoom.toFixed(3)));
    return out.filter(Boolean);
  }

  function dataSweep(y) {
    if (still || !dataCanvas || !window.Systems) { return false; }
    Systems.datamatics(dataCanvas, siteNumbers(), { y: y, duration: 1100 });
    if (Systems.sound) { Systems.sound.data(1100); }
    return true;
  }

  /* A transition: one of the sweeps, or the numbers. */
  function passage(from, tones, dur, y) {
    if (Math.random() < 0.34 && dataSweep(y === undefined ? H / 2 : y)) { return; }
    sweepCells(from, tones, dur);
  }

  /* ---- Magnetic Buttons ------------------------------------------------- */

  // The few round buttons lean toward a pointer that comes near them.
  var MAGNETS = "#deck-close, #banner-back, #banner-city, #banner-down, .deal-turn, #hubble, .theatre-step, .art-find";
  var aim = null, magnetsMoving = false;

  function magnetStep() {
    var busy = false;
    Array.prototype.forEach.call(document.querySelectorAll(MAGNETS), function (el) {
      var m = el.pull || (el.pull = { x: 0, y: 0 });
      var tx = 0, ty = 0;
      var r = el.getBoundingClientRect();
      if (aim && r.width) {
        var dx = aim.x - (r.left + r.width / 2 - m.x), dy = aim.y - (r.top + r.height / 2 - m.y);
        var reach = Math.max(r.width, r.height) / 2 + 70;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < reach) {
          var k = (1 - d / reach) * 0.35;
          tx = dx * k;
          ty = dy * k;
        }
      }
      m.x += (tx - m.x) * 0.22;
      m.y += (ty - m.y) * 0.22;
      if (Math.abs(tx - m.x) > 0.15 || Math.abs(ty - m.y) > 0.15) { busy = true; }
      else { m.x = tx; m.y = ty; }
      var v = (m.x || m.y) ? m.x.toFixed(1) + "px " + m.y.toFixed(1) + "px" : "";
      if (el.style.translate !== v) { el.style.translate = v; }
    });
    magnetsMoving = busy;
    if (busy) { requestAnimationFrame(magnetStep); }
  }

  if (!still) {
    document.addEventListener("pointermove", function (event) {
      if (event.pointerType !== "mouse") { return; }
      aim = { x: event.clientX, y: event.clientY };
      if (!magnetsMoving) { magnetsMoving = true; requestAnimationFrame(magnetStep); }
    }, { passive: true });
    document.addEventListener("mouseout", function (event) {
      if (event.relatedTarget) { return; }        // still in the window
      aim = null;
      if (!magnetsMoving) { magnetsMoving = true; requestAnimationFrame(magnetStep); }
    });
  }

  scramble(loading, "decode", 0, 900);

  /* Whatever was on the table and has not been dealt this time goes. */
  function retire(pool) {
    Object.keys(pool.els).forEach(function (key) {
      if (pool.used[key]) { return; }
      var el = pool.els[key];
      if (el.parentNode) { el.parentNode.removeChild(el); }
    });
  }

  function poolOf(host) {
    var pool = { els: {}, used: {} };
    Array.prototype.forEach.call(host.children, function (el) {
      if (el.dataset.key) { pool.els[el.dataset.key] = el; }
    });
    return pool;
  }

  /* A group that is not a collage: a heading, the statement, the address. */
  function loose(host, pool, key, cls, fill, narrow, wide, voices) {
    var el = piece(host, pool, key, function () {
      var p = document.createElement("div");
      p.className = "deal-text " + cls;
      return p;
    });
    fill(el);
    setText(el, narrow, wide, voices);
    var m = measure(el);
    return { parts: [{ x: 0, y: 0, w: m.w, h: m.h, el: el }], w: m.w, h: m.h };
  }

  /* ---- the theatre ---------------------------------------------------------

     The library is where the plays are. Going down into it, one of
     Shakespeare's scenes is put on the ground in front of you, drawn as
     pixel art on a clod of DIRT — scripts/build_theatre.py draws them, and
     docs/v2/theatre/ is what it wrote. The scene comes up out of the soil
     a row at a time, its people say their lines, and it goes back into the
     ground for the next. Which comes next is dealt, the way everything here
     is. Pressing the scene takes the next line; the bill under it goes back
     or on. The library itself stands behind, in the same hand. */

  var theatreEl = document.getElementById("theatre");
  var libraryCanvas = document.getElementById("theatre-library");
  var stageCanvas = document.getElementById("theatre-stage");
  var bill = document.getElementById("theatre-bill");
  var billPlay = document.getElementById("theatre-play");
  var billTitle = document.getElementById("theatre-title");
  var billWhere = document.getElementById("theatre-where");
  var billAfter = document.getElementById("theatre-after");
  var billPrev = document.getElementById("theatre-prev");
  var billNext = document.getElementById("theatre-next");
  var stageCtx = stageCanvas ? stageCanvas.getContext("2d") : null;
  var backstage = document.createElement("canvas");       // the frame, before it is shown
  var backCtx = backstage.getContext("2d");

  var playbill = null;           // theatre.json, once read
  var sheets = {};               // the pictures, by scene
  var staged = null;               // the scene that is on
  var theatreOn = false;
  var dealtScenes = [];          // what is still to come this visit, in the order dealt
  var lastScene = -1;
  var stageBox = { x: 0, y: 0, k: 1 };

  var RISE = 1100, STRIKE = 760, PAUSE = 420, HOLD = 1800;
  var LOOK_MS = 2000;            // how long the Chorus is made of any one thing
  var CARVE = 1500;              // a scene found in marble takes longer to come up

  function readPlaybill(then) {
    if (playbill) { then(); return; }
    if (!window.fetch) { return; }
    fetch("theatre/theatre.json")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.scenes && d.scenes.length) { playbill = d; then(); } })
      .catch(function () {});
  }

  function sheetFor(entry, then) {
    var im = sheets[entry.key];
    if (!im) {
      im = new Image();
      im.decoding = "async";
      im.src = "theatre/" + entry.sheet;
      sheets[entry.key] = im;
    }
    if (!then) { return; }
    if (im.complete && im.naturalWidth) { then(im); return; }
    im.addEventListener("load", function () { then(im); }, { once: true });
  }

  /* The next scene: dealt from the whole repertory, each once, before any
     comes round again — and never the one that has just been played. */
  function dealScene() {
    if (!dealtScenes.length) {
      dealtScenes = playbill.scenes.map(function (s, i) { return i; });
      for (var i = dealtScenes.length - 1; i > 0; i -= 1) {
        var j = Math.floor(Math.random() * (i + 1));
        var k = dealtScenes[i]; dealtScenes[i] = dealtScenes[j]; dealtScenes[j] = k;
      }
      if (dealtScenes[0] === lastScene && dealtScenes.length > 1) {
        dealtScenes.push(dealtScenes.shift());
      }
    }
    return dealtScenes.shift();
  }

  /* As many whole device pixels to each of the picture's as will fit. On a
     screen of one device pixel to the pixel, where the choice is between
     one and two, a half step is allowed: a little unevenness is better than
     a scene the size of a stamp. */
  function artScale(w, h, maxW, maxH) {
    var dpr = window.devicePixelRatio || 1;
    var fit = Math.min(maxW * dpr / w, maxH * dpr / h);
    var k = Math.floor(fit);
    if (dpr < 1.5 && k < 2 && fit >= 1.5) { return 1.5; }
    return Math.max(1, k) / dpr;
  }

  function layoutTheatre() {
    if (!staged || !playbill) { return; }
    var entry = staged.entry;
    var top = 64;
    var br = banner.getBoundingClientRect();
    if (br.height) { top = Math.max(top, br.bottom + 10); }
    var billH = bill.offsetHeight || 64;
    var roomH = H - top - billH - 22;

    // The library, as a landmark in the far corner, where a screen is wide
    // enough to have one; the stage has the rest.
    var lib = playbill.library;
    var libW = 0;
    if (lib && libraryCanvas.width && W >= 900) {
      var lk = artScale(lib.w, lib.h, Math.min(W * 0.22, 330), Math.min(H * 0.36, 280));
      libW = lib.w * lk;
      libraryCanvas.style.width = libW.toFixed(2) + "px";
      libraryCanvas.style.height = (lib.h * lk).toFixed(2) + "px";
      // Set by where it rests: the room above it is for standing up in.
      var rest = Math.max(0, (lib.top || 0) - 6) * lk;
      libraryCanvas.style.transform = "translate(" + Math.round(W - libW - 18 + libraryWalk.dx) + "px," +
                                      Math.round(top - 6 - rest) + "px)";
      libraryCanvas.hidden = false;
    } else {
      libraryCanvas.hidden = true;
    }
    var k = artScale(entry.w, entry.h, Math.min(W * 0.92, W - 2 * libW), roomH);
    var sw = entry.w * k, sh = entry.h * k;
    var sy = top + Math.max(0, (roomH - sh) * 0.5);
    stageBox = { x: Math.round(W / 2 - sw / 2), y: Math.round(sy), k: k, w: sw, h: sh };
    stageCanvas.style.width = sw.toFixed(2) + "px";
    stageCanvas.style.height = sh.toFixed(2) + "px";
    stageCanvas.style.transform = "translate(" + stageBox.x + "px," + stageBox.y + "px)";
    var billY = Math.round(Math.min(H - billH - 12, stageBox.y + sh + 8));
    bill.style.transform = "translate(-50%," + billY + "px)";
    // The library's own guide (bloomberg.js): under the library where it stands in the corner,
    // else under the bill where there is room, else over the stage.
    if (theatreGuide && theatreGuide.parentNode === theatreEl) {
      var gs = theatreGuide.style;
      if (libW) {
        gs.left = "auto";
        gs.right = "18px";
        gs.maxWidth = Math.round(Math.max(240, libW)) + "px";
        gs.transform = "translate(0," + Math.round(top - 6 - rest + lib.h * lk + 10) + "px)";
      } else {
        gs.left = gs.right = gs.maxWidth = "";
        var gh = theatreGuide.offsetHeight || 44, gy = billY + billH + 10;
        if (gy + gh > H - 8) { gy = Math.max(top, stageBox.y - gh - 10); }
        gs.transform = "translate(-50%," + Math.round(gy) + "px)";
      }
    }
  }

  /* Bloomberg Connects (bloomberg.js): the Folger's own guide, a link off the site, put in the
     theatre once its address is known (none known, nothing). */
  var theatreGuide = null;
  function theatreGuideOn() {
    if (!window.Bloomberg || theatreGuide) { return; }
    Bloomberg.when(function () {
      if (theatreGuide || !theatreEl) { return; }
      theatreGuide = Bloomberg.link("folger");
      if (!theatreGuide) { return; }
      theatreEl.appendChild(theatreGuide);
      if (theatreOn) { layoutTheatre(); }
    });
  }

  function drawLibrary() {
    var lib = playbill && playbill.library;
    if (!lib) { return; }
    sheetFor(lib, function (im) {
      libraryCanvas.width = lib.w;
      libraryCanvas.height = lib.h;
      libraryWalk.im = im;
      libraryWalk.shown = undefined;
      showLibrary(null);
      libraryCanvas.classList.toggle("is-live", !!lib.moves && !still);
      layoutTheatre();
    });
  }

  /* After Universal Everything's Walking City (and Archigram's before it):
     now and then the library stands up on the six legs folded under it and
     walks a little way, and settles again. Pressing it gets it up. */
  var libraryWalk = { state: "sit", since: 0, next: 0, dx: 0, im: null, shown: undefined };

  function showLibrary(patch) {
    var lib = playbill && playbill.library, im = libraryWalk.im;
    if (!lib || !im || libraryWalk.shown === patch) { return; }
    libraryWalk.shown = patch;
    var g = libraryCanvas.getContext("2d");
    g.clearRect(0, 0, lib.w, lib.h);
    g.drawImage(im, 0, 0, lib.w, lib.h, 0, 0, lib.w, lib.h);
    if (patch) {
      // A patch is the whole of its rectangle: where it is empty, the frame is.
      g.clearRect(patch[4], patch[5], patch[2], patch[3]);
      g.drawImage(im, patch[0], patch[1], patch[2], patch[3], patch[4], patch[5], patch[2], patch[3]);
    }
  }

  function standLibrary(now) {
    if (libraryWalk.state !== "sit") { return; }
    libraryWalk.state = "rise";
    libraryWalk.since = now;
    var r = libraryCanvas.getBoundingClientRect();
    pulse(r.left + r.width / 2, r.top + r.height * 0.6, [LIGHT, GOLD], 0.5, 120);
  }

  function stepLibrary(now) {
    var lib = playbill && playbill.library;
    if (!lib || !lib.moves || still || libraryCanvas.hidden || !libraryWalk.im) { return; }
    var m = lib.moves, beat = 1000 / 6, w = libraryWalk;
    if (!w.next) { w.next = now + 9000 + Math.random() * 16000; }
    if (w.state === "sit" && now > w.next) { standLibrary(now); }
    var n = Math.floor((now - w.since) / beat);
    var patch = null;
    if (w.state === "rise") {
      if (n < m.stand.length) { patch = m.stand[n]; }
      else { w.state = "walk"; w.since = now; w.steps = 16 + Math.floor(Math.random() * 16); patch = m.walk[0]; }
    } else if (w.state === "walk") {
      patch = m.walk[n % m.walk.length];
      // A few paces one way and back to where it lives.
      w.dx = Math.round(-Math.sin(Math.PI * Math.min(1, n / w.steps)) * 36);
      if (n >= w.steps) { w.state = "sink"; w.since = now; w.dx = 0; }
      layoutTheatre();
    } else if (w.state === "sink") {
      if (n < m.stand.length) { patch = m.stand[m.stand.length - 1 - n]; }
      else { w.state = "sit"; w.next = now + 25000 + Math.random() * 30000; }
    }
    showLibrary(patch);
  }

  if (libraryCanvas) {
    libraryCanvas.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    libraryCanvas.addEventListener("click", function (event) {
      event.stopPropagation();
      if (!still) { standLibrary(performance.now()); }
    });
  }

  function stageScene(index) {
    if (!playbill) { return; }
    var entry = playbill.scenes[index];
    lastScene = index;
    billPlay.textContent = entry.play;
    billTitle.textContent = entry.title;
    billWhere.textContent = entry.where;
    billAfter.textContent = entry.after ? "after " + entry.after : "";
    billAfter.hidden = !entry.after;
    stageCanvas.setAttribute("aria-label", entry.title + ", from " + entry.play + ". " + entry.where +
                             ". Press for the next line.");
    say.hidden = true;
    staged = { entry: entry, index: index, phase: "wait", line: -1, since: 0, until: 0, speaking: null,
               look: 0, lookAt: 0,
               // Up out of the soil a row at a time, or, after Quayola, found in a block of
               // marble — cut into facets, finer and finer, until it is itself.
               rise: Math.random() < 0.4 ? "carve" : "rows" };
    sheetFor(entry, function (im) {
      if (!staged || staged.entry !== entry) { return; }
      staged.sheet = im;
      stageCanvas.width = backstage.width = entry.w;
      stageCanvas.height = backstage.height = entry.h;
      staged.phase = still ? "play" : "rise";
      staged.since = performance.now();
      staged.until = staged.since + (still ? 0 : staged.rise === "carve" ? CARVE : RISE);
      staged.lookAt = staged.since;
      layoutTheatre();
      scramble(billTitle, "decode", 0, 700);
      if (!still) {
        pulse(stageBox.x + stageBox.w / 2, stageBox.y + stageBox.h * 0.72,
              [LIGHT, place ? cityTone(place) : LILAC], 0.85, Math.max(W, H) * INV);
      }
      // The next one is fetched while this one plays.
      if (dealtScenes.length) { sheetFor(playbill.scenes[dealtScenes[0]]); }
    });
  }

  function speakLine(now) {
    var lines = staged.entry.lines;
    staged.line += 1;
    if (staged.line >= lines.length) {
      staged.phase = "hold";
      staged.speaking = null;
      staged.until = now + HOLD;
      say.hidden = true;
      return;
    }
    var line = lines[staged.line];
    staged.speaking = line[0];
    sayWho.textContent = staged.entry.cast[line[0]] || "";
    sayLine.textContent = line[1];
    say.hidden = false;
    staged.phase = "speak";
    staged.until = now + dwell(line[1]);
    placeTheatreSay();
  }

  function placeTheatreSay() {
    if (!staged || staged.speaking === null || say.hidden) { return; }
    var head = staged.entry.heads[staged.speaking] || [staged.entry.w / 2, staged.entry.h * 0.3];
    var hx = stageBox.x + head[0] * stageBox.k;
    var hy = stageBox.y + head[1] * stageBox.k;
    var w = say.offsetWidth || 200;
    var h = say.offsetHeight || 48;
    var x = Math.max(8, Math.min(hx - w / 2, W - w - 8));
    var y = Math.max(8, hy - h - 8);
    say.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  function advance(now) {
    if (staged && staged.phase === "entracte") { endEntracte(); return; }
    if (!staged || !staged.sheet) { return; }
    if (staged.phase === "rise") { staged.phase = "play"; staged.until = now; return; }
    if (staged.phase === "speak" || staged.phase === "play" || staged.phase === "pause") { staged.until = now; return; }
    if (staged.phase === "hold") { strikeFor(dealScene(), now); }
  }

  function strikeFor(next, now) {
    if (!staged || still) { say.hidden = true; stageScene(next); return; }
    staged.phase = "strike";
    staged.since = now;
    staged.next = next;
    staged.speaking = null;
    say.hidden = true;
  }

  function composeFrame(t) {
    var e = staged.entry, im = staged.sheet;
    backCtx.clearRect(0, 0, e.w, e.h);
    backCtx.drawImage(im, 0, 0, e.w, e.h, 0, 0, e.w, e.h);
    var p = e.looks ? e.looks[staged.look][t] : e.idle[t];
    // Each patch is the whole of its rectangle — where it is empty, the frame
    // is — so the rectangle is cleared before it goes down.
    if (p) {
      backCtx.clearRect(p[4], p[5], p[2], p[3]);
      backCtx.drawImage(im, p[0], p[1], p[2], p[3], p[4], p[5], p[2], p[3]);
    }
    if (staged.speaking !== null && e.speak[staged.speaking]) {
      var s = e.speak[staged.speaking][t];
      if (s) {
        backCtx.clearRect(s[4], s[5], s[2], s[3]);
        backCtx.drawImage(im, s[0], s[1], s[2], s[3], s[4], s[5], s[2], s[3]);
      }
    }
  }

  /* Coming up out of the ground a row at a time, the row just arriving lit;
     going back down into it as held squares of nothing. */
  function showFrame(now) {
    var e = staged.entry, g = stageCtx;
    g.clearRect(0, 0, e.w, e.h);
    if (staged.phase === "rise" && staged.rise === "carve") {
      // A frame's clock can read a moment before the scene was put up.
      carveFrame(g, e, Math.max(0, Math.min(1, (now - staged.since) / CARVE)));
      return;
    }
    if (staged.phase === "rise") {
      var q = Math.min(1, (now - staged.since) / RISE);
      q = Math.floor(q * 18) / 18;
      var cut = Math.round(e.h * (1 - q));
      if (cut < e.h) { g.drawImage(backstage, 0, cut, e.w, e.h - cut, 0, cut, e.w, e.h - cut); }
      g.save();
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = LIGHT;
      g.globalAlpha = 0.7;
      g.fillRect(0, cut, e.w, 3);
      g.restore();
      return;
    }
    g.drawImage(backstage, 0, 0);
    if (staged.phase === "strike") {
      var s = Math.min(1, (now - staged.since) / STRIKE);
      s = Math.floor(s * 14) / 14;
      var cell = 6;
      g.save();
      for (var y = 0; y < e.h; y += cell) {
        for (var x = 0; x < e.w; x += cell) {
          // Top first, and ragged: the scene settles back into the soil.
          var o = 0.62 * (y / e.h) + 0.38 * hash2(x / cell, y / cell);
          var gone = 1 - o;
          if (gone < s) { g.clearRect(x, y, cell, cell); }
          else if (gone < s + 0.06) {
            g.globalCompositeOperation = "source-atop";
            g.fillStyle = LIGHT;
            g.globalAlpha = 0.6;
            g.fillRect(x, y, cell, cell);
            g.globalCompositeOperation = "source-over";
            g.globalAlpha = 1;
          }
        }
      }
      g.restore();
    }
  }

  var LOOK_TONES = ["#ff9a2a", "#3a93ac", "#dcf2ff", "#9c9ca8", "#ee6a8a", "#a06636", "#dcd9e2", "#9c6c3f"];

  /* After Quayola: the scene comes up as if cut out of a block of marble —
     first the block, then facets, finer every step and taking on the
     scene's own colours as they go, until the last cut is the picture. */
  function carveFrame(g, e, q) {
    if (!staged.carved) {
      var cols = Math.max(8, Math.round(e.w / 3)), rows = Math.max(8, Math.round(e.h / 3));
      var small = document.createElement("canvas");
      small.width = cols;
      small.height = rows;
      var sg = small.getContext("2d");
      sg.imageSmoothingEnabled = false;
      sg.drawImage(backstage, 0, 0, e.w, e.h, 0, 0, cols, rows);
      var data = sg.getImageData(0, 0, cols, rows).data;
      staged.carved = { stages: Systems.strataStages(data, cols, rows, 8, (Math.random() * 1e9) | 0),
                        kx: e.w / cols, ky: e.h / rows };
    }
    var c = staged.carved, n = Math.floor(q * (c.stages.length + 1));
    if (n >= c.stages.length) { g.drawImage(backstage, 0, 0); return; }
    var marble = [218, 214, 222], k = 1 - n / (c.stages.length - 1);
    c.stages[n].forEach(function (t) {
      var rgba = t[4];
      if (!rgba || rgba[3] < 128) { return; }
      var m = k * 0.85, lit = 0.92 + 0.08 * ((t[0][0] + t[1][1]) % 2);
      g.fillStyle = "rgb(" + Math.round((rgba[0] + (marble[0] - rgba[0]) * m) * lit) + "," +
                    Math.round((rgba[1] + (marble[1] - rgba[1]) * m) * lit) + "," +
                    Math.round((rgba[2] + (marble[2] - rgba[2]) * m) * lit) + ")";
      g.beginPath();
      g.moveTo(Math.round(t[0][0] * c.kx), Math.round(t[0][1] * c.ky));
      g.lineTo(Math.round(t[1][0] * c.kx), Math.round(t[1][1] * c.ky));
      g.lineTo(Math.round(t[2][0] * c.kx), Math.round(t[2][1] * c.ky));
      g.closePath();
      g.fill();
    });
  }

  /* An entr'acte between two scenes, now and then: after Oskar Fischinger's
     Motion Painting No. 1, painting given time, on the stage itself. */
  var painting = null, scenesSince = 0;

  function entracteDue() {
    scenesSince += 1;
    if (still || !window.Systems || !Systems.motionPainting || scenesSince < 3) { return false; }
    return Math.random() < 0.3;
  }

  function entracte(next) {
    scenesSince = 0;
    staged.phase = "entracte";
    staged.next = next;
    say.hidden = true;
    billPlay.textContent = "Entr'acte";
    billTitle.textContent = "Motion Painting";
    billWhere.textContent = "painted on glass, a stroke at a time";
    billAfter.textContent = "after Oskar Fischinger, Motion Painting No. 1";
    billAfter.hidden = false;
    scramble(billTitle, "decode", 0, 700);
    var tones = place ? [cityTone(place)] : [];
    painting = Systems.motionPainting(stageCanvas, tones, {
      duration: 8000,
      onBeat: function (n) { if (Systems.sound) { Systems.sound.beat(n); } },
      onDone: function () { endEntracte(); }
    });
  }

  function endEntracte() {
    if (!staged || staged.phase !== "entracte") { return; }
    if (painting) { painting.stop(); painting = null; }
    stageScene(staged.next);
  }

  function theatreFrame(now) {
    if (!theatreOn) { return; }
    requestAnimationFrame(theatreFrame);
    if (!staged || !staged.sheet) { return; }
    var fps = (playbill && playbill.fps) || 6;
    var frames = (playbill && playbill.frames) || 4;
    var t = still ? 0 : Math.floor(now / (1000 / fps)) % frames;

    stepLibrary(now);
    if (staged.phase === "entracte") { return; }
    if (staged.phase === "rise" && now >= staged.until) { staged.phase = "play"; staged.until = now + 300; }
    // The Chorus: what it is made of changes every little while, and each
    // change is answered in pixel light.
    if (staged.entry.looks && !still && staged.phase !== "rise" && staged.phase !== "strike" &&
        now - staged.lookAt >= LOOK_MS) {
      staged.lookAt = now;
      staged.look = (staged.look + 1) % staged.entry.looks.length;
      var hd = staged.entry.heads[0];
      if (hd) {
        pulse(stageBox.x + hd[0] * stageBox.k, stageBox.y + (hd[1] + 30) * stageBox.k,
              [LOOK_TONES[staged.look % LOOK_TONES.length], LIGHT], 0.4, 90);
      }
    }
    if (staged.phase === "play" && now >= staged.until) { speakLine(now); }
    else if (staged.phase === "speak" && now >= staged.until) {
      staged.phase = "pause";
      staged.speaking = null;
      say.hidden = true;
      staged.until = now + PAUSE;
    } else if (staged.phase === "pause" && now >= staged.until) { speakLine(now); }
    else if (staged.phase === "hold" && now >= staged.until) { strikeFor(dealScene(), now); }
    else if (staged.phase === "strike" && now - staged.since >= STRIKE) {
      if (entracteDue()) { entracte(staged.next); } else { stageScene(staged.next); }
      return;
    }

    // Held frames: nothing is redrawn between them.
    var key = t + "|" + staged.speaking + "|" + staged.phase + "|" + staged.look + "|" +
              (staged.phase === "rise" || staged.phase === "strike" ? Math.floor(now / 42) : "");
    if (key === staged.drawn) { return; }
    staged.drawn = key;
    composeFrame(t);
    showFrame(now);
    placeTheatreSay();
  }

  function startTheatre() {
    if (!theatreEl || theatreOn) { return; }
    theatreOn = true;
    readPlaybill(function () {
      if (!theatreOn) { return; }
      theatreEl.hidden = false;
      theatreGuideOn();
      drawLibrary();
      stageScene(dealScene());
      requestAnimationFrame(theatreFrame);
    });
  }

  function stopTheatre() {
    if (!theatreOn) { return; }
    theatreOn = false;
    theatreEl.hidden = true;
    say.hidden = true;
    if (painting) { painting.stop(); painting = null; }
    staged = null;
    libraryWalk.state = "sit";
    libraryWalk.dx = 0;
    libraryWalk.next = 0;
  }

  if (stageCanvas) {
    stageCanvas.addEventListener("click", function (event) {
      event.stopPropagation();
      advance(performance.now());
    });
    stageCanvas.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") { return; }
      event.preventDefault();
      advance(performance.now());
    });
    stageCanvas.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    bill.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    billNext.addEventListener("click", function (event) {
      event.stopPropagation();
      if (!playbill || !staged) { return; }
      dealtScenes = dealtScenes.filter(function (i) { return i !== (staged.index + 1) % playbill.scenes.length; });
      strikeFor((staged.index + 1) % playbill.scenes.length, performance.now());
    });
    billPrev.addEventListener("click", function (event) {
      event.stopPropagation();
      if (!playbill || !staged) { return; }
      var n = playbill.scenes.length;
      strikeFor((staged.index - 1 + n) % n, performance.now());
    });
    window.addEventListener("resize", function () { if (theatreOn) { layoutTheatre(); placeTheatreSay(); } });
  }

  /* After Refik Anadol, Unsupervised: sometimes, behind a word's collages,
     the world is not blurred but dreamt — the colours measured off those
     collages and a handful of the collection's, carried round in a fluid
     that never settles. Dealt, like everything: half the time it is the
     world, out of focus, as before. */
  var dreamCanvas = document.getElementById("dream");
  var dreaming = null;

  function dream(ground) {
    if (dreaming) { dreaming.stop(); dreaming = null; }
    if (!dreamCanvas) { return; }
    if (!ground || still || !window.Systems) {
      dreamCanvas.hidden = true;
      delete deck.dataset.dream;
      return;
    }
    var first = [];
    (ground.works || []).forEach(function (w) {
      if (w && w.slug) { first = first.concat(measured[w.slug] || []); }
    });
    dreamCanvas.hidden = false;
    var k = Math.min(window.devicePixelRatio || 1, 2);
    dreamCanvas.width = Math.round(W * k / 2);
    dreamCanvas.height = Math.round(H * k / 2);
    deck.dataset.dream = "true";
    dreaming = new Systems.Hallucination(dreamCanvas, dreamColours(first.slice(0, 5)), { cell: 5 });
    dreaming.start();
  }

  /* ---- the buildings ------------------------------------------------------

     Going down to a building ends at a clod of its ground, in DIRT, turning
     slowly the way the camera used to circle it — after Google Earth's view
     from the air, drawn in the site's own soil instead of fetched from a paid
     map. The ground is read once at build time from free data
     (scripts/build_grounds.py: Overture Maps and OpenStreetMap for the
     buildings, roads and water, the open terrain tiles for the hills) and
     comes as grounds/<slug>.json: a grid, each cell land, water, road or
     building, with the height of the ground and of what stands on it.

     Every cell is one dot of the soil, the way the globe is woven: land
     wears DIRT from the very spot on the globe the place is at, water the
     sea's DIRT, roads the soil gone to dust, and a building stands up out of
     it in stone-pale dots, a storey at a time. The edges go down into the
     soil, so it is a clod lifted out of the Earth. It rises out of the
     ground a row at a time, turns once every minute and a half, and a drag
     turns it by hand. A public building is its own grounds; a private home
     is never pinned, so its clod is its town. */

  var buildingEl = document.getElementById("building");
  var buildingMap = document.getElementById("building-map");
  var buildingLink = document.getElementById("building-link");
  var buildingWorks = document.getElementById("building-works");
  var buildingOn = null;             // the visit the view belongs to
  var grounds = {};                  // slug -> the ground, once read
  var clod = null;                   // what is being drawn, while it is up

  var CLOD_PIX = 2;                  // screen pixels to one of the clod's
  var CLOD_FPS = 12;                 // held frames, like the rest of the pixel light
  var CLOD_DEEP = 7;                 // layers of soil under the edge
  var DUST = [232, 220, 203];        // what a road is, the soil gone pale
  var PALE = [239, 233, 226];        // what a building is, the soil gone to stone

  function readGround(slug) {
    if (!grounds[slug]) {
      grounds[slug] = read("grounds/" + slug + ".json").catch(function () { return null; });
    }
    return grounds[slug];
  }

  /* The soil at a cell: the DIRT that lies on the globe where the place is,
     and on out from there, so every place stands on its own patch of it. */
  function soilCell(tile, b, i, j) {
    if (!tile) { return null; }
    var u0 = Math.floor((b.lon / 360 + 0.5) * DIRT_ROUND * tile.n);
    var v0 = Math.floor((0.5 - b.lat / 180) * DIRT_DOWN * tile.n);
    var o = (cellOf(tile.n, v0 + i) * tile.n + cellOf(tile.n, u0 + j)) * 4;
    return [tile.px[o], tile.px[o + 1], tile.px[o + 2], Math.round(tile.px[o + 3] / 85)];
  }

  function mixTo(c, to, k) {
    return [c[0] + (to[0] - c[0]) * k, c[1] + (to[1] - c[1]) * k, c[2] + (to[2] - c[2]) * k];
  }

  function inkOf(c, light) {
    return "rgb(" + Math.round(Math.min(255, c[0] * light)) + "," +
           Math.round(Math.min(255, c[1] * light)) + "," +
           Math.round(Math.min(255, c[2] * light)) + ")";
  }

  /* The building looked at, in its plot (artist, 7 Oct 2026: "when I am
     looking at a museum building or architecture building in the area view
     of that city or town, I want the building I'm looking at to stand out
     against the rest of the plot"). The ground names none of its buildings,
     so the building's own cells are read from what is known of it: where its
     model stands (each model is drawn in metres round the place's point,
     north up, most of them off this same ground), else the block of building
     cells at the point. Only where the point is the building's own door — a
     private home is placed at its town, and no cells of its own are made up
     for it (standNote says so instead). */
  var STAND_COVER = 0.4;             // a cell is the building's when its model covers this much of it
  var STAND_MAKE_ROOM = 0.25;        // the plot's building cells it covers this much of make room for it
  var STAND_REACH = 63;              // metres from the point a building found without a model may reach
  function standing(b, g, model) {
    if (!b || b.precision !== "exact" || !g || !g.n || !window.Models || !Models.inset) { return null; }
    var n = g.n, cell = g.side / n, half = g.side / 2, N = n * n, q, i, j;
    var own = new Uint8Array(N), room = new Uint8Array(N), touch = new Float32Array(N);
    var ins = model && model.parts ? Models.inset(model, function (vi, vj) { return soilCell(dirt.land, b, vj, vi); }) : null;
    var count = 0;
    if (ins) {
      // How much of each cell of the plot the model's built columns cover.
      var cols = new Float32Array(N), best = -1;
      for (j = 0; j < ins.ny; j += 1) {
        var gi = Math.floor(((j + 0.5) * ins.v - ins.site[1] / 2 + half) / cell);
        if (gi < 0 || gi >= n) { continue; }
        for (i = 0; i < ins.nx; i += 1) {
          var gj = Math.floor(((i + 0.5) * ins.v - ins.site[0] / 2 + half) / cell);
          if (gj < 0 || gj >= n) { continue; }
          cols[gi * n + gj] += 1;
          if (ins.foot[j * ins.nx + i]) { touch[gi * n + gj] += 1; }
        }
      }
      for (q = 0; q < N; q += 1) {
        if (cols[q]) { touch[q] /= cols[q]; }
        if (touch[q] >= STAND_COVER) { own[q] = 1; count += 1; }
        if (touch[q] >= STAND_MAKE_ROOM) { room[q] = 1; }
        if (touch[q] > 0 && (best < 0 || touch[q] > touch[best])) { best = q; }
      }
      // A building smaller than a cell still has one.
      if (!count && best >= 0) { own[best] = room[best] = 1; count = 1; }
      // Its courtyards: whatever it encloses is its own ground, not a neighbour's.
      var out = new Uint8Array(N), stack = [];
      for (q = 0; q < N; q += 1) {
        i = Math.floor(q / n); j = q % n;
        if ((i === 0 || j === 0 || i === n - 1 || j === n - 1) && !own[q]) { out[q] = 1; stack.push(q); }
      }
      while (stack.length) {
        q = stack.pop();
        [q - n, q + n, (q % n) ? q - 1 : -1, (q % n) < n - 1 ? q + 1 : -1].forEach(function (p) {
          if (p >= 0 && p < N && !out[p] && !own[p]) { out[p] = 1; stack.push(p); }
        });
      }
      for (q = 0; q < N; q += 1) { if (!out[q]) { room[q] = 1; } }
    } else {
      // No model: the building cells at the point, and those joined to them,
      // never further than a building could reach from its own door.
      var seeds = [], near = -1, nearD = Infinity, reach = STAND_REACH / cell;
      for (q = 0; q < N; q += 1) {
        if (g.kind[q] !== "b") { continue; }
        var dd = Math.hypot(Math.floor(q / n) + 0.5 - n / 2, q % n + 0.5 - n / 2);
        if (dd <= 1.5) { seeds.push(q); }
        if (dd < nearD) { nearD = dd; near = q; }
      }
      if (!seeds.length && near >= 0 && nearD <= 3) { seeds.push(near); }
      while (seeds.length) {
        q = seeds.pop();
        if (own[q]) { continue; }
        own[q] = 1; count += 1;
        [q - n, q + n, (q % n) ? q - 1 : -1, (q % n) < n - 1 ? q + 1 : -1].forEach(function (p) {
          if (p >= 0 && p < N && !own[p] && g.kind[p] === "b" &&
              Math.hypot(Math.floor(p / n) + 0.5 - n / 2, p % n + 0.5 - n / 2) <= reach) { seeds.push(p); }
        });
      }
    }
    return count ? { own: own, room: ins ? room : null, inset: ins } : null;
  }

  /* Where a building has no cells of its own in its plot, the view says so,
     in the words "the place, then" uses for a life's town. */
  function standNote(b, model) {
    if (!b || b.precision === "exact") { return ""; }
    var name = (model && model.name) || b.name || b.title || "";
    var town = b.city || String(b.where || "").split(",")[0];
    var across = { street: "700 m", district: "3.6 km", town: "2.4 km", region: "9 km" }[b.precision] || "2.4 km";
    if (b.precision === "street") { return "Where on its street " + name + " stands is not placed: the square is " + across + " across."; }
    return "Where in " + town + " " + name + " stands is not placed: the square is " + town + "’s middle, " + across + " across.";
  }

  /* The ground, as dots: where each is, how big, what colour, which row.
     With stand (standing(), above), the building looked at stands out: in
     its own model where it has one, the plot's cells under it making room,
     else its own cells in a brighter stone; every other building let down a
     step, quieter and cooler, the DIRT dots still. */
  var STAND_COOL = [148, 156, 170];  // what the other buildings are let down toward
  function storeyInk(soil, top, f, how) {
    if (how === "own") { return inkOf(mixTo(soil, PALE, 0.86), top ? 1.12 : 0.92 + 0.12 * f); }
    if (how === "down") { return inkOf(mixTo(mixTo(soil, PALE, 0.3), STAND_COOL, 0.26), top ? 0.8 : 0.62 + 0.08 * f); }
    return inkOf(mixTo(soil, PALE, 0.72), top ? 1.06 : 0.84 + 0.1 * f);
  }
  function shapeClod(b, g, stand) {
    var n = g.n, cell = g.side / n;
    var land = [], hi = 0, k;
    for (k = 0; k < n * n; k += 1) {
      if (g.kind[k] !== "~") { hi = Math.max(hi, g.ground[k]); }
    }
    // Hills are raised until the highest is about a sixth of the clod across,
    // and never more than four times their real height.
    var relief = hi / 2;
    var lift = Math.min(4, (n / 6) * cell / Math.max(relief, 1)) / cell;
    var dots = { x: [], y: [], z: [], size: [], ink: [], reveal: [] };
    var highest = 0;
    // When each building was put up, where it is known (g.built: a year for
    // each building cell, row by row, 0 where not known): the clod is then a
    // time as well as a place, and its reveal is the year, not the row — the
    // ground is there from the start and the town rises on it year by year,
    // storey by storey (the timeline, below).
    var years = null, bi = 0;
    if (g.built && g.built.length) {
      var y0 = Infinity, y1 = new Date().getFullYear();
      g.built.forEach(function (yr) { if (yr > 0 && yr < y0) { y0 = yr; } });
      if (y0 < y1) { years = { y0: y0 - 1, y1: y1 }; }
    }
    function yearAt(yr) { return (yr - years.y0) / (years.y1 - years.y0); }

    function put(x, y, z, size, ink, row) {
      dots.x.push(x); dots.y.push(y); dots.z.push(z);
      dots.size.push(size); dots.ink.push(ink); dots.reveal.push(years ? 0 : row / n);
      if (z > highest) { highest = z; }
    }
    function zAt(i, j) {
      var q = i * n + j;
      return g.kind[q] === "~" ? 0 : g.ground[q] / 2 * lift;
    }
    var cellYear = new Int16Array(n * n), ownDots = [];

    for (var i = 0; i < n; i += 1) {
      for (var j = 0; j < n; j += 1) {
        var q = i * n + j, what = g.kind[q];
        var x = j - n / 2 + 0.5, y = i - n / 2 + 0.5, z = zAt(i, j);
        var soil = soilCell(what === "~" ? dirt.sea : dirt.land, b, i, j) ||
                   (what === "~" ? [96, 118, 150, 2] : [138, 118, 96, 2]);
        // Lit from the upper left: a cell higher than the one up and to its
        // left catches the light, lower is in shade, in four steps.
        var up = i && j ? zAt(i - 1, j - 1) : z;
        var light = 0.82 + 0.12 * Math.max(-1, Math.min(2, Math.round((z - up) * 3)));
        var size = soil[3];
        if (what === "=") {
          put(x, y, z, 1, inkOf(mixTo(soil, DUST, 0.6), 1), i);
        } else if (what === "b") {
          put(x, y, z, Math.max(1, size), inkOf(soil, light * 0.8), i);
          var storeys = g.tall.charCodeAt(q) - 48;
          // Raised a little, so a house still stands up out of a town; a
          // tower is kept to about a fifth of the clod.
          var up_ = Math.min(n / 5, Math.max(1, storeys * 3.2 / cell * 1.2));   // in cells
          // Under the building's own model the plot keeps only its ground.
          var layers = stand && stand.room && stand.room[q] ? 0 : Math.max(1, Math.round(up_ * 2));
          var built = years ? g.built[bi] || 0 : 0;
          cellYear[q] = built;
          bi += 1;
          var how = stand ? (stand.own[q] ? "own" : "down") : null;
          for (var l = 1; l <= layers; l += 1) {
            var top = l === layers;
            put(x, y, z + l * 0.5, 2, storeyInk(soil, top, l / layers, how), i);
            // Its storeys go up one after another within its year.
            if (built) { dots.reveal[dots.reveal.length - 1] = yearAt(built - 1) + (l / layers) * 0.97 / (years.y1 - years.y0); }
            if (how === "own") { ownDots.push(dots.x.length - 1); }
          }
        } else if (size) {
          put(x, y, z, size, inkOf(soil, what === "~" ? 1 : light), i);
        }
        // The edges go down into the earth: a clod, cut out and lifted.
        if (i === 0 || j === 0 || i === n - 1 || j === n - 1) {
          var under = soilCell(dirt.land, b, i + n, j) || [120, 100, 80, 2];
          for (var d = 1; d <= CLOD_DEEP; d += 1) {
            put(x, y, Math.min(z, 0) - d * 0.5, Math.max(1, under[3]),
                inkOf(under, 0.78 - d * 0.035), i);
          }
        }
      }
    }
    if (stand) { standIn(stand, g, dots, cellYear, ownDots, years, zAt); }
    dots.count = dots.x.length;
    dots.span = n;
    dots.lift = Math.min(Math.max(highest, dots.stand ? dots.stand.top : 0), n / 4);
    dots.years = years;
    return dots;
  }

  /* The building's own model, set into the plot at the point: metres to
     cells, its heights raised as the plot's are (x1.2), on the plot's mean
     ground under it. When the plot knows its years and most of the
     building's own cells are dated, it goes up, storey by storey, in its
     first year: the earliest that a fifth of its dated cells or more agree
     on, so a stray neighbour's year does not bring it up early; else it
     stands throughout, as an undated building of the plot does. (The model
     is its form today: a later wing goes up with it.) */
  function standIn(stand, g, dots, cellYear, ownDots, years, zAt) {
    var n = g.n, cell = g.side / n, N = n * n, q;
    var own = stand.own, z0 = 0, k = 0;
    for (q = 0; q < N; q += 1) { if (own[q]) { z0 += zAt(Math.floor(q / n), q % n); k += 1; } }
    z0 = k ? z0 / k : 0;
    var st = { own: own, n: n, z0: z0, top: 0, first: Infinity, dots: ownDots };
    var ins = stand.inset;
    if (ins) {
      var year = 0;
      if (years) {
        var all = 0, dated = [], tally = {};
        for (q = 0; q < N; q += 1) {
          if (!own[q] || g.kind[q] !== "b") { continue; }
          all += 1;
          if (cellYear[q]) { dated.push(cellYear[q]); tally[cellYear[q]] = (tally[cellYear[q]] || 0) + 1; }
        }
        if (all && dated.length * 2 >= all) {
          dated.sort(function (a, c) { return a - c; });
          for (var u = 0; u < dated.length && !year; u += 1) {
            if (tally[dated[u]] * 5 >= dated.length) { year = dated[u]; }
          }
        }
      }
      var d = ins.dots, v = ins.v, rise = v / cell * 1.2, span = years ? years.y1 - years.y0 : 1;
      for (var t = 0; t < d.count; t += 1) {
        var mx = (d.x[t] + ins.nx / 2 + 0.5) * v - ins.site[0] / 2;
        var my = (d.y[t] + ins.ny / 2 + 0.5) * v - ins.site[1] / 2;
        var gi = Math.max(0, Math.min(n - 1, Math.floor((my + g.side / 2) / cell)));
        var z = z0 + d.z[t] * rise, built = year;
        dots.x.push(mx / cell); dots.y.push(my / cell); dots.z.push(z);
        dots.size.push(d.size[t] * v / cell); dots.ink.push(d.ink[t]);
        // Storey by storey, in its year; or, with no years, as its rows of the plot come up.
        var reveal = years ? (built > 0 ? (built - 1 - years.y0) / span + (d.z[t] / ins.nz) * 0.97 / span : 0)
                           : Math.min(0.98, gi / n + 0.3 * d.z[t] / ins.nz);
        dots.reveal.push(reveal);
        ownDots.push(dots.x.length - 1);
        if (z > st.top) { st.top = z; }
      }
    }
    ownDots.forEach(function (p) {
      if (dots.reveal[p] < st.first) { st.first = dots.reveal[p]; }
      if (dots.z[p] > st.top) { st.top = dots.z[p]; }
    });
    dots.stand = st;
  }

  function sizeClod() {
    var w = Math.max(1, Math.ceil(buildingMap.clientWidth / CLOD_PIX));
    var h = Math.max(1, Math.ceil(buildingMap.clientHeight / CLOD_PIX));
    if (clod.canvas.width !== w || clod.canvas.height !== h) {
      clod.canvas.width = w;
      clod.canvas.height = h;
    }
  }

  function drawClod(now) {
    sizeClod();
    // It rises out of the ground over a second and a half: the town row by
    // row from the north, the building a storey at a time.
    var dots = clod.views[clod.view];
    var shown = still ? 1 : (now - clod.at) / CLOD_RISE;
    if (dots.years) { shown = clod.when; }
    clod.frame = window.Models.draw(clod.canvas, dots, clod.heading, shown, 0.92);
    if (clod.interior) { placeDoor(); }
    standTiles(clod.view === "ground" ? dots : null, shown);
    standPaint(now);
  }

  /* The ring round the building looked at: pixel light on the screen's own
     13 px grid (the tiles'), on the ground just outside its footprint where
     the ground shows — what of the building has risen stands in front of
     it. Quiet at rest, fainter round a bare footprint before the building
     went up; once, when the view settles, it pulses (never under reduced
     motion). */
  var standCanvas = null;
  var STAND_PULSE = 1100;            // ms the one pulse takes: three echoes, each 1/φ of the last
  function standTiles(d, shown) {
    var st = d && d.stand, f = clod.frame;
    clod.ring = null;
    if (!st || !f || walkOn) { return; }
    var r = buildingMap.getBoundingClientRect(), k = buildingMap.clientWidth / clod.canvas.width;
    var n = st.n, half = n / 2, z = st.z0, T = CELL_PX, q, p, sx = [], sy = [];
    var x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (q = 0; q < n * n; q += 1) {
      if (!st.own[q]) { continue; }
      p = Models.project(f, q % n - half + 0.5, Math.floor(q / n) - half + 0.5, z);
      sx.push(r.left + p.x * k); sy.push(r.top + p.y * k);
      x0 = Math.min(x0, sx[sx.length - 1]); x1 = Math.max(x1, sx[sx.length - 1]);
      y0 = Math.min(y0, sy[sy.length - 1]); y1 = Math.max(y1, sy[sy.length - 1]);
    }
    if (!sx.length) { return; }
    var pad = f.scale * k + 2 * T;
    var ti0 = Math.floor((x0 - pad) / T), tj0 = Math.floor((y0 - pad) / T);
    var cols = Math.floor((x1 + pad) / T) - ti0 + 1, rows = Math.floor((y1 + pad) / T) - tj0 + 1;
    if (cols * rows > 60000) { return; }
    var on = new Uint8Array(cols * rows), hid = new Uint8Array(cols * rows), ti, tj, c;
    // On the footprint: each tile whose middle lies over one of its cells,
    // and the tile each of its cells' middles is in (a small one still has one).
    for (tj = 0; tj < rows; tj += 1) {
      for (ti = 0; ti < cols; ti += 1) {
        var u = (((ti0 + ti) * T + T / 2 - r.left) / k - f.cx0) / f.scale;
        var w = ((((tj0 + tj) * T + T / 2 - r.top) / k - f.cy0) / f.scale + z * f.ct) / f.st;
        var gx = Math.floor(u * f.cos + w * f.sin + half), gy = Math.floor(w * f.cos - u * f.sin + half);
        if (gx >= 0 && gy >= 0 && gx < n && gy < n && st.own[gy * n + gx]) { on[tj * cols + ti] = 1; }
      }
    }
    for (q = 0; q < sx.length; q += 1) { on[(Math.floor(sy[q] / T) - tj0) * cols + Math.floor(sx[q] / T) - ti0] = 1; }
    // What of the building has risen hides the ground behind it.
    var built = false;
    st.dots.forEach(function (t) {
      if (d.reveal[t] > shown) { return; }
      built = true;
      if (d.z[t] < z + 0.5) { return; }
      var s = Models.project(f, d.x[t], d.y[t], d.z[t]);
      var a = Math.floor((r.left + s.x * k) / T) - ti0, b = Math.floor((r.top + s.y * k) / T) - tj0;
      if (a >= 0 && b >= 0 && a < cols && b < rows) { hid[b * cols + a] = 1; }
    });
    var tiles = [];
    for (tj = 0; tj < rows; tj += 1) {
      for (ti = 0; ti < cols; ti += 1) {
        c = tj * cols + ti;
        if (on[c] || hid[c]) { continue; }
        var by = false;
        for (var dj = -1; dj <= 1 && !by; dj += 1) {
          for (var di = -1; di <= 1 && !by; di += 1) {
            var a2 = ti + di, b2 = tj + dj;
            by = a2 >= 0 && b2 >= 0 && a2 < cols && b2 < rows && on[b2 * cols + a2] === 1;
          }
        }
        if (by) { tiles.push(ti0 + ti, tj0 + tj); }
      }
    }
    clod.ring = { tiles: tiles, built: built };
  }

  function standPaint(now) {
    if (!standCanvas) {
      if (!clod || !clod.ring) { return; }
      standCanvas = document.createElement("canvas");
      standCanvas.className = "building-light";
      standCanvas.setAttribute("aria-hidden", "true");
    }
    if (standCanvas.parentNode !== buildingMap) { buildingMap.appendChild(standCanvas); }
    var r = buildingMap.getBoundingClientRect(), k = Math.min(window.devicePixelRatio || 1, 3);
    var pw = Math.max(1, Math.round(r.width * k)), ph = Math.max(1, Math.round(r.height * k));
    if (standCanvas.width !== pw || standCanvas.height !== ph) { standCanvas.width = pw; standCanvas.height = ph; }
    var g = standCanvas.getContext("2d");
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, pw, ph);
    var ring = clod && clod.view === "ground" && !walkOn ? clod.ring : null;
    if (!ring || !ring.tiles.length) { return; }
    clod.ringPainted = now;
    // Held frames, like all the pixel light; four steps of brightness.
    var t = clod.pulseAt ? Math.floor((now - clod.pulseAt) / 42) * 42 : -1;
    var rest = ring.built ? 2 : 1, T = CELL_PX;
    g.setTransform(k, 0, 0, k, -r.left * k, -r.top * k);
    g.fillStyle = LIGHT;
    for (var m = 0; m < ring.tiles.length; m += 2) {
      var ti = ring.tiles[m], tj = ring.tiles[m + 1], lv = rest;
      if (t >= 0 && t < STAND_PULSE) {
        [0, 330, 640].forEach(function (at, e) {
          var age = t - at;
          if (age >= 0 && age < 360) { lv = Math.max(lv, Math.ceil((1 - age / 360) * 4 * Math.pow(INV, e))); }
        });
        if (lv > rest && hash2(ti, tj) < 0.3) { lv -= 1; }   // a ragged edge
      }
      g.globalAlpha = LEVELS[Math.min(4, lv)];
      g.fillRect(ti * T + 1, tj * T + 1, T - 2, T - 2);
    }
    g.globalAlpha = 1;
  }

  // The plot with its building standing out, made once a visit (the plain
  // plot stays if anything in it fails).
  var standNoteEl = null;
  function standGround() {
    if (!clod || clod.stood || !clod.g) { return; }
    clod.stood = true;
    try {
      var st = standing(clod.b, clod.g, clod.model);
      if (st) { clod.views.ground = shapeClod(clod.b, clod.g, st); clod.dirty = true; }
    } catch (e) { /* the plot as it was */ }
  }

  /* Isometric: the building rests on one of its four 45° diagonals, where
     every measurement along its walls reads true, and every CLOD_REST it
     swings a quarter turn to the next, easing in and out. A drag turns it
     freely; let go, it settles on the nearest diagonal. */
  var CLOD_REST = Math.pow(PHI, 6) * 1000;    // ≈ 17.9 s at rest on a diagonal
  var CLOD_SWING = PHI * PHI * 1000;          // ≈ 2.6 s to swing to the next
  var CLOD_RISE = PHI * 1000;                 // ≈ 1.6 s to rise out of the ground
  var CLOD_GROW = Math.pow(PHI, 5) * 1000;    // ≈ 11 s for the whole of a town's years to go by
  function isoNearest(h) { return Math.round((h - TAU / 8) / (TAU / 4)) * (TAU / 4) + TAU / 8; }

  function clodFrame(now) {
    if (!clod) { return; }
    if (!clod.held) {
      if (!still && now >= clod.nextTurn) {
        clod.from = clod.heading;
        clod.to = isoNearest(clod.heading) + TAU / 4;
        clod.swingAt = now;
        clod.nextTurn = now + CLOD_REST;
      }
      if (clod.swingAt !== null) {
        var q = Math.min(1, (now - clod.swingAt) / (still ? 1 : CLOD_SWING));
        var e = q < 0.5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
        clod.heading = clod.from + (clod.to - clod.from) * e;
        clod.dirty = true;
        if (q >= 1) { clod.heading = clod.to; clod.swingAt = null; }
      }
    }
    // The timeline eases toward where it has been set, so what went up
    // between rises storey by storey as the slider passes.
    var dotsNow = clod.views[clod.view];
    if (dotsNow && dotsNow.years && clod.when !== clod.whenTo) {
      var dt = now - (clod.last || now);
      if (clod.byHand) {
        // Following the slider: close behind it, so what is passed still rises.
        clod.when += (clod.whenTo - clod.when) * Math.min(1, dt / 377);
        if (Math.abs(clod.whenTo - clod.when) < 0.0005) { clod.when = clod.whenTo; }
      } else {
        // The first time: the town's years go by at an even pace.
        clod.when = Math.min(clod.whenTo, clod.when + dt / CLOD_GROW);
      }
      clod.dirty = true;
      showYear();
    }
    clod.last = now;
    // Drawn only while something is happening — rising, swinging, being
    // turned, or the window changing size. At rest it costs nothing.
    var rising = !still && now - clod.at < CLOD_RISE + 100;
    var sized = buildingMap.clientWidth !== clod.cw || buildingMap.clientHeight !== clod.ch;
    if ((rising || clod.dirty || sized) && now - clod.drawn >= 1000 / CLOD_FPS) {
      clod.drawn = now;
      clod.dirty = false;
      clod.cw = buildingMap.clientWidth;
      clod.ch = buildingMap.clientHeight;
      drawClod(now);
    }
    // The ring round the building pulses once the plot has settled: risen,
    // and its years come to rest.
    if (clod.ring && !clod.pulsed && clod.view === "ground" && now - clod.at > CLOD_RISE + 120 &&
        !(dotsNow && dotsNow.years && clod.when !== clod.whenTo)) {
      clod.pulsed = true;
      if (!still) { clod.pulseAt = now; }
    }
    if (clod.pulseAt && now - (clod.ringPainted || 0) >= 42) {
      if (now - clod.pulseAt > STAND_PULSE) { clod.pulseAt = 0; }
      standPaint(now);
    }
    clod.raf = requestAnimationFrame(clodFrame);
  }

  function readModel(slug) {
    var key = "model:" + slug;
    if (!grounds[key]) {
      grounds[key] = read("models/" + slug + ".json").catch(function () { return null; });
    }
    return grounds[key];
  }

  function startBuilding(city) {
    if (!buildingEl) { return; }
    var b = city.building;
    var visit = {};
    buildingOn = visit;
    // A building links to its article; a museum has its works instead.
    buildingLink.hidden = !b.url;
    if (b.url) { buildingLink.href = b.url; }
    if (city.museum) { showHeld(city.museum, city.via, visit, city.townKey); } else { delete buildingEl.dataset.museum; }
    var walkVia = city.via;
    delete city.via;
    // Come from a work's stop at this museum: its town opens at that year.
    var atYear = city.atYear;
    delete city.atYear;
    buildingEl.hidden = false;
    // Its works from the top: a scroll set while the building was hidden
    // does not hold, and the last museum's would come back with it.
    if (city.museum && buildingWorks) { buildingWorks.scrollTop = 0; buildingWorks.scrollLeft = 0; }
    buildingEl.dataset.air = "waiting";

    Promise.all([readModel(b.slug), readGround(b.slug)]).then(function (both) {
      if (buildingOn !== visit) { return; }
      var model = both[0], g = both[1];
      var views = {};
      // The building itself, made from its photographs, on a plate of its
      // own ground; and the ground it stands in — its grounds, or its town.
      if (model && model.parts && window.Models) {
        views.building = window.Models.build(model, function (i, j) {
          return soilCell(dirt.land, b, j, i);
        });
      }
      if (g && g.n) { views.ground = shapeClod(b, g); }
      var first = views.building ? "building" : views.ground ? "ground" : null;
      if (atYear && views.ground && views.ground.years) { first = "ground"; } else { atYear = 0; }
      if (!first) { buildingEl.dataset.air = "none"; return; }
      var canvas = document.createElement("canvas");
      canvas.className = "building-clod";
      // What the drawing is, in words (WCAG 1.1.1).
      canvas.setAttribute("role", "img");
      canvas.setAttribute("aria-label", (b.name || b.title || "The building") +
        (views.building ? ", modelled in dots of its ground and seen from above; a press turns it to the ground round it"
                        : ", its ground in dots, seen from above"));
      buildingMap.appendChild(canvas);
      clod = {
        canvas: canvas, views: views, view: first,
        heading: TAU / 8 + Math.floor(Math.random() * 4) * TAU / 4,
        at: performance.now(), drawn: 0, last: 0, held: false, dirty: true, raf: 0,
        swingAt: null, from: 0, to: 0, nextTurn: performance.now() + CLOD_REST,
        when: 1, whenTo: 1, byHand: false,
        b: b, m: city.museum || null, model: model, g: g
      };
      // The building standing out in its plot: made now if the plot is shown
      // first, else once the building has risen and the page is idle.
      if (first === "ground") { standGround(); }
      else if (views.ground) {
        window.setTimeout(function () {
          var go = function () { if (buildingOn === visit) { standGround(); } };
          if (window.requestIdleCallback) { window.requestIdleCallback(go, { timeout: 2600 }); } else { go(); }
        }, still ? 0 : CLOD_RISE + 300);
      }
      if (!standNoteEl) {
        standNoteEl = document.createElement("p");
        standNoteEl.className = "building-note";
        buildingEl.appendChild(standNoteEl);
      }
      standNoteEl.textContent = views.ground ? standNote(b, model) : "";
      if (city.museum && views.building) { walkLoad(visit, b, city.museum, walkVia); }
      buildingEl.dataset.air = "up";
      buildingEl.dataset.view = first;
      startTime(views[first], atYear);
      showYear();
      clod.raf = requestAnimationFrame(clodFrame);
    });
  }

  /* A museum's works: first the ones the artist saved that it holds, most
     recently saved first, each a picture off Artsy's image store and its
     caption; then, on asking, the rest of its collection, searched from here
     (collections.js) and shown the same way, marked as the collection's.
     Pressing a work brings it up large; pressing it again puts it back.
     Nothing leads off the site. */
  function heldFigure(w, src, i, found, alts, opts) {
    opts = opts || {};
    var fig = document.createElement("figure");
    fig.className = found ? "held held-found" : "held";
    // The picture is the control (WCAG 4.1.2): a figure that is a button cannot hold the
    // buttons in its caption (Where it has been, Where it hangs). Brought up large: data-open.
    fig.dataset.open = "false";
    var img = document.createElement("img");
    img.alt = w.t + (w.a ? ", " + w.a : "");
    img.tabIndex = 0;
    img.setAttribute("role", "button");
    img.setAttribute("aria-label", img.alt);
    img.setAttribute("aria-expanded", "false");
    // A saved work is never lost for want of its picture: another size of
    // it is tried, and failing all, it stays as its caption. (Dropping it had
    // emptied a museum's saved works on a phone where the pictures failed.)
    // Found works without a picture are simply left out.
    img.loading = found ? "lazy" : "eager";
    img.decoding = "async";
    if (!found) { img.referrerPolicy = "no-referrer"; }   // Artsy's store; the museums' own are asked as before
    var tries = (alts || []).slice();
    img.addEventListener("error", function () {
      if (tries.length) { img.src = tries.shift(); return; }
      if (found) { fig.remove(); return; }
      fig.classList.add("held-nopic");
      img.removeAttribute("src");
    });
    img.src = src;
    var cap = document.createElement("figcaption");
    var t = document.createElement("i");
    t.textContent = w.t || "Untitled";
    cap.appendChild(t);
    var by = [w.a, w.y].filter(Boolean).join(", ");
    cap.appendChild(document.createTextNode(by ? " — " + by : ""));
    var med = document.createElement("span");
    med.className = "held-medium";
    med.textContent = w.m || "";
    cap.appendChild(med);
    // A saved work in a museum's column: where it has been, on the Artworks side.
    if (opts.history) {
      var hist = document.createElement("button");
      hist.type = "button";
      hist.className = "held-history";
      hist.textContent = "Where it has been";
      hist.addEventListener("click", function (event) {
        event.stopPropagation();
        openArt({ work: w.id }, { museum: { name: opts.history.name, slug: opts.history.slug } });
      });
      // Enter on it is its own, not the figure's.
      hist.addEventListener("keydown", function (event) { event.stopPropagation(); });
      cap.appendChild(hist);
    }
    fig.appendChild(img);
    fig.appendChild(cap);
    function open(event) {
      // Something else to do when pressed: open its history, say (opts.onOpen).
      if (opts.onOpen) { opts.onOpen(fig); return; }
      var was = fig.dataset.open === "true";
      // Brought up large, a press on its picture: twice as big, then the whole screen (zoom.js, 7 Oct 2026).
      if (was && window.Zoom && event && event.target === img && img.getAttribute("src")) { zoomHeld(); return; }
      var host = fig.closest(".art-col") || buildingWorks;
      Array.prototype.forEach.call(host.querySelectorAll(".held"), function (f) {
        f.dataset.open = "false";
        var fi = f.querySelector("img[role=button]");
        if (fi) { fi.setAttribute("aria-expanded", "false"); }
      });
      fig.dataset.open = String(!was);
      img.setAttribute("aria-expanded", String(!was));
      if (!was && opts.big && img.getAttribute("src") && img.src !== opts.big) {
        var big = new Image();
        big.referrerPolicy = "no-referrer";
        big.onload = function () { img.src = opts.big; };
        big.src = opts.big;
      }
      var r = fig.getBoundingClientRect();
      pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT], 0.4, Math.max(r.width, r.height));
    }
    function heldLabel() {
      if (!window.WallLabel) { return null; }
      return WallLabel.fill(el("div", "wall-label"), WallLabel.fromItem({ title: w.t, by: w.a, year: w.y, medium: w.m,
        where: opts.history ? opts.history.name : "", src: "Artsy" }));
    }
    function zoomHeld() {
      var z = Zoom.big();
      if (z && z.node === img) {
        Zoom.open({ src: img.currentSrc || img.src, alt: img.alt, label: heldLabel,
                    big: opts.big ? [opts.big.replace(/\/[a-z]+\.jpg$/, "/normalized.jpg"), opts.big.replace(/\/[a-z]+\.jpg$/, "/larger.jpg")] : [] });
        return;
      }
      var r0 = img.getBoundingClientRect();
      Zoom.twice({ node: img, img: img, label: heldLabel, base: function () { return r0; } });
    }
    fig.addEventListener("click", open);
    img.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); }
    });
    fig.style.animationDelay = (still ? 0 : 0.38 + Math.min(i, 13) * 0.09).toFixed(2) + "s";
    return fig;
  }

  /* Every saved work it holds, 34 at a time (the National Gallery holds
     177); then the works that have been here without being saved as held —
     shown, lent, listed — each a door to its history; then the search. */
  var buildingPagers = [];
  function showHeld(m, via, visit, townKey) {
    buildingEl.dataset.museum = "true";
    if (!buildingWorks) { return; }
    buildingWorks.textContent = "";
    // Bloomberg Connects (bloomberg.js): the museum's own guide, a link off the site, at the
    // head of its column (the categories' header above it), before Saved. None, nothing.
    var guide = window.Bloomberg && Bloomberg.link(m.slug);
    if (guide) { buildingWorks.appendChild(guide); }
    // A museum that holds more than a page of saved works has the search of
    // its collection first, not at the foot of a list that grows as it is
    // scrolled toward (the National Gallery of Art holds 177).
    var searchFirst = !!window.Collections && (m.works || []).length > 34;
    if (searchFirst) { buildingWorks.appendChild(searchFor(m)); }
    var head = document.createElement("p");
    head.className = "held-count";
    head.textContent = "Saved \u00b7 " + (m.held === 1 ? "one work" : m.held + " works");
    buildingWorks.appendChild(head);
    // Come from a work's history, that work is first, and brought up large.
    var first = via && via.work;
    var works = (m.works || []).slice();
    if (first) {
      works = works.filter(function (w) { return w.id === first; })
        .concat(works.filter(function (w) { return w.id !== first; }));
    }
    var alive = function () { return buildingOn === visit; };
    var paging = { root: buildingWorks, alive: alive, pagers: buildingPagers };
    var saved = document.createElement("div");
    saved.className = "held-rows";
    buildingWorks.appendChild(saved);
    pageRows(saved, works, function (w, i) {
      // A row is 72-89 px: Artsy's medium, not its large (34 large pictures
      // at once were more than a phone would keep painted); the large one
      // when the work is brought up.
      var cdn = museums.cdn || "", key = String(w.i || "").split("/")[0], big = cdn + w.i + ".jpg";
      var alts = ["square", "small", "large"].map(function (v) { return cdn + key + "/" + v + ".jpg"; })
        .filter(function (u) { return u !== big; }).concat([big]);
      var opts = { big: big };
      if (ARTWORKS && w.id) { opts.history = m; }
      var fig = heldFigure(w, cdn + key + "/medium.jpg", i, false, alts, opts);
      if (first && w.id === first) { fig.dataset.open = "true"; fig.querySelector("img").setAttribute("aria-expanded", "true"); fig.querySelector("img").src = big; }
      if (w.id) { fig.dataset.work = w.id; walkWhere(fig, w); }
      return fig;
    }, paging);
    // Also here: from its city's file (usually read already, on the way in).
    var also = document.createElement("section");
    also.className = "held-also";
    buildingWorks.appendChild(also);
    var t = ARTWORKS && townKey && towns ? townBy[townKey] : null;
    if (t && t.file) {
      readArt("places/" + t.key + ".json").then(function (pf) {
        if (!alive() || !pf) { return; }
        var held = {}, rows = [], seen = {};
        (m.works || []).forEach(function (w) { held[w.id] = true; });
        pf.works.forEach(function (r) {
          var v = pf.venues[r[5]];
          if (!v || v[1] !== m.slug || held[r[0]] || seen[r[0]]) { return; }
          seen[r[0]] = true;
          rows.push(r);
        });
        if (!rows.length) { return; }
        var h = document.createElement("p");
        h.className = "held-count";
        h.textContent = "Also here \u00b7 " + rows.length;
        also.appendChild(h);
        pageRows(also, rows, function (r, i) { return alsoRow(r, m, i); }, paging);
      });
    }
    if (window.Collections && !searchFirst) { buildingWorks.appendChild(searchFor(m)); }
    buildingWorks.scrollTop = 0;
    buildingWorks.scrollLeft = 0;
  }

  /* A work that has been here without being held: as a saved one is shown,
     with what happened here and when; pressed, its history, the museum's
     thread said first. */
  function alsoRow(r, m, i) {
    var what = (r[8] || []).map(function (kd) { return KIND_WORD[kd] || kd; })
      .filter(function (w, k, all) { return all.indexOf(w) === k; }).join(" · ");
    var fig = heldFigure({ t: r[1], a: r[2], y: "" }, ART_CDN + r[3] + "/square.jpg", i, false,
                         [ART_CDN + r[3] + "/medium.jpg"],
                         { onOpen: function () { openArt({ work: r[0] }, { museum: { name: m.name, slug: m.slug } }); } });
    fig.classList.add("held-also-row");
    fig.querySelector("img").loading = "lazy";
    fig.querySelector("figcaption").appendChild(el("span", "art-row-what", [what, yearsText(r[6], r[7])].filter(Boolean).join(" ")));
    // Hung in the walk where the museum is arranged: a door to it, as a saved work's.
    fig.dataset.work = r[0];
    walkWhere(fig, { id: r[0] });
    return fig;
  }

  /* The rest of the collection: a button, then a search field and what it
     finds. It opens on a first page of the collection, and each search
     replaces it; an answer that comes back after a newer search is dropped. */
  function searchFor(m) {
    var box = document.createElement("section");
    box.className = "collection";
    var ask = document.createElement("button");
    ask.type = "button";
    ask.className = "collection-open";
    ask.textContent = "Search the rest of the collection";
    box.appendChild(ask);

    ask.addEventListener("click", function () {
      ask.remove();
      var head = document.createElement("p");
      head.className = "held-count";
      head.textContent = "In the collection";
      var form = document.createElement("form");
      form.className = "collection-form";
      form.setAttribute("role", "search");
      var field = document.createElement("input");
      field.type = "search";
      field.className = "collection-field";
      field.placeholder = "Artist, title, subject\u2026";
      field.setAttribute("aria-label", "Search the collection of " + m.name);
      field.autocomplete = "off";
      form.appendChild(field);
      var said = document.createElement("p");
      said.className = "collection-said";
      said.setAttribute("aria-live", "polite");
      var found = document.createElement("div");
      found.className = "collection-found";
      var from = document.createElement("p");
      from.className = "collection-from";
      from.textContent = "from " + window.Collections.source(m);
      box.appendChild(head);
      box.appendChild(form);
      box.appendChild(said);
      box.appendChild(found);
      box.appendChild(from);

      var asked = 0, wait = 0;
      function look(text) {
        var mine_ = ++asked;
        said.textContent = "Looking\u2026";
        box.dataset.busy = "true";
        window.Collections.search(m, text).then(function (works) {
          if (mine_ !== asked) { return; }
          found.textContent = "";
          works.forEach(function (w, i) { found.appendChild(heldFigure(w, w.src, i, true)); });
          said.textContent = works.length ? "" :
            (text ? "Nothing with a picture for \u201c" + text + "\u201d." : "Nothing with a picture found.");
        }).catch(function () {
          if (mine_ !== asked) { return; }
          said.textContent = "The collection could not be reached just now.";
        }).then(function () {
          if (mine_ === asked) { delete box.dataset.busy; }
        });
      }
      form.addEventListener("submit", function (event) {
        event.preventDefault();
        window.clearTimeout(wait);
        look(field.value);
        field.blur();
      });
      field.addEventListener("input", function () {
        window.clearTimeout(wait);
        wait = window.setTimeout(function () { look(field.value); }, 610);
      });
      // It opens on works from the collection, not on a keyboard: the
      // search bar waits above them until it is tapped (artist, 24 Sep 2026).
      look("");
      try { box.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" }); } catch (e) {}
      var r = box.getBoundingClientRect();
      pulse(r.left + r.width / 2, r.top + 20, [LIGHT], 0.4, r.width);
    });
    return box;
  }

  /* The timeline: when the ground knows when its buildings went up, a
     slider of years lies under it. The town first grows from its earliest
     year to this one; moving the slider back and forth takes it down and
     puts it up again, each year's buildings rising storey by storey as they
     are passed (artist, 24 Sep 2026: "watching the urban development of an
     area rise over time"). */
  var timeline = document.getElementById("building-time");
  var timeRange = document.getElementById("building-time-range");
  var timeYear = document.getElementById("building-time-year");
  function yearOf(when, years) { return Math.round(years.y0 + when * (years.y1 - years.y0)); }
  function showYear() {
    if (!clod || !timeline) { return; }
    var d = clod.views[clod.view];
    var on = !!(d && d.years);
    timeline.hidden = !on;
    if (!on) { return; }
    var yr = Math.max(d.years.y0 + 1, yearOf(clod.when, d.years));
    timeYear.textContent = String(yr);
    if (document.activeElement !== timeRange) { timeRange.value = String(Math.round(clod.when * 1000)); }
    timeRange.setAttribute("aria-valuetext", String(yr));
  }
  /* Given a year (a work was here then), the town opens as it stood that
     year, holds a moment, and rises on to now — unless the slider is
     taken first. */
  function startTime(d, atYear) {
    if (!d || !d.years) { return; }
    timeRange.min = "0";
    timeRange.max = "1000";
    clod.when = still ? 1 : 0;
    clod.whenTo = 1;
    clod.byHand = false;
    clod.touched = false;
    clod.firstPlay = false;
    // It grows by itself the first time this viewer comes to it, else stands at now.
    if (!atYear && !still) {
      if (dialDriven() || !firstSeen("m:" + clod.b.slug)) { clod.when = 1; } else { clod.firstPlay = true; }
    }
    if (atYear && !still) {
      var span = Math.max(1, d.years.y1 - d.years.y0);
      clod.when = clod.whenTo = Math.max(0, Math.min(1, (atYear - d.years.y0) / span));
      clod.byHand = true;
      var mine_ = clod;
      window.setTimeout(function () {
        if (clod !== mine_ || mine_.touched) { return; }
        mine_.whenTo = 1;
        mine_.byHand = false;
      }, Math.pow(PHI, 3) * 1000);
    }
    showYear();
  }
  if (timeline) {
    timeRange.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    timeRange.addEventListener("input", function () {
      if (!clod) { return; }
      clod.whenTo = Number(timeRange.value) / 1000;
      clod.byHand = true;
      clod.touched = true;
      var d = clod.views[clod.view];
      if (d && d.years) { timeYear.textContent = String(Math.max(d.years.y0 + 1, yearOf(clod.whenTo, d.years))); }
    });
  }

  /* A tap swaps the building for the ground it stands in, and back; each
     rises again as it comes. */
  function turnView() {
    if (!clod) { return; }
    var other = clod.view === "building" ? "ground" : "building";
    if (!clod.views[other]) { return; }
    if (other === "ground") { standGround(); }
    clod.view = other;
    clod.at = performance.now();
    clod.dirty = true;
    clod.pulsed = false;
    clod.pulseAt = 0;
    buildingEl.dataset.view = other;
    startTime(clod.views[other]);
    showYear();
    var r = buildingMap.getBoundingClientRect();
    pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT], 0.5, Math.max(r.width, r.height) * INV2);
  }

  function stopBuilding() {
    walkStop();
    buildingOn = null;
    buildingPagers.forEach(function (p) { p.disconnect(); });
    buildingPagers = [];
    if (clod) {
      cancelAnimationFrame(clod.raf);
      if (clod.canvas.parentNode) { clod.canvas.parentNode.removeChild(clod.canvas); }
      clod = null;
    }
    if (standCanvas) {
      var sg = standCanvas.getContext("2d");
      sg.setTransform(1, 0, 0, 1, 0, 0);
      sg.clearRect(0, 0, standCanvas.width, standCanvas.height);
    }
    if (buildingEl) { buildingEl.hidden = true; }
    if (buildingWorks) { buildingWorks.textContent = ""; }
    if (timeline) { timeline.hidden = true; }
  }

  if (buildingEl) {
    // The stage turns the world with the pointer; in here it turns the clod.
    var clodDrag = null;
    buildingEl.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
      if (!clod || walkOn || event.target === buildingLink || buildingLink.contains(event.target)) { return; }
      if (timeline && timeline.contains(event.target)) { return; }
      if (buildingWorks && buildingWorks.contains(event.target)) { return; }
      clodDrag = { x: event.clientX, y: event.clientY, heading: clod.heading, moved: 0 };
      clod.held = true;
      try { buildingMap.setPointerCapture(event.pointerId); } catch (e) {}
    });
    buildingMap.addEventListener("pointermove", function (event) {
      if (!clodDrag || !clod) { return; }
      clodDrag.moved = Math.max(clodDrag.moved, Math.abs(event.clientX - clodDrag.x) +
                                Math.abs(event.clientY - clodDrag.y));
      clod.heading = clodDrag.heading + (event.clientX - clodDrag.x) * 0.012;
      clod.dirty = true;
    });
    var letGo = function (event) {
      if (clodDrag && clodDrag.moved < 6 && event && event.type === "pointerup") { turnView(); }
      clodDrag = null;
      if (clod) {
        // Settle on the nearest isometric diagonal.
        var now = performance.now();
        clod.held = false;
        clod.from = clod.heading;
        clod.to = isoNearest(clod.heading);
        clod.swingAt = now;
        clod.nextTurn = now + CLOD_REST;
      }
    };
    buildingMap.addEventListener("pointerup", letGo);
    buildingMap.addEventListener("pointercancel", letGo);
  }

  /* ---- walk the building ----------------------------------------------------

     The artist, 27 Sep 2026: "…click 'walk the building' and walk around the
     given space. I want to be able to do that with every museum on the
     website"; and 1 Oct 2026: "did you figure out the museum walk throughs
     using that website I sent you?" — and, the same day, "regardless of where
     you are … you should always be free to move".

     Every museum's building has a way in: "Walk the building" at its foot (and,
     where a source gives the door, one lit tile on it); spreading two fingers,
     scrolling in or "+" on the building go in too. Inside is walk.js (the plan,
     the walk, the look) over interiors/<slug>.json, compiled by walk-plan.js;
     both are read only when a museum is opened, on idle. Pinching in, "−",
     scrolling out or Escape climb one level (look → walk → plan → building);
     the banner's way back, which reads the museum's name while inside, leaves
     the walk in one press. Where you stood is kept for the visit only. */

  var WALK = true;                   // false: the museum view exactly as before
  var walkOn = false;
  var insideWas = {};                // slug -> where you stood, this visit only
  var walkGoEl = null, walkDoorEl = null, walkDoorPulses = 0;
  var needs = {};

  // A script, once; a failure is forgotten, so it can be asked for again.
  function need(src) {
    if (!needs[src]) {
      needs[src] = new Promise(function (done, fail) {
        var s = document.createElement("script");
        s.src = src;
        s.onload = function () { done(); };
        s.onerror = function () { delete needs[src]; fail(new Error(src)); };
        document.head.appendChild(s);
      });
    }
    return needs[src];
  }

  function readInterior(slug) {
    var key = "interior:" + slug;
    if (!grounds[key]) {
      grounds[key] = read("interiors/" + slug + ".json").catch(function () { delete grounds[key]; return null; });
    }
    return grounds[key];
  }

  // After the building has risen, on idle: the walk's code and the interior.
  function walkLoad(visit, b, m, via) {
    if (!WALK || !window.Models) { return; }
    var go = function () {
      if (buildingOn !== visit) { return; }
      Promise.all([need("walk-plan.js"), need("walk.js"), readInterior(b.slug)]).then(function (all) {
        if (buildingOn !== visit || !clod || !all[2] || !window.Walk) { return; }
        var interior = all[2];
        clod.interior = interior;
        clod.where = {};
        (interior.works || []).forEach(function (w) { clod.where[w.id] = w; });
        clod.roomName = {};
        (interior.floors || []).forEach(function (f) {
          (f.rooms || []).forEach(function (r) { clod.roomName[r.id] = r.name || r.id; });
        });
        try { clod.door = window.Walk.prepare(walkCtx({})); } catch (e) { clod.door = null; }
        Array.prototype.forEach.call(buildingWorks.querySelectorAll(".held[data-work]"), function (fig) {
          walkWhere(fig, { id: fig.dataset.work });
        });
        placeDoor();
        if (via && via.walk) {
          window.setTimeout(function () {
            if (buildingOn === visit) { enterWalk({ to: via.work, came: via.came }); }
          }, still ? 0 : CLOD_RISE + PHI * 1000);
        }
      }).catch(function () {});
    };
    if (window.requestIdleCallback) { window.requestIdleCallback(go, { timeout: 2600 }); }
    else { window.setTimeout(go, CLOD_RISE); }
  }

  // The sun at the museum now, for its skylights and courts.
  function skyAt(b) {
    return function () {
      var s = sunNow(Date.now()), lat = b.lat * RAD, lon = b.lon * RAD;
      var dot = Math.sin(lat) * Math.sin(s.lat) + Math.cos(lat) * Math.cos(s.lat) * Math.cos(lon - s.lon);
      return { alt: Math.asin(Math.max(-1, Math.min(1, dot))), dark: Math.max(0, Math.min(1, (0.03 - dot) / 0.15)) };
    };
  }

  // The pixel light on another canvas (the walk's, which lies over the
  // building), or back on #tiles.
  function lightInto(canvas) {
    var old = tilesCanvas;
    tilesCanvas = canvas || tilesHome;
    tilesCtx = tilesCanvas.getContext("2d");
    if (old !== tilesCanvas) {
      var og = old.getContext("2d");
      og.setTransform(1, 0, 0, 1, 0, 0);
      og.clearRect(0, 0, old.width, old.height);
    }
    tilesDirty = true;
  }

  // What land.js lends the walk.
  function walkHost() {
    return {
      pulse: pulse, sweepCells: sweepCells, passage: passage, scramble: scramble, ARRIVALS: ARRIVALS,
      oneOf: oneOf, later: later, afterStill: afterStill, pointerAt: pointerAt, still: still,
      LIGHT: LIGHT, LILAC: LILAC, PHI: PHI, INV: INV, INV2: INV2,
      OPEN_AT: OPEN_AT, FIRST_WORD_AT: FIRST_WORD_AT, WORD_GAP: WORD_GAP, WORD_GAP_GROW: WORD_GAP_GROW,
      WORD_GAP_MAX: WORD_GAP_MAX, CLOD_RISE: CLOD_RISE,
      readArt: readArt, openArt: openArt, cdn: (museums && museums.cdn) || ART_CDN,
      banner: { city: bannerCity, under: bannerUnder }, lightInto: lightInto,
      // A thread's door to a work held at another of the site's museums:
      // there, and in by itself once its building has risen.
      goMuseum: function (slug, workId, came) { openMuseum(slug, { work: workId, walk: true, came: came }); }
    };
  }

  function walkCtx(opts) {
    var b = clod.b, m = clod.m, was = insideWas[m.slug];
    return {
      museum: m, interior: clod.interior, modelSpec: clod.model, extDots: clod.views.building,
      heading: clod.heading, host: buildingEl, band: buildingMap, strip: buildingWorks,
      soil: function (i, j) { return soilCell(dirt.land, b, j, i); },
      frameInk: getComputedStyle(buildingEl).backgroundColor, sky: skyAt(b),
      at: opts.to ? { work: opts.to } : was ? { resume: was } : null, came: opts.came || null,
      land: walkHost(),
      onLevel: function (lv) {
        if (lv) { buildingEl.dataset.inside = lv; } else { delete buildingEl.dataset.inside; }
        // Inside, the way back is out of the building, in one press: "← Outside".
        if (bannerBackTo) { bannerBackTo.textContent = lv ? "Outside" : backName(levelUp()); }
        placeDoor();
      },
      onWhere: function (p) {
        var had = insideWas[m.slug];
        insideWas[m.slug] = p;
        if (!had || had.room !== p.room) { walkHere(p.room); }
      },
      onOut: leaveWalk
    };
  }

  function enterWalk(opts) {
    if (!WALK || walkOn || !clod || !clod.interior || !clod.m || !window.Walk || flying || groundOn) { return false; }
    if (clod.view !== "building" && clod.views.building) {
      clod.view = "building";
      buildingEl.dataset.view = "building";
    }
    walkOn = true;
    cancelAnimationFrame(clod.raf);
    clod.raf = 0;
    if (timeline) { timeline.hidden = true; }
    placeDoor();
    window.Walk.open(walkCtx(opts || {})).catch(function () {
      // Nothing that can be walked: the building, as it was.
      if (walkOn) { leaveWalk("error"); }
    });
    return true;
  }

  function leaveWalk(how) {
    if (!walkOn) { return; }
    walkOn = false;
    delete buildingEl.dataset.inside;
    lightInto(null);
    if (bannerBackTo) { bannerBackTo.textContent = backName(levelUp()); }
    walkHere(null);
    if (!clod) { return; }
    var now = performance.now();
    clod.dirty = true;
    // Back up from the plan the roof has settled already; out of the door it rises.
    clod.at = how === "up" ? now - CLOD_RISE - 200 : now;
    clod.heading = isoNearest(clod.heading);
    clod.swingAt = null;
    clod.nextTurn = now + CLOD_REST;
    if (!clod.raf) { clod.raf = requestAnimationFrame(clodFrame); }
    showYear();
    placeDoor();
  }

  // Out of the walk at once (the banner's way back, or leaving the museum).
  function walkClose(how) {
    if (!walkOn) { return false; }
    if (window.Walk) { window.Walk.close(); }
    leaveWalk(how || "all");
    return true;
  }

  // The way in at the building's foot, and the lit tile at its door where
  // a source gives one. Neither shows on the ground or while inside.
  function placeDoor() {
    if (!clod || !clod.interior || !clod.m) {
      if (walkGoEl) { walkGoEl.hidden = true; }
      if (walkDoorEl) { walkDoorEl.hidden = true; }
      return;
    }
    if (!walkGoEl) {
      walkGoEl = document.createElement("button");
      walkGoEl.type = "button";
      walkGoEl.className = "walk-go";
      walkGoEl.textContent = "Walk the building";
      walkGoEl.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      walkGoEl.addEventListener("click", function () {
        var r = walkGoEl.getBoundingClientRect();
        pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT, LILAC], 0.6, 120);
        enterWalk({});
      });
      buildingEl.appendChild(walkGoEl);
    }
    var outside = !walkOn && clod.view === "building" && !!clod.views.building;
    walkGoEl.hidden = !outside;
    if (outside) {
      walkGoEl.setAttribute("aria-label", "Walk the building · " + clod.m.name +
        (clod.door && clod.door.shell ? " (its rooms are not known yet)" : ""));
    }
    if (!walkDoorEl) {
      walkDoorEl = document.createElement("button");
      walkDoorEl.type = "button";
      walkDoorEl.className = "walk-door";
      walkDoorEl.appendChild(document.createElement("span"));
      walkDoorEl.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      walkDoorEl.addEventListener("click", function () { enterWalk({}); });
      buildingMap.appendChild(walkDoorEl);
    }
    var d = clod.door, shows = outside && d && d.dots && clod.frame && window.Walk.doorShows(d, clod.heading) &&
      (still || performance.now() - clod.at > CLOD_RISE);
    walkDoorEl.hidden = !shows;
    if (!shows) { return; }
    walkDoorEl.setAttribute("aria-label", "Go into " + clod.m.name);
    var p = window.Models.project(clod.frame, d.dots[0], d.dots[1], d.dots[2]);
    var k = buildingMap.clientWidth / clod.canvas.width;
    walkDoorEl.style.left = Math.round(p.x * k - 22) + "px";
    walkDoorEl.style.top = Math.round(p.y * k - 22) + "px";
    // It pulses when the building has risen, and once more after φ⁶ s
    // untouched; never again that visit.
    if (!walkDoorPulses && !still) {
      walkDoorPulses = 1;
      pulseDoor();
      var mine_ = clod;
      window.setTimeout(function () {
        if (clod === mine_ && walkDoorPulses === 1 && !walkOn && !walkDoorEl.hidden &&
            performance.now() - pointerAt.at > Math.pow(PHI, 6) * 1000) {
          walkDoorPulses = 2;
          pulseDoor();
        }
      }, Math.pow(PHI, 6) * 1000);
    }
  }
  function pulseDoor() {
    var r = walkDoorEl.getBoundingClientRect();
    pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT], 0.6, 90);
  }

  // A saved work in the column: where it hangs (a door into the walk,
  // before it), or why it does not hang, in the record's own words.
  function walkWhere(fig, w) {
    if (!clod || !clod.where || !w || !w.id) { return; }
    var cap = fig.querySelector("figcaption");
    if (!cap || cap.querySelector(".held-where, .held-where-said")) { return; }
    var iw = clod.where[w.id];
    if (iw && iw.same && clod.where[iw.same]) { iw = clod.where[iw.same]; }
    if (!iw) { return; }
    // An arranged work (INTERIORS.md, "Arranged") hangs where the site's rule put it — in a room it
    // arranged, or beside the museum's own works ("Beside the known"): a door like any other, and
    // under it, opened, its own sentence of how it came to hang there — here in the column, never
    // over the walk.
    var arranged = iw.how === "arranged";
    if ((iw.how === "museum" || arranged) && iw.room && clod.roomName[iw.room] !== undefined) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "held-where";
      b.textContent = "Where it hangs · " + clod.roomName[iw.room];
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        if (walkOn) { window.Walk.goTo(iw.id); } else { enterWalk({ to: iw.id }); }
      });
      b.addEventListener("keydown", function (event) { event.stopPropagation(); });
      cap.appendChild(b);
      if (arranged) {
        var how = String(iw.said || "hung there by the site: where the museum hangs it is not known");
        cap.appendChild(el("span", "held-where-said", how.charAt(0).toUpperCase() + how.slice(1)));
      }
    } else if (iw.said) {
      var said = String(iw.said);
      if (iw.how === "elsewhere") { said = "Elsewhere in the museum · " + said; }
      cap.appendChild(el("span", "held-where-said", said.charAt(0).toUpperCase() + said.slice(1)));
    }
  }

  // While inside: the works that hang in the room you are in, first.
  function walkHere(roomId) {
    var was = buildingWorks && buildingWorks.querySelector(".walk-here-group");
    if (was) { was.parentNode.removeChild(was); }
    if (!walkOn || !roomId || !clod || !clod.where || !clod.m) { return; }
    var byId = {};
    (clod.m.works || []).forEach(function (w) { byId[w.id] = w; });
    var here = (clod.interior.works || []).filter(function (w) {
      return (w.how === "museum" || w.how === "arranged") && w.room === roomId && !w.same;
    });
    if (!here.length) { return; }
    var box = el("section", "walk-here-group");
    box.appendChild(el("p", "held-count held-group", "Here · " + (clod.roomName[roomId] || roomId) + " · " + here.length));
    var cdn = (museums && museums.cdn) || ART_CDN;
    here.forEach(function (iw, i) {
      var w = byId[iw.id] || iw;
      if (!w.i) { return; }
      var key = String(w.i).split("/")[0];
      var fig = heldFigure(w, cdn + key + "/square.jpg", i, false, [cdn + key + "/medium.jpg"],
                           ARTWORKS && w.id ? { history: clod.m } : null);
      fig.dataset.work = w.id;
      walkWhere(fig, w);
      box.appendChild(fig);
    });
    // The reading's card, if walk.js has put one there, stays first.
    var card = window.Walk && window.Walk.here && window.Walk.here();
    buildingWorks.insertBefore(box, card && card.parentNode === buildingWorks ? card.nextSibling : buildingWorks.firstChild);
  }

  // Leaving the museum: out of the walk, and its door let go.
  function walkStop() {
    if (walkOn && window.Walk) { window.Walk.close(); }
    walkOn = false;
    if (buildingEl) { delete buildingEl.dataset.inside; }
    if (tilesCanvas !== tilesHome) { lightInto(null); }
    if (walkGoEl) { walkGoEl.hidden = true; }
    if (walkDoorEl) { walkDoorEl.hidden = true; }
    walkDoorPulses = 0;
    if (window.Walk && window.Walk.forget) { window.Walk.forget(); }
  }

  /* ---- the Archive ---------------------------------------------------------

     After the Austin Museum of Digital Art, whose archive of moving images
     the research the artist shared (23 Sep 2026) ends on as a rabbit hole:
     a place in Austin with a wall of monitors in it, each one playing one
     of the systems this site is made with, live, and saying whose work it
     is after. Pressing a monitor brings it up close with a line about it.
     Every channel is drawn fresh as it plays; none of it is a recording. */

  var archiveEl = document.getElementById("archive");
  var archiveWall = document.getElementById("archive-wall");
  var archiveFoot = document.getElementById("archive-foot");
  var archiveLook = document.getElementById("archive-look");
  var archiveScreen = document.getElementById("archive-screen");
  var archiveTitle = document.getElementById("archive-title");
  var archiveAfter = document.getElementById("archive-after");
  var archiveNote = document.getElementById("archive-note");
  var archiveClose = document.getElementById("archive-close");
  var archiveOn = false;
  var monitors = [];
  var looking = null;
  var MON_W = 128, MON_H = 96;

  function allTones() {
    var out = [];
    Object.keys(measured).forEach(function (k) { out = out.concat(measured[k].slice(0, 2)); });
    return out;
  }

  // The collages' photographs, read once, for the channels that are made of them.
  var photos = [];
  function photo(i) {
    var works = mine ? mine.works : [];
    if (!works.length) { return null; }
    var w = works[((i % works.length) + works.length) % works.length];
    if (!photos[w.slug]) {
      var im = new Image();
      im.src = plateSrc(w);
      photos[w.slug] = im;
    }
    var p = photos[w.slug];
    return p.complete && p.naturalWidth ? p : null;
  }

  function sampleOf(img, cols) {
    var rows = Math.round(cols * 0.75);
    return { data: Systems.sample(img, cols, rows), cols: cols, rows: rows };
  }

  var CHANNELS = [
    { key: "datamatics", title: "datamatics", after: "Ryoji Ikeda, datamatics",
      note: "This site's own numbers as the picture — its works, its places, its words, the time.",
      make: function (c) {
        var g = c.getContext("2d"), bands = [], cut = -1;
        function deal(now) {
          var words = siteNumbers(), y = 0;
          bands = [];
          while (y < c.height) {
            var hh = [1, 2, 2, 3, 4, 6, 8, 12][Math.floor(Math.random() * 8)];
            var h = Systems.hashStr(words[Math.floor(Math.random() * words.length)] || "0");
            bands.push({ y: y, h: hh, kind: Math.random(), bits: h, speed: (Math.random() - 0.5) * 240,
                         word: words[Math.floor(Math.random() * words.length)] || "" });
            y += hh + (Math.random() < 0.3 ? 1 : 0);
          }
          cut = now;
        }
        return { draw: function (now) {
          if (cut < 0 || now - cut > 2600) { deal(now); if (looking && looking.channel.key === "datamatics" && Systems.sound.on) { Systems.sound.data(600); } }
          g.fillStyle = "#000";
          g.fillRect(0, 0, c.width, c.height);
          bands.forEach(function (b) {
            var off = Math.floor(now / 1000 * b.speed);
            if (b.kind < 0.45) {
              g.fillStyle = "#fff";
              for (var x = 0; x < c.width; x += 1) {
                var i = (x + off) & 31;
                if ((b.bits >>> i) & 1) { g.fillRect(x, b.y, 1, b.h); }
              }
            } else if (b.kind < 0.7 && b.h >= 6) {
              g.fillStyle = "#fff";
              g.font = Math.min(b.h, 8) + "px monospace";
              g.fillText(b.word, -((off % 200) + 200) % 200, b.y + Math.min(b.h, 8) - 1);
              g.fillText(b.word, 200 - ((off % 200) + 200) % 200, b.y + Math.min(b.h, 8) - 1);
            } else if (b.kind < 0.85) {
              g.fillStyle = "#fff";
              for (var gx = (off & 3); gx < c.width; gx += 4) { g.fillRect(gx, b.y, 1, 1); }
            }
          });
          g.fillStyle = "#fff";
          g.fillRect(Math.floor((now / 12) % c.width), 0, 1, c.height);
        } };
      } },
    { key: "hallucination", title: "Hallucination", after: "Refik Anadol, Unsupervised",
      note: "The collages' own colours, carried round in a fluid that never settles.",
      make: function (c) {
        var f = new Systems.Hallucination(c, dreamColours(allTones().slice(0, 6)), { cell: 2 });
        return { draw: function () { f.step(1 / 12); f.draw(); } };
      } },
    { key: "synapse", title: "Synapse", after: "GMUNK, Synapse Code",
      note: "A collage's photograph, turned into geometry.",
      make: function (c) {
        var g = c.getContext("2d"), n = Math.floor(Math.random() * 9), s = null, at = 0;
        return { draw: function (now) {
          if (!s || now - at > 7000) {
            var im = photo(n);
            if (im) { s = sampleOf(im, 22); at = now; n += 1; }
          }
          g.fillStyle = "#101018";
          g.fillRect(0, 0, c.width, c.height);
          if (!s) { return; }
          var q = ((now - at) / 7000);
          Systems.synapse(g, s.data, s.cols, s.rows, c.width, c.height, 0.5 + 0.5 * Math.sin(q * TAU), q * 3);
        } };
      } },
    { key: "strata", title: "Strata", after: "Quayola",
      note: "A collage found again by triangles, finer and finer, and lost again.",
      make: function (c) {
        var g = c.getContext("2d"), n = Math.floor(Math.random() * 9), stages = null, at = 0, s = null;
        return { draw: function (now) {
          if (!stages || now - at > 8000) {
            var im = photo(n);
            if (im) {
              s = sampleOf(im, 40);
              stages = Systems.strataStages(s.data, s.cols, s.rows, 8, (Math.random() * 1e9) | 0);
              at = now; n += 1;
            }
          }
          g.fillStyle = "#e7e6e2";
          g.fillRect(0, 0, c.width, c.height);
          if (!stages) { return; }
          var q = (now - at) / 8000, k = Math.min(stages.length - 1, Math.floor(Math.sin(Math.PI * q) * stages.length * 1.2));
          var kx = c.width / s.cols, ky = c.height / s.rows;
          stages[Math.max(0, k)].forEach(function (t) {
            g.fillStyle = t[3];
            g.beginPath();
            g.moveTo(t[0][0] * kx, t[0][1] * ky);
            g.lineTo(t[1][0] * kx, t[1][1] * ky);
            g.lineTo(t[2][0] * kx, t[2][1] * ky);
            g.closePath();
            g.fill();
          });
        } };
      } },
    { key: "primordial", title: "Primordial", after: "Universal Everything, Primordial",
      note: "Cellular life, from nothing but arithmetic: spots that grow, pinch in the middle and divide.",
      make: function (c) {
        var g = c.getContext("2d"), rx = null, born = 0;
        return { draw: function (now) {
          if (!rx || now - born > 40000) { rx = new Systems.Reaction(c.width, c.height, {}); born = now; }
          rx.step(10);
          rx.draw(g, ["#0c0a18", "#2a1c5a", "#5e52c7", "#9d95e6", "#f3f1ee"]);
        } };
      } },
    { key: "motion", title: "Motion Painting", after: "Oskar Fischinger, Motion Painting No. 1",
      note: "Painting given time: a stroke at a time, to a beat, on one sheet of glass after another.",
      make: function (c) {
        var run = null, stopped = false, big = c === archiveScreen;
        function go() {
          if (stopped) { return; }
          run = Systems.motionPainting(c, [], { duration: 16000, onDone: go,
            onBeat: function (n) { if (big) { Systems.sound.beat(n); } } });
        }
        go();
        return { draw: function () {}, stop: function () { stopped = true; if (run) { run.stop(); } } };
      } },
    { key: "infinity", title: "Infinity", after: "Universal Everything, Infinity",
      note: "A procession with no loop in it. No one in it has walked by before.",
      make: function (c) {
        var g = c.getContext("2d"), folk = [], seed = (Math.random() * 1e9) | 0, last = 0;
        g.imageSmoothingEnabled = false;
        return { draw: function (now) {
          var dt = last ? Math.min(0.2, (now - last) / 1000) : 0;
          last = now;
          var ground = Math.round(c.height * 0.84), k = c.width / MON_W;
          // Already under way when it is switched on: the procession did not
          // start because someone looked.
          if (!folk.length) {
            for (var x0 = c.width; x0 > -30 * k; x0 -= (26 + Math.random() * 26) * k) {
              folk.unshift({ p: Systems.person(seed += 1, dreamColours([])), x: x0, phase: Math.random(), gap: (26 + Math.random() * 26) * k });
            }
            folk.reverse();
          }
          if (folk[folk.length - 1].x > folk[folk.length - 1].gap - 30 * k) {
            folk.push({ p: Systems.person(seed += 1, dreamColours([])), x: -30 * k, phase: Math.random(), gap: (26 + Math.random() * 26) * k });
          }
          var sky = g.createLinearGradient(0, 0, 0, ground);
          sky.addColorStop(0, "#e9eaee");
          sky.addColorStop(1, "#efe6e4");
          g.fillStyle = sky;
          g.fillRect(0, 0, c.width, ground);
          g.fillStyle = "#c9c2b8";
          g.fillRect(0, ground, c.width, c.height - ground);
          folk.forEach(function (f) {
            f.x += 12 * k * dt;
            f.phase += 12 * dt / f.p.stride;
            var fr = Math.floor((f.phase % 1) * 8);
            g.drawImage(f.p.day, fr * f.p.fw, 0, f.p.fw, f.p.fh, Math.round(f.x - f.p.groundX * k),
                        Math.round(ground - f.p.groundY * k), f.p.fw * k, f.p.fh * k);
          });
          folk = folk.filter(function (f) { return f.x < c.width + 40 * k; });
        } };
      } },
    { key: "migrations", title: "Migrations", after: "Universal Everything, Migrations",
      note: "Real animals' footfall, lent to bodies nobody has seen, under a sun that goes round in half a minute.",
      make: function (c) {
        var g = c.getContext("2d"), beast = null, since = 0, gi = 0, last = 0, walked = 0;
        var noise = new Systems.Noise((Math.random() * 1e9) | 0);
        var SKY = [[233, 200, 206], [214, 228, 240], [240, 178, 120], [28, 24, 64]];
        g.imageSmoothingEnabled = false;
        return { draw: function (now) {
          var dt = last ? Math.min(0.2, (now - last) / 1000) : 0;
          last = now;
          if (!beast || now - since > 9000) {
            beast = Systems.creature((Math.random() * 1e9) | 0, dreamColours(allTones().slice(0, 3)), Systems.GAITS[gi % Systems.GAITS.length]);
            gi += 1; since = now;
          }
          var day = (now / 32000) % 1, seg = day * 4, i0 = Math.floor(seg), f = seg - i0;
          var a = SKY[i0], b = SKY[(i0 + 1) % 4];
          var sky = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
          g.fillStyle = "rgb(" + sky.map(Math.round).join(",") + ")";
          g.fillRect(0, 0, c.width, c.height);
          var dark = i0 === 3 ? 1 - Math.abs(f - 0.5) * 2 : 0;
          if (dark > 0.3) {
            g.fillStyle = "#f3f1ee";
            for (var s = 0; s < 18; s += 1) { g.fillRect(Math.floor(hash2(s, 1) * c.width), Math.floor(hash2(s, 2) * c.height * 0.5), 1, 1); }
          }
          var sunA = day * TAU - Math.PI / 2;
          g.fillStyle = i0 === 3 ? "#e8ecf6" : "#fff1c4";
          g.fillRect(Math.round(c.width / 2 + Math.cos(sunA) * c.width * 0.4), Math.round(c.height * 0.6 + Math.sin(sunA) * c.height * 0.5), 5, 5);
          var k = c.width / MON_W, speed = beast.speed * k;
          walked += speed * dt;
          [[0.55, 0.35, "#6a6478"], [0.7, 0.7, "#3e3a4a"]].forEach(function (layer) {
            g.fillStyle = layer[2];
            for (var x = 0; x < c.width; x += 1) {
              var hh = noise.fbm((x + walked * layer[1]) / (40 * k), layer[0] * 10, 0, 3) * c.height * 0.5;
              var top = Math.round(c.height * layer[0] + c.height * 0.2 - hh * 0.6);
              g.fillRect(x, top, 1, c.height - top);
            }
          });
          var ground = Math.round(c.height * 0.86);
          g.fillStyle = "#2a2632";
          g.fillRect(0, ground, c.width, c.height - ground);
          beast.phase = (beast.phase || 0) + (beast.gait === "swoop" ? dt * 1.6 : speed * dt / (beast.stride * k));
          var fr = Math.floor((beast.phase % 1) * 8), sh = dark > 0.5 ? beast.night : beast.day;
          g.drawImage(sh, fr * beast.fw, 0, beast.fw, beast.fh, Math.round(c.width / 2 - beast.groundX * k),
                      Math.round(ground - beast.groundY * k), beast.fw * k, beast.fh * k);
        } };
      } },
    { key: "transfiguration", title: "Transfiguration", after: "Universal Everything, Transfiguration",
      note: "The Chorus from Henry V, walking toward you, made of one thing and then another.",
      make: function (c) {
        var g = c.getContext("2d"), back = document.createElement("canvas"), bg = back.getContext("2d");
        var e = null, im = null;
        readPlaybill(function () {
          playbill.scenes.forEach(function (s) { if (s.key === "chorus") { e = s; } });
          if (e) { sheetFor(e, function (loaded) { im = loaded; back.width = e.w; back.height = e.h; }); }
        });
        return { draw: function (now) {
          g.fillStyle = "#e7e6e2";
          g.fillRect(0, 0, c.width, c.height);
          if (!e || !im) { return; }
          var look = Math.floor(now / 1600) % e.looks.length, t = Math.floor(now / 166) % 4;
          bg.clearRect(0, 0, e.w, e.h);
          bg.drawImage(im, 0, 0, e.w, e.h, 0, 0, e.w, e.h);
          var p = e.looks[look][t];
          if (p) { bg.clearRect(p[4], p[5], p[2], p[3]); bg.drawImage(im, p[0], p[1], p[2], p[3], p[4], p[5], p[2], p[3]); }
          var hd = e.heads[0] || [e.w / 2, e.h / 3];
          var cw = c.width * 0.62, ch = c.height * 0.62;
          g.imageSmoothingEnabled = false;
          g.drawImage(back, hd[0] - cw / 2, hd[1] - ch * 0.18, cw, ch, 0, 0, c.width, c.height);
        } };
      } },
    { key: "walking", title: "Walking City", after: "Universal Everything, Walking City",
      note: "The library, standing up on its legs and walking.",
      make: function (c) {
        var g = c.getContext("2d"), back = document.createElement("canvas"), bg = back.getContext("2d");
        var lib = null, im = null;
        readPlaybill(function () {
          lib = playbill.library;
          if (lib) { sheetFor(lib, function (loaded) { im = loaded; back.width = lib.w; back.height = lib.h; }); }
        });
        return { draw: function (now) {
          g.fillStyle = "#e9eaee";
          g.fillRect(0, 0, c.width, c.height);
          if (!lib || !im || !lib.moves) { return; }
          var n = Math.floor(now / 166) % 48, m = lib.moves, p = null;
          if (n >= 6 && n < 9) { p = m.stand[n - 6]; }
          else if (n >= 9 && n < 42) { p = m.walk[(n - 9) % 4]; }
          else if (n >= 42 && n < 45) { p = m.stand[44 - n]; }
          bg.clearRect(0, 0, lib.w, lib.h);
          bg.drawImage(im, 0, 0, lib.w, lib.h, 0, 0, lib.w, lib.h);
          if (p) { bg.clearRect(p[4], p[5], p[2], p[3]); bg.drawImage(im, p[0], p[1], p[2], p[3], p[4], p[5], p[2], p[3]); }
          var top = Math.max(0, (lib.top || 0) - 40), hh = lib.h - top, k = Math.min(c.width / lib.w, c.height / hh);
          g.imageSmoothingEnabled = k < 1;
          g.drawImage(back, 0, top, lib.w, hh, (c.width - lib.w * k) / 2, (c.height - hh * k) / 2, lib.w * k, hh * k);
        } };
      } },
    { key: "external", title: "The External World", after: "David OReilly, The External World",
      note: "Crude, funny, surreal and deeply digital — not trying to look like anything but itself.",
      make: function (c) { return Systems.externalWorld(c); } },
    { key: "polyfauna", title: "PolyFauna", after: "Radiohead and Universal Everything, PolyFauna",
      note: "A small world of primitive life, a landscape and weather, that notices you. Point at it; press it.",
      make: function (c) {
        var world = Systems.polyFauna(c, { colours: dreamColours(allTones().slice(0, 4)) });
        function at(event) {
          var r = c.getBoundingClientRect();
          return [(event.clientX - r.left) / r.width * c.width, (event.clientY - r.top) / r.height * c.height];
        }
        var move = function (event) { var p = at(event); world.point(p[0], p[1]); };
        var out = function () { world.point(null); };
        var down = function (event) { var p = at(event); world.press(p[0], p[1]); };
        c.addEventListener("pointermove", move);
        c.addEventListener("pointerleave", out);
        c.addEventListener("pointerdown", down);
        return { draw: world.draw, stop: function () {
          c.removeEventListener("pointermove", move);
          c.removeEventListener("pointerleave", out);
          c.removeEventListener("pointerdown", down);
        } };
      } }
  ];

  function buildWall() {
    if (monitors.length) { return; }
    CHANNELS.forEach(function (ch, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "monitor";
      b.setAttribute("role", "listitem");
      b.setAttribute("aria-label", ch.title + ", after " + ch.after + ". Press to look closer.");
      b.innerHTML = '<span class="monitor-case"><canvas></canvas></span>' +
                    '<span class="monitor-label"><span class="monitor-title"></span><span class="monitor-after"></span></span>';
      var c = b.querySelector("canvas");
      c.width = MON_W;
      c.height = MON_H;
      b.querySelector(".monitor-title").textContent = ch.title;
      b.querySelector(".monitor-after").textContent = "after " + ch.after;
      b.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        openLook(i, b);
      });
      archiveWall.appendChild(b);
      monitors.push({ el: b, canvas: c, channel: ch, run: null, at: 0 });
    });
  }

  function layoutArchive() {
    if (!archiveOn) { return; }
    var top = 64;
    var br = banner.getBoundingClientRect();
    if (br.height) { top = Math.max(top, br.bottom + 14); }
    var cols = W >= 1100 ? 4 : W >= 700 ? 4 : 3;
    var rows = Math.ceil(CHANNELS.length / cols);
    var roomW = Math.min(W - 32, 1180), roomH = H - top - 40;
    var gap = W >= 700 ? 18 : 10;
    // Each monitor is a case round a 4:3 screen, with two lines under it.
    var label = W >= 700 ? 40 : 34;
    var mw = Math.min((roomW - gap * (cols - 1)) / cols, ((roomH - gap * (rows - 1)) / rows - label) / 0.86);
    mw = Math.max(84, Math.floor(mw));
    archiveWall.style.gridTemplateColumns = "repeat(" + cols + ", " + mw + "px)";
    archiveWall.style.gap = gap + "px";
    archiveWall.style.top = Math.round(top) + "px";
    var wallH = archiveWall.offsetHeight;
    archiveFoot.style.top = Math.round(Math.min(H - 26, top + wallH + 10)) + "px";
    if (looking) {
      var s = Math.max(1, Math.floor(Math.min((W - 64) / archiveScreen.width, (H - 220) / archiveScreen.height) * 2) / 2);
      archiveScreen.style.width = Math.round(archiveScreen.width * s) + "px";
      archiveScreen.style.height = Math.round(archiveScreen.height * s) + "px";
    }
  }

  function archiveFrame(now) {
    if (!archiveOn) { return; }
    requestAnimationFrame(archiveFrame);
    // Twelve frames a second, held, as a wall of old monitors would.
    if (looking) {
      if (now - looking.at >= 83) {
        looking.at = now;
        if (looking.run.draw) { looking.run.draw(now); }
      }
      return;
    }
    monitors.forEach(function (m) {
      if (!m.run || now - m.at < 83) { return; }
      m.at = now;
      if (m.run.draw) { m.run.draw(now); }
    });
  }

  function startArchive() {
    if (!archiveEl || archiveOn || !window.Systems) { return; }
    archiveOn = true;
    buildWall();
    archiveEl.hidden = false;
    layoutArchive();
    // Switched on one after another, down the wall.
    monitors.forEach(function (m, i) {
      window.setTimeout(function () {
        if (!archiveOn) { return; }
        m.run = m.channel.make(m.canvas);
        m.el.classList.add("is-on");
        if (!still) {
          var r = m.canvas.getBoundingClientRect();
          pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT], 0.3, 60);
        }
      }, still ? 0 : 160 + i * 110);
    });
    requestAnimationFrame(archiveFrame);
  }

  function stopArchive() {
    if (!archiveOn) { return; }
    archiveOn = false;
    closeLook();
    monitors.forEach(function (m) {
      if (m.run && m.run.stop) { m.run.stop(); }
      m.run = null;
      m.el.classList.remove("is-on");
    });
    archiveEl.hidden = true;
  }

  function openLook(i, from) {
    closeLook();
    var ch = CHANNELS[i];
    archiveScreen.width = MON_W * 2;
    archiveScreen.height = MON_H * 2;
    looking = { channel: ch, run: ch.make(archiveScreen), at: 0, from: from };
    archiveTitle.textContent = ch.title;
    archiveAfter.textContent = "after " + ch.after;
    archiveNote.textContent = ch.note;
    archiveLook.hidden = false;
    archiveWall.style.visibility = "hidden";
    layoutArchive();
    scramble(archiveTitle, "decode", 0, 600);
    var r = from.getBoundingClientRect();
    pulse(r.left + r.width / 2, r.top + r.height / 2, [LIGHT, LILAC], 0.6, Math.max(W, H) * INV2);
    archiveClose.focus({ preventScroll: true });
  }

  function closeLook() {
    if (!looking) { return; }
    if (looking.run && looking.run.stop) { looking.run.stop(); }
    var from = looking.from;
    looking = null;
    archiveLook.hidden = true;
    archiveWall.style.visibility = "";
    if (from && archiveOn) { from.focus({ preventScroll: true }); }
  }

  if (archiveEl) {
    archiveClose.addEventListener("click", function (event) { event.stopPropagation(); closeLook(); });
    archiveLook.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    archiveFoot.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    archiveLook.addEventListener("click", function (event) { event.stopPropagation(); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && looking) { closeLook(); }
    });
    window.addEventListener("resize", function () { if (archiveOn) { layoutArchive(); } });
  }

  /* ---- sound ---------------------------------------------------------------

     Off until it is asked for, by the switch that comes with the banner in
     any place you go down into. */
  var soundSwitch = document.getElementById("banner-sound");
  if (soundSwitch) {
    soundSwitch.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    soundSwitch.addEventListener("click", function (event) {
      event.stopPropagation();
      if (!window.Systems || !Systems.sound) { return; }
      if (Systems.sound.on) { Systems.sound.stop(); }
      else if (Systems.sound.start()) { Systems.sound.tone(880, 0.12, "sine", 0.3); }
      soundSwitch.setAttribute("aria-pressed", Systems.sound.on ? "true" : "false");
    });
  }

  /* ---- Primordial, while the world is read ------------------------------ */

  var primordialCanvas = document.getElementById("primordial");
  var primordial = null;

  function startPrimordial() {
    if (!primordialCanvas || still || !window.Systems || !Systems.Reaction) { return; }
    var k = 5;
    var w = Math.max(40, Math.round(window.innerWidth / k)), h = Math.max(40, Math.round(window.innerHeight / k));
    primordialCanvas.width = w;
    primordialCanvas.height = h;
    var rx = new Systems.Reaction(w, h, { specks: 1 });
    rx.speck(w / 2, h * 0.5, 4);
    rx.speck(w / 2 + 12, h * 0.5 - 6, 3);
    var g = primordialCanvas.getContext("2d");
    primordial = { rx: rx, run: true };
    (function loop() {
      if (!primordial || !primordial.run) { return; }
      rx.step(12);
      rx.draw(g, ["#000000", "#c9c4e8", "#9d95e6", "#5e52c7"], 0);
      requestAnimationFrame(loop);
    })();
  }

  function stopPrimordial() {
    if (!primordial) { if (primordialCanvas) { primordialCanvas.remove(); } return; }
    primordialCanvas.classList.add("is-gone");
    window.setTimeout(function () {
      if (primordial) { primordial.run = false; }
      primordial = null;
      primordialCanvas.remove();
    }, 700);
  }

  startPrimordial();

  /* ---- the table: every collage, or the ones a word is written on ------- */

  function dealTable() {
    var host = deckTable;
    var pool = poolOf(host);
    var width = deck.clientWidth || W;
    var height = deck.clientHeight || H;
    var works, groups = [];

    if (deckMode === "all") {
      works = mine.works;
      groups.push(loose(host, pool, "name", "deal-name", function (el) {
        el.textContent = mine.artist || "";
      }, 200, Math.min(width - 2 * GAP, 640)));
      if (mine.lede) {
        groups.push(loose(host, pool, "lede", "deal-lede", function (el) {
          el.textContent = mine.lede;
        }, 160, Math.min(width - 2 * GAP, 360)));
      }
      if (mine.statement) {
        groups.push(loose(host, pool, "statement", "deal-statement", function (el) {
          el.textContent = mine.statement;
        }, Math.min(width - 2 * GAP, 300), Math.min(width - 2 * GAP, 560), LONG));
      }
      if (mine.email) {
        groups.push(loose(host, pool, "email", "deal-email", function (el) {
          el.textContent = "";
          var a = document.createElement("a");
          a.href = "mailto:" + mine.email;
          a.textContent = mine.email;
          a.addEventListener("click", function (event) { event.stopPropagation(); });
          el.appendChild(a);
        }, 120, 400));
      }
    } else {
      var ground = deckWord;
      works = ground.works;
      groups.push(loose(host, pool, "word", "deal-word", function (el) {
        el.textContent = ground.word;
      }, 120, Math.min(width - 2 * GAP, 640)));
      groups.push(loose(host, pool, "count", "deal-count", function (el) {
        el.textContent = works.length + (works.length === 1 ? " work" : " works");
      }, 60, 200));
    }

    // The close control, in the corner, is kept clear.
    var clear = [{ x: width - 64, y: 0, w: 64, h: 64 },
                 { x: width - 180, y: 0, w: 180, h: 60 }];
    var base = Math.min(width * 0.62, height * 0.5);

    works.forEach(function (work) {
      var city = cityOf(work.slug);
      var long = base * between(0.62, 1);
      var made = null;
      for (var shrink = 0; shrink < 6; shrink += 1) {
        var things = [platePiece(host, pool, work, city, long, function () {
          visit(work.slug);
        })].concat(captionOf(host, pool, work, city, { vote: true }));
        made = cluster(things, width - 2 * GAP);
        made.plate = true;
        if (made.w <= width - 2 * GAP) { break; }
        long *= 0.8;
      }
      groups.push(made);
    });

    // The name, or the word, and one collage, are on the first screen; the
    // rest go anywhere.
    var lead = groups.shift();
    var rest = shuffled(groups);
    var pick_ = null;
    for (var q = 0; q < rest.length && !pick_; q += 1) {
      if (rest[q].plate && lead.h + rest[q].h + 3 * GAP < height) { pick_ = rest.splice(q, 1)[0]; }
    }
    lead.first = true;
    if (pick_) { pick_.first = true; }
    groups = [lead].concat(pick_ ? [pick_] : [], rest);
    retire(pool);
    var tall = scatter(groups, width, height, clear, true) || height;
    host.style.height = Math.round(tall) + "px";
    setDown(groups);
  }

  function openDeck(mode, index) {
    if (!mine) { return; }
    deckMode = mode;
    deckWord = mode === "word" ? vocabulary[index] : null;
    deck.dataset.mode = mode;
    // A word's collages are laid over the world, and the world behind them
    // goes out of focus, gritty and soft, as if you had leaned in to it.
    document.body.dataset.deck = mode;
    deck.hidden = false;
    deck.scrollTop = 0;
    // A new table each time it is opened: what was on it is cleared off.
    retire(poolOf(deckTable));
    dealTable();
    deckClose.focus();
    dream(mode === "word" && Math.random() < 0.5 ? deckWord : null);
    passage(oneOf(["rows", "corner", "center"]), [LIGHT, LILAC, GOLD]);
  }

  function closeDeck() {
    if (!deckMode) { return; }
    var was = deckMode;
    deckMode = null;
    deckWord = null;
    deck.hidden = true;
    delete document.body.dataset.deck;
    retire(poolOf(deckTable));
    dream(null);
    if (!flying) { passage(oneOf(["rows", "corner"]), [LIGHT, LILAC]); }
  }

  /* ---- a collage in its own city ---------------------------------------- */

  function dealHere() {
    var host = hereLayer;
    var pool = poolOf(host);
    var work = place && place.work;
    if (!work || !hereShown) { clearReading(); retire(pool); hereLayer.hidden = true; return; }
    hereLayer.hidden = false;
    if (READING) {
      // At its site a collage is read, not dealt (see "the reading").
      retire(pool);
      if (reading && reading.work === work) { layoutReading(); } else { readHere(work, place); }
      return;
    }

    // Keep clear of the banner, the corner, and wherever the creature is
    // standing, so the collage lands beside what is going on rather than on
    // top of it.
    var clear = [{ x: W - 180, y: 0, w: 180, h: 60 }];
    [banner, creature].forEach(function (el) {
      if (!el || el.hidden) { return; }
      var r = el.getBoundingClientRect();
      if (!r.width) { return; }
      var pad = el === creature ? 0 : 8;
      clear.push({ x: r.left - pad, y: r.top - pad,
                   w: r.width + 2 * pad, h: r.height + 2 * pad });
    });

    var long = Math.min(H * 0.64, W * 0.9) * between(0.84, 1.04);
    var groups = null;
    for (var attempt = 0; attempt < 12 && !groups; attempt += 1) {
      var away = piece(host, pool, "away", function () {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "deal-text deal-away";
        b.textContent = "Put it away";
        b.addEventListener("click", function (event) {
          event.stopPropagation();
          showHere(false);
        });
        return b;
      });
      var things = [platePiece(host, pool, work, place, long, redeal)]
        .concat(captionOf(host, pool, work, place, { vote: true }), [measure(away)]);
      var made = cluster(things, W - 2 * GAP, H - 2 * GAP);
      var fits = made.w <= W - 2 * GAP && made.h <= H - 2 * GAP;
      // After a few tries it may go over the creature; it may not go off
      // the screen.
      if (fits && scatter([made], W, H, attempt < 4 ? clear : clear.slice(0, 1), false)) {
        groups = [made];
      } else {
        long *= 0.92;
      }
    }
    retire(pool);
    if (groups) { setDown(groups); }
  }

  function showHere(on) {
    if (on && hereShown && reading) { clearReading(); }    // the banner's name reads it again
    hereShown = on;
    dealHere();
    bannerCity.setAttribute("aria-pressed", on ? "true" : "false");
  }

  /* ---- the reading: a collage at its own site ---------------------------

     The artist, 23 Sep 2026: the words that describe what the collages are
     made of come off the globe and work once you are at a collage's site,
     and the presentation of a collage "has to be very, very specific,
     transformational, and elegant. Things don't have to move very fast …
     timing is everything, and having the right word pop up at the right
     time can be far more powerful than having all the words pop up at once."

     So at its site a collage is not dealt. It is read, in an order:

       the photograph, uncovered;
       its title and year; then where it is; then what it is and how big;
       then its price —

     and then its words, one at a time, each given the room to itself for a
     few seconds: first what only this collage has, then what it shares, the
     most widely shared last. A word that other collages share shows them
     under it, small; they are doors. Pressing a word keeps it and turns
     the page towards it — the photograph steps back, the collages that
     share the word come forward with their names — and pressing one of
     those flies to it. There the word you came by is the first thing said,
     so a visit can be a walk from collage to collage by what they are made
     of. When all the words have had their turn they stay, small, in a
     line, to be pressed again. The notes and the vote come last. */

  var READING = true;                 // false: dealt at random, as before
  var READ_BEAT = 1097;               // --beat-5
  /* The pacing (artist, 23 Sep 2026: "give the viewer a little bit of time,
     perhaps even 30 seconds to a minute ... before new information is
     introduced"), set from research on how long people really look at a
     work — Smith & Smith 2001 (the Met: median 17 s, mean 27 s), Smith,
     Smith & Tinio 2017 (median 21 s), Carbon 2017 (median 25 s) — and on
     slow looking (Tishman; Slow Art Day; Sarraf & Chatterjee 2025).
     Who it is comes in over the first half-minute; the first thing it is
     made of waits until 30 s, just past where an unguided glance would have
     moved on, so the looking has turned deliberate; then each word waits
     longer than the last (22, 30, 40 s), slowing into stillness rather than
     hurrying. The clock only moves while the viewer is still, so words
     arrive during looking, not fidgeting; pressing or turning never waits. */
  var OPEN_AT = [4000, 9000, 16000, 24000];   // title, place, medium and size, price
  var FIRST_WORD_AT = 30000;
  var WORD_GAP = 22000, WORD_GAP_GROW = 1.35, WORD_GAP_MAX = 40000;
  var STILL_MS = 1500;                // still: the pointer has not moved for this long
  var reading = null;                 // what is laid out at this site, and its clock
  var cameBy = null;                  // the word a visit arrived by

  function sharers(term, work) {
    return mine.works.filter(function (w) {
      return w !== work && (w.terms || []).indexOf(term) >= 0 && cityOf(w.slug);
    });
  }

  function wordOrder(work, via) {
    var list = (work.terms || []).slice().map(function (t, i) {
      return { word: t, n: sharers(t, work).length, i: i };
    });
    list.sort(function (a, b) { return a.n - b.n || a.i - b.i; });
    if (via) {
      list = list.filter(function (x) { return x.word === via; })
        .concat(list.filter(function (x) { return x.word !== via; }));
    }
    return list.map(function (x) { return x.word; });
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.textContent = text; }
    return e;
  }

  function clearReading() {
    if (!reading) { return; }
    reading.live = false;
    reading.timers.forEach(function (t) { window.clearTimeout(t); });
    if (reading.root.parentNode) { reading.root.parentNode.removeChild(reading.root); }
    reading = null;
  }

  // One clock for the reading and the art view: each belongs to an owner
  // (the reading, unless another is given) and stops when it is put away.
  function later(fn, ms, r) {
    r = r || reading;
    if (!r) { return; }
    var t = window.setTimeout(function () { if (r.live) { fn(); } }, still ? 0 : ms);
    r.timers.push(t);
  }

  function reveal(node, ms, r) {
    later(function () { node.dataset.on = "true"; }, ms, r);
  }

  // Like later(), but the clock only moves while the viewer is still: if the
  // pointer moved within STILL_MS when it comes due, it waits for them to
  // settle. Under reduced motion nothing waits at all.
  function afterStill(fn, ms, r) {
    r = r || reading;
    if (!r) { return; }
    function tick() {
      if (!r.live) { return; }
      var moved = performance.now() - pointerAt.at;
      if (!still && moved < STILL_MS) {
        r.timers.push(window.setTimeout(tick, STILL_MS - moved + 80));
        return;
      }
      fn();
    }
    r.timers.push(window.setTimeout(tick, still ? 0 : ms));
  }

  function readHere(work, city) {
    clearReading();
    var via = cameBy;
    cameBy = null;
    var root = el("div", "read");
    root.appendChild(el("div", "read-wash"));
    var r = reading = { root: root, work: work, city: city, timers: [], held: null, n: 0, live: true };
    r.order = wordOrder(work, via);

    // the photograph
    var pool = { els: {}, used: {} };
    var plate = platePiece(root, pool, work, city, 100, function () {
      if (r.held) { release(); }
    }).el;
    plate.classList.add("read-plate");
    r.plate = plate;

    // the caption, a line at a time
    var cap = el("div", "read-cap");
    var title = el("h2", "read-title");
    title.appendChild(el("em", "", work.title));
    var year = el("span", "read-year", String(work.year || ""));
    title.appendChild(year);
    var where = el("p", "read-where", city.where || "");
    var detail = el("p", "read-detail", workLine(work));
    var price = el("p", "read-price", work.availability || "");
    [title, where, detail, price].forEach(function (n) { cap.appendChild(n); });
    var col = el("div", "read-col");
    root.appendChild(col);
    r.col = col;
    col.appendChild(cap);

    // the word that has the room, and the doors under it
    var stageW = el("div", "read-stage");
    stageW.setAttribute("aria-live", "polite");
    col.appendChild(stageW);
    r.stage = stageW;

    // the words, once they have all had their turn
    var line = el("div", "read-words");
    line.setAttribute("aria-label", "What " + work.title + " is made of");
    r.order.forEach(function (w) {
      var b = el("button", "read-w", w);
      b.type = "button";
      b.addEventListener("click", function (event) { event.stopPropagation(); hold_(w); });
      line.appendChild(b);
    });
    col.appendChild(line);
    r.line = line;

    // last, and quiet: the notes, the vote, putting it away
    var foot = el("div", "read-foot");
    ((mine.notes && mine.notes[work.category]) || []).forEach(function (t) {
      foot.appendChild(el("p", "read-note", t));
    });
    (work.writings || []).forEach(function (wr) {
      var q = el("p", "read-writing", wr.text || String(wr));
      if (wr.by) { q.appendChild(el("span", "read-by", wr.by)); }
      foot.appendChild(q);
    });
    var v = mine.vote || {};
    var controls = el("div", "read-controls");
    if (v.formId && work.category === "Collage") {
      var ballot = el("button", "read-quiet", voted(work.title) ? (v.thanks || "Recorded") : (v.prompt || "Prefer this orientation?"));
      ballot.type = "button";
      ballot.disabled = !!voted(work.title);
      ballot.addEventListener("click", function (event) {
        event.stopPropagation();
        vote(work);
        ballot.textContent = v.thanks || "Recorded";
        ballot.disabled = true;
      });
      controls.appendChild(ballot);
    }
    var away = el("button", "read-quiet", "Put it away");
    away.type = "button";
    away.addEventListener("click", function (event) { event.stopPropagation(); showHere(false); });
    controls.appendChild(away);
    foot.appendChild(controls);
    col.appendChild(foot);
    r.foot = foot;

    hereLayer.appendChild(root);
    plate.style.transition = "none";
    layoutReading();
    plate.getBoundingClientRect();
    delete plate.dataset.fresh;
    requestAnimationFrame(function () { plate.style.transition = ""; root.dataset.on = "true"; });

    // the clock
    if (!still) { pixelIn(plate, 0); }
    plate.dataset.on = "true";
    // The photograph first, alone; then who it is, over the first half-minute.
    reveal(title, OPEN_AT[0]);
    reveal(where, OPEN_AT[1]);
    reveal(detail, OPEN_AT[2]);
    if (work.availability) { reveal(price, OPEN_AT[3]); }
    // Arrived by a word, that word is the thread you came along: it is said
    // once the photograph has settled, before anything else it is made of.
    if (via) { later(function () { say_(via, true); }, 2000); }
    r.n = via ? 1 : 0;
    r.gap = WORD_GAP;
    afterStill(procession, FIRST_WORD_AT);
  }

  // The words go by one at a time, then settle into their line.
  function procession() {
    var r = reading;
    if (!r || r.held) { return; }
    if (r.n >= r.order.length) {
      quiet();
      r.line.dataset.on = "true";
      reveal(r.foot, READ_BEAT);
      return;
    }
    say_(r.order[r.n], false);
    r.n += 1;
    var gap = r.gap;
    r.gap = Math.min(WORD_GAP_MAX, r.gap * WORD_GAP_GROW);   // each waits longer than the last
    afterStill(procession, gap);
  }

  // Everything said is put down, not only the last: under reduced motion the
  // words used to pile up, each said before the one before had gone.
  function quiet(r) {
    r = r || reading;
    if (!r || !r.stage) { return; }
    Array.prototype.forEach.call(r.stage.children, function (old) {
      if (old.dataset.on === "false") { return; }
      old.dataset.on = "false";
      window.setTimeout(function () { if (old.parentNode) { old.parentNode.removeChild(old); } }, still ? 0 : 700);
    });
  }

  // A word takes the room: the word, and under it whatever else it is in.
  function say_(word, keep) {
    var r = reading;
    if (!r) { return; }
    quiet();
    var box = el("div", "read-said");
    var w = el("p", "read-word", word);
    box.appendChild(w);
    var others = sharers(word, r.work);
    if (others.length) {
      var doors = el("div", "read-doors");
      others.forEach(function (o, i) {
        var c = cityOf(o.slug);
        var d = el("button", "read-door");
        d.type = "button";
        d.setAttribute("aria-label", o.title + ", " + (c.where || "") + " — also " + word);
        var img = el("img");
        img.src = plateSrc(o);
        img.alt = "";
        img.decoding = "async";
        d.appendChild(img);
        d.appendChild(el("span", "read-door-t", o.title));
        d.style.transitionDelay = (still ? 0 : 520 + i * 140) + "ms";
        d.addEventListener("click", function (event) {
          event.stopPropagation();
          cameBy = word;
          visit(o.slug);
        });
        doors.appendChild(d);
      });
      box.appendChild(doors);
    } else {
      box.appendChild(el("p", "read-only", "only here"));
    }
    r.stage.appendChild(box);
    box.getBoundingClientRect();
    requestAnimationFrame(function () { box.dataset.on = "true"; });
    Array.prototype.forEach.call(r.line.children, function (b) {
      b.setAttribute("aria-pressed", b.textContent === word && keep ? "true" : "false");
    });
    // the pixel light answers it, where it is said, in the collage's colour
    var at = r.stage.getBoundingClientRect();
    if (at.width && !still) { pulse(at.left + 30, at.top + 24, [cityTone(r.city), LIGHT], 0.35, 90); }
  }

  // Pressed, a word stays, and the collage steps back behind it.
  function hold_(word) {
    var r = reading;
    if (!r) { return; }
    if (r.held === word) { release(); return; }
    r.held = word;
    r.root.dataset.held = "true";
    say_(word, true);
  }

  function release() {
    var r = reading;
    if (!r) { return; }
    r.held = null;
    delete r.root.dataset.held;
    Array.prototype.forEach.call(r.line.children, function (b) { b.setAttribute("aria-pressed", "false"); });
    quiet();
    if (r.n < r.order.length) { afterStill(procession, READ_BEAT); }
  }

  /* The composition: the photograph large on one side, the reading beside
     it; on a narrow screen, one above the other. Which side is the
     collage's own (it is always the same for the same collage), and the
     photograph is as big as the room allows. */
  /* An arrangement is dealt from the work and its quarter-turn, so it is steady
     while you read but re-dealt on every turn: a different side, a different
     size, standing somewhere new. Turning back returns to the one before. It
     reuses the seeded RNG the world is woven with (seedFrom, defined above). */
  function layoutReading() {
    var r = reading;
    if (!r) { return; }
    var pad = W < 640 ? 21 : 55;
    var a = aspectOf[r.work.slug] || 0.75;
    var turns = turnsFor(r.work.slug);
    var turned = turns % 2 === 1;
    var shown = turned ? 1 / a : a;                   // width over height, as hung
    var wide = W >= 760 && W > H * 0.9;
    // A phone scrolls it, so it starts below the banner and never runs over it.
    r.root.style.top = wide ? "0px" : "68px";
    var top = wide ? 84 : 13;

    var rnd = seedFrom(r.work.slug, turns + 1);
    var side = rnd() < 0.5;                            // which side the photograph takes
    var sizeK = 0.80 + rnd() * 0.20;                   // not always at full size
    var slackX = rnd(), slackY = rnd();

    var colW = wide
      ? Math.round(Math.min(400, Math.max(250, W * (0.26 + rnd() * 0.08))))
      : W - 2 * pad;
    var bw, bh;
    if (wide) {
      bh = Math.min(H - top - 55, (W - 3 * pad - colW) / shown) * sizeK;
      bw = bh * shown;
    } else {
      bw = Math.min(W - 2 * pad, (H * 0.44) * shown) * (0.90 + sizeK * 0.10);
      bh = bw / shown;
    }
    // platePiece sizes the box from its long side as the photograph is, before turning.
    var longUnturned = turned ? (a <= 1 ? bw : bh) : (a <= 1 ? bh : bw);
    platePiece(r.root, { els: pool_(r), used: {} }, r.work, r.city, longUnturned, function () {
      if (r.held) { release(); }
    });

    var px, py, cx0, cy0;
    if (wide) {
      var total = bw + pad + colW;
      var freeX = Math.max(0, W - total - 2 * pad);
      var left = pad + freeX * slackX;
      var freeY = Math.max(0, H - top - 34 - bh);
      var driftY = Math.min(90, freeY * (0.12 + 0.4 * slackY));
      py = top + driftY;
      if (side) { px = left; cx0 = left + bw + pad; } else { cx0 = left; px = left + colW + pad; }
      cy0 = top + Math.min(driftY, freeY * 0.5);
    } else {
      var freeXt = Math.max(0, W - 2 * pad - bw);
      px = pad + freeXt * slackX; py = top; cx0 = pad; cy0 = py + bh + 21;
    }
    // The first time it is laid out it does not slide in; a turn after that
    // eases everything across to its new place.
    if (!r.laidOut) { r.col.style.transition = "none"; }
    r.plate.style.transform = "translate(" + px.toFixed(1) + "px," + py.toFixed(1) + "px)";
    r.col.style.left = cx0.toFixed(1) + "px";
    r.col.style.top = cy0.toFixed(1) + "px";
    r.col.style.width = colW.toFixed(1) + "px";
    r.root.dataset.shape = wide ? "wide" : "tall";
    r.root.dataset.side = side ? "right" : "left";
    if (!r.laidOut) { r.col.getBoundingClientRect(); r.col.style.transition = ""; r.laidOut = true; }
  }

  function pool_(r) {
    var o = {};
    o[r.work.slug + ":plate"] = r.plate;
    return o;
  }

  /* ---- going anywhere is going somewhere on this page -------------------

     The address never changes. There is one page and one link to it, and
     wherever you go on it — a city, the collages — the address bar still
     says the same thing. */

  function visit(slug) {
    var city = cityOf(slug);
    if (!city) { return; }
    closeDeck();
    if (flying) { bound = city; return; }
    if (place && place.slug === city.slug) { showHere(true); return; }
    bound = city;
    if (place) { comeUp(); } else { onward(); }
  }

  /* Called whenever a flight comes to rest: if somewhere else was asked
     for on the way, carry on there. */
  function onward() {
    if (!bound) { return; }
    if (place && place.slug !== bound.slug) { comeUp(); return; }
    if (!place) { var to = bound; bound = null; goDown(to); return; }
    bound = null;
  }

  function redeal() {
    if (deckMode) { dealTable(); }
    if (place && hereShown) { dealHere(); }
  }

  /* An old link to the works page still arrives with a mark on the end of
     it saying which collage it meant. It is honoured once, and then taken
     off, so the address is the one link again. */
  function followHash() {
    var hash = decodeURIComponent((location.hash || "").slice(1));
    if (!hash) { return; }
    if (window.history && history.replaceState) {
      try { history.replaceState(null, "", location.pathname + location.search); } catch (e) {}
    }
    if (hash === "collages" || hash === "works") { openDeck("all"); return; }
    if (cityOf(hash)) { visit(hash); }
  }

  deck.addEventListener("click", function (event) {
    // Anything on the table that is not a control deals it again.
    if (event.target.closest("a, button")) { return; }
    dealTable();
  });

  hereLayer.addEventListener("click", function (event) {
    if (event.target.closest("a, button")) { return; }
    if (READING) { return; }
    if (event.target !== hereLayer) { dealHere(); }
  });

  deckClose.addEventListener("click", function () { closeDeck(); });

  bannerCity.addEventListener("click", function () {
    if (!place || !place.work) { return; }
    showHere(true);
  });

  hereLayer.addEventListener("pointerdown", function (event) { event.stopPropagation(); });

  window.addEventListener("resize", function () {
    window.clearTimeout(redealTimer);
    redealTimer = window.setTimeout(redeal, 200);
  });
  var redealTimer = null;

  /* ---- what a word is standing on: the artist's works -------------------- */

  function openSeam(index) {
    var ground = vocabulary[index];
    if (!ground) { return; }

    // Opening a word used to send the creature to stand on it as well. The
    // creature is not up here any more, so on the globe a word is a word: it
    // opens what it is written on, and nothing walks anywhere.
    if (place && CREATURE) {
      hold();
      standOn(index);
      walkTimer = window.setTimeout(function () {
        creature.dataset.grazing = "true";
        walkTimer = window.setTimeout(walk, GRAZE_MAX);
      }, still ? 1 : 1800);
    }

    if (ground.el) {
      var wr = ground.el.getBoundingClientRect();
      pulse(wr.left + wr.width / 2, wr.top + wr.height / 2, [LIGHT], 0.9);
    }
    closeDeck();
    openDeck("word", index);
  }

  bannerBack.addEventListener("click", function () { comeUp(true); });

  /* ---- down: DIRT Earth ------------------------------------------------

     The globe is DIRT Earth's globe, so going down into a place does not
     stop at the city: Closer (or scrolling or pinching further in) goes on
     into DIRT Earth itself at that place, this month, with everything that
     lives and grows there, and further in again to its streets, every
     building standing at its height. DIRT's own Globe button, or going back
     out past its ground, comes back up here. The page is dirt/index.html,
     the site's edition of DIRT: its soil is this globe's own dots, and no
     painting is in it but as its three colours. */
  var groundDirt = document.getElementById("ground-dirt");
  var groundFrame = document.getElementById("ground-dirt-frame");
  var bannerDown = document.getElementById("banner-down");
  var groundOn = false;             // DIRT Earth up, to fly over by hand
  var groundLoaded = false;
  var groundAtWas = "";
  var downPush = 0;

  /* The ground at a place: loaded the first time, told where to go after. */
  function groundAt(lat, lon, streets) {
    var month = new Date().getMonth();
    var key = lat.toFixed(4) + "," + lon.toFixed(4);
    if (!groundFrame.src) {
      groundFrame.src = "dirt/index.html#earth=" + key + "," + (month + 1);
    } else if (key !== groundAtWas || streets) {
      groundFrame.contentWindow.postMessage({ dirt: "goto", lat: lat, lon: lon, month: month, streets: !!streets }, "*");
    }
    groundAtWas = key;
  }
  function groundSay(message) {
    if (groundLoaded) { groundFrame.contentWindow.postMessage(message, "*"); }
  }
  /* Every place the globe is showing, for the ground to carry as marks:
     whichever layer the filter has on. On Museums, the ground is near
     enough for the museums themselves (and the Folger) to stand for their
     cities; a busy city of galleries is its own mark. */
  function groundPlaces() {
    groundSay({ dirt: "places", list: cities.filter(function (c) {
      if (layerOn === "museums" && c.layer === "museums") { return !!(c.museum || c.stage || (c.town && c.tile)); }
      return !c.off;
    }).map(function (c) {
      return { id: c.slug, lat: c.lat * 180 / Math.PI, lon: wrap(c.lon) * 180 / Math.PI,
               name: c.title, kind: c.town ? "place" : c.el ? c.el.dataset.kind : "work" };
    }) });
  }
  groundFrame.addEventListener("load", function () {
    groundLoaded = true;
    // A dive under way asks what the atlas calls its aim.
    if (aimName && aimName.dataset.key && !aimName.hidden) { delete aimName.dataset.key; }
    groundPlaces();
    groundSay({ dirt: "chrome", on: groundOn });
  });

  /* DIRT Earth to fly over — swipe to cross the ground, the site's places on
     it as marks and the nearest off the screen pointed to from its top;
     pressing one opens it. Reached by gesture, never by a button (artist, 24
     Sep 2026: "I want to be able to gesture different touches on my device to
     move between those levels of perspective"): pinching on past the globe's
     nearest, or on in a place; pinching in comes back up. */
  function groundUp(lat, lon, streets) {
    groundAt(lat, lon, streets);
    groundDirt.hidden = false;
    groundOn = true;
    groundSay({ dirt: "chrome", on: true });
    groundPlaces();
    window.requestAnimationFrame(function () { groundDirt.classList.add("on"); groundFrame.focus(); });
  }
  function goDeeper(streets, x, y) {
    if (walkOn) { window.Walk.down(x, y); return; }
    if (WALK && place && place.museum && clod && clod.view === "building" && clod.interior && !flying && !groundOn) {
      enterWalk({});
      return;
    }
    if (!place || flying || groundOn) { return; }
    // In an art view, down is at the stop the slider is at.
    var at = place.art && art ? art.stopNow() : place;
    groundUp(at.lat * 180 / Math.PI, wrap(at.lon) * 180 / Math.PI, streets);
  }
  function flyOver(x, y) {
    if (flying || place || groundOn) { return; }
    var at = unproject(x === undefined ? W / 2 : x, y === undefined ? H / 2 : y) || unproject(W / 2, H / 2) || { lat: tilt, lon: spin };
    groundUp(at.lat * 180 / Math.PI, wrap(at.lon) * 180 / Math.PI, false);
  }

  /* The globe by keys (WCAG 2.1.1; a11y.js gives the globe a place in the tab
     order and sends its keys here): ← → turn it, ↑ ↓ roll it north and south,
     + and − bring it nearer and farther (past the nearest, "+" goes down into
     the ground, as it did), Enter or Space opens the shown place nearest the
     middle. Up on the world only; anywhere else the keys are the view's own. */
  function globeKey(key) {
    // A city's skyline (skyline.js): ← → turn it a quarter, + − nearer and farther, past the ends a level.
    if (skyOn() && Skyline.key && Skyline.key(key)) { return true; }
    // A city's map (a city view): the arrows move it as a finger does, 48 px a press.
    if (cityMap() && /^Arrow/.test(key)) {
      var m = 48;
      cityPan(key === "ArrowLeft" ? m : key === "ArrowRight" ? -m : 0, key === "ArrowUp" ? m : key === "ArrowDown" ? -m : 0);
      return true;
    }
    if (cityMap() && (key === "+" || key === "=")) { if (!cityStepBy(ZOOM_STEP)) { goDeeper(false); } return true; }
    if (cityMap() && (key === "-" || key === "_")) { if (!cityStepBy(1 / ZOOM_STEP)) { comeUp(); } return true; }
    if (place || flying || groundOn || deckMode) { return false; }
    var now = performance.now();
    if (/^Arrow/.test(key)) {
      settleSwing();
      var step = 0.16 / Math.max(0.6, seat.size);
      if (key === "ArrowLeft") { wanted = spin + step; }
      else if (key === "ArrowRight") { wanted = spin - step; }
      else if (key === "ArrowUp") { lean(tilt + step * 0.62); }
      else { lean(tilt - step * 0.62); }
      handledAt = lastTouch = now;
      return true;
    }
    if (key === "+" || key === "=") {
      if (seat.size >= SIZE_MOST - 1e-6) { flyOver(); return true; }
      settleSwing();
      handle(seatAbout(W / 2, H / 2, Math.min(SIZE_MOST, seat.size * 1.25)));
      return true;
    }
    if (key === "-" || key === "_") {
      settleSwing();
      handle(seatAbout(W / 2, H / 2, Math.max(SIZE_FAR * INV, seat.size / 1.25)));
      return true;
    }
    if (key === "Enter" || key === " ") {
      var best = null, bd = Infinity;
      cities.forEach(function (c) {
        if (!c.el || !c.el.isConnected || !c.el.firstChild) { return; }
        var cs = getComputedStyle(c.el);
        if (cs.visibility !== "visible" || cs.display === "none" || Number(cs.opacity) < 0.05) { return; }
        var r = c.el.firstChild.getBoundingClientRect();
        if (!r.width && !r.height) { return; }
        var dx = r.left + r.width / 2 - W / 2, dy = r.top + r.height / 2 - H / 2, d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = c; }
      });
      if (!best) { return false; }
      best.el.click();
      return true;
    }
    return false;
  }

  /* The dive: from the globe's nearest — or from any view where the globe is
     seen from far off, the small globe of a work's history among them —
     spreading two fingers (or scrolling, or a trackpad's pinch) on in
     carries you down into the ground of DIRT Earth. The artist, 1 Oct 2026:
     "I want to further explore that's extreme zoom in from the globe at a
     distance and then up close instantly to an aspect of the Earth. I want
     to make it a bit smoother and a bit more controlled … there to be some
     sort of control that is can be done by the viewer to pick specifically
     where they are looking to perhaps it's not as extreme."

     Aimed: the place it will land is ringed in pixel light the moment a dive
     begins, and named (what DIRT Earth's atlas calls it, and the nearest of
     the site's cities); the ring is the point between the fingers, and
     moving the fingers together carries it across the world before you are
     committed. A tap on the globe first sets it (the first tap rings and
     names the spot; spreading then dives there, wherever the fingers are).
     With a mouse the pointer is the aim.

     Smooth: the world itself is drawn nearer, in log space, about the aim,
     which stays under the fingers — the body of works sharpening as it
     comes — and the ground comes up into it through a lens, the same size
     as the world it lies in and at the same place, never a cut. Let go past
     half way and it carries on down; short of it, the world springs back.

     Less extreme: the last of the way down is slow, so the region is seen
     whole before the ground settles at DIRT Earth's own scale, which is its
     widest; spreading again goes closer, to the streets, as before. */
  var dive = { log: 0, p: 0, on: false, fx: 0, fy: 0, ax: 0, ay: 0, timer: 0, aim: null, from: null,
               Rg: 0, settle: null, sent: "", sentAt: 0, named: "", tidy: 0, raw: 0 };
  var DIVE_SPAN = Math.log(PHI * PHI);          // a further phi-squared of pinch is as far as the hand goes
  var DIVE_HAND = 0.75;                         // and that is three quarters of the way down
  var AIM_KEEP = Math.pow(PHI, 5) * 1000;      // a tapped aim is kept 11 s
  var aimTap = null;                            // { lat, lon, at }: the spot a tap set
  var aimEl = null, aimName = null, aimRing = null;
  var LN_PHI = Math.log(PHI);

  /* How big the world is when it is drawn at the ground's own scale: DIRT
     Earth lays 932 cells to a degree, 2 device pixels a cell, so a degree is
     1864 device pixels; the globe's is R·π/180 CSS pixels. */
  function groundR() { return 1864 * 180 / Math.PI / (window.devicePixelRatio || 1); }
  /* Whether a dive is the way down from here: the world seen from far enough
     off that the ground is well nearer (in a city of museums, framed nearer
     than the ground, down is to the ground at the city, as before). */
  function diveCan() {
    if (flying || groundOn || deckMode || walkOn) { return false; }
    if (place && (place.museum || place.stage || buildingOn)) { return false; }
    return R > 0 && R < groundR() * INV2;
  }

  function aimSetup() {
    if (aimEl) { return; }
    aimEl = document.createElement("div");
    aimEl.className = "dive-aim";
    aimEl.hidden = true;
    aimEl.setAttribute("aria-hidden", "true");
    aimRing = document.createElement("canvas");
    aimRing.className = "dive-aim-ring";
    aimName = document.createElement("p");
    aimName.className = "dive-aim-name";
    aimName.setAttribute("aria-live", "polite");
    aimEl.appendChild(aimRing);
    land.appendChild(aimEl);
    land.appendChild(aimName);
    aimName.hidden = true;
  }
  /* The ring: the 13 px tiles of the pixel light round the point, on the
     screen's own grid, three brightnesses by how near each lies to the ring's
     middle line, stepping in. */
  var aimDrawn = "";
  function drawAim(x, y, k, now) {
    aimSetup();
    var c = CELL_PX, i0 = Math.floor(x / c), j0 = Math.floor(y / c);
    var step = still ? 3 : Math.min(3, Math.floor((now - (drawAim.at || now)) / 70) + 1);
    var r = 2.2 - 0.5 * k;                     // tightens as you come down
    var key = i0 + "," + j0 + "," + step + "," + r.toFixed(2);
    aimEl.hidden = false;
    aimEl.style.transform = "translate(" + ((i0 - 3) * c) + "px," + ((j0 - 3) * c) + "px)";
    if (key === aimDrawn) { return; }
    aimDrawn = key;
    var size = 7 * c, d = Math.min(window.devicePixelRatio || 1, 3);
    if (aimRing.width !== Math.round(size * d)) { aimRing.width = aimRing.height = Math.round(size * d); }
    var g = aimRing.getContext("2d");
    g.setTransform(d, 0, 0, d, 0, 0);
    g.clearRect(0, 0, size, size);
    var px = x - (i0 - 3) * c, py = y - (j0 - 3) * c;
    for (var j = 0; j < 7; j += 1) {
      for (var i = 0; i < 7; i += 1) {
        var dd = Math.sqrt(Math.pow((i + 0.5) * c - px, 2) + Math.pow((j + 0.5) * c - py, 2)) / c;
        var off = Math.abs(dd - r);
        if (off > 0.62) { continue; }
        var level = off < 0.2 ? 3 : off < 0.42 ? 2 : 1;
        if (level < 4 - step) { continue; }
        g.globalAlpha = LEVELS[level];
        g.fillStyle = level === 3 ? LILAC : LIGHT;
        g.fillRect(i * c + 1, j * c + 1, c - 2, c - 2);
      }
    }
    g.globalAlpha = 1;
  }
  function hideAim() {
    if (aimEl) { aimEl.hidden = true; aimDrawn = ""; }
    if (aimName) { aimName.hidden = true; delete aimName.dataset.on; }
    drawAim.at = 0;
  }
  /* Its name: what the place is (DIRT Earth's atlas, once the ground is
     there; until then what the body of works is made of there), and the
     nearest of the site's cities. */
  function nearTown(lat, lon) {
    if (!towns) { return null; }
    var v = toVec(lat, lon), best = null, bd = 9;
    towns.forEach(function (t) {
      var d = Math.acos(Math.max(-1, Math.min(1, dot3(v, t.v))));
      if (d < bd) { bd = d; best = t; }
    });
    return best ? { t: best, km: bd * 6371 } : null;
  }
  function aimWords(lat, lon) {
    var n = nearTown(lat, lon);
    var near = !n ? "" : n.km < 60 ? "near " + n.t.name
      : Math.round(n.km).toLocaleString("en") + " km from " + n.t.name;
    return near;
  }
  function sayAim(lat, lon, x, y) {
    aimSetup();
    var key = (lat / RAD).toFixed(2) + "," + (lon / RAD).toFixed(2);
    if (aimName.dataset.key !== key) {
      aimName.dataset.key = key;
      var kind = window.EarthBody && EarthBody.kindAt ? EarthBody.kindAt(lat, lon) : null;
      var what = dive.atlas && dive.atlas.key === key ? dive.atlas.name
        : kind ? (kind.snow ? "Snow" : kind.kind.charAt(0).toUpperCase() + kind.kind.slice(1)) : "";
      var near = aimWords(lat, lon);
      aimName.innerHTML = "";
      var a = document.createElement("span"); a.className = "dive-aim-what"; a.textContent = what;
      var b = document.createElement("span"); b.className = "dive-aim-near"; b.textContent = near;
      aimName.appendChild(a);
      if (near) { aimName.appendChild(b); }
      // One tap down (WCAG 2.5.1): the spread of two fingers has a press that does the same.
      var go = document.createElement("button");
      go.type = "button";
      go.className = "dive-aim-go";
      go.textContent = "Go down here ↓";
      go.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      go.addEventListener("click", function (event) {
        event.stopPropagation();
        if (!aimTap || dive.on || flying || groundOn) { return; }
        var t = aimTap;
        aimTap = null;
        hideAim();
        groundUp(t.lat / RAD, wrap(t.lon) / RAD, false);
      });
      aimName.appendChild(go);
      // Ask the ground what the atlas calls it.
      if (groundLoaded) { groundSay({ dirt: "name", lat: lat / RAD, lon: wrap(lon) / RAD, key: key }); }
    }
    aimName.hidden = false;
    aimName.dataset.on = "true";
    // Under the ring, kept on the screen and clear of the foot.
    var w = aimName.offsetWidth || 160, h = aimName.offsetHeight || 34;
    var lx = Math.max(16, Math.min(W - 16 - w, x - w / 2));
    var ly = y + 2.6 * CELL_PX;
    if (ly + h > H - 16) { ly = y - 2.6 * CELL_PX - h; }
    aimName.style.transform = "translate(" + lx.toFixed(0) + "px," + ly.toFixed(0) + "px)";
  }
  var groundGrown = 0;                          // how much of the ground in view has grown (DIRT says)
  window.addEventListener("message", function (event) {
    if (event.source !== groundFrame.contentWindow || !event.data) { return; }
    if (event.data.dirt === "grown") { groundGrown = +event.data.f || 0; return; }
    if (event.data.dirt !== "named") { return; }
    dive.atlas = { key: event.data.key, name: event.data.name };
    if (aimName && aimName.dataset.key === event.data.key && aimName.firstChild) {
      aimName.firstChild.textContent = event.data.name;
    }
  });

  /* A tap on the world, where a dive could start: the spot is ringed and
     named, and the next spreading of two fingers dives there. */
  function setAim(x, y) {
    if (!diveCan() || dive.on) { return; }
    var at = unproject(x, y);
    if (!at) { return; }
    aimTap = { lat: at.lat, lon: at.lon, at: performance.now() };
    drawAim.at = performance.now();
  }
  /* Drawn every frame while it is kept, where the world has it now. */
  function stepAim(now) {
    if (dive.on) { return; }
    if (!aimTap) { return; }
    var gone = now - aimTap.at > AIM_KEEP || !diveCan();
    var q = gone ? null : project(aimTap.lat, aimTap.lon);
    if (!q || q.z < 0.08) { if (gone) { aimTap = null; } hideAim(); return; }
    drawAim(q.x, q.y, 0, now);
    sayAim(aimTap.lat, aimTap.lon, q.x, q.y);
  }

  /* The world as it is drawn p of the way down, the aim held at (tx, ty):
     the radius in log space from where it was to the ground's own; the world
     turned to face the aim over the first part of the way; and slid so the
     aim is exactly where it is held. */
  function diveView(p, tx, ty) {
    var f = dive.from;
    R = Math.exp(Math.log(f.R) + (Math.log(dive.Rg) - Math.log(f.R)) * p);
    var k = smooth01(p / 0.62);
    spin = f.spin + shortest(f.spin, dive.aim.lon) * k;
    wanted = spin;
    tilt = f.tilt + (Math.max(-89 * RAD, Math.min(89 * RAD, dive.aim.lat)) - f.tilt) * k;
    COS_T = Math.cos(tilt);
    SIN_T = Math.sin(tilt);
    cx = 0; cy = 0;
    var q = project(dive.aim.lat, dive.aim.lon);
    var c = smooth01(p / 0.08);
    cx = (tx - q.x) * c + f.cx * (1 - c);
    cy = (ty - q.y) * c + f.cy * (1 - c);
  }
  /* The ground, through a lens at the aim: at the world's scale there (a
     degree of longitude narrower than one of latitude, as on the globe,
     until the end, where it is the ground's own), coming in between phi⁻³
     and phi⁻¹ of the ground's scale, and opening to the whole window on the
     last stretch. */
  function diveGround(p, tx, ty) {
    var s = R / dive.Rg;
    var ls = Math.log(Math.max(1e-6, s));
    var g = smooth01((ls + 3 * LN_PHI) / (2 * LN_PHI));
    var u = smooth01((ls + LN_PHI) / LN_PHI);
    var cl = Math.cos(dive.aim.lat);
    var sx = s * (cl + (1 - cl) * u), sy = s;
    groundDirt.style.transform = "translate(" + (tx - W / 2).toFixed(1) + "px," + (ty - H / 2).toFixed(1) + "px) scale(" +
      sx.toFixed(4) + "," + sy.toFixed(4) + ")";
    groundDirt.style.opacity = (g * smooth01(groundGrown / 0.5)).toFixed(3);
    // The lens, in the ground's own pixels: soft all the way in from its
    // edges at first, so it is a glow at the aim, and sharpening out to the
    // edges as it comes to fill the window; its edge is never seen.
    var f = Math.min(W, H) * 0.5 * (1 - u);
    var lens = f < 0.5 ? "none"
      : "linear-gradient(to right, transparent, #000 " + f.toFixed(0) + "px, #000 calc(100% - " + f.toFixed(0) + "px), transparent)," +
        "linear-gradient(to bottom, transparent, #000 " + f.toFixed(0) + "px, #000 calc(100% - " + f.toFixed(0) + "px), transparent)";
    groundDirt.style.webkitMaskImage = lens;
    groundDirt.style.maskImage = lens;
    groundDirt.style.webkitMaskComposite = "source-in";
    groundDirt.style.maskComposite = "intersect";
    // The views laid over the world give way to it on the way down.
    var o = (1 - smooth01(p / 0.3)).toFixed(3);
    overStage.forEach(function (el) { el.style.opacity = o; });
  }
  function diveTell() {
    // The ground told where to look: once, to start growing there, then
    // only moved (no regrowing) as the aim is steered.
    var key = (dive.aim.lat / RAD).toFixed(3) + "," + (wrap(dive.aim.lon) / RAD).toFixed(3);
    var now = performance.now();
    if (key === dive.sent || now - dive.sentAt < 120) { return; }
    dive.sent = key;
    dive.sentAt = now;
    groundSay({ dirt: "look", lat: dive.aim.lat / RAD, lon: wrap(dive.aim.lon) / RAD });
  }

  function diveBegin(x, y) {
    var now = performance.now();
    var tap = aimTap && now - aimTap.at < AIM_KEEP ? aimTap : null;
    var q = tap ? project(tap.lat, tap.lon) : null;
    if (q && q.z < 0.08) { tap = null; }
    var at = tap ? { lat: tap.lat, lon: tap.lon } : unproject(x, y);
    var ax = tap ? q.x : x, ay = tap ? q.y : y;
    if (!at) {
      // From the sky: the point of the world nearest the fingers.
      var dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      ax = cx + dx / d * R * 0.97;
      ay = cy + dy / d * R * 0.97;
      at = unproject(ax, ay) || { lat: tilt, lon: spin };
    }
    aimTap = null;
    dive.aim = at;
    dive.from = { R: R, cx: cx, cy: cy, spin: spin, tilt: tilt, wanted: wanted };
    dive.Rg = groundR();
    dive.fx = x; dive.fy = y;
    dive.ax = ax; dive.ay = ay;
    dive.settle = null;
    dive.on = true;
    drawAim.at = drawAim.at || now;
    window.clearTimeout(dive.tidy);
    if (art) { art.glide = null; }
    hideDoor();
    var lat = at.lat / RAD, lon = wrap(at.lon) / RAD;
    if (!groundFrame.src || lat.toFixed(4) + "," + lon.toFixed(4) !== groundAtWas) { groundGrown = 0; }
    groundAt(lat, lon, false);
    dive.sent = lat.toFixed(3) + "," + lon.toFixed(3);
    dive.sentAt = now;
    groundDirt.hidden = false;
    groundDirt.classList.remove("on");
    groundDirt.dataset.diving = "true";
    // Not to be touched until it is reached: the fingers are still on the globe.
    groundDirt.style.pointerEvents = "none";
    groundDirt.style.transition = "none";
    groundDirt.style.transformOrigin = "50% 50%";
    stage.style.transition = "none";
    overStage.forEach(function (el) { el.style.transition = "none"; });
  }

  function diveTo(logAmount, x, y) {
    if (dive.settle) { return; }
    if (!dive.on && !diveCan()) { return; }
    dive.log = Math.max(0, logAmount);
    // The fingers take you three quarters of the way, to where the region
    // reads whole; the rest is the landing, always at its own pace.
    dive.raw = Math.min(1, dive.log / DIVE_SPAN);
    dive.p = DIVE_HAND * dive.raw;
    if (dive.p > 0 && !dive.on) { diveBegin(x, y); }
    if (!dive.on) { return; }
    // Steering: the aim's ring goes with the fingers, over the world as it is
    // drawn now, and the world is drawn nearer about wherever it has got to.
    var mx = x - dive.fx, my = y - dive.fy;
    dive.fx = x; dive.fy = y;
    if (mx || my) {
      dive.ax = Math.max(16, Math.min(W - 16, dive.ax + mx));
      dive.ay = Math.max(16, Math.min(H - 16, dive.ay + my));
      diveView(dive.p, dive.ax, dive.ay);
      var at = unproject(dive.ax, dive.ay);
      if (at) { dive.aim = at; }
    }
    lastTouch = handledAt = performance.now();
    if (dive.raw >= 1) { diveEnd(); }
  }
  /* Let go: past half way, on down (slowly at the end, so the region is
     seen before the ground settles); short of it, back. */
  function diveEnd() {
    window.clearTimeout(dive.timer);
    if (!dive.on || dive.settle) { return; }
    var down = dive.raw >= 0.5;
    var now = performance.now();
    // Where the landing waits, if it must, for the ground to grow: phi⁻²
    // of the ground's scale, before the lens opens.
    var span = Math.log(dive.Rg) - Math.log(dive.from.R);
    dive.settle = { at: now, clock: 0, last: now, p0: dive.p, p1: down ? 1 : 0, x0: dive.ax, y0: dive.ay,
                    hold: span > 0 ? 1 - 2 * LN_PHI / span : 1,
                    dur: still ? 1 : down ? 1300 + 900 * (1 - dive.p) : 520 };
    dive.log = 0;
  }
  function diveFrame(now) {
    var p = dive.p, tx = dive.ax, ty = dive.ay;
    var s = dive.settle;
    if (s) {
      // The clock stands while the ground has not grown (six seconds at most).
      var dt = now - s.last;
      s.last = now;
      if (!(s.p1 === 1 && dive.p >= s.hold && groundGrown < 0.8 && now - s.at < 6000)) { s.clock += dt; }
      var u = Math.min(1, s.clock / s.dur);
      // Down: quick to leave and slow to arrive. Back: a spring's ease.
      var e = s.p1 === 1 ? 1 - Math.pow(1 - u, 3) : u * u * (3 - 2 * u);
      p = dive.p = s.p0 + (s.p1 - s.p0) * e;
      if (s.p1 === 1) {
        // The aim comes to the middle, where the ground is centred.
        var m = smooth01(u * 1.6);
        tx = s.x0 + (W / 2 - s.x0) * m;
        ty = s.y0 + (H / 2 - s.y0) * m;
        dive.ax = tx; dive.ay = ty;
      }
      if (u >= 1) { diveDone(s.p1 === 1); return; }
    }
    diveView(p, tx, ty);
    diveGround(p, tx, ty);
    handledAt = now;                 // moving: the world is magnified, not woven again, on the way
    var gone = smooth01((Math.log(R / dive.Rg) + 2 * LN_PHI) / LN_PHI);   // the ring goes as the ground comes
    if (gone < 0.98) {
      drawAim(tx, ty, p, now);
      aimEl.style.opacity = (1 - gone).toFixed(3);
      sayAim(dive.aim.lat, dive.aim.lon, tx, ty);
      aimName.style.opacity = (1 - gone).toFixed(3);
    } else { hideAim(); }
    if (groundLoaded) { diveTell(); }
  }
  /* Arrived, or come back: either way the world is put back as it was
     beneath, for coming up to. */
  function diveDone(down) {
    var f = dive.from;
    dive.on = false;
    dive.settle = null;
    dive.p = dive.log = dive.raw = 0;
    hideAim();
    if (aimEl) { aimEl.style.opacity = ""; aimName.style.opacity = ""; }
    spin = f.spin;
    wanted = f.wanted;
    lean(f.tilt);
    reframe();
    if (!place) { setSeat(seat); }
    drawn.r = 0;
    marksDirty = true;
    overStage.forEach(function (el) { el.style.opacity = ""; });
    stage.style.transition = "";
    delete groundDirt.dataset.diving;
    groundDirt.style.webkitMaskImage = groundDirt.style.maskImage = "";
    groundDirt.style.webkitMaskComposite = groundDirt.style.maskComposite = "";
    if (down) {
      groundSay({ dirt: "look", lat: dive.aim.lat / RAD, lon: wrap(dive.aim.lon) / RAD, settle: true });
      groundDirt.classList.add("on");
      groundDirt.style.transform = groundDirt.style.opacity = "";
      groundOn = true;
      groundSay({ dirt: "chrome", on: true });
      groundPlaces();
      groundFrame.focus();
    } else {
      groundDirt.style.opacity = "0";
      groundDirt.hidden = true;
    }
    dive.tidy = window.setTimeout(function () {
      groundDirt.style.transition = groundDirt.style.transform = groundDirt.style.opacity = "";
      overStage.forEach(function (el) { el.style.transition = ""; });
    }, 60);
    // The ground is touched only once the fingers (or a trackpad's last
    // scrolling) have let go of the dive: a pinch that carried on would
    // otherwise go straight on down to the streets.
    window.setTimeout(function () { if (!dive.on) { groundDirt.style.pointerEvents = ""; } }, 700);
  }

  function comeUpFromGround() {
    if (!groundOn) { return; }
    groundOn = false;
    downPush = 0;
    groundDirt.classList.remove("on");
    window.setTimeout(function () { if (!groundOn) { groundDirt.hidden = true; } }, 640);
  }

  /* A mark pressed on the ground: that place, reached by flying over the
     globe to it — the ground put away first, and laid again behind it if it
     is a building. */
  function openFromGround(id) {
    var city = null;
    cities.forEach(function (c) { if (c.slug === id) { city = c; } });
    if (!city || flying) { return; }
    comeUpFromGround();
    if (city.open) { city.open(); return; }
    if (place === city) { return; }
    hopTo(city);
  }
  bannerDown.addEventListener("click", function () { goDeeper(false); });
  // Without fingers: "+" goes down a level (into the ground, from the globe or
  // a place), "-" comes back up a level. A one-key shortcut (WCAG 2.1.4): only
  // while nothing in particular has the focus, or the globe, a mark, the lens or
  // the walk does — never while a button or a list in a column has it.
  function shortcutHere() {
    var a = document.activeElement;
    if (!a || a === document.body || a === document.documentElement || a === land) { return true; }
    // The view's heading (a11y.js puts the focus there on arrival) is not a control: the view's keys hold there too.
    return !!(a.closest && a.closest(".city, .lens-veil, .lens-hole, .lens-home, .walk, .dial-face, [data-a11y-h1], .a11y-h1"));
  }
  document.addEventListener("keydown", function (event) {
    if (event.target && /INPUT|TEXTAREA/.test(event.target.tagName)) { return; }
    if (event.ctrlKey || event.metaKey || event.altKey || !shortcutHere()) { return; }
    if (groundOn || flying || deckMode) { return; }
    // Up on the world the globe's own keys (globeKey) take + and − first: nearer, farther.
    if (!place && (event.key === "+" || event.key === "=" || event.key === "-" || event.key === "_")) {
      if (globeKey(event.key)) { event.preventDefault(); }
      return;
    }
    if (event.key === "+" || event.key === "=") {
      // In the reading layout "+" is the lens's next voice nearer; past the nearest, the ground there.
      if (place && readingOn() && LENS) {
        if (LENS_GLOBE) { if (!lensZoomBy(PHI)) { goDeeper(false); } return; }
        if (!(window.Voice && Voice.nudge && Voice.nudge(1)) && !lensGroundWhole()) { goDeeper(false); }
        return;
      }
      if (cityMap()) { if (!cityStepBy(ZOOM_STEP)) { goDeeper(false); } return; }
      if (place) { goDeeper(false); } else { flyOver(); }
    }
    else if ((event.key === "-" || event.key === "_") && place) {
      if (cityMap() && cityStepBy(1 / ZOOM_STEP)) { return; }
      // A small globe brought nearer is made smaller first; at rest, up a level.
      if (lensAway() && lensK() > 1.001) { lensZoomBy(INV); if (lensK() < LENS_MAGNET) { lensSize(1); } return; }
      comeUp();
    }
  });
  // The reading lies over the banner (it is another layer, above the
  // stage): a press on its empty band at the top goes to whichever of the
  // banner's buttons is under it, so the way back and the way down both
  // work while a collage is being read.
  document.addEventListener("click", function (event) {
    if (!event.target.classList || !event.target.classList.contains("read")) { return; }
    var hit = ["banner-back", "banner-city", "banner-sound", "banner-down"].map(function (id) {
      return document.getElementById(id);
    }).filter(function (b) {
      var r = b && !b.disabled ? b.getBoundingClientRect() : null;
      return r && r.width && event.clientX >= r.left && event.clientX <= r.right &&
             event.clientY >= r.top && event.clientY <= r.bottom;
    })[0];
    if (hit) { event.preventDefault(); event.stopPropagation(); hit.click(); }
  }, true);
  window.addEventListener("message", function (event) {
    if (event.source !== groundFrame.contentWindow || !event.data) { return; }
    if (event.data.dirt === "up") { comeUpFromGround(); }
    if (event.data.dirt === "open") { openFromGround(event.data.id); }
  });
  // Scrolling in on a city, or spreading two fingers on it, goes on down.
  var upPush = 0;
  // The reading (#here) and the art view (#art) lie over the stage, outside
  // it: the same gestures are heard on them too, so no view holds you
  // (artist, 1 Oct 2026: "regardless of where you are … you should always
  // be free to move around the globe").
  var overStage = ["here", "art"].map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  // Something under the pointer that scrolls itself (a column of works, a
  // reading on a phone): the wheel is its own, not the way up.
  function scrollsItself(e) {
    for (; e && e.nodeType === 1 && e !== stage && e !== document.body; e = e.parentElement) {
      var oy = getComputedStyle(e).overflowY;
      if ((oy === "auto" || oy === "scroll") && e.scrollHeight > e.clientHeight + 2) { return true; }
    }
    return false;
  }
  var lensWheel = 0, lensWheelAt = 0;
  function placeWheel(event) {
    if (!place || flying || groundOn) { return; }
    // An art view's column scrolls itself, both ways (and moves its time).
    if (event.target.closest && event.target.closest(".art-col, .walk-look")) { return; }
    // Over the small globe's ground the wheel is zoneWheel's (below).
    if (!dive.on && readingOn() && LENS && LENS_GLOBE && globeZone(event.clientX, event.clientY)) { return; }
    if (!dive.on && readingOn() && LENS && inLens(event.clientX, event.clientY)) {
      var nowW = performance.now();
      if (nowW - lensWheelAt > 600) { lensWheel = 0; }
      lensWheelAt = nowW;
      lensWheel += event.deltaY * (event.ctrlKey ? 8 : 1) * (event.deltaMode === 1 ? 16 : 1);
      if (Math.abs(lensWheel) > 140) {
        var wdir = lensWheel < 0 ? 1 : -1;
        lensWheel = 0;
        var wmoved = window.Voice && Voice.nudge ? Voice.nudge(wdir) : false;
        if (!wmoved && wdir > 0 && lensGround.on) { lensGroundWhole(); }
      }
      return;
    }
    if (dive.on) {
      var dstep = event.ctrlKey ? 0.012 : 0.0016;
      diveTo(dive.log - event.deltaY * dstep * (event.deltaMode === 1 ? 16 : 1), event.clientX, event.clientY);
      window.clearTimeout(dive.timer);
      if (dive.raw >= 1) { diveEnd(); } else { dive.timer = window.setTimeout(diveEnd, 520); }
      return;
    }
    // Scrolling out of a place goes back up to the world — but not while
    // scrolling a column of works or a reading, which scroll themselves.
    if (event.deltaY > 0) {
      if (event.target.closest && event.target.closest(".deck, .archive")) { return; }
      if (scrollsItself(event.target)) { return; }
      upPush += event.deltaY * (event.ctrlKey ? 8 : 1);
      if (upPush > 377) { upPush = 0; comeUp(); }
      return;
    }
    upPush = 0;
    // In the reading layout the way down is through the lens's voices (above); elsewhere, nothing.
    if (!dive.on && readingOn() && LENS) { return; }
    if (dive.on || diveCan()) {
      // Seen from far off: scrolling in is the dive, toward the pointer.
      var step = event.ctrlKey ? 0.012 : 0.0016;
      diveTo(dive.log - event.deltaY * step * (event.deltaMode === 1 ? 16 : 1), event.clientX, event.clientY);
      window.clearTimeout(dive.timer);
      if (dive.raw >= 1) { diveEnd(); } else { dive.timer = window.setTimeout(diveEnd, 520); }
      return;
    }
    downPush += -event.deltaY * (event.ctrlKey ? 8 : 1);
    if (downPush > 233) { downPush = 0; goDeeper(false, event.clientX, event.clientY); }
  }
  stage.addEventListener("wheel", placeWheel, { passive: true });
  overStage.forEach(function (o) { o.addEventListener("wheel", placeWheel, { passive: true }); });
  /* The small globe's wheel (artist, 7 Oct 2026: "Make sure that no matter
     what, if there is a globe in view that the viewer is able to make it
     bigger and smaller however they please"): anywhere in the reading layout
     that is not the column, the picture or the banner — over the lens or
     near it, over the dial (a trackpad's pinch there; a plain wheel on the
     dial still turns it, a crown), over an animal — a wheel or a trackpad's
     pinch makes the small globe bigger or smaller, about the pointer where
     it is over the globe, else about its middle; never out of the path. Heard
     first (capture) and not passive, so the browser's own zoom does not take
     a trackpad's pinch as well. */
  function zoneWheel(event) {
    if (cityMap() && !dive.on) {
      var ct = event.target;
      if (ct && ct.closest && ct.closest(".art-col, .finder, .ground-dirt, .dial-face, .building-works")) { return; }
      if (!cityZone(event.clientX, event.clientY)) { return; }
      event.preventDefault();
      event.stopPropagation();
      cityWheel(event);
      return;
    }
    if (!place || flying || groundOn || dive.on || !readingOn() || !LENS || !LENS_GLOBE) { return; }
    var t = event.target;
    if (t && t.closest && t.closest(".art-col, .walk-look, .finder, .ground-dirt")) { return; }
    if (!globeZone(event.clientX, event.clientY)) { return; }
    if (!event.ctrlKey && t && t.closest && t.closest(".dial-face")) { return; }
    event.preventDefault();
    event.stopPropagation();
    var wstep = event.ctrlKey ? 0.012 : 0.0016, wd = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    if (!lensZoomBy(Math.exp(-wd * wstep), event.clientX, event.clientY) && wd < 0 && diveCan()) {
      // Past its nearest, scrolling on is the dive, as on the front page.
      diveTo(dive.log - wd * wstep, event.clientX, event.clientY);
      window.clearTimeout(dive.timer);
      if (dive.raw >= 1) { diveEnd(); } else { dive.timer = window.setTimeout(diveEnd, 520); }
      return;
    }
    window.clearTimeout(lensWheelT);
    lensWheelT = window.setTimeout(lensRelease, 300);
  }
  window.addEventListener("wheel", zoneWheel, { capture: true, passive: false });
  var downFingers = {}, downFrom = 0;
  function downSpread() {
    var ids = Object.keys(downFingers);
    if (ids.length < 2) { return 0; }
    var a = downFingers[ids[0]], b = downFingers[ids[1]];
    return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y));
  }
  [stage].concat(overStage).forEach(function (o) {
    o.addEventListener("pointerdown", fingerDown, true);
    o.addEventListener("pointermove", fingerMove, true);
    ["pointerup", "pointercancel"].forEach(function (name) { o.addEventListener(name, fingerUp, true); });
  });
  // An animal laid over everything (a chimera's own button, on the page's
  // body) never swallows two fingers: its touches are heard as the stage's.
  function offStage(event) {
    var t = event.target;
    if (!t || !t.closest || !t.closest(".character")) { return false; }
    return ![stage].concat(overStage).some(function (o) { return o.contains(t); });
  }
  document.addEventListener("pointerdown", function (event) { if (offStage(event)) { fingerDown(event); } }, true);
  document.addEventListener("pointermove", function (event) { if (offStage(event)) { fingerMove(event); } }, true);
  ["pointerup", "pointercancel"].forEach(function (name) {
    document.addEventListener(name, function (event) { if (offStage(event)) { fingerUp(event); } }, true);
  });
  /* A pinch that is the small globe's takes the fingers from whatever the
     first of them began: a turn of the world, a turn or a lift of the dial
     (undone, as a lift undoes its turn), a squash. */
  function lensPinchTakes(event) {
    turning = null;
    squashing = null;
    delete stage.dataset.turning;
    dials.forEach(function (o) {
      if (!o.down && o.grab === null && !o.move && !o.tp) { return; }
      window.clearTimeout(o.hold);
      if (o.tp && window.Dial && Dial.ring) { try { Dial.ring(o, "cancel", {}); } catch (e) {} }
      if (o.grab !== null && o.down) {
        o.range.value = o.down.was;
        o.range.dispatchEvent(new Event("input", { bubbles: true }));
        o.range.dispatchEvent(new Event("change", { bubbles: true }));
      }
      o.tp = false; o.grab = null; o.last = null; o.move = null; o.down = null; o.drawn = "";
      delete o.box.dataset.turning;
      delete o.box.dataset.lifted;
    });
    // The second finger is not also a press on what it landed on.
    if (event.currentTarget !== stage) { event.stopPropagation(); }
  }
  var lensPinch = null;                 // two fingers that came down on the lens: { d }
  function fingerUp(event) {
    if (markDrag && markDrag.id === event.pointerId) {
      if (markDrag.moved > 8) {
        if (markDrag.city) { cityLetGo(markDrag); }
        // The press that moved the map is not also a press on the mark.
        var swallow = function (e) { e.stopPropagation(); e.preventDefault(); };
        document.addEventListener("click", swallow, true);
        window.setTimeout(function () { document.removeEventListener("click", swallow, true); }, 400);
      }
      markDrag = null;
    }
    delete downFingers[event.pointerId];
    downFrom = downSpread();
    if (Object.keys(downFingers).length < 2) {
      if (lensPinch && lensPinch.zoomed && !dive.on) { lensRelease(); }
      lensPinch = null;
      if (cityPinch && !dive.on) { cityRelease(); }
      cityPinch = null;
    }
    if (place && dive.on && Object.keys(downFingers).length < 2) { diveEnd(); }
  }
  function fingerDown(event) {
    // A first finger begins a new gesture: a finger whose lifting was never heard is not still down.
    if (event.isPrimary) { downFingers = {}; lensPinch = null; cityPinch = null; }
    downFingers[event.pointerId] = { x: event.clientX, y: event.clientY };
    downFrom = downSpread();
    lensPinch = null;
    // A work's first look ends on any touch, so its globe is in reach at once.
    if (art && art.kind === "work" && !art.flipped && art.live) { flipToHead(); }
    var ids = Object.keys(downFingers);
    if (ids.length === 2 && readingOn() && LENS) {
      var p = downFingers[ids[0]], q = downFingers[ids[1]];
      var mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2;
      // The small globe's, however the fingers land (artist, 7 Oct 2026): the
      // point between them anywhere but the column, the picture or the banner.
      if (LENS_GLOBE ? globeZone(mx, my) : inLens(mx, my)) {
        lensPinch = { d: Math.max(1, downFrom) };
        if (LENS_GLOBE) { lensPinchTakes(event); }
      }
    }
    // A press on a mark in a city that then moves is the map's too (the mark keeps its tap).
    // So is one begun on an animal or a name standing on the small globe: the world turns under it.
    var tg = event.target && event.target.closest ? event.target : null;
    var onMark = ids.length === 1 && tg && ((cityMap() && tg.closest(".city")) ||
                 (readingOn() && LENS_GLOBE && tg.closest(".character, .city") && globeZone(event.clientX, event.clientY)));
    markDrag = onMark ? { id: event.pointerId, x: event.clientX, y: event.clientY, lx: event.clientX, ly: event.clientY,
                          lt: performance.now(), moved: 0, city: cityMap() } : null;
    cityPinch = null;
    if (ids.length === 2 && cityMap()) {
      var cp = downFingers[ids[0]], cq = downFingers[ids[1]];
      var cmx = (cp.x + cq.x) / 2, cmy = (cp.y + cq.y) / 2;
      if (cityZone(cmx, cmy)) {
        cityFling = null;
        cityPinch = { d: Math.max(1, downFrom), x: cmx, y: cmy, over: 1 };
        lensPinchTakes(event);
      }
    }
  }
  function fingerMove(event) {
    if (!downFingers[event.pointerId]) { return; }
    // The map in the big place moves and zooms itself (and is never the way up).
    if (flat && !flat.cv.hidden && event.target === flat.cv) { return; }
    downFingers[event.pointerId] = { x: event.clientX, y: event.clientY };
    // The city's skyline takes its own two fingers (skyline.js).
    if (skyOn() && event.target && event.target.closest && event.target.closest(".skyline")) { return; }
    var d = downSpread();
    if (cityPinch && d > 0) { cityPinchMove(d); return; }
    var md = markDrag;
    if (md && md.id === event.pointerId && !md.city && readingOn() && !flying) {
      md.moved = Math.max(md.moved, Math.abs(event.clientX - md.x), Math.abs(event.clientY - md.y));
      if (md.moved > 8) {
        var mr = Math.max(R, 1);
        art.glide = null;
        art.lens = null;
        wanted = spin = spin - (event.clientX - md.lx) / mr / Math.max(0.25, Math.cos(focus.lat));
        lean(tilt + (event.clientY - md.ly) / mr);
        focus.lat = tilt;
        reframe();
        art.dirty = true;
        md.lx = event.clientX; md.ly = event.clientY;
        if (window.Voice && Voice.handled) { Voice.handled(); }
      }
      return;
    }
    if (md && md.id === event.pointerId && cityMap()) {
      md.moved = Math.max(md.moved, Math.abs(event.clientX - md.x), Math.abs(event.clientY - md.y));
      if (md.moved > 8) {
        cityFling = null;
        var mnow = performance.now(), mdt = Math.max(1, mnow - md.lt);
        md.vx = 0.6 * (md.vx || 0) + 0.4 * (event.clientX - md.lx) / mdt;
        md.vy = 0.6 * (md.vy || 0) + 0.4 * (event.clientY - md.ly) / mdt;
        cityPan(event.clientX - md.lx, event.clientY - md.ly);
        md.lx = event.clientX; md.ly = event.clientY; md.lt = mnow;
      }
      return;
    }
    // Two fingers on the lens move between its voices without leaving the
    // path: spread nearer (more personal), pinch further off; the voice is
    // held for the rest of the path (voice.js). Past the nearest, the
    // ground there, the whole window.
    if (lensPinch && LENS_GLOBE && place && !flying && !groundOn && d > 0) {
      var li = Object.keys(downFingers), la = downFingers[li[0]], lb = downFingers[li[1]];
      var mx = (la.x + lb.x) / 2, my = (la.y + lb.y) / 2;
      if (lensPinch.dive || (!dive.on && d > lensPinch.d && lensK() >= lensMostK() - 1e-6 && diveCan())) {
        // Spread on past the nearest: the dive, aimed between the fingers.
        if (!lensPinch.dive) { lensPinch.dive = d; }
        diveTo(Math.log(d / lensPinch.dive), mx, my);
        return;
      }
      if (lensZoomBy(d / lensPinch.d, mx, my)) { lensPinch.zoomed = true; }
      lensPinch.d = d;
      return;
    }
    if (lensPinch && place && !flying && !groundOn && d > 0) {
      var ratio = d / lensPinch.d;
      if (ratio > 1.32 || ratio < 1 / 1.32) {
        var dir = ratio > 1 ? 1 : -1;
        lensPinch.d = d;
        var moved = window.Voice && Voice.nudge ? Voice.nudge(dir) : false;
        if (!moved && dir > 0 && lensGround.on) { lensPinch = null; lensGroundWhole(); }
      }
      return;
    }
    // In the reading layout spreading begun off the lens does not dive: the world is in the lens.
    if (readingOn() && LENS && !dive.on && downFrom > 0 && d / downFrom > 1) { return; }
    // Spreading on a world seen from far off (a work's history, a collage's
    // city): the dive, aimed between the fingers, as far as they have gone.
    if (place && !flying && !groundOn && downFrom > 0 && (dive.on || (diveCan() && d / downFrom > 1.04))) {
      var gi = Object.keys(downFingers), ga = downFingers[gi[0]], gb = downFingers[gi[1]];
      diveTo(Math.log(d / downFrom / 1.04), (ga.x + gb.x) / 2, (ga.y + gb.y) / 2);
      return;
    }
    if (place && !flying && !groundOn && downFrom > 0 && d / downFrom > 1.5) {
      var fi = Object.keys(downFingers), fa = downFingers[fi[0]], fb = downFingers[fi[1]];
      downFrom = 0;
      goDeeper(false, (fa.x + fb.x) / 2, (fa.y + fb.y) / 2);
    }
    else if (place && !flying && !groundOn && downFrom > 0 && d / downFrom < INV) { downFrom = 0; comeUp(); }
  }
  banner.addEventListener("pointerdown", function (event) {
    event.stopPropagation();      // the stage would take the pointer otherwise
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") { return; }
    if (deckMode) { closeDeck(); return; }
    // Only what can be seen is put down: a work the creature turned up a
    // while ago and has since let go of is not in the way of anything.
    if (!graze.hidden || carrying) { dismiss(); return; }
    if (playing) { curtain = performance.now(); endScene(); strike(); return; }
    if (hereShown && place && place.work) { showHere(false); return; }
    // The search field would clear itself on Escape; Find keeps its words.
    if (finderEl && !finderEl.hidden) { event.preventDefault(); closeFinder(); return; }
    if (art && art.held) { releaseThread(); return; }
    // Nothing else to put down: Escape is the way back up to the world.
    comeUp();
  });

  /* ---- the histories --------------------------------------------------------

     The artist, 27 Sep 2026: "timelines of artworks … all the different
     places these artworks have ever gone, every show they have ever been in
     and everything that has ever been written about them". Every place the
     saved works have been is a city of the Museums layer now (29 Sep 2026:
     "that artwork is supposed to be within the museums section"; see "the
     cities"), and a work — pressed in a museum, a city's gallery, or Find —
     flies down into an art view: the globe framed on the history, its
     journey lit on a slider of the work's own years, and a column beside it
     that tells it briefly, one dated line an event, the source's own words a
     press away. Then, on the reading's slow clock, what it shares with other
     works, each with its doors; a door turns the world to the next work. A
     thread has a view of its own, and Find reaches any of the works. Nothing
     changes the address. */

  /* Off (29 Sep 2026): the Museums globe was "way too cluttered", and a
     work's journey is shown in its own history. true: now and then, in the
     company's slot, one travelled work draws its journey over the globe. */
  var PASSING = false;
  var ART_LINGER = INV * 1000;          // 618 ms on each event, and at most that across a gap
  var LEG_MS = 610;                     // a leg lights end to end in this long
  var artPlaces = null;                 // places.json's places, read when the layer is chosen
  var artPlaceBy = {};                  // place key -> its place
  var artInfo = null;                   // places.json itself: works, j
  var artAsked = null;                  // the last view asked for; a later press wins
  var art = null;                       // the art view that is open, and its clock
  var artWalk = [];                     // the walk, work to work, this visit
  var walkShown = null;                 // the walk, drawn once on the way up
  var passing = null;                   // the passing journey, when one is out
  var finder = { open: false, found: null };
  var artKept = [];                     // the histories and threads read, oldest first
  var artEl = document.getElementById("art");
  var artPlate = document.getElementById("art-plate");
  /* The wall label (label.js): touching the picture, wherever it stands
     (artist, 7 Oct 2026: "Where the artwork is located along with its basic
     information provided by artsy should always be adjacent to the thumbnail
     of the artwork"). Placed by layoutPlate; the column no longer repeats it. */
  var artLabel = null;
  if (artPlate) {
    artLabel = el("div", "wall-label wl-plate");
    artLabel.hidden = true;
    artLabel.setAttribute("aria-live", "polite");
    artPlate.parentNode.insertBefore(artLabel, artPlate.nextSibling);
  }
  var artCol = document.getElementById("art-col");
  var artTime = document.getElementById("art-time");
  var artYear = document.getElementById("art-time-year");
  var artTicks = document.getElementById("art-ticks");
  var artRange = document.getElementById("art-time-range");
  var artFind = document.getElementById("art-find");
  var finderEl = document.getElementById("finder");
  var ART_CDN = "https://d32dm0rphc51dk.cloudfront.net/";

  /* Everything the layer reads is kept in the same cache as the grounds,
     the last 89 histories and threads of it. */
  function readArt(path) {
    var key = "art:" + path;
    if (!grounds[key]) {
      grounds[key] = read(path).catch(function () {
        // Not kept: the next press reads it again.
        delete grounds[key];
        var at = artKept.indexOf(key);
        if (at >= 0) { artKept.splice(at, 1); }
        return null;
      });
      if (/^(histories|threads)\//.test(path)) {
        artKept.push(key);
        if (artKept.length > 89) { delete grounds[artKept.shift()]; }
      }
    }
    return grounds[key];
  }

  function readPlaces() {
    return readArt("places.json").then(function (d) {
      if (!d || artPlaces) { return artPlaces; }
      artInfo = d;
      artPlaces = d.places.map(function (row, i) {
        var pl = { i: i, p: row[0], name: row[1], cc: row[2],
                   lat: row[3] * RAD, lon: wrap(row[4] * RAD), n: row[5] };
        pl.v = toVec(pl.lat, pl.lon);
        // How bright its tile is, by how many works have been there, in
        // Fibonacci bins: one, up to eight, up to fifty-five, more.
        pl.level = pl.n > 55 ? 4 : pl.n > 8 ? 3 : pl.n > 1 ? 2 : 1;
        artPlaceBy[pl.p] = pl;
        return pl;
      });
      return artPlaces;
    });
  }

  function readThread(tid) { return readArt("threads/" + tid + ".json"); }

  /* ---- the cities ----------------------------------------------------------

     The Museums layer is cities (artist, 29 Sep 2026: "have the cities
     displayed on the globe and then when you click on the city that is when
     it shows you the museums in that city"). Every place a saved work has
     been is a city of cities.json (scripts/build_cities.py): the ones that
     hold his museums are cream diamonds, the museums' own shape, named with
     the city's name; the rest, where saved works have only passed through
     galleries, fairs and sale rooms, are tiles of pixel light, a step
     quieter, and the busiest of them are named too. A diamond tied into a
     nearer, larger one (a knot) is its tile until the world comes nearer.

     Pressing one flies down into the same globe, far closer than a collage's
     city, until the city fills the band beside the column: its museums stand
     at their own doors, every one named that can be, the galleries whose
     address is known are faint tiles at theirs, and the column is the
     city's directory — its museums, each a door into the museum; the cities
     near it; then, quieter, every gallery, fair and sale room a saved work
     has been in, each opening to its works. The slider takes the city's art
     world back to any year. Up from a museum is its city, and up from a city
     is the world; a city that is only its museum is passed straight
     through. */

  var TOWN_MIN_KM = 2, TOWN_MAX_KM = 34;   // how much of a city the band is framed on
  var TOWN_R_MAX = 300000;              // as near as a city is flown: the depth its ground was tested at
  var TOWN_NAMED_N = 8;                 // a city of galleries this busy is named on the globe
  var TOWN_LIFT = 18;                   // a museum's name lifted or dropped a line to find room
  var TOWN_SAME = 8;                    // museums this close are one diamond, their names stacked
                                        // (Yale's two, across the street; not the Met and the Guggenheim)
  var towns = null;                     // cities.json's rows, in the order they are named
  var townBy = {};                      // key -> its city
  var townOfSlug = {};                  // a museum's slug -> its city's key
  var townCities = {};                  // key -> the place flown down to, made on the first press
  var museumBy = null;                  // slug -> its row of museums.json
  var townsLitAt = 0;                   // when the layer's tiles were lit
  var townDirty = true;                 // the city view is to be placed again
  var townAt = {};
  var venueLabel = null;                // the one label a pressed gallery's tile shows

  function readTowns() {
    return Promise.all([readPlaces(), readArt("cities.json")]).then(function (both) {
      var d = both[1];
      if (towns || !d || !d.towns) { return towns; }
      towns = d.towns.map(function (row, i) {
        var t = { i: i, key: row[0], name: row[1], cc: row[2], lat: row[3] * RAD, lon: wrap(row[4] * RAD),
                  n: row[5], museums: row[6] || [], others: row[7], pass: !!row[8], file: !!row[9],
                  near: row[10] || [], venues: (d.venues && d.venues[row[0]]) || [] };
        t.v = toVec(t.lat, t.lon);
        var lg = Math.log(1 + t.n) / Math.LN10;
        t.rank = t.museums.length ? 1 + 0.5 * t.museums.length + 0.5 * lg : 0.5 * lg;
        townBy[t.key] = t;
        t.museums.forEach(function (slug) { townOfSlug[slug] = t.key; });
        return t;
      });
      cities.forEach(function (c) { if (c.museum && townOfSlug[c.slug]) { c.townKey = townOfSlug[c.slug]; } });
      return towns;
    });
  }

  function museumOf(slug) {
    if (!museumBy) {
      museumBy = {};
      ((museums && museums.museums) || []).forEach(function (m) { museumBy[m.slug] = m; });
    }
    return museumBy[slug] || null;
  }

  /* A museum's name in its city, short, and only by rule: its own acronym
     where the name ends in one (SFMOMA, V&A), else the name without its
     town on the end ("National Gallery of Art", "The National Gallery"),
     else the name. Never a short name written by hand. */
  function shortName(m) {
    var name = String(m.name || "");
    var acronym = /\(([^()]+)\)\s*$/.exec(name);
    if (acronym) { return acronym[1]; }
    var where = String(m.where || "");
    var town = where.lastIndexOf(",") > 0 ? where.slice(0, where.lastIndexOf(",")).trim() : where.trim();
    if (town) {
      var at = name.toLowerCase().indexOf(", " + town.toLowerCase());
      if (at > 0) { return name.slice(0, at); }
    }
    return name;
  }

  function worksHere(n) {
    return n.toLocaleString("en") + (n === 1 ? " work has" : " works have") + " been here";
  }

  /* The globe's marks for the cities: a diamond for every city with
     museums, a name for every busy city of galleries (its tile is its dot).
     Once, after cities.json is read; found() makes them again after that. */
  function raiseTowns() {
    if (!towns || cities.some(function (c) { return c.town; })) { return; }
    towns.forEach(function (t) {
      var tile = !t.museums.length;
      if (tile && t.n < TOWN_NAMED_N) { return; }
      var only = t.pass ? museumOf(t.museums[0]) : null;
      var mark = {
        work: null, slug: "town-" + t.key, title: t.name, where: t.name + ", " + t.cc,
        lat: t.lat, lon: t.lon, layer: "museums", town: t, tile: tile, real: true,
        rank: t.rank, tone: LIGHT, rise: 300 + Math.min(t.i, 34) * 55,
        aria: only ? "Go down to " + only.name + ", " + t.name
          : tile ? "Go down to " + t.name + " — " + worksHere(t.n)
          : "Go down to " + t.name + " — " + t.museums.length + (t.museums.length === 1 ? " museum" : " museums"),
        open: function () { openTown(t.key); }
      };
      raiseCity(mark, true);
      t.mark = mark;
      if (finder.found && finder.found[t.key]) { mark.el.dataset.found = "true"; }
    });
  }

  /* The Museums layer chosen (or left chosen from the last visit): its
     cities are read, marked and lit, and Find waits over the pill. */
  var townsRetry = 0;
  function museumsLayer() {
    land.dataset.layerOn = layerOn;
    if (layerOn !== "museums") {
      artAsked = null;              // nor after you have chosen another layer
      if (artFind) { artFind.hidden = true; }
      closeFinder();
      if (passing) { endPassing(performance.now()); }
      // One general Search on every layer (artist, 7 Oct 2026: "Get rid of the 'find an artist' and
      // have a general 'search' bar"); on Artists its empty state is still the artists, each a life.
      if (ARTWORKS && artFind) {
        artFind.disabled = false;
        artFind.textContent = "Search";
        artFind.setAttribute("aria-label", "Search works, artists, places, museums, shows and writers");
        artFind.hidden = false;
      }
      measureSafe();
      return;
    }
    readTowns().then(function () {
      if (layerOn !== "museums") { return; }
      if (!towns) {
        // Not read (the network, most likely): said quietly where Find
        // would be, and tried again in a while, or when Museums is pressed.
        if (artFind) {
          artFind.textContent = "The cities could not be read just now";
          artFind.disabled = true;
          artFind.hidden = false;
        }
        measureSafe();
        window.clearTimeout(townsRetry);
        townsRetry = window.setTimeout(function () { if (layerOn === "museums" && !towns) { museumsLayer(); } }, 8000);
        return;
      }
      if (artFind) { artFind.disabled = false; artFind.hidden = true; }
      townsLitAt = performance.now();
      if (!cities.some(function (c) { return c.town; })) {
        raiseTowns();
        filterGlobe();
        measureNames();
        groundPlaces();
      }
      if (ARTWORKS && artFind) {          // Search reads the works itself when pressed (openFinder)
        artFind.textContent = "Search";
        artFind.setAttribute("aria-label", "Search works, artists, places, museums, shows and writers");
        artFind.hidden = false;
        scramble(artFind, oneOf(["decode", "type"]), 0, 640);
      }
      measureSafe();
    });
  }

  /* The cities of galleries, at rest: one tile each, snapped to the grid
     the rest of the pixel light is on, fading toward the limb as the night
     lights do, never as bright as a diamond; a knot's diamond is a brighter
     tile. Where two share a tile the brighter wins. While Find has found
     something, its cities are at the top and the rest at the bottom. */
  function drawTowns(now) {
    var up = still ? 1 : Math.min(1, Math.floor((now - townsLitAt) / 140 + 1) / 3);   // steps(3)
    var hits = finder.found;
    var S = safeBox();
    var best = {};
    for (var n = 0; n < towns.length; n += 1) {
      var t = towns[n];
      var knot = !!(t.mark && t.mark.knot);
      if (t.museums.length && !knot) { continue; }          // a diamond is its own mark
      var p = project(t.lat, t.lon);
      if (p.z < 0.08 || p.x < S.x0 || p.y < S.y0 || p.x > S.x1 || p.y > S.y1 || inAvoid(p.x, p.y, 7)) { continue; }
      // A tile under a name is let go while the name is there, as a dot is.
      if (!(t.mark && t.mark.wasNamed) && underName(p.x, p.y)) { continue; }
      var level = hits ? (hits[t.key] ? 4 : 1) : knot ? 3 : t.n >= TOWN_NAMED_N ? 2 : 1;
      var a = LEVELS[level] * Math.min(1, (p.z - 0.08) * 6) * up;
      var i = Math.floor(p.x / CELL_PX), j = Math.floor(p.y / CELL_PX);
      var key = i * 4096 + j;
      if (!best[key] || best[key].a < a) { best[key] = { i: i, j: j, a: a, t: t }; }
    }
    tilesShown = best;          // what a press can reach (hitTown)
    ctx.fillStyle = LIGHT;
    Object.keys(best).forEach(function (key) {
      var b = best[key];
      ctx.globalAlpha = b.a;
      ctx.fillRect(b.i * CELL_PX + 1, b.j * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    });
    ctx.globalAlpha = 1;
  }

  function underName(x, y) {
    for (var k = 0; k < nameBoxes.length; k += 1) {
      var b = nameBoxes[k];
      if (x > b.x0 - 3 && x < b.x1 + 3 && y > b.y0 - 3 && y < b.y1 + 3) { return true; }
    }
    return false;
  }

  /* The city a press on the globe landed on: only a city that is shown
     (artist, 1 Oct 2026: "I want to make sure that only the cities
     displayed on the surface of the globe are ones to click into or else you
     end up going to a small city just right next to it"). Shown is a
     diamond drawn (not tied into a knot), a name written, or a tile lit this
     frame (a city of galleries' own; a knot's tile is the diamond it is tied
     into). A diamond or a name within a finger's reach wins over any tile;
     among them the nearest, and on a tie the one that matters more; failing
     those, the lit tile the press is in, or the nearest within reach. A city
     whose mark is hidden, tied away or under another's name is never
     reached: pinching nearer shows it, or the big city's Near here. A small
     world, one a press fires in (pressGlobe), is not reached across. */
  var tilesShown = {};
  function hitTown(x, y, touch) {
    if (!towns) { return null; }
    var S = safeBox();
    // A small world is one a press fires in (pressGlobe), so it is not reached across; a
    // reading's grown globe never fires, and is pressed as a near one is.
    var small = !grown && R <= Math.min(W, H) * 0.5;
    var reach = small ? 9 : touch ? 24 : 10;
    var half = CELL_PX / 2;
    var best = null, bestD = Infinity, bestKind = 9;
    function consider(t, d, kind) {
      if (!t || d > reach) { return; }
      if (kind < bestKind || (kind === bestKind && (d < bestD - 0.5 || (d <= bestD + 0.5 && t.rank > best.rank)))) {
        best = t; bestD = d; bestKind = kind;
      }
    }
    function toRect(el) {
      var r = el.getBoundingClientRect();
      if (!r.width) { return Infinity; }
      var dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
      return Math.sqrt(dx * dx + dy * dy);
    }
    towns.forEach(function (t) {
      var m = t.mark;
      if (!m || !m.el || m.shown !== true || m.knot) { return; }
      if (m.wasNamed) { consider(t, toRect(m.name), 0); }
      if (m.tile) { return; }                    // a city of galleries' dot is its tile, below
      var p = project(t.lat, t.lon);
      if (p.z <= 0.08 || p.x < S.x0 || p.x > S.x1 || p.y < S.y0 || p.y > S.y1) { return; }
      // A dot is the smaller target: it is given a few pixels over a name's box.
      consider(t, Math.max(0, Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)) - 4), 0);
    });
    if (best) { return best; }
    Object.keys(tilesShown).forEach(function (key) {
      var b = tilesShown[key], t = b.t;
      var m = t.mark;
      // A knot's tile stands for the diamond it is tied into.
      if (t.museums.length && m && m.knot) { t = m.knotTo && m.knotTo.town; }
      var tx = (b.i + 0.5) * CELL_PX, ty = (b.j + 0.5) * CELL_PX;
      var d = Math.max(0, Math.max(Math.abs(tx - x), Math.abs(ty - y)) - half);
      if (d > 0 && (small || !touch)) { return; }
      consider(t, d, 1);
    });
    return best;
  }

  /* The galleries, fairs and sale rooms of a city whose address is known:
     cities.json's points, less its museums' own (known exactly once the
     city's file is read, and by their museum's point before). */
  function galleryPoints(t, pf) {
    if (t.galleries && (t.galleriesExact || !pf)) { return t.galleries; }
    var mus = t.museums.map(museumOf).filter(Boolean);
    t.galleries = t.venues.filter(function (v) {
      if (pf) { var row = pf.venues[v[0]]; return !!row && !row[1]; }
      return !mus.some(function (m) { return Math.abs(m.lat - v[1]) < 6e-5 && Math.abs(m.lon - v[2]) < 6e-5; });
    }).map(function (v) {
      var lat = v[1] * RAD, lon = wrap(v[2] * RAD);
      return { vi: v[0], lat: lat, lon: lon, v: toVec(lat, lon) };
    });
    t.galleriesExact = !!pf;
    return t.galleries;
  }

  /* How a city is framed: centred on its museums (or, without any, on the
     middle of its galleries), near enough that its museums and most of its
     galleries fill the band beside the column, and never nearer than the
     ground was tested at. Worked out at every open: the window and the
     globe's own size can change. */
  function townFrame(t) {
    var mus = [];
    t.museums.forEach(function (slug) {
      var m = museumOf(slug);
      if (m) { mus.push(toVec(m.lat * RAD, m.lon * RAD)); }
    });
    var gal = galleryPoints(t);
    var c;
    if (mus.length) {
      var sum = [0, 0, 0];
      mus.forEach(function (v) { sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; });
      c = norm3(sum);
    } else if (gal.length) {
      var las = gal.map(function (g) { return g.lat; }).sort(function (a, b) { return a - b; });
      var los = gal.map(function (g) { return g.lon; }).sort(function (a, b) { return a - b; });
      c = toVec(las[Math.floor(las.length / 2)], los[Math.floor(los.length / 2)]);
    } else {
      c = t.v;
    }
    function km(v) { return Math.acos(Math.max(-1, Math.min(1, dot3(c, v)))) * 6371; }
    var ds = gal.map(function (g) { return km(g.v); }).sort(function (a, b) { return a - b; });
    var theta = 3;
    if (mus.length) {
      theta = 0;
      mus.forEach(function (v) { theta = Math.max(theta, km(v)); });
      if (ds.length) { theta = Math.max(theta, ds[Math.floor(0.75 * (ds.length - 1))]); }
    } else if (ds.length) {
      theta = PHI * ds[Math.floor(ds.length / 2)];
    }
    theta = Math.max(TOWN_MIN_KM, Math.min(TOWN_MAX_KM, theta));
    var b = artBand("town");           // a city's own band, whatever view it is opened from
    var r = Math.min(0.4 * Math.min(b.w, b.h) / (theta / 6371), TOWN_R_MAX);
    return { lat: latOf(c), lon: lonOf(c), zoomTo: r / Math.max(1, baseR),
             seatAt: { x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H } };
  }

  function townWhere(t) {
    var m = t.museums.length;
    return (m ? m + (m === 1 ? " museum · " : " museums · ") : "") + worksHere(t.n);
  }

  function townCity(t) {
    return {
      slug: "town-" + t.key, title: t.name, where: townWhere(t),
      lat: t.lat, lon: t.lon, zoomTo: 1, seatAt: null, townKey: t.key, tone: LIGHT,
      art: { kind: "town", data: null, town: t, via: {} }
    };
  }

  /* A city pressed — on the globe, in Near here, in Find, at a stop of a
     history: flown to at once, since its framing needs nothing that is not
     already read; its galleries fill the column when its file lands. A city
     that is only its museum goes straight into the museum. */
  function openTown(key, via) {
    if (flying) { return; }
    if (!towns) {
      readTowns().then(function () { if (towns && townBy[key]) { openTown(key, via); } });
      return;
    }
    var t = townBy[key];
    if (!t) { return; }
    closeFinder();
    if (place && place === townCities[key]) {             // already here
      if (via && via.at && art) { glideTo(art, via.at.lat * RAD, wrap(via.at.lon * RAD)); }
      // A studio here (studios.js): its column at the head of the city's.
      var sb = via && via.studio && art && art.kind === "town" && window.Studios && Studios.column ? Studios.column(via.studio) : null;
      if (sb) {
        var was = artCol.querySelector(".studio-box");
        if (was) { artCol.replaceChild(sb, was); } else { artCol.insertBefore(sb, artCol.firstChild); }
        art.via = art.via || {};
        art.via.studio = via.studio;
        artCol.scrollTop = 0;
      }
      return;
    }
    settleSwing();
    artAsked = null;                // a view still being read is not flown to after this
    if (t.pass && !(via && (via.studio || via.born))) { openMuseum(t.museums[0], via); return; }
    var c = townCities[key] || (townCities[key] = townCity(t));
    var f = townFrame(t);
    // Painted here (sites.js): the city, held on the site's own point, low.
    var at = via && via.at;
    if (at && isFinite(at.lat) && isFinite(at.lon)) {
      var bs = artBand("town");
      f.lat = at.lat * RAD;
      f.lon = at.lon * RAD;
      f.zoomTo = Math.min(0.4 * Math.min(bs.w, bs.h) / (Math.max(0.6, at.km || 1.6) / 6371), TOWN_R_MAX) / Math.max(1, baseR);
    }
    c.title = at && at.name ? at.name : t.name;     // a site far from its city is named for itself
    c.lat = f.lat;
    c.lon = wrap(f.lon);
    c.zoomTo = f.zoomTo;
    c.seatAt = f.seatAt;
    c.art.via = via || {};
    if (place) { hopTo(c); } else { goDown(c); }
  }

  /* A museum, at its city's height, so going between the two is a short
     slide rather than a flight; the Folger keeps the height its theatre
     was built for. */
  function openMuseum(slug, via) {
    if (flying) { return; }
    var mc = cityOf(slug);
    if (!mc) { return; }
    closeFinder();
    settleSwing();
    artAsked = null;
    var t = towns && townBy[mc.townKey];
    if (mc.stage) { mc.zoomTo = CITY_ZOOM; }
    else if (t) { mc.zoomTo = townFrame(t).zoomTo; }
    mc.via = via || {};
    if (place === mc) { return; }
    if (place) { hopTo(mc); } else { goDown(mc); }
  }

  /* Down from a city into one of its museums: its ground opens at the
     city's year when the slider was moved there by hand. */
  function downToMuseum(slug, via) {
    var mc = cityOf(slug);
    if (!mc || flying) { return; }
    var a = art;
    if (a && a.kind === "town" && a.byHand && a.y0) { mc.atYear = yearAt(a, a.whenTo); }
    openMuseum(slug, via);
  }

  /* A museum's mark and its row in the column answer each other. */
  function lightMuseum(slug, on) {
    var a = art;
    if (!a || a.kind !== "town" || !a.museumRows) { return; }
    var row = a.museumRows[slug];
    var mark = cityOf(slug);
    [row && row.row, mark && mark.el].forEach(function (e) {
      if (!e) { return; }
      if (on) { e.dataset.lit = "true"; } else { delete e.dataset.lit; }
    });
    townDirty = true;
  }

  /* Down in a city: the column, and its file read for the galleries. */
  function startTown(a) {
    var t = a.town;
    a.museumRows = {};
    a.venueBoxes = [];
    a.venueWorks = null;
    townDirty = true;
    townAt = {};
    townColumn(a, t, a.via);
    if (!t.file || (a.via && a.via.studio && a.via.studio.alone)) { return; }
    readArt("places/" + t.key + ".json").then(function (pf) {
      if (art !== a) { return; }
      if (!pf) {
        var said = el("p", "read-only town-unread", "The galleries here could not be read just now.");
        artCol.insertBefore(said, a.foot);
        return;
      }
      a.pf = pf;
      galleryPoints(t, pf);
      townFile(a, pf);
    });
  }

  /* The city's file landed: its years, the museums' "more have been here",
     the galleries, fairs and sale rooms, and the slider. */
  function townFile(a, pf) {
    var t = a.town;
    var ids = pf.venues.map(function () { return {}; });
    pf.works.forEach(function (r) { if (ids[r[5]]) { ids[r[5]][r[0]] = true; } });
    a.venueWorks = ids.map(function (o) { return Object.keys(o).length; });
    var y0 = Infinity, y1 = -Infinity;
    pf.venues.forEach(function (v) {
      if (v[2]) { y0 = Math.min(y0, v[2]); }
      if (v[3]) { y1 = Math.max(y1, v[3]); }
    });
    if (a.head) {
      a.head.textContent = ["Here", t.n.toLocaleString("en") + (t.n === 1 ? " work" : " works"),
        y0 !== Infinity ? yearsText(y0, y1) : ""].filter(Boolean).join(" · ");
    }
    // Each museum: its first year here, and the works that have been at it
    // that are not among those it holds.
    Object.keys(a.museumRows).forEach(function (slug) {
      var r = a.museumRows[slug];
      var held = {}, more = {};
      (r.m.works || []).forEach(function (w) { held[w.id] = true; });
      pf.venues.forEach(function (v, i) {
        if (v[1] !== slug) { return; }
        if (v[2] && (!r.y0 || v[2] < r.y0)) { r.y0 = v[2]; }
        Object.keys(ids[i]).forEach(function (id) { if (!held[id]) { more[id] = true; } });
      });
      var n = Object.keys(more).length;
      if (n) { r.meta.textContent = r.m.held + " saved · " + n + (n === 1 ? " more has" : " more have") + " been here"; }
    });
    venueSection(a, pf);
    // Its marks are its venues' first years; it runs on to the last year
    // any of them had a work, so at rest it stands at the present.
    memberYears(a, pf.venues.map(function (v) { return v[2]; }),
                Math.max.apply(null, pf.venues.map(function (v) { return v[3] || v[2] || 0; })));
    laterRows(a);
    autoTown(a);
    a.dirty = true;
    townDirty = true;
    // Come from a history: its venue, open, is brought into view.
    var open_ = a.via && a.via.work && artCol.querySelector('.town-venue[aria-expanded="true"]');
    if (open_) {
      requestAnimationFrame(function () {
        if (art !== a) { return; }
        try { open_.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" }); } catch (e) {}
      });
    }
    // Come from a history: its gallery's tile answers.
    var came = a.via && a.via.work;
    if (came && !still) {
      galleryPoints(t, pf).forEach(function (g) {
        if (!pf.works.some(function (r) { return r[0] === came && r[5] === g.vi; })) { return; }
        var p = project(g.lat, g.lon);
        if (p.z > 0) { pulse(p.x, p.y, [LIGHT, LILAC], 0.6, 144); }
      });
    }
  }

  /* The column: a city's directory. How you came; the count; its museums,
     each a door, most saved works first; the cities near it; then (when the
     file lands) its galleries, fairs and sale rooms; and the way out. */
  function townColumn(a, t, via) {
    var col = artCol;
    if (via && via.from) {
      var came = cameLine({ from: via.from });
      if (came) { col.appendChild(came); }
    }
    // A studio (studios.js) heads the column; one far from any city of the
    // record's is its column alone.
    var sb = via && via.studio && window.Studios && Studios.column ? Studios.column(via.studio) : null;
    if (sb) {
      col.appendChild(sb);
      if (via.studio.alone) { a.foot = artFoot(); return; }
    }
    a.head = el("p", "art-count", "Here · " + t.n.toLocaleString("en") + (t.n === 1 ? " work" : " works"));
    col.appendChild(a.head);
    enterText(a.head, 0);
    var folger = LANDMARKS.filter(function (m) { return m.town === t.key; });
    if (t.museums.length || folger.length) {
      col.appendChild(el("p", "town-section", "Museums · " + t.museums.length));
      t.museums.forEach(function (slug) {
        var row = museumRow(a, slug);
        if (row) { col.appendChild(row); }
      });
      folger.forEach(function (mark) { col.appendChild(stageRow(a, mark)); });
    }
    var near = nearRow(t);
    if (near) { col.appendChild(near); }
    a.foot = artFoot();
    if (following) { followSection(a, t); }
    // Up from one of its museums: that museum's row, lit, and its mark answers.
    var from = via && typeof via.museum === "string" ? via.museum : null;
    if (from && a.museumRows[from]) {
      var r = a.museumRows[from];
      lightMuseum(from, true);
      requestAnimationFrame(function () {
        if (art !== a) { return; }
        try { r.row.scrollIntoView({ block: "nearest" }); } catch (e) {}
      });
      later(function () {
        lightMuseum(from, false);
        var mc = cityOf(from);
        if (mc && !still) {
          var p = project(mc.lat, mc.lon);
          if (p.z > 0) { pulse(p.x, p.y, [LIGHT, GOLD], 0.6, 144); }
        }
      }, 1600, a);
    }
  }

  /* A museum's row: its diamond, its name and the way in; how many saved
     works it holds; and four of them, each a door into the museum with that
     work first and large. */
  function museumRow(a, slug) {
    var m = museumOf(slug);
    if (!m || !cityOf(slug)) { return null; }
    var row = el("div", "town-museum-row");
    var door = el("button", "town-museum");
    door.type = "button";
    door.setAttribute("aria-label", m.name + " — go into it · " + m.held + " saved");
    var dia = el("span", "town-dia");
    dia.setAttribute("aria-hidden", "true");
    door.appendChild(dia);
    door.appendChild(el("span", "town-museum-name", m.name));
    var go = el("span", "town-go", "›");
    go.setAttribute("aria-hidden", "true");
    door.appendChild(go);
    row.appendChild(door);
    // Its own guide on Bloomberg Connects, beside its name (bloomberg.js; none, nothing).
    var guide = window.Bloomberg && Bloomberg.link(slug, { size: "small", name: m.name });
    if (guide) { row.appendChild(guide); }
    var meta = el("p", "town-museum-meta", m.held + " saved");
    row.appendChild(meta);
    var thumbs = el("div", "town-thumbs");
    var cdn = (museums && museums.cdn) || ART_CDN;
    (m.works || []).slice(0, 4).forEach(function (w) {
      var b = el("button", "town-thumb");
      b.type = "button";
      b.setAttribute("aria-label", (w.t || "Untitled") + (w.a ? ", " + w.a : "") + " — in " + m.name);
      var img = el("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      var key = String(w.i || "").split("/")[0];
      var tries = [cdn + key + "/medium.jpg"];
      img.addEventListener("error", function () {
        if (tries.length) { img.src = tries.shift(); return; }
        b.classList.add("town-thumb-none");
      });
      img.src = cdn + key + "/square.jpg";
      b.appendChild(img);
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        downToMuseum(slug, { work: w.id });
      });
      thumbs.appendChild(b);
    });
    if (thumbs.children.length) { row.appendChild(thumbs); }
    door.addEventListener("click", function (event) { event.stopPropagation(); downToMuseum(slug, {}); });
    row.addEventListener("click", function () { downToMuseum(slug, {}); });
    row.addEventListener("pointerenter", function () { lightMuseum(slug, true); });
    row.addEventListener("pointerleave", function () { lightMuseum(slug, false); });
    row.addEventListener("focusin", function () { lightMuseum(slug, true); });
    row.addEventListener("focusout", function () { lightMuseum(slug, false); });
    a.museumRows[slug] = { row: row, meta: meta, m: m, y0: 0 };
    return row;
  }

  /* Washington's theatre: the Folger, where the plays are. */
  function stageRow(a, mark) {
    var row = el("div", "town-museum-row town-stage");
    var door = el("button", "town-museum");
    door.type = "button";
    door.setAttribute("aria-label", "Go into the " + mark.title + " — the plays");
    var dia = el("span", "town-dia town-ring");
    dia.setAttribute("aria-hidden", "true");
    door.appendChild(dia);
    door.appendChild(el("span", "town-museum-name", mark.title + " · the plays"));
    var go = el("span", "town-go", "›");
    go.setAttribute("aria-hidden", "true");
    door.appendChild(go);
    row.appendChild(door);
    var guide = window.Bloomberg && Bloomberg.link(mark.slug, { size: "small", name: mark.title });
    if (guide) { row.appendChild(guide); }
    function enter(event) { if (event) { event.stopPropagation(); } openMuseum(mark.slug, {}); }
    door.addEventListener("click", enter);
    row.addEventListener("click", enter);
    row.addEventListener("pointerenter", function () { lightMuseum(mark.slug, true); });
    row.addEventListener("pointerleave", function () { lightMuseum(mark.slug, false); });
    a.museumRows[mark.slug] = { row: row, meta: null, m: { works: [], held: 0, name: mark.title }, y0: 0, stage: true };
    return row;
  }

  /* The cities nearest this one, within 500 km: a diamond where a city has
     museums. Each is flown to from here. A city with museums also lists
     every smaller city with museums its diamond can be tied into, or its
     name written over, on the globe (nearMuseums): from here is where they
     are found. */
  function nearRow(t) {
    var list = t.near.slice();
    var mus = nearMuseums(t);
    Object.keys(mus).forEach(function (key) {
      var o = townBy[key];
      if (o && !list.some(function (pair) { return pair[0] === o.i; })) { list.push([o.i, mus[key]]); }
    });
    list.sort(function (a, b) { return a[1] - b[1]; });
    if (!list.length) { return null; }
    var box = el("section", "town-near-box");
    box.appendChild(el("p", "town-section", "Near here"));
    var row = el("div", "town-near-row");
    list.forEach(function (pair) {
      var o = towns[pair[0]];
      if (!o) { return; }
      var b = el("button", "town-near");
      b.type = "button";
      if (o.museums.length) {
        var d = el("span", "town-near-dia", "◆ ");
        d.setAttribute("aria-hidden", "true");
        b.appendChild(d);
      }
      b.appendChild(document.createTextNode(o.name + " · " + pair[1] + " km"));
      b.addEventListener("click", function (event) { event.stopPropagation(); openTown(o.key); });
      row.appendChild(b);
    });
    box.appendChild(row);
    return box;
  }

  /* ---- following an animal (characters.js) ---------------------------------

     The artist, 1 Oct 2026: "When an animal comes up that is associated
     with an artist, I want you to be able to use that animal as an
     additional way to navigate through the globe. Instead of navigating
     through the museums collection and its relation to my Artsy, saved
     artworks, you now have an animal that pertains to a specific artist in
     which you can explore their work. You see how through the global
     interface we were able to generate a context to develop an additional
     interface?"

     Pressed, a character offers to be followed (characters.js). Following,
     the city's column opens on the artist's map (characters/artists.json):
     the artist's works that have been here, each a door to its history;
     then every city the artist's works are or have been in, in the order
     of a route from the artist's home, each a door. Going to one is a
     journey, the animal running ahead along the way and the artist's works
     riding first; arrived, it waits by the museum (or the gallery) that
     holds the work, and the two plantings rise round it. The artist's
     cities are lit wherever the world is seen. Up to the world, or the
     animal pressed again, or "Let it go", and it is over; up from a
     museum to its city, or from a work's history, it goes on. */
  var following = null;                 // { artist, animal, map, ids, home }

  window.Land = {
    follow: function (f) { startFollowing(f); },
    unfollow: function () { endFollowing(true); },
    following: function () { return following && { artist: following.artist, animal: following.animal, cast: following.cast, voice: following.voice || null }; },
    // The walks (walks.js): where you are, and the moves a walk is made of.
    where: function () {
      if (!place) { return { at: flying ? "flying" : "world", flying: flying }; }
      var a = art, o = { flying: flying, key: place.townKey || null, at: "place" };
      if (a && a.kind === "town" && a.town) {
        o.at = "town"; o.key = a.town.key; o.name = a.town.name;
        // Gone down to a place in a life or a studio (Land.studio): the view is
        // that place, named for itself, not for the city of the record nearest it
        // (Fontainebleau is not Yerres). o.town is the city the view stands in.
        var vat = a.via && a.via.at, vst = a.via && a.via.studio;
        if (vat && vat.name) { o.town = a.town.name; o.name = vat.name; o.ll = [vat.lat, vat.lon]; }
        if (vst && vst.life) { o.life = { id: vst.life, k: vst.p, name: vst.name || "" }; }
        else if (vst && vst.i !== undefined) { o.studio = vst.i; }
      }
      else if (a && a.kind === "work" && a.data) { o.at = "work"; o.work = a.data.id; o.key = a.via && a.via.place || null; }
      else if (place.museum) { o.at = "museum"; o.museum = place.museum.slug || null; }
      else if (a) { o.at = a.kind; if (a.data && a.data.id) { o.id = a.data.id; } }
      else if (place.building) { o.at = "building"; o.building = place.building.slug || null; }
      return o;
    },
    // The categories (kinds.js): a city, and any mark on the globe by its slug (a building's is "building-<slug>").
    town: function (key, via) { openTown(key, via); },
    open: function (slug) {
      var c = cityOf(slug);
      if (!c || flying) { return false; }
      if (c.museum) { openMuseum(slug, {}); return true; }
      closeFinder();
      settleSwing();
      if (place === c) { return true; }
      if (place) { hopTo(c); } else { goDown(c); }
      return true;
    },
    go: function (key) { followGo([key]); },
    work: function (id, key) { openArt({ work: id }, key ? { place: key } : {}); },
    up: function () { comeUp(); },
    // Walk the building: a museum by its slug, and where you are inside it.
    museum: function (slug, via) { openMuseum(slug, via || {}); },
    inside: function () { return walkOn && window.Walk ? window.Walk.state() : null; },
    // The characters (characters.js): a point on the screen, the journey
    // under way (from, to, and the towns it has named passing), a thread.
    at: function (lat, lon) {
      // Over a city's skyline a point is where it stands on the skyline (skyline.js), so what the
      // other modules draw at a place (the guide's shows, the dial's ateliers, an animal) stands there too.
      var sk = skyOn() && Skyline.at ? Skyline.at(lat, lon) : null;
      if (sk) { return sk; }
      var p = project(lat * RAD, wrap(lon * RAD)); return { x: p.x, y: p.y, z: p.z };
    },
    journey: function () {
      if (!journey || !route) { return null; }
      return { from: journey.fromKey, to: journey.toKey, u: route.u, done: route.doneAt !== null,
               passed: route.towns.map(function (t) { return t.key; }) };
    },
    thread: function (id) { openArt({ thread: id }); },
    // The corpse (corpse.js): the world turned, rolled and drawn back so a route ([[lat, lon], ...]) is all in view.
    frame: function (pts, hold) { return frameRoute(pts, hold); },
    unframe: function () { framing = null; },
    // Painted here (sites.js): a city held low on a site's point; the world eased round to a point in a view.
    site: function (key, lat, lon, km, name) { openTown(key, { at: { lat: lat, lon: lon, km: km, name: name || "" } }); },
    // The studios (studios.js): a studio's point, low, its column at the head of the city's.
    studio: function (key, lat, lon, km, name, pay) { openTown(key, { at: { lat: lat, lon: lon, km: km, name: name || "" }, studio: pay }); },
    // The place, then (placethen.js): a ground's clod as dots (shapeClod, the
    // museums' and buildings' own), and the city's dial spanned over a period.
    ground: function (slug, lat, lon) {
      return readGround(slug).then(function (g) {
        if (!g || !g.n) { return null; }
        return { g: g, dots: shapeClod({ slug: slug, lat: lat, lon: lon }, g) };
      });
    },
    periodYears: function (y0, y1, ys, at) {
      var a = art;
      if (!a || a.kind !== "town" || !a.live || !(y1 >= y0)) { return false; }
      spanYears(a, y0, y1, ys || [], at);
      return true;
    },
    look: function (lat, lon) { if (!art || !place || flying) { return false; } glideTo(art, lat * RAD, wrap(lon * RAD)); return true; },
    // The lives (lives.js): a life framed on its route, the dial its years.
    life: function (spec) { openLife(spec); },
    // The movements (movements.js): a movement framed on its city and its artists' places, the dial its years.
    movement: function (spec) { openMovement(spec); },
    // The dial as the hub (dialhub.js): what the view's dial is about, its span and its year; and the year set.
    dial: function () {
      var a = art;
      if (!a || !a.live || !artTime || artTime.hidden || !a.dated) { return null; }
      return { kind: a.kind, id: a.data && a.data.id || null, key: a.town ? a.town.key : (a.via && a.via.place) || null,
               artists: a.data && a.data.artists || null, y0: a.y0, y1: a.y1, year: yearAt(a, Math.max(0, a.when)),
               box: artTime, flying: flying };
    },
    dialYear: function (y) {
      var a = art;
      if (!a || !a.dated) { return; }
      a.auto = null;
      a.firstPlay = false;
      a.playing = false;
      a.seg = null;
      a.byHand = true;
      a.whenTo = Math.max(0, Math.min(1, (y + 0.5 - a.y0) / (a.y1 - a.y0)));
      a.dirty = true;
    },
    // The reading layout and its voice (voice.js): what is being read and where
    // the lens is; the lens flown to a voice's distance; the picture of the
    // moment; the tense under the dial's years; the lens and picture swapped.
    reading: function () { return readingState(); },
    // The three parts and the globe's map (for the tests).
    parts: function () { return { parts: partsNow(), away: partsAway() }; },
    flat: function () {
      if (!flat || flat.cv.hidden || !flat.rect) { return null; }
      return { rect: flat.rect, k: flat.k, lat: flat.lat / RAD, lon: flat.lon / RAD,
               shown: (flat.shown || []).map(function (q) { return { x: q.x, y: q.y, named: q.named, title: q.c.title || "" }; }) };
    },
    // The city as a map (for the tests): its zoom, its framing, its ends, where it looks.
    map: function () {
      if (!cityMap()) { return null; }
      var lim = cityLimits();
      return { zoom: zoom, home: art.mapHome && art.mapHome.zoom, lo: lim.lo, hi: lim.hi, away: cityAway(),
               lat: focus.lat / RAD, lon: wrap(spin) / RAD, R: R, fling: !!cityFling };
    },
    // How sharp the globe is drawn (scripts/check_sharp.js): the density of the page's canvases and
    // of the body, against the screen's. Land.pace(false) holds the frame-rate watch (a test on
    // software GL, whose 1-4 frames a second are not a phone's); Land.pace(true) lets it watch again.
    density: function () {
      var b = window.EarthBody && EarthBody.canvas && EarthBody.canvas();
      return { dpr: dpr, native: nativeDpr(), densDiv: densDiv, bodyDiv: bodyDiv, bodyGone: bodyGone, bodyOn: bodyOn(),
               small: globeSmall(), R: R, cx: cx, cy: cy, W: W, H: H,
               body: b ? { w: b.width, h: b.height, cw: b.clientWidth, ch: b.clientHeight, shown: b.style.display !== "none" && !!b.parentNode } : null,
               level: bodyOn() ? EarthBody.levelFor(R, EarthBody.density()) : null };
    },
    pace: function (on) { pace.held = on === false; pace.from = 0; },
    // The grown globe (for the tests): whether it is on, its layer, the way it came, the stored one.
    grown: function () { return { on: grown, layer: layerOn, came: cameLayer, kept: layerKept, box: grownAt && grownAt.box,
                                  tiles: Object.keys(tilesShown).length, own: ownBoxes.length,
                                  tileAt: Object.keys(tilesShown).slice(0, 24).map(function (k) {
                                    var b = tilesShown[k];
                                    return [(b.i + 0.5) * CELL_PX, (b.j + 0.5) * CELL_PX, b.t.key];
                                  }) }; },
    lens: function (spec) { return lensTo(spec); },
    picture: function (spec) { showPicture(spec || null); },
    // A view with no picture at all (voice.js): its band is closed, the globe and the text take the room.
    noPicture: function (on) {
      var a = art;
      if (!a || !readingOn() || !!a.noPicture === !!on) { return; }
      a.noPicture = !!on;
      layoutWork();
      if (!artPlate.hidden) { layoutPlate(null, "rest"); }
      a.keptAt = 0;
    },
    // The picture swipes (voice.js): room is made for its ‹ › outside it.
    swipes: function (on) {
      if (!!artEl.dataset.swipes === !!on) { return; }
      if (on) { artEl.dataset.swipes = "true"; } else { delete artEl.dataset.swipes; }
      if (art && readingOn() && !artPlate.hidden) { layoutPlate(null, null); }
    },
    tense: function (word) { if (art && art.tense !== (word || "")) { art.tense = word || ""; } },
    swap: function (on) { setSwap(on === undefined ? !lensSwapped : !!on); },
    // The transport (transport.js): every dial, a dial of its own where no view's shows, and the
    // picture let down from full screen when a played step brings the next.
    dials: function () { return dials.slice(); },
    makeDial: function (box, range, span, ticks) { return makeDial(box, range, span, ticks); },
    full: function (on) { setFull(!!on); },
    // Held still (a11y.js): the swing, the company, the weather, the shimmer and the first plays stop.
    still: function (on) {
      if (on === undefined) { return still; }
      still = !!on;
      if (still) { settleSwing(); stopFirstPlay(); }
      return still;
    },
    // The globe by keys (a11y.js): turn, roll, nearer or farther, and the place nearest the middle.
    keys: function (key) { return globeKey(key); }
  };

  /* ---- a movement (movements.js) ----------------------------------------------

     The artist, 2 Oct 2026: "using overlaps of artist residencies during a
     time period to define art and social movements … I like the idea I've
     incorporating it on the dial given it's specification of time". A
     movement is a view like a life's: the world framed on its city and its
     artists' places, the column and the marks on the globe movements.js's,
     the dial the movement's years (lifeApi serves both). */
  function openMovement(spec) {
    if (!spec || flying) { return; }
    closeFinder();
    settleSwing();
    artAsked = null;
    var vecs = (spec.pts || []).map(function (p) { return toVec(p[0] * RAD, p[1] * RAD); });
    var f = vecs.length ? frameOf(vecs, null, undefined, "life") : frameHere("life");
    var c = {
      slug: "movement-" + spec.id, title: spec.title, where: spec.where || "",
      lat: f.lat, lon: wrap(f.lon), zoomTo: f.zoomTo, seatAt: f.seatAt, tone: LIGHT,
      art: { kind: "movement", data: spec, via: {} }
    };
    if (place) { hopTo(c); } else { goDown(c); }
  }

  /* ---- a life (lives.js) ----------------------------------------------------

     The artist, 2 Oct 2026: "Implement your idea for Picasso. Find other
     similar instances for notable artists alike so that viewers can focus
     on lives of artists". A life is a view like a thread's: the world framed
     on the whole route, the column and the route on the globe lives.js's,
     the dial the life's years (born to now: after the death, the works'
     afterlife, its ticks quieter). */
  function openLife(spec) {
    if (!spec || flying) { return; }
    closeFinder();
    settleSwing();
    artAsked = null;
    var vecs = (spec.pts || []).map(function (p) { return toVec(p[0] * RAD, p[1] * RAD); });
    var f = vecs.length ? frameOf(vecs, null, undefined, "life") : frameHere("life");
    var c = {
      slug: "life-" + spec.id, title: spec.title, where: spec.where || "",
      lat: f.lat, lon: wrap(f.lon), zoomTo: f.zoomTo, seatAt: f.seatAt, tone: LIGHT,
      art: { kind: "life", data: spec, via: {} }
    };
    if (place) { hopTo(c); } else { goDown(c); }
  }

  function lifeApi(a) {
    return {
      data: a.data, col: artCol, foot: artFoot,
      live: function () { return art === a && a.live; },
      // The dial: the years, the ticks ([{y, kind}]), where it stands, and the first play.
      years: function (y0, y1, ticks, at, first) {
        a.y0 = y0;
        a.y1 = y1 + 0.999;
        a.dated = true;
        a.ticks = [];
        artTicks.textContent = "";
        (ticks || []).forEach(function (tk) {
          var pos = (tk.y - y0) / (a.y1 - y0);
          if (pos < 0 || pos > 1) { return; }
          a.ticks.push(pos);
          var e = el("span", "art-tick");
          e.style.left = (pos * 100).toFixed(2) + "%";
          if (tk.kind) { e.dataset.kind = tk.kind; }
          artTicks.appendChild(e);
        });
        a.ticks.sort(function (m, n) { return m - n; });
        var to = at ? Math.max(0, Math.min(1, (at - y0) / (a.y1 - y0))) : 1;
        a.when = a.whenTo = to;
        a.yearNow = yearAt(a, to);
        if (first && !still && !dialDriven() && firstSeen("l:" + a.data.id)) {
          a.when = a.whenTo = 0;
          a.auto = { at: performance.now() + 900, dur: Math.max(9000, Math.min(16000, 9000 + (y1 - y0) * 45)) };
        }
        artTime.hidden = false;
        showArtYear();
      },
      year: function () { return art === a ? yearAt(a, Math.max(0, a.when)) : null; },
      setYear: function (y) {
        if (art !== a || !a.dated) { return; }
        a.auto = null;
        a.byHand = true;
        a.whenTo = Math.max(0, Math.min(1, (y + 0.1 - a.y0) / (a.y1 - a.y0)));
      },
      glide: function (lat, lon) { if (art === a) { glideTo(a, lat * RAD, wrap(lon * RAD)); } },
      at: function (lat, lon) { var p = project(lat * RAD, wrap(lon * RAD)); return { x: p.x, y: p.y, z: p.z }; },
      band: function () { return artBand("life"); }
    };
  }

  function backName(up) {
    if (up) { return up.name; }
    if (!following) { return "The world"; }
    // On a phone the banner has room for the artist's surname only ("de Kooning").
    var name = following.artist;
    if (W <= 720) {
      var words = name.split(" "), k = words.length - 1;
      while (k > 0 && /^(de|van|von|da|di|del|der|le|la)$/i.test(words[k - 1])) { k -= 1; }
      return "following " + words.slice(k).join(" ");
    }
    return "following " + name;
  }

  function followRow(key) {
    if (!following) { return null; }
    var hit = null;
    following.map.places.forEach(function (r) { if (!hit && r[0] === key) { hit = r; } });
    return hit;
  }

  // The artist's city nearest where you are.
  function followNearest() {
    var here = toVec(focus.lat, focus.lon), best = null, bd = Infinity;
    following.map.places.forEach(function (r) {
      var d = Math.acos(Math.max(-1, Math.min(1, dot3(here, toVec(r[3] * RAD, r[4] * RAD)))));
      if (d < bd) { bd = d; best = r; }
    });
    return best && { row: best, km: bd * 6371 };
  }

  function startFollowing(f) {
    if (!f || !f.map || !f.map.places || !f.map.places.length) { return; }
    if (f.voice) { startVoice(f); return; }
    following = f;
    tilesDirty = true;
    if (place && art && art.kind === "town" && !flying) {
      followSection(art, art.town);
      if (bannerBackTo && !levelUp()) { bannerBackTo.textContent = backName(null); }
      if (!f.to || f.to === art.town.key) { return; }
    }
    // A walk (walks.js) begins at its first stop.
    if (f.to) { followGo([f.to]); return; }
    // Not in a city (a collage's city, a museum, a history): to the artist's nearest.
    var n = followNearest();
    if (n) { followGo(n.row); }
  }

  function endFollowing(tell) {
    if (!following) { return; }
    var was = following;
    following = null;
    tilesDirty = true;
    var box = artCol.querySelector(".follow-box");
    if (box && box.parentNode) { box.parentNode.removeChild(box); }
    if (art && art.museumRows) {
      Object.keys(art.museumRows).forEach(function (slug) { delete art.museumRows[slug].row.dataset.followed; });
    }
    if (bannerBackTo && place && !flying) { bannerBackTo.textContent = backName(levelUp()); }
    if (was && was.voice) {
      if (window.Voices && Voices.unfollowed) { Voices.unfollowed(); }
    } else if (tell && window.Characters && Characters.unfollowed) { Characters.unfollowed(); }
  }

  /* ---- following a voice (voices.js) -----------------------------------------

     The artist, 1 Oct 2026: "Implement your idea about using writers and
     curators as other ways of navigating the globe". A voice is followed
     in the grammar of an animal, but it is not drawn: it is heard. Its
     cities are lit as an artist's are, and its path is drawn in time
     order, a faint dotted line of pixel light (a career is a route). The
     column's box is voices.js's (Voices.box); pressed from a work's view
     it opens there, over the work, with no flight; from the world, the
     first city of the route is flown to. Arrived, voices.js says the
     voice's words about the works there on the reading's slow clock. */
  function startVoice(f) {
    if (following && !following.voice) { endFollowing(true); }
    following = f;
    tilesDirty = true;
    if (place && !flying) {
      voiceBoxHere();
      if (bannerBackTo && !levelUp()) { bannerBackTo.textContent = backName(null); }
      return;
    }
    if (f.map.places[0]) { followGo(f.map.places[0]); }
  }

  function voiceBoxHere() {
    if (!following || !following.voice || !window.Voices || !Voices.box) { return; }
    var old = artCol.querySelector(".follow-box");
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    var key = art && art.kind === "town" && art.town ? art.town.key : null;
    var box = Voices.box(key);
    if (!box) { return; }
    var at = art && art.head && art.head.parentNode === artCol ? art.head.nextSibling : artCol.firstChild;
    artCol.insertBefore(box, at);
    if (!key) { artCol.scrollTop = 0; }
  }

  // The voice's path, in the order of its years: every other tile along each leg, faint.
  function drawVoicePath() {
    var path = following.path || [];
    if (path.length < 2) { return; }
    var S = safeBox(), seen = {};
    ctx.fillStyle = LILAC;
    for (var k = 1; k < path.length; k += 1) {
      var av = toVec(path[k - 1][1] * RAD, path[k - 1][2] * RAD), bv = toVec(path[k][1] * RAD, path[k][2] * RAD);
      var om = Math.acos(Math.max(-1, Math.min(1, dot3(av, bv))));
      if (om < 1e-4) { continue; }
      var steps = Math.max(8, Math.ceil(om * 240));
      for (var s = 0; s <= steps; s += 1) {
        var v = slerp3(av, bv, om, s / steps);
        var p = project(latOf(v), lonOf(v));
        if (p.z < 0.08 || p.x < S.x0 || p.y < S.y0 || p.x > S.x1 || p.y > S.y1) { continue; }
        var i = Math.floor(p.x / CELL_PX), j = Math.floor(p.y / CELL_PX), id = i + "," + j;
        if (seen[id] || (i + j) % 2) { continue; }
        seen[id] = true;
        ctx.globalAlpha = LEVELS[1] * Math.min(1, (p.z - 0.08) * 6);
        ctx.fillRect(i * CELL_PX + 4, j * CELL_PX + 4, CELL_PX - 8, CELL_PX - 8);
      }
    }
    ctx.globalAlpha = 1;
  }

  function followGo(row) {
    if (!row || flying) { return; }
    var t = towns && townBy[row[0]];
    if (!t) {
      readTowns().then(function () { if (towns && townBy[row[0]]) { followGo(row); } });
      return;
    }
    openTown(row[0], { follow: true });
  }

  /* The artist's map, at the head of a city's column: whose, from where;
     the artist's works that have been here, each a door to its history;
     then the artist's cities, in the order of the route from home, each a
     door; and the way to let it go. */
  function followSection(a, t) {
    var f = following;
    if (!f || !a || a.kind !== "town") { return; }
    if (f.voice) { voiceBoxHere(); return; }
    var old = artCol.querySelector(".follow-box");
    if (old && old.parentNode) { old.parentNode.removeChild(old); }
    var m = f.map;
    var row = followRow(t.key);
    var box = el("section", "follow-box");
    box.appendChild(el("p", "town-section follow-head",
      "Following the " + f.animal.toLowerCase() + " · " + f.artist));
    var mine = row ? row[5] : [];
    var said = [];
    if (f.home) { said.push("of " + f.home); }
    said.push(m.works.length + (m.works.length === 1 ? " saved work" : " saved works") + " in " +
              m.places.length + (m.places.length === 1 ? " city" : " cities"));
    box.appendChild(el("p", "town-museum-meta follow-said", said.join(" · ")));
    if (mine.length) {
      box.appendChild(el("p", "town-section", "Here · " + mine.length));
      var held = {};
      (row[6] || []).forEach(function (h) {
        var mu = museumOf(h[0]);
        (mu && mu.works || []).forEach(function (w) { held[w.id] = shortName(mu); });
      });
      var list = el("div", "art-rows follow-works");
      mine.forEach(function (i, k) {
        var w = m.works[i];
        if (!w) { return; }
        var what = held[w[0]] ? "Held · " + held[w[0]] : w[3] ? String(w[3]) : "";
        list.appendChild(artRow(w[0], w[1], f.artist, w[2], what, 0, { place: t.key }, k));
      });
      box.appendChild(list);
      (row[6] || []).forEach(function (h) {
        var r = a.museumRows && a.museumRows[h[0]];
        if (r) { r.row.dataset.followed = "true"; }
      });
    } else {
      var n = followNearest();
      box.appendChild(el("p", "town-museum-meta",
        "None of " + f.artist + "’s saved works here" +
        (n ? " · the nearest: " + n.row[1] + ", " + Math.round(n.km).toLocaleString("en") + " km" : "")));
    }
    box.appendChild(el("p", "town-section", f.artist + "’s cities · " + m.places.length));
    var go = el("div", "town-near-row follow-route");
    m.places.forEach(function (r) {
      var b = el("button", "town-near");
      b.type = "button";
      if (r[6] && r[6].length) {
        var d = el("span", "town-near-dia", "◆ ");
        d.setAttribute("aria-hidden", "true");
        b.appendChild(d);
      }
      b.appendChild(document.createTextNode(r[1] + " · " + r[5].length));
      b.setAttribute("aria-label", r[1] + ", " + r[2] + " — " + r[5].length +
                     (r[5].length === 1 ? " work" : " works") + " by " + f.artist);
      if (r[0] === t.key) { b.setAttribute("aria-current", "true"); b.dataset.here = "true"; }
      b.addEventListener("click", function (event) {
        event.stopPropagation();
        if (r[0] !== t.key) { followGo(r); }
      });
      go.appendChild(b);
    });
    box.appendChild(go);
    var away = el("button", "read-quiet follow-away", "Let the " + f.animal.toLowerCase() + " go");
    away.type = "button";
    away.addEventListener("click", function (event) { event.stopPropagation(); endFollowing(true); });
    box.appendChild(away);
    var at = a.head && a.head.parentNode === artCol ? a.head.nextSibling : artCol.firstChild;
    artCol.insertBefore(box, at);
  }

  /* Where the animal is, each frame: ahead of you along a journey; by the
     museum or gallery that holds the artist's work in a city of the map
     (else the city's middle); nowhere in a museum or a history. */
  function guideFrame(now) {
    if (!window.Characters || !Characters.guide || following.voice) { return; }
    if (flying && journey && route) {
      // A little ahead of the head of the way, along it, on the screen.
      var r = route;
      var v = slerp3(r.av, r.bv, r.om, Math.min(0.996, r.u)), v2 = slerp3(r.av, r.bv, r.om, Math.min(1, r.u + 0.004));
      var p = project(latOf(v), lonOf(v)), q = project(latOf(v2), lonOf(v2));
      var dx = q.x - p.x, dy = q.y - p.y, len = Math.sqrt(dx * dx + dy * dy);
      if (p.z < 0.08 || r.u <= 0.005 || len < 1e-6) { Characters.guide(null); return; }
      var ahead = 48 * Math.min(1, (1 - r.u) * 8);
      var gx = p.x + dx / len * ahead, gy = p.y + dy / len * ahead;
      if (gx < -60 || gy < -60 || gx > W + 60 || gy > H + 60) { Characters.guide(null); return; }
      Characters.guide({ x: gx, y: gy, dir: dx >= 0 ? 1 : -1, run: true });
      return;
    }
    if (flying || !place || !art || art.kind !== "town") { Characters.guide(null); return; }
    var t = art.town;
    var row = followRow(t.key);
    var lat = t.lat, lon = t.lon;
    var wait = row && row[7];
    if (wait && wait[0] === "m") {
      var mc = cityOf(wait[1]);
      if (mc) { lat = mc.lat; lon = mc.lon; }
    } else if (wait && wait[0] === "v") {
      lat = wait[2] * RAD; lon = wrap(wait[3] * RAD);
    }
    // At a studio of the artist's (studios.js), it waits by the studio.
    var sv = art.via && art.via.studio && window.Studios && Studios.data && Studios.data();
    var srow = sv && sv.studios[art.via.studio.i];
    if (srow && sv.artists[srow.a][1] === following.artist) { lat = srow.ll[0] * RAD; lon = wrap(srow.ll[1] * RAD); }
    var at = project(lat, lon);
    if (at.z <= 0) { Characters.guide(null); return; }
    // Below the door and to its left, so its name, its diamond and the names above stay clear.
    Characters.guide({ x: at.x - 40, y: at.y + 40, key: t.key, lat: t.lat / RAD, lon: t.lon / RAD, name: t.name });
  }

  // The artist's cities, lit: a tile each, in lilac, the city you are in left out.
  function drawFollowed() {
    if (following.voice) { drawVoicePath(); }
    var S = safeBox();
    ctx.fillStyle = LILAC;
    following.map.places.forEach(function (r) {
      if (place && place.townKey === r[0] && !flying) { return; }
      var p = project(r[3] * RAD, wrap(r[4] * RAD));
      if (p.z < 0.08 || p.x < S.x0 || p.y < S.y0 || p.x > S.x1 || p.y > S.y1) { return; }
      var i = Math.floor(p.x / CELL_PX), j = Math.floor(p.y / CELL_PX);
      ctx.globalAlpha = LEVELS[r[6] && r[6].length ? 4 : 3] * Math.min(1, (p.z - 0.08) * 6);
      ctx.fillRect(i * CELL_PX + 1, j * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    });
    ctx.globalAlpha = 1;
  }

  /* Every gallery, fair and sale room a saved work has been in here, the
     busiest first, a step quieter than the museums; and last, the works
     whose venue the records do not give. */
  function venueSection(a, pf) {
    var rowsOf = pf.venues.map(function () { return []; });
    var seen = pf.venues.map(function () { return {}; });
    pf.works.forEach(function (r) {
      var i = r[5];
      if (!rowsOf[i] || seen[i][r[0]]) { return; }
      seen[i][r[0]] = true;
      rowsOf[i].push(r);
    });
    var named = [], unnamed = [];
    pf.venues.forEach(function (v, i) {
      if (v[1] || !rowsOf[i].length) { return; }         // a museum's is its row above
      (v[0] ? named : unnamed).push(i);
    });
    named.sort(function (x, y) {
      return rowsOf[y].length - rowsOf[x].length || (pf.venues[x][2] || 9999) - (pf.venues[y][2] || 9999) ||
             String(pf.venues[x][0]).localeCompare(String(pf.venues[y][0]));
    });
    // Come from a history: the venues that hold that work first, open, the
    // work first in them.
    var came = a.via && a.via.work;
    var holding = function (i) { return rowsOf[i].some(function (r) { return r[0] === came; }); };
    if (came) {
      named = named.filter(holding).concat(named.filter(function (i) { return !holding(i); }));
      named.concat(unnamed).forEach(function (i) {
        if (!holding(i)) { return; }
        rowsOf[i] = rowsOf[i].filter(function (r) { return r[0] === came; })
          .concat(rowsOf[i].filter(function (r) { return r[0] !== came; }));
      });
      Object.keys(a.museumRows).forEach(function (slug) {
        var at = pf.venues.some(function (v, i) { return v[1] === slug && rowsOf[i].some(function (r) { return r[0] === came; }); })
          || pf.works.some(function (r) { return r[0] === came && pf.venues[r[5]] && pf.venues[r[5]][1] === slug; });
        if (at) { a.museumRows[slug].row.dataset.came = "true"; }
      });
    }
    var host = el("section", "town-venues");
    if (named.length) {
      host.appendChild(el("p", "town-section town-quiet", "Galleries, fairs and sale rooms · " + named.length));
      var list = el("div", "town-venue-list");
      host.appendChild(list);
      a.venueOrder = named;
      a.venuePager = pageRows(list, named, function (i) {
        var box = venueRow(a, pf, [i], rowsOf[i], pf.venues[i][0]);
        if (came && holding(i)) { openVenue(a, box, true); }
        return box;
      });
    }
    if (unnamed.length) {
      var rows = [], have = {};
      unnamed.forEach(function (i) {
        rowsOf[i].forEach(function (r) { if (!have[r[0]]) { have[r[0]] = true; rows.push(r); } });
      });
      var box = venueRow(a, pf, unnamed, rows, "Venue not recorded · " + rows.length.toLocaleString("en"));
      box.classList.add("town-venue-unnamed");
      host.appendChild(box);
      if (came && have[came] && !named.some(holding)) { openVenue(a, box, true); }
    }
    if (host.children.length) { artCol.insertBefore(host, a.foot); }
  }

  /* A venue: its name, what happened there and when, how many works; open,
     its works, 34 at a time, each a door to its history. */
  function venueRow(a, pf, vis, rows, label) {
    var box = el("div", "town-venue-box");
    var b = el("button", "town-venue");
    b.type = "button";
    b.setAttribute("aria-expanded", "false");
    b.appendChild(el("span", "town-venue-name", label));
    var kinds = [], y0 = 0, y1 = 0;
    rows.forEach(function (r) {
      (r[8] || []).forEach(function (kd) {
        var w = KIND_WORD[kd] || kd;
        if (kinds.indexOf(w) < 0) { kinds.push(w); }
      });
    });
    vis.forEach(function (i) {
      var v = pf.venues[i];
      if (v[2] && (!y0 || v[2] < y0)) { y0 = v[2]; }
      if (v[3] && v[3] > y1) { y1 = v[3]; }
    });
    b.appendChild(el("span", "town-venue-meta", kinds.concat([yearsText(y0, y1),
      rows.length + (rows.length === 1 ? " work" : " works")]).filter(Boolean).join(" · ")));
    box.appendChild(b);
    // A venue with a guide of its own on Bloomberg Connects (bloomberg.js; by its name in this city).
    var guide = vis.length === 1 && window.Bloomberg &&
      Bloomberg.link(Bloomberg.venueKey(a.town.key, pf.venues[vis[0]][0]), { size: "small", name: label });
    if (guide) { box.appendChild(guide); }
    box.rows = rows;
    box.vis = vis;
    box.y0 = y0;
    box.button = b;
    if (a.yearNow && y0 && y0 > a.yearNow) { box.dataset.later = "true"; }
    b.addEventListener("click", function (event) {
      event.stopPropagation();
      if (b.getAttribute("aria-expanded") === "true") { closeVenue(a, box); } else { openVenue(a, box, false); }
    });
    a.venueBoxes.push(box);
    return box;
  }

  function openVenue(a, box, keepOthers) {
    if (!keepOthers) {
      a.venueBoxes.forEach(function (o) { if (o !== box && o.button.getAttribute("aria-expanded") === "true") { closeVenue(a, o); } });
    }
    box.button.setAttribute("aria-expanded", "true");
    var works = el("div", "art-rows town-venue-works");
    box.appendChild(works);
    box.works = works;
    var came = a.via && a.via.work;
    box.pager = pageRows(works, box.rows, function (r, k) {
      var what = (r[8] || []).map(function (kd) { return KIND_WORD[kd] || kd; })
        .filter(function (w, i, all) { return all.indexOf(w) === i; }).join(" · ");
      var fig = artRow(r[0], r[1], r[2], r[3], [what, yearsText(r[6], r[7])].filter(Boolean).join(" "),
                       r[6], { place: a.town.key }, k);
      if (came && r[0] === came) { fig.dataset.came = "true"; }
      return fig;
    });
  }

  function closeVenue(a, box) {
    box.button.setAttribute("aria-expanded", "false");
    if (box.pager) { box.pager.stop(); box.pager = null; }
    if (box.works && box.works.parentNode) { box.works.parentNode.removeChild(box.works); }
    box.works = null;
    a.rows = a.rows.filter(function (r) { return r.el.isConnected; });
  }

  /* The city's marks, placed while you are in it — only when the view or
     what is lit has changed. Its museums (and, in Washington, the Folger)
     at their own doors inside the band, rising one after another the first
     time; each named if it can be: right of its diamond, left, or lifted or
     dropped a line with a hairline back to it, never over another name,
     another museum's diamond, the banner or the column. A name with no room
     comes up while its row or its mark is pointed at. The cities around it
     that are in the band keep their marks, two named at most. */
  function placeTown() {
    var a = art;
    if (!a || a.kind !== "town") { return; }
    if (!townDirty && townAt.spin === spin && townAt.tilt === tilt && townAt.R === R &&
        townAt.cx === cx && townAt.cy === cy && townAt.W === W && townAt.H === H) { return; }
    townDirty = false;
    townAt = { spin: spin, tilt: tilt, R: R, cx: cx, cy: cy, W: W, H: H };
    var t = a.town;
    var b = artBand();
    var box = { x0: b.x + 8, y0: b.y + 8, x1: b.x + b.w - 8, y1: b.y + b.h - 8 };
    var now = performance.now();
    a.risen = a.risen || {};

    // The museums, and the Folger in Washington.
    var list = [];
    t.museums.forEach(function (slug) { var c = cityOf(slug); if (c) { list.push(c); } });
    LANDMARKS.forEach(function (m) { if (m.town === t.key) { var c = cityOf(m.slug); if (c) { list.push(c); } } });
    var items = [], seen = 0;
    list.forEach(function (c) {
      var p = project(c.lat, c.lon);
      if (p.z <= 0 || p.x < box.x0 || p.x > box.x1 || p.y < box.y0 || p.y > box.y1) { townOut(c); return; }
      // The first time, one after another.
      if (!a.risen[c.slug]) { a.risen[c.slug] = now + (still ? 0 : seen * 150); }
      seen += 1;
      if (now < a.risen[c.slug]) { townDirty = true; townOut(c); return; }
      items.push({ city: c, x: p.x, y: p.y });
    });
    var dots = items.map(function (it) { return { x: it.x, y: it.y, r: (it.city.dh || 5) + 3, it: it }; });

    // Museums on top of each other share their dot, their names stacked under it.
    var groups = [];
    items.forEach(function (it) {
      for (var g = 0; g < groups.length; g += 1) {
        var L = groups[g][0];
        if (Math.abs(L.x - it.x) < TOWN_SAME && Math.abs(L.y - it.y) < TOWN_SAME) { groups[g].push(it); return; }
      }
      groups.push([it]);
    });
    // What is pointed at (or tapped) is named first, so the rest keep off it.
    groups.sort(function (g1, g2) {
      var l1 = g1.some(function (it) { return !!it.city.el.dataset.lit; });
      var l2 = g2.some(function (it) { return !!it.city.el.dataset.lit; });
      return (l2 ? 1 : 0) - (l1 ? 1 : 0);
    });
    var given = [];
    function clear(r, own) {
      if (r.x0 < box.x0 || r.x1 > box.x1 || r.y0 < box.y0 || r.y1 > box.y1) { return false; }
      for (var k = 0; k < given.length; k += 1) {
        var o = given[k];
        if (r.x0 < o.x1 + 6 && o.x0 < r.x1 + 6 && r.y0 < o.y1 + 4 && o.y0 < r.y1 + 4) { return false; }
      }
      for (var d = 0; d < dots.length; d += 1) {
        var p = dots[d];
        if (own.indexOf(p.it) >= 0) { continue; }
        if (r.x0 < p.x + p.r && p.x - p.r < r.x1 && r.y0 < p.y + p.r && p.y - p.r < r.y1) { return false; }
      }
      return true;
    }
    groups.forEach(function (g) {
      var L = g[0], c0 = L.city;
      var w = 0, h = 0;
      g.forEach(function (it) { w = Math.max(w, it.city.nw || 0); h += Math.max(LINE, it.city.nh || 0); });
      var gap = c0.gap || 10;
      var lit = g.some(function (it) { return !!it.city.el.dataset.lit; });
      var tries = [["right", 0], ["left", 0], ["right", -TOWN_LIFT], ["left", -TOWN_LIFT], ["right", TOWN_LIFT], ["left", TOWN_LIFT],
                   ["right", -2 * TOWN_LIFT], ["left", -2 * TOWN_LIFT], ["right", 2 * TOWN_LIFT], ["left", 2 * TOWN_LIFT]];
      var chosen = null;
      for (var k = 0; k < tries.length && !chosen; k += 1) {
        var side = tries[k][0], lift = tries[k][1];
        var y0 = L.y + lift - Math.max(LINE, c0.nh || 0) / 2;
        var r = side === "right" ? { x0: L.x + gap, x1: L.x + gap + w, y0: y0, y1: y0 + h }
                                 : { x0: L.x - gap - w, x1: L.x - gap, y0: y0, y1: y0 + h };
        if (clear(r, g)) { chosen = { side: side, lift: lift, r: r }; }
      }
      if (!chosen && lit) {
        // Pointed at: named whatever it lies over, on whichever side is inside.
        var side2 = L.x + gap + w <= box.x1 ? "right" : "left";
        var y2 = L.y - Math.max(LINE, c0.nh || 0) / 2;
        chosen = { side: side2, lift: 0, r: side2 === "right" ? { x0: L.x + gap, x1: L.x + gap + w, y0: y2, y1: y2 + h }
                                                               : { x0: L.x - gap - w, x1: L.x - gap, y0: y2, y1: y2 + h } };
      }
      if (chosen && chosen.r) { given.push(chosen.r); }
      var down = 0;
      g.forEach(function (it) {
        var c = it.city;
        var lift = chosen ? chosen.lift : 0;
        putMark(c, it.x, it.y, chosen ? chosen.side : "right", 1);
        if (c.el.dataset.in !== "town") { c.el.dataset.in = "town"; }
        var shift = "";
        // Each name centred in its own slot of the stack, however many lines it takes.
        var dy = L.y - it.y + lift + down - Math.max(LINE, c0.nh || 0) / 2 + Math.max(LINE, c.nh || 0) / 2;
        var dx = L.x - it.x;
        if (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05) { shift = "translate(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px)"; }
        if (c.shift !== shift) { c.shift = shift; c.name.style.transform = shift; }
        down += Math.max(LINE, c.nh || 0);
        leadTo(c, chosen ? chosen.side : "right", chosen && it === L ? lift : 0);
        nameShown(c, !!chosen);
        if (a.museumRows && a.museumRows[c.slug]) {
          var later_ = a.yearNow && a.museumRows[c.slug].y0 && a.museumRows[c.slug].y0 > a.yearNow;
          if (!!c.el.dataset.later !== !!later_) {
            if (later_) { c.el.dataset.later = "true"; } else { delete c.el.dataset.later; }
          }
        }
      });
    });

    // The cities around it that are in the band: their marks, two named.
    var named = 0;
    (towns || []).forEach(function (o) {
      var c = o.mark;
      if (!c || !c.el) { return; }
      var p = project(o.lat, o.lon);
      var x = p.x, y = p.y;
      if (c.tile) { x = (Math.floor(x / CELL_PX) + 0.5) * CELL_PX; y = (Math.floor(y / CELL_PX) + 0.5) * CELL_PX; }
      if (o === t || p.z <= 0 || x < box.x0 || x > box.x1 || y < box.y0 || y > box.y1) {
        if (c.el.dataset.in === "near") { townOut(c); }
        return;
      }
      if (c.el.dataset.in !== "near") { c.el.dataset.in = "near"; }
      var gap = c.gap || 10, w = c.nw || 0;
      var y0 = y - LINE / 2;
      var right = { x0: x + gap, x1: x + gap + w, y0: y0, y1: y0 + LINE };
      var left = { x0: x - gap - w, x1: x - gap, y0: y0, y1: y0 + LINE };
      var side = named < 2 && w ? (clear(right, []) ? "right" : clear(left, []) ? "left" : null) : null;
      if (side) { given.push(side === "right" ? right : left); named += 1; }
      putMark(c, x, y, side || "right", 1);
      if (c.shift) { c.shift = ""; c.name.style.transform = ""; }
      nameShown(c, !!side);
    });
    // What a gallery's label is to keep clear of: the names, and the museums' diamonds.
    a.nameBoxes = given.concat(dots.map(function (p) { return { x0: p.x - p.r, y0: p.y - p.r, x1: p.x + p.r, y1: p.y + p.r }; }));
  }

  /* A mark out of the city view: back to what the globe makes of it. */
  function townOut(c) {
    if (!c || !c.el) { return; }
    var e = c.el;
    if (e.dataset.in) { delete e.dataset.in; }
    if (e.dataset.lift) { delete e.dataset.lift; }
    if (e.dataset.later) { delete e.dataset.later; }
    if (c.shift) { c.shift = ""; c.name.style.transform = ""; }
    hideMark(c);
  }

  /* Leaving the city: every mark it used goes back to the globe's keeping. */
  function stopTown() {
    cities.forEach(function (c) {
      if (!c.el || !(c.el.dataset.in || c.el.dataset.lit)) { return; }
      delete c.el.dataset.lit;
      townOut(c);
      c.px = null;
    });
    if (venueLabel) { venueLabel.hidden = true; }
    marksDirty = true;
    townDirty = true;
  }

  /* The galleries whose address is known, as tiles of light inside the band:
     brighter the more works have been there, let down where the slider is
     earlier than their first year. */
  function drawVenues() {
    var a = art, t = a.town;
    var b = artBand();
    var pf = a.pf;
    var best = {};
    galleryPoints(t, pf).forEach(function (g) {
      var p = project(g.lat, g.lon);
      if (p.z <= 0 || p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) { return; }
      var n = a.venueWorks ? a.venueWorks[g.vi] || 1 : 1;
      var level = !pf ? 1 : n > 8 ? 3 : n > 1 ? 2 : 1;
      var alpha = LEVELS[level];
      var v = pf && pf.venues[g.vi];
      if (v && a.yearNow && v[2] && v[2] > a.yearNow) { alpha *= 0.34; }
      var i = Math.floor(p.x / CELL_PX), j = Math.floor(p.y / CELL_PX);
      if (underTownName(a, i, j)) { return; }
      var key = i * 4096 + j;
      if (!best[key] || best[key].a < alpha) { best[key] = { i: i, j: j, a: alpha }; }
    });
    ctx.fillStyle = LIGHT;
    Object.keys(best).forEach(function (key) {
      var c = best[key];
      ctx.globalAlpha = c.a;
      ctx.fillRect(c.i * CELL_PX + 1, c.j * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
    });
    ctx.globalAlpha = 1;
  }

  /* A tile a museum's name or diamond lies over is not lit, nor pressed:
     a press there is the museum's. Its gallery is in the column. */
  function underTownName(a, i, j) {
    var boxes = a.nameBoxes || [];
    var x0 = i * CELL_PX, y0 = j * CELL_PX, x1 = x0 + CELL_PX, y1 = y0 + CELL_PX;
    for (var k = 0; k < boxes.length; k += 1) {
      var o = boxes[k];
      if (x0 < o.x1 && o.x0 < x1 && y0 < o.y1 && o.y0 < y1) { return true; }
    }
    return false;
  }

  /* The gallery tile a press landed on, within one tile. */
  function hitVenue(x, y) {
    var a = art;
    if (!a || !a.town) { return null; }
    var b = artBand();
    var best = null, near = CELL_PX;
    galleryPoints(a.town, a.pf).forEach(function (g) {
      var p = project(g.lat, g.lon);
      if (p.z <= 0 || p.x < b.x || p.x > b.x + b.w || p.y < b.y || p.y > b.y + b.h) { return; }
      if (underTownName(a, Math.floor(p.x / CELL_PX), Math.floor(p.y / CELL_PX))) { return; }
      var tx = (Math.floor(p.x / CELL_PX) + 0.5) * CELL_PX, ty = (Math.floor(p.y / CELL_PX) + 0.5) * CELL_PX;
      var d = Math.max(Math.abs(tx - x), Math.abs(ty - y));
      if (d <= near) { near = d; best = { g: g, x: tx, y: ty, i: Math.floor(p.x / CELL_PX), j: Math.floor(p.y / CELL_PX) }; }
    });
    return best;
  }

  /* A gallery's tile pressed: it answers, says what it is beside itself,
     and its row in the column opens. */
  function showVenue(hit) {
    var a = art, pf = a && a.pf;
    pulse(hit.x, hit.y, [LIGHT, LILAC], 0.5, 89);
    if (!pf) { return; }
    var v = pf.venues[hit.g.vi];
    if (!v) { return; }
    if (!venueLabel) {
      venueLabel = el("p", "venue-label");
      venueLabel.setAttribute("aria-live", "polite");
      land.appendChild(venueLabel);
    }
    // Only its name: on the ground only places are named; when it was
    // here and how much are in its row, which the press opens.
    venueLabel.textContent = "";
    venueLabel.appendChild(el("span", "venue-label-name", v[0]));
    venueLabel.hidden = false;
    var w = venueLabel.offsetWidth, h = venueLabel.offsetHeight;
    var band = artBand();
    // Beside its tile, inside the band, over no museum's name or diamond:
    // right, left, above, below, the first that is clear; where none is,
    // whichever covers least.
    var half = CELL_PX / 2;
    var avoid = (a.nameBoxes || []).concat([{ x0: hit.x - half, y0: hit.y - half, x1: hit.x + half, y1: hit.y + half }]);
    var lo = { x: band.x + 8, y: band.y + 8 }, hi = { x: band.x + band.w - 8 - w, y: band.y + band.h - 8 - h };
    var best = null;
    [[hit.x + half + 4, hit.y - h / 2], [hit.x - half - 4 - w, hit.y - h / 2],
     [hit.x - w / 2, hit.y - half - 4 - h], [hit.x - w / 2, hit.y + half + 4],
     [hit.x - half, hit.y - half - 4 - h], [hit.x + half - w, hit.y - half - 4 - h],
     [hit.x - half, hit.y + half + 4], [hit.x + half - w, hit.y + half + 4]].forEach(function (xy) {
      var x = Math.max(lo.x, Math.min(hi.x, xy[0])), y = Math.max(lo.y, Math.min(hi.y, xy[1]));
      var cover = 0;
      avoid.forEach(function (o) {
        var ox = Math.min(x + w, o.x1 + 4) - Math.max(x, o.x0 - 4), oy = Math.min(y + h, o.y1 + 4) - Math.max(y, o.y0 - 4);
        if (ox > 0 && oy > 0) { cover += ox * oy; }
      });
      if (!best || cover < best.cover) { best = { x: x, y: y, cover: cover }; }
    });
    venueLabel.style.transform = "translate(" + best.x.toFixed(0) + "px," + best.y.toFixed(0) + "px)";
    // Its row: paged on until it is there, opened, and brought into view.
    var box = null;
    var at = a.venueOrder ? a.venueOrder.indexOf(hit.g.vi) : -1;
    if (at >= 0 && a.venuePager) { a.venuePager.until(at); }
    a.venueBoxes.forEach(function (o) { if (o.vis.indexOf(hit.g.vi) >= 0) { box = o; } });
    if (box) {
      if (box.button.getAttribute("aria-expanded") !== "true") { openVenue(a, box, false); }
      // At the top of the column, so its works are there under it to see.
      try { box.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" }); } catch (e) {}
    }
  }

  /* ---- opening a view ------------------------------------------------------

     A work, a place or a thread is a place like a city — {art, lat, lon,
     zoomTo, seatAt} — flown down to by goDown, or hopped to by hopTo, so the
     banner, the way back, pinching in and out and Escape are all a city's.
     It is flown only as far as its history needs. */

  function openArt(spec, via) {
    if (!ARTWORKS || flying) { return; }
    // A place is its city now, on the Museums layer.
    if (spec.place) { openTown(spec.place, via); return; }
    via = via || {};
    var fromFind = finder.open;
    closeFinder();
    settleSwing();
    var path = spec.work ? "histories/" + spec.work + ".json" : "threads/" + spec.thread + ".json";
    var asked = artAsked = {};
    Promise.all([readPlaces(), readArt(path)]).then(function (both) {
      var d = both[1];
      if (asked !== artAsked || flying) { return; }
      if (!d || !both[0]) { unread(fromFind); return; }
      var c = spec.work ? workCity(d) : threadCity(d);
      c.art.via = via;
      if (place) { hopTo(c); } else { goDown(c); }
    });
  }

  /* What was pressed could not be read (the network, most likely): said
     where it was pressed — in Find, or on the thread being said — and left
     to be pressed again. */
  function unread(fromFind) {
    var words = "That could not be read just now.";
    if (fromFind && !place) {
      openFinder();
      if (finderSaid) { finderSaid.textContent = words; }
    } else if (art && art.stage) {
      quiet(art);
      var box = el("div", "read-said art-said");
      box.appendChild(el("p", "read-only", words));
      art.stage.appendChild(box);
      requestAnimationFrame(function () { box.dataset.on = "true"; });
    } else if (buildingOn && buildingWorks) {
      // In a museum: said on the work's own way to its history.
      var go = buildingWorks.querySelector('.held[data-open="true"] .held-history');
      if (go) { go.textContent = words; }
    }
  }

  /* Where the globe is framed beside the column: on a phone the band above
     the column; on a desktop, left of it. In the reading layout, the lens. */
  function artBand(kind) {
    kind = kind || (art && art.kind);
    if (readKind(kind)) { return workBands().globe; }
    if (W <= 720) { return { x: 0, y: 68, w: W, h: H * 0.5 - 120 }; }
    return { x: 0, y: 68, w: W - Math.min(0.4 * W, 440), h: H - 148 };
  }

  /* ---- the reading layout, and the lens ------------------------------------

     A work's view keeps the work in sight (artist, 1 Oct 2026: "I want a
     viewer to be able to look at a big enough image of the artwork"). And
     every path is read so (artist, 2 Oct 2026, of a work's view on his
     phone: "I really liked the layout in this perspective with the globe
     that small next to the dial and a big image above it with scrollable
     text below. Find a way to incorporate [this]. Think about the different
     ways we are defining these paths and how that relates to the viewers
     distance from the globe … Think about different tenses and perspectives
     novels are written in"): a work, a life, a movement, a thread — the
     picture (the work being read, or the work of that moment) above or
     left, the lens (the world in a round window) beside the dial, the text
     below or right. How far the lens stands from the world is the voice the
     path is told in (voice.js, VOICE.md): from above, from afar, over the
     shoulder, where they stood. `look` is where a work's photograph is first
     seen alone, `plate` where the picture rests, `globe` the box the world is
     framed in (the lens's square), `lens` the round window, `cap` the line
     under the picture where the voice speaks. A tap on the lens swaps it
     with the picture: the big place is the world's, at the same distance. */
  var workImage = false;
  var LENS = true;                         // false: only a work's view keeps its picture, and no lens
  var READ_KINDS = { life: 1, movement: 1, thread: 1 };
  var lensSwapped = false;                 // the lens and the picture swapped (a tap on the lens)
  var readSerial = 0;                      // each view read, for voice.js
  function readKind(kind) {
    if (kind === "work") { return workImage; }
    return LENS && !!READ_KINDS[kind];
  }
  function readingOn() { return !!(art && art.live && readKind(art.kind)); }
  function workBands() {
    var colW = Math.min(0.4 * W, 440), lens = LENS;
    var b;
    if (W <= 720) {
      // Under the banner, which a long title takes to two lines; the globe
      // framed left of the dial, which stands at the right of its band.
      var under = banner && !banner.hidden ? bannerUnder.getBoundingClientRect().bottom : 0;
      var top = Math.max(74, Math.round(under + 10)), ph = Math.round(0.33 * H), colTop = Math.round(0.64 * H);
      // A view with no picture to show (artist, 7 Oct 2026): no empty band; its sentence, then the globe.
      if (art && art.noPicture && partsNow().picture === "big") { ph = lens ? 58 : 0; colTop = Math.round(0.56 * H); }
      var gy = top + ph + 6, cap = lens ? 52 : 0;
      var globe = { x: 0, y: gy, w: dialMoved() ? W : W - 148, h: Math.max(96, colTop - gy) };
      var lr = Math.max(40, Math.min(globe.w, globe.h) / 2 - 12);
      b = { plate: { x: 16, y: top, w: W - 32, h: ph - cap }, look: { x: 16, y: top, w: W - 32, h: colTop - top - 14 },
            cap: { x: 16, y: top + ph - cap + 2, w: W - 32, h: cap - 2 },
            lens: { x: globe.x + globe.w / 2, y: globe.y + globe.h / 2 + 3, r: lr },
            dial: { x: W - 136 - 12, y: Math.round(gy + (globe.h - 136) / 2) },
            colTop: colTop, phone: true };
    } else {
      var pw = art && art.noPicture && partsNow().picture === "big" ? 0 : Math.round(Math.min(0.34 * W, 560)), capD = lens ? 64 : 0;
      var plate = { x: 24, y: 84, w: pw, h: H - 84 - 36 - capD };
      var gx = plate.x + pw + 16, band = { x: gx, y: 68, w: Math.max(200, W - colW - gx), h: H - 148 };
      // The lens over the dial, the pair in the middle of the band's height.
      var avail = H - 24 - 88;
      var r = Math.max(60, Math.min(band.w / 2 - 30, (avail - 168 - 26) / 2));
      var groupTop = 88 + Math.max(0, (avail - (2 * r + 26 + 168)) / 2);
      b = { plate: plate, look: { x: 21, y: 76, w: W - colW - 42, h: H - 76 - 36 },
            cap: { x: plate.x, y: plate.y + plate.h + 6, w: pw, h: capD - 6 },
            lens: { x: band.x + band.w / 2, y: groupTop + r, r: r },
            dial: { x: Math.round(band.x + band.w / 2 - 84), y: Math.round(groupTop + 2 * r + 26) },
            colTop: 0, phone: false };
      if (!lens) { b.dial = { x: Math.round(gx + (band.w - 168) / 2), y: Math.round(band.y + band.h - 168 + 44) }; }
      b.band = band;
    }
    if (!lens) {
      b.globe = W <= 720 ? globe : b.band;
      return b;
    }
    // Three places — the big one, the small one beside the dial, the dial's own — and three parts in
    // them, the globe, the picture and the dial (artist, 7 Oct 2026: "throw the dial into the mix as
    // far interchangeable parts … Each one should adapt to its new shape but maintain its
    // functionality"). At home the picture is big, the globe small and the dial in its place.
    var L = b.lens, DS = b.phone ? 136 : 168;
    var sq = { x: L.x - L.r, y: L.y - L.r, w: 2 * L.r, h: 2 * L.r };
    var big = { x: b.plate.x, y: b.plate.y, w: b.plate.w, h: b.plate.h + (b.cap.h || 0) };
    var dsl = { x: b.dial.x, y: b.dial.y, w: DS, h: DS };
    var slots = { big: big, small: sq, dial: dsl };
    var P = partsNow();
    b.slots = slots;
    b.parts = P;
    if (P.globe === "big") {
      b.hole = { x: big.x, y: big.y, w: big.w, h: big.h, round: 4 };
      b.globe = big;
      b.lensAt = { x: big.x + big.w / 2, y: big.y + big.h / 2, r: Math.min(big.w, big.h) / 2 };
    } else {
      var gs = slots[P.globe], gr = P.globe === "small" ? L.r : DS / 2 - 4;
      var gx0 = gs.x + gs.w / 2, gy0 = gs.y + gs.h / 2;
      b.hole = { x: gx0 - gr, y: gy0 - gr, w: 2 * gr, h: 2 * gr, round: -1 };
      b.globe = { x: b.hole.x, y: b.hole.y, w: b.hole.w, h: b.hole.h };
      b.lensAt = P.globe === "small" ? L : { x: gx0, y: gy0, r: gr };
    }
    if (P.picture !== "big") {
      var ps = slots[P.picture];
      b.plate = { x: ps.x + 8, y: ps.y + 8, w: ps.w - 16, h: ps.h - 16 };
    }
    if (P.dial === "big") {
      b.dialBand = big;
      b.dial = { x: Math.round(big.x), y: Math.round(big.y) };
    } else if (P.dial === "small") {
      b.dial = { x: Math.round(sq.x + (sq.w - DS) / 2), y: Math.round(sq.y + (sq.h - DS) / 2) };
    }
    return b;
  }

  /* The view's measures, for the column, the dial, the lens and the ground
     under the picture (land.css, "a work's view"; voice.css). */
  function layoutWork() {
    var st = artEl.style;
    ["--work-col-top", "--work-dial-left", "--work-dial-top", "--work-edge-x", "--work-edge-y",
     "--hole-x", "--hole-y", "--hole-w", "--hole-h", "--hole-round", "--band-w", "--band-h"].forEach(function (k) {
      st.removeProperty(k);
    });
    if (!art || !readKind(art.kind)) {
      delete artEl.dataset.plate; delete artEl.dataset.read; delete artEl.dataset.swapped; delete artEl.dataset.parts;
      if (artTime) { delete artTime.dataset.slot; delete artTime.dataset.form; }
      lensOut = false;
      delete artEl.dataset.out;
      clipWorld(null);
      placeLensHome();
      return;
    }
    artEl.dataset.plate = "true";
    if (LENS) { artEl.dataset.read = "true"; } else { delete artEl.dataset.read; }
    if (lensSwapped) { artEl.dataset.swapped = "true"; } else { delete artEl.dataset.swapped; }
    var b = workBands(), phone = b.phone;
    if (b.colTop) { st.setProperty("--work-col-top", b.colTop + "px"); }
    st.setProperty("--work-dial-left", b.dial.x + "px");
    st.setProperty("--work-dial-top", b.dial.y + "px");
    if (phone) { st.setProperty("--work-edge-y", (b.plate.y + b.plate.h + 4) + "px"); }
    else { st.setProperty("--work-edge-x", (b.plate.x + b.plate.w + 8) + "px"); }
    if (b.hole) {
      st.setProperty("--hole-x", b.hole.x.toFixed(1) + "px");
      st.setProperty("--hole-y", b.hole.y.toFixed(1) + "px");
      st.setProperty("--hole-w", b.hole.w.toFixed(1) + "px");
      st.setProperty("--hole-h", b.hole.h.toFixed(1) + "px");
      st.setProperty("--hole-round", b.hole.round < 0 ? "50%" : b.hole.round + "px");
    }
    // The three parts: where the dial stands, and in what form.
    var PP = b.parts || PARTS0;
    artEl.dataset.parts = PP.globe.charAt(0) + PP.picture.charAt(0) + PP.dial.charAt(0);
    if (artTime) {
      if (PP.dial !== "dial") { artTime.dataset.slot = PP.dial; } else { delete artTime.dataset.slot; }
      if (b.dialBand) {
        artTime.dataset.form = "band";
        st.setProperty("--band-w", Math.round(b.dialBand.w) + "px");
        st.setProperty("--band-h", Math.round(b.dialBand.h) + "px");
      } else { delete artTime.dataset.form; }
    }
    if (dialSwapEl) {
      var bigDial = PP.dial === "big";
      dialSwapEl.textContent = bigDial ? "\u2199" : "\u2922";
      dialSwapEl.setAttribute("aria-label", bigDial ? "The dial back to its place" : "The dial in the big place");
      dialSwapEl.title = bigDial ? "Back to its place" : "The dial, large";
    }
    if (lensVeil) { lensVeil.hidden = !LENS; }
    clipWorld(b);
  }
  // The dial's way into the big place (and back): one press, and the keyboard's (DISPLAY.md 2.5.7).
  var dialSwapEl = null;
  if (artTime) {
    dialSwapEl = el("button", "dial-swap", "\u2922");
    dialSwapEl.type = "button";
    dialSwapEl.setAttribute("aria-label", "The dial in the big place");
    dialSwapEl.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    dialSwapEl.addEventListener("click", function (event) {
      event.stopPropagation();
      if (partsNow().dial === "big") { partsHome(); } else { swapWithBig("dial"); }
    });
    artTime.appendChild(dialSwapEl);
  }

  /* The world itself is drawn only in the lens (every canvas of the stage
     that is the world's: its body, its weave, its light, the routes drawn on
     it), so nothing of it shows round the banner. Growing into the big
     place it is let out at once, the window opening over it; shrinking back
     it is closed in once the window has. */
  var clipShut = 0;
  function clipWorld(b) {
    window.clearTimeout(clipShut);
    var on = !!(b && b.hole && LENS && art && art.live && readKind(art.kind)) && !lensOut;
    // The globe flattened into a map in the big place: the round world is not drawn at all.
    if (on && mapOn()) {
      stage.dataset.lens = "round";
      stage.style.setProperty("--lens-clip", "circle(0px at -20px -20px)");
      return;
    }
    if (!on) {
      delete stage.dataset.lens;
      stage.style.removeProperty("--lens-clip");
      return;
    }
    var h = b.hole;
    var clip = h.round < 0
      ? "circle(" + (h.w / 2).toFixed(1) + "px at " + (h.x + h.w / 2).toFixed(1) + "px " + (h.y + h.h / 2).toFixed(1) + "px)"
      : "inset(" + h.y.toFixed(1) + "px " + (W - h.x - h.w).toFixed(1) + "px " + (H - h.y - h.h).toFixed(1) + "px " + h.x.toFixed(1) + "px round 4px)";
    var shrinking = stage.dataset.lens === "rect" && h.round < 0 && !still;
    function put() {
      stage.dataset.lens = h.round < 0 ? "round" : "rect";
      stage.style.setProperty("--lens-clip", clip);
    }
    if (shrinking) { clipShut = window.setTimeout(put, 820); } else { put(); }
  }

  /* Whether a point of the screen is in the lens (or, swapped, in the big
     place the world has taken). */
  function inLens(x, y) {
    if (!readingOn() || !LENS) { return false; }
    if (lensOut) { return Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) <= R; }
    var b = workBands(), h = b.hole;
    if (h.round < 0) {
      var L = b.lensAt;
      return Math.sqrt((x - L.x) * (x - L.x) + (y - L.y) * (y - L.y)) <= L.r;
    }
    return x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h;
  }

  /* Whether a point is the small globe's ground for two fingers or a wheel
     (artist, 7 Oct 2026: "no matter what, if there is a globe in view …
     bigger and smaller however they please"): anywhere in the reading layout
     but the text column, the picture (and its own pinch) and the banner —
     the lens, round it, the dial, an animal on its rim, the dark between. */
  function globeZone(x, y) {
    if (!readingOn() || !LENS) { return false; }
    if (artEl.dataset.full) { return false; }
    if (mapOn() && flat && flat.rect && x >= flat.rect.x && x <= flat.rect.x + flat.rect.w && y >= flat.rect.y && y <= flat.rect.y + flat.rect.h) { return false; }
    function inRect(e) {
      if (!e || e.hidden) { return false; }
      var r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }
    if (banner && !banner.hidden && inRect(banner)) { return false; }
    if (artCol && getComputedStyle(artCol).visibility !== "hidden" && inRect(artCol)) { return false; }
    // The picture where it rests (its box without the step aside it may be taking).
    if (artPlate && !artPlate.hidden && !lensOut && artEl.dataset.look !== "plate") {
      var px = artPlate.offsetLeft, py = artPlate.offsetTop, pw = artPlate.offsetWidth, ph = artPlate.offsetHeight;
      if (pw > 0 && x >= px && x <= px + pw && y >= py && y <= py + ph) { return false; }
    }
    return true;
  }

  /* The lens's veil: the dark the lens is a window in (a hole whose shadow
     is the dark, so the round window and the swapped rectangle are one
     element, and the swap is one transition). Laid in once, under the
     picture, the column and the dial. */
  var lensVeil = null;
  if (artEl) {
    lensVeil = el("div", "lens-veil");
    lensVeil.setAttribute("aria-hidden", "true");
    lensVeil.appendChild(el("div", "lens-hole"));
    var washEl = artEl.querySelector(".art-wash");
    artEl.insertBefore(lensVeil, washEl ? washEl.nextSibling : artEl.firstChild);
  }

  /* ---- the lens's distance: the narrative voice ----------------------------

     voice.js says which voice a step is told in (VOICE.md); here it is a
     distance. omniscient: the Earth, or everything the step names, from as
     far as it takes — a movement whose artists came from all over is seen
     whole. panoramic: a region, both ends of a way. close: the city, over
     the shoulder — the figure a little behind the middle, the way ahead in
     front. first: the ground where they stood (DIRT Earth, in the lens).
     Between two, a flight in log space, rising to see both where they are
     far apart, as a journey does; calm, never a cut (under reduced motion,
     a jump). */
  var KM_CLOSE = 48;                       // the city, across the lens
  function closeKm(rl) {
    // Always wider than the ground of the first person, which is DIRT
    // Earth's at its own scale (two device pixels a cell, 932 cells a degree).
    var dirtKm = 2 * rl * (window.devicePixelRatio || 1) / 2 * (111.2 / 932);
    return Math.max(KM_CLOSE, 1.5 * dirtKm);
  }
  function lensTarget(spec) {
    var b = workBands(), L = b.lensAt, rl = L.r;
    var pts = (spec.pts || []).filter(function (p) { return p && isFinite(p[0]) && isFinite(p[1]); })
      .map(function (p) { return toVec(p[0] * RAD, p[1] * RAD); });
    var c = spec.at && isFinite(spec.at[0]) ? toVec(spec.at[0] * RAD, spec.at[1] * RAD) : null;
    if (!c && pts.length) {
      var sum = [0, 0, 0];
      pts.forEach(function (v) { sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; });
      c = norm3(sum);
    }
    if (!c) { c = toVec(focus.lat, focus.lon); }
    var theta = 0;
    pts.forEach(function (v) { theta = Math.max(theta, Math.acos(Math.max(-1, Math.min(1, dot3(c, v))))); });
    var voice = spec.voice || "panoramic", Rt;
    if (LENS_GLOBE) {
      // The distance is the viewer's (artist, 2 Oct 2026): the whole small
      // globe at rest, as near as two fingers have brought it; the voice
      // only turns it to face what is being read.
      return { lat: latOf(c), lon: lonOf(c), R: lensRestR(b) * lensK(), seat: { x: L.x / W, y: L.y / H }, voice: voice };
    }
    if (voice === "first") {
      Rt = groundR();
    } else if (voice === "close") {
      var Rc = rl / (closeKm(rl) / 2 / 6371);
      Rt = pts.length > 1 && theta > 1e-4 ? Math.min(Rc, 0.72 * rl / Math.sin(Math.min(theta, 1.2))) : Rc;
      Rt = Math.max(Rt, rl / (900 / 6371));
    } else if (voice === "panoramic") {
      var th = Math.max(4 * RAD, Math.min(40 * RAD, theta * 1.08));
      Rt = 0.8 * rl / Math.sin(th);
    } else {
      var to = Math.max(14 * RAD, theta * 1.06);
      Rt = to >= 72 * RAD ? 0.56 * rl : Math.max(0.56 * rl, 0.8 * rl / Math.sin(to));
    }
    // Over the shoulder: the figure a little behind the middle, so more of
    // the way ahead is in the lens (from where they came, on the screen).
    var sx = L.x, sy = L.y;
    if (voice === "close" && spec.from && c && pts.length <= 1) {
      var fv = toVec(spec.from[0] * RAD, spec.from[1] * RAD);
      var far = Math.acos(Math.max(-1, Math.min(1, dot3(c, fv))));
      if (far > 0.002) {
        var dx = shortest(spec.from[1] * RAD, lonOf(c)) * Math.cos(latOf(c)), dy = -(latOf(c) - spec.from[0] * RAD);
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        sx -= dx / len * 0.3 * rl;
        sy -= dy / len * 0.3 * rl;
      }
    }
    return { lat: latOf(c), lon: lonOf(c), R: Rt, seat: { x: sx / W, y: sy / H }, voice: voice };
  }

  function lensTo(spec) {
    var a = art;
    if (!a || !place || !readingOn() || !spec) { return false; }
    a.lensSpec = spec;
    var t = lensTarget(spec);
    a.glide = null;
    a.snap = null;
    var z1 = t.R / Math.max(1, baseR);
    if (t.voice !== "first" || LENS_GLOBE) { lensGroundOff(); }
    if (still || spec.now || flying || dive.on) {
      a.lens = null;
      if (flying || dive.on) { return true; }
      zoom = z1;
      focus.lat = t.lat;
      lean(t.lat);
      spin = wanted = t.lon;
      place.seatAt = t.seat;
      place.zoomTo = zoom;
      reframe();
      lensArrived(a, t);
      lensOutCheck();
      return true;
    }
    var la = Math.log(Math.max(1e-6, zoom)), lb = Math.log(z1);
    var from = toVec(focus.lat, spin), to = toVec(t.lat, t.lon);
    var apart = Math.acos(Math.max(-1, Math.min(1, dot3(from, to))));
    var rl = workBands().lensAt.r;
    var zFit = apart > 1e-5 ? 0.8 * rl / Math.sin(Math.min(apart, 80 * RAD)) / Math.max(1, baseR) : Infinity;
    var m = (la + lb) / 2, dip = zFit < 0.8 * Math.min(zoom, z1);
    if (dip) { m = 2 * Math.log(zFit) - (la + lb) / 2; }
    var travel = Math.abs(la - m) + Math.abs(m - lb);
    var seat0 = place.seatAt ? { x: place.seatAt.x, y: place.seatAt.y } : { x: 0.5, y: 0.5 };
    a.lens = { la: la, lb: lb, m: m, dip: dip, lat0: focus.lat, lat1: t.lat, lon0: spin, dLon: shortest(spin, t.lon),
               s0: seat0, s1: t.seat, at: performance.now(), t: t,
               dur: spec.snap ? LENS_SNAP_MS : Math.max(1100, Math.min(4200, 1100 + 560 * travel)), snap: !!spec.snap };
    return true;
  }

  function stepLens(a, now) {
    if (a.snap && !flying && !dive.on) {
      // The size sprung back to rest, where it was turned.
      var qs = Math.min(1, (now - a.snap.at) / LENS_SNAP_MS);
      zoom = Math.exp(a.snap.la + (a.snap.lb - a.snap.la) * springEase(qs));
      reframe();
      handledAt = now;
      a.dirty = true;
      tilesDirty = true;
      marksDirty = true;
      if (qs >= 1) { a.snap = null; place.zoomTo = zoom; drawn.r = 0; }
      lensOutCheck();
    }
    if (LENS_GLOBE && !a.lens) { lensKeep(a, now); }
    var f = a.lens;
    if (!f || flying || dive.on) { return; }
    var q = Math.min(1, (now - f.at) / f.dur), s = f.snap ? springEase(q) : q * q * (3 - 2 * q);
    var lz = (1 - s) * (1 - s) * f.la + 2 * s * (1 - s) * f.m + s * s * f.lb;
    zoom = Math.exp(lz);
    // Rising to see both, the turning is done up high.
    var u = f.dip ? smooth01((s - 0.12) / 0.76) : s;
    focus.lat = f.lat0 + (f.lat1 - f.lat0) * u;
    lean(focus.lat);
    spin = wanted = f.lon0 + f.dLon * u;
    place.seatAt = { x: f.s0.x + (f.s1.x - f.s0.x) * s, y: f.s0.y + (f.s1.y - f.s0.y) * s };
    reframe();
    handledAt = now;                 // magnified on the way, laid down whole on arrival
    a.dirty = true;
    tilesDirty = true;
    if (q >= 1) {
      a.lens = null;
      place.zoomTo = zoom;
      lensArrived(a, f.t);
    }
    lensOutCheck();
  }

  function lensArrived(a, t) {
    drawn.r = 0;
    marksDirty = true;
    a.dirty = true;
    if (LENS_GLOBE) { if (!bodyOn()) { weave(R > 2 * Math.max(W, H) ? { lat: t.lat, lon: t.lon } : null); } return; }
    if (!bodyOn()) { weave(t.voice === "close" || t.voice === "first" ? { lat: t.lat, lon: t.lon } : null); }
    if (t.voice === "first") { lensGroundOn(t.lat / RAD, wrap(t.lon) / RAD); }
  }

  /* ---- the small globe, the viewer's ---------------------------------------

     The artist, 2 Oct 2026, of the lens: "it has changed to a sort of
     microscope when I want it to be how it was before, an entire globe you
     can twirl around with small swipes on it while it's still displayed the
     cities … potentially become bigger and break that kind of for plane …
     make it as big and small as you want … its resting form is as that small
     globe that you can rotate, but you can pinch it … and implement a snap".
     So the lens rests on the whole Earth, small (LENS_REST of the window);
     the voices only turn it to face what is read. Two fingers, a wheel or a
     trackpad's pinch on it make it bigger or smaller, about the point
     between the fingers, from LENS_LEAST of rest to the front globe's own
     nearest; past the window it is let out (the veil lifts, the clip is
     off, the picture steps back) and lies over the layout, under the banner,
     the dial and the column. Let go within LENS_MAGNET of rest and it springs
     back; a double tap on it, its home mark or Escape bring it home. Spread
     on past the nearest and it is the dive, as on the front page.
     LENS_GLOBE = false brings back the distances of the voices. */
  var LENS_GLOBE = true;
  var LENS_REST = 0.86, LENS_LEAST = 0.4, LENS_MAGNET = 1.22, LENS_SNAP_MS = 420;
  var lensOut = false, lensTapT = 0, lensTapAt = 0, lensWheelT = 0;
  function springEase(q) { var c = 0.9, u = q - 1; return 1 + (c + 1) * u * u * u + c * u * u; }
  function lensRestR(b) { return LENS_REST * (b || workBands()).lensAt.r; }
  function lensK() { return art && art.zoomK ? art.zoomK : 1; }
  function lensMostK(b) { return Math.max(1.5, base0 * SIZE_MOST / Math.max(1, lensRestR(b))); }
  function lensAway() {
    return !!(LENS_GLOBE && art && place && readingOn() && (Math.abs(Math.log(lensK())) > 0.01 || lensOut));
  }
  function lensOutCheck() {
    // Out only when the viewer has grown it (a view's own arrival flies in from nearer).
    var on = !!(LENS_GLOBE && art && place && readingOn() && !flying && lensK() > 1.001 && R > workBands().lensAt.r * 1.02);
    if (on !== lensOut) {
      lensOut = on;
      if (on) { artEl.dataset.out = "true"; } else { delete artEl.dataset.out; }
      clipWorld(on ? null : workBands());
    }
    placeLensHome();
  }
  /* One globe in every reading (artist, 7 Oct 2026, of "Born in Memphis",
     its lens a blurred close-up: "make sure the globe is consistent across
     all types of layouts"): whatever framed the view on its way in — a
     life's arrival, a town's born-here, a view no voice speaks for — the
     small globe stands at the viewer's size (rest × the viewer's own k),
     its middle at the window's: sprung there when it is not. */
  function lensKeep(a, now) {
    if (!place || !readingOn() || flying || dive.on || a.snap || a.lens || lensPinch || !a.live) { return; }
    if (now - (a.keptAt || 0) < 160) { return; }
    a.keptAt = now;
    // A view with no picture of its own after it has settled: its band is closed (no empty dark box).
    if (!a.readSince) { a.readSince = now; }
    if (a.kind !== "work" && !a.picture && !a.noPicture && now - a.readSince > 3000) { Land.noPicture(true); }
    var b = workBands(), L = b.lensAt;
    var seat = { x: L.x / W, y: L.y / H };
    if (!place.seatAt || Math.abs(place.seatAt.x - seat.x) * W > 1 || Math.abs(place.seatAt.y - seat.y) * H > 1) {
      place.seatAt = seat;
      reframe();
      a.dirty = true;
    }
    var z = lensRestR(b) * lensK() / Math.max(1, baseR);
    if (Math.abs(Math.log(Math.max(1e-9, zoom) / z)) > 0.02) {
      lensGroundOff();
      if (still) { zoom = place.zoomTo = z; reframe(); drawn.r = 0; a.dirty = true; marksDirty = true; lensOutCheck(); }
      else { a.snap = { la: Math.log(Math.max(1e-6, zoom)), lb: Math.log(z), at: now }; }
    }
  }
  /* Bigger or smaller by f, about (x, y): what is under the fingers stays
     under them. False when it can go no further that way. */
  function lensZoomBy(f, x, y) {
    var a = art;
    if (!LENS_GLOBE || !a || !place || flying || dive.on || !readingOn()) { return false; }
    var b = workBands(), k0 = lensK();
    var k1 = Math.max(LENS_LEAST, Math.min(lensMostK(b), k0 * f));
    if (Math.abs(k1 - k0) < 1e-6) { return false; }
    a.lens = null;
    a.snap = null;
    a.glide = null;
    a.zoomK = k1;
    var R0 = Math.max(1, R);
    zoom = lensRestR(b) * k1 / Math.max(1, baseR);
    var R1 = Math.max(1, baseR * zoom);
    if (x !== undefined) {
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < R0 * R0) {
        var wx = dx * (1 - R1 / R0), wy = dy * (1 - R1 / R0);
        wanted = spin = spin - wx / R1 / Math.max(0.25, Math.cos(focus.lat));
        lean(tilt + wy / R1);
        focus.lat = tilt;
      }
    }
    place.zoomTo = zoom;
    reframe();
    handledAt = lastTouch = performance.now();
    drawn.r = 0;
    a.dirty = true;
    tilesDirty = true;
    marksDirty = true;
    if (window.Voice && Voice.handled) { Voice.handled(); }
    lensOutCheck();
    return true;
  }
  /* The size eased to k times rest, where the world has been turned. */
  function lensSize(k) {
    var a = art;
    if (!a || !place) { return; }
    a.zoomK = k;
    var lb = Math.log(Math.max(1e-6, lensRestR() * k / Math.max(1, baseR)));
    a.lens = null;
    if (still) {
      zoom = Math.exp(lb);
      place.zoomTo = zoom;
      reframe();
      a.dirty = true;
      drawn.r = 0;
      marksDirty = true;
      lensOutCheck();
      return;
    }
    a.snap = { la: Math.log(Math.max(1e-6, zoom)), lb: lb, at: performance.now() };
  }
  /* Let go: near rest, it springs there (the magnet). */
  function lensRelease() {
    var a = art;
    if (!LENS_GLOBE || !a || !place || !readingOn()) { return; }
    var k = lensK();
    if (Math.abs(Math.log(k)) > 1e-3 && Math.abs(Math.log(k)) < Math.log(LENS_MAGNET)) { lensSize(1); }
    else if (!bodyOn()) { weave(R > 2 * Math.max(W, H) ? { lat: focus.lat, lon: spin } : null); }
  }
  /* Home: the small globe at rest, in its window, facing what is read. */
  function lensHome() {
    var a = art;
    if (!LENS_GLOBE || !a || !place || !readingOn() || flying) { return false; }
    window.clearTimeout(lensTapT);
    a.zoomK = 1;
    if (partsAway()) { partsHome(); }
    if (a.lensSpec) {
      var spec = {};
      Object.keys(a.lensSpec).forEach(function (k) { spec[k] = a.lensSpec[k]; });
      spec.now = still;
      spec.snap = true;
      lensTo(spec);
    } else {
      lensSize(1);
    }
    var L = workBands().lensAt;
    if (!still) { pulse(L.x, L.y, [LIGHT], 0.35, L.r * 1.3); }
    return true;
  }
  /* Its home mark: one quiet tile of the pixel light beside the window,
     only while the globe is away from rest. */
  var lensHomeEl = null;
  if (artEl) {
    lensHomeEl = el("button", "snap-home lens-home");
    lensHomeEl.type = "button";
    lensHomeEl.hidden = true;
    lensHomeEl.setAttribute("aria-label", "The small globe, back to rest");
    lensHomeEl.title = "Back to rest";
    lensHomeEl.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    lensHomeEl.addEventListener("click", function (event) { event.stopPropagation(); lensHome(); });
    artEl.appendChild(lensHomeEl);
  }
  function placeLensHome() {
    if (!lensHomeEl) { return; }
    var show = (lensAway() || partsAway()) && !artEl.dataset.full;
    lensHomeEl.hidden = !show;
    if (!show) { return; }
    var b = workBands(), x, y;
    if (lensSwapped) {
      x = b.hole.x + 6; y = b.hole.y + 6;
    } else {
      var L = b.lensAt, o = 0.707 * L.r;
      x = L.x - o - 19; y = L.y - o - 19;
      // Clear of the dial's own home mark.
      var dh = artTime && artTime.querySelector(".dial-home");
      var r = dh && dh.offsetParent ? dh.getBoundingClientRect() : null;
      if (r && r.width && x < r.right + 8 && x + 13 > r.left - 8 && y < r.bottom + 8 && y + 13 > r.top - 8) { y = L.y + o + 6; }
    }
    lensHomeEl.style.left = Math.max(6, Math.min(W - 19, x)).toFixed(0) + "px";
    lensHomeEl.style.top = Math.max(6, Math.min(H - 19, y)).toFixed(0) + "px";
  }

  /* ---- bigger and smaller, with one finger ----------------------------------

     The artist, 7 Oct 2026: "Make sure that no matter what, if there is a
     globe in view that the viewer is able to make it bigger and smaller
     however they please". Two fingers are not everyone's (WCAG 2.5.1, a
     single pointer for every gesture; 2.5.8, targets of 24 px or more): a
     quiet pair of round buttons, "+" and "−" ("Bigger", "Smaller"), at the
     globe's edge wherever a globe can be scaled — the small globe beside
     its rim, clear of the dial, the column, the picture and its home mark
     (44 px on a touch screen where there is room, else 32, never under 24),
     in the swapped globe's corner, and on the front page at the foot,
     clear of the pills. A step is √φ, eased; past the nearest, "+" goes on
     down as the "+" key does; "−" stops at the least. */
  var ZOOM_STEP = Math.sqrt(PHI);
  var coarse = !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
  function zoomPair(cls, onBig, onSmall) {
    var box = el("div", "globe-zoom " + cls);
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", "The globe's size");
    var big = el("button", "globe-zoom-b", "+"), small = el("button", "globe-zoom-b", "−");
    big.type = small.type = "button";
    big.setAttribute("aria-label", "Bigger");
    small.setAttribute("aria-label", "Smaller");
    big.title = "Bigger";
    small.title = "Smaller";
    [[big, onBig], [small, onSmall]].forEach(function (pr) {
      pr[0].addEventListener("pointerdown", function (event) { event.stopPropagation(); });
      pr[0].addEventListener("click", function (event) { event.stopPropagation(); pr[1](); });
    });
    box.appendChild(big);
    box.appendChild(small);
    box.hidden = true;
    return { box: box, big: big, small: small, key: "" };
  }
  var zoomTween = 0;
  // The small globe a step bigger or smaller about its middle, eased; false at its end.
  function lensStepBy(f) {
    window.cancelAnimationFrame(zoomTween);
    var k0 = lensK(), k1 = Math.max(LENS_LEAST, Math.min(lensMostK(), k0 * f));
    if (Math.abs(k1 - k0) < 1e-4) { return false; }
    if (still) { lensZoomBy(k1 / k0); return true; }
    var t0 = performance.now(), done = 0, all = Math.log(k1 / k0);
    (function step() {
      if (!readingOn()) { return; }
      var q = Math.min(1, (performance.now() - t0) / 260), want = all * q * (2 - q);
      lensZoomBy(Math.exp(want - done));
      done = want;
      if (q < 1) { zoomTween = window.requestAnimationFrame(step); }
    })();
    return true;
  }
  // The front globe a step bigger or smaller about its middle; past the nearest, down.
  function frontStepBy(f) {
    if (place || flying || groundOn || deckMode || dive.on) { return; }
    window.cancelAnimationFrame(zoomTween);
    settleSwing();
    var s0 = seat.size, s1 = Math.max(SIZE_FAR * INV, Math.min(SIZE_MOST, s0 * f));
    if (f > 1 && s0 >= SIZE_MOST - 1e-6) { flyOver(); return; }
    if (Math.abs(s1 - s0) < 1e-4) { return; }
    var t0 = performance.now();
    (function step() {
      if (place || flying) { return; }
      var q = still ? 1 : Math.min(1, (performance.now() - t0) / 300), e = q * (2 - q);
      handle(seatAbout(cx, cy, s0 * Math.pow(s1 / s0, e)));
      if (q < 1) { zoomTween = window.requestAnimationFrame(step); }
    })();
  }
  var lensZoom = null, frontZoom = null;
  if (artEl) {
    lensZoom = zoomPair("lens-zoom", function () { if (mapOn()) { mapStepBy(ZOOM_STEP); return; } if (!lensStepBy(ZOOM_STEP)) { goDeeper(false); } },
                        function () { if (mapOn()) { mapStepBy(1 / ZOOM_STEP); return; } lensStepBy(1 / ZOOM_STEP); });
    artEl.appendChild(lensZoom.box);
  }
  if (land) {
    frontZoom = zoomPair("front-zoom", function () { frontStepBy(ZOOM_STEP); }, function () { frontStepBy(1 / ZOOM_STEP); });
    land.appendChild(frontZoom.box);
  }
  function boxOf(e) {
    if (!e || e.hidden || !e.isConnected) { return null; }
    var r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden" ? r : null;
  }
  function meets(a, r, pad) {
    return !!r && a.x < r.right + pad && a.x + a.w > r.left - pad && a.y < r.bottom + pad && a.y + a.h > r.top - pad;
  }
  function putPair(z, on, x0, y0, x1, y1, s) {
    var key = on ? [x0, y0, x1, y1, s].map(Math.round).join(",") : "";
    if (key === z.key) { return; }
    z.key = key;
    z.box.hidden = !on;
    if (!on) { return; }
    z.box.style.setProperty("--zoom-size", s + "px");
    [[z.big, x0, y0], [z.small, x1, y1]].forEach(function (b) {
      b[0].style.left = Math.round(b[1]) + "px";
      b[0].style.top = Math.round(b[2]) + "px";
    });
  }
  function placeLensZoom() {
    if (!lensZoom) { return; }
    var on = !!(LENS_GLOBE && LENS && place && art && readingOn() && !flying && !dive.on && !groundOn &&
                !artEl.dataset.full && artEl.dataset.look !== "plate");
    if (on) {
      var k = lensK();
      lensZoom.small.disabled = k <= LENS_LEAST + 1e-3;
    }
    if (!on) { putPair(lensZoom, false); return; }
    var b = workBands();
    if (lensSwapped) {
      // In the big place: down its right edge, clear of the pills, the sentence and the corner's buttons.
      var h = b.hole, ss = coarse ? 44 : 32, ax = h.x + h.w - ss - 8;
      var av = [boxOf(filterEl), boxOf(document.querySelector(".explore-dock")), boxOf(lensHomeEl), boxOf(banner)];
      Array.prototype.forEach.call(artEl.querySelectorAll(".voice-cap"), function (e) { if ((e.textContent || "").trim()) { av.push(boxOf(e)); } });
      for (var sy = h.y + h.h - 2 * ss - 16; sy >= h.y + 8; sy -= 8) {
        var sb = { x: ax, y: sy, w: ss, h: 2 * ss + 8 };
        if (!av.some(function (r) { return meets(sb, r, 4); })) {
          putPair(lensZoom, true, ax, sy, ax, sy + ss + 8, ss);
          return;
        }
      }
      putPair(lensZoom, true, ax, h.y + 8, ax, h.y + ss + 16, ss);
      return;
    }
    // Round the rim of the small globe at rest (wherever it stands), where nothing else stands.
    var L = b.lensAt, rr = LENS_REST * L.r;
    var avoid = [boxOf(artTime), boxOf(artCol), boxOf(banner), boxOf(lensHomeEl), boxOf(filterEl)];
    if (artPlate && !artPlate.hidden && !lensOut) {
      avoid.push({ left: artPlate.offsetLeft, top: artPlate.offsetTop,
                   right: artPlate.offsetLeft + artPlate.offsetWidth, bottom: artPlate.offsetTop + artPlate.offsetHeight });
    }
    var sizes = coarse ? [44, 36, 32, 28, 24] : [32, 28, 24];
    var angles = [35, 145, -35, -145, 0, 180, 90, -90, 60, 120, -60, -120];
    for (var i = 0; i < sizes.length; i += 1) {
      var s = sizes[i], rho = rr + s / 2 + 3, half = Math.asin(Math.min(1, (s + 6) / (2 * rho)));
      for (var j = 0; j < angles.length; j += 1) {
        var th = angles[j] * Math.PI / 180, ok = true, pts = [];
        [th - half, th + half].forEach(function (a) {
          var bx = { x: L.x + rho * Math.cos(a) - s / 2, y: L.y + rho * Math.sin(a) - s / 2, w: s, h: s };
          if (bx.x < 6 || bx.y < 6 || bx.x + s > W - 6 || bx.y + s > H - 6) { ok = false; }
          avoid.forEach(function (r) { if (meets(bx, r, 3)) { ok = false; } });
          pts.push(bx);
        });
        if (ok) {
          // "+" the one nearer the top.
          if (pts[0].y > pts[1].y) { pts.reverse(); }
          putPair(lensZoom, true, pts[0].x, pts[0].y, pts[1].x, pts[1].y, s);
          return;
        }
      }
    }
    // No room round it: in the lens's own square, at its lower right.
    putPair(lensZoom, true, L.x + L.r - 24, L.y + L.r - 52, L.x + L.r - 24, L.y + L.r - 24, 24);
  }
  function placeFrontZoom() {
    if (!frontZoom) { return; }
    var on = !!(!place && !flying && !groundOn && !deckMode && !dive.on && land.dataset.at === "globe" && document.body.contains(land));
    if (!on) { putPair(frontZoom, false); return; }
    var s = coarse ? 44 : 32, x = W - 12 - s, y = H - 21 - 2 * s - 8;
    frontZoom.small.disabled = seat.size <= SIZE_FAR * INV + 1e-3;
    var avoid = [boxOf(filterEl), boxOf(artFind), boxOf(document.querySelector(".explore-dock"))];
    for (var n = 0; n < 24; n += 1) {
      var a = { x: x, y: y, w: s, h: 2 * s + 8 };
      if (!avoid.some(function (r) { return meets(a, r, 6); })) { break; }
      y -= 13;
    }
    putPair(frontZoom, true, x, y, x, y + s + 8, s);
  }
  /* ---- the city, a map you move ---------------------------------------------

     The artist, 7 Oct 2026, of Seattle on the Museums layer: "I want to be
     able to swipe around the globe and zoom in and out when I am viewing a
     city". A city's view is a map: one finger moves it under the finger, one
     to one, and lets it go with its speed; two fingers, a wheel or a
     trackpad's pinch, "+" and "−", and the round buttons make it bigger or
     smaller about the fingers (or the pointer), from a regional height
     (CITY_WIDE_KM across the band) in to the nearest its ground is drawn
     at. Its marks, names and galleries follow what is in view. The levels
     are the ends of that zoom: pinched on out past the widest it goes up to
     the world (comeUp, the view kept), spread on in past the nearest it goes
     down into the ground (the dive where the world is far enough off, else
     goDeeper) — no gesture lost, only further to go. A quick tap still
     presses; held still, the wave. Moved far from its framing, a snap-home
     tile brings it back. */
  var CITY_WIDE_KM = 300;
  var cityPinch = null, cityFling = null, cityHomeAnim = null, markDrag = null;
  // Let go after a move: on with its speed if it was still moving, else laid where it is.
  function cityLetGo(o) {
    var fresh = performance.now() - (o.lt || 0) < 90;
    var sp = Math.sqrt((o.vx || 0) * (o.vx || 0) + (o.vy || 0) * (o.vy || 0));
    if (fresh && sp > 0.05 && !still) { cityFling = { vx: o.vx, vy: o.vy, at: performance.now() }; }
    else { cityRelease(); }
  }
  function cityMap() {
    return !!(place && art && art.kind === "town" && art.live && !flying && !groundOn && !walkOn && !readingOn() &&
              !deckMode && !(place.museum || place.stage) && !skyOn());
  }
  /* The city as its skyline (skyline.js; artist, 7 Oct 2026: "when I click
     on a city I want to see the city skyline like it shows in the timelapse
     of the urban development in the architecture section. Distinguish the
     art buildings from the rest and label them so i can click on them"):
     where a city's ground has been read, its view is that ground in true
     isometric over the globe, and the skyline takes its own presses — the
     map's gestures, its galleries' tiles and its marks stand down. */
  function skyOn() { return !!(window.Skyline && Skyline.on && Skyline.on()); }
  var skyVisits = 0;
  var skylineApi = {
    // The city view, as the skyline needs it; null when there is none.
    state: function () {
      var a = art;
      if (!a || a.kind !== "town" || !a.live || !a.town || !place || flying || groundOn || walkOn) { return null; }
      if (!a.skyVisit) { skyVisits += 1; a.skyVisit = skyVisits; }     // each visit to a city, its own number
      return { visit: a.skyVisit, key: a.town.key, name: a.town.name, via: a.via || {}, pf: a.pf || null, venueWorks: a.venueWorks || null,
               museums: a.town.museums.slice(), rows: a.museumRows || {}, venueBoxes: a.venueBoxes || [],
               galleries: galleryPoints(a.town, a.pf).map(function (g) { return { vi: g.vi, lat: g.lat / RAD, lon: wrap(g.lon) / RAD }; }),
               band: artBand("town"), col: artCol, foot: a.foot || null, reading: readingOn(), still: still,
               dial: a.dated && artTime && !artTime.hidden ? { y0: a.y0, y1: a.y1, at: a.y0 + Math.max(0, Math.min(1, a.when)) * (a.y1 - a.y0),
                                                       rest: a.when >= 0.999 && !a.byHand && !a.auto } : null };
    },
    museum: function (slug) { downToMuseum(slug, {}); },
    venue: function (vi, x, y) {
      var a = art;
      if (!a || a.kind !== "town" || !a.pf) { return; }
      var g = galleryPoints(a.town, a.pf).filter(function (o) { return o.vi === vi; })[0];
      if (!g) { return; }
      showVenue({ g: g, x: x, y: y });
      if (venueLabel) { venueLabel.hidden = true; }      // the skyline names it itself
    },
    light: function (slug, on) { lightMuseum(slug, on); },
    up: function () { if (place && !flying) { comeUp(); } },
    deeper: function (x, y) { goDeeper(false, x, y); },
    squash: function (x, y, r) { if (place && !flying) { squash(x, y, r); } },
    pulse: function (x, y, r) { pulse(x, y, [LIGHT, LILAC], 0.5, r || 89); },
    soil: function (lat, lon, i, j, sea) { return soilCell(sea ? dirt.sea : dirt.land, { lat: lat, lon: lon }, i, j); }
  };
  if (window.Land) { window.Land.city = skylineApi; }
  // Two fingers or a wheel are the map's anywhere but the column, the banner and the pills.
  function cityZone(x, y) {
    function inRect(e) {
      if (!e || e.hidden) { return false; }
      var r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    }
    if (banner && !banner.hidden && inRect(banner)) { return false; }
    if (artCol && getComputedStyle(artCol).visibility !== "hidden" && inRect(artCol)) { return false; }
    return true;
  }
  function cityHome() {
    var a = art;
    if (!a.mapHome) { a.mapHome = { lat: focus.lat, lon: wanted, zoom: place.zoomTo || zoom }; }
    return a.mapHome;
  }
  function cityLimits() {
    var h = cityHome(), b = artBand("town");
    var wide = 0.4 * Math.min(b.w, b.h) / (CITY_WIDE_KM / 2 / 6371) / Math.max(1, baseR);
    // In to φ² nearer than the nearest a city is flown to: the body of works is drawn at any height.
    return { lo: Math.min(h.zoom, wide), hi: Math.max(h.zoom, TOWN_R_MAX / Math.max(1, baseR)) * PHI * PHI };
  }
  function cityMoved() {
    var a = art;
    a.glide = null;
    a.dirty = true;
    tilesDirty = true;
    marksDirty = true;
    townDirty = true;
    handledAt = lastTouch = performance.now();
  }
  // Moved by (dx, dy) screen pixels, as the finger moves.
  function cityPan(dx, dy) {
    cityHome();
    var rr = Math.max(R, 1);
    wanted = spin = spin - dx / rr / Math.max(0.25, Math.cos(focus.lat));
    lean(tilt + dy / rr);
    focus.lat = tilt;
    reframe();
    cityMoved();
  }
  // To zoom z1, holding the point (x, y) of the screen over the same ground.
  function cityZoomTo(z1, x, y) {
    cityHome();
    var R0 = Math.max(1, R);
    zoom = z1;
    place.zoomTo = zoom;
    var R1 = Math.max(1, baseR * zoom);
    if (x !== undefined) {
      var dx = x - cx, dy = y - cy;
      var wx = dx * (1 - R1 / R0), wy = dy * (1 - R1 / R0);
      wanted = spin = spin - wx / R1 / Math.max(0.25, Math.cos(focus.lat));
      lean(tilt + wy / R1);
      focus.lat = tilt;
    }
    reframe();
    drawn.r = 0;
    cityMoved();
  }
  function cityRelease() {
    if (!place || !art || art.kind !== "town") { return; }
    if (!bodyOn()) { weave(R > 2 * Math.max(W, H) ? { lat: focus.lat, lon: spin } : null); }
    townDirty = true;
  }
  function cityPinchMove(d) {
    var cp = cityPinch, ids = Object.keys(downFingers);
    var fa = downFingers[ids[0]], fb = downFingers[ids[1]];
    var mx = (fa.x + fb.x) / 2, my = (fa.y + fb.y) / 2;
    if (cp.dive) { diveTo(Math.log(d / cp.dive), mx, my); return; }
    if (!cityMap()) { cityPinch = null; return; }
    cityPan(mx - cp.x, my - cp.y);
    cp.x = mx; cp.y = my;
    var g = d / cp.d;
    cp.d = d;
    // Back out of a push past an end before the zoom moves again.
    if ((cp.over > 1 && g < 1) || (cp.over < 1 && g > 1)) {
      var o = cp.over * g;
      if ((cp.over > 1 && o >= 1) || (cp.over < 1 && o <= 1)) { cp.over = o; g = 1; } else { g = o; cp.over = 1; }
    }
    if (g !== 1) {
      var lim = cityLimits(), want = zoom * g, z1 = Math.max(lim.lo, Math.min(lim.hi, want));
      if (Math.abs(z1 - zoom) > 1e-9) { cityZoomTo(z1, mx, my); }
      cp.over *= want / z1;
    }
    if (cp.over < INV) {
      // Pinched on out past the widest: up to the world, the view kept.
      cityPinch = null;
      downFrom = 0;
      comeUp();
      return;
    }
    if (cp.over > 1.04 && diveCan()) { cp.dive = d / (cp.over / 1.04); diveTo(Math.log(d / cp.dive), mx, my); return; }
    if (cp.over > 1.5) {
      // Spread on in past the nearest: down into the ground there.
      cityPinch = null;
      downFrom = 0;
      goDeeper(false, mx, my);
    }
  }
  var cityWheelPush = 0, cityWheelAt = 0;
  function cityWheel(event) {
    var wstep = event.ctrlKey ? 0.012 : 0.0016, wd = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
    var lim = cityLimits(), want = zoom * Math.exp(-wd * wstep), z1 = Math.max(lim.lo, Math.min(lim.hi, want));
    var now = performance.now();
    if (now - cityWheelAt > 600) { cityWheelPush = 0; }
    cityWheelAt = now;
    cityFling = null;
    if (Math.abs(z1 - zoom) > 1e-9) { cityZoomTo(z1, event.clientX, event.clientY); cityWheelPush = 0; }
    else if (wd > 0) {
      cityWheelPush += wd * (event.ctrlKey ? 8 : 1);
      if (cityWheelPush > 377) { cityWheelPush = 0; comeUp(); return; }
    } else if (wd < 0) {
      if (diveCan()) {
        diveTo(dive.log - wd * wstep, event.clientX, event.clientY);
        window.clearTimeout(dive.timer);
        if (dive.raw >= 1) { diveEnd(); } else { dive.timer = window.setTimeout(diveEnd, 520); }
        return;
      }
      cityWheelPush += -wd * (event.ctrlKey ? 8 : 1);
      if (cityWheelPush > 233) { cityWheelPush = 0; goDeeper(false, event.clientX, event.clientY); return; }
    }
    window.clearTimeout(lensWheelT);
    lensWheelT = window.setTimeout(cityRelease, 300);
  }
  // A step bigger or smaller about the band's middle, eased; false at its end.
  function cityStepBy(f) {
    if (!cityMap()) { return false; }
    var lim = cityLimits(), z0 = zoom, z1 = Math.max(lim.lo, Math.min(lim.hi, z0 * f));
    if (Math.abs(z1 - z0) / z0 < 1e-4) { return false; }
    window.cancelAnimationFrame(zoomTween);
    cityFling = null;
    var b = artBand("town"), x = b.x + b.w / 2, y = b.y + b.h / 2, t0 = performance.now();
    (function step() {
      if (!cityMap()) { return; }
      var q = still ? 1 : Math.min(1, (performance.now() - t0) / 280), e = q * (2 - q);
      cityZoomTo(z0 * Math.pow(z1 / z0, e), x, y);
      if (q < 1) { zoomTween = window.requestAnimationFrame(step); } else { cityRelease(); }
    })();
    return true;
  }
  function cityAway() {
    var a = art, h = a && a.mapHome;
    if (!h || !cityMap()) { return false; }
    if (Math.abs(Math.log(zoom / h.zoom)) > Math.log(1.3)) { return true; }
    var v0 = toVec(h.lat, h.lon), v1 = toVec(focus.lat, spin);
    var ang = Math.acos(Math.max(-1, Math.min(1, dot3(v0, v1)))), b = artBand("town");
    return ang * R > 0.3 * Math.min(b.w, b.h);
  }
  function cityGoHome() {
    var a = art, h = a && a.mapHome;
    if (!h || !cityMap()) { return; }
    cityFling = null;
    cityHomeAnim = { lat0: focus.lat, lon0: spin, z0: zoom, lat1: h.lat, dLon: shortest(spin, h.lon), z1: h.zoom,
                     at: performance.now(), dur: still ? 1 : LENS_SNAP_MS * 1.4 };
    var b = artBand("town");
    if (!still) { pulse(b.x + b.w / 2, b.y + b.h / 2, [LIGHT], 0.35, 144); }
  }
  function stepCityMap(now) {
    if (!cityMap()) { cityFling = null; cityHomeAnim = null; return; }
    cityHome();
    var hm = cityHomeAnim;
    if (hm) {
      var q = Math.min(1, (now - hm.at) / hm.dur), e = springEase(q);
      zoom = place.zoomTo = hm.z0 * Math.pow(hm.z1 / hm.z0, Math.min(1.04, e));
      focus.lat = hm.lat0 + (hm.lat1 - hm.lat0) * e;
      lean(focus.lat);
      spin = wanted = hm.lon0 + hm.dLon * e;
      reframe();
      drawn.r = 0;
      cityMoved();
      if (q >= 1) { cityHomeAnim = null; zoom = place.zoomTo = hm.z1; reframe(); cityRelease(); }
    }
    var fl = cityFling;
    if (fl && !turning && !cityPinch) {
      var dt = Math.min(50, now - (fl.last || fl.at));
      fl.last = now;
      var k = Math.exp(-dt / 325);
      cityPan(fl.vx * dt, fl.vy * dt);
      fl.vx *= k; fl.vy *= k;
      if (Math.abs(fl.vx) + Math.abs(fl.vy) < 0.02) { cityFling = null; cityRelease(); }
    }
  }
  var cityHomeEl = null, cityZoom = null;
  if (artEl) {
    cityHomeEl = el("button", "snap-home city-home");
    cityHomeEl.type = "button";
    cityHomeEl.hidden = true;
    cityHomeEl.setAttribute("aria-label", "The city, back to its own framing");
    cityHomeEl.title = "Back to the city";
    cityHomeEl.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    cityHomeEl.addEventListener("click", function (event) { event.stopPropagation(); cityGoHome(); });
    artEl.appendChild(cityHomeEl);
    cityZoom = zoomPair("city-zoom", function () { if (!cityStepBy(ZOOM_STEP)) { goDeeper(false); } },
                       function () { cityStepBy(1 / ZOOM_STEP); });
    artEl.appendChild(cityZoom.box);
  }
  function placeCityZoom() {
    if (!cityZoom) { return; }
    var on = cityMap() && !dive.on;
    if (!on) { putPair(cityZoom, false); cityHomeEl.hidden = true; return; }
    var lim = cityLimits();
    cityZoom.small.disabled = zoom <= lim.lo * 1.0001;
    var b = artBand("town"), s = coarse ? 44 : 32;
    var avoid = [boxOf(artTime), boxOf(artCol), boxOf(banner), boxOf(filterEl), boxOf(document.querySelector(".explore-dock"))];
    var xs = [b.x + 12, b.x + b.w - s - 12], spot = null;      // the left edge, clear of the dial
    for (var i = 0; i < xs.length && !spot; i += 1) {
      for (var y = b.y + b.h - 2 * s - 20; y > b.y + 8; y -= 13) {
        var bx = { x: xs[i], y: y, w: s, h: 2 * s + 8 };
        if (!avoid.some(function (r) { return meets(bx, r, 6); })) { spot = bx; break; }
      }
    }
    if (!spot) { spot = { x: xs[0], y: b.y + 12 }; }
    putPair(cityZoom, true, spot.x, spot.y, spot.x, spot.y + s + 8, s);
    var away = cityAway();
    cityHomeEl.hidden = !away;
    if (away) {
      cityHomeEl.style.left = Math.round(spot.x + s / 2 - 6) + "px";
      cityHomeEl.style.top = Math.round(spot.y - 25) + "px";
    }
  }

  /* ---- the globe flattened: the map ---------------------------------------------

     In the big place the globe is a flat map (artist, 7 Oct 2026: "The
     globe goes from a circle to a rectangular map … with time that outlines
     corresponding histories and movements"): plate carrée, the body of works
     cell by cell (EarthBody's own colours; without it, land and sea), centred
     on what is told; a finger moves it, two fingers, a wheel or + and −
     make it bigger or smaller; the layer's marks on it, named by the calm
     rules' count and pressed as on the globe; the pills at its foot. Over it
     the view's history in pixel light — a work's journey, a life's places, a
     movement's or a thread's points — lit up to the dial's year, so turning
     the year lights the way on the map. Back in a round place it is the
     globe again, about the same middle. */
  var MAP_FORM = true;
  var flat = null;          // { cv, g, lat, lon, k (px a radian), key, world }
  function mapOn() {
    return !!(MAP_FORM && LENS && art && place && art.live && readingOn() && partsNow().globe === "big" && !dive.on);
  }
  function mapWorld() {
    if (flat.world !== undefined) { return flat.world; }
    var W0 = 1024, H0 = 512, cv = document.createElement("canvas");
    cv.width = W0; cv.height = H0;
    var g = cv.getContext("2d"), img = g.createImageData(W0, H0), dd = img.data;
    var body = window.EarthBody && EarthBody.ready && EarthBody.ready();
    for (var j = 0; j < H0; j += 1) {
      var lat = (0.5 - (j + 0.5) / H0) * Math.PI;
      for (var i = 0; i < W0; i += 1) {
        var lon = ((i + 0.5) / W0 - 0.5) * TAU, o = (j * W0 + i) * 4, hex = null;
        if (body) { var dr = EarthBody.doorAt(lat, lon, 60); hex = dr && dr.colour; }
        if (hex) {
          var n = parseInt(String(hex).replace("#", ""), 16);
          dd[o] = n >> 16 & 255; dd[o + 1] = n >> 8 & 255; dd[o + 2] = n & 255;
        } else if (onLand(lat, lon)) { dd[o] = 138; dd[o + 1] = 120; dd[o + 2] = 96; }
        else { dd[o] = 28; dd[o + 1] = 36; dd[o + 2] = 46; }
        dd[o + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);
    flat.world = cv;
    return cv;
  }
  function mapRect() { var b = workBands(); return b.slots ? b.slots.big : null; }
  function mapXY(lat, lon) {
    var r = flat.rect;
    var dl = shortest(flat.lon, lon);
    return { x: r.x + r.w / 2 + dl * flat.k, y: r.y + r.h / 2 - (lat - flat.lat) * flat.k };
  }
  function mapLL(x, y) {
    var r = flat.rect;
    return { lat: Math.max(-1.5, Math.min(1.5, flat.lat - (y - r.y - r.h / 2) / flat.k)), lon: wrap(flat.lon + (x - r.x - r.w / 2) / flat.k) };
  }
  // As far out as fills the place (never a strip of world in the dark), in to 120 times the whole.
  function mapKLimits() { var r = flat.rect, lo = Math.max(r.w / TAU * 0.8, r.h / Math.PI); return { lo: lo, hi: lo * 120 }; }
  // The middle kept so the world reaches the top and the foot of the place.
  function mapClampLat(lat) { var m = Math.max(0, Math.PI / 2 - flat.rect.h / 2 / flat.k); return Math.max(-m, Math.min(m, lat)); }
  function mapCheck(force) {
    var on = mapOn();
    if (!on) {
      if (flat && !flat.cv.hidden) { flat.cv.hidden = true; delete artEl.dataset.map; delete document.body.dataset.flatmap; }
      return;
    }
    if (!flat) { mapSetUp(); }
    var rect = mapRect();
    if (!rect) { return; }
    if (flat.cv.hidden || force) {
      flat.cv.hidden = false;
      artEl.dataset.map = "true";
      document.body.dataset.flatmap = "true";
      if (!flat.placed || flat.placedFor !== art) {
        flat.placedFor = art;
        flat.placed = true;
        flat.lat = focus.lat;
        flat.lon = wrap(spin);
        flat.k = Math.max(rect.w / TAU * 1.6, rect.h / Math.PI);
      }
      clipWorld(workBands());
    }
    flat.rect = rect;
    var st = flat.cv.style;
    st.left = rect.x + "px"; st.top = rect.y + "px"; st.width = rect.w + "px"; st.height = rect.h + "px";
    var d = Math.min(3, window.devicePixelRatio || 1);
    if (flat.cv.width !== Math.round(rect.w * d)) { flat.cv.width = Math.round(rect.w * d); flat.cv.height = Math.round(rect.h * d); flat.key = ""; }
    flat.dpr = d;
    var lim = mapKLimits();
    flat.k = Math.max(lim.lo, Math.min(lim.hi, flat.k));
    flat.lat = mapClampLat(flat.lat);
    mapDraw();
  }
  // Leaving the big place: the globe, about the map's middle.
  function mapLeave() {
    if (!flat || !flat.placed) { return; }
    spin = wanted = flat.lon;
    lean(flat.lat);
    focus.lat = tilt;
    reframe();
    flat.placed = false;
    if (art) { art.dirty = true; }
  }
  // The history the view tells, as ways in time: [[lat, lon, year|null], ...] runs.
  function mapRoutes() {
    var a = art, out = [];
    if (!a) { return out; }
    if (a.kind === "work" && a.stops) {
      out.push(a.stops.map(function (s) { return { lat: s.lat, lon: s.lon, pos: a.evs[s.first].pos, name: (s.name || "").split(",")[0] }; }));
      return out;
    }
    if (a.kind === "life" && a.data && a.data.id && !/^born:/.test(a.data.id) && window.Lives && Lives._life) {
      var L = Lives._life(a.data.id);
      if (L) {
        var run = [];
        if (L.b && L.b[1]) { run.push({ lat: L.b[1][0] * RAD, lon: L.b[1][1] * RAD, y: L.born, name: L.b[0] }); }
        L.periods.forEach(function (p) { if (p.ll) { run.push({ lat: p.ll[0] * RAD, lon: p.ll[1] * RAD, y: p.y0, name: p.place }); } });
        out.push(run);
        return out;
      }
    }
    var pts = a.data && a.data.pts;
    if (pts && pts.length) { out.push(pts.map(function (q) { return { lat: q[0] * RAD, lon: q[1] * RAD, y: null }; })); }
    return out;
  }
  function mapMarks() {
    return cities.filter(function (c) { return !c.off && isFinite(c.lat) && c.el; });
  }
  function mapDraw() {
    var a = art, r = flat.rect, d = flat.dpr;
    flat.lat = mapClampLat(flat.lat);
    var yr = a && a.dated ? yearAt(a, Math.max(0, a.when)) : null;
    var key = [r.x, r.y, r.w, r.h, flat.lat.toFixed(4), flat.lon.toFixed(4), flat.k.toFixed(2), a && a.when, layerOn, a && a.ring,
               flat.hover || "", d, flat.world ? 1 : 0].join("|");
    if (key === flat.key) { return; }
    flat.key = key;
    var g = flat.g;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.imageSmoothingEnabled = false;
    g.fillStyle = "#0f0a07";
    g.fillRect(0, 0, r.w, r.h);
    var world = mapWorld(), ww = TAU * flat.k, wh = Math.PI * flat.k;
    var x0 = r.w / 2 - (flat.lon + Math.PI) * flat.k, y0 = r.h / 2 - (Math.PI / 2 - flat.lat) * flat.k;
    x0 = ((x0 % ww) + ww) % ww - ww;
    for (var x = x0; x < r.w; x += ww) { g.drawImage(world, x, y0, ww, wh); }
    // A shade so the light reads.
    g.fillStyle = "rgba(15, 10, 7, 0.28)";
    g.fillRect(0, 0, r.w, r.h);
    // The history, in pixel light: lit up to the dial's year, faint ahead.
    var T = 6;
    mapRoutes().forEach(function (run) {
      for (var i = 0; i < run.length; i += 1) {
        var p = run[i], lit = p.pos !== undefined ? p.pos <= (a.when || 0) + 1e-9 : p.y === null || p.y === undefined || yr === null || p.y <= yr;
        var q = mapXY(p.lat, p.lon), qx = q.x - r.x, qy = q.y - r.y;
        if (i > 0) {
          var o = mapXY(run[i - 1].lat, run[i - 1].lon), ox = o.x - r.x, oy = o.y - r.y;
          var n = Math.max(1, Math.round(Math.hypot(qx - ox, qy - oy) / T));
          for (var k = 0; k <= n; k += 1) {
            if (!lit && k % 2) { continue; }
            var tx = ox + (qx - ox) * k / n, ty = oy + (qy - oy) * k / n;
            g.fillStyle = lit ? "rgba(234, 223, 205, 0.85)" : "rgba(157, 149, 230, 0.35)";
            g.fillRect(Math.round(tx) - 1.5, Math.round(ty) - 1.5, 3, 3);
          }
        }
        var cur = a.kind === "work" ? a.ring === i : false;
        g.fillStyle = lit ? (cur ? "#ffffff" : LIGHT) : "rgba(157, 149, 230, 0.45)";
        g.fillRect(Math.round(qx) - 3, Math.round(qy) - 3, 6, 6);
        if (cur) { g.strokeStyle = LILAC; g.lineWidth = 1.5; g.strokeRect(Math.round(qx) - 6.5, Math.round(qy) - 6.5, 13, 13); }
      }
    });
    // The layer's marks; the biggest named, never over each other.
    var marks = mapMarks(), shown = [], taken = [], most = Math.max(5, Math.min(14, Math.round(r.w * r.h / 16000)));
    g.font = "10px " + dialFont;
    g.textBaseline = "middle";
    marks.map(function (c) { return { c: c, rank: c.town ? c.town.rank : 1 }; })
      .sort(function (u, v) { return v.rank - u.rank; })
      .forEach(function (m) {
        var q = mapXY(m.c.lat, m.c.lon), qx = q.x - r.x, qy = q.y - r.y;
        if (qx < 2 || qy < 2 || qx > r.w - 2 || qy > r.h - 2) { return; }
        g.fillStyle = m.c.town && m.c.town.museums.length ? "#eadfcd" : "rgba(157, 149, 230, 0.8)";
        g.fillRect(Math.round(qx) - 2, Math.round(qy) - 2, 4, 4);
        var item = { c: m.c, x: q.x, y: q.y, named: false };
        if (shown.filter(function (s2) { return s2.named; }).length < most) {
          var label = String(m.c.label || m.c.title || "").split(",")[0].toUpperCase(), tw = g.measureText(label).width;
          var bx = { x0: qx + 5, y0: qy - 6, x1: qx + 7 + tw, y1: qy + 6 };
          if (bx.x1 < r.w - 2 && !taken.some(function (t) { return bx.x0 < t.x1 && t.x0 < bx.x1 && bx.y0 < t.y1 && t.y0 < bx.y1; })) {
            taken.push(bx);
            g.fillStyle = "rgba(234, 223, 205, 0.9)";
            g.fillText(label, qx + 6, qy);
            item.named = true;
          }
        }
        shown.push(item);
      });
    flat.shown = shown;
  }
  function mapSetUp() {
    var cv = el("canvas", "flat-map");
    cv.hidden = true;
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", "The world as a map, with the history told on it");
    flat = { cv: cv, g: cv.getContext("2d"), lat: 0, lon: 0, k: 100, key: "", fingers: {}, world: undefined };
    if (lensVeil && lensVeil.nextSibling) { artEl.insertBefore(cv, lensVeil.nextSibling); } else { artEl.appendChild(cv); }
    function two() {
      var ids = Object.keys(flat.fingers);
      if (ids.length < 2) { return null; }
      var p = flat.fingers[ids[0]], q = flat.fingers[ids[1]];
      return { d: Math.max(10, Math.hypot(p.x - q.x, p.y - q.y)), x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    }
    cv.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
      try { cv.setPointerCapture(event.pointerId); } catch (e) {}
      if (event.isPrimary) { flat.fingers = {}; }     // a new gesture: nothing left over from the last
      flat.fingers[event.pointerId] = { x: event.clientX, y: event.clientY, x0: event.clientX, y0: event.clientY, at: performance.now() };
      flat.moved = Object.keys(flat.fingers).length > 1 ? 99 : 0;
      flat.pinch = two();
    });
    cv.addEventListener("pointermove", function (event) {
      var f = flat.fingers[event.pointerId];
      if (!f) {
        if (event.pointerType === "mouse") { var hv = mapHit(event.clientX, event.clientY, false); var hk = hv ? hv.slug || hv.title : ""; if (hk !== flat.hover) { flat.hover = hk; cv.style.cursor = hv ? "pointer" : "grab"; } }
        return;
      }
      var dx = event.clientX - f.x, dy = event.clientY - f.y;
      f.x = event.clientX; f.y = event.clientY;
      flat.moved = Math.max(flat.moved, Math.abs(f.x - f.x0), Math.abs(f.y - f.y0));
      var p2 = two();
      if (p2 && flat.pinch) {
        mapZoomAbout(p2.d / flat.pinch.d, p2.x, p2.y);
        flat.lon = wrap(flat.lon - (p2.x - flat.pinch.x) / flat.k);
        flat.lat = mapClampLat(flat.lat + (p2.y - flat.pinch.y) / flat.k);
        flat.pinch = p2;
      } else if (!p2 && flat.moved > 4) {
        flat.lon = wrap(flat.lon - dx / flat.k);
        flat.lat = mapClampLat(flat.lat + dy / flat.k);
      }
      mapDraw();
    });
    ["pointerup", "pointercancel"].forEach(function (name) {
      cv.addEventListener(name, function (event) {
        var f = flat.fingers[event.pointerId];
        delete flat.fingers[event.pointerId];
        flat.pinch = two();
        if (!f || name !== "pointerup" || flat.moved > 6 || performance.now() - f.at > 600 || Object.keys(flat.fingers).length) { return; }
        var hit = mapHit(event.clientX, event.clientY, event.pointerType !== "mouse");
        if (hit && hit.el) {
          cameLayer = layerOn;
          pulse(event.clientX, event.clientY, [LIGHT, LILAC], 0.6, 144);
          hit.el.click();
        }
      });
    });
    cv.addEventListener("wheel", function (event) {
      event.preventDefault();
      event.stopPropagation();
      var step = event.ctrlKey ? 0.012 : 0.0016;
      mapZoomAbout(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 16 : 1) * step), event.clientX, event.clientY);
      mapDraw();
    }, { passive: false });
  }
  function mapZoomAbout(f, x, y) {
    var lim = mapKLimits(), k1 = Math.max(lim.lo, Math.min(lim.hi, flat.k * f));
    var ll = mapLL(x, y);
    flat.k = k1;
    // The point under the fingers stays under them.
    var q = mapXY(ll.lat, ll.lon);
    flat.lon = wrap(flat.lon + (q.x - x) / flat.k);
    flat.lat = mapClampLat(flat.lat - (q.y - y) / flat.k);
    return Math.abs(k1 - flat.k) < 1e-9;
  }
  function mapStepBy(f) {
    if (!flat || !flat.rect) { return false; }
    var lim = mapKLimits(), k0 = flat.k, k1 = Math.max(lim.lo, Math.min(lim.hi, k0 * f));
    if (Math.abs(k1 - k0) < 1e-6) { return false; }
    var r = flat.rect, t0 = performance.now();
    window.cancelAnimationFrame(zoomTween);
    (function step() {
      var q = still ? 1 : Math.min(1, (performance.now() - t0) / 260), e = q * (2 - q);
      flat.k = k0 * Math.pow(k1 / k0, e);
      mapDraw();
      if (q < 1) { zoomTween = window.requestAnimationFrame(step); }
    })();
    void r;
    return true;
  }
  // The mark a press on the map lands on: within a finger's reach (24 px, 10 with a mouse).
  function mapHit(x, y, touch) {
    if (!flat || !flat.shown) { return null; }
    var best = null, bd = touch ? 24 : 10;
    flat.shown.forEach(function (s2) {
      var dd = Math.hypot(s2.x - x, s2.y - y);
      if (dd < bd) { bd = dd; best = s2.c; }
    });
    return best;
  }

  var zoomsAt = 0;
  function placeZooms() {
    var now = performance.now();
    if (now - zoomsAt < 120) { return; }
    zoomsAt = now;
    placeLensZoom();
    placeFrontZoom();
    placeCityZoom();
  }
  // Each frame: the map follows the view (its year, its layer); the parts go home at the world.
  function stepParts() {
    if (!place && parts) { parts = null; }
    mapCheck(false);
  }

  /* ---- the grown globe, a globe you can use --------------------------------

     The artist, 3 Oct 2026, of Li Qing's life with the small globe pinched
     big out of its window: "When I zoom in on the globe like this I want to
     be able to select things on the globe. It should show the overall
     filter initially used to get to this point, but then I should be able
     to change to the other globe filters as well". Grown out of its window
     (lensOut) or swapped into the big place, the reading's globe carries the
     front globe's marks of one layer — cities, collages, buildings,
     birthplaces — named by the same calm rules for the area it is seen in,
     pressed as there (only what is shown; a press leaves the reading for
     that place, and the categories' way back keeps the reading one press
     away), with the filter's pills at its foot (the same element, moved
     into the reading). It opens on the layer the path came through
     (`cameLayer`, set by every press on a globe), marked; a choice made
     here is the reading's, and the viewer's stored one comes back at the
     world. At rest, in its window, it is as it was: too small to press. */
  var grown = false, grownAt = null, grownMeasured = 0, grownKey = "", grownArt = null;
  var filterHome = null, filterNext = null;
  var findHome = null, findNext = null;          // Search comes with the pills (artist, 8 Oct 2026)
  var finderHome = null, finderNext = null;      // and what it finds, over the reading, not under it
  function grownNow() {
    return !!(LENS_GLOBE && LENS && place && art && readingOn() && !flying && !dive.on &&
              (lensOut || lensSwapped) && !artEl.dataset.full && artEl.dataset.look !== "plate");
  }
  function stepGrown() {
    // A new view: its grown globe opens on the layer the path came through.
    if (art !== grownArt) {
      grownArt = art;
      var want = cameLayer || layerKept;
      if (art && layerOn !== want && LAYERS.some(function (l) { return l.key === want; })) {
        layerOn = want;
        if (grown) { grownLayer(); } else { filterGlobe(); }
      }
    }
    var on = grownNow();
    if (on && !grown) {
      grown = true;
      land.dataset.grown = "true";
      if (filterEl && artEl) {
        filterHome = filterEl.parentNode;
        filterNext = filterEl.nextSibling;
        artEl.appendChild(filterEl);
        filterEl.dataset.grown = "true";
      }
      // Search comes too, beside the pills (artist, 8 Oct 2026, of a work's globe enlarged with its pills
      // and no Search: "Make sure the search bar is available when I enlarge the globe as well").
      if (artFind && artEl) {
        findHome = artFind.parentNode;
        findNext = artFind.nextSibling;
        artEl.appendChild(artFind);
        artFind.dataset.grown = "true";
        // Search is there even if the world's cities were still being read when the reading began.
        if (ARTWORKS && (artFind.hidden || !artFind.textContent.trim())) {
          artFind.disabled = false;
          artFind.textContent = "Search";
          artFind.setAttribute("aria-label", "Search works, artists, places, museums, shows and writers");
          artFind.hidden = false;
        }
      }
      // Its list lives in the reading while the globe is grown: under the stage it would lie beneath the
      // dial, the sentence and the column (the stage, fixed, is a stacking context of its own).
      if (finderEl && artEl) {
        finderHome = finderEl.parentNode;
        finderNext = finderEl.nextSibling;
        artEl.appendChild(finderEl);
        finderEl.dataset.grown = "true";
      }
      grownMeasured = 0;
      grownLayer();
      measureNames();
    } else if (!on && grown) {
      grownOff();
    }
    if (grown) {
      grownMeasure();
      // The view's own marks, where they are this frame: names are given out again when they move.
      ownBoxes = ownMarks();
      var ok = ownBoxes.map(function (o) { return Math.round(o.x0) + "," + Math.round(o.y0) + "," + Math.round(o.x1) + "," + Math.round(o.y1); }).join(";");
      if (ok !== ownKey) { ownKey = ok; marksDirty = true; }
    }
  }
  /* The view's own marks on the grown globe, as boxes: a work's (or a
     thread's) stops and their names, and what a life or a movement draws on
     its own canvas (its places, rings, name, births: Lives.marks,
     Movements.marks). The view's own come first: a layer's mark is not put
     under one, nor a name over one. */
  var ownBoxes = [], ownKey = "";
  function ownMarks() {
    var a = art, out = [];
    if (!a) { return out; }
    if ((a.kind === "work" || a.kind === "thread") && a.stops && a.names) {
      a.stops.forEach(function (st) {
        var p = project(st.lat, st.lon);
        if (p.z <= 0.18) { return; }
        var gx = Math.floor(p.x / CELL_PX) * CELL_PX, gy = Math.floor(p.y / CELL_PX) * CELL_PX;
        out.push({ x0: gx, y0: gy, x1: gx + CELL_PX, y1: gy + CELL_PX });
        var n = a.names[st.p];
        if (n && n.style.visibility !== "hidden") {
          var nw = n._w || (n._w = n.offsetWidth) || 60;
          out.push({ x0: gx + CELL_PX + 5, y0: gy, x1: gx + CELL_PX + 5 + nw, y1: gy + CELL_PX });
        }
      });
    }
    var mod = a.kind === "life" ? window.Lives : a.kind === "movement" ? window.Movements : null;
    if (mod && mod.marks) { out = out.concat(mod.marks() || []); }
    return out;
  }
  function grownOff() {
    if (!grown) { return; }
    grown = false;
    if (finder.open && land.dataset.at !== "globe") { closeFinder(); }
    grownAt = null;
    grownKey = "";
    delete land.dataset.grown;
    if (filterEl && filterHome) {
      filterHome.insertBefore(filterEl, filterNext && filterNext.parentNode === filterHome ? filterNext : null);
      delete filterEl.dataset.grown;
      filterEl.style.removeProperty("left");
      filterEl.style.removeProperty("top");
    }
    if (artFind && findHome) {
      findHome.insertBefore(artFind, findNext && findNext.parentNode === findHome ? findNext : null);
      delete artFind.dataset.grown;
      artFind.style.removeProperty("left");
      artFind.style.removeProperty("top");
      findHome = null;
    }
    if (finderEl && finderHome) {
      finderHome.insertBefore(finderEl, finderNext && finderNext.parentNode === finderHome ? finderNext : null);
      delete finderEl.dataset.grown;
      delete finderEl.dataset.below;
      ["--finder-floor", "--finder-top", "--finder-room"].forEach(function (v) { finderEl.style.removeProperty(v); });
      finderEl._at = "";
      finderHome = null;
    }
    tilesShown = {};
    nameBoxes = [];
    ownBoxes = [];
    ownKey = "";
    filterGlobe();
    marksDirty = true;
  }
  /* The layer chosen (or come back to) on the grown globe: its marks read and raised. */
  function grownLayer() {
    filterGlobe();
    if (layerOn === "museums") {
      readTowns().then(function () {
        if (!towns || cities.some(function (c) { return c.town; })) { return; }
        townsLitAt = performance.now();
        raiseTowns();
        filterGlobe();
        measureNames();
      });
    }
    studiosLayer();
    marksDirty = true;
  }
  /* Where the grown globe is seen: the band it has (a phone: under the
     banner to the column; a desktop: left of the column; swapped: the big
     place), less what lies over it — the dial, the home marks, the
     sentence, the pills — and where the pills go: at its foot, clear of
     those. Measured five times a second at most. */
  function grownMeasure() {
    var now = performance.now();
    if (grownAt && now - grownMeasured < 200) { return; }
    grownMeasured = now;
    var b = workBands();
    var under = banner && !banner.hidden ? bannerUnder.getBoundingClientRect().bottom : 60;
    var box;
    if (lensSwapped) {
      var h = b.hole;
      box = { x0: h.x + 8, y0: Math.max(h.y + 8, under + 6), x1: h.x + h.w - 8, y1: h.y + h.h - 8 };
    } else if (b.phone) {
      box = { x0: 12, y0: under + 8, x1: W - 12, y1: (b.colTop || Math.round(0.64 * H)) - 3 };
    } else {
      var cr = artCol && artCol.offsetParent ? artCol.getBoundingClientRect() : null;
      box = { x0: 16, y0: under + 8, x1: (cr && cr.width ? cr.left : W) - 10, y1: H - 16 };
    }
    var avoid = [];
    function rectOf(e, pad) {
      // (Not by offsetParent: the small globe's home mark is fixed, and has none.)
      if (!e || e.hidden) { return; }
      var r = e.getBoundingClientRect();
      if (!r.width || !r.height || getComputedStyle(e).visibility === "hidden") { return; }
      avoid.push({ x0: r.left - pad, y0: r.top - pad, x1: r.right + pad, y1: r.bottom + pad });
    }
    rectOf(artTime, 2);
    rectOf(lensHomeEl, 4);
    Array.prototype.forEach.call(artEl.querySelectorAll(".voice-cap, .voice-chip, .dial-home"), function (e) {
      if ((e.textContent || "").trim() || e.classList.contains("dial-home")) { rectOf(e, 4); }
    });
    // A path played on the dial (transport.js): the × out past its rim, and the path's own dial
    // where the view has none showing.
    Array.prototype.forEach.call(document.querySelectorAll(".building-time.dial > .dial-end"), function (e) { rectOf(e, 4); });
    rectOf(document.querySelector(".building-time.path-time"), 2);
    // The pills: at the foot, in the middle; else to a side; else up, clear of what lies there.
    if (filterEl && filterEl.dataset.grown) {
      var pw = filterEl.offsetWidth, fh = filterEl.offsetHeight;
      // Search rides at the row's end where the row fits the band (else it goes just above, below).
      var withFind = !!(artFind && artFind.dataset.grown && !artFind.hidden);
      var aw = withFind ? artFind.offsetWidth : 0, ah = withFind ? artFind.offsetHeight : 0;
      var inRow = withFind && pw + 8 + aw <= box.x1 - box.x0;
      var fw = inRow ? pw + 8 + aw : pw;
      var hit = function (x, y) {
        return avoid.some(function (a) { return x < a.x1 && a.x0 < x + fw && y < a.y1 && a.y0 < y + fh; });
      };
      var lo = box.x0, hi = Math.max(box.x0, box.x1 - fw);
      var xs = [Math.round((box.x0 + box.x1 - fw) / 2), lo, hi];
      // On a phone the pills may sit on the column's top edge, under the dial, before they go up the globe.
      var foot = b.phone && !lensSwapped ? Math.min(H - 4, box.y1 + 16) : box.y1;
      var fx = xs[0], fy = foot - fh, found = false;
      for (var yy = foot - fh; yy >= box.y0 && !found; yy -= 4) {
        for (var q = 0; q < xs.length; q += 1) {
          var xx = Math.max(lo, Math.min(hi, xs[q]));
          if (!hit(xx, yy)) { fx = xx; fy = yy; found = true; break; }
        }
      }
      fx = Math.max(4, Math.min(W - fw - 4, fx));
      filterEl.style.left = fx.toFixed(0) + "px";
      filterEl.style.top = fy.toFixed(0) + "px";
      avoid.push({ x0: fx - 6, y0: fy - 6, x1: fx + fw + 6, y1: fy + fh + 6 });
      // What is under the pills, across the whole foot, is no place for a name.
      if (fy + fh >= box.y1 - 2) { box.y1 = Math.min(box.y1, fy - 6); }
      // Search: at the row's end; else just above the pills, clear of the rest and of the view's
      // own marks (a life's year and its name, a work's stops).
      if (withFind) {
        var own = ownMarks();
        // Every try is checked: clear of the screen's edges, the band's top, the pills themselves, the
        // dial and the rest (the pills' own avoid box is left out: in a row it covers Search's place).
        var others = avoid.slice(0, -1).concat(own);
        var pillBox = { x0: fx, y0: fy, x1: fx + pw, y1: fy + fh };
        var hitA = function (x, y) {
          return x < 4 || x + aw > W - 4 || y < Math.max(4, box.y0 - 4) || y + ah > H - 4 ||
            [pillBox].concat(others).some(function (a) { return x < a.x1 + 4 && a.x0 - 4 < x + aw && y < a.y1 + 4 && a.y0 - 4 < y + ah; });
        };
        var my = fy + (fh - ah) / 2;
        // The row's end; else above the pills; else below them (where the pills stand at the band's top).
        var tries = [[fx + pw + 8, my], [fx - aw - 8, my],
                     [fx + (pw - aw) / 2, fy - ah - 8], [fx, fy - ah - 8], [fx + pw - aw, fy - ah - 8],
                     [fx + (pw - aw) / 2, fy + fh + 8], [fx, fy + fh + 8], [fx + pw - aw, fy + fh + 8]];
        var at = tries.filter(function (t) { return !hitA(t[0], t[1]); })[0] || tries[tries.length - 3];
        var ax = Math.max(4, Math.min(W - aw - 4, at[0])), ay = Math.max(4, Math.min(H - ah - 4, at[1]));
        artFind.style.left = ax.toFixed(0) + "px";
        artFind.style.top = ay.toFixed(0) + "px";
        avoid.push({ x0: ax - 6, y0: ay - 6, x1: ax + aw + 6, y1: ay + ah + 6 });
        if (ay + ah >= box.y1 - 2) { box.y1 = Math.min(box.y1, ay - 6); }
      }
      // What Search finds opens above the row (below it where the row stands high), so Search is
      // never covered and a second press puts it away, as on the world.
      if (finderEl && finderEl.dataset.grown) {
        var rowTop = withFind ? Math.min(fy, ay) : fy, rowBot = withFind ? Math.max(fy + fh, ay + ah) : fy + fh;
        var below = rowTop < H * 0.45;
        var fk = (below ? "b" : "a") + Math.round(rowTop) + "," + Math.round(rowBot) + "," + H;
        if (finderEl._at !== fk) {
          finderEl._at = fk;
          if (below) { finderEl.dataset.below = "true"; } else { delete finderEl.dataset.below; }
          finderEl.style.setProperty("--finder-floor", Math.round(H - rowTop + 8) + "px");
          finderEl.style.setProperty("--finder-top", Math.round(rowBot + 8) + "px");
          finderEl.style.setProperty("--finder-room", Math.max(160, Math.round(below ? H - rowBot - 8 - 105 : rowTop - 8 - 16)) + "px");
        }
      }
    }
    // A played path's readout beside the dial (transport.js) lies over the globe: no name or mark
    // under it. Not before the pills: the readout keeps off them, so neither chases the other.
    rectOf(document.querySelector(".path-read"), 4);
    // The round + and − (after the pills, which they keep off).
    [lensZoom && lensZoom.big, lensZoom && lensZoom.small].forEach(function (e) { rectOf(e, 4); });
    grownAt = { box: box, avoid: avoid };
    var key = [box.x0, box.y0, box.x1, box.y1].map(Math.round).join(",") + "|" +
      avoid.map(function (a) { return [a.x0, a.y0, a.x1, a.y1].map(Math.round).join(","); }).join(";");
    if (key !== grownKey) { grownKey = key; marksDirty = true; }
  }
  function inAvoid(x, y, pad) {
    if (!grown || !grownAt) { return false; }
    pad = pad || 0;
    var hit = function (a) { return x > a.x0 - pad && x < a.x1 + pad && y > a.y0 - pad && y < a.y1 + pad; };
    return grownAt.avoid.some(hit) || ownBoxes.some(hit);
  }
  function boxAvoid(b) {
    if (!grown || !grownAt) { return false; }
    var hit = function (a) { return b.x0 < a.x1 && a.x0 < b.x1 && b.y0 < a.y1 && a.y0 < b.y1; };
    return grownAt.avoid.some(hit) || ownBoxes.some(hit);
  }

  /* The first person: the ground where they stood, DIRT Earth's, in the
     lens — laid over the world at the same scale (the globe has flown to
     the ground's own), fading in as the ground grows. North is up: no
     source gives the way a painter faced, and the caption says so. */
  var lensGround = { on: false, at: null, since: 0 };
  function lensGroundOn(lat, lon) {
    if (groundOn || dive.on || !groundDirt) { return; }
    var key = lat.toFixed(4) + "," + lon.toFixed(4);
    if (!groundFrame.src || key !== groundAtWas) { groundGrown = 0; }
    groundAt(lat, lon, false);
    groundSay({ dirt: "look", lat: lat, lon: lon, settle: true });
    groundSay({ dirt: "chrome", on: false });
    lensGround.on = true;
    lensGround.at = { lat: lat, lon: lon };
    lensGround.since = performance.now();
    groundDirt.hidden = false;
    groundDirt.classList.remove("on");
    groundDirt.dataset.lens = "true";
    groundDirt.style.pointerEvents = "none";
    groundDirt.style.transition = "none";
    placeLensGround();
  }
  function lensGroundOff() {
    if (!lensGround.on) { return; }
    lensGround.on = false;
    if (groundOn) { return; }
    delete groundDirt.dataset.lens;
    groundDirt.style.opacity = "0";
    groundDirt.style.clipPath = groundDirt.style.webkitClipPath = "";
    groundDirt.style.transform = "";
    groundDirt.hidden = true;
    groundDirt.style.pointerEvents = "";
    groundDirt.style.transition = "";
    groundDirt.style.opacity = "";
  }
  function placeLensGround() {
    if (!lensGround.on || groundOn) { return; }
    if (!readingOn()) { lensGroundOff(); return; }
    var b = workBands(), h = b.hole;
    var cxL = h.x + h.w / 2, cyL = h.y + h.h / 2;
    groundDirt.style.transform = "translate(" + (cxL - W / 2).toFixed(1) + "px," + (cyL - H / 2).toFixed(1) + "px)";
    var clip = h.round < 0 ? "circle(" + (h.w / 2).toFixed(1) + "px at 50% 50%)"
      : "inset(" + ((H - h.h) / 2).toFixed(1) + "px " + ((W - h.w) / 2).toFixed(1) + "px round 4px)";
    groundDirt.style.clipPath = clip;
    groundDirt.style.webkitClipPath = clip;
    var since = performance.now() - lensGround.since;
    var grown = groundLoaded ? smooth01(groundGrown / 0.6) : 0;
    if (since > 6000 && groundLoaded) { grown = Math.max(grown, 1); }
    groundDirt.style.opacity = (art && artEl.dataset.full ? 0 : grown).toFixed(3);
  }
  // Out of the lens and down: the ground there, the whole window (the dive's ground).
  function lensGroundWhole() {
    if (!lensGround.on) { return false; }
    var at = lensGround.at;
    lensGround.on = false;
    delete groundDirt.dataset.lens;
    groundDirt.style.clipPath = groundDirt.style.webkitClipPath = "";
    groundDirt.style.transform = "";
    groundDirt.style.opacity = "";
    groundDirt.style.transition = "";
    groundDirt.style.pointerEvents = "";
    groundUp(at.lat, at.lon, false);
    return true;
  }

  /* A tap on the lens: the lens and the picture change places (the big
     place is the world's, at the same distance); a tap on the picture in the
     lens's place, or Escape, changes them back. */
  function setSwap(on) {
    on = !!on && readingOn() && LENS;
    if (on === (partsNow().globe === "big")) { return; }
    if (on) { swapWithBig("globe"); } else { partsHome(); }
  }
  /* ---- the three parts -----------------------------------------------------------

     The artist, 7 Oct 2026: "I like being able to switch the places of the
     globe and the artwork, but make sure it works. I also want to throw the
     dial into the mix as far interchangeable parts: 1) globe, 2) artwork
     thumbnail, 3) dial. Each one should adapt to its new shape but maintain
     its functionality". And: "Change the shape of the dial to adapt to the
     rectangular form in some way. The globe goes from a circle to a
     rectangular map, something like that but with time that outlines
     corresponding histories and movements". Three places (workBands: big,
     small, dial) and three parts: a tap on a part out of the big place
     swaps it with the big one (the dial by its ⤢); in the big place the
     globe is a flat map with the view's histories on it in time (the map,
     below), the dial is unrolled into a band of years (drawDial's band),
     the picture is the picture. Kept along a path of readings; Escape, the
     home marks or snapping the small globe home put all three home. */
  var PARTS0 = { globe: "small", picture: "big", dial: "dial" };
  var parts = null;
  function partsNow() { return parts || PARTS0; }
  function partsAway() { return !!parts; }
  function swapWithBig(part) {
    var P = partsNow(), n = { globe: P.globe, picture: P.picture, dial: P.dial };
    var from = n[part];
    if (from === "big") { return; }
    var other = Object.keys(n).filter(function (k) { return n[k] === "big"; })[0];
    n[part] = "big";
    n[other] = from;
    applyParts(n);
  }
  function partsHome() { applyParts(null); }
  function applyParts(n) {
    var a = art;
    if (n && n.globe === "small" && n.picture === "big" && n.dial === "dial") { n = null; }
    if (!readingOn() || !LENS) { n = null; }
    var wasMap = mapOn();
    parts = n;
    var on = partsNow().globe === "big";
    var changed = on !== lensSwapped;
    if (wasMap && !on) { mapLeave(); }
    if (!on && flat) { flat.placed = false; }       // next time the map opens on the globe's middle
    lensSwapped = on;
    layoutWork();
    if (a && !artPlate.hidden) { layoutPlate(null, a.kind === "work" && !a.flipped ? "look" : "rest"); }
    dials.forEach(function (o) { o.placed = ""; o.drawn = ""; });
    if (a) { a.keptAt = 0; }
    if (a && a.lensSpec && !mapOn()) {
      var spec = {};
      Object.keys(a.lensSpec).forEach(function (k) { spec[k] = a.lensSpec[k]; });
      spec.now = false;
      lensTo(spec);
    }
    if (changed && window.Voice && Voice.swapped) { Voice.swapped(on); }
    zoomsAt = 0;
    mapCheck(true);
  }

  /* What is being read, for voice.js (Land.reading): the view, its year,
     the lens and the line under the picture; a work's stops. */
  function readingState() {
    var a = art;
    if (!a || !place || !readingOn()) { return null; }
    var b = workBands();
    var o = { on: true, lens: LENS, kind: a.kind, id: a.data && a.data.id || null, view: a.serial || 0, flying: flying,
              dated: !!a.dated, y0: a.y0, y1: a.y1, year: a.dated ? yearAt(a, Math.max(0, a.when)) : null,
              moving: !!(a.moving || a.auto || a.playing), playing: !!(a.auto || a.playing), byHand: !!a.byHand, swapped: lensSwapped,
              at: b.lensAt, hole: b.hole, cap: b.cap, plate: b.plate, phone: b.phone, look: artEl.dataset.look || "",
              picture: a.picture ? a.picture.id : (a.kind === "work" ? a.data.id : null),
              ground: lensGround.on, travelling: !!a.lens, full: !!artEl.dataset.full, k: lensK(), out: lensOut,
              R: R, rest: LENS_GLOBE ? lensRestR(b) : null, cx: cx, cy: cy, noPicture: !!a.noPicture,
              lat: focus.lat / RAD, lon: wrap(spin) / RAD, snapping: !!a.snap,
              plateShown: !!(artPlate && !artPlate.hidden && artPlate.offsetWidth > 0 && artPlate.querySelector("img")),
              // The grown globe's own marks (a work's stops, a life's places), as boxes: kept clear by the
              // path's readout (transport.js) as the lens is.
              own: grown ? ownBoxes : null };
    if (a.kind === "work") {
      var evs = a.data.events;
      o.work = { pin: a.pin, ring: a.ring, when: a.when, flipped: !!a.flipped, title: a.data.title || "",
                 artists: a.data.artists || [], date: a.data.date || "",
                 stops: a.stops.map(function (s) {
                   return { p: s.p, name: s.name, lat: s.lat / RAD, lon: wrap(s.lon) / RAD,
                            pos: a.evs[s.first].pos, end: a.evs[s.last].pos,
                            y: yearNum(evs[s.first].y), y1: yearNum(evs[s.last].y),
                            k: s.events.map(function (n) { return evs[n].k; }), m: s.m || null };
                 }) };
    }
    return o;
  }

  /* The framing for a set of points: centred on their mean (or the centre
     given), near enough that the furthest (or the angle given) fits the
     band — never nearer than a hand can bring the globe, so its weave holds,
     and a work with one place sits at that nearest. */
  function frameOf(vecs, centre, theta, kind) {
    var c = centre;
    if (!c) {
      var sum = [0, 0, 0];
      vecs.forEach(function (v) { sum[0] += v[0]; sum[1] += v[1]; sum[2] += v[2]; });
      c = norm3(sum);
    }
    if (theta === undefined) {
      theta = 0;
      vecs.forEach(function (v) { theta = Math.max(theta, Math.acos(Math.max(-1, Math.min(1, dot3(c, v))))); });
    }
    theta = Math.max(theta, 3 * RAD);
    var b = artBand(kind), m = Math.min(b.w, b.h);
    var r = 0.4 * m / Math.sin(Math.min(theta, 80 * RAD));
    r = Math.max(0.42 * m, Math.min(base0 * SIZE_MOST, r));
    return { lat: latOf(c), lon: lonOf(c), zoomTo: r / Math.max(1, baseR),
             seatAt: { x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H } };
  }

  /* No place to go to: the world is washed where it already is. */
  function frameHere(kind) {
    var at = unproject(W / 2, H / 2) || { lat: tilt, lon: spin };
    var b = artBand(kind);
    return { lat: at.lat, lon: at.lon, zoomTo: zoom,
             seatAt: { x: (b.x + b.w / 2) / W, y: (b.y + b.h / 2) / H } };
  }

  /* The median of the angles from a centre to the places given by key. */
  function medianAngle(c, keys) {
    var angles = [];
    keys.forEach(function (k) {
      var pl = k && artPlaceBy[k];
      if (pl) { angles.push(Math.acos(Math.max(-1, Math.min(1, dot3(c, pl.v))))); }
    });
    if (!angles.length) { return 3 * RAD; }
    angles.sort(function (a, b) { return a - b; });
    return angles[Math.floor(angles.length / 2)];
  }

  function workCity(h) {
    var stops = stopsOf(h).stops;
    workImage = !!h.image;
    var f = stops.length ? frameOf(stops.map(function (s) { return s.v; }), null, undefined, "work") : frameHere("work");
    return {
      slug: "art-" + h.id, title: h.title || "Untitled",
      where: [(h.artists || []).join(", "), h.date].filter(Boolean).join(" · "),
      lat: f.lat, lon: wrap(f.lon), zoomTo: f.zoomTo, seatAt: f.seatAt,
      tone: stopTone((h.c && h.c[0]) || LIGHT),
      art: { kind: "work", data: h, via: null }
    };
  }

  var THREAD_WORD = { show: "Shown", sale: "Offered", owner: "Owned", museum: "Held",
                      writing: "Written", artist: "By", style: "" };

  function threadCity(tf) {
    var ends = [];
    tf.works.forEach(function (row) { ends.push(row[5], row[6]); });
    var c = null;
    if (tf.ll) { c = toVec(tf.ll[0] * RAD, tf.ll[1] * RAD); }
    var vecs = ends.filter(function (k) { return k && artPlaceBy[k]; }).map(function (k) { return artPlaceBy[k].v; });
    var f = c ? frameOf([], c, medianAngle(c, ends), "thread") : vecs.length ? frameOf(vecs, null, undefined, "thread") : frameHere("thread");
    var n = tf.works.length;
    return {
      slug: "art-thread-" + tf.id, title: tf.name,
      where: [tf.k === "style" ? "Style or movement" : THREAD_WORD[tf.k] || "", n + (n === 1 ? " work" : " works"),
              [tf.at, tf.y].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
      lat: f.lat, lon: wrap(f.lon), zoomTo: f.zoomTo, seatAt: f.seatAt, tone: LIGHT,
      art: { kind: "thread", data: tf, via: null }
    };
  }

  /* A work's own colour, held light enough to be seen on the globe's dark
     ground: Artsy's dominant colours are mostly mid-tones and darker. */
  function stopTone(hex) {
    var c = toHsl(hex);
    return rgbHex(fromHsl(c.h, Math.min(0.72, c.s), Math.max(0.58, c.l)));
  }

  /* Down at the view: its column filled, its slider built, its clock begun.
     Put away when you leave it (stopArt). */
  function startArt(city) {
    stopArt();
    var a = city.art;
    art = {
      live: true, kind: a.kind, data: a.data, via: a.via || {}, city: city, tone: city.tone || LIGHT,
      stops: [], groups: [], legs: [], evs: [], ticks: [], y0: 0, y1: 0,
      when: -1, whenTo: -1, playing: false, byHand: false, seg: null, holdUntil: 0,
      held: null, timers: [], order: [], n: 0, gap: WORD_GAP, dirty: true, ring: -1,
      flipped: false, names: {}, lines: [], heads: [], last: 0, stage: null,
      at: performance.now(), cons: null, rows: [], yearNow: 0, begun: false,
      town: a.town || null, pagers: [], pin: -1, ringShown: -2, glide: null,
      serial: ++readSerial, picture: null, lens: null, lensSpec: null, tense: ""
    };
    art.stopNow = function () {
      if (lensGround.on && lensGround.at) { return { lat: lensGround.at.lat * RAD, lon: lensGround.at.lon * RAD }; }
      var s = art && art.stops[Math.max(0, art.ring)];
      return s ? { lat: s.lat, lon: s.lon } : { lat: place.lat, lon: place.lon };
    };
    artEl.hidden = false;
    artCol.textContent = "";
    artCol.scrollTop = 0;
    artPlate.textContent = "";
    artPlate.hidden = true;
    clearLabel();
    // A work come back to (a crumb, a thread's door) shows its photograph again.
    delete artPlate.dataset.shown;
    artTime.hidden = true;
    artEl.dataset.kind = a.kind;
    // The three parts keep their places along a path of readings; anything else puts them home.
    if (!readKind(a.kind)) { parts = null; }
    lensSwapped = readKind(a.kind) && partsNow().globe === "big";
    layoutWork();
    if (a.kind === "work") {
      buildJourney(art);
      artColumn(art.data, art.via);
      buildTicks(art);
      lookAt(art);
      watchStops(art);
      threadProcession();
      // Through a door: the stop the two works share answers in both their colours.
      var sh = art.via.thread && art.via.thread.ll;
      if (sh && !still) {
        var sp = project(sh[0] * RAD, wrap(sh[1] * RAD));
        if (sp.z > 0) { pulse(sp.x, sp.y, [art.tone, (art.via.from && art.via.from.tone) || LIGHT], 0.6, 144); }
      }
    } else if (a.kind === "town") {
      artEl.dataset.look = "done";
      startTown(art);
    } else if (a.kind === "life") {
      // The lives (lives.js): the column, the dial's years and the route are its.
      artEl.dataset.look = "done";
      if (window.Lives && Lives.start) { Lives.start(lifeApi(art)); }
    } else if (a.kind === "movement") {
      // The movements (movements.js): the column, the dial's years and the marks are its.
      artEl.dataset.look = "done";
      if (window.Movements && Movements.start) { Movements.start(lifeApi(art)); }
    } else {
      artEl.dataset.look = "done";
      threadColumn(art.data, art.via);
    }
    // Only now: an empty column is not drawn, and keeps the last one's scroll.
    artCol.scrollTop = 0;
    var mine_ = art;
    requestAnimationFrame(function () { if (art === mine_) { artEl.dataset.on = "true"; } });
  }

  function stopArt() {
    if (!art) { return; }
    var a = art;
    a.live = false;
    a.playing = false;
    a.timers.forEach(function (t) { window.clearTimeout(t); });
    if (a.watch) { a.watch.disconnect(); }
    a.pagers.forEach(function (p) { p.disconnect(); });
    if (a.kind === "town") { stopTown(); }
    if (a.kind === "life" && window.Lives && Lives.stop) { Lives.stop(); }
    if (a.kind === "movement" && window.Movements && Movements.stop) { Movements.stop(); }
    a.cons = null;
    a.lens = null;
    lensGroundOff();
    lensSwapped = false;
    Object.keys(a.names).forEach(function (p) {
      var n = a.names[p];
      if (n.parentNode) { n.parentNode.removeChild(n); }
    });
    art = null;
    artEl.hidden = true;
    delete artEl.dataset.on;
    delete artEl.dataset.look;
    delete artEl.dataset.kind;
    delete artEl.dataset.held;
    delete artEl.dataset.came;
    delete artEl.dataset.full;
    layoutWork();
    artCol.textContent = "";
    artPlate.textContent = "";
    artPlate.hidden = true;
    clearLabel();
    artPlate.style.transform = "";
    delete artPlate.dataset.mode;
    delete artPlate.dataset.shown;
    artTime.hidden = true;
    tilesDirty = true;
  }

  /* ---- the journey ---------------------------------------------------------

     Consecutive events at one place are a stop; a leg is the great circle
     from one stop to the next, lifted a little over its middle so a hop
     across town hugs the ground and an ocean crossing arches. Both are
     drawn in the page's pixel light, on the 13 px grid, as the slider
     passes each arrival. Writings are never stops — a writing is not travel —
     and nor is a place known only as a country. */

  // "1968-11-30" as a year with its fraction; null when there is none.
  function yearNum(y) {
    var m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(y || "");
    if (!m) { return null; }
    return Number(m[1]) + (m[2] ? (Number(m[2]) - 1) / 12 : 0) + (m[3] ? (Number(m[3]) - 1) / 365 : 0);
  }

  /* The column's groups (a run of events at one place, or where no place is
     recorded) and the globe's stops (runs of placed events, which a run of
     unrecorded ones between two at the same place does not break). */
  function stopsOf(h) {
    var groups = [], stops = [], cur = null, stop = null, gap = false;
    h.events.forEach(function (ev, n) {
      if (ev.k === "written") { return; }
      var placed = !!(ev.ll && ev.p);
      var key = placed ? ev.p : "";
      if (!cur || cur.key !== key) {
        cur = { key: key, p: ev.p, name: ev.w, unplaced: !placed, events: [], stop: -1 };
        groups.push(cur);
      }
      cur.events.push(n);
      if (!placed) { if (stop) { gap = true; } return; }
      if (!stop || stop.p !== ev.p) {
        var lat = ev.ll[0] * RAD, lon = wrap(ev.ll[1] * RAD);
        stop = { p: ev.p, name: ev.w, lat: lat, lon: lon, v: toVec(lat, lon), pr: ev.pr,
                 m: null, first: n, last: n, events: [], broken: gap, visit: 0 };
        stops.forEach(function (s) { if (s.p === stop.p) { stop.visit += 1; } });
        stops.push(stop);
      }
      gap = false;
      stop.events.push(n);
      stop.last = n;
      // A stop is at a museum only when all of it is: one show at the
      // Guggenheim does not make New York the Guggenheim.
      stop.m = stop.events.length === 1 ? ev.m || null : stop.m === ev.m ? stop.m : null;
      // The most exact placing it has: a venue, else the city, else only
      // where the gallery that listed it is.
      if (ev.pr === "venue" || (ev.pr === "city" && stop.pr === "office")) { stop.pr = ev.pr; }
      cur.stop = stops.length - 1;
    });
    return { groups: groups, stops: stops };
  }

  /* A great circle from one point to another, every two degrees, lifted
     over its middle; nothing when they are the same place. */
  function arcOf(av, bv) {
    var om = Math.acos(Math.max(-1, Math.min(1, dot3(av, bv))));
    if (om < 1e-5) { return null; }
    var count = Math.max(2, Math.ceil(om / (2 * RAD)) + 1);
    var s = new Float32Array(count * 4);
    var high = 0.12 * Math.min(1, om / (90 * RAD));
    for (var k = 0; k < count; k += 1) {
      var t = k / (count - 1);
      var fa = Math.sin((1 - t) * om) / Math.sin(om), fb = Math.sin(t * om) / Math.sin(om);
      s[k * 4] = av[0] * fa + bv[0] * fb;
      s[k * 4 + 1] = av[1] * fa + bv[1] * fb;
      s[k * 4 + 2] = av[2] * fa + bv[2] * fb;
      s[k * 4 + 3] = 1 + high * Math.sin(Math.PI * t);
    }
    return s;
  }

  /* The legs between the stops. */
  function legsOf(stops) {
    var legs = [];
    for (var n = 1; n < stops.length; n += 1) {
      var a = stops[n - 1], b = stops[n];
      var s = arcOf(a.v, b.v);
      if (!s) { continue; }
      legs.push({ a: n - 1, b: n, at: b.first, broken: b.broken, samples: s, litAt: null });
    }
    return legs;
  }

  /* Where on the slider each event is: linear in years, from the first dated
     event to now, so every history runs to today. An undated event takes the
     place of the one before it. */
  function buildJourney(a) {
    var h = a.data;
    var sg = stopsOf(h);
    a.groups = sg.groups;
    a.stops = sg.stops;
    a.legs = legsOf(a.stops);
    var d = new Date();
    var nowY = d.getFullYear() + (d.getMonth() + (d.getDate() - 1) / 31) / 12;
    var y0 = Infinity;
    h.events.forEach(function (ev) { var y = yearNum(ev.y); if (y !== null && y < y0) { y0 = y; } });
    a.dated = y0 !== Infinity;
    if (!a.dated) { y0 = nowY - 1; }
    y0 = Math.floor(y0);
    if (nowY - y0 < 1) { y0 = nowY - 1; }
    a.y0 = y0;
    a.y1 = nowY;
    var prev = 0;
    a.evs = h.events.map(function (ev) {
      var y = yearNum(ev.y);
      var pos = y === null ? prev : Math.max(0, Math.min(1, (y - y0) / (nowY - y0)));
      prev = pos;
      return { pos: pos, lit: false };
    });
    var seen = {};
    a.ticks = [];
    a.evs.forEach(function (e) {
      var k = e.pos.toFixed(5);
      if (!seen[k]) { seen[k] = true; a.ticks.push(e.pos); }
    });
    a.ticks.sort(function (m, n) { return m - n; });
  }

  // A point of the unit sphere, lifted, on the screen.
  function liftedAt(x, y, z, lift) {
    var p = project(latOf([x, y, z]), lonOf([x, y, z]));
    var sx = cx + (p.x - cx) * lift, sy = cy + (p.y - cy) * lift;
    var dx = sx - cx, dy = sy - cy;
    return { x: sx, y: sy, front: p.z >= 0 || dx * dx + dy * dy > R * R };
  }

  /* A leg walked through the grid: the tiles it passes, in order. */
  function legCells(leg) {
    var s = leg.samples, out = [], li = null, lj = null, lx = 0, ly = 0;
    function add(x, y, front) {
      var i = Math.floor(x / CELL_PX), j = Math.floor(y / CELL_PX);
      if (i === li && j === lj) { return; }
      li = i; lj = j;
      out.push(i, j, front ? 1 : 0);
    }
    for (var k = 0; k < s.length; k += 4) {
      var p = liftedAt(s[k], s[k + 1], s[k + 2], s[k + 3]);
      if (k === 0) { add(p.x, p.y, p.front); }
      else {
        var steps = Math.max(1, Math.ceil(Math.max(Math.abs(p.x - lx), Math.abs(p.y - ly)) / (CELL_PX * 0.5)));
        for (var st = 1; st <= steps; st += 1) {
          add(lx + (p.x - lx) * st / steps, ly + (p.y - ly) * st / steps, p.front);
        }
      }
      lx = p.x; ly = p.y;
    }
    return out;
  }

  /* The legs, into drawTiles' runs: a leg being reached runs out from its
     stop with its head at the top level and a tail stepping down; the last
     leg rests a level up from the older ones. The unrecorded between two
     stops is every other tile, and so is the far side of the world. */
  function drawJourney(runs, t) {
    var a = art;
    if (a) {
      a.dirty = false;
      a.anim = false;
      var lastLit = -1;
      a.legs.forEach(function (leg, n) { if (leg.litAt !== null) { lastLit = n; } });
      a.legs.forEach(function (leg, n) {
        if (leg.litAt === null) { return; }
        var q = still ? 1 : Math.max(0, Math.min(1, (t - leg.litAt) / LEG_MS));
        if (q < 1) { a.anim = true; }
        legRuns(runs, leg, LIGHT, n === lastLit ? 2 : 1, q, leg.broken, 0);
      });
      if (a.cons) { consRuns(a, runs, t); }
    }
    // Up at the world: the walk, going out, and the passing journey.
    if (walkShown) { walkRuns(runs, t); }
    if (passing && passing.legs) {
      if (place || flying) { endPassing(t); } else { passingRuns(runs, t); }
    }
  }

  /* One leg into the runs: lit from its start as far as q, the head bright
     and a tail stepping down to its resting level while it runs; the part
     already gone out (a fraction of it) left dark. Returns the head. */
  function legRuns(runs, leg, tone, rest, q, broken, gone) {
    var cols = Math.ceil(W / CELL_PX), rows = Math.ceil(H / CELL_PX);
    var cells = legCells(leg);
    var count = cells.length / 3;
    var head = Math.floor(q * (count - 1)), from = Math.floor((gone || 0) * count);
    var at = null;
    for (var c = from; c <= head; c += 1) {
      var i = cells[c * 3], j = cells[c * 3 + 1], front = cells[c * 3 + 2];
      if (c === head) { at = { x: (i + 0.5) * CELL_PX, y: (j + 0.5) * CELL_PX }; }
      if (i < 0 || j < 0 || i >= cols || j >= rows) { continue; }
      var lvl = rest;
      if (q < 1) {
        var back = head - c;
        if (back < 4) { lvl = Math.max(rest, 4 - back); }
      }
      if (!front) {
        if (c % 2) { continue; }
        lvl = 1;
      } else if (broken && c % 2) {
        continue;
      }
      var key = tone + "|" + lvl;
      (runs[key] || (runs[key] = [])).push(i, j);
    }
    return at;
  }

  /* The stops, over the legs, in the work's own colour: filled where a
     source puts the work there, outlined where only the listing gallery's
     address is known, and five tiles in a diamond at one of the site's
     museums. A return brightens it; the stop the slider is at is ringed. */
  function drawStops(g, t) {
    var a = art;
    if (!a || !a.stops.length) { return; }
    var seen = {};
    a.stops.forEach(function (s, k) {
      if (a.evs[s.first].pos > a.when + 1e-9) { return; }
      seen[s.p] = (seen[s.p] || 0) + 1;
    });
    var drawn = {};
    a.stops.forEach(function (s, k) {
      if (a.evs[s.first].pos > a.when + 1e-9 || drawn[s.p]) { return; }
      drawn[s.p] = true;
      var p = project(s.lat, s.lon);
      if (p.z < 0) { return; }
      var x = Math.floor(p.x / CELL_PX) * CELL_PX, y = Math.floor(p.y / CELL_PX) * CELL_PX;
      g.globalAlpha = Math.min(1, 0.7 + 0.15 * (seen[s.p] - 1));
      g.fillStyle = a.tone;
      g.strokeStyle = a.tone;
      if (s.m) {
        [[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].forEach(function (d) {
          g.fillRect(x + d[0] * CELL_PX + 1, y + d[1] * CELL_PX + 1, CELL_PX - 2, CELL_PX - 2);
        });
      } else if (s.pr === "office") {
        g.lineWidth = 2;
        g.strokeRect(x + 3, y + 3, CELL_PX - 6, CELL_PX - 6);
      } else {
        g.fillRect(x + 1, y + 1, CELL_PX - 2, CELL_PX - 2);
      }
    });
    var r = a.stops[a.ring];
    if (r && a.evs[r.first].pos <= a.when + 1e-9) {
      var rp = project(r.lat, r.lon);
      if (rp.z >= 0) {
        var rx = Math.floor(rp.x / CELL_PX) * CELL_PX, ry = Math.floor(rp.y / CELL_PX) * CELL_PX;
        var o = r.m ? CELL_PX : 0;          // round the diamond, or the tile
        g.globalAlpha = LEVELS[4];
        g.strokeStyle = LIGHT;
        g.lineWidth = 2;
        g.strokeRect(rx - o - 3, ry - o - 3, CELL_PX + 2 * o + 6, CELL_PX + 2 * o + 6);
      }
    }
    g.globalAlpha = 1;
    g.lineWidth = 1;
  }

  /* The clock of the journey. Playing, it lingers on each event and crosses
     any empty stretch in at most 618 ms, at the town timeline's pace
     otherwise; by hand it follows the slider 377 ms behind. Every event it
     passes lights its line; an arrival pulses and names its stop. */
  function stepArt(now) {
    var a = art;
    if (!a) { return; }
    var dt = Math.min(100, now - (a.last || now));
    a.last = now;
    var was = a.when;
    // The lens's distance, flown between voices (voice.js); the ground in it.
    stepLens(a, now);
    if (lensGround.on) { placeLensGround(); }
    if (a.kind !== "work") {
      // A place's or a thread's years: by hand only. Works not yet there
      // step back, and the constellation keeps to those that had arrived.
      // The first time, a city's years play by themselves (autoTown).
      if (a.auto) {
        var qa = Math.max(0, (now - a.auto.at) / a.auto.dur);
        a.when = a.whenTo = qa >= 1 ? 1 : 0.5 - 0.5 * Math.cos(Math.PI * qa);
        if (qa >= 1) { a.auto = null; }
      } else if (a.byHand && a.when !== a.whenTo) {
        a.when += (a.whenTo - a.when) * Math.min(1, dt / 377);
        if (Math.abs(a.whenTo - a.when) < 0.0005) { a.when = a.whenTo; }
      }
      a.moving = a.when !== was;
      if (a.moving) {
        var yr = yearAt(a, a.when);
        if (yr !== a.yearNow) { a.yearNow = yr; laterRows(a); a.dirty = true; }
        showArtYear();
      }
      if (Math.abs(shortest(spin, wanted)) > 1e-5) { a.dirty = true; }
      return;
    }
    if (a.playing) {
      if (now >= a.holdUntil) {
        if (!a.seg) {
          var next = 1;
          for (var k = 0; k < a.ticks.length; k += 1) {
            if (a.ticks[k] > a.when + 1e-9) { next = a.ticks[k]; break; }
          }
          a.seg = { from: a.when, to: next, at: now,
                    dur: Math.min((next - a.when) * CLOD_GROW, ART_LINGER) };
        }
        var q = a.seg.dur > 0 ? Math.min(1, (now - a.seg.at) / a.seg.dur) : 1;
        a.when = a.seg.from + (a.seg.to - a.seg.from) * q;
        if (q >= 1) {
          a.when = a.seg.to;
          a.seg = null;
          if (a.when >= 1) { a.playing = false; }
          else { a.holdUntil = now + ART_LINGER; }
        }
      }
      a.whenTo = a.when;
    } else if (a.byHand && a.when !== a.whenTo) {
      a.when += (a.whenTo - a.when) * Math.min(1, dt / 377);
      if (Math.abs(a.whenTo - a.when) < 0.0005) { a.when = a.whenTo; }
    }
    a.moving = a.when !== was;
    if (a.moving) {
      passEvents(a, now, a.when > was);
      showArtYear();
      a.dirty = true;
    }
    stepGlide(a, now);
    if (a.ring !== a.ringShown) { markCurrent(a); }
    // The world may still be settling from the flight.
    if (Math.abs(shortest(spin, wanted)) > 1e-5) { a.dirty = true; }
  }

  function passEvents(a, now, forward) {
    var arrived = [], passed = 0;
    a.evs.forEach(function (e, n) {
      var on = e.pos <= a.when + 1e-9;
      if (on === e.lit) { return; }
      e.lit = on;
      var line = a.lines[n];
      if (line) { if (on) { line.dataset.on = "true"; } else { delete line.dataset.on; } }
      if (on) { passed += 1; }
    });
    var ring = -1;
    a.stops.forEach(function (s, k) {
      var on = a.evs[s.first].pos <= a.when + 1e-9;
      if (on) { ring = k; }
      if (on && !s.reached) { s.reached = true; arrived.push(k); }
      if (!on) { s.reached = false; }
    });
    // The legs: the newest one reached runs out from its stop; any passed
    // over at once (by hand, or all of them under reduced motion) are whole.
    var fresh = [];
    a.legs.forEach(function (leg) {
      var on = a.evs[leg.at].pos <= a.when + 1e-9;
      if (!on) { leg.litAt = null; return; }
      if (leg.litAt === null) { fresh.push(leg); }
    });
    fresh.forEach(function (leg, n) { leg.litAt = n === fresh.length - 1 && forward ? now : now - LEG_MS; });
    // A stop chosen by hand stays ringed while the dial stands at its time:
    // several stops can share one (undated events take the time before them).
    var pinned = a.pin >= 0 && a.stops[a.pin] ? a.evs[a.stops[a.pin].first].pos : -1;
    if (pinned >= 0 && Math.abs(pinned - a.whenTo) < 1e-6) { ring = a.pin; } else { a.pin = -1; }
    if (ring !== a.ring) { a.ring = ring; }
    if (forward && !still) {
      arrived.forEach(function (k) {
        var s = a.stops[k];
        var p = project(s.lat, s.lon);
        if (p.z > 0) {
          pulse(p.x, p.y, [a.tone, LIGHT], 0.5, 89);
          if (s.m) { sparkle(p.x, p.y, [GOLD], 8); }
        }
        if (window.Systems && Systems.sound && Systems.sound.on) { Systems.sound.tone(2637, 0.03, "square", 0.08); }
      });
      if (passed) { scramble(artYear, "decode", 0, 160); }
    }
    arrived.forEach(function (k) { nameStop(a, a.stops[k]); });
  }

  /* A stop's name: the one writing the globe carries in an art view. It is
     typed in beside the stop the first time the stop is reached. */
  function nameStop(a, s) {
    if (a.names[s.p]) { return; }
    var n = el("span", "art-stop-name", (s.name || "").split(",")[0]);
    n.setAttribute("aria-hidden", "true");
    artEl.appendChild(n);
    a.names[s.p] = n;
    scramble(n, "type", 0, 520);
  }

  function placeStops() {
    var a = art;
    if (!a) { return; }
    var taken = [];
    // The small globe let out over the reading: never a name over the column.
    var col = lensOut && artCol ? artCol.getBoundingClientRect() : null;
    var top = lensOut && banner && !banner.hidden ? bannerUnder.getBoundingClientRect().bottom + 4 : -1e9;
    a.stops.forEach(function (s) {
      var n = a.names[s.p];
      if (!n || n.placed === a.frame) { return; }
      n.placed = a.frame;
      var p = project(s.lat, s.lon);
      var x = Math.floor(p.x / CELL_PX) * CELL_PX + CELL_PX + 5, y = Math.floor(p.y / CELL_PX) * CELL_PX;
      var w = n.offsetWidth || 60;
      var clear = p.z > 0.18 && y > top && !(col && x + w > col.left && x < col.right && y + 12 > col.top && y < col.bottom) && !taken.some(function (b) {
        return x < b.x + b.w && b.x < x + w && Math.abs(b.y - y) < 12;
      });
      if (clear) { taken.push({ x: x, y: y, w: w }); }
      n.style.visibility = clear ? "visible" : "hidden";
      n.style.transform = "translate(" + x.toFixed(0) + "px," + y.toFixed(0) + "px)";
    });
    a.frame = (a.frame || 0) + 1;
  }

  /* The stop a press on the globe landed on. */
  function hitStop(x, y) {
    var a = art;
    if (!a || !a.stops.length) { return -1; }
    var best = -1, near = CELL_PX * (1 + INV);
    a.stops.forEach(function (s, k) {
      if (a.evs[s.first].pos > a.when + 1e-9) { return; }
      var p = project(s.lat, s.lon);
      if (p.z < 0) { return; }
      var d = Math.max(Math.abs(p.x - x), Math.abs(p.y - y));
      if (d < near) { near = d; best = k; }
    });
    return best;
  }

  /* A stop chosen on the globe: the slider to its first event, the column
     to its place. */
  function chooseStop(k) {
    var a = art;
    var s = a && a.stops[k];
    if (!s) { return; }
    showStop(k, true);
    var head = null;
    a.heads.forEach(function (hd) { if (!head && Number(hd.dataset.stop) === k) { head = hd; } });
    if (head) {
      a.scrolledAt = performance.now();
      artCol.scrollTo({ top: Math.max(0, head.closest(".art-stop").offsetTop - 8), behavior: still ? "auto" : "smooth" });
    }
  }

  /* A stop read (its head pressed, a line of it opened, or scrolled to): the
     dial to its year, its place ringed and lit, and the world eased round so
     the place stands in the middle of the band. The map answers the text
     (artist, 1 Oct 2026: "right now it doesn't quite connect to the map"). */
  function showStop(k, pressedOnGlobe) {
    var a = art;
    var s = a && a.stops[k];
    if (!s) { return; }
    setWhen(a, a.evs[s.first].pos);
    a.ring = a.pin = k;
    a.dirty = true;
    glideTo(a, s.lat, s.lon);
    later(function () { if (art === a && a.ring === k) { pulseStop(k, pressedOnGlobe ? 0.6 : 0.5); } }, still ? 0 : 720, a);
  }

  /* The world turned so a point stands at the band's middle, in 820 ms: down
     in a place the point held there is the focus, at the lean (reframe). */
  function glideTo(a, lat, lon) {
    if (flying || !place) { return; }
    // In the reading layout the lens is turned there, as near as its voice already stands.
    if (LENS && a === art && readingOn() && a.lensSpec) {
      var to = [lat / RAD, wrap(lon) / RAD];
      lensTo({ voice: a.lensSpec.voice === "first" ? "close" : a.lensSpec.voice, at: to, pts: [to] });
      return;
    }
    if (still) {
      focus.lat = lat;
      lean(lat);
      spin = wanted = lon;
      reframe();
      a.dirty = true;
      return;
    }
    a.glide = { lat0: focus.lat, lon0: spin, lat1: lat, dLon: shortest(spin, lon), at: performance.now(), dur: 820 };
  }

  function stepGlide(a, now) {
    var gd = a.glide;
    if (!gd || flying) { return; }
    var q = Math.min(1, (now - gd.at) / gd.dur), e = q * q * (3 - 2 * q);
    var lat = gd.lat0 + (gd.lat1 - gd.lat0) * e;
    focus.lat = lat;
    lean(lat);
    spin = wanted = gd.lon0 + gd.dLon * e;
    reframe();
    a.dirty = true;
    if (q >= 1) { a.glide = null; }
  }

  /* The stop being read is marked in the column too. */
  function markCurrent(a) {
    a.ringShown = a.ring;
    artCol.querySelectorAll(".art-stop[data-stop]").forEach(function (li) {
      if (Number(li.dataset.stop) === a.ring) { li.dataset.current = "true"; } else { delete li.dataset.current; }
    });
  }

  /* ---- the slider ----------------------------------------------------------

     The town timeline's own instrument (.building-time), linear in the
     work's years, from its first dated event to now. A tick for each event,
     raised for a writing, hollow for a date given as "c.". */

  function setWhen(a, pos) {
    flipToHead();
    a.auto = null;
    a.firstPlay = false;
    a.playing = false;
    a.seg = null;
    a.byHand = true;
    a.whenTo = Math.max(0, Math.min(1, pos));
  }

  function yearAt(a, when) {
    return Math.floor(a.y0 + Math.max(0, when) * (a.y1 - a.y0));
  }

  function showArtYear() {
    var a = art;
    if (!a || !artYear) { return; }
    var yr = String(yearAt(a, a.when < 0 ? 0 : a.when));
    if (!artYear.scrambling) { artYear.textContent = yr; }
    // Not under the keys turning it — unless a path plays (transport.js), whose keys step its stops.
    if (document.activeElement !== artRange || (window.Dial && Dial.live && Dial.live())) { artRange.value = String(Math.round(Math.max(0, a.when) * 1000)); }
    artRange.setAttribute("aria-valuetext", yr);
  }

  function buildTicks(a) {
    artTicks.textContent = "";
    if (!a.dated) { artTime.hidden = true; return; }
    a.data.events.forEach(function (ev, n) {
      var t = el("span", "art-tick");
      t.style.left = (a.evs[n].pos * 100).toFixed(2) + "%";
      if (ev.k === "written") { t.dataset.kind = "written"; }
      if (ev.c) { t.dataset.circa = "true"; }
      artTicks.appendChild(t);
    });
    artTime.hidden = false;
    showArtYear();
  }

  if (artRange) {
    artRange.addEventListener("pointerdown", function (event) { event.stopPropagation(); flipToHead(); });
    artRange.addEventListener("input", function () {
      var a = art;
      if (!a || !a.ticks.length) { return; }
      var raw = Number(artRange.value) / 1000, v = raw;
      // It snaps to an event within one and a half per cent of the span
      // (a life, whose span is a century, to a year either side).
      var near = a.kind === "life" ? 1.2 / Math.max(1, a.y1 - a.y0) : 0.015;
      a.ticks.forEach(function (t) { if (Math.abs(t - raw) < near) { near = Math.abs(t - raw); v = t; } });
      setWhen(a, v);
      artYear.textContent = String(yearAt(a, v));
    });
  }

  /* ---- the dial ------------------------------------------------------------

     Time is a circle, not a line (artist, 30 Sep 2026: "the slide bar for
     the timelapse should be circle based and futuristic … the most powerful
     device in the history of the world"). Each timeline is a dial. The years
     run clockwise from the top round to the top again, where now meets the
     beginning across a small gap; the year stands in the middle over its
     span; every event is a mark inside the ring, lit once it is passed; the
     way already come is a line of light with a comet's tail behind the
     handle, the museums' diamond. Two rings inside it are geared to time and
     turn as it turns, one against the other at phi, so turning the years is
     felt as a mechanism; the chronograph's scale outside stays still. It is
     turned by dragging round it, by a wheel or a trackpad over it, or by the
     keyboard on the range underneath, which stays for everything that sets
     it: the dial only reads it and, when turned, writes it. It draws only
     when something on it has changed. */
  var DIAL_GAP = 18 * RAD;
  var DIAL_START = -Math.PI / 2 + DIAL_GAP / 2;
  var DIAL_SWEEP = TAU - DIAL_GAP;
  var dials = [];
  var dialFont = (getComputedStyle(document.documentElement).getPropertyValue("--mono") || "monospace").trim();

  /* Where the dial stands (artist, 1 Oct 2026: "Have me be able to move the
     circle timeline anywhere on the screen when I want to"). Dragging from
     its face — the year in the middle — carries it; on a touch screen so
     does holding a finger anywhere on it for a moment (it lifts). It follows
     1:1, stays wholly on the screen and clear of the banner, and eases into
     place, drawn to an edge within 24 px. Its place is this viewer's, kept
     as a fraction of the window, one for a phone-sized window and one for a
     larger, and every dial on the site stands there. A double tap on its
     face sends it home; Shift and the arrows nudge it. */
  var DIAL_MARGIN = 12, DIAL_MAGNET = 24, DIAL_HOLD = 350, DIAL_HOME_MAGNET = 40;
  var dialPlaceVer = 0;
  function dialPlaceKey() { return "dial.place." + (window.innerWidth <= 720 ? "phone" : "desk"); }
  function dialPlace() {
    try {
      var p = JSON.parse(localStorage.getItem(dialPlaceKey()) || "null");
      return p && isFinite(p.x) && isFinite(p.y) ? p : null;
    } catch (e) { return null; }
  }
  function dialMoved() { return !!dialPlace(); }
  function keepDialPlace(p) {
    try {
      if (p) { localStorage.setItem(dialPlaceKey(), JSON.stringify({ x: +p.x.toFixed(4), y: +p.y.toFixed(4) })); }
      else { localStorage.removeItem(dialPlaceKey()); }
    } catch (e) {}
    dialPlaceVer += 1;
  }
  function dialSize(d) { return d.box.offsetWidth || (window.innerWidth <= 720 ? 136 : 168); }
  /* The centre clamped onto the screen, under the banner. */
  function dialClamp(d, x, y) {
    var S = dialSize(d), w = window.innerWidth, h = window.innerHeight;
    var top = DIAL_MARGIN;
    if (banner && !banner.hidden) {
      var br = banner.getBoundingClientRect();
      if (br.height) { top = Math.max(top, br.bottom + DIAL_MARGIN); }
    }
    return { x: Math.max(DIAL_MARGIN + S / 2, Math.min(w - DIAL_MARGIN - S / 2, x)),
             y: Math.max(top + S / 2, Math.min(h - DIAL_MARGIN - S / 2, y)) };
  }
  function dialPut(d, x, y) {
    var c = dialClamp(d, x, y), S = dialSize(d);
    var host = d.box.offsetParent || d.box.parentElement;
    var pr = host ? host.getBoundingClientRect() : { left: 0, top: 0 };
    var st = d.box.style;
    st.setProperty("left", Math.round(c.x - S / 2 - pr.left) + "px", "important");
    st.setProperty("top", Math.round(c.y - S / 2 - pr.top) + "px", "important");
    st.setProperty("right", "auto", "important");
    st.setProperty("bottom", "auto", "important");
    st.setProperty("transform", "none", "important");
    d.box.dataset.moved = "true";
    if (c.x - S / 2 < 34) { d.box.dataset.homeSide = "right"; } else { delete d.box.dataset.homeSide; }
    return c;
  }
  function dialHome(d) {
    ["left", "top", "right", "bottom", "transform"].forEach(function (k) { d.box.style.removeProperty(k); });
    delete d.box.dataset.moved;
  }
  /* Each dial to the viewer's place (or home), whenever the window or the
     place has changed since it was last put. */
  function placeDial(d) {
    var key = window.innerWidth + "x" + window.innerHeight + "|" + dialPlaceVer;
    if (d.placed === key || d.move) { return; }
    d.placed = key;
    // In another part's place (the three parts): where layoutWork puts it.
    if (d.box.dataset.slot) { dialHome(d); return; }
    var p = dialPlace();
    if (p) { dialPut(d, p.x * window.innerWidth, p.y * window.innerHeight); } else { dialHome(d); }
  }
  function dialSettle(d) {
    d.box.dataset.settling = "true";
    window.clearTimeout(d.settleT);
    d.settleT = window.setTimeout(function () { delete d.box.dataset.settling; }, 340);
  }
  function dialSendHome(d) {
    var r0 = d.box.getBoundingClientRect();
    keepDialPlace(null);
    dialHome(d);
    var home = d.box.getBoundingClientRect();
    if (still) { d.placed = ""; return; }
    // Eased home from where it stood, then given back to its stylesheet.
    dialPut(d, r0.left + r0.width / 2, r0.top + r0.height / 2);
    void d.box.offsetWidth;
    dialSettle(d);
    dialPut(d, home.left + home.width / 2, home.top + home.height / 2);
    window.setTimeout(function () { if (!dialPlace()) { dialHome(d); d.placed = ""; } }, 340);
  }
  /* Home, from its double tap, its home mark or the magnet: the other dials
     and the reading's lens (which keeps room for it on a phone) are told. */
  function dialGoHome(d) {
    dialSendHome(d);
    dials.forEach(function (o) { if (o !== d) { o.placed = ""; } });
    dialRelens();
  }
  function dialRelens() {
    if (!art || !readKind(art.kind)) { return; }
    layoutWork();
    if (art.lensSpec && place && !flying) {
      var sp = {};
      Object.keys(art.lensSpec).forEach(function (k) { sp[k] = art.lensSpec[k]; });
      sp.now = still;
      lensTo(sp);
    }
  }

  /* The first time (artist, 1 Oct 2026: "It also should play automatically
     the first time someone comes to see it on a new part of the globe"): a
     city's years, a work's history and a museum's ground each play from the
     beginning to now the first time this viewer comes to them, and rest at
     now after. Any touch, drag, wheel or key hands it over at once. Not
     under reduced motion, nor while a walk, an exploration or a corpse is
     driving the dial itself. */
  var DIAL_SEEN = "dial.seen", DIAL_SEEN_MOST = 800;
  function firstSeen(key) {
    var list = [];
    try { list = JSON.parse(localStorage.getItem(DIAL_SEEN) || "[]"); } catch (e) { list = []; }
    if (!Array.isArray(list)) { list = []; }
    if (list.indexOf(key) >= 0) { return false; }
    list.push(key);
    try { localStorage.setItem(DIAL_SEEN, JSON.stringify(list.slice(-DIAL_SEEN_MOST))); } catch (e) {}
    return true;
  }
  function dialDriven() {
    try {
      if (window.Walks && Walks.walking && Walks.walking()) { return true; }
      var x = window.Explorations && Explorations._state && Explorations._state();
      if (x && x.playing) { return true; }
      var c = window.Corpse && Corpse._state && Corpse._state();
      if (c && (c.leg || c.stage || c.ritual)) { return true; }
    } catch (e) {}
    return false;
  }
  function stopFirstPlay() {
    var a = art;
    if (a && a.auto) { a.auto = null; a.whenTo = a.when; a.byHand = true; }
    if (a && a.firstPlay && a.playing) {
      a.playing = false; a.seg = null; a.whenTo = a.when; a.byHand = true; a.firstPlay = false;
    }
    if (clod && clod.firstPlay && !clod.byHand && clod.when < clod.whenTo) {
      clod.whenTo = clod.when; clod.byHand = true; clod.touched = true; clod.firstPlay = false;
    }
  }
  ["pointerdown", "wheel", "keydown", "touchstart"].forEach(function (type) {
    window.addEventListener(type, function (event) {
      if (event.isTrusted) { stopFirstPlay(); }
    }, { capture: true, passive: true });
  });
  /* A city's years from its first to now, calmly: 8 to 12 s by its span. */
  function autoTown(a) {
    if (still || a.byHand || !a.dated || !a.town || dialDriven() || !firstSeen("t:" + a.town.key)) { return; }
    a.when = a.whenTo = 0;
    a.yearNow = Math.floor(a.y0);
    laterRows(a);
    a.auto = { at: performance.now() + 600, dur: Math.max(8000, Math.min(12000, 8000 + (a.y1 - a.y0) * 40)) };
    showArtYear();
    a.dirty = true;
  }

  function dialInner(d) { return d.range === artRange && window.DialHub && DialHub.busy && DialHub.busy() ? 0.22 : 0.3; }

  function makeDial(box, range, span, ticksOf) {
    if (!box || !range) { return; }
    box.classList.add("dial");
    var face = document.createElement("canvas");
    face.className = "dial-face";
    face.setAttribute("aria-hidden", "true");
    box.appendChild(face);
    var d = { box: box, range: range, face: face, g: face.getContext("2d"), span: span, ticksOf: ticksOf,
              drawn: "", grab: null, last: null, down: null, move: null, hold: 0, lastTap: 0, placed: "" };
    // Its home mark (artist, 2 Oct 2026: "I can make them go back to that
    // initial place with some sort of snap function"): shown while it is moved.
    var homeMark = document.createElement("button");
    homeMark.type = "button";
    homeMark.className = "snap-home dial-home";
    homeMark.setAttribute("aria-label", "The dial, back to its place");
    homeMark.title = "Back to its place";
    homeMark.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    homeMark.addEventListener("click", function (event) { event.stopPropagation(); dialGoHome(d); });
    box.appendChild(homeMark);
    // Unrolled into a band (drawDial): a press on the band as the press on the ring it stands for.
    function ringEv(event) {
      if (!d.geo || !event || event.clientX === undefined) { return event; }
      var r = face.getBoundingClientRect(), p = bandToRing(d.geo, event.clientX - r.left, event.clientY - r.top);
      return { clientX: r.left + r.width / 2 + (p.x - d.geo.c), clientY: r.top + r.height / 2 + (p.y - d.geo.c),
               pointerId: event.pointerId, pointerType: event.pointerType, type: event.type, target: event.target,
               deltaX: event.deltaX, deltaY: event.deltaY,
               preventDefault: function () { event.preventDefault(); }, stopPropagation: function () { event.stopPropagation(); } };
    }
    function hubXY(event) {
      var r = face.getBoundingClientRect(), x = event.clientX - r.left, y = event.clientY - r.top;
      if (d.geo) { var p = bandToRing(d.geo, x, y); return { x: p.x, y: p.y, w: r.width }; }
      return { x: x, y: y, w: r.width };
    }
    function tAt(event) {
      event = ringEv(event);
      var r = face.getBoundingClientRect();
      var a = Math.atan2(event.clientY - r.top - r.height / 2, event.clientX - r.left - r.width / 2);
      var rel = ((a - DIAL_START) % TAU + TAU) % TAU;
      var t = rel <= DIAL_SWEEP ? rel / DIAL_SWEEP : (rel - DIAL_SWEEP < DIAL_GAP / 2 ? 1 : 0);
      // Never across the gap in one move: time is turned round, not jumped.
      if (d.last !== null && Math.abs(t - d.last) > 0.5) { t = d.last > 0.5 ? 1 : 0; }
      d.last = t;
      return t;
    }
    function turnTo(t) {
      d.grab = t;
      range.value = String(Math.round(Math.max(0, Math.min(1, t)) * 1000));
      range.dispatchEvent(new Event("input", { bubbles: true }));
    }
    function lift(event) {
      var r = box.getBoundingClientRect();
      d.move = { sx: event.clientX, sy: event.clientY, cx: r.left + r.width / 2, cy: r.top + r.height / 2, moved: false };
      box.dataset.lifted = "true";
      delete box.dataset.turning;
      d.grab = null;
      d.drawn = "";
    }
    face.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
      event.preventDefault();
      var r = face.getBoundingClientRect();
      // The face carries it: the inner 30 %, or 22 % while the hub's band is in use there (dialhub.js).
      // Unrolled, the face is the band's left end (play or pause); in another part's place it is not carried.
      var inner = d.geo ? event.clientX - r.left < d.geo.x0 - 6 :
        Math.hypot(event.clientX - r.left - r.width / 2, event.clientY - r.top - r.height / 2) < r.width * dialInner(d);
      face.setPointerCapture(event.pointerId);
      d.down = { x: event.clientX, y: event.clientY, was: range.value, inner: inner, far: false };
      // The face carries the dial; the ring turns time, as it always has.
      if (inner && !box.dataset.slot) { lift(event); return; }
      if (inner) { return; }
      // A path being played (transport.js): the ring scrubs its stops, not the view's years.
      d.tp = !!(window.Dial && Dial.ring && Dial.ring(d, "down", ringEv(event)));
      if (!d.tp) {
        range.dispatchEvent(new Event("pointerdown"));
        d.last = null;
        box.dataset.turning = "true";
        turnTo(tAt(event));
      }
      if (event.pointerType !== "mouse") {
        // Held still, a finger lifts it from anywhere on it (a scrub it began let go).
        window.clearTimeout(d.hold);
        d.hold = window.setTimeout(function () {
          if (d.tp && d.down && !d.down.far) { d.tp = false; Dial.ring(d, "cancel", {}); d.last = null; lift({ clientX: d.down.x, clientY: d.down.y }); return; }
          if (!d.down || d.down.far || d.grab === null) { return; }
          turnTo(Number(d.down.was) / 1000);
          d.last = null;
          lift({ clientX: d.down.x, clientY: d.down.y });
          range.dispatchEvent(new Event("change", { bubbles: true }));
        }, DIAL_HOLD);
      }
    });
    face.addEventListener("pointermove", function (event) {
      if (!d.down && event.pointerType === "mouse") {
        var fr = face.getBoundingClientRect();
        var over = Math.hypot(event.clientX - fr.left - fr.width / 2, event.clientY - fr.top - fr.height / 2) < fr.width * dialInner(d);
        if (over) { face.dataset.over = "face"; } else { delete face.dataset.over; }
        if (d.range === artRange && window.DialHub && DialHub.hover) { var hx = hubXY(event); DialHub.hover(d, hx.x, hx.y, hx.w); }
      }
      if (d.down && Math.hypot(event.clientX - d.down.x, event.clientY - d.down.y) > 6) {
        d.down.far = true;
        window.clearTimeout(d.hold);
      }
      if (d.tp) { event.stopPropagation(); Dial.ring(d, "move", ringEv(event)); return; }
      if (d.move) {
        event.stopPropagation();
        if (!d.down || !d.down.far) { return; }
        d.move.moved = true;
        d.move.at = dialPut(d, d.move.cx + event.clientX - d.move.sx, d.move.cy + event.clientY - d.move.sy);
        return;
      }
      if (d.grab === null) { return; }
      event.stopPropagation();
      turnTo(tAt(event));
    });
    function let_(event) {
      window.clearTimeout(d.hold);
      var down = d.down;
      d.down = null;
      if (d.tp) { d.tp = false; event.stopPropagation(); Dial.ring(d, event.type === "pointerup" ? "up" : "cancel", ringEv(event)); return; }
      // In another part's place (or unrolled) the face is not carried: a tap on it plays or pauses.
      if (down && down.inner && box.dataset.slot && !d.move) {
        if (event.type === "pointerup" && window.Dial && Dial.live && Dial.live() && Dial.toggle) { Dial.toggle(); }
        return;
      }
      if (d.move) {
        event.stopPropagation();
        var m = d.move;
        d.move = null;
        delete box.dataset.lifted;
        d.drawn = "";
        if (m.moved && m.at) {
          // Let go near home, it is drawn home (and forgets where it was put).
          var r1 = box.getBoundingClientRect();
          dialHome(d);
          var hr = box.getBoundingClientRect();
          dialPut(d, r1.left + r1.width / 2, r1.top + r1.height / 2);
          if (Math.hypot(m.at.x - hr.left - hr.width / 2, m.at.y - hr.top - hr.height / 2) < DIAL_HOME_MAGNET) {
            dialGoHome(d);
            return;
          }
          // Eased into place; an edge within 24 px draws it the rest of the way.
          var lo = dialClamp(d, -1e5, -1e5), hi = dialClamp(d, 1e5, 1e5);
          var x = m.at.x, y = m.at.y;
          if (x - lo.x < DIAL_MAGNET) { x = lo.x; } else if (hi.x - x < DIAL_MAGNET) { x = hi.x; }
          if (y - lo.y < DIAL_MAGNET) { y = lo.y; } else if (hi.y - y < DIAL_MAGNET) { y = hi.y; }
          if (!still) { dialSettle(d); }
          dialPut(d, x, y);
          keepDialPlace({ x: x / window.innerWidth, y: y / window.innerHeight });
          d.placed = window.innerWidth + "x" + window.innerHeight + "|" + dialPlaceVer;
          dials.forEach(function (o) { if (o !== d) { o.placed = ""; } });
          // The work's globe no longer keeps room for it where it was.
          dialRelens();
        } else if (down && down.inner && event.type === "pointerup") {
          // Two taps on its face send it home.
          var now = performance.now();
          // While a path plays (transport.js) one tap on the face pauses or resumes it, once the
          // double tap's window has passed; two still send the dial home.
          var tp = window.Dial && Dial.faceTap;
          if (now - d.lastTap < 320) { d.lastTap = 0; if (tp) { Dial.faceTap(d, false); } dialGoHome(d); }
          else { d.lastTap = now; if (tp) { Dial.faceTap(d, true); } }
        }
        return;
      }
      if (d.grab === null) { return; }
      event.stopPropagation();
      d.grab = null;
      d.last = null;
      delete box.dataset.turning;
      range.dispatchEvent(new Event("change", { bubbles: true }));
      // A press on the hub's band that was not a turn opens the mark under it (dialhub.js).
      if (down && !down.far && event.type === "pointerup" && range === artRange && window.DialHub && DialHub.tap) {
        var tx = hubXY(event);
        DialHub.tap(d, tx.x, tx.y, tx.w);
      }
    }
    face.addEventListener("pointerup", let_);
    face.addEventListener("pointercancel", let_);
    // A wheel or two fingers on a trackpad over it turn it, like a crown.
    face.addEventListener("wheel", function (event) {
      event.preventDefault();
      event.stopPropagation();
      if (window.Dial && Dial.ring && Dial.ring(d, "wheel", ringEv(event))) { return; }
      range.dispatchEvent(new Event("pointerdown"));
      var t = Number(range.value) / 1000 + (event.deltaY + event.deltaX) * 0.0007;
      turnTo(t);
      d.grab = null;
    }, { passive: false });
    // Shift and the arrows nudge it; the arrows alone still turn time.
    range.addEventListener("keydown", function (event) {
      var dir = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!event.shiftKey || !dir) { return; }
      event.preventDefault();
      event.stopImmediatePropagation();
      var r = box.getBoundingClientRect();
      var c = dialPut(d, r.left + r.width / 2 + dir[0] * DIAL_MARGIN, r.top + r.height / 2 + dir[1] * DIAL_MARGIN);
      keepDialPlace({ x: c.x / window.innerWidth, y: c.y / window.innerHeight });
      d.placed = window.innerWidth + "x" + window.innerHeight + "|" + dialPlaceVer;
      dials.forEach(function (o) { if (o !== d) { o.placed = ""; } });
    }, true);
    dials.push(d);
    placeDial(d);
    return d;
  }

  /* The dial unrolled (DIAL.md, "The dial unrolled"): the ring's angle is the
     band's x (where now meets the beginning, its two ends), the distance from
     the ring the height over or under the line — the transport's stops above,
     the events and the hub's lanes under. bandCtx takes the ring's drawing
     (land.js's own, dialhub.js's band, transport.js's stops) and lays it
     there, so there is one drawing of the dial in two forms. */
  function bandGeo(w, h) {
    var y = Math.round(Math.max(64, Math.min(h * 0.38, h / 2)));
    return { w: w, h: h, x0: 44, x1: w - 92, y: y, ky: Math.max(2, Math.min(3, h / 90)), c: w / 2, R1: w / 2 - 13 };
  }
  function bandT(geo, a) {
    var rel = ((a - DIAL_START) % TAU + TAU) % TAU;
    return rel <= DIAL_SWEEP ? rel / DIAL_SWEEP : (rel - DIAL_SWEEP < DIAL_GAP / 2 ? 1 : 0);
  }
  function bandXY(geo, x, y) {
    var dx = x - geo.c, dy = y - geo.c;
    var t = bandT(geo, Math.atan2(dy, dx)), r = Math.sqrt(dx * dx + dy * dy);
    return { x: geo.x0 + t * (geo.x1 - geo.x0), y: geo.y + (geo.R1 - r) * geo.ky };
  }
  // The other way: a point of the band as the point of the ring it stands for (presses, the hub's hits).
  function bandToRing(geo, x, y) {
    var t = Math.max(0, Math.min(1, (x - geo.x0) / Math.max(1, geo.x1 - geo.x0)));
    var a = DIAL_START + t * DIAL_SWEEP, r = geo.R1 - (y - geo.y) / geo.ky;
    return { x: geo.c + Math.cos(a) * r, y: geo.c + Math.sin(a) * r };
  }
  function bandCtx(g, geo) {
    var local = 0, stack = [];
    var o = {
      save: function () { stack.push(local); g.save(); },
      restore: function () { local = stack.length ? stack.pop() : 0; g.restore(); },
      beginPath: function () { g.beginPath(); },
      closePath: function () { g.closePath(); },
      stroke: function () { g.stroke(); },
      fill: function () { g.fill(); },
      setLineDash: function (v) { g.setLineDash(v); },
      measureText: function (t) { return g.measureText(t); },
      rotate: function (a) { g.rotate(a); },
      setTransform: function () {},
      clearRect: function () {},
      translate: function (x, y) {
        if (local) { g.translate(x, y); return; }
        var p = bandXY(geo, x, y);
        g.translate(p.x, p.y);
        local = 1;
      },
      moveTo: function (x, y) { if (local) { g.moveTo(x, y); return; } var p = bandXY(geo, x, y); g.moveTo(p.x, p.y); },
      lineTo: function (x, y) { if (local) { g.lineTo(x, y); return; } var p = bandXY(geo, x, y); g.lineTo(p.x, p.y); },
      arc: function (x, y, r, a0, a1) {
        if (local) { g.arc(x, y, r, a0, a1); return; }
        if (Math.abs(x - geo.c) < 0.5 && Math.abs(y - geo.c) < 0.5) {
          var yy = geo.y + (geo.R1 - r) * geo.ky;
          var t0 = a1 - a0 >= TAU - 1e-3 ? 0 : bandT(geo, a0), t1 = a1 - a0 >= TAU - 1e-3 ? 1 : bandT(geo, a1);
          if (t1 < t0) { t1 = 1; }
          g.moveTo(geo.x0 + t0 * (geo.x1 - geo.x0), yy);
          g.lineTo(geo.x0 + t1 * (geo.x1 - geo.x0), yy);
          return;
        }
        var p = bandXY(geo, x, y);
        g.moveTo(p.x + r, p.y);
        g.arc(p.x, p.y, r, a0, a1);
      },
      fillRect: function (x, y, w, h) {
        if (local) { g.fillRect(x, y, w, h); return; }
        var p = bandXY(geo, x + w / 2, y + h / 2);
        g.fillRect(p.x - w / 2, p.y - h / 2, w, h);
      },
      strokeRect: function (x, y, w, h) {
        if (local) { g.strokeRect(x, y, w, h); return; }
        var p = bandXY(geo, x + w / 2, y + h / 2);
        g.strokeRect(p.x - w / 2, p.y - h / 2, w, h);
      },
      fillText: function (t, x, y) { if (local) { g.fillText(t, x, y); return; } var p = bandXY(geo, x, y); g.fillText(t, p.x, p.y); },
      // For a layer that writes more when unrolled (dialhub.js: a span's name): where a point of the ring lands.
      unrolled: true,
      map: function (x, y) { return bandXY(geo, x, y); }
    };
    ["strokeStyle", "fillStyle", "lineWidth", "globalAlpha", "shadowColor", "shadowBlur", "font", "textAlign",
     "textBaseline", "lineCap", "lineJoin"].forEach(function (k) {
      Object.defineProperty(o, k, { get: function () { return g[k]; }, set: function (v) { g[k] = v; } });
    });
    return o;
  }
  // Its decades, above the line.
  function bandScale(g, geo, span) {
    if (!(span[1] > span[0])) { return; }
    var n = span[1] - span[0], step = n > 400 ? 100 : n > 120 ? 50 : n > 40 ? 10 : n > 12 ? 5 : 1;
    g.save();
    g.font = "9px " + dialFont;
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    for (var y = Math.ceil(span[0] / step) * step; y <= span[1]; y += step) {
      var x = geo.x0 + (y - span[0]) / n * (geo.x1 - geo.x0), big = y % (step * 5) === 0 || step >= 50;
      g.strokeStyle = "rgba(168, 146, 122, " + (big ? 0.55 : 0.25) + ")";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 0.5, geo.y - 5);
      g.lineTo(x + 0.5, geo.y - (big ? 11 : 8));
      g.stroke();
      if (big) { g.fillStyle = "rgba(168, 146, 122, 0.7)"; g.fillText(String(y), x, geo.y - 14); }
    }
    g.restore();
  }
  // The year, its span and its tense over the band; play or pause at its left end.
  function bandWords(g, geo, year, span, tense, tp, S) {
    g.save();
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#eadfcd";
    g.font = "600 " + Math.round(Math.min(34, geo.h * 0.13)) + "px " + dialFont;
    var ty = Math.max(30, geo.y - 30);
    g.fillText(year, 12, ty);
    var xw = 18 + g.measureText(year).width;
    if (span[1] > span[0]) {
      g.fillStyle = "#a8927a";
      g.font = "10px " + dialFont;
      var sp = Math.floor(span[0]) + " — " + Math.floor(span[1]);
      g.fillText(sp, xw, ty);
      xw += g.measureText(sp).width + 10;
    }
    if (tense) {
      g.fillStyle = tense === "will be" ? LILAC : tense === "is" ? "#eadfcd" : "#a8927a";
      g.font = "italic 13px " + (getComputedStyle(document.documentElement).getPropertyValue("--serif") || "serif");
      g.fillText(tense, xw, ty);
    }
    g.restore();
    if (tp) {
      var S2 = 120, c2 = S2 / 2;
      g.save();
      g.translate(22 - c2, geo.y - (c2 + S2 * 0.15));
      tp.face(g, c2, S2);
      g.restore();
    }
    void S;
  }

  function drawDials() {
    for (var n = 0; n < dials.length; n += 1) { drawDial(dials[n]); }
  }

  function drawDial(d) {
    if (d.box.hidden || !d.box.offsetWidth) { return; }
    placeDial(d);
    var S = d.box.offsetWidth;
    // Unrolled in a long place: a band of years (artist, 7 Oct 2026: "Change the shape of the dial
    // to adapt to the rectangular form"). The same drawing, through bandCtx.
    var band = d.box.dataset.form === "band", BH = band ? d.box.offsetHeight : S;
    var t = d.grab !== null ? d.grab : Number(d.range.value) / 1000;
    var span = d.span() || [0, 0];
    var ticks = d.ticksOf ? d.ticksOf() : [];
    var year = d.box.querySelector(".building-time-year").textContent;
    var focused = document.activeElement === d.range;
    var lifted = !!d.box.dataset.lifted;
    // The hub (dialhub.js): the band of marks by kind for the mode the face is set to.
    var hub = d.range === artRange && window.DialHub && DialHub.layer ? DialHub.layer(d, t, span) : null;
    // The tense the path is told in, under the years (voice.js): was, is, will be.
    var tense = d.range === artRange && art && art.tense ? art.tense : "";
    // A path being played (transport.js): its stops outside the ring, its play or pause on the face.
    var tp = window.Dial && Dial.layer ? Dial.layer(d) : null;
    var key = [S, dpr, t.toFixed(4), span[0], span[1], ticks.length, year, focused, !!d.box.dataset.turning, lifted,
               hub ? hub.key : "", tense, tp ? tp.key : "", band, BH].join("|");
    if (key === d.drawn) { return; }
    d.drawn = key;
    var px = Math.round(S * dpr), pxh = Math.round(BH * dpr);
    if (d.face.width !== px || d.face.height !== pxh) { d.face.width = px; d.face.height = pxh; }
    var g = d.g, real = d.g;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, BH);
    var c = S / 2, R1 = S / 2 - 13;
    var at = DIAL_START + t * DIAL_SWEEP;
    g.lineCap = "butt";
    var geo = null;
    if (band) {
      geo = bandGeo(S, BH);
      d.geo = geo;
      g = bandCtx(real, geo);
    } else { d.geo = null; }

    // The chronograph's scale, outside the ring, still (a path's stops there while one plays).
    if (tp) { tp.outer(g, c, R1, S); }
    for (var k = 0; k < (tp ? 0 : band ? 0 : 120); k += 1) {
      var ak = -Math.PI / 2 + k / 120 * TAU;
      var long = k % 10 === 0;
      g.strokeStyle = "rgba(168, 146, 122, " + (long ? 0.55 : 0.22) + ")";
      g.lineWidth = long ? 1 : 0.75;
      g.beginPath();
      g.moveTo(c + Math.cos(ak) * (R1 + 5), c + Math.sin(ak) * (R1 + 5));
      g.lineTo(c + Math.cos(ak) * (R1 + (long ? 11 : 8)), c + Math.sin(ak) * (R1 + (long ? 11 : 8)));
      g.stroke();
    }

    // Unrolled: a scale of decades above the line instead of the chronograph's.
    if (band && !tp) { bandScale(real, geo, span); }
    // Two rings geared to time, turning against each other at phi (resting while the hub's band is in use).
    g.save();
    if (band) { g.globalAlpha = 0; }
    if (hub && hub.quiet) { g.globalAlpha = 0.25; }
    g.setLineDash([2, 5]);
    g.strokeStyle = "rgba(234, 223, 205, 0.22)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c, c, R1 - 15, t * TAU * PHI, t * TAU * PHI + TAU);
    g.stroke();
    g.setLineDash([1, 9]);
    g.strokeStyle = "rgba(157, 149, 230, 0.35)";
    g.beginPath();
    g.arc(c, c, R1 - 21, -t * TAU, -t * TAU + TAU);
    g.stroke();
    g.setLineDash([]);
    g.restore();

    // The whole of the time, and where now meets the beginning.
    g.strokeStyle = "rgba(168, 146, 122, 0.4)";
    g.lineWidth = 1;
    g.beginPath();
    g.arc(c, c, R1, DIAL_START, DIAL_START + DIAL_SWEEP);
    g.stroke();
    g.fillStyle = LILAC;
    // Where now meets the beginning: unrolled, the two ends.
    if (band) { real.fillStyle = LILAC; real.fillRect(geo.x0 - 1.5, geo.y - 1.5, 3, 3); real.fillRect(geo.x1 - 1.5, geo.y - 1.5, 3, 3); }
    else { g.fillRect(c - 1.5, c - R1 - 1.5, 3, 3); }

    // Every event, inside the ring: lit once it has been passed.
    ticks.forEach(function (tk) {
      var a = DIAL_START + tk.pos * DIAL_SWEEP;
      var lit = tk.pos <= t + 1e-6;
      var len = tk.written ? 9 : 6;
      g.strokeStyle = tk.after ? (lit ? "rgba(157, 149, 230, 0.6)" : "rgba(157, 149, 230, 0.22)") :
        lit ? (tk.written ? "#ffffff" : "rgba(234, 223, 205, 0.9)") : "rgba(168, 146, 122, 0.45)";
      g.lineWidth = tk.written ? 1.25 : 1;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * (R1 - 3), c + Math.sin(a) * (R1 - 3));
      g.lineTo(c + Math.cos(a) * (R1 - 3 - len), c + Math.sin(a) * (R1 - 3 - len));
      g.stroke();
    });
    if (hub) { hub.draw(g, c, R1, t, S); }

    // The way come, a line of light, and a comet's tail behind the handle (a step dimmer, paused).
    g.globalAlpha = tp && tp.dim ? 0.5 : 1;
    if (t > 0) {
      g.save();
      g.shadowColor = LIGHT;
      g.shadowBlur = 8;
      g.strokeStyle = "#eadfcd";
      g.lineWidth = 1.75;
      g.beginPath();
      g.arc(c, c, R1, DIAL_START, at);
      g.stroke();
      g.restore();
      var tail = Math.min(at - DIAL_START, 0.9);
      // A path playing (transport.js): light runs down the tail in held frames; paused, it stills.
      var flow = tp && tp.flow >= 0 ? tp.flow : -1;
      for (var q = 0; q < 12; q += 1) {
        var a0 = at - tail * (q + 1) / 12, a1 = at - tail * q / 12;
        var run = flow < 0 ? 1 : 0.6 + 0.9 * Math.pow(Math.max(0, Math.cos(TAU * (q / 12 - flow))), 4);
        g.strokeStyle = "rgba(157, 149, 230, " + Math.min(1, 0.55 * (1 - q / 12) * run).toFixed(3) + ")";
        g.lineWidth = 4;
        g.beginPath();
        g.arc(c, c, R1, a0, a1);
        g.stroke();
      }
    }

    // The handle: the museums' diamond, and pixel light round it while turned.
    var hx = c + Math.cos(at) * R1, hy = c + Math.sin(at) * R1;
    if (d.box.dataset.turning || focused) {
      g.fillStyle = LIGHT;
      [[0, -8], [8, 0], [0, 8], [-8, 0]].forEach(function (o) { g.fillRect(hx + o[0] - 1.5, hy + o[1] - 1.5, 3, 3); });
    }
    g.save();
    g.translate(hx, hy);
    g.rotate(Math.PI / 4);
    g.fillStyle = "#0f0a07";
    g.fillRect(-6, -6, 12, 12);
    g.fillStyle = "#eadfcd";
    g.fillRect(-4.5, -4.5, 9, 9);
    g.restore();
    g.globalAlpha = 1;

    if (band) { bandWords(real, geo, year, span, tense, tp, S); return; }
    // Lifted to be carried: four tiles of pixel light round it.
    if (lifted) {
      g.fillStyle = LIGHT;
      [[0, -1], [1, 0], [0, 1], [-1, 0]].forEach(function (o) {
        g.fillRect(c + o[0] * (R1 + 9) - 2, c + o[1] * (R1 + 9) - 2, 4, 4);
      });
    }

    // The year in the middle, over its span.
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#eadfcd";
    g.font = "600 " + Math.round(S * 0.17) + "px " + dialFont;
    g.fillText(year, c, c + S * 0.05);
    if (tp) { tp.face(g, c, S); }
    else if (span[1] > span[0]) {
      g.fillStyle = "#a8927a";
      g.font = Math.max(8, Math.round(S * 0.058)) + "px " + dialFont;
      g.fillText(Math.floor(span[0]) + " — " + Math.floor(span[1]), c, c + S * 0.05 + S * 0.12);
    }
    if (tense) {
      g.fillStyle = tense === "will be" ? LILAC : tense === "is" ? "#eadfcd" : "#a8927a";
      g.font = "italic " + Math.max(9, Math.round(S * 0.07)) + "px " + (getComputedStyle(document.documentElement).getPropertyValue("--serif") || "serif");
      g.fillText(tense, c, c + S * 0.05 + S * (tp ? 0.27 : 0.215));
    }
  }

  var tickCache = { n: -1, list: [] };
  function artTickList() {
    if (!artTicks) { return []; }
    var kids = artTicks.children;
    if (kids.length !== tickCache.n || (kids[0] && kids[0] !== tickCache.first)) {
      tickCache.n = kids.length;
      tickCache.first = kids[0];
      tickCache.list = Array.prototype.map.call(kids, function (e) {
        return { pos: parseFloat(e.style.left) / 100, written: e.dataset.kind === "written", after: e.dataset.kind === "after" };
      });
    }
    return tickCache.list;
  }
  makeDial(timeline, timeRange, function () {
    var v = clod && clod.views[clod.view];
    return v && v.years ? [v.years.y0, v.years.y1] : null;
  }, null);
  makeDial(artTime, artRange, function () {
    return art && art.dated ? [art.y0, art.y1] : null;
  }, artTickList);

  /* On a phone, after the play, scrolling the column moves time too: the
     group nearest the column's top sets the slider, and its stop is ringed. */
  var artTouched = 0;                   // when the column was last moved by hand
  function watchStops(a) {
    if (!window.IntersectionObserver) { return; }
    a.watch = new IntersectionObserver(function (entries) {
      // Only a hand on the column (not the column scrolled to a stop pressed on the globe).
      if (art !== a || !a.flipped || performance.now() - artTouched > 1200 ||
          performance.now() - (a.scrolledAt || 0) < 900) { return; }
      entries.forEach(function (e) {
        if (!e.isIntersecting) { return; }
        var k = Number(e.target.dataset.stop);
        if (e.target.dataset.stop === undefined || !a.stops[k] || k === a.ring) { return; }
        showStop(k);
      });
    }, { root: artCol, rootMargin: "0px 0px -72% 0px" });
    a.heads.forEach(function (h) { a.watch.observe(h); });
  }

  /* ---- the look ------------------------------------------------------------

     First the photograph alone, large, in the band, the world washed behind
     it; the caption at 4 s; at 9 s — or at once, on any press, scroll or
     slide: pressing never waits — it goes into the column head, the wash
     lifts and the journey plays. */

  function lookAt(a) {
    var h = a.data;
    artEl.dataset.look = still ? "done" : "plate";
    reveal(a.headCap, still ? 0 : OPEN_AT[0], a);
    if (!h.image) {
      a.flipped = true;
      artEl.dataset.look = "done";
      playArt();
      return;
    }
    var go = el("span", "deal-go");
    var img = el("img");
    img.alt = [h.title || "Untitled", (h.artists || []).join(", ")].filter(Boolean).join(", by ");
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    var tries = ["medium", "square"].map(function (v) { return ART_CDN + h.image + "/" + v + ".jpg"; });
    img.addEventListener("error", function () {
      if (tries.length) { img.src = tries.shift(); return; }
      artPlate.hidden = true;
    });
    img.addEventListener("load", function () {
      if (art !== a || artPlate.dataset.shown === img.src) { return; }
      artPlate.dataset.shown = img.src;
      layoutPlate(img.naturalWidth / Math.max(1, img.naturalHeight), a.flipped ? "rest" : "look");
      var first = artPlate.hidden;
      artPlate.hidden = false;
      if (first && !still) { bringIn(artPlate, 0); }
    });
    img.src = ART_CDN + h.image + "/large.jpg";
    go.appendChild(img);
    artPlate.appendChild(go);
    artPlate.dataset.aspect = "1";
    artPlate.dataset.mode = "look";
    artPlate.tabIndex = 0;
    artPlate.setAttribute("role", "button");
    artPlate.setAttribute("aria-label", "Look at " + (h.title || "the work") + " on the whole screen");
    if (still) {
      a.flipped = true;
      artPlate.dataset.mode = "rest";
      playArt();
      return;
    }
    // The label is revealed at 4 s (reveal above), not dealt in: its lines are not one text.
    later(flipToHead, OPEN_AT[1], a);
  }

  /* The photograph as large as its place allows, never cropped: alone at
     first (`look`), then at rest beside the globe (`rest`). */
  function layoutPlate(aspect, mode) {
    if (aspect) { artPlate.dataset.aspect = String(aspect); }
    aspect = Number(artPlate.dataset.aspect) || 1;
    mode = mode || artPlate.dataset.mode || "look";
    artPlate.dataset.mode = mode;
    var bands = workBands(), b = mode === "rest" ? bands.plate : bands.look;
    // The wall label is always under the picture (artist, 7 Oct 2026: "the info for the artwork should
    // always be below the thumbnail of the artwork"): the band is given to the picture and its label
    // together, the picture shrunk (its aspect kept), never the label run on into the globe's band.
    // Where the picture swipes, its ‹ › stand just outside it (artist, 7 Oct 2026: "The arrows on either
    // side of the artwork should be outside the boundary of the thumbnail"): the room is narrowed by an
    // arrow's width each side, so they never lie over it.
    var A = mode === "rest" && artEl.dataset.swipes && !lensSwapped && partsNow().picture === "big" ? SWIPE_ROOM : 0;
    var lab = artLabel && !artLabel.hidden && !lensSwapped ? labelRoom({ x: b.x + A, y: b.y, w: b.w - 2 * A, h: b.h }, aspect) : null;
    var room = { x: b.x + A, y: b.y, w: b.w - 2 * A, h: b.h - (lab ? lab.h + 6 : 0) };
    var w = Math.max(40, Math.min(room.w, room.h * aspect)), hh = w / aspect;
    var x = room.x + (room.w - w) / 2, y = room.y + (room.h - hh) / 2;
    // At rest it keeps to its edge: against the left on a desktop, the globe
    // beside it; under the banner on a phone, the globe below it. Swapped
    // into the lens's place, it stands in the middle of it.
    if (mode === "rest" && !lensSwapped) { if (W > 720) { x = room.x; } else { y = room.y; } }
    // A picture narrower than its band stands in the middle of it: its label starts at its own left
    // edge, as a wall label does, not at the band's, and is measured again at that width (narrower,
    // so taller) — the picture giving up the height it takes, a few times until they agree.
    var lx = room.x, lw = room.w;
    for (var pass = 0; lab && pass < 3 && x > room.x + 1; pass++) {
      lx = x; lw = room.x + room.w - x;
      var lh = Math.min(b.h * 0.45, labelHeight(lw));
      if (lh <= lab.h + 0.5) { break; }
      lab.h = lh;
      room.h = b.h - lh - 6;
      w = Math.max(40, Math.min(room.w, room.h * aspect)); hh = w / aspect;
      x = room.x + (room.w - w) / 2;
      y = mode === "rest" && !lensSwapped ? room.y : room.y + (room.h - hh) / 2;
      lx = x; lw = room.x + room.w - x;
    }
    artPlate.style.width = w.toFixed(1) + "px";
    artPlate.style.height = hh.toFixed(1) + "px";
    artPlate.style.left = x.toFixed(1) + "px";
    artPlate.style.top = y.toFixed(1) + "px";
    plateRest = { left: x, top: y, width: w, height: hh };
    var zb = window.Zoom && Zoom.big();
    if (zb && zb.node === artPlate) { zb.relayout(); }
    if (lab) {
      var ls = artLabel.style;
      ls.left = lx.toFixed(1) + "px";
      ls.top = (y + hh + 6).toFixed(1) + "px";
      ls.width = lw.toFixed(1) + "px";
      delete artLabel.dataset.side;
    }
  }
  var SWIPE_ROOM = 34;          // an arrow's width (28) and its gap (6), each side of a picture that swipes
  // The label's room under a picture in band b: its height at the band's width, at most 45 % of it.
  function labelRoom(b, aspect) {
    return { side: false, w: b.w, h: Math.min(b.h * 0.45, labelHeight(b.w)) };
  }
  // Its height at a width, measured before the picture is sized round it.
  function labelHeight(w) {
    var was = artLabel.style.width;
    artLabel.style.width = Math.round(w) + "px";
    var h = artLabel.offsetHeight;
    artLabel.style.width = was;
    return h || 60;
  }
  function clearLabel() {
    // The picture gone (another view, or none): not twice as big, nor on the whole screen.
    var zb = window.Zoom && Zoom.big();
    if (zb && zb.node === artPlate) { zb.undo(true); }
    if (window.Zoom && artEl.dataset.full) { Zoom.close(true); delete artEl.dataset.full; }
    if (!artLabel) { return; }
    artLabel.hidden = true;
    artLabel.textContent = "";
    delete artLabel.dataset.on;
    delete artLabel.dataset.side;
    artLabel._for = null;
  }
  /* The label of the picture in the plate: a saved work's from its history (Artsy's facts and where
     it is now), a painting not saved from what Painted here gives. Shown at once unless `later`
     (a work's first look reveals it at 4 s, as its caption was). */
  function labelPicture(spec, h, wait) {
    if (!artLabel) { return; }
    if (!window.WallLabel || (!spec && !h)) { clearLabel(); return; }
    var key = h ? h.id : spec.id || spec.src || spec.image || "";
    artLabel._for = key;
    var a = art;
    function put(f) {
      if (art !== a || artLabel._for !== key) { return; }
      if (!f) { clearLabel(); return; }
      WallLabel.fill(artLabel, f);
      if (!wait) { artLabel.dataset.on = "true"; }
      if (!artPlate.hidden) { layoutPlate(null, null); return; }
      // No photograph (yet, or at all): the label stands where it would begin.
      var b = workBands().plate;
      artLabel.style.left = b.x + "px";
      artLabel.style.top = b.y + "px";
      artLabel.style.width = b.w + "px";
    }
    if (h) {
      put({ id: h.id, t: h.title || "Untitled", a: (h.artists || []).join(", "), d: h.date || "", m: h.medium || "",
            s: h.dimensions || "", now: "", src: "Artsy" });
      WallLabel.facts(h.id).then(function (f) { if (f) { put(f); } });
    } else if (spec.id) {
      WallLabel.facts(spec.id).then(function (f) { put(f || WallLabel.fromItem({ title: spec.title, by: spec.by, year: spec.year, src: "Artsy" })); });
    } else {
      put(WallLabel.fromItem({ title: spec.title, by: spec.by, year: spec.year, where: spec.where }));
    }
  }

  /* The end of the look: the photograph steps aside to its place and stays
     there, as large as the view allows (a FLIP at beat-6), the wash lifts,
     the column's body comes in and the journey plays. (It used to go into
     the column as a thumbnail; the artist, 1 Oct 2026: "I want to find a
     better balance between the image of the artwork and the places it has
     traveled".) */
  function flipToHead() {
    var a = art;
    if (!a || a.flipped || a.kind !== "work") { return; }
    a.flipped = true;
    a.settledAt = performance.now();
    reveal(a.headCap, 0, a);
    artEl.dataset.look = "flip";
    if (a.count && !still) { enterText(a.count, 0); }
    playArt();
    function done() { if (art === a) { artEl.dataset.look = "done"; } }
    if (artPlate.hidden || still) { layoutPlate(null, "rest"); done(); return; }
    var from = artPlate.getBoundingClientRect();
    layoutPlate(null, "rest");
    var to = artPlate.getBoundingClientRect();
    if (!to.width || !from.width) { done(); return; }
    artPlate.dataset.flip = "true";
    artPlate.style.transition = "none";
    artPlate.style.transform = "translate(" + (from.left - to.left).toFixed(1) + "px," + (from.top - to.top).toFixed(1) +
      "px) scale(" + (from.width / to.width).toFixed(4) + ")";
    void artPlate.offsetWidth;
    artPlate.style.transition = "";
    artPlate.style.transform = "";
    later(function () { delete artPlate.dataset.flip; done(); }, 1100, a);
  }

  /* Pressed once, the photograph is twice as big where it stands; pressed
     again, the whole screen, where it can be brought as near as one likes
     (zoom.js; artist, 7 Oct 2026: "When I click on an artwork once to make
     it bigger, make it twice as big, don't make it take up the entire screen
     … If I click on the artwork again after clicking on it once, then make it
     full screen. When it full screen mode I should be able to zoom in to any
     artwork as much as I please"). Escape, the close mark or a press on the
     dark steps back: the whole screen to twice, twice to as it was. Never on
     the press that ended the look. */
  var plateRest = null;
  function pressPlate() {
    if (!window.Zoom) { setFull(!artEl.dataset.full); return; }
    var z = Zoom.big();
    if (z && z.node === artPlate) { setFull(true); return; }
    Zoom.twice({
      node: artPlate,
      base: function () { return plateRest; },
      label: function () {
        if (!artLabel || artLabel.hidden || !artLabel.childNodes.length) { return null; }
        var c = artLabel.cloneNode(true);
        c.className = "wall-label";
        c.removeAttribute("style");
        c.removeAttribute("aria-live");
        return c;
      },
      restore: function () { if (art && !artPlate.hidden) { layoutPlate(null, null); } }
    });
  }
  function setFull(on) {
    var a = art;
    if (!on || !a || !readKind(a.kind)) {
      // From outside (a path's next stop): everything back to its place.
      delete artEl.dataset.full;
      if (window.Zoom) { Zoom.close(true); var zb = Zoom.big(); if (zb && zb.node === artPlate) { zb.undo(true); } }
      return;
    }
    var image = a.kind === "work" ? a.data.image : a.picture && a.picture.image;
    var bigSrc = a.kind !== "work" && a.picture && a.picture.src ? a.picture.big || a.picture.src : null;
    if (!image && !bigSrc) { return; }
    artEl.dataset.full = "true";
    var img = artPlate.querySelector(".deal-go:last-child img") || artPlate.querySelector("img");
    if (window.Zoom) {
      // The largest pictures Artsy gives (`normalized` is the largest), else Commons' widest.
      Zoom.open({
        src: img ? img.currentSrc || img.src : bigSrc || ART_CDN + image + "/large.jpg",
        big: image ? [ART_CDN + image + "/normalized.jpg", ART_CDN + image + "/larger.jpg"] : [bigSrc],
        alt: img ? img.alt : "",
        label: function () {
          if (!artLabel || !artLabel.childNodes.length) { return null; }
          var c = artLabel.cloneNode(true);
          c.className = "wall-label";
          c.removeAttribute("style");
          c.removeAttribute("aria-live");
          return c;
        },
        // Back from the whole screen: twice as big, as it was before it.
        onClose: function () { delete artEl.dataset.full; }
      });
      return;
    }
    if (img && !img.dataset.big) {
      img.dataset.big = "asked";
      var big = new Image();
      big.referrerPolicy = "no-referrer";
      big.addEventListener("load", function () { if (art === a && img.isConnected) { img.src = big.src; } });
      big.src = bigSrc || ART_CDN + image + "/larger.jpg";
    }
  }

  if (artPlate) {
    artPlate.addEventListener("click", function (event) {
      event.stopPropagation();
      var a = art;
      if (!a || !readKind(a.kind)) { return; }
      // In another part's place: back to the big one, swapped with what is there.
      if (partsNow().picture !== "big") { swapWithBig("picture"); return; }
      if (a.kind === "work" && (!a.flipped || performance.now() - (a.settledAt || 0) < 450)) { return; }
      pressPlate();
    });
    artPlate.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") { return; }
      event.preventDefault();
      if (partsNow().picture !== "big") { swapWithBig("picture"); return; }
      flipToHead();
      pressPlate();
    });
    window.addEventListener("keydown", function (event) {
      // Search opened on the grown globe is put down first, the globe left as it is.
      if (event.key === "Escape" && finder.open && art) {
        event.preventDefault();
        event.stopImmediatePropagation();
        closeFinder();
      } else if (event.key === "Escape" && art && partsAway() && !lensAway() && !artEl.dataset.full) {
        event.preventDefault();
        event.stopImmediatePropagation();
        partsHome();
      } else if (event.key === "Escape" && art && lensAway()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        lensHome();
      } else if (event.key === "Escape" && artEl.dataset.full) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setFull(false);
      } else if (event.key === "Escape" && lensSwapped && art) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setSwap(false);
      }
    }, true);
  }

  /* The picture of the moment, in a view that is not one work's (a life, a
     movement, a thread): the work being read, chosen by voice.js
     (Land.picture) — the work made then, the work said. The last gives way
     to the next as it comes. Pressed, it fills the screen, as a work's does. */
  function showPicture(spec) {
    var a = art;
    if (!a || a.kind === "work" || !readingOn()) { return; }
    // The same picture: a saved work by its id, a painting not saved (Commons) by its file.
    var key = function (p) { return p ? p.id || p.src || p.image || null : null; };
    if (key(a.picture) === key(spec)) { return; }
    a.picture = spec && (spec.image || spec.src) ? spec : null;
    if (a.picture && a.noPicture) { Land.noPicture(false); }
    if (!a.picture) {
      artPlate.textContent = "";
      artPlate.hidden = true;
      clearLabel();
      return;
    }
    // Its wall label, which changes with it (a swipe through the period, the work said).
    labelPicture(spec, null);
    var go = el("span", "deal-go");
    var img = el("img");
    img.alt = [spec.title || "Untitled", spec.by || ""].filter(Boolean).join(", by ");
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    // A saved work from Artsy's pictures; a painting that is not saved (Painted here) from Commons, live.
    var tries = spec.src ? [] : ["medium", "square"].map(function (v) { return ART_CDN + spec.image + "/" + v + ".jpg"; });
    img.addEventListener("error", function () {
      if (tries.length) { img.src = tries.shift(); return; }
      if (art === a && a.picture === spec) { go.remove(); if (!artPlate.querySelector(".deal-go")) { artPlate.hidden = true; } }
    });
    img.addEventListener("load", function () {
      if (art !== a || a.picture !== spec) { go.remove(); return; }
      artPlate.querySelectorAll(".deal-go").forEach(function (o) { if (o !== go) { o.remove(); } });
      go.dataset.on = "true";
      layoutPlate(img.naturalWidth / Math.max(1, img.naturalHeight), "rest");
      var first = artPlate.hidden;
      artPlate.hidden = false;
      if (first && !still) { bringIn(artPlate, 0); }
    });
    img.src = spec.src || ART_CDN + spec.image + "/large.jpg";
    go.appendChild(img);
    artPlate.appendChild(go);
    artPlate.dataset.mode = "rest";
    artPlate.tabIndex = 0;
    artPlate.setAttribute("role", "button");
    artPlate.setAttribute("aria-label", "Look at " + (spec.title || "the work") + " on the whole screen");
  }

  function playArt() {
    var a = art;
    if (!a || a.kind !== "work" || !a.live) { return; }
    // Played the first time this viewer comes to it; at rest at now after.
    var first = !still && !dialDriven() && firstSeen("w:" + (a.data && a.data.id));
    if (!first) {
      a.when = a.whenTo = 1;
      passEvents(a, performance.now(), false);
      showArtYear();
      a.dirty = true;
      if (!still) { threadProcession(); }
      return;
    }
    a.firstPlay = true;
    a.when = a.whenTo = 0;
    a.evs.forEach(function (e) { e.lit = false; });
    a.playing = true;
    a.seg = null;
    a.holdUntil = performance.now() + 240;
    passEvents(a, performance.now(), true);
    showArtYear();
    a.dirty = true;
    // The threads, on the reading's slow clock (the next pass).
    threadProcession();
  }

  if (artEl) {
    // Pressing, scrolling or sliding never waits for the look.
    artEl.addEventListener("pointerdown", function () { flipToHead(); }, true);
    artCol.addEventListener("wheel", function () { artTouched = performance.now(); flipToHead(); }, { passive: true });
    artCol.addEventListener("touchmove", function () { artTouched = performance.now(); flipToHead(); }, { passive: true });
    window.addEventListener("resize", function () {
      if (!art || !readKind(art.kind)) { return; }
      layoutWork();
      if (!artPlate.hidden) { layoutPlate(null, art.kind !== "work" || art.flipped ? "rest" : "look"); }
      // The lens where it now is, at the distance it was.
      if (art.lensSpec && place && !flying) {
        var sp = {};
        Object.keys(art.lensSpec).forEach(function (k) { sp[k] = art.lensSpec[k]; });
        sp.now = true;
        lensTo(sp);
      }
    });
  }

  /* ---- the column ----------------------------------------------------------

     A work's history, briefly: the work; a count line; how you came; the
     thread being said; the stops, each a head (a door to its place) and a
     dated line an event with a fixed verb and the record's own words; the
     writings, as citations; all its threads; where it is all from. Every
     line is on the page from the start, dim, and steps to ink as the slider
     passes its year. Text is set as text, never as markup from the data. */

  // "_Alberto Giacometti_" as italics, the rest as it stands.
  function italics(text, into) {
    into = into || document.createDocumentFragment();
    String(text || "").split(/_([^_]+)_/).forEach(function (part, i) {
      if (!part) { return; }
      if (i % 2) { into.appendChild(el("i", "", part)); }
      else { into.appendChild(document.createTextNode(part)); }
    });
    return into;
  }

  function yearsOf(evs, h) {
    var lo = Infinity, hi = -Infinity;
    evs.forEach(function (n) {
      var y = yearNum(h.events[n].y);
      if (y !== null) { lo = Math.min(lo, Math.floor(y)); hi = Math.max(hi, Math.floor(y)); }
    });
    if (lo === Infinity) { return ""; }
    return lo === hi ? String(lo) : lo + "–" + hi;
  }

  function whenOf(ev) {
    var y = /^\d{4}/.exec(ev.y || "");
    if (!y) { return "·"; }
    return (ev.c ? "c. " : "") + y[0];
  }

  function countLine(h, stops) {
    var all = h.events.map(function (e, n) { return n; });
    var owners = {};
    var k = { exhibited: 0, sale: 0, written: 0 };
    h.events.forEach(function (ev) {
      if (ev.k === "exhibited") { k.exhibited += 1; }
      if (ev.k === "sold" || ev.k === "offered") { k.sale += 1; }
      if (ev.k === "written") { k.written += 1; }
      if (ev.k === "owned" && ev.who) { owners[ev.who] = true; }
    });
    var places = {};
    stops.forEach(function (s) { places[s.p] = true; });
    function n(c, one, many) { return c ? c + " " + (c === 1 ? one : many) : ""; }
    var parts = [yearsOf(all, h), n(Object.keys(places).length, "place", "places"),
                 n(k.exhibited, "show", "shows"), n(k.sale, "sale", "sales"),
                 n(Object.keys(owners).length, "owner", "owners"),
                 n(k.written, "writing", "writings")];
    if (!stops.length) { parts.push("not yet placed on the Earth"); }
    return parts.filter(Boolean).join(" · ");
  }

  var FAIR = /\b(fair|frieze|art basel|armory show|fiac|expo chicago|tefaf|arco|masterpiece)\b/i;

  // An owner as the record names them; one only relative to the record
  // ("the present owner") stays in its quotation marks.
  function ownerName(who) {
    return /^(the|a|an|his|her|their|by)\s/.test(who || "") ? "“" + who + "”" : who;
  }

  // A place as a line can say it: a town as it stands ("Paris, FR"), a
  // country by its name rather than its code; "" when neither.
  var regionNames = null;
  function placeSaid(w) {
    if (!w || w.indexOf(",") >= 0) { return w || ""; }
    if (!/^[A-Z]{2}$/.test(w)) { return w; }
    try {
      regionNames = regionNames || new Intl.DisplayNames(["en"], { type: "region" });
      var name = regionNames.of(w);
      return name && name !== w ? name : "";
    } catch (e) { return ""; }
  }

  /* One event as a line: its year, and a fixed verb with the record's own
     fields — where a field is missing, the record's own words after the
     verb, never a phrase made up to stand in for it. Nothing about price,
     ever. */
  function lineOf(ev) {
    var out = document.createDocumentFragment();
    function t(s) { out.appendChild(document.createTextNode(s)); }
    function i(s) { out.appendChild(el("i", "", s)); }
    // A long note (a footnote, a whole paragraph of provenance) is opened
    // under the line, never written into it.
    var note = ev.n && ev.n.length <= 90 ? " (" + ev.n + ")" : "";
    var said_ = ev.n && ev.n.length <= 140 ? ev.n : ev.q && ev.q.length <= 140 ? ev.q : "";
    var own = said_ ? " — " + said_ : "";
    switch (ev.k) {
      case "made":
        var at = placeSaid(ev.w);
        t("Made" + (at ? " in " + at : ""));
        break;
      case "owned":
        t(ev.who ? "Owned by " + ownerName(ev.who) + note : "Owned" + own);
        break;
      case "held":
        var holder = String(ev.who || ev.v || "").replace(/^collection\s+/i, "");
        t(holder ? "In the collection of " + holder : "In the collection" + own);
        break;
      case "listed":
        t("Listed on Artsy" + (ev.who ? " by " + ev.who : ""));
        break;
      case "exhibited":
        if (ev.t && !FAIR.test(ev.v || "")) {
          t("Shown in "); i(ev.t);
          if (ev.v) { t(", " + ev.v); }
          if (ev.pg) { t(", " + ev.pg); }
        } else if (ev.v || ev.t) {
          t("Shown at " + (ev.v || ev.t));
        } else {
          t("Shown" + (own || (placeSaid(ev.w) ? " in " + placeSaid(ev.w) : "")));
        }
        break;
      case "offered":
        if (ev.t) { t("Offered in "); i(ev.t); }
        else { t("Offered" + (ev.who || ev.v ? " by " + (ev.who || ev.v) : own)); }
        break;
      case "sold":
        // Who a sale was to, the record does not say apart from where it
        // was: the name is given as it stands, the direction not guessed.
        t(ev.v ? "Sold at " + ev.v : "Sold" + (ev.who ? " — " + ev.who : ""));
        if (ev.n) { t(", " + ev.n); }
        break;
      default:
        t(ev.n || ev.q || "");
    }
    return out;
  }

  var HOW = { venue: "placed at the venue", city: "at the city", office: "where the gallery is" };

  /* A writing as a citation: the source's own string when it gives one,
     else put together from its parts, the note never dropped. */
  function citeOf(ev) {
    var box = el("p", "art-cite");
    if (ev.q && ev.q !== ev.y) {
      italics(ev.q, box);
    } else {
      var bits = [];
      if (ev.who) { bits.push(document.createTextNode(ev.who)); }
      if (ev.t && ev.pub && ev.pub !== ev.t) {
        bits.push(document.createTextNode("“" + ev.t + "”"));
        bits.push(el("i", "", ev.pub));
      } else if (ev.t || ev.pub) {
        bits.push(el("i", "", ev.t || ev.pub));
      }
      if (ev.w) { bits.push(document.createTextNode(ev.w.split(",")[0])); }
      if (ev.y) { bits.push(document.createTextNode(String(ev.y).slice(0, 4))); }
      if (ev.pg) { bits.push(document.createTextNode(ev.pg)); }
      bits.forEach(function (b, n) {
        if (n) { box.appendChild(document.createTextNode(", ")); }
        box.appendChild(b);
      });
      box.appendChild(document.createTextNode((ev.n ? " (" + ev.n + ")" : "") + "."));
    }
    if (ev.u && /^https?:\/\//.test(ev.u)) {
      var host = ev.u;
      try { host = new URL(ev.u).hostname.replace(/^www\./, ""); } catch (e) {}
      var go = el("a", "art-go", "Read it at " + host + " ↗");
      go.href = ev.u;
      go.target = "_blank";
      go.rel = "noopener";
      box.appendChild(document.createTextNode(" "));
      box.appendChild(go);
    }
    return box;
  }

  /* What a thread is, as a sentence, its name in italics. */
  function threadSentence(t) {
    var f = document.createDocumentFragment();
    function s(x) { f.appendChild(document.createTextNode(x)); }
    function i(x) { f.appendChild(el("i", "", x)); }
    var n = t.n || 0, others = n === 1 ? "1 other" : n + " others";
    var town = String(t.at || "").split(", ").pop();
    switch (t.k) {
      case "show": s("Shown with " + others + " in "); i(t.name); s([town, t.y].filter(Boolean).length ? ", " + [town, t.y].filter(Boolean).join(", ") : ""); break;
      case "sale": s("Offered with " + others + " in "); i(t.name); s(t.y ? ", " + t.y : ""); break;
      case "owner": s("Owned by "); i(t.name); s(", as " + others + (n === 1 ? " was" : " were")); break;
      case "museum": s("Held by " + (/^the\s/i.test(t.name) ? "" : "the ")); i(t.name); s(", with " + others); break;
      case "writing": s("In "); i(t.name); s(" (" + [String(t.at || "").split(" ").pop(), t.y].filter(Boolean).join(", ") + "), with " + others); break;
      case "artist": s("By "); i(t.name); s(", like " + others); break;
      default: i(t.name);
    }
    return f;
  }

  function artColumn(h, via) {
    var a = art;
    var col = artCol;

    // The work, in words, is its wall label, touching its photograph (labelPicture, 7 Oct 2026); the
    // column starts with the counts line, so the facts are not said twice.
    labelPicture(null, h, true);
    a.headCap = artLabel || el("div");
    a.headFig = null;

    var body = el("div", "art-body");
    col.appendChild(body);
    a.body = body;

    var count = el("p", "art-count", countLine(h, a.stops));
    // The artist, for the door into their life (lives.js) after this line.
    count.dataset.artist = (h.artists || [])[0] || "";
    body.appendChild(count);

    // How you came: by a thread, from a work (FROM hops back).
    var came = cameLine(via);
    if (came) { body.appendChild(came); }

    // The thread being said (the next pass says them).
    var stageW = el("div", "read-stage art-stage");
    stageW.setAttribute("aria-live", "polite");
    body.appendChild(stageW);
    a.stage = stageW;

    // What has been said of it: the artist's own words first, then the
    // writers', the museum's label, the catalogue's note.
    var said = saidSection(h);
    if (said) { body.appendChild(said); }

    // Where it has been: the places in order, each a door on the globe and
    // a way in; between them, quietly, what the record does not place.
    var route = el("section", "art-route");
    var places = {};
    a.stops.forEach(function (st) { places[st.p] = true; });
    var np = Object.keys(places).length;
    route.appendChild(el("p", "art-section-head", np ? "Where it has been · " + np + (np === 1 ? " place" : " places") : "Its history"));
    var ol = el("ol", "art-stops");
    // Painted here (sites.js): where the work was made, documented, first.
    var painted = window.Sites && Sites.stop ? Sites.stop(h) : null;
    if (painted) { ol.appendChild(painted); }
    a.groups.forEach(function (g) {
      var shown = g.events.filter(function (n) { return !quietLine(h, n); });
      if (!shown.length) { return; }
      var li = el("li", g.unplaced ? "art-stop art-between" : "art-stop");
      if (!g.unplaced) {
        var years = yearsOf(g.events, h);
        var office = g.events.every(function (n) { return h.events[n].pr === "office"; });
        var name = g.name || g.p;
        var row = el("div", "art-stop-row");
        var hd = el("button", "art-stop-head",
          office ? name + " · where the gallery is" : [name, years].filter(Boolean).join(" · "));
        hd.type = "button";
        hd.dataset.stop = String(g.stop);
        hd.setAttribute("aria-label", (placeSaid(name) || name) + (years ? ", " + years : "") + ": show it on the globe");
        hd.addEventListener("click", function (event) { event.stopPropagation(); showStop(g.stop); });
        hd.addEventListener("pointerenter", function (event) {
          if (event.pointerType === "mouse") { pulseStop(g.stop, 0.3); }
        });
        // The time this group is at, for scrolling: its first dated line (a
        // return to a place is its own group, with its own years).
        var dated = g.events.filter(function (n) { return yearNum(h.events[n].y) !== null; })[0];
        hd.dataset.at = String(dated === undefined ? g.events[0] : dated);
        a.heads.push(hd);
        var into = el("button", "art-stop-in", "Enter ›");
        into.type = "button";
        into.setAttribute("aria-label", "Enter " + (String(name).split(",")[0]) + (years ? " in " + years.split("–")[0] : ""));
        into.addEventListener("click", function (event) { event.stopPropagation(); stopDoor(g, h); });
        row.appendChild(hd);
        row.appendChild(into);
        li.appendChild(row);
        li.dataset.stop = String(g.stop);
      } else {
        li.setAttribute("aria-label", "Where this happened is not recorded");
      }
      shown.forEach(function (n) { li.appendChild(artLine(h, n)); });
      ol.appendChild(li);
    });
    route.appendChild(ol);
    body.appendChild(route);

    // All the threads, once each has been said (the next pass shows them).
    var line = el("div", "read-words art-words");
    line.setAttribute("aria-label", "What " + (h.title || "this work") + " shares");
    (h.threads || []).forEach(function (t) {
      var b = el("button", "read-w", t.name);
      b.type = "button";
      b.dataset.thread = t.id;
      b.addEventListener("click", function (event) { event.stopPropagation(); holdThread(t); });
      line.appendChild(b);
    });
    body.appendChild(line);
    a.line = line;
    a.order = (h.threads || []).slice();

    // The writings: citations, linked to their originals where there is one;
    // the first five, and the rest a press away.
    var written = [];
    h.events.forEach(function (ev, n) { if (ev.k === "written") { written.push(n); } });
    if (written.length) {
      var cites = el("section", "art-cites");
      cites.appendChild(el("p", "art-cites-head", "Written · " + written.length));
      written.forEach(function (n, i) {
        var c = citeOf(h.events[n]);
        if (i >= 5) { c.hidden = true; }
        a.lines[n] = c;
        cites.appendChild(c);
      });
      if (written.length > 5) { cites.appendChild(moreButton(cites, ".art-cite", "All " + written.length + " writings")); }
      body.appendChild(cites);
    }

    // Where it is all from, in plain words; and putting it away.
    var names = [];
    (h.sources || []).forEach(function (s) { if (s.name && names.indexOf(s.name) < 0) { names.push(s.name); } });
    (h.said || []).forEach(function (e) {
      var n = e.k === "note" ? e.by : e.k === "museum" || e.k === "wiki" ? e.by : e.via;
      if (n && names.indexOf(n) < 0) { names.push(n); }
    });
    var from = el("p", "art-sources",
      (names.length ? "From " + names.join("; ") + ". " : "") + (h.asof ? "Known to " + dayOf(h.asof) + "." : ""));
    body.appendChild(from);
    var away = el("button", "read-quiet", "Put it away");
    away.type = "button";
    away.addEventListener("click", function (event) { event.stopPropagation(); comeUp(); });
    body.appendChild(away);

    a.count = count;
  }

  /* A line the column leaves out: "Made" with no place, whose year the head
     already gives; a holding that names no holder beside one that does. Its
     tick stays on the dial. */
  function quietLine(h, n) {
    var ev = h.events[n];
    // And "In the collection" that names no one, when another line names the holder.
    if (ev.k === "held" && !ev.who && !ev.v) {
      return h.events.some(function (o) { return o.k === "held" && (o.who || o.v); });
    }
    return ev.k === "made" && !(ev.ll && ev.p);
  }

  /* "3 more": the hidden ones of a list shown, and the button gone. */
  function moreButton(box, sel, words) {
    var more = el("button", "art-more-all", words);
    more.type = "button";
    more.addEventListener("click", function (event) {
      event.stopPropagation();
      box.querySelectorAll(sel).forEach(function (n) { n.hidden = false; });
      more.remove();
    });
    return more;
  }

  /* What has been said of the work (build_artwork_histories.py, from
     artwork_said.py): each a quotation in the words of who said it, never a
     paraphrase, with who and where. The artist's words under their own head;
     the rest — writers, critics and curators, the museum's label, the
     catalogue's note, Wikipedia's opening — under "Said of it". Two of each
     at first, the rest a press away. The artist, 1 Oct 2026: "feature key
     points from prominent writers on the works or even notes from the
     artists themselves". */
  function saidSection(h) {
    var list = h.said || [];
    if (!list.length) { return null; }
    var box = el("section", "art-said");
    var mine = list.filter(function (e) { return e.k === "artist"; });
    var theirs = list.filter(function (e) { return e.k !== "artist"; });
    [[mine, "The artist’s words"], [theirs, "Said of it"]].forEach(function (pair) {
      var items = pair[0];
      if (!items.length) { return; }
      var part = el("div", "art-said-part");
      part.appendChild(el("p", "art-section-head", pair[1]));
      items.forEach(function (e, i) {
        var f = el("figure", "art-said-one");
        f.dataset.k = e.k;
        if (i >= 2) { f.hidden = true; }
        var bq = el("blockquote", "art-said-q", "“" + e.q + "”");
        // A long quotation is held to six lines until it is pressed.
        if (e.q.length > 300) {
          bq.dataset.long = "true";
          bq.addEventListener("click", function (event) {
            event.stopPropagation();
            if (bq.dataset.open) { delete bq.dataset.open; } else { bq.dataset.open = "true"; }
          });
        }
        f.appendChild(bq);
        var cap = el("figcaption", "art-said-by");
        cap.appendChild(el("span", "art-said-who", e.by || ""));
        var where = [e.in || "", e.via && e.via !== e.by ? "as quoted by " + e.via : ""].filter(Boolean).join(" · ");
        if (e.k === "note" && !where) { where = "the catalogue note"; }
        if (where) { cap.appendChild(el("span", "art-said-in", where)); }
        f.appendChild(cap);
        part.appendChild(f);
      });
      if (items.length > 2) { part.appendChild(moreButton(part, ".art-said-one", (items.length - 2) + " more")); }
      box.appendChild(part);
    });
    return box;
  }

  function dayOf(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
    if (!m) { return iso; }
    var mon = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m[2]) - 1];
    return Number(m[3]) + " " + mon + " " + m[1];
  }

  /* "BY Giacometti & Dubuffet ← FROM Chaise et guéridon": how a door
     brought you, and the way back. */
  function cameLine(via) {
    if (!via || !(via.thread || via.from || via.museum || via.place)) { return null; }
    var p = el("p", "art-came");
    var by = via.thread ? via.thread.name : via.museum ? via.museum.name
      : via.place && artPlaceBy[via.place] ? artPlaceBy[via.place].name : "";
    if (by) {
      p.appendChild(document.createTextNode("By "));
      p.appendChild(el("i", "", by));
    }
    if (via.from) {
      p.appendChild(document.createTextNode((by ? " ← " : "") + "From "));
      var back = el("button", "art-back");
      back.type = "button";
      back.appendChild(el("i", "", via.from.title || "the work before"));
      back.addEventListener("click", function (event) {
        event.stopPropagation();
        openArt({ work: via.from.id }, { thread: via.thread });
      });
      p.appendChild(back);
    }
    return p;
  }

  /* One event's line, and what a press opens under it. */
  function artLine(h, n) {
    var a = art;
    var ev = h.events[n];
    var line = el("div", "art-line");
    line.tabIndex = 0;
    line.setAttribute("role", "button");
    line.setAttribute("aria-expanded", "false");
    if (ev.k === "listed") { line.dataset.kind = "listed"; }
    line.appendChild(el("span", "art-when", whenOf(ev)));
    var what = el("span", "art-what");
    what.appendChild(lineOf(ev));
    if (ev.x && ev.x.length && h.threads) {
      var most = 0;
      ev.x.forEach(function (x) { var t = h.threads[x]; if (t && t.n > most) { most = t.n; } });
      if (most) { what.appendChild(el("span", "art-shared", "·" + most)); }
    }
    line.appendChild(what);
    function toggle(event) {
      if (event.target.closest && event.target.closest(".art-more button, .art-more a")) { return; }
      expandLine(line, ev, n);
    }
    line.addEventListener("click", toggle);
    // Pointed at with a mouse, its stop answers on the globe.
    line.addEventListener("pointerenter", function (event) {
      if (event.pointerType !== "mouse" || !art) { return; }
      art.stops.forEach(function (st, k) { if (st.events.indexOf(n) >= 0) { pulseStop(k, 0.3); } });
    });
    line.addEventListener("keydown", function (event) {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(event); }
    });
    a.lines[n] = line;
    return line;
  }

  /* A line opened: the source's own words, whose they are, how it is
     placed, and its threads as sentences; the slider goes to it and its
     stop answers on the globe. */
  function expandLine(line, ev, n) {
    var a = art;
    if (!a) { return; }
    var open = line.getAttribute("aria-expanded") === "true";
    line.setAttribute("aria-expanded", String(!open));
    if (open) { return; }
    if (!line.more) {
      var h = a.data;
      var more = el("div", "art-more");
      if (ev.q && ev.q !== ev.y) {
        var q = el("p", "art-q");
        q.appendChild(document.createTextNode("“"));
        italics(ev.q, q);
        q.appendChild(document.createTextNode("”"));
        more.appendChild(q);
      }
      var srcs = [];
      (ev.s || []).forEach(function (k) {
        var s = h.sources && h.sources[k];
        if (s && s.name && srcs.indexOf(s.name) < 0) { srcs.push(s.name); }
      });
      if (ev.n && ev.n.length > 90 && ev.n !== ev.q) {
        var nt = el("p", "art-q art-note");
        italics(ev.n, nt);
        more.appendChild(nt);
      }
      if (srcs.length) { more.appendChild(el("p", "art-src", "— " + srcs.join("; "))); }
      more.appendChild(el("p", "art-how", ev.k === "written" ? "a writing, not a place" :
        (ev.ll && HOW[ev.pr]) || "the record gives no place"));
      (ev.x || []).forEach(function (x) {
        var t = h.threads && h.threads[x];
        if (!t) { return; }
        var b = el("button", "art-thread");
        b.type = "button";
        b.appendChild(threadSentence(t));
        b.addEventListener("click", function (event) { event.stopPropagation(); holdThread(t); });
        more.appendChild(b);
      });
      line.appendChild(more);
      line.more = more;
      if (!still) { enterText(more.firstChild, 0); }
    }
    var k = -1;
    a.stops.forEach(function (s, i) { if (s.events.indexOf(n) >= 0) { k = i; } });
    if (k >= 0) { showStop(k); }
    setWhen(a, a.evs[n].pos);
  }

  function pulseStop(k, strength) {
    var a = art;
    var s = a && a.stops[k];
    if (!s) { return; }
    var p = project(s.lat, s.lon);
    if (p.z > 0) { pulse(p.x, p.y, [a.tone, LIGHT], strength, 89); }
  }

  /* A stop's head: a door to its city — or, at one of the site's museums,
     to the museum, its town at that year (startBuilding reads atYear) and
     this work first among its saved works. */
  function stopDoor(g, h) {
    var at = h.events[g.events[0]].m;
    var m = at && g.events.every(function (n) { return h.events[n].m === at; }) ? cityOf(at) : null;
    if (m) {
      var y = yearNum((h.events[g.events[0]] || {}).y);
      if (y !== null) { m.atYear = Math.floor(y); }
      openMuseum(m.slug, { work: h.id });
      return;
    }
    // The city opens at the year the work arrived there (its first dated
    // event there), not at now, with the work's venue first and open.
    var yr = null;
    g.events.some(function (n) { yr = yearNum((h.events[n] || {}).y); return yr !== null; });
    openTown(g.p, { work: h.id, from: { id: h.id, title: h.title }, year: yr === null ? 0 : Math.floor(yr) });
  }

  /* ---- threads and doors ---------------------------------------------------

     What a history shares with other saved works — a show, a sale, an
     owner, a museum, a book, and the artist last — said one at a time on
     the reading's slow clock, rarest first, each with its doors: the works
     that share it. Pressing a door turns the world to that work, and the
     thread you came by is the first thing said there, so a visit is a walk
     from work to work by where they have been together. Pressing a thread
     holds it: the work steps back, the doors come forward with their names,
     and the globe draws every member's way into the shared place and on
     from it (the constellation). A listing is not a thread: a gallery's
     catalogue is reached through the place view's institutions instead. */

  // The thread a visit arrived by: a door's, or the museum's when it came
  // from that museum's column.
  function cameThread(h, via) {
    if (!via) { return null; }
    var found = null;
    (h.threads || []).forEach(function (t) {
      if (found) { return; }
      if (via.thread ? t.id === via.thread.id
                     : via.museum && t.k === "museum" && t.name === via.museum.name) { found = t; }
    });
    return found;
  }

  function museumNamed(name) {
    for (var i = 0; i < cities.length; i += 1) {
      if (cities[i].museum && cities[i].museum.name === name) { return cities[i]; }
    }
    return null;
  }

  /* The threads, on the reading's clock from arrival: the one you came by at
     2 s, then the first at FIRST_WORD_AT and each after it waiting longer,
     only while the pointer is still; then all of them, small, in a line. */
  function threadProcession() {
    var a = art;
    if (!a || a.kind !== "work" || a.begun) { return; }
    a.begun = true;
    var by = cameThread(a.data, a.via);
    a.order = (a.data.threads || []).slice();
    if (by) { a.order = [by].concat(a.order.filter(function (t) { return t !== by; })); }
    a.n = 0;
    a.gap = WORD_GAP;
    if (by) {
      a.n = 1;
      // Said while the photograph is still looked at: how you came and the
      // thread come into the column alone, and the look keeps its 9 s.
      later(function () { artEl.dataset.came = "true"; sayThread(by, true); }, 2000, a);
    }
    sayNext(a, Math.max(0, FIRST_WORD_AT - (performance.now() - a.at)));
  }

  // One chain of the clock at a time: holding and letting go start it again.
  function sayNext(a, ms) {
    var me = a.chain = (a.chain || 0) + 1;
    afterStill(function () { if (a.chain === me) { nextThread(); } }, ms, a);
  }

  function nextThread() {
    var a = art;
    if (!a || !a.live || a.held) { return; }
    if (!a.order.length) {
      // Nothing it shares with another saved work: said once, and kept.
      var box = el("div", "read-said art-said");
      box.appendChild(el("p", "read-only", "only here"));
      a.stage.appendChild(box);
      requestAnimationFrame(function () { box.dataset.on = "true"; });
      return;
    }
    if (a.n >= a.order.length) {
      quiet(a);
      a.line.dataset.on = "true";
      return;
    }
    sayThread(a.order[a.n], false);
    a.n += 1;
    var gap = a.gap;
    a.gap = Math.min(WORD_GAP_MAX, a.gap * WORD_GAP_GROW);
    sayNext(a, gap);
  }

  /* A thread takes the room: its sentence, and under it its doors, read
     just before it is said, the next one read ahead. */
  function sayThread(t, keep) {
    var a = art;
    if (!a || !a.stage || !t) { return; }
    quiet(a);
    var box = el("div", "read-said art-said");
    var said = el("p", "art-sentence");
    said.appendChild(threadSentence(t));
    box.appendChild(said);
    a.stage.appendChild(box);
    box.getBoundingClientRect();
    requestAnimationFrame(function () { if (box.dataset.on !== "false") { box.dataset.on = "true"; } });
    if (a.line) {
      Array.prototype.forEach.call(a.line.children, function (b) {
        b.setAttribute("aria-pressed", String(!!keep && b.dataset.thread === t.id));
      });
    }
    readThread(t.id).then(function (tf) {
      if (art !== a || box.dataset.on === "false" || !box.parentNode) { return; }
      box.appendChild(doorsOf(tf, t, a));
    });
    var k = a.order.indexOf(t);
    var ahead = a.order[k >= 0 ? k + 1 : a.n];
    if (ahead) { readThread(ahead.id); }
    var at = a.stage.getBoundingClientRect();
    if (at.width && !still) { pulse(at.left + 30, at.top + 24, [a.tone, LIGHT], 0.35, 90); }
  }

  /* Eight of the works that share it, the one you came from first and
     marked; a museum's thread has the museum itself as its first door; and
     the rest are in the thread's own view. */
  function doorsOf(tf, t, a) {
    var box = el("div", "read-doors art-doors");
    var me = a.data.id, from = a.via.from && a.via.from.id;
    var rows = tf ? tf.works.filter(function (w) { return w[0] !== me; }) : [];
    rows = rows.filter(function (w) { return w[0] === from; })
      .concat(rows.filter(function (w) { return w[0] !== from; }));
    var n = 0;
    var mc = t.k === "museum" ? museumNamed(t.name) : null;
    if (mc) { box.appendChild(museumDoor(mc, a, n)); n += 1; }
    rows.slice(0, 8).forEach(function (w) { box.appendChild(workDoor(w, t, tf, a, n)); n += 1; });
    if (rows.length > 8) {
      var more = el("button", "art-and-more", "and " + (rows.length - 8) + " more");
      more.type = "button";
      more.style.transitionDelay = (still ? 0 : 520 + n * 140) + "ms";
      more.addEventListener("click", function (event) {
        event.stopPropagation();
        openArt({ thread: t.id }, { work: me, from: { id: me, title: a.data.title, tone: a.tone } });
      });
      box.appendChild(more);
    }
    if (!n) { box.appendChild(el("p", "read-only", "only here")); }
    return box;
  }

  function workDoor(w, t, tf, a, n) {
    var d = el("button", "read-door art-door");
    d.type = "button";
    d.setAttribute("aria-label", (w[1] || "Untitled") + (w[2] ? ", " + w[2] : "") + " — also " + t.name);
    var pic = el("span", "art-door-pic");
    var go = el("span", "deal-go");
    var img = el("img");
    img.alt = "";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    if (w[3]) { img.src = ART_CDN + w[3] + "/square.jpg"; }
    go.appendChild(img);
    pic.appendChild(go);
    d.appendChild(pic);
    d.appendChild(el("span", "read-door-t", w[1] || "Untitled"));
    if (a.via.from && a.via.from.id === w[0]) { d.appendChild(el("span", "art-door-came", "you came from here")); }
    var wait = still ? 0 : 520 + n * 140;
    d.style.transitionDelay = wait + "ms";
    later(function () { pixelIn(pic, 0); }, wait, a);
    d.addEventListener("click", function (event) {
      event.stopPropagation();
      throughDoor(w, t, tf, pic, go);
    });
    return d;
  }

  function museumDoor(mc, a, n) {
    var d = el("button", "read-door art-door art-door-museum");
    d.type = "button";
    d.setAttribute("aria-label", "Go down to " + mc.title);
    d.appendChild(el("span", "art-door-pic"));
    d.appendChild(el("span", "read-door-t", mc.title));
    d.style.transitionDelay = (still ? 0 : 520 + n * 140) + "ms";
    d.addEventListener("click", function (event) {
      event.stopPropagation();
      openMuseum(mc.slug, { work: a.data.id });
    });
    return d;
  }

  /* Pressed, a thread stays: the work steps back, the doors grow and show
     their names, and the constellation is drawn. Pressed again, let go. */
  function holdThread(t) {
    var a = art;
    if (!a || a.kind !== "work" || !t) { return; }
    if (a.held === t.id) { releaseThread(); return; }
    flipToHead();
    a.held = t.id;
    artEl.dataset.held = "true";
    sayThread(t, true);
    readThread(t.id).then(function (tf) {
      if (art !== a || a.held !== t.id || !tf) { return; }
      var members = tf.works.filter(function (w) { return w[0] !== a.data.id; }).map(function (w) {
        return { y: w[4], prev: w[5], next: w[6] };
      });
      constellation(members, tf.ll, a);
    });
  }

  function releaseThread() {
    var a = art;
    if (!a) { return; }
    a.held = null;
    delete artEl.dataset.held;
    a.cons = null;
    a.dirty = true;
    tilesDirty = true;
    if (a.line) {
      Array.prototype.forEach.call(a.line.children, function (b) { b.setAttribute("aria-pressed", "false"); });
    }
    quiet(a);
    if (a.kind === "work" && a.n < a.order.length) { sayNext(a, READ_BEAT); }
  }

  /* Each member's way into the shared place from where it was before, and
     on to where it went after, for at most 34 of them, in lilac, one every
     89 ms, converging; then the place sparkles once. Members carry their
     year, so a place's or a thread's slider keeps to those already there. */
  function constellation(members, ll, a) {
    a = a || art;
    if (!a || !ll) { return; }
    var c = toVec(ll[0] * RAD, wrap(ll[1] * RAD));
    var now = performance.now(), legs = [], n = 0;
    members.forEach(function (m) {
      if (n >= 34) { return; }
      var prev = m.prev && artPlaceBy[m.prev], next = m.next && artPlaceBy[m.next];
      var into = prev ? arcOf(prev.v, c) : null, on = next ? arcOf(c, next.v) : null;
      if (!into && !on) { return; }
      var at = now + n * 89;
      if (into) { legs.push({ samples: into, litAt: at, y: m.y || 0 }); }
      if (on) { legs.push({ samples: on, litAt: at + (into ? LEG_MS : 0), y: m.y || 0 }); }
      n += 1;
    });
    a.cons = { legs: legs, ll: ll };
    a.dirty = true;
    tilesDirty = true;
    if (!legs.length) { return; }
    later(function () {
      var p = project(ll[0] * RAD, wrap(ll[1] * RAD));
      if (p.z > 0) { sparkle(p.x, p.y, [GOLD], 13); }
    }, (n - 1) * 89 + LEG_MS, a);
  }

  function consRuns(a, runs, t) {
    a.cons.legs.forEach(function (leg) {
      if (a.kind !== "work" && a.yearNow && leg.y > a.yearNow) { return; }
      if (!still && t < leg.litAt) { a.anim = true; return; }
      var q = still ? 1 : Math.min(1, (t - leg.litAt) / LEG_MS);
      if (q < 1) { a.anim = true; }
      legRuns(runs, leg, LILAC, 2, q, false, 0);
    });
  }

  /* A door pressed: the thumbnail answers (a dealt pointed effect), the
     step is kept for the walk, and the world turns to the next work. */
  function throughDoor(w, t, tf, pic, go) {
    var a = art;
    if (!a || flying) { return; }
    if (!still && pic) { POINTED[oneOf(Object.keys(POINTED))](pic, go); }
    if (!artWalk.length) {
      var here = a.stopNow();
      artWalk.push({ lat: here.lat, lon: here.lon });
    }
    if (tf && tf.ll) { artWalk.push({ lat: tf.ll[0] * RAD, lon: wrap(tf.ll[1] * RAD) }); }
    if (artWalk.length > 34) { artWalk.splice(0, artWalk.length - 34); }
    var from = { id: a.data.id, title: a.data.title, tone: a.tone };
    var by = { id: t.id, k: t.k, name: t.name, ll: tf && tf.ll };
    window.setTimeout(function () {
      if (art === a) { openArt({ work: w[0] }, { thread: by, from: from }); }
    }, still ? 0 : 377);
  }

  /* Come up to the world, how you got there is drawn once: each shared
     stop joined to the next in lilac, going out in steps over φ³ s. */
  function drawWalkOnce() {
    var pts = artWalk.map(function (p) { return { v: toVec(p.lat, p.lon), first: 0, broken: false }; });
    artWalk = [];
    var legs = legsOf(pts);
    if (!legs.length || still) { return; }
    walkShown = { legs: legs, at: performance.now() };
    tilesDirty = true;
  }

  function walkRuns(runs, t) {
    var age = t - walkShown.at, dur = Math.pow(PHI, 3) * 1000;
    if (age >= dur) { walkShown = null; return; }
    var lvl = Math.max(1, Math.ceil(3 * (1 - age / dur)));
    walkShown.legs.forEach(function (leg) { legRuns(runs, leg, LILAC, lvl, 1, false, 0); });
  }

  /* ---- the place and thread views ------------------------------------------

     A place: every gallery, museum, fair and saleroom a saved work passed
     through there, in the order they came into the story, each with its
     works; a site museum's is a door down to it. A thread: its works in the
     order they arrived, each with where it came from and went. Any row
     opens its history, arriving by the place or the thread. Long columns
     come 34 rows at a time. */

  var KIND_WORD = { made: "Made", owned: "Owned", held: "Held", listed: "Listed", exhibited: "Shown",
                    offered: "Offered", sold: "Sold", written: "Written", other: "Here" };

  // "1968–73", "1968–2003", "1968", or nothing.
  function yearsText(y0, y1) {
    if (!y0) { return y1 ? String(y1) : ""; }
    if (!y1 || y1 === y0) { return String(y0); }
    var a = String(y0), b = String(y1);
    return a.slice(0, 2) === b.slice(0, 2) ? a + "–" + b.slice(2) : a + "–" + b;
  }

  /* The rows, 34 at a time: more come as the last nears the foot of what
     scrolls them (the column, unless opts.root; a museum's works may be a
     strip, so either way). opts.alive says whether they are still wanted,
     and every watcher is kept to be let go (opts.pagers). until(k) pages on
     until row k is there. */
  function pageRows(host, items, make, opts) {
    opts = opts || {};
    var a = art, at = 0, watch = null;
    var root = opts.root || artCol;
    var alive = opts.alive || function () { return art === a; };
    var pagers = opts.pagers || (a ? a.pagers : []);
    var mark = el("div", "art-more-rows");
    mark.setAttribute("aria-hidden", "true");
    host.appendChild(mark);
    function near() {
      var r = mark.getBoundingClientRect(), c = root.getBoundingClientRect();
      return r.top < c.bottom + 377 && r.left < c.right + 377;
    }
    function more() {
      if (!alive() || !mark.parentNode) { return; }
      var stop = Math.min(items.length, at + 34);
      var frag = document.createDocumentFragment();
      for (var k = at; k < stop; k += 1) {
        var e = make(items[k], k - at);
        if (e) { frag.appendChild(e); }
      }
      at = stop;
      host.insertBefore(frag, mark);
      if (at >= items.length) {
        if (watch) { watch.disconnect(); }
        mark.parentNode.removeChild(mark);
        return;
      }
      // Still near the foot after a short page: another.
      requestAnimationFrame(function () { if (near()) { more(); } });
    }
    // Scrolled past the foot at a fling, the rows still come.
    function flung() { if (near()) { more(); } }
    more();
    if (at < items.length && window.IntersectionObserver) {
      var seen = new IntersectionObserver(function (entries) {
        if (entries.some(function (e) { return e.isIntersecting; })) { more(); }
      }, { root: root, rootMargin: "377px" });
      seen.observe(mark);
      root.addEventListener("scroll", flung, { passive: true });
      watch = { disconnect: function () { seen.disconnect(); root.removeEventListener("scroll", flung); } };
      pagers.push(watch);
    } else {
      while (at < items.length && alive() && mark.parentNode) { more(); }
    }
    return {
      until: function (k) { while (at <= k && at < items.length && alive() && mark.parentNode) { more(); } },
      stop: function () { if (watch) { watch.disconnect(); } }
    };
  }

  // A row: a saved work, what happened there in mono, and its history a press away.
  function artRow(id, t, who, img, what, y, via, k) {
    var a = art;
    var fig = heldFigure({ t: t, a: who, y: "" }, ART_CDN + img + "/square.jpg", k, false,
                         [ART_CDN + img + "/medium.jpg"],
                         { onOpen: function () { openArt({ work: id }, via); } });
    fig.classList.add("art-row");
    fig.querySelector("img").loading = "lazy";
    if (what) { fig.querySelector("figcaption").appendChild(el("span", "art-row-what", what)); }
    a.rows.push({ el: fig, y: y || 0 });
    if (a.yearNow && y && y > a.yearNow) { fig.dataset.later = "true"; }
    return fig;
  }

  function laterRows(a) {
    a.rows.forEach(function (r) {
      if (r.y && r.y > a.yearNow) { r.el.dataset.later = "true"; } else { delete r.el.dataset.later; }
    });
    if (a.kind !== "town") { return; }
    // A city: its museums' rows and its galleries' by their first year here;
    // the marks and the tiles follow (placeTown, drawVenues).
    Object.keys(a.museumRows || {}).forEach(function (slug) {
      var r = a.museumRows[slug];
      if (r.y0 && r.y0 > a.yearNow) { r.row.dataset.later = "true"; } else { delete r.row.dataset.later; }
    });
    (a.venueBoxes || []).forEach(function (box) {
      if (box.y0 && box.y0 > a.yearNow) { box.dataset.later = "true"; } else { delete box.dataset.later; }
    });
    townDirty = true;
  }

  /* The slider over a place's or a thread's members: from the first year
     one of them was there to the last. It starts at the last, all shown. */
  function memberYears(a, ys, end) {
    var lo = Infinity, hi = -Infinity, seen = {};
    ys.forEach(function (y) { if (y) { lo = Math.min(lo, y); hi = Math.max(hi, y); } });
    if (end && end > hi && lo !== Infinity) { hi = end; }
    artTicks.textContent = "";
    if (lo === Infinity || hi <= lo) { artTime.hidden = true; return; }
    a.y0 = lo;
    a.y1 = hi + 0.999;
    a.dated = true;
    a.ticks = [];
    ys.forEach(function (y) {
      if (!y || seen[y]) { return; }
      seen[y] = true;
      var pos = (y - lo) / (a.y1 - lo);
      a.ticks.push(pos);
      var tk = el("span", "art-tick");
      tk.style.left = (pos * 100).toFixed(2) + "%";
      artTicks.appendChild(tk);
    });
    a.ticks.sort(function (m, n) { return m - n; });
    a.when = a.whenTo = 1;
    a.yearNow = hi;
    // Come from a stop: the slider slides back to the year the work was here.
    var at = a.via && a.via.year;
    if (at && at >= lo && at <= hi) {
      a.whenTo = (at - lo) / (a.y1 - lo);
      a.byHand = true;
    }
    artTime.hidden = false;
    showArtYear();
  }

  /* A city's dial over a period of a life (placethen.js): from y0 to y1,
     ticked at the years given, standing at `at`. The city's own years give way
     while the place is read as it was then; its rows later than the year dim. */
  function spanYears(a, lo, hi, ys, at) {
    if (hi <= lo) { hi = lo + 1; }
    artTicks.textContent = "";
    a.y0 = lo;
    a.y1 = hi + 0.999;
    a.dated = true;
    a.ticks = [];
    var seen = {};
    ys.forEach(function (y) {
      if (!y || seen[y] || y < lo || y > hi) { return; }
      seen[y] = true;
      var pos = (y - lo) / (a.y1 - lo);
      a.ticks.push(pos);
      var tk = el("span", "art-tick");
      tk.style.left = (pos * 100).toFixed(2) + "%";
      artTicks.appendChild(tk);
    });
    a.ticks.sort(function (m, n) { return m - n; });
    a.auto = null;
    a.firstPlay = false;
    a.playing = false;
    a.seg = null;
    a.byHand = true;
    var y = at && at >= lo && at <= hi ? at : lo;
    a.when = a.whenTo = Math.max(0, Math.min(1, (y + 0.5 - lo) / (a.y1 - lo)));
    a.yearNow = y;
    a.dirty = true;
    artTime.hidden = false;
    showArtYear();
  }

  function threadColumn(tf, via) {
    var a = art;
    var n = tf.works.length;
    // A style's head: its count, artists and years made; its rows by date, each with where it is now.
    var style = tf.k === "style";
    var ys = style ? tf.works.map(function (w) { return w[4]; }).filter(Boolean) : [];
    var nArt = style ? tf.works.reduce(function (o, w) { o[w[2]] = 1; return o; }, {}) : null;
    var head = el("p", "art-count", style
      ? [n + " saved works", Object.keys(nArt).length + " artists",
         ys.length ? Math.min.apply(null, ys) + "–" + Math.max.apply(null, ys) : ""].filter(Boolean).join(" · ")
      : [THREAD_WORD[tf.k] || "", n + (n === 1 ? " work" : " works"),
         [tf.at, tf.y].filter(Boolean).join(", ")].filter(Boolean).join(" · "));
    artCol.appendChild(head);
    if (style) {
      var byA = tf.works.filter(function (w) { return w[7] === "a"; }).length;
      artCol.appendChild(el("p", "art-came", byA
        ? (n - byA) + " tagged with it by Artsy · " + byA + " by their artist's tag, dated within its years"
        : "As Artsy tags each work"));
    }
    enterText(head, 0);
    var came = cameLine(via);
    if (came) { artCol.appendChild(came); }
    var rows = tf.works.slice();
    if (via && via.work) {
      rows = rows.filter(function (w) { return w[0] === via.work; })
        .concat(rows.filter(function (w) { return w[0] !== via.work; }));
    }
    var by = { id: tf.id, k: tf.k, name: tf.name, ll: tf.ll };
    var host = el("div", "art-rows");
    artCol.appendChild(host);
    pageRows(host, rows, function (w, k) {
      var prev = w[5] && artPlaceBy[w[5]], next = w[6] && artPlaceBy[w[6]];
      var what = style ? [prev ? "Made in " + prev.name : "", next && next !== prev ? "Now " + next.name : "",
                          w[7] === "a" ? "by its artist's tag" : ""].filter(Boolean).join(" · ")
        : [prev ? "From " + prev.name : "", next ? "To " + next.name : ""].filter(Boolean).join(" · ");
      return artRow(w[0], w[1], w[2], w[3], what, w[4], { thread: by }, k);
    });
    artFoot();
    var members = tf.works.map(function (w) { return { y: w[4], prev: w[5], next: w[6] }; });
    memberYears(a, members.map(function (m) { return m.y; }));
    constellation(members, tf.ll, a);
  }

  function artFoot() {
    var away = el("button", "read-quiet", "Put it away");
    away.type = "button";
    away.addEventListener("click", function (event) { event.stopPropagation(); comeUp(); });
    artCol.appendChild(away);
    return away;
  }

  /* ---- Find ------------------------------------------------------------------

     5,112 works cannot be found by turning a globe, and with one link and
     no deep links the page is its own finder. It opens on works, not on a
     keyboard: eight dealt from the longest journeys, the field waiting
     above them. Typing matches the starts of words, whatever the accents
     and case, in the titles, artists, dates, categories and the names of
     every place a work has been; the globe answers, the places of what is
     found lit and the rest let down. Closed, it keeps its words and where
     it was scrolled to. Nothing is submitted; the address never changes. */

  var finding = null;                   // finding.json, folded for searching
  var finderField = document.getElementById("finder-field");
  var finderSaid = document.getElementById("finder-said");
  var finderFound = document.getElementById("finder-found");

  // As the build's norm(): no accents, lower case, letters and digits.
  function fold(s) {
    return " " + String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() + " ";
  }

  function readFinding() {
    // The styles and movements as Artsy tags the works (build_styles.py; artist, 8 Oct 2026: "I should be able
    // to look up an art movement or style and it have an option that takes me to all of the works in that
    // art movement or style"): each a thread of kind "style".
    var styles = readArt("styles.json").then(null, function () { return null; });
    return Promise.all([readPlaces(), readArt("finding.json"), styles]).then(function (both) {
      var d = both[1];
      if (finding || !d || !artPlaces) { return finding; }
      artPlaces.forEach(function (pl) { pl.hay = fold(pl.name + " " + pl.cc); });
      var works = d.w.map(function (w) {
        var names = (w[5] || []).map(function (i) { return artPlaces[i] ? artPlaces[i].name : ""; }).join(" ");
        return { id: w[0], t: w[1], a: w[2], y: w[3], i: w[4], pl: w[5] || [], n: w[6],
                 hay: fold([w[1], w[2], w[3], (d.k || [])[w[7]] || "", names].join(" ")) };
      });
      var byId = {};
      works.forEach(function (w) { byId[w.id] = w; });
      finding = {
        cdn: d.cdn || ART_CDN, works: works, byId: byId,
        threads: d.t.map(function (t) {
          return { id: t[0], k: t[1], name: t[2], at: t[3], y: t[4], n: t[5],
                   hay: fold([t[2], t[3], t[4] || ""].join(" ")) };
        }),
        styles: ((both[2] && both[2].styles) || []).map(function (r) {
          return { id: r[0], k: "style", name: r[1], n: r[2], y0: r[3], y1: r[4], artists: r[6], hay: fold(r[1]) };
        })
      };
      return finding;
    });
  }

  /* The museums as Find knows them: museums.json's, and the Folger. */
  var findMuseums = null;
  function museumsToFind() {
    if (findMuseums) { return findMuseums; }
    findMuseums = ((museums && museums.museums) || []).map(function (m) {
      var t = townBy[townOfSlug[m.slug]];
      return { slug: m.slug, name: m.name, town: t ? t.name : String(m.where || "").split(",")[0],
               held: m.held, hay: fold([m.name, shortName(m), t ? t.name : m.where].join(" ")) };
    });
    LANDMARKS.forEach(function (mark) {
      if (!mark.town) { return; }
      var t = townBy[mark.town];
      findMuseums.push({ slug: mark.slug, name: mark.title, town: t ? t.name : "", stage: true,
                         hay: fold(mark.title + " " + (t ? t.name : "")) });
    });
    return findMuseums;
  }

  function findIn(text) {
    var toks = fold(text).split(" ").filter(Boolean);
    function hit(hay) {
      for (var k = 0; k < toks.length; k += 1) { if (hay.indexOf(" " + toks[k]) < 0) { return false; } }
      return true;
    }
    var works = finding.works.filter(function (w) { return hit(w.hay); });
    works.sort(function (a, b) { return b.n - a.n; });
    var out = { works: works, cities: [], museums: [], shows: [], owners: [], writings: [], artists: [], styles: [] };
    (finding.styles || []).forEach(function (t) { if (out.styles.length < 4 && hit(t.hay)) { out.styles.push(t); } });
    (towns || []).forEach(function (t) {
      if (out.cities.length >= 5) { return; }
      if (!t.hay) { t.hay = fold(t.name + " " + t.cc); }
      if (hit(t.hay)) { out.cities.push(t); }
    });
    if (towns) {
      museumsToFind().forEach(function (m) { if (out.museums.length < 3 && hit(m.hay)) { out.museums.push(m); } });
    }
    finding.threads.forEach(function (t) {
      var g = t.k === "show" || t.k === "sale" ? "shows" : t.k === "owner" || t.k === "museum" ? "owners"
        : t.k === "writing" ? "writings" : "artists";
      // A museum found as a museum is not found again as its thread.
      if (t.k === "museum" && out.museums.some(function (m) { return m.name === t.name; })) { return; }
      if (out[g].length < 3 && hit(t.hay)) { out[g].push(t); }
    });
    return out;
  }

  function finderHead(text) { finderFound.appendChild(el("p", "finder-group", text)); }

  // A work: its square, its title and artist, and how far it has been.
  function foundWork(w, k) {
    var b = el("button", "finder-row");
    b.type = "button";
    var img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    if (w.i) { img.src = finding.cdn + w.i + "/square.jpg"; }
    b.appendChild(img);
    var txt = el("span", "finder-text");
    txt.appendChild(el("i", "", w.t || "Untitled"));
    txt.appendChild(document.createTextNode([" — " + (w.a || ""), w.y].filter(Boolean).join(", ")));
    var places = w.pl.length;
    txt.appendChild(el("span", "finder-how", [places ? places + (places === 1 ? " place" : " places") : "",
      w.n + (w.n === 1 ? " event" : " events")].filter(Boolean).join(" · ")));
    b.appendChild(txt);
    b.style.animationDelay = (still ? 0 : k * 90) + "ms";
    b.addEventListener("click", function () { openArt({ work: w.id }); });
    return b;
  }

  function foundLine(k, make) {
    var b = el("button", "finder-row finder-line");
    b.type = "button";
    make(b);
    b.style.animationDelay = (still ? 0 : k * 90) + "ms";
    return b;
  }

  function showFound(g) {
    finderFound.textContent = "";
    var works = artInfo ? artInfo.works.toLocaleString("en") : "saved works";
    var total = g.works.length;
    var others = g.cities.length + g.museums.length + g.shows.length + g.owners.length + g.writings.length + g.artists.length +
      (g.styles || []).length;
    // What is found is lit on the globe by its cities.
    var lit = {};
    g.works.forEach(function (w) { w.pl.forEach(function (i) { if (artPlaces[i]) { lit[artPlaces[i].p] = true; } }); });
    g.cities.forEach(function (t) { lit[t.key] = true; });
    g.museums.forEach(function (m) { var key = townOfSlug[m.slug] || (m.stage && "washington-us"); if (key) { lit[key] = true; } });
    showFinding(lit);
    if (!total && !others) {
      finderSaid.textContent = "Nothing by that name among the " + works + ".";
      return;
    }
    // Everything found counts: a museum or a city found is found too.
    finderSaid.textContent = "Found · " + (total + others).toLocaleString("en");
    var k = 0;
    // A style or movement first: the door to every saved work in it.
    if (g.styles && g.styles.length) {
      finderHead("Styles and movements");
      g.styles.forEach(function (t) {
        finderFound.appendChild(foundLine(k, function (b) {
          b.appendChild(el("i", "", t.name));
          b.appendChild(document.createTextNode(" · all " + t.n.toLocaleString("en") + " works" +
            (t.artists > 1 ? " by " + t.artists + " artists" : "") +
            (t.y0 ? " · " + (t.y1 && t.y1 !== t.y0 ? t.y0 + "–" + t.y1 : t.y0) : "") + " ›"));
          b.setAttribute("aria-label", t.name + ": all " + t.n + " saved works in it");
          b.addEventListener("click", function () { openArt({ thread: t.id }); });
        }));
        k += 1;
      });
    }
    if (total) {
      finderHead("Works");
      g.works.slice(0, 13).forEach(function (w) { finderFound.appendChild(foundWork(w, k)); k += 1; });
    }
    if (g.cities.length) {
      finderHead("Cities");
      g.cities.forEach(function (t) {
        finderFound.appendChild(foundLine(k, function (b) {
          var m = t.museums.length;
          b.textContent = t.name + ", " + t.cc + " · " + (m ? m + (m === 1 ? " museum · " : " museums · ") : "") +
            t.n.toLocaleString("en") + (t.n === 1 ? " work" : " works");
          b.addEventListener("click", function () { openTown(t.key); });
        }));
        k += 1;
      });
    }
    if (g.museums.length) {
      finderHead("Museums");
      g.museums.forEach(function (m) {
        finderFound.appendChild(foundLine(k, function (b) {
          b.textContent = [m.name, m.town, m.stage ? "the plays" : m.held + " saved"].filter(Boolean).join(" · ");
          b.addEventListener("click", function () { openMuseum(m.slug, {}); });
        }));
        k += 1;
      });
    }
    [["shows", "Shows and sales"], ["owners", "Owners and museums"], ["writings", "Writings"], ["artists", "Artists"]]
      .forEach(function (grp) {
        if (!g[grp[0]].length) { return; }
        finderHead(grp[1]);
        g[grp[0]].forEach(function (t) {
          finderFound.appendChild(foundLine(k, function (b) {
            b.appendChild(el("i", "", t.name));
            b.appendChild(document.createTextNode([t.k === "artist" ? "" : t.at, t.y || ""].filter(Boolean)
              .map(function (s) { return ", " + s; }).join("") + " · " + t.n + " works"));
            b.addEventListener("click", function () {
              // A museum on the Museums layer opens as the museum.
              var mc = t.k === "museum" ? museumNamed(t.name) : null;
              if (mc) { openMuseum(mc.slug, {}); return; }
              openArt({ thread: t.id });
            });
          }));
          k += 1;
        });
      });
    if (total > 13) { finderFound.appendChild(el("p", "finder-group finder-foot", "13 of " + total.toLocaleString("en") + " — add a word")); }
  }

  // Before a word is typed: eight works dealt from the longest journeys.
  function dealFound() {
    finderFound.textContent = "";
    showFinding(null);
    finderSaid.textContent = "";
    // On Collages and Architecture, every mark of the layer as a list first (WCAG 2.5.1):
    // a place on the far side of the globe is a press away, not a drag round to it.
    var listed = 0;
    if (layerOn === "collages" || layerOn === "architecture") {
      var ours = cities.filter(function (c) { return c.layer === layerOn && !c.inTown && c.el; });
      if (ours.length) {
        finderHead((layerOn === "collages" ? "Collages on the globe · " : "Architecture on the globe · ") + ours.length);
        // Its category (KINDS.md), so the categories' grouping keeps it whole: a collage is a work.
        finderFound.lastChild.dataset.kinds = layerOn === "collages" ? "work" : "building";
        ours.forEach(function (c) {
          finderFound.appendChild(foundLine(listed, function (b) {
            b.appendChild(el(c.work ? "i" : "span", "", c.title));
            if (c.where) { b.appendChild(document.createTextNode(" · " + c.where)); }
            b.addEventListener("click", function () {
              closeFinder();
              if (flying) { return; }
              if (c.open) { c.open(); } else if (place) { hopTo(c); } else { settleSwing(); goDown(c); }
            });
          }));
          listed += 1;
        });
      }
    }
    var j = (artInfo && artInfo.j) || [];
    var pool = j.slice(0, 144), dealt = [];
    while (pool.length && dealt.length < 8) {
      var w = finding.byId[pool.splice(Math.floor(Math.random() * pool.length), 1)[0]];
      if (w) { dealt.push(w); }
    }
    finderHead("Dealt from the longest journeys");
    dealt.forEach(function (w, k) { finderFound.appendChild(foundWork(w, k)); });
  }

  function openFinder() {
    // Search opens on every layer (7 Oct 2026), and from a reading whose globe is enlarged (8 Oct 2026).
    if (!ARTWORKS || !finderEl || flying || (place && !grown)) { return; }
    finderEl.hidden = false;
    finder.open = true;
    if (artFind) { artFind.setAttribute("aria-expanded", "true"); }
    // As it was left: the same words, the same place in the list.
    showFinding(finder.kept || null);
    if (finder.scroll) { finderEl.scrollTop = finder.scroll; }
    if (!finding) { finderSaid.textContent = "Reading the works…"; }
    Promise.all([readFinding(), readTowns()]).then(function () {
      if (!finder.open) { return; }
      if (!finding) { finderSaid.textContent = "The works could not be read just now."; return; }
      if (finder.dealt && (finder.dealtOn === layerOn || (finderField && fold(finderField.value).trim()))) { return; }
      finder.dealt = true;
      finder.dealtOn = layerOn;
      // Words typed while the works were still being read are the search.
      if (finderField && fold(finderField.value).trim()) { showFound(findIn(finderField.value)); }
      else { dealFound(); }
    });
  }

  function closeFinder() {
    if (!finderEl || finderEl.hidden) { return; }
    finder.scroll = finderEl.scrollTop;
    finder.kept = finder.found;
    finderEl.hidden = true;
    finder.open = false;
    showFinding(null);
    if (artFind) { artFind.setAttribute("aria-expanded", "false"); }
  }

  /* What Find has found, lit on the globe: its cities' tiles at the top and
     their diamonds ringed, the rest let down. */
  function showFinding(lit) {
    finder.found = lit;
    if (lit) { land.dataset.finding = "true"; } else { delete land.dataset.finding; }
    cities.forEach(function (c) {
      if (!c.town) { return; }
      var on = !!(lit && lit[c.town.key]);
      if (on !== !!c.el.dataset.found) {
        if (on) { c.el.dataset.found = "true"; } else { delete c.el.dataset.found; }
      }
    });
    marksDirty = true;
  }

  if (artFind) {
    artFind.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    artFind.addEventListener("click", function () { if (finder.open) { closeFinder(); } else { openFinder(); } });
  }
  if (finderEl) {
    finderEl.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    finderEl.addEventListener("wheel", function (event) { event.stopPropagation(); }, { passive: true });
    // A search is a state of the page: never a submitted form, which would
    // change the address.
    finderEl.addEventListener("submit", function (event) {
      event.preventDefault();
      if (finderField) { finderField.blur(); }
    });
    var findWait = 0;
    if (finderField) {
      finderField.addEventListener("input", function () {
        window.clearTimeout(findWait);
        findWait = window.setTimeout(function () {
          if (!finding) { return; }
          var text = finderField.value;
          if (!fold(text).trim()) { dealFound(); return; }
          showFound(findIn(text));
          finderEl.scrollTop = 0;
        }, 233);
      });
    }
    // On a desktop, typing a letter while it is open goes into the field.
    document.addEventListener("keydown", function (event) {
      if (!finder.open || !finderField || event.ctrlKey || event.metaKey || event.altKey) { return; }
      // Space presses the row or line that has the focus; it is not a word.
      if (event.key.length !== 1 || event.key === " " || document.activeElement === finderField) { return; }
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") { return; }
      // Only from Find itself, or from nowhere in particular (WCAG 2.1.4): a letter
      // typed on a button elsewhere is not taken into the search.
      var fa = document.activeElement;
      if (fa && fa !== document.body && fa !== document.documentElement && !finderEl.contains(fa)) { return; }
      finderField.focus();
    });
  }

  /* ---- the passing journey -------------------------------------------------

     By chance: on the Artworks layer the company rests, and in its slot —
     after its 34 to 89 s of empty world, and only when nobody has touched
     anything for a while — one travelled work draws its journey in tiles,
     holds, and goes out tile by tile. No words. Pressing its lit head opens
     it. */

  var PASS_LIT = Math.pow(PHI, 4) * 1000, PASS_HOLD = Math.pow(PHI, 3) * 1000, PASS_OUT = Math.pow(PHI, 3) * 1000;

  function stepPassing(now) {
    if (passing) {
      if (passing.at && now - passing.at > PASS_LIT + PASS_HOLD + PASS_OUT) { endPassing(now); }
      return;
    }
    if (!castNext) { castNext = now + 8000 + Math.random() * 13000; }
    if (now < castNext || now - lastTouch < SWING_IDLE || !artInfo || !artInfo.j || !artInfo.j.length) { return; }
    var id = artInfo.j[Math.floor(Math.random() * artInfo.j.length)];
    var mine_ = passing = { id: id, at: 0, legs: null, head: null };
    readArt("histories/" + id + ".json").then(function (h) {
      if (passing !== mine_) { return; }
      var legs = h ? legsOf(stopsOf(h).stops) : [];
      if (!legs.length) { passing = null; castNext = performance.now() + 5000; return; }
      mine_.tone = stopTone((h.c && h.c[0]) || LIGHT);
      mine_.legs = legs;
      mine_.at = performance.now();
    });
  }

  function endPassing(now) {
    passing = null;
    castNext = now + (CAST_GAP[0] + Math.random() * (CAST_GAP[1] - CAST_GAP[0])) * 1000;
    tilesDirty = true;
  }

  function passingRuns(runs, t) {
    var p = passing, count = p.legs.length, age = t - p.at;
    var lit = Math.min(1, age / PASS_LIT) * count;
    var gone = Math.max(0, (age - PASS_LIT - PASS_HOLD) / PASS_OUT) * count;
    p.head = null;
    p.legs.forEach(function (leg, k) {
      var q = Math.max(0, Math.min(1, lit - k)), g = Math.max(0, Math.min(1, gone - k));
      if (q <= 0 || g >= 1) { return; }
      var head = legRuns(runs, leg, p.tone, 2, q, leg.broken, g);
      if (head) { p.head = head; }
    });
  }

  // Its lit head pressed: that work's history.
  function pressPassing(x, y) {
    var h = passing && passing.head;
    if (!ARTWORKS || place || flying || !h || Math.abs(h.x - x) > CELL_PX * 1.5 || Math.abs(h.y - y) > CELL_PX * 1.5) { return false; }
    var id = passing.id;
    endPassing(performance.now());
    openArt({ work: id });
    return true;
  }

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
      // Pointed at, it scrambles and settles (its name is its aria-label).
      el.addEventListener("pointerenter", function (event) {
        if (event.pointerType === "mouse") { scramble(el, oneOf(["decode", "type"]), 0, 420); }
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

  // The body of the globe, by what each place is made of (earth-body.js);
  // until it has come, or where it cannot, the dark body of before.
  if (DIRT_LOOK && window.EarthBody) {
    EarthBody.start(Number(MONTH)).then(function (ok) {
      if (!ok) { return; }
      var body = EarthBody.canvas();
      body.className = "world world-body";
      body.setAttribute("aria-hidden", "true");
      canvas.parentNode.insertBefore(body, canvas);
      drawn.w = 0;
    });
  }

  Promise.all([read("../works.json"), read("land.json"), read("earth.json"),
               read("tones.json"), readTile("dirt-land.png"), readTile("dirt-sea.png"),
               read("architecture.json").catch(function () { return { buildings: [] }; }),
               read("museums.json").catch(function () { return { museums: [] }; }),
               readTile("earth-dirt/earth-dirt-" + MONTH + ".png"), readTile("earth-dirt/earth-palette-" + MONTH + ".png")])
    .then(function (all) {
      mine = all[0];
      supply = all[1];
      readEarth(all[2]);
      readTones(all[3]);
      dirt.land = all[4];
      dirt.sea = all[5];
      architecture = all[6];
      museums = all[7];
      dirt.earth = all[8];
      dirt.pal = all[9];

      vocabulary = readVocabulary();
      if (!vocabulary.length) { throw new Error("the works carry no terms"); }

      survey();
      grow();
      loading.remove();
      stopPrimordial();
      geometry();

      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(geometry);
      }

      // The creature is not on the globe. It is waiting in the cities, and
      // it is read and wired here so that going down into one shows it at
      // once rather than building it on the way in.
      readParts();
      wireParts();
      land.dataset.at = "globe";

      // The world opens looking at the library — the one place on it that is
      // not a collage, and the one the plays are in — so there is somewhere
      // to go rather than an ocean to look at.
      var first = null;
      cities.forEach(function (city) {
        if (!first || city.stage) { first = city; }
      });
      if (first) {
        spin = wanted = first.lon;
        lean(first.lat - LOOK);
        beast.lat = goal.lat = first.lat;
        beast.lon = goal.lon = first.lon;
      } else {
        var start = Math.floor(Math.random() * vocabulary.length);
        standOn(start);
        beast.lat = goal.lat;
        beast.lon = goal.lon;
        spin = wanted = beast.lon;
      }

      requestAnimationFrame(frame);

      // The Museums layer's cities, when it was this viewer's last: read once
      // the world is up, so the first paint waits on none of it.
      land.dataset.layerOn = layerOn;
      measureSafe();
      if (layerOn === "museums") {
        (window.requestIdleCallback || function (f) { return window.setTimeout(f, 300); })(museumsLayer);
      }
      if (layerOn === "studios") { museumsLayer(); studiosLayer(); }
      else if (layerOn !== "museums") { museumsLayer(); }   // Search is on every layer from the start

      // An old link to the works page, forwarded here.
      followHash();
      window.setTimeout(readAhead, 1200);
      // And ask the telescope for its photographs.
      readHubble();
    })
    .catch(function (error) {
      // It may already have been taken out of the page by then, so the
      // console is where this actually has to go.
      loading.textContent = "The world could not be read (" + error.message + ").";
      window.console.error("the world did not come up:", error && error.stack);
    });
})();
