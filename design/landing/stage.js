// 介紹頁樣稿共用的底座：載入網站裡真的車、寫實的場景（和展廳同一套光）、彈簧、一次手勢走一段的分頁。
import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import bus from '../../bus/vehicle.js';
import plane from '../../plane/vehicle.js';
import car from '../../car/vehicle.js';
import train from '../../train/vehicle.js';

export {THREE};
export const VEH = {bus, plane, car, train};
export const ORDER = ['bus', 'plane', 'car', 'train'];
export const INFO = {
  bus: {no: '01', brand: '台北客運', name: '低地板公車', en: 'Low-floor bus', len: 12.2},
  plane: {no: '02', brand: '星宇航空', name: 'A350-1000', en: 'A350-1000', len: 73.79},
  car: {no: '03', brand: '特斯拉', name: 'Model Y', en: 'Model Y', len: 4.79},
  train: {no: '04', brand: '台灣高鐵', name: '700T', en: '700T', len: 304},
};
for (const id of ORDER) INFO[id].parts = Object.keys(VEH[id].PARTS).length;
export const RM = matchMedia('(prefers-reduced-motion: reduce)');
export const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
export const isDark = () => document.documentElement.dataset.theme === 'dark';
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => (x = clamp01(x)) * x * (3 - 2 * x);
export const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
export const isPhone = () => innerWidth < 700;

/** 下載、建好一台車；零件記住原本的位置和在第幾層。 */
export async function loadVehicle(id) {
  const V = VEH[id];
  await V.preload?.();
  const model = V.build();
  const layerOf = {};
  V.LAYERS.forEach((L, i) => L.ids.forEach((pid) => (layerOf[pid] = i + 1)));
  const variant = V.variants?.[0]?.id;
  const present = (pid) => (V.present ? V.present(pid, variant) : true);
  for (const p of model.pieces) {
    p.base = p.obj.position.clone();
    p.baseRot = p.obj.rotation.clone();
    if (!present(p.id)) p.obj.visible = false;
  }
  model.root.updateMatrixWorld(true);
  return {id, V, model, layerOf, present};
}

/** 寫實的場景：和網站同一套色調、環境光、太陽和接觸陰影。 */
export function makeStage(canvas, {fov = 30, near = 0.1, far = 400, shadows = true, ext = 9, alpha = false} = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, alpha, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(fov, 1, near, far);
  const pm = new THREE.PMREMGenerator(renderer);
  const envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  pm.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.75;
  const sun = new THREE.DirectionalLight('#fffaf0', 2.2);
  sun.position.set(6, 14, -8);
  sun.castShadow = shadows;
  Object.assign(sun.shadow.camera, {left: -ext, right: ext, top: ext, bottom: -ext, near: 1, far: 80});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  const hemi = new THREE.HemisphereLight('#ffffff', '#b9b2a6', 0.55);
  scene.add(sun, sun.target, hemi);
  const shadeMat = new THREE.ShadowMaterial({opacity: 0.2});
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), shadeMat);
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.001;
  shade.receiveShadow = true;
  scene.add(shade);
  const bg = new THREE.Color();
  const paint = () => {
    bg.set(css('--bg'));
    scene.background = alpha ? null : bg;
    const d = isDark();
    shadeMat.opacity = d ? 0.5 : 0.2;
    scene.environmentIntensity = d ? 0.5 : 0.75;
    hemi.intensity = d ? 0.3 : 0.55;
    sun.intensity = d ? 1.7 : 2.2;
  };
  paint();
  const size = new THREE.Vector2();
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    size.set(w, h);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const dispose = () => {
    ro.disconnect();
    scene.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) {
        for (const k in m) if (m[k]?.isTexture) m[k].dispose();
        m.dispose?.();
      }
    });
    envTex.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  };
  return {renderer, scene, camera, sun, hemi, shade, shadeMat, paint, resize, size, dispose};
}

/** 每格呼叫 fn(dt, t)；回傳停止的函式。 */
export function loop(fn) {
  let id = 0, last = performance.now(), t = 0, on = true;
  const tick = (now) => {
    if (!on) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    fn(dt, t);
    id = requestAnimationFrame(tick);
  };
  id = requestAnimationFrame(tick);
  return () => ((on = false), cancelAnimationFrame(id));
}

/** 彈簧：可以被打斷，從當下的位置和速度接著動。 */
export class Spring {
  constructor(x = 0, k = 90, c = 16) {
    this.x = x;
    this.v = 0;
    this.to = x;
    this.k = k;
    this.c = c;
  }
  step(dt) {
    if (RM.matches) return (this.x = this.to), (this.v = 0), this.x;
    const n = Math.ceil(dt / 0.008);
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      this.v += (this.k * (this.to - this.x) - this.c * this.v) * h;
      this.x += this.v * h;
    }
    return this.x;
  }
}

/** 一次手勢走一段：滾輪、滑動、鍵盤都只走一格，慣性不算。 */
export function pager(el, {n, onGo, sig}) {
  let i = 0, lock = 0, acc = 0, ty = null;
  const go = (j) => {
    j = Math.max(0, Math.min(n - 1, j));
    if (j === i) return;
    i = j;
    lock = performance.now() + 900;
    onGo(i);
  };
  el.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (performance.now() < lock) return (acc = 0);
    acc += e.deltaY;
    if (Math.abs(acc) > 40) go(i + Math.sign(acc)), (acc = 0);
  }, {passive: false, signal: sig});
  el.addEventListener('touchstart', (e) => (ty = e.touches[0].clientY), {passive: true, signal: sig});
  el.addEventListener('touchend', (e) => {
    if (ty == null) return;
    const dy = ty - e.changedTouches[0].clientY;
    ty = null;
    if (Math.abs(dy) > 44 && performance.now() > lock) go(i + Math.sign(dy));
  }, {passive: true, signal: sig});
  addEventListener('keydown', (e) => {
    if (['ArrowDown', 'PageDown', ' '].includes(e.key)) e.preventDefault(), go(i + 1);
    if (['ArrowUp', 'PageUp'].includes(e.key)) e.preventDefault(), go(i - 1);
  }, {signal: sig});
  return {go, set: (j) => (i = j), get i() { return i; }};
}

/** 拖曳轉視角（單指／滑鼠）：回傳目前的偏移，放手用彈簧回到原位附近。 */
export function dragOrbit(el, {sig, back = true} = {}) {
  const yaw = new Spring(0, 40, 11), pitch = new Spring(0, 40, 11);
  let down = null, moved = false;
  el.addEventListener('pointerdown', (e) => {
    down = {x: e.clientX, y: e.clientY, yaw: yaw.to, pitch: pitch.to};
    moved = false;
  }, {signal: sig});
  addEventListener('pointermove', (e) => {
    if (!down) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (Math.hypot(dx, dy) > 4) moved = true;
    yaw.to = down.yaw - dx * 0.006;
    pitch.to = Math.max(-0.35, Math.min(0.5, down.pitch + dy * 0.004));
  }, {signal: sig});
  addEventListener('pointerup', () => {
    if (!down) return;
    down = null;
    if (back) (yaw.to *= 0.35), (pitch.to *= 0.35);
  }, {signal: sig});
  return {yaw, pitch, step: (dt) => (yaw.step(dt), pitch.step(dt)), get dragging() { return !!down; }, get moved() { return moved; }};
}

/** 數字從現在的值滾到新值。 */
export function rollNumber(el, to, {dur = 900, dec = 0, from} = {}) {
  const a = from ?? parseFloat(el.dataset.v || '0');
  el.dataset.v = to;
  if (RM.matches) return void (el.textContent = to.toFixed(dec));
  const t0 = performance.now();
  const f = (now) => {
    const k = ease((now - t0) / dur);
    el.textContent = (a + (to - a) * k).toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec});
    if (k < 1) requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}

/** 3D 座標 → 螢幕座標（px）。 */
const _v = new THREE.Vector3();
export function toScreen(p, camera, el) {
  _v.copy(p).project(camera);
  return {x: (_v.x * 0.5 + 0.5) * el.clientWidth, y: (-_v.y * 0.5 + 0.5) * el.clientHeight, behind: _v.z > 1};
}

const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
/** 首屏的字：五個樣稿用同一套，比較的是畫面。 */
export function heroCopy({cls = ''} = {}) {
  return `<div class="copy ${cls}">
      <p class="kicker rise">Peelback · 剝剝看</p>
      <h1 class="rise" style="animation-delay:.1s">把真的車，<br>一層一層剝開</h1>
      <p class="sub rise" style="animation-delay:.2s">公車、飛機、汽車、高鐵，照實車的尺寸和零件做成 3D。點一下拆開，看看裡面有什麼。</p>
      <a class="cta rise" style="animation-delay:.3s" href="https://peelback.aronlab.dev/" target="_blank" rel="noopener">進展廳 ${ARROW}</a>
    </div>`;
}
export const HINT = '<div class="hintdown gone"><div class="ring"><svg viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></svg></div><div class="flow"></div></div>';

/** 把一台車的材質照層數複製一份（同一個材質可能被不同層共用），回傳 {layer: [meshes]}。 */
export function splitByLayer(veh) {
  const out = {};
  const cache = new Map();
  veh.model.root.traverse((m) => {
    if (!m.isMesh) return;
    const L = veh.layerOf[m.userData.part];
    if (!L) return;
    (out[L] ||= []).push(m);
    const one = (mat) => {
      const k = mat.uuid + '|' + L;
      if (!cache.has(k)) cache.set(k, mat.clone());
      return cache.get(k);
    };
    m.material = Array.isArray(m.material) ? m.material.map(one) : one(m.material);
  });
  return out;
}
