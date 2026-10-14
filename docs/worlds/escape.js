/* The way off a world.

   Worlds is about finding the way off each world and on to the next, and
   the way off is made of what each world really is. The physics is real,
   simplified; the numbers are the ones mission planners start from.

   The Earth holds you with its gravity and its air. Getting to orbit costs
   about 9.4 km/s with the losses to gravity and drag; the Earth's own spin
   gives back up to 0.465 km/s at the equator (less by the cosine of the
   latitude), which is why launch sites sit as near the equator as their
   countries reach. From orbit, Mars is 3.6 km/s more, and 0.6 km/s to come
   down through its thin air. You launch from a real launch site, which means
   holding the country it is in, and only in the window: a Hohmann transfer
   takes 259 days, so Mars must be about 44 degrees ahead of the Earth when
   you leave, which comes round every 26 months. The propellant is bought
   with marks, by the rocket equation: the launch mass is the payload times
   e to the (delta-v over exhaust speed).

   Mars has no one to buy from. Its way off is made there: water ice from
   its caps and the ice under its northern plains, with power from the sun
   (half of what the Earth gets) to split it and turn the carbon dioxide air
   into methane and oxygen. The dust storms of its southern summer dim the
   sun. Its pull is weaker (4.1 km/s to orbit, 0.241 km/s back from its
   spin), and the great volcanoes stand high above most of its thin air.
   Home to the Earth is 2.3 km/s more, in a window when the Earth is about
   75 degrees behind Mars.

   A house may wager across to another world only once it has made the
   journey there itself. */

(function () {
  "use strict";

  var RAD = Math.PI / 180, G0 = 9.80665, PAYLOAD = 20;   // tonnes: a crewed lander and its return craft
  var TURN_DAYS = 30;

  // Mean orbits, as the solar system view draws them (J2000 longitude, degrees a day).
  var ORBIT = { earth: { L0: 100.46, n: 0.98560910, a: 1.0 }, mars: { L0: 355.43, n: 0.52403840, a: 1.524 } };
  function lon(w, day) { var o = ORBIT[w]; return ((o.L0 + o.n * day) % 360 + 360) % 360; }
  function wrap(a) { return ((a + 540) % 360) - 180; }

  // The launch sites of the Earth (those that launch to the east).
  var PORTS = [
    { name: "Guiana Space Centre", place: "Kourou", lat: 5.236, lon: -52.769 },
    { name: "Alcântara", place: "Maranhão", lat: 2.373, lon: -44.396 },
    { name: "Satish Dhawan", place: "Sriharikota", lat: 13.720, lon: 80.230 },
    { name: "Wenchang", place: "Hainan", lat: 19.614, lon: 110.951 },
    { name: "Cape Canaveral", place: "Florida", lat: 28.573, lon: -80.649 },
    { name: "Tanegashima", place: "Kagoshima", lat: 30.400, lon: 130.970 },
    { name: "Naro", place: "Goheung", lat: 34.432, lon: 127.535 },
    { name: "Jiuquan", place: "Gansu", lat: 40.960, lon: 100.290 },
    { name: "Baikonur", place: "Kazakhstan", lat: 45.965, lon: 63.305 },
    { name: "Vostochny", place: "Amur", lat: 51.884, lon: 128.333 },
    { name: "Plesetsk", place: "Arkhangelsk", lat: 62.925, lon: 40.577 },
    { name: "Mahia", place: "New Zealand", lat: -39.262, lon: 177.865 }
  ];

  var ENGINES = [
    { key: "kerosene", name: "Kerosene and oxygen", isp: 311, price: 0.5, dry: 0.10, note: "cheap to buy, heavy to lift" },
    { key: "methane", name: "Methane and oxygen", isp: 340, price: 0.6, dry: 0.10, note: "what Mars can make again" },
    { key: "hydrogen", name: "Hydrogen and oxygen", isp: 420, price: 1.6, dry: 0.18, note: "light, but costly and bulky" }
  ];

  // What Mars gives, region by region: tonnes of propellant a month from its ice,
  // and the high ground where the air is thinnest.
  var ICE = { "Planum Boreum": 8, "Planum Australe": 8, "Vastitas Borealis": 5, "Utopia Planitia": 3, "Arcadia Planitia": 3 };
  var HIGH = { "Olympus Mons": 0.3, "Tharsis Montes": 0.25, "Alba Mons": 0.2, "Elysium Mons": 0.2 };
  var MARS_ISP = 360;

  function Escape(game) {
    this.game = game;
    var s = game.s;
    if (!s.day) { s.day = Date.now() / 86400000 - 10957.5; }
    if (!s.reached) { s.reached = s.houses.map(function () { return ["earth"]; }); }
    if (!s.escape) { s.escape = { stage: "earth", engine: "methane", fuel: 0, transit: null, trips: 0 }; }
    this.e = s.escape;
  }
  Escape.PORTS = PORTS;
  Escape.ENGINES = ENGINES;
  Escape.ICE = ICE;
  Escape.TURN_DAYS = TURN_DAYS;
  Escape.lon = lon;

  /* Where each launch site is on the board: the country it stands in. */
  Escape.locate = function (territoryAt) {
    PORTS.forEach(function (p) { p.id = territoryAt(p.lat, p.lon); });
  };

  Escape.prototype.reached = function (h, w) { return this.game.s.reached[h].indexOf(w) >= 0; };

  /* ---- the window ------------------------------------------------------ */

  // How far the target leads (or trails) the world you are on, against what a Hohmann transfer needs.
  Escape.prototype.window = function (from, day) {
    day = day === undefined ? this.game.s.day : day;
    var ideal = from === "earth" ? 44 : -75;
    var phase = from === "earth" ? wrap(lon("mars", day) - lon("earth", day)) : wrap(lon("earth", day) - lon("mars", day));
    var off = wrap(phase - ideal);
    var next = 0;
    if (Math.abs(off) > 8) {
      for (var t = 1; t <= 40; t += 1) {
        var d = day + t * TURN_DAYS;
        var ph = from === "earth" ? wrap(lon("mars", d) - lon("earth", d)) : wrap(lon("earth", d) - lon("mars", d));
        if (Math.abs(wrap(ph - ideal)) <= 8) { next = t; break; }
      }
    }
    return { phase: phase, ideal: ideal, off: off, open: Math.abs(off) <= 25, best: Math.abs(off) <= 8, next: next,
             // Leaving outside the best of the window costs more: a steeper, faster transfer.
             // While it is shut, a plan is priced at the window's best, when you can go.
             extra: Math.abs(off) <= 25 ? Math.max(0, Math.abs(off) - 8) * 0.06 : 0 };
  };

  /* ---- off the Earth --------------------------------------------------- */

  Escape.prototype.portsHeld = function (h) {
    var g = this.game;
    return PORTS.filter(function (p) { return p.id >= 0 && g.owner("earth", p.id) === h; });
  };

  Escape.prototype.earthPlan = function (port, engineKey) {
    var eng = ENGINES.filter(function (x) { return x.key === engineKey; })[0] || ENGINES[1];
    var w = this.window("earth");
    var spin = 0.465 * Math.cos(port.lat * RAD);
    var dv = 9.4 - spin + 3.6 + 0.6 + w.extra;
    var ve = eng.isp * G0 / 1000;
    var mass = PAYLOAD * Math.exp(dv / ve) * (1 + eng.dry);
    return { port: port, engine: eng, dv: dv, spin: spin, window: w, mass: mass, cost: Math.round(mass * eng.price) };
  };

  Escape.prototype.bestEarthPlan = function (h, engineKey) {
    var me = this, best = null;
    this.portsHeld(h).forEach(function (p) {
      var plan = me.earthPlan(p, engineKey);
      if (!best || plan.cost < best.cost) { best = plan; }
    });
    return best;
  };

  Escape.prototype.launchFromEarth = function (h, plan) {
    var g = this.game, s = g.s, house = s.houses[h];
    if (this.e.stage !== "earth" || !plan || !plan.window.open || house.treasury < plan.cost) { return false; }
    if (g.owner("earth", plan.port.id) !== h) { return false; }
    house.treasury -= plan.cost;
    this.e.stage = "to-mars";
    this.e.transit = { from: "earth", to: "mars", depart: s.day, arrive: s.day + 259, port: plan.port.name };
    g.say("You launched from " + plan.port.name + " on " + plan.engine.name.toLowerCase() + ", " + Math.round(plan.mass) +
      " tonnes at lift-off, for " + plan.cost + " marks. Mars in 259 days.", h);
    return true;
  };

  /* ---- on Mars ----------------------------------------------------------- */

  Escape.prototype.land = function (h, w, id) {
    var g = this.game, s = g.s;
    if (this.e.stage !== "land-" + w) { return false; }
    var o = g.owner(w, id);
    if (o >= 0 && o !== h) { return false; }
    s.hold[w][id] = h;
    s.garrison[w][id] = Math.max(s.garrison[w][id], 25);
    if (s.reached[h].indexOf(w) < 0) { s.reached[h].push(w); }
    this.e.transit = null;
    if (w === "mars") {
      this.e.stage = "mars";
      g.say("You came down through the thin air onto " + g.territory(w, id).name + ". The crossing to Mars is open to you now.", h);
    } else {
      this.e.stage = "done";
      this.e.trips += 1;
      g.say("You came home to " + g.territory(w, id).name + ". You have found the way between worlds.", h);
      if (s.winner === -1) { s.winner = h; }
    }
    return true;
  };

  // Mars's solar longitude (its season): 0 at its northern spring, the dust storms from 180 to 330.
  Escape.prototype.season = function (day) {
    var ls = ((lon("mars", day === undefined ? this.game.s.day : day) - 85) % 360 + 360) % 360;
    return { ls: ls, storms: ls >= 180 && ls <= 330 };
  };

  // What is held on Mars that can make propellant: ice, and sun to work it.
  Escape.prototype.marsWorks = function (h) {
    var g = this.game, ice = 0, iceNames = [], sun = [];
    g.boards.mars.forEach(function (t, id) {
      if (g.owner("mars", id) !== h) { return; }
      if (ICE[t.name]) { ice += ICE[t.name]; iceNames.push(t.name); }
      if (Math.abs(t.lat) < 35) { sun.push(t.name); }
    });
    var power = Math.min(1, sun.length / 1);
    return { ice: ice, iceNames: iceNames, sun: sun, rate: ice * power };
  };

  Escape.prototype.marsPlan = function (h, id) {
    var g = this.game, t = g.territory("mars", id), w = this.window("mars");
    var dv = 4.1 - 0.241 * Math.cos(t.lat * RAD) - (HIGH[t.name] || 0) + 2.3 + w.extra;
    var need = PAYLOAD * (Math.exp(dv / (MARS_ISP * G0 / 1000)) - 1) * 1.1;
    return { id: id, name: t.name, dv: dv, high: HIGH[t.name] || 0, window: w, need: Math.ceil(need), have: Math.floor(this.e.fuel) };
  };

  Escape.prototype.bestMarsPlan = function (h) {
    var g = this.game, me = this, best = null;
    g.boards.mars.forEach(function (t, id) {
      if (g.owner("mars", id) !== h) { return; }
      var p = me.marsPlan(h, id);
      if (!best || p.need < best.need) { best = p; }
    });
    return best;
  };

  Escape.prototype.launchFromMars = function (h, plan) {
    var g = this.game, s = g.s;
    if (this.e.stage !== "mars" || !plan || !plan.window.open || this.e.fuel < plan.need) { return false; }
    this.e.fuel -= plan.need;
    this.e.stage = "to-earth";
    this.e.transit = { from: "mars", to: "earth", depart: s.day, arrive: s.day + 259, port: plan.name };
    g.say("You lifted off from " + plan.name + " on " + plan.need + " tonnes of propellant made on Mars. The Earth in 259 days.", h);
    return true;
  };

  /* ---- a month passes ---------------------------------------------------- */

  Escape.prototype.month = function (h) {
    var g = this.game, s = g.s, e = this.e;
    s.day += TURN_DAYS;
    var said = [];
    if (e.stage === "mars") {
      var works = this.marsWorks(h);
      if (works.rate > 0) {
        var storm = this.season().storms && Math.random() < 0.4;
        var made = works.rate * (storm ? 0.3 : 1);
        e.fuel += made;
        if (storm) { said.push("A dust storm dimmed the sun; the plant made " + made.toFixed(1) + " tonnes."); }
      }
    }
    if (e.transit && s.day >= e.transit.arrive) {
      e.stage = "land-" + e.transit.to;
      said.push("You have reached " + (e.transit.to === "mars" ? "Mars" : "the Earth") + ". Choose where to come down.");
    }
    said.forEach(function (t) { g.say(t, h); });
    return said;
  };

  window.Worlds = window.Worlds || {};
  window.Worlds.Escape = Escape;
})();
