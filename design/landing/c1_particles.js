// 概念 1：粒子變形。四台車由幾萬個點組成（從網站裡真的 3D 模型表面取樣，每一層各取一份），
// 一次手勢走一段：整台 → 一層一層往上分開（和標誌一樣的爆炸圖）→ 散開、重組成下一台。
// 一開始所有的點是一團失焦的光斑，焦點拉近、點聚成第一台。
import {THREE, loadVehicle, ORDER, INFO, VEH, Spring, pager, dragOrbit, loop, css, isDark, RM, isPhone, toScreen, smooth} from './stage.js';
import {MeshSurfaceSampler} from 'three/addons/math/MeshSurfaceSampler.js';

// 每一層分到的點：外面、裡面、底盤、動力（飛機多一層：翅膀和肚子分開）
const SHARES = {4: [0.4, 0.25, 0.19, 0.16], 5: [0.34, 0.22, 0.17, 0.12, 0.15]};
const D = 10; // 每台車縮放到一樣大（最長的那一邊 10）
const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function sample(veh, N) {
  const {model, layerOf, id} = veh;
  model.root.scale.setScalar(1);
  model.root.updateMatrixWorld(true);
  const NL = veh.V.LAYERS.length;
  const SHARE = SHARES[NL];
  const layers = SHARE.map(() => []);
  const m4 = new THREE.Matrix4();
  model.root.traverseVisible((m) => {
    if (!m.isMesh) return;
    const L = layerOf[m.userData.part];
    if (!L) return;
    const mat = [].concat(m.material)[0];
    if (mat?.transparent && (mat.opacity ?? 1) < 0.5) return; // 玻璃留空，看起來才像窗
    if (!m.geometry?.attributes?.position) return;
    let s;
    try {
      s = new MeshSurfaceSampler(m).build();
    } catch {
      return;
    }
    const det = Math.abs(m.matrixWorld.determinant());
    const n = m.isInstancedMesh ? m.count : 1;
    const area = s.distribution[s.distribution.length - 1] * Math.pow(det, 2 / 3) * n;
    if (!(area > 0)) return;
    layers[L - 1].push({m, s, area, n});
  });
  const pos = new Float32Array(N * 3);
  const lay = new Float32Array(N);
  const p = new THREE.Vector3();
  let k = 0;
  // 高鐵只取 1 車和 2 車的前半，尾巴慢慢淡掉（整列 304 m 縮到 10 就只剩一條線）
  const keep = id === 'train' ? (x) => x > -30 || Math.random() < THREE.MathUtils.smoothstep(x, -44, -30) : () => true;
  SHARE.forEach((sh, li) => {
    const list = layers[li];
    const want = li === NL - 1 ? N - k : Math.round(N * sh);
    if (!list.length) return;
    const cum = [];
    let acc = 0;
    for (const e of list) cum.push((acc += e.area));
    for (let j = 0, guard = 0; j < want && guard < want * 30; guard++) {
      const r = Math.random() * acc;
      let lo = 0, hi = cum.length - 1;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < r) lo = mid + 1;
        else hi = mid;
      }
      const e = list[lo];
      e.s.sample(p);
      if (e.m.isInstancedMesh) {
        e.m.getMatrixAt(Math.floor(Math.random() * e.n), m4);
        p.applyMatrix4(m4);
      }
      p.applyMatrix4(e.m.matrixWorld);
      if (!keep(p.x)) continue;
      pos[k * 3] = p.x;
      pos[k * 3 + 1] = p.y;
      pos[k * 3 + 2] = p.z;
      lay[k] = li;
      k++, j++;
    }
  });
  // 沒取滿（極少數）就重複前面的點
  for (let j = k; j < N; j++) {
    const f = j % Math.max(1, k);
    pos.copyWithin(j * 3, f * 3, f * 3 + 3);
    lay[j] = lay[f];
  }
  // 置中、縮放：最長的一邊 D，輪子貼地
  const box = new THREE.Box3();
  for (let j = 0; j < N; j++) box.expandByPoint(p.fromArray(pos, j * 3));
  const sz = box.getSize(new THREE.Vector3());
  const sc = D / Math.max(sz.x, sz.z);
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  for (let j = 0; j < N; j++) {
    pos[j * 3] = (pos[j * 3] - cx) * sc;
    pos[j * 3 + 1] = (pos[j * 3 + 1] - box.min.y) * sc;
    pos[j * 3 + 2] = (pos[j * 3 + 2] - cz) * sc;
  }
  // 每一層照前後排好：變形的時候車頭的點飛到下一台的車頭，看起來是一路從前面變過去
  const idx = [...Array(N).keys()].sort((a, b) => lay[a] - lay[b] || pos[b * 3] - pos[a * 3]);
  const P = new Float32Array(N * 3), Ly = new Float32Array(N);
  idx.forEach((s, d) => {
    P[d * 3] = pos[s * 3];
    P[d * 3 + 1] = pos[s * 3 + 1];
    P[d * 3 + 2] = pos[s * 3 + 2];
    Ly[d] = lay[s];
  });
  // 每一層的範圍：放標籤用
  const lb = SHARE.map(() => new THREE.Box3());
  for (let j = 0; j < N; j++) lb[Ly[j]].expandByPoint(p.fromArray(P, j * 3));
  return {pos: P, lay: Ly, h: sz.y * sc, boxes: lb, nl: NL};
}

const VERT = `
attribute vec3 p0; attribute vec3 p1; attribute vec3 p2; attribute vec3 p3;
attribute vec4 aL; attribute vec4 aRnd;
uniform vec4 uA; uniform vec4 uB; uniform float uM; uniform float uFly;
uniform float uPeel[5]; uniform float uHi[5]; uniform float uNL; uniform float uGap; uniform float uTime;
uniform float uScatter; uniform float uFocus; uniform float uAperture; uniform float uSize; uniform float uPR; uniform float uDust;
varying float vA; varying float vHi; varying float vSoft;
void main(){
  vec3 pa = p0*uA.x + p1*uA.y + p2*uA.z + p3*uA.w;
  vec3 pb = p0*uB.x + p1*uB.y + p2*uB.z + p3*uB.w;
  float t = clamp((uM - aRnd.x*0.42) / 0.58, 0.0, 1.0);
  t = t*t*(3.0-2.0*t);
  vec3 p = mix(pa, pb, t);
  float fl = sin(3.14159*t) * uFly;
  float ph = aRnd.y*6.2832;
  p += fl * vec3(sin(ph + uTime*0.8)*1.6, 1.2 + aRnd.z*2.2, cos(ph*1.3 + uTime*0.7)*1.6);
  float aLayer = dot(aL, uB);
  int li = int(aLayer + 0.5);
  float peel = li < 5 ? uPeel[li] : 0.0;
  p.y += peel * (uNL - 1.0 - aLayer) * uGap;
  p += 0.012 * vec3(sin(uTime*1.3 + aRnd.w*40.0), sin(uTime*1.1 + aRnd.y*30.0), cos(uTime*1.2 + aRnd.z*20.0));
  vec3 sc = normalize(aRnd.xyz - 0.5 + 1e-4) * (7.0 + aRnd.w*14.0) + vec3(0.0, 2.5, 0.0);
  float sct = smoothstep(0.0, 1.0, clamp(uScatter*1.5 - aRnd.x*0.5, 0.0, 1.0));
  p = mix(p, sc, sct);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  float c = clamp(abs(dist - uFocus) / dist * uAperture, 0.0, 1.0);
  c = max(c, uDust);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = uSize * uPR * (1.0 + c*9.0) * (14.0 / dist) * (0.75 + aRnd.w*0.5);
  vA = 1.0 / (1.0 + c*c*60.0);
  vSoft = c;
  vHi = li < 5 ? uHi[li] : 0.0;
}`;
const FRAG = `
uniform vec3 uInk; uniform vec3 uAcc; uniform float uAlpha;
varying float vA; varying float vHi; varying float vSoft;
void main(){
  vec2 q = gl_PointCoord - 0.5;
  float r = length(q) * 2.0;
  float edge = mix(0.15, 0.6, vSoft);
  float a = 1.0 - smoothstep(1.0 - edge, 1.0, r);
  if (a < 0.01) discard;
  vec3 col = mix(uInk, uAcc, vHi);
  gl_FragColor = vec4(col, a * vA * uAlpha * mix(1.0, 1.35, vHi));
  #include <colorspace_fragment>
}`;

export default async function run(stage, ctx) {
  const N = isPhone() ? 46000 : 90000;
  const vehs = [];
  for (const id of ORDER) {
    vehs.push(await loadVehicle(id));
    if (!ctx.alive()) return;
  }
  const S = vehs.map((v) => sample(v, N));
  // 取完樣就把網格丟掉，只留點
  for (const v of vehs)
    v.model.root.traverse((o) => {
      o.geometry?.dispose?.();
      for (const m of [].concat(o.material || [])) m.dispose?.();
    });

  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const renderer = new THREE.WebGLRenderer({canvas, antialias: false, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  const geo = new THREE.BufferGeometry();
  S.forEach((s, i) => geo.setAttribute('p' + i, new THREE.BufferAttribute(s.pos, 3)));
  geo.setAttribute('position', geo.getAttribute('p0'));
  const aL = new Float32Array(N * 4);
  S.forEach((s, i) => s.lay.forEach((l, j) => (aL[j * 4 + i] = l)));
  geo.setAttribute('aL', new THREE.BufferAttribute(aL, 4));
  const rnd = new Float32Array(N * 4);
  for (let j = 0; j < N; j++) {
    // 變形的先後：車頭的點先走，加一點亂數
    rnd[j * 4] = THREE.MathUtils.clamp(0.5 - S[0].pos[j * 3] / D + (Math.random() - 0.5) * 0.35, 0, 1);
    rnd[j * 4 + 1] = Math.random();
    rnd[j * 4 + 2] = Math.random();
    rnd[j * 4 + 3] = Math.random();
  }
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3, 0), 40);
  const U = {
    uA: {value: new THREE.Vector4(1, 0, 0, 0)},
    uB: {value: new THREE.Vector4(1, 0, 0, 0)},
    uM: {value: 1},
    uFly: {value: 1},
    uPeel: {value: [0, 0, 0, 0, 0]},
    uHi: {value: [0, 0, 0, 0, 0]},
    uNL: {value: 4},
    uGap: {value: 1.15},
    uTime: {value: 0},
    uScatter: {value: RM.matches ? 0 : 1},
    uFocus: {value: 18},
    uAperture: {value: 1.6},
    uSize: {value: isPhone() ? 1.5 : 1.35},
    uPR: {value: renderer.getPixelRatio()},
    uDust: {value: 0},
    uInk: {value: new THREE.Color()},
    uAcc: {value: new THREE.Color()},
    uAlpha: {value: 0.6},
  };
  const mat = new THREE.ShaderMaterial({uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false});
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  // 遠處幾顆失焦的光斑：空間感
  const ND = 700;
  const dg = new THREE.BufferGeometry();
  const dp = new Float32Array(ND * 3);
  for (let j = 0; j < ND; j++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(14 + Math.random() * 30);
    v.y = Math.abs(v.y) * 0.6 - 2;
    v.toArray(dp, j * 3);
  }
  for (let i = 0; i < 4; i++) dg.setAttribute('p' + i, new THREE.BufferAttribute(dp, 3));
  dg.setAttribute('position', dg.getAttribute('p0'));
  dg.setAttribute('aL', new THREE.BufferAttribute(new Float32Array(ND * 4).fill(9), 4));
  const dr = new Float32Array(ND * 4).map(() => Math.random());
  dg.setAttribute('aRnd', new THREE.BufferAttribute(dr, 4));
  const dU = {...U, uDust: {value: 0.55}, uAlpha: {value: 0.16}, uScatter: {value: 0}, uFly: {value: 0}, uSize: {value: 2.2}};
  const dust = new THREE.Points(dg, new THREE.ShaderMaterial({uniforms: dU, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false}));
  dust.frustumCulled = false;
  scene.add(dust);

  const paint = () => {
    const d = isDark();
    scene.background = new THREE.Color(css('--bg'));
    U.uInk.value.set(css('--ink'));
    U.uAcc.value.set(css('--accent'));
    U.uAlpha.value = d ? 0.55 : 0.5;
    dU.uAlpha.value = d ? 0.14 : 0.1;
    for (const m of [mat, dust.material]) {
      m.blending = d ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.needsUpdate = true;
    }
  };
  paint();
  ctx.onTheme(paint);

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `
    <div class="copy">
      <p class="kicker rise">Peelback · 剝剝看</p>
      <h1 class="rise" style="animation-delay:.1s">把真的車，<br>一層一層剝開</h1>
      <p class="sub rise" style="animation-delay:.2s">公車、飛機、汽車、高鐵，照實車的尺寸和零件做成 3D。點一下拆開，看看裡面有什麼。</p>
      <a class="cta rise" style="animation-delay:.3s" href="https://peelback.aronlab.dev/" target="_blank" rel="noopener">進展廳 ${ARROW}</a>
    </div>
    <div class="cap1" id="cap"><span class="no">No.<b id="capNo">01</b></span><span class="nm" id="capNm"></span><span class="meta" id="capMeta"></span></div>
    <div class="dots" id="dots">${ORDER.map((id, i) => `<button data-i="${i}" aria-label="No.${INFO[id].no}"><i></i></button>`).join('')}</div>
    <div class="tags" id="tags">${[0, 1, 2, 3, 4].map((i) => `<div class="tag" data-l="${i}"><i></i><em>0${i + 1}</em><b></b></div>`).join('')}</div>
    <div class="hintdown gone" id="hint"><div class="ring"><svg viewBox="0 0 24 24"><path d="M6 9.5l6 6 6-6"/></svg></div><div class="flow"></div></div>`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const tags = [...stage.querySelectorAll('.tag')];

  // ---------- 狀態：第 vi 台、拆開沒有 ----------
  let vi = 0, peel = 0, pending = null;
  const morph = {from: 0, to: 0, t: 1};
  const peelS = [0, 1, 2, 3, 4].map(() => new Spring(0, 60, 13));
  const hiS = [0, 1, 2, 3, 4].map(() => new Spring(0, 40, 12));
  const nl = () => S[vi].nl;
  const timers = [];
  const later = (f, ms) => timers.push(setTimeout(f, ms));
  const clearT = () => timers.splice(0).forEach(clearTimeout);
  const W = (i) => new THREE.Vector4(...[0, 1, 2, 3].map((k) => (k === i ? 1 : 0)));

  const caption = () => {
    const I = INFO[ORDER[vi]];
    $('#capNo').textContent = I.no;
    $('#capNm').textContent = `${I.brand}・${I.name}`;
    $('#capMeta').textContent = `${I.len} m ・ ${VEH[ORDER[vi]].LAYERS.length} 層 ・ ${I.parts} 個零件`;
    const cap = $('#cap');
    cap.classList.remove('in');
    void cap.offsetWidth;
    cap.classList.add('in');
    stage.querySelectorAll('#dots button').forEach((b, i) => b.classList.toggle('on', i === vi));
    VEH[ORDER[vi]].LAYERS.forEach((L, i) => (tags[i].querySelector('b').textContent = L.name[0]));
    U.uNL.value = nl();
    U.uGap.value = Math.max(1.1, S[vi].h * 0.72);
  };
  const setPeel = (on) => {
    clearT();
    peel = on;
    peelS.forEach((s, i) => later(() => (s.to = on && i < nl() ? 1 : 0), RM.matches ? 0 : on ? i * 260 : (4 - i) * 90));
    // 一層分開時亮一下主色，最後留著最裡面的動力那一層
    hiS.forEach((s, i) => {
      if (!on || i >= nl()) return (s.to = 0);
      later(() => (s.to = 1), i * 260 + 120);
      if (i < nl() - 1) later(() => (s.to = 0), i * 260 + 1300);
    });
    tags.forEach((t, i) => (on && i < nl() ? later(() => t.classList.add('on'), i * 260 + 300) : t.classList.remove('on')));
  };
  const toVehicle = (j) => {
    if (morph.t < 1) return void (pending = j * 2);
    setPeel(false);
    morph.from = vi;
    morph.to = j;
    morph.t = 0;
    U.uA.value.copy(W(vi));
    U.uB.value.copy(W(j));
    vi = j;
    later(caption, 500);
  };
  const go = (step) => {
    stage.querySelector('.copy').classList.toggle('away', step > 0);
    const j = Math.floor(step / 2), p = step % 2;
    hint.classList.add('gone');
    if (j !== vi) {
      toVehicle(j);
      if (p) later(() => setPeel(true), 2300);
    } else if (p !== peel) setPeel(!!p);
    later(() => step < 7 && hint.classList.remove('gone'), 2600);
  };
  const hint = $('#hint');
  const pg = pager(stage, {n: 8, onGo: go, sig: ctx.sig});
  stage.querySelector('#dots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pg.go(+b.dataset.i * 2);
  }, {signal: ctx.sig});
  const orbit = dragOrbit(canvas, {sig: ctx.sig});
  canvas.addEventListener('click', () => !orbit.moved && pg.go(pg.i % 2 ? pg.i - 1 : pg.i + 1), {signal: ctx.sig});
  caption();
  later(() => hint.classList.remove('gone'), 2800);

  // ---------- 鏡頭 ----------
  const focusS = new Spring(RM.matches ? 0 : 1, 14, 7.5);
  focusS.to = 0;
  const target = new THREE.Vector3();
  const corners = Array.from({length: 8}, () => new THREE.Vector3());
  const stop = loop((dt, t) => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (renderer.domElement.width !== Math.round(w * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    U.uTime.value = dU.uTime.value = t;
    // 開場：一團失焦的點聚起來、焦點拉近
    const intro = focusS.step(dt);
    U.uScatter.value = Math.max(0, intro);
    if (morph.t < 1) {
      morph.t = Math.min(1, morph.t + dt / (RM.matches ? 0.01 : 2.3));
      U.uM.value = morph.t;
      if (morph.t === 1) {
        U.uA.value.copy(U.uB.value);
        if (pending != null) {
          const p = pending;
          pending = null;
          go(p);
        }
      }
    }
    peelS.forEach((s, i) => (U.uPeel.value[i] = s.step(dt)));
    hiS.forEach((s, i) => (U.uHi.value[i] = Math.max(0, s.step(dt))));
    U.uFly.value = 1;
    orbit.step(dt);
    const sv = S[vi];
    const peelK = smooth(U.uPeel.value[0]);
    const hgt = sv.h + peelK * (sv.nl - 1) * U.uGap.value;
    const portrait = w / h < 0.8;
    const az = -0.72 + (RM.matches ? 0 : Math.sin(t * 0.11) * 0.22) + orbit.yaw.x;
    const el = 0.2 + peelK * 0.12 + orbit.pitch.x;
    const fitW = (D * 0.62) / Math.tan(THREE.MathUtils.degToRad(15)) / Math.min(1, camera.aspect * (portrait ? 1.25 : 0.85));
    const dist = Math.max(fitW, 15) * (1 + peelK * (0.12 + 0.07 * sv.nl * U.uGap.value / 1.6)) * (1 + 0.6 * intro);
    target.set(0, hgt * 0.47, 0);
    camera.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(target);
    // 電腦：車放右邊一點，左下留給字；手機：車放上半部
    if (portrait) camera.setViewOffset(w, h, 0, h * 0.16, w, h);
    else camera.setViewOffset(w, h, -w * 0.14, h * 0.04, w, h);
    U.uFocus.value = dist * (1 + intro * 1.4);
    dU.uFocus.value = U.uFocus.value;
    renderer.render(scene, camera);
    // 標籤：每一層最右邊的角
    if (peel || tags.some((t) => t.classList.contains('on'))) {
      for (let i = 0; i < sv.nl; i++) {
        const b = sv.boxes[i];
        const lift = U.uPeel.value[i] * (sv.nl - 1 - i) * U.uGap.value;
        let k = 0;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) corners[k++].set(x, (y + (b.min.y + b.max.y) / 2) / 2 + lift, z);
        let best = null;
        for (const c of corners) {
          const s = toScreen(c, camera, canvas);
          if (!best || s.x > best.x) best = s;
        }
        const tw = tags[i].offsetWidth;
        const x = Math.min(best.x + 10, w - tw - (portrait ? 16 : 70));
        tags[i].style.transform = `translate(${x}px, ${best.y - 8}px)`;
      }
    }
  });
  return {
    dispose() {
      stop();
      clearT();
      geo.dispose();
      dg.dispose();
      mat.dispose();
      dust.material.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
