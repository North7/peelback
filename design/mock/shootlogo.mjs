import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
import path from 'node:path';
const b = await chromium.launch(); const p = await b.newPage({viewport: {width: 1600, height: 900}, deviceScaleFactor: 1});
await p.goto('file://' + path.resolve('logo.html')); await p.waitForTimeout(1500); await p.screenshot({path: 'out/logo.png'}); await b.close();
