import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
import path from 'node:path';
const dir = path.resolve('.');
const b = await chromium.launch();
for (const d of (process.argv[2] || 'A,B,C').split(','))
  for (const p of ['home', 'view'])
    for (const m of [0, 1]) {
      const pg = await b.newPage({viewport: m ? {width: 390, height: 844} : {width: 1440, height: 900}, deviceScaleFactor: 2});
      await pg.goto(`file://${dir}/index.html?d=${d}&p=${p}&m=${m}`);
      await pg.waitForTimeout(1800);
      await pg.screenshot({path: `${dir}/out/${d}_${p}_${m ? 'm' : 'd'}.png`});
      await pg.close();
    }
await b.close();
