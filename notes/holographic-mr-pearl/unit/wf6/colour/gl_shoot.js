const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']});
  const p = await b.newPage();
  p.on('console', m => console.log('console:', m.text()));
  await p.goto('file://' + process.argv[2]);
  await p.waitForFunction(() => window.RESULT !== undefined, null, {timeout: 120000});
  const r = await p.evaluate(() => window.RESULT);
  require('fs').writeFileSync(process.argv[3], JSON.stringify(r));
  console.log(JSON.stringify({webgl2: r.webgl2, compiled: r.compiled, linked: r.linked, log: r.log, linklog: r.linklog, renderer: r.renderer, n: r.views.length}));
  await b.close();
})();
