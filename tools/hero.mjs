// 拍每台車的乾淨渲染（不要介面），給入口頁效果圖用：node tools/hero.mjs 輸出資料夾 底色 主題
import { chromium } from '/Users/aron/.claude/skills/teardown/node_modules/playwright/index.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [, , out, bg, theme] = process.argv;
const b = await chromium.launch({args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']});
const views = {bus: [-0.62, 0.3, 0.72], plane: [-0.55, 0.42, 0.72], car: [0.65, 0.28, -0.7]};
for (const v of ['bus', 'plane', 'car']) {
  const p = await b.newPage({viewport: {width: 1600, height: 1000}});
  await p.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await p.goto('file://' + path.join(ROOT, 'dist/peelback.html') + '#' + v);
  await p.waitForTimeout(5000);
  await p.evaluate(({bg, theme, pos}) => {
    document.querySelectorAll('.top,.bar,.stack,.hint,.card,#labels,.tools,.title').forEach((e) => (e.style.display = 'none'));
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('--bg', bg);
    const c = __BUS.camera;
    // 地板、地上的光斑都藏起來，只留車
    const root = __BUS.bus.root; let sc = root; while (sc.parent) sc = sc.parent;
    sc.traverse((o) => { if (o.isMesh) { let q = o, inRoot = false; while (q) { if (q === root) inRoot = true; q = q.parent; } if (!inRoot) o.visible = false; } });
    document.querySelectorAll('#app > *:not(canvas)').forEach((e) => { if (!e.querySelector('canvas')) e.style.visibility = 'hidden'; });
    __BUS.controls.enabled = false; __BUS.controls.update = () => {};
    const V = c.position.constructor;
    // 整台的範圍（不含透明的玻璃也沒關係）
    const mn = new V(1e9, 1e9, 1e9), mx = new V(-1e9, -1e9, -1e9), tv = new V();
    __BUS.bus.root.updateMatrixWorld(true);
    __BUS.bus.root.traverse((o) => { if (o.isMesh && o.visible && o.geometry.attributes.position) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) { tv.set(x, y, z).applyMatrix4(o.matrixWorld); mn.min(tv); mx.max(tv); } } });
    const ctr = mn.clone().add(mx).multiplyScalar(0.5), r = mx.clone().sub(mn).length() / 2;
    c.clearViewOffset(); c.fov = 22; c.aspect = 1.6; c.up.set(0, 1, 0);
    const d = new V(...pos).normalize().multiplyScalar(r / Math.sin((11 * Math.PI) / 180) * 0.62);
    c.position.copy(ctr).add(d); c.lookAt(ctr); c.updateProjectionMatrix();
  }, {bg, theme, pos: views[v]});
  await p.waitForTimeout(1500);
  await p.screenshot({path: path.join(out, `${v}_${theme}.png`)});
  await p.close();
}
await b.close();
