// 觀看頁背景（拆開第一層、不要介面）：node tools/viewshot.mjs out.png 車 寬 高 主題 底色
import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , out, v, w, h, theme, bg] = process.argv;
const b = await chromium.launch({args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const p = await b.newPage({viewport: {width: +w, height: +h}, deviceScaleFactor: 2});
await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await p.goto('file://' + path.join(ROOT, 'dist/peelback.html') + '#' + v);
await p.waitForTimeout(4000);
await p.evaluate(({theme, bg}) => { document.documentElement.dataset.theme = theme; document.documentElement.style.setProperty('--bg', bg); __BUS.setLayer(1); }, {theme, bg});
await p.waitForTimeout(4500);
await p.evaluate(() => document.querySelectorAll('body > #app > *:not(canvas)').forEach((e) => { if (e.tagName !== 'CANVAS' && !e.querySelector('canvas')) e.style.visibility = 'hidden'; }));
await p.waitForTimeout(400);
await p.screenshot({path: out});
await b.close();
