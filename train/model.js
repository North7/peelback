// 台灣高鐵 700T，一列 12 節。單位公尺，整列在 root 縮成 1/6（和飛機一樣）。
// x 往 1 車的車頭（南、左營那頭），y 往上（軌面 0），z 往右。1 車車頭尖端在 x ≈ 0，整列往 -x 排到 12 車。
// 外殼、轉向架、車廂裡的牆和地板、駕駛室：Sketchfab 上 Basic Hsu 做的 700T 車頭和客車廂（CC BY 4.0），
//   照實車尺寸校正、拆成零件（tools/train_export.py → train/sk/）。1、12 車用車頭那一節（12 車轉 180 度），2–11 車用客車廂。
// 座位不用模型裡的：照高鐵官網的座位圖一節一節排（977 個），標準車廂青綠色、商務車廂紫色。
// 集電弓、特高壓電線、主變壓器、主變流器、輔助電源、馬達、車頭燈、鐵軌是這裡畫的示意（位置照編組推，見第四層的說明）。
import * as THREE from 'three';
import {unzlibSync} from 'three/addons/libs/fflate.module.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import SK_ZIP from './sk/train.bin';
import SK_META from './sk/train.json';
import T_LIVERY from './sk/tex/THSR_Color_blinn.jpg';
import T_PANEL from './sk/tex/Ctrl_Panel_blinn.jpg';
import T_VEND from './sk/tex/Auto_Sale_blinn.jpg';
import T_FLOOR from './sk/tex/Color_Ground_blinn.jpg';
import T_INSIDE from './sk/tex/Color_Gray_Inside.jpg';
import T_DOOR from './sk/tex/Color_Door_Gray.jpg';
import T_MARK from './sk/tex/Marker_blinn.jpg';
import T_CARNO from './sk/tex/Car_No.jpg';
import {CARS} from './data.js';

const SK_BIN = unzlibSync(SK_ZIP);
const TEX_URL = {THSR_Color_blinn: T_LIVERY, Ctrl_Panel_blinn: T_PANEL, Auto_Sale_blinn: T_VEND, Color_Ground_blinn: T_FLOOR, Color_Gray_Inside: T_INSIDE, Color_Door_Gray: T_DOOR, Marker_blinn: T_MARK, Car_No: T_CARNO};

export const SCALE = 1 / 6;
export const FLOOR = 1.19; // 模型量到的地板（實車 1.25）
export const R_WHEEL = 0.43; // 車輪半徑（模型量到直徑 0.85 m，700 系新輪 860 mm）
const LEN_END = 27;
const LEN_MID = 25;
// 每一節的中心：1 車車頭在 x ≈ 0
export const CAR_X = CARS.map((c, i) => (i === 0 ? -LEN_END / 2 : -LEN_END - LEN_MID * (i - 1) - (i === 11 ? LEN_END / 2 : LEN_MID / 2)));
export const TRAIN_LEN = LEN_END * 2 + LEN_MID * 10;

// ---------- 讀 Sketchfab 匯出的網格 ----------
function skGeo(g) {
  const o = SK_BIN.byteOffset;
  const q = new Uint16Array(SK_BIN.buffer, o + g.pos, g.nv * 3);
  const pos = new Float32Array(g.nv * 3);
  const [x0, y0, z0, sx, sy, sz] = g.q;
  for (let i = 0; i < g.nv; i++) {
    pos[i * 3] = x0 + q[i * 3] * sx;
    pos[i * 3 + 1] = y0 + q[i * 3 + 1] * sy;
    pos[i * 3 + 2] = z0 + q[i * 3 + 2] * sz;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const n8 = new Int8Array(SK_BIN.buffer, o + g.nrm, g.nv * 3);
  const nrm = new Float32Array(g.nv * 3);
  for (let i = 0; i < nrm.length; i++) nrm[i] = n8[i] / 127;
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  if (g.uv !== undefined) {
    const u = new Uint16Array(SK_BIN.buffer, o + g.uv, g.nv * 2);
    const uv = new Float32Array(g.nv * 2);
    const [u0, v0, su, sv] = g.uq;
    for (let i = 0; i < g.nv; i++) {
      uv[i * 2] = u0 + u[i * 2] * su;
      uv[i * 2 + 1] = v0 + u[i * 2 + 1] * sv;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }
  geo.setIndex(new THREE.BufferAttribute(g.idx16 !== undefined ? new Uint16Array(SK_BIN.buffer, o + g.idx16, g.ni) : new Uint32Array(SK_BIN.buffer, o + g.idx, g.ni), 1));
  return geo;
}
const skGroups = (model, part) => SK_META.groups.filter((g) => g.model === model && g.part === part);

// ---------- 材質 ----------
const texCache = {};
function tex(name) {
  if (texCache[name]) return texCache[name];
  const t = new THREE.TextureLoader().load(TEX_URL[name]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return (texCache[name] = t);
}
const COL = {white: '#f4f5f3', orange: '#ff6a13', black: '#16181b', teal: '#1aa3b4', purple: '#5b3f7e', cover: '#f2f0ea', frame: '#8d9297', steel: '#7c8389', glass: '#1b2a33'};
const matCache = {};
/** Sketchfab 模型的材質：照原本的顏色和貼圖，換成 three.js 的 PBR */
function skMat(name, part) {
  const key = name + '|' + part;
  if (matCache[key]) return matCache[key];
  const c = SK_META.colors[name] || {col: [0.7, 0.7, 0.7]};
  const lin = new THREE.Color().setRGB(...c.col); // Blender 材質的顏色本來就是線性的，不用再轉
  let m;
  if (name === 'Glass_blinn32' || name === 'blinn34') {
    m = new THREE.MeshPhysicalMaterial({color: COL.glass, roughness: 0.08, metalness: 0.2, clearcoat: 1, transparent: part !== 'windows', opacity: part === 'windows' ? 1 : 0.35, side: THREE.DoubleSide});
    if (part === 'windows') {
      m.emissive = new THREE.Color('#ffd08a');
      m.emissiveIntensity = 0;
      m.userData.light = 'cabin';
      m.userData.lamp = {on: 0.9, off: 0};
    }
  } else if (name === 'Light_blinn') {
    m = new THREE.MeshStandardMaterial({color: '#fff6e0', emissive: '#fff1cf', emissiveIntensity: 0.05, roughness: 0.3});
    m.userData.light = 'cabin';
    m.userData.lamp = {on: 2.2, off: 0.05};
  } else if (c.tex) {
    m = new THREE.MeshStandardMaterial({map: tex(c.tex), roughness: name === 'THSR_Color_blinn' ? 0.32 : 0.6, metalness: name === 'THSR_Color_blinn' ? 0.1 : 0});
  } else if (part === 'bogie' || part === 'wheels') {
    // 轉向架灰色、車輪是磨亮的鋼（原模型的顏色太暗，在深色畫面上看不到）
    m = part === 'bogie' ? mat.metal('#6a7077', 0.5) : mat.metal('#b3b8bd', 0.3);
  } else {
    const dark = lin.r + lin.g + lin.b < 0.1;
    m = new THREE.MeshStandardMaterial({color: lin, roughness: dark ? 0.45 : 0.5, metalness: name === 'blinn30' || name === 'blinn31' || name === 'Wheel_blinn31' ? 0.55 : 0.05});
    if (part === 'body' && name === 'Color_WH_blinn') Object.assign(m, {roughness: 0.3});
    if (part === 'body' && name === 'blinn30') m.color.set('#1c1e21'); // 中間車廂車底的裙板：和車頭那節一樣是黑色
  }
  m.side = m.side === THREE.DoubleSide ? m.side : THREE.DoubleSide;
  return (matCache[key] = m);
}
const mat = {
  plastic: (c, r = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: r}),
  metal: (c = COL.steel, r = 0.4) => new THREE.MeshStandardMaterial({color: c, roughness: r, metalness: 0.8}),
  fabric: (c) => new THREE.MeshStandardMaterial({color: c, roughness: 0.92}),
  lamp: (c, light, on = 3.2, off = 0.04, base = c) => {
    const m = new THREE.MeshStandardMaterial({color: base, emissive: c, emissiveIntensity: off, roughness: 0.2, side: THREE.DoubleSide});
    m.userData.light = light;
    m.userData.lamp = {on, off};
    return m;
  },
};

// ---------- 小工具 ----------
const rbox = (w, h, d, r = 0.02, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
/** 沒有圓角的方塊（數量很多的東西用：座椅、枕木），一個只有 12 個三角形 */
const box = (a, b) => {
  const g = new THREE.BoxGeometry(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]));
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
};
const span = (a, b, r = 0.01, seg = 2) => {
  const g = rbox(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]), r, seg);
  g.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  return g;
};
const cylX = (r, len, x, y, z, seg = 20) => {
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
const rod = (a, b, r, seg = 8) => {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const g = new THREE.CylinderGeometry(r, r, A.distanceTo(B), seg);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
};
const merge = (gs) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)).map((g) => {
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  return g;
}));
const mesh = (g, m) => {
  const o = new THREE.Mesh(g, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
};
/** 同一份網格放到好幾節車上：合成一個網格（畫一次就好） */
function placed(geo, mats) {
  const out = [];
  for (const M of mats) out.push(geo.clone().applyMatrix4(M));
  const g = mergeGeometries(out);
  g.computeBoundingSphere();
  return g;
}
const carM = (i) => {
  const M = new THREE.Matrix4().makeTranslation(CAR_X[i], 0, 0);
  if (i === 11) M.multiply(new THREE.Matrix4().makeRotationY(Math.PI)); // 12 車：車頭那一節轉過來朝北
  return M;
};

// ---------- 座位 ----------
// 一個位子（面向 +x）：坐墊、椅背是布（顏色看車廂），頭枕套是白布，椅腳、扶手是灰色。w：一個位子多寬
function seatGeo(w) {
  const fab = [];
  const cover = [];
  const frame = [];
  const y0 = FLOOR;
  // 977 個位子：每個只用幾個方塊（整列的三角形要壓在手機、平板跑得動的量）
  fab.push(box([-0.24, y0 + 0.36, -w / 2 + 0.03], [0.22, y0 + 0.47, w / 2 - 0.03]));
  const back = box([-0.07, 0, -w / 2 + 0.03], [0.06, 0.78, w / 2 - 0.03]);
  back.rotateZ(0.2);
  back.translate(-0.27, y0 + 0.44, 0);
  fab.push(back);
  const c = box([-0.02, 0.56, -w / 2 + 0.06], [0.075, 0.8, w / 2 - 0.06]);
  c.rotateZ(0.2);
  c.translate(-0.27, y0 + 0.44, 0);
  cover.push(c);
  frame.push(box([-0.2, y0, -w / 2 + 0.08], [0.15, y0 + 0.36, -w / 2 + 0.12]));
  frame.push(box([-0.28, y0 + 0.56, w / 2 - 0.035], [0.18, y0 + 0.62, w / 2 + 0.005]));
  return {fab: merge(fab), cover: merge(cover), frame: merge(frame)};
}
// 標準車廂：一個位子 0.45 m 寬；A、B、C 在右手邊（+z），走道，D、E 在左手邊
const STD_Z = {A: 1.2, B: 0.75, C: 0.3, D: -0.72, E: -1.17};
const BIZ_Z = {A: 1.1, C: 0.52, D: -0.52, E: -1.1};
// 每一節第 1 排的位置（車廂中心算起）和排距
const ROW1 = {mid: 9.25, end1: 2.35, end12: 12.15};
function seatList() {
  const std = [];
  const biz = [];
  const wheel = [];
  CARS.forEach((car, i) => {
    const X = CAR_X[i];
    const pitch = car.business ? 1.12 : 1.04;
    // 1 車：第 1 排在駕駛室後面；12 車：第 1 排在南邊（接 11 車那頭）；中間車：第 1 排在南邊
    const x1 = i === 0 ? X + ROW1.end1 : i === 11 ? X + ROW1.end12 : X + ROW1.mid;
    const rowX = (r) => x1 - (r - 1) * pitch;
    const put = (list, r, letters, Z) => {
      for (const L of letters) list.push({x: rowX(r), z: Z[L], car: i});
    };
    if (car.business) {
      for (let r = car.ac[0]; r <= car.ac[1]; r++) put(biz, r, 'AC', BIZ_Z);
      for (let r = car.de[0]; r <= car.de[1]; r++) put(biz, r, 'DE', BIZ_Z);
    } else {
      for (let r = car.abc[0]; r <= car.abc[1]; r++) put(std, r, 'ABC', STD_Z);
      for (let r = car.de[0]; r <= car.de[1]; r++) put(std, r, 'DE', STD_Z);
      for (const [r, L] of car.wheel || []) wheel.push({x: rowX(r) - (r - 13) * 0.6, z: STD_Z[L], car: i});
    }
  });
  return {std, biz, wheel};
}
export const SEATS = seatList();
function seatInstances(list, geo, m) {
  const im = new THREE.InstancedMesh(geo, m, list.length);
  const M = new THREE.Matrix4();
  list.forEach((s, k) => im.setMatrixAt(k, M.makeTranslation(s.x, 0, s.z)));
  im.castShadow = true;
  im.receiveShadow = true;
  im.computeBoundingSphere();
  return im;
}

export function buildTrain() {
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
  const ENDS = [0, 11].map(carM);
  const MIDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(carM);
  /** 某一類零件：車頭那一節的放到 1、12 車，客車廂的放到 2–11 車 */
  const skPart = (part, {ends = ENDS, mids = MIDS} = {}) => {
    const out = [];
    for (const [model, Ms] of [['loco', ends], ['cabin', mids]]) {
      if (!Ms.length) continue;
      for (const g of skGroups(model, part)) out.push(mesh(placed(skGeo(g), Ms), skMat(g.mat, part)));
    }
    return out;
  };

  // ================= 第一層：外面 =================
  piece('nose', skPart('body', {mids: []}), [0, 14, 0], 1);
  piece('body', skPart('body', {ends: []}), [0, 14, 0], 1);
  piece('windows', skPart('windows'), [0, 14, 0], 1);
  {
    // 集電弓（4、9 車）：單臂式，底座、下臂、上臂、頂上的弓（碰電線那一條）
    const geo = [];
    const frame = [];
    const roof = 3.65;
    for (const i of CARS.map((c, k) => (c.panto ? k : -1)).filter((k) => k >= 0)) {
      const x = CAR_X[i] + 6.5;
      frame.push(span([x - 0.9, roof - 0.02, -0.55], [x + 0.9, roof + 0.12, 0.55], 0.04));
      for (const z of [-0.4, 0.4]) frame.push(span([x - 0.05, roof + 0.1, z - 0.05], [x + 0.05, roof + 0.3, z + 0.05], 0.02));
      geo.push(rod([x - 0.6, roof + 0.25, 0], [x + 0.55, roof + 0.75, 0], 0.045));
      geo.push(rod([x + 0.55, roof + 0.75, 0], [x - 0.35, roof + 1.25, 0], 0.035));
      geo.push(rod([x + 0.55, roof + 0.75, 0], [x - 0.6, roof + 0.32, 0.03], 0.012));
      geo.push(span([x - 0.42, roof + 1.25, -0.8], [x - 0.28, roof + 1.32, 0.8], 0.02));
      geo.push(span([x - 0.46, roof + 1.3, -0.55], [x - 0.24, roof + 1.36, 0.55], 0.02));
    }
    piece('pantograph', [mesh(merge(frame), mat.plastic('#c9ccd0', 0.4)), mesh(merge(geo), mat.metal('#5c6268', 0.35))], [0, 1.2, 0], 4);
  }

  // ================= 第二層：裡面 =================
  piece('cab', skPart('cab', {mids: []}), [0, 9.5, 0], 2);
  {
    const s = seatGeo(0.45);
    const b = seatGeo(0.55);
    const coverM = mat.fabric(COL.cover);
    const frameM = mat.metal(COL.frame, 0.45);
    piece('standard', [seatInstances(SEATS.std, s.fab, mat.fabric(COL.teal)), seatInstances(SEATS.std, s.cover, coverM), seatInstances(SEATS.std, s.frame, frameM)], [0, 9.5, 0], 2);
    piece('business', [seatInstances(SEATS.biz, b.fab, mat.fabric(COL.purple)), seatInstances(SEATS.biz, b.cover, coverM), seatInstances(SEATS.biz, b.frame, frameM)], [0, 9.5, 0], 2);
    // 7 車的輪椅位：地上一塊藍色的區域＋4 個位子
    const x7 = SEATS.wheel.reduce((a, s) => a + s.x, 0) / SEATS.wheel.length;
    const pad = mesh(span([x7 - 1.3, FLOOR, -1.45], [x7 + 1.3, FLOOR + 0.012, 1.45], 0.005), mat.plastic('#2f6fd6', 0.7));
    piece('accessible', [pad, seatInstances(SEATS.wheel, s.fab, mat.fabric(COL.teal)), seatInstances(SEATS.wheel, s.cover, coverM), seatInstances(SEATS.wheel, s.frame, frameM)], [0, 9.5, 0], 2);
  }
  piece('racks', skPart('racks'), [0, 11, 0], 2);
  {
    // 廁所：車頭那一節模型裡有一間（在車尾那頭），複製到有廁所的車廂（1、3、5、7、9、11 車）的北邊那頭
    const toiletCars = CARS.map((c, k) => (c.toilet ? k : -1)).filter((k) => k >= 0);
    const out = [];
    for (const g of skGroups('loco', 'toilet')) {
      const geo = skGeo(g);
      geo.computeBoundingBox();
      const bx = geo.boundingBox;
      const lx = (bx.min.x + bx.max.x) / 2; // 原本的位置（車頭那一節的車尾）
      const Ms = toiletCars.map((k) => new THREE.Matrix4().makeTranslation(CAR_X[k] + (k === 0 ? lx : -LEN_MID / 2 + 1.6), 0, 0));
      out.push(mesh(placed(geo.translate(-lx, 0, 0), Ms), skMat(g.mat, 'toilet')));
    }
    piece('toilet', out, [0, 9.5, 0], 2);
  }
  {
    const vendCars = CARS.map((c, k) => (c.vending ? k : -1)).filter((k) => k >= 0);
    const out = [];
    for (const g of skGroups('loco', 'vending')) {
      const geo = skGeo(g);
      geo.computeBoundingBox();
      const lx = (geo.boundingBox.min.x + geo.boundingBox.max.x) / 2;
      const Ms = vendCars.map((k) => new THREE.Matrix4().makeTranslation(CAR_X[k] + (k === 0 ? lx : -LEN_MID / 2 + 1.0), 0, 0));
      out.push(mesh(placed(geo.translate(-lx, 0, 0), Ms), skMat(g.mat, 'vending')));
    }
    piece('vending', out, [0, 9.5, 0], 2);
  }
  // 地板、牆、玄關、天花板（12 車的那一節沒有廁所和販賣機，模型裡本來就是分開的零件）
  piece('saloon', skPart('interior'), [0, 7.5, 0], 2); // 第四層的集電弓、車頂電線在車頂上方，裡面的東西要抬得比它們高

  // ================= 第三層：車底 =================
  piece('bogie', skPart('bogie'), [0, -0.3, 4.5], 3); // 車底的東西往旁邊（鏡頭這邊）移出來，放在鐵軌旁邊
  piece('wheels', skPart('wheels'), [0, -0.3, 7], 3);
  {
    // 牽引馬達：有馬達的車（1、5、12 車以外）每根車軸一個，掛在轉向架上、兩根車軸中間
    // 客車廂模型量到：轉向架中心在 +8.69、-8.47 m，軸距 2.53 m
    const g = {};
    for (const [i, car] of CARS.entries()) {
      if (car.type === 'T' || car.type === 'Tc') continue;
      for (const b of [8.69, -8.47]) for (const a of [-1, 1]) (g[i] ||= []).push(cylZ(0.25, 0.6, CAR_X[i] + b + a * 0.6, R_WHEEL + 0.02, a * 0.15, 20));
    }
    // 每個馬達推的那一根車軸和兩個車輪（拆到動力那一層時，看得出馬達在轉哪一對輪子；拖車的輪子沒有馬達）
    const ws = {};
    for (const [i, car] of CARS.entries()) {
      if (car.type === 'T' || car.type === 'Tc') continue;
      for (const b of [8.69, -8.47])
        for (const a of [-1, 1]) {
          const x = CAR_X[i] + b + a * 1.265;
          (ws[i] ||= []).push(cylZ(0.08, 1.5, x, R_WHEEL, 0, 12), cylZ(R_WHEEL, 0.13, x, R_WHEEL, 0.7175, 24), cylZ(R_WHEEL, 0.13, x, R_WHEEL, -0.7175, 24));
          (g[i] ||= []).push(span([x - a * 0.12 - 0.14, R_WHEEL - 0.14, a * 0.15 - 0.16], [x - a * 0.12 + 0.14, R_WHEEL + 0.14, a * 0.15 + 0.16], 0.03)); // 齒輪箱
        }
    }
    const motorM = mat.metal('#b07a35', 0.4);
    const axleM = mat.metal('#a9aeb3', 0.3);
    piece('motors', [...Object.values(g).map((gs) => mesh(merge(gs), motorM)), ...Object.values(ws).map((gs) => mesh(merge(gs), axleM))], [0, 0, 0], 4); // 第四層（動力）：留在原位，看得出在哪一節
  }

  // ---------- 燈：車頭燈（白）、車尾燈（紅）：1 車往南開，車頭燈亮；12 車是車尾，尾燈亮 ----------
  {
    const head = [];
    const tail = [];
    // 700T 的頭燈在擋風玻璃下緣（模型裡那片燈板：離車頭尖端約 2.3 m、軌面上 2.14 m），左右各一個扁扁的燈
    for (const z of [-0.36, 0.36]) {
      const l = new THREE.SphereGeometry(0.14, 16, 10).scale(0.35, 0.55, 1).translate(CAR_X[0] + 11.36, 2.14, z);
      head.push(l);
      tail.push(l.clone().translate(CAR_X[11] - CAR_X[0] - 11.36 * 2, 0, 0));
    }
    const lights = [mesh(merge(head), mat.lamp('#fff6dc', 'head', 4)), mesh(merge(tail), mat.lamp('#ff2a1a', 'tail', 3.5))];
    for (const l of lights) l.castShadow = false;
    parts.nose.pieces[0].obj.add(...lights);
    for (const l of lights) {
      l.userData.part = 'nose';
      parts.nose.meshes.push(l);
    }
  }

  // ---------- 鐵軌（不是零件，拆開也留在地上）：兩條鋼軌＋枕木 ----------
  {
    const x0 = 40;
    const x1 = -TRAIN_LEN - 40;
    const rails = [];
    for (const z of [-0.7175, 0.7175]) {
      rails.push(box([x1, -0.17, z - 0.035], [x0, 0, z + 0.035]));
      rails.push(box([x1, -0.17, z - 0.075], [x0, -0.14, z + 0.075]));
    }
    const ties = [];
    for (let x = x1; x < x0; x += 0.6) ties.push(box([x - 0.13, -0.38, -1.3], [x + 0.13, -0.17, 1.3]));
    const slab = box([x1, -0.62, -1.7], [x0, -0.38, 1.7]);
    const track = new THREE.Group();
    track.add(mesh(merge(rails), mat.metal('#8a8f94', 0.3)), mesh(merge(ties), mat.plastic('#9a968e', 0.9)), mesh(slab, mat.plastic('#b7b2a8', 0.95)));
    track.position.y = 0.62;
    root.add(track);
  }
  // 整列往上抬：鐵軌的道床底在地面上
  /** 每一節各自一個網格（名牌才會貼在真的那一台機器上，不會落在整列的正中間） */
  const perCar = (byCar, m) => Object.values(byCar).map((gs) => mesh(merge(gs), m));
  const addTo = (byCar, i, g) => (byCar[i] ||= []).push(g);
  // ================= 第四層：動力 =================
  // 每 4 節是一組動力單元（3 節有馬達、1 節沒有）：1–4、5–8、9–12 車。
  // 集電弓在 4、9 車；車頂的特高壓電線把電送到三組；單元之間（4–5、8–9 車）有電線的接頭。
  // 每節車底下放什麼，高鐵沒有公布：照 700T 的原型日本 700 系的放法（M 車放主變壓器、M1 車一台主變流器、M2 車兩台、T 車放輔助電源和空壓機）
  //   套到 700T 的編組代號（Tc-M2-MP-M1-T-M1s-MP-M2-M1-MP-M2-Tc）：主變壓器在 3、7、10 車，主變流器 2、8、11 車各兩台、4、6、9 車各一台，輔助電源在 1、5、12 車。
  {
    const ROOF = 3.65;
    const idx = (f) => CARS.map((c, k) => (f(c) ? k : -1)).filter((k) => k >= 0);
    // 特高壓電線：車頂上從 3 車拉到 10 車，接到兩支集電弓；單元交界有接頭；主變壓器那三節有一段往下接
    const cab = [];
    const x3 = CAR_X[2] + LEN_MID / 2 - 1;
    const x10 = CAR_X[9] - LEN_MID / 2 + 1;
    cab.push(cylX(0.045, x3 - x10, (x3 + x10) / 2, ROOF + 0.12, 0.55, 10));
    for (const i of idx((c) => c.panto)) cab.push(rod([CAR_X[i] + 6.5, ROOF + 0.12, 0.55], [CAR_X[i] + 6.5, ROOF + 0.25, 0.1], 0.04));
    for (const i of [3, 7]) cab.push(cylX(0.12, 0.6, (CAR_X[i] + CAR_X[i + 1]) / 2, ROOF + 0.12, 0.55, 14)); // 4–5、8–9 車中間的接頭
    for (const i of idx((c) => c.type === 'MP')) cab.push(rod([CAR_X[i], ROOF + 0.12, 0.55], [CAR_X[i], ROOF - 0.05, 0.55], 0.04));
    piece('hvCable', [mesh(merge(cab), mat.plastic('#d8572a', 0.5))], [0, 1.2, 0], 4);
    // 主變壓器（3、7、10 車）：車底中間一個大箱子，旁邊有散熱風扇
    const tr = {};
    for (const i of idx((c) => c.type === 'MP')) {
      const x = CAR_X[i];
      addTo(tr, i, box([x - 1.5, 0.55, -1.15], [x + 1.5, 1.12, 1.15]));
      for (const dx of [-0.8, 0.8]) addTo(tr, i, cylZ(0.24, 0.08, x + dx, 0.83, 1.18, 18));
    }
    piece('transformer', perCar(tr, mat.metal('#4a5f7a', 0.45)), [0, 0, 0], 4);
    // 主變流器：M2 車（2、8、11）兩台、M1 車（4、6、9）一台
    const cv = {};
    for (const [i, c] of CARS.entries()) {
      const n = c.type === 'M2' ? 2 : c.type === 'M1' || c.type === 'M1s' ? 1 : 0;
      for (let k = 0; k < n; k++) addTo(cv, i, box([CAR_X[i] + (k ? -4.4 : 2.4), 0.6, -1.0], [CAR_X[i] + (k ? -2.4 : 4.4), 1.1, 1.0]));
    }
    piece('converter', perCar(cv, mat.metal('#3f7a6b', 0.45)), [0, 0, 0], 4);
    // 輔助電源和空氣壓縮機（沒有馬達的 1、5、12 車）
    const ax = {};
    for (const i of idx((c) => c.type === 'T' || c.type === 'Tc')) {
      const x = CAR_X[i] + (i === 0 ? -1 : i === 11 ? 1 : 0);
      addTo(ax, i, box([x - 1.2, 0.6, -1.0], [x + 1.2, 1.1, 1.0]));
      addTo(ax, i, cylX(0.22, 1.2, x + 2.2, 0.8, 0.4, 16));
    }
    piece('aux', perCar(ax, mat.metal('#8e949b', 0.45)), [0, 0, 0], 4);
    // 地上的牌子：每一節一塊，寫「幾車・動力車／拖車」。平常藏在地面下，拆到動力那一層才冒出來，排在鐵軌旁邊（鏡頭這一邊）
    const plate = (i, motor) => {
      const len = (i === 0 || i === 11 ? LEN_END : LEN_MID) - 1.2;
      const t = (() => {
        const c = document.createElement('canvas');
        c.width = 1280;
        c.height = 128;
        const g = c.getContext('2d');
        g.fillStyle = motor ? '#e8742c' : '#9aa0a6';
        g.beginPath();
        g.roundRect(4, 4, 1272, 120, 40);
        g.fill();
        g.fillStyle = '#ffffff';
        g.font = '700 72px "Noto Sans TC", "PingFang TC", sans-serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(`${i + 1} 車・${motor ? '動力車' : '拖車'}`, 640, 68);
        const tx = new THREE.CanvasTexture(c);
        tx.colorSpace = THREE.SRGBColorSpace;
        tx.anisotropy = 8;
        return tx;
      })();
      const g = new THREE.PlaneGeometry(len, len / 10);
      g.rotateX(-Math.PI / 2);
      g.translate(CAR_X[i], -1.2, 3.3);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({map: t, roughness: 0.8, transparent: true}));
      m.receiveShadow = true;
      return m;
    };
    piece('motorCars', CARS.map((c, i) => (c.type.startsWith('M') ? plate(i, true) : null)).filter(Boolean), [0, 1.24, 0], 4);
    piece('trailerCars', CARS.map((c, i) => (c.type.startsWith('M') ? null : plate(i, false))).filter(Boolean), [0, 1.24, 0], 4);
  }

  for (const p of pieces) p.obj.position.y += 0.62;

  return {root, parts, pieces};
}
