// 星宇航空 A350-1000「空山金」：全部用程式產生，單位公尺（真實大小），整台在 root 縮成 1/6 放進場景。
// x 往機頭，y 往上，z 往右翼。尺寸照 Airbus 公開規格：機長 73.79、翼展 64.75、機高 17.08、機身寬 5.96。
// 外觀照 Aron 那台 1:200 模型的照片：金色機身和引擎、白色機翼和水平尾翼、金色垂直尾翼上白色標誌、
// 鍍鉻的引擎進氣口和尾錐、機身上大小兩行 STARLUX AIRSORAYAMA。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const SCALE = 1 / 6;
export const LEN = 73.79;
const NOSE_X = LEN / 2;
export const CY = 6.4; // 機身中心離地
const RZ = 2.98;
const RY = 3.04;
export const FLOOR_Y = CY - 0.95; // 客艙地板
const CARGO_Y = CY - 2.66;
const WR_Y = CY - 1.9; // 機翼根部中心高度
const DIH = Math.tan((5.5 * Math.PI) / 180);
export const ZE = 10.0; // 引擎離中心線
export const XMG = -2.6; // 主起落架
const XNG = 30.4; // 鼻輪
export const R_MAIN = 0.7; // 主輪半徑（1400 mm 輪胎）
export const R_NOSE = 0.525;
const DOORS = [8.2, 27.2, 48.0, 64.0]; // 機門中心離機頭的距離（照片量的）
const xAt = (t) => NOSE_X - t;

const COL = {
  gold: '#c6a062', white: '#f3f3f0', cream: '#ebe5d8', dark: '#16181b', glass: '#1b2630', tire: '#1c1d1f',
  metal: '#8d939a', strut: '#c9ccd0', red: '#d8352a', green: '#2fbf62',
};
const mat = {
  gold: () => new THREE.MeshPhysicalMaterial({color: COL.gold, metalness: 0.5, roughness: 0.45, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.8}),
  white: () => new THREE.MeshPhysicalMaterial({color: COL.white, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.75}),
  cream: () => new THREE.MeshStandardMaterial({color: COL.cream, roughness: 0.8}),
  chrome: () => new THREE.MeshStandardMaterial({color: '#dcdee1', roughness: 0.3, metalness: 1}),
  dark: () => new THREE.MeshStandardMaterial({color: COL.dark, roughness: 0.6}),
  metal: () => new THREE.MeshStandardMaterial({color: COL.metal, roughness: 0.4, metalness: 0.8}),
  strut: () => new THREE.MeshStandardMaterial({color: COL.strut, roughness: 0.3, metalness: 0.9}),
  tire: () => new THREE.MeshStandardMaterial({color: COL.tire, roughness: 0.9}),
  plastic: (c, r = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: r}),
  // light：屬於哪一組燈（燈光面板開關）；on：打開時的發光強度
  lamp: (c, e = 0.8, light = null, on = 3) => {
    const m = new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: light ? 0.04 : e, roughness: 0.2});
    if (light) {
      m.userData.light = light;
      m.userData.lamp = {on, off: 0.04};
    }
    return m;
  },
};

// ---------- 小工具 ----------
const rbox = (w, h, d, r = 0.03, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
const span = (a, b, r = 0.02, seg = 3) => {
  const g = rbox(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]), r, seg);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
};
const cylX = (r, len, x, y, z, seg = 24) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateZ(Math.PI / 2);
  g.translate(x, y, z);
  return g;
};
const cylZ = (r, len, x, y, z, seg = 24) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
};
const rod = (a, b, r, seg = 12) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
};
const clean = (g) => {
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
  return g;
};
const merge = (list) => mergeGeometries(list.map((g) => (g.index ? g.toNonIndexed() : g)).map(clean), false);
const mesh = (geo, m) => {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};
function canvasTex(w, h, draw, {flip = true} = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.flipY = flip;
  return t;
}

/** 沿 z 鏡像（左右對稱的零件），同時把三角形翻面，正面才會朝外。 */
function flipZ(g) {
  g = g.index ? g.toNonIndexed() : g;
  g.scale(1, 1, -1);
  for (const k of ['position', 'normal', 'uv']) {
    const a = g.attributes[k];
    if (!a) continue;
    const n = a.itemSize;
    for (let i = 0; i < a.count; i += 3)
      for (let c = 0; c < n; c++) {
        const t = a.array[(i + 1) * n + c];
        a.array[(i + 1) * n + c] = a.array[(i + 2) * n + c];
        a.array[(i + 2) * n + c] = t;
      }
  }
  g.computeVertexNormals();
  return g;
}

// ---------- 機身外形：沿著機身每一站的寬、高、中心偏移，用單調三次曲線接起來 ----------
// [離機頭距離 t, 半寬 rz, 半高 ry, 中心往上偏 dy]
const STATIONS = [
  [0, 0.0, 0.0, -0.95], [0.15, 0.45, 0.42, -0.9], [0.6, 1.05, 1.0, -0.78], [1.4, 1.62, 1.6, -0.6], [2.6, 2.15, 2.15, -0.4],
  [4.0, 2.58, 2.6, -0.2], [5.6, 2.85, 2.9, -0.07], [7.5, RZ, RY, 0], [52, RZ, RY, 0], [56, 2.9, 2.92, 0.12], [60, 2.6, 2.55, 0.42],
  [64, 2.1, 2.0, 0.85], [68, 1.45, 1.35, 1.35], [71, 0.9, 0.82, 1.7], [73.2, 0.42, 0.38, 1.95], [LEN, 0.3, 0.28, 2.0],
];
function monotone(xs, ys) {
  const n = xs.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  return (x) => {
    let i = 0;
    while (i < n - 2 && x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const s = Math.min(1, Math.max(0, (x - xs[i]) / h));
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * ys[i] + (s3 - 2 * s2 + s) * h * m[i] + (-2 * s3 + 3 * s2) * ys[i + 1] + (s3 - s2) * h * m[i + 1];
  };
}
const fRz = monotone(STATIONS.map((s) => s[0]), STATIONS.map((s) => s[1]));
const fRy = monotone(STATIONS.map((s) => s[0]), STATIONS.map((s) => s[2]));
const fDy = monotone(STATIONS.map((s) => s[0]), STATIONS.map((s) => s[3]));
/** 機身表面一點：θ = 0 在正上方，90° 右邊，180° 正下方，270° 左邊。 */
export const fusePoint = (t, th, grow = 0) => new THREE.Vector3(xAt(t), CY + fDy(t) + (fRy(t) + grow) * Math.cos(th), (fRz(t) + grow) * Math.sin(th));
/** 機身側面某個高度 y 的 θ（右邊 side=1、左邊 -1）。 */
const thetaAtY = (t, y, side) => {
  const c = Math.min(1, Math.max(-1, (y - CY - fDy(t)) / fRy(t)));
  const a = Math.acos(c);
  return side > 0 ? a : Math.PI * 2 - a;
};
const T_SAMPLES = (() => {
  const a = [0, 0.03, 0.08, 0.15];
  for (let t = 0.25; t < 7.5; t += 0.18) a.push(t);
  for (let t = 7.5; t < 52; t += 1.5) a.push(t);
  for (let t = 52; t < LEN; t += 0.4) a.push(t);
  a.push(LEN);
  return a;
})();
/** 機身的一塊：t0–t1、θ0–θ1。uv 用 (t/LEN, θ/2π)，和塗裝貼圖對齊。inside 時往內縮、反面朝內（客艙內牆）。 */
function fuseGeo(t0, t1, th0, th1, {grow = 0, inside = false} = {}) {
  const ts = [t0, ...T_SAMPLES.filter((t) => t > t0 + 0.01 && t < t1 - 0.01), t1];
  const nth = Math.max(4, Math.round(((th1 - th0) / (Math.PI * 2)) * 96));
  const pos = [];
  const uv = [];
  for (const t of ts)
    for (let j = 0; j <= nth; j++) {
      const th = th0 + ((th1 - th0) * j) / nth;
      const p = fusePoint(t, th, grow);
      pos.push(p.x, p.y, p.z);
      uv.push(t / LEN, th / (Math.PI * 2));
    }
  const idx = [];
  const W = nth + 1;
  for (let i = 0; i < ts.length - 1; i++)
    for (let j = 0; j < nth; j++) {
      const a = i * W + j;
      const b = a + W;
      const c = a + 1;
      const d = b + 1;
      if (inside) idx.push(a, c, b, b, c, d);
      else idx.push(a, b, c, b, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------- 翼面：一段一段剖面（前緣點、弦長、厚度方向）接起來 ----------
// NACA 四位數翼型，camber 是彎度。shape(f, sec) 可以改成別的上下表面（例如貼在上面的擾流板）。
const naca = (f, t, camber = 0) => {
  const yt = 5 * t * (0.2969 * Math.sqrt(f) - 0.126 * f - 0.3516 * f * f + 0.2843 * f ** 3 - 0.1036 * f ** 4);
  const p = 0.4;
  const yc = camber ? (f < p ? (camber / (p * p)) * (2 * p * f - f * f) : (camber / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * f - f * f)) : 0;
  return [yc + yt, yc - yt, yc];
};
const CHORD_DIR = new THREE.Vector3(-1, 0, 0);
/** sec: {le: Vector3, c, t, up: Vector3, camber}。回傳封閉的實心翼面。 */
function loft(secs, f0 = 0, f1 = 1, {nF = 14, shape = null} = {}) {
  const ring = (s) => {
    const fs = [];
    for (let k = 0; k <= nF; k++) fs.push(f0 + (f1 - f0) * (0.5 - 0.5 * Math.cos((Math.PI * k) / nF)));
    const pts = [];
    const at = (f, which) => {
      const [yu, yl] = shape ? shape(f, s) : naca(f, s.t, s.camber || 0).map((v) => v * s.c);
      return s.le.clone().addScaledVector(CHORD_DIR, f * s.c).addScaledVector(s.up, which ? yu : yl);
    };
    for (const f of fs) pts.push(at(f, true));
    for (let k = fs.length - 1; k >= 0; k--) if (!(f0 === 0 && k === 0) && !(k === fs.length - 1 && f1 === 1)) pts.push(at(fs[k], false));
    return pts;
  };
  const rings = secs.map(ring);
  const n = rings[0].length;
  const pos = [];
  for (const r of rings) for (const p of r) pos.push(p.x, p.y, p.z);
  const idx = [];
  for (let i = 0; i < rings.length - 1; i++)
    for (let k = 0; k < n; k++) {
      const a = i * n + k;
      const b = i * n + ((k + 1) % n);
      const c = a + n;
      const d = b + n;
      idx.push(a, c, b, b, c, d);
    }
  // 兩端蓋起來
  const capAt = (ri, away) => {
    const base = pos.length / 3;
    const cen = rings[ri].reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / n);
    pos.push(cen.x, cen.y, cen.z);
    for (let k = 0; k < n; k++) {
      const a = ri * n + k;
      const b = ri * n + ((k + 1) % n);
      const pa = rings[ri][k];
      const pb = rings[ri][(k + 1) % n];
      const nrm = pa.clone().sub(cen).cross(pb.clone().sub(cen));
      if (nrm.dot(away) >= 0) idx.push(base, a, b);
      else idx.push(base, b, a);
    }
  };
  const last = rings.length - 1;
  capAt(0, secs[0].le.clone().sub(secs[1].le));
  capAt(last, secs[last].le.clone().sub(secs[last - 1].le));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  // 邊的方向要朝外：拿上表面中間一點檢查，反了就整個翻過來（蓋子是各自算的，翻的時候只翻側面）
  g.computeVertexNormals();
  const mid = Math.floor(rings.length / 2) * n + Math.floor(nF / 2);
  const nr = new THREE.Vector3().fromBufferAttribute(g.attributes.normal, mid);
  if (nr.dot(secs[Math.floor(rings.length / 2)].up) < 0) {
    const sides = (rings.length - 1) * n * 6;
    for (let i = 0; i < sides; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}
/** 翼面的平面形狀：給一串 [位置, 前緣 x, 弦長, 高度, 厚度]，內插出任一個位置的剖面。 */
function planform(rows, toSec) {
  const at = (s) => {
    let i = 0;
    while (i < rows.length - 2 && s > rows[i + 1][0]) i++;
    const [s0, ...a] = rows[i];
    const [s1, ...b] = rows[i + 1];
    const k = (s - s0) / (s1 - s0);
    return toSec(s, ...a.map((v, j) => v + (b[j] - v) * k));
  };
  const range = (s0, s1) => {
    const ss = [s0, ...rows.map((r) => r[0]).filter((s) => s > s0 + 0.01 && s < s1 - 0.01), s1];
    const out = [];
    for (let i = 0; i < ss.length - 1; i++) {
      const steps = Math.max(1, Math.ceil((ss[i + 1] - ss[i]) / 3));
      for (let j = 0; j < steps; j++) out.push(ss[i] + ((ss[i + 1] - ss[i]) * j) / steps);
    }
    out.push(s1);
    return out.map(at);
  };
  return {at, range};
}
const hingePoint = (sec, fh) => sec.le.clone().addScaledVector(CHORD_DIR, fh * sec.c).addScaledVector(sec.up, naca(fh, sec.t, sec.camber || 0)[2] * sec.c);

// ---------- 字：照模型上的未來感細線字（A 沒有橫線、M 是兩個山） ----------
const GLYPH = {
  S: {w: 0.72, d: [[[0.72, 0.06], [0.1, 0.06], [0.02, 0.14], [0.02, 0.42], [0.1, 0.5], [0.62, 0.5], [0.7, 0.58], [0.7, 0.86], [0.62, 0.94], [0, 0.94]]]},
  T: {w: 0.76, d: [[[0, 0.06], [0.76, 0.06]], [[0.38, 0.06], [0.38, 1]]]},
  A: {w: 0.86, d: [[[0, 1], [0.43, 0.04], [0.86, 1]]]},
  R: {w: 0.72, d: [[[0.02, 1], [0.02, 0.06], [0.6, 0.06], [0.7, 0.16], [0.7, 0.42], [0.6, 0.52], [0.02, 0.52]], [[0.4, 0.52], [0.72, 1]]]},
  L: {w: 0.62, d: [[[0.02, 0], [0.02, 0.94], [0.62, 0.94]]]},
  U: {w: 0.72, d: [[[0.02, 0], [0.02, 0.84], [0.12, 0.94], [0.6, 0.94], [0.7, 0.84], [0.7, 0]]]},
  X: {w: 0.82, d: [[[0, 0.02], [0.82, 1]], [[0.82, 0.02], [0, 1]]]},
  I: {w: 0.06, d: [[[0.03, 0.04], [0.03, 1]]]},
  O: {w: 0.92, circle: true},
  Y: {w: 0.82, d: [[[0, 0.02], [0.41, 0.5], [0.82, 0.02]], [[0.41, 0.5], [0.41, 1]]]},
  M: {w: 1.36, d: [[[0, 1], [0.34, 0.04], [0.68, 1], [1.02, 0.04], [1.36, 1]]]},
  ' ': {w: 0.5, d: []},
};
/** 把一行字畫成透明底的白色細線貼圖，回傳貼圖和長寬比。 */
function wordTex(text, gap) {
  const H = 140;
  const lw = H * 0.085;
  const pad = lw;
  let wsum = 0;
  for (const ch of text) wsum += GLYPH[ch].w + gap;
  wsum -= gap;
  const W = Math.ceil(wsum * H + pad * 2);
  const tex = canvasTex(W, H + pad * 2, (g) => {
    g.strokeStyle = '#ffffff';
    g.lineWidth = lw;
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    let x = pad;
    for (const ch of text) {
      const gl = GLYPH[ch];
      if (gl.circle) {
        g.beginPath();
        g.arc(x + (gl.w * H) / 2, pad + H / 2, H / 2 - lw / 2, 0, Math.PI * 2);
        g.stroke();
      }
      for (const path of gl.d || []) {
        g.beginPath();
        path.forEach(([px, py], i) => (i ? g.lineTo(x + px * H, pad + py * H) : g.moveTo(x + px * H, pad + py * H)));
        g.stroke();
      }
      x += (gl.w + gap) * H;
    }
  });
  return {tex, aspect: W / (H + pad * 2), padFrac: pad / (H + pad * 2)};
}
/** 貼在曲面上的一張貼紙：surf(a, b) 回傳表面點和法線，a、b 是 0–1。 */
function decal(surf, na, nb, lift = 0.025) {
  const pos = [];
  const uv = [];
  for (let j = 0; j <= nb; j++)
    for (let i = 0; i <= na; i++) {
      const a = i / na;
      const b = j / nb;
      const [p, n] = surf(a, b);
      p.addScaledVector(n, lift);
      pos.push(p.x, p.y, p.z);
      uv.push(a, b);
    }
  const idx = [];
  for (let j = 0; j < nb; j++)
    for (let i = 0; i < na; i++) {
      const a = j * (na + 1) + i;
      idx.push(a, a + 1, a + na + 1, a + 1, a + na + 2, a + na + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** 機身側面的一行字：side 1 右邊、-1 左邊；兩邊都從看的人的左邊讀到右邊。 */
function fuseText(text, gap, tStart, yBottom, cap, side) {
  const {tex, aspect, padFrac} = wordTex(text, gap);
  const hTot = cap / (1 - 2 * padFrac);
  const len = hTot * aspect;
  const geo = decal((a, b) => {
    // 左邊：讀的方向＝往機尾（t 變大）；右邊：讀的方向＝往機頭
    const t = side < 0 ? tStart + a * len : tStart + len - a * len;
    const y = yBottom - padFrac * hTot + b * hTot;
    const th = thetaAtY(t, y, side);
    const p = fusePoint(t, th);
    const q = fusePoint(t, th, 1).sub(p).normalize();
    return [p, q];
  }, Math.ceil(len / 0.5), 8, 0.02);
  // 讀的方向和 uv 的 u 要一致：右邊的 a 是從機尾往機頭，所以 u 不用翻；兩邊的 v 都是往上
  const m = new THREE.MeshStandardMaterial({map: tex, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false});
  tex.flipY = true;
  const o = new THREE.Mesh(geo, m);
  o.renderOrder = 1;
  return o;
}

/** 機身塗裝貼圖：金色底、窗戶、門的框線、駕駛艙的黑色面罩。u = t/LEN、v = θ/2π（v = 0 在正上方）。 */
function fuseLivery(glowOnly = false) {
  const W = 4096;
  const H = 1024;
  const X = (t) => (t / LEN) * W;
  const Y = (th) => (th / (Math.PI * 2)) * H;
  const deg = Math.PI / 180;
  return canvasTex(W, H, (g) => {
    if (glowOnly) {
      // 客艙燈打開時窗戶發亮用的遮罩：黑底，只有窗戶是暖黃色
      g.fillStyle = '#000';
      g.fillRect(0, 0, W, H);
      for (const side of [1, -1])
        for (let t = 9.6; t < 63.2; t += 0.62) {
          if (DOORS.some((d) => Math.abs(d - t) < 1.05) || (t > 30.6 && t < 31.4)) continue;
          const cy = Y(thetaAtY(t, FLOOR_Y + 1.1, side));
          const w = (0.25 / LEN) * W;
          const h = (0.37 / (2 * Math.PI * RZ)) * H;
          g.fillStyle = '#ffd08a';
          g.beginPath();
          g.roundRect(X(t) - w / 2, cy - h / 2, w, h, w * 0.45);
          g.fill();
        }
      return;
    }
    g.fillStyle = COL.gold;
    g.fillRect(0, 0, W, H);
    // 很淡的蒙皮接縫
    g.strokeStyle = 'rgba(80,60,30,0.10)';
    g.lineWidth = 1.5;
    for (let t = 10; t < 70; t += 6.2) {
      g.beginPath();
      g.moveTo(X(t), 0);
      g.lineTo(X(t), H);
      g.stroke();
    }
    for (const side of [1, -1]) {
      // 窗戶：窗戶中心在地板上 1.1 公尺，間距 0.62 公尺，門旁邊空出來
      const yWin = FLOOR_Y + 1.1;
      for (let t = 9.6; t < 63.2; t += 0.62) {
        if (DOORS.some((d) => Math.abs(d - t) < 1.05)) continue;
        if (t > 30.6 && t < 31.4) continue;
        const th = thetaAtY(t, yWin, side);
        const cx = X(t);
        const cy = Y(th);
        const w = (0.27 / LEN) * W;
        const h = (0.4 / (2 * Math.PI * RZ)) * H;
        g.fillStyle = '#1c2630';
        g.beginPath();
        g.roundRect(cx - w / 2, cy - h / 2, w, h, w * 0.45);
        g.fill();
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.beginPath();
        g.roundRect(cx - w / 2 + 2, cy - h / 2 + 2, w * 0.4, h * 0.45, 3);
        g.fill();
      }
      // 門：1.07 × 1.93 公尺，框線加一個小窗
      for (const d of DOORS) {
        const thTop = thetaAtY(d, FLOOR_Y + 1.93, side);
        const thBot = thetaAtY(d, FLOOR_Y, side);
        const y0 = Y(Math.min(thTop, thBot));
        const y1 = Y(Math.max(thTop, thBot));
        const x0 = X(d - 0.535);
        const x1 = X(d + 0.535);
        g.strokeStyle = 'rgba(60,45,20,0.55)';
        g.lineWidth = 2.5;
        g.beginPath();
        g.roundRect(x0, y0, x1 - x0, y1 - y0, 6);
        g.stroke();
        const thw = thetaAtY(d, FLOOR_Y + 1.3, side);
        g.fillStyle = '#1c2630';
        g.beginPath();
        g.arc((x0 + x1) / 2, Y(thw), 6, 0, Math.PI * 2);
        g.fill();
      }
    }
    // 駕駛艙的黑色面罩：跨過正上方（θ = 0），畫兩次（貼圖上下兩邊各一半）
    const mask = (off) => {
      g.fillStyle = '#101214';
      g.beginPath();
      const pts = [[2.55, -12], [2.6, 12], [3.0, 40], [3.55, 62], [4.3, 76], [5.15, 74], [5.05, 60], [4.5, 44], [4.05, 22], [3.95, 0], [4.05, -22], [4.5, -44], [5.05, -60], [5.15, -74], [4.3, -76], [3.55, -62], [3.0, -40], [2.6, -12]];
      pts.forEach(([t, a], i) => (i ? g.lineTo(X(t), Y(a * deg) + off) : g.moveTo(X(t), Y(a * deg) + off)));
      g.closePath();
      g.fill();
      // 窗框：細細的灰線把面罩分成六片窗
      g.strokeStyle = 'rgba(120,125,130,0.5)';
      g.lineWidth = 2;
      for (const a of [0, 30, -30, 58, -58]) {
        g.beginPath();
        g.moveTo(X(2.6), Y(a * deg) + off);
        g.lineTo(X(5.1), Y(a * deg) + off);
        g.stroke();
      }
    };
    mask(0);
    mask(H);
  }, {flip: false});
}

function finLogo() {
  // 星宇的尾翼標誌：三段斜斜的白色長條排成 S，中間有一個四角星
  return canvasTex(512, 512, (g, w) => {
    g.fillStyle = '#ffffff';
    const bar = (x, y, len) => {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + len, y);
      g.lineTo(x + len - 70, y + 92);
      g.lineTo(x - 70, y + 92);
      g.closePath();
      g.fill();
    };
    bar(190, 50, 270);
    bar(150, 210, 230);
    bar(110, 370, 270);
    g.fillStyle = '#ffffff';
    g.beginPath();
    const cx = 120;
    const cy = 150;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 16 : 58;
      g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.closePath();
    g.fill();
    void w;
  });
}

// ---------- 主體 ----------
export function buildPlane() {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  // 姿態：att 繞著主輪著地點抬頭；roll 繞著機身中心側傾
  const att = new THREE.Group();
  att.position.set(XMG, 0, 0);
  const body = new THREE.Group();
  body.position.set(-XMG, 0, 0);
  const rollG = new THREE.Group();
  rollG.position.set(0, CY, 0);
  const inner = new THREE.Group();
  inner.position.set(0, -CY, 0);
  root.add(att);
  att.add(body);
  body.add(rollG);
  rollG.add(inner);

  const parts = {};
  const pieces = [];
  const part = (id) => (parts[id] ||= {id, meshes: [], pieces: []});
  const piece = (id, objs, vec, order, parent = inner) => {
    const g = new THREE.Group();
    for (const o of [].concat(objs)) {
      g.add(o);
      o.traverse((m) => {
        if (m.isMesh) {
          m.userData.part = id;
          part(id).meshes.push(m);
        }
      });
    }
    parent.add(g);
    const p = {id, obj: g, vec: new THREE.Vector3(...vec), order, x: 0, v: 0, target: 0, wait: 0, hinge: 0};
    part(id).pieces.push(p);
    pieces.push(p);
    return g;
  };
  /** 會轉的東西（舵面、起落架）：外層 pivot 在轉軸上，裡面的網格往回移。 */
  const pivoted = (objs, pivot) => {
    const pg = new THREE.Group();
    pg.position.copy(pivot);
    for (const o of objs) {
      o.position.sub(pivot);
      pg.add(o);
    }
    return pg;
  };

  const goldM = mat.gold();
  const whiteM = mat.white();
  const creamM = mat.cream();
  const livery = fuseLivery();
  livery.wrapT = THREE.RepeatWrapping;
  const liveryM = mat.gold();
  liveryM.color.set('#ffffff');
  liveryM.map = livery;
  // 客艙燈：窗戶從裡面亮起來
  const glow = fuseLivery(true);
  glow.wrapT = THREE.RepeatWrapping;
  liveryM.emissive.set('#ffffff');
  liveryM.emissiveMap = glow;
  liveryM.emissiveIntensity = 0;
  liveryM.userData.light = 'cabin';
  liveryM.userData.lamp = {on: 1.8, off: 0};

  // ================= 第一層：機身外殼 =================
  const deg = Math.PI / 180;
  const T_NOSE = 6.4;
  const T_TAIL = 66;
  {
    // 機頭：含駕駛艙窗戶，往前拆
    const out = [mesh(fuseGeo(0, T_NOSE, 0, Math.PI * 2), liveryM), mesh(fuseGeo(0.4, T_NOSE, 0, Math.PI * 2, {grow: -0.08, inside: true}), creamM)];
    // 雨刷：收在擋風玻璃下緣
    for (const s2 of [-1, 1]) {
      const a = fusePoint(2.65, s2 * 0.12, 0.04);
      const b = fusePoint(3.15, s2 * 0.62, 0.04);
      out.push(mesh(rod([a.x, a.y, a.z], [b.x, b.y, b.z], 0.025, 6), mat.dark()));
    }
    piece('nose', out, [11, 1.5, 0], 1);
    // 空速管：機頭兩側各兩根 L 形的小管子，量飛機飛多快
    {
      const g = [];
      for (const s2 of [-1, 1])
        for (const [t, dy] of [[4.4, -0.35], [4.9, -0.75]]) {
          const th = thetaAtY(t, CY + dy, s2);
          const p = fusePoint(t, th);
          const q = fusePoint(t, th, 0.22);
          g.push(rod([p.x, p.y, p.z], [q.x, q.y, q.z], 0.025, 8));
          g.push(rod([q.x, q.y, q.z], [q.x + 0.28, q.y, q.z], 0.02, 8));
        }
      piece('pitot', [mesh(merge(g), mat.chrome())], [13, 2.5, 0], 1);
    }
  }
  {
    // 機身中段切成四塊：上蓋、左右兩面牆、肚子
    const TOP = [298 * deg, 422 * deg];
    const R = [62 * deg, 125 * deg];
    const BOT = [125 * deg, 235 * deg];
    const L = [235 * deg, 298 * deg];
    const shell = (a, b) => [mesh(fuseGeo(T_NOSE, T_TAIL, a, b), liveryM), mesh(fuseGeo(T_NOSE, T_TAIL, a, b, {grow: -0.1, inside: true}), creamM)];
    const lid = shell(...TOP);
    // 大字：STARLUX AIRSORAYAMA，上面一行大、窗戶上面一行小（照模型照片）
    for (const side of [1, -1]) {
      lid.push(fuseText('STARLUX AIRSORAYAMA', 1.0, 8, CY + 1.5, 1.35, side));
    }
    // 防撞燈（上）：機身頂上一顆紅燈
    {
      const b = new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
      b.scale(1.4, 0.8, 1);
      const p = fusePoint(33, 0);
      b.translate(p.x, p.y, 0);
      lid.push(mesh(b, mat.lamp('#ff2a1a', 0.04, 'beacon', 4)));
    }
    piece('fuselage', lid, [0, 16, 0], 1);
    const wr = shell(...R);
    const wl = shell(...L);
    wr.push(fuseText('STARLUX AIRSORAYAMA', 0.42, 9.6, CY + 0.58, 0.75, 1));
    wl.push(fuseText('STARLUX AIRSORAYAMA', 0.42, 9.6, CY + 0.58, 0.75, -1));
    piece('fuselage', wr, [0, 4, 10], 1);
    piece('fuselage', wl, [0, 4, -10], 1);
    // 肚子：機身底部加上白色的機腹整流罩（包住機翼根部和主起落架艙）
    const belly = shell(...BOT);
    const BELLY = [[26, 0.3, 0.2, -2.3], [28, 1.9, 0.9, -2.25], [31, 3.0, 1.32, -2.2], [44, 3.1, 1.4, -2.2], [49, 2.5, 1.12, -2.0], [52.5, 0.6, 0.35, -1.5]];
    const bz = monotone(BELLY.map((b) => b[0]), BELLY.map((b) => b[1]));
    const by = monotone(BELLY.map((b) => b[0]), BELLY.map((b) => b[2]));
    const bd = monotone(BELLY.map((b) => b[0]), BELLY.map((b) => b[3]));
    {
      const pos = [];
      const idx = [];
      const NT = 40;
      const NA = 40;
      for (let i = 0; i <= NT; i++) {
        const t = 26 + (26.5 * i) / NT;
        for (let j = 0; j <= NA; j++) {
          const th = (j / NA) * Math.PI * 2;
          pos.push(xAt(t), CY + bd(t) + by(t) * Math.cos(th), bz(t) * Math.sin(th));
        }
      }
      for (let i = 0; i < NT; i++)
        for (let j = 0; j < NA; j++) {
          const a = i * (NA + 1) + j;
          idx.push(a, a + NA + 1, a + 1, a + NA + 1, a + NA + 2, a + 1);
        }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      belly.push(mesh(g, whiteM));
    }
    // 防撞燈（下）、降落燈（機腹前端兩顆，朝前）
    {
      const b = new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
      b.scale(1.4, 0.8, 1);
      b.translate(xAt(40), CY - 2.2 - 1.4, 0);
      belly.push(mesh(b, mat.lamp('#ff2a1a', 0.04, 'beacon', 4)));
      for (const s2 of [-1, 1]) {
        belly.push(mesh(cylX(0.16, 0.08, xAt(28.4), CY - 2.95, s2 * 1.25, 20), mat.chrome()));
        belly.push(mesh(cylX(0.13, 0.06, xAt(28.4) + 0.03, CY - 2.95, s2 * 1.25, 20), mat.lamp('#fff8e6', 0.04, 'landing', 5)));
      }
    }
    piece('fuselage', belly, [0, -1.2, 0], 1);
    // 天線：機背兩片、機腹兩片小刀片
    {
      const blade = (t, top) => {
        const sh = new THREE.Shape();
        sh.moveTo(0, 0);
        sh.lineTo(-0.55, 0);
        sh.lineTo(-0.62, 0.42);
        sh.lineTo(-0.45, 0.42);
        sh.closePath();
        const g = new THREE.ExtrudeGeometry(sh, {depth: 0.05, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2});
        g.translate(0.3, 0, -0.025);
        if (!top) g.scale(1, -1, 1);
        const p = top ? fusePoint(t, 0) : new THREE.Vector3(xAt(t), CY - (t > 26 && t < 52 ? 3.55 : 3.0), 0);
        g.translate(p.x, p.y - (top ? 0.03 : -0.03), 0);
        return g;
      };
      const am = mat.plastic('#dcdcd6', 0.4);
      piece('antennas', [mesh(merge([blade(20, true), blade(38, true)]), am)], [0, 17.5, 0], 1);
      piece('antennas', [mesh(merge([blade(15, false), blade(56, false)]), am)], [0, -2.2, 0], 1);
    }
    // 機門：8 片，比機身凸一點點，跟著兩面牆拆
    const doorT = canvasTex(128, 224, (g, w, h) => {
      g.fillStyle = COL.gold;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(60,45,20,0.7)';
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(4, 4, w - 8, h - 8, 14);
      g.stroke();
      g.fillStyle = '#1c2630';
      g.beginPath();
      g.arc(w / 2, h * 0.3, 14, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = 'rgba(60,45,20,0.6)';
      g.fillRect(w / 2 - 18, h * 0.55, 36, 8);
    });
    const doorM = mat.gold();
    doorM.color.set('#ffffff');
    doorM.map = doorT;
    for (const side of [1, -1]) {
      const objs = DOORS.map((d) =>
        mesh(
          decal((a, b) => {
            const t = side < 0 ? d - 0.535 + a * 1.07 : d + 0.535 - a * 1.07;
            const th = thetaAtY(t, FLOOR_Y + b * 1.93, side);
            const p = fusePoint(t, th);
            return [p, fusePoint(t, th, 1).sub(p).normalize()];
          }, 3, 8, 0.03),
          doorM,
        ),
      );
      piece('doors', objs, [0, 4, side * 11.5], 1);
    }
  }
  {
    // 機尾：往後拆；尾巴最後面是輔助動力（APU）的排氣口
    const out = [mesh(fuseGeo(T_TAIL, LEN, 0, Math.PI * 2), liveryM), mesh(fuseGeo(T_TAIL, LEN - 0.3, 0, Math.PI * 2, {grow: -0.08, inside: true}), creamM)];
    out.push(mesh(cylX(0.27, 0.08, xAt(LEN) - 0.02, CY + 2.0, 0, 20), mat.dark()));
    out.push(mesh(span([xAt(LEN) + 0.05, CY + 2.18, -0.07], [xAt(LEN) + 0.2, CY + 2.3, 0.07], 0.03), mat.lamp('#ffffff', 0.04, 'nav', 3)));
    piece('tailcone', out, [-11, 2.5, 0], 1);
  }

  // 垂直尾翼和方向舵
  const surf = {flaps: [], ailerons: [], spoilers: [], elevators: [], rudder: null, slats: []};
  const FIN = planform(
    [
      [CY + 2.0, -21.85, 10.9, 0.11],
      [CY + 2.9, -22.6, 10.5, 0.11],
      [17.08, -29.13, 3.6, 0.09],
    ],
    (y, lex, c, t) => ({le: new THREE.Vector3(lex, y, 0), c, t, up: new THREE.Vector3(0, 0, 1)}),
  );
  {
    const out = [mesh(loft(FIN.range(CY + 2.0, 17.08), 0, 0.645), goldM)];
    out.push(mesh(loft(FIN.range(CY + 2.0, CY + 3.2), 0.645, 1), goldM));
    out.push(mesh(loft(FIN.range(16.8, 17.08), 0.645, 1), goldM));
    // 尾翼兩面的白色標誌
    const logo = finLogo();
    for (const side of [1, -1]) {
      const lm = new THREE.MeshStandardMaterial({map: logo, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false});
      const g = decal((a, b) => {
        const y = 10.4 + b * 3.6;
        const s = FIN.at(y);
        // 標誌跟著前緣的後掠斜斜排；左邊：圖的右邊往機尾；右邊：圖的右邊往機頭
        const x = side < 0 ? s.le.x - 0.5 - a * 3.6 : s.le.x - 4.1 + a * 3.6;
        const f = Math.min(0.98, Math.max(0.02, (s.le.x - x) / s.c));
        const [yu] = naca(f, s.t);
        return [new THREE.Vector3(x, y, side * yu * s.c), new THREE.Vector3(0, 0, side)];
      }, 10, 10, 0.03);
      const o = new THREE.Mesh(g, lm);
      o.renderOrder = 1;
      out.push(o);
    }
    // 尾翼頂端的白色閃光燈
    out.push(mesh(span([-30.2, 17.02, -0.08], [-29.9, 17.16, 0.08], 0.03), mat.lamp('#ffffff', 0.04, 'strobe', 5)));
    // 背鰭：垂直尾翼前面接到機背的一小片斜斜的整流片
    {
      const sh = new THREE.Shape();
      sh.moveTo(-18.4, CY + 2.98);
      sh.quadraticCurveTo(-21.5, CY + 3.25, -23.75, CY + 4.2);
      sh.lineTo(-23.4, CY + 2.6);
      sh.lineTo(-18.6, CY + 2.6);
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, {depth: 0.3, bevelEnabled: true, bevelThickness: 0.22, bevelSize: 0.12, bevelSegments: 4, curveSegments: 12});
      g.translate(0, 0, -0.15);
      out.push(mesh(g, goldM));
    }
    piece('fin', out, [-5, 9, 0], 1);
    const secs = FIN.range(CY + 3.2, 16.8);
    const A = hingePoint(secs[0], 0.66);
    const B = hingePoint(secs[secs.length - 1], 0.66);
    const rm = mesh(loft(secs, 0.66, 1), goldM);
    const pg = pivoted([rm], A);
    surf.rudder = {grp: pg, axis: B.clone().sub(A).normalize()};
    piece('rudder', [pg], [-9, 9, 0], 1);
  }
  // 水平尾翼和升降舵（左右各一）
  for (const side of [1, -1]) {
    const HT = planform(
      [
        [0.8, -23.4, 7.0, 0.1],
        [9.5, -29.96, 2.4, 0.09],
      ],
      (z, lex, c, t) => ({le: new THREE.Vector3(lex, CY + 0.55 + (z - 0.8) * 0.105, side * z), c, t, up: new THREE.Vector3(0, 1, 0)}),
    );
    const out = [mesh(loft(HT.range(0.8, 9.5), 0, 0.7), whiteM), mesh(loft(HT.range(0.8, 1.7), 0.7, 1), whiteM), mesh(loft(HT.range(9.3, 9.5), 0.7, 1), whiteM)];
    // 標誌燈：水平尾翼上面一顆燈，往上照著垂直尾翼的標誌
    {
      const tp = HT.at(8.6);
      const lp = tp.le.clone().addScaledVector(CHORD_DIR, 0.35 * tp.c).add(new THREE.Vector3(0, naca(0.35, tp.t)[0] * tp.c + 0.06, 0));
      out.push(mesh(span([lp.x - 0.15, lp.y - 0.05, lp.z - 0.08], [lp.x + 0.15, lp.y + 0.08, lp.z + 0.08], 0.03), mat.lamp('#fff3dc', 0.04, 'logo', 3)));
      const spot = new THREE.SpotLight('#fff1d8', 2.2, 9, 0.38, 0.7, 1);
      spot.position.copy(lp).add(new THREE.Vector3(0, 0.12, 0));
      spot.target.position.set(-25.6, 12.2, 0);
      spot.userData.light = 'logo';
      out.push(spot, spot.target);
    }
    piece('stab', out, [-8, 1, side * 6], 1);
    const secs = HT.range(1.7, 9.3);
    const A = hingePoint(secs[0], 0.715);
    const B = hingePoint(secs[secs.length - 1], 0.715);
    const pg = pivoted([mesh(loft(secs, 0.715, 1), whiteM)], A);
    const axis = B.clone().sub(A).normalize();
    if (axis.z < 0) axis.negate();
    surf.elevators.push({grp: pg, axis});
    piece('elevator', [pg], [-11, 1, side * 7], 1);
  }

  // ================= 第三層：機翼 =================
  const wingPlan = (side) =>
    planform(
      [
        [1.2, 6.0, 16.5, 0.12],
        [2.6, 6.0, 16.5, 0.12],
        [10.8, 0.26, 11.46, 0.105],
        [30.9, -13.81, 2.89, 0.09],
      ],
      (z, lex, c, t) => ({le: new THREE.Vector3(lex, WR_Y + Math.max(0, z - 1.2) * DIH, side * z), c, t, camber: 0.02, up: new THREE.Vector3(0, 1, 0)}),
    );
  const fuelM = new THREE.MeshStandardMaterial({color: '#f0a43a', emissive: '#a0520a', emissiveIntensity: 0.25, roughness: 0.5, transparent: true, opacity: 0.85});
  const fuelObjs = [];
  for (const side of [1, -1]) {
    const WP = wingPlan(side);
    // 主翼：中間一段前緣讓給縫翼（f 0–0.09）
    const main = [
      mesh(loft(WP.range(1.2, 5.5), 0, 0.76, {nF: 18}), whiteM),
      mesh(loft(WP.range(5.5, 29.5), 0.095, 0.76, {nF: 16}), whiteM),
      mesh(loft(WP.range(29.5, 30.9), 0, 0.76, {nF: 18}), whiteM),
    ];
    // 沒有舵面的後緣：根部、襟翼和副翼中間、翼尖
    for (const [a, b] of [[1.2, 3.4], [19, 24], [29.3, 30.9]]) main.push(mesh(loft(WP.range(a, b), 0.76, 1), whiteM));
    // 翼尖的導航燈：左紅右綠
    const tip = WP.at(30.9);
    main.push(mesh(span([tip.le.x - 0.5, tip.le.y - 0.06, side * 30.85 - 0.08], [tip.le.x - 0.2, tip.le.y + 0.06, side * 30.85 + 0.08], 0.03), mat.lamp(side > 0 ? COL.green : COL.red, 0.04, 'nav', 3.2)));
    // 翼尖的白色閃光燈（在航行燈後面一點）
    main.push(mesh(span([tip.le.x - 0.85, tip.le.y - 0.05, side * 30.82 - 0.07], [tip.le.x - 0.6, tip.le.y + 0.05, side * 30.82 + 0.07], 0.03), mat.lamp('#ffffff', 0.04, 'strobe', 5)));
    piece('wings', main, [0, 2.5, side * 7], 3);
    // 縫翼：機翼前緣的兩段，起飛降落時往前、往下伸出來
    for (const [a, b] of [[5.5, 17.2], [17.2, 29.5]]) {
      const secs = WP.range(a, b);
      const A = hingePoint(secs[0], 0.09);
      const B = hingePoint(secs[secs.length - 1], 0.09);
      const pg = pivoted([mesh(loft(secs, 0, 0.088, {nF: 10}), whiteM)], A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.slats.push({grp: pg, axis, base: pg.position.clone(), side});
      piece('slats', [pg], [3.5, 3.2, side * 7], 3);
    }
    // 襟翼滑軌罩：機翼下面像小船一樣的長條，裡面是襟翼滑出去的軌道
    {
      const fg = [];
      for (const z of [7.5, 12.5, 17.8]) {
        const sec = WP.at(z);
        const L = sec.c * 0.62 + 1.2;
        const pts = [];
        for (let i = 0; i <= 18; i++) {
          const u = i / 18;
          pts.push(new THREE.Vector2(0.001 + 0.34 * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.75) * (1 - 0.55 * u), u * L));
        }
        const g = new THREE.LatheGeometry(pts, 20);
        g.scale(0.75, 1, 1);
        g.rotateZ(Math.PI / 2);
        const f0 = 0.5;
        const lo = sec.le.clone().addScaledVector(CHORD_DIR, f0 * sec.c).addScaledVector(sec.up, naca(f0, sec.t, sec.camber)[1] * sec.c);
        g.translate(lo.x, lo.y - 0.12, lo.z);
        fg.push(g);
      }
      piece('fairings', [mesh(merge(fg), whiteM)], [0, 1.0, side * 7], 3);
    }
    // 翼尖小翼：往上彎起來
    const tipY = WP.at(30.9).le.y;
    const WL = [
      [30.9, 0, -13.81, 2.89, 0],
      [31.7, 0.12, -14.35, 2.65, 15],
      [32.15, 0.45, -14.85, 2.35, 40],
      [32.33, 1.05, -15.45, 1.95, 68],
      [32.37, 1.9, -16.15, 1.5, 84],
      [32.37, 2.9, -16.95, 0.95, 88],
    ].map(([z, dy, lex, c, phi]) => ({
      le: new THREE.Vector3(lex, tipY + dy, side * z),
      c,
      t: 0.085,
      camber: 0.015,
      up: new THREE.Vector3(0, Math.cos(phi * deg), -side * Math.sin(phi * deg)),
    }));
    piece('winglets', [mesh(loft(WL, 0, 1), whiteM)], [0, 4, side * 11], 3);
    // 襟翼（兩段）：繞著前緣的轉軸往下轉，同時往後滑（富勒襟翼）
    for (const [a, b] of [[3.4, 10.8], [10.8, 19]]) {
      const secs = WP.range(a, b);
      const A = hingePoint(secs[0], 0.78);
      const B = hingePoint(secs[secs.length - 1], 0.78);
      const pg = pivoted([mesh(loft(secs, 0.775, 1), whiteM)], A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.flaps.push({grp: pg, axis, base: pg.position.clone(), side});
      piece('flaps', [pg], [-4, 1.6, side * 7], 3);
    }
    // 副翼
    {
      const secs = WP.range(24, 29.3);
      const A = hingePoint(secs[0], 0.78);
      const B = hingePoint(secs[secs.length - 1], 0.78);
      const pg = pivoted([mesh(loft(secs, 0.775, 1), whiteM)], A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.ailerons.push({grp: pg, axis, side});
      piece('ailerons', [pg], [-4, 3, side * 8.5], 3);
    }
    // 擾流板：貼在上表面的六片薄板，前緣是轉軸
    for (let i = 0; i < 6; i++) {
      const za = 4.2 + i * 2.4;
      const zb = za + 2.3;
      const secs = WP.range(za, zb);
      const shape = (f, s) => {
        const [yu] = naca(f, s.t, s.camber);
        return [yu * s.c + 0.05, yu * s.c + 0.005];
      };
      const A = secs[0].le.clone().addScaledVector(CHORD_DIR, 0.56 * secs[0].c).addScaledVector(secs[0].up, naca(0.56, secs[0].t, 0.02)[0] * secs[0].c);
      const B = secs[secs.length - 1].le.clone().addScaledVector(CHORD_DIR, 0.56 * secs[secs.length - 1].c).addScaledVector(secs[secs.length - 1].up, naca(0.56, secs[secs.length - 1].t, 0.02)[0] * secs[secs.length - 1].c);
      const pg = pivoted([mesh(loft(secs, 0.56, 0.76, {nF: 6, shape}), mat.plastic('#e4e5e2', 0.4))], A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.spoilers.push({grp: pg, axis, side});
      piece('spoilers', [pg], [0, 5, side * 7], 3);
    }
    // 油箱：翅膀裡面的一大塊（看透視才看得到）
    const tank = WP.range(1.2, 27).map((s) => ({...s, le: s.le.clone().addScaledVector(CHORD_DIR, 0.12 * s.c), c: s.c * 0.52, t: s.t * 1.45}));
    fuelObjs.push(mesh(loft(tank, 0.02, 0.98), fuelM));
  }
  fuelObjs.push(mesh(span([xAt(38), CY - 2.8, -1.5], [xAt(31), CY - 1.6, 1.5], 0.3), fuelM));
  piece('fuelTank', fuelObjs, [0, 1.2, 0], 3);

  // ================= 第二層：客艙 =================
  {
    // 客艙地板
    const fl = mesh(span([xAt(66), FLOOR_Y - 0.08, -2.82], [xAt(6.4), FLOOR_Y, 2.82], 0.03), mat.plastic('#45434a', 0.9));
    const aisle = [];
    for (const z of [-0.95, 0.95]) aisle.push(span([xAt(63.5), FLOOR_Y, z - 0.25], [xAt(9), FLOOR_Y + 0.005, z + 0.25], 0.002));
    const cl = [14, 30, 46, 60].map((t) => {
      const l = new THREE.PointLight('#ffe9c8', 1.1, 3.2, 1.6);
      l.position.set(xAt(t), FLOOR_Y + 2.0, 0);
      l.userData.light = 'cabin';
      return l;
    });
    piece('cabinFloor', [fl, mesh(merge(aisle), mat.plastic('#5d5a62', 0.95)), ...cl], [0, 3, 0], 2);
  }
  // 座椅：用 InstancedMesh，一種艙等一種顏色
  const seatGeo = (w, depth, back) =>
    merge([
      span([-depth / 2, 0.42, -w / 2], [depth / 2, 0.52, w / 2], 0.04),
      (() => {
        const b = span([-0.06, 0, -w / 2], [0.06, back, w / 2], 0.05);
        b.rotateZ(-0.16);
        b.translate(-depth / 2 + 0.02, 0.5, 0);
        return b;
      })(),
      span([-0.18, 0, -w / 2 + 0.04], [0.18, 0.42, w / 2 - 0.04], 0.02),
    ]);
  const instanced = (geo, m, spots, id, vec) => {
    const im = new THREE.InstancedMesh(geo, m, spots.length);
    const M = new THREE.Matrix4();
    spots.forEach(([x, z, ry = 0], i) => {
      M.makeRotationY(ry).setPosition(x, FLOOR_Y, z);
      im.setMatrixAt(i, M);
    });
    im.castShadow = im.receiveShadow = true;
    piece(id, [im], vec, 2);
    parts[id].count = spots.length;
    return im;
  };
  {
    // 頭等艙：4 間有牆的小套房（1-2-1）
    const suite = merge([
      span([-1.1, 0, -0.5], [1.1, 1.25, -0.44], 0.02),
      span([-1.1, 0, 0.44], [1.1, 1.25, 0.5], 0.02),
      span([1.04, 0, -0.5], [1.1, 1.25, 0.5], 0.02),
      span([-0.2, 0, -0.4], [0.5, 0.5, 0.4], 0.06),
      (() => {
        const b = span([-0.08, 0, -0.38], [0.08, 0.95, 0.38], 0.05);
        b.translate(0.46, 0.45, 0);
        return b;
      })(),
      span([-1.0, 0, -0.35], [-0.5, 0.65, 0.35], 0.04),
    ]);
    instanced(suite, mat.plastic('#c8b08a', 0.5), [[xAt(10.6), -2.0], [xAt(10.6), -0.55], [xAt(10.6), 0.55], [xAt(10.6), 2.0]], 'first', [0, 6, 0]);
    // 商務艙：40 個（1-2-1，10 排）
    const pod = merge([seatGeo(0.62, 0.66, 0.95), span([-0.8, 0, -0.38], [-0.7, 1.05, 0.38], 0.03), span([-0.75, 0, 0.32], [0.45, 0.72, 0.38], 0.03)]);
    const biz = [];
    for (let r = 0; r < 10; r++) for (const z of [-2.0, -0.55, 0.55, 2.0]) biz.push([xAt(12.8 + r * 1.3), z]);
    instanced(pod, mat.plastic('#8a6444', 0.55), biz, 'business', [0, 6.5, 0]);
    // 豪華經濟艙：36 個（2-4-2，最後一排只有中間 4 個）
    const pe = [];
    for (let r = 0; r < 5; r++) for (const z of r < 4 ? [-2.25, -1.75, -0.75, -0.25, 0.25, 0.75, 1.75, 2.25] : [-0.75, -0.25, 0.25, 0.75]) pe.push([xAt(29.2 + r * 0.97), z]);
    instanced(seatGeo(0.48, 0.5, 0.82), mat.plastic('#6f5845', 0.6), pe, 'premium', [0, 7.5, 0]);
    // 經濟艙：270 個（3-3-3，30 排，3 號門前後分兩段）
    const zs = [-2.3, -1.84, -1.38, -0.46, 0, 0.46, 1.38, 1.84, 2.3];
    const ecGeo = seatGeo(0.44, 0.46, 0.78);
    const ecMat = mat.plastic('#4a3c33', 0.6);
    let ecCount = 0;
    for (const [t0, rows] of [[35, 13], [49.6, 17]]) {
      const ec = [];
      for (let r = 0; r < rows; r++) for (const z of zs) ec.push([xAt(t0 + r * 0.82), z]);
      instanced(ecGeo, ecMat, ec, 'economy', [0, 8.5, 0]);
      ecCount += ec.length;
    }
    parts.economy.count = ecCount;
  }
  {
    // 駕駛艙：兩張椅子、儀表板、側邊的小搖桿
    const out = [];
    const seat = merge([seatGeo(0.55, 0.55, 0.9)]);
    for (const z of [-0.55, 0.55]) {
      const s = mesh(seat, mat.plastic('#2c2f33', 0.7));
      s.position.set(xAt(4.9), CY - 1.25, z);
      out.push(s);
    }
    out.push(mesh(span([xAt(3.75), CY - 1.25, -1.15], [xAt(3.15), CY - 0.35, 1.15], 0.08), mat.plastic('#2a2d31', 0.6)));
    const scr = new THREE.MeshStandardMaterial({color: '#0f1b2b', emissive: '#2a6fd6', emissiveIntensity: 0.55, roughness: 0.3});
    for (const z of [-0.85, -0.3, 0.3, 0.85]) {
      const g = span([xAt(3.74), CY - 0.85, z - 0.22], [xAt(3.72), CY - 0.5, z + 0.22], 0.01);
      out.push(mesh(g, scr));
    }
    for (const z of [-1.0, 1.0]) out.push(mesh(rod([xAt(4.75), CY - 0.85, z], [xAt(4.7), CY - 0.62, z], 0.025, 8), mat.dark()));
    out.push(mesh(span([xAt(6.3), CY - 1.3, -1.4], [xAt(6.25), CY + 1.0, 1.4], 0.02), mat.plastic('#d9d4c8', 0.8)));
    piece('cockpit', out, [9, 6, 0], 2);
  }
  {
    // 廚房：1、2、4 號門旁邊；洗手間：2、3、4 號門旁邊
    // 每個位置各自一塊，名牌和鏡頭才會指到真的東西（合成一塊的話中心會落在中間空的地方）
    const gMat = mat.plastic('#d6d8db', 0.45);
    const tMat = mat.metal();
    for (const [t0, t1] of [[6.6, 7.6], [25.7, 26.6], [64.9, 66.0]]) {
      const box = span([xAt(t1), FLOOR_Y, -1.3], [xAt(t0), FLOOR_Y + 2.0, 1.3], 0.05);
      const trim = [];
      for (let k = 0; k < 4; k++) for (const x of [xAt(t1) - 0.012, xAt(t0) + 0.012]) trim.push(span([x - 0.01, FLOOR_Y + 0.25 + k * 0.42, -1.2], [x + 0.01, FLOOR_Y + 0.29 + k * 0.42, 1.2], 0.004));
      piece('galley', [mesh(box, gMat), mesh(merge(trim), tMat)], [0, 10, 0], 2);
    }
    const lMat = mat.plastic('#f1f2f3', 0.4);
    for (const group of [[[28.6, -2.0], [28.6, 2.0]], [[46.4, -1.95], [46.4, 1.95]], [[63.2, -0.5], [63.2, 0.5]]]) {
      const l = group.map(([t, z]) => span([xAt(t + 0.45), FLOOR_Y, z - 0.45], [xAt(t - 0.45), FLOOR_Y + 2.0, z + 0.45], 0.06));
      piece('lav', [mesh(merge(l), lMat)], [0, 10, 0], 2);
    }
    // 行李櫃：兩邊和中間
    const bMat = mat.plastic('#ece9e2', 0.45);
    for (const [t0, t1] of [[9.2, 25.6], [29, 46], [49, 63]]) {
      const b = [];
      for (const s of [-1, 1]) b.push(span([xAt(t1), FLOOR_Y + 1.62, s * 1.75], [xAt(t0), FLOOR_Y + 2.05, s * 2.42], 0.06));
      b.push(span([xAt(t1), FLOOR_Y + 1.78, -0.62], [xAt(t0), FLOOR_Y + 2.12, 0.62], 0.06));
      // 行李櫃下緣的燈條（客艙燈）
      const strip = [-1, 1].map((s2) => span([xAt(t1) + 0.1, FLOOR_Y + 1.6, s2 * 1.76 - 0.04], [xAt(t0) - 0.1, FLOOR_Y + 1.63, s2 * 1.76 + 0.04], 0.01));
      piece('bins', [mesh(merge(b), bMat), mesh(merge(strip), mat.lamp('#ffe7c2', 0.04, 'cabin', 2))], [0, 12, 0], 2);
    }
  }

  // ================= 第四層：肚子（貨艙、起落架） =================
  {
    // LD3 貨櫃：兩個並排，外側下角斜切
    const sh = new THREE.Shape();
    sh.moveTo(0, 0);
    sh.lineTo(0.78, 0);
    sh.lineTo(1.0, 0.45);
    sh.lineTo(1.0, 1.63);
    sh.lineTo(0, 1.63);
    sh.closePath();
    const ld3 = new THREE.ExtrudeGeometry(sh, {depth: 1.53, bevelEnabled: false});
    ld3.rotateY(-Math.PI / 2);
    const left = flipZ(ld3.clone());
    const pair = merge([ld3, left]);
    const cMat = mat.plastic('#b9bec4', 0.45);
    let n = 0;
    for (const [t0, rows] of [[11.2, 9], [48.2, 7]]) {
      const im = new THREE.InstancedMesh(pair, cMat, rows);
      const M = new THREE.Matrix4();
      for (let r = 0; r < rows; r++) {
        M.makeTranslation(xAt(t0 + r * 1.6), CARGO_Y, 0);
        im.setMatrixAt(r, M);
      }
      im.castShadow = im.receiveShadow = true;
      piece('cargo', [im], [0, 3, 0], 4);
      n += rows * 2;
    }
    parts.cargo.count = n;
  }
  const wheelSpin = [];
  const gear = {mains: [], nose: null};
  const tireGeo = (R, w) => {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      pts.push(new THREE.Vector2(R * 0.62 + (R * 0.38) * Math.sin(a), (-w / 2) * Math.cos(a)));
    }
    const g = new THREE.LatheGeometry(pts, 40);
    g.rotateX(Math.PI / 2);
    return g;
  };
  const wheel = (R, w) => {
    const g = new THREE.Group();
    g.add(mesh(tireGeo(R, w), mat.tire()), mesh(cylZ(R * 0.6, w * 0.92, 0, 0, 0, 28), mat.plastic('#9da2a8', 0.35)), mesh(cylZ(R * 0.22, w * 1.0, 0, 0, 0, 16), mat.metal()));
    g.userData.R = R;
    wheelSpin.push(g);
    return g;
  };
  // 主起落架：每邊 6 個輪子（3 排 × 2），往機身中間收
  for (const side of [1, -1]) {
    const objs = [];
    const z0 = side * 5.3;
    const pivotY = 4.7;
    const st = mat.strut();
    objs.push(mesh(rod([XMG, pivotY, z0], [XMG, 1.05, z0], 0.2, 16), st));
    objs.push(mesh(rod([XMG, 3.6, z0], [XMG + 1.4, pivotY, z0 - side * 1.2], 0.08, 8), st));
    objs.push(mesh(span([XMG - 2.05, 0.85, z0 - 0.12], [XMG + 2.05, 1.08, z0 + 0.12], 0.06), st));
    // 扭力臂（支柱前面的 V 形）、液壓管、跟著支柱收的腿門
    objs.push(mesh(merge([rod([XMG + 0.2, 2.3, z0], [XMG + 0.55, 1.85, z0], 0.05, 8), rod([XMG + 0.55, 1.85, z0], [XMG + 0.2, 1.4, z0], 0.05, 8)]), st));
    objs.push(mesh(rod([XMG - 0.22, 4.4, z0 + side * 0.12], [XMG - 0.22, 1.3, z0 + side * 0.12], 0.018, 6), mat.dark()));
    objs.push(mesh(span([XMG - 0.75, 1.75, z0 + side * 0.3 - 0.03], [XMG + 0.75, 4.35, z0 + side * 0.3 + 0.03], 0.04), whiteM));
    const disc = [];
    for (const dx of [-1.75, 0, 1.75])
      for (const dz of [-0.5, 0.5]) {
        const w = wheel(R_MAIN, 0.5);
        w.position.set(XMG + dx, R_MAIN, z0 + dz);
        objs.push(w);
        // 碳煞車盤：藏在輪框裡面
        disc.push(cylZ(R_MAIN * 0.5, 0.36, XMG + dx, R_MAIN, z0 + dz, 20));
      }
    objs.push(mesh(merge(disc), mat.plastic('#2b2c2e', 0.7)));
    const pg = pivoted(objs, new THREE.Vector3(XMG, pivotY, z0));
    gear.mains.push({grp: pg, side});
    piece('mainGear', [pg], [-4, 0, side * 2], 4);
  }
  {
    const objs = [];
    const st = mat.strut();
    const pivotY = 3.5;
    objs.push(mesh(rod([XNG, pivotY, 0], [XNG, R_NOSE, 0], 0.13, 14), st));
    objs.push(mesh(rod([XNG, 2.4, 0], [XNG - 1.3, pivotY, 0], 0.06, 8), st));
    objs.push(mesh(cylZ(0.06, 0.66, XNG, R_NOSE, 0, 10), st));
    for (const dz of [-0.33, 0.33]) {
      const w = wheel(R_NOSE, 0.38);
      w.position.set(XNG, R_NOSE, dz);
      objs.push(w);
    }
    // 滑行燈
    objs.push(mesh(span([XNG + 0.12, 2.0, -0.12], [XNG + 0.22, 2.22, 0.12], 0.03), mat.lamp('#fff6dc', 0.04, 'taxi', 5)));
    const pg = pivoted(objs, new THREE.Vector3(XNG, pivotY, 0));
    // 鼻輪艙門：起落架放下時往下打開，收起來以後關上
    const doors = [];
    for (const s2 of [-1, 1]) {
      const hinge = new THREE.Vector3(XNG + 0.9, 3.42, s2 * 0.6);
      const d = pivoted([mesh(span([XNG - 0.4, 3.42 - 0.6, s2 * 0.6 - 0.02], [XNG + 2.2, 3.42, s2 * 0.6 + 0.02], 0.02), goldM)], hinge);
      doors.push({grp: d, side: s2});
    }
    gear.nose = {grp: pg, doors};
    piece('noseGear', [pg, ...doors.map((d) => d.grp)], [6, 0, 0], 4);
  }

  // ================= 第五層：引擎 =================
  const fans = [];
  for (const side of [1, -1]) {
    const x0 = 6.6;
    const YE = 2.65;
    const zE = side * ZE;
    const lathe = (pts, seg = 64) => {
      const g = new THREE.LatheGeometry(pts.map(([r, x]) => new THREE.Vector2(r, x)), seg);
      // Lathe 繞 y 軸；轉成繞 x 軸、+x 朝前
      g.rotateZ(-Math.PI / 2);
      g.translate(x0, YE, zE);
      return g;
    };
    // 外殼（金色）、進氣口唇緣（鍍鉻）、內壁（深灰）
    const cowl = [
      mesh(lathe([[1.62, -0.32], [1.78, -0.7], [1.88, -1.4], [1.9, -2.3], [1.83, -3.6], [1.64, -4.8], [1.5, -5.3]].map(([r, x]) => [r, x]).reverse()), goldM),
      (() => {
        const m = mesh(lathe([[1.45, -0.32], [1.44, -0.12], [1.5, -0.01], [1.58, 0], [1.66, -0.08], [1.72, -0.2], [1.64, -0.34]].reverse()), mat.chrome());
        m.material.side = THREE.DoubleSide;
        return m;
      })(),
    ];
    const innerWall = lathe([[1.45, -0.3], [1.48, -1.4], [1.47, -3.6], [1.38, -5.3]]);
    const iw = mesh(innerWall, mat.plastic('#3b3e42', 0.5));
    iw.material.side = THREE.DoubleSide;
    cowl.push(iw);
    // 核心外殼和排氣錐
    cowl.push(mesh(lathe([[1.18, -4.9], [1.12, -5.8], [0.98, -6.6], [0.82, -7.3]].reverse()), goldM));
    cowl.push(mesh(lathe([[0.66, -6.9], [0.58, -7.5], [0.4, -8.1], [0.12, -8.6], [0.001, -8.68]].reverse()), mat.chrome()));
    // 吊架：從引擎頂部往上接到機翼下面
    const py = [];
    const ps = new THREE.Shape();
    ps.moveTo(-0.6, 1.75);
    ps.quadraticCurveTo(-1.4, 2.35, -2.6, 2.45);
    ps.lineTo(-7.2, 2.5);
    ps.quadraticCurveTo(-9.4, 2.4, -10.0, 1.95);
    ps.lineTo(-7.8, 1.45);
    ps.lineTo(-5.0, 1.6);
    ps.closePath();
    const pg = new THREE.ExtrudeGeometry(ps, {depth: 0.6, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.12, bevelSegments: 3, curveSegments: 12});
    pg.translate(x0, YE, zE - 0.3);
    py.push(mesh(pg, goldM));
    // 引擎外殼的接縫（反推力罩的分界）
    for (const [dx, r] of [[-2.3, 1.905], [-4.55, 1.68]]) {
      const ring = new THREE.TorusGeometry(r, 0.018, 6, 72);
      ring.rotateY(Math.PI / 2);
      ring.translate(x0 + dx, YE, zE);
      cowl.push(mesh(ring, mat.plastic('#6b5530', 0.5)));
    }
    piece('engine', cowl, [0, -1.2, side * 3], 5);
    piece('pylon', py, [0, 2.5, side * 3], 5);
    // 風扇：22 片彎彎的葉片＋鍍鉻整流錐
    const fan = new THREE.Group();
    fan.position.set(x0 - 0.95, YE, zE);
    const blades = [];
    for (let i = 0; i < 22; i++) {
      const pos = [];
      const idx = [];
      const NR = 8;
      for (let k = 0; k <= NR; k++) {
        const r = 0.52 + (0.93 * k) / NR;
        const chord = 0.32 + 0.22 * (k / NR);
        const twist = (55 - 35 * (k / NR)) * deg;
        const sweep = 0.1 * (k / NR) ** 2;
        for (const s of [-0.5, 0.5]) {
          const u = s * chord;
          pos.push(-sweep + u * Math.cos(twist), r, u * Math.sin(twist));
        }
      }
      for (let k = 0; k < NR; k++) {
        const a = k * 2;
        idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setIndex(idx);
      g.computeVertexNormals();
      g.rotateX((i / 22) * Math.PI * 2);
      blades.push(g);
    }
    const bm = mat.metal();
    bm.side = THREE.DoubleSide;
    bm.color.set('#9aa0a7');
    const spin = new THREE.Group();
    spin.add(mesh(merge(blades), bm));
    const cone = new THREE.ConeGeometry(0.55, 1.0, 32);
    cone.rotateZ(-Math.PI / 2);
    cone.translate(0.45, 0, 0);
    spin.add(mesh(cone, mat.chrome()));
    spin.add(mesh(cylX(0.55, 0.3, -0.1, 0, 0, 32), mat.chrome()));
    fan.add(spin);
    fans.push(spin);
    piece('fan', [fan], [8, -1.2, side * 3], 5);
    // 核心：一層一層的壓縮機和渦輪（拆開往後才看得到）
    const core = [];
    const rings = [];
    for (let i = 0; i < 10; i++) {
      const r = 0.95 - i * 0.045;
      rings.push(cylX(r, 0.12, x0 - 1.8 - i * 0.26, YE, zE, 32));
    }
    core.push(mesh(merge(rings), mat.plastic('#b8a27a', 0.35)));
    core.push(mesh(cylX(0.62, 0.6, x0 - 4.6, YE, zE, 32), mat.plastic('#d0633a', 0.4)));
    const turb = [];
    for (let i = 0; i < 6; i++) turb.push(cylX(0.62 + i * 0.05, 0.1, x0 - 5.2 - i * 0.24, YE, zE, 32));
    core.push(mesh(merge(turb), mat.plastic('#7a7f86', 0.35)));
    core.push(mesh(cylX(0.14, 4.4, x0 - 3.6, YE, zE, 12), mat.metal()));
    piece('core', core, [-8, -1.2, side * 3], 5);
  }
  {
    // 輔助動力（APU）：尾巴裡的小引擎
    const g = [cylX(0.5, 2.0, xAt(70.6), CY + 1.55, 0, 20), cylX(0.3, 1.1, xAt(72.2), CY + 1.8, 0, 16)];
    piece('apu', [mesh(merge(g), mat.plastic('#8f949a', 0.35))], [-6, 2, 0], 5);
  }

  return {root, att, rollG, parts, pieces, surf, gear, fans, wheelSpin};
}
