// 概念 2：掃描線。一道細光從車頭掃到車尾，掃過的地方這一層消失、露出下一層；
// 一次手勢掃一層（外面 → 裡面 → 底盤 → 電池和馬達），也可以抓著那條線自己拖。
// 用網站裡真的 Model Y：切口是真的裁切（陰影也跟著切），切口邊緣亮一條主色的光。
import {THREE, loadVehicle, makeStage, Spring, pager, loop, css, isDark, RM, isPhone, toScreen, smooth, heroCopy, HINT, splitByLayer} from './stage.js';

export default async function run(stage, ctx) {
  const veh = await loadVehicle('car');
  if (!ctx.alive()) return;
  const {V, model} = veh;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 28, ext: 9});
  const {scene, camera, renderer} = st;
  scene.add(model.root);
  model.root.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  const byL = splitByLayer(veh);
  const NL = V.LAYERS.length;
  const box = new THREE.Box3().setFromObject(model.root);
  const X0 = box.max.x + 0.05, X1 = box.min.x - 0.05; // 從車頭掃到車尾

  // 每一層一個裁切面（留下 x < cut 的部分）＋切口那一圈亮的光
  const acc = new THREE.Color();
  const cuts = [];
  for (let L = 1; L <= NL; L++) {
    const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), X0);
    const U = {uCut: {value: X0}, uAcc: {value: acc}, uBand: {value: 0.18}, uOn: {value: 0}};
    cuts[L] = {plane, U};
    const done = new Set();
    for (const m of byL[L] || []) {
      for (const mat of [].concat(m.material)) {
        if (done.has(mat)) continue;
        done.add(mat);
        mat.clippingPlanes = [plane];
        mat.clipShadows = true;
        mat.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, U);
          sh.vertexShader = 'varying vec3 vCutW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
            vec4 cutW = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              cutW = instanceMatrix * cutW;
            #endif
            vCutW = (modelMatrix * cutW).xyz;`);
          const glow = `float cutB = uOn * (1.0 - smoothstep(0.0, uBand, uCut - vCutW.x));`;
          sh.fragmentShader = 'varying vec3 vCutW;\nuniform float uCut; uniform vec3 uAcc; uniform float uBand; uniform float uOn;\n' + sh.fragmentShader;
          if (sh.fragmentShader.includes('#include <emissivemap_fragment>'))
            sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
              ${glow}
              diffuseColor.rgb = mix(diffuseColor.rgb, uAcc, cutB * 0.85);
              totalEmissiveRadiance += uAcc * cutB * 1.4;`);
          else sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
              ${glow}
              diffuseColor.rgb = mix(diffuseColor.rgb, uAcc, cutB);`);
        };
        mat.customProgramCacheKey = () => 'cut' + L;
        mat.needsUpdate = true;
      }
    }
  }

  // 掃描的那一片：很淡的主色面＋細線框
  const sheetH = box.max.y - box.min.y + 0.6, sheetW = box.max.z - box.min.z + 0.9;
  const sheet = new THREE.Group();
  const fillMat = new THREE.MeshBasicMaterial({color: acc, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false});
  const fill = new THREE.Mesh(new THREE.PlaneGeometry(sheetW, sheetH), fillMat);
  fill.rotation.y = Math.PI / 2;
  const lineMat = new THREE.LineBasicMaterial({color: acc, transparent: true, opacity: 0.9});
  const hw = sheetW / 2, hh = sheetH / 2;
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -hh, -hw), new THREE.Vector3(0, hh, -hw), new THREE.Vector3(0, hh, hw), new THREE.Vector3(0, -hh, hw)]), lineMat);
  // 地上一條細線：掃到哪裡
  const ground = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.005, -hw - 1.5), new THREE.Vector3(0, 0.005, hw + 1.5)]), lineMat);
  sheet.add(fill, frame);
  sheet.position.y = box.min.y + hh - 0.1;
  const sweep = new THREE.Group();
  sweep.add(sheet, ground);
  scene.add(sweep);

  const paint = () => {
    st.paint();
    acc.set(css('--accent'));
    fillMat.opacity = isDark() ? 0.1 : 0.07;
  };
  paint();
  ctx.onTheme(paint);

  // ---------- 字 ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy()}
    <div class="scanTag" id="scanTag"><b id="stNo">01</b><span id="stName"></span></div>
    <div class="layerbar" id="lbar">${V.LAYERS.map((L, i) => `<div class="lb" data-i="${i}"><em>0${i + 1}</em><b>${L.name[0]}</b><small>${L.ids.length} 個零件</small><i></i></div>`).join('')}</div>
    <div class="grip" id="grip" aria-label="拖曳掃描線"><i></i></div>
    ${HINT}`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const hint = $('.hintdown');
  const lbs = [...stage.querySelectorAll('.lb')];

  // ---------- 狀態：第 s 層正在被掃（0 = 整台；s 層以前都掃掉了） ----------
  let s = 0;
  const prog = new Spring(0, 26, 10.5); // 這一層掃了多少（0 → 1）
  let cur = 1; // 正在被切的層
  let drag = null;
  const setLayerState = () => {
    for (let L = 1; L <= NL; L++) {
      const c = cuts[L];
      const v = L < cur ? X1 - 1 : L > cur ? X0 + 1 : null;
      if (v != null) {
        c.plane.constant = v;
        c.U.uCut.value = v;
        c.U.uOn.value = 0;
      }
    }
  };
  const showUI = (j) => {
    lbs.forEach((b, i) => b.classList.toggle('done', i < j));
    lbs.forEach((b, i) => b.classList.toggle('on', i === Math.min(j, NL - 1)));
  };
  let pending = null;
  const go = (j) => {
    stage.querySelector('.copy').classList.toggle('away', j > 0);
    hint.classList.add('gone');
    if (Math.abs(prog.x - prog.to) > 0.002) return void (pending = j); // 這一層還在掃：掃完再接著
    if (j > s) {
      cur = s + 1;
      prog.x = 0;
      prog.to = 1;
    } else if (j < s) {
      cur = s;
      prog.x = 1;
      prog.to = 0;
    }
    prog.v = 0;
    setLayerState();
    showUI(j);
    setTimeout(() => j < NL - 1 && pg.i === j && hint.classList.remove('gone'), 2800);
  };
  const pg = pager(stage, {n: NL, onGo: go, sig: ctx.sig});
  lbs.forEach((b, i) => b.addEventListener('click', () => i !== pg.i && pg.go(pg.i + Math.sign(i - pg.i)), {signal: ctx.sig}));
  lbs[0].classList.add('on');
  setLayerState();
  setTimeout(() => hint.classList.remove('gone'), 1800);

  // 抓著線拖：左右移就是掃描的進度
  const grip = $('#grip');
  const xOnScreen = (x) => toScreen(new THREE.Vector3(x, box.min.y + 0.8, 0), camera, canvas).x;
  grip.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    grip.setPointerCapture(e.pointerId);
    drag = {x0: xOnScreen(X0), x1: xOnScreen(X1)};
    hint.classList.add('gone');
    grip.classList.add('hold');
  }, {signal: ctx.sig});
  grip.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    const k = (e.clientX - r.left - drag.x0) / (drag.x1 - drag.x0);
    prog.to = Math.max(0, Math.min(1, k));
  }, {signal: ctx.sig});
  const up = () => {
    if (!drag) return;
    drag = null;
    grip.classList.remove('hold');
    prog.to = prog.to > 0.5 ? 1 : 0; // 放手：過半就掃完這一層，不然退回去
  };
  grip.addEventListener('pointerup', up, {signal: ctx.sig});
  grip.addEventListener('pointercancel', up, {signal: ctx.sig});

  // ---------- 每一格 ----------
  const yaw = new Spring(0, 30, 10);
  let px = 0;
  stage.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') px = (e.clientX / innerWidth - 0.5) * 2;
  }, {signal: ctx.sig});
  const tgt = new THREE.Vector3();
  const stop = loop((dt, t) => {
    const k = prog.step(dt);
    // 一層掃完：換下一層準備被掃；退回去：這一層回來了
    if (!drag && Math.abs(prog.x - prog.to) < 0.002 && Math.abs(prog.v) < 0.02) {
      if (prog.to === 1 && cur < NL) {
        s = cur;
        cur = s + 1;
        prog.x = prog.to = 0;
        setLayerState();
        pg.set(s);
        showUI(s);
        if (pending != null) {
          const j = pending;
          pending = null;
          if (j !== s) pg.set(j), go(j);
        }
      } else if (prog.to === 0 && cur === s) {
        s = cur - 1;
        setLayerState();
        pg.set(s);
        showUI(s);
      }
    }
    const x = THREE.MathUtils.lerp(X0, X1, Math.max(0, Math.min(1, k)));
    const c = cuts[Math.min(cur, NL)];
    if (cur < NL) {
      c.plane.constant = x;
      c.U.uCut.value = x;
      c.U.uOn.value = k > 0.003 && k < 0.997 ? 1 : 0;
    }
    sweep.position.x = x;
    const vis = (k > 0.003 && k < 0.997) || !!drag;
    fillMat.visible = lineMat.visible = vis;
    // 鏡頭：左前方偏低，跟著掃描線慢慢往後移一點；滑鼠讓它微微轉
    yaw.to = px * 0.12;
    yaw.step(dt);
    const portrait = canvas.clientWidth / canvas.clientHeight < 0.8;
    const az = 2.2 + (RM.matches ? 0 : Math.sin(t * 0.13) * 0.06) + yaw.x;
    const dist = 23 * Math.max(1, 1.15 / camera.aspect);
    tgt.set(THREE.MathUtils.lerp(0.8, -0.8, smooth(k)), 1.5, 0);
    camera.position.set(tgt.x + Math.cos(az) * dist, 5.2, tgt.z + Math.sin(az) * dist * -1);
    camera.lookAt(tgt);
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (portrait) camera.setViewOffset(w, h, 0, h * 0.13, w, h);
    else camera.setViewOffset(w, h, w * 0.02, h * 0.12, w, h);
    renderer.render(scene, camera);
    // 掃描線上方的標籤、可以抓的把手
    const top = toScreen(new THREE.Vector3(x, box.max.y + 0.75, -hw), camera, canvas);
    const bot = toScreen(new THREE.Vector3(x, box.min.y + 0.5, hw), camera, canvas);
    const tag = $('#scanTag');
    const L = Math.min(cur, NL);
    tag.style.transform = `translate(${top.x}px, ${top.y}px)`;
    tag.classList.toggle('on', vis);
    $('#stNo').textContent = '0' + L;
    $('#stName').textContent = V.LAYERS[L - 1].name[0];
    const showGrip = cur < NL;
    grip.style.transform = `translate(${bot.x}px, ${bot.y}px)`;
    grip.classList.toggle('on', showGrip);
  });
  return {
    dispose() {
      stop();
      st.dispose();
    },
  };
}
