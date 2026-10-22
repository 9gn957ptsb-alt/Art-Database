# The stick as a touch on water

**The idea.** Where the left thumb lands, the water answers once: a ring, never quite round, running out from under the thumb. The push draws that water out the way Mr Pearl is pushed, its front running on ahead of the thumb as far as the push is strong, and when the thumb lifts it smooths over.

**Steering by it.**
- *Centre:* the landing ring is centred where the thumb came down. While pushing, the drawn-out ring still hangs from that point, its sides trailing back to it.
- *Direction:* the front is drawn out along the push (cos^φ² of the angle off it). The light keeps to the front (cos^φ³), so the bright crest stands on the side he goes.
- *Strength:* the length. The front stands REACH + φ²·REACH·√push from the centre: 102 px at a third of a push, 145 px at a full one. That puts it 88 to 105 px ahead of the thumb, past a thumb's tip either way. A gentle push is also fainter, at 1/φ + (1 − 1/φ)·push.
- Shape, length and place carry all of this. Colour is only light and shade.

**Its numbers, as relations.** REACH = 40 CSS px is kept (input = offset / REACH), and every size is measured from it.
- The landing ring runs from REACH/φ (25 px, under the thumb's pad) to φ²·REACH (105 px).
- Its unroundness is the 2nd, 3rd and 5th harmonics at φ⁻⁶, φ⁻⁶ and φ⁻⁷ of its radius, phased by where the thumb lands, so the head stays the one perfect sphere.
- The drawn-out ring has radius REACH round the centre, with an echo ripple REACH/φ² behind its front.
- Lines are HAIR = REACH/32 (1.25 px), and crests are at most 2 HAIR. No area is filled.
- The warm light (247, 230, 200, between --cream and --glow) and the blue-violet shade (40, 44, 104) are each at 1/φ, side by side. The echo is at 1/φ² of the light.
- It is quiet by thinness, not by fading (DISPLAY.md 1.4.3). The pair holds at least 3:1 between its own two lines on every tone of the game: white posts 3.8, grey 4.3, black 5.1, Mr Pearl 4.0, sky 4.0.

Time is counted in beats (0.48 s, the theme song's 125 a minute):
- The ring spreads over 2 beats.
- The water follows the thumb a quarter of a beat behind.
- The light runs up its sides to the front once a bar.
- The unroundness turns once in 8 beats.
- Once lifted, it smooths over in 2 beats: the front sinks, the ring comes round, spreads by φ·REACH and fades as (1 − u)².

Ink: at most 0.3 % of the screen's pixels. The old disc covered 2.4 %, darkened, with a cream knob on it.

**Cost per frame.** It is a canvas and not CSS or SVG because it draws into #hud, which overlay() already clears and redraws every frame at min(2, dpr). It adds no layer, no DOM nodes and no style writes (the old knob wrote style.transform on every move), and it costs only its own fills.
- A held push is 3 slivers and 3 conic gradients, about 390 path calls.
- While the landing ring still spreads, it is 5 slivers and about 800 path calls.
- Measured in headless Chromium with software 2D: 0.22 ms a frame held, 0.35 ms at its busiest, 0.005 ms idle (one test).
- It draws nothing from 0.96 s after the thumb lifts.

**Reduced motion.** The ring appears at φ·REACH and only fades. There is no lag, no running light and no turning, and a lifted thumb leaves the shape to fade where it is. Nothing flashes: there are two thin lines once a touch, fading over 2 beats.

**Into rocket.js and rocket.css.**
- Paste `Water()` (water.js, beside this page) into rocket.js.
- Delete `<div class="joy" id="joy" hidden><i></i></div>` from index.html, and `.joy` and `.joy i` from rocket.css.
- wire() keeps its zone (left 40 %, lower 55 %) and its input maths. Only the drawing changes:

```js
var water = Water(), still = matchMedia("(prefers-reduced-motion: reduce)"), R = water.REACH;
// pointerdown in the stick's zone (no #joy, no knob):
stick = { id: e.pointerId, x: e.clientX, y: e.clientY };
water.down(e.clientX, e.clientY, performance.now() / 1000); $("notes").hidden = true; return;
// pointermove of the stick's finger:
var dx = e.clientX - stick.x, dy = e.clientY - stick.y, L = min(R, hypot(dx, dy)), a = Math.atan2(dy, dx);
input.side = Math.cos(a) * L / R; input.fwd = -Math.sin(a) * L / R; water.move(e.clientX, e.clientY); return;
// up or cancel of the stick's finger:
stick = null; input.fwd = input.side = 0; water.up(performance.now() / 1000); return;
// frame(now): water.step(dt, still.matches);
// overlay(now), after clearRect and before the smoke: if (!intro) { water.draw(c, now / 1000, still.matches); }
```

Beside this page: proto.html (a scripted thumb on a loop, or your own), frames 01–11 and sheet.png. Frames 10 and 11 lay a thumb over the water to show what a real thumb leaves visible.
