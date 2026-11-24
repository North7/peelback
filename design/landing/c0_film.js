// 電影版：3 凍結爆炸＋6 真實比例接成一部片。同一個 3D 場景、同一台攝影機，一次手勢一個鏡頭，中間不剪接：
//   1 Model Y 在半空中炸開（首屏）→ 2 鏡頭穿進零件之間看座椅 → 3 繞到車底看電池
//   → 4 零件合回整台、鏡頭往後拉，旁邊站著 115 公分的小朋友、公車畫出來 → 5 拉到最遠，四台照真實比例排開，停在「進展廳」。
// 全程有景深（焦點跟著鏡頭看的地方）、慢慢掃過去的逆光、手持感；尊重「減少動態」。
import {THREE, loadVehicle, makeStage, Spring, pager, loop, isDark, RM, toScreen, smooth, ease, heroCopy, HINT, INFO, dragOrbit} from './stage.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {PARTS, SPEC} from '../../car/data.js';

const KID = 1.15;
const ARROW = '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// 每個鏡頭：焦點零件（或要框住的車）、方向、距離、名牌、字幕
const SHOTS = [
  {focus: null, dir: [0.75, 0.42, -0.85], dist: 1, card: ['Model Y', `${SPEC.length} 公尺・${Object.keys(PARTS).length} 個零件`]},
  {focus: 'seats', dir: [0.3, 0.5, -0.92], dist: 0.42, card: [PARTS.seats.name, `${SPEC.seats} 個座位：前面兩個、後面三個`],
    chap: ['一層一層拆開', '外殼、座椅、底盤、電池，每一層都可以單獨拿出來看。']},
  {focus: 'battery', dir: [0.55, -0.3, -0.95], dist: 0.4, card: [PARTS.battery.name, `大約 ${SPEC.battery} 度電，可以把 5000 支手機充飽`],
    chap: ['每個零件都有名字', '點一下零件，名牌就跳出來，還會念給你聽。中文、英文、注音都有。']},
  {fit: ['car', 'bus'], az: 0.68, el: 0.26,
    chap: ['照真的大小做', '旁邊站一個 115 公分的小朋友。公車 12.2 公尺，差不多 11 個小朋友躺成一排。']},
  {fit: ['car', 'bus', 'plane', 'train'], az: 0.62, el: 0.5,
    chap: ['四台車，四種大小', '最長的高鐵 304 公尺，12 節車廂一節一節都拆得開。'], cta: true},
];
const LANES = {car: 0, bus: 4.2, train: 8.8, plane: 46};

export default async function run(stage, ctx) {
  const car = await loadVehicle('car');
  if (!ctx.alive()) return;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 32, near: 0.05, far: 4000, ext: 8});
  const {scene, camera, renderer, sun} = st;
  st.shade.geometry.dispose();
  st.shade.geometry = new THREE.PlaneGeometry(3000, 3000);
  // 逆光：從後面慢慢繞著掃過去，零件的邊緣一亮一亮
  const rim = new THREE.DirectionalLight('#eef2ff', 1.4);
  scene.add(rim, rim.target);

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
    return new THREE.Box3().setFromObject(root);
  };
  const boxes = {car: place(car, 'car')};

  // ---------- Model Y 炸開：每一塊各自一個轉軸 ----------
  const {model, layerOf} = car;
  const C = boxes.car.getCenter(new THREE.Vector3());
  const meshes = [];
  model.root.traverse((o) => o.isMesh && o.visible && layerOf[o.userData.part] && meshes.push(o));
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

  // ---------- 其他三台：背景慢慢下載，到了第 4、5 個鏡頭才沿著尺「畫」出來 ----------
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

  // ---------- 後製：景深 ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
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
  const paint = () => {
    st.paint();
    const d = isDark();
    kidMat.color.set(d ? '#7d98ff' : '#2f5bea');
    rim.intensity = d ? 1.8 : 1.2;
  };
  paint();
  ctx.onTheme(paint);

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy()}
    <div class="chap" id="chap"><em id="chNo"></em><h2 id="chT"></h2><p id="chL"></p><a class="cta" id="chCta" href="https://peelback.aronlab.dev/" target="_blank" rel="noopener">進展廳 ${ARROW}</a></div>
    <div class="fcard" id="fcard"><i class="dot"></i><i class="lead"></i><div class="in"><em id="fcNo">01</em><b id="fcT"></b><span id="fcL"></span></div></div>
    <div class="meter" id="meter"><span class="k">真實長度</span><div class="big"><b id="mNum">4.79</b><small>m</small></div><span class="who" id="mWho"></span><span class="kids" id="mKids"></span></div>
    <div class="tags" id="ftags"><div class="tag vtag" data-k="near"><em>No.01・03</em><b>公車・Model Y・小朋友</b></div><div class="tag vtag" data-k="plane"><em>No.02</em><b>A350-1000</b></div><div class="tag vtag" data-k="train"><em>No.04</em><b>700T</b></div></div>
    <div class="dots" id="dots">${SHOTS.map((s, i) => `<button data-i="${i}" aria-label="第 ${i + 1} 個鏡頭"><i></i></button>`).join('')}</div>
    ${HINT}`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const hint = $('.hintdown'), card = $('#fcard'), chap = $('#chap'), meter = $('#meter'), copy = $('.copy');
  meter.classList.add('off');

  // ---------- 狀態 ----------
  let si = 0;
  const tau = new Spring(0, 9, 5.2); // 炸開的進度（慢動作）
  const num = {v: SPEC.length, from: SPEC.length, to: SPEC.length, t: 1};
  const UP = new THREE.Vector3(0, 1, 0);
  const portrait = () => camera.aspect < 0.8;
  /** 框住幾台車（含小朋友）的鏡頭：回傳目標點和距離。 */
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
    const dir = new THREE.Vector3(...s.dir).normalize();
    const base = 18 * Math.max(1, (portrait() ? 0.95 : 1.4) / camera.aspect);
    return {c: centerOf(s.focus), d: base * s.dist, az: Math.atan2(dir.x, -dir.z), el: Math.asin(dir.y)};
  };
  const P0 = pose(0);
  const cam = {x: new Spring(P0.c.x, 8, 5.6), y: new Spring(P0.c.y, 8, 5.6), z: new Spring(P0.c.z, 8, 5.6), ld: new Spring(Math.log(P0.d * 1.5), 8, 5.6), az: new Spring(P0.az - 0.25, 8, 5.6), el: new Spring(P0.el - 0.12, 8, 5.6)};

  const setText = (i) => {
    const s = SHOTS[i];
    copy.classList.toggle('away', i > 0);
    // 名牌
    card.classList.remove('on');
    if (s.card)
      setTimeout(() => {
        if (si !== i) return;
        $('#fcNo').textContent = '0' + (i + 1);
        $('#fcT').textContent = s.card[0];
        $('#fcL').textContent = s.card[1];
        card.classList.add('on');
      }, RM.matches ? 0 : 1100);
    // 字幕：舊的先淡掉，新的一行一行從遮罩下面升上來
    chap.classList.remove('in');
    chap.classList.toggle('off', !s.chap);
    if (s.chap)
      setTimeout(() => {
        if (si !== i) return;
        $('#chNo').textContent = `0${i + 1} / 0${SHOTS.length}`;
        $('#chT').innerHTML = `<span>${s.chap[0]}</span>`;
        $('#chL').innerHTML = `<span>${s.chap[1]}</span>`;
        chap.classList.toggle('withcta', !!s.cta);
        void chap.offsetWidth;
        chap.classList.add('in');
      }, RM.matches ? 0 : 700);
    // 長度
    meter.classList.toggle('off', i < 3);
    if (i >= 3) {
      const id = i === 3 ? 'bus' : 'train';
      num.from = i === 3 ? SPEC.length : num.v;
      num.to = INFO[id].len;
      num.t = 0;
      $('#mWho').textContent = `${INFO[id].brand}・${INFO[id].name}`;
      $('#mKids').textContent = `差不多 ${Math.round(INFO[id].len / KID)} 個小朋友躺成一排`;
    }
    stage.querySelectorAll('#dots button').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const go = async (i) => {
    si = i;
    hint.classList.add('gone');
    tau.to = i <= 2 ? 1 : 0;
    kidS.to = i >= 3 ? 1 : 0;
    if (i >= 3) await loadOthers;
    if (si !== i || !ctx.alive()) return;
    for (const id in others) others[id].grow.to = (id === 'bus' && i >= 3) || i >= 4 ? 1 : 0;
    setText(i);
    setTimeout(() => si === i && i < SHOTS.length - 1 && hint.classList.remove('gone'), 3000);
  };
  const pg = pager(stage, {n: SHOTS.length, onGo: go, sig: ctx.sig});
  $('#dots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pg.go(+b.dataset.i);
  }, {signal: ctx.sig});
  const orbit = dragOrbit(canvas, {sig: ctx.sig});

  // 開場：整台停在地上、鏡頭在遠處，0.8 秒後慢動作炸開、鏡頭推進
  const timers = [setTimeout(() => (tau.to = 1), RM.matches ? 0 : 800), setTimeout(() => (setText(0), hint.classList.remove('gone')), RM.matches ? 0 : 2600)];
  stage.querySelectorAll('#dots button')[0].classList.add('on');

  const q = new THREE.Quaternion(), qI = new THREE.Quaternion(), qd = new THREE.Quaternion();
  const tgt = new THREE.Vector3(), tmp = new THREE.Vector3();
  const stop = loop((dt, t) => {
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
    // 其他車沿著尺畫出來
    for (const id in others) {
      const o = others[id];
      const e = smooth(o.grow.step(dt));
      o.plane.constant = e > 0 ? e * (o.len + 2) : -0.01;
      o.root.visible = e > 0.002;
    }
    // 數字
    if (num.t < 1) {
      num.t = Math.min(1, num.t + dt / 1.6);
      num.v = num.from + (num.to - num.from) * ease(num.t);
      $('#mNum').textContent = num.v < 20 ? num.v.toFixed(num.to < 20 ? 2 : 1) : Math.round(num.v).toString();
    }
    // 鏡頭：目標、距離（對數）、角度都用彈簧，拉遠推近的速度看起來均勻
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
    const az = cam.az.x + orbit.yaw.x + (RM.matches ? 0 : Math.sin(t * 0.09) * 0.04);
    const el = cam.el.x + orbit.pitch.x * 0.5;
    tgt.set(cam.x.x, cam.y.x, cam.z.x);
    camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z - Math.cos(az) * Math.cos(el) * dist);
    if (!RM.matches) camera.position.add(tmp.set(Math.sin(t * 0.5), Math.sin(t * 0.37), Math.cos(t * 0.43)).multiplyScalar(dist * 0.004));
    camera.lookAt(tgt);
    camera.near = Math.max(0.05, dist * 0.02);
    camera.far = dist * 8;
    camera.updateProjectionMatrix();
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const wide = si >= 3;
    if (portrait()) camera.setViewOffset(w, h, 0, wide ? -h * 0.01 : h * 0.12, w, h);
    else camera.setViewOffset(w, h, wide ? 0 : -w * 0.12, wide ? h * 0.17 : h * 0.04, w, h);
    // 影子、逆光跟著尺度走
    const E = Math.max(6, dist * 0.45);
    Object.assign(sun.shadow.camera, {left: -E, right: E, top: E, bottom: -E, near: 0.5, far: E * 8});
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(tgt.x + E * 0.5, E * 2.2, tgt.z - E * 0.8);
    sun.target.position.copy(tgt);
    sun.shadow.bias = -0.0004 * Math.max(1, E / 8);
    const ra = t * 0.15;
    rim.position.set(tgt.x + Math.cos(ra) * 20, tgt.y + 8, tgt.z + 20 + Math.sin(ra) * 6);
    rim.target.position.copy(tgt);
    // 景深：焦點在鏡頭看的地方，光圈跟著距離縮放（拉遠就幾乎不糊，像移軸）
    bokeh.uniforms.focus.value = camera.position.distanceTo(tgt);
    bokeh.uniforms.aperture.value = (0.085 / dist) * (wide ? 0.5 : 1) * (0.4 + 0.6 * smooth(Math.max(k, wide ? 1 : 0)));
    composer.render(dt);
    // 最後一個鏡頭：每一台的名字（小的三個擠在車頭那一團，合成一個）
    for (const el of stage.querySelectorAll('#ftags .tag')) {
      const key = el.dataset.k;
      const on = si === 4 && (key === 'near' || (others[key] && others[key].grow.x > 0.9));
      el.classList.toggle('on', on);
      if (!on) continue;
      const p = key === 'near' ? new THREE.Vector3(-6, 3.6, 2) : key === 'plane' ? new THREE.Vector3(-INFO.plane.len * 0.45, 19, LANES.plane) : new THREE.Vector3(-INFO.train.len * 0.62, 4.5, LANES.train);
      const s = toScreen(p, camera, canvas);
      el.style.transform = `translate(${s.x}px, ${s.y}px) translate(-50%, -100%)`;
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
      timers.forEach(clearTimeout);
      ro.disconnect();
      bokeh.dispose?.();
      st.dispose();
    },
  };
}
