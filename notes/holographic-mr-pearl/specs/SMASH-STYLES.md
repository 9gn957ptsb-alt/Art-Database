# The smash, twice as fast, in three styles (design, 22 Oct 2026)

The artist, 21 Oct 2026: "The break animation by Mr Pearl has to be twice as fast and there should be 3 baseline
variations of the animation that are randomly used. Give the animations more style, look at different hand combat
styles of fighting (check out the game Mortal Combat) to develop these animations."

Built over the smash as published (SMASH.md, v10) and the sight (SIGHT-AND-THROW-SPEC.md). REACH stays 6 (the artist
has not answered on the reach).

## Twice as fast

The swing's clock counts **SWING = BEAT / 2 = 0.24 s** (an eighth note of the theme song) where it counted beats: the
strike half a beat after the tap, the whole swing a beat, a kept tap struck half a beat after the last: **two blocks
a beat**, forehand and backhand on the eighth notes. Its speeds double with it (the shoulders at two turns a beat at
the strike, the bars flying at half the guitar's speed, so twice as fast). The bars still lie a beat after the strike
(their fall is the world's, not the animation's). In water the clock still runs at SWIM / WALK.

## Three styles, one per way of turning the body

Mortal Kombat: Deadly Alliance (Midway, 2002) gave every fighter three styles, two of hand to hand and one with a
weapon, switched in a fight; here every swing takes one of three at random (`Math.random`, as asked). Each is a way
of putting the whole body behind the guitar that his rig can make (the arms turn only together, about the shoulder
line; the upper body about the spine; no knees to bend), and each is named for a move in the series:

| style | after | what he does | the relation |
|---|---|---|---|
| **the sweep** | Kitana's Fan Swipe; the broadsword's flat cut | as built: coil a quarter turn to his right, the guitar as high as his head lets it, cut across onto the block, follow through to his left | COIL, a quarter turn (SMASH.md) |
| **the slam** | Jax's Ground Pound; the hammer fist | springs up as the guitar goes up, comes down on the block as he lands: the strike is the landing; the guitar driven on down through it to where it hangs | the leap's flight is the swing's half beat under the game's gravity: up and down in SWING, h = g SWING² / 8 = 0.18 m |
| **the spin** | Kung Lao's Spin | turns his whole body a full turn on the spot, the guitar out at the block's height, and strikes as he comes round; his head stays on the block (a dancer's spotting: the eyes are drawn on his facing), his hips stop and his shoulders carry on through a quarter turn | a whole turn (four of the sweep's quarters) from rest at an even pull, so at the strike his body turns at four turns a beat |

The three are the figure's three ways of turning: about the spine (the sweep), about the shoulder line (the slam,
lifted by its leap), and the whole body about its upright (the spin).

## Style beyond the pose

- **The swoosh**: the guitar's path over the last half SWING, a ribbon between its far end and its neck's end, in the
  gold of its rib, fading back (as the pearl's trail fades), drawn only while it moves faster than he walks. The
  smear frame of animation (an arc in place of the many frames it would take), and the weapon trail of fighting games.
- No shake, no flash, no stop on the hit (SMASH.md §6): a hit-stop would undo "twice as fast".

## pose()

`act` gains `spin` (the whole body about the upright through his spine, + to his right, as twist) and `lift` (the
whole body up, metres). Both apply to every part and the head's frame after the walk's bob.

## Checks

smash_check.js over the three styles' poses (no cell of the arms or guitar in the head's sphere; the spin and the leap
move all of him together, so they add nothing new there). smash.js: the strike at frame 10 (0.24 s at 25 ms a frame),
two blocks a beat, each style forced in turn (a debug hook), the slam's leap and landing at the strike, the spin's full
turn by the strike, water at frame ⌈9.6 × 4.3 / 2.2⌉ = 19.

## For the artist

1. Random as asked; never the same twice running would read less like a loop (one line).
2. Two blocks a beat now dig twice as fast.
3. Overhead is still out of reach of his arms (SMASH.md §10.2); the slam's leap gives the downward blow instead.
