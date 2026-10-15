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
     can be. */
  var CFG = window.ROCKET || {};
  var BASE = CFG.base || "../../v2/", CDN = "https://d32dm0rphc51dk.cloudfront.net/", NEXT = "rocket-next";
  function artOf(id) { return CFG.art ? CFG.art(id) : CDN + id + "/medium.jpg"; }
  var CH = 16, REACH = 6, LOOK = 9, EYE = 1.62, PPM = 96, FOV = 70, SAVE = "rocket-save-v2";
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

  var gl, prog, skyProg, artProg, figProg, U = {}, SU = {}, AU = {}, FU = {}, chunks = {}, queue = [], canvas, hud;
  var FACES = [
    { d: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] }, { d: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] }, { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] }, { d: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
  ];

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
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(ind), gl.STATIC_DRAW);
    ch.count = ind.length;
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
    "uniform mat4 uVP; uniform vec3 uOff;",
    "out vec3 vP; flat out int vF; flat out int vB;",
    "void main() { vP = aP + uOff; vF = int(aI.x); vB = int(aI.y); gl_Position = uVP * vec4(vP, 1.0); }"
  ].join("\n");
  /* The blocks are drawn from their faces in. Each face where a block meets the open (air, water, a note,
     or glass or leaves, which are seen through) starts a ray from the eye on into the blocks behind it, and
     the ray is walked block to block through the grid (uVox), the figure's six bars tested in each. The first
     bar it meets is what is seen, in the tone of the way that face of the bar looks (up white, east and west
     grey, north and south black, as the artist drew them), each a little deeper the further in it lies. A
     ray that comes out into the open again shows what is beyond: the fragment goes, and the faces behind are
     drawn. One still among bars after eight blocks shows the dark between them. Far off, where a bar is
     narrower than a pixel or two, a face is what its blocks average to, so nothing shimmers: FAR, the same
     walk run over many rays (scripts/rocket_far.py), at a slant and from nearer straight on. A face keeps
     its own depth: along its ray, every face between it and what it meets is one the walk has passed
     through, so the nearest still wins. Water and the notes are surfaces, not blocks. */
  // For each face, [white, grey, black, the dark between] as seen at a slant, then from nearer straight on.
  var FAR_SLANT = [[0.393, 0.156, 0.289, 0.033], [0.42, 0.083, 0.169, 0.069], [0.099, 0.363, 0.249, 0.057],
                   [0.099, 0.205, 0.542, 0.024], [0.382, 0.202, 0.133, 0.03], [0.45, 0.229, 0.093, 0.029]];
  var FAR_ON = [[0.197, 0.409, 0.149, 0.1], [0.228, 0.366, 0.135, 0.104], [0.366, 0.211, 0.2, 0.081],
                [0.302, 0.175, 0.244, 0.073], [0.219, 0.135, 0.414, 0.079], [0.243, 0.15, 0.388, 0.08]];
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
    "  if (st == 6 || st == 10) {",
    // Water: its own colour, the sky in it at a slant, a slow shimmer. A note: paper, catching the eye.
    "    vec3 c = pe.rgb / 255.0;",
    "    if (st == 6) { float sl = 1.0 - abs(normalize(vP - uEye).y); c = mix(c, uSky, 0.45 * sl * sl) * (0.94 + 0.06 * sin(uT * 0.9 + (vP.x - vP.z) * 0.8)); }",
    "    col = c * (0.56 + 0.16 * n.y + 0.58 * max(dot(n, uSun), 0.0));",
    "    if (st == 10) { col = c * (0.98 + 0.18 * (0.5 + 0.5 * sin(uT * 2.6))); }",
    "  } else {",
    "    if (!gl_FrontFacing) { discard; }",
    "    vec3 d = normalize(vP - uEye);",
    "    vec4 fw = mix(FAR_SLANT[vF], FAR_ON[vF], smoothstep(0.15, 0.75, -dot(d, n)));",
    "    vec3 far = fw.x * bar(vB, 1, 1.0) + fw.y * bar(vB, 0, 1.0) + fw.z * bar(vB, 2, 1.0) + fw.w * dark(vB);",
    "    float lod = smoothstep(0.05, 0.11, uPx * dist);",   // a bar two pixels wide, then one
    "    if (lod >= 1.0) { col = far; } else {",
    "      vec3 p0 = vP - uOrg;",
    "      d = mix(d, vec3(1e-6), vec3(equal(d, vec3(0.0))));",
    "      vec3 inv = 1.0 / d, td = abs(inv);",
    "      ivec3 c = ivec3(floor(p0 - n * 0.5)), sg = ivec3(sign(d));",
    "      vec3 tm = (vec3(c) + step(0.0, d) - p0) * inv;",
    "      float tin = 0.0; int res = 0; uint lb = uint(vB);",
    "      for (int k = 0; k < STEPS; k++) {",
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
    "      if (res == 2) { if (lod < 0.5) { discard; } col = far; }",
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
    paintings.filter(function (p) { return !p.asked && abs(p.cx - P.x) < 40 && abs(p.cz - P.z) < 40 && abs(p.y0 - P.y) < 14; })
      .sort(function (a, b) { return hypot(a.cx - P.x, a.cz - P.z) - hypot(b.cx - P.x, b.cz - P.z); })
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
  // Back under the tree after walking off, you are told once that it has closed again.
  function skyCheck() {
    if (!skyFig || intro || launched) { return; }
    var dx = P.x - skyFig.eye[0], dz = P.z - skyFig.eye[2], r = hypot(dx, dz), up = abs(P.y + EYE - skyFig.eye[1]);
    if (r > 6) { skyFig.away = true; }
    if (skyFig.away && !skyFig.said && r < 0.45 && up < 0.3) { skyFig.said = true; say("Under your tree the figure in the sky is the drawing again; anywhere else it comes apart.", true); }
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

  var P = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, ground: false, wet: false };
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

  function physics(dt) {
    var k = input.keys;
    var fwd = input.fwd + ((k.w || k.ArrowUp) ? 1 : 0) - ((k.s || k.ArrowDown) ? 1 : 0);
    var side = input.side + (k.d ? 1 : 0) - (k.a ? 1 : 0);
    if (k.ArrowLeft) { P.yaw -= dt * 2; }
    if (k.ArrowRight) { P.yaw += dt * 2; }
    var len = hypot(fwd, side);
    if (len > 1) { fwd /= len; side /= len; }
    P.wet = w.get(floor(P.x), floor(P.y + 0.6), floor(P.z)) === B.WATER;
    var speed = P.wet ? 2.2 : 4.3;
    P.vx = (Math.sin(P.yaw) * fwd + Math.cos(P.yaw) * side) * speed;
    P.vz = (-Math.cos(P.yaw) * fwd + Math.sin(P.yaw) * side) * speed;
    var jump = input.jump || k[" "];
    if (P.wet) { P.vy += (jump ? 9 : -6) * dt; P.vy = max(-2.5, min(3, P.vy)); }
    else {
      P.vy -= 25 * dt;
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
  }

  /* What a ray from the eye meets first: a work on a wall, or the block and the face it came in by. */
  function cast(dir, reach) {
    var x = floor(eye[0]), y = floor(eye[1]), z = floor(eye[2]);
    var sx = dir[0] > 0 ? 1 : -1, sy = dir[1] > 0 ? 1 : -1, sz = dir[2] > 0 ? 1 : -1;
    var tdx = abs(1 / dir[0]), tdy = abs(1 / dir[1]), tdz = abs(1 / dir[2]);
    var tx = (sx > 0 ? x + 1 - eye[0] : eye[0] - x) * tdx, ty = (sy > 0 ? y + 1 - eye[1] : eye[1] - y) * tdy, tz = (sz > 0 ? z + 1 - eye[2] : eye[2] - z) * tdz;
    var last = null, t = 0, axis = -1;
    while (t < reach) {
      var b = w.get(x, y, z);
      if (b !== B.AIR && b !== B.WATER) {
        if (axis === 0 || axis === 2) {
          var plane = axis === 0 ? (sx > 0 ? x : x + 1) : (sz > 0 ? z : z + 1), list = byPlane[(axis === 0 ? "x" : "z") + plane];
          if (list) {
            var hy = eye[1] + dir[1] * t, u = axis === 0 ? eye[2] + dir[2] * t : eye[0] + dir[0] * t, nd = axis === 0 ? -sx : -sz;
            for (var i = 0; i < list.length; i += 1) {
              var p = list[i];
              if (p.dir === nd && u >= p.u0 && u <= p.u1 && hy >= p.y0 && hy <= p.y1) { return { painting: p, t: t }; }
            }
          }
        }
        return { x: x, y: y, z: z, b: b, prev: last, t: t };
      }
      last = [x, y, z];
      if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; axis = 0; } else if (ty < tz) { y += sy; t = ty; ty += tdy; axis = 1; } else { z += sz; t = tz; tz += tdz; axis = 2; }
    }
    return null;
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
    var hit = cast(dirAt(px, py), LOOK);
    if (!hit) { return; }
    if (hit.painting) { showLabel(hit.painting); return; }
    if (hit.t > REACH) { return; }
    if (hit.b === B.NOTE) { readNote(hit.x, hit.y, hit.z); return; }
    if (!(forcePlace || mode === "place")) {
      if (hit.b === B.BEDROCK) { return; }
      if (hangsOn(hit.x, hit.y, hit.z)) { say("A work hangs on this wall."); return; }
      var k = PIECE_IDS.indexOf(hit.b);
      w.set(hit.x, hit.y, hit.z, B.AIR);
      if (k >= 0) { collect(k); }
      remeshAt(hit.x, hit.z);
    } else if (hit.prev) {
      var p = hit.prev;
      w.set(p[0], p[1], p[2], HOTBAR[slot]);
      if (boxHits(P.x, P.y, P.z)) { w.set(p[0], p[1], p[2], B.AIR); return; }
      remeshAt(p[0], p[2]);
    }
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
    $("behind").hidden = !!done;
    $("behind-done").hidden = !done;
    $("behind-done").textContent = done === "piece" ? "You found " + lower(adv.pieces[p.k].name) + " behind it." : "You looked behind it: nothing.";
    el.hidden = false;
    if (window.innerWidth < 900) { $("notes").hidden = true; }
  }
  function closeLabel() { current = null; $("label").hidden = true; }
  function lookBehind() {
    var p = current;
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
    w.set(x, y, z, B.AIR);
    remeshAt(x, z);
    if (!n) { return; }
    known[n.k + ":" + n.i] = 1;
    store();
    drawPieces(n);
    $("notes").hidden = false;
    say("A note, picked up. It is in your notes.", true);
  }

  /* ---- the frame ------------------------------------------------------------------ */

  var last = 0, sunDir = norm([-0.45, 0.78, -0.35]), SKY = [0.48, 0.66, 0.86], HAZE = [0.84, 0.86, 0.86];
  var crossMark = null, held = false, flying = false;
  var skyVao = null, skyFig = null, curPix = 1, quality = 1, near = 1, slow = 0, rocketCh = null, rocketLift = 0, ended = false, tick = 0, slowAt = 0;
  function norm(v) { var n = hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; }

  function frame(now) {
    var dt = min(0.05, (now - (last || now)) / 1000);
    last = now;
    tick += 1;
    // Frames coming slowly: the view a little coarser, then the walk among the bars kept nearer (near).
    if (!intro && !held && dt > 0.03) {
      slow += 1;
      if (slow > 45 && quality > 0.5) { quality -= 0.25; slow = 0; resize(); } else if (slow > 45 && near < 4) { near *= 1.5; slow = 0; }
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
      physics(dt);
    }
    pump(intro ? 14 : 6);
    eye = [P.x, P.y + eyeH, P.z];
    var cw = canvas.width, chh = canvas.height;
    var proj = perspective(FOV * Math.PI / 180, cw / chh, 0.08, 420);
    vp = mul(proj, view(eye, P.yaw, P.pitch));
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
    // The place's blocks to walk through, and how wide a pixel is at a block's distance.
    gl.uniform1f(U.uPx, near * 2 * Math.tan(FOV * Math.PI / 360) / chh);
    gl.uniform1i(U.uVox, 1);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, voxTex); gl.activeTexture(gl.TEXTURE0);
    gl.uniform3f(U.uOrg, 0, 0, 0); gl.uniform3i(U.uDim, w.SX, w.SY, w.SZ); gl.uniform1i(U.uFloor, 1);
    gl.uniform3f(U.uOff, 0, 0, 0);
    // Nearest first, so that what is hidden behind is turned away before the walk through its blocks.
    var pcx = P.x / CH - 0.5, pcz = P.z / CH - 0.5;
    Object.keys(chunks).map(function (k) { return chunks[k]; })
      .filter(function (ch) { return ch.count && abs(ch.cx - pcx) <= 14.5 && abs(ch.cz - pcz) <= 14.5; })
      .sort(function (a, b) { return hypot(a.cx - pcx, a.cz - pcz) - hypot(b.cx - pcx, b.cz - pcz); })
      .forEach(function (ch) {
        gl.bindVertexArray(ch.vao);
        gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
      });
    if (rocketCh) {
      var lift = launched ? Math.pow(max(0, (now - launched) / 1000 - 1), 2) * 2.4 : 0;
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
    if (skyFig) {
      gl.useProgram(figProg);
      gl.uniformMatrix4fv(FU.uVP, false, vp);
      gl.uniform3fv(FU.uEye, eye); gl.uniform3fv(FU.uHaze, HAZE);
      gl.bindVertexArray(skyFig.vao);
      gl.drawArrays(gl.TRIANGLES, 0, skyFig.count);
    }
    if (paintings.length) {
      gl.useProgram(artProg);
      gl.uniformMatrix4fv(AU.uVP, false, vp);
      gl.uniform3fv(AU.uEye, eye); gl.uniform3fv(AU.uHaze, HAZE);
      gl.activeTexture(gl.TEXTURE0); gl.uniform1i(AU.uTex, 0);
      gl.bindVertexArray(artVao);
      paintings.forEach(function (p) {
        if (!p.tex || abs(p.cx - P.x) > 90 || abs(p.cz - P.z) > 90) { return; }
        gl.bindTexture(gl.TEXTURE_2D, p.tex);
        gl.uniform1f(AU.uLit, looked[p.f.id] ? p.lit * 0.8 : p.lit);
        gl.drawArrays(gl.TRIANGLES, p.first, 6);
      });
    }
    gl.bindVertexArray(null);
    if (now - slowAt > 250) { slowAt = now; fetchNear(); where(); skyCheck(); }
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
  // You, lying beside the trunk of your tree, the wreck to one side.
  function lieDown(lines) {
    var at = underTree(), wr = place.wreck;
    P.x = at.x; P.z = at.z; P.y = at.y; P.vx = P.vy = P.vz = 0;
    var toWreck = Math.atan2(wr.x - P.x, -(wr.z - P.z));
    intro = { t0: performance.now(), yaw0: toWreck - 1.5, turn: 1.5, lines: lines };
    document.body.dataset.film = "true";
  }
  function awake() {
    var again = intro.lines[0] === "The guards walk you out.";
    intro = null;
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
  function bearing(x, z) {
    var b = Math.atan2(x - P.x, -(z - P.z)) - P.yaw;
    b = Math.atan2(Math.sin(b), Math.cos(b));
    return ARROWS[(round(b / (Math.PI / 4)) + 8) % 8];
  }
  function inRoom(x, y, z) { return place.kind !== "city" && !!Pl.roomAt(place, x, y, z); }
  function inBuilding() {
    if (!place.M) { return false; }
    var c = floor(P.z) * w.SX + floor(P.x);
    return inRoom(P.x, P.y, P.z) || (P.x >= 0 && P.z >= 0 && P.x < w.SX && P.z < w.SZ && !!place.M.foot[c] && P.y < place.M.base + 30);
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
      var dist = function (a) { return hypot(a.x + 0.5 - P.x, a.z + 0.5 - P.z) + abs(a.y - P.y) * 2; };
      if (found.length === 4 && !built) { target = { x: wr.x, y: wr.y, z: wr.z }; label = "The wreck"; }
      else if (unread.length) { unread.sort(function (a, b) { return dist(a) - dist(b); }); target = unread[0]; label = "A note"; }
      else if (lying.length) { lying.sort(function (a, b) { return dist(a) - dist(b); }); target = lying[0]; label = adv.pieces[target.k].name.replace(/^The /, ""); }
      else if (found.length < 4) { text = "Behind which work? Read your notes"; }
      if (target && inRoom(target.x + 0.5, target.y, target.z + 0.5) && !inBuilding() && place.door) { target = { x: place.door.x - 0.5, y: place.door.y, z: place.door.z - 0.5 }; label = "The way in"; }
      if (target) {
        var dx = target.x + 0.5 - P.x, dz = target.z + 0.5 - P.z, dy = target.y - P.y;
        text = bearing(target.x + 0.5, target.z + 0.5) + " " + label + " · " + round(hypot(dx, dz)) + " m" + (dy > 3 ? " up" : dy < -3 ? " down" : "");
      }
    }
    el.hidden = !text;
    if (text && el.textContent !== text) { el.textContent = text; }
    $("build").hidden = !(found.length === 4 && !built && hypot(wr.x - P.x, wr.z - P.z) < 9);
    $("launch").hidden = !(built && !launched);
    // What the crosshair is on (on a computer): a work's title, a note.
    if (!touchy && tick % 3 === 0) {
      var tag = $("tag"), hit = !intro && !launched && vp ? cast(lookDir(P.yaw, P.pitch), LOOK) : null, tt = "";
      if (hit && hit.painting) { tt = (hit.painting.f.title || "A work") + (looked[hit.painting.f.id] ? " · looked behind" : " · click to read its label"); }
      else if (hit && hit.b === B.NOTE && hit.t <= REACH) { tt = "A note · click to read it"; }
      else if (hit && hit.b !== undefined) { tt = partText(Pl.partAt(place, hit.x, hit.y, hit.z)); }
      tag.hidden = !tt;
      if (tt && tag.textContent !== tt) { tag.textContent = tt; }
    }
    if (current && hypot(current.cx - P.x, current.cz - P.z) > 11) { closeLabel(); }
  }
  // A block's section and project: "The white cantilevered box of Casa CM", and in a lot, the lot's new form.
  function partText(pa) {
    if (!pa || !pa.name) { return pa && pa.lot ? pa.lot.name : ""; }
    var own = pa.from === setting.name;
    return upper(own ? pa.part || pa.name : pa.name.indexOf(" of ") > 0 ? pa.name : pa.name + " of " + Fm.the(pa.from)) + (pa.lot ? " · " + pa.lot.name : "");
  }
  // Where you are: the room and its floor; or by a building of the lots round it, the new form it is; or the place.
  function where() {
    var rm = place.kind !== "city" ? Pl.roomAt(place, P.x, P.y, P.z) : null, t = setting.name;
    if (rm && rm.name) { var FL = place.floors[rm.floor]; t = upper(rm.name) + (place.kind === "museum" ? " · " + (FL.name || FL.label) : ""); }
    else if (w.lot) {
      var L = null, x = floor(P.x), z = floor(P.z);
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
    if ((built && !quiet) || found.length < 4) { return; }
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
    if (!built || launched) { return; }
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
      el.onclick = function (e) { e.stopPropagation(); slot = +el.dataset.slot; setMode("place"); };
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
    try { localStorage.setItem(SAVE, JSON.stringify({ key: advKey(), found: found, known: known, looked: looked, alarms: alarms, built: built, done: !!launched })); }
    catch (e) { /* kept only while the page is open */ }
  }
  function saved() {
    try { return JSON.parse(localStorage.getItem(SAVE) || "null"); } catch (e) { return null; }
  }

  /* ---- the hand ------------------------------------------------------------------------- */

  var touchy = false;
  function wire() {
    var stick = null, look = {};
    var joy = $("joy"), knob = joy.querySelector("i");
    canvas.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    canvas.addEventListener("pointerdown", function (e) {
      if (intro) { if (performance.now() - intro.t0 > 600) { intro.t0 -= 9600; } return; }
      if (e.pointerType === "touch") { touchy = true; document.body.dataset.touch = "true"; $("tag").hidden = true; }
      canvas.setPointerCapture(e.pointerId);
      // The left of a phone's screen is the stick; anywhere else turns the view, and a tap acts.
      if (touchy && e.clientX < window.innerWidth * 0.4 && e.clientY > window.innerHeight * 0.45 && !stick) {
        stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
        joy.style.left = (e.clientX - 50) + "px"; joy.style.top = (e.clientY - 50) + "px"; joy.hidden = false;
        $("notes").hidden = true;
        return;
      }
      look[e.pointerId] = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, button: e.button };
    });
    canvas.addEventListener("pointermove", function (e) {
      if (stick && e.pointerId === stick.id) {
        var dx = e.clientX - stick.x, dy = e.clientY - stick.y, L = min(40, hypot(dx, dy)), a = Math.atan2(dy, dx);
        knob.style.transform = "translate(" + Math.cos(a) * L + "px," + Math.sin(a) * L + "px)";
        input.side = Math.cos(a) * L / 40; input.fwd = -Math.sin(a) * L / 40;
        return;
      }
      var l = look[e.pointerId];
      if (!l) { return; }
      var mx = e.clientX - l.x, my = e.clientY - l.y;
      if (abs(e.clientX - l.sx) + abs(e.clientY - l.sy) > 8) { l.moved = true; }
      P.yaw += mx * 0.0055; P.pitch = max(-1.5, min(1.5, P.pitch - my * 0.0055));
      l.x = e.clientX; l.y = e.clientY;
    });
    var up = function (e) {
      if (stick && e.pointerId === stick.id) { stick = null; input.fwd = input.side = 0; joy.hidden = true; knob.style.transform = ""; return; }
      var l = look[e.pointerId];
      delete look[e.pointerId];
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
    $("mode").onclick = function () { setMode(mode === "break" ? "place" : "break"); };
    $("build").onclick = function () { buildRocket(false); };
    $("launch").onclick = launch;
    $("behind").onclick = lookBehind;
    $("leave").onclick = closeLabel;
    $("notes-btn").onclick = function () { var n = $("notes"); n.hidden = !n.hidden; if (!n.hidden && window.innerWidth < 900) { closeLabel(); } };
    $("again").onclick = function () { goTo({ kind: setting.kind, slug: setting.slug, seed: newSeed() }); };
    $("elsewhere").onclick = function (e) { if (CFG.play) { e.preventDefault(); goTo(randomChoice()); } };
    var keyOf = function (e) { return e.key.length === 1 ? e.key.toLowerCase() : e.key; };
    document.addEventListener("keydown", function (e) {
      if (!place) { return; }
      if (intro && performance.now() - intro.t0 > 600) { intro.t0 -= 9600; return; }
      var k = keyOf(e);
      if (["w", "a", "s", "d", " ", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].indexOf(k) >= 0) { input.keys[k] = true; e.preventDefault(); }
      if (k >= "1" && k <= "5") { slot = +k - 1; setMode("place"); }
      if (k === "e" || k === "q") { setMode(mode === "break" ? "place" : "break"); }
      if (k === "b") { buildRocket(false); }
      if (k === "n") { $("notes").hidden = !$("notes").hidden; }
      if (k === "f" && current) { lookBehind(); }
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
      voxTex = voxTexture(w.data, w.SX, w.SY, w.SZ, voxTex);
      var cands = (d.works || []).map(function (x) { x.f = Adv.facts(x.work, x.history); return x; });
      var hung = kind === "city" ? [] : Pl.hang(place, Pl.hangable(place, cands));
      adv = Adv.make(setting, sd, { works: hung.map(function (p) { return p.work; }), pool: !!(place.M && place.M.pool.length) });
      var hidden = Pl.hide(place, adv, hung, sd);
      paintings = hung; pieces = hidden.pieces; notes = hidden.notes;
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
      document.title = adv.title + " · Rocket";
      drawPieces(); drawHotbar(); setMode("break"); where();
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
    quality = window.matchMedia && window.matchMedia("(pointer: coarse)").matches ? 0.75 : 1;
    if (!gl) { $("status").textContent = $("veil").textContent = "This game needs WebGL 2, which this browser does not offer."; return; }
    prog = compile(VS, FS); skyProg = compile(SKY_VS, SKY_FS); artProg = compile(ART_VS, ART_FS); figProg = compile(FIG_VS, FIG_FS);
    ["uVP", "uOff", "uPal", "uEye", "uSun", "uT", "uSky", "uHaze", "uVox", "uOrg", "uDim", "uFloor", "uPx"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ["uInv", "uEye", "uSun", "uSky", "uHaze"].forEach(function (n) { SU[n] = gl.getUniformLocation(skyProg, n); });
    ["uVP", "uTex", "uEye", "uHaze", "uLit"].forEach(function (n) { AU[n] = gl.getUniformLocation(artProg, n); });
    ["uVP", "uEye", "uHaze"].forEach(function (n) { FU[n] = gl.getUniformLocation(figProg, n); });
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
                 Fm ? fetch("sections.json").then(function (r) { return r.json(); }).catch(function () { return null; }) : null]).then(function (res) {
      var d = res[0];
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
             hold: function (q) { held = true; quality = q; near = 1; resize(); },
             flush: function () { pump(1e9); }, figure: figure, fly: function (on) { flying = !!on; }, sky: function () { return skyFig; }, underTree: underTree,
             aim: function () { var h = eye ? cast(lookDir(P.yaw, P.pitch), LOOK) : null; return h ? (h.painting ? "work: " + h.painting.f.title : "block " + h.b + " at " + h.t.toFixed(2)) : "nothing"; } };
  } };
  init();
})();
