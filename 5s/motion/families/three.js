/* 5s Motion Lab: Three (Decomposition & making).
 *
 * Irwin's three ways, after the artist: "At every given moment you can go three or more ways. When you
 * have three, it's not an either/or: you actually have to make a decision." The stroke divides into
 * three paths that go three ways, one is chosen, and the others fade.
 *
 * Styles
 *   strands  every stroke of the mark splits lengthwise into three strands, which part and become three
 *            small marks in a row, leaning three ways (the Set tab's chooser offers three); a beat to look
 *            at each in turn, then one is chosen: it comes forward and grows back into the mark while the
 *            other two fade
 *   fork     the mark is written by a pen, and at each turn of the line (the 5's corner and foot, the
 *            s's spine) the line forks three ways; the pen goes on along the true way and the other two
 *            branches, drawn faint, fade behind it
 *   fan      the mark becomes a card (the logo's own rounded square) and fans out into a hand of three; each
 *            is looked at in turn, the chosen card rises to the top as the other two fold behind it, and it
 *            is laid down at the centre, letting go of its mark
 *
 * `choice` picks which of the three is chosen in strands and fan: left, middle, right, `direction`
 * (env.direction: the way a tab move went) or `seeded` (the variant's seed decides, so Generate varies).
 */
(function () {
  'use strict';
  const M = Marks;
  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const win = (t, a, len) => clamp01((t - a) / len);
  const bump = (x) => Math.sin(Math.PI * clamp01(x));
  const C = M.anchors.letters;

  /* --- geometry ----------------------------------------------------------------------------------- */
  const PTS = { body: M.points('body', 160), bar: M.points('bar', 160), s: M.points('s', 160) };   // as Marks.mark samples them
  const KEYS = ['body', 'bar', 's'];                      // the mark's drawing order
  // unit normals along a polyline (smoothed over neighbours)
  function normals(pts) {
    const n = pts.length, out = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 2)], b = pts[Math.min(n - 1, i + 2)];
      const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1;
      out[i] = [-dy / d, dx / d];
    }
    return out;
  }
  const NRM = { body: normals(PTS.body), bar: normals(PTS.bar), s: normals(PTS.s) };

  // the chosen one of three (0 left, 1 middle, 2 right)
  function chosen(p, env) {
    if (p.choice === 'left') return 0;
    if (p.choice === 'middle') return 1;
    if (p.choice === 'right') return 2;
    if (p.choice === 'direction') return env.direction === 'left' ? 0 : 2;
    return Math.floor(env.rng() * 3) % 3;
  }

  // a copy of the mark: every stroke offset sideways by `off` (mark units, along its normals), then scaled by
  // `sc` and turned by `rot` about C, and moved to `pos`; strokes `width` = their own width x wk; `alpha`
  function copy(ctx, pal, p, o) {
    const cs = Math.cos(o.rot || 0), sn = Math.sin(o.rot || 0);
    const draw = (g) => {
      if (o.ribbon > 0.001 && p.ribbon) {
        g.save();
        g.translate(o.pos[0], o.pos[1]); g.rotate(o.rot || 0); g.scale(o.sc, o.sc); g.translate(-C[0], -C[1]);
        M.ribbon(g, o.ribbonT || 0, { colours: pal.ribbon, alpha: o.ribbon });
        g.restore();
      }
      for (const key of KEYS) {
        const src = PTS[key], nr = NRM[key], n = src.length;
        const pts = new Array(n);
        // o.off is in strand widths: a strand of a stroke is a third of that stroke's own width
        const off = o.off * (M.widths[key] * p.weight / 3);
        for (let i = 0; i < n; i++) {
          const x = src[i][0] + nr[i][0] * off - C[0], y = src[i][1] + nr[i][1] * off - C[1];
          pts[i] = [o.pos[0] + (x * cs - y * sn) * o.sc, o.pos[1] + (x * sn + y * cs) * o.sc];
        }
        M.stroke(g, pts, { width: M.widths[key] * p.weight * o.wk, colours: o.colours ? o.colours(key) : pal[key] });
      }
    };
    if (o.alpha < 0.999) M.layer(ctx, { alpha: o.alpha }, draw); else draw(ctx);
  }

  /* --- strands ------------------------------------------------------------------------------------ */
  const SLOTS = [[205, 545, -0.16], [500, 470, 0], [795, 545, 0.16]];   // x, y, lean of the three ways
  const SMALL = 0.34;

  function strands(ctx, t, p, env, I, ease) {
    const pal = env.palette, pick = chosen(p, env);
    // anticipation: the mark draws itself in a fraction before it splits
    const gather = 1 - 0.03 * bump(t / 0.1);
    const order = [1, 0, 2];                                  // the middle strand leaves first
    const items = [0, 1, 2].map((j) => {
      const lane = j - 1;
      const d = 0.035 * order.indexOf(j);
      const a = ease(M.smoothstep(0, 1, win(t, 0.05 + d, 0.3)));     // split and travel
      const look = bump((t - (0.36 + 0.055 * j)) / 0.11);            // looked at, in turn
      const isPick = j === pick;
      const choose = isPick ? ease(M.smoothstep(0, 1, win(t, 0.58, 0.34))) : 0;
      const squash = isPick ? 0.07 * bump((t - 0.52) / 0.08) : 0;    // a small gather before it is chosen
      const fade = isPick ? 0 : M.smoothstep(0.54, 0.78, t);
      const sl = SLOTS[j];
      // travel on an arc: up and out
      const u = a, v = 1 - u;
      const ctrl = [C[0] + (sl[0] - C[0]) * 0.6, Math.min(C[1], sl[1]) - (60 + 160 * I)];
      let pos = [v * v * C[0] + 2 * v * u * ctrl[0] + u * u * sl[0], v * v * C[1] + 2 * v * u * ctrl[1] + u * u * sl[1]];
      let sc = M.lerp(1, SMALL, a) * gather * (1 + 0.07 * look - squash);
      let rot = sl[2] * (0.4 + 0.6 * I) * a;
      // the split: strands start as thirds of each stroke side by side (together they are the stroke) and
      // part, each becoming a whole small mark: its sideways offset goes to 0 as its width becomes the mark's
      const off = lane * (1 - a) + lane * 0.6 * bump(a);
      // a hair over a third, so the three strands close up into the whole stroke with no seam at rest
      let wk = M.lerp(0.35, SMALL * 1.12, M.smoothstep(0, 1, a)) * (1 + 0.07 * look - squash);
      if (isPick && choose > 0) {
        // the chosen one comes forward on its own arc and grows back into the mark, a hair past, then settles
        const w = choose, z = 1 - w;
        const c2 = [M.lerp(sl[0], C[0], 0.5), Math.max(sl[1], C[1]) + 90 * I];
        pos = [z * z * pos[0] + 2 * z * w * c2[0] + w * w * C[0], z * z * pos[1] + 2 * z * w * c2[1] + w * w * C[1]];
        const over = 0.035 * (0.4 + 0.6 * I) * bump((win(t, 0.58, 0.34) - 0.55) / 0.45);
        sc = M.lerp(sc, 1, w) + over;
        wk = M.lerp(wk, 1, w) * (1 + over);
        rot = M.lerp(rot, 0, w);
      }
      if (fade > 0) {   // the other two drift outward and shrink as they fade
        pos = [pos[0] + (sl[0] - C[0]) * 0.25 * fade, pos[1] + 40 * fade];
        sc *= 1 - 0.25 * fade;
        wk *= 1 - 0.25 * fade;
      }
      return {
        j, z: isPick ? (choose > 0 ? 3 : 1) : 0,
        o: {
          pos, sc, rot, off, wk, alpha: 1 - fade,
          ribbon: isPick ? M.lerp(1 - 0.6 * M.smoothstep(0.03, 0.2, t), 1, choose) : 0.5 * a * (1 - fade),
          ribbonT: 0.15 * I * a * (1 - choose)
        }
      };
    });
    // at rest the three strands are the stroke: the whole mark lies under them until they part, so the
    // seams between strands never show
    const under = 1 - M.smoothstep(0.04, 0.12, t);
    if (under > 0.002) M.mark(ctx, { palette: pal, weight: p.weight, ribbon: false, alpha: under });
    // draw: the two that fade under, the chosen one on top once it is chosen
    items.sort((x, y) => x.z - y.z || x.j - y.j);
    for (const it of items) if (it.o.alpha > 0.002) copy(ctx, pal, p, it.o);
  }

  /* --- fork --------------------------------------------------------------------------------------- */
  const FB_LEN = M.length('bar'), BODY_LEN = M.length('body');
  const FIVE = M.resample(PTS.bar.slice().reverse().concat(PTS.body), 300);   // tip, corner, stem, foot, bowl
  const FIVE_LEN = FB_LEN + BODY_LEN;
  const U_CORNER = FB_LEN / FIVE_LEN;
  const U_FOOT = (FB_LEN + M.length('M 311 231 C 262 318 211 404 160 491')) / FIVE_LEN;
  // the forks: on which line, where (fraction), how the two other ways turn (radians: + = clockwise)
  const FORKS = [
    { line: 'five', u: U_CORNER, turns: [-0.95, 0.75] },   // at the corner: straight on left, or down
    { line: 'five', u: U_FOOT, turns: [-1.0, 0.9] },       // at the foot: the bowl, or two other ways
    { line: 's', u: 0.38, turns: [-0.9, 0.85] }            // in the s's spine
  ];
  const LINES = { five: FIVE, s: PTS.s };

  function forkBranch(line, u, turn, lenFrac) {
    const pts = LINES[line], n = pts.length;
    const i0 = Math.round(u * (n - 1)), i1 = Math.min(n - 1, i0 + Math.max(2, Math.round(lenFrac * (n - 1))));
    const o = pts[i0], cs = Math.cos(turn), sn = Math.sin(turn);
    const out = [];
    for (let i = i0; i <= i1; i++) {
      const x = pts[i][0] - o[0], y = pts[i][1] - o[1];
      // the turn grows along the branch, so it leaves the true line tangentially and bends away
      const f = (i - i0) / Math.max(1, i1 - i0), k = 0.35 + 0.65 * f;
      const c = Math.cos(turn * k), s = Math.sin(turn * k);
      out.push([o[0] + x * c - y * s, o[1] + x * s + y * c]);
    }
    return out;
  }

  // the colour of the true line at fraction u (the 5's line is the bar backwards, then the body)
  function colourOnLine(pal, line, u) {
    if (line === 's') return M.colourAt(pal.s, u);
    if (u < U_CORNER) return M.colourAt(pal.bar, 1 - u / U_CORNER);
    return M.colourAt(pal.body, (u - U_CORNER) / (1 - U_CORNER));
  }

  function fork(ctx, t, p, env, I, ease) {
    const pal = env.palette, k = p.weight;
    // the pen: the 5 first (tip to terminal), the s overlapping its end; speed shaped by the easing
    const pen5 = ease(M.smoothstep(0, 1, win(t, 0.03, 0.52)));
    const penS = ease(M.smoothstep(0, 1, win(t, 0.4, 0.34)));
    const pens = { five: pen5, s: penS };
    const branchLen = 0.11 + 0.13 * I;
    // the other ways: each grows from its fork as the pen passes, faint, then fades and draws back into the fork
    for (const f of FORKS) {
      const pen = pens[f.line];
      const grown = clamp01((pen - f.u) / (branchLen * 0.9));
      if (grown <= 0) continue;
      // once fully grown, the other ways fade quickly behind the pen (the choice is made by going on)
      const gone = M.smoothstep(0, 1, (pen - f.u - branchLen * 0.9) / 0.12);
      const alpha = 0.75 * (1 - gone);
      if (alpha <= 0.004) continue;
      const lenNow = branchLen * (1 - 0.6 * gone);
      for (const turn of f.turns) {
        const br = forkBranch(f.line, f.u, turn * (0.7 + 0.5 * I), lenNow);
        const width = (f.line === 's' ? M.widths.s : M.widths.body) * k * 0.5;
        M.stroke(ctx, br, { width, to: grown, colours: colourOnLine(pal, f.line, f.u + 0.04), alpha });
      }
    }
    // the ribbon follows the pen round, last
    const rib = M.smoothstep(0.55, 0.97, t);
    if (p.ribbon && rib > 0) M.ribbon(ctx, 0.1 * (1 - rib), { colours: pal.ribbon, along: ease(rib), alpha: 0.4 + 0.6 * rib });
    // the true way: the 5 as bar (tip first) then body, then the s
    const u5 = pen5 * FIVE_LEN;
    if (u5 > 0) {
      const barTo = Math.min(1, u5 / FB_LEN);
      if (u5 > FB_LEN) M.stroke(ctx, PTS.body, { width: M.widths.body * k, to: (u5 - FB_LEN) / BODY_LEN, colours: pal.body });
      M.stroke(ctx, PTS.bar, { width: M.widths.bar * k, from: 1 - barTo, to: 1, colours: pal.bar });
    }
    if (penS > 0) M.stroke(ctx, PTS.s, { width: M.widths.s * k, to: penS, colours: pal.s });
  }

  /* --- fan: three cards in a hand ------------------------------------------------------------- */
  const CARD = M.points('frame', 160);                        // the logo's own rounded square
  function cardPath(ctx) {
    ctx.beginPath(); ctx.moveTo(CARD[0][0], CARD[0][1]);
    for (let i = 1; i < CARD.length; i++) ctx.lineTo(CARD[i][0], CARD[i][1]);
    ctx.closePath();
  }
  function card(ctx, pal, p, o, look) {
    ctx.save();
    ctx.translate(o.pos[0], o.pos[1]); ctx.rotate(o.rot); ctx.scale(o.sc, o.sc); ctx.translate(-500, -500);
    if (o.paper > 0.002) {
      // its shadow on the table, then the card
      ctx.save();
      ctx.globalAlpha = o.paper * (look.dark ? 0.55 : 0.16);
      ctx.translate(14, 26); ctx.fillStyle = look.shade; cardPath(ctx); ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = o.paper;
      ctx.fillStyle = look.card; cardPath(ctx); ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = look.edge; cardPath(ctx); ctx.stroke();
      ctx.restore();
    }
    M.mark(ctx, { palette: pal, weight: p.weight, ribbon: p.ribbon, t: o.ribbonT || 0 });
    ctx.restore();
  }

  function fan(ctx, t, p, env, I, ease) {
    const pal = env.palette, pick = chosen(p, env);
    const dark = pal.theme === 'dark' ? pal.name !== 'inverse' : pal.name === 'inverse';
    const look = {
      dark,
      card: pal.name === 'paper' ? M.mix(pal.bg, '#FFFFFF', 0.16) : dark ? M.mix(pal.bg, '#FFFFFF', 0.07) : '#FFFFFF',
      edge: dark ? M.rgba('#FFFFFF', 0.1) : M.rgba(pal.ink, 0.08), shade: dark ? '#000000' : M.mix(pal.ink, '#3A2E6E', 0.5)
    };
    const spread = 0.24 + 0.22 * I;                           // radians between neighbours
    const lift = ease(M.smoothstep(0, 1, win(t, 0.02, 0.2)));      // the mark becomes a card and is picked up
    const open = ease(M.smoothstep(0, 1, win(t, 0.1, 0.28)));      // the hand fans
    const fold = ease(M.smoothstep(0, 1, win(t, 0.55, 0.26)));     // the other two fold behind the chosen card
    const back = ease(M.smoothstep(0, 1, win(t, 0.62, 0.32)));     // the chosen card is laid down and lets go of its mark
    const pickLane = pick - 1;
    const pivot = [500, 1560];
    const small = 0.6;
    const handSc = M.lerp(1, small, lift);
    const pickAngle = pickLane * spread * open * (1 - back);
    const angleOf = (j) => pickAngle + (j - 1 - pickLane) * spread * open * (1 - fold);
    const lookAt = (j) => bump((t - (0.34 + 0.065 * j)) / 0.12) * (1 - fold);
    // the hand overlaps left to right; as the choice is made the chosen card rises through to the top
    // (drawn once more over the others, fading in), and the others fold away behind it
    const rise = M.smoothstep(0.5, 0.6, t);
    const order = [0, 1, 2].concat(rise > 0.001 ? [pick + 10] : []);
    for (const jj of order) {
      const j = jj >= 10 ? jj - 10 : jj, again = jj >= 10;
      const isPick = j === pick;
      if (!isPick && open <= 0.001) continue;
      const ang = angleOf(j);
      let sc = handSc * (1 + 0.05 * lookAt(j));
      // the hand's pivot is below the cards; as the chosen card is laid down it comes back to the centre
      const ox = 500 - pivot[0], oy = (500 - pivot[1]);
      const cs = Math.cos(ang), sn = Math.sin(ang);
      let pos = [pivot[0] + (ox * cs - oy * sn) * handSc, pivot[1] + (ox * sn + oy * cs) * handSc - 520 * lift * (1 - back)];
      let paper = lift;
      if (isPick) {
        const over = 0.03 * (0.4 + 0.6 * I) * bump((win(t, 0.62, 0.32) - 0.6) / 0.4);
        sc = M.lerp(sc, 1, back) + over;
        pos = [M.lerp(pos[0], 500, back), M.lerp(pos[1], 500, back)];
        paper = lift * (1 - M.smoothstep(0.2, 0.9, back));
      } else {
        paper = lift * (1 - M.smoothstep(0.56, 0.7, t));   // gone before the chosen card leaves the hand
        if (paper <= 0.002) continue;
      }
      const o = { pos, sc, rot: ang, paper, ribbonT: 0.12 * I * open * (1 - back) };
      if (isPick && rise >= 0.999 && !again) continue;          // fully risen: only the top copy is drawn
      if (again && rise < 0.999) M.layer(ctx, { alpha: rise }, (g) => card(g, pal, p, o, look));
      else if (!isPick) M.layer(ctx, { alpha: paper / Math.max(lift, 1e-3) }, (g) => card(g, pal, p, Object.assign({}, o, { paper: Math.max(lift, 1e-3) }), look));
      else card(ctx, pal, p, o, look);
    }
  }

  Motion.register({
    id: 'three',
    name: 'Three',
    idea: 'The stroke divides into three paths that go three ways; one is chosen and the others fade (Irwin\'s three ways).',
    why: 'Every place in a set offers three, and three is not either/or: you have to decide. The mark shows the decision, and the way taken becomes the mark.',
    moments: ['set-pin', 'empty', 'tab'],
    styles: ['strands', 'fork', 'fan'],
    params: {
      duration: { default: 1100, min: 300, max: 3000, step: 50 },
      style: { default: 'strands', options: ['strands', 'fork', 'fan'] },
      choice: { default: 'seeded', options: ['seeded', 'left', 'middle', 'right', 'direction'] },
      easing: { default: 'outCubic', options: M.EASES.slice() }
    },
    reduced: 'fade',
    loop: false,

    draw(ctx, t, p, env) {
      const ease = M.easing(p.easing);
      const I = p.intensity;
      if (p.style === 'fork') fork(ctx, t, p, env, I, ease);
      else if (p.style === 'fan') fan(ctx, t, p, env, I, ease);
      else strands(ctx, t, p, env, I, ease);
    }
  });
})();
