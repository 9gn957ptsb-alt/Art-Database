/* The rules of Worlds.

   Everything is a wager. A territory is held by a house or by no one, and
   holds a garrison of marks. To take it, stake marks from your treasury
   against its garrison: the stake wins with the chance stake / (stake +
   garrison). Won, the territory is yours and part of the stake stays on as
   its garrison. Lost, the stake is gone, and some of it goes to the
   defender's garrison.

   A wager is made from a territory you hold, on one that borders it — across
   land, across a sea lane, or across worlds: every territory borders the
   ground of the other world that lies under it. There is no boundary
   between worlds.

   Each turn every house is paid the yield of all it holds. A house that holds
   nothing is out. A house that holds two fifths of all the yield there is,
   on every world together, has won. */

(function () {
  "use strict";

  var WORLDS = ["earth", "mars"];
  var START_TREASURY = 300, CAPITAL_GARRISON = 60, BASE_INCOME = 10;
  var KEEP_ON_WIN = 0.6, SPOILS_ON_LOSS = 0.3, VICTORY_SHARE = 0.4;

  var HOUSES = [
    { name: "You", color: "#f3c98b", human: true },
    { name: "House Cobalt", color: "#86a3cf" },
    { name: "House Madder", color: "#c97862" },
    { name: "House Verdigris", color: "#7fb59f" }
  ];

  function Game(boards, saved) {
    this.boards = boards;                 // { earth: territories[], mars: [...] }
    if (saved) {
      this.s = saved;
      // A game saved before the houses were recoloured wears today's colours.
      saved.houses.forEach(function (h, i) { if (HOUSES[i]) { h.color = HOUSES[i].color; } });
    } else {
      this.s = { turn: 1, phase: "choose", houses: [], hold: {}, garrison: {}, log: [], winner: -1 };
      var s = this.s;
      HOUSES.forEach(function (h, i) {
        s.houses.push({ id: i, name: h.name, color: h.color, human: !!h.human, treasury: START_TREASURY, alive: true });
      });
      WORLDS.forEach(function (w) {
        var T = boards[w];
        s.hold[w] = T.map(function () { return -1; });
        // No one's ground defends by what lives on it: nations by their
        // people, Mars by almost nothing at all.
        s.garrison[w] = T.map(function (t) { return w === "earth" ? 8 + t.yield * 9 : 2 + t.yield * 3; });
      });
    }
  }

  Game.WORLDS = WORLDS;
  Game.prototype.territory = function (w, id) { return this.boards[w][id]; };
  Game.prototype.owner = function (w, id) { return this.s.hold[w][id]; };
  Game.prototype.house = function (i) { return i >= 0 ? this.s.houses[i] : null; };
  Game.prototype.human = function () { return this.s.houses[0]; };

  Game.prototype.say = function (text, who) {
    this.s.log.unshift({ turn: this.s.turn, text: text, who: who === undefined ? -1 : who });
    if (this.s.log.length > 80) { this.s.log.length = 80; }
  };

  /* The territories that border one: its neighbours on its own world and
     the ground under it on the other. */
  Game.prototype.borders = function (w, id) {
    var t = this.boards[w][id], out = [];
    t.near.forEach(function (j) { out.push({ w: w, id: j }); });
    var other = w === "earth" ? "mars" : "earth";
    (t[other] || []).forEach(function (j) { out.push({ w: other, id: j }); });
    return out;
  };

  /* Where house h can wager on (w, id) from: a territory it holds that borders it. */
  Game.prototype.reachFrom = function (h, w, id) {
    if (this.s.hold[w][id] === h) { return null; }
    var b = this.borders(w, id);
    for (var i = 0; i < b.length; i++) {
      if (this.s.hold[b[i].w][b[i].id] === h) { return b[i]; }
    }
    return null;
  };

  Game.prototype.odds = function (stake, w, id) {
    var g = this.s.garrison[w][id];
    return stake <= 0 ? 0 : stake / (stake + g);
  };

  Game.prototype.begin = function (w, id) {
    var s = this.s, me = this;
    s.hold[w][id] = 0;
    s.garrison[w][id] = CAPITAL_GARRISON;
    this.say("You raise your banner over " + this.territory(w, id).name + ".", 0);
    // The other houses begin on Earth, each well away from the others.
    var E = this.boards.earth, taken = [this.territory(w, id)];
    for (var h = 1; h < s.houses.length; h++) {
      var best = -1, bestScore = -1;
      for (var k = 0; k < E.length; k++) {
        if (s.hold.earth[k] !== -1 || E[k].yield < 6) { continue; }
        var far = Math.min.apply(null, taken.map(function (t) { return arc(t, E[k]); }));
        var score = far + Math.random() * 40;
        if (far > 35 && score > bestScore) { best = k; bestScore = score; }
      }
      if (best < 0) { best = E.findIndex(function (t, k) { return s.hold.earth[k] === -1; }); }
      s.hold.earth[best] = h;
      s.garrison.earth[best] = CAPITAL_GARRISON;
      taken.push(E[best]);
      me.say(s.houses[h].name + " holds " + E[best].name + ".", h);
    }
    s.phase = "play";
  };

  function arc(a, b) {
    var p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180, dl = (b.lon - a.lon) * Math.PI / 180;
    var c = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
    return Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI;
  }

  /* House h stakes `stake` on (w, id). Returns { won, chance } or null. */
  Game.prototype.wager = function (h, w, id, stake) {
    var s = this.s, house = s.houses[h];
    stake = Math.floor(stake);
    if (s.phase !== "play" || stake < 1 || stake > house.treasury) { return null; }
    var from = this.reachFrom(h, w, id);
    if (!from) { return null; }
    var chance = this.odds(stake, w, id), won = Math.random() < chance;
    var t = this.territory(w, id), def = s.hold[w][id], crossing = from.w !== w;
    var defName = def >= 0 ? s.houses[def].name : "no one";
    house.treasury -= stake;
    if (won) {
      s.hold[w][id] = h;
      s.garrison[w][id] = Math.max(1, Math.ceil(stake * KEEP_ON_WIN));
      this.say(house.name + " staked " + stake + " on " + t.name + (crossing ? " (crossing to " + cap(w) + ")" : "") +
        " against " + defName + " at " + pct(chance) + ", and took it.", h);
      this.checkHouses();
    } else {
      s.garrison[w][id] += Math.floor(stake * SPOILS_ON_LOSS);
      this.say(house.name + " staked " + stake + " on " + t.name + (crossing ? " (crossing to " + cap(w) + ")" : "") +
        " against " + defName + " at " + pct(chance) + ", and lost it.", h);
    }
    return { won: won, chance: chance };
  };

  /* Move marks from the treasury into a territory's garrison. */
  Game.prototype.fortify = function (h, w, id, amount) {
    var s = this.s, house = s.houses[h];
    amount = Math.floor(amount);
    if (s.hold[w][id] !== h || amount < 1 || amount > house.treasury) { return false; }
    house.treasury -= amount;
    s.garrison[w][id] += amount;
    return true;
  };

  Game.prototype.holdings = function (h) {
    var s = this.s, out = [], me = this;
    WORLDS.forEach(function (w) {
      s.hold[w].forEach(function (o, id) { if (o === h) { out.push({ w: w, id: id, t: me.boards[w][id] }); } });
    });
    return out;
  };

  Game.prototype.income = function (h) {
    return BASE_INCOME + this.holdings(h).reduce(function (a, x) { return a + x.t.yield; }, 0);
  };

  Game.prototype.totalYield = function () {
    var b = this.boards, n = 0;
    WORLDS.forEach(function (w) { b[w].forEach(function (t) { n += t.yield; }); });
    return n;
  };

  Game.prototype.checkHouses = function () {
    var s = this.s, me = this, total = this.totalYield();
    s.houses.forEach(function (house) {
      if (!house.alive) { return; }
      var held = me.holdings(house.id);
      if (!held.length) {
        house.alive = false;
        me.say(house.name + (house.human ? " hold nothing, and are out." : " holds nothing, and is out."), house.id);
      }
    });
    if (s.winner >= 0) { return; }
    var alive = s.houses.filter(function (h) { return h.alive; });
    s.houses.forEach(function (house) {
      if (!house.alive || s.winner >= 0) { return; }
      var share = (me.income(house.id) - BASE_INCOME) / total;
      if (share >= VICTORY_SHARE || (alive.length === 1 && alive[0] === house)) {
        s.winner = house.id;
        me.say(house.name + (house.human ? " have" : " has") + " won the worlds.", house.id);
      }
    });
    if (!s.houses[0].alive && s.winner < 0) { s.winner = -2; }
  };

  /* The other houses' turns, then everyone is paid. */
  Game.prototype.endTurn = function () {
    var s = this.s, me = this;
    if (s.phase !== "play" || s.winner !== -1) { return; }
    for (var h = 1; h < s.houses.length; h++) {
      if (s.houses[h].alive && s.winner === -1) { this.play(h); }
    }
    s.houses.forEach(function (house) {
      if (house.alive) { house.treasury += me.income(house.id); }
    });
    s.turn += 1;
    this.checkHouses();
  };

  /* How a house that is not you plays: it looks along its borders for the
     best ground for the price, and wagers on it when the odds are good
     enough and its treasury can bear it. It keeps something back to hold
     what it has. */
  Game.prototype.play = function (h) {
    var s = this.s, house = s.houses[h], me = this;
    var bold = 0.55 + 0.1 * h;          // each house a little differently minded
    for (var tries = 0; tries < 3; tries++) {
      var options = [];
      this.holdings(h).forEach(function (x) {
        me.borders(x.w, x.id).forEach(function (b) {
          if (s.hold[b.w][b.id] === h) { return; }
          var t = me.boards[b.w][b.id], g = s.garrison[b.w][b.id];
          var rival = s.hold[b.w][b.id] === 0 ? 1.25 : 1;   // you are the one to beat
          options.push({ w: b.w, id: b.id, score: rival * t.yield / (g + 10), g: g });
        });
      });
      if (!options.length) { return; }
      options.sort(function (a, b) { return b.score - a.score; });
      var o = options[Math.floor(Math.random() * Math.min(3, options.length))];
      var spend = house.treasury * bold;
      var stake = Math.floor(Math.min(spend, o.g * 2.2));
      if (stake < 10 || this.odds(stake, o.w, o.id) < 0.5) { break; }
      this.wager(h, o.w, o.id, stake);
      if (s.winner !== -1) { return; }
    }
    // Shore up the weakest holding that borders an enemy.
    var weak = null;
    this.holdings(h).forEach(function (x) {
      var threatened = me.borders(x.w, x.id).some(function (b) { var o = s.hold[b.w][b.id]; return o >= 0 && o !== h; });
      if (threatened && (!weak || s.garrison[x.w][x.id] < s.garrison[weak.w][weak.id])) { weak = x; }
    });
    if (weak && house.treasury > 40) { this.fortify(h, weak.w, weak.id, Math.floor(house.treasury * 0.3)); }
  };

  function pct(p) { return Math.round(p * 100) + "%"; }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  window.Worlds = window.Worlds || {};
  window.Worlds.Game = Game;
  window.Worlds.pct = pct;
  window.Worlds.cap = cap;
})();
