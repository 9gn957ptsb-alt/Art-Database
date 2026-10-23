# 5s Motion Lab — build spec

The artist, 21 Oct 2026: "There needs to be a potent animation that's just as relevant to how people
feel about the app as how relevant a logo is to the app. Using the 5 and s characters generate me a
tool that allows me to explore all the different ways in which the animation of those characters
could fill transition moments a user experiences when using the app."

So: **the mark in motion is the app's second logo.** This tool is where the artist finds it. It is a
lab, not a showcase: every moment a person passes through in 5s, every way the 5 and the s could move
through it, played, compared, tuned, picked, and handed back so the app can use the picks.

Read `../CONCEPT.md` (the artist's words) and `../SPEC.md` (the app) first. The motion should carry
the app's ideas, not decorate them: five seconds, a five, keep and pass, the turn (transformation at
the moment you defy your own pattern), splitting into parts, three ways, negative space, collage,
growing a world.

## The mark

The logo (`../logo-source.jpg`): a heavy, slightly forward-leaning **5** in an orange gradient (yellow-
orange on the top bar, orange through the stem, red-orange in the bowl) and a lowercase **s** in red-
orange, nestled into the 5's bowl at lower right; a translucent **ribbon** of violet and blue sweeps
from the left, through the bowl of the 5 and behind the s; all inside a rounded square with a blue to
violet border on white.

**Geometry (`marks.js`).** The 5 and the s are drawn as **centerline strokes** (cubic Béziers in a
1000 × 1000 mark space, y down) with a stroke width and round caps, so they can be drawn on, morphed,
split, swept and extruded. Traced to match the logo's proportions and positions (overlay check against
the logo image), not a font's.
- `five`: two strokes, `bar` (the top bar) and `body` (stem down into the bowl, ending in the bowl's
  lower-left terminal), width ≈ the logo's.
- `s`: one stroke.
- `ribbon`: a path for the swirl, drawn as 3–5 thin translucent bands with slight offsets (violet →
  blue → lilac), so it reads like the logo's glassy ribbon.
- `digits`: `1`–`4` in the same stroke language (for the countdown family), sharing the 5's width.
- `frame`: the rounded square (corner radius as the logo's) for families that use it.
- Every path is available resampled to N evenly spaced points (`Marks.points(name, n)`), with lengths.

**Palettes** (named, from the logo and the app's tokens): `logo` (the gradients above), `keep`
(ember → flare), `pass` (cobalt), `turn` (iris; the ribbon), `ink` (one colour: the app's ink),
`paper` (one colour: paper, for marks on colour), `inverse`. Light/dark backgrounds from the app's
tokens: light paper #FAF9FC, ink #16131F; dark paper #100E18, ink #EEEBF5; ember #F28A3C (dark
#FF9B55), flare #E5482B (#FF6B4D), iris #7350EE (#A78BFF), cobalt #2F6BE0 (#6C9DFF).

## The engine (`marks.js`, a plain script, global `Marks`, frozen)

```js
Marks.W = 1000                               // mark space
Marks.paths  -> {bar, body, s, ribbon, d1, d2, d3, d4, frame}   // SVG path strings in mark space
Marks.points(name, n) -> [[x,y], …]          // resampled evenly by arc length
Marks.length(name) -> number
Marks.morph(a, b, t) -> points               // two point lists of equal n
Marks.stroke(ctx, pts, {width, from, to, colours: [stops], cap, alpha})
   // draws the polyline as a thick round-capped stroke from fraction `from` to `to` of its length,
   // coloured by a gradient ALONG the stroke (stops spread by length), so draw-on and partial
   // strokes keep the logo's gradient
Marks.ribbon(ctx, t, {phase, width, alpha, colours, along})   // the logo's ribbon, animatable
Marks.palette(name, theme) -> {five: [stops], s: [stops], ribbon: [stops], bg, ink}
Marks.ease -> {linear, inCubic, outCubic, inOutCubic, outQuint, inOutQuint, outBack(k), outElastic(k),
               spring(stiffness, damping) (a function of t in [0,1]), steps(n)}
Marks.rng(seed) -> () => [0,1)               // mulberry32 from a string or number
Marks.mix(hexA, hexB, t) -> hex
Marks.fit(ctx, w, h, pad) -> {scale, ox, oy} // places mark space in a canvas box, keeping the aspect
```

## Families (each a plain script calling `Motion.register(...)`)

```js
Motion.register({
  id: 'draw',                       // stable slug
  name: 'Draw',                     // shown in the lab
  idea: 'The 5 is drawn in one stroke, then the s, and the ribbon follows.',   // one sentence
  why: 'Arrival: the mark comes into being the way a hand would make it.',     // what it says about 5s
  moments: ['launch', 'five-start'],                                          // where it fits best
  styles: ['one-stroke', 'letter-by-letter', 'ribbon-first', 'reverse'],      // named variants
  params: {                         // every param: default, min, max, step (numbers) or options (lists)
    duration: {default: 1400, min: 300, max: 4000, step: 50},
    style:    {default: 'one-stroke', options: [...]},
    // family-specific…
  },
  reduced: 'fade',                  // what plays under prefers-reduced-motion: 'fade' | 'cut' | 'still'
  loop: false,                      // whether it is a loop (idle/waiting) or a one-shot
  draw(ctx, t, p, env) {}           // pure: draw the frame at t in [0,1]; env below
})
```
`env = {w, h, dpr, theme: 'light'|'dark', palette, bg, rng (seeded per variant: same seed, same frames),
direction: 'left'|'right' (for keep/pass), size, Marks}`. `draw` must be **deterministic** (same t, p,
env → same pixels: never Math.random or the clock) so the lab can scrub, freeze frames and compare.
Shared options every family honours: `palette`, `theme`, `ribbon` (on/off), `weight` (stroke scale
0.6–1.4), `intensity` (0–1: how big the gesture is), `easing`.

**The library (19 families, three builders; seven more added 22 Oct, 26 in all).** Each family has 2–4 styles so "Generate" has real range.

| Group | Family | The idea | Moments |
| --- | --- | --- | --- |
| Gesture & judgment | **Swipe** | the s is the swipe: the mark rides an S-curve off to the right (keep) or left (pass), leaving a trail that fades | keep, pass |
| | **Pulse** | the mark breathes: scale and gradient flow, a heartbeat for waiting | load, empty |
| | **Fill** | colour rises inside the letters like a level, from the bottom of the bowl | keep, streak, load |
| | **Negative** | the mark is cut out of a field of colour; the field slides away and leaves the hole | pass, empty |
| | **Rewind** | the last gesture plays backwards with a ghosted trail, then settles | undo |
| | **Flip** | the 5 turns in 3-D about its leaning axis; the ribbon passes through as it turns and the s is on its back: the turn, literally | turn |
| Time & structure | **Draw** | the 5 drawn in one stroke, then the s, the ribbon after | launch, five-start |
| | **Count** | 5 → 4 → 3 → 2 → 1 morphing digit to digit along the strokes, then the s lands: five seconds | five-start, load |
| | **Ring** | the bowl of the 5 opens into the five-second ring and closes; the s drops into it | five-start, load |
| | **Stack** | five cards fall into a stack that is the 5's silhouette, then fan out | five-done |
| | **Echo** | five echoes of the mark ripple out (one per card in a five), the last one solid | five-done, streak, path |
| | **Path** | the mark travels a dotted route of eight stops, lighting the next one | path |
| Decomposition & making | **Split** | the 5 breaks into its parts (bar, stem, bowl; the s; the ribbon) that fly apart as chips and return | split, bring |
| | **Collage** | the mark arrives as torn paper fragments that settle into place, slightly off-register, like the artist's collages | launch, bring, set-pin |
| | **Morph** | the 5 melts into the s through their shared bowl and back | tab, undo |
| | **Three** | the stroke divides into three paths that go three ways, one is chosen and the others fade (Irwin's three ways) | set-pin, empty, tab |
| | **Pin** | the mark drops into a frame like a picture being hung, swings and settles | set-pin |
| | **Grow** | the mark is extruded in true isometry (30°) and rises from a ground plane like a building; a seed of the s sprouts first | seed |
| | **Ribbon** | only the ribbon moves: it sweeps through the still 5 and s, tightening, in the turn's violet | turn, tab, launch |
| Added 22 Oct, from the favorites' trends (`5s/handoff/motion-brief.json`) | **Phases** | the hybrid: the mark changes form and every stage it passes through stays behind as a trace, then the traces fold back | turn, five-done, tab, undo, streak |
| | **Stamp** | a rubber stamp: it lifts toward you, slams down, ink squeezes out, the frame jolts, the print dries crisp | keep, five-done, set-pin, streak |
| | **Dive** | the view dives into the 5's bowl until it fills the screen, passes through, and the same 5s comes forward to rest | tab, launch, split, path, turn |
| | **Neon** | a neon sign: the tubes buzz, stutter and catch, light blooms across the field, the sign holds, humming | launch, load, empty, turn, five-start |
| | **Tiles** | the mark printed across a board of cards that a wave turns over until the seams close | tab, five-start, five-done, set-pin, bring |
| | **Swarm** | a flock of specks along the strokes bursts up, wheels round the frame and settles back into the 5 and the s | split, bring, launch, empty, pass |
| | **Cast** | the mark stands still like an object in a room; a light crosses over it and its long shadow sweeps round the floor (a loop) | seed, load, empty, launch, five-start |

## The moments (what a person passes through in 5s)

| id | Moment | What the person feels | Where in the app | Length |
| --- | --- | --- | --- | --- |
| launch | Opening 5s | arrival, recognition | splash | 1.2–2 s |
| load | Waiting for the deck | patience; it's alive | loading | loop |
| five-start | Today's five begins | readiness | Sort, first card | 0.6–1.2 s |
| keep | Keep | a small yes, warmth | Sort, card flies right | 0.3–0.7 s |
| pass | Pass | a light no, clean | Sort, card flies left | 0.3–0.7 s |
| undo | Undo | taking it back | Sort | 0.3–0.6 s |
| turn | A turn | surprise; transformation (the biggest moment in the app) | Sort, the reveal strip | 1–2 s |
| five-done | Five sorted | completion | Sort, the summary | 0.8–1.6 s |
| streak | Days in a row | habit, pride | Sort, the header | 0.6–1.2 s |
| split | Parts flying to Split | taking apart, curiosity | Sort → Split | 0.5–1 s |
| bring | Bringing in your own | making it yours | the Bring sheet, processing | loop or 1–2 s |
| set-pin | Pin a set | settling, making | Set | 0.6–1.2 s |
| tab | Moving between tabs | orientation | the tab bar | 0.25–0.5 s |
| path | A milestone on the Path | progress | the Path chip | 0.8–1.4 s |
| seed | Growing your ground | creation, a world | Seed | 1.5–3 s |
| empty | Nothing here yet | invitation | empty states | loop |

## The lab (`index.html` + `lab.js` + `lab.css` inlined at build)

One page, desktop-first but working at phone width (the artist will also open it on a phone).
- **Moments** (left rail; a select at phone width): the sixteen, each with its feeling in a few words
  and its current pick as a tiny live thumbnail (or "No pick yet").
- **Stage** (centre): the selected animation large, on light or dark (toggle), with **Play/Pause**,
  **Replay**, a **scrubber** (drag to any t; frame-accurate since `draw` is pure), speed (0.25×, 0.5×,
  1×, 2×), Loop, and a view switch: **Mark** (the mark alone) or **In the app** (a simple phone frame
  that stages the moment: a card flying right for keep, the reveal strip for turn, the summary row of
  five tiles for five-done, the tab bar for tab, the ground plane for seed…, drawn with plain shapes in
  the app's colours; the mark plays where it would in the app). A **Reduced motion** toggle shows what
  plays instead.
- **Family + parameters** (right panel): family select (with its idea and why), style, every param as
  a labelled slider/select with its value, palette, ribbon, weight, intensity, easing (with a small
  curve drawing), seed.
- **Explore** (a mode over the stage): a **contact sheet** of 12 variants for the selected moment, all
  playing in sync (one shared clock), from the families that fit the moment plus a few that don't
  ("Wildcards"). **Generate** draws 12 new variants (seeded: the variant's seed is shown, so any one can
  be reproduced). **All families** shows one of every family for this moment. Clicking a variant loads
  it into the stage. Each has a star.
- **Board** (a mode): every moment's current pick playing at once in a grid, labelled: the app's motion
  system at a glance; a single Play/Pause for all. Above the picks, **the pool**: every favorite playing,
  since the favorites are what 5s uses, any of them at any moment (22 Oct: "I want the animations that I
  favorite in the motions lab to be the ones used in the app"). Each loads onto the stage and can be
  unstarred there.
- **For you** (a mode, `#foryou`): the favorites read, live, and what they suggest. One pool: every
  moment's stars, de-duplicated (canonical keys), whatever moment they were starred on.
  - **The reading**: plain sentences, then chips with counts. The families and styles; the brief's nine
    descriptor axes (`5s/handoff/motion-brief.json`: space, time, change, texture, energy, rhythm,
    dimension, actor, arc) with what most of the favorites share, where they split, and the values no
    favorite has yet; intensity, palette, ribbon, weight, easing. Tempo only with its caveat: the lab fits
    each animation to the moment it was browsed on, so durations say where the artist browsed, not taste.
    It updates as stars come and go.
  - **More like your favorites** (12): each favorite retuned (its family and style, its params nudged by
    the seed, a tempo between 0.4 and 2 s), the favored families' other styles (the refined ones marked
    Refined) and the hybrid Phases, given the pool's median intensity and weight and its usual palette and
    ribbon. Ranked by affinity (per axis, the share of favorites that agree, averaged) plus how often the
    family was starred; every favored family once, then the best, at most three per family.
  - **Something different** (8): the families no favorite belongs to, furthest from the pool on the
    axes, one seeded style each, at the pool's intensity; each says which of its values are new.
  - With no favorites: it says so and offers a starter sheet of twelve families chosen to differ from one
    another on the axes (farthest first). The first star turns it into More like your favorites.
  - Every cell plays on the view's own clock (one Play/Pause), loads onto the stage, takes a star. **New
    ideas** reseeds both sheets (the seed is shown and kept). The axes and every family's values are one
    table in `lab.js` (`AXES`, `TAGS`); a family missing from it still works (halfway on every axis).
- **Pick**: "Use for <moment>" saves the current family + params + seed (+ an optional note, one line:
  "why this one") as that moment's pick. Starred variants are kept per moment for later.
- **Hand back**: **Copy spec** (JSON of every pick: moment → {family, style, params, seed, note}), and
  **Save spec** through the downloads capability (`5s-motion.json`). **Record** a clip of the stage (canvas
  captureStream + MediaRecorder, WebM) and save it through downloads; hide it where unsupported.
- **Persistence**: the picks and stars are records Claude will read back to build the motion into the
  app, so they live in the artifact's `db`: one document `motion/picks` =
  `{picks: {<moment>: {family, style, params, seed, note, at}}, stars: {<moment>: [variant…]}, v: 1}`,
  written by whoever can write (the owner: the artist); read-only for viewers who can't (say so once,
  quietly). Debounce writes; one in flight. Mirror into localStorage (try/catch) for views without
  `db`. Capabilities: `{db: {}, user: {}, downloads: true}`.

## Rules for the page (the Artifact contract, as for the app)
No doctype/html/head/body; `<title>5s Motion Lab</title>` and
`<meta name="claude:viewport-fit-sides" content="cover">` first, then `<style>`; side gutters
`max(16px, env(safe-area-inset-left/right, 0px))`; colour tokens on bare `:root` with both dark blocks;
body background from a token; `height: 100%` not `100vh`; scripts are the page's own files
(`marks.js`, `families/*.js` concatenated into `families.js` at build, `lab.js`); Google Fonts only
(Unbounded, Figtree, Martian Mono, as the app); no alert/confirm/prompt/print/`<a download>`;
localStorage in try/catch; hash views `#moments`, `#explore`, `#board`, `#foryou` as bare tokens (on its own page; mounted, views stay inside).

**Mounted in the app** (22 Oct: the lab becomes a view of 5s that only the artist sees). The same lab
renders into a shadow root on any element, without changing the standalone page:

```js
const handle = MotionLab.mount(host, { embedded: true, db, view: 'foryou' });   // db and view optional
handle.unmount();                       // or MotionLab.unmount()
```
- The host page loads `marks.js`, `families.js`, `lab-markup.js` and `lab.js` (no `#lab` on the page), and
  provides the fonts (Figtree, Unbounded, Martian Mono) and `logo.webp` beside it, as the app does.
- `lab-markup.js` (built) is `window.MotionLabMarkup = {css, html}`: lab.css with `:root` turned into
  `:host` (`html`/`body` rules into `:host, .lab`, and `:host {all: initial}` first, so the host page's
  inherited styles stop at the host) and index.html's markup without its title, metas, links and scripts.
- Every query and listener is scoped to the shadow root: no document- or window-level click, input,
  change, keydown, pointerup or hashchange listener. Keys reach the lab only while focus is inside it (the
  lab takes focus on a click anywhere in it). Views are routed inside (the mode links never touch the
  host's `location.hash`); `view` picks the first one.
- `db` is the database to keep `motion/picks` in, the same document and shape as on the lab's own page;
  without it, `claude.use('db')`. `user` and `downloads` still come from `claude.use`.
- The chrome follows the page's `data-theme` (mirrored onto the host); the stage keeps its own Light/Dark.
- `unmount()` stops the clock, the observers, the timers, the db subscription and every listener, writes
  a change still waiting to be saved, and empties the shadow root. Mounting again starts afresh.
- `window.MotionLab` keeps its read-only getters (`frames`, `draws`, `running`, `data`, `ui`, `stage`,
  `sheet`, `groups()`, `batchFor()`, `spec()`), now also `pool` and `foryou`, for whichever lab runs.

Accessibility (the site's DISPLAY.md checklist): everything that moves can be paused (one global
**Pause all** too, and nothing autoplays under prefers-reduced-motion until Play is pressed); every
canvas has a text equivalent (the family's idea and the moment); keyboard throughout (Space play/pause,
←/→ step a frame when paused, [ ] jump to start/end); visible focus; 24 px targets; contrast measured;
one polite live region ("Picked Flip for A turn").

## Files
```
5s/motion/SPEC.md        this file
5s/motion/marks.js       the mark and the engine
5s/motion/families/*.js  one file per family (or per group)
5s/motion/index.html, lab.js, lab.css
5s/motion/build.py       -> 5s/motion/dist/{index.html (css inlined), marks.js, families.js, lab.js, lab-markup.js, logo.webp}, dist/dev.html
5s/motion/test/*.cjs     Playwright checks + frame strips; embed.html + embed.smoke.cjs (the lab mounted in a host)
5s/motion/test/favorites.json  the artist's 15 favorites (22 Oct 2026), a fixture for the smoke tests
```
`marks.js` and the families are written to be lifted into the app later (no lab-specific code in them).
