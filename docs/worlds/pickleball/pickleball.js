/* Holographic Mr Pearl: Pickleball (the artist's name for it, 28 Oct 2026). His courts as a game of their own, made to
   become a YouTube Playable.

   The artist, 28 Oct 2026: "Let's focus all of our attention on the Pickleball mini game. It needs to be able to become
   a playable on YouTube ... The movement by Mr Pearl and his nemesis, Mr Plan, are too robotic. They need to be more
   moving more athletically than any athlete ever. I also am over the pixel aesthetic, I want the ASCII aesthetic built
   in. The impossible triangle should not be the base unit for Holographic Mr Pearl anymore, it should be what I have
   prescribed for the ASCII aesthetic".

   The courts are the rocket world's (docs/worlds/rocket/rocket.js, "the courts", and its README), first to three; he
   serves every point, underhand and across, past the kitchen, the pearl his ball and his guitar the racket; the
   two-bounce rule; no volley from the kitchen. They are endless now (the artist, 28 Oct 2026: "get rid of the Trojan
   horse ... Instead, we are simply going to have an ad infinitum pickleball game. Initially the game starts with just
   1 court. Once you beat that first court, the second court adjacent to it then appears ... Previous courts still
   automatically play and you win each game as you advance. The goal is to see how many courts you can win. each court
   gets progressively harder. By the time you get to court 10, the game should be very hard"). What is new: the courts
   stand alone (a Playable is one bundle; nothing of the rocket world comes in but his body,
   pearl.js); his nemesis is Mr Plan; the two are athletes (below, "the athletes"); and everything reaches the screen
   as characters (below, "the ASCII pass"), the unit the artist prescribed for the ASCII aesthetic in place of the
   impossible triangle: the keyboard's characters and the site's marks, one set sorted by ink. His head alone stays
   as it is, the one perfect sphere (rule 5 of his unit: "His head/Holographic mode will be the only perfect Sphere in
   the game"). Sections: YouTube; the athletes; the ASCII pass; the scene; the courts; the views and the hands; the
   loop. */
(function () {
  "use strict";
  var PB = window.PearlBody, mul = PB.mul, T = PB.T, S = PB.S, RX = PB.RX, RY = PB.RY, RA = PB.RA;
  var min = Math.min, max = Math.max, abs = Math.abs, floor = Math.floor, round = Math.round, hypot = Math.hypot, PI = Math.PI;
  function $(id) { return document.getElementById(id); }
  function clampV(v, a, b) { return max(a, min(b, v)); }
  function smooth(s) { s = clampV(s, 0, 1); return s * s * (3 - 2 * s); }
  function angle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  function about(R, p) { return mul(T(p[0], p[1], p[2]), mul(R, T(-p[0], -p[1], -p[2]))); }
  function apply(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
  function turn(m, v) { return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sc(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function lerp3(a, b, s) { return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s]; }
  // the turn that takes the unit u onto the unit v (the least one)
  function rotTo(u, v) {
    var c = dot(u, v), ax = cross(u, v), s = hypot(ax[0], ax[1], ax[2]);
    if (s < 1e-6) { return c > 0 ? T(0, 0, 0) : RA(abs(u[0]) < 0.9 ? norm(cross(u, [1, 0, 0])) : norm(cross(u, [0, 1, 0])), PI); }
    return RA([ax[0] / s, ax[1] / s, ax[2] / s], Math.atan2(s, c));
  }
  // a critically damped spring on o[k] towards x (its velocity kept in o[k + "v"]), w its rate per second; solved
  // exactly over the step, so a slow device's long frames cannot set it ringing (a stepped spring at w dt over one does)
  function spring(o, k, x, dt, w) {
    var v = o[k + "v"] || 0, d = o[k] - x, e = Math.exp(-w * dt), c = v + w * d;
    o[k] = x + (d + c * dt) * e; o[k + "v"] = (v - w * c * dt) * e;
  }

  /* ---- YouTube --------------------------------------------------------------------------------------------------
     The Playables SDK (https://www.youtube.com/game_api/v1; read at 1.20261019.0100) is put first on the page by
     scripts/build_pickleball.js, as its firstFrameReady() checks (the first script element, neither defer nor async);
     the site's own page never loads it. Inside YouTube (ytgame.IN_PLAYABLES_ENV, the page in a frame): the first frame
     (under the loading words) and the moment it can be played (the words gone) are told; the game halts all it does,
     the hands' input too, at onPause and goes on at onResume (never the Page Visibility API: the requirements forbid it); it saves through the SDK (under 3 MiB; never localStorage
     there); the number of courts won is the score, an integer; the language is the SDK's (never the browser's). Outside, each
     call is nothing and the save is the browser's. */
  var YT = (function () {
    var y = window.ytgame, inYT = !!(y && y.IN_PLAYABLES_ENV), first = false, ready = false, sent = -1, KEY = "pickleball-save-v1";
    var me = { inYT: inYT, lang: "en", paused: false, calls: [] };
    function warn(e) { try { console.warn(e); if (inYT) { y.health.logWarning(); } } catch (x) { /* nothing more to do */ } }
    function call(name, f) {
      me.calls.push(name);
      try { var r = f(); if (r && r.then) { r.then(null, warn); } return r; } catch (e) { warn(e); return null; }
    }
    me.warn = warn;
    me.error = function (e) { try { console.error(e); if (inYT) { y.health.logError(); } } catch (x) { /* nothing more */ } };
    me.audioOn = true;
    me.init = function () {
      if (!inYT) { return Promise.resolve(); }
      // (no sound yet; YouTube's mute is read and followed all the same, through the two calls the rules name, so a
      // sound added later starts from it)
      me.audioOn = me.audio();
      call("onAudioEnabledChange", function () { return y.system.onAudioEnabledChange(function (on) { me.audioOn = !!on; }); });
      return Promise.resolve(call("getLanguage", function () { return y.system.getLanguage(); })).then(function (l) { me.lang = l || "en"; }, function () { /* English */ });
    };
    me.firstFrame = function () { if (first) { return; } first = true; if (inYT) { call("firstFrameReady", function () { return y.game.firstFrameReady(); }); } };
    me.ready = function () { if (ready || !first) { return; } ready = true; if (inYT) { call("gameReady", function () { return y.game.gameReady(); }); } };
    me.onPause = function (fn) { if (inYT) { call("onPause", function () { return y.system.onPause(function () { me.paused = true; fn(); }); }); } };
    me.onResume = function (fn) { if (inYT) { call("onResume", function () { return y.system.onResume(function () { me.paused = false; fn(); }); }); } };
    me.audio = function () { return inYT ? call("isAudioEnabled", function () { return y.system.isAudioEnabled(); }) !== false : true; };
    me.load = function () {
      if (inYT) {
        var get = function () { return Promise.resolve(call("loadData", function () { return y.game.loadData(); })); };
        return get().then(null, function () { return get(); })   // (once more: the SDK may be briefly unavailable)
          .then(function (s) { try { return s ? JSON.parse(s) : null; } catch (e) { warn(e); return null; } },
                function (e) { warn(e); me.noSave = true; return null; });   // (not loaded: the player's cloud save is never written over)
      }
      try { var s = window.localStorage.getItem(KEY); return Promise.resolve(s ? JSON.parse(s) : null); } catch (e) { return Promise.resolve(null); }
    };
    me.save = function (o) {
      var s = typeof o === "string" ? o : JSON.stringify(o);
      if (s.length > 3e6) { warn("pickleball: the save is over 3 MiB; not saved"); return Promise.resolve(); }
      if (inYT) { return me.noSave ? Promise.resolve() : Promise.resolve(call("saveData", function () { return y.game.saveData(s); })); }
      try { window.localStorage.setItem(KEY, s); } catch (e) { /* a private window: unsaved */ }
      return Promise.resolve();
    };
    me.score = function (n) {
      n = floor(n);
      if (!inYT || me.noSave || !(n > sent) || !Number.isSafeInteger(n)) { return; }   // (never saved: never sent)
      sent = n; call("sendScore", function () { return y.engagement.sendScore({ value: n }); });
    };
    window.addEventListener("error", function (e) { me.error(e.error || e.message); });
    window.addEventListener("unhandledrejection", function (e) { me.error(e.reason); });
    return me;
  })();

  /* ---- the athletes ----------------------------------------------------------------------------------------------
     "more athletically than any athlete ever". Nothing moves at a constant speed: the body is driven by what it wants
     (the stick's velocity, or a point to be at) through limits no person has reached, and its pose follows from what
     the body is doing, every frame: it leans into its acceleration, drops when it brakes and when it is ready, strides
     by the ground it covers (so a foot never slides) and longer the faster it goes, pumps its arms, skids when it
     stops from a sprint, turns once round on a planted foot when a sprint reverses, hops a split-step whenever the
     other strikes, and lands low. Every stroke is scheduled: the game finds where and when the pearl can be met, and
     the stroke winds up so that the paddle is there then (the wind-up, the contact, the follow-through), with the run,
     the lunge, the dive (flat out, landed, a roll, up again) or the leap (a scissor kick at the top) it needs. A point
     won is a standing backflip. The envelope, and why each number:
       vmax 13 m/s      Usain Bolt's measured peak (Berlin, 2009) was about 12.4 m/s
       acc 30 m/s²      a sprinter's first steps are about 8 to 10: six metres a second in a fifth of one
       dec 42 m/s²      he stops harder than he starts; over 6 m/s the stop is a skid
       reach            1.25 m round him standing, 2.35 m on a lunge, 4 m on a dive (his arm and his guitar's neck make
                        a lever a little over a metre from the shoulder to the lower bout), and 1.6 m higher on a leap
                        (the best standing vertical jumps measured are about 1.2 m)
     The body is PearlBody's (his parts and joints from his form, pearl-body.json). The racket is his guitar, the Koa
     bass (the artist, 28 Oct 2026: "Mr Pearl should be playing with his Guitar as the racket too, not his hat", as he
     smashes with it in the rocket world): held by the neck in his right glove a hand's width below the nut, along the
     line of his arm, its lower bout the face (its top turned to where the shot goes), its strap left off; his hat is
     back on his head. */
  var CAPS = { vmax: 13, acc: 30, dec: 42, skidV: 6, turn: 16, standR: 1.25, lungeR: 2.35, diveR: 4.0, leapUp: 1.6, top: 2.05, g: 9.81 };
  var RIG = null;
  function rigInit(body, spec) {
    var J = body.joints, h = body.cell, rest = {};
    body.parts.forEach(function (p) { if (!p.empty) { rest[p.name] = mul(T(p.org[0], p.org[1], p.org[2]), S(h)); } });
    var mid = function (name) {
      var p = body.parts.filter(function (q) { return q.name === name; })[0], c = [0, 0, 0];
      p.blocks.forEach(function (b) { c[0] += b[0] + 0.5; c[1] += b[1] + 0.5; c[2] += b[2] + 0.5; });
      return [p.org[0] + c[0] / p.blocks.length * h, p.org[1] + c[1] / p.blocks.length * h, p.org[2] + c[2] / p.blocks.length * h];
    };
    var legs = ["right", "left"].map(function (s) {
      var hip = J["hip_" + s].at, knee = J["knee_" + s].at, ankle = [knee[0], 0.07, hip[2]];
      return { s: s, sign: s === "right" ? 1 : -1, hip: hip, knee: knee, lt: hypot(knee[1] - hip[1], knee[2] - hip[2]), ls: hypot(ankle[1] - knee[1], ankle[2] - knee[2]),
               a0: Math.atan2(-(knee[2] - hip[2]), hip[1] - knee[1]), g0: Math.atan2(-(ankle[2] - knee[2]), knee[1] - ankle[1]) };
    });
    var sR = J.shoulder_right.at, sL = J.shoulder_left.at, palm = body.throwArm.palm, Pr = {};
    spec.form.primitives.forEach(function (pr) { Pr[pr.part] = pr; });
    // the guitar as a racket, from its form: the grip on the neck a hand's width (7 cm) below the nut (the strings'
    // far end), the sweet spot the middle of the lower bout, the face its top (the bout's axis points out of the top)
    var nut = PB.toGame(Pr.guitar_strings.b), saddle = PB.toGame(Pr.guitar_strings.a), G = add(nut, sc(norm(sub(saddle, nut)), 0.07));
    var la = PB.toGame(Pr.guitar_lower_bout.a), lb = PB.toGame(Pr.guitar_lower_bout.b), Sw = lerp3(la, lb, 0.5), u = norm(sub(Sw, G)), n = norm(sub(lb, la));
    n = norm(sub(n, sc(u, dot(n, u))));
    var a0 = sub(palm, sR);
    RIG = { rest: rest, legs: legs, sR: sR, sL: sL, pelvis: J.pelvis.at, spine: J.spine.at, head: body.head.centre,
            a0: a0, armL: hypot(a0[0], a0[1], a0[2]), uL0: sub(mid("arm_left"), sL),
            gG: G, gL: hypot(Sw[0] - G[0], Sw[1] - G[1], Sw[2] - G[2]), gBasis: basis(u, n) };
    RIG.reach = RIG.armL + RIG.gL;
  }
  // the turn whose columns are u, n and u x n (u, n unit and square to each other)
  function basis(u, n) { var w = cross(u, n); return [u[0], u[1], u[2], 0, n[0], n[1], n[2], 0, w[0], w[1], w[2], 0, 0, 0, 0, 1]; }
  function transposeR(m) { return [m[0], m[4], m[8], 0, m[1], m[5], m[9], 0, m[2], m[6], m[10], 0, 0, 0, 0, 1]; }
  function athlete(pal, x, z, yaw, near) {
    return { pal: pal, near: near, x: x, z: z, y: 0, vx: 0, vz: 0, vy: 0, yaw: yaw, faceTo: null, want: null,
             leanF: 0, leanS: 0, drop: 0.12, wide: 0.06, kick: 0, phase: 0, stepL: 0.32, speed: 0, ax: 0, az: 0, skid: 0, air: false,
             move: null, spin: null, celeb: null, hop: false };
  }
  // the moves that take the body over (a lunge, a dive, a leap) and the strokes, each a time line
  function athStep(a, dt, gt) {
    if (dt <= 0) { return; }
    var m = a.move, ovx = a.vx, ovz = a.vz;
    if (m && gt >= m.end) { a.move = m = null; }
    if (m && m.own && gt >= m.own[0] && gt < m.own[1]) { moveBody(a, m, dt, gt); }
    else {
      var wv = [0, 0], w = a.want;
      if (w && w.vel) { wv = w.vel; }
      else if (w && w.to) {
        var dx = w.to[0] - a.x, dz = w.to[1] - a.z, d = hypot(dx, dz);
        // (as fast as he can and still stop on the spot: the braking distance at his own deceleration)
        if (d > 0.03) { var sp = min(CAPS.vmax * (w.k || 1), Math.sqrt(2 * CAPS.dec * 0.8 * d)); wv = [dx / d * sp, dz / d * sp]; }
      }
      var ex = wv[0] - a.vx, ez = wv[1] - a.vz, el = hypot(ex, ez);
      if (el > 1e-6) { var A = (ex * a.vx + ez * a.vz < 0 ? CAPS.dec : CAPS.acc) * dt, k = min(1, A / el); a.vx += ex * k; a.vz += ez * k; }
      var sp2 = hypot(a.vx, a.vz), wl = hypot(wv[0], wv[1]);
      if (sp2 > CAPS.vmax) { a.vx *= CAPS.vmax / sp2; a.vz *= CAPS.vmax / sp2; }
      if (!a.spin && !a.air && sp2 > 8 && wl > 4 && wv[0] * a.vx + wv[1] * a.vz < -0.6 * sp2 * wl) { a.spin = { t0: gt, T: 0.4 }; }
    }
    a.x += a.vx * dt; a.z += a.vz * dt;
    if (a.y > 0 || a.vy > 0) {
      a.vy -= CAPS.g * dt; a.y += a.vy * dt;
      if (a.y <= 0) { a.kick = min(0.28, -a.vy * 0.06); a.y = 0; a.vy = 0; a.hop = false; }
    }
    a.air = a.y > 0.002;
    var ax = (a.vx - ovx) / dt, az = (a.vz - ovz) / dt, q = min(1, dt * 12);
    a.ax += (ax - a.ax) * q; a.az += (az - a.az) * q;
    a.speed = hypot(a.vx, a.vz);
    a.skid += ((a.speed > CAPS.skidV && a.ax * a.vx + a.az * a.vz < -12 * a.speed && !a.air ? 1 : 0) - a.skid) * min(1, dt * 10);
    // the way his chest faces: what he is told (the ball, the net), or the way he sprints when it is far from it
    var want = a.faceTo != null ? a.faceTo : (a.near ? 0 : PI), run = Math.atan2(a.vx, -a.vz);
    if (!m && a.speed > 5.5 && abs(angle(run - want)) > 1.2) { want = run; }
    if (!(m && m.lockYaw && gt >= m.own[0])) { a.yaw += clampV(angle(want - a.yaw), -CAPS.turn * dt, CAPS.turn * dt); }
    var fx = Math.sin(a.yaw), fz = -Math.cos(a.yaw), rx = Math.cos(a.yaw), rz = Math.sin(a.yaw);
    var aF = a.ax * fx + a.az * fz, aS = a.ax * rx + a.az * rz, vF = a.vx * fx + a.vz * fz;
    spring(a, "leanF", a.air ? 0 : clampV(aF * 0.012 + vF * 0.022, -0.45, 0.55), dt, 14);
    spring(a, "leanS", a.air ? 0 : clampV(aS * 0.011, -0.42, 0.42), dt, 14);
    a.stepL = clampV(0.3 + 0.16 * a.speed, 0.3, 2.3);
    if (!a.air) { a.phase += a.speed * dt / a.stepL * PI; }
    a.kick += -a.kick * min(1, dt * 7);
    var ready = a.speed < 1.5 && !a.air, dropT = (ready ? 0.15 + 0.03 * Math.sin(gt * 9 + (a.near ? 0 : 2)) : 0.07 + 0.01 * a.speed) + a.skid * 0.14 + a.kick;
    if (m && m.drop != null && gt >= m.t0) { dropT = m.drop(gt); }
    spring(a, "drop", clampV(dropT, 0, 0.5), dt, 22);
    spring(a, "wide", ready ? (a.splitT && gt - a.splitT < 0.5 ? 0.19 : 0.11) : 0.04, dt, 18);
  }
  // the body while a move owns it: the lunge eased to its spot, the dive and the leap flown
  function moveBody(a, m, dt, gt) {
    if (m.reach === "lunge") {
      var s = smooth((gt - m.own[0]) / (m.own[1] - m.own[0])), nx = m.from[0] + (m.to[0] - m.from[0]) * s, nz = m.from[1] + (m.to[1] - m.from[1]) * s;
      a.vx = (nx - a.x) / dt; a.vz = (nz - a.z) / dt; a.vx = clampV(a.vx, -CAPS.vmax, CAPS.vmax); a.vz = clampV(a.vz, -CAPS.vmax, CAPS.vmax);
    } else if (m.reach === "dive") {
      if (!m.launched) { m.launched = true; var T0 = max(0.12, m.tc + 0.06 - gt); a.vx = (m.to[0] - a.x) / T0; a.vz = (m.to[1] - a.z) / T0; a.vy = CAPS.g * T0 / 2; a.y = max(a.y, 0.001); }
      else if (!a.air) { var sp = hypot(a.vx, a.vz), dv = 16 * dt; if (sp > dv) { a.vx -= a.vx / sp * dv; a.vz -= a.vz / sp * dv; } else { a.vx = a.vz = 0; } }
    } else if (m.reach === "super") {
      if (gt >= m.up && !m.launched) { m.launched = true; a.vy = m.vy; a.y = max(a.y, 0.001); }
      a.vx = 0; a.vz = 0;   // (straight up, and down where he went up)
    } else if (m.reach === "leap") {
      if (gt >= m.up && !m.launched) { m.launched = true; a.vy = m.vy; a.y = max(a.y, 0.001); }
      var T1 = max(0.05, m.tc - gt); a.vx += ((m.to[0] - a.x) / T1 - a.vx) * min(1, dt * 8); a.vz += ((m.to[1] - a.z) / T1 - a.vz) * min(1, dt * 8);
      if (gt > m.tc) { a.vx *= 0.9; a.vz *= 0.9; }
    }
  }
  // Where his paddle can meet p in t seconds (p a point of the pearl's flight), and how: standing (with the run he can
  // make first: run, the metres his legs cover in that time, nought for the player, who runs himself), a lunge, a dig,
  // a leap or a dive. The cost prefers the pearl at his waist, then earlier.
  // (a stroke standing needs him set a moment before it, a lunge less, a dive none: so a pearl he only just gets to
  // is lunged or dived for, and one high enough is leapt for, an overhead before it can come down)
  // only: the moves allowed (a showman's choice: Mr Plan, now and then, goes for the dive or the lunge on purpose)
  function reachOf(a, t, p, run, only) {
    var D = hypot(p[0] - a.x, p[2] - a.z), y = p[1], d = function (set) { return max(0, D - run(t - set)); }, ok = function (r) { return !only || only[r]; };
    if (ok("leap") && d(0.1) <= 1.8 && y > CAPS.top && y <= CAPS.top + CAPS.leapUp && t >= Math.sqrt(2 * (y - CAPS.top + 0.15) / CAPS.g) + 0.12) { return { reach: "leap", cost: 0 }; }
    if (ok("stand") && d(0.14) <= CAPS.standR && y >= 0.28 && y <= CAPS.top) { return { reach: "stand", cost: abs(y - 1.0) }; }
    if (ok("dig") && d(0.14) <= CAPS.standR && y < 0.28 && y >= 0.05) { return { reach: "dig", cost: 0.8 }; }
    if (ok("lunge") && d(0.06) <= CAPS.lungeR && y >= 0.15 && y <= 1.6 && t >= 0.14) { return { reach: "lunge", cost: 1.4 }; }
    if (ok("dive") && d(0) <= CAPS.diveR && y >= 0.05 && y <= 1.3 && t >= 0.2) { return { reach: "dive", cost: 2.6 }; }
    return null;
  }
  // a stroke at c = { tc, p, kind, reach, aim } (aim: the world way the shot goes, for the paddle's face)
  var WIND = { serve: 0.3, drive: 0.28, dink: 0.2, volley: 0.16, overhead: 0.32, dig: 0.24 };
  function athSwing(a, c, gt) {
    var tc = c.tc, wind = min(WIND[c.kind] || 0.28, max(0.08, tc - gt)), d = [c.p[0] - a.x, c.p[2] - a.z], dl = hypot(d[0], d[1]) || 1;
    var m = { kind: c.kind, reach: c.reach || "stand", tc: tc, t0: tc - wind, p: c.p.slice(), aim: c.aim || [0, 0, a.near ? -1 : 1], end: tc + 0.62, own: null };
    // forehand on his right, backhand across: the side the pearl is on, in his frame
    var rx = Math.cos(a.yaw), rz = Math.sin(a.yaw);
    m.fore = (d[0] * rx + d[1] * rz) > -0.15 || c.kind === "serve";
    var u = [d[0] / dl, d[1] / dl];
    if (m.reach === "lunge") {
      var go = max(0, dl - CAPS.standR * 0.75);
      m.own = [tc - 0.26, tc + 0.05]; m.from = [a.x, a.z]; m.to = [a.x + u[0] * go, a.z + u[1] * go]; m.end = tc + 0.55;
      m.drop = function (g) { return g < tc ? 0.12 + 0.2 * smooth((g - m.own[0]) / 0.26) : 0.32 - 0.2 * smooth((g - tc) / 0.4); };
    } else if (m.reach === "dive") {
      // flat out at it: his middle lands short of p by his arm and the paddle; down, a roll, up
      var go2 = max(0, dl - 1.35);
      m.own = [tc - 0.3, tc + 0.75]; m.to = [a.x + u[0] * go2, a.z + u[1] * go2]; m.end = tc + 0.95; m.lockYaw = true; m.yawTo = Math.atan2(u[0], -u[1]);
    } else if (m.reach === "leap") {
      var hgt = clampV(c.p[1] - CAPS.top + 0.15, 0.12, CAPS.leapUp), tUp = Math.sqrt(2 * hgt / CAPS.g);
      m.vy = CAPS.g * tUp; m.up = tc - tUp; m.own = [m.up - 0.14, tc + tUp]; m.to = [c.p[0] - u[0] * 0.3, c.p[2] - u[1] * 0.3]; m.end = tc + tUp + 0.35;   // (he travels in the air to it: up to 1.8 m)
      m.drop = function (g) { return g < m.up ? 0.12 + 0.18 * smooth((g - (m.up - 0.14)) / 0.14) : 0.04; };
      m.t0 = min(m.t0, m.up - 0.14);
    } else if (m.reach === "dig") {
      m.drop = function (g) { return 0.34 - 0.2 * smooth((g - tc) / 0.4); };
    }
    a.move = m;
    return m;
  }
  function athSplit(a, gt) { if (!a.air && !(a.move && a.move.own)) { a.vy = 1.75; a.y = 0.001; a.hop = true; a.splitT = gt; } }
  function athCelebrate(a, won, gt) {
    if (a.move && a.move.own && gt < a.move.end) { return; }
    if (won) { a.celeb = { kind: "flip", t0: gt }; a.vy = 4.6; a.y = 0.001; a.vx *= 0.3; a.vz *= 0.3; }
    else { a.celeb = { kind: "shake", t0: gt }; }
  }
  // His pose: every part's matrix from its cells to the world, the paddle's middle and face, the head's middle and turn.
  function athPose(a, gt) {
    var R = RIG, m = a.move, out = { parts: {} }, drop = a.drop, bend = 0.1 + drop * 1.1, twist = 0, yaw = a.yaw;
    if (m && m.lockYaw && gt >= m.own[0]) { yaw = m.yawTo; }
    var root = mul(T(a.x, a.y, a.z), RY(-yaw));
    if (a.spin) { var su = (gt - a.spin.t0) / a.spin.T; if (su >= 1) { a.spin = null; } else { root = mul(root, RY(-2 * PI * smooth(su))); } }
    var tuck = 0;
    if (a.celeb) {
      var cu = gt - a.celeb.t0;
      if (a.celeb.kind === "flip") {
        // a standing backflip about his middle over his time in the air (4.6 m/s up: 0.94 s, a metre high)
        var fu = clampV(cu / 0.92, 0, 1);
        root = mul(root, about(RX(2 * PI * smooth(fu)), [0, 0.72, 0])); tuck = Math.sin(PI * fu);
        if (cu > 1.1) { a.celeb = null; }
      } else { twist = 0.28 * Math.sin(cu * 18) * (1 - cu / 0.7); if (cu > 0.7) { a.celeb = null; } }
    }
    root = mul(root, mul(RX(-a.leanF), RA([0, 0, 1], -a.leanS)));
    var diving = m && m.reach === "dive" && gt >= m.own[0], pitch = 0, roll = 0;
    if (diving) {
      var du = gt - m.own[0], land = m.tc + 0.08;
      pitch = gt < land ? 1.38 * smooth(du / 0.16) : gt < land + 0.42 ? 1.38 : 1.38 * (1 - smooth((gt - land - 0.42) / 0.3));
      roll = gt > land && gt < land + 0.42 ? 2 * PI * smooth((gt - land) / 0.42) : 0;
      root = mul(root, mul(T(0, -0.22 * smooth(pitch / 1.38), 0), mul(about(RX(-pitch), [0, 0.45, 0]), RY(roll))));
    }
    // the legs: where each foot goes, in his frame
    var vbx = a.vx * Math.cos(yaw) + a.vz * Math.sin(yaw), vbf = a.vx * Math.sin(yaw) - a.vz * Math.cos(yaw), vl = hypot(vbx, vbf) || 1;
    var dirB = [vbx / vl, 0, -vbf / vl], amt = min(1, a.speed / 1.2);
    var feet = R.legs.map(function (L, i) {
      var ph = a.phase + (i ? PI : 0), f = [L.hip[0] + L.sign * a.wide, 0.07, L.hip[2]];   // (the ankle, 7 cm off the ground)
      var st = a.stepL / 2 * Math.cos(ph) * amt, lift = max(0, -Math.sin(ph)) * (0.05 + 0.04 * a.speed) * amt;
      f[0] += dirB[0] * st; f[2] += dirB[2] * st; f[1] += lift;
      if (a.air) { f = [L.hip[0] + L.sign * 0.08, 0.22 + 0.25 * tuck + (a.hop ? -0.12 : 0), L.hip[2] - 0.12 - 0.2 * tuck]; }
      if (m && m.own && gt >= m.own[0] && gt < m.end) {
        var lead = (m.fore ? L.s === "right" : L.s === "left");
        if (m.reach === "lunge" || m.reach === "dig") { f = [L.hip[0] + L.sign * 0.1, 0.07, L.hip[2] + (lead ? -0.75 : 0.42)]; }
        if ((m.reach === "leap" || m.reach === "super") && a.air) { var sw = Math.sin((gt - m.up) * 14) * 0.25; f = [L.hip[0], 0.3, L.hip[2] + (lead ? -sw : sw)]; }   // the scissor kick
        if (diving) { f = [L.hip[0] + L.sign * 0.12, L.hip[1] - 0.55, L.hip[2] + 0.1]; }
      }
      if (m && m.reach === "dig" && gt >= m.t0 && gt < m.end) { f = [L.hip[0] + L.sign * 0.12, 0.07, L.hip[2] + ((m.fore ? L.s === "right" : L.s === "left") ? -0.5 : 0.38)]; }
      return f;
    });
    R.legs.forEach(function (L, i) {
      var f = feet[i], hy = L.hip[1] - drop, dx = f[0] - L.hip[0], dy = max(0.05, hy - f[1]), dz = f[2] - L.hip[2];
      var sig = Math.atan2(dx, dy), v = hypot(dx, dy), d = clampV(hypot(v, dz), abs(L.lt - L.ls) + 0.02, L.lt + L.ls - 0.004);
      var phi = Math.atan2(-dz, v), A = Math.acos(clampV((L.lt * L.lt + d * d - L.ls * L.ls) / (2 * L.lt * d), -1, 1));
      var K = Math.acos(clampV((L.lt * L.lt + L.ls * L.ls - d * d) / (2 * L.lt * L.ls), -1, 1)), al = phi + A, ga = al - (PI - K);
      var thigh = mul(T(0, -drop, 0), about(mul(RA([0, 0, 1], sig), RX(al - L.a0)), L.hip));
      out.parts["thigh_" + L.s] = mul(root, mul(thigh, R.rest["thigh_" + L.s]));
      out.parts["shin_" + L.s] = mul(root, mul(thigh, mul(about(RX((ga - L.g0) - (al - L.a0)), L.knee), R.rest["shin_" + L.s])));
    });
    // the upper body: down with the pelvis, bent forward at the hips, the chest twisted for the stroke
    var sm = null, st0 = m && (m.reach === "super" ? m.sw : m.t0);
    if (m && gt >= st0 - 0.05 && gt < m.end) {
      var s1 = (gt - st0) / max(0.05, m.tc - st0), s2 = (gt - m.tc) / 0.34;
      sm = { pre: gt < m.tc, s: gt < m.tc ? s1 : s2, back: gt >= m.tc + 0.34 ? smooth((gt - m.tc - 0.34) / 0.26) : 0 };
      var tw = m.kind === "serve" ? 0.35 : m.kind === "overhead" ? 0.5 : m.kind === "dink" || m.kind === "volley" ? 0.25 : 0.75;
      twist += (m.fore ? -1 : 1) * tw * (sm.pre ? (1 - 2 * smooth(clampV(s1, 0, 1)) * 0.6) * smooth(clampV(s1 * 3, 0, 1)) : -0.6 * (1 - sm.back));
      if (m.kind === "overhead") { bend -= 0.25 * (sm.pre ? 1 : 1 - sm.back); }
    }
    if (diving) { bend = 0.05; }
    var UB = mul(T(0, -drop, 0), mul(about(RX(-bend), R.pelvis), about(RY(twist), R.spine))), W = mul(root, UB);
    out.parts.pelvis = mul(root, mul(T(0, -drop, 0), R.rest.pelvis));
    out.parts.torso = mul(W, R.rest.torso);
    out.parts.hat = mul(W, R.rest.hat);   // (his hat on his head again, riding it)
    // the right arm and the guitar along it: where the stroke wants the bout (in his frame), else held up in front,
    // ready, or carried over his shoulder at a sprint, swinging a little with the stride
    var Wi = PB.inverse(W), local = function (pw) { return apply(Wi, pw); }, tgt;
    var ready = add(R.sR, [0.3, 0.45, -0.8]), carry = add(R.sR, [0.18, 0.8, 0.5 + 0.12 * Math.sin(a.phase)]);
    tgt = lerp3(ready, carry, smooth((a.speed - 3) / 4));
    if (diving && !sm) { tgt = add(R.sR, [0, -0.15, -1]); }
    // (the super return's windmill: the guitar over and over in the plane at his right side, forward over the top, a
    // turn and a half, slow as it is raised and quickening, to the overhead's wind-up as the strike begins)
    if (m && m.reach === "super" && gt < m.sw) { var wu = clampV((gt - m.own[0]) / (m.sw - m.own[0]), 0, 1), th = -2.3 - 9.61 * Math.pow(wu, 1.7); tgt = add(R.sR, [0.3, Math.cos(th), Math.sin(th)]); }
    if (a.celeb && a.celeb.kind === "flip") { tgt = add(R.sR, [0.25, 0.95, -0.15]); }
    if (sm) {
      var C = local(m.p), rel = sub(C, R.sR), W0, F0, k = m.kind;
      if (k === "serve") { W0 = [0.3, -0.62, 0.45]; F0 = [-0.05, 0.3, -0.6]; }
      else if (k === "overhead") { W0 = [0.25, 0.55, 0.42]; F0 = [-0.25, -0.62, -0.32]; }
      else if (k === "dig") { W0 = [0.38, -0.66, 0.25]; F0 = [-0.1, -0.05, -0.62]; }
      else if (k === "dink" || k === "volley") { W0 = add(rel, [m.fore ? 0.16 : -0.16, 0.02, 0.24]); F0 = add(rel, [m.fore ? -0.06 : 0.06, 0.14, -0.26]); }
      else { W0 = m.fore ? [0.62, rel[1], 0.38] : [-0.55, rel[1], 0.3]; F0 = m.fore ? [-0.5, rel[1] + 0.42, -0.3] : [0.52, rel[1] + 0.38, -0.3]; }
      var pth = sm.pre ? lerp3(W0, rel, clampV(sm.s, 0, 1) * clampV(sm.s, 0, 1)) : lerp3(rel, F0, 1 - (1 - clampV(sm.s, 0, 1)) * (1 - clampV(sm.s, 0, 1)));
      tgt = lerp3(add(R.sR, pth), tgt, sm.back);
    }
    var dirR = norm(sub(tgt, R.sR)), Rr = rotTo(norm(R.a0), dirR);
    out.parts.arm_right = mul(W, mul(about(Rr, R.sR), R.rest.arm_right));
    var palmL = add(R.sR, sc(dirR, R.armL));
    out.paddleC = apply(W, add(palmL, sc(dirR, R.gL)));
    // the left arm: out for balance at ready, pumping against the legs at speed, reaching with the stroke
    var lt = lerp3([-0.32, -0.45, -0.45], [-0.08, -0.7, -0.38 * Math.sin(a.phase + PI)], smooth((a.speed - 3) / 4));
    if (sm) { lt = sm.pre ? [-0.2, -0.05, -0.65] : [-0.45, -0.5, 0.1]; }
    if (m && m.reach === "super" && gt < m.end) { lt = [-0.62, 0.35, -0.1]; }   // (out wide, a windmilling guitarist's balance)
    if (a.celeb && a.celeb.kind === "flip") { lt = [-0.5, 0.55, -0.1]; }
    out.parts.arm_left = mul(W, mul(about(rotTo(norm(R.uL0), norm(lt)), R.sL), R.rest.arm_left));
    // the guitar: its neck in the glove, along the arm's line, its top turned towards where the shot goes (or ahead)
    var faceW = m && sm ? norm(m.aim) : turn(root, [0, 0, -1]), fl = turn(Wi, faceW);
    fl = sub(fl, sc(dirR, dot(fl, dirR)));
    if (hypot(fl[0], fl[1], fl[2]) < 1e-3) { fl = cross(dirR, [1, 0, 0]); }
    fl = norm(fl);
    var Rg = mul(basis(dirR, fl), transposeR(R.gBasis));
    out.guitar = mul(W, mul(T(palmL[0], palmL[1], palmL[2]), mul(Rg, mul(T(-R.gG[0], -R.gG[1], -R.gG[2]), R.rest.guitar))));
    out.paddleN = norm(turn(W, fl));
    out.headC = apply(W, R.head);
    out.headM = [W[0], W[1], W[2], W[4], W[5], W[6], W[8], W[9], W[10]];
    out.W = W;
    return out;
  }

  /* ---- the ASCII pass ----------------------------------------------------------------------------------------------
     The only way a frame reaches the screen. The artist, 28 Oct 2026: "just because we are using the ASCII aesthetic,
     doesn't mean we can't achieve any other aesthetic. We are just achieving the aesthetic using the characters and
     marks in ASCII". The scene is drawn into a picture of its own (colour with its octaves, each pixel's material in
     its alpha, and depth), and the picture is set again in type, as a terminal sets it: a grid of character cells, each
     as wide as the font's own advance and as tall as its '|' (so a column of bars joins into one line, a row of '_'
     into one rule), the glyphs the browser's own system monospace, drawn crisp at every size the grid uses (one big
     glyph shrunk through blurred octaves smeared the small ones to dots).
     The size: a cell's side across the line goes as the square of nearness (the artist's rule from the rocket world:
     6 CSS px at 3.2 m), in octaves, nested so a character is never cut by a smaller one; never under a type size of
     ASC.FLOOR (8 CSS px on a phone, 12 on a desk: about one angle at the eye at 30 cm and at 60 cm; at 1x about the
     smallest a character stays itself, X11's 'fixed' 6x13) nor over ASC.CEIL (one octave up: two were twenty letters
     across a phone, a wall). Square cells of 5 CSS px wrote glyphs four pixels high, which no one could read. Two
     things go past the floor, each for the game: a far athlete (under sixteen lines tall) is set an octave under it
     where a character still has twelve device pixels (a phone, not a desk at 1x), so far off Mr Plan still has a hat,
     a body and legs; and the pearl is set an octave over its distance's, the one character the game hangs on.
     The choice, once per cell (a small pass, a texel a cell): the cell looks at its picture in twelve parts (three
     across, four down), the parts well behind its nearest thing let go dark, so a figure's edge is drawn by the figure.
     An athlete's edge (its silhouette, or a part in front of another) takes the character whose own ink, measured in
     the same twelve parts, is shaped most like the cell (Alex Harri's 'shape vectors', in his essay "ASCII characters
     are not pixels"): / \ | _ ( ) [ ] where it runs. A court line takes one stroke the way the line itself runs on the
     screen there (its axis, carried by the material, seen from the camera): - _ / \ |, + where two cross, in the one
     cell it runs nearest the middle of. Elsewhere a cell is a tone of its own material's alphabet, one tone to a band
     (dithered, a figure was a checkerboard): Mr Pearl the keyboard's (Glyph Light's ASCII style), Mr Plan, his
     negative, the site's marks (the artist: "Do marks and keyboard characters"); a court surface one
     quiet glyph whose spacing is its light (in a 4x4 Bayer order), the net #, a pole |, a lamp *, the night sky a few
     stars fixed to the sky. Each character is lit in the colour under it at full saturation, its value the cell's
     light, the brightest blooming (a halo drawn with the glyph, inside its cell); black between. Mr Pearl's head marks
     its pixels (alpha 0.5) and passes through as it is.
     Steadiness: every choice above is a threshold, and twelve point samples of a moving picture sit on one now this
     side, now that, so an edge or a line flickered (| / |, - _ -, / blank /). So each choice is held by last frame's
     (the cells are kept twice, this frame's and last frame's), three ways: as a Schmitt trigger holds, near its
     threshold a cell keeps the glyph, the octave and the kind of choice it had; an outline's stroke keeps its way
     while that way still parts the figure's samples from the rest as well as the new one (one sample changing sides
     turned it a whole bin); and a change within one thing (a figure's strokes and tones, a court's lines and dots)
     shows only when it is asked for two frames running, so a one-frame flip is never drawn, while a thing arriving
     or leaving shows at once. The kind of choice and the change waiting ride in the colour channels' low bits (a
     255th or three of a colour's value: unseen, and no second target to write). A frame not straight after the last
     of the same view (a pause, a cut, a jump of the camera) holds nothing, so a single frame is drawn as it always
     was. Read back frame by frame, the cells that flip back (A, B, A within six frames) fell by 62 to 84% in a rally,
     a walk and at the serve (by less in a sprint, a dive or a pan: 22 to 63%), and a still view does not change at all. */
  // (bg: each cell's own colour behind its character, dim, as ANSI art sets a cell's background: the courts read as
  // painted surfaces, ultramarine, turquoise and emerald, not dots on black (the artist, 28 Oct 2026: "There's still a
  // bit too much black, I want 33% more color so it looks a bit more like a Pickleball court"; pb_measure.js measures it,
  // the frame's mean chroma))
  var ASC = { FLOOR: [8, 12], CEIL: [16, 24], S0: 6, D0: 3.2, expo: 1.15, gam: 0.85, lit: 1.25, glow: 0.55, edge: 0.42, edgeMin: 0.07, bg: 0.43, halo: 0.6, haloR: 0.4, core: 1,
              FONT: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'DejaVu Sans Mono', 'Roboto Mono', 'Noto Sans Symbols 2', monospace",
              KEYS: " .:-=+*#%@", BODY: " .:+*#%@", PLAN: " ◇◆#%@", EDGES: "'.,-_/\\|()[]", MARKS: "∴∵→○◇△◎¶▢◆" };
  // the materials, written into the picture's alpha as 1 - id / 255 (his head's 0.5 stays apart from them)
  var MAT = { SKY: 0, GROUND: 1, RUNOFF: 2, COURT: 3, KITCHEN: 4, LINE: 5, NET: 6, POLE: 7, LAMP: 8, PEARL: 9, DUST: 10, ME: 12, PLAN: 13, LINEZ: 14, HATME: 15, HATPLAN: 16, GOLD: 17 };   // (a hat its own: from behind, hat and back are two shapes)
  // Definition (the artist, 28 Oct 2026: "It's still really hard to see anything, objects need to be three times as
  // defined as they are now"; notes/holographic-mr-pearl/harness/pb_define.js measures it, an athlete's light against
  // the ground round him at a glance): the athletes' fill dense and bright, never faint (fill: the least of its
  // alphabet; fillV: its value, dim to bright), their outline brighter still (edgeV), quieter a little when near
  // (near: their texture was a wall), their colour lifted toward white only as far as it must be to be bright (lum:
  // Mr Plan's deep blues carried no light; the guitar's orange keeps its hue, so his parts read apart),
  // the courts' own surfaces quieter (surfV), and a cell of night kept clear round every figure (the moat), as type is
  // knocked out of a busy picture. The athletes are set in a heavy cut of the same characters (heavy: the stroke added
  // round each glyph, as a share of the cell's width; the atlas's third channel), the courts in the regular.
  var DEF = { fill: 0.7, fillPlan: 0.75, fillV: [1.0, 1.0], edgeV: 1.0, near: 0.0, surfV: 0.68, lum: 0.72, moat: true, moat2: 0.25, heavy: 0.14 };
  var asc = null;
  function ascFont(px) { return "700 " + px + "px " + ASC.FONT; }
  function ascInit() {
    // the font's own proportions: the advance, and the bar's reach above and below the baseline
    var p = document.createElement("canvas").getContext("2d"); p.font = ascFont(100);
    var bar = p.measureText("|"), adv = p.measureText("M").width / 100;
    var up = (bar.actualBoundingBoxAscent || 76) / 100, dn = (bar.actualBoundingBoxDescent || 24) / 100;
    var chars = (ASC.KEYS + ASC.EDGES + ASC.MARKS).split("").filter(function (c, i, a) { return a.indexOf(c) === i; });
    if (chars.length > 31) { throw new Error("pickleball: a cell holds its glyph in five bits (the sixth: heavy)"); }
    var vs = "#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }";
    asc = { adv: adv, up: up, dn: dn, chars: chars, N: chars.length, glyphs: chars.join(""), vs: vs, ok: true, w: 0, h: 0, grid: "", fb: null, cfb: null };
  }
  // The atlas for a grid: every glyph at every octave the grid uses, drawn by the browser at that size (red: the glyph;
  // green: the glyph and its bloom), and each glyph's ink in the twelve parts of its cell, for the choice.
  function ascAtlas(cw, ch, top) {
    var A = asc, N = A.N, rows = [], y = 0, k, i;
    for (k = 0; k <= top; k += 1) {
      var W = cw << k, H = ch << k, cols = max(1, min(N, floor(4096 / W)));
      rows.push({ y: y, cols: cols, W: W, H: H }); y += H * Math.ceil(N / cols);
    }
    var cv = document.createElement("canvas"); cv.width = rows.reduce(function (s, r) { return max(s, r.W * r.cols); }, 1); cv.height = y;
    var c = cv.getContext("2d"); c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height); c.textAlign = "center"; c.textBaseline = "alphabetic";
    var fit = function (ch, f, r) {
      c.font = ascFont(f); var m = c.measureText(ch);
      var bw = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width), bh = (m.actualBoundingBoxAscent || f * 0.7) + (m.actualBoundingBoxDescent || 0);
      return f * min(0.86 * r.W / max(bw, 1), 0.6 * r.H / max(bh, 1));
    };
    rows.forEach(function (r) {
      var f = r.H / (A.up + A.dn);
      // the marks (often from a fallback font, drawn at its own size) at one size together, as a font's are, the
      // largest of them (but the arrow, which the scene never writes) fitted to a capital's box
      var ms = ASC.MARKS.split("").filter(function (q) { return q !== "→"; }).reduce(function (a, q) { return min(a, fit(q, f, r)); }, 1e9);
      A.chars.forEach(function (ch, i) {
        if (ch === " ") { return; }
        var x0 = (i % r.cols) * r.W, y0 = r.y + floor(i / r.cols) * r.H, s = f, by = y0 + A.up * f;
        c.font = ascFont(f);
        var m = c.measureText(ch), bw = (m.actualBoundingBoxLeft || 0) + (m.actualBoundingBoxRight || m.width);
        if (ASC.MARKS.indexOf(ch) >= 0) {
          // a mark: at the marks' size, on the cell's middle
          s = min(ms, fit(ch, f, r));
          c.font = ascFont(s); m = c.measureText(ch);
          by = y0 + r.H * 0.5 + ((m.actualBoundingBoxAscent || 0) - (m.actualBoundingBoxDescent || 0)) / 2;
        } else if (bw > r.W * 0.98) { s = f * r.W * 0.98 / bw; c.font = ascFont(s); }
        c.save(); c.beginPath(); c.rect(x0, y0, r.W, r.H); c.clip();
        c.globalCompositeOperation = "lighter";
        c.fillStyle = "#f00"; c.fillText(ch, x0 + r.W / 2, by);
        c.shadowColor = "#0f0"; c.shadowBlur = max(1.5, r.W * 0.22); c.fillStyle = "#0b0"; c.fillText(ch, x0 + r.W / 2, by);
        c.shadowBlur = 0; c.shadowColor = "rgba(0,0,0,0)"; c.fillStyle = "#00f"; c.strokeStyle = "#00f"; c.lineJoin = "round";
        c.lineWidth = max(1, r.W * DEF.heavy); c.fillText(ch, x0 + r.W / 2, by); c.strokeText(ch, x0 + r.W / 2, by);   // (the heavy cut)
        c.restore();
      });
    });
    // each glyph's ink in the twelve parts of its cell (from the largest octave), and its whole ink
    var R = rows[top], d = c.getImageData(0, R.y, R.W * R.cols, R.H * Math.ceil(N / R.cols)).data, rw = R.W * R.cols;
    var vec = new Float32Array(N * 12), ink = new Float32Array(N), hi = 0;
    for (i = 0; i < N; i += 1) {
      var gx = (i % R.cols) * R.W, gy = floor(i / R.cols) * R.H;
      for (var yy = 0; yy < R.H; yy += 1) {
        for (var xx = 0; xx < R.W; xx += 1) {
          var v = d[((gy + yy) * rw + gx + xx) * 4] / 255, part = min(3, floor(yy * 4 / R.H)) * 3 + min(2, floor(xx * 3 / R.W));
          vec[i * 12 + part] += v; ink[i] += v;
        }
      }
      for (k = 0; k < 12; k += 1) { vec[i * 12 + k] /= R.W * R.H / 12; hi = max(hi, vec[i * 12 + k]); }
    }
    var px = new Uint8Array(N * 12);
    for (i = 0; i < N * 12; i += 1) { px[i] = round(255 * vec[i] / hi); }
    if (A.atlas) { gl.deleteTexture(A.atlas); gl.deleteTexture(A.gv); }
    A.atlas = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, A.atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    texNearest();
    A.gv = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, A.gv);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 3, N, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    texNearest();
    A.rows = rows; A.ink = ink;
    if (!A.cellP) { ascPrograms(); }
  }
  function texNearest() {
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  // The two programs: the choice (a texel a cell, at each octave) and the setting (a pixel: its cell, its glyph's ink).
  function ascPrograms() {
    var A = asc, ix = function (ch) { return A.chars.indexOf(ch); };
    // an alphabet sorted by the ink each glyph leaves (measured above, in this font): space first
    var ramp = function (s) { return s.split("").map(ix).sort(function (a, b) { return A.ink[a] - A.ink[b]; }); };
    var RK = ramp(ASC.BODY), RP = ramp(ASC.PLAN);
    var EK = ramp(ASC.EDGES), EP = ramp(ASC.EDGES);
    var arr = function (n, a) { return "const int " + n + "[" + a.length + "] = int[" + a.length + "](" + a.join(", ") + ");"; };
    // a material's own glyph where it is one quiet texture (-1: the keyboard's ramp, -2: the marks')
    var fix = [-3, ix("."), ix("."), ix(":"), ix("∴"), ix("."), ix("#"), ix("|"), ix("*"), ix("◎"), ix("'"), -1, -1, -2, ix("."), -1, -2, -1];
    var head = [
      "#version 300 es", "precision highp float; precision highp int;",
      arr("RK", RK), arr("RP", RP), arr("EK", EK), arr("EP", EP), arr("FIX", fix),
      "const int PEARL_G = " + ix("◎") + ", PLUS_G = " + ix("+") + ", UNDER_G = " + ix("_") + ", DASH_G = " + ix("-") + ", BAR_G = " + ix("|") + ", SLASH_G = " + ix("/") + ", BACK_G = " + ix("\\") + ", STAR_G[3] = int[3](" + [ix("."), ix("+"), ix("*")].join(", ") + ");",
      // the kinds of choice, held from frame to frame (0: none to hold)
      "const int K_THING = 1, K_SMALL = 2, K_LINE = 3, K_EDGE = 4, K_SURF = 5, K_BODY = 6, K_MOAT = 7;",
      "float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }"].join("\n");
    A.cellP = compile(A.vs, [head,
      "uniform sampler2D uScene; uniform highp sampler2D uDepth; uniform sampler2D uGV; uniform sampler2D uPrev;",
      "uniform vec2 uRes, uCell; uniform int uLev, uTop, uFloor, uBalls, uHold; uniform vec4 uBall[8];",
      "uniform float uNear, uFar, uRule, uExpo, uGam, uEdge, uEdgeMin, uFocal, uAsp;",
      "uniform vec3 uF, uR, uU, uEye; uniform vec2 uK;",
      "out vec4 o;",
      "float lin(float z) { return z >= 1.0 ? 1e4 : 2.0 * uNear * uFar / (uFar + uNear - (z * 2.0 - 1.0) * (uFar - uNear)); }",
      "float tone(vec3 c) { return pow(clamp(lum(c) * uExpo, 0.0, 1.0), uGam); }",
      // the 4x4 Bayer order, in (0, 1)
      "float bayer(ivec2 p) { int x = p.x & 3, y = p.y & 3; int b = ((x ^ y) & 1) * 8 + (y & 1) * 4 + (((x ^ y) >> 1) & 1) * 2 + ((y >> 1) & 1); return (float(b) + 0.5) / 16.0; }",
      "float hash(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }",
      "vec3 hue(vec3 c) { return c / max(max(c.r, c.g), max(c.b, 1e-3)); }",
      // a body's alphabet (Mr Plan's marks, else the keyboard's), at t in it, never under 'least'; last frame's tone
      // (pg) held until t is a fifth of a band past its edge
      "int ramp(int mat, float t, int least, int pg) {",
      "  int n = mat == 13 ? RP.length() : RK.length();",
      "  float x = t * float(n - 1);",
      "  int i = int(clamp(floor(x + 0.5), float(least), float(n - 1)));",
      "  for (int j = 0; j < 8; j++) { if (j >= n) { break; } if ((mat == 13 ? RP[j] : RK[j]) == pg && j >= least && abs(x - float(j)) < 0.7) { i = j; } }",
      "  return mat == 13 ? RP[i] : RK[i];",
      "}",
      // a cell's colour with the kind of its choice in the channels' low bits, and w (a change waiting) in red's next
      // (a quarter over the integer, so a device that truncates in writing it keeps the bits as one that rounds does)
      "vec3 kept(vec3 c, int k, int w) { ivec3 q = (ivec3(clamp(c, 0.0, 1.0) * 255.0 + 0.5) & ivec3(~3, ~1, ~1)) | ivec3((k & 1) | (w << 1), (k >> 1) & 1, (k >> 2) & 1); return (vec3(q) + 0.25) / 255.0; }",
      // which choices are one thing's (a figure's, a court's): a change between them waits a frame
      "int fam(int k) { return k == K_SMALL || k == K_EDGE || k == K_BODY ? 1 : k == K_LINE || k == K_SURF ? 2 : 0; }",
      "void main() {",
      "  ivec2 ci = ivec2(gl_FragCoord.xy);",
      "  vec2 cs = uCell * exp2(float(uLev)), org = vec2(ci) * cs;",
      "  float lod = max(0.0, log2(min(cs.x / 3.0, cs.y / 4.0)) - 0.5);",
      // last frame's choice here, at this octave: its glyph, whether it was shown (its octave was this), its kind
      "  vec4 pv = texelFetch(uPrev, ci, uLev); int pa = int(pv.a * 255.0 + 0.5), pg = pa & 31; ivec3 pq = ivec3(pv.rgb * 255.0 + 0.5), pb = pq & 1;",
      "  int pk = uHold * (pb.r | (pb.g << 1) | (pb.b << 2)), pw = (pq.r >> 1) & 1; bool pAct = pa >= 128;",
      // (under the floor only an athlete is ever written: the parts' materials first, the rest only if one is there)
      "  if (uLev < uFloor) {",
      "    bool any = false;",
      "    for (int r = 0; r < 12; r++) { vec2 pd = org + (vec2(float(r % 3), float(r / 3)) + 0.5) * cs / vec2(3.0, 4.0); int k = int(floor((1.0 - texelFetch(uScene, ivec2(int(pd.x), int(uRes.y - pd.y)), 0).a) * 255.0 + 0.5)); any = any || (k >= 12 && k <= 17 && k != 14) || k == 9; }",
      "    if (!any) { o = vec4(0.0, 0.0, 0.0, 128.0 / 255.0); return; }",
      "  }",
      "  float v[12], d[12]; int id[12]; vec3 col[12];",
      "  float dn = 1e4; int near = -1, heads = 0;",
      "  for (int r = 0; r < 12; r++) {",
      "    vec2 pd = org + (vec2(float(r % 3), float(r / 3)) + 0.5) * cs / vec2(3.0, 4.0);",
      "    v[r] = 0.0; d[r] = 1e4; id[r] = 0; col[r] = vec3(0.0);",
      "    if (pd.x >= uRes.x || pd.y >= uRes.y) { id[r] = -2; continue; }",   // (off the screen: not the cell's to judge)
      "    ivec2 pu = ivec2(int(pd.x), int(uRes.y - pd.y));",
      "    float a = texelFetch(uScene, pu, 0).a;",
      "    col[r] = textureLod(uScene, (vec2(pu) + 0.5) / uRes, lod).rgb;",
      "    d[r] = lin(texelFetch(uDepth, pu, 0).r);",
      "    if (a > 0.25 && a < 0.75) { id[r] = -1; heads++; continue; }",   // his head: not this cell's to write
      "    id[r] = int(floor((1.0 - a) * 255.0 + 0.5));",
      "    if (id[r] != 0 && d[r] < dn) { dn = d[r]; near = r; }",
      "  }",
      // the octave this cell's nearest thing asks for (the rule, from the floor up), and whether this cell is one at
      // this octave. A far athlete (under sixteen lines tall at the floor) is set an octave under the floor, where
      // there is one (a character still twelve device pixels high): the rule's own 'far off, smaller characters', for
      // the one far thing that needs the lines to have a hat, a body and legs (at the floor Mr Plan was a blob)
      "  int mat = near >= 0 ? id[near] : 0;",
      "  int who = mat == 15 || mat == 17 ? 12 : mat == 16 ? 13 : mat;",   // (whose: a hat, or his gold guitar, is written in its owner's alphabet)
      "  bool gold = mat == 17;",
      "  bool fig = who == 12 || who == 13;",
      "  float want = uRule * (" + ASC.D0.toFixed(3) + " / dn) * (" + ASC.D0.toFixed(3) + " / dn);",
      // (held: an octave shown last frame here stays a tenth of an octave past its edge, one not shown stays off as
      // far; a far figure's octave three hundredths past its sixteen lines)
      "  float hv = pk == 0 ? 0.0 : pAct ? 0.1 : -0.1;",
      "  int lv = uFloor + int(clamp(floor(log2(max(want, 1e-3)) + 0.5 + (uLev > uFloor ? hv : 0.0)), 0.0, float(uTop - uFloor)));",
      "  bool farFig = fig && 1.8 * uFocal / dn < 16.0 * uCell.y * exp2(float(uFloor)) * (uLev == uFloor ? 1.0 - 0.3 * hv : 1.0);",
      "  int act = (uLev == 0 || (uLev <= lv && !(uLev == uFloor && farFig))) ? 128 : 0;",
      // the pearl: in the one cell that holds its middle, unless something stands in front of it, and an octave larger
      // than its distance asks (the one character the game hangs on: at the floor it was lost in Mr Plan's marks)
      "  for (int i = 0; i < 8; i++) {",
      "    if (i >= uBalls) { break; }",
      "    vec4 b = uBall[i];",
      "    float wb = uRule * (" + ASC.D0.toFixed(3) + " / b.z) * (" + ASC.D0.toFixed(3) + " / b.z);",
      "    int tg = min(uTop, uFloor + 1 + int(clamp(floor(log2(max(wb, 1e-3)) + 0.5), 0.0, float(uTop - uFloor))));",
      "    if (uLev >= tg && (uLev == tg || act > 0) && b.x >= org.x && b.x < org.x + cs.x && b.y >= org.y && b.y < org.y + cs.y) {",
      "      float zb = lin(texelFetch(uDepth, ivec2(int(b.x), int(uRes.y - b.y)), 0).r);",
      "      if (zb > b.z - 0.25) { o = vec4(kept(vec3(1.0, 0.97, 0.9), 0, 0), float(PEARL_G + 64 + 128) / 255.0); return; }",
      "    }",
      "  }",
      "  if (heads >= 9) { o = vec4(0.0, 0.0, 0.0, float(act) / 255.0); return; }",
      // the parts: each its light, those well behind the cell's nearest thing let go dark (the pearl's light too: it
      // is written in its own cell); and how much of the cell is its nearest thing's own
      "  float tol = 0.12 * dn + 0.25, tolF = 0.04 * dn + 0.06, mx = 0.0, mn = 1e4, sum = 0.0, cnt = 0.0, own = 0.0, ownV = 0.0, ownM = -1.0, back = 0.0; int hiR = 0, hiO = 0;",
      "  for (int r = 0; r < 12; r++) {",
      "    if (id[r] < 0) { continue; }",
      "    float st = d[r] - dn;",
      // (within an athlete, a part a little behind another (the body behind an arm) is half let go: its contour)
      "    v[r] = id[r] == 9 ? 0.0 : tone(col[r]) * (id[r] == mat && fig ? 1.0 - 0.6 * smoothstep(0.3 * tolF, tolF, st) : 1.0 - smoothstep(0.0, tol, st));",
      "    if (v[r] > mx) { mx = v[r]; hiR = r; }",
      "    if (id[r] == mat) { own += 1.0; ownV += v[r]; if (v[r] > ownM) { ownM = v[r]; hiO = r; } }",
      "    if (id[r] != mat || st > (fig ? tolF : 0.5 * tol)) { back += 1.0; }",
      "    mn = min(mn, v[r]); sum += v[r]; cnt += 1.0;",
      "  }",
      "  float m = sum / max(cnt, 1.0), dz = bayer(ci), mo = ownV / max(own, 1.0);",
      "  int g = 0, f = FIX[min(mat, 17)], kd = 0; float V = 0.0; vec3 c = hue(col[hiO]);",
      // the moat: a cell that is not a figure, beside one standing in front of it (its four neighbours' middles), is
      // left dark, so every athlete stands in a cell of night
      "  bool moat = false, moat2 = false;",
      "  if (" + (DEF.moat ? "true" : "false") + " && !fig && mat != 9 && uLev >= uFloor) {",
      "    for (int q = 0; q < 8; q++) {",
      "      int qd = q & 3; float qr = q < 4 ? 1.0 : 2.0;",
      "      vec2 pd = org + 0.5 * cs + vec2(qd == 0 ? -1.0 : qd == 1 ? 1.0 : 0.0, qd == 2 ? -1.0 : qd == 3 ? 1.0 : 0.0) * cs * qr;",
      "      if (pd.x < 0.0 || pd.y < 0.0 || pd.x >= uRes.x || pd.y >= uRes.y) { continue; }",
      "      ivec2 pu = ivec2(int(pd.x), int(uRes.y - pd.y)); int k = int(floor((1.0 - texelFetch(uScene, pu, 0).a) * 255.0 + 0.5));",
      "      if (k >= 12 && k <= 17 && k != 14 && lin(texelFetch(uDepth, pu, 0).r) < dn - 0.2) { if (q < 4) { moat = true; } else { moat2 = true; } }",
      "    }",
      "  }",
      "  bool surf = mat <= 5 || mat == 14;",
      // (the parts on a court's line or within a few pixels of one, and which way it runs: a surface is stroked only
      // there; its boundary with the next zone, or with the net's foot, is a change of texture, never a stroke)
      "  int nx = 0, nz = 0, ra = near;",
      "  for (int r = 0; r < 12; r++) { if (id[r] == 5) { nx++; ra = r; } else if (id[r] == 14) { nz++; ra = r; } }",
      // a body's tones: the window its light falls in, spread over its whole alphabet (Mr Plan, the lifted negative,
      // sits lower than Mr Pearl's pearl white)
      "  vec2 win = who == 13 ? vec2(0.1, 0.62) : who == 12 ? vec2(0.4, 1.25) : vec2(0.06, 0.75);",
      // a figure under some twenty lines tall is written whole, every cell it touches in its own alphabet and light
      // (a small clear shape; drawn by its edges it was a scatter of strokes)
      "  bool small = fig && 1.8 * uFocal / dn < 10.0 * cs.y * (pk == K_SMALL ? 1.03 : pk == K_EDGE || pk == K_BODY ? 0.97 : 1.0);",
      // (under the floor only the figure is written: a far athlete stands in a small clearing of the ground's type)
      "  if (uLev < uFloor && !fig) { o = vec4(0.0, 0.0, 0.0, float(act) / 255.0); return; }",
      "  if (mat == 0) {",
      // the sky: dark, a few stars, fixed to the sky (a star in the one cell its direction falls in)
      "    vec2 nd = vec2((org.x + 0.5 * cs.x) / uRes.x * 2.0 - 1.0, 1.0 - (org.y + 0.5 * cs.y) / uRes.y * 2.0);",
      "    vec3 dir = normalize(uF + nd.x * uK.x * uR + nd.y * uK.y * uU), q = floor(dir * 70.0);",
      "    float h = hash(q);",
      "    if (uLev == 0 && h < 0.025) {",
      "      vec3 st = normalize((q + 0.5 + 0.6 * (vec3(hash(q + 1.7), hash(q + 3.1), hash(q + 5.3)) - 0.5)) / 70.0);",
      "      float fz = dot(st, uF);",
      "      vec2 sp = vec2((dot(st, uR) / fz / uK.x * 0.5 + 0.5) * uRes.x, (0.5 - dot(st, uU) / fz / uK.y * 0.5) * uRes.y);",
      "      if (st.y > 0.03 && fz > 0.0 && sp.x >= org.x && sp.y >= org.y && sp.x < org.x + cs.x && sp.y < org.y + cs.y) {",
      "        g = STAR_G[h < 0.0015 ? 2 : h < 0.005 ? 1 : 0]; V = 0.3 + 14.0 * (0.025 - h); c = h < 0.008 ? vec3(1.0, 0.85, 0.7) : vec3(0.72, 0.85, 1.0);",
      "      }",
      "    }",
      // (the night itself, never black: a faint field of dots in its own colour, indigo overhead turning violet and rose
      // toward the horizon, thicker there where the floodlights' haze is)
      "    if (g == 0) {",
      "      float hz = 1.0 - smoothstep(0.0, 0.45, dir.y);",
      "      if (dz < 0.08 + 0.3 * hz) { g = STAR_G[0]; V = 0.22 + 0.3 * hz; c = mix(vec3(0.42, 0.3, 1.0), vec3(1.0, 0.42, 0.82), hz * hz); }",
      "    }",
      "  } else if (f >= 0 && !surf) {",
      // a thing of one glyph (the net #, a pole |, a lamp *, dust '), where it is
      "    if (own >= (mat == 6 ? 2.0 : 1.0) && (mat != 6 || dz < 0.55)) { g = f; V = mix(0.45, 1.0, smoothstep(0.05, 0.7, ownM)) * (mat == 6 ? 0.5 : 1.0); }",
      "    kd = K_THING;",
      "  } else if (small) {",
      "    kd = K_SMALL;",
      "    if (own >= 1.0) {",
      "      g = ramp(who, mix(0.7, 1.0, smoothstep(win.x, win.y, mo)), 1, pk == K_SMALL ? pg : -1); V = mix(" + DEF.fillV[0].toFixed(3) + ", 1.0, smoothstep(0.1, 0.8, mo));",
      "    }",
      "  } else if (surf && nx + nz > 0 && mx >= 0.3 + (pk == K_LINE ? -0.04 : pk == K_SURF ? 0.04 : 0.0)) {",
      // a court's line: one stroke the way its light lies in the cell (the light's second moments, in the cell's own
      // proportions; better, where a part of it is on the line, the line's own axis seen from here); a line along a
      // cell's top or left edge is the neighbour's
      "    float W = 0.0; vec2 mu = vec2(0.0); vec3 M2 = vec3(0.0);",
      "    for (int r = 0; r < 12; r++) { float wr = pow(max(v[r] - mn, 0.0), 2.0); W += wr; mu += wr * (vec2(float(r % 3), float(r / 3)) + 0.5) / vec2(3.0, 4.0); }",
      "    mu /= max(W, 1e-4);",
      "    for (int r = 0; r < 12; r++) { float wr = pow(max(v[r] - mn, 0.0), 2.0); vec2 e = ((vec2(float(r % 3), float(r / 3)) + 0.5) / vec2(3.0, 4.0) - mu) * vec2(uAsp, 1.0); M2 += wr * vec3(e.x * e.x, e.y * e.y, e.x * e.y); }",
      "    M2 /= max(W, 1e-4);",
      "    float th = degrees(0.5 * atan(2.0 * M2.z, M2.x - M2.y)), el = sqrt((M2.x - M2.y) * (M2.x - M2.y) + 4.0 * M2.z * M2.z) / max(M2.x + M2.y, 1e-6);",
      "    {",
      // the line's own direction on the screen, where it is: its point (from the depth), and a step along its axis
      "      vec2 pd = org + (vec2(float(ra % 3), float(ra / 3)) + 0.5) * cs / vec2(3.0, 4.0);",
      "      vec3 P = uEye + (uF + (pd.x / uRes.x * 2.0 - 1.0) * uK.x * uR + (1.0 - pd.y / uRes.y * 2.0) * uK.y * uU) * d[ra];",
      "      vec3 Q = P + (nx >= nz ? vec3(0.05, 0.0, 0.0) : vec3(0.0, 0.0, 0.05)) - uEye, R0 = P - uEye;",
      "      vec2 a0 = vec2(dot(R0, uR) / uK.x, -dot(R0, uU) / uK.y) / dot(R0, uF), a1 = vec2(dot(Q, uR) / uK.x, -dot(Q, uU) / uK.y) / dot(Q, uF);",
      "      vec2 sd = (a1 - a0) * uRes; if (sd.x < 0.0) { sd = -sd; }",
      "      th = degrees(atan(sd.y, max(sd.x, 1e-6))); el = 1.0;",
      "      if (nx >= 2 && nz >= 2) { el = 0.0; }",
      "    }",
      // its stroke: - (or _ along the cell's foot), / and \ about a cell's own diagonal, | upright, + where two cross
      "    float dg = degrees(atan(cs.y, cs.x));",
      // (held: last frame's stroke keeps its way six degrees past a bin's edge, and its place in the cell an eighth)
      "    float hs = pk == K_LINE ? 1.0 : 0.0; bool pD = pg == SLASH_G || pg == BACK_G, pH = pg == UNDER_G || pg == DASH_G;",
      "    float b0 = 0.5 * dg + hs * (pH ? 6.0 : pD ? -6.0 : 0.0), b1 = 0.5 * (dg + 90.0) + hs * (pg == BAR_G ? -6.0 : pD ? 6.0 : 0.0);",
      "    kd = K_LINE;",
      "    if (el < 0.2) { g = PLUS_G; }",
      "    else if (abs(th) < b0) { g = mu.y > 0.68 + hs * (pg == UNDER_G ? -0.08 : pg == DASH_G ? 0.08 : 0.0) ? UNDER_G : mu.y < 0.3 + hs * (pg == 0 ? 0.08 : pg == DASH_G ? -0.08 : 0.0) ? 0 : DASH_G; }",
      "    else if (abs(th) > b1) { g = mu.x < 0.22 + hs * (pg == 0 ? 0.08 : pg == BAR_G ? -0.08 : 0.0) ? 0 : BAR_G; }",
      "    else { vec2 dv = vec2(cos(radians(th)), sin(radians(th))), off = (mu - 0.5) * cs; g = abs(off.x * dv.y - off.y * dv.x) > (0.38 + hs * (pg == 0 ? -0.12 : pD ? 0.12 : 0.0)) * cs.x ? 0 : th < 0.0 ? SLASH_G : BACK_G; }",
      "    c = hue(col[hiR]); V = mix(0.5, 1.0, smoothstep(0.3, 0.7, mx));",
      "  } else if (!surf && back > 0.0 && mx >= uEdgeMin && (mx - mn) / mx > uEdge + (pk == K_EDGE ? -0.04 : pk == K_BODY ? 0.04 : 0.0)) {",
      // an edge: the character shaped most like the cell (the parts' light, its contrast drawn up, against each
      // candidate's ink, as the cosine of the two); a court's only from the strokes
      "    vec4 n0 = vec4(0.0), n1 = vec4(0.0), n2 = vec4(0.0), k0 = vec4(1.0), k1 = vec4(1.0), k2 = vec4(1.0);",
      "    for (int r = 0; r < 12; r++) {",
      "      float q = id[r] < 0 ? 0.0 : pow(v[r] / mx, 2.2), kq = id[r] < 0 ? 0.0 : 1.0;",
      "      if (r < 4) { n0[r] = q; k0[r] = kq; } else if (r < 8) { n1[r - 4] = q; k1[r - 4] = kq; } else { n2[r - 8] = q; k2[r - 8] = kq; }",
      "    }",
      "    float best = -1.0, sp = -1.0; kd = K_EDGE;",
      // an athlete's silhouette: the stroke along it, by where his own front parts lie in the cell (their middle, from
      // the cell's: the inward normal, in the cell's own proportions), as a draughtsman's line; only where that is
      // ambiguous (a contour inside him, a speck) the glyph shaped most like the cell
      "    vec2 cen = vec2(0.0); float fr = 0.0;",
      "    for (int r = 0; r < 12; r++) { if (id[r] == mat && d[r] - dn <= tolF) { cen += (vec2(float(r % 3), float(r / 3)) + 0.5) / vec2(3.0, 4.0); fr += 1.0; } }",
      "    vec2 nI = (cen / max(fr, 1.0) - 0.5) * vec2(uAsp, 1.0); float cov = fr / max(cnt, 1.0);",
      // (held: last frame's stroke stays a stroke to 0.06, keeps its way eight degrees past a bin's edge, and its _ or
      // - a sample's coverage either side)
      "    float he = pk == K_EDGE ? 1.0 : 0.0; bool qD = pg == SLASH_G || pg == BACK_G, qH = pg == UNDER_G || pg == DASH_G;",
      "    if (fig && fr > 0.0 && length(nI) > 0.09 + he * (qD || qH || pg == BAR_G ? -0.03 : 0.03)) {",
      "      float dg = degrees(atan(cs.y, cs.x)), th = degrees(atan(abs(nI.y), abs(nI.x))), hc = he * (pg == UNDER_G ? -0.06 : pg == DASH_G ? 0.06 : 0.0);",
      "      if (th < 45.0 - 0.5 * dg + he * (pg == BAR_G ? 8.0 : qD ? -8.0 : 0.0)) { g = BAR_G; }",
      "      else if (th > 90.0 - 0.5 * dg + he * (qH ? -8.0 : qD ? 8.0 : 0.0)) { g = (nI.y < 0.0 ? cov > 0.55 + hc : cov < 0.45 - hc) ? UNDER_G : DASH_G; }",
      "      else { g = nI.x * nI.y < 0.0 ? BACK_G : SLASH_G; }",
      "      best = 2.0;",
      "    }",
      "    int ne = who == 13 ? EP.length() : EK.length();",
      "    for (int j = 0; j < 48; j++) {",
      "      if (j >= ne || best > 1.5) { break; }",
      "      int e = who == 13 ? EP[j] : EK[j];",
      "      vec4 g0 = texelFetch(uGV, ivec2(0, e), 0) * k0, g1 = texelFetch(uGV, ivec2(1, e), 0) * k1, g2 = texelFetch(uGV, ivec2(2, e), 0) * k2;",
      "      float gg = dot(g0, g0) + dot(g1, g1) + dot(g2, g2);",
      "      float s = (dot(n0, g0) + dot(n1, g1) + dot(n2, g2)) * inversesqrt(max(gg, 1e-4));",
      "      if (s > best) { best = s; g = e; }",
      "      if (e == pg) { sp = s; }",
      "    }",
      "    if (he > 0.0 && best < 1.5 && sp > -0.5 && best - sp < 0.05) { g = pg; }",
      "    bool qV = pg == BAR_G, nH = g == UNDER_G || g == DASH_G;",
      "    if (he > 0.0 && best > 1.5 && (qV || qD || qH) && !(qH && nH) && pg != g) {",
      "      vec2 cF = vec2(0.0), cB = vec2(0.0); float nf = 0.0, nb = 0.0;",
      "      for (int r = 0; r < 12; r++) { if (id[r] < 0) { continue; } vec2 p = (vec2(float(r % 3), float(r / 3)) + 0.5) / vec2(3.0, 4.0) * vec2(uAsp, 1.0); if (id[r] == mat && d[r] - dn <= tolF) { cF += p; nf += 1.0; } else { cB += p; nb += 1.0; } }",
      "      if (nb > 0.0) {",
      "        cF /= nf; cB /= nb; vec2 m0 = 0.5 * (cF + cB);",
      "        vec2 wP = qV ? vec2(1.0, 0.0) : qH ? vec2(0.0, 1.0) : pg == SLASH_G ? vec2(1.0, uAsp) : vec2(1.0, -uAsp);",
      "        vec2 wN = g == BAR_G ? vec2(1.0, 0.0) : nH ? vec2(0.0, 1.0) : g == SLASH_G ? vec2(1.0, uAsp) : vec2(1.0, -uAsp);",
      "        wP *= dot(cF - cB, wP) < 0.0 ? -1.0 : 1.0; wN *= dot(cF - cB, wN) < 0.0 ? -1.0 : 1.0;",
      "        float eP = 0.0, eN = 0.0;",
      "        for (int r = 0; r < 12; r++) { if (id[r] < 0) { continue; } vec2 p = (vec2(float(r % 3), float(r / 3)) + 0.5) / vec2(3.0, 4.0) * vec2(uAsp, 1.0) - m0; bool fo = id[r] == mat && d[r] - dn <= tolF; eP += (dot(p, wP) > 0.0) != fo ? 1.0 : 0.0; eN += (dot(p, wN) > 0.0) != fo ? 1.0 : 0.0; }",
      "        if (eP <= eN) { g = pg; }",
      "      }",
      "    }",
      "    c = fig ? mix(hue(col[hiR]), who == 13 ? vec3(0.3, 0.95, 1.0) : vec3(1.0, 0.72, 0.28), 0.8) : hue(col[hiR]); V = mix(fig ? " + DEF.edgeV.toFixed(3) + " : 0.6, 1.0, smoothstep(0.0, 0.6, mx));",   // (an athlete's outline in his accent: Mr Pearl's gold, Mr Plan's cyan)
      "  } else if (f >= 0) {",
      // a surface: its own glyph, its spacing its light (in Bayer order)
      "    float lo = mat == 1 ? 0.1 : mat == 2 ? 0.12 : 0.05, hi = mat == 1 ? 0.3 : mat == 2 ? 0.4 : 0.2;",
      "    if (max(smoothstep(lo, hi, m), mat == 1 ? 0.14 : 0.0) > dz + (pk == K_SURF ? (pg == f ? -0.04 : 0.04) : 0.0)) { g = f; }", "    kd = K_SURF;",   // (the ground off the courts: a faint teal field, never black)
      "    V = max(mix(0.32, 1.0, smoothstep(0.05, 0.8, m)) * " + DEF.surfV.toFixed(3) + ", mat == 1 ? 0.12 : 0.0);",
      "  } else {",
      // a body: its alphabet by its own light, one tone to a band (dithered, a figure was a checkerboard), the light
      // taken half from round the cell (so a tone holds over a part, not flickering cell to cell with the voxels'
      // faces), never a hole inside it
      "    vec2 cc = org + 0.5 * cs;",
      "    float bt = 0.5 * mo + 0.5 * tone(textureLod(uScene, vec2(cc.x, uRes.y - cc.y) / uRes, log2(max(cs.x, cs.y)) + 1.0).rgb);",
      // (a body near enough for the larger type is a quieter texture under its outline: the outline carries the form,
      // and the near glyphs, four times the floor's area, do not wall the view)
      "    float big = uLev > uFloor ? 1.0 : 0.0;",
      "    g = ramp(who, mix(who == 13 ? " + DEF.fillPlan.toFixed(3) + " : " + DEF.fill.toFixed(3) + ", 1.0, smoothstep(win.x, win.y, bt)) * (1.0 - " + DEF.near.toFixed(3) + " * big), 1, pk == K_BODY ? pg : -1); kd = K_BODY;",
      "    V = mix(" + DEF.fillV[0].toFixed(3) + ", " + DEF.fillV[1].toFixed(3) + ", smoothstep(0.0, 0.8, bt)) * (1.0 - " + DEF.near.toFixed(3) + " * big);",
      "  }",
      "  if (fig && !gold) { vec3 tn = who == 13 ? vec3(0.66, 0.92, 1.0) : vec3(1.0, 0.86, 0.62); c = mix(c, tn, 0.5); float lc = dot(c, vec3(0.299, 0.587, 0.114)), lt = dot(tn, vec3(0.299, 0.587, 0.114)); c = mix(c, tn, clamp((" + DEF.lum.toFixed(3) + " - lc) / max(lt - lc, 1e-3), 0.0, 1.0)); }",   // (never bare white: his champagne, Mr Plan's ice)
      // (his guitar, gold in the sun: deep amber in its shade, gold in its light, white-gold where the sun glints off it)
      "  if (gold && g > 0) { float gl = mo; c = mix(vec3(0.72, 0.36, 0.04), vec3(1.0, 0.74, 0.18), smoothstep(0.15, 0.55, gl)); c = mix(c, vec3(1.0, 0.97, 0.86), smoothstep(0.7, 0.95, gl)); V = max(V, mix(0.55, 1.0, smoothstep(0.15, 0.75, gl))); }",
      "  if (moat) { g = STAR_G[0]; V = 0.09; c = vec3(0.42, 0.34, 1.0); kd = 0; } else if (moat2) { V *= " + DEF.moat2.toFixed(3) + "; kd = K_MOAT; }",   // (the moat a dim indigo, night rather than a hole)
      // (the ground's own characters glow too, in their colour: the court's ultramarine, the kitchen's turquoise, the
      // run-off's emerald, the night's violet fill the dark between them, colour in place of black, and no flat fill)
      "  int w = 0;",
      "  if (pk != 0 && fam(pk) == fam(kd) && fam(kd) != 0 && (g != pg || act != (pa & 128))) { w = 1; if (pw == 0) { g = pg; act = pa & 128; kd = pk; } }",   // (the flag kept while a cell keeps changing: the first change waits a frame, a moving cell then follows each frame)
      "  int bloom = (mat == 8 || V > 0.93 || (fig && g > 0) || (g > 0 && (surf || mat <= 1))) ? 64 : 0, heavy = fig && g > 0 ? 32 : 0;",
      "  o = vec4(kept(c * V, kd, w), float(g + heavy + bloom + act) / 255.0);",
      "}"].join("\n"));
    A.setP = compile(A.vs, [head,
      "uniform sampler2D uScene; uniform sampler2D uCells; uniform sampler2D uAtlas;",
      "uniform vec2 uRes; uniform ivec2 uCell; uniform int uTop; uniform ivec2 uAtl[4]; uniform float uLit, uGlow, uBg;",
      "out vec4 o;",
      "void main() {",
      "  vec4 pic = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0);",
      "  if (pic.a > 0.25 && pic.a < 0.75) { o = vec4(pic.rgb, 1.0); return; }",       // his head, the one thing as it is
      "  ivec2 pd = ivec2(int(gl_FragCoord.x), int(uRes.y - gl_FragCoord.y));",
      "  int k = uTop; ivec2 cs = uCell << k, ci = pd / cs; vec4 t = texelFetch(uCells, ci, k);",
      "  while (k > 0 && t.a < 0.5) { k--; cs = uCell << k; ci = pd / cs; t = texelFetch(uCells, ci, k); }",   // the largest cell that is one
      "  int a = int(t.a * 255.0 + 0.5), g = a & 31;",
      // the paint under the type: a court's surfaces and its lines (their kind, in the colour's low bits) over the
      // picture itself, the cell's average, dimmed and its colour drawn up; nothing under a figure, a thing or the sky
      "  ivec3 kb = ivec3(t.rgb * 255.0 + 0.5) & 1; int kd = kb.r | (kb.g << 1) | (kb.b << 2); vec3 bg = vec3(0.0);",
      "  if (kd == K_SURF || kd == K_LINE || kd == K_MOAT) {",
      "    vec2 cc = vec2(ci * cs) + 0.5 * vec2(cs);",
      "    vec3 sc = textureLod(uScene, vec2(cc.x, uRes.y - cc.y) / uRes, log2(float(max(cs.x, cs.y)))).rgb, hu = sc / max(max(sc.r, sc.g), max(sc.b, 1e-3));",
      "    bg = mix(sc, hu * max(max(sc.r, sc.g), sc.b), 0.5) * uBg * (kd == K_MOAT ? 0.35 : 1.0);",   // (the cell of night round a figure kept bare, the next a shadow on the paint)
      "  }",
      "  if (g == 0) { o = vec4(bg, 1.0); return; }",
      "  ivec2 at = ivec2((g % uAtl[k].y) * cs.x, uAtl[k].x + (g / uAtl[k].y) * cs.y) + pd - ci * cs;",
      "  vec3 ink = texelFetch(uAtlas, at, 0).rgb;",
      "  float ik = (a & 32) != 0 ? ink.b : ink.r;",
      "  o = vec4(t.rgb * (ik * uLit + ((a & 64) != 0 ? ink.g * uGlow : 0.0)) + bg * (1.0 - ik), 1.0);",
      "}"].join("\n"));
    A.CU = {}; A.SU = {};
    ["uScene", "uDepth", "uGV", "uPrev", "uHold", "uRes", "uCell", "uLev", "uTop", "uFloor", "uBalls", "uBall", "uNear", "uFar", "uRule", "uExpo", "uGam", "uEdge", "uEdgeMin", "uFocal", "uAsp", "uEye", "uF", "uR", "uU", "uK"].forEach(function (k) { A.CU[k] = gl.getUniformLocation(A.cellP, k); });
    ["uScene", "uCells", "uAtlas", "uRes", "uCell", "uTop", "uAtl", "uLit", "uGlow", "uBg"].forEach(function (k) { A.SU[k] = gl.getUniformLocation(A.setP, k); });
  }
  // the grid for this screen: the type's floor and ceiling (CSS px, a phone's and a desk's), the cell its advance by
  // its bar, in device pixels; an octave under the floor for far athletes where that is still 12 device pixels
  function ascGrid(w, h, dpr) {
    var ph = min(window.innerWidth, window.innerHeight) < 600 ? 0 : 1, fl = max(8, round(ASC.FLOOR[ph] * dpr)), F = fl >= 24 ? 1 : 0;
    var ch = F ? round(fl / 2) : fl, cw = max(3, round(ch * asc.adv / (asc.up + asc.dn)));
    var top = F + max(0, min(2, round(Math.log2(ASC.CEIL[ph] / ASC.FLOOR[ph]))));
    return { cw: cw, ch: ch, top: top, F: F, key: cw + "x" + ch + "x" + top };
  }
  function ascBegin(w, h, dpr) {
    if (!asc || !asc.ok) { return false; }
    var G = ascGrid(w, h, dpr);
    if (G.key !== asc.grid) {
      try { ascAtlas(G.cw, G.ch, G.top); } catch (e) { YT.warn(e); asc.ok = false; return false; }   // (the characters cannot be built here: the scene as it is)
      asc.grid = G.key; asc.w = 0;
    }
    asc.G = G;
    if (!asc.fb || asc.w !== w || asc.h !== h) {
      if (asc.fb) { gl.deleteFramebuffer(asc.fb); gl.deleteTexture(asc.col); gl.deleteTexture(asc.dep); gl.deleteFramebuffer(asc.cfb); asc.cells.forEach(function (t) { gl.deleteTexture(t); }); }
      var col = gl.createTexture(), dep = gl.createTexture(), fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, col);
      gl.texStorage2D(gl.TEXTURE_2D, floor(Math.log2(max(w, h))) + 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, dep);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      texNearest();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dep, 0);
      asc.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      // the cells: a texel each, an octave a level (the grid's size rounded up so every octave halves it exactly); twice,
      // this frame's and last frame's, in turn
      var u = 1 << G.top, gw = Math.ceil(Math.ceil(w / G.cw) / u) * u, gh = Math.ceil(Math.ceil(h / G.ch) / u) * u;
      var cells = [0, 1].map(function () { var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texStorage2D(gl.TEXTURE_2D, G.top + 1, gl.RGBA8, gw, gh); texNearest(); return t; });
      asc.fb = fb; asc.col = col; asc.dep = dep; asc.w = w; asc.h = h; asc.cells = cells; asc.turn = 0; asc.last = null; asc.gw = gw; asc.gh = gh; asc.cfb = gl.createFramebuffer();
      if (!asc.ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }   // (a device without it: the scene straight to the screen)
    }
    asc.balls = [];
    gl.bindFramebuffer(gl.FRAMEBUFFER, asc.fb);
    return true;
  }
  // a pearl drawn this frame: where its middle falls on the screen (device px from the top left) and how far it is
  function ascBall(p, w, h) {
    var vp = cur.vp, q = [0, 0, 0, 0];
    for (var i = 0; i < 4; i += 1) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; }
    if (!asc || !asc.balls || q[3] < 0.05 || asc.balls.length >= 32) { return; }   // (eight pearls, four numbers each)
    var x = (q[0] / q[3] * 0.5 + 0.5) * w, y = (0.5 - q[1] / q[3] * 0.5) * h;
    if (x >= 0 && x < w && y >= 0 && y < h) { asc.balls.push(x, y, q[3], 0); }
  }
  function ascEnd(w, h, dpr, yaw, pitch) {
    var A = asc, G = A.G, CU = A.CU, SU = A.SU, md = ascMod || {};   // (the super return plays with the pass: its density, exposure and glow, for a moment)
    gl.bindTexture(gl.TEXTURE_2D, A.col); gl.generateMipmap(gl.TEXTURE_2D);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.bindVertexArray(null);
    // the choice: a texel a cell, each octave into its level
    gl.useProgram(A.cellP);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, A.col); gl.uniform1i(CU.uScene, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, A.dep); gl.uniform1i(CU.uDepth, 3);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, A.gv); gl.uniform1i(CU.uGV, 4);
    gl.activeTexture(gl.TEXTURE0);
    var f = lookDir(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)], u = cross(r, f);
    gl.uniform3fv(CU.uF, f); gl.uniform3fv(CU.uR, r); gl.uniform3fv(CU.uEye, cur.eye); gl.uniform3fv(CU.uU, u); gl.uniform2f(CU.uK, T35 * w / h, T35);
    gl.uniform2f(CU.uRes, w, h); gl.uniform2f(CU.uCell, G.cw, G.ch); gl.uniform1i(CU.uTop, G.top); gl.uniform1f(CU.uFocal, h / (2 * T35)); gl.uniform1f(CU.uAsp, G.cw / G.ch);
    gl.uniform1f(CU.uNear, NEAR); gl.uniform1f(CU.uFar, FAR);
    gl.uniform1f(CU.uRule, ASC.S0 * dpr * (md.s0 || 1) / (G.cw << G.F)); gl.uniform1i(CU.uFloor, G.F);
    gl.uniform1f(CU.uExpo, ASC.expo * (md.expo || 1)); gl.uniform1f(CU.uGam, ASC.gam); gl.uniform1f(CU.uEdge, ASC.edge); gl.uniform1f(CU.uEdgeMin, ASC.edgeMin);
    var bl = new Float32Array(32); bl.set(A.balls.slice(0, 32)); gl.uniform4fv(CU.uBall, bl); gl.uniform1i(CU.uBalls, A.balls.length / 4);
    // last frame's choices, held only if it was the frame just before of the same view (not after a pause, a cut, a
    // jump of the camera: then this frame is drawn as a single frame is)
    var now = A.cells[A.turn], L = A.last, e = cur.eye;
    var hold = L && gt - L.t <= 0.1 && hypot(e[0] - L.e[0], e[1] - L.e[1], e[2] - L.e[2]) < 1 && abs(angle(yaw - L.yaw)) < 0.15 && abs(pitch - L.pitch) < 0.15;
    A.last = { t: gt, e: e.slice(), yaw: yaw, pitch: pitch };
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, A.cells[1 - A.turn]); gl.uniform1i(CU.uPrev, 5); gl.uniform1i(CU.uHold, hold ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.disable(gl.DITHER);   // (the low bits carry the kinds: never dithered)
    gl.bindFramebuffer(gl.FRAMEBUFFER, A.cfb);
    for (var k = 0; k <= G.top; k += 1) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, now, k);
      gl.viewport(0, 0, A.gw >> k, A.gh >> k); gl.uniform1i(CU.uLev, k);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    // the setting: each pixel its cell's glyph
    gl.enable(gl.DITHER); gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
    gl.useProgram(A.setP);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, A.col); gl.uniform1i(SU.uScene, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, now); gl.uniform1i(SU.uCells, 3);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, A.atlas); gl.uniform1i(SU.uAtlas, 4);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(SU.uRes, w, h); gl.uniform2i(SU.uCell, G.cw, G.ch); gl.uniform1i(SU.uTop, G.top);
    var at = new Int32Array(8); A.rows.forEach(function (q, i) { at[i * 2] = q.y; at[i * 2 + 1] = q.cols; }); gl.uniform2iv(SU.uAtl, at);
    gl.uniform1f(SU.uLit, ASC.lit); gl.uniform1f(SU.uGlow, md.glow != null ? md.glow : ASC.glow); gl.uniform1f(SU.uBg, ASC.bg);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    A.turn = 1 - A.turn;
  }

  /* ---- the scene ---------------------------------------------------------------------------------------------------
     Plain solids, plainly lit, for the pass to write as characters: the courts at night under their floodlights (glyphs
     glow best on dark), his body's cells (no bars: the unit is the character now), the pearl. */
  var gl = null, canvas = null, hud = null, solid = null, SU = {}, skyP = null, KU = {}, headP = null, HU = {};
  var cube = null, parts = {}, partsFar = {}, ballMesh = null, headBall = null, palMe = null, palPlan = null;
  // (the lens: 58 degrees top to bottom, narrower than the 70 it was, so the far court and Mr Plan were a quarter larger
  // on the screen while his own figure kept its quarter of it, the camera standing further back: definition by size;
  // then the artist, 28 Oct 2026: "keep the athletes the same size, I want to be a bit further behind him": the camera a
  // quarter further back again and the lens narrowed to match (BACK), so his figure keeps its size on the screen)
  var BACK = 1.3, FOV = 2 * Math.atan(Math.tan(29 * Math.PI / 180) / BACK) * 180 / Math.PI, NEAR = 0.08, FAR = 500, T35 = Math.tan(FOV * PI / 360), KEY = norm([0.3, 0.9, 0.42]);
  var SKY = { zen: [0.012, 0.006, 0.04], hor: [0.05, 0.018, 0.07], gnd: [0.006, 0.01, 0.014] };   // (indigo above, violet at the horizon)
  var RIM = { me: [0.42, 0.38, 0.34], plan: [0.45, 0.95, 1.05], none: [0.08, 0.08, 0.1] }, pixA = 0.001;
  // The floodlights' pools, the one light on the ground: each court in its own light, the night between them.
  function poolGLSL() {
    var f = function (x) { return x.toFixed(3); };
    return ["uniform float uKMax;",   // (the last court: the courts are endless, so no pool past it lights bare ground)
      "float pool(vec2 q) {",
      "  float k = clamp(floor(q.x / " + f(COURT.GAP) + " + 0.5), 0.0, uKMax);",
      "  vec2 e = abs(vec2(q.x - k * " + f(COURT.GAP) + ", q.y)) - vec2(" + f(COURT.HW + 2.0) + ", " + f(COURT.L + 3.6) + ");",
      "  float sd = length(max(e, 0.0)) + min(max(e.x, e.y), 0.0);",
      "  return (1.0 - smoothstep(-1.5, 2.6, sd)) * (0.86 + 0.14 * smoothstep(0.0, 6.0, -sd));",
      "}"].join("\n");
  }
  function compile(vs, fs) {
    var mk = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); } return s; };
    var p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    return p;
  }
  function sceneInit() {
    var f = function (x) { return x.toFixed(3); };
    solid = compile([
      "#version 300 es",
      "layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in float aI;",
      "uniform mat4 uVP; uniform mat4 uM; uniform vec3 uEye; uniform vec4 uWide;",
      "out vec3 vN; out vec3 vW; flat out int vI;",
      "void main() {",
      "  vec3 p = aP;",
      // a post or a pole held at least uWide.w (radians at its distance, over its slant) across, so the cells never lose it
      "  if (uWide.w > 0.0) {",
      "    vec3 c = (uM * vec4(aP, 1.0)).xyz, v = normalize(c - uEye);",
      "    for (int i = 0; i < 3; i++) {",
      "      if (uWide[i] > 0.5) { vec3 a = uM[i].xyz; float s = length(a), t = dot(a / s, v); p[i] *= clamp(length(c - uEye) * uWide.w / max(0.1, sqrt(1.0 - t * t)) / s, 1.0, 12.0); }",
      "    }",
      "  }",
      "  vec4 w = uM * vec4(p, 1.0); vW = w.xyz; vN = mat3(uM) * aN; vI = int(aI + 0.5); gl_Position = uVP * w;",
      "}"].join("\n"), [
      "#version 300 es",
      "precision highp float;",
      "uniform vec4 uPal[64]; uniform vec3 uCol; uniform int uUse; uniform vec3 uEye; uniform float uEmit; uniform vec3 uFog;",
      "uniform float uMat, uGround, uAO, uGold; uniform vec4 uCrt; uniform vec3 uLnC, uRim, uKeyV, uSunG;",
      "in vec3 vN; in vec3 vW; flat in int vI; out vec4 o;",
      poolGLSL(),
      // a court's line: never under a pixel and a half across, however far (a 6 cm line at 20 m is a third of one, and
      // was lost between the cells)
      "float lp(float d, float hw, float g) { return abs(d) / g - max(hw / g, 0.75); }",
      "void main() {",
      "  vec3 base = uUse == 1 ? uPal[vI].rgb / 255.0 : uCol;",
      "  float mat = uMat;",
      "  if (uCrt.y > 0.0) {",   // its lines, drawn on its surfaces: x its middle, y its half width, z its half length, w the kitchen
      "    vec2 q = abs(vec2(vW.x - uCrt.x, vW.z));",
      "    vec2 g = max(vec2(length(vec2(dFdx(vW.x), dFdy(vW.x))), length(vec2(dFdx(vW.z), dFdy(vW.z)))), vec2(1e-5));",
      // the pixels from the nearest line along z (the sidelines, the centre line) and along x (the baselines, the kitchen's)
      "    float az = 1e4, ax = 1e4;",
      "    if (q.y <= uCrt.z + 0.03) { az = lp(q.x - uCrt.y + 0.03, 0.03, g.x); }",
      "    if (q.y >= uCrt.w && q.y <= uCrt.z) { az = min(az, lp(q.x, 0.03, g.x)); }",
      "    if (q.x <= uCrt.y) { ax = min(lp(q.y - uCrt.z + 0.03, 0.06, g.y), lp(q.y - uCrt.w, 0.03, g.y)); }",
      "    base = mix(base, uLnC, clamp(0.5 - min(az, ax), 0.0, 1.0));",
      // on a line or within a few pixels of one, the material says which way it runs, for its stroke
      "    if (min(az, ax) < 2.5) { mat = ax < az ? 5.0 : 14.0; }",
      "  }",
      "  vec3 n = normalize(vN), v = normalize(uEye - vW), c;",
      "  float E = pool(vW.xz);",
      "  if (uGround > 0.5) {",
      // the ground: lit by its court's pool alone (no rim: a grazing surface would light into false edges)
      "    c = base * (0.035 + 1.1 * E) * mix(vec3(0.55, 0.68, 1.15), vec3(1.12, 0.92, 0.66), E) + base * uEmit;",   // (the floodlights' amber in their pools, the night's blue in the seams)
      "  } else {",
      // a body or a thing: its court's four lamps (each falling off), a key held to the view from over the viewer's left
      // shoulder (as his head's rig is, pearl.js uRig: so a back is modelled as well as a front), a rim where the lamps
      // behind catch its edge, darker toward the ground (uAO)
      "    float k = clamp(floor(vW.x / " + f(COURT.GAP) + " + 0.5), 0.0, uKMax), dif = 0.0, rim = 0.0, fr = pow(1.0 - abs(dot(n, v)), 2.0);",
      "    for (int i = 0; i < 4; i++) {",
      "      vec3 Lv = vec3(k * " + f(COURT.GAP) + " + (i == 0 || i == 2 ? -" + f(COURT.GAP / 2) + " : " + f(COURT.GAP / 2) + "), 9.1, i < 2 ? -" + f(COURT.L + 4) + " : " + f(COURT.L + 4) + ") - vW;",
      "      float d2 = dot(Lv, Lv), wt = 170.0 / (70.0 + d2); vec3 l = Lv * inversesqrt(d2);",
      "      dif += 0.45 * wt * max(dot(n, l), 0.0);",
      "      rim += wt * fr * smoothstep(-0.1, 0.5, -dot(l, v));",
      "    }",
      "    float ao = mix(1.0, 0.5 + 0.5 * smoothstep(0.0, 1.5, vW.y), uAO), key = uAO * 1.05 * max(dot(n, uKeyV), 0.0);",
      "    c = base * ((dif + key + 0.06 + 0.3 * E * max(-n.y, 0.0)) * ao + uEmit) + uRim * rim * (0.5 + 0.5 * E);",
      // his guitar, gold in bright sun (the artist, 28 Oct 2026: "His guitar should be more golden and displayed as if a
      // bright sunlight was shining on an object made of gold"): a metal, so its colour is in what it reflects (gold's
      // own reflectance, red full, green three quarters, blue a third, as measured), a sun of its own over the viewer's
      // shoulder, a hard glint where the sun's mirror angle falls and a broad sheen round it (Blinn's half-angle, 1977),
      // whiter at a grazing angle (Schlick's Fresnel, 1994), and a sunlit sky above it and warm ground below in its faces
      "    if (uGold > 0.5) {",
      "      vec3 F0 = vec3(1.0, 0.766, 0.336), h = normalize(uSunG + v), rf = reflect(-v, n);",
      "      float nl = max(dot(n, uSunG), 0.0), nh = max(dot(n, h), 0.0), vh = max(dot(v, h), 0.0);",
      "      vec3 Fr = F0 + (1.0 - F0) * pow(1.0 - vh, 5.0);",
      "      vec3 env = mix(vec3(0.2, 0.11, 0.03), vec3(1.0, 0.9, 0.68), smoothstep(-0.35, 0.7, rf.y));",
      "      c = F0 * (0.08 + 0.5 * nl + 0.3 * dif) + Fr * (nl * (6.0 * pow(nh, 90.0) + 0.9 * pow(nh, 10.0)) + 0.55 * env * F0);",
      "    }",
      "  }",
      "  c = 1.0 - exp(-1.3 * c);",
      "  c = mix(c, uFog, clamp(1.0 - exp(-max(length(vW - uEye) - 50.0, 0.0) * 0.008), 0.0, 0.8));",
      "  o = vec4(c, 1.0 - mat / 255.0);",   // (its material, for the characters)
      "}"].join("\n"));
    ["uVP", "uM", "uWide", "uPal", "uCol", "uUse", "uEye", "uEmit", "uFog", "uMat", "uGround", "uAO", "uCrt", "uLnC", "uRim", "uKeyV", "uKMax", "uGold", "uSunG"].forEach(function (k) { SU[k] = gl.getUniformLocation(solid, k); });
    skyP = compile([
      "#version 300 es",
      "uniform vec3 uF; uniform vec3 uR; uniform vec3 uU; uniform vec2 uK;",
      "out vec3 vD;",
      "void main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)) * 2.0 - 1.0; vD = uF + p.x * uK.x * uR + p.y * uK.y * uU; gl_Position = vec4(p, 0.0, 1.0); }"].join("\n"), [
      "#version 300 es",
      "precision highp float;",
      "uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uGnd; in vec3 vD; out vec4 o;",
      "void main() { vec3 d = normalize(vD); vec3 c = d.y > 0.0 ? mix(uHor, uZen, smoothstep(0.0, 0.5, d.y)) : uGnd; o = vec4(c, 1.0); }"].join("\n"));
    ["uF", "uR", "uU", "uK", "uZen", "uHor", "uGnd"].forEach(function (k) { KU[k] = gl.getUniformLocation(skyP, k); });
    headP = compile(PB.HEAD_VS, PB.HEAD_FS);
    ["uVP", "uEye", "uC", "uSun", "uHaze", "uR", "uExpo", "uHolo", "uHead", "uV", "uRig", "uMark"].forEach(function (n) { HU[n] = gl.getUniformLocation(headP, n); });
    // a unit cube, its faces' normals
    var cv = [], F = [[0, 1, 0], [0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];
    F.forEach(function (n) { quad(cv, n, [0.5 * n[0], 0.5 * n[1], 0.5 * n[2]], 0.5, 0); });
    cube = upload(cv);
    // a contact shadow: a disc on the ground (a square, faded round), multiplying the colour under it (the material
    // in the alpha kept)
    shadeP = compile([
      "#version 300 es",
      "uniform mat4 uVP; uniform vec4 uS; out vec2 vQ;",
      "const vec2 Q[6] = vec2[6](vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, -1.0), vec2(1.0, 1.0), vec2(-1.0, 1.0));",
      "void main() { vQ = Q[gl_VertexID]; gl_Position = uVP * vec4(uS.x + vQ.x * uS.z, 0.034, uS.y + vQ.y * uS.z, 1.0); }"].join("\n"), [
      "#version 300 es",
      "precision highp float;",
      "uniform vec4 uS; in vec2 vQ; out vec4 o;",
      "void main() { o = vec4(vec3(1.0 - uS.w * (1.0 - smoothstep(0.1, 1.0, dot(vQ, vQ)))), 1.0); }"].join("\n"));
    ["uVP", "uS"].forEach(function (n) { SHU[n] = gl.getUniformLocation(shadeP, n); });
  }
  var shadeP = null, SHU = {};
  // the contact shadows (x, z, radius, strength), each a decal: only where a shadow is is any work done for it
  function drawShadows(list) {
    if (!list.length) { return; }
    gl.useProgram(shadeP); gl.uniformMatrix4fv(SHU.uVP, false, cur.vp);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.ONE); gl.depthMask(false); gl.bindVertexArray(null);
    list.forEach(function (q) { gl.uniform4fv(SHU.uS, q); gl.drawArrays(gl.TRIANGLES, 0, 6); });
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.useProgram(solid);
  }
  // a face of a cell (or of the cube): its middle c, half side r, normal n, palette id
  function quad(out, n, c, r, id) {
    var u = abs(n[1]) > 0.5 ? [1, 0, 0] : [0, 1, 0], v = cross(n, u);
    var P = function (a, b) { return [c[0] + (u[0] * a + v[0] * b) * r, c[1] + (u[1] * a + v[1] * b) * r, c[2] + (u[2] * a + v[2] * b) * r]; };
    [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]].forEach(function (q) { var p = P(q[0], q[1]); out.push(p[0], p[1], p[2], n[0], n[1], n[2], id); });
  }
  function upload(arr) {
    var vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 28, 24);
    gl.bindVertexArray(null);
    return { vao: vao, n: arr.length / 7 };
  }
  // cells (x, y, z, id) to their faces open to the air, in cell units; k > 1 merges k³ cells into one (far off)
  function meshCells(blocks, k) {
    var occ = {}, list = [], key = function (x, y, z) { return x + "," + y + "," + z; };
    blocks.forEach(function (b) { var q = [floor(b[0] / k), floor(b[1] / k), floor(b[2] / k)], s = key(q[0], q[1], q[2]); if (!occ[s]) { occ[s] = 1; list.push([q[0], q[1], q[2], b[3]]); } });
    var out = [], D = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    list.forEach(function (b) {
      D.forEach(function (n) {
        if (occ[key(b[0] + n[0], b[1] + n[1], b[2] + n[2])]) { return; }
        quad(out, n, [(b[0] + 0.5 + 0.5 * n[0]) * k, (b[1] + 0.5 + 0.5 * n[1]) * k, (b[2] + 0.5 + 0.5 * n[2]) * k], 0.5 * k, b[3]);
      });
    });
    return upload(out);
  }
  function ballCells(R, id) { var bl = []; for (var y = 0; y < 2 * R; y += 1) { for (var z = 0; z < 2 * R; z += 1) { for (var x = 0; x < 2 * R; x += 1) { if (hypot(x + 0.5 - R, y + 0.5 - R, z + 0.5 - R) <= R) { bl.push([x, y, z, id]); } } } } return bl; }
  function bodyMeshes(body) {
    // (the guitar without its strap: swung as a racket, the strap that went round him would swing out as a loop)
    var strap = body.paletteIds.strap || [];
    body.parts.forEach(function (p) {
      if (p.empty) { return; }
      var bl = p.name === "guitar" ? p.blocks.filter(function (q) { return strap.indexOf(q[3]) < 0; }) : p.blocks;
      parts[p.name] = meshCells(bl, 1); partsFar[p.name] = meshCells(bl, 2);
    });
    var id = (body.paletteIds.jacket || [1])[0];
    headBall = { R: round(body.head.radius / body.cell), mesh: null };
    headBall.mesh = meshCells(ballCells(headBall.R, id), 1);
    ballMesh = meshCells(ballCells(3, 1), 1);   // the pearl: three of his cells in radius, as the rocket world's pearls
    // his palette, and Mr Plan's: every colour turned over (his negative, as the nemesis was), lifted so it shows at night
    palMe = new Float32Array(256); palPlan = new Float32Array(256);
    body.palette.forEach(function (c, i) {
      if (i >= 64) { return; }
      for (var j = 0; j < 3; j += 1) { palMe[i * 4 + j] = c[j]; palPlan[i * 4 + j] = 105 + 0.6 * (255 - c[j]); }
    });
  }
  var hideAth = false, cur = { vp: null, eye: [0, 0, 0] }, cine = null, ascMod = null;   // (cine, ascMod: the super return's camera and pass)
  // what the next solids are: their material (MAT, for the pass), the axes held a pixel and a half wide (wide), lit as
  // the ground or as a body, their rim and occlusion
  function paint(mat, wide, ground, rim, ao) {
    gl.uniform1f(SU.uMat, mat);
    gl.uniform4f(SU.uWide, wide ? wide[0] : 0, wide ? wide[1] : 0, wide ? wide[2] : 0, wide ? 1.5 * pixA : 0);
    gl.uniform1f(SU.uGround, ground ? 1 : 0); gl.uniform3fv(SU.uRim, rim || RIM.none); gl.uniform1f(SU.uAO, ao || 0);
  }
  function drawSolid(mesh, M, col, pal, emit) {
    gl.uniformMatrix4fv(SU.uM, false, M);
    if (pal) { gl.uniform1i(SU.uUse, 1); gl.uniform4fv(SU.uPal, pal); } else { gl.uniform1i(SU.uUse, 0); gl.uniform3fv(SU.uCol, col); }
    gl.uniform1f(SU.uEmit, emit || 0);
    gl.bindVertexArray(mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, mesh.n);
  }
  function cbox(c, sz, col, emit, ax, a) {
    var Sm = [sz[0], 0, 0, 0, 0, sz[1], 0, 0, 0, 0, sz[2], 0, 0, 0, 0, 1];
    drawSolid(cube, mul(T(c[0], c[1], c[2]), a ? mul(RA(ax, a), Sm) : Sm), col, null, emit);
  }
  function drawAthlete(a, pose, me, bare) {
    if (hideAth === true || hideAth === (me ? "me" : "plan")) { return; }   // (the tests only: the frame without its athletes, to find where they are)
    var far = hypot(a.x - cur.eye[0], a.z - cur.eye[2]) > 26, P = far ? partsFar : parts, pal = a.pal, plan = pal === palPlan;
    paint(plan ? MAT.PLAN : MAT.ME, null, false, plan ? RIM.plan : RIM.me, 1);
    gl.uniform4fv(SU.uPal, pal); gl.uniform1i(SU.uUse, 1); gl.uniform1f(SU.uEmit, 0);
    Object.keys(pose.parts).forEach(function (n) {
      if (!P[n] || (bare && n === "hat")) { return; }
      gl.uniform1f(SU.uMat, n === "hat" ? (plan ? MAT.HATPLAN : MAT.HATME) : plan ? MAT.PLAN : MAT.ME);
      gl.uniformMatrix4fv(SU.uM, false, pose.parts[n]); gl.bindVertexArray(P[n].vao); gl.drawArrays(gl.TRIANGLES, 0, P[n].n);
    });
    gl.uniform1f(SU.uMat, plan ? MAT.PLAN : MAT.GOLD); gl.uniform1f(SU.uGold, plan ? 0 : 1);   // (his guitar gold; Mr Plan's his negative's)
    gl.uniformMatrix4fv(SU.uM, false, pose.guitar); gl.bindVertexArray(P.guitar.vao); gl.drawArrays(gl.TRIANGLES, 0, P.guitar.n);
    gl.uniform1f(SU.uGold, 0);
    if (!me) {
      var c = pose.headC, Rr = headBall.R, h = body.cell, hm = pose.headM;
      var M = [hm[0] * h, hm[1] * h, hm[2] * h, 0, hm[3] * h, hm[4] * h, hm[5] * h, 0, hm[6] * h, hm[7] * h, hm[8] * h, 0, c[0], c[1], c[2], 1];
      gl.uniformMatrix4fv(SU.uM, false, mul(M, T(-Rr, -Rr, -Rr))); gl.bindVertexArray(headBall.mesh.vao); gl.drawArrays(gl.TRIANGLES, 0, headBall.mesh.n);
    }
  }
  // His head: the one perfect sphere (pearl.js's HEAD_FS), its pixels marked to pass the characters by.
  function drawHead(pose, vm) {
    var c = pose.headC, hm = pose.headM, nrm = function (i) { var l = hypot(hm[i], hm[i + 1], hm[i + 2]) || 1; return [hm[i] / l, hm[i + 1] / l, hm[i + 2] / l]; };
    var r = nrm(0), u = nrm(3), bk = nrm(6);
    gl.useProgram(headP);
    gl.uniformMatrix4fv(HU.uVP, false, cur.vp); gl.uniform3fv(HU.uEye, cur.eye); gl.uniform3fv(HU.uC, c); gl.uniform1f(HU.uR, body.head.radius);
    gl.uniform3fv(HU.uSun, KEY); gl.uniform3fv(HU.uHaze, SKY.hor); gl.uniform1f(HU.uExpo, 1.047); gl.uniform1f(HU.uHolo, 0); gl.uniform1f(HU.uMark, asc && asc.ok ? 1 : 0);
    gl.uniformMatrix3fv(HU.uHead, false, r.concat(u, bk));
    gl.uniformMatrix3fv(HU.uV, false, [vm[0], vm[1], vm[2], vm[4], vm[5], vm[6], vm[8], vm[9], vm[10]]); gl.uniform1f(HU.uRig, 1);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 36);
    gl.useProgram(solid);
  }

  /* ---- the courts ---------------------------------------------------------------------------------------------------
     As the rocket world has them (rocket.js, "the courts"), its numbers and its rules, with "Mr Plan" for the nemesis:
     pickleball's court, 20 by 44 feet, the kitchen 7 feet either side of the net, the net 34 inches at its middle and
     36 at the posts; a ball's fall, its bounce and the court's grip; first to three. */
  var COURT = {
    GAP: 12,                               // side by side, 12 m apart: a pickleball court (6.10 m) and its run-off
    L: 6.705, HW: 3.05, K: 2.134,          // the half length (44 ft), the half width (20 ft), the kitchen from the net (7 ft)
    NET: 0.864, POST: 0.914, PO: 0.305,    // the net at its middle (34 in) and at the posts (36 in), the posts 12 in out
    G: 9.81, E: 0.64, ROLL: 0.8, WIN: 3    // a ball's own fall, its bounce (78 in dropped to 30-34 in), the court's grip; points to a court
  };
  var body = null, me = null, plans = [], stands = [], courts = null, court = { m: null, on: -1, told: {} };
  var gt = 0, rngS = 7, dust = [];
  function rng() { rngS = (rngS * 1664525 + 1013904223) >>> 0; return rngS / 4294967296; }
  function courtAt(k) { return [k * COURT.GAP, 0, 0]; }
  var STR = {
    courts: "The courts", wonN: function (n) { return n + (n === 1 ? " court won" : " courts won"); }, open: function (k) { return "court " + (k + 1) + " open"; },
    welcome: "Holographic Mr Pearl: Pickleball. One court at night, Mr Plan on it. Win it and the next appears beside it, harder: how many courts can you win? Walk onto court one.",
    match: function (k, l) { return "Court " + k + ", level " + l + " against Mr Plan: first to three. Run to the gold circle behind the baseline to serve."; },
    meterHint: "tap to stop it · further is harder · ◆ a chance at an ace",
    head: function (m) {
      var lv = m.balls.filter(function (q) { return !q.dead; }), r = lv.reduce(function (a, q) { return max(a, q.rally); }, 0);
      return "Court " + (m.k + 1) + " · level " + m.level + " · you " + m.you + " – " + m.them + " Mr Plan" + (lv.length > 1 ? " · " + lv.length + " pearls" : "") + " · rally " + r + " · " + STR.wonN(wonCount());
    },
    long: "The serve went long.", kitchenVolley: "A volley from the kitchen: a fault.", kitchenVolleyPlan: "Mr Plan volleys from the kitchen: a fault.", ace: "An ace: Mr Plan never got to it.", aceZone: "The ace zone: hard into the deep corner.",
    superNext: "Super return: on the next point.", superUsed: "Your super return is spent this game: a new one with the next game.",
    superWon: "Super return: the point is yours.",
    planSuper: "Mr Plan's super return! Stop the bar in ◆ return to send it back.", counterHint: "tap in ◆ return to send Mr Plan's super back",
    planSuperOr: "Mr Plan's super return! Stop the bar in ◆ return, or use your Super.", counterHintOr: "tap in ◆ return, or Super top right",
    superCounter: "Your super return meets Mr Plan's.", superCounterWon: "Your super return beats Mr Plan's: the point is yours.",
    counterOk: "Returned: Mr Plan's super goes back over the net.", counterMiss: "Not in ◆ return: Mr Plan's super is past you.", planSuperWon: "Mr Plan's super return.",
    net: "Into the net.", netPlan: "Mr Plan puts it into the net.", kitchen: "The serve fell in the kitchen.", out: "Out.", outPlan: "Mr Plan hits it out.",
    twice: "It bounced twice: you did not reach it.", twicePlan: "Twice on its side: Mr Plan did not reach it.",
    rally: function (y, t, r) { return y + " – " + t + ", a rally of " + r + "."; },
    planTakes: function (t, y) { return "Mr Plan takes it, " + t + " – " + y + ". Again from love: run to the gold circle to serve."; },
    won: function (k, y, t) { return "Court " + (k + 1) + " won, " + y + " – " + t + ". It plays on by itself and keeps winning. Court " + (k + 2) + " is open beside it, harder."; },
    standin: function (k, y, t) { return "Your stand-in is playing court " + (k + 1) + ", " + y + " – " + t + ", and keeps winning."; },
    go: function (k, up) { return "Court " + (k + 1) + (up ? ", won: go and watch it" : ": go beside its gold circle"); },
    // the walk-through, court one's first point (the artist, 28 Oct 2026, then 29 Oct 2026): its words on the screen in
    // the artist's own (twice the cues' size: "Make sure the walkthrough words are twice as big as they currently are"),
    // [touch, mouse, keys] where they differ; its sentences, a finger's and a desk's, for a screen reader
    walk: {
      tap: ["tap anywhere", "click anywhere", "press space"], three: "serve up to three pearls at a time", each: "Each player can use one super per game",
      cont: ["tap anywhere to continue", "click anywhere to continue", "press space to continue"], hit: "Hit the return", counter: "or use your super to counter",
      sr: {
        move: ["Walk-through. Drag your left thumb forward on the left half of the screen, into the gold circle.", "Walk-through. W, or drag forward on the left half of the screen, into the gold circle."],
        serve: ["Tap anywhere: stop the bar's mark in its gold ace zone.", "Space, or click anywhere: stop the bar's mark in its gold ace zone."],
        three: ["Serve up to three pearls at a time.", "Serve up to three pearls at a time."],
        each: ["Mr Plan's super! Each player can use one super per game.", "Mr Plan's super! Each player can use one super per game."],
        hit: ["Hit the return: tap anywhere while the bar's mark is in its return zone.", "Hit the return: Space, or a click, while the bar's mark is in its return zone."],
        sup: ["Or use your super to counter: tap SUPER, top right.", "Or use your super to counter: press E, or click SUPER, top right."],
        cont: ["Tap anywhere to continue.", "Space, or a click, to continue."]
      },
      go: "1 – 0 to you, your Super still yours this game, Mr Plan's spent. Each court won opens the next beside it, harder: how many can you win?"
    },
    // the cues' few words, each beside what it names (the artist, 29 Oct 2026: "I don't like this chat box for the method
    // of showing users how to play. I want a more interactive learning experience for users"): [touch, mouse, keys] where
    // they differ; the sentences of STR.tips stay, for a screen reader only
    cue: { here: "serve here", get: "get here", drag: "drag", tap: ["tap", "click", "space"], again: "again",
           pop: { ace: "◆ ace zone", good: "good", soft: "too soft", long: "too long", auto: "auto swing", ret: "◆ return", missed: "missed", plus: "+1", blink: "auto" },
           superTip: ["wins any point", "one a game"], play: "play", go: ["← or tap", "← or click", "← or click"], run: "run",
           stuck: { move: ["thumb here, then push", "press here and drag", "hold the gold key"], serve: ["tap when ◎ is on ◆", "click when ◎ is on ◆", "space when ◎ is on ◆"] } },
    // how to play, at its moments (the artist, 28 Oct 2026: "Include a brief set of instructions on how to move around
    // and how to serve when beginning court one as soon as you open up the game", then "I want the how to to be pop-ups
    // that happen when you're walking through that are cued by certain moments"): a finger's words and a desk's
    tips: {
      move: ["Move: drag on the left half of the screen.", "Move: W A S D, Shift to sprint (or drag on the left half)."],
      court: ["Walk onto the open court to play Mr Plan, or tap its number at the top.", "Walk onto the open court to play Mr Plan, or click its number at the top."],
      serve: ["Your serve: run to the gold circle behind the baseline.", "Your serve: run to the gold circle behind the baseline."],
      bar: ["Tap to stop the bar: further is harder, ◆ a chance at an ace. Tap again for a 2nd and a 3rd pearl.", "Space stops the bar: further is harder, ◆ a chance at an ace. Again for a 2nd and a 3rd pearl."],
      rally: ["Run to the ○ ring where his shot comes down: your stroke is your own, aimed at the open court.", "Run to the ○ ring where his shot comes down: your stroke is your own, aimed at the open court."],
      multi: ["Two or three pearls: each is a point of its own, and the game runs you to each.", "Two or three pearls: each is a point of its own, and the game runs you to each."],
      pearls: ["Tap again while the serve is open: a 2nd and a 3rd pearl, each a point of its own.", "Space again while the serve is open: a 2nd and a 3rd pearl, each a point of its own."],
      super: ["Super, top right: once a game, a leap that wins the point.", "Super, top right, or E: once a game, a leap that wins the point."] }
  };
  var sayT = 0;
  // The tips: each shown once (which have been is kept with the save), one at a time, the next waiting its turn, each
  // gone once it is done (he moves, he serves) or after its time.
  var TIPS = { order: ["move", "court", "serve", "bar", "rally", "multi", "super", "pearls"], life: { move: 9, court: 8, serve: 9, bar: 12, rally: 7, multi: 6, super: 7, pearls: 8 }, seen: 0, cur: null, queue: [],
               MATCH: ["serve", "bar", "pearls", "rally", "multi", "super"] };
  function tipBit(key) { return 1 << TIPS.order.indexOf(key); }
  function tip(key) { if ((TIPS.seen & tipBit(key)) || (TIPS.cur && TIPS.cur.key === key) || TIPS.queue.indexOf(key) >= 0) { return; } TIPS.queue.push(key); }
  function tipDone(key) {
    if (TIPS.cur && TIPS.cur.key === key) { TIPS.cur.done = true; return; }
    var i = TIPS.queue.indexOf(key); if (i >= 0 && key !== "rally") { TIPS.queue.splice(i, 1); TIPS.seen |= tipBit(key); save(); }   // (done before its turn: not needed; the rally's stroke is the game's, so its tip waits)
  }
  function tipStep() {
    if (!court.m) { TIPS.queue = TIPS.queue.filter(function (k) { return TIPS.MATCH.indexOf(k) < 0; }); }   // (a match's own, not yet shown, wait for the next match)
    var c = TIPS.cur; if (TUT.on || TUT.card) { return; }
    // (its time runs while its cue is there; a match's own goes with the match; done, it goes at once)
    if (c) { var lv = cueLive(c.key); if (lv) { c.vis += gt - c.at; } c.at = gt; if ((!court.m && TIPS.MATCH.indexOf(c.key) >= 0) || (c.key === "pearls" && c.vis > 0 && !lv)) { c.done = true; } }   // (the pearls' window closed: its moment passed)
    if (c && (c.done || c.vis > TIPS.life[c.key])) { TIPS.seen |= tipBit(c.key); TIPS.cur = c = null; cueSay(""); save(); }
    if (!c && TIPS.queue.length) {
      var key = TIPS.queue.shift();
      TIPS.cur = { key: key, t0: gt, at: gt, vis: 0, done: false }; CUE.t0 = CUE.b0 = CUE.rt; CUE.ready = false;
      cueSay(STR.tips[key][CUE.hand === "touch" ? 0 : 1]);
    }
  }

  /* -- the walk-through (the artist, 28 Oct 2026: "The first court should be a walk-through, that takes you step-by-step
     all the things you can do"; then, 29 Oct 2026: "I want there to be a suggestive gesture of a finger touching the
     screen forward on the left side and I want the gold circle for the serve spot to show up immediately. When you get
     to the serve spot I want a golden arrow to point down to the ace region of the serve bar and the words "tap
     anywhere" to pop up ... Once you tap to serve the game should freeze and then the words "serve up to three pearls at
     a time" to pop up and then a 3 seconds later another text pops up that reads "tap anywhere to continue".
     Regardless of how many times a user taps on the first serve of the first game, only one ball should be served. Once
     you serve it, Mr Plan will use his super on his first return and after the animation for his super starts it should
     freeze and the words "Each player can use one super per game" after 3 seconds it should say "tap anywhere to
     continue". After the user taps the animation for Mr Plan's return should continue a little bit and right as the ball
     goes over the net the screen should freeze again and the words "Hit the return" should pop up as the same golden
     arrow should be pointing down above the bar but this time to the section labeled return. Once the user gets a chance
     to land the dot running in the bar into the return zone, the animation should continue for another split second
     before it freezes again and the words pop up "or use your super to counter" in which a golden arrow points to the
     super button in the top right. This will be a free super use that only happens in the first game ... Once Mr Pearl
     wins that first point and returns to the second serve the walkthrough is over and the user is winning 1-0 with
     another super"). A first game (no court won, not yet done): court one's match at once, he three steps from its gold
     circle, there from the first frame. Its steps (TUT.card): "move", a finger's ghost on the left half pressing and
     pushing forward; "serve", on the mark, the arrow at the ace zone and "tap anywhere" (a tap in a fault's part only
     says so and the bar runs on; one pearl, however many taps); then the game stands still (TUT.stop) at "three", the
     pearl struck; at "each", just into Mr Plan's super on his first return; at "hit", his pearl over the net, the
     counter's bar running on the real clock till the mark is stopped in its return zone; a moment on, at "sup", till the
     Super is pressed. The first two go on with a tap once "tap anywhere to continue" is up, three seconds on. The
     Super's point is the first: 1 - 0, and his Super is given back at the second serve; Mr Plan's stays spent. Done is
     kept with the save; a court won ends it too. Any other end to the point goes round again, no score. */
  var TUT = { on: false, done: false, card: null, stop: null, sT: 0, said: false, seen: {}, runT: 0, u0: 0, free: false };
  function tutStart() {
    TUT.on = true; TUT.seen = {}; TUT.stop = null; TUT.runT = 0;
    courtPlace(0); court.on = -1; court.told = {}; matchOn(0); superButton();
  }
  // its step, for the cues to draw; its sentence for a screen reader
  function tutCard(key) {
    if (TIPS.cur) { TIPS.queue.unshift(TIPS.cur.key); TIPS.cur = null; }
    TUT.card = key; CUE.t0 = CUE.b0 = CUE.rt;
    if (key !== "go") { cueSay(key ? STR.walk.sr[key][CUE.hand === "touch" ? 0 : 1] : ""); }   // ("go", the moment before the Super's step: its sentence stays)
  }
  // the game still, at one of its steps
  function tutStop(key) { TUT.stop = key; TUT.sT = CUE.rt; TUT.said = false; TUT.seen[key] = true; if (key === "hit") { TUT.u0 = CUE.rt; } tutCard(key); superButton(); }
  // which step the match is at (each frame it runs); the stops where they come
  function tutStep() {
    var m = court.m; if (!TUT.on || !m || TUT.stop) { return; }
    var sp = m.psup, want = null;
    if (m.phase === "serve" && !m.meterOn) { want = "move"; }
    else if (m.meterOn && !m.served && !m.tosses.length) { want = "serve"; }
    if (m.served && !TUT.seen.three) { tutStop("three"); return; }
    if (m.phase === "plansuper") {
      if (!sp.struck && !TUT.seen.each && gt - sp.t0 >= 0.55) { tutStop("each"); return; }
      if (sp.struck && !TUT.seen.hit && sp.ball.z >= courtAt(m.k)[2]) { tutStop("hit"); return; }
      if (TUT.seen.hit && !TUT.seen.sup && gt >= TUT.runT) { tutStop("sup"); return; }
      want = TUT.seen.hit ? "go" : null;
    }
    if (want !== TUT.card) { tutCard(want); }
  }
  // standing still (true: no step this frame); a tap (input.fire, from anywhere) goes on, the Super at its own step
  function tutHeld() {
    if (!TUT.on || !TUT.stop) { return false; }
    var m = court.m, s = TUT.stop, tap = input.fire, hi = CUE.hand === "touch" ? 0 : 1; input.fire = false;
    if (!m) { TUT.stop = null; return false; }
    if (s === "sup") { if (m.sup.armed) { TUT.stop = null; tutCard(null); superButton(); return false; } return true; }
    if (s === "hit") {
      // (the counter's bar runs while the game stands: stopped in the return zone, a moment more, then the Super's step)
      var per = servePeriod(m), uu = ((CUE.rt - TUT.u0) / per) % 2, sp = m.psup, mb = hudBox.meter; sp.uNow = uu < 1 ? uu : 2 - uu;
      if (tap) {
        var ok = sp.uNow >= SERVE.ACE[0] && sp.uNow < SERVE.ACE[1];
        if (mb && mb.cw) { cuePop(ok ? STR.cue.pop.ret : STR.cue.pop.missed, [mb.x0 + sp.uNow * mb.N * mb.cw, mb.y0 + 58], ok ? CUE_COL.gold : CUE_COL.coral); }
        if (!ok) { cueSay(STR.cue.pop.missed + ". " + STR.walk.sr.hit[hi]); }
        if (ok) { TUT.stop = null; TUT.runT = gt + 0.35; tutCard("go"); return false; }
      }
      return true;
    }
    if (CUE.rt - TUT.sT >= 3) {
      if (!TUT.said) { TUT.said = true; cueSay(STR.walk.sr[s][hi] + " " + STR.walk.sr.cont[hi]); }
      if (tap) { TUT.stop = null; tutCard(null); return false; }
    }
    return true;
  }
  // over (his Super's point, or a court won): what it showed is not shown again as tips, and it is kept done
  function tutFinish() {
    TUT.on = false; TUT.done = true; TUT.stop = null; tutCard(null);
    ["move", "serve", "bar", "super"].forEach(function (k) { TIPS.seen |= tipBit(k); });
    TIPS.queue = TIPS.queue.filter(function (k) { return !(TIPS.seen & tipBit(k)); });
    superButton(); save(); tip("pearls");
  }
  function serveMax() { return TUT.on ? 1 : SERVE.MAX; }
  /* -- the cues: how to play, shown on the thing itself (the artist, 29 Oct 2026: "I don't like this chat box for the
     method of showing users how to play. I want a more interactive learning experience for users"). Three designs, one
     merged: a see-through ghost of the stick (on a desk the keys, as keycaps) doing the move where it is done; a gold
     trail on the court to where he must be, lit whole when his push is right, and a ray from his own thumb; a ghost tap
     pressing in time with the bar's gold, a ring closing onto it so the tap is anticipated, not chased; a word where the
     bar stops; the frozen pearl ringed and named; a path to the Super, which ripples, its three facts beside it; four
     diamonds earned. A few words at most, each beside what it names; the sentences go to a screen reader. Each cue goes
     at its first success. All on the HUD, in the game's own glyphs, on CUE.rt, the real clock: it moves while the game
     stands still, and stops with YouTube's pause. (Precedents: Celeste's frozen dash lesson, World 1-1, osu!'s approach
     circles, DDR's judgment words; and against over-teaching, Andersen et al., CHI 2012: so each goes at once.) */
  var CUE = { rt: 0, hand: "touch", rm: false, pops: [], miss: null, t0: 0, b0: 0, ready: false, side: {}, inT: -9, wrongT: -9, tapOn: false, tapT: -9 };
  var CUE_BEAT = 1.6, CUE_COL = { gold: "#ffd166", pale: "#f3c98b", ink: "#f2efe8", ice: "#9ff3ff", dim: "#8a8f9a", coral: "#e07a5f" };
  (function () {
    try {
      var q = window.matchMedia("(prefers-reduced-motion: reduce)"); CUE.rm = q.matches;
      if (q.addEventListener) { q.addEventListener("change", function (e) { CUE.rm = e.matches; }); }
      CUE.hand = window.matchMedia("(pointer: fine)").matches ? "keys" : "touch";
    } catch (e) { /* touch, motion */ }
  })();
  function cueH() { return CUE.hand === "keys" ? 2 : CUE.hand === "mouse" ? 1 : 0; }
  function cueKey() { return TUT.on ? TUT.card : (TIPS.cur && TIPS.cur.key) || null; }
  // whether a tip's cue is there now (its time runs only then)
  function cueLive(key) {
    var m = court.m, n = m ? m.served + m.tosses.length : 0;
    if (key === "move") { return true; }
    if (key === "court") { return !m; }
    if (key === "serve") { return !!m && m.phase === "serve" && !m.meterOn; }
    if (key === "bar") { return !!m && m.meterOn; }
    if (key === "pearls") { return !!m && m.meterOn && n >= 1 && n < SERVE.MAX && gt < m.serveOpen; }
    if (key === "rally") { return !!m && m.balls.some(function (b) { return !b.dead && b.mark && b.last === "them"; }); }
    if (key === "multi") { return !!m && live(m).length > 1; }
    if (key === "super") { return !!m && m.sup.avail && !m.sup.armed; }
    return false;
  }
  // the stick's way on the screen (x right, y down) that walks him along a way on the ground: controls() turned about
  function stickFor(wx, wz) { var y = view.yaw, dx = Math.cos(y) * wx + Math.sin(y) * wz, dy = -(Math.sin(y) * wx - Math.cos(y) * wz), l = hypot(dx, dy) || 1; return [dx / l, dy / l]; }
  function cueSay(t) { var e = $("help"); if (e && e.textContent !== t) { e.textContent = t; } }
  // a word where something happened (at: a point in the world, or on the screen), rising a little and gone in 0.9 s
  function cuePop(t, at, col) { CUE.pops.push({ t: t, at: at, col: col || CUE_COL.gold, t0: CUE.rt }); if (CUE.pops.length > 4) { CUE.pops.shift(); } }
  // he is where Mr Plan's return comes down (or his stroke for it is planned)
  function cueReady(m, b) { return CUE.ready || !!m.pc || (!!b.mark && hypot(me.x - b.mark.x, me.z - b.mark.z) < 0.7); }
  function say(t, keep) { if (TUT.on) { return; } var e = $("say"); if (e.textContent !== t) { e.textContent = t; } e.style.opacity = "1"; sayT = gt + (keep ? 6 : 3.5); }   // (the walk-through's own words say it: these, a log, would be read out under them)
  // The courts: every one won and the one open, the newest, beside the last won; court k is level k + 1. A save from any
  // version, or none, is read field by field as counts, or as a fresh start: the first version's ten courts as the run
  // of them won from the first (its horse and its levels go: the courts are endless now, and each is its own level).
  function count(x, d) { x = +x; return isFinite(x) && x >= 0 ? floor(x) : d; }
  function courtsInit(saved) {
    if (!saved || typeof saved !== "object") { saved = {}; }
    var won = count(saved.won, -1); TIPS.seen = count(saved.tips, 0) & 255; TUT.done = !!saved.tut;
    if (won < 0) { won = 0; if (Array.isArray(saved.courts)) { while (saved.courts[won] && saved.courts[won].won === true) { won += 1; } } }
    courts = [];
    for (var k = 0; k <= min(won, 999); k += 1) { courtAdd(); courts[k].won = courts[k].up = k < won; }
    courts.best = count(saved.rally != null ? saved.rally : saved.best, 0);   // (the longest rally: the first version kept it as "best")
    // (the matches won, played again: each read back, the newest twelve; one that will not read rallies as before)
    var rs = saved.recs && typeof saved.recs === "object" ? saved.recs : {};
    Object.keys(rs).map(Number).filter(function (k) { return k >= 0 && k < won && courts[k]; }).sort(function (a, b) { return b - a; }).slice(0, REC.KEEP).forEach(function (k) {
      var R = null; try { R = recUnpack(rs[k]); } catch (e) { R = null; }
      if (R) { courts[k].rec = R; courts[k].recP = JSON.stringify(rs[k]); }
    });
  }
  function courtAdd() {
    var k = courts.length, cc = courtAt(k);
    courts.push({ k: k, level: k + 1, won: false, up: false, you: 0, them: 0, next: gt + 4 + k % 4, t0: gt, i: -1 });
    plans.push(athlete(palPlan, cc[0], cc[2] - COURT.L - 0.6, PI, false));
    stands.push(athlete(palMe, cc[0], cc[2] + COURT.L - 0.5, 0, true));
  }
  function wonCount() { return courts.length - 1; }   // (every court but the open one; the score)
  function stateOf() {
    var o = JSON.stringify({ v: 2, won: wonCount(), rally: courts.best, tips: TIPS.seen, tut: TUT.done ? 1 : 0 });
    if (courts.recJ == null) {
      var room = REC.ROOM, parts = [];
      courts.slice().reverse().forEach(function (c) {   // (the newest first, as many as the room holds)
        if (!c.rec) { return; }
        if (!c.recP) { c.recP = JSON.stringify(recPack(c.rec)); }
        if (c.recP.length <= room) { parts.push(JSON.stringify(String(c.k)) + ":" + c.recP); room -= c.recP.length + 8; }
      });
      courts.recJ = "{" + parts.join(",") + "}";
    }
    return o.slice(0, -1) + ',"recs":' + courts.recJ + "}";
  }
  function save() { return courts ? YT.save(stateOf()) : Promise.resolve(); }
  // The courts won play on wherever he is, and keep winning (the artist: "Previous courts still automatically play and
  // you win each game as you advance"): a point every four to eight seconds, Mr Plan taking some, never the third.
  function courtsSim(dt) {
    courts.forEach(function (c) {
      if (!c.up || c.rec || gt < c.next) { return; }   // (a recording keeps its own score)
      c.next = gt + 4 + 4 * rng();
      if (c.them < COURT.WIN - 1 && rng() < 0.3) { c.them += 1; } else { c.you += 1; }
      if (c.you >= COURT.WIN) { c.you = c.them = 0; }
    });
    if (floor(gt) !== floor(gt - dt)) { courtWhere(); }   // (the head's counts and the rally, once a second)
  }
  // (no end to tell: the courts go on, each harder; the requirement to say "there is no more" has nothing to say)
  function courtWhere() {
    var m = court.m, t = STR.courts;
    if (m) { t = STR.head(m); }
    else { t += " · " + STR.wonN(wonCount()) + " · " + STR.open(courts.length - 1); }
    if ($("where").textContent !== t) { $("where").textContent = t; }
    var ph = m ? m.phase : "walk"; if (document.body.dataset.phase !== ph) { document.body.dataset.phase = ph; }
  }
  /* -- a match: Mr Plan's skill by court. His body is superhuman on every court ("more athletically than any athlete
     ever"); what grows is how soon he reads the pearl, how rarely he misses or fails a dive, and how cruelly he places
     it: deeper, wider, faster, dinks into the kitchen, lobs; and the serve's bar quickens and its ace pays less often.
     One curve carries all of it (the artist: "each court gets progressively harder. By the time you get to court 10,
     the game should be very hard"): the share of the hardest, 1 - e^(-(court - 1) / HARD.K), is 0.28 at court two,
     three quarters at five, 0.95 at ten, and nears the whole without reaching it, so every court is harder than the
     last and none is beyond winning. Each number goes from court one's to the hardest's along it; pb_curve.js plays
     the courts to measure what that makes of them. (stretch: with two or three pearls in play the game runs him to each,
     so none is lost for want of legs; while two or more are in play a return of his goes out as often as this, so a pearl of several is
     about as hard to win as a pearl alone: pb_multi.js measures it.) */
  var HARD = { K: 3, UP: 1.05, FLOOR: 0.3, QUICK: 0.96,
    one:  { wait: 0.42, err: 0.26, T: 1.25, dive: 0.5, lunge: 0.82, flair: 0.14, lob: 0.1, wide: 0.4, deep: 3.6, dink: 0, ace: 0.8, sweep: 1.15, stretch: 0.01 },
    most: { wait: 0.125, err: 0.066, T: 0.845, dive: 0.89, lunge: 0.96, flair: 0.24, lob: 0.21, wide: 2.13, deep: 6.15, dink: 0.29, ace: 0.31, sweep: 0.71, stretch: 0.26 } };
  function hardness(level) { return 1 - Math.exp(-(max(1, level) - 1) / HARD.K); }
  function nemSkill(level) {
    var h = hardness(level), o = {};
    Object.keys(HARD.one).forEach(function (k) { o[k] = HARD.one[k] + (HARD.most[k] - HARD.one[k]) * h; });
    o.dink = HARD.most.dink * max(0, (h - 0.2) / 0.8);   // (none on court one, the first on court three)
    // Every court harder (the artist, 28 Oct 2026: "Make the game 10% harder on each level"): each of his numbers moved
    // by HARD.UP the way the curve itself calls harder (up where the hardest court's is higher, down where it is lower),
    // court one's too; for his dive and lunge it is his misses that are fewer by it (his success a tenth more had cut
    // his misses at court ten to a third); his flair is show, not skill, and stays; his super return as much more often
    // (psupWill). HARD.UP 1.05 makes pb_curve.js's two players win a tenth fewer points together, 30 matches a court
    // (the human-like one 7.9% fewer, the ideal one 12.8%; 1.1 had made it 18% and 23%); PB_UP=1 there measures the game
    // as it was, beside the game as it is.
    Object.keys(o).forEach(function (k) {
      if (k === "flair") { return; }
      if (k === "dive" || k === "lunge") { o[k] = 1 - (1 - o[k]) / HARD.UP; return; }
      o[k] = HARD.most[k] > HARD.one[k] ? o[k] * HARD.UP : o[k] / HARD.UP;
    });
    // The serve's bar quicker every court, without end (the artist, 29 Oct 2026: "The speed of the moving dot in the
    // serve bar should progressively get faster as you increase in levels"): the curve's own sweep had all but stopped
    // quickening by court ten (0.70 s, and 0.68 at twenty); now what it takes above HARD.FLOOR shrinks by HARD.QUICK
    // each court after the first, so each court's is quicker than the last and none is quicker than a thumb can stop.
    o.sweep = HARD.FLOOR + (o.sweep - HARD.FLOOR) * Math.pow(HARD.QUICK, max(1, level) - 1);
    return o;
  }
  function matchOn(k) {
    var c = courts[k];
    court.m = { k: k, level: c.level, sk: nemSkill(c.level), you: 0, them: 0, n: 0, phase: "serve", t: gt, pc: null, nc: null, replan: 0,
                balls: [], tosses: [], served: 0, pts: 0, stops: [], meterOn: false, meterT0: 0, serveOpen: 0, nextId: 1, lastTc: -9,
                sup: { avail: true, armed: false }, psup: { avail: true }, rec: recNew() };
    superButton();
    var pl = plans[k]; pl.want = null;
    say(STR.match(k + 1, c.level), true);
    tipDone("court"); tip("serve");
    courtWhere();
  }
  // A court's number tapped (the artist, 28 Oct 2026: "I want you to be able to click on the court number and it
  // teleport you to that location, I don't want it to automatically put you in the serving position but right beside it
  // so that you only have to take three steps to be in the Golden Circle"): the hologram blinks there, beside the first
  // point's gold circle, out past its sideline and a little back (4.5 m and 1.5 m), turned to it. His stride lengthens as he
  // speeds up, so from there a walk (the keys, or the stick half pushed) takes three steps to be on it (2.75), a sprint
  // 2.3, a gentle push 3.6 (pb_go.js counts the walk's). The view behind him stands in the open ground past the newest court, clear of the
  // floodlights' poles (from the corner behind the circle one stood between the view and him). The open court's match
  // begins, its circle there to walk into; a won court is there to watch, from behind its baseline. Between matches only.
  function courtGo(k) {
    var cv = courts[k]; if (!cv || court.m) { return; }
    var from = [me.x, me.z]; courtPlace(k);
    fxBlink([from[0], 1.0, from[1]], [me.x, 1.0, me.z], "me");
    if (TIPS.from) { TIPS.from = [me.x, me.z]; }   // (a jump is not a walk: the move tip stays until he moves)
    court.on = -1;
    if (!cv.up) { court.told = {}; matchOn(k); } else { court.told[k + "u"] = 1; say(STR.standin(k, cv.you, cv.them)); courtWhere(); }
  }
  function courtPlace(k) {
    // (the first point's circle: serveSpot() with n = 0)
    var cv = courts[k], cc = courtAt(k), sp = [cc[0] + 0.9, cc[2] + COURT.L + 0.4], to = cv.up ? [cc[0], cc[2] + COURT.L + 3.0] : [sp[0] + 4.5, sp[1] + 1.5];
    var yaw = cv.up ? 0 : Math.atan2(sp[0] - to[0], -(sp[1] - to[1]));
    me.x = to[0]; me.z = to[1]; me.y = 0; me.vx = me.vz = me.vy = 0; me.ax = me.az = 0; me.air = false; me.hop = false; me.move = null; me.celeb = null; me.spin = null; me.yaw = yaw; me.faceTo = cv.up ? null : yaw;
    // (the view starts over there, turned a little right of the circle: straight ahead, the ring on the ground sat over
    // his hat like a halo, as if he were on it already; turned, it stands to his left, the way he walks; less on a
    // narrow screen, where 0.3 put it at the edge)
    view.yaw = yaw + (cv.up ? 0 : min(0.3, 1.95 * Math.atan(T35 * canvas.clientWidth / max(1, canvas.clientHeight)))); view.pitch = REST; view.s = null; view.e = null; view.sv = [0, 0]; if (asc) { asc.last = null; }
  }
  // A button's press: as the finger lifts, from a press begun on it (a phone makes no click for a second finger's tap
  // while the stick's is down: the review of 28 Oct 2026 found the courts' numbers and the Super dead under a walking
  // thumb); a key's press (Enter, Space on a focused button) is a click of no detail. Never while paused.
  function tapOn(el, f) {
    var go = awake(f);
    el.addEventListener("mousedown", function (e) { e.preventDefault(); });   // (a mouse press never focuses it: Space after a cancelled press is still the bar's)
    el.addEventListener("pointerdown", function (e) { if (e.button === 0) { el.dataset.down = e.pointerId; } });
    el.addEventListener("pointerleave", function () { delete el.dataset.down; });
    el.addEventListener("pointercancel", function () { delete el.dataset.down; });
    el.addEventListener("pointerup", function (e) { if (el.dataset.down === String(e.pointerId)) { delete el.dataset.down; go(e); } });
    el.addEventListener("click", function (e) { if (e.detail === 0) { go(e); } });
  }
  // the numbers' buttons, over the squares the HUD draws, made again only when the row changes
  function courtButtons(n0, sz, gap, x0, y0) {
    var box = $("courts"); if (!box) { return; }
    var key = [n0, courts.length, sz.toFixed(1), x0.toFixed(1), y0.toFixed(1), courts.slice(n0).map(function (q) { return q.up ? 1 : 0; }).join("")].join(",");
    if (box.dataset.key === key) { return; }
    box.dataset.key = key; box.textContent = "";
    courts.slice(n0).forEach(function (q, j) {
      var b = document.createElement("button"), x = x0 + j * (sz + gap);
      b.type = "button"; b.textContent = String(q.k + 1); b.setAttribute("aria-label", STR.go(q.k, q.up));
      b.style.left = round(x - gap / 2) + "px"; b.style.top = round(y0 - 6) + "px"; b.style.width = round(sz + gap) + "px"; b.style.height = round(max(48, sz + 12)) + "px";
      tapOn(b, function () { b.blur(); courtGo(q.k); });   // (blurred: Space after it is the serve's, not this again)
      box.appendChild(b);
    });
  }
  // Behind the baseline, the right of the centre mark on even points and the left on odd, as a server stands.
  function serveSpot() { var m = court.m, cc = courtAt(m.k); return [cc[0] + (m.n % 2 ? -0.9 : 0.9), cc[2] + COURT.L + 0.4]; }
  function serveFrom() { var f = me.yaw; return [me.x + Math.cos(f) * 0.45 + Math.sin(f) * 0.35, 0.7, me.z + Math.sin(f) * 0.45 - Math.cos(f) * 0.35]; }
  function netH(lx) { return COURT.NET + (COURT.POST - COURT.NET) * min(1, abs(lx) / (COURT.HW + COURT.PO)); }
  function pearlR() { return 3 * body.cell; }
  // A shot from b's place to the point (tx, tz, court-local) in T seconds; slower (higher) until it clears the net.
  function shoot(b, k, tx, tz, Tf) {
    var cc = courtAt(k), lx = b.x - cc[0], lz = b.z - cc[2], r = pearlR(), g = COURT.G;
    for (var i = 0; i < 12; i += 1) {
      var vx = (tx - lx) / Tf, vz = (tz - lz) / Tf, vy = (r - b.y + 0.5 * g * Tf * Tf) / Tf, tn = -lz / vz;
      var yn = b.y + vy * tn - 0.5 * g * tn * tn;
      if (tn <= 0 || yn - r > netH(lx + vx * tn) + 0.08) { b.vx = vx; b.vy = vy; b.vz = vz; return; }
      Tf += 0.1;
    }
    b.vx = (tx - lx) / Tf; b.vz = (tz - lz) / Tf; b.vy = (r - b.y + 0.5 * g * Tf * Tf) / Tf;
  }
  // One step of a ball: its fall, the net, the court (returns where it bounced, if it did).
  function ballStep(b, k, dt) {
    var cc = courtAt(k), r = pearlR(), n = 4, h = dt / n, out = null;
    for (var i = 0; i < n; i += 1) {
      b.vy -= COURT.G * h;
      var nx = b.x + b.vx * h, ny = b.y + b.vy * h, nz = b.z + b.vz * h;
      if (!b.net && (b.z - cc[2]) * (nz - cc[2]) <= 0 && abs(nx - cc[0]) < COURT.HW + COURT.PO && ny - r < netH(nx - cc[0])) {
        b.net = true; b.vz *= -0.15; b.vx *= 0.3; nz = cc[2] + (b.z > cc[2] ? r : -r);
      }
      if (ny < r) { ny = r; if (b.vy < 0) { b.vy = -b.vy * COURT.E; b.vx *= COURT.ROLL; b.vz *= COURT.ROLL; out = out || [nx, nz]; if (b.vy < 0.4) { b.vy = 0; } } }
      b.x = nx; b.y = ny; b.z = nz; b.spin = (b.spin || 0) + hypot(b.vx, b.vz) * h / r;
    }
    return out;
  }
  function copyBall(b) { return { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, net: b.net, spin: 0 }; }
  // Where the pearl first comes down (court-world x, z), stepping a copy on.
  function ballLands(b, k) { var q = copyBall(b); for (var i = 0; i < 300; i += 1) { var at = ballStep(q, k, 1 / 60); if (at) { return { x: at[0], z: at[1], t: gt + (i + 1) / 60 }; } } return null; }
  function mayVolley(b, m, z) { return b.rally >= 3 && abs(z - courtAt(m.k)[2]) > COURT.K; }
  // Where an athlete on side (+1 his, -1 Mr Plan's) can meet the pearl b next: the flight stepped ahead on a copy, every
  // 1/90 s for up to 2.4 s; the contacts the rules allow (on his side, coming to him, after its bounce, or on the volley
  // where a volley may be, before a second bounce); the one his body reaches at least cost. run(t): what his legs can
  // add first (nought for the player, who runs himself). after: no sooner than that (a stroke already waiting), and a
  // may be where that stroke leaves him rather than where he is ({ x, z }).
  function planContact(a, b, side, run, only, after) {
    var m = court.m, cc = courtAt(m.k), q = copyBall(b), t = 0, bounces = b.bounces, best = null, h = 1 / 90;
    for (var i = 0; i < 216; i += 1) {
      var at = ballStep(q, m.k, h); t += h;
      if (q.net) { break; }
      if (at) { if (side * (at[1] - cc[2]) <= 0) { break; } bounces += 1; if (bounces >= 2) { break; } }
      if (side * (q.z - cc[2]) < 0.1 || side * q.vz <= 0 || (after && t < after)) { continue; }
      // (a volley only where one may be, and from outside the kitchen: his feet, where he stands now, and the pearl
      // far enough out that the stroke's last steps keep them out)
      if (bounces === 0 && !(mayVolley(b, m, q.z) && abs(a.z - cc[2]) > COURT.K && abs(q.z - cc[2]) > COURT.K + 0.4)) { continue; }
      var p = [q.x, q.y, q.z], r = reachOf(a, t, p, run, only);
      if (r && (!best || r.cost + 0.25 * t < best.cost + 0.25 * best.t)) { best = { t: t, p: p, reach: r.reach, cost: r.cost, volley: bounces === 0, ball: b }; }
    }
    return best;
  }
  // The blink (with two or three pearls in play only): a pearl no run can get him to in time, the hologram he is goes to
  // at once, a trail of characters where he was, and plays it (Mr Plan, his negative, the same).
  function blinkRun(t) { return t > 0 ? 1e3 : 0; }
  function blinkTo(a, c, who) {
    var to = who === "me" ? [c.p[0] - 0.55, c.p[2] + 0.35] : [c.p[0] + 0.55, c.p[2] - 0.35];
    fxBlink([a.x, 0.9, a.z], [to[0], 0.9, to[1]], who);
    a.x = to[0]; a.z = to[1]; a.vx = a.vz = 0;
  }
  function runOf(react) {
    return function (t) { t = max(0, t - react - 0.05); var t1 = CAPS.vmax / CAPS.acc; return t < t1 ? 0.5 * CAPS.acc * t * t : 0.5 * CAPS.vmax * t1 + CAPS.vmax * (t - t1); };
  }
  function strokeKind(c) { return c.reach === "leap" || c.p[1] > CAPS.top - 0.1 ? "overhead" : c.reach === "dig" || c.p[1] < 0.28 ? "dig" : c.volley ? "volley" : "drive"; }
  function leadOf(c, stand) { return c.reach === "leap" ? Math.sqrt(2 * clampV(c.p[1] - CAPS.top + 0.15, 0.12, CAPS.leapUp) / CAPS.g) + 0.16 : c.reach === "dive" ? 0.3 : c.reach === "lunge" ? 0.26 : stand; }
  function live(m) { return m.balls.filter(function (q) { return !q.dead; }); }
  /* -- the serve (the artist, 28 Oct 2026: "I want you to be able to serve up [to] 3 balls in one serve so you can
     play multiple balls/points at once. Use the scope view for the every serve and add an animation that you have to
     land a bar within a certain zone to have the opportunity to ace your opponent. Depending on where you click to stop
     the bar depends on how hard you serve"; then "Get rid of the scope view in the Pickleball game"). At his serve
     the third person's view turns to face across the net (where it looks, inside the diagonal service court, the serve
     goes: a drag aims it), and a bar runs, a mark sweeping
     it back and forth; a tap stops it, and where it stops is how hard he serves: too soft and the pearl falls in the
     kitchen (a fault); then softer to harder, the harder the deeper and quicker; a narrow gold zone, the ace zone, sends
     it hard into the deep corner, where Mr Plan may not get it at all; past the end it goes long. After each pearl the
     mark sweeps again: up to three pearls in a serve, each a point of its own, played at once, while the serve is open
     (until 1.3 s after the last); then the view is the third person's again. */
  // (the mark a gold circle of R metres; within two of its radii he is taken onto it, the artist, 28 Oct 2026: "As long
  // as the user runs within two radius' of the serve spot, they should lock into the location to serve")
  var SERVE = { SOFT: 0.12, ACE: [0.72, 0.84], LONG: 0.94, MAX: 3, OPEN: 1.3, GAP: 0.34, R: 0.5, ON: 1.0, LEAD: 0.3 };
  function servePeriod(m) { return m.sk.sweep; }   // the sweep, there and back half of it: quicker each court
  function meterAt(m) { var u = (max(0, gt - m.meterT0) / servePeriod(m)) % 2; return u < 1 ? u : 2 - u; }
  function aceChance(m) { return m.sk.ace; }   // (an opportunity, not a gift: four in five on court one, a third by court ten)
  function serveTap(m) {
    var sp = serveSpot();
    if (m.served + m.tosses.length >= serveMax() || (m.pc && m.phase === "rally") || hypot(me.x - sp[0], me.z - sp[1]) > SERVE.ON) { return; }   // (only from the mark)
    tipDone("bar");   // (he has served)
    var u = meterAt(m), mb = hudBox.meter, wd = u < SERVE.SOFT ? "soft" : u >= SERVE.LONG ? "long" : u >= SERVE.ACE[0] && u < SERVE.ACE[1] ? "ace" : "good";
    if (mb && mb.cw) { cuePop(STR.cue.pop[wd], [mb.x0 + u * mb.N * mb.cw, TUT.on ? mb.y0 + 58 : mb.y0 - 28], wd === "soft" || wd === "long" ? CUE_COL.coral : wd === "good" ? CUE_COL.ink : CUE_COL.gold); }   // (the walk-through's under the bar, clear of its arrow)
    if (TUT.on && (wd === "soft" || wd === "long")) { cueSay(STR.cue.pop[wd] + ". " + STR.walk.sr.serve[CUE.hand === "touch" ? 0 : 1]); return; }   // (the walk-through's serve: a fault's tap only says so, and the bar runs on)
    var last = m.tosses.length ? m.tosses[m.tosses.length - 1].tc : m.lastTc || -9, tc = max(gt + 0.3, last + SERVE.GAP);
    m.tosses.push({ u: u, tc: tc, t0: tc - 0.3, yaw: view.yaw });   // (aimed where he looked at the tap)
    m.meterT0 = gt + SERVE.LEAD; m.stops.push(u); m.serveOpen = max(m.serveOpen, gt + SERVE.OPEN);   // (the serve open from the tap)
    athSwing(me, { tc: tc, p: serveFrom(), kind: "serve", aim: [0, 0, -1] }, gt);
    if (m.phase === "serve") { m.phase = "toss"; }
    var nP = m.served + m.tosses.length; if (nP === 1) { tip("pearls"); } else if (nP >= 2) { tipDone("pearls"); }   // (the 2nd and 3rd pearl, shown at the 1st)
  }
  // The pearl struck at the meter's mark: too soft, the kitchen; too hard, long; the ace zone, the deep corner, hard.
  function serveBall(m, toss) {
    var cc = courtAt(m.k), s0 = serveFrom(), side = m.n % 2 ? 1 : -1, u = toss.u, sk = m.sk, depth, Tf, ace = false;
    var b = { id: m.nextId++, x: s0[0], y: s0[1], z: s0[2], vx: 0, vy: 0, vz: 0, net: false, spin: 0, last: "you", bounces: 0, serve: true, rally: 1,
              nemAt: gt + sk.wait, mark: null, dead: false, u: u };
    if (u < SERVE.SOFT) { depth = COURT.K * (0.35 + 0.5 * u / SERVE.SOFT); Tf = 1.5; }
    else if (u >= SERVE.LONG) { depth = COURT.L + 0.5 + 1.4 * (u - SERVE.LONG) / (1 - SERVE.LONG); Tf = 0.95; }
    else if (u >= SERVE.ACE[0] && u < SERVE.ACE[1]) { depth = COURT.L - 0.35; Tf = 0.8; ace = true; }
    else { var k2 = (u - SERVE.SOFT) / (SERVE.LONG - SERVE.SOFT); depth = COURT.K + 0.6 + k2 * (COURT.L - COURT.K - 1.0); Tf = 1.45 - 0.55 * k2; }
    var lz = b.z - cc[2], lx = b.x - cc[0], tz = -depth, tx = lx + Math.tan(toss.yaw != null ? toss.yaw : view.yaw) * (lz - tz);
    tx = ace ? side * (COURT.HW - 0.35) : side * clampV(side * tx, 0.3, COURT.HW - 0.3);
    shoot(b, m.k, tx, tz, Tf);
    fxBurst([b.x, b.y, b.z], "me", ace);
    b.ace = ace && !TUT.on && rng() < aceChance(m);
    m.balls.push(b); m.served += 1; m.lastTc = toss.tc;
    m.serveOpen = gt + SERVE.OPEN;
    if (ace) { say(STR.aceZone); }
    athSplit(plans[m.k], gt);
  }
  // A point, on one pearl: it is dead; the other pearls play on. The match ends the moment it is won or lost.
  function pointBall(m, b, toYou, why) {
    if (b.dead) { return; }
    b.dead = true; b.deadT = gt; b.mark = null;
    if (m.pc && m.pc.ball === b) { m.pc = null; }
    if (m.nc && m.nc.ball === b) { m.nc = null; }
    var tut = TUT.on, sup = tut && m.phase === "super";   // (the walk-through's: its Super's point the first of the match, any other none)
    if (!tut || sup) { if (toYou) { m.you += 1; } else { m.them += 1; } }
    m.pts += 1;
    if (b.rally > courts.best) { courts.best = b.rally; }   // (the longest rally, kept with the next save; the score is the courts)
    say(tut && !sup ? why : why + " " + STR.rally(m.you, m.them, b.rally));
    if (sup) { tutFinish(); TUT.free = true; }   // (his Super given back at the next serve)
    // (said where it happened: each pearl's point while several play)
    if (!tut && cueKey() === "multi") { cuePop(STR.cue.pop.plus, [b.x, 0.4, b.z], toYou ? CUE_COL.gold : CUE_COL.ice); }
    var over = m.you >= COURT.WIN || m.them >= COURT.WIN;
    if (over) { m.balls.forEach(function (q) { if (!q.dead) { q.dead = true; q.deadT = gt; q.mark = null; q.cleared = true; } }); m.tosses = []; m.pc = m.nc = null; }
    if (over || !live(m).length) { athCelebrate(toYou ? me : plans[m.k], true, gt); athCelebrate(toYou ? plans[m.k] : me, false, gt); }
    courtWhere();
  }
  function matchStep(dt, c) {
    var m = court.m, cc = courtAt(m.k), pl = plans[m.k], fire = c.fire;
    if (m.phase === "super") { superStep(m, dt); return; }
    if (m.phase === "plansuper") { psupStep(m, dt, fire); return; }
    if (m.sup.armed && (m.phase === "serve" || m.phase === "toss" || m.phase === "rally") && superStart(m)) { return; }
    if (m.phase === "serve") {
      // (he runs to his serve himself, to the gold mark (the artist, 28 Oct 2026: "Get rid of the serve button and just
      // have the animation start the serve position when you run to the right place"); there he steps onto it, turns
      // to the net with a bounce, the view swings round behind him on its spring, and the bar runs; a tap stops it)
      var sp = serveSpot();
      pl.want = { to: [cc[0], cc[2] - COURT.L - 0.6] }; pl.faceTo = PI;
      if (!m.meterOn && hypot(me.x - sp[0], me.z - sp[1]) < SERVE.ON) {
        m.meterOn = true; m.meterT0 = gt + 0.35; athSplit(me, gt); tipDone("serve"); tip("bar");
        fxRing([sp[0], 0.03, sp[1]], "me");
      }
      if (m.meterOn) { me.want = { to: sp, k: 0.8 }; me.faceTo = m.n % 2 ? 0.12 : -0.12; if (fire && gt >= m.meterT0) { serveTap(m); } }
    } else if (m.phase === "toss" || m.phase === "rally") {
      if (m.meterOn && fire && gt < m.serveOpen && gt >= m.meterT0) { serveTap(m); }   // (not in the sweep's lead-in: a double tap is one pearl)
      if (m.tosses.length) { me.want = { vel: [0, 0] }; }
    }
    // the pearls tossed and struck, each at its stroke's contact
    while (m.tosses.length && gt >= m.tosses[0].tc) { serveBall(m, m.tosses.shift()); if (m.phase === "toss") { m.phase = "rally"; } }
    var sp1 = serveSpot();
    if (m.meterOn && m.phase === "rally" && !m.tosses.length && (gt >= m.serveOpen || m.served >= serveMax() || hypot(me.x - sp1[0], me.z - sp1[1]) > SERVE.ON)) { m.meterOn = false; }   // (off the mark, the serve is over)
    // every pearl: its flight, its bounces, its points (rolling on a while when dead)
    m.balls.forEach(function (b) {
      var at = ballStep(b, m.k, dt);
      if (b.dead || !at) { return; }
      var side = at[1] - cc[2] > 0 ? "you" : "them", alx = at[0] - cc[0], alz = at[1] - cc[2];
      if (b.bounces === 0) {
        var inn = abs(alx) <= COURT.HW + 0.03 && abs(alz) <= COURT.L + 0.03 && (!b.serve || abs(alz) >= COURT.K - 0.03);
        if (side === b.last) { pointBall(m, b, side !== "you", side === "you" ? STR.net : STR.netPlan); }
        else if (!inn) { pointBall(m, b, b.last !== "you", b.serve ? (abs(alz) < COURT.K ? STR.kitchen : STR.long) : b.last === "you" ? STR.out : STR.outPlan); }
        else { b.bounces = 1; if (b.ace && side === "them") { pointBall(m, b, true, STR.ace); } }
      } else { pointBall(m, b, side !== "you", side === "you" ? STR.twice : STR.twicePlan); }
    });
    if (m.phase === "rally") {
      mine(m); plans_(m, pl);
      if (!live(m).length && !m.tosses.length) { m.phase = "point"; m.t = gt; m.meterOn = false; }
    } else if (m.phase === "point" && gt - m.t >= 1.4) {
      m.balls = [];
      if (m.you >= COURT.WIN) { levelWon(); return; }
      if (m.them >= COURT.WIN) { say(STR.planTakes(m.them, m.you), true); m.you = m.them = 0; m.sup = { avail: true, armed: m.sup.armed }; m.psup = { avail: true }; m.rec = recNew(); superButton(); }   // (a new game: a new super return)
      m.n += max(1, m.pts); m.pts = 0; m.served = 0; m.stops = []; m.phase = "serve"; courtWhere();
      if (m.sup.avail) { tip("super"); }   // (after the first point: the super, for the next)
    }
    if (m.phase === "rally" || m.phase === "point") {
      // between strokes Mr Plan comes back towards the middle of his baseline, a little inside it; he faces the pearl
      var lv = live(m), near = lv.filter(function (q) { return q.last === "you"; })[0] || lv[0];
      if (!m.nc && !(near && near.last === "you" && gt >= near.nemAt)) { pl.want = { to: [cc[0] + (me.x - cc[0]) * 0.35, cc[2] - COURT.L + 0.6] }; }
      if (near) { pl.faceTo = Math.atan2(near.x - pl.x, -(near.z - pl.z)); }
    }
    courtWhere();
  }
  // His strokes: automatic. While Mr Plan's shots come, where his racket can meet each is found every frame (he runs
  // himself; nothing is added to his legs), the soonest he can make taken, and the stroke goes when its wind-up must
  // begin; then the pearl goes where the view looks, as it did on the rocket world's courts.
  // Two or three pearls in play (the artist, 28 Oct 2026: "when I serve two or three balls, each ball counts as its own
  // point and both players must play both balls"): no one runs to three places at once, so then the game runs him, as
  // it runs Mr Plan, to each pearl that comes to him in turn (where no run gets there in time, the blink); a pearl that
  // must be met before the stroke that waits is met first (the other found again after it); two that come together
  // within his reach, one stroke plays both. The stick is his again between pearls.
  // (each pearl its own way to it, his legs or, with two or more in play, the blink; the soonest of them)
  function soonest(a, side, lv, run, multi, skip, own) {
    var best = null;
    lv.forEach(function (b) {
      if (b === skip) { return; }
      var c = (own && own(b)) || planContact(a, b, side, run);
      if (!c && multi && !(side < 0 && b.ace)) { c = planContact(a, b, side, blinkRun); if (c) { c.blink = true; } }
      if (c && (!best || c.t < best.t)) { best = c; }
    });
    return best;
  }
  function mine(m) {
    var lv = live(m).filter(function (q) { return q.last === "them"; }), multi = live(m).length > 1, legs = runOf(multi ? 0.12 : 1e9);
    if (lv.length) { var f = lv[0]; me.faceTo = clampV(Math.atan2(f.x - me.x, -(f.z - me.z)), -1.2, 1.2); }
    if (!m.tosses.length) {
      var best = soonest(me, 1, lv, legs, multi, m.pc && m.pc.ball);
      if (m.pc && best && best.t + 0.14 > m.pc.tc - gt) { best = null; }   // (only one that must come first)
      if (best && multi && !m.pc) { me.want = { to: [best.p[0] - 0.55, best.p[2] + 0.35] }; }   // (on his way to it)
      if (best && best.t <= leadOf(best, WIND[strokeKind(best)]) + 0.02) { myPlan(m, best); }
    }
    // (a stroke standing: the last steps in to it are his own, the pearl on his right, so the stroke meets it)
    if (m.pc && (m.pc.reach === "stand" || m.pc.reach === "dig" || multi)) { me.want = { to: [m.pc.p[0] - 0.55, m.pc.p[2] + 0.35] }; }
    if (m.pc && gt >= m.pc.tc) { var pc = m.pc; m.pc = null; myStroke(m, pc); }
  }
  function myPlan(m, c) { if (c.blink) { blinkTo(me, c, "me"); if (cueKey() === "multi") { cuePop(STR.cue.pop.blink, [me.x, 1.8, me.z]); } } c.kind = strokeKind(c); c.tc = gt + c.t; m.pc = c; c.aimAt = aimPoint(m, c); c.aim = norm([c.aimAt[0] - c.p[0], 0.35, c.aimAt[1] - c.p[2]]); athSwing(me, c, gt); }
  function myStroke(m, pc) {
    var cc = courtAt(m.k), b = pc.ball;
    if (b.dead || b.last !== "them") { return; }
    if (b.bounces === 0 && abs(me.z - cc[2]) < COURT.K) { pointBall(m, b, false, STR.kitchenVolley); return; }   // (the rule: no volley from the kitchen)
    var multi = live(m).length > 1, hit = function (q, at) {
      // (at full stretch, now and then out: long or wide)
      if (multi && rng() < m.sk.stretch) { at = rng() < 0.5 ? [at[0], cc[2] - (COURT.L + 0.6 + 0.8 * rng())] : [cc[0] + (rng() < 0.5 ? -1 : 1) * (COURT.HW + 0.5 + 0.6 * rng()), at[1]]; }
      shoot(q, m.k, at[0] - cc[0], at[1] - cc[2], pc.kind === "overhead" ? 0.75 : pc.kind === "dig" ? 1.3 : 1.05);
      fxBurst([q.x, q.y, q.z], "me", pc.kind === "overhead");
      q.last = "you"; q.bounces = 0; q.serve = false; q.rally += 1; q.nemAt = gt + m.sk.wait; q.mark = null;
      var fl = rng(); q.flair = fl < m.sk.flair ? "dive" : fl < 2 * m.sk.flair ? "lunge" : null;
    };
    if (cueKey() === "rally") { cuePop(STR.cue.pop.auto, [pc.p[0], pc.p[1] + 0.6, pc.p[2]]); }
    hit(b, pc.aimAt); tipDone("rally");
    doubles(m, b, 1).forEach(function (q) { hit(q, aimPoint(m, { p: [q.x, q.y, q.z] })); });
    athSplit(plans[m.k], gt);
  }
  // the other pearls a stroke meets as it plays one: those that come with it, within the guitar's reach of it, and
  // those no stroke after this one could still meet (two at once, metres apart): an echo of him, in characters, plays
  // each of those where it is. Each its own shot; a pearl the rules let him play there (on his side, bounced once, or a
  // volley where one may be, at a height a guitar meets)
  function doubles(m, b, side) {
    var cc = courtAt(m.k), who = side > 0 ? "them" : "you", a = side > 0 ? me : plans[m.k];
    return live(m).filter(function (q) {
      if (q === b || q.last !== who || side * (q.z - cc[2]) <= 0.1 || q.y < 0.05 || q.y > CAPS.top + CAPS.leapUp) { return false; }
      if (!(q.bounces === 1 || (q.bounces === 0 && mayVolley(q, m, q.z) && abs(q.z - cc[2]) > COURT.K + 0.4))) { return false; }
      if (hypot(q.x - b.x, q.y - b.y, q.z - b.z) < 1.3) { return true; }
      if (planContact(a, q, side, blinkRun, null, 0.14)) { return false; }   // (still to be met after this stroke)
      fxEcho([q.x, q.y, q.z], side > 0 ? "me" : "plan");
      return true;
    });
  }
  // Where his return goes: the view's way, deep, as the rocket world aimed it (the far baseline less up to 1.6 m).
  // (and then, the artist, 28 Oct 2026: "When you are returning Mr. Plan's hits the ability to toggle with your right
  // thumb the direction in which you look should be disabled and you should just be able to move around with your left
  // thumb": in a rally the view is held behind him facing the net, and his returns go for the open court, away from
  // where Mr Plan stands, deep)
  function aimPoint(m, c) {
    var cc = courtAt(m.k), plx = plans[m.k].x - cc[0], dz = -(COURT.L - 0.6 - 1.6 * rng());
    return [cc[0] + clampV(-(plx >= 0 ? 1 : -1) * (0.5 + 1.3 * rng()), -COURT.HW + 0.3, COURT.HW - 0.3), cc[2] + dz];
  }
  // whether the view may be turned: walking, or at the serve and while it is open (to aim each pearl); never once a pearl
  // comes back to him
  function canLook() {   // (and while the serve is open, to aim the next pearl, until a pearl comes back to him)
    var m = court.m; return !m || m.phase === "serve" || (m.meterOn && (m.phase === "toss" || m.phase === "rally") && !m.balls.some(function (b) { return !b.dead && b.last === "them"; }));
  }
  // Mr Plan's: after his wait he reads the pearls, runs to where he will meet the soonest he can (his legs' reach
  // added), and strokes: away from Mr Pearl, deeper and wider as his level is, a dink into the kitchen, a lob; now and
  // then out, or into a dive that does not get there. One body: two pearls close together, and one may get by him. An
  // ace (the serve's gold zone, and his luck) he goes for at full stretch and does not reach.
  // With two or three pearls in play he goes for every one (the artist: "both players must play both balls"), as Mr
  // Pearl does: each in turn, the blink where no run gets there, one that must come first first, two together in one
  // stroke.
  function plans_(m, pl) {
    var lv = live(m).filter(function (q) { return q.last === "you" && gt >= q.nemAt; }), multi = live(m).length > 1;
    var onlyOf = function (b) { return b.ace ? { dive: 1, lunge: 1, leap: 1 } : b.flair === "dive" ? { dive: 1, leap: 1 } : b.flair === "lunge" ? { lunge: 1, leap: 1 } : null; };
    if (lv.length && gt >= m.replan && (!m.nc || multi)) {
      m.replan = gt + 0.08;
      var best = soonest(pl, -1, lv, runOf(0), multi, m.nc && m.nc.ball, function (b) { var only = onlyOf(b); return only && planContact(pl, b, -1, runOf(0), only); });
      if (m.nc && best && best.t + 0.14 > m.nc.tc - gt) { best = null; }   // (only one that must come first)
      if (best) {
        // (stand off from the contact by most of his reach, the pearl on his right: his right is -x, facing +z)
        if (!m.nc) { pl.want = { to: [best.p[0] + 0.55, best.p[2] - 0.35] }; }
        if (best.t <= leadOf(best, 0.28) + 0.02) { if (psupWill(m, best)) { psupStart(m, best.ball); return; } planPlan(m, pl, best); }
      }
    }
    if (m.nc && multi) { pl.want = { to: [m.nc.p[0] + 0.55, m.nc.p[2] - 0.35] }; }
    if (m.nc && gt >= m.nc.tc) { var nc = m.nc; m.nc = null; planStroke(m, pl, nc); }
  }
  // his stroke at c, chosen: where it goes (away from Mr Pearl, deeper and wider as his level is, a dink, a lob, now and
  // then out) and whether the dive or the lunge gets there
  function planPlan(m, pl, c) {
    if (c.blink) { blinkTo(pl, c, "plan"); }
    var cc = courtAt(m.k), sk = m.sk, b = c.ball, ux = c.p[0] - pl.x, uz = c.p[2] - pl.z, ul = hypot(ux, uz) || 1;
    c.kind = strokeKind(c); c.tc = gt + c.t;
    c.miss = !TUT.on && (b.ace || (!c.blink && ((c.reach === "dive" && rng() > sk.dive) || (c.reach === "lunge" && rng() > sk.lunge))));
    var plx = me.x - cc[0], wx = clampV(-Math.sign(plx || 1) * sk.wide + (rng() - 0.5) * 0.8, -COURT.HW + 0.25, COURT.HW - 0.25), wz = min(COURT.L - 0.3, sk.deep + (rng() - 0.5)), Tf = sk.T;
    var pick = rng();
    if (pick < sk.dink) { wz = COURT.K * (0.35 + 0.5 * rng()); Tf = sk.T + 0.25; c.kind = c.kind === "drive" ? "dink" : c.kind; }
    else if (pick < sk.dink + sk.lob) { wz = COURT.L - 0.6 - 0.8 * rng(); Tf = 1.9 + 0.3 * rng(); }   // a lob: high, deep, to be leapt for
    var e = rng();
    if (e < sk.err && !TUT.on) { if (e < sk.err / 2) { wz = COURT.L + 0.5 + 0.8 * rng(); } else { wx = Math.sign(wx || 1) * (COURT.HW + 0.4 + 0.6 * rng()); } }
    c.shot = [wx, wz, Tf]; c.aim = norm([wx + cc[0] - c.p[0], 0.35, wz + cc[2] - c.p[2]]);
    if (c.miss) { var off = c.reach === "dive" ? 0.9 : 0.5; c.p = [c.p[0] - ux / ul * off, c.p[1], c.p[2] - uz / ul * off]; }
    m.nc = c; athSwing(pl, c, gt);
  }
  function planStroke(m, pl, nc) {
    var cc = courtAt(m.k), nb = nc.ball;
    if (nc.miss || nb.dead || nb.last !== "you") { return; }   // (the dive or the lunge did not get there: the pearl goes on)
    if (nb.bounces === 0 && abs(pl.z - cc[2]) < COURT.K) { pointBall(m, nb, true, STR.kitchenVolleyPlan); return; }
    var hit = function (q, sh) {
      shoot(q, m.k, sh[0], sh[1], sh[2]);
      fxBurst([q.x, q.y, q.z], "plan", false);
      q.last = "them"; q.bounces = 0; q.serve = false; q.rally += 1;
      var L0 = ballLands(q, m.k); q.mark = L0 && { x: L0.x, z: L0.z, t: L0.t };
    };
    hit(nb, nc.shot); tip("rally");
    doubles(m, nb, -1).forEach(function (q) { if (!q.ace) { hit(q, [clampV(-nc.shot[0] * 0.6 + (rng() - 0.5), -COURT.HW + 0.3, COURT.HW - 0.3), clampV(nc.shot[1] - 1 + 2 * rng(), COURT.K + 0.5, COURT.L - 0.3), nc.shot[2] + 0.1]); } });
    athSplit(me, gt);
  }
  /* -- the matches won, played again (the artist, 28 Oct 2026: "Make sure that the games that are repeating are
     repeating the actual motions of the game in which you won"). While he plays a match, twenty times a second: all a
     pose is made of, his and Mr Plan's (place, turn, lean, crouch, stride, speed, and the stroke, the dive or the leap
     each is in, with its own clock), the pearls in play, the score, and every burst; the last 90 seconds kept. A court
     won plays that again, over and over with a breath between, his stand-in in his steps and its Mr Plan in his, the
     pearls on their own ways. The twelve courts won last keep theirs (some 400 KB each); an older one, or one won
     before this version, rallies as before. */
  var REC = { HZ: 20, SEC: 90, KEEP: 12, S: 55, ROOM: 5.1e5 }, AF = ["x", "y", "z", "yaw", "drop", "wide", "leanF", "leanS", "phase", "speed", "vx", "vz", "kick", "skid", "splitT"];
  function recNew() { var n = REC.HZ * REC.SEC; return { f: new Float32Array(n * REC.S), r: new Array(n * 6), n: 0, cap: n, t0: gt, last: -1e9, fx: [] }; }
  function recPut(rec, m) {
    if (gt - rec.last < 1 / REC.HZ - 1e-4) { return; }
    rec.last = gt;
    var i = rec.n % rec.cap, o = i * REC.S, f = rec.f;
    f[o] = gt - rec.t0; f[o + 1] = m.you; f[o + 2] = m.them;
    [me, plans[m.k]].forEach(function (a, j) {
      var b = o + 3 + j * 17;
      AF.forEach(function (key, q) { f[b + q] = key === "splitT" ? (a.splitT != null ? a.splitT - rec.t0 : -1e4) : (a[key] || 0); });
      f[b + 15] = a.air ? 1 : 0; f[b + 16] = a.hop ? 1 : 0;
      rec.r[i * 6 + j * 3] = a.move; rec.r[i * 6 + j * 3 + 1] = a.celeb; rec.r[i * 6 + j * 3 + 2] = a.spin;
    });
    for (var q = 0; q < 3; q += 1) { f[o + 37 + q * 6 + 4] = 0; }
    m.balls.forEach(function (b) { if (b.dead && gt - b.deadT > 0.3) { return; } var c = o + 37 + (b.id % 3) * 6; f[c] = b.x; f[c + 1] = b.y; f[c + 2] = b.z; f[c + 3] = b.spin || 0; f[c + 4] = 1; f[c + 5] = b.id; });
    rec.n += 1;
  }
  // a court won takes the match's recording (in its order, oldest first), and only the twelve last won keep one
  function recKeep(k, rec) {
    if (!rec || rec.n < 2) { return; }
    var count = min(rec.n, rec.cap), start = rec.n > rec.cap ? rec.n % rec.cap : 0, first = rec.f[start * REC.S];
    courts[k].rec = { f: rec.f, r: rec.r, cap: rec.cap, start: start, count: count, t0: rec.t0, first: first,
                      dur: rec.f[((start + count - 1) % rec.cap) * REC.S] - first, fx: rec.fx.filter(function (e) { return e.t >= first; }), prev: -1 };
    courts[k].recP = null; courts.recJ = null;
    var kept = courts.filter(function (c) { return c.rec; });
    while (kept.length > REC.KEEP) { recDrop(kept.shift()); }
  }
  // (a court's recording let go: its two out of the strokes it held, whose times were the recording's clock's)
  function recDrop(c) { c.rec = null; c.recP = null; courts.recJ = null; [stands[c.k], plans[c.k]].forEach(function (a) { a.move = a.celeb = a.spin = null; }); }
  /* -- the matches won, kept with the save (the artist, 29 Oct 2026: "I want the games that you have won to save even when
     I go out of the artifact so they are always replaying. Right now when I return to the games resort to a simple back
     and forth"). A court's recording is written once, the first time it is saved: each of its 55 columns as the steps
     from frame to frame, in thousandths (a millimetre, a millisecond), each step in as few bytes as it needs (seven bits
     a byte, the eighth saying another follows), in base 64; the strokes, flips and spins it holds as one table and, for
     each athlete, the frames where his changes (their crouch is a function, left out: a replay poses its two from the
     crouch recorded, it does not step them); its bursts as they were. Some 50 to 150 KB a match. The newest go in first,
     as many as REC.ROOM holds: the whole save under the 500 KiB YouTube recommends (the artist, 29 Oct 2026: "Cap it then
     at 500 KiB"), some three to nine matches; read back, each plays again. The rest stay in memory while the game runs. */
  var B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", B64I = {};
  B64.split("").forEach(function (ch, i) { B64I[ch] = i; });
  function recPack(R) {
    var S = REC.S, n = R.count, out = [], row = function (i) { return ((R.start + i) % R.cap) * S; };
    var put = function (d) { var z = d < 0 ? -2 * d - 1 : 2 * d; do { var b = z % 128; z = floor(z / 128); out.push(z > 0 ? b + 128 : b); } while (z > 0); };
    for (var c = 0; c < S; c += 1) { var prev = 0; for (var i = 0; i < n; i += 1) { var q = Math.round(R.f[row(i) + c] * 1000); put(q - prev); prev = q; } }
    var bs = "", ch = [], objs = [];
    for (var j = 0; j < out.length; j += 3) {
      var v = (out[j] << 16) | ((out[j + 1] || 0) << 8) | (out[j + 2] || 0);
      bs += B64[(v >> 18) & 63] + B64[(v >> 12) & 63] + (j + 1 < out.length ? B64[(v >> 6) & 63] : "=") + (j + 2 < out.length ? B64[v & 63] : "=");
    }
    for (var a = 0; a < 6; a += 1) {
      var list = [], last;
      for (var i2 = 0; i2 < n; i2 += 1) {
        var o = R.r[((R.start + i2) % R.cap) * 6 + a] || null;
        if (i2 > 0 && o === last) { continue; }
        var id = -1; if (o) { id = objs.indexOf(o); if (id < 0) { id = objs.length; objs.push(o); } }
        list.push(i2, id); last = o;
      }
      ch.push(list);
    }
    var plain = function (x) { return JSON.parse(JSON.stringify(x, function (key, v) { return typeof v === "function" ? undefined : typeof v === "number" ? Math.round(v * 1e4) / 1e4 : v; })); };
    return { v: 1, n: n, t0: R.t0, first: R.first, dur: R.dur, f: bs, o: plain(objs), ch: ch, fx: plain(R.fx) };
  }
  function recUnpack(P) {
    var S = REC.S, n = P.n, f = new Float32Array(n * S), s = P.f, p = 0, bytes = new Uint8Array(s.length * 3 / 4), nb = 0;
    if (!(P.v === 1 && n >= 2 && n <= REC.HZ * REC.SEC && typeof s === "string" && Array.isArray(P.ch) && P.ch.length === 6 && Array.isArray(P.o))) { return null; }
    for (var j = 0; j < s.length; j += 4) {
      var v = ((B64I[s[j]] || 0) << 18) | ((B64I[s[j + 1]] || 0) << 12) | ((B64I[s[j + 2]] || 0) << 6) | (B64I[s[j + 3]] || 0);
      bytes[nb++] = (v >> 16) & 255; if (s[j + 2] !== "=") { bytes[nb++] = (v >> 8) & 255; } if (s[j + 3] !== "=") { bytes[nb++] = v & 255; }
    }
    for (var c = 0; c < S; c += 1) {
      var prev = 0;
      for (var i = 0; i < n; i += 1) {
        var z = 0, mu = 1, b; do { if (p >= nb) { return null; } b = bytes[p++]; z += (b & 127) * mu; mu *= 128; } while (b >= 128);
        prev += z % 2 ? -(z + 1) / 2 : z / 2; f[i * S + c] = prev / 1000;
      }
    }
    if (p !== nb) { return null; }
    var r = new Array(n * 6);
    P.ch.forEach(function (list, a) { for (var q = 0; q < list.length; q += 2) { var o = list[q + 1] >= 0 ? P.o[list[q + 1]] || null : null, end = q + 2 < list.length ? list[q + 2] : n; for (var i = list[q]; i < end && i < n; i += 1) { r[i * 6 + a] = o; } } });
    return { f: f, r: r, cap: n, start: 0, count: n, t0: +P.t0 || 0, first: +P.first || 0, dur: +P.dur || 0, fx: Array.isArray(P.fx) ? P.fx : [], prev: -1 };
  }
  // a won court, at its moment in the loop: its two athletes set as they were, its pearls, its score, its bursts
  function replayStep(cv, k) {
    var R = cv.rec, S = REC.S, st = stands[k], pl = plans[k], rt = max(0, (gt - cv.t0) % (R.dur + 2)), tt = min(rt, R.dur);
    var ix = function (i) { return (R.start + i) % R.cap; }, T = function (i) { return R.f[ix(i) * S] - R.first; };
    var i = clampV(floor(tt * REC.HZ), 0, R.count - 2);
    while (i > 0 && T(i) > tt) { i -= 1; } while (i < R.count - 2 && T(i + 1) <= tt) { i += 1; }
    var o0 = ix(i) * S, o1 = ix(i + 1) * S, t0 = T(i), t1 = T(i + 1), u = t1 > t0 ? clampV((tt - t0) / (t1 - t0), 0, 1) : 0, f = R.f;
    [st, pl].forEach(function (a, j) {
      var b0 = o0 + 3 + j * 17, b1 = o1 + 3 + j * 17;
      AF.forEach(function (key, q) { var x0 = f[b0 + q], x1 = f[b1 + q]; a[key] = key === "yaw" ? x0 + angle(x1 - x0) * u : key === "splitT" ? R.t0 + x0 : x0 + (x1 - x0) * u; });
      a.air = f[b0 + 15] > 0.5; a.hop = f[b0 + 16] > 0.5; a.stepL = clampV(0.3 + 0.16 * a.speed, 0.3, 2.3);
      var ri = ix(i) * 6 + j * 3; a.move = R.r[ri]; a.celeb = R.r[ri + 1]; a.spin = R.r[ri + 2];
      a.replayT = R.t0 + f[o0] + (f[o1] - f[o0]) * u;
    });
    cv.rp = [];
    for (var q = 0; q < 3; q += 1) {
      var c0 = o0 + 37 + q * 6, c1 = o1 + 37 + q * 6; if (f[c0 + 4] < 0.5) { continue; }
      var w = f[c1 + 4] > 0.5 && f[c1 + 5] === f[c0 + 5] ? u : 0;
      cv.rp.push([[f[c0] + (f[c1] - f[c0]) * w, f[c0 + 1] + (f[c1 + 1] - f[c0 + 1]) * w, f[c0 + 2] + (f[c1 + 2] - f[c0 + 2]) * w], f[c0 + 3]]);
    }
    cv.you = f[o0 + 1]; cv.them = f[o0 + 2];
    // (the bursts, as they burst then; a new loop starts them over)
    var at = R.first + tt; if (rt < R.prev) { R.prev = -1; }
    if (abs(courtAt(k)[0] - cur.eye[0]) < 60) { replaying = true; R.fx.forEach(function (e) { if (e.t > R.first + R.prev && e.t <= at) { fxBurst(e.p.slice(), e.who, e.big); } }); replaying = false; }
    R.prev = tt;
  }
  function levelWon() {
    var m = court.m, c = courts[m.k];
    if (TUT.on) { tutFinish(); }
    recKeep(m.k, m.rec);
    c.won = true; c.up = true; c.you = c.them = 0; c.t0 = gt; c.next = gt + 4; c.i = -1;
    court.m = null; court.told[m.k + "u"] = 1;
    stands[m.k].x = courtAt(m.k)[0] + 1.5; stands[m.k].z = COURT.L + 0.5;   // (his stand-in comes on behind him)
    if (m.k === courts.length - 1) { courtAdd(); }   // (the next court appears beside it)
    say(STR.won(m.k, m.you, m.them), true);
    var best = wonCount(); save().then(function () { YT.score(best); }, YT.warn); courtWhere();   // (sent once saved: the best sent must be the save's)
  }
  // Between matches: walking, and onto a court its match (if it is open and not playing by itself).
  function courtStep(dt, c) {
    courtsSim(dt);
    var m = court.m;
    if (m && m.meterOn && (m.phase === "serve" || m.phase === "toss")) { /* (on the mark: he stands to serve) */ }
    else if (!(me.move && me.move.own)) { me.want = { vel: c.vel }; }
    if (!m) { me.faceTo = c.vel[0] || c.vel[1] ? Math.atan2(c.vel[0], -c.vel[1]) : null; }
    if (m) { matchStep(dt, c); }
    else {
      var k = round(me.x / COURT.GAP), cc0 = courtAt(clampV(k, 0, courts.length - 1)), lx = me.x - cc0[0], lz = me.z - cc0[2];
      var on = k >= 0 && k < courts.length && abs(lx) < COURT.HW && lz > 0.5 && lz < COURT.L, was = court.on;
      court.on = on ? k : -1;
      if (on) {
        var cv = courts[k], key = k + (cv.up ? "u" : "o");
        if (cv.up) { if (court.told[key] !== 1) { court.told[key] = 1; say(STR.standin(k, cv.you, cv.them)); } }
        else if (was !== k) { court.told = {}; matchOn(k); }
      }
    }
    // his bounds: his court while he plays it, else the row of them
    m = court.m;
    if (m) { var cm = courtAt(m.k); me.x = clampV(me.x, cm[0] - COURT.HW - 2.5, cm[0] + COURT.HW + 2.5); me.z = clampV(me.z, cm[2] + 0.25, cm[2] + COURT.L + 3.5); }
    else { me.x = clampV(me.x, -8, (courts.length - 1) * COURT.GAP + 8); me.z = clampV(me.z, -COURT.L - 6, COURT.L + 9); }
    // every athlete: the courts that play on (their stand-in and Mr Plan rallying, as the rocket world drew them, each
    // shot now a stroke), the idle Mr Plans at their baselines, and the two in the match
    courts.forEach(function (cv, k) {
      var cc = courtAt(k), pl = plans[k], st = stands[k];
      if (m && m.k === k) { return; }
      if (!cv.up) { pl.want = { to: [cc[0], cc[2] - COURT.L - 0.6] }; pl.faceTo = PI; return; }
      if (cv.rec) { replayStep(cv, k); return; }
      // (shot i is struck at t0 + 1.3 i, the even ones by the stand-in from his baseline, the odd by Mr Plan from his;
      // when one is struck, the other splits, runs to where the next is met and winds up to meet it then)
      var u = (gt - cv.t0) / 1.3, i = floor(u), ax = function (j) { return cc[0] + Math.sin(j * 1.7 + k) * 1.6; };
      if (i !== cv.i && i >= 0) {
        cv.i = i;
        if (abs(cc[0] - cur.eye[0]) < 60) { fxBurst([ax(i), 0.8, i % 2 ? cc[2] - COURT.L + 0.5 : cc[2] + COURT.L - 0.5], i % 2 ? "plan" : "me", false); }   // (a stand-in's stroke, or that court's Mr Plan's)
        var to = i % 2 ? st : pl, zt = i % 2 ? cc[2] + COURT.L - 0.5 : cc[2] - COURT.L + 0.5, xt = ax(i + 1);
        athSplit(to, gt);
        to.want = { to: [xt + (to === st ? -0.5 : 0.5), zt + (to === st ? 0.3 : -0.3)] };
        athSwing(to, { tc: cv.t0 + 1.3 * (i + 1), p: [xt, 0.8, zt], kind: "drive", aim: [0, 0, to === st ? -1 : 1] }, gt);
      }
    });
  }
  function stepAll(dt) {
    var c = controls(dt);
    courtStep(dt, c);
    athStep(me, dt, gt);
    for (var k = 0; k < courts.length; k += 1) { if (courts[k].up && courts[k].rec) { continue; } athStep(plans[k], dt, gt); if (courts[k].up) { athStep(stands[k], dt, gt); } }   // (a recording sets its two itself)
    if (court.m && court.m.rec) { recPut(court.m.rec, court.m); }
    // dust where a skid plants its foot, and where a dive lands
    [me].concat(plans).forEach(function (a) {
      if (a.skid > 0.5 && dust.length < 60 && rng() < 0.7) { dust.push({ x: a.x + (rng() - 0.5) * 0.3, y: 0.05, z: a.z + (rng() - 0.5) * 0.3, vx: -a.vx * 0.15 + (rng() - 0.5), vy: 0.6 + rng(), vz: -a.vz * 0.15 + (rng() - 0.5), t: gt }); }
    });
    dust = dust.filter(function (d) { d.vy -= 3 * dt; d.x += d.vx * dt; d.y = max(0.02, d.y + d.vy * dt); d.z += d.vz * dt; return gt - d.t < 0.7; });
    fxStep(dt);
    // (the tips' own moments: he has moved; he walks about off the courts; two pearls or more in play)
    if (TIPS.from && hypot(me.x - TIPS.from[0], me.z - TIPS.from[1]) > 1.5) { tipDone("move"); TIPS.from = null; }
    if (!court.m && !TIPS.from && gt > 6) { tip("court"); }
    if (court.m && live(court.m).length > 1) { tip("multi"); }
    tipStep(); tutStep();
    input.fire = false;   // (a tap is spent on the frame that reads it)
    // (the words step aside while the serve's bar runs: the bar carries its own, and they would cover it on a short screen)
    var cm = court.m, bar = cm && (cm.meterOn || (cm.phase === "plansuper" && cm.psup.struck && !cm.psup.tapped && !TUT.on));
    // (quiet in the walk-through: its own words say it where it happens)
    var sayOn = gt <= sayT && !bar && !TUT.on ? "1" : "0"; if ($("say").style.opacity !== sayOn) { $("say").style.opacity = sayOn; }
  }

  /* ---- the views and the hands ----------------------------------------------------------------------------------
     His own views (the artist, 28 Oct 2026: "maintain the perspectives of Mr Pearl to play"): the third person behind
     his head, as far as the rocket world stands it (his whole figure a third of the screen's height at rest), now on a
     spring so that his bursts read (it lags a little, never jerks). The Scope went (the artist, 28 Oct 2026: "Get rid
     of the scope view in the Pickleball game"). */
  var AIM = Math.atan(T35 / 2), REST = -Math.atan(T35 / 3), TP = {};
  var view = { yaw: 0, pitch: REST, e: null, ev: [0, 0, 0] };
  // His figure a quarter of the screen's height at rest, where the rocket world has a third (the artist, 28 Oct 2026:
  // "The third person view should be a little farther out for Pickleball given the speed in which Mr. Pearl can now
  // move"): the camera a third again as far, so a sprint stays in the picture. (Further back again with BACK, his
  // height held, he read a tenth smaller, the near of him less near: so a little more height, his footprint kept.)
  TP.FRAC = 0.265;
  function measure() {
    var top = body.top, M = top / 2, span = function (D) {
      var a = REST - AIM, cx = -D * Math.cos(a), cy = M - D * Math.sin(a);
      var ndc = function (hh) { var dy = hh - cy, f = -cx * Math.cos(REST) + dy * Math.sin(REST), u = cx * Math.sin(REST) + dy * Math.cos(REST); return u / f / T35; };
      return ndc(top) - ndc(0);
    };
    var lo = 0.5, hi = 20;
    for (var i = 0; i < 60; i += 1) { var D = (lo + hi) / 2; if (span(D) > 2 * TP.FRAC) { lo = D; } else { hi = D; } }
    TP.D = (lo + hi) / 2;
    TP.UP = AIM - Math.asin(top / 2 / TP.D); TP.DOWN = AIM - PI / 2 + 0.01;
    TP.HEAD = hypot(TP.D * Math.cos(REST - AIM), top / 2 - TP.D * Math.sin(REST - AIM) - body.head.centre[1]);
  }
  function lookDir(yaw, pitch) { return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; }
  function viewM(e, yaw, pitch) {
    var f = lookDir(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)], u = cross(r, f);
    return [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0, -dot(r, e), -dot(u, e), dot(f, e), 1];
  }
  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function clampPitch(p) { return clampV(p, TP.DOWN, TP.UP); }
  // Steadier (the artist, 28 Oct 2026: "The camera can get a bit jittery when you're moving so quickly back-and-forth,
  // can you stabilize the perspective 50% more when moving?"; pb_measure.js measures it, his eye through jukes, a
  // shuffle and a sprint). A window, as the cameras of side-scrolling games keep one: the view stands on a place of
  // its own on the ground, which does not move while he is in the middle of the picture (CAM.z0 of the half width at
  // his distance across the view, along it CAM.along[0] metres); toward the window's edge it moves with him, at a
  // share of his speed that grows smoothly to the whole of it there (CAM.z1), never running on past him (his own
  // following of a following had swung past him at each turn: that swing was the jitter); its own speed eased over
  // CAM.lag seconds, so quick steps back and forth average out and it never stops dead at a turn; a sprint outruns the
  // easing, and at CAM.hold of the window it holds him there; when he slows it drifts home.
  var CAM = { z0: 0.45, z1: 0.75, home: 0.9, along: [0.7, 1.5], lag: 0.3, hold: 1.15 };
  function camera(dt) {
    var cm = court.m, lead = cm && cm.meterOn && cm.phase === "serve" && gt < cm.meterT0;   // (on the mark: the view swings round to the net)
    if (!canLook() || lead) { var ke = min(1, dt * (lead ? 12 : 4)); view.yaw += angle(0 - view.yaw) * ke; view.pitch += (REST - view.pitch) * ke; }   // (in a rally: behind him, facing across)
    var hd = [me.x, body.head.centre[1] + min(me.y, 0.6) * 0.5, me.z], f = lookDir(view.yaw, view.pitch - AIM);
    if (!view.s) { view.s = hd.slice(); }
    var r = [Math.cos(view.yaw), 0, Math.sin(view.yaw)], fw = [Math.sin(view.yaw), 0, -Math.cos(view.yaw)];
    var hw = TP.D * T35 * canvas.clientWidth / max(1, canvas.clientHeight);   // (the half width at his distance)
    if (!view.sv) { view.sv = [0, 0]; }
    var axis = function (a, z0, z1, j) {
      var c = view.s[0] * a[0] + view.s[2] * a[2], h = hd[0] * a[0] + hd[2] * a[2], vh = me.vx * a[0] + me.vz * a[2], o = h - c, sg = o < 0 ? -1 : 1;
      var v = (vh * sg > 0 ? vh * smooth((abs(o) - z0) / (z1 - z0)) : 0) + o * CAM.home * (1 - smooth(abs(vh) / 2.5));
      // (its own speed eased over CAM.lag seconds: no stop dead at his turn)
      view.sv[j] = CAM.lag > 0 ? view.sv[j] + (v - view.sv[j]) * min(1, dt / CAM.lag) : v; c += view.sv[j] * dt;
      if (abs(h - c) > CAM.hold * z1) { c = h - sg * CAM.hold * z1; }   // (a sprint, a blink, a jump: the window goes with him)
      return c;
    };
    var cr = axis(r, CAM.z0 * hw, CAM.z1 * hw, 0), cf = axis(fw, CAM.along[0], CAM.along[1], 1);
    view.s = [cr * r[0] + cf * fw[0], hd[1], cr * r[2] + cf * fw[2]];
    var tp = [view.s[0] - f[0] * TP.HEAD, hd[1] - f[1] * TP.HEAD, view.s[2] - f[2] * TP.HEAD];
    if (!view.e) { view.e = tp.slice(); }
    // (on the ground the window is the steadying; the eye goes with it, and springs only up and down, his hops)
    view.e[0] = tp[0]; view.e[2] = tp[2]; view.ev[0] = view.ev[2] = 0;
    var o2 = { x: view.e[1], xv: view.ev[1] }; spring(o2, "x", tp[1], dt, 11); view.e[1] = o2.x; view.ev[1] = o2.xv;
    return view.e;
  }
  // The serve's bar, in characters: soft (a fault in the kitchen), softer to harder, the gold ace zone,
  // hard, long; the mark (◎) sweeping it; the pearls of this serve, served (◎) and still to serve (○).
  function meterDraw(c, m, W, H, glyph, cu) {
    // (in the dark over the net, below the HUD's lines however they wrap; cu: the counter to Mr Plan's super, its own
    // mark, its own words, no pearls to count)
    var N = 25, cw = min(13, (W - 48) / N), x0 = W / 2 - N * cw / 2, y0 = max(H * 0.37, hudLow + 56), u = cu != null ? cu : meterAt(m), ramp = "-=+*", i;
    // (taught there, by its cues: no sentence under it, and the gold growing as the mark nears it, never on and off)
    var ck = cueKey(), cue = cu == null ? ck === "serve" && TUT.on || ck === "bar" || ck === "pearls" : TUT.on, zk = cue ? max(0, 1 - abs(u - 0.78) / 0.1) : 0;
    for (i = 0; i < N; i += 1) {
      var v = (i + 0.5) / N, ch, col = "#f2efe8";
      if (v < SERVE.SOFT) { ch = "."; col = "#8a8f9a"; }
      else if (v >= SERVE.LONG) { ch = "△"; col = "#e07a5f"; }
      else if (v >= SERVE.ACE[0] && v < SERVE.ACE[1]) { ch = "◆"; col = zk > 0.5 ? CUE_COL.gold : "#f3c98b"; }
      else if (v >= SERVE.ACE[1]) { ch = "#"; }
      else { ch = ramp.charAt(min(3, floor((v - SERVE.SOFT) / (SERVE.ACE[0] - SERVE.SOFT) * 4))); }
      glyph(ch, x0 + (i + 0.5) * cw, y0, ch === "◆" ? 14 + 4 * zk : 14, col);
    }
    glyph("◎", x0 + u * N * cw, y0 - 16, 18, "#f3c98b");
    if (cu == null) { m.stops.forEach(function (v) { glyph("·", x0 + v * N * cw, y0 + 14, 14, "#f2efe8"); }); }   // (the serve's own, not the counter's)
    c.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    // (the zone's word: "ace" on the serve's bar, "return" on the counter to Mr Plan's super)
    glyph("soft", x0 + 2 * cw, y0 + 30, 10); glyph(cu != null ? "return" : "ace", x0 + (SERVE.ACE[0] + SERVE.ACE[1]) / 2 * N * cw, y0 + 30, 10, "#f3c98b"); glyph("long", x0 + (N - 1.5) * cw, y0 + 30, 10, "#e07a5f");
    if (cu == null) { for (i = 0; i < serveMax(); i += 1) { var nx = i === m.served + m.tosses.length && ck === "pearls"; glyph(i < m.served + m.tosses.length ? "◎" : "○", W / 2 + (i - (serveMax() - 1) / 2) * 22, y0 - 40, nx ? 20 : 16, i < m.served + m.tosses.length ? "#f3c98b" : nx ? CUE_COL.gold : "#f2efe8"); } }
    if (cue) { hudBox.meter = { x: x0, y: y0 - 50, w: N * cw, h: 90, x0: x0, cw: cw, y0: y0, N: N }; return; }
    var hint = cu != null ? (m.sup.avail ? STR.counterHintOr : STR.counterHint) : STR.meterHint, hs = min(10, (W - 24) / hint.length / 0.6); glyph(hint, W / 2, y0 + 48, hs, cu != null ? "#9ff3ff" : null);
    hudBox.meter = { x: min(x0, W / 2 - hint.length * hs * 0.31), y: y0 - 50, w: max(N * cw, hint.length * hs * 0.62), h: 106, x0: x0, cw: cw, y0: y0, N: N };
  }
  /* -- the super return: once a game (see below, "the super return") -- */
  function superButton() {
    var bt = $("super"), m = court.m, sp = m && m.sup, on = !!(m && m.phase === "super");
    if (!bt) { return; }
    var ask = TUT.on && TUT.stop === "sup";
    bt.disabled = !on && (!sp || !sp.avail || sp.armed || (TUT.on && !ask)); bt.setAttribute("aria-pressed", on || (sp && sp.armed) ? "true" : "false");
    bt.classList.toggle("nudge", ask && !!sp && !sp.armed);
  }
  // A press uses it at once (between points, on the next one); once a game: a new one when a game begins.
  function superPress() {
    var m = court.m;
    if (!m || m.phase === "super" || m.sup.armed) { return; }
    if (TUT.on && TUT.stop !== "sup") { return; }   // (the walk-through's comes at its step)
    if (!m.sup.avail) { say(STR.superUsed); return; }
    m.sup.armed = true; tipDone("super");
    if (m.phase === "point") { say(STR.superNext); }
    if (m.phase === "plansuper") { say(STR.superCounter, true); }   // (it meets his: see psupStep)
    superButton();
  }
  /* -- the super return (the artist, 28 Oct 2026: "Mr Pearl also gets one super return each game that is a spectacular
     and impressive animation that automatically wins Mr Pearl one point"; then "I want a button in the top right corner
     that allows you to use your superpower and automatically win the point"). Once a game, at any moment of a point.
     The pearl coming to him (none coming, the one he sent last, called back; at his serve, one from his hand) leaves its
     flight and rises to meet him, and time stands for everything else: Mr Plan holds, the other pearls hang where they
     are. He gathers, the night dimming round him, gold turning off his guitar; he leaps four metres, the guitar
     windmilling a turn and a half, a ring of gold where it goes (his rocket-world guitar smash, the windmill
     Pete Townshend made a guitarist's); at the top it meets the pearl: a sunburst, the pearl driven down into Mr Plan's
     far corner, faster than any stroke, a comet of gold; Mr Plan dives for it and does not get there; he lands in a ring
     of dust. The camera rises with him, at his right shoulder, and follows the pearl down. */
  var SUP = { T: 2.45, GATHER: 0.42, UP: 4.0, FLY: 0.4 };
  function superStart(m, only, why) {
    var cc = courtAt(m.k), pl = plans[m.k], lv = live(m), b = null, t0 = gt;
    b = only || lv.filter(function (q) { return q.last === "them"; }).sort(function (x, y) { return abs(x.z - me.z) - abs(y.z - me.z); })[0] || lv.filter(function (q) { return q.last === "you"; }).sort(function (x, y) { return (y.id || 0) - (x.id || 0); })[0] || null;
    if (!b) {
      // (at his serve, or between pearls: one from his hand)
      var s0 = serveFrom();
      b = { id: m.nextId++, x: s0[0], y: s0[1], z: s0[2], vx: 0, vy: 0, vz: 0, net: false, spin: 0, last: "you", bounces: 0, serve: false, rally: 1, nemAt: gt, mark: null, dead: false };
      m.balls.push(b); m.served = max(m.served, 1);
    }
    m.tosses = []; m.meterOn = false; m.pc = m.nc = null;
    var tUp = Math.sqrt(2 * SUP.UP / CAPS.g), apex = t0 + SUP.GATHER + tUp;
    // where the guitar meets it at the top: up, a little forward and to his right of his shoulder, as far as his arm and
    // the guitar reach; facing the net
    var d = norm([0.15, 0.8, -0.45]);
    var C = [me.x + RIG.sR[0] + d[0] * RIG.reach, SUP.UP + RIG.sR[1] + d[1] * RIG.reach - 0.04, me.z + RIG.sR[2] + d[2] * RIG.reach];
    var tx = (pl.x - cc[0] > 0 ? -1 : 1) * (COURT.HW - 0.45), tz = -(COURT.L - 0.5);
    me.move = { kind: "overhead", reach: "super", t0: t0, sw: apex - 0.32, tc: apex, p: C, aim: norm([tx + cc[0] - C[0], -0.6, tz + cc[2] - C[2]]), fore: true,
                own: [t0, t0 + SUP.T], end: t0 + SUP.T, up: t0 + SUP.GATHER, vy: CAPS.g * tUp, lockYaw: true, yawTo: 0,
                drop: function (g) { return g < t0 + SUP.GATHER ? 0.12 + 0.3 * smooth((g - t0) / SUP.GATHER) : me.air ? 0.04 : 0.36 - 0.24 * smooth((g - t0 - SUP.GATHER - 2 * tUp) / 0.3); } };
    me.vx = me.vz = 0; me.celeb = null; me.spin = null;
    pl.want = { vel: [0, 0] }; pl.faceTo = Math.atan2(me.x - pl.x, -(me.z - pl.z)); pl.move = null;
    b.super = true; b.mark = null; b.bounces = 0; b.net = false;
    m.sup = { avail: false, armed: false, t0: t0, apex: apex, ball: b, p0: [b.x, b.y, b.z], v0: [b.vx * 0.4, b.vy * 0.4 + 2, b.vz * 0.4], C: C, shot: [tx, tz], struck: false, won: false, prev: m.phase, why: why || STR.superWon };
    m.phase = "super"; ascMod = { expo: 1, glow: ASC.glow };
    superButton(); courtWhere();
    return true;
  }
  function superStep(m, dt) {
    var sp = m.sup, u = gt - sp.t0, b = sp.ball, cc = courtAt(m.k), pl = plans[m.k], gold = ["#fff4c2", "#ffd166", "#f3c98b", "#ffb347"];
    // the pass: the night dims round him through the gathering and the leap, and glows the more at the strike
    var dim = smooth(u / 0.3) * (1 - smooth((u - SUP.T + 0.5) / 0.5)), hit = sp.struck ? max(0, 1 - (gt - sp.hitT) / 0.5) : 0;
    ascMod = { expo: 1 - 0.18 * dim + 0.25 * hit, glow: ASC.glow + 0.25 * dim + 0.45 * hit };
    var pc = me.pose && me.pose.paddleC;
    if (u < SUP.GATHER && pc && fxR() < 0.9) {   // gold turning off the guitar as he gathers
      var a = fxR() * 2 * PI, e = fxR() * 2 - 1, r = Math.sqrt(1 - e * e);
      fxAdd(pc.slice(), [r * Math.cos(a) * 3, e * 3, r * Math.sin(a) * 3], 0.45, pick(["·", "+", "*"]), pick(gold), 0.13, 0, false);
      if (fxR() < 0.5) { fxAdd([me.x + (fxR() - 0.5) * 1.2, 0.05, me.z + (fxR() - 0.5) * 1.2], [0, 2 + fxR() * 2, 0], 0.6, "∴", pick(gold), 0.13, 0, false); }
    }
    if (!sp.struck && u >= SUP.GATHER && pc) { fxAdd(pc.slice(), [0, 0, 0], 0.5, pick(["*", "+", "◆"]), pick(gold), 0.16, 0, false); }   // the windmill's ring of gold
    if (!sp.struck) {
      // the pearl rises to meet the guitar at the top (a Hermite curve from where it was, half its speed, to the bout)
      var k = clampV(u / (sp.apex - sp.t0), 0, 1), k2 = k * k, k3 = k2 * k, h00 = 2 * k3 - 3 * k2 + 1, h10 = k3 - 2 * k2 + k, h01 = -2 * k3 + 3 * k2, T = sp.apex - sp.t0;
      var C = sp.C; if (pc && k > 0.85) { C = lerp3(C, pc, smooth((k - 0.85) / 0.15)); }
      b.x = h00 * sp.p0[0] + h10 * T * sp.v0[0] + h01 * C[0]; b.y = h00 * sp.p0[1] + h10 * T * sp.v0[1] + h01 * C[1]; b.z = h00 * sp.p0[2] + h10 * T * sp.v0[2] + h01 * C[2];
      b.spin = (b.spin || 0) + 12 * dt;
      if (fxR() < 0.6) { fxAdd([b.x, b.y, b.z], [0, 0, 0], 0.3, "◇", pick(["#f2efe8", "#fff4c2"]), 0.12, 0, false); }
      if (gt >= sp.apex) {
        // the strike: a sunburst, the pearl driven down into the far corner
        sp.struck = true; sp.hitT = gt;
        b.last = "you"; b.serve = false; b.rally += 1; b.bounces = 0; b.net = false;
        shoot(b, m.k, sp.shot[0], sp.shot[1], SUP.FLY);
        fxBurst([b.x, b.y, b.z], "me", true);
        for (var i = 0; i < 36; i += 1) { var ra = i / 36 * 2 * PI, rv = 7 + 2 * fxR(); fxAdd([b.x, b.y, b.z], [Math.cos(ra) * rv, Math.sin(ra) * rv, (fxR() - 0.5) * 2], 0.55, pick(["*", "+", "-", "◆"]), pick(gold), 0.2, 0, false); }
        var L0 = ballLands(b, m.k);
        if (L0) {   // (Mr Plan goes full length for it, and it is past him)
          var dx = L0.x - pl.x, dz = L0.z - pl.z, dl = hypot(dx, dz) || 1;
          athSwing(pl, { tc: gt + SUP.FLY + 0.02, p: [L0.x - dx / dl * 0.7, 0.3, L0.z - dz / dl * 0.7], kind: "drive", reach: "dive", aim: [0, 0, 1] }, gt);
        }
      }
    } else if (!b.dead) {
      var at = ballStep(b, m.k, dt);
      if (fxR() < 0.95) { fxAdd([b.x, b.y, b.z], [-b.vx * 0.05, -b.vy * 0.05, -b.vz * 0.05], 0.4, pick(["*", "+", "·"]), pick(gold), 0.16, 0, false); }   // the comet
      if (at) {
        fxBurst([at[0], 0.1, at[1]], "me", true); fxRing([at[0], 0.03, at[1]], "me");
        sp.won = true; pointBall(m, b, true, sp.why);
      }
    }
    if (u >= SUP.T) {
      if (!b.dead) { pointBall(m, b, true, sp.why); }
      ascMod = null;
      m.phase = live(m).length ? "rally" : "point"; m.t = gt;
      if (m.phase === "rally") { m.meterOn = false; }
      if (TUT.free) { TUT.free = false; m.sup = { avail: true, armed: false }; say(STR.walk.go, true); }   // (the walk-through's was free: his again for the game)
      superButton(); courtWhere();
    }
  }
  /* -- Mr Plan's super return (the artist, 28 Oct 2026: "Mr. Plan should also have a super return, however, for him you
     have a chance to return his super return and it is the same moving bar that we have to choose where to serve, but
     you have to land in that ace zone to return Mr. Plan's super return"). Once a game, at a stroke he is to make (more
     likely each court, three times as likely when Mr Pearl is a point from the game): his negative of Mr Pearl's, the
     gathering, the four-metre windmill leap, the strike at the top in cyan, the pearl driven at Mr Pearl's far corner.
     Then it comes in slow motion, and the serve's bar runs: a tap stops it; in the gold ace zone, Mr Pearl, the
     hologram, is at the pearl at once and sends it back (the rally plays on); anywhere else, or no tap before it lands,
     it is past him and the point is Mr Plan's. */
  var PSUP = { SLOW: 0.28, FLY: 0.55, P0: 0.04, P1: 0.16 };
  function psupWill(m, c) {
    if (TUT.on) { return !!(m.psup && m.psup.avail && m.phase === "rally" && !m.tosses.length && !c.blink && c.ball.serve); }   // (the walk-through: his first return)
    if (!m.psup || !m.psup.avail || m.phase !== "rally" || m.tosses.length || c.ball.ace || c.blink || c.ball.rally < 3) { return false; }   // (never his return of serve: its counter would be a volley of the third shot, against the two-bounce rule)
    var p = (PSUP.P0 + (PSUP.P1 - PSUP.P0) * hardness(m.level)) * HARD.UP * (m.you === COURT.WIN - 1 ? 3 : 1);
    return rng() < min(0.6, p);
  }
  function psupStart(m, b) {
    var cc = courtAt(m.k), pl = plans[m.k], t0 = gt, tUp = Math.sqrt(2 * SUP.UP / CAPS.g), apex = t0 + SUP.GATHER + tUp;
    // (where his guitar meets it at the top: his frame turned to face Mr Pearl, so his right is -x and ahead is +z)
    var d = norm([-0.15, 0.8, 0.45]), C = [pl.x - RIG.sR[0] + d[0] * RIG.reach, SUP.UP + RIG.sR[1] + d[1] * RIG.reach - 0.04, pl.z - RIG.sR[2] + d[2] * RIG.reach];
    var tx = (me.x - cc[0] > 0 ? -1 : 1) * (COURT.HW - 0.45), tz = COURT.L - 0.5;
    pl.move = { kind: "overhead", reach: "super", t0: t0, sw: apex - 0.32, tc: apex, p: C, aim: norm([tx + cc[0] - C[0], -0.6, tz + cc[2] - C[2]]), fore: true,
                own: [t0, t0 + SUP.T], end: t0 + SUP.T, up: t0 + SUP.GATHER, vy: CAPS.g * tUp, lockYaw: true, yawTo: PI,
                drop: function (g) { return g < t0 + SUP.GATHER ? 0.12 + 0.3 * smooth((g - t0) / SUP.GATHER) : pl.air ? 0.04 : 0.36 - 0.24 * smooth((g - t0 - SUP.GATHER - 2 * tUp) / 0.3); } };
    pl.vx = pl.vz = 0; pl.celeb = null; pl.spin = null;
    m.pc = m.nc = null; b.mark = null; b.net = false; m.meterOn = false; m.tosses = [];   // (the serve is over: as the super return ends it)
    m.psup = { avail: false, t0: t0, apex: apex, ball: b, p0: [b.x, b.y, b.z], v0: [b.vx * 0.4, b.vy * 0.4 + 2, b.vz * 0.4], C: C, shot: [tx, tz], struck: false, tapped: false, ok: false };
    m.phase = "plansuper"; ascMod = { expo: 1, glow: ASC.glow };
    say(m.sup.avail ? STR.planSuperOr : STR.planSuper, true); superButton(); courtWhere();
  }
  function psupStep(m, dt, fire) {
    var sp = m.psup, u = gt - sp.t0, b = sp.ball, cc = courtAt(m.k), pl = plans[m.k], ice = ["#e8fdff", "#9ff3ff", "#5ce1e6", "#b39cff"];
    var dim = smooth(u / 0.3), hit = sp.struck ? max(0, 1 - (gt - sp.hitT) / 0.5) : 0;
    ascMod = { expo: 1 - 0.15 * dim + 0.2 * hit, glow: ASC.glow + 0.2 * dim + 0.4 * hit };
    var pc = pl.pose && pl.pose.paddleC;
    if (!sp.struck) {
      if (u < SUP.GATHER && pc && fxR() < 0.9) { var a = fxR() * 2 * PI, e = fxR() * 2 - 1, r = Math.sqrt(1 - e * e); fxAdd(pc.slice(), [r * Math.cos(a) * 3, e * 3, r * Math.sin(a) * 3], 0.45, pick(["·", "◇", "*"]), pick(ice), 0.13, 0, false); }
      if (u >= SUP.GATHER && pc) { fxAdd(pc.slice(), [0, 0, 0], 0.5, pick(["◇", "◆", "+"]), pick(ice), 0.16, 0, false); }   // (his windmill's ring, cyan)
      var k = clampV(u / (sp.apex - sp.t0), 0, 1), k2 = k * k, k3 = k2 * k, h00 = 2 * k3 - 3 * k2 + 1, h10 = k3 - 2 * k2 + k, h01 = -2 * k3 + 3 * k2, T = sp.apex - sp.t0;
      var C = sp.C; if (pc && k > 0.85) { C = lerp3(C, pc, smooth((k - 0.85) / 0.15)); }
      b.x = h00 * sp.p0[0] + h10 * T * sp.v0[0] + h01 * C[0]; b.y = h00 * sp.p0[1] + h10 * T * sp.v0[1] + h01 * C[1]; b.z = h00 * sp.p0[2] + h10 * T * sp.v0[2] + h01 * C[2];
      b.spin = (b.spin || 0) + 12 * dt;
      if (gt >= sp.apex) {
        sp.struck = true; sp.hitT = gt; sp.barT = gt;
        b.last = "them"; b.serve = false; b.rally += 1; b.bounces = 0; b.net = false;
        shoot(b, m.k, sp.shot[0], sp.shot[1], PSUP.FLY);
        fxBurst([b.x, b.y, b.z], "plan", true);
        for (var i = 0; i < 36; i += 1) { var ra = i / 36 * 2 * PI, rv = 7 + 2 * fxR(); fxAdd([b.x, b.y, b.z], [Math.cos(ra) * rv, Math.sin(ra) * rv, (fxR() - 0.5) * 2], 0.55, pick(["*", "+", "-", "◇"]), pick(ice), 0.2, 0, false); }
        athSplit(me, gt);
      }
      return;
    }
    // (or his own super, pressed (the artist, 28 Oct 2026: "You can also choose to use your super to automatically
    // counteract Mr. plans super and win the point"): it takes the pearl struck at him, and the point is his)
    if (m.sup.armed && !b.dead) { ascMod = null; superStart(m, b, STR.superCounterWon); return; }
    // the counter: the bar runs while the pearl comes, slowly; one tap, read at this step, as the serve's is
    var per = servePeriod(m), uu = ((gt - sp.barT) / per) % 2; if (!TUT.on) { sp.uNow = uu < 1 ? uu : 2 - uu; }   // (the walk-through's runs while the game stands: tutHeld)
    if (!sp.tapped && fire && !TUT.on) {
      sp.tapped = true; sp.u = sp.uNow; sp.ok = sp.u >= SERVE.ACE[0] && sp.u < SERVE.ACE[1];
      say(sp.ok ? STR.counterOk : STR.counterMiss);
    }
    var at = ballStep(b, m.k, dt * (sp.tapped && !sp.ok ? 1 : PSUP.SLOW));
    if (fxR() < 0.9) { fxAdd([b.x, b.y, b.z], [0, 0, 0], 0.4, pick(["*", "◇", "·"]), pick(ice), 0.15, 0, false); }   // (its comet, cyan)
    if (sp.ok && b.z - cc[2] > COURT.K + 0.3 && b.y < CAPS.top + 0.5) {
      // returned: the hologram at the pearl at once, and back it goes, deep, away from Mr Plan
      blinkTo(me, { p: [b.x, b.y, b.z] }, "me");
      var plx = pl.x - cc[0], bx = -(plx >= 0 ? 1 : -1) * (0.6 + 1.2 * rng()), bz = -(COURT.L - 0.8 - 1.2 * rng());
      athSwing(me, { tc: gt + 0.05, p: [b.x, b.y, b.z], kind: b.y > 1.6 ? "overhead" : "drive", aim: norm([bx + cc[0] - b.x, 0.3, bz + cc[2] - b.z]) }, gt);
      shoot(b, m.k, bx, bz, 1.0);
      fxBurst([b.x, b.y, b.z], "me", true); fxRing([b.x, 0.03, b.z], "me");
      b.last = "you"; b.bounces = 0; b.rally += 1; b.nemAt = gt + m.sk.wait; b.super = false;
      psupEnd(m); return;
    }
    if (at) { if (!b.dead) { pointBall(m, b, false, STR.planSuperWon); } psupEnd(m); }
  }
  function psupEnd(m) {
    ascMod = null;
    m.phase = live(m).length ? "rally" : "point"; m.t = gt;
    superButton(); courtWhere();
  }
  // the camera through it: at his right shoulder, rising with him, looking up at the meeting and then down along the
  // pearl's way into the far corner; eased in and out of his own
  function superCam(e0, yaw0, pitch0) {
    var m = court.m, sp = m && m.sup; if (!m || m.phase !== "super" || !sp) { return null; }
    var u = gt - sp.t0, w = smooth(u / 0.35) * (1 - smooth((u - SUP.T + 0.5) / 0.5)), b = sp.ball;
    var tgt = [me.x + 0.1, 1.3 + me.y * 0.85, me.z - 3.0];
    if (sp.struck) { tgt = lerp3(tgt, [b.x, max(0.6, b.y), b.z], 0.4 * smooth((gt - sp.hitT) / 0.3)); }
    var e1 = [me.x + 2.0, 2.1 + 0.72 * me.y, me.z + 9.5], dx = tgt[0] - e1[0], dy = tgt[1] - e1[1], dz = tgt[2] - e1[2];
    var yaw1 = Math.atan2(dx, -dz), pitch1 = Math.atan2(dy, hypot(dx, dz));
    return { e: lerp3(e0, e1, w), yaw: yaw0 + angle(yaw1 - yaw0) * w, pitch: pitch0 + (pitch1 - pitch0) * w };
  }
  // The hands: touch and mouse alike, the left half a stick (where the finger or the press lands is its middle), the
  // right half a drag that turns the view (the way his return goes), a tap or a click anywhere stops the serve's bar;
  // Super; on a desk the keys too.
  var input = { keys: {}, stick: null, look: null, fire: false, taps: 0, down: {} };
  function inputClear() { input.keys = {}; input.stick = null; input.fire = false; input.down = {}; }
  function awake(f) { return function (e) { if (!YT.paused) { f(e); } }; }   // (paused, the game takes no input)
  function controls() {
    var k = input.keys, fwd = 0, side = 0, full = CAPS.vmax;
    if (input.stick) { var s = input.stick, L = min(1, hypot(s.dx, s.dy) / 60), a = Math.atan2(s.dx, -s.dy); fwd = Math.cos(a) * L; side = Math.sin(a) * L; full = CAPS.vmax * Math.pow(L, 0.6) / (L || 1); }
    else {
      fwd = (k.w || k.ArrowUp ? 1 : 0) - (k.s || k.ArrowDown ? 1 : 0); var held = !canLook(); side = (k.d || (held && k.ArrowRight) ? 1 : 0) - (k.a || (held && k.ArrowLeft) ? 1 : 0);   // (the view held, the side arrows step sideways)
      var n = hypot(fwd, side); if (n > 1) { fwd /= n; side /= n; }
      full = k.Shift ? CAPS.vmax : 0.62 * CAPS.vmax;
    }
    if (canLook()) { if (k.ArrowLeft) { view.yaw -= 2.2 / 60; } if (k.ArrowRight) { view.yaw += 2.2 / 60; } }
    var y = view.yaw, v = [(Math.sin(y) * fwd + Math.cos(y) * side) * full, (-Math.cos(y) * fwd + Math.sin(y) * side) * full];
    // (to the gold circle: at the serve, before he is on it, a way within 47 degrees of it goes straight to it (30 either
    // side of forward, the view being turned 17 off it to show the ring), so forward from beside it is into it)
    var cm = court.m;
    if (cm && cm.phase === "serve" && !cm.meterOn && (v[0] || v[1])) {
      var sp = serveSpot(), wx = sp[0] - me.x, wz = sp[1] - me.z, wl = hypot(wx, wz), vl = hypot(v[0], v[1]);
      if (wl > 0.05 && (v[0] * wx + v[1] * wz) / (vl * wl) > Math.cos(0.82)) { v = [wx / wl * vl, wz / wl * vl]; }
    }
    return { vel: v, fire: input.fire };
  }
  function bindInput() {
    var half = function (x) { return x < canvas.clientWidth / 2; };
    canvas.addEventListener("pointerdown", function () { if (!document.hasFocus()) { try { window.focus(); } catch (x) { /* fine */ } } });   // (embedded, as on YouTube: the keys come here after a click)
    canvas.addEventListener("pointerdown", awake(function (e) {
      e.preventDefault();
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      var down = input.down;   // (a mouse's drag on the left half is the stick too: the requirements ask the mouse for everything)
      CUE.hand = e.pointerType === "mouse" ? "mouse" : "touch";
      down[e.pointerId] = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, stick: half(e.clientX) && !input.stick };
      if (TUT.on && TUT.stop) { input.fire = true; down[e.pointerId].fired = true; if (TUT.stop === "sup") { CUE.miss = { x: e.clientX, y: e.clientY, t: CUE.rt }; } }   // (the walk-through standing still: a tap anywhere is its, read as it lands; not the Super's: an arrow to it)
      if (down[e.pointerId].stick) { input.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; }
      // (a bar up: the tap is where the finger lands, not where it lifts; not the stick's touch in a rally, which moves him)
      var m = court.m, bar = m && (m.meterOn || (m.phase === "plansuper" && m.psup.struck && !m.psup.tapped && !TUT.on));
      if (bar && !(down[e.pointerId].stick && m.phase === "rally")) { input.fire = true; input.taps += 1; down[e.pointerId].fired = true; }
    }));
    canvas.addEventListener("pointermove", awake(function (e) {
      var d = input.down[e.pointerId]; if (!d) { return; }
      var mx = e.clientX - d.x, my = e.clientY - d.y; d.moved = max(d.moved, hypot(mx, my));
      if (d.stick && input.stick && input.stick.id === e.pointerId) { input.stick.dx = mx; input.stick.dy = my; return; }
      var k = e.pointerType === "mouse" ? 0.0045 : 0.006;
      if (canLook()) { view.yaw += (e.clientX - (d.lx == null ? d.x : d.lx)) * k; view.pitch = clampPitch(view.pitch - (e.clientY - (d.ly == null ? d.y : d.ly)) * k); }
      d.lx = e.clientX; d.ly = e.clientY;
    }));
    var up = function (e) {
      var d = input.down[e.pointerId]; if (!d) { return; }
      delete input.down[e.pointerId];
      if (input.stick && input.stick.id === e.pointerId) { input.stick = null; }
      if (!YT.paused && !d.fired && d.moved < 10 && performance.now() - d.t < 350) { input.fire = true; input.taps += 1; }
    };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", function (e) { delete input.down[e.pointerId]; if (input.stick && input.stick.id === e.pointerId) { input.stick = null; } });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    window.addEventListener("keydown", awake(function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if ((k === " " || k === "Enter") && e.target && e.target.closest && e.target.closest("#courts, #super")) { return; }   // (a button focused: the key presses it)
      if ("wasdteq ".indexOf(k) >= 0 || k === "Enter" || k === "Shift" || k.indexOf("Arrow") === 0) { CUE.hand = "keys"; if (TUT.on && TUT.stop === "sup" && k !== "e" && k !== "q") { CUE.wrongT = CUE.rt; } }
      if (k === " " || k === "t" || k === "Enter") { if (!e.repeat) { input.fire = true; } e.preventDefault(); }   // (a key held is one tap)
      else if (k === "e" || k === "q") { superPress(); }
      input.keys[k] = true; if (e.shiftKey) { input.keys.Shift = true; }
      if (k.indexOf("Arrow") === 0) { e.preventDefault(); }
    }));
    window.addEventListener("keyup", function (e) { var k = e.key.length === 1 ? e.key.toLowerCase() : e.key; input.keys[k] = false; if (!e.shiftKey) { input.keys.Shift = false; } });
    window.addEventListener("blur", function () { input.keys = {}; input.stick = null; });
    tapOn($("super"), function (e) { if (e && e.type === "pointerup") { $("super").blur(); } superPress(); });   // (blurred after a finger or a click: Space after it is the bar's)
  }

  /* ---- drawing a frame ---------------------------------------------------------------------------------------------- */
  // The courts' colours set for the night's values (the pass reads them as lightness): the grounds and the seams between
  // the courts nearly black, the run-off a dark green, the court a deep blue, the kitchen a lighter teal (so it reads
  // apart from the court), the lines a warm white; the lamps lit, the pearl lit from within.
  // (and then, the artist, 28 Oct 2026: "Use color to find middle grounds between high contrast points or things being too
  // black or too white. It needs a lot more interesting colors": the court ultramarine, the kitchen turquoise in an
  // emerald run-off, the lines ivory, the net plum, the posts and poles lilac steel, the lamps amber, the ground a deep
  // teal; each about as light as it was, so the characters' spacing keeps its meaning, the hue new)
  var CT = { ground: [0.02, 0.07, 0.06], out: [0.06, 0.3, 0.18], inn: [0.14, 0.17, 0.62], kitchen: [0.06, 0.42, 0.4], line: [1, 0.92, 0.76],
             net: [0.42, 0.22, 0.46], post: [0.6, 0.58, 0.8], lamp: [1, 0.76, 0.4], pole: [0.34, 0.32, 0.46], dust: [0.75, 0.66, 0.5], pearl: [1, 0.97, 0.92] };
  // The courts and their floodlights, and nothing else (the artist: "get rid of the Trojan horse being built [and] any
  // architecture that is outside of the [plain] courts"); those more than SEEN off are past seeing and not drawn.
  var SEEN = 160, POLE_NEAR = 2.5;
  // The courts, the uppermost first (so the layers under them are hidden before they are lit), each layer 8 mm over the
  // one below it (apart in the depth even far off); the lines drawn on the surfaces by the solid shader (uCrt), a pixel
  // and a half at least, and the posts, the poles and the net's tape held a pixel and a half wide (uWide).
  function drawCourts() {
    var L = COURT.L, HW = COURT.HW, K = COURT.K, nw = 2 * (HW + COURT.PO), th = 0.008, x, ex = cur.eye[0];
    gl.uniform3fv(SU.uLnC, CT.line);
    for (var k = 0; k < courts.length; k += 1) {
      x = courtAt(k)[0];
      if (abs(x - ex) > SEEN) { continue; }
      gl.uniform4f(SU.uCrt, x, HW, L, K);
      paint(MAT.KITCHEN, null, true); cbox([x, 0.018, 0], [2 * HW, th, 2 * K], CT.kitchen);
      paint(MAT.COURT, null, true); cbox([x, 0.01, 0], [2 * HW, th, 2 * L], CT.inn);
      paint(MAT.RUNOFF, null, true); cbox([x, 0.002, 0], [COURT.GAP - 1, th, 2 * L + 7], CT.out);
      gl.uniform4f(SU.uCrt, 0, 0, 0, 0);
      paint(MAT.POLE, [1, 0, 1]);
      [-1, 1].forEach(function (s) { cbox([x + s * (HW + COURT.PO), COURT.POST / 2, 0], [0.08, COURT.POST, 0.08], CT.post); });
      paint(MAT.NET); cbox([x, COURT.NET / 2 + 0.03, 0], [nw, COURT.NET - 0.06, 0.03], CT.net);
      paint(MAT.LINE, [0, 1, 0]); cbox([x, COURT.NET, 0], [nw, 0.07, 0.05], CT.line);   // (its tape)
    }
    paint(MAT.GROUND, null, true);
    cbox([ex, -0.05, 0], [2 * SEEN + 60, 0.1, 2 * SEEN], CT.ground);
    // the floodlights: a pole at each court's corners, its lamp lit; not one the view stands against, nor one between
    // the view and him (as he walks into the gold circle from beside it, the view's arm lies along the corner's pole: a
    // wall of bars down the picture, through him; within POLE_NEAR of the eye, or within a metre of the line to him)
    var vx = me.x - ex, vz = me.z - cur.eye[2], vv = vx * vx + vz * vz;
    for (var j = 0; j <= courts.length; j += 1) {
      if (abs((j - 0.5) * COURT.GAP - ex) > SEEN) { continue; }
      [-1, 1].forEach(function (s) {
        var px = (j - 0.5) * COURT.GAP, pz = s * (L + 4), qx = px - ex, qz = pz - cur.eye[2], u = vv > 0 ? (qx * vx + qz * vz) / vv : -1;
        var far = hypot(qx, qz), side = u > 0 && u < 1 ? abs(qx * vz - qz * vx) / Math.sqrt(vv) : 9;
        // (narrowing over the last metre to the view and the last half metre to the line, not gone in one frame)
        var w = min(clampV(far - (POLE_NEAR - 1), 0, 1), clampV((side - 0.5) / 0.5, 0, 1));
        if (w > 0) { paint(MAT.POLE, [1, 0, 1]); cbox([px, 4.5, pz], [0.18 * w, 9, 0.18 * w], CT.pole); }
        if (far < POLE_NEAR || side < 1.0) { return; }
        paint(MAT.LAMP); cbox([px, 9.1, pz - s * 0.2], [1.2, 0.35, 0.5], CT.lamp, 2.4);
      });
    }
  }
  function draw() {
    var dpr = min(3, window.devicePixelRatio || 1), cw = round(canvas.clientWidth * dpr), chh = round(canvas.clientHeight * dpr);
    if (cw < 2 || chh < 2) { return; }   // (a frame with no size, as the Android app first shows it: nothing to draw)
    if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
    me.pose = athPose(me, gt);
    var e = camera(frameDt), yaw = view.yaw, pitch = view.pitch;
    cine = superCam(e, yaw, pitch);
    if (cine) { e = cine.e; yaw = cine.yaw; pitch = cine.pitch; }
    if (camOver) { e = camOver.e; yaw = camOver.yaw; pitch = camOver.pitch; }
    var vm = viewM(e, yaw, pitch);
    cur.eye = e; cur.yaw = yaw; cur.pitch = pitch; cur.vp = mul(perspective(FOV * PI / 180, cw / chh, NEAR, FAR), vm); pixA = 2 * T35 / chh;
    var into = !camPlain && ascBegin(cw, chh, dpr);
    if (!into) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); if (asc) { asc.balls = null; } }
    gl.viewport(0, 0, cw, chh);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // the sky, behind everything
    var f = lookDir(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)], u = cross(r, f);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(skyP); gl.uniform3fv(KU.uF, f); gl.uniform3fv(KU.uR, r); gl.uniform3fv(KU.uU, u); gl.uniform2f(KU.uK, T35 * cw / chh, T35);
    gl.uniform3fv(KU.uZen, SKY.zen); gl.uniform3fv(KU.uHor, SKY.hor); gl.uniform3fv(KU.uGnd, SKY.gnd);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    var m = court.m, near = function (x) { return abs(x - e[0]) <= SEEN; };
    // the pearls in the air, first, for the shadows they cast: the courts that play on (the pearl back and forth
    // between them, a shot each 1.3 s), and the match's
    var pearls = [];
    // (the match's first: the pearl characters are kept for eight, and the match's must have theirs)
    if (m) {
      m.balls.forEach(function (b) { if (!b.dead || gt - b.deadT < 1.4) { pearls.push([[b.x, b.y, b.z], b.spin]); } });
      // (a pearl tossed: dropped from his hand to below his waist, where the racket meets it)
      m.tosses.forEach(function (q) { if (gt >= q.t0) { var tu = clampV((gt - q.t0) / 0.3, 0, 1), s0 = serveFrom(); pearls.push([[s0[0], 1.0 - (1.0 - s0[1]) * tu * tu, s0[2]], 0]); } });
    }
    courts.forEach(function (cv, k) {
      if (!cv.up || (m && m.k === k) || !near(courtAt(k)[0])) { return; }
      if (cv.rec) { (cv.rp || []).forEach(function (q) { pearls.push(q); }); return; }
      var cc = courtAt(k), uu = (gt - cv.t0) / 1.3, ii = floor(uu), ff = uu - ii, ax = function (j) { return cc[0] + Math.sin(j * 1.7 + k) * 1.6; };
      var zs = cc[2] + COURT.L - 0.5, zn = cc[2] - COURT.L + 0.5, za = ii % 2 ? zn : zs, zb = ii % 2 ? zs : zn;
      pearls.push([[ax(ii) + (ax(ii + 1) - ax(ii)) * ff, 0.8 + 1.4 * Math.sin(PI * ff), za + (zb - za) * ff], uu * 9]);
    });
    // the contact shadows: each athlete's (wider and fainter off the ground) and each pearl's (its height, told)
    var shadows = [], cast = function (x, z, y, rr, st) { if (hypot(x - e[0], z - e[2]) < 60) { shadows.push([x, z, rr, st]); } };
    var who = [me].concat(plans.filter(function (p) { return near(p.x); }), stands.filter(function (st, k) { return courts[k].up && !(m && m.k === k) && near(st.x); }));
    who.forEach(function (a) { cast(a.x, a.z, a.y, 0.6 + 0.4 * a.y, 0.75 / (1 + 1.5 * a.y)); });
    pearls.forEach(function (q) { var p = q[0]; cast(p[0], p[2], p[1], 0.1 + 0.07 * p[1], min(0.95, 1.1 / (1 + 0.3 * p[1]))); });
    gl.useProgram(solid);
    gl.uniformMatrix4fv(SU.uVP, false, cur.vp); gl.uniform3fv(SU.uEye, e); gl.uniform3fv(SU.uFog, SKY.gnd);
    // the athletes' key held to the view, from over the viewer's left shoulder, as his head's rig is (pearl.js, uRig)
    gl.uniform3fv(SU.uKeyV, norm(add(add(sc(r, -0.5), sc(u, 0.72)), sc(f, -0.5)))); gl.uniform1f(SU.uKMax, courts.length - 1);
    cur.sun = norm(add(add(sc(r, 0.45), sc(u, 0.8)), sc(f, -0.4))); gl.uniform3fv(SU.uSunG, cur.sun); gl.uniform1f(SU.uGold, 0);
    drawCourts(); drawShadows(shadows);
    // the athletes
    drawAthlete(me, me.pose, true, false);
    courts.forEach(function (cv, k) {
      if (!near(courtAt(k)[0])) { return; }
      var rp = cv.up && cv.rec && !(m && m.k === k);
      drawAthlete(plans[k], plans[k].pose = athPose(plans[k], rp ? plans[k].replayT : gt), false);
      if (cv.up && !(m && m.k === k)) { drawAthlete(stands[k], athPose(stands[k], rp ? stands[k].replayT : gt), false); }
    });
    pearls.forEach(function (q) { drawBall(q[0], q[1]); });
    paint(MAT.DUST);
    dust.forEach(function (d) { var s = 0.07 * (1 - (gt - d.t) / 0.7); cbox([d.x, d.y, d.z], [s, s, s], CT.dust, 0.4); });
    drawHead(me.pose, vm);
    gl.bindVertexArray(null);
    if (into) { ascEnd(cw, chh, dpr, yaw, pitch); }
    overlay(dpr);
  }
  // (the pearl drawn a third larger than it plays, the artist, 28 Oct 2026: "The ball should be 33% bigger and twice as
  // easy to see": its solid, its glow, and a bright core over its character on the HUD, the same third larger)
  var PEARL = { big: 1.33 };
  function drawBall(p, spin) {
    // (lit from within; never under three pixels across, so far off it still shows in its cell)
    var h = PEARL.big * body.cell * max(1, 1.5 * pixA * hypot(p[0] - cur.eye[0], p[1] - cur.eye[1], p[2] - cur.eye[2]) / (3 * body.cell));
    paint(MAT.PEARL); drawSolid(ballMesh, mul(T(p[0], p[1], p[2]), mul(RX(spin || 0), mul(S(h), T(-3, -3, -3)))), CT.pearl, null, 2.2);
    if (asc && asc.balls) { ascBall(p, canvas.width, canvas.height); }
  }
  /* ---- the effects --------------------------------------------------------------------------------------------------
     The artist, 28 Oct 2026: "There should be small explosions every single time you hit the ball and there should be
     air animations or court animations about how Mr. Pearl moves around in interacts with the surface of the court and
     the air". In characters, over the view, each from where it is in the courts and as large as its distance makes it:
     a burst at every stroke (the serve, his returns, Mr Plan's, the stand-ins' within sight; his warm, Mr Plan's cool);
     under the feet a puff at each footfall and a scuff left on the court; behind a sprint the air it leaves; round a
     leap the air turning; at a hard landing a ring rushing out along the court; at a skid or a dive's slide, streaks.
     Their chance is their own (fxR), so the game's own (rng) plays the same with or without them. */
  var fx = [], fxS = 20261028, replaying = false;
  function fxR() { fxS = (fxS * 1103515245 + 12345) >>> 0; return fxS / 4294967296; }
  var FXC = {   // the colours: the burst's heat, the air's trail, the air turning, the court's dust and its scuff
    me: { hot: ["#fff4d6", "#ffd166", "#ff9f43", "#ff5e7e"], trail: ["#ffe6a8", "#ffb86b", "#ff8fa3"], swirl: ["#bdf7ff", "#e6c6ff", "#fff1c1"] },
    plan: { hot: ["#e8fdff", "#5ce1e6", "#7aa2ff", "#c77dff"], trail: ["#7ef0ff", "#b39cff", "#8ad1ff"], swirl: ["#c9fff4", "#d7c4ff", "#a8e8ff"] },
    dust: ["#f1d7a8", "#c9b6ff", "#9fe3d6"], scuff: ["#a9c8ff", "#c2f0e6"] };
  function pick(a) { return a[floor(fxR() * a.length) % a.length]; }
  function fxAdd(p, v, life, ch, col, size, g, flat) { if (fx.length < 320) { fx.push({ p: p, v: v, t0: gt, life: life, ch: ch, col: col, size: size, g: g, flat: flat }); } }
  // a burst where the pearl is struck: a white-hot core, sparks out on every side (falling a little), a ring
  function fxBurst(p, who, big) {
    var mr = court.m && court.m.rec; if (mr && !replaying && abs(p[0] - courtAt(court.m.k)[0]) < COURT.GAP / 2) { mr.fx.push({ t: gt - mr.t0, p: p.slice(), who: who, big: big }); if (mr.fx.length > 400) { mr.fx.shift(); } }
    var C = FXC[who], n = big ? 22 : 14, sp = big ? 5.5 : 4;
    fxAdd(p.slice(), [0, 0, 0], 0.14, "*", C.hot[0], big ? 0.5 : 0.36, 0, false);
    for (var i = 0; i < n; i += 1) {
      var u = fxR() * 2 - 1, a = fxR() * 2 * PI, r = Math.sqrt(1 - u * u), s = sp * (0.55 + 0.45 * fxR());
      fxAdd(p.slice(), [r * Math.cos(a) * s, u * s * 0.8 + 1, r * Math.sin(a) * s], 0.3 + 0.25 * fxR(), pick(["*", "+", "◆", "◇", "∴", "%"]), pick(C.hot), 0.16 + 0.08 * fxR(), 6, false);
    }
    for (var j = 0; j < 10; j += 1) { var b = j / 10 * 2 * PI; fxAdd(p.slice(), [Math.cos(b) * 3, Math.sin(b) * 3, 0], 0.22, "·", C.hot[1], 0.12, 0, false); }
  }
  // an echo: his shape in a few characters where the pearl is, for the moment of its stroke
  function fxEcho(p, who) {
    var C = FXC[who];
    for (var i = 0; i < 9; i += 1) { fxAdd([p[0] + (fxR() - 0.5) * 0.5, max(0.1, p[1] - 0.9 + 1.8 * i / 8), p[2] + (fxR() - 0.5) * 0.3], [0, 0.2, 0], 0.4, pick(["◇", ":", "|", "∴"]), pick(C.swirl), 0.17, 0, false); }
  }
  // a blink: a line of characters from where he was to where he is, thinning, and a ring where he comes back
  function fxBlink(a, b, who) {
    var C = FXC[who], n = 14;
    for (var i = 0; i <= n; i += 1) { var u = i / n; fxAdd([a[0] + (b[0] - a[0]) * u, a[1] + 0.5 * (fxR() - 0.5), a[2] + (b[2] - a[2]) * u], [0, 0.3, 0], 0.25 + 0.3 * u, pick([":", "∴", "·", "◇"]), pick(C.trail), 0.15, 0, false); }
    for (var q = 0; q < 10; q += 1) { var t = q / 10 * 2 * PI; fxAdd([b[0], b[1], b[2]], [Math.cos(t) * 2.2, 0.4, Math.sin(t) * 2.2], 0.3, "◇", pick(C.swirl), 0.14, 0, false); }
  }
  // the mark answering his step onto it: a ring of gold running out along the court, a few sparks up
  function fxRing(p, who) {
    var C = FXC[who];
    for (var q = 0; q < 16; q += 1) { var b = q / 16 * 2 * PI; fxAdd(p.slice(), [Math.cos(b) * 2.6, 0, Math.sin(b) * 2.6], 0.45, "◆", pick(["#f3c98b", "#ffd27a", C.hot[1]]), 0.12, 0, true); }
    for (var j = 0; j < 6; j += 1) { fxAdd([p[0], 0.1, p[2]], [(fxR() - 0.5) * 1.2, 1.6 + fxR(), (fxR() - 0.5) * 1.2], 0.5, "+", pick(C.hot), 0.12, 3, false); }
  }
  // how a body meets the court and the air, each frame: footfalls, sprint, leap, landing, skid
  function fxMove(a, who, dt) {
    var C = FXC[who], k = floor(a.phase / PI), fwd = [Math.sin(a.yaw), -Math.cos(a.yaw)], lat = [Math.cos(a.yaw), Math.sin(a.yaw)];
    if (a.fxK != null && k !== a.fxK && !a.air && a.speed > 1.2) {
      var sd = k % 2 ? 0.13 : -0.13, fp = [a.x + lat[0] * sd, 0.02, a.z + lat[1] * sd];
      for (var i = 0; i < 3 + floor(a.speed / 4); i += 1) { fxAdd(fp.slice(), [(fxR() - 0.5) * 0.8 - a.vx * 0.08, 0.4 + 0.6 * fxR(), (fxR() - 0.5) * 0.8 - a.vz * 0.08], 0.32 + 0.2 * fxR(), pick([".", ":", "∴"]), pick(FXC.dust), 0.1, 1.5, false); }
      fxAdd(fp.slice(), [0, 0, 0], 1.3, a.speed > 6 ? "=" : "_", pick(FXC.scuff), 0.16, 0, true);
    }
    a.fxK = k;
    a.fxT = (a.fxT || 0) + dt;
    if (a.speed > 6.5 && a.fxT > 0.035) {   // the air he leaves: a wake of strokes at his chest and hips
      a.fxT = 0;
      for (var h = 0; h < 2; h += 1) { fxAdd([a.x - fwd[0] * 0.35 + lat[0] * (fxR() - 0.5) * 0.4, 0.75 + 0.55 * h + a.y, a.z - fwd[1] * 0.35 + lat[1] * (fxR() - 0.5) * 0.4], [-a.vx * 0.06, 0.15, -a.vz * 0.06], 0.3, pick(["~", "-", "="]), pick(C.trail), 0.15, 0, false); }
    }
    if (a.air && a.y > 0.15 && a.fxT > 0.04) {   // the air turning round him in a leap or a dive
      a.fxT = 0;
      for (var j = 0; j < 2; j += 1) { var th = gt * 9 + j * PI, r = 0.6; fxAdd([a.x + Math.cos(th) * r, a.y + 0.5 + 0.6 * fxR(), a.z + Math.sin(th) * r], [-Math.sin(th) * 2.4, 0.5, Math.cos(th) * 2.4], 0.42, pick(["∴", "∵", "~"]), pick(C.swirl), 0.14, 0, false); }
    }
    if (a.fxAir && !a.air && a.fxVy < -2.5) {   // a hard landing: a ring along the court, and its dust
      for (var q = 0; q < 18; q += 1) { var b = q / 18 * 2 * PI, v = 3 + 0.6 * fxR(); fxAdd([a.x, 0.02, a.z], [Math.cos(b) * v, 0, Math.sin(b) * v], 0.5, pick([".", ":", "*"]), pick(FXC.dust), 0.13, 0, true); }
    }
    if (a.skid > 0.5 && a.fxT > 0.03) { a.fxT = 0; fxAdd([a.x, 0.02, a.z], [0, 0, 0], 1.1, "=", pick(FXC.scuff), 0.18, 0, true); }
    a.fxAir = a.air; a.fxVy = a.vy;
  }
  // the sun on his gold: where the guitar's top turns the sun to the eye, a glint (a star of characters, white-gold),
  // and now and then a spark somewhere on it, as gold in the sun has
  function fxGlint(dt) {
    var ps = me.pose; if (!ps || !cur.sun || hideAth) { return; }
    var c = ps.paddleC, v = norm(sub(cur.eye, c)), k = abs(dot(ps.paddleN, norm(add(cur.sun, v))));
    me.glT = (me.glT || 0) + dt;
    var j = function (r) { return [c[0] + (fxR() - 0.5) * r, c[1] + (fxR() - 0.5) * r, c[2] + (fxR() - 0.5) * r]; };
    if (k > 0.93 && me.glT > 0.05) { me.glT = 0; fxAdd(j(0.18), [0, 0, 0], 0.16, "+", pick(["#fffbe8", "#ffe7a3", "#ffd166"]), 0.2 + 1.2 * (k - 0.93), 0, false); }
    else if (fxR() < dt * 1.6) { fxAdd(j(0.5), [0, 0.1, 0], 0.22, pick(["+", "*", "·"]), pick(["#fff4c2", "#ffd166"]), 0.12, 0, false); }
  }
  function fxStep(dt) {
    var e = cur.eye;
    fxGlint(dt);
    [[me, "me"]].concat(plans.map(function (p) { return [p, "plan"]; }), stands.map(function (p) { return [p, "me"]; })).forEach(function (w) {
      var a = w[0]; if (a && hypot(a.x - e[0], a.z - e[2]) < 45) { fxMove(a, w[1], dt); }
    });
    fx = fx.filter(function (f) {
      f.p[0] += f.v[0] * dt; f.p[1] += f.v[1] * dt; f.p[2] += f.v[2] * dt;
      if (f.g) { f.v[1] -= f.g * dt; if (f.p[1] < 0.02) { f.p[1] = 0.02; f.v[1] = 0; } }
      if (f.flat) { var k = max(0, 1 - 5 * dt); f.v[0] *= k; f.v[2] *= k; }
      return gt - f.t0 < f.life;
    });
  }
  // drawn over the view, each its size by its distance, lit additively (so they glow, and a spark over a spark is brighter)
  function fxDraw(c, W, H, vp) {
    if (!fx.length) { return; }
    c.save(); c.globalCompositeOperation = "lighter"; c.textAlign = "center"; c.textBaseline = "middle";
    var lastPx = -1;
    fx.forEach(function (f) {
      var p = f.p, w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
      if (w < 0.15) { return; }
      var x = (vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12]) / w, y = (vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13]) / w;
      if (x < -1.1 || x > 1.1 || y < -1.1 || y > 1.1) { return; }
      var px = round(clampV(f.size * H / (2 * w * T35), 7, 64)), age = (gt - f.t0) / f.life;
      if (px !== lastPx) { c.font = "700 " + px + "px ui-monospace, SFMono-Regular, Menlo, 'DejaVu Sans Mono', monospace"; lastPx = px; }
      c.globalAlpha = clampV(1 - Math.pow(age, 1.6), 0, 1); c.fillStyle = f.col;
      c.fillText(f.ch, (x * 0.5 + 0.5) * W, (1 - (y * 0.5 + 0.5)) * H);
    });
    c.restore();
  }

  // Over the view, page-drawn: the ring where Mr Plan's shot comes down, the stick, and the last ten
  // courts' squares; all of it in characters where it marks a place.
  // The cues, drawn: whichever step or tip is current (cueKey), on the thing itself. hudBox.cue keeps what was drawn, for
  // the tests: the ghost, the keys, every word and its box, the pips.
  function cueDraw(c, W, H, toS, glyph, m, sb) {
    var key = cueKey(), rt = CUE.rt, G = CUE_COL, hand = cueH(), out = { key: key, hand: CUE.hand, stop: TUT.stop, ghost: null, keys: [], items: [], arrows: [], trail: null, ray: null, ready: false, cont: false };
    hudBox.cue = out;
    // (nothing of the cues on the controls, the squares, the bar but its own, Mr Plan's banner, the words while they show)
    var res = [], st = hudBox.strip, sayE = $("say");
    if (sb.width) { res.push({ x: sb.left - 6, y: sb.top - 6, w: sb.width + 12, h: sb.height + 12, k: 9 }); }   // (k: what meeting it costs a word with no free place; the controls never)
    if (st) { res.push({ x: st.x - 6, y: 0, w: st.w + 12, h: st.y + max(st.h, 42) + 4, k: 9 }); }
    if (hudBox.score) { var hs2 = hudBox.score; res.push({ x: hs2.x - 6, y: 0, w: hs2.w + 12, h: hs2.y + hs2.h + 6, k: 9 }); }
    if (hudBox.banner) { res.push(hudBox.banner); }
    if (sayE.style.opacity !== "0" && sayE.textContent) { var sr = sayE.getBoundingClientRect(); res.push({ x: sr.left, y: sr.top, w: sr.width, h: sr.height }); }
    var meets = function (a, b) { return !!a && !!b && a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h; };
    var free = function (bx, own) {
      if (bx.x < 12 || bx.y < 12 || bx.x + bx.w > W - 12 || bx.y + bx.h > H - 12) { return false; }
      for (var i = 0; i < res.length; i += 1) { if (meets(bx, res[i])) { return false; } }
      return own || !meets(bx, hudBox.meter);
    };
    var txt = function (t, x, y, size, col, align, alpha, plain) {
      if (alpha != null && alpha <= 0.01) { return; }
      c.save(); if (alpha != null) { c.globalAlpha = min(1, alpha); }
      c.font = "700 " + size + "px ui-monospace, SFMono-Regular, Menlo, 'DejaVu Sans Mono', monospace"; c.textAlign = align || "center"; c.textBaseline = "middle";
      if (!plain) { c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,0.85)"; c.strokeText(t, x, y); }
      c.fillStyle = col; c.fillText(t, x, y); c.restore();
    };
    // (a word beside what it names: its side kept while it fits, else the next that fits, else none: the motion says it)
    var lab = function (id, t, x, y, col, size, align, alpha, own) {
      size = size || 12; var w = t.length * size * 0.62 + 8, h = size + 8, sides = [[0, 0], [0, 26], [w / 2 + 16, 0], [-w / 2 - 16, 0], [0, -26]];
      var s0 = CUE.side[id] || 0, order = [s0, 0, 1, 2, 3, 4];
      for (var q = 0; q < order.length; q += 1) {
        var o = sides[order[q]], cx = x + o[0], bx = { x: align === "right" ? cx - w : align === "left" ? cx : cx - w / 2, y: y + o[1] - h / 2, w: w, h: h };
        if (free(bx, own)) {
          CUE.side[id] = order[q]; txt(t, align === "right" ? bx.x + w - 4 : align === "left" ? bx.x + 4 : cx, y + o[1], size, col, align, alpha);
          out.items.push({ what: id, t: t, x: bx.x, y: bx.y, w: w, h: h }); res.push(bx); return bx;
        }
      }
      return null;
    };
    var rr = function (x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
    var ripple = function (r, u, rad) { if (u < 0 || u > 1) { return; } var e = 2 + 12 * u; c.save(); rr(r.left - e, r.top - e, r.width + 2 * e, r.height + 2 * e, (rad || 24) + e); c.lineWidth = 2; c.strokeStyle = "rgba(255,209,102," + (0.8 * (1 - u)).toFixed(3) + ")"; c.stroke(); c.restore(); };
    var capBox = function (ch, x, y, w, h, lit, down) {
      c.save(); rr(x - w / 2, y - h / 2 + (down ? 2 : 0), w, h, 5); c.fillStyle = down ? G.gold : "rgba(6,8,14,0.6)"; c.fill();
      c.lineWidth = lit ? 2 : 1.5; c.strokeStyle = lit ? G.gold : "rgba(236,236,228,0.9)"; c.stroke(); c.restore();
      txt(ch, x, y + (down ? 2 : 0), ch.length > 1 ? 11 : 13, down ? "#0b0c10" : lit ? G.gold : G.ink, "center", 1, true);
      out.keys.push({ ch: ch, x: x - w / 2, y: y - h / 2, w: w, h: h, lit: !!lit, down: !!down });
    };
    var beat = function () { return ((rt - CUE.b0) % CUE_BEAT + CUE_BEAT) % CUE_BEAT; };
    // his figure on the screen, and where the left hand goes (clear of him)
    var fig = (function () { var hd = toS([me.x, 1.95, me.z]), ft = toS([me.x, 0, me.z]); if (!hd || !ft) { return null; } var h = ft[1] - hd[1]; return { x: hd[0] - 0.3 * h, y: hd[1], w: 0.6 * h, h: h }; })();
    var LH = (function () {
      var x = clampV(0.2 * W, 46, 0.5 * W - 46), y = H - clampV(0.16 * H, 80, 150), bx = function () { return { x: x - 55, y: y - 55, w: 110, h: 110 }; };
      if (fig && meets(bx(), fig)) { x = max(46, fig.x - 62); if (meets(bx(), fig)) { y = fig.y - 64; } }
      return [x, y];
    })();
    var mv = input.keys, moving = !!input.stick || mv.w || mv.a || mv.s || mv.d || mv.ArrowUp || mv.ArrowDown || mv.ArrowLeft || mv.ArrowRight;
    if (moving) { CUE.inT = rt; }
    // the ghost of the stick doing it (the keys on a desk), and the ray from his own thumb
    var caps = function (d, shift) {
      var LX = LH[0] + max(0, (shift ? 111 : 61) - LH[0]);   // (the cluster whole on a narrow screen: A's edge 49 px left of it, Shift's 99)
      var need = { w: -d[1] > 0.38, s: d[1] > 0.38, d: d[0] > 0.38, a: d[0] < -0.38 }, p = beat(), on = !CUE.rm && p > 0.2 && p < 0.55 && !moving;
      [["w", 0, -17, "ArrowUp"], ["a", -34, 17, "ArrowLeft"], ["s", 0, 17, "ArrowDown"], ["d", 34, 17, "ArrowRight"]].forEach(function (k) {
        capBox(k[0].toUpperCase(), LX + k[1], LH[1] + k[2], 30, 30, need[k[0]], mv[k[0]] || mv[k[3]] || (need[k[0]] && on));
      });
      if (shift) { capBox("shift", LX - 76, LH[1] + 17, 46, 30, false, !!mv.Shift); lab("run", STR.cue.run, LX - 76, LH[1] + 44, G.ink, 11); }
      out.ghost = { x: LX, y: LH[1], dx: d[0], dy: d[1], press: false, shown: true, caps: true };
    };
    var ghost = function (d, word, shift) {
      if (hand === 2) { caps(d, shift); return; }
      if (word) { lab("drag", word, LH[0], LH[1] + 38, G.ink, 12); }
      if (rt - CUE.inT < 1.2) { out.ghost = { x: LH[0], y: LH[1], dx: d[0], dy: d[1], press: false, shown: false }; return; }
      var p = beat(), s = CUE.rm ? 46 : p < 0.15 ? 0 : p < 0.75 ? 46 * smooth((p - 0.15) / 0.6) : 46, a = CUE.rm ? 0.9 : p < 0.15 ? p / 0.15 : p < 1.25 ? 1 : max(0, 1 - (p - 1.25) / 0.35);
      txt("○", LH[0], LH[1], 46, G.ink, "center", 0.5 * a);
      for (var i = 1; i <= 3; i += 1) { if (s > 8 * i) { txt("·", LH[0] + d[0] * (s - 8 * i), LH[1] + d[1] * (s - 8 * i), 14, G.gold, "center", 0.5 * a); } }
      txt("◆", LH[0] + d[0] * s, LH[1] + d[1] * s, 22, G.gold, "center", a);
      out.ghost = { x: LH[0], y: LH[1], dx: d[0], dy: d[1], press: false, shown: a > 0.05 };
    };
    var ray = function (d) {
      var sk = input.stick; if (!sk) { return; }
      var l = hypot(sk.dx, sk.dy), ok = l > 6 && (sk.dx * d[0] + sk.dy * d[1]) / l > Math.cos(PI / 6);
      for (var i = 1; i <= 5; i += 1) { txt("·", sk.x + d[0] * 12 * i, sk.y + d[1] * 12 * i, 14, ok ? G.gold : G.pale, "center", ok ? 1 : 0.6); }
      out.ray = { ok: ok };
    };
    // the gold trail on the court from his feet to where he must be: a wave of light toward it each beat, all lit when his way is right
    var trail = function (T) {
      var wx = T[0] - me.x, wz = T[1] - me.z, L = hypot(wx, wz); if (L < 0.55) { return; }
      var ux = wx / L, uz = wz / L, a1 = L - 0.5, n = clampV(floor((a1 - 0.5) / 0.4) + 1, 1, 16), stp = n > 1 ? (a1 - 0.5) / (n - 1) : 0;
      var sp = hypot(me.vx, me.vz), right = sp > 1 && (me.vx * ux + me.vz * uz) / sp > 0.85, ph = (rt % CUE_BEAT) / CUE_BEAT, drawn = 0;
      for (var i = 0; i < n; i += 1) {
        var dd = 0.5 + stp * i, q = toS([me.x + ux * dd, 0.02, me.z + uz * dd]); if (!q || !free({ x: q[0] - 4, y: q[1] - 4, w: 8, h: 8 }, true)) { continue; }
        txt("·", q[0], q[1], 16, G.gold, "center", right ? 1 : CUE.rm ? 0.75 : 0.35 + 0.65 * max(0, 1 - 4 * abs(i / max(1, n - 1) - ph))); drawn += 1;
      }
      out.trail = { n: drawn, right: right };
    };
    // a tap shown: the ghost of a finger (or a key) pressing; the approach ring closing onto it
    var tapCue = function (x, y, press, ring, capCh) {
      if (hand === 2) { var wide = capCh !== "E"; capBox(capCh || "space", x, y, wide ? 84 : 32 * (rt - CUE.wrongT < 0.3 ? 1.2 : 1), wide ? 28 : 32 * (rt - CUE.wrongT < 0.3 ? 1.2 : 1), true, press); }
      else { txt("○", x, y, 40 * (press ? 0.85 : 1), G.ink, "center", 0.6); txt("◆", x, y, press ? 20 : 16, G.gold, "center", press ? 1 : 0.8); }
      if (ring != null && !CUE.rm) { for (var i = 0; i < 12; i += 1) { var a = i / 12 * 2 * PI; txt("·", x + Math.cos(a) * ring, y + Math.sin(a) * ring, 10, G.gold, "center", 0.8); } }
      out.ghost = { x: x, y: y, press: !!press, shown: true, tap: true, ring: ring };
    };
    var circleCue = function () {
      if (!m || m.phase !== "serve" || m.meterOn) { return; }
      var sp = serveSpot(), mk = hudBox.mark; trail(sp);
      if (mk) { if (mk.edge) { res.push({ x: mk.x - 15, y: mk.y - 45, w: 30, h: 62 }); } lab("here", STR.cue.here, mk.x, mk.edge ? (mk.y + 56 > H ? mk.y : mk.y + 34) : mk.y - 26, G.gold, 13); }   // (an edge marker kept clear: on the bottom edge, the word beside it)
    };
    var barCue = function (word) {
      var mb = hudBox.meter; if (!m || !m.meterOn || !mb || !mb.cw) { return; }
      var per = servePeriod(m), ph = (gt - m.meterT0) / per; if (ph < 0) { return; }
      var tE = m.meterT0 + (floor(ph / 2) * 2 + 0.72) * per, hold = max(0.12 * per, 0.25); if (gt > tE + hold) { tE += 2 * per; }
      var press = gt >= tE && gt < tE + hold, ring = !press && tE - gt < 0.3 ? 20 + 20 * (tE - gt) / 0.3 : null;
      var gx = mb.x0 + 0.78 * mb.N * mb.cw, gy = mb.y0 + 68;
      if (meets({ x: gx - 24, y: gy - 24, w: 48, h: 48 }, fig) || gy + 40 > H - 12) { gx = mb.x0 + mb.N * mb.cw + 40; gy = mb.y0; if (gx + 30 > W - 12) { gx = mb.x0 - 40; } }
      tapCue(gx, gy, press, ring, "space");
      if (hand !== 2) { lab("tap", word || STR.cue.tap[hand], gx, gy + 32, G.gold, 13, null, 1, true); }
      if (rt - CUE.t0 > 8) { lab("stuck", STR.cue.stuck.serve[hand], gx, gy + 52, G.ink, 12, null, 1, true); }
    };
    var retCue = function () {
      var b = m && m.balls.filter(function (q) { return !q.dead && q.last === "them"; })[0]; if (!b) { return; }
      var ready = cueReady(m, b); out.ready = ready; if (ready) { return; }
      trail(b.mark && b.bounces === 0 ? [b.mark.x, b.mark.z] : [b.x, b.z]);
      var q = b.mark && toS([b.mark.x, 0.02, b.mark.z]); if (q) { lab("get", STR.cue.get, q[0], q[1] - 26, G.gold, 13); }
    };
    // the Super: a ghost press beside it, a ripple round it, and its words
    var supCue = function (lines) {
      if (!sb.width) { return; }
      var G4 = [sb.left - 26, sb.bottom + 20], p = beat(), press = !CUE.rm && rt - CUE.t0 > 0.6 * lines.length + 0.2 && p > 0.2 && p < 0.45;   // (it presses once its words are all up)
      if (!CUE.rm) { ripple(sb, (p - 0.2) / 0.8); } else { c.save(); rr(sb.left - 3, sb.top - 3, sb.width + 6, sb.height + 6, 27); c.lineWidth = 3; c.strokeStyle = G.gold; c.stroke(); c.restore(); }
      tapCue(G4[0], G4[1], press, null, "E");
      // (its facts, one after another, left of the press; on a narrow screen under it)
      var x0 = G4[0] - 28, ys = [G4[1] - 22, G4[1], G4[1] + 22], fits = lines.every(function (t, i) { var w = t.length * 7.5 + 8; return x0 - w >= 16 && free({ x: x0 - w, y: ys[i] - 10, w: w, h: 20 }); });
      if (!fits) { x0 = min(sb.right - 2, W - 12); ys = [G4[1] + 34, G4[1] + 56, G4[1] + 78]; }
      lines.forEach(function (t, i) { var a = CUE.rm ? 1 : clampV((rt - CUE.t0 - 0.6 * i) / 0.25, 0, 1); if (a > 0) { lab("fact" + i, t, x0, ys[i], i ? G.ink : G.gold, i ? 12 : 13, "right", a); } });
    };
    // The walk-through's (the artist, 29 Oct 2026): its words twice the cues' size, wrapped to the screen and popping up
    // where they are free (else at their last place: they must be read); a gold arrow at what they name; a finger.
    var BIG = 26;
    // (each place a function of the block's size giving its centre and top; or [that, the width it may take], the words
    // wrapped to it, three lines at most there; if none is free, the one that meets the fewest things)
    var wrap = function (t, room) {
      var per = max(8, floor((room - 12) / (BIG * 0.6))), n = Math.ceil(t.length / per), tgt = Math.ceil(t.length / n), lines = [], cur = "";
      t.split(" ").forEach(function (w) { var nx = cur ? cur + " " + w : w; if (cur && (nx.length > per || (cur.length >= tgt - 2 && nx.length > tgt))) { lines.push(cur); cur = w; } else { cur = nx; } });
      lines.push(cur); return lines;
    };
    var big = function (id, t, cands, col, t0, pulse) {
      var lh = BIG + 6, bx = null, lines, w, h, least = 1e9;
      var cost = function (b2) { var n = b2.x < 12 || b2.y < 12 || b2.x + b2.w > W - 12 || b2.y + b2.h > H - 12 ? 50 : meets(b2, hudBox.meter) ? 1 : 0; res.forEach(function (r) { if (meets(b2, r)) { n += r.k || 1; } }); return n; };   // (Mr Plan counts twice: the stops are about him)
      for (var q = 0; q < cands.length && least > 0; q += 1) {
        var cq = cands[q], f = cq.call ? cq : cq[0], ln = wrap(t, cq.call ? W - 20 : min(W - 20, cq[1]));
        if (!cq.call && ln.length > 3) { continue; }
        var w2 = ln.reduce(function (a2, l) { return max(a2, l.length); }, 0) * BIG * 0.6 + 12, h2 = ln.length * lh + 4, cd = f(w2, h2), b2 = { x: clampV(cd[0] - w2 / 2, 12, max(12, W - 12 - w2)), y: max(12, cd[1]), w: w2, h: h2 }, n2 = cost(b2);
        if (n2 < least) { least = n2; bx = b2; lines = ln; w = w2; h = h2; }
      }
      var e = CUE.rm ? 1 : smooth((rt - t0) / 0.2), al = e * (pulse && !CUE.rm ? 0.86 + 0.14 * Math.sin(rt * 2 * PI / 1.2) : 1);
      lines.forEach(function (l, i) { txt(l, bx.x + w / 2, bx.y + lh / 2 + 2 + i * lh + (1 - e) * 8, BIG, col, "center", al); });
      out.items.push({ what: id, t: t, x: bx.x, y: bx.y, w: w, h: h, lines: lines.length, size: BIG }); res.push(bx); return bx;
    };
    var arrow = function (id, x, y, ang, len) {
      var b2 = CUE.rm ? 0 : 7 * (0.5 + 0.5 * Math.sin(rt * 2 * PI / 0.9)), ux = Math.cos(ang), uy = Math.sin(ang);   // (it bobs at what it points to)
      c.save(); c.translate(x - ux * b2, y - uy * b2); c.rotate(ang);
      c.beginPath(); c.moveTo(0, 0); c.lineTo(-22, -15); c.lineTo(-22, -6); c.lineTo(-len, -6); c.lineTo(-len, 6); c.lineTo(-22, 6); c.lineTo(-22, 15); c.closePath();
      c.lineJoin = "round"; c.lineWidth = 5; c.strokeStyle = "rgba(0,0,0,0.85)"; c.stroke(); c.shadowColor = G.gold; c.shadowBlur = 12; c.fillStyle = G.gold; c.fill(); c.restore();
      var ex = x - ux * (len + 8), ey = y - uy * (len + 8), bx = { x: min(x, ex) - 16, y: min(y, ey) - 16, w: abs(x - ex) + 32, h: abs(y - ey) + 32 };
      out.arrows.push({ to: id, x: x, y: y, ang: ang, box: bx }); res.push(bx); return bx;
    };
    // (a hand, the index up, its tip at x, y: drawn outlined then filled, so it reads as one shape)
    var handAt = function (x, y, a, sc, rot) {
      var S = [[-7, 0, 14, 46, 7], [6, 30, 13, 22, 6], [17, 33, 12, 21, 6], [27, 37, 10, 18, 5], [-9, 42, 46, 34, 13]];
      var each = function (f) { S.forEach(function (r) { rr(r[0], r[1], r[2], r[3], r[4]); f(); }); c.save(); c.translate(-6, 58); c.rotate(-0.7); rr(-6, -24, 12, 30, 6); f(); c.restore(); };
      c.save(); c.globalAlpha = a; c.translate(x, y); if (rot) { c.rotate(rot); } c.scale(sc, sc);
      c.lineWidth = 5; c.strokeStyle = "rgba(0,0,0,0.8)"; each(function () { c.stroke(); });
      c.fillStyle = "#f2efe8"; each(function () { c.fill(); });
      rr(-4, 3, 8, 10, 4); c.fillStyle = "rgba(255,209,102,0.7)"; c.fill(); c.restore();
    };
    // (the finger: on the left half it touches, pushes forward and lifts, each beat; a ring where it lands, the way ahead
    // in gold dots; gone while his own thumb moves him)
    var finger = function () {
      var p = beat() / CUE_BEAT, x = LH[0], y0 = min(LH[1] + 30, H - 92), down = CUE.rm || (p >= 0.14 && p < 0.8);
      var a = CUE.rm ? 0.9 : p < 0.14 ? p / 0.14 : p < 0.8 ? 1 : max(0, 1 - (p - 0.8) / 0.12), y = y0 - (CUE.rm ? 0 : 64 * smooth((p - 0.22) / 0.5)) - (down ? 0 : 8);
      if (rt - CUE.inT < 1.2) { a = 0; }
      for (var i = 1; i <= 4; i += 1) { txt("·", x, y0 - 16 * i, 16, G.gold, "center", 0.6 * a); }
      var ru = (p - 0.14) / 0.35; if (!CUE.rm && ru > 0 && ru < 1 && a > 0) { c.save(); c.beginPath(); c.arc(x, y0, 10 + 22 * ru, 0, 2 * PI); c.lineWidth = 3; c.strokeStyle = "rgba(255,209,102," + (0.9 * (1 - ru)).toFixed(3) + ")"; c.stroke(); c.restore(); }
      if (a > 0.01) { handAt(x, y, a, down ? 0.96 : 1, 0); }
      if (hand === 2) { capBox("W", x + 72, y0 - 24, 30, 30, true, down && a > 0.5); }   // (on a desk, its key too)
      out.ghost = { x: x, y: y, dx: 0, dy: -1, press: down && a > 0.5, shown: a > 0.05, finger: true };
      res.push({ x: x - 20, y: y0 - 80, w: 64, h: 160 });
    };
    // (Mr Plan and his pearl on the screen, for the words to stand clear of)
    var planBox = function () {
      var pl = m && plans[m.k], hd = pl && toS([pl.x, pl.y + 2.0, pl.z]), ft = pl && toS([pl.x, pl.y, pl.z]); if (!hd || !ft) { return null; }
      var hh = max(30, ft[1] - hd[1]), bx = { x: hd[0] - hh * 0.6, y: hd[1] - 12, w: hh * 1.2, h: hh + 24 }, bp = m.psup && m.psup.ball && toS([m.psup.ball.x, m.psup.ball.y, m.psup.ball.z]);
      if (bp) { var x1 = min(bx.x, bp[0] - 16), y1 = min(bx.y, bp[1] - 16); bx = { x: x1, y: y1, w: max(bx.x + bx.w, bp[0] + 16) - x1, h: max(bx.y + bx.h, bp[1] + 16) - y1 }; }
      bx.k = 2; return bx;
    };
    if (TUT.on) {
      var mb = hudBox.meter, zx = mb && mb.cw ? mb.x0 + (SERVE.ACE[0] + SERVE.ACE[1]) / 2 * mb.N * mb.cw : null, inZ = function (u) { return u != null && u >= SERVE.ACE[0] && u < SERVE.ACE[1]; };
      // (each time a touch is wanted, its gesture too (the artist, 29 Oct 2026: "There should be touch gestures as well
      // for each time the user is supposed to touch the screen during the walkthrough"): the hand's ghost where the right
      // thumb rests, hovering, and pressing, a gold ring where it touches, while a tap would do it: the bar's mark in the
      // gold, or on the beat; on a desk its key beside it)
      var RH = (function () {
        var x = W - clampV(0.15 * W, 50, 0.5 * W - 46), y = min(H - clampV(0.16 * H, 80, 150), H - 92), bx = function () { return { x: x - 34, y: y - 14, w: 80, h: 96 }; };
        if (fig && meets(bx(), fig)) { x = min(W - 44, fig.x + fig.w + 36); }
        return [x, y];
      })();
      var tapHand = function (x, y, press, rot, cap) {
        if (press && !CUE.tapOn) { CUE.tapT = rt; } CUE.tapOn = press;
        var ru = (rt - CUE.tapT) / 0.35; if (!CUE.rm && press && ru >= 0 && ru < 1) { c.save(); c.beginPath(); c.arc(x, y, 8 + 24 * ru, 0, 2 * PI); c.lineWidth = 3; c.strokeStyle = "rgba(255,209,102," + (0.9 * (1 - ru)).toFixed(3) + ")"; c.stroke(); c.restore(); }
        handAt(x, y, press ? 1 : 0.85, press ? 0.95 : 1.06, rot || 0);
        if (hand === 2 && cap) { var wide = cap !== "E", fl = !wide && rt - CUE.wrongT < 0.3 ? 1.25 : 1; capBox(cap, x - (wide ? 84 : 52), y + 36, wide ? 84 : 32 * fl, wide ? 28 : 32 * fl, true, press); }   // (a wrong key at the Super's: its key flares)
        out.ghost = { x: x, y: y, press: press, shown: true, tap: true, hand: true };
        res.push({ x: x - 34, y: y - 14, w: 80, h: 96 });
      };
      var beatPress = function () { var p2 = beat(); return CUE.rm || (p2 > 0.2 && p2 < 0.45); };
      // (the arrow down at the bar's gold zone (the ace's, the return's), its words over it, short of room under the bar;
      // the hand tapping as the mark comes into the gold)
      var atBar = function (id, word, u) {
        if (zx == null) { return; }
        var ab = arrow(id, zx, mb.y0 - 28, PI / 2, 58), pb2 = planBox(); if (pb2) { res.push(pb2); }
        tapHand(RH[0], RH[1], inZ(u), 0, "space");
        var over = function (h) { return mb.y0 - 52 - h; };   // (beside the arrow: over the bar's own marks)
        big(id, word, [function (w, h) { return [zx, ab.y - h]; }, function (w, h) { return [ab.x - 6 - w / 2, over(h)]; }, function (w, h) { return [ab.x + ab.w + 6 + w / 2, over(h)]; }, function () { return [W / 2, mb.y0 + 44]; }, function (w, h) { return [ab.x - 6 - w / 2, over(h)]; }], G.gold, CUE.t0);
      };
      // (the game still: its words over the court, clear of Mr Plan and of him; three seconds on, how to go on, and the
      // hand tapping)
      var stand = function (id, word) {
        var pb = planBox(), tp = max(hudLow + 16, H * 0.14); if (pb) { res.push(pb); } if (fig) { res.push(fig); }
        var side = pb ? [[function (w) { return [pb.x + pb.w + 12 + w / 2, tp]; }, W - 12 - (pb.x + pb.w + 12)], [function (w) { return [pb.x - 12 - w / 2, tp]; }, pb.x - 24]] : [];
        var b1 = big(id, word, [function () { return [W / 2, tp]; }].concat(side, [function () { return [W / 2, H * 0.46]; }, function () { return [W / 2, tp]; }]), G.gold, TUT.sT);
        if (rt - TUT.sT >= 3) {
          tapHand(RH[0], RH[1], beatPress(), 0, "space");
          var byHand = function (w, h) { return [min(RH[0], W - 12 - w / 2), RH[1] - 22 - h]; };
          big("cont", STR.walk.cont[hand], [function () { return [b1.x + b1.w / 2, b1.y + b1.h + 12]; }, byHand, function (w, h) { return [b1.x + b1.w / 2, b1.y - h - 12]; }, byHand], G.ink, TUT.sT + 3, true); out.cont = true;   // (under the step's words; short of room, over the tapping hand)
        }
      };
      if (key === "move") { finger(); }
      else if (key === "serve" && m && m.meterOn) { atBar("tap", STR.walk.tap[hand], gt >= m.meterT0 ? meterAt(m) : null); }
      else if (key === "three") { stand("three", STR.walk.three); }
      else if (key === "each") { stand("each", STR.walk.each); }
      else if (key === "hit") { atBar("hit", STR.walk.hit, m && m.psup.uNow); }
      else if (key === "sup" && sb.width) {
        if (!CUE.rm) { ripple(sb, beat() / 0.8); }
        var sx = sb.left + sb.width / 2, ab2 = arrow("super", sx, sb.bottom + 8, -PI / 2, 56), pb3 = planBox(); if (pb3) { res.push(pb3); }
        tapHand(sb.left + 20, sb.top + sb.height * 0.62, beatPress(), 0.55, "E");   // (its finger on the Super's left, from below and to the left, clear of the arrow)
        big("counter", STR.walk.counter, [function (w) { return [min(sx, W - 12 - w / 2), ab2.y + ab2.h + 4]; }, [function (w, h) { return [sb.left - 14 - w / 2, sb.top + sb.height / 2 - h / 2]; }, sb.left - 26], function () { return [W / 2, mb ? mb.y0 + 44 : H * 0.4]; }], G.gold, TUT.sT);   // (under its arrow; on a short screen, beside the Super)
        if (CUE.miss && rt - CUE.miss.t < 0.6) { var an = Math.atan2(sb.top + sb.height / 2 - CUE.miss.y, sb.left + sb.width / 2 - CUE.miss.x); txt("→↘↓↙←↖↑↗".charAt(((Math.round(an / (PI / 4)) % 8) + 8) % 8), CUE.miss.x, CUE.miss.y, 40, G.gold); out.miss = true; }
      }
    }
    else if (key === "move") { ghost([0, -1], hand === 2 ? null : STR.cue.drag, true); ray([0, -1]); }
    else if (key === "court" && !m) {
      var k = courts.length - 1, cc = courtAt(k), q = toS([cc[0], 2.4, cc[2]]), bob = CUE.rm ? 0 : 3 * Math.sin(rt / CUE_BEAT * 2 * PI);
      if (q && q[0] > 12 && q[0] < W - 12 && q[1] > hudLow && q[1] < H - 12) { txt("◆", q[0], q[1] + bob, 18, G.gold); lab("play", STR.cue.play, q[0], q[1] - 24, G.gold, 13); }
      trail([cc[0], cc[2] + COURT.L - 1]);
      var bt = document.querySelector("#courts button:last-child");
      if (bt) { var br = bt.getBoundingClientRect(); if (!CUE.rm && st) { ripple({ left: st.x + st.w - st.h, top: st.y, width: st.h, height: st.h }, beat() / 0.8, 6); } lab("go", STR.cue.go[hand], br.right + 10, br.top + br.height / 2, G.gold, 12, "left"); }
    }
    else if (key === "serve") { circleCue(); }
    else if (key === "bar") { if (m && m.served + m.tosses.length < 1) { barCue(); } }
    else if (key === "pearls") { if (cueLive("pearls")) { barCue(STR.cue.again); } }
    else if (key === "rally") { retCue(); }
    else if (key === "multi" && m) { live(m).sort(function (x, y) { return x.id - y.id; }).forEach(function (b, i) { var qb = toS([b.x, b.y, b.z]); if (qb) { txt(String(i + 1), qb[0] + 14, qb[1] - 14, 12, G.gold); } }); }
    else if (key === "super" && m && m.sup.avail && !m.sup.armed) { if (rt - CUE.t0 < 3 * CUE_BEAT) { supCue(STR.cue.superTip); } }
    // the words where things happened
    CUE.pops = CUE.pops.filter(function (pp) {
      var u = (rt - pp.t0) / 0.9; if (u >= 1) { return false; }
      var q = pp.at.length === 3 ? toS(pp.at) : pp.at; if (!q) { return true; }
      var rise = CUE.rm ? 0 : 10 * (1 - (1 - u) * (1 - u)), al = u < 0.5 ? 1 : 1 - (u - 0.5) / 0.4;
      var ps = TUT.on ? 28 : 14, hw = pp.t.length * ps * 0.31; q = [clampV(q[0], 12 + hw, max(12 + hw, W - 12 - hw)), q[1]];   // (the walk-through's twice the size; inside the screen)
      txt(pp.t, q[0], q[1] - rise, ps, pp.col, "center", al); out.items.push({ what: "pop", t: pp.t, x: q[0] - pp.t.length * ps * 0.31, y: q[1] - rise - ps * 0.7, w: pp.t.length * ps * 0.62, h: ps * 1.4 });
      return true;
    });
  }
  var sayEl = null, hudLow = 0, hudBox = {}, HUD = { score: null, flash: -9 };   // (hudBox: where the bar was drawn, for the tests)
  function overlay(dpr) {
    sayEl = sayEl || $("say");
    var c = hud.getContext("2d"), W = hud.clientWidth, H = hud.clientHeight;
    if (hud.width !== round(W * dpr) || hud.height !== round(H * dpr)) { hud.width = round(W * dpr); hud.height = round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    var m = court.m, vp = cur.vp;
    fxDraw(c, W, H, vp);
    hudBox.meter = null; hudBox.mark = null; hudBox.banner = null;
    var toS = function (p) { var q = [0, 0, 0, 0]; for (var i = 0; i < 4; i += 1) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; } return q[3] > 0.05 ? [(q[0] / q[3] * 0.5 + 0.5) * W, (1 - (q[1] / q[3] * 0.5 + 0.5)) * H] : null; };
    var glyph = function (ch, x, y, size, col) { c.font = "700 " + size + "px ui-monospace, SFMono-Regular, Menlo, 'DejaVu Sans Mono', monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.7)"; c.strokeText(ch, x, y); c.fillStyle = col || "#f2efe8"; c.fillText(ch, x, y); };
    if (m) {
      // the pearl in play, easier to see (the artist, 28 Oct 2026: "I need to be able to see the ball 33% better than
      // I do now"; pb_measure.js measures its light against the frame without it): a warm glow round its character,
      // as large as a ball of haloR metres at its distance, and the way it came, a few fading points
      c.save(); c.globalCompositeOperation = "lighter";
      m.balls.forEach(function (b) {
        if (b.dead) { return; }
        var q = [0, 0, 0, 0], P = [b.x, b.y, b.z]; for (var i3 = 0; i3 < 4; i3 += 1) { q[i3] = vp[i3] * P[0] + vp[4 + i3] * P[1] + vp[8 + i3] * P[2] + vp[12 + i3]; }
        if (q[3] < 0.1) { return; }
        var sx = (q[0] / q[3] * 0.5 + 0.5) * W, sy = (0.5 - q[1] / q[3] * 0.5) * H, R = clampV(ASC.haloR * H / (2 * q[3] * T35), 12, 60);
        var gr = c.createRadialGradient(sx, sy, 0, sx, sy, R); gr.addColorStop(0, "rgba(255,246,222," + ASC.halo.toFixed(3) + ")"); gr.addColorStop(0.45, "rgba(255,226,170," + (ASC.halo * 0.45).toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,200,120,0)");
        c.fillStyle = gr; c.fillRect(sx - R, sy - R, 2 * R, 2 * R);
        // (its core: a disc the pearl's own size, a third larger, pearl white, lit from within)
        var cr = clampV(PEARL.big * pearlR() * H / (2 * q[3] * T35), 3.5, 0.6 * R);   // (inside its glow, near the eye too)
        if (ASC.core) { c.fillStyle = "rgba(255,252,240,0.95)"; c.beginPath(); c.arc(sx, sy, cr, 0, 2 * PI); c.fill(); }
        b.tr = (b.tr || []); b.tr.push([sx, sy]); if (b.tr.length > 7) { b.tr.shift(); }
        b.tr.forEach(function (t, j) { if (j < b.tr.length - 1) { c.fillStyle = "rgba(255,238,200," + (0.35 * (j + 1) / b.tr.length).toFixed(3) + ")"; c.beginPath(); c.arc(t[0], t[1], max(1.5, R * 0.16 * (j + 1) / b.tr.length), 0, 2 * PI); c.fill(); } });
      });
      c.restore();
      m.balls.forEach(function (b) {
        if (b.dead || !b.mark || b.last !== "them" || b.bounces !== 0) { return; }
        var ck = cueKey(), lit = ck === "ret" || ck === "rally", rd = lit && cueReady(m, b);
        for (var s = 0; s < 14; s += 1) { var a = s / 14 * 2 * PI, q = toS([b.mark.x + Math.cos(a) * 0.4, 0.02, b.mark.z + Math.sin(a) * 0.4]); if (q) { if (lit) { glyph(rd ? "◆" : "○", q[0], q[1], rd ? 12 : 13, CUE_COL.gold); } else { glyph("○", q[0], q[1], 11); } } }
        var qm = lit && toS([b.mark.x, 0.02, b.mark.z]); if (qm) { glyph("◆", qm[0], qm[1], 14, CUE_COL.gold); }
      });
      if (m.phase === "serve" && !m.meterOn) {
        // (where he serves from, the artist, 28 Oct 2026: "Make the spot I need to run to to serve more apparent in a quick
        // golden circle that serves as a strong visual cue of the spot": a bold gold circle on the court, glowing, filled
        // faintly, and every second a ring running quickly out from it to twice its size, where the lock begins; drawn
        // over everything, so a mark behind him still shows through; a ring that grows and fades, never a flash)
        var sp = serveSpot(), ring = function (rad) { var pts = []; for (var s2 = 0; s2 <= 32; s2 += 1) { var a2 = s2 / 32 * 2 * PI, q2 = toS([sp[0] + Math.cos(a2) * rad, 0.02, sp[1] + Math.sin(a2) * rad]); if (!q2) { return null; } pts.push(q2); } return pts; };
        var path = function (pts) { c.beginPath(); pts.forEach(function (q2, i2) { if (i2) { c.lineTo(q2[0], q2[1]); } else { c.moveTo(q2[0], q2[1]); } }); c.closePath(); };
        var main = ring(SERVE.R);
        if (main) {
          c.save(); path(main); c.fillStyle = "rgba(255,209,102,0.22)"; c.fill();
          c.shadowColor = "#ffd166"; c.shadowBlur = 14; c.lineWidth = 4; c.strokeStyle = "#ffd166"; c.stroke();
          c.shadowBlur = 0; c.lineWidth = 1.5; c.strokeStyle = "#fff4d6"; c.stroke();
          var pu = (gt % 1.1) / 0.55, pr = pu < 1 ? ring(SERVE.R * (1 + pu)) : null;   // (the ring running out, half of each second and a tenth)
          if (pr) { path(pr); c.lineWidth = 3; c.strokeStyle = "rgba(255,209,102," + (0.85 * (1 - pu)).toFixed(3) + ")"; c.stroke(); }
          c.restore();
        }
        var qc = toS([sp[0], 0.02, sp[1]]), inset = 34;
        if (qc && qc[0] > inset && qc[0] < W - inset && qc[1] > hudLow + inset && qc[1] < H - inset) { glyph("◆", qc[0], qc[1], 18, "#ffd27a"); hudBox.mark = { x: qc[0], y: qc[1] }; }
        else {
          // (off the screen, behind him or past its edge: at the edge, the way to it, a gold diamond and an arrow)
          var cq = [0, 0, 0, 0], P = [sp[0], 0.02, sp[1]]; for (var i2 = 0; i2 < 4; i2 += 1) { cq[i2] = vp[i2] * P[0] + vp[4 + i2] * P[1] + vp[8 + i2] * P[2] + vp[12 + i2]; }
          var ex = cq[0] / Math.abs(cq[3] || 1e-3), ey = -cq[1] / Math.abs(cq[3] || 1e-3); if (cq[3] < 0.05 && ey < 0.2) { ey = 1; }   // (behind: |w| keeps its side; the bottom edge)
          var an = Math.atan2(ey, ex), hx = (W / 2 - inset), hy = (H / 2 - inset), kk = min(hx / max(1e-3, Math.abs(Math.cos(an))), hy / max(1e-3, Math.abs(Math.sin(an))));
          var mx2 = W / 2 + Math.cos(an) * kk, my2 = max(hudLow + inset, H / 2 + Math.sin(an) * kk);
          // (the same bold gold circle, small, at the edge the way to it, its ring running out, and an arrow)
          c.save(); c.beginPath(); c.arc(mx2, my2, 15, 0, 2 * PI); c.fillStyle = "rgba(255,209,102,0.25)"; c.fill();
          c.shadowColor = "#ffd166"; c.shadowBlur = 12; c.lineWidth = 4; c.strokeStyle = "#ffd166"; c.stroke(); c.shadowBlur = 0;
          var eu = (gt % 1.1) / 0.55; if (eu < 1) { c.beginPath(); c.arc(mx2, my2, 15 * (1 + eu), 0, 2 * PI); c.lineWidth = 3; c.strokeStyle = "rgba(255,209,102," + (0.85 * (1 - eu)).toFixed(3) + ")"; c.stroke(); }
          c.restore();
          glyph("◆", mx2, my2, 13, "#fff4d6");
          glyph("→↘↓↙←↖↑↗".charAt(((Math.round(an / (PI / 4)) % 8) + 8) % 8), mx2 - Math.cos(an) * 30, my2 - Math.sin(an) * 30, 20, "#ffd166");
          hudBox.mark = { x: mx2, y: my2, edge: true };
        }
      }
      if (m.meterOn && m.phase !== "super" && m.phase !== "plansuper") { meterDraw(c, m, W, H, glyph); }
      if (m.phase === "plansuper" && m.psup.struck) {
        var ph = gt - m.psup.hitT, qp = toS([m.psup.ball.x, m.psup.ball.y, m.psup.ball.z]) || [W / 2, H / 3];
        if (ph < 0.3) { var gp = c.createRadialGradient(qp[0], qp[1], 0, qp[0], qp[1], max(W, H) * 0.8); gp.addColorStop(0, "rgba(160,240,255," + (0.35 * (1 - ph / 0.3)).toFixed(3) + ")"); gp.addColorStop(1, "rgba(90,160,255,0)"); c.fillStyle = gp; c.fillRect(0, 0, W, H); }
        // (its name clear of the counter's bar: above it where there is room, on a short screen under it)
        var mY = max(H * 0.37, hudLow + 56), bs0 = min(W * 0.085, 46), bsA = min(bs0, (mY - 50 - hudLow - 6) / 1.2), bsz = bsA >= 18 ? bsA : bs0, bY = bsA >= 18 ? (hudLow + mY - 50) / 2 : mY + 60 + 0.6 * bs0;
        if (ph < 1.0 && bY + 0.6 * bsz < H && !TUT.stop) { c.save(); c.globalAlpha = 1 - smooth((ph - 0.65) / 0.35); glyph("◆ SUPER ◆", W / 2, bY, bsz, "#9ff3ff"); c.restore(); hudBox.banner = { x: W / 2 - 2.7 * bsz, y: bY - 0.6 * bsz, w: 5.4 * bsz, h: 1.2 * bsz }; }
        if (!m.psup.tapped && (!TUT.on || (TUT.seen.hit && TUT.stop !== "sup"))) { meterDraw(c, m, W, H, glyph, m.psup.uNow || 0); }   // (the walk-through's from its stand at the net to the Super's step)
      }
      if (m.phase === "super" && m.sup.struck) {
        // the strike: one flash of gold from where it is (once, never a flicker), and its name over the courts, in gold
        var hu = gt - m.sup.hitT, qh = toS([m.sup.ball.x, m.sup.ball.y, m.sup.ball.z]) || [W / 2, H / 3];
        if (hu < 0.3) { var gr = c.createRadialGradient(qh[0], qh[1], 0, qh[0], qh[1], max(W, H) * 0.8); gr.addColorStop(0, "rgba(255,226,150," + (0.4 * (1 - hu / 0.3)).toFixed(3) + ")"); gr.addColorStop(1, "rgba(255,180,60,0)"); c.fillStyle = gr; c.fillRect(0, 0, W, H); }
        if (hu < 1.1) {
          var bs = min(W * 0.085, 46) * (1 + 0.25 * (1 - smooth(hu / 0.25))), ba = 1 - smooth((hu - 0.75) / 0.35);
          c.save(); c.globalAlpha = ba; glyph("◆ SUPER ◆", W / 2, max(hudLow + 40, H * 0.3), bs, "#ffd166"); c.restore();
          var bY2 = max(hudLow + 40, H * 0.3); hudBox.banner = { x: W / 2 - 2.7 * bs, y: bY2 - 0.6 * bs, w: 5.4 * bs, h: 1.2 * bs };   // (its box, for the tests)
        }
      }
    }
    if (input.stick) { var st = input.stick, L = min(60, hypot(st.dx, st.dy)), an = Math.atan2(st.dy, st.dx); glyph("○", st.x, st.y, 46); glyph("◆", st.x + Math.cos(an) * L, st.y + Math.sin(an) * L, 22, "#f3c98b"); }
    // the last ten courts: a square each, its number in it; filled while it plays on by itself, gold while he plays it,
    // outlined while it waits (the open one, the newest). They are the top (the artist, 28 Oct 2026: "Take out the
    // writing above the court numbers at the very top and just have the court number squares be the top"; the words
    // stay for a screen reader), in from the safe area as the words were, short of the Super button while it shows.
    var tr = document.querySelector(".top").getBoundingClientRect(), sb = $("super").getBoundingClientRect(), gap = 5, x0 = tr.left, y0 = tr.top;
    // (on a narrow screen in a match, beside the Super, fewer squares, each wide enough for its number)
    var right = sb.width ? min(tr.right, sb.left - 10) : tr.right, fs = courts.length > 99 ? 10 : 12, need = 0.61 * fs * String(courts.length).length + 6;
    // (the match's score beside them, always (the artist, 29 Oct 2026: "make sure that the score of the game is always
    // visible to the right of the court squares at the top"): his points in gold, Mr Plan's in his cyan, named; its room
    // first, the squares in what is left, no smaller than 20 px; on a screen too narrow for its names, the points alone)
    var sc = null;
    if (m) {
      var part = function (t, f, col) { c.font = "700 " + f + "px ui-monospace, SFMono-Regular, Menlo, monospace"; return { t: t, f: f, col: col, w: c.measureText(t).width }; };
      var full = [part("you ", 12, "#c9c6bd"), part(String(m.you), 18, "#ffd166"), part(" – ", 18, "#f2efe8"), part(String(m.them), 18, "#9ff3ff"), part(" Mr Plan", 12, "#c9c6bd")];
      var ws = function (ps) { return ps.reduce(function (a2, q2) { return a2 + q2.w; }, 0); };
      sc = right - x0 - ws(full) - 14 >= 20 ? full : full.slice(1, 4);
      sc = { parts: sc, w: ws(sc) }; right -= sc.w + 14; need = max(need, 20);
    }
    var cnt = min(10, courts.length, max(1, floor((right - x0 + gap) / (need + gap)))), sz = min(28, (right - x0 - 9 * gap) / 10);
    if (cnt < min(10, courts.length) || sz < need) { sz = min(28, (right - x0 - (cnt - 1) * gap) / cnt); }   // (fewer, or too small at a tenth of the room: the room shared by those shown)
    var n0 = max(0, courts.length - cnt);
    hudBox.strip = { x: x0, y: y0, w: cnt * (sz + gap) - gap, h: sz };
    courtButtons(n0, sz, gap, x0, y0);
    c.font = "600 " + fs + "px ui-monospace, SFMono-Regular, Menlo, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    courts.slice(n0).forEach(function (q, j) {
      var x = x0 + j * (sz + gap), on = m && m.k === q.k;
      if (q.up) { c.fillStyle = "rgba(236,236,228,0.92)"; c.fillRect(x, y0, sz, sz); }
      c.strokeStyle = on ? "#f3c98b" : "rgba(236,236,228,0.9)"; c.lineWidth = on ? 2 : 1; c.strokeRect(x + 0.5, y0 + 0.5, sz - 1, sz - 1);
      c.fillStyle = q.up ? "#1c1c1e" : "#f2efe8"; c.fillText(String(q.k + 1), x + sz / 2, y0 + sz / 2 + 0.5);
    });
    hudBox.score = null; if (!sc) { HUD.score = null; }   // (a new match's 0 - 0 comes in without a flash)
    if (sc) {
      // (a point won lights its number a moment)
      var key2 = m.you + ":" + m.them; if (HUD.score !== key2) { HUD.flash = HUD.score == null ? -9 : CUE.rt; HUD.score = key2; }
      var fl2 = CUE.rm ? 0 : max(0, 1 - (CUE.rt - HUD.flash) / 0.5), sx2 = hudBox.strip.x + hudBox.strip.w + 14, sy2 = y0 + sz / 2;
      c.textAlign = "left"; c.textBaseline = "middle";
      sc.parts.forEach(function (q2) {
        var f2 = q2.f === 18 && q2.t !== " – " ? q2.f * (1 + 0.3 * fl2) : q2.f;
        c.font = "700 " + f2 + "px ui-monospace, SFMono-Regular, Menlo, monospace"; c.lineWidth = 4; c.strokeStyle = "rgba(0,0,0,0.85)"; c.strokeText(q2.t, sx2, sy2); c.fillStyle = q2.col; c.fillText(q2.t, sx2, sy2); sx2 += q2.w;
      });
      hudBox.score = { x: hudBox.strip.x + hudBox.strip.w + 14, y: sy2 - 13, w: sc.w, h: 26, you: m.you, them: m.them, named: sc.parts.length === 5 };
    }
    var ly = max(y0 + max(sz, 26), sb.height ? sb.bottom - 8 : 0);   // (the words under the squares' buttons, and under the Super)
    hudLow = ly + 8;
    var sy = round(ly + 16) + "px"; if (sayEl.style.top !== sy) { sayEl.style.top = sy; }
    cueDraw(c, W, H, toS, glyph, m, sb);
    var o = 1 - gt / 0.6;
    if (o > 0) { c.fillStyle = "rgba(0,0,0," + o.toFixed(3) + ")"; c.fillRect(0, 0, W, H); }
  }

  /* ---- the loop -------------------------------------------------------------------------------------------------------
     One requestAnimationFrame at a time, its clock the game's own (gt, seconds): a frame's step is at most 50 ms, and
     YouTube's pause cancels the frame and stops the clock, so nothing catches up when it resumes. */
  var raf = 0, last = 0, frameDt = 0, readyTold = false, camOver = null, camPlain = false;
  function frame(now) {
    raf = 0;
    if (YT.paused) { return; }
    frameDt = last ? min(0.05, (now - last) / 1000) : 0; last = now;
    var raw = frameDt; CUE.rt += raw;
    if (tutHeld()) { frameDt = 0; } else { frameDt = raw; gt += frameDt; stepAll(frameDt); }
    draw();
    if (!readyTold) { readyTold = true; $("loading").hidden = true; YT.ready(); }   // (the loading words gone first: nothing left that cannot be played)
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && !YT.paused && me) { last = 0; raf = requestAnimationFrame(frame); } }   // (me: a resume while it loads waits for the courts)
  function stop() { if (raf) { cancelAnimationFrame(raf); } raf = 0; }
  function boot() {
    canvas = $("view"); hud = $("hud");
    gl = canvas.getContext("webgl2", { antialias: false, alpha: false, depth: true });
    if (!gl) { $("loading").textContent = "This game needs WebGL 2."; YT.firstFrame(); return; }
    // (a phone can take the GL context away, in the background or short of memory: asked back, all is built anew)
    canvas.addEventListener("webglcontextlost", function (e) { e.preventDefault(); stop(); });
    canvas.addEventListener("webglcontextrestored", function () {
      if (!body) { return; }
      try { sceneInit(); bodyMeshes(body); asc = null; ascInit(); } catch (x) { YT.warn(x); asc = null; }
      start();
    });
    // the first frame, before his body is built: black under the loading words (index.html), and told
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    requestAnimationFrame(function () { YT.firstFrame(); });
    YT.onPause(function () { stop(); inputClear(); save(); $("super").classList.remove("nudge"); });   // (paused, nothing moves: the Super's pulse too)
    YT.onResume(function () { if (asc) { asc.last = null; } superButton(); start(); });   // (the first frame after a resume holds nothing: drawn as a single frame is)
    var spec = window.PEARL_BODY ? Promise.resolve(window.PEARL_BODY) : fetch("../rocket/pearl-body.json").then(function (r) { return r.json(); });
    Promise.all([YT.init(), spec]).then(function (got) {
      body = PB.build(got[1]);
      rigInit(body, got[1]); sceneInit(); bodyMeshes(body); measure();
      try { ascInit(); } catch (e) { YT.warn(e); asc = null; }
      return YT.load();
    }).then(function (saved) {
      courtsInit(saved);
      me = athlete(palMe, 2.2, COURT.L + 5, 0, true);
      bindInput();
      courtWhere();
      if (!TUT.done && wonCount() === 0) { tutStart(); }
      else { say(STR.welcome, true); tip("move"); TIPS.from = [me.x, me.z]; }
      start();
    }).then(null, function (e) { YT.error(e); $("loading").textContent = "The courts could not be built."; });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }

  // For the tests: the state, and a way to step the game without the frames' clock.
  window.Pickleball = { debug: function () {
    // (draw: run() steps the camera once a step, as a frame does; a draw adds no step of its own)
    return { me: me, plans: plans, stands: stands, court: court, courts: courts, view: view, skill: nemSkill, won: wonCount, ASC: ASC, CAM: CAM, PSUP: PSUP, HARD: HARD,
             winCourt: function () { if (court.m) { court.m.you = COURT.WIN; levelWon(); } }, CAPS: CAPS, COURT: COURT, YT: YT, STR: STR,
             glyphs: asc && asc.glyphs, gt: function () { return gt; }, input: input, enter: function (k) { me.x = courtAt(k)[0] + 0.5; me.z = COURT.L - 1; },
             run: function (sec, fire) { var n = round(sec * 60); for (var i = 0; i < n; i += 1) { if (fire && i === 0) { input.fire = true; } CUE.rt += 1 / 60; if (tutHeld()) { continue; } gt += 1 / 60; stepAll(1 / 60); camera(1 / 60); } },
             draw: function () { frameDt = 0; draw(); }, pause: function (on) { if (on) { YT.paused = true; stop(); } else { YT.paused = false; start(); } },
             running: function () { return !!raf; }, pose: athPose, planContact: planContact, ascOk: function () { return !!(asc && asc.ok); },
             swing: function (a, c) { return athSwing(a, c, gt); }, split: function (a) { athSplit(a, gt); }, celebrate: function (a, w) { athCelebrate(a, w, gt); },
             step: function (a, sec) { for (var i = 0; i < round(sec * 60); i += 1) { gt += 1 / 60; athStep(a, 1 / 60, gt); } },
             meter: function () { var m = court.m; return !m ? null : m.phase === "plansuper" ? (m.psup.struck && !m.psup.tapped ? m.psup.uNow : null) : m.meterOn ? meterAt(m) : null; }, SERVE: SERVE, hud: function () { return hudBox; },
             serveSpot: function () { return court.m ? serveSpot() : null; },
             tipsSeen: function () { return TIPS.seen; }, courtGo: courtGo, tut: function () { return TUT; }, state: function () { return stateOf(); }, cue: function () { return CUE; },
             toScreen: function (p) { var vp = cur.vp, q = [0, 0, 0, 0]; for (var i = 0; i < 4; i += 1) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; } return q[3] > 0.05 ? [(q[0] / q[3] * 0.5 + 0.5) * canvas.clientWidth, (0.5 - q[1] / q[3] * 0.5) * canvas.clientHeight] : null; },
             newSuper: function () { if (court.m) { court.m.sup = { avail: true, armed: false }; superButton(); } },   // (a new game's, for the tests)
             // (the tests: run him to the serve's mark by the stick, as a player does, until the bar runs)
             toServe: function () {
               for (var i = 0; i < 600 && court.m && court.m.phase === "serve" && !court.m.meterOn; i += 1) {
                 var sp = serveSpot(), wx = sp[0] - me.x, wz = sp[1] - me.z, L = hypot(wx, wz), y = view.yaw, k = 60 * min(1, L / 1.5) / (L || 1);
                 input.stick = { id: -1, x: 0, y: 0, dx: (Math.cos(y) * wx + Math.sin(y) * wz) * k, dy: -(Math.sin(y) * wx - Math.cos(y) * wz) * k };
                 this.run(1 / 60);
               }
               input.stick = null; return !!(court.m && court.m.meterOn);
             },
             hide: function (on) { hideAth = on; }, fx: function () { return fx; }, camNow: function () { return { e: cur.eye.slice(), yaw: cur.yaw, pitch: cur.pitch }; },
             camAt: function (e, yaw, pitch, plain) { camOver = e && { e: e, yaw: yaw, pitch: pitch }; camPlain = !!plain; } };
  } };
})();
