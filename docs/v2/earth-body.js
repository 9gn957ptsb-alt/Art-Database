/* The body of the globe: what every place is made of, painted smoothly and lit.

   The artist, 1 Oct 2026: "the colors overall in the entire globe need to be
   less pixelated and more reflective of the materials the represent", and of
   the journey from one city to another: "a bit more clarity, a bit more
   depth in space".

   Under DIRT's dots the globe used to be a dark gradient. Now it is the
   Earth's materials (earth-material.webp, written by
   scripts/build_material.py: every colour in it one of the saved paintings'
   colours, the nearest each material's real colour), drawn on the graphics
   card at every pixel the screen has, so it is smooth at any height:

   - the sea by its depth, the shelf paler than the abyss, with the sun's
     glint on it and the sky in it toward the limb;
   - the land by its relief, lit by the real sun; forest dark in clumps,
     sand smooth, rock rough, at a grain that stays the same size on the
     screen however near you come;
   - snow and sea ice laid on by the month, from DIRT Earth's snow layer;
   - the air: haze thickening toward the limb, a thin glow round the rim.

   On a journey it also gives depth (see land.js, "the journey"): the land is
   soft where you are not looking and sharp where you are headed, a layer of
   the month's cloud lies above the ground and swells past you as you come
   down, the land sharpens as you descend, and a few stars stand far behind.

   The light, the haze, the glint and the clouds are colours of the
   collection too (the nearest it has to each): SNOW #f5f5f5, SEA_ICE
   #d9e0e5, HAZE #a5b9d1, HAZE_DEEP #4d668e, GLINT #f0e5d8, CLOUD #f6f4ef,
   CLOUD_SHADE #a2a7af, STAR #f7ece4. What changes them is light: how much of
   it falls on a place, and how much air it is seen through.

   window.EarthBody.start(month) loads it; EarthBody.draw(o) renders a frame
   and hands back its canvas, or null until it is ready or where WebGL 2 is
   not to be had (the globe is then as it was). */
(function () {
  "use strict";

  var VERT = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";

  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "out vec4 outC;",
    "uniform vec3 uView;",      // W, H (css px), device height
    "uniform float uDpr;",
    "uniform vec3 uC;",         // cx, cy, R
    "uniform vec4 uRot;",       // sin spin, cos spin, sin tilt, cos tilt
    "uniform vec3 uSun;",       // the sun, in world space
    "uniform vec4 uK;",         // near, high, journey, time
    "uniform vec4 uDof;",       // focus x, y, amount, radius
    "uniform vec4 uSky;",       // cloud amount, cloud shell (Rs / R), stars, light
    "uniform vec2 uStar;",      // the stars' drift
    "uniform vec3 uMonth;",     // which channel of the season's picture is this month
    "uniform sampler2D uMat, uProps, uSnow, uCloud;",
    "const float PI = 3.14159265, TAU = 6.2831853;",
    "const vec3 SNOW = vec3(245., 245., 245.) / 255.;",
    "const vec3 SEA_ICE = vec3(217., 224., 229.) / 255.;",
    "const vec3 HAZE = vec3(165., 185., 209.) / 255.;",
    "const vec3 HAZE_DEEP = vec3(77., 102., 142.) / 255.;",
    "const vec3 GLINT = vec3(240., 229., 216.) / 255.;",
    "const vec3 CLOUD = vec3(246., 244., 239.) / 255.;",
    "const vec3 CLOUD_SHADE = vec3(162., 167., 175.) / 255.;",
    "const vec3 STAR = vec3(247., 236., 228.) / 255.;",

    "float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }",
    "float hash2(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }",
    "float vnoise(vec3 x) {",
    "  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);",
    "  return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),",
    "             mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);",
    "}",
    // Two octaves of grain at a size fixed on the screen, crossfaded between
    // powers of two as you come nearer, so it neither swims nor pops.
    "float grain(vec3 w, float R, float px) {",
    "  float l = log2(max(1.0, R / px)); float o = floor(l), t = l - o;",
    "  float s0 = exp2(o), s1 = exp2(o + 1.0);",
    "  float a = vnoise(w * s0) * 0.62 + vnoise(w * s0 * 2.03 + 7.1) * 0.38;",
    "  float b = vnoise(w * s1) * 0.62 + vnoise(w * s1 * 2.03 + 7.1) * 0.38;",
    "  return mix(a, b, t);",
    "}",
    // view (x right, y up, z out) to the world, and the latitude and longitude there
    "vec3 toWorld(vec3 n) {",
    "  float wy = n.y * uRot.w + n.z * uRot.z, wz = -n.y * uRot.z + n.z * uRot.w;",
    "  return vec3(n.x * uRot.y + wz * uRot.x, wy, wz * uRot.y - n.x * uRot.x);",
    "}",
    "vec2 uvOf(vec3 w) {",
    "  float lat = asin(clamp(w.y, -1.0, 1.0)), lon = atan(w.x, w.z);",
    "  return vec2(fract(lon / TAU + 0.5), clamp(0.5 - lat / PI, 0.0, 1.0));",
    "}",

    "void main() {",
    "  vec2 p = vec2(gl_FragCoord.x, uView.z - gl_FragCoord.y) / uDpr;",
    "  float R = uC.z;",
    "  vec2 q = vec2(p.x - uC.x, -(p.y - uC.y)) / R;",
    "  float d2 = dot(q, q);",
    "  float journey = uK.z, high = uK.y, near = uK.x;",
    "  float focusD = length(p - uDof.xy) / max(1.0, uDof.w);",
    "  float blur = uDof.z * smoothstep(0.35, 1.25, focusD);",
    "  vec4 col = vec4(0.0);",
    "  if (d2 >= 1.0) {",
    // the rim of the air, and the stars far behind
    "    float r = sqrt(d2);",
    "    float th = clamp(0.03 * R, 3.0, 46.0) / R;",
    "    float rim = exp(-(r - 1.0) / th * 2.6);",
    "    vec2 qn = q / r;",
    "    float a = rim * (0.34 + 0.3 * high);",
    "    vec3 c = mix(HAZE, HAZE_DEEP, 0.4) * a;",
    "    if (uSky.z > 0.002) {",
    "      vec2 s = p + uStar; vec2 cell = floor(s / 9.0); float h = hash2(cell);",
    "      if (h > 0.972) {",
    "        vec2 at = (cell + 0.2 + 0.6 * vec2(hash2(cell + 3.7), hash2(cell + 9.1))) * 9.0;",
    "        float k = smoothstep(0.95, 0.15, length(s - at)) * (0.35 + 0.65 * fract(h * 37.0));",
    "        float sa = k * uSky.z * (1.0 - rim);",
    "        c += STAR * sa; a += sa * (1.0 - a);",
    "      }",
    "    }",
    "    outC = vec4(c, clamp(a, 0.0, 1.0));",
    "    return;",
    "  }",
    "  float nz = sqrt(1.0 - d2);",
    "  vec3 nv = vec3(q, nz);",
    "  vec3 w = toWorld(nv);",
    "  vec2 uv = uvOf(w);",
    // the level of the picture to read: as fine as this pixel, softer out of focus and when high
    "  float texPx = (2048.0 / TAU) / (R * max(nz, 0.08));",
    "  float lod = log2(max(texPx, 1e-6)) + blur * 4.5 + journey * high * 1.2;",
    "  vec3 m = textureLod(uMat, uv, max(lod, 0.0)).rgb;",
    "  vec3 pr = textureLod(uProps, uv, max(lod, 0.0)).rgb;",
    "  float wet = smoothstep(0.25, 0.75, pr.r);",
    "  float canopy = pr.g * (1.0 - wet);",
    "  float depth = pr.g * pr.g * wet;",
    // relief: the slope of the land, from its height either side
    "  float lod0 = max(lod, 0.0);",
    "  float dx = 1.0 / 2048.0, dy = 1.0 / 1024.0;",
    "  float he = textureLod(uProps, uv + vec2(dx, 0.0), lod0).b, hw = textureLod(uProps, uv - vec2(dx, 0.0), lod0).b;",
    "  float hn = textureLod(uProps, uv - vec2(0.0, dy), lod0).b, hs = textureLod(uProps, uv + vec2(0.0, dy), lod0).b;",
    "  float cl = max(0.05, sqrt(1.0 - w.y * w.y));",
    "  float gx = (he * he - hw * hw) * 8800.0 / (2.0 * 19550.0 * cl), gy = (hn * hn - hs * hs) * 8800.0 / (2.0 * 19550.0);",
    "  float lon = atan(w.x, w.z);",
    "  vec3 east = vec3(cos(lon), 0.0, -sin(lon));",
    "  vec3 north = vec3(-w.y * sin(lon), cl, -w.y * cos(lon));",
    "  float ex = 26.0 * (1.0 - wet);",
    // the grain of the material, the same size on the screen at every height
    "  float g = grain(w, R, 9.0) - 0.5;",
    "  float g2 = grain(w * 1.7 + 3.1, R, 3.5) - 0.5;",
    "  float sharp = 1.0 - blur;",
    "  vec3 nw = normalize(w - ex * (gx * east + gy * north) + (east * g2 + north * g) * (0.10 + 0.5 * pr.b) * (1.0 - wet) * sharp);",
    // the water's surface: small waves, so its glint is broken
    "  vec3 nwater = normalize(w + (east * g2 + north * g) * 0.06 * sharp);",
    "  nw = normalize(mix(nw, nwater, wet));",
    // what lies on it: forest in clumps, rock rough, sand smooth, the sea's depth
    "  float tex = g * (0.10 + 0.55 * canopy + 0.25 * pr.b) * (1.0 - wet) + g2 * 0.05 * (1.0 - wet);",
    "  vec3 c = m * (1.0 + tex * sharp);",
    "  c *= mix(1.0, 0.86 - 0.1 * smoothstep(0.1, 0.6, depth), wet);",
    // snow and sea ice, by the month, ragged at the edge
    "  float sn = dot(texture(uSnow, uv).rgb, uMonth);",
    "  float edge = (g * 0.5 + g2 * 0.25) * sharp;",
    "  float snowLand = smoothstep(0.2, 0.6, sn + edge * 0.5 + pr.b * 0.25) * (1.0 - 0.45 * canopy) * (1.0 - wet);",
    "  float ice = smoothstep(0.25, 0.7, sn + edge * 0.4) * wet;",
    "  c = mix(c, SNOW * (0.94 + 0.12 * g2), snowLand);",
    "  c = mix(c, SEA_ICE * (0.92 + 0.1 * g), ice);",
    "  float bright = max(snowLand, ice);",
    // the light: the real sun, softened toward the ground of a city so it reads at any hour
    "  float day0 = dot(w, uSun);",
    "  float day = smoothstep(-0.14, 0.32, day0);",
    "  float lam = max(dot(nw, uSun), 0.0);",
    "  float relief = clamp(dot(nw, uSun) - day0, -0.6, 0.6);",
    "  float shade = mix(0.36, 0.72 + 0.4 * lam, day) + relief * (0.9 - 0.5 * wet);",
    "  shade = mix(shade, 0.98 + relief * 1.6, near);",
    "  shade = mix(1.0, shade, uSky.w);",
    "  c *= shade;",
    // the glint: the sun mirrored in open water
    "  vec3 V = toWorld(vec3(0.0, 0.0, 1.0));",
    "  vec3 Hh = normalize(uSun + V);",
    "  float spec = pow(max(dot(nwater, Hh), 0.0), mix(90.0, 30.0, near)) * day * wet * (1.0 - ice) * uSky.w;",
    "  c += GLINT * spec * 0.55;",
    // the air: thicker toward the limb, and over everything when high
    "  float limb = pow(1.0 - nz, 2.2);",
    "  float air = limb * (0.62 - 0.4 * near) + journey * high * 0.16;",
    "  vec3 hz = mix(HAZE_DEEP, HAZE, 0.35 + 0.45 * day);",
    "  c = mix(c, hz * mix(0.55, 1.0, day), clamp(air, 0.0, 0.85));",
    "  c += hz * limb * wet * 0.12 * day;",
    // the month's cloud, a layer above the ground, swelling past you as you come down
    "  if (uSky.x > 0.002) {",
    "    float Rs = R * uSky.y;",
    "    vec2 qs = vec2(p.x - uC.x, -(p.y - uC.y)) / Rs;",
    "    float ds = dot(qs, qs);",
    "    if (ds < 1.0) {",
    "      vec3 ws = toWorld(vec3(qs, sqrt(1.0 - ds)));",
    "      float amt = dot(texture(uCloud, uvOf(ws)).rgb, uMonth);",
    "      float f = grain(ws + vec3(uK.w * 0.0006, 0.0, 0.0), Rs, 70.0) * 0.7 + grain(ws * 2.3, Rs, 24.0) * 0.3;",
    "      float cov = smoothstep(1.02 - amt * 0.85, 1.22 - amt * 0.85, f + 0.25);",
    "      float lit = mix(0.55, 1.0, day);",
    "      vec3 cc = mix(CLOUD_SHADE, CLOUD, smoothstep(0.35, 0.8, f)) * lit;",
    "      c = mix(c, cc, cov * uSky.x * (1.0 - 0.6 * blur));",
    "    }",
    "  }",
    "  outC = vec4(c, 1.0);",
    "}"
  ].join("\n");

  var gl = null, canvas = null, prog = null, loc = {}, tex = {}, ready = false, failed = false;
  var month = 1;
  var last = "";

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      window.console.warn("earth body:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  function setup() {
    canvas = document.createElement("canvas");
    try {
      gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false,
                                         preserveDrawingBuffer: true, depth: false, stencil: false });
    } catch (e) { gl = null; }
    if (!gl) { return false; }
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { return false; }
    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { return false; }
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var a = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(a);
    gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    ["uView", "uDpr", "uC", "uRot", "uSun", "uK", "uDof", "uSky", "uStar", "uMonth",
     "uMat", "uProps", "uSnow", "uCloud"].forEach(function (n) { loc[n] = gl.getUniformLocation(prog, n); });
    return true;
  }

  function image(url) {
    return new Promise(function (done, fail) {
      var img = new Image();
      img.onload = function () { done(img); };
      img.onerror = function () { fail(new Error(url)); };
      img.src = url;
    });
  }

  function upload(unit, img, mips) {
    var t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    return t;
  }

  function start(m) {
    month = m;
    if (failed || ready) { return Promise.resolve(ready); }
    if (!setup()) { failed = true; return Promise.resolve(false); }
    var season = Math.floor((m - 1) / 3);
    return Promise.all([image("earth-material.webp"), image("earth-props.webp"),
                        image("dirt/earth/snow-" + season + ".webp"), image("dirt/earth/cloud-" + season + ".webp")])
      .then(function (imgs) {
        tex.mat = upload(0, imgs[0], true);
        tex.props = upload(1, imgs[1], true);
        tex.snow = upload(2, imgs[2], false);
        tex.cloud = upload(3, imgs[3], false);
        gl.uniform1i(loc.uMat, 0);
        gl.uniform1i(loc.uProps, 1);
        gl.uniform1i(loc.uSnow, 2);
        gl.uniform1i(loc.uCloud, 3);
        var k = (m - 1) % 3;
        gl.uniform3f(loc.uMonth, k === 0 ? 1 : 0, k === 1 ? 1 : 0, k === 2 ? 1 : 0);
        ready = true;
        return true;
      })
      .catch(function (e) { failed = true; window.console.warn("earth body: not loaded", e && e.message); return false; });
  }

  /* One frame. o: W, H, dpr, cx, cy, R, spin, sinT, cosT, sun ([x, y, z] in
     the world), near, high, journey, time, focus {x, y, amt, r}, cloud,
     shell, stars, starX, starY, light. Drawn again only when something in
     it has changed. */
  function draw(o) {
    if (!ready) { return null; }
    var pw = Math.max(1, Math.round(o.W * o.dpr)), ph = Math.max(1, Math.round(o.H * o.dpr));
    if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; last = ""; }
    var f = o.focus || { x: o.W / 2, y: o.H / 2, amt: 0, r: 1 };
    var key = [o.cx, o.cy, o.R, o.spin, o.sinT, o.near, o.high, o.journey, f.x, f.y, f.amt, o.cloud, o.shell,
               o.stars, o.starX, o.starY, o.light, o.sun[0], o.sun[1], o.sun[2], o.cloud > 0.002 ? Math.round(o.time) : 0,
               pw, ph].join();
    if (key === last) { return canvas; }
    last = key;
    gl.viewport(0, 0, pw, ph);
    gl.uniform3f(loc.uView, o.W, o.H, ph);
    gl.uniform1f(loc.uDpr, pw / o.W);
    gl.uniform3f(loc.uC, o.cx, o.cy, o.R);
    gl.uniform4f(loc.uRot, Math.sin(o.spin), Math.cos(o.spin), o.sinT, o.cosT);
    gl.uniform3f(loc.uSun, o.sun[0], o.sun[1], o.sun[2]);
    gl.uniform4f(loc.uK, o.near, o.high, o.journey, o.time);
    gl.uniform4f(loc.uDof, f.x, f.y, f.amt, f.r);
    gl.uniform4f(loc.uSky, o.cloud, o.shell, o.stars, o.light);
    gl.uniform2f(loc.uStar, o.starX, o.starY);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return canvas;
  }

  window.EarthBody = { start: start, draw: draw, ready: function () { return ready; } };
})();
