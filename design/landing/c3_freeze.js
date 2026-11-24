// 概念 3：凍結的爆炸圖。Model Y 在半空中慢動作炸開成幾百塊零件，然後幾乎停住，只剩很慢的漂浮；
// 鏡頭在零件之間穿過去，景深讓近處、遠處的零件糊成光斑，焦點上的零件清楚、掛一張名牌（真的數字）。
// 一次手勢飛到下一站：整台 → 車子裡面 → 底盤 → 電池和馬達。
import {THREE, loadVehicle, makeStage, Spring, pager, loop, isDark, RM, toScreen, smooth, ease, heroCopy, HINT, dragOrbit} from './stage.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {PARTS, SPEC} from '../../car/data.js';

// 四站：焦點是哪個零件、鏡頭從哪個方向看、名牌上寫什麼（數字照 car/data.js）
const STOPS = [
  {id: null, dir: [0.75, 0.42, -0.85], dist: 1, title: 'Model Y', line: `${SPEC.length} 公尺・${Object.keys(PARTS).length} 個零件`},
  {id: 'seats', dir: [0.35, 0.55, -0.9], dist: 0.42, title: PARTS.seats.name, line: `${SPEC.seats} 個座位：前面兩個、後面三個`},
  {id: 'wheels', dir: [0.85, 0.1, -0.7], dist: 0.36, title: PARTS.wheels.name, line: '19 吋輪框，輪胎直徑 71 公分'},
  {id: 'battery', dir: [0.5, -0.32, -0.95], dist: 0.38, title: PARTS.battery.name, line: `大約 ${SPEC.battery} 度電，可以把 5000 支手機充飽`},
];

export default async function run(stage, ctx) {
  const veh = await loadVehicle('car');
  if (!ctx.alive()) return;
  const {model, layerOf} = veh;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 34, ext: 14});
  const {scene, camera, renderer, sun} = st;
  sun.position.set(5, 18, -6);
  scene.add(model.root);
  model.root.updateMatrixWorld(true);
  const C = new THREE.Box3().setFromObject(model.root).getCenter(new THREE.Vector3());

  // ---------- 每一塊（網格）各自一個轉軸，記住炸開後的位置和角度 ----------
  const meshes = [];
  model.root.traverse((o) => o.isMesh && o.visible && layerOf[o.userData.part] && meshes.push(o));
  const frags = [];
  const wc = new THREE.Vector3(), bb = new THREE.Box3();
  const MAG = [0, 3.1, 1.9, 1.2, 0.5];
  const ROT = [0, 0.55, 0.4, 0.28, 0.14];
  const partC = {};
  for (const m of meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    bb.setFromObject(m);
    if (bb.isEmpty()) continue;
    bb.getCenter(wc);
    const parent = m.parent;
    const g = new THREE.Group();
    parent.add(g);
    parent.updateMatrixWorld(true);
    g.position.copy(parent.worldToLocal(wc.clone()));
    g.updateMatrixWorld(true);
    g.attach(m);
    const L = layerOf[m.userData.part];
    const d = wc.clone().sub(C);
    d.y = d.y * 0.6 + 0.5;
    const r = Math.random();
    const offW = d.normalize().multiplyScalar(MAG[L] * (0.75 + r * 0.6));
    offW.y += 1.6; // 整團浮在半空
    const wT = wc.clone().add(offW);
    const p1 = parent.worldToLocal(wT.clone());
    const axis = new THREE.Vector3().randomDirection();
    const q1 = new THREE.Quaternion().setFromAxisAngle(axis, ROT[L] * (Math.random() - 0.5) * 2);
    frags.push({g, p0: g.position.clone(), p1, q1, axis, ph: Math.random() * 6.28, delay: (1 - THREE.MathUtils.clamp(d.length(), 0, 1)) * 0 + (4 - L) * 0.05 + Math.random() * 0.06});
    const pc = (partC[m.userData.part] ||= {s: new THREE.Vector3(), n: 0});
    pc.s.add(wT);
    pc.n++;
  }
  const centerOf = (id) => (id && partC[id] ? partC[id].s.clone().divideScalar(partC[id].n) : C.clone().add(new THREE.Vector3(0, 1.8, 0)));

  // ---------- 後製：景深 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bokeh = new BokehPass(scene, camera, {focus: 14, aperture: 0.0045, maxblur: 0.014});
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const paint = () => st.paint();
  ctx.onTheme(paint);

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy()}
    <div class="fcard" id="fcard"><i class="dot"></i><i class="lead"></i><div class="in"><em id="fcNo">01</em><b id="fcT"></b><span id="fcL"></span></div></div>
    <div class="dots" id="dots">${STOPS.map((s, i) => `<button data-i="${i}" aria-label="${s.title}"><i></i></button>`).join('')}</div>
    ${HINT}`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const hint = $('.hintdown');
  const card = $('#fcard');

  // ---------- 狀態 ----------
  let si = 0;
  const tau = new Spring(0, 9, 5.2); // 炸開的進度：慢動作
  const camP = new THREE.Vector3(), camT = new THREE.Vector3();
  const wantP = new THREE.Vector3(), wantT = new THREE.Vector3();
  const focusD = new Spring(14, 30, 11);
  const stopPose = (i) => {
    const s = STOPS[i];
    const tgt = centerOf(s.id);
    const portrait = canvas.clientWidth / canvas.clientHeight < 0.8;
    const base = 36 * Math.max(1, (portrait ? 0.95 : 1.4) / camera.aspect);
    const dir = new THREE.Vector3(...s.dir).normalize();
    wantT.copy(tgt);
    wantP.copy(tgt).addScaledVector(dir, base * s.dist);
  };
  const setCard = (i) => {
    card.classList.remove('on');
    setTimeout(() => {
      if (si !== i) return;
      $('#fcNo').textContent = '0' + (i + 1);
      $('#fcT').textContent = STOPS[i].title;
      $('#fcL').textContent = STOPS[i].line;
      card.classList.add('on');
    }, RM.matches ? 0 : 900);
    stage.querySelectorAll('#dots button').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const go = (i) => {
    stage.querySelector('.copy').classList.toggle('away', i > 0);
    si = i;
    stopPose(i);
    setCard(i);
    hint.classList.add('gone');
    setTimeout(() => si === i && i < STOPS.length - 1 && hint.classList.remove('gone'), 2600);
  };
  const pg = pager(stage, {n: STOPS.length, onGo: go, sig: ctx.sig});
  $('#dots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pg.go(+b.dataset.i);
  }, {signal: ctx.sig});
  const orbit = dragOrbit(canvas, {sig: ctx.sig});

  // 開場：整台停在地上，鏡頭在遠處；0.8 秒後慢動作炸開
  stopPose(0);
  camT.copy(C);
  camP.copy(wantP).sub(wantT).multiplyScalar(0.8).add(C);
  const t0 = setTimeout(() => (tau.to = 1), RM.matches ? 0 : 800);
  setTimeout(() => (setCard(0), hint.classList.remove('gone')), RM.matches ? 0 : 2600);
  stage.querySelectorAll('#dots button')[0].classList.add('on');

  const q = new THREE.Quaternion(), qI = new THREE.Quaternion(), qd = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const stop = loop((dt, t) => {
    const k = tau.step(dt);
    for (const f of frags) {
      const e = ease(Math.max(0, (k - f.delay) / (1 - f.delay)));
      // 凍住之後還在很慢地漂
      const drift = RM.matches ? 0 : e * 0.06;
      f.g.position.lerpVectors(f.p0, f.p1, e);
      f.g.position.y += Math.sin(t * 0.35 + f.ph) * drift * 0.5;
      q.slerpQuaternions(qI, f.q1, e);
      qd.setFromAxisAngle(f.axis, Math.sin(t * 0.21 + f.ph) * drift);
      f.g.quaternion.copy(q).multiply(qd);
    }
    // 鏡頭：彈簧飛過去（臨界阻尼），加一點手持感
    const kk = RM.matches ? 1 : 1 - Math.exp(-dt * 1.7);
    camP.lerp(wantP, kk);
    camT.lerp(wantT, kk * 1.3);
    orbit.step(dt);
    const off = camP.clone().sub(camT).applyAxisAngle(new THREE.Vector3(0, 1, 0), orbit.yaw.x);
    off.y += orbit.pitch.x * off.length() * 0.6;
    camera.position.copy(camT).add(off);
    if (!RM.matches) camera.position.add(tmp.set(Math.sin(t * 0.5) * 0.06, Math.sin(t * 0.37) * 0.05, Math.cos(t * 0.43) * 0.06));
    camera.lookAt(camT);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const portrait = w / h < 0.8;
    if (portrait) camera.setViewOffset(w, h, 0, h * 0.14, w, h);
    else camera.setViewOffset(w, h, -w * 0.12, h * 0.04, w, h);
    focusD.to = camera.position.distanceTo(camT);
    bokeh.uniforms.focus.value = focusD.step(dt);
    bokeh.uniforms.aperture.value = (si === 0 ? 0.0028 : 0.006) * (0.4 + 0.6 * smooth(k));
    composer.render(dt);
    // 名牌：跟著焦點上的零件
    const s = toScreen(centerOf(STOPS[si].id), camera, canvas);
    const box = card.querySelector('.in');
    const bw = box.offsetWidth || 220;
    const flip = s.x + 48 + bw > w - 12 && s.x - 48 - bw >= 12;
    card.classList.toggle('left', flip);
    // 兩邊都放不下（手機）：名牌留在右邊，但往左挪到畫面裡
    box.style.left = flip ? '' : Math.max(12 - s.x, Math.min(48, w - 12 - s.x - bw)) + 'px';
    card.style.transform = `translate(${s.x}px, ${s.y}px)`;
  });
  return {
    dispose() {
      stop();
      clearTimeout(t0);
      ro.disconnect();
      composer.dispose?.();
      bokeh.dispose?.();
      st.dispose();
    },
  };
}
