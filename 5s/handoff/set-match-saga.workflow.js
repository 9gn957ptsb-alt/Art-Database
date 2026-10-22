export const meta = {
  name: 'set-match-saga',
  description: 'Set as a game: a Pinterest-style mood board of liked objects and a Candy Crush Saga-style match game whose swaps make juxtapositions; built as modules + a harness, tuned by simulated play',
  phases: [
    { title: 'Design', detail: 'the game brief: suits, specials, goals, saga, associations, the board, gestures, data, API' },
    { title: 'Build', detail: 'match engine + level generator + tests; play and board components + harness (in parallel)' },
    { title: 'Playtest', detail: 'bots tune the levels; touch play at 390 px; look, feel, fix' },
  ],
}

const ROOT = '/home/user/Art-Database'
const SCRATCH = '/tmp/claude-0/-home-user-Art-Database/d9dbf1fb-700e-5758-9376-62e2073ec507/scratchpad/set-game'

const WORDS = `The artist, 22 Oct 2026, over a screenshot of Set's current room (a lilac wall with a window, a framed picture, an object photo and a Pollock-like floor, with the list Wall / Window / Picture / Floor / Object under it):
"We need to combine this part of the app with Candy Crush Saga. Instead of displaying a wall where you can hang things, I want the presentation of liked objects to appear more like a mood board that you would find on Pinterest. Furthermore, you are able to reinforce juxtapositions of aesthetics by associating compliments [complements] that you like between liked objects. The way in which you draw those associations should be the same gestures you find in Candy Crush Saga. That part of the app perhaps should be the most game-like and should be able to be played just like Candy Crush Saga."
Earlier, on the whole app: "It's gonna be a game of subtraction and negation rather than a game of addition." "You make it into a game." "It really is a judgment app." Irwin: "At every given moment you can go three or more ways." Standing rules: add, never take away (the room stays reachable, one tap away, but the mood board replaces it as Set's presentation); nothing to download; no one pays (no lives you wait for or buy, no paid boosters, no ads, no timers that nag); aesthetics only.`

const COMMON = `
${WORDS}

READ FIRST: ${ROOT}/5s/CONCEPT.md, ${ROOT}/5s/SPEC.md (the tabs section's Set, the engine API, state, persistence, look and feel, accessibility), and the current Set code: renderSet in ${ROOT}/5s/src/app.js (around line 1247) and pinSet / the room in ${ROOT}/5s/src/engine.js; the deck at ${ROOT}/5s/dist/deck.json (cards: id, kind image|object|space|surface|colour, title, artist, year, era, category, medium, materials, place, colours [3 hex], genes, img, w, h; thumbnails under 5s/dist/img and an atlas). Build python3 ${ROOT}/5s/build_page.py if dist is missing.
Rules: never git commit or push (the lead commits); DO NOT edit ${ROOT}/5s/src/app.js, app.css, index.html, connect.js, links.js, engine.js, ${ROOT}/5s/test/ui.smoke.cjs or anything in ${ROOT}/5s/connector or ${ROOT}/5s/motion (other teams are editing them now; integration into the Set tab happens later); write only the files your role names; scratch only under ${SCRATCH}/<role>/; no gendered pronouns for the artist. Plain script UMD modules like engine.js (window.X in the browser, module.exports in Node), no libraries, no external hosts (the page contract: own files, Google Fonts only). Playwright via require('/opt/node22/lib/node_modules/playwright') in .cjs files. LOOK at every screenshot you take (Read the PNG) and fix what looks wrong. For every obstacle, write down its resolution. Your final message is your report.`

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    brief: { type: 'string', description: 'the game design, complete enough to build from: everything below in prose and tables' },
    engine_api: { type: 'string', description: 'FiveSMatch exact API: functions, inputs, outputs, state shapes, events' },
    play_api: { type: 'string', description: 'FiveSPlay and FiveSBoard mount APIs and callbacks' },
    data: { type: 'string', description: 'the additive state fields (associations, saga progress) with limits' },
    levels: { type: 'string', description: 'levels 1-30: size, suits, moves, goal, blockers, star thresholds (initial values; the playtest tunes them)' },
  },
  required: ['brief', 'engine_api', 'play_api', 'data', 'levels'],
}

const BRIEF = `${COMMON}
YOUR ROLE: write the game brief (and add it to ${ROOT}/5s/SPEC.md as a new section "Set: the board and the game", additively; you are the only agent editing SPEC.md in this workflow). Scratch ${SCRATCH}/brief/.
It must play just like Candy Crush Saga, in 5s's own look and words. Decide and specify precisely:
- THE BOARD (presentation): a Pinterest-style masonry mood board of the person's liked things (kept deck cards and brought things), at their own proportions, grouped into clusters by the associations they have made in the game (and by kind before there are any), each tile opening the detail sheet. The room stays one tap away ("See it as a room").
- THE GAME (Candy Crush Saga's rules, no paywalls): an N×M grid of tiles; swap two neighbours by pressing a tile and dragging toward a neighbour (or tap one then the other; arrow keys for keyboard); a swap counts only if it makes a line of 3+; invalid swaps bounce back; matched tiles clear, tiles above fall, new ones drop in, cascades; 4 in a line -> a striped special that clears its row or column; L or T -> a wrapped special that bursts 3×3 twice; 5 in a line -> the colour bomb, which in 5s is the 5s mark itself, clearing every tile of the suit it is swapped with; special+special combos as in Candy Crush; idle hint after a few seconds; reshuffle when no move exists; moves limit; goals (reach a score; collect N of a suit or kind; and a 'paint' goal, Candy Crush's jelly: cells under a match are painted in the matched objects' colours, and painting the whole board finishes the level, so a finished board is itself a composition the person can keep on their mood board); blockers in later levels; 1-3 stars; a saga map of levels; boosters earned by playing, never bought; no lives.
- SUITS: what makes tiles match. Each suit must read at a glance like a candy colour (a frame colour AND a shape, for colour-blind players) with the object's own picture inside. Recommended: the person's own strongest aesthetic threads (from their profile: a hue family, a material, a movement), each liked object assigned to its strongest thread, so a match juxtaposes different kinds of things (a rug, a painting, a building) sharing a thread; fall back to hue families when there is too little data, and to colour swatches from the person's own colours when a suit has no object. Decide and justify; name each suit in plain words in a legend.
- ASSOCIATIONS (the artist's 'reinforce juxtapositions by associating complements you like'): a match made by the person's own swap records an association of the objects matched (cascades count less or not at all); the level-end screen shows the juxtapositions made, and a heart keeps a pairing explicitly; associations organise the mood board and teach the taste model which features go together (an additive engine extension done later by the integration team: specify the data and the intent, the engine change itself is not yours).
- FEEL: Candy Crush's juice in 5s's language (the swap, the clear, the fall, the cascade words in 5s's voice, the special effects, the level end with stars), sound synthesised with WebAudio (no files) with a visible mute, haptics where the device has them, reduced motion honoured, 390 px phone first, 60 fps on a mid phone.
- DATA and API: the state fields (associations list with caps, saga progress) and the module APIs: FiveSMatch (pure engine + level generator, seeded, deterministic), FiveSPlay (the game component mounted into an element), FiveSBoard (the masonry board component). Levels 1-30 with initial parameters (the playtest will tune them).
Your output is the brief (schema); also write it into SPEC.md.`

const REPORT = {
  type: 'object',
  properties: {
    summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } }, api: { type: 'string' },
    verification: { type: 'string' }, images: { type: 'array', items: { type: 'string' } },
    obstacles: { type: 'array', items: { type: 'string' } }, open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'verification', 'obstacles', 'open_issues'],
}

const ENGINE = (b) => `${COMMON}
YOUR ROLE: the match engine. Files: ${ROOT}/5s/src/match.js (new, window.FiveSMatch), ${ROOT}/5s/test/match.test.mjs (new), ${ROOT}/5s/test/sim.mjs (new: bots that play levels). Scratch ${SCRATCH}/engine/. Another agent builds the UI against your API at the same time: implement the API exactly as the brief states; if you must change it, write the change at the top of match.js in a comment headed API CHANGES.
The brief: ${b.brief}
Engine API: ${b.engine_api}
Data: ${b.data}
Levels: ${b.levels}
Build it pure and deterministic (seeded RNG; same seed + same moves = same board), fast (a move + its cascades well under 2 ms), with: swap validation, match finding (lines, L, T, crosses), specials and every special combo, gravity, refill, cascades, scoring with cascade multipliers, goals (score, collect, paint) and blockers, moves, stars, hint, no-move detection and reshuffle, level generation from the person's liked things and their suits (and fallbacks), and the association records each player swap produces. Tests: every rule with hand-made boards (including the tricky ones: simultaneous matches, special created at the swapped cell, combos, cascades creating specials, reshuffle never leaving a ready-made match, paint goal); determinism; performance. sim.mjs: a greedy bot and a smarter bot play each level 1-30 for 200 seeds and print win rate, mean moves left and stars, so the playtest can tune.`

const PLAY = (b) => `${COMMON}
YOUR ROLE: the game and board components. Files: ${ROOT}/5s/src/play.js (new, window.FiveSPlay), ${ROOT}/5s/src/board.js (new, window.FiveSBoard), ${ROOT}/5s/src/play.css (new; scoped under the components' roots, using the app's tokens from app.css by name, so it drops into the app later), ${ROOT}/5s/test/play.html + ${ROOT}/5s/test/play.smoke.cjs (a harness page that loads the deck, a sample state with ~40 kept cards and a few brought things, and mounts both). Scratch ${SCRATCH}/play/. Another agent writes match.js at the same time against the same API; code against the brief's API, use the real match.js as soon as it exists (poll for it), and never edit it (tell the lead in your report what it needs).
The brief: ${b.brief}
Play and board API: ${b.play_api}
Engine API: ${b.engine_api}
Build: the saga map (levels as a winding path, stars, the next level glowing), the level start (goal, moves), the board (tiles: the object's picture inside its suit's frame colour and shape; suits legend), Candy Crush's gestures (pointer events: press-drag a tile toward a neighbour to swap, with the tile following the finger a little and snapping; tap-tap; keyboard arrows + Enter; touch-action none on the grid only, so the page still scrolls), every animation (swap, bounce back, clear, fall with a little squash, refill, cascade words in 5s's voice, striped, wrapped, the 5s mark bomb, combos, paint spreading under matches), WebAudio sounds with a mute, haptics via navigator.vibrate where present, reduced motion, the level end (stars, score, the juxtapositions made with a heart on each, Keep this board for a painted board), boosters earned; and the mood board (masonry at the objects' proportions, clusters by association with their thread named, a hearted pairing shown together, tap to open, a 'See it as a room' switch callback). 390 px phone first, also 1280; light and dark from the app's tokens; 60 fps (transform/opacity only, one rAF loop). Smoke: mount, play a scripted sequence of swaps (valid and invalid) with touch emulation at 390 and mouse at 1280, a special and a combo, a level won and lost, the board with and without associations, reduced motion, light and dark; screenshots into ${SCRATCH}/play/shots/; LOOK at them and iterate until it feels like Candy Crush made by 5s.`

const PLAYTEST = (b, results) => `${COMMON}
YOUR ROLE: playtest and tune; you may edit match.js, play.js, board.js, play.css, the tests and the levels table in SPEC.md's new section. Ports 8920-8929. Scratch ${SCRATCH}/playtest/.
Reports: ${JSON.stringify(results, null, 1)}
Levels: ${b.levels}
1. Run node --test ${ROOT}/5s/test/match.test.mjs and node ${ROOT}/5s/test/play.smoke.cjs; fix failures.
2. Tune with node ${ROOT}/5s/test/sim.mjs: a Candy Crush-like curve (levels 1-5 almost always won by the greedy bot; then a gentle rise with every fifth level a little harder; nothing above ~40% greedy loss before level 20; every level winnable by the smarter bot), no dead boards, specials appearing often enough to feel good. Record the final table in SPEC.md.
3. Play it yourself through Playwright with touch emulation at 390 px (iPhone-sized, deviceScaleFactor 3) and with a mouse at 1280: is the swap gesture as forgiving and snappy as Candy Crush's (a short flick swaps; a drag that wanders cancels cleanly; a tap-tap works), are matches readable at a glance (suit frames and shapes), do cascades and specials feel rewarding, is the level end satisfying, does the board look like a Pinterest board of the person's own things? Record a short frame sequence of a cascade and a special (screenshots) and LOOK. Fix what is weak.
Report: the tuned curve with win rates, what you changed, an honest critique of the feel, and the screenshot paths.`

phase('Design')
const b = await agent(BRIEF, { label: 'brief: the Set game', phase: 'Design', schema: BRIEF_SCHEMA })
if (!b) return { brief: null }
phase('Build')
const [engine, play] = await parallel([
  () => agent(ENGINE(b), { label: 'engine: match.js + sim', phase: 'Build', schema: REPORT }),
  () => agent(PLAY(b), { label: 'components: play + board', phase: 'Build', schema: REPORT }),
])
phase('Playtest')
const playtest = await agent(PLAYTEST(b, { engine, play }), { label: 'playtest + tune', phase: 'Playtest', schema: REPORT })
return { brief: b, engine, play, playtest }
