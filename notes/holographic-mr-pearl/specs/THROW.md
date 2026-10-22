# The throw: what he throws, and how it flies

The artist, 20 Oct 2026: "I want you to be able to aim at a target with a reflex sight that I can control with my right
finger while my left finger allows me to move around the area", and "And when I click with the reflex sight up, I am
able to throw something."

This is the throw. The sight itself is wf11/sight's (SIGHT.md: the head is the glass, the figure is the mark, the feet of
its holding circles are the holdover marks). The sight already takes its numbers from this design (`launchFrom()` when the
throw's code is in). The prototype is a copy of the third-person build (wf10/build, rocket.js md5 cfb5…722, unchanged
since 16 Oct 01:31), patched by `calc/patch_throw.py` with `calc/throw_part.js`, into `site/`. It has a stand-in sight:
the first-person eye, a red dot, the level ladder and the computed fall mark. Its job is to test the throw, not to stand
for wf11/sight's design.

Files (all under `/tmp/claude-0/-home-user-Art-Database/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf11/throw/`):
`calc/throw_calc.py` → `calc/throw.json` (every number), `calc/marks.py` → `calc/marks.json` (the drops for the real
sight's eye and for the stand-in), `calc/indep.py` (a closed-form check of the landings), `calc/throw_part.js` (the
code), `calc/patch_throw.py` (the 17 edits, each matched exactly once), `scripts/throws.js` and `scripts/cases.js` (the
runs), `calc/sheet.py` (the sheets), `shots/` (the screenshots and `results.json` files), and `NOTES.md`.

---

## 1. What he throws

### Candidates

| | what | its relation to him, to the unit, to the mission | verdict |
|---|---|---|---|
| **A** | **a pearl built of the unit**: the solids study's first sphere, R = F(4) = 3 units, at **his own level** (φ⁻⁷ m) | Mr Pearl throws pearls. It is made of what he is made of: his level-7 cells (the level his narrowest part sets, the glove's finger). It is banded, as the solids study builds a sphere, so it is never mistaken for the one true sphere, his head. | **chosen** |
| B | his guitar pick: a Reuleaux triangle (the figure's triangle drawn with three arcs, each centred on the opposite corner, radius the triangle's side) | his own instrument. But the game has no air, so its flat shape does nothing in flight (it would fly the same parabola as the pearl). At the unit it is a few cells across: 3 units = 0.103 m, 0.28° at 21 m (2.9 px on the phone). It is a figure of circles, which is right, but it reads as a speck. | option |
| C | the block in his hand (the hotbar's material), landing as a placed block | he could build at a distance. But the views spec keeps break and place "within his reach" (REACH = 6 m), and a block thrown onto a roof would build a stair to a roof's piece from the ground, which goes round the mission. | option, not advised |
| D | a pearl at the next sphere, R = F(6) = 8 units (2176 units, 0.551 m across) | bigger than his head (0.491 m across): the built pearl would outweigh the one true sphere | rejected |
| E | a pearl at R = 3 one level up (φ⁻⁶ = 0.0557 m cells, 0.334 m across) | its cells would be coarser than his own, so the thing in his hand would not be his | rejected |
| F | his hat, thrown and come back | the sight needs the hat off (SIGHT.md doffs it to his left glove), and losing it loses his hood | rejected |

### The pearl, as built (`calc/throw.json → pearl`)

| number | value | relation |
|---|---|---|
| unit h | **0.034442 m** | φ⁻⁷ m: his own level (pearl-body.json `unit`: the level whose unit is his narrowest solid part, the glove finger 0.0301 m: round(log_φ(1/0.0301)) = 7) |
| radius | **R = 3 h = 0.10333 m** (diameter 0.2067 m) | F(4) = 3: the solids study's first sphere (its spheres are R = 3, 8, 21, which are F(4), F(6), F(8)) |
| units | **136** (80 on the shell) | a cell is the pearl's if its centre lies within R of the middle (the solids study's rule; CHECK.md confirms 136 / 2176 / 39024) |
| bands | **12, 24, 32, 32, 24, 12** | its six layers of cells, bottom to top. A pearl is laid down in layers, and the built sphere's layers are its bands. (CHECK.md §6: the bands are not equal in area. That is the built sphere's nature, not a fault.) |
| colours | each band one of the **K = 8** film tints of his pearl cloth, in order up the pearl | pearl-body.json `palette`: the cloth leans iridescent by the unit, each cell one of K tints of the film (pearl.glsl at normal incidence) averaging to the jacket's median #b7a8a0 |
| the head over the pearl | 0.24565 / 0.10333 = **2.38** | the head (the only perfect sphere) stays the larger round thing |
| drawn | his body's pass: the same grid-walk among the bars, his palette, the pixel's width in his unit (`uPx = near · 2 tan 35° / H / h`), turned by its spin | "everything else will receive the consequential texture of the base unit": each of its cells is the figure at level 7, as his are |
| a block's worth | φ²¹ = **24 476 units = 180 pearls** | (1 m / h)³: what one broken block would make (option C2 below) |

**What he carries: five.** One pearl for each finger of the throwing hand (his right glove's four fingers and the thumb,
pearl-body.json `glove_right_*`). He comes to with five (each wake-up, and after being put out). A pearl comes back
to his hand when he walks into it where it lies (his body's box, 0.3 m round and 1.8 m tall, touches it), or when it
is tapped, with the sight lowered, within his reach (REACH = 6 m, measured from him as `pick()` measures). It never
comes back by itself: what is thrown is out in the world until he goes to it. "Pearls 4 of 5" shows (page text,
aria-live polite) while the sight is up or any pearl is out.

Options for where they come from: **C1** endless (no count); **C2** made of blocks broken: each block he breaks makes
up to 180 pearls (φ²¹ / 136), which is endless in practice; **C3** found, one per piece found (the four pieces make
four). The fingers keep the count small and his own, and a throw becomes a choice.

---

## 2. How it flies

| number | value | relation |
|---|---|---|
| gravity g | **25 m/s²** | the game's own (physics(): `P.vy - 25 * dt`). It is the only force on a thing in the air. |
| drag | **none** | the game has no air: his own jump and fall have no drag (V_FALL = 20 m/s is a guard so he never falls through a roof in a long frame; the pearl's sub-steps do that job, so it needs no cap) |
| speed v | **√(g · F(9)) = √(25 · 34) = 29.155 m/s** | its farthest throw, at 45° on level ground, is F(9) = 34 m, so the throw's reach is a Fibonacci number of the game's metres. (His walk 4.3 m/s × φ⁴ = 29.47 m/s would make it 34.7 m. The built thing takes the Fibonacci number; the walk's relation is kept as the near alternative.) |
| straight up | 17.0 m high, 2.33 s up and down | v² / 2g = F(9) / 2; 2v / g |
| released from | **his right hand raised straight up**: (0.144 m to his right, 1.502 m over his feet, 0 forward) | the right shoulder (pearl-body.json: 0.14398, 1.01134) plus the arm's length straight up: upper arm 0.1800 + forearm 0.2645 + half the palm 0.0459 = 0.4905 m (`armFrom()` reads them from the form when it loads) |
| aimed by | **the sight's line, zeroed at REACH = 6 m** | the launch takes the lower arc that crosses the sight's line 6 m beyond where the line passes his reach point (`pick()`'s measure). Within 6 m, what the crux is on is what he can break and what the pearl meets. The heading is kept parallel to the line, so the hand's 0.144 m to his right stays as it is at every distance. The option is to converge on the line at the zero too: then it is right by 0.144 m at 6 m only, and 0.36 m left of the line at 21 m. Parallel is right by the same 14.4 cm everywhere. |
| aimed high | the zero, 6 m off, is always within the pearl's reach (v² / g = 34 m), so the lower arc through it always exists. Aimed about 40° up (stand-in), the launch comes to 45° and the throw goes farthest; aimed higher, it lobs (above 45°, shorter, steeper) | measured: pitch 40° gave a launch of 44.9999° (`marks.py`: 38° → 43.13°, 42° → 46.86°) and 35.35 m. If the zero ever cannot be reached (a disc < 0), the code throws at 45° along the aim. |
| his own motion | added | his hand throws, so a pearl thrown walking keeps his walk (the computed fall mark includes it; the fixed marks are for a throw standing) |
| spin | backspin, **one turn a beat**: 2π / 0.48 s = 13.09 rad/s | a pearl rolls off the fingertips; the beat is BAR / 4 = 4·60/125/4 s (the theme song's tempo, rocket.js BAR) |
| trail | the **last beat** of its path (0.48 s), a line in the jacket's #b7a8a0 at half opacity at the pearl, fading to nothing a beat back | Colour Middling's Average: half the cloth over half of what lies behind it |
| through the grid | the first block the **pearl's surface** touches: stepped on its exact parabola in steps no longer than the time the chord leaves the arc by one bar of the unit (√(8 · 0.1 h / g) = **0.0332 s**), nor than the time it takes to go **R / 2** (1.8 ms at full speed), every block within R of the centre tested (`sphereHit`); the touch found by 16 halvings (to 27 ns, under a micrometre) | it is a body of radius R, so it strikes when its surface meets a face, a little before its centre would enter (cast() walks a point; the pearl walks a ball). Never through walls: a step of R / 2 cannot pass a block, nor a corner (the nearest point of every cell within R is tested). The place's sides and the bedrock are walls; above the place is open sky. |
| the frame's length | none | each step is the exact parabola from the step's start; measured, below |
| bounce | the velocity's normal part mirrored, **the whole velocity halved: e = 1/2** | the Average of a perfect bounce (1) and a dead stop (0) |
| rest | on a floor (normal within 45° of up), when the rebound would rise less than **one unit**: vₙ · e < √(2 g h) = **1.312 m/s** | below one cell it would hop less than its own grain |
| rest held | while something holds it up; a block broken under it lets it fall again | |
| in water | it sinks as he does: falls at **6 m/s²**, no faster than **2.5 m/s** (physics(): wet, `-6`, `max(-2.5, …)`), and rests on the bottom | the pearl is no lighter than he is in water |

### Drops at the distances the sight's marks need

Aimed level (the target at the line's height, standing), the pearl's fall below the line, and how far below the crux
the target must sit (the mark). The real sight (wf11/sight) looks along the line through **his head's centre (1.3724 m
over his feet), the eye φ behind it**. The hand is 0.13 m above that line, so near the arc runs above the line, and from
the zero on below it. The stand-in's eye is 1.62 m (the hand 0.118 m below it). Px are CSS px below the crux at the
screen's centre (f = H / 2 tan 35°: phone 844 high, desk 720 high). From `calc/marks.json`.

**The sight as built (line through the head's centre, eye φ behind):** launched 3.84° above the line when level.

| distance (m) | time (s) | pearl below the line (cm) | the mark below the crux (°) | phone px | desk px | arc's fall (° below level) |
|---|---|---|---|---|---|---|
| 1 | 0.034 | −18.2 (above) | −3.89 | −41.0 | −35.0 | −2.1 (still rising) |
| 2 | 0.069 | −20.4 | −3.19 | −33.6 | −28.6 | −0.5 |
| 3 | 0.103 | −19.8 | −2.42 | −25.5 | −21.7 | 1.2 |
| 5 | 0.172 | −9.5 | −0.82 | −8.6 | −7.4 | 4.6 |
| **6 (zero = REACH)** | 0.206 | 0 | **0** | 0 | 0 | 6.3 |
| **8 = F(6)** | 0.275 | 27.9 | **1.67** | 17.6 | 15.0 | 9.6 |
| 9 (LOOK) | 0.309 | 46.4 | 2.52 | 26.5 | 22.6 | 11.2 |
| **13 = F(7)** | 0.447 | 149.5 | **6.01** | 63.4 | 54.1 | 17.6 |
| **21 = F(8)** | 0.722 | 497.7 | **13.74** | 147.3 | 125.7 | 29.0 |
| 34 = F(9) | 1.169 | 1466.7 | out of the sight (raise it: 45° reaches 34 m from the ground, not at the line's height) | | | 43.2 |

**The sight's own marks** (the feet of the holding circles F = 8, 13, 21 hanging from the crux, 3.35°, 5.43°, 8.73°):
where the throw comes down through each. The sight labels them with these, computed every frame:

| foot | angle | aimed level | aimed 20° up | aimed 10° down |
|---|---|---|---|---|
| F 8 | 3.35° | **10.0 m** | 9.5 m | 10.0 m |
| F 13 | 5.43° | **12.5 m** | 11.7 m | 12.6 m |
| F 21 | 8.73° | **16.5 m** | 15.2 m | 16.9 m |

**The prototype's stand-in (first-person eye, 1.62 m):** launched 6.22° above the line when level.

| distance (m) | time (s) | below the line (cm) | mark (°) | phone px | desk px |
|---|---|---|---|---|---|
| 1 | 0.035 | 2.4 | 1.36 | 14.3 | 12.2 |
| 3 | 0.104 | −7.5 | −1.42 | −14.9 | −12.7 |
| 6 | 0.207 | 0 | 0 | 0 | 0 |
| 8 | 0.276 | 19.9 | 1.43 | 15.1 | 12.9 |
| 9 | 0.311 | 34.3 | 2.21 | 23.2 | 19.8 |
| 13 | 0.449 | 121.6 | 5.55 | 58.6 | 49.9 |
| 21 | 0.725 | 439.2 | 13.28 | 142.3 | 121.4 |

Inside the zero the stand-in's arc is at most 8.1 cm above the line (at 3.66 m) and first crosses it at 1.33 m. The
farthest target at eye height that any raise reaches is 33.9 m; the farthest on level ground from the hand is 35.47 m
(at 43.8°).

**Slopes.** A fixed ladder holds only on the level. A target 21 m off up a 30° slope needs 18.3°, not the 13.3° of
the level mark, and the rifleman's rule (the level mark for D cos β) gives 10.4°, which is wrong both ways for a throw
this slow (`throw.json → slope`). So the sight's marks are computed from the arc every frame (wf11/sight does this),
and the exact landing mark (the arc walked through the grid) is the truth on any ground.

---

## 3. What it does where it lands

A pearl answers where it **first** touches, as a tap does: "anything tapped says what it came from and the relation
that put it there". It says this from any distance it reaches (out to 35 m). It **takes nothing, breaks nothing, places
nothing and looks behind nothing**: those stay with his hands, within his reach. So "you cannot complete the missions
… by merely going into holographic mode" holds for the throw too: the throw finds, and the hand does.

| target | what the pearl does | the words (built) |
|---|---|---|
| **a work** | knocks and falls; it says the work's title, artist and date (what it came from). It does not open the label (that is a look, within LOOK = 9 m) and it is **not a look behind**, so it is **never one of the three wrong looks** and the guards do not stir. It also cannot tell whether a piece is behind the work, so the right look is still the mission. | "Your pearl struck *Title* (Artist, date), 13 m off. Within 9 m you can read its label and look behind it." |
| **a piece of the rocket** lying as a block (on a roof, in a park's ground, under water, in a tree's top) | it **rings**: the piece is marked, and the way-finder points to marked pieces first. It is not taken. | "Your pearl rang on a piece of your rocket: the fuel tank, 11 m off, 6 m up. Take it by hand." |
| **a block** | knocks (bounces, e = ½) and says what the block came from: its section and project (`partText`), or the ground's own name (the lawn, the road, the scorched ground of your wreck …) | "Your pearl struck a section of …, 12 m off." |
| **a note** (a sheet, not a block) | passes as he does (w.SOLID); a pearl that comes to rest on one says so | "Your pearl lies on a note, 7 m off: go and read it." |
| **water** | sinks at his own sinking (6 m/s², ≤ 2.5 m/s) and rests on the bottom | "Your pearl sinks, 9 m off: swim down to it." |
| **the sky** | there is no ceiling: it goes up and comes down. The place's sides are walls, and it bounces back off them. | |
| **the wreck / the rocket** | a block like any other (the scorched ground, the capsule's metal); building and launching stay with their buttons | |
| **the guards** | the game draws no guards (they are words: "the guards walk you out"). *Proposed*, for when they are drawn: a guard **catches** the pearl and keeps it (one fewer in the hand, said), and it does **not** count as a wrong look. Throwing is not looking. Optionally, a second rule: a pearl thrown at a guard raises the alarm one step, as a wrong look does. Left for the artist. | |
| **his body, as the hologram** | not thrown at (the hologram does not throw) | |

**As the hologram: no throw.** The hologram is the head flown free: it has no hands. With the sight up as the
hologram, a click or tap does what a tap does as the hologram (it reads the work or note under the mark), and says
once in 4 s: "The hologram has no hands to throw with. To throw, bring the body here." T / Enter says the same.
The pearls in the hand stay with the body. The throw is also barred before waking (the intro) and after the launch.

---

## 4. Controls and WCAG 2.2 (DISPLAY.md)

- **Raise / lower the sight:** the Sight button (56 × 44 CSS px, `aria-pressed`, over the views column) or **R**. In
  the prototype raising it takes the first-person eye. In the game it is wf11/sight's sight view.
- **Throw:** with the sight up, a **tap or click on the canvas, on its up-event** (a drag that moved does not throw),
  **T**, or **Enter**. In the game, also wf11/sight's Throw pill (44 px), the visible one-pointer way. Two fingers at
  once are never needed: one finger can drag to aim, lift, and tap.
- **The two fingers** (phone): the left on the stick walks, the right drags the aim and taps to throw. The throw keeps
  his walk (measured below).
- **Pick up:** walk into it, or tap it within reach with the sight lowered (a 24 px-or-larger target is not
  guaranteed at range, so walking into it is the one-pointer way that always works).
- **Words:** every answer goes to the toast (`role="status"`); the count of pearls is page text (aria-live polite).
  The canvas is decoration with text twins.

---

## 5. Measured (the prototype in `site/`)

Chromium (Playwright, SwiftShader), a virtual clock of 25 ms a frame (the game runs as on a device drawing 40 frames a
second, however slowly the software renderer draws). The run is a flat strip of open ground, 27 m by 7 m, near where
he wakes (Allison Island Residence, building 1). He stands on a cell boundary facing along it, the sight up. **Truth**
is the same pearl stepped at 0.1 ms. **Independent** is `calc/indep.py`: the launch rebuilt in Python from the pitch
alone and the first touch solved in closed form (the centre comes to R from the wall's face or the ground's top).

### Throws at several distances and angles (`shots/desk/`, `shots/phone/`; sheets `shots/sheet_desk.png`, `shots/sheet_phone.png`)

Walls of the test material, 7 blocks wide and 10 high, at 6, 8, 13 and 21 m (the zero and the Fibonacci marks), the
ladder's mark held on the wall's face at the eye's height. Then free throws onto the open ground at 5 pitches.
**err** is the game's landing (the pearl's centre where its surface first touched) against the truth.
**indep** is against the closed form. **path** is the pearl's recorded path against the exact parabola before the
first touch. **wall** is where it struck on the wall (above the eye's height, and right of the line).

| view | throw | pitch (°) | launch (°) | range from the hand (m) | time (s) | err (cm) | indep (cm) | path (cm) | wall: up / right (cm) |
|---|---|---|---|---|---|---|---|---|---|
| desk | wall 6m | 0.00 | 6.2196 | 5.897 | 0.2035 | 0.00003 | 0.00003 | 7e-12 | +0.7 / 14.4 |
| desk | wall 8m | 1.43 | 7.6587 | 7.897 | 0.2733 | 0.00003 | 0.00003 | 2e-12 | +1.0 / 14.4 |
| desk | wall 13m | 5.55 | 11.7832 | 12.897 | 0.4519 | 0.00004 | 0.00004 | 1e-11 | +2.0 / 14.4 |
| desk | wall 21m | 13.28 | 19.4342 | 20.897 | 0.7601 | 0.00001 | 0.00001 | 7e-12 | +3.4 / 14.4 |
| desk | ground -20deg | -20.00 | -14.2902 | 4.335 | 0.1534 | 0.00001 | 0.00002 | 6e-12 |  |
| desk | ground -5deg | -5.00 | 1.1584 | 10.461 | 0.3589 | 0.00008 | 0.00008 | 3e-12 |  |
| desk | ground 10deg | 10.00 | 16.2018 | 22.175 | 0.7920 | 0.00002 | 0.00003 | 1e-11 |  |
| desk | ground 25deg | 25.00 | 30.8144 | 32.101 | 1.2820 | 0.00002 | 0.00002 | 9e-12 |  |
| desk | ground 40deg | 40.00 | 44.9999 | 35.345 | 1.7145 | 0.00006 | 0.00006 | 1e-11 |  |
| phone | wall 6m | 0.00 | 6.2196 | 5.897 | 0.2035 | 0.00003 | 0.00003 | 7e-12 | +0.7 / 14.4 |
| phone | wall 8m | 1.43 | 7.6587 | 7.897 | 0.2733 | 0.00003 | 0.00003 | 2e-12 | +1.0 / 14.4 |
| phone | wall 13m | 5.55 | 11.7832 | 12.897 | 0.4519 | 0.00004 | 0.00004 | 1e-11 | +2.0 / 14.4 |
| phone | wall 21m | 13.28 | 19.4342 | 20.897 | 0.7601 | 0.00001 | 0.00001 | 7e-12 | +3.4 / 14.4 |
| phone | ground -20deg | -20.00 | -14.2902 | 4.335 | 0.1534 | 0.00001 | 0.00002 | 6e-12 |  |
| phone | ground -5deg | -5.00 | 1.1584 | 10.461 | 0.3589 | 0.00008 | 0.00008 | 3e-12 |  |
| phone | ground 10deg | 10.00 | 16.2018 | 22.175 | 0.7920 | 0.00002 | 0.00003 | 1e-11 |  |
| phone | ground 25deg | 25.00 | 30.8144 | 32.101 | 1.2820 | 0.00002 | 0.00002 | 9e-12 |  |
| phone | ground 40deg | 40.00 | 44.9999 | 35.345 | 1.7145 | 0.00006 | 0.00006 | 1e-11 |  |

Every landing is within **0.0001 cm** of the exact arc, on both views, and the path is the parabola to 10⁻¹¹ cm (it is
evaluated, not integrated). On the walls the ladder's mark put the pearl **0.7 to 3.4 cm above the target point**:
the surface touches a hair before the centre reaches the aimed point. It was **14.4 cm right** at every distance, which
is the hand's offset kept parallel. The phone and the desktop give the same numbers: the throw does not depend on the
screen.

**The frame's length** (`cases.json → dt`): the same throw (pitch 0.3 rad from where he wakes, 1.033 s of flight,
struck cell (112, 33, 178)) stepped at 0.1 ms, 1/120, 1/60, 1/30, 0.05 and 0.1 s: the landings differ by **at most
0.000058 cm**, and the cell is the same.

### Several in flight (`shots/ft_desk/`, the end of `shots/phone/`; sheet `shots/sheet_ft_desk.png`)

The frame callback's own time (the game's JS and its GL calls, then `gl.finish()`, so the GPU's work is waited for),
over 20 frames, with none, five (all he carries) and twenty-one (a test past the count) in flight, each run twice,
interleaved. **step** is the pearls' own stepping. **wall** is real seconds per frame. That is the machine and not the
game: SwiftShader on 4 cores under a load of 28 to 37 from another workflow's browsers.

| view | run | in flight | median (ms) | max (ms) | step, all pearls (ms) | wall (s / frame) |
|---|---|---|---|---|---|---|
| desk 1280×720 | none_a | 0 | 1.7 | 7.9 | 0.0 | 3.28 |
| desk 1280×720 | five_a | 5 | 2.1 | 16.0 | 0.1 | 3.69 |
| desk 1280×720 | twentyone_a | 21 | 2.4 | 7.9 | 0.1 | 4.37 |
| desk 1280×720 | none_b | 0 | 1.2 | 5.9 | 0.0 | 4.63 |
| desk 1280×720 | five_b | 5 | 1.7 | 7.9 | 0.0 | 4.49 |
| desk 1280×720 | twentyone_b | 21 | 2.4 | 5.5 | 0.1 | 4.63 |
| phone 390×844 @2 | none_a | 0 | 1.4 | 14.0 | 0.0 | 1.40 |
| phone 390×844 @2 | five_a | 5 | 1.5 | 9.7 | 0.1 | 1.47 |
| phone 390×844 @2 | twentyone_a | 21 | 2.9 | 37.1 | 0.0 | 1.48 |
| phone 390×844 @2 | none_b | 0 | 1.5 | 8.1 | 0.0 | 1.19 |
| phone 390×844 @2 | five_b | 5 | 1.4 | 15.9 | 0.0 | 1.24 |
| phone 390×844 @2 | twentyone_b | 21 | 1.9 | 15.7 | 0.1 | 1.56 |

The pearls cost about **0.1 ms a frame** to step, even 21 of them. The callback's median goes from 1.2 to 1.7 ms with
none in flight to 1.4 to 2.1 ms with five and 1.9 to 2.9 ms with twenty-one. Each pearl is one draw of a 136-cell mesh
through his body's shader (a few hundred pixels at most), plus its trail's lines. Five pearls are within the noise of
none.

### On each target (`shots/cases_desk/`, `shots/cases_phone/`; sheets `shots/sheet_cases_desk.png`, `shots/sheet_cases_phone.png`)

Aimed by sweeping the pitch until the computed fall mark came down on the target, then thrown:

| case | what happened (desk and phone alike) |
|---|---|
| a work, from 13 m (beyond LOOK) | "Your pearl struck Untitled (Mark Bradford, 2015), 13 m off. Within 9 m you can read its label and look behind it." The label stayed closed, and the alarms were 0 before and 0 after. |
| a lying piece (the guidance computer, a block at (143, 38, 137)) | "Your pearl rang on a piece of your rocket: the guidance computer, 6 m off. Take it by hand." It was marked (`marked[2]`), not found (`found` empty), and the block is still there. |
| water, 4 m off | "Your pearl sinks, 4 m off: swim down to it." It rested on the bottom at y = 31.103 (the bottom 31 + R), 0.99 s after the throw. |
| a pearl lying 13.6 m off (it bounced on from a throw at −43°: e = ½ of 29 m/s is still 14.6 m/s) | **desk:** he stood 3 m from it and walked to it (W): "A pearl back in your hand: 5 of 5." **phone:** with the sight lowered, a tap on it (195, 499) 3 m off: the same. |
| none left (six throws with five) | the sixth: "No pearl in your hand: pick one up again where it lies (walk to it, or tap it)." |
| the hologram (H, the sight up, a click / a tap) | no throw (5 carried, 0 out): "The hologram has no hands to throw with. To throw, bring the body here." |

(The first desk run's pick-up walked the wrong line: the pearl had bounced 13.6 m away, so `cases.js` now stands him
3 m from where it lies. The first phone run's two-finger case sent CDP's touchEnd wrongly, and is superseded by
`scripts/fingers.js` below. Its shots are in `shots/cases_phone/superseded/`.)

### The two fingers on the phone (`scripts/fingers.js`, `shots/fingers/`; sheet `shots/sheet_fingers.png`)

CDP `Input.dispatchTouchEvent`, each finger its own id. (Measured: a touchEnd lists the points that end.)

| step | result |
|---|---|
| the left finger on the stick (80, 700), pushed 40 px forward | he walks at 4.30 m/s (vx −2.13, vz 3.74), sight up |
| the right finger drags 36 px right, 18 px up, the left still on the stick | the aim turns (yaw −2.624 → −2.426, pitch −0.229 → −0.130: 0.0055 rad a px, the build's drag) and he walks on (4.30 m/s) |
| the right finger lifts after the drag | no throw (5 of 5), still walking |
| the right finger taps (300, 400), the left still walking | **thrown** (4 of 5), launched 1.35° below level (th = −0.0236 rad) along the aim, his walk (−2.82, 3.24 m/s) added to its velocity |
| one finger alone taps | thrown. **T** on the keyboard: thrown. A one-finger drag of 16 px, then lift: it aims, and does not throw. |

With the sight raised in wf11/sight the drag is 1 : 1 with the world (1/f rad a px). That is the sight's number, not
the throw's.

Page errors in every run: none.


---

## 6. For the artist to settle

1. **What he throws:** the built pearl (A, built), the guitar pick (B), or the block in his hand (C, which builds at a
   distance and goes round "within his reach").
2. **How many:** five, one per finger (built), or endless (C1), made of blocks broken (C2, 180 a block), or one per
   piece found (C3).
3. **The speed's relation:** F(9) = 34 m farthest (built), or his walk × φ⁴ (34.7 m).
4. **The heading:** parallel to the line (built: 14.4 cm right at every distance), or converging at the zero.
5. **A strike on a work:** says what it came from, never a look and never a wrong look (built). The option is that
   the guards count a strike as a wrong look.
6. **The guards, when drawn:** they catch the pearl (proposed), or the throw raises the alarm.
7. **Pieces:** a pearl rings on a piece and marks it, and the hand takes it (built). Never a throw that takes.
