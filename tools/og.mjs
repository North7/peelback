#!/usr/bin/env node
// 分享到 LINE、Facebook、iMessage 時的預覽圖（1200×630）：紙色底、左邊標誌和一句話、右邊四台車的縮圖。
// node tools/og.mjs → public/og.png（縮圖換了就重跑一次）
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {MARK} from '../kit/logo.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPS = process.env.TEARDOWN_DEPS || path.join(process.env.HOME, '.claude/skills/teardown/node_modules');
const {chromium} = await import(path.join(DEPS, 'playwright/index.mjs'));
const img = (n) => 'data:image/webp;base64,' + fs.readFileSync(path.join(ROOT, `kit/img/${n}.webp`)).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@600;800&family=JetBrains+Mono:wght@500&family=Noto+Sans+TC:wght@500;800&display=block" rel="stylesheet">
<style>
:root { --ink: #1a1b1d; --accent: #2bd1a2; }
* { margin: 0; box-sizing: border-box; }
body { width: 1200px; height: 630px; background: #f3f1ec; color: var(--ink); font-family: "Inter Tight", "Noto Sans TC", sans-serif; position: relative; overflow: hidden; }
.l { position: absolute; left: 76px; top: 72px; bottom: 72px; width: 520px; display: flex; flex-direction: column; }
.brand { display: flex; align-items: center; gap: 16px; }
.brand svg { width: 64px; height: 64px; }
.brand b { display: block; font: 800 30px/1 "Inter Tight"; letter-spacing: -0.01em; }
.brand span { display: block; margin-top: 6px; font: 500 18px/1 "Noto Sans TC"; color: #676a6f; letter-spacing: 0.08em; }
h1 { margin-top: auto; font: 800 58px/1.22 "Noto Sans TC"; letter-spacing: 0.01em; }
p { margin-top: 22px; font: 500 15px/1 "JetBrains Mono"; letter-spacing: 0.16em; color: #676a6f; }
.r { position: absolute; right: 40px; top: 40px; width: 560px; height: 550px; }
.r img { position: absolute; filter: drop-shadow(0 14px 18px rgba(60, 45, 25, 0.16)); }
</style></head><body>
<div class="l"><div class="brand">${MARK}<div><b>Peelback</b><span>剝剝看</span></div></div>
<h1>把真的交通工具，<br>一層一層剝開</h1><p>No.01–04 · 公車 · 飛機 · 汽車 · 高鐵</p></div>
<div class="r">
<img src="${img('plane')}" style="width:560px; left:10px; top:0">
<img src="${img('train')}" style="width:400px; left:180px; top:200px">
<img src="${img('bus')}" style="width:330px; left:0; top:300px">
<img src="${img('car')}" style="width:290px; left:270px; top:330px">
</div></body></html>`;
const b = await chromium.launch();
const p = await b.newPage({viewport: {width: 1200, height: 630}});
await p.setContent(html, {waitUntil: 'networkidle'});
await p.evaluate(() => document.fonts.ready);
await p.screenshot({path: path.join(ROOT, 'public/og.png')});
await b.close();
console.log('public/og.png');
