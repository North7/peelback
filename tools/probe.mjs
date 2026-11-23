import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
const [,, file, expr] = process.argv;
const b = await chromium.launch({ args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await p.goto('file://' + file, {waitUntil: 'domcontentloaded'});
await p.waitForTimeout(2500);
console.log(JSON.stringify(await p.evaluate(expr), null, 1));
await b.close();
