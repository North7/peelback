// 星宇航空 A350-1000「空山金」：全部用程式產生，單位公尺（真實大小），整台在 root 縮成 1/6 放進場景。
// x 往機頭，y 往上，z 往右翼。尺寸照 Airbus 公開規格：機長 73.79、翼展 64.75、機高 17.08、機身寬 5.96。
// 外觀照 Aron 那台 1:200 模型的照片：金色機身和引擎、白色機翼和水平尾翼、金色垂直尾翼上白色標誌、
// 鍍鉻的引擎進氣口和尾錐、機身上大小兩行 STARLUX AIRSORAYAMA。
// 2026-11-24 起：機翼、尾翼、舵面、引擎（Trent XWB）、起落架換成 Sketchfab 下載的精細模型（tools/plane_export.py → plane/sk/），
// 機身還是程式畫，但每一站的寬高照下載的 A350-1000 外殼量（plane_meas.json），塗裝、窗戶燈、拆開的方式都不變。
import * as THREE from 'three';
import {unzlibSync} from 'three/addons/libs/fflate.module.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import SK_ZIP from './sk/plane.bin';
import SK_META from './sk/plane.json';
import MEAS from './sk/plane_meas.json';

export const SCALE = 1 / 6;
export const LEN = 73.79;
const NOSE_X = LEN / 2;
const SK_DX = NOSE_X - SK_META.NOSE_X; // 下載的模型機頭在 37.06，挪到這裡的機頭
export const CY = MEAS.CY; // 機身中心離地（量的：5.92）
const RZ = 3.07;
export const FLOOR_Y = CY - 0.95; // 客艙地板
const CARGO_Y = CY - 2.66;
export const XMG = 0.77 + SK_DX; // 主起落架（中間那一排輪子）
const XNG = 32.6 + SK_DX; // 鼻輪
const MAIN_Z = 5.45;
export const R_MAIN = 0.68; // 主輪半徑（1400 mm 輪胎）
export const R_NOSE = 0.53;
const ENG = {x: 9.83 + SK_DX, y: 3.41, z: 10.53}; // 風扇中心

// ---------- 下載的模型 ----------
const SK_BIN = unzlibSync(SK_ZIP);
function skGeo(g) {
  const q = new Uint16Array(SK_BIN.buffer, SK_BIN.byteOffset + g.pos, g.nv * 3);
  const pos = new Float32Array(g.nv * 3);
  const [x0, y0, z0, sx, sy, sz] = g.q;
  for (let i = 0; i < g.nv; i++) {
    pos[i * 3] = x0 + q[i * 3] * sx + SK_DX;
    pos[i * 3 + 1] = y0 + q[i * 3 + 1] * sy;
    pos[i * 3 + 2] = z0 + q[i * 3 + 2] * sz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const o = SK_BIN.byteOffset;
  geo.setIndex(new THREE.BufferAttribute(g.idx16 !== undefined ? new Uint16Array(SK_BIN.buffer, o + g.idx16, g.ni) : new Uint32Array(SK_BIN.buffer, o + g.idx, g.ni), 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return geo;
}
/** 某個零件的幾組網格：tag 是「R|cowl」「L|tire|0.77,-6.05」這種，side 篩左右（R、L、C） */
const skGroups = (part, side = null, kind = null) =>
  SK_META.groups.filter((g) => g.part === part && (!side || g.tag.startsWith(side + '|')) && (!kind || g.tag.split('|')[1] === kind));
/** 一組網格的頂點（世界座標） */
const vertsOf = (meshes) => {
  const out = [];
  for (const m of meshes) {
    const p = m.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) out.push(new THREE.Vector3().fromBufferAttribute(p, i));
  }
  return out;
};
/** 舵面的轉軸：前緣（x 最大）在內側和外側（或下面和上面）各取一點 */
function hingeOf(meshes, along, rear = false) {
  const v = vertsOf(meshes);
  const lo = Math.min(...v.map((p) => p[along]));
  const hi = Math.max(...v.map((p) => p[along]));
  const pick = (a, b) => v.filter((p) => p[along] >= a && p[along] <= b).reduce((m, p) => (rear ? p.x < m.x : p.x > m.x) ? p : m, new THREE.Vector3(rear ? 1e9 : -1e9, 0, 0));
  const span = hi - lo;
  return [pick(lo, lo + span * 0.08), pick(hi - span * 0.08, hi)];
}
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
// 照下載的 A350-1000 外殼量的（tools/plane_export.py）；機翼根部那幾站被機翼、整流罩擋住量不準，跳過
const STATIONS = [
  [0, 0.0, 0.0, -1.45],
  ...MEAS.STATIONS.filter(([t, rz, ry]) => t > 0.2 && (t < 6.2 || t > 53 || Math.abs(ry - rz) < 0.2) && t < 72.5),
  [LEN, 0.22, 0.22, 1.36],
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
/** 下載的機頭、機尾外殼：照「離機頭多遠、繞機身幾度」算 uv，和程式畫的機身用同一張塗裝貼圖 */
function skinGeo(g) {
  const geo = skGeo(g);
  const p = geo.attributes.position;
  const uv = new Float32Array(p.count * 2);
  const left = g.tag.startsWith('L');
  for (let i = 0; i < p.count; i++) {
    const t = NOSE_X - p.getX(i);
    let th = Math.atan2(p.getZ(i) / Math.max(0.05, fRz(t)), (p.getY(i) - CY - fDy(t)) / Math.max(0.05, fRy(t)));
    if (left) th += Math.PI * 2;
    else if (th < 0) th = 0;
    uv[i * 2] = t / LEN;
    uv[i * 2 + 1] = th / (Math.PI * 2);
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}
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
    const out = [...skGroups('noseSkin').map((g) => mesh(skinGeo(g), liveryM)), mesh(fuseGeo(0.6, T_NOSE, 0, Math.PI * 2, {grow: -0.12, inside: true}), creamM)];
    // 雨刷：收在擋風玻璃下緣
    for (const s2 of [-1, 1]) {
      const a = fusePoint(2.65, s2 * 0.12, 0.04);
      const b = fusePoint(3.15, s2 * 0.62, 0.04);
      out.push(mesh(rod([a.x, a.y, a.z], [b.x, b.y, b.z], 0.025, 6), mat.dark()));
    }
    // 駕駛艙窗戶：下載的模型（A350 招牌的「浣熊眼罩」黑框窗）
    const glassM = new THREE.MeshPhysicalMaterial({color: '#0d1318', roughness: 0.08, metalness: 0.2, clearcoat: 1, envMapIntensity: 1.1});
    for (const g of skGroups('nose')) out.push(mesh(skGeo(g), glassM));
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
    // 肚子：機身底部加上白色的機腹整流罩（包住機翼根部和主起落架艙；下載的模型）
    const belly = shell(...BOT);
    for (const g of skGroups('belly')) belly.push(mesh(skGeo(g), whiteM));
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
    const out = [...skGroups('tailSkin').map((g) => mesh(skinGeo(g), liveryM)), mesh(fuseGeo(T_TAIL, LEN - 0.6, 0, Math.PI * 2, {grow: -0.1, inside: true}), creamM)];
    // 尾巴最尖端：輔助動力的排氣口（下載的模型）、白色的尾燈
    for (const g of skGroups('tailcone')) out.push(mesh(skGeo(g), mat.chrome()));
    const tipY = CY + fDy(LEN - 0.3) + fRy(LEN - 0.3) * 0.9;
    out.push(mesh(span([xAt(LEN - 0.35), tipY - 0.02, -0.07], [xAt(LEN - 0.2), tipY + 0.1, 0.07], 0.03), mat.lamp('#ffffff', 0.04, 'nav', 3)));
    piece('tailcone', out, [-11, 2.5, 0], 1);
  }

  // 垂直尾翼和方向舵（下載的模型）
  const surf = {flaps: [], ailerons: [], spoilers: [], elevators: [], rudder: null, slats: []};
  const ray = new THREE.Raycaster();
  /** 從 o 往 d 打一條線，打到 meshes 的第一個點和法線 */
  const castOn = (meshes, o, d) => {
    ray.set(o, d);
    const h = ray.intersectObjects(meshes, false)[0];
    return h ? {p: h.point.clone(), n: h.face.normal.clone()} : null;
  };
  /** 某個高度（或某個 z）附近，網格最前面的 x（前緣） */
  const leAt = (verts, key, v) => {
    // 頂點很稀：先每 0.5 公尺取一次前緣，沒有點的地方用上下兩站內插
    const cache = (verts.__le ||= {});
    if (!cache[key]) {
      const lo = Math.min(...verts.map((p) => p[key]));
      const hi = Math.max(...verts.map((p) => p[key]));
      const rows = [];
      for (let s = lo; s <= hi + 1e-6; s += 0.5) {
        const near = verts.filter((p) => Math.abs(p[key] - s) < 0.4);
        if (near.length) rows.push([s, Math.max(...near.map((p) => p.x))]);
      }
      cache[key] = rows;
    }
    const rows = cache[key];
    if (v <= rows[0][0]) return rows[0][1];
    for (let i = 0; i < rows.length - 1; i++)
      if (v <= rows[i + 1][0]) return rows[i][1] + ((rows[i + 1][1] - rows[i][1]) * (v - rows[i][0])) / (rows[i + 1][0] - rows[i][0]);
    return rows[rows.length - 1][1];
  };
  let logoC = new THREE.Vector3(-28, 11.7, 0);
  {
    const finM = skGroups('fin').map((g) => mesh(skGeo(g), goldM));
    const out = [...finM];
    const fv = vertsOf(finM);
    // 尾翼兩面的白色標誌：照前緣的後掠斜斜排，一點一點投到尾翼表面上
    const logo = finLogo();
    const Y0 = 9.9;
    logoC = new THREE.Vector3(leAt(fv, 'y', Y0 + 1.8) - 2.3, Y0 + 1.8, 0);
    for (const side of [1, -1]) {
      const lm = new THREE.MeshStandardMaterial({map: logo, transparent: true, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false});
      const g = decal((a, b) => {
        const y = Y0 + b * 3.6;
        const le = leAt(fv, 'y', y);
        // 左邊：圖的右邊往機尾；右邊：圖的右邊往機頭
        const x = side < 0 ? le - 0.5 - a * 3.6 : le - 4.1 + a * 3.6;
        const h = castOn(finM, new THREE.Vector3(x, y, side * 3), new THREE.Vector3(0, 0, -side));
        if (!h) return [new THREE.Vector3(x, y, side * 0.2), new THREE.Vector3(0, 0, side)];
        if (h.n.z * side < 0) h.n.negate();
        return [h.p, h.n];
      }, 10, 10, 0.03);
      const o = new THREE.Mesh(g, lm);
      o.renderOrder = 1;
      out.push(o);
    }
    // 尾翼頂端的白色閃光燈
    const ymax = Math.max(...fv.map((p) => p.y));
    const top = fv.filter((p) => p.y > ymax - 0.2);
    const tx = top.reduce((m, p) => m + p.x, 0) / top.length;
    out.push(mesh(span([tx - 0.15, ymax - 0.05, -0.08], [tx + 0.15, ymax + 0.09, 0.08], 0.03), mat.lamp('#ffffff', 0.04, 'strobe', 5)));
    piece('fin', out, [-5, 9, 0], 1);
    const rm = skGroups('rudder').map((g) => mesh(skGeo(g), goldM));
    const [A, B] = hingeOf(rm, 'y');
    const pg = pivoted(rm, A);
    surf.rudder = {grp: pg, axis: B.clone().sub(A).normalize()};
    piece('rudder', [pg], [-9, 9, 0], 1);
  }
  // 水平尾翼和升降舵（左右各一）
  for (const side of [1, -1]) {
    const S = side > 0 ? 'R' : 'L';
    const sm = skGroups('stab', S).map((g) => mesh(skGeo(g), whiteM));
    const out = [...sm];
    // 標誌燈：水平尾翼上面一顆燈，往上照著垂直尾翼的標誌
    {
      const sv = vertsOf(sm);
      const zz = side * 7.4;
      let near = sv.filter((p) => Math.abs(p.z - zz) < 0.6);
      if (near.length < 2) near = sv.filter((p) => Math.abs(p.z - zz) < 2.5);
      const le = near.length ? Math.max(...near.map((p) => p.x)) : -30;
      const te = near.length ? Math.min(...near.map((p) => p.x)) : -33;
      const lx = le - 0.35 * (le - te);
      const h = castOn(sm, new THREE.Vector3(lx, 40, zz), new THREE.Vector3(0, -1, 0));
      const lp = h ? h.p : new THREE.Vector3(lx, CY + 1.6, zz);
      out.push(mesh(span([lp.x - 0.15, lp.y - 0.02, lp.z - 0.08], [lp.x + 0.15, lp.y + 0.1, lp.z + 0.08], 0.03), mat.lamp('#fff3dc', 0.04, 'logo', 3)));
      const spot = new THREE.SpotLight('#fff1d8', 2.2, 9, 0.38, 0.7, 1);
      spot.position.copy(lp).add(new THREE.Vector3(0, 0.15, 0));
      spot.target.position.copy(logoC);
      spot.userData.light = 'logo';
      out.push(spot, spot.target);
    }
    piece('stab', out, [-8, 1, side * 6], 1);
    const em = skGroups('elevator', S).map((g) => mesh(skGeo(g), whiteM));
    const [A, B] = hingeOf(em, 'z');
    const pg = pivoted(em, A);
    const axis = B.clone().sub(A).normalize();
    if (axis.z < 0) axis.negate();
    surf.elevators.push({grp: pg, axis});
    piece('elevator', [pg], [-11, 1, side * 7], 1);
  }

  // ================= 第三層：機翼（下載的模型） =================
  // 機翼每一站的前緣、後緣、高度（tools/plane_export.py 切出來的）：給油箱、翼尖燈、擾流板定位
  const WT = SK_META.WING.map(([z, le, te, yle, ytop, ybot]) => ({z, le: le + SK_DX, te: te + SK_DX, yle, ytop, ybot}));
  const wingAt = (z) => {
    let i = 0;
    while (i < WT.length - 2 && z > WT[i + 1].z) i++;
    const a = WT[i];
    const b = WT[i + 1];
    const k = Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z)));
    const o = {};
    for (const key of ['le', 'te', 'yle', 'ytop', 'ybot']) o[key] = a[key] + (b[key] - a[key]) * k;
    return o;
  };
  const wingSec = (z, side) => {
    const w = wingAt(z);
    const c = w.le - w.te;
    return {le: new THREE.Vector3(w.le, w.yle, side * z), c, t: Math.min(0.14, (w.ytop - w.ybot) / c), camber: 0.02, up: new THREE.Vector3(0, 1, 0)};
  };
  /** 一塊有厚度的薄板：top 是上表面的格點（nu × nv），往下長 th */
  const slab = (top, nu, nv, th) => {
    const pos = [];
    for (const p of top) pos.push(p.x, p.y, p.z);
    for (const p of top) pos.push(p.x, p.y - th, p.z);
    const idx = [];
    const N = top.length;
    const at = (u, v) => u * nv + v;
    for (let u = 0; u < nu - 1; u++)
      for (let v = 0; v < nv - 1; v++) {
        const a = at(u, v);
        const b = at(u + 1, v);
        const c = at(u, v + 1);
        const d = at(u + 1, v + 1);
        idx.push(a, c, b, b, c, d, a + N, b + N, c + N, b + N, d + N, c + N);
      }
    const ring = [];
    for (let u = 0; u < nu; u++) ring.push(at(u, 0));
    for (let v = 1; v < nv; v++) ring.push(at(nu - 1, v));
    for (let u = nu - 2; u >= 0; u--) ring.push(at(u, nv - 1));
    for (let v = nv - 2; v > 0; v--) ring.push(at(0, v));
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % ring.length];
      idx.push(a, b, a + N, b, b + N, a + N);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };
  const fuelM = new THREE.MeshStandardMaterial({color: '#f0a43a', emissive: '#a0520a', emissiveIntensity: 0.25, roughness: 0.5, transparent: true, opacity: 0.85});
  const fuelObjs = [];
  const sideMeshes = (part, S, kind = null, m = whiteM) => skGroups(part, S, kind).map((g) => mesh(skGeo(g), m));
  for (const side of [1, -1]) {
    const S = side > 0 ? 'R' : 'L';
    const wm = sideMeshes('wings', S);
    const main = [...wm];
    // 翼尖的導航燈（左紅右綠）和白色閃光燈
    {
      const tip = WT[WT.length - 1];
      const y = tip.yle;
      const z = side * (tip.z + 0.05);
      main.push(mesh(span([tip.le - 0.55, y - 0.06, z - 0.08], [tip.le - 0.25, y + 0.06, z + 0.08], 0.03), mat.lamp(side > 0 ? COL.green : COL.red, 0.04, 'nav', 3.2)));
      main.push(mesh(span([tip.le - 0.9, y - 0.05, z - 0.07], [tip.le - 0.65, y + 0.05, z + 0.07], 0.03), mat.lamp('#ffffff', 0.04, 'strobe', 5)));
    }
    piece('wings', main, [0, 2.5, side * 7], 3);
    // 縫翼（機翼根部的下垂前緣）：起飛降落時往前、往下伸出來；轉軸在後緣
    {
      const sm = sideMeshes('slats', S);
      const [A, B] = hingeOf(sm, 'z', true);
      const pg = pivoted(sm, A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.slats.push({grp: pg, axis, base: pg.position.clone(), side});
      piece('slats', [pg], [3.5, 3.2, side * 7], 3);
    }
    // 襟翼滑軌罩：機翼下面像小船一樣的長條
    piece('fairings', sideMeshes('fairings', S), [0, 1.0, side * 7], 3);
    // 翼尖小翼：往上彎起來
    piece('winglets', sideMeshes('winglets', S), [0, 4, side * 11], 3);
    // 襟翼（內側、外側兩段）：繞著前緣往下轉，同時往後滑
    for (const k of ['in', 'out']) {
      const fm = sideMeshes('flaps', S, k);
      const [A, B] = hingeOf(fm, 'z');
      const pg = pivoted(fm, A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.flaps.push({grp: pg, axis, base: pg.position.clone(), side});
      piece('flaps', [pg], [-4, 1.6, side * 7], 3);
    }
    // 副翼
    {
      const am = sideMeshes('ailerons', S);
      const [A, B] = hingeOf(am, 'z');
      const pg = pivoted(am, A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.ailerons.push({grp: pg, axis, side});
      piece('ailerons', [pg], [-4, 3, side * 8.5], 3);
    }
    // 擾流板：襟翼前面、貼在上表面的六片薄板（照機翼真正的上表面一點一點打下來），前緣是轉軸
    const spM = mat.plastic('#e4e5e2', 0.4);
    spM.side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) {
      const za = 4.3 + i * 2.55;
      const zb = za + 2.4;
      const NU = 6;
      const NV = 4;
      const top = [];
      for (let u = 0; u < NU; u++)
        for (let v = 0; v < NV; v++) {
          const z = za + ((zb - za) * u) / (NU - 1);
          const w = wingAt(z);
          const x = w.le - (0.6 + (0.12 * v) / (NV - 1)) * (w.le - w.te);
          const h = castOn(wm, new THREE.Vector3(x, 40, side * z), new THREE.Vector3(0, -1, 0));
          top.push(new THREE.Vector3(x, (h ? h.p.y : w.ytop) + 0.03, side * z));
        }
      const A = top[0].clone();
      const B = top[(NU - 1) * NV].clone();
      const pg = pivoted([mesh(slab(side > 0 ? top : top, NU, NV, 0.05), spM)], A);
      const axis = B.clone().sub(A).normalize();
      if (axis.z < 0) axis.negate();
      surf.spoilers.push({grp: pg, axis, side});
      piece('spoilers', [pg], [0, 5, side * 7], 3);
    }
    // 油箱：翅膀裡面的一大塊（看透視才看得到）
    // 每一站在弦長 40% 的地方往上、往下打線，量真的上下表面，油箱放正中間、厚度留六成
    const tank = [];
    for (let z = 3.6; z <= 27; z += 1.2) {
      const w = wingAt(z);
      const c = w.le - w.te;
      const x = w.le - 0.4 * c;
      const up = castOn(wm, new THREE.Vector3(x, -10, side * z), new THREE.Vector3(0, 1, 0));
      const dn = castOn(wm, new THREE.Vector3(x, 40, side * z), new THREE.Vector3(0, -1, 0));
      if (!up || !dn) continue;
      const mid = (up.p.y + dn.p.y) / 2;
      const th = (dn.p.y - up.p.y) * 0.6;
      const tc = c * 0.42;
      tank.push({le: new THREE.Vector3(w.le - 0.19 * c, mid, side * z), c: tc, t: Math.max(0.02, th / tc / 1.0), camber: 0, up: new THREE.Vector3(0, 1, 0)});
    }
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
  /** 機身在某一站、某個高度的半寬（機尾往上翹、變窄，那裡的靠窗座位放不下） */
  const halfW = (t, y) => {
    const k = (y - CY - fDy(t)) / fRy(t);
    return fRz(t) * Math.sqrt(Math.max(0, 1 - k * k));
  };
  const instanced = (geo, m, spots0, id, vec) => {
    const spots = spots0.filter(([x, z]) => Math.abs(z) + 0.3 < halfW(NOSE_X - x, FLOOR_Y + 0.7) - 0.12);
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
      ecCount += parts.economy.count;
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
    for (const [t0, t1] of [[9.2, 25.6], [29, 46], [49, 57.5]]) {
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
  const tireM = mat.tire();
  const rimM = mat.plastic('#b9bdc2', 0.3);
  rimM.metalness = 0.7;
  const strutM = mat.strut();
  /** 起落架：支柱一組，每顆輪子（輪胎＋輪框）各自一組，繞自己的軸轉 */
  const gearObjs = (part, S, R) => {
    const objs = skGroups(part, S, 'strut').map((g) => mesh(skGeo(g), strutM));
    const wheels = {};
    for (const g of SK_META.groups.filter((g) => g.part === part && g.tag.startsWith(S + '|') && g.tag.split('|')[1] !== 'strut')) {
      const [, kind, at] = g.tag.split('|');
      (wheels[at] ||= []).push(mesh(skGeo(g), kind === 'tire' ? tireM : rimM));
    }
    for (const [at, ms] of Object.entries(wheels)) {
      const [x, z] = at.split(',').map(Number);
      const w = pivoted(ms, new THREE.Vector3(x + SK_DX, R, z));
      w.userData.R = R;
      wheelSpin.push(w);
      objs.push(w);
    }
    return objs;
  };
  // 主起落架：每邊 6 個輪子（3 排 × 2），往機身中間收
  for (const side of [1, -1]) {
    const objs = gearObjs('mainGear', side > 0 ? 'R' : 'L', R_MAIN);
    const pg = pivoted(objs, new THREE.Vector3(XMG, 4.75, side * MAIN_Z));
    gear.mains.push({grp: pg, side});
    piece('mainGear', [pg], [-4, 0, side * 2], 4);
  }
  {
    const objs = gearObjs('noseGear', 'C', R_NOSE);
    // 滑行燈
    objs.push(mesh(span([XNG + 0.32, 1.9, -0.12], [XNG + 0.42, 2.1, 0.12], 0.03), mat.lamp('#fff6dc', 0.04, 'taxi', 5)));
    const pivotY = 3.05;
    const pg = pivoted(objs, new THREE.Vector3(XNG, pivotY, 0));
    // 鼻輪艙門：起落架放下時往下打開，收起來以後關上
    const doors = [];
    const by = fusePoint(NOSE_X - XNG, Math.PI).y + 0.05;
    for (const s2 of [-1, 1]) {
      const hinge = new THREE.Vector3(XNG + 0.9, by, s2 * 0.6);
      const d = pivoted([mesh(span([XNG - 0.2, by - 0.5, s2 * 0.6 - 0.012], [XNG + 1.9, by, s2 * 0.6 + 0.012], 0.01), goldM)], hinge);
      doors.push({grp: d, side: s2});
    }
    gear.nose = {grp: pg, doors};
    piece('noseGear', [pg, ...doors.map((d) => d.grp)], [6, 0, 0], 4);
  }

  // ================= 第五層：引擎（Rolls-Royce Trent XWB，下載的模型） =================
  const fans = [];
  const chromeM = mat.chrome();
  chromeM.side = THREE.DoubleSide;
  const bladeM = new THREE.MeshStandardMaterial({color: '#a3a8ae', roughness: 0.32, metalness: 0.9, side: THREE.DoubleSide});
  const coreM = new THREE.MeshStandardMaterial({color: '#a9adb2', roughness: 0.38, metalness: 0.75, side: THREE.DoubleSide});
  const coreDM = new THREE.MeshStandardMaterial({color: '#6d7278', roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide});
  const nozzleM = new THREE.MeshStandardMaterial({color: '#4b4e52', roughness: 0.5, metalness: 0.6, side: THREE.DoubleSide});
  const cowlM = mat.gold();
  cowlM.side = THREE.DoubleSide;
  for (const side of [1, -1]) {
    const S = side > 0 ? 'R' : 'L';
    const byKind = (part, kind, m) => skGroups(part, S, kind).map((g) => mesh(skGeo(g), m));
    // 外殼（金色）、進氣口唇緣（鍍鉻）
    piece('engine', [...byKind('engine', 'cowl', cowlM), ...byKind('engine', 'lip', chromeM)], [0, -1.2, side * 3], 5);
    piece('pylon', skGroups('pylon', S).map((g) => mesh(skGeo(g), goldM)), [0, 2.5, side * 3], 5);
    // 風扇：22 片彎彎的葉片＋整流錐，整組繞引擎的軸轉
    const spin = pivoted([...byKind('fan', 'blade', bladeM), ...byKind('fan', 'spinner', chromeM)], new THREE.Vector3(ENG.x, ENG.y, side * ENG.z));
    fans.push(spin);
    piece('fan', [spin], [8, -1.2, side * 3], 5);
    // 核心：壓縮機、燃燒室、渦輪、排氣口
    piece('core', [...byKind('core', 'core', coreM), ...byKind('core', 'core_d', coreDM), ...byKind('core', 'nozzle', nozzleM), ...byKind('core', 'plug', chromeM)], [-8, -1.2, side * 3], 5);
  }
  {
    // 輔助動力（APU）：尾巴裡的小引擎
    const g = [cylX(0.5, 2.0, xAt(70.6), CY + 1.55, 0, 20), cylX(0.3, 1.1, xAt(72.2), CY + 1.8, 0, 16)];
    piece('apu', [mesh(merge(g), mat.plastic('#8f949a', 0.35))], [-6, 2, 0], 5);
  }

  return {root, att, rollG, parts, pieces, surf, gear, fans, wheelSpin};
}
