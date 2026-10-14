# Worlds

A wager game on the Artist Website's globe. The site uses the globe to show what is
real: art, museums, buildings. Worlds keeps that look and changes what the globe is for.

It opens far out, on the solar system as it stands today: the sun, the eight planets where
their orbits put them now, and the Earth and Mars drawn as themselves. Press the Earth or Mars
(or its pill at the foot) to go down to it. Pull back far enough, press Escape, or press
*Solar system* to come up again. The other planets have not been reached yet.

Close to the Earth, the Artist Website's 28 cities are marked with small squares. Press one,
or keep zooming in over it past the globe's nearest, and you go down into its streets at eye
height (`street.js`): every building cell of the site's ground for that city
(`docs/v2/grounds/city-*.json`) stood up at its storeys, the greens with trees, the water
taking the sky, and the city's museums as the site models them (`docs/v2/models/`), set in at
their points to be walked round. It is lit by the real sun for that place and hour, with
windows and museums lit at night, and drawn in the site's two-pixel grain. Arrows or W A S D
walk, drag looks, pressing the ground walks there, Shift strides, Escape rises. A link such
as `worlds/#paris-fr` goes straight into a city.

## How it plays

Each world begins with a crash. You come to under a tree, as a film opens: dark, the eyes
opening and closing, the branches out of focus overhead, sitting up, turning to the smoking
wreck. The way off is to find the parts of a rocket where you came down, build it at your
tree, and launch in the window.

- **Choose your ground.** Pick any country on Earth; three houses rise elsewhere. You come down
  in the walkable city nearest it (the Artist Website's 28 cities, at street level).
- **Find the parts, as in Clue.** The engine, the fuel tank, the guidance computer and the heat
  shield are hidden at the city's places: its museums, its tallest and oldest buildings, its
  largest park, its riverbank, a bridge, a square, a great crossing. Walking to a place
  searches it: what is there is found, the place is ruled out for every other part, and
  someone there (a guard, a street sweeper, the wreck's log) rules out one more. The notebook
  keeps where each part may still be, and says when only one place is left.
- **Mind the traffic, as in Frogger.** Cars run the city's streets. Struck, you come to again
  under your tree, with what you found still found.
- **Build and go.** With every part, go back to your tree to build the rocket; launch when Mars
  is about 44° ahead of the Earth (a 259-day transfer, every 26 months; a turn is a month).
- **Mars.** Choose where to come down. You wake under the greenhouse olive, thrown clear. The
  ground is made from what that region of Mars is (`mars-ground.js`): craters and their rims,
  an ice cliff in a crater's shaded wall, a lava tube's skylight, a dune field, a dry
  riverbed, an old lander. Its parts are what Mars asks of a rocket made there: an ice drill,
  a propellant plant, a solar array, an ascent engine. Its traffic is the dust devils. Home,
  when the Earth is about 75° behind Mars, and you have found the way between worlds.
- **Wagers.** Up on the globe, stake marks on territories that border yours; you win with the
  chance *stake ÷ (stake + garrison)*. A house crosses to another world only once it has made
  the journey there. A house holding two fifths of all the yield also wins.

The game is saved in the browser (`localStorage`). There is no account and no real money.

## Running it

It is a static page with no build step, deployed with the rest of `docs/` by
`.github/workflows/pages.yml`: <https://9gn957ptsb-alt.github.io/Art-Database/worlds/>.
Locally, serve `docs/` (`python3 -m http.server -d docs 8000`) and open `/worlds/`; Earth's
look is read from `../v2/earth-dirt/`, so the page needs the site beside it.

## Files

| | |
| --- | --- |
| `index.html`, `style.css` | The page. |
| `../v2/earth-body.js` | The Earth: the Artist Website's own body of the globe, lit by the real sun. Worlds sets `EarthBody.base` to `"../v2/"` so it finds its files. |
| `body.js` | Mars and the other planets, drawn the same way in WebGL 2 (crisp cells, light from the sun, thin air at the limb), plus the territories laid over any world, the Earth included: a wash of the holder's colour and a one-pixel hairline where territories meet. |
| `street.js` | A world at eye height, in WebGL 2: the site's ground for a city (or Mars's own), its museums' models (via `../v2/models.js`), the real sun, collision, the traffic, the crash and the opening. |
| `escape.js` | The way off each world: the parts and the hunt for them, building, the windows, the journeys. |
| `mars-ground.js` | Mars at eye height, made for the region you come down in. |
| `game.js` | The rules and the other houses' play. It does not touch the page. |
| `app.js` | The scene: the solar system, the way down to a world and back, the card, the names, input. |
| `earth/`, `mars/` | Each world's board: `land.png` (its territories), `territories.json`, and Mars's `body.png` (its look). |
| `scripts/build_worlds.py` | Builds the boards from `scripts/worlds_src/`. |

Every world uses the Artist Website's half-degree grid: 720 × 360 cells, column 0 at 180° W,
row 0 at 90° N. `mars/body.png` is 1024 × 512, like the Earth's body. In `land.png` red + 256 × green is the territory id + 1.

## Sources

- **Earth's look:** the Artist Website's body of the globe (`docs/v2/earth-body.js`), every
  cell a saved work's colour, read in place.
- **Earth's territories:** Natural Earth 1:110m countries (public domain).
- **Mars's look:** the Viking MDIM 2.1 colour mosaic (NASA / USGS, public domain). Its
  contrast is stretched, then each cell takes the nearest colour among the works the Earth's
  body is made of (`docs/v2/earth-doors.json`), leaving out the Earth's seas and greenery.
- **The planets' places:** mean orbital elements for J2000 (JPL's approximate positions),
  so each planet stands where it is today. Distances are on a root scale; sizes are for the
  eye.
- **Mars's territories:** 32 named regions at their IAU coordinates; each cell belongs to the
  nearest region.

Rebuild after changing a source:

```bash
pip install numpy pillow
python3 scripts/build_worlds.py
```

## Adding a world

A new world needs a `body.png` and a `land.png` on the same grid, plus a `territories.json`,
built the way `build_mars` builds Mars. A world with no source map (an invented planet) can
take its look from noise in the paintings' colours and its regions from points placed by
hand. To join it to the others, add its name to `Game.WORLDS`, load it in `app.js`, and give
the crossing links a rule for which world lies under which.
