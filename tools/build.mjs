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
// 兩種打包：
//   split：給網站（public/）。車子的 3D 資料（.bin）和貼圖（.jpg）是網頁旁邊的獨立檔案（assets/名字-雜湊），點進哪台才下載哪台，內容沒變就一直用快取
//   inline：全部包在一個 html 裡，給 Claude 頁面發佈（artifact）和本機工具（hero.mjs 用 file:// 開）
const bundle = (split) =>
  esbuild.build({
    entryPoints: [path.join(ROOT, 'kit/entry.js')],
    bundle: true,
    nodePaths: [DEPS],
    format: 'esm',
    minify: !process.env.DEBUG,
    write: false,
    target: 'es2022',
    legalComments: 'none',
    logLevel: 'warning',
    outdir: path.join(ROOT, 'dist'),
    assetNames: 'assets/[name]-[hash]',
    publicPath: './',
    loader: split ? {'.bin': 'file', '.jpg': 'file', '.png': 'dataurl', '.webp': 'dataurl'} : {'.bin': 'binary', '.jpg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl'},
    // CAR_ASSET=asset_toy 之類：換汽車用的車身檔（比較不同版本用）
    plugins: process.env.CAR_ASSET ? [{name: 'car-asset', setup(b) {
      b.onResolve({filter: /^\.\/asset\//}, (a) => a.importer.includes('/car/') ? {path: path.join(ROOT, 'car', process.env.CAR_ASSET, a.path.slice(8))} : undefined);
    }}] : [],
  });
for (const name of names) {
const [resSplit, resInline] = await Promise.all([bundle(true), bundle(false)]);
const jsOf = (res) => res.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/g, '<\\/script');
const js = jsOf(resSplit);
const jsInline = jsOf(resInline);
const assets = resSplit.outputFiles.filter((f) => f.path.includes(`${path.sep}assets${path.sep}`));
const css = fs.readFileSync(path.join(ROOT, 'kit/style.css'), 'utf8');
const TITLE = TITLES[name];
const {FAVICON} = await import('../kit/logo.js');
const {LOADER} = await import('../kit/loader.js');
// 網頁一打開就先照存著的日夜設定上色、放載入的輪子（程式還在下載時不要一片空白，也不要先白後黑閃一下）
const BOOT_THEME = `<script>try{document.documentElement.dataset.theme=localStorage.getItem('peelback.theme')==='dark'?'dark':'light'}catch(e){}</script>`;
const ICONLINK = `<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}"><meta name="theme-color" content="#070808">`;
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@500&family=Noto+Sans+TC:wght@400;500;700;800&display=swap">';

const page = (js) => `<title>${TITLE}</title>
${ICONLINK}
${BOOT_THEME}
<meta name="claude:viewport-fit-sides" content="cover">
${FONTS}
<style>
${css}
</style>
<div id="app">${LOADER()}</div>
<script type="module">
${js}
</script>
`;
const wrap = (inner) => `<!doctype html>
<html lang="zh-Hant-TW">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
${inner.replace('<div id="app">', '</head>\n<body>\n<div id="app">')}</body>
</html>
`;
const full = wrap(page(js));
fs.mkdirSync(path.join(ROOT, 'dist/assets'), {recursive: true});
const tag = process.env.CAR_ASSET ? '.' + process.env.CAR_ASSET : '';
fs.writeFileSync(path.join(ROOT, `dist/${name}${tag}.html`), full);
fs.writeFileSync(path.join(ROOT, `dist/${name}${tag}.inline.html`), wrap(page(jsInline)));
fs.writeFileSync(path.join(ROOT, `dist/${name}${tag}.artifact.html`), page(jsInline));
// 網站：public/index.html＋public/assets/（舊的、這次沒用到的檔案刪掉）
const keep = new Set(assets.map((f) => path.basename(f.path)));
for (const dir of ['dist/assets', 'public/assets']) {
  fs.mkdirSync(path.join(ROOT, dir), {recursive: true});
  for (const f of fs.readdirSync(path.join(ROOT, dir))) if (!keep.has(f)) fs.rmSync(path.join(ROOT, dir, f));
  for (const f of assets) fs.writeFileSync(path.join(ROOT, dir, path.basename(f.path)), f.contents);
}
if (!tag) fs.writeFileSync(path.join(ROOT, 'public/index.html'), full);
const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log(`dist/${name}.html ${kb(full.length)} + assets ${assets.length} files ${kb(assets.reduce((a, f) => a + f.contents.length, 0))}；inline ${kb(jsInline.length)}`);
}
