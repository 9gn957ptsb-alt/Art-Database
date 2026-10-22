// usage: node shoot.js page.html out.png [timeout_ms]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const [page, out, tmo] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1700, height: 1300 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + page);
  await p.waitForFunction(() => window.DONE || window.ERR, null, { timeout: parseInt(tmo || '600000') });
  const err = await p.evaluate(() => window.ERR || null);
  if (err) { console.log('SHADER ERROR', err.slice(0, 3000)); await b.close(); process.exit(1); }
  const ms = await p.evaluate(() => window.MS);
  const el = await p.$('#c'); await el.screenshot({ path: out });
  console.log('ok', out, 'draw ms', Math.round(ms), errs.slice(0, 3));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
