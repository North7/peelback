// 特斯拉 Model Y 新版（2025「Juniper」），單位公尺，整台在 root 放大 2 倍（和公車差不多大）。
// x 往車頭，y 往上，z 往右。
// 外殼、輪子用 Sketchfab 上 BloxBloger 做的「2025 Tesla Model Y」（CC BY-NC 4.0，非商業、要寫作者），
// 在 Blender 照位置拆成零件、換成這裡的座標（tools/sk_export.py → car/sk/）。座椅、儀表板用模型的；方向盤、螢幕、扶手台、
// 前後車廂是照汽車之家 2027 款全景和實車照片自己做的（ref/car/int/）。底盤、電池是簡化的示意。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import SK_ZIP from './sk/model.bin';
import SK_META from './sk/model.json';
import IN_ZIP from './sk/inner.bin';
// 模型檔是 zlib 壓縮過的，位置存成 0–65535 的整數（每組記最小值和間距）
import {loadBins} from '../kit/load.js';
// 3D 資料：點進汽車時才下載、解壓（preload 做完才 build）
let SK_BIN = null;
let IN_BIN = null;
export async function preload(onp) {
  [SK_BIN, IN_BIN] = await loadBins([SK_ZIP, IN_ZIP], onp);
}
function dequant(buf, off, g) {
  const q = new Uint16Array(buf, off, g.nv * 3);
  const out = new Float32Array(g.nv * 3);
  const [x0, y0, z0, sx, sy, sz] = g.q;
  for (let i = 0; i < g.nv; i++) {
    out[i * 3] = x0 + q[i * 3] * sx;
    out[i * 3 + 1] = y0 + q[i * 3 + 1] * sy;
    out[i * 3 + 2] = z0 + q[i * 3 + 2] * sz;
  }
  return out;
}
import IN_META from './sk/inner.json';
import CAR_IMG from '../kit/img/car.webp';

export const SCALE = 2;
export const LEN = 4.79;
const SXZ = 1, SY = 1;
export const AX_F = SK_META.AX_F;
export const AX_R = SK_META.AX_R;
export const R_TIRE = SK_META.R; // 255/45R19
const TRACK = 0.818; // 輪距 1,636 mm
export const FLOOR = 0.44;

const COL = {paint: '#8e9297', black: '#121315', glass: '#0d1216', tire: '#1b1c1e', rim: '#c8ccd1', seat: '#e8e4dc', alu: '#b9bdc2', chassis: '#2f3236'};
const mat = {
  black: () => new THREE.MeshStandardMaterial({color: COL.black, roughness: 0.55}),
  gloss: () => new THREE.MeshPhysicalMaterial({color: '#0b0c0e', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05}),
  plastic: (c, r = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: r}),
  metal: () => new THREE.MeshStandardMaterial({color: '#7d838a', roughness: 0.4, metalness: 0.8}),
  alu: () => new THREE.MeshStandardMaterial({color: COL.alu, roughness: 0.42, metalness: 0.75}),
  chrome: () => new THREE.MeshStandardMaterial({color: '#e6e8ea', roughness: 0.12, metalness: 1}),
  tire: () => new THREE.MeshStandardMaterial({color: COL.tire, roughness: 0.9}),
  // light：屬於哪一組燈（燈光面板開關它）；on：打開時的發光強度
  lamp: (c, light, on = 3.2, off = 0.04, base = c) => {
    const m = new THREE.MeshStandardMaterial({color: base, emissive: c, emissiveIntensity: off, roughness: 0.2, side: THREE.DoubleSide});
    m.userData.light = light;
    m.userData.lamp = {on, off};
    return m;
  },
};

// ---------- 小工具 ----------
const rbox = (w, h, d, r = 0.02, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
const span = (a, b, r = 0.01, seg = 3) => {
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
const cylY = (r, y0, y1, x, z, seg = 16) => {
  const g = new THREE.CylinderGeometry(r, r, y1 - y0, seg);
  g.translate(x, (y0 + y1) / 2, z);
  return g;
};
const cylZ = (r, len, x, y, z, seg = 24) => {
  const g = new THREE.CylinderGeometry(r, r, len, seg);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
};
const rod = (a, b, r, seg = 10) => {
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
const loadTex = (url, srgb = true) => {
  const t = new THREE.TextureLoader().load(url);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// ---------- 下載的模型 ----------
/** 從 model.bin 讀一組網格（位置 float32、法線 int8、索引） */
function skGeo(g) {
  const buf = SK_BIN.buffer;
  const o = SK_BIN.byteOffset;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dequant(buf, o + g.pos, g), 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Int8Array(buf, o + g.nor, g.nv * 3), 3, true));
  geo.setIndex(new THREE.BufferAttribute(g.idx16 !== undefined ? new Uint16Array(buf, o + g.idx16, g.ni) : new Uint32Array(buf, o + g.idx, g.ni), 1));
  geo.computeBoundingBox();
  geo.computeBoundingSphere();
  return clean(geo);
}
/** 側窗的法線：左右兩邊（z 的正負）各自統一成那一邊玻璃面的平均方向；裡面那一面的法線照原本朝裡 */
function flatSideGlass(geo) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, idx = geo.index;
  const sum = {[-1]: new THREE.Vector3(), [1]: new THREE.Vector3()};
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
  for (let t = 0; t < idx.count; t += 3) {
    a.fromBufferAttribute(pos, idx.getX(t));
    b.fromBufferAttribute(pos, idx.getX(t + 1));
    c.fromBufferAttribute(pos, idx.getX(t + 2));
    n.subVectors(c, b).cross(a.clone().sub(b));
    const side = a.z + b.z + c.z < 0 ? -1 : 1;
    if (n.z * side < 0) n.negate(); // 一律朝外再加（裡外兩面才不會互相抵消）
    sum[side].add(n);
  }
  for (const k of [-1, 1]) if (sum[k].lengthSq() > 0) sum[k].normalize();
  const out = new Float32Array(pos.count * 3);
  const o = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const side = pos.getZ(i) < 0 ? -1 : 1;
    o.fromBufferAttribute(nor, i);
    const f = sum[side];
    const sg = o.dot(f) < 0 ? -1 : 1;
    out[i * 3] = f.x * sg;
    out[i * 3 + 1] = f.y * sg;
    out[i * 3 + 2] = f.z * sg;
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}
/** 車身漆的法線：同一個位置、方向相近（35 度內）的點當成同一點，沿三角形的邊和鄰居平均一次。
 *  模型在 C 柱、車尾這種彎得急的地方點很少，原本的法線一塊一塊轉折，亮光漆一反光就像凹凸不平的鈑金；
 *  平均一次能把轉折抹順，車身的稜線（夾角大於 35 度）不受影響 */
function smoothPaint(geo, iters = 1) {
  const P = geo.attributes.position, N = geo.attributes.normal, I = geo.index, n = P.count;
  const nr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const x = N.getX(i), y = N.getY(i), z = N.getZ(i), l = Math.hypot(x, y, z) || 1;
    nr[i * 3] = x / l; nr[i * 3 + 1] = y / l; nr[i * 3 + 2] = z / l;
  }
  const byPos = new Map(), id = new Int32Array(n), reps = [];
  for (let i = 0; i < n; i++) {
    const k = Math.round(P.getX(i) * 1e4) + ',' + Math.round(P.getY(i) * 1e4) + ',' + Math.round(P.getZ(i) * 1e4);
    let list = byPos.get(k);
    if (!list) byPos.set(k, (list = []));
    let f = -1;
    for (const r of list) if (nr[i * 3] * nr[r * 3] + nr[i * 3 + 1] * nr[r * 3 + 1] + nr[i * 3 + 2] * nr[r * 3 + 2] > 0.82) { f = r; break; }
    if (f < 0) { list.push(i); reps.push(i); f = i; }
    id[i] = f;
  }
  const nb = new Map();
  const link = (a, b) => { a = id[a]; b = id[b]; if (a !== b) (nb.get(a) || nb.set(a, new Set()).get(a)).add(b); };
  for (let t = 0; t < I.count; t += 3) {
    const a = I.getX(t), b = I.getX(t + 1), c = I.getX(t + 2);
    link(a, b); link(b, a); link(b, c); link(c, b); link(c, a); link(a, c);
  }
  let cur = nr;
  for (let it = 0; it < iters; it++) {
    const nx = Float32Array.from(cur);
    for (const r of reps) {
      const s = nb.get(r);
      if (!s) continue;
      let x = cur[r * 3], y = cur[r * 3 + 1], z = cur[r * 3 + 2];
      for (const q of s) { x += cur[q * 3]; y += cur[q * 3 + 1]; z += cur[q * 3 + 2]; }
      const l = Math.hypot(x, y, z) || 1;
      nx[r * 3] = x / l; nx[r * 3 + 1] = y / l; nx[r * 3 + 2] = z / l;
    }
    cur = nx;
  }
  const out = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const r = id[i] * 3; out[i * 3] = cur[r]; out[i * 3 + 1] = cur[r + 1]; out[i * 3 + 2] = cur[r + 2]; }
  geo.setAttribute('normal', new THREE.BufferAttribute(out, 3));
}
/** 底盤、電池、馬達（另外下載的模型）：位置 float32、索引，法線現算 */
function innerGeo(g) {
  const buf = IN_BIN.buffer;
  const o = IN_BIN.byteOffset;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(dequant(buf, o + g.pos, g), 3));
  geo.setIndex(new THREE.BufferAttribute(g.idx16 !== undefined ? new Uint16Array(buf, o + g.idx16, g.ni) : new Uint32Array(buf, o + g.idx, g.ni), 1));
  geo.computeVertexNormals();
  geo.computeBoundingBox();
  return clean(geo);
}
function innerParts() {
  const out = {};
  const cache = new Map();
  for (const g of IN_META.groups) {
    if (!cache.has(g.mat)) {
      const c = IN_META.colors[g.mat] || [0.6, 0.6, 0.6];
      const metal = g.mat === 'du' || g.part === 'casting';
      cache.set(g.mat, new THREE.MeshStandardMaterial({color: new THREE.Color().setRGB(c[0], c[1], c[2]), roughness: metal ? 0.42 : 0.55, metalness: metal ? 0.75 : 0.2, side: THREE.DoubleSide}));
    }
    const o = mesh(innerGeo(g), cache.get(g.mat));
    (out[g.part] ||= []).push(o);
    if (g.tag) (out[g.part + g.tag[0]] ||= []).push(o);
  }
  return out;
}

/** 模型的材質名字 → 這裡的材質（車漆是快銀灰；燈接到燈光面板） */
function skMaterial(name, part, tag = '') {
  // 車尾下方（擴散器、拖車鉤座）：模型用了銀色和鍍鉻，實車是黑色塑膠
  if (part === 'rear' && (name === 'Material_2125767099' || name === 'chrome')) return new THREE.MeshStandardMaterial({color: '#1c1d1f', roughness: 0.6, side: THREE.DoubleSide});
  if (tag === 'head') return Object.assign(mat.lamp('#fff3d6', 'head', 4.5, 0.03, '#3a3d42'), {side: THREE.DoubleSide});
  if (tag === 'turn') return mat.lamp('#f2f6ff', 'bar', 3.6, 0.12, '#e8edf2');
  const f = SK_META.materials[name] || [0.5, 0.5, 0.5, 1];
  const base = new THREE.Color().setRGB(f[0], f[1], f[2]);
  const phys = (o) => new THREE.MeshPhysicalMaterial({side: THREE.DoubleSide, ...o});
  // 尾門上的尾燈燈殼（光條下半截沒有燈罩蓋著的那一塊）：和燈罩一樣是亮面的黑，關燈時整條尾燈都是黑的
  if (name === 'black_base' && part === 'liftgate') return phys({color: '#040405', roughness: 0.1, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 0.35});
  switch (name) {
    case 'Material_2125765635':
      // 車身漆：新款 Model Y 的水銀灰（Quicksilver），照特斯拉官網照片：偏中性的深灰、帶金屬感，表面亮光漆有清楚但不刺眼的反光
      return phys({color: '#56565b', metalness: 0.65, roughness: 0.36, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 0.85});
    case 'glass_base':
      if (part === 'liftgate') return phys({color: '#060709', roughness: 0.25, specularIntensity: 0.12, envMapIntensity: 0.12, transparent: true, opacity: 0.96, depthWrite: false});
      // 擋風玻璃：太陽和棚燈在玻璃上的倒影收弱，不然從前上方看會像車裡有一團白光
      if (part === 'windshield') return phys({color: '#0c1215', roughness: 0.06, metalness: 0.1, specularIntensity: 0.12, transparent: true, opacity: 0.6, envMapIntensity: 0.25, depthWrite: false});
      return phys({color: '#0c1215', roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.8, envMapIntensity: 0.55, depthWrite: false});
    case 'glass_roof_panorama':
      return phys({color: '#060709', roughness: 0.22, specularIntensity: 0.15, envMapIntensity: 0.15, transparent: true, opacity: 0.96, depthWrite: false});
    case 'glass_headlight222':
      // 尾燈、尾門光條的燈罩：黑色的亮面燻黑玻璃（新款 Model Y 關著的時候是黑的，亮起來才是一條細細的紅光；照實車照片）
      if (part !== 'front') return phys({color: '#050607', roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.95, envMapIntensity: 0.35, depthWrite: false});
      return phys({color: '#dfe6ea', roughness: 0.05, transparent: true, opacity: 0.22, envMapIntensity: 0.8, depthWrite: false});
    case 'front_white_light':
      return mat.lamp('#f2f6ff', 'bar', 3.6, 0.12, '#e8edf2');
    case 'back_red_Light':
    case 'material':
      // 尾燈裡的發光條：關著時藏在煙燻燈罩後面、幾乎是黑的，開燈才亮紅
      return mat.lamp('#ff2a1e', 'tail', 3.4, 0.02, '#26100e');
    case 'red_plastic':
      // 車尾保險桿下面的兩片反光片是紅的；尾燈燈殼裡那塊關著時是暗的
      if (part === 'rear') return mat.lamp('#a01812', 'tail', 1.4, 0.05, '#7a1813');
      return mat.lamp('#a01812', 'tail', 1.4, 0.02, '#24100e');
    case 'mirror':
      return mat.chrome();
    case 'chrome':
      return new THREE.MeshStandardMaterial({color: '#c9ccd0', roughness: 0.3, metalness: 1});
    case 'Rubber_Rough':
    case 'Rubber_Rough222':
      return new THREE.MeshStandardMaterial({color: '#1d1e20', roughness: 0.92});
    case 'Material_2125767099': // 銀色空力輪圈
      return new THREE.MeshStandardMaterial({color: '#9ea3a9', roughness: 0.4, metalness: 0.7, envMapIntensity: 0.8});
    case 'black_reflection':
      return phys({color: '#0b0c0e', roughness: 0.12, clearcoat: 0.5, clearcoatRoughness: 0.2});
    case 'Iron_Clean_Distorted':
      return new THREE.MeshStandardMaterial({color: '#7b8087', roughness: 0.45, metalness: 0.8});
    default:
      return new THREE.MeshStandardMaterial({color: base, roughness: 0.6, metalness: 0.05, side: THREE.DoubleSide});
  }
}

/** 打一條射線到車身，拿表面上的點和朝外的法線 */
const _rc = new THREE.Raycaster();
function hit(meshes, o, d) {
  _rc.set(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize());
  const h = _rc.intersectObjects(meshes, false)[0];
  if (!h) return null;
  const n = h.face.normal.clone();
  if (n.dot(_rc.ray.direction) > 0) n.negate();
  return {p: h.point, n};
}
/** 貼在車身表面的細長燈條：samples = [[原點, 方向, 半寬], ...]，寬度沿著車身表面「往上」 */
function ribbon(meshes, samples, lift = 0.0025) {
  const pos = [];
  const idx = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const [o, d, hw] of samples) {
    const h = hit(meshes, o, d);
    if (!h) continue;
    const t = up.clone().sub(h.n.clone().multiplyScalar(up.dot(h.n))).normalize();
    const c = h.p.clone().addScaledVector(h.n, lift);
    const a = c.clone().addScaledVector(t, hw);
    const b = c.clone().addScaledVector(t, -hw);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  for (let i = 0; i < pos.length / 6 - 1; i++) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return clean(g);
}
const lerp = (a, b, k) => a + (b - a) * k;
/** 加色發光的材質：關著時完全看不到，亮的時候疊在下面的東西上（方向燈、尾燈照在車身上的紅光） */
function glowMat(color, light, on, map = null) {
  const m = new THREE.MeshStandardMaterial({color: '#000000', emissive: color, emissiveMap: map, emissiveIntensity: 0, roughness: 1, metalness: 0, envMapIntensity: 0,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2});
  m.userData.light = light;
  m.userData.lamp = {on, off: 0};
  return m;
}
/** 同一塊網格往外推一點點的複本（疊加層用） */
function shellCopy(o, d = 0.0015) {
  const g = o.geometry.clone();
  const p = g.attributes.position, n = g.attributes.normal;
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + n.getX(i) * d, p.getY(i) + n.getY(i) * d, p.getZ(i) + n.getZ(i) * d);
  return g;
}
/**
 * 一整格沿 +x 的射線（y、z 都在 [y0, y1]×[z0, z1] 裡）：先挑出這塊範圍裡的三角形，每條射線只試這些。
 * 結果和 hit() 一樣（最近的交點、法線朝向射線來的方向、單面材質不打背面），但不用每條都把整台車身試一遍
 * （尾燈紅光 1300 多條射線，原本手機上要 2 秒多）
 */
function xHitter(meshes, y0, y1, z0, z1) {
  const tris = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (const o of meshes) {
    o.updateMatrixWorld(true);
    const g = o.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
    const mats = [].concat(o.material);
    const groups = Array.isArray(o.material) && g.groups.length ? g.groups : [{start: 0, count: n, materialIndex: 0}];
    for (const gr of groups) {
      const side = mats[gr.materialIndex || 0]?.side;
      if (side === undefined) continue;
      for (let k = gr.start, e = Math.min(n, gr.start + gr.count); k + 2 < e; k += 3) {
        const ia = I ? I.getX(k) : k, ib = I ? I.getX(k + 1) : k + 1, ic = I ? I.getX(k + 2) : k + 2;
        a.fromBufferAttribute(P, ia).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(P, ib).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(P, ic).applyMatrix4(o.matrixWorld);
        if (Math.max(a.y, b.y, c.y) < y0 || Math.min(a.y, b.y, c.y) > y1 || Math.max(a.z, b.z, c.z) < z0 || Math.min(a.z, b.z, c.z) > z1) continue;
        const la = new THREE.Vector3().fromBufferAttribute(P, ia), lb = new THREE.Vector3().fromBufferAttribute(P, ib), lc = new THREE.Vector3().fromBufferAttribute(P, ic);
        tris.push({a: a.clone(), b: b.clone(), c: c.clone(), n: THREE.Triangle.getNormal(la, lb, lc, new THREE.Vector3()), side});
      }
    }
  }
  const ray = new THREE.Ray(), pt = new THREE.Vector3();
  return (o, d) => {
    ray.set(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize());
    let best = null, bd = Infinity;
    for (const t of tris) {
      const r = t.side === THREE.BackSide ? ray.intersectTriangle(t.c, t.b, t.a, true, pt) : ray.intersectTriangle(t.a, t.b, t.c, t.side === THREE.FrontSide, pt);
      if (!r) continue;
      const dd = ray.origin.distanceTo(pt);
      if (dd < bd) (bd = dd), (best = {p: pt.clone(), n: t.n});
    }
    if (!best) return null;
    const n = best.n.clone();
    if (n.dot(ray.direction) > 0) n.negate();
    return {p: best.p, n};
  };
}
/** 尾燈照在下面斜面上的紅光：一格一格往車身表面打射線，貼一片由上往下變淡的發光面 */
function spillGlow(meshes, z0, z1, yTop, yBot, m) {
  const NZ = 40, NY = 10;
  const xhit = xHitter(meshes, Math.min(yTop, yBot) - 1e-4, Math.max(yTop, yBot) + 1e-4, Math.min(z0, z1) - 1e-4, Math.max(z0, z1) + 1e-4);
  const pos = [], uv = [], idx = [];
  const grid = [];
  for (let j = 0; j <= NY; j++) {
    const row = [];
    for (let i = 0; i <= NZ; i++) {
      const z = lerp(z0, z1, i / NZ), y = lerp(yTop, yBot, j / NY);
      const h = xhit([-4, y, z], [1, 0, 0]);
      if (h && h.p.x < -1.75 && Math.abs(h.n.z) < 0.45 && h.n.x < -0.1) { // 貼在尾燈下方朝後、朝下的斜面；朝側面的燈殼不要（會漏光）
        const q = h.p.clone().addScaledVector(h.n, 0.003);
        row.push(pos.length / 3);
        pos.push(q.x, q.y, q.z);
        uv.push(i / NZ, 1 - j / NY);
      } else row.push(-1);
    }
    grid.push(row);
  }
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NZ; i++) {
      const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i], d = grid[j + 1][i + 1];
      if (a < 0 || b < 0 || c < 0 || d < 0) continue;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const o = new THREE.Mesh(g, m);
  o.renderOrder = 2;
  return o;
}
let _spillTex = null;
/** 紅光的漸層：上緣最亮（燈條就在上面），往下淡掉；左右兩端也淡掉 */
function spillTex() {
  return (_spillTex ||= canvasTex(256, 64, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, '#ffffff');
    v.addColorStop(0.25, '#9a9a9a');
    v.addColorStop(0.6, '#2a2a2a');
    v.addColorStop(1, '#000000');
    g.fillStyle = v;
    g.fillRect(0, 0, w, h);
    const e = g.createLinearGradient(0, 0, w, 0);
    e.addColorStop(0, 'rgba(0,0,0,0.85)');
    e.addColorStop(0.06, 'rgba(0,0,0,0)');
    e.addColorStop(0.94, 'rgba(0,0,0,0)');
    e.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = e;
    g.fillRect(0, 0, w, h);
  }));
}

// ---------- 車子裡面（照新款 Model Y 的實車照片：ref/car/all/59.jpg、ref/car/int/） ----------
/** 圓角長方形的平面外形（中心在原點） */
function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
/** 平面外形 → 面朝 +z 的平面，貼圖座標照外框攤滿 */
function flatShape(shape, w, h, seg = 6) {
  const g = new THREE.ShapeGeometry(shape, seg);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}
/** 固定的亂數（每次畫出來的紋路都一樣，縮圖才不會每次不同） */
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** 儀表板中間那條深灰色織布（2027 款實車：比上下的塑膠淺一點的灰） */
function fabricTex() {
  const t = canvasTex(512, 64, (g, w, h) => {
    const r = rng(7);
    g.fillStyle = '#4b4c50';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5200; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.1)';
      g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 1);
  return t;
}
/** 中控螢幕：特斯拉的淺色介面。左邊是這台車自己的圖，右邊是地圖，最下面一排圖示 */
function frontScreenTex(W = 1024, H = 640) {
  const draw = (g, img) => {
    g.fillStyle = '#f4f5f7';
    g.fillRect(0, 0, W, H);
    // 地圖
    const mx = W * 0.4, mw = W - mx, mh = H * 0.88;
    g.save();
    g.beginPath();
    g.rect(mx, 0, mw, mh);
    g.clip();
    g.fillStyle = '#ebede6';
    g.fillRect(mx, 0, mw, mh);
    g.fillStyle = '#d3e6c7';
    g.beginPath();
    g.roundRect(mx + mw * 0.62, mh * 0.06, mw * 0.26, mh * 0.24, 18);
    g.fill();
    g.fillStyle = '#bcd8ef';
    g.beginPath();
    g.moveTo(mx, mh * 0.66);
    g.bezierCurveTo(mx + mw * 0.3, mh * 0.56, mx + mw * 0.55, mh * 0.82, W, mh * 0.7);
    g.lineTo(W, mh * 0.8);
    g.bezierCurveTo(mx + mw * 0.55, mh * 0.92, mx + mw * 0.3, mh * 0.66, mx, mh * 0.76);
    g.fill();
    const P = (u, v) => [mx + u * mw, v * mh];
    const road = (lw, col, pts) => {
      g.strokeStyle = col;
      g.lineWidth = lw;
      g.lineCap = g.lineJoin = 'round';
      g.beginPath();
      pts.forEach(([u, v], i) => g[i ? 'lineTo' : 'moveTo'](...P(u, v)));
      g.stroke();
    };
    for (const [lw, pts] of [[20, [[0, 0.34], [1, 0.28]]], [13, [[0.22, 0], [0.3, 1]]], [13, [[0.66, 0], [0.58, 1]]], [10, [[0, 0.52], [1, 0.47]]], [9, [[0.34, 0.05], [0.95, 0.12]]], [9, [[0.05, 0.85], [0.5, 0.97]]]]) {
      road(lw + 4, '#d9dcd5', pts);
      road(lw, '#ffffff', pts);
    }
    // 導航路線和車子的位置
    road(11, '#3e6ae1', [[0.28, 0.92], [0.255, 0.5], [0.24, 0.33], [0.62, 0.3], [0.64, 0.05]]);
    const [ax, ay] = P(0.28, 0.9);
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(ax, ay, 22, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#3e6ae1';
    g.beginPath();
    g.moveTo(ax, ay - 15);
    g.lineTo(ax + 11, ay + 12);
    g.lineTo(ax, ay + 6);
    g.lineTo(ax - 11, ay + 12);
    g.closePath();
    g.fill();
    g.restore();
    // 左上角：檔位和電量
    g.fillStyle = '#9aa0a8';
    g.font = `600 ${H * 0.045}px sans-serif`;
    g.fillText('P  R  N  D', W * 0.03, H * 0.075);
    g.fillStyle = '#17181a';
    g.fillText('P', W * 0.03, H * 0.075);
    g.fillStyle = '#17181a';
    g.fillText('80%', W * 0.3, H * 0.075);
    g.strokeStyle = '#17181a';
    g.lineWidth = 3;
    g.strokeRect(W * 0.255, H * 0.045, W * 0.035, H * 0.035);
    g.fillStyle = '#35c46a';
    g.fillRect(W * 0.258, H * 0.05, W * 0.024, H * 0.025);
    // 車子
    if (img) {
      const iw = W * 0.34, ih = (iw * img.height) / img.width;
      g.drawImage(img, W * 0.03, H * 0.44 - ih / 2, iw, ih);
    }
    // 最下面一排：溫度、圖示
    g.fillStyle = '#ffffff';
    g.fillRect(0, H * 0.88, W, H * 0.12);
    g.fillStyle = '#e1e3e6';
    g.fillRect(0, H * 0.88, W, 2);
    g.fillStyle = '#17181a';
    g.font = `600 ${H * 0.05}px sans-serif`;
    g.fillText('22°', W * 0.2, H * 0.958);
    g.fillStyle = '#5f646b';
    for (const [i, c] of ['#5f646b', '#e8423f', '#35c46a', '#3e6ae1', '#5f646b'].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.roundRect(W * (0.42 + i * 0.07), H * 0.905, H * 0.06, H * 0.06, 9);
      g.fill();
    }
  };
  const tex = canvasTex(W, H, (g) => draw(g, null));
  const img = new Image();
  img.onload = () => {
    draw(tex.image.getContext('2d'), img);
    tex.needsUpdate = true;
  };
  img.src = CAR_IMG;
  return tex;
}
/** 後座螢幕：深色介面，冷氣溫度、風量、座椅加熱和音樂 */
function rearScreenTex(W = 512, H = 320) {
  return canvasTex(W, H, (g) => {
    g.fillStyle = '#111316';
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ffffff';
    g.font = `600 ${H * 0.2}px sans-serif`;
    g.fillText('22°', W * 0.07, H * 0.36);
    g.fillStyle = '#8a9099';
    g.font = `500 ${H * 0.07}px sans-serif`;
    g.fillText('AUTO', W * 0.08, H * 0.48);
    // 風量的條
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i < 4 ? '#3e6ae1' : '#2b2f35';
      g.beginPath();
      g.roundRect(W * (0.07 + i * 0.045), H * (0.66 - i * 0.03), W * 0.03, H * (0.12 + i * 0.03), 4);
      g.fill();
    }
    // 音樂卡片
    g.fillStyle = '#1c1f24';
    g.beginPath();
    g.roundRect(W * 0.46, H * 0.1, W * 0.48, H * 0.62, 14);
    g.fill();
    g.fillStyle = '#e8423f';
    g.beginPath();
    g.roundRect(W * 0.5, H * 0.17, H * 0.3, H * 0.3, 10);
    g.fill();
    g.fillStyle = '#d7dbe0';
    g.fillRect(W * 0.5, H * 0.56, W * 0.4, 4);
    g.fillStyle = '#3e6ae1';
    g.fillRect(W * 0.5, H * 0.56, W * 0.16, 4);
    // 下面一排：座椅加熱
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = i === 1 ? '#ff7a3d' : '#6b717a';
      g.lineWidth = 5;
      g.beginPath();
      g.roundRect(W * (0.3 + i * 0.15), H * 0.8, W * 0.08, H * 0.12, 8);
      g.stroke();
    }
  });
}
/** 從車廂往前（+x）打，找儀表板正面在 (y, z) 這一點的 x；從 x0 開始打，前面的東西（方向盤柱）不算 */
function dashCaster(geos) {
  const T = [];
  for (const g of geos) {
    const p = g.attributes.position, ix = g.index;
    const n = ix ? ix.count : p.count;
    for (let t = 0; t < n; t += 3) {
      const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2;
      T.push([p.getX(a), p.getY(a), p.getZ(a), p.getX(b), p.getY(b), p.getZ(b), p.getX(c), p.getY(c), p.getZ(c)]);
    }
  }
  return (y, z, x0 = 0.52) => {
    let best = Infinity;
    for (const t of T) {
      // 在 y-z 平面上判斷點在不在三角形裡，再用重心座標算 x
      const [ax, ay, az, bx, by, bz, cx, cy, cz] = t;
      if ((y < ay && y < by && y < cy) || (y > ay && y > by && y > cy) || (z < az && z < bz && z < cz) || (z > az && z > bz && z > cz)) continue;
      const d = (by - ay) * (cz - az) - (bz - az) * (cy - ay);
      if (Math.abs(d) < 1e-12) continue;
      const u = ((y - ay) * (cz - az) - (z - az) * (cy - ay)) / d;
      const v = ((by - ay) * (z - az) - (bz - az) * (y - ay)) / d;
      if (u < 0 || v < 0 || u + v > 1) continue;
      const x = ax + u * (bx - ax) + v * (cx - ax);
      if (x > x0 && x < best) best = x;
    }
    return best;
  };
}
/** 貼著儀表板正面的一條帶子：ys 是幾個高度，z 從 -zh 到 zh；碰不到的點沿用旁邊的 */
function dashStrip(cast, ys, zh, off = 0.003, step = 0.025) {
  const zs = [];
  for (let z = -zh; z <= zh + 1e-6; z += step) zs.push(z);
  const pos = [], uv = [], idx = [];
  let prev = null;
  for (const [j, y] of ys.entries()) {
    let last = null;
    const xs = zs.map((z) => cast(y, z, z > -0.52 && z < -0.25 ? 0.52 : 0.3)); // 方向盤柱那一段從前面一點開始打，其他地方從車廂裡打（儀表板有地方比較凸）
    for (let i = 0; i < xs.length; i++) if (isFinite(xs[i])) last = xs[i]; else xs[i] = last;
    last = null;
    for (let i = xs.length - 1; i >= 0; i--) if (xs[i] != null) last = xs[i]; else xs[i] = last ?? 0.64;
    // 碰到旁邊別的東西（螢幕支架、方向盤柱）會突然跳一截：和左右五點的中位數差太多就用中位數
    const sm = xs.map((x, i) => {
      const w = xs.slice(Math.max(0, i - 3), i + 4).sort((a, b) => a - b);
      const m = w[w.length >> 1];
      return Math.abs(x - m) > 0.012 ? m : x;
    });
    if (j > 0) for (let i = 0; i < sm.length; i++) sm[i] = Math.min(Math.max(sm[i], prev[i] - 0.03), prev[i] + 0.03); // 和下面一排差不多
    prev = sm;
    for (const [i, z] of zs.entries()) {
      xs[i] = sm[i];
      pos.push(xs[i] - off, y, z);
      uv.push(i / (zs.length - 1), j / (ys.length - 1));
    }
  }
  const nz = zs.length;
  for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < nz - 1; i++) {
    const a = j * nz + i, b = a + 1, c = a + nz, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
/** 新款 Model Y 的方向盤：圓的、皮革；中間方形的安全氣囊蓋，左右兩個按鍵座各一顆滾輪，
 *  下面一根 V 形的輻條；一條銀色飾條從兩邊按鍵座下緣繞到下面那根輻條（照實車照片）。
 *  在自己的座標裡做：x 往駕駛的右手邊、y 往上、z 朝駕駛 */
function steeringWheel() {
  const g = new THREE.Group();
  const R = 0.16, T = 0.0175;
  const leather = new THREE.MeshStandardMaterial({color: '#1a1b1d', roughness: 0.62});
  const trimM = mat.plastic('#26272b', 0.35);
  g.add(mesh(new THREE.TorusGeometry(R, T, 18, 96), leather));
  // 輻條和按鍵座：一整片外形，擠出厚度
  const s = new THREE.Shape();
  const e = R - 0.004;
  s.moveTo(-e, 0.036);
  s.lineTo(-0.082, 0.036);
  s.quadraticCurveTo(-0.07, 0.058, -0.05, 0.058);
  s.lineTo(0.05, 0.058);
  s.quadraticCurveTo(0.07, 0.058, 0.082, 0.036);
  s.lineTo(e, 0.036);
  s.lineTo(e, -0.024);
  s.lineTo(0.076, -0.03);
  s.quadraticCurveTo(0.06, -0.045, 0.048, -0.072);
  s.lineTo(0.022, -e);
  s.lineTo(-0.022, -e);
  s.lineTo(-0.048, -0.072);
  s.quadraticCurveTo(-0.06, -0.045, -0.076, -0.03);
  s.lineTo(-e, -0.024);
  s.closePath();
  const plate = new THREE.ExtrudeGeometry(s, {depth: 0.022, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 2, curveSegments: 10});
  plate.translate(0, 0, -0.03);
  g.add(mesh(plate, trimM));
  // 安全氣囊蓋：圓角方塊，皮革
  const pad = rbox(0.12, 0.1, 0.034, 0.016, 4);
  pad.translate(0, 0.004, 0.006);
  g.add(mesh(pad, leather));
  // 「TESLA」字樣：壓在氣囊蓋上，幾乎看不出來
  const word = canvasTex(256, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.fillStyle = 'rgba(120,122,126,0.55)';
    c.font = `600 ${h * 0.42}px sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.letterSpacing = '10px';
    c.fillText('TESLA', w / 2, h / 2);
  });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.0175), new THREE.MeshStandardMaterial({map: word, transparent: true, roughness: 0.6, depthWrite: false}));
  lab.position.set(0, 0.018, 0.0235);
  g.add(lab);
  // 銀色飾條
  const chrome = mat.chrome();
  const trim = (pts) => mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y, -0.006))), 40, 0.0026, 6), chrome);
  for (const k of [-1, 1]) {
    g.add(trim([[k * (R - 0.012), -0.022], [k * 0.08, -0.028], [k * 0.058, -0.05], [k * 0.044, -0.08], [k * 0.026, -(R - 0.012)]]));
    g.add(trim([[k * (R - 0.012), 0.034], [k * 0.085, 0.034], [k * 0.068, 0.052]]));
  }
  // 兩邊的滾輪和小按鍵
  const knurl = mat.plastic('#3a3c41', 0.35);
  for (const k of [-1, 1]) {
    const w = new THREE.CylinderGeometry(0.0095, 0.0095, 0.008, 20);
    w.rotateZ(Math.PI / 2);
    w.translate(k * 0.105, 0.006, -0.002);
    g.add(mesh(w, knurl));
    for (const [dx, dy] of [[0.128, 0.018], [0.128, -0.008], [0.085, 0.022]]) {
      const b = rbox(0.011, 0.009, 0.006, 0.003, 2);
      b.translate(k * dx, dy, -0.004);
      g.add(mesh(b, knurl));
    }
  }
  // 轉向柱和左邊的方向燈撥桿
  const col = new THREE.CylinderGeometry(0.034, 0.04, 0.2, 20);
  col.rotateX(Math.PI / 2);
  col.translate(0, -0.005, -0.13);
  g.add(mesh(col, trimM));
  g.add(mesh(rod([-0.03, 0.01, -0.07], [-0.135, 0.0, -0.05], 0.0055, 10), trimM));
  return g;
}
/** 座椅的顏色：淺灰色皮椅（汽車之家 2027 款「黑白」內裝），椅子底座是黑色、扶手也是淺灰 */
function seatPaint(geo) {
  const p = geo.attributes.position, n = p.count, c = new Float32Array(n * 3);
  const W = new THREE.Color('#b9bab9'), K = new THREE.Color('#1c1d1f');
  for (let i = 0; i < n; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let dark = x > -0.4 ? y < 0.6 : y < 0.68; // 椅子底座
    if (x > 0.25 && y > 1.25) dark = true; // 車內後視鏡
    const col = dark ? K : W;
    c[i * 3] = col.r;
    c[i * 3 + 1] = col.g;
    c[i * 3 + 2] = col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
}
/** 置物槽：上口和底都是圓角長方形（從上往下看），四面牆斜斜地連起來，上口外面一圈邊。
 *  top/bot = [中心 x, 前後長, 左右寬, 圓角]，y0 是底、y1 是上口 */
function tubGeo(top, bot, y0, y1, lip = 0.03) {
  const N = 64;
  const ring = ([cx, l, w, r], y, grow = 0) => rrShape(l + grow * 2, w + grow * 2, r + grow).getSpacedPoints(N).slice(0, N).map((p) => [cx + p.x, y, p.y]);
  const A = ring(top, y1), B = ring(bot, y0), L = ring(top, y1, lip);
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    quad(A[i], A[j], B[j], B[i]);
    quad(L[i], L[j], A[j], A[i]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const floor = new THREE.ShapeGeometry(rrShape(bot[1], bot[2], bot[3]), 8);
  floor.rotateX(-Math.PI / 2); // 正面朝上
  floor.translate(bot[0], y0, 0);
  return merge([g, floor]);
}

// ---------- 主體 ----------
export function buildCar() {
  const root = new THREE.Group();
  root.scale.setScalar(SCALE);
  const parts = {};
  const pieces = [];
  const part = (id) => (parts[id] ||= {id, meshes: [], pieces: []});
  const piece = (id, objs, vec, order) => {
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
    root.add(g);
    const p = {id, obj: g, vec: new THREE.Vector3(...vec), order, x: 0, v: 0, target: 0, wait: 0, hinge: 0};
    part(id).pieces.push(p);
    pieces.push(p);
    return g;
  };
  /** 會轉的東西（車門、尾門、前蓋）：外層 pivot 在轉軸上，裡面的網格往回移。 */
  const pivoted = (objs, pivot) => {
    const pg = new THREE.Group();
    pg.position.copy(pivot);
    for (const o of objs) {
      o.position.sub(pivot);
      pg.add(o);
    }
    return pg;
  };
  const open = {doors: [], hood: null, gate: null};
  const inner = innerParts();

  // ================= 第一層：外面（下載的模型） =================
  const shell = {};
  const wheelMesh = {};
  const matCache = new Map();
  for (const g of SK_META.groups) {
    if (g.part === 'interior') {
      // 車子裡面：座椅、儀表板、方向盤用模型的（深灰色皮革和塑膠）
      const im = (matCache.get('int|' + g.tag)) || matCache.set('int|' + g.tag, new THREE.MeshStandardMaterial({color: g.tag === 'seats' ? '#3b3c40' : '#26272a', roughness: 0.72, side: THREE.DoubleSide})).get('int|' + g.tag);
      (shell['int_' + g.tag] ||= []).push(mesh(skGeo(g), im));
      continue;
    }
    // 材質照零件分開快取的：擋風玻璃、尾門、車尾，還有燈罩（車頭透明、車尾紅色，不能共用同一份）
    const key = g.mat + '|' + (['windshield', 'liftgate', 'rear'].includes(g.part) || ['glass_headlight222', 'red_plastic', 'black_base'].includes(g.mat) ? g.part : '') + g.tag;
    if (!matCache.has(key)) matCache.set(key, skMaterial(g.mat, g.part, g.tag));
    const m = matCache.get(key);
    const o = mesh(skGeo(g), m);
    // 側窗（車門玻璃、車身兩側的小窗）：模型的點很少、法線又存得很粗，玻璃像鏡子一樣把誤差放大，倒影變成波浪。
    // 實車的側窗幾乎是平的：每一側的法線統一成那一側玻璃的平均方向。擋風玻璃、後窗本來就是彎的，不動
    if (g.mat === 'glass_base' && !['windshield', 'liftgate'].includes(g.part)) flatSideGlass(o.geometry);
    if (g.mat === 'Material_2125765635') smoothPaint(o.geometry);
    if (g.tag === 'turn') o.userData.turnEnd = true;
    if (m.transparent) o.castShadow = false;
    if (g.part === 'wheels') (wheelMesh[g.tag] ||= []).push(o);
    else if (g.part === 'front' && g.tag) (shell.front ||= []).push(o);
    else (shell[g.part] ||= []).push(o);
  }
  const box = (list) => {
    const b = new THREE.Box3();
    for (const o of list) b.union(o.geometry.boundingBox);
    return b;
  };
  {
    const out = [...(shell.front || [])];
    const amber = glowMat('#ffa526', 'turn', 3.2);
    for (const o of shell.front || []) if (o.userData.turnEnd) out.push(new THREE.Mesh(shellCopy(o), amber));
    piece('front', out, [1.1, 0.25, 0], 1);
  }
  // 前車廂蓋：轉軸在擋風玻璃下緣
  {
    const list = shell.hood || [];
    const b = box(list);
    const pg = pivoted(list, new THREE.Vector3(b.min.x, b.max.y - 0.01, 0));
    open.hood = pg;
    piece('hood', [pg], [0.35, 1.3, 0], 1);
  }
  piece('windshield', shell.windshield || [], [0.55, 1.75, 0], 1);
  piece('roof', shell.roof || [], [0, 2.0, 0], 1);
  // 車門：四扇，轉軸在前緣，往外打開
  for (const [key, side, isFront] of [['doorFR', 1, true], ['doorRR', 1, false], ['doorFL', -1, true], ['doorRL', -1, false]]) {
    const list = shell[key] || [];
    if (!list.length) continue;
    const b = box(list);
    const pg = pivoted(list, new THREE.Vector3(b.max.x - 0.03, (b.min.y + b.max.y) / 2, side > 0 ? b.max.z - 0.05 : b.min.z + 0.05));
    open.doors.push({grp: pg, side, front: isFront});
    piece('doors', [pg], [isFront ? 0.25 : -0.25, 0.25, side * 1.4], 1);
  }
  piece('mirrors', shell.mirrors || [], [0.3, 0.6, 0], 1);
  // 尾門：後窗、鴨尾、中間的尾燈條；轉軸在玻璃車頂後緣，往上掀
  {
    const list = shell.liftgate || [];
    const b = box(list);
    const spill = glowMat('#ff2414', 'tail', 2.6, spillTex());
    list.push(spillGlow(list.filter((o) => !o.material.transparent), -0.66, 0.66, 1.098, 1.0, spill));
    for (const s2 of [1, -1]) shell.tailSide = [...(shell.tailSide || []), spillGlow([...(shell.body || []), ...(shell.rear || [])].filter((o) => !o.material.transparent), s2 * 0.6, s2 * 0.8, 1.095, 1.0, spill)];
    const pg = pivoted(list, new THREE.Vector3(b.max.x - 0.02, b.max.y - 0.01, 0));
    open.gate = pg;
    piece('liftgate', [pg], [-1.0, 1.4, 0], 1);
  }
  piece('rear', shell.rear || [], [-1.15, 0.2, 0], 1);
  piece('body', [...(shell.body || []), ...(shell.tailSide || [])], [0, 1.35, 0], 2);

  // ================= 第二層：車子裡面 =================
  {
    // 地板（深灰地毯）
    const g = [span([AX_R + 0.1, FLOOR - 0.04, -0.82], [1.05, FLOOR, 0.82], 0.02)];
    g.push(span([0.62, FLOOR, -0.82], [1.05, 0.62, 0.82], 0.04)); // 前面的腳踏斜板
    piece('floor', [mesh(merge(g), mat.plastic('#2c2d30', 0.95))], [0, 0.55, -1.0], 3);
  }
  {
    // 座椅：淺灰色皮椅，底座是黑色
    const out = shell.int_seats || [];
    const leatherM = new THREE.MeshStandardMaterial({color: '#ffffff', vertexColors: true, roughness: 0.58, side: THREE.DoubleSide});
    for (const o of out) {
      seatPaint(o.geometry);
      o.material = leatherM;
    }
    piece('seats', out, [0, 0.85, -1.55], 3);
  }
  {
    // 儀表板：上下是深灰，中間一整條灰色織布，織布下面一條細細的出風口，最上緣一條氣氛燈；中央扶手台是淺灰（照汽車之家 2027 款全景）
    const out = [...(shell.int_dash || [])];
    const cast = dashCaster(out.map((o) => o.geometry));
    // 中央扶手台（儀表板模型下面中間那一段）塗淺灰，其他深灰
    {
      const L = new THREE.Color('#c9cacb'), D = new THREE.Color('#26272a');
      const dm = new THREE.MeshStandardMaterial({color: '#ffffff', vertexColors: true, roughness: 0.72, side: THREE.DoubleSide});
      for (const o of out) {
        const p = o.geometry.attributes.position, c = new Float32Array(p.count * 3);
        for (let i = 0; i < p.count; i++) {
          const k = Math.abs(p.getZ(i)) < 0.13 && p.getX(i) < 0.56 && p.getY(i) < 0.92 ? L : D;
          c.set([k.r, k.g, k.b], i * 3);
        }
        o.geometry.setAttribute('color', new THREE.BufferAttribute(c, 3));
        o.material = dm;
      }
    }
    const cloth = new THREE.MeshStandardMaterial({color: '#ffffff', map: fabricTex(), roughness: 0.95, side: THREE.DoubleSide});
    out.push(mesh(dashStrip(cast, [1.0, 1.03, 1.06, 1.09], 0.74), cloth));
    out.push(mesh(dashStrip(cast, [0.974, 0.986], 0.7, 0.004), mat.plastic('#08090a', 0.8)));
    // 氣氛燈：沿著儀表板上緣
    const amb = [];
    for (let z = -0.74; z <= 0.741; z += 0.04) {
      const x = cast(1.108, z);
      if (isFinite(x)) amb.push(new THREE.Vector3(x - 0.004, 1.108, z));
    }
    if (amb.length > 3) out.push(mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(amb), 80, 0.0028, 6), mat.lamp('#7fb3ff', 'ambient', 2.6)));
    const light = new THREE.PointLight('#9cc4ff', 0.9, 2.4, 1.6);
    light.position.set(0.1, 1.1, 0);
    light.userData.light = 'ambient';
    out.push(light);
    // 螢幕下面：銀色邊的梯形框，連到中央扶手台
    const chrome = mat.chrome();
    const A = [0.6, 1.05], B = [0.47, 0.86];
    for (const k of [-1, 1]) out.push(mesh(rod([A[0], A[1], k * 0.075], [B[0], B[1], k * 0.05], 0.0035, 8), chrome));
    out.push(mesh(rod([B[0], B[1], -0.05], [B[0], B[1], 0.05], 0.0035, 8), chrome));
    {
      const q = new THREE.BufferGeometry();
      const v = [[A[0] + 0.006, A[1], -0.075], [A[0] + 0.006, A[1], 0.075], [B[0] + 0.006, B[1], 0.05], [B[0] + 0.006, B[1], -0.05]];
      q.setAttribute('position', new THREE.Float32BufferAttribute([...v[0], ...v[1], ...v[2], ...v[0], ...v[2], ...v[3]], 3));
      q.computeVertexNormals();
      out.push(mesh(q, new THREE.MeshPhysicalMaterial({color: '#0b0c0e', roughness: 0.25, clearcoat: 0.6, side: THREE.DoubleSide})));
    }
    // 中央扶手台上面：前面兩塊手機無線充電板（亮面黑、中間一條銀色細條），後面兩個杯架
    const slope = Math.atan(0.14);
    const yAt = (x) => 0.785 + (x - 0.3) * 0.14;
    const base = rbox(0.21, 0.012, 0.19, 0.006);
    base.rotateZ(slope);
    base.translate(0.355, yAt(0.355) + 0.004, 0);
    out.push(mesh(base, new THREE.MeshStandardMaterial({color: '#b4b6b9', roughness: 0.38, metalness: 0.35})));
    for (const k of [-1, 1]) {
      const p = rbox(0.165, 0.004, 0.074, 0.003, 2);
      p.rotateZ(slope);
      p.translate(0.36, yAt(0.36) + 0.012, k * 0.043);
      out.push(mesh(p, new THREE.MeshStandardMaterial({color: '#9a9da1', roughness: 0.3, metalness: 0.4})));
    }
    const bar = rbox(0.17, 0.004, 0.006, 0.002, 2);
    bar.rotateZ(slope);
    bar.translate(0.36, yAt(0.36) + 0.013, 0);
    out.push(mesh(bar, chrome));
    // 扶手下面的扶手台本體（模型只有扶手，下面是空的）：一直延伸到前座椅背，後面裝後座螢幕
    out.push(mesh(span([-0.455, FLOOR, -0.1], [0.12, 0.68, 0.1], 0.025), mat.plastic('#c9cacb', 0.5)));
    const cup = [mesh(span([0.13, 0.775, -0.095], [0.255, 0.79, 0.095], 0.005), mat.plastic('#c9cacb', 0.5))];
    for (const k of [-1, 1]) {
      const ring = new THREE.TorusGeometry(0.036, 0.0035, 8, 32);
      ring.rotateX(Math.PI / 2);
      ring.translate(0.192, 0.791, k * 0.045);
      cup.push(mesh(ring, mat.plastic('#3a3c41', 0.35)));
      cup.push(mesh(cylY(0.0335, 0.787, 0.7915, 0.192, k * 0.045, 28), mat.plastic('#060607', 0.9)));
    }
    out.push(...cup);
    piece('dash', out, [0.4, 0.95, -1.6], 3);
  }
  {
    // 中控螢幕 15.4 吋（橫的、圓角、細黑框，浮在儀表板上）
    // 一個組：螢幕面向車廂（往後），背板和支架黏在它後面，整組往後仰一點
    const SW = 0.332, SH = 0.208;
    const tex = frontScreenTex();
    const scr = new THREE.Mesh(flatShape(rrShape(SW, SH, 0.012), SW, SH), new THREE.MeshStandardMaterial({map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.25}));
    scr.position.z = 0.0035; // 黑框（含倒角）的正面在 0.0015，螢幕要在它前面
    const bezel = new THREE.ExtrudeGeometry(rrShape(SW + 0.012, SH + 0.012, 0.016), {depth: 0.016, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 8});
    bezel.translate(0, 0, -0.0165);
    const back = mesh(bezel, mat.plastic('#0d0e10', 0.4));
    const stem = mesh(span([-0.03, -0.24, -0.034], [0.03, -0.1, -0.012], 0.008), mat.plastic('#141517', 0.5));
    const unit = new THREE.Group();
    unit.add(scr, back, stem);
    unit.position.set(0.64, 1.17, 0);
    unit.rotation.set(-0.2, -Math.PI / 2, 0, 'YXZ');
    piece('screen', [unit], [0.35, 1.25, -1.7], 3);
    // 後座的 8 吋螢幕：在中央扶手台的後面，對著後座
    const RW = 0.178, RH = 0.112;
    const rt = rearScreenTex();
    const rs = new THREE.Mesh(flatShape(rrShape(RW, RH, 0.008), RW, RH), new THREE.MeshStandardMaterial({map: rt, emissive: '#ffffff', emissiveMap: rt, emissiveIntensity: 0.5, roughness: 0.25}));
    rs.position.z = 0.0005;
    const rb = new THREE.ExtrudeGeometry(rrShape(RW + 0.01, RH + 0.01, 0.01), {depth: 0.01, bevelEnabled: false, curveSegments: 6});
    rb.translate(0, 0, -0.01);
    const runit = new THREE.Group();
    runit.add(rs, mesh(rb, mat.plastic('#0d0e10', 0.4)));
    runit.position.set(-0.458, 0.6, 0);
    runit.rotation.set(-0.1, -Math.PI / 2, 0, 'YXZ');
    piece('rearScreen', [runit], [-0.6, 0.95, -1.55], 3);
  }
  {
    // 方向盤：新款的圓形方向盤（自己做，照實車照片），司機在左邊；盤面往前倒約 16 度（照原本模型量的）
    const w = steeringWheel();
    const r = (16.5 * Math.PI) / 180;
    w.matrix.makeBasis(new THREE.Vector3(0, 0, 1), new THREE.Vector3(Math.sin(r), Math.cos(r), 0), new THREE.Vector3(-Math.cos(r), Math.sin(r), 0));
    w.matrix.setPosition(0.44, 1.112, -0.385);
    w.matrix.decompose(w.position, w.quaternion, w.scale);
    piece('steering', [w], [0.5, 1.15, -1.75], 3);
  }
  {
    // 前車廂（frunk）：深的塑膠槽，上口寬、往下收窄；117 公升，大約 91 公分寬、35–43 公分深（車主量的）
    // 後面斜的牆讓開前馬達；底下的熱泵在槽的下面
    const g = [tubGeo([1.88, 0.55, 0.94, 0.12], [1.935, 0.3, 0.8, 0.08], 0.47, 0.765)];
    for (const z of [-0.2, 0, 0.2]) g.push(span([1.81, 0.47, z - 0.012], [2.06, 0.482, z + 0.012], 0.005)); // 底下幾條凸起的筋
    piece('frunk', [mesh(merge(g), new THREE.MeshStandardMaterial({color: '#1f2023', roughness: 0.85, side: THREE.DoubleSide}))], [1.1, 0.9, -0.9], 3);
  }
  {
    // 後車廂（照汽車之家 2027 款全景）：平的黑色地毯地板，後半塊是蓋子，掀起來下面是很深的置物槽；
    // 兩邊各一個往外凹的置物格，前面是包住輪拱和避震器的飾板；牆上方有放倒後座的按鈕和掛鉤；最後面一條黑色防刮飾條
    const carpet = new THREE.MeshStandardMaterial({color: '#232427', roughness: 0.95, side: THREE.DoubleSide});
    const g = [span([-1.82, 0.655, -0.62], [-1.34, 0.675, 0.62], 0.008)];
    const lid = rbox(0.4, 0.014, 1.2, 0.006);
    lid.translate(-2.02, 0.672, 0);
    g.push(lid);
    for (const s of [-1, 1]) {
      const w = (x0, y0, x1, y1) => g.push(span([x0, y0, s * 0.63 - 0.015], [x1, y1, s * 0.63 + 0.015], 0.008)); // 側牆（中間挖一個置物格的口）
      w(-2.22, 0.665, -2.12, 1.0);
      w(-1.78, 0.665, -1.34, 1.0);
      w(-2.12, 0.665, -1.78, 0.7);
      w(-2.12, 0.93, -1.78, 1.0);
      // 置物格：往外凹 12 公分的盒子
      const zi = s * 0.63, zo = s * 0.75;
      const zlo = Math.min(zi, zo), zhi = Math.max(zi, zo);
      g.push(span([-2.12, 0.69, zlo], [-1.78, 0.705, zhi], 0.004), span([-2.12, 0.925, zlo], [-1.78, 0.94, zhi], 0.004));
      g.push(span([-2.13, 0.69, zlo], [-2.115, 0.94, zhi], 0.004), span([-1.785, 0.69, zlo], [-1.77, 0.94, zhi], 0.004));
      g.push(span([-2.12, 0.69, zo - 0.008], [-1.78, 0.94, zo + 0.008], 0.004));
      g.push(span([-1.8, 0.665, s > 0 ? 0.5 : -0.63], [-1.34, 0.84, s > 0 ? 0.63 : -0.5], 0.06)); // 輪拱
      g.push(span([-1.53, 0.665, s > 0 ? 0.5 : -0.645], [-1.34, 1.1, s > 0 ? 0.645 : -0.5], 0.05)); // 包住後避震器頂端的飾板
    }
    const out = [mesh(merge(g), carpet)];
    out.push(mesh(tubGeo([-2.02, 0.4, 1.1, 0.08], [-2.015, 0.31, 0.94, 0.06], 0.33, 0.665, 0.012), new THREE.MeshStandardMaterial({color: '#1f2023', roughness: 0.85, side: THREE.DoubleSide})));
    out.push(mesh(span([-1.9, 0.679, -0.06], [-1.86, 0.683, 0.06], 0.002), mat.plastic('#0c0c0d', 0.7))); // 掀蓋子的拉帶
    out.push(mesh(span([-2.235, 0.63, -0.62], [-2.205, 0.69, 0.62], 0.008), mat.plastic('#121315', 0.5)));
    for (const s of [-1, 1]) {
      out.push(mesh(span([-1.536, 1.0, s * 0.56 - 0.02], [-1.528, 1.03, s * 0.56 + 0.02], 0.003), mat.plastic('#c9cbce', 0.4))); // 放倒後座的按鈕
      out.push(mesh(span([-1.6, 0.94, s * 0.612 - 0.012], [-1.585, 0.975, s * 0.612 + 0.012], 0.004), mat.chrome())); // 掛鉤
    }
    piece('trunk', out, [-1.1, 0.9, -0.9], 3);
  }

  // ================= 第三層：底盤 =================
  const spinners = [];
  const steerers = [];
  {
    const R = R_TIRE;
    // 輪子（下載的模型）：每個輪子包成一組，轉軸在輪心
    for (const [tag, ax, s] of [['FR', AX_F, 1], ['FL', AX_F, -1], ['RR', AX_R, 1], ['RL', AX_R, -1]]) {
      const list = wheelMesh[tag] || [];
      const c = new THREE.Vector3(ax, R, s * 0.82);
      const spin = new THREE.Group();
      for (const o of list) {
        o.position.sub(c);
        spin.add(o);
      }
      spinners.push({obj: spin, flip: false});
      const g = new THREE.Group();
      g.position.copy(c);
      g.add(spin);
      if (tag[0] === 'F') steerers.push(g);
      piece('wheels', [g], [tag[0] === 'F' ? 0.15 : -0.15, 0, s * 0.75], 4);
    }
    // 煞車：碟盤和卡鉗
    // 每個輪子一組，名牌才會標在碟盤上
    const discM = mat.metal();
    const calM = mat.plastic('#3b3e43', 0.4);
    for (const ax of [AX_F, AX_R])
      for (const s of [-1, 1]) {
        const disc = mesh(cylZ(ax > 0 ? 0.1775 : 0.1675, 0.028, ax, R, s * (TRACK - 0.1), 32), discM); // 碟盤直徑：前 355 mm、後 335 mm（車主手冊）
        const cal = mesh(span([ax + 0.08, R + 0.05, s * (TRACK - 0.1) - 0.04], [ax + 0.17, R + 0.17, s * (TRACK - 0.1) + 0.04], 0.02), calM);
        piece('brakes', [disc, cal], [ax > 0 ? 0.15 : -0.15, 0.1, s * 0.45], 4);
      }
    // 避震器、車架（下載的底盤模型）：前、後各一組
    piece('suspension', inner.suspensionF || [], [0.45, 0.5, 0], 4);
    piece('suspension', inner.suspensionR || [], [-0.45, 0.5, 0], 4);
    // 新款只有後底盤是一體壓鑄；前面是沖壓的鋼樑焊起來的（特斯拉工程副總受訪）
    piece('frame', inner.castingF || [], [0.6, 0.2, 0], 4);
    piece('casting', inner.castingR || [], [-0.6, 0.2, 0], 4);
  }

  // ================= 第四層：電池和馬達 =================
  {
    const out = inner.battery || [];
    piece('battery', out, [0, 0.85, 0], 5);
  }
  {
    // 前馬達、後馬達（實物掃描的驅動單元），各自連著兩根半軸到輪子
    const shafts = (ax) => mesh(merge([rod([ax, R_TIRE, -0.72], [ax, R_TIRE + 0.02, -0.2], 0.022, 10), rod([ax, R_TIRE + 0.02, 0.2], [ax, R_TIRE, 0.72], 0.022, 10)]), mat.metal());
    piece('frontMotor', [...(inner.frontMotor || []), shafts(AX_F)], [0.7, 0.55, 0], 5);
    piece('rearMotor', [...(inner.rearMotor || []), shafts(AX_R)], [-0.7, 0.55, 0], 5);
  }
  {
    // 熱泵：一個小盒子加很多管子，冬天幫電池和車子保暖
    // 在前車廂置物槽的下面
    const out = [mesh(span([1.8, 0.3, 0.12], [2.02, 0.455, 0.38], 0.03), mat.plastic('#3d4147', 0.45))];
    const pipes = [rod([1.9, 0.45, 0.15], [1.78, 0.44, -0.2], 0.015, 8), rod([1.95, 0.38, 0.38], [2.1, 0.38, 0.5], 0.015, 8), rod([1.82, 0.32, 0.12], [1.1, 0.33, 0.0], 0.015, 8)];
    out.push(mesh(merge(pipes), mat.plastic('#8a9097', 0.4)));
    piece('heatpump', out, [0.6, 0.85, 0.5], 5);
  }
  {
    // 充電口：藏在左後尾燈的燈殼裡（特斯拉車主手冊：充電口在車子左後方的尾燈組上）。蓋子就是尾燈燈罩的一塊，關著的時候看不出來
    const h = hit(shell.body || [], [-1.98 * SXZ, 1.075 * SY, -3], [0, 0, 1]);
    const port = new THREE.Group();
    // 和尾燈燈罩同一種煙燻玻璃：關著的時候融在尾燈裡，拆開時才看得出是一扇小門
    const lidM = new THREE.MeshPhysicalMaterial({color: '#050607', roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 0.95, envMapIntensity: 0.35, depthWrite: false, side: THREE.DoubleSide});
    port.add(mesh(span([-0.045, -0.026, -0.0015], [0.045, 0.026, 0.0015], 0.01), lidM));
    if (h) {
      port.position.copy(h.p).addScaledVector(h.n, 0.0015);
      port.lookAt(h.p.clone().addScaledVector(h.n, -1));
    }
    piece('chargePort', [port], [-0.4, 0.45, -0.7], 5);
  }


  return {root, parts, pieces, spinners, steerers, open};
}
