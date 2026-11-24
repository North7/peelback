// 剝剝看（Peelback）的共用介面：場景、鏡頭、一層一層拆、點零件、透視、燈光、名牌、語言切換。
// 每台車（bus/vehicle.js、plane/vehicle.js）只提供自己的模型、零件說明、層、兩顆專屬按鈕和每格要做的動畫。
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {createSound} from './sound.js';
import {L, Lp, H, HP, esc, getLang, setLang} from './i18n.js';
import {sysMenu, bindSys, ICON2, spring, scramble} from './ui.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const smooth = (x) => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
export const approach = (cur, want, rate, dt) => cur + (want - cur) * (1 - Math.exp(-dt * rate));

export const ICON = {
  explode: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  xray: '<svg viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  mute: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
  view: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4"/><path d="M20 12a8 8 0 0 1-14 5.3"/><path d="M6 21v-4h4"/></svg>',
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="0.6"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 17.5h6M10 20.5h4"/><path d="M12 2.8a6.2 6.2 0 0 0-3.6 11.3c.6.5 1 1.2 1 2v1.4h5.2v-1.4c0-.8.4-1.5 1-2A6.2 6.2 0 0 0 12 2.8z"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/></svg>',
};

const NUM = ['', '一', '二', '三', '四', '五', '六'];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const STR = {
  brand: ['剝剝看', 'Peelback'],
  explode: ['拆開', 'Take apart'],
  assemble: ['組回去', 'Put back'],
  xray: ['透視', 'X-ray'],
  xrayOff: ['不透視', 'Solid'],
  hint: ['用手指轉一轉、兩指放大，點零件聽它介紹', 'Drag to spin, pinch to zoom, tap a part to hear about it'],
  lights: ['燈光', 'Lights'],
  day: ['白天', 'Day'],
  night: ['晚上', 'Night'],
  allOn: ['全部打開', 'All on'],
  allOff: ['全部關掉', 'All off'],
  more: ['更多', 'More'],
};
// 燈的節奏：steady 一直亮、blink 方向燈、beacon 防撞燈（一秒閃一下）、strobe 閃光燈（連閃兩下）
const PATTERN = {
  steady: () => 1,
  blink: (t) => (t % 0.8 < 0.42 ? 1 : 0),
  beacon: (t) => (t % 1.1 < 0.14 ? 1 : 0),
  strobe: (t) => {
    const k = t % 1.3;
    return k < 0.05 || (k > 0.14 && k < 0.19) ? 1 : 0;
  },
};
const NIGHT = {bg: new THREE.Color('#0a0f1c'), ground: new THREE.Color('#141a26'), line: new THREE.Color('#3a4150'), moon: new THREE.Color('#9db2ff'), white: new THREE.Color('#fffaf0')};

/**
 * 啟動一台車。V 是車子的定義（見 bus/vehicle.js）。回傳 dispose()，換車時把整個場景收乾淨。
 * opts: {vehicles: [{id, name, icon}], onSwitch(id)}
 */
export function startApp(V, opts = {}) {
  const ac = new AbortController();
  const sig = {signal: ac.signal};
  let alive = true;
  const later = (fn, ms) => setTimeout(() => alive && fn(), ms);
  const app = document.getElementById('app');
  const $ = (s) => app.querySelector(s);
  const S = {
    exploded: false, layer: 0, variant: V.variants ? V.variants[0].id : null, xray: false, xrayK: 0, dimK: 0, selected: null, selT: 0,
    bounce: 0, lastInput: performance.now(), glow: null, glowT: 0, labelsOn: false,
  };
  const present = (id) => (V.present ? V.present(id, S.variant) : true);
  /** 零件在目前語言的文字：name（標題用）、spoken（句子裡用）、say、fact、other（另一個語言的名字）。 */
  const P = (id) => {
    const d = V.partText(id, S.variant);
    return getLang() === 'en'
      ? {name: cap(d.en), spoken: d.en, say: d.sayEn, fact: d.factEn, other: d.name}
      : {name: d.name, spoken: d.name, say: d.say, fact: d.fact, other: d.en};
  };

  // ---------- 介面 ----------
  const VEHS = opts.vehicles || [];
  app.innerHTML = `
<canvas id="gl"></canvas>
<header class="top">
  <div class="title">
    <div class="vhead">
      <button class="round back" id="backBtn">${ICON2.back}</button>
      <div class="vname"><small class="no">No.${opts.no || ''}</small>
        <button class="vtitle" id="infoBtn" aria-expanded="false"><b id="subTitle"></b>${ICON.info}</button></div>
    </div>
    <div class="facts" id="facts" hidden></div>
    <div id="extraTop"></div>
  </div>
  ${sysMenu({sound: false})}
</header>
<div class="drive" id="drive" hidden>
  ${(V.panel || []).map((r) => `<div><b id="${r.id}">0</b><span data-p="${r.id}"></span></div>`).join('')}
  ${V.panelNote ? '<p class="ff" id="panelNote"></p>' : ''}
</div>
<nav class="stack" id="stack"><span class="stack-ind" id="stackInd"></span></nav>
<div class="tag" id="tag" hidden><i></i><span></span></div>
<div class="labels" id="labels"></div>
<section class="card" id="card" hidden aria-live="polite">
  <div class="card-head">
    <h2 id="cName"></h2>
    <div class="card-btns">
      <button class="round sm" id="cClose">${ICON.close}</button>
    </div>
  </div>
  <p class="en" id="cEn"></p>
  <p class="say" id="cSayText"></p>
  <p class="fact" id="cFact"></p>
</section>
${
  V.LIGHTS
    ? `<section class="card sidecard lightcard" id="lightCard" hidden>
  <div class="card-head"><h2 data-t="lights"></h2><div class="card-btns"><button class="round sm" id="lClose">${ICON.close}</button></div></div>
  <div class="daynight" id="dayNight"><span class="seg-ind"></span><button data-n="0">${ICON.sun}<span data-t="day"></span></button><button data-n="1">${ICON.moon}<span data-t="night"></span></button></div>
  <div class="lrows">${V.LIGHTS.map((g) => `<button class="lrow" data-g="${g.id}" aria-pressed="false"><span class="lic" style="--lc:${g.color}"><svg viewBox="0 0 24 24">${g.icon}</svg></span><span class="lnm"></span><span class="sw"><i></i></span></button>`).join('')}</div>
  <button class="chip lall" id="lAll"><span></span></button>
</section>`
    : ''
}
<nav class="bar" id="bar">
  <button data-act="explode">${ICON.explode}<span></span></button>
  <button data-act="xray">${ICON.xray}<span></span></button>
  ${V.actions.map((a, i) => `<button data-act="${a.id}" class="${i ? 'extra' : ''}">${a.icon}<span></span></button>`).join('')}
  ${V.LIGHTS ? `<button data-act="lights" id="lightBtn" class="extra">${ICON.bulb}<i class="lit-dot"></i><span></span></button>` : ''}
  <button id="moreBtn" class="more" aria-expanded="false">${ICON2.more}<span data-t="more"></span></button>
</nav>
<div class="hint" id="hint">${ICON.view}<span data-t="hint"></span></div>
<div class="loading" id="loading"><div class="wheel"></div></div>
`;

  // ---------- 層和名牌 ----------
  const LAYERS = V.LAYERS;
  const NL = LAYERS.length;
  const ALL = NL + 1;
  const layerOf = {};
  LAYERS.forEach((ly, i) => ly.ids.forEach((id) => (layerOf[id] = i + 1)));
  const STACK = V.STACK;
  const pick = (item, k) => (S.variant && S.variant !== V.variants?.[0].id && item['ev' + cap(k)]) || item[k];
  const layerName = (i) => Lp(pick(LAYERS[i - 1], 'name'));
  const labelEls = {};
  V.LABEL_ORDER.forEach((id, i) => {
    const b = document.createElement('button');
    b.className = 'lbl';
    b.dataset.id = id;
    b.style.setProperty('--i', i);
    b.innerHTML = '<span class="in"><b></b><i></i></span>';
    $('#labels').appendChild(b);
    labelEls[id] = {el: b, w: 0, h: 0};
  });
  STACK.forEach((it, i) => {
    const b = document.createElement('button');
    b.dataset.ly = i;
    b.innerHTML = '<span class="ic"><svg viewBox="0 0 24 24"></svg></span><span class="nm"></span>';
    it.el = b;
    $('#stack').appendChild(b);
  });

  /** 所有看得到的字，照目前語言重新填一次（換語言、換柴油電動時呼叫）。 */
  function renderTexts() {
    for (const el of app.querySelectorAll('[data-t]')) el.innerHTML = HP(STR[el.dataset.t]);
    for (const b of app.querySelectorAll('#veh button')) b.querySelector('.nm').innerHTML = HP(VEHS.find((v) => v.id === b.dataset.veh).name);
    for (const r of V.panel || []) app.querySelector(`[data-p="${r.id}"]`).innerHTML = HP(r.label);
    if (V.panelNote) $('#panelNote').innerHTML = HP(V.panelNote);
    for (const b of app.querySelectorAll('[data-act]')) if (b._label) b.querySelector('span').innerHTML = HP(b._label);
    renderStack();
    for (const [id, Lb] of Object.entries(labelEls)) {
      Lb.el.querySelector('b').innerHTML = H(P(id).name);
      Lb.el.setAttribute('aria-label', P(id).name);
      Lb.w = 0;
    }
    $('#subTitle').innerHTML = HP(V.subtitle(S));
    $('#facts').innerHTML = V.facts(S);
    $('#stack').setAttribute('aria-label', L('拆到哪一層', 'Pick a layer'));
    $('#viewBtn').setAttribute('aria-label', L('回到正面', 'Reset view'));
    $('#backBtn').setAttribute('aria-label', L('回到展廳', 'Back to the gallery'));
    $('#cClose').setAttribute('aria-label', L('關閉', 'Close'));
    $('#gl').setAttribute('aria-label', L(`可以拆開的${Lp(V.name)} 3D 模型`, `3D ${Lp(V.name).toLowerCase()} you can take apart`));
    if (S.selected) fillCard(S.selected);
    ext.renderTexts?.();
    for (const g of LG) app.querySelector(`.lrow[data-g="${g.id}"] .lnm`).innerHTML = HP(g.name);
    if (V.LIGHTS) {
      $('#lAll > span').innerHTML = HP(LG.some((g) => !g.on) ? STR.allOn : STR.allOff);
      $('#lClose').setAttribute('aria-label', L('關閉', 'Close'));
    }
    for (const g of app.querySelectorAll('.veh, .langs, .daynight')) moveSegInd(g);
    requestAnimationFrame(resize);
  }
  function renderStack() {
    STACK.forEach((it, i) => {
      it.el.querySelector('svg').innerHTML = pick(it, 'icon');
      it.el.querySelector('.nm').innerHTML = HP(pick(it, 'name'));
      it.el.setAttribute('aria-label', i ? L(`第${NUM[i]}層：${layerName(i)}`, `Layer ${i}: ${layerName(i)}`) : Lp(pick(it, 'name')));
    });
  }
  const moveSegInd = (g) => {
    const on = g.querySelector('button.on');
    const ind = g.querySelector('.seg-ind');
    if (!on || !ind) return;
    ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    ind.style.width = on.offsetWidth + 'px';
    ind.style.height = on.offsetHeight + 'px';
  };

  // ---------- 主題色 ----------
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---------- 場景 ----------
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({canvas, antialias: true, powerPreference: 'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  {
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.75;
    pm.dispose();
  }
  const sun = new THREE.DirectionalLight('#fffaf0', 2.2);
  sun.position.set(...V.sun.pos);
  sun.castShadow = true;
  const E = V.sun.ext;
  Object.assign(sun.shadow.camera, {left: -E, right: E, top: E, bottom: -E, near: 1, far: 50});
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, new THREE.HemisphereLight('#ffffff', '#b9b2a6', 0.55));

  const groundMat = new THREE.ShaderMaterial({
    uniforms: {uG: {value: new THREE.Color()}, uL: {value: new THREE.Color()}, uBg: {value: new THREE.Color()}, uRoll: {value: 0}, uRoad: {value: 0}, uFade: {value: 0}},
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uG; uniform vec3 uL; uniform vec3 uBg; uniform float uRoll; uniform float uRoad; uniform float uFade; varying vec3 vW;
      void main(){
        float x = vW.x + uRoll;
        float m = 0.0;
        ${V.groundMarks}
        m *= uRoad;
        vec3 col = mix(uG, uL, m * 0.9);
        float d = length(vW.xz * vec2(${V.groundFade[0]}));
        gl_FragColor = vec4(mix(col, uBg, max(smoothstep(${V.groundFade[1]}, d), uFade)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const shadeMat = new THREE.ShadowMaterial({opacity: 0.22, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4});
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), shadeMat);
  shade.rotation.x = -Math.PI / 2;
  shade.position.y = 0.001;
  shade.receiveShadow = true;
  scene.add(shade);

  const model = V.build();
  scene.add(model.root);

  // ---- 後製：環境遮蔽（縫隙裡的軟陰影）＋燈的光暈 ----
  // 環境遮蔽計算時先把半透明的東西藏起來（變淡的外殼、玻璃、雲），不然會在它們後面多出一層灰影
  const target = new THREE.WebGLRenderTarget(4, 4, {type: THREE.HalfFloatType, samples: 4});
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const hidden = [];
  class Toggle extends Pass {
    constructor(fn) {
      super();
      this.needsSwap = false;
      this.fn = fn;
    }
    render() {
      this.fn();
    }
  }
  composer.addPass(
    new Toggle(() => {
      scene.traverse((o) => {
        if (o.visible && (o.isMesh || o.isInstancedMesh) && o.material?.transparent && (o.material.opacity < 0.95 || o.material.blending === THREE.AdditiveBlending)) {
          o.visible = false;
          hidden.push(o);
        }
      });
    }),
  );
  const gtao = new GTAOPass(scene, camera, 4, 4);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = 1;
  gtao.updateGtaoMaterial({radius: V.ao ?? 0.3, distanceExponent: 1, thickness: 1, scale: 1, samples: 16, distanceFallOff: 1, screenSpaceRadius: false});
  gtao.updatePdMaterial({lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 16});
  composer.addPass(gtao);
  composer.addPass(
    new Toggle(() => {
      for (const o of hidden) o.visible = true;
      hidden.length = 0;
    }),
  );
  const bloom = new UnrealBloomPass(new THREE.Vector2(4, 4), 0, 0.5, 4.5);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const accent = new THREE.Color();
  const bgCol = new THREE.Color();
  const DAY = {bg: new THREE.Color(), ground: new THREE.Color(), line: new THREE.Color()};
  scene.background = new THREE.Color();
  const applyTheme = () => {
    DAY.bg.set(css('--bg'));
    DAY.ground.set(css('--ground'));
    DAY.line.set(css('--road-line'));
    shadeMat.color.set(css('--shadow-ink'));
    accent.set(css('--accent'));
    applyNight(S.nightK || 0);
  };
  const hemi = scene.children.find((o) => o.isHemisphereLight);
  /** 白天到晚上：背景、地面、太陽變月光、環境光變暗、光暈變強。n 是 0（白天）到 1（晚上）。 */
  function applyNight(n) {
    scene.background.copy(DAY.bg).lerp(NIGHT.bg, n);
    bgCol.copy(scene.background);
    groundMat.uniforms.uG.value.copy(DAY.ground).lerp(NIGHT.ground, n);
    groundMat.uniforms.uL.value.copy(DAY.line).lerp(NIGHT.line, n);
    groundMat.uniforms.uBg.value.copy(scene.background);
    sun.intensity = 2.2 + (0.32 - 2.2) * n;
    sun.color.copy(NIGHT.white).lerp(NIGHT.moon, n);
    hemi.intensity = 0.55 + (0.07 - 0.55) * n;
    scene.environmentIntensity = 0.75 + (0.09 - 0.75) * n;
    // 白天只讓很亮的燈發光暈（白色烤漆在太陽下也很亮，門檻要高）；晚上門檻降低、光暈變強
    bloom.strength = 0.9 * n; // 白天不要光暈（車漆反光會暈開成一大片），晚上才讓燈發光
    bloom.enabled = n > 0.01;
    bloom.threshold = 4.5 + (1.0 - 4.5) * n;
  }
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme, sig);
  const themeObs = new MutationObserver(applyTheme);
  themeObs.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  addEventListener('peelback:theme', () => {
    applyTheme();
    composer.render();
  }, sig);

  // 每個零件自己的材質（才能各自發亮、變透明）
  for (const p of Object.values(model.parts)) {
    const cache = new Map();
    p.mats = [];
    for (const m of p.meshes) {
      const src = m.material;
      if (!cache.has(src)) {
        const c = src.clone();
        // 有自訂著色器的材質（汽車的輪拱挖洞）複製時要一起帶過去
        if (Object.prototype.hasOwnProperty.call(src, 'onBeforeCompile')) {
          c.onBeforeCompile = src.onBeforeCompile;
          c.customProgramCacheKey = src.customProgramCacheKey;
        }
        c.userData.base = {color: c.color ? c.color.clone() : null, emissive: c.emissive ? c.emissive.clone() : null, ei: c.emissiveIntensity ?? 0, opacity: c.opacity, transparent: c.transparent, depthWrite: c.depthWrite};
        cache.set(src, c);
        p.mats.push(c);
      }
      m.material = cache.get(src);
    }
  }
  // 每塊零件的中心（相對自己的原點），縮放時繞著中心縮
  const _box = new THREE.Box3();
  model.root.updateMatrixWorld(true);
  for (const p of model.pieces) {
    p.base = p.obj.position.clone();
    _box.makeEmpty().expandByObject(p.obj);
    const c = _box.isEmpty() ? new THREE.Vector3() : _box.getCenter(new THREE.Vector3());
    p.obj.parent.worldToLocal(c);
    p.off = c.sub(p.base);
    p.pres = present(p.id) ? 1 : 0;
    p.pv = 0;
    p.obj.visible = p.pres > 0;
  }

  // ---------- 鏡頭 ----------
  const C = V.cam;
  // 轉盤式：車子永遠是正的（不會歪、不會翻成側躺）。
  // 一指／左鍵左右拖＝繞著車轉，不限圈數；上下拖＝抬高或壓低視角，從正上方一路到正下方（看得到車底）。
  // 兩指捏＝放大縮小、兩指一起拖＝移動；電腦滾輪放大、右鍵拖移動。放手後會順著慣性滑一小段。
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.rotateSpeed = 0.75;
  controls.zoomSpeed = 0.9;
  controls.panSpeed = 0.7;
  controls.screenSpacePanning = true;
  controls.minPolarAngle = 0.03;
  controls.maxPolarAngle = Math.PI - 0.03;
  controls.minDistance = C.min;
  controls.maxDistance = C.max;
  controls.touches = {ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN};
  controls.mouseButtons = {LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN};
  // 手一碰就停下鏡頭的自動移動（回正面、對準零件），由手接手
  controls.addEventListener('start', () => {
    view.want = null;
    S.lastInput = performance.now();
  });
  // 很長的車（火車）：框一層、一個零件、標名牌時，只框最前面 C.frameLen 那一段（不然整列 300 公尺塞進畫面，什麼都看不清楚）
  // frameLen 可以是一個數字，或 {default, 層號或零件 id: 長度}（例如火車的動力層要框一整組 4 節）
  const clipBox = (box, key) => {
    const len = C.frameLen && typeof C.frameLen === 'object' ? (C.frameLen[key] ?? C.frameLen.default) : C.frameLen;
    if (len && !box.isEmpty() && box.max.x - box.min.x > len) box.min.x = box.max.x - len;
    return box;
  };
  const HOME_DIR = new THREE.Vector3(...C.home).normalize();
  const EXPLODE_DIR = new THREE.Vector3(...C.explode).normalize();
  const view = {want: null, wantTarget: new THREE.Vector3()};
  let frameTop = 0;
  let frameSide = 0;
  let frameBottom = 0;
  const fitDistance = (rv, rh = rv * 1.25) => {
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const h = canvas.clientHeight || innerHeight;
    const usable = Math.max(0.35, (h - frameTop - frameBottom) / h);
    const halfV = Math.atan(Math.tan(vfov / 2) * usable);
    const halfH = Math.atan(Math.tan(vfov / 2) * camera.aspect * 0.94 * (1 - frameSide / (canvas.clientWidth || innerWidth)));
    return Math.max(rv / Math.sin(halfV), rh / Math.sin(halfH));
  };
  function explodeLevel() {
    let s = 0;
    for (const p of model.pieces) s += p.x;
    return s / model.pieces.length;
  }
  const goHome = (instant = false) => {
    if (!instant && S.layer >= 1 && S.layer <= NL) return frameLayer(S.layer);
    const ex = explodeLevel();
    const d = fitDistance(C.r[0] + C.r[1] * ex, C.rh[0] + C.rh[1] * ex);
    view.wantTarget.set(...C.target(ex));
    const dir = ex > 0.5 ? EXPLODE_DIR : HOME_DIR;
    const pos = dir.clone().multiplyScalar(d).add(view.wantTarget);
    camera.up.set(0, 1, 0);
    if (instant) {
      camera.position.copy(pos);
      controls.target.copy(view.wantTarget);
    } else view.want = pos;
  };
  const resize = () => {
    if (!alive) return;
    const w = innerWidth;
    const h = innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    const top = $('.top').getBoundingClientRect();
    const bar = $('#bar').getBoundingClientRect();
    frameTop = top.bottom * 0.6;
    frameBottom = h - bar.top;
    const centre = (frameTop + (h - frameBottom)) / 2;
    // 層數列在右邊、左邊有說明卡片（例如比一比）時，畫面中心往空的那邊讓
    const st = $('#stack').getBoundingClientRect();
    const side = w > 620 && !$('#stack').classList.contains('away') ? st.width + 24 : 0;
    const sc = app.querySelector('.sidecard:not([hidden])');
    const left = w >= 900 && sc ? sc.getBoundingClientRect().right + 8 : 0;
    frameSide = side + left;
    if (w <= 620) {
      // 手機：層數點放在控制列正上方，畫面中心在標題和層數點中間
      const sTop = bar.top - 10 - st.height;
      $('#stack').style.top = sTop + 'px';
      frameBottom = h - sTop + 6;
      frameTop = Math.max(frameTop, $('.title').getBoundingClientRect().bottom + 8);
    } else $('#stack').style.top = '';
    const centreY = (frameTop + (h - frameBottom)) / 2;
    camera.setViewOffset(w, h, (side - left) / 2, h / 2 - centreY, w, h);
    camera.updateProjectionMatrix();
  };
  addEventListener(
    'resize',
    () => {
      resize();
      controls.handleResize?.();
      for (const g of app.querySelectorAll('.veh, .langs')) moveSegInd(g);
    },
    sig,
  );

  // ---------- 一層一層拆 ----------
  const maxOrder = Math.max(...model.pieces.map((p) => p.order));
  void maxOrder;
  const setLayer = (n) => {
    const prev = S.layer;
    S.layer = n;
    S.exploded = n > 0;
    for (const p of model.pieces) {
      const li = layerOf[p.id] || 1;
      const t = n === ALL || (n > 0 && li <= n) ? 1 : 0;
      if (t === p.target) continue;
      p.target = t;
      p.wait = REDUCED ? 0 : t ? ((p.order % 4) + (n === ALL ? li : 0)) * 0.06 : (NL - li) * 0.08;
    }
    setBtn('explode', n > 0, n > 0 ? STR.assemble : STR.explode);
    updateStack(n);
    if (n >= 1) $('#hint').classList.add('gone');
    if (S.selected && n >= 1 && n <= NL && layerOf[S.selected] !== n) select(null);
    later(() => (n >= 1 && n <= NL ? frameLayer(n) : goHome()), n > (prev || 0) ? 120 : 320);
  };
  const setExplode = (on) => setLayer(on ? ALL : 0);
  function updateStack(n) {
    const st = $('#stack');
    st.classList.toggle('away', n === ALL);
    const btns = [...st.querySelectorAll('button')];
    btns.forEach((b, i) => {
      b.classList.toggle('on', i === n);
      b.classList.toggle('done', n <= NL && i > 0 && i < n);
      b.setAttribute('aria-pressed', i === n);
    });
    const cur = btns[Math.min(n, NL)];
    if (cur && n <= NL) {
      const ind = $('#stackInd');
      ind.style.transform = `translate(${cur.offsetLeft}px, ${cur.offsetTop}px)`;
      ind.style.width = cur.offsetWidth + 'px';
      ind.style.height = cur.offsetHeight + 'px';
      cur.classList.remove('boing');
      void cur.offsetWidth;
      cur.classList.add('boing');
    }
  }
  /** 鏡頭框住這一層拆開後的零件：先把零件放到拆開的位置量大小，再放回去。 */
  function frameLayer(n) {
    const box = new THREE.Box3();
    for (const id of LAYERS[n - 1].ids.filter(present))
      for (const p of model.parts[id].pieces) {
        const pos = p.obj.position.clone();
        const rx = p.obj.rotation.x;
        p.obj.position.copy(p.base).add(p.vec);
        if (p.hinge) p.obj.rotation.x = p.hinge * 0.985;
        p.obj.updateMatrixWorld(true);
        box.expandByObject(p.obj);
        p.obj.position.copy(pos);
        p.obj.rotation.x = rx;
        p.obj.updateMatrixWorld(true);
      }
    clipBox(box, n);
    const c = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const dir = camera.position.clone().sub(controls.target).normalize();
    if (dir.y < 0.6) {
      const flat = Math.hypot(dir.x, dir.z) || 1;
      dir.x *= 0.8 / flat;
      dir.z *= 0.8 / flat;
      dir.y = 0.6;
    }
    dir.normalize();
    camera.up.set(0, 1, 0);
    const rv = (Math.max(size.y, size.z * 0.7, 1.2) * 0.75 + 0.6) * 1.15;
    const rh = (Math.max(size.x, size.z) * 0.55 + 0.6) * 1.15;
    view.wantTarget.copy(c);
    view.want = dir.multiplyScalar(fitDistance(rv, rh)).add(c);
  }
  /** 按鈕亮起來、換字；label 是 [中文, English]，換語言時會照著重填。 */
  function setBtn(act, on, label) {
    const b = $(`[data-act="${act}"]`);
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on);
    if (label) {
      b._label = label;
      b.querySelector('span').innerHTML = HP(label);
    }
    b.classList.remove('boing');
    void b.offsetWidth;
    b.classList.add('boing');
  }

  // ---------- 聲音和念出來 ----------
  const sound = createSound();
  const voices = {zh: null, en: null};
  const pickVoice = () => {
    const vs = speechSynthesis?.getVoices?.() || [];
    voices.zh = vs.find((v) => v.lang === 'zh-TW') || vs.find((v) => /zh[-_]TW|Hant/i.test(v.lang + v.name)) || vs.find((v) => v.lang.startsWith('zh')) || null;
    voices.en = vs.find((v) => v.lang === 'en-US') || vs.find((v) => v.lang.startsWith('en')) || null;
  };
  if ('speechSynthesis' in window) {
    pickVoice();
    speechSynthesis.addEventListener?.('voiceschanged', pickVoice, sig);
  }
  /** 念出來：Aron 覺得系統語音太機械（2026-11-23），先關掉，只留音效和字。要開回來把 SPEAK 改成 true。 */
  const SPEAK = false;
  const say = (text) => {
    if (!SPEAK || !sound.on || !('speechSynthesis' in window) || !text) return;
    speechSynthesis.cancel();
    const en = getLang() === 'en';
    const u = new SpeechSynthesisUtterance(text);
    u.lang = en ? 'en-US' : 'zh-TW';
    const v = en ? voices.en : voices.zh;
    if (v) u.voice = v;
    u.rate = en ? 0.95 : 0.92;
    u.pitch = 1.05;
    speechSynthesis.speak(u);
  };
  const sayPair = (zh, en) => say(L(zh, en));

  // ---------- 選零件 ----------
  const card = $('#card');
  const flyTo = (id) => {
    const box = new THREE.Box3();
    for (const pc of model.parts[id].pieces) box.expandByObject(pc.obj);
    clipBox(box, id);
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const dir = camera.position.clone().sub(controls.target).normalize();
    const now = camera.position.distanceTo(controls.target);
    const d = THREE.MathUtils.clamp(fitDistance(r * 1.4 + 1.6, r * 1.5 + 1.8), Math.min(9, now), now);
    view.wantTarget.copy(c);
    view.want = dir.multiplyScalar(d).add(c);
  };
  const hideSidecards = () => {
    let any = false;
    for (const c of app.querySelectorAll('.sidecard')) if (!c.hidden) (c.hidden = true), (any = true);
    app.querySelector('#lightBtn')?.classList.remove('on');
    if (any) requestAnimationFrame(resize);
  };
  function fillCard(id) {
    const d = P(id);
    $('#cName').innerHTML = H(d.name);
    $('#cEn').textContent = d.other;
    $('#cSayText').innerHTML = H(d.say);
    $('#cFact').innerHTML = H(d.fact);
    $('#tag span').innerHTML = H(d.name);
  }
  const speakPart = (id) => {
    const d = P(id);
    say(getLang() === 'en' ? `${d.name}. ${d.say}` : `${d.name}。${d.say}`);
  };
  const select = (id, {speak = true, fly = true} = {}) => {
    S.selected = id;
    S.selT = 0;
    S.bounce = 1;
    if (!id) {
      card.hidden = true;
      $('#tag').hidden = true;
      return;
    }
    hideSidecards();
    fillCard(id);
    card.hidden = false;
    $('#hint').classList.add('gone');
    card.classList.remove('pop');
    void card.offsetWidth;
    card.classList.add('pop');
    if (speak) speakPart(id);
    if (fly) flyTo(id);
  };
  $('#cClose').onclick = () => select(null);
  for (const [id, Lb] of Object.entries(labelEls))
    Lb.el.addEventListener('click', () => {
      sound.unlock();
      markInput();
      sound.pop(600);
      ext.onPick?.(id);
      select(id);
    });

  // ---------- 車子自己的部分 ----------
  const ctx = {
    THREE, scene, model, S, $, app, sig, later, say, sayPair, sound, select, setLayer, setBtn, layerOf, present, resize, goHome,
    groundMat, ground, shade, shadeMat, bgCol, renderStack, renderTexts: () => renderTexts(), P, explodeLevel, ICON, hideSidecards, NL,
    get lang() {
      return getLang();
    },
  };
  const ext = V.setup(ctx) || {};

  // ---------- 燈光 ----------
  // 燈的材質在模型裡標 userData.light（哪一組）、userData.lamp = {on, off}（亮和不亮的發光強度）；
  // 真的光源（照亮座椅、照尾翼的燈）標 userData.light；地上的光斑由車子給位置。
  const LG = (V.LIGHTS || []).map((d) => ({...d, on: false, k: 0, lv: 0, mats: [], lights: [], pools: []}));
  const lgById = Object.fromEntries(LG.map((g) => [g.id, g]));
  for (const p of Object.values(model.parts)) for (const m of p.mats) if (m.userData.light) lgById[m.userData.light]?.mats.push(m);
  model.root.traverse((o) => {
    if (o.isLight && o.userData.light && lgById[o.userData.light]) {
      lgById[o.userData.light].lights.push(o);
      o.userData.baseI = o.intensity;
      o.intensity = 0;
    }
  });
  {
    const pool = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.45, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    for (const pl of V.pools || []) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(pl.w, pl.l), new THREE.MeshBasicMaterial({map: pool, color: pl.color || '#fff3d6', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending}));
      m.position.set(pl.x, -pl.z, 0.004);
      m.rotation.z = pl.rot || 0;
      m.userData.peak = pl.peak ?? 0.55;
      ground.add(m);
      lgById[pl.group]?.pools.push(m);
    }
  }
  const anyLight = () => LG.some((g) => g.on);
  let lightToggle = () => {};
  function setNight(on, {quiet = false} = {}) {
    if (!V.LIGHTS || S.night === on) return;
    S.night = on;
    for (const b of app.querySelectorAll('#dayNight button')) b.classList.toggle('on', +b.dataset.n === (on ? 1 : 0));
    moveSegInd($('#dayNight'));
    if (!quiet) sayPair(on ? '天黑了，燈光看得比較清楚。' : '天亮了。', on ? 'It’s night now, so the lights are easy to see.' : 'It’s daytime again.');
  }
  /** 開關一組燈。第一次開燈時自動變晚上。 */
  function setLight(id, on, {quiet = false, focus = true, night = true} = {}) {
    const g = lgById[id];
    if (!g || g.on === on) return;
    g.on = on;
    const row = app.querySelector(`.lrow[data-g="${id}"]`);
    row.classList.toggle('on', on);
    row.setAttribute('aria-pressed', on);
    $('#lightBtn').classList.toggle('lit', anyLight());
    $('#lAll > span').innerHTML = HP(LG.some((x) => !x.on) ? STR.allOn : STR.allOff);
    let pre = '';
    if (on && night && !S.night) {
      setNight(true, {quiet: true});
      pre = L('天黑了。', 'It’s getting dark. ');
    }
    if (!quiet) say(on ? pre + L(`${Lp(g.name)}。${Lp(g.say)}`, `${Lp(g.name)}. ${Lp(g.say)}`) : L(`關掉${Lp(g.name)}。`, `${Lp(g.name)} off.`));
    if (on && focus && S.layer === 0) focusLights(g);
  }
  /** 鏡頭轉過去看這組燈（燈的位置平均，距離照燈分布多散）。 */
  function focusLights(g) {
    const box = new THREE.Box3();
    for (const p of Object.values(model.parts)) for (const mesh of p.meshes) if (g.mats.includes(mesh.material)) box.expandByObject(mesh);
    if (box.isEmpty()) return;
    const c = box.getCenter(new THREE.Vector3());
    const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2.5);
    const dir = (g.view ? new THREE.Vector3(...g.view) : camera.position.clone().sub(controls.target)).normalize();
    view.wantTarget.copy(c);
    view.want = dir.multiplyScalar(THREE.MathUtils.clamp(fitDistance(r * 0.85 + 1.2, r * 0.95 + 1.4), 5, 26)).add(c);
  }
  ctx.setLight = setLight;
  /** 示範用：鏡頭飛到某一點（世界座標），dist 是離多遠，dir 不給就用現在的方向 */
  ctx.look = (target, dist, dir) => {
    view.wantTarget.set(...target);
    const d = (dir ? new THREE.Vector3(...dir) : camera.position.clone().sub(controls.target)).normalize();
    view.want = d.multiplyScalar(dist).add(view.wantTarget);
  };
  ctx.setNight = setNight;
  if (V.LIGHTS) {
    S.night = false;
    S.nightK = 0;
    $('#dayNight button[data-n="0"]').classList.add('on');
    lightToggle = () => {
      const lc = $('#lightCard');
      if (lc.hidden) {
        hideSidecards();
        select(null);
        lc.hidden = false;
        $('#lightBtn').classList.add('on');
        lc.classList.remove('pop');
        void lc.offsetWidth;
        lc.classList.add('pop');
        requestAnimationFrame(() => {
          resize();
          moveSegInd($('#dayNight'));
        });
        sound.pop(600);
      } else hideSidecards();
    };
    if (!S.lightsInit) setBtn('lights', false, STR.lights);
    $('#lClose').onclick = () => hideSidecards();
    for (const b of app.querySelectorAll('#dayNight button'))
      b.addEventListener('click', () => {
        sound.unlock();
        setNight(b.dataset.n === '1');
      });
    for (const b of app.querySelectorAll('.lrow'))
      b.addEventListener('click', () => {
        sound.unlock();
        sound.pop(b.classList.contains('on') ? 440 : 680);
        setLight(b.dataset.g, !lgById[b.dataset.g].on);
      });
    $('#lAll').onclick = () => {
      sound.unlock();
      const on = LG.some((g) => !g.on);
      for (const g of LG) setLight(g.id, on, {quiet: true, focus: false});
      sound.pop(on ? 700 : 420);
      sayPair(on ? '燈全部打開了！' : '燈全部關掉了。', on ? 'All the lights are on!' : 'All the lights are off.');
      if (on && S.layer === 0) goHome();
    };
  }

  // ---------- 按鈕 ----------
  const actions = {
    explode: () => {
      const n = S.layer ? 0 : 1;
      setLayer(n);
      sound.whoosh(!!n);
      if (n) sayPair(`第一層，${layerName(1)}。點名字聽介紹，旁邊可以選要拆到哪一層。`, `Layer one: ${layerName(1)}. Tap a name to hear about it, or pick a layer on the side.`);
      else sayPair('組回去囉！', 'All put back together!');
    },
    xray: () => {
      S.xray = !S.xray;
      setBtn('xray', S.xray, S.xray ? STR.xrayOff : STR.xray);
      sound.pop(S.xray ? 660 : 440);
      if (S.xray) sayPair('看看裡面有什麼。', 'Let’s see what’s inside.');
    },
    lights: () => lightToggle(),
    ...ext.handlers,
  };
  setBtn('explode', false, STR.explode);
  setBtn('xray', false, STR.xray);
  for (const a of V.actions) setBtn(a.id, false, a.label);
  for (const b of app.querySelectorAll('[data-act]')) {
    b.classList.remove('boing');
    b.addEventListener('click', () => {
      sound.unlock();
      actions[b.dataset.act]();
    });
  }
  $('#viewBtn').onclick = () => {
    sound.unlock();
    goHome();
    $('#viewBtn svg').classList.remove('spin');
    void $('#viewBtn').offsetWidth;
    $('#viewBtn svg').classList.add('spin');
  };
  $('#infoBtn').onclick = () => {
    const f = $('#facts');
    f.hidden = !f.hidden;
    $('#infoBtn').setAttribute('aria-expanded', !f.hidden);
    requestAnimationFrame(resize);
  };
  for (const b of app.querySelectorAll('#stack button'))
    b.addEventListener('click', () => {
      sound.unlock();
      markInput();
      const n = +b.dataset.ly;
      if (n === S.layer) return;
      sound.whoosh(n > S.layer);
      setLayer(n);
      say(Lp(pick(STACK[n], 'say')));
    });
  // 換車、換語言：分段按鈕，底塊用彈簧滑過去
  $('#backBtn').onclick = () => {
    sound.unlock();
    opts.onHome?.();
  };
  bindSys(app, {sig});
  // 手機：「更多」把收起來的按鈕（第二個動作、燈光）從控制列上面長出來
  const bar = $('#bar');
  $('#moreBtn').onclick = () => {
    sound.unlock();
    const open = !bar.classList.contains('expanded');
    bar.classList.toggle('expanded', open);
    $('#moreBtn').setAttribute('aria-expanded', String(open));
    if (open) for (const [i, b] of [...bar.querySelectorAll('.extra')].entries()) spring(b, [{opacity: 0, transform: 'translateY(10px) scale(.8)'}, {opacity: 1, transform: 'none'}], 480, i * 40);
    requestAnimationFrame(resize);
  };
  for (const b of bar.querySelectorAll('.extra')) b.addEventListener('click', () => {
    if (innerWidth <= 620) later(() => { bar.classList.remove('expanded'); $('#moreBtn').setAttribute('aria-expanded', 'false'); requestAnimationFrame(resize); }, 250);
  });
  for (const b of app.querySelectorAll('#langs button')) {
    b.classList.toggle('on', b.dataset.l === getLang());
    b.addEventListener('click', () => {
      if (b.dataset.l === getLang()) return;
      sound.unlock();
      for (const x of app.querySelectorAll('#langs button')) x.classList.toggle('on', x === b);
      moveSegInd($('#langs'));
      speechSynthesis?.cancel();
      sound.pop(560);
      scramble(app, () => {
        setLang(b.dataset.l);
        renderTexts();
      });
    });
  }

  // ---------- 點零件 ----------
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down = null;
  function markInput() {
    S.lastInput = performance.now();
    view.want = null; // 使用者一碰，就停掉正在飛的鏡頭，不跟手指搶
    $('#hint').classList.add('gone');
  }
  canvas.addEventListener('pointerdown', (e) => {
    down = {x: e.clientX, y: e.clientY, t: performance.now()};
    markInput();
    sound.unlock();
  });
  canvas.addEventListener('wheel', markInput, {passive: true});
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 500;
    down = null;
    if (moved > 10 || !quick) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObject(model.root, true);
    const hit = hits.find((h) => {
      const id = h.object.userData.part;
      if (!id || !h.object.visible) return false;
      if ((model.parts[id].lg || 0) > 0.5) return false; // 前幾層已經變淡，點不到
      if (!present(id)) return false;
      return !(S.xrayK > 0.5 && (V.XRAY_K[id] || 0) >= 1); // 透視時穿過外殼，點得到裡面
    });
    const id = hit?.object.userData.part || null;
    if (id) {
      sound.pop(id === S.selected ? 520 : 600);
      ext.onPick?.(id);
      select(id === S.selected ? null : id);
    } else select(null);
  });

  // ---------- 動畫 ----------
  const tmpBox = new THREE.Box3();
  const tmpV = new THREE.Vector3();
  const clock = new THREE.Clock();
  const perf = {n: 0, sum: 0};
  let raf = 0;
  function tick() {
    if (!alive) return;
    const dt = Math.min(clock.getDelta(), 1 / 20);
    const now = performance.now();
    // 拆開：每塊一個彈簧，可以中途被打斷
    for (const p of model.pieces) {
      if (p.wait > 0) p.wait -= dt;
      else {
        const k = REDUCED ? 400 : 120;
        const c = REDUCED ? 40 : 15;
        p.v += (k * (p.target - p.x) - c * p.v) * dt;
        p.x += p.v * dt;
      }
    }
    S.xrayK += ((S.xray ? 1 : 0) - S.xrayK) * (1 - Math.exp(-dt * 8));
    // 有、沒有這個零件（柴油／電動）：用彈簧縮小消失、或從中心彈出來
    const bounceS = 1 + 0.04 * Math.sin((1 - S.bounce) * Math.PI * 3) * S.bounce;
    for (const p of model.pieces) {
      const want = present(p.id) ? 1 : 0;
      if (p.pwait > 0) p.pwait -= dt;
      else {
        p.pv += ((REDUCED ? 400 : 170) * (want - p.pres) - (REDUCED ? 40 : 16) * p.pv) * dt;
        p.pres += p.pv * dt;
        if (want === 0 && p.pres < 0.02) (p.pres = 0), (p.pv = 0);
      }
      const sc = Math.max(0.0001, p.pres) * (p.id === S.selected ? bounceS : 1);
      p.obj.visible = p.pres > 0.01;
      p.obj.scale.setScalar(sc);
      p.obj.position.copy(p.base).addScaledVector(p.vec, p.x).addScaledVector(p.off, 1 - sc);
      if (p.hinge) p.obj.rotation.x = p.hinge * 0.985 * Math.max(0, p.x);
    }
    const ex = explodeLevel();
    shadeMat.opacity = 0.22 * (1 - 0.65 * smooth(S.nightK || 0));
    ext.update?.(dt, ex);
    // 白天／晚上、每組燈的亮度（閃的燈照節奏）
    if (V.LIGHTS) {
      S.nightK = approach(S.nightK, S.night ? 1 : 0, 2.2, dt);
      applyNight(smooth(S.nightK));
      const t = now / 1000;
      for (const g of LG) {
        g.k = approach(g.k, g.on ? 1 : 0, 10, dt);
        const want = g.k * PATTERN[g.mode || 'steady'](t + (g.phase || 0));
        g.lv = g.mode && g.mode !== 'steady' ? approach(g.lv, want, 40, dt) : want;
        for (const l of g.lights) l.intensity = l.userData.baseI * g.lv;
        for (const m of g.pools) m.material.opacity = m.userData.peak * g.lv * (0.35 + 0.65 * smooth(S.nightK));
      }
    }

    // 材質：選中的零件輕輕發亮，其他淡掉；透視時外殼變淡；一層一層拆時，拆過的層幾乎透明、還沒輪到的稍微淡
    S.selT += dt;
    S.bounce = Math.max(0, S.bounce - dt * 2.2);
    S.glowT = Math.max(0, S.glowT - dt);
    S.dimK += ((S.selected || S.glowT > 0 ? 1 : 0) - S.dimK) * (1 - Math.exp(-dt * 6));
    const pulse = 0.05 + 0.06 * (0.5 + 0.5 * Math.sin(S.selT * 3.2));
    const inLy = S.layer >= 1 && S.layer <= NL;
    for (const p of Object.values(model.parts)) {
      const sel = p.id === S.selected || (!S.selected && S.glowT > 0 && S.glow && S.glow.includes(p.id));
      let ghost = (V.XRAY_K[p.id] || 0) * S.xrayK;
      const li = layerOf[p.id] || 1;
      p.lg = (p.lg || 0) + ((inLy && li < S.layer ? 1 : 0) - (p.lg || 0)) * (1 - Math.exp(-dt * 5));
      p.fg = (p.fg || 0) + ((inLy && li > S.layer ? 1 : 0) - (p.fg || 0)) * (1 - Math.exp(-dt * 5));
      ghost = Math.max(ghost, 0.96 * p.lg, 0.45 * p.fg);
      if (!sel) ghost = 1 - (1 - ghost) * (1 - 0.5 * S.dimK);
      for (const m of p.mats) {
        const b = m.userData.base;
        const lamp = m.userData.lamp;
        const lv = lamp ? lgById[m.userData.light]?.lv || 0 : 0;
        if (lamp && m.emissiveMap) m.emissiveIntensity = lamp.off + (lamp.on - lamp.off) * lv;
        else if (m.emissive && b.emissive && !m.emissiveMap) {
          m.emissive.copy(b.emissive);
          const ei = lamp ? lamp.off + (lamp.on - lamp.off) * lv : b.ei;
          if (sel) m.emissive.addScalar(pulse / Math.max(0.2, ei));
          m.emissiveIntensity = ei;
        }
        if (b.color && m.blending !== THREE.AdditiveBlending) m.color.copy(b.color).lerp(bgCol, sel ? 0 : 0.62 * S.dimK);
        const tr = b.transparent || ghost > 0.01;
        if (m.transparent !== tr) {
          m.transparent = tr;
          m.needsUpdate = true;
        }
        m.opacity = b.opacity * (1 - ghost * 0.86);
        m.depthWrite = ghost > 0.01 ? false : b.depthWrite;
      }
      for (const mm of p.meshes) mm.castShadow = ghost < 0.5;
    }

    // 鏡頭
    if (view.want) {
      const k = 1 - Math.exp(-dt * 3.2);
      camera.position.lerp(view.want, k);
      controls.target.lerp(view.wantTarget, k);
      if (camera.position.distanceTo(view.want) < 0.05) view.want = null;
    }
    if (!REDUCED && now - S.lastInput > 25000 && !view.want) {
      tmpV.copy(camera.position).sub(controls.target).applyAxisAngle(camera.up, dt * 0.1);
      camera.position.copy(controls.target).add(tmpV);
    }
    controls.update();

    // 名牌：拆到某一層時標那一層；有東西在亮（比一比、動翅膀）時標亮的那幾個
    let lx = 0;
    if (inLy) {
      const ps = LAYERS[S.layer - 1].ids.filter(present).flatMap((id) => model.parts[id].pieces);
      lx = ps.length ? ps.reduce((a, p) => a + p.x, 0) / ps.length : 0;
    }
    const labelsOn = (lx > 0.8 || S.glowT > 0);
    if (labelsOn !== S.labelsOn) {
      S.labelsOn = labelsOn;
      $('#labels').classList.toggle('on', labelsOn);
    }
    if (labelsOn) placeLabels();
    const tag = $('#tag');
    if (S.selected && !S.labelsOn) {
      tmpBox.makeEmpty();
      for (const pc of model.parts[S.selected].pieces) tmpBox.expandByObject(pc.obj);
      clipBox(tmpBox, S.selected);
      tmpBox.getCenter(tmpV);
      tmpV.y = tmpBox.max.y;
      tmpV.project(camera);
      tag.hidden = tmpV.z > 1;
      tag.style.transform = `translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px, ${(-tmpV.y * 0.5 + 0.5) * innerHeight}px)`;
    } else tag.hidden = true;

    composer.render();
    // 慢的裝置自動降級：先關環境遮蔽，再降解析度
    if (perf.n < 150) {
      perf.n++;
      if (perf.n > 30) perf.sum += dt;
      if (perf.n === 150) {
        const avg = perf.sum / 120;
        if (avg > 1 / 40) gtao.enabled = false;
        if (avg > 1 / 28) {
          renderer.setPixelRatio(1);
          resize();
        }
      }
    }
    raf = requestAnimationFrame(tick);
  }

  // 名牌位置：零件最靠近鏡頭的那一塊的頂端，往上拉一條細線；疊到了就把線拉長再試，還是疊到就先藏起來
  const labelBox = new THREE.Box3();
  const labelC = new THREE.Vector3();
  const STEMS = [16, 46, 76];
  const occRay = new THREE.Raycaster();
  const occDir = new THREE.Vector3();
  let occFrame = 0;
  const occluded = {};
  function placeLabels() {
    const checkOcc = occFrame++ % 8 === 0;
    const W = innerWidth;
    const Hh = innerHeight;
    const taken = [];
    const block = (el) => {
      if (!el || el.hidden) return;
      const r = el.getBoundingClientRect();
      if (r.width) taken.push({x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12});
    };
    block($('.title'));
    block($('.tools'));
    block($('#bar'));
    block(card);
    block($('#drive'));
    block($('#lightCard'));
    block($('#stack'));
    for (const c of app.querySelectorAll('.sidecard')) block(c);
    const hit = (a) => taken.some((b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y);
    const camPos = camera.position;
    for (const id of V.LABEL_ORDER) {
      const Lb = labelEls[id];
      const show = S.glowT > 0 && S.glow ? S.glow.includes(id) : layerOf[id] === S.layer;
      if (!show || !present(id)) {
        Lb.el.classList.add('off');
        continue;
      }
      if (!Lb.w) {
        Lb.w = Lb.el.querySelector('.in').offsetWidth;
        Lb.h = Lb.el.querySelector('b').offsetHeight;
      }
      let best = null;
      let bestD = Infinity;
      // 標在離鏡頭最近、而且夠大的那個實體上（一組零件分好幾塊時，整組的中心可能落在空地上）
      let big = 0;
      for (const m of model.parts[id].meshes) {
        if (!m.visible || !m.parent?.visible) continue;
        clipBox(labelBox.makeEmpty().expandByObject(m), id);
        if (!labelBox.isEmpty()) big = Math.max(big, labelBox.getSize(labelC).length());
      }
      for (const m of model.parts[id].meshes) {
        if (!m.visible) continue;
        clipBox(labelBox.makeEmpty().expandByObject(m), id);
        if (labelBox.isEmpty() || labelBox.getSize(labelC).length() < big * 0.35) continue;
        labelBox.getCenter(labelC);
        const d = labelC.distanceToSquared(camPos);
        if (d < bestD) {
          bestD = d;
          best = [labelC.x, labelBox.max.y, labelC.z];
        }
      }
      if (best && checkOcc) {
        tmpV.set(...best);
        occDir.copy(tmpV).sub(camPos);
        const dist = occDir.length();
        occRay.set(camPos, occDir.normalize());
        occRay.far = dist - 0.05;
        const h = occRay.intersectObject(model.root, true).find((x) => x.object.visible && x.object.userData.part && x.object.userData.part !== id && layerOf[x.object.userData.part] !== layerOf[id] && !(x.object.material.transparent && x.object.material.opacity < 0.9));
        occluded[id] = !!h && dist - h.distance > 0.6;
      }
      let ok = false;
      if (best && !occluded[id]) {
        tmpV.set(...best).project(camera);
        const sx = (tmpV.x * 0.5 + 0.5) * W;
        const sy = (-tmpV.y * 0.5 + 0.5) * Hh;
        if (tmpV.z < 1 && sx > 8 && sx < W - 8 && sy > 8 && sy < Hh - 8) {
          for (const stem of STEMS) {
            const r = {x: sx - Lb.w / 2 - 3, y: sy - stem - Lb.h - 3, w: Lb.w + 6, h: Lb.h + 6};
            if (r.y < 4 || r.x < 4 || r.x + r.w > W - 4 || hit(r)) continue;
            taken.push(r);
            Lb.el.style.transform = `translate(${sx}px, ${sy}px)`;
            Lb.el.style.setProperty('--stem', stem + 'px');
            ok = true;
            break;
          }
        }
      }
      Lb.el.classList.toggle('off', !ok);
      Lb.el.classList.toggle('sel', id === S.selected);
    }
    $('#labels').classList.toggle('has-sel', !!S.selected);
  }

  // ---------- 開始 ----------
  renderTexts();
  updateStack(0);
  resize();
  goHome(true);
  renderer
    .compileAsync(scene, camera)
    .catch(() => {})
    .finally(() => {
      if (!alive) return;
      $('#loading').classList.add('done');
      later(() => $('#loading')?.remove(), 600);
      raf = requestAnimationFrame(tick);
      later(() => $('#hint').classList.add('gone'), 9000);
    });
  window.__BUS = {S, actions, select, bus: model, camera, controls, goHome, setLayer};

  return {
    dispose() {
      alive = false;
      cancelAnimationFrame(raf);
      ac.abort();
      themeObs.disconnect();
      controls.dispose();
      speechSynthesis?.cancel();
      sound.dispose?.();
      ext.dispose?.();
      scene.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [].concat(o.material || [])) {
          for (const v of Object.values(m)) if (v?.isTexture) v.dispose();
          m.dispose();
        }
      });
      composer.dispose?.();
      target.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      app.innerHTML = '';
    },
  };
}
export {L, Lp, H, HP, esc};
