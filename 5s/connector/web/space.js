/* One building in blocks: the space in a round card (web/round.html) and the viewer page (web/space.html).
   The drawing is the website's (its models.js voxelises the model; every face that sees air is a quad, lit
   as the site lights it), moved into one function. Needs THREE (r147), THREE.OrbitControls and Models first.
     const s = FivesSpace.mount(canvas, spec, { flat, turn, bg, onTap });
       flat:  only turn it (a sideways drag), never tilt or zoom: inline in a chat a vertical drag is the chat's
       turn:  turn slowly by itself (never with reduced motion)
       onTap: a tap (not a drag) while spinning
     s.walk(); s.spin(); s.flat(on); s.size(); s.stop();   s.canWalk, s.covered
   Go in stands you where the model is open: the spot that runs longest under cover, or, under 4 m of cover,
   the open floor nearest the middle (a cutaway room). Most models are solid massing, so for most it is a
   porch, an eave or a pergola beside the building. */
"use strict";
(function () {
  const SOIL = [138, 118, 96], EYE = 1.6, FOV = 35;
  const FACES = [
    { n: [-1, 0, 0], c: [[0, 1, 0], [0, 0, 0], [0, 1, 1], [0, 0, 1]], l: 0.94 },
    { n: [1, 0, 0], c: [[1, 1, 1], [1, 0, 1], [1, 1, 0], [1, 0, 0]], l: 0.74 },
    { n: [0, 0, -1], c: [[1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]], l: 0.6 },
    { n: [0, 0, 1], c: [[0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]], l: 1.06 },
    { n: [0, -1, 0], c: [[1, 0, 0], [0, 0, 0], [1, 1, 0], [0, 1, 0]], l: 0.94 },
    { n: [0, 1, 0], c: [[0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]], l: 0.74 }
  ];
  function meshes(vx) {
    const { grid, nx, ny, nz, v, names, site } = vx, M = Models.MATERIALS;
    const mat = names.map(n => M[n]);
    const at = (i, j, k) => (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) ? 0 : grid[(k * ny + j) * nx + i];
    const open = (i, j, k, m) => mat[m - 1].open && (i + j + k) % 2;
    const air = (i, j, k) => { if (k < 0) return false; const m = at(i, j, k); return !m || open(i, j, k, m); };
    const clear = (i, j, k) => { if (k < 0) return false; const m = at(i, j, k); return !m || open(i, j, k, m) || mat[m - 1].glass; };
    const out = [{ p: [], c: [], x: [] }, { p: [], c: [], x: [] }];
    for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const m = grid[(k * ny + j) * nx + i];
      if (!m || open(i, j, k, m)) continue;
      const t = mat[m - 1], glass = !!t.glass, o = out[glass ? 1 : 0];
      const base = glass ? [120, 146, 166] : (t.c || SOIL), grain = 0.93 + 0.14 * Models.grain(i, j, k);
      const x0 = i * v - site[0] / 2, y0 = k * v, z0 = j * v - site[1] / 2;
      for (const f of FACES) {
        const a = i + f.n[0], b = j + f.n[1], c = k + f.n[2];
        if (glass ? !air(a, b, c) : !clear(a, b, c)) continue;
        const s = Math.min(1, f.l * grain) / 255, q = o.p.length / 3;
        for (const cc of f.c) {
          o.p.push(x0 + cc[0] * v, y0 + cc[1] * v, z0 + cc[2] * v);
          o.c.push(base[0] * s, base[1] * s, base[2] * s);
        }
        o.x.push(q, q + 1, q + 2, q + 2, q + 1, q + 3);
      }
    }
    return out.map((o, n) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(o.p, 3));
      g.setAttribute("color", new THREE.Float32BufferAttribute(o.c, 3));
      g.setIndex(o.x.length / 6 * 4 > 65535 ? new THREE.Uint32BufferAttribute(o.x, 1) : new THREE.Uint16BufferAttribute(o.x, 1));
      return new THREE.Mesh(g, n ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4, depthWrite: false })
                                 : new THREE.MeshBasicMaterial({ vertexColors: true }));
    });
  }
  function inside(vx) {
    const { grid, nx, ny, nz, v, names, site } = vx;
    const tree = { plant: 1, sage: 1, lavender: 1, drygrass: 1 };
    const at = (i, j, k) => grid[(k * ny + j) * nx + i];
    const floor = new Int16Array(nx * ny).fill(-1), roof = new Int16Array(nx * ny).fill(-1);
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      let k = 0;
      while (k < nz && at(i, j, k)) k++;
      if (k * v > 1.5) continue;
      let r = k;
      while (r < nz && !at(i, j, r)) r++;
      if ((r - k) * v < 2) continue;
      floor[j * nx + i] = k;
      if (r < nz && !tree[names[at(i, j, r) - 1]]) roof[j * nx + i] = r;
    }
    const eye = (i, j) => floor[j * nx + i] + Math.floor(Math.min(EYE, (roof[j * nx + i] < 0 ? 99 : (roof[j * nx + i] - floor[j * nx + i]) * v - 0.3)) / v);
    function run(i, j, dx, dy, k, covered) {
      let s = 0;
      for (;;) {
        const a = i + dx * (s + 1), b = j + dy * (s + 1);
        if (a < 0 || b < 0 || a >= nx || b >= ny || floor[b * nx + a] < 0 || at(a, b, k) || (covered && roof[b * nx + a] < 0)) return s;
        s++;
      }
    }
    const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    function pick(covered) {
      let best = null;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        if (floor[j * nx + i] < 0 || (covered && roof[j * nx + i] < 0)) continue;
        const k = eye(i, j), d = Math.hypot(i - nx / 2, j - ny / 2);
        for (const [dx, dy] of DIRS) {
          const s = run(i, j, dx, dy, k, covered);
          if (!best || (covered ? s > best.s || (s === best.s && d < best.d) : d < best.d || (d === best.d && s > best.s))) best = { i, j, k, s, d, dx, dy, covered };
        }
      }
      return best;
    }
    let best = pick(true);
    if (!best || best.s * v < 4) best = pick(false) || best;
    if (!best) return null;
    const x = (best.i + 0.5) * v - site[0] / 2, z = (best.j + 0.5) * v - site[1] / 2;
    const y = floor[best.j * nx + best.i] * v + Math.min(EYE, (best.k - floor[best.j * nx + best.i] + 0.5) * v);
    return { at: new THREE.Vector3(x, y, z), dir: new THREE.Vector3(best.dx, 0, best.dy).normalize(), covered: best.covered };
  }

  function mount(canvas, spec, opts) {
    opts = opts || {};
    const vx = Models.voxelize(spec), v = vx.v, [w, d] = vx.site, h = vx.nz * v;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(opts.bg || "#ebe8e2");
    const built = meshes(vx);
    built[1].renderOrder = 1;
    scene.add(built[0], built[1]);
    const g = (Models.MATERIALS[spec.ground] || {}).c || SOIL;
    const side = new THREE.MeshBasicMaterial({ color: new THREE.Color(...SOIL.map(c => c * 0.8 / 255)) });
    const top = new THREE.MeshBasicMaterial({ color: new THREE.Color(...g.map(c => c / 255)) });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w, 6 * v, d), [side, side, top, side, side, side]);
    plate.position.y = -3 * v;
    scene.add(plate);
    const R = 0.5 * Math.hypot(w, d, h);
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, R * 30);
    const controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    // OrbitControls takes every touch (touch-action none); flat, a vertical drag goes back to the chat.
    const touch = () => { canvas.style.touchAction = flat ? "pan-y" : "none"; };
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const room = inside(vx), ray = new THREE.Raycaster();
    let mode, tween = null, flat = !!opts.flat, dirty = true;
    touch();
    controls.addEventListener("change", () => { dirty = true; });
    function look(dir) { controls.target.copy(camera.position).addScaledVector(dir, 0.01); controls.update(); }
    function press(m) {
      mode = m; tween = null; dirty = true;
      controls.enableZoom = m === "spin" && !flat;
      controls.autoRotate = m === "spin" && !!opts.turn && !reduce;
      controls.autoRotateSpeed = 0.7;
      controls.rotateSpeed = m === "spin" ? 0.8 : -0.35;     // walking, the world follows the finger
      camera.near = m === "spin" ? R * 0.01 : 0.05;
      camera.fov = m === "spin" ? FOV : 70;
      camera.updateProjectionMatrix();
    }
    function spin() {
      press("spin");
      // Fit the plate whichever way the box is turned, seen from the south-east down the isometric diagonal, as the site rests.
      const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
      const dist = 1.08 * Math.max(0.354 * (w + d) / (t * camera.aspect), (0.204 * (w + d) + 0.41 * Math.min(h, 40)) / t) + R * 0.5;
      controls.target.set(0, Math.min(h, 20) / 4, 0);
      camera.position.copy(controls.target).addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), dist);
      controls.minDistance = Math.max(2, R * 0.15); controls.maxDistance = dist * 1.6;
      controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI / 2 - 0.03;
      controls.update();
      if (flat) { const polar = controls.getPolarAngle(); controls.minPolarAngle = controls.maxPolarAngle = polar; }
    }
    function walk() {
      if (!room) return false;
      press("walk");
      controls.minPolarAngle = 0; controls.maxPolarAngle = Math.PI - 0.05;
      controls.minDistance = 0; controls.maxDistance = Infinity;
      camera.position.copy(room.at);
      look(room.dir);
      return true;
    }
    // A tap, not a drag: spinning, it is the card's to use (go in); walking, onto a floor stands you on it,
    // onto a wall stops you half a metre short.
    let down = null;
    canvas.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; controls.autoRotate = false; });
    canvas.addEventListener("pointerup", e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 400) return;
      down = null;
      if (mode === "spin") { if (opts.onTap) opts.onTap(); return; }
      const r = canvas.getBoundingClientRect();
      ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: 1 - (e.clientY - r.top) / r.height * 2 }, camera);
      const hit = ray.intersectObjects([built[0], plate])[0];
      if (!hit) return;
      const n = hit.face.normal;
      const to = n.y > 0.7 ? hit.point.clone().setY(hit.point.y + EYE) : hit.point.clone().addScaledVector(n, 0.5).setY(camera.position.y);
      tween = { from: camera.position.clone(), to, t: 0 };
    });
    function size() {
      const r = canvas.getBoundingClientRect();
      renderer.setSize(Math.max(1, r.width), Math.max(1, r.height), false);
      camera.aspect = Math.max(1, r.width) / Math.max(1, r.height);
      camera.updateProjectionMatrix();
      if (mode === "spin") spin();
      dirty = true;
    }
    size();
    spin();
    const clock = new THREE.Clock();
    // Drawn only when something moved: five cards in a chat each hold a building.
    renderer.setAnimationLoop(() => {
      const dt = clock.getDelta();
      if (tween) {
        const dir = controls.target.clone().sub(camera.position).normalize();
        tween.t = Math.min(1, tween.t + dt / 0.45);
        camera.position.lerpVectors(tween.from, tween.to, tween.t * tween.t * (3 - 2 * tween.t));
        look(dir);
        if (tween.t === 1) tween = null;
        dirty = true;
      }
      controls.update();
      if (dirty) { dirty = false; renderer.render(scene, camera); }
    });
    return {
      canWalk: !!room, covered: !!(room && room.covered), renderer,
      spin, walk, size,
      flat(on) { flat = !!on; touch(); if (mode === "spin") spin(); },
      stop() {
        renderer.setAnimationLoop(null);
        controls.dispose();
        scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
        renderer.dispose();
        renderer.forceContextLoss();   // iOS keeps only a few WebGL contexts a page
      }
    };
  }
  window.FivesSpace = { mount };
})();
