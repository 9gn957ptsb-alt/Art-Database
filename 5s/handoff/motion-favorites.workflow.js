export const meta = {
  name: 'motion-favorites',
  description: 'Read the artist\'s Motion Lab favorites for trends; refine those types; build very different new families; make favorites one pool with a live For you view; make the lab mountable inside 5s',
  phases: [
    { title: 'Read', detail: 'render and study the favorites; a trend brief with refinements and new families' },
    { title: 'Build', detail: 'refined styles in the favored families; new, very different families' },
    { title: 'Lab', detail: 'favorites as one pool, the For you view, the duplicate-star fix, a mountable lab' },
    { title: 'Verify', detail: 'every family checked and looked at; lab and embed smokes; fixes' },
  ],
}

const ROOT = '/home/user/Art-Database'
const M = ROOT + '/5s/motion'
const SCRATCH = '/tmp/claude-0/-home-user-Art-Database/d9dbf1fb-700e-5758-9376-62e2073ec507/scratchpad/motion-fav'

const FAVORITES = [
  { family: 'echo', style: 'depth', params: { duration: 500, easing: 'outCubic', intensity: 1, palette: 'paper', ribbon: true, spread: 0.5, weight: 1 }, starredOn: 'tab' },
  { family: 'echo', style: 'ripple', params: { duration: 500, easing: 'outCubic', intensity: 0.6, palette: 'logo', ribbon: true, spread: 0.5, weight: 1 }, starredOn: 'tab' },
  { family: 'count', style: 'morph', params: { duration: 600, easing: 'inOutCubic', intensity: 0.6, palette: 'logo', ribbon: true, tick: true, weight: 1 }, starredOn: 'tab' },
  { family: 'rewind', style: 'retrace', params: { duration: 500, easing: 'outBack', ghost: 'onion', ghosts: 4, intensity: 0.6, palette: 'logo', ribbon: true, weight: 1 }, starredOn: 'tab' },
  { family: 'morph', style: 'exchange', params: { duration: 420, easing: 'outCubic', intensity: 0.6, palette: 'logo', ribbon: true, weight: 1 }, starredOn: 'tab' },
]

const ASK = `The artist, 22 Oct 2026, about the 5s Motion Lab:
"I want the animations that I favorite in the motions lab to be the ones used in the app. It's not necessarily about particular form, so I don't mind a diverse range of animations that are interchangeable in any place. The animation is necessary, nonetheless, I want you to pay attention to trends in my favorite animations so you can further refine those types, as well as, explore new ones that are very different, but just as potent and exciting."
Earlier (21 Oct): "There needs to be a potent animation that's just as relevant to how people feel about the app as how relevant a logo is to the app. Using the 5 and s characters generate me a tool that allows me to explore all the different ways in which the animation of those characters could fill transition moments a user experiences when using the app."
The artist's favorites so far (deduplicated; all five were starred while browsing the "Moving between tabs" moment, whose length is 0.25-0.5 s, so their short durations reflect that moment, not necessarily taste):
${JSON.stringify(FAVORITES, null, 1)}
The sixteen per-moment picks in the lab were Claude's proposals and were not changed by the artist: they are NOT taste signals.`

const COMMON = `
${ASK}

Context: the Motion Lab lives in ${M}. READ FIRST: ${M}/SPEC.md (the mark, the engine, the family contract, the moments, the lab, the page rules), ${M}/README.md, ${ROOT}/5s/CONCEPT.md (the artist's own words; it outranks every spec). The engine is ${M}/marks.js (global Marks + the Motion registry: Motion.register, Motion.render, MOMENTS, ORDER, SHARED, REDUCED). Families are ${M}/families/*.js (pulse.js is the reference family). Tools: node ${M}/test/strip.cjs (frame strips of a family: --family <id> [--style s] [--theme light|dark] [--frames N] [--size px] [--param k=v] --out file.png; --styles; --all; --check [--family id] for determinism, final frame, loop seams, context restored), node ${M}/test/marks.test.cjs, node ${M}/test/lab.smoke.cjs (Playwright, the built lab), python3 ${M}/build.py (builds ${M}/dist; every families/*.js is included automatically).
Rules: never git commit or push (the lead commits); never touch ${ROOT}/5s/src, ${ROOT}/5s/test, ${ROOT}/5s/connector or ${ROOT}/data (another team is working there right now); add, never take away: every existing family and style must keep rendering exactly as it does now (the artist's favorites point at them by family, style and params); no gendered pronouns for the artist; scratch only under ${SCRATCH}/<your-role>/. Playwright via require('/opt/node22/lib/node_modules/playwright') in .cjs files. LOOK at what you render (open the PNGs with the Read tool) and iterate until it is good: the mark in motion is the app's second logo, so every animation must be striking at 64 px and at full screen, keep the 5 and the s legible at rest, honour every shared option (palette, ribbon, weight, intensity, duration, easing) and both themes. Work economically: read what you need, keep test runs targeted until your final run. Your final message is your report.`

const BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    trends: { type: 'string', description: 'for the artist: what the favorites share, in plain words, with what is a real signal and what is an artefact of the moment they were browsing' },
    axes: { type: 'array', items: { type: 'object', properties: { axis: { type: 'string' }, values: { type: 'array', items: { type: 'string' } }, meaning: { type: 'string' } }, required: ['axis', 'values', 'meaning'] }, description: 'the descriptor vocabulary the lab will use to read trends (e.g. space: in-place/travel/fill; time: trace/sequence/single; change: transform/build/break/reveal/move; texture: line/solid/particle/paper; energy: calm/lively/explosive)' },
    descriptors: { type: 'object', additionalProperties: { type: 'object', additionalProperties: { type: 'string' } }, description: 'familyId -> {axis: value} for EVERY existing family and every new and hybrid family you propose' },
    refinements: { type: 'array', items: { type: 'object', properties: {
      group: { type: 'string', description: 'a short id for the agent that builds this group' },
      files: { type: 'array', items: { type: 'string' }, description: 'the family files this group owns (existing files get NEW styles only; a hybrid gets a new file); no file in two groups' },
      styles: { type: 'array', items: { type: 'object', properties: { family: { type: 'string' }, name: { type: 'string' }, idea: { type: 'string' }, from: { type: 'string', description: 'which favorite(s) it refines and how' } }, required: ['family', 'name', 'idea', 'from'] } },
      hybrid: { type: 'object', description: 'only for a new hybrid family in this group', properties: { id: { type: 'string' }, name: { type: 'string' }, idea: { type: 'string' }, loop: { type: 'boolean' }, reduced: { type: 'string' } } },
    }, required: ['group', 'files', 'styles'] }, description: 'two or three groups' },
    new_families: { type: 'array', items: { type: 'object', properties: {
      id: { type: 'string', description: 'lowercase, one word, not an existing family id' },
      name: { type: 'string' }, idea: { type: 'string' }, why_different: { type: 'string' }, why_potent: { type: 'string' },
      styles: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, idea: { type: 'string' } }, required: ['name', 'idea'] } },
      params: { type: 'string', description: 'family-specific params beyond the shared ones' },
      moments: { type: 'array', items: { type: 'string' } }, loop: { type: 'boolean' }, reduced: { type: 'string', enum: ['fade', 'cut', 'still'] },
    }, required: ['id', 'name', 'idea', 'why_different', 'why_potent', 'styles', 'moments', 'loop', 'reduced'] }, description: 'exactly six' },
    images: { type: 'array', items: { type: 'string' }, description: 'the strips you rendered and looked at' },
  },
  required: ['trends', 'axes', 'descriptors', 'refinements', 'new_families'],
}

const BRIEF = `${COMMON}
YOUR ROLE: read the favorites and write the brief the builders follow. Scratch: ${SCRATCH}/brief/.
1. Render each favorite exactly as saved (strip.cjs with its family, style and every param, light and dark, 10+ frames) and look closely; also render each favorite family's other styles and two or three families the artist did NOT favorite, to see the contrast. Read the favorite families' code (echo, rewind, count, morph) so you know what they actually draw.
2. Name the trends precisely, separating real signals (which families and styles; intensity raised to 1 on Echo depth; paper palette once) from artefacts of the moment they were browsing (short durations). Define a descriptor vocabulary (axes and values) and tag EVERY family, existing and proposed, so the lab can compute trends and distances from favorites later.
3. Refinements: in two or three groups (each group owns distinct files), propose new STYLES for the favored families (existing styles stay untouched) that push what the artist responded to further, and one new HYBRID family that combines the two strongest threads (for example: the mark leaving a trace of itself through time + one shape becoming another). Each style: name and a concrete visual idea a builder can implement.
4. New families: brainstorm at least twelve candidates that are VERY different from the favorites on your axes (if the favorites stay in place and leave traces, try matter, physics, light, space, cutting, weaving, sound, scale...), then choose the SIX most potent and exciting and most distinct from each other and from the 19 existing families; each with 3 styles, the moments it fits best (it will be used anywhere), loop or not, and its reduced-motion fallback. Think about what would make a person feel something in 0.5-2 s at 64 px and full screen, in both themes.
Your final output is the brief (schema).`

const REPORT = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },
    added: { type: 'array', items: { type: 'string' }, description: 'family/style ids added' },
    verification: { type: 'string' },
    images: { type: 'array', items: { type: 'string' }, description: 'strips or screenshots you looked at' },
    obstacles: { type: 'array', items: { type: 'string' }, description: 'each obstacle and its resolution' },
    open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'added', 'verification', 'obstacles', 'open_issues'],
}

const REFINE = (brief, g) => `${COMMON}
YOUR ROLE: build the refinement group "${g.group}". You own ONLY these files: ${g.files.map((f) => M + '/families/' + f.replace(/^families\//, '')).join(', ')}. Scratch: ${SCRATCH}/refine-${g.group}/. Other agents are writing other family files and lab.js at the same time; do not touch marks.js, lab.js, lab.css, index.html or build.py.
The trends you are refining (from the brief): ${brief.trends}
Your group:
${JSON.stringify(g, null, 1)}
Add each style to its family (existing styles, params and their defaults unchanged: render every existing style before and after your change with fixed params and compare the PNGs byte for byte or pixel for pixel, and keep them identical). A new hybrid family is a new file families/<id>.js following the family contract, with a style list and params. Iterate visually until each new style is as strong as the favorite it refines. Pass node ${M}/test/strip.cjs --check --family <id> for every family you touched.`

const NEWFAM = (brief, f) => `${COMMON}
YOUR ROLE: build the new family "${f.id}" as ${M}/families/${f.id}.js (that file only). Scratch: ${SCRATCH}/family-${f.id}/. Other agents are writing other family files and lab.js at the same time; do not touch marks.js, lab.js, lab.css, index.html, build.py or any other family.
Why it exists: the artist asked for new animations "very different, but just as potent and exciting" as their favorites. The favorites' trends (from the brief): ${brief.trends}
Your family, from the brief:
${JSON.stringify(f, null, 1)}
Follow the family contract in SPEC.md exactly (Motion.register with id, name, idea, why, moments, styles, params, reduced, loop and a pure deterministic draw(ctx, t, p, env); restore the context; honour the shared options; loop seams if loop). Use the engine's mark (Marks strokes, gradient along strokes, palettes, seeded rng) rather than drawing your own 5 and s. Iterate visually (light and dark, 64 px-equivalent and large, each style, intensity low and high) until it is genuinely striking and unlike the existing 19 families. Pass node ${M}/test/strip.cjs --check --family ${f.id}.`

const LAB = (brief) => `${COMMON}
YOUR ROLE: the lab (${M}/lab.js, ${M}/lab.css, ${M}/index.html, ${M}/build.py, ${M}/test/lab.smoke.cjs, and ORDER in ${M}/marks.js: you are the only agent editing these). Port range 8860-8869. Scratch: ${SCRATCH}/lab/. Other agents are adding family files right now (new families: ${brief.new_families.map((f) => f.id).join(', ')}; refinements: ${brief.refinements.map((g) => g.files.join('+')).join('; ')}); if a smoke run fails only because of a family file that is not yours, note it and carry on: the verify stage runs everything at the end.
Build, additively:
1. A BUG FIX: stars are duplicated in the saved data (the artist's db holds rewind/retrace three times and echo/depth and echo/ripple twice). Cause to confirm: vkey() uses JSON.stringify(v.params), which depends on key order, and the database returns keys in a different order, so mergeData's de-duplication misses. Fix with a canonical (sorted-key) key everywhere variants are compared, and de-duplicate on load. Test it with a remote snapshot whose params keys are reordered.
2. FAVORITES ARE ONE POOL, used anywhere in the app. Keep the stored shape compatible ({picks, stars, v: 1}; stars stay keyed by moment, recording where a favorite was found) and add a top-level favorites list if useful; the pool is the de-duplicated union. The star control reads as "Favorite" and says it will be used across 5s; Board shows "In the app: your N favorites" as the pool (each playable, unfavoritable). Favoriting from anywhere (stage, sheet, Board, For you) adds to the pool.
3. A new view "For you" (a fourth mode beside Moments, Explore, Board): (a) Trends: a plain-language reading of the CURRENT favorites, computed live from them (families, styles and the descriptor axes below; intensity, palette, ribbon, easing; tempo only with the caveat that it follows the moments they browsed), updating as the artist favorites more; (b) "More like your favorites": a sheet of variants generated from the pool (each favorite's family and style with seeded param mutations, the favored families' other styles, the new refined styles and the hybrid), ranked by affinity on the axes; (c) "Something different": a sheet of the families and styles most distant from the pool on the axes (the six new families will rank high), each still potent; each cell playable, loadable onto the stage, favoritable. With no favorites, the view says so and offers a varied starter sheet.
   The descriptor vocabulary and tags (from the brief; put them in one table in lab.js or a small descriptors file included by build.py; families without tags still work):
   axes: ${JSON.stringify(brief.axes)}
   descriptors: ${JSON.stringify(brief.descriptors)}
4. MOUNTABLE: the lab will next be hosted inside the 5s app as a view only the artist sees, so their favorites go live in the app (two separate artifacts cannot share data). Make lab.js mountable without changing the standalone page's behaviour: expose window.MotionLab.mount(host, {embedded: true}) that renders the lab into a shadow root on host (lab.css inside the shadow root; the lab's markup from index.html supplied by build.py as a template string or a built lab-markup.js), scopes every query and listener to that root (no document-level click/input/change handlers while embedded; keydown only while the lab is open and focused within it), routes views internally instead of through location.hash when embedded, uses the page's claude.use('db') doc 'motion/picks' exactly as now, and offers unmount(). The standalone index.html keeps working as today (it can call the same mount on #lab or keep its current path). Build a test page ${M}/test/embed.html + ${M}/test/embed.smoke.cjs: a host page with deliberately conflicting CSS (classes .top .brand .mode .sheet .cell .panel, a body style, its own hash router and document click handler) mounts the lab, and the test checks the lab looks and works as standalone (screenshots compared by eye), the host's CSS and handlers are unaffected, picks and favorites save through a fake window.claude db, and unmount leaves no listeners or clocks running.
5. Add the new family ids to ORDER in marks.js (after the existing ones, the hybrid first), update SPEC.md's lab section and README.md (additively) for the pool, For you and mount.
6. Extend lab.smoke.cjs: For you at 1440 and 390, light and dark, with a fake db holding the five favorites (and the duplicates, to prove de-duplication), with no favorites, favoriting from For you, the Board pool. Take screenshots into ${SCRATCH}/lab/shots/ and LOOK at them; fix what looks wrong.`

const VERIFY = (brief, results) => `${COMMON}
YOUR ROLE: verify everything that just landed and fix what is broken (you may edit any file under ${M}). Port range 8870-8879. Scratch: ${SCRATCH}/verify/.
What landed (reports): ${JSON.stringify(results, null, 1)}
1. python3 ${M}/build.py: every family included, none skipped; dist/ uses no external host but Google Fonts.
2. node ${M}/test/strip.cjs --check (all families) and node ${M}/test/marks.test.cjs.
3. The five favorites render exactly as before: compare strips of each favorite (exact saved params, light and dark) against the committed version (git stash is forbidden; instead check out the committed files into ${SCRATCH}/verify/before/ with git show HEAD:5s/motion/<file> and render from there) and confirm identical pixels.
4. node ${M}/test/lab.smoke.cjs and node ${M}/test/embed.smoke.cjs.
5. Render node ${M}/test/strip.cjs --all at light and dark and each new family's --styles; LOOK at every new family and refined style next to the favorites and judge honestly against the bar (striking at 64 px and full screen, the 5 and s legible at rest, unlike the others, both themes). Fix weak ones directly (keeping existing styles identical), or say precisely what is weak.
6. Report: what passes, what you fixed, a short honest critique of each new family and refined style, and the screenshot paths.`

phase('Read')
const brief = await agent(BRIEF, { label: 'brief: favorites → trends', phase: 'Read', schema: BRIEF_SCHEMA })
if (!brief) return { brief: null }
log(`trends read; ${brief.refinements.length} refinement group(s), ${brief.new_families.length} new families: ${brief.new_families.map((f) => f.id).join(', ')}`)

phase('Build')
const jobs = [
  ...brief.refinements.map((g) => () => agent(REFINE(brief, g), { label: 'refine: ' + g.group, phase: 'Build', schema: REPORT })),
  ...brief.new_families.map((f) => () => agent(NEWFAM(brief, f), { label: 'family: ' + f.id, phase: 'Build', schema: REPORT })),
  () => agent(LAB(brief), { label: 'lab: pool, For you, mount', phase: 'Lab', schema: REPORT }),
]
const built = await parallel(jobs)
const results = built.map((r, i) => r || { failed: i < brief.refinements.length ? 'refine ' + brief.refinements[i].group : (i < jobs.length - 1 ? 'family ' + brief.new_families[i - brief.refinements.length].id : 'lab') })

phase('Verify')
const verify = await agent(VERIFY(brief, results), { label: 'verify + critique', phase: 'Verify', schema: REPORT })
return { brief, results, verify }
