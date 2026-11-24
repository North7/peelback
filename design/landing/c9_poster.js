// 概念 9：撕開海報。首屏是一張紙色的海報（字是真的資料），右下角翹起來、偶爾掀一下；
// 抓著角往左上拉，紙沿著一條摺線捲起來（圓柱彎曲＋背面＋捲起來的陰影），拉過一半放手就整張撕掉，
// 底下是 3D 的公車；點一下或往下滑，公車也一層一層拆開。左下角可以把海報貼回去。
import {THREE, loadVehicle, makeStage, Spring, pager, loop, css, isDark, RM, smooth, heroCopy, INFO, ORDER, VEH} from './stage.js';

const VERT = `
uniform vec2 uC; uniform vec2 uM; uniform float uR;
varying vec2 vUv; varying float vTh; varying float vD;
void main(){
  vUv = uv;
  vec3 p = position;
  vec2 n = uC - uM;
  float L = length(n);
  n = L > 0.001 ? n / L : vec2(0.7071, -0.7071);
  vec2 F = (uC + uM) * 0.5;
  float d = dot(p.xy - F, n);
  vD = d;
  vTh = 0.0;
  if (d > 0.0 && L > 0.001) {
    float PR = 3.14159265 * uR;
    if (d < PR) {
      float th = d / uR;
      p.xy = p.xy - n * d + n * uR * sin(th);
      p.z = uR * (1.0 - cos(th));
      vTh = th;
    } else {
      p.xy = p.xy - n * d - n * (d - PR);
      p.z = 2.0 * uR;
      vTh = 3.14159265;
    }
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const FRAG = `
uniform sampler2D uTex; uniform vec3 uBack; uniform float uR; uniform float uLift;
varying vec2 vUv; varying float vTh; varying float vD;
void main(){
  vec3 col;
  if (gl_FrontFacing) {
    col = texture2D(uTex, vUv).rgb;
    col *= 1.0 - 0.22 * sin(clamp(vTh, 0.0, 3.14159)) ;
    // 捲起來的紙壓在海報上的影子（摺線前面一小段）
    float sh = vD < 0.0 ? exp(vD / (uR * 1.6)) : 0.0;
    col *= 1.0 - 0.28 * sh * uLift;
  } else {
    // 背面：紙的背面，透一點點正面的字（鏡像）
    vec3 t = texture2D(uTex, vUv).rgb;
    col = mix(uBack, uBack * (0.9 + 0.1 * t), 0.5);
    float s = sin(clamp(vTh, 0.0, 3.14159));
    col *= 0.78 + 0.3 * s;
    col += 0.06 * pow(s, 8.0);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;
// 撕開的地方，捲起來的紙在下面的 3D 上投一條淡淡的影子
const SH_FRAG = `
uniform vec2 uC; uniform vec2 uM; uniform float uR; uniform float uK;
varying vec2 vP;
void main(){
  vec2 n = uC - uM; float L = length(n);
  if (L < 0.001) discard;
  n /= L;
  float d = dot(vP - (uC + uM) * 0.5, n);
  if (d < 0.0) discard;
  float a = 0.32 * exp(-d / (uR * 2.2)) * uK;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;

async function drawPoster(w, h, pr) {
  const W = Math.round(w * pr), H = Math.round(h * pr);
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const g = cv.getContext('2d');
  const dark = isDark();
  const ink = css('--ink'), muted = css('--muted'), acc = css('--accent'); // 網站的顏色
  const paper = dark ? '#151618' : '#f3f1ec';
  try {
    await Promise.all([document.fonts.load('900 200px "Noto Sans TC"', '剝看把真的車一層開'), document.fonts.load('500 20px "JetBrains Mono"'), document.fonts.load('700 20px "Noto Sans TC"', '台北客運低地板公車星宇航空特斯拉台灣高鐵'), document.fonts.load('800 20px "Inter Tight"')]);
  } catch {}
  g.scale(pr, pr);
  g.fillStyle = paper;
  g.fillRect(0, 0, w, h);
  const phone = w < 700;
  const gut = phone ? 22 : Math.min(56, Math.max(22, w * 0.04));
  // 細線框：像印刷品的裁切線
  g.strokeStyle = ink;
  g.globalAlpha = 0.14;
  g.lineWidth = 1;
  const top = phone ? 76 : 86;
  g.beginPath();
  g.moveTo(gut, top);
  g.lineTo(w - gut, top);
  g.stroke();
  g.globalAlpha = 1;
  // 右上：編號
  g.font = '500 11px "JetBrains Mono", monospace';
  g.fillStyle = muted;
  g.textAlign = 'right';
  g.fillText('No.01 — 04', w - gut - 60, phone ? 34 : 38);
  g.textAlign = 'left';
  // 大字
  let big = phone ? Math.min(w * 0.3, 128) : Math.min(w * 0.17, h * 0.3, 260);
  g.fillStyle = ink;
  g.font = `900 ${big}px "Noto Sans TC", sans-serif`;
  // 三個字加右上角的小方塊要放得進左右的留白
  const fitW = g.measureText('剝剝看').width + big * 0.26;
  if (fitW > w - gut * 2) {
    big *= (w - gut * 2) / fitW;
    g.font = `900 ${big}px "Noto Sans TC", sans-serif`;
  }
  g.textBaseline = 'alphabetic';
  const y0 = top + big * 1.05;
  g.fillText('剝剝看', gut - big * 0.04, y0);
  // 「看」的右上角：主色的小方塊（和標誌最上面那片同一個顏色）
  const tw = g.measureText('剝剝看').width;
  g.fillStyle = acc;
  g.fillRect(gut + tw + big * 0.06, y0 - big * 0.78, big * 0.16, big * 0.16);
  g.fillStyle = ink;
  g.font = `800 ${phone ? 22 : Math.min(40, big * 0.18)}px "Inter Tight", sans-serif`;
  g.fillText('Peelback', gut, y0 + (phone ? 40 : 56));
  g.font = `700 ${phone ? 17 : 20}px "Noto Sans TC", sans-serif`;
  g.fillText('把真的車，一層一層剝開', gut, y0 + (phone ? 72 : 96));
  // 下面：四台的清單（真的長度、零件數）
  const rowH = phone ? 40 : 44;
  const y1 = h - (phone ? 92 : 96) - rowH * 4;
  g.globalAlpha = 0.14;
  g.strokeStyle = ink;
  for (let i = 0; i <= 4; i++) {
    g.beginPath();
    g.moveTo(gut, y1 + i * rowH);
    g.lineTo(w - gut, y1 + i * rowH);
    g.stroke();
  }
  g.globalAlpha = 1;
  const colX = phone ? [gut, gut + 40, w - gut] : [gut, gut + 64, w * 0.62, w - gut];
  ORDER.forEach((id, i) => {
    const I = INFO[id];
    const y = y1 + i * rowH + rowH * 0.62;
    g.font = '500 11px "JetBrains Mono", monospace';
    g.fillStyle = acc;
    g.textAlign = 'left';
    g.fillText(I.no, colX[0], y);
    g.font = `700 ${phone ? 14 : 15}px "Noto Sans TC", sans-serif`;
    g.fillStyle = ink;
    g.fillText(`${I.brand}・${I.name}`, colX[1], y);
    g.font = '500 12px "JetBrains Mono", monospace';
    g.fillStyle = muted;
    g.textAlign = 'right';
    if (phone) g.fillText(`${I.len} m`, colX[2], y);
    else {
      g.textAlign = 'left';
      g.fillText(`${I.len} m`, colX[2], y);
      g.textAlign = 'right';
      g.fillText(`${VEH[id].LAYERS.length} 層・${I.parts} 個零件`, colX[3], y);
    }
  });
  g.textAlign = 'left';
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export default async function run(stage, ctx) {
  const veh = await loadVehicle('bus');
  if (!ctx.alive()) return;
  const {model, layerOf} = veh;
  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  stage.append(canvas);
  const st = makeStage(canvas, {fov: 30, ext: 10});
  const {scene, camera, renderer} = st;
  renderer.autoClear = false;
  scene.add(model.root);
  model.root.traverse((o) => o.isMesh && ((o.castShadow = true), (o.receiveShadow = true)));
  const NL = veh.V.LAYERS.length;
  for (const p of model.pieces) (p.x = 0), (p.v = 0), (p.to = 0), (p.wait = 0);

  // ---------- 海報：正交相機，單位是 CSS px，原點在左下 ----------
  const oScene = new THREE.Scene();
  const oCam = new THREE.OrthographicCamera(0, 1, 1, 0, -2000, 2000);
  const U = {uC: {value: new THREE.Vector2()}, uM: {value: new THREE.Vector2()}, uR: {value: 40}, uTex: {value: null}, uBack: {value: new THREE.Color()}, uLift: {value: 0}};
  const pmat = new THREE.ShaderMaterial({uniforms: U, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide});
  const poster = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pmat);
  const smat = new THREE.ShaderMaterial({
    uniforms: {uC: U.uC, uM: U.uM, uR: U.uR, uK: {value: 1}},
    vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy, -10.0, 1.0); }',
    fragmentShader: SH_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), smat);
  oScene.add(shadow, poster);
  let W = 0, H = 0, texN = 0;
  const layout = async () => {
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    if (!W || !H) return;
    oCam.right = W;
    oCam.top = H;
    oCam.updateProjectionMatrix();
    const seg = 80;
    for (const m of [poster, shadow]) {
      m.geometry.dispose();
      m.geometry = new THREE.PlaneGeometry(W, H, m === poster ? seg : 1, m === poster ? Math.round((seg * H) / W) : 1).translate(W / 2, H / 2, 0);
    }
    U.uC.value.set(W, 0);
    U.uR.value = Math.max(26, Math.min(W, H) * 0.06);
    const n = ++texN;
    const tex = await drawPoster(W, H, Math.min(devicePixelRatio || 1, 2));
    if (n !== texN) return tex.dispose();
    U.uTex.value?.dispose();
    U.uTex.value = tex;
    U.uBack.value.set(isDark() ? '#1d1e21' : '#e4dfd4');
  };
  await layout();
  const ro = new ResizeObserver(() => layout());
  ro.observe(canvas);
  const paint = () => {
    st.paint();
    layout();
  };
  ctx.onTheme(paint);

  // ---------- 字（撕開之後才出現） ----------
  const ui = document.createElement('div');
  ui.innerHTML = `${heroCopy({cls: 'pc'})}
    <button class="ib restick" id="restick" aria-label="把海報貼回去"><svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4v4.5H9"/></svg></button>
    <div class="cornerhint" id="ch"><i></i></div>`;
  stage.append(...ui.children);
  const $ = (s) => stage.querySelector(s);
  const copy = $('.copy');
  copy.classList.add('away');

  // ---------- 撕：M 是被抓著的那個角現在的位置 ----------
  const mx = new Spring(0, 70, 13), my = new Spring(0, 70, 13);
  let peeled = false, gone = false, drag = null, idle = 0;
  const setM = (x, y, snap) => {
    mx.to = x;
    my.to = y;
    if (snap) (mx.x = x), (my.x = y), (mx.v = my.v = 0);
  };
  const toLocal = (e) => {
    const r = canvas.getBoundingClientRect();
    return {x: e.clientX - r.left, y: r.bottom - e.clientY};
  };
  const nearCorner = (p) => W - p.x < Math.max(120, W * 0.28) && p.y < Math.max(120, H * 0.28);
  const tearAway = () => {
    peeled = true;
    // 往左上方整張拉走
    const k = Math.hypot(W, H) * 2.4;
    mx.k = my.k = 22;
    mx.c = my.c = 9;
    setM(W - k * 0.8, k * 0.6);
    $('#ch').classList.add('gone');
    setTimeout(() => {
      gone = true;
      copy.classList.remove('away');
      $('#restick').classList.add('on');
    }, RM.matches ? 0 : 900);
  };
  stage.addEventListener('pointerdown', (e) => {
    if (peeled || e.target.closest('button, a')) return;
    const p = toLocal(e);
    if (!nearCorner(p)) return;
    drag = {p0: p, moved: false};
    mx.k = my.k = 260;
    mx.c = my.c = 30;
    stage.setPointerCapture(e.pointerId);
  }, {signal: ctx.sig});
  stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = toLocal(e);
    if (Math.hypot(p.x - drag.p0.x, p.y - drag.p0.y) > 6) drag.moved = true;
    // 手指抓著的地方就是角現在的位置（不能比原本的角更往右下）
    setM(Math.min(p.x, W - 1), Math.max(p.y, 1));
  }, {signal: ctx.sig});
  const up = () => {
    if (!drag) return;
    const moved = drag.moved;
    drag = null;
    const pulled = Math.hypot(W - mx.to, my.to) / Math.hypot(W, H);
    if (!moved || pulled > 0.3) tearAway(); // 點一下角也會撕
    else {
      mx.k = my.k = 140;
      mx.c = my.c = 9; // 彈回去，會多彈一下
      setM(W, 0);
    }
  };
  stage.addEventListener('pointerup', up, {signal: ctx.sig});
  stage.addEventListener('pointercancel', up, {signal: ctx.sig});
  $('#restick').addEventListener('click', () => {
    peeled = gone = false;
    copy.classList.add('away');
    $('#restick').classList.remove('on');
    $('#ch').classList.remove('gone');
    setExplode(false);
    mx.k = my.k = 26;
    mx.c = my.c = 10;
    setM(W, 0);
  }, {signal: ctx.sig});
  setM(W, 0, true);

  // ---------- 撕開之後：公車一層一層拆開 ----------
  let ex = false;
  const setExplode = (on) => {
    ex = on;
    if (gone) copy.classList.toggle('away', on);
    for (const p of model.pieces) {
      const L = layerOf[p.id] || 1;
      p.to = on ? 1 : 0;
      p.wait = RM.matches ? 0 : on ? (L - 1) * 0.28 + (p.order % 4) * 0.05 : (NL - L) * 0.12;
    }
  };
  const pg = pager(stage, {n: 2, onGo: (i) => gone ? setExplode(i === 1) : (pg.set(0), tearAway()), sig: ctx.sig});
  canvas.addEventListener('click', () => gone && pg.go(ex ? 0 : 1), {signal: ctx.sig});

  const box = new THREE.Box3().setFromObject(model.root);
  const C = box.getCenter(new THREE.Vector3());
  const tgt = new THREE.Vector3();
  const stop = loop((dt, t) => {
    // 沒人動的時候，角偶爾自己掀一下（提示可以撕）
    if (!peeled && !drag) {
      idle += dt;
      const ph = idle % 4.2;
      if (!RM.matches && ph > 1.2 && ph < 1.25 && mx.to === W) {
        mx.k = my.k = 90;
        mx.c = my.c = 8;
        setM(W - Math.min(W, H) * 0.09, Math.min(W, H) * 0.12);
        setTimeout(() => !peeled && !drag && setM(W, 0), 420);
      }
    } else idle = 0;
    mx.step(dt);
    my.step(dt);
    U.uM.value.set(mx.x, my.x);
    U.uLift.value = Math.min(1, Math.hypot(W - mx.x, my.x) / 40);
    smat.uniforms.uK.value = U.uLift.value;
    // 公車
    for (const p of model.pieces) {
      if (p.wait > 0) {
        p.wait -= dt;
        continue;
      }
      p.v += (120 * (p.to - p.x) - 15 * p.v) * dt;
      p.x += p.v * dt;
      p.obj.position.copy(p.base).addScaledVector(p.vec, p.x);
    }
    const portrait = W / H < 0.8;
    const az = 0.9 + (RM.matches ? 0 : t * 0.06);
    const exK = smooth(model.pieces.reduce((a, p) => Math.max(a, p.x), 0));
    const dist = (portrait ? 46 : 29) * (1 + exK * 0.4);
    tgt.set(C.x, C.y + exK * 1.5, C.z);
    camera.position.set(tgt.x + Math.cos(az) * dist, tgt.y + dist * 0.2, tgt.z - Math.sin(az) * dist);
    camera.lookAt(tgt);
    if (portrait) camera.setViewOffset(W, H, -W * 0.05, -H * 0.02, W, H);
    else camera.setViewOffset(W, H, -W * 0.17, -H * 0.1, W, H);
    renderer.clear();
    renderer.render(scene, camera);
    if (!gone) {
      renderer.clearDepth();
      renderer.render(oScene, oCam);
    }
    // 角上的提示圈跟著角
    $('#ch').style.transform = `translate(${mx.x}px, ${H - my.x}px)`;
  });
  return {
    dispose() {
      stop();
      ro.disconnect();
      U.uTex.value?.dispose();
      poster.geometry.dispose();
      shadow.geometry.dispose();
      pmat.dispose();
      smat.dispose();
      st.dispose();
    },
  };
}
