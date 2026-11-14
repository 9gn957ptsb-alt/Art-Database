# Time estimates: how long the work really takes

The artist asked (5 Nov 2026) for a time estimate every time something is being developed, and for the estimates
to get more accurate. Read this before giving one; add a row when the work is done.

## How to estimate

- DIRECT WORK FIRST (measured 5-6 Nov; every hand estimate before this was 5-15x too long, and the artist said so):
  quote these, not more. They include rendering the video and adding the sound (about 1 min).

  | change, done by me | takes |
  | --- | --- |
  | remove or tweak one effect (a glow, a halo, a colour, a timing) | 1-3 min |
  | a colour study (several colourways rendered side by side) and applying one | 3-10 min |
  | a change to my sound generator, on a video | 3-8 min |
  | a new behaviour in the animation (the echo grown from the layers, the negative) | 2-10 min |
  | a new arrangement or shape for the sixteen | 2-15 min (the tesseract took 8, the card deck 2) |
  | a brand-new sound from scratch | 15-25 min |

- Count the agents and how many run at once. Workflow agents run at most `nproc - 2` at a time (this container has
  4 CPUs, so 2). A phase with 3 agents takes two rounds, not one.
- Use these measured times per agent (DUH intro workflows, Nov 2026):

  | stage | one agent takes |
  | --- | --- |
  | build one take | 35-66 min |
  | judge (all takes) | 9-35 min |
  | finish (grafts, video, sound) | 22-55 min |
  | check | 20-34 min |
  | fix round (only if a check blocks) | 16-28 min |
  | my own review and delivery afterwards | 8-30 min |

- A workflow of takes, judges and checks is only for when the artist asks for options. Its times:
- So, for a workflow job, including my review:
  - 3 takes, judged, finished, checked, maybe fixed: 3.5-4.5 h (measured 3.2 and 3.35 h before my review);
  - 2 takes: about 2-2.5 h (measured 1.9 h);
  - a single finish-and-check: about 1 h;
  - a new sound made by me and put on an existing video: 20-30 min;
  - a change to that sound generator, put on a video: 5-10 min.
- Add 20-30% when the brief is new or harder than the last one.
- Give a range and the time it should be ready ("in about 4 to 5 hours"). When a phase ends or the scope changes,
  give the updated estimate.

## Log

| date | work | estimate given | actual | note |
| --- | --- | --- | --- | --- |
| 10 Nov | 3D house page: a thickness for every floor, ceiling and roof, a duct concept and two detail sheets (survey, then model and sheets) | 50-70 min | 25 min survey, 14 min model, then 17 min for a correction and the sheets side by side: 56 min of work; over two hours on the clock with a usage limit and a machine restart between | in range for the work itself |
| 10 Nov | 3D house page: nine jobs at once | (each given its own) | the 5-hour usage window ran out after about 100 min; eight jobs stopped part-way and were run again | run fewer at once; put related edits for one room in one helper |
| 10 Nov | 3D house page: a second 3D page for another project from PDF drawings (measure, page, model and join; three helpers) | 50-70 min | 56 min (22 + 23 in parallel, then 33) | in range |
| 10 Nov | 3D house page: a thickness for every wall and a wall types sheet (survey, then model and sheet) | 50-65 min | survey 37 min, then model 55 min and sheet about 25 min after a restart | over: the model moved under the survey three times; the tool re-surveys on every run |
| 10 Nov | 3D house page: page code change with a browser test (one helper), four jobs | 12-30 min | 11, 16, 22, 25 min | in range |
| 10 Nov | 3D house page: a change that builds new walls or cuts an existing one, found from a drawn-on screenshot (one helper), three jobs | 18-28 min | 31, 33, 39 min | over every time: quote 30-40 min |
| 10 Nov | 3D house page: a room fitted out with a new tool (one helper), eight jobs | 15-28 min | 17, 19, 20, 22, 23, 25, 27, 30 min | mostly in range: quote 20-30 min |
| 10 Nov | 3D house page: a small edit to one room's existing tool (one helper), six jobs | 6-15 min | 3, 4, 4, 8, 8, 14 min | in range |
| 11 Nov | 3D house page: one material changed everywhere, done by me | 3-15 min | about 6 min | in range |
| 11 Nov | 3D house page: a room extended to a line drawn on a screenshot (one helper) | 30-40 min | 47 min | over again: quote 40-50 min |
| 11 Nov | 3D house page: two fit-outs in one helper (an outdoor grill station copied from another page, a window over the sink) | 40-50 min | 34 min | under the range |
| 11 Nov | 3D house page: an existing kitchen tool reshaped (one helper) | 30-40 min | 25 min | under: quote 20-30 min |
| 11 Nov | design engines with tests, no page change (one helper each): plan solvers; a drawing engine and the first four sheets | 30-40 min; 50-65 min | 18 min; 31 min | well under: quote engines at about half |
| 11 Nov | 3D house page: every wall moved to sit centred on the plan's lines (one helper) | 45-60 min | about 50 min | in time, but it fell short of its own check and was not put live |
| 5 Nov | DUH intro: a fix round | about 1 h | 0.9 h | right |
| 5 Nov | DUH intro: a check | 20-30 min | about 15 min | right |
| 5 Nov | DUH intro: finish, sound, checks, fixes | about 2-2.4 h, stage by stage | 2.1 h | right |
| 5 Nov | DUH intro: echo entrance (2 takes) | 1.5-2 h | 1.9 h | right, at the top of the range |
| 5 Nov | DUH intro: sixteen layers (3 takes) | 1.5-2 h | 3.2 h | 1.6-2x too short: the third take waited for a free slot, the slowest take took 66 min, and a fix round ran |
| 5 Nov | DUH intro sound: wind and leaf, a preview on the current video (done by me, no workflow) | 30-45 min | 21 min | a little faster than said: one generator, two endings |
| 5 Nov | DUH intro sound: rework of that preview (keep the logo's sounds), by me | 15-20 min | about 5 min | too long: reusing a finished generator is quick; say 5-10 min for a change like this |
| 6 Nov | DUH intro sound: golden rise, opening strum, bigger hall (by me) | 20-35 min | about 5 min | too long again: a change to my own generator is 5-10 min; say so |
| 6 Nov | DUH intro: inverted, echo from the layers, new shape, done directly by me in 3 steps (after the artist asked "are you being as efficient as possible?") | 2.5-3.5 h by workflow; then 10-15, 30-45 and 45-60 min by hand | 4, 2 and 8 min; 18 min in all (23:56-00:14 UTC) | direct work is many times faster than a workflow for a well-defined change; use workflows only when the artist asks for options |
| 6 Nov | DUH intro: halos off, colour study of five colourways, the chosen one applied (by me) | 30-45 min | about 3 min | 10-15x too long; the artist: "It shouldn't take you 30-45 min to remove the green halo". The halo alone is about 1 min. Hence the direct-work table above |
| 6 Nov | DUH intro: study of six iconic main colours, the orange applied (by me) | 5-10 min | about 2 min | in range, at its low end |
| 6 Nov | DUH intro: the seven colours, orange on top (by me) | (not given: asked a question first) | about 2 min | |
| 6 Nov | DUH intro: purple in place of the pink (by me) | (not given) | about 1 min | |
| 6 Nov | DUH intro: a new opening, the card deck flourish (by me) | 10-20 min | about 2 min | under the range: a new arrangement on the existing machinery is 2-10 min |
| 6 Nov | DUH intro: the star to the fingertip, a glint where it was (by me) | 3-8 min | about 3 min | in range |
| 6 Nov | DUH intro: a bigger star (by me) | (not given; 1-3 min by the table) | about 1 min | |
| 6 Nov | DUH intro: the sunflower of cards in place of the four groups (by me) | 5-15 min | about 8 min | in range; two fixes after the first look (upright cards, paths round the echo) |
| 6 Nov | DUH intro: the star guides it all, rises and sends the pulse (by me) | 5-15 min | about 9 min | in range; two fixes after the first look (its colour on the light sky, its size) |
| 6 Nov | DUH intro: the opening rebuilt as one rising movement led by the star (by me) | 10-20 min | about 6 min | under the range |
| 6 Nov | DUH intro: colours on Google Maps' colour system, from the article (by me) | about 5 min (once the site was allowed) | about 4 min | in range |
| 6 Nov | DUH intro: a background study and the deep sky blue, with the light effects made to work on it (by me) | (not given; 3-10 by the table) | about 6 min | |
| 6 Nov | DUH intro: accent study of six, chartreuse applied (by me) | about 5 min | about 4 min | in range |
| 6 Nov | DUH intro: the artist's blue and mauve, three palettes, one applied (by me) | about 5 min | about 4 min | in range |
| 6 Nov | DUH intro: the article's two rules fixed, new hues (by me) | 2-5 min | about 5 min | at the top of the range |
| 6 Nov | DUH intro: the sky lightened as the mauve was (by me) | 2-5 min | about 4 min | in range |
| 6 Nov | DUH intro: one colour system (double complementary), the mauve moved down (by me) | (not given; 3-10 by the table) | about 5 min | |
| 6 Nov | DUH intro: new colours besides the kept ones, four systems, the aqua one applied (by me) | 5-10 min | about 4 min | under the range |
| 6 Nov | DUH intro: the space look from the artist's picture (black space, sun, moon, rim light, dawn), in two steps (by me) | 10-20 min | about 7 min (02:16-02:23 UTC) | under the range: four new effects on the existing machinery |
| 6 Nov | DUH intro: new colours after the aqua, eight systems, the picture's colours applied (by me) | 3-10 min | about 3 min | at the bottom of the range |
| 6 Nov | DUH intro: the picture's blue as the sky, every colour shifted with it (by me) | 3-10 min | about 4 min | in range |
| 6 Nov | DUH intro: only the sky changed, the moon turning into the earth, the sun's orange in the logo (by me) | 10-15 min | about 5 min (02:28-02:33 UTC) | under the range: the earth from noise was quicker to draw than said |
| 6 Nov | DUH intro: the earth kept at the moon's edge, a study of mature palettes, silver and slate applied (by me) | 5-10 min | about 6 min | in range; one re-render, as four new names clashed with old ones |
| 6 Nov | DUH intro: the background turning into alignment (by me) | about 5 min | about 3 min | in range |
| 6 Nov | DUH intro: the turn doubled and smoothed, the stars opening out, colours reverted (by me) | 5-10 min | about 5 min | in range |
| 6 Nov | DUH intro: the sun's pale gold in place of the dark layer, four tried (by me) | 3-10 min | about 2 min | under the range |
| 6 Nov | DUH intro: the turn settling at the sun's peak; the moon and earth in Glyph Light's atoms (by me) | 10-15 min | about 14 min (02:56-03:10 UTC) | in range, at the top: finding the ASCII look on another branch, then timing it on five screen sizes |
| 6 Nov | DUH intro: the mauve layer taken out, the mark as its block lettering twice (by me) | (not given; 2-10 by the table) | about 4 min | |
| 6 Nov | DUH intro: a lighter earth, its ocean stepped from the sky as the picture's red from its purple (by me) | 3-8 min | about 4 min | in range |
| 6 Nov | DUH intro: the layers made even again (by me) | 2-3 min | about 3 min | in range |
| 6 Nov | DUH intro: the edge on the golden section, the hand and duh raised with it (by me) | (not given; 2-10 by the table) | about 4 min | |
| 6 Nov | DUH intro: the face's pink and the first layer's ivory swapped (by me) | about 2 min | about 2 min | right |
| 6 Nov | DUH intro: the hand's layers coming forward from below, not from the right (by me) | 3-5 min | about 3 min | in range |
| 6 Nov | DUH intro: the name's layering the same at the start as at the end (by me) | 3-5 min | about 5 min | at the top of the range |
| 6 Nov | DUH intro: the artist's chevron pattern in the hologram in place of the rings (by me) | 5-10 min | about 4 min | under the range |
| 6 Nov | DUH intro: the moon turning on its own middle as it shifts (by me) | 10-15 min | about 6 min | under the range |
| 6 Nov | DUH intro: the first duh taken out; the moon rising into view from below (by me) | 5-10 min | about 4 min | under the range |
| 6 Nov | DUH intro: the moon's turn made plain again as it rises (by me) | 3-5 min | about 5 min | at the top of the range: measuring the turn took two tries |
| 6 Nov | DUH intro: the sun in a straight line, slower (by me) | about 3 min | about 4 min | a little over: a second step to make it truly slower |
| 6 Nov | DUH intro: the hand's layers in orbit round the sun, flipping over its top (by me) | 5-10 min | about 5 min | in range |
| 6 Nov | DUH intro: a caramel side for the ivory face in place of the pink, five tried (by me) | 3-10 min | about 5 min | in range |
| 6 Nov | DUH intro: the layers' orbit into depth, flipping like cards (by me) | 5-10 min | about 4 min | under the range |
| 6 Nov | DUH intro: the hand as two whole blocks through the animation, the flat copies gone (by me) | 10-15 min | about 6 min | under the range |
| 6 Nov | DUH intro: the sun in ASCII atoms (by me) | 5-10 min | about 4 min | under the range |
| 6 Nov | DUH intro: a brighter sun, sitting on top of the fingertip (by me) | about 3 min | about 6 min | twice as long: two looks on the blue sky (its light washed out there) before its core read as a disc |
| 6 Nov | DUH intro: the glint at the hand's foot taken out (by me) | about 1 min | about 2 min | with the video |
| 5 Nov | DUH intro: golden organization and paths (3 takes) | 2 h at first, corrected to 4-5 h, then by stage to ready 6:45-7:15 pm | 3.0 h (20:45-23:45 UTC, ready 6:45 pm), with a container restart and three relaunches to retitle | the first figure ignored the 2-at-a-time limit; the corrected 4-5 h was 1 h long because the finish took 22 min, not 45-60; the stage-by-stage estimate was right |
| 11 Nov | GamePlan: the session galaxy as a knowledge graph after Graphify (script, test, drawing in the doc), the doc renamed GamePlan (by me) | 35-55 min | about 20 min (03:57-04:17 UTC) | under the range: Graphify's install was blocked, so its method went into one small script; one redraw after a look |
| 11 Nov | GamePlan: galaxy page and Game Plan doc merged into one, Graphify installed and run on it, old doc deleted (by me) | 50-80 min | about 75 min (11:45-13:00 UTC, two answers cut off and redone) | in range |
| 11 Nov | GamePlan: DRIFT Poetry rebuilt into it with all 17 Picture Poetry pages and 15 Game Plan poems; 12 saved stills and recordings carried over; DRIFT Poetry deleted (helper + me) | 1.5-2.5 h | about 2.1 h (helper 1.97 h, then checks and the move) | in range |
| 11 Nov | Model pages: the soft look (soft sun shadows, sky light, lighter edges) in both pages' viewer, from a Blender reference render, checked before and after locally (by me) | 30-45 min | about 35 min | in range |
| 11 Nov | Model pages: square shadow pattern removed (VSM, view-fitted shadow camera, far-side casting), light rebalanced; two ambient-occlusion passes tried and dropped (by me) | 40-70 min | about 45 min | in range |
| 11 Nov | Model pages: the shadow smudges removed (VSM replaced by soft PCF with a B-spline filter, a finer map reaching about 28 m ahead and fading at its edge, no shadows from cables), checked at 26 of the artist's views on desktop and phone, with two independent checks (by me + 14 helpers) | 45-75 min, then +25-40 min for the reach | about 62 min (22:42-23:44 UTC) | in range: the first check found the 10 m reach and the cable speckle, both fixed before publishing |
| 11 Nov | House model: problem audit, then fix round 1 (3 fixers, one tool each) | 75-105 min | about 97 min | in range |
| 11 Nov | House model: independent check of a composed version (counts + the artist's cameras + walk + page) | 35-55 min | 59, 98 and 98 min (three rounds) | over every time: rendering 50+ cameras in clay and colour on a loaded 4-CPU machine; quote 60-100 min |
| 11 Nov | House model: four requests in two jobs (structure under a cantilever + column move; window wall + garage doors) | 60-90 min | about 77 min | in range |
| 11 Nov | House model: room regrouping (hallway split three ways, skylight to the stair room) | 50-75 min | about 70 min | in range |
| 11 Nov | House model: bathroom re-layout from a marked picture | 40-55 min | about 38 min | under the range |
| 12 Nov | House model: mullions on every window and skylight (new tool) | 60-90 min | about 93 min | just over |
| 12 Nov | House model: all loose furniture replaced by a real maker's catalogue pieces (new tool) | 90-150 min | about 95 min | in range |
| 12 Nov | House model: fix round 2 (3 fixers) | 75-105 min | 70-93 min | in range |
| 12 Nov | House model: colour-only fix round (3 small fixes) | 35-50 min | about 40 min | in range |
| 11 Nov | Deck: height change + extension + louver button + flat louvers + fan + screens + table (one helper) | 90-120 min | about 49 min | under: one build file, clear spec |
| 11 Nov | Deck: Sit button on both model pages (page code + seat data + house tool) | 60-90 min | about 65 min | in range |
| 12 Nov | Deck: screen buttons + fixed-step walk tests + rail check | 60-80 min | about 83 min | just over |
| 11 Nov | Deck: small direct edits (pergola maker's sizes and colours; fire pit turn/scoot; board direction and colour) | 5-15 min each | 8-15 min each | in range |
| 12 Nov | Deck: an edge turned to a rail post, two posts made one, a gap under the step's lip closed (direct edit, tests, publish) | 20-30 min | about 27 min | in range |
| 12 Nov | House model: five wall and railing requests from the page (one helper, two existing tools) | about 55 min | about 65 min | just over |
| 12 Nov | House model: two leaders moved to marked corners, a wall made flat (one helper, one existing tool) | about 50 min | about 45 min | in range |
| 12 Nov | Drawing set: round 1, two helpers (2 annotated plans; 5 elevations and sections + an unrolled elevation), each with a new engine module | 50-60 min each | 53 and 35 min | in range and under; putting a round in the drawer took 1 min |
| 12 Nov | Deck: five requests from the page in one helper (a fence door that opens in Walk, three edge changes, floor colours and borders) | about 95 min | 59 min (a cut-off first helper had spent 33) | under |
| 12 Nov | Deck drawing set: 12 sheets, two helpers one after the other on the house set's engine (plans, elevations, sections, schedules, the change sheet; then cover, details, structure, the drawer) | 80-110 min | 40 and 36 min; the lead's look, two wording fixes, publish and the change document 15 min | under |
| 13 Nov | Kitchen study: traced plan, ten plans on a new plan engine, appliance research, matrix, recommended set, 37-page PDF (10 helpers in one workflow) | 3.5-4.5 h | about 4 h 40 min to v1; label polish, sources appendix and a small fix round 1 h 5 min more (39 pages) | just over |
| 13 Nov | Question answered by a small workflow: inventory from the model, construction research, answer, skeptical check (4 helpers) | 50-70 min | 62 min; the lead fixed the answer for the check's 9 points in 10 min | in range |
| 13 Nov | House model: a corner repainted and a recessed window bay made flush (one helper, check) | 45-65 min | 36 min | under |
| 13 Nov | House model: a glass door in an existing doorway, opening in Walk (one helper, check) | 40-60 min | 43 min | in range |
| 13 Nov | House model: a kitchen rebuilt from a study option with four changes (one helper, check) | 90-120 min | 75 min; then 10 min to land and redraw | under |
| 13 Nov | Drawing sheets: two engine fixes after a kitchen change (one helper, check) | 35-55 min | 25 min | under |
| 13 Nov | Kitchen round 2: a wall turned and a bathroom redesigned, a window filled, linear lights, stools (two helpers in parallel, compose, check, fix) | 2.5-3.5 h | 2 h 2 min | under |
| 13 Nov | House model: a wall made flush over a hall (one helper, check; the lead fixed a hairline) | 70-110 min | 70 min + 10 min | in range |
| 13 Nov | Page feature: red-line mode in the drawings drawer, both pages (build, test, fix, two retests, fix) | 2.5-3.5 h | about 4 h | over: two independent retests found 7 defects |
| 13 Nov | Deck model: one material changed, sheets redrawn (the lead, directly) | (none quoted) | 15 min | |
| 14 Nov | House model: a corner made flush over a door (one helper, check; the lead landed and redrew) | 70-110 min | 35 min build + 13 min check + 10 min to land | under |
| 14 Nov | House model: red lines on a plan (column square, wall straight, shower out, a corner filled), first as a build-check-fix workflow, then landed by the lead | 2.5-3.5 h quoted | about 1 h 35 min from the mark to live (8:34-10:09 am); the artist found the quote too long | the workflow was stopped after its build; the lead landed it |
| 14 Nov | House model: counter to a wall's end + a see-through bookshelf in the wall (the lead, directly, one tool) | 25-35 min | about 30 min to live, with two drawing-check fixes | in range |
| 14 Nov | House model: a door mullion and a ceiling opening's band (two helpers in parallel, no check stage; the lead looked and landed) | 35-60 min + landing | 24 and 34 min build; live 49 min after launch | in range |
