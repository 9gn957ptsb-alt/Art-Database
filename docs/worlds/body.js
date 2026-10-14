/* The bodies: every world but the Earth drawn as the Artist Website draws
   the Earth (docs/v2/earth-body.js), and the territories laid over any of
   them, the Earth included.

   A body is a sphere seen from a little above, spun about its axis and leant
   toward the viewer, in the same projection as the site's globe:

     x = cos(lat) sin(lon - spin), y = sin(lat), z = cos(lat) cos(lon - spin)
     then leant by the tilt: y' = y cos t - z sin t, z' = y sin t + z cos t

   Its cells are crisp squares of their colour, never smeared when near and
   averaged only when far; light falls from the sun's direction, with the air
   thin at the limb. Over that, each territory: a wash of its holder's colour,
   a hairline where one territory meets the next (one device pixel at every
   size), and the one pointed at or chosen picked out in cream.

   Bodies(canvas): add(name, image | {w, h, data}, nearest), draw(list).
   An item of the list: cx, cy, R (CSS pixels), spin, tilt (radians), sun
   ([x, y, z] in the body's own frame), tex (or null to draw the territories
   alone), land, tint, hover, sel, air ([r, g, b, thickness]), fade, lines. */

(function () {
  "use strict";

  var VERT = "#version 300 es\nin vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
  var FRAG = [
    "#version 300 es",
    "precision highp float; precision highp int;",
    "out vec4 outC;",
    "uniform vec2 uView;",     // CSS width, height
    "uniform float uDpr;",
    "uniform vec3 uC;",        // cx, cy, R
    "uniform vec4 uRot;",      // sin spin, cos spin, sin tilt, cos tilt
    "uniform vec3 uSun;",
    "uniform sampler2D uTex;", "uniform int uHasTex;",
    "uniform sampler2D uLand;", "uniform int uHasLand;", "uniform ivec2 uLandSize;",
    "uniform sampler2D uTint;",
    "uniform ivec2 uPick;",    // hover, selected
    "uniform vec4 uAir;",      // colour, thickness (fraction of R)
    "uniform vec2 uFade;",     // overall alpha, hairlines between unheld territories
    "const float PI = 3.14159265;",
    "const vec3 CREAM = vec3(0.918, 0.875, 0.804);",
    "int idAt(vec2 uv) {",
    "  ivec2 p = ivec2(floor(vec2(fract(uv.x), clamp(uv.y, 0.0, 0.9999)) * vec2(uLandSize)));",
    "  vec4 c = texelFetch(uLand, p, 0);",
    "  return int(c.r * 255.0 + 0.5) + 256 * int(c.g * 255.0 + 0.5) - 1;",
    "}",
    "vec4 tintOf(int id) { return id < 0 ? vec4(0.0) : texelFetch(uTint, ivec2(id % 256, id / 256), 0); }",
    "vec2 uvAt(vec2 css, out float z, out vec3 nw, out bool inside) {",
    "  vec2 d = (css - uC.xy) / uC.z; d.y = -d.y;",
    "  float r2 = dot(d, d); inside = r2 <= 1.0;",
    "  z = sqrt(max(0.0, 1.0 - r2));",
    "  float yy = d.y * uRot.w + z * uRot.z, zz = -d.y * uRot.z + z * uRot.w;",
    "  float lat = asin(clamp(yy, -1.0, 1.0));",
    "  float a = atan(d.x, zz);",
    "  float sa = sin(a), ca = cos(a);",
    "  float lon = a + atan(uRot.x, uRot.y);",
    "  nw = vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));",
    "  return vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI);",
    "}",
    "void main() {",
    "  vec2 css = vec2(gl_FragCoord.x, uView.y * uDpr - gl_FragCoord.y) / uDpr;",
    "  float z; vec3 nw; bool inside;",
    "  vec2 uv = uvAt(css, z, nw, inside);",
    "  float r = length(css - uC.xy) / uC.z;",
    "  float lit = dot(nw, normalize(uSun));",
    "  if (!inside) {",
    "    if (uAir.w <= 0.0 || r > 1.0 + uAir.w) { discard; }",
    // The air at the limb, on the lit side only.
    "    vec2 dd = normalize(css - uC.xy); dd.y = -dd.y;",
    "    float face = 0.0;",
    "    { float yy = dd.y * uRot.w, zz = -dd.y * uRot.z; float lat = asin(clamp(yy, -1.0, 1.0)); float lon = atan(dd.x, zz) + atan(uRot.x, uRot.y);",
    "      face = dot(vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)), normalize(uSun)); }",
    "    float k = 1.0 - (r - 1.0) / uAir.w;",
    "    float a = k * k * k * smoothstep(-0.25, 0.4, face) * 0.55 * uFade.x;",
    "    outC = vec4(uAir.rgb * a, a); return;",
    "  }",
    "  vec4 base = vec4(0.0);",
    "  if (uHasTex == 1) {",
    // Derivatives that do not jump at the seam, so the far side is averaged cleanly.
    "    vec2 uv2 = vec2(fract(uv.x + 0.5), uv.y);",
    "    vec2 dx = dFdx(uv), dy = dFdy(uv), dx2 = dFdx(uv2), dy2 = dFdy(uv2);",
    "    if (abs(dx2.x) < abs(dx.x)) { dx.x = dx2.x; } if (abs(dy2.x) < abs(dy.x)) { dy.x = dy2.x; }",
    "    vec3 c = textureGrad(uTex, uv, dx, dy).rgb;",
    "    float day = smoothstep(-0.12, 0.28, lit);",
    "    float shade = 0.07 + 0.93 * day * (0.62 + 0.38 * max(lit, 0.0));",
    "    c *= shade;",
    // A breath of the air over the ground, thickest at the limb.
    "    c = mix(c, uAir.rgb * (0.25 + 0.75 * day), pow(1.0 - z, 3.0) * 0.55 * step(0.0001, uAir.w));",
    "    base = vec4(c, 1.0);",
    "  }",
    "  if (uHasLand == 1) {",
    "    int id = idAt(uv);",
    "    vec2 px = vec2(dFdx(uv.x), dFdy(uv.y));",
    "    int ex = idAt(uv + vec2(dFdx(uv.x), dFdx(uv.y))), ey = idAt(uv + vec2(dFdy(uv.x), dFdy(uv.y)));",
    "    vec4 t = tintOf(id);",
    "    float day = 0.55 + 0.45 * smoothstep(-0.1, 0.3, lit);",
    "    vec3 over = vec3(0.0); float oa = 0.0;",
    "    if (id >= 0) {",
    "      if (t.a > 0.0) { over = t.rgb; oa = 0.22 * day; }",
    "      if (uPick.y >= 0 && id == uPick.y) { over = mix(over, CREAM, 0.5); oa = max(oa, 0.2); }",
    "      else if (uPick.x >= 0 && id == uPick.x) { over = mix(over, CREAM, 0.4); oa = max(oa, 0.11); }",
    "    }",
    "    bool edge = (ex != id || ey != id) && (id >= 0 || ex >= 0 || ey >= 0);",
    "    if (edge) {",
    "      int other = ex != id ? ex : ey;",
    "      vec4 to = tintOf(other);",
    "      float ea = uFade.y * day; vec3 ec = CREAM;",
    "      if (t.a > 0.0 || to.a > 0.0) { ec = t.a > 0.0 ? t.rgb : to.rgb; ea = 0.85 * day; }",
    "      if (uPick.x >= 0 && (id == uPick.x || other == uPick.x)) { ec = CREAM; ea = max(ea, 0.7); }",
    "      if (uPick.y >= 0 && (id == uPick.y || other == uPick.y)) { ec = vec3(1.0, 0.97, 0.9); ea = 1.0; }",
    // The hairline over the wash: premultiplied, one layer on the other.
    "      vec3 pm = over * oa * (1.0 - ea) + ec * ea; oa = oa + ea * (1.0 - oa); over = pm / max(oa, 0.0001);",
    "    }",
    "    if (base.a > 0.0) { base.rgb = mix(base.rgb, over, oa); }",
    "    else { base = vec4(over, oa); }",
    "  }",
    "  if (base.a <= 0.0) { discard; }",
    // The rim, antialiased; the output premultiplied.
    "  float rimW = 1.2 / (uC.z * uDpr);",
    "  float a = base.a * clamp((1.0 - r) / rimW, 0.0, 1.0) * uFade.x;",
    "  outC = vec4(base.rgb * a, a);",
    "}"
  ].join("\n");

  function Bodies(canvas) {
    this.canvas = canvas;
    var gl = this.gl = canvas.getContext("webgl2", { premultipliedAlpha: true, antialias: false, alpha: true });
    if (!gl) { this.failed = true; return; }
    var prog = gl.createProgram();
    [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, FRAG]].forEach(function (s) {
      var sh = gl.createShader(s[0]);
      gl.shaderSource(sh, s[1]);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(sh)); }
      gl.attachShader(prog, sh);
    });
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { throw new Error(gl.getProgramInfoLog(prog)); }
    gl.useProgram(prog);
    this.prog = prog;
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var al = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(al);
    gl.vertexAttribPointer(al, 2, gl.FLOAT, false, 0, 0);
    var loc = this.loc = {};
    ["uView", "uDpr", "uC", "uRot", "uSun", "uTex", "uHasTex", "uLand", "uHasLand", "uLandSize", "uTint", "uPick", "uAir", "uFade"].forEach(function (n) {
      loc[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(loc.uTex, 0); gl.uniform1i(loc.uLand, 1); gl.uniform1i(loc.uTint, 2);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    this.tex = {};
    this.resize();
  }

  Bodies.prototype.resize = function () {
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    this.W = this.canvas.clientWidth; this.H = this.canvas.clientHeight;
    this.canvas.width = Math.max(1, Math.round(this.W * dpr));
    this.canvas.height = Math.max(1, Math.round(this.H * dpr));
  };

  /* A texture: an image (the look, mipmapped, crisp when near) or raw
     pixels {w, h, data} (the territories and their tints, read exactly). */
  Bodies.prototype.add = function (name, src, exact) {
    var gl = this.gl, t = this.tex[name] || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // The territories are numbers, not colours: read exactly as written.
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, exact ? gl.NONE : gl.BROWSER_DEFAULT_WEBGL);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (src.data) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    }
    if (exact) {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    } else {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    t.w = src.w || src.naturalWidth; t.h = src.h || src.naturalHeight;
    this.tex[name] = t;
  };

  Bodies.prototype.draw = function (list) {
    var gl = this.gl, loc = this.loc, dpr = this.dpr, me = this;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.SCISSOR_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(loc.uView, this.W, this.H);
    gl.uniform1f(loc.uDpr, dpr);
    list.forEach(function (o) {
      if (!o || o.R < 0.5 || !(o.fade > 0.002)) { return; }
      var m = o.R * (1 + (o.air ? o.air[3] : 0)) + 2;
      var x0 = Math.max(0, Math.floor((o.cx - m) * dpr)), x1 = Math.min(me.canvas.width, Math.ceil((o.cx + m) * dpr));
      var y0 = Math.max(0, Math.floor((o.cy - m) * dpr)), y1 = Math.min(me.canvas.height, Math.ceil((o.cy + m) * dpr));
      if (x1 <= x0 || y1 <= y0) { return; }
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(x0, me.canvas.height - y1, x1 - x0, y1 - y0);
      gl.uniform3f(loc.uC, o.cx, o.cy, o.R);
      gl.uniform4f(loc.uRot, Math.sin(o.spin), Math.cos(o.spin), Math.sin(o.tilt), Math.cos(o.tilt));
      gl.uniform3f(loc.uSun, o.sun[0], o.sun[1], o.sun[2]);
      var air = o.air || [0, 0, 0, 0];
      gl.uniform4f(loc.uAir, air[0], air[1], air[2], air[3]);
      gl.uniform2f(loc.uFade, o.fade, o.lines || 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, o.tex ? me.tex[o.tex] : null);
      gl.uniform1i(loc.uHasTex, o.tex ? 1 : 0);
      var land = o.land && me.tex[o.land];
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, land || null);
      gl.uniform1i(loc.uHasLand, land ? 1 : 0);
      if (land) { gl.uniform2i(loc.uLandSize, land.w, land.h); }
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, o.tint ? me.tex[o.tint] : null);
      gl.uniform2i(loc.uPick, o.hover === undefined ? -1 : o.hover, o.sel === undefined ? -1 : o.sel);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    });
    gl.disable(gl.SCISSOR_TEST);
  };

  /* The point under a screen position, for a body drawn at (cx, cy, R)
     with spin and tilt: [lat, lon] in radians, or null off it. */
  function unproject(o, x, y) {
    var dx = (x - o.cx) / o.R, dy = -(y - o.cy) / o.R, r2 = dx * dx + dy * dy;
    if (r2 > 1) { return null; }
    var z = Math.sqrt(1 - r2), st = Math.sin(o.tilt), ct = Math.cos(o.tilt);
    var yy = dy * ct + z * st, zz = -dy * st + z * ct;
    return [Math.asin(Math.max(-1, Math.min(1, yy))), Math.atan2(dx, zz) + o.spin];
  }
  function project(o, lat, lon) {
    var a = lon - o.spin, cl = Math.cos(lat);
    var x = cl * Math.sin(a), y = Math.sin(lat), z = cl * Math.cos(a);
    var st = Math.sin(o.tilt), ct = Math.cos(o.tilt);
    return { x: o.cx + o.R * x, y: o.cy - o.R * (y * ct - z * st), z: y * st + z * ct };
  }
  /* A direction seen on the screen (x right, y up, z toward the viewer),
     carried into the body's own frame: where its sun is. */
  function toBody(o, v) {
    var st = Math.sin(o.tilt), ct = Math.cos(o.tilt);
    var y = v[1] * ct + v[2] * st, z = -v[1] * st + v[2] * ct, x = v[0];
    var ss = Math.sin(o.spin), cs = Math.cos(o.spin);
    return [x * cs + z * ss, y, -x * ss + z * cs];
  }

  window.Worlds = window.Worlds || {};
  window.Worlds.Bodies = Bodies;
  window.Worlds.unproject = unproject;
  window.Worlds.project = project;
  window.Worlds.toBody = toBody;
})();
