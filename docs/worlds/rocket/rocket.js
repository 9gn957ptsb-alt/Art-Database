/* Rocket — escapes made from the Artist Website, in blocks.

   A simpler game in the way of Minecraft's phone app, about one mission:
   you come down hard, come to under a tree beside your capsule, and find
   the four pieces of your rocket, to build it at the wreck and launch.

   Every escape is made, by a seed, from what the site holds (adventure.js
   makes it, place.js builds it): one of its museums, its rooms carved from
   its plan and the saved works hung in them, the pieces behind four of the
   works and the clues to which ones left about the rooms as notes, as in
   Clue; one of the buildings it has modelled, two pieces behind works hung
   in it and two on its roof, in its garden or its pool; a new form, a
   building no one drew made of the sections of those buildings (forms.js),
   the same; or one of its cities, the pieces on a roof, in a park, in the
   water and up a tree. The buildings round every place are new forms too,
   on lots of the ground's built cells.

   Tap a work to read its label, and look behind it: a wrong look sets off
   an alarm, and at the third the guards put you out under your tree again.
   Tap a note to read it. Break and place blocks as you need to.

   Its unit is not the cube but the impossible triangle the artist chose
   (14 Oct 2026, a tribar of three tribars round a gap), made a real object
   first (15 Oct 2026: "Make this a 3D model first and then integrate that
   into this artifact as the building block"): six square bars, built in
   SketchUp (scripts/sketchup/impossible_triangle.py), that close into the
   drawing only seen down their diagonal. Every block is one of them, in
   three tones of its own colour by the way a bar's face looks, as the
   drawing has them: up white, east and west grey, north and south black.
   Between the bars you see into the blocks behind, and through a wall a
   block thick to what is beyond it (see FS). The view is at the screen's own
   density, smooth, without grain or dithering; the works are their pictures
   from Artsy in frames of the same three tones; the page's own marks are the
   figure too (the blocks and the pieces as the drawing, the crosshair a
   tribar), and the smoke is triangles. Over the wreck hangs the figure of
   figures, drawn in towards the eye of one standing where you woke: from
   there it is the drawing, from anywhere else its beams come apart across
   the sky (see the figure in the sky). */

(function () {
  "use strict";

  /* Where things are, unless the page says otherwise (window.ROCKET): base, the site's data; art(id),
     a work's picture; play, straight into an escape with no start card; kinds and forms, what one
     can be; name, what the game is called in the tab. */
  var CFG = window.ROCKET || {};
  var NAME = CFG.name || "Rocket";
  var BASE = CFG.base || "../../v2/", CDN = "https://d32dm0rphc51dk.cloudfront.net/", NEXT = "rocket-next", ESCAPED = "rocket-escaped";
  function artOf(id) { return CFG.art ? CFG.art(id) : CDN + id + "/medium.jpg"; }
  var CH = 16, REACH = 6, LOOK = 9, EYE = 1.62, PPM = 96, FOV = 70, SAVE = "rocket-save-v2";
  /* The two views (third person over his head, holographic), every number from a relation.
     His measures come from his form (pearl-body.json, which a better form replaces; these are its values until
     it has come): the head's centre height and radius, the top of his hat (his whole figure's height), the
     farthest of the hat from the head, how far the hat falls when the head leaves, and his leg. */
  var PHI = (1 + Math.sqrt(5)) / 2, T35 = Math.tan(FOV * Math.PI / 360), NEAR = 0.08, FAR = 420, WALK = 4.3, SWIM = 2.2;
  var PEARL = { headY: 1.3724, headR: 0.2457, top: 1.6967, hatReach: 0.458, hatDrop: 0.432, leg: 0.618 };
  var AIM = Math.atan(T35 / 2);                  // what the camera follows sits at the middle of the screen's lower half
  var REST = -Math.atan(T35 / 3);                // the third person's resting look: the horizon on the upper third line
  measure();                                     // the distances that follow from his measures (TP_D, TURN, LIFT ...)
  var V_FALL = 1 / 0.05;                         // a fall no faster than a block in the longest frame (dt 0.05 s): never through a roof
  var T_SIT = 2.7;                               // the time he takes to sit up as he comes to (the eye's rise, 4.5 s to 7.2 s)
  var T_LIFT = 8.2 / 25;                         // the head lifts off in the time a jump takes to rise
  var HOLO_D = PHI;                              // the camera as far behind the head as the head stands off the ground
  // The hologram: twice phi^2 his walk out of doors, twice phi his walk in a room (artist, 21 Oct 2026: "The movement
  // speed in holographic view should be double what it is now"; it was phi^2 and phi).
  var HOLO_V = 2 * WALK * PHI * PHI, HOLO_V_IN = 2 * WALK * PHI;
  var HOLO_T = 150;                              // the theme song, 2 min 30 s (149.9 s): one trip as the hologram
  var BAR = 4 * 60 / 125;                        // one bar of the theme song (4/4 at 125 a minute, calc/tempo.py): the body's flight to the head; the least the hologram gathers to go out
  var HOLO_REFILL = 1;                           // the time fills again in the body at the rate it was spent
  var Pl = window.RocketPlace, Adv = window.Adventures, Fm = window.Forms, B = Pl.B, PIECE_IDS = Pl.PIECE_IDS;
  var floor = Math.floor, round = Math.round, min = Math.min, max = Math.max, abs = Math.abs, hypot = Math.hypot;
  var HOTBAR = [B.BRICK, B.LOG, B.GLASS, B.DIRT, B.STONE];
  var BLOCKS = {};
  BLOCKS[B.BRICK] = "Brick"; BLOCKS[B.LOG] = "Wood"; BLOCKS[B.GLASS] = "Glass"; BLOCKS[B.DIRT] = "Earth"; BLOCKS[B.STONE] = "Stone";
  var ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
  function upper(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* The figure, for the page's own marks (the crosshair, the pieces, the blocks to place, the
     title's): the shader's rule at a point (fa, fb) of an up-triangle in its skew coordinates. */
  function tribarAt(fa, fb) {
    if (fa < 0 || fb < 0 || fa + fb >= 1) { return 0; }
    var dL = fa, dR = 1 - fa - fb, dB = fb, BAR = 0.30, FACE = 0.16;
    if (dL < BAR && dR >= BAR) { return dL < FACE ? 1 : 2; }
    if (dB < BAR && dL >= BAR) { return dB < FACE ? 3 : 4; }
    if (dR < BAR && dB >= BAR) { return dR < FACE ? 5 : 6; }
    return 7;
  }
  var FACE_TONE = [-1, 1, 2, 2, 0, 0, 1, -1];   // region → white 0, grey 1, black 2; the ground and the hole clear
  /* The figure on a canvas wpx wide: level 1 the tribar, level 2 the artist's own, three tribars
     round a gap. tones: [white, grey, black] as [r, g, b]; ground: [r, g, b] or clear. */
  function figure(wpx, level, tones, ground) {
    var hpx = Math.ceil(wpx * Math.sqrt(3) / 2), cv = document.createElement("canvas"), S = 3;
    cv.width = wpx; cv.height = hpx;
    var c = cv.getContext("2d"), img = c.createImageData(wpx, hpx);
    for (var py = 0; py < hpx; py += 1) {
      for (var px = 0; px < wpx; px += 1) {
        var r = 0, g = 0, b = 0, a = 0;
        for (var j = 0; j < S; j += 1) {
          for (var i = 0; i < S; i += 1) {
            var y = 1 - (py + (j + 0.5) / S) / hpx, x = (px + (i + 0.5) / S) / wpx, sb = y, sa = x - y / 2, reg = 0;
            // The figure's own corners cut, as the beams' ends are; inside, the ribbons run on.
            if (sa >= 0 && sb >= 0 && sa + sb < 1 && max(sa, sb, 1 - sa - sb) < 0.955) {
              if (level === 2) {
                var a2 = sa * 2, b2 = sb * 2, i0 = floor(a2), j0 = floor(b2);
                reg = i0 + j0 <= 1 ? tribarAt(a2 - i0, b2 - j0) : 0;
              } else { reg = tribarAt(sa, sb); }
            }
            var t = FACE_TONE[reg], col = t >= 0 ? tones[t] : ground;
            if (col) { r += col[0]; g += col[1]; b += col[2]; a += 1; }
          }
        }
        var q = (py * wpx + px) * 4;
        if (a) { img.data[q] = r / a; img.data[q + 1] = g / a; img.data[q + 2] = b / a; img.data[q + 3] = 255 * a / (S * S); }
      }
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  // A colour's three tones, as the figure has them: its own, lit, and deepened.
  function tonesOf(rgb) {
    return [[min(255, rgb[0] * 0.75 + 64), min(255, rgb[1] * 0.75 + 64), min(255, rgb[2] * 0.75 + 64)], rgb.slice(), [rgb[0] * 0.42, rgb[1] * 0.42, rgb[2] * 0.42]];
  }

  /* The block: the artist's figure built as an object in SketchUp (scripts/sketchup/impossible_triangle.py;
     the model is sketchup/impossible-triangle.skp, 40 in across). Six square bars on the edges of a lattice
     of half-block cells, a tenth of a block thick: three, one along each axis, run the block's whole width,
     so that the bars of blocks side by side run on from one into the next; three are the pinwheel inside.
     They close into the drawing only seen down the block's diagonal, from the north-east and above.
     Each [x0, y0, z0, x1, y1, z1] in the block's own unit, x east, y up, z south. */
  var FIGURE = [[0.45, 0.45, 0, 0.55, 0.55, 1], [0, 0, 0.45, 1, 0.1, 0.55], [0.9, 0.1, 0.45, 1, 1, 0.55],
                [0.55, 0.45, 0.45, 0.9, 0.55, 0.55], [0.45, 0.1, 0.45, 0.55, 0.45, 0.55], [0.9, 0.45, 0, 1, 0.55, 0.45]];
  /* A block as the page shows it (the blocks to place, the pieces, the title's mark): the figure seen down
     that diagonal in parallel projection, which is the artist's drawing. tones [white, grey, black]: the
     faces that look up, east or west, north or south. */
  function blockMark(wpx, tones) {
    var cv = document.createElement("canvas"), S = wpx > 120 ? 2 : 3, r2 = Math.SQRT2, r3 = Math.sqrt(3), r6 = Math.sqrt(6);
    cv.width = wpx; cv.height = wpx;
    var c = cv.getContext("2d"), img = c.createImageData(wpx, wpx);
    var v = [-1 / r3, -1 / r3, 1 / r3], up = [0, 1 / r2, 1 / r2], rt = [-2 / r6, 1 / r6, -1 / r6], C = [0.65, 0.426, 0.576], span = 0.98;
    for (var py = 0; py < wpx; py += 1) {
      for (var px = 0; px < wpx; px += 1) {
        var r = 0, g = 0, b = 0, a = 0;
        for (var j = 0; j < S; j += 1) {
          for (var i = 0; i < S; i += 1) {
            var sx = ((px + (i + 0.5) / S) / wpx * 2 - 1) * span / 2, sy = (1 - (py + (j + 0.5) / S) / wpx * 2) * span / 2;
            var o = [0, 1, 2].map(function (k) { return C[k] + rt[k] * sx + up[k] * sy - v[k] * 3; });
            var best = 1e9, ax = -1;
            for (var n = 0; n < FIGURE.length; n += 1) {
              var bx = FIGURE[n], tn = -1e9, tf = 1e9, at = 0;
              for (var k = 0; k < 3; k += 1) {
                var t0 = (bx[k] - o[k]) / v[k], t1 = (bx[k + 3] - o[k]) / v[k], lo = min(t0, t1), hi = max(t0, t1);
                if (lo > tn) { tn = lo; at = k; }
                tf = min(tf, hi);
              }
              if (tn <= tf && tn < best) { best = tn; ax = at; }
            }
            if (ax >= 0) { var col = tones[ax === 1 ? 0 : ax === 0 ? 1 : 2]; r += col[0]; g += col[1]; b += col[2]; a += 1; }
          }
        }
        var q = (py * wpx + px) * 4;
        if (a) { img.data[q] = r / a; img.data[q + 1] = g / a; img.data[q + 2] = b / a; img.data[q + 3] = 255 * a / (S * S); }
      }
    }
    c.putImageData(img, 0, 0);
    return cv;
  }
  var marks = {};
  function markOf(key, wpx, rgb) {
    if (!marks[key]) { marks[key] = blockMark(wpx, tonesOf(rgb)).toDataURL(); }
    return marks[key];
  }

  // What the game is: the place in blocks, the adventure, and where you have got to in it.
  var place = null, w = null, adv = null, setting = null, seed = 0;
  var paintings = [], byPlane = {}, pieces = [], notes = [];
  var found = [], known = {}, looked = {}, alarms = 0, built = false, launched = null, intro = null, vp = null, eye = null;

  /* ---- the mesh ------------------------------------------------------------- */

  var gl, prog, skyProg, artProg, figProg, homProg, U = {}, SU = {}, AU = {}, FU = {}, HU = {}, OU = {}, chunks = {}, queue = [], canvas, hud;
  // The homage (homage.js): its figures, where you wake in the first world of a visit, not one escaped to.
  var homage = null, homageData = null, escaped = false, onStone = false;
  var FACES = [
    { d: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { d: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] }, { d: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];

  /* The same faces again, for the veil (see frame): those that look each way in turn, each way from the
     furthest of them to the nearest. A face is seen only from the side it looks to, so of the faces looking
     east the furthest from any eye that sees them is the most westerly. Water and the notes have no holes. */
  function veilOrder(pos, inf) {
    var ways = [[], [], [], [], [], []], out = [];
    for (var q = 0; q < inf.length / 16; q += 1) {
      var f = inf[q * 16], b = inf[q * 16 + 1];
      if (b !== B.WATER && b !== B.NOTE) { ways[f].push([pos[q * 12 + (f >> 1)], q * 4]); }
    }
    ways.forEach(function (g, f) {
      g.sort(function (a, c) { return f & 1 ? c[0] - a[0] : a[0] - c[0]; });
      g.forEach(function (e) { var v = e[1]; out.push(v, v + 1, v + 2, v, v + 2, v + 3); });
    });
    return out;
  }
  function upload(ch, pos, inf, ind) {
    if (!ch.vao) { ch.vao = gl.createVertexArray(); ch.pb = gl.createBuffer(); ch.ib = gl.createBuffer(); ch.eb = gl.createBuffer(); }
    gl.bindVertexArray(ch.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.pb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pos), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, ch.ib);
    gl.bufferData(gl.ARRAY_BUFFER, new Uint8Array(inf), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.UNSIGNED_BYTE, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ch.eb);
    var veil = veilOrder(pos, inf);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ind.concat(veil)), gl.STATIC_DRAW);
    ch.count = ind.length; ch.vcount = veil.length;
    gl.bindVertexArray(null);
  }

  function meshChunk(cx, cz) {
    var pos = [], inf = [], ind = [], v = 0, x0 = cx * CH, z0 = cz * CH;
    var SX = w.SX, SZ = w.SZ, SY = w.SY, data = w.data, SEE = w.SEE, NOTE = B.NOTE, WATER = B.WATER;
    var get = function (x, y, z) { return x < 0 || z < 0 || x >= SX || z >= SZ || y >= SY ? 0 : y < 0 ? B.BEDROCK : data[(y * SZ + z) * SX + x]; };
    for (var y = 0; y < SY; y += 1) {
      for (var z = z0; z < z0 + CH; z += 1) {
        for (var x = x0; x < x0 + CH; x += 1) {
          var b = data[(y * SZ + z) * SX + x];
          if (!b) { continue; }
          for (var f = 0; f < 6; f += 1) {
            var Fc = FACES[f], nb = get(x + Fc.d[0], y + Fc.d[1], z + Fc.d[2]);
            if (b === WATER) { if (nb !== 0) { continue; } }
            else if (!SEE[nb] || nb === b) { continue; }
            for (var k = 0; k < 4; k += 1) {
              var cc = Fc.c[k];
              // A note is a sheet on the floor; water's top sits a little low. No shading in the corners:
              // a face is flat, its tone its own, as the figure's faces are.
              pos.push(x + cc[0], y + (b === NOTE ? cc[1] * 0.08 : cc[1] - (b === WATER && Fc.d[1] === 1 ? 0.12 : 0)), z + cc[2]);
              inf.push(f, b, 0, 0);
            }
            ind.push(v, v + 1, v + 2, v, v + 2, v + 3);
            v += 4;
          }
        }
      }
    }
    var key = cx + "," + cz, ch = chunks[key];
    if (!ch) { ch = chunks[key] = { cx: cx, cz: cz }; }
    upload(ch, pos, inf, ind);
    ch.ready = true;
  }
  // Every chunk, nearest first: those round you now, the rest a few each frame.
  function meshAll(x, z) {
    var nx = w.SX / CH, nz = w.SZ / CH, list = [];
    for (var cz = 0; cz < nz; cz += 1) { for (var cx = 0; cx < nx; cx += 1) { list.push([cx, cz, hypot(cx + 0.5 - x / CH, cz + 0.5 - z / CH)]); } }
    list.sort(function (a, b) { return a[2] - b[2]; });
    list.filter(function (c) { return c[2] < 4.5; }).forEach(function (c) { meshChunk(c[0], c[1]); });
    queue = list.filter(function (c) { return c[2] >= 4.5; });
  }
  function pump(ms) {
    var t0 = performance.now();
    while (queue.length && performance.now() - t0 < ms) { var c = queue.shift(); meshChunk(c[0], c[1]); }
  }
  /* The blocks themselves, for the shader to walk through: the place's grid as a texture of block ids,
     a layer to each height (the grid's own order, x along a row, z down the rows), on unit 1. */
  var voxTex = null;
  function voxTexture(data, sx, sy, sz, tex) {
    tex = tex || gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(function (q) { gl.texParameteri(gl.TEXTURE_2D_ARRAY, q[0], q[1]); });
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.R8UI, sx, sz, sy, 0, gl.RED_INTEGER, gl.UNSIGNED_BYTE, data);
    gl.activeTexture(gl.TEXTURE0);
    return tex;
  }
  // The columns from (x0, z0) to (x1, z1), every height, after blocks in them are broken or placed.
  function refresh(x0, z0, x1, z1) {
    x0 = max(0, x0); z0 = max(0, z0); x1 = min(w.SX - 1, x1); z1 = min(w.SZ - 1, z1);
    if (!voxTex || x1 < x0 || z1 < z0) { return; }
    var nx = x1 - x0 + 1, nz = z1 - z0 + 1, buf = new Uint8Array(nx * nz * w.SY), i = 0;
    for (var y = 0; y < w.SY; y += 1) { for (var z = z0; z <= z1; z += 1) { for (var x = x0; x <= x1; x += 1) { buf[i++] = w.data[(y * w.SZ + z) * w.SX + x]; } } }
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, x0, z0, 0, nx, nz, w.SY, gl.RED_INTEGER, gl.UNSIGNED_BYTE, buf);
    gl.activeTexture(gl.TEXTURE0);
  }
  function remeshAt(x, z) {
    var cx = floor(x / CH), cz = floor(z / CH), nx = w.SX / CH, nz = w.SZ / CH;
    refresh(x, z, x, z);
    meshChunk(cx, cz);
    if (x % CH === 0 && cx > 0) { meshChunk(cx - 1, cz); }
    if (x % CH === CH - 1 && cx < nx - 1) { meshChunk(cx + 1, cz); }
    if (z % CH === 0 && cz > 0) { meshChunk(cx, cz - 1); }
    if (z % CH === CH - 1 && cz < nz - 1) { meshChunk(cx, cz + 1); }
  }

  var VS = [
    "#version 300 es",
    "layout(location=0) in vec3 aP; layout(location=1) in vec4 aI;",
    "uniform mat4 uVP; uniform vec3 uOff; uniform mat4 uM;",
    "out vec3 vP; flat out int vF; flat out int vB;",
    "void main() { vP = (uM * vec4(aP, 1.0)).xyz + uOff; vF = int(aI.x); vB = int(aI.y); gl_Position = uVP * vec4(vP, 1.0); }"
  ].join("\n");
  /* The blocks are drawn from their faces in. Each face where a block meets the open (air, water, a note,
     or glass or leaves, which are seen through) starts a ray from the eye on into the blocks behind it, and
     the ray is walked block to block through the grid (uVox), the figure's six bars tested in each. The first
     bar it meets is what is seen, in the tone of the way that face of the bar looks (up white, east and west
     grey, north and south black, as the artist drew them), each a little deeper the further in it lies. A
     ray that comes out into the open again shows what is beyond: the fragment goes, and the faces behind are
     drawn. One still among bars after eight blocks (fewer if the frames come slowly) shows the dark between
     them. Further off a face is what its blocks average to: FAR, the same walk run over many rays
     (scripts/rocket_far.py), at a slant and from nearer straight on. It closes into that mean as its bars
     narrow on the screen: from where a bar (a tenth of a block) is eight of the view's pixels wide to where
     it is under four, a quarter of the distance it once did at two and one (the artist, 15 Oct 2026: "Have
     the distance in which the facades of objects disappear be 1/4 of what it is now"). The pixels are the
     screen's at the quality the view starts at (uPx; while you come to, the view's own coarse ones), so the
     distance is the artist's on every screen, and a slow frame, which makes the view coarser, does not move
     it. That closing, measured from the camera, is the screen's limit: past it no bar opens, too fine for
     the pixels. Short of it a face opens by Mr Pearl's nearness (the artist, 21 Oct 2026: "The distance in
     which facades become transparent due to Mr Pearls proximity should be cut down to 1/4 what it is now and
     it should be 1/32 what it is now for horizontal surfaces exclusively that way the ground isn't constantly
     exposed, only when you are looking down"): the same closing over his distance taken NEAR_F times (uNear),
     four for an upright face, so it opens at a quarter of the distance, and thirty-two for a level one, a
     floor, a roof or a ceiling, a thirty-second; his distance is the nearer of the line up through him from
     his feet to the top of his hat (uAxA to uAxB) and his head's centre, on him or out as the hologram
     (uHeadC). lod is the more closed of the two. On his own body uNear is nought: he closes by the camera
     alone, as before. Every pixel of a face is then
     (1 - lod) of the open face and lod of its mean, the holes too: a bar is mixed toward the mean where it
     is drawn, and a hole, where the faces behind are drawn, is veiled with the mean at lod over them (uVeil,
     the second pass in frame). Near, the facades open and you see in; further off they close. A face keeps
     its own depth: along its ray, every face between it and what it meets is one the walk has passed
     through, so the nearest still wins. Water and the notes are surfaces, not blocks. */
  // For each face, [white, grey, black, the dark between] as seen at a slant, then from nearer straight on.
  var FAR_SLANT = [[0.393, 0.156, 0.289, 0.033], [0.42, 0.083, 0.169, 0.069], [0.099, 0.363, 0.249, 0.057],
                   [0.099, 0.205, 0.542, 0.024], [0.382, 0.202, 0.133, 0.03], [0.45, 0.229, 0.093, 0.029]];
  var FAR_ON = [[0.197, 0.409, 0.149, 0.1], [0.228, 0.366, 0.135, 0.104], [0.366, 0.211, 0.2, 0.081],
                [0.302, 0.175, 0.244, 0.073], [0.219, 0.135, 0.414, 0.079], [0.243, 0.15, 0.388, 0.08]];
  // How many times over his distance is taken where a face opens round Mr Pearl: an upright face at a quarter of the
  // distance, a level one at a thirty-second (the artist's 1/4 and 1/32, 21 Oct 2026; see above).
  var NEAR_F = [4, 32];
  function glslVecs(list, from, n) {
    return "vec" + n + "[" + list.length + "](" + list.map(function (b) {
      return "vec" + n + "(" + b.slice(from, from + n).map(function (q) { return q.toFixed(3); }).join(", ") + ")";
    }).join(", ") + ")";
  }
  var FS = [
    "#version 300 es",
    "precision highp float;", "precision highp int;", "precision highp usampler2DArray;",
    "in vec3 vP; flat in int vF; flat in int vB; out vec4 o;",
    "uniform vec4 uPal[64]; uniform vec3 uEye; uniform vec3 uSun; uniform float uT; uniform vec3 uSky; uniform vec3 uHaze;",
    "uniform usampler2DArray uVox; uniform vec3 uOrg; uniform ivec3 uDim; uniform int uFloor; uniform float uPx;",
    "uniform mat4 uInvM;",   // the world to a grid's own cells: the place's and the rocket's as they are, Mr Pearl's parts turned and scaled
    "uniform int uSteps; uniform int uVeil;",
    "uniform vec3 uAxA; uniform vec3 uAxB; uniform vec3 uHeadC; uniform vec2 uNear;",   // Mr Pearl, whom the faces open round
    "const vec3 N[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));",
    "const vec3 LO[6] = " + glslVecs(FIGURE, 0, 3) + ";",
    "const vec3 HI[6] = " + glslVecs(FIGURE, 3, 3) + ";",
    "const vec4 FAR_SLANT[6] = " + glslVecs(FAR_SLANT, 0, 4) + ", FAR_ON[6] = " + glslVecs(FAR_ON, 0, 4) + ";",
    "const int STEPS = 8;",
    // What is in a block of the grid: beside it, air; under the world, bedrock.
    "uint idAt(ivec3 c) {",
    "  if (c.x < 0 || c.z < 0 || c.x >= uDim.x || c.z >= uDim.z || c.y >= uDim.y) { return 0u; }",
    "  if (c.y < 0) { return uFloor == 1 ? " + B.BEDROCK + "u : 0u; }",
    "  return texelFetch(uVox, ivec3(c.x, c.z, c.y), 0).r;",
    "}",
    "bool solid(uint b) { return b != 0u && b != " + B.WATER + "u && b != " + B.NOTE + "u; }",
    // A bar's face in a block's colours, by its axis (0 east-west, 1 up-down, 2 north-south) and the way it looks.
    "vec3 bar(int id, int ax, float s) {",
    "  vec4 pe = uPal[id]; vec3 c = pe.rgb / 255.0; int st = int(pe.a + 0.5);",
    "  if (st == 1 && !(ax == 1 && s > 0.0)) { c = uPal[" + B.DIRT + "].rgb / 255.0; }",   // grass over earth
    "  if (st == 2 && ax == 1) { c = min(vec3(1.0), c * 1.35); }",                         // a log's rings
    "  if (st == 4) { c = mix(uSky, c, 0.5); }",                                           // glass
    "  vec3 L = min(vec3(1.0), c * 0.75 + 0.25), M = c, D = c * (st == 3 ? 0.55 : 0.42);",
    "  if (st == 11) { L = c; M = c * 0.9; D = c * 0.78; }",                               // a gallery's plaster: quieter, for the works on it
    "  vec3 t = ax == 0 ? M : ax == 2 ? D : L * (s > 0.0 ? 1.0 : 0.8);",
    "  return st == 7 ? t * (1.0 + 0.35 * sin(uT * 3.0)) : t;",                            // the pieces breathe, to be seen from far off
    "}",
    "vec3 dark(int id) { return uPal[int(uPal[id].a + 0.5) == 1 ? " + B.DIRT + " : id].rgb / 255.0 * 0.16; }",
    "void main() {",
    "  vec4 pe = uPal[vB]; int st = int(pe.a + 0.5);",
    "  vec3 n = N[vF], col; float dist = length(vP - uEye), th = 0.0;",
    "  float lod = smoothstep(0.0125, 0.0275, uPx * dist);",   // a bar eight pixels wide, then under four: the screen's limit
    // Round him: his distance (the line through him, feet to hat top, or his head) taken four times, or thirty-two for a level face.
    "  vec3 axis = uAxB - uAxA;",
    "  float him = min(length(vP - uAxA - axis * clamp(dot(vP - uAxA, axis) / max(dot(axis, axis), 1e-6), 0.0, 1.0)), length(vP - uHeadC));",
    "  lod = max(lod, smoothstep(0.0125, 0.0275, uPx * him * (abs(n.y) > 0.5 ? uNear.y : uNear.x)));",
    // The veil (see frame) is only where a face is closing: not water, not a note, not its back.
    "  if (uVeil == 1 && (lod <= 0.0 || lod >= 1.0 || st == 6 || st == 10 || !gl_FrontFacing)) { discard; }",
    "  if (st == 6 || st == 10) {",
    // Water: its own colour, the sky in it at a slant, a slow shimmer. A note: paper, catching the eye.
    "    vec3 c = pe.rgb / 255.0;",
    "    if (st == 6) { float sl = 1.0 - abs(normalize(vP - uEye).y); c = mix(c, uSky, 0.45 * sl * sl) * (0.94 + 0.06 * sin(uT * 0.9 + (vP.x - vP.z) * 0.8)); }",
    "    col = c * (0.56 + 0.16 * n.y + 0.58 * max(dot(n, uSun), 0.0));",
    "    if (st == 10) { col = c * (0.98 + 0.18 * (0.5 + 0.5 * sin(uT * 2.6))); }",
    "  } else {",
    "    if (!gl_FrontFacing) { discard; }",
    "    vec3 d = normalize(vP - uEye);",
    "    d = normalize(mat3(uInvM) * d);",   // the ray taken into the grid's frame
    "    vec4 fw = mix(FAR_SLANT[vF], FAR_ON[vF], smoothstep(0.15, 0.75, -dot(d, n)));",
    "    vec3 far = fw.x * bar(vB, 1, 1.0) + fw.y * bar(vB, 0, 1.0) + fw.z * bar(vB, 2, 1.0) + fw.w * dark(vB);",
    // The veil: drawn where the depth test lets it, which is only where this face let a hole through.
    "    if (uVeil == 1) { o = vec4(mix(far, uHaze, clamp(1.0 - exp(-dist * 0.006), 0.0, 1.0)), lod); return; }",
    "    if (lod >= 1.0) { col = far; } else {",
    "      vec3 p0 = (uInvM * vec4(vP, 1.0)).xyz - uOrg;",
    "      d = mix(d, vec3(1e-6), vec3(equal(d, vec3(0.0))));",
    "      vec3 inv = 1.0 / d, td = abs(inv);",
    "      ivec3 c = ivec3(floor(p0 - n * 0.5)), sg = ivec3(sign(d));",
    "      vec3 tm = (vec3(c) + step(0.0, d) - p0) * inv;",
    "      float tin = 0.0; int res = 0; uint lb = uint(vB);",
    "      for (int k = 0; k < STEPS; k++) {",
    "        if (k >= uSteps) { break; }",
    "        uint b = idAt(c);",
    "        if (!solid(b)) { res = 2; break; }",
    "        lb = b;",
    "        float tout = min(min(tm.x, tm.y), tm.z), best = tout + 1e-4; int ax = -1;",
    "        vec3 q = p0 - vec3(c);",
    "        for (int i = 0; i < 6; i++) {",
    "          vec3 a = (LO[i] - q) * inv, e = (HI[i] - q) * inv, lo = min(a, e), hi = max(a, e);",
    "          float tn = max(max(lo.x, lo.y), lo.z), tf = min(min(hi.x, hi.y), hi.z);",
    "          if (tn <= tf && tf >= tin && tn < best) { best = tn; ax = lo.x >= lo.y && lo.x >= lo.z ? 0 : lo.y >= lo.z ? 1 : 2; }",
    "        }",
    "        if (ax >= 0) { res = 1; th = max(best, tin); col = bar(int(b), ax, -float(sg[ax])) * (1.0 - 0.07 * float(k)); break; }",
    "        if (tm.x < tm.y && tm.x < tm.z) { c.x += sg.x; tin = tm.x; tm.x += td.x; }",
    "        else if (tm.y < tm.z) { c.y += sg.y; tin = tm.y; tm.y += td.y; }",
    "        else { c.z += sg.z; tin = tm.z; tm.z += td.z; }",
    "      }",
    "      if (res == 0) { col = dark(int(lb)); th = tin; }",
    "      if (res == 2) { discard; }",
    "      else { col = mix(col, far, lod); }",
    "    }",
    "  }",
    "  col = mix(col, uHaze, clamp(1.0 - exp(-(dist + th) * 0.006), 0.0, 1.0));",
    "  o = vec4(col, 1.0);",
    "}"
  ].join("\n");
  var SKY_VS = "#version 300 es\nlayout(location=0) in vec2 a; out vec2 vA; void main(){ vA = a; gl_Position = vec4(a, 0.9999, 1.0); }";
  var SKY_FS = [
    "#version 300 es", "precision highp float;", "in vec2 vA; out vec4 o;",
    "uniform mat4 uInv; uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uHaze;",
    "void main() { vec4 p = uInv * vec4(vA, 1.0, 1.0); vec3 r = normalize(p.xyz / p.w - uEye);",
    "  vec3 c = mix(uHaze, uSky, pow(clamp(r.y, 0.0, 1.0), 0.5));",
    "  float s = dot(r, uSun); c += vec3(1.0, 0.95, 0.85) * (smoothstep(0.99955, 0.99972, s) * 0.9 + pow(max(s, 0.0), 30.0) * 0.12);",
    "  o = vec4(c, 1.0); }"
  ].join("\n");
  // The works: each its picture on a quad a hair off its wall, in the same haze.
  var ART_VS = [
    "#version 300 es",
    "layout(location=0) in vec3 aP; layout(location=1) in vec2 aT;",
    "uniform mat4 uVP; out vec3 vP; out vec2 vT;",
    "void main() { vP = aP; vT = aT; gl_Position = uVP * vec4(aP, 1.0); }"
  ].join("\n");
  var ART_FS = [
    "#version 300 es", "precision highp float;", "in vec3 vP; in vec2 vT; out vec4 o;",
    "uniform sampler2D uTex; uniform vec3 uEye; uniform vec3 uHaze; uniform float uLit;",
    "void main() { vec3 c = texture(uTex, vT).rgb * uLit; float d = length(uEye - vP);",
    "  c = mix(c, uHaze, clamp(1.0 - exp(-d * 0.006), 0.0, 1.0)); o = vec4(c, 1.0); }"
  ].join("\n");

  function compile(vs, fs) {
    var p = gl.createProgram();
    [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].forEach(function (s) {
      var sh = gl.createShader(s[0]); gl.shaderSource(sh, s[1]); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(sh)); }
      gl.attachShader(p, sh);
    });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(p)); }
    return p;
  }
  function uploadPalette() {
    var pal = new Float32Array(64 * 4);
    for (var i = 0; i < 64; i += 1) { var c = w.pal[i] || [255, 0, 255]; pal[i * 4] = c[0]; pal[i * 4 + 1] = c[1]; pal[i * 4 + 2] = c[2]; pal[i * 4 + 3] = w.style[i] || 0; }
    gl.useProgram(prog);
    gl.uniform4fv(U.uPal, pal);
    worldPal = pal;
  }

  /* ---- the works on the walls ------------------------------------------------- */

  var artVao = null, loading = 0;
  // Which end of a work is its left, to one looking at it.
  function leftU(p) { return p.axis === "x" ? (p.dir > 0 ? p.u1 : p.u0) : (p.dir > 0 ? p.u0 : p.u1); }
  function uploadArt() {
    var data = new Float32Array(max(1, paintings.length) * 30);
    paintings.forEach(function (p, i) {
      var off = p.dir * 0.02, L = leftU(p), R = L === p.u0 ? p.u1 : p.u0;
      var at = function (u, y) { return p.axis === "x" ? [p.plane + off, y, u] : [u, y, p.plane + off]; };
      var lb = at(L, p.y0), rb = at(R, p.y0), rt = at(R, p.y1), lt = at(L, p.y1);
      [[lb, 0, 1], [rb, 1, 1], [rt, 1, 0], [lb, 0, 1], [rt, 1, 0], [lt, 0, 0]].forEach(function (q, j) {
        var o = i * 30 + j * 5;
        data[o] = q[0][0]; data[o + 1] = q[0][1]; data[o + 2] = q[0][2]; data[o + 3] = q[1]; data[o + 4] = q[2];
      });
      p.first = i * 6;
    });
    if (!artVao) { artVao = gl.createVertexArray(); }
    gl.bindVertexArray(artVao);
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.bindVertexArray(null);
  }
  /* A work's face: its picture in a frame, or its colours while it comes. The frame is the figure's
     three tones: lit along its top and left, shadowed along its bottom and right, and inside, where
     it turns in to the picture, the other way about, as the tribar's inner faces take the next
     tone (gilt for the works before 1900, dark wood after). */
  function paintTexture(p, img) {
    var W = max(16, min(640, round((p.u1 - p.u0) * PPM))), H = max(16, min(640, round((p.y1 - p.y0) * PPM)));
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var c = cv.getContext("2d"), fr = max(4, round(PPM * 0.075)), old = p.f.year && p.f.year < 1900;
    var tones = old ? ["#d9b468", "#a37b3b", "#684a20"] : ["#5a4c40", "#30271f", "#120d0a"];
    var bevel = function (x0, y0, x1, y1, t, lit, dark) {
      c.fillStyle = lit;
      c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y0); c.lineTo(x1 - t, y0 + t); c.lineTo(x0 + t, y0 + t); c.lineTo(x0 + t, y1 - t); c.lineTo(x0, y1); c.closePath(); c.fill();
      c.fillStyle = dark;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x0, y1); c.lineTo(x0 + t, y1 - t); c.lineTo(x1 - t, y1 - t); c.lineTo(x1 - t, y0 + t); c.lineTo(x1, y0); c.closePath(); c.fill();
    };
    c.fillStyle = tones[1];
    c.fillRect(0, 0, W, H);
    bevel(0, 0, W, H, fr * 0.36, tones[0], tones[2]);
    bevel(fr * 0.72, fr * 0.72, W - fr * 0.72, H - fr * 0.72, fr * 0.28, tones[2], tones[0]);
    var iw = W - fr * 2, ih = H - fr * 2;
    if (img) {
      var s = max(iw / img.width, ih / img.height), dw = img.width * s, dh = img.height * s;
      c.save(); c.beginPath(); c.rect(fr, fr, iw, ih); c.clip();
      c.drawImage(img, fr + (iw - dw) / 2, fr + (ih - dh) / 2, dw, dh);
      c.restore();
    } else {
      var cols = p.f.colours && p.f.colours.length ? p.f.colours : ["#6b5a48", "#8a7860", "#3c3128"];
      cols.forEach(function (col, i) { c.fillStyle = col; c.fillRect(fr, fr + floor(ih * i / cols.length), iw, Math.ceil(ih / cols.length)); });
    }
    if (!p.tex) { p.tex = gl.createTexture(); }
    gl.bindTexture(gl.TEXTURE_2D, p.tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); }
    catch (e) { if (img) { paintTexture(p, null); } return; }
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    p.shown = !!img;
  }
  function loadPicture(p) {
    if (p.asked || !p.f.image) { return; }
    p.asked = true;
    loading += 1;
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = function () { loading -= 1; paintTexture(p, img); };
    img.onerror = function () { loading -= 1; };
    img.src = artOf(p.f.image);
  }
  // The pictures of the works near you, a few at a time.
  function fetchNear() {
    if (!paintings.length) { return; }
    var m = me();
    paintings.filter(function (p) { return !p.asked && abs(p.cx - m.x) < 40 && abs(p.cz - m.z) < 40 && abs(p.y0 - m.y) < 14; })
      .sort(function (a, b) { return hypot(a.cx - m.x, a.cz - m.z) - hypot(b.cx - m.x, b.cz - m.z); })
      .slice(0, max(0, 6 - loading)).forEach(loadPicture);
  }
  // Is a work hung on a face of this block?
  function hangsOn(x, y, z) {
    var test = function (key, u, dir) {
      return (byPlane[key] || []).some(function (p) { return p.dir === dir && u + 1 > p.u0 && u < p.u1 && y + 1 > p.y0 && y < p.y1; });
    };
    return test("x" + x, z, -1) || test("x" + (x + 1), z, 1) || test("z" + z, x, -1) || test("z" + (z + 1), x, 1);
  }

  /* ---- the figure in the sky ---------------------------------------------------------- */

  /* The figure of figures (the figure's own rule applied to the figure: three of it round a gap, nine
     tribars, 27 beams; figure.html, scripts/figure_studies.py) hangs over the wreck, a hundred metres off and
     more, drawn in towards one eye: yours, standing where you woke under your tree. A point at (a, b) in the
     drawing and d along its line of sight goes to eye + (g (a R + b U) + far F) / (1 + beta d): every line
     of sight of the drawing onto one ray from that eye, nearer for what the drawing has nearer. So from there
     it is the drawing exactly, and from anywhere else its beams come apart across the sky, long and tapering
     away from the tree. The map is a projective one, so each beam's faces stay planes. The figure is in the
     drawing's own tones under a lighter haze, and nothing to walk on. */
  var SKY_ORDERS = [[1, 0, 2], [0, 2, 1], [2, 1, 0]], SKY_OFFS = [[0, 0, 0], [0, 1, 0], [1, 1, 0]], SKY_BASE = [[0, 0, 0], [0, 1, 0], [1, 1, 0]];
  var SKY_CONF = [[0, 0], [1, -1], [1, -1]], SKY_TURN = [[[1, 0, 0], [0, 1, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1], [1, 0, 0]], [[0, 0, 1], [1, 0, 0], [0, 1, 0]]];
  var SKY_FAR = 140, SKY_HALF = 0.22;
  // The figure at a level of its rule (2 the drawing, 3 three of it round a gap), as boxes [lo, hi] in cells
  // of its lattice, in the model's axes (z up); a face pair along axis k is grey, black, white for x, y, z.
  function figureBeams(level) {
    var H = 0.11, p = [0, 0, 0], shape = [];
    SKY_ORDERS[0].forEach(function (ax) {
      var q = p.slice();
      q[ax] += 1;
      shape.push([min(p[0], q[0]) - H, min(p[1], q[1]) - H, min(p[2], q[2]) - H, max(p[0], q[0]) + H, max(p[1], q[1]) + H, max(p[2], q[2]) + H]);
      p = q;
    });
    for (var j = 1; j < level; j += 1) {
      var sc = Math.pow(2, j - 1), next = [];
      SKY_CONF.forEach(function (rt, i) {
        var M = SKY_TURN[rt[0]], t = [0, 1, 2].map(function (k) { return sc * (SKY_BASE[i][k] + rt[1] + SKY_OFFS[rt[0]][k]); });
        shape.forEach(function (b) {
          var at = function (o) { return [0, 1, 2].map(function (k) { return M[k][0] * b[o] + M[k][1] * b[o + 1] + M[k][2] * b[o + 2] + t[k]; }); };
          var lo = at(0), hi = at(3);
          next.push([min(lo[0], hi[0]), min(lo[1], hi[1]), min(lo[2], hi[2]), max(lo[0], hi[0]), max(lo[1], hi[1]), max(lo[2], hi[2])]);
        });
      });
      shape = next;
    }
    return shape;
  }
  // The beams drawn in towards eye E, the drawing's middle seen along F, SKY_HALF radians each side.
  function drawnIn(boxes, E, F) {
    var r2 = Math.SQRT2, r3 = Math.sqrt(3), r6 = Math.sqrt(6);
    var RV = [-2 / r6, 1 / r6, 1 / r6], UV = [0, -1 / r2, 1 / r2], NV = [1 / r3, 1 / r3, 1 / r3];
    var abd = function (b, g) {
      var p = [b[g & 4 ? 3 : 0], b[g & 2 ? 4 : 1], b[g & 1 ? 5 : 2]];
      return [RV, UV, NV].map(function (v) { return p[0] * v[0] + p[1] * v[1] + p[2] * v[2]; });
    };
    var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    boxes.forEach(function (b) { for (var g = 0; g < 8; g += 1) { var q = abd(b, g); for (var k = 0; k < 3; k += 1) { lo[k] = min(lo[k], q[k]); hi[k] = max(hi[k], q[k]); } } });
    var mid = [0, 1, 2].map(function (k) { return (lo[k] + hi[k]) / 2; });
    var g0 = SKY_FAR * Math.tan(SKY_HALF) / ((hi[0] - lo[0]) / 2), beta = 0.43 / ((hi[2] - lo[2]) / 2);
    var U = norm([-F[0] * F[1], 1 - F[1] * F[1], -F[2] * F[1]]), R = [F[1] * U[2] - F[2] * U[1], F[2] * U[0] - F[0] * U[2], F[0] * U[1] - F[1] * U[0]];
    return boxes.map(function (b) {
      var P = [];
      for (var g = 0; g < 8; g += 1) {
        var q = abd(b, g), a = (q[0] - mid[0]) * g0, bb = (q[1] - mid[1]) * g0, l = 1 / (1 + beta * (q[2] - mid[2]));
        P.push([0, 1, 2].map(function (k) { return E[k] + (a * R[k] + bb * U[k] + SKY_FAR * F[k]) * l; }));
      }
      return P;
    });
  }
  // How much of it the place hides from the eye: its corners and middles looked for along their rays.
  function hiddenFrom(E, hexes, worse) {
    var n = 0;
    for (var i = 0; i < hexes.length; i += 1) {
      var P = hexes[i], pts = P.concat([[0, 1, 2].map(function (k) { return P.reduce(function (s, p) { return s + p[k]; }, 0) / 8; })]);
      for (var j = 0; j < pts.length; j += 1) {
        var d = [pts[j][0] - E[0], pts[j][1] - E[1], pts[j][2] - E[2]], L = hypot(d[0], d[1], d[2]);
        for (var t = 1; t < L; t += 0.5) {
          var x = floor(E[0] + d[0] * t / L), y = floor(E[1] + d[1] * t / L), z = floor(E[2] + d[2] * t / L);
          if (x < 0 || z < 0 || x >= w.SX || z >= w.SZ || y >= w.SY) { break; }
          var b = y < 0 ? B.BEDROCK : w.get(x, y, z);
          if (w.SOLID[b]) { n += w.SEE[b] ? 0.25 : 1; if (!w.SEE[b]) { break; } }
        }
        if (n > worse) { return n; }
      }
    }
    return n;
  }
  // Over the wreck, as near straight over it and as low as the place leaves the figure clear.
  function placeSky() {
    var at = underTree(), E = [at.x, at.y + EYE, at.z], wr = place.wreck, beams = figureBeams(3), best = null;
    var toWreck = Math.atan2(wr.x + 0.5 - at.x, -(wr.z + 0.5 - at.z));
    [0, 0.12, -0.12, 0.24, -0.24].forEach(function (db, i) {
      [0.42, 0.36, 0.49, 0.53].forEach(function (el, j) {
        var hexes = drawnIn(beams, E, lookDir(toWreck + db, el)), cost = hiddenFrom(E, hexes, best ? best.cost : 1e9) * 4 + i + j;
        if (!best || cost < best.cost) { best = { cost: cost, hexes: hexes }; }
      });
    });
    // Six faces to a beam, each in the tone of its pair of faces, as the drawing has them.
    var data = [];
    best.hexes.forEach(function (P) {
      for (var k = 0; k < 3; k += 1) {
        for (var side = 0; side < 2; side += 1) {
          var q = [[0, 0], [1, 0], [1, 1], [0, 1]].map(function (ab) {
            var bits = [0, 0, 0]; bits[k] = side; bits[(k + 1) % 3] = ab[0]; bits[(k + 2) % 3] = ab[1]; return P[4 * bits[0] + 2 * bits[1] + bits[2]];
          });
          [q[0], q[1], q[2], q[0], q[2], q[3]].forEach(function (v) { data.push(v[0], v[1], v[2], k); });
        }
      }
    });
    var vao = gl.createVertexArray(), buf = gl.createBuffer();
    gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 16, 12);
    gl.bindVertexArray(null);
    return { vao: vao, buf: buf, count: data.length / 4, eye: E, hexes: best.hexes, cost: best.cost, away: false, said: false };
  }
  var FIG_VS = "#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in float aT; uniform mat4 uVP; out vec3 vP; flat out int vT;\n" +
    "void main() { vP = aP; vT = int(aT + 0.5); gl_Position = uVP * vec4(aP, 1.0); }";
  var FIG_FS = "#version 300 es\nprecision highp float;\nin vec3 vP; flat in int vT; out vec4 o; uniform vec3 uEye; uniform vec3 uHaze;\n" +
    "const vec3 T[3] = vec3[3](vec3(0.5), vec3(0.03), vec3(0.97));\n" +   // the drawing's grey, black and white
    "void main() { float d = length(vP - uEye); o = vec4(mix(T[vT], uHaze, clamp(1.0 - exp(-d * 0.0022), 0.0, 1.0)), 1.0); }";
  // The homage's figures: each vertex's tone as weights of the drawing's grey, black and white, in the place's haze.
  var HOM_VS = "#version 300 es\nlayout(location=0) in vec3 aP; layout(location=1) in vec3 aW; uniform mat4 uVP; out vec3 vP; out vec3 vW;\n" +
    "void main() { vP = aP; vW = aW; gl_Position = uVP * vec4(aP, 1.0); }";
  var HOM_FS = "#version 300 es\nprecision highp float;\nin vec3 vP; in vec3 vW; out vec4 o; uniform vec3 uEye; uniform vec3 uHaze;\n" +
    "void main() { float t = dot(vW, vec3(0.5, 0.03, 0.97)) / max(vW.x + vW.y + vW.z, 1e-3), d = length(vP - uEye);\n" +
    "  o = vec4(mix(vec3(t), uHaze, clamp(1.0 - exp(-d * 0.006), 0.0, 1.0)), 1.0); }";
  function homageUpload() {
    (homage ? homage.figures : []).forEach(function (f) {
      var vao = gl.createVertexArray(), pb = gl.createBuffer(), wb = gl.createBuffer(), ib = gl.createBuffer();
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, pb); gl.bufferData(gl.ARRAY_BUFFER, f.mesh.pos, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, wb); gl.bufferData(gl.ARRAY_BUFFER, f.mesh.wts, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, f.mesh.idx, gl.STATIC_DRAW);
      gl.bindVertexArray(null);
      f.vao = vao; f.count = f.mesh.idx.length;
    });
  }
  // On a stone of the homage, once each: which figure it is, and how it closes from there.
  function homageCheck() {
    if (!homage || intro || launched) { return; }
    var st = Homage.standing(homage, P.x, P.y, P.z);
    if (st && !st.told) { st.told = true; say(st.name + ". " + st.said, true); }
  }
  // Back where you woke after walking off, the view is his own eyes, as on a stone of the homage (camera, treeSpot),
  // and you are told once that the figure in the sky has closed again.
  function skyCheck() {
    if (!skyFig || intro || launched) { return; }
    if (hypot(P.x - skyFig.eye[0], P.z - skyFig.eye[2]) > 6) { skyFig.away = true; }
    if (onStone && treeSpot() && !skyFig.said) { skyFig.said = true; say("Back where you woke the view is his own eyes, and from them the figure in the sky is the drawing again; anywhere else it comes apart.", true); }
  }
  // Where you woke, the one point the figure in the sky closes from, once you have walked off (skyFig.away: not as
  // you come to) and come back to stand there: within the step the hint was given at (0.45 m), at its height (a
  // stone's 0.3 m).
  function treeSpot() {
    return !!(skyFig && skyFig.away && hypot(P.x - skyFig.eye[0], P.z - skyFig.eye[2]) < 0.45 && abs(P.y + EYE - skyFig.eye[1]) < 0.3);
  }

  /* ---- the camera ------------------------------------------------------------ */

  function perspective(fovy, aspect, near, far) {
    var f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  }
  function mul(a, b) {
    var o = new Array(16);
    for (var i = 0; i < 4; i++) { for (var j = 0; j < 4; j++) { var s = 0; for (var k = 0; k < 4; k++) { s += a[k * 4 + j] * b[i * 4 + k]; } o[i * 4 + j] = s; } }
    return o;
  }
  function lookDir(yaw, pitch) { return [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)]; }
  function view(e, yaw, pitch) {
    var f = lookDir(yaw, pitch), r = [Math.cos(yaw), 0, Math.sin(yaw)];
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return [r[0], u[0], -f[0], 0, r[1], u[1], -f[1], 0, r[2], u[2], -f[2], 0,
            -(r[0] * e[0] + r[1] * e[1] + r[2] * e[2]), -(u[0] * e[0] + u[1] * e[1] + u[2] * e[2]), f[0] * e[0] + f[1] * e[1] + f[2] * e[2], 1];
  }
  function invert(m) {
    var inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
    var det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    det = det ? 1 / det : 0;
    return inv.map(function (x) { return x * det; });
  }

  /* ---- you ---------------------------------------------------------------------- */

  var P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, ground: false, wet: false, face: 0, want: null, walked: 0, amount: 0 };
  // pov: the view now, "third" (over his head; his own eyes in the films, on a stone of the homage and back where you
  // woke) or "holo" while the head is out; Hd: the head while it is out.
  var pov = "third", Hd = null, blend = null, camD = 0, camLast = null, holoTop = 0, drawMe = { body: false, head: false };
  // The view the game kept until 21 Oct 2026 (third or first person): first person is no longer a choice, so a kept
  // one is let go and the view is third person.
  try { localStorage.removeItem("rocket-view"); } catch (e) { /* nothing was kept */ }
  var input = { fwd: 0, side: 0, jump: false, keys: {} };
  var mode = "break", slot = 0;

  function boxHits(x, y, z) {
    var r = 0.3, S = w.SOLID;
    for (var by = floor(y); by <= floor(y + 1.79); by += 1) {
      for (var bz = floor(z - r); bz <= floor(z + r); bz += 1) {
        for (var bx = floor(x - r); bx <= floor(x + r); bx += 1) { if (S[w.get(bx, by, bz)]) { return true; } }
      }
    }
    return false;
  }

  // What the hand asks: forward and sideways (the stick, W A S D), and up (jump; as the hologram, rise or sink).
  function controls(dt) {
    var k = input.keys;
    var fwd = input.fwd + ((k.w || k.ArrowUp) ? 1 : 0) - ((k.s || k.ArrowDown) ? 1 : 0);
    var side = input.side + (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (k.ArrowLeft) { P.yaw -= dt * 2; }
    if (k.ArrowRight) { P.yaw += dt * 2; }
    var len = hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    return { fwd: fwd, side: side, up: (input.jump || k[" "] ? 1 : 0) - (k.Shift || k.c ? 1 : 0) };
  }
  function turnTo(a, b, step) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + max(-step, min(step, d)); }
  function physics(dt, c) {
    var fwd = c.fwd, side = c.side;
    P.wet = w.get(floor(P.x), floor(P.y + 0.6), floor(P.z)) === B.WATER;
    var speed = P.wet ? SWIM : WALK;
    P.vx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) * speed;
    P.vz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) * speed;
    // He faces the way he walks (relative to the camera), or what he reaches for; while a swing is on, what it will
    // strike, walking or not (the legs walk on), and the camera keeps to the way he walks.
    var aim = swingYaw(), way = Math.atan2(P.vx, -P.vz);
    if (aim !== null) { P.face = turnTo(P.face, aim, TURN * dt); if (fwd || side) { P.want = null; } }
    else if (fwd || side) { P.face = turnTo(P.face, way, TURN * dt); P.want = null; }
    else if (P.want !== null) { P.face = turnTo(P.face, P.want, TURN * dt); }
    follow(dt, c, aim !== null && (fwd || side) ? way : P.face);
    var jump = c.up > 0, ox = P.x, oz = P.z;
    if (P.wet) { P.vy += (jump ? 9 : -6) * dt; P.vy = max(-2.5, min(3, P.vy)); }
    else {
      P.vy = max(-V_FALL, P.vy - 25 * dt);
      if (jump && P.ground) { P.vy = 8.2; P.ground = false; }
    }
    // Across, then along, then up and down, each stopped by the blocks; a single step is climbed by itself.
    var nx = P.x + P.vx * dt;
    if (boxHits(nx, P.y, P.z)) {
      if (P.ground && !boxHits(nx, P.y + 1.05, P.z) && !boxHits(P.x, P.y + 1.05, P.z) && (fwd || side)) { P.vy = 8.2; P.ground = false; }
      nx = P.x;
    }
    P.x = nx;
    var nz = P.z + P.vz * dt;
    if (boxHits(P.x, P.y, nz)) {
      if (P.ground && !boxHits(P.x, P.y + 1.05, nz) && !boxHits(P.x, P.y + 1.05, P.z) && (fwd || side)) { P.vy = 8.2; P.ground = false; }
      nz = P.z;
    }
    P.z = nz;
    var ny = P.y + P.vy * dt;
    if (boxHits(P.x, ny, P.z)) {
      // Landing: the feet set down on the top of the block below; a ceiling stops the rise.
      if (P.vy < 0) { var fy = floor(ny) + 1; ny = fy <= P.y + 0.001 && !boxHits(P.x, fy, P.z) ? fy : P.y; P.ground = true; }
      else { ny = P.y; }
      P.vy = 0;
    } else { P.ground = false; }
    P.y = max(1, ny);
    P.x = max(0.5, min(w.SX - 0.5, P.x)); P.z = max(0.5, min(w.SZ - 0.5, P.z));
    // His walk is by the ground he covers, not by the clock, so a foot never slides; he falls into his stride
    // and out of it in the time he walks one step.
    var step = hypot(P.x - ox, P.z - oz), on = (P.ground || P.wet) && step > 1e-4;
    if (on) { P.walked += step; }
    P.amount += ((on ? 1 : 0) - P.amount) * (1 - Math.exp(-dt / STEP_T));
  }

  /* What a ray from the eye meets first: a work on a wall, or the block and the face it came in by. */
  function cast(dir, reach, o, t0) {
    o = o || eye; t0 = t0 || 0;
    var x = floor(o[0]), y = floor(o[1]), z = floor(o[2]);
    var sx = dir[0] > 0 ? 1 : -1, sy = dir[1] > 0 ? 1 : -1, sz = dir[2] > 0 ? 1 : -1;
    var tdx = abs(1 / dir[0]), tdy = abs(1 / dir[1]), tdz = abs(1 / dir[2]);
    var tx = (sx > 0 ? x + 1 - o[0] : o[0] - x) * tdx, ty = (sy > 0 ? y + 1 - o[1] : o[1] - y) * tdy, tz = (sz > 0 ? z + 1 - o[2] : o[2] - z) * tdz;
    var last = null, t = 0, axis = -1;
    while (t < reach) {
      var b = w.get(x, y, z);
      if (b !== B.AIR && b !== B.WATER && t >= t0) {
        if (axis === 0 || axis === 2) {
          var plane = axis === 0 ? (sx > 0 ? x : x + 1) : (sz > 0 ? z : z + 1), list = byPlane[(axis === 0 ? "x" : "z") + plane];
          if (list) {
            var hy = o[1] + dir[1] * t, u = axis === 0 ? o[2] + dir[2] * t : o[0] + dir[0] * t, nd = axis === 0 ? -sx : -sz;
            for (var i = 0; i < list.length; i += 1) {
              var p = list[i];
              if (p.dir === nd && u >= p.u0 && u <= p.u1 && hy >= p.y0 && hy <= p.y1) { return { painting: p, t: t }; }
            }
          }
        }
        return { x: x, y: y, z: z, b: b, prev: last, t: t };
      }
      last = b === B.AIR || b === B.WATER ? [x, y, z] : null;
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; axis = 0; } else if (ty < tz) { y += sy; t = ty; ty += tdy; axis = 1; } else { z += sz; t = tz; tz += tdz; axis = 2; }
    }
    return null;
  }
  // Where he reaches from: his eye, or the head while it is out.
  function reachFrom() { return Hd ? [Hd.x, Hd.y, Hd.z] : [P.x, P.y + EYE, P.z]; }
  // What the crosshair (or a tap) is on: the ray from the camera, begun where it passes him (nothing between the
  // camera and him counts), and what it meets measured from where he reaches from (r). From his own eyes (a stone,
  // where you woke) the ray begins at them, as before.
  function pick(dir) {
    var at = reachFrom(), t0 = max(0, (at[0] - eye[0]) * dir[0] + (at[1] - eye[1]) * dir[1] + (at[2] - eye[2]) * dir[2]);
    var hit = cast(dir, t0 + LOOK, eye, t0);
    if (!hit) { return null; }
    hit.r = hypot(eye[0] + dir[0] * hit.t - at[0], eye[1] + dir[1] * hit.t - at[1], eye[2] + dir[2] * hit.t - at[2]);
    return hit.r <= LOOK ? hit : null;
  }
  function dirAt(px, py) {
    var r = canvas.getBoundingClientRect(), nx = (px - r.left) / r.width * 2 - 1, ny = 1 - (py - r.top) / r.height * 2;
    var inv = invert(vp), q = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) { q[i] = inv[i] * nx + inv[4 + i] * ny + inv[8 + i] + inv[12 + i]; }
    var d = [q[0] / q[3] - eye[0], q[1] / q[3] - eye[1], q[2] / q[3] - eye[2]], L = hypot(d[0], d[1], d[2]);
    return [d[0] / L, d[1] / L, d[2] / L];
  }
  function act(px, py, forcePlace) {
    if (intro || launched || !vp) { return; }
    var dir = dirAt(px, py), hit = pick(dir);
    if (!hit) { return; }
    // A block kept for the next swing is turned to at this one's strike, not now.
    var kept = !Hd && !!swing && !swing.ret && swing.u < 1.5 && !hit.painting && hit.b !== B.NOTE && !(forcePlace || mode === "place");
    if (!Hd && !kept) { var hx = hit.painting ? hit.painting.cx : hit.x + 0.5, hz = hit.painting ? hit.painting.cz : hit.z + 0.5; P.want = Math.atan2(hx - P.x, -(hz - P.z)); }
    if (hit.painting) { showLabel(hit.painting); return; }
    if (hit.r > REACH) { return; }
    if (hit.b === B.NOTE) { readNote(hit.x, hit.y, hit.z); return; }
    if (Hd) { barred(); return; }
    if (!(forcePlace || mode === "place")) {
      if (hit.b === B.BEDROCK) { return; }
      if (hangsOn(hit.x, hit.y, hit.z)) { say("A work hangs on this wall."); return; }
      // He smashes it with his guitar: it breaks at the strike, a beat from now (the smash, above).
      smash(hit, dir);
    } else if (hit.prev) {
      var p = hit.prev;
      w.set(p[0], p[1], p[2], HOTBAR[slot]);
      if (boxHits(P.x, P.y, P.z)) { w.set(p[0], p[1], p[2], B.AIR); return; }
      remeshAt(p[0], p[2]);
    }
  }

  /* ---- the two views: third person over his head, the hologram ----------------------------------------- */

  var R_C = 0.1, holoLeft = HOLO_T;
  /* The lengths that follow from his measures (PEARL): set now from the defaults, and again when his body's file
     has come, so a new form brings its own distances. */
  var TP_D, TP_UP, TP_DOWN, TP_HEAD, TURN, T_VIEW, LIFT, HAT_REACH, STEP_T;
  function measure() {
    TP_D = thirdDistance();                        // his whole figure a third of the screen's height, at REST
    TP_UP = AIM - Math.asin(PEARL.top / 2 / TP_D); // the camera never sinks below the top of his hat
    TP_DOWN = AIM - Math.PI / 2 + 0.01;            // and comes at most straight over him
    TP_HEAD = Math.hypot(TP_D * Math.cos(REST - AIM), PEARL.top / 2 - TP_D * Math.sin(REST - AIM) - PEARL.headY);   // the camera to his head, at REST
    TURN = Math.PI * WALK / PEARL.top;             // he turns half round in the time he walks his own height
    T_VIEW = PEARL.top / WALK;                     // a switch of view: the time he walks his own height
    LIFT = 2 * PEARL.headR;                        // the head lifts its own diameter off its seat
    HAT_REACH = PEARL.hatReach;                    // the farthest of his hat from his head's centre
    STEP_T = PEARL.leg / WALK;                     // he sets out or stops in the time he walks one step (a leg long)
  }
  function smooth(s) { s = max(0, min(1, s)); return s * s * (3 - 2 * s); }
  function clampV(v, a, b) { return max(a, min(b, v)); }
  function angle(a) { return Math.atan2(Math.sin(a), Math.cos(a)); }
  // The distance at which his whole figure, feet to hat top, is a third of the screen's height when the camera
  // looks down at REST with his middle AIM below the centre: solved, since the picture is not linear in height.
  function thirdDistance() {
    var M = PEARL.top / 2, span = function (D) {
      var a = REST - AIM, cx = -D * Math.cos(a), cy = M - D * Math.sin(a);
      var ndc = function (h) { var dy = h - cy, f = -cx * Math.cos(REST) + dy * Math.sin(REST), u = cx * Math.sin(REST) + dy * Math.cos(REST); return u / f / T35; };
      return ndc(PEARL.top) - ndc(0);
    };
    var lo = 0.5, hi = 20;
    for (var i = 0; i < 60; i += 1) { var D = (lo + hi) / 2; if (span(D) > 2 / 3) { lo = D; } else { hi = D; } }
    return (lo + hi) / 2;
  }
  // How far the look may go up and down: in third person the camera never sinks below his hat (it stays above his
  // head) and comes at most straight over him; from his own eyes (a stone, where you woke: the third figure is looked
  // up at) and as the hologram, to nearly straight up and down.
  function clampPitch(p) { return !Hd && !onStone ? clampV(p, TP_DOWN, TP_UP) : clampV(p, -1.5, 1.5); }
  // Where his head sits on the body (the hologram's seat).
  function seat() { return [P.x, P.y + PEARL.headY, P.z]; }
  function isOpen(b) { return b === B.AIR || b === B.WATER; }
  // Whether the cube of half-side r round a point (the camera's near plane fits in it) is in a block.
  function boxSolid(x, y, z, r) {
    for (var i = 0; i < 8; i += 1) {
      if (!isOpen(w.get(floor(x + (i & 1 ? r : -r)), floor(y + (i & 2 ? r : -r)), floor(z + (i & 4 ? r : -r))))) { return true; }
    }
    return false;
  }
  // How far the camera may stand from o along u (at most L) with its near plane clear of every block: the ray
  // through the grid, stopped the near plane's reach short of the first block, then drawn in until clear.
  function clearTo(o, u, L) {
    var hit = cast(u, L + R_C, o), D = min(L, hit ? max(0, hit.t - R_C) : L);
    while (D > 0 && boxSolid(o[0] + u[0] * D, o[1] + u[1] * D, o[2] + u[2] * D, R_C)) { D = max(0, D - R_C); }
    return D;
  }
  function firstCam(h) { return { e: [P.x, P.y + h, P.z], yaw: P.yaw, pitch: P.pitch }; }
  // Third person: his middle held AIM below the screen's centre, TP_D away along the look; the camera on the line
  // from his head to there, pulled in at once when blocks stand between, let out no faster than he walks.
  function thirdCam(dt) {
    var hd = seat(), d = lookDir(P.yaw, P.pitch - AIM);
    var full = [P.x - TP_D * d[0], P.y + PEARL.top / 2 - TP_D * d[1], P.z - TP_D * d[2]];
    var v = [full[0] - hd[0], full[1] - hd[1], full[2] - hd[2]], L = hypot(v[0], v[1], v[2]), u = [v[0] / L, v[1] / L, v[2] / L];
    camD = min(clearTo(hd, u, L), camD + WALK * dt);
    return { e: [hd[0] + u[0] * camD, hd[1] + u[1] * camD, hd[2] + u[2] * camD], yaw: P.yaw, pitch: P.pitch, from: hd };
  }
  // The hologram: the camera HOLO_D behind the head along the look, the head AIM below the centre; kept out of
  // the blocks behind it while the head is in the open (in a block the hologram, and its camera, see through).
  function holoCam(dt) {
    var c = [Hd.x, Hd.y, Hd.z], d = lookDir(P.yaw, P.pitch - AIM), u = [-d[0], -d[1], -d[2]];
    var D = isOpen(w.get(floor(c[0]), floor(c[1]), floor(c[2]))) ? clearTo(c, u, HOLO_D) : HOLO_D;
    camD = min(D, camD + HOLO_V * dt);
    return { e: [c[0] + u[0] * camD, max(1 + R_C, c[1] + u[1] * camD), c[2] + u[2] * camD], yaw: P.yaw, pitch: P.pitch, from: c };
  }
  // The camera of the frame, and whether he (body, head) is drawn: in the films (the wake-up, the launch), on a stone
  // of the homage and back where you woke you are behind his eyes and see nothing of him; else he is drawn once the
  // camera is clear of his hat (HAT_REACH from the head's centre, plus the near plane's reach).
  function camera(now, dt, eyeH, aspect) {
    R_C = NEAR * Math.sqrt(1 + T35 * T35 * (1 + aspect * aspect));
    // On a stone of the homage the view is his own eyes, as the stone is the one point its figure closes from
    // (from over his head he would stand in front of it); so too back where you woke, the one point the figure in
    // the sky closes from (treeSpot); stepping off, it rises out over his head again.
    var stone = !!(!Hd && !intro && !launched && ((homage && Homage.standing(homage, P.x, P.y, P.z)) || treeSpot()));
    if (stone !== onStone) {
      onStone = stone;
      if (!Hd) { blend = { from: camLast, t0: now, dur: T_VIEW, pitchFrom: P.pitch, pitchTo: stone ? null : clampV(P.pitch, TP_DOWN, TP_UP) }; camD = 1e9; }
    }
    var c = intro || launched ? firstCam(eyeH) : Hd ? holoCam(dt) : onStone ? firstCam(EYE) : thirdCam(dt);
    if (blend && !intro) {
      var s = smooth((now - blend.t0) / 1000 / blend.dur), f = blend.from, a = c.from || c.e;
      if (blend.pitchTo != null) { P.pitch = blend.pitchFrom + (blend.pitchTo - blend.pitchFrom) * s; c.pitch = P.pitch; }
      c = { e: [0, 1, 2].map(function (k) { return f.e[k] + (c.e[k] - f.e[k]) * s; }), yaw: f.yaw + angle(c.yaw - f.yaw) * s, pitch: f.pitch + (c.pitch - f.pitch) * s };
      // On the way the camera keeps out of the blocks as the view's own does: drawn in toward what it follows.
      if (boxSolid(c.e[0], c.e[1], c.e[2], R_C)) {
        var bv = [c.e[0] - a[0], c.e[1] - a[1], c.e[2] - a[2]], bl = hypot(bv[0], bv[1], bv[2]);
        if (bl > 1e-6) { var bd = clearTo(a, [bv[0] / bl, bv[1] / bl, bv[2] / bl], bl); c.e = [a[0] + bv[0] / bl * bd, a[1] + bv[1] / bl * bd, a[2] + bv[2] / bl * bd]; }
      }
      if (s >= 1) { blend = null; }
    }
    var hc = Hd ? [Hd.x, Hd.y, Hd.z] : seat(), far = hypot(c.e[0] - hc[0], c.e[1] - hc[1], c.e[2] - hc[2]) > HAT_REACH + R_C;
    var bc = seat(), farB = hypot(c.e[0] - bc[0], c.e[1] - bc[1], c.e[2] - bc[2]) > HAT_REACH + R_C;
    drawMe = { body: !intro && !launched && (Hd ? true : !onStone || !!blend) && farB, head: !intro && !launched && (Hd ? true : !onStone || !!blend) && far };
    camLast = c;
    return c;
  }
  // Third person: the camera comes round behind him as he walks, in the time he walks its distance from his head,
  // by the forward part of the stick (walking sideways or back to the camera does not swing it), not while you drag.
  function follow(dt, c, face) {
    if (Hd || input.looking || c.fwd <= 0 || !(c.fwd || c.side)) { return; }
    P.yaw += angle(face - P.yaw) * (1 - Math.exp(-dt * c.fwd * WALK / TP_HEAD));
  }

  /* ---- the hologram and back; its flight; the body following it, harmed ----------------------------------- */

  // One button (and H) between the hologram and third person (artist, 21 Oct 2026: "Get rid of first person view as
  // an option, just have one button that toggles between holographic view and third person view"): the head goes
  // out; out, the body follows it, and the view is third person again.
  function toggleHolo() {
    if (intro || launched || !place) { return; }
    if (Hd) { bringBody(); } else { enterHolo(); }
  }
  function enterHolo() {
    if (Hd || flying) { return; }
    if (holoLeft < BAR) { say("The hologram is gathering again: " + Math.ceil(BAR - holoLeft) + " s."); return; }
    letGo();   // the head leaving, the swing strikes nothing (as the hologram nothing is broken)
    var s = seat(), now = performance.now();
    Hd = { x: s[0], y: s[1], z: s[2], y0: s[1], vx: 0, vy: 0, vz: 0, yaw: P.face, phase: "lift", t0: now, left: now, warned: false };
    pov = "holo"; camD = 1e9;
    blend = { from: camLast, t0: now, dur: T_LIFT, pitchFrom: P.pitch, pitchTo: null };
    document.body.dataset.holo = "true";
    drawViews();
    say("Your head leaves the body: fly it anywhere, and when you leave the hologram your body follows it. Till then it stays here, open to harm.", true);
  }
  // Home: the head settles onto the body come under it (or, still lifting, back onto its seat), in the time of a
  // switch of view. Nothing flies the head back to where the body was: the body follows the head.
  function goHome(why, dur) {
    if (!Hd || Hd.phase === "home") { return; }
    Hd.phase = "home"; Hd.t0 = performance.now(); Hd.from = [Hd.x, Hd.y, Hd.z]; Hd.dur = dur || T_VIEW; Hd.why = why;
  }
  function seatHead() {
    var now = performance.now();
    Hd = null; pov = "third"; camD = 1e9;
    blend = { from: camLast, t0: now, dur: T_VIEW, pitchFrom: P.pitch, pitchTo: clampV(P.pitch, TP_DOWN, TP_UP) };
    delete document.body.dataset.holo;
    drawViews();
  }
  function holo(dt, now, c) {
    if (Hd.phase === "lift") {
      // The head rises off its seat as a jump rises (slowing to its top), its own diameter in a jump's rise.
      var s = min(1, (now - Hd.t0) / 1000 / T_LIFT), st = seat();
      Hd.x = st[0]; Hd.z = st[2]; Hd.y = st[1] + LIFT * (1 - (1 - s) * (1 - s));
      if (s >= 1) { Hd.phase = "free"; }
      return;
    }
    if (Hd.phase === "follow") {
      // The body on its way to the head (bringBody): straight, through anything as the hologram goes, eased over the
      // bar, standing (he falls out of his stride as he stops walking), the place's physics not on it (frame). The
      // head holds where it is, turned to where you look; you may look round, not move, and the time stands.
      var fl = Hd.flight, e = smooth((now - fl.t0) / 1000 / BAR);
      P.x = fl.from[0] + (fl.to[0] - fl.from[0]) * e; P.y = fl.from[1] + (fl.to[1] - fl.from[1]) * e; P.z = fl.from[2] + (fl.to[2] - fl.from[2]) * e;
      P.vx = P.vy = P.vz = 0; P.ground = false;
      P.amount -= P.amount * (1 - Math.exp(-dt / STEP_T));
      Hd.yaw = turnTo(Hd.yaw, P.yaw, TURN * dt);
      // Come: it stops (in the air it falls, unhurt), and the head settles onto it.
      if (e >= 1) { goHome("bring"); }
      return;
    }
    if (Hd.phase === "home") {
      var u = smooth((now - Hd.t0) / 1000 / Hd.dur), to = seat();
      Hd.x = Hd.from[0] + (to[0] - Hd.from[0]) * u; Hd.y = Hd.from[1] + (to[1] - Hd.from[1]) * u; Hd.z = Hd.from[2] + (to[2] - Hd.from[2]) * u;
      Hd.yaw = turnTo(Hd.yaw, P.face, TURN * dt);
      if (u >= 1) { seatHead(); }
      return;
    }
    holoLeft = max(0, holoLeft - dt);
    if (holoLeft <= HOLO_T / 10 && !Hd.warned) { Hd.warned = true; say(round(holoLeft) + " seconds left as the hologram; then your body follows your head."); }
    if (holoLeft <= 0) { bringBody("time"); return; }
    // Free in three dimensions: forward along the look (up and down with it), sideways, the jump to rise and
    // Shift or C to sink; through blocks, but not out of the place, below its floor, or over its ceiling.
    var f = lookDir(P.yaw, P.pitch), r = [Math.cos(P.yaw), 0, Math.sin(P.yaw)], V = inRoom(Hd.x, Hd.y - PEARL.headY, Hd.z) ? HOLO_V_IN : HOLO_V;
    var want = [f[0] * c.fwd + r[0] * c.side, f[1] * c.fwd + c.up, f[2] * c.fwd + r[2] * c.side], L = hypot(want[0], want[1], want[2]);
    if (L > 1) { want = want.map(function (q) { return q / L; }); }
    var k = 1 - Math.exp(-dt / T_LIFT), hr = PEARL.headR;
    Hd.vx += (want[0] * V - Hd.vx) * k; Hd.vy += (want[1] * V - Hd.vy) * k; Hd.vz += (want[2] * V - Hd.vz) * k;
    Hd.x = clampV(Hd.x + Hd.vx * dt, hr, w.SX - hr); Hd.y = clampV(Hd.y + Hd.vy * dt, 1 + hr, holoTop); Hd.z = clampV(Hd.z + Hd.vz * dt, hr, w.SZ - hr);
    Hd.yaw = turnTo(Hd.yaw, P.yaw, TURN * dt);
  }
  // "Choose to move Mr Pearl's body exactly there", and every way out of the hologram is that choice (artist,
  // 21 Oct 2026: "Wherever you move in the holographic view should be where you land when you switch back to any
  // other view"), the body going to the head (the artist, the same day: "The body follows the head, not the other
  // way around"): Holo again, H, the time up. Where it goes is fixed as it sets out: under the head, or, if he does
  // not fit there, the nearest place he fits. It flies there from where it stands in one bar of the theme song, the
  // time the head took to fly home before, the same motion with the roles turned round, facing the way the head
  // faces as it sets out (holo, "follow"); come, it stops and the head settles onto it, and in the air it falls,
  // unhurt (there is no fall damage). A head still lifting has not moved: it settles back where it rose from. A
  // second press while the body is on its way does nothing.
  function bringBody(why) {
    if (!Hd || Hd.phase === "home" || Hd.phase === "follow") { return; }
    if (Hd.phase === "lift") { goHome("bring"); return; }
    var at = freeSpot(Hd.x, Hd.y - PEARL.headY, Hd.z), exact = at[0] === Hd.x && at[1] === Hd.y - PEARL.headY && at[2] === Hd.z;
    Hd.phase = "follow"; Hd.vx = Hd.vy = Hd.vz = 0;
    Hd.flight = { from: [P.x, P.y, P.z], to: at, t0: performance.now(), exact: exact };
    P.vx = P.vy = P.vz = 0; P.ground = false; P.face = Hd.yaw; P.want = null;
    say((why === "time" ? "The time is up: your body follows your head" : "Your body follows your head") + (exact ? "." : ", to the nearest place it fits."), true);
  }
  function freeSpot(x, y, z) {
    x = clampV(x, 0.5, w.SX - 0.5); z = clampV(z, 0.5, w.SZ - 0.5); y = max(1, y);
    if (!boxHits(x, y, z)) { return [x, y, z]; }
    // The nearest point he fits, on half-block steps out to his reach; failing that, straight up.
    var S = 0.5, N = REACH / S, best = null, bd = 1e9;
    for (var j = -N; j <= N; j += 1) {
      for (var k = -N; k <= N; k += 1) {
        for (var i = -N; i <= N; i += 1) {
          var d = hypot(i, j, k) * S, X = x + i * S, Y = y + j * S, Z = z + k * S;
          if (d >= bd || d > REACH || Y < 1 || X < 0.5 || Z < 0.5 || X > w.SX - 0.5 || Z > w.SZ - 0.5) { continue; }
          if (!boxHits(X, Y, Z)) { bd = d; best = [X, Y, Z]; }
        }
      }
    }
    if (best) { return best; }
    for (var yy = floor(y) + 1; yy < w.SY; yy += 1) { if (!boxHits(x, yy, z)) { return [x, yy, z]; } }
    return [x, w.SY, z];
  }
  // The body left behind is "completely vulnerable to getting destroyed": the hook. Nothing calls it yet (the
  // giants, the craters where they fall, later); whatever harms him calls harmBody(cause), which counts only
  // while the head is out. The rule to come: the body destroyed, the head is pulled home and he comes to under
  // his tree (lieDown), keeping what he found, as when the guards put him out.
  var bodyHarm = [];
  function harmBody(cause) {
    if (!Hd) { return false; }
    bodyHarm.push({ cause: cause || "", at: performance.now(), x: P.x, y: P.y, z: P.z });
    if (CFG.onHarm) { CFG.onHarm(cause, bodyHarm.length); }
    return true;
  }
  function barred() { say("As the hologram you can look and read. To take, build or break, leave the hologram (Holo, or H): your body follows your head."); }

  /* ---- the view's control -------------------------------------------------------------------------------- */

  // The one button, pressed while the head is out.
  function drawViews() {
    $("v-holo").setAttribute("aria-pressed", String(!!Hd));
    $("jump").setAttribute("aria-label", Hd ? "Rise" : "Jump");
  }
  // Each frame: the ring round Holo, the time left, filling again in the body at the rate it was spent.
  var holoSaid = -1;
  function holoHud() {
    var b = $("v-holo"), left = holoLeft / HOLO_T;
    b.style.setProperty("--left", left.toFixed(3));
    if (left < 1) { document.body.dataset.ring = "true"; } else { delete document.body.dataset.ring; }
    var secs = Math.ceil(holoLeft), label = "Holographic, " + (secs >= 60 ? floor(secs / 60) + " min " : "") + (secs % 60) + " s";
    if (abs(secs - holoSaid) >= 10 || (secs < holoSaid && secs % 10 === 0)) { holoSaid = secs; b.setAttribute("aria-label", label + " left"); }
  }

  /* ---- the smash: he breaks a block with his guitar --------------------------------------------------------------
     The artist, 21 Oct 2026: "He should be using his guitar to smash things when using the break function". His
     hands hold the guitar, so both arms and it turn as one about the line through his shoulder centres (pose()'s
     act.arms), and the upper body turns about the spine, as the walk turns it, made large (act.twist). A tap to
     break starts a swing whose strike is a beat later (a beat of the theme song, 125 a minute):
       the coil, half a beat: a quarter turn to his right, the guitar raised as high as his head lets it;
       the downswing, half a beat: from rest at the top at an even pull, so that at the strike his shoulders turn
         at one turn a beat (a quarter turn in half a beat, from rest);
       the strike: the guitar's far end (the tail of its lower bout) comes onto the line from his feet to the block,
         at the block's height seen from his shoulders, as near as his arms go; the block breaks, its six bars fly;
       the follow-through, half a beat: the downswing mirrored, up to the top on his left;
       back to rest, half a beat.
     A tap during a swing is kept (the latest only) and struck a beat after this one's strike, swung back from the
     top on his left: one block a beat. In water the swing goes at his speed there over his walk. Within REACH the
     blow breaks the block wherever it stands; a block a step ahead at his waist or his head the guitar meets. */
  var BEAT = BAR / 4;            // a beat of the theme song: the strike falls a beat after the tap
  var COIL = Math.PI / 2;        // the coil: a quarter turn of the upper body (see above: one turn a beat at the strike)
  // From his form when it has come (smashFrom): the guitar's far end (its cell farthest from the shoulder line, in
  // the guitar's own cells), how far below level it hangs from that line (E0), the line's height over his feet at
  // his centre line (Y_SH), and the arms' highest (ARMS_UP). Until then, the values pearl-body.json gives.
  var FAR_END = null, E0 = 1.15486, Y_SH = 1.00155, ARMS_UP = 1.36101;
  var swing = null, swingNext = null, shards = [], shardProg = null, SHU = {};
  function smashFrom(body) {
    var PB = window.PearlBody, J = body.joints, sR = J.shoulder_right.at, sL = J.shoulder_left.at;
    var ax = norm([sR[0] - sL[0], sR[1] - sL[1], sR[2] - sL[2]]), half = body.cell * Math.sqrt(3) / 2;
    var part = function (n) { return body.parts.filter(function (p) { return p.name === n && !p.empty; })[0]; };
    var g = part("guitar"), M0 = PB.pose(body, 0, 0), best = -1;
    // the far end, and how far below level it hangs: its offset square to the shoulder line, seen along that line
    g.blocks.forEach(function (b) {
      var c = [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5], p = apply(M0.guitar, c), d = [p[0] - sR[0], p[1] - sR[1], p[2] - sR[2]];
      var k = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2], q = [d[0] - k * ax[0], d[1] - k * ax[1], d[2] - k * ax[2]], r = hypot(q[0], q[1], q[2]);
      if (r > best) { best = r; FAR_END = c; var up = norm([-ax[1] * ax[0], 1 - ax[1] * ax[1], -ax[1] * ax[2]]); E0 = -Math.atan2(q[0] * up[0] + q[1] * up[1] + q[2] * up[2], -q[2]); }
    });
    Y_SH = sR[1] - sR[0] / ax[0] * ax[1];
    // the arms' highest: no cell of the arms or the guitar into his head's sphere (a cell's farthest corner at most on
    // it), the first touch found in half degrees, then halved to a ten-thousandth of a radian
    var cells = [part("arm_right"), part("arm_left"), g], hc = body.head.centre, r0 = body.head.radius + half;
    var clear = function (a) {
      var M = PB.pose(body, 0, 0, { arms: a });
      return cells.every(function (p) { return p.blocks.every(function (b) { var q = apply(M[p.name], [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5]); return hypot(q[0] - hc[0], q[1] - hc[1], q[2] - hc[2]) >= r0; }); });
    };
    var lo = 0, hi;
    while (lo < Math.PI && clear(lo + Math.PI / 360)) { lo += Math.PI / 360; }
    hi = lo + Math.PI / 360;
    while (hi - lo > 1e-4) { var m = (lo + hi) / 2; if (clear(m)) { lo = m; } else { hi = m; } }
    ARMS_UP = lo;
  }
  function lerp2(a, b, q) { return [a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q]; }
  // Where the arms strike: the far end at the height of the block's centre seen from the shoulder line, as near as
  // they go (no lower than they hang, no higher than his head lets them).
  function aimArms(s) {
    var dx = s.x + 0.5 - P.x, dz = s.z + 0.5 - P.z, dy = s.y + 0.5 - (P.y + Y_SH);
    return clampV(E0 + Math.atan2(dy, hypot(dx, dz)), 0, ARMS_UP);
  }
  // The upper body's turn at the strike, which brings the far end onto the line from his feet to the block (its x in
  // his frame nought): turned by t about the spine (at sx), (px - sx) cos t - pz sin t = -sx; the root nearest nought.
  // (body: his built body; pearlFrom passes it before me3 is set.)
  function aimTwist(arms, body) {
    body = body || me3.body;
    var M = window.PearlBody.pose(body, 0, 0, { arms: arms }), p = apply(M.guitar, FAR_END), s = body.joints.spine.at;
    var dx = p[0] - s[0], dz = p[2] - s[2];
    return Math.atan2(-dz, dx) - Math.acos(clampV(-s[0] / hypot(dx, dz), -1, 1));
  }
  // The swing's pose at u beats, for pose(): { arms, twist } in radians; null at rest.
  function swingPose(s) {
    s = s || swing;
    if (!s) { return null; }
    var u = s.u, a;
    if (s.ret) { a = lerp2(s.from, [0, 0], smooth((u - 1.5) / 0.5)); }
    else {
      var top = s.top || [ARMS_UP, s.hit[1] + s.side * COIL], other = [ARMS_UP, s.hit[1] - s.side * COIL], q;
      if (u < 0.5) { a = lerp2(s.from, top, smooth(u / 0.5)); }
      else if (u < 1) { q = (u - 0.5) / 0.5; a = lerp2(top, s.hit, q * q); }
      else if (u < 1.5) { q = (u - 1) / 0.5; a = lerp2(s.hit, other, q * (2 - q)); }
      else { a = lerp2(other, [0, 0], smooth((u - 1.5) / 0.5)); }
    }
    return u >= 2 ? null : { arms: a[0], twist: a[1] };
  }
  // A tap to break: a swing whose strike is a beat away; during a swing (before its follow-through ends) it is kept,
  // the latest only, for a beat after this one's strike; a second tap on what is already to be struck does nothing.
  function smash(hit, dir) {
    var n = hit.prev ? [hit.prev[0] - hit.x, hit.prev[1] - hit.y, hit.prev[2] - hit.z] : [0, 0, 0];
    if (!hit.prev) { var k = abs(dir[0]) > abs(dir[1]) ? (abs(dir[0]) > abs(dir[2]) ? 0 : 2) : (abs(dir[1]) > abs(dir[2]) ? 1 : 2); n[k] = dir[k] > 0 ? -1 : 1; }
    var t = { x: hit.x, y: hit.y, z: hit.z, b: hit.b, n: n, hp: [eye[0] + dir[0] * hit.t, eye[1] + dir[1] * hit.t, eye[2] + dir[2] * hit.t],
              yaw: Math.atan2(hit.x + 0.5 - P.x, -(hit.z + 0.5 - P.z)) };
    if (!me3 || !FAR_END) { strike(t, true); return; }   // his body has not come: nothing to swing; it breaks at once, as before
    var same = function (a) { return !!a && a.x === t.x && a.y === t.y && a.z === t.z; };
    if (swing && !swing.ret && swing.u < 1.5) { if (!(same(swing) && !swing.struck) && !same(swingNext)) { swingNext = t; } return; }
    var now = swingPose() || { arms: 0, twist: 0 };
    t.u = 0; t.from = [now.arms, now.twist]; t.side = now.twist < -1e-3 ? -1 : 1;
    begin(t);
  }
  function begin(t) {
    t.struck = false; t.hit = [0, 0]; t.hit[0] = aimArms(t); t.hit[1] = aimTwist(t.hit[0]);
    swing = t;
  }
  // The one kept: its downswing begins at this one's top on the other side, so it strikes a beat after this one; and
  // standing, he goes on facing it after (what he reaches for, as a tap would have set).
  function chain() {
    var s = swing, t = swingNext;
    swingNext = null;
    t.u = s.u - 1; t.side = -s.side; t.top = [ARMS_UP, s.hit[1] - s.side * COIL]; t.from = t.top;
    P.want = t.yaw;
    begin(t);
  }
  // The swing let go (the head leaves, he is put out): nothing struck, nothing kept; the arms to rest in half a beat.
  function letGo() {
    var p = swingPose();
    swingNext = null;
    swing = p ? { ret: true, u: 1.5, from: [p.arms, p.twist] } : null;
  }
  // What he turns to while a swing is on: what it will strike, until it has; then what is kept for the next.
  function swingYaw() {
    if (!swing || swing.ret) { return null; }
    return swing.struck ? (swingNext ? swingNext.yaw : null) : swing.yaw;
  }
  // Each frame: the swing's clock (in beats; in water at SWIM / WALK, as his legs go there), the aim kept on the block
  // as he moves, the strike, the next kept one or the end.
  function swingStep(dt) {
    if (!swing) { return; }
    var s = swing;
    s.u = s.hold != null ? s.hold : s.u + dt / BEAT * (P.wet ? SWIM / WALK : 1);
    if (!s.ret && !s.struck) {
      s.hit[0] = aimArms(s); s.hit[1] = aimTwist(s.hit[0]);
      if (s.u >= 1) { strike(s); }
    }
    if (!s.ret && s.u >= 1.5 && swingNext) { chain(); }
    else if (s.u >= 2) { swing = null; }
  }
  // The far end in the world at u beats of the swing (his feet where they are now, facing as he faces).
  function farEndAt(s, u) {
    var PB = window.PearlBody, u0 = s.u;
    s.u = u; var a = swingPose(s); s.u = u0;
    var M = PB.pose(me3.body, PB.phaseStep(me3.body, 0, P.walked), P.amount, a);
    return apply(PB.place(M.guitar, P.x, P.y, P.z, P.face), FAR_END);
  }
  // The strike: what was tapped, if it is still there and still within his reach, breaks (a piece is found, not
  // smashed); else the swing was only a swing.
  function strike(s, plain) {
    s.struck = true;
    var b = w.get(s.x, s.y, s.z), at = reachFrom();
    if (Hd || b !== s.b || hypot(s.hp[0] - at[0], s.hp[1] - at[1], s.hp[2] - at[2]) > REACH) { return; }
    var k = PIECE_IDS.indexOf(b);
    w.set(s.x, s.y, s.z, B.AIR);
    if (k >= 0) { collect(k); } else if (!plain) { burst(s, b); }
    remeshAt(s.x, s.z);
    s.broke = true;
  }
  /* The block's six bars, as the figure has them, fly out of the face he struck, each the way it lies from the block's
     middle, at half the guitar's speed at the strike (the throw's bounce, e = 1/2: the mean of a perfect bounce and a
     dead stop), turning at half a turn a beat (half his shoulders' turn at the strike); they fall as anything falls
     here (in water as he sinks), lie where they land on a block's top, and are gone a beat after the strike, when the
     swing that broke them is over (one flying into a block's side is gone at once). */
  function burst(s, b) {
    var e = 1 / 64, p1 = farEndAt(s, 1), p0 = farEndAt(s, 1 - e), dt = e * BEAT / (P.wet ? SWIM / WALK : 1);
    var v = hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) / dt / 2, n = s.n;
    var tn = tonesOf(w.pal[b] || [200, 200, 200]), tones = new Float32Array(9);
    for (var i = 0; i < 3; i += 1) { for (var j = 0; j < 3; j += 1) { tones[i * 3 + j] = tn[i][j] / 255; } }
    s.speed = v * 2;
    FIGURE.forEach(function (f) {
      var c = [s.x + (f[0] + f[3]) / 2, s.y + (f[1] + f[4]) / 2, s.z + (f[2] + f[5]) / 2];
      var d = [c[0] - s.x - 0.5, c[1] - s.y - 0.5, c[2] - s.z - 0.5], dir = norm([n[0] + d[0], n[1] + d[1], n[2] + d[2]]);
      var a = [n[1] * d[2] - n[2] * d[1], n[2] * d[0] - n[0] * d[2], n[0] * d[1] - n[1] * d[0]];
      if (hypot(a[0], a[1], a[2]) < 1e-6) { a = abs(n[1]) < 0.5 ? [n[2], 0, -n[0]] : [1, 0, 0]; }
      shards.push({ c: c, size: [f[3] - f[0], f[4] - f[1], f[5] - f[2]], v: [dir[0] * v, dir[1] * v, dir[2] * v], ax: a, turn: 0, t: 0, tones: tones });
    });
  }
  function shardsStep(dt) {
    if (!shards.length) { return; }
    shards = shards.filter(function (q) {
      q.t += dt;
      if (q.t >= BEAT) { return false; }
      if (q.lies) { return true; }
      var wet = w.get(floor(q.c[0]), floor(q.c[1]), floor(q.c[2])) === B.WATER;
      q.v[1] = wet ? max(-2.5, q.v[1] - 6 * dt) : q.v[1] - 25 * dt;
      var c = [q.c[0] + q.v[0] * dt, q.c[1] + q.v[1] * dt, q.c[2] + q.v[2] * dt];
      if (w.SOLID[w.get(floor(c[0]), floor(c[1]), floor(c[2]))]) {
        // into a block: from above it lands and lies on its top (its least half-thickness over it); else it is gone
        if (q.v[1] >= 0 || w.SOLID[w.get(floor(c[0]), floor(c[1]) + 1, floor(c[2]))] || floor(c[1]) >= floor(q.c[1])) { return false; }
        q.c = [c[0], floor(c[1]) + 1 + min(q.size[0], q.size[1], q.size[2]) / 2, c[2]]; q.lies = true;
        return true;
      }
      q.c = c;
      q.turn += Math.PI / BEAT * dt;
      return true;
    });
  }
  // A bar: a box drawn from its corners by gl_VertexID (no buffers, as his head's box is), each face in the block's
  // tone for the way it looks by the bar's own axes (up white, east-west grey, north-south black), in the haze.
  var SHARD_VS = "#version 300 es\nuniform mat4 uVP; uniform mat4 uM;\nflat out int vA; flat out int vS; out vec3 vP;\n" +
    "const int IDX[36] = int[36](0,2,1, 1,2,3, 4,5,6, 5,7,6, 0,1,4, 1,5,4, 2,6,3, 3,6,7, 0,4,2, 2,4,6, 1,3,5, 3,7,5);\n" +
    "void main() { int k = IDX[gl_VertexID], f = gl_VertexID / 6; vec3 c = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1)) - 0.5;\n" +
    "  vA = 2 - f / 2; vS = f - 2 * (f / 2); vec4 p = uM * vec4(c, 1.0); vP = p.xyz; gl_Position = uVP * p; }";
  var SHARD_FS = "#version 300 es\nprecision highp float;\nflat in int vA; flat in int vS; in vec3 vP; out vec4 o;\n" +
    "uniform vec3 uT[3]; uniform vec3 uEye; uniform vec3 uHaze;\n" +
    "void main() { vec3 c = vA == 1 ? uT[0] * (vS == 1 ? 1.0 : 0.8) : vA == 0 ? uT[1] : uT[2];\n" +
    "  o = vec4(mix(c, uHaze, clamp(1.0 - exp(-length(vP - uEye) * 0.006), 0.0, 1.0)), 1.0); }";
  function drawShards() {
    if (!shards.length || !shardProg) { return; }
    var PB = window.PearlBody;
    gl.useProgram(shardProg);
    gl.uniformMatrix4fv(SHU.uVP, false, vp); gl.uniform3fv(SHU.uEye, eye); gl.uniform3fv(SHU.uHaze, HAZE);
    gl.bindVertexArray(null);
    shards.forEach(function (q) {
      var S = [q.size[0], 0, 0, 0, 0, q.size[1], 0, 0, 0, 0, q.size[2], 0, 0, 0, 0, 1];
      gl.uniformMatrix4fv(SHU.uM, false, PB.mul(PB.T(q.c[0], q.c[1], q.c[2]), PB.mul(PB.RA(q.ax, q.turn), S)));
      gl.uniform3fv(SHU.uT, q.tones);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    });
  }

  /* ---- Mr Pearl drawn: his body of the unit through the blocks' own shader, his head the true sphere ------ */

  /* His body is the game's own figure seven golden steps down (pearl.js, from pearl-body.json): ten small grids,
     one to each part that moves (the pelvis, the torso, the arms, the guitar, the hat, the thighs, the shins), each
     walked by FS exactly as the place's grid is, under a model transform (uM: the part's cells to the world, turned
     and scaled to the unit; uInvM takes the ray back into the cells). The pixel's width is divided by the unit, so
     his facades open and close at the sizes on the screen the world's do. His head is not built: its own program
     solves a ray per pixel against the sphere, so it is exactly round at any distance. */
  var me3 = null, headProg = null, HU = {}, worldPal = null, ID4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  var pxW = 0;             // a pixel's width at a block's distance, as frame sets it for the place (the fade's uPx)
  var HEAD_EXPO = 1.047;   // the head's median brightness on the screen, from the third-person camera, the covers' (#b9aca9)
  function initPearl() {
    var PB = window.PearlBody;
    if (!PB) { return; }
    headProg = compile(PB.HEAD_VS, PB.HEAD_FS);
    ["uVP", "uEye", "uC", "uSun", "uHaze", "uR", "uExpo", "uHolo", "uHead", "uV", "uRig"].forEach(function (n) { HU[n] = gl.getUniformLocation(headProg, n); });
  }
  // His body from its file: the parts' grids to the card, his palette, and his measures into every distance.
  function pearlFrom(spec) {
    var PB = window.PearlBody;
    if (!PB || !spec || !gl) { return; }
    var t0 = performance.now(), body = PB.build(spec, { skip: [B.WATER, B.NOTE] }), pal = new Float32Array(64 * 4);
    body.palette.forEach(function (c, i) { pal.set(c, i * 4); });
    smashFrom(body);
    var parts = body.parts.filter(function (p) { return !p.empty; }).map(function (p) {
      var ch = meshBlocks(p.blocks);
      ch.tex = voxTexture(p.ids, p.dim[0], p.dim[1], p.dim[2]); ch.p = p;
      return ch;
    });
    // How far any of him reaches from the line up through his feet, and how high, in any pose of the walk: the
    // corners of each part's grid at rest and at the stride's four quarters (what the veil's reach is measured to).
    var rad = 0, hi = 0;
    // And in the swing (the smash): its tops either side and its strikes low and high, turned as the aim turns them.
    var acts = [null], tw0 = aimTwist(0, body), tw1 = aimTwist(ARMS_UP, body);
    [[ARMS_UP, tw0], [ARMS_UP, tw1]].forEach(function (t) { acts.push({ arms: t[0], twist: t[1] + COIL }, { arms: t[0], twist: t[1] - COIL }); });
    acts.push({ arms: 0, twist: tw0 }, { arms: ARMS_UP, twist: tw1 });
    [[0, 0], [0, 1], [Math.PI / 2, 1], [Math.PI, 1], [1.5 * Math.PI, 1]].forEach(function (q) {
      acts.forEach(function (a) {
      var M = PB.pose(body, q[0], q[1], a);
      parts.forEach(function (ch) {
        for (var i = 0; i < 8; i += 1) {
          var c = apply(M[ch.p.name], [i & 1 ? ch.p.dim[0] : 0, i & 2 ? ch.p.dim[1] : 0, i & 4 ? ch.p.dim[2] : 0]);
          rad = max(rad, hypot(c[0], c[2])); hi = max(hi, c[1]);
        }
      });
      });
    });
    me3 = { body: body, parts: parts, pal: pal, rad: rad, hi: hi, ms: round(performance.now() - t0) };
    PEARL = { headY: body.head.centre[1], headR: body.head.radius, top: body.top, hatReach: body.hatReach || PEARL.hatReach,
              hatDrop: body.hatDrop || 0, leg: body.walk.L_m || PEARL.leg };
    measure();
  }
  // The hat, with the head gone, falls straight down onto the bare neck as anything falls here (25 m/s/s), the
  // form's own drop (option B: nothing built rides with the one perfect form); the head coming home picks it up.
  function hatDrop(now) {
    if (!Hd || !PEARL.hatDrop) { return 0; }
    var t = (now - Hd.left) / 1000, fall = 12.5 * t * t, s = seat();
    var gap = Hd.phase === "home" ? hypot(Hd.x - s[0], Hd.y - s[1], Hd.z - s[2]) : 1e9;
    return min(PEARL.hatDrop, fall, gap);
  }
  function apply(m, p) { return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12], m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13], m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]]; }
  /* With veil, his parts' faces again for the fade's second pass (frame turns it on): where a hole of his lets
     what is behind show, it is veiled with the face's mean at lod, as the place's holes are. The head has no holes. */
  function drawPearl(now, veil) {
    if (!me3 || (!drawMe.body && !drawMe.head)) { return; }
    var PB = window.PearlBody, body = me3.body, phase = PB.phaseStep(body, 0, P.walked), M = PB.pose(body, phase, P.amount, swingPose());
    if (drawMe.body) {
      // The same program as the place's blocks, his palette, the pixel's width in his unit; no floor under his grids,
      // and no opening by his own nearness (uNear nought): he closes by the camera alone, as before.
      gl.uniform4fv(U.uPal, me3.pal);
      gl.uniform1f(U.uPx, pxW / body.cell); gl.uniform2f(U.uNear, 0, 0);
      gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0);
      var drop = hatDrop(now);
      me3.parts.forEach(function (ch) {
        var m = PB.place(M[ch.p.name], P.x, P.y, P.z, P.face);
        if (ch.p.name === "hat" && drop) { m = mul(PB.T(0, -drop, 0), m); }
        gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, ch.tex); gl.activeTexture(gl.TEXTURE0);
        gl.uniform3i(U.uDim, ch.p.dim[0], ch.p.dim[1], ch.p.dim[2]);
        gl.bindVertexArray(ch.vao);
        if (veil) { gl.drawElements(gl.TRIANGLES, ch.vcount, gl.UNSIGNED_INT, ch.count * 4); }
        else { gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0); }
      });
      // The place's own again, for whatever walks the place's grid after him.
      gl.uniform4fv(U.uPal, worldPal); gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
      gl.uniform1f(U.uPx, pxW); gl.uniform2f(U.uNear, NEAR_F[0], NEAR_F[1]); gl.uniform1i(U.uFloor, 1); gl.uniform3i(U.uDim, w.SX, w.SY, w.SZ);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    }
    if (drawMe.head && headProg && !veil) {
      // On the body the head rides the walk's bob and turns with him; out, it is where the hologram is, turned
      // to the camera's yaw. Its pattern and eyes ride its own frame: columns his right, up and back.
      var c = Hd ? [Hd.x, Hd.y, Hd.z] : apply(PB.place(M.head, P.x, P.y, P.z, P.face), body.head.centre), yaw = Hd ? Hd.yaw : P.face;
      var cy = Math.cos(yaw), sy = Math.sin(yaw), vm = view(eye, camLast.yaw, camLast.pitch);
      gl.useProgram(headProg);
      gl.uniformMatrix4fv(HU.uVP, false, vp); gl.uniform3fv(HU.uEye, eye); gl.uniform3fv(HU.uC, c); gl.uniform1f(HU.uR, PEARL.headR);
      gl.uniform3fv(HU.uSun, sunDir); gl.uniform3fv(HU.uHaze, HAZE); gl.uniform1f(HU.uExpo, HEAD_EXPO); gl.uniform1f(HU.uHolo, Hd ? 1 : 0);
      gl.uniformMatrix3fv(HU.uHead, false, [cy, 0, sy, 0, 1, 0, -sy, 0, cy]);
      gl.uniformMatrix3fv(HU.uV, false, [vm[0], vm[1], vm[2], vm[4], vm[5], vm[6], vm[8], vm[9], vm[10]]); gl.uniform1f(HU.uRig, 1);
      gl.bindVertexArray(null);
      gl.drawArrays(gl.TRIANGLES, 0, 36);
    }
  }
  // The nearest yaw to this one (either way, in steps of a 72nd of a turn) from which the third-person camera
  // stands its full distance from his head, nothing between: where the wake-up eases out to.
  function clearYaw(yaw, pitch) {
    var hd = seat();
    for (var i = 0; i <= 36; i += 1) {
      for (var sgn = 1; sgn >= -1; sgn -= 2) {
        var y = yaw + sgn * i * Math.PI / 36, d = lookDir(y, pitch - AIM);
        var full = [P.x - TP_D * d[0], P.y + PEARL.top / 2 - TP_D * d[1], P.z - TP_D * d[2]];
        var v = [full[0] - hd[0], full[1] - hd[1], full[2] - hd[2]], L = hypot(v[0], v[1], v[2]);
        if (clearTo(hd, [v[0] / L, v[1] / L, v[2] / L], L) >= L - 1e-6) { return y; }
        if (!i) { break; }
      }
    }
    return yaw;
  }

  /* ---- what you find --------------------------------------------------------------- */

  function collect(k, line) {
    if (found.indexOf(k) < 0) { found.push(k); }
    store();
    say(line || "Found " + lower(adv.pieces[k].name) + ".", true);
    drawPieces();
    if (found.length === 4) { setTimeout(function () { say("Every piece. Back to the wreck to build the rocket.", true); }, 2200); }
  }

  var current = null;
  function rawOf(p) {
    var h = p.work.history || {}, wk = p.work.work || {};
    var dims = p.f.dims || (p.f.wcm && p.f.hcm ? round(p.f.hcm) + " × " + round(p.f.wcm) + " cm" : "");
    return { date: h.date || wk.y || (p.f.year ? String(p.f.year) : ""), medium: h.medium || wk.m || "", dims: dims };
  }
  function showLabel(p) {
    current = p;
    var f = p.f, raw = rawOf(p), el = $("label");
    el.querySelector(".l-t").textContent = f.title || "Untitled";
    el.querySelector(".l-by").textContent = [f.artist, raw.date].filter(Boolean).join(", ");
    el.querySelector(".l-m").textContent = [raw.medium, raw.dims].filter(Boolean).join(" · ");
    el.querySelector(".l-room").textContent = [upper(p.room.name), p.work.floorShown].filter(Boolean).join(" · ") || (place.kind === "museum" ? "" : setting.name);
    var pic = $("l-pic");
    pic.alt = f.title || "";
    pic.src = f.image ? artOf(f.image) : "";
    var done = looked[f.id];
    $("behind").hidden = !!done || !!Hd;
    $("behind-done").hidden = !done && !Hd;
    $("behind-done").textContent = done === "piece" ? "You found " + lower(adv.pieces[p.k].name) + " behind it." : done ? "You looked behind it: nothing." :
      "As the hologram you can read it; to look behind it, leave the hologram (Holo, or H): your body follows your head.";
    el.hidden = false;
    if (window.innerWidth < 900) { $("notes").hidden = true; }
  }
  function closeLabel() { current = null; $("label").hidden = true; }
  function lookBehind() {
    var p = current;
    if (Hd) { barred(); return; }
    if (!p || looked[p.f.id]) { return; }
    if (p.k >= 0 && found.indexOf(p.k) < 0) {
      looked[p.f.id] = "piece";
      collect(p.k, "Behind " + (p.f.title || "the work") + ": " + lower(adv.pieces[p.k].name) + ".");
    } else {
      looked[p.f.id] = "nothing";
      alarms += 1;
      store();
      drawPieces();
      if (alarms >= 3) { say("Nothing behind it, and the third alarm brings the guards."); setTimeout(putOut, 1400); }
      else { say("Nothing behind it, and an alarm goes off. " + (alarms === 1 ? "Two more" : "One more") + " and the guards come."); }
    }
    showLabel(p);
  }
  // The guards put you out: you come to under your tree again, and the alarms are quiet.
  function putOut() {
    alarms = 0;
    store();
    drawPieces();
    closeLabel();
    lieDown(["The guards walk you out.", "You come to under your tree again.", adv.title]);
  }
  function readNote(x, y, z) {
    var n = notes.filter(function (q) { return q.x === x && q.y === y && q.z === z; })[0];
    // The hologram reads a note and leaves the paper where it lies; the body picks it up.
    if (!Hd) { w.set(x, y, z, B.AIR); remeshAt(x, z); }
    if (!n || (Hd && known[n.k + ":" + n.i])) { return; }
    known[n.k + ":" + n.i] = 1;
    store();
    drawPieces(n);
    $("notes").hidden = false;
    say(Hd ? "A note, read. It is in your notes; the paper stays where it lies." : "A note, picked up. It is in your notes.", true);
  }

  /* ---- the frame ------------------------------------------------------------------ */

  var last = 0, sunDir = norm([-0.45, 0.78, -0.35]), SKY = [0.48, 0.66, 0.86], HAZE = [0.84, 0.86, 0.86];
  var crossMark = null, held = false, flying = false;
  var skyVao = null, skyFig = null, curPix = 1, quality = 1, quality0 = 1, rows0 = 1, walk = 8, slow = 0, rocketCh = null, rocketLift = 0, ended = false, tick = 0, slowAt = 0;
  function norm(v) { var n = hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; }

  function frame(now) {
    var dt = min(0.05, (now - (last || now)) / 1000);
    last = now;
    tick += 1;
    // Frames coming slowly: the view a little coarser, then the walk among the bars shorter (walk, in
    // blocks); never the distance at which the faces close, which is set by the screen (rows0).
    if (!intro && !held && dt > 0.03) {
      slow += 1;
      if (slow > 45 && quality > 0.5) { quality -= 0.25; slow = 0; resize(); } else if (slow > 45 && walk > 4) { walk -= 2; slow = 0; }
    } else if (slow > 0) { slow -= 1; }
    var eyeH = EYE, open = 1;
    if (intro) {
      var u = (now - intro.t0) / 1000, sm = function (a, b) { var t = max(0, min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
      open = lids(u);
      // Coming to: the world soft, then sharp.
      var pix = round(10 - 9 * sm(1, 5.5));
      if (pix !== curPix) { curPix = pix; resize(); }
      eyeH = 0.35 + (EYE - 0.35) * sm(4.5, 7.2);
      P.pitch = 1.2 + (0.2 - 1.2) * sm(3.8, 7.2);
      P.yaw = intro.yaw0 + intro.turn * sm(5.5, 8.6);
      if (u > 9.6) { awake(); }
    } else if (!launched && !flying) {
      var hand = controls(dt);
      // The head out, the body stands where it was under the place's physics, unled; while it follows the head
      // (holo flies it), nothing stops it.
      if (Hd) { holo(dt, now, hand); if (!Hd || Hd.phase !== "follow") { physics(dt, { fwd: 0, side: 0, up: 0 }); } }
      else { physics(dt, hand); holoLeft = min(HOLO_T, holoLeft + HOLO_REFILL * dt); }
      swingStep(dt);
    }
    shardsStep(dt);
    pump(intro ? 14 : 6);
    var cw = canvas.width, chh = canvas.height, cam = camera(now, dt, eyeH, cw / chh);
    eye = cam.e;
    var proj = perspective(FOV * Math.PI / 180, cw / chh, NEAR, FAR);
    vp = mul(proj, view(eye, cam.yaw, cam.pitch));
    gl.viewport(0, 0, cw, chh);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(skyProg);
    gl.bindVertexArray(skyVao);
    gl.uniformMatrix4fv(SU.uInv, false, invert(vp));
    gl.uniform3fv(SU.uEye, eye); gl.uniform3fv(SU.uSun, sunDir); gl.uniform3fv(SU.uSky, SKY); gl.uniform3fv(SU.uHaze, HAZE);
    gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, vp);
    gl.uniform3fv(U.uEye, eye); gl.uniform3fv(U.uSun, sunDir); gl.uniform1f(U.uT, now / 1000);
    gl.uniform3fv(U.uSky, SKY); gl.uniform3fv(U.uHaze, HAZE);
    // The place's blocks to walk through, and how wide a pixel of the screen (at the view's first quality;
    // while you come to, the view's own coarse pixels) is at a block's distance.
    var tanH = 2 * Math.tan(FOV * Math.PI / 360), rows = curPix > 1 ? chh : rows0;
    pxW = tanH / rows;
    gl.uniform1f(U.uPx, pxW);
    gl.uniform1i(U.uSteps, walk); gl.uniform1i(U.uVeil, 0);
    gl.uniform1i(U.uVox, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform3i(U.uDim, w.SX, w.SY, w.SZ); gl.uniform1i(U.uFloor, 1);
    gl.uniform3f(U.uOff, 0, 0, 0);
    gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    // Mr Pearl, whom the faces open round (see FS), for the place, the rocket and the veil: the line up through him
    // from his feet to the top of his hat, his head's centre (on him, or out as the hologram), and NEAR_F.
    var hc = Hd ? [Hd.x, Hd.y, Hd.z] : seat();
    gl.uniform3f(U.uAxA, P.x, P.y, P.z); gl.uniform3f(U.uAxB, P.x, P.y + PEARL.top, P.z); gl.uniform3f(U.uHeadC, hc[0], hc[1], hc[2]);
    gl.uniform2f(U.uNear, NEAR_F[0], NEAR_F[1]);
    // Nearest first, so that what is hidden behind is turned away before the walk through its blocks.
    var pcx = eye[0] / CH - 0.5, pcz = eye[2] / CH - 0.5;
    var drawn = Object.keys(chunks).map(function (k) { return chunks[k]; })
      .filter(function (ch) { return ch.count && abs(ch.cx - pcx) <= 14.5 && abs(ch.cz - pcz) <= 14.5; })
      .sort(function (a, b) { return hypot(a.cx - pcx, a.cz - pcz) - hypot(b.cx - pcx, b.cz - pcz); });
    drawn.forEach(function (ch) {
        gl.bindVertexArray(ch.vao);
        gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
      });
    var lift = launched ? Math.pow(max(0, (now - launched) / 1000 - 1), 2) * 2.4 : 0;
    if (rocketCh) {
      gl.uniform3f(U.uOff, 0, lift, 0);
      // The rocket walks its own small grid, which rises with it.
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, rocketCh.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform3f(U.uOrg, rocketCh.org[0], rocketCh.org[1] + lift, rocketCh.org[2]);
      gl.uniform3i(U.uDim, rocketCh.dim[0], rocketCh.dim[1], rocketCh.dim[2]); gl.uniform1i(U.uFloor, 0);
      gl.bindVertexArray(rocketCh.vao);
      gl.drawElements(gl.TRIANGLES, rocketCh.count, gl.UNSIGNED_INT, 0);
      if (launched && lift > 300 && !ended) { ended = true; finish(); }
      rocketLift = lift;
    }
    drawPearl(now);
    drawShards();
    if (skyFig) {
      gl.useProgram(figProg);
      gl.uniformMatrix4fv(FU.uVP, false, vp);
      gl.uniform3fv(FU.uEye, eye); gl.uniform3fv(FU.uHaze, HAZE);
      gl.bindVertexArray(skyFig.vao);
      gl.drawArrays(gl.TRIANGLES, 0, skyFig.count);
    }
    if (homage) {
      gl.useProgram(homProg);
      gl.uniformMatrix4fv(OU.uVP, false, vp);
      gl.uniform3fv(OU.uEye, eye); gl.uniform3fv(OU.uHaze, HAZE);
      homage.figures.forEach(function (f) { gl.bindVertexArray(f.vao); gl.drawElements(gl.TRIANGLES, f.count, gl.UNSIGNED_INT, 0); });
    }
    if (paintings.length) {
      gl.useProgram(artProg);
      gl.uniformMatrix4fv(AU.uVP, false, vp);
      gl.uniform3fv(AU.uEye, eye); gl.uniform3fv(AU.uHaze, HAZE);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(AU.uTex, 0);
      gl.bindVertexArray(artVao);
      paintings.forEach(function (p) {
        if (!p.tex || abs(p.cx - eye[0]) > 90 || abs(p.cz - eye[2]) > 90) { return; }
        gl.bindTexture(gl.TEXTURE_2D, p.tex);
        gl.uniform1f(AU.uLit, looked[p.f.id] ? p.lit * 0.8 : p.lit);
        gl.drawArrays(gl.TRIANGLES, p.first, 6);
      });
    }
    /* The veil, last, over all that the holes let through: the faces again, where the depth test (LESS, the
       depth written above) passes, which is only where a face let a hole through, since everywhere else the
       face itself or something nearer is in the depth. There each paints its mean at lod over what is behind
       it, so the hole closes as the bars narrow, with the bars. No depth is written; the faces go from the
       furthest to the nearest, so a hole seen through a hole is veiled first. Only the chunks where lod can be
       short of 1 (the rest are drawn whole above): within the camera's reach, and within a quarter of it
       (NEAR_F's least) of him or of his head, measured across the ground, which is never further than the
       way through the air, so none is left out. */
    var reach = 0.0275 * rows / tanH + 1, nearHim = (reach - 1) / NEAR_F[0] + 1, veil = [];
    var across = function (ch, x, z) { return hypot(max(0, abs(x - (ch.cx + 0.5) * CH) - CH / 2), max(0, abs(z - (ch.cz + 0.5) * CH) - CH / 2)); };
    drawn.forEach(function (ch) {
      if (ch.vcount && across(ch, eye[0], eye[2]) < reach && min(across(ch, P.x, P.z), across(ch, hc[0], hc[2])) < nearHim) {
        veil.push({ ch: ch, d: hypot(eye[0] - (ch.cx + 0.5) * CH, eye[2] - (ch.cz + 0.5) * CH), lift: 0 });
      }
    });
    if (rocketCh && rocketCh.vcount) { veil.push({ ch: rocketCh, d: hypot(eye[0] - rocketCh.org[0] - 2.5, eye[2] - rocketCh.org[2] - 2.5), lift: lift }); }
    // And Mr Pearl's parts, when the camera stands near enough that a face of his is closing: the same reach in
    // his unit (lod is 1 beyond reach - 1 of his cells), to the nearest of him in any pose of the walk.
    if (me3 && drawMe.body) {
      var pr = hypot(eye[0] - P.x, eye[2] - P.z), pdy = max(0, P.y - eye[1], eye[1] - P.y - me3.hi);
      if (hypot(max(0, pr - me3.rad), pdy) < (reach - 1) * me3.body.cell) { veil.push({ pearl: true, d: pr }); drawMe.veil = true; }
    }
    if (veil.length) {
      gl.useProgram(prog);
      gl.uniform1i(U.uVeil, 1);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE);
      gl.enable(gl.CULL_FACE); gl.depthMask(false);
      veil.sort(function (a, b) { return b.d - a.d; }).forEach(function (e) {
        if (e.pearl) { drawPearl(now, true); return; }
        gl.uniform3f(U.uOff, 0, e.lift, 0);
        gl.bindVertexArray(e.ch.vao);
        gl.drawElements(gl.TRIANGLES, e.ch.vcount, gl.UNSIGNED_INT, e.ch.count * 4);
      });
      gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(true);
    }
    gl.bindVertexArray(null);
    if (now - slowAt > 250) { slowAt = now; fetchNear(); where(); skyCheck(); homageCheck(); }
    overlay(now, open);
    requestAnimationFrame(frame);
  }

  function lids(u) {
    var keys = [[0, 0], [1.2, 0], [1.9, 0.3], [2.4, 0.04], [3.2, 0.6], [3.6, 0.15], [5, 1], [99, 1]];
    for (var i = 1; i < keys.length; i += 1) {
      if (u <= keys[i][0]) { var a = keys[i - 1], b = keys[i], t = (u - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t * t * (3 - 2 * t); }
    }
    return 1;
  }
  // Where you come to, and stand to watch the rocket go: under your tree on the wreck's side of its trunk,
  // so that sitting up and turning you see the wreck. The figure in the sky is the drawing from here.
  function underTree() {
    var c = place.crash, wr = place.wreck, tr = place.tree;
    var tx = tr ? tr.x + 0.5 : c.x, tz = tr ? tr.z + 0.5 : c.z, ax = wr.x + 0.5 - tx, az = wr.z + 0.5 - tz, L = hypot(ax, az) || 1;
    return { x: tx + ax / L * 1.7, y: c.y, z: tz + az / L * 1.7 };
  }
  // The way you first face on coming to: a quarter turn short of the wreck, turned as you sit up.
  function wakeYaw() { var at = underTree(), wr = place.wreck; return Math.atan2(wr.x - at.x, -(wr.z - at.z)) - 1.5; }
  // You, lying beside the trunk of your tree, the wreck to one side: the head back on him and any way the body was on
  // to it ended (both are Hd's), and where you woke not his eyes again until you have walked off.
  function lieDown(lines) {
    var at = underTree();
    swing = swingNext = null; shards = [];
    if (Hd) { Hd = null; pov = "third"; delete document.body.dataset.holo; drawViews(); }
    if (skyFig) { skyFig.away = false; }
    blend = null; camD = 0;
    P.x = at.x; P.z = at.z; P.y = at.y; P.vx = P.vy = P.vz = 0;
    intro = { t0: performance.now(), yaw0: wakeYaw(), turn: 1.5, lines: lines };
    document.body.dataset.film = "true";
  }
  function awake() {
    var again = intro.lines[0] === "The guards walk you out.";
    intro = null;
    // Out of his eyes and up over his head: the first time you see him, from the nearest side where nothing stands
    // between the camera and his head.
    P.face = P.yaw;
    camLast = { e: [P.x, P.y + EYE, P.z], yaw: P.yaw, pitch: P.pitch };
    var from = { e: camLast.e, yaw: P.yaw, pitch: P.pitch };
    P.yaw = clearYaw(P.yaw, REST); camD = 1e9;
    blend = { from: from, t0: performance.now(), dur: T_SIT, pitchFrom: P.pitch, pitchTo: REST };
    curPix = 1;
    resize();
    delete document.body.dataset.film;
    if (again) { say("The alarms are quiet again. What you have found, you keep."); return; }
    var behind = adv.pieces.filter(function (p) { return p.hide.type === "work"; }).length;
    // Straight in, the world first: the notes are a tap away.
    var open = !CFG.play || window.innerWidth >= 1400;
    say((behind === 4 ? "The four pieces are behind four of the works inside. Your notes say which; there are more notes in the rooms." :
         behind === 1 ? "One piece is behind a work inside. The wreck's log says where the others fell." :
         behind ? behind + " pieces are behind works inside. The wreck's log says where the others fell." :
         "Four pieces of your rocket are somewhere in " + setting.name + ". The notes show where they fell.") + (open ? "" : " Tap Notes to read it."));
    if (open) { $("notes").hidden = false; }
  }

  function wrap(c, text, maxW) {
    var words = String(text).split(" "), lines = [], line = "";
    words.forEach(function (wd) { var t = line ? line + " " + wd : wd; if (c.measureText(t).width > maxW && line) { lines.push(line); line = wd; } else { line = t; } });
    if (line) { lines.push(line); }
    return lines;
  }
  // Where you are: the body, or the head while it is out (as feet under it).
  function me() { return Hd ? { x: Hd.x, y: Hd.y - PEARL.headY, z: Hd.z } : P; }
  function bearing(x, z) {
    var m = me(), b = Math.atan2(x - m.x, -(z - m.z)) - P.yaw;
    b = Math.atan2(Math.sin(b), Math.cos(b));
    return ARROWS[(round(b / (Math.PI / 4)) + 8) % 8];
  }
  function inRoom(x, y, z) { return place.kind !== "city" && !!Pl.roomAt(place, x, y, z); }
  function inBuilding() {
    if (!place.M) { return false; }
    var m = me(), c = floor(m.z) * w.SX + floor(m.x);
    return inRoom(m.x, m.y, m.z) || (m.x >= 0 && m.z >= 0 && m.x < w.SX && m.z < w.SZ && !!place.M.foot[c] && m.y < place.M.base + 30);
  }

  /* Over the view: the crosshair, the eyelids and the opening's lines, the smoke, and which way. */
  function overlay(now, open) {
    var c = hud.getContext("2d"), dpr = min(2, window.devicePixelRatio || 1), W = hud.width / dpr, H = hud.height / dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    var wr = place.wreck;
    // Smoke from the wreck, and from the rocket going up.
    var src = launched ? [wr.x + 0.5, wr.y + rocketLift, wr.z + 0.5] : [wr.x + 0.5, wr.y + 2, wr.z + 0.5];
    for (var k = 0; k < (launched ? 60 : 22); k += 1) {
      var life = ((now / 1000 * (launched ? 2.5 : 1) + k * 0.41) % 8) / 8;
      var p = [src[0] + Math.sin(k * 2.3) * (0.3 + life * (launched ? 9 : 3)), src[1] - (launched ? life * 30 : -life * 18), src[2] + Math.cos(k * 1.9) * (0.3 + life * 3)];
      var q = [0, 0, 0, 0];
      for (var i = 0; i < 4; i++) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; }
      if (q[3] <= 0.3) { continue; }
      var x = (q[0] / q[3] * 0.5 + 0.5) * W, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * H, s = max(3, min(launched ? 34 : 16, (0.4 + life * 2) * H / q[3] * 0.45));
      // Smoke in triangles, the unit of everything else.
      c.fillStyle = launched && life < 0.15 ? "rgba(255,190,110," + (0.8 * (1 - life / 0.15)) + ")" : "rgba(70,66,64," + (0.42 * (1 - life)).toFixed(3) + ")";
      c.beginPath(); c.moveTo(x, y - s * 0.58); c.lineTo(x + s / 2, y + s * 0.29); c.lineTo(x - s / 2, y + s * 0.29); c.closePath(); c.fill();
    }
    // The stick's water, under the thumb (see Water).
    if (!intro) { water.step(min(0.05, (now - (water.last || now)) / 1000), stillMotion.matches); water.last = now; water.draw(c, now / 1000, stillMotion.matches); }
    if (!intro && !launched && !touchy) {
      if (!crossMark) { crossMark = figure(17, 1, [[255, 255, 255], [196, 196, 196], [36, 34, 32]]); }
      c.globalAlpha = 0.92;
      c.drawImage(crossMark, round(W / 2 - 8.5), round(H / 2 - 9));
      c.globalAlpha = 1;
    }
    if (intro) {
      var shut = (1 - open) * H / 2;
      c.fillStyle = "#050302"; c.fillRect(0, 0, W, shut); c.fillRect(0, H - shut, W, shut);
      var u = (now - intro.t0) / 1000;
      [[0.8, 3.9, intro.lines[0]], [4.3, 7.3, intro.lines[1]], [7.6, 9.6, intro.lines[2]]].forEach(function (sl, n) {
        if (u < sl[0] || u > sl[1]) { return; }
        c.globalAlpha = min(1, (u - sl[0]) / 0.5, (sl[1] - u) / 0.5);
        c.font = n === 2 ? "500 13px ui-monospace, SFMono-Regular, Menlo, monospace" : "italic 400 20px Newsreader, Georgia, serif";
        if ("letterSpacing" in c) { c.letterSpacing = n === 2 ? "0.24em" : "0px"; }
        c.textAlign = "center"; c.textBaseline = "middle"; c.shadowColor = "rgba(0,0,0,0.9)"; c.shadowBlur = 6;
        c.fillStyle = "#f3e9d8";
        var lines = n === 2 ? [sl[2].toUpperCase()] : wrap(c, sl[2], min(W - 48, 560));
        lines.forEach(function (ln, j) { c.fillText(ln, W / 2, (n === 2 ? H * 0.5 : H * 0.72) + (j - (lines.length - 1) / 2) * 26); });
        c.shadowBlur = 0; c.globalAlpha = 1;
      });
    }
    // Which way: the nearest note still to read, the nearest piece still lying about, the wreck once
    // they are all found; the way in, from outside, to what is inside.
    var el = $("near"), text = "";
    if (!intro && !launched) {
      var target = null, label = "";
      var unread = notes.filter(function (n) { return !known[n.k + ":" + n.i] && found.indexOf(n.k) < 0; });
      var lying = pieces.filter(function (pc) { return found.indexOf(pc.k) < 0; });
      var m = me(), dist = function (a) { return hypot(a.x + 0.5 - m.x, a.z + 0.5 - m.z) + abs(a.y - m.y) * 2; };
      if (found.length === 4 && !built) { target = { x: wr.x, y: wr.y, z: wr.z }; label = "The wreck"; }
      else if (unread.length) { unread.sort(function (a, b) { return dist(a) - dist(b); }); target = unread[0]; label = "A note"; }
      else if (lying.length) { lying.sort(function (a, b) { return dist(a) - dist(b); }); target = lying[0]; label = adv.pieces[target.k].name.replace(/^The /, ""); }
      else if (found.length < 4) { text = "Behind which work? Read your notes"; }
      if (target && inRoom(target.x + 0.5, target.y, target.z + 0.5) && !inBuilding() && place.door) { target = { x: place.door.x - 0.5, y: place.door.y, z: place.door.z - 0.5 }; label = "The way in"; }
      if (target) {
        var dx = target.x + 0.5 - m.x, dz = target.z + 0.5 - m.z, dy = target.y - m.y;
        text = bearing(target.x + 0.5, target.z + 0.5) + " " + label + " · " + round(hypot(dx, dz)) + " m" + (dy > 3 ? " up" : dy < -3 ? " down" : "");
      }
    }
    el.hidden = !text;
    if (text && el.textContent !== text) { el.textContent = text; }
    $("build").hidden = !!Hd || !(found.length === 4 && !built && hypot(wr.x - P.x, wr.z - P.z) < 9);
    $("launch").hidden = !!Hd || !(built && !launched);
    holoHud();
    // What the crosshair is on (on a computer): a work's title, a note.
    if (!touchy && tick % 3 === 0) {
      var tag = $("tag"), hit = !intro && !launched && vp ? pick(lookDir(camLast.yaw, camLast.pitch)) : null, tt = "";
      if (hit && hit.painting) { tt = (hit.painting.f.title || "A work") + (looked[hit.painting.f.id] ? " · looked behind" : " · click to read its label"); }
      else if (hit && hit.b === B.NOTE && hit.r <= REACH) { tt = "A note · click to read it"; }
      else if (hit && hit.b !== undefined) { tt = (window.Homage && Homage.label(homage, hit.x, hit.y, hit.z)) || partText(Pl.partAt(place, hit.x, hit.y, hit.z)); }
      tag.hidden = !tt;
      if (tt && tag.textContent !== tt) { tag.textContent = tt; }
    }
    if (current && hypot(current.cx - me().x, current.cz - me().z) > 11) { closeLabel(); }
  }
  // A block's section and project: "The white cantilevered box of Casa CM", and in a lot, the lot's new form.
  function partText(pa) {
    if (!pa || !pa.name) { return pa && pa.lot ? pa.lot.name : ""; }
    var own = pa.from === setting.name;
    return upper(own ? pa.part || pa.name : pa.name.indexOf(" of ") > 0 ? pa.name : pa.name + " of " + Fm.the(pa.from)) + (pa.lot ? " · " + pa.lot.name : "");
  }
  // Where you are: the room and its floor; or by a building of the lots round it, the new form it is; or the place.
  function where() {
    var m = me(), rm = place.kind !== "city" ? Pl.roomAt(place, m.x, m.y, m.z) : null, t = setting.name;
    if (rm && rm.name) { var FL = place.floors[rm.floor]; t = upper(rm.name) + (place.kind === "museum" ? " · " + (FL.name || FL.label) : ""); }
    else if (w.lot) {
      var L = null, x = floor(m.x), z = floor(m.z);
      for (var r = 0; r <= 2 && !L; r += 1) {
        for (var dz = -r; dz <= r && !L; dz += 1) {
          for (var dx = -r; dx <= r && !L; dx += 1) {
            var X = x + dx, Z = z + dz;
            if (X >= 0 && Z >= 0 && X < w.SX && Z < w.SZ && w.lot[Z * w.SX + X]) { L = w.lots[w.lot[Z * w.SX + X] - 1]; }
          }
        }
      }
      if (L) { t = setting.name + " · " + L.name; }
    }
    var el = $("where");
    if (el.textContent !== t) { el.textContent = t; }
  }

  /* ---- the rocket ---------------------------------------------------------------- */

  function meshBlocks(list) {
    var has = {}, pos = [], inf = [], ind = [], v = 0;
    list.forEach(function (b) { has[b[0] + "," + b[1] + "," + b[2]] = 1; });
    list.forEach(function (b) {
      for (var f = 0; f < 6; f += 1) {
        var Fc = FACES[f];
        if (has[(b[0] + Fc.d[0]) + "," + (b[1] + Fc.d[1]) + "," + (b[2] + Fc.d[2])]) { continue; }
        for (var k = 0; k < 4; k += 1) { var cc = Fc.c[k]; pos.push(b[0] + cc[0], b[1] + cc[1], b[2] + cc[2]); inf.push(f, b[3], 0, 0); }
        ind.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
    });
    var ch = {};
    upload(ch, pos, inf, ind);
    return ch;
  }
  function buildRocket(quiet) {
    if ((built && !quiet) || found.length < 4 || (Hd && !quiet)) { return; }
    built = true;
    store();
    // The wreck's blocks cleared away, and the rocket stood there in a mesh of its own, so it can rise:
    // a white body, red nose and fins.
    var rx = place.wreck.x, rz = place.wreck.z, ry = place.wreck.y, x, y, z, list = [];
    for (y = ry; y < ry + 14; y += 1) { for (z = rz - 2; z <= rz + 2; z += 1) { for (x = rx - 2; x <= rx + 2; x += 1) { if (!(place.M && place.M.has(x, y, z))) { w.set(x, y, z, B.AIR); } } } }
    refresh(rx - 2, rz - 2, rx + 2, rz + 2);
    remeshAt(rx, rz); remeshAt(rx - 2, rz - 2); remeshAt(rx + 2, rz + 2);
    for (y = ry; y < ry + 12; y += 1) {
      var r = y > ry + 9 ? 0 : 1;
      for (z = rz - r; z <= rz + r; z += 1) { for (x = rx - r; x <= rx + r; x += 1) { list.push([x, y, z, y > ry + 9 ? B.RED : (y - ry) % 4 === 2 && x === rx && z === rz - 1 ? B.GLASS : B.WHITE]); } }
    }
    list.push([rx, ry + 12, rz, B.RED]);
    [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(function (d) { list.push([rx + d[0], ry, rz + d[1], B.RED], [rx + d[0], ry + 1, rz + d[1], B.RED]); });
    rocketCh = meshBlocks(list);
    var g = new Uint8Array(5 * 13 * 5);
    list.forEach(function (b) { g[((b[1] - ry) * 5 + (b[2] - rz + 2)) * 5 + (b[0] - rx + 2)] = b[3]; });
    rocketCh.tex = voxTexture(g, 5, 13, 5); rocketCh.org = [rx - 2, ry, rz - 2]; rocketCh.dim = [5, 13, 5];
    if (!quiet) { say("The rocket stands on the wreck's ground. Launch when you are clear.", true); }
  }
  function launch() {
    if (!built || launched || Hd) { return; }
    launched = performance.now();
    store();
    closeLabel();
    $("notes").hidden = true;
    // Stand back under your tree, where you woke, and watch it go up past the figure in the sky.
    var at = underTree(), wr = place.wreck;
    P.x = at.x; P.z = at.z; P.y = at.y;
    // The ground there, looked for from just over your head (the tree's leaves are over it).
    for (var y = floor(at.y) + 1; y > 0; y -= 1) { if (w.SOLID[w.get(floor(P.x), y, floor(P.z))]) { P.y = y + 1; break; } }
    P.yaw = Math.atan2(wr.x + 0.5 - P.x, -(wr.z + 0.5 - P.z));
    P.pitch = 0.3;
    var t0 = performance.now();
    (function tilt() { if (!launched) { return; } var u = (performance.now() - t0) / 1000; P.pitch = min(1.1, 0.3 + u * 0.09); if (u < 9) { requestAnimationFrame(tilt); } })();
    say("Lift-off.", true);
  }
  function finish() {
    var end = $("end"), name = setting.kind === "museum" ? Adv.theName(setting.name) : setting.name.replace(/^The /, "the ");
    end.hidden = false;
    document.body.dataset.film = "true";
    if (setting.kind === "city") {
      end.querySelector("h2").textContent = "You found the way off the Earth.";
      end.querySelector(".lede").textContent = "The rocket built from the pieces you found in " + setting.name + " is climbing out of the air. Mars is next.";
    } else {
      end.querySelector("h2").textContent = "You found the way out of " + name + ".";
      end.querySelector(".lede").textContent = "The rocket built from the pieces you found " + (setting.kind === "museum" ? "behind its works" : "in and round it") +
        " is climbing out of the air over " + (setting.city || setting.where) + ". There are more escapes in the site: another museum, another building, " +
        (setting.kind === "form" ? "another new form, " : "") + "the same place by another seed.";
    }
  }

  /* ---- what is said ------------------------------------------------------------------ */

  var sayTimer = 0;
  function say(text, good) {
    var t = $("toast");
    t.textContent = text;
    t.dataset.tone = good ? "good" : "";
    t.classList.add("show");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(function () { t.classList.remove("show"); }, 2600 + text.length * 35);
  }
  function drawPieces(fresh) {
    $("pieces").innerHTML = adv.pieces.map(function (p) {
      var got = found.indexOf(p.k) >= 0, c = w.pal[PIECE_IDS[p.k]];
      return '<li data-got="' + got + '"><i style="background-image:url(' + markOf("p" + p.k, 28, c) + ')"></i><span>' + esc(p.name.replace(/^The /, "")) + '</span></li>';
    }).join("");
    var al = $("alarms");
    al.hidden = setting.kind === "city";
    al.textContent = "Alarms " + "●●●".slice(0, alarms) + "○○○".slice(0, 3 - alarms);
    var read = 0, total = notes.length;
    notes.forEach(function (n) { if (known[n.k + ":" + n.i]) { read += 1; } });
    var html = adv.pieces.map(function (p) {
      var got = found.indexOf(p.k) >= 0, lines = [], more = 0;
      p.clues.forEach(function (cl, i) {
        if (i === 0 || known[p.k + ":" + i]) { lines.push('<q' + (fresh && fresh.k === p.k && fresh.i === i ? ' class="fresh"' : '') + '>' + esc(cl) + '</q>'); }
        else { more += 1; }
      });
      var behind = paintings.filter(function (q) { return q.k === p.k; })[0];
      var status = got ? (behind ? "Found, behind " + esc(behind.f.title || "a work") + "." : "Found.") :
                   more ? more + (more === 1 ? " more note about it, somewhere in the rooms." : " more notes about it, somewhere in the rooms.") : "";
      return '<li data-got="' + got + '"><b>' + esc(p.name) + '</b>' + lines.join("") + (status ? '<span class="more">' + status + '</span>' : '') + '</li>';
    }).join("");
    $("notes-list").innerHTML = '<ol>' + html + '</ol>' + (total ? '<p class="count">Notes read: ' + read + ' of ' + total + '</p>' : '') +
      (setting.recipe ? '<p class="made"><b>What this building is made of</b>' + esc(setting.recipe) + '</p>' : '');
  }
  function drawHotbar() {
    $("hotbar").innerHTML = HOTBAR.map(function (b, i) {
      return '<button class="slot" data-slot="' + i + '" aria-pressed="' + (mode === "place" && slot === i) + '" aria-label="' + BLOCKS[b] + '"><i style="background-image:url(' + markOf("b" + b, 52, w.pal[b]) + ')"></i></button>';
    }).join("");
    document.querySelectorAll("[data-slot]").forEach(function (el) {
      press(el, function (e) { e.stopPropagation(); if (Hd) { barred(); return; } slot = +el.dataset.slot; setMode("place"); });
    });
  }
  function setMode(m) {
    mode = m;
    $("mode").textContent = m === "break" ? "Break" : "Place";
    $("mode").setAttribute("aria-pressed", String(m === "place"));
    drawHotbar();
  }

  function advKey() { return setting.kind + ":" + setting.slug + ":" + seed; }
  function store() {
    try { localStorage.setItem(SAVE, JSON.stringify({ key: advKey(), found: found, known: known, looked: looked, alarms: alarms, built: built, done: !!launched, escaped: escaped })); }
    catch (e) { /* kept only while the page is open */ }
  }
  function saved() {
    try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) { return null; }
  }

  /* ---- the stick as a touch on water ---------------------------------------------------------------------
     The artist, 21 Oct 2026, of the stick, a dark disc with a knob: "Revolutionize the way the joist stick shows up on
     the screen when using it, it's too distracting, have it be a lot more subtle and feel like a natural force of
     nature rather than an analog tool". Where the left thumb lands, the surface answers once: a ring, never quite
     round (the head is the one perfect sphere), running out from under the thumb. Pushed, that water is drawn out
     the way he is pushed: the ring's front runs on ahead of the thumb, as far as the push is strong, and its sides
     trail back to where the thumb came down. Let go, it smooths over: the front sinks back, the ring comes round,
     spreads and is gone, in two beats of the theme song. No knob, no disc: a sliver of warm light on the crest and
     blue-violet shade beside it, drawn into the #hud canvas, which overlay() clears and redraws every frame. Its
     sizes are the stick's reach (40 px, the push the thumb's offset over it) times powers of phi, its times beats.
     water: down(x, y, t), move(x, y), up(t), step(dt, still), draw(c, t, still). */
  function Water() {
    var PHI = (1 + Math.sqrt(5)) / 2, TAU = Math.PI * 2, BEAT = 60 / 125; // the theme song's beat
    var REACH = 40;                           // the stick's reach, kept: the push is the thumb's offset over this
    var RING_T = 2 * BEAT, CALM_T = 2 * BEAT;  // the landing ring's life; the time the water takes to smooth over
    var LIGHT = [247, 230, 200], SHADE = [40, 44, 104]; // warm light (between --cream and --glow), blue-violet shade
    var LIT = -0.75 * Math.PI;                // the light comes from the upper left, as in the paintings
    var HAIR = REACH / 32;                    // a crest's sliver is two of these at its thickest
    var A_LIGHT = 1 / PHI, A_SHADE = 1 / PHI;     // quiet by thinness, not by fading: the pair holds 3:1 on every tone
    var U = [Math.pow(PHI, -6), Math.pow(PHI, -6), Math.pow(PHI, -7)]; // unround: harmonics 2, 3 and 5
    var LOBE = PHI * PHI, FRONT = PHI * PHI * PHI; // how the front is drawn out; how closely the light keeps to it
    var rings = [], calms = [], on = null, raw = { x: 0, y: 0 }, lag = { x: 0, y: 0 };

    function smooth(a, b, x) { var t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
    function rgba(c, a) { return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + (a > 0.002 ? a.toFixed(3) : 0) + ")"; }
    // A touch's unroundness, from where it lands (the same place, the same ring), turning once in eight beats while the
    // water is alive, standing still when motion is reduced.
    function phases(x, y) { var g = TAU / (PHI * PHI); return [(x * PHI + y) * g % TAU, (x + y * PHI) * 2 * g % TAU, (x - y) * 3 * g % TAU]; }
    function alive(ph, t, still) { if (still) { return ph; } var w = TAU / (8 * BEAT) * t; return [ph[0] + w, ph[1] - w / PHI, ph[2] + w / (PHI * PHI)]; }
    function unround(a, ph) { return U[0] * Math.cos(2 * a + ph[0]) + U[1] * Math.cos(3 * a + ph[1]) + U[2] * Math.cos(5 * a + ph[2]); }
    function lit(a) { return 0.5 + 0.5 * Math.cos(a - LIT); }
    // A sliver round (cx, cy): radius(a) its line, from angle a0 over span, thick(a) px across, laid outward of the
    // line (out) or about it. Filled, so where thick goes to nothing it tapers away. Sixteen points a radian.
    function sliver(c, cx, cy, radius, a0, span, thick, out) {
      var n = Math.max(12, Math.ceil(Math.abs(span) * 16)), j, a, e, t, xs = [], ys = [];
      c.beginPath();
      for (j = 0; j <= n; j += 1) {
        a = a0 + span * j / n; e = radius(a); t = thick(a);
        var ro = e + (out ? t : t / 2), ri = e - (out ? 0 : t / 2), ca = Math.cos(a), sa = Math.sin(a);
        if (j) { c.lineTo(cx + ca * ro, cy + sa * ro); } else { c.moveTo(cx + ca * ro, cy + sa * ro); }
        xs.push(cx + ca * ri); ys.push(cy + sa * ri);
      }
      for (j = n; j >= 0; j -= 1) { c.lineTo(xs[j], ys[j]); }
      c.closePath();
    }
    // Its colour, alpha(a) round (cx, cy) from a0 over span, sampled sixteen times: a conic gradient (flat without one).
    function round_(c, cx, cy, a0, span, rgb, alpha) {
      if (!c.createConicGradient) { return rgba(rgb, alpha(a0 + span / 2) * 0.8); }
      var g = c.createConicGradient(a0, cx, cy), f = span / TAU, n = 16;
      for (var j = 0; j <= n; j += 1) { g.addColorStop(f * j / n, rgba(rgb, alpha(a0 + span * j / n))); }
      if (f < 1) { g.addColorStop(Math.min(1, f + 1e-4), rgba(rgb, 0)); }
      return g;
    }

    // The ring the landing makes: out from under the thumb (REACH/φ) to φ² reaches over two beats, thick where the light
    // catches it and thin where it does not; it gives way as soon as the thumb pushes. Still, it stands at φ reaches
    // and only fades.
    function ring(c, R, t, still) {
      var u = (t - R.t0) / RING_T;
      if (u >= 1 || u < 0) { return false; }
      var r = still ? REACH * PHI : REACH / PHI + (REACH * PHI * PHI - REACH / PHI) * (1 - (1 - u) * (1 - u));
      var env = smooth(0, 0.08, u) * (still ? (1 - u) * (1 - u) : Math.pow(1 - u, PHI)) * (1 - R.given);
      if (env < 0.005) { return true; }
      var ph = alive(R.ph, t, still), g = R.ph[0], rad = function (a) { return r * (1 + unround(a, ph)); };
      sliver(c, R.x, R.y, function (a) { return rad(a) + HAIR * 0.6; }, 0, TAU,
        function (a) { return HAIR * (0.5 + 1.5 * (1 - lit(a)) * (0.4 + 0.6 * (0.5 + 0.5 * Math.cos(3 * a + g + 1)))); }, true);
      c.fillStyle = rgba(SHADE, env * A_SHADE); c.fill();
      sliver(c, R.x, R.y, rad, 0, TAU, function (a) { return HAIR * (0.25 + 1.75 * lit(a) * (0.35 + 0.65 * (0.5 + 0.5 * Math.cos(3 * a + g)))); }, false);
      c.fillStyle = rgba(LIGHT, env * A_LIGHT); c.fill();
      return true;
    }
    // The water drawn out: a ring round where the thumb came down, a reach across, its front drawn out the way he is
    // pushed (cos^φ² of the angle off the push) by φ² reaches times the square root of the push, so that even a third
    // of a push stands past a thumb's tip (102 px from the centre; 145 px at a full push); the light keeps to the front
    // (cos^φ³ of the half-angle) and the sides fade back towards where the thumb came down. W: x, y (where it came
    // down), s and th (the push, a quarter of a beat behind the thumb). calm, 0 to 1 as it smooths over: the front sinks
    // back, the ring comes round and spreads by φ reaches, and fades.
    function drawn(c, W, t, still, calm) {
      var s = W.s;
      if (s < 0.01) { return false; }
      var grow = still ? 0 : calm, th = W.th, ph = alive(W.ph, t, still);
      var D = PHI * PHI * REACH * Math.sqrt(s) * (1 - grow) * (1 - grow), R0 = REACH * (1 + PHI * grow), Q = FRONT * (1 - grow) + 0.01;
      var env = smooth(0.02, 0.16, s) * (1 / PHI + (1 - 1 / PHI) * s) * (1 - calm) * (1 - calm);
      if (env < 0.005) { return false; }
      var glint = still ? 0 : t / (4 * BEAT), g = W.ph[1];
      var rad = function (a) { var d = Math.cos(a - th), w = unround(a, ph); return R0 * (1 + w) + D * (d > 0 ? Math.pow(d, LOBE) : 0) * (1 + w / PHI); };
      var catches = function (a) { var d = Math.abs(Math.atan2(Math.sin(a - th), Math.cos(a - th))); return 0.5 + 0.5 * Math.cos(2 * PHI * d + TAU * glint + g); };
      var front = function (a) { return Math.pow(0.5 + 0.5 * Math.cos(a - th), Q); };
      var span = grow > 0.3 ? TAU : 1.25 * Math.PI, a0 = th - span / 2;   // beyond 112° off the push the light is under 1 %
      sliver(c, W.x, W.y, function (a) { return rad(a) + HAIR * 0.6; }, a0, span, function (a) { return HAIR * (0.5 + 1.1 * front(a)); }, true);
      c.fillStyle = round_(c, W.x, W.y, a0, span, SHADE, function (a) { return env * A_SHADE * front(a); }); c.fill();
      // the light catches the crest in places, and runs up both its sides to the front once a bar (four beats)
      sliver(c, W.x, W.y, rad, a0, span, function (a) {
        return HAIR * (0.4 + 1.6 * front(a) * (0.3 + 0.7 * catches(a))) * (0.75 + 0.25 * lit(a));
      }, false);
      c.fillStyle = round_(c, W.x, W.y, a0, span, LIGHT, function (a) { return env * A_LIGHT * front(a); }); c.fill();
      // and its echo, a ripple following it at the front only, REACH/φ² nearer the thumb and fainter by φ²
      var near = function (a) { return Math.pow(front(a), PHI); }, back = REACH / (PHI * PHI) * (1 + grow);
      sliver(c, W.x, W.y, function (a) { return rad(a) - back; }, a0, span, function (a) { return HAIR * 1.3 * near(a) * (0.3 + 0.7 * catches(a + 1)); }, false);
      c.fillStyle = round_(c, W.x, W.y, a0, span, LIGHT, function (a) { return env * A_LIGHT / (PHI * PHI) * near(a) * (0.7 + 0.3 * lit(a)); }); c.fill();
      return true;
    }
    function state() {
      var n = Math.hypot(lag.x, lag.y);
      return { x: on.x, y: on.y, s: Math.min(1, n / REACH), th: Math.atan2(lag.y, lag.x), ph: on.ph };
    }
    return {
      REACH: REACH,
      down: function (x, y, t) {
        on = { x: x, y: y, ph: phases(x, y), ring: { x: x, y: y, t0: t, ph: phases(x, y), given: 0 } };
        raw.x = raw.y = lag.x = lag.y = 0; rings.push(on.ring);
      },
      move: function (x, y) { if (on) { raw.x = x - on.x; raw.y = y - on.y; } },
      up: function (t) {
        if (!on) { return; }
        var W = state();
        if (W.s > 0.01) { W.t0 = t; calms.push(W); }
        on = null; raw.x = raw.y = lag.x = lag.y = 0;
      },
      // The water follows the thumb a quarter of a beat behind, as a current takes a moment to turn; still, at once.
      step: function (dt, still) {
        var L = Math.hypot(raw.x, raw.y), cx = L > REACH ? raw.x * REACH / L : raw.x, cy = L > REACH ? raw.y * REACH / L : raw.y;
        var k = still ? 1 : 1 - Math.exp(-dt / (BEAT / 4));
        lag.x += (cx - lag.x) * k; lag.y += (cy - lag.y) * k;
        if (on) { on.ring.given = Math.max(on.ring.given, 0.8 * smooth(0.05, 0.4, Math.hypot(lag.x, lag.y) / REACH)); }
      },
      draw: function (c, t, still) {
        var any = false;
        rings = rings.filter(function (R) { var d = ring(c, R, t, still); any = any || d; return d; });
        calms = calms.filter(function (W) {
          var u = (t - W.t0) / CALM_T;
          if (u >= 1) { return false; }
          any = drawn(c, W, t, still, u) || any; return true;
        });
        if (on) { any = drawn(c, state(), t, still, 0) || any; }
        return any || !!on;
      },
      busy: function () { return !!on || rings.length > 0 || calms.length > 0; }
    };
  }
  var water = Water(), stillMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };

  /* ---- the hand ------------------------------------------------------------------------- */

  var touchy = false;
  // A button pressed with one thumb while the other moves him or looks (the artist, 21 Oct 2026: "I want to be able to
  // switch between holographic view and third person view while I'm moving Mr Pearl. Right now if I am using my left
  // finger to move him, then it won't let me click on the perspective change button with my right finger without
  // releasing my left finger"): a phone makes no click of a tap while another finger is down, so a touch acts as it
  // presses, as the jump button does, and the click a lone tap still makes after it is not counted again (within the
  // time a press is held, 800 ms). A mouse and the keys click as before.
  function press(el, fn) {
    var at = -1e9;
    el.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") { return; } e.preventDefault(); at = performance.now(); fn(e); });
    el.addEventListener("click", function (e) { if (performance.now() - at < 800) { e.preventDefault(); e.stopPropagation(); return; } fn(e); });
  }
  function wire() {
    var stick = null, look = {};
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      if (intro) { if (performance.now() - intro.t0 > 600) { intro.t0 -= 9600; } return; }
      if (e.pointerType === "touch") { touchy = true; document.body.dataset.touch = "true"; $("tag").hidden = true; }
      canvas.setPointerCapture(e.pointerId);
      // The left of a phone's screen is the stick; anywhere else turns the view, and a tap acts.
      if (touchy && e.clientX < window.innerWidth * 0.4 && e.clientY > window.innerHeight * 0.45 && !stick) {
        stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
        water.down(e.clientX, e.clientY, performance.now() / 1000);
        $("notes").hidden = true;
        return;
      }
      look[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, button: e.button };
      input.looking = true;
    });
    canvas.addEventListener("pointermove", function (e) {
      if (stick && e.pointerId === stick.id) {
        var dx = e.clientX - stick.x, dy = e.clientY - stick.y, L = min(water.REACH, hypot(dx, dy)), a = Math.atan2(dy, dx);
        input.side = Math.cos(a) * L / water.REACH; input.fwd = -Math.sin(a) * L / water.REACH;
        water.move(e.clientX, e.clientY);
        return;
      }
      var l = look[e.pointerId];
      if (!l) { return; }
      var mx = e.clientX - l.x, my = e.clientY - l.y;
      if (abs(e.clientX - l.sx) + abs(e.clientY - l.sy) > 8) { l.moved = true; }
      P.yaw += mx * 0.0055; P.pitch = clampPitch(P.pitch - my * 0.0055);
      if (blend) { blend.pitchTo = null; }
      l.x = e.clientX; l.y = e.clientY;
    });
    var up = function (e) {
      if (stick && e.pointerId === stick.id) { stick = null; input.fwd = input.side = 0; water.up(performance.now() / 1000); return; }
      var l = look[e.pointerId];
      delete look[e.pointerId];
      input.looking = Object.keys(look).length > 0;
      if (l && !l.moved && performance.now() - l.t < 450) {
        if (touchy) { act(e.clientX, e.clientY, false); }
        else { var r = canvas.getBoundingClientRect(); act(r.left + r.width / 2, r.top + r.height / 2, l.button === 2); }
      }
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    var jb = $("jump");
    jb.addEventListener("pointerdown", function (e) { e.preventDefault(); input.jump = true; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { jb.addEventListener(ev, function () { input.jump = false; }); });
    // The buttons of play take a touch as it presses, so the other thumb can stay on the stick (press, above).
    press($("mode"), function () { if (Hd) { barred(); return; } setMode(mode === "break" ? "place" : "break"); });
    press($("v-holo"), function () { toggleHolo(); });
    press($("build"), function () { buildRocket(false); });
    press($("launch"), function () { launch(); });
    $("behind").onclick = lookBehind;
    $("leave").onclick = closeLabel;
    press($("notes-btn"), function () { var n = $("notes"); n.hidden = !n.hidden; if (!n.hidden && window.innerWidth < 900) { closeLabel(); } });
    $("again").onclick = function () { goTo({ kind: setting.kind, slug: setting.slug, seed: newSeed() }); };
    $("elsewhere").onclick = function (e) { if (CFG.play) { e.preventDefault(); goTo(randomChoice()); } };
    var keyOf = function (e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; };
    document.addEventListener("keydown", function (e) {
      if (!place) { return; }
      if (intro && performance.now() - intro.t0 > 600) { intro.t0 -= 9600; return; }
      var k = keyOf(e);
      if (["w", "a", "s", "d", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Shift", "c"].indexOf(k) >= 0) { input.keys[k] = true; e.preventDefault(); }
      if (k === "h" && !e.repeat) { toggleHolo(); }   // the button's key, once a press: held, it does not toggle again
      if (Hd && ((k >= "1" && k <= "5") || k === "e" || k === "q" || k === "b")) { barred(); }
      else {
        if (k >= "1" && k <= "5") { slot = +k - 1; setMode("place"); }
        if (k === "e" || k === "q") { setMode(mode === "break" ? "place" : "break"); }
        if (k === "b") { buildRocket(false); }
      }
      if (k === "n") { $("notes").hidden = !$("notes").hidden; }
      if (k === "f" && current) { if (Hd) { barred(); } else { lookBehind(); } }
      if (k === "Escape") { closeLabel(); $("notes").hidden = true; }
    });
    document.addEventListener("keyup", function (e) { input.keys[keyOf(e)] = false; });
    window.addEventListener("resize", resize);
  }
  // The view at the screen's own density (no grain of its own), softened while you come to; a
  // little coarser if the frames come slowly.
  function resize() {
    var cw = window.innerWidth, chh = window.innerHeight, dpr = min(2, window.devicePixelRatio || 1);
    var sc = curPix > 1 ? 1 / curPix : dpr * quality;
    canvas.width = max(1, round(cw * sc)); canvas.height = max(1, round(chh * sc));
    rows0 = max(1, round(chh * dpr * quality0));
    hud.width = round(cw * dpr); hud.height = round(chh * dpr);
  }

  /* ---- an adventure, from what the site holds ------------------------------------------------ */

  var cat = null, forms = null, choice = { kind: "museum", slug: "", seed: 0 };
  function newSeed() { return 1 + floor(Math.random() * 9998); }
  function listOf(kind) { return kind === "museum" ? cat.museums : kind === "building" ? cat.buildings : kind === "form" ? cat.forms : cat.cities; }
  /* The new forms on offer: the first two dozen the generator makes from the sections of the
     Architectural Authority's projects, each stood on the ground round the project its first volume came from. */
  function formList() {
    var out = [];
    for (var n = 1; n <= 24; n += 1) { out.push(formEntry(n)); }
    return out;
  }
  function kindOK(kind) { return listOf(kind) && listOf(kind).length && (!CFG.kinds || CFG.kinds.indexOf(kind) >= 0); }
  function randomChoice() {
    var kinds = (CFG.kinds || ["museum", "museum", "museum", "building", "building", "city"].concat(forms ? ["form", "form"] : [])).filter(kindOK);
    var kind = kinds[floor(Math.random() * kinds.length)];
    if (kind === "form") { var fs = CFG.forms || cat.forms.map(function (e) { return +e.slug; }); return { kind: kind, slug: String(fs[floor(Math.random() * fs.length)]), seed: newSeed() }; }
    var list = listOf(kind);
    return { kind: kind, slug: keyOfEntry(kind, list[floor(Math.random() * list.length)]), seed: newSeed() };
  }
  /* Straight in (CFG.play): the escape asked for on the way out of the last one; else the last one, if
     it is not over; else a new one. The screen is black until the place is built, then the eyes open. */
  function nextChoice() {
    var n = null, s = saved();
    try { n = JSON.parse(localStorage.getItem(NEXT) || "null"); localStorage.removeItem(NEXT); } catch (e) { n = null; }
    if (n && n.kind && kindOK(n.kind)) { return n; }
    if (s && s.key && !s.done) { var k = s.key.split(":"); if (kindOK(k[0])) { return { kind: k[0], slug: k[1], seed: +k[2] || newSeed() }; } }
    return randomChoice();
  }
  function goTo(c) {
    try { sessionStorage.setItem(ESCAPED, "1"); } catch (e) { /* then the next has the homage too */ }
    if (CFG.play) {
      try { localStorage.setItem(NEXT, JSON.stringify(c)); } catch (e) { /* a new one at random, then */ }
    } else { location.hash = c.kind + "/" + c.slug + "/" + c.seed; }
    location.reload();
  }
  function formEntry(n) {
    var R = Fm.form(forms, n), base = R.placed.filter(function (P2) { return P2.role === "base"; })[0], pj = forms.projects[base.sec.p];
    return { slug: String(n), name: R.name, where: pj.where, ground: pj.slug, recipe: R.recipe };
  }
  function keyOfEntry(kind, e) { return kind === "city" ? e.key : e.slug; }
  function chosen() {
    var list = listOf(choice.kind), e = list.filter(function (x) { return keyOfEntry(choice.kind, x) === choice.slug; })[0];
    // A new form by any number (the forms page offers more than the two dozen listed).
    if (!e && choice.kind === "form" && forms && /^\d+$/.test(choice.slug) && +choice.slug > 0) { e = formEntry(+choice.slug); list.push(e); }
    return e || list[0];
  }
  function fetchJSON(path) { return fetch(BASE + path).then(function (r) { if (!r.ok) { throw new Error("no " + path); } return r.json(); }); }

  /* What an adventure is made from: a city's ground; a museum's model, ground and plan, and the saved
     works hung in it (sixty at most, by the seed); a building's model and ground, and a dozen of
     the saved works, by the seed, with their histories. */
  function gather(kind, e, sd) {
    if (kind === "city") { return fetchJSON("grounds/" + e.slug + ".json").then(function (g) { return { kind: kind, ground: g, forms: forms }; }); }
    if (kind === "form") {
      return fetchJSON("grounds/" + e.ground + ".json").then(function (g) { return worksFor({ kind: kind, name: e.name, form: Fm.form(forms, +e.slug), ground: g, forms: forms }, sd); });
    }
    return Promise.all([fetchJSON("models/" + e.slug + ".json"), fetchJSON("grounds/" + e.slug + ".json"),
                        kind === "museum" ? fetchJSON("interiors/" + e.slug + ".json") : null]).then(function (res) {
      var d = { kind: kind, name: e.name, model: res[0], ground: res[1], interior: res[2], forms: forms }, r = Pl.rng(sd * 13 + 5);
      // A building's sections, to call its rooms by.
      var pj = forms ? forms.projects.filter(function (q) { return q.slug === e.slug; })[0] : null;
      if (pj) { d.sections = pj.sections.map(function (id) { return forms.sections[id]; }); }
      if (kind === "museum") {
        var roomName = {};
        (d.interior.floors || []).forEach(function (f) { (f.rooms || []).forEach(function (rm) { roomName[rm.id] = rm.name || ""; }); });
        var works = (d.interior.works || []).filter(function (wk) { return wk.room && wk.i && wk.kind !== "collection"; });
        while (works.length > 60) { works.splice(floor(r() * works.length), 1); }
        d.works = works.map(function (wk) {
          return { work: wk, history: { title: wk.t, artists: wk.a ? [wk.a] : [], date: wk.y, medium: wk.m, c: wk.c, image: wk.i }, room: wk.room, roomName: roomName[wk.room] || "" };
        });
        return d;
      }
      return worksFor(d, sd);
    });
  }
  // A dozen of the saved works, by the seed, with their histories.
  function worksFor(d, sd) {
    var r = Pl.rng(sd * 13 + 5), pool = cat.pool.slice(), pick = [];
    while (pick.length < 15 && pool.length) { pick.push(pool.splice(floor(r() * pool.length), 1)[0]); }
    return Promise.all(pick.map(function (wk) {
      return cat.histories ? cat.histories[wk.id] || null : fetchJSON("histories/" + wk.id + ".json").catch(function () { return null; });
    })).then(function (hs) {
      d.works = pick.map(function (wk, i) { return { work: wk, history: hs[i] }; }).filter(function (x) { return x.history; }).slice(0, 12);
      return d;
    });
  }
  function wait(v) { return new Promise(function (done) { setTimeout(function () { done(v); }, 30); }); }

  function start(kind, e, sd) {
    var status = $("status");
    setting = { kind: kind, slug: keyOfEntry(kind, e), name: e.name, where: e.where || e.name,
                city: kind === "city" ? e.name : String(e.where || "").split(",")[0], recipe: e.recipe || "" };
    seed = sd;
    status.textContent = "Fetching " + (kind === "museum" ? Adv.theName(e.name) : e.name);
    return gather(kind, e, sd).then(function (d) {
      status.textContent = "Building " + (kind === "museum" ? Adv.theName(e.name) : e.name) + " in blocks";
      return wait(d);
    }).then(function (d) {
      place = kind === "city" ? Pl.city(d.ground, forms) : Pl.place(d);
      w = place.w;
      var cands = (d.works || []).map(function (x) { x.f = Adv.facts(x.work, x.history); return x; });
      var hung = kind === "city" ? [] : Pl.hang(place, Pl.hangable(place, cands));
      adv = Adv.make(setting, sd, { works: hung.map(function (p) { return p.work; }), pool: !!(place.M && place.M.pool.length) });
      var hidden = Pl.hide(place, adv, hung, sd);
      paintings = hung; pieces = hidden.pieces; notes = hidden.notes;
      // The homage's blocks, then the place's grid sent for the walk, with the pieces and the notes in it. A world
      // escaped to has none, even come back to.
      var was = saved();
      if (was && was.key === advKey() && was.escaped) { escaped = true; }
      homage = homageData && window.Homage && !escaped ? Homage.plan(place, homageData, { wake: underTree(), yaw: wakeYaw(), eye: EYE, B: B }) : null;
      voxTex = voxTexture(w.data, w.SX, w.SY, w.SZ, voxTex);
      byPlane = {};
      paintings.forEach(function (p) {
        (byPlane[p.axis + p.plane] = byPlane[p.axis + p.plane] || []).push(p);
        var mid = (p.u0 + p.u1) / 2;
        p.cx = p.axis === "x" ? p.plane : mid; p.cz = p.axis === "x" ? mid : p.plane;
        var n = p.axis === "x" ? [p.dir, 0, 0] : [0, 0, p.dir];
        p.lit = min(1.05, 0.82 + 0.3 * max(0, n[0] * sunDir[0] + n[2] * sunDir[2]));
      });
      uploadPalette();
      meshAll(place.crash.x, place.crash.z);
      var t0 = performance.now();
      if (skyFig) { gl.deleteVertexArray(skyFig.vao); gl.deleteBuffer(skyFig.buf); }
      skyFig = placeSky();
      skyFig.ms = round(performance.now() - t0);
      homageUpload();
      uploadArt();
      paintings.forEach(function (p) { paintTexture(p, null); });
      // Where you had got to in this very adventure, if you were in it before.
      var s = saved();
      if (s && s.key === advKey()) {
        found = s.found || []; known = s.known || {}; looked = s.looked || {}; alarms = s.alarms || 0;
        pieces.forEach(function (pc) { if (found.indexOf(pc.k) >= 0) { w.set(pc.x, pc.y, pc.z, B.AIR); remeshAt(pc.x, pc.z); } });
        notes.forEach(function (n) { if (known[n.k + ":" + n.i]) { w.set(n.x, n.y, n.z, B.AIR); remeshAt(n.x, n.z); } });
        if (s.built && found.length === 4) { buildRocket(true); }
      }
      store();
      $("start").hidden = true;
      $("veil").hidden = true;
      document.title = adv.title + " · " + NAME;
      holoTop = place.crash.y + Math.sqrt(FAR * FAR - (w.SX * w.SX + w.SZ * w.SZ) / 4);
      drawPieces(); drawHotbar(); setMode("break"); where(); drawViews();
      lieDown(adv.intro);
      requestAnimationFrame(frame);
    });
  }

  function drawChoice() {
    document.querySelectorAll("[data-kind]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.kind === choice.kind)); });
    var list = listOf(choice.kind), e = chosen();
    choice.slug = keyOfEntry(choice.kind, e);
    $("place").innerHTML = list.map(function (x) {
      var k = keyOfEntry(choice.kind, x);
      return '<option value="' + esc(k) + '"' + (k === choice.slug ? " selected" : "") + '>' + esc((choice.kind === "form" ? "No. " + k + " · " : "") + x.name) + '</option>';
    }).join("");
    var no = " Adventure no. " + choice.seed + ".";
    $("preview").textContent = choice.kind === "museum" ?
      "Escape from " + Adv.theName(e.name) + ", " + String(e.where).split(",")[0] + ": " + e.works + " saved works on " + (e.floors === 1 ? "its one floor" : "its " + e.floors + " floors") + ", and four of them hiding the pieces." + no :
      choice.kind === "building" ? "Escape from " + e.name.replace(/^The /, "the ") + ", " + e.where + ": a dozen saved works hung in a building the site has modelled, its roof and its garden." + no :
      choice.kind === "form" ? "Escape from a building no one drew, made of the parts of the buildings the site has modelled, from the Architectural Authority: " + lower(e.recipe) + " A dozen saved works hang in it." + no :
      "Escape from " + e.name + ": the pieces on a roof, in a park, in the water and up a tree." + no;
    try { history.replaceState(null, "", "#" + choice.kind + "/" + choice.slug + "/" + choice.seed); } catch (err) { /* the address stays */ }
  }

  function init() {
    canvas = $("view");
    hud = $("hud");
    // Straight in: nothing over the view until you have come to.
    if (CFG.play) { document.body.dataset.film = "true"; }
    gl = canvas.getContext("webgl2", { antialias: true });
    quality = quality0 = window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? 0.75 : 1;
    if (!gl) { $("status").textContent = $("veil").textContent = "This game needs WebGL 2, which this browser does not offer."; return; }
    prog = compile(VS, FS); skyProg = compile(SKY_VS, SKY_FS); artProg = compile(ART_VS, ART_FS); figProg = compile(FIG_VS, FIG_FS); homProg = compile(HOM_VS, HOM_FS);
    initPearl();
    shardProg = compile(SHARD_VS, SHARD_FS);
    ["uVP", "uM", "uT", "uEye", "uHaze"].forEach(function (n) { SHU[n] = gl.getUniformLocation(shardProg, n); });
    ["uVP", "uOff", "uPal", "uEye", "uSun", "uT", "uSky", "uHaze", "uVox", "uOrg", "uDim", "uFloor", "uPx", "uSteps", "uVeil", "uM", "uInvM",
     "uAxA", "uAxB", "uHeadC", "uNear"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ["uInv", "uEye", "uSun", "uSky", "uHaze"].forEach(function (n) { SU[n] = gl.getUniformLocation(skyProg, n); });
    ["uVP", "uTex", "uEye", "uHaze", "uLit"].forEach(function (n) { AU[n] = gl.getUniformLocation(artProg, n); });
    ["uVP", "uEye", "uHaze"].forEach(function (n) { FU[n] = gl.getUniformLocation(figProg, n); OU[n] = gl.getUniformLocation(homProg, n); });
    try { escaped = sessionStorage.getItem(ESCAPED) === "1"; sessionStorage.removeItem(ESCAPED); } catch (e) { escaped = false; }
    gl.enable(gl.DEPTH_TEST);
    skyVao = gl.createVertexArray(); gl.bindVertexArray(skyVao);
    var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    resize(); wire();
    // The title's mark: the artist's figure, three tribars round a gap, in the page's tones.
    document.querySelectorAll("canvas.mark").forEach(function (m) {
      var f = blockMark(240, [[234, 223, 205], [168, 146, 122], [92, 76, 62]]);
      m.width = f.width; m.height = f.height;
      m.getContext("2d").drawImage(f, 0, 0);
    });
    Promise.all([fetch("catalogue.json").then(function (r) { return r.json(); }),
                 Fm ? fetch("sections.json").then(function (r) { return r.json(); }).catch(function () { return null; }) : null,
                 fetch("pearl-body.json").then(function (r) { return r.json(); }).catch(function () { return null; }),
                 fetch("homage.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]).then(function (res) {
      var d = res[0];
      // Mr Pearl, built of the unit from his form's file (without it the game plays, and he is not seen).
      try { pearlFrom(res[2]); } catch (err) { me3 = null; }
      homageData = res[3];
      cat = d;
      // The sections of the Architectural Authority's projects: the buildings round every place, and the new forms.
      forms = res[1] ? Fm.load(res[1]) : null;
      cat.forms = forms ? formList() : [];
      if (!forms) { var fp = document.querySelector('[data-kind="form"]'); if (fp) { fp.hidden = true; } }
      if (CFG.play) {
        choice = nextChoice();
        start(choice.kind, chosen(), choice.seed).catch(function (err) { $("veil").textContent = "The world could not be built: " + err.message; });
        return;
      }
      // The address names an adventure (#museum/<slug>/<seed>); else the one you were in; else the Musée d'Orsay.
      var h = decodeURIComponent((location.hash || "").slice(1)).split("/"), s = saved(), k = s && s.key ? s.key.split(":") : null;
      if (h[0] === "museum" || h[0] === "building" || h[0] === "city" || (h[0] === "form" && forms)) { choice = { kind: h[0], slug: h[1] || "", seed: +h[2] || newSeed() }; }
      else if (h[0] && cat.cities.some(function (c) { return c.key === h[0]; })) { choice = { kind: "city", slug: h[0], seed: newSeed() }; }
      else if (k && (k[0] !== "form" || forms)) { choice = { kind: k[0], slug: k[1], seed: +k[2] || newSeed() }; }
      else { choice = { kind: "museum", slug: "museum-musee-dorsay", seed: newSeed() }; }
      drawChoice();
      document.querySelectorAll("[data-kind]").forEach(function (b) {
        b.onclick = function () { if (choice.kind !== b.dataset.kind) { choice = { kind: b.dataset.kind, slug: "", seed: newSeed() }; drawChoice(); } };
      });
      $("place").onchange = function () { choice.slug = $("place").value; choice.seed = newSeed(); drawChoice(); };
      $("surprise").onclick = function () {
        var kinds = ["museum", "museum", "museum", "building", "building", "city"].concat(forms ? ["form", "form"] : []), kind = kinds[floor(Math.random() * kinds.length)], list = listOf(kind);
        choice = { kind: kind, slug: keyOfEntry(kind, list[floor(Math.random() * list.length)]), seed: newSeed() };
        drawChoice();
      };
      $("status").textContent = "";
      var begin = $("begin");
      begin.disabled = false;
      begin.onclick = function () {
        begin.disabled = true;
        start(choice.kind, chosen(), choice.seed).catch(function (err) {
          $("status").textContent = "The adventure could not be built: " + err.message;
          begin.disabled = false;
        });
      };
    }).catch(function () { $("status").textContent = "The places could not be loaded."; $("veil").textContent = "The world could not be loaded."; });
  }

  // debug() hands the game's state to a test (it changes nothing by itself).
  window.Rocket = { debug: function () {
    return { P: P, place: place, w: w, adv: adv, paintings: paintings, pieces: pieces, notes: notes, found: found, known: known, looked: looked,
             alarms: function () { return alarms; }, act: act, remeshAt: remeshAt, buildRocket: buildRocket, launch: launch, showLabel: showLabel,
             lookBehind: lookBehind, readNote: readNote, queue: function () { return queue.length; }, intro: function () { return intro; },
             skip: function () { if (intro) { intro.t0 -= 9600; } },
             hold: function (q, steps) { held = true; quality = q; walk = steps || 8; resize(); }, walk: function () { return walk; }, quality: function () { return quality; },
             flush: function () { pump(1e9); }, figure: figure, fly: function (on) { flying = !!on; }, sky: function () { return skyFig; }, underTree: underTree,
             homage: function () { return homage; }, wakeYaw: wakeYaw,
             aim: function () { var h = eye && camLast ? pick(lookDir(camLast.yaw, camLast.pitch)) : null; return h ? (h.painting ? "work: " + h.painting.f.title : "block " + h.b + " at " + h.r.toFixed(2)) : "nothing"; },
             pov: function () { return pov; }, toggle: toggleHolo, head: function () { return Hd; }, cam: function () { return { eye: eye, last: camLast, camD: camD, blend: blend, drawMe: drawMe }; },
             swing: function () { return swing && { u: swing.u, side: swing.side, hit: swing.hit, struck: !!swing.struck, broke: !!swing.broke, ret: !!swing.ret, speed: swing.speed, at: [swing.x, swing.y, swing.z], next: swingNext && [swingNext.x, swingNext.y, swingNext.z], pose: swingPose() }; },
             holdSwing: function (u) { if (swing) { swing.hold = u; } }, shards: function () { return shards.map(function (q) { return { c: q.c, v: q.v, t: q.t, lies: !!q.lies }; }); },
             screenOf: function (p) { var r = canvas.getBoundingClientRect(), q = [0, 0, 0, 0]; for (var i = 0; i < 4; i++) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; } return q[3] > 0 ? [r.left + (q[0] / q[3] * 0.5 + 0.5) * r.width, r.top + (0.5 - q[1] / q[3] * 0.5) * r.height] : null; },
             farEnd: function () { return swing && !swing.ret && FAR_END ? farEndAt(swing, swing.u) : null; }, smashConsts: function () { return { BEAT: BEAT, COIL: COIL, ARMS_UP: ARMS_UP, E0: E0, Y_SH: Y_SH, FAR_END: FAR_END }; },
             stone: function () { return onStone; }, px: function () { return pxW; }, putOut: putOut,
             bring: bringBody, home: goHome, harm: harmBody, pearl: function () { return me3 && { ms: me3.ms, cells: me3.body.cells, parts: me3.parts.length, cell: me3.body.cell, PEARL: PEARL }; }, consts: { AIM: AIM, REST: REST, TP_D: TP_D, TP_UP: TP_UP, TP_DOWN: TP_DOWN, TP_HEAD: TP_HEAD, TURN: TURN, T_VIEW: T_VIEW, T_LIFT: T_LIFT, LIFT: LIFT, HAT_REACH: HAT_REACH, HOLO_V: HOLO_V, HOLO_V_IN: HOLO_V_IN, HOLO_T: HOLO_T, BAR: BAR, NEAR_F: NEAR_F, holoTop: holoTop }, holoLeft: function (v) { if (v != null) { holoLeft = v; } return holoLeft; } };
  } };
  init();
})();
