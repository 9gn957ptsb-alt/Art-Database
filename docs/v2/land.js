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
     placeCities below gives the names out nearest-first and drops the ones
     that would collide; the mark itself is always there to press. */

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
    piece: "folger"
  }, {
    // Where the moving images are, as the library is where the plays are.
    slug: "archive",
    title: "The Archive",
    where: "Austin, Texas",
    lat: 30.2672,
    lon: -97.7431,
    archive: true
  }];

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

  function found() {
    cities.forEach(function (city) {
      if (city.el && city.el.parentNode) { city.el.parentNode.removeChild(city.el); }
    });
    cities = [];
    if (!mine) { return; }

    var hues = workHues();
    var order = 0;

    function raiseCity(city, real) {
      var el = document.createElement("button");
      el.className = "city";
      el.type = "button";
      el.dataset.kind = real ? "landmark" : "work";
      el.innerHTML = '<span class="city-dot" aria-hidden="true"></span>' +
                     '<span class="city-name"></span>';
      el.lastChild.textContent = city.title;
      el.setAttribute("aria-label", "Go down to " + city.title + ", " + city.where);

      city.el = el;
      city.name = el.lastChild;
      el.addEventListener("click", function () { goDown(city); });
      el.addEventListener("pointerdown", function (event) {
        // The stage takes the pointer on its way down, to turn the world
        // with; a press that lands on a city is not a turn, and if the
        // stage captures it the click never reaches the button at all.
        event.stopPropagation();
      });
      el.addEventListener("focus", function () {
        // Tabbed to: bring it round and roll to it, without going down into
        // it. Not when it was pressed — a press focuses it too, a moment
        // before the click, and turning the world then would lose the view
        // that coming back up is meant to return to.
        var keyed = true;
        try { keyed = el.matches(":focus-visible"); } catch (e) {}
        if (!keyed) { return; }
        wanted = city.lon;
        lean(city.lat - LOOK);
      });
      cities.push(city);
      land.appendChild(el);

      // They come up one after another rather than all at once.
      order += 1;
      var mine_ = order;
      window.setTimeout(function () { el.dataset.up = "true"; }, 300 + mine_ * 150);
    }

    // The collages, each in the place the artist put it.
    WHERE.forEach(function (spot) {
      var work = null;
      mine.works.forEach(function (w) { if (w.slug === spot.slug) { work = w; } });
      if (!work) { return; }
      raiseCity({
        work: work, slug: work.slug, title: work.title, where: spot.where,
        lat: spot.lat * RAD, lon: wrap(spot.lon * RAD),
        hue: hues[work.slug]
      }, false);
    });

    // And the places that are places rather than collages.
    LANDMARKS.forEach(function (mark) {
      raiseCity({
        work: null, slug: mark.slug, title: mark.title, where: mark.where,
        lat: mark.lat * RAD, lon: wrap(mark.lon * RAD),
        stage: mark.stage, piece: mark.piece, archive: mark.archive, real: true,
        // A library is stone. It takes the hue of whichever collage it is
        // nearest — it stands four streets from two of them — and then
        // almost none of it.
        hue: hues[nearWork(mark)] || 0.09
      }, true);
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

  function placeCities() {
    /* Every mark is exactly where its place is: the middle of the dot is
       the projection of the real latitude and longitude, and nothing pushes
       it anywhere else. Three of the places are in Washington, a few
       streets apart, and from orbit they are the same point — so they are
       the same point: their dots lie on top of each other, and it is their
       names that make room, stacked one under another beside the one dot.
       Names are then given out nearest the middle first, and one that would
       print across a name already given out is left off until the world
       moves. */
    var SAME = 14;                      // closer than this is one point
    var LINE = 16;                      // how far a stacked name steps down
    var out = [];

    cities.forEach(function (city, i) {
      var p = project(city.lat, city.lon);
      var el = city.el;
      // Not at the very edge of the world, where a name would hang off the
      // rim into the sky.
      if (p.z <= 0.18 || p.x < 8 || p.x > W - 8 || p.y < 8 || p.y > H - 8) {
        el.style.visibility = "hidden";
        return;
      }
      if (city.dx === undefined || !city.dx) {
        var dot = el.firstChild;
        city.dx = dot.offsetLeft + dot.offsetWidth / 2;
      }
      out.push({ city: city, z: p.z, x: p.x, y: p.y, turn: i, step: 0 });
    });

    // Which marks are one point, and each one's place in its stack: the
    // collages first, in the order they were given, then the landmark.
    out.forEach(function (it, a) {
      var above = 0;
      for (var b = 0; b < a; b += 1) {
        var o = out[b];
        if (Math.abs(o.x - it.x) < SAME && Math.abs(o.y - it.y) < SAME) { above += 1; }
      }
      it.step = above;
    });

    out.forEach(function (it) {
      var el = it.city.el;
      el.style.visibility = "visible";
      el.style.opacity = (INV2 + INV * Math.min(1, (it.z - 0.18) / 0.3)).toFixed(3);
      el.style.transform =
        "translate(" + (it.x - it.city.dx).toFixed(1) + "px," + it.y.toFixed(1) + "px)" +
        " translate(0,-50%)";
      it.city.name.style.transform = it.step ? "translateY(" + (it.step * LINE) + "px)" : "";
      it.ly = it.y + it.step * LINE;
    });

    out.sort(function (m, n) {
      return (Math.abs(m.x - cx) + Math.abs(m.ly - H * 0.5)) -
             (Math.abs(n.x - cx) + Math.abs(n.ly - H * 0.5));
    });

    // Each name goes to the right of its dot if there is room, to the left
    // if there is not, and is left off only when neither side is clear.
    var taken = [];
    function free(x0, x1, y) {
      for (var k = 0; k < taken.length; k += 1) {
        var was = taken[k];
        if (x0 < was.x1 && was.x0 < x1 && y - 8 < was.y + 8 && was.y - 8 < y + 8) {
          return false;
        }
      }
      return true;
    }
    out.forEach(function (it) {
      var el = it.city.el;
      var wide = (it.city.name.offsetWidth || 90) + 18;
      // Right, then left, then a line up or down on either side — the
      // dot never moves, only where its name is written beside it.
      var side = null, lift = 0;
      var tries = [0, -LINE, LINE, -2 * LINE, 2 * LINE];
      for (var t = 0; t < tries.length && !side; t += 1) {
        var y = it.ly + tries[t];
        if (free(it.x, it.x + wide, y)) { side = "right"; lift = tries[t]; }
        else if (free(it.x - wide, it.x, y)) { side = "left"; lift = tries[t]; }
      }
      if (side) {
        taken.push({ x0: side === "right" ? it.x : it.x - wide,
                     x1: side === "right" ? it.x + wide : it.x, y: it.ly + lift });
      }
      var shift = it.step * LINE + lift;
      it.city.name.style.transform = shift ? "translateY(" + shift + "px)" : "";
      var left = side === "left";
      if ((el.dataset.side === "left") !== left) {
        if (left) { el.dataset.side = "left"; } else { delete el.dataset.side; }
      }
      if (left) {
        // Mirrored: the dot is now the last thing in the mark, so the mark
        // is put down with its right-hand dot on the place.
        el.style.transform =
          "translate(" + (it.x - el.offsetWidth + it.city.dx).toFixed(1) + "px," +
          it.y.toFixed(1) + "px) translate(0,-50%)";
      }
      // "inherit", never "visible": a child set to visible stays visible
      // when its city is hidden, which left names hanging in the sky after
      // the place they belonged to had turned away.
      // A world far off carries its dots and not its names; they come back
      // as it comes in.
      if (R < base0 * INV2) { side = null; }
      it.city.name.style.visibility = side ? "inherit" : "hidden";
    });
  }

  /* The flight. Nothing is torn down and nothing is built: the sphere grows
     under you until the city you pressed is the ground you are standing on,
     and shrinks back the same way. */

  function goDown(city) {
    if (flying || place) { return; }
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
    flyTo = CITY_ZOOM;
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
    hideGraze();
    closeDeck();
    passage(oneOf(["edges", "corner"]), [cityTone(city), LIGHT, LILAC], FLY * 0.9, from.y);
  }

  function comeUp() {
    if (flying || !place) { return; }
    stopTheatre();
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
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
    passage(oneOf(["edges", "center", "rows"]), [LIGHT, LILAC, cityTone(place)], FLY * 0.9);
  }

  function arrive() {
    land.dataset.at = "city";
    pulse(W / 2, H * 0.62, [cityTone(place), LIGHT], 0.8, Math.max(W, H) * INV);
    banner.hidden = false;
    bannerCity.textContent = place.title;
    bannerCity.setAttribute("aria-label", place.title);   // its name, while the letters settle
    bannerUnder.textContent = place.where || "";
    bannerCity.disabled = !place.work;
    scramble(bannerCity, "decode", 120, 760);
    scramble(bannerUnder, "type", 380, 640);
    creature.hidden = !CREATURE;

    beast.lat = goal.lat = place.lat;
    beast.lon = goal.lon = place.lon;

    // The creature keeps to this work's own things: what it finds underfoot
    // here are the objects that collage is made of, and nothing else.
    weave({ lat: place.lat, lon: place.lon });

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
  }

  function leave() {
    stopTheatre();
    stopArchive();
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
    cx = half + seat.dx * W * (1 - down);
    var orbit = orbitFor(R) + seat.dy * H;
    // Where the city is, at the lean we have now: dead centre once the lean
    // has arrived at its latitude, and travelling there smoothly before.
    var ground = H * 0.62 + Math.sin(focus.lat - tilt) * R;
    cy = orbit + (ground - orbit) * down;
  }

  function geometry() {
    // Every pixel the screen has, up to three to one — a phone's full
    // density, and a 4K monitor's at two. It used to stop at two.
    dpr = Math.min(window.devicePixelRatio || 1, 3, dprCap);
    W = stage.clientWidth;
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
    weave(place ? { lat: place.lat, lon: place.lon } : null);
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
    var pw = Math.round(W * dpr), ph = Math.round(H * dpr);
    if (tilesCanvas.width !== pw || tilesCanvas.height !== ph) {
      tilesCanvas.width = pw; tilesCanvas.height = ph; tilesDirty = true;
    }
    if (!waves.length && !notes.length && !trail.length && !tilesDirty) { return; }
    var g = tilesCtx;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
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
    tilesDirty = waves.length > 0 || notes.length > 0 || !!ringNow;
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

  var dirt = { land: null, sea: null };
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
        done({ n: c.width, px: x.getImageData(0, 0, c.width, c.height).data });
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
  function weave(at) {
    var lat = [];
    var lon = [];
    var salt = [];

    var rnd = seedFrom("mina mina", 3);

    var k = at ? 1 / zoom : 1;                 // every angle, at this height
    var spanLat = at ? 0.115 : 0;
    var spanLon = at ? 0.115 / Math.max(0.2, Math.cos(at.lat)) : 0;

    // Strands running down the world. Even steps in latitude are even steps
    // along the surface, so these keep their spacing wherever they fall.
    // Half again and more: phi times the threads of before, because the
    // globe is phi times more see-through than it was (see the patches), so
    // there is as much more of the land and sea as there is less of each dot.
    var strands = Math.round((at ? 150 : 420) * PHI);
    var down = at ? 150 : 320;
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
    var rings = Math.round((at ? 110 : 240) * PHI);
    var round = at ? 180 : 520;
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
      var deep = inland(lat[k], lon[k]);
      wGain[k] = deep ? 0.25 + 0.75 * deep : 0;

      // Which land it is standing on, straight off the map. What colour that
      // land is was settled once, in remass, by which of his places is
      // nearest it — so a boundary between two colours is a coastline rather
      // than a line drawn halfway between two cities, which is what makes a
      // continent read as one thing rather than a pastel patchwork.
      wTone[k] = deep ? ownerAt(lat[k], lon[k]) : 0;

      var tile = deep ? dirt.land : dirt.sea;
      if (tile) {
        var u = cellOf(tile.n, (lon[k] / TAU + 0.5) * DIRT_ROUND * tile.n * near_);
        var v = cellOf(tile.n, (lat[k] / Math.PI + 0.5) * DIRT_DOWN * tile.n * near_);
        var o = (v * tile.n + u) * 4;
        var size = Math.round(tile.px[o + 3] / 85);
        wSize[k] = size;
        if (size) {
          var rgb = tile.px[o] + "," + tile.px[o + 1] + "," + tile.px[o + 2];
          if (inkAt[rgb] === undefined) { inkAt[rgb] = wInks.length; wInks.push(rgb); }
          wInk[k] = inkAt[rgb];
        }
      } else {
        wSize[k] = 255;          // no soil to read: woven as it was before
      }
    }

    woven.spin = null;      // it will have to be drawn again
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
  function drawCloth() {
    [cloth, cloth2].forEach(function (c) {
      if (c.width !== canvas.width || c.height !== canvas.height) {
        c.width = canvas.width;
        c.height = canvas.height;
      }
    });

    var cosS = Math.cos(spin);
    var sinS = Math.sin(spin);
    // Off the globe's own radius, not this one's: the cloth is rewoven at
    // the right density for wherever we are standing, so a dot in it should
    // still be the size a dot is.
    // And it grows with the world: a near world is woven in bigger dots, so
    // the land keeps its presence however close it comes.
    var grain = Math.max(1, baseR / 440);
    var loose = turning ? 2 : 1;

    // The strands down onto one surface, the strands round onto the other.
    [[wctx, 0, wSplit], [wctx2, wSplit, wCount]].forEach(function (family) {
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
          a = gain ? (0.74 + 0.26 * lit) * (0.82 + 0.18 * gain)
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
    paintSphere(sctx, lit);
    // The grit is baked into the body of the globe when it is painted, not
    // laid over it every frame; it only changes when the globe does.
    grit(sctx, nearness());
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

  function paint(now) {
    erupt(now);

    // What the creature stands on is the brightest part of the sphere.
    var lit = project(beast.lat, beast.lon);
    if (!flying && !moving() && sphereStale(lit)) { drawSphere(lit); }
    // A swing magnifies what is drawn, and a world coming in from far off
    // grows six times over: past phi times, it is woven again at the size
    // it has got to, a few times on the way in, so it never goes to blocks.
    if (moving() && drawn.r && (R / drawn.r > PHI || R / drawn.r < INV || !covered()) &&
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
    var body = flux(now, FLUX_BODY, 0);
    // The threads, which carry the land, breathe higher up the scale than
    // the body does — between 1/phi and all the way there — so the land
    // has presence while the sphere under it stays glass.
    var down = flux(now, FLUX_DOWN, GOLDEN, INV, 1);
    var round = flux(now, FLUX_ROUND, 2 * GOLDEN, INV, 1);

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
    gctx.globalAlpha = down;
    gctx.drawImage(cloth, 0, 0, W, H);
    gctx.globalAlpha = round;
    gctx.drawImage(cloth2, 0, 0, W, H);
    gctx.restore();

    // The patches and the pulse, as a mask: kept where it is opaque, faded
    // where it is not.
    veil(now);
    gctx.globalAlpha = 1;
    gctx.globalCompositeOperation = "destination-in";
    gctx.imageSmoothingEnabled = true;
    if (moving() && veilSeen.r) {
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
    var mist = INV3 + (INV - INV3) * near;          // how much of it is blurred
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
    living(now);
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
    var block = Math.max(3, Math.min(9, Math.round(R / 64)));
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
          var nq = Math.min(3, Math.floor(night * 3 + dither)) / 3;
          var dusk = Math.max(0, 1 - Math.abs(lit + 0.02) / 0.07);
          var cloud = cloudAt(lat, lon);
          var cq = Math.min(3, Math.floor(cloud * 3 + dither * 0.999)) / 3;
          if (cloud > 0.9 && storms.length < 96) { storms.push(i, j); }
          var an = Math.max(0.3 * nq, 0.16 * (dusk > 0.5 ? 1 : dusk > 0.2 ? 0.5 : 0));
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
    cities.forEach(function (c) { nightLights.push({ lat: c.lat, lon: c.lon, b: 1.5, k: Math.random() * TAU, big: true }); });
  }

  var LAMP = ["#7b5a2c", "#d9a64e", "#fff1c4"];
  function drawLights(now, block, fade) {
    if (!nightLights) { if (earthBits && cities.length) { makeLights(); } else { return; } }
    var lamp = Math.max(2, Math.round(block * 0.65));
    ctx.save();
    ctx.globalAlpha = fade;
    nightLights.forEach(function (l) {
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
      stepHerd(now, dt);
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
    return Math.max(0, Math.min(1, (zoom - 1) / Math.max(0.001, CITY_ZOOM - 1)));
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

  /* A tap on the empty sky bounces the view somewhere new — near or far —
     which is also the way out of any view that has stopped being useful. */
  function pressSky(x, y) {
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
    if (place || flying || swing || deckMode) { return; }
    event.preventDefault();
    var step = event.ctrlKey ? 0.012 : 0.0016;         // a trackpad pinch comes as ctrl+wheel
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

  /* As sharp as the screen can go, and as sharp as this machine can keep
     up with. It starts at every pixel the screen has — up to three to one —
     and watches itself: if it cannot hold about forty-five frames a second
     over a couple of seconds of ordinary looking, it drops half a step of
     density and looks again, down to one to one. It never climbs back, so
     it settles rather than hunting. */
  var dprCap = 3;
  var pace = { from: 0, frames: 0 };

  function sharpen(now) {
    if (flying || moving() || deckMode || turning || document.hidden) { pace.from = 0; return; }
    if (!pace.from) { pace.from = now; pace.frames = 0; return; }
    pace.frames += 1;
    var span = now - pace.from;
    if (span < 2000) { return; }
    var fps = pace.frames * 1000 / span;
    pace.from = 0;
    var have = Math.min(window.devicePixelRatio || 1, 3, dprCap);
    if (fps < 45 && have > 1) {
      dprCap = Math.max(1, have - 0.5);
      geometry();
    }
  }

  function frame(now) {
    autoSwing(now);
    stepSwing(now);
    sharpen(now);
    // While collages are laid over it the world holds still: it is behind
    // them, out of focus, and every frame spent on it is a frame the blur
    // has to be worked out again for nothing.
    if (deckMode && !flying) { requestAnimationFrame(frame); return; }

    // Going down into a city, or coming back up out of one. The sphere grows
    // or shrinks and its framing travels with it; everything else on here is
    // projected through the same two numbers and follows without being told.
    if (flying) {
      // A frame's clock can read a few milliseconds before the press that
      // started the flight; before its start the flight is at its start.
      var went = Math.max(0, Math.min(1, (now - flyAt) / FLY));
      var easing = 1 - Math.pow(1 - went, 3);
      zoom = flyFrom + (flyTo - flyFrom) * easing;
      lean(leanFrom + (leanTo - leanFrom) * easing);
      reframe();
      if (went >= 1) {
        flying = false;
        if (flyTo > 1) { arrive(); } else { leave(); }
        onward();
      }
    }

    // The world only turns when it is turned: by a drag, or by tabbing to a
    // word. It used to swing round to follow the creature, which meant every
    // word on it was always drifting.
    spin += shortest(spin, wanted) * (still ? 1 : (flying ? 0.16 : INV5));

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

    // Up on the globe: the world, its words and its cities, and none of the
    // rest of it — not hidden but not running, which is most of what this
    // split is for. The words are left alone in a city too, because
    // replanting them at seven times the size would churn the whole
    // vocabulary every frame for something nobody can see.
    if (!place) { placeWords(); }
    if (!place || flying) { placeCities(); }
    if (!place || flying) { requestAnimationFrame(frame); return; }

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
    if (fingers[event.pointerId]) {
      fingers[event.pointerId].x = event.clientX;
      fingers[event.pointerId].y = event.clientY;
    }
    if (pinch) {
      var now2 = pinchState();
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
    // would only walk you off the edge of it.
    if (place) { return; }
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
        if (Object.keys(fingers).length < 2) { pinch = null; delete stage.dataset.turning; }
        return;
      }
      if (panning && event.pointerId === panning.id) {
        var tap = panning.moved < 6 && performance.now() - panning.at < 450;
        panning = null;
        delete stage.dataset.turning;
        if (tap && name === "pointerup") { pressSky(event.clientX, event.clientY); }
        return;
      }
      if (!turning || event.pointerId !== turning.id) { return; }
      var was = turning;
      turning = null;
      delete stage.dataset.turning;

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
        if (reach) { squash(where.x, where.y, reach); }
      }
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
  var MAGNETS = "#deck-close, #banner-back, #banner-city, .deal-turn, #hubble, .theatre-step";
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
    bill.style.transform = "translate(-50%," + Math.round(Math.min(H - billH - 12, stageBox.y + sh + 8)) + "px)";
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
  var WORD_HOLD = 4200;               // how long a word has the room to itself
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
    reading.timers.forEach(function (t) { window.clearTimeout(t); });
    if (reading.root.parentNode) { reading.root.parentNode.removeChild(reading.root); }
    reading = null;
  }

  function later(fn, ms) {
    var r = reading;
    var t = window.setTimeout(function () { if (reading === r) { fn(); } }, still ? 0 : ms);
    r.timers.push(t);
  }

  function reveal(node, ms) {
    later(function () { node.dataset.on = "true"; }, ms);
  }

  function readHere(work, city) {
    clearReading();
    var via = cameBy;
    cameBy = null;
    var root = el("div", "read");
    root.appendChild(el("div", "read-wash"));
    var r = reading = { root: root, work: work, city: city, timers: [], held: null, n: 0 };
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
    var t = via ? READ_BEAT * 1.4 : READ_BEAT;
    if (via) { later(function () { say_(via, true); }, 420); }
    reveal(title, t);
    reveal(where, t + READ_BEAT * 0.7);
    reveal(detail, t + READ_BEAT * 1.3);
    if (work.availability) { reveal(price, t + READ_BEAT * 1.9); }
    r.start = t + READ_BEAT * 3.2 + (via ? WORD_HOLD : 0);
    r.n = via ? 1 : 0;
    later(procession, r.start);
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
    later(procession, WORD_HOLD + (r.order.length - r.n < 3 ? 600 : 0));
  }

  function quiet() {
    var old = reading && reading.stage.firstChild;
    if (!old) { return; }
    old.dataset.on = "false";
    window.setTimeout(function () { if (old.parentNode) { old.parentNode.removeChild(old); } }, 700);
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
    if (r.n < r.order.length) { later(procession, READ_BEAT); }
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

  bannerBack.addEventListener("click", function () { comeUp(); });
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
    // Nothing else to put down: Escape is the way back up to the world.
    comeUp();
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

  Promise.all([read("../works.json"), read("land.json"), read("earth.json"),
               read("tones.json"), readTile("dirt-land.png"), readTile("dirt-sea.png")])
    .then(function (all) {
      mine = all[0];
      supply = all[1];
      readEarth(all[2]);
      readTones(all[3]);
      dirt.land = all[4];
      dirt.sea = all[5];

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
