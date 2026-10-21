// Lets `node --test 5s/test/` (a directory) work: Node runs a directory through its index.js.
// It loads the pure engine tests only. The browser suites need Playwright, python3 and a built page,
// so they are run by name (see 5s/README.md):
//   node --test 5s/test/bring.test.cjs 5s/test/ground.test.cjs 5s/test/ui.smoke.cjs
'use strict';
import('./engine.test.mjs');
