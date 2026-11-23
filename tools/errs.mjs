import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
const b = await chromium.launch({ args: ['--use-angle=metal','--enable-gpu','--ignore-gpu-blocklist'] });
const p = await b.newPage();
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
p.on('pageerror', e => console.log('ERR', e.stack?.split('\n').slice(0,4).join('\n')));
await p.goto('file://' + process.argv[2], {waitUntil: 'domcontentloaded'});
await p.waitForTimeout(2500);
await b.close();
