# The sight and the throw: what to build (wf15 spec, 21 Oct 2026)

The artist, 20 Oct 2026: "I want you to be able to aim at a target with a reflex sight that I can control with my
right finger while my left finger allows me to move around the area", and "And when I click with the reflex sight
up, I am able to throw something".

Built over the game as it is at commit 3068c876 (rocket.js md5 7f16cc17…, pearl.js 9f796a6d…): third person only,
one Holo button, the guitar smash, the stick as a touch on water, the buttons of play acting on a touch's press. The
earlier designs (wf11/sight SIGHT.md, wf11/throw THROW.md, wf11/controls NOTES.md and calc/controls.js) were made
over an older copy with first person; section 4 says what of them holds and what changes. Every number here is in
`calc/numbers.json` (from `calc/numbers.js`), the arm's raise checked in `calc/raise.js`, `calc/path.js` and
`calc/try_pose.js` (the pose code of 5.1, run on a copy of pearl.js, `calc/pearl_try.js`). All under
`/tmp/claude-0/-home-user/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf15/spec/`.

---

## 0. In one paragraph

**Sight** (a button of play over Holo, acting on a touch's press so the right thumb can press it while the left is
on the stick; `R`; the right mouse button, held for as long as it is held or clicked to leave it up) raises the
sight in the time a switch of view takes: the camera comes down from over his hat to φ behind his head's centre on
the line of the look, so his head is at the middle of the view and **his head is the glass**: its outline is the
window (8.73° its half), clear in the middle and bright at its edge, the head itself not drawn while it is the glass;
**the figure is the mark**, its crux at the screen's centre, its three holding circles hanging from the crux, their
feet the holdover marks, each labelled with the range the throw comes down through it; a ring on the ground where it
lands, when the aim is still; under the glass, in words, what the mark is on. He doffs his hat into his left glove,
raises his right arm with a pearl in the glove, and faces the mark; the left thumb's water stick walks him as before,
sideways too, and the camera no longer swings round behind him. The right thumb's drag aims, one pixel of the
finger moving the mark one pixel over the far world; held still on a point for a beat, that point comes to the mark;
the arrows turn it on a computer. **A tap or a click anywhere, `T` or `Enter`, throws** THROW.md's pearl (R = 3 of his
cells, 29.15 m/s, farthest 34 m = F(9) on level ground) from his raised glove, zeroed at his reach and heading for
what the mark is on; it bounces, rests, sinks, and says what it struck; five in his glove, back when he walks into
one or taps it with the sight lowered, all five when he comes to. One a beat; a tap before the arm is back up is
kept. With the sight down the tap smashes, as now; raising the sight lets a swing go. The hologram has no sight and
no throw (barred, as breaking is). Under reduced motion the sight comes up at once, the figure stays closed and the
ring is always shown.

---

## 1. The rules it answers to (CLAUDE.md, "Holographic Mr Pearl — what the game is for")

- "THIS IS ABOUT DETERMINED RELATIONS": every size, time, speed and place below is the relation that sets it.
- "the head is that position": the one perfect sphere, the one thing not determined by the information, where the
  relations cross. A reflex sight needs a partly reflecting curved glass with the mark at its focus; the head is the
  only exact sphere and its film partly reflects (pearl.glsl), so the head is the only thing that can be the glass,
  and you aim from the position of freedom (SIGHT.md §1). The mark is the figure, and its aim point is the crux, "the
  one point the figure closes from".
- The missions are not done as the hologram: no sight, no throw as the hologram (as breaking is barred).
- "Anything tapped says what it came from and the relation that put it there": what the mark is on says so under the
  glass, and what a pearl strikes says so when it strikes.
- Third person only; first person is gone as an option (his eyes only in the films, on a stone, where you woke). The
  sight's view is not his eyes: it stands φ behind his head and sees his back and his raised arm.
- WCAG 2.2 at A and AA (docs/v2/DISPLAY.md): a one-pointer way for every drag, targets of 24 px and more (44 where
  there is room), keyboard all through, status as live text, reduced motion respected.

---

## 2. The decisions

### 2.1 Raising and lowering

**On a phone: the Sight button**, `#v-sight`, a `.vw` pill (56 × 44 px, as Holo) at the top of the views column,
directly over Holo (6 px between them), `aria-pressed`, wired with `press()` so it acts on the touch's press: a phone
makes no click of a tap while another finger is down, so this is the one way the right thumb can raise it while the
left is on the stick (the artist's "while my left finger allows me to move around"). One tap raises it, one lowers it.

Why not a hold of the right thumb: a hold is the start of every slow drag, so it would fight the look-drag; the tap
is the throw ("when I click with the reflex sight up"), so a hold-to-raise would leave the throw to a second finger
of the same hand; and a held thumb cannot rest. Why not a two-finger gesture: WCAG 2.5.1. Why not a second Throw
button: the whole view is the throw's target already, and a tap on it is the artist's own "click".

**On a computer: `R`** (Raise; free in the game's keys; both earlier designs chose it), the button, and **the right
mouse button**: pressed, the sight comes up; let go after a beat or more (BEAT = 0.48 s) it goes down (held, it is
up while held, as a shooter's aim is); let go within a beat it stays up (a click), and the next right click lowers
it (wf11/controls' rule). The right button no longer places a block (it did, as `act(…, l.button === 2)`; neither the
README nor the keys line say so); placing stays with Place (`E`/`Q`, 1–5, the Place button) and its left click.
`Escape` also lowers it (DISPLAY.md: "out (Escape)").

As the hologram: the Sight button steps back (`display: none`, as the Break/Place bar does), and `R`, `T` and the
right button say `barred()`. Going out as the hologram with the sight up lowers it at once first.

It never fights the right thumb: the button is a DOM element (its touch never reaches the canvas), the drag and the
tap are the canvas's, Holo is another element.

### 2.2 What is seen with the sight up

**SIGHT.md's design holds, but not with the camera where third person keeps it.** At REST the third-person camera
stands 2.92 m behind him and 2.70 m up (1 m over his hat), 3.21 m from his head; his head sits 11.4° below the
screen's centre, its outline 4.4° across its half. The line through the screen's centre passes over his hat, so his
head cannot be the glass from there. So **the camera comes to the sight line**:

- **Where:** on the line through the head's seat (`seat()`: P.y + headY over his feet, not the walk's bob) along the
  look (`lookDir(P.yaw, P.pitch)`), **SIGHT_D = HOLO_D = φ = 1.618 m behind it**: the hologram's own camera distance,
  which is the height of the head's top (headY + headR = 1.3724 + 0.2457 = 1.6180 m). Aimed level, the camera is at
  his head's height, 1.618 m behind its centre. Kept out of blocks with `clearTo()`, let out no faster than he
  walks (as `thirdCam`); pressed in by a wall at his back it comes into the glass (the window then fills the view,
  as glass at the eye does; nearer than HAT_REACH + R_C the body is not drawn, the views' own rule).
- **How it blends:** as the views do here: `blend = { from: camLast, t0: now, dur: T_VIEW, pitchFrom: P.pitch,
  pitchTo: null }` and `camD = 1e9`, T_VIEW = PEARL.top / WALK = 0.395 s (a switch of view: the time he walks his own
  height). The pitch is kept on the way up (the look is the aim). Lowered: the same blend back to `thirdCam`, with
  `pitchTo: clampV(P.pitch, TP_DOWN, TP_UP)` (as `seatHead` does). Under reduced motion no blend: a cut.
- **The glass:** the head is drawn until the raise is half done; from half way the window is drawn in its place
  (SIGHT.md's: the head's outline seen from the camera, its film's edge, `SIGHT_RIM`; the frame of 42 figures one of
  his cells tall), its alpha `smooth((e − 1/2) / (1/2))` over the second half, over a disc of the head's median
  colour (#b9aca9, the covers', HEAD_EXPO's) fading out as the window comes in: the head clears into glass. Lowered,
  the head is drawn again at once.
- **The window** is placed round the posed head (`sight.head`, set in `drawPearl` from `M.head`), so it sways with
  the walk's bob while the mark stays still (parallax-free, as through real glass); where the body was not drawn
  this frame (the camera in the glass), round the seat.
- **The hat**, whose brim tilts back over the glass seen from behind (SIGHT.md), is doffed: in T_VIEW it goes from his
  head to his left glove, held by its right brim's edge, so it hangs clear of him on his left: in his frame
  **HAT_DOFF = glove_left_palm − (the hat's box centre + its half-width to his right) = (−0.827, −0.646, −0.355) m**
  (from the form: glove (−0.431, 0.801, −0.303), hat box centre (0, 1.447, 0.052), half-width 0.396). Off a phone held
  upright (17.9° across its half) it is out of the view; a computer sees it low on the left.
- **His right arm is raised** (2.5, 5.1): the upper arm level out to his right, the forearm upright, a pearl in the
  glove: **the pearl's centre at (0.385, 1.416, −0.034) m in his frame**, 13.1° right of the mark and 1.5° over it from
  the camera (x ≈ 336 px of 390 on a phone, 760 of 1280 on a computer): beside the glass, never on it.
- **His body** fills the foot of the view under the glass (his shoulders 12.6° below the mark); the HUD's marks are
  drawn over it, so a landing ring behind his shoulders still shows.
- **He faces the mark**, turning to it at TURN (half round in the time he walks his own height), and **the camera
  does not swing round behind him** (`follow()` is off while the sight is up): the camera is the aim.
- **How far the look goes:** ±1.5 rad with the sight up (as from his eyes and as the hologram: a lob is aimed high;
  the farthest throw is aimed 39.5° up), against [TP_DOWN, TP_UP] = [−70.1°, +5.1°] in third person.
- **A stone of the homage and where you woke** give his own eyes in third person; with the sight up the sight's
  camera stands instead (the stone's check in `camera()` is off while the sight is up); lowered there, his eyes again.

### 2.3 The mark, and where it sits

SIGHT.md §2, unchanged: the figure (the block's own model, `FIGURE`, seen down its diagonal, walked per pixel as
`blockMark` is) drawn as light (white faces full, grey faces half, black faces as the glass at 62 %), its aim point
**the crux, at the screen's centre (W/2, H/2)**, the figure hanging below it like a chevron so the target under the
crux is never covered. From the crux hang the holding circles F = 8, 13, 21 (ARNELL 1: every one touching the others
at the crux); the window's radius is the F = 21 circle's diameter, which sets the scale: u = tan(8.73°) · √3 / 42 =
0.363°. Every line is one CSS px of white over three of black at 0.78 (the floor against any colour is 4.14 : 1,
WCAG 1.4.11's 3 : 1 met). The figure opens off its diagonal by θ = ω · T_LIFT (at most 35.26°, the crux's
complement) while the aim turns, and closes when it is still; the landing ring shows only while it is closed.

**The holdover marks are the circles' feet** (3.35°, 5.43°, 8.73° below the crux), each labelled with the range at
which the throw's arc comes down through it, worked out every third frame from the arc the pearl will take (so right
on any slope and for any pitch). A foot with no number is one the arc does not reach before it lands.

**The landing ring:** where the arc first touches (stepped exactly as the pearl steps, `predict()`), a ring of the
block figure's holding circle (0.98 / √3 = 0.566 m) lying on the face it touches, and "comes down 12 m".

**Under the glass, in words** (`#sight-tag`, page text, aria-live polite, changed only when the target does): what
the crux is on, out to the farthest throw: its name, how far from him, what it came from and the relation that put it
there (SIGHT.md §4's table, less his body and the hooks), and what a tap does ("Tap to throw"; on a computer "Click,
T or Enter to throw"; with none in the glove, "No pearl in your hand: walk to one, or tap it with the sight
lowered").

### 2.4 How the right finger aims; the left thumb meanwhile

- **The drag, finer:** one px of the finger turns the look by **1/f = 2 tan 35° / H** rad (0.00166 on a phone 844 px
  high, 0.00195 on a computer 720 high), against 0.0055 lowered: the finger moves the mark one pixel over the far
  world (the mark is at infinity, as a reflex sight's is: a 1x sight magnifies nothing, so it takes no gain). The
  direction is the game's own (a drag right turns the aim right). SIGHT.md wrote "the point under the finger stays
  under it"; in this game's drag the world moves against the finger, so the true statement is this one.
- **Held still for a beat on a point** (no movement past the drag's 8 px, BEAT = 0.48 s; a tap is under 450 ms, so the
  two never meet), **that point comes to the mark** in T_VIEW (eased; at once under reduced motion): the look is
  turned so the line through the head's centre passes what the ray through the point meets (out to 34 m), so it is
  under the crux at any distance. This is the way to aim that does not drag (WCAG 2.5.7), and it fits the site's own
  "a tap on a point to go there". A drag, the arrows or a new hold stop it.
- **The arrows on a computer** with the sight up turn the aim (← → yaw, ↑ ↓ pitch, no longer walking: W and S walk) at
  **2 asin(R/φ) / BEAT = 0.635 rad/s**: the mark crosses its own window in a beat.
- **The left thumb:** nothing changes. The stick's zone (the left 40 % and lower 55 %, REACH 40 px), the water drawn
  in `overlay()`, his walk at WALK relative to the aim's yaw: forward walks toward the mark, sideways strafes (he
  faces the mark, his legs walk). A tap of the left thumb in the zone is the stick's, never a throw.

### 2.5 The throw

- **A tap or a click with the sight up throws** (on the up-event, unmoved past 8 px, within 450 ms: the canvas's own
  tap), as do `T` and `Enter` (while nothing else has the focus). **The smash is the tap with the sight down; the
  throw is the tap with it up**; Place's tap is also a throw while it is up. On a phone the tap's point does not matter
  (the throw goes where the mark is), as on a computer the click's does not.
- **What:** THROW.md's pearl: a sphere built of the unit, R = F(4) = 3 of his cells (φ⁻⁷ m: 0.1033 m), 136 cells in
  six bands (12 24 32 32 24 12), each band one of his jacket's film tints; never the perfect sphere (that is his head
  alone, 2.38 times as large).
- **From:** his raised right glove: the palm's centre and one pearl radius on along the forearm, (0.385, 1.416, −0.034)
  m in his frame standing (it rides the walk: 8 cm of bob). THROW.md assumed the arm straight up from the shoulder
  (0.144 m right, 1.502 m up); his arm is bent 81° at the elbow and cannot straighten, so the throwing pose is the
  cocked one, the hand beside his head.
- **How fast, how far:** v = √(g · F(9)) = √(25 · 34) = 29.155 m/s, the game's gravity 25 m/s², no air; its farthest
  throw at 45° on level ground is F(9) = 34 m (35.3 m from his hand's height, aimed 39.5° up, launched 43.6°).
- **The arc:** the lower arc that comes level with the sight's line at **the zero, REACH = 6 m along the line from
  where it passes him** (as `pick()` measures: within it, what the crux is on is what the pearl meets); its heading
  **converges on what the crux is on** (the point on the line at the hit's distance; on nothing, at the farthest
  throw's), so it comes down on the mark's upright: his hand stands 0.385 m right of the line, and THROW.md's parallel
  heading would put every pearl 0.385 m right of the mark at every distance. His own walk is added (his hand throws).
  Backspin a turn a beat (2π / BEAT); a trail of the last beat of its path in the jacket's #b7a8a0 at half opacity
  fading back.
- **Standing on level ground** (calc/numbers.js, the arc in closed form):

  | aim | the crux on | launched | lands | F 8 foot | F 13 foot | F 21 foot |
  |---|---|---|---|---|---|---|
  | level | a target 13 m off | 4.64° | 12.6 m | 10.4 m | — (the ground first) | — |
  | 10° up | a target 21 m off | 14.74° | 20.8 m | 10.2 m | 12.7 m | 16.5 m |
  | 20° up | nothing | 24.68° | 28.4 m | 9.8 m | 12.2 m | 15.7 m |
  | 39.5° up (the farthest) | nothing | 43.61° | 35.3 m | | | |
  | 45° up | nothing | 48.84° | 34.8 m | 8.1 m | 10.1 m | 12.9 m |
  | 10° down | the ground 8 m off | −5.58° | 6.7 m | — | — | — |

  The lateral miss at the target's distance is 0 standing (his walk's sideways speed carries it off by that speed
  times the flight).
- **Through the grid, bounce, rest, water:** THROW.md §2 as built (`sphereHit`, `stepPearl`): the first block the
  pearl's surface touches, stepped on its exact parabola in steps of at most √(8 · 0.1 h / g) = 0.0332 s and R / 2 of
  travel, the touch found by 16 halvings; the velocity's normal part mirrored and the whole halved (e = 1/2, the
  Average of a perfect bounce and a dead stop); at rest on a floor when the rebound would rise under one cell
  (vₙ · e < √(2 g h) = 1.312 m/s); a block broken under it lets it fall again; in water it sinks as he does (6 m/s²,
  at most 2.5 m/s) and lies on the bottom; the place's sides and the bedrock are walls, the sky open.
- **What it does where it lands** (THROW.md §3, its words): where it first touches it says what it struck, from any
  distance; it takes nothing, breaks nothing, places nothing and looks behind nothing. A work: "Your pearl struck
  *Title* (Artist, date), 13 m off. Within 9 m you can read its label and look behind it." (never a look, never a
  wrong look: the alarms do not stir). A piece lying as a block: it rings, the piece is marked and the arrow at the
  top points to marked pieces first: "Your pearl rang on a piece of your rocket: the fuel tank, 11 m off, 6 m up. Take
  it by hand." A block: "Your pearl struck (its section and project, or the ground's own name), 12 m off." Water:
  "Your pearl sinks, 9 m off: swim down to it." Coming to rest on a note: "Your pearl lies on a note, 7 m off: go and
  read it."
- **How many:** five, one for each finger of the throwing glove (his right glove's four and the thumb). "Pearls 4 of 5"
  (page text in the header, aria-live polite) while the sight is up or any pearl is out. **Back** when he walks into
  one where it lies (his body's box, 0.3 m round and 1.8 m tall, touches it: "A pearl back in your hand: 5 of 5."), or
  when it is tapped with the sight lowered within his reach (6 m, measured as `pick()` measures; the pearl's target is
  its diameter doubled, 0.41 m, so on a phone it is at least 27 px across at the edge of his reach seen from the
  third-person camera, 9.1 m off: WCAG 2.5.8; on a computer the click acts at the crosshair, not the pointer);
  never by itself. He comes to again (put out by the guards, or a new adventure) with all five and none lying about.
  None in the glove: "No pearl in your hand: pick one up again where it lies (walk to it, or tap it with the sight
  lowered)." Pearls are not kept in the save.
- **The rate, and the arm:** **one a beat** (the smash's one block a beat). It leaves the hand at once on the tap when
  the arm is up (the raise done) and a beat has passed since the last; otherwise the tap is kept (the latest only)
  and thrown when both are so (the aim then is the aim at the release), as a tap during a swing is kept. After a
  throw the raised arm **flings**: turned about the shoulder line (the axis `act.arms` uses) by −COIL = −π/2 (the
  forearm down to the fore, as the smash's quarter turn) over half a beat with the smash's follow-through easing
  q(2 − q), and back over half a beat (smooth); the next pearl is in the glove from the half beat. Under reduced
  motion there is no fling (the rate stays).

### 2.6 The smash, the throw, and a swing when the sight goes up

The tap is one act with two meanings: the sight down, the guitar smash (or Place); the sight up, the throw. **Raising
the sight lets a swing go** (`letGo()`: nothing struck, nothing kept, the arms to rest in half a beat), as the head
leaving does: his hands leave the guitar's swing to raise a pearl, and the block tapped is not broken. The raise and
the let-go's return run together (pose() composes them). Lowering the sight during a fling: the arm comes down from
where it is. A smash tapped while the arm is still coming down swings as usual (the right arm's raise eases out
under it).

### 2.7 The hologram

The hologram has no hands: no sight, no throw, no pick-up (barred, as breaking is). `barred()` becomes: "As the
hologram you can look and read. To take, build, break or throw, leave the hologram (Holo, or H): your body follows
your head." Its Sight button steps back (CSS, as the bar does); `R`, `T`, the right button say `barred()`. Pearls in
flight and lying stay as they are while the head is out.

### 2.8 The films, the launch, the guards

No sight before you have come to, nor after the launch (`sightOn()` is false in both). `lieDown()` (the wake-up, the
guards) and `launch()` lower it at once; `lieDown()` gives back all five pearls. No guards are drawn; a strike on a work
is never a wrong look (THROW.md's proposal for drawn guards is left for later).

### 2.9 WCAG 2.2 (DISPLAY.md)

- **2.5.1, 2.5.7:** the drag has a one-pointer way that does not drag: the hold of a beat on a point. The raise is one
  tap (a button, a key, a click); the throw is one tap anywhere. No gesture needs two fingers; the left thumb is never
  needed to aim or throw. (The site's house rule asks for a one-tap way; the hold is one pointer and no drag, which is
  what 2.5.7 asks; the one-tap alternative is in section 7.)
- **2.5.2:** the throw is on the up-event (slide off past 8 px and nothing is thrown); the Sight button acts on the
  press, as every button of play here does (the reason is press()'s), and pressed again undoes it.
- **2.5.8:** Sight is 56 × 44 px; a lying pearl's tap target is at least 27 px on a phone within reach; nothing new
  is under 24 px.
- **2.1.1, 2.1.2:** R, T, Enter, the arrows, Escape; nothing traps.
- **2.4.7, 4.1.2:** Sight is a button with `aria-pressed`, the `.vw` focus ring.
- **4.1.3, 1.1.1:** the canvas's mark and window are decoration with text twins: `#sight-tag` (aria-live polite), the
  toasts (role status), "Pearls n of 5" (aria-live polite).
- **1.4.3, 1.4.11:** the mark's lines and labels are white over a black keyline (4.14 : 1 floor over any colour, the
  white against its own keyline 11.7 : 1); the tag's text on rgba(14, 12, 10, 0.72), 4.7 : 1 over the brightest
  ground measured (SIGHT.md §5).
- **2.3.3 (reduced motion, `stillMotion`):** the raise and lowering are a cut (no blend; the arm and the hat at once),
  the hold's turn at once, the figure never opens (θ = 0) and so the landing ring is always shown, no fling; the
  pearl's flight and trail (the information) stay.

---

## 3. The numbers, and their relations

| | value | relation |
|---|---|---|
| SIGHT_D | φ = 1.618 m | HOLO_D: the hologram's camera distance, the head top's height (1.3724 + 0.2457) |
| the window's half-angle | asin(R / φ) = 8.732° (tan 0.1536) | the head's outline seen from SIGHT_D |
| the window's radius | 92.6 px (phone 844 high), 42.8 px (phone on its side, 390 high), 79.0 px (computer 720 high) | f · tan, f = H / 2 tan 35° |
| u | 0.363° | the F 21 circle's diameter is the window's radius: tan · √3 / 42 |
| the feet | 3.349°, 5.432°, 8.732° | 2 F u / √3, F = 8, 13, 21 |
| the figure's side | 2.90° | 8 u |
| θ, its most | ω · T_LIFT, 35.26° | the aim's carry in the time the hologram takes to start and stop; the crux's complement |
| the frame | 42 figures, one cell (φ⁻⁷ m) tall at the head's distance | 2 round(π (r + h/2) / w), w = 2h/√3 |
| T_VIEW | 0.395 s | PEARL.top / WALK: a switch of view (the raise, the hat, the arm, the hold's turn) |
| the drag | 1/f: 0.00166 rad/px (phone), 0.00195 (computer) | one px of the finger moves the mark one px over the far world |
| the hold | BEAT = 0.48 s still within 8 px | a beat of the theme song; the tap's own window is 450 ms |
| the arrows | 2 asin(R/φ) / BEAT = 0.635 rad/s | the mark crosses its own window in a beat |
| the pitch | ±1.5 rad | as from his eyes and as the hologram |
| a1, a2 | 74.52°, 128.22° | the upper arm level out to his right; the forearm as upright as its 81° bend lets it |
| the pearl in the glove | (0.385, 1.416, −0.034) m | the palm's centre and one pearl radius on along the forearm, raised |
| the arm's least gap to the head | 4.9 cm | over the raise, the fling and the walk (no cell enters the head's sphere) |
| the fling | −π/2 out in BEAT/2, back in BEAT/2 | the smash's quarter turn (COIL), its follow-through's easing |
| the rate | one a beat | the smash's one block a beat |
| HAT_DOFF | (−0.827, −0.646, −0.355) m | its right brim's edge into his left glove |
| V | 29.155 m/s | √(g F(9)): the farthest 45° throw on level ground is 34 m |
| ZERO | 6 m | REACH |
| the heading | to what the crux is on | his hand's 0.385 m to the right, closed at the target |
| R, units | 0.1033 m, 136 | F(4) = 3 of his cells |
| CARRY | 5 | the throwing glove's four fingers and thumb |
| e | 1/2 | the Average of a perfect bounce and a dead stop |
| rest | vₙ e < 1.312 m/s | √(2 g h): under a cell's hop |
| water | 6 m/s², ≤ 2.5 m/s | his own sinking |
| spin, trail | 2π / BEAT, BEAT | a turn a beat; the last beat |
| sub-step | ≤ 0.0332 s and R/2 of travel | the chord within a bar of the unit; never past a block |
| the landing ring | 0.566 m | 0.98 / √3, the block figure's holding circle |

Frames at the harness's 25 ms: T_VIEW is 16 frames (15 = 375 ms, 16 = 400 ms), BEAT 20 frames (19 = 475 ms), a tap
lifted within 17 frames.

---

## 4. What holds from the earlier designs, and what changes

**SIGHT.md** holds: the head is the glass, the figure is the mark, the crux at the centre, the circles and their feet
labelled from the arc, the figure opening as the aim turns, the landing ring, the window's film edge and frame, the
hat doffed to the left glove, the camera φ behind the head, the words under the glass, the contrast. Changes: no
first-person row (gone); the camera comes from the third-person place (2.92 m back, 2.70 m up) to the sight line;
the head clears into glass over the raise's second half (it popped at the blend's end); the hat is held by its brim's
edge (centred on the glove it went through the guitar and his left side); **no sight as the hologram** (SIGHT.md had
the hologram look and read through it and bring the body to the mark; the hologram has no sight now, and Holo
already brings the body under the head); no Throw pill (a tap anywhere throws; `T`/`Enter` are the keys'); the drag's
statement corrected (2.4); the arc is the pearl's own `predict()` (its `sightArc` stepped 0.01 s and stopped at the
first non-air cell, a point, not a ball); no `sightThings` hook and no `rayBox` (nothing threatens his body yet;
`harmBody` stays the views' hook); the work's relation says its true size when its wall made it smaller.

**THROW.md** holds: the pearl, its speed and the game's gravity, the zero at REACH, the stepping through the grid, the
bounce, the rest, the water, what it says where it lands, five carried, the pick-up by walking or tapping, the arrow
to marked pieces, no throw as the hologram, the frame-rate independence. Changes: **the hand** is the posed glove,
cocked beside his head (0.385 m right, 1.416 m up), read from the pose (`pearl.js` `act.right`), not straight up from
the shoulder; **the heading converges on what the crux is on** (parallel would be 0.385 m right of the mark at every
distance); **the holdover marks are SIGHT.md's labelled feet**, not the stand-in's 8 / 13 / 21 m ladder (its 21 m
mark is 13.7° below the crux, outside the 8.73° glass, and a fixed ladder is wrong off the level, as THROW.md found);
one a beat with the latest tap kept, and the arm's fling; the "no hands" line folded into `barred()`.

**wf11/controls** (unfinished): taken: scheme A (the mark at the centre, where the head's glass is), the right mouse
button's hold-or-click rule, the drag at 1/f raised, the arrows' pitch with the sight up, a synthetic pointer
tolerated by `setPointerCapture`. Not taken: scheme B (the mark under the finger), the floating stick and its home
ring (the stick is the water now), pointer lock, the look pad (‹ › ˄ ˅: four more buttons where the artist asked for
subtlety; the hold does its work), the aim assist's friction and hold, Jump on release, a 64 px Throw button.

---

## 5. The code

The new code goes in **one section of rocket.js**, after the smash's (after `drawShards()`, before
`/* ---- Mr Pearl drawn: …`), headed `/* ---- the sight: his head, the one true sphere, as a reflex sight; and the
pearls he throws ----`, its header comment SIGHT.md's (sight.js lines 1–20) rewritten for third person (the camera
comes from over his hat to φ behind the head; the hat is doffed) and opened with the artist's two sentences and the
date. Match the code around it: `var`, function declarations, the house's comment density, every number its relation
in a comment, each change commented with the artist's words and the date (20 Oct 2026 for the sight and the throw).
Paths: SIGHT_JS = `/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf11/sight/calc/sight.js`,
THROW_JS = `…/wf11/throw/calc/throw_part.js` (same root).

### 5.1 pearl.js

1. The header comment (lines 7–9): `act` is `{ arms, twist, right, fling }`: right, 0 to 1, the right arm raised to
   throw (the sight); fling, that arm about the shoulder line after it.
2. In `build()`, before `return { hatReach: …`, the throwing arm, and `throwArm: throwArm,` added to the returned
   object (this exact code was run on a copy, `calc/pearl_try.js`, by `calc/try_pose.js`: a1 74.518°, a2 128.217°, the
   pearl raised at (0.38536, 1.41552, −0.03399)):

   ```js
    // The right arm raised to throw (the sight; the artist, 20 Oct 2026: "And when I click with the reflex sight up, I
    // am able to throw something"): turned about the right shoulder, first about his forward line until the upper arm
    // is level, out to his right (a1), then about the upper arm's own line until the forearm stands as upright as its
    // bend lets it (a2: the elbow is bent 81 deg, so it leans 9 deg out). The palm's centre and the forearm's way are
    // kept for the pearl the glove holds. From the form: the upper arm's ends and the forearm's.
    var Pm = {}, throwArm = null;
    prims.forEach(function (pr) { Pm[pr.part] = pr; });
    if (Pm.upper_arm_right && Pm.forearm_right && Pm.glove_right_palm && joints.shoulder_right) {
      var sh = joints.shoulder_right.at, el = toGame(Pm.upper_arm_right.b), wr = toGame(Pm.forearm_right.b), turn = function (v, ax, a) {
        var m = RA(ax, a); return [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]; };
      var u0 = sub(el, sh), a1 = -Math.atan2(u0[1], u0[0]), u1 = turn(u0, [0, 0, 1], a1), f1 = turn(sub(wr, el), [0, 0, 1], a1), ul = len(u1), fo = sub(wr, el), fl = len(fo);
      u1 = [u1[0] / ul, u1[1] / ul, u1[2] / ul];
      var a2 = Math.atan2(u1[2] * f1[0] - u1[0] * f1[2], f1[1] - u1[1] * dot(u1, f1));
      throwArm = { a1: a1, a2: a2, u0: u0, palm: toGame(Pm.glove_right_palm.c), fore: [fo[0] / fl, fo[1] / fl, fo[2] / fl] };
    }
   ```
   (a2 in closed form: the forearm's height after the turn about the level upper arm u1 is A cos a + B sin a + C with
   A = f1·y − u1·y (u1 · f1), B = (u1 × f1)·y, highest at atan2(B, A).)
3. In `pose()`, before `var M = {};`:

   ```js
    // act.right, 0 to 1: the right arm raised to throw (body.throwArm), both its turns taken that far; act.fling, the
    // raised arm about the shoulder line after it (+ lifts the front, as act.arms; the follow-through is -).
    var right = null, TA = body.throwArm;
    if (act && TA && (act.right || act.fling)) {
      var sR2 = J.shoulder_right.at, sL2 = J.shoulder_left.at, k = act.right || 0, R1 = RA([0, 0, 1], TA.a1 * k);
      var u1 = [R1[0] * TA.u0[0] + R1[4] * TA.u0[1] + R1[8] * TA.u0[2], R1[1] * TA.u0[0] + R1[5] * TA.u0[1] + R1[9] * TA.u0[2], R1[2] * TA.u0[0] + R1[6] * TA.u0[1] + R1[10] * TA.u0[2]];
      right = about(mmul(RA(u1, TA.a2 * k), R1), sR2);
      if (act.fling) { right = mmul(about(RA([sR2[0] - sL2[0], sR2[1] - sL2[1], sR2[2] - sL2[2]], act.fling), sR2), right); }
    }
   ```
   and in the parts' loop, before the `else if (arms && (p.name === "arm_right" || …` line:

   ```js
      else if (right && p.name === "arm_right") { m = mmul(twist, arms ? mmul(arms, mmul(right, m)) : mmul(right, m)); }
   ```
   The guitar stays with the left glove and the torso (the left hand frets it); with `act.arms` (a smash let go,
   returning) the raised arm turns with both arms too.
4. The comment over `pose` in "the walk" (the act paragraph) gains a sentence for right and fling.

### 5.2 rocket.js

**New state and constants** (in the new section):

```js
  var SIGHT_D = HOLO_D;          // the sight's camera behind the head's centre, on the look: the hologram's, the head top's height (phi)
  var SIGHT_F = [8, 13, 21];     // the holding circles: F(m+4) for levels 2, 3, 4 (ARNELL 1)
  var SIGHT_TMAX = Math.PI / 2 - Math.acos(1 / Math.sqrt(3));   // the most the figure opens: 35.26 deg, the crux's complement
  var U_BLK = 0.12244, APEX_SY = 0.45775;                        // the block model's drawing: u (block units), the apex above its centre
  var SIGHT_RIM = [ …SIGHT_JS lines 30–31, unchanged… ];
  var THROW = { V: Math.sqrt(25 * 34), G: 25, ZERO: REACH, FAR: 34, CARRY: 5, RU: 3, E: 0.5, SPIN: 2 * Math.PI / BEAT, TRAIL: BEAT, SINK: 2.5, SINK_G: 6 };
  // (each with THROW_JS lines 8–16's comment; FAR: the farthest throw, F(9), what the sight looks out to)
  var HOLD = null, HOLD_AT = [0.38536, 1.41552, -0.03399];       // the pearl in his raised glove: in the arm's cells; in his frame (throwFrom)
  var HAT_DOFF = [-0.82669, -0.64551, -0.35489];                 // the hat doffed: its right brim's edge into his left glove (throwFrom)
  var sight = { up: false, t0: -1e9, told: false, hold: null, omega: 0, mx: 0, my: 1, lastYaw: 0, lastPitch: 0, theta: 0, hit: null,
                arc: null, head: null, inHand: null, said: "", ring: null, thrown: -1e9, next: false, turn: null, flingHold: null, rmb: null, last: 0 };
  var figCache = {}, pearls = [], carried = THROW.CARRY, marked = {}, pearlCh = null, trailProg = null, TU = {}, trailBuf = null, trailVao = null;
  var NO_PEARL = "No pearl in your hand: pick one up again where it lies (walk to it, or tap it with the sight lowered).";
```

**Functions** (new, in the section, in this order):

| function | source | what to do |
|---|---|---|
| `sightOn()` | SIGHT_JS 33 | `return sight.up && !intro && !launched && !Hd;` |
| `sightEase(now)` | new | the raise's progress for the arm, the hat and the glass: `var s = sight.hold != null ? sight.hold : stillMotion.matches ? 1 : smooth((now - sight.t0) / 1000 / T_VIEW); return sight.up ? s : 1 - s;` |
| `flingAt(now)` | new | `var u = sight.flingHold != null ? sight.flingHold : (now - sight.thrown) / 1000 / BEAT; if (stillMotion.matches \|\| u < 0 \|\| u >= 1) { return 0; } if (u < 0.5) { var q = u / 0.5; return -COIL * q * (2 - q); } return -COIL * (1 - smooth((u - 0.5) / 0.5));` |
| `actNow(now)` | new | the pose's act: `var a = swingPose(), r = sightEase(now), f = flingAt(now); if (!a && !r && !f) { return null; } return { arms: a ? a.arms : 0, twist: a ? a.twist : 0, right: r, fling: f };` |
| `sightTan()`, `sightU()` | SIGHT_JS 35–36 | verbatim |
| `raiseSight(on)` | SIGHT_JS 37–46, rewritten | below |
| `dropSight()` | new | at once (the head leaving, coming to, the launch): `if (!sight.up) { return; } sight.up = false; sight.t0 = -1e9; sight.next = false; sight.turn = null; delete document.body.dataset.sight; $("v-sight").setAttribute("aria-pressed", "false"); drawCarry();` |
| `sightPress()`, `sightRelease()` | wf11/controls rmbDown/rmbUp | below |
| `sightCam(dt)` | SIGHT_JS 48–53 | below |
| `sightAimAt(x, y)` | new | below (the hold) |
| `sightReady(now)` | new | `return sightOn() && sightEase(now) >= 1 && now - sight.thrown >= BEAT * 1000;` |
| `throwAt()` | new | below |
| `sightStep(dt, now)` | new | below |
| `sightSettle(dt)` | SIGHT_JS 56–64 | verbatim, but `sight.theta = stillMotion.matches ? 0 : min(SIGHT_TMAX, sight.omega * T_LIFT);` |
| `figureMark(px, theta, mx, my)` | SIGHT_JS 68–117 | verbatim |
| `sightPick()` | SIGHT_JS 158–182 | drop lines 169–180 (his body as the hologram; `sightThings`), use `THROW.FAR` for `T.far`, return `hit` |
| `MAT`, `ownMat(b)` | SIGHT_JS 192–195, 199 | verbatim |
| `sightInfo(hit)` | SIGHT_JS 200–219 | drop the body and thing lines (203–204); the none line's 34 from `THROW.FAR`; a work's `rel`: `p.scale < 1 ? "at " + round(p.scale * 400 / 3) + " % of its real size, the most its wall leaves room for" : "at a third again its real size"`; before the wreck line, a block of the homage: `var hl = window.Homage && homage ? Homage.label(homage, hit.x, hit.y, hit.z) : ""; if (hl) { return { kind: "block", name: hl, sub: m, from: "The homage where you woke", rel: "three figures set across the turn you make on waking" }; }` |
| `toScreen`, `hull` | SIGHT_JS 221–234 | verbatim |
| `twoTone` | SIGHT_JS 237–241 | verbatim; its comment's "4.6 : 1" to "4.14 : 1" (SIGHT.md §2's measure) |
| `outlineOf(hit, W, H)` | SIGHT_JS 242–257 | drop the body and thing lines (252–253) |
| `drawSight(c, W, H, now)` | SIGHT_JS 260–370 | below |
| `unitH`, `pearlR`, `pearlGrid`, `initThrow` | THROW_JS 23–24, 34–57 | verbatim |
| `throwFrom(body, spec)` | new (replaces THROW_JS `armFrom`) | below |
| `handAt()` | THROW_JS 59–62, rewritten | below |
| `launchFrom(e, d, tHit)` | THROW_JS 66–80, rewritten | below |
| `throwPearl(now)` | THROW_JS 81–91, rewritten | below |
| `sphereHit`, `stepPearl`, `stepPearls`, `takeBack`, `struck`, `STUFF`, `rested` | THROW_JS 94–191 | verbatim (`takeBack` also calls `drawCarry()`, as it does) |
| `takeTapped(dir, tMax)` | THROW_JS 193–203 | only a pearl nearer than what the tap meets: `t < (tMax == null ? 1e9 : tMax)` |
| `drawPearls(now)` | THROW_JS 207–239 | below |
| `predict()` | THROW_JS 241–245, rewritten | below |
| `drawCarry()` | THROW_JS 280–283 | `el.textContent = "Pearls " + carried + " of " + THROW.CARRY; el.hidden = !sight.up && !pearls.length;` |

Not taken from THROW_JS: `ARM`, `armFrom`, `sightUp`, `fallMark`, `noHandsSaid`, `LADDER`, the stand-in `drawSight`,
`setSight`, `throwDebug` (its hooks go into `Rocket.debug`). Not taken from SIGHT_JS: `throwSpec`, `sightArc`,
`sightThings`, `rayBox`, `sightAct`, `sightRead`, `bringToMark`, and the patch's `sightDt` (the overlay's clock is
`sight.last`).

```js
  // Raise (true), lower (false) or turn over (nothing): a switch of view, in its time, as the views' are (none under
  // reduced motion). The hologram has no sight (barred, as breaking is). Raised, a swing is let go: his hands leave the
  // guitar's swing to raise a pearl.
  function raiseSight(on) {
    if (on == null) { on = !sight.up; }
    if (on === sight.up || intro || launched || !place) { return; }
    if (on && Hd) { barred(); return; }
    var now = performance.now(), still = stillMotion.matches;
    if (on) { letGo(); P.want = null; }
    // turned over part way, the arm and the hat go back from where they are (smooth(1 - u) = 1 - smooth(u))
    var u0 = clampV((now - sight.t0) / 1000 / T_VIEW, 0, 1);
    sight.up = on; sight.t0 = now - (1 - u0) * T_VIEW * 1000; sight.next = false; sight.turn = null; sight.arc = null; sight.said = "";
    sight.lastYaw = P.yaw; sight.lastPitch = P.pitch; sight.omega = 0; sight.theta = 0;
    camD = 1e9;
    blend = still ? null : { from: camLast, t0: now, dur: T_VIEW, pitchFrom: P.pitch, pitchTo: on ? null : clampV(P.pitch, TP_DOWN, TP_UP) };
    if (still && !on) { P.pitch = clampV(P.pitch, TP_DOWN, TP_UP); }
    if (on) { document.body.dataset.sight = "true"; } else { delete document.body.dataset.sight; }
    $("v-sight").setAttribute("aria-pressed", String(on));
    if (on && !sight.told) { sight.told = true; say(touchy ? "The sight: your head is the glass. Drag to aim, or hold a point to bring it to the mark; tap to throw a pearl." : "The sight: your head is the glass. Drag or the arrows aim; a click, T or Enter throws a pearl.", true); }
    drawCarry();
  }
  // The right mouse button: pressed, the sight comes up; let go after a beat or more it goes down (held, it is up
  // while held); let go within a beat it stays up (a click), and the next click lowers it.
  function sightPress() { if (Hd) { barred(); return; } sight.rmb = { t: performance.now(), was: sight.up }; if (!sight.up) { raiseSight(true); } }
  function sightRelease() { var r = sight.rmb; sight.rmb = null; if (r && (r.was || performance.now() - r.t >= BEAT * 1000)) { raiseSight(false); } }
  // The sight's camera: on the line through the head's seat along the look, SIGHT_D behind it, kept out of blocks
  // and let out no faster than he walks, as third person's is.
  function sightCam(dt) {
    var c = seat(), d = lookDir(P.yaw, P.pitch), u = [-d[0], -d[1], -d[2]];
    camD = min(clearTo(c, u, SIGHT_D), camD + WALK * dt);
    return { e: [c[0] + u[0] * camD, max(1 + R_C, c[1] + u[1] * camD), c[2] + u[2] * camD], yaw: P.yaw, pitch: P.pitch, from: c };
  }
  // Held still on a point for a beat (the way to aim that does not drag, WCAG 2.5.7): that point comes to the mark in
  // the time of a switch of view. The point is what the ray through it meets, out to the farthest throw; the look is
  // turned so that the line through the head's centre passes it, so it is under the crux at any distance.
  function sightAimAt(x, y) {
    if (!sightOn() || !vp) { return; }
    var d = dirAt(x, y), at = reachFrom(), t0 = max(0, (at[0] - eye[0]) * d[0] + (at[1] - eye[1]) * d[1] + (at[2] - eye[2]) * d[2]);
    var hit = cast(d, t0 + THROW.FAR, eye, t0), t = hit ? hit.t : t0 + THROW.FAR, Q = [eye[0] + d[0] * t, eye[1] + d[1] * t, eye[2] + d[2] * t];
    var c = seat(), v = [Q[0] - c[0], Q[1] - c[1], Q[2] - c[2]], L = hypot(v[0], v[1], v[2]);
    if (L < 0.5) { return; }
    var yaw = Math.atan2(v[0], -v[2]), pitch = clampPitch(Math.asin(clampV(v[1] / L, -1, 1)));
    sight.turn = { t0: performance.now(), from: [P.yaw, P.pitch], by: [angle(yaw - P.yaw), pitch - P.pitch] };
  }
  // A tap, a click, T or Enter with the sight up: the throw, at once if his arm is up and a beat has passed since the
  // last, else kept (the latest only) until it has, as a tap during a swing is kept.
  function throwAt() {
    if (Hd) { barred(); return false; }
    if (!sightOn()) { return false; }
    if (carried <= 0) { say(NO_PEARL); return false; }
    var now = performance.now();
    if (sightReady(now)) { return throwPearl(now); }
    sight.next = true;
    return true;
  }
  // Each frame, after the swing's: a hold come to a beat, the hold's turn, a kept throw when the arm is up.
  function sightStep(dt, now) {
    holdTick(now);
    var tr = sight.turn;
    if (tr) {
      var u = stillMotion.matches ? 1 : smooth((now - tr.t0) / 1000 / T_VIEW);
      P.yaw = tr.from[0] + tr.by[0] * u; P.pitch = clampPitch(tr.from[1] + tr.by[1] * u);
      if (u >= 1) { sight.turn = null; }
    }
    if (sight.next && sightReady(now)) { sight.next = false; throwPearl(now); }
  }
  // From his form when it has come: where the pearl sits in his raised glove (the palm's centre and one pearl radius
  // on along the forearm: body.throwArm), in the arm's own cells and in his frame raised; and where the doffed hat goes
  // (its right brim's edge, the hat's half-width to his right of its middle, into his left glove's palm).
  function throwFrom(body, spec) {
    var PB = window.PearlBody, part = function (n) { return body.parts.filter(function (p) { return p.name === n && !p.empty; })[0]; };
    var arm = part("arm_right"), hat = part("hat"), ta = body.throwArm, h = body.cell, r = THROW.RU * h;
    HOLD = null;
    if (arm && ta) {
      var q = [ta.palm[0] + ta.fore[0] * r, ta.palm[1] + ta.fore[1] * r, ta.palm[2] + ta.fore[2] * r];
      HOLD = [(q[0] - arm.org[0]) / h, (q[1] - arm.org[1]) / h, (q[2] - arm.org[2]) / h];
      HOLD_AT = apply(PB.pose(body, 0, 0, { right: 1 }).arm_right, HOLD);
    }
    var gl = null; ((spec.form || {}).primitives || []).forEach(function (p) { if (p.part === "glove_left_palm") { gl = PB.toGame(p.c); } });
    if (hat && gl) {
      var lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
      hat.blocks.forEach(function (b) { for (var k = 0; k < 3; k += 1) { var v = hat.org[k] + (b[k] + 0.5) * h; lo[k] = min(lo[k], v); hi[k] = max(hi[k], v); } });
      HAT_DOFF = [gl[0] - hi[0], gl[1] - (lo[1] + hi[1]) / 2, gl[2] - (lo[2] + hi[2]) / 2];
    }
  }
  // Where the pearl leaves: in his raised glove (the arm up, no fling), his walk's bob and turn as they are now.
  function handAt() {
    if (!me3 || !HOLD) { var c = Math.cos(P.face), s = Math.sin(P.face); return [P.x + HOLD_AT[0] * c - HOLD_AT[2] * s, P.y + HOLD_AT[1], P.z + HOLD_AT[0] * s + HOLD_AT[2] * c]; }
    var PB = window.PearlBody, body = me3.body, M = PB.pose(body, PB.phaseStep(body, 0, P.walked), P.amount, { right: 1 });
    return apply(PB.place(M.arm_right, P.x, P.y, P.z, P.face), HOLD);
  }
  // The launch: from his raised glove, at the pearl's one speed, on the lower arc that comes level with the sight's
  // line at the zero (ZERO from where the line passes him, as pick() measures), heading for what the mark is on (the
  // point on the line at tHit; at the farthest throw on nothing) so that it comes down on the mark's upright: his
  // glove stands 0.39 m right of the line (the arm cocked beside his head), and a heading kept parallel would put
  // every pearl that far right of the mark. His own walk with it: it is his hand that throws.
  function launchFrom(e, d, tHit) {
    var H = handAt(), at = reachFrom(), t0 = max(0, (at[0] - e[0]) * d[0] + (at[1] - e[1]) * d[1] + (at[2] - e[2]) * d[2]);
    var A = [e[0] + d[0] * (t0 + THROW.ZERO), e[1] + d[1] * (t0 + THROW.ZERO), e[2] + d[2] * (t0 + THROW.ZERO)];
    var tt = tHit != null ? tHit : t0 + THROW.FAR, T = [e[0] + d[0] * tt, e[2] + d[2] * tt];
    var hx = T[0] - H[0], hz = T[1] - H[2], hl = hypot(hx, hz), ux = hl > 1e-6 ? hx / hl : Math.sin(P.yaw), uz = hl > 1e-6 ? hz / hl : -Math.cos(P.yaw);
    var x = (A[0] - H[0]) * ux + (A[2] - H[2]) * uz, y = A[1] - H[1], v = THROW.V, g = THROW.G, th;
    var disc = v * v * v * v - g * (g * x * x + 2 * y * v * v);
    if (x < 1e-6) { th = d[1] > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { th = disc >= 0 ? Math.atan2(v * v - Math.sqrt(disc), g * x) : Math.PI / 4; }
    var mv = [P.vx || 0, P.ground || P.wet ? 0 : (P.vy || 0), P.vz || 0];
    return { H: H, vel: [v * Math.cos(th) * ux + mv[0], v * Math.sin(th) + mv[1], v * Math.cos(th) * uz + mv[2]], th: th, yaw: Math.atan2(ux, -uz), A: A, mv: mv };
  }
  function throwPearl(now) {
    if (!sightOn() || !camLast || !eye) { return false; }
    if (carried <= 0) { say(NO_PEARL); return false; }
    var L = launchFrom(eye, lookDir(camLast.yaw, camLast.pitch), sight.hit ? sight.hit.t : null);
    carried -= 1; sight.thrown = now; sight.arc = null;
    pearls.push({ x: L.H[0], y: L.H[1], z: L.H[2], vx: L.vel[0], vy: L.vel[1], vz: L.vel[2], yaw: L.yaw, spin: 0, state: "fly", t: 0, bounces: 0,
                  trail: [[L.H[0], L.H[1], L.H[2], 0]], from: { H: L.H, vel: L.vel, th: L.th, A: L.A, eye: eye.slice(), yaw: camLast.yaw, pitch: camLast.pitch }, first: null, wet: false });
    drawCarry();
    return true;
  }
  // Where a throw now would first touch, by the same steps the pearl takes, and its path (for the holdover's ranges).
  function predict() {
    if (!camLast || !eye) { return null; }
    var L = launchFrom(eye, lookDir(camLast.yaw, camLast.pitch), sight.hit ? sight.hit.t : null), pts = [L.H.slice()];
    var q = { x: L.H[0], y: L.H[1], z: L.H[2], vx: L.vel[0], vy: L.vel[1], vz: L.vel[2], state: "fly", t: 0, bounces: 0, first: null, wet: false };
    for (var i = 0; i < 400 && !q.first && q.state === "fly" && !q.wet; i += 1) { stepPearl(q, 0.01, true); pts.push([q.x, q.y, q.z]); }
    return { L: L, pts: pts, at: q.first || (q.wet ? { x: q.x, y: q.y, z: q.z, t: q.t, n: [0, 1, 0], water: true } : null) };
  }
```

(`launchFrom`'s `T` keeps only x and z: the heading is horizontal.)

**`drawSight(c, W, H, now)`**, from SIGHT_JS 260–370, changed so:
- its clock: `var dt = sight.last ? min(0.05, (now - sight.last) / 1000) : 0; sight.last = now; sightSettle(dt);`
- no Throw button (drop 262's `tb`, `tOn` and 265);
- the early return: `var e = sightEase(now); if (!sightOn() || !camLast || e < 0.5) { if (tag) { tag.hidden = true; } sight.hit = null; return; }`
  then `var fade = smooth((e - 0.5) / 0.5);` and `c.save(); c.globalAlpha = fade;` round everything it draws
  (`c.restore()` at the end; the landing ring multiplies its own `steady` into `globalAlpha`);
- `hc`: `drawMe.body && sight.head ? sight.head : seat()` (no `Hd`); if `D <= PEARL.headR` the window is the whole
  view: `rw = hypot(W, H)`;
- before the gradient, the head clearing into glass: `if (fade < 1) { c.globalAlpha = 1 - fade; c.fillStyle = "#b9aca9"; c.beginPath(); c.arc(wx, wy, rw, 0, Math.PI * 2); c.fill(); c.globalAlpha = fade; }`;
- what the crux is on first, then the arc: `var hit = sightPick(), info = sightInfo(hit); sight.hit = hit; if (!sight.arc || tick % 3 === 0) { sight.arc = predict(); } var arc = sight.arc;`
  (`predict` heads for `sight.hit`);
- the holdover feet as 296–318, the arc's points `arc.pts`, `rng = hypot(p[0] - P.x, p[2] - P.z)`;
- the landing ring from `arc.at` (the pearl's centre at its first touch, `n` the touch's normal, unit, from the surface
  to the centre): `var n0 = L.n, t1 = abs(n0[1]) > 0.7 ? [1, 0, 0] : [0, 1, 0]`, `t1` made square to `n0`
  (`t1 - (t1·n0) n0`, normalised), `t2 = n0 × t1`, `base = [L.x - n0[0] * (pearlR() - 0.01), …]` (the touch on the
  surface, a centimetre off it), radius 0.98 / √3, 48 points; the label `"comes down " + round(hypot(L.x - P.x, L.z - P.z)) + " m"`;
  shown with `steady = stillMotion.matches ? 1 : 1 - smooth((sight.theta * 180 / Math.PI - 1) / 2)` (the old
  `still`, renamed so it is not read as reduced motion); not as the hologram (it never is);
- no hologram spot (drop 349–356);
- the tag's act line: `carried > 0 ? (touchy ? "Tap to throw" : "Click, T or Enter to throw") : "No pearl in your hand: walk to one, or tap it with the sight lowered"`; its place as 366–368.

**`drawPearls(now)`**, from THROW_JS 207–239: draws every pearl in `pearls`, and one more at `sight.inHand` when
`sight.up && carried > 0 && sight.inHand && now - sight.thrown >= BEAT * 500` (in the glove from the fling's half beat),
spin 0, turned by `P.face`. Its uniforms as `drawPearl`'s body pass: `gl.uniform4fv(U.uPal, me3.pal);
gl.uniform1f(U.uPx, pxW / h); gl.uniform2f(U.uNear, 0, 0); uOff, uOrg 0; uFloor 0; uDim the pearl's grid; TEXTURE1 its
grid`; and after it, `drawPearl`'s restoration exactly (rocket.js lines 1479–1481: `uPal` worldPal, `uM`/`uInvM` ID4,
`uPx` pxW, `uNear` NEAR_F, `uFloor` 1, `uDim` the place's, TEXTURE1 `voxTex`), then the trail as THROW_JS 223–238.
(THROW_JS's `near * 2 * T35 / canvas.height / h` names a `near` this game does not have.) The pearls are not in the
veil's second pass: at the sight's 1.6 m and beyond, a body of his unit is closed.

**Edits to what is there** (each anchor occurs once in rocket.js at 3068c876; the line numbers are for finding it):

| where (line) | anchor | change |
|---|---|---|
| `controls()` 797–800 | `var fwd = input.fwd + ((k.w \|\| k.ArrowUp) ? 1 : 0) - ((k.s \|\| k.ArrowDown) ? 1 : 0);` and the two `k.ArrowLeft/Right` lines | with the sight up the arrows aim: `var aimK = sightOn() ? 2 * Math.asin(PEARL.headR / SIGHT_D) / BEAT : 0;` (comment: the mark crosses its own window in a beat); ↑ ↓ walk only when `!aimK`; ← → turn at `aimK \|\| 2`; `if (aimK && (k.ArrowUp \|\| k.ArrowDown)) { P.pitch = clampPitch(P.pitch + (k.ArrowUp ? 1 : -1) * aimK * dt); }`; any arrow with the sight up sets `sight.turn = null` |
| `physics()` 815 | `if (aim !== null) { P.face = turnTo(P.face, aim, TURN * dt); if (fwd \|\| side) { P.want = null; } }` | first: `if (sight.up) { P.face = turnTo(P.face, P.yaw, TURN * dt); P.want = null; }` then `else if (aim !== null) …` (comment: with the sight up he faces the mark, the artist's words) |
| `act()` 903 | `var dir = dirAt(px, py), hit = pick(dir);` | after it: `if (!Hd && takeTapped(dir, hit ? hit.t : null)) { return; }` (a pearl lying within reach, tapped, back in his hand) |
| `clampPitch` 960 | `return !Hd && !onStone ? clampV(p, TP_DOWN, TP_UP)` | `!Hd && !onStone && !sight.up ?` (comment: with the sight up, as from his eyes: a lob is aimed high) |
| `camera()` 1004 | `var stone = !!(!Hd && !intro && !launched && (` | `!!(!Hd && !sight.up && !intro && …` |
| `camera()` 1007 | `pitchTo: stone ? null : clampV(P.pitch, TP_DOWN, TP_UP)` | `pitchTo: stone \|\| sight.up ? null : …` |
| `camera()` 1009 | `: Hd ? holoCam(dt) : onStone ? firstCam(EYE) : thirdCam(dt);` | `: Hd ? holoCam(dt) : sight.up ? sightCam(dt) : onStone ? firstCam(EYE) : thirdCam(dt);` |
| `camera()` 1023 | `head: !intro && !launched && (Hd ? true : !onStone \|\| !!blend) && far };` | `… && far && !(sight.up && sightEase(now) >= 0.5) };` (the head is the glass from the raise's half) |
| `follow()` 1030 | `if (Hd \|\| input.looking \|\| c.fwd <= 0` | `if (Hd \|\| sight.up \|\| input.looking \|\| …` (the camera is the aim) |
| `enterHolo()` 1045 | after the `holoLeft < BAR` line | `dropSight();` |
| `barred()` 1156 | its text | "As the hologram you can look and read. To take, build, break or throw, leave the hologram (Holo, or H): your body follows your head." |
| `letGo()` 1284 | its comment | "(the head leaves, he is put out, the sight is raised)" |
| `pearlFrom()` 1415 | `smashFrom(body);` | `smashFrom(body); throwFrom(body, spec);` |
| `pearlFrom()` 1425–1430 | the swing's `acts` | also `acts.push({ right: 1 }, { right: 1, fling: -COIL });` (his reach for the veil includes the raised arm) |
| `pearlFrom()` 1445 | `measure();` (its last line) | then `pearlGrid();` |
| `drawPearl()` 1459–1460 | `if (!me3 \|\| …) { return; }` and `M = PB.pose(body, phase, P.amount, swingPose());` | `sight.inHand = null;` before the return; `PB.pose(body, phase, P.amount, actNow(now))`; after it `sight.head = apply(PB.place(M.head, P.x, P.y, P.z, P.face), body.head.centre); if (HOLD) { sight.inHand = apply(PB.place(M.arm_right, P.x, P.y, P.z, P.face), HOLD); }` |
| `drawPearl()` 1467–1470 | `var drop = hatDrop(now);` and the parts' `var m = PB.place(M[ch.p.name], …)` | `var drop = hatDrop(now), off = sightEase(now);` and for the hat with `off`: `PB.place(mul(PB.T(HAT_DOFF[0] * off, HAT_DOFF[1] * off, HAT_DOFF[2] * off), M.hat), P.x, P.y, P.z, P.face)` (comment: the hat doffed into his left glove while the head is the glass) |
| `frame()` 1619 | `swingStep(dt);` | `swingStep(dt); sightStep(dt, now);` |
| `frame()` 1621 | `shardsStep(dt);` | `shardsStep(dt); if (!intro && !launched) { stepPearls(dt); }` |
| `frame()` 1679 | `drawPearl(now);` | `drawPearl(now); drawPearls(now);` |
| `lieDown()` 1768 | `swing = swingNext = null; shards = [];` | then `dropSight(); pearls = []; carried = THROW.CARRY; drawCarry();` (he comes to with his five) |
| `overlay()` 1841 | `if (!intro && !launched && !touchy) {` (the crosshair) | `… && !touchy && !sightOn()) {` (the crosshair gives way to the sight) |
| `overlay()` after the crosshair | before `if (intro) {` | `drawSight(c, W, H, now);` |
| `overlay()` 1873 | `lying.sort(function (a, b) { return dist(a) - dist(b); });` | `(marked[b.k] ? 1 : 0) - (marked[a.k] ? 1 : 0) \|\| dist(a) - dist(b)` (a piece a pearl rang on first) |
| `overlay()` 1888 | `hit = !intro && !launched && vp ? pick(` | `… && vp && !sightOn() ? pick(` (the crosshair's words give way to the sight's) |
| `launch()` 1964 | `launched = performance.now();` | then `dropSight();` |
| `var touchy = false;` 2198 | | add `var holdTick = function () {};` (wire() sets it: the look's holds, read each frame) |
| `wire()` 2222 | `canvas.setPointerCapture(e.pointerId);` | `try { canvas.setPointerCapture(e.pointerId); } catch (er) { /* a pointer a test dispatched */ }` |
| `wire()` 2230–2231 | the `look[e.pointerId] = { … button: e.button };` and `input.looking = true;` | the record also `held: false, chord: null`; after them `if (e.pointerType === "mouse" && e.button === 2) { sightPress(); }` |
| `wire()` pointermove 2240–2246 | after `if (!l) { return; }` | the mouse's chords (below); the `moved` test also marks `l.chord.moved` past 8 px from its own press; the gain `var k = sightOn() ? 2 * T35 / window.innerHeight : 0.0055;` (comment: raised, one px of the finger moves the mark one px over the far world, 1/f) in place of both 0.0055s; `if (mx \|\| my) { sight.turn = null; }` |
| `wire()` up 2248–2257 | the whole `up` | below |
| `wire()` after `up` | | `holdTick = function (now) { …below… };` |
| `wire()` 2264–2265 | after `press($("v-holo"), …);` | `press($("v-sight"), function () { if (Hd) { barred(); return; } raiseSight(); });` |
| keydown 2279 | after the `h` line | the `r`, `t`, `Enter` lines (below) |
| keydown 2288 | `if (k === "Escape") { closeLabel(); $("notes").hidden = true; }` | `… $("notes").hidden = true; raiseSight(false); }` |
| `init()` 2477 | `initPearl();` | `initPearl(); initThrow();` |
| `Rocket.debug()` 2562 | before the closing `};` | 5.6 |

The mouse's chords and the up (in `wire()`):

```js
    // A mouse's second button pressed or let go while the first is held comes as a move whose button is the one that
    // changed (pointer events' chords): the right button is the sight's; the left, pressed and let go within a tap, is
    // a click (with the sight up, the throw).
    var chord = function (l, e) {
      var now = performance.now();
      if (e.button === 2) { if (e.buttons & 2) { sightPress(); } else { sightRelease(); } return; }
      if (e.button !== 0) { return; }
      if (e.buttons & 1) { l.chord = { t: now, x: e.clientX, y: e.clientY, moved: false }; return; }
      var q = l.chord; l.chord = null;
      if (q && !q.moved && now - q.t < 450) { if (sightOn()) { throwAt(); } else { var r = canvas.getBoundingClientRect(); act(r.left + r.width / 2, r.top + r.height / 2, false); } }
    };
    // (in pointermove, after `if (!l) { return; }`:)
    //   if (e.pointerType === "mouse" && e.button >= 0) { chord(l, e); }
    var up = function (e) {
      if (stick && e.pointerId === stick.id) { stick = null; input.fwd = input.side = 0; water.up(performance.now() / 1000); return; }
      var l = look[e.pointerId];
      delete look[e.pointerId];
      input.looking = Object.keys(look).length > 0;
      if (!l) { return; }
      // the right button is the sight's, never a tap (it placed a block until 21 Oct 2026; Place's click places)
      if (e.pointerType === "mouse" && e.button === 2) { sightRelease(); return; }
      var p = l.button === e.button || e.pointerType !== "mouse" ? { moved: l.moved, t: l.t } : l.chord;
      if (!p || p.moved || performance.now() - p.t >= 450 || l.held) { return; }
      // with the sight up a tap or a click throws (the artist, 20 Oct 2026: "And when I click with the reflex sight up,
      // I am able to throw something"); else it acts where it was, as before
      if (sightOn()) { if (e.type === "pointerup") { throwAt(); } }
      else if (touchy) { act(e.clientX, e.clientY, false); }
      else { var r = canvas.getBoundingClientRect(); act(r.left + r.width / 2, r.top + r.height / 2, false); }
    };
    // A look held still for a beat, with the sight up, brings its point to the mark (sightAimAt).
    holdTick = function (now) {
      if (!sightOn()) { return; }
      Object.keys(look).forEach(function (id) {
        var l = look[id];
        if (l.moved || l.held || l.button !== 0 || now - l.t < BEAT * 1000) { return; }
        l.held = true; sightAimAt(l.sx, l.sy);
      });
    };
```

The keys (in keydown, after the `h` line):

```js
      if (k === "r" && !e.repeat) { if (Hd) { barred(); } else { raiseSight(); } }   // the sight (R), as its button
      var free = document.activeElement === document.body || document.activeElement === canvas;
      if ((k === "t" || (k === "Enter" && free)) && !e.repeat) { if (Hd) { if (k === "t") { barred(); } } else if (sight.up) { throwAt(); e.preventDefault(); } }
```

### 5.3 index.html

- `#view`'s aria-label ends: "…, tap a block to break it or place one; raise the sight (Sight, or R) and a tap throws a
  pearl where its mark is."
- In `.top`, after `#alarms`: `<p class="pearls" id="pearls" hidden aria-live="polite"></p>`.
- After `<p class="tag" id="tag" hidden></p>`: `<p class="sight-tag" id="sight-tag" hidden aria-live="polite"></p>`.
- In `#views`, before `#v-holo`: `<button class="vw" id="v-sight" aria-pressed="false" title="The sight: your head is the
  glass, and a tap or a click then throws a pearl where its mark is (R)"><span>Sight</span></button>`.
- The start card's `.keys` line gains: "Sight (or R, or the right button) raises the sight, your head the glass; then a
  tap, a click, T or Enter throws a pearl where its mark is."

### 5.4 rocket.css

```css
/* The sight (artist, 20 Oct 2026: "I want you to be able to aim at a target with a reflex sight that I can control
   with my right finger while my left finger allows me to move around the area"): its button over Holo, 6 px between,
   as the views' were; gone as the hologram (it has no sight, as it has no Break or Place); while it is up the tap
   throws, so Break and Place step back as they do for the hologram. */
.views { gap: 6px; }                                   /* (into the .views rule) */
body[data-holo] #v-sight { display: none; }
body[data-sight] .bar { display: none; }
/* What the mark is on, under the glass: page text on its own ground (4.7 : 1 over the brightest ground measured). */
.sight-tag { position: fixed; left: 50%; transform: translateX(-50%); width: max-content; max-width: min(92vw, 420px); margin: 0; padding: 7px 11px;
  background: rgba(14, 12, 10, 0.72); color: #f3e9d8; border-radius: 10px; font: 400 12px/1.35 var(--mono); text-align: center; z-index: 5; pointer-events: none; }
.sight-tag b { display: block; font: italic 400 16px/1.25 var(--serif); }
.sight-tag span { display: block; }
.sight-tag .from { color: #cfc4b2; }
.sight-tag .act { color: #fff; margin-top: 2px; letter-spacing: 0.06em; text-transform: uppercase; font-size: 10.5px; }
/* on a touch screen the views column stands at the right (56 px, 12 from the edge): the words keep clear of it */
body[data-touch] .sight-tag { left: max(12px, env(safe-area-inset-left, 0px)); right: calc(84px + env(safe-area-inset-right, 0px)); transform: none; width: auto; max-width: none; }
/* the pearls in his glove, a line under the alarms */
.pearls { margin: -4px 0 0; letter-spacing: 0.16em; }
```

and `.pearls` added to the first font rule (`.where, .alarms, .pearls, .pieces, …`), `body[data-film] .sight-tag` to
the films' list. In the landscape rule (max-height 520 px) the column runs down from the top: Sight, then Holo.

### 5.5 README.md

1. "Mr Pearl, and the two views", the third-person paragraph: "You look up only as far as keeps the camera over his
   hat." gains "(with the sight up, as far as from his eyes)".
2. A new paragraph after the smash's, before "**One button**":

   > **The sight, and the pearls he throws** (artist, 20 Oct 2026: "I want you to be able to aim at a target with a
   > reflex sight that I can control with my right finger while my left finger allows me to move around the area",
   > and "And when I click with the reflex sight up, I am able to throw something"). A reflex sight is a window of
   > partly reflecting curved glass with a lit mark at its focus, seen at infinity, so the mark lies on the target
   > wherever the eye is behind the window. His head is the one thing in the game that can be that glass, the only
   > perfect sphere, its film partly reflecting: so the head is the glass, and the figure is the mark. Sight (over
   > Holo; `R`; the right mouse button, held, or clicked to leave it up) raises it in the time a switch of view
   > takes: the camera comes down from over his hat to φ behind his head's centre on the line of the look (the
   > hologram's own distance, the height of the head's top), so his head is the middle of the view and its outline the
   > window, 8.7° across its half (93 px on a phone held upright, 79 on a computer), clear in the middle and bright at
   > its edge as the film is seen aslant; the head itself clears into the glass. He doffs his hat into his left glove
   > (its brim would cover the glass), raises his right arm, the upper arm level out to his right and the forearm
   > upright, a pearl in the glove, and faces the mark; the stick walks him as before, sideways too, and the camera
   > no longer swings round behind him. The mark is the figure, the block's own seen down its diagonal, white and
   > grey as light over a keyline of black, its aim point the crux, the figure's undrawn apex, at the middle of the
   > screen; from the crux hang its holding circles, 8, 13 and 21, and their feet are the holdover marks, each
   > labelled with the range at which the throw comes down through it, worked out from the arc as you aim. The figure
   > closes into the drawing when the aim is still and opens into its bars as it turns; still, a ring on the ground
   > says where the pearl comes down; under the glass, in words, what the mark is on, how far, what it came from and
   > the relation that put it there. The right thumb's drag aims, a pixel of the finger moving the mark a pixel over
   > the far world (a reflex sight magnifies nothing); a point held still for a beat comes to the mark (the way that
   > does not drag); the arrow keys turn it its window's breadth a beat. A tap or a click anywhere, `T` or `Enter`,
   > throws.
   >
   > **What he throws** is a pearl built of the unit, three of his cells round (136 of them, in six bands of his
   > jacket's tints), never the perfect sphere; he carries five, one for each finger of his throwing glove. It leaves
   > the glove at once at 29.2 m/s, the speed whose farthest throw on level ground is F(9) = 34 m (35 m from his
   > hand's height, aimed 39.5° up), on the arc that comes level with the sight's line at his reach, six metres out,
   > heading for what the mark is on, so that it comes down on the mark's upright; it takes his walk with it, spins
   > backward a turn a beat and trails the last beat of its path. One a beat: his arm flings forward and comes back
   > up, and a tap before it is up is kept, the latest. It bounces with half its speed, comes to rest, sinks in water
   > as he does, and where it first touches says what it struck: a work's title and who made it (never a look behind
   > it, never a wrong look), a piece of the rocket (it rings: the arrow points to that piece first), a block's
   > section and project, the water. It takes, breaks and looks behind nothing. It comes back when he walks into it,
   > or when it is tapped with the sight lowered within his reach; he comes to again with all five. The tap with the
   > sight down smashes, as before; with it up, it throws; raising it lets a swing go. As the hologram there is no
   > sight and no throw. Under reduced motion the sight comes up at once, the figure stays closed and the ring is
   > always shown.
3. "**Holographic.**", its last sentence: "…but not take, build, launch, or break and place blocks" becomes "…but not
   take, build, launch, break and place blocks, or raise the sight and throw".
4. "## Clue", the phone paragraph: "…and over it the Holo button" becomes "…, over it the Holo button, and over that
   Sight"; "The buttons of play (Holo, Break or Place, …)" becomes "(Sight, Holo, Break or Place, …)"; the computer's
   keys gain "R raises the sight (or the right button, held or clicked) and a click, T or Enter then throws, the arrows
   aiming; Escape lowers it".
5. "## Files": `rocket.js` gains "the sight (`raiseSight`, `sightCam`, `drawSight`) and the pearls he throws
   (`launchFrom`, `stepPearl`, `struck`)"; `pearl.js`'s `pose` gains "(with the throwing arm, `act.right`,
   `act.fling`, and `build`'s `throwArm`)".

### 5.6 Rocket.debug()

Added, changing nothing by themselves except where a hook says so:

```js
  sight: function () { var n = performance.now(); return { up: sight.up, on: sightOn(), ease: sightEase(n), fling: flingAt(n), ready: sightReady(n), theta: sight.theta, omega: sight.omega,
    next: sight.next, thrown: sight.thrown, turn: !!sight.turn, rmb: !!sight.rmb, head: sight.head, inHand: sight.inHand,
    hit: sight.hit && { t: sight.hit.t, r: sight.hit.r, b: sight.hit.b, x: sight.hit.x, y: sight.hit.y, z: sight.hit.z, work: sight.hit.painting ? sight.hit.painting.f.title : null, water: !!sight.hit.water },
    land: sight.arc && sight.arc.at, launched: sight.arc && sight.arc.L && { th: sight.arc.L.th, vel: sight.arc.L.vel, H: sight.arc.L.H },
    tag: $("sight-tag").hidden ? "" : $("sight-tag").textContent }; },
  raiseSight: raiseSight, throwAt: throwAt, sightAim: sightAimAt, predict: predict, hand: handAt,
  holdView: function (s) { sight.hold = s; if (blend) { blend.hold = s; } },          // pins the raise (and its blend) at s, for photographs; null lets go
  holdFling: function (u) { sight.flingHold = u; },
  pearls: function () { return pearls.map(function (p) { return { x: p.x, y: p.y, z: p.z, vx: p.vx, vy: p.vy, vz: p.vz, state: p.state, t: p.t, wet: p.wet, first: p.first, from: p.from }; }); },
  carried: function (v) { if (v != null) { carried = v; drawCarry(); } return carried; }, marked: function () { return marked; },
  clearPearls: function () { pearls.length = 0; carried = THROW.CARRY; drawCarry(); },
  sightConsts: { SIGHT_D: SIGHT_D, SIGHT_F: SIGHT_F, WIN: Math.asin(PEARL.headR / SIGHT_D), U: sightU(), THROW: THROW, HOLD: HOLD, HOLD_AT: HOLD_AT, HAT_DOFF: HAT_DOFF, BEAT: BEAT, T_VIEW: T_VIEW },
```

and `pearl()` gains `throwArm: me3.body.throwArm`. For `holdView`, `camera()`'s blend line reads
`var s = blend.hold != null ? blend.hold : smooth((now - blend.t0) / 1000 / blend.dur)` and never ends a held blend.
(`sightConsts` is read when called, so `HOLD` is the form's once it has come.)

---

## 6. Tests

Server: `http://127.0.0.1:8803` serves /home/user/site/docs (if it does not answer, start one in the background:
`python3 /tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/scripts/serve_utf8.py 8803 /home/user/site/docs`,
and stop only its PID). Harness: `/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf10/build/scripts/game.js`
(`open({ view: "desk" | "phone", virtual: 25, port: 8803 })`, `frames`, `state`), `NODE_PATH=/opt/node22/lib/node_modules`,
desk and phone run in the background at once. Patterns: wf13/smash/scripts/smash.js (the open level run, `stand`,
`setB`, the recorder after each frame, `holdSwing`), wf14/stick/holo_while_moving.js (the left thumb by CDP touch,
the right finger as dispatched touch PointerEvents, `isPrimary: false`). Scripts and shots under
`/tmp/claude-0/-home-user/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf15/<your step>/`. Every run ends with
no page errors; each check prints ok / FAIL; a `results.json` with the measures of 6.4.

### 6.1 Cases (`sight.js desk|phone outdir port`), on smash.js's open level run (off the homage and the tree)

1. **Raise and lower, every way.** The button (phone: a touch's press; desk: a click), R, Escape; desk also the right
   button clicked (down, up within 3 frames: stays up; again: down) and held (down, 25 frames, up: down again).
   Each: `aria-pressed`, `body[data-sight]`, the bar hidden, the blend's `dur` = T_VIEW and `pitchTo` null up /
   clamped down; 16 frames after a raise, `|eye − seat()|` = φ ± 1 mm and the eye on the look line through the seat
   (`(seat − eye) × lookDir` under 1 mm); the pitch unchanged by the raise; after lowering, the pitch within
   [TP_DOWN, TP_UP] and the camera `thirdCam`'s again.
2. **The glass.** Standing (no bob), the window's radius on the screen (`sight.head` projected, `D` from the eye) is
   92.6 px (phone) / 79.0 px (desk) ± 1 px; `drawMe.head` false from the raise's half, true at once on lowering;
   `inHand` 13.1° ± 0.5° right of the mark and 1.5° ± 0.5° over it.
3. **The drag.** Sight up, a drag of 100 px right: Δyaw = 100 · 2 tan 35° / innerHeight ± 1e-6 (0.1659 phone,
   0.1945 desk); lowered, 0.55. A drag up of 50 px raises the pitch by 50 times the same.
4. **The hold.** Pick a block face 9 m off and 60 px from the mark (`screenOf`); press there (no movement), keep 22
   frames, then 16 more: `sight.hit` is that block (or its point within 0.2° of the crux); released, nothing thrown
   (`carried` 5). A press moved 12 px within the beat: no turn.
5. **The arrows (desk).** ArrowRight held 20 frames with the sight up: Δyaw = 0.635 · 0.5 ± 2 %; ArrowUp raises the
   pitch, does not walk (`walked` unchanged); W still walks.
6. **The throw.** A tap with the sight up (16 frames after raising): a pearl is out in the same frame (`carried` 4,
   `pearls()[0].from.H` = `hand()`), its first touch within 1 cm of `predict()`'s `at` taken the frame before. Desk:
   a left click; T; Enter (and Enter with the focus on Notes opens Notes and throws nothing).
7. **One a beat, the kept tap.** Two taps 3 frames apart: the second pearl leaves at frame 20 after the first (BEAT at
   25 ms), not before; five taps in a beat throw two. A tap at the raise's frame 5 is thrown at frame 16.
8. **Converging.** A brick wall 7 wide and 10 high at 13 m; the crux on its middle at his head's height (`stand`, the
   look level, `sight.hit` the wall): the pearl's first touch is within 2 cm of the crux's vertical plane (parallel
   would be 38.5 cm); at 21 m the same.
9. **The feet.** Aimed level, 10° up, 20° up and 45° up on the level run (nothing within reach): the labels'
   ranges (read back from `predict().pts` as drawSight reads them) match 3's table ± 0.3 m; the farthest throw's
   landing at 39.5° up is 35.3 m ± 0.3.
10. **Where it lands.** A work beyond LOOK (alarms before = after, the label closed, the toast "Your pearl struck …"); a
    piece lying as a block (`marked()[k]`, the piece not taken, `#near` names it first); water (it rests on the bottom,
    y = bottom + R ± 1 cm, "Your pearl sinks"); a block (the toast names its section or ground); a note (rests on it).
11. **Back in the glove.** Walk into a lying pearl (W toward it): `carried` +1, "A pearl back in your hand"; with the
    sight lowered, a tap on one 3 m off: +1; a tap on one behind a wall: nothing; `putOut()`: 5 and none lying.
12. **None left.** Six throws: the sixth says NO_PEARL; the tag's act line says so.
13. **The smash and the throw.** Sight down, a tap on a block a step ahead starts a swing; at u 0.5 raise the sight:
    `swing().ret` true, the block not broken at u 1, the arm rises (`ease` → 1). Sight up, a tap on that block throws
    (no swing).
14. **The hologram.** Holo with the sight up: the sight down at once, the head out; `#v-sight` not displayed; R, T and
    the right button say the barred line (in `__toasts`); `throwAt()` false; Holo again: the body follows, the sight
    still down.
15. **Stones and where you woke.** On the homage's first stone and at `underTree()`: the view is his eyes; raise: the
    sight's camera (φ from the seat); lower: his eyes again (the blend's `pitchTo` null).
16. **A wall at his back.** Stood a block from a wall behind him: the camera pulled in (`camD` < φ), the window larger
    than 92.6 px, never inside a block (`boxSolid` false).
17. **Reduced motion** (`P.emulateMedia({ reducedMotion: "reduce" })`): the raise is at once (`blend` null the next
    frame, `ease` 1), a drag leaves `theta` 0 and the landing ring drawn, a throw makes no fling (`fling` 0), the rate
    still one a beat.
18. **The pose.** In Node, `PearlBody.build` + `pose(…, { right: s })` for s in 0 … 1 by 1/16 and `{ right: 1, fling: f }`
    for f in 0 … −π/2 by π/32, at the walk's four quarters: no cell of `arm_right` enters the head's sphere (least gap
    ≥ 4.9 cm; calc/try_pose.js); `throwArm.a2` = 128.22°.
19. **Frame time.** `__ft` median over 40 frames with the sight up (still, and dragging) against down; `predict`'s own
    time (≤ 2 ms is the budget; it runs a frame in three).

### 6.2 Two fingers (`fingers.js outdir port`, phone)

The left thumb by CDP `Input.dispatchTouchEvent` (its own id): `touchStart` at (90, 660), `touchMove` to (90, 620)
(a full push: REACH 40 px), held to the end. The right finger as dispatched touch PointerEvents (`pointerType:
"touch"`, `isPrimary: false`, ids from 51), because Chromium's emulation lifts the wrong finger of two:
1. `pointerdown` then `pointerup` on `#v-sight`'s centre: the sight up, he still walking (≥ 4.2 m/s over the next 16
   frames).
2. On the canvas: `pointerdown` at (300, 400), six `pointermove`s of +10, −5 px a frame, `pointerup` at (360, 370):
   Δyaw = 60 · 0.00166 ± 1e-4 (and his walk's own turning of the look nil: `follow` is off), nothing thrown.
3. A tap at (300, 400): `pointerdown`, 2 frames, `pointerup`: thrown, he walking; the pearl's `vel` less the launch's
   own (`from.vel − mv`) is his walk (`P.vx, P.vz` ± 0.01); `walked` rose all through; the stick's water drawn (its
   `busy()`).
4. A second tap 4 frames later: kept, thrown at frame 20.
5. A hold at (330, 300) for 22 frames, still walking: that point comes to the mark (as 6.1.4) while he walks.
6. The left thumb lifted (`touchEnd` with no points left): he stops; the sight stays up.

### 6.3 Frames to photograph (desk 1280 × 720 and phone 390 × 844 at 2; also phone on its side, 844 × 390)

01 third person, the sight down, on the level run · 02–04 the raise held at ¼, ½, ¾ (`holdView`) · 05 the sight up,
still: the window, the mark closed, the feet labelled, the landing ring, the pearl in his raised glove (desk: his
hat in his left hand) · 06 dragging (the figure open, no ring) · 07 on a work beyond 9 m (the tag) · 08 on a piece ·
09 on water · 10 aimed 39.5° up at the sky (nothing within the throw; the feet labelled) · 11 the fling at u 0.25
(`holdFling`), the pearl just out · 12 the pearl in flight with its trail, half a flight later · 13 landed, its toast ·
14 the hold, before and after · 15 lowered again · 16 as the hologram (no Sight button; the barred toast) · 17 a wall
at his back · 18 on its side (the window 42.8 px) · 19 reduced motion, dragging (closed, the ring) · and the two
fingers: 20 walking with the sight up (the water under the left thumb and the glass) · 21 mid-drag · 22 the throw
while walking · 23 a beat later. A sheet of each view (as the earlier sheets), and the window's contrast measured on
the shots as SIGHT.md's `calc/contrast.py` did (the floor 4.14 : 1).

### 6.4 To report

Every check; the camera's distance and the window's radius measured; the drag's and the arrows' rates; the hold's
error; each throw's launch, landing and the error against `predict`; the lateral at 13 and 21 m; the kept throw's
frame; the frame times; and page errors (none).

---

## 7. For the artist to settle

1. **A tap anywhere throws** (built, the artist's "click with the reflex sight up"), and the way to aim without a drag
   is a hold of a beat on the point. The other way: a tap on the glass throws and a tap off it brings that point to
   the mark (the site's own one-tap rule exactly), at the cost of the right thumb reaching the middle of the screen
   for every throw, far on a phone on its side.
2. **His raised hand** is the cocked throw beside his head (his arm is bent 81° and cannot go straight up), 0.39 m
   right of the sight line, so **the pearl heads for what the mark is on** and comes down on its upright. The other
   way is THROW.md's parallel heading: 0.39 m right of the mark at every distance.
3. **The holdover marks** are the circles' feet labelled with the ranges the arc makes of them; the throw's stand-in
   ladder (8, 13, 21 m) is left out: its 21 m mark lies outside the glass.
4. **The right mouse button** becomes the sight's (held, or clicked); right-click no longer places a block (it was
   not in the README or the keys line); Place's click places.
5. **Raising the sight lets a smash go** (nothing broken), as the head leaving does; the other way is to let the
   swing strike first and raise the arm after (up to two beats late).
6. **The hat** is doffed into his left glove, held by its brim's edge; **Break and Place** step back while the sight is
   up, as they do for the hologram.
7. **No Throw button**: the view is the button. The game's look-drag with the sight down still has no way that does
   not drag on a phone (the hold could serve it too, later).
