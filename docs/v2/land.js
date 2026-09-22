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
  var seam = document.getElementById("seam");
  var banner = document.getElementById("banner");
  var bannerBack = document.getElementById("banner-back");
  var bannerCity = document.getElementById("banner-city");
  var bannerUnder = document.getElementById("banner-under");
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
  var focus = { lat: 0, lon: 0 };
  var cities = [];
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

  var LANDMARKS = [{
    slug: "folger",
    title: "Folger Shakespeare Library",
    where: "East Capitol Street, Washington",
    lat: 38.8890,
    lon: -77.0028,
    stage: true,                    // the plays are cast and played here
    piece: "folger"
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
        // Bring it round and roll to it, without going down into it.
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
        stage: mark.stage, piece: mark.piece, real: true,
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
    /* Three of his places are in Washington — two collages and the library —
       and at the size the globe is drawn they are the same three pixels. The
       coordinates stay true; the marks are pushed apart on the screen until
       each of them can be pressed, which is a few pixels of lie at a scale
       where a few pixels is a mile. Names are then given out nearest the
       middle first, and one that would print across a name already given up
       is left off until the world moves. */
    var MARK = 34;                      // how far apart two marks must sit
    var out = [];

    cities.forEach(function (city, i) {
      var p = project(city.lat, city.lon);
      var el = city.el;
      if (p.z <= 0.08 || p.x < 8 || p.x > W - 8 || p.y < 8 || p.y > H - 8) {
        el.style.visibility = "hidden";
        return;
      }
      out.push({ city: city, z: p.z, x: p.x, y: p.y, turn: i });
    });

    for (var pass = 0; pass < 5; pass += 1) {
      for (var a = 0; a < out.length; a += 1) {
        for (var b = a + 1; b < out.length; b += 1) {
          var one = out[a], two = out[b];
          var dx = two.x - one.x, dy = two.y - one.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d >= MARK) { continue; }
          if (d < 0.2) {                 // exactly on top: pick a direction
            var th = (one.turn * 2.4 + two.turn) % TAU;
            dx = Math.cos(th); dy = Math.sin(th); d = 1;
          }
          var push = (MARK - d) / 2;
          one.x -= dx / d * push; one.y -= dy / d * push;
          two.x += dx / d * push; two.y += dy / d * push;
        }
      }
    }

    out.forEach(function (it) {
      var el = it.city.el;
      el.style.visibility = "visible";
      el.style.opacity = (INV2 + INV * Math.min(1, (it.z - 0.08) / 0.3)).toFixed(3);
      el.style.transform =
        "translate(" + it.x.toFixed(1) + "px," + it.y.toFixed(1) + "px)" +
        " translate(0,-50%)";
    });

    out.sort(function (m, n) {
      return (Math.abs(m.x - cx) + Math.abs(m.y - H * 0.5)) -
             (Math.abs(n.x - cx) + Math.abs(n.y - H * 0.5));
    });

    var taken = [];
    out.forEach(function (it) {
      var wide = (it.city.name.offsetWidth || 90) + 18;
      var clear = true;
      for (var k = 0; k < taken.length; k += 1) {
        var was = taken[k];
        if (it.x < was.x + was.w && was.x < it.x + wide &&
            it.y - 17 < was.y + 17 && was.y - 17 < it.y + 17) {
          clear = false;
          break;
        }
      }
      if (clear) { taken.push({ x: it.x, y: it.y, w: wide }); }
      it.city.name.style.visibility = clear ? "visible" : "hidden";
    });
  }

  /* The flight. Nothing is torn down and nothing is built: the sphere grows
     under you until the city you pressed is the ground you are standing on,
     and shrinks back the same way. */

  function goDown(city) {
    if (flying || place) { return; }
    place = city;
    focus.lat = city.lat;
    focus.lon = city.lon;
    wanted = city.lon;              // turn the world so the city faces you
    // And roll it until the city's own latitude is the one facing you, which
    // puts the place dead centre however far north or south it is.
    leanWas = tilt;
    leanFrom = tilt;
    leanTo = city.lat;
    flyFrom = zoom;
    flyTo = CITY_ZOOM;
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
    hideGraze();
  }

  function comeUp() {
    if (flying || !place) { return; }
    hold();                         // the walk stops where it is
    hideGraze();
    // Back out to the part of the world you were looking at when you went in.
    leanFrom = tilt;
    leanTo = leanWas;
    flyFrom = zoom;
    flyTo = 1;
    flyAt = performance.now();
    flying = true;
    land.dataset.at = "flying";
  }

  function arrive() {
    land.dataset.at = "city";
    banner.hidden = false;
    bannerCity.textContent = place.title;
    bannerUnder.textContent = place.where || "";
    creature.hidden = false;

    beast.lat = goal.lat = place.lat;
    beast.lon = goal.lon = place.lon;

    // The creature keeps to this work's own things: what it finds underfoot
    // here are the objects that collage is made of, and nothing else.
    weave({ lat: place.lat, lon: place.lon });

    // Whatever is built here is built once and stays built.
    if (place.piece && !spawns.some(function (born) {
      return born.kind === "house" && born.home === place.slug;
    })) {
      houseFor(place);
    }

    place.terms = termsOf(place);
    if (place.terms.length) { standOn(place.terms[0]); }
    creature.dataset.grazing = "true";
    resume();
  }

  function leave() {
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
  function reframe() {
    R = baseR * zoom;
    cx = W / 2;
    var flank = Math.sqrt(Math.max(1, R * R - cx * cx));
    var orbit = H * (1 - 1 / PHI) + flank;
    // Where the city is, at the lean we have now: dead centre once the lean
    // has arrived at its latitude, and travelling there smoothly before.
    var ground = H * 0.62 + Math.sin(focus.lat - tilt) * R;
    var down = Math.max(0, Math.min(1, (zoom - 1) / Math.max(0.001, CITY_ZOOM - 1)));
    cy = orbit + (ground - orbit) * down;
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
    baseR = Math.max(W * 0.90, H * 0.70, 240);
    cx = W / 2;

    // Everything below this latitude is under the bottom of the screen. The
    // projection makes it exact: a point is at height (cy - y) / R when
    // sin(lat - tilt) equals it, so the lowest latitude worth placing a word
    // on is the tilt plus that arcsine, with a little margin. Worked out at
    // the globe's own framing whatever height the view happens to be flown
    // to, because the band is where the words live and the words are the
    // globe's.
    var flank = Math.sqrt(Math.max(1, baseR * baseR - cx * cx));
    // At the resting lean, whatever the world is leaning at now.
    var sunk = Math.max(-1, Math.min(1,
      (H * (1 - 1 / PHI) + flank - H) / baseR));
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
    var x = Math.floor(wrap(lon) / TAU * earth.w) % earth.w;
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
        var lon = (ax + 0.5) / w * TAU;
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
    var x = Math.floor(wrap(lon) / TAU * earth.w) % earth.w;
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
    var step = Math.PI / earth.h;          // one cell of the mask, in radians
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

  var cloth = document.createElement("canvas");
  var wctx = cloth.getContext("2d");
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
    var strands = at ? 150 : 420;
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

    // Strands running round it. Even steps in longitude are shorter steps the
    // nearer the pole, so these gather into a ridge toward the top of the
    // world by themselves — which is the part of her surfaces that does the
    // most work, and here it falls out of the geometry for nothing.
    var rings = at ? 110 : 240;
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
    }

    woven.spin = null;      // it will have to be drawn again
  }

  function clothStale() {
    // Woven loosely while the world is being turned by hand, and again in
    // full the moment it is let go. Half the dots at speed is invisible, and
    // it is the difference between turning the world and dragging it.
    if (woven.loose && !turning) { return true; }
    return woven.spin === null || Math.abs(woven.spin - spin) > 0.0015 ||
           woven.w !== W || woven.h !== H || woven.r !== R;
  }

  /* The whole field, onto its own surface, in runs of one colour: a hundred
     thousand dots is nothing, a hundred thousand changes of fillStyle is the
     whole cost of having a surface at all. */
  function drawCloth() {
    if (cloth.width !== canvas.width || cloth.height !== canvas.height) {
      cloth.width = canvas.width;
      cloth.height = canvas.height;
    }
    wctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    wctx.clearRect(0, 0, W, H);

    var cosS = Math.cos(spin);
    var sinS = Math.sin(spin);
    // Off the globe's own radius, not this one's: the cloth is rewoven at
    // the right density for wherever we are standing, so a dot in it should
    // still be the size a dot is.
    var grain = Math.max(1, Math.round(baseR / 700));
    var loose = turning ? 2 : 1;
    var runs = {};

    for (var k = 0; k < wCount; k += loose) {
      // The same projection as everything else, with the trigonometry taken
      // out: sin(lon - spin) and cos(lon - spin) from the angle-difference
      // identities, over values worked out when the weave was made.
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
      var a, tone;

      if (gain) {
        // Land: the strands close up, and take the colour of whichever work
        // lies nearest. The further inland, the heavier.
        a = (0.22 + 0.42 * lit) * (0.5 + 1.0 * gain);
        tone = wSalt[k] ? "255,255,255"
             : (wTone[k] && wTones[wTone[k] - 1] ? wTones[wTone[k] - 1] : SEA);
        if (wSalt[k]) { a *= 0.8; }
      } else {
        // Sea: most of the strand is simply not there. An even field of dots
        // over the whole sphere is a texture; open water between the land is
        // what makes it the Earth.
        if ((k & 3) !== 0) { continue; }
        a = (0.035 + 0.075 * lit);
        tone = wSalt[k] ? "255,255,255" : SEA;
      }

      var step = a < 0.04 ? 0 : Math.min(11, Math.round(a * 22));
      if (!step) { continue; }
      var key = tone + "|" + step;
      var run = runs[key] || (runs[key] = []);
      run.push(px, py);
    }

    Object.keys(runs).forEach(function (key) {
      var cut = key.lastIndexOf("|");
      wctx.fillStyle = "rgb(" + key.slice(0, cut) + ")";
      wctx.globalAlpha = Number(key.slice(cut + 1)) / 22;
      var run = runs[key];
      for (var i = 0; i < run.length; i += 2) {
        wctx.fillRect(run[i] | 0, run[i + 1] | 0, grain, grain);
      }
    });
    wctx.globalAlpha = 1;

    woven.spin = spin;
    woven.loose = loose > 1;
    woven.w = W;
    woven.h = H;
    woven.r = R;
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
    if (!flying && sphereStale(lit)) { drawSphere(lit); }

    ctx.clearRect(0, 0, W, H);

    if (flying && drawn.r) {
      // Mid-flight the sphere is not painted again — a hundred thousand dots
      // and seven gradients a frame is not a flight, it is a slideshow. The
      // surface already drawn is magnified about the point being flown to,
      // which is what magnifying actually looks like, and the real thing is
      // laid down once on arrival.
      var grew = R / drawn.r;
      ctx.fillStyle = SKY[2];
      ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(grew, grew);
      ctx.translate(-drawn.cx, -drawn.cy);
      ctx.drawImage(sphere, 0, 0, W, H);
      ctx.restore();
    } else {
      ctx.drawImage(sphere, 0, 0, W, H);
    }

    if (place && !flying) { drawStage(ctx, now); }
    stir(now);
    drawMotes();
    drawRing(now);

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

    // The surface itself: dots, in strands, after Napangardi. Kept on its
    // own canvas because it only changes when the world is turned, and laid
    // over the light at full strength.
    if (clothStale()) { drawCloth(); }
    ctx.globalAlpha = 1;
    ctx.drawImage(cloth, 0, 0, W, H);

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

      // Two things take a word down: going round the edge, and being turned
      // away from you where it stands. The second is what `squash` measures —
      // 1 dead ahead, about 0.45 at the limb where the surface is edge-on —
      // so the more the roundness has distorted a word, the fainter it is.
      // It is also what makes the crowding at the horizon stop shouting.
      var fade = (INV2 + INV * Math.min(1, (p.z - 0.05) / 0.32)) *
                 (0.45 + 0.55 * p.squash);
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

  function frame(now) {
    // Going down into a city, or coming back up out of one. The sphere grows
    // or shrinks and its framing travels with it; everything else on here is
    // projected through the same two numbers and follows without being told.
    if (flying) {
      var went = Math.min(1, (now - flyAt) / FLY);
      var easing = 1 - Math.pow(1 - went, 3);
      zoom = flyFrom + (flyTo - flyFrom) * easing;
      lean(leanFrom + (leanTo - leanFrom) * easing);
      reframe();
      if (went >= 1) {
        flying = false;
        if (flyTo > 1) { arrive(); } else { leave(); }
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
      (tok.a ? " by " + tok.a : "") + ". Opens on Artsy.");

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
           VERB[born.kind] + "; hold it, or press O, to open the work on Artsy.";
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
    kick(p.x, p.y, tones || born.token.c, 18, 5, 2.4);
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

  function drawRing(now) {
    var r = squashRing(now);
    if (!r) { return; }
    ctx.save();
    ctx.strokeStyle = "rgba(27, 29, 36, 0.38)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(squashing.x, squashing.y, r, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.55)";
    ctx.beginPath();
    ctx.arc(squashing.x, squashing.y, r - 2, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function squash(x, y, r) {
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
    // A second finger down means the browser is being pinched, not that the
    // world is being turned. Let go of the turn and the squash and leave the
    // gesture to it, or the world spins while someone is trying to zoom.
    if (turning && event.pointerId !== turning.id) {
      turning = null;
      squashing = null;
      delete stage.dataset.turning;
      return;
    }

    // Only reaches here when the press missed the creature, the card and the
    // token, all of which stop it. So: put down whatever was up.
    if (offering || carrying) { dismiss(); }
    turning = { id: event.pointerId, x: event.clientX, y: event.clientY,
                spin: spin, lean: tilt, moved: 0 };
    squashing = { id: event.pointerId, x: event.clientX, y: event.clientY,
                  since: performance.now() };
    stage.dataset.turning = "true";
    try { stage.setPointerCapture(event.pointerId); } catch (e) {}
  });

  stage.addEventListener("pointermove", function (event) {
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
      if (!turning || event.pointerId !== turning.id) { return; }
      turning = null;
      delete stage.dataset.turning;

      if (squashing && squashing.id === event.pointerId) {
        var reach = squashRing(performance.now());
        var where = squashing;
        squashing = null;
        if (reach) { squash(where.x, where.y, reach); }
      }
    });
  });

  /* ---- what a word is standing on: the artist's works -------------------- */

  function openSeam(index) {
    var ground = vocabulary[index];
    if (!ground) { return; }

    // Opening a word used to send the creature to stand on it as well. The
    // creature is not up here any more, so on the globe a word is a word: it
    // opens what it is written on, and nothing walks anywhere.
    if (place) {
      hold();
      standOn(index);
      walkTimer = window.setTimeout(function () {
        creature.dataset.grazing = "true";
        walkTimer = window.setTimeout(walk, GRAZE_MAX);
      }, still ? 1 : 1800);
    }

    seamWord.textContent = ground.word;
    seamCount.textContent = ground.works.length +
      (ground.works.length === 1 ? " work" : " works");

    seamList.textContent = "";
    ground.works.forEach(function (work) {
      var item = document.createElement("li");
      item.className = "seam-item";

      var link = document.createElement("a");
      link.href = "works.html#" + work.slug;

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

  bannerBack.addEventListener("click", function () { comeUp(); });
  banner.addEventListener("pointerdown", function (event) {
    event.stopPropagation();      // the stage would take the pointer otherwise
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") { return; }
    if (!seam.hidden) { seam.hidden = true; return; }
    if (offering || carrying) { dismiss(); return; }
    if (playing) { curtain = performance.now(); endScene(); strike(); return; }
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
               read("tones.json")])
    .then(function (all) {
      mine = all[0];
      supply = all[1];
      readEarth(all[2]);
      readTones(all[3]);

      vocabulary = readVocabulary();
      if (!vocabulary.length) { throw new Error("the works carry no terms"); }

      survey();
      grow();
      loading.remove();
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
    })
    .catch(function (error) {
      // It may already have been taken out of the page by then, so the
      // console is where this actually has to go.
      loading.textContent = "The world could not be read (" + error.message + ").";
      window.console.error("the world did not come up:", error && error.stack);
    });
})();
