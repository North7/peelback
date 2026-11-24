// 概念 6：真實比例。四台照真的尺寸排在同一條起跑線上（車頭對齊），旁邊站一個 115 公分的小朋友當比例尺。
// 一次手勢多一台、鏡頭往後拉：Model Y 4.79 m → 公車 12.2 m → A350 73.79 m → 高鐵 304 m。
// 每多一台，地上的尺從車頭往後長到它的長度，車子跟著尺一路被「畫」出來，右下的數字滾到新的長度。
import {THREE, loadVehicle, makeStage, Spring, pager, loop, isDark, RM, toScreen, smooth, ease, heroCopy, HINT, INFO, dragOrbit, css} from './stage.js';

const KID = 1.15; // 小朋友身高（和網站裡「幾個小朋友躺成一排」用同一個數字）
const SEQ = [
  {id: 'car', lane: 0},
  {id: 'bus', lane: 4.2},
  {id: 'plane', lane: 46},
  {id: 'train', lane: 8.8},
];

export default async function run(stage, ctx) {
  const vehs = {};
  for (const s of SEQ) {
    vehs[s.id] = await loadVehicle(s.id);
    if (!ctx.alive()) return;
  }
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 16, near: 0.5, far: 3000, ext: 10});
  const {scene, camera, renderer, sun} = st;
  st.shade.geometry.dispose();
  st.shade.geometry = new THREE.PlaneGeometry(2000, 2000);

  // ---------- 四台：照實車尺寸（1:1 公尺）、車頭對齊在 x = 0 ----------
  const items = SEQ.map((s, i) => {
    const v = vehs[s.id];
    const root = v.model.root;
    root.scale.setScalar(1);
    v.model.track?.removeFromParent(); // 鐵軌不算在車長裡
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    root.position.x -= box.max.x;
    root.position.z += s.lane - (box.min.z + box.max.z) / 2;
    root.position.y -= box.min.y;
    scene.add(root);
    const len = INFO[s.id].len;
    // 尺一路往後長，車子跟著被畫出來：x < -已經長到的長度 的部分先切掉
    const plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const done = new Set();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      for (const m of [].concat(o.material)) {
        if (done.has(m)) continue;
        done.add(m);
        m.clippingPlanes = [plane];
        m.clipShadows = true;
      }
    });
    const wbox = new THREE.Box3().setFromObject(root);
    console.log('[scale]', s.id, 'length', (wbox.max.x - wbox.min.x).toFixed(2), 'width', (wbox.max.z - wbox.min.z).toFixed(2), 'height', wbox.max.y.toFixed(2));
    return {...s, root, len, plane, box: wbox, grow: new Spring(i === 0 ? 0 : 0, 10, 6.3), info: INFO[s.id]};
  });

  // 小朋友：平平的人形剪影（像標示牌上的小人），115 公分，主色
  const kidMat = new THREE.MeshStandardMaterial({color: '#2f5bea', roughness: 0.5});
  const sh = new THREE.Shape();
  // 從腳底往上畫半邊再鏡像：腿、身體、肩膀、脖子（單位公尺，總高 1.15 不含頭）
  const half = [[0.05, 0], [0.13, 0], [0.14, 0.5], [0.17, 0.52], [0.19, 0.86], [0.16, 0.9], [0.05, 0.92], [0.045, 0.95]];
  sh.moveTo(0, 0.12);
  for (const [x, y] of half) sh.lineTo(x, y);
  for (const [x, y] of half.slice().reverse()) sh.lineTo(-x, y);
  sh.lineTo(0, 0.12);
  const kidBody = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, {depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4}), kidMat);
  const kidHead = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.064, 32).rotateX(Math.PI / 2).translate(0, KID - 0.1, 0.02), kidMat);
  const kid = new THREE.Group();
  kid.add(kidBody, kidHead);
  kid.rotation.y = -0.5;
  kid.position.set(1.2, 0, -2.6);
  kid.traverse((o) => o.isMesh && (o.castShadow = true));
  scene.add(kid);

  // 地上的尺：從車頭往後的一條細線，每一台的長度一個刻度
  const rulerMat = new THREE.LineBasicMaterial({color: '#2f5bea'});
  const tickMat = new THREE.LineBasicMaterial({color: '#1a1b1d', transparent: true, opacity: 0.35});
  const RZ = -4.2;
  const ruler = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, RZ), new THREE.Vector3(-1, 0.01, RZ)]), rulerMat);
  scene.add(ruler);
  const ticks = items.map((it) => {
    const g = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-it.len, 0.01, RZ - 0.6), new THREE.Vector3(-it.len, 0.01, it.lane + 0.5)]), tickMat);
    g.visible = false;
    scene.add(g);
    return g;
  });
  const zero = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.01, RZ - 0.6), new THREE.Vector3(0, 0.01, 80)]), tickMat);
  scene.add(zero);

  const paint = () => {
    st.paint();
    const d = isDark();
    rulerMat.color.set(d ? '#7d98ff' : '#2f5bea');
    kidMat.color.set(d ? '#7d98ff' : '#2f5bea');
    tickMat.color.set(d ? '#edede8' : '#1a1b1d');
  };
  paint();
  ctx.onTheme(paint);

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy()}
    <div class="meter" id="meter"><span class="k">真實長度</span><div class="big"><b id="mNum">4.79</b><small>m</small></div><span class="who" id="mWho"></span><span class="kids" id="mKids"></span></div>
    <div class="tags" id="tags">
      <div class="tag kidtag on" id="kidTag"><i></i><b>小朋友 115 cm</b></div>
      ${items.map((it, i) => `<div class="tag vtag" data-i="${i}"><em>No.${it.info.no}</em><b>${it.info.name}</b></div>`).join('')}
    </div>
    <div class="dots" id="dots">${items.map((it, i) => `<button data-i="${i}" aria-label="${it.info.name}"><i></i></button>`).join('')}</div>
    ${HINT}`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const hint = $('.hintdown');
  const vtags = [...stage.querySelectorAll('.vtag')];
  let si = 0;
  let shown = 0;
  const num = {v: 0, from: 0, to: 0, t: 1};
  const setMeter = (i) => {
    const it = items[i];
    num.from = num.v;
    num.to = it.len;
    num.t = 0;
    $('#mWho').textContent = `${it.info.brand}・${it.info.name}`;
    $('#mKids').textContent = `差不多 ${Math.round(it.len / KID)} 個小朋友躺成一排`;
    const m = $('#meter');
    m.classList.remove('in');
    void m.offsetWidth;
    m.classList.add('in');
    stage.querySelectorAll('#dots button').forEach((b, k) => b.classList.toggle('on', k === i));
  };
  const go = (i) => {
    si = i;
    stage.querySelector('.copy').classList.toggle('away', i > 0);
    items.forEach((it, k) => (it.grow.to = k <= i ? 1 : 0));
    setMeter(i);
    hint.classList.add('gone');
    setTimeout(() => si === i && i < items.length - 1 && hint.classList.remove('gone'), 3000);
  };
  const pg = pager(stage, {n: items.length, onGo: go, sig: ctx.sig});
  $('#dots').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) pg.go(+b.dataset.i);
  }, {signal: ctx.sig});
  const orbit = dragOrbit(canvas, {sig: ctx.sig});
  setTimeout(() => {
    items[0].grow.to = 1;
    setMeter(0);
  }, RM.matches ? 0 : 500);
  setTimeout(() => hint.classList.remove('gone'), 2600);

  // ---------- 鏡頭：每一站把目前看得到的東西（含小朋友）剛好框進畫面的空白區 ----------
  const EL = [0.2, 0.3, 0.42, 0.5], AZ = [0.62, 0.68, 0.74, 0.62];
  const UP = new THREE.Vector3(0, 1, 0);
  const fit = (i) => {
    const box = new THREE.Box3().setFromObject(kid);
    for (const it of items.slice(0, i + 1)) box.union(it.box);
    const c = box.getCenter(new THREE.Vector3());
    const az = AZ[i], el = EL[i];
    const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
    const fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, UP).normalize();
    const upv = new THREE.Vector3().crossVectors(right, fwd);
    const portrait = camera.aspect < 0.8;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), tanH = tanV * camera.aspect;
    const sx = portrait ? 0.9 : 0.84, sy = portrait ? 0.42 : 0.6;
    let d = 0;
    const v = new THREE.Vector3();
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      v.set(x, y, z).sub(c);
      const cz = v.dot(dir);
      d = Math.max(d, cz + Math.abs(v.dot(right)) / (tanH * sx), cz + Math.abs(v.dot(upv)) / (tanV * sy));
    }
    return {c, d, az, el};
  };
  const F0 = fit(0);
  const cam = {x: new Spring(F0.c.x, 8, 5.6), y: new Spring(F0.c.y, 8, 5.6), z: new Spring(F0.c.z, 8, 5.6), ld: new Spring(Math.log(F0.d), 7, 5.3), el: new Spring(F0.el, 8, 5.6), az: new Spring(F0.az, 8, 5.6)};
  const tgt = new THREE.Vector3();
  const stop = loop((dt, t) => {
    // 尺和車：長到目前這一站
    let rl = 0;
    items.forEach((it, k) => {
      const g = it.grow.step(dt);
      const e = smooth(g);
      it.plane.constant = e * (it.len + 2) - 0.0001 + (e === 0 ? -0.01 : 0);
      it.root.visible = g > 0.002;
      ticks[k].visible = g > 0.98;
      rl = Math.max(rl, e * it.len);
    });
    const pos = ruler.geometry.attributes.position;
    pos.setX(1, -Math.max(0.01, rl));
    pos.needsUpdate = true;
    ruler.geometry.computeBoundingSphere();
    // 數字
    if (num.t < 1) {
      num.t = Math.min(1, num.t + dt / 1.6);
      num.v = num.from + (num.to - num.from) * ease(num.t);
      $('#mNum').textContent = num.v < 20 ? num.v.toFixed(num.to < 20 ? 2 : 1) : Math.round(num.v).toString();
    }
    // 鏡頭
    const F = fit(si);
    cam.x.to = F.c.x;
    cam.y.to = F.c.y;
    cam.z.to = F.c.z;
    cam.ld.to = Math.log(F.d);
    cam.el.to = F.el;
    cam.az.to = F.az;
    for (const k in cam) cam[k].step(dt);
    orbit.step(dt);
    const dist = Math.exp(cam.ld.x);
    const span = dist * 0.25;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const portrait = w / h < 0.8;
    const az = cam.az.x + orbit.yaw.x + (RM.matches ? 0 : Math.sin(t * 0.08) * 0.03);
    const el = cam.el.x + orbit.pitch.x * 0.5;
    tgt.set(cam.x.x, cam.y.x, cam.z.x);
    camera.position.set(tgt.x + Math.sin(az) * Math.cos(el) * dist, tgt.y + Math.sin(el) * dist, tgt.z - Math.cos(az) * Math.cos(el) * dist);
    camera.lookAt(tgt);
    camera.near = Math.max(0.3, dist * 0.05);
    camera.far = dist * 4;
    camera.updateProjectionMatrix();
    // 畫面的空白區：電腦是上面 60%（左下、右下有字），手機是中間（上面數字、下面標題）
    if (portrait) camera.setViewOffset(w, h, 0, -h * 0.01, w, h);
    else camera.setViewOffset(w, h, 0, h * 0.17, w, h);
    // 影子的範圍跟著尺度走
    const E = span * 0.7;
    Object.assign(sun.shadow.camera, {left: -E, right: E, top: E, bottom: -E, far: E * 6});
    sun.shadow.camera.updateProjectionMatrix();
    sun.position.set(tgt.x + E * 0.6, E * 2.2, tgt.z - E * 0.9);
    sun.target.position.copy(tgt);
    sun.shadow.bias = -0.0004 * Math.max(1, span / 20);
    renderer.render(scene, camera);
    // 標籤
    const kt = toScreen(new THREE.Vector3(kid.position.x, KID + 0.2, kid.position.z), camera, canvas);
    const kidTag = $('#kidTag');
    kidTag.style.transform = `translate(${kt.x}px, ${kt.y - 18}px)`;
    kidTag.classList.toggle('on', si < 2);
    items.forEach((it, k) => {
      const p = toScreen(new THREE.Vector3(-it.len * 0.5, it.box.max.y, it.lane), camera, canvas);
      const a1 = toScreen(new THREE.Vector3(0, 0, it.lane), camera, canvas), a2 = toScreen(new THREE.Vector3(-it.len, 0, it.lane), camera, canvas);
      const big = Math.hypot(a1.x - a2.x, a1.y - a2.y) > 90;
      vtags[k].style.transform = `translate(${p.x}px, ${p.y - 10}px) translate(-50%, -100%)`;
      vtags[k].classList.toggle('on', it.grow.x > 0.9 && big && (k !== 0 || si < 2));
    });
  });
  return {
    dispose() {
      stop();
      st.dispose();
    },
  };
}
