/* The systems.

   Generative animations the Artist Website draws with — each one a system
   that produces moving images rather than a sequence someone drew, which is
   the point the research the artist shared (23 Sep 2026) ends on. Each is
   after a body of work that research named, and is made out of this site's
   own material: its collages, its words, DIRT, the telescope's photographs,
   the lines of its plays. land.js decides where they appear; this file only
   knows how to draw them.

     hallucination   after Refik Anadol, Unsupervised: the collection's
                     colours as a fluid that never settles
     datamatics      after Ryoji Ikeda: the site's own numbers as the image
     synapse         after GMUNK, Synapse Code: a picture turned into geometry
     strata          after Quayola: a picture found again by triangles
     cells           after Universal Everything, Primordial: a picture grown
                     out of dividing cells
     reaction        Primordial again: cellular life, generated
     motionPainting  after Oskar Fischinger, Motion Painting No. 1: painting
                     given time, in rhythm
     people          after Universal Everything, Infinity: characters made
                     up as they are needed, none of them the same twice
     gaits           after Universal Everything, Migrations: the way real
                     animals move, lent to bodies nobody has seen
     externalWorld   after David OReilly, The External World: crude, funny,
                     surreal, and deeply digital
     sound           the part of Ikeda and Fischinger that is heard; off until
                     it is asked for */

(function () {
  "use strict";

  var S = {};
  var TAU = Math.PI * 2;

  // ---- small tools --------------------------------------------------------

  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function hexRgb(h) {
    h = String(h || "#888888").replace("#", "");
    if (h.length === 3) { h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; }
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  function smooth(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

  S.rng = rng;
  S.hashStr = hashStr;
  S.hexRgb = hexRgb;
  S.smooth = smooth;

  /* Whatever of a picture is under each of a grid of cells, averaged. */
  S.sample = function (img, cols, rows, turn) {
    var c = document.createElement("canvas");
    c.width = cols;
    c.height = rows;
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = true;
    g.save();
    g.translate(cols / 2, rows / 2);
    g.rotate(turn || 0);
    var sw = (turn && Math.round(turn / (Math.PI / 2)) % 2) ? rows : cols;
    var sh = (turn && Math.round(turn / (Math.PI / 2)) % 2) ? cols : rows;
    g.drawImage(img, -sw / 2, -sh / 2, sw, sh);
    g.restore();
    try {
      return g.getImageData(0, 0, cols, rows).data;
    } catch (e) {
      return null;
    }
  };

  // ---- a field of flow --------------------------------------------------------

  /* The curl of a few slow waves: swirls that never meet a wall, and never
     settle into the same pattern twice. */
  function Flow(seed) {
    var r = rng(seed);
    this.waves = [];
    for (var i = 0; i < 6; i += 1) {
      var a = r() * TAU;
      var k = 0.8 + r() * 2.6;
      this.waves.push({ kx: Math.cos(a) * k, ky: Math.sin(a) * k, w: (r() - 0.5) * 0.9,
                        p: r() * TAU, amp: 0.6 + r() });
    }
  }
  Flow.prototype.at = function (x, y, t, out) {
    var vx = 0, vy = 0;
    for (var i = 0; i < this.waves.length; i += 1) {
      var q = this.waves[i];
      var c = Math.cos(q.kx * x + q.ky * y + q.w * t + q.p) * q.amp;
      vx += c * q.ky;           // the curl of sin(k.p + w t)
      vy -= c * q.kx;
    }
    out[0] = vx;
    out[1] = vy;
    return out;
  };
  S.Flow = Flow;

  // ---- hallucination ------------------------------------------------------------

  /* A fluid of pigment: the colours carried along a slowly turning flow,
     fed from moving sources, never still. Drawn a little coarse, on purpose,
     so it belongs to a page made of pixels.

     new Systems.Hallucination(canvas, colours, { cell, seed, dark })
       .start() / .stop() / .palette(colours) / .step(dt) / .draw() */
  function Hallucination(canvas, colours, opts) {
    opts = opts || {};
    this.canvas = canvas;
    this.g = canvas.getContext("2d");
    this.cell = opts.cell || 4;
    this.seed = opts.seed || (Math.random() * 1e9) | 0;
    this.flow = new Flow(this.seed);
    this.t = Math.random() * 100;
    this.dark = hexRgb(opts.dark || "#0d0c14");
    this.small = document.createElement("canvas");
    this.sg = this.small.getContext("2d");
    this.running = false;
    this.vividness = opts.vivid || 1.8;
    this.palette(colours);
    this.resize();
  }
  /* A colour pushed further along its own saturation, keeping its hue and
     roughly its lightness: the latent space is the collection's colours
     remembered more vividly than they were. */
  function vivid(rgb, k) {
    var m = (rgb[0] + rgb[1] + rgb[2]) / 3;
    var out = rgb.map(function (v) { return m + (v - m) * k; });
    var lo = Math.min.apply(null, out), hi = Math.max.apply(null, out);
    var fit = Math.min(1, lo < 0 ? m / (m - lo) : 1, hi > 255 ? (255 - m) / (hi - m) : 1);
    return out.map(function (v) { return m + (v - m) * fit; });
  }
  S.vivid = vivid;
  Hallucination.prototype.palette = function (colours) {
    var list = (colours && colours.length ? colours : ["#5e52c7", "#d6b05c", "#9d95e6"]).slice(0, 10);
    var r = rng(this.seed + 7), k = this.vividness;
    this.sources = list.map(function (c, i) {
      return { rgb: vivid(hexRgb(c), k), ax: 0.3 + r() * 0.35, ay: 0.25 + r() * 0.35, fx: 0.07 + r() * 0.16,
               fy: 0.05 + r() * 0.14, p: r() * TAU, size: 0.07 + r() * 0.07 };
    });
  };
  Hallucination.prototype.resize = function () {
    var w = Math.max(16, Math.round((this.canvas.clientWidth || this.canvas.width) / this.cell));
    var h = Math.max(16, Math.round((this.canvas.clientHeight || this.canvas.height) / this.cell));
    if (w === this.w && h === this.h) { return; }
    this.w = w;
    this.h = h;
    this.small.width = w;
    this.small.height = h;
    var n = w * h;
    this.a = new Float32Array(n * 3);
    this.b = new Float32Array(n * 3);
    // It starts already full of its colours, laid in broad soft bands, so
    // it is pigment from the first frame rather than a dark filling up.
    var src = this.sources, r = rng(this.seed + 11);
    var k1 = 2 + r() * 3, k2 = 2 + r() * 3, p1 = r() * TAU, p2 = r() * TAU;
    for (var y = 0; y < h; y += 1) {
      for (var x = 0; x < w; x += 1) {
        var f = (Math.sin(x / w * k1 * 3 + p1 + Math.sin(y / h * k2 * 2 + p2) * 1.6) + 1) / 2;
        var pos = f * (src.length - 1), lo = Math.floor(pos), hi = Math.min(src.length - 1, lo + 1), m = pos - lo;
        var o = (y * w + x) * 3;
        for (var c = 0; c < 3; c += 1) {
          var col = src[lo].rgb[c] * (1 - m) + src[hi].rgb[c] * m;
          this.a[o + c] = col * 0.8 + this.dark[c] * 0.2;
        }
      }
    }
    this.img = this.sg.createImageData(w, h);
    // A good start: run it on a while, so it is already moving when seen.
    for (var k = 0; k < 45; k += 1) { this.step(1 / 30); }
  };
  Hallucination.prototype.step = function (dt) {
    var w = this.w, h = this.h, a = this.a, b = this.b, flow = this.flow;
    var t = (this.t += dt);
    var v = [0, 0];
    var scale = 2.2 / Math.max(w, h);
    var push = 26 * dt * Math.max(w, h) / 160;
    // The flow is worked out on a grid four cells apart and read between.
    var G = 4, gw = Math.ceil(w / G) + 2, gh = Math.ceil(h / G) + 2;
    if (!this.fx || this.fx.length !== gw * gh) {
      this.fx = new Float32Array(gw * gh);
      this.fy = new Float32Array(gw * gh);
    }
    var fxs = this.fx, fys = this.fy;
    for (var gy = 0; gy < gh; gy += 1) {
      for (var gx = 0; gx < gw; gx += 1) {
        flow.at(gx * G * scale, gy * G * scale, t * 0.35, v);
        fxs[gy * gw + gx] = v[0];
        fys[gy * gw + gx] = v[1];
      }
    }
    for (var y = 0; y < h; y += 1) {
      var qy = y / G, qy0 = qy | 0, ty = qy - qy0;
      for (var x = 0; x < w; x += 1) {
        var qx = x / G, qx0 = qx | 0, tx = qx - qx0;
        var gi = qy0 * gw + qx0;
        v[0] = (fxs[gi] * (1 - tx) + fxs[gi + 1] * tx) * (1 - ty) + (fxs[gi + gw] * (1 - tx) + fxs[gi + gw + 1] * tx) * ty;
        v[1] = (fys[gi] * (1 - tx) + fys[gi + 1] * tx) * (1 - ty) + (fys[gi + gw] * (1 - tx) + fys[gi + gw + 1] * tx) * ty;
        var sx = x - v[0] * push, sy = y - v[1] * push;
        if (sx < 0) { sx = 0; } else if (sx > w - 1.001) { sx = w - 1.001; }
        if (sy < 0) { sy = 0; } else if (sy > h - 1.001) { sy = h - 1.001; }
        var x0 = sx | 0, y0 = sy | 0, fx = sx - x0, fy = sy - y0;
        var i00 = (y0 * w + x0) * 3, i10 = i00 + 3, i01 = i00 + w * 3, i11 = i01 + 3;
        var o = (y * w + x) * 3;
        for (var c = 0; c < 3; c += 1) {
          var top = a[i00 + c] + (a[i10 + c] - a[i00 + c]) * fx;
          var bot = a[i01 + c] + (a[i11 + c] - a[i01 + c]) * fx;
          b[o + c] = top + (bot - top) * fy;
        }
      }
    }
    // Fed from each source as it goes round.
    for (var s = 0; s < this.sources.length; s += 1) {
      var q = this.sources[s];
      var cx = (0.5 + Math.sin(t * q.fx * 2 + q.p) * q.ax) * w;
      var cy = (0.5 + Math.cos(t * q.fy * 2 + q.p * 1.7) * q.ay) * h;
      var rad = q.size * Math.max(w, h);
      var x0s = Math.max(0, (cx - rad) | 0), x1s = Math.min(w - 1, (cx + rad) | 0);
      var y0s = Math.max(0, (cy - rad) | 0), y1s = Math.min(h - 1, (cy + rad) | 0);
      for (var yy = y0s; yy <= y1s; yy += 1) {
        for (var xx = x0s; xx <= x1s; xx += 1) {
          var d = ((xx - cx) * (xx - cx) + (yy - cy) * (yy - cy)) / (rad * rad);
          if (d >= 1) { continue; }
          var k = (1 - d) * (1 - d) * 0.3;
          var j = (yy * w + xx) * 3;
          b[j] += (q.rgb[0] - b[j]) * k;
          b[j + 1] += (q.rgb[1] - b[j + 1]) * k;
          b[j + 2] += (q.rgb[2] - b[j + 2]) * k;
        }
      }
    }
    // And slowly back toward the dark, so it never fills up.
    var dk = this.dark, fade = 0.0009;
    for (var n = 0; n < b.length; n += 3) {
      b[n] += (dk[0] - b[n]) * fade;
      b[n + 1] += (dk[1] - b[n + 1]) * fade;
      b[n + 2] += (dk[2] - b[n + 2]) * fade;
    }
    this.a = b;
    this.b = a;
  };
  /* Drawn with a sheen where the pigment is moving fastest, which is what
     makes it read as a lit substance rather than a smear. */
  Hallucination.prototype.draw = function (target, tw, th) {
    var w = this.w, h = this.h, a = this.a, d = this.img.data;
    for (var y = 0; y < h; y += 1) {
      for (var x = 0; x < w; x += 1) {
        var i = (y * w + x) * 3, o = (y * w + x) * 4;
        var j = i + (x < w - 1 ? 3 : 0), k = i + (y < h - 1 ? w * 3 : 0);
        var edge = Math.abs(a[i] - a[j]) + Math.abs(a[i + 1] - a[k + 1]) + Math.abs(a[i + 2] - a[j + 2]);
        var lift = Math.min(60, edge * 0.9);
        d[o] = a[i] + lift;
        d[o + 1] = a[i + 1] + lift;
        d[o + 2] = a[i + 2] + lift;
        d[o + 3] = 255;
      }
    }
    this.sg.putImageData(this.img, 0, 0);
    var g = target || this.g;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.small, 0, 0, w, h, 0, 0, tw || this.canvas.width, th || this.canvas.height);
  };
  Hallucination.prototype.start = function () {
    if (this.running) { return; }
    this.running = true;
    var self = this, last = performance.now(), tick = 0;
    function loop(now) {
      if (!self.running) { return; }
      requestAnimationFrame(loop);
      tick += 1;
      if (tick % 2) { return; }                 // thirty a second is plenty for a fluid
      var dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      self.resize();
      self.step(dt);
      self.draw();
    }
    requestAnimationFrame(loop);
  };
  Hallucination.prototype.stop = function () { this.running = false; };
  S.Hallucination = Hallucination;

  // ---- datamatics -----------------------------------------------------------------

  /* The site's own numbers as the picture: bands of barcode made of their
     bits, rows of the figures themselves running past, grids of points, in
     black and white, opening out of one line and closing back into it.
     Nothing flashes: the bands move, the screen as a whole never changes
     from light to dark, and a band never covers more than a strip.

     Systems.datamatics(canvas, words, { y, duration, onDone }) */
  S.datamatics = function (canvas, words, opts) {
    opts = opts || {};
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = window.innerWidth, H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    var g = canvas.getContext("2d");
    var r = rng(hashStr(words.join("|")) ^ ((Math.random() * 1e9) | 0));
    var dur = opts.duration || 1100;
    var mid = opts.y === undefined ? H / 2 : opts.y;
    var span = Math.min(H * 0.62, 460);
    var bands = [];
    var y = -span / 2;
    var pick = [1, 1, 2, 2, 3, 4, 6, 8, 12, 18, 26, 40];
    while (y < span / 2) {
      var hh = pick[Math.floor(r() * pick.length)];
      var kind = r();
      var word = words[Math.floor(r() * words.length)] || "0";
      bands.push({ y: y, h: hh, kind: kind < 0.36 ? "bars" : kind < 0.58 ? "digits" : kind < 0.7 ? "grid" :
                   kind < 0.8 ? "inverse" : "gap", word: word, speed: (r() - 0.5) * 2600,
                   tile: null, dens: 0.25 + r() * 0.6 });
      y += hh + (r() < 0.3 ? 1 + Math.floor(r() * 4) : 0);
    }
    function bits(s) {
      var h = hashStr(s), out = [];
      for (var i = 0; i < 64; i += 1) {
        h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
        out.push(h & 1);
      }
      return out;
    }
    function tileFor(b) {
      var tw = 512;
      var c = document.createElement("canvas");
      c.width = tw;
      c.height = Math.max(1, Math.round(b.h * dpr));
      var t = c.getContext("2d");
      var black = b.kind === "inverse";
      t.fillStyle = black ? "#ffffff" : "#000000";
      t.fillRect(0, 0, tw, c.height);
      t.fillStyle = black ? "#000000" : "#ffffff";
      if (b.kind === "bars" || b.kind === "inverse") {
        var bb = bits(b.word), x = 0, i = 0;
        while (x < tw) {
          var wbar = 1 + bb[i % 64] + bb[(i + 7) % 64] * 2;
          if (bb[(i * 3) % 64] || r() < b.dens * 0.3) { t.fillRect(x, 0, wbar, c.height); }
          x += wbar + 1;
          i += 1;
        }
      } else if (b.kind === "digits") {
        var size = Math.max(6, Math.min(c.height, 11 * dpr));
        t.font = size + "px ui-monospace, Menlo, Consolas, monospace";
        t.textBaseline = "middle";
        var txt = "";
        while (txt.length < 160) { txt += b.word + "  " + (r() * 1e6 | 0).toString(16) + "  "; }
        t.fillText(txt, 0, c.height / 2 + 0.5);
      } else if (b.kind === "grid") {
        for (var gx = 0; gx < tw; gx += Math.max(2, Math.round(6 * dpr))) {
          for (var gy = 0; gy < c.height; gy += Math.max(2, Math.round(3 * dpr))) {
            if (r() < b.dens) { t.fillRect(gx, gy, Math.max(1, dpr), Math.max(1, dpr)); }
          }
        }
      }
      return c;
    }
    bands.forEach(function (b) { if (b.kind !== "gap") { b.tile = tileFor(b); } });
    var start = performance.now();
    var done = false;
    function frame(now) {
      if (done) { return; }
      var q = (now - start) / dur;
      if (q >= 1) {
        g.clearRect(0, 0, canvas.width, canvas.height);
        done = true;
        if (opts.onDone) { opts.onDone(); }
        return;
      }
      requestAnimationFrame(frame);
      // Held frames, as everything here: twenty-four a second.
      var t = Math.floor((now - start) / 42) * 42 / 1000;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, canvas.width, canvas.height);
      var open = q < 0.22 ? smooth(q / 0.22) : q > 0.72 ? 1 - smooth((q - 0.72) / 0.28) : 1;
      bands.forEach(function (b, i) {
        if (!b.tile) { return; }
        var by = mid + b.y * open;
        var bh = Math.max(1, b.h * Math.max(0.2, open));
        var off = ((t * b.speed) % 512 + 512) % 512;
        var yy = Math.round(by * dpr), hh = Math.round(bh * dpr);
        for (var x = -off * dpr; x < canvas.width; x += 512) {
          g.drawImage(b.tile, 0, 0, 512, b.tile.height, Math.round(x), yy, 512, hh);
        }
      });
      // A read head crossing it.
      var head = ((t * 0.9) % 1) * canvas.width;
      g.fillStyle = "#ffffff";
      g.fillRect(Math.round(head), Math.round((mid - span / 2 * open) * dpr), Math.max(1, dpr), Math.round(span * open * dpr));
    }
    requestAnimationFrame(frame);
    if (S.sound && S.sound.on) { S.sound.datamatics(dur); }
    return { stop: function () { done = true; g.clearRect(0, 0, canvas.width, canvas.height); } };
  };

  // ---- synapse ---------------------------------------------------------------------

  /* A picture as geometry: its cells stood up as columns as tall as they are
     light, the whole field tipped over into the corner view and back. `lift`
     0..1 is how far into geometry it has gone; `hue` turns its colours. */
  S.synapse = function (g, data, cols, rows, w, h, lift, hue) {
    var cw = w / cols, ch = h / rows;
    var e = smooth(lift);
    // Where the tipped-over field sits: a diamond centred in the box.
    var span = Math.min(w, h) * 0.95;
    var a = span / (cols + rows);
    var ox = w / 2, oy = h / 2 - (cols + rows) * a * 0.25;
    var tall = h * 0.3 * e;
    function at(u, v, z) {
      var fx = u * cw, fy = v * ch;
      var ix = ox + (u - v) * a, iy = oy + (u + v) * a * 0.5 - z;
      return [fx + (ix - fx) * e, fy + (iy - fy) * e];
    }
    var cosH = Math.cos(hue || 0), sinH = Math.sin(hue || 0);
    for (var s = 0; s < cols + rows - 1; s += 1) {
      for (var u = Math.max(0, s - rows + 1); u <= Math.min(cols - 1, s); u += 1) {
        var v = s - u;
        var i = (v * cols + u) * 4;
        var r = data[i], gg = data[i + 1], b = data[i + 2];
        var lum = (r * 0.3 + gg * 0.59 + b * 0.11) / 255;
        var z = tall * (0.15 + lum);
        var p00 = at(u, v, z), p10 = at(u + 1, v, z), p11 = at(u + 1, v + 1, z), p01 = at(u, v + 1, z);
        if (e > 0.02) {
          var b01 = at(u, v + 1, 0), b11 = at(u + 1, v + 1, 0), b10 = at(u + 1, v, 0);
          g.fillStyle = shade(r, gg, b, 0.62);
          g.beginPath(); g.moveTo(p01[0], p01[1]); g.lineTo(p11[0], p11[1]); g.lineTo(b11[0], b11[1]); g.lineTo(b01[0], b01[1]); g.fill();
          g.fillStyle = shade(r, gg, b, 0.42);
          g.beginPath(); g.moveTo(p11[0], p11[1]); g.lineTo(p10[0], p10[1]); g.lineTo(b10[0], b10[1]); g.lineTo(b11[0], b11[1]); g.fill();
        }
        g.fillStyle = shade(r, gg, b, 1);
        g.beginPath(); g.moveTo(p00[0], p00[1]); g.lineTo(p10[0], p10[1]); g.lineTo(p11[0], p11[1]); g.lineTo(p01[0], p01[1]); g.fill();
      }
    }
    function shade(r, gg, b, k) {
      if (hue) {
        var m = (r + gg + b) / 3;
        var rr = m + (r - m) * cosH + (gg - b) * sinH * 0.577;
        var g2 = m + (gg - m) * cosH + (b - r) * sinH * 0.577;
        var b2 = m + (b - m) * cosH + (r - gg) * sinH * 0.577;
        r = rr; gg = g2; b = b2;
      }
      return "rgb(" + Math.round(Math.max(0, Math.min(255, r * k))) + "," +
             Math.round(Math.max(0, Math.min(255, gg * k))) + "," + Math.round(Math.max(0, Math.min(255, b * k))) + ")";
    }
  };

  // ---- strata ------------------------------------------------------------------------

  /* Delaunay triangulation, Bowyer–Watson, for a few hundred points. */
  S.delaunay = function (pts) {
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(function (p) {
      if (p[0] < minX) { minX = p[0]; } if (p[1] < minY) { minY = p[1]; }
      if (p[0] > maxX) { maxX = p[0]; } if (p[1] > maxY) { maxY = p[1]; }
    });
    var d = Math.max(maxX - minX, maxY - minY) * 20 + 1;
    var mx = (minX + maxX) / 2, my = (minY + maxY) / 2;
    var all = pts.concat([[mx - d, my - d], [mx, my + d], [mx + d, my - d]]);
    var n = pts.length;
    var tris = [[n, n + 1, n + 2]];
    function circ(t) {
      var a = all[t[0]], b = all[t[1]], c = all[t[2]];
      var dd = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])) || 1e-9;
      var ux = ((a[0] * a[0] + a[1] * a[1]) * (b[1] - c[1]) + (b[0] * b[0] + b[1] * b[1]) * (c[1] - a[1]) +
                (c[0] * c[0] + c[1] * c[1]) * (a[1] - b[1])) / dd;
      var uy = ((a[0] * a[0] + a[1] * a[1]) * (c[0] - b[0]) + (b[0] * b[0] + b[1] * b[1]) * (a[0] - c[0]) +
                (c[0] * c[0] + c[1] * c[1]) * (b[0] - a[0])) / dd;
      return [ux, uy, (a[0] - ux) * (a[0] - ux) + (a[1] - uy) * (a[1] - uy)];
    }
    tris = tris.map(function (t) { return { v: t, c: circ(t) }; });
    for (var i = 0; i < n; i += 1) {
      var p = all[i];
      var bad = [], keep = [];
      tris.forEach(function (t) {
        var dx = p[0] - t.c[0], dy = p[1] - t.c[1];
        (dx * dx + dy * dy < t.c[2] ? bad : keep).push(t);
      });
      var edges = {};
      bad.forEach(function (t) {
        for (var k = 0; k < 3; k += 1) {
          var a = t.v[k], b = t.v[(k + 1) % 3];
          var key = a < b ? a + "," + b : b + "," + a;
          edges[key] = edges[key] ? 2 : 1;
        }
      });
      Object.keys(edges).forEach(function (key) {
        if (edges[key] !== 1) { return; }
        var ab = key.split(",");
        var t = [+ab[0], +ab[1], i];
        keep.push({ v: t, c: circ(t) });
      });
      tris = keep;
    }
    return tris.filter(function (t) { return t.v[0] < n && t.v[1] < n && t.v[2] < n; })
               .map(function (t) { return t.v; });
  };

  /* The stages of a picture found by triangles: points where the picture
     changes most, more at each stage, each triangle one flat colour. */
  S.strataStages = function (data, cols, rows, stages, seed) {
    var r = rng(seed || 1);
    var weight = [];
    for (var y = 0; y < rows; y += 1) {
      for (var x = 0; x < cols; x += 1) {
        var i = (y * cols + x) * 4;
        var j = (y * cols + Math.min(cols - 1, x + 1)) * 4;
        var k = (Math.min(rows - 1, y + 1) * cols + x) * 4;
        var e = Math.abs(data[i] - data[j]) + Math.abs(data[i + 1] - data[k + 1]) + Math.abs(data[i + 2] - data[j + 2]);
        weight.push(8 + e);
      }
    }
    var total = weight.reduce(function (a, b) { return a + b; }, 0);
    function pickPoint() {
      var t = r() * total;
      for (var i = 0; i < weight.length; i += 1) {
        t -= weight[i];
        if (t <= 0) { return [(i % cols) + r(), Math.floor(i / cols) + r()]; }
      }
      return [r() * cols, r() * rows];
    }
    var pts = [[0, 0], [cols, 0], [0, rows], [cols, rows]];
    var out = [];
    var count = 6;
    for (var s = 0; s < stages; s += 1) {
      while (pts.length < count) { pts.push(pickPoint()); }
      var tris = S.delaunay(pts.slice());
      out.push(tris.map(function (t) {
        var a = pts[t[0]], b = pts[t[1]], c = pts[t[2]];
        var cx = Math.min(cols - 1, Math.max(0, Math.floor((a[0] + b[0] + c[0]) / 3)));
        var cy = Math.min(rows - 1, Math.max(0, Math.floor((a[1] + b[1] + c[1]) / 3)));
        var i = (cy * cols + cx) * 4;
        return [a, b, c, "rgb(" + data[i] + "," + data[i + 1] + "," + data[i + 2] + ")"];
      }));
      count = Math.floor(count * 2.1);
    }
    return out;
  };

  // ---- cells -------------------------------------------------------------------------

  /* Generations of cells: each one divides into two a little apart, and
     the tissue settles (every cell drifts to the middle of the room it has)
     until there are enough of them to be the picture. Drawn as Voronoi
     cells with their walls and a nucleus each, in the mean colour of the
     picture under them. Returns canvases, one a generation. */
  S.cellStages = function (data, cols, rows, gens, seed) {
    var r = rng(seed || 3);
    var cells = [[cols / 2 + (r() - 0.5), rows / 2 + (r() - 0.5)]];
    var out = [];
    var n = cols * rows;
    var owner = new Int32Array(n), near1 = new Float32Array(n), near2 = new Float32Array(n);
    function assign() {
      for (var y = 0; y < rows; y += 1) {
        for (var x = 0; x < cols; x += 1) {
          var best = 1e9, second = 1e9, bi = 0;
          for (var k = 0; k < cells.length; k += 1) {
            var dx = cells[k][0] - x - 0.5, dy = cells[k][1] - y - 0.5;
            var dd = dx * dx + dy * dy;
            if (dd < best) { second = best; best = dd; bi = k; } else if (dd < second) { second = dd; }
          }
          var o = y * cols + x;
          owner[o] = bi;
          near1[o] = Math.sqrt(best);
          near2[o] = Math.sqrt(second);
        }
      }
    }
    function settle(times) {
      for (var t = 0; t < times; t += 1) {
        assign();
        var sx = new Float32Array(cells.length), sy = new Float32Array(cells.length), cnt = new Float32Array(cells.length);
        for (var p = 0; p < n; p += 1) {
          var k = owner[p];
          sx[k] += p % cols + 0.5;
          sy[k] += (p / cols | 0) + 0.5;
          cnt[k] += 1;
        }
        cells.forEach(function (c, k) {
          if (!cnt[k]) { return; }
          c[0] += (sx[k] / cnt[k] - c[0]) * 0.8;
          c[1] += (sy[k] / cnt[k] - c[1]) * 0.8;
        });
      }
    }
    for (var gi = 0; gi < gens; gi += 1) {
      settle(2);
      assign();
      var mean = new Float32Array(cells.length * 4);
      for (var p = 0; p < n; p += 1) {
        var m = owner[p] * 4;
        mean[m] += data[p * 4];
        mean[m + 1] += data[p * 4 + 1];
        mean[m + 2] += data[p * 4 + 2];
        mean[m + 3] += 1;
      }
      var c = document.createElement("canvas");
      c.width = cols;
      c.height = rows;
      var g = c.getContext("2d");
      var img = g.createImageData(cols, rows);
      var d = img.data;
      var size = Math.sqrt(n / cells.length);
      for (p = 0; p < n; p += 1) {
        m = owner[p] * 4;
        var cnt = Math.max(1, mean[m + 3]);
        // The smallest generations are nearly the picture: thinner walls, no nuclei.
        var wall = near2[p] - near1[p] < (size > 4 ? 1.05 : size > 2.6 ? 0.5 : 0);
        var nucleus = size > 3.2 && near1[p] < size * 0.16;
        var k2 = wall ? 0.5 : nucleus ? 0.62 : 1.06 + 0.12 * (1 - Math.min(1, near1[p] / (size * 0.5)));
        d[p * 4] = Math.min(255, mean[m] / cnt * k2);
        d[p * 4 + 1] = Math.min(255, mean[m + 1] / cnt * k2);
        d[p * 4 + 2] = Math.min(255, mean[m + 2] / cnt * k2);
        d[p * 4 + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      out.push(c);
      var spread = Math.max(0.5, size * 0.35);
      var next = [];
      cells.forEach(function (cc) {
        var a = r() * TAU;
        var ox = Math.cos(a) * spread, oy = Math.sin(a) * spread;
        next.push([Math.max(0, Math.min(cols, cc[0] + ox)), Math.max(0, Math.min(rows, cc[1] + oy))]);
        next.push([Math.max(0, Math.min(cols, cc[0] - ox)), Math.max(0, Math.min(rows, cc[1] - oy))]);
      });
      cells = next;
    }
    return out;
  };

  window.Systems = S;
})();
