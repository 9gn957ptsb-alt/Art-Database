/* 5s Motion Lab: Pin (Decomposition & making).
 *
 * The mark drops into a frame like a picture being hung, swings and settles. The frame is the logo's own
 * rounded square, with the paper inside it and a shadow on the wall behind; the picture hangs from a nail
 * on a taut wire (the little "^" above a hung picture), or from a pushpin through its top edge. It is
 * the Set tab's moment: "Pin this set", a composition made, named and put on the wall. Every style ends
 * level, crisp and centred: the framed mark, at rest.
 *
 * Styles
 *   hang     a nail on the wall; the picture is lowered onto it, the wire catches with a small give, and
 *            the picture swings and settles level
 *   drop-in  the empty frame already hangs on its nail (negative space, waiting); the 5 slides down into
 *            it from behind the top edge and lands, then the s, then the ribbon sweeps in; each landing
 *            gives the frame a small swing
 *   pushpin  the picture is held up crooked, a pushpin is pressed through its top edge, and when it is let
 *            go it swings about the pin and comes to rest
 *   level    the picture hangs crooked; a hand nudges it level, a touch past, and a second small nudge
 *            squares it up
 *
 * The swing is a damped pendulum (`swing` sets how far it swings); env.direction sets which way the first
 * swing goes (right: clockwise).
 */
(function () {
  'use strict';
  const M = Marks;
  const TAU = Math.PI * 2;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const win = (t, a, len) => clamp01((t - a) / len);
  const bump = (x) => Math.sin(Math.PI * clamp01(x));

  const FRAME = M.points('frame', 200);
  const FRAME_STROKE = M.points('frame', 256);
  function framePath(ctx, inset) {
    // the frame's centreline polygon, pulled in towards the centre by `inset` (mark units)
    const k = inset ? (479 - inset) / 479 : 1;
    ctx.beginPath();
    for (let i = 0; i < FRAME.length; i++) {
      const x = 500 + (FRAME[i][0] - 500) * k, y = 500 + (FRAME[i][1] - 500) * k;
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    }
    ctx.closePath();
  }

  // the picture at rest: scale, and where its hanging point sits in the world (mark units)
  const SC = 0.8;
  const HOOK = [500, -96];                       // the wire's apex in the picture's own coordinates (above it)
  const NAIL = [500, 500 - SC * (452 - HOOK[1])]; // so the picture and its wire are centred together
  const PIN_LOCAL = [500, 21];                   // the pushpin goes through the middle of the top edge
  const PIN = [500, 500 - SC * (500 - PIN_LOCAL[1])];

  function looks(pal) {
    const dark = pal.theme === 'dark' ? pal.name !== 'inverse' : pal.name === 'inverse';
    if (pal.name === 'paper') return { dark: false, paper: M.mix(pal.bg, '#FFFFFF', 0.12), shade: '#1A0F45', shadow: 0.3, metal: M.mix(pal.bg, '#FFFFFF', 0.75), wire: M.rgba('#FFFFFF', 0.7) };
    if (dark) return { dark, paper: M.mix(pal.bg, '#FFFFFF', 0.045), shade: '#000000', shadow: 0.6, metal: '#B9B4C8', wire: M.rgba('#D9D4E6', 0.75) };
    return { dark, paper: '#FFFFFF', shade: M.mix(pal.ink, '#3A2E6E', 0.5), shadow: 0.16, metal: '#5D5872', wire: M.rgba(pal.ink, 0.55) };
  }

  // the picture: o = {at: world point the pivot sits at, pivot: the same point in picture coordinates, rot,
  // sc, wire, ribbonT, contents(ctx) to draw instead of the whole mark, lift (0..1: off the wall a little)}
  function picture(ctx, pal, p, look, o) {
    const place = (c, dx, dy) => {
      c.translate(o.at[0] + dx, o.at[1] + dy); c.rotate(o.rot); c.scale(o.sc, o.sc); c.translate(-o.pivot[0], -o.pivot[1]);
    };
    const lift = o.lift || 0;
    // its shadow on the wall: down and a little right, softer and farther when it is held away from the wall
    ctx.save();
    place(ctx, 10 + 30 * lift, 20 + 50 * lift);
    for (let k = 0; k < 3; k++) {
      ctx.globalAlpha = look.shadow * (1 - 0.4 * lift) / 3;
      ctx.fillStyle = look.shade;
      framePath(ctx, -6 - 10 * k - 20 * lift * k);
      ctx.fill();
    }
    ctx.restore();
    ctx.save();
    place(ctx, 0, 0);
    if (o.wire) {
      ctx.strokeStyle = look.wire; ctx.lineWidth = 10; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(250, 170); ctx.lineTo(HOOK[0], HOOK[1]); ctx.lineTo(750, 170); ctx.stroke();
    }
    ctx.fillStyle = look.paper;
    framePath(ctx, 0); ctx.fill();
    if (o.contents) o.contents(ctx);
    else M.mark(ctx, { palette: pal, weight: p.weight, ribbon: p.ribbon, t: o.ribbonT || 0 });
    M.stroke(ctx, FRAME_STROKE, { width: M.widths.frame * p.weight, colours: pal.frame });
    ctx.restore();
  }

  function nail(ctx, look, at, sc) {
    ctx.save();
    ctx.translate(at[0], at[1]); ctx.scale(sc || 1, sc || 1);
    ctx.fillStyle = M.rgba('#000000', look.dark ? 0.5 : 0.18);
    ctx.beginPath(); ctx.arc(4, 8, 21, 0, TAU); ctx.fill();
    ctx.fillStyle = look.metal;
    ctx.beginPath(); ctx.arc(0, 0, 20, 0, TAU); ctx.fill();
    ctx.fillStyle = M.rgba('#FFFFFF', 0.5);
    ctx.beginPath(); ctx.arc(-6, -7, 7, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function pushpin(ctx, pal, look, at, o) {
    // o: {press (0..1: how far in), height (0..1: above the board), alpha}
    const h = o.height, a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.002) return;
    ctx.save();
    ctx.globalAlpha = a;
    // the shadow under the pin, farther as it is higher
    ctx.fillStyle = M.rgba('#000000', (look.dark ? 0.45 : 0.2) * (1 - 0.5 * h));
    ctx.beginPath(); ctx.ellipse(at[0] + 10 + 60 * h, at[1] + 16 + 80 * h, 30 + 10 * h, 26 + 8 * h, 0, 0, TAU); ctx.fill();
    // the head: squashes a little as it is pressed home
    const sq = 0.12 * bump(o.press * 1.0) * (o.press < 1 ? 1 : 0);
    const r = 34 * (1 + 0.45 * h);
    const head = M.mix(pal.flare, pal.ember, 0.35);
    ctx.translate(at[0] - 18 * h, at[1] - 60 * h);
    ctx.scale(1 + sq, 1 - sq);
    const g = ctx.createRadialGradient ? ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r) : null;
    if (g) { g.addColorStop(0, M.mix(head, '#FFFFFF', 0.55)); g.addColorStop(0.55, head); g.addColorStop(1, M.mix(head, '#000000', 0.25)); }
    ctx.fillStyle = g || head;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // a damped swing that starts at amplitude a0 at time t0 and is exactly 0 by t = 1
  function damped(t, t0, a0, cycles, decay) {
    if (t <= t0) return 0;
    const tau = (t - t0) / (1 - t0);
    return a0 * Math.exp(-decay * tau) * Math.sin(TAU * cycles * tau) * (1 - M.smoothstep(0.75, 1, tau));
  }

  /* --- styles ------------------------------------------------------------------------------------ */
  function hang(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, dir = env.direction === 'left' ? -1 : 1;
    const A = p.swing * (0.05 + 0.1 * I);
    // lowered onto the nail (eased), a little crooked in the hand
    const tc = 0.38;
    const u = win(t, 0.03, tc - 0.03);
    const down = ease(M.smoothstep(0, 1, u));
    const give = 22 * (0.4 + I) * bump((t - tc) / 0.14);           // the wire catches and gives
    const y = NAIL[1] - (1 - down) * 1100 + give;
    const held = -dir * A * 0.5 * (1 - down) * (t < tc ? 1 : 0);
    // the catch sets it swinging: from the held tilt into the swing
    const sw = damped(t, tc, dir * A, 1.6, 3.4);
    const rot = held + sw;
    nail(ctx, look, NAIL);
    picture(ctx, pal, p, look, { at: [NAIL[0], y], pivot: HOOK, rot, sc: SC, wire: true, ribbonT: -rot * 0.8, lift: 0.3 * (1 - down) });
    nail(ctx, look, [NAIL[0], NAIL[1]], 0.62);   // the nail's head over the wire
  }

  function dropIn(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, k = p.weight, dir = env.direction === 'left' ? -1 : 1;
    const A = p.swing * (0.025 + 0.05 * I);
    // the letters: the 5 lands first, then the s; each landing kicks the frame
    const t5 = 0.08, l5 = 0.3, tS = 0.34, lS = 0.26;
    const land5 = t5 + l5, landS = tS + lS;
    const rot = damped(t, land5, dir * A, 1.4, 3.2) + damped(t, landS, -dir * A * 0.6, 1.4, 3.2);
    const drop = (at, len) => ease(M.smoothstep(0, 1, win(t, at, len)));
    const squash = (landAt) => 0.06 * (0.5 + I) * bump((t - landAt) / 0.12);
    const contents = (c) => {
      c.save();
      framePath(c, 26);
      c.clip();
      const rib = M.smoothstep(0.5, 0.95, t);
      if (p.ribbon && rib > 0) M.ribbon(c, 0.15 * (1 - rib) - rot, { colours: pal.ribbon, along: ease(rib) });
      const y5 = -760 * (1 - drop(t5, l5)), sq5 = squash(land5);
      if (y5 > -755) {
        c.save();
        c.translate(400, 760 + y5); c.scale(1 + sq5 * 0.6, 1 - sq5); c.translate(-400, -760);
        M.stroke(c, M.points('body', 220), { width: M.widths.body * k, colours: pal.body });
        M.stroke(c, M.points('bar', 90), { width: M.widths.bar * k, colours: pal.bar });
        c.restore();
      }
      const yS = -760 * (1 - drop(tS, lS)), sqS = squash(landS);
      if (yS > -755) {
        c.save();
        c.translate(760, 830 + yS); c.scale(1 + sqS * 0.6, 1 - sqS); c.translate(-760, -830);
        M.stroke(c, M.points('s', 180), { width: M.widths.s * k, colours: pal.s });
        c.restore();
      }
      c.restore();
    };
    nail(ctx, look, NAIL);
    picture(ctx, pal, p, look, { at: NAIL, pivot: HOOK, rot, sc: SC, wire: true, contents });
    nail(ctx, look, NAIL, 0.62);
  }

  function pushpinStyle(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, dir = env.direction === 'left' ? -1 : 1;
    const A = p.swing * (0.06 + 0.1 * I);
    // held up crooked, slid into place by hand
    const inT = ease(M.smoothstep(0, 1, win(t, 0.02, 0.3)));
    const tilt = -dir * A * 0.9;
    const pinAt = 0.3, pinLen = 0.16, release = pinAt + pinLen + 0.02;
    const pinDown = ease(M.smoothstep(0, 1, win(t, pinAt, pinLen)));
    const press = win(t, pinAt + pinLen * 0.75, 0.1);
    // released: it swings from the crooked angle about the pin, through level, and settles
    let rot;
    if (t < release) rot = tilt * (0.7 + 0.3 * inT);
    else {
      const tau = (t - release) / (1 - release);
      rot = tilt * Math.exp(-3.2 * tau) * Math.cos(TAU * 1.25 * tau) * (1 - M.smoothstep(0.78, 1, tau));
    }
    const y = PIN[1] + (1 - inT) * 340;
    const x = PIN[0] - (1 - inT) * 120 * dir;
    picture(ctx, pal, p, look, { at: [x, y], pivot: PIN_LOCAL, rot, sc: SC * (1 + 0.04 * (1 - inT)), wire: false, ribbonT: -rot * 0.8, lift: 0.4 * (1 - pinDown) });
    pushpin(ctx, pal, look, [x, y], { height: 1 - pinDown, press, alpha: M.smoothstep(pinAt - 0.06, pinAt + 0.02, t) });
  }

  function level(ctx, t, p, env, I, ease, look) {
    const pal = env.palette, dir = env.direction === 'left' ? -1 : 1;
    const A = p.swing * (0.08 + 0.12 * I);
    const crooked = -dir * A;
    // the grip (it goes a touch more crooked as the hand takes it), the first nudge a little past level,
    // a short wobble, a second small nudge, and a last settle to exactly level
    const grip = 0.1 * bump((t - 0.04) / 0.14);
    const n1 = ease(M.smoothstep(0, 1, win(t, 0.14, 0.24)));
    const n2 = ease(M.smoothstep(0, 1, win(t, 0.5, 0.18)));
    const n3 = ease(M.smoothstep(0, 1, win(t, 0.72, 0.22)));
    const past = -0.28 * crooked, small = 0.07 * crooked;
    let rot = crooked * (1 + grip);
    rot = M.lerp(rot, past, n1);
    rot = M.lerp(rot, small, n2);
    rot = M.lerp(rot, 0, n3);
    rot += damped(t, 0.38, -0.12 * crooked, 1, 2.5) * (1 - n2);
    nail(ctx, look, NAIL);
    picture(ctx, pal, p, look, { at: NAIL, pivot: HOOK, rot, sc: SC, wire: true, ribbonT: -rot * 0.8 });
    nail(ctx, look, NAIL, 0.62);
  }

  Motion.register({
    id: 'pin',
    name: 'Pin',
    idea: 'The mark drops into a frame like a picture being hung, swings and settles.',
    why: 'Pinning a set is making something and putting it on the wall: a composition named in one line, settled, level, yours.',
    moments: ['set-pin'],
    styles: ['hang', 'drop-in', 'pushpin', 'level'],
    params: {
      duration: { default: 1150, min: 500, max: 3000, step: 50 },
      style: { default: 'hang', options: ['hang', 'drop-in', 'pushpin', 'level'] },
      swing: { default: 0.7, min: 0, max: 1, step: 0.05 },        // how far the picture swings
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const ease = M.easing(p.easing);
      const I = p.intensity;
      const look = looks(env.palette);
      if (p.style === 'drop-in') dropIn(ctx, t, p, env, I, ease, look);
      else if (p.style === 'pushpin') pushpinStyle(ctx, t, p, env, I, ease, look);
      else if (p.style === 'level') level(ctx, t, p, env, I, ease, look);
      else hang(ctx, t, p, env, I, ease, look);
    }
  });
})();
