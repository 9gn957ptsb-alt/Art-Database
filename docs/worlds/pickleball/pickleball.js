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
      var s = JSON.stringify(o);
      if (s.length > 3e6) { warn("pickleball: the save is over 3 MiB; not saved"); return Promise.resolve(); }
      if (inYT) { return me.noSave ? Promise.resolve() : Promise.resolve(call("saveData", function () { return y.game.saveData(s); })); }
      try { window.localStorage.setItem(KEY, s); } catch (e) { /* a private window: unsaved */ }
      return Promise.resolve();
    };
    me.score = function (n) {
      n = floor(n);
      if (!inYT || !(n > sent) || !Number.isSafeInteger(n)) { return; }
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
        if (m.reach === "leap" && a.air) { var sw = Math.sin((gt - m.up) * 14) * 0.25; f = [L.hip[0], 0.3, L.hip[2] + (lead ? -sw : sw)]; }   // the scissor kick
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
    var sm = null;
    if (m && gt >= m.t0 - 0.05 && gt < m.end) {
      var s1 = (gt - m.t0) / max(0.05, m.tc - m.t0), s2 = (gt - m.tc) / 0.34;
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
     The only way a frame reaches the screen. The scene is drawn into a picture of its own (colour with its octaves,
     and depth), and the picture is written again as characters: each a cell of the screen whose side goes as the
     square of nearness (the artist's own rule from the rocket world: 6 CSS px at 3.2 m, so a thing twice as near is
     written in characters four times as large), never under ASC.MIN CSS px (5 on a phone, 6 on a desk) and never
     the picture itself ("I also am over the pixel aesthetic"): far off, a thing is small characters, and the sky is
     characters too. A cell's colour is the picture's mean over it, its character chosen by its lightness from the set,
     lit in its colour and lifted (0.55 + 0.45 l, as Glyph Light lifts it), the light ones glowing, black between.
     The set is the prescription (the repo's notes, "Glyph Light, the texture"): Glyph Light's ASCII style with the
     keyboard's characters and the site's category marks together (the artist, 28 Oct 2026: "Do marks and keyboard
     characters"), one set sorted by the ink each leaves, measured here on the device, since fonts differ. Mr Pearl's
     head marks its pixels (alpha 0.5) and passes through as it is. */
  var ASC = { SET: " .:-=+*#%@∴∵→○◇△◎¶▢◆", S0: 6, D0: 3.2, MAXPX: 32, expo: 1.45, contr: 1.1, gam: 0.8, lit: 1.4, glow: 0.5, thresh: 0.72 };
  var asc = null;
  function ascInit() {
    var chars = ASC.SET.split(""), font = "700 52px ui-monospace, SFMono-Regular, Menlo, 'DejaVu Sans Mono', 'Noto Sans Symbols 2', monospace";
    var ink = function (ch) {
      if (ch === " ") { return 0; }
      var t = document.createElement("canvas"); t.width = t.height = 64; var tc = t.getContext("2d");
      tc.fillStyle = "#000"; tc.fillRect(0, 0, 64, 64); tc.font = font; tc.textAlign = "center"; tc.textBaseline = "middle"; tc.fillStyle = "#fff"; tc.fillText(ch, 32, 35);
      var d = tc.getImageData(0, 0, 64, 64).data, s = 0; for (var k = 0; k < d.length; k += 4) { s += d[k]; }
      return s;
    };
    var list = chars.map(function (ch) { return { ch: ch, ink: ink(ch) }; }).sort(function (a, b) { return a.ink - b.ink; });
    var cv = document.createElement("canvas"); cv.width = 64 * list.length; cv.height = 64;
    var c = cv.getContext("2d"); c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, 64);
    c.font = font; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff";
    list.forEach(function (q, i) { if (q.ch !== " ") { c.fillText(q.ch, i * 64 + 32, 35); } });
    var atlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, atlas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    var prog = compile("#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }", [
      "#version 300 es",
      "precision highp float;",
      "uniform sampler2D uScene; uniform sampler2D uDepth; uniform sampler2D uAtlas;",
      "uniform vec2 uRes; uniform float uNear, uFar, uS0, uD0, uMinL, uMaxL, uN, uExpo, uContr, uGam, uLit, uGlow, uThresh;",
      "out vec4 o;",
      "float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "void main() {",
      "  ivec2 ip = ivec2(gl_FragCoord.xy);",
      "  vec4 pic = texelFetch(uScene, ip, 0);",
      "  if (pic.a > 0.25 && pic.a < 0.75) { o = vec4(pic.rgb, 1.0); return; }",       // his head, the one thing as it is
      "  float z = texelFetch(uDepth, ip, 0).r;",
      "  float d = z >= 1.0 ? 1e4 : 2.0 * uNear * uFar / (uFar + uNear - (z * 2.0 - 1.0) * (uFar - uNear));",
      "  float s = uS0 * (uD0 / d) * (uD0 / d);",
      "  float L = clamp(floor(log2(max(s, 1.0)) + 0.5), uMinL, uMaxL), cs = exp2(L);",
      "  vec2 cell = floor(gl_FragCoord.xy / cs), uv = (gl_FragCoord.xy - cell * cs) / cs;",
      "  vec2 at = (cell + 0.5) * cs / uRes;",
      "  vec3 c = textureLod(uScene, at, L).rgb;",
      "  c = pow(clamp((c * uExpo - 0.5) * uContr + 0.5, 0.0, 1.0), vec3(1.0 / uGam));",
      "  float l = lum(c);",
      "  float gi = min(floor(l * uN), uN - 1.0), cov = 0.0;",
      "  if (gi > 0.0) { cov = textureLod(uAtlas, vec2((gi + uv.x) / uN, 1.0 - uv.y), max(0.0, 6.0 - L)).r; }",
      "  vec3 lit = min(vec3(1.0), c / (0.55 + 0.45 * l));",
      "  vec3 g = lit * cov * uLit;",
      "  if (l >= uThresh) { g += lit * cov * uGlow * 0.6; }",
      "  vec3 hal = textureLod(uScene, gl_FragCoord.xy / uRes, L + 2.5).rgb;",
      "  g += hal * uGlow * 0.45 * smoothstep(uThresh, min(1.0, uThresh + 0.2), lum(hal));",
      "  o = vec4(g, 1.0);",
      "}"].join("\n"));
    var U = {};
    ["uScene", "uDepth", "uAtlas", "uRes", "uNear", "uFar", "uS0", "uD0", "uMinL", "uMaxL", "uN", "uExpo", "uContr", "uGam", "uLit", "uGlow", "uThresh"].forEach(function (k) { U[k] = gl.getUniformLocation(prog, k); });
    asc = { prog: prog, U: U, atlas: atlas, N: list.length, glyphs: list.map(function (q) { return q.ch; }).join(""), fb: null, ok: true, w: 0, h: 0 };
  }
  function ascBegin(w, h) {
    if (!asc || !asc.ok) { return false; }
    if (!asc.fb || asc.w !== w || asc.h !== h) {
      if (asc.fb) { gl.deleteFramebuffer(asc.fb); gl.deleteTexture(asc.col); gl.deleteTexture(asc.dep); }
      var col = gl.createTexture(), dep = gl.createTexture(), fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, col);
      gl.texStorage2D(gl.TEXTURE_2D, floor(Math.log2(max(w, h))) + 1, gl.RGBA8, w, h);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, dep);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dep, 0);
      asc.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      asc.fb = fb; asc.col = col; asc.dep = dep; asc.w = w; asc.h = h;
      if (!asc.ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); return false; }   // (a device without it: the scene straight to the screen)
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, asc.fb);
    return true;
  }
  function ascEnd(w, h, dpr) {
    var U = asc.U, minPx = min(window.innerWidth, window.innerHeight) < 600 ? 5 : 6;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, asc.col); gl.generateMipmap(gl.TEXTURE_2D);
    gl.viewport(0, 0, w, h);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND);
    gl.useProgram(asc.prog); gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, asc.col); gl.uniform1i(U.uScene, 2);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, asc.dep); gl.uniform1i(U.uDepth, 3);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, asc.atlas); gl.uniform1i(U.uAtlas, 4);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uNear, NEAR); gl.uniform1f(U.uFar, FAR);
    var md = ascMod || {};   // (the super return plays with the pass: its density, exposure and glow, for a moment)
    gl.uniform1f(U.uS0, ASC.S0 * dpr * (md.s0 || 1)); gl.uniform1f(U.uD0, ASC.D0);
    gl.uniform1f(U.uMinL, round(Math.log2(minPx * dpr))); gl.uniform1f(U.uMaxL, round(Math.log2(ASC.MAXPX * dpr)));
    gl.uniform1f(U.uN, asc.N); gl.uniform1f(U.uExpo, ASC.expo * (md.expo || 1)); gl.uniform1f(U.uContr, ASC.contr); gl.uniform1f(U.uGam, ASC.gam);
    gl.uniform1f(U.uLit, ASC.lit); gl.uniform1f(U.uGlow, md.glow != null ? md.glow : ASC.glow); gl.uniform1f(U.uThresh, md.thresh != null ? md.thresh : ASC.thresh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---- the scene ---------------------------------------------------------------------------------------------------
     Plain solids, plainly lit, for the pass to write as characters: the courts at night under their floodlights (glyphs
     glow best on dark), his body's cells (no bars: the unit is the character now), the pearl. */
  var gl = null, canvas = null, hud = null, solid = null, SU = {}, skyP = null, KU = {}, headP = null, HU = {};
  var cube = null, parts = {}, partsFar = {}, ballMesh = null, headBall = null, palMe = null, palPlan = null;
  var FOV = 70, NEAR = 0.08, FAR = 500, T35 = Math.tan(FOV * PI / 360), KEY = norm([0.3, 0.9, 0.42]);
  var SKY = { zen: [0.012, 0.016, 0.05], hor: [0.07, 0.085, 0.17], gnd: [0.05, 0.07, 0.06] };
  function compile(vs, fs) {
    var mk = function (type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); } return s; };
    var p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    return p;
  }
  function sceneInit() {
    solid = compile([
      "#version 300 es",
      "layout(location = 0) in vec3 aP; layout(location = 1) in vec3 aN; layout(location = 2) in float aI;",
      "uniform mat4 uVP; uniform mat4 uM;",
      "out vec3 vN; out vec3 vW; flat out int vI;",
      "void main() { vec4 w = uM * vec4(aP, 1.0); vW = w.xyz; vN = mat3(uM) * aN; vI = int(aI + 0.5); gl_Position = uVP * w; }"].join("\n"), [
      "#version 300 es",
      "precision highp float;",
      "uniform vec4 uPal[64]; uniform vec3 uCol; uniform int uUse; uniform vec3 uKey; uniform vec3 uEye; uniform float uEmit; uniform vec3 uFog;",
      "in vec3 vN; in vec3 vW; flat in int vI; out vec4 o;",
      "void main() {",
      "  vec3 base = uUse == 1 ? uPal[vI].rgb / 255.0 : uCol;",
      "  vec3 n = normalize(vN), v = normalize(uEye - vW);",
      "  float k = max(dot(n, uKey), 0.0), rim = pow(1.0 - abs(dot(n, v)), 3.0);",
      "  vec3 c = base * (0.5 + 0.95 * k + uEmit) + (base * 0.5 + 0.12) * rim * (1.0 - uEmit);",
      "  c = mix(c, uFog, clamp((length(vW - uEye) - 70.0) / 320.0, 0.0, 0.8));",
      "  o = vec4(c, 1.0);",
      "}"].join("\n"));
    ["uVP", "uM", "uPal", "uCol", "uUse", "uKey", "uEye", "uEmit", "uFog"].forEach(function (k) { SU[k] = gl.getUniformLocation(solid, k); });
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
  var cur = { vp: null, eye: [0, 0, 0] }, cine = null, ascMod = null, slow = 1;   // (cine, ascMod, slow: the super return's camera, pass and time)
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
    var far = hypot(a.x - cur.eye[0], a.z - cur.eye[2]) > 26, P = far ? partsFar : parts, pal = a.pal;
    gl.uniform4fv(SU.uPal, pal); gl.uniform1i(SU.uUse, 1); gl.uniform1f(SU.uEmit, 0);
    Object.keys(pose.parts).forEach(function (n) { if (P[n] && !(bare && n === "hat")) { gl.uniformMatrix4fv(SU.uM, false, pose.parts[n]); gl.bindVertexArray(P[n].vao); gl.drawArrays(gl.TRIANGLES, 0, P[n].n); } });
    gl.uniformMatrix4fv(SU.uM, false, pose.guitar); gl.bindVertexArray(P.guitar.vao); gl.drawArrays(gl.TRIANGLES, 0, P.guitar.n);
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
    match: function (k, l) { return "Court " + k + ", level " + l + " against Mr Plan: first to three. Your serve."; },
    meterHint: "tap to stop it · further is harder · ◆ a chance at an ace",
    head: function (m) {
      var lv = m.balls.filter(function (q) { return !q.dead; }), r = lv.reduce(function (a, q) { return max(a, q.rally); }, 0);
      return "Court " + (m.k + 1) + " · level " + m.level + " · you " + m.you + " – " + m.them + " Mr Plan" + (lv.length > 1 ? " · " + lv.length + " pearls" : "") + " · rally " + r + " · " + STR.wonN(wonCount());
    },
    long: "The serve went long.", kitchenVolley: "A volley from the kitchen: a fault.", kitchenVolleyPlan: "Mr Plan volleys from the kitchen: a fault.", ace: "An ace: Mr Plan never got to it.", aceZone: "The ace zone: hard into the deep corner.",
    superArmed: "Super return ready: the next pearl Mr Plan sends you is yours. Super again keeps it for later.", superKept: "Super return kept for later.",
    superUsed: "Your super return is spent this game.", superWon: "Super return.",
    net: "Into the net.", netPlan: "Mr Plan puts it into the net.", kitchen: "The serve fell in the kitchen.", out: "Out.", outPlan: "Mr Plan hits it out.",
    twice: "It bounced twice: you did not reach it.", twicePlan: "Twice on its side: Mr Plan did not reach it.",
    rally: function (y, t, r) { return y + " – " + t + ", a rally of " + r + "."; },
    planTakes: function (t, y) { return "Mr Plan takes it, " + t + " – " + y + ". Again from love: serve."; },
    won: function (k, y, t) { return "Court " + (k + 1) + " won, " + y + " – " + t + ". It plays on by itself and keeps winning. Court " + (k + 2) + " is open beside it, harder."; },
    standin: function (k, y, t) { return "Your stand-in is playing court " + (k + 1) + ", " + y + " – " + t + ", and keeps winning."; }
  };
  var sayT = 0;
  function say(t, keep) { var e = $("say"); if (e.textContent !== t) { e.textContent = t; } e.style.opacity = "1"; sayT = gt + (keep ? 6 : 3.5); }
  // The courts: every one won and the one open, the newest, beside the last won; court k is level k + 1. A save from any
  // version, or none, is read field by field as counts, or as a fresh start: the first version's ten courts as the run
  // of them won from the first (its horse and its levels go: the courts are endless now, and each is its own level).
  function count(x, d) { x = +x; return isFinite(x) && x >= 0 ? floor(x) : d; }
  function courtsInit(saved) {
    if (!saved || typeof saved !== "object") { saved = {}; }
    var won = count(saved.won, -1);
    if (won < 0) { won = 0; if (Array.isArray(saved.courts)) { while (saved.courts[won] && saved.courts[won].won === true) { won += 1; } } }
    courts = [];
    for (var k = 0; k <= min(won, 999); k += 1) { courtAdd(); courts[k].won = courts[k].up = k < won; }
    courts.best = count(saved.rally != null ? saved.rally : saved.best, 0);   // (the longest rally: the first version kept it as "best")
  }
  function courtAdd() {
    var k = courts.length, cc = courtAt(k);
    courts.push({ k: k, level: k + 1, won: false, up: false, you: 0, them: 0, next: gt + 4 + k % 4, t0: gt, i: -1 });
    plans.push(athlete(palPlan, cc[0], cc[2] - COURT.L - 0.6, PI, false));
    stands.push(athlete(palMe, cc[0], cc[2] + COURT.L - 0.5, 0, true));
  }
  function wonCount() { return courts.length - 1; }   // (every court but the open one; the score)
  function stateOf() { return { v: 2, won: wonCount(), rally: courts.best }; }
  function save() { if (courts) { YT.save(stateOf()); } }
  // The courts won play on wherever he is, and keep winning (the artist: "Previous courts still automatically play and
  // you win each game as you advance"): a point every four to eight seconds, Mr Plan taking some, never the third.
  function courtsSim(dt) {
    courts.forEach(function (c) {
      if (!c.up || gt < c.next) { return; }
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
     the courts to measure what that makes of them. */
  var HARD = { K: 3,
    one:  { wait: 0.42, err: 0.26, T: 1.25, dive: 0.5, lunge: 0.82, flair: 0.14, lob: 0.1, wide: 0.4, deep: 3.6, dink: 0, ace: 0.8, sweep: 1.15 },
    most: { wait: 0.125, err: 0.066, T: 0.845, dive: 0.89, lunge: 0.96, flair: 0.24, lob: 0.21, wide: 2.13, deep: 6.15, dink: 0.29, ace: 0.31, sweep: 0.71 } };
  function hardness(level) { return 1 - Math.exp(-(max(1, level) - 1) / HARD.K); }
  function nemSkill(level) {
    var h = hardness(level), o = {};
    Object.keys(HARD.one).forEach(function (k) { o[k] = HARD.one[k] + (HARD.most[k] - HARD.one[k]) * h; });
    o.dink = HARD.most.dink * max(0, (h - 0.2) / 0.8);   // (none on court one, the first on court three)
    return o;
  }
  function matchOn(k) {
    var c = courts[k];
    court.m = { k: k, level: c.level, sk: nemSkill(c.level), you: 0, them: 0, n: 0, phase: "serve", t: gt, pc: null, nc: null, replan: 0,
                balls: [], tosses: [], served: 0, pts: 0, stops: [], meterOn: false, meterT0: 0, serveOpen: 0, nextId: 1, scoped: false, lastTc: -9,
                sup: { avail: true, armed: false } };
    superButton();
    var pl = plans[k]; pl.want = null;
    say(STR.match(k + 1, c.level), true);
    courtWhere();
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
  function ballLands(b, k) { var q = copyBall(b); for (var i = 0; i < 300; i += 1) { var at = ballStep(q, k, 1 / 60); if (at) { return { x: at[0], z: at[1] }; } } return null; }
  function mayVolley(b, m, z) { return b.rally >= 3 && abs(z - courtAt(m.k)[2]) > COURT.K; }
  // Where an athlete on side (+1 his, -1 Mr Plan's) can meet the pearl b next: the flight stepped ahead on a copy, every
  // 1/90 s for up to 2.4 s; the contacts the rules allow (on his side, coming to him, after its bounce, or on the volley
  // where a volley may be, before a second bounce); the one his body reaches at least cost. run(t): what his legs can
  // add first (nought for the player, who runs himself).
  function planContact(a, b, side, run, only) {
    var m = court.m, cc = courtAt(m.k), q = copyBall(b), t = 0, bounces = b.bounces, best = null, h = 1 / 90;
    for (var i = 0; i < 216; i += 1) {
      var at = ballStep(q, m.k, h); t += h;
      if (q.net) { break; }
      if (at) { if (side * (at[1] - cc[2]) <= 0) { break; } bounces += 1; if (bounces >= 2) { break; } }
      if (side * (q.z - cc[2]) < 0.1 || side * q.vz <= 0) { continue; }
      // (a volley only where one may be, and from outside the kitchen: his feet, where he stands now, and the pearl
      // far enough out that the stroke's last steps keep them out)
      if (bounces === 0 && !(mayVolley(b, m, q.z) && abs(a.z - cc[2]) > COURT.K && abs(q.z - cc[2]) > COURT.K + 0.4)) { continue; }
      var p = [q.x, q.y, q.z], r = reachOf(a, t, p, run, only);
      if (r && (!best || r.cost + 0.25 * t < best.cost + 0.25 * best.t)) { best = { t: t, p: p, reach: r.reach, cost: r.cost, volley: bounces === 0, ball: b }; }
    }
    return best;
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
     the bar depends on how hard you serve"). At his serve the view is the Scope's (his head the glass, his nose the
     aim: where it looks, inside the diagonal service court, the serve goes), and a bar runs under it, a mark sweeping
     it back and forth; a tap stops it, and where it stops is how hard he serves: too soft and the pearl falls in the
     kitchen (a fault); then softer to harder, the harder the deeper and quicker; a narrow gold zone, the ace zone, sends
     it hard into the deep corner, where Mr Plan may not get it at all; past the end it goes long. After each pearl the
     mark sweeps again: up to three pearls in a serve, each a point of its own, played at once, while the serve is open
     (until 1.3 s after the last); then the view is the third person's again. */
  var SERVE = { SOFT: 0.12, ACE: [0.72, 0.84], LONG: 0.94, MAX: 3, OPEN: 1.3, GAP: 0.34 };
  function servePeriod(m) { return m.sk.sweep; }   // the sweep, there and back half of it: quicker each court
  function meterAt(m) { var u = ((gt - m.meterT0) / servePeriod(m)) % 2; return u < 1 ? u : 2 - u; }
  function aceChance(m) { return m.sk.ace; }   // (an opportunity, not a gift: four in five on court one, less each court)
  function serveTap(m) {
    if (m.served + m.tosses.length >= SERVE.MAX || (m.pc && m.phase === "rally")) { return; }
    var u = meterAt(m), last = m.tosses.length ? m.tosses[m.tosses.length - 1].tc : m.lastTc || -9, tc = max(gt + 0.3, last + SERVE.GAP);
    m.tosses.push({ u: u, tc: tc, t0: tc - 0.3 });
    m.meterT0 = gt; m.stops.push(u);
    athSwing(me, { tc: tc, p: serveFrom(), kind: "serve", aim: [0, 0, -1] }, gt);
    if (m.phase === "serve") { m.phase = "toss"; }
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
    var lz = b.z - cc[2], lx = b.x - cc[0], tz = -depth, tx = lx + Math.tan(view.yaw) * (lz - tz);
    tx = ace ? side * (COURT.HW - 0.35) : side * clampV(side * tx, 0.3, COURT.HW - 0.3);
    shoot(b, m.k, tx, tz, Tf);
    b.ace = ace && rng() < aceChance(m);
    m.balls.push(b); m.served += 1; m.lastTc = toss.tc;
    m.serveOpen = gt + SERVE.OPEN;
    if (ace) { say(STR.aceZone); }
    athSplit(plans[m.k], gt);
  }
  // (the serve's Scope looks level across the net, at the far service court, so his own body is under the view; back
  // in the third person the look comes to rest again)
  function scopeAuto(on) {
    if (on && !view.scope) { scopeSet(true); court.m.scoped = true; view.pitch = -0.06; view.yaw = 0; }
    else if (!on && court.m.scoped) { court.m.scoped = false; if (view.scope) { scopeSet(false); view.pitch = REST; } }
  }
  // A point, on one pearl: it is dead; the other pearls play on. The match ends the moment it is won or lost.
  function pointBall(m, b, toYou, why) {
    if (b.dead) { return; }
    b.dead = true; b.deadT = gt; b.mark = null;
    if (m.pc && m.pc.ball === b) { m.pc = null; }
    if (m.nc && m.nc.ball === b) { m.nc = null; }
    if (toYou) { m.you += 1; } else { m.them += 1; }
    m.pts += 1;
    if (b.rally > courts.best) { courts.best = b.rally; }   // (the longest rally, kept with the next save; the score is the courts)
    say(why + " " + STR.rally(m.you, m.them, b.rally));
    var over = m.you >= COURT.WIN || m.them >= COURT.WIN;
    if (over) { m.balls.forEach(function (q) { if (!q.dead) { q.dead = true; q.deadT = gt; q.mark = null; } }); m.tosses = []; m.pc = m.nc = null; }
    if (over || !live(m).length) { athCelebrate(toYou ? me : plans[m.k], true, gt); athCelebrate(toYou ? plans[m.k] : me, false, gt); }
    courtWhere();
  }
  function matchStep(dt, c) {
    var m = court.m, cc = courtAt(m.k), pl = plans[m.k], fire = c.fire;
    if (m.phase === "super") { superStep(m, dt); return; }
    if (m.phase === "serve") {
      // (he is taken to his serve at his own pace; there, the Scope comes up and the bar runs)
      var sp = serveSpot(); me.want = { to: sp }; me.faceTo = m.n % 2 ? 0.12 : -0.12;
      pl.want = { to: [cc[0], cc[2] - COURT.L - 0.6] }; pl.faceTo = PI;
      if (!m.meterOn && hypot(me.x - sp[0], me.z - sp[1]) < 0.35 && me.speed < 1.5) { m.meterOn = true; m.meterT0 = gt; scopeAuto(true); }
      if (m.meterOn) { me.want = { vel: [0, 0] }; if (fire) { serveTap(m); } }
    } else if (m.phase === "toss" || m.phase === "rally") {
      if (m.meterOn && fire && gt < m.serveOpen) { serveTap(m); }
      if (m.tosses.length) { me.want = { vel: [0, 0] }; }
    }
    // the pearls tossed and struck, each at its stroke's contact
    while (m.tosses.length && gt >= m.tosses[0].tc) { serveBall(m, m.tosses.shift()); if (m.phase === "toss") { m.phase = "rally"; } }
    if (m.meterOn && m.phase === "rally" && !m.tosses.length && (gt >= m.serveOpen || m.served >= SERVE.MAX)) { m.meterOn = false; scopeAuto(false); }
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
      if (m.sup.armed && superStart(m)) { return; }
      mine(m); plans_(m, pl);
      if (!live(m).length && !m.tosses.length) { m.phase = "point"; m.t = gt; if (m.meterOn) { m.meterOn = false; scopeAuto(false); } }
    } else if (m.phase === "point" && gt - m.t >= 1.4) {
      m.balls = [];
      if (m.you >= COURT.WIN) { levelWon(); return; }
      if (m.them >= COURT.WIN) { say(STR.planTakes(m.them, m.you), true); m.you = m.them = 0; m.sup = { avail: true, armed: false }; superButton(); }   // (a new game: a new super return)
      m.n += max(1, m.pts); m.pts = 0; m.served = 0; m.stops = []; m.phase = "serve"; courtWhere();
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
  function mine(m) {
    var cc = courtAt(m.k), lv = live(m).filter(function (q) { return q.last === "them"; });
    if (lv.length) { var f = lv[0]; me.faceTo = clampV(Math.atan2(f.x - me.x, -(f.z - me.z)), -1.2, 1.2); }
    if (!m.pc && !m.tosses.length) {
      var best = null;
      lv.forEach(function (b) { var c = planContact(me, b, 1, runOf(1e9)); if (c && (!best || c.t < best.t)) { best = c; } });
      if (best && best.t <= leadOf(best, WIND[strokeKind(best)]) + 0.02) {
        var c = best; c.kind = strokeKind(c); c.tc = gt + c.t; m.pc = c; c.aimAt = aimPoint(m, c); c.aim = norm([c.aimAt[0] - c.p[0], 0.35, c.aimAt[1] - c.p[2]]); athSwing(me, c, gt);
      }
    }
    // (a stroke standing: the last steps in to it are his own, the pearl on his right, so the stroke meets it)
    if (m.pc && (m.pc.reach === "stand" || m.pc.reach === "dig")) { me.want = { to: [m.pc.p[0] - 0.55, m.pc.p[2] + 0.35] }; }
    if (m.pc && gt >= m.pc.tc) {
      var pc = m.pc, b = pc.ball; m.pc = null;
      if (b.dead || b.last !== "them") { return; }
      if (b.bounces === 0 && abs(me.z - cc[2]) < COURT.K) { pointBall(m, b, false, STR.kitchenVolley); return; }   // (the rule: no volley from the kitchen)
      shoot(b, m.k, pc.aimAt[0] - cc[0], pc.aimAt[1] - cc[2], pc.kind === "overhead" ? 0.75 : pc.kind === "dig" ? 1.3 : 1.05);
      b.last = "you"; b.bounces = 0; b.serve = false; b.rally += 1; b.nemAt = gt + m.sk.wait; b.mark = null;
      var fl = rng(); b.flair = fl < m.sk.flair ? "dive" : fl < 2 * m.sk.flair ? "lunge" : null;
      athSplit(plans[m.k], gt);
    }
  }
  // Where his return goes: the view's way, deep, as the rocket world aimed it (the far baseline less up to 1.6 m).
  function aimPoint(m, c) {
    var cc = courtAt(m.k), lz = c.p[2] - cc[2], lx = c.p[0] - cc[0], dz = -(COURT.L - 0.6 - 1.6 * rng());
    return [cc[0] + clampV(lx + Math.tan(view.yaw) * (lz - dz), -COURT.HW + 0.3, COURT.HW - 0.3), cc[2] + dz];
  }
  // Mr Plan's: after his wait he reads the pearls, runs to where he will meet the soonest he can (his legs' reach
  // added), and strokes: away from Mr Pearl, deeper and wider as his level is, a dink into the kitchen, a lob; now and
  // then out, or into a dive that does not get there. One body: two pearls close together, and one may get by him. An
  // ace (the serve's gold zone, and his luck) he goes for at full stretch and does not reach.
  function plans_(m, pl) {
    var cc = courtAt(m.k), sk = m.sk, lv = live(m).filter(function (q) { return q.last === "you" && gt >= q.nemAt; });
    if (!m.nc && lv.length && gt >= m.replan) {
      m.replan = gt + 0.08;
      var best = null;
      lv.forEach(function (b) {
        var only = b.ace ? { dive: 1, lunge: 1, leap: 1 } : b.flair === "dive" ? { dive: 1, leap: 1 } : b.flair === "lunge" ? { lunge: 1, leap: 1 } : null;
        var c = (only && planContact(pl, b, -1, runOf(0), only)) || planContact(pl, b, -1, runOf(0));
        if (c && (!best || c.t < best.t)) { best = c; }
      });
      if (best) {
        var c = best, b = c.ball, ux = c.p[0] - pl.x, uz = c.p[2] - pl.z, ul = hypot(ux, uz) || 1;
        // (stand off from the contact by most of his reach, the pearl on his right: his right is -x, facing +z)
        pl.want = { to: [c.p[0] + 0.55, c.p[2] - 0.35] };
        if (c.t <= leadOf(c, 0.28) + 0.02) {
          c.kind = strokeKind(c); c.tc = gt + c.t;
          c.miss = b.ace || (c.reach === "dive" && rng() > sk.dive) || (c.reach === "lunge" && rng() > sk.lunge);
          var plx = me.x - cc[0], wx = clampV(-Math.sign(plx || 1) * sk.wide + (rng() - 0.5) * 0.8, -COURT.HW + 0.25, COURT.HW - 0.25), wz = min(COURT.L - 0.3, sk.deep + (rng() - 0.5)), Tf = sk.T;
          var pick = rng();
          if (pick < sk.dink) { wz = COURT.K * (0.35 + 0.5 * rng()); Tf = sk.T + 0.25; c.kind = c.kind === "drive" ? "dink" : c.kind; }
          else if (pick < sk.dink + sk.lob) { wz = COURT.L - 0.6 - 0.8 * rng(); Tf = 1.9 + 0.3 * rng(); }   // a lob: high, deep, to be leapt for
          var e = rng();
          if (e < sk.err) { if (e < sk.err / 2) { wz = COURT.L + 0.5 + 0.8 * rng(); } else { wx = Math.sign(wx || 1) * (COURT.HW + 0.4 + 0.6 * rng()); } }
          c.shot = [wx, wz, Tf]; c.aim = norm([wx + cc[0] - c.p[0], 0.35, wz + cc[2] - c.p[2]]);
          if (c.miss) { var off = c.reach === "dive" ? 0.9 : 0.5; c.p = [c.p[0] - ux / ul * off, c.p[1], c.p[2] - uz / ul * off]; }
          m.nc = c; athSwing(pl, c, gt);
        }
      }
    }
    if (m.nc && gt >= m.nc.tc) {
      var nc = m.nc, nb = nc.ball; m.nc = null;
      if (nc.miss || nb.dead || nb.last !== "you") { return; }   // (the dive or the lunge did not get there: the pearl goes on)
      if (nb.bounces === 0 && abs(pl.z - cc[2]) < COURT.K) { pointBall(m, nb, true, STR.kitchenVolleyPlan); return; }
      shoot(nb, m.k, nc.shot[0], nc.shot[1], nc.shot[2]);
      nb.last = "them"; nb.bounces = 0; nb.serve = false; nb.rally += 1;
      var L0 = ballLands(nb, m.k); nb.mark = L0 && { x: L0.x, z: L0.z };
      athSplit(me, gt);
    }
  }
  function levelWon() {
    var m = court.m, c = courts[m.k];
    c.won = true; c.up = true; c.you = c.them = 0; c.t0 = gt; c.next = gt + 4; c.i = -1;
    court.m = null; court.told[m.k + "u"] = 1;
    stands[m.k].x = courtAt(m.k)[0] + 1.5; stands[m.k].z = COURT.L + 0.5;   // (his stand-in comes on behind him)
    if (m.k === courts.length - 1) { courtAdd(); }   // (the next court appears beside it)
    say(STR.won(m.k, m.you, m.them), true);
    save(); YT.score(wonCount()); courtWhere();   // (saved first: the best sent must be the save's)
  }
  // Between matches: walking, and onto a court its match (if it is open and not playing by itself).
  function courtStep(dt, c) {
    courtsSim(dt);
    var m = court.m;
    if (m && (m.phase === "serve" || m.phase === "toss")) { /* (he is taken to his serve) */ }
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
      // (shot i is struck at t0 + 1.3 i, the even ones by the stand-in from his baseline, the odd by Mr Plan from his;
      // when one is struck, the other splits, runs to where the next is met and winds up to meet it then)
      var u = (gt - cv.t0) / 1.3, i = floor(u), ax = function (j) { return cc[0] + Math.sin(j * 1.7 + k) * 1.6; };
      if (i !== cv.i && i >= 0) {
        cv.i = i;
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
    for (var k = 0; k < courts.length; k += 1) { athStep(plans[k], dt, gt); if (courts[k].up) { athStep(stands[k], dt, gt); } }
    // dust where a skid plants its foot, and where a dive lands
    [me].concat(plans).forEach(function (a) {
      if (a.skid > 0.5 && dust.length < 60 && rng() < 0.7) { dust.push({ x: a.x + (rng() - 0.5) * 0.3, y: 0.05, z: a.z + (rng() - 0.5) * 0.3, vx: -a.vx * 0.15 + (rng() - 0.5), vy: 0.6 + rng(), vz: -a.vz * 0.15 + (rng() - 0.5), t: gt }); }
    });
    dust = dust.filter(function (d) { d.vy -= 3 * dt; d.x += d.vx * dt; d.y = max(0.02, d.y + d.vy * dt); d.z += d.vz * dt; return gt - d.t < 0.7; });
    input.fire = false;   // (a tap is spent on the frame that reads it)
    // (the words step aside while the serve's bar runs: the bar carries its own, and they would cover it on a short screen)
    var sayOn = gt <= sayT && !(court.m && court.m.meterOn) ? "1" : "0"; if ($("say").style.opacity !== sayOn) { $("say").style.opacity = sayOn; }
  }

  /* ---- the views and the hands ----------------------------------------------------------------------------------
     His own views (the artist, 28 Oct 2026: "maintain the perspectives of Mr Pearl to play"): the third person behind
     his head, as far as the rocket world stands it (his whole figure a third of the screen's height at rest), now on a
     spring so that his bursts read (it lags a little, never jerks), and the Scope, his head the glass and his nose the
     aim, its mark written in characters (the tribar that marked it is gone with the unit). */
  var PHI = (1 + Math.sqrt(5)) / 2, AIM = Math.atan(T35 / 2), REST = -Math.atan(T35 / 3), TP = {};
  var view = { yaw: 0, pitch: REST, scope: false, camT: -9, from: null, e: null, ev: [0, 0, 0] };
  // His figure a quarter of the screen's height at rest, where the rocket world has a third (the artist, 28 Oct 2026:
  // "The third person view should be a little farther out for Pickleball given the speed in which Mr. Pearl can now
  // move"): the camera a third again as far, so a sprint stays in the picture.
  TP.FRAC = 1 / 4;
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
    TP.VIEW = top / 4.3;   // a switch of view: the time he walks his own height
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
  function clampPitch(p) { return view.scope ? clampV(p, -1.2, 1.2) : clampV(p, TP.DOWN, TP.UP); }
  function camera(dt) {
    var hd = [me.x, body.head.centre[1] + min(me.y, 0.6) * 0.5, me.z], f = lookDir(view.yaw, view.pitch - AIM);
    var tp = [hd[0] - f[0] * TP.HEAD, hd[1] - f[1] * TP.HEAD, hd[2] - f[2] * TP.HEAD];
    if (!view.e) { view.e = tp.slice(); }
    for (var i = 0; i < 3; i += 1) { var o = { x: view.e[i], xv: view.ev[i] }; spring(o, "x", tp[i], dt, 11); view.e[i] = o.x; view.ev[i] = o.xv; }
    var e = view.e;
    if (view.scope) { var d = lookDir(view.yaw, view.pitch), h = me.pose ? me.pose.headC : hd; e = [h[0] - d[0] * PHI, max(0.15, h[1] - d[1] * PHI), h[2] - d[2] * PHI]; }
    var s = smooth((gt - view.camT) / TP.VIEW);
    if (view.from && s < 1) { e = lerp3(view.from, e, s); }
    return e;
  }
  function scopeSet(on) {
    if (on == null) { on = !view.scope; }
    if (on === view.scope) { return; }
    view.from = cur.eye.slice(); view.camT = gt; view.scope = on;
    $("scope").setAttribute("aria-pressed", on ? "true" : "false");
    view.pitch = clampPitch(view.pitch);
  }
  // (the player's own Scope press: the serve no longer puts it down for him)
  function scopeMine() { if (court.m) { court.m.scoped = false; } }
  // The serve's bar, in characters under the Scope: soft (a fault in the kitchen), softer to harder, the gold ace zone,
  // hard, long; the mark (◎) sweeping it; the pearls of this serve, served (◎) and still to serve (○).
  function meterDraw(c, m, W, H, glyph) {
    // (in the dark over the net, clear of his body under the Scope, and below the HUD's lines however they wrap)
    var N = 25, cw = min(13, (W - 48) / N), x0 = W / 2 - N * cw / 2, y0 = max(H * 0.37, hudLow + 56), u = meterAt(m), ramp = "-=+*", i;
    if (y0 + 56 > H / 2 - 26 && y0 - 50 < H / 2 + 26) { y0 = H / 2 + 26 + 50; }   // (never across the Scope's mark: under it, on a short screen)
    for (i = 0; i < N; i += 1) {
      var v = (i + 0.5) / N, ch, col = "#f2efe8";
      if (v < SERVE.SOFT) { ch = "."; col = "#8a8f9a"; }
      else if (v >= SERVE.LONG) { ch = "△"; col = "#e07a5f"; }
      else if (v >= SERVE.ACE[0] && v < SERVE.ACE[1]) { ch = "◆"; col = "#f3c98b"; }
      else if (v >= SERVE.ACE[1]) { ch = "#"; }
      else { ch = ramp.charAt(min(3, floor((v - SERVE.SOFT) / (SERVE.ACE[0] - SERVE.SOFT) * 4))); }
      glyph(ch, x0 + (i + 0.5) * cw, y0, 14, col);
    }
    glyph("◎", x0 + u * N * cw, y0 - 16, 18, "#f3c98b");
    m.stops.forEach(function (v) { glyph("·", x0 + v * N * cw, y0 + 14, 14, "#f2efe8"); });
    c.font = "500 10px ui-monospace, SFMono-Regular, Menlo, monospace";
    glyph("soft", x0 + 2 * cw, y0 + 30, 10); glyph("ace", x0 + (SERVE.ACE[0] + SERVE.ACE[1]) / 2 * N * cw, y0 + 30, 10, "#f3c98b"); glyph("long", x0 + (N - 1.5) * cw, y0 + 30, 10, "#e07a5f");
    for (i = 0; i < SERVE.MAX; i += 1) { glyph(i < m.served + m.tosses.length ? "◎" : "○", W / 2 + (i - 1) * 22, y0 - 40, 16, i < m.served + m.tosses.length ? "#f3c98b" : "#f2efe8"); }
    var hs = min(10, (W - 24) / STR.meterHint.length / 0.6); glyph(STR.meterHint, W / 2, y0 + 48, hs);
    hudBox.meter = { x: min(x0, W / 2 - STR.meterHint.length * hs * 0.31), y: y0 - 50, w: max(N * cw, STR.meterHint.length * hs * 0.62), h: 106 };
  }
  /* -- the super return: once a game (see below, "the super return") -- */
  function superButton() {
    var bt = $("super"), m = court.m, sp = m && m.sup;
    if (!bt) { return; }
    bt.disabled = !sp || !sp.avail; bt.setAttribute("aria-pressed", sp && sp.armed ? "true" : "false");
  }
  function superPress() {
    var m = court.m;
    if (!m || m.phase === "super") { return; }
    if (!m.sup.avail) { say(STR.superUsed); return; }
    m.sup.armed = !m.sup.armed;   // (a second press keeps it for later)
    superButton(); say(m.sup.armed ? STR.superArmed : STR.superKept);
  }
  // (the super return's choreography: below, once its design is settled; until then it waits armed)
  function superStart(m) { void m; return false; }
  function superStep(m, dt) { void dt; m.phase = "rally"; }
  // The hands: touch and mouse alike, the left half a stick (where the finger or the press lands is its middle), the
  // right half a drag that turns the view (the way his return goes), a tap or a click anywhere a serve; Serve, Scope and
  // Super; on a desk the keys too, and the right button the Scope.
  var input = { keys: {}, stick: null, look: null, fire: false, taps: 0, down: {} };
  function inputClear() { input.keys = {}; input.stick = null; input.fire = false; input.down = {}; }
  function awake(f) { return function (e) { if (!YT.paused) { f(e); } }; }   // (paused, the game takes no input)
  function controls() {
    var k = input.keys, fwd = 0, side = 0, full = CAPS.vmax;
    if (input.stick) { var s = input.stick, L = min(1, hypot(s.dx, s.dy) / 60), a = Math.atan2(s.dx, -s.dy); fwd = Math.cos(a) * L; side = Math.sin(a) * L; full = CAPS.vmax * Math.pow(L, 0.6) / (L || 1); }
    else {
      fwd = (k.w || k.ArrowUp ? 1 : 0) - (k.s || k.ArrowDown ? 1 : 0); side = (k.d ? 1 : 0) - (k.a ? 1 : 0);
      var n = hypot(fwd, side); if (n > 1) { fwd /= n; side /= n; }
      full = k.Shift ? CAPS.vmax : 0.62 * CAPS.vmax;
    }
    if (k.ArrowLeft) { view.yaw -= 2.2 / 60; } if (k.ArrowRight) { view.yaw += 2.2 / 60; }
    var y = view.yaw, v = [(Math.sin(y) * fwd + Math.cos(y) * side) * full, (-Math.cos(y) * fwd + Math.sin(y) * side) * full];
    return { vel: v, fire: input.fire };
  }
  function bindInput() {
    var half = function (x) { return x < canvas.clientWidth / 2; };
    canvas.addEventListener("pointerdown", awake(function (e) {
      e.preventDefault();
      if (e.pointerType === "mouse" && e.button === 2) { scopeSet(); scopeMine(); return; }
      try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* fine */ }
      var down = input.down;   // (a mouse's drag on the left half is the stick too: the requirements ask the mouse for everything)
      down[e.pointerId] = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, stick: half(e.clientX) && !input.stick };
      if (down[e.pointerId].stick) { input.stick = { id: e.pointerId, x: e.clientX, y: e.clientY, dx: 0, dy: 0 }; }
    }));
    canvas.addEventListener("pointermove", awake(function (e) {
      var d = input.down[e.pointerId]; if (!d) { return; }
      var mx = e.clientX - d.x, my = e.clientY - d.y; d.moved = max(d.moved, hypot(mx, my));
      if (d.stick && input.stick && input.stick.id === e.pointerId) { input.stick.dx = mx; input.stick.dy = my; return; }
      var k = e.pointerType === "mouse" ? 0.0045 : 0.006;
      view.yaw += (e.clientX - (d.lx == null ? d.x : d.lx)) * k; view.pitch = clampPitch(view.pitch - (e.clientY - (d.ly == null ? d.y : d.ly)) * k);
      d.lx = e.clientX; d.ly = e.clientY;
    }));
    var up = function (e) {
      var d = input.down[e.pointerId]; if (!d) { return; }
      delete input.down[e.pointerId];
      if (input.stick && input.stick.id === e.pointerId) { input.stick = null; }
      if (!YT.paused && d.moved < 10 && performance.now() - d.t < 350) { input.fire = true; input.taps += 1; }
    };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", function (e) { delete input.down[e.pointerId]; if (input.stick && input.stick.id === e.pointerId) { input.stick = null; } });
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    window.addEventListener("keydown", awake(function (e) {
      var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " " || k === "t" || k === "Enter") { input.fire = true; e.preventDefault(); }
      else if (k === "r") { scopeSet(); scopeMine(); }
      else if (k === "e" || k === "q") { superPress(); }
      input.keys[k] = true; if (e.shiftKey) { input.keys.Shift = true; }
      if (k.indexOf("Arrow") === 0) { e.preventDefault(); }
    }));
    window.addEventListener("keyup", function (e) { var k = e.key.length === 1 ? e.key.toLowerCase() : e.key; input.keys[k] = false; if (!e.shiftKey) { input.keys.Shift = false; } });
    window.addEventListener("blur", function () { input.keys = {}; input.stick = null; });
    $("serve").addEventListener("click", awake(function () { input.fire = true; }));
    $("scope").addEventListener("click", awake(function () { scopeSet(); scopeMine(); }));
    $("super").addEventListener("click", awake(function () { superPress(); }));
  }

  /* ---- drawing a frame ---------------------------------------------------------------------------------------------- */
  var CT = { ground: [0.1, 0.17, 0.12], out: [0.13, 0.36, 0.22], inn: [0.16, 0.3, 0.62], kitchen: [0.16, 0.46, 0.48], line: [0.96, 0.96, 0.9],
             net: [0.42, 0.44, 0.5], post: [0.62, 0.62, 0.66], lamp: [1, 0.96, 0.82], pole: [0.3, 0.3, 0.33], dust: [0.75, 0.66, 0.5], pearl: [1, 0.97, 0.92] };
  // The courts and their floodlights, and nothing else (the artist: "get rid of the Trojan horse being built [and] any
  // architecture that is outside of the [plain] courts"); those more than 160 m off are past seeing and not drawn.
  var SEEN = 160;
  function drawCourts() {
    var L = COURT.L, HW = COURT.HW, K = COURT.K, lw = 0.06, y = 0.011, nw = 2 * (HW + COURT.PO), ex = cur.eye[0];
    cbox([ex, -0.05, 0], [2 * SEEN + 60, 0.1, 2 * SEEN], CT.ground);
    for (var k = 0; k < courts.length; k += 1) {
      var x = courtAt(k)[0], z = 0;
      if (abs(x - ex) > SEEN) { continue; }
      cbox([x, 0.001, z], [COURT.GAP - 1, 0.01, 2 * L + 7], CT.out);
      cbox([x, 0.006, z], [2 * HW, 0.01, 2 * L], CT.inn);
      cbox([x, 0.008, z], [2 * HW, 0.01, 2 * K], CT.kitchen);
      [-1, 1].forEach(function (s) {
        cbox([x, y, z + s * (L - lw / 2)], [2 * HW, 0.012, lw * 2], CT.line);
        cbox([x + s * (HW - lw / 2), y, z], [lw, 0.012, 2 * L], CT.line);
        cbox([x, y, z + s * K], [2 * HW, 0.012, lw], CT.line);
        cbox([x, y, z + s * (K + L) / 2], [lw, 0.012, L - K], CT.line);
        cbox([x + s * (HW + COURT.PO), COURT.POST / 2, z], [0.08, COURT.POST, 0.08], CT.post);
      });
      cbox([x, COURT.NET / 2 + 0.03, z], [nw, COURT.NET - 0.06, 0.03], CT.net);
      cbox([x, COURT.NET, z], [nw, 0.07, 0.05], CT.line);
    }
    // the floodlights: a pole at each court's corners, its lamp lit
    for (var j = 0; j <= courts.length; j += 1) {
      if (abs((j - 0.5) * COURT.GAP - ex) > SEEN) { continue; }
      [-1, 1].forEach(function (s) {
        var px = (j - 0.5) * COURT.GAP, pz = s * (L + 4);
        cbox([px, 4.5, pz], [0.18, 9, 0.18], CT.pole);
        cbox([px, 9.1, pz - s * 0.2], [1.2, 0.35, 0.5], CT.lamp, 1.6);
      });
    }
  }
  function draw() {
    var dpr = min(3, window.devicePixelRatio || 1), cw = round(canvas.clientWidth * dpr), chh = round(canvas.clientHeight * dpr);
    if (cw < 2 || chh < 2) { return; }   // (a frame with no size, as the Android app first shows it: nothing to draw)
    if (canvas.width !== cw || canvas.height !== chh) { canvas.width = cw; canvas.height = chh; }
    me.pose = athPose(me, gt);   // (first: the Scope's camera stands behind his head as it is this frame)
    var e = camera(frameDt), yaw = view.yaw, pitch = view.pitch;
    if (cine) { e = cine.e; yaw = cine.yaw; pitch = cine.pitch; }
    if (camOver) { e = camOver.e; yaw = camOver.yaw; pitch = camOver.pitch; }
    var vm = viewM(e, yaw, pitch);
    cur.eye = e; cur.vp = mul(perspective(FOV * PI / 180, cw / chh, NEAR, FAR), vm);
    var into = !camPlain && ascBegin(cw, chh);
    if (!into) { gl.bindFramebuffer(gl.FRAMEBUFFER, null); }
    gl.viewport(0, 0, cw, chh);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // the sky, behind everything
    var f = lookDir(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)], u = cross(r, f);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(skyP); gl.uniform3fv(KU.uF, f); gl.uniform3fv(KU.uR, r); gl.uniform3fv(KU.uU, u); gl.uniform2f(KU.uK, T35 * cw / chh, T35);
    gl.uniform3fv(KU.uZen, SKY.zen); gl.uniform3fv(KU.uHor, SKY.hor); gl.uniform3fv(KU.uGnd, SKY.gnd);
    gl.bindVertexArray(null); gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.CULL_FACE);
    gl.useProgram(solid);
    gl.uniformMatrix4fv(SU.uVP, false, cur.vp); gl.uniform3fv(SU.uEye, e); gl.uniform3fv(SU.uKey, KEY); gl.uniform3fv(SU.uFog, SKY.hor);
    drawCourts();
    var m = court.m;
    // the athletes
    var headShown = !(view.scope && gt - view.camT >= TP.VIEW / 2);
    drawAthlete(me, me.pose, true, !headShown);   // (with the Scope up his head is the glass, and his hat off it, as the rocket world doffs it)
    courts.forEach(function (cv, k) {
      if (abs(courtAt(k)[0] - e[0]) > SEEN) { return; }
      drawAthlete(plans[k], plans[k].pose = athPose(plans[k], gt), false);
      if (cv.up && !(m && m.k === k)) { drawAthlete(stands[k], athPose(stands[k], gt), false); }
      if (cv.up && !(m && m.k === k)) {
        // the courts that play on: the pearl back and forth between them, a shot each 1.3 s
        var cc = courtAt(k), uu = (gt - cv.t0) / 1.3, ii = floor(uu), ff = uu - ii, ax = function (j) { return cc[0] + Math.sin(j * 1.7 + k) * 1.6; };
        var zs = cc[2] + COURT.L - 0.5, zn = cc[2] - COURT.L + 0.5, za = ii % 2 ? zn : zs, zb = ii % 2 ? zs : zn;
        drawBall([ax(ii) + (ax(ii + 1) - ax(ii)) * ff, 0.8 + 1.4 * Math.sin(PI * ff), za + (zb - za) * ff], uu * 9);
      }
    });
    if (m) {
      m.balls.forEach(function (b) { if (!b.dead || gt - b.deadT < 1.4) { drawBall([b.x, b.y, b.z], b.spin); } });
      // (a pearl tossed: dropped from his hand to below his waist, where the racket meets it)
      m.tosses.forEach(function (q) { if (gt >= q.t0) { var tu = clampV((gt - q.t0) / 0.3, 0, 1), s0 = serveFrom(); drawBall([s0[0], 1.0 - (1.0 - s0[1]) * tu * tu, s0[2]], 0); } });
    }
    dust.forEach(function (d) { var s = 0.07 * (1 - (gt - d.t) / 0.7); cbox([d.x, d.y, d.z], [s, s, s], CT.dust, 0.4); });
    if (headShown) { drawHead(me.pose, vm); }
    gl.bindVertexArray(null);
    if (into) { ascEnd(cw, chh, dpr); }
    overlay(dpr);
  }
  function drawBall(p, spin) {
    var h = body.cell, M = mul(T(p[0], p[1], p[2]), mul(RX(spin || 0), mul(S(h), T(-3, -3, -3))));
    drawSolid(ballMesh, M, CT.pearl, null, 0.55);
  }
  // Over the view, page-drawn: the ring where Mr Plan's shot comes down, the Scope's mark, the stick, and the last ten
  // courts' squares; all of it in characters where it marks a place.
  var sayEl = null, hudLow = 0, hudBox = {};   // (hudBox: where the bar was drawn, for the tests)
  function overlay(dpr) {
    sayEl = sayEl || $("say");
    var c = hud.getContext("2d"), W = hud.clientWidth, H = hud.clientHeight;
    if (hud.width !== round(W * dpr) || hud.height !== round(H * dpr)) { hud.width = round(W * dpr); hud.height = round(H * dpr); }
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    var m = court.m, vp = cur.vp;
    hudBox.meter = null;
    var toS = function (p) { var q = [0, 0, 0, 0]; for (var i = 0; i < 4; i += 1) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; } return q[3] > 0.05 ? [(q[0] / q[3] * 0.5 + 0.5) * W, (1 - (q[1] / q[3] * 0.5 + 0.5)) * H] : null; };
    var glyph = function (ch, x, y, size, col) { c.font = "700 " + size + "px ui-monospace, SFMono-Regular, Menlo, 'DejaVu Sans Mono', monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.7)"; c.strokeText(ch, x, y); c.fillStyle = col || "#f2efe8"; c.fillText(ch, x, y); };
    if (m) {
      m.balls.forEach(function (b) {
        if (b.dead || !b.mark || b.last !== "them" || b.bounces !== 0) { return; }
        for (var s = 0; s < 14; s += 1) { var a = s / 14 * 2 * PI, q = toS([b.mark.x + Math.cos(a) * 0.4, 0.02, b.mark.z + Math.sin(a) * 0.4]); if (q) { glyph("○", q[0], q[1], 11); } }
      });
      if (m.meterOn && m.phase !== "super") { meterDraw(c, m, W, H, glyph); }
    }
    hudBox.reticle = null;
    if (view.scope && gt - view.camT >= TP.VIEW / 2) { glyph("◎", W / 2, H / 2, 34, "#f3c98b"); glyph("+", W / 2, H / 2, 14, "#f3c98b"); hudBox.reticle = { x: W / 2 - 20, y: H / 2 - 20, w: 40, h: 40 }; }
    if (input.stick) { var st = input.stick, L = min(60, hypot(st.dx, st.dy)), an = Math.atan2(st.dy, st.dx); glyph("○", st.x, st.y, 46); glyph("◆", st.x + Math.cos(an) * L, st.y + Math.sin(an) * L, 22, "#f3c98b"); }
    // the last ten courts: a square each, its number in it; filled while it plays on by itself, gold while he plays it,
    // outlined while it waits (the open one, the newest)
    var top = document.querySelector(".top"), y0 = (top ? top.getBoundingClientRect().bottom : 30) + 8, sz = min(22, (W - 24 - 9 * 5) / 10), gap = 5, x0 = 12, n0 = max(0, courts.length - 10);
    c.font = (courts.length > 99 ? "600 9px" : "600 11px") + " ui-monospace, SFMono-Regular, Menlo, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    courts.slice(n0).forEach(function (q, j) {
      var x = x0 + j * (sz + gap), on = m && m.k === q.k;
      if (q.up) { c.fillStyle = "rgba(236,236,228,0.92)"; c.fillRect(x, y0, sz, sz); }
      c.strokeStyle = on ? "#f3c98b" : "rgba(236,236,228,0.9)"; c.lineWidth = on ? 2 : 1; c.strokeRect(x + 0.5, y0 + 0.5, sz - 1, sz - 1);
      c.fillStyle = q.up ? "#1c1c1e" : "#f2efe8"; c.fillText(String(q.k + 1), x + sz / 2, y0 + sz / 2 + 0.5);
    });
    var ly = y0 + sz;
    hudLow = ly + 8;
    var sy = round(ly + 16) + "px"; if (sayEl.style.top !== sy) { sayEl.style.top = sy; }
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
    gt += frameDt;
    stepAll(frameDt);
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
    // the first frame, before his body is built: black under the loading words (index.html), and told
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    requestAnimationFrame(function () { YT.firstFrame(); });
    YT.onPause(function () { stop(); inputClear(); save(); });
    YT.onResume(function () { start(); });
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
      say(STR.welcome, true);
      start();
    }).then(null, function (e) { YT.error(e); $("loading").textContent = "The courts could not be built."; });
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", boot); } else { boot(); }

  // For the tests: the state, and a way to step the game without the frames' clock.
  window.Pickleball = { debug: function () {
    return { me: me, plans: plans, stands: stands, court: court, courts: courts, view: view, skill: nemSkill, won: wonCount,
             winCourt: function () { if (court.m) { court.m.you = COURT.WIN; levelWon(); } }, CAPS: CAPS, COURT: COURT, YT: YT, STR: STR,
             glyphs: asc && asc.glyphs, gt: function () { return gt; }, input: input, enter: function (k) { me.x = courtAt(k)[0] + 0.5; me.z = COURT.L - 1; },
             run: function (sec, fire) { var n = round(sec * 60); for (var i = 0; i < n; i += 1) { gt += 1 / 60; if (fire && i === 0) { input.fire = true; } stepAll(1 / 60); camera(1 / 60); } },
             draw: function () { frameDt = 1 / 60; draw(); }, pause: function (on) { if (on) { YT.paused = true; stop(); } else { YT.paused = false; start(); } },
             running: function () { return !!raf; }, pose: athPose, planContact: planContact, ascOk: function () { return !!(asc && asc.ok); },
             swing: function (a, c) { return athSwing(a, c, gt); }, split: function (a) { athSplit(a, gt); }, celebrate: function (a, w) { athCelebrate(a, w, gt); },
             step: function (a, sec) { for (var i = 0; i < round(sec * 60); i += 1) { gt += 1 / 60; athStep(a, 1 / 60, gt); } },
             meter: function () { var m = court.m; return m && m.meterOn ? meterAt(m) : null; }, SERVE: SERVE, hud: function () { return hudBox; },
             camAt: function (e, yaw, pitch, plain) { camOver = e && { e: e, yaw: yaw, pitch: pitch }; camPlain = !!plain; } };
  } };
})();
