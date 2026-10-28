# Pickleball

Holographic Mr Pearl's courts as a game of their own, made to become a YouTube Playable. Served at
`/worlds/pickleball/`; packaged by `scripts/build_pickleball.js`.

The artist, 28 Oct 2026: "Let's focus all of our attention on the Pickleball mini game. It needs to be able to become a
playable on YouTube ... The movement by Mr Pearl and his nemesis, Mr Plan, are too robotic. They need to be more moving
more athletically than any athlete ever. I also am over the pixel aesthetic, I want the ASCII aesthetic built in. The
impossible triangle should not be the base unit for Holographic Mr Pearl anymore, it should be what I have prescribed
for the ASCII aesthetic".

## The game

The rocket world's courts (`../rocket/README.md`, "The courts"), their numbers and their rules: ten pickleball courts
side by side, 20 by 44 feet, the kitchen 7 feet from the net; level one on court one, first to three; Mr Pearl serves
every point, underhand and across, past the kitchen, the pearl his ball and his hat the paddle; the two-bounce rule; no
volley from the kitchen; the ring of `○` where Mr Plan's shot will come down; the rally counted and the longest kept. A
level won plays on by itself (his stand-in against that court's Mr Plan) and gives its tool to the Trojan horse, which
rises a part at a time beyond the courts; a match lost there stops the court and its tool until it is played again, a
level up. His nemesis is now **Mr Plan**, his negative (every colour turned over, lifted to show at night). The game
starts in front of court one: there is no place to go back to.

**Hands.** On a touch screen the left half is a stick (where the thumb lands is its middle), the right half a drag
that turns the view (the way his return goes), a tap anywhere serves; Serve and Scope are buttons. On a desk: WASD or
the arrows (Shift for full speed), a drag to turn, a click, Space, T or Enter to serve, R or the right button for the
Scope. His strokes are his own: when Mr Plan's shot comes, the game finds where his paddle can meet it and the stroke
goes then; the player's part is to be near, to aim and to serve.

**Views.** His own (the artist: "maintain the perspectives of Mr Pearl to play"): the third person behind his head,
his whole figure a third of the screen at rest, now on a critically damped spring so that his bursts read; and the
Scope, his head the glass and his nose the aim, its mark written `◎` and `+` (the tribar that marked it went with the
unit).

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
| reach | 1.0 m standing, 2.1 m lunging, 3.8 m diving | his paddle (the hat) a third of a metre past his glove |
| leap | 1.6 m | the best standing vertical jumps measured are about 1.2 m |

The rig is on PearlBody's parts (`../rocket/pearl.js`): two-bone legs solved to where each foot goes, the upper body
dropped, bent at the hips and twisted for the stroke, the right arm turned about the shoulder so that the paddle is
where the stroke wants it, the left for balance, the hat held in his right glove (the brim's round the paddle's face),
the Koa bass on his back.

Level shows in how soon Mr Plan reads the pearl (0.42 s at level one, 0.03 less a level), how rarely he misses (26%
of his shots out or in the net at level one, down to 3%), how often his dives get there (half at level one), and how
he places it: deeper, wider, faster (1.25 s across at level one, down to 0.72), dinks into the kitchen from level
three, lobs to be leapt for.

## ASCII, built in

The only way a frame reaches the screen. The scene (plain solids, plainly lit: the courts at night under their
floodlights, the athletes' cells, the pearl, the horse) is drawn into a picture of its own, and the picture is written
again as characters, each a cell whose side goes as the square of nearness (6 CSS px at 3.2 m, the artist's rule from
the rocket world), never under 5 CSS px on a phone or 6 on a desk, and never the picture itself: far off a thing is
small characters, and the sky is characters too. A cell's colour is the picture's mean over it, its character chosen by
its lightness, lit in its colour, the light ones glowing, black between. **The unit** is what the artist prescribed for
the ASCII aesthetic, in place of the impossible triangle: Glyph Light's ASCII style with the keyboard's characters and
the site's category marks in one set (` .:-=+*#%@` and `∴∵→○◇△◎¶▢◆`; the artist, 28 Oct 2026: "Do marks and keyboard
characters"), sorted by the ink each leaves, measured on the device (in Chromium's fonts:
` .-:→△∴∵*◇+▢=○%◎◆#¶@`). Mr Pearl's head is the one thing seen as it is, the perfect sphere (his rule 5); every word
and control is a page element over the characters.

## YouTube Playables

What the bundle does for the Playables SDK (`https://www.youtube.com/game_api/v1`, read at 1.20261019.0100):

- **The SDK first.** `build_pickleball.js --playable` puts it as the first script, plain (its `firstFrameReady()`
  checks that). The site's own page never loads it.
- **Ready.** `firstFrameReady()` after the first (black) frame, `gameReady()` after the first frame of the courts.
- **Pause.** `onPause` cancels the frame and stops the game's own clock (nothing catches up at `onResume`) and saves;
  the Page Visibility API is never used.
- **Save.** Through `saveData`/`loadData` inside YouTube (well under 3 MiB: the courts, the horse and the longest
  rally), `localStorage` only outside.
- **Score.** `sendScore` with the longest rally, an integer, when it grows.
- **Language.** From `getLanguage()`, never the browser's; English only for now (every word is in one table, `STR`).
- **No sound** (so nothing to mute), no links, no requests but the SDK, every script a static tag (YouTube's CSP puts
  nonces on them), no inline script, no `eval`; any aspect ratio, touch, mouse and keys; a frame with no size (the
  Android app's first, hidden one) draws nothing and breaks nothing.
- **Size.** The zip is about 60 KB (five files).

`node scripts/build_pickleball.js --playable <dir>` writes the folder and `<dir>.zip`; `--artifact <file.html>` one
self-contained page (no SDK). Getting it onto YouTube is the artist's part: Playables is invitation-only (the interest
form, the Playables Developer Portal, a release tested with the hosted SDK Test Suite on desktop, mobile web, Android
and iOS, then certification).

**Weak:** the official requirement pages (developers.google.com) could not be read from the session that built this,
only through search results, and the hosted Test Suite could not be run; the checks are a mock of the SDK and the real
SDK outside YouTube (`notes/holographic-mr-pearl/harness/pb_playables.js`). The grid of characters is fixed to the
screen, so what moves fast shimmers cell to cell. The marks outside the monospace font come from whatever font the
device has, so the order of the set differs a little by device. The rest of Holographic Mr Pearl still draws in the
impossible triangle; this game is the first in the new unit.
