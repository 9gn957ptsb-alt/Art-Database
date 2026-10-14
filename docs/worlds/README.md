# Worlds

A wager game on the Artist Website's woven globe. The site uses the globe to show what is
real: art, museums, buildings. Worlds keeps that look and changes what the globe is for.

## How it plays

- **Choose your ground.** Pick any country on Earth. Three houses rise elsewhere.
- **Everything is a wager.** Stake marks from your treasury on a territory that borders
  yours. You win with the chance *stake ÷ (stake + garrison)*. A win takes it, and 60% of
  the stake stays as its garrison. A loss spends the stake, and 30% of it goes to the
  defender.
- **No boundary between worlds.** Every territory also borders the ground of the other world
  that lies under it. France lies over Acidalia Planitia, Lunae Planum and Arabia Terra.
  Mars starts unclaimed: no one lives there, so it is cheap to take and yields little.
- **Each turn** every house is paid 10 plus the yield of all it holds. A house holding two
  fifths of all the yield, on every world together, wins.

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
| `globe.js` | The woven globe: the dots on the sphere, lit from one side, plus turning, zooming and picking. |
| `game.js` | The rules and the other houses' play. It does not touch the page. |
| `app.js` | The page wired to the game: the panel, the crossing between worlds, input. |
| `earth/`, `mars/` | Each world's board: `land.png` (its territories), `territories.json`, and Mars's `dots.png` (its look). Earth's look is the site's `docs/v2/earth-dirt/earth-dirt-MM.png`. |
| `scripts/build_worlds.py` | Builds the boards from `scripts/worlds_src/`. |

Every world uses the Artist Website's half-degree grid: 720 × 360 cells, column 0 at 180° W,
row 0 at 90° N. In a world's dots picture a pixel's colour is the dot's colour and its alpha is the dot's
size (0, 85, 170, 255 → sizes 0–3). In `land.png` red + 256 × green is the territory id + 1.

## Sources

- **Earth's look:** the Artist Website's `docs/v2/earth-dirt/earth-dirt-MM.png`, one per
  month, read in place, each place dressed in the colours of the saved paintings nearest it. The page shows
  the current month.
- **Earth's territories:** Natural Earth 1:110m countries (public domain).
- **Mars's look:** the Viking MDIM 2.1 colour mosaic (NASA / USGS, public domain). Its
  contrast is stretched, then each dot is moved to the nearest of the paintings' colours.
- **Mars's territories:** 32 named regions at their IAU coordinates; each cell belongs to the
  nearest region.

Rebuild after changing a source:

```bash
pip install numpy pillow
python3 scripts/build_worlds.py
```

## Adding a world

A new world needs a `dots.png` and a `land.png` on the same grid, plus a `territories.json`,
built the way `build_mars` builds Mars. A world with no source map (an invented planet) can
take its look from noise in the paintings' colours and its regions from points placed by
hand. To join it to the others, add its name to `Game.WORLDS`, load it in `app.js`, and give
the crossing links a rule for which world lies under which.
