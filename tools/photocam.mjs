// 用汽車之家照片的相機（ref/car/autohome/camera.json）拍網頁裡的 Model Y，輸出和照片同樣大小的圖，方便並排比對
// node tools/photocam.mjs 輸出資料夾 3,6,12,...
import {chromium} from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , out, list = '3,6,12,21,26'] = process.argv;
const cam = JSON.parse(fs.readFileSync(path.join(ROOT, 'ref/car/autohome/camera.json')));
const body = JSON.parse(fs.readFileSync(path.join(ROOT, process.env.BODYJSON || 'ref/car/autohome/body.json')));
const meta = {scale: [1, 1]};
const browser = await chromium.launch({args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const page = await browser.newPage({viewport: {width: 2000, height: 1333}, deviceScaleFactor: 1});
page.on('pageerror', (e) => console.log('ERR', String(e)));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
await page.goto('file://' + path.join(ROOT, process.env.PAGE || 'dist/peelback.html') + '#car');
await page.waitForTimeout(7000);
await page.evaluate(() => {
  document.querySelectorAll('.top,.bar,.stack,.hint,.card').forEach((e) => (e.style.display = 'none'));
  document.documentElement.style.setProperty('--bg', '#ffffff');
  document.documentElement.dataset.theme = 'light';
  __BUS.controls.enabled = false;
  __BUS.controls.update = () => {};
});
const frames = list.split(',').map(Number);
for (const i of [frames[0], ...frames]) {
  await page.evaluate(({i, cam, xmid, sc}) => {
    const {f, D, Hc, pitch, cx, cy, a3, step, ox, oz} = cam;
    const al = ((a3 + (i - 3) * step) * Math.PI) / 180;
    const s = Math.sin(al), c = Math.cos(al);
    const inv = (v) => [v[0] * s + v[2] * c, v[1], -v[0] * c + v[2] * s];
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    const C = [D * c + ox, Hc, D * s + oz];
    const K = 2; // root 放大 2 倍
    const cm = __BUS.camera;
    const V = cm.position.constructor;
    cm.position.set((C[0] - xmid) * sc[0] * K, C[1] * sc[1] * K, C[2] * sc[0] * K);
    const R = new V(...inv([1, 0, 0])), U = new V(...inv([0, cp, -sp])), B = new V(...inv([0, sp, cp]));
    const M = cm.matrix.clone().makeBasis(R, U, B);
    cm.quaternion.setFromRotationMatrix(M);
    cm.up.copy(U);
    cm.fov = (2 * Math.atan(666.5 / f) * 180) / Math.PI;
    cm.aspect = 2000 / 1333;
    cm.setViewOffset(2000, 1333, 1000 - cx, 666.5 - cy, 2000, 1333);
    cm.updateProjectionMatrix();
    cm.updateMatrixWorld(true);
  }, {i, cam, xmid: body.xmid, sc: meta.scale || [1, 1]});
  await page.waitForTimeout(900);
  await page.screenshot({path: path.join(out, `m${String(i).padStart(2, '0')}.png`)});
}
await browser.close();
console.log('ok');
