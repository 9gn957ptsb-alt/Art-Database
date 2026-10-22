const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const [page, js] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + page);
  await p.waitForFunction(() => window.DONE, null, { timeout: 120000 });
  const res = await p.evaluate(() => window.RES); res.page_errors = errs; res.browser = b.version();
  fs.writeFileSync(js, JSON.stringify(res)); console.log(JSON.stringify(Object.fromEntries(Object.entries(res).filter(([k]) => !['film','sphere'].includes(k)))));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
