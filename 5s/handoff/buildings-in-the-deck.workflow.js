export const meta = {
  name: 'buildings-in-the-deck',
  description: 'Bring the artist\'s Architectural Authority bookmarks into the 5s deck as Space and Surface cards to keep or pass alongside the artworks',
  phases: [
    { title: 'Gather', detail: 'the bookmark list, each public article page, its photos and facts (cached in data/, never committed)' },
    { title: 'Define', detail: 'four agents look at every building and define it in the deck\'s vocabulary; hero photo and material crop chosen' },
    { title: 'Deck', detail: 'build_deck.py adds the buildings as cards; tests; where the app still assumes Artsy' },
    { title: 'Verify', detail: 'contact sheets looked at; choices fixed; the taste model checked with buildings kept' },
  ],
}

const ROOT = '/home/user/Art-Database'
const SCRATCH = '/tmp/claude-0/-home-user-Art-Database/d9dbf1fb-700e-5758-9376-62e2073ec507/scratchpad/buildings'

const WORDS = `The artist, 22 Oct 2026: "I also want you to now work in the Architectural Authority bookmarks as objects to like and dislike along with the artworks."
From CONCEPT.md: "It's like interior design when you're making a mood board. This is the wall color, this is the flooring, and you organize a series of textures into one composition." "What you're gonna have people do is practice architecture, but digitally."`

const COMMON = `
RESUMING (22 Oct, 18:50 UTC): an earlier run of this workflow was cut off by a usage limit. Whatever your role had written is on disk and committed (git log -3: a8c8b5ac and before). Read it first, keep what is good, and finish it; do not start over. Work economically: targeted reads and test runs, one full run at the end.
PONYTAIL IS ON (the artist asked for it): read /home/user/Art-Database/.claude/skills/ponytail/SKILL.md first and follow it: the smallest complete change, reuse what the codebase has, no unrequested abstractions, a small test for new non-trivial logic, and end your report with what you skipped.
${WORDS}

Context. 5s is in ${ROOT}/5s (read ${ROOT}/5s/CONCEPT.md, ${ROOT}/5s/SPEC.md's deck.json and five-kinds sections, ${ROOT}/5s/build_deck.py). The deck (5s/dist/deck.json, built by build_deck.py from the artist's Artsy saves in ${ROOT}/data/) has 400 cards, 80 per kind (image, object, space, surface, colour); each card: id, kind, work, url, title, artist, date, year, era (one of: 'Before 1800', '1800s', '1900–45', '1945–69', '1970–99', '2000s', '2010s–now', or null), category, medium, materials, place, colours (3 hex), genes (slugs from deck.genes, a dict slug -> {name, family}), img/w/h/thumb/cdn, and for surfaces crop [x,y,w,h] fractions + texture. Ids starting with 'y' are reserved for the person's own things.
The bookmarks: the hourly intake on branch origin/claude/artist-website-dev-s92irf keeps docs/v2/architecture.json = {buildings: [{title, name, slug, url (thearchitecturalauthority.com/article/<slug>), city, country, where, lat, lon, precision}]} (67 now; git fetch origin claude/artist-website-dev-s92irf, then git show origin/claude/artist-website-dev-s92irf:docs/v2/architecture.json); ${ROOT}/residential/bookmarks.json adds AA's category (Residential, Commercial, Healthcare, Hospitality, Cultural, Authorities) and ${ROOT}/residential/projects/*.json have year and architect for a few. Each article page is public (no token needed: never use the AA_TOKEN or AA_REFRESH_TOKEN in the environment) and carries og:title ("<Name> by <Architect>"), og:description, the article text, a photographer credit, and about ten photographs at https://s3.amazonaws.com/api.thelocalproject/public/Articles/<n>/<file>-<w>x<h>.jpg (each address appears twice in the HTML, once with a trailing backslash: de-duplicate).
Rules: never git commit or push (the lead commits); data and photos go ONLY under ${ROOT}/data/aa/ (git-ignored: the repository is public; never copy photos or page dumps elsewhere in the repo); do not edit ${ROOT}/5s/src/*, ${ROOT}/5s/test/ui.smoke.cjs, ${ROOT}/5s/build_page.py, ${ROOT}/5s/connector or ${ROOT}/5s/motion (other teams are editing them now); scratch only under ${SCRATCH}/<role>/; no gendered pronouns for the artist; be polite to the site (one request at a time, a second apart, cached so nothing is fetched twice). Look at images with the Read tool. For every obstacle, write down its resolution. Your final message is your report.`

const REPORT = {
  type: 'object',
  properties: {
    summary: { type: 'string' }, files: { type: 'array', items: { type: 'string' } },
    verification: { type: 'string' }, images: { type: 'array', items: { type: 'string' } },
    obstacles: { type: 'array', items: { type: 'string' } }, open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'files', 'verification', 'obstacles', 'open_issues'],
}

const GATHER = `${COMMON}
YOUR ROLE: gather. Write ${ROOT}/5s/gather_buildings.py (committable code; incremental and cached, so the hourly intake's new bookmarks can be gathered later with one command) that: reads the list (branch file + residential categories), fetches each article page into ${ROOT}/data/aa/pages/<slug>.html, extracts {slug, url, name, architect (from og:title / title "by ..."), title, description (og:description and the article's first paragraphs, plain text), category, city, country, where, photographer, years mentioned with their sentence (do not decide the completion year here), photos: [addresses in page order]}, downloads every photo once into ${ROOT}/data/aa/img/<slug>/NN.jpg, and writes ${ROOT}/data/aa/buildings.raw.json. Then make one contact sheet per building (all its photos numbered, small) at ${SCRATCH}/sheets/<slug>.jpg with Pillow, so the definers can look. Run it for all buildings. Report counts (buildings, photos, failures and why) and the exact paths. Pillow is available (python3 -c "import PIL").`

const DEFINE = (raw, part, of) => `${COMMON}
YOUR ROLE: define buildings, part ${part + 1} of ${of}. The gather report: ${JSON.stringify(raw)}
Read ${ROOT}/data/aa/buildings.raw.json and take the buildings at indexes i where i % ${of} === ${part}. For each: Read its contact sheet (${SCRATCH}/sheets/<slug>.jpg) and, where you need to, the photos themselves; read its description. Decide, honestly and specifically:
- hero: the photo number for its SPACE card: the one picture that says what this building is and reads at a small size on a phone (often the exterior; a defining interior when that is the point of the building);
- surface: the photo number and a crop [x, y, w, h] (fractions of that photo, roughly square, at least 25% of the short side) for its SURFACE card: a close view of its material or texture (board-formed concrete, travertine, lime plaster, timber cladding, terracotta tile, rammed earth...) that someone could choose as a wall or a floor; if no photo shows a material well, null;
- name, architect (as the article says), year (the completion year only when the article states it; else null) and era (from the year, in the deck's buckets; else null), place (country), category 'Architecture', use (AA's category);
- materials: 2-6 from the deck's own material words where they fit (read 5s/dist/deck.json cards' materials for the vocabulary; build it with python3 ${ROOT}/5s/build_page.py if dist is missing? no: read ${ROOT}/5s/dist/deck.json, and if it is missing, ask nothing: use plain lowercase words);
- genes: 3-8 slugs from the deck's vocabulary (deck.json genes: Styles and Movements, Visual Qualities, Design Concepts and Techniques, Subject Matter) that truly describe what you see and read (Visual Qualities and Design Concepts are the bridge between buildings and artworks: use them). A new slug is allowed only when it is a real Artsy gene: check with curl -s https://api.artsy.net/api/genes/<slug> (the proxy adds Artsy's credentials; a 200 with a name means real) and give its name and family;
- about: one plain line on what it is, in your own words (not copied).
Write your records to ${SCRATCH}/define/part-${part}.json as a JSON array and return them.`

const RECORDS = {
  type: 'object',
  properties: {
    records: { type: 'array', items: { type: 'object', properties: {
      slug: { type: 'string' }, name: { type: 'string' }, architect: { type: ['string', 'null'] }, year: { type: ['integer', 'null'] }, era: { type: ['string', 'null'] },
      place: { type: ['string', 'null'] }, city: { type: ['string', 'null'] }, use: { type: ['string', 'null'] }, about: { type: 'string' },
      hero: { type: 'integer' }, surface: { type: ['object', 'null'], properties: { photo: { type: 'integer' }, crop: { type: 'array', items: { type: 'number' } } } },
      materials: { type: 'array', items: { type: 'string' } }, genes: { type: 'array', items: { type: 'string' } },
      new_genes: { type: 'array', items: { type: 'object', properties: { slug: { type: 'string' }, name: { type: 'string' }, family: { type: 'string' } } } },
      notes: { type: 'string' },
    }, required: ['slug', 'name', 'hero', 'materials', 'genes', 'about'] } },
    obstacles: { type: 'array', items: { type: 'string' } },
  },
  required: ['records', 'obstacles'],
}

const DECK = (raw, recs) => `${COMMON}
YOUR ROLE: put the buildings in the deck. You own ${ROOT}/5s/build_deck.py (additive changes only), ${ROOT}/5s/buildings.json (new, committable: the curated definitions below, public facts and choices only, no photos), and tests for the deck build (a new ${ROOT}/5s/test/deck.test.py or .mjs). The gather report: ${JSON.stringify(raw)}
The definitions (merge them into ${ROOT}/5s/buildings.json, sorted by slug, with photo file names instead of numbers): ${JSON.stringify(recs)}
build_deck.py: after the Artsy cards, add one SPACE card per building (ids 'b001'..., in buildings.json order) from its hero photo, and one SURFACE card per building that has a surface choice (ids 'm001'...) from that crop, made exactly the way the existing image and surface cards are made (720 px webp, thumbnails, the atlas, colours by the same k-means, the surface crop and texture by the same code). Fields: work = slug, url = the AA article, title = name, artist = architect, date/year/era, category 'Architecture', medium = the materials as words, materials, place, genes (new genes added to deck.genes with their names and families), cdn = the original photo address, and a new field source: 'Architectural Authority' (Artsy cards get source: 'Artsy'); the deck's top-level source says both. Write the deck to a scratch copy for your own checks (python3 build_deck.py --out ${SCRATCH}/deck/ or whatever its options are; read them); the lead rebuilds 5s/dist later. Grep 5s/src, 5s/connector/src and 5s/connector/scripts for every place that assumes every card is from Artsy (labels like "on Artsy", DECK_SOURCE, exportSeed's "Artsy slug", the connector's artsy_url) and list them with file:line and the change each needs, for the integration team (do not edit those files). Tests: the deck builds; ids unique and never starting with 'y'; every building card has an image file, colours, genes in deck.genes, a url on thearchitecturalauthority.com; the Artsy cards are byte-for-byte unchanged in their fields (compare with the current 5s/dist/deck.json); node --test ${ROOT}/5s/test/ still passes against the new deck where it reads one.`

const VERIFY = (deck) => `${COMMON}
YOUR ROLE: verify the building cards. The deck report: ${JSON.stringify(deck)}
1. Make contact sheets of every new SPACE card and every new SURFACE card as they would look in Sort on a phone (the card image at its size with title and architect), at ${SCRATCH}/verify/; LOOK at all of them. Judge each: does the hero picture say what the building is at a glance; is each surface crop a material someone would pick for a wall or a floor (not a person, a sky, a blur, furniture); are genes and materials true to the picture? Fix weak choices in ${ROOT}/5s/buildings.json and rebuild the scratch deck.
2. The taste model: with node and ${ROOT}/5s/src/engine.js, make a state that keeps 15 buildings and passes 15 others plus some artworks; print the profile and philosophy lines; check that buildings and artworks share features through genes and materials, that nothing reads strangely (e.g. a building called a painting), and that nextFive mixes buildings with artworks in every mode. Report what you changed and what the integration team must still do.`

phase('Gather')
const raw = await agent(GATHER, { label: 'gather: pages + photos', phase: 'Gather', schema: REPORT })
if (!raw) return { raw: null }
phase('Define')
const N = 4
const parts = await parallel(Array.from({ length: N }, (_, i) => () => agent(DEFINE(raw, i, N), { label: 'define: part ' + (i + 1), phase: 'Define', schema: RECORDS })))
const recs = parts.filter(Boolean).flatMap((p) => p.records)
log(recs.length + ' buildings defined' + (parts.some((p) => !p) ? ' (a part failed: its buildings are missing)' : ''))
phase('Deck')
const deck = await agent(DECK(raw, recs), { label: 'deck: build_deck.py', phase: 'Deck', schema: REPORT })
phase('Verify')
const verify = await agent(VERIFY(deck), { label: 'verify: look + model', phase: 'Verify', schema: REPORT })
return { raw, defined: recs.length, deck, verify }
