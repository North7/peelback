#!/usr/bin/env node
// 把一台車（bus/、plane/…）打包成兩個檔案：
//   dist/<name>.html          完整的離線網頁（three.js 包在裡面，直接用瀏覽器開）
//   dist/<name>.artifact.html 給 Claude 頁面發佈用（不含 <html>/<head>/<body>，外層由平台包）
// node tools/build.mjs            全部
// node tools/build.mjs plane      只打包飛機
// esbuild 和 three 借用 teardown 技能的 node_modules，這個專案本身不用 npm install。
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEPS = process.env.TEARDOWN_DEPS || path.join(process.env.HOME, '.claude/skills/teardown/node_modules');
const require = createRequire(path.join(DEPS, 'x.js'));
const esbuild = require('esbuild');

const TITLES = {peelback: '剝剝看 Peelback'};
const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TITLES);
for (const name of names) {
const res = await esbuild.build({
  entryPoints: [path.join(ROOT, 'kit/entry.js')],
  bundle: true,
  nodePaths: [DEPS],
  format: 'esm',
  minify: !process.env.DEBUG,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
  // 汽車的車身網格和貼圖（從實車照片做的，見 tools/hull/）
  loader: {'.bin': 'binary', '.jpg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl'},
  // CAR_ASSET=asset_toy 之類：換汽車用的車身檔（比較不同版本用）
  plugins: process.env.CAR_ASSET ? [{name: 'car-asset', setup(b) {
    b.onResolve({filter: /^\.\/asset\//}, (a) => a.importer.includes('/car/') ? {path: path.join(ROOT, 'car', process.env.CAR_ASSET, a.path.slice(8))} : undefined);
  }}] : [],
});
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync(path.join(ROOT, 'kit/style.css'), 'utf8');
const TITLE = TITLES[name];
const {FAVICON} = await import('../kit/logo.js');
const ICONLINK = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}"><meta name="theme-color" content="#070808">`;
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@500&family=Noto+Sans+TC:wght@400;500;700;800&display=swap">';

const inner = `<title>${TITLE}</title>
${ICONLINK}
<meta name="claude:viewport-fit-sides" content="cover">
${FONTS}
<style>
${css}
</style>
<div id="app"></div>
<script type="module">
${js}
</script>
`;
const full = `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
${inner.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>')}</body>
</html>
`;
fs.mkdirSync(path.join(ROOT, 'dist'), {recursive: true});
const tag = process.env.CAR_ASSET ? '.' + process.env.CAR_ASSET : '';
fs.writeFileSync(path.join(ROOT, `dist/${name}${tag}.html`), full);
fs.writeFileSync(path.join(ROOT, `dist/${name}${tag}.artifact.html`), inner);
console.log(`dist/${name}.html ${(full.length / 1024).toFixed(0)} KB`);
}
