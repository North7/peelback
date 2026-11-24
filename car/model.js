// 特斯拉 Model Y 新版（2025「Juniper」），單位公尺，整台在 root 放大 2 倍（和公車差不多大）。
// x 往車頭，y 往上，z 往右。
// 外殼、輪子用 Sketchfab 上 BloxBloger 做的「2025 Tesla Model Y」（CC BY-NC 4.0，非商業、要寫作者），
// 在 Blender 照位置拆成零件、換成這裡的座標（tools/sk_export.py → car/sk/）。車子裡面和底盤、電池是簡化的示意。
import * as THREE from 'three';
import {unzlibSync} from 'three/addons/libs/fflate.module.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import SK_ZIP from './sk/model.bin';
import SK_META from './sk/model.json';
import IN_ZIP from './sk/inner.bin';
// 模型檔是 zlib 壓縮過的，位置存成 0–65535 的整數（每組記最小值和間距）
const SK_BIN = unzlibSync(SK_ZIP);
const IN_BIN = unzlibSync(IN_ZIP);
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
      return phys({color: '#848990', metalness: 0.5, roughness: 0.38, clearcoat: 0.35, clearcoatRoughness: 0.25, envMapIntensity: 0.65});
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
/** 尾燈照在下面斜面上的紅光：一格一格往車身表面打射線，貼一片由上往下變淡的發光面 */
function spillGlow(meshes, z0, z1, yTop, yBot, m) {
  for (const o of meshes) o.updateMatrixWorld(true);
  const NZ = 40, NY = 10;
  const pos = [], uv = [], idx = [];
  const grid = [];
  for (let j = 0; j <= NY; j++) {
    const row = [];
    for (let i = 0; i <= NZ; i++) {
      const z = lerp(z0, z1, i / NZ), y = lerp(yTop, yBot, j / NY);
      const h = hit(meshes, [-4, y, z], [1, 0, 0]);
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

function screenTex(w, h, rear = false) {
  return canvasTex(w, h, (g) => {
    g.fillStyle = '#0b0f16';
    g.fillRect(0, 0, w, h);
    if (rear) {
      g.fillStyle = '#1d2533';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#7fb3ff';
      g.font = `600 ${h * 0.16}px sans-serif`;
      g.fillText('22°', w * 0.1, h * 0.35);
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.arc(w * (0.2 + i * 0.2), h * 0.72, h * 0.08, 0, Math.PI * 2);
        g.fill();
      }
      return;
    }
    // 中控螢幕：左邊是車子的小圖，右邊是地圖
    g.fillStyle = '#121822';
    g.fillRect(0, 0, w * 0.34, h);
    g.fillStyle = '#e8ebef';
    g.beginPath();
    g.roundRect(w * 0.09, h * 0.3, w * 0.16, h * 0.42, 30);
    g.fill();
    g.fillStyle = '#7fb3ff';
    g.font = `700 ${h * 0.12}px sans-serif`;
    g.fillText('P R N D', w * 0.04, h * 0.18);
    g.fillStyle = '#1a2332';
    g.fillRect(w * 0.34, 0, w * 0.66, h);
    g.strokeStyle = '#2f4058';
    g.lineWidth = 6;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(w * 0.34 + i * 60, 0);
      g.lineTo(w * 0.34 + i * 60 + 120, h);
      g.stroke();
    }
    g.strokeStyle = '#3d8bff';
    g.lineWidth = 10;
    g.beginPath();
    g.moveTo(w * 0.5, h * 0.9);
    g.quadraticCurveTo(w * 0.62, h * 0.4, w * 0.9, h * 0.25);
    g.stroke();
    g.fillStyle = '#101722';
    g.fillRect(0, h * 0.88, w, h * 0.12);
  });
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
    // 地板（白色地毯邊、深灰地毯）
    const g = [span([AX_R + 0.1, FLOOR - 0.04, -0.82], [1.05, FLOOR, 0.82], 0.02)];
    g.push(span([0.62, FLOOR, -0.82], [1.05, 0.62, 0.82], 0.04)); // 前面的腳踏斜板
    piece('floor', [mesh(merge(g), mat.plastic('#2c2d30', 0.95))], [0, 0.55, -1.0], 3);
  }
  {
    const out = shell.int_seats || [];
    piece('seats', out, [0, 0.85, -1.55], 3);
  }
  {
    // 儀表板：一整條橫的，木紋飾板上面有一條氣氛燈
    const out = [...(shell.int_dash || [])];
    // 儀表板上一條氣氛燈（模型沒有，自己加一條細燈）
    out.push(mesh(span([0.6, 1.005, -0.72], [0.612, 1.012, 0.72], 0.003), mat.lamp('#7fb3ff', 'ambient', 2.6)));
    const amb = new THREE.PointLight('#9cc4ff', 0.9, 2.4, 1.6);
    amb.position.set(0.1, 1.1, 0);
    amb.userData.light = 'ambient';
    out.push(amb);
    piece('dash', out, [0.4, 0.95, -1.6], 3);
  }
  {
    // 中控螢幕 15.4 吋（橫的，浮在儀表板上）
    // 一個組：螢幕面向車廂（往後），背板和支架黏在它後面，整組往後仰一點
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.215), new THREE.MeshStandardMaterial({map: screenTex(680, 430), emissive: '#ffffff', emissiveMap: screenTex(680, 430), emissiveIntensity: 0.55, roughness: 0.3}));
    const back = mesh(span([-0.18, -0.115, -0.024], [0.18, 0.115, -0.004], 0.008), mat.plastic('#141517', 0.5));
    const stem = mesh(span([-0.03, -0.24, -0.034], [0.03, -0.1, -0.012], 0.008), mat.plastic('#141517', 0.5));
    const unit = new THREE.Group();
    unit.add(scr, back, stem);
    unit.position.set(0.64, 1.17, 0);
    unit.rotation.set(-0.2, -Math.PI / 2, 0, 'YXZ');
    // 後座的 8 吋螢幕
    const rs = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.11), new THREE.MeshStandardMaterial({map: screenTex(360, 220, true), emissive: '#ffffff', emissiveMap: screenTex(360, 220, true), emissiveIntensity: 0.5}));
    rs.position.set(-0.425, 0.64, 0);
    rs.rotation.y = -Math.PI / 2;
    piece('screen', [unit],[0.35, 1.25, -1.7], 3);
    piece('rearScreen', [rs], [-0.6, 0.95, -1.55], 3);
  }
  {
    // 方向盤（模型的），司機在左邊
    piece('steering', shell.int_steering || [], [0.5, 1.15, -1.75], 3);
  }
  {
    // 前車廂（frunk）：前蓋下面的置物槽
    const g = [span([1.6, 0.5, -0.45], [2.15, 0.54, 0.45], 0.03)];
    for (const s of [-1, 1]) g.push(span([1.6, 0.5, s * 0.45 - 0.02], [2.15, 0.76, s * 0.45 + 0.02], 0.01));
    g.push(span([1.6, 0.5, -0.45], [1.64, 0.76, 0.45], 0.01), span([2.11, 0.5, -0.45], [2.15, 0.74, 0.45], 0.01));
    piece('frunk', [mesh(merge(g), mat.plastic('#202124', 0.85))], [1.1, 0.9, -0.9], 3);
  }
  {
    // 後車廂：平的地板，下面還有一個藏東西的槽
    const g = [span([-2.22, 0.64, -0.6], [-1.32, 0.67, 0.6], 0.02), span([-2.15, 0.36, -0.45], [-1.6, 0.4, 0.45], 0.03)];
    for (const s of [-1, 1]) g.push(span([-2.15, 0.36, s * 0.45 - 0.015], [-1.6, 0.64, s * 0.45 + 0.015], 0.01));
    piece('trunk', [mesh(merge(g), mat.plastic('#202124', 0.85))], [-1.1, 0.9, -0.9], 3);
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
    const out = [mesh(span([1.7, 0.42, 0.12], [1.92, 0.6, 0.38], 0.03), mat.plastic('#3d4147', 0.45))];
    const pipes = [rod([1.8, 0.6, 0.2], [1.8, 0.7, 0.0], 0.015, 8), rod([1.85, 0.55, 0.38], [2.1, 0.55, 0.5], 0.015, 8), rod([1.75, 0.45, 0.12], [1.1, 0.33, 0.0], 0.015, 8)];
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
