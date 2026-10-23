// Lets `node --test 5s/test/` (a directory) work: Node runs a directory through its index.js.
// It loads the pure engine and hub tests only. The browser suites need Playwright, python3 and a built page,
// so they are run by name (see 5s/README.md):
//   node --test 5s/test/bring.test.cjs 5s/test/ground.test.cjs 5s/test/ui.smoke.cjs
// Connect your apps adds connect.test.mjs: reading data files on the device, and the connector client (pure, no browser).
// Links out and in adds links.test.mjs: where a thing lives, what a pasted link is, defining it (pure).
// The Game Plan reflection adds reflect.test.mjs: reading transcripts, the laws of ponytail and caveman (pure).
// Set's game adds match.test.mjs: the match engine, its levels, pieces, pairings and saga (pure).
'use strict';
import('./engine.test.mjs');
import('./hub.test.mjs');
import('./connect.test.mjs');
import('./links.test.mjs');
import('./reflect.test.mjs');
import('./match.test.mjs');
