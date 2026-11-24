// 剝剝看的介紹（#intro）：第一次來的人先看這一段，看完進展廳；展廳左上角可以再看一次。
// 一部自動播放的片，同一個 3D 場景、同一台攝影機、鏡頭之間不剪接（往下滑、點進度條也可以自己跳）：
//   1 一團失焦的點聚成 Model Y，一道光從車頭掃到車尾，掃過的地方變成實體（首屏）
//   2 Model Y 照網站的拆法一層一層拆開 → 3 看座椅 → 4 繞到車底看電池
//   5 零件合回整台，115 公分的小朋友出現，公車由粒子聚成 → 6 飛機、高鐵也由粒子聚成，四種交通工具照真實比例排在一起
//   7 天黑了，四台的燈一盞一盞亮起來（燈和閃的節奏都是網站裡同一組），停在「進展廳」
// 鏡頭的節奏有快有慢：換鏡頭時加速推過去、到位後只剩很慢的推近。景深很輕：大部分畫面是實的。
// 顏色、日夜、語言、按鈕都和網站同一套：深色模式就是晚上的場景；片子自己天黑時按日夜鍵會整個換成白天。
// 原型在 design/landing/（五個首屏概念的比較）。
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';
import {L, H, HP} from './i18n.js';
import {LOGO} from './logo.js';
import {sysMenu, bindSys, applyThemeAttr} from './ui.js';
import {PARTS, SPEC} from '../car/data.js';

const KID = 1.15; // 小朋友身高（和網站裡「幾個小朋友躺成一排」同一個數字）
const LEN = {bus: 12.2, plane: 73.79, car: 4.79, train: 304}; // 各車 data.js 的 SPEC.length
const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/></svg>';
const PAUSE = '<svg viewBox="0 0 24 24"><path d="M8.5 5.5v13M15.5 5.5v13"/></svg>';
const REPLAY = '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/></svg>';
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const STR = {
  kicker: ['剝剝看 Peelback', 'Peelback'],
  h1a: ['把真的交通工具，', 'Real vehicles,'],
  h1b: ['一層一層剝開', 'peeled layer by layer'],
  sub: ['公車、飛機、汽車、高鐵，照實車的尺寸和零件做成 3D。點一下拆開，看看裡面有什麼。', 'A bus, a plane, a car and a high-speed train, built in 3D from their real sizes and parts. Tap one to take it apart and see what’s inside.'],
  go: ['進展廳', 'Enter the gallery'],
  skip: ['跳過', 'Skip'],
  len: ['真實長度', 'Real length'],
  kids: (n) => [`差不多 ${n} 個小朋友躺成一排`, `About ${n} kids lying in a row`],
  play: ['播放', 'Play'],
  pause: ['暫停', 'Pause'],
  replay: ['重播', 'Replay'],
  shot: (i) => [`第 ${i} 個鏡頭`, `Shot ${i}`],
};
// 每個鏡頭：多久、換到這個鏡頭要花多久（tr，快速推過去）、焦點零件或位置、名牌、字幕
const SHOTS = [
  {dur: 6.5, tr: 4.6, focus: null, dir: [0.78, 0.3, -0.75], dist: 0.75},
  {dur: 4, tr: 1.6, focus: null, dir: [0.75, 0.42, -0.85], dist: 1.05, card: [['Model Y', 'Model Y'], [`${SPEC.length} 公尺・${Object.keys(PARTS).length} 個零件`, `${SPEC.length} m · ${Object.keys(PARTS).length} parts`]]},
  {dur: 3.8, tr: 1.3, focus: 'seats', dir: [0.3, 0.5, -0.92], dist: 0.62, card: [[PARTS.seats.name, cap(PARTS.seats.en)], [`${SPEC.seats} 個座位：前面兩個、後面三個`, `${SPEC.seats} seats: two in front, three in back`]],
    chap: [['一層一層拆開', 'Layer by layer'], ['外殼、座椅、底盤、電池，每一層都可以單獨拿出來看。', 'Body, seats, chassis, battery: every layer comes off on its own.']]},
  {dur: 3.8, tr: 1.4, focus: 'battery', dir: [0.55, -0.3, -0.95], dist: 0.58, card: [[PARTS.battery.name, cap(PARTS.battery.en)], [`大約 ${SPEC.battery} 度電，可以把 5000 支手機充飽`, `About ${SPEC.battery} kWh, enough to charge 5,000 phones`]],
    chap: [['每個零件都有名字', 'Every part has a name'], ['點一下零件，名牌就跳出來，還會念給你聽。中文、英文、注音都有。', 'Tap a part and its name tag pops up and is read aloud, in Chinese, English or with Zhuyin.']]},
  {dur: 4.6, tr: 1.7, fit: ['car', 'bus'], az: 0.68, el: 0.26,
    chap: [['照真的大小做', 'Built to real size'], ['旁邊站一個 115 公分的小朋友。公車 12.2 公尺，差不多 11 個小朋友躺成一排。', 'Next to a 115 cm kid. The bus is 12.2 m, about 11 kids lying in a row.']]},
  // 不框整列高鐵：前景車子和小朋友，高鐵前幾節清楚、後面交給景深糊掉
  {dur: 6, tr: 1.8, at: [-17, 3.6, 14.5], d: 62, atP: [-13, 4, 15.5], dP: 104, az: 0.92, el: 0.22,
    chap: [['四種交通工具，大小差很多', 'Four ways to travel, very different sizes'], ['最長的高鐵 304 公尺，12 節車廂一節一節都拆得開。', 'The high-speed train is 304 m long, and all 12 cars come apart.']]},
  {dur: Infinity, tr: 2.4, at: [-19, 4, 15.5], d: 66, atP: [-17, 5, 20.5], dP: 122, az: 1.0, el: 0.19, night: true,
    chap: [['天黑了，燈亮起來', 'Lights on after dark'], ['車頭燈、尾燈、高鐵整排的窗、飛機翅膀上一閃一閃的燈，每一組都可以自己打開。', 'Headlights, tail lights, the train’s rows of windows, the blinking lights on the wings: you can switch each set on yourself.']], cta: true},
];
const LANES = {car: 0, bus: 4.2, train: 11.4, plane: 46}; // 公車和高鐵之間留 4 公尺左右
// 最後兩鏡：從最前面那一團（Model Y、公車的車頭）到飛機機頭都要清楚，再往後（高鐵後段）才慢慢糊
const FRONT = new THREE.Vector3(-1.5, 1.4, 2);
const PLANE_NOSE = new THREE.Vector3(-26, 5, 46);
const LDIR = new THREE.Vector3(0.5, 2.2, -0.8).normalize(); // 太陽的方向（固定）
// 飛機往後挪：機頭停在高鐵第二節後方（和其他車一樣對齊起跑線的話，最後一鏡機頭會在畫面外）
const OFFX = {plane: -26};
// 每一台什麼時候用粒子聚出來（第幾個鏡頭、那個鏡頭開始後幾秒）：點聚攏、再一道光從車頭掃到車尾變成實體
const APPEAR = {
  car: {shot: 0, gather: [0.2, 2.6], sweep: [3.0, 1.9], n: 64000, spread: 'center', k: 16},
  bus: {shot: 4, gather: [0.15, 1.4], sweep: [1.2, 1.0], n: 26000, spread: 4, k: 26},
  // 飛機、高鐵：等鏡頭轉過去到位了才開始聚
  plane: {shot: 5, gather: [1.4, 1.5], sweep: [2.7, 1.2], n: 36000, spread: 10, k: 46, size: 1.5},
  train: {shot: 5, gather: [1.6, 1.5], sweep: [2.9, 1.3], n: 44000, spread: 8, k: 46, size: 1.5},
};
// 片子裡只從外面看高鐵和飛機：客艙裡的座椅、車底的機器、貨艙都不畫（車窗的燈在外殼上，不受影響）
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

const RM = matchMedia('(prefers-reduced-motion: reduce)');
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const smooth = (x) => (x = clamp01(x)) * x * (3 - 2 * x);
const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIO = (x) => ((x = clamp01(x)) < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2); // 換鏡頭：先加速、再減速
const isPhone = () => innerWidth < 700;

/** 彈簧：可以被打斷，從當下的位置和速度接著動。 */
class Spring {
  constructor(x = 0, k = 90, c = 16) {
    Object.assign(this, {x, v: 0, to: x, k, c});
  }
  step(dt) {
    if (RM.matches) return (this.x = this.to), (this.v = 0), this.x;
    const n = Math.ceil(dt / 0.008), h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.k * (this.to - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}
const _v = new THREE.Vector3();
const toScreen = (p, camera, el) => {
  _v.copy(p).project(camera);
  return {x: (_v.x * 0.5 + 0.5) * el.clientWidth, y: (-_v.y * 0.5 + 0.5) * el.clientHeight};
};

const PVERT = `
attribute vec4 aRnd;
uniform float uScatter; uniform float uSweep; uniform float uFocus; uniform float uAperture; uniform float uSize; uniform float uPR; uniform vec3 uCenter; uniform float uSpread; uniform float uK; uniform float uStart;
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
  vHi = (1.0 - smoothstep(0.0, 0.45 + uSpread * 0.2, uSweep - position.x)) * step(position.x, uSweep) * step(uSweep, uStart - 0.05);
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

/**
 * 開始介紹。vehicles：{bus, plane, car, train} 車子的定義；catalog：展廳的清單（名字、編號）；onDone()：進展廳。
 * 先下載、建好四台、熱身畫一次（播放中不再建模型、編譯著色器，才不會卡），再開始播。回傳 {dispose}。
 */
export async function startIntro({vehicles, catalog, onDone, alive}) {
  const app = document.getElementById('app');
  const ac = new AbortController();
  const sig = {signal: ac.signal};
  const info = Object.fromEntries(catalog.map((x) => [x.id, x]));
  // 載入的輪子＋右上角「跳過」：等不及的人可以直接進展廳（不用按返回）
  app.innerHTML = `<div class="intro" id="intro"><canvas class="igl"></canvas></div><div class="loading" id="iLoad"><div class="wheel"></div><button class="ipill iskipload" id="iSkipLoad">${HP(STR.skip)}</button></div>`;
  app.querySelector('#iSkipLoad').onclick = () => onDone();
  const root = app.querySelector('#intro');
  const canvas = root.querySelector('canvas');
  const de = document.documentElement;
  const css = (n) => getComputedStyle(de).getPropertyValue(n).trim();
  let disposed = false;
  const gone = () => disposed || !alive();

  const loadVehicle = async (id) => {
    const V = vehicles[id];
    await V.preload?.();
    if (gone()) return null; // 已經離開了：不要再建（建模型很重）
    const model = V.build();
    const layerOf = {};
    V.LAYERS.forEach((Ly, i) => Ly.ids.forEach((pid) => (layerOf[pid] = i + 1)));
    const variant = V.variants?.[0]?.id;
    for (const p of model.pieces) {
      p.base = p.obj.position.clone();
      if (V.present && !V.present(p.id, variant)) p.obj.visible = false;
    }
    model.root.updateMatrixWorld(true);
    return {V, model, layerOf};
  };

  // ---------- 場景（和網站同一套光：色調、環境光、太陽、接觸陰影） ----------
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5)); // 全畫面後製很吃效能，解析度上限壓低一點
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 4000);
  const envTex = (() => {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    return t;
  })();
  scene.environment = envTex;
  let released = false;
  const releaseGL = () => {
    if (released) return;
    released = true;
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) {
        for (const k in m) if (m[k]?.isTexture) m[k].dispose();
        m.dispose?.();
      }
    });
    scene.clear();
    envTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  const bail = () => {
    ac.abort();
    releaseGL();
    return {dispose() {}};
  };
  const sun = new THREE.DirectionalLight('#fffaf0', 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2a6', 0.55);
  const rim = new THREE.DirectionalLight('#eef2ff', 1.2); // 逆光：從後面慢慢繞著掃過去
  scene.add(sun, sun.target, hemi, rim, rim.target);
  const shadeMat = new THREE.ShadowMaterial({opacity: 0.22});
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), shadeMat);
  shade.position.y = 0.001;
  shade.receiveShadow = true;
  scene.add(shade);
  // 和網站一樣：3D 的白天一律用淺色版的天空、地面、影子顏色（切到晚上才從白天慢慢變成夜色）
  const DAY = {bg: new THREE.Color(), ground: new THREE.Color(), shadow: new THREE.Color()};
  {
    const was = de.dataset.theme;
    de.dataset.theme = 'light';
    DAY.bg.set(css('--bg'));
    DAY.ground.set(css('--ground'));
    DAY.shadow.set(css('--shadow-ink'));
    de.dataset.theme = was;
  }
  scene.background = DAY.bg.clone();
  // 地面：車子底下比背景深一點，往外慢慢淡進背景（範圍跟著鏡頭的遠近）
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

  // ---------- 四台：照實車尺寸、車頭對齊（飛機往後挪）；每台一個裁切面（掃到的地方才是實體）和一團點 ----------
  const V = {};
  const boxes = {};
  const place = (v, id) => {
    const r = v.model.root;
    r.scale.setScalar(1);
    v.model.track?.removeFromParent();
    r.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(r);
    r.position.x += (OFFX[id] || 0) - b.max.x;
    r.position.z += LANES[id] - (b.min.z + b.max.z) / 2;
    r.position.y -= b.min.y;
    scene.add(r);
    r.updateMatrixWorld(true);
    r.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
    collectLights(v, id);
    boxes[id] = new THREE.Box3().setFromObject(r);
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -9999);
    const ms = [];
    const done = new Set();
    r.traverse((o) => {
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
    const PU = {uScatter: {value: 1}, uSweep: {value: 0.3}, uFocus: {value: 8}, uAperture: {value: 1.4}, uSize: {value: (isPhone() ? 1.5 : 1.3) * (A.size || 1)}, uPR: {value: renderer.getPixelRatio()}, uCenter: {value: boxes[id].getCenter(new THREE.Vector3())}, uSpread: {value: A.spread === 'center' ? -1 : A.spread}, uK: {value: A.k}, uStart: {value: boxes[id].max.x + 0.25}, uInk: {value: new THREE.Color()}, uAcc: {value: new THREE.Color()}, uAlpha: {value: 0.4}};
    const pts = new THREE.Points(g, new THREE.ShaderMaterial({uniforms: PU, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false}));
    pts.renderOrder = 2;
    pts.visible = false;
    scene.add(pts);
    // 只藏網格、不藏整台：車上的燈一直算在場景裡，燈的數量不變，材質才不用重新編譯
    for (const m of ms) m.visible = false;
    V[id] = {meshes: ms, plane, pts, PU, shown: false};
  };
  const car = await loadVehicle('car');
  if (gone() || !car) return bail();
  place(car, 'car');
  const {model, layerOf} = car;
  const C = boxes.car.getCenter(new THREE.Vector3());

  // Model Y 的掃描線：很淡的主色面＋細線框
  const accC = new THREE.Color();
  const sweepG = new THREE.Group();
  {
    const bb = boxes.car;
    const Hh = bb.max.y - bb.min.y + 0.5, W = bb.max.z - bb.min.z + 0.6;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh).rotateY(Math.PI / 2), new THREE.MeshBasicMaterial({color: accC, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false}));
    const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([a, b]) => new THREE.Vector3(0, (b * Hh) / 2, (a * W) / 2))), new THREE.LineBasicMaterial({color: accC}));
    sweepG.add(fill, frame);
    sweepG.position.set(0, Hh / 2 - 0.1, (bb.min.z + bb.max.z) / 2);
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
    const all = new THREE.Box3(), bb = new THREE.Box3();
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
      const Ly = layerOf[p.id] || 1;
      if (p.target === (on ? 1 : 0)) continue;
      p.target = on ? 1 : 0;
      // 拆：外殼先走、一層一層往裡；合：最裡面的先回去
      p.wait = RM.matches ? 0 : on ? (Ly - 1) * 0.26 + (p.order % 4) * 0.05 : (NL - Ly) * 0.12 + (p.order % 4) * 0.04;
    }
  };

  // ---------- 小朋友（平的人形剪影，主色） ----------
  const kidMat = new THREE.MeshStandardMaterial({color: '#2bd1a2', roughness: 0.5});
  const kid = new THREE.Group();
  {
    const sh = new THREE.Shape();
    const half = [[0.05, 0], [0.13, 0], [0.14, 0.5], [0.17, 0.52], [0.19, 0.86], [0.16, 0.9], [0.05, 0.92], [0.045, 0.95]];
    sh.moveTo(0, 0.12);
    for (const [x, y] of half) sh.lineTo(x, y);
    for (const [x, y] of half.slice().reverse()) sh.lineTo(-x, y);
    sh.lineTo(0, 0.12);
    kid.add(
      new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4}), kidMat),
      new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.064, 32).rotateX(Math.PI / 2).translate(0, KID - 0.1, 0.02), kidMat),
    );
  }
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
    if (gone() || !v) return bail();
    place(v, id);
  }

  // ---------- 後製：燈的光暈（只有晚上）、景深 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0, 0.5, 4.5);
  bloom.enabled = false;
  composer.addPass(bloom);
  // 景深要輕：大部分畫面是實的，只有比焦點近、遠很多的東西才微微糊開
  const bokeh = new BokehPass(scene, camera, {focus: 10, aperture: 0.001, maxblur: 0.0065});
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    // 光暈用一半的解析度算：看起來差不多，輕很多
    const pr = renderer.getPixelRatio();
    bloom.setSize(Math.round((w * pr) / 2), Math.round((h * pr) / 2));
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
    if (gone()) return bail();
    composer.render(0.016);
    for (const o of culled) o.frustumCulled = true;
    for (const id in V) {
      V[id].plane.constant = -9999;
      for (const m of V[id].meshes) m.visible = false;
      V[id].pts.visible = false;
    }
    kid.scale.setScalar(0.0001);
    sweepG.visible = false;
    bloom.enabled = false;
  }

  // ---------- 字和按鈕 ----------
  root.insertAdjacentHTML('beforeend', `
    <header class="htop itop">
      <a class="brand" href="#" aria-label="Peelback">${LOGO('')}</a>
      <div class="iright">
        <button class="ipill" id="iSkip"></button>
        <button class="round" id="iPlay"></button>
        ${sysMenu({sound: false, view: false})}
      </div>
    </header>
    <div class="icopy away" id="iCopy"><p class="ikicker"></p><h1></h1><p class="isub"></p><button class="icta" data-go>${ARROW}<span></span></button></div>
    <div class="ichap off" id="iChap"><em id="chNo"></em><h2 id="chT"></h2><p id="chL"></p><button class="icta" data-go>${ARROW}<span></span></button></div>
    <div class="icard" id="iCard"><i class="dot"></i><i class="lead"></i><div class="in"><em id="fcNo"></em><b id="fcT"></b><span id="fcL"></span></div></div>
    <div class="imeter off" id="iMeter"><span class="k"></span><div class="big"><b id="mNum">4.79</b><small>m</small></div><span class="who" id="mWho"></span><span class="kids" id="mKids"></span></div>
    <div class="itags" id="iTags"><div class="itag" data-k="plane"><em>No.${info.plane.no}</em><b></b></div><div class="itag" data-k="train"><em>No.${info.train.no}</em><b></b></div></div>
    <nav class="iprog" id="iProg">${SHOTS.map((s, i) => `<button data-i="${i}"><i></i></button>`).join('')}</nav>
    <div class="ihint gone" id="iHint"><div class="ring"><svg viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></svg></div><div class="flow"></div></div>`);
  const $ = (s) => root.querySelector(s);
  const hint = $('#iHint'), card = $('#iCard'), chap = $('#iChap'), meter = $('#iMeter'), copy = $('#iCopy');
  const progB = [...root.querySelectorAll('#iProg button')];

  // ---------- 狀態 ----------
  let si = 0, shotT = 0, playing = !RM.matches;
  // 白天／晚上只有一個狀態（和網站一樣）：頁面是深色就是晚上的場景。第 7 個鏡頭自己天黑，這時按日夜鍵就整個換成白天（燈照樣亮著），再按回到晚上
  let userDark = de.dataset.theme === 'dark';
  let dayOverride = false;
  let pendingTheme = null; // 天色過半才換頁面的字色（不然背景還亮著、字底先變黑）
  let lastAttr = de.dataset.theme, selfSet = null;
  const nightS = new Spring(userDark ? 1 : 0, 9, 6);
  const nightOn = () => userDark || (!!SHOTS[si].night && !dayOverride);
  const num = {v: SPEC.length, from: SPEC.length, to: SPEC.length, t: 1};
  const paint = () => {
    const d = de.dataset.theme === 'dark';
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
  const setThemeAttr = (t) => {
    selfSet = lastAttr = t;
    de.dataset.theme = t;
    paint();
  };
  // 使用者按了日夜鍵（網站的日夜鍵：會存起來）
  const onUserTheme = () => {
    const a = de.dataset.theme;
    if (a === lastAttr) return;
    lastAttr = a;
    if (a === selfSet) return void (selfSet = null);
    userDark = a === 'dark';
    if (SHOTS[si].night) dayOverride = a === 'light';
    pendingTheme = null;
    nightS.x = nightS.to = nightOn() ? 1 : 0; // 網站的日夜切換是一圈光掃過去：新的場景要馬上畫好
    paint();
    frame(0);
  };
  const themeObs = new MutationObserver(onUserTheme);
  themeObs.observe(de, {attributes: true, attributeFilter: ['data-theme']});
  addEventListener('peelback:theme', onUserTheme, sig);
  const applyNight = () => {
    const on = nightOn();
    nightS.to = on ? 1 : 0;
    pendingTheme = (de.dataset.theme === 'dark') === on ? null : on ? 'dark' : 'light';
  };
  paint();

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
    return {c: i === 0 ? C.clone() : centerOf(s.focus), d: base * s.dist, az: Math.atan2(dir.x, -dir.z), el: Math.asin(dir.y)};
  };
  // ---------- 鏡頭：快慢有節奏。每個鏡頭先「換過去」（tr 秒，先加速再減速），到位後只剩很慢的推近 ----------
  const START = [];
  {
    let a = 0;
    for (const s of SHOTS) START.push(a), (a += s.dur);
  }
  const vec = (p, dld = 0, daz = 0, del = 0) => [p.c.x, p.c.y, p.c.z, Math.log(p.d) + dld, p.az + daz, p.el + del];
  const settle = (i) => vec(pose(i));
  const drift = (i) => vec(pose(i), -0.07, 0.03, 0.008);
  const lerpV = (a, b, e) => a.map((x, k) => x + (b[k] - x) * e);
  const camAt = (T) => {
    let i = 0;
    while (i < SHOTS.length - 1 && T >= START[i + 1]) i++;
    const s = SHOTS[i], lt = T - START[i];
    if (lt < s.tr) {
      const from = i === 0 ? vec(pose(0), Math.log(2.2), -0.5, -0.1) : drift(i - 1);
      return lerpV(from, settle(i), i === 0 ? smooth(lt / s.tr) : easeIO(lt / s.tr));
    }
    const hold = isFinite(s.dur) ? s.dur - s.tr : 40;
    return lerpV(settle(i), drift(i), 1 - Math.pow(1 - Math.min(1, (lt - s.tr) / hold), 2));
  };
  const KEYT = SHOTS.map((s, i) => START[i] + s.tr + (i === 0 ? 1.2 : 0.3)); // 暫停時停在這個鏡頭到位的地方
  let filmT = 0, auto = false;
  let camV = camAt(0);
  const blend = {k: 1, from: null};

  // ---------- 文字（中、英、注音；換語言時重畫） ----------
  const setPlayIcon = () => {
    const b = $('#iPlay');
    const end = si === SHOTS.length - 1;
    b.innerHTML = end ? REPLAY : playing ? PAUSE : PLAY;
    b.setAttribute('aria-label', L(...(end ? STR.replay : playing ? STR.pause : STR.play)));
  };
  const renderStatic = () => {
    $('.brand .word span').innerHTML = H('剝剝看');
    $('.ikicker').innerHTML = HP(STR.kicker);
    $('#iCopy h1').innerHTML = `<span class="ln">${HP(STR.h1a)}</span><br><span class="ln">${HP(STR.h1b)}</span>`;
    $('.isub').innerHTML = HP(STR.sub);
    for (const b of root.querySelectorAll('[data-go] span')) b.innerHTML = HP(STR.go);
    $('#iSkip').innerHTML = HP(STR.skip);
    $('#iMeter .k').innerHTML = HP(STR.len);
    root.querySelector('.itag[data-k="plane"] b').innerHTML = HP(info.plane.name);
    root.querySelector('.itag[data-k="train"] b').innerHTML = HP(info.train.name);
    progB.forEach((b, i) => b.setAttribute('aria-label', L(...STR.shot(i + 1))));
    setPlayIcon();
  };
  const fillCard = (i) => {
    const s = SHOTS[i];
    $('#fcNo').textContent = '0' + i;
    $('#fcT').innerHTML = HP(s.card[0]);
    $('#fcL').innerHTML = HP(s.card[1]);
  };
  const fillChap = (i) => {
    const s = SHOTS[i];
    $('#chNo').textContent = `0${i} / 0${SHOTS.length - 1}`;
    $('#chT').innerHTML = `<span>${HP(s.chap[0])}</span>`;
    $('#chL').innerHTML = `<span>${HP(s.chap[1])}</span>`;
  };
  let meterId = null;
  const fillMeter = () => {
    if (!meterId) return;
    $('#mWho').innerHTML = `${HP(info[meterId].brand)}・${HP(info[meterId].name)}`;
    $('#mKids').innerHTML = HP(STR.kids(Math.round(LEN[meterId] / KID)));
  };
  const timers = new Set();
  const later = (f, ms) => {
    const t = setTimeout(() => (timers.delete(t), f()), ms);
    timers.add(t);
  };
  const setText = (i) => {
    const s = SHOTS[i];
    copy.classList.toggle('away', i > 1 || (i === 0 && shotT < 2.3));
    card.classList.remove('on');
    if (s.card)
      later(() => {
        if (si !== i) return;
        fillCard(i);
        card.classList.add('on');
      }, RM.matches ? 0 : i === 1 ? 1500 : 800);
    chap.classList.remove('in');
    chap.classList.toggle('off', !s.chap);
    if (s.chap)
      later(() => {
        if (si !== i) return;
        fillChap(i);
        chap.classList.toggle('withcta', !!s.cta);
        void chap.offsetWidth;
        chap.classList.add('in');
      }, RM.matches ? 0 : s.night ? 1100 : 500);
    meter.classList.toggle('off', i < 4 || !!s.night);
    if (i >= 4) {
      const id = i === 4 ? 'bus' : 'train';
      if (num.to !== LEN[id]) {
        num.from = num.v;
        num.to = LEN[id];
        num.t = i === 5 ? -1.8 : 0; // 高鐵：等它掃出來時才開始滾
      }
      if (i === 5) later(() => si === 5 && ((meterId = id), fillMeter()), RM.matches ? 0 : 2900);
      else (meterId = id), fillMeter();
    }
    if (i < 4) (num.v = num.from = num.to = SPEC.length), (num.t = 1);
    progB.forEach((b, k) => (b.classList.toggle('on', k === i), b.classList.toggle('done', k < i)));
    setPlayIcon();
  };
  const go = (i) => {
    i = Math.max(0, Math.min(SHOTS.length - 1, i));
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
    if (!playing) later(() => si === i && i < SHOTS.length - 1 && hint.classList.remove('gone'), 3000);
  };
  // 一次手勢走一段：滾輪、滑動、鍵盤都只走一格，慣性不算
  {
    let lock = 0, acc = 0, ty = null;
    const step = (d) => {
      if (performance.now() < lock) return;
      const j = Math.max(0, Math.min(SHOTS.length - 1, si + d));
      if (j === si) return;
      lock = performance.now() + 900;
      go(j);
    };
    root.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (performance.now() < lock) return void (acc = 0);
      acc += e.deltaY;
      if (Math.abs(acc) > 40) step(Math.sign(acc)), (acc = 0);
    }, {passive: false, signal: ac.signal});
    root.addEventListener('touchstart', (e) => (ty = e.touches[0].clientY), {passive: true, signal: ac.signal});
    root.addEventListener('touchend', (e) => {
      if (ty == null) return;
      const dy = ty - e.changedTouches[0].clientY;
      ty = null;
      if (Math.abs(dy) > 44) step(Math.sign(dy));
    }, {passive: true, signal: ac.signal});
    addEventListener('keydown', (e) => {
      if (e.target.closest?.('input, textarea')) return;
      if (['ArrowDown', 'PageDown', ' '].includes(e.key)) e.preventDefault(), step(1);
      if (['ArrowUp', 'PageUp'].includes(e.key)) e.preventDefault(), step(-1);
    }, sig);
  }
  $('#iProg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) go(+b.dataset.i);
  }, sig);
  $('#iPlay').addEventListener('click', () => {
    if (si === SHOTS.length - 1) {
      playing = true;
      go(0);
    } else playing = !playing;
    setPlayIcon();
    hint.classList.toggle('gone', playing);
  }, sig);
  for (const b of root.querySelectorAll('[data-go], #iSkip')) b.addEventListener('click', () => onDone(), sig);
  // 拖曳：輕輕轉一下視角，放手回到原位附近
  const orbit = {yaw: new Spring(0, 40, 11), pitch: new Spring(0, 40, 11)};
  {
    let down = null;
    canvas.addEventListener('pointerdown', (e) => (down = {x: e.clientX, y: e.clientY, yaw: orbit.yaw.to, pitch: orbit.pitch.to}), sig);
    addEventListener('pointermove', (e) => {
      if (!down) return;
      orbit.yaw.to = down.yaw + (e.clientX - down.x) * 0.004; // 和看車頁一樣：往右拖，車子往右轉
      orbit.pitch.to = Math.max(-0.3, Math.min(0.4, down.pitch + (e.clientY - down.y) * 0.003));
    }, sig);
    addEventListener('pointerup', () => {
      if (!down) return;
      down = null;
      orbit.yaw.to *= 0.35;
      orbit.pitch.to *= 0.35;
    }, sig);
  }
  const sys = bindSys(root, {sig, onLang: () => {
    renderStatic();
    if (SHOTS[si].card && card.classList.contains('on')) fillCard(si);
    if (SHOTS[si].chap && chap.classList.contains('in')) fillChap(si);
    fillMeter();
  }});
  void sys;
  renderStatic();
  setText(0);
  if (!playing) hint.classList.remove('gone');
  // 載入的輪子在介紹外面（#app 底下），淡掉再拿掉
  app.querySelector('#iLoad')?.classList.add('done');
  later(() => app.querySelector('#iLoad')?.remove(), 600);

  // ---------- 每一格 ----------
  const tgt = new THREE.Vector3();
  let copyShown = false, t = 0, bokK = 0, shadowE = null;
  // 太陽視角的座標軸：影子對齊像素格子用
  const LF = LDIR.clone().negate(), LR = new THREE.Vector3().crossVectors(LF, new THREE.Vector3(0, 1, 0)).normalize(), LU = new THREE.Vector3().crossVectors(LR, LF);
  const frame = (dt) => {
    t += dt;
    // 時間軸：自動播放一直往前走；暫停時只走到這個鏡頭到位為止。走過下一段的開頭就換段（進度條跟著長）
    if (playing) filmT += dt;
    else if (filmT < KEYT[si]) filmT = Math.min(KEYT[si], filmT + dt);
    if (si < SHOTS.length - 1 && filmT >= START[si + 1]) {
      auto = true;
      go(si + 1);
      auto = false;
    }
    shotT = filmT - START[si];
    const cur = progB[si]?.querySelector('i');
    if (cur) cur.style.setProperty('--p', isFinite(SHOTS[si].dur) ? clamp01(shotT / SHOTS[si].dur) : 1);
    if (si === 0) {
      if (!copyShown && shotT > 2.3) (copyShown = true), copy.classList.remove('away');
      if (shotT < 0.05) copy.classList.add('away');
    } else copyShown = false;
    // 每一台：還沒輪到就藏著；輪到了點先聚攏、再一道光從車頭掃到車尾；之後就是實體
    for (const id in V) {
      const A = APPEAR[id], o = V[id];
      const lt = filmT - START[A.shot];
      const minX = boxes[id].min.x, x0 = boxes[id].max.x + 0.25;
      let sc = 0, sw = minX - 1;
      if (si < A.shot || lt < 0) (sc = 1), (sw = x0);
      else if (!RM.matches) {
        sc = 1 - ease((lt - A.gather[0]) / A.gather[1]);
        sw = THREE.MathUtils.lerp(x0, minX - 0.2, smooth((lt - A.sweep[0]) / A.sweep[1]));
      }
      const before = si < A.shot;
      o.PU.uScatter.value = sc;
      o.PU.uSweep.value = sw;
      o.pts.visible = !before && sw > minX - 0.1;
      o.plane.constant = -sw;
      const show = !before && sw < x0 - 0.05;
      if (show !== o.shown) {
        o.shown = show;
        for (const m of o.meshes) m.visible = show;
      }
    }
    const carSw = V.car.PU.uSweep.value;
    sweepG.visible = si === 0 && carSw < boxes.car.max.x + 0.2 && carSw > boxes.car.min.x - 0.15;
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
    // 天黑：背景、地面、太陽變月光、環境光變暗；燈一台一台亮起來（晚上才有光暈）
    const n = smooth(nightS.step(dt));
    if (pendingTheme && (pendingTheme === 'dark' ? n > 0.5 : n < 0.5)) {
      setThemeAttr(pendingTheme);
      pendingTheme = null;
    }
    scene.background.copy(DAY.bg).lerp(NIGHT.bg, n);
    groundMat.uniforms.uG.value.copy(DAY.ground).lerp(NIGHT.ground, n);
    groundMat.uniforms.uBg.value.copy(scene.background);
    shadeMat.color.copy(DAY.shadow).lerp(NIGHT.shadow, n);
    shadeMat.opacity = 0.22 * (1 - 0.65 * n) + 0.2 * n;
    sun.intensity = 2.2 + (0.32 - 2.2) * n;
    sun.color.copy(NIGHT.white).lerp(NIGHT.moon, n);
    hemi.intensity = 0.55 + (0.07 - 0.55) * n;
    scene.environmentIntensity = 0.75 + (0.09 - 0.75) * n;
    rim.intensity = 1.2 * (1 - n);
    bloom.enabled = n > 0.01;
    bloom.strength = 0.9 * n;
    bloom.threshold = 4.5 + (1.0 - 4.5) * n;
    const ORDER_ON = ['car', 'bus', 'train', 'plane'];
    const nightT = SHOTS[si].night ? shotT : -1;
    const want = (veh, group) => (nightT < 0 || !NIGHT_ON[veh]?.includes(group) ? 0 : nightT > 0.9 + ORDER_ON.indexOf(veh) * 0.4 + NIGHT_ON[veh].indexOf(group) * 0.14 ? 1 : 0);
    for (const Lm of lamps) {
      const w = want(Lm.veh, Lm.group) * PATTERN[Lm.mode](t);
      Lm.lv += (w - Lm.lv) * (1 - Math.exp(-dt * (Lm.mode === 'steady' ? 6 : 40)));
      Lm.mat.emissiveIntensity = Lm.lamp.off + (Lm.lamp.on - Lm.lamp.off) * Lm.lv;
    }
    for (const Lm of lightsSrc) {
      const w = want(Lm.veh, Lm.group) * PATTERN[Lm.mode](t);
      Lm.lv += (w - Lm.lv) * (1 - Math.exp(-dt * 6));
      Lm.light.intensity = Lm.base * Lm.lv;
    }
    // 鏡頭（不加手持晃動、不加一直在飄的轉動：快慢交給時間軸）
    let cv = camAt(filmT);
    if (blend.k < 1) {
      blend.k = RM.matches ? 1 : Math.min(1, blend.k + dt / 1.6);
      const e = easeIO(blend.k);
      cv = cv.map((x, k) => blend.from[k] + (x - blend.from[k]) * e);
    }
    camV = cv;
    orbit.yaw.step(dt);
    orbit.pitch.step(dt);
    const dist = Math.exp(cv[3]);
    const az = cv[4] + orbit.yaw.x;
    const el = cv[5] + orbit.pitch.x * 0.5;
    tgt.set(cv[0], cv[1], cv[2]);
    camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z - Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(tgt);
    camera.near = Math.max(0.05, dist * 0.02);
    camera.far = dist * 8;
    camera.updateProjectionMatrix();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const wide = si === 4;
    if (portrait()) camera.setViewOffset(w, h, 0, wide ? -h * 0.01 : si >= 5 ? h * 0.02 : h * 0.12, w, h);
    else if (si >= 5) camera.setViewOffset(w, h, 0, h * 0.1, w, h);
    else camera.setViewOffset(w, h, wide ? 0 : -w * 0.14, wide ? h * 0.17 : si >= 2 ? h * 0.12 : h * 0.04, w, h);
    // 影子：範圍每個鏡頭固定（換鏡頭的途中用前後兩個比較大的那個），中心對齊影子的像素格子；
    // 範圍和位置每格連續改變的話，影子的像素格子每格都在挪，地上的影子會一直閃
    {
      const Ei = (i) => Math.max(6, Math.exp(settle(i)[3]) * 0.45);
      const inTr = shotT < SHOTS[si].tr;
      const E = Math.ceil((inTr && si > 0 ? Math.max(Ei(si), Ei(si - 1)) : Ei(si)) / 2) * 2;
      if (E !== shadowE) {
        shadowE = E;
        Object.assign(sun.shadow.camera, {left: -E, right: E, top: E, bottom: -E, near: 0.5, far: E * 8});
        sun.shadow.camera.updateProjectionMatrix();
        sun.shadow.bias = -0.0004 * Math.max(1, E / 8);
      }
      const texel = (2 * E) / sun.shadow.mapSize.x;
      const a = Math.round(tgt.dot(LR) / texel) * texel, b2 = Math.round(tgt.dot(LU) / texel) * texel, c = tgt.dot(LF);
      sun.target.position.set(0, 0, 0).addScaledVector(LR, a).addScaledVector(LU, b2).addScaledVector(LF, c);
      sun.position.copy(sun.target.position).addScaledVector(LDIR, E * 2.4);
    }
    groundMat.uniforms.uC.value.set(tgt.x, tgt.z);
    groundMat.uniforms.uR.value.set(dist * 0.35, dist * 1.3);
    const ra = t * 0.15;
    rim.position.set(tgt.x + Math.cos(ra) * 20, tgt.y + 8, tgt.z + 20 + Math.sin(ra) * 6);
    rim.target.position.copy(tgt);
    // 景深：焦點在鏡頭看的地方；點還散著時整團失焦，聚好就對焦清楚
    const fd = camera.position.distanceTo(tgt);
    // 最後兩個鏡頭：焦點對在最前面的 Model Y 和公車車頭，越往後越糊（高鐵後段、飛機）
    let fdB = fd, nearD = 0, farD = 0;
    if (si >= 5) {
      nearD = camera.position.distanceTo(FRONT);
      farD = camera.position.distanceTo(PLANE_NOSE);
      fdB = (nearD + farD) / 2;
    }
    bokeh.uniforms.focus.value = fdB;
    for (const id in V) {
      const PU = V[id].PU;
      PU.uFocus.value = fd * (1 + PU.uScatter.value * 1.2);
      PU.uAperture.value = 0.3 + 1.1 * PU.uScatter.value;
    }
    // 一般：離焦點 ±70% 的距離才糊到上限。最後兩鏡：焦點在前面的車和飛機機頭中間，這一段幾乎不糊（邊上最多 0.0012），再往後才慢慢糊
    bokeh.uniforms.aperture.value = si >= 5 ? 0.0012 / Math.max(4, (farD - nearD) / 2) : (0.0093 / dist) * (wide ? 0.6 : 1);
    bokeh.uniforms.maxblur.value = si >= 5 ? 0.012 : 0.0065;
    // 點沒有寫進深度，後製的景深會把它們當成背景一起糊掉：有點在聚的時候先關掉後製的；第 5 個鏡頭是遠景，也關掉省效能
    const anyPts = Object.values(V).some((o) => o.pts.visible);
    bokK += ((!anyPts && !wide ? 1 : 0) - bokK) * (1 - Math.exp(-dt * 2.5));
    bokeh.enabled = bokK > 0.02;
    bokeh.uniforms.maxblur.value *= bokK;
    composer.render(dt);
    // 第 6 個鏡頭：飛機、高鐵的名字
    for (const el2 of root.querySelectorAll('.itag')) {
      const key = el2.dataset.k;
      const on = si === 5 && !portrait() && V[key].shown && V[key].PU.uSweep.value < boxes[key].min.x;
      el2.classList.toggle('on', on);
      if (!on) continue;
      const p = key === 'plane' ? new THREE.Vector3(OFFX.plane - LEN.plane * 0.45, 19, LANES.plane) : new THREE.Vector3(-32, 4.8, LANES.train);
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
  };
  let raf = 0, last = performance.now();
  const tick = (now) => {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  // 切到別的分頁：時間不要一直往前跑
  addEventListener('visibilitychange', () => (last = performance.now()), sig);

  return {
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      ac.abort();
      themeObs.disconnect();
      ro.disconnect();
      for (const t2 of timers) clearTimeout(t2);
      // 離開時頁面換回使用者自己存的日夜
      applyThemeAttr();
      bokeh.dispose?.();
      bloom.dispose?.();
      composer.dispose?.();
      releaseGL();
      app.innerHTML = '';
    },
  };
}
