# Pickleball, the playable — the brief (28 Oct 2026)

The artist, 28 Oct 2026 (verbatim):

> Let's focus all of our attention on the Pickleball mini game. It needs to be able to become a playable on YouTube,
> so understand how to make that happen and let's work towards that.
>
> The movement by Mr Pearl and his nemesis, Mr Plan, are too robotic. They need to be more moving more athletically
> than any athlete ever. I also am over the pixel aesthetic, I want the ASCII aesthetic built in. The impossible
> triangle should not be the base unit for Holographic Mr Pearl anymore, it should be what I have prescribed for the
> ASCII aesthetic

So, three things, in one new standalone game:

1. **A YouTube Playable.** The courts leave the rocket world and become their own game, `docs/worlds/pickleball/`,
   built so that a build script can package it as a Playables bundle (a zip whose root is `index.html`).
2. **Athletes.** Mr Pearl and his nemesis, now named **Mr Plan**, move like no athlete ever has: explosive, fluid,
   superhuman. Nothing slides at a constant speed; nothing swings on a fixed curve.
3. **ASCII built in, and the unit changed.** No pixels: everything on screen is characters, at every distance (no
   "picture as it is" far off, no image under the glyphs). The base unit is no longer the impossible triangle (the
   tribar glyphs and the barred block): it is what the artist prescribed for the ASCII aesthetic, Glyph Light's ASCII
   style with **one set, the keyboard's characters and the site's category marks together, sorted by the ink each
   leaves**: the keyboard's ` .:-=+*#%@` (Glyph Light's own first set) and the marks `∴∵→○◇△◎¶▢◆` (the artist, 28 Oct
   2026, offered the keyboard's instead of the marks: "Do marks and keyboard characters"; ■ is left out, it fills its
   whole cell). Sorted by ink in Chromium's fonts this comes to roughly
   `. - : ∵ ∴ → = + △ ◇ * ○ ▢ ◎ # % ◆ @ ¶`, but the order is measured at run time on each device, never hard-coded.
   (Source: the repo's CLAUDE.md, the "Glyph Light, the texture" row; `scripts/check_glyphs.js` fails a set without
   both the keyboard's characters and the marks.) Every 3D thing is drawn as plain cells or plain solids (no tribar
   bars), and the ASCII pass is the only way anything reaches the screen, but one: **Mr Pearl's head stays the one
   perfect sphere**, passed through as it is (the artist's rule 5: "His head/Holographic mode will be the only perfect
   Sphere in the game"). Words and controls are page elements over the glyphs, as everywhere.

The source to port is the courts section of `docs/worlds/rocket/rocket.js` (lines ~3666–4255 on `pearl-space-local`:
`COURT`, `courtsInit`, `courtsSim`, `nemSkill`, `matchOn`, `serveSpot`, `netH`, `shoot`, `ballStep`, `ballLands`,
`nemMeets`, `mayVolley`, `point`, `matchStep`, `serveFrom`, `levelWon`, `courtStep`, `courtCam`, `courtScope`, the
horse `horseParts`/`drawHorse`, `drawCourtsGround`, `courtOverlay`), and its README section "The courts". Mr Pearl's
body is `docs/worlds/rocket/pearl.js` (`PearlBody.build`, `pose`, `place`, the matrices, `HEAD_VS`/`HEAD_FS`) and
`docs/worlds/rocket/pearl-body.json`. The present Glyph pass is `glyphInit`/`glyphBegin`/`glyphEnd` in rocket.js
(~3200–3520). Read them; do not edit them.

## What YouTube asks (what we know, and how)

`developers.google.com` is not reachable from this session (the proxy refuses it), so the official requirement pages
were read only through search results. The SDK itself is reachable (`https://www.youtube.com/game_api/v1`, SDK
1.20261019.0100; a copy, not for the repo (it is Google's code), is at `/tmp/claude-0/-home-user-Art-Database/bb1e51d3-b72c-5e27-a28b-1a19c049dcee/scratchpad/ytsdk/game_api_v1.js`) and was read directly. From it and the search
results:

- **The SDK first.** `<script src="https://www.youtube.com/game_api/v1"></script>` must be the document's **first**
  `<script>` element, with neither `defer` nor `async`: the SDK's own `firstFrameReady()` checks exactly this
  (`document.getElementsByTagName("script")[0].src.startsWith("https://www.youtube.com/game_api/")`, no defer/async).
  The site's version does not load it (the site sends nothing to YouTube); the build adds it.
- **`ytgame.IN_PLAYABLES_ENV`** is `window !== window.parent`. Outside, the SDK is a no-op: `loadData` resolves `""`,
  `isAudioEnabled()` is true, `getLanguage()` resolves `"en"`.
- **`ytgame.game.firstFrameReady()`** once the first frame is drawn (a loading frame counts); **`gameReady()`** once
  the player can act. Both mandatory and checked. Load within about 5 s.
- **Pause:** `ytgame.system.onPause(cb)` / `onResume(cb)`: after pause the game must halt *all* execution (loop,
  rendering, timers, sound, network) until resume. The game **must not** use the Page Visibility API or similar
  browser APIs for this (requirement 3-10, as quoted). Saving on pause is recommended (3-11).
- **Audio:** `ytgame.system.isAudioEnabled()` and `onAudioEnabledChange(cb)`; sound never starts against them. (The
  game has no sound now; keep it so, or honour these if any is added.)
- **Save:** `ytgame.game.saveData(string)` / `loadData()`: under 3 MiB (the SDK throws at 3145727 bytes), recommended
  under 500 KiB. In the Playables environment this is the save; `localStorage` only outside it.
- **Score:** `ytgame.engagement.sendScore({ value })`, an integer (the SDK throws otherwise).
- **Language:** `ytgame.system.getLanguage()` (BCP-47); the game must not read the browser's language
  (`navigator.language`); English must be supported.
- **Errors:** `ytgame.health.logError()` / `logWarning()`.
- **Content Security Policy:** YouTube serves the bundle under a CSP that puts nonces on the `<script>` elements in the
  HTML file; scripts created from code need the nonce. So: every script a static `<script src>` in `index.html`, no
  inline scripts, no inline event handler attributes, no `eval`/`new Function`, no workers, no dynamically created
  `<script>`. The test suite's override CSP has `default-src 'none'`, so assume no `fetch` either: the body's spec ships
  as a script (`pearl-body.js`, `window.PEARL_BODY = {...}`) in the bundle. Styles in a `.css` file (CSSOM writes from
  code are fine).
- **Self-contained:** no external requests (no fonts, images or scripts from elsewhere, the SDK aside), no links out,
  no share prompts, no quit button, no ads, no purchases.
- **Every screen:** any aspect ratio, portrait and landscape, no orientation lock, no reliance on fullscreen; touch,
  mouse and keyboard. The Android app may first load the page in a hidden WebView with a 0×0 viewport: nothing may
  break, divide by zero or allocate a 0-size framebuffer then.
- **Sizes:** initial bundle under 15 MiB (5 MiB ideal), files under 30 MiB; ours will be well under 1 MiB.
- **Access:** Playables is invitation-only: a studio applies through the Playables interest form, is onboarded to the
  Playables Developer Portal, uploads the zip as a release, tests it with the hosted SDK Test Suite (desktop web,
  mobile web, Android, iOS) and submits it for certification; a YouTube channel enabled for Playables is needed. That
  part is the artist's; the code's part is to pass the suite.

## The files (all new; nothing in docs/worlds/rocket/ changes)

```
docs/worlds/pickleball/
  index.html        static: the canvas, the HUD's elements, <link> pickleball.css, then <script src> in this order:
                    ../rocket/pearl.js, playables.js, ascii.js, athlete.js, pickleball.js  (the build rewrites ../rocket/
                    to ./ and puts the SDK first; no inline script, no inline handlers)
  pickleball.css
  playables.js      window.PbYT     — the YouTube Playables adapter (and the fallbacks outside it)
  ascii.js          window.PbAscii  — the ASCII pass: the only way a frame reaches the screen
  athlete.js        window.PbAthlete — the athletes: superhuman movement and procedural poses on Mr Pearl's body
  pickleball.js     the game: the courts, the rules, Mr Plan, the views, the input, the HUD, the save, the loop
  README.md
scripts/build_pickleball.js   node, no dependencies: --playable <outdir> (folder + zip, SDK first) and
                              --artifact <file.html> (one self-contained HTML, everything inlined, no SDK)
notes/holographic-mr-pearl/harness/pb_*.js    Playwright tests (require('playwright'); Chromium is installed)
```

The site serves `docs/` at `http://127.0.0.1:8817/` (already running: `python3 serve_utf8.py 8817 docs`; do not stop
it; never kill processes by name — other sessions run browsers here). The game is at
`http://127.0.0.1:8817/worlds/pickleball/`.

Code style: match rocket.js — plain ES5-ish browser JS in an IIFE, `var`, short helpers, comments that say *why*,
the artist's words quoted where they set a rule, no build step, no dependencies. WebGL2.

## Module contracts

### `playables.js` → `window.PbYT`

```
PbYT.inYT                 bool: window.ytgame && ytgame.IN_PLAYABLES_ENV
PbYT.init()               Promise: resolves when the language is known (PbYT.lang, default "en"); never rejects
PbYT.firstFrame()         ytgame.game.firstFrameReady() once (no-op outside / when absent)
PbYT.ready()              ytgame.game.gameReady() once, and only after firstFrame()
PbYT.onPause(fn) / onResume(fn)   in YT: ytgame.system.onPause/onResume. Outside: nothing (no Page Visibility API —
                          rAF already stops in a hidden tab). PbYT.paused (bool) kept current.
PbYT.audio()              bool (isAudioEnabled; true outside); PbYT.onAudio(fn)
PbYT.load()               Promise<object|null>: loadData() parsed as JSON in YT; outside, localStorage[key] (try/catch,
                          null when blocked); never rejects
PbYT.save(obj)            Promise: JSON; refuses (warns) over 3 MiB, warns over 500 KiB; in YT saveData only,
                          outside localStorage only; coalesces calls closer than 1 s (the last wins)
PbYT.score(n)             sendScore({value: Math.floor(n)}) when n is a safe non-negative integer greater than the
                          last sent; no-op outside
PbYT.error(e) / warn(e)   ytgame.health.logError/logWarning (and console); window error and unhandledrejection hooked
PbYT.KEY                  "pickleball-save-v1"
```
Plus `scripts/build_pickleball.js` (as above; the zip written with node's `zlib.deflateRawSync` and a minimal zip
writer, CRC32 computed; every file at the zip's root; `pearl-body.js` generated from the JSON) and a test
`notes/holographic-mr-pearl/harness/pb_playables.js` that: builds the playable into a temp dir, checks the SDK is the
first script without defer/async, no inline script or `on*=` attribute, no `eval(`/`new Function` in any file; serves
the built folder and loads it top-level in Chromium with the **real** SDK (www.youtube.com is reachable) and with a
**mock** `ytgame` in an iframe (`IN_PLAYABLES_ENV` true) that records calls: firstFrameReady before gameReady, each
once; onPause halts the game loop (no rAF callbacks run, the game's clock does not advance) until onResume; save →
load round-trips; sendScore gets integers; no request leaves for any host but 127.0.0.1 and www.youtube.com; a 0×0
viewport then a resize does not throw. (The mock is how the game is tested until the hosted Test Suite can be
reached.)

### `ascii.js` → `window.PbAscii`

```
var A = PbAscii.create(gl, opts)   opts: { set, s0: 6, d0: 3.2, minPx, maxPx: 40, dprCap: 2, tone: {...}, glow: {...} }
A.ok                    false if the framebuffer cannot be made (the caller then draws straight to the screen)
A.begin(w, h)           binds the scene framebuffer (colour RGBA8 + depth texture, resized as needed, never 0-size),
                        sets the viewport; the caller draws the scene into it
A.end(w, h, cam)        cam: { near, far, t }; draws the frame as characters to the default framebuffer
A.glyphs                the set as sorted (for tests); A.inkOf(ch)
A.dispose()
```
- **The set** is the prescription above, every character measured for ink at start (drawn white on black into a
  64 px cell in `700 52px ui-monospace, SFMono-Regular, Menlo, 'DejaVu Sans Mono', monospace`, summed) and sorted,
  the blank first. Atlas: one row, 64 px a glyph, mipmapped.
- **A cell per glyph, its size by distance** (the artist's own rule from the rocket world: 6 CSS px at 3.2 m, as the
  square of nearness: a thing twice as near in glyphs four times as large), clamped to `[minPx, maxPx]` CSS px — 5 on
  a phone (the shorter side under 600 CSS px), 6 otherwise — and quantised to octaves of device pixels as rocket.js
  does (`cs = 2^L`). **Never** the picture itself: below the minimum the minimum holds. The sky (depth 1) is glyphed
  at the minimum size too.
- **Each cell:** its colour the scene's mean over the cell (the colour texture's mip at the cell's level, sampled at
  the cell's centre); its lightness through the tone (exposure, contrast, midtones/gamma; defaults tuned to the
  courts' night palette: legible dark ground, lines and figures bright); its glyph from the set by that lightness; lit
  in its own colour lifted by `0.55 + 0.45 l` as Glyph Light lifts it; a glow over a threshold (the colour's mip a
  couple of levels coarser, added lighter, as Glyph Light lays its blur); between the glyphs black (no image under).
- **Pass-through:** a scene pixel with alpha in (0.25, 0.75) is copied as it is: Mr Pearl's head (its shader writes
  alpha 0.5 when `uMark` is 1). Everything else writes alpha 1.
- Test `pb_ascii.js`: a page that draws a few lit boxes, a sphere marked 0.5 and a sky into the pass; checks the sorted
  set contains every keyboard character and every mark; the glyph sizes near and far; no pixel of the output is a
  smooth gradient (counts distinct colours per cell / checks each cell is glyph-on-black); the marked sphere passes
  through; resize to 0×0 and back without error; under 4 ms a frame at 390×844 dpr 2 in software GL is not required,
  but report the time.

### `athlete.js` → `window.PbAthlete`

Built on `PearlBody.build(spec)` (`body`): parts `pelvis, torso, arm_right, arm_left, guitar, hat, thigh_right,
shin_right, thigh_left, shin_left`, joints `pelvis, spine, hip_*, knee_*, shoulder_*, head` (`body.joints[n].at`,
metres, his frame: y up, he faces −z, +x his right), `body.cell`, `body.walk.L_m` (his leg, 0.6256 m), `body.head`
(centre, radius), `body.throwArm.palm` (his right glove's palm). A part's cells go to his frame by
`T(org) · S(cell)` (pearl.js `rest`); pearl.js `pose` shows the conventions (`RX(a>0)` swings a leg forward; the knee
bends by `RX(-k)` about the knee; the spine's twist is `RY` about the spine; `about(R, p)` turns about a point).

```
var a = PbAthlete.create(body, { x, z, yaw, caps })   yaw: the way he faces, 0 = −z (towards the far side)
PbAthlete.CAPS            the superhuman envelope (below)
PbAthlete.drive(a, want)  want: { vel: [vx, vz] }  (the player's stick: wanted velocity, m/s)
                               or { to: [x, z], by: seconds }   (Mr Plan and the stand-ins: be there by then)
                               plus face: yaw | null (where the chest should turn; null = the net)
PbAthlete.split(a)        a split-step now (the opponent is striking): a hop that lands wide and low, ready
PbAthlete.reachable(a, c) c = { t, p: [x, y, z] }: can his paddle meet p in t seconds? → { ok, move, slack }
PbAthlete.swing(a, c)     c = { t, p, kind: 'serve'|'dink'|'drive'|'volley'|'overhead'|'dig'|null } — schedules the
                          stroke (and the run, lunge, dive or leap it needs) so that **the paddle's face is at p at
                          time t**; returns the move it chose, or null if it cannot
PbAthlete.celebrate(a, k) after a point: 'won' | 'lost'
PbAthlete.update(a, dt)   integrates everything (call once a frame after drive/swing/split)
PbAthlete.world(a)        → { parts: { name: mat4 (cells → world) }, paddle: mat4 (the hat's cells → world),
                              paddleC: [x,y,z] (the face's centre), paddleN: [x,y,z] (its normal),
                              headC: [x,y,z], headM: mat3 (columns his right, up, back: the head's frame for HEAD_FS),
                              feet: [[x,y,z],[x,y,z]], skid: 0..1 (for dust), air: bool }
```
- **The hat is the paddle** (the artist, 27 Oct 2026: "using Mr Pearl's hat as his racket"), held now in his right
  glove at `body.throwArm.palm`, its crown along the forearm, its brim's round the paddle's face; his head bare.
- **The envelope (superhuman, and every number says why):** top speed 13 m/s (Usain Bolt's measured peak, Berlin
  2009, was about 12.4 m/s: "more athletically than any athlete ever"), though on a 13.4 m court it is the start that
  shows: acceleration 30 m/s² (an elite sprinter's first steps are ~8–10), so 6 m/s in a fifth of a second;
  braking 42 m/s², and above 6 m/s a stop is a skid on a planted outside foot (`skid` → dust);
  a split-step of 0.16 m in 0.2 s; standing reach of the paddle 1.05 m round his axis; a lunge to 2.1 m; a **dive** to
  3.8 m (launched flat at ~10 m/s, landed on the forearm, a roll — one full turn about his forward line — and up
  ready inside 0.9 s); a **leap** to 1.6 m of vertical (paddle to ~3.9 m), a scissor kick in the air, landed low;
  a **pirouette** (a 360° turn on one foot) when a recovery reverses direction at speed. The game decides what is in
  reach (`reachable`), the athlete makes it look inevitable.
- **Never robotic:** every position is a spring or a ballistic flight, never a lerp at constant speed. Lean into
  acceleration (to ~25° fore-aft, ~20° sideways), crouch with braking and readiness, stride length and cadence from
  speed (phase from distance, as the walk: feet never slide), knees high at speed, arms pumping against the legs,
  shuffle (side-steps, hips square to the net) under ~5 m/s sideways and crossover running past it, overlapping
  motion (arms, guitar and head lag a frame or two behind the chest and settle), anticipation before every stroke
  (wind-up: the chest coils, the paddle goes back, the weight drops), contact at the scheduled time, follow-through
  across the body, then the recovery hop back to ready. Ready is alive: weight on the balls of the feet, a small
  bounce, paddle up in front.
- **Strokes:** serve (underhand, below the waist, upward arc — the rule); dink (soft, knees deep, a short push);
  drive (full turn of the hips and chest, the paddle swept across); volley (a punch, little backswing); overhead (a
  leap, the arm whipped over the top, scissor kick, landed low); dig (a low scoop, one knee almost to the ground);
  forehand or backhand by the side the ball is on. Mr Plan uses the same body with every colour turned over (his
  negative, as the nemesis was).
- **Celebrations:** won → a standing backflip (one full turn about his right–left axis, 1.1 m high), lost → a short
  shake of the head and a bounce back to ready.
- Test `pb_athlete.js`: in node (pearl.js and the JSON are plain JS) — physics: no frame moves him more than
  vmax·dt + ε; speed never over vmax outside a dive; from rest to 6 m/s in under 0.22 s and to 12 m/s in under 0.5 s; a split-step lands back on
  the ground; `swing` puts `paddleC` within 0.12 m of p at time t for every move (reach, lunge, dive, leap, dig) on a
  grid of contact points; `reachable` agrees with `swing`; no NaN in any matrix over 60 s of random driving; and a
  Playwright page that draws him (plain shaded cells, no ASCII) through a montage of moves to PNGs for the eye
  (`notes/holographic-mr-pearl/pickleball/frames/`).

### `pickleball.js` (the game; built after the three above)

- **The courts as they were:** ten pickleball courts side by side (20 × 44 ft, the kitchen 7 ft, the net 34/36 in),
  ten levels, first to three, he serves every point (underhand, across, past the kitchen), the two-bounce rule, no
  volleys from the kitchen, the ring where Mr Plan's shot will land, the rally counted and the longest kept; a level
  won plays on by itself (his stand-in against that court's Mr Plan) and gives its tool to the Trojan horse, which
  rises a part at a time beyond the courts; a match lost there stops the court and its tool, to be played again a
  level up. **Mr Plan** wherever the old text said "the nemesis".
- **Athletes everywhere:** Mr Pearl driven by the stick through `PbAthlete.drive({vel})`; his strokes automatic: when
  Mr Plan's shot is coming, the game predicts the contact (the ball stepped ahead, as `nemMeets`) and, if
  `reachable`, schedules `swing` at the best point (after the bounce, or on the volley where the rules allow), the
  lunge, dive or leap included when it is needed — the player's job is to be near, to aim (the view's way, as now)
  and to serve. Mr Plan: reaction time, errors and placement by level (nemSkill re-tuned: his body is superhuman at
  every level; what grows is how soon he reads the ball, how rarely he misses and how cruelly he places it). A
  split-step for each when the other strikes. The stand-ins on the courts that play on are athletes too (cheaper:
  fewer updates far off).
- **The views:** the third person behind his head (rocket.js's `TP_HEAD`, `AIM`, `REST`, its `thirdDistance`) on a
  critically damped spring so his explosiveness reads (the camera lags a little, never jerks), and the Scope (his
  head the glass, his nose the aim) — its mark now drawn in characters (no tribar figure: the unit changed).
- **ASCII:** the scene (court, nets, posts, the horse, the figures as their cells, the ball, Mr Plan's head as a ball
  of cells) drawn plainly shaded into `PbAscii.begin`, Mr Pearl's perfect head with `HEAD_FS` and `uMark` 1, then
  `PbAscii.end`. A night court under floodlights (glyphs glow best on dark), the court's own colours (blue inside,
  green out, white lines, the kitchen its own tone). Dust from skids, a few bright characters.
- **Input:** left half of a touch screen the stick (wanted velocity), right half drag turns the view (aim), a tap
  serves; Serve and Scope buttons; WASD/arrows, mouse drag to turn, click/Space/T/Enter to serve, R or right button
  for the Scope.
- **Playables:** `PbYT.init()` → build the body → draw a first frame → `firstFrame()` → `ready()`; `onPause` stops
  the loop (cancel the rAF, freeze the clocks: the courts' simulation does not catch up), saves; `onResume` restarts
  with the clock re-based; the save (courts, horse, longest rally) through `PbYT.save` at every level won or lost and
  on pause; `PbYT.score(longest rally)`; strings in one table, English; `PbYT.lang` read, never `navigator.language`.
- **HUD:** the header line (court, level, score "you 0 – 0 Mr Plan", rally, longest), the ten squares, the horse line
  and its tools; messages as `say()` did. Page elements, not glyphed.

## Order of work

1. The three modules in parallel (one small workflow), each with its own test. 2. pickleball.js + index.html +
README by one builder. 3. A review workflow (Playables compliance; the athletes; the rules port; the ASCII pass).
4. Final testing by the session itself (screenshots on a phone and a desk, the harness), then the commit, the site,
the WIP branch and the Artifact.

## As built (28 Oct 2026)

The artist then said "Work light": the three modules and the game were written by the session itself as sections of
one file, `docs/worlds/pickleball/pickleball.js` (YouTube; the athletes; the ASCII pass; the scene; the courts; the
views and the hands; the loop), with `index.html`, `pickleball.css`, `README.md` and `scripts/build_pickleball.js`;
no helpers, no review workflow. Tests: `harness/pb_game.js` (phone, desk), `harness/pb_playables.js`,
`harness/pb_moves.js`.
