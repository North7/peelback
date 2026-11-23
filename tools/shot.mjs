import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
const [,, file, out, w='1600', h='900', wait='4000', ...clicks] = process.argv;
const browser = await chromium.launch({ args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', e => errs.push(String(e)));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto('file://' + file, {waitUntil: 'domcontentloaded'});
await page.waitForTimeout(+wait);
for (const c of clicks) { if (c.startsWith('wait:')) { await page.waitForTimeout(+c.slice(5)); continue; }
  if (c.startsWith('js:')) { await page.evaluate(c.slice(3)); continue; }
  await page.click(c).catch(e => errs.push('click ' + c + ': ' + e.message)); await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await browser.close();
