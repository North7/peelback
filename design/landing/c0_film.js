// 電影版：粒子 → 掃描成形 → 一層一層拆開 → 真實比例（其他三台也用粒子合成）→ 天黑亮燈，接成一部自動播放的片。
// 同一個 3D 場景、同一台攝影機，鏡頭之間不剪接；也可以自己往下滑跳到下一個鏡頭（自動播放接著從那裡走）。
//   1 一團失焦的點慢慢聚成 Model Y，一道光從車頭掃到車尾，掃過的地方變成實體的車（首屏）
//   2 Model Y 照網站裡的拆法一層一層拆開（外殼 → 裡面 → 底盤 → 電池） → 3 看座椅 → 4 繞到車底看電池
//   5 零件合回整台，115 公分的小朋友出現，公車由粒子聚成 → 6 飛機、高鐵也由粒子聚成，四台照真實比例排在一起
//   7 天黑了，四台的燈一盞一盞亮起來（燈和閃的節奏都是網站裡同一組），停在「進展廳」
// 鏡頭的節奏有快有慢：換鏡頭時加速推過去、到位時慢下來，接著只剩很慢的推近，下一段再快速移動。
import {THREE, loadVehicle, makeStage, Spring, pager, loop, isDark, RM, toScreen, smooth, ease, heroCopy, HINT, INFO, dragOrbit, isPhone, clamp01} from './stage.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import {PARTS, SPEC} from '../../car/data.js';

const KID = 1.15;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24"><path d="M8.5 5.5v13M15.5 5.5v13" stroke-width="2.4"/></svg>';
const REPLAY = '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/></svg>';
// 每個鏡頭：多久、換到這個鏡頭要花多久（tr，快速推過去）、焦點零件或位置、名牌、字幕
const SHOTS = [
  {dur: 6.5, tr: 4.6, focus: null, dir: [0.78, 0.3, -0.75], dist: 0.75},
  {dur: 4, tr: 1.6, focus: null, dir: [0.75, 0.42, -0.85], dist: 1.05, card: ['Model Y', `${SPEC.length} 公尺・${Object.keys(PARTS).length} 個零件`]},
  {dur: 3.8, tr: 1.3, focus: 'seats', dir: [0.3, 0.5, -0.92], dist: 0.62, card: [PARTS.seats.name, `${SPEC.seats} 個座位：前面兩個、後面三個`],
    chap: ['一層一層拆開', '外殼、座椅、底盤、電池，每一層都可以單獨拿出來看。']},
  {dur: 3.8, tr: 1.4, focus: 'battery', dir: [0.55, -0.3, -0.95], dist: 0.58, card: [PARTS.battery.name, `大約 ${SPEC.battery} 度電，可以把 5000 支手機充飽`],
    chap: ['每個零件都有名字', '點一下零件，名牌就跳出來，還會念給你聽。中文、英文、注音都有。']},
  {dur: 4.6, tr: 1.7, fit: ['car', 'bus'], az: 0.68, el: 0.26,
    chap: ['照真的大小做', '旁邊站一個 115 公分的小朋友。公車 12.2 公尺，差不多 11 個小朋友躺成一排。']},
  // 不框整列高鐵：前景車子和小朋友，高鐵前幾節清楚、後面交給景深糊掉
  {dur: 6, tr: 1.8, at: [-14, 2.6, 9], d: 44, atP: [-7, 2.4, 5], dP: 64, az: 1.02, el: 0.17,
    chap: ['四台車，四種大小', '最長的高鐵 304 公尺，12 節車廂一節一節都拆得開。']},
  {dur: Infinity, tr: 2.4, at: [-17, 3.2, 12], d: 52, atP: [-8, 2.8, 6], dP: 68, az: 1.16, el: 0.13, night: true,
    chap: ['天黑了，燈亮起來', '車頭燈、尾燈、高鐵整排的窗、飛機翅膀上一閃一閃的燈，每一組都可以自己打開。'], cta: true},
];
const LANES = {car: 0, bus: 4.2, train: 8.8, plane: 46};
// 每一台什麼時候用粒子聚出來（第幾個鏡頭、那個鏡頭開始後幾秒）：點聚攏、再一道光從車頭掃到車尾變成實體
const APPEAR = {
  car: {shot: 0, gather: [0.2, 2.6], sweep: [3.0, 1.9], n: 64000, spread: 'center', k: 16},
  bus: {shot: 4, gather: [0.15, 1.4], sweep: [1.2, 1.0], n: 26000, spread: 4, k: 26},
  // 飛機、高鐵：等鏡頭轉過去到位了才開始聚
  plane: {shot: 5, gather: [1.4, 1.5], sweep: [2.7, 1.2], n: 36000, spread: 10, k: 46, size: 1.5},
  train: {shot: 5, gather: [1.6, 1.5], sweep: [2.9, 1.3], n: 44000, spread: 8, k: 46, size: 1.5},
};
// 片子裡只從外面看高鐵和飛機：客艙裡的座椅、車底的機器、貨艙都不畫（省很多三角形；車窗的燈在外殼上，不受影響）
const HIDE = {
  train: ['cab', 'standard', 'business', 'accessible', 'racks', 'toilet', 'vending', 'saloon', 'motorCars', 'trailerCars', 'transformer', 'converter', 'motors', 'aux'],
  plane: ['cockpit', 'first', 'business', 'premium', 'economy', 'galley', 'lav', 'bins', 'cabinFloor', 'cargo', 'fuelTank', 'core'],
};
// 晚上要開的燈（方向燈、降落燈不開：停著的車不會打方向燈）；閃的節奏和網站一樣
const NIGHT_ON = {car: ['bar', 'head', 'tail', 'ambient'], bus: ['head', 'tail', 'sign'], train: ['head', 'tail', 'cabin'], plane: ['nav', 'beacon', 'strobe', 'logo', 'cabin']};
const PATTERN = {
  steady: () => 1,
  blink: (t) => (t % 0.8 < 0.42 ? 1 : 0),
  beacon: (t) => (t % 1.1 < 0.14 ? 1 : 0),
  strobe: (t) => {
    const k = t % 1.3;
    return k < 0.05 || (k > 0.14 && k < 0.19) ? 1 : 0;
  },
};
// 和網站（kit/app.js）同一組夜色
const NIGHT = {bg: new THREE.Color('#0a0f1c'), ground: new THREE.Color('#141a26'), moon: new THREE.Color('#9db2ff'), white: new THREE.Color('#fffaf0'), shadow: new THREE.Color('#000000')};
const easeIO = (x) => ((x = clamp01(x)) < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // 換鏡頭：先加速、再減速

const PVERT = `
attribute vec4 aRnd;
uniform float uScatter; uniform float uSweep; uniform float uTime; uniform float uFocus; uniform float uAperture; uniform float uSize; uniform float uPR; uniform vec3 uCenter; uniform float uSpread; uniform float uK;
varying float vA; varying float vSoft; varying float vHi;
void main(){
  vec3 p = position;
  vec3 dir = normalize(aRnd.xyz - 0.5 + 1e-4);
  // 散開的位置：Model Y 是一整團雲；其他車在自己的位置附近散開（高鐵 304 m，不從遠處飛過來）
  vec3 sc = uSpread < 0.0 ? uCenter + dir * (3.0 + aRnd.w * 10.0) + vec3(0.0, 1.0, 0.0) : p + dir * uSpread * (0.4 + aRnd.w) + vec3(0.0, uSpread * 0.3, 0.0);
  float t = clamp(uScatter * 1.6 - aRnd.x * 0.6, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  p = mix(p, sc, t);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float c = clamp(abs(dist - uFocus) / dist * uAperture, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, uSize * uPR * (1.0 + c * 9.0) * (uK / dist) * (0.75 + aRnd.w * 0.5));
  // 掃過去的地方換成實體的車：點淡掉；光正前方的一小段點變成主色
  float gone = smoothstep(uSweep - 0.12, uSweep + 0.02, position.x);
  vA = (1.0 - gone) / (1.0 + c * c * 60.0);
  vSoft = c;
  vHi = (1.0 - smoothstep(0.0, 0.45 + uSpread * 0.2, uSweep - position.x)) * step(position.x, uSweep) * step(uSweep, 0.2);
}`;
const PFRAG = `
uniform vec3 uInk; uniform vec3 uAcc; uniform float uAlpha;
varying float vA; varying float vSoft; varying float vHi;
void main(){
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float a = 1.0 - smoothstep(1.0 - mix(0.15, 0.6, vSoft), 1.0, r);
  if (a * vA < 0.01) discard;
  gl_FragColor = vec4(mix(uInk, uAcc, vHi), a * vA * uAlpha * (1.0 + vHi * 0.6));
  #include <colorspace_fragment>
}`;

/** 從一組網格的表面取 n 個點（照面積，InstancedMesh 每一份都算）。weight(m) 可以加重某些零件。 */
function sampleSurface(meshes, n, weight = () => 1) {
  const list = [];
  let acc = 0;
  for (const m of meshes) {
    const mat = [].concat(m.material)[0];
    if (mat?.transparent && (mat.opacity ?? 1) < 0.5) continue;
    let s;
    try {
      s = new MeshSurfaceSampler(m).build();
    } catch {
      continue;
    }
    const a = s.distribution[s.distribution.length - 1] * Math.pow(Math.abs(m.matrixWorld.determinant()), 2 / 3) * (m.isInstancedMesh ? m.count : 1) * weight(m);
    if (!(a > 0)) continue;
    list.push({m, s, cum: (acc += a)});
  }
  const out = new Float32Array(n * 3);
  const p = new THREE.Vector3(), m4 = new THREE.Matrix4();
  for (let j = 0; j < n && list.length; j++) {
    const r = Math.random() * acc;
    let lo = 0, hi = list.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (list[mid].cum < r) lo = mid + 1;
      else hi = mid;
    }
    const e = list[lo];
    e.s.sample(p);
    if (e.m.isInstancedMesh) {
      e.m.getMatrixAt(Math.floor(Math.random() * e.m.count), m4);
      p.applyMatrix4(m4);
    }
    p.applyMatrix4(e.m.matrixWorld).toArray(out, j * 3);
  }
  return out;
}

export default async function run(stage, ctx) {
  const T0 = performance.now();
  const mark = (k) => console.log('[film]', k, Math.round(performance.now() - T0), 'ms');
  const car = await loadVehicle('car');
  mark('car');
  if (!ctx.alive()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 32, near: 0.05, far: 4000, ext: 8});
  const {scene, camera, renderer, sun, hemi} = st;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); // 全畫面後製很吃效能，解析度上限壓低一點
  st.shade.geometry.dispose();
  st.shade.geometry = new THREE.PlaneGeometry(3000, 3000);
  const rim = new THREE.DirectionalLight('#eef2ff', 1.2); // 逆光：從後面慢慢繞著掃過去
  scene.add(rim, rim.target);
  // 和網站一樣：3D 的白天一律用淺色版的天空、地面、影子顏色（切到晚上才從白天慢慢變成夜色）
  const DAY = {bg: new THREE.Color(), ground: new THREE.Color(), shadow: new THREE.Color()};
  {
    const de = document.documentElement;
    const was = de.dataset.theme;
    de.dataset.theme = 'light';
    const cs = getComputedStyle(de);
    DAY.bg.set(cs.getPropertyValue('--bg').trim());
    DAY.ground.set(cs.getPropertyValue('--ground').trim());
    DAY.shadow.set(cs.getPropertyValue('--shadow-ink').trim());
    de.dataset.theme = was;
  }
  scene.background = new THREE.Color().copy(DAY.bg);
  // 地面：車子底下比背景深一點，往外慢慢淡進背景（網站裡的地面，範圍跟著鏡頭的遠近）
  const groundMat = new THREE.ShaderMaterial({
    uniforms: {uG: {value: new THREE.Color()}, uBg: {value: new THREE.Color()}, uC: {value: new THREE.Vector2()}, uR: {value: new THREE.Vector2(4, 12)}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uG; uniform vec3 uBg; uniform vec2 uC; uniform vec2 uR; varying vec3 vW;
      void main(){ gl_FragColor = vec4(mix(uG, uBg, smoothstep(uR.x, uR.y, length(vW.xz - uC))), 1.0);
      #include <colorspace_fragment>
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), groundMat);
  ground.position.y = -0.002;
  ground.renderOrder = -1;
  scene.add(ground);

  // ---------- 燈：每台車的燈材質和光源（和網站同一套標記） ----------
  const lamps = [];
  const lightsSrc = [];
  const collectLights = (v, id) => {
    const modes = Object.fromEntries((v.V.LIGHTS || []).map((g) => [g.id, g.mode || 'steady']));
    const seen = new Set();
    v.model.root.traverse((o) => {
      if (o.isLight && o.userData.light) {
        lightsSrc.push({veh: id, group: o.userData.light, light: o, base: o.intensity, mode: modes[o.userData.light] || 'steady', lv: 0});
        o.intensity = 0;
      }
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) {
        if (seen.has(m) || !m.userData?.lamp) continue;
        seen.add(m);
        lamps.push({veh: id, group: m.userData.light, mat: m, lamp: m.userData.lamp, mode: modes[m.userData.light] || 'steady', lv: 0});
        m.emissiveIntensity = m.userData.lamp.off;
      }
    });
  };

  // ---------- 四台：照實車尺寸、車頭對齊 x = 0；每台一個裁切面（掃到的地方才是實體）和一團點 ----------
  const V = {}; // id -> {root, meshes, plane, box, pts, PU, shown}
  const boxes = {};
  const place = (v, id) => {
    const root = v.model.root;
    root.scale.setScalar(1);
    v.model.track?.removeFromParent();
    root.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(root);
    root.position.x -= b.max.x;
    root.position.z += LANES[id] - (b.min.z + b.max.z) / 2;
    root.position.y -= b.min.y;
    scene.add(root);
    root.updateMatrixWorld(true);
    root.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
    collectLights(v, id);
    boxes[id] = new THREE.Box3().setFromObject(root);
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.3);
    const ms = [];
    const done = new Set();
    root.traverse((o) => {
      if (!o.isMesh || !o.visible) return;
      if (HIDE[id]?.includes(o.userData.part)) return void (o.visible = false);
      ms.push(o);
      for (const m of [].concat(o.material)) if (!done.has(m)) done.add(m), (m.clippingPlanes = [plane]), (m.clipShadows = true);
    });
    // 點：從這台的表面取樣（Model Y 裡面的零件加重一點，拆開前就看得到裡面）
    const A = APPEAR[id];
    const n = Math.round(A.n * (isPhone() ? 0.5 : 1));
    const pos = sampleSurface(ms, n, id === 'car' ? (m) => (v.layerOf[m.userData.part] === 1 ? 1 : 1.6) : () => 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aRnd', new THREE.BufferAttribute(new Float32Array(n * 4).map(() => Math.random()), 4));
    g.boundingSphere = boxes[id].getBoundingSphere(new THREE.Sphere());
    g.boundingSphere.radius += 30;
    const PU = {uScatter: {value: 1}, uSweep: {value: 0.3}, uTime: {value: 0}, uFocus: {value: 8}, uAperture: {value: 1.4}, uSize: {value: (isPhone() ? 1.5 : 1.3) * (A.size || 1)}, uPR: {value: renderer.getPixelRatio()}, uCenter: {value: boxes[id].getCenter(new THREE.Vector3())}, uSpread: {value: A.spread === 'center' ? -1 : A.spread}, uK: {value: A.k}, uInk: {value: new THREE.Color()}, uAcc: {value: new THREE.Color()}, uAlpha: {value: 0.4}};
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({uniforms: PU, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false}));
    pts.renderOrder = 2;
    pts.visible = false;
    scene.add(pts);
    // 只藏網格、不藏整台：車上的燈一直算在場景裡，燈的數量不變，材質才不用重新編譯
    for (const m of ms) m.visible = false;
    V[id] = {root, meshes: ms, plane, pts, PU, shown: false};
  };
  place(car, 'car');
  mark('car-sample');
  const {model, layerOf} = car;
  const C = boxes.car.getCenter(new THREE.Vector3());

  // Model Y 的掃描線：很淡的主色面＋細線框
  const accC = new THREE.Color();
  const sweepG = new THREE.Group();
  {
    const bb = boxes.car;
    const H = bb.max.y - bb.min.y + 0.5, W = bb.max.z - bb.min.z + 0.6;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(W, H).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({color: accC, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false}));
    const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([a, b]) => new THREE.Vector3(0, (b * H) / 2, (a * W) / 2))), new THREE.LineBasicMaterial({color: accC}));
    sweepG.add(fill, frame);
    sweepG.position.set(0, H / 2 - 0.1, (bb.min.z + bb.max.z) / 2);
    sweepG.visible = false;
    scene.add(sweepG);
  }

  // ---------- Model Y 拆開：照網站裡的拆法（每塊零件照自己的方向移開），一層一層錯開 ----------
  const NL = car.V.LAYERS.length;
  for (const p of model.pieces) (p.x = 0), (p.v = 0), (p.target = 0), (p.wait = 0);
  // 拆開後每個零件的中心（名牌、鏡頭對焦用）：先把零件放到拆開的位置量，再放回去
  const partC = {};
  let allC;
  {
    for (const p of model.pieces) p.obj.position.copy(p.base).add(p.vec);
    model.root.updateMatrixWorld(true);
    const all = new THREE.Box3();
    const bb = new THREE.Box3();
    for (const id in model.parts) {
      bb.makeEmpty();
      for (const m of model.parts[id].meshes) bb.expandByObject(m);
      if (!bb.isEmpty()) (partC[id] = bb.getCenter(new THREE.Vector3())), all.union(bb);
    }
    allC = all.getCenter(new THREE.Vector3());
    for (const p of model.pieces) p.obj.position.copy(p.base);
    model.root.updateMatrixWorld(true);
  }
  const centerOf = (id) => (id && partC[id] ? partC[id].clone() : allC.clone());
  const setApart = (on) => {
    for (const p of model.pieces) {
      const L = layerOf[p.id] || 1;
      if (p.target === (on ? 1 : 0)) continue;
      p.target = on ? 1 : 0;
      // 拆：外殼先走、一層一層往裡；合：最裡面的先回去
      p.wait = RM.matches ? 0 : on ? (L - 1) * 0.26 + (p.order % 4) * 0.05 : (NL - L) * 0.12 + (p.order % 4) * 0.04;
    }
  };

  // ---------- 小朋友（平的人形剪影，主色） ----------
  const kidMat = new THREE.MeshStandardMaterial({color: '#2f5bea', roughness: 0.5});
  const sh = new THREE.Shape();
  const half = [[0.05, 0], [0.13, 0], [0.14, 0.5], [0.17, 0.52], [0.19, 0.86], [0.16, 0.9], [0.05, 0.92], [0.045, 0.95]];
  sh.moveTo(0, 0.12);
  for (const [x, y] of half) sh.lineTo(x, y);
  for (const [x, y] of half.slice().reverse()) sh.lineTo(-x, y);
  sh.lineTo(0, 0.12);
  const kid = new THREE.Group();
  kid.add(
    new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4}), kidMat),
    new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.064, 32).rotateX(Math.PI / 2).translate(0, KID - 0.1, 0.02), kidMat),
  );
  kid.rotation.y = -0.5;
  kid.position.set(1.2, 0, -2.6);
  kid.traverse((o) => o.isMesh && (o.castShadow = true));
  kid.scale.setScalar(0.0001);
  scene.add(kid);
  boxes.kid = new THREE.Box3(new THREE.Vector3(0.9, 0, -2.9), new THREE.Vector3(1.5, KID, -2.3));
  const kidS = new Spring(0, 120, 11);

  // ---------- 其他三台：開播前就準備好（播放中才建會卡一下） ----------
  for (const id of ['bus', 'plane', 'train']) {
    const v = await loadVehicle(id);
    mark(id);
    if (!ctx.alive()) return;
    place(v, id);
  }

  // ---------- 後製：燈的光暈（只有晚上）、景深 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0, 0.5, 4.5);
  bloom.enabled = false;
  composer.addPass(bloom);
  // 景深要輕：大部分畫面是實的，只有比焦點近、遠很多的東西才微微糊開（糊的上限也壓低）
  const bokeh = new BokehPass(scene, camera, {focus: 10, aperture: 0.001, maxblur: 0.0065});
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const resize = () => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
    // 光暈用一半的解析度算：看起來差不多，輕很多
    const pr = renderer.getPixelRatio();
    bloom.setSize(Math.round((canvas.clientWidth * pr) / 2), Math.round((canvas.clientHeight * pr) / 2));
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  // 熱身：所有東西打開、從很遠的地方畫一次，著色器、影子、光暈都先準備好（不然第一次出現時會卡一下）
  {
    for (const id in V) {
      V[id].plane.constant = 9999;
      for (const m of V[id].meshes) m.visible = true;
      V[id].pts.visible = true;
    }
    kid.scale.setScalar(1);
    sweepG.visible = true;
    bloom.enabled = true;
    bloom.strength = 0.01;
    Object.assign(sun.shadow.camera, {left: -400, right: 400, top: 400, bottom: -400, near: 0.5, far: 3000});
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(100, 800, -300);
    camera.position.set(300, 160, -320);
    camera.lookAt(-150, 0, 20);
    camera.near = 1;
    camera.far = 4000;
    camera.updateProjectionMatrix();
    const culled = [];
    scene.traverse((o) => (o.isMesh || o.isPoints) && o.frustumCulled && (culled.push(o), (o.frustumCulled = false)));
    // 平行編譯（瀏覽器支援的話不會卡住主執行緒），再真的畫一次，把模型資料送進顯示卡
    await renderer.compileAsync(scene, camera);
    if (!ctx.alive()) return;
    composer.render(0.016);
    for (const o of culled) o.frustumCulled = true;
    for (const id in V) {
      V[id].plane.constant = -0.3;
      for (const m of V[id].meshes) m.visible = false;
      V[id].pts.visible = false;
    }
    kid.scale.setScalar(0.0001);
    sweepG.visible = false;
    bloom.enabled = false;
  }
  mark('warm');
  // 白天／晚上只有一個狀態（和網站一樣）：頁面是深色就是晚上的場景。第 7 個鏡頭自己天黑，這時按日夜鍵就真的換成白天（燈照樣亮著），再按回到晚上
  const de = document.documentElement;
  let userDark = de.dataset.theme === 'dark'; // 使用者自己選的
  let dayOverride = false; // 第 7 個鏡頭裡按了「白天」
  let pendingTheme = null; // 天色過半才換頁面的字色（不然背景還亮著、字底先變黑）
  const css = (n) => getComputedStyle(de).getPropertyValue(n).trim();
  const paint = () => {
    const d = isDark();
    const acc = css('--accent'), ink = css('--ink');
    kidMat.color.set(acc);
    accC.set(acc);
    for (const id in V) {
      const {PU, pts} = V[id];
      PU.uInk.value.set(ink);
      PU.uAcc.value.set(acc);
      PU.uAlpha.value = d ? 0.5 : 0.36;
      pts.material.blending = d ? THREE.AdditiveBlending : THREE.NormalBlending;
      pts.material.needsUpdate = true;
    }
  };
  paint();
  const nightOn = () => userDark || (!!SHOTS[si].night && !dayOverride);
  const applyNight = () => {
    const on = nightOn();
    nightS.to = on ? 1 : 0;
    pendingTheme = (de.dataset.theme === 'dark') === on ? null : on ? 'dark' : 'light';
  };
  ctx.onTheme((t) => {
    userDark = t === 'dark';
    if (SHOTS[si].night) dayOverride = t === 'light';
    pendingTheme = null;
    nightS.to = nightOn() ? 1 : 0;
    paint();
  });

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy()}
    <div class="chap off" id="chap"><em id="chNo"></em><h2 id="chT"></h2><p id="chL"></p><a class="cta" id="chCta" href="https://peelback.aronlab.dev/" target="_blank" rel="noopener">進展廳 ${ARROW}</a></div>
    <div class="fcard" id="fcard"><i class="dot"></i><i class="lead"></i><div class="in"><em id="fcNo">01</em><b id="fcT"></b><span id="fcL"></span></div></div>
    <div class="meter off" id="meter"><span class="k">真實長度</span><div class="big"><b id="mNum">4.79</b><small>m</small></div><span class="who" id="mWho"></span><span class="kids" id="mKids"></span></div>
    <div class="tags" id="ftags"><div class="tag vtag" data-k="plane"><em>No.02</em><b>A350-1000</b></div><div class="tag vtag" data-k="train"><em>No.04</em><b>700T</b></div></div>
    <div class="prog" id="prog">${SHOTS.map((s, i) => `<button data-i="${i}" aria-label="第 ${i + 1} 個鏡頭"><i></i></button>`).join('')}</div>
    <button class="ib playbtn" id="play" aria-label="暫停"></button>
    ${HINT}`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const hint = $('.hintdown'), card = $('#fcard'), chap = $('#chap'), meter = $('#meter'), copy = $('.copy');
  const progB = [...stage.querySelectorAll('#prog button')];
  copy.classList.add('away');

  // ---------- 狀態 ----------
  let si = 0, shotT = 0, playing = !RM.matches;
  const nightS = new Spring(0, 9, 6);
  nightS.x = nightS.to = userDark ? 1 : 0; // 頁面本來就是深色：一開始就是晚上的場景（和網站一樣）
  const num = {v: SPEC.length, from: SPEC.length, to: SPEC.length, t: 1};
  const UP = new THREE.Vector3(0, 1, 0);
  const portrait = () => camera.aspect < 0.8;
  const fit = (ids, az, el) => {
    const box = boxes.kid.clone();
    for (const id of ids) if (boxes[id]) box.union(boxes[id]);
    const c = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const right = new THREE.Vector3().crossVectors(dir.clone().negate(), UP).normalize();
    const upv = new THREE.Vector3().crossVectors(right, dir.clone().negate());
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    const sx = portrait() ? 0.9 : 0.84, sy = portrait() ? 0.42 : 0.6;
    let d = 0;
    const v = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).sub(c);
      const cz = v.dot(dir);
      d = Math.max(d, cz + Math.abs(v.dot(right)) / (tanH * sx), cz + Math.abs(v.dot(upv)) / (tanV * sy));
    }
    return {c, d, az, el};
  };
  const pose = (i) => {
    const s = SHOTS[i];
    if (s.fit) return fit(s.fit, s.az, s.el);
    // 手機直的畫面另外一個構圖：目標往車頭那一團靠，距離不要照寬度一路拉遠
    if (s.at) return portrait() ? {c: new THREE.Vector3(...s.atP), d: s.dP, az: s.az, el: s.el} : {c: new THREE.Vector3(...s.at), d: s.d * Math.max(1, 1.3 / camera.aspect), az: s.az, el: s.el};
    const dir = new THREE.Vector3(...s.dir).normalize();
    const base = 18 * Math.max(1, (portrait() ? 0.95 : 1.4) / camera.aspect);
    return {c: s.focus === null && i === 0 ? C.clone() : centerOf(s.focus), d: base * s.dist, az: Math.atan2(dir.x, -dir.z), el: Math.asin(dir.y)};
  };
  // ---------- 鏡頭：快慢有節奏。每個鏡頭先「換過去」（tr 秒，先加速再減速），到位後只剩很慢的推近 ----------
  const START = [];
  {
    let a = 0;
    for (const s of SHOTS) START.push(a), (a += s.dur);
  }
  const vec = (p, dld = 0, daz = 0, del = 0) => [p.c.x, p.c.y, p.c.z, Math.log(p.d) + dld, p.az + daz, p.el + del];
  const settle = (i) => vec(pose(i)); // 到位
  const drift = (i) => vec(pose(i), -0.07, 0.03, 0.008); // 這個鏡頭結束時（慢慢推近一點、轉一點點）
  const lerpV = (a, b, e) => a.map((x, k) => x + (b[k] - x) * e);
  const camAt = (T) => {
    let i = 0;
    while (i < SHOTS.length - 1 && T >= START[i + 1]) i++;
    const s = SHOTS[i], lt = T - START[i];
    if (lt < s.tr) {
      // 換過去：從上一個鏡頭結束的位置出發（開場從遠處、低一點的地方慢慢推進來）
      const from = i === 0 ? vec(pose(0), Math.log(2.2), -0.5, -0.1) : drift(i - 1);
      return lerpV(from, settle(i), i === 0 ? smooth(lt / s.tr) : easeIO(lt / s.tr));
    }
    // 到位後：很慢地推近（越來越慢）
    const hold = isFinite(s.dur) ? s.dur - s.tr : 40;
    return lerpV(settle(i), drift(i), 1 - Math.pow(1 - Math.min(1, (lt - s.tr) / hold), 2));
  };
  const KEYT = SHOTS.map((s, i) => START[i] + s.tr + (i === 0 ? 1.2 : 0.3)); // 暫停時停在這個鏡頭到位的地方
  let filmT = 0, auto = false;
  let camV = camAt(0);
  const blend = {k: 1, from: null};

  const setPlayIcon = () => {
    const b = $('#play');
    b.innerHTML = si === SHOTS.length - 1 ? REPLAY : playing ? PAUSE : PLAY;
    b.setAttribute('aria-label', si === SHOTS.length - 1 ? '重播' : playing ? '暫停' : '播放');
  };
  const setText = (i) => {
    const s = SHOTS[i];
    copy.classList.toggle('away', i > 1 || (i === 0 && shotT < 3));
    card.classList.remove('on');
    if (s.card)
      setTimeout(() => {
        if (si !== i) return;
        $('#fcNo').textContent = '0' + i;
        $('#fcT').textContent = s.card[0];
        $('#fcL').textContent = s.card[1];
        card.classList.add('on');
      }, RM.matches ? 0 : i === 1 ? 1500 : 800);
    chap.classList.remove('in');
    chap.classList.toggle('off', !s.chap);
    if (s.chap)
      setTimeout(() => {
        if (si !== i) return;
        $('#chNo').textContent = `0${i} / 0${SHOTS.length - 1}`;
        $('#chT').innerHTML = `<span>${s.chap[0]}</span>`;
        $('#chL').innerHTML = `<span>${s.chap[1]}</span>`;
        chap.classList.toggle('withcta', !!s.cta);
        void chap.offsetWidth;
        chap.classList.add('in');
      }, RM.matches ? 0 : s.night ? 1100 : 500);
    meter.classList.toggle('off', i < 4 || !!s.night);
    if (i >= 4) {
      const id = i === 4 ? 'bus' : 'train';
      if (num.to !== INFO[id].len) {
        num.from = num.v;
        num.to = INFO[id].len;
        num.t = i === 5 ? -1.8 : 0; // 高鐵：等它掃出來時才開始滾
      }
      const who = () => {
        $('#mWho').textContent = `${INFO[id].brand}・${INFO[id].name}`;
        $('#mKids').textContent = `差不多 ${Math.round(INFO[id].len / KID)} 個小朋友躺成一排`;
      };
      if (i === 5) setTimeout(() => si === 5 && who(), RM.matches ? 0 : 2900);
      else who();
    }
    if (i < 4) (num.v = num.from = num.to = SPEC.length), (num.t = 1);
    progB.forEach((b, k) => (b.classList.toggle('on', k === i), b.classList.toggle('done', k < i)));
    setPlayIcon();
  };
  const go = (i) => {
    si = i;
    // 自動播放走到下一段：時間軸照常；自己跳過去：時間跳到那一段的開頭，鏡頭從現在的位置順順地接過去
    if (!auto) {
      filmT = START[i];
      blend.from = camV.slice();
      blend.k = 0;
    }
    shotT = filmT - START[i];
    hint.classList.add('gone');
    setApart(i >= 1 && i <= 3);
    if (SHOTS[i].night) dayOverride = false;
    applyNight();
    setText(i);
    if (!playing) setTimeout(() => si === i && i < SHOTS.length - 1 && hint.classList.remove('gone'), 3000);
  };
  const pg = pager(stage, {n: SHOTS.length, onGo: go, sig: ctx.sig});
  $('#prog').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pg.go(+b.dataset.i);
  }, {signal: ctx.sig});
  $('#play').addEventListener('click', () => {
    if (si === SHOTS.length - 1) {
      playing = true;
      pg.go(0);
    } else playing = !playing;
    setPlayIcon();
    hint.classList.toggle('gone', playing);
  }, {signal: ctx.sig});
  const orbit = dragOrbit(canvas, {sig: ctx.sig});
  setText(0);
  if (!playing) hint.classList.remove('gone');

  // ---------- 每一格 ----------
  const tgt = new THREE.Vector3();
  const stage0 = {copyShown: false};
  // 測試用：網址加 ?speed=4 快轉（預覽視窗一秒只有幾格時才看得完一遍）；?perf 記下每一格攝影機的位置
  const SPEED = +new URLSearchParams(location.search).get('speed') || 1;
  const PERF = new URLSearchParams(location.search).has('perf');
  let t = 0, bokK = 0;
  const stop = loop((dt0, _t, raw) => {
    const dt = dt0 * SPEED;
    if (raw > 0.09 && t > 1) console.log('[film] hitch', Math.round(raw * 1000), 'ms at', filmT.toFixed(1), 'shot', si);
    t += dt;
    // 時間軸：自動播放一直往前走；暫停時只走到這個鏡頭到位為止。走過下一段的開頭就換段（進度條跟著長）
    if (playing) filmT += dt;
    else if (filmT < KEYT[si]) filmT = Math.min(KEYT[si], filmT + dt);
    if (si < SHOTS.length - 1 && filmT >= START[si + 1]) {
      auto = true;
      pg.go(si + 1);
      auto = false;
    }
    shotT = filmT - START[si];
    const cur = progB[si]?.querySelector('i');
    if (cur) cur.style.setProperty('--p', isFinite(SHOTS[si].dur) ? clamp01(shotT / SHOTS[si].dur) : 1);
    if (si === 0) {
      if (!stage0.copyShown && shotT > 2.3) (stage0.copyShown = true), copy.classList.remove('away');
      if (shotT < 0.05) copy.classList.add('away');
    } else stage0.copyShown = false;
    // 每一台：還沒輪到就藏著；輪到了點先聚攏、再一道光從車頭掃到車尾；之後就是實體
    for (const id in V) {
      const A = APPEAR[id], o = V[id];
      const lt = filmT - START[A.shot];
      const minX = boxes[id].min.x;
      let sc = 0, sw = minX - 1;
      if (si < A.shot || lt < 0) (sc = 1), (sw = 0.25);
      else if (!RM.matches) {
        sc = 1 - ease((lt - A.gather[0]) / A.gather[1]);
        sw = THREE.MathUtils.lerp(0.25, minX - 0.2, smooth((lt - A.sweep[0]) / A.sweep[1]));
      }
      const before = si < A.shot;
      o.PU.uScatter.value = sc;
      o.PU.uSweep.value = sw;
      o.PU.uTime.value = t;
      o.pts.visible = !before && sw > minX - 0.1;
      o.plane.constant = -sw;
      const show = !before && sw < 0.2;
      if (show !== o.shown) {
        o.shown = show;
        for (const m of o.meshes) m.visible = show;
      }
    }
    const carSw = V.car.PU.uSweep.value;
    sweepG.visible = si === 0 && carSw < 0.2 && carSw > boxes.car.min.x - 0.15;
    sweepG.position.x = carSw;
    // Model Y 拆開：每塊一個彈簧（和網站同一組參數），照順序一層一層走
    for (const p of model.pieces) {
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      p.v += ((RM.matches ? 400 : 120) * (p.target - p.x) - (RM.matches ? 40 : 15) * p.v) * dt;
      p.x += p.v * dt;
      p.obj.position.copy(p.base).addScaledVector(p.vec, p.x);
      if (p.hinge) p.obj.rotation.x = p.hinge * 0.985 * Math.max(0, p.x);
    }
    kidS.to = si > 4 || (si === 4 && shotT > 1.2) ? 1 : 0; // 鏡頭退開之後才出現（不然在鏡頭前面變一個大人形）
    kid.scale.setScalar(Math.max(0.0001, kidS.step(dt)));
    if (num.t < 1) {
      num.t = Math.min(1, num.t + dt / 1.3);
      num.v = num.from + (num.to - num.from) * ease(num.t);
      $('#mNum').textContent = num.v < 20 ? num.v.toFixed(num.to < 20 ? 2 : 1) : Math.round(num.v).toString();
    }
    // 天黑：背景、太陽變月光、環境光變暗；燈一台一台亮起來（晚上才有光暈）
    const n = smooth(nightS.step(dt));
    if (pendingTheme && (pendingTheme === 'dark' ? n > 0.5 : n < 0.5)) {
      de.dataset.theme = pendingTheme;
      pendingTheme = null;
      paint();
    }
    scene.background.copy(DAY.bg).lerp(NIGHT.bg, n);
    groundMat.uniforms.uG.value.copy(DAY.ground).lerp(NIGHT.ground, n);
    groundMat.uniforms.uBg.value.copy(scene.background);
    st.shadeMat.color.copy(DAY.shadow).lerp(NIGHT.shadow, n);
    sun.intensity = 2.2 + (0.32 - 2.2) * n;
    sun.color.copy(NIGHT.white).lerp(NIGHT.moon, n);
    hemi.intensity = 0.55 + (0.07 - 0.55) * n;
    scene.environmentIntensity = 0.75 + (0.09 - 0.75) * n;
    st.shadeMat.opacity = 0.22 * (1 - 0.65 * n) + 0.2 * n;
    rim.intensity = 1.2 * (1 - n);
    bloom.enabled = n > 0.01;
    bloom.strength = 0.9 * n;
    bloom.threshold = 4.5 + (1.0 - 4.5) * n;
    const ORDER_ON = ['car', 'bus', 'train', 'plane'];
    const nightT = SHOTS[si].night ? shotT : -1;
    const want = (veh, group) => (nightT < 0 || !NIGHT_ON[veh]?.includes(group) ? 0 : nightT > 0.9 + ORDER_ON.indexOf(veh) * 0.4 + NIGHT_ON[veh].indexOf(group) * 0.14 ? 1 : 0);
    for (const L of lamps) {
      const w = want(L.veh, L.group) * PATTERN[L.mode](t);
      L.lv += (w - L.lv) * (1 - Math.exp(-dt * (L.mode === 'steady' ? 6 : 40)));
      L.mat.emissiveIntensity = L.lamp.off + (L.lamp.on - L.lamp.off) * L.lv;
    }
    for (const L of lightsSrc) {
      const w = want(L.veh, L.group) * PATTERN[L.mode](t);
      L.lv += (w - L.lv) * (1 - Math.exp(-dt * 6));
      L.light.intensity = L.base * L.lv;
    }
    // 鏡頭（不加手持晃動、不加一直在飄的轉動：快慢交給時間軸）
    let cv = camAt(filmT);
    if (blend.k < 1) {
      blend.k = RM.matches ? 1 : Math.min(1, blend.k + dt / 1.6);
      const e = easeIO(blend.k);
      cv = cv.map((x, k) => blend.from[k] + (x - blend.from[k]) * e);
    }
    camV = cv;
    orbit.step(dt);
    const dist = Math.exp(cv[3]);
    const az = cv[4] + orbit.yaw.x;
    const el = cv[5] + orbit.pitch.x * 0.5;
    tgt.set(cv[0], cv[1], cv[2]);
    camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z - Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(tgt);
    if (PERF) (window.__cam ||= []).push([filmT, camera.position.x, camera.position.y, camera.position.z, tgt.x, tgt.y, tgt.z]);
    camera.near = Math.max(0.05, dist * 0.02);
    camera.far = dist * 8;
    camera.updateProjectionMatrix();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const wide = si === 4;
    if (portrait()) camera.setViewOffset(w, h, 0, wide ? -h * 0.01 : si >= 5 ? h * 0.02 : h * 0.12, w, h);
    else if (si >= 5) camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    else camera.setViewOffset(w, h, wide ? 0 : -w * 0.14, wide ? h * 0.17 : si >= 2 ? h * 0.12 : h * 0.04, w, h);
    const E = Math.max(6, dist * 0.45);
    Object.assign(sun.shadow.camera, {left: -E, right: E, top: E, bottom: -E, near: 0.5, far: E * 8});
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(tgt.x + E * 0.5, E * 2.2, tgt.z - E * 0.8);
    sun.target.position.copy(tgt);
    groundMat.uniforms.uC.value.set(tgt.x, tgt.z);
    groundMat.uniforms.uR.value.set(dist * 0.35, dist * 1.3);
    sun.shadow.bias = -0.0004 * Math.max(1, E / 8);
    const ra = t * 0.15;
    rim.position.set(tgt.x + Math.cos(ra) * 20, tgt.y + 8, tgt.z + 20 + Math.sin(ra) * 6);
    rim.target.position.copy(tgt);
    // 景深：焦點在鏡頭看的地方；點還散著時整團失焦，聚好就對焦清楚
    const fd = camera.position.distanceTo(tgt);
    bokeh.uniforms.focus.value = fd;
    for (const id in V) {
      const PU = V[id].PU;
      PU.uFocus.value = fd * (1 + PU.uScatter.value * 1.2);
      PU.uAperture.value = 0.3 + 1.1 * PU.uScatter.value;
    }
    bokeh.uniforms.aperture.value = (0.0093 / dist) * (wide ? 0.6 : 1);
    bokeh.uniforms.maxblur.value = si >= 5 ? 0.014 : 0.0065; // 最後兩個鏡頭：高鐵後半段明顯糊掉
    // 點沒有寫進深度，後製的景深會把它們當成背景一起糊掉：有點在聚的時候先關掉後製的（點自己算失焦）；第 5 個鏡頭是遠景，也關掉省效能
    const anyPts = Object.values(V).some((o) => o.pts.visible);
    // 景深打開時慢慢糊上去（不要一格就跳出來）
    bokK += ((!anyPts && !wide ? 1 : 0) - bokK) * (1 - Math.exp(-dt * 2.5));
    bokeh.enabled = bokK > 0.02;
    bokeh.uniforms.maxblur.value *= bokK;
    composer.render(dt);
    // 第 6 個鏡頭：飛機、高鐵的名字
    for (const el2 of stage.querySelectorAll('#ftags .tag')) {
      const key = el2.dataset.k;
      const on = si === 5 && !portrait() && V[key].shown && V[key].PU.uSweep.value < boxes[key].min.x;
      el2.classList.toggle('on', on);
      if (!on) continue;
      const p = key === 'plane' ? new THREE.Vector3(-INFO.plane.len * 0.45, 19, LANES.plane) : new THREE.Vector3(-32, 4.8, LANES.train);
      const s = toScreen(p, camera, canvas);
      el2.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
    }
    // 名牌跟著焦點零件；手機上放不下就往畫面裡挪
    if (SHOTS[si].card) {
      const s = toScreen(centerOf(SHOTS[si].focus), camera, canvas);
      const box = card.querySelector('.in');
      const bw = box.offsetWidth || 220;
      const flip = s.x + 48 + bw > w - 12 && s.x - 48 - bw >= 12;
      card.classList.toggle('left', flip);
      box.style.left = flip ? '' : Math.max(12 - s.x, Math.min(48, w - 12 - s.x - bw)) + 'px';
      card.style.transform = `translate(${s.x}px, ${s.y}px)`;
    }
  });
  return {
    dispose() {
      stop();
      // 離開時頁面換回使用者自己選的日夜
      if ((de.dataset.theme === 'dark') !== userDark) de.dataset.theme = userDark ? 'dark' : 'light';
      ro.disconnect();
      bokeh.dispose?.();
      bloom.dispose?.();
      st.dispose();
    },
  };
}
