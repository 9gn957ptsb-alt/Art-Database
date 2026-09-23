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
        return [a, b, c, "rgb(" + data[i] + "," + data[i + 1] + "," + data[i + 2] + ")",
                [data[i], data[i + 1], data[i + 2], data[i + 3]]];
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

  // ---- noise -------------------------------------------------------------------------

  /* Value noise in three dimensions, smooth between its lattice points. The
     weather is made of it. */
  function Noise(seed) {
    var r = rng(seed || 1), p = [], i;
    this.p = new Uint8Array(512);
    this.v = new Float32Array(256);
    for (i = 0; i < 256; i += 1) { p.push(i); this.v[i] = r(); }
    for (i = 255; i > 0; i -= 1) {
      var j = Math.floor(r() * (i + 1)), t = p[i];
      p[i] = p[j];
      p[j] = t;
    }
    for (i = 0; i < 512; i += 1) { this.p[i] = p[i & 255]; }
  }
  Noise.prototype.at = function (x, y, z) {
    var p = this.p, v = this.v;
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    xi &= 255; yi &= 255; zi &= 255;
    var u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf), s = zf * zf * (3 - 2 * zf);
    var a = p[xi] + yi, b = p[xi + 1] + yi;
    var aa = p[a] + zi, ab = p[a + 1] + zi, ba = p[b] + zi, bb = p[b + 1] + zi;
    var x1 = v[p[aa]] + (v[p[ba]] - v[p[aa]]) * u;
    var x2 = v[p[ab]] + (v[p[bb]] - v[p[ab]]) * u;
    var x3 = v[p[aa + 1]] + (v[p[ba + 1]] - v[p[aa + 1]]) * u;
    var x4 = v[p[ab + 1]] + (v[p[bb + 1]] - v[p[ab + 1]]) * u;
    var y1 = x1 + (x2 - x1) * w, y2 = x3 + (x4 - x3) * w;
    return y1 + (y2 - y1) * s;
  };
  Noise.prototype.fbm = function (x, y, z, octaves) {
    var sum = 0, amp = 0.5, norm = 0;
    for (var o = 0; o < (octaves || 3); o += 1) {
      sum += this.at(x, y, z) * amp;
      norm += amp;
      amp *= 0.5;
      x *= 2.03; y *= 2.03; z *= 2.03;
    }
    return sum / norm;
  };
  S.Noise = Noise;

  // ---- pixels ------------------------------------------------------------------------

  /* A very small rasteriser for pixel art: shapes filled whole pixels at a
     time from a three-step ramp — lit, body, shade — by which way each
     pixel faces, then a dark line round the lot. No smoothing anywhere,
     which is what makes it pixel art rather than a small drawing. */
  var INK = [26, 20, 46];
  var EYE = [255, 255, 254];               // marked, so night can make it glow
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function ramp(rgb) { return [mix(rgb, [255, 250, 240], 0.36), rgb, mix(rgb, INK, 0.4)]; }
  S.ramp = ramp;

  function Pix(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  Pix.prototype.set = function (x, y, c) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) { return; }
    var o = (y * this.w + x) * 4;
    this.d[o] = c[0]; this.d[o + 1] = c[1]; this.d[o + 2] = c[2]; this.d[o + 3] = 255;
  };
  Pix.prototype.filled = function (x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) { return false; }
    return this.d[(y * this.w + x) * 4 + 3] > 0;
  };
  // An ellipse, lit from the upper left and a little in front.
  Pix.prototype.blob = function (cx, cy, rx, ry, rp, pattern) {
    rx = Math.max(0.6, rx); ry = Math.max(0.6, ry);
    for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
      for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
        var nx = (x + 0.5 - cx) / rx, ny = (y + 0.5 - cy) / ry, d2 = nx * nx + ny * ny;
        if (d2 > 1) { continue; }
        var lit = -0.42 * nx - 0.62 * ny + 0.66 * Math.sqrt(1 - d2);
        var k = lit > 0.66 ? 0 : lit > 0.12 ? 1 : 2;
        var c = pattern ? pattern(x, y, nx, ny, k) : null;
        this.set(x, y, c || rp[k]);
      }
    }
  };
  // A limb: a thick segment, its upper edge lit and its lower in shade.
  Pix.prototype.limb = function (x0, y0, x1, y1, t, rp) {
    var dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6, half = t / 2;
    var nx = -dy / Math.sqrt(L2), ny = dx / Math.sqrt(L2);
    if (ny > 0) { nx = -nx; ny = -ny; }                         // the normal that points up
    for (var y = Math.floor(Math.min(y0, y1) - half); y <= Math.ceil(Math.max(y0, y1) + half); y += 1) {
      for (var x = Math.floor(Math.min(x0, x1) - half); x <= Math.ceil(Math.max(x0, x1) + half); x += 1) {
        var px = x + 0.5 - x0, py = y + 0.5 - y0;
        var s = Math.max(0, Math.min(1, (px * dx + py * dy) / L2));
        var ex = px - dx * s, ey = py - dy * s;
        var d = Math.sqrt(ex * ex + ey * ey);
        if (d > half + 0.02) { continue; }
        var side = (ex * nx + ey * ny) / Math.max(0.5, half);
        this.set(x, y, t < 1.6 ? rp[1] : side > 0.45 ? rp[0] : side < -0.45 ? rp[2] : rp[1]);
      }
    }
  };
  Pix.prototype.rect = function (x, y, w, h, c) {
    for (var j = 0; j < h; j += 1) { for (var i = 0; i < w; i += 1) { this.set(x + i, y + j, c); } }
  };
  Pix.prototype.eye = function (x, y, look) {
    this.set(x, y, EYE);
    this.set(x + (look || 1), y, INK);
  };
  // A dark line round everything drawn, where it meets empty space.
  Pix.prototype.outline = function (c) {
    var w = this.w, h = this.h, add = [];
    for (var y = 0; y < h; y += 1) {
      for (var x = 0; x < w; x += 1) {
        if (this.filled(x, y)) { continue; }
        if (this.filled(x - 1, y) || this.filled(x + 1, y) || this.filled(x, y - 1) || this.filled(x, y + 1)) {
          add.push(x, y);
        }
      }
    }
    for (var i = 0; i < add.length; i += 2) { this.set(add[i], add[i + 1], c || INK); }
  };
  Pix.prototype.onto = function (g, ox, oy) {
    g.putImageData(new ImageData(this.d, this.w, this.h), ox, oy);
  };
  S.Pix = Pix;

  /* Frames laid side by side on one canvas, drawn once: a day sheet, and a
     night one in which the body is dark and the eyes shine. */
  function sheetOf(fw, fh, frames, drawFrame) {
    var day = document.createElement("canvas");
    day.width = fw * frames;
    day.height = fh;
    var g = day.getContext("2d");
    for (var f = 0; f < frames; f += 1) {
      var px = new Pix(fw, fh);
      drawFrame(px, f / frames, f);
      px.outline();
      px.onto(g, f * fw, 0);
    }
    var night = document.createElement("canvas");
    night.width = day.width;
    night.height = fh;
    var ng = night.getContext("2d");
    var im = g.getImageData(0, 0, day.width, fh), d = im.data;
    for (var o = 0; o < d.length; o += 4) {
      if (!d[o + 3]) { continue; }
      if (d[o] === 255 && d[o + 1] === 255 && d[o + 2] === 254) {
        d[o] = 255; d[o + 1] = 214; d[o + 2] = 120;
      } else {
        d[o] = d[o] * 0.42 + 10; d[o + 1] = d[o + 1] * 0.42 + 8; d[o + 2] = d[o + 2] * 0.5 + 26;
      }
    }
    ng.putImageData(im, 0, 0);
    return { day: day, night: night, fw: fw, fh: fh, frames: frames };
  }

  /* Two-bone reach: where the knee goes, for a hip, a foot and the two
     lengths, bent the way it is told. */
  function knee(hx, hy, fx, fy, l1, l2, bend) {
    var dx = fx - hx, dy = fy - hy, d = Math.sqrt(dx * dx + dy * dy);
    d = Math.max(0.01, Math.min(l1 + l2 - 0.01, d));
    var a = Math.atan2(dy, dx);
    var c = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
    var k = a + c * (bend || 1);
    return [hx + Math.cos(k) * l1, hy + Math.sin(k) * l1];
  }

  /* Where a foot is, at a point in the cycle: on the ground and going back
     under the body for the stance, then lifted and swung forward. */
  function foot(phase, duty, reach, lift) {
    var p = ((phase % 1) + 1) % 1;
    if (p < duty) { return [reach / 2 - reach * (p / duty), 0]; }
    var s = (p - duty) / (1 - duty);
    return [-reach / 2 + reach * s, -Math.sin(Math.PI * s) * lift];
  }

  function pickColours(list, r, n) {
    var all = (list && list.length ? list : ["#5e52c7", "#d6b05c", "#9d95e6", "#c96f5a"]).map(hexRgb);
    var out = [];
    for (var i = 0; i < n; i += 1) {
      out.push(vivid(all[Math.floor(r() * all.length)], 1.45 + r() * 0.5));
    }
    return out;
  }

  // ---- gaits -------------------------------------------------------------------------

  /* After Universal Everything, Migrations: the way real animals move, lent
     to bodies nobody has seen. Six gaits, each the footfall of an animal —
     the timing of which foot is down when is the animal, whatever wears it —
     and a body made up afresh around it every time:

       stomp    an elephant's walk: four feet, the lateral sequence, three
                down at any time, the body rising and settling twice a stride
       run      an ostrich's run: two long legs, knees bent backward, only
                ever one foot down, the head bobbing
       hop      a kangaroo's hop: both feet together, the tail a third foot
       crawl    a caterpillar's crawl: a wave of lifted segments passing
                from tail to head
       swoop    a bird's flight: the wingbeat, glide and shadow
       scuttle  an insect's tripod: three feet down, three swinging

     Returns a sheet of eight frames facing right, the ground point, and how
     fast it goes, in its own pixels a second. */
  var GAIT_NAMES = ["stomp", "run", "hop", "crawl", "swoop", "scuttle"];
  S.GAITS = GAIT_NAMES;

  S.creature = function (seed, colours, gait) {
    var r = rng(seed);
    gait = gait || GAIT_NAMES[Math.floor(r() * GAIT_NAMES.length)];
    var cs = pickColours(colours, r, 3);
    var body = ramp(cs[0]), accent = ramp(cs[1]), third = ramp(cs[2]);
    var far = ramp(mix(cs[0], INK, 0.3));
    var markings = ["plain", "spots", "stripes", "saddle", "belly"][Math.floor(r() * 5)];
    function pattern(ox, oy) {
      return function (x, y, nx, ny, k) {
        if (markings === "spots" && hash2d(x - ox, y - oy, seed) < 0.16 && ny > -0.6) { return accent[k]; }
        if (markings === "stripes" && ((x - ox + 64) % 4 === 0) && ny < 0.5) { return accent[Math.min(2, k + 1)]; }
        if (markings === "saddle" && ny < -0.15 && Math.abs(nx) < 0.55) { return accent[k]; }
        if (markings === "belly" && ny > 0.35) { return third[Math.min(1, k)]; }
        return null;
      };
    }
    var eyes = 1 + Math.floor(r() * r() * 3);
    var fw, fh, ground, speed, stride, air = 0, draw;

    if (gait === "stomp") {
      var brx = 9 + r() * 4, bry = 5.5 + r() * 2.5, leg = 5 + r() * 3, thick = 3 + Math.floor(r() * 2);
      var head = 3 + r() * 2, trunk = r() < 0.6, tusks = r() < 0.4, ridge = r() < 0.5;
      fw = Math.ceil(brx * 2 + head * 2 + 12); fh = Math.ceil(bry * 2 + leg + head + 8);
      ground = fh - 3; stride = brx * 0.9; speed = 6 + r() * 4;
      draw = function (px, phase) {
        var bx = fw / 2 - 2, by = ground - leg - bry + 1 - Math.abs(Math.sin(TAU * phase * 2)) * 0.9;
        var hips = [bx + brx * 0.55, bx - brx * 0.55];
        var offs = [0, 0.5, 0.25, 0.75];                      // lateral sequence: LH, LF, RH, RF
        [[1, 1], [0, 3]].forEach(function (lg) {             // the far side first, darker
          var f = foot(phase + offs[lg[1]], 0.75, stride * 0.75, 2.2);
          px.limb(hips[lg[0]] - 1, by + 2, hips[lg[0]] - 1 + f[0], ground + f[1], thick, far);
        });
        px.blob(bx, by, brx, bry, body, pattern(bx, by));
        if (ridge) { for (var i = -3; i <= 3; i += 1) { px.set(bx + i * 2, by - bry - (i % 2 ? 0 : 1), accent[0]); } }
        [[0, 0], [1, 2]].forEach(function (lg) {
          var f = foot(phase + offs[lg[1]], 0.75, stride * 0.75, 2.2);
          px.limb(hips[lg[0]], by + 2, hips[lg[0]] + f[0], ground + f[1], thick, body);
        });
        var hx = bx + brx + head * 0.4, hy = by - bry * 0.3 + Math.sin(TAU * phase * 2) * 0.5;
        px.blob(hx, hy, head, head * 0.9, body);
        if (trunk) {
          var sw = Math.sin(TAU * phase) * 1.5;
          px.limb(hx + head * 0.7, hy + 1, hx + head + 1 + sw * 0.3, hy + head + 2, 2, body);
          px.limb(hx + head + 1 + sw * 0.3, hy + head + 2, hx + head + 2 + sw, ground - 2, 1.5, body);
        }
        if (tusks) { px.limb(hx + head * 0.6, hy + head * 0.6, hx + head + 2, hy + head * 0.9, 1, third); }
        for (var e = 0; e < eyes; e += 1) { px.eye(hx + e * 2 - 1, hy - 1 - (e % 2), 1); }
      };
    } else if (gait === "run") {
      var rrx = 5 + r() * 3, rry = 4 + r() * 2, l1 = 6 + r() * 3, l2 = 6 + r() * 3, neck = 7 + r() * 6;
      var plume = 2 + Math.floor(r() * 3);
      fw = Math.ceil(rrx * 2 + neck + 14); fh = Math.ceil(l1 + l2 + rry * 2 + neck + 6);
      ground = fh - 3; stride = (l1 + l2) * 0.9; speed = 20 + r() * 12;
      draw = function (px, phase) {
        var bob = Math.abs(Math.cos(TAU * phase)) * 1.6;
        var bx = fw / 2 - 3, by = ground - l1 - l2 + 2 - bob;
        [0.5, 0].forEach(function (off, i) {
          var f = foot(phase + off, 0.38, stride, 3.5);
          var hx = bx, hy = by + 1;
          var fx = hx + f[0], fy = ground + f[1];
          var k = knee(hx, hy, fx, fy, l1, l2, -1);        // bent backward, like a bird's
          px.limb(hx, hy, k[0], k[1], 1.6, i ? body : far);
          px.limb(k[0], k[1], fx, fy, 1.2, i ? accent : far);
          px.set(fx + 1, fy - 0.5, i ? accent[2] : far[2]);
        });
        for (var q = 0; q < plume; q += 1) {
          px.limb(bx - rrx + 1, by - 1, bx - rrx - 3 - q, by - 3 - q * 1.5 + Math.sin(TAU * phase + q) * 0.8, 1.2, third);
        }
        px.blob(bx, by, rrx, rry, body, pattern(bx, by));
        var nod = Math.sin(TAU * phase * 2) * 1.2;
        var tx = bx + rrx * 0.6 + neck * 0.45 + nod, ty = by - neck;
        px.limb(bx + rrx * 0.6, by - 1, tx, ty, 1.7, body);
        px.blob(tx + 1, ty - 1, 2.4, 2, body);
        px.limb(tx + 3, ty - 1, tx + 5, ty, 1, accent);
        for (var e = 0; e < eyes; e += 1) { px.eye(tx + e * 2, ty - 2 - e, 1); }
      };
    } else if (gait === "hop") {
      var hrx = 5 + r() * 2, hry = 6 + r() * 3, thigh = 5 + r() * 2, shin = 5 + r() * 3, ear = 3 + r() * 5;
      fw = Math.ceil(hrx * 2 + 22); fh = Math.ceil(hry * 2 + thigh + shin + ear + 14);
      ground = fh - 3; stride = 18 + r() * 8; speed = 16 + r() * 8;
      draw = function (px, phase) {
        var down = 0.32;                                      // the part of the hop on the ground
        var up = phase < down ? 0 : Math.sin(Math.PI * (phase - down) / (1 - down)) * 9;
        var crouch = phase < down ? Math.sin(Math.PI * phase / down) * 2.5 : 0;
        var tilt = phase < down ? 0.2 : -0.35 * Math.sin(Math.PI * (phase - down) / (1 - down)) + 0.1;
        var bx = fw / 2 - 1, by = ground - thigh - shin - hry * 0.4 - up + crouch;
        var hipx = bx - 1, hipy = by + hry * 0.5;
        var fx = phase < down ? hipx + 2 - phase * 6 : hipx - 3 - up * 0.3, fy = phase < down ? ground : ground - up * 0.85;
        // the tail, a third foot
        px.limb(bx - hrx + 1, by + hry * 0.4, bx - hrx - 6, Math.min(ground, by + hry + 5 - up * 0.2), 2.4, far);
        var k = knee(hipx, hipy, fx, fy, thigh, shin, 1);
        px.limb(hipx - 1, hipy, k[0] - 1, k[1], 3, far);
        px.limb(k[0] - 1, k[1], fx - 1, fy, 2, far);
        px.blob(bx, by, hrx, hry, body, pattern(bx, by));
        px.limb(hipx, hipy, k[0], k[1], 3.4, body);
        px.limb(k[0], k[1], fx, fy, 2, body);
        px.limb(fx, fy, fx + 3, fy, 1.2, accent);
        var hx = bx + hrx * 0.5 + tilt * 3, hy = by - hry - 1;
        px.limb(hx - 1, hy - 1, hx - 2 - tilt * 2, hy - ear, 1.7, accent);
        px.limb(hx + 1, hy - 1, hx + 1 - tilt * 2, hy - ear + 1, 1.7, body);
        px.blob(hx, hy, 3, 2.6, body);
        px.limb(bx + hrx - 1, by, bx + hrx + 2, by + 2 + crouch, 1.2, body);   // the small arms
        for (var e = 0; e < eyes; e += 1) { px.eye(hx + e, hy - 1 - e, 1); }
      };
    } else if (gait === "crawl") {
      var n = 7 + Math.floor(r() * 5), seg = 2.4 + r() * 1.4, gap = seg * 1.35;
      var horns = r() < 0.6, hairs = r() < 0.5;
      fw = Math.ceil(n * gap + seg * 2 + 10); fh = Math.ceil(seg * 2 + 12);
      ground = fh - 3; stride = gap * 1.6; speed = 3 + r() * 3;
      draw = function (px, phase) {
        var xs = [], x = 4 + seg;
        for (var i = 0; i < n; i += 1) {
          var lift = Math.max(0, Math.sin(TAU * (phase - i / n * 0.9)));
          lift = lift * lift;
          xs.push([x, lift]);
          x += gap * (1 - 0.3 * lift);
        }
        xs.forEach(function (s, i) {
          var cy = ground - seg - s[1] * 2.6;
          if (s[1] < 0.2) { px.set(s[0], ground, far[2]); }
          px.blob(s[0], cy, seg, seg, i % 2 ? body : accent);
          if (hairs && i % 2) { px.set(s[0], cy - seg - 1, third[0]); }
        });
        var h = xs[n - 1], hy = ground - seg - h[1] * 2.6;
        px.blob(h[0] + seg * 0.8, hy - 0.5, seg * 1.1, seg * 1.05, third);
        if (horns) {
          px.limb(h[0] + seg, hy - seg, h[0] + seg + 2, hy - seg - 3, 1, accent);
          px.set(h[0] + seg + 2, hy - seg - 4, third[0]);
        }
        for (var e = 0; e < eyes; e += 1) { px.eye(h[0] + seg * 0.8 + e, hy - 1 - e, 1); }
      };
    } else if (gait === "swoop") {
      var wrx = 5 + r() * 3, wry = 2.4 + r() * 1.2, arm = 5 + r() * 3, hand = 4 + r() * 4, tail = 2 + Math.floor(r() * 3);
      air = 14 + Math.round(r() * 6);
      fw = Math.ceil((arm + hand) * 2 + wrx * 2 + 8); fh = Math.ceil(air + (arm + hand) * 2 + 8);
      ground = fh - 3; stride = 28; speed = 18 + r() * 10;
      draw = function (px, phase) {
        var flap = Math.sin(TAU * phase);
        var bx = fw / 2, by = ground - air + flap * 1.2;
        var a1 = -flap * 0.95, a2 = a1 * 1.4 + (flap < 0 ? 0.35 : -0.1);
        [far, body].forEach(function (rp, i) {
          var sx = bx + (i ? -1 : 1), sy = by - 1;
          var ex = sx + Math.cos(a1 - Math.PI / 2) * arm * (i ? 0.2 : 0.15) - 1, ey = sy + Math.sin(a1 - Math.PI / 2) * arm;
          var tx = ex - 2 + Math.cos(a2 - Math.PI / 2) * hand * 0.3, ty = ey + Math.sin(a2 - Math.PI / 2) * hand;
          px.limb(sx, sy, ex, ey, 2.6, rp);
          px.limb(ex, ey, tx, ty, 1.8, i ? accent : rp);
        });
        for (var q = 0; q < tail; q += 1) { px.limb(bx - wrx, by, bx - wrx - 4, by - 1 + q * 1.5, 1.2, third); }
        px.blob(bx, by, wrx, wry, body, pattern(bx, by));
        px.blob(bx + wrx + 1, by - 1, 2.2, 2, body);
        px.limb(bx + wrx + 3, by - 1, bx + wrx + 5, by, 1, accent);
        for (var e = 0; e < eyes; e += 1) { px.eye(bx + wrx + 1 + e, by - 2, 1); }
      };
    } else {                                                  // scuttle
      var srx = 5 + r() * 3, sry = 2.6 + r() * 1.4, reach = 4 + r() * 3, two = r() < 0.6;
      fw = Math.ceil(srx * 4 + reach * 2 + 8); fh = Math.ceil(sry * 2 + reach + 10);
      ground = fh - 3; stride = reach * 1.2; speed = 12 + r() * 8;
      draw = function (px, phase) {
        var bx = fw / 2 - 1, by = ground - reach * 0.7 - sry;
        var tri = [0, 0.5, 0, 0.5, 0, 0.5];                   // the tripod: 1, 4, 5 down together
        var hips = [bx + srx * 0.6, bx, bx - srx * 0.6];
        hips.forEach(function (hx, i) {
          var f = foot(phase + tri[i * 2 + 1], 0.5, stride, 2);
          var k = knee(hx, by, hx + f[0] + (i - 1) * -2, ground + f[1], reach * 0.7, reach * 0.8, 1);
          px.limb(hx, by, k[0], k[1] - 1.5, 1.2, far);
          px.limb(k[0], k[1] - 1.5, hx + f[0] + (i - 1) * -2, ground + f[1], 1, far);
        });
        if (two) { px.blob(bx - srx * 0.9, by + 0.5, srx * 0.9, sry * 1.1, body, pattern(bx, by)); }
        px.blob(bx, by, srx, sry, two ? accent : body, two ? null : pattern(bx, by));
        hips.forEach(function (hx, i) {
          var f = foot(phase + tri[i * 2], 0.5, stride, 2);
          var fx = hx + f[0] + (i - 1) * -3, fy = ground + f[1];
          var k = knee(hx, by + 1, fx, fy, reach * 0.7, reach * 0.8, 1);
          px.limb(hx, by + 1, k[0], k[1] - 1.5, 1.3, body);
          px.limb(k[0], k[1] - 1.5, fx, fy, 1, body);
        });
        var hx = bx + srx + 1.5;
        px.blob(hx, by - 0.5, 2.2, 2, third);
        px.limb(hx + 1, by - 2, hx + 5, by - 5 + Math.sin(TAU * phase * 2), 1, third);
        px.limb(hx, by - 2, hx + 3, by - 6 - Math.cos(TAU * phase * 2), 1, third);
        for (var e = 0; e < eyes; e += 1) { px.eye(hx + e, by - 1 - e, 1); }
      };
    }
    fw = Math.max(12, Math.ceil(fw)); fh = Math.max(12, Math.ceil(fh));
    var sheet = sheetOf(fw, fh, 8, draw);
    sheet.gait = gait;
    sheet.groundX = fw / 2;
    sheet.groundY = ground;
    sheet.stride = stride;
    sheet.speed = speed;
    sheet.air = air;
    sheet.colour = cs[0];
    return sheet;
  };

  // ---- the company -------------------------------------------------------------------

  /* The herd, made meaningful (artist's request, 23 Sep 2026: the
     characters should be "built more towards me"). Not bodies nobody has
     seen any more but a company out of what he reads and loves, each
     moving the way its animal really moves:

       horse     the sorrel nag of Raskolnikov's dream, the cab-horse Nietzsche
                 put his arms round in Turin, McCarthy's horses: a trot, the
                 diagonal pairs together. It will not be hurried off.
       camel     Zarathustra's first metamorphosis, the spirit that kneels to
                 be loaded; a pace, both legs on one side together, as camels
                 really go. Arriving, it becomes the
       lion      that says "I will", on a walk; and the lion becomes the
       child     "innocence and forgetting, a new beginning, a game, a wheel
                 rolling out of itself": a child bowling a hoop. And then the
                 camel again, which is the eternal return.
       eagle     Zarathustra's eagle, the serpent coiled round its neck, "not
                 like prey but like a friend".
       road      a man and a boy with a cart, walking south; the boy carries
                 the fire, which is the light in his hand, and it glows at
                 night.
       bat       the night's. Bats are out only where it is dark on the real
                 Earth, at the moment it is looked at.

     Nothing on the page names any of them. Same sheet as S.creature: eight
     frames facing right, the ground point, speed and stride. */
  var FIGURES = {
    horse: [150, 88, 56], camel: [198, 162, 112], lion: [204, 150, 72], child: [226, 196, 170],
    eagle: [112, 80, 52], road: [104, 102, 108], bat: [54, 44, 66]
  };
  S.FIGURES = Object.keys(FIGURES);

  function tri(px, a, b, c, col) {
    var x0 = Math.floor(Math.min(a[0], b[0], c[0])), x1 = Math.ceil(Math.max(a[0], b[0], c[0]));
    var y0 = Math.floor(Math.min(a[1], b[1], c[1])), y1 = Math.ceil(Math.max(a[1], b[1], c[1]));
    function e(p, q, x, y) { return (q[0] - p[0]) * (y - p[1]) - (q[1] - p[1]) * (x - p[0]); }
    for (var y = y0; y <= y1; y += 1) {
      for (var x = x0; x <= x1; x += 1) {
        var X = x + 0.5, Y = y + 0.5;
        var w0 = e(b, c, X, Y), w1 = e(c, a, X, Y), w2 = e(a, b, X, Y);
        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) { px.set(x, y, col); }
      }
    }
  }

  S.figure = function (kind, seed, colours) {
    var r = rng(seed);
    var tint = pickColours(colours, r, 2);
    var base = FIGURES[kind] || FIGURES.horse;
    var body = ramp(mix(base, tint[0], 0.14));
    var far = ramp(mix(body[1], INK, 0.32));
    var accent = ramp(vivid(tint[1], 1.2));
    var dark = ramp(mix(base, INK, 0.62));
    var fw, fh, ground, speed, stride, air = 0, flap = 1, size = 1, draw, gait = "walk";

    if (kind === "horse") {
      var brx = 8.5, bry = 3.6, l1 = 5, l2 = 5.5, neck = 7;
      fw = 40; fh = 28; ground = fh - 3; stride = 12; speed = 13;
      var hoof = ramp(mix(base, INK, 0.75)), mane = ramp(mix(base, INK, 0.5));
      draw = function (px, phase) {
        var bob = Math.abs(Math.sin(TAU * phase)) * 0.8;
        var bx = fw / 2 - 2, by = ground - l1 - l2 - bry * 0.4 - bob;
        var fore = bx + brx * 0.62, hind = bx - brx * 0.62;
        // trot: LF with RH, RF with LH. Far pair first.
        [[fore - 1, 0.5, 1], [hind - 1, 0, -1]].forEach(function (lg) {
          var f = foot(phase + lg[1], 0.45, stride, 3);
          var fx = lg[0] + f[0], fy = ground + f[1];
          var k = knee(lg[0], by + 1, fx, fy, l1, l2, lg[2]);
          px.limb(lg[0], by + 1, k[0], k[1], 1.8, far);
          px.limb(k[0], k[1], fx, fy, 1.2, far);
          px.set(fx, fy, hoof[2]);
        });
        var sw = Math.sin(TAU * phase) * 1.2;
        px.limb(bx - brx + 1, by - 1, bx - brx - 3, by + 2, 2.2, mane);            // the tail
        px.limb(bx - brx - 3, by + 2, bx - brx - 4 + sw, by + 7, 1.6, mane);
        px.blob(bx, by, brx, bry, body);
        [[fore, 0, 1], [hind, 0.5, -1]].forEach(function (lg) {
          var f = foot(phase + lg[1], 0.45, stride, 3);
          var fx = lg[0] + f[0], fy = ground + f[1];
          var k = knee(lg[0], by + 1, fx, fy, l1, l2, lg[2]);
          px.limb(lg[0], by + 1, k[0], k[1], 2, body);
          px.limb(k[0], k[1], fx, fy, 1.3, body);
          px.set(fx, fy, hoof[2]); px.set(fx + 1, fy, hoof[2]);
        });
        var nod = Math.sin(TAU * phase * 2) * 0.7;
        var nx0 = bx + brx - 2, ny0 = by - 1, hx = nx0 + neck * 0.55, hy = ny0 - neck + 1 + nod;
        px.limb(nx0, ny0, hx, hy, 3.4, body);
        for (var m = 0; m < 5; m += 1) { px.set(nx0 - 1 + (hx - nx0) * m / 5, ny0 - 2 + (hy - ny0) * m / 5, mane[1]); }
        px.limb(hx, hy, hx + 5, hy + 3, 2.6, body);                               // the long head
        px.set(hx - 1, hy - 2, body[2]); px.set(hx, hy - 2, body[1]);               // the ears
        px.eye(hx + 1, hy, 1);
        px.set(hx + 5, hy + 3, hoof[2]);
      };
    } else if (kind === "camel" || kind === "lion") {
      var camel = kind === "camel";
      var crx = camel ? 7.5 : 7, cry = camel ? 3.4 : 3.2, c1 = camel ? 6 : 4, c2 = camel ? 6.5 : 4;
      fw = 40; fh = camel ? 34 : 24; ground = fh - 3;
      stride = camel ? 13 : 9; speed = camel ? 8 : 11;
      var pad = ramp(mix(base, INK, 0.55));
      var maneR = ramp(mix([122, 70, 40], tint[0], 0.12));
      // camels pace (a side together); lions walk the lateral sequence
      var offs = camel ? [0, 0, 0.5, 0.5] : [0, 0.5, 0.25, 0.75];     // LF, RF, LH, RH
      draw = function (px, phase) {
        var bob = camel ? Math.sin(TAU * phase * 2) * 0.3 : Math.abs(Math.sin(TAU * phase * 2)) * 0.5;
        var sway = camel ? Math.sin(TAU * phase) * 0.6 : 0;
        var bx = fw / 2 - 2, by = ground - c1 - c2 - cry * 0.3 - bob;
        var fore = bx + crx * 0.6, hind = bx - crx * 0.6;
        [[fore - 1, offs[1]], [hind - 1, offs[3]]].forEach(function (lg, i) {
          var f = foot(phase + lg[1], camel ? 0.6 : 0.68, stride, 2.4);
          var fx = lg[0] + f[0], fy = ground + f[1];
          var k = knee(lg[0], by + 1, fx, fy, c1, c2, i ? -1 : 1);
          px.limb(lg[0], by + 1, k[0], k[1], camel ? 1.6 : 2.2, far);
          px.limb(k[0], k[1], fx, fy, camel ? 1.2 : 1.8, far);
        });
        if (!camel) {                                                            // the tail and its tuft
          px.limb(bx - crx + 1, by - 1, bx - crx - 5, by + 1 + Math.sin(TAU * phase) * 1.5, 1.2, body);
          px.blob(bx - crx - 5.5, by + 1.5 + Math.sin(TAU * phase) * 1.5, 1.3, 1.3, maneR);
        } else {
          px.limb(bx - crx + 1, by - 1, bx - crx - 1, by + 4, 1.2, body);
        }
        px.blob(bx + sway * 0.3, by, crx, cry, body);
        if (camel) {
          px.blob(bx - 2 + sway * 0.3, by - cry - 1.5, 3.4, 3, body);          // the hump
          // the load it knelt for
          px.rect(bx - 6 + sway * 0.3, by - cry - 4, 9, 3, accent[1]);
          px.rect(bx - 6 + sway * 0.3, by - cry - 4, 9, 1, accent[0]);
          px.rect(bx - 5 + sway * 0.3, by - cry - 1, 1, 4, accent[2]);
          px.rect(bx + 1 + sway * 0.3, by - cry - 1, 1, 4, accent[2]);
        }
        [[fore, offs[0]], [hind, offs[2]]].forEach(function (lg, i) {
          var f = foot(phase + lg[1], camel ? 0.6 : 0.68, stride, 2.4);
          var fx = lg[0] + f[0], fy = ground + f[1];
          var k = knee(lg[0], by + 1, fx, fy, c1, c2, i ? -1 : 1);
          px.limb(lg[0], by + 1, k[0], k[1], camel ? 1.8 : 2.4, body);
          px.limb(k[0], k[1], fx, fy, camel ? 1.3 : 2, body);
          px.set(fx + 1, fy, pad[2]);
        });
        if (camel) {                                                             // the neck, down and up
          var nx0 = bx + crx - 1, ny0 = by;
          px.limb(nx0, ny0, nx0 + 4, ny0 + 2, 2.6, body);
          px.limb(nx0 + 4, ny0 + 2, nx0 + 7, ny0 - 6 + bob, 2.2, body);
          var hx = nx0 + 8, hy = ny0 - 7 + bob;
          px.blob(hx, hy, 2.4, 1.6, body);
          px.eye(hx, hy - 1, 1);
        } else {
          var lx = bx + crx + 1, ly = by - 2 + bob * 0.5;
          px.blob(lx, ly, 4.6, 4.4, maneR);                                      // the mane
          px.blob(lx + 2, ly + 0.5, 2.6, 2.3, body);
          px.set(lx + 4.5, ly + 1, pad[2]);
          px.eye(lx + 2, ly - 0.5, 1);
        }
      };
    } else if (kind === "child") {
      fw = 30; fh = 24; ground = fh - 3; stride = 7; speed = 10; size = 0.8;
      var skin = ramp(base), shirt = accent, legs = ramp(mix(tint[1], INK, 0.45)), wood = ramp([168, 116, 64]);
      draw = function (px, phase) {
        var b = Math.abs(Math.cos(TAU * phase)) * 1.2;
        var hipX = 11, hipY = ground - 5 - b;
        [0.5, 0].forEach(function (off, i) {
          var f = foot(phase + off, 0.5, stride, 2.4);
          var k = knee(hipX, hipY, hipX + f[0], ground + f[1], 2.6, 2.8, 1);
          px.limb(hipX, hipY, k[0], k[1], 1.6, i ? legs : far);
          px.limb(k[0], k[1], hipX + f[0], ground + f[1], 1.6, i ? legs : far);
        });
        px.blob(hipX, hipY - 3, 2.4, 3.2, shirt);
        px.blob(hipX + 0.5, hipY - 8.5, 3, 3, skin);                              // a big head
        px.eye(hipX + 2, hipY - 9, 1);
        px.rect(hipX - 2, hipY - 12, 5, 1, dark[1]);
        // the hoop, rolling out of itself, and the stick that keeps it going
        var hx = 22, hy = ground - 5, rr = 5;
        for (var a = 0; a < 24; a += 1) {
          var t = a / 24 * TAU;
          px.set(hx + Math.cos(t) * rr, hy + Math.sin(t) * rr, (a + Math.floor(phase * 24)) % 6 === 0 ? wood[2] : wood[1]);
        }
        var sp = -phase * TAU;
        px.set(hx + Math.cos(sp) * (rr - 1), hy + Math.sin(sp) * (rr - 1), wood[0]);
        var swing = Math.sin(TAU * phase) * 0.4;
        px.limb(hipX + 1, hipY - 4, hipX + 4, hipY - 2 + swing, 1.3, skin);
        px.limb(hipX + 4, hipY - 2 + swing, hx - rr + 1, hy - 1, 1, wood);
      };
    } else if (kind === "eagle") {
      gait = "swoop"; air = 16; fw = 40; fh = 44; ground = fh - 3; stride = 28; speed = 16; flap = 0.7;
      var head = ramp([236, 226, 206]), beak = ramp([232, 180, 60]), snake = ramp([78, 132, 70]);
      // seen from in front, like the bats: wings wide and fingered, the
      // serpent round its neck and hanging down
      draw = function (px, phase) {
        var f = Math.sin(TAU * phase);
        var bx = fw / 2, by = ground - air - 8 + f * 1.2;
        for (var s = 0; s < 12; s += 1) {
          var sx = bx + 2 + Math.sin(s * 0.8 + TAU * phase) * 1.5, sy = by + 3 + s;
          px.set(sx, sy, snake[s % 3 === 0 ? 0 : 1]); px.set(sx + 1, sy, snake[2]);
        }
        tri(px, [bx - 2, by + 3], [bx + 2, by + 3], [bx, by + 8], body[2]);           // the tail
        tri(px, [bx - 3, by + 7], [bx + 3, by + 7], [bx, by + 4], body[2]);
        [-1, 1].forEach(function (sd) {
          var P = function (x, y) { return [bx + sd * x, by + y]; };
          var tip = P(16, -3 - 6 * f), wr = P(8, -3 - 4 * f);
          tri(px, P(1, -2), wr, P(2, 3), body[1]);
          tri(px, wr, tip, P(2, 3), body[1]);
          tri(px, wr, tip, P(6, -1 - 3 * f), body[0]);
          for (var q = 0; q < 5; q += 1) {                                           // the fingers
            var fx = 16.5 - q * 1.5, fy = -3 - 6 * f + q * 0.9 + 0.5;
            px.set(bx + sd * fx, by + fy, body[2]); px.set(bx + sd * fx, by + fy + 1, body[2]);
          }
        });
        px.blob(bx, by, 2.6, 3.4, body);
        px.blob(bx, by - 4, 2.2, 2, head);
        px.set(bx - 1.5, by - 2.5, snake[0]); px.set(bx - 0.5, by - 2, snake[1]); px.set(bx + 0.5, by - 2, snake[1]); px.set(bx + 1.5, by - 2.5, snake[2]);
        px.set(bx, by - 3, beak[1]); px.set(bx, by - 2.6, beak[2]);
        px.eye(bx - 1, by - 4.5, 1);
      };
    } else if (kind === "road") {
      fw = 46; fh = 30; ground = fh - 3; stride = 6; speed = 5;
      var coat = ramp(base), boy = ramp(mix(base, tint[0], 0.3)), wire = ramp([176, 176, 184]), face = ramp([214, 190, 170]);
      function walker(px, x, phase, legL, torso, headR, rp, hood) {
        var b = Math.abs(Math.cos(TAU * phase)) * 0.6, hipY = ground - legL - b;
        [0.5, 0].forEach(function (off, i) {
          var f = foot(phase + off, 0.62, stride * legL / 7, 1.4);
          var k = knee(x, hipY, x + f[0], ground + f[1], legL * 0.5, legL * 0.52, 1);
          px.limb(x, hipY, k[0], k[1], 1.6, i ? dark : far);
          px.limb(k[0], k[1], x + f[0], ground + f[1], 1.6, i ? dark : far);
        });
        for (var y = 0; y < torso; y += 1) {
          for (var xx = -2; xx <= 2; xx += 1) { px.set(x + xx - (y < 2 ? 1 : 0), hipY - torso + y, rp[xx < -1 ? 0 : xx > 1 ? 2 : 1]); }
        }
        var hy = hipY - torso - headR + 0.5;
        px.blob(x + 0.5, hy, headR, headR, hood ? rp : face);
        if (hood) { px.blob(x + 1.3, hy + 0.3, headR * 0.55, headR * 0.6, face); }
        return hipY - torso;
      }
      draw = function (px, phase) {
        // the cart, pushed ahead
        var cx0 = 27, cy0 = ground - 10, rattle = (Math.floor(phase * 8) % 2) * 0.5;
        for (var i = 0; i <= 12; i += 3) { px.limb(cx0 + i * 0.95, cy0 + rattle, cx0 + 1 + i * 0.8, cy0 + 6, 1, wire); }
        px.limb(cx0, cy0 + rattle, cx0 + 12, cy0 + rattle, 1, wire);
        px.limb(cx0 + 1, cy0 + 6, cx0 + 10, cy0 + 6, 1, wire);
        px.rect(cx0 + 2, cy0 + 1, 8, 3, accent[2]);                                   // what they have
        px.set(cx0 + 2, ground - 1, INK); px.set(cx0 + 10, ground - 1, INK);
        px.limb(cx0 + 1, cy0 + 6, cx0 + 2, ground - 2, 1, wire); px.limb(cx0 + 10, cy0 + 6, cx0 + 10, ground - 2, 1, wire);
        // the boy behind, carrying the fire
        var bt = walker(px, 7, phase + 0.3, 5, 4, 2, boy, false);
        var fl = Math.floor(phase * 16) % 3;
        px.limb(8, bt + 1.5, 10.5, bt + 3, 1.2, boy);
        px.set(11, bt + 2 - fl * 0.5, EYE); px.set(11, bt + 3, [236, 150, 60]);
        if (fl) { px.set(11, bt + 1 - fl * 0.5, [250, 206, 110]); }
        // the man, pushing
        var mt = walker(px, 20, phase, 8, 7, 2.6, coat, true);
        px.limb(21, mt + 2, cx0 - 0.5, cy0 + rattle, 1.4, coat);
      };
    } else {                                                                      // bat
      gait = "swoop"; air = 12; fw = 26; fh = 34; ground = fh - 3; stride = 20; speed = 22; flap = 3.4; size = 0.55;
      // seen from in front, wings spread, the trailing edge scalloped
      draw = function (px, phase) {
        var f = Math.sin(TAU * phase);
        var bx = fw / 2, by = ground - air - 4 + f * 1.4;
        [-1, 1].forEach(function (sd) {
          var pts = [[1, -2], [5, -3 - 3 * f], [10, -2 - 5 * f], [8.5, 1.5 - 4 * f], [7, -3 * f],
                     [5.5, 2.5 - 2.5 * f], [4, 1 - 1.5 * f], [2.5, 3 - 0.5 * f], [1, 1.5]];
          var P = pts.map(function (q) { return [bx + sd * q[0], by + q[1]]; });
          var o = [bx + sd * 1.5, by - 0.5];
          for (var i = 0; i < P.length - 1; i += 1) { tri(px, o, P[i], P[i + 1], body[i < 3 ? 1 : 2]); }
          px.limb(P[0][0], P[0][1], P[1][0], P[1][1], 1, dark);
          px.limb(P[1][0], P[1][1], P[2][0], P[2][1], 1, dark);
        });
        px.blob(bx, by, 1.8, 2.6, body);
        px.set(bx - 1, by - 3.5, body[1]); px.set(bx + 1, by - 3.5, body[1]);            // the ears
        px.set(bx - 1, by - 4.5, body[1]); px.set(bx + 1, by - 4.5, body[1]);
        px.eye(bx - 1, by - 2, 1);
      };
    }
    var sheet = sheetOf(fw, fh, 8, draw);
    sheet.kind = kind;
    sheet.gait = gait;
    sheet.groundX = fw / 2;
    sheet.groundY = ground;
    sheet.stride = stride;
    sheet.speed = speed;
    sheet.air = air;
    sheet.flap = flap;
    sheet.size = size;
    sheet.colour = body[1];
    return sheet;
  };

  function hash2d(x, y, s) {
    var n = (x * 374761393 + y * 668265263 + (s | 0) * 2147483647) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  // ---- people ------------------------------------------------------------------------

  /* After Universal Everything, Infinity: a procession with no loop in it.
     Every walker is made up as it is needed — its build, its head, its hat,
     what it is made of and how it walks — from a seed that is never used
     twice, so the procession goes on for as long as anyone watches and no
     one in it is the same as anyone before. */
  var BUILDS = ["block", "barrel", "cone", "wedge", "stack", "bean", "thin", "tall"];
  var HEADS = ["round", "square", "tall", "tiny", "huge", "wide"];
  var HATS = ["none", "none", "cone", "top", "crown", "antenna", "halo", "plume", "brim", "bun"];
  var WALKS = ["walk", "walk", "bounce", "march", "shuffle", "skip", "glide", "hop", "stilts"];
  var STUFF = ["plain", "stripes", "bands", "dots", "halves", "check", "speckle"];

  S.person = function (seed, colours) {
    var r = rng(seed);
    function one(list) { return list[Math.floor(r() * list.length)]; }
    var build = one(BUILDS), headKind = one(HEADS), hat = one(HATS), walk = one(WALKS), stuff = one(STUFF);
    var cs = pickColours(colours, r, 4);
    var coat = ramp(cs[0]), trim = ramp(cs[1]), skin = ramp(mix(cs[2], [246, 236, 222], 0.55)), legs = ramp(mix(cs[3], INK, 0.35));
    var legLen = walk === "stilts" ? 13 + r() * 5 : 6 + r() * 5;
    var torsoH = build === "tall" ? 11 + r() * 5 : build === "thin" ? 8 + r() * 5 : 6 + r() * 5;
    var torsoW = build === "thin" ? 2.5 : build === "barrel" || build === "cone" ? 4.5 + r() * 2.5 : 3.5 + r() * 2;
    var headR = headKind === "tiny" ? 1.8 : headKind === "huge" ? 4.5 + r() * 1.5 : 2.5 + r() * 1.2;
    var armLen = torsoH * (0.7 + r() * 0.4);
    var bob = walk === "bounce" || walk === "hop" ? 2.6 : walk === "shuffle" ? 0.4 : 1;
    var reach = walk === "shuffle" ? legLen * 0.45 : walk === "stilts" ? legLen * 0.5 : legLen * 0.8;
    var lift = walk === "march" ? legLen * 0.5 : walk === "shuffle" ? 0.6 : legLen * 0.25;
    var fw = Math.ceil(torsoW * 2 + armLen + reach + 12);
    var fh = Math.ceil(legLen + torsoH + headR * 2 + 16);
    var ground = fh - 3;
    function coatAt(x, y, nx, ny, k) {
      if (stuff === "stripes" && (x & 1) === 0) { return trim[k]; }
      if (stuff === "bands" && (Math.floor(y / 2) % 2) === 0) { return trim[k]; }
      if (stuff === "dots" && hash2d(x, y, seed) < 0.2) { return trim[Math.max(0, k - 1)]; }
      if (stuff === "halves" && nx > 0) { return trim[k]; }
      if (stuff === "check" && ((x >> 1) + (y >> 1)) % 2 === 0) { return trim[k]; }
      if (stuff === "speckle" && hash2d(x, y, seed + 3) < 0.35) { return coat[Math.min(2, k + 1)]; }
      return null;
    }
    function draw(px, phase) {
      var hopOn = walk === "hop" || walk === "skip";
      var b = walk === "hop" ? Math.max(0, Math.sin(TAU * phase)) * 3.4
            : walk === "skip" ? Math.abs(Math.sin(TAU * phase)) * 2.4
            : Math.abs(Math.cos(TAU * phase)) * bob * 0.6;
      var hipX = fw / 2 - 1, hipY = ground - legLen - b;
      var sway = walk === "glide" ? Math.sin(TAU * phase) * 0.8 : 0;
      // legs, the far one first
      if (walk !== "glide") {
        [0.5, 0].forEach(function (off, i) {
          var f = walk === "hop" ? [Math.sin(TAU * phase) * 1.2, -b * 0.4] : foot(phase + off, 0.6, reach, lift);
          var fx = hipX + f[0], fy = ground + f[1] - (walk === "hop" ? b * 0.6 : 0);
          var k = knee(hipX, hipY, fx, fy, legLen * 0.5, legLen * 0.52, 1);
          var rp = i ? legs : ramp(mix(legs[1], INK, 0.3));
          var t = walk === "stilts" ? 1 : 1.8;
          px.limb(hipX, hipY, k[0], k[1], t, rp);
          px.limb(k[0], k[1], fx, fy, t, rp);
          px.limb(fx - 0.5, fy, fx + 1.8, fy, 1.2, rp);
        });
      }
      var sy = hipY - torsoH, cxT = hipX + sway;
      // the far arm
      var swing = Math.sin(TAU * phase) * (walk === "march" ? 0.9 : 0.6);
      px.limb(cxT - 0.5, sy + 1.5, cxT - 0.5 - Math.sin(swing) * armLen, sy + 1.5 + Math.cos(swing) * armLen, 1.4, ramp(mix(coat[1], INK, 0.3)));
      // the body
      if (build === "block" || build === "tall" || build === "thin") {
        for (var y = 0; y < torsoH; y += 1) {
          for (var x = -torsoW; x <= torsoW; x += 1) {
            var k = x < -torsoW + 1 ? 0 : x > torsoW - 1 ? 2 : 1;
            px.set(cxT + x, sy + y, coatAt(Math.round(cxT + x), Math.round(sy + y), x / torsoW, 0, k) || coat[k]);
          }
        }
      } else if (build === "cone") {
        for (var yc = 0; yc < torsoH + (walk === "glide" ? legLen - 1 : 0); yc += 1) {
          var wdt = 1 + (torsoW + (walk === "glide" ? 2 : 0)) * yc / (torsoH + (walk === "glide" ? legLen : 0));
          for (var xc = -wdt; xc <= wdt; xc += 1) {
            var kc = xc < -wdt + 1 ? 0 : xc > wdt - 1 ? 2 : 1;
            px.set(cxT + xc, sy + yc, coatAt(Math.round(cxT + xc), Math.round(sy + yc), xc / wdt, 0, kc) || coat[kc]);
          }
        }
      } else if (build === "wedge") {
        for (var yw = 0; yw < torsoH; yw += 1) {
          var ww = torsoW + 1.5 - 2.2 * yw / torsoH;
          for (var xw = -ww; xw <= ww; xw += 1) {
            var kw = xw < -ww + 1 ? 0 : xw > ww - 1 ? 2 : 1;
            px.set(cxT + xw, sy + yw, coatAt(Math.round(cxT + xw), Math.round(sy + yw), 0, 0, kw) || coat[kw]);
          }
        }
      } else if (build === "stack") {
        px.blob(cxT, hipY - torsoH * 0.28, torsoW + 0.8, torsoH * 0.3, coat, coatAt);
        px.blob(cxT, hipY - torsoH * 0.72, torsoW * 0.8, torsoH * 0.28, trim, null);
      } else {
        px.blob(cxT + (build === "bean" ? 0.8 : 0), hipY - torsoH / 2, torsoW + (build === "barrel" ? 1.2 : 0), torsoH / 2 + 0.4, coat, coatAt);
      }
      if (walk === "glide") {                                  // a robe to the ground, its hem moving
        for (var yr = Math.floor(hipY - 1); yr < ground - 1; yr += 1) {
          var wr = torsoW + 0.5 + 2 * (yr - hipY) / legLen;
          for (var xr = -wr; xr <= wr; xr += 1) {
            var kr = xr < -wr + 1 ? 0 : xr > wr - 1 ? 2 : 1;
            px.set(cxT + xr, yr, coatAt(Math.round(cxT + xr), yr, 0, 0, kr) || coat[kr]);
          }
        }
        for (var xh = -torsoW - 2; xh <= torsoW + 2; xh += 1) {
          px.set(cxT + xh, ground - 1 + (((xh + Math.round(phase * 8)) & 1) ? 0 : -1), coat[2]);
        }
      }
      // the head
      var hx = cxT + 0.5, hy = sy - headR + 0.5 + (walk === "shuffle" ? 1 : 0);
      if (headKind === "square") {
        px.rect(hx - headR, hy - headR, headR * 2, headR * 2, skin[1]);
        px.rect(hx - headR, hy - headR, 1, headR * 2, skin[0]);
      } else if (headKind === "tall") {
        px.blob(hx, hy - 1, headR * 0.8, headR * 1.4, skin);
      } else if (headKind === "wide") {
        px.blob(hx, hy, headR * 1.5, headR * 0.85, skin);
      } else {
        px.blob(hx, hy, headR, headR, skin);
      }
      px.eye(hx + headR * 0.4, hy - 0.5, 1);
      if (headR > 3) { px.eye(hx - headR * 0.3, hy - 0.5, 1); }
      var top = hy - headR * (headKind === "tall" ? 1.4 : 1) - 1;
      if (hat === "cone") { for (var i = 0; i < 5; i += 1) { px.limb(hx - 2 + i * 0.25, top + 1 - i, hx + 2 - i * 0.25, top + 1 - i, 1, trim); } }
      else if (hat === "top") { px.rect(hx - headR - 1, top, headR * 2 + 3, 1, trim[2]); px.rect(hx - headR + 0.5, top - 4, headR * 2, 4, trim[1]); }
      else if (hat === "crown") { px.rect(hx - 2, top - 1, 5, 2, [214, 176, 92]); px.set(hx - 2, top - 2, [236, 206, 128]); px.set(hx, top - 3, [236, 206, 128]); px.set(hx + 2, top - 2, [236, 206, 128]); }
      else if (hat === "antenna") { px.limb(hx, top, hx + 1 + Math.sin(TAU * phase * 2), top - 5, 1, trim); px.set(hx + 1 + Math.sin(TAU * phase * 2), top - 6, EYE); }
      else if (hat === "halo") { for (var h = -2; h <= 2; h += 1) { px.set(hx + h, top - 3 - (Math.abs(h) === 2 ? 0 : 1) + (Math.abs(h) < 2 ? 0 : 1), [236, 206, 128]); } }
      else if (hat === "plume") { px.limb(hx - 1, top, hx - 4 - Math.sin(TAU * phase) * 0.8, top - 4, 1.4, trim); }
      else if (hat === "brim") { px.rect(hx - headR - 2, top + 1, headR * 2 + 5, 1, trim[1]); px.rect(hx - headR + 1, top - 1, headR * 2 - 1, 2, trim[1]); }
      else if (hat === "bun") { px.blob(hx - 1, top - 0.5, 1.8, 1.6, trim); }
      // the near arm, over everything
      px.limb(cxT + 0.5, sy + 1.5, cxT + 0.5 + Math.sin(swing) * armLen, sy + 1.5 + Math.cos(swing) * armLen, 1.6, coat);
      px.set(cxT + 0.5 + Math.sin(swing) * armLen, sy + 1.5 + Math.cos(swing) * armLen, skin[1]);
    }
    var sheet = sheetOf(fw, fh, 8, draw);
    sheet.groundX = fw / 2;
    sheet.groundY = ground;
    sheet.stride = walk === "hop" ? 10 : Math.max(4, reach * 1.6);
    sheet.walk = walk;
    sheet.build = build;
    return sheet;
  };

  // ---- motion painting ---------------------------------------------------------------

  /* After Oskar Fischinger, Motion Painting No. 1 (1947): painting given
     time. He painted on sheets of glass laid one over another and filmed
     every stroke as it was made, to Bach, so the picture is never finished
     and never still — each form grows on the beat, and every few bars a
     fresh sheet goes over what is there and it sinks a little into depth.

     Here the sheets are the stage's own canvas, the forms are drawn a whole
     pixel at a time, and the beat is 120 to the minute. Each stroke is one
     of Fischinger's: a spiral unwinding, squares opening out of each other,
     a band laid across, a run of staccato dots, nested arcs, a zigzag.

     Systems.motionPainting(canvas, colours, { duration, onBeat, onDone })
       → { stop } */
  var FISCHINGER = ["#e8c547", "#d2452b", "#3d7fc1", "#f3efe6", "#3f8f5a", "#9d95e6", "#f08a3c"];
  S.motionPainting = function (canvas, colours, opts) {
    opts = opts || {};
    var g = canvas.getContext("2d");
    var w = canvas.width, h = canvas.height;
    var r = rng(opts.seed || (Math.random() * 1e9) | 0);
    var cols = (colours && colours.length ? colours : []).concat(FISCHINGER);
    var beat = opts.beat || 500, duration = opts.duration || 7000;
    var ground = opts.ground || "#10131f";
    var start = performance.now(), done = false, lastBeat = -1;
    var strokes = [];
    var cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46;
    // The glass it is painted on: a panel with square corners, inset.
    var px0 = Math.round(w * 0.06), py0 = Math.round(h * 0.1), pw = w - 2 * px0, ph = h - 2 * py0;
    var sheet = document.createElement("canvas");
    sheet.width = w; sheet.height = h;
    var sg = sheet.getContext("2d");
    sg.fillStyle = ground;
    sg.fillRect(px0, py0, pw, ph);
    function dot(x, y, s, c) {
      x = Math.round(x); y = Math.round(y);
      if (x < px0 || y < py0 || x >= px0 + pw || y >= py0 + ph) { return; }
      sg.fillStyle = c;
      sg.fillRect(x, y, s, s);
    }
    function one(list) { return list[Math.floor(r() * list.length)]; }
    var KINDS = ["spiral", "squares", "band", "staccato", "arcs", "zigzag", "rays"];
    function newStroke(n) {
      var k = KINDS[(n * 3 + Math.floor(r() * 3)) % KINDS.length];
      return {
        kind: k, c: one(cols), c2: one(cols), at: n,
        x: cx + (r() - 0.5) * pw * 0.5, y: cy + (r() - 0.5) * ph * 0.5,
        size: R * (0.35 + r() * 0.55), turn: r() * TAU, dir: r() < 0.5 ? -1 : 1,
        beats: 1 + Math.floor(r() * 2), drawn: 0
      };
    }
    // Draws the part of a stroke between two points of its growth, 0..1.
    function paint(s, from, to) {
      var steps = Math.max(1, Math.ceil((to - from) * 260));
      for (var i = 0; i <= steps; i += 1) {
        var q = from + (to - from) * i / steps;
        var a, rr, x, y;
        if (s.kind === "spiral") {
          a = s.turn + s.dir * q * TAU * 3; rr = q * s.size;
          dot(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 2, s.c);
        } else if (s.kind === "squares") {
          var ring = Math.floor(q * 5), side = (ring + 1) * s.size / 5, t = (q * 5) % 1;
          var per = t * 4, e = Math.floor(per), f = per - e;
          var hx = side, hy = side;
          var corners = [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy], [-hx, -hy]];
          x = corners[e][0] + (corners[e + 1][0] - corners[e][0]) * f;
          y = corners[e][1] + (corners[e + 1][1] - corners[e][1]) * f;
          dot(s.x + x * 0.6, s.y + y * 0.6, 1, ring % 2 ? s.c2 : s.c);
        } else if (s.kind === "band") {
          x = px0 + q * pw;
          y = s.y + Math.sin(q * TAU * 1.5 + s.turn) * s.size * 0.25;
          for (var k = -3; k <= 3; k += 1) { dot(x, y + k, 1, Math.abs(k) === 3 ? s.c2 : s.c); }
        } else if (s.kind === "staccato") {
          var n = Math.floor(q * 12);
          if (Math.floor(from * 12) !== n || i === 0) {
            x = px0 + pw * (0.1 + 0.8 * n / 11);
            y = s.y + (n % 3 - 1) * s.size * 0.2;
            for (var dx = -2; dx <= 2; dx += 1) { for (var dy = -2; dy <= 2; dy += 1) { if (dx * dx + dy * dy <= 5) { dot(x + dx, y + dy, 1, s.c); } } }
          }
        } else if (s.kind === "arcs") {
          var m = Math.floor(q * 4), t2 = (q * 4) % 1;
          a = s.turn + t2 * Math.PI; rr = s.size * (0.35 + m * 0.18);
          dot(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr, 2, m % 2 ? s.c2 : s.c);
        } else if (s.kind === "zigzag") {
          x = px0 + q * pw;
          y = s.y + (Math.abs(((q * 10) % 2) - 1) - 0.5) * s.size * 0.6;
          dot(x, y, 2, s.c);
        } else {                                          // rays, out from a point
          var ray = Math.floor(q * 9), t3 = (q * 9) % 1;
          a = s.turn + ray * TAU / 9;
          dot(s.x + Math.cos(a) * t3 * s.size, s.y + Math.sin(a) * t3 * s.size, 1, s.c);
        }
      }
    }
    function frame(now) {
      if (done) { return; }
      var t = now - start;
      if (t >= duration) {
        done = true;
        if (opts.onDone) { opts.onDone(); }
        return;
      }
      requestAnimationFrame(frame);
      var n = Math.floor(t / beat);
      if (n !== lastBeat) {
        lastBeat = n;
        // Every four beats, a new sheet of glass over what is there.
        if (n && n % 4 === 0) {
          sg.globalAlpha = 0.34;
          sg.fillStyle = ground;
          sg.fillRect(px0, py0, pw, ph);
          sg.globalAlpha = 1;
        }
        strokes.push(newStroke(n));
        if (opts.onBeat) { opts.onBeat(n, strokes[strokes.length - 1]); }
      }
      strokes.forEach(function (s) {
        var q = Math.min(1, (t - s.at * beat) / (s.beats * beat));
        if (q > s.drawn) { paint(s, s.drawn, q); s.drawn = q; }
      });
      strokes = strokes.filter(function (s) { return s.drawn < 1; });
      // Held frames, as film is: the sheet is shown twelve times a second.
      if (Math.floor(t / 83) !== frame.shown) {
        frame.shown = Math.floor(t / 83);
        g.clearRect(0, 0, w, h);
        g.drawImage(sheet, 0, 0);
      }
    }
    requestAnimationFrame(frame);
    return { stop: function () { done = true; } };
  };

  // ---- reaction ----------------------------------------------------------------------

  /* After Universal Everything, Primordial: cellular life, generated. Two
     chemicals, one feeding the other and both spreading, worked out cell by
     cell (Gray and Scott's model) at the settings where the spots it makes
     grow, pinch in the middle and divide — mitosis, from nothing but the
     arithmetic. Seeded from a few specks; it never settles and never
     repeats.

     new Systems.Reaction(w, h, { seed, feed, kill }) .step(n) .draw(g, colours) */
  function Reaction(w, h, opts) {
    opts = opts || {};
    this.w = w;
    this.h = h;
    this.f = opts.feed || 0.0367;
    this.k = opts.kill || 0.0649;
    this.a = new Float32Array(w * h).fill(1);
    this.b = new Float32Array(w * h);
    this.a2 = new Float32Array(w * h);
    this.b2 = new Float32Array(w * h);
    this.img = null;
    var r = rng(opts.seed || (Math.random() * 1e9) | 0);
    var specks = opts.specks || Math.max(3, Math.round(w * h / 900));
    for (var s = 0; s < specks; s += 1) { this.speck(r() * w, r() * h, 2 + r() * 3); }
  }
  Reaction.prototype.speck = function (x, y, rad) {
    for (var j = -rad; j <= rad; j += 1) {
      for (var i = -rad; i <= rad; i += 1) {
        var xx = Math.floor(x + i), yy = Math.floor(y + j);
        if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h) { continue; }
        this.b[yy * this.w + xx] = 1;
        this.a[yy * this.w + xx] = 0.5;
      }
    }
  };
  Reaction.prototype.step = function (n) {
    var w = this.w, h = this.h, f = this.f, k = this.k;
    for (var it = 0; it < (n || 1); it += 1) {
      var a = this.a, b = this.b, a2 = this.a2, b2 = this.b2;
      for (var y = 0; y < h; y += 1) {
        var up = ((y - 1 + h) % h) * w, dn = ((y + 1) % h) * w, row = y * w;
        for (var x = 0; x < w; x += 1) {
          var l = (x - 1 + w) % w, rr = (x + 1) % w, i = row + x;
          var la = a[row + l] * 0.2 + a[row + rr] * 0.2 + a[up + x] * 0.2 + a[dn + x] * 0.2 +
                   a[up + l] * 0.05 + a[up + rr] * 0.05 + a[dn + l] * 0.05 + a[dn + rr] * 0.05 - a[i];
          var lb = b[row + l] * 0.2 + b[row + rr] * 0.2 + b[up + x] * 0.2 + b[dn + x] * 0.2 +
                   b[up + l] * 0.05 + b[up + rr] * 0.05 + b[dn + l] * 0.05 + b[dn + rr] * 0.05 - b[i];
          var abb = a[i] * b[i] * b[i];
          a2[i] = a[i] + (la - abb + f * (1 - a[i]));
          b2[i] = b[i] + (0.5 * lb + abb - (k + f) * b[i]);
        }
      }
      this.a = a2; this.b = b2; this.a2 = a; this.b2 = b;
    }
  };
  // In four steps of a ramp, dithered, like everything else here.
  Reaction.prototype.draw = function (g, colours, alpha) {
    var w = this.w, h = this.h;
    if (!this.img || this.img.width !== w) { this.img = g.createImageData(w, h); }
    var ramp = (colours && colours.length ? colours : ["#f3f1ee", "#9d95e6", "#5e52c7", "#1c1640"]).map(hexRgb);
    var d = this.img.data, n = ramp.length - 1, B = this.b;
    for (var y = 0; y < h; y += 1) {
      for (var x = 0; x < w; x += 1) {
        var i = y * w + x;
        var v = Math.max(0, Math.min(1, B[i] * 2.6)) * n;
        var dz = BAYER4[(y & 3) * 4 + (x & 3)] / 16;
        var s = Math.min(n, Math.floor(v + dz));
        var c = ramp[s], o = i * 4;
        d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2];
        d[o + 3] = alpha === undefined ? 255 : (s ? 255 : alpha);
      }
    }
    g.putImageData(this.img, 0, 0);
  };
  var BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  S.Reaction = Reaction;

  // ---- the external world --------------------------------------------------------------

  /* After David OReilly, The External World: digital animation not trying
     to look like anything but itself — crude, funny, surreal. Flat shapes
     whose corners boil, a palette nobody would choose, and a run of gags
     that make no sense and are played quite straight. */
  S.externalWorld = function (canvas, opts) {
    opts = opts || {};
    var g = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    var r = rng(opts.seed || (Math.random() * 1e9) | 0);
    var PAL = { bg: "#b8c4c0", floor: "#8a948c", skin: "#f2b8a0", green: "#6ad04a", purple: "#8a4ac8",
                grey: "#6c6c74", white: "#fbfbf6", black: "#16141a", red: "#e0402a", yellow: "#f4d23a", blue: "#3a6ad0" };
    var gags = ["head", "stairs", "tv", "teeth", "cube", "door", "piano"];
    var order = gags.slice().sort(function () { return r() - 0.5; });
    var start = performance.now();
    var S_ = Math.min(w, h) / 72;
    function boil(pts, amt, t) {
      // Corners that will not keep still: each frame of the animation (held
      // three times) they are drawn again a little off.
      var q = Math.floor(t / 125);
      return pts.map(function (p, i) {
        return [p[0] + (hash2d(i, q, 7) - 0.5) * amt * S_, p[1] + (hash2d(i, q, 9) - 0.5) * amt * S_];
      });
    }
    function poly(pts, c, t, amt) {
      pts = boil(pts, amt === undefined ? 1.6 : amt, t);
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (var i = 1; i < pts.length; i += 1) { g.lineTo(pts[i][0], pts[i][1]); }
      g.closePath();
      g.fill();
    }
    function blob(x, y, rx, ry, n, c, t, amt) {
      var pts = [];
      for (var i = 0; i < n; i += 1) {
        var a = i / n * TAU;
        pts.push([x + Math.cos(a) * rx * (0.85 + 0.3 * hash2d(i, n, 3)), y + Math.sin(a) * ry * (0.85 + 0.3 * hash2d(i, n, 5))]);
      }
      poly(pts, c, t, amt);
    }
    function eye(x, y, rad, lx, ly, t) {
      blob(x, y, rad, rad, 7, PAL.white, t, 0.6);
      g.fillStyle = PAL.black;
      g.fillRect(Math.round(x + lx * rad * 0.4 - rad * 0.3), Math.round(y + ly * rad * 0.4 - rad * 0.3), Math.max(1, Math.round(rad * 0.6)), Math.max(1, Math.round(rad * 0.6)));
    }
    function floor(y) { g.fillStyle = PAL.floor; g.fillRect(0, y, w, h - y); }
    function draw(now) {
      var t = now - start, n = Math.floor(t / 3600), gag = order[n % order.length], u = (t % 3600) / 3600;
      g.fillStyle = PAL.bg;
      g.fillRect(0, 0, w, h);
      var cx = w / 2, cy = h / 2;
      if (gag === "head") {
        floor(h * 0.8);
        var bob = Math.sin(t / 300) * 2 * S_;
        blob(cx, cy + bob, 22 * S_, 25 * S_, 11, PAL.skin, t, 2.2);
        var lx = Math.sin(t / 700), ly = Math.cos(t / 900);
        eye(cx - 8 * S_, cy - 5 * S_ + bob, 5 * S_, lx, ly, t);
        eye(cx + 7 * S_, cy - 6 * S_ + bob, 6 * S_, lx, ly, t);
        var open = u > 0.5 ? Math.abs(Math.sin(t / 90)) : 0.1;
        blob(cx, cy + 10 * S_ + bob, 6 * S_, (1 + open * 5) * S_, 8, PAL.black, t, 0.8);
        if (u > 0.5) { g.fillStyle = PAL.black; g.font = Math.round(8 * S_) + "px monospace"; g.fillText("hello", cx + 18 * S_, cy - 18 * S_); }
      } else if (gag === "stairs") {
        var step = 8 * S_, shift = (t / 30) % step;
        g.fillStyle = PAL.purple;
        for (var i = -1; i < 12; i += 1) {
          var sx = i * step - shift, sy = h - (i * step - shift) * 0.7;
          g.fillRect(sx, sy, step + 1, h);
        }
        var fx = cx, fy = h - (fx) * 0.7 - 12 * S_ + Math.abs(Math.sin(t / 150)) * 2 * S_;
        blob(fx, fy, 3 * S_, 3 * S_, 6, PAL.skin, t, 0.8);
        poly([[fx - 2 * S_, fy + 3 * S_], [fx + 2 * S_, fy + 3 * S_], [fx + 3 * S_, fy + 11 * S_], [fx - 3 * S_, fy + 11 * S_]], PAL.green, t, 1);
      } else if (gag === "tv") {
        var box = [w * 0.9, h * 0.8];
        for (var k = 0; k < 5; k += 1) {
          var bw = box[0] * Math.pow(0.62, k), bh = box[1] * Math.pow(0.62, k);
          poly([[cx - bw / 2, cy - bh / 2], [cx + bw / 2, cy - bh / 2], [cx + bw / 2, cy + bh / 2], [cx - bw / 2, cy + bh / 2]],
               k % 2 ? PAL.grey : PAL.black, t, 1);
          if (k === 4) {
            for (var q = 0; q < 30; q += 1) {
              g.fillStyle = hash2d(q, Math.floor(t / 80), 1) < 0.5 ? PAL.white : PAL.grey;
              g.fillRect(cx - bw / 2 + hash2d(q, 3, Math.floor(t / 80)) * bw, cy - bh / 2 + hash2d(q, 5, Math.floor(t / 80)) * bh, 2, 1);
            }
          }
        }
      } else if (gag === "teeth") {
        floor(h * 0.78);
        for (var k2 = 0; k2 < 14; k2 += 1) {
          var tx = hash2d(k2, 1, 2) * w, fall = ((t / 1000 + hash2d(k2, 2, 2) * 3) % 3) / 3;
          var ty = Math.min(h * 0.74, fall * h * 1.1 - 10 * S_);
          poly([[tx - 2 * S_, ty], [tx + 2 * S_, ty], [tx + 2.4 * S_, ty + 3 * S_], [tx + 1 * S_, ty + 5 * S_],
                [tx, ty + 3.5 * S_], [tx - 1 * S_, ty + 5 * S_], [tx - 2.4 * S_, ty + 3 * S_]], PAL.white, t, 0.5);
        }
        blob(cx, h * 0.72, 9 * S_, 6 * S_, 9, PAL.green, t, 1.4);
        eye(cx - 3 * S_, h * 0.7, 2.5 * S_, Math.sin(t / 200), -1, t);
        eye(cx + 3 * S_, h * 0.7, 2.5 * S_, Math.sin(t / 200), -1, t);
      } else if (gag === "cube") {
        var a = t / 900, glitch = hash2d(Math.floor(t / 400), 1, 4) < 0.2 ? 8 : 0;
        var faces = [];
        var V = [];
        for (var z = 0; z < 8; z += 1) {
          var px = (z & 1 ? 1 : -1), py = (z & 2 ? 1 : -1), pz = (z & 4 ? 1 : -1);
          var x1 = px * Math.cos(a) - pz * Math.sin(a), z1 = px * Math.sin(a) + pz * Math.cos(a);
          var y1 = py * Math.cos(a * 0.7) - z1 * Math.sin(a * 0.7), z2 = py * Math.sin(a * 0.7) + z1 * Math.cos(a * 0.7);
          V.push([cx + x1 * 16 * S_ + (z === 3 ? glitch * S_ : 0), cy + y1 * 16 * S_, z2]);
        }
        [[0, 1, 3, 2, PAL.red], [4, 5, 7, 6, PAL.yellow], [0, 1, 5, 4, PAL.blue], [2, 3, 7, 6, PAL.green],
         [0, 2, 6, 4, PAL.purple], [1, 3, 7, 5, PAL.skin]].forEach(function (fc) {
          faces.push({ pts: [V[fc[0]], V[fc[1]], V[fc[3]], V[fc[2]]], c: fc[4], z: (V[fc[0]][2] + V[fc[1]][2] + V[fc[2]][2] + V[fc[3]][2]) / 4 });
        });
        faces.sort(function (p, q2) { return p.z - q2.z; });
        faces.slice(3).forEach(function (fc) { poly(fc.pts.map(function (p) { return [p[0], p[1]]; }), fc.c, t, 0.8); });
      } else if (gag === "door") {
        floor(h * 0.85);
        var depth = Math.floor(u * 4);
        for (var d = 0; d <= depth; d += 1) {
          var s = Math.pow(0.7, d), dw = 26 * S_ * s, dh = 44 * S_ * s;
          var dx = cx - dw / 2, dy = h * 0.85 - dh;
          poly([[dx, dy], [dx + dw, dy], [dx + dw, dy + dh], [dx, dy + dh]], d % 2 ? PAL.red : PAL.purple, t, 0.6);
          g.fillStyle = PAL.black;
          g.fillRect(dx + dw * 0.1, dy + dh * 0.05, dw * 0.8, dh * 0.95);
        }
      } else {
        floor(h * 0.8);
        var drop = Math.min(1, u * 1.6);
        var py2 = -20 * S_ + drop * (h * 0.8 - 2 * S_);
        blob(cx + 14 * S_, h * 0.8 - 8 * S_, 3 * S_, 3 * S_, 6, PAL.skin, t, 0.6);
        poly([[cx + 12 * S_, h * 0.8 - 5 * S_], [cx + 16 * S_, h * 0.8 - 5 * S_], [cx + 16 * S_, h * 0.8], [cx + 12 * S_, h * 0.8]], PAL.blue, t, 0.6);
        poly([[cx - 22 * S_, py2 - 12 * S_], [cx + 8 * S_, py2 - 12 * S_], [cx + 8 * S_, py2], [cx - 22 * S_, py2]], PAL.black, t, 1.2);
        for (var kk = 0; kk < 7; kk += 1) { g.fillStyle = PAL.white; g.fillRect(cx - 21 * S_ + kk * 4 * S_, py2 - 4 * S_, 3 * S_, 3 * S_); }
      }
    }
    return { draw: draw };
  };

  // ---- a small world ------------------------------------------------------------------

  /* After Radiohead and Universal Everything, PolyFauna: a world of
     primitive life you move through — organisms, a landscape, weather —
     that notices you. Here the organisms drift toward the pointer, and a
     press starts a new one where it lands. */
  S.polyFauna = function (canvas, opts) {
    opts = opts || {};
    var g = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    var r = rng(opts.seed || (Math.random() * 1e9) | 0);
    var horizon = h * 0.42;
    var life = [];
    var pointer = null;
    var cols = (opts.colours && opts.colours.length ? opts.colours : ["#e84a6a", "#f4d23a", "#4ad0c0", "#9d95e6"]);
    function spawn(x, y) {
      life.push({ x: x, y: y, vx: 0, vy: 0, arms: 3 + Math.floor(r() * 5), size: 2 + r() * 4,
                  c: cols[Math.floor(r() * cols.length)], p: r() * TAU, born: performance.now() });
      if (life.length > 40) { life.shift(); }
    }
    for (var i = 0; i < 9; i += 1) { spawn(r() * w, horizon + r() * (h - horizon)); }
    var trees = [];
    for (var k = 0; k < 14; k += 1) { trees.push({ x: r(), z: r(), hgt: 0.4 + r() * 0.8 }); }
    function draw(now) {
      var t = now / 1000;
      // The sky, the colour of weather that is coming.
      var sky = g.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, "#1a1030");
      sky.addColorStop(1, "#6a3a5a");
      g.fillStyle = sky;
      g.fillRect(0, 0, w, horizon);
      g.fillStyle = "#0e0a16";
      g.fillRect(0, horizon, w, h - horizon);
      // The ground, going by: lines of a grid rushing toward you.
      g.strokeStyle = "rgba(157,149,230,0.45)";
      g.lineWidth = 1;
      for (var j = 0; j < 12; j += 1) {
        var z = ((j / 12 + t * 0.12) % 1);
        var y = horizon + (h - horizon) * z * z;
        g.beginPath(); g.moveTo(0, Math.round(y) + 0.5); g.lineTo(w, Math.round(y) + 0.5); g.stroke();
      }
      for (var c = -6; c <= 6; c += 1) {
        g.beginPath(); g.moveTo(w / 2 + c * 3, horizon); g.lineTo(w / 2 + c * w * 0.3, h); g.stroke();
      }
      // Mountains, and the forest: triangles.
      g.fillStyle = "#2a1a3a";
      g.beginPath(); g.moveTo(0, horizon);
      for (var m = 0; m <= 8; m += 1) { g.lineTo(m / 8 * w, horizon - (0.3 + 0.7 * hash2d(m, 1, 11)) * h * 0.16); }
      g.lineTo(w, horizon); g.closePath(); g.fill();
      trees.forEach(function (tr) {
        var z = (tr.z + t * 0.12) % 1, y = horizon + (h - horizon) * z * z;
        var x = w / 2 + (tr.x - 0.5) * w * (0.2 + z * 1.6), s = (0.2 + z) * tr.hgt * h * 0.3;
        g.fillStyle = "#1e3a2a";
        g.beginPath(); g.moveTo(x, y - s); g.lineTo(x + s * 0.3, y); g.lineTo(x - s * 0.3, y); g.closePath(); g.fill();
      });
      // Weather: rain, slanting.
      g.fillStyle = "rgba(200,210,255,0.55)";
      for (var q = 0; q < 40; q += 1) {
        var rx = (hash2d(q, 1, 21) * w + t * 30) % w, ry = (hash2d(q, 2, 21) * h + t * 90) % h;
        g.fillRect(Math.round(rx), Math.round(ry), 1, 3);
      }
      // The life: drifting, and drawn to whoever is looking.
      life.forEach(function (o) {
        var tx = pointer ? pointer.x : w / 2 + Math.sin(t * 0.4 + o.p) * w * 0.3;
        var ty = pointer ? pointer.y : horizon + (h - horizon) * (0.5 + 0.4 * Math.cos(t * 0.3 + o.p));
        o.vx += (tx - o.x) * 0.002 + Math.sin(t * 2 + o.p) * 0.05;
        o.vy += (ty - o.y) * 0.002 + Math.cos(t * 1.7 + o.p) * 0.05;
        o.vx *= 0.94; o.vy *= 0.94;
        o.x += o.vx; o.y += o.vy;
        var grow = Math.min(1, (now - o.born) / 600), sz = o.size * grow;
        g.fillStyle = o.c;
        g.strokeStyle = o.c;
        g.beginPath(); g.arc(o.x, o.y, Math.max(1, sz), 0, TAU); g.fill();
        for (var a = 0; a < o.arms; a += 1) {
          var ang = a / o.arms * TAU + t * 1.5 + o.p, len = sz * (1.6 + 0.6 * Math.sin(t * 4 + a));
          g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(o.x + Math.cos(ang) * len, o.y + Math.sin(ang) * len); g.stroke();
        }
      });
    }
    return {
      draw: draw,
      point: function (x, y) { pointer = x === null ? null : { x: x, y: y }; },
      press: function (x, y) { spawn(x, y); }
    };
  };

  // ---- sound ---------------------------------------------------------------------------

  /* The part of Ikeda and Fischinger that is heard, off until someone asks
     for it. Ikeda's is sine tones at the top of hearing and clicks, placed
     on the grid of the picture; Fischinger's is a figure in G, a note to a
     beat, after the Bach he painted to. */
  var audio = null, master = null;
  S.sound = {
    on: false,
    start: function () {
      if (!audio) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return false; }
        audio = new AC();
        master = audio.createGain();
        master.gain.value = 0.16;
        master.connect(audio.destination);
      }
      if (audio.state === "suspended") { audio.resume(); }
      this.on = true;
      return true;
    },
    stop: function () { this.on = false; },
    tone: function (freq, dur, type, level, when) {
      if (!this.on || !audio) { return; }
      var t0 = audio.currentTime + (when || 0);
      var o = audio.createOscillator(), e = audio.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      e.gain.setValueAtTime(0, t0);
      e.gain.linearRampToValueAtTime(level || 0.5, t0 + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(e); e.connect(master);
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    click: function (level, when) {
      if (!this.on || !audio) { return; }
      var t0 = audio.currentTime + (when || 0);
      var n = Math.floor(audio.sampleRate * 0.004), buf = audio.createBuffer(1, n, audio.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i += 1) { d[i] = (Math.random() * 2 - 1) * (1 - i / n); }
      var s = audio.createBufferSource(), e = audio.createGain();
      e.gain.value = level || 0.6;
      s.buffer = buf; s.connect(e); e.connect(master); s.start(t0);
    },
    // A passage of datamatics: clicks on the grid and high sines, for as long as it runs.
    data: function (ms) {
      if (!this.on) { return; }
      var steps = Math.floor(ms / 60);
      for (var i = 0; i < steps; i += 1) {
        if (Math.random() < 0.6) { this.click(0.35, i * 0.06); }
        if (Math.random() < 0.25) { this.tone([8000, 10000, 12000, 6000, 4000][i % 5], 0.05, "sine", 0.12, i * 0.06); }
      }
      this.tone(60, ms / 1000, "sine", 0.4);
    },
    // A beat of the motion painting: G major, climbing and turning, as a
    // continuo under whatever is being painted.
    beat: function (n) {
      if (!this.on) { return; }
      var G = [392, 494, 587, 784, 587, 494, 440, 587, 740, 587, 440, 370];
      var base = [98, 98, 131, 147][Math.floor(n / 4) % 4];
      for (var i = 0; i < 4; i += 1) { this.tone(G[(n * 4 + i) % G.length], 0.16, "triangle", 0.28, i * 0.125); }
      this.tone(base, 0.45, "triangle", 0.35);
    }
  };

  window.Systems = S;
})();
