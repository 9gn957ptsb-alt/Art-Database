# The smash: how he breaks a block with his guitar

The artist, 21 Oct 2026: "He should be using his guitar to smash things when using the break function".

This is the design of that request, made to be built exactly. Every number below is the relation that sets it ("THIS
IS ABOUT DETERMINED RELATIONS"), computed from his form (`pearl-body.json`, built by `pearl.js`), his walk, the
game's REACH and the theme song's tempo (125 a minute: a beat 0.48 s, a bar 1.92 s, rocket.js `BAR`). It was built
once, as a prototype, on copies of `pearl.js` and `rocket.js` (the working tree at 04:47, with the views agent's work
in progress: one Holo/Third toggle, the body following the head), and run in the game on desk and phone (§9).

All files are under `/tmp/claude-0/-home-user/a1b41505-97aa-5c99-a2ff-1a0633b67077/scratchpad/wf13/smash/`:

| file | what |
| --- | --- |
| `SMASH.md` | this |
| `proto/smash_part.js` | the new section of rocket.js, to insert before the comment "Mr Pearl drawn" |
| `proto/patch_smash.py` | every edit, each matched exactly once (pearl.js 6, rocket.js 14), applied to `proto/base/` |
| `proto/smash-pearl.diff`, `proto/smash-rocket.diff` | the same as diffs against the 04:47 copies in `proto/base/` |
| `proto/docs/worlds/rocket/` | the patched game (the rest symlinked to the site), served for the runs on port 8843 |
| `scripts/smash_check.js` | Node: the swing on his built body with pearl.js's own `pose()`; no cell into his head |
| `scripts/smash.js` | the game: every case below, timed frame by frame, and photographed (§8) |
| `scripts/bars.js` | the game: the bars of a smashed block counted and photographed frame by frame after the strike |
| `scripts/speed_check.js`, `scripts/sheet.py` | the far end's speed at the strike as burst() measures it; the game's shots as sheets |
| `calc/` | the Python that computed and rendered everything (`dump_body.js` → `body.json`, `body.py`, `kin.py`, `swing.py`, `limits.py`, `check_swing.py`, `extents.py`, `hatstill.py`, `keyframes.py`, `hero.py`, `render.py`) and its outputs (`check_swing.json`, `smash_check.json`, `extents.json`) |
| `img/keys_low.png`, `img/keys_waist.png`, `img/keys_high.png` | the keyframes, side and front, for a block low, at his waist, at his head |
| `img/hero_waist.png` | four poses from his right, from in front and from above, larger |
| `img/game_phone_waist.png`, `img/game_desk_waist.png` | the game's own frames of the swing at the waist block, cropped round him |
| `shots/desk/`, `shots/phone/` | the game's own frames of the swing, and `results.json`, `log.txt` |

His frame below is the game's: metres, x his right, y up from his feet, z behind him (he faces -z), the origin the
ground under his head's centre. One unit h = φ⁻⁷ m = 0.034442 m (his cells).

---

## 1. What swings, about what

**Both arms and the guitar, as one, about the line through his shoulder centres.** His hands hold the guitar (the
right glove on the strings over the sound hole, the left fretting the neck), and each arm is one rigid grid, upper arm
to glove: it cannot bend at the elbow or let go. The only turn that keeps both arms on their shoulders and both hands
on the guitar is one turn of the three together about the line through the two shoulder centres, the joints
`shoulder_right` (0.14398, 1.01134, 0) and `shoulder_left` (−0.19320, 0.98842, 0) that pearl-body.json keeps "for a
later strum or swing". The line falls 3.89° from his right shoulder to his left, so it is not his x axis: pose() needs
a turn about any axis (`RA`). This is `act.arms`, + lifting the front (as RX swings a leg forward).

**The upper body about the spine: the walk's own turn, made large.** The walk already turns "the upper body (torso,
both arms, the guitar) against the legs about the spine by θφ⁻³ = 7.1°". The smash turns it about the same axis, by
up to a quarter turn either way (`act.twist`, + to his right). Raised alone, the guitar would rise in front of him,
hidden from the third-person camera behind him by his back, his head and his hat (its brim 0.80 m across); turned,
its body goes out behind his right shoulder, where the camera sees it, and sweeps round in front onto the block. In
pose() the two turns about the spine are one: `RY(−tw·aR − act.twist)`.

**The head** rides the upper body (its centre moves with the turn, as with the walk's). Its eyes are drawn on his
facing (uHead from P.face), so through the whole swing they stay on the block. No cell of the arms or the guitar ever
enters its sphere: the arms rise exactly as far as it lets them (§2).

**The hat** turns with the upper body, exactly as it turns with the walk's turn (the code's one rule: every part but
the pelvis and the legs). Kept from turning (riding only the head's centre), the left arm comes into its brim at the
top on his left: the arms could rise there only to 73.3° before touching it, and to 64.4° to clear it by a unit (for
every height of block; `calc/hatstill.py`).

**The strap** is in the guitar's grid ("the guitar and its strap"), so it swings with it: as the arms rise, its run
across his back turns into his back (hidden there) and its tail end hangs from the raised guitar. Split into its own
grid it would leave two loose ends on his chest while the guitar is up.

**The torso does not lean and the knees do not give.** A lean would not bring the guitar to the ground: bowed at the
hips by 30°, 45°, 60°, 75° and 90°, its lowest cell stays 0.385, 0.325, 0.247, 0.156 and 0.058 m over his feet. And
the knees could give only with the feet held where they stand, which pose() cannot do (it has no inverse kinematics);
so the legs stay the walk's, and walking and smashing go together: the legs walk on under the swing.

---

## 2. The swing, beat by beat

u counts beats from the tap (a beat = BAR / 4 = 60 / 125 = **0.48 s**). The whole swing is two beats, half a bar.

| u | time | the arms (act.arms) | the upper body (act.twist) | how it moves |
| --- | --- | --- | --- | --- |
| 0 | 0 | from where they are (rest: 0) | from where it is (rest: 0) | the tap. He turns to the block (§3) |
| 0 → ½ | 0 → 0.24 s | → **ARMS_UP = 77.98°** | → τ_hit **+ 90°** (to his right) | the coil: smoothstep, from rest to rest at the top |
| ½ → 1 | 0.24 → 0.48 s | ARMS_UP → **α_hit** | τ_hit + 90° → **τ_hit** | the downswing: from rest at the top at an even pull (the angle as the square of the time) |
| **1** | **0.48 s** | α_hit | τ_hit | **the strike: the block breaks** |
| 1 → 1½ | 0.48 → 0.72 s | α_hit → ARMS_UP | τ_hit → τ_hit **− 90°** (to his left) | the follow-through: the downswing mirrored (2s − s²), slowing as it sped, up to the top on his left |
| 1½ → 2 | 0.72 → 0.96 s | → 0 | → 0 | back to rest, smoothstep; or, a tap kept, its downswing from this top (§5) |

The relations:

- **The coil, a quarter turn (π/2).** Swung down in half a beat from rest at an even pull, it reaches twice its mean
  speed at the strike: 2 · (π/2) / (BEAT/2) = 2π / BEAT = **13.09 rad/s, one turn a beat** (the speed the throw's
  pearl spins at, THROW.md).
- **ARMS_UP = 77.98°: as high as his head lets them.** The largest turn of the arms at which no cell of the arms or
  of the guitar is in his head's sphere (a cell's farthest corner, h√3/2 = 0.0298 m from its centre, at most on it;
  sphere radius 0.24565 m, centre 1.37239 m up). The cell that meets it is the right cuff's, at rest (0.0517, 0.8438,
  −0.2239). With the guitar raised so, it lies level at the shoulders. Computed from his form when it loads
  (`smashFrom`), as every other distance of his is (measure()), so a better form brings its own.
- **The far end: the tail of the guitar's lower bout.** The guitar's cell farthest from the shoulder line, cell
  (23, 0, 1) of its grid, at rest (0.0861, 0.4994, −0.2239), a gold rib cell: **0.5541 m** from the line (0.5839 m to
  its farthest corner). It is what strikes.
- **E0 = 66.17°**: how far below level the far end hangs at rest, seen along the shoulder line.
- **Y_SH = 1.0016 m**: the shoulder line's height over his feet where it crosses his centre line.
- **α_hit, the arms at the strike: the far end at the block's height.** e is the elevation of the block's centre
  seen from (his centre line, Y_SH); α_hit = clamp(E0 + e, 0, ARMS_UP): no lower than the arms hang (the guitar on his
  belly), no higher than his head lets them. So the far end points at the block's height for every block from 66.17°
  below his shoulders to 11.81° above them (ARMS_UP − E0); below that he strikes as low as he reaches, above it level
  at his shoulders.
- **τ_hit, the turn at the strike: the far end on the line from his feet to the block.** At rest the far end is 37.7°
  right of his front (seen from the spine); turned by τ about the spine (x = s_x = −0.0873), its x in his frame is
  nought when (p_x − s_x) cos τ − p_z sin τ = −s_x: **τ_hit = atan2(−p_z, p_x − s_x) − acos(−s_x / hypot(p_x − s_x,
  p_z))** (p the far end at α_hit), the root nearest nought: −19.80° at arms 0, −14.62° at 9.83°, −7.79° at 39.53°,
  −4.61° at 77.98°. The tops are a quarter turn either side of it.

**For the three blocks a step ahead** (each a block whose near face is 0.5 m from his centre; `calc/extents.json`, the
guitar's cells' extent with half a cell on each side):

| block | its centre | seen from his shoulders | α_hit | τ_hit | at the strike, the far end | the guitar's extent at the strike (x / y / z, m) |
| --- | --- | --- | --- | --- | --- | --- |
| low: the ground one ahead | 0.5 m below his feet, 1 m ahead | −56.34° | 9.83° | −14.62° | 0.34 m ahead at 0.55 m (0.95 m over the block's top: a gesture) | −0.771..0.242 / 0.510..1.138 / −0.357..0.162 |
| at his waist | 0.5 m up, 1 m ahead | −26.64° | 39.53° | −7.79° | **0.51 m ahead at 0.76 m: on the block's face** | −0.756..0.248 / 0.675..1.211 / −0.529..0.143 |
| at his head | 1.5 m up, 1 m ahead | +26.49° | 77.98° | −4.61° | **0.55 m ahead at 1.12 m: on the block's face, at its foot** | −0.744..0.250 / 0.784..1.249 / −0.577..0.145 |

and at rest −0.723..0.310 / 0.482..1.137 / −0.276..0.172; at the top on his right (waist) −0.233..0.499 /
0.784..1.249 / −0.656..0.314, the far end at (0.468, 1.118, 0.057): beside his right shoulder, level with it; at the
top on his left −0.674..0.059 / 0.784..1.249 / −0.314..0.656, the far end at (−0.642, 1.118, −0.057).

**The strike's speed** (the far end's, just before the strike; `calc/check_swing.json`): 5.1 to 7.5 m/s forehand,
7.3 to 9.0 m/s backhand (the backhand's turn and the arms' fall add), from the lowest block to the highest.

**Nothing goes through him** (`scripts/smash_check.js` on the patched pearl.js, and `calc/check_swing.py`; the whole
swing, forehand and backhand, for blocks from straight below to over his head, standing and at four points of the
stride): no cell of the arms or the guitar ever enters his head's sphere (the least gap, 0.00001 m, is the right cuff
at each top: touching, not through); the hat never comes nearer them than 0.205 m (six units). The guitar's back lies
on his belly as built (cells 0.6 cm into the jacket). Only low strikes while walking bring the guitar into the
forward thigh, by 2.3 cm (the walk alone puts it 1.1 cm in): two-thirds of a cell, inside.

The keyframes are drawn from his cells in `img/keys_low.png`, `img/keys_waist.png`, `img/keys_high.png` (side and
front: rest, coil, the top on his right, downswing, late downswing, the strike, follow-through, the top on his left,
return, rest; the far end's path in red: a V seen from in front, an arc round him seen from above) and
`img/hero_waist.png` (four of them larger, with the plan).

---

## 3. How it is aimed

- **High, level, low: by the arms** (α_hit, above), recomputed every frame until the strike, so if he walks the aim
  stays on the block.
- **Left or right: he turns to it first**, as now (rocket.js sets P.want from the tap), at TURN, half a turn in
  T_VIEW = H / walk = 0.395 s. That is less than a beat (0.48 s), so from any bearing he faces the block by the
  strike, and **the swing does not wait for the turn**: the coil and the turn go together. The upper body's own turn
  at the strike (τ_hit) then brings the far end, which hangs right of his front, onto the line to the block.
- While a swing is on, he faces what it will strike until the strike, walking or not (the walk's own facing waits),
  and then what is kept for the next (§5). The camera keeps following the way he walks, not the turn.

---

## 4. The reach: (a), REACH kept, the swing is the blow

**Computed.** The guitar sweeps no farther from the shoulder line than its far end, **0.554 m** (0.584 m to the far
corner of its cell) at every angle of the arms, since they turn about that line; from the line up through his feet,
**0.760 m** in the whole swing (0.752 m at rest). His body's box is 0.3 m round, so the guitar reaches at most 0.46 m
past it; and the far end's height at the strike runs only from 0.49 m (the arms as they hang) to 1.12 m (as high as
they go). Of the blocks round him, the guitar can meet only those standing a step from him at his waist or his head;
never the ground under the next step (it stays 0.48 m over his feet; bowed 90° at the hips, 0.06 m), never a block
over his head.

**Chosen: (a). REACH stays (6 m from his eye, as pick() measures); the strike is when the block breaks, and the blow
reaches it.** A block a step ahead at his waist or his head the far end really meets at the strike (0.51 m and
0.55 m ahead of his centre, the face at 0.5 m); a block on the ground ahead, or 5 m off, breaks at the same strike,
as the hand's blow breaks a block in the game this one follows (a game in the way of Minecraft's phone app, whose hand
swings at a block metres off). Reasons, against the artist's words:

- "using his guitar to smash things": every break is now his guitar's blow. He turns to the block, swings at its
  height, and it breaks at the strike, a beat after the tap, with its bars flying out of the face he struck at half
  the guitar's speed (§6): the guitar is what does it, at any distance within his reach.
- The game's breaking is for digging (the ground ahead, the block under the next step) and for getting up and in
  (a block over his head, a wall); the guitar alone reaches neither the ground nor over his head. (b) would end both.
- A phone, tapping, third person: a tap on what you see breaks it from where he stands, as now; nothing new to learn.

Considered and set aside:

- **(b) the guitar's reach only**, a tap farther off saying so or stepping toward the block: it forbids the ground and
  everything over his head (above), so digging down and breaking up stop; and stepping toward a block on the ground
  brings it no nearer the guitar.
- **(c) carrying him to it** (a tap walks him there, then he swings): the same two failures, the control changes from
  tapping to walking, and the hologram's rule (the body follows the head) is the game's one way of moving him by a
  tap; a second would muddy it.

---

## 5. Rapid taps, walking, water, the target changed, the hologram, the throw

- **Rapid taps: one is kept, the latest, and struck a beat after.** A tap to break while a swing is on (before its
  follow-through ends, u < 1½) is kept, the latest only (a newer tap replaces it; a tap on what is already to be
  struck does nothing). He turns to it at this swing's strike (a beat to turn: any bearing), and standing he goes on
  facing it after its own strike (it becomes what he reaches for, as a tap sets). At the end of the
  follow-through (the top on his left) its downswing begins there, so it strikes one beat after this one, swung back
  (the backhand: the coil is the follow-through), then up to the top on his right; and so on: **one block a beat**
  (2.08 a second), forehand and backhand by turns, like strokes on the beat. A tap during the return (u 1½ to 2)
  starts a fresh swing from where the arms are, coiling to the side they are on.
- **Walking: the legs walk on** (the walk's phase is by the ground covered, the swing is the upper body's); he faces
  the block until the strike, then turns back to the way he walks; the camera follows the walk throughout.
- **In water** the swing's clock runs at SWIM / WALK = 2.2 / 4.3 = 0.512 (the water slows his arms as it slows his
  legs, whose stride is by the ground covered): the strike at BEAT × WALK / SWIM = **0.938 s**. The bars sink as he does
  (6 m/s², at most 2.5 m/s).
- **The target changed before the strike**: at the strike the block is checked again, as act() checked it at the tap:
  the same block still there (`w.get` is the id that was tapped) and the tapped point still within REACH of where he
  reaches from now. If it was broken or replaced meanwhile (another block put in its cell), or he has walked out of
  reach, nothing breaks: the swing was only a swing. A piece of the rocket is found at the strike (collect), whole, not
  burst.
- **The hologram**: going out lets the swing go (letGo: nothing struck, nothing kept; the arms back to rest in half a
  beat from where they are), as "you cannot complete the missions ... by merely going into holographic mode"; as the
  hologram a tap to break is barred as now. Put out by the guards (lieDown) the swing and the bars are cleared.
- **The throw (THROW.md, later)**: the smash is act()'s break with the sight down; with the sight up a click throws.
  `pose(body, phase, amount, act)` takes act as a set of named turns, so the throw's raised right arm can be added as
  `act.right` without touching the smash; a throw should wait for a swing to end (the hands are on the guitar), and a
  swing for a throw.

---

## 6. What is seen at the strike

- **The block is gone in the frame of the strike** (w.set to air, remeshAt), as act() does it now at once.
- **Its six bars fly.** The block is the figure, six square bars (rocket.js FIGURE); struck, it comes apart into them.
  Each bar flies out of the face he struck (n, the face's outward normal: the cast's `prev` cell), each the way it
  lies from the block's middle (along n + d, d its offset from the middle in block units), at **half the guitar's speed
  at the strike** (the throw's bounce, e = ½: the mean of a perfect bounce and a dead stop; the speed is the far end's,
  measured from the swing itself at u = 1 and 1 − 1/64), turning **half a turn a beat** (half his shoulders' turn at the
  strike) about n × d; it falls as anything falls here (25 m/s²; in water as he sinks), lands and lies on the top of a
  block it falls onto (its least half-thickness over it), and is gone a beat after the strike, when the swing that broke
  it is over; one that flies into a block's side is gone at once. So a block in a wall sheds its bars back out of the
  wall toward him, onto the ground at his feet, and one in the ground throws them up out of the hole. (Measured: the
  waist block's bars reach his feet in about a fifth of a second; with nothing to lie on they were gone by then, so the
  prototype was changed to let them lie, §9.)
- **In the block's three tones**: each bar's faces by the bar's own axes, up white, east-west grey, north-south black
  (tonesOf, as the page draws its blocks), in the place's haze; drawn by a small program that makes a box from its
  corners by gl_VertexID with no buffers, as his head's box is made.
- **No shake, no flash.** A shake moves the view you aim with, and the game has none; a flash is not of its look. The
  bars are the block's own figure taken apart (as the study "Apart" in figure.html takes the figure apart), which is
  the look of everything here.

---

## 7. How to build it

`proto/patch_smash.py` applies every edit below to the 04:47 copies; each anchor is matched exactly once. Against the
rocket.js the views agent finishes, apply the same edits by their anchors (functions and comments the views work does
not touch: act, physics's facing lines, follow, frame's update and draw, drawPearl's pose line, pearlFrom, enterHolo,
lieDown, init, the debug object). Comment every change with the artist's words and the date, as the prototype does.

### pearl.js (6 edits; `proto/smash-pearl.diff`)

1. The header: `PearlBody.pose(body, phase, amount, act)`, act `{ arms, twist }` in radians (the smash).
2. `RA(v, a)`, a turn about any axis (column-major, right-handed; RA([1, 0, 0], a) is RX(a)), beside RX and RY:

   ```js
   function RA(v, a) {
     var l = sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]), x = v[0] / l, y = v[1] / l, z = v[2] / l, c = Math.cos(a), s = Math.sin(a), k = 1 - c;
     return [c + x * x * k, y * x * k + z * s, z * x * k - y * s, 0, x * y * k - z * s, c + y * y * k, z * y * k + x * s, 0,
             x * z * k + y * s, y * z * k - x * s, c + z * z * k, 0, 0, 0, 0, 1];
   }
   ```
3. `function pose(body, phase, amount, act)`, with the comment (the artist's words, 21 Oct 2026).
4. The two turns about the spine are one, and the arms' turn about the shoulder line:

   ```js
   var bob = T(0, -drop, 0), twist = about(RY(-tw * aR - (act && act.twist || 0)), J.spine.at), arms = null;
   if (act && act.arms) {
     var sR = J.shoulder_right.at, sL = J.shoulder_left.at;
     arms = about(RA([sR[0] - sL[0], sR[1] - sL[1], sR[2] - sL[2]], act.arms), sR);
   }
   ```
5. In the parts' loop, before the torso's line: `else if (arms && (p.name === "arm_right" || p.name === "arm_left" ||
   p.name === "guitar")) { m = mmul(twist, mmul(arms, m)); }`. The hat, the torso and M.head keep `mmul(twist, ...)`:
   they turn with the upper body.
6. `RA` in the api. With act left out, pose() is what it was, matrix for matrix.

### rocket.js (14 edits; `proto/smash-rocket.diff`, the section `proto/smash_part.js`)

1. **The section "the smash"**, inserted before "Mr Pearl drawn": the constants (`BEAT = BAR / 4`, `COIL = π / 2`;
   `FAR_END, E0, Y_SH, ARMS_UP` from the form, with the file's values until it loads: E0 1.15486, Y_SH 1.00155,
   ARMS_UP 1.36101 rad), the state (`swing`, `swingNext`, `shards`), and `smashFrom(body)`, `aimArms(s)`,
   `aimTwist(arms, body)`, `swingPose(s)`, `smash(hit, dir)`, `begin(t)`, `chain()`, `letGo()`, `swingYaw()`,
   `swingStep(dt)`, `farEndAt(s, u)`, `strike(s)`, `burst(s, b)`, `shardsStep(dt)`, `SHARD_VS`, `SHARD_FS`,
   `drawShards()`. The swing is one object: `{ x, y, z, b (the id tapped), n (the struck face), hp (the tapped point),
   yaw (his bearing to it), u, side (+1 forehand, −1 backhand), from, top (a chained one's), hit [α_hit, τ_hit],
   struck, broke, speed, hold }`; a let-go one is `{ ret: true, u, from }`. If his body's file has not come (no
   me3), a tap breaks at once as it did, with no bars: there is no one to swing.
2. **physics()**, his facing: `var aim = swingYaw(), way = Math.atan2(P.vx, -P.vz);` then the swing's target first,
   the walk's way second, P.want third; and `follow(dt, c, aim !== null && (fwd || side) ? way : P.face)`.
3. **follow(dt, c, face)** turns the camera toward `face` (the walk's way while a swing holds his facing).
4. **act()**: `var dir = dirAt(px, py), hit = pick(dir);`; a block kept for the next swing does not set P.want (he
   turns to it at this swing's strike).
5. **act()**, the break: the four lines that set the block to air, collect and remesh become `smash(hit, dir);`
   (bedrock and a wall a work hangs on are refused before, as now).
6. **frame()**, the update: `swingStep(dt);` after the body's physics (inside `else if (!launched && !flying)`), and
   `shardsStep(dt);` before `pump`.
7. **frame()**, the draw: `drawShards();` right after `drawPearl(now);` (depth on, before the veil).
8. **drawPearl()**: `M = PB.pose(body, phase, P.amount, swingPose())`.
9. **pearlFrom()**: `smashFrom(body);` before the parts are meshed.
10. **pearlFrom()**, the veil's reach: the poses measured are the walk's five times the swing's six (the tops either
    side and the strikes low and high), so the veil pass takes him when any of the swing is near the camera.
11. **enterHolo()**: `letGo();` before the head leaves.
12. **lieDown()**: `swing = swingNext = null; shards = [];`.
13. **init()**: compile SHARD_VS/SHARD_FS and look up `uVP, uM, uT, uEye, uHaze`.
14. **debug()**: `swing()`, `holdSwing(u)` (holds the swing at u; past 1 it strikes), `shards()`, `screenOf(p)` (a
    world point to client pixels, for a tap there), `farEnd()`, `smashConsts()`.

### README.md (the builder's to write, true to the code)

In "Mr Pearl, and the views", after the paragraph on third person, a paragraph like this:

> **Breaking is a smash with his guitar** (artist, 21 Oct 2026: "He should be using his guitar to smash things when
> using the break function"). A tap or a click to break turns him to the block and starts a swing whose strike falls a
> beat later (the theme song's beat, 0.48 s). His hands hold the guitar, so both arms and it turn as one about the line
> through his shoulders, and his upper body turns about his spine as the walk turns it, made large: he coils a quarter
> turn to his right with the guitar raised as high as his head lets it, swings down at an even pull so that at the
> strike his shoulders turn at one turn a beat, and the tail of the guitar's body comes onto the line from his feet to
> the block, at the block's height as seen from his shoulders; then the swing carries on up to his left and back to
> rest, two beats in all. The block breaks at the strike, within his reach as before (six blocks from his eye), and
> its six bars fly out of the face he struck at half the guitar's speed and fall, lying where they land, gone a beat
> after the strike. A tap during a
> swing is kept, the latest, and struck a beat after, swung back from his left: one block a beat. Walking, his legs
> walk on under the swing; in water it goes at his speed there over his walk. If the block is gone or changed by the
> strike, or he has gone out of reach, nothing breaks; going out as the hologram lets the swing go.

And in the "Him." paragraph, "the arms ... ride with the torso" stays true at rest; add that they turn on the
shoulders' line when he smashes.

### index.html

Nothing needs to change (the Break button and the hotbar are as they were). The keys line may say "click breaks
with his guitar".

---

## 8. How to test it

- **The form (Node)**: `NODE_PATH=/opt/node22/lib/node_modules node scripts/smash_check.js
  /home/user/site/docs/worlds/rocket` after pearl.js is changed. It builds his body, computes FAR_END, E0, Y_SH and
  ARMS_UP as smashFrom does (expect 66.168°, 1.00155 m, 77.98°, far end cell (23, 0, 1)), walks the whole swing for
  blocks from straight below to over his head, both sides, standing and at four points of the stride, and exits 1 if
  any cell of the arms or guitar enters the head's sphere or comes within a unit of the hat.
- **The game**: `node scripts/smash.js desk|phone <out> <port>` (with the harness's open(), the virtual clock at
  25 ms a frame). It ends any camera easing, finds open level ground off the homage and away from his tree, stands him
  there, puts the blocks it needs (w.set, remeshAt), taps them where they are on the screen (debug `screenOf`, then
  `act`), and records after every frame (a requestAnimationFrame callback queued after the game's) the swing's u and
  the blocks' ids. The cases, each a check:
  1. **A block a step ahead at his waist breaks at the strike**: solid in every frame with u < 1, air in the first
     with u ≥ 1, which is frame ⌈0.48 / 0.025⌉ = **20** after the tap (480 to 505 ms), and six bars in the next frame.
  2. Low (the ground one ahead, tapped on its top) and 3. at his head: the same frame.
  4. Five blocks ahead (within REACH): the same frame. 5. Eight ahead (beyond REACH): no swing, the block stands.
  6. **Rapid taps**, A, B, C at once: the latest (C) kept; A at frame 20, C a beat later, B never.
  7. The chain: B tapped in A's follow-through breaks after A, swung back (side −1).
  8. Walking (W held): the strike at frame 20, and the legs walk on (metres walked during the swing).
  9. In water: the strike at frame ⌈19.2 × 4.3 / 2.2⌉ = 38.
  10. The target taken away, and replaced by stone, before the strike: nothing breaks, no bars, the stone stands.
  11. The hologram at u ½: the block stands, the swing let go.
  12. A real tap (phone, the touchscreen) or click (desk, the crosshair turned onto the block): the swing and the break.
- **The frames to photograph** (third person, desk 1280×720 and phone 390×844): rest; u ¼ (coil), ½ (the top on his
  right), ¾ and 0.9 (downswing); 1 (the strike, the bars where the block was); two and five frames after (the bars
  flying); 1¼ (follow-through), 1½ (the top on his left), 1¾ (return); rest; the low and head blocks at the top and
  the strike; the chain's follow-through with B kept and the backhand's downswing; the hologram's let-go.
  `holdSwing(u)` holds a pose for its shot.

---

## 9. Measured (the prototype, in the game)

MEASURED_PLACEHOLDER

---

## 10. For the artist to settle

1. **The reach.** (a) as built: the blow breaks a block anywhere within his reach (six blocks), at the strike. Or (b):
   only what the guitar can meet; then he can no longer dig down (the guitar stays 0.48 m over his feet) or break
   anything over his head.
2. **Overhead.** The smash people picture comes down from over the head. His arms, bent to the guitar, meet his
   head's sphere at 77.98°, so the guitar rises only to his shoulders; over his head would need the right hand to let
   go and the guitar swung by its neck in the left (a new pose of the arms, not his drawn one).
3. **The hat**: turns with his upper body, as in the walk (built), or keeps to his eyes (then the arms' top on his
   left must stop at 64.4° to clear its brim by a unit, the swing no longer the same either side).
4. **The bars**: out of the face he struck, lying where they land, gone a beat after the strike (built); or lying on
   longer (until the next is struck); or gone as they land (the first run: then a wall block's bars are seen for about a
   fifth of a second).
5. **One block a beat** (2.08 a second at most): the theme song sets the digging rate, where a tap once broke at once.
6. **In water**: at his speed there over his walk, the strike at 0.938 s (built), or in half time, on the second
   beat (0.96 s, 2.3% longer).
7. **The swing passes into blocks beside him**: in a tunnel one block wide the guitar's cells go up to 0.18 m into the
   wall on his left at the top on that side (it is not stopped by the world, as his walk's guitar is not).
8. **A low strike while walking** puts the guitar 2.3 cm into the forward thigh (the walk alone 1.1 cm).
9. **The strap** turns into his back as the guitar rises (it is the guitar's), rather than staying on him.
