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
  // The unit's studies, in their row beside the tree (homage.js row, studies.json; the artist, 21 Oct 2026: "I want
  // those units [studies] to be placed in holographic Mr. [Pearl] right next to the tree lined up next to each
  // other"): in every world with room for them.
  var studies = null, studiesData = null;
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
    guardsRemesh(x, z);
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
     (uHeadC), and while the head is out the line from the camera to it (uHeadE to uHeadC), so a floor or a roof
     the hologram is in or looks through stays open between. lod is the more closed of the two. On his own body uNear is nought: he closes by the camera
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
  // Painted (1) as Cezanne paints, or the drawing alone (0): see FS's paint.
  var PAINT = 1;
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
    "uniform int uSteps; uniform int uVeil; uniform float uPaint;",
    "uniform vec3 uAxA; uniform vec3 uAxB; uniform vec3 uHeadC; uniform vec3 uHeadE; uniform vec2 uNear;",   // Mr Pearl, whom the faces open round
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
    // How far p is from the segment a to b.
    "float seg(vec3 p, vec3 a, vec3 b) { vec3 ab = b - a; return length(p - a - ab * clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0)); }",
    // Painted as Cezanne paints (CLAUDE.md, the artist, 15 Oct 2026): form by warm and cool, not by dark and light
    // alone (the faces the drawing makes white warmed toward his light, those it makes black cooled toward blue-violet),
    // and two washes of translucent diamonds anchored to each face (phi^2 and phi to a metre, the second turned 36
    // degrees), each diamond its own tint between the warm and the cool, mixing into new colours where they overlap;
    // over them short dabs across the face. uPaint 0 is the drawing alone.
    "vec3 tone(int ax, float s) { return ax == 1 && s > 0.0 ? vec3(1.06, 0.97, 0.84) : ax == 2 ? vec3(0.86, 0.89, 1.12) : vec3(0.99, 0.96, 1.0); }",
    "float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }",
    "vec4 wash(vec2 q) { vec2 r = vec2(q.x + q.y, q.x - q.y) * 0.7071; vec2 cell = floor(r), f = fract(r) - 0.5;",
    "  float h = h21(cell), e = smoothstep(0.5, 0.3, max(abs(f.x), abs(f.y)));",
    "  return vec4(mix(vec3(1.0, 0.84, 0.6), vec3(0.5, 0.5, 0.86), h), e * (0.35 + 0.65 * h21(cell + 7.1))); }",
    // (each wash fades where its diamonds would be under four of the screen's pixels: mpp, metres a pixel there along
    // the face, so a face seen aslant fades sooner; the pattern is the grid's own, so it rides on the rocket as it lifts)
    "vec3 washOn(vec3 c, vec2 uv, float size, float amt, float mpp, mat2 turn, float off) {",
    "  float k = amt * (1.0 - smoothstep(size / 8.0, size / 4.0, mpp));",
    "  if (k <= 0.0) { return c; }",
    "  vec4 a = wash(turn * uv / size + off);",
    "  return mix(c, c * a.rgb * 1.22, k * a.a);",
    "}",
    "vec3 paint(vec3 c, vec3 p, int ax, float s, float mpp, bool shaded) {",
    "  if (uPaint <= 0.0) { return c; }",
    "  if (shaded) { c *= mix(vec3(1.0), tone(ax, s), uPaint); }",
    "  vec2 uv = ax == 0 ? p.zy : ax == 1 ? p.xz : p.xy;",
    "  mat2 I = mat2(1.0), T = mat2(0.809, 0.588, -0.588, 0.809);",
    "  c = washOn(c, uv, 0.618, 0.46 * uPaint, mpp, I, 0.0);",
    "  c = washOn(c, uv, 1.0, 0.38 * uPaint, mpp, T, 0.37);",
    "  c = washOn(c, uv, 2.618, 0.3 * uPaint, mpp, I, 0.71);",
    "  float dab = fract(dot(uv, vec2(5.236, 3.236)) + h21(floor(uv * 4.236)));",
    "  float dk = 1.0 - smoothstep(0.04, 0.1, mpp);",
    "  return c * (1.0 + 0.07 * uPaint * dk * (smoothstep(0.2, 0.5, dab) - smoothstep(0.5, 0.8, dab) - 0.25));",
    "}",
    "vec3 dark(int id) { return uPal[int(uPal[id].a + 0.5) == 1 ? " + B.DIRT + " : id].rgb / 255.0 * 0.16; }",
    "void main() {",
    "  vec4 pe = uPal[vB]; int st = int(pe.a + 0.5);",
    "  vec3 n = N[vF], col; float dist = length(vP - uEye), th = 0.0;",
    "  float lod = smoothstep(0.0125, 0.0275, uPx * dist);",   // a bar eight pixels wide, then under four: the screen's limit
    // Round him: his distance (the line through him, feet to hat top, or his head) taken four times, or thirty-two for a level face.
    "  float him = min(seg(vP, uAxA, uAxB), seg(vP, uHeadE, uHeadC));",
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
    "    vec3 pw = vec3(1.0) - vec3(uPaint);",
    "    vec3 far = fw.x * bar(vB, 1, 1.0) * (pw + uPaint * tone(1, 1.0)) + fw.y * bar(vB, 0, 1.0) * (pw + uPaint * tone(0, 1.0)) + fw.z * bar(vB, 2, 1.0) * (pw + uPaint * tone(2, 1.0)) + fw.w * dark(vB) * (pw + uPaint * tone(2, 1.0));",
    "    far = paint(far, ((uInvM * vec4(vP, 1.0)).xyz - uOrg) / length(mat3(uInvM)[0]), vF >> 1, 1.0, uPx * dist / length(mat3(uInvM)[0]) / max(-dot(d, n), 0.05), false);",
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
    "        if (ax >= 0) { res = 1; th = max(best, tin); col = paint(bar(int(b), ax, -float(sg[ax])), (p0 + d * th) / length(mat3(uInvM)[0]), ax, -float(sg[ax]), uPx * dist / length(mat3(uInvM)[0]) / max(abs(d[ax]), 0.05), true) * (1.0 - 0.07 * float(k)); break; }",
    "        if (tm.x < tm.y && tm.x < tm.z) { c.x += sg.x; tin = tm.x; tm.x += td.x; }",
    "        else if (tm.y < tm.z) { c.y += sg.y; tin = tm.y; tm.y += td.y; }",
    "        else { c.z += sg.z; tin = tm.z; tm.z += td.z; }",
    "      }",
    "      if (res == 0) { col = dark(int(lb)) * (vec3(1.0) - vec3(uPaint) + uPaint * tone(2, 1.0)); th = tin; }",
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
    (homage ? homage.figures : []).concat(studies ? studies.figures : []).forEach(function (f) {
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
    charsUpload();
  }
  // On a stone of the homage, once each: which figure it is, and how it closes from there.
  function homageCheck() {
    if (intro || launched) { return; }
    // (the homage's stones only: the studies' words are gone, the artist, 26 Oct 2026: "Get rid of this")
    var st = homage && Homage.standing(homage, P.x, P.y, P.z);
    if (st && !st.told) { st.told = true; say(st.name + ". " + st.said, true); }
  }
  // The stone he stands on, of the homage or of the studies, if any.
  function stoneAt() { return (homage && Homage.standing(homage, P.x, P.y, P.z)) || (studies && Homage.standing(studies, P.x, P.y, P.z)) || null; }
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
  var input = { fwd: 0, side: 0, jump: false, keys: {}, fire: false };
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
    // With the sight up the arrows aim (the artist, 20 Oct 2026, of the sight: "...that I can control with my right
    // finger while my left finger allows me to move around the area"): the mark crosses its own window (2 asin(R / phi))
    // in a beat, left and right and up and down; W and S still walk.
    var aimK = sightOn() ? 2 * Math.asin(PEARL.headR / SIGHT_D) / BEAT : 0;
    var fwd = input.fwd + ((k.w || (k.ArrowUp && !aimK)) ? 1 : 0) - ((k.s || (k.ArrowDown && !aimK)) ? 1 : 0);
    var side = input.side + (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (k.ArrowLeft) { P.yaw -= dt * (aimK || 2); }
    if (k.ArrowRight) { P.yaw += dt * (aimK || 2); }
    if (aimK && (k.ArrowUp || k.ArrowDown)) { P.pitch = clampPitch(P.pitch + (k.ArrowUp ? 1 : -1) * aimK * dt); }
    if (aimK && (k.ArrowUp || k.ArrowDown || k.ArrowLeft || k.ArrowRight)) { sight.turn = null; }
    var len = hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    return { fwd: fwd, side: side, up: (input.jump || k[" "] ? 1 : 0) - (k.Shift || k.c ? 1 : 0) };
  }
  function turnTo(a, b, step) { var d = Math.atan2(Math.sin(b - a), Math.cos(b - a)); return a + max(-step, min(step, d)); }
  // The dash (the artist, 27 Oct 2026: "When I am walking with Mr. Pearl, I want to be able to double tap with my right
  // hand and he quickly dashes forward 10 feet"): ten feet, 3.048 m, along the way he walks, in half a beat, stopped by
  // what it meets as his walk is; a swing a first tap began is let go.
  var DASH = { D: 3.048, BEATS: 0.5 }, dash = null;   // (in beats: BEAT is set further on)
  function dashOn() {
    var L = hypot(P.vx, P.vz);
    dash = { left: DASH.D, d: L > 0.1 ? [P.vx / L, P.vz / L] : [Math.sin(P.face), -Math.cos(P.face)] };
    letGo();
  }
  function physics(dt, c) {
    var fwd = c.fwd, side = c.side;
    P.wet = w.get(floor(P.x), floor(P.y + 0.6), floor(P.z)) === B.WATER;
    var speed = P.wet ? SWIM : WALK;
    P.vx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) * speed;
    P.vz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) * speed;
    // (the ten feet to the inch: the last frame takes only what is left)
    if (dash && dt > 0) { var dv = min(DASH.D / (DASH.BEATS * BEAT), dash.left / dt); dash.left -= dv * dt; P.vx = dash.d[0] * dv; P.vz = dash.d[1] * dv; if (dash.left <= 1e-6) { dash = null; } }
    // He faces the way he walks (relative to the camera), or what he reaches for; while a swing is on, what it will
    // strike, walking or not (the legs walk on), and the camera keeps to the way he walks.
    // With the sight up he faces the mark, walking or not (the artist, 20 Oct 2026: "I want you to be able to aim at a
    // target with a reflex sight"): the legs walk the way the stick says, sideways too, and the camera is the aim.
    var aim = swingYaw(), way = Math.atan2(P.vx, -P.vz);
    if (sight.up) { P.face = turnTo(P.face, P.yaw, TURN * dt); P.want = null; }
    // (while a swing aims, at twice his turn: the strike is half a beat away, and at his turn a beat let him come
    // round to any bearing by it)
    else if (aim !== null) { P.face = turnTo(P.face, aim, TURN * BEAT / SWING * dt); if (fwd || side) { P.want = null; } }
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
      nx = P.x; P.vx = 0;   // (stopped: no walk to add to a throw)
    }
    P.x = nx;
    var nz = P.z + P.vz * dt;
    if (boxHits(P.x, P.y, nz)) {
      if (P.ground && !boxHits(P.x, P.y + 1.05, nz) && !boxHits(P.x, P.y + 1.05, P.z) && (fwd || side)) { P.vy = 8.2; P.ground = false; }
      nz = P.z; P.vz = 0;
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
  // How far along a ray from the camera it passes him (or the head): what is nearer the camera is not tapped.
  function passT(dir) { var at = reachFrom(); return max(0, (at[0] - eye[0]) * dir[0] + (at[1] - eye[1]) * dir[1] + (at[2] - eye[2]) * dir[2]); }
  // What the crosshair (or a tap) is on: the ray from the camera, begun where it passes him (nothing between the
  // camera and him counts), and what it meets measured from where he reaches from (r). From his own eyes (a stone,
  // where you woke) the ray begins at them, as before.
  function pick(dir) {
    var at = reachFrom(), t0 = passT(dir);
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
  // A tap's act; quick, a tap within a beat of the last (a run of them: twice the work, below). True when it breaks or
  // places (so a double tap in the run is that work, not the dash).
  function act(px, py, forcePlace, quick) {
    if (space || court) { input.fire = true; return; }
    if (ignite) { igniteTap(); return; }
    if (intro || launched || !vp) { return; }
    var dir = dirAt(px, py), hit = pick(dir);
    if (gateTap(dir, hit)) { enterCourts(); return; }   // (the pickleball net: to the courts)
    var qc = qcubeTap(dir, hit);
    if (qc) { (CUBE_ACTS[qc.ch] || function () {})(qc); return; }   // (a character cube: what its character stands for)
    // a coin: what it is and where (it is taken by passing through it, not by a tap)
    var cq = coinAt(dir, hit);
    if (cq) { say(coinWords(cq)); return; }
    var gq = guardAt(dir, hit);
    if (gq) { say(guardWords(gq)); return; }
    if (!hit) { return; }
    // A block kept for the next swing is turned to at this one's strike, not now.
    var kept = !Hd && !!swing && !swing.ret && swing.u < 1.5 && !hit.painting && hit.b !== B.NOTE && !(forcePlace || mode === "place");
    if (!Hd && !kept) { var hx = hit.painting ? hit.painting.cx : hit.x + 0.5, hz = hit.painting ? hit.painting.cz : hit.z + 0.5; P.want = Math.atan2(hx - P.x, -(hz - P.z)); }
    if (hit.painting) { showLabel(hit.painting); return; }
    if (hit.r > REACH) { return; }
    if (hit.b === B.NOTE) { readNote(hit.x, hit.y, hit.z); return; }
    if (Hd) { return; }   // (as the hologram a tap on a block is nothing; a double tap takes the head there)
    if (!(forcePlace || mode === "place")) {
      if (hit.b === B.BEDROCK) { return; }
      if (hangsOn(hit.x, hit.y, hit.z)) { say("A work hangs on this wall."); return; }
      // He smashes it with his guitar: it breaks at the strike, half a beat from now (SWING; the smash, above).
      smash(hit, dir, quick);
      return true;
    }
    if (!hit.prev) { return; }
    // In a run of taps a second is laid on it, the way it was laid: two a tap (the artist, 28 Oct 2026, of the dash
    // that took him away from what he spammed: "when I spam place or break Mr Pearl can now those tasks twice as fast").
    var p = hit.prev;
    if (!lay(p)) { return; }
    if (quick) { var q2 = [2 * p[0] - hit.x, 2 * p[1] - hit.y, 2 * p[2] - hit.z]; if (isOpen(w.get(q2[0], q2[1], q2[2]))) { lay(q2); } }
    return true;
  }
  // A block of the bar's laid at c, in the world, unless it would close on him or a pearl (it would be buried, out of
  // reach), or where a Q cube stands or a coin not yet taken floats (neither is a block: a run's second could take its
  // cell); whether it was.
  function lay(c) {
    var at = function (q) { return floor(q.x) === c[0] && floor(q.y) === c[1] && floor(q.z) === c[2]; };
    if (c[0] < 0 || c[2] < 0 || c[0] >= w.SX || c[2] >= w.SZ || c[1] < 0 || c[1] >= w.SY || qcubes.some(at) || left().some(at)) { return false; }
    var was = w.get(c[0], c[1], c[2]);
    w.set(c[0], c[1], c[2], HOTBAR[slot]);
    if (boxHits(P.x, P.y, P.z) || pearls.some(function (q) { return sphereHit(q.x, q.y, q.z, pearlR()); })) { w.set(c[0], c[1], c[2], was); return false; }
    remeshAt(c[0], c[2]);
    return true;
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
  // up at), as the hologram, and with the sight up (as from his eyes: a lob is aimed high; the farthest throw is aimed
  // 39.5 deg up), to nearly straight up and down.
  function clampPitch(p) { return space ? clampV(p, -1.2, 1.2) : court ? (court.scope ? clampV(p, -1.2, 1.2) : clampV(p, TP_DOWN, TP_UP)) : !Hd && !onStone && !sight.up ? clampV(p, TP_DOWN, TP_UP) : clampV(p, -1.5, 1.5); }
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
    // the sky closes from (treeSpot); stepping off, it rises out over his head again. With the sight up the sight's
    // camera stands there instead; lowered there, his eyes again.
    var stone = !!(!Hd && !sight.up && !intro && !launched && (stoneAt() || treeSpot()));
    if (stone !== onStone) {
      onStone = stone;
      if (!Hd) { blend = { from: camLast, t0: now, dur: T_VIEW, pitchFrom: P.pitch, pitchTo: stone || sight.up ? null : clampV(P.pitch, TP_DOWN, TP_UP) }; camD = 1e9; }
    }
    var c = intro ? firstCam(eyeH) : launched ? (ride ? rideCam() : firstCam(eyeH)) : Hd ? holoCam(dt) : sight.up ? sightCam(dt) : onStone ? firstCam(EYE) : thirdCam(dt);
    if (blend && !intro) {
      // (a blend held at s for a photograph, holdView, never ends)
      var s = blend.hold != null ? blend.hold : smooth((now - blend.t0) / 1000 / blend.dur), f = blend.from, a = c.from || c.e;
      if (blend.pitchTo != null) { P.pitch = blend.pitchFrom + (blend.pitchTo - blend.pitchFrom) * s; c.pitch = P.pitch; }
      c = { e: [0, 1, 2].map(function (k) { return f.e[k] + (c.e[k] - f.e[k]) * s; }), yaw: f.yaw + angle(c.yaw - f.yaw) * s, pitch: f.pitch + (c.pitch - f.pitch) * s };
      // On the way the camera keeps out of the blocks as the view's own does: drawn in toward what it follows.
      if (boxSolid(c.e[0], c.e[1], c.e[2], R_C)) {
        var bv = [c.e[0] - a[0], c.e[1] - a[1], c.e[2] - a[2]], bl = hypot(bv[0], bv[1], bv[2]);
        if (bl > 1e-6) { var bd = clearTo(a, [bv[0] / bl, bv[1] / bl, bv[2] / bl], bl); c.e = [a[0] + bv[0] / bl * bd, a[1] + bv[1] / bl * bd, a[2] + bv[2] / bl * bd]; }
      }
      if (s >= 1 && blend.hold == null) { blend = null; }
    }
    var hc = Hd ? [Hd.x, Hd.y, Hd.z] : seat(), far = hypot(c.e[0] - hc[0], c.e[1] - hc[1], c.e[2] - hc[2]) > HAT_REACH + R_C;
    var bc = seat(), farB = hypot(c.e[0] - bc[0], c.e[1] - bc[1], c.e[2] - bc[2]) > HAT_REACH + R_C;
    // (with the sight up the head is the glass from the raise's half: not drawn, the window drawn in its place)
    drawMe = { body: !intro && !launched && (Hd ? true : !onStone || !!blend) && farB, head: !intro && !launched && (Hd ? true : !onStone || !!blend) && far && !(sight.up && sightEase(now) >= 0.5) };
    camLast = c;
    return c;
  }
  // Third person: the camera comes round behind him as he walks, in the time he walks its distance from his head,
  // by the forward part of the stick (walking sideways or back to the camera does not swing it), not while you drag,
  // and not with the sight up: then the camera is the aim.
  function follow(dt, c, face) {
    if (Hd || sight.up || input.looking || c.fwd <= 0 || !(c.fwd || c.side)) { return; }
    P.yaw += angle(face - P.yaw) * (1 - Math.exp(-dt * c.fwd * WALK / TP_HEAD));
  }

  /* ---- the hologram and back; its flight; the body following it, harmed ----------------------------------- */

  // One button (and H) between the hologram and third person (artist, 21 Oct 2026: "Get rid of first person view as
  // an option, just have one button that toggles between holographic view and third person view"): the head goes
  // out; out, the body follows it, and the view is third person again.
  function toggleHolo() {
    if (intro || launched || ignite || !place || court) { return; }
    if (Hd) { bringBody(); } else { enterHolo(); }
  }
  function enterHolo() {
    if (Hd || flying) { return; }
    if (holoLeft < BAR) { say("The hologram is gathering again: " + Math.ceil(BAR - holoLeft) + " s."); return; }
    dropSight();   // the hologram has no sight: going out with it up lowers it at once
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
    // Riding a guard (the artist, 26 Oct 2026: "I want to be able to ride the giant who walks around": next to the
    // hologram, which is his head, a guard is a giant): the head on its hat as it walks its round; the stick held a
    // moment after getting on takes it off.
    if (Hd.on) {
      var rg = Hd.on;
      if (guards.indexOf(rg) < 0 || (abs(c.fwd) + abs(c.side) + abs(c.up) > 0.3 && now - Hd.onAt > 600)) { Hd.on = null; Hd.offAt = now; Hd.vy = WALK; }
      else { seatOnGuard(); Hd.yaw = turnTo(Hd.yaw, P.yaw, TURN * dt); }
    }
    if (holoLeft <= HOLO_T / 10 && !Hd.warned) { Hd.warned = true; say(round(holoLeft) + " seconds left as the hologram; then your body follows your head."); }
    if (holoLeft <= 0) { bringBody("time"); return; }
    // Free in three dimensions: forward along the look (up and down with it), sideways, the jump to rise and
    // Shift or C to sink; through blocks, but not out of the place, below its floor, or over its ceiling.
    var f = lookDir(P.yaw, P.pitch), r = [Math.cos(P.yaw), 0, Math.sin(P.yaw)], V = inRoom(Hd.x, Hd.y - PEARL.headY, Hd.z) ? HOLO_V_IN : HOLO_V;
    var want = [f[0] * c.fwd + r[0] * c.side, f[1] * c.fwd + c.up, f[2] * c.fwd + r[2] * c.side], L = hypot(want[0], want[1], want[2]);
    if (L > 1) { want = want.map(function (q) { return q / L; }); }
    var k = 1 - Math.exp(-dt / T_LIFT), hr = PEARL.headR;
    Hd.vx += (want[0] * V - Hd.vx) * k; Hd.vy += (want[1] * V - Hd.vy) * k; Hd.vz += (want[2] * V - Hd.vz) * k;
    if (Hd.on) { return; }
    Hd.x = clampV(Hd.x + Hd.vx * dt, hr, w.SX - hr); Hd.y = clampV(Hd.y + Hd.vy * dt, 1 + hr, holoTop); Hd.z = clampV(Hd.z + Hd.vz * dt, hr, w.SZ - hr);
    Hd.yaw = turnTo(Hd.yaw, P.yaw, TURN * dt);
    // come down onto a guard's hat (not within a second of getting off one), it is ridden
    if (now - (Hd.offAt || -1e9) > 1000) { guards.forEach(function (g) { if (!Hd.on && hypot(Hd.x - g.x, Hd.z - g.z) < 0.45 && Hd.y > g.y + PEARL.headY && Hd.y < g.y + PEARL.top + 2 * hr) { mountGuard(g); } }); }
  }
  // the head on its guard's hat; again after the guards have walked, so it does not trail a frame behind
  function seatOnGuard() { var g = Hd.on; Hd.x = g.x; Hd.y = g.y + PEARL.top + PEARL.headR; Hd.z = g.z; Hd.vx = Hd.vy = Hd.vz = 0; }
  function mountGuard(g) {
    Hd.on = g; Hd.onAt = performance.now(); Hd.vx = Hd.vy = Hd.vz = 0;
    if (!Hd.rode) { Hd.rode = true; say("You ride a guard. Move to get off.", true); }
  }
  // The hologram's head taken to where a double tap points: the first thing the ray from the camera meets, out to
  // the far distance, the head stopped its radius short of it (the sky: 60 m along the ray); a guard there, it rides
  // it. Not swept on the way (headWas), so it takes no coin it jumps past.
  function teleportHead(px, py) {
    if (!Hd || Hd.phase !== "free" || !vp) { return; }
    var d = dirAt(px, py), hit = cast(d, FAR, eye, 0), g = guardAt(d, hit, FAR), hr = PEARL.headR, t = hit ? max(0, hit.t - hr - 0.05) : 60;
    headWas = null;
    if (g) { mountGuard(g); return; }
    Hd.on = null;
    Hd.x = clampV(eye[0] + d[0] * t, hr, w.SX - hr); Hd.y = clampV(eye[1] + d[1] * t, 1 + hr, holoTop); Hd.z = clampV(eye[2] + d[2] * t, hr, w.SZ - hr);
    Hd.vx = Hd.vy = Hd.vz = 0;
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
  function barred() { say("As the hologram you can look and read. To take, build, break or throw, leave the hologram (Holo, or H): your body follows your head."); }

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
     act.arms), and the upper body turns about the spine, as the walk turns it, made large (act.twist). The artist,
     21 Oct 2026: "The break animation by Mr Pearl has to be twice as fast and there should be 3 baseline variations
     of the animation that are randomly used. Give the animations more style, look at different hand combat styles
     of fighting (check out the game Mortal Combat)". So a tap to break starts a swing whose strike is half a beat
     later (an eighth note of the theme song, 125 a minute: SWING), in one of three styles taken at random, as
     Mortal Kombat: Deadly Alliance (2002) gave each fighter three styles:
       the sweep (Kitana's fan swipe, the broadsword's flat cut): the coil, half a SWING, a quarter turn to his right,
         the guitar raised as high as his head lets it; the downswing, half a SWING, from rest at the top at an even
         pull, so that at the strike his shoulders turn at two turns a beat;
       the slam (Jax's ground pound, the hammer fist): he springs up as the guitar goes up and comes down on the
         block as he lands, the strike the landing, the guitar driven on down to where it hangs;
       the spin (Kung Lao's spin): the guitar out at the block's height, his whole body turns a full turn from rest
         at an even pull and strikes as it comes round; his head stays on the block, as a dancer spots, his hips stop
         there and his shoulders carry on;
       at the strike the guitar's far end (the tail of its lower bout) comes onto the line from his feet to the
         block, at the block's height seen from his shoulders, as near as his arms go; the block breaks, its six bars
         fly; then the follow-through, half a SWING, and back to rest, half a SWING.
     A tap during a swing is kept (the latest only) and struck half a beat after this one's strike, swung back from
     where this one's follow-through ends: two blocks a beat. In a run of taps (each within a beat of the last) the
     blow goes on into the block behind the one struck: two a strike (strike). In water the swing goes at his speed
     there over his walk. Within REACH the blow breaks the block wherever it stands; a block a step ahead at his waist or his head
     the guitar meets. The guitar's path leaves a swoosh while it goes faster than he walks. */
  var BEAT = BAR / 4;            // a beat of the theme song
  var COIL = Math.PI / 2;        // the coil: a quarter turn of the upper body (see above: two turns a beat at the strike)
  var SWING = BEAT / 2;          // the swing's step: the strike half a beat after the tap ("twice as fast", 21 Oct 2026)
  var LEAP = 25 * SWING * SWING / 8;   // the slam's leap: up and down in its coil and downswing (SWING) at the game's 25 m/s/s
  var STYLES = ["sweep", "slam", "spin"];
  // From his form when it has come (smashFrom): the guitar's far end (its cell farthest from the shoulder line, in
  // the guitar's own cells), how far below level it hangs from that line (E0), the line's height over his feet at
  // his centre line (Y_SH), and the arms' highest (ARMS_UP). Until then, the values pearl-body.json gives.
  var FAR_END = null, E0 = 1.15486, Y_SH = 1.00155, ARMS_UP = 1.36101;
  var swing = null, swingNext = null, shards = [], shardProg = null, SHU = {}, GUITAR_MID = null, SWOOSH_C = [1, 0.71, 0.45], swoosh = [];
  function smashFrom(body) {
    var part = function (n) { return body.parts.filter(function (p) { return p.name === n && !p.empty; })[0]; };
    var J = body.joints || {};
    // A form without a guitar or its shoulders has no swing: a tap breaks at once, as before (smash).
    FAR_END = null;
    if (!J.shoulder_right || !J.shoulder_left || !J.spine || !part("guitar") || !part("arm_right") || !part("arm_left")) { return; }
    var PB = window.PearlBody, sR = J.shoulder_right.at, sL = J.shoulder_left.at;
    var ax = norm([sR[0] - sL[0], sR[1] - sL[1], sR[2] - sL[2]]), half = body.cell * Math.sqrt(3) / 2;
    var g = part("guitar"), M0 = PB.pose(body, 0, 0), best = -1;
    // the far end, and how far below level it hangs: its offset square to the shoulder line, seen along that line
    g.blocks.forEach(function (b) {
      var c = [b[0] + 0.5, b[1] + 0.5, b[2] + 0.5], p = apply(M0.guitar, c), d = [p[0] - sR[0], p[1] - sR[1], p[2] - sR[2]];
      var k = d[0] * ax[0] + d[1] * ax[1] + d[2] * ax[2], q = [d[0] - k * ax[0], d[1] - k * ax[1], d[2] - k * ax[2]], r = hypot(q[0], q[1], q[2]);
      if (r > best) { best = r; FAR_END = c; var up = norm([-ax[1] * ax[0], 1 - ax[1] * ax[1], -ax[1] * ax[2]]); E0 = -Math.atan2(q[0] * up[0] + q[1] * up[1] + q[2] * up[2], -q[2]); }
    });
    Y_SH = sR[1] - sR[0] / ax[0] * ax[1];
    // the swoosh: from the guitar's middle to its far end, in the far end's own colour (the rib's gold)
    GUITAR_MID = [g.dim[0] / 2, g.dim[1] / 2, g.dim[2] / 2];
    var fc = body.palette[g.ids[(floor(FAR_END[1]) * g.dim[2] + floor(FAR_END[2])) * g.dim[0] + floor(FAR_END[0])]];
    if (fc) { SWOOSH_C = [fc[0] / 255, fc[1] / 255, fc[2] / 255]; }
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
  // The swing's pose at u SWINGs, for pose(): { arms, twist, spin } in radians and { lift } in metres; null at rest.
  // The coil runs from u0 (0, or half way for a kept one, which starts from where the last one's follow-through
  // ended) to the top at 1/2; the leap and the spin run from u0 to the strike.
  function swingPose(s) {
    s = s || swing;
    if (!s) { return null; }
    var u = s.u, a, spin = 0, lift = 0, q, v = clampV((u - (s.u0 || 0)) / (1 - (s.u0 || 0)), 0, 1);
    if (s.ret) { q = smooth((u - 1.5) / 0.5); a = lerp2(s.from, [0, 0], q); spin = (s.spin || 0) * (1 - q); lift = (s.lift || 0) * (1 - q); }
    else {
      var st = s.style, side = st === "sweep" ? s.side * COIL : 0;
      // the top: the sweep's a quarter turn to the side, the slam's straight up the line, the spin's the strike's own
      var top = s.top || (st === "spin" ? s.hit : [ARMS_UP, s.hit[1] + side]);
      // where the follow-through ends: the sweep's and the spin's up on the other side, the slam's driven down through
      var other = st === "slam" ? [0, s.hit[1]] : [ARMS_UP, s.hit[1] - (st === "spin" ? s.side * COIL : side)];
      if (u < 0.5) { a = lerp2(s.from, top, smooth(u / 0.5)); }
      else if (u < 1) { q = (u - 0.5) / 0.5; a = lerp2(top, s.hit, q * q); }
      else if (u < 1.5) { q = (u - 1) / 0.5; a = lerp2(s.hit, other, q * (2 - q)); }
      else { a = lerp2(other, [0, 0], smooth((u - 1.5) / 0.5)); }
      // the leap's flight is the time from its start to the strike, so it lands on it; the spin, a whole turn the way
      // the downswing goes, from rest at an even pull (a whole turn is none: it starts and ends facing the block)
      if (st === "slam" && u < 1) { lift = 4 * LEAP * (1 - (s.u0 || 0)) * (1 - (s.u0 || 0)) * v * (1 - v); }
      if (st === "spin" && u < 1) { spin = s.side * 2 * Math.PI * (1 - v * v); }
    }
    return u >= 2 ? null : { arms: a[0], twist: a[1], spin: spin, lift: lift };
  }
  // A tap to break: a swing whose strike is half a beat away (SWING); during a swing (before its follow-through ends)
  // it is kept, the latest only, for half a beat after this one's strike; a second tap on what is already to be struck
  // does nothing. A quick tap (in a run) makes the strike of the swing on, and of the one it keeps or begins, break
  // two.
  function smash(hit, dir, quick) {
    var n = hit.prev ? [hit.prev[0] - hit.x, hit.prev[1] - hit.y, hit.prev[2] - hit.z] : [0, 0, 0];
    if (!hit.prev) { var k = abs(dir[0]) > abs(dir[1]) ? (abs(dir[0]) > abs(dir[2]) ? 0 : 2) : (abs(dir[1]) > abs(dir[2]) ? 1 : 2); n[k] = dir[k] > 0 ? -1 : 1; }
    var t = { x: hit.x, y: hit.y, z: hit.z, b: hit.b, n: n, hp: [eye[0] + dir[0] * hit.t, eye[1] + dir[1] * hit.t, eye[2] + dir[2] * hit.t],
              yaw: Math.atan2(hit.x + 0.5 - P.x, -(hit.z + 0.5 - P.z)), quick: !!quick };
    if (!me3 || !FAR_END) { strike(t, true); return; }   // his body has not come: nothing to swing; it breaks at once, as before
    var same = function (a) { return !!a && a.x === t.x && a.y === t.y && a.z === t.z; };
    if (swing && !swing.ret && swing.u < 1.5) {
      if (quick) { swing.quick = true; }
      if (same(swingNext)) { swingNext.quick = swingNext.quick || t.quick; } else if (!(same(swing) && !swing.struck)) { swingNext = t; }
      return;
    }
    var now = swingPose() || { arms: 0, twist: 0 };
    t.u = 0; t.from = [now.arms, now.twist]; t.side = now.twist < -1e-3 ? -1 : 1;
    begin(t);
  }
  // (each swing's style at random, as asked; u0 where its clock starts)
  function begin(t) {
    t.struck = false; t.hit = [0, 0]; t.hit[0] = aimArms(t); t.hit[1] = aimTwist(t.hit[0]);
    // (a kept one, which has only half a SWING to its strike, takes the sweep or the slam: a whole turn in that time
    // would turn faster than the eye follows)
    t.u0 = t.u; t.style = STYLES[floor(Math.random() * (t.u0 ? 2 : STYLES.length))];
    swing = t;
  }
  // The one kept: its downswing begins where this one's follow-through ends (the sweep's top on the other side; the
  // slam's guitar hanging, so the next comes up from under, an uppercut), so it strikes half a beat after this one;
  // and standing, he goes on facing it after (what he reaches for, as a tap would have set).
  function chain() {
    var s = swing, t = swingNext, p = swingPose();
    swingNext = null;
    t.u = s.u - 1; t.side = -s.side; t.top = [p.arms, p.twist]; t.from = t.top;
    P.want = bearingTo(t);
    begin(t);
  }
  // The swing let go (the head leaves, he is put out, the sight is raised): nothing struck, nothing kept; the arms to
  // rest in half a SWING, and a spin or a leap back (the spin the shorter way round).
  function letGo() {
    var p = swingPose();
    swingNext = null;
    swing = p ? { ret: true, u: 1.5, from: [p.arms, p.twist], spin: angle(p.spin), lift: p.lift } : null;
  }
  // What he turns to while a swing is on: what it will strike, until it has; then what is kept for the next.
  function swingYaw() {
    if (!swing || swing.ret) { return null; }
    return swing.struck ? (swingNext ? bearingTo(swingNext) : null) : bearingTo(swing);
  }
  // His bearing to a block from where he stands now, so that walking during a swing he still turns to it.
  function bearingTo(s) { return Math.atan2(s.x + 0.5 - P.x, -(s.z + 0.5 - P.z)); }
  // Each frame: the swing's clock (in SWINGs; in water at SWIM / WALK, as his legs go there), the aim kept on the
  // block as he moves, the strike, the next kept one or the end.
  function swingStep(dt) {
    if (!swing) { return; }
    var s = swing;
    s.u = s.hold != null ? s.hold : s.u + dt / SWING * (P.wet ? SWIM / WALK : 1);
    if (!s.ret && !s.struck) {
      s.hit[0] = aimArms(s); s.hit[1] = aimTwist(s.hit[0]);
      if (s.u >= 1) { strike(s); }
    }
    if (!s.ret && s.u >= 1.5 && swingNext) { chain(); }
    else if (s.u >= 2) { swing = null; }
  }
  // The far end in the world at u SWINGs of the swing (his feet where they are now, facing as he faces).
  function farEndAt(s, u) {
    var PB = window.PearlBody, u0 = s.u;
    s.u = u; var a = swingPose(s); s.u = u0;
    var M = PB.pose(me3.body, PB.phaseStep(me3.body, 0, P.walked), P.amount, a);
    return apply(PB.place(M.guitar, P.x, P.y, P.z, P.face), FAR_END);
  }
  // The strike: what was tapped, if it is still there and still within his reach, breaks (a piece is found, not
  // smashed); else the swing was only a swing. In a run of taps (quick) the blow goes on into the block behind it,
  // through the face he struck, as the tap would (not bedrock, nor a wall a work hangs on), if it too is in reach.
  function strike(s, plain) {
    s.struck = true;
    var b = w.get(s.x, s.y, s.z), at = reachFrom();
    if (Hd || b !== s.b || hypot(s.hp[0] - at[0], s.hp[1] - at[1], s.hp[2] - at[2]) > REACH) { return; }
    var k = PIECE_IDS.indexOf(b);
    w.set(s.x, s.y, s.z, B.AIR);
    if (k >= 0) { collect(k); } else if (!plain) { burst(s, b); }
    remeshAt(s.x, s.z);
    s.broke = true;
    var c = [s.x - s.n[0], s.y - s.n[1], s.z - s.n[2]], b2 = w.get(c[0], c[1], c[2]);
    if (!s.quick || !w.SOLID[b2] || b2 === B.BEDROCK || hangsOn(c[0], c[1], c[2]) || hypot(c[0] + 0.5 - at[0], c[1] + 0.5 - at[1], c[2] + 0.5 - at[2]) > REACH) { return; }
    var k2 = PIECE_IDS.indexOf(b2);
    w.set(c[0], c[1], c[2], B.AIR);
    if (k2 >= 0) { collect(k2); } else if (!plain) { burst(Object.assign(Object.create(s), { x: c[0], y: c[1], z: c[2] }), b2, s.speed); }
    remeshAt(c[0], c[2]);
  }
  /* The block's six bars, as the figure has them, fly out of the face he struck, each the way it lies from the block's
     middle, at half the guitar's speed at the strike (the throw's bounce, e = 1/2: the mean of a perfect bounce and a
     dead stop), turning at a turn a beat (half his shoulders' turn at the sweep's strike); they fall as anything falls
     here (in water as he sinks), lie where they land on a block's top, and are gone a beat after the strike, on the
     song's next beat (one flying into a block's side is gone at once). */
  function burst(s, b, speed) {
    var v, n = s.n;
    if (speed != null) { v = speed / 2; }   // (a pearl's: half its speed)
    else { var e = 1 / 64, p1 = farEndAt(s, 1), p0 = farEndAt(s, 1 - e), dt = e * SWING / (P.wet ? SWIM / WALK : 1); v = hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) / dt / 2; }
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
      if (q.t >= (q.life || BEAT)) { return false; }
      if (q.lies) { return true; }
      if (q.free) { q.c = [q.c[0] + q.v[0] * dt, q.c[1] + q.v[1] * dt, q.c[2] + q.v[2] * dt]; q.turn += Math.PI / SWING * dt; return true; }
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
      q.turn += Math.PI / SWING * dt;
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
  /* The swoosh: the guitar's path over the last half SWING, a band from its middle to its far end in the far end's
     gold, fading back and to its middle, where the far end goes faster than he walks: the smear of animation (one arc
     for the frames a blow is too fast for) and the weapon trail of fighting games. None under reduced motion. Drawn
     with the pearls' trails, after everything opaque. */
  function swooshAt(M, now) {
    if (!GUITAR_MID || stillMotion.matches) { swoosh.length = 0; return; }
    // (after the swing it fades out over its half SWING; its speed is the guitar's against him, not his own walk,
    // jump or fall: r, the far end in his frame)
    if (swing) { var m = window.PearlBody.place(M.guitar, P.x, P.y, P.z, P.face); swoosh.push({ f: apply(m, FAR_END), c: apply(m, GUITAR_MID), r: apply(M.guitar, FAR_END), t: now }); }
    while (swoosh.length && swoosh[0].t < now - SWING * 500) { swoosh.shift(); }
  }
  function drawSwoosh(now) {
    if (swoosh.length < 2 || !trailProg) { return; }
    var pts = [];
    for (var i = 1; i < swoosh.length; i += 1) {
      var a = swoosh[i - 1], b = swoosh[i], dt = max(1e-3, (b.t - a.t) / 1000), sp = hypot(b.r[0] - a.r[0], b.r[1] - a.r[1], b.r[2] - a.r[2]) / dt;
      var k = smooth((sp - WALK) / WALK) * (1 - (now - b.t) / (SWING * 500)) * 0.6;
      if (i === 1) { pts.push(a.f[0], a.f[1], a.f[2], 0, a.c[0], a.c[1], a.c[2], 0); }
      pts.push(b.f[0], b.f[1], b.f[2], max(0, k), b.c[0], b.c[1], b.c[2], 0);
    }
    gl.useProgram(trailProg);
    gl.uniformMatrix4fv(TU.uVP, false, vp); gl.uniform3f(TU.uC, SWOOSH_C[0], SWOOSH_C[1], SWOOSH_C[2]);
    gl.bindVertexArray(trailVao); gl.bindBuffer(gl.ARRAY_BUFFER, trailBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, pts.length / 4);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindVertexArray(null);
  }

  /* ---- the sight: his head, the one true sphere, as a reflex sight; and the pearls he throws ----------------------
     The artist, 20 Oct 2026: "I want you to be able to aim at a target with a reflex sight that I can control with my
     right finger while my left finger allows me to move around the area", and "And when I click with the reflex sight
     up, I am able to throw something".

     A reflex sight is a window of partly reflecting curved glass with a lit mark at the glass's focus: the mark's
     light comes back off the glass collimated, so the eye sees it at infinity, on the target wherever the eye is
     behind the window (parallax-free), both eyes open, no magnification. His head is the one thing in the game
     that can be that glass: the only perfect sphere (its front cap is an exact spherical mirror, focus R/2 inside
     it), and its skin is a thin film that partly reflects (pearl.glsl). Everything built of the unit would scatter
     the mark into its facets. So the mark is lit at the cap's focus and seen through the head itself; the window is
     the head's outline, the one outline that is the same from every point of view (the window keeps its shape
     however the camera sways). From over his hat (third person) the line through the screen's centre passes over his
     head, so raised, the camera comes down to the sight line (through the head's seat, along the look) at SIGHT_D
     behind it, in the time of a switch of view, and the head clears into the glass; he doffs his hat into his left
     glove (its brim, tilted back over the head seen from behind, would hood the window), raises his right arm with a
     pearl in the glove, and faces the mark. The hologram has no hands: no sight, no throw (barred, as breaking is).

     The mark: the artist's figure (the block's model seen down its diagonal, which is the drawing), its aim point
     the crux, the outline's undrawn apex, where the two outer bars would meet only from the one eye; hanging from
     the crux, the holding circles of the figure's own line of levels (F = 8, 13, 21: level 2, the drawing, and the
     two levels it is a corner of), every one touching the others at the crux (wf6/levels, ARNELL 1); on the crux, his
     nose, poched (noseMark), so the aim is a point you can see. The window
     holds the largest turned about the crux (the window's radius is its diameter), so the mark fits however it
     turns. Their feet are the holdover marks, labelled with the ranges the throw makes of them; the arc's landing
     is shown on the ground once the aim is still.

     What he throws is a pearl built of the unit: the solids study's first sphere (a unit is its if its centre lies
     within R = F(4) = 3 units of the middle), at his own level (phi^-7 m, the cells he is built of), 136 units in six
     bands (12 24 32 32 24 12), each band one of the film's tints of his pearl cloth: a pearl is laid down in layers,
     and the built sphere's layers are its bands. It is never the perfect sphere (that is his head alone), and it is
     2.38 times smaller than the head. Every number below from its relation. */
  var SIGHT_D = HOLO_D;          // the sight's camera behind the head's centre, on the look: the hologram's, the head top's height (phi)
  var SIGHT_F = [8, 13, 21];     // the holding circles: F(m+4) for levels 2, 3, 4 (ARNELL 1)
  var SIGHT_TMAX = Math.PI / 2 - Math.acos(1 / Math.sqrt(3));   // the most the figure opens: 35.26 deg, the crux's complement
  var U_BLK = 0.12244, APEX_SY = 0.45775;                        // the block model's drawing: u (block units), the apex above its centre
  // The film's edge (the sight's calc/film.py): ring q of the window meets the sphere at cos i = sqrt(1 - q^2); there the
  // colour of the light the film reflects, its alpha the film's reflectance (clear face on, bright grazing).
  var SIGHT_RIM = [[0, "224,0,255", 0.0032], [0.6, "255,173,0", 0.014], [0.8, "255,253,161", 0.041], [0.917, "213,255,253", 0.0965],
                   [0.98, "194,231,255", 0.2484], [0.995, "217,239,255", 0.4718], [1, "247,251,255", 0.8562]];
  var THROW = {
    V: Math.sqrt(25 * 34),        // its speed: the farthest throw (45 deg, level ground) is F(9) = 34 m on the game's 25 m/s/s
    G: 25,                        // the game's gravity (physics(): the fall is 25 m/s/s); no air, so no drag
    ZERO: REACH,                  // the arc comes level with the sight's line at his reach (6 m): within it the crux is what it meets
    FAR: 34,                      // the farthest throw, F(9): what the sight looks out to
    CARRY: 5,                     // a pearl for each finger of the throwing hand (his glove's four and the thumb)
    RU: 3,                        // its radius in units: F(4), the solids study's first sphere
    E: 0.5,                       // a bounce: the Average of a perfect bounce and a dead stop (the velocity mirrored, halved)
    SPIN: 2 * Math.PI / BEAT,     // backspin, as off the fingertips: a turn a beat of the song
    TRAIL: BEAT,                  // its trail: the last beat of its path
    SINK: 2.5, SINK_G: 6          // in water it sinks as he does: falling at 6 m/s/s, no faster than 2.5 m/s
  };
  var HOLD = null, HOLD_AT = [0.38536, 1.41552, -0.03399];       // the pearl in his raised glove: in the arm's cells; in his frame (throwFrom)
  var HAT_DOFF = [-0.82669, -0.64551, -0.35489];                 // the hat doffed: its right brim's edge into his left glove (throwFrom)
  var HAT_LIFT = 0.30925;                                        // lifted first, clear of the head: its top over the hat's lowest cell above it (throwFrom)
  var sight = { up: false, t0: -1e9, told: false, hold: null, omega: 0, mx: 0, my: 1, lastYaw: 0, lastPitch: 0, theta: 0, hit: null,
                arc: null, head: null, inHand: null, said: "", key: "", ring: null, thrown: -1e9, next: false, turn: null, flingHold: null, rmb: null, last: 0, feet: [], ringSaid: null, at: 0 };
  var figCache = {}, pearls = [], carried = THROW.CARRY, marked = {}, pearlCh = null, trailProg = null, TU = {}, trailBuf = null, trailVao = null;
  var LYING = 13, firsts = [], thrownN = 0;   // (firsts, thrownN: every pearl's first touch and the throws, for the tests)   // pearls without end (the artist, 26 Oct 2026: "I want infinite pearls to throw"); F(7) of them lie about at most
  function sightOn() { return sight.up && !intro && !launched && !Hd; }
  // How far up the sight is, 0 to 1, for the arm, the hat, the glass and the camera's blend: over a switch of view
  // (T_VIEW), eased; at once under reduced motion; held for a photograph (holdView).
  function sightEase(now) {
    var s = sight.hold != null ? sight.hold : stillMotion.matches ? 1 : smooth((now - sight.t0) / 1000 / T_VIEW);
    return sight.up ? s : 1 - s;
  }
  // The raised arm after a throw, about his shoulder line: down to the fore by the smash's quarter turn (COIL) over
  // half a beat with the smash's follow-through easing, q (2 - q), and back up over the other half, smooth. None under
  // reduced motion (the rate, one a beat, stays).
  function flingAt(now) {
    var u = sight.flingHold != null ? sight.flingHold : (now - sight.thrown) / 1000 / BEAT;
    if (stillMotion.matches || u < 0 || u >= 1) { return 0; }
    if (u < 0.5) { var q = u / 0.5; return -COIL * q * (2 - q); }
    return -COIL * (1 - smooth((u - 0.5) / 0.5));
  }
  // What his arms and upper body do now, for pose(): the swing's, the raised arm's and its fling (null at rest). The
  // fling goes as far as the arm is raised: lowered during one, the arm comes down from where it is and no further
  // (it had swung on past his guitar after the arm was down; 22 Oct 2026).
  function actNow(now) {
    var a = swingPose(), r = sightEase(now), f = flingAt(now) * r;
    if (!a && !r && !f) { return null; }
    return { arms: a ? a.arms : 0, twist: a ? a.twist : 0, spin: a ? a.spin : 0, lift: a ? a.lift : 0, right: r, fling: f };
  }
  // The window's half-angle, nominal: the head's outline seen from SIGHT_D, and the focal plane's measure of it.
  function sightTan() { return PEARL.headR / Math.sqrt(SIGHT_D * SIGHT_D - PEARL.headR * PEARL.headR); }
  function sightU() { return sightTan() * Math.sqrt(3) / (2 * SIGHT_F[SIGHT_F.length - 1]); }   // u in tangent units
  // Raise (true), lower (false) or turn over (nothing): a switch of view, in its time, as the views' are (none under
  // reduced motion). The hologram has no sight (barred, as breaking is). Raised, a swing is let go: his hands leave the
  // guitar's swing to raise a pearl.
  function raiseSight(on) {
    if (court) { courtScope(on); return; }   // (on the courts the Scope is theirs: courtScope)
    if (on == null) { on = !sight.up; }
    if (on === sight.up || intro || launched || ignite || !place || (on && court)) { return; }
    if (on && Hd) { barred(); return; }
    var now = performance.now(), still = stillMotion.matches;
    if (on) { letGo(); P.want = null; sight.at = now; closeLabel(); }
    // turned over part way, the arm and the hat go back from where they are (smooth(1 - u) = 1 - smooth(u))
    var u0 = clampV((now - sight.t0) / 1000 / T_VIEW, 0, 1);
    sight.up = on; sight.t0 = now - (1 - u0) * T_VIEW * 1000; sight.next = false; sight.turn = null; sight.arc = null; sight.said = ""; sight.key = "";
    sight.lastYaw = P.yaw; sight.lastPitch = P.pitch; sight.omega = 0; sight.theta = 0;
    camD = 1e9;
    blend = still ? null : { from: camLast, t0: now, dur: T_VIEW, pitchFrom: P.pitch, pitchTo: on ? null : clampV(P.pitch, TP_DOWN, TP_UP) };
    // Under reduced motion a cut: lowered, the look comes back within third person's at once (not on a stone of the
    // homage or where you woke, where the view is his eyes again and they look as far as they go); and there the
    // stone's own blend is not made either, raised or lowered (camera() would make one as the stone comes and goes;
    // 22 Oct 2026)
    if (still) {
      var eyes = !on && !!(stoneAt() || treeSpot());
      if (!on && !eyes) { P.pitch = clampV(P.pitch, TP_DOWN, TP_UP); }
      onStone = eyes;
    }
    if (on) { document.body.dataset.sight = "true"; } else { delete document.body.dataset.sight; }
    $("v-sight").setAttribute("aria-pressed", String(on));
    if (on && !sight.told) { sight.told = true; say(byTouch() ? "The scope: your head is the glass, your nose the aim. Drag to aim, or hold a point to bring it to the mark; tap to throw a pearl." : "The scope: your head is the glass, your nose the aim. Drag or the arrows aim; a click, T or Enter throws a pearl.", true); }
    drawCarry();
  }
  // At once (the head leaving, coming to, the launch): no blend, the arm and the hat back as they rest, no fling.
  function dropSight() {
    if (!sight.up) { return; }
    sight.up = false; sight.t0 = -1e9; sight.thrown = -1e9; sight.next = false; sight.turn = null;
    delete document.body.dataset.sight; $("v-sight").setAttribute("aria-pressed", "false"); drawCarry();
  }
  // The right mouse button: pressed, the sight comes up; let go after a beat or more it goes down (held, it is up
  // while held); let go within a beat it stays up (a click), and the next click lowers it.
  function sightPress() { if (ignite) { return; } if (Hd) { barred(); return; } var up = court ? !!court.scope : sight.up; sight.rmb = { t: performance.now(), was: up }; if (!up) { raiseSight(true); } }
  function sightRelease() { var r = sight.rmb; sight.rmb = null; if (r && (r.was || performance.now() - r.t >= BEAT * 1000)) { raiseSight(false); } }
  // The sight's camera: on the line through the head's seat along the look, SIGHT_D behind it, kept out of blocks
  // and let out no faster than he walks, as third person's is.
  function sightCam(dt) {
    var c = seat(), d = lookDir(P.yaw, P.pitch), u = [-d[0], -d[1], -d[2]];
    camD = min(clearTo(c, u, SIGHT_D), camD + WALK * dt);
    return { e: [c[0] + u[0] * camD, max(1 + R_C, c[1] + u[1] * camD), c[2] + u[2] * camD], yaw: P.yaw, pitch: P.pitch, from: c };
  }
  // Held still on a point for a beat (the way to aim that does not drag, WCAG 2.5.7): that point comes to the mark in
  // the time of a switch of view. The point is what the ray through it meets, out to the farthest throw; the look is
  // turned so that the line through the head's centre passes it, so it is under the crux at any distance (sightStep
  // turns toward it from where his head is each frame, so it comes to the mark while he walks too).
  function sightAimAt(x, y) {
    if (!sightOn() || !vp) { return; }
    var d = dirAt(x, y), at = reachFrom(), t0 = max(0, (at[0] - eye[0]) * d[0] + (at[1] - eye[1]) * d[1] + (at[2] - eye[2]) * d[2]);
    var hit = cast(d, t0 + THROW.FAR, eye, t0), t = hit ? hit.t : t0 + THROW.FAR, Q = [eye[0] + d[0] * t, eye[1] + d[1] * t, eye[2] + d[2] * t];
    var c = seat(), v = [Q[0] - c[0], Q[1] - c[1], Q[2] - c[2]], L = hypot(v[0], v[1], v[2]);
    if (L < 0.5) { return; }
    sight.turn = { t0: performance.now(), from: [P.yaw, P.pitch], Q: Q };
  }
  // A touch screen: one touched already, or whose pointer is a finger (the Sight button's press is not a touch of the
  // canvas, so a phone that raised the sight before it had touched the view was told to click; 21 Oct 2026).
  function byTouch() { return touchy || !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches); }
  // Ready to throw: the sight up, the arm up (the raise done) and a beat of the song since the last.
  function sightReady(now) { return sightOn() && sightEase(now) >= 1 && now - sight.thrown >= BEAT * 1000; }
  // A tap, a click, T or Enter with the sight up: the throw, at once if his arm is up and a beat has passed since the
  // last, else kept (the latest only) until it has, as a tap during a swing is kept.
  function throwAt() {
    if (Hd) { barred(); return false; }
    if (!sightOn()) { return false; }
    var now = performance.now();
    if (sightReady(now)) { return throwPearl(now); }
    sight.next = true;
    return true;
  }
  // Each frame, after the swing's: a hold come to a beat, the hold's turn, a kept throw when the arm is up.
  function sightStep(dt, now) {
    holdTick(now);
    var tr = sight.turn;
    if (tr) {
      var u = stillMotion.matches ? 1 : smooth((now - tr.t0) / 1000 / T_VIEW), c = seat(), v = [tr.Q[0] - c[0], tr.Q[1] - c[1], tr.Q[2] - c[2]], L = hypot(v[0], v[1], v[2]);
      if (L < 0.5) { sight.turn = null; }
      else {
        var yaw = Math.atan2(v[0], -v[2]), pitch = clampPitch(Math.asin(clampV(v[1] / L, -1, 1)));
        P.yaw = tr.from[0] + angle(yaw - tr.from[0]) * u; P.pitch = clampPitch(tr.from[1] + (pitch - tr.from[1]) * u);
        if (u >= 1) { sight.turn = null; }
      }
    }
    if (sight.next && sightReady(now)) { sight.next = false; throwPearl(now); }
  }
  // The look's turning speed, smoothed over T_LIFT (the time the hologram takes to start and stop), and the angle the
  // figure opens by: how far the aim would carry in that time, to at most the crux's complement (never under reduced
  // motion: the figure stays closed).
  function sightSettle(dt) {
    if (!dt) { return; }
    var dy = angle(P.yaw - sight.lastYaw), dp = P.pitch - sight.lastPitch, om = hypot(dy * Math.cos(P.pitch), dp) / dt;
    sight.lastYaw = P.yaw; sight.lastPitch = P.pitch;
    var k = 1 - Math.exp(-dt / T_LIFT);
    sight.omega += (om - sight.omega) * k;
    if (om > 1e-3) { var L = hypot(dy, dp); sight.mx += (dy / L - sight.mx) * k; sight.my += (dp / L - sight.my) * k; }
    sight.theta = stillMotion.matches ? 0 : min(SIGHT_TMAX, sight.omega * T_LIFT);
  }
  /* His nose, the aim (the artist, 23 Oct 2026: "Use his nose, as if looking transparently through his head and his nose
     is a small contour like a section cut that gets filled when poche-ing a wall in an architecture section, to
     establish a usable point to aim when firing or throwing something"). The covers paint him no nose, so it is where
     one would be: its bridge between his eyes, which lie on the head's equator, so on the sight's line, at the crux.
     Seen through the glass it is cut, as a wall is in a section, and the cut is poched: filled with the drawing's black
     inside the mark's two-tone contour, the one solid thing in the window. Its contour is the figure's own outline (an
     equilateral triangle of side F(6) = 8 u: level 2, the drawing) at level 0, side F(4) = 3 u, its apex the crux, so it
     fills the figure's undrawn apex down to where the figure opens; where it points is where a pearl goes, and in space
     the guns' shots. */
  function noseMark(c, cx, cy, u, hair) {
    var s = 3 * u, h = s * Math.sqrt(3) / 2;
    var path = function () { c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + s / 2, cy + h); c.lineTo(cx - s / 2, cy + h); c.closePath(); };
    c.fillStyle = "#1e1c1a"; path(); c.fill();
    twoTone(c, path, hair);
  }
  /* The figure, as the mark: the block's six bars (FIGURE) seen down the diagonal (the drawing), or turned off it by
     theta about an axis across the aim's motion, through the apex's line of sight; walked per pixel as blockMark is.
     Faces as light: white faces full, grey faces half (the drawing's tones as light), black faces the glass. */
  function figureMark(px, theta, mx, my) {
    var key = px + ":" + (theta < 0.004 ? 0 : (round(theta * 180 / Math.PI * 2) / 2) + ":" + round(Math.atan2(my, mx) * 8 / Math.PI));
    if (figCache[key]) { return figCache[key]; }
    var r2 = Math.SQRT2, r3 = Math.sqrt(3), r6 = Math.sqrt(6), v = [-1 / r3, -1 / r3, 1 / r3], up = [0, 1 / r2, 1 / r2], rt = [-2 / r6, 1 / r6, -1 / r6];
    if (theta >= 0.004) {
      var a = Math.atan2(my, mx), ax = [0, 1, 2].map(function (k) { return -Math.sin(a) * rt[k] + Math.cos(a) * up[k]; });
      var turn = function (q) {
        var c = Math.cos(theta), s = Math.sin(theta), d = ax[0] * q[0] + ax[1] * q[1] + ax[2] * q[2];
        var x = [ax[1] * q[2] - ax[2] * q[1], ax[2] * q[0] - ax[0] * q[2], ax[0] * q[1] - ax[1] * q[0]];
        return [0, 1, 2].map(function (k) { return q[k] * c + x[k] * s + ax[k] * d * (1 - c); });
      };
      v = turn(v); up = turn(up); rt = turn(rt);
    }
    var Cc = [0.65, 0.426, 0.576], Pc = [0, 1, 2].map(function (k) { return Cc[k] + [0, 1 / r2, 1 / r2][k] * APEX_SY; });
    var k = px / U_BLK, W = Math.ceil(1.3 * 8 * px), Hh = Math.ceil(1.15 * 8 * px), ox = W / 2, oy = Math.ceil(0.12 * 8 * px), S = 2;
    var cv = document.createElement("canvas"); cv.width = W; cv.height = Hh;
    var c2 = cv.getContext("2d"), img = c2.createImageData(W, Hh);
    for (var py = 0; py < Hh; py += 1) {
      for (var qx = 0; qx < W; qx += 1) {
        var lum = 0, cov = 0;
        for (var j = 0; j < S; j += 1) {
          for (var i = 0; i < S; i += 1) {
            var sx = (qx + (i + 0.5) / S - ox) / k, sy = -(py + (j + 0.5) / S - oy) / k;
            var o = [0, 1, 2].map(function (n) { return Pc[n] + rt[n] * sx + up[n] * sy - v[n] * 3; });
            var best = 1e9, axh = -1;
            for (var n = 0; n < FIGURE.length; n += 1) {
              var bx = FIGURE[n], tn = -1e9, tf = 1e9, at = 0;
              for (var m = 0; m < 3; m += 1) {
                if (abs(v[m]) < 1e-9) { if (o[m] < bx[m] || o[m] > bx[m + 3]) { tn = 1e9; } continue; }
                var t0 = (bx[m] - o[m]) / v[m], t1 = (bx[m + 3] - o[m]) / v[m], lo = min(t0, t1), hi = max(t0, t1);
                if (lo > tn) { tn = lo; at = m; }
                tf = min(tf, hi);
              }
              if (tn <= tf && tn < best) { best = tn; axh = at; }
            }
            if (axh >= 0) { cov += 1; lum += axh === 1 ? 1 : axh === 0 ? 0.5 : 0; }
          }
        }
        var q = (py * W + qx) * 4;
        // Light: the white and grey faces' light as white at their tone; the black faces leave the glass clear but
        // are kept as the drawing's black (the keyline below), so the figure reads on bright ground too.
        if (cov) { var L = lum / cov; img.data[q] = img.data[q + 1] = img.data[q + 2] = round(255 * L); img.data[q + 3] = round(255 * cov / (S * S) * (L > 0 ? 1 : 0.62)); }
      }
    }
    c2.putImageData(img, 0, 0);
    var out = { cv: cv, ox: ox, oy: oy };
    if (Object.keys(figCache).length > 60) { figCache = {}; }
    figCache[key] = out;
    return out;
  }
  // What the crux is on, out to the farthest throw: the ray from the camera begun where it passes him, measured from
  // him (as pick() measures); water, which the ray passes through, by its surface, since a throw comes down on it.
  function sightPick() {
    var d = lookDir(camLast.yaw, camLast.pitch), at = reachFrom();
    var t0 = max(0, (at[0] - eye[0]) * d[0] + (at[1] - eye[1]) * d[1] + (at[2] - eye[2]) * d[2]);
    var hit = cast(d, t0 + THROW.FAR, eye, t0);
    if (hit) { hit.r = hypot(eye[0] + d[0] * hit.t - at[0], eye[1] + d[1] * hit.t - at[1], eye[2] + d[2] * hit.t - at[2]); }
    var tw0 = t0, inW = w.get(floor(eye[0] + d[0] * t0), floor(eye[1] + d[1] * t0), floor(eye[2] + d[2] * t0)) === B.WATER;
    for (var tw = tw0; !inW && tw < (hit ? hit.t : t0 + THROW.FAR); tw += 0.05) {
      var qx = floor(eye[0] + d[0] * tw), qy = floor(eye[1] + d[1] * tw), qz = floor(eye[2] + d[2] * tw);
      if (w.get(qx, qy, qz) === B.WATER) { hit = { b: B.WATER, x: qx, y: qy, z: qz, t: tw, water: true }; hit.r = hypot(eye[0] + d[0] * tw - at[0], eye[1] + d[1] * tw - at[1], eye[2] + d[2] * tw - at[2]); break; }
    }
    return hit;
  }
  var MAT = {}; MAT[B.GRASS] = "Grass"; MAT[B.DIRT] = "Earth"; MAT[B.STONE] = "Stone"; MAT[B.ROAD] = "The road"; MAT[B.PAVE] = "Paving";
  MAT[B.WATER] = "Water"; MAT[B.LOG] = "A tree's trunk"; MAT[B.LEAVES] = "Leaves"; MAT[B.BRICK] = "Brick"; MAT[B.LIME] = "Limestone"; MAT[B.CONC] = "Concrete";
  MAT[B.GLASS] = "Glass"; MAT[B.SLATE] = "Slate"; MAT[B.SAND] = "Sand"; MAT[B.METAL] = "Metal"; MAT[B.SCORCH] = "Scorched ground"; MAT[B.RENDER] = "Render";
  MAT[B.LOOSE] = "Loose earth"; MAT[B.BEDROCK] = "Bedrock"; MAT[B.FLOOR] = "Floorboards"; MAT[B.PLASTER] = "Plaster";
  /* What the sight says of what it is on: its name, how far it is from him, what it came from, and the relation
     that put it there. Every line comes from the information the place was made of. */
  // a model's own material (ids 32 to 63): its name from the models' materials, as the place took it
  function ownMat(b) { var ms = w.mats || {}; for (var k in ms) { if (ms[k] === b) { return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "); } } return ""; }
  // How big a work hangs against its real size: place.js hangs it at 0.013 m to its centimetre (1.3 times: sizeIn), its
  // longest side no more than 3.2 m and its shortest no less than 0.45 m, and smaller where its wall has no room
  // (its scale); a work whose size is not recorded hangs 0.9 m by 0.7.
  function sizeSaid(p) {
    var real = p.f.wcm ? p.f.wcm / 100 : 0, k = real ? (p.u1 - p.u0) / real : 0, pct = round(k * 100);
    if (!k) { return "its size not recorded, hung " + (p.u1 - p.u0).toFixed(1) + " m wide"; }
    if (p.scale < 1) { return "at " + pct + " % of its real size, the most its wall leaves room for"; }
    if (abs(k - 1.3) < 0.005) { return "at 1.3 times its real size"; }
    return "at " + pct + " % of its real size, " + (k < 1.3 ? "its longest side no more than 3.2 m" : "its shortest side no less than 0.45 m");
  }
  function sightInfo(hit) {
    if (!hit) { return { name: "Nothing within the throw", sub: "Out past " + THROW.FAR + " m, the farthest throw (on level ground, F(9))", kind: "none" }; }
    var m = round(hit.r) + " m", wr = place.wreck;
    if (hit.painting) {
      var p = hit.painting, f = p.f, raw = rawOf(p);
      return { kind: "work", name: f.title || "Untitled", sub: [f.artist, raw.date].filter(Boolean).join(", ") + " · " + m, read: hit.r <= LOOK,
               from: "One of the works he saved on Artsy, hung in " + (p.room && p.room.name ? lower(p.room.name) : "the place") + " by the adventure's number",
               rel: sizeSaid(p) + (looked[f.id] ? "; you have looked behind it" : "") };
    }
    var k = PIECE_IDS.indexOf(hit.b);
    if (k >= 0) { var pc = adv.pieces[k]; return { kind: "piece", name: pc.name, sub: m + (hit.r <= REACH ? " · within reach" : ""), from: "A piece of your rocket", rel: "put " + ({ roof: "on a roof", park: "in the ground of a park", water: "under the water", tree: "in a tree's top", work: "behind a work", pool: "in the pool", garden: "in the ground of the garden", paving: "under the paving of a square" }[pc.how || pc.hide.type] || "here") + " by the adventure's rule" }; }
    if (hit.b === B.NOTE) { return { kind: "note", name: "A note", sub: m + (hit.r <= REACH ? " · within reach" : ""), from: "A clue made from what the works really are", rel: "the fewest facts that leave only one work" }; }
    var hl = window.Homage && homage ? Homage.label(homage, hit.x, hit.y, hit.z) : "";
    if (hl) { return { kind: "block", name: hl, sub: m, from: "The homage where you woke", rel: "three figures set across the turn you make on waking" }; }
    var sl = window.Homage && studies ? Homage.label(studies, hit.x, hit.y, hit.z) : "";
    if (sl) { return { kind: "block", name: sl, sub: m, from: "The unit's studies, beside your tree", rel: "each the result of one study of the block every place is built of" }; }
    if (wr && abs(hit.x - wr.x) <= 2 && abs(hit.z - wr.z) <= 2 && abs(hit.y - wr.y) <= 4) { return { kind: "wreck", name: built ? "The rocket, at your capsule" : "Your capsule, wrecked", sub: m, from: "Where you came down", rel: "the place's crash, the one open ground its lots leave round it" }; }
    var pa = Pl.partAt(place, hit.x, hit.y, hit.z), name = pa ? partText(pa) : "", mat = MAT[hit.b] || BLOCKS[hit.b] || ownMat(hit.b) || "A block";
    return { kind: "block", name: name || mat, sub: (name ? mat + " · " : "") + m + (hit.r <= REACH ? " · within reach to break" : ""),
             from: pa && pa.from ? "A section of " + Fm.the(pa.from) + ", taken apart and put together again" : place.kind === "city" ? "The city's ground, from its map" : "The ground round " + setting.name,
             rel: pa && pa.lot ? "in the lot of " + pa.lot.name + ", cells of a like height gathered" : "a metre to the block" };
  }
  // A point of the world on the HUD (css px), or null behind the eye.
  function toScreen(p, W, H) {
    var q = [0, 0, 0, 0];
    for (var i = 0; i < 4; i++) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; }
    if (q[3] <= 0.05) { return null; }
    return [(q[0] / q[3] * 0.5 + 0.5) * W, (1 - (q[1] / q[3] * 0.5 + 0.5)) * H, q[3]];
  }
  function hull(pts) {
    pts = pts.filter(Boolean).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; });
    if (pts.length < 3) { return pts; }
    var cr = function (o, a, b) { return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); }, lo = [], hi = [];
    pts.forEach(function (p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) { lo.pop(); } lo.push(p); });
    pts.slice().reverse().forEach(function (p) { while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], p) <= 0) { hi.pop(); } hi.push(p); });
    return lo.slice(0, -1).concat(hi.slice(0, -1));
  }
  // A line of the mark: the drawing's white over its black, so that it reads on every ground (the floor against any
  // colour is 4.14 : 1, the sight's SIGHT.md section 2).
  function twoTone(c, path, lw) {
    c.lineJoin = "round"; c.lineCap = "round";
    c.strokeStyle = "rgba(0,0,0,0.78)"; c.lineWidth = lw * 3; path(); c.stroke();
    c.strokeStyle = "#ffffff"; c.lineWidth = lw; path(); c.stroke();
  }
  function outlineOf(hit, W, H) {
    var corners = [];
    if (hit.painting) {
      var p = hit.painting, e = 0.02;
      [[p.u0, p.y0], [p.u1, p.y0], [p.u1, p.y1], [p.u0, p.y1]].forEach(function (q) {
        corners.push(p.axis === "x" ? [p.plane + p.dir * e, q[1], q[0]] : [q[0], q[1], p.plane + p.dir * e]);
      });
      return corners.map(function (q) { return toScreen(q, W, H); });
    }
    var lo = [hit.x, hit.y, hit.z], hi = [hit.x + 1, hit.y + 1, hit.z + 1];
    for (var i = 0; i < 8; i += 1) { corners.push(toScreen([i & 1 ? hi[0] : lo[0], i & 2 ? hi[1] : lo[1], i & 4 ? hi[2] : lo[2]], W, H)); }
    return hull(corners);
  }
  // Each frame, over the view: the window (the head's outline, its film's edge), the frame, the mark, the target
  // lit with what it is, the holdover marks, and, the aim still, where the throw comes down. From the raise's half
  // (the head no longer drawn) it comes in as the head clears into glass.
  function drawSight(c, W, H, now) {
    var dt = sight.last ? min(0.05, (now - sight.last) / 1000) : 0; sight.last = now; sightSettle(dt);
    var tag = $("sight-tag"), e = sightEase(now);
    if (!sightOn() || !camLast || e < 0.5) {
      if (tag) { tag.hidden = true; }
      sight.hit = null;
      var to0 = $("toast"); if (to0 && to0.style.top) { to0.style.top = ""; to0.style.bottom = ""; }   // the toast back in its own place
      return;
    }
    var fade = smooth((e - 0.5) / 0.5), f = H / 2 / T35, cx = W / 2, cy = H / 2, u = sightU() * f, dpr = min(2, window.devicePixelRatio || 1), hair = 1;
    c.save(); c.globalAlpha = fade;
    // the window: the head's outline seen from the camera (its true distance: nearer, it is larger, as glass is)
    // (the posed head when the body was drawn this frame; else, the camera pulled in to the glass by a wall at his
    // back so that the body is not drawn, the head's seat; pressed into the head, the whole view)
    var hc = drawMe.body && sight.head ? sight.head : seat(), hs = toScreen(hc, W, H);
    var D = hypot(hc[0] - eye[0], hc[1] - eye[1], hc[2] - eye[2]), rw = D <= PEARL.headR ? hypot(W, H) : f * PEARL.headR / Math.sqrt(max(1e-4, D * D - PEARL.headR * PEARL.headR));
    var wx = hs ? hs[0] : cx, wy = hs ? hs[1] : cy;
    // the head clearing into glass: its median colour (the covers', HEAD_EXPO's) going out as the window comes in
    if (fade < 1) { c.globalAlpha = 1 - fade; c.fillStyle = "#b9aca9"; c.beginPath(); c.arc(wx, wy, rw, 0, Math.PI * 2); c.fill(); c.globalAlpha = fade; }
    // the film's edge: the light the film reflects at each ring's incidence (Fresnel: clear face on, bright grazing)
    var g = c.createRadialGradient(wx, wy, 0, wx, wy, rw);
    SIGHT_RIM.forEach(function (s) { g.addColorStop(s[0], "rgba(" + s[1] + "," + s[2] + ")"); });
    c.fillStyle = g; c.beginPath(); c.arc(wx, wy, rw, 0, Math.PI * 2); c.fill();
    // the frame, built of the unit: one ring of figures one of his cells tall (phi^-7 m at the head's distance),
    // alternating upright and point-reflected, as a built sphere's band is
    var fh = f * unitH() / max(D, 0.05), fwid = fh * 2 / Math.sqrt(3), N = max(8, 2 * round(Math.PI * (rw + fh / 2) / fwid));
    if (!sight.ring || sight.ring.px !== round(fh * dpr)) { sight.ring = { px: round(fh * dpr), cv: figure(max(6, round(fwid * dpr)), 2, [[236, 230, 220], [150, 146, 140], [30, 28, 26]]) }; }
    if (rw < hypot(W, H)) {
      for (var i = 0; i < N; i += 1) {
        var a = i / N * Math.PI * 2, flip = i % 2, rr = rw + fh * (flip ? 0.36 : 0.64);
        c.save(); c.translate(wx + Math.sin(a) * rr, wy - Math.cos(a) * rr); c.rotate(a + (flip ? Math.PI : 0));
        c.drawImage(sight.ring.cv, -fwid / 2, -fh / 2, fwid, fh); c.restore();
      }
    }
    // the mark, collimated: at the screen's centre whatever the camera does (the look is the sight's axis)
    SIGHT_F.forEach(function (F) {
      var r = F * u / Math.sqrt(3);
      twoTone(c, function () { c.beginPath(); c.arc(cx, cy + r, r, 0, Math.PI * 2); }, hair);
    });
    var fm = figureMark(round(u * dpr), sight.theta, sight.mx, sight.my);
    c.drawImage(fm.cv, cx - fm.ox / dpr, cy - fm.oy / dpr, fm.cv.width / dpr, fm.cv.height / dpr);
    noseMark(c, cx, cy, u, hair);
    // what the crux is on, then the arc a throw now would take (it heads for what the crux is on), a frame in three
    var hit = sightPick(), info = sightInfo(hit), gq = guardAt(lookDir(camLast.yaw, camLast.pitch), hit, THROW.FAR);
    sight.hit = hit;
    if (gq) { info = { kind: "guard", name: "A guard", sub: round(hypot(gq.x - P.x, gq.z - P.z)) + " m", from: guardWords(gq), rel: "" }; }
    if (!sight.arc || tick % 3 === 0) { sight.arc = predict(); }
    var arc = sight.arc;
    // the holdover marks: each circle's foot, and the range at which the arc comes down through its line
    var cam = { f: lookDir(camLast.yaw, camLast.pitch) };
    cam.r = [Math.cos(camLast.yaw), 0, Math.sin(camLast.yaw)];
    cam.u = [cam.r[1] * cam.f[2] - cam.r[2] * cam.f[1], cam.r[2] * cam.f[0] - cam.r[0] * cam.f[2], cam.r[0] * cam.f[1] - cam.r[1] * cam.f[0]];
    if (cam.u[1] < 0) { cam.u = cam.u.map(function (q) { return -q; }); }
    c.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace"; c.textBaseline = "middle";
    sight.feet = []; sight.ringSaid = null;
    // what the ring's words keep clear of: the figure and the feet's ranges (a line of the 11 px type, 14 px tall)
    var keep = [[cx - fm.ox / dpr, cy - fm.oy / dpr, cx - fm.ox / dpr + fm.cv.width / dpr, cy - fm.oy / dpr + fm.cv.height / dpr]];
    SIGHT_F.forEach(function (F, n) {
      var foot = 2 * F * u / Math.sqrt(3), want = -foot / f, rng = null;
      if (arc) {
        var prevT = null;
        for (var j = 0; j < arc.pts.length; j += 1) {
          var p = arc.pts[j], v = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], fz = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2];
          if (fz <= 0.5) { continue; }
          var ty = (v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2]) / fz;
          if (prevT != null && prevT > want && ty <= want) { rng = hypot(p[0] - P.x, p[2] - P.z); break; }
          prevT = ty;
        }
      }
      sight.feet.push(rng);
      var side = n % 2 ? -1 : 1, x0 = cx + side * 4, lab = rng != null ? round(rng) + " m" : "";
      twoTone(c, function () { c.beginPath(); c.moveTo(cx - u * 0.6, cy + foot); c.lineTo(cx + u * 0.6, cy + foot); }, hair);
      c.textAlign = side > 0 ? "left" : "right";
      c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.8)"; c.strokeText(lab, x0 + side * u * 0.8, cy + foot);
      c.fillStyle = "#ffffff"; c.fillText(lab, x0 + side * u * 0.8, cy + foot);
      if (lab) { var lw = c.measureText(lab).width, lx = x0 + side * u * 0.8; keep.push([side > 0 ? lx : lx - lw, cy + foot - 7, side > 0 ? lx + lw : lx, cy + foot + 7]); }
    });
    // the target: what the crux is on, lit
    if (hit) {
      var ol = outlineOf(hit, W, H);
      if (ol.length >= 3 && ol.every(Boolean)) {
        twoTone(c, function () { c.beginPath(); ol.forEach(function (q, i) { if (i) { c.lineTo(q[0], q[1]); } else { c.moveTo(q[0], q[1]); } }); c.closePath(); }, hair);
      }
    }
    // the aim steady (the figure closed), where the throw comes down: the holding circle of the block figure (0.98 / sqrt 3)
    // lying on the face the pearl first touches (a ring seen at elevation t is an ellipse, minor / major = sin t), and
    // how far that is from him; under reduced motion the figure never opens, so it is always shown
    var steady = stillMotion.matches ? 1 : 1 - smooth((sight.theta * 180 / Math.PI - 1) / 2);
    if (arc && arc.at && steady > 0.02) {
      var L = arc.at, n0 = L.n, t1 = abs(n0[1]) > 0.7 ? [1, 0, 0] : [0, 1, 0], tn = t1[0] * n0[0] + t1[1] * n0[1] + t1[2] * n0[2];
      t1 = norm([t1[0] - tn * n0[0], t1[1] - tn * n0[1], t1[2] - tn * n0[2]]);
      var t2 = [n0[1] * t1[2] - n0[2] * t1[1], n0[2] * t1[0] - n0[0] * t1[2], n0[0] * t1[1] - n0[1] * t1[0]];
      var Rl = 0.98 / Math.sqrt(3), ring = [], off = pearlR() - 0.01;
      var base = [L.x - n0[0] * off, L.y - n0[1] * off, L.z - n0[2] * off];   // the touch on the surface, a centimetre off it
      for (var s = 0; s <= 48; s += 1) { var aa = s / 48 * Math.PI * 2; ring.push(toScreen([0, 1, 2].map(function (k) { return base[k] + (t1[k] * Math.cos(aa) + t2[k] * Math.sin(aa)) * Rl; }), W, H)); }
      if (ring.every(Boolean)) {
        c.globalAlpha = fade * steady;
        twoTone(c, function () { c.beginPath(); ring.forEach(function (q, i) { if (i) { c.lineTo(q[0], q[1]); } else { c.moveTo(q[0], q[1]); } }); }, hair * 1.5);
        // its words over the ring, else under it, else beside it, wherever they first keep clear of the figure and the
        // feet's ranges (a landing near the crux had written them over the mark; 21 Oct 2026)
        var lt = "comes down " + round(hypot(L.x - P.x, L.z - P.z)) + " m", tw = c.measureText(lt).width, rx = [1e9, -1e9], ry = [1e9, -1e9];
        ring.forEach(function (q) { rx[0] = min(rx[0], q[0]); rx[1] = max(rx[1], q[0]); ry[0] = min(ry[0], q[1]); ry[1] = max(ry[1], q[1]); });
        var my = (ry[0] + ry[1]) / 2, mx = (rx[0] + rx[1]) / 2, best = null;
        [[mx, ry[0] - 10], [mx, ry[1] + 10], [rx[1] + 8 + tw / 2, my], [rx[0] - 8 - tw / 2, my]].forEach(function (q) {
          var b = [q[0] - tw / 2 - 2, q[1] - 7, q[0] + tw / 2 + 2, q[1] + 7], over = 0;
          keep.forEach(function (k) { over += max(0, min(b[2], k[2]) - max(b[0], k[0])) * max(0, min(b[3], k[3]) - max(b[1], k[1])); });
          if (!best || over < best.over) { best = { at: q, over: over }; }
        });
        c.textAlign = "center"; c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.8)"; c.strokeText(lt, best.at[0], best.at[1]); c.fillStyle = "#fff"; c.fillText(lt, best.at[0], best.at[1]);
        sight.ringSaid = { text: lt, at: best.at, over: best.over };
        c.globalAlpha = fade;
      }
    }
    // the words, as page text under the window (read by a screen reader as they change)
    if (tag) {
      var act = byTouch() ? "Tap to throw" : "Click, T or Enter to throw";
      var html = '<b>' + esc(info.name) + '</b><span>' + esc(info.sub || "") + '</span>' + (info.from ? '<span class="from">' + esc(info.from) + (info.rel ? ', ' + esc(info.rel) : '') + '</span>' : '') + '<span class="act">' + esc(act) + '</span>';
      if (sight.said !== html) { sight.said = html; tag.innerHTML = html; }
      // said aloud only when what it is on changes (or the glove empties), not at every metre
      var key = [info.name, info.from, info.rel, act].join(". ");
      if (sight.key !== key) { sight.key = key; $("sight-say").textContent = [info.name, info.sub, info.from && info.from + (info.rel ? ", " + info.rel : ""), act].filter(Boolean).join(". "); }
      // shown only on a character: a guard (the artist, 26 Oct 2026); what else the nose is on is said to a screen
      // reader only (sight-say)
      tag.hidden = !gq || !$("notes").hidden;
      // under the window, but never over the foot: at most the tag's own height above the foot's top, less the HUD's
      // 6 px gap (the views column's); pressed to the glass the window is the whole view, and the words then stand
      // just over the foot
      var ft = document.querySelector(".foot"), fTop = ft ? ft.getBoundingClientRect().top : H - 120;
      var tagTop = round(max(0, min(wy + rw + fh + 10, fTop - 6 - (tag.offsetHeight || 90))));
      tag.style.top = tagTop + "px";
      // a toast (what a pearl struck) stands where these words do, so while the sight is up it goes over the window,
      // 8 px clear of its frame, where the header and the arrow leave it room, else 6 px under the words (21 Oct 2026:
      // on a phone the words had covered the toast's first lines)
      var to = $("toast"), th = to ? to.offsetHeight || 40 : 0, over = wy - rw - fh - 8 - th, hd = 0;
      if (tag.hidden) { tagTop = round(wy + rw + fh + 10) - (tag.offsetHeight || 90) - 6; }
      [document.querySelector(".top"), $("near")].forEach(function (el) { if (el && !el.hidden) { hd = max(hd, el.getBoundingClientRect().bottom); } });
      var under = tagTop + (tag.offsetHeight || 90) + 6, at = over >= hd + 6 ? over : under + th <= H - 8 ? under : null;
      if (to) { to.style.top = at == null ? "" : round(at) + "px"; to.style.bottom = at == null ? "" : "auto"; }
    }
    c.restore();
  }
  function unitH() { return me3 ? me3.body.cell : Math.pow(PHI, -7); }
  function pearlR() { return THROW.RU * unitH(); }
  // The pearl's grid: 6 x 6 x 6 units, a band to each layer, the bands taking the film's tints of the pearl cloth
  // (his jacket's K = 8) in order up the pearl.
  function pearlGrid() {
    if (!me3 || !gl) { return; }
    var n = 2 * THROW.RU, ids = new Uint8Array(n * n * n), blocks = [], tint = me3.body.paletteIds.jacket || [1];
    for (var y = 0; y < n; y += 1) {
      for (var z = 0; z < n; z += 1) {
        for (var x = 0; x < n; x += 1) {
          var q = [x + 0.5 - THROW.RU, y + 0.5 - THROW.RU, z + 0.5 - THROW.RU];
          if (q[0] * q[0] + q[1] * q[1] + q[2] * q[2] > THROW.RU * THROW.RU) { continue; }
          var id = tint[min(tint.length - 1, floor((y + 0.5) / n * tint.length))];
          ids[(y * n + z) * n + x] = id; blocks.push([x, y, z, id]);
        }
      }
    }
    pearlCh = meshBlocks(blocks);
    pearlCh.tex = voxTexture(ids, n, n, n); pearlCh.n = n; pearlCh.units = blocks.length;
  }
  function initThrow() {
    trailProg = compile("#version 300 es\nlayout(location=0) in vec4 a; uniform mat4 uVP; out float vA; void main(){ vA = a.w; gl_Position = uVP * vec4(a.xyz, 1.0); }",
      "#version 300 es\nprecision mediump float; in float vA; uniform vec3 uC; out vec4 o; void main(){ o = vec4(uC, vA); }");
    TU.uVP = gl.getUniformLocation(trailProg, "uVP"); TU.uC = gl.getUniformLocation(trailProg, "uC");
    trailVao = gl.createVertexArray(); trailBuf = gl.createBuffer();
    gl.bindVertexArray(trailVao); gl.bindBuffer(gl.ARRAY_BUFFER, trailBuf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0); gl.bindVertexArray(null);
  }
  // From his form when it has come: where the pearl sits in his raised glove (the palm's centre and one pearl radius
  // on along the forearm: body.throwArm), in the arm's own cells and in his frame raised; and where the doffed hat goes
  // (its right brim's edge, the hat's half-width to his right of its middle, into his left glove's palm).
  function throwFrom(body, spec) {
    var PB = window.PearlBody, part = function (n) { return body.parts.filter(function (p) { return p.name === n && !p.empty; })[0]; };
    var arm = part("arm_right"), hat = part("hat"), ta = body.throwArm, h = body.cell, r = THROW.RU * h;
    HOLD = null;
    if (arm && ta) {
      var q = [ta.palm[0] + ta.fore[0] * r, ta.palm[1] + ta.fore[1] * r, ta.palm[2] + ta.fore[2] * r];
      HOLD = [(q[0] - arm.org[0]) / h, (q[1] - arm.org[1]) / h, (q[2] - arm.org[2]) / h];
      HOLD_AT = apply(PB.pose(body, 0, 0, { right: 1 }).arm_right, HOLD);
    }
    var palm = null; ((spec.form || {}).primitives || []).forEach(function (p) { if (p.part === "glove_left_palm") { palm = PB.toGame(p.c); } });
    if (hat && palm) {
      var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      hat.blocks.forEach(function (b) { for (var k = 0; k < 3; k += 1) { var v = hat.org[k] + (b[k] + 0.5) * h; lo[k] = min(lo[k], v); hi[k] = max(hi[k], v); } });
      HAT_DOFF = [palm[0] - hi[0], palm[1] - (lo[1] + hi[1]) / 2, palm[2] - (lo[2] + hi[2]) / 2];
      // how far up it must go to clear his head: the head's top over the lowest of the hat's cells standing over it
      var hc = body.head.centre, hr = body.head.radius, low = 1e9;
      hat.blocks.forEach(function (b) { var x = hat.org[0] + (b[0] + 0.5) * h, z = hat.org[2] + (b[2] + 0.5) * h; if (hypot(x - hc[0], z - hc[2]) < hr + h) { low = min(low, hat.org[1] + b[1] * h); } });
      if (low < 1e9) { HAT_LIFT = max(0, hc[1] + hr - low); }
    }
  }
  // The hat doffed while the head is the glass, in his frame, as a hat is taken off: lifted clear of his head over the
  // raise's first third (HAT_LIFT), out to his left over the second, down into his left glove over the last, so that
  // it never passes through his head or his body on the way (straight there, it went through both; slid out at the
  // head's height, as it was until 22 Oct 2026, more of it went into the head than sits round it at rest: 216 of its
  // cells to 136; its brim meets only the guitar's neck, in the glove that holds both) (null at rest).
  function hatOff(now) {
    var e = sightEase(now);
    if (!e) { return null; }
    var up = smooth(3 * e), out = smooth(3 * e - 1), down = smooth(3 * e - 2);
    return [HAT_DOFF[0] * out, HAT_LIFT * up * (1 - down) + HAT_DOFF[1] * down, HAT_DOFF[2] * out];
  }
  // Where the pearl leaves: in his raised glove (the arm up, no fling), his walk's bob and turn as they are now.
  function handAt() {
    if (!me3 || !HOLD) { var c = Math.cos(P.face), s = Math.sin(P.face); return [P.x + HOLD_AT[0] * c - HOLD_AT[2] * s, P.y + HOLD_AT[1], P.z + HOLD_AT[0] * s + HOLD_AT[2] * c]; }
    var PB = window.PearlBody, body = me3.body, M = PB.pose(body, PB.phaseStep(body, 0, P.walked), P.amount, { right: 1 });
    return apply(PB.place(M.arm_right, P.x, P.y, P.z, P.face), HOLD);
  }
  // The launch: from his raised glove, at the pearl's one speed, on the lower arc that comes level with the sight's
  // line at the zero (ZERO from where the line passes him, as pick() measures), heading for what the mark is on (the
  // point on the line at tHit; at the farthest throw on nothing) so that it comes down on the mark's upright: his
  // glove stands 0.39 m right of the line (the arm cocked beside his head), and a heading kept parallel would put
  // every pearl that far right of the mark. His own walk with it: it is his hand that throws.
  function launchFrom(e, d, tHit) {
    var H = handAt(), at = reachFrom(), t0 = max(0, (at[0] - e[0]) * d[0] + (at[1] - e[1]) * d[1] + (at[2] - e[2]) * d[2]);
    // his glove beside a wall (the pearl reaches 0.49 m to his right, past his own box): it leaves from as near the
    // glove as is clear, toward his head's seat, which his box keeps clear (it had struck the wall at 0 m and come back)
    var sc = seat();
    for (var k = 0; k < 12 && sphereHit(H[0], H[1], H[2], pearlR()); k += 1) { H = [(H[0] + sc[0]) / 2, (H[1] + sc[1]) / 2, (H[2] + sc[2]) / 2]; }
    var A = [e[0] + d[0] * (t0 + THROW.ZERO), e[1] + d[1] * (t0 + THROW.ZERO), e[2] + d[2] * (t0 + THROW.ZERO)];
    var tt = tHit != null ? tHit : t0 + THROW.FAR, T = [e[0] + d[0] * tt, e[2] + d[2] * tt];   // the heading is level: x and z only
    var hx = T[0] - H[0], hz = T[1] - H[2], hl = hypot(hx, hz), ux = hl > 1e-6 ? hx / hl : Math.sin(P.yaw), uz = hl > 1e-6 ? hz / hl : -Math.cos(P.yaw);
    var x = (A[0] - H[0]) * ux + (A[2] - H[2]) * uz, y = A[1] - H[1], v = THROW.V, g = THROW.G, th;
    var disc = v * v * v * v - g * (g * x * x + 2 * y * v * v);
    if (x < 1e-6) { th = d[1] > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { th = disc >= 0 ? Math.atan2(v * v - Math.sqrt(disc), g * x) : Math.PI / 4; }
    var mv = [P.vx || 0, P.ground || P.wet ? 0 : (P.vy || 0), P.vz || 0];
    return { H: H, vel: [v * Math.cos(th) * ux + mv[0], v * Math.sin(th) + mv[1], v * Math.cos(th) * uz + mv[2]], th: th, yaw: Math.atan2(ux, -uz), A: A, mv: mv };
  }
  function throwPearl(now) {
    if (!sightOn() || !camLast || !eye) { return false; }
    var L = launchFrom(eye, lookDir(camLast.yaw, camLast.pitch), sight.hit ? sight.hit.t : null);
    sight.thrown = now; sight.arc = null; thrownN += 1;
    // the oldest lying gives way to the newest (none is picked up again: there are always more)
    while (pearls.length >= LYING) { var old = pearls.filter(function (q) { return q.state === "rest"; })[0] || pearls[0]; pearls.splice(pearls.indexOf(old), 1); }
    pearls.push({ x: L.H[0], y: L.H[1], z: L.H[2], vx: L.vel[0], vy: L.vel[1], vz: L.vel[2], yaw: L.yaw, spin: 0, state: "fly", t: 0, bounces: 0,
                  trail: [[L.H[0], L.H[1], L.H[2], 0]], age: 0, from: { H: L.H, vel: L.vel, th: L.th, A: L.A, mv: L.mv, eye: eye.slice(), yaw: camLast.yaw, pitch: camLast.pitch }, first: null, wet: false });
    drawCarry();
    return true;
  }
  // The pearl against the grid: the nearest point of every block its sphere could touch (the place's sides and
  // the bedrock as walls, the sky open); a note is a sheet, not a block, as for him (w.SOLID).
  function sphereHit(x, y, z, r) {
    var best = null, S = w.SOLID;
    for (var cy = floor(y - r); cy <= floor(y + r); cy += 1) {
      for (var cz = floor(z - r); cz <= floor(z + r); cz += 1) {
        for (var cx = floor(x - r); cx <= floor(x + r); cx += 1) {
          var solid = cx < 0 || cz < 0 || cx >= w.SX || cz >= w.SZ || cy < 0 ? true : cy >= w.SY ? false : !!S[w.get(cx, cy, cz)];
          if (!solid) { continue; }
          var qx = clampV(x, cx, cx + 1), qy = clampV(y, cy, cy + 1), qz = clampV(z, cz, cz + 1), dd = (x - qx) * (x - qx) + (y - qy) * (y - qy) + (z - qz) * (z - qz);
          if (dd < r * r && (!best || dd < best.dd)) { best = { dd: dd, cx: cx, cy: cy, cz: cz, n: [x - qx, y - qy, z - qz] }; }
        }
      }
    }
    return best;
  }
  // One pearl through dt: on its own parabola in steps no longer than the time in which the chord leaves the arc by
  // a bar of his unit (sqrt(8 x 0.1 h / g) = 0.033 s) nor than the time it takes to go half its radius (so it never
  // passes a block), the touch found by halving the step; then the bounce, the rest, the water.
  function stepPearl(p, dt, quiet) {
    var g = THROW.G, h = unitH(), r = THROW.RU * h, sub = Math.sqrt(8 * 0.1 * h / g), vRest = Math.sqrt(2 * g * h), left = dt, guard = 0;
    if (p.state === "rest") {
      // a rest is kept while something holds it up (a block broken under it lets it fall again, or in water sink on:
      // it had stayed where it lay, held up by nothing; 22 Oct 2026)
      if (!sphereHit(p.x, p.y - 0.02, p.z, r)) { p.state = "fly"; } else { return; }
    }
    while (left > 1e-7 && guard < 400) {
      guard += 1;
      var wet = w.get(floor(p.x), floor(p.y), floor(p.z)) === B.WATER;
      if (wet && !p.wet) { p.wet = true; if (!quiet) { struck(p, null, null, "water"); } }
      var sp = hypot(p.vx, p.vy, p.vz), step = min(left, sub, r / 2 / max(sp, 1e-6)), ay = wet ? -THROW.SINK_G : -g;
      var at = function (m) { return [p.x + p.vx * m, p.y + p.vy * m + 0.5 * ay * m * m, p.z + p.vz * m]; };
      var q = at(step), hit = sphereHit(q[0], q[1], q[2], r);
      if (!hit) {
        p.x = q[0]; p.y = q[1]; p.z = q[2]; p.vy += ay * step; p.t += step; left -= step;
        if (wet) { var s2 = hypot(p.vx, p.vy, p.vz); if (s2 > THROW.SINK) { p.vx *= THROW.SINK / s2; p.vy *= THROW.SINK / s2; p.vz *= THROW.SINK / s2; } }
        if (p.y < -2) { p.state = "rest"; break; }
        continue;
      }
      var lo = 0, hi = step;
      for (var i = 0; i < 16; i += 1) { var m = (lo + hi) / 2, qm = at(m); if (sphereHit(qm[0], qm[1], qm[2], r)) { hi = m; } else { lo = m; } }
      var q0 = at(lo), qh = at(hi), c = sphereHit(qh[0], qh[1], qh[2], r) || hit;
      p.x = q0[0]; p.y = q0[1]; p.z = q0[2]; p.vy += ay * lo; p.t += lo; left -= max(lo, 1e-5);
      var nl = hypot(c.n[0], c.n[1], c.n[2]), n = nl > 1e-9 ? [c.n[0] / nl, c.n[1] / nl, c.n[2] / nl] : (function () { var s = hypot(p.vx, p.vy, p.vz) || 1; return [-p.vx / s, -p.vy / s, -p.vz / s]; })();
      // A pearl breaks what it strikes (the artist, 26 Oct 2026: "When I throw a pearl at a surface, it should break that
      // surface. Although there should be special surfaces in which the pearl bounces back"): any block but those
      // bounces() keeps, its six bars flying as the smash's do, and the pearl is spent in it.
      // (one that has gone into water has lost its speed there: it comes down on the bottom and lies, as before)
      if (!quiet && !p.wet && !bounces(c)) { if (!p.first) { p.first = { x: p.x, y: p.y, z: p.z, t: p.t, n: n, cell: [c.cx, c.cy, c.cz], b: w.get(c.cx, c.cy, c.cz), broke: true, from: p.from }; firsts.push(p.first); } breakBy(p, c, n); p.state = "gone"; break; }
      // the first touch says what it struck; one that came down through water has said so already (it sinks)
      if (!p.first) { p.first = { x: p.x, y: p.y, z: p.z, t: p.t, n: n, cell: [c.cx, c.cy, c.cz], b: w.get(c.cx, c.cy, c.cz), from: p.from }; if (!quiet) { firsts.push(p.first); } if (!quiet && !p.wet) { struck(p, c, n); } }
      var vn = p.vx * n[0] + p.vy * n[1] + p.vz * n[2];
      if (vn < 0) { p.vx = THROW.E * (p.vx - 2 * vn * n[0]); p.vy = THROW.E * (p.vy - 2 * vn * n[1]); p.vz = THROW.E * (p.vz - 2 * vn * n[2]); }
      p.bounces += 1;
      if ((n[1] > 0.7 && -vn * THROW.E < vRest) || p.bounces > 60) { p.vx = p.vy = p.vz = 0; p.state = "rest"; if (!quiet) { rested(p); } break; }
    }
  }
  function stepPearls(dt) {
    pearls.slice().forEach(function (p) {
      var t0 = performance.now();
      stepPearl(p, dt, false);
      if (p.state === "gone") { pearls.splice(pearls.indexOf(p), 1); return; }
      p.spin += p.state === "rest" ? 0 : THROW.SPIN * dt;
      // the trail on its own clock, which runs on while it lies, so the last beat fades out after it lands (it had
      // stayed drawn and grown a point a frame for as long as it lay)
      p.age += dt;
      if (p.state !== "rest") { p.trail.push([p.x, p.y, p.z, p.age]); }
      while (p.trail.length && p.trail[0][3] < p.age - THROW.TRAIL) { p.trail.shift(); }
      p.ms = performance.now() - t0;
    });
  }
  function takeBack(p) {
    pearls.splice(pearls.indexOf(p), 1); carried = min(THROW.CARRY, carried + 1); drawCarry();
    say("A pearl back in your hand: " + carried + " of " + THROW.CARRY + ".", true);
  }
  // The surfaces a pearl comes back from: metal and limestone (the homage's strip and plinths, the studies'), the
  // bedrock and the place's edges, and a wall a work hangs on (the work keeps it). Everything else it breaks.
  function bounces(c) {
    if (c.cx < 0 || c.cz < 0 || c.cx >= w.SX || c.cz >= w.SZ || c.cy < 0) { return true; }
    var b = w.get(c.cx, c.cy, c.cz);
    return b === B.METAL || b === B.LIME || b === B.BEDROCK || hangsOn(c.cx, c.cy, c.cz);
  }
  // The block a pearl breaks: gone, a piece in it found, else its bars flying out of the face it struck at half the
  // pearl's speed (the bounce's e, as the smash's at half the guitar's).
  function breakBy(p, c, n) {
    var b = w.get(c.cx, c.cy, c.cz), k = PIECE_IDS.indexOf(b), ax = abs(n[0]) > abs(n[1]) ? (abs(n[0]) > abs(n[2]) ? 0 : 2) : (abs(n[1]) > abs(n[2]) ? 1 : 2), f = [0, 0, 0];
    f[ax] = n[ax] > 0 ? 1 : -1;
    w.set(c.cx, c.cy, c.cz, B.AIR);
    // a note lying on it comes down into its place
    if (w.get(c.cx, c.cy + 1, c.cz) === B.NOTE) {
      w.set(c.cx, c.cy + 1, c.cz, B.AIR); w.set(c.cx, c.cy, c.cz, B.NOTE);
      notes.forEach(function (q) { if (q.x === c.cx && q.y === c.cy + 1 && q.z === c.cz) { q.y = c.cy; } });
    }
    if (k >= 0) { collect(k); } else { burst({ x: c.cx, y: c.cy, z: c.cz, n: f }, b, hypot(p.vx, p.vy, p.vz)); }
    remeshAt(c.cx, c.cz);
  }
  // What the pearl struck, where it first touches, kept on it (p.first: a work, a note); no longer said (the artist,
  // 26 Oct 2026, wants words only for characters): the say below is this function's own, and quiet.
  function struck(p, c, n, what) {
    var say = function () {};
    var m = me(), dist = round(hypot(p.x - m.x, p.z - m.z)), up = p.y - m.y > 3 ? ", " + round(p.y - m.y) + " m up" : "";
    if (what === "water") { say("Your pearl sinks, " + dist + " m off: swim down to it."); return; }
    if (c.cx < 0 || c.cz < 0 || c.cx >= w.SX || c.cz >= w.SZ) { say("Your pearl struck the edge of " + setting.name + ", " + dist + " m off" + up + "."); return; }
    // a note is a sheet lying on the block under it: come down on that block's top, it falls on the note (at the
    // pearl's speed it rarely stays: it had said what lay under the note, and that only where it came to rest)
    if (n[1] > 0.5 && w.get(c.cx, c.cy + 1, c.cz) === B.NOTE) { p.first.note = true; say("Your pearl fell on a note, " + dist + " m off: go and read it."); return; }
    var b = w.get(c.cx, c.cy, c.cz);
    if (abs(n[1]) < 0.5) {
      var ax = abs(n[0]) > abs(n[2]) ? "x" : "z", nd = ax === "x" ? (n[0] > 0 ? 1 : -1) : (n[2] > 0 ? 1 : -1);
      var plane = ax === "x" ? (nd < 0 ? c.cx : c.cx + 1) : (nd < 0 ? c.cz : c.cz + 1), list = byPlane[ax + plane] || [], r = pearlR();
      var qx = p.x - n[0] * r, qy = p.y - n[1] * r, qz = p.z - n[2] * r, u = ax === "x" ? qz : qx;
      for (var i = 0; i < list.length; i += 1) {
        var pa = list[i];
        if (pa.dir === nd && u >= pa.u0 && u <= pa.u1 && qy >= pa.y0 && qy <= pa.y1) {
          var raw = rawOf(pa);
          p.first.work = pa.f.id;
          say("Your pearl struck " + (pa.f.title || "a work") + " (" + [pa.f.artist, raw.date].filter(Boolean).join(", ") + "), " + dist + " m off. Within " + LOOK + " m you can read its label and look behind it.");
          return;
        }
      }
    }
    var k = PIECE_IDS.indexOf(b);
    if (k >= 0 && found.indexOf(k) < 0) { marked[k] = true; say("Your pearl rang on a piece of your rocket: " + lower(adv.pieces[k].name) + ", " + dist + " m off" + up + ". Take it by hand.", true); return; }
    var tt = partText(Pl.partAt(place, c.cx, c.cy, c.cz));
    say("Your pearl struck " + (tt ? lower(tt) : STUFF[b] || "the building's own " + (b >= 32 ? "material" : "block")) + ", " + dist + " m off" + up + ".");
  }
  // What a block is, where it came from no section (the ground, the trees, the hand's blocks).
  var STUFF = {}; [["GRASS", "the lawn"], ["DIRT", "earth"], ["STONE", "stone"], ["ROAD", "the road"], ["PAVE", "paving"], ["LOG", "a trunk"], ["LEAVES", "leaves"],
    ["BRICK", "brick"], ["LIME", "limestone"], ["CONC", "concrete"], ["GLASS", "glass"], ["SLATE", "slate"], ["SAND", "sand"], ["METAL", "metal"], ["SCORCH", "the scorched ground of your wreck"],
    ["RENDER", "render"], ["LOOSE", "loose earth"], ["WHITE", "a white wall"], ["RED", "a red wall"], ["BEDROCK", "the bedrock"], ["FLOOR", "the floorboards"], ["PLASTER", "a gallery's plaster"]]
    .forEach(function (q) { if (B[q[0]] != null) { STUFF[B[q[0]]] = q[1]; } });
  function rested(p) {
    return;   // (no longer said: see struck)
    if (!(p.first && p.first.note) && w.get(floor(p.x), floor(p.y), floor(p.z)) === B.NOTE) { var m = me(); say("Your pearl lies on a note, " + round(hypot(p.x - m.x, p.z - m.z)) + " m off: go and read it."); }
  }
  // Tapping a pearl that lies within his reach, the sight lowered, takes it back (the ray from the camera, measured
  // from him as pick() is; its target its diameter doubled), if it lies nearer than what the tap meets: the block it
  // lies on, or a note it lies in, does not hide it (the lower half of its target had broken the floor under it).
  function takeTapped(dir, hit) {
    var at = reachFrom(), r = pearlR(), best = null;
    pearls.forEach(function (p) {
      if (p.state !== "rest") { return; }
      var o = [p.x - eye[0], p.y - eye[1], p.z - eye[2]], t = o[0] * dir[0] + o[1] * dir[1] + o[2] * dir[2];
      var dd = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - t * t;
      var seen = !hit || t < hit.t || hit.b === B.NOTE || (!hit.painting && hit.y + 1 <= p.y - r + 0.01);
      if (t > 0 && seen && dd < 4 * r * r && hypot(p.x - at[0], p.y - at[1], p.z - at[2]) <= REACH && (!best || t < best.t)) { best = { p: p, t: t }; }
    });
    if (best) { takeBack(best.p); return true; }
    return false;
  }
  // Drawn as his body is: through the place's own walk among the bars, his palette, the pixel's width in his unit;
  // turned by its spin about its heading's right. And one in his glove while his arm is raised, going up or coming
  // down (lowered, it had gone from the glove at once while the arm still came down; 22 Oct 2026), from the fling's
  // half beat (the next pearl in the fingers). Its trail, the last beat of its path, from half the pearl cloth's colour
  // over what lies behind (Colour Middling's Average) at the pearl to nothing a beat back.
  function drawPearls(now) {
    if (!pearlCh || !me3) { return; }
    var hand = sightEase(now) > 0 && carried > 0 && sight.inHand && now - sight.thrown >= BEAT * 500 ? sight.inHand : null;
    if (!pearls.length && !hand) { return; }
    var PB = window.PearlBody, h = unitH(), n = pearlCh.n / 2;
    gl.useProgram(prog);
    gl.uniform4fv(U.uPal, me3.pal);
    gl.uniform1f(U.uPx, pxW / h); gl.uniform2f(U.uNear, 0, 0);
    gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0);
    gl.uniform3i(U.uDim, pearlCh.n, pearlCh.n, pearlCh.n);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, pearlCh.tex); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(pearlCh.vao);
    var one = function (x, y, z, yaw, spin) {
      var m = PB.mul(PB.T(x, y, z), PB.mul(PB.RY(-yaw), PB.mul(PB.RX(spin), PB.mul(PB.S(h), PB.T(-n, -n, -n)))));
      gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
      gl.drawElements(gl.TRIANGLES, pearlCh.count, gl.UNSIGNED_INT, 0);
    };
    pearls.forEach(function (p) { one(p.x, p.y, p.z, p.yaw, p.spin); });
    if (hand) { one(hand[0], hand[1], hand[2], P.face, 0); }
    // the place's own again, as drawPearl leaves them, for whatever walks the place's grid after (the veil)
    gl.uniform4fv(U.uPal, worldPal); gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    gl.uniform1f(U.uPx, pxW); gl.uniform2f(U.uNear, NEAR_F[0], NEAR_F[1]); gl.uniform1i(U.uFloor, 1); gl.uniform3i(U.uDim, w.SX, w.SY, w.SZ);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }
  // The trails, after everything opaque and the veil (they write no depth, so what was drawn after had painted over
  // them), blended into the colour only: the canvas's own alpha is left whole, as the veil leaves it.
  function drawTrails() {
    var pts = [];
    pearls.forEach(function (p) {
      for (var i = 1; i < p.trail.length; i += 1) {
        var a = p.trail[i - 1], b = p.trail[i], fa = 0.5 * max(0, 1 - (p.age - a[3]) / THROW.TRAIL), fb = 0.5 * max(0, 1 - (p.age - b[3]) / THROW.TRAIL);
        if (fb <= 0) { continue; }
        pts.push(a[0], a[1], a[2], fa, b[0], b[1], b[2], fb);
      }
    });
    if (!pts.length || !trailProg) { return; }
    gl.useProgram(trailProg);
    gl.uniformMatrix4fv(TU.uVP, false, vp); gl.uniform3f(TU.uC, 0xb7 / 255, 0xa8 / 255, 0xa0 / 255);   // the jacket's own (#b7a8a0)
    gl.bindVertexArray(trailVao); gl.bindBuffer(gl.ARRAY_BUFFER, trailBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
    gl.drawArrays(gl.LINES, 0, pts.length / 4);
    gl.disable(gl.BLEND); gl.depthMask(true);
    gl.bindVertexArray(null);
  }
  // Where a throw now would first touch, by the same steps the pearl takes, and its path (for the holdover's ranges).
  function predict() {
    if (!camLast || !eye) { return null; }
    var L = launchFrom(eye, lookDir(camLast.yaw, camLast.pitch), sight.hit ? sight.hit.t : null), pts = [L.H.slice()];
    var q = { x: L.H[0], y: L.H[1], z: L.H[2], vx: L.vel[0], vy: L.vel[1], vz: L.vel[2], state: "fly", t: 0, bounces: 0, first: null, wet: false };
    for (var i = 0; i < 400 && !q.first && q.state === "fly" && !q.wet; i += 1) { stepPearl(q, 0.01, true); pts.push([q.x, q.y, q.z]); }
    return { L: L, pts: pts, at: q.first || (q.wet ? { x: q.x, y: q.y, z: q.z, t: q.t, n: [0, 1, 0], water: true } : null) };
  }
  // How many are in his glove, as page text in the header, while the sight is up or any pearl is out.
  function drawCarry() {
    var el = $("pearls");
    if (el) { el.hidden = true; }   // (pearls without end: nothing to count)
  }

  /* ---- the ten coins ---------------------------------------------------------------------------------------------
     The artist, 21 Oct 2026: "I want you to point coins like sonic the video game all through the space, inside and
     outside the architecture ... Make sure I am able to collect the coins in [either] the holographic mode or 3rd person
     mode and that you keep a tally of my coins ... have collecting all 10 coins equivalent to achieving building the
     rocket ship and blasting off into space—it's an alternative way of beating the game".
     Where the ten lie is place.js's rule (coins). A coin is his head's outline built of his cells, as a Sonic ring is a
     ring: flat, coinRO cells out (his head's radius in his unit: round(0.2457 / 0.0344) = 7), its hole a thrown
     pearl's (THROW.RU, 3, so a pearl passes through it), COIN.T cells thick (2, the step below the pearl's 3 on the
     ladder 1, 2, 3, 5), in the guitar rib's gold. All ten turn together once in two beats about the upright, edge on four
     times in two beats (4.2 a second would be a turn a beat, over the three flashes a second of WCAG 2.3.1; this is
     2.1), and stand still, face to the camera, under reduced motion. The body takes one its box passes through; the
     hologram one its head's sphere sweeps through (the line from where it was last frame to where it is, so that at
     22.5 m/s it does not fly past). Nothing is taken while the body follows the head, in the films or at the launch.
     The tally is page text in the header and in Notes; the tenth builds the rocket (ready, buildRocket). */
  var COIN = { N: 10, T: 2, SPIN: 2 }, coins = [], got = [], coinCh = null, headWas = null;
  function coinRO() { return round(PEARL.headR / unitH()); }
  function coinR() { return coinRO() * unitH(); }
  function coinGrid() {
    if (!me3 || !gl) { return; }
    var RO = coinRO(), RI = THROW.RU, n = 2 * RO, T = COIN.T, ids = new Uint8Array(n * n * T), blocks = [], id = (me3.body.paletteIds.rib || [1])[0];
    for (var y = 0; y < n; y += 1) {
      for (var z = 0; z < T; z += 1) {
        for (var x = 0; x < n; x += 1) {
          var r = hypot(x + 0.5 - RO, y + 0.5 - RO);
          if (r > RO || r < RI) { continue; }
          ids[(y * T + z) * n + x] = id; blocks.push([x, y, z, id]);
        }
      }
    }
    coinCh = meshBlocks(blocks);
    coinCh.tex = voxTexture(ids, n, n, T); coinCh.n = n; coinCh.units = blocks.length;
  }
  // The pieces found, or the ten coins taken: either builds the rocket.
  function ready() { return found.length === 4 || (coins.length > 0 && got.length >= coins.length); }
  function left() { return coins.filter(function (q) { return got.indexOf(q.id) < 0; }); }
  // A coin set where a block now stands (the homage's, the studies'): raised onto it.
  function seatCoins() {
    coins.forEach(function (q) {
      var x = floor(q.x), z = floor(q.z), y = q.kind === "pool" ? q.y - PEARL.headR : q.y - PEARL.headY;
      while (w.SOLID[w.get(x, floor(y), z)] && w.get(x, floor(y), z) !== B.LEAVES && y < w.SY - 3) { y += 1; q.y += 1; }
    });
  }
  function coinsStep() {
    if (!coins.length || intro || launched || (Hd && Hd.phase === "follow")) { headWas = null; return; }
    var R = coinR(), now = Hd && Hd.phase === "free" ? [Hd.x, Hd.y, Hd.z] : null, was = headWas || now;
    left().forEach(function (q) {
      var take = false;
      if (now) {
        // the head's sphere swept from where it was to where it is
        var d = [now[0] - was[0], now[1] - was[1], now[2] - was[2]], L2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        var t = L2 > 0 ? clampV(((q.x - was[0]) * d[0] + (q.y - was[1]) * d[1] + (q.z - was[2]) * d[2]) / L2, 0, 1) : 0;
        take = hypot(was[0] + d[0] * t - q.x, was[1] + d[1] * t - q.y, was[2] + d[2] * t - q.z) <= PEARL.headR + R;
      } else if (!Hd || Hd.phase === "lift") {
        // his box (boxHits' half width, feet to hat top)
        take = hypot(q.x - P.x, q.z - P.z) <= 0.3 + R && q.y >= P.y - R && q.y <= P.y + PEARL.top + R;
      }
      if (take) { takeCoin(q); }
    });
    headWas = now;
  }
  function takeCoin(q) {
    if (got.indexOf(q.id) >= 0) { return; }
    got.push(q.id);
    store();
    drawCoins();
    drawPieces();
    var n = got.length, rest = left();
    if (n < coins.length) { say("A coin, " + n + " of " + coins.length + ": " + q.text + "." + (rest.length === 1 ? " One left: " + rest[0].text + "." : ""), true); return; }
    if (built) { say("Every coin: the rocket already stands.", true); return; }
    buildRocket(true);
    say("The " + (coins.length === COIN.N ? "tenth" : "last") + " coin: the rocket stands on the wreck's ground. Launch when you are clear." + (Hd ? " Leave the hologram to launch: your body rides it." : ""), true);
  }
  // The tally, as page text in the header.
  function drawCoins() {
    var el = $("coins");
    if (el) { el.textContent = "Coins " + got.length + " of " + coins.length; el.hidden = !coins.length; }
  }
  // The coin a ray from the eye meets first, if nothing nearer stands in its way (hit, as pick gives it), within LOOK.
  function coinAt(dir, hit) {
    var R = coinR(), best = null;
    left().forEach(function (q) {
      var o = [q.x - eye[0], q.y - eye[1], q.z - eye[2]], b = o[0] * dir[0] + o[1] * dir[1] + o[2] * dir[2], c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - R * R, h = b * b - c;
      if (h < 0 || b < 0) { return; }
      var t = b - Math.sqrt(h), at = reachFrom();
      if ((hit && hit.t < t) || hypot(q.x - at[0], q.y - at[1], q.z - at[2]) > LOOK) { return; }
      if (!best || t < best.t) { best = { q: q, t: t }; }
    });
    return best && best.q;
  }
  function coinsLine() {
    var pool = coins.some(function (q) { return q.kind === "pool"; });
    var N = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"][coins.length] || String(coins.length);
    return N + " coins lie in and round " + setting.name + ": by its largest works, on the way in, on its highest roof, " + (pool ? "over its pool" : "on its grass") +
      " and on the crown of your tree. " + N + " build the rocket, as the four pieces do.";
  }
  function coinWords(q) { return upper(q.text) + ". A ring of the unit as wide as your head, its hole a pearl's. " + got.length + " of " + coins.length + " taken."; }
  function drawCoins3(now) {
    if (!coinCh || !me3) { return; }
    var list = left();
    if (!list.length) { return; }
    var PB = window.PearlBody, h = unitH(), n = coinCh.n / 2, a = stillMotion.matches ? (camLast ? camLast.yaw : 0) : 2 * Math.PI * now / (COIN.SPIN * BEAT * 1000);
    gl.useProgram(prog);
    gl.uniform4fv(U.uPal, me3.pal);
    gl.uniform1f(U.uPx, pxW / h); gl.uniform2f(U.uNear, 0, 0);
    gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0);
    gl.uniform3i(U.uDim, coinCh.n, coinCh.n, COIN.T);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, coinCh.tex); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(coinCh.vao);
    list.forEach(function (q) {
      if (abs(q.x - eye[0]) > FAR || abs(q.z - eye[2]) > FAR) { return; }
      var m = PB.mul(PB.T(q.x, q.y, q.z), PB.mul(PB.RY(-a), PB.mul(PB.S(h), PB.T(-n, -n, -COIN.T / 2))));
      gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
      gl.drawElements(gl.TRIANGLES, coinCh.count, gl.UNSIGNED_INT, 0);
    });
    // the place's own again, as drawPearls leaves them
    gl.uniform4fv(U.uPal, worldPal); gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    gl.uniform1f(U.uPx, pxW); gl.uniform2f(U.uNear, NEAR_F[0], NEAR_F[1]); gl.uniform1i(U.uFloor, 1); gl.uniform3i(U.uDim, w.SX, w.SY, w.SZ);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  /* ---- the guards -------------------------------------------------------------------------------------------------
     The artist, 21 Oct 2026: "Think of Mr Pearl like the golden snitch from harry potter right now, there are people
     trying to grab me, but additionally what's unique to Mr Pearl as the golden snitch is that he can collect these
     coins". The people are the guards the alarms already bring, now seen: one for each room on the ground floor the
     works hang in, three at most (place.js guards), each walking its round, the reading spots of its room's works, a
     beat at each. Each is built as he is, of his own grids in the drawing's grey (no guitar, no hat), its head a sphere
     of his cells: the one perfect sphere stays his. Every number is his or the song's:
       on the round at his walk over phi squared (1.64 m/s), chasing at his walk over phi (2.66 m/s): he outwalks them
         by phi, and the hologram outflies them;
       they see as far as a label is read (LOOK, 9 m), across the game's own view (FOV, 70 degrees), from his eye's
         height, the line to his head's seat clear (glass and leaves seen through);
       in reach, his box and its a step apart (0.3 + his leg + 0.3), their arms rise over a beat; still in reach at its
         end, they have hold of him: an alarm, and the last coin he took goes back where it lay (Sonic's ring loss, one
         ring); that guard stands a bar, and no guard grabs again within a bar (Sonic's two seconds of safety);
       the third alarm walks him out (putOut), coins and pieces kept;
       seen, they chase where he was last seen, and a bar unseen they go back to their rounds; where they cannot walk
         (water, two blocks up, off the plot) they stop and look at him; a wrong look behind a work sends them to it;
       while the head is out they watch the body, and a grab of the body puts him out under his tree.
     Their ways are place.js's field over the plot (stands), kept per target and cleared when a block there changes. */
  var GUARD = { ROUND: WALK / (PHI * PHI), CHASE: WALK / PHI, SIGHT: LOOK, HALF: FOV / 2 * Math.PI / 180, TELL: BEAT, HOLD: BAR, GRACE: BAR };
  var guards = [], gStand = null, gFields = {}, guardPal = null, guardHead = null, graceUntil = 0, warnedBody = false;
  function guardReach() { return 0.3 + PEARL.leg + 0.3; }
  function initGuards() {
    guards = []; gStand = null; gFields = {};
    if (!me3 || !place.M || !Pl.guards) { return; }
    gStand = Pl.stands(place);
    guards = Pl.guards(place, paintings, gStand).map(function (g, i) { return { i: i, room: g.round[0].work.room, round: g.round }; });
    homeGuards();
  }
  // Each at the start of its round, walking it (after waking, and when he is put out).
  function homeGuards() {
    graceUntil = 0; warnedBody = false;
    guards.forEach(function (g) {
      var r = g.round[0];
      Object.assign(g, { x: r.x + 0.5, y: gStand[r.z * w.SX + r.x], z: r.z + 0.5, face: 0, walked: 0, amount: 0, mode: "round", leg: 0, pause: 0, tell: 0, tellT: 0, holdT: 0, seenAt: -1e9, to: null });
    });
  }
  function fieldTo(x, z) {
    var key = x + "," + z;
    if (!gFields[key]) { if (Object.keys(gFields).length > 32) { gFields = {}; } gFields[key] = Pl.field(place, gStand, x, z); }
    return gFields[key];
  }
  // A block broken or set: the column's stand again, and every way worked out again.
  function guardsRemesh(x, z) {
    if (!gStand || x < 0 || z < 0 || x >= w.SX || z >= w.SZ) { return; }
    var c = z * w.SX + x, y = Pl.standIn(place, x, z);
    if (gStand[c] !== y) { gStand[c] = y; gFields = {}; }
  }
  // A step toward (tx, tz) at speed v: to the next column one step nearer, not one another guard stands in; true there.
  function walkTo(g, tx, tz, v, dt) {
    var SX = w.SX, F = fieldTo(tx, tz), cx = floor(g.x), cz = floor(g.z), c = cz * SX + cx, ease = 1 - Math.exp(-dt / STEP_T);
    var stop = function () { g.amount -= g.amount * ease; };
    if (F[c] < 0) { stop(); return false; }
    var nx = cx, nz = cz;
    if (F[c] > 0) {
      for (var i = 0; i < 8; i += 1) {
        var d = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]][i], X = cx + d[0], Z = cz + d[1], C = Z * SX + X;
        var s1 = gStand[cz * SX + X], s2 = gStand[Z * SX + cx];
        if (F[C] !== F[c] - 1 || abs(gStand[C] - gStand[c]) > 1 || (d[0] && d[1] && (s1 < 0 || s2 < 0 || abs(s1 - gStand[c]) > 1 || abs(s2 - gStand[c]) > 1 || abs(s1 - gStand[C]) > 1 || abs(s2 - gStand[C]) > 1))) { continue; }
        if (guards.some(function (o) { return o !== g && hypot(o.x - X - 0.5, o.z - Z - 0.5) < 0.9; })) { continue; }
        nx = X; nz = Z; break;
      }
      if (nx === cx && nz === cz) { stop(); return false; }
    }
    var dx = nx + 0.5 - g.x, dz = nz + 0.5 - g.z, L = hypot(dx, dz), step = min(L, v * dt);
    if (L < 0.05 && F[c] === 0) { stop(); return true; }
    if (L > 1e-6) { g.x += dx / L * step; g.z += dz / L * step; g.face = turnTo(g.face, Math.atan2(dx, -dz), TURN * dt); }
    g.walked += step; g.amount += (1 - g.amount) * ease;
    var sy = gStand[floor(g.z) * SX + floor(g.x)];
    if (sy >= 0) { g.y += (sy - g.y) * ease; }
    return false;
  }
  function guardsStep(dt, now) {
    if (!guards.length || intro || launched || ignite) { return; }
    var SX = w.SX, hx = floor(P.x), hz = floor(P.z), walkable = gStand[hz * SX + hx] >= 0 && abs(gStand[hz * SX + hx] - P.y) < 0.6;
    guards.forEach(function (g) {
      if (g.mode !== "chase") { g.tellT = 0; g.tell = max(0, g.tell - dt / GUARD.TELL); }
      if (g.mode === "hold") { g.holdT -= dt; g.amount -= g.amount * (1 - Math.exp(-dt / STEP_T)); if (g.holdT <= 0) { g.mode = "round"; } return; }
      if (g.mode === "chase") {
        if (now - g.seenAt > GUARD.HOLD * 1000) { g.mode = "round"; return; }
        if (!walkable && hypot(g.x - P.x, g.z - P.z) < 3) { g.face = turnTo(g.face, Math.atan2(P.x - g.x, -(P.z - g.z)), TURN * dt); g.amount -= g.amount * (1 - Math.exp(-dt / STEP_T)); }
        else if (g.to) { walkTo(g, g.to.x, g.to.z, GUARD.CHASE, dt); }
        // the grab: a beat in reach, the arms rising
        var reach = hypot(g.x - P.x, g.z - P.z) <= guardReach() && abs(g.y - P.y) <= PEARL.top && !(Hd && Hd.phase === "follow") && now >= graceUntil && alarms < 3;
        if (reach) { g.tellT += dt; g.tell = min(1, g.tellT / GUARD.TELL); if (g.tellT >= GUARD.TELL) { grab(g, now); } }
        else { g.tellT = 0; g.tell = max(0, g.tell - dt / GUARD.TELL); }
        return;
      }
      if (g.mode === "go") { if (walkTo(g, g.to.x, g.to.z, GUARD.CHASE, dt) || fieldTo(g.to.x, g.to.z)[floor(g.z) * SX + floor(g.x)] < 0) { g.mode = "round"; } return; }
      if (g.pause > 0) { g.pause -= dt; g.amount -= g.amount * (1 - Math.exp(-dt / STEP_T)); if (g.pause <= 0) { g.leg = (g.leg + 1) % g.round.length; } return; }
      var r = g.round[g.leg];
      if (walkTo(g, r.x, r.z, GUARD.ROUND, dt)) { g.pause = BEAT; }
    });
  }
  // Does a guard see him (his head's seat: while the head is out, the body)?
  function sees(g) {
    var e = [g.x, g.y + EYE, g.z], t = seat(), d = [t[0] - e[0], t[1] - e[1], t[2] - e[2]], L = hypot(d[0], d[1], d[2]);
    if (L > GUARD.SIGHT || abs(angle(Math.atan2(d[0], -d[2]) - g.face)) > GUARD.HALF) { return false; }
    for (var s = 0.25; s < L; s += 0.25) { if (!w.SEE[w.get(floor(e[0] + d[0] * s / L), floor(e[1] + d[1] * s / L), floor(e[2] + d[2] * s / L))]) { return false; } }
    return true;
  }
  // On the quarter-second tick: who sees him.
  function guardsLook(now) {
    if (!guards.length || intro || launched) { return; }
    guards.forEach(function (g) {
      if (g.mode === "hold" || !sees(g)) { return; }
      if (g.mode !== "chase") { g.to = null; if (now >= graceUntil) { say("A guard has seen you."); } }
      g.mode = "chase"; g.seenAt = now;
      // where he is, if they can walk there (the way worked out at most four times a second)
      var hx = floor(P.x), hz = floor(P.z), S0 = gStand[hz * w.SX + hx];
      if (S0 >= 0 && abs(S0 - P.y) < 0.6 && !(Hd && Hd.phase === "follow")) { g.to = { x: hx, z: hz }; }
    });
    if (Hd && !warnedBody && guards.some(function (g) { return hypot(g.x - P.x, g.z - P.z) < LOOK; })) { warnedBody = true; say("A guard is nearing your body: Holo, and it follows your head."); }
    if (!Hd) { warnedBody = false; }
  }
  function grab(g, now) {
    g.mode = "hold"; g.holdT = GUARD.HOLD; g.tellT = 0; graceUntil = now + GUARD.GRACE * 1000;
    // (once the rocket stands, the coins that built it are spent: none goes back)
    var back = !built && got.length ? coins.filter(function (q) { return q.id === got[got.length - 1]; })[0] : null;
    if (back) { got.pop(); drawCoins(); }
    if (Hd) {
      // the body, headless, taken: the head pulled home, and he comes to under his tree
      harmBody("guard");
      alarms = 0; store(); drawPieces(); closeLabel();
      lieDown(["The guards have your body.", "You come to under your tree again.", adv.title]);
      return;
    }
    alarms += 1;
    store(); drawPieces();
    if (alarms >= 3) { say("A guard has hold of you: the third alarm" + (back ? ", and your last coin goes back" : "") + "."); setTimeout(putOut, 1400); return; }
    say("A guard has hold of you: an alarm" + (back ? ", and your last coin goes back " + back.text : "") + ". " + (alarms === 1 ? "Two more" : "One more") + " and the guards walk you out.");
  }
  // A wrong look behind a work: every guard not chasing goes to it.
  function guardsTo(p) {
    var s = Pl.readingSpots ? Pl.readingSpots(place, p)[0] : null;
    if (!s) { return; }
    guards.forEach(function (g) { if (g.mode === "round") { g.mode = "go"; g.to = { x: s[0], z: s[1] }; } });
  }
  // The guard a ray from the eye meets first (its upright cylinder, his box's width, feet to hat top).
  function guardAt(dir, hit, far) {
    var best = null;
    guards.forEach(function (g) {
      var ox = eye[0] - g.x, oz = eye[2] - g.z, a = dir[0] * dir[0] + dir[2] * dir[2], b = ox * dir[0] + oz * dir[2], c = ox * ox + oz * oz - 0.09, h = b * b - a * c;
      if (a < 1e-9 || h < 0) { return; }
      var t = (-b - Math.sqrt(h)) / a, y = eye[1] + dir[1] * t;
      if (t < 0 || y < g.y || y > g.y + PEARL.top || (hit && hit.t < t) || t > (far || LOOK + 6)) { return; }
      if (!best || t < best.t) { best = { g: g, t: t }; }
    });
    return best && best.g;
  }
  function guardWords(g) { return "A guard of " + (g.room && g.room.name ? g.room.name : "a room") + ": it sees 9 m across 70°, walks at your walk over φ, cannot climb two blocks, swim, or hold your head."; }
  function drawGuards(now) {
    if (!guards.length || !me3) { return; }
    var PB = window.PearlBody, body = me3.body, h = unitH(), RO = coinRO(), SX = w.SX;
    if (!guardPal) {
      guardPal = new Float32Array(me3.pal);
      for (var i = 1; i < 64; i += 1) { if (guardPal[i * 4] || guardPal[i * 4 + 1] || guardPal[i * 4 + 2]) { guardPal[i * 4] = guardPal[i * 4 + 1] = guardPal[i * 4 + 2] = 128; } }
      var n = 2 * RO, ids = new Uint8Array(n * n * n), blocks = [], id = (body.paletteIds.jacket || [1])[0];
      for (var y = 0; y < n; y += 1) { for (var z = 0; z < n; z += 1) { for (var x = 0; x < n; x += 1) {
        if (hypot(x + 0.5 - RO, y + 0.5 - RO, z + 0.5 - RO) > RO) { continue; }
        ids[(y * n + z) * n + x] = id; blocks.push([x, y, z, id]);
      } } }
      guardHead = meshBlocks(blocks); guardHead.tex = voxTexture(ids, n, n, n); guardHead.n = n;
    }
    gl.useProgram(prog);
    gl.uniform4fv(U.uPal, guardPal);
    gl.uniform1f(U.uPx, pxW / h); gl.uniform2f(U.uNear, 0, 0);
    gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0);
    var draw = function (ch, m, dim) {
      gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, ch.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform3i(U.uDim, dim[0], dim[1], dim[2]);
      gl.bindVertexArray(ch.vao);
      gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
    };
    guards.forEach(function (g) {
      if (abs(g.x - eye[0]) > 90 || abs(g.z - eye[2]) > 90) { return; }
      var M = PB.pose(body, PB.phaseStep(body, 0, g.walked), g.amount, g.tell > 0 ? { arms: g.tell * ARMS_UP } : null);
      me3.parts.forEach(function (ch) {
        if (ch.p.name === "guitar" || ch.p.name === "hat") { return; }
        draw(ch, PB.place(M[ch.p.name], g.x, g.y, g.z, g.face), ch.p.dim);
      });
      var c = apply(PB.place(M.head, g.x, g.y, g.z, g.face), body.head.centre);
      draw(guardHead, PB.mul(PB.T(c[0], c[1], c[2]), PB.mul(PB.RY(-g.face), PB.mul(PB.S(h), PB.T(-RO, -RO, -RO)))), [guardHead.n, guardHead.n, guardHead.n]);
    });
    gl.uniform4fv(U.uPal, worldPal); gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    gl.uniform1f(U.uPx, pxW); gl.uniform2f(U.uNear, NEAR_F[0], NEAR_F[1]); gl.uniform1i(U.uFloor, 1); gl.uniform3i(U.uDim, SX, w.SY, w.SZ);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(null);
  }

  /* ---- the fire: the rocket's engine struck alight ---------------------------------------------------------------
     The artist, 21 Oct 2026: "There should be a really unique animation of when Mr. Pearl needs to start a fire, similar
     to the animation in which the NASA pictures from the artist website come to be animated as you click or scroll around
     the globe. You see a similar thing happened as far as sparks made of galaxies that are animated and fade out very
     quickly. Nonetheless shine from a bright light that builds as you swing more and more your finger or cursor around,
     and eventually, with enough movement from the finger, there generates enough friction in the game where a fire is
     started." The fire he needs is the rocket's: Launch asks for it to be struck. Every swing of the finger or the cursor
     over the view is friction: its length, in heights of the screen, adds to the heat, and the heat cools by itself over a
     bar (so only a swing kept up gets there: at three heights a second it climbs to near six, at one it stops near two).
     At phi^3 (4.24) the fire is struck. While it climbs, sparks made of galaxies fly off the finger, each a little spiral
     of the deep-space photographs' own lights (the site's remains: stars a CSS pixel, two where they bloom, warm gold and
     blue white, added as light adds), turning, and gone in a beat; and a light gathers where the finger swings, as large
     and as bright as the heat is near the fire. A tap, or Space or Enter, strikes too (a twelfth of the way: phi^-2 each,
     for the hand that cannot swing; WCAG 2.5.1). Struck, the flame leaves the engine and he rides it up (the ride). */
  var ignite = null, IGNITE = { FIRE: PHI * PHI * PHI, TAP: 1 / (PHI * PHI) };
  function igniteBegin() {
    ignite = { E: 0, sparks: [], at: null, light: null, t0: performance.now(), struck: 0 };
    document.body.dataset.ride = "true";
    say("The engine needs a fire: swing your finger, or the cursor, round and round over the view to strike it; a tap strikes too.", true);
  }
  // Friction: a stretch of the swing (from x0, y0 to x1, y1, in CSS pixels).
  function igniteRub(x0, y0, x1, y1) {
    if (!ignite || ignite.struck) { return; }
    var H = window.innerHeight || 1, d = hypot(x1 - x0, y1 - y0);
    if (d <= 0) { return; }
    ignite.E += d / H;
    ignite.at = [x1, y1];
    // a spark for every so far of the swing (a twentieth of the screen's height), off the way it goes
    ignite.carry = (ignite.carry || 0) + d;
    var step = H / 20, ux = (x1 - x0) / d, uy = (y1 - y0) / d;
    while (ignite.carry >= step) {
      ignite.carry -= step;
      var k = ignite.sparks.length + ignite.E * 97;
      ignite.sparks.push({ x: x1, y: y1, vx: ux * H * 0.6 + Math.sin(k * 2.3) * H * 0.25, vy: uy * H * 0.6 + Math.cos(k * 1.7) * H * 0.25, t: 0, a: k % 6.28, warm: (k | 0) % 2 === 0, r: H / 89 * (0.7 + 0.6 * ((k * 0.618) % 1)) });
    }
    if (ignite.sparks.length > 89) { ignite.sparks.splice(0, ignite.sparks.length - 89); }
    if (ignite.E >= IGNITE.FIRE) { igniteStrike(); }
  }
  // A tap: a stretch of phi^-2 of the screen's height for the light and the sparks, and counted apart from the heat,
  // which cools, so that the twelfth strikes however slowly they come (steady tapping had levelled off below the fire).
  function igniteTap() {
    if (!ignite || ignite.struck) { return; }
    var H = window.innerHeight || 1, x = (window.innerWidth || 1) / 2, y = H / 2, s = H * IGNITE.TAP / Math.SQRT2;
    ignite.at = ignite.at || [x, y];
    ignite.taps = (ignite.taps || 0) + 1;
    igniteRub(ignite.at[0], ignite.at[1], ignite.at[0] + s, ignite.at[1] + s);
    if (!ignite.struck && ignite.taps >= IGNITE.FIRE / IGNITE.TAP) { igniteStrike(); }
    ignite.at = [x, y];
  }
  function igniteStep(dt) {
    if (!ignite) { return; }
    ignite.E -= ignite.E * min(1, dt / BAR);
    ignite.sparks = ignite.sparks.filter(function (q) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 1 - min(1, dt * 3); q.vy *= 1 - min(1, dt * 3); q.a += Math.PI / BEAT * dt; return q.t < BEAT; });
    if (ignite.struck && performance.now() - ignite.struck > BAR * 1000) { var go = ignite; ignite = null; rideBegin(go); }
  }
  function igniteStrike() {
    ignite.struck = performance.now();
    say("Struck: the engine is alight.", true);
  }
  // Over the view: the sparks, the light, and, struck, the flame at the engine.
  function igniteDraw(c, W, H, now) {
    if (!ignite) { return; }
    c.save(); c.globalCompositeOperation = "lighter";
    var near = min(1, ignite.E / IGNITE.FIRE);
    if (ignite.at && near > 0.02) {
      var r = H / (PHI * PHI * PHI) * (0.3 + near), g = c.createRadialGradient(ignite.at[0], ignite.at[1], 0, ignite.at[0], ignite.at[1], r);
      g.addColorStop(0, "rgba(255,244,214," + (0.85 * near).toFixed(3) + ")"); g.addColorStop(0.35, "rgba(243,201,139," + (0.45 * near).toFixed(3) + ")"); g.addColorStop(1, "rgba(243,201,139,0)");
      c.fillStyle = g; c.beginPath(); c.arc(ignite.at[0], ignite.at[1], r, 0, Math.PI * 2); c.fill();
    }
    ignite.sparks.forEach(function (q) {
      var life = 1 - q.t / BEAT, n = 13;
      for (var i = 0; i < n; i += 1) {
        var arm = i % 2, t = i / n, rad = q.r * (0.15 + t), a = q.a + t * 4.2 + arm * Math.PI;
        var x = q.x + Math.cos(a) * rad, y = q.y + Math.sin(a) * rad * 0.6, sz = i < 2 ? 2 : 1;
        c.fillStyle = (q.warm ? (i % 3 ? "rgba(243,201,139," : "rgba(255,244,214,") : (i % 3 ? "rgba(168,190,234," : "rgba(234,240,255,")) + (life * (1 - t * 0.5)).toFixed(3) + ")";
        c.fillRect(round(x), round(y), sz, sz);
      }
    });
    if (ignite.struck && vp) {
      // the flame: triangles of the unit leaving the engine, brightest first
      var wr = place.wreck, base = [wr.x + 0.5, wr.y, wr.z + 0.5], q = [0, 0, 0, 0];
      for (var i2 = 0; i2 < 4; i2++) { q[i2] = vp[i2] * base[0] + vp[4 + i2] * base[1] + vp[8 + i2] * base[2] + vp[12 + i2]; }
      if (q[3] > 0.3) {
        var bx = (q[0] / q[3] * 0.5 + 0.5) * W, by = (1 - (q[1] / q[3] * 0.5 + 0.5)) * H, u = (now - ignite.struck) / 1000;
        for (var k = 0; k < 21; k += 1) {
          var life2 = ((u * 2 + k * 0.137) % 1), s2 = max(4, H / q[3] * (0.6 + life2 * 1.6)), x2 = bx + Math.sin(k * 2.3) * s2 * 0.6, y2 = by - life2 * s2 * 2.4;
          c.fillStyle = life2 < 0.3 ? "rgba(255,244,214," + (1 - life2).toFixed(2) + ")" : "rgba(243,140,70," + (0.9 * (1 - life2)).toFixed(2) + ")";
          c.beginPath(); c.moveTo(x2, y2 - s2 * 0.58); c.lineTo(x2 + s2 / 2, y2 + s2 * 0.29); c.lineTo(x2 - s2 / 2, y2 + s2 * 0.29); c.closePath(); c.fill();
        }
      }
    }
    c.restore();
  }

  /* ---- the ride, and space -----------------------------------------------------------------------------------------
     The artist, 21 Oct 2026 (the scoping note, notes/holographic-mr-pearl/specs/COINS-AND-SPACE.md, keeps the words):
     the rocket built, by the four pieces or the ten coins, he rides it up, steered by the stick, and past "a certain
     threshold in the sky" control goes and the camera watches him blast off; then space: "in his rockets ... shoot 10
     enemy spacecraft down as they fly by", third person behind him in the pilot seat, the windshield's frame, the tips of
     the ship's guns and their lasers, "a reflex target symbol ... slightly below the center of the windshield", the
     stick flying the ship; "once you shoot 10 you get shot by an enemy aircraft and crash down back to the planet where
     you have to assemble the rocket either by collecting 10 coins or finding all the parts".
     The ride: the rocket climbs as it always has (2.4 (t - 1)^2 m); the stick moves it across at his walk, within the
     crash site's clearing (14 m round the crash, 20 in a city); the camera follows it as far behind its nose as the rocket is tall (13 blocks); the
     threshold is the height of the figure in the sky over the wreck, past which the figure is behind him; there the
     camera stops and watches; at twice that height and the rocket's own, space.
     Space, every number his or the song's: the ship flies at the hologram's speed (22.5 m/s) and turns at his turn over
     phi cubed; the camera sits behind his head as far as the third person's does at rest (TP_HEAD), his head AIM below
     the centre;
     the mark (the sight's figure, its size) is AIM / phi^2 below the centre (7.4 degrees: slightly below); the guns'
     shots converge on the mark's line at FAR / phi^3 (99 m) and cross the far plane in a beat; one a half beat (SWING);
     the enemies are the block of the unit, white, made the sphere study's size (F(4) = 3 m), each held in a triangle on
     the windshield as far off as it is seen (it is small and fades into the black), coming in at the ship and across
     it at its speed over phi, two at a time from FAR / phi ahead; a shot that passes within a block's half diagonal of
     one brings it down, its six bars flying; the tenth down, one comes head on and fires; hit, the ship tumbles for a
     bar and he comes down hard again: the place as it was, the pieces and the coins where they lay. */
  var ride = null, space = null, enemyCh = null, VIEW_LABEL = "";
  var SPACE = { N: 10, AHEAD: FAR / PHI, ZERO: FAR / (PHI * PHI * PHI), SHOT: FAR / BEAT, R: 1.5 * Math.sqrt(3), SIZE: 3 };
  function spaceV() { return HOLO_V; }
  function spaceTurn() { return TURN / (PHI * PHI * PHI); }
  function markDrop() { return AIM / (PHI * PHI); }
  // The height the ride is his to steer: the middle of the figure in the sky over the wreck.
  function rideTop() {
    if (!skyFig) { return 60; }
    var s = 0, n = 0;
    skyFig.hexes.forEach(function (P8) { P8.forEach(function (p) { s += p[1]; n += 1; }); });
    return max(13, s / n - place.wreck.y);
  }
  function rideStep(dt, c) {
    if (!ride || ride.cut || space) { return; }
    // within the crash site's clearing (14 m round the crash, 20 in a city), the rocket's half width in from its edge
    var R = (place.kind === "city" ? 20 : 14) - 2.5, wr = place.wreck, cr = place.crash;
    ride.dx += (Math.sin(P.yaw) * c.fwd + Math.cos(P.yaw) * c.side) * WALK * dt;
    ride.dz += (-Math.cos(P.yaw) * c.fwd + Math.sin(P.yaw) * c.side) * WALK * dt;
    var ox = wr.x + 0.5 + ride.dx - cr.x, oz = wr.z + 0.5 + ride.dz - cr.z, L = hypot(ox, oz);
    if (L > R) { ride.dx -= ox * (1 - R / L); ride.dz -= oz * (1 - R / L); }
  }
  function rideCam() {
    var wr = place.wreck, nose = [wr.x + 0.5 + ride.dx, wr.y + rocketLift + 13, wr.z + 0.5 + ride.dz];
    if (ride.cut) {
      var d = [nose[0] - ride.cut[0], nose[1] - ride.cut[1], nose[2] - ride.cut[2]];
      return { e: ride.cut, yaw: Math.atan2(d[0], -d[2]), pitch: Math.atan2(d[1], hypot(d[0], d[2])) };
    }
    var f = lookDir(P.yaw, P.pitch - AIM);
    return { e: [nose[0] - f[0] * 13, nose[1] - f[1] * 13, nose[2] - f[2] * 13], yaw: P.yaw, pitch: P.pitch };
  }
  // Past the threshold: the camera stays where it is and watches; past twice it and the rocket's height: space.
  function rideCheck(lift) {
    if (!ride || space || intro) { return; }
    if (!ride.cut && lift >= ride.top) { ride.cut = eye.slice(); say("Past the figure in the sky: the rocket has you now.", true); }
    if (lift >= 2 * ride.top + 13) { spaceBegin(); }
  }
  // Far from the place's grid (x below nought is air there), so nothing of the place is met.
  var SPACE_O = [-1e4, 1e4, -1e4];
  // the eyes' opening in space: the wake-up's own lids (lids), from where they first open (1.2 s) to open (5 s)
  var SPACE_WAKE = 5 - 1.2;
  function spaceBegin() {
    // (he comes to in space as he came to under the tree: the eyes open, then the stick is his: "Once you get to space
    // you return (like you do when initially opening the artifact) back to being able to control Mr Pearl")
    space = { pos: SPACE_O.slice(), down: 0, enemies: [], shots: [], fired: -1e9, phase: "wake", made: 0, hitAt: 0, sky: spaceSky(), black: 0, t0: performance.now() };
    P.yaw = 0; P.pitch = 0; P.face = 0; blend = null;
    shards = []; swing = swingNext = null;
    if (!enemyCh) { enemyCh = meshBlocks([[0, 0, 0, B.WHITE]]); enemyCh.tex = voxTexture(new Uint8Array([B.WHITE]), 1, 1, 1); }
    document.body.dataset.space = "true";
    $("jump").setAttribute("aria-label", "Fire");
    canvas.setAttribute("aria-label", "Space, from behind Mr Pearl in the pilot seat: the stick, W A S D or the arrows fly the ship; a tap, Fire or Space fires at the mark.");
    $("where").textContent = "Space · 0 of " + SPACE.N + " down";
  }
  // The stars and three galaxies, as directions (the deep-space photographs cannot come into an Artifact: drawn here as
  // the unit, triangles), the same every time.
  function spaceSky() {
    var r = Pl.rng(seed * 7 + 3), stars = [], gal = [];
    var dirOf = function () { var z = 2 * r() - 1, a = 2 * Math.PI * r(), q = Math.sqrt(1 - z * z); return [q * Math.cos(a), z, q * Math.sin(a)]; };
    for (var i = 0; i < 700; i += 1) { stars.push({ d: dirOf(), s: 0.6 + 1.6 * r() * r(), a: 0.35 + 0.65 * r() }); }
    for (var g = 0; g < 3; g += 1) {
      var c = dirOf(), u = norm([c[1], -c[0], 0.3]), v = norm([c[1] * u[2] - c[2] * u[1], c[2] * u[0] - c[0] * u[2], c[0] * u[1] - c[1] * u[0]]), k = 0.06 + 0.05 * r(), tilt = 0.4 + 0.5 * r();
      var warm = r() < 0.5;
      for (var j = 0; j < 260; j += 1) {
        var arm = j % 2, t = r() * 3.2, rad = k * (0.12 + t / 3.2), a2 = t * 2.4 + arm * Math.PI + (r() - 0.5) * 0.5;
        var x = Math.cos(a2) * rad, y = Math.sin(a2) * rad * tilt;
        gal.push({ d: norm([c[0] + u[0] * x + v[0] * y, c[1] + u[1] * x + v[1] * y, c[2] + u[2] * x + v[2] * y]), s: 0.8 + 1.2 * r(), a: 0.25 + 0.5 * (1 - t / 3.2), c: warm ? (r() < 0.6 ? "243,201,139" : "234,223,205") : (r() < 0.6 ? "168,190,234" : "234,223,205") });
      }
    }
    return { stars: stars, gal: gal };
  }
  function spaceAxes() { var f = lookDir(P.yaw, P.pitch), r = [Math.cos(P.yaw), 0, Math.sin(P.yaw)], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]]; return { f: f, r: r, u: u }; }
  // (as far from his head as the third person's camera is at rest, TP_HEAD, his head AIM below the centre)
  function spaceCam() {
    var f = lookDir(P.yaw, P.pitch - AIM), h = space.pos;
    return { e: [h[0] - f[0] * TP_HEAD, h[1] - f[1] * TP_HEAD, h[2] - f[2] * TP_HEAD], yaw: P.yaw, pitch: P.pitch };
  }
  // The guns' tips, either side of him under his shoulders and ahead (a step out, half his height down, a step on).
  function gunTips() {
    var A = spaceAxes(), h = space.pos, s = PEARL.leg, dn = PEARL.top / 2;
    return [-1, 1].map(function (k) { return [0, 1, 2].map(function (i) { return h[i] + A.r[i] * k * s - A.u[i] * dn + A.f[i] * s; }); });
  }
  function fire(now) {
    if (!space || (space.phase !== "fight" && space.phase !== "last") || now - space.fired < SWING * 1000) { return; }
    space.fired = now;
    var e = spaceCam().e, d = lookDir(P.yaw, P.pitch - markDrop()), A = [e[0] + d[0] * SPACE.ZERO, e[1] + d[1] * SPACE.ZERO, e[2] + d[2] * SPACE.ZERO];
    gunTips().forEach(function (t) { space.shots.push({ p: t.slice(), d: norm([A[0] - t[0], A[1] - t[1], A[2] - t[2]]), life: FAR / SPACE.SHOT, mine: true }); });
  }
  function spawn() {
    var A = spaceAxes(), r = Pl.rng(seed * 31 + space.made * 7 + 1), side = (r() < 0.5 ? -1 : 1) * (0.5 + 0.5 * r()), up = (r() - 0.5) * 0.6, V = spaceV() / PHI;
    var p = [0, 1, 2].map(function (i) { return space.pos[i] + A.f[i] * SPACE.AHEAD + A.r[i] * side * SPACE.AHEAD / PHI / 2 + A.u[i] * up * SPACE.AHEAD / PHI / 2; });
    // in at the ship, and across its way
    var v = [0, 1, 2].map(function (i) { return -A.f[i] * V - A.r[i] * Math.sign(side) * V / PHI; });
    space.made += 1;
    space.enemies.push({ p: p, v: v, spin: r() * 6, last: false });
  }
  function spaceBurst(e) {
    var tn = tonesOf(w.pal[B.WHITE] || [230, 230, 230]), tones = new Float32Array(9), V = spaceV() / PHI;
    for (var i = 0; i < 3; i += 1) { for (var j = 0; j < 3; j += 1) { tones[i * 3 + j] = tn[i][j] / 255; } }
    FIGURE.forEach(function (f) {
      var c = [(f[0] + f[3]) / 2 - 0.5, (f[1] + f[4]) / 2 - 0.5, (f[2] + f[5]) / 2 - 0.5], dir = norm([c[0] + 0.01, c[1] + 0.01, c[2] + 0.01]);
      shards.push({ c: [e.p[0] + c[0] * SPACE.SIZE, e.p[1] + c[1] * SPACE.SIZE, e.p[2] + c[2] * SPACE.SIZE], size: [(f[3] - f[0]) * SPACE.SIZE, (f[4] - f[1]) * SPACE.SIZE, (f[5] - f[2]) * SPACE.SIZE],
                    v: [e.v[0] + dir[0] * V, e.v[1] + dir[1] * V, e.v[2] + dir[2] * V], ax: [dir[1], -dir[0], 0.3], turn: 0, t: 0, tones: tones, free: true, life: BAR });
    });
  }
  function spaceStep(dt, now) {
    var yaw0 = P.yaw, c = controls(dt), A, i;
    // (the arrows turn the ship as the stick does, not at the planet's own rate)
    P.yaw = yaw0; c.side = clampV(c.side + (input.keys.ArrowRight ? 1 : 0) - (input.keys.ArrowLeft ? 1 : 0), -1, 1);
    if (space.phase === "wake" && (now - space.t0) / 1000 >= SPACE_WAKE) {
      space.phase = "fight";
      say("Space. The stick flies the ship; a tap, the jump or Space fires. Ten of them come by: bring them down.", true);
    }
    if (space.phase === "fight" || space.phase === "last") {
      P.yaw += c.side * spaceTurn() * dt; P.pitch = clampV(P.pitch + c.fwd * spaceTurn() * dt, -1.2, 1.2);
      if (c.up > 0 || input.fire) { fire(now); }
    } else if (space.phase === "hit") {
      // the ship tumbles, nose down, for a bar; then he comes down hard again
      P.yaw += TURN / PHI * dt; P.pitch = max(-1.4, P.pitch - spaceTurn() * dt);
      space.black = min(1, (now - space.hitAt) / 1000 / BAR);
      if (space.black >= 1) { crash(); return; }
    }
    input.fire = false;
    A = spaceAxes();
    for (i = 0; i < 3; i += 1) { space.pos[i] += A.f[i] * spaceV() * dt; }
    // the enemies: two at a time until ten are down; then the last, head on
    if (space.phase === "fight") { while (space.enemies.length < 2 && space.down + space.enemies.length < SPACE.N) { spawn(); } }
    space.enemies = space.enemies.filter(function (e) {
      for (var k = 0; k < 3; k += 1) { e.p[k] += e.v[k] * dt; }
      e.spin += Math.PI / BEAT * dt;
      var d = [e.p[0] - space.pos[0], e.p[1] - space.pos[1], e.p[2] - space.pos[2]], ahead = d[0] * A.f[0] + d[1] * A.f[1] + d[2] * A.f[2];
      if (e.last && !e.fired && hypot(d[0], d[1], d[2]) < SPACE.ZERO) {
        e.fired = true;
        space.shots.push({ p: e.p.slice(), d: norm([-d[0], -d[1], -d[2]]), life: FAR / SPACE.SHOT * PHI * PHI, mine: false, v: SPACE.SHOT / (PHI * PHI) });
      }
      return ahead > -2 * SPACE.ZERO / PHI && hypot(d[0], d[1], d[2]) < FAR * 1.2;
    });
    // the shots, and what they meet
    space.shots = space.shots.filter(function (s) {
      var v = s.v || SPACE.SHOT, p0 = s.p.slice();
      for (var k = 0; k < 3; k += 1) { s.p[k] += s.d[k] * v * dt; }
      s.life -= dt;
      if (!s.mine) {
        var dd = segDist(space.pos, p0, s.p);
        if (dd < PEARL.top && space.phase === "last") { space.phase = "hit"; space.hitAt = now; say("Hit. The ship goes down.", false); return false; }
        return s.life > 0;
      }
      var hit = null;
      // (the last one, head on, is not to be brought down: it is the one that hits him)
      space.enemies.forEach(function (e) { if (!hit && !e.last && segDist(e.p, p0, s.p) < SPACE.R) { hit = e; } });
      if (hit) {
        space.enemies.splice(space.enemies.indexOf(hit), 1);
        spaceBurst(hit);
        space.down += 1;
        $("where").textContent = "Space · " + space.down + " of " + SPACE.N + " down";
        if (space.down >= SPACE.N) { say("Ten down. One more comes, head on.", true); space.phase = "last"; lastOne(); }
        else { say(space.down + " of " + SPACE.N + " down.", true); }
        return false;
      }
      return s.life > 0;
    });
    if (space.phase === "last" && !space.enemies.length) { lastOne(); }
  }
  // the last: straight at the ship, a little above its line, at the ship's speed over phi
  function lastOne() {
    var A = spaceAxes(), V = spaceV() / PHI;
    space.enemies.push({ p: [0, 1, 2].map(function (i) { return space.pos[i] + A.f[i] * SPACE.AHEAD + A.u[i] * 4; }), v: A.f.map(function (q) { return -q * V; }), spin: 0, last: true });
  }
  function segDist(c, a, b) {
    var ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    var t = L2 > 0 ? clampV(((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / L2, 0, 1) : 0;
    return hypot(a[0] + ab[0] * t - c[0], a[1] + ab[1] * t - c[1], a[2] + ab[2] * t - c[2]);
  }
  // Down: the place as it was, the pieces and the coins where they lay, the rocket to build again; what he read kept.
  function crash() {
    delete document.body.dataset.ride;
    Object.keys(looked).forEach(function (id) { if (looked[id] === "piece") { delete looked[id]; } });
    // the old world's own GL things let go (the next is built anew)
    paintings.forEach(function (p) { if (p.tex) { gl.deleteTexture(p.tex); } });
    [homage, studies].forEach(function (h) { if (h) { h.figures.forEach(function (f) { if (f.vao) { gl.deleteVertexArray(f.vao); } }); } });
    if (rocketCh) { gl.deleteVertexArray(rocketCh.vao); [rocketCh.pb, rocketCh.ib, rocketCh.eb].forEach(function (b) { if (b) { gl.deleteBuffer(b); } }); if (rocketCh.tex) { gl.deleteTexture(rocketCh.tex); } }
    canvas.setAttribute("aria-label", VIEW_LABEL);
    space = null; ride = null; launched = null; ended = false; built = false; found = []; got = []; alarms = 0; rocketCh = null; rocketLift = 0; shards = [];
    delete document.body.dataset.space;
    $("jump").setAttribute("aria-label", "Jump");
    store();
    start(setting.kind, chosen(), seed).catch(function (err) { $("veil").hidden = false; $("veil").textContent = "The world could not be built: " + err.message; });
  }
  function spaceFrame(now, dt) {
    spaceStep(dt, now);
    if (!space) { return false; }
    shardsStep(dt);
    var cw = canvas.width, chh = canvas.height, cam = spaceCam();
    eye = cam.e; camLast = { e: cam.e, yaw: cam.yaw, pitch: cam.pitch };
    vp = mul(perspective(FOV * Math.PI / 180, cw / chh, NEAR, FAR), view(eye, cam.yaw, cam.pitch));
    glyphBegin(cw, chh);
    gl.viewport(0, 0, cw, chh);
    gl.clearColor(0.004, 0.004, 0.012, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 0);
    var tanH = 2 * Math.tan(FOV * Math.PI / 360), BLACK = [0, 0, 0], PB = window.PearlBody;
    pxW = tanH / rows0;
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform3fv(U.uEye, eye); gl.uniform3fv(U.uSun, sunDir); gl.uniform1f(U.uT, now / 1000);
    gl.uniform3fv(U.uSky, BLACK); gl.uniform3fv(U.uHaze, BLACK); gl.uniform1i(U.uSteps, walk); gl.uniform1i(U.uVeil, 0); gl.uniform1i(U.uVox, 1); gl.uniform1f(U.uPaint, PAINT);
    gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0); gl.uniform2f(U.uNear, 0, 0);
    gl.uniform3f(U.uAxA, 1e9, 1e9, 1e9); gl.uniform3f(U.uAxB, 1e9, 1e9, 1e9); gl.uniform3f(U.uHeadC, 1e9, 1e9, 1e9); gl.uniform3f(U.uHeadE, 1e9, 1e9, 1e9);
    // the stars and the galaxies, first and behind all (no depth written), facing the camera
    if (trailProg) {
      var D = 0.9 * FAR, dpr0 = min(2, window.devicePixelRatio || 1), cy0 = Math.cos(cam.yaw), sy0 = Math.sin(cam.yaw), fv = lookDir(cam.yaw, cam.pitch);
      var rv = [cy0, 0, sy0], uv = [rv[1] * fv[2] - rv[2] * fv[1], rv[2] * fv[0] - rv[0] * fv[2], rv[0] * fv[1] - rv[1] * fv[0]];
      var batch = {}, put = function (st, col) {
        var c0 = [eye[0] + st.d[0] * D, eye[1] + st.d[1] * D, eye[2] + st.d[2] * D], z = st.s * 1.7 * dpr0 * pxW * D, a = st.a, B0 = batch[col] = batch[col] || [];
        B0.push(c0[0] + uv[0] * 0.58 * z, c0[1] + uv[1] * 0.58 * z, c0[2] + uv[2] * 0.58 * z, a,
                c0[0] + (rv[0] * 0.5 - uv[0] * 0.29) * z, c0[1] + (rv[1] * 0.5 - uv[1] * 0.29) * z, c0[2] + (rv[2] * 0.5 - uv[2] * 0.29) * z, a,
                c0[0] + (-rv[0] * 0.5 - uv[0] * 0.29) * z, c0[1] + (-rv[1] * 0.5 - uv[1] * 0.29) * z, c0[2] + (-rv[2] * 0.5 - uv[2] * 0.29) * z, a);
      };
      space.sky.stars.forEach(function (st) { if (st.d[0] * fv[0] + st.d[1] * fv[1] + st.d[2] * fv[2] > 0.3) { put(st, "234,223,205"); } });
      space.sky.gal.forEach(function (st) { if (st.d[0] * fv[0] + st.d[1] * fv[1] + st.d[2] * fv[2] > 0.3) { put(st, st.c); } });
      gl.useProgram(trailProg); gl.uniformMatrix4fv(TU.uVP, false, vp);
      gl.bindVertexArray(trailVao); gl.bindBuffer(gl.ARRAY_BUFFER, trailBuf);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
      Object.keys(batch).forEach(function (k) {
        var cc = k.split(",").map(function (v) { return +v / 255; });
        gl.uniform3f(TU.uC, cc[0], cc[1], cc[2]);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(batch[k]), gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, batch[k].length / 4);
      });
      gl.disable(gl.BLEND); gl.depthMask(true); gl.bindVertexArray(null);
      gl.useProgram(prog);
    }
    var A = spaceAxes(), box = function (ch, m, dim, px) {
      gl.uniform1f(U.uPx, px);
      gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, ch.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform3i(U.uDim, dim[0], dim[1], dim[2]); gl.bindVertexArray(ch.vao); gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
    };
    // the basis: grid x his right, grid y the way he flies, grid z up (right-handed)
    var basis = function (o, k) { return [A.r[0] * k, A.r[1] * k, A.r[2] * k, 0, A.f[0] * k, A.f[1] * k, A.f[2] * k, 0, A.u[0] * k, A.u[1] * k, A.u[2] * k, 0, o[0], o[1], o[2], 1]; };
    // the ship: the rocket he built, lying along his way, its hull's top at his waist, the nose ahead of him
    if (rocketCh) {
      gl.uniform4fv(U.uPal, worldPal);
      var waist = [space.pos[0] - A.u[0] * (PEARL.headY - PEARL.leg), space.pos[1] - A.u[1] * (PEARL.headY - PEARL.leg), space.pos[2] - A.u[2] * (PEARL.headY - PEARL.leg)];
      var o = [0, 1, 2].map(function (i) { return waist[i] - A.r[i] * 2.5 - A.f[i] * 6.5 - A.u[i] * 4; });
      // (its mesh is in the world's cells, its grid at org: both taken to the ship)
      var org = rocketCh.org;
      gl.uniform3f(U.uOrg, org[0], org[1], org[2]);
      box(rocketCh, PB.mul(basis(o, 1), PB.T(-org[0], -org[1], -org[2])), rocketCh.dim, pxW);
      gl.uniform3f(U.uOrg, 0, 0, 0);
    }
    // the enemies: the unit's block, three metres, turning
    gl.uniform4fv(U.uPal, worldPal);
    space.enemies.forEach(function (e) {
      var m = PB.mul(PB.T(e.p[0], e.p[1], e.p[2]), PB.mul(PB.RA([0.3, 1, 0.2], e.spin), PB.mul(PB.S(SPACE.SIZE), PB.T(-0.5, -0.5, -0.5))));
      box(enemyCh, m, [1, 1, 1], pxW / SPACE.SIZE);
    });
    gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    // him, in the seat: the world's drawing of him at the ship, facing its way
    P.x = space.pos[0]; P.y = space.pos[1] - PEARL.headY; P.z = space.pos[2]; P.face = P.yaw; P.amount = 0;
    drawMe = { body: true, head: true };
    var HZ = HAZE; HAZE = BLACK; drawPearl(now); drawShards(); HAZE = HZ;
    // the guns: two bars of the rocket's red along his way, their tips where the shots leave
    if (shardProg) {
      var tn = tonesOf(w.pal[B.RED] || [200, 60, 50]), gt = new Float32Array(9), L = PEARL.leg, tw = unitH() * 3;
      for (var ti = 0; ti < 3; ti += 1) { for (var tj = 0; tj < 3; tj += 1) { gt[ti * 3 + tj] = tn[ti][tj] / 255; } }
      gl.useProgram(shardProg);
      gl.uniformMatrix4fv(SHU.uVP, false, vp); gl.uniform3fv(SHU.uEye, eye); gl.uniform3fv(SHU.uHaze, BLACK); gl.uniform3fv(SHU.uT, gt);
      gl.bindVertexArray(null);
      gunTips().forEach(function (t) {
        var m = [A.r[0] * tw, A.r[1] * tw, A.r[2] * tw, 0, A.u[0] * tw, A.u[1] * tw, A.u[2] * tw, 0, A.f[0] * L, A.f[1] * L, A.f[2] * L, 0, t[0] - A.f[0] * L / 2, t[1] - A.f[1] * L / 2, t[2] - A.f[2] * L / 2, 1];
        gl.uniformMatrix4fv(SHU.uM, false, m);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
      });
    }
    // the lasers
    var pts = [];
    space.shots.forEach(function (s) { var L = s.mine ? 6 : 3; pts.push(s.p[0], s.p[1], s.p[2], 0.95, s.p[0] - s.d[0] * L, s.p[1] - s.d[1] * L, s.p[2] - s.d[2] * L, 0); });
    if (pts.length && trailProg) {
      gl.useProgram(trailProg);
      gl.uniformMatrix4fv(TU.uVP, false, vp); gl.uniform3f(TU.uC, 1, 0.71, 0.45);
      gl.bindVertexArray(trailVao); gl.bindBuffer(gl.ARRAY_BUFFER, trailBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.DYNAMIC_DRAW);
      gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
      gl.drawArrays(gl.LINES, 0, pts.length / 4);
      gl.disable(gl.BLEND); gl.depthMask(true);
    }
    gl.bindVertexArray(null);
    glyphEnd(cw, chh);
    spaceOverlay(now);
    return true;
  }
  // Over the view in space: the stars and galaxies, the windshield's frame, the mark, the black of the fall.
  function spaceOverlay(now) {
    var c = hud.getContext("2d"), dpr = min(2, window.devicePixelRatio || 1), W = hud.width / dpr, H = hud.height / dpr, f = H / 2 / T35;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    // the stick's water, under the thumb, as on the planet
    water.step(min(0.05, (now - (water.last || now)) / 1000), stillMotion.matches); water.last = now; water.draw(c, now / 1000, stillMotion.matches);
    // the windshield: its frame the figure's three tones, lit along its top, grey at its sides, dark along its sill
    var u = sightU() * f, bw = max(3, u / 3), x0 = W * 0.08, x1 = W * 0.92, y0 = H * 0.1, y1 = H / 2 + f * Math.tan(AIM) * 0.62;
    c.lineCap = "butt";
    c.strokeStyle = "rgba(234,230,220,0.85)"; c.lineWidth = bw; c.beginPath(); c.moveTo(x0 + W * 0.06, y0); c.lineTo(x1 - W * 0.06, y0); c.stroke();
    c.strokeStyle = "rgba(150,146,140,0.85)"; c.beginPath(); c.moveTo(x0 + W * 0.06, y0); c.lineTo(x0, y1); c.moveTo(x1 - W * 0.06, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = "rgba(30,28,26,0.9)"; c.beginPath(); c.moveTo(x0, y1); c.lineTo(x1, y1); c.stroke();
    // the mark: the sight's figure and its holding circles, slightly below the centre
    var cx = W / 2, cy = H / 2 + f * Math.tan(markDrop()), hair = 1;
    SIGHT_F.forEach(function (F) { var r = F * u / Math.sqrt(3); twoTone(c, function () { c.beginPath(); c.arc(cx, cy + r, r, 0, Math.PI * 2); }, hair); });
    var fm = figureMark(round(u * dpr), 0, 0, 0);
    c.drawImage(fm.cv, cx - fm.ox / dpr, cy - fm.oy / dpr, fm.cv.width / dpr, fm.cv.height / dpr);
    noseMark(c, cx, cy, u, hair);
    // each one coming, held in a triangle of the unit (pointing down, as the mark's figure does not), the last in the glow
    space.enemies.forEach(function (e) {
      var q = [0, 0, 0, 0];
      for (var i = 0; i < 4; i++) { q[i] = vp[i] * e.p[0] + vp[4 + i] * e.p[1] + vp[8 + i] * e.p[2] + vp[12 + i]; }
      if (q[3] <= 0.5) { return; }
      var x = (q[0] / q[3] * 0.5 + 0.5) * W, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * H, r = max(u * 0.9, f * SPACE.R / q[3]);
      if (x < -r || y < -r || x > W + r || y > H + r) { return; }
      twoTone(c, function () { c.beginPath(); c.moveTo(x - r, y - r * 0.58); c.lineTo(x + r, y - r * 0.58); c.lineTo(x, y + r * 1.15); c.closePath(); }, e.last ? 2 : 1);
      if (e.last) { c.strokeStyle = "#f3c98b"; c.lineWidth = 1; c.beginPath(); c.moveTo(x - r, y - r * 0.58); c.lineTo(x + r, y - r * 0.58); c.lineTo(x, y + r * 1.15); c.closePath(); c.stroke(); }
    });
    if (space.black > 0) { c.fillStyle = "rgba(5,3,2," + space.black.toFixed(3) + ")"; c.fillRect(0, 0, W, H); }
    if (space.phase === "wake") {
      var shut = (1 - lids(1.2 + (now - space.t0) / 1000)) * H / 2;
      c.fillStyle = "#050302"; c.fillRect(0, 0, W, shut); c.fillRect(0, H - shut, W, shut);
    }
  }

  /* ---- Glyph Light, and the monarch ----------------------------------------------------------------------------------
     The artist, 26 Oct 2026, with "Glyph Light", a page that turns a picture into glowing glyphs: "by implementing this
     aesthetic into holographic Mr. Pearl, instead of the current pixelated aesthetic, we can now play with what a thing
     looks like relative to your distance from it ... take that to the next level and use the way that the size of the
     character relative to the displayed fineness of an image changes as you approach the object".
     The world is drawn into a picture of its own (glyphFb: colour, and depth), and the picture drawn again as glyphs:
     each a cell of the screen whose side goes as the square of nearness (GLYPH.S0 px at GLYPH.D0 m, so a thing twice
     as near is drawn in glyphs four times as large: a couple of characters close by, many far off), its glyph from the
     ramp by the cell's brightness (the page's is " .:-=+*#%@"; here the figure's, below), lit in the cell's colour and added as light, as the page
     adds its glow; the picture shows faintly under the glyphs, as the page's "image under glyphs" does. Where the cells
     would be smaller than GLYPH.MIN px the picture shows as it is, eased in over the octave above: far off, a thing is
     itself, refined. The sky is the picture. */
  var GLYPH = { ON: 1, S0: 6, D0: 3.2, MIN: 2, RAMP: " .:-=+*#%@", UNDER: 0.3, LIT: 1.4, PANEL: 12, GRID: 8, STORY: 1 };   // S0, MIN in CSS px; PANEL in m
  var glyphFb = null, glyphProg = null, GLU = {}, glyphAtlas = null, glyphLive = false, glyphTable = null, glyphFrames = null, glyphOrigin = [0, 0];
  /* Glyph Light's whole space (the artist, 27 Oct 2026, by way of the DRIFT session: "Make sure you are using the full
     dimensionality of the Glygh Light artifact. Make sure all of the changes available through the provided slide bars
     are being implemented in all of the artifacts ... Keep in mind that the infinite texture that you are displaying is
     a storyboard and someone's thumb is the direction of how the story plays out ... almost like a flip book but
     instead of each sticky note being behind the other, they are placed side-by-side"). Every control the page has is
     here: its styles (ASCII, dots, grain, scan), its glyph sets (fine, blocks, binary, kana, kanji, and a custom set,
     here the figure's own, the first), its colour modes (full, mono, gold, blue), auto levels, exposure, contrast,
     midtones, detail, invert, glow and where the glow starts, the image under the glyphs, the density, and its motions
     (pulse, shimmer, reveal, push in). The place is laid out in panels GLYPH.PANEL metres square, the frames of a
     storyboard side by side: the first where he wakes, as Glyph Light first came in (the figure's set, ASCII's way,
     full colour), each next a step from the one before (one slider moved, or a style, a set, a mode or a motion
     changed), running in a serpentine so that a frame's neighbours are the frames before and after it, GLYPH.GRID by
     GLYPH.GRID of them and again past the last. Walking plays them: the thumb on the stick turns the pages, and each
     page is seen beside the next. The size of a glyph by distance stays the artist's own (S0 at D0, as the square of
     nearness), each frame's density a factor on it. */
  var GSETS = [null, " .:-=+*#%@", " .·:;irsXA253hMHGS#9B&@", " ░▒▓█", " 01",
               " ･ｰｨｼﾉﾍﾄｦｺﾆﾐﾘﾈﾎﾑﾒﾜﾓﾗﾊﾏﾝｱｶｻﾀﾅ",
               " 一二人口山日目田白百自血鬼龍"];
  var GROW = 32;   // the most glyphs a set carries: a row of the atlas each, 64 px a glyph
  function glyphInit() {
    // The figure's set (the artist, 27 Oct 2026, asked which, "Both"): blank, the tribar at five sizes, the artist's
    // figure of three at three, and the tribar with all its faces lit, each with the page's glow (a blur of its own
    // light); the page's sets each glyph in the type. Every set sorted by the ink it leaves, as the page sorts any set.
    var T = [[255, 255, 255], [150, 150, 150], [70, 70, 70]], rows = [];
    var fig = [null];
    [0.3, 0.42, 0.56, 0.72, 0.88].forEach(function (s) { fig.push({ lv: 1, s: s, t: T }); });
    [0.72, 0.88, 1].forEach(function (s) { fig.push({ lv: 2, s: s, t: T }); });
    fig.push({ lv: 1, s: 1, t: [[255, 255, 255], [235, 235, 235], [205, 205, 205]] });
    var draw = function (q, c2, x0, y0) {
      if (!q) { return; }
      if (q.ch) { c2.font = "700 52px ui-monospace, SFMono-Regular, Menlo, 'Noto Sans JP', monospace"; c2.textAlign = "center"; c2.textBaseline = "middle"; c2.fillStyle = "#fff"; c2.fillText(q.ch, x0 + 32, y0 + 35); return; }
      var f = figure(round(60 * q.s), q.lv, q.t);
      c2.shadowColor = "#fff"; c2.shadowBlur = 8;
      c2.drawImage(f, x0 + (64 - f.width) / 2, y0 + (64 - f.height) / 2 + 2);
      c2.shadowBlur = 0;
    };
    var ink = function (q) {
      var t = document.createElement("canvas"); t.width = t.height = 64; var tc = t.getContext("2d");
      tc.fillStyle = "#000"; tc.fillRect(0, 0, 64, 64); draw(q, tc, 0, 0);
      var d = tc.getImageData(0, 0, 64, 64).data, sum = 0; for (var k = 0; k < d.length; k += 4) { sum += d[k]; }
      return sum;
    };
    GSETS.forEach(function (set, i) {
      var list = i === 0 ? fig : set.split("").map(function (ch) { return ch === " " ? null : { ch: ch }; });
      list = list.slice(0, GROW).map(function (q) { return { q: q, light: q ? ink(q) : 0 }; });
      list.sort(function (a, b) { return a.light - b.light; });
      rows.push(list.map(function (e) { return e.q; }));
    });
    GLYPH.NS = rows.map(function (r) { return r.length; });
    GLYPH.N = GLYPH.NS[0];
    var cv = document.createElement("canvas"); cv.width = 64 * GROW; cv.height = 64 * rows.length;
    var c = cv.getContext("2d");
    c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
    rows.forEach(function (r, j) { r.forEach(function (q, i) { draw(q, c, i * 64, j * 64); }); });
    glyphAtlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, glyphAtlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    glyphProg = compile("#version 300 es\nvoid main() { vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0); }", [
      "#version 300 es",
      "precision highp float; precision highp int;",
      "uniform sampler2D uScene; uniform sampler2D uDepth; uniform sampler2D uAtlas; uniform sampler2D uTable;",
      "uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform float uS0; uniform float uD0; uniform float uMin; uniform float uLit; uniform float uT; uniform float uPanel;",
      "uniform int uGrid; uniform int uStory; uniform float uNs[7]; uniform mat4 uInvVP; uniform vec2 uOrigin;",
      "out vec4 o;",
      "const float BAY[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);",
      "float bayer(ivec2 c) { return (BAY[(c.y & 3) * 4 + (c.x & 3)] + 0.5) / 16.0; }",
      "float hash(ivec2 c) { uint h = uint(c.x) * 0x27d4eb2du ^ (uint(c.y) * 0x165667b1u + 1337u); h ^= h >> 15; h *= 0x2c1b3c6du; h ^= h >> 12; h *= 0x297a2d39u; h ^= h >> 15; return float(h) / 4294967296.0; }",
      "float lumOf(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
      "vec3 tint(vec3 c, float l, int m) { if (m == 0) { return c; } if (m == 1) { return vec3(l); } if (m == 2) { return vec3(min(1.0, l * 1.1 + 0.078), l * 0.82, l * 0.35); } return vec3(l * 0.35, l * 0.75, min(1.0, l * 1.1 + 0.078)); }",
      "void main() {",
      "  ivec2 ip = ivec2(gl_FragCoord.xy);",
      "  vec4 pic = texelFetch(uScene, ip, 0);",
      "  if (pic.a > 0.25 && pic.a < 0.75) { o = vec4(pic.rgb, 1.0); return; }",   // his head: the one thing seen as it is
      "  float z = texelFetch(uDepth, ip, 0).r;",
      "  if (z >= 1.0) { o = vec4(pic.rgb, 1.0); return; }",
      "  float d = 2.0 * uNear * uFar / (uFar + uNear - (z * 2.0 - 1.0) * (uFar - uNear));",
      // the frame of the storyboard the place under this pixel lies in (serpentine: neighbours are the next and the last)
      "  int fr = 0;",
      "  if (uStory > 0) {",
      "    vec4 W = uInvVP * vec4(gl_FragCoord.xy / uRes * 2.0 - 1.0, z * 2.0 - 1.0, 1.0); W /= W.w;",
      "    ivec2 pn = ivec2(floor((W.xz - uOrigin) / uPanel));",
      "    int i = pn.x - uGrid * int(floor(float(pn.x) / float(uGrid))), j = pn.y - uGrid * int(floor(float(pn.y) / float(uGrid)));",   // (a wrap that holds below nought, where % does not)
      "    fr = j * uGrid + ((j & 1) == 0 ? i : uGrid - 1 - i);",
      "  }",
      "  vec4 t0 = texelFetch(uTable, ivec2(0, fr), 0), t1 = texelFetch(uTable, ivec2(1, fr), 0), t2 = texelFetch(uTable, ivec2(2, fr), 0), t3 = texelFetch(uTable, ivec2(3, fr), 0);",
      "  int style = int(t0.r * 3.0 + 0.5), set = int(t0.g * 6.0 + 0.5), mode = int(t0.b * 3.0 + 0.5), motion = int(t0.a * 4.0 + 0.5);",
      "  float dens = 0.5 + t1.r * 1.5, expo = exp2(t1.g * 2.0 - 1.0), contr = 0.5 + t1.b * 1.5, gam = 0.5 + t1.a * 1.5;",
      "  float detail = t2.r * 2.0, inv = t2.g, glow = t2.b * 1.5, thresh = t2.a, under = t3.r, autoL = t3.g;",
      "  float s = uS0 * dens * (uD0 / d) * (uD0 / d);",
      "  if (motion == 1) { s *= 1.0 + 0.25 * sin(uT * 2.4); }",                  // pulse
      "  if (motion == 4) { s *= exp2(-fract(uT * 0.12) * 1.2); }",              // push in
      "  if (s < uMin) { o = vec4(pic.rgb, 1.0); return; }",
      "  float L = min(floor(log2(s) + 0.5), 8.0), cs = exp2(L);",
      "  vec2 cell = floor(gl_FragCoord.xy / cs), uv = (gl_FragCoord.xy - cell * cs) / cs;",
      "  ivec2 ci = ivec2(cell);",
      "  vec2 at = (cell + 0.5) * cs / uRes;",
      // the tone: auto levels, exposure, contrast, midtones
      "  vec2 lohi = autoL > 0.5 ? vec2(0.04, 0.85) : vec2(0.0, 1.0);",
      "  vec3 c = (textureLod(uScene, at, L).rgb - lohi.x) / (lohi.y - lohi.x);",
      "  c = pow(clamp((c * expo - 0.5) * contr + 0.5, 0.0, 1.0), vec3(1.0 / gam));",
      "  float l = lumOf(c);",
      "  if (detail > 0.0) { float ln = lumOf(textureLod(uScene, at, L + 1.5).rgb); float l2 = clamp(l + detail * (l - ln), 0.0, 1.0); c = l > 0.002 ? min(vec3(1.0), c * (l2 / l)) : vec3(0.0); l = l2; }",
      "  if (inv > 0.5) { c = 1.0 - c; l = 1.0 - l; }",
      "  vec3 col = tint(c, l, mode);",
      "  if (motion == 3 && hash(ci) > fract(uT * 0.2) * 1.25) { o = vec4(pic.rgb, 1.0); return; }",   // reveal: the sweep not yet past the cell
      "  float N = uNs[set], cov = 0.0; vec3 lit = vec3(0.0);",
      "  ivec2 sh = motion == 2 ? ivec2(int(uT * 6.0), 0) : ivec2(0);",            // shimmer: the glyphs step with the time
      "  if (style == 0) {",
      "    float gi = min(floor(l * N), N - 1.0);",
      "    if (motion == 2) { gi = clamp(gi + floor(hash(ci + sh) * 3.0) - 1.0, 0.0, N - 1.0); }",
      "    if (gi > 0.0) { cov = textureLod(uAtlas, vec2((gi + uv.x) / 32.0, (float(set) + 1.0 - uv.y) / 7.0), max(0.0, 6.0 - L)).r; lit = min(vec3(1.0), col / (0.55 + 0.45 * l)); }",
      "  } else if (style == 1) {",
      "    if (all(greaterThanEqual(uv, vec2(0.14))) && all(lessThan(uv, vec2(0.86)))) {",
      "      if (l > bayer(ci + sh)) { lit = min(vec3(1.0), col * (1.25 / max(0.35, max(col.r, max(col.g, col.b))))); cov = 1.0; } else if (l > 0.03) { lit = col * 0.35; cov = 1.0; }",
      "    }",
      "  } else if (style == 2) {",
      "    if (l > hash(ci + sh)) { lit = min(vec3(1.0), col * (0.45 + 0.75 * l) + 0.078 * l); cov = 1.0; } else if (l > 0.04) { lit = col * 0.22; cov = 1.0; }",
      "  } else {",
      "    if (l >= 0.04 && uv.x < 0.82 && abs(uv.y - 0.5) < (0.12 + 0.6 * l) * 0.5) { lit = min(vec3(1.0), col * (0.6 + 0.6 * l) + 0.157 * l * l); cov = 1.0; }",
      "  }",
      "  vec3 g = lit * cov * (set == 0 && style == 0 ? uLit : 1.0) + col * under;",
      "  if (glow > 0.0 && l >= thresh) { g += lit * cov * glow * 0.6; }",
      // the glow's halo: the picture a few octaves softer, where it is over the threshold
      "  if (glow > 0.0) { vec3 hal = textureLod(uScene, gl_FragCoord.xy / uRes, L + 2.5).rgb; g += hal * glow * 0.5 * smoothstep(thresh, min(1.0, thresh + 0.2), lumOf(hal)); }",
      "  o = vec4(mix(pic.rgb, g, smoothstep(uMin, 2.0 * uMin, s)), 1.0);",
      "}"].join("\n"));
    ["uScene", "uDepth", "uAtlas", "uTable", "uRes", "uNear", "uFar", "uS0", "uD0", "uMin", "uLit", "uT", "uPanel", "uGrid", "uStory", "uNs", "uInvVP", "uOrigin"].forEach(function (k) { GLU[k] = gl.getUniformLocation(glyphProg, k); });
  }
  // The storyboard: GRID x GRID frames, the first as Glyph Light came in, each next one step from the last, every
  // style, set, mode and motion somewhere in it (those the walk of steps missed set into its later frames).
  function glyphStory() {
    var n = GLYPH.GRID * GLYPH.GRID, r = Pl.rng(seed * 23 + 11), out = [];
    var f = { style: 0, set: 0, mode: 0, motion: 0, dens: 1, expo: 0, contr: 1, gam: 1, detail: 0, inv: 0, glow: 0.35, thresh: 0.7, under: GLYPH.UNDER, auto: 0 };
    var steps = [
      function () { f.style = (f.style + 1 + floor(r() * 3)) % 4; }, function () { f.set = (f.set + 1 + floor(r() * 6)) % 7; },
      function () { f.mode = (f.mode + 1 + floor(r() * 3)) % 4; }, function () { f.motion = (f.motion + 1 + floor(r() * 4)) % 5; },
      function () { f.dens = clampV(f.dens * (r() < 0.5 ? 0.75 : 1.33), 0.5, 2); }, function () { f.expo = clampV(f.expo + (r() - 0.5) * 0.8, -1, 1); },
      function () { f.contr = clampV(f.contr + (r() - 0.5) * 0.6, 0.6, 1.8); }, function () { f.gam = clampV(f.gam + (r() - 0.5) * 0.5, 0.6, 1.6); },
      function () { f.detail = clampV(f.detail + (r() < 0.5 ? -0.5 : 0.5), 0, 2); }, function () { f.inv = f.inv ? 0 : (r() < 0.3 ? 1 : 0); },
      function () { f.glow = clampV(f.glow + (r() - 0.5) * 0.6, 0, 1.5); }, function () { f.thresh = clampV(f.thresh + (r() - 0.5) * 0.3, 0.4, 0.95); },
      function () { f.under = clampV(f.under + (r() - 0.5) * 0.3, 0.05, 0.7); }, function () { f.auto = f.auto ? 0 : 1; }
    ];
    for (var i = 0; i < n; i += 1) { if (i) { steps[floor(r() * steps.length)](); } out.push(Object.assign({}, f)); }
    var at = 8;
    [["style", 4], ["set", 7], ["mode", 4], ["motion", 5]].forEach(function (dv) {
      for (var v = 0; v < dv[1]; v += 1) {
        if (!out.some(function (q) { return q[dv[0]] === v; })) { out[at % n][dv[0]] = v; at += 5; }
      }
    });
    if (!out.some(function (q) { return q.inv; })) { out[(at += 5) % n].inv = 1; }
    if (!out.some(function (q) { return q.auto; })) { out[(at += 5) % n].auto = 1; }
    return out;
  }
  // The table the pass reads: four texels a frame (its choices; density, exposure, contrast, midtones; detail, invert,
  // glow, where the glow starts; the image under), a row each; the frames' first where he wakes.
  function glyphStoryPlace() {
    glyphFrames = glyphStory();
    var t = underTree(), P0 = GLYPH.PANEL;
    glyphOrigin = [t.x - P0 / 2, t.z - P0 / 2];
    var b = function (v) { return round(clampV(v, 0, 1) * 255); }, d = new Uint8Array(4 * 4 * glyphFrames.length);
    glyphFrames.forEach(function (q, i) {
      var o = i * 16;
      [q.style / 3, q.set / 6, q.mode / 3, q.motion / 4, (q.dens - 0.5) / 1.5, (q.expo + 1) / 2, (q.contr - 0.5) / 1.5, (q.gam - 0.5) / 1.5,
       q.detail / 2, q.inv, q.glow / 1.5, q.thresh, q.under, q.auto, 0, 0].forEach(function (v, k) { d[o + k] = b(v); });
    });
    if (!glyphTable) { glyphTable = gl.createTexture(); }
    gl.bindTexture(gl.TEXTURE_2D, glyphTable);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 4, glyphFrames.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, d);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }
  // The picture the world is drawn into, as large as the canvas: colour with its octaves (read a cell's mean from the
  // one its size names), and depth; drawn first into a multisampled copy and resolved into it, so that what shows as
  // the picture far off keeps the canvas's antialiasing.
  function glyphBegin(cw, chh) {
    if (!GLYPH.ON) { return; }
    if (!glyphProg) { try { glyphInit(); } catch (e) { GLYPH.ON = 0; return; } }
    if (!glyphFb || glyphFb.w !== cw || glyphFb.h !== chh) {
      if (glyphFb) { gl.deleteFramebuffer(glyphFb.fb); gl.deleteTexture(glyphFb.col); gl.deleteTexture(glyphFb.dep); if (glyphFb.ms) { gl.deleteFramebuffer(glyphFb.ms); gl.deleteRenderbuffer(glyphFb.msC); gl.deleteRenderbuffer(glyphFb.msD); } }
      var col = gl.createTexture(), dep = gl.createTexture(), fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, col);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, cw, chh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindTexture(gl.TEXTURE_2D, dep);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, cw, chh, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, col, 0);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, dep, 0);
      glyphFb = { fb: fb, col: col, dep: dep, w: cw, h: chh, ok: gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE };
      if (!glyphFb.ok) { GLYPH.ON = 0; gl.bindFramebuffer(gl.FRAMEBUFFER, null); return; }   // (a device without it keeps the picture)
      // (four samples, two on a canvas over a million and a half pixels: the copy costs memory the canvas's own does)
      var ns = min(cw * chh > 1.5e6 ? 2 : 4, gl.getParameter(gl.MAX_SAMPLES) || 0);
      if (ns > 1) {
        var ms = gl.createFramebuffer(), msC = gl.createRenderbuffer(), msD = gl.createRenderbuffer();
        gl.bindRenderbuffer(gl.RENDERBUFFER, msC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ns, gl.RGBA8, cw, chh);
        gl.bindRenderbuffer(gl.RENDERBUFFER, msD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, ns, gl.DEPTH_COMPONENT24, cw, chh);
        gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, msC);
        gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, msD);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) { glyphFb.ms = ms; glyphFb.msC = msC; glyphFb.msD = msD; }
        else { gl.deleteFramebuffer(ms); gl.deleteRenderbuffer(msC); gl.deleteRenderbuffer(msD); }
      }
    }
    if (glyphFb.ok) { gl.bindFramebuffer(gl.FRAMEBUFFER, glyphFb.ms || glyphFb.fb); glyphLive = true; }
  }
  // The picture drawn again on the canvas, as glyphs.
  function glyphEnd(cw, chh) {
    glyphLive = false;
    if (!GLYPH.ON || !glyphFb || !glyphFb.ok) { return; }
    if (glyphFb.ms) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, glyphFb.ms); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, glyphFb.fb);
      gl.blitFramebuffer(0, 0, cw, chh, 0, 0, cw, chh, gl.COLOR_BUFFER_BIT, gl.NEAREST);
      gl.blitFramebuffer(0, 0, cw, chh, 0, 0, cw, chh, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, glyphFb.col); gl.generateMipmap(gl.TEXTURE_2D);
    gl.viewport(0, 0, cw, chh);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE);
    gl.useProgram(glyphProg);
    gl.bindVertexArray(null);
    if (!glyphTable) { glyphStoryPlace(); }
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, glyphFb.col);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, glyphFb.dep);
    gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D, glyphAtlas);
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, glyphTable);
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(GLU.uScene, 2); gl.uniform1i(GLU.uDepth, 3); gl.uniform1i(GLU.uAtlas, 4); gl.uniform1i(GLU.uTable, 5);
    gl.uniform2f(GLU.uRes, cw, chh); gl.uniform1f(GLU.uNear, NEAR); gl.uniform1f(GLU.uFar, FAR);
    // (sizes in CSS px, made the canvas's: as large on the screen on any device, or on a coarser canvas)
    var k = cw / max(1, window.innerWidth);
    gl.uniform1f(GLU.uS0, GLYPH.S0 * k); gl.uniform1f(GLU.uD0, GLYPH.D0); gl.uniform1f(GLU.uMin, GLYPH.MIN * k); gl.uniform1f(GLU.uLit, GLYPH.LIT);
    gl.uniform1f(GLU.uT, stillMotion.matches ? 0 : performance.now() / 1000); gl.uniform1f(GLU.uPanel, GLYPH.PANEL);
    gl.uniform1i(GLU.uGrid, GLYPH.GRID); gl.uniform1i(GLU.uStory, GLYPH.STORY ? 1 : 0); gl.uniform1fv(GLU.uNs, GLYPH.NS);
    gl.uniformMatrix4fv(GLU.uInvVP, false, invert(vp)); gl.uniform2f(GLU.uOrigin, glyphOrigin[0], glyphOrigin[1]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST);
  }

  /* The monarch (the artist, 26 Oct 2026: "I want you to implement a butterfly flying in a loop that runs: flying in
     circle and then a straight line. and as you approach the butterfly the way that it looks will become more like a
     couple of characters whereas the further you are from the butterfly, the more refined it looks like a butterfly.
     Make it a monarch"). Danaus plexippus, ten centimetres across: orange wings veined in black, a black border with
     two rows of white spots. It flies a loop over the lawn where you wake, between two points nine metres apart: a
     whole turn and a half about the first, the straight line to the second along one side, a turn and a half there, and
     the straight line back along the other, at 2.2 m/s, a metre and a half up, its wings beating six times a second.
     It is drawn into the world, so Glyph Light draws it too: near, a couple of characters; far, the monarch. */
  var MONARCH = { R: 1.4, D: 9, V: 2.2, UP: 1.5, SPAN: 0.1, HZ: 6 }, monarch = null, monProg = null, MU = {}, monTex = null, monVao = null;
  function monarchInit() {
    // its wing, the right one (the left is it mirrored): fore and hind wing drawn on a canvas, the body at the left edge
    var cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
    var c = cv.getContext("2d"), o = "#e8771d", k = "#140c08";
    c.clearRect(0, 0, 128, 128);
    var fore = function () { c.beginPath(); c.moveTo(4, 66); c.bezierCurveTo(20, 30, 70, 6, 122, 10); c.bezierCurveTo(118, 34, 104, 54, 78, 66); c.closePath(); };
    var hind = function () { c.beginPath(); c.moveTo(4, 66); c.bezierCurveTo(40, 62, 92, 72, 96, 98); c.bezierCurveTo(90, 122, 46, 126, 14, 104); c.closePath(); };
    [fore, hind].forEach(function (w) {
      c.fillStyle = k; w(); c.fill();
      c.save(); w(); c.clip(); c.fillStyle = o;
      c.beginPath(); c.moveTo(10, 66); c.lineTo(110, 18); c.lineTo(98, 40); c.lineTo(74, 60); c.lineTo(84, 96); c.lineTo(48, 112); c.lineTo(16, 96); c.closePath(); c.fill();
      // the veins, black
      c.strokeStyle = k; c.lineWidth = 2.2;
      [[8, 66, 112, 16], [8, 66, 100, 38], [8, 66, 78, 60], [8, 66, 88, 92], [8, 66, 60, 112], [8, 66, 30, 106], [40, 48, 70, 30], [40, 80, 70, 90]].forEach(function (v) { c.beginPath(); c.moveTo(v[0], v[1]); c.lineTo(v[2], v[3]); c.stroke(); });
      c.restore();
    });
    // the border's white spots
    c.fillStyle = "#f4efe6";
    [[118, 14], [112, 22], [116, 30], [106, 40], [98, 50], [88, 60], [92, 100], [80, 112], [64, 118], [44, 118], [28, 110], [104, 12], [94, 10]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 1.8, 0, Math.PI * 2); c.fill(); });
    // the body
    c.fillStyle = k; c.fillRect(0, 50, 6, 40);
    monTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, monTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    monProg = compile("#version 300 es\nlayout(location=0) in vec4 a; uniform mat4 uVP; uniform mat4 uM; uniform float uFlap; out vec2 vT;\n" +
      "void main() { float sd = a.x < 0.0 ? -1.0 : 1.0; float x = abs(a.x); vec3 p = vec3(sd * x * cos(uFlap), x * sin(uFlap), a.y); vT = vec2(a.z, a.w); gl_Position = uVP * uM * vec4(p, 1.0); }",
      "#version 300 es\nprecision mediump float; uniform sampler2D uTex; in vec2 vT; out vec4 o;\nvoid main() { vec4 c = texture(uTex, vT); if (c.a < 0.5) { discard; } o = vec4(c.rgb, 1.0); }");
    ["uVP", "uM", "uFlap", "uTex"].forEach(function (k2) { MU[k2] = gl.getUniformLocation(monProg, k2); });
    // two quads, x out from the body (right +, left -), y along it (head +), (u, v) on the wing's canvas
    var h = MONARCH.SPAN / 2, q = [];
    [1, -1].forEach(function (sd) {
      var P0 = [0, h * 0.62, 0, 0], P1 = [sd * h, h * 0.62, 1, 0], P2 = [sd * h, -h * 0.62, 1, 1], P3 = [0, -h * 0.62, 0, 1];
      q.push(P0, P1, P2, P0, P2, P3);
    });
    var buf = gl.createBuffer(); monVao = gl.createVertexArray();
    gl.bindVertexArray(monVao); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([].concat.apply([], q)), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }
  // Its loop over the lawn where you wake: A a few steps from the tree toward the wreck, B nine metres on, across.
  function monarchPlace() {
    var t = place.tree, wr = place.wreck, s = underTree();
    if (!t || !wr) { monarch = null; return; }
    var ax = wr.x + 0.5 - (t.x + 0.5), az = wr.z + 0.5 - (t.z + 0.5), L = hypot(ax, az) || 1; ax /= L; az /= L;
    var A = [s.x + ax * 3, s.z + az * 3], dir = [-az, ax];
    if (A[0] + dir[0] * MONARCH.D < 4 || A[0] + dir[0] * MONARCH.D > w.SX - 4 || A[1] + dir[1] * MONARCH.D < 4 || A[1] + dir[1] * MONARCH.D > w.SZ - 4) { dir = [az, -ax]; }
    var gy = function (x, z) { var X = clampV(floor(x), 0, w.SX - 1), Z = clampV(floor(z), 0, w.SZ - 1); return w.top[Z * w.SX + X] + 1; };
    monarch = { A: A, dir: dir, y: max(gy(A[0], A[1]), gy(A[0] + dir[0] * MONARCH.D, A[1] + dir[1] * MONARCH.D)) + MONARCH.UP, t0: performance.now() };
  }
  // Where it is at time t (s) along its loop: [x, y, z, yaw].
  function monarchAt(t) {
    var M = MONARCH, r = M.R, turn = 3 * Math.PI * r, len = 2 * turn + 2 * M.D, s = ((t * M.V) % len + len) % len, d = monarch.dir, n = [d[1], -d[0]];
    // (in the loop's own frame: x along A to B, y to its left; A at 0, B at D; turns counterclockwise)
    var lx, ly, hx, hy;
    if (s < turn) { var a = -Math.PI / 2 + s / r; lx = r * Math.cos(a); ly = r * Math.sin(a); hx = -Math.sin(a); hy = Math.cos(a); }
    else if (s < turn + M.D) { lx = s - turn; ly = -r; hx = 1; hy = 0; }
    else if (s < 2 * turn + M.D) { var b = -Math.PI / 2 + (s - turn - M.D) / r; lx = M.D + r * Math.cos(b); ly = r * Math.sin(b); hx = -Math.sin(b); hy = Math.cos(b); }
    else { lx = M.D - (s - 2 * turn - M.D); ly = r; hx = -1; hy = 0; }
    var x = monarch.A[0] + d[0] * lx - n[0] * ly, z = monarch.A[1] + d[1] * lx - n[1] * ly, vx = d[0] * hx - n[0] * hy, vz = d[1] * hx - n[1] * hy;
    return [x, monarch.y + 0.25 * Math.sin(t * 1.3), z, Math.atan2(vx, -vz)];
  }
  function drawMonarch(now) {
    if (!monarch || intro && (now - intro.t0) < 4000) { return; }
    if (!monProg) { monarchInit(); }
    var t = (now - monarch.t0) / 1000, p = monarchAt(t), cy = Math.cos(p[3]), sy = Math.sin(p[3]);
    // its frame (columns): its right, the world's up, its way forward (the quads' body), where it is
    var M = [cy, 0, sy, 0, 0, 1, 0, 0, sy, 0, -cy, 0, p[0], p[1], p[2], 1];
    gl.useProgram(monProg);
    gl.uniformMatrix4fv(MU.uVP, false, vp); gl.uniformMatrix4fv(MU.uM, false, M);
    gl.uniform1f(MU.uFlap, 0.15 + 1.0 * (0.5 + 0.5 * Math.sin(t * MONARCH.HZ * 2 * Math.PI)));
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, monTex); gl.uniform1i(MU.uTex, 0);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(monVao); gl.drawArrays(gl.TRIANGLES, 0, 12); gl.bindVertexArray(null);
  }

  /* ---- the unit's studies, in characters ------------------------------------------------------------------------------
     The artist, 27 Oct 2026: "Characters are the answer to the basic unit study, still conduct those studies on that
     shape"; and, asked which, both: Glyph Light's glyphs are made of the figure (glyphRamp), and the four studies beside
     the tree are made again with a character as the unit, each where its figure stood, as large, on its mount:
     - the ladder of levels: a character made of characters, an @ drawn in #s, each # itself a glyph;
     - the crux: three As, 8, 13 and 21 thirds of a block tall (the figure's levels 2, 3 and 4), their apexes, the one
       point a letter A shares with the drawing, at one point, with their holding circles, rings of full stops, all
       touching there;
     - the closed curve: the page's ramp, " .:-=+*#%@" and back, round a circle, so that it closes on itself;
     - the sphere of the unit: a character at each of its 136 cells, chosen by the light it takes from the sun, as
       a sphere is drawn in characters (its blocks taken out of the place for them).
     Each character faces the camera, white as the figures were, and is drawn into the world, so Glyph Light draws it
     again in figures where you stand near. */
  var CHARS = " .:-=+*#%@AQ", APEX = 0.23, charProg = null, CU = {}, charAtlas = null, charVao = null, charBuf = null, charCount = 0;
  // A character's cells, rasterised on a grid cols x rows (the ladder's one character in others).
  function charCells(ch, cols, rows) {
    var cv = document.createElement("canvas"); cv.width = cols * 8; cv.height = rows * 8;
    var c = cv.getContext("2d"); c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = "#fff"; c.font = "700 " + round(rows * 8 * 0.95) + "px ui-monospace, SFMono-Regular, Menlo, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    c.fillText(ch, cv.width / 2, cv.height / 2 + rows * 0.4);
    var d = c.getImageData(0, 0, cv.width, cv.height).data, out = [];
    for (var j = 0; j < rows; j += 1) {
      for (var i = 0; i < cols; i += 1) {
        var s = 0;
        for (var y = 0; y < 8; y += 1) { for (var x = 0; x < 8; x += 1) { s += d[((j * 8 + y) * cv.width + i * 8 + x) * 4]; } }
        if (s / 64 > 90) { out.push([i, rows - 1 - j]); }
      }
    }
    return out;
  }
  // The four, as instances [x, y, z, size, glyph, r, g, b], each in its figure's box (the mesh's bounds); the three
  // drawn as figures known by their names, the sphere (built of the place's blocks) by its cells.
  function charStudies() {
    if (!studies || !studies.figures) { return []; }
    var out = [], G = function (ch) { return CHARS.indexOf(ch); }, W = [0.95, 0.93, 0.9];
    var put = function (p, size, ch, col) { out.push(p[0], p[1], p[2], size, G(ch), (col || W)[0], (col || W)[1], (col || W)[2]); };
    var kind = function (name) { return /ladder/i.test(name) ? 0 : /crux/i.test(name) ? 1 : /curve/i.test(name) ? 2 : 3; };
    studies.figures.forEach(function (f) {
      var n = kind(f.name);
      var P0 = f.mesh.pos, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      for (var i = 0; i < P0.length; i += 3) { for (var k = 0; k < 3; k += 1) { lo[k] = min(lo[k], P0[i + k]); hi[k] = max(hi[k], P0[i + k]); } }
      var c = [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2], H = max(1.2, hi[1] - lo[1]), across = [1, 0, 0];
      // (the row runs across the view from where you wake: the characters stand in the plane square to the stone's eye)
      var st = (studies.stands || []).filter(function (q) { return q.i === f.i; })[0];
      if (st) { var ex = c[0] - st.eye[0], ez = c[2] - st.eye[2], L = hypot(ex, ez) || 1; across = [-ez / L, 0, ex / L]; }
      var at = function (u, v, wd) { return [c[0] + across[0] * u - (wd || 0) * across[2], c[1] + v, c[2] + across[2] * u + (wd || 0) * across[0]]; };
      if (n === 0) {
        // the ladder: an @ of 9 x 11 cells, each inked one a # glyph a cell tall
        var cs = H / 11;
        charCells("@", 9, 11).forEach(function (q) { put(at((q[0] - 4) * cs, (q[1] + 0.5) * cs), cs, "#"); });
      } else if (n === 1) {
        // the crux: three As whose apexes meet at one point, and three rings of full stops touching there
        var top = H * 0.98, u = H / 21;
        [8, 13, 21].forEach(function (F) {
          var h = F * u;
          put(at(0, top + APEX * h - h / 2), h, "A");   // (its apex, APEX of its height down, at the top)
          var r = F * u / Math.sqrt(3), m = max(10, round(2 * Math.PI * r / (u * 1.2)));
          for (var k = 0; k < m; k += 1) { var a = k / m * 2 * Math.PI; put(at(Math.sin(a) * r, top - r + Math.cos(a) * r), u * 0.9, "."); }
        });
      } else if (n === 2) {
        // the closed curve: the ramp up and back round a circle, closing on itself
        var R = H * 0.42, ramp = CHARS.slice(1, 10), seq = ramp + ramp.split("").reverse().join(""), m2 = seq.length * 2;
        for (var k2 = 0; k2 < m2; k2 += 1) { var b = k2 / m2 * 2 * Math.PI; put(at(Math.sin(b) * R, H / 2 + Math.cos(b) * R), H * 0.11, seq[k2 % seq.length]); }
      }
    });
    // the sphere of the unit: its cells, each a character by the sun's light on it there, a block's size
    var cells = sphereCells();
    if (cells.length) {
      var mid = [0, 0, 0];
      cells.forEach(function (q) { mid[0] += q[0] / cells.length; mid[1] += q[1] / cells.length; mid[2] += q[2] / cells.length; });
      cells.forEach(function (q) {
        var d = [q[0] - mid[0], q[1] - mid[1], q[2] - mid[2]], r2 = hypot(d[0], d[1], d[2]) || 1;
        var lit = 0.12 + 0.88 * max(0, (d[0] * sunDir[0] + d[1] * sunDir[1] + d[2] * sunDir[2]) / r2);
        put(q, 0.95, CHARS[1 + min(8, floor(lit * 9))]);
      });
    }
    return out;
  }
  // The sphere's cells (the block study: its columns are named with its name in the row's at), taken out of the place once.
  function sphereCells() {
    if (studies.sphere) { return studies.sphere; }
    var cells = [], cols = {};
    (studies.stands || []).forEach(function (st) {
      if (studies.figures.some(function (f) { return f.i === st.i; })) { return; }
      Object.keys(studies.at || {}).forEach(function (key) {
        if (studies.at[key] !== st.name || cols[key]) { return; }
        cols[key] = 1;
        var x = +key.split(",")[0], z = +key.split(",")[1];
        for (var y = floor(st.at[1]); y < floor(st.at[1]) + 12; y += 1) {
          if (w.get(x, y, z) === B.WHITE) { cells.push([x + 0.5, y + 0.5, z + 0.5]); w.set(x, y, z, B.AIR); }
        }
      });
    });
    Object.keys(cols).forEach(function (k) { var q = k.split(","); remeshAt(+q[0], +q[1]); });
    studies.sphere = cells;
    return cells;
  }
  function charsInit() {
    var n = CHARS.length, cv = document.createElement("canvas"); cv.width = 64 * n; cv.height = 64;
    var c = cv.getContext("2d");
    c.fillStyle = "#000"; c.fillRect(0, 0, cv.width, cv.height);
    c.font = "700 56px ui-monospace, SFMono-Regular, Menlo, monospace"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillStyle = "#fff";
    for (var i = 0; i < n; i += 1) { c.fillText(CHARS[i], i * 64 + 32, 34); }
    // where the A's apex is in its cell: its top inked row
    var ai = CHARS.indexOf("A"), dd = c.getImageData(ai * 64, 0, 64, 64).data;
    for (var y = 0; y < 64; y += 1) { var ink = false; for (var x = 0; x < 64; x += 1) { if (dd[(y * 64 + x) * 4] > 128) { ink = true; break; } } if (ink) { APEX = y / 64; break; } }
    charAtlas = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, charAtlas);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D);
    charProg = compile("#version 300 es\nlayout(location=0) in vec4 aP; layout(location=1) in vec4 aC; uniform mat4 uVP; uniform vec3 uR; uniform vec3 uU; uniform float uN; out vec2 vT; out vec3 vC;\n" +
      "const vec2 Q[6] = vec2[6](vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 0.0), vec2(1.0, 1.0), vec2(0.0, 1.0));\n" +
      "void main() { vec2 q = Q[gl_VertexID];\n" +
      "  vec3 p = aP.xyz + (uR * (q.x - 0.5) + uU * (q.y - 0.5)) * aP.w; vT = vec2((aC.x + q.x) / uN, 1.0 - q.y); vC = aC.yzw; gl_Position = uVP * vec4(p, 1.0); }",
      "#version 300 es\nprecision mediump float; uniform sampler2D uTex; uniform vec3 uEye; in vec2 vT; in vec3 vC; out vec4 o;\nvoid main() { float m = texture(uTex, vT).r; if (m < 0.35) { discard; } o = vec4(vC * m, 1.0); }");
    ["uVP", "uR", "uU", "uN", "uTex"].forEach(function (k) { CU[k] = gl.getUniformLocation(charProg, k); });
  }
  function charsUpload() {
    if (!studies && !qcubes.length) { charCount = 0; return; }
    if (!charProg) { charsInit(); }
    var data = charStudies().concat(charCubes());
    charCount = data.length / 8;
    if (!charCount) { return; }
    if (!charVao) { charVao = gl.createVertexArray(); charBuf = gl.createBuffer(); }
    gl.bindVertexArray(charVao); gl.bindBuffer(gl.ARRAY_BUFFER, charBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 32, 0); gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 32, 16); gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);
  }
  function drawChars() {
    if (!charCount) { return; }
    var r = [Math.cos(camLast.yaw), 0, Math.sin(camLast.yaw)], f = lookDir(camLast.yaw, camLast.pitch);
    var u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    if (u[1] < 0) { u = [-u[0], -u[1], -u[2]]; }
    gl.useProgram(charProg);
    gl.uniformMatrix4fv(CU.uVP, false, vp); gl.uniform3fv(CU.uR, r); gl.uniform3fv(CU.uU, u); gl.uniform1f(CU.uN, CHARS.length);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, charAtlas); gl.uniform1i(CU.uTex, 0);
    gl.disable(gl.CULL_FACE);
    gl.bindVertexArray(charVao); gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, charCount); gl.bindVertexArray(null);
  }

  /* ---- the courts: pickleball with his hat, and the ten courts that build the Trojan horse ----------------------------
     The artist, 28 Oct 2026: "Make it games of Pickleball instead of tennis so the court is smaller and you can maintain
     the perspectives of Mr Pearl to play". Before that, 27 Oct 2026: "Put a tennis court in the game in which I can
     play tennis using Mr Pearl's hat as his racket. You use a pearl for the ball whenever you serve and you serve every time. The game is to see how long you
     can keep a pearl one point at a time. Your opponent progressively gets better and better after each level. The
     opponent is Mr Pearl's nemesis." And, the player made a manager: after three points won the court plays on as its
     own series; level two is the next court, a stronger nemesis; each court still playing is a part of an engine
     building a statue, the Trojan horse; a court that loses a match must be played again, a level up, and while it is
     down the building goes slower, a tool taken from it ("no more hammers or no more horses"): "you have to sacrifice".
     A pickleball net stands near where he wakes; a tap on it takes him to the courts, ten side by side, far from the
     place's grid (as space is). The courts are pickleball's, 20 by 44 feet, small enough that his own views play them:
     the third person at rest behind his head, and the Scope, his head the glass and his nose the aim. Court one is level
     one. He serves every point (a tap, a click, the jump, Space, T or Enter), underhand and across, past the kitchen,
     the pearl his ball and his hat the paddle; he swings by himself when the pearl comes within the hat's reach, and his
     return goes where the view looks (turn it, or raise the Scope, to aim). The serve and its return must bounce before
     they are hit (the two-bounce rule), and no one volleys standing in the kitchen. The ring on the court is where the
     nemesis's pearl first comes down. First to three points takes the level; until then he cannot leave the court ("you can't get out of the game that you haven't
     won yet"). The rally, the hits the pearl is kept in play for, is counted and the longest kept. The nemesis is his
     negative: his figure, every colour turned over. Each level it runs faster, reaches further, misses less, hits harder,
     deeper and wider, and from level three drops more and more of its shots short, into his kitchen (dinks).
     A level won, its court plays on by itself: his stand-in against that court's nemesis, a point every few seconds, a
     match after a match, and the higher the level the likelier the nemesis takes a point. Each court playing gives its
     tool to the horse (hammers on court one, horses on two, ...), which rises a part at a time beyond the courts, each
     hoisted from where it lay. A match lost there stops the court: its tool leaves the building, and it waits to be
     played again, a level up. */
  var COURT = {
    O: [-4000, 0, -4000],                  // far from the place's grid (x below nought is air there), as space is
    N: 10, GAP: 12,                        // ten side by side, 12 m apart: a pickleball court (6.10 m) and its run-off
    L: 6.705, HW: 3.05, K: 2.134,          // the half length (44 ft), the half width (20 ft), the kitchen from the net (7 ft)
    NET: 0.864, POST: 0.914, PO: 0.305,    // the net at its middle (34 in) and at the posts (36 in), the posts 12 in out
    G: 9.81, E: 0.64, ROLL: 0.8,           // a ball's own fall, its bounce (78 in dropped to 30-34 in), the court's grip
    REACH: 1.1, HAT: 0.55, WIN: 3,         // the hat's reach round its middle, its middle from his; points to a level
    SKY: [0.72, 0.8, 0.88],
    TOOLS: ["hammers", "horses", "ropes", "pulleys", "chisels", "saws", "ladders", "pegs", "carts", "adzes"],
    WORK: 4800                             // the horse, in court-seconds: all ten playing, eight minutes
  };
  var court = null, courts = null, horse = { work: 0, done: false }, gate = null, courtRng = null, courtHead = null, nemPal = null;
  function courtAt(k) { return [COURT.O[0] + k * COURT.GAP, 0, COURT.O[2]]; }
  function courtsInit() {
    if (courts) { return; }
    courtRng = Pl.rng(seed * 13 + 5);
    courts = [];
    for (var k = 0; k < COURT.N; k += 1) { courts.push({ k: k, level: k + 1, won: false, up: false, you: 0, them: 0, next: 0, t0: 0, matches: 0, lost: 0 }); }
    courts.best = 0;
  }
  // The courts play on wherever he is (from the place's frame too): a point every four to eight seconds on each court
  // that is up, the stand-in taking it at 0.93 less a twentieth a level; the horse built by the courts up.
  function courtsSim(dt, now) {
    if (!courts) { return; }
    var up = 0;
    courts.forEach(function (c) {
      if (!c.up) { return; }
      up += 1;
      if (now < c.next) { return; }
      c.next = now + (4 + 4 * courtRng()) * 1000;
      if (courtRng() < clampV(0.93 - 0.05 * c.level, 0.3, 0.95)) { c.you += 1; } else { c.them += 1; }
      if (c.you >= COURT.WIN) { c.matches += 1; c.you = c.them = 0; }
      else if (c.them >= COURT.WIN) {
        c.up = false; c.level += 1; c.lost += 1; c.you = c.them = 0;
        say("Court " + (c.k + 1) + " lost a match: no more " + COURT.TOOLS[c.k] + " for the horse. Play it again, at level " + c.level + ".");
      }
    });
    if (!horse.done) {
      horse.work = min(COURT.WORK, horse.work + up * dt);
      if (horse.work >= COURT.WORK) { horse.done = true; say("The Trojan horse stands, every part of it in place.", true); }
    }
  }
  // The net near where he wakes: a level patch of ground, five cells square, 7 to 22 m from the tree, clear of the
  // homage, the studies and the wreck; the net runs along the ring round the tree.
  function gatePlace() {
    gate = null;
    var at = underTree(), S = w.SOLID, hb = homage && homage.box, y0 = floor(at.y + 0.01), wr = place.wreck;
    var clear = function (x, z) {
      if (hb && x >= hb[0] - 3 && x <= hb[2] + 3 && z >= hb[1] - 3 && z <= hb[3] + 3) { return false; }
      if (wr && hypot(x - wr.x, z - wr.z) < 9) { return false; }
      return !(studies && studies.stands && studies.stands.some(function (st) { return hypot(x - st.at[0], z - st.at[2]) < 7 || hypot(x - st.eye[0], z - st.eye[2]) < 3; }));
    };
    for (var r = 7; r <= 22 && !gate; r += 1) {
      for (var a = 0; a < 24 && !gate; a += 1) {
        var th = a / 24 * 2 * Math.PI + 0.4, x = floor(at.x + Math.cos(th) * r), z = floor(at.z + Math.sin(th) * r), ok = clear(x + 0.5, z + 0.5);
        for (var dx = -2; dx <= 2 && ok; dx += 1) {
          for (var dz = -2; dz <= 2 && ok; dz += 1) {
            var cx = x + dx, cz = z + dz;
            if (cx < 2 || cz < 2 || cx >= w.SX - 2 || cz >= w.SZ - 2 || !S[w.get(cx, y0 - 1, cz)]) { ok = false; break; }
            for (var k = 0; k < 3; k += 1) { if (w.get(cx, y0 + k, cz) !== B.AIR) { ok = false; break; } }
          }
        }
        // (the net along the ring: its normal, the way through it, points at the tree)
        if (ok) { gate = { x: x + 0.5, y: y0, z: z + 0.5, n: [-Math.cos(th), -Math.sin(th)], said: false }; }
      }
    }
  }
  // Near the net: what it is, once. (Walking through it took him to the courts until 28 Oct 2026, and took him there
  // while he chased a coin past it; now a tap on it does: gateTap.)
  function gateCheck() {
    if (!gate || !me3 || Hd || sight.up || ride || ignite || launched || intro || space) { return false; }
    if (!gate.said && hypot(P.x - gate.x, P.z - gate.z) < 6) { gate.said = true; say("A pickleball net: tap it to go to the courts, where his nemesis waits."); }
    return false;
  }
  // A tap's ray on the net (its posts' width, the ground to the top of the posts), nearer than what else it meets and
  // within the reach a label is read at: to the courts.
  function gateTap(dir, hit) {
    if (!gate || !me3 || Hd || ride || ignite || launched || intro || space) { return false; }
    var n = gate.n, dn = dir[0] * n[0] + dir[2] * n[1];
    if (abs(dn) < 1e-4) { return false; }
    var t = ((gate.x - eye[0]) * n[0] + (gate.z - eye[2]) * n[1]) / dn;
    if (t < passT(dir) || t > LOOK || (hit && hit.t < t)) { return false; }
    var px = eye[0] + dir[0] * t, py = eye[1] + dir[1] * t, pz = eye[2] + dir[2] * t, u = -(px - gate.x) * n[1] + (pz - gate.z) * n[0];
    return abs(u) <= 1.45 && py >= gate.y - 0.05 && py <= gate.y + COURT.POST + 0.1;
  }
  function enterCourts() {
    courtsInit();
    letGo(); dash = null; P.want = null; closeLabel(); closeAsk();
    court = { m: null, t0: performance.now(), told: {}, scope: false, camT: -1e9, camFrom: null };
    var c0 = courtAt(0);
    P.x = c0[0] + 2.2; P.y = 0; P.z = c0[2] + COURT.L + 5; P.vx = P.vy = P.vz = 0; P.yaw = P.face = 0; P.pitch = -0.229; blend = null;
    document.body.dataset.court = "true";
    $("jump").setAttribute("aria-label", "Serve");
    canvas.setAttribute("aria-label", "The courts: ten pickleball courts side by side and the Trojan horse beyond them. Walk onto a court to play its level; a tap, Serve, Space, T or Enter serves; turn the view, or raise the Scope, to aim your return.");
    say("The pickleball courts. Walk onto court one to play level one: first to three points. Behind you, the net takes you back.", true);
    courtWhere();
  }
  // Back through the net behind court one: in the place, on the tree's side of its net, facing the tree.
  function leaveCourts() {
    court = null; onStone = false;
    $("v-sight").setAttribute("aria-pressed", "false");
    delete document.body.dataset.court;
    $("jump").setAttribute("aria-label", "Jump");
    canvas.setAttribute("aria-label", VIEW_LABEL);
    if (gate) {
      P.x = gate.x + gate.n[0] * 1.4; P.z = gate.z + gate.n[1] * 1.4; P.y = gate.y; P.vx = P.vy = P.vz = 0;
      P.yaw = P.face = Math.atan2(gate.n[0], -gate.n[1]); P.pitch = -0.229;
    }
    blend = null; last = 0;
    where();
  }
  // The header's line: the court, its level, the score, the rally and the longest kept.
  function courtWhere() {
    var m = court && court.m, t = "The courts";
    if (m) { t = "Court " + (m.k + 1) + " · level " + m.level + " · you " + m.you + " – " + m.them + " nemesis · rally " + m.rally + " · longest " + courts.best; }
    else { var up = courts.filter(function (c) { return c.up; }).length; t += " · " + up + " of 10 playing · the horse " + round(100 * horse.work / COURT.WORK) + "%"; }
    if ($("where").textContent !== t) { $("where").textContent = t; }
  }
  /* -- a match -- */
  function nemSkill(level) {
    var L = min(level, 14) - 1;
    return { v: 2.2 + 0.25 * L, reach: COURT.REACH * (0.8 + 0.035 * L), wait: 0.5 - 0.025 * L, err: max(0.03, 0.28 - 0.025 * L), T: max(0.85, 1.55 - 0.055 * L),
             wide: min(2.6, 0.3 + 0.25 * L), deep: min(COURT.L - 0.4, 3.4 + 0.3 * L), dink: L >= 2 ? min(0.35, 0.05 * (L - 1)) : 0 };
  }
  function matchOn(k) {
    var c = courts[k], cc = courtAt(k);
    court.m = { k: k, level: c.level, sk: nemSkill(c.level), you: 0, them: 0, n: 0, phase: "serve", t: performance.now(), ball: null, rally: 0, mark: null,
                nem: { x: cc[0], z: cc[2] - COURT.L - 1, goal: null, at: 0, walked: 0, amount: 0, hit: -1e9 }, hit: -1e9, fire: false };
    serveSpot();
    say("Court " + (k + 1) + ", level " + c.level + ": first to three. Serve underhand: a tap, a click, Serve, Space, T or Enter.", true);
  }
  // Behind the baseline, the right of the centre mark on even points and the left on odd, as a server stands.
  function serveSpot() {
    var m = court.m, cc = courtAt(m.k);
    P.x = cc[0] + (m.n % 2 ? -0.9 : 0.9); P.z = cc[2] + COURT.L + 0.4; P.yaw = P.face = (m.n % 2 ? 0.12 : -0.12);
  }
  function netH(lx) { return COURT.NET + (COURT.POST - COURT.NET) * min(1, abs(lx) / (COURT.HW + COURT.PO)); }
  // A shot from b's place to the point (tx, tz, court-local) in T seconds; slower (higher) until it clears the net.
  function shoot(b, k, tx, tz, T) {
    var cc = courtAt(k), lx = b.x - cc[0], lz = b.z - cc[2], r = pearlR(), g = COURT.G;
    for (var i = 0; i < 12; i += 1) {
      var vx = (tx - lx) / T, vz = (tz - lz) / T, vy = (r - b.y + 0.5 * g * T * T) / T, tn = -lz / vz;
      var yn = b.y + vy * tn - 0.5 * g * tn * tn;
      if (tn <= 0 || yn - r > netH(lx + vx * tn) + 0.08) { b.vx = vx; b.vy = vy; b.vz = vz; return; }
      T += 0.1;
    }
    b.vx = (tx - lx) / T; b.vz = (tz - lz) / T; b.vy = (r - b.y + 0.5 * g * T * T) / T;
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
      b.x = nx; b.y = ny; b.z = nz; b.spin += hypot(b.vx, b.vz) * h / r;
    }
    return out;
  }
  // Where a ball now in the air first comes down (court-world x, z), stepping a copy on.
  function ballLands(b, k) {
    var q = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, net: b.net, spin: 0 };
    for (var i = 0; i < 300; i += 1) { var at = ballStep(q, k, 1 / 60); if (at) { return { x: at[0], z: at[1], after: q }; } }
    return null;
  }
  // Where the nemesis meets it: after its bounce, at a hittable height going down, else where it would bounce again.
  function nemMeets(b, k) {
    var q = { x: b.x, y: b.y, z: b.z, vx: b.vx, vy: b.vy, vz: b.vz, net: b.net, spin: 0 }, bounced = false, t = 0;
    for (var i = 0; i < 360; i += 1) {
      var at = ballStep(q, k, 1 / 60); t += 1 / 60;
      if (at) { if (bounced) { return { x: at[0], z: at[1], t: t }; } bounced = true; }
      if (bounced && q.vy < 0 && q.y < 1.3) { return { x: q.x, z: q.z, t: t }; }
    }
    return { x: q.x, z: q.z, t: t };
  }
  function racketAt(x, z, face) { return [x + Math.cos(face) * COURT.HAT, z + Math.sin(face) * COURT.HAT]; }
  function inReach(b, x, z, face, R) { var q = racketAt(x, z, face); return hypot(b.x - q[0], b.z - q[1]) < R && b.y > 0.1 && b.y < 2.2; }
  // A volley (the pearl taken before it bounces) only from the fourth shot on (the serve and its return bounce first)
  // and only standing outside the kitchen.
  function mayVolley(m, z) { return m.rally >= 3 && abs(z - courtAt(m.k)[2]) > COURT.K; }
  function point(toYou, why) {
    var m = court.m;
    if (m.phase !== "rally") { return; }
    if (toYou) { m.you += 1; } else { m.them += 1; }
    courts.best = max(courts.best, m.rally);
    m.phase = "point"; m.t = performance.now(); m.mark = null;
    say(why + " " + m.you + " – " + m.them + ", a rally of " + m.rally + ".");
    courtWhere();
  }
  function matchStep(dt, now, c) {
    var m = court.m, cc = courtAt(m.k), b = m.ball, sk = m.sk, nm = m.nem;
    var press = c.up > 0 || input.fire, fire = press && !m.fire; m.fire = press;
    if (m.phase === "serve") {
      if (fire) { m.phase = "toss"; m.t = now; m.rally = 0; m.ball = null; }
    } else if (m.phase === "toss") {
      // the pearl dropped from his hand and struck underhand below his waist, across into the far service court, past
      // the kitchen
      if (now - m.t >= 300) {
        var s0 = serveFrom();
        b = m.ball = { x: s0[0], y: s0[1], z: s0[2], vx: 0, vy: 0, vz: 0, net: false, spin: 0, last: "you", bounces: 0, serve: true };
        var sx = (m.n % 2 ? 1 : -1) * (0.5 + 2.0 * courtRng());
        shoot(b, m.k, sx, -(COURT.K + 0.6 + courtRng() * (COURT.L - COURT.K - 1.2)), 1.2);
        m.phase = "rally"; m.rally = 1; m.hit = now; nm.goal = null; nm.at = now + sk.wait * 1000;
        courtWhere();
      }
    } else if (m.phase === "rally" && b) {
      var at = ballStep(b, m.k, dt), lz = b.z - cc[2], lx = b.x - cc[0];
      if (at && m.phase === "rally") {
        var side = at[1] - cc[2] > 0 ? "you" : "them", alx = at[0] - cc[0], alz = at[1] - cc[2];
        if (b.bounces === 0) {
          var inn = abs(alx) <= COURT.HW + 0.03 && abs(alz) <= COURT.L + 0.03 && (!b.serve || abs(alz) >= COURT.K - 0.03);
          if (side === b.last) { point(side !== "you", side === "you" ? "Into the net." : "The nemesis puts it into the net."); }
          else if (!inn) { point(b.last !== "you", b.serve ? "The serve fell in the kitchen." : b.last === "you" ? "Out." : "The nemesis hits it out."); }
          else { b.bounces = 1; }
        } else { point(side !== "you", side === "you" ? "It bounced twice: you did not reach it." : "Twice on its side: the nemesis did not reach it."); }
      }
      if (m.phase === "rally") {
        // his swing: when it comes within the hat's reach on his side, gone over the net (after its bounce, or on the
        // volley where a volley may be)
        if (b.last === "them" && !b.net && lz > 0 && b.vz > 0 && (b.bounces === 1 || mayVolley(m, P.z)) && inReach(b, P.x, P.z, P.face, COURT.REACH)) {
          var dz = -(COURT.L - 0.6 - 1.6 * courtRng()), tx = clampV(lx + Math.tan(P.yaw) * (lz - dz), -COURT.HW + 0.3, COURT.HW - 0.3);
          shoot(b, m.k, tx, dz, 1.25);
          b.last = "you"; b.bounces = 0; b.serve = false; m.rally += 1; m.hit = now; nm.goal = null; nm.at = now + sk.wait * 1000;
          courtWhere();
        } else if (b.last === "you" && !b.net && lz < 0 && b.vz < 0 && (b.bounces === 1 || mayVolley(m, nm.z)) && inReach(b, nm.x, nm.z, Math.PI, sk.reach)) {
          // the nemesis's: away from him, deeper and wider as its level is, or a dink into his kitchen; now and then out
          var plx = P.x - cc[0], wx = clampV(-Math.sign(plx || 1) * sk.wide + (courtRng() - 0.5) * 0.8, -COURT.HW + 0.25, COURT.HW - 0.25), wz = min(COURT.L - 0.3, sk.deep + (courtRng() - 0.5)), T = sk.T;
          if (courtRng() < sk.dink) { wz = COURT.K * (0.35 + 0.5 * courtRng()); T = sk.T + 0.25; }
          var e = courtRng();
          if (e < sk.err) { if (e < sk.err / 2) { wz = COURT.L + 0.5 + 0.8 * courtRng(); } else { wx = Math.sign(wx || 1) * (COURT.HW + 0.4 + 0.6 * courtRng()); } }
          shoot(b, m.k, wx, wz, T);
          b.last = "them"; b.bounces = 0; b.serve = false; m.rally += 1; nm.hit = now; nm.goal = null;
          var L0 = ballLands(b, m.k); m.mark = L0 && { x: L0.x, z: L0.z };
          courtWhere();
        }
      }
    } else if (m.phase === "point" && b && now - m.t < 1400) { ballStep(b, m.k, dt);   // (it rolls on while the point is told)
    } else if (m.phase === "point" && now - m.t >= 1400) {
      if (m.you >= COURT.WIN) { levelWon(); return; }
      if (m.them >= COURT.WIN) { say("The nemesis takes it, " + m.them + " – " + m.you + ". Again from love: serve.", true); m.you = m.them = 0; }
      m.n += 1; m.phase = "serve"; m.ball = null; serveSpot(); courtWhere();
    }
    // the nemesis: after its wait, to where it meets the pearl coming; else back to the middle of its baseline
    if (b && m.phase === "rally" && b.last === "you" && !nm.goal && now >= nm.at) { var q = nemMeets(b, m.k); nm.goal = [q.x + COURT.HAT, q.z]; }   // (its right is to the -x: it faces +z)
    var gx = nm.goal ? nm.goal[0] : cc[0], gz = nm.goal ? clampV(nm.goal[1], cc[2] - COURT.L - 3, cc[2] - 0.4) : cc[2] - COURT.L - 0.6;
    var ddx = gx - nm.x, ddz = gz - nm.z, dd = hypot(ddx, ddz), st = min(dd, sk.v * dt);
    if (dd > 1e-3) { nm.x += ddx / dd * st; nm.z += ddz / dd * st; }
    nm.walked += st; nm.amount += ((st > 1e-4 ? 1 : 0) - nm.amount) * (1 - Math.exp(-dt / STEP_T));
  }
  // Where his serve is struck: underhand, at his right and a little ahead, below his waist.
  function serveFrom() { var f = P.face; return [P.x + Math.cos(f) * 0.45 + Math.sin(f) * 0.35, 0.7, P.z + Math.sin(f) * 0.45 - Math.cos(f) * 0.35]; }
  function levelWon() {
    var m = court.m, c = courts[m.k];
    c.won = true; c.up = true; c.you = c.them = 0; c.t0 = performance.now(); c.next = c.t0 + 4000;
    court.m = null; court.told[m.k + "u"] = 1;   // (he stands on it still: not told at once that it plays on)
    say("Level " + m.level + " won, " + m.you + " – " + m.them + ". Court " + (m.k + 1) + " plays on by itself: its " + COURT.TOOLS[m.k] + " go to the Trojan horse." + (m.k + 1 < COURT.N ? " Court " + (m.k + 2) + " is open." : ""), true);
    courtWhere();
  }
  function courtStep(dt, now) {
    var c = controls(dt), m = court.m;
    courtsSim(dt, now);
    var lock = m && (m.phase === "serve" || m.phase === "toss"), f = lock ? 0 : c.fwd, s = lock ? 0 : c.side;
    var ox = P.x, oz = P.z;
    P.vx = (Math.sin(P.yaw) * f + Math.cos(P.yaw) * s) * WALK; P.vz = (-Math.cos(P.yaw) * f + Math.sin(P.yaw) * s) * WALK;
    P.x += P.vx * dt; P.z += P.vz * dt; P.y = 0; P.face = P.yaw;
    var O = COURT.O;
    if (m) { var cc = courtAt(m.k); P.x = clampV(P.x, cc[0] - COURT.HW - 2.5, cc[0] + COURT.HW + 2.5); P.z = clampV(P.z, cc[2] + 0.3, cc[2] + COURT.L + 3.5); }
    else { P.x = clampV(P.x, O[0] - 8, O[0] + (COURT.N - 1) * COURT.GAP + 8); P.z = clampV(P.z, O[2] - COURT.L - 6, O[2] + COURT.L + 8.2); }
    var step = hypot(P.x - ox, P.z - oz);
    P.walked += step; P.amount += ((step > 1e-4 ? 1 : 0) - P.amount) * (1 - Math.exp(-dt / STEP_T));
    if (m) { matchStep(dt, now, c); }
    else {
      // onto a court: its match, if it is open and not playing by itself; off the back past the net: home
      var k = round((P.x - O[0]) / COURT.GAP), cc0 = courtAt(clampV(k, 0, COURT.N - 1)), lx = P.x - cc0[0], lz = P.z - cc0[2];
      var on = k >= 0 && k < COURT.N && abs(lx) < COURT.HW && lz > 0.5 && lz < COURT.L, was = court.on;
      court.on = on ? k : -1;
      if (on) {
        var cv = courts[k], key = k + (cv.up ? "u" : cv.won ? "d" : "o");
        if (k > 0 && !courts[k - 1].won) { if (court.told[key] !== 1) { court.told[key] = 1; say("Court " + (k + 1) + " opens when court " + k + " is won."); } }
        else if (cv.up) { if (court.told[key] !== 1) { court.told[key] = 1; say("Your stand-in is playing court " + (k + 1) + " at level " + cv.level + ": " + cv.you + " – " + cv.them + "."); } }
        else if (was !== k) { court.told = {}; matchOn(k); }
      }
      if (P.z >= O[2] + COURT.L + 7.7 && abs(P.x - (O[0] + 2.2)) < 1.4) { leaveCourts(); return; }
    }
    input.fire = false;
    if (court && !court.m) { courtWhere(); }
  }
  // His own views (the artist, 28 Oct 2026: "maintain the perspectives of Mr Pearl to play"): the third person at
  // rest, as far from his head as it is in the place (TP_HEAD, his head AIM below the middle, as space has it), or the
  // Scope's, behind his head's centre on the look (SIGHT_D), the head the glass; from one to the other in a switch of
  // view's time (none under reduced motion).
  function courtCam() {
    var h = [P.x, P.y + PEARL.headY, P.z], c;
    if (court.scope) { var d = lookDir(P.yaw, P.pitch); c = { e: [h[0] - d[0] * SIGHT_D, max(0.15, h[1] - d[1] * SIGHT_D), h[2] - d[2] * SIGHT_D], yaw: P.yaw, pitch: P.pitch }; }
    else { var f = lookDir(P.yaw, P.pitch - AIM); c = { e: [h[0] - f[0] * TP_HEAD, h[1] - f[1] * TP_HEAD, h[2] - f[2] * TP_HEAD], yaw: P.yaw, pitch: P.pitch }; }
    var s = stillMotion.matches ? 1 : smooth((performance.now() - court.camT) / 1000 / T_VIEW), a = court.camFrom;
    if (a && s < 1) { c = { e: [0, 1, 2].map(function (k) { return a.e[k] + (c.e[k] - a.e[k]) * s; }), yaw: a.yaw + angle(c.yaw - a.yaw) * s, pitch: a.pitch + (c.pitch - a.pitch) * s }; }
    return c;
  }
  // The Scope on the court (the button, R, the right mouse button): his head the glass and the crux the aim.
  function courtScope(on) {
    if (on == null) { on = !court.scope; }
    if (on === !!court.scope) { return; }
    court.camFrom = camLast; court.camT = performance.now(); court.scope = on;
    $("v-sight").setAttribute("aria-pressed", on ? "true" : "false");
    P.pitch = clampPitch(P.pitch);
  }
  /* -- drawn -- */
  function courtTones(rgb) { var tn = tonesOf(rgb), t = new Float32Array(9); for (var i = 0; i < 3; i += 1) { for (var j = 0; j < 3; j += 1) { t[i * 3 + j] = tn[i][j] / 255; } } return t; }
  var CT = null;
  // A box (its middle, its size, its tones; turned by a about axis ax through its middle), with the shards' program.
  function cbox(c, sz, t, ax, a) {
    var PB = window.PearlBody, S = [sz[0], 0, 0, 0, 0, sz[1], 0, 0, 0, 0, sz[2], 0, 0, 0, 0, 1];
    gl.uniformMatrix4fv(SHU.uM, false, PB.mul(PB.T(c[0], c[1], c[2]), a ? PB.mul(PB.RA(ax, a), S) : S));
    gl.uniform3fv(SHU.uT, t);
    gl.drawArrays(gl.TRIANGLES, 0, 36);
  }
  // The horse: its parts in its own frame (x along it, its head to +x; y up), each [middle, size, tones, turn about z].
  var HORSE = null;
  function horseParts() {
    if (HORSE) { return HORSE; }
    var W = [150, 105, 62], D = [104, 70, 40], K = [52, 36, 22];
    HORSE = [
      [[0, 0.6, 0], [16, 0.6, 6], D, 0],                                                                   // the platform
      [[-6, 1, 3.3], [2, 2, 0.4], K, 0], [[6, 1, 3.3], [2, 2, 0.4], K, 0], [[-6, 1, -3.3], [2, 2, 0.4], K, 0], [[6, 1, -3.3], [2, 2, 0.4], K, 0],   // its wheels
      [[-4.5, 1.15, 1.6], [1.3, 0.5, 1.3], K, 0], [[4.5, 1.15, 1.6], [1.3, 0.5, 1.3], K, 0], [[-4.5, 1.15, -1.6], [1.3, 0.5, 1.3], K, 0], [[4.5, 1.15, -1.6], [1.3, 0.5, 1.3], K, 0],   // hooves
      [[-4.5, 4, 1.6], [1.1, 5.6, 1.1], W, 0], [[4.5, 4, 1.6], [1.1, 5.6, 1.1], W, 0], [[-4.5, 4, -1.6], [1.1, 5.6, 1.1], W, 0], [[4.5, 4, -1.6], [1.1, 5.6, 1.1], W, 0],   // legs
      [[0, 8.8, 0], [12, 4.2, 4.2], W, 0],                                                                // the belly
      [[0, 6.75, 2.12], [3, 1.6, 0.06], K, 0],                                                            // the hatch, for the men inside
      [[5.2, 9.2, 0], [3.2, 4.6, 4], W, 0], [[-5.4, 8.9, 0], [2.8, 4.2, 4], W, 0],                       // the chest, the rump
      [[6.7, 12.4, 0], [2.4, 5.4, 2.4], W, -0.45], [[6.1, 13.4, 0], [1, 5, 0.8], D, -0.45],              // the neck, the mane
      [[8.6, 15, 0], [4.2, 1.9, 1.9], W, -0.3], [[10.3, 14.3, 0], [1.4, 1.5, 1.6], D, -0.3],             // the head, the muzzle
      [[7.6, 16.4, 0.6], [0.4, 1.1, 0.4], D, 0], [[7.6, 16.4, -0.6], [0.4, 1.1, 0.4], D, 0],             // the ears
      [[9, 15.4, 0.97], [0.5, 0.5, 0.06], K, 0], [[9, 15.4, -0.97], [0.5, 0.5, 0.06], K, 0],             // the eyes
      [[-7.2, 8.4, 0], [0.8, 4.2, 0.8], D, 0.35]                                                          // the tail
    ].map(function (p) { return { c: p[0], s: p[1], t: courtTones(p[2]), a: p[3] }; });
    return HORSE;
  }
  // (beyond the courts' far ends, behind their middle, two and a half times the parts' metres: 42 m to its ears, so
  // that it stands over the nets from every court)
  function horseAt() { return [COURT.O[0] + 4.5 * COURT.GAP, 0, COURT.O[2] - COURT.L - 70]; }
  var HORSE_K = 2.5;
  function drawHorse() {
    var H0 = horseAt(), parts = horseParts(), per = COURT.WORK / parts.length, Z = [0, 0, 1], k = HORSE_K;
    parts.forEach(function (p, i) {
      var f = clampV(horse.work / per - i, 0, 1), e = smooth(f);
      // (each lies on the ground before the platform, in a row, until its turn: then it is hoisted to its place; a part
      // taller than it is long lies on its side)
      var lie = p.s[1] > p.s[0] ? Math.PI / 2 : 0, g = [(i % 9 - 4) * 3.4, (lie ? p.s[0] : p.s[1]) / 2 + 0.01, 10 + floor(i / 9) * 4];
      var c = [0, 1, 2].map(function (j) { return g[j] + (p.c[j] - g[j]) * e; });
      if (f > 0 && f < 1) { c[1] += Math.sin(Math.PI * e) * 3; }
      cbox([H0[0] + c[0] * k, H0[1] + c[1] * k, H0[2] + c[2] * k], [p.s[0] * k, p.s[1] * k, p.s[2] * k], p.t, Z, lie * (1 - e) + p.a * e);
    });
  }
  function courtCT() {
    CT = CT || { ground: courtTones([112, 132, 92]), out: courtTones([76, 118, 86]), inn: courtTones([60, 92, 136]), kitchen: courtTones([70, 128, 104]), line: courtTones([236, 236, 228]), net: courtTones([34, 34, 38]), post: courtTones([70, 70, 74]) };
    return CT;
  }
  function drawCourtsGround() {
    var CT = courtCT();
    var O = COURT.O, L = COURT.L, HW = COURT.HW, K = COURT.K, lw = 0.05, y = 0.011, nw = 2 * (HW + COURT.PO);
    cbox([O[0] + 4.5 * COURT.GAP, -0.05, O[2] - 60], [COURT.N * COURT.GAP + 300, 0.1, 400], CT.ground);
    for (var k = 0; k < COURT.N; k += 1) {
      var c = courtAt(k), x = c[0], z = c[2];
      cbox([x, 0.001, z], [COURT.GAP - 1, 0.01, 2 * L + 7], CT.out);
      cbox([x, 0.006, z], [2 * HW, 0.01, 2 * L], CT.inn);
      cbox([x, 0.008, z], [2 * HW, 0.01, 2 * K], CT.kitchen);                                // the kitchens, either side of the net
      [-1, 1].forEach(function (s) {
        cbox([x, y, z + s * (L - lw / 2)], [2 * HW, 0.012, lw * 2], CT.line);                // the baselines
        cbox([x + s * (HW - lw / 2), y, z], [lw, 0.012, 2 * L], CT.line);                     // the sidelines
        cbox([x, y, z + s * K], [2 * HW, 0.012, lw], CT.line);                                 // the kitchen (non-volley) lines
        cbox([x, y, z + s * (K + L) / 2], [lw, 0.012, L - K], CT.line);                        // the centrelines
        cbox([x + s * (HW + COURT.PO), COURT.POST / 2, z], [0.08, COURT.POST, 0.08], CT.post);  // the posts
      });
      cbox([x, COURT.NET / 2 + 0.03, z], [nw, COURT.NET - 0.06, 0.03], CT.net);              // the net
      cbox([x, COURT.NET, z], [nw, 0.07, 0.05], CT.line);                                      // its tape
    }
    // the net back, behind court one
    var gx = O[0] + 2.2, gz = O[2] + L + 8;
    cbox([gx, COURT.NET / 2, gz], [2.7, COURT.NET, 0.03], CT.net); cbox([gx, COURT.NET, gz], [2.7, 0.07, 0.05], CT.line);
    [-1, 1].forEach(function (s) { cbox([gx + s * 1.4, COURT.POST / 2, gz], [0.1, COURT.POST, 0.1], CT.post); });
  }
  // The net near where he wakes, in the place (with the place's own frame: frame() draws it with the opaque things).
  function drawGate() {
    if (!gate || !shardProg) { return; }
    var CT = courtCT();
    gl.useProgram(shardProg);
    gl.uniformMatrix4fv(SHU.uVP, false, vp); gl.uniform3fv(SHU.uEye, eye); gl.uniform3fv(SHU.uHaze, HAZE);
    gl.bindVertexArray(null);
    var a = Math.atan2(gate.n[1], gate.n[0]), Y = [0, 1, 0], u = [-gate.n[1], gate.n[0]];
    cbox([gate.x, gate.y + COURT.NET / 2, gate.z], [0.03, COURT.NET, 2.7], CT.net, Y, -a);
    cbox([gate.x, gate.y + COURT.NET, gate.z], [0.05, 0.07, 2.7], CT.line, Y, -a);
    [-1, 1].forEach(function (s) { cbox([gate.x + u[0] * s * 1.4, gate.y + COURT.POST / 2, gate.z + u[1] * s * 1.4], [0.1, COURT.POST, 0.1], CT.post); });
    gl.useProgram(prog);
  }
  // A figure of his on the courts (the nemesis, his stand-ins): his parts with the palette given, the hat the racket,
  // and a sphere of the unit for the head (a voxel ball, as the guards have).
  function racketM(M, x, y, z, face, s, lift) {
    var PB = window.PearlBody, hat = me3.parts.filter(function (ch) { return ch.p.name === "hat"; })[0];
    if (!hat) { return PB.place(M.hat, x, y, z, face); }
    var d = hat.p.dim, hc = apply(M.hat, [d[0] / 2, d[1] / 2, d[2] / 2]);
    // (in his frame: its middle COURT.HAT out from his upright at the swing's angle s, from his right (0) round to his
    // front (pi / 2); its crown pointing out along that, so its brim's round is the racket's face)
    var r = [Math.cos(s), 0, -Math.sin(s)], at = [r[0] * COURT.HAT, 1.0 + (lift || 0), r[2] * COURT.HAT];
    var m = PB.mul(PB.T(at[0], at[1], at[2]), PB.mul(PB.RA([r[2], 0, -r[0]], -Math.PI / 2), PB.mul(PB.T(-hc[0], -hc[1], -hc[2]), M.hat)));
    return PB.place(m, x, y, z, face);
  }
  // The swing's angle: a quarter turn past his front and back over a third of a second after a hit; at rest a little
  // to his right of his front.
  function swingS(t, now) {
    var u = (now - t) / 1000;
    if (u < 0 || u > 0.7) { return 0.7; }
    return u < 0.3 ? -0.5 + 2.9 * smooth(u / 0.3) : 2.4 - 1.7 * smooth((u - 0.3) / 0.4);
  }
  function drawFig(x, z, face, walked, amount, pal, s, lift, act) {
    var PB = window.PearlBody, body = me3.body, M = PB.pose(body, PB.phaseStep(body, 0, walked), amount, act || null), h = unitH();
    if (!courtHead) {
      var RO = coinRO(), n = 2 * RO, ids = new Uint8Array(n * n * n), blocks = [], id = (body.paletteIds.jacket || [1])[0];
      for (var yy = 0; yy < n; yy += 1) { for (var zz = 0; zz < n; zz += 1) { for (var xx = 0; xx < n; xx += 1) {
        if (hypot(xx + 0.5 - RO, yy + 0.5 - RO, zz + 0.5 - RO) > RO) { continue; }
        ids[(yy * n + zz) * n + xx] = id; blocks.push([xx, yy, zz, id]);
      } } }
      courtHead = meshBlocks(blocks); courtHead.tex = voxTexture(ids, n, n, n); courtHead.n = n; courtHead.RO = RO;
    }
    gl.uniform4fv(U.uPal, pal);
    var draw = function (ch, m, dim) {
      gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, ch.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform3i(U.uDim, dim[0], dim[1], dim[2]); gl.bindVertexArray(ch.vao);
      gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
    };
    me3.parts.forEach(function (ch) { draw(ch, ch.p.name === "hat" ? racketM(M, x, 0, z, face, s, lift) : PB.place(M[ch.p.name], x, 0, z, face), ch.p.dim); });
    var c = apply(PB.place(M.head, x, 0, z, face), body.head.centre), RO = courtHead.RO;
    draw(courtHead, PB.mul(PB.T(c[0], c[1], c[2]), PB.mul(PB.RY(-face), PB.mul(PB.S(h), PB.T(-RO, -RO, -RO)))), [courtHead.n, courtHead.n, courtHead.n]);
  }
  function drawBall(x, y, z, spin) {
    if (!pearlCh) { return; }
    var PB = window.PearlBody, h = unitH(), n = pearlCh.n / 2;
    gl.uniform4fv(U.uPal, me3.pal);
    gl.uniform3i(U.uDim, pearlCh.n, pearlCh.n, pearlCh.n);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, pearlCh.tex); gl.activeTexture(gl.TEXTURE0);
    gl.bindVertexArray(pearlCh.vao);
    var m = PB.mul(PB.T(x, y, z), PB.mul(PB.RX(spin || 0), PB.mul(PB.S(h), PB.T(-n, -n, -n))));
    gl.uniformMatrix4fv(U.uM, false, m); gl.uniformMatrix4fv(U.uInvM, false, PB.inverse(m));
    gl.drawElements(gl.TRIANGLES, pearlCh.count, gl.UNSIGNED_INT, 0);
  }
  // His pose on the court: his own (the serve is underhand: no arm raised).
  function courtPose(now) { return null; }
  // His own hat on the court: the paddle (drawPearl asks), low at his right for the underhand serve.
  function courtRacket(M, now) {
    var m = court.m, toss = m && m.phase === "toss";
    return racketM(M, P.x, P.y, P.z, P.face, toss ? 0.9 : swingS(m ? m.hit : -1e9, now), toss ? -0.35 : 0);
  }
  function courtFrame(now, dt) {
    courtStep(dt, now);
    if (!court) { return false; }
    var cw = canvas.width, chh = canvas.height, cam = courtCam(), SKY = COURT.SKY;
    eye = cam.e; camLast = { e: cam.e, yaw: cam.yaw, pitch: cam.pitch };
    vp = mul(perspective(FOV * Math.PI / 180, cw / chh, NEAR, FAR), view(eye, cam.yaw, cam.pitch));
    glyphBegin(cw, chh);
    gl.viewport(0, 0, cw, chh);
    gl.clearColor(SKY[0], SKY[1], SKY[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.clearColor(0, 0, 0, 0);
    var tanH = 2 * Math.tan(FOV * Math.PI / 360);
    pxW = tanH / rows0;
    if (shardProg) {
      gl.useProgram(shardProg);
      gl.uniformMatrix4fv(SHU.uVP, false, vp); gl.uniform3fv(SHU.uEye, eye); gl.uniform3fv(SHU.uHaze, SKY);
      gl.bindVertexArray(null);
      drawCourtsGround(); drawHorse();
    }
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, vp); gl.uniform3fv(U.uEye, eye); gl.uniform3fv(U.uSun, sunDir); gl.uniform1f(U.uT, now / 1000);
    gl.uniform3fv(U.uSky, SKY); gl.uniform3fv(U.uHaze, SKY); gl.uniform1i(U.uSteps, walk); gl.uniform1i(U.uVeil, 0); gl.uniform1i(U.uVox, 1); gl.uniform1f(U.uPaint, PAINT);
    gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0); gl.uniform2f(U.uNear, 0, 0);
    gl.uniform3f(U.uAxA, 1e9, 1e9, 1e9); gl.uniform3f(U.uAxB, 1e9, 1e9, 1e9); gl.uniform3f(U.uHeadC, 1e9, 1e9, 1e9); gl.uniform3f(U.uHeadE, 1e9, 1e9, 1e9);
    gl.uniform1f(U.uPx, pxW / unitH());
    if (!nemPal) { nemPal = new Float32Array(me3.pal); for (var i = 4; i < nemPal.length; i += 4) { nemPal[i] = 255 - nemPal[i]; nemPal[i + 1] = 255 - nemPal[i + 1]; nemPal[i + 2] = 255 - nemPal[i + 2]; } }
    // the courts' figures: a nemesis on each, waiting at its baseline or playing; a stand-in of his on each court up
    var m = court.m;
    courts.forEach(function (c) {
      var cc = courtAt(c.k);
      if (Math.abs(cc[0] - eye[0]) > 140) { return; }
      if (m && m.k === c.k) {
        var nm = m.nem;
        drawFig(nm.x, nm.z, Math.PI, nm.walked, nm.amount, nemPal, swingS(nm.hit, now), 0, null);
        if (m.ball) { drawBall(m.ball.x, m.ball.y, m.ball.z, m.ball.spin); }
        else if (m.phase === "toss") { var u = (now - m.t) / 300, s0 = serveFrom(); drawBall(s0[0], 1.0 - (1.0 - s0[1]) * u * u, s0[2], 0); }
        return;
      }
      if (!c.up) { drawFig(cc[0], cc[2] - COURT.L - 0.6, Math.PI, 0, 0, nemPal, 0.7, 0, null); return; }
      // (playing on: the pearl back and forth over the net, a shot each 1.3 s, the stand-in hitting the even shots and
      // the nemesis the odd, each stepping from where it hit to where it hits next, its racket meeting the pearl there)
      var u2 = (now - c.t0) / 1300, i2 = floor(u2), f2 = u2 - i2, ax = function (j) { return cc[0] + Math.sin(j * 1.7 + c.k) * 1.6; };
      var e2 = i2 - (i2 % 2), o2 = i2 % 2 ? i2 : i2 - 1, zs = cc[2] + COURT.L - 0.5, zn = cc[2] - COURT.L + 0.5;
      var xs = ax(e2) + (ax(e2 + 2) - ax(e2)) * smooth((u2 - e2) / 2), xn = ax(o2) + (ax(o2 + 2) - ax(o2)) * smooth((u2 - o2) / 2);
      drawFig(xs - COURT.HAT, zs, 0, u2 * 2, 0.6, me3.pal, swingS(c.t0 + e2 * 1300, now), 0, null);
      drawFig(xn + COURT.HAT, zn, Math.PI, u2 * 2, 0.6, nemPal, swingS(c.t0 + o2 * 1300, now), 0, null);
      var za = i2 % 2 ? zn : zs, zb = i2 % 2 ? zs : zn;
      drawBall(ax(i2) + (ax(i2 + 1) - ax(i2)) * f2, 0.8 + 1.4 * Math.sin(Math.PI * f2), za + (zb - za) * f2, u2 * 9);
    });
    gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    // (with the Scope up his head is the glass from the switch's half: not drawn, the crux drawn in its place)
    drawMe = { body: true, head: !(court.scope && (stillMotion.matches || now - court.camT >= T_VIEW * 500)) };
    var HZ = HAZE; HAZE = SKY; drawPearl(now); HAZE = HZ;
    gl.bindVertexArray(null);
    glyphEnd(cw, chh);
    courtOverlay(now);
    return true;
  }
  // Over the courts: the stick's water, the ring where the nemesis's pearl comes down, the ten courts and the horse.
  function courtOverlay(now) {
    var c = hud.getContext("2d"), dpr = min(2, window.devicePixelRatio || 1), W = hud.width / dpr, H = hud.height / dpr, m = court.m;
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H);
    water.step(min(0.05, (now - (water.last || now)) / 1000), stillMotion.matches); water.last = now; water.draw(c, now / 1000, stillMotion.matches);
    var toS = function (p) { var q = [0, 0, 0, 0]; for (var i = 0; i < 4; i += 1) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; } return q[3] > 0.05 ? [(q[0] / q[3] * 0.5 + 0.5) * W, (1 - (q[1] / q[3] * 0.5 + 0.5)) * H] : null; };
    if (m && m.mark && m.ball && m.ball.last === "them" && m.ball.bounces === 0) {
      var ring = [];
      for (var s = 0; s <= 32; s += 1) { var a = s / 32 * 2 * Math.PI; ring.push(toS([m.mark.x + Math.cos(a) * 0.4, 0.02, m.mark.z + Math.sin(a) * 0.4])); }
      if (ring.every(Boolean)) { twoTone(c, function () { c.beginPath(); ring.forEach(function (q, i) { if (i) { c.lineTo(q[0], q[1]); } else { c.moveTo(q[0], q[1]); } }); }, 1.5); }
    }
    // the Scope's mark: the sight's figure and its holding circles where his nose is, the middle of the view
    if (court.scope && drawMe && !drawMe.head) {
      var fz = H / 2 / T35, uu = sightU() * fz, cx0 = W / 2, cy0 = H / 2;
      SIGHT_F.forEach(function (F) { var r0 = F * uu / Math.sqrt(3); twoTone(c, function () { c.beginPath(); c.arc(cx0, cy0 + r0, r0, 0, Math.PI * 2); }, 1); });
      var fm = figureMark(round(uu * dpr), 0, 0, 0);
      c.drawImage(fm.cv, cx0 - fm.ox / dpr, cy0 - fm.oy / dpr, fm.cv.width / dpr, fm.cv.height / dpr);
      noseMark(c, cx0, cy0, uu, 1);
    }
    // the ten: a square each, its level in it; filled while it plays on, crossed while it is down, faint until it opens
    var top = document.querySelector(".top"), y0 = (top ? top.getBoundingClientRect().bottom : 48) + 10, sz = 22, gap = 5, x0 = 12;
    c.font = "600 11px ui-monospace, SFMono-Regular, Menlo, monospace"; c.textAlign = "center"; c.textBaseline = "middle";
    courts.forEach(function (q, k) {
      var x = x0 + k * (sz + gap), open = k === 0 || courts[k - 1].won, on = m && m.k === k;
      c.globalAlpha = open ? 1 : 0.4;
      if (q.up) { c.fillStyle = "rgba(236,236,228,0.92)"; c.fillRect(x, y0, sz, sz); }
      c.strokeStyle = on ? "#f3c98b" : q.won && !q.up ? "#e07a5f" : "rgba(236,236,228,0.9)"; c.lineWidth = on ? 2 : 1; c.strokeRect(x + 0.5, y0 + 0.5, sz - 1, sz - 1);
      if (q.won && !q.up) { c.beginPath(); c.moveTo(x + 3, y0 + 3); c.lineTo(x + sz - 3, y0 + sz - 3); c.stroke(); }
      c.fillStyle = q.up ? "#1c1c1e" : "#f2efe8"; c.fillText(String(q.level), x + sz / 2, y0 + sz / 2 + 0.5);
    });
    c.globalAlpha = 1; c.textAlign = "left"; c.font = "500 11px ui-monospace, SFMono-Regular, Menlo, monospace";
    var line = "The horse " + round(100 * horse.work / COURT.WORK) + "% · ";
    c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.65)"; c.fillStyle = "#f2efe8";
    c.strokeText(line, x0, y0 + sz + 14); c.fillText(line, x0, y0 + sz + 14);
    var x = x0 + c.measureText(line).width;
    // its tools: each court's, struck through while that court is down (never yet won: not yet the horse's)
    COURT.TOOLS.forEach(function (t, k) {
      var q = courts[k], wd = c.measureText(t).width;
      if (x + wd > W - 12) { return; }
      c.globalAlpha = q.up ? 1 : 0.45;
      c.strokeText(t, x, y0 + sz + 14); c.fillText(t, x, y0 + sz + 14);
      if (q.won && !q.up) { c.strokeStyle = "#e07a5f"; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x, y0 + sz + 14); c.lineTo(x + wd, y0 + sz + 14); c.stroke(); c.lineWidth = 3; c.strokeStyle = "rgba(0,0,0,0.65)"; }
      x += wd + 8;
    });
    c.globalAlpha = 1;
    // coming in: the view opens from black over half a second
    var o = 1 - (now - court.t0) / 500;
    if (o > 0) { c.fillStyle = "rgba(5,3,2," + o.toFixed(3) + ")"; c.fillRect(0, 0, W, H); }
  }

  /* ---- the character cubes: a cube that holds a character, which does what it stands for ------------------------------
     The artist, 28 Oct 2026, of a block seen close, the unit's bars in its glass: "instead of that shape being in the
     middle of that cube in the image that you provided, it is a character, for example, a giant Q in which stands for
     question and so when you click on it, it asks you a question this is just an example" (after "Characters are the
     answer to the basic unit study"). A cube of glass a block across stands on the lawn a few steps ahead of where he
     wakes, a giant Q in it where a block has its figure; a tap on it (a click, at the crosshair) and it asks a question,
     easy, as the works' riddles are: where a piece of the rocket still lies, three answers to tap, the right one turning
     the arrow to that piece (as a pearl ringing on it does). With every piece found it asks who made a work hung in the
     place. The letters and what each does are a table (CUBE_ACTS): Q is the first. */
  var CUBE_ACTS = { Q: function (qc) { askQuestion(qc); } };
  var qcubes = [], qAsked = 0, asking = null;
  var HIDES = { work: "behind a work on a wall", pool: "on the floor of the pool", garden: "buried in the garden", roof: "up on a roof",
                park: "dug into a park", water: "at the bottom of the water", paving: "under the paving of a square", tree: "up in a tree" };
  // On open ground five to ten metres out along the way he faces on waking, a little to one side of it (in the third
  // person his own head stands on that line), clear of the homage, the net and the studies.
  function qcubePlace() {
    qcubes = [];
    var at = underTree(), y0 = floor(at.y + 0.01), S = w.SOLID, yaw = wakeYaw(), hb = homage && homage.box;
    for (var r = 5; r <= 10 && !qcubes.length; r += 1) {
      for (var a = 0; a < 16 && !qcubes.length; a += 1) {
        var th = yaw + (a % 2 ? 1 : -1) * (0.25 + floor(a / 2) * 0.15), x = floor(at.x + Math.sin(th) * r), z = floor(at.z - Math.cos(th) * r);
        if (x < 2 || z < 2 || x >= w.SX - 2 || z >= w.SZ - 2 || !S[w.get(x, y0 - 1, z)]) { continue; }
        if (w.get(x, y0, z) !== B.AIR || w.get(x, y0 + 1, z) !== B.AIR || w.get(x, y0 + 2, z) !== B.AIR) { continue; }
        if (hb && x >= hb[0] - 1 && x <= hb[2] + 1 && z >= hb[1] - 1 && z <= hb[3] + 1) { continue; }
        if (gate && hypot(x + 0.5 - gate.x, z + 0.5 - gate.z) < 3) { continue; }
        if (studies && studies.stands && studies.stands.some(function (st) { return hypot(x + 0.5 - st.at[0], z + 0.5 - st.at[2]) < 3; })) { continue; }
        qcubes.push({ x: x + 0.5, y: y0 + 0.5, z: z + 0.5, ch: "Q" });
      }
    }
  }
  // Its character, as the studies' are drawn (drawChars): gold, its letter as tall as the cube (the atlas's letter
  // fills about four fifths of its square).
  function charCubes() {
    var out = [];
    qcubes.forEach(function (q) { out.push(q.x, q.y, q.z, 1.2, CHARS.indexOf(q.ch), 0.98, 0.86, 0.52); });
    return out;
  }
  // Its glass: the cube's twelve edges, a hair of white each.
  function drawQcubes() {
    if (!qcubes.length || !shardProg) { return; }
    var CT = courtCT(), e = 0.025;
    gl.useProgram(shardProg);
    gl.uniformMatrix4fv(SHU.uVP, false, vp); gl.uniform3fv(SHU.uEye, eye); gl.uniform3fv(SHU.uHaze, HAZE);
    gl.bindVertexArray(null);
    qcubes.forEach(function (q) {
      [-0.5, 0.5].forEach(function (a) { [-0.5, 0.5].forEach(function (b) {
        cbox([q.x, q.y + a, q.z + b], [1 + e, e, e], CT.line);
        cbox([q.x + a, q.y, q.z + b], [e, 1 + e, e], CT.line);
        cbox([q.x + a, q.y + b, q.z], [e, e, 1 + e], CT.line);
      }); });
    });
    gl.useProgram(prog);
  }
  // A tap's ray on a cube (nearer than what else it meets, within the reach a label is read at).
  function qcubeTap(dir, hit) {
    if (Hd || ride || ignite || launched || intro || space || court) { return null; }
    var best = null, near = passT(dir);
    qcubes.forEach(function (q) {
      var t0 = -1e9, t1 = 1e9, c = [q.x, q.y, q.z];
      for (var k = 0; k < 3; k += 1) {
        if (abs(dir[k]) < 1e-9) { if (abs(eye[k] - c[k]) > 0.5) { return; } continue; }
        var a = (c[k] - 0.5 - eye[k]) / dir[k], b = (c[k] + 0.5 - eye[k]) / dir[k];
        t0 = max(t0, min(a, b)); t1 = min(t1, max(a, b));
      }
      if (t1 < max(t0, near) || t0 > LOOK || (hit && hit.t < t0)) { return; }
      if (!best || t0 < best.t) { best = { q: q, t: t0 }; }
    });
    return best && best.q;
  }
  // The Q's question: where a piece still lies, else who made a work here, else how many coins build the rocket; its
  // three answers in an order of the place's own.
  function askQuestion(qc) {
    var r = Pl.rng(seed * 17 + qAsked * 31 + 3), mix = function (list) { return list.map(function (v) { return [r(), v]; }).sort(function (a, b) { return a[0] - b[0]; }).map(function (p) { return p[1]; }); };
    // (the pieces it has not yet been answered about first)
    var left = adv.pieces.filter(function (p) { return found.indexOf(p.k) < 0; }), fresh = left.filter(function (p) { return !marked[p.k]; }), q;
    if (fresh.length) { left = fresh; }
    qAsked += 1;
    if (left.length) {
      var pc = left[floor(r() * left.length)], name = lower(pc.name), right = HIDES[pc.how || pc.hide.type] || HIDES.roof;   // (how: where it came to lie)
      var kinds = setting.kind === "city" ? ["roof", "park", "water", "paving", "tree"] : ["work", "roof", "pool", "garden"];
      var others = mix(kinds.map(function (k) { return HIDES[k]; }).filter(function (v) { return v !== right; })).slice(0, 2);
      q = { text: "Where does " + name + " lie?", answers: mix([right].concat(others)), right: right,
            then: function (ok) { if (ok) { marked[pc.k] = true; say("Yes: " + name + " lies " + right + ". Of the pieces, the arrow leads to it first.", true); } else { say("No: " + name + " lies " + right + ". The Q has more to ask.", false); } } };
    } else {
      var hung = paintings.filter(function (p) { return p.f && p.f.artist && p.f.title; }), names = [];
      hung.forEach(function (p) { if (names.indexOf(p.f.artist) < 0) { names.push(p.f.artist); } });
      if (names.length >= 3) {
        var wk = hung[floor(r() * hung.length)], by = wk.f.artist;
        q = { text: "Who made " + wk.f.title + "?", answers: mix([by].concat(mix(names.filter(function (n) { return n !== by; })).slice(0, 2))), right: by,
              then: function (ok) { say((ok ? "Yes: " : "No: ") + by + " made " + wk.f.title + ".", ok); } };
      } else {
        q = { text: "How many coins build the rocket?", answers: mix(["ten", "four", "three"]), right: "ten", then: function (ok) { say(ok ? "Yes: ten, as the four pieces do." : "No: ten, as the four pieces do.", ok); } };
      }
    }
    showAsk(qc.ch, q);
  }
  // The question over the view, its answers as buttons (a page element: above the glyphs; Escape or Leave it closes).
  function showAsk(ch, q) {
    var el = $("ask"), box = $("ask-a");
    $("ask-leave").onclick = closeAsk;
    asking = q;
    $("ask-ch").textContent = ch; $("ask-q").textContent = q.text;
    box.innerHTML = "";
    q.answers.forEach(function (a) {
      var b = document.createElement("button"); b.className = "pill"; b.type = "button"; b.textContent = a;
      b.onclick = function () { var ok = a === q.right; closeAsk(); q.then(ok); };
      box.appendChild(b);
    });
    el.hidden = false;
    var first = box.querySelector("button"); if (first) { try { first.focus({ preventScroll: true }); } catch (e) { first.focus(); } }
  }
  function closeAsk() { asking = null; $("ask").hidden = true; }

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
    ["uVP", "uEye", "uC", "uSun", "uHaze", "uR", "uExpo", "uHolo", "uHead", "uV", "uRig", "uMark"].forEach(function (n) { HU[n] = gl.getUniformLocation(headProg, n); });
  }
  // His body from its file: the parts' grids to the card, his palette, and his measures into every distance.
  function pearlFrom(spec) {
    var PB = window.PearlBody;
    if (!PB || !spec || !gl) { return; }
    var t0 = performance.now(), body = PB.build(spec, { skip: [B.WATER, B.NOTE] }), pal = new Float32Array(64 * 4);
    body.palette.forEach(function (c, i) { pal.set(c, i * 4); });
    smashFrom(body); throwFrom(body, spec);
    var parts = body.parts.filter(function (p) { return !p.empty; }).map(function (p) {
      var ch = meshBlocks(p.blocks);
      ch.tex = voxTexture(p.ids, p.dim[0], p.dim[1], p.dim[2]); ch.p = p;
      return ch;
    });
    // How far any of him reaches from the line up through his feet, and how high, in any pose of the walk: the
    // corners of each part's grid at rest and at the stride's four quarters (what the veil's reach is measured to).
    var rad = 0, hi = 0;
    // And in the swing (the smash): its tops either side and its strikes low and high, turned as the aim turns them.
    var acts = [null];
    if (FAR_END) {
      var tw0 = aimTwist(0, body), tw1 = aimTwist(ARMS_UP, body);
      [[ARMS_UP, tw0], [ARMS_UP, tw1]].forEach(function (t) { acts.push({ arms: t[0], twist: t[1] + COIL }, { arms: t[0], twist: t[1] - COIL }); });
      acts.push({ arms: 0, twist: tw0 }, { arms: ARMS_UP, twist: tw1 }, { arms: ARMS_UP, twist: tw1, lift: LEAP });
    }
    // and his right arm raised to throw, and at the end of its fling (the sight)
    acts.push({ right: 1 }, { right: 1, fling: -COIL });
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
    pearlGrid(); coinGrid();
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
    if (!me3 || (!drawMe.body && !drawMe.head)) { sight.inHand = null; return; }
    var PB = window.PearlBody, body = me3.body, phase = PB.phaseStep(body, 0, P.walked), M = PB.pose(body, phase, P.amount, court ? courtPose(now) : actNow(now));
    // where the head is now, on the walk's bob (the sight's window is drawn round it), and the pearl in his raised glove
    sight.head = apply(PB.place(M.head, P.x, P.y, P.z, P.face), body.head.centre);
    sight.inHand = HOLD && drawMe.body ? apply(PB.place(M.arm_right, P.x, P.y, P.z, P.face), HOLD) : null;
    if (!veil) { swooshAt(M, now); }
    if (drawMe.body) {
      // The same program as the place's blocks, his palette, the pixel's width in his unit; no floor under his grids,
      // and no opening by his own nearness (uNear nought): he closes by the camera alone, as before.
      gl.uniform4fv(U.uPal, me3.pal);
      gl.uniform1f(U.uPx, pxW / body.cell); gl.uniform2f(U.uNear, 0, 0);
      gl.uniform3f(U.uOff, 0, 0, 0); gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform1i(U.uFloor, 0);
      var drop = hatDrop(now), off = hatOff(now);
      me3.parts.forEach(function (ch) {
        // the hat doffed into his left glove while the head is the glass (the sight; its brim would hood the window)
        var m = PB.place(ch.p.name === "hat" && off ? mul(PB.T(off[0], off[1], off[2]), M.hat) : M[ch.p.name], P.x, P.y, P.z, P.face);
        if (ch.p.name === "hat" && drop) { m = mul(PB.T(0, -drop, 0), m); }
        if (ch.p.name === "hat" && court) { m = courtRacket(M, now); }   // (on the court the hat is his racket)
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
      gl.uniform3fv(HU.uSun, sunDir); gl.uniform3fv(HU.uHaze, HAZE); gl.uniform1f(HU.uExpo, HEAD_EXPO); gl.uniform1f(HU.uHolo, Hd ? 1 : 0); gl.uniform1f(HU.uMark, glyphLive ? 1 : 0);
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
    if (found.length === 4) { setTimeout(function () { say(built ? "Every piece: the rocket already stands." : "Every piece. Back to the wreck to build the rocket.", true); }, 2200); }
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
    el.querySelector(".l-room").textContent = riddleFor(p);
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
  /* An easy riddle on every work's label, where a piece of the rocket still is (the artist, 26 Oct 2026: "give some
     sort of riddle that is easy to solve that ties into the narrative of where the pieces for the rocket are. Overall,
     keep things very easy to figure out for now"): the work's own when a piece is behind it, else the next piece not
     yet found, by the work's place among those hung. A piece behind a work is told by the work (its artist, its room);
     the others by the place they lie in (the roof, the pool, the garden). */
  function riddleFor(p) {
    var left = adv.pieces.filter(function (q) { return found.indexOf(q.k) < 0; });
    if (!left.length) { return built ? "Every piece is found, and the rocket stands." : "Every piece is found: build the rocket at the wreck."; }
    var own = left.filter(function (q) { return q.hide.type === "work" && q.hide.id === p.f.id; })[0];
    var q = own || left[max(0, paintings.indexOf(p)) % left.length], piece = lower(q.name);
    if (q.hide.type === "work") {
      var pa = paintings.filter(function (x) { return x.f.id === q.hide.id; })[0];
      if (!pa) { return "Riddle: a frame hides " + piece + ". Which one?"; }
      return "Riddle: I hang in " + lower(pa.room && pa.room.name ? pa.room.name : "the place") + (pa.f.artist ? ", by " + pa.f.artist : "") + ", and " + piece + " hides behind me. Who am I?";
    }
    if (q.hide.type === "pool") { return "Riddle: I am water you can swim in, still and square, and " + piece + " sank to my floor. What am I?"; }
    if (q.hide.type === "garden") { return "Riddle: trees drink from me and my earth is loose, and " + piece + " is buried in me. What am I?"; }
    return "Riddle: rain lands on me first and no one walks on me, and " + piece + " rolled up onto me. What am I?";
  }
  function lookBehind() {
    var p = current;
    if (court) { return; }
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
      guardsTo(p);
      if (alarms >= 3) { say("Nothing behind it, and the third alarm brings the guards."); setTimeout(putOut, 1400); }
      else { say("Nothing behind it, and an alarm goes off. " + (alarms === 1 ? "Two more" : "One more") + " and the guards come."); }
    }
    showLabel(p);
  }
  // The guards put you out: you come to under your tree again, and the alarms are quiet.
  function putOut() {
    if (launched || ignite || space || court) { return; }   // (leaving in the rocket beats the guards; on the courts they cannot reach him)
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
    // In space the frame is space's own; down again, the place is built anew and starts its own frames.
    if (space) { if (spaceFrame(now, dt)) { requestAnimationFrame(frame); } return; }
    // On the courts the frame is the courts' own; back through their net, the place's again (the place kept as it was).
    if (court) { courtFrame(now, dt); requestAnimationFrame(frame); return; }
    if (gateCheck()) { requestAnimationFrame(frame); return; }
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
    } else if (launched && ride) {
      rideStep(dt, controls(dt));
    } else if (ignite) {
      controls(dt); physics(dt, { fwd: 0, side: 0, up: 0 }); igniteStep(dt);
    } else if (!launched && !flying) {
      var hand = controls(dt);
      // The head out, the body stands where it was under the place's physics, unled; while it follows the head
      // (holo flies it), nothing stops it.
      if (Hd) { holo(dt, now, hand); if (!Hd || Hd.phase !== "follow") { physics(dt, { fwd: 0, side: 0, up: 0 }); } }
      else { physics(dt, hand); holoLeft = min(HOLO_T, holoLeft + HOLO_REFILL * dt); }
      swingStep(dt); sightStep(dt, now);
    }
    shardsStep(dt); if (!intro && (!launched || ride)) { stepPearls(dt); } if (!intro && !launched) { coinsStep(); guardsStep(dt, now); if (Hd && Hd.on) { seatOnGuard(); } courtsSim(dt, now); }
    pump(intro ? 14 : 6);
    var cw = canvas.width, chh = canvas.height, cam = camera(now, dt, eyeH, cw / chh);
    eye = cam.e;
    var proj = perspective(FOV * Math.PI / 180, cw / chh, NEAR, FAR);
    vp = mul(proj, view(eye, cam.yaw, cam.pitch));
    glyphBegin(cw, chh);
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
    gl.uniform1i(U.uSteps, walk); gl.uniform1i(U.uVeil, 0); gl.uniform1f(U.uPaint, PAINT);
    gl.uniform1i(U.uVox, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform3i(U.uDim, w.SX, w.SY, w.SZ); gl.uniform1i(U.uFloor, 1);
    gl.uniform3f(U.uOff, 0, 0, 0);
    gl.uniformMatrix4fv(U.uM, false, ID4); gl.uniformMatrix4fv(U.uInvM, false, ID4);
    // Mr Pearl, whom the faces open round (see FS), for the place, the rocket and the veil: the line up through him
    // from his feet to the top of his hat, his head's centre (on him, or out as the hologram), and NEAR_F.
    var hc = Hd ? [Hd.x, Hd.y, Hd.z] : seat();
    gl.uniform3f(U.uAxA, P.x, P.y, P.z); gl.uniform3f(U.uAxB, P.x, P.y + PEARL.top, P.z); gl.uniform3f(U.uHeadC, hc[0], hc[1], hc[2]);
    // the head out, the line from the camera to it too: a floor or roof it is in or passes is open between (the
    // hologram sees through it), not shut by the level faces' thirty-second
    var he = Hd ? eye : hc;
    gl.uniform3f(U.uHeadE, he[0], he[1], he[2]);
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
    var rx = ride ? ride.dx : 0, rz = ride ? ride.dz : 0;
    if (rocketCh) {
      gl.uniform3f(U.uOff, rx, lift, rz);
      // The rocket walks its own small grid, which rises with it.
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, rocketCh.tex); gl.activeTexture(gl.TEXTURE0);
      gl.uniform3f(U.uOrg, rocketCh.org[0] + rx, rocketCh.org[1] + lift, rocketCh.org[2] + rz);
      gl.uniform3i(U.uDim, rocketCh.dim[0], rocketCh.dim[1], rocketCh.dim[2]); gl.uniform1i(U.uFloor, 0);
      gl.bindVertexArray(rocketCh.vao);
      gl.drawElements(gl.TRIANGLES, rocketCh.count, gl.UNSIGNED_INT, 0);
      if (launched && !ride && lift > 300 && !ended) { ended = true; finish(); }
      if (launched && ride) { rideCheck(lift); }
      rocketLift = lift;
    }
    drawPearl(now); drawPearls(now); drawCoins3(now); drawGuards(now); drawGate(); drawQcubes();
    drawShards();
    if (skyFig) {
      gl.useProgram(figProg);
      gl.uniformMatrix4fv(FU.uVP, false, vp);
      gl.uniform3fv(FU.uEye, eye); gl.uniform3fv(FU.uHaze, HAZE);
      gl.bindVertexArray(skyFig.vao);
      gl.drawArrays(gl.TRIANGLES, 0, skyFig.count);
    }
    if (homage || studies) {
      gl.useProgram(homProg);
      gl.uniformMatrix4fv(OU.uVP, false, vp);
      gl.uniform3fv(OU.uEye, eye); gl.uniform3fv(OU.uHaze, HAZE);
      (homage ? homage.figures : []).forEach(function (f) { gl.bindVertexArray(f.vao); gl.drawElements(gl.TRIANGLES, f.count, gl.UNSIGNED_INT, 0); });
    }
    drawChars();   // (the studies, in characters, and the cubes' characters)
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
    if (rocketCh && rocketCh.vcount) { veil.push({ ch: rocketCh, d: hypot(eye[0] - rocketCh.org[0] - 2.5, eye[2] - rocketCh.org[2] - 2.5), lift: lift, rx: rx, rz: rz }); }
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
        gl.uniform3f(U.uOff, e.rx || 0, e.lift, e.rz || 0);
        // its grid's origin, as its own pass had it, so the veil's paint is the face's (the rocket's rides with it)
        if (e.ch === rocketCh) { gl.uniform3f(U.uOrg, rocketCh.org[0] + (e.rx || 0), rocketCh.org[1] + e.lift, rocketCh.org[2] + (e.rz || 0)); }
        else { gl.uniform3f(U.uOrg, 0, 0, 0); }
        gl.bindVertexArray(e.ch.vao);
        gl.drawElements(gl.TRIANGLES, e.ch.vcount, gl.UNSIGNED_INT, e.ch.count * 4);
      });
      gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.depthMask(true);
    }
    drawMonarch(now);
    drawTrails(); drawSwoosh(now);
    gl.bindVertexArray(null);
    glyphEnd(cw, chh);
    if (now - slowAt > 250) { slowAt = now; fetchNear(); where(); skyCheck(); homageCheck(); guardsLook(now); }
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
    swing = swingNext = null; shards = []; swoosh = []; headWas = null; ignite = null; delete document.body.dataset.ride;
    if (guards.length) { homeGuards(); }
    dropSight(); pearls = []; carried = THROW.CARRY; drawCarry();   // he comes to with his five pearls, none lying about
    if (Hd) { Hd = null; pov = "third"; delete document.body.dataset.holo; drawViews(); }
    if (skyFig) { skyFig.away = false; }
    blend = null; camD = 0;
    P.x = at.x; P.z = at.z; P.y = at.y; P.vx = P.vy = P.vz = 0;
    intro = { t0: performance.now(), yaw0: wakeYaw(), turn: 1.5, lines: lines };
    document.body.dataset.film = "true";
  }
  function awake() {
    var again = intro.lines[0] === "The guards walk you out." || intro.lines[0] === "The guards have your body.";
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
    var line = ((behind === 4 ? "The four pieces are behind four of the works inside. Your notes say which; there are more notes in the rooms." :
         behind === 1 ? "One piece is behind a work inside. The wreck's log says where the others fell." :
         behind ? behind + " pieces are behind works inside. The wreck's log says where the others fell." :
         "Four pieces of your rocket are somewhere in " + setting.name + ". The notes show where they fell.") + (open ? "" : " Tap Notes to read it."));
    say(line);
    // and then the coins, once the first has been read
    if (coins.length && got.length < coins.length) { setTimeout(function () { if (!intro) { say(coinsLine()); } }, 2600 + line.length * 35); }
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
    var src = launched ? [wr.x + 0.5 + (ride ? ride.dx : 0), wr.y + rocketLift, wr.z + 0.5 + (ride ? ride.dz : 0)] : [wr.x + 0.5, wr.y + 2, wr.z + 0.5];
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
    igniteDraw(c, W, H, now);
    // The stick's water, under the thumb (see Water).
    if (!intro) { water.step(min(0.05, (now - (water.last || now)) / 1000), stillMotion.matches); water.last = now; water.draw(c, now / 1000, stillMotion.matches); }
    // (the crosshair gives way to the sight)
    if (!intro && !launched && !touchy && !sightOn()) {
      if (!crossMark) { crossMark = figure(17, 1, [[255, 255, 255], [196, 196, 196], [36, 34, 32]]); }
      c.globalAlpha = 0.92;
      c.drawImage(crossMark, round(W / 2 - 8.5), round(H / 2 - 9));
      c.globalAlpha = 1;
    }
    drawSight(c, W, H, now);
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
      // (a piece a pearl rang on first)
      else if (lying.length) { lying.sort(function (a, b) { return (marked[b.k] ? 1 : 0) - (marked[a.k] ? 1 : 0) || dist(a) - dist(b); }); target = lying[0]; label = adv.pieces[target.k].name.replace(/^The /, ""); }
      else if (found.length < 4) { text = "Behind which work? Read your notes"; }
      // a coin nearer than where that points (once the pieces are all found, the wreck first)
      var cn = left().map(function (q) { return { x: q.x - 0.5, y: q.y - PEARL.headY, z: q.z - 0.5 }; }).sort(function (a, b) { return dist(a) - dist(b); })[0];
      if (cn && !(found.length === 4 && !built) && (target ? dist(cn) < dist(target) : !text)) { target = cn; label = "A coin"; }
      if (target && inRoom(target.x + 0.5, target.y, target.z + 0.5) && !inBuilding() && place.door) { target = { x: place.door.x - 0.5, y: place.door.y, z: place.door.z - 0.5 }; label = "The way in"; }
      if (target) {
        var dx = target.x + 0.5 - m.x, dz = target.z + 0.5 - m.z, dy = target.y - m.y;
        text = bearing(target.x + 0.5, target.z + 0.5) + " " + label + " · " + round(hypot(dx, dz)) + " m" + (dy > 3 ? " up" : dy < -3 ? " down" : "");
      }
      // a guard chasing him, before all else (behind the camera as often as not)
      var gc = guards.filter(function (g) { return g.mode === "chase"; }).sort(function (a, b) { return hypot(a.x - m.x, a.z - m.z) - hypot(b.x - m.x, b.z - m.z); })[0];
      if (gc) { text = bearing(gc.x, gc.z) + " A guard · " + round(hypot(gc.x - m.x, gc.z - m.z)) + " m"; }
    }
    el.hidden = !text;
    if (text && el.textContent !== text) { el.textContent = text; }
    $("build").hidden = !!Hd || !(found.length === 4 && !built && hypot(wr.x - P.x, wr.z - P.z) < 9);
    $("launch").hidden = !!Hd || !(built && !launched);
    holoHud();
    // What the crosshair is on (on a computer): a work's title, a note.
    if (!touchy && tick % 3 === 0) {
      var tag = $("tag"), hit = !intro && !launched && vp && !sightOn() ? pick(lookDir(camLast.yaw, camLast.pitch)) : null, tt = "";
      var cq = hit !== undefined && vp && !intro && !launched && !sightOn() ? coinAt(lookDir(camLast.yaw, camLast.pitch), hit) : null;
      if (cq) { tt = "A coin · " + cq.text + " · click to read it"; }
      else if (hit && hit.painting) { tt = (hit.painting.f.title || "A work") + (looked[hit.painting.f.id] ? " · looked behind" : " · click to read its label"); }
      else if (hit && hit.b === B.NOTE && hit.r <= REACH) { tt = "A note · click to read it"; }
      else if (hit && hit.b !== undefined) { tt = (window.Homage && (Homage.label(homage, hit.x, hit.y, hit.z) || Homage.label(studies, hit.x, hit.y, hit.z))) || partText(Pl.partAt(place, hit.x, hit.y, hit.z)); }
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
    if (space) { return; }   // (in space the line is the tally)
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
    if ((built && !quiet) || !ready() || (Hd && !quiet) || (court && !quiet)) { return; }
    built = true;
    store();
    // The wreck's blocks cleared away, and the rocket stood there in a mesh of its own, so it can rise:
    // a white body, red nose and fins.
    var rx = place.wreck.x, rz = place.wreck.z, ry = place.wreck.y, x, y, z, list = [];
    for (y = ry; y < ry + 14; y += 1) { for (z = rz - 2; z <= rz + 2; z += 1) { for (x = rx - 2; x <= rx + 2; x += 1) { if (!(place.M && place.M.has(x, y, z))) { w.set(x, y, z, B.AIR); } } } }
    refresh(rx - 2, rz - 2, rx + 2, rz + 2);
    for (z = rz - 2; z <= rz + 2; z += 1) { for (x = rx - 2; x <= rx + 2; x += 1) { guardsRemesh(x, z); } }
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
    if (!built || launched || Hd || ignite || court) { return; }
    dropSight();
    closeLabel();
    $("notes").hidden = true;
    igniteBegin();
  }
  // The fire struck: he rides it, the camera behind its nose, the stick his until the figure in the sky is passed.
  function rideBegin() {
    launched = performance.now();
    store();
    ride = { dx: 0, dz: 0, top: rideTop(), cut: null };
    document.body.dataset.ride = "true";
    canvas.setAttribute("aria-label", "The rocket climbing: the stick or W A S D steers it until it passes the figure in the sky.");
    var wr = place.wreck;
    P.yaw = Math.atan2(wr.x + 0.5 - P.x, -(wr.z + 0.5 - P.z)); P.pitch = REST;
    blend = { from: camLast, t0: performance.now(), dur: T_VIEW, pitchFrom: P.pitch, pitchTo: null };
    say("Lift-off. The stick steers the rocket until you pass the figure in the sky.", true);
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
      end.querySelector(".lede").textContent = (found.length < 4 ? "The rocket your ten coins built" : "The rocket built from the pieces you found " + (setting.kind === "museum" ? "behind its works" : "in and round it")) +
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
      (coins.length ? '<p class="count">Coins: ' + got.length + ' of ' + coins.length + (got.length < coins.length ? ', and all of them build the rocket' : '') + '</p>' : '') +
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
    try { localStorage.setItem(SAVE, JSON.stringify({ key: advKey(), found: found, known: known, looked: looked, alarms: alarms, built: built, done: !!ended, escaped: escaped, coins: got })); }
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
  var holdTick = function () {};   // wire() sets it: the look's holds, read each frame (sightStep)
  // A button pressed with one thumb while the other moves him or looks (the artist, 21 Oct 2026: "I want to be able to
  // switch between holographic view and third person view while I'm moving Mr Pearl. Right now if I am using my left
  // finger to move him, then it won't let me click on the perspective change button with my right finger without
  // releasing my left finger"): a phone makes no click of a tap while another finger is down, so a touch acts as it
  // presses, as the jump button does, and the click a lone tap still makes after it is not counted again: the press
  // marks it, and the click is a touch's (pointerType "touch" or "pen"; where a click has no pointerType, as on an
  // iPhone, a tap's has a detail and the keys' none). A mouse and the keys click as before.
  function press(el, fn) {
    var pressed = false;
    el.addEventListener("pointerdown", function (e) { if (e.pointerType === "mouse") { return; } e.preventDefault(); pressed = true; fn(e); });
    el.addEventListener("click", function (e) {
      var made = pressed && (e.pointerType === "touch" || e.pointerType === "pen" || (e.pointerType === undefined && e.detail !== 0));
      pressed = false;
      if (made) { e.preventDefault(); e.stopPropagation(); return; }
      if (e.detail) { el.blur(); }   // a pointer's click leaves no focus behind, so Enter then throws (not this button)
      fn(e);
    });
  }
  function wire() {
    var stick = null, look = {}, lastTap = null, run = null;
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      if (intro) { if (performance.now() - intro.t0 > 600) { intro.t0 -= 9600; } return; }
      if (e.pointerType === "touch") { touchy = true; document.body.dataset.touch = "true"; $("tag").hidden = true; }
      try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* a pointer a test dispatched */ }
      // The left of a phone's screen is the stick; anywhere else turns the view, and a tap acts. (While the fire is asked
      // for there is nothing to walk: a touch there is a tap or a swing like any other.)
      if (!ignite && touchy && e.clientX < window.innerWidth * 0.4 && e.clientY > window.innerHeight * 0.45 && !stick) {
        stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
        water.down(e.clientX, e.clientY, performance.now() / 1000);
        $("notes").hidden = true;
        return;
      }
      look[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, button: e.button, held: false, chord: null };
      input.looking = true;
      // the right mouse button is the sight's (the artist, 20 Oct 2026: "I want you to be able to aim at a target with a
      // reflex sight"): held, it is up while held; clicked, it stays up
      if (e.pointerType === "mouse" && e.button === 2) { sightPress(); }
    });
    // A mouse's second button pressed or let go while the first is held comes as a move whose button is the one that
    // changed (pointer events' chords): the right button is the sight's; the left, pressed and let go within a tap, is
    // a click (with the sight up, the throw).
    var chord = function (l, e) {
      var now = performance.now();
      if (e.button === 2) { if (e.buttons & 2) { sightPress(); } else { sightRelease(); } return; }
      if (e.button !== 0) { return; }
      if (e.buttons & 1) { l.chord = { t: now, x: e.clientX, y: e.clientY, moved: false }; return; }
      var q = l.chord; l.chord = null;
      if (q && !q.moved && now - q.t < 450) { if (sightOn()) { throwAt(); } else { var r = canvas.getBoundingClientRect(); act(r.left + r.width / 2, r.top + r.height / 2, false); } }
    };
    canvas.addEventListener("pointermove", function (e) {
      // the fire: each finger's (or the cursor's) own path rubs; the way between two fingers, or from where one lifted
      // to where it comes down again, is not friction
      // (a finger's look is kept where it is, so one still down when the ride begins does not swing the camera by the
      // whole swing)
      if (ignite) { var pp = ignite.ptr || (ignite.ptr = {}), lp = pp[e.pointerId], l0 = look[e.pointerId]; pp[e.pointerId] = [e.clientX, e.clientY]; if (l0) { l0.x = e.clientX; l0.y = e.clientY; } if (lp) { igniteRub(lp[0], lp[1], e.clientX, e.clientY); } return; }
      if (stick && e.pointerId === stick.id) {
        var dx = e.clientX - stick.x, dy = e.clientY - stick.y, L = min(water.REACH, hypot(dx, dy)), a = Math.atan2(dy, dx);
        input.side = Math.cos(a) * L / water.REACH; input.fwd = -Math.sin(a) * L / water.REACH;
        water.move(e.clientX, e.clientY);
        return;
      }
      var l = look[e.pointerId];
      if (!l) { return; }
      if (e.pointerType === "mouse" && e.button >= 0) { chord(l, e); }
      var mx = e.clientX - l.x, my = e.clientY - l.y;
      if (abs(e.clientX - l.sx) + abs(e.clientY - l.sy) > 8) { l.moved = true; }
      if (l.chord && abs(e.clientX - l.chord.x) + abs(e.clientY - l.chord.y) > 8) { l.chord.moved = true; }
      // raised, one px of the finger moves the mark one px over the far world (1/f: a reflex sight magnifies nothing;
      // the artist, 20 Oct 2026: "a reflex sight that I can control with my right finger")
      var k = sightOn() ? 2 * T35 / window.innerHeight : 0.0055;
      P.yaw += mx * k; P.pitch = clampPitch(P.pitch - my * k);
      if (blend) { blend.pitchTo = null; }
      // a drag (past the tap's 8 px) stops a hold's turn; a held finger's pixel or two of tremor does not
      if ((mx || my) && l.moved) { sight.turn = null; }
      l.x = e.clientX; l.y = e.clientY;
    });
    var up = function (e) {
      if (ignite && ignite.ptr) { delete ignite.ptr[e.pointerId]; }
      if (stick && e.pointerId === stick.id) { stick = null; input.fwd = input.side = 0; water.up(performance.now() / 1000); return; }
      var l = look[e.pointerId];
      delete look[e.pointerId];
      input.looking = Object.keys(look).length > 0;
      if (!l) { return; }
      // the right button is the sight's, never a tap (it placed a block until 21 Oct 2026; Place's click places)
      if (e.pointerType === "mouse" && e.button === 2) { sightRelease(); return; }
      var p = l.button === e.button || e.pointerType !== "mouse" ? { moved: l.moved, t: l.t } : l.chord;
      if (!p || p.moved || performance.now() - p.t >= 450 || l.held) { return; }
      // with the sight up a tap or a click throws (the artist, 20 Oct 2026: "And when I click with the reflex sight up,
      // I am able to throw something"); else it acts where it was, as before
      // As the hologram, a second tap within a beat and a finger's breadth of the first takes the head there (the
      // artist, 26 Oct 2026: "When in holographic mode I want to be able to double tap with my right finger and teleport
      // to wherever I am clicking while my left finger controls the joystick of my movements"); a computer's double
      // click takes it where the crosshair is.
      // Walking (his body moving), a double tap is the dash (dashOn); standing, taps are taps, as before. Taps each within
      // a beat of the last are a run: one in it is quick (act), and once one has broken or placed, a double tap in the
      // run is more of that work, twice as fast, not the dash (the artist, 28 Oct 2026: "because of the double tap dash
      // now, I end up dashing away when breaking things. I want you to incorporate the dash when tapping to breaking
      // and placing").
      var cr = canvas.getBoundingClientRect(), tx = touchy ? e.clientX : cr.left + cr.width / 2, ty = touchy ? e.clientY : cr.top + cr.height / 2, lt = lastTap, tn = performance.now();
      var dbl = !!lt && tn - lt.t < BEAT * 1000 && hypot(e.clientX - lt.x, e.clientY - lt.y) < 40;
      var quick = !!run && tn - run.t < BEAT * 1000;
      lastTap = dbl ? null : { t: tn, x: e.clientX, y: e.clientY };
      run = { t: tn, work: quick && run.work };
      if (dbl && Hd && Hd.phase === "free") { teleportHead(tx, ty); return; }
      if (dbl && !run.work && !Hd && !sightOn() && !intro && !launched && !ignite && !court && hypot(P.vx, P.vz) > 0.5) { dashOn(); return; }
      if (sightOn()) { if (e.type === "pointerup") { throwAt(); } }
      else if (act(tx, ty, false, quick)) { run.work = true; }
    };
    // A look held still for a beat, with the sight up, brings the point under it to the mark (sightAimAt).
    holdTick = function (now) {
      if (!sightOn()) { return; }
      Object.keys(look).forEach(function (id) {
        var l = look[id];
        // (held a beat with the sight up: a finger already resting when it came up counts from then; 22 Oct 2026)
        if (l.moved || l.held || l.button !== 0 || now - max(l.t, sight.at) < BEAT * 1000) { return; }
        l.held = true; sightAimAt(l.x, l.y);
      });
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    var jb = $("jump");
    jb.addEventListener("pointerdown", function (e) { e.preventDefault(); input.jump = true; });
    ["pointerup", "pointercancel", "pointerleave"].forEach(function (ev) { jb.addEventListener(ev, function () { input.jump = false; }); });
    // The buttons of play take a touch as it presses, so the other thumb can stay on the stick (press, above).
    press($("mode"), function () { if (Hd) { barred(); return; } setMode(mode === "break" ? "place" : "break"); });
    press($("v-holo"), function () { toggleHolo(); });
    press($("v-sight"), function () { if (Hd) { barred(); return; } raiseSight(); });
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
      if (ignite && (k === " " || k === "Enter") && !e.repeat) { igniteTap(); }
      if (k === "h" && !e.repeat) { toggleHolo(); }   // the button's key, once a press: held, it does not toggle again
      if (k === "r" && !e.repeat) { if (Hd) { barred(); } else { raiseSight(); } }   // the sight (R), as its button
      // with the sight up, T or Enter throws (Enter only while nothing else has the focus: a focused button takes it)
      var free = document.activeElement === document.body || document.activeElement === canvas || document.activeElement === $("v-sight");
      if (court && (k === "t" || (k === "Enter" && free)) && !e.repeat) { input.fire = true; e.preventDefault(); }
      if (!court && (k === "t" || (k === "Enter" && free)) && !e.repeat) { if (Hd) { if (k === "t") { barred(); } } else if (sight.up) { throwAt(); e.preventDefault(); } }
      if (Hd && ((k >= "1" && k <= "5") || k === "e" || k === "q" || k === "b")) { barred(); }
      else if (!court) {
        if (k >= "1" && k <= "5") { slot = +k - 1; setMode("place"); }
        if (k === "e" || k === "q") { setMode(mode === "break" ? "place" : "break"); }
        if (k === "b") { buildRocket(false); }
      }
      if (k === "n") { $("notes").hidden = !$("notes").hidden; }
      if (k === "f" && current && !court) { if (Hd) { barred(); } else { lookBehind(); } }
      if (k === "Escape") { closeLabel(); closeAsk(); $("notes").hidden = true; raiseSight(false); }
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
      // The ten coins (a building or a new form; a city has none yet), laid before the homage so they are the same
      // whether it is there or not, then raised onto whatever the homage and the studies set where one lies.
      coins = me3 && place.M && Pl.coins ? Pl.coins(place, hung, { wake: underTree(), headY: PEARL.headY, headR: PEARL.headR, reach: REACH, name: setting.name }) : [];
      got = []; headWas = null;
      // The homage's blocks, then the place's grid sent for the walk, with the pieces and the notes in it. A world
      // escaped to has none, even come back to.
      var was = saved();
      if (was && was.key === advKey() && was.escaped) { escaped = true; }
      homage = homageData && window.Homage && !escaped ? Homage.plan(place, homageData, { wake: underTree(), yaw: wakeYaw(), eye: EYE, B: B }) : null;
      studies = studiesData && window.Homage && Homage.row ? Homage.row(place, studiesData, { wake: underTree(), eye: EYE, B: B, avoid: homage && homage.box }) : null;
      monarchPlace(); gatePlace(); qcubePlace(); if (glyphProg) { glyphStoryPlace(); } else { glyphTable = null; }
      seatCoins(); initGuards();
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
        got = (s.coins || []).filter(function (id) { return coins.some(function (q) { return q.id === id; }); });
        pieces.forEach(function (pc) { if (found.indexOf(pc.k) >= 0) { w.set(pc.x, pc.y, pc.z, B.AIR); remeshAt(pc.x, pc.z); } });
        notes.forEach(function (n) { if (known[n.k + ":" + n.i]) { w.set(n.x, n.y, n.z, B.AIR); remeshAt(n.x, n.z); } });
        if (s.built && ready()) { buildRocket(true); }
      }
      store();
      $("start").hidden = true;
      $("veil").hidden = true;
      document.title = adv.title + " · " + NAME;
      holoTop = place.crash.y + Math.sqrt(FAR * FAR - (w.SX * w.SX + w.SZ * w.SZ) / 4);
      drawPieces(); drawCoins(); drawHotbar(); setMode("break"); where(); drawViews();
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
    VIEW_LABEL = canvas.getAttribute("aria-label");
    hud = $("hud");
    // Straight in: nothing over the view until you have come to.
    if (CFG.play) { document.body.dataset.film = "true"; }
    // (under Glyph Light the canvas takes one triangle: its picture is multisampled already, glyphBegin)
    gl = canvas.getContext("webgl2", { antialias: !GLYPH.ON });
    quality = quality0 = window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? 0.75 : 1;
    if (!gl) { $("status").textContent = $("veil").textContent = "This game needs WebGL 2, which this browser does not offer."; return; }
    prog = compile(VS, FS); skyProg = compile(SKY_VS, SKY_FS); artProg = compile(ART_VS, ART_FS); figProg = compile(FIG_VS, FIG_FS); homProg = compile(HOM_VS, HOM_FS);
    initPearl(); initThrow();
    shardProg = compile(SHARD_VS, SHARD_FS);
    ["uVP", "uM", "uT", "uEye", "uHaze"].forEach(function (n) { SHU[n] = gl.getUniformLocation(shardProg, n); });
    ["uVP", "uOff", "uPal", "uEye", "uSun", "uT", "uSky", "uHaze", "uVox", "uOrg", "uDim", "uFloor", "uPx", "uSteps", "uVeil", "uM", "uInvM",
     "uAxA", "uAxB", "uHeadC", "uHeadE", "uNear", "uPaint"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
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
                 fetch("homage.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }),
                 fetch("studies.json").then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; })]).then(function (res) {
      var d = res[0];
      // Mr Pearl, built of the unit from his form's file (without it the game plays, and he is not seen).
      try { pearlFrom(res[2]); } catch (err) { me3 = null; }
      homageData = res[3]; studiesData = res[4];
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
             alarms: function (v) { if (v != null) { alarms = v; drawPieces(); } return alarms; }, act: act, remeshAt: remeshAt, buildRocket: buildRocket, launch: launch, showLabel: showLabel,
             lookBehind: lookBehind, readNote: readNote, queue: function () { return queue.length; }, intro: function () { return intro; },
             skip: function () { if (intro) { intro.t0 -= 9600; } },
             hold: function (q, steps) { held = true; quality = q; walk = steps || 8; resize(); }, walk: function () { return walk; }, quality: function () { return quality; },
             flush: function () { pump(1e9); }, figure: figure, fly: function (on) { flying = !!on; }, sky: function () { return skyFig; }, underTree: underTree,
             homage: function () { return homage; }, studies: function () { return studies; }, wakeYaw: wakeYaw,
             aim: function () { var h = eye && camLast ? pick(lookDir(camLast.yaw, camLast.pitch)) : null; return h ? (h.painting ? "work: " + h.painting.f.title : "block " + h.b + " at " + h.r.toFixed(2)) : "nothing"; },
             pov: function () { return pov; }, toggle: toggleHolo, head: function () { return Hd; }, cam: function () { return { eye: eye, last: camLast, camD: camD, blend: blend, drawMe: drawMe }; },
             swing: function () { return swing && { u: swing.u, side: swing.side, hit: swing.hit, struck: !!swing.struck, broke: !!swing.broke, ret: !!swing.ret, speed: swing.speed, style: swing.style, quick: !!swing.quick, at: [swing.x, swing.y, swing.z], next: swingNext && [swingNext.x, swingNext.y, swingNext.z], pose: swingPose() }; },
             holdSwing: function (u) { if (swing) { swing.hold = u; } }, shards: function () { return shards.map(function (q) { return { c: q.c, v: q.v, t: q.t, lies: !!q.lies }; }); },
             screenOf: function (p) { var r = canvas.getBoundingClientRect(), q = [0, 0, 0, 0]; for (var i = 0; i < 4; i++) { q[i] = vp[i] * p[0] + vp[4 + i] * p[1] + vp[8 + i] * p[2] + vp[12 + i]; } return q[3] > 0 ? [r.left + (q[0] / q[3] * 0.5 + 0.5) * r.width, r.top + (0.5 - q[1] / q[3] * 0.5) * r.height] : null; },
             farEnd: function () { return swing && !swing.ret && FAR_END ? farEndAt(swing, swing.u) : null; }, smashConsts: function () { return { BEAT: BEAT, SWING: SWING, LEAP: LEAP, COIL: COIL, ARMS_UP: ARMS_UP, E0: E0, Y_SH: Y_SH, FAR_END: FAR_END }; },
             coins: function () { return { list: coins, got: got.slice(), R: coinR(), RO: coinRO(), units: coinCh && coinCh.units }; }, takeCoin: function (i) { takeCoin(coins[i]); },
             space: function () { return space; }, ride: function () { return ride; }, ignite: function () { return ignite; }, igniteConsts: IGNITE, spaceConsts: function () { return { SPACE: SPACE, V: spaceV(), TURN: spaceTurn(), MARK: markDrop() }; },
             guards: function () { return guards; }, guardConsts: function () { return { GUARD: GUARD, reach: guardReach() }; }, sees: sees, stands: function () { return gStand; },
             paint: function (v) { if (v != null) { PAINT = v; } return PAINT; },
             dash: function () { return dash; }, dashConsts: DASH,
             glyph: function (v) { if (v != null) { if (typeof v === "object") { Object.assign(GLYPH, v); } else { GLYPH.ON = v; } } return Object.assign({ fb: !!(glyphFb && glyphFb.ok) }, GLYPH); },
             glyphStory: function () { return { frames: glyphFrames, origin: glyphOrigin, panel: GLYPH.PANEL, grid: GLYPH.GRID }; },
             monarch: function () { return monarch && { A: monarch.A, dir: monarch.dir, y: monarch.y, at: monarchAt((performance.now() - monarch.t0) / 1000), C: MONARCH }; },
             monarchShift: function (v) { if (monarch) { monarch.A[0] += v[0]; monarch.y += v[1]; monarch.A[1] += v[2]; } },
             chars: function () { return { count: charCount, apex: APEX }; },
             qcubes: function () { return qcubes; }, asking: function () { return asking; }, cubeAct: function (i) { var q = qcubes[i || 0]; if (q) { CUBE_ACTS[q.ch](q); } },
             court: function () { return court; }, courts: function () { return courts; }, horse: function () { return horse; }, gate: function () { return gate; },
             enterCourts: enterCourts, leaveCourts: leaveCourts, courtConsts: COURT, courtAt: courtAt, nemSkill: nemSkill, ballLands: ballLands, courtsSim: courtsSim,
             firsts: function () { return firsts.slice(); }, thrownN: function () { return thrownN; },
             stone: function () { return onStone; }, px: function () { return pxW; }, putOut: putOut,
             bring: bringBody, home: goHome, harm: harmBody, consts: { AIM: AIM, REST: REST, TP_D: TP_D, TP_UP: TP_UP, TP_DOWN: TP_DOWN, TP_HEAD: TP_HEAD, TURN: TURN, T_VIEW: T_VIEW, T_LIFT: T_LIFT, LIFT: LIFT, HAT_REACH: HAT_REACH, HOLO_V: HOLO_V, HOLO_V_IN: HOLO_V_IN, HOLO_T: HOLO_T, BAR: BAR, NEAR_F: NEAR_F, holoTop: holoTop }, holoLeft: function (v) { if (v != null) { holoLeft = v; } return holoLeft; },
             pearl: function () { return me3 && { ms: me3.ms, cells: me3.body.cells, parts: me3.parts.length, cell: me3.body.cell, PEARL: PEARL, throwArm: me3.body.throwArm }; },
             // the sight and the throw (20 Oct 2026); holdView pins the raise (and its blend) at s for photographs, null lets go
             sight: function () { var n = performance.now(); return { up: sight.up, on: sightOn(), ease: sightEase(n), fling: flingAt(n), ready: sightReady(n), theta: sight.theta, omega: sight.omega,
               next: sight.next, thrown: sight.thrown, turn: !!sight.turn, aimAt: sight.turn && sight.turn.Q, rmb: !!sight.rmb, head: sight.head, inHand: sight.inHand, feet: sight.feet.slice(), ringSaid: sight.ringSaid,
               hit: sight.hit && { t: sight.hit.t, r: sight.hit.r, b: sight.hit.b, x: sight.hit.x, y: sight.hit.y, z: sight.hit.z, work: sight.hit.painting ? sight.hit.painting.f.title : null, water: !!sight.hit.water },
               land: sight.arc && sight.arc.at, launched: sight.arc && sight.arc.L && { th: sight.arc.L.th, vel: sight.arc.L.vel, H: sight.arc.L.H },
               tag: $("sight-tag").hidden ? "" : $("sight-tag").textContent, say: $("sight-say").textContent }; },
             stick: function () { return water.busy(); }, raiseSight: raiseSight, throwAt: throwAt, sightAim: sightAimAt, predict: predict, hand: handAt,
             holdView: function (s) { sight.hold = s; if (blend) { blend.hold = s; } },
             holdFling: function (u) { sight.flingHold = u; },
             pearls: function () { return pearls.map(function (p) { return { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, state: p.state, t: p.t, wet: p.wet, first: p.first, from: p.from }; }); },
             carried: function (v) { if (v != null) { carried = v; drawCarry(); } return carried; }, marked: function () { return marked; },
             clearPearls: function () { pearls.length = 0; carried = THROW.CARRY; thrownN = 0; firsts.length = 0; drawCarry(); },
             sightConsts: { SIGHT_D: SIGHT_D, SIGHT_F: SIGHT_F, WIN: Math.asin(PEARL.headR / SIGHT_D), U: sightU(), THROW: THROW, HOLD: HOLD, HOLD_AT: HOLD_AT, HAT_DOFF: HAT_DOFF, HAT_LIFT: HAT_LIFT, BEAT: BEAT, T_VIEW: T_VIEW } };
  } };
  init();
})();
