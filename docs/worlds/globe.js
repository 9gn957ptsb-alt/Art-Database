/* The globe — a world woven of dots, as the Artist Website weaves the Earth.

   Every world comes as two pictures on the same half-degree grid (720 by 360
   cells, column 0 at 180 W, row 0 at 90 N): dots.png, whose colour is a dot's
   colour and whose alpha is its size, and land.png, which territory each cell
   is. The dots stand on the sphere at equal spacing, one row of the grid at a
   time, so they keep their places as the world turns; they are lit from one
   side on DIRT's near-black ground.

   No build step and no dependencies. */

(function () {
  "use strict";

  var W = 720, H = 360;
  var GROUND = [14, 13, 12];

  function readPixels(url) {
    return new Promise(function (done, fail) {
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        var g = c.getContext("2d", { willReadFrequently: true });
        g.drawImage(img, 0, 0);
        done(g.getImageData(0, 0, c.width, c.height).data);
      };
      img.onerror = function () { fail(new Error("could not load " + url)); };
      img.src = url;
    });
  }

  /* A world, loaded: its dots on the sphere and its territories. */
  function loadWorld(name, dotsUrl) {
    var base = name + "/";
    return Promise.all([
      readPixels(dotsUrl),
      readPixels(base + "land.png"),
      fetch(base + "territories.json").then(function (r) { return r.json(); })
    ]).then(function (all) {
      var dots = all[0], land = all[1], terr = all[2].territories;
      var ids = new Int32Array(W * H);
      for (var i = 0; i < W * H; i++) { ids[i] = land[i * 4] + 256 * land[i * 4 + 1] - 1; }

      // How many dots each row holds: as many as its circle of latitude is long.
      var count = 0, rows = [];
      for (var r = 0; r < H; r++) {
        var lat = 90 - (r + 0.5) / 2;
        var n = Math.max(1, Math.round(W * Math.cos(lat * Math.PI / 180)));
        rows.push(n);
        count += n;
      }
      var P = {
        n: count,
        x: new Float32Array(count), y: new Float32Array(count), z: new Float32Array(count),
        lon: new Float32Array(count),
        rgb: new Uint8Array(count * 3), size: new Uint8Array(count),
        id: new Int32Array(count), edge: new Uint8Array(count)
      };
      var k = 0;
      for (r = 0; r < H; r++) {
        var la = (90 - (r + 0.5) / 2) * Math.PI / 180, cl = Math.cos(la), sl = Math.sin(la);
        for (var j = 0; j < rows[r]; j++, k++) {
          var lonDeg = -180 + (j + 0.5) * 360 / rows[r];
          var c = Math.min(W - 1, Math.floor((lonDeg + 180) * 2)), o = r * W + c;
          P.lon[k] = lonDeg * Math.PI / 180;
          P.y[k] = sl;
          P.x[k] = cl; // scaled by sin/cos of the turned longitude when drawn
          P.rgb[k * 3] = dots[o * 4]; P.rgb[k * 3 + 1] = dots[o * 4 + 1]; P.rgb[k * 3 + 2] = dots[o * 4 + 2];
          P.size[k] = Math.round(dots[o * 4 + 3] / 85);
          var id = ids[o];
          P.id[k] = id;
          var east = ids[r * W + (c + 1) % W], west = ids[r * W + (c + W - 1) % W];
          var north = r > 0 ? ids[o - W] : id, south = r < H - 1 ? ids[o + W] : id;
          P.edge[k] = (east !== id || west !== id || north !== id || south !== id) ? 1 : 0;
        }
      }
      return { name: name, points: P, ids: ids, territories: terr };
    });
  }

  function hexRgb(h) {
    var v = parseInt(h.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }

  /* The view of one canvas: which world, which way it faces, how near. */
  function Globe(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.world = null;
    this.lon0 = 10; this.lat0 = 25;     // what faces us, in degrees
    this.zoom = 1; this.scale = 1;      // scale: the crossing between worlds
    this.vlon = 0;                      // spin left by a drag
    this.hover = -1; this.selected = -1;
    this.tint = null;                   // territory id -> [r,g,b] or null
    this.marks = null;                  // territory id -> true to name it
    this.dirty = true;
    this.resize();
  }

  Globe.prototype.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.dpr = dpr;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.image = this.ctx.createImageData(this.canvas.width, this.canvas.height);
    this.buf = new Uint32Array(this.image.data.buffer);
    this.dirty = true;
  };

  /* Where the world's centre stands: raised on a narrow screen, so the
     panel below does not cover it. */
  Globe.prototype.middle = function () {
    return this.canvas.height * (this.canvas.clientWidth <= 720 ? 0.36 : 0.5);
  };

  Globe.prototype.radius = function () {
    if (this.canvas.clientWidth <= 720) {
      return Math.min(this.canvas.width * 0.44, this.canvas.height * 0.3) * this.zoom * this.scale;
    }
    return Math.min(this.canvas.width, this.canvas.height) * 0.42 * this.zoom * this.scale;
  };

  /* Screen point (CSS pixels) -> [lat, lon] in degrees, or null off the world. */
  Globe.prototype.unproject = function (mx, my) {
    var R = this.radius(), cx = this.canvas.width / 2, cy = this.middle();
    var x = (mx * this.dpr - cx) / R, y = -(my * this.dpr - cy) / R;
    var d = x * x + y * y;
    if (d > 1) { return null; }
    var z = Math.sqrt(1 - d);
    var p0 = this.lat0 * Math.PI / 180, cp = Math.cos(p0), sp = Math.sin(p0);
    // Undo the tilt.
    var yy = y * cp + z * sp, zz = -y * sp + z * cp;
    var lat = Math.asin(Math.max(-1, Math.min(1, yy)));
    var lon = Math.atan2(x, zz) + this.lon0 * Math.PI / 180;
    var lonDeg = ((lon * 180 / Math.PI + 540) % 360) - 180;
    return [lat * 180 / Math.PI, lonDeg];
  };

  Globe.prototype.project = function (latDeg, lonDeg) {
    var la = latDeg * Math.PI / 180, lo = (lonDeg - this.lon0) * Math.PI / 180;
    var x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
    var p0 = this.lat0 * Math.PI / 180, cp = Math.cos(p0), sp = Math.sin(p0);
    var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    var R = this.radius();
    return { x: (this.canvas.width / 2 + R * x) / this.dpr, y: (this.middle() - R * y2) / this.dpr, front: z2 > 0.05 };
  };

  Globe.prototype.territoryAt = function (mx, my) {
    if (!this.world) { return -1; }
    var ll = this.unproject(mx, my);
    if (!ll) { return -1; }
    var r = Math.min(H - 1, Math.floor((90 - ll[0]) * 2)), c = Math.min(W - 1, Math.floor((ll[1] + 180) * 2));
    return this.world.ids[r * W + c];
  };

  Globe.prototype.draw = function () {
    var cw = this.canvas.width, ch = this.canvas.height, buf = this.buf;
    var bg = (255 << 24) | (GROUND[2] << 16) | (GROUND[1] << 8) | GROUND[0];
    buf.fill(bg);
    var world = this.world;
    if (world && this.scale > 0.01) {
      var P = world.points, R = this.radius(), cx = cw / 2, cy = this.middle();
      var lon0 = this.lon0 * Math.PI / 180, p0 = this.lat0 * Math.PI / 180, cp = Math.cos(p0), sp = Math.sin(p0);
      var spacing = R * Math.PI / 360;            // one cell, on the screen
      var sizes = [0, Math.max(1, spacing * 0.42), Math.max(1, spacing * 0.62), Math.max(1.2, spacing * 0.82)];
      var Lx = -0.45, Ly = 0.5, Lz = 0.74;         // the light, from the upper left
      var tint = this.tint, hov = this.hover, sel = this.selected;
      var fade = Math.min(1, this.scale * 1.4);
      for (var k = 0; k < P.n; k++) {
        var lo = P.lon[k] - lon0, cl = P.x[k];
        var x = cl * Math.sin(lo), y = P.y[k], z = cl * Math.cos(lo);
        var z2 = y * sp + z * cp;
        if (z2 <= 0) { continue; }
        var y2 = y * cp - z * sp;
        var id = P.id[k], s = P.size[k], t = tint && id >= 0 ? tint[id] : null;
        var hot = id >= 0 && (id === sel || id === hov);
        if (!s && !t && !hot) { continue; }
        var lit = 0.5 + 0.62 * Math.max(0, x * Lx + y2 * Ly + z2 * Lz);
        var r = P.rgb[k * 3], g = P.rgb[k * 3 + 1], b = P.rgb[k * 3 + 2];
        if (t) {
          var a = P.edge[k] ? 0.8 : 0.42;
          r += (t[0] - r) * a; g += (t[1] - g) * a; b += (t[2] - b) * a;
          if (!s) { s = 1; }
        }
        if (hot) {
          var lift = id === sel ? 0.45 : 0.25;
          if (P.edge[k] && id === sel) { r = 246; g = 238; b = 220; lift = 0; s = Math.max(s, 2); }
          r += (255 - r) * lift; g += (255 - g) * lift; b += (255 - b) * lift;
          if (!s) { s = 1; }
        }
        r *= lit * fade; g *= lit * fade; b *= lit * fade;
        var px = cx + R * x, py = cy - R * y2;
        // Foreshortened toward the rim, as a dot lying on the ground would be.
        var side = sizes[s] * (0.55 + 0.45 * z2);
        var half = side / 2;
        var x0 = Math.round(px - half), y0 = Math.round(py - half);
        var x1 = Math.max(x0 + 1, Math.round(px + half)), y1 = Math.max(y0 + 1, Math.round(py + half));
        if (x1 <= 0 || y1 <= 0 || x0 >= cw || y0 >= ch) { continue; }
        if (x0 < 0) { x0 = 0; } if (y0 < 0) { y0 = 0; }
        if (x1 > cw) { x1 = cw; } if (y1 > ch) { y1 = ch; }
        var v = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
        for (var yy = y0; yy < y1; yy++) {
          var row = yy * cw;
          for (var xx = x0; xx < x1; xx++) { buf[row + xx] = v; }
        }
      }
    }
    this.ctx.putImageData(this.image, 0, 0);
    this.drawNames();
    this.dirty = false;
  };

  /* Names stand on the world: always those marked, and, nearer, every
     territory there is room to name. */
  Globe.prototype.drawNames = function () {
    var world = this.world;
    if (!world || this.scale < 0.98) { return; }
    var ctx = this.ctx, dpr = this.dpr, marks = this.marks, z = this.zoom;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var taken = [];
    var list = world.territories.slice().sort(function (a, b) { return b.cells - a.cells; });
    for (var i = 0; i < list.length; i++) {
      var t = list[i], marked = marks && marks[t.id], hot = t.id === this.selected || t.id === this.hover;
      // Room to name it: its ground is big enough on the screen.
      var room = t.cells * z * z > 900;
      if (!marked && !hot && !room) { continue; }
      var p = this.project(t.lat, t.lon);
      if (!p.front) { continue; }
      var size = hot ? 14 : marked ? 12 : 11;
      ctx.font = (hot ? "600 " : marked ? "500 " : "400 ") + size + "px 'IBM Plex Sans', system-ui, sans-serif";
      var w = ctx.measureText(t.name).width;
      var box = [p.x - w / 2 - 4, p.y - size / 2 - 3, p.x + w / 2 + 4, p.y + size / 2 + 3];
      var clash = false;
      for (var j = 0; j < taken.length && !hot; j++) {
        var q = taken[j];
        if (box[0] < q[2] && box[2] > q[0] && box[1] < q[3] && box[3] > q[1]) { clash = true; break; }
      }
      if (clash) { continue; }
      taken.push(box);
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(14,13,12,0.85)";
      ctx.strokeText(t.name, p.x, p.y);
      ctx.fillStyle = hot ? "#fff7e8" : marked ? "#efe6d6" : "rgba(239,230,214,0.7)";
      ctx.fillText(t.name, p.x, p.y);
    }
    ctx.restore();
  };

  window.Worlds = window.Worlds || {};
  window.Worlds.loadWorld = loadWorld;
  window.Worlds.Globe = Globe;
  window.Worlds.hexRgb = hexRgb;
})();
