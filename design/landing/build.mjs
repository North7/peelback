// 介紹頁首屏樣稿：打包成一個 html（3D 資料直接包在裡面），給 Claude 頁面發佈和本機預覽。
// node design/landing/build.mjs  →  dist/landing.html（＋複製一份到預覽伺服器的資料夾，若有給 SRV）
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DEPS = process.env.TEARDOWN_DEPS || path.join(process.env.HOME, '.claude/skills/teardown/node_modules');
const esbuild = createRequire(path.join(DEPS, 'x.js'))('esbuild');

const res = await esbuild.build({
  entryPoints: [path.join(HERE, 'main.js')],
  bundle: true,
  nodePaths: [DEPS],
  format: 'esm',
  minify: !process.env.DEBUG,
  write: false,
  target: 'es2022',
  legalComments: 'none',
  logLevel: 'warning',
  outdir: path.join(ROOT, 'dist'),
  loader: {'.bin': 'binary', '.jpg': 'dataurl', '.png': 'dataurl', '.webp': 'dataurl'},
});
const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text.replace(/<\/script/g, '<\\/script');
// 顏色、字型：直接用網站的那一段（kit/style.css 開頭到深色版定義完），介紹頁不另外抄一份
const kit = fs.readFileSync(path.join(ROOT, 'kit/style.css'), 'utf8');
const tokEnd = kit.indexOf('}', kit.indexOf(':root[data-theme="dark"]')) + 1;
const css = kit.slice(0, tokEnd) + '\n' + fs.readFileSync(path.join(HERE, 'style.css'), 'utf8');
const {FAVICON} = await import('../../kit/logo.js');
const FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600;700;800&family=JetBrains+Mono:wght@500&family=Noto+Sans+TC:wght@400;500;700;900&display=swap">';
const inner = `<title>剝剝看 首屏樣稿</title>
<link rel="icon" href="data:image/svg+xml,${encodeURIComponent(FAVICON)}">
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
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
${inner.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>')}</body>
</html>
`;
fs.mkdirSync(path.join(ROOT, 'dist'), {recursive: true});
fs.writeFileSync(path.join(ROOT, 'dist/landing.html'), full);
fs.writeFileSync(path.join(ROOT, 'dist/landing.artifact.html'), inner); // 給 Claude 頁面發佈：外層由平台包
if (process.env.SRV) fs.writeFileSync(path.join(process.env.SRV, 'landing.html'), full);
console.log('landing.html', (full.length / 1e6).toFixed(2), 'MB');
