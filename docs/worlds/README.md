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

Worlds is about finding the way off each world and on to the next, made of what each world
really is (`escape.js`). Wagers are how you win the ground and the marks the way off needs.

- **Choose your ground.** Pick any country on Earth. Three houses rise elsewhere.
- **Everything is taken by a wager.** Stake marks on a territory that borders yours; you win
  with the chance *stake ÷ (stake + garrison)*. A win takes it and 60% of the stake stays as
  its garrison; a loss spends the stake, 30% of it to the defender. Each month every house is
  paid 10 plus the yield of all it holds.
- **The way off the Earth.** Hold the country of a real launch site (Kourou, Alcântara,
  Sriharikota, Wenchang, Cape Canaveral, Baikonur…): the nearer the equator, the more the
  Earth's spin gives (0.465 km/s × cos latitude). Wait for the window: a 259-day Hohmann
  transfer needs Mars about 44° ahead of the Earth, which comes round every 26 months (a turn
  is a month, and the solar system moves with it). Pay for the propellant by the rocket
  equation (9.4 km/s to orbit with gravity and drag losses, 3.6 to Mars, 0.6 to land; a
  20-tonne payload): kerosene is cheap but heavy, hydrogen light but dear, methane between.
- **The way off Mars.** Come down anywhere no one holds. Mars has no one to buy from: hold its
  ice (the caps 8 t a month, Vastitas Borealis 5, the buried ice of Utopia and Arcadia 3) and
  ground near the equator for the sun that powers the plant, through the dust storms of its
  southern summer. Lift off (4.1 km/s to orbit, less from the high volcanoes, 2.3 more home)
  when the Earth is about 75° behind Mars.
- **No boundary between worlds, once found.** A house crosses to a world only after it has
  made the journey there; then every territory borders the ground of the other world beneath
  it. Home again, you have found the way between worlds. A house holding two fifths of all the
  yield also wins.

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
| `street.js` | A city at street level, in WebGL 2: the site's ground for it, its museums' models (via `../v2/models.js`), the real sun, collision with walls and water. |
| `escape.js` | The way off each world: launch sites, windows, the rocket equation, Mars's ice and sun, the journeys. |
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
