# Holographic Mr Pearl: Pickleball

The artist, 28 Oct 2026: "Name the pickleball game: Holographic Mr Pearl: Pickleball".


Holographic Mr Pearl's courts as a game of their own, made to become a YouTube Playable. Served at
`/worlds/pickleball/`; packaged by `scripts/build_pickleball.js`.

The artist, 28 Oct 2026: "Let's focus all of our attention on the Pickleball mini game. It needs to be able to become a
playable on YouTube ... The movement by Mr Pearl and his nemesis, Mr Plan, are too robotic. They need to be more moving
more athletically than any athlete ever. I also am over the pixel aesthetic, I want the ASCII aesthetic built in. The
impossible triangle should not be the base unit for Holographic Mr Pearl anymore, it should be what I have prescribed
for the ASCII aesthetic".

## The game

The rocket world's courts (`../rocket/README.md`, "The courts"), their numbers and their rules: a pickleball court,
20 by 44 feet, the kitchen 7 feet from the net; first to three; Mr Pearl serves every point, underhand and across, past
the kitchen, the pearl his ball and his guitar the racket (below); the two-bounce rule; no volley from the kitchen; the
ring of `○` where Mr Plan's shot will come down; the rally counted and the longest kept. His nemesis is now **Mr Plan**,
his negative (every colour turned over, lifted to show at night).

**Endless courts** (the artist, 28 Oct 2026: "get rid of the Trojan horse being built [and] any architecture that is
outside of the [plain] courts. Instead, we are simply going to have an ad infinitum pickleball game. Initially the game
starts with just 1 court. Once you beat that first court, the second court adjacent to it then appears. This applies
each time you win a court. Previous courts still automatically play and you win each game as you advance. The goal is
to see how many courts you can win. each court gets progressively harder. By the time you get to court 10, the game
should be very hard"). The game starts in front of one court, under its floodlights, and nothing else stands there.
A match lost starts again from love on the same court; a court won plays on by itself (his stand-in against that
court's Mr Plan, never losing a match) and the next court appears beside it, harder. There is no last court. The
score is the number of courts won; the HUD keeps the last ten as squares (filled while they play on by themselves,
gold while he plays one).

**The serve** (the artist, 28 Oct 2026: "I want you to be able to serve up [to] 3 balls in one serve so you can play
multiple balls/points at once. Use the scope view for the every serve and add an animation that you have to land a bar
within a certain zone to have the opportunity to ace your opponent. Depending on where you click to stop the bar
depends on how hard you serve"; later, "Get rid of the scope view in the Pickleball game"). At his serve the third
person's view turns to face across the net (where it looks, inside the diagonal service court, the serve goes; a drag
aims it), and a bar of characters runs in the dark above the net, a `◎` sweeping it there and back (1.15 s each way on
court one, quicker each court), its instruction written under it. A tap stops it, and where it stops is how hard he serves: `. . .` too soft (the pearl falls in the kitchen, a
fault), then `- = + *` softer to harder (deeper and quicker), `◆` the gold ace zone (hard into the deep corner: a
chance at an ace, four in five at level one and a twentieth less each level, Mr Plan going for it at full stretch and
not getting there), `#` hard, `△` long (a fault). After each pearl the mark sweeps again: up to three pearls a serve
(`○ ○ ○` above the bar, `◎` as each goes), while the serve is open (until 1.3 s after the last), each pearl a point of
its own, all of them played at once; then the view is the third person's again. Mr Plan has one body: two pearls close
together, and one may get by him; Mr Pearl, the same.

**Hands.** Touch and mouse alike (YouTube asks both for everything): the left half is a stick (where the finger or the
press lands is its middle), the right half a drag that turns the view (the way his return goes), a tap or a click
anywhere stops the serve's bar; Serve and Super are buttons. On a desk the keys too: WASD or the arrows (Shift
for full speed), Space, T or Enter to stop the bar, E or Q for the super return. His strokes are his own: when Mr Plan's shot comes, the game finds where his paddle can meet it and the stroke
goes then; the player's part is to be near, to aim and to serve.

**Views.** His own (the artist: "maintain the perspectives of Mr Pearl to play"): the third person behind his head,
his whole figure a quarter of the screen's height at rest (the rocket world has a third; the artist, 28 Oct 2026: "The
third person view should be a little farther out for Pickleball given the speed in which Mr. Pearl can now move"), on a
critically damped spring so that his bursts read. The lens is 58 degrees top to bottom (it was 70: the far court and Mr
Plan a quarter larger). The Scope, his head the glass, went (the artist, 28 Oct 2026: "Get rid of the scope view").

## The athletes

Nothing moves at a constant speed. Each body is driven by what it wants (the stick's velocity, or a spot to be at by
a time) through limits no person has reached, and its pose follows from what it is doing every frame: it leans into
its acceleration, drops when it brakes and when it is ready (a small bounce on the balls of the feet), strides by the
ground it covers (the feet never slide; the stride lengthens with speed), pumps its arms, skids when it stops from a
sprint (dust), turns once round on a planted foot when a sprint reverses, hops a split-step whenever the other strikes,
and lands low. Every stroke is scheduled: where and when the pearl can be met is found ahead, and the stroke winds up
so that the paddle is there then (wind-up, contact, follow-through), with the run, the lunge, the dive (flat out,
landed, a roll, up again) or the leap (a scissor kick at the top, the overhead) that it needs. A point won is a
standing backflip; a point lost, a shake of the head. Mr Plan has a showman's streak: on some returns (14% a dive and
14% a lunge at level one, more each level) he goes for the dive or the lunge on purpose, and at the lower levels his
dives often fall short.

| | | why |
|---|---|---|
| top speed | 13 m/s | Usain Bolt's measured peak (Berlin, 2009) was about 12.4 m/s |
| acceleration | 30 m/s² | a sprinter's first steps are about 8 to 10: 6 m/s in a fifth of a second |
| braking | 42 m/s² | he stops harder than he starts; above 6 m/s a stop is a skid |
| reach | 1.25 m standing, 2.35 m lunging, 4 m diving | his arm and his guitar make a lever a little over a metre from shoulder to bout |
| leap | 1.6 m | the best standing vertical jumps measured are about 1.2 m |

The rig is on PearlBody's parts (`../rocket/pearl.js`): two-bone legs solved to where each foot goes, the upper body
dropped, bent at the hips and twisted for the stroke, the right arm turned about the shoulder so that the paddle is
where the stroke wants it, the left for balance. **The racket is his guitar** (the artist, 28 Oct 2026: "Mr Pearl should be playing with his
Guitar as the racket too, not his hat", as he smashes with it in the rocket world): the Koa bass held by the neck in
his right glove a hand's width below the nut, along the line of his arm, its lower bout the face, turned to where the
shot goes; its strap left off (swung, it would loop out); his hat back on his head. Mr Plan and the stand-ins play
with theirs the same way.

Each court is harder than the last, along one curve: its share of the hardest is 1 - e^(-(court - 1) / 3), so 0.28
at court two, three quarters at five, 0.95 at ten, and nearer the whole each court after without reaching it. Along it
go how soon Mr Plan reads the pearl (0.42 s on court one, 0.125 at the hardest), how rarely he misses (26% of his shots
out or in the net, down to 6.6%), how often his dives and lunges get there, how he places it (deeper, wider, faster:
1.25 s across, down to 0.845), dinks into the kitchen from court three, lobs to be leapt for, and the serve: its bar
quickens (1.15 s a sweep, down to 0.71) and the ace zone pays less often (four in five, down to three in ten).
Measured by `notes/holographic-mr-pearl/harness/pb_curve.js` (12 matches a court; the ideal player always on the ring,
the human one a fifth of a second late and up to 0.9 m off it):

| court | 1 | 2 | 4 | 7 | 10 | 15 | 30 |
|---|---|---|---|---|---|---|---|
| points won, human | 97% | 100% | 80% | 53% | 39% | 33% | 18% |
| matches won, human | 12 | 12 | 12 | 7 | 3 | 2 | 0 |
| points won, ideal | 97% | 97% | 95% | 81% | 55% | 47% | 31% |

## ASCII, built in

The only way a frame reaches the screen (the artist, 28 Oct 2026: "The graphics for the Pickleball game [are] not
refined enough, I can't make anything out as the user. Make sure it looks hyper polished, just because we are using the
ASCII aesthetic, doesn't mean we can't achieve any other aesthetic. We are just achieving the aesthetic using the
characters and marks in ASCII"). Three prototypes (form, light, type) were made against the same six pictures
(`notes/holographic-mr-pearl/harness/pb_look.js`), judged, and merged:

- **Type.** The picture is set as a terminal sets it: cells as wide as the font's advance and as tall as its `|`, so
  bars join into one line and `_` into one rule; the glyphs drawn crisp at every size the grid uses. A cell's size
  still goes as the square of nearness (the artist's rule from the rocket world, 6 CSS px at 3.2 m, in octaves), but
  never under 8 CSS px on a phone or 12 on a desk (it was 5 and 6: glyphs four pixels high, which no one could read)
  nor over one octave more. A far athlete is set an octave under the floor where a glyph keeps twelve device pixels,
  and the pearl an octave over, the one character the game hangs on.
- **Form.** Each pixel carries its material, so each thing writes its own alphabet: Mr Pearl the keyboard's (` .:+*#%`,
  Glyph Light's style), Mr Plan the site's marks (` ∴○◇◆`, his negative), a court surface one quiet glyph spaced by its
  light, the net `#`, a pole `|`, a lamp `*`, the pearl one `◎`, a few stars fixed to the sky. A figure's edge is a
  stroke turned the way the edge runs (`| / \ _ -`, as in Acerola's ASCII shader, 2024), over a quieter fill; his hat
  is a shape of its own, so from behind hat and back are two; a court line is one stroke the way it runs on the screen,
  `+` where two cross.
- **Light.** A designed night: each court in its own floodlight pool with dark seams between, the athletes lit by
  their court's four lamps, a key held to the view, a rim and a darkening toward the feet, contact shadows (a pearl's
  wider and fainter the higher it flies), haze; the athletes and the pearl brightest, the courts in the middle, the
  ground and the sky dark. Each character is lit in the colour under it, its value the cell's light, the brightest
  blooming inside its cell; black between.

- **Definition** (the artist, 28 Oct 2026: "It's still really hard to see anything, objects need to be three times as
  defined as they are now"). `pb_define.js` measures it: each athlete's exact footprint (the frame drawn plainly with
  and without him), the frame he is seen in blurred by a cell (a glance), and D, his light against a ring of ground
  two cells round him, (inside − ring) / (ring + 0.05); and S, how closely that light keeps his silhouette. The
  athletes are set in a heavy cut of the same characters (each glyph stroked round, in the atlas's third channel), at
  full brightness, glowing, their colour lifted toward white only as far as it must be to be bright (the guitar keeps
  its orange); Mr Plan's fill his ◇ ◆ with the keyboard's densest `# % @` (his thin marks left most of each cell
  dark); the courts' surfaces quieter; two cells of night round every figure (the first dark, the second dimmed), as
  type is knocked out of a busy picture; and the lens narrowed from 70 to 58 degrees, so the far court and Mr Plan are a
  quarter larger while Mr Pearl keeps his quarter of the screen (the camera further back). The artist after the first
  round: "Define it five times as much, it's still a bit too hard to see. I like the direction".

  | D (S) | the look before | the first polished look | three times | now |
  |---|---|---|---|---|
  | Mr Pearl, phone rally | 1.37 (0.81) | 0.75 (0.65) | 1.96 (0.88) | 3.33 (0.89) |
  | Mr Pearl, phone walk | 2.05 (0.86) | 0.76 (0.64) | 2.30 (0.89) | 3.83 (0.89) |
  | Mr Plan, phone rally | −0.01 (0.12) | 0.74 (0.45) | 2.37 (0.65) | 3.92 (0.72) |
  | Mr Plan, phone walk | −0.02 (0.10) | 0.75 (0.54) | 1.92 (0.59) | 3.23 (0.67) |
  | Mr Plan, desk, close | 0.17 (0.39) | 0.77 (0.69) | 3.70 (0.85) | 4.97 (0.91) |

  D has a ceiling near 5: a figure at full white on black still lights the ground round it at a glance with its own
  glow (with the courts' surfaces switched off the ring hardly darkens), so past the third round the gain is in size
  (Mr Plan's figure 37% more of the screen) and in the heavy type, not only in D.

- **Colour** (the artist, 28 Oct 2026: "Use color to find middle grounds between high contrast points or things being
  too black or too white. It needs a lot more interesting colors"). Nothing is bare black or bare white. The night is a
  faint field of dots, indigo overhead turning violet and rose toward the horizon, with peach and ice stars; the ground
  off the courts a deep teal; the court ultramarine (`:`), the kitchen turquoise (`∴`), the run-off emerald, the lines
  ivory, the net plum, the posts lilac steel, the lamps amber; the floodlights cast amber in their pools and the night's
  blue in the seams. The ground's characters glow in their colour, so colour, not black, fills the dark between them
  (glow, never a flat fill). Mr Pearl is champagne with a gold outline, Mr Plan ice with a cyan one: they still stand
  out (D 2.7 to 5.0), by hue as well as light. The cell of night round them is a dim indigo, not a hole.

Mr Pearl's head is the one thing seen as it is, the perfect sphere (his rule 5); every word and control is a page
element over the characters.

## Effects

The artist, 28 Oct 2026: "There should be small explosions every single time you hit the ball and there should be air
animations or court animations about how Mr. Pearl moves around in interacts with the surface of the court and the
air". In characters over the view, each from where it is on the court and as large as its distance makes it, lit
additively (a spark over a spark is brighter): a burst at every stroke (a white-hot `*`, sparks of `* + ◆ ◇ ∴ %`
falling a little, a ring of `·`; the serve, his returns and the stand-ins' warm, gold to rose, Mr Plan's cool, cyan to
violet; bigger for an overhead or an ace); at each footfall a puff of `. : ∴` and a scuff (`_`, `=` at a sprint) that
fades from the court; behind a sprint a wake of `~ - =` at his chest and hips; round a leap or a dive the air turning
(`∴ ∵ ~`); at a hard landing a ring rushing out along the court; at a skid, streaks. Their chance is their own, so the
game plays the same with or without them. `pb_game.js` checks a burst at every stroke and the footfalls' marks.

## YouTube Playables

Checked against YouTube's own requirements (developers.google.com/youtube/gaming/playables, read 28 Oct 2026: the
integration, stability, design, privacy, language, money, accessibility and trust pages, the SDK reference at
1.20261019.0100 and the Test Suite guide). What the bundle does:

- **The SDK first.** `build_pickleball.js --playable` puts it as the first script, plain (its `firstFrameReady()`
  checks that). The site's own page never loads it.
- **Loading, then ready.** The page opens on the words "Loading the courts…" over black; `firstFrameReady()` is called
  under them (the rule: only while a screen says it is loading). They go the frame the courts are first drawn, and
  `gameReady()` follows, so nothing is shown that cannot be played.
- **Pause.** `onPause` cancels the frame, stops the game's own clock (nothing catches up at `onResume`), drops what
  the hands were holding and saves; while paused no touch, click or key does anything; a resume that comes while it
  is still loading waits for the courts. The Page Visibility API is never used.
- **Mute.** No sound yet; YouTube's mute is read (`isAudioEnabled`) and followed (`onAudioEnabledChange`) all the
  same, so a sound added later starts from it.
- **Save.** Through `saveData`/`loadData` inside YouTube (a few bytes: the courts won and the longest rally), only
  after the load, `localStorage` only outside. A save from any version, or a broken one, is read field by field as
  counts, or as a fresh start (the first version's ten courts as the run of them won from the first; its horse goes). A load that fails is asked again once; if it fails again the game plays
  and never saves, so the player's cloud save is never written over.
- **Score.** `sendScore` with the number of courts won, an integer, each time a court is won, saved first: the best
  sent is always the save's, as the rule asks.
- **No end.** The courts go on without a last one, so the rule to tell the player there is no more has nothing to tell.
- **Sharp.** Drawn at the screen's own pixels up to 3 to 1 (a phone's), so the characters are not upscaled soft.
- **Language.** From `getLanguage()`, never the browser's; English only for now (every word is in one table, `STR`).
- **No sound** (so nothing to mute), no links, no sharing, no requests but the SDK, every script a static tag, no
  inline script, no `eval`, no workers; any aspect ratio, touch, mouse and keys; Esc left alone; a frame with no size
  (the Android app's first, hidden one) draws nothing and breaks nothing.
- **Any shape.** Every ratio YouTube names, 9:32 to 32:9, at its long side 1280 and at its smallest real screen: the
  view fills it, the state is kept through a resize, and no word, button or the serve's bar covers
  another (the words step aside while the bar runs; its instruction is written under it). The faint words and squares
  of the HUD keep 4.5 to 1 against black (WCAG AA).
- **Size.** The zip is about 63 KB (five files, none over 110 KB). His body's notes (the form study's "note" and
  "relation" lines, with the makers and models they name) are left out of the bundle.

`node scripts/build_pickleball.js --playable <dir>` writes the folder and `<dir>.zip`; `--artifact <file.html>` one
self-contained page (no SDK). `notes/holographic-mr-pearl/harness/pb_playables.js` checks all of the above with a
mock of the SDK, then the built bundle with the real SDK, served with YouTube's Content Security Policy header (the
string the Test Suite guide gives) and nothing refused; `pb_aspect.js` the ratios. Getting it onto YouTube is the artist's part: Playables is
invitation-only (the interest form, the Playables Developer Portal, a release tested with the hosted SDK Test Suite
on desktop, mobile web, Android and iOS, then certification). At the portal the artist picks the accessibility tags
(the Entertainment Software Association's Accessible Games Initiative; a wrong tag breaks the rules) and confirms the
trust pages: for everyone 13 and over and not made for children; the characters, the music (none) and the names the
artist's own or cleared.

**Weak:** the hosted Test Suite needs the game at a public address with the SDK, which this session could not give
it; the checks are a mock of the SDK and the real SDK outside YouTube. The grid of characters is fixed to the screen,
so what moves fast shimmers cell to cell. The marks outside the monospace font come from whatever font the device
has, so the order of the set differs a little by device. Drawn at 3 to 1, a phone fills twice the pixels it did at 2:
the frame rate there is unmeasured. The rest of Holographic Mr Pearl still draws in the impossible triangle; this game
is the first in the new unit.
