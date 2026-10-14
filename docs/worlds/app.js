/* Worlds on the page: the globe, the crossing between worlds, and the
   wagers. The rules are game.js; the weave is globe.js. */

(function () {
  "use strict";

  var Wd = window.Worlds, Game = Wd.Game, pct = Wd.pct, cap = Wd.cap;
  var SAVE = "worlds-save-v1";
  var MONTH = ("0" + (new Date().getMonth() + 1)).slice(-2);

  var $ = function (id) { return document.getElementById(id); };
  var canvas = $("globe"), globe = new Wd.Globe(canvas);
  var worlds = {}, boards = {}, game = null, here = "earth";
  var sel = null;                      // { w, id }
  var stake = 0;

  function store(v) {
    try {
      if (v === null) { localStorage.removeItem(SAVE); } else { localStorage.setItem(SAVE, JSON.stringify(v)); }
    } catch (e) { /* no storage here: the game lasts as long as the page */ }
  }
  function restore() {
    try { var v = localStorage.getItem(SAVE); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }

  /* ---- what the globe shows ------------------------------------------- */

  function paint() {
    var w = here, T = boards[w], tint = new Array(T.length), marks = {};
    for (var i = 0; i < T.length; i++) {
      var o = game.owner(w, i);
      tint[i] = o >= 0 ? Wd.hexRgb(game.house(o).color) : null;
      if (o >= 0) { marks[i] = true; }
    }
    globe.tint = tint;
    globe.marks = marks;
    globe.selected = sel && sel.w === w ? sel.id : -1;
    globe.dirty = true;
  }

  var anim = null;   // the crossing
  function cross(to, then) {
    if (to === here || anim) { if (then) { then(); } return; }
    var t0 = performance.now(), out = 260, back = 420;
    anim = function (now) {
      var t = now - t0;
      if (t < out) {
        globe.scale = 1 - ease(t / out);
      } else {
        if (globe.world !== worlds[to]) { globe.world = worlds[to]; here = to; paint(); }
        globe.scale = ease(Math.min(1, (t - out) / back));
        if (t >= out + back) { globe.scale = 1; anim = null; if (then) { then(); } }
      }
      globe.dirty = true;
    };
    document.querySelectorAll("[data-world]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.world === to));
    });
  }
  function ease(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }

  /* Turn the globe to face a place. */
  var aim = null;
  function face(lat, lon) { aim = { lat: Math.max(-60, Math.min(60, lat)), lon: lon }; }

  /* ---- the panel ------------------------------------------------------- */

  function select(w, id) {
    sel = id >= 0 ? { w: w, id: id } : null;
    var reach = sel && game.reachFrom(0, w, id);
    var tr = game.human().treasury;
    if (sel && reach) {
      stake = Math.min(tr, Math.max(1, Math.round(game.s.garrison[w][id])));   // an even bet, to begin
    } else if (sel && game.owner(w, id) === 0) {
      stake = Math.max(1, Math.round(tr / 4));
    }
    paint();
    panel();
  }

  function panel() {
    var p = $("panel"), s = game.s;
    if (s.phase === "choose") {
      p.hidden = false;
      p.innerHTML = '<p class="eyebrow">Begin</p><h2>Choose your ground</h2>' +
        '<p class="body">Pick any country on Earth to raise your banner there. Three houses will rise elsewhere. ' +
        'Every territory is taken by a wager. Mars lies under the Earth, unclaimed, and the crossing is free.</p>' +
        (sel && sel.w === "earth" ? '<div class="facts"><div><span>Ground</span><b>' + esc(game.territory("earth", sel.id).name) +
          '</b></div><div><span>Yield</span><b>' + game.territory("earth", sel.id).yield + ' a turn</b></div></div>' +
          '<button class="primary" id="begin">Begin in ' + esc(game.territory("earth", sel.id).name) + '</button>' : '<p class="hint">Click a country on the globe.</p>');
      var b = $("begin");
      if (b) {
        b.onclick = function () { game.begin(sel.w, sel.id); save(); select(sel.w, sel.id); status(); };
      }
      return;
    }
    if (!sel) {
      p.hidden = false;
      var mine = game.holdings(0);
      p.innerHTML = '<p class="eyebrow">Your holdings</p><h2>' + mine.length + ' territor' + (mine.length === 1 ? 'y' : 'ies') + '</h2>' +
        '<ul class="holdings">' + mine.map(function (x) {
          return '<li><button data-go="' + x.w + ':' + x.id + '"><span>' + esc(x.t.name) + '</span><em>' + cap(x.w) +
            ' · ' + game.s.garrison[x.w][x.id] + ' held</em></button></li>';
        }).join("") + '</ul><p class="hint">Select a territory that borders yours to wager on it.</p>';
      wireGo(p);
      return;
    }
    var w = sel.w, id = sel.id, t = game.territory(w, id), o = game.owner(w, id), house = game.house(o);
    var g = s.garrison[w][id], me = game.human(), from = game.reachFrom(0, w, id);
    var other = w === "earth" ? "mars" : "earth", under = t[other] || [];
    var html = '<p class="eyebrow">' + cap(w) + (t.region ? ' · ' + esc(t.region) : '') + '</p><h2>' + esc(t.name) + '</h2>' +
      '<div class="facts">' +
      '<div><span>Held by</span><b>' + (house ? '<i class="sw" style="background:' + house.color + '"></i>' + esc(house.name) : 'No one') + '</b></div>' +
      '<div><span>Garrison</span><b>' + g + '</b></div>' +
      '<div><span>Yield</span><b>' + t.yield + ' a turn</b></div></div>';
    if (o === 0) {
      html += '<label class="stake">Fortify with <output id="sv">' + stake + '</output> marks' +
        '<input id="sr" type="range" min="1" max="' + Math.max(1, me.treasury) + '" value="' + Math.min(stake || 1, me.treasury) + '"' + (me.treasury < 1 ? ' disabled' : '') + '></label>' +
        '<button class="primary" id="act"' + (me.treasury < 1 ? ' disabled' : '') + '>Fortify</button>';
    } else if (from && s.winner === -1) {
      var fromT = game.territory(from.w, from.id);
      html += '<p class="from">From ' + esc(fromT.name) + (from.w !== w ? ' — <b>crossing from ' + cap(from.w) + '</b>' : '') + '</p>' +
        '<label class="stake">Stake <output id="sv">' + stake + '</output> marks' +
        '<input id="sr" type="range" min="1" max="' + Math.max(1, me.treasury) + '" value="' + stake + '"' + (me.treasury < 1 ? ' disabled' : '') + '></label>' +
        '<div class="odds"><div class="bar"><i id="ob"></i></div><span id="ot"></span></div>' +
        '<button class="primary" id="act"' + (me.treasury < 1 ? ' disabled' : '') + '>Wager</button>';
    } else if (s.winner === -1) {
      html += '<p class="hint">None of your ground borders it yet, on this world or the other.</p>';
    }
    if (under.length) {
      // Mine first, then what borders mine, then the most ground shared.
      var shown = under.slice().sort(function (a, b) {
        var ra = game.owner(other, a) === 0 ? 0 : game.reachFrom(0, other, a) ? 1 : 2;
        var rb = game.owner(other, b) === 0 ? 0 : game.reachFrom(0, other, b) ? 1 : 2;
        return ra - rb;
      }).slice(0, 8);
      html += '<p class="eyebrow under">Beneath it, on ' + cap(other) + (under.length > 8 ? ' (8 of ' + under.length + ')' : '') + '</p><ul class="holdings">' + shown.map(function (j) {
        var u = game.territory(other, j), uo = game.house(game.owner(other, j));
        return '<li><button data-go="' + other + ':' + j + '"><span>' + esc(u.name) + '</span><em>' + (uo ? esc(uo.name) : 'No one') + '</em></button></li>';
      }).join("") + '</ul>';
    }
    html += '<button class="quiet" id="close">Back to your holdings</button>';
    p.hidden = false;
    p.innerHTML = html;
    var sr = $("sr");
    if (sr) {
      var upd = function () {
        stake = Number(sr.value);
        $("sv").textContent = stake;
        if ($("ob")) {
          var c = game.odds(stake, w, id);
          $("ob").style.width = (c * 100) + "%";
          $("ot").textContent = pct(c) + " to take it";
        }
      };
      sr.oninput = upd;
      upd();
    }
    var act = $("act");
    if (act) {
      act.onclick = function () {
        if (o === 0) {
          game.fortify(0, w, id, stake);
          toast("Fortified " + t.name + ".");
        } else {
          var r = game.wager(0, w, id, stake);
          if (r) { toast((r.won ? "Taken: " : "Lost: ") + t.name + " at " + pct(r.chance) + ".", r.won); }
        }
        stake = Math.min(stake, game.human().treasury);
        save();
        select(w, id);
        status();
      };
    }
    $("close").onclick = function () { select(here, -1); };
    wireGo(p);
  }

  function wireGo(root) {
    root.querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () {
        var parts = b.dataset.go.split(":"), w = parts[0], id = Number(parts[1]), t = game.territory(w, id);
        cross(w, function () { face(t.lat, t.lon); });
        select(w, id);
        if (w === here) { face(t.lat, t.lon); }
      };
    });
  }

  function status() {
    var s = game.s, me = game.human();
    $("turn").textContent = s.turn;
    $("treasury").textContent = me.treasury;
    $("income").textContent = "+" + game.income(0);
    $("end").disabled = s.phase !== "play" || s.winner !== -1;
    $("houses").innerHTML = s.houses.map(function (h) {
      var n = game.holdings(h.id).length;
      return '<li class="' + (h.alive ? '' : 'out') + '"><i class="sw" style="background:' + h.color + '"></i>' + esc(h.name) +
        '<em>' + (h.alive ? n : 'out') + '</em></li>';
    }).join("");
    $("log").innerHTML = s.log.slice(0, 30).map(function (e) {
      var h = game.house(e.who);
      return '<li><b>' + e.turn + '</b>' + (h ? '<i class="sw" style="background:' + h.color + '"></i>' : '') + esc(e.text) + '</li>';
    }).join("");
    var banner = $("banner");
    if (s.winner >= 0 || s.winner === -2) {
      banner.hidden = false;
      banner.querySelector("p").textContent = s.winner === 0 ? "You hold two fifths of the worlds. The worlds are yours." :
        s.winner === -2 ? "You hold nothing now. The worlds go on without you." : game.house(s.winner).name + " has won the worlds.";
    } else {
      banner.hidden = true;
    }
    paint();
  }

  function save() { store(game.s); }

  var toastTimer = 0;
  function toast(text, good) {
    var t = $("toast");
    t.textContent = text;
    t.className = "toast show" + (good === true ? " good" : good === false ? " bad" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = "toast"; }, 2600);
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; });
  }

  /* ---- turning the world by hand --------------------------------------- */

  var drag = null, pointers = {}, pinch = null, spin = 0.012;
  canvas.addEventListener("pointerdown", function (e) {
    canvas.setPointerCapture(e.pointerId);
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) {
      var a = pointers[ids[0]], b = pointers[ids[1]];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: globe.zoom };
      drag = null;
    } else {
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false };
    }
    aim = null; spin = 0;
  });
  canvas.addEventListener("pointermove", function (e) {
    var rect = canvas.getBoundingClientRect();
    if (pointers[e.pointerId]) { pointers[e.pointerId] = { x: e.clientX, y: e.clientY }; }
    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]];
        globe.zoom = clampZoom(pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d);
        globe.dirty = true;
      }
      return;
    }
    if (drag) {
      var R = globe.radius() / globe.dpr, dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(e.clientX - drag.sx) + Math.abs(e.clientY - drag.sy) > 5) { drag.moved = true; }
      globe.lon0 -= dx / R * 180 / Math.PI;
      globe.lat0 = Math.max(-80, Math.min(80, globe.lat0 + dy / R * 180 / Math.PI));
      globe.vlon = -dx / R * 180 / Math.PI;
      drag.x = e.clientX; drag.y = e.clientY;
      globe.dirty = true;
      return;
    }
    var id = globe.territoryAt(e.clientX - rect.left, e.clientY - rect.top);
    if (id !== globe.hover) {
      globe.hover = id;
      globe.dirty = true;
      var tip = $("tip");
      if (id >= 0) {
        var o = game ? game.house(game.owner(here, id)) : null;
        tip.textContent = worlds[here].territories[id].name + (o ? " · " + o.name : "");
        tip.hidden = false;
      } else {
        tip.hidden = true;
      }
    }
    var tp = $("tip");
    tp.style.transform = "translate(" + (e.clientX + 14) + "px," + (e.clientY + 12) + "px)";
  });
  function up(e) {
    delete pointers[e.pointerId];
    if (pinch && Object.keys(pointers).length < 2) { pinch = null; return; }
    if (drag && !drag.moved && game) {
      var rect = canvas.getBoundingClientRect();
      var id = globe.territoryAt(e.clientX - rect.left, e.clientY - rect.top);
      if (game.s.phase === "choose" && here !== "earth") { id = -1; }
      select(here, id);
    }
    drag = null;
  }
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("pointerleave", function () { globe.hover = -1; $("tip").hidden = true; globe.dirty = true; });
  canvas.addEventListener("wheel", function (e) {
    e.preventDefault();
    globe.zoom = clampZoom(globe.zoom * Math.exp(-e.deltaY * 0.0015));
    globe.dirty = true;
  }, { passive: false });
  function clampZoom(z) { return Math.max(0.6, Math.min(14, z)); }

  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT" && e.target.type !== "range") { return; }
    var step = 8 / globe.zoom;
    if (e.key === "ArrowLeft") { globe.lon0 -= step; } else if (e.key === "ArrowRight") { globe.lon0 += step; }
    else if (e.key === "ArrowUp" && e.target.type !== "range") { globe.lat0 = Math.min(80, globe.lat0 + step); }
    else if (e.key === "ArrowDown" && e.target.type !== "range") { globe.lat0 = Math.max(-80, globe.lat0 - step); }
    else if (e.key === "+" || e.key === "=") { globe.zoom = clampZoom(globe.zoom * 1.25); }
    else if (e.key === "-") { globe.zoom = clampZoom(globe.zoom / 1.25); }
    else if (e.key === "Escape") { select(here, -1); }
    else { return; }
    aim = null; spin = 0;
    globe.dirty = true;
  });
  $("zin").onclick = function () { globe.zoom = clampZoom(globe.zoom * 1.4); globe.dirty = true; };
  $("zout").onclick = function () { globe.zoom = clampZoom(globe.zoom / 1.4); globe.dirty = true; };
  window.addEventListener("resize", function () { globe.resize(); });

  document.querySelectorAll("[data-world]").forEach(function (b) {
    b.onclick = function () { cross(b.dataset.world); };
  });
  $("end").onclick = function () {
    game.endTurn();
    save();
    if (sel) { select(sel.w, sel.id); } else { panel(); }
    status();
    toast("Turn " + game.s.turn + ". You are paid " + game.income(0) + ".");
  };
  // Asked twice, on the button itself: a new game loses this one.
  var armed = 0;
  $("new").onclick = function () {
    var b = $("new");
    if (!armed) {
      b.textContent = "Click again to lose this game";
      b.classList.add("armed");
      armed = setTimeout(function () { armed = 0; b.textContent = "New game"; b.classList.remove("armed"); }, 4000);
      return;
    }
    clearTimeout(armed); armed = 0;
    b.textContent = "New game"; b.classList.remove("armed");
    store(null);
    game = new Game(boards, null);
    sel = null;
    cross("earth");
    status();
    panel();
  };

  function frame(now) {
    if (anim) { anim(now); }
    if (aim) {
      var dl = ((aim.lon - globe.lon0 + 540) % 360) - 180, dp = aim.lat - globe.lat0;
      globe.lon0 += dl * 0.12; globe.lat0 += dp * 0.12;
      if (Math.abs(dl) < 0.05 && Math.abs(dp) < 0.05) { aim = null; }
      globe.dirty = true;
    } else if (!drag && Math.abs(globe.vlon) > 0.01) {
      globe.lon0 += globe.vlon; globe.vlon *= 0.92; globe.dirty = true;
    } else if (spin && !drag) {
      globe.lon0 += spin; globe.dirty = true;
    }
    if (globe.dirty) { globe.draw(); }
    requestAnimationFrame(frame);
  }

  /* ---- begin ------------------------------------------------------------ */

  Promise.all([Wd.loadWorld("earth", "../v2/earth-dirt/earth-dirt-" + MONTH + ".png"), Wd.loadWorld("mars", "mars/dots.png")]).then(function (all) {
    worlds.earth = all[0]; worlds.mars = all[1];
    boards.earth = all[0].territories; boards.mars = all[1].territories;
    var saved = restore();
    game = new Game(boards, saved && saved.hold && saved.hold.earth.length === boards.earth.length ? saved : null);
    globe.world = worlds.earth;
    $("loading").remove();
    status();
    panel();
    if (game.s.phase === "play") {
      var first = game.holdings(0)[0];
      if (first) { if (first.w !== "earth") { cross(first.w); } face(first.t.lat, first.t.lon); }
    }
    requestAnimationFrame(frame);
  }).catch(function (err) {
    $("loading").textContent = "The worlds could not be loaded: " + err.message;
  });
})();
