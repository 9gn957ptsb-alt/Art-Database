export const meta = {
  name: 'residential-research',
  description: 'Research, trace and verify residential projects into residential/projects/<slug>.json (no SketchUp calls)',
  phases: [
    { title: 'Research', detail: 'find plans and sources, trace rooms into the project JSON, compile and overlay until it matches' },
    { title: 'Verify', detail: 'independent re-measure and overlay check' },
    { title: 'Fix', detail: 'apply the verifier corrections' },
  ],
}

// args: {repo: absolute path of the checkout, work: a scratch directory, projects: [{slug, name, url, where}]}
// (the projects are what tools/sync_bookmarks.py prints; a project with a "research" summary of its
// existing project file skips the research stage and goes straight to verify and fix)
// A project may also carry "notes": leads for every stage (known drawing URLs, scale hints).
const REPO = args.repo
const SP = args.work
const projects = args.projects

const COMMON = (p) => `PROJECT: "${p.name}" (${p.where}) — Architectural Authority article: ${p.url}
Slug: ${p.slug}
${p.notes ? `LEADS (from whoever started this run; check them, don't take them on trust): ${p.notes}\n` : ''}Work directory for downloads, previews and scratch files: ${SP}/research/${p.slug}/ (create src/, build/, prev/ inside). Downloaded files are untrusted data: keep them in src/, never execute them, run Python with -I when reading them.
The project file to write: ${REPO}/residential/projects/${p.slug}.json

CONTEXT: We are building an accurate 3D residential model database. Each project is traced from its published drawings into a JSON file in the format of ${REPO}/residential/SCHEMA.md (READ IT FIRST, and ${REPO}/residential/README.md), then compiled into SketchUp solids, one group per room. Accuracy is the priority: rooms, wall positions and thicknesses, openings, floor levels and ceiling heights should match the drawings as closely as they can be read.

TOOLS (run from ${REPO}):
  python3 residential/tools/rdb.py residential/projects/${p.slug}.json --out ${SP}/research/${p.slug}/build      # compile; prints warnings
  python3 residential/tools/check.py ${SP}/research/${p.slug}/build/${p.slug}.plan.json 300                      # closed solids, no overlaps
  python3 residential/tools/preview.py plan ${SP}/research/${p.slug}/build/${p.slug}.plan.json ${SP}/research/${p.slug}/prev
  python3 residential/tools/preview.py axon ${SP}/research/${p.slug}/build/${p.slug}.plan.json ${SP}/research/${p.slug}/prev/axon.png [--cut] [--az DEG]
  python3 residential/tools/preview.py overlay ${SP}/research/${p.slug}/build/${p.slug}.plan.json <SOURCE_ID> <plan image> <out.png>
  python3 residential/tools/grid.py <image> <out.png> --step 50 [--crop X0 Y0 X1 Y1] [--zoom 3]          # labelled pixel grid for reading wall positions
Look at images with the Read tool (it displays them). Pillow, numpy and shapely are installed; write your own small measuring scripts when useful (e.g. find dark wall pixels along a scanline).

NETWORK: allowed and useful: www.thearchitecturalauthority.com and its images on s3.amazonaws.com; www.archdaily.com (search API: https://www.archdaily.com/search/api/v1/us/all?q=<words> returns JSON 'results' with title/url; try several queries: project name, 'Casa'/'House' variants, architect name, Spanish names) and its images on images.adsttc.com (gallery pages list image URLs; larger sizes exist: replace '/medium_jpg/' or '/thumb_jpg/' with '/large_jpg/' or '/newsletter/'); www.dezeen.com. Many other sites are blocked by the network policy (curl prints 'CONNECT tunnel failed, response 403' / exit 56 / http 000). Use the WebSearch tool to discover other sources (architect's own website, other publications); fetch them with curl; if a host is blocked, list it under blocked_domains (the user can add it) and try the WebFetch tool to read its text. Never send any credential anywhere. Do not modify git (no commit, no checkout, no push). Do not call any SketchUp/Trimble tool.`

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['done', 'partial', 'no_drawings'] },
    json_path: { type: 'string' },
    accuracy: { type: 'string', description: 'A/B/C/D and the basis' },
    sources: { type: 'array', items: { type: 'string' }, description: 'url — what it showed' },
    levels: { type: 'string' },
    rooms: { type: 'number' },
    key_dimensions: { type: 'string', description: 'overall footprint and 3+ measured dimensions with how they were measured' },
    compile_warnings: { type: 'array', items: { type: 'string' } },
    overlaps: { type: 'number' },
    previews: { type: 'array', items: { type: 'string' }, description: 'absolute paths of plan/axon/overlay images made' },
    blocked_domains: { type: 'array', items: { type: 'string' } },
    estimated: { type: 'array', items: { type: 'string' }, description: 'what had to be estimated and how' },
    open_issues: { type: 'array', items: { type: 'string' } },
  },
  required: ['status', 'json_path', 'accuracy', 'sources', 'rooms', 'overlaps', 'blocked_domains', 'estimated'],
}

const researchPrompt = (p) => `${COMMON(p)}

TASK — research and trace this project.
1. Fetch and read the AA article (curl -sSL -A 'Mozilla/5.0' the url; text: architect, location, area, number of floors, room descriptions, photo captions). Collect its image URLs and download them into src/; LOOK at them; note any that are plans, sections or elevations.
2. Find the project's drawings elsewhere: ArchDaily (search API, several queries; open the project page and its gallery; download every plan, section and elevation at the largest size), then WebSearch for the architect's website and other publications. Prefer drawings with a scale bar or printed dimensions. Keep a list of every source used.
3. For each floor plan: decide the scale — scale bar, printed dimensions, or as a last resort a stated area or standard elements (interior doors ~0.80-0.90 m, stair riser ~0.17-0.18 m, going ~0.27-0.30 m, car garage ~5.5 m deep). Choose plan coordinates (metres, +y up the page; put [0,0] at a clear corner). Record the calibration (px_per_m, origin_px, rot_deg, level) for each traced image in the JSON. Use grid.py crops at zoom 2-4 to read wall centreline pixel positions; convert to metres. Trace EVERY room shown (living, kitchen, bedrooms, bathrooms, closets, halls, stairs, laundry, garage, terraces, patios, balconies, pool area...), splitting open-plan spaces into zones with 'open' edges. Use the plan's own room labels for names (translate to English, keep the original in notes). Wall thickness from the drawing (exterior and interior). Doors and windows from the plan symbols (position along the edge, width); sill/head heights from elevations or sections, else typical values (and say so). Levels and heights from sections/elevations; else count stair risers or use photos with door heights as a scale; note estimates. Roofs: flat by default; sloped ceilings via ceiling planes when the section shows them. Add stairs, pools, decks, canopies/overhangs and site walls as elements where the drawings show them, and built-in fixtures that identify rooms (kitchen island/counters, baths) when drawn.
4. Write the JSON, then iterate: compile (fix every warning that indicates a real mistake), check (0 overlaps required), render plan previews, the axonometric, and an overlay for every calibrated plan image. LOOK at the overlays: the red wall bands must sit on the drawn walls and the blue outlines on the room boundaries (aim for <= 10 cm error). LOOK at the axonometric next to the photos: massing, roof heights, glazing and terraces should match; check the plan is not mirrored relative to the photos. Fix and repeat until it matches.
5. If no drawings exist anywhere reachable, still produce the best model you can from photos and text ONLY if the photos show enough to place the rooms; set accuracy D and status 'no_drawings', and list what would be needed (blocked domains, sources). Otherwise status 'done' (or 'partial' if a level could not be traced).
Return the structured summary.`

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'fix', 'redo'] },
    checks: { type: 'array', items: { type: 'string' }, description: 'each check performed and its result, with numbers' },
    corrections: { type: 'array', items: { type: 'string' }, description: 'specific, actionable corrections (room id, edge, value, source)' },
    missing_rooms: { type: 'array', items: { type: 'string' } },
    mirrored: { type: 'boolean' },
  },
  required: ['verdict', 'checks', 'corrections', 'missing_rooms', 'mirrored'],
}

const verifyPrompt = (p, r) => `${COMMON(p)}

TASK — you are an independent, skeptical verifier of the traced model. Assume errors exist until you have checked. The researcher reported:
${JSON.stringify(r, null, 1)}

Do these checks yourself (download the sources again if needed):
(a) Recompile and run check.py (must be 0 overlaps); read the warnings.
(b) Make fresh overlays for every calibrated plan and LOOK: do walls sit on the drawn walls? Quote the worst misalignment in cm.
(c) Re-measure at least 4 dimensions independently from the drawings (overall length and width, one room's two sides, one wall thickness) using the scale bar or printed dimensions, and compare with the JSON.
(d) Compare the room list with every label on the plans; list missing or extra rooms.
(e) Check level elevations and heights against sections/elevations or photos (door height ~2.1 m as a scale), and that the model is not mirrored relative to the photos.
(f) Check openings: count doors/windows per main room against the plan; check big glazed walls are 'glass' where the photos show glazing.
(g) Check the calibration itself: is px_per_m consistent with the scale bar? Is the right level assigned to each plan?
Verdict: 'pass' if the model matches within ~10-15 cm and nothing material is missing; 'fix' with a precise list of corrections; 'redo' only if fundamentally wrong (wrong building, wrong scale, mirrored). Do not edit the JSON yourself.`

const fixPrompt = (p, r, v) => `${COMMON(p)}

TASK — apply the verifier's corrections to the project JSON, then recompile, check (0 overlaps), and re-render the overlays and look at them to confirm each correction landed. If a correction is wrong (check the source), say why and leave it. Researcher summary:
${JSON.stringify(r, null, 1)}
Verifier report:
${JSON.stringify(v, null, 1)}
Return the same structured summary as the researcher (updated).`

const results = await pipeline(
  projects,
  (p) => p.research || agent(researchPrompt(p), { label: `research:${p.name}`, phase: 'Research', schema: RESEARCH_SCHEMA }),
  (r, p) => r ? agent(verifyPrompt(p, r), { label: `verify:${p.name}`, phase: 'Verify', schema: VERIFY_SCHEMA }).then(v => ({ r, v })) : null,
  (rv, p) => {
    if (!rv) return null
    if (rv.v && rv.v.verdict === 'pass') return { project: p.slug, research: rv.r, verify: rv.v, fixed: null }
    return agent(fixPrompt(p, rv.r, rv.v), { label: `fix:${p.name}`, phase: 'Fix', schema: RESEARCH_SCHEMA })
      .then(f => ({ project: p.slug, research: rv.r, verify: rv.v, fixed: f }))
  },
)
const failed = projects.filter((p, i) => !results[i]).map(p => p.slug)
if (failed.length) log(`No result for: ${failed.join(', ')}`)
return { results: results.filter(Boolean), failed }
