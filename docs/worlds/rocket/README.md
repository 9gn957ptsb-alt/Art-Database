# Rocket

A simpler game in the way of Minecraft's phone app, for now about one mission: finding the
pieces of your rocket. Served at `/worlds/rocket/`; `worlds/rocket/#<city key>` opens on a city.

You come to under a tree beside your wrecked capsule in one of the Artist Website's 28 cities,
rebuilt in one-metre blocks from its ground (`../../v2/grounds/city-*.json`): streets of asphalt
with pavements where they meet buildings, buildings of their real storeys (three blocks each,
lime, brick, render, concrete or glass by their age, slate or flat roofs, a grid of windows),
parks with oaks, water to swim in. The play area is 384 × 384 blocks round the crash, which is
set in a park inside the city.

Four pieces fell in four ways:

- **The engine** onto a roof (no more than 24 blocks up): stack blocks to climb to it.
- **The fuel tank** into a park: look for loose earth and dig.
- **The guidance computer** into the water: swim down (or, in a city with no water, under a
  square's paving).
- **The heat shield** into the top of a tree.

Break a block by tapping it (or clicking); switch to Place, or pick a block from the bar, to set
one. The arrow at the top points to the nearest piece still missing. With all four, go back to
the wreck, build the rocket, and launch.

On a phone: the stick on the left, drag to look, tap a block, the jump button (single steps are
climbed by themselves). On a computer: W A S D, drag to look, click; space jumps, 1–5 picks a
block, E switches break and place.

`rocket.js` is all of it: the city in blocks, the mesh (16 × 16 columns a chunk, shaded corners),
the view in the site's two-pixel grain, the hand, the opening, the rocket. Progress (the city
and what was found) is kept in the browser.
