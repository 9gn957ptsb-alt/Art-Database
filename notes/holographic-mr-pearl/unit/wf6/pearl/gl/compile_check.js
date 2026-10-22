// usage: node compile_check.js page.html out.png out.json
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [page, out, js] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 500, height: 500 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + page);
  await p.waitForFunction(() => window.DONE, null, { timeout: 120000 });
  const res = await p.evaluate(() => window.RES);
  res.page_errors = errs; res.browser = 'Chromium ' + b.version() + ' (Playwright, headless, SwiftShader WebGL2)';
  await (await p.$('#c')).screenshot({ path: out });
  res.screenshot = out; fs.writeFileSync(js, JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
