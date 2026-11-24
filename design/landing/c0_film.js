// 電影版：粒子 → 掃描成形 → 凍結爆炸 → 真實比例 → 天黑亮燈，接成一部自動播放的片。
// 同一個 3D 場景、同一台攝影機，鏡頭之間不剪接；也可以自己往下滑跳到下一個鏡頭（自動播放接著從那裡走）。
//   1 一團失焦的點慢慢聚成 Model Y，一道光從車頭掃到車尾，掃過的地方變成實體的車（首屏）
//   2 Model Y 在半空中慢動作炸開 → 3 鏡頭穿進零件之間看座椅 → 4 繞到車底看電池
//   5 零件合回整台、鏡頭往後拉，115 公分的小朋友和公車出現 → 6 拉到最遠，四台照真實比例排開
//   7 天黑了，四台的燈一盞一盞亮起來（燈和閃的節奏都是網站裡同一組），停在「進展廳」
import {THREE, loadVehicle, makeStage, Spring, pager, loop, isDark, RM, toScreen, smooth, ease, heroCopy, HINT, INFO, dragOrbit, css, isPhone, clamp01} from './stage.js';
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
// 每個鏡頭：多久（自動播放）、焦點零件或要框住的車、方向、距離、名牌、字幕
const SHOTS = [
  {dur: 9, form: true, focus: null, dir: [0.78, 0.3, -0.75], dist: 0.75},
  {dur: 6.5, focus: null, dir: [0.75, 0.42, -0.85], dist: 1, card: ['Model Y', `${SPEC.length} 公尺・${Object.keys(PARTS).length} 個零件`]},
  {dur: 5.5, focus: 'seats', dir: [0.3, 0.5, -0.92], dist: 0.42, card: [PARTS.seats.name, `${SPEC.seats} 個座位：前面兩個、後面三個`],
    chap: ['一層一層拆開', '外殼、座椅、底盤、電池，每一層都可以單獨拿出來看。']},
  {dur: 5.5, focus: 'battery', dir: [0.55, -0.3, -0.95], dist: 0.4, card: [PARTS.battery.name, `大約 ${SPEC.battery} 度電，可以把 5000 支手機充飽`],
    chap: ['每個零件都有名字', '點一下零件，名牌就跳出來，還會念給你聽。中文、英文、注音都有。']},
  {dur: 6.5, fit: ['car', 'bus'], az: 0.68, el: 0.26,
    chap: ['照真的大小做', '旁邊站一個 115 公分的小朋友。公車 12.2 公尺，差不多 11 個小朋友躺成一排。']},
  {dur: 6.5, fit: ['car', 'bus', 'plane', 'train'], az: 0.62, el: 0.5,
    chap: ['四台車，四種大小', '最長的高鐵 304 公尺，12 節車廂一節一節都拆得開。']},
  {dur: Infinity, at: [-17, 3.2, 12], d: 52, az: 1.16, el: 0.13, night: true,
    chap: ['天黑了，燈亮起來', '車頭燈、尾燈、高鐵整排的窗、飛機翅膀上一閃一閃的燈，每一組都可以自己打開。'], cta: true},
];
const LANES = {car: 0, bus: 4.2, train: 8.8, plane: 46};
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
const NIGHT = {bg: new THREE.Color('#0a0f1c'), moon: new THREE.Color('#9db2ff'), white: new THREE.Color('#fffaf0')};

const PVERT = `
attribute vec4 aRnd;
uniform float uScatter; uniform float uSweep; uniform float uTime; uniform float uFocus; uniform float uAperture; uniform float uSize; uniform float uPR; uniform vec3 uCenter;
varying float vA; varying float vSoft; varying float vHi;
void main(){
  vec3 p = position;
  vec3 sc = uCenter + normalize(aRnd.xyz - 0.5 + 1e-4) * (3.0 + aRnd.w * 10.0) + vec3(0.0, 1.0, 0.0);
  float t = clamp(uScatter * 1.6 - aRnd.x * 0.6, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  p = mix(p, sc, t);
  p += 0.006 * vec3(sin(uTime * 1.3 + aRnd.w * 40.0), sin(uTime * 1.1 + aRnd.y * 30.0), cos(uTime * 1.2 + aRnd.z * 20.0));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float c = clamp(abs(dist - uFocus) / dist * uAperture, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (1.0 + c * 9.0) * (16.0 / dist) * (0.75 + aRnd.w * 0.5);
  // 掃過去的地方換成實體的車：點淡掉；光正前方的一小段點變成主色
  float gone = smoothstep(uSweep - 0.12, uSweep + 0.02, position.x);
  vA = (1.0 - gone) / (1.0 + c * c * 60.0);
  vSoft = c;
  vHi = (1.0 - smoothstep(0.0, 0.45, uSweep - position.x)) * step(position.x, uSweep) * step(uSweep, 0.2);
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

export default async function run(stage, ctx) {
  const car = await loadVehicle('car');
  if (!ctx.alive()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 32, near: 0.05, far: 4000, ext: 8});
  const {scene, camera, renderer, sun, hemi} = st;
  st.shade.geometry.dispose();
  st.shade.geometry = new THREE.PlaneGeometry(3000, 3000);
  const rim = new THREE.DirectionalLight('#eef2ff', 1.2); // 逆光：從後面慢慢繞著掃過去
  scene.add(rim, rim.target);

  // ---------- 燈：每台車的燈材質和光源（和網站同一套標記） ----------
  const lamps = []; // {veh, group, mat, lamp}
  const lightsSrc = []; // {veh, group, light, base}
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

  // ---------- 放一台車：照實車尺寸、車頭對齊 x = 0 ----------
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
    return new THREE.Box3().setFromObject(root);
  };
  const boxes = {car: place(car, 'car')};
  const {model, layerOf} = car;
  const C = boxes.car.getCenter(new THREE.Vector3());

  // ---------- 開場的點：從 Model Y 每一塊的表面取樣 ----------
  const meshes = [];
  model.root.traverse((o) => o.isMesh && o.visible && layerOf[o.userData.part] && meshes.push(o));
  const NP = isPhone() ? 32000 : 64000;
  const pPos = new Float32Array(NP * 3);
  {
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
      // 外殼的面積大，裡面的零件少一點點，但還是要看得到
      const L = layerOf[m.userData.part];
      const a = s.distribution[s.distribution.length - 1] * Math.pow(Math.abs(m.matrixWorld.determinant()), 2 / 3) * (m.isInstancedMesh ? m.count : 1) * (L === 1 ? 1 : 1.6);
      if (!(a > 0)) continue;
      list.push({m, s, cum: (acc += a)});
    }
    const p = new THREE.Vector3(), m4 = new THREE.Matrix4();
    for (let j = 0; j < NP; j++) {
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
      p.applyMatrix4(e.m.matrixWorld).toArray(pPos, j * 3);
    }
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('aRnd', new THREE.BufferAttribute(new Float32Array(NP * 4).map(() => Math.random()), 4));
  pGeo.boundingSphere = new THREE.Sphere(C, 30);
  const PU = {uScatter: {value: 1}, uSweep: {value: 0.3}, uTime: {value: 0}, uFocus: {value: 8}, uAperture: {value: 1.4}, uSize: {value: isPhone() ? 1.5 : 1.3}, uPR: {value: renderer.getPixelRatio()}, uCenter: {value: C}, uInk: {value: new THREE.Color()}, uAcc: {value: new THREE.Color()}, uAlpha: {value: 0.6}};
  const pMat = new THREE.ShaderMaterial({uniforms: PU, vertexShader: PVERT, fragmentShader: PFRAG, transparent: true, depthWrite: false});
  const points = new THREE.Points(pGeo, pMat);
  points.renderOrder = 2;
  scene.add(points);

  // 實體的車：掃到的地方才出現（x ≥ 掃描線）
  const carClip = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.3);
  {
    const done = new Set();
    for (const m of meshes) for (const mat of [].concat(m.material)) if (!done.has(mat)) done.add(mat), (mat.clippingPlanes = [carClip]), (mat.clipShadows = true);
  }
  // 掃描線：很淡的主色面＋細線框
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

  // ---------- Model Y 炸開：每一塊各自一個轉軸 ----------
  const frags = [];
  const MAG = [0, 1.55, 0.95, 0.6, 0.25];
  const ROT = [0, 0.55, 0.4, 0.28, 0.14];
  const partC = {};
  const wc = new THREE.Vector3(), bb = new THREE.Box3();
  for (const m of meshes) {
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
    d.y = d.y * 0.6 + 0.25;
    const offW = d.normalize().multiplyScalar(MAG[L] * (0.75 + Math.random() * 0.6));
    offW.y += 0.8;
    const wT = wc.clone().add(offW);
    frags.push({g, p0: g.position.clone(), p1: parent.worldToLocal(wT.clone()), q1: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3().randomDirection(), ROT[L] * (Math.random() - 0.5) * 2), axis: new THREE.Vector3().randomDirection(), ph: Math.random() * 6.28, delay: (4 - L) * 0.05 + Math.random() * 0.06});
    const pc = (partC[m.userData.part] ||= {s: new THREE.Vector3(), n: 0});
    pc.s.add(wT);
    pc.n++;
  }
  const centerOf = (id) => (id && partC[id] ? partC[id].s.clone().divideScalar(partC[id].n) : C.clone().add(new THREE.Vector3(0, 0.9, 0)));

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

  // ---------- 其他三台：背景慢慢下載，第 5、6 個鏡頭才沿著尺「畫」出來 ----------
  const others = {};
  const loadOthers = (async () => {
    for (const id of ['bus', 'plane', 'train']) {
      const v = await loadVehicle(id);
      if (!ctx.alive()) return;
      const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -0.01);
      boxes[id] = place(v, id);
      const done = new Set();
      v.model.root.traverse((o) => {
        if (!o.isMesh) return;
        for (const m of [].concat(o.material)) {
          if (done.has(m)) continue;
          done.add(m);
          m.clippingPlanes = [plane];
          m.clipShadows = true;
        }
      });
      v.model.root.visible = false;
      others[id] = {root: v.model.root, plane, len: INFO[id].len, grow: new Spring(0, 10, 6.3)};
      await new Promise((r) => setTimeout(r, 50));
    }
  })();

  // ---------- 後製：燈的光暈（只有晚上）、景深 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0, 0.5, 4.5);
  bloom.enabled = false;
  composer.addPass(bloom);
  const bokeh = new BokehPass(scene, camera, {focus: 10, aperture: 0.005, maxblur: 0.013});
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const resize = () => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(canvas.clientWidth, canvas.clientHeight);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const dayBg = new THREE.Color();
  let nightDriven = false; // 第 7 個鏡頭把頁面換成深色（離開時換回原本的）
  let themeBefore = null;
  const paint = () => {
    if (!nightDriven) st.paint();
    dayBg.copy(scene.background);
    const d = isDark();
    kidMat.color.set(d ? '#7d98ff' : '#2f5bea');
    accC.set(d ? '#7d98ff' : '#2f5bea');
    PU.uInk.value.set(d ? '#edede8' : '#1a1b1d');
    PU.uAcc.value.set(d ? '#7d98ff' : '#2f5bea');
    PU.uAlpha.value = d ? 0.5 : 0.36;
    pMat.blending = d ? THREE.AdditiveBlending : THREE.NormalBlending;
    pMat.needsUpdate = true;
  };
  paint();
  ctx.onTheme(() => {
    if (nightDriven) themeBefore = null; // 自己按了日夜：離開晚上時不再換回去
    paint();
  });

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy()}
    <div class="chap off" id="chap"><em id="chNo"></em><h2 id="chT"></h2><p id="chL"></p><a class="cta" id="chCta" href="https://peelback.aronlab.dev/" target="_blank" rel="noopener">進展廳 ${ARROW}</a></div>
    <div class="fcard" id="fcard"><i class="dot"></i><i class="lead"></i><div class="in"><em id="fcNo">01</em><b id="fcT"></b><span id="fcL"></span></div></div>
    <div class="meter off" id="meter"><span class="k">真實長度</span><div class="big"><b id="mNum">4.79</b><small>m</small></div><span class="who" id="mWho"></span><span class="kids" id="mKids"></span></div>
    <div class="tags" id="ftags"><div class="tag vtag" data-k="near"><em>No.01・03</em><b>公車・Model Y・小朋友</b></div><div class="tag vtag" data-k="plane"><em>No.02</em><b>A350-1000</b></div><div class="tag vtag" data-k="train"><em>No.04</em><b>700T</b></div></div>
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
  const tau = new Spring(0, 9, 5.2); // 炸開的進度（慢動作）
  const nightS = new Spring(0, 6, 4.9);
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
    if (s.at) return {c: new THREE.Vector3(...s.at), d: s.d * Math.max(1, 1.3 / camera.aspect), az: s.az, el: s.el};
    const dir = new THREE.Vector3(...s.dir).normalize();
    const base = 18 * Math.max(1, (portrait() ? 0.95 : 1.4) / camera.aspect);
    return {c: centerOf(s.focus), d: base * s.dist, az: Math.atan2(dir.x, -dir.z), el: Math.asin(dir.y)};
  };
  const P0 = pose(0);
  // 開場的鏡頭：從更遠、更低的地方慢慢推進來
  const cam = {x: new Spring(C.x, 3, 3.4), y: new Spring(C.y + 0.6, 3, 3.4), z: new Spring(C.z, 3, 3.4), ld: new Spring(Math.log(P0.d * 2.2), 3, 3.4), az: new Spring(P0.az - 0.5, 3, 3.4), el: new Spring(P0.el - 0.1, 3, 3.4)};
  const camK = (soft) => {
    for (const k in cam) (cam[k].k = soft ? 3 : 8), (cam[k].c = soft ? 3.4 : 5.6);
  };

  const setPlayIcon = () => {
    const b = $('#play');
    b.innerHTML = si === SHOTS.length - 1 ? REPLAY : playing ? PAUSE : PLAY;
    b.setAttribute('aria-label', si === SHOTS.length - 1 ? '重播' : playing ? '暫停' : '播放');
  };
  const setNight = (on) => {
    nightS.to = on ? 1 : 0;
    const de = document.documentElement;
    if (on && !nightDriven) {
      nightDriven = true;
      dayBg.copy(scene.background);
      themeBefore = de.dataset.theme;
      if (themeBefore !== 'dark') de.dataset.theme = 'dark';
    } else if (!on && nightDriven) {
      nightDriven = false;
      if (themeBefore && themeBefore !== 'dark') de.dataset.theme = themeBefore;
      themeBefore = null;
    }
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
      }, RM.matches ? 0 : 1100);
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
      }, RM.matches ? 0 : 700);
    meter.classList.toggle('off', i < 4 || !!s.night);
    if (i >= 4) {
      const id = i === 4 ? 'bus' : 'train';
      if (num.to !== INFO[id].len) {
        num.from = num.v;
        num.to = INFO[id].len;
        num.t = 0;
      }
      $('#mWho').textContent = `${INFO[id].brand}・${INFO[id].name}`;
      $('#mKids').textContent = `差不多 ${Math.round(INFO[id].len / KID)} 個小朋友躺成一排`;
    }
    if (i < 4) (num.v = num.from = num.to = SPEC.length), (num.t = 1);
    progB.forEach((b, k) => (b.classList.toggle('on', k === i), b.classList.toggle('done', k < i)));
    setPlayIcon();
  };
  const go = async (i) => {
    const from = si;
    si = i;
    shotT = 0;
    camK(i === 0);
    hint.classList.add('gone');
    tau.to = i >= 1 && i <= 3 ? 1 : 0;
    kidS.to = i >= 4 ? 1 : 0;
    // 從後面跳回開場：點重新散開
    if (i === 0 && from !== 0) {
      PU.uScatter.value = 1;
      cam.ld.x = Math.log(P0.d * 2.2);
    }
    setNight(!!SHOTS[i].night);
    setText(i);
    if (i >= 4) await loadOthers;
    if (si !== i || !ctx.alive()) return;
    for (const id in others) others[id].grow.to = (id === 'bus' && i >= 4) || i >= 5 ? 1 : 0;
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
  const q = new THREE.Quaternion(), qI = new THREE.Quaternion(), qd = new THREE.Quaternion();
  const tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  const stage0 = {copyShown: false};
  // 測試用：網址加 ?speed=4 快轉（預覽視窗一秒只有幾格時才看得完一遍）
  const SPEED = +new URLSearchParams(location.search).get('speed') || 1;
  let t = 0;
  const stop = loop((dt0) => {
    const dt = dt0 * SPEED;
    t += dt;
    // 自動播放：這個鏡頭演完就走下一個；進度條跟著長
    if (playing && shotT + dt > SHOTS[si].dur && si < SHOTS.length - 1) pg.go(si + 1);
    shotT += dt;
    const cur = progB[si]?.querySelector('i');
    if (cur) cur.style.setProperty('--p', isFinite(SHOTS[si].dur) ? clamp01(shotT / SHOTS[si].dur) : 1);
    // 開場：點聚起來（焦點同時拉近），然後一道光從車頭掃到車尾
    let sweep = -99;
    if (si === 0) {
      const sc = RM.matches ? 0 : 1 - ease((shotT - 0.3) / 3.6);
      PU.uScatter.value = Math.min(PU.uScatter.value, sc);
      sweep = RM.matches ? -6 : THREE.MathUtils.lerp(0.25, boxes.car.min.x - 0.2, smooth((shotT - 4.4) / 2.6));
      if (!stage0.copyShown && shotT > 3.2) (stage0.copyShown = true), copy.classList.remove('away');
    } else stage0.copyShown = false;
    if (si === 0 && shotT < 0.05) copy.classList.add('away');
    PU.uSweep.value = sweep;
    PU.uTime.value = t;
    points.visible = si === 0 && sweep > boxes.car.min.x - 0.1;
    carClip.constant = -sweep;
    sweepG.visible = si === 0 && sweep < 0.2 && sweep > boxes.car.min.x - 0.15;
    sweepG.position.x = sweep;
    // 零件
    const k = tau.step(dt);
    for (const f of frags) {
      const e = ease(Math.max(0, (k - f.delay) / (1 - f.delay)));
      const drift = RM.matches ? 0 : e * 0.06;
      f.g.position.lerpVectors(f.p0, f.p1, e);
      f.g.position.y += Math.sin(t * 0.35 + f.ph) * drift * 0.25;
      q.slerpQuaternions(qI, f.q1, e);
      qd.setFromAxisAngle(f.axis, Math.sin(t * 0.21 + f.ph) * drift);
      f.g.quaternion.copy(q).multiply(qd);
    }
    kid.scale.setScalar(Math.max(0.0001, kidS.step(dt)));
    for (const id in others) {
      const o = others[id];
      const e = smooth(o.grow.step(dt));
      o.plane.constant = e > 0 ? e * (o.len + 2) : -0.01;
      o.root.visible = e > 0.002;
    }
    if (num.t < 1) {
      num.t = Math.min(1, num.t + dt / 1.6);
      num.v = num.from + (num.to - num.from) * ease(num.t);
      $('#mNum').textContent = num.v < 20 ? num.v.toFixed(num.to < 20 ? 2 : 1) : Math.round(num.v).toString();
    }
    // 天黑：背景、太陽變月光、環境光變暗；燈一台一台亮起來（晚上才有光暈）
    const n = smooth(nightS.step(dt));
    if (n > 0.001 || nightDriven) {
      scene.background.copy(dayBg).lerp(NIGHT.bg, n);
      sun.intensity = 2.2 + (0.32 - 2.2) * n;
      sun.color.copy(NIGHT.white).lerp(NIGHT.moon, n);
      hemi.intensity = 0.55 + (0.07 - 0.55) * n;
      scene.environmentIntensity = 0.75 + (0.09 - 0.75) * n;
      st.shadeMat.opacity = 0.2 + 0.2 * n;
      rim.intensity = 1.2 * (1 - n);
    }
    bloom.enabled = n > 0.01;
    bloom.strength = 0.9 * n;
    bloom.threshold = 4.5 + (1.0 - 4.5) * n;
    const ORDER_ON = ['car', 'bus', 'train', 'plane'];
    const nightT = SHOTS[si].night ? shotT : -1;
    const want = (veh, group) => (nightT < 0 || !NIGHT_ON[veh]?.includes(group) ? 0 : nightT > 1.2 + ORDER_ON.indexOf(veh) * 0.55 + NIGHT_ON[veh].indexOf(group) * 0.18 ? 1 : 0);
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
    // 鏡頭
    const P = pose(si);
    cam.x.to = P.c.x;
    cam.y.to = P.c.y;
    cam.z.to = P.c.z;
    cam.ld.to = Math.log(P.d);
    cam.az.to = P.az;
    cam.el.to = P.el;
    for (const key in cam) cam[key].step(dt);
    orbit.step(dt);
    const dist = Math.exp(cam.ld.x);
    const az = cam.az.x + orbit.yaw.x + (RM.matches ? 0 : Math.sin(t * 0.09) * 0.04) + (SHOTS[si].night && !RM.matches ? shotT * 0.006 : 0);
    const el = cam.el.x + orbit.pitch.x * 0.5;
    tgt.set(cam.x.x, cam.y.x, cam.z.x);
    camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z - Math.cos(az) * Math.cos(el) * dist);
    if (!RM.matches) camera.position.add(tmp.set(Math.sin(t * 0.5), Math.sin(t * 0.37), Math.cos(t * 0.43)).multiplyScalar(dist * 0.004));
    camera.lookAt(tgt);
    camera.near = Math.max(0.05, dist * 0.02);
    camera.far = dist * 8;
    camera.updateProjectionMatrix();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const wide = si >= 4;
    if (portrait()) camera.setViewOffset(w, h, 0, wide ? -h * 0.01 : h * 0.12, w, h);
    else camera.setViewOffset(w, h, wide ? 0 : -w * 0.12, wide ? h * 0.17 : h * 0.04, w, h);
    const E = Math.max(6, dist * 0.45);
    Object.assign(sun.shadow.camera, {left: -E, right: E, top: E, bottom: -E, near: 0.5, far: E * 8});
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(tgt.x + E * 0.5, E * 2.2, tgt.z - E * 0.8);
    sun.target.position.copy(tgt);
    sun.shadow.bias = -0.0004 * Math.max(1, E / 8);
    const ra = t * 0.15;
    rim.position.set(tgt.x + Math.cos(ra) * 20, tgt.y + 8, tgt.z + 20 + Math.sin(ra) * 6);
    rim.target.position.copy(tgt);
    // 景深：焦點在鏡頭看的地方；開場的點一開始整團失焦，聚起來時焦點拉近
    const fd = camera.position.distanceTo(tgt);
    bokeh.uniforms.focus.value = fd;
    PU.uFocus.value = fd * (1 + PU.uScatter.value * 1.2);
    bokeh.uniforms.aperture.value = (0.085 / dist) * (wide ? 0.5 : 1) * (si === 0 ? 0.5 : 0.4 + 0.6 * smooth(Math.max(k, wide ? 1 : 0)));
    // 開場的點沒有寫進深度，後製的景深會把它們當成背景一起糊掉：點自己算失焦，開場先關掉後製的
    bokeh.enabled = !(si === 0 && points.visible);
    composer.render(dt);
    // 最後兩個鏡頭：每一台的名字
    for (const el2 of stage.querySelectorAll('#ftags .tag')) {
      const key = el2.dataset.k;
      const on = si === 5 && (key === 'near' || (others[key] && others[key].grow.x > 0.9));
      el2.classList.toggle('on', on);
      if (!on) continue;
      const p = key === 'near' ? new THREE.Vector3(-6, 3.6, 2) : key === 'plane' ? new THREE.Vector3(-INFO.plane.len * 0.45, 19, LANES.plane) : new THREE.Vector3(-INFO.train.len * 0.62, 4.5, LANES.train);
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
      setNight(false);
      ro.disconnect();
      bokeh.dispose?.();
      bloom.dispose?.();
      st.dispose();
    },
  };
}
