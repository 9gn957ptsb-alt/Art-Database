# The sight, and what it aims at

The artist, 20 Oct 2026: "I want you to be able to aim at a target with a reflex sight that I can control with my
right finger while my left finger allows me to move around the area", and "And when I click with the reflex sight
up, I am able to throw something". Built over the third-person build (wf10/build), in a copy: `site/` (made by
`calc/patch.py` from the build's files, the new code in `calc/sight.js`). Every number below is in
`calc/numbers.json` (from `calc/numbers.py`), the film's colours in `calc/film.json` (`calc/film.py`), the drawing's
polygons in `calc/figure2d.json`. Screenshots in `shots/`, the sheets `shots/sheet_desk.png`, `shots/sheet_phone.png`.

## 0. The optics, first

A **reflex sight** (reflector sight) is a 1x sight: no magnification. A window of partly reflecting glass stands
before the eye; a lit mark (an LED's dot, a ring, a figure) sits at the focus of that glass, which is curved (a
spherical partial mirror) or has a collimating lens before it. The mark's light comes back off the glass as
parallel rays, so the eye sees the mark **at infinity**: it lies on the target whatever the eye's place behind
the window (parallax-free), the eye needs no set distance (unlimited eye relief: the window simply looks smaller
from further back), and both eyes stay open, the mark floating over the world. The coating reflects the mark's
own band and passes the rest, so a red-dot window looks faintly blue-green: **the glass's tint is the complement
of the mark's colour.** (A holographic weapon sight — the other 1x kind — records the reticle as a hologram in the
window instead; the game's name is that coincidence, but what is built here is the reflex kind.)

## 1. What the sight is: his head

**The head is the glass.** The sight needs a partly reflecting curved glass with the mark at its focus. His head
is the only perfect sphere in the game, and its skin is a thin film that partly reflects (pearl.glsl): its front
cap, seen from behind along the sight line, is an exact spherical partial mirror of radius R = 0.2457 m, focus
**R/2 = 0.123 m** inside it. The mark is lit there and seen through the head. Anything built of the unit (a banded
sphere, a frame of figures) would scatter it into its facets, so **only the one true sphere can be the sight**:
the position of freedom is the point you aim from. The window is the head's outline — the one outline that is
the same from every point of view, so the window keeps its shape however the camera sways.

Considered and set aside: a window on the guitar's headstock (he raises the neck as a player points it). The
headstock is 0.169 × 0.084 m; from the third-person camera, 4 m behind it, its window subtends about 1.2°, too
small to aim through on a phone; to make it usable the camera would have to stand in front of him. The head gives
one sight in all three views.

**Where the eye stands.** Raised, the camera comes to the sight line — the line through the head's centre along
the look — **SIGHT_D = φ = 1.618 m** behind the centre: the hologram's own camera distance (HOLO_D), so the head is
framed alike in every view, its outline **asin(R/φ) = 8.73°** from the centre (radius **92.6 px** on a 390 × 844
phone, **79.0 px** on a 1280 × 720 desktop: 21.9 % of the height, as the spec's hologram). The camera is kept out of
blocks with the views' own `clearTo()`; pulled in, it is nearer the glass and the window looks larger, as a real
window does; the mark does not change (it is at infinity). With a wall at his back it can come right in to the glass
(the paving shot in the city stood 0.23 m from the head's centre, inside its radius 0.246 m): then the window is the
whole view, as glass pressed to the eye is, the body is not drawn (the views' own rule for a camera in the hat's
reach), and the window is placed by the head's seat, not by the posed head of a frame that drew none (that was a
bug in the first run, the window left where he had stood before; fixed, `drawSight`).

| view | what the sight is | raised |
|---|---|---|
| third person | the head, on the body | the camera comes down from over his hat (3.2 m) to φ behind his head, over **T_VIEW = H / walk = 0.395 s** (a switch of view); the hat is doffed to his left glove in the same time; he turns to face where you aim, and the camera stops swinging round behind him; the look may go to ±1.5 rad (a lob is aimed high) |
| first person | the same | the eye backs out of the top of his head (EYE = φ) to φ behind its centre, in T_VIEW: first and third person meet in one sight view (the figure closes from one point of view); the body is drawn while it is up |
| holographic | the head, flying | the camera, already φ behind the head (HOLO_D), turns the head from AIM below the centre to the centre; the hat is on the body already (option B). Look and read only (below) |

Lowered (R again, or the Sight button), the same ease back to the view you had; in third person the pitch eases
into its range [TP_DOWN, TP_UP]. Going home as the hologram lowers it.

**The hat.** On the head the brim stands 0.1 m over the head's centre and the tilted-back brim covers the head from
behind; lifted straight up (by its own drop, 0.432 m) it filled the top quarter of the view from φ behind (tried,
`shots/smoke/1_sight.png`). So, with the sight up, he **doffs it**: the hat goes from his head to his left glove (the
form's glove_left_palm: 0.43 m to his left, 0.67 m down, 0.30 m forward), in T_VIEW, and comes back when the sight
is lowered. A gentleman's gesture, and it leaves the one sphere bare as the window.

**The glass.** Its tint is the film's own transmission, 1 − R. At normal incidence his film (d0 = 342.14 nm,
nf 1.1638 on 1.3539) reflects **R = (0.0102, 0, 0.0136)** (linear RGB; luminance 0.32 %): a violet-magenta, and the
glass passes (0.990, 1, 0.986), a green so faint it cannot be seen — a clear window, as a good sight's is. Where it
reads is its **edge**: ring q of the window meets the sphere at cos i = √(1 − q²), and the film reflects there, by
Fresnel, more and more toward grazing: magenta at the centre (0.3 %), amber at q 0.6, pale gold at 0.8, cyan-white
at 0.92, blue-white 25 % at 0.98, 86 % at the rim (`SIGHT_RIM`, from calc/film.py). So the window is drawn as the
glass sphere it is: clear in the middle, bright at its edge.

**Its frame, built of the unit:** one ring of the figure round the window, each **one of his cells tall** (φ⁻⁷ m =
0.0344 m, at the head's distance φ: 1.22°, 12.8 px phone, 10.9 px desktop), alternating upright and point-reflected
as a built sphere's band is (ARNELL 6); as many as fill the ring: **N = 2 round(π (r + h/2) / w) = 42** (w = 2h/√3).

## 2. The mark

**The figure as the reticle.** The mark is the artist's figure: the block's own model (rocket.js FIGURE, six bars)
seen down its diagonal, which is the drawing, walked per pixel as `blockMark` does. Its aim point is **the crux**:
the outline's undrawn apex, u/√3 above the drawn tip, where the two outer bars meet only from the one eye. The aim
point is not drawn — the figure hangs below it like a chevron, so the target under the crux is never covered.

**Its holding circles**, every one touching the others at the crux (ARNELL 1, wf6/levels: R = F(m+4) u/√3): the
figure's own (F = 8, level 2, the drawing) and those of the two levels it is a corner of (F = 13, 21). **The window
holds the largest turned about the crux**: the window's radius is the F = 21 circle's diameter, so the mark fits
however it turns. That sets the scale: in the focal plane (tangent units) the window's radius is
R / √(φ² − R²) = 0.1536, so **u = 0.1536 · √3 / 42 = 0.00633 (0.363°)**.

| | angle | phone 390 × 844 (dpr 2) | desktop 1280 × 720 |
|---|---|---|---|
| px per degree at the centre (f = H / 2 tan 35°) | | 10.52 | 8.97 |
| u | 0.363° | 3.82 px | 3.26 px |
| the figure's side (8 u) | 2.90° | 30.5 px | 26.1 px |
| its height | 2.51° | 26.4 px | 22.6 px |
| its bars (a tenth of a block in a figure 0.98 across) | 0.30° | 3.1 px (6.2 device px) | 2.7 px |
| crux to the drawn tip (u / √3) | 0.21° | 2.2 px | 1.9 px |
| F 8 circle: radius, foot | 1.68°, 3.35° | 17.6, 35.3 px | 15.0, 30.1 px |
| F 13 circle | 2.72°, 5.43° | 28.7, 57.3 px | 24.4, 48.9 px |
| F 21 circle (the window's radius) | 4.37°, 8.73° | 46.3, 92.6 px | 39.5, 79.0 px |

**Line weight.** The circles and every lit outline are one CSS px of white over three of the drawing's black at
0.78 (the hairline the figure page draws the white faces with): 2 device px on the phone, 1 on the desktop.

**Its light.** A reflex mark is light, so the figure is drawn in the drawing's three tones *as light*: white faces
at full, grey faces at half, black faces as the glass (left dark at 62 %, the keyline of the figure). Every line
is white over its keyline: against any colour of ground one of the two is at least **4.14 : 1** (WCAG 1.4.11 asks
3 : 1). (With a keyline of pure black the bound would be √21 = 4.58 : 1; the keyline is black at 0.78 over the
ground, as the figure page's hairline, so the floor is lower: the least over every sRGB colour, by search over a
52-step cube, is 4.14 : 1, at a grey-blue #6e7d9b — measured on every shot's ground, the least pixel is 4.14 too,
§5.) The white line against its own keyline is at least 11.7 : 1. The
film's magenta (#e100ff, luminance 0.23) was tried as the mark's colour: on sky it is 1.6 : 1, on grass and stone
under 3 : 1 — it is kept for the glass's edge, where it belongs. Measured on the grounds in §5.

**Parallax-free.** The mark is drawn at the screen's centre, which is the look's direction: it is at infinity. The
camera sways with the walk (the head bobs, `sight.head` is the posed head) and the window moves with it; the mark
stays on the target. Walking, near things slide past the mark and far ones stay under it, as through real glass.

**Closing and opening.** The figure closes into the drawing only when the aim is held still, and opens into its
beams while the finger moves: the look's turning speed ω, smoothed over T_LIFT (0.328 s: the time the hologram
takes to start and stop), turns the figure off its diagonal by **θ = ω · T_LIFT** — the angle the aim would carry in
that time — about the axis across the motion, through the crux's line of sight, to at most **35.26°** (the crux's
complement, 90° − 54.74°). Kept, because it helps: the crux never moves (the turn is about it), and the landing
mark (below) is shown only while the figure is closed (θ under 1°, fading out by 3°), so the figure tells you when
the aim is steady enough to read where the throw will come down. A flick of 0.5 rad/s opens it 9.4°; 2 rad/s, fully.

## 3. How the mark aims a throw

The throw is the throw designer's (wf11/throw, `calc/throw.json`, as of 20:53): a pearl built of the unit (R = 3
of his cells, 136 units, banded), **v = √(25 · 34) = 29.15 m/s** (its farthest throw at 45° is F(9) = 34 m), from
his right hand raised straight up (0.144 m to his right, 1.502 m up), **zeroed at REACH = 6 m**. The sight takes
those numbers (`THROW`, replaced by `CFG.throw` or `window.RocketThrow` when the throw code gives its own).

- **The zero.** The sight line runs through the head's centre; the throw leaves the hand. The hand's line is laid
  so that it crosses the sight line 6 m along it from where it passes him (his reach, measured as `pick()` measures:
  within it, what the crux is on is what he can break, and what a throw meets), with the hand's offset to his right
  kept (the heading parallel to the look), and his own walk added to the pearl (it is his hand that throws). This is
  the throw's own launch (`launchFrom` in wf11/throw/calc/throw_part.js); `sightArc()` calls that function when the
  throw's code is in, and otherwise does the same sums, so the landing mark and the pearl cannot disagree.
  Within 6 m the arc runs a little above the crux (≤ 1.4°), beyond it below.
- **Holdover: the feet of the holding circles.** A 1x sight aims straight; the arc falls. The circles hanging from
  the crux have their feet at 3.35°, 5.43°, 8.73° below it — Fibonacci in the figure's own lengths (2F u/√3 for F =
  8, 13, 21). Each foot is labelled with the range at which the throw comes down through it, computed each frame from
  the arc (so it is right for every pitch, and for the hand's offset). With the throw's numbers, standing on level
  ground (the sums in the arc's own terms, checked against the shots):

  | aim | F 8 foot (3.35°) | F 13 foot (5.43°) | F 21 foot (8.73°) | comes down on the level |
  |---|---|---|---|---|
  | level | 10 m | 12.5 m | (below the ground) | 12.6 m |
  | 10° up | 9.9 m | 12.3 m | 16.0 m | 20.6 m |
  | 20° up | 9.5 m | 11.8 m | 15.3 m | 28.2 m |
  | 45° up (the farthest throw's angle) | 7.8 m | 9.8 m | 12.6 m | 35.1 m |

  (the foot of F = 13 at level is the throw's 13 m mark to 0.1°: 5.43° against throw.json's 5.55°). The numbers move
  with the aim, which is why they are computed and written beside the feet, not engraved: a fixed ladder is wrong off
  the level (the throw designer's finding: 21 m up a 30° slope wants 18.3 m of drop, not 13.3). Put the target on
  the foot whose number is its distance; a foot with no number is one the arc does not reach before it comes down.
- **The landing mark**, exact on any ground: the arc is walked through the grid (steps of 0.01 s, as far as 4 s)
  to the first block it enters; there, on the face it crossed, the holding circle of a figure lying on that face
  (radius 0.98/√3 = 0.566 m, the block figure's own), seen at its elevation (an ellipse, minor/major = sin t), and
  "comes down 12 m". Only while the figure is closed (the aim still). Into water it marks the water's surface.
- **Click with the sight up = throw.** A tap (lifted without moving, on the up-event), a click, Enter, or the Throw
  button (shown while the sight is up, a 44 px pill: the one-pointer, keyboard way). The prototype says where it
  comes down and hands the arc to `CFG.onThrow(arc)`; the pearl itself is the throw's code.

## 4. The targets: what the crux is on

The sight looks out to the farthest throw (34 m), the ray begun where it passes him (as `pick()`), every distance
measured **from him** (from the head while it is out). On whatever the crux is on, the sight **lights its outline**
(white over black, the block's projected cube, the work's frame, his body's box) and says, under the window, as page
text (`#sight-tag`, aria-live polite, changing only when the target does): its **name**, its **distance in metres**
and whether it is in reach, **what it came from** and **the relation that put it there**, and what a tap does.

| target | name | what it came from, and the relation | with the sight up |
|---|---|---|---|
| a work | its title; artist, date; m | "One of the works he saved on Artsy, hung in (its room) by the adventure's number, at a third again its real size" (+ "you have looked behind it") | tap throws; Enter (or, as the hologram, a tap) reads its label within LOOK (9 m); looking behind stays a body act |
| a note | "A note"; m, within reach | "A clue made from what the works really are, the fewest facts that leave only one work" | throw; read it within REACH (lowered, or as the hologram) |
| a piece of the rocket | its name; m | "A piece of your rocket, put on a roof / in a park's ground / under the water / in a tree's top by the adventure's rule" | throw; break it to take it (lowered) |
| a block | its section and project (`partText`), its material; m; "within reach to break" | "A section of (the project), taken apart and put together again, in the lot of (the new form), cells of a like height gathered" — or the city's ground from its map, or the ground round the place, a metre to the block | throw; break and place stay with the sight lowered (the crosshair's job) |
| the wreck, the rocket | "Your capsule, wrecked" / "The rocket, at your capsule"; m | "Where you came down: the place's crash, the one open ground its lots leave round it" | throw; build and launch with their buttons, as now |
| his body (as the hologram) | "Your body"; m | "headless where you left it, open to harm" | Bring the body here sends it to the mark |
| water | "Water"; m | "The city's ground, from its map" / "the ground round (the place)", a metre to the block. `cast()` walks on through water (it is a surface, not a block), so the sight steps its own ray (0.05 m: half a bar of the block's figure, a bar being a tenth of the block) and stops on the first water cell: a throw comes down there | throw (it sinks, as he does) |
| nothing within 34 m | "Nothing within the throw" | "out past 34 m, the farthest throw on level ground, F(9)" | throw (it comes down where the arc does) |
| the guards | — | the game has no guards to see (they are words: "the guards walk you out"); when they are drawn they register as things (below) | |
| what may threaten his body | the thing's name; m; "coming for your body" | its own from and relation | its outline dashed; the hook: `sightThings.push({kind, name, from, relation, x, y, z, r, threat: true})`, tested as a sphere of radius r on the sight's ray; with `harmBody()` (the views' hook) it is the whole of the threat's interface |

**As the hologram** the sight looks and reads only (the missions are not done as the hologram): a tap reads the
work or the note under the mark (LOOK, REACH from the head); anything else says the views' one line ("As the
hologram you can look and read…"); there is no Throw. And it **chooses the exact spot for "Bring the body here"**:
"you can stop at any given point and choose to move Mr Pearl's body exactly there". With the sight up, the crux on
the ground within LOOK (9 m) of the head, the spot is the open cell before the block the crux meets (on top of the
ground, or before a wall), or the nearest place he fits (`freeSpot`, half-block steps out to REACH); his footprint
(the ring he stands in, radius 0.3 m) is drawn there, and G or the button sends the body to it; the head flies
home to it in one BAR (1.92 s). With the sight down, Bring works as the spec has it (to under the head).

## 5. Readability on every ground (measured)

`calc/contrast.py` on the shots (`calc/contrast.json`, `calc/contrast.md`). For each shot it takes the ground seen
round the window (an annulus 1.2 R to 1.6 R from the centre, where nothing of the sight is drawn, the words' box
left out) and, per pixel, the WCAG 2.2 contrast of the mark's white and of its keyline (black at 0.78 over that
pixel) against it. "The better" is the larger of the two for that pixel: what the mark keeps against it at least.

<!-- contrast table -->

What it shows. On the bright grounds (sky, a lit work, brick) the keyline carries the mark (4.5 to 6.7 : 1) and the
white is weak; on the dark (water and its bank, the ground under the hologram, paving) the white carries it (6 to
8.5 : 1); on every ground and every pixel one of the two is at least **4.14 : 1**, the floor the sums give for
every colour there is (§2). The white line against its own keyline never falls under 11.7 : 1. The film's magenta
would have been under 2.3 : 1 on every ground (1.0 : 1 on brick) — it stays the glass's edge. The words under the
window are page text on their own box (rgba(14, 12, 10, 0.72)): over the brightest ground the name is 6.7 : 1 and
the "from" line 4.7 : 1 (WCAG 1.4.3 asks 4.5 : 1 for text of 12 px), over the darkest 16.6 and 11.6 : 1.
(The water row's median is its bank's: the annulus round the window took more of the bank than of the water.)

The sheets, every shot beside its window at full size: `shots/sheet_phone.png` (390 × 844 at 2, the window in
device px), `shots/sheet_desk.png` (1280 × 720, the window at 2×). Each shot's state and the words the sight
gave are in `shots/<view>_<place>/log.txt`.

## 6. Controls (the two fingers), and WCAG 2.2

- **Raise / lower:** the Sight button (56 × 44 px, `aria-pressed`, above the views column: phone 326 px from the
  bottom = 176 + 144 + 6, desktop 164), or **R**. One pointer, on its click (up-event).
- **The right finger aims, the left moves:** as the views have it, the left of the phone's screen is the stick; any
  other finger drags the look. With the sight up the drag is **1 : 1 with the world** at the centre: one px of the
  finger turns the look by **1/f rad = 2 tan 35° / H** (0.00166 rad/px on the phone, 0.00195 on the desktop,
  against 0.0055 lowered): the point under the finger stays under it, the relation a 1x sight has (no magnification,
  so no gain). The controls designer (wf11/controls) owns the fingers; this is the sight's one number for them.
- **Throw:** a tap/click on the up-event, Enter, or the Throw button (44 px).
- **Read** the work under the mark: Enter (as the hologram, a tap).
- **Bring the body to the mark** (hologram): G or the button.
- Keyboard all through: W A S D walk, the arrows turn, R, Enter, G, Escape; drag has its keyboard twin (arrows).
- The words under the window are page text (aria-live polite) — the canvas mark is decoration with a text twin.

## 7. What was built (`calc/patch.py` → `site/`)

`calc/sight.js` (inserted before "what you find"): `SIGHT_D, SIGHT_F, SIGHT_TMAX, U_BLK, APEX_SY, THROW, sight,
throwSpec, raiseSight, sightCam, sightSettle, figureMark, sightArc (the throw's launchFrom, or its sums),
sightPick (with the water step), rayBox, MAT, ownMat (a model's own material by name), sightInfo, toScreen,
hull, twoTone, outlineOf, drawSight, sightAct, sightRead, bringToMark`; in patch.py `hatOff, sightDt`. Hooks:
`clampPitch` (±1.5 with the sight), `physics` (he faces the aim), `follow` (no swing), `camera` (`sightCam`),
`drawMe` (body drawn in first person with the sight; head hidden, it is the window), `drawPearl` (the hat doffed;
the posed head kept for the window), `overlay` (the crosshair gives way; `drawSight`), the tap, the drag's gain,
keys R / Enter / G, the buttons, `seatHead` (going home lowers it), `Rocket.debug()` (sight…). index.html: `#sight`,
`#sight-tag`, `#throw` (shown by its `hidden` attribute from `drawSight`, the page's `[hidden]` being `!important`),
the keys line. rocket.css: their rules; on a touch screen the words keep clear of the views column (12 px from the
left, 12 + 56 + 16 = 84 px from the right).

Scripts (calc/): `numbers.py` → numbers.json; `film.py` → film.json; `blockmark.py` (the mark's figure, open and
closed, blockmark_sheet.png); `patch.py` (build → site/); `game.js` (the harness, its own browser copy and a virtual
clock of 25 ms a frame); `scenario.js <phone|desk> <building|city|buildingextra|cityextra> <out>` (the shots);
`contrast.py` → contrast.json, contrast.md (run as `python3 -P`, so that numbers.py does not shadow the standard
module); `sheet.py` → shots/sheet_phone.png, shots/sheet_desk.png; `debug_stone.js` (the window bug).

## 8. For the artist to settle

- The head as the glass (built), or a sight on the guitar's headstock (small: about 1.2° from the third-person
  camera, so it would need the camera in front of him).
- The hat doffed to his left glove while aiming (built), or worn as the window's hood (it hides the window's top).
- The mark in the drawing's tones as light (built), or in his film's magenta (under 3 : 1 on sky, grass, stone).
- The figure opening while the aim moves (built, θ = ω · T_LIFT), or always closed.
- The landing mark (built: only while still), always, or never (holdover alone).
