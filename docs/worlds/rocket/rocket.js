/* Rocket — escapes made from the Artist Website, in blocks.

   A simpler game in the way of Minecraft's phone app, about one mission:
   you come down hard, come to under a tree beside your capsule, and find
   the four pieces of your rocket, to build it at the wreck and launch.

   Every escape is made, by a seed, from what the site holds (adventure.js
   makes it, place.js builds it): one of its museums, its rooms carved from
   its plan and the saved works hung in them, the pieces behind four of the
   works and the clues to which ones left about the rooms as notes, as in
   Clue; one of the buildings it has modelled, two pieces behind works hung
   in it and two on its roof, in its garden or its pool; or one of its
   cities, the pieces on a roof, in a park, in the water and up a tree.

   Tap a work to read its label, and look behind it: a wrong look sets off
   an alarm, and at the third the guards put you out under your tree again.
   Tap a note to read it. Break and place blocks as you need to.

   The view is drawn in the site's pixel (two of the screen's to one), its
   light dithered; the works are their pictures from Artsy, framed, on the
   walls; its labels in the site's small capitals. */

(function () {
  "use strict";

  var BASE = "../../v2/", CDN = "https://d32dm0rphc51dk.cloudfront.net/";
  var CH = 16, REACH = 6, LOOK = 9, EYE = 1.62, PIX = 2, PPM = 32, SAVE = "rocket-save-v2";
  var Pl = window.RocketPlace, Adv = window.Adventures, B = Pl.B, PIECE_IDS = Pl.PIECE_IDS;
  var floor = Math.floor, round = Math.round, min = Math.min, max = Math.max, abs = Math.abs, hypot = Math.hypot;
  var HOTBAR = [B.BRICK, B.LOG, B.GLASS, B.DIRT, B.STONE];
  var BLOCKS = {};
  BLOCKS[B.BRICK] = "Brick"; BLOCKS[B.LOG] = "Wood"; BLOCKS[B.GLASS] = "Glass"; BLOCKS[B.DIRT] = "Earth"; BLOCKS[B.STONE] = "Stone";
  var ARROWS = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" }[c]; }); }
  function lower(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

  // What the game is: the place in blocks, the adventure, and where you have got to in it.
  var place = null, w = null, adv = null, setting = null, seed = 0;
  var paintings = [], byPlane = {}, pieces = [], notes = [];
  var found = [], known = {}, looked = {}, alarms = 0, built = false, launched = null, intro = null, vp = null, eye = null;

  /* ---- the mesh ------------------------------------------------------------- */

  var gl, prog, skyProg, artProg, U = {}, SU = {}, AU = {}, chunks = {}, queue = [], canvas, hud;
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
    var SX = w.SX, SZ = w.SZ, SY = w.SY, data = w.data, SOLID = w.SOLID, SEE = w.SEE, NOTE = B.NOTE, WATER = B.WATER;
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
              // A note is a sheet on the floor; water's top sits a little low.
              pos.push(x + cc[0], y + (b === NOTE ? cc[1] * 0.08 : cc[1] - (b === WATER && Fc.d[1] === 1 ? 0.12 : 0)), z + cc[2]);
              // The corner's shade: how many blocks crowd it (ambient occlusion).
              var ao = 0;
              if (b !== WATER && b !== NOTE) {
                var ax = cc[0] ? 1 : -1, ay = cc[1] ? 1 : -1, az = cc[2] ? 1 : -1;
                var px = x + Fc.d[0], py = y + Fc.d[1], pz = z + Fc.d[2], s1, s2, s3;
                if (Fc.d[0]) { s1 = SOLID[get(px, py + ay, pz)]; s2 = SOLID[get(px, py, pz + az)]; s3 = SOLID[get(px, py + ay, pz + az)]; }
                else if (Fc.d[1]) { s1 = SOLID[get(px + ax, py, pz)]; s2 = SOLID[get(px, py, pz + az)]; s3 = SOLID[get(px + ax, py, pz + az)]; }
                else { s1 = SOLID[get(px + ax, py, pz)]; s2 = SOLID[get(px, py + ay, pz)]; s3 = SOLID[get(px + ax, py + ay, pz)]; }
                ao = s1 && s2 ? 3 : s1 + s2 + s3;
              }
              inf.push(f, b, ao, 0);
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
  function remeshAt(x, z) {
    var cx = floor(x / CH), cz = floor(z / CH), nx = w.SX / CH, nz = w.SZ / CH;
    meshChunk(cx, cz);
    if (x % CH === 0 && cx > 0) { meshChunk(cx - 1, cz); }
    if (x % CH === CH - 1 && cx < nx - 1) { meshChunk(cx + 1, cz); }
    if (z % CH === 0 && cz > 0) { meshChunk(cx, cz - 1); }
    if (z % CH === CH - 1 && cz < nz - 1) { meshChunk(cx, cz + 1); }
  }

  var BAYER = [
    "float bayer(vec2 p) { ivec2 q = ivec2(mod(p, 4.0)); int i = q.x + q.y * 4;",
    "  int b[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5); return (float(b[i]) + 0.5) / 16.0; }"
  ].join("\n");
  var VS = [
    "#version 300 es",
    "layout(location=0) in vec3 aP; layout(location=1) in vec4 aI;",
    "uniform mat4 uVP; uniform vec3 uOff;",
    "out vec3 vP; flat out int vF; flat out int vB; out float vAO;",
    "void main() { vP = aP + uOff; vF = int(aI.x); vB = int(aI.y); vAO = aI.z; gl_Position = uVP * vec4(vP, 1.0); }"
  ].join("\n");
  var FS = [
    "#version 300 es",
    "precision highp float;",
    "in vec3 vP; flat in int vF; flat in int vB; in float vAO; out vec4 o;",
    "uniform vec4 uPal[64]; uniform vec3 uEye; uniform vec3 uSun; uniform float uT; uniform vec3 uSky; uniform vec3 uHaze;",
    "float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }",
    BAYER,
    "const vec3 N[6] = vec3[6](vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0), vec3(0,0,1), vec3(0,0,-1));",
    "void main() {",
    "  vec3 n = N[vF];",
    "  vec3 cell = floor(vP - n * 0.5);",
    "  vec2 uv = vF < 2 ? vec2(vP.z, vP.y) : vF < 4 ? vec2(vP.x, vP.z) : vec2(vP.x, vP.y);",
    "  vec2 f = fract(uv); vec2 tx = floor(f * 8.0);",
    "  float r = h(cell * 1.7 + vec3(tx, float(vF)));",
    "  vec4 pe = uPal[vB]; vec3 c = pe.rgb; int st = int(pe.a + 0.5);",
    "  float k = 0.9 + 0.18 * r;",
    "  if (st == 1) { if (vF != 2) { if (f.y < 0.78 - 0.1 * h(cell + vec3(tx.x))) { c = uPal[2].rgb; } } }",
    "  if (st == 2) { if (vF == 2 || vF == 3) { float d = length(f - 0.5); c *= 0.85 + 0.25 * step(0.5, fract(d * 4.0)); } else { k = 0.8 + 0.3 * step(0.4, h(cell + vec3(tx.x, 0.0, 0.0))); } }",
    "  if (st == 3) { if (r < 0.22) { c *= 0.55; } }",
    "  if (st == 4) { bool edge = f.x < 0.12 || f.x > 0.88 || f.y < 0.12 || f.y > 0.88; c = edge ? vec3(0.32, 0.3, 0.3) * 255.0 : mix(uSky * 255.0, c, 0.55); k = 1.0; }",
    "  if (st == 5) { float row = floor(f.y * 4.0); float mx = fract(f.x * 2.0 + row * 0.5); if (fract(f.y * 4.0) < 0.18 || mx < 0.09) { c = vec3(196.0, 188.0, 176.0); } }",
    "  if (st == 6) { k = 0.85 + 0.3 * (0.5 + 0.5 * sin(vP.x * 1.3 + vP.z * 0.9 + uT * 1.6)); }",
    "  if (st == 8) { k = 0.88 + 0.2 * r; }",
    // Boards: four to a block, their ends staggered.
    "  if (st == 9) { vec2 q = vF < 2 ? vec2(vP.z, vP.y) : vF < 4 ? vec2(vP.x, vP.z) : vec2(vP.x, vP.y);",
    "    float row = floor(q.y * 4.0), sh = h(vec3(row, cell.y, 3.0)), run = floor(q.x * 0.5 + sh);",
    "    float seam = max(step(0.88, fract(q.y * 4.0)), step(0.96, fract(q.x * 0.5 + sh)));",
    "    k = (0.86 + 0.2 * h(vec3(row, run, cell.y))) * (1.0 - 0.3 * seam); }",
    // A note: paper, ruled.
    "  if (st == 10) { k = 1.0; if (vF == 2 && fract(f.y * 7.0) < 0.16 && f.x > 0.18 && f.x < 0.82 && f.y > 0.2 && f.y < 0.86) { c *= 0.74; } }",
    "  c = c / 255.0 * k;",
    "  float sun = max(dot(n, uSun), 0.0);",
    "  float amb = 0.55 + 0.15 * n.y;",
    "  vec3 col = c * (amb + 0.6 * sun) * (1.0 - vAO * 0.16);",
    // The pieces glow and breathe, to be seen from far off; the notes catch the eye.
    "  if (st == 7) { float pulse = 0.65 + 0.35 * sin(uT * 3.0); bool rim = f.x < 0.14 || f.x > 0.86 || f.y < 0.14 || f.y > 0.86; col = rim ? c * 0.35 : c * (0.8 + 0.6 * pulse); }",
    "  if (st == 10) { col = c * (0.95 + 0.25 * (0.5 + 0.5 * sin(uT * 2.6))); }",
    "  float dist = length(uEye - vP);",
    "  col = mix(col, uHaze, clamp(1.0 - exp(-dist * 0.006), 0.0, 1.0));",
    "  float t = bayer(gl_FragCoord.xy) - 0.5;",
    "  col = floor(col * 36.0 + t + 0.5) / 36.0;",
    "  o = vec4(col, 1.0);",
    "}"
  ].join("\n");
  var SKY_VS = "#version 300 es\nlayout(location=0) in vec2 a; out vec2 vA; void main(){ vA = a; gl_Position = vec4(a, 0.9999, 1.0); }";
  var SKY_FS = [
    "#version 300 es", "precision highp float;", "in vec2 vA; out vec4 o;",
    "uniform mat4 uInv; uniform vec3 uEye; uniform vec3 uSun; uniform vec3 uSky; uniform vec3 uHaze;",
    "void main() { vec4 p = uInv * vec4(vA, 1.0, 1.0); vec3 r = normalize(p.xyz / p.w - uEye);",
    "  vec3 c = mix(uHaze, uSky, pow(clamp(r.y, 0.0, 1.0), 0.5));",
    "  float s = dot(r, uSun); c += vec3(1.0, 0.95, 0.85) * (step(0.9985, s) * 0.9 + pow(max(s, 0.0), 30.0) * 0.12);",
    "  o = vec4(c, 1.0); }"
  ].join("\n");
  // The works: each its picture on a quad a hair off its wall, in the same haze and grain.
  var ART_VS = [
    "#version 300 es",
    "layout(location=0) in vec3 aP; layout(location=1) in vec2 aT;",
    "uniform mat4 uVP; out vec3 vP; out vec2 vT;",
    "void main() { vP = aP; vT = aT; gl_Position = uVP * vec4(aP, 1.0); }"
  ].join("\n");
  var ART_FS = [
    "#version 300 es", "precision highp float;", "in vec3 vP; in vec2 vT; out vec4 o;",
    "uniform sampler2D uTex; uniform vec3 uEye; uniform vec3 uHaze; uniform float uLit;",
    BAYER,
    "void main() { vec3 c = texture(uTex, vT).rgb * uLit; float d = length(uEye - vP);",
    "  c = mix(c, uHaze, clamp(1.0 - exp(-d * 0.006), 0.0, 1.0));",
    "  float t = bayer(gl_FragCoord.xy) - 0.5; c = floor(c * 36.0 + t + 0.5) / 36.0; o = vec4(c, 1.0); }"
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
  // A work's face: its picture in a frame (gilt for the old ones), or its colours while it comes.
  function paintTexture(p, img) {
    var W = max(8, round((p.u1 - p.u0) * PPM)), H = max(8, round((p.y1 - p.y0) * PPM));
    var cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var c = cv.getContext("2d"), fr = max(1, round(PPM * 0.07)), old = p.f.year && p.f.year < 1900;
    c.fillStyle = old ? "#9c7636" : "#2b221c";
    c.fillRect(0, 0, W, H);
    if (old) { c.fillStyle = "#d8b060"; c.fillRect(0, 0, W, 1); c.fillRect(0, 0, 1, H); }
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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
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
    img.src = CDN + p.f.image + "/small.jpg";
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
    el.querySelector(".l-room").textContent = [p.room.name, p.work.floorShown].filter(Boolean).join(" · ") || (place.kind === "museum" ? "" : setting.name);
    var pic = $("l-pic");
    pic.alt = f.title || "";
    pic.src = f.image ? CDN + f.image + "/medium.jpg" : "";
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
  var skyVao = null, curPix = PIX, rocketCh = null, rocketLift = 0, ended = false, tick = 0, slowAt = 0;
  function norm(v) { var n = hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; }

  function frame(now) {
    var dt = min(0.05, (now - (last || now)) / 1000);
    last = now;
    tick += 1;
    var eyeH = EYE, open = 1;
    if (intro) {
      var u = (now - intro.t0) / 1000, sm = function (a, b) { var t = max(0, min(1, (u - a) / (b - a))); return t * t * (3 - 2 * t); };
      open = lids(u);
      var pix = round(8 - 6 * sm(1, 5.5));
      if (pix !== curPix) { curPix = pix; resize(); }
      eyeH = 0.35 + (EYE - 0.35) * sm(4.5, 7.2);
      P.pitch = 1.2 + (0 - 1.2) * sm(3.8, 7.2);
      P.yaw = intro.yaw0 + intro.turn * sm(5.5, 8.6);
      if (u > 9.6) { awake(); }
    } else if (!launched) {
      physics(dt);
    }
    pump(intro ? 14 : 6);
    eye = [P.x, P.y + eyeH, P.z];
    var cw = canvas.width, chh = canvas.height;
    var proj = perspective(70 * Math.PI / 180, cw / chh, 0.08, 420);
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
    gl.uniform3f(U.uOff, 0, 0, 0);
    var pcx = floor(P.x / CH), pcz = floor(P.z / CH);
    Object.keys(chunks).forEach(function (k) {
      var ch = chunks[k];
      if (!ch.count || abs(ch.cx - pcx) > 14 || abs(ch.cz - pcz) > 14) { return; }
      gl.bindVertexArray(ch.vao);
      gl.drawElements(gl.TRIANGLES, ch.count, gl.UNSIGNED_INT, 0);
    });
    if (rocketCh) {
      var lift = launched ? Math.pow(max(0, (now - launched) / 1000 - 1), 2) * 2.4 : 0;
      gl.uniform3f(U.uOff, 0, lift, 0);
      gl.bindVertexArray(rocketCh.vao);
      gl.drawElements(gl.TRIANGLES, rocketCh.count, gl.UNSIGNED_INT, 0);
      if (launched && lift > 300 && !ended) { ended = true; finish(); }
      rocketLift = lift;
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
    if (now - slowAt > 250) { slowAt = now; fetchNear(); where(); }
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
  // You, lying beside the trunk of your tree, the wreck to one side.
  function lieDown(lines) {
    var c = place.crash, wr = place.wreck;
    P.x = c.x + 1.2; P.z = c.z + 0.6; P.y = c.y; P.vx = P.vy = P.vz = 0;
    var toWreck = Math.atan2(wr.x - P.x, -(wr.z - P.z));
    intro = { t0: performance.now(), yaw0: toWreck - 1.5, turn: 1.5, lines: lines };
    document.body.dataset.film = "true";
  }
  function awake() {
    var again = intro.lines[0] === "The guards walk you out.";
    intro = null;
    curPix = PIX;
    resize();
    delete document.body.dataset.film;
    if (again) { say("The alarms are quiet again. What you have found, you keep."); return; }
    var behind = adv.pieces.filter(function (p) { return p.hide.type === "work"; }).length;
    if (behind === 4) { say("The four pieces are behind four of the works inside. Your notes say which; there are more notes in the rooms."); }
    else if (behind) { say(behind === 1 ? "One piece is behind a work inside. The wreck's log says where the others fell." : behind + " pieces are behind works inside. The wreck's log says where the others fell."); }
    else { say("Four pieces of your rocket are somewhere in " + setting.name + ". The notes show where they fell."); }
    $("notes").hidden = false;
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
      var x = (q[0] / q[3] * 0.5 + 0.5) * W, y = (1 - (q[1] / q[3] * 0.5 + 0.5)) * H, s = max(2, min(launched ? 30 : 14, (0.4 + life * 2) * H / q[3] * 0.4));
      s = round(s / 2) * 2;
      c.fillStyle = launched && life < 0.15 ? "rgba(255,190,110," + (0.8 * (1 - life / 0.15)) + ")" : "rgba(70,66,64," + (0.45 * (1 - life)).toFixed(3) + ")";
      c.fillRect(round(x - s / 2), round(y - s / 2), s, s);
    }
    if (!intro && !launched && !touchy) {
      c.fillStyle = "rgba(255,255,255,0.8)";
      c.fillRect(W / 2 - 7, H / 2 - 1, 14, 2); c.fillRect(W / 2 - 1, H / 2 - 7, 2, 14);
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
      tag.hidden = !tt;
      if (tt && tag.textContent !== tt) { tag.textContent = tt; }
    }
    if (current && hypot(current.cx - P.x, current.cz - P.z) > 11) { closeLabel(); }
  }
  // Where you are: the room and its floor, or the place.
  function where() {
    var rm = place.kind !== "city" ? Pl.roomAt(place, P.x, P.y, P.z) : null, t = setting.name;
    if (rm && rm.name) { var FL = place.floors[rm.floor]; t = rm.name + (place.kind === "museum" ? " · " + (FL.name || FL.label) : ""); }
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
    remeshAt(rx, rz); remeshAt(rx - 2, rz - 2); remeshAt(rx + 2, rz + 2);
    for (y = ry; y < ry + 12; y += 1) {
      var r = y > ry + 9 ? 0 : 1;
      for (z = rz - r; z <= rz + r; z += 1) { for (x = rx - r; x <= rx + r; x += 1) { list.push([x, y, z, y > ry + 9 ? B.RED : (y - ry) % 4 === 2 && x === rx && z === rz - 1 ? B.GLASS : B.WHITE]); } }
    }
    list.push([rx, ry + 12, rz, B.RED]);
    [[-2, 0], [2, 0], [0, -2], [0, 2]].forEach(function (d) { list.push([rx + d[0], ry, rz + d[1], B.RED], [rx + d[0], ry + 1, rz + d[1], B.RED]); });
    rocketCh = meshBlocks(list);
    if (!quiet) { say("The rocket stands on the wreck's ground. Launch when you are clear.", true); }
  }
  function launch() {
    if (!built || launched) { return; }
    launched = performance.now();
    closeLabel();
    $("notes").hidden = true;
    // Stand back by your tree, on the wreck's side of it, and watch it go.
    var c = place.crash, wr = place.wreck, ax = (wr.x + 0.5) - c.x, az = (wr.z + 0.5) - c.z, L = hypot(ax, az) || 1;
    P.x = c.x + ax / L * 2.6; P.z = c.z + az / L * 2.6;
    for (var y = w.SY - 2; y > 0; y -= 1) { if (w.SOLID[w.get(floor(P.x), y, floor(P.z))]) { P.y = y + 1; break; } }
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
        " is climbing out of the air over " + (setting.city || setting.where) + ". There are more escapes in the site: another museum, another building, the same place by another seed.";
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
      return '<li data-got="' + got + '"><i style="background:rgb(' + c.join(",") + ')"></i><span>' + esc(p.name.replace(/^The /, "")) + '</span></li>';
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
    $("notes-list").innerHTML = '<ol>' + html + '</ol>' + (total ? '<p class="count">Notes read: ' + read + ' of ' + total + '</p>' : '');
  }
  function drawHotbar() {
    $("hotbar").innerHTML = HOTBAR.map(function (b, i) {
      return '<button class="slot" data-slot="' + i + '" aria-pressed="' + (mode === "place" && slot === i) + '" aria-label="' + BLOCKS[b] + '"><i style="background:rgb(' + w.pal[b].join(",") + ')"></i></button>';
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
    try { localStorage.setItem(SAVE, JSON.stringify({ key: advKey(), found: found, known: known, looked: looked, alarms: alarms, built: built })); }
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
    $("again").onclick = function () { location.hash = setting.kind + "/" + setting.slug + "/" + newSeed(); location.reload(); };
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
  function resize() {
    var cw = window.innerWidth, chh = window.innerHeight, dpr = min(2, window.devicePixelRatio || 1);
    canvas.width = max(1, round(cw / curPix)); canvas.height = max(1, round(chh / curPix));
    hud.width = round(cw * dpr); hud.height = round(chh * dpr);
  }

  /* ---- an adventure, from what the site holds ------------------------------------------------ */

  var cat = null, choice = { kind: "museum", slug: "", seed: 0 };
  function newSeed() { return 1 + floor(Math.random() * 9998); }
  function listOf(kind) { return kind === "museum" ? cat.museums : kind === "building" ? cat.buildings : cat.cities; }
  function keyOfEntry(kind, e) { return kind === "city" ? e.key : e.slug; }
  function chosen() {
    var list = listOf(choice.kind);
    return list.filter(function (e) { return keyOfEntry(choice.kind, e) === choice.slug; })[0] || list[0];
  }
  function fetchJSON(path) { return fetch(BASE + path).then(function (r) { if (!r.ok) { throw new Error("no " + path); } return r.json(); }); }

  /* What an adventure is made from: a city's ground; a museum's model, ground and plan, and the saved
     works hung in it (sixty at most, by the seed); a building's model and ground, and a dozen of
     the saved works, by the seed, with their histories. */
  function gather(kind, e, sd) {
    if (kind === "city") { return fetchJSON("grounds/" + e.slug + ".json").then(function (g) { return { kind: kind, ground: g }; }); }
    return Promise.all([fetchJSON("models/" + e.slug + ".json"), fetchJSON("grounds/" + e.slug + ".json"),
                        kind === "museum" ? fetchJSON("interiors/" + e.slug + ".json") : null]).then(function (res) {
      var d = { kind: kind, name: e.name, model: res[0], ground: res[1], interior: res[2] }, r = Pl.rng(sd * 13 + 5);
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
      var pool = cat.pool.slice(), pick = [];
      while (pick.length < 15 && pool.length) { pick.push(pool.splice(floor(r() * pool.length), 1)[0]); }
      return Promise.all(pick.map(function (wk) { return fetchJSON("histories/" + wk.id + ".json").catch(function () { return null; }); })).then(function (hs) {
        d.works = pick.map(function (wk, i) { return { work: wk, history: hs[i] }; }).filter(function (x) { return x.history; }).slice(0, 12);
        return d;
      });
    });
  }
  function wait(v) { return new Promise(function (done) { setTimeout(function () { done(v); }, 30); }); }

  function start(kind, e, sd) {
    var status = $("status");
    setting = { kind: kind, slug: keyOfEntry(kind, e), name: e.name, where: e.where || e.name,
                city: kind === "city" ? e.name : String(e.where || "").split(",")[0] };
    seed = sd;
    status.textContent = "Fetching " + (kind === "museum" ? Adv.theName(e.name) : e.name);
    return gather(kind, e, sd).then(function (d) {
      status.textContent = "Building " + (kind === "museum" ? Adv.theName(e.name) : e.name) + " in blocks";
      return wait(d);
    }).then(function (d) {
      place = kind === "city" ? Pl.city(d.ground) : Pl.place(d);
      w = place.w;
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
      return '<option value="' + esc(k) + '"' + (k === choice.slug ? " selected" : "") + '>' + esc(x.name) + '</option>';
    }).join("");
    var no = " Adventure no. " + choice.seed + ".";
    $("preview").textContent = choice.kind === "museum" ?
      "Escape from " + Adv.theName(e.name) + ", " + String(e.where).split(",")[0] + ": " + e.works + " saved works on " + (e.floors === 1 ? "its one floor" : "its " + e.floors + " floors") + ", and four of them hiding the pieces." + no :
      choice.kind === "building" ? "Escape from " + e.name.replace(/^The /, "the ") + ", " + e.where + ": a dozen saved works hung in a building the site has modelled, its roof and its garden." + no :
      "Escape from " + e.name + ": the pieces on a roof, in a park, in the water and up a tree." + no;
    try { history.replaceState(null, "", "#" + choice.kind + "/" + choice.slug + "/" + choice.seed); } catch (err) { /* the address stays */ }
  }

  function init() {
    canvas = $("view");
    hud = $("hud");
    gl = canvas.getContext("webgl2", { antialias: false });
    if (!gl) { $("status").textContent = "This game needs WebGL 2, which this browser does not offer."; return; }
    prog = compile(VS, FS); skyProg = compile(SKY_VS, SKY_FS); artProg = compile(ART_VS, ART_FS);
    ["uVP", "uOff", "uPal", "uEye", "uSun", "uT", "uSky", "uHaze"].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    ["uInv", "uEye", "uSun", "uSky", "uHaze"].forEach(function (n) { SU[n] = gl.getUniformLocation(skyProg, n); });
    ["uVP", "uTex", "uEye", "uHaze", "uLit"].forEach(function (n) { AU[n] = gl.getUniformLocation(artProg, n); });
    gl.enable(gl.DEPTH_TEST);
    skyVao = gl.createVertexArray(); gl.bindVertexArray(skyVao);
    var sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    resize(); wire();
    fetch("catalogue.json").then(function (r) { return r.json(); }).then(function (d) {
      cat = d;
      // The address names an adventure (#museum/<slug>/<seed>); else the one you were in; else the Musée d'Orsay.
      var h = decodeURIComponent((location.hash || "").slice(1)).split("/"), s = saved(), k = s && s.key ? s.key.split(":") : null;
      if (h[0] === "museum" || h[0] === "building" || h[0] === "city") { choice = { kind: h[0], slug: h[1] || "", seed: +h[2] || newSeed() }; }
      else if (h[0] && cat.cities.some(function (c) { return c.key === h[0]; })) { choice = { kind: "city", slug: h[0], seed: newSeed() }; }
      else if (k) { choice = { kind: k[0], slug: k[1], seed: +k[2] || newSeed() }; }
      else { choice = { kind: "museum", slug: "museum-musee-dorsay", seed: newSeed() }; }
      drawChoice();
      document.querySelectorAll("[data-kind]").forEach(function (b) {
        b.onclick = function () { if (choice.kind !== b.dataset.kind) { choice = { kind: b.dataset.kind, slug: "", seed: newSeed() }; drawChoice(); } };
      });
      $("place").onchange = function () { choice.slug = $("place").value; choice.seed = newSeed(); drawChoice(); };
      $("surprise").onclick = function () {
        var kinds = ["museum", "museum", "museum", "building", "building", "city"], kind = kinds[floor(Math.random() * kinds.length)], list = listOf(kind);
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
    }).catch(function () { $("status").textContent = "The places could not be loaded."; });
  }

  // debug() hands the game's state to a test (it changes nothing by itself).
  window.Rocket = { debug: function () {
    return { P: P, place: place, w: w, adv: adv, paintings: paintings, pieces: pieces, notes: notes, found: found, known: known, looked: looked,
             alarms: function () { return alarms; }, act: act, remeshAt: remeshAt, buildRocket: buildRocket, launch: launch, showLabel: showLabel,
             lookBehind: lookBehind, readNote: readNote, queue: function () { return queue.length; }, intro: function () { return intro; },
             skip: function () { if (intro) { intro.t0 -= 9600; } } };
  } };
  init();
})();
