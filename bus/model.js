// 公車的幾何：全部用程式產生，單位公尺。x 往車頭，y 往上，z 往右（車門那一側）。
// 每個零件（part）由一或多個 piece 組成；piece 有自己的拆開方向，拆開時沿那個方向移動。
// 外觀照維基共享資源上的實車照片（KKA-3179、KKA-3225、KKA-2721）：圓弧車頂、黑色整片前窗框、
// 橘色車頂帽和 A 柱、側面一條細線加一條從前輪往後上揚的粗橘帶、上方有小氣窗的車窗。
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {SPEC} from './data.js';

const L = SPEC.length / 2; // 6.08
export const AX_F = L - SPEC.frontOverhang; // 3.48
export const AX_R = AX_F - SPEC.wheelbase; // -2.39
export const R_TIRE = SPEC.tireD / 2; // 0.478
const W = SPEC.width / 2; // 1.25
const FLOOR = SPEC.floor; // 0.34
const RAISED = 0.78;
const TOP = 1.25;
const BELT = 1.22; // 窗戶下緣
const ROOF = 3.0;
const RC = 0.34; // 車頂兩側的圓角半徑
const WIN_TOP = ROOF - RC; // 2.66：窗戶上緣剛好接到車頂圓弧
const CEIL = 2.6;
const SKIRT = 0.26;
// 門的位置（右側，+z）
export const DOOR_F = [4.8, 5.85];
export const DOOR_R = [-1.78, -0.62];
export const RAMP_Z0 = W - 0.06 - 0.9;
export const RAMP_Z1 = W + 0.01;
// 引擎
export const CRANK_Y = 0.45;
const ENG_X = -5.05;
const CYL_PITCH = 0.135;
const CRANK_R = SPEC.stroke / 2;
const ROD = 0.21;

const COL = {
  white: '#f5f4f0', orange: '#ef6a1c', red: '#c8281e', black: '#141516', glass: '#1d282f', tire: '#1b1c1e',
  rim: '#d3d6da', chassis: '#2e3135', metal: '#7d838a', seat: '#2d4f8a', priority: '#c0392b', floor: '#5f646a',
  yellow: '#f2c230', rubber: '#202123', alu: '#b8bcc1', blue: '#24479c',
};

const mat = {
  paint: () => new THREE.MeshPhysicalMaterial({color: COL.white, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.75}),
  orange: () => new THREE.MeshPhysicalMaterial({color: COL.orange, roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.75}),
  black: () => new THREE.MeshStandardMaterial({color: COL.black, roughness: 0.55}),
  gloss: () => new THREE.MeshPhysicalMaterial({color: '#0c0e10', roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05}),
  glass: (op = 0.6) => new THREE.MeshPhysicalMaterial({color: COL.glass, roughness: 0.04, metalness: 0.15, transparent: true, opacity: op, envMapIntensity: 1.6}),
  tire: () => new THREE.MeshStandardMaterial({color: COL.tire, roughness: 0.9}),
  rim: () => new THREE.MeshStandardMaterial({color: COL.rim, roughness: 0.25, metalness: 0.9}),
  chrome: () => new THREE.MeshStandardMaterial({color: '#d8dade', roughness: 0.3, metalness: 1}),
  chassis: () => new THREE.MeshStandardMaterial({color: COL.chassis, roughness: 0.6, metalness: 0.35}),
  metal: () => new THREE.MeshStandardMaterial({color: COL.metal, roughness: 0.45, metalness: 0.7}),
  alu: () => new THREE.MeshStandardMaterial({color: COL.alu, roughness: 0.4, metalness: 0.8}),
  plastic: (c, r = 0.6) => new THREE.MeshStandardMaterial({color: c, roughness: r}),
  rubber: () => new THREE.MeshStandardMaterial({color: COL.rubber, roughness: 0.92}),
  // light：屬於哪一組燈（燈光面板開關它）；on：打開時的發光強度。沒有 light 的燈一直維持 e
  lamp: (c, e = 0.6, light = null, on = 2.6) => {
    const m = new THREE.MeshStandardMaterial({color: c, emissive: c, emissiveIntensity: light ? 0.04 : e, roughness: 0.15});
    if (light) {
      m.userData.light = light;
      m.userData.lamp = {on, off: 0.04};
    }
    return m;
  },
  lens: () => new THREE.MeshPhysicalMaterial({color: '#ffffff', roughness: 0.02, transmission: 0, transparent: true, opacity: 0.35, clearcoat: 1}),
};

// ---------- 小工具 ----------
const rbox = (w, h, d, r = 0.03, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.999);
/** 從兩個角落 [x0,y0,z0]-[x1,y1,z1] 做一個盒子。 */
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
/** 兩點之間的圓管。 */
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
/** 車身橫切面（z, y）：兩側垂直，頂端兩個圓角。y0 必須低於圓角起點。 */
const bodyShape = (y0, y1 = ROOF, inset = 0) => {
  const w = W - inset;
  const r = RC - inset;
  const sh = new THREE.Shape();
  sh.moveTo(-w, y0);
  if (y1 < ROOF - RC + 1e-6) {
    sh.lineTo(-w, y1);
    sh.lineTo(w, y1);
  } else {
    sh.lineTo(-w, ROOF - RC);
    sh.absarc(-w + r, ROOF - RC, r, Math.PI, Math.PI / 2, true);
    sh.lineTo(w - r, ROOF - inset);
    sh.absarc(w - r, ROOF - RC, r, Math.PI / 2, 0, true);
  }
  sh.lineTo(w, y0);
  sh.closePath();
  return sh;
};
/** 把 (z, y) 的形狀沿 x 從 x0 拉到 x1。 */
const extrudeX = (shape, x0, x1, bevel = 0, seg = 20) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: x1 - x0 - bevel * 2, curveSegments: seg,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3,
  });
  g.rotateY(Math.PI / 2);
  g.translate(x0 + bevel, 0, 0);
  return g;
};

// ---------- 貼圖 ----------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
const KAI = '"Kaiti TC","STKaiti","BiauKai","DFKai-SB","Noto Serif TC","Songti TC",serif';
const SANS = '"PingFang TC","Noto Sans TC","Heiti TC",sans-serif';

/** LED 點陣：先把字畫在小畫布上，再一格一格點亮。 */
function ledTex(text, cols, rows, scale = 12, color = '#ff9a2e') {
  const src = document.createElement('canvas');
  src.width = cols;
  src.height = rows;
  const s = src.getContext('2d');
  s.fillStyle = '#000';
  s.fillRect(0, 0, cols, rows);
  s.fillStyle = '#fff';
  s.textBaseline = 'middle';
  let x = 2;
  for (const seg of text) {
    s.font = `${seg.bold ? 700 : 500} ${seg.size || rows - 2}px ${seg.font || SANS}`;
    s.fillStyle = seg.color || '#fff';
    s.fillText(seg.t, x, rows / 2 + 1);
    x += s.measureText(seg.t).width + (seg.gap ?? 3);
  }
  const px = s.getImageData(0, 0, cols, rows).data;
  return canvasTex(cols * scale, rows * scale, (g, w, h) => {
    g.fillStyle = '#070707';
    g.fillRect(0, 0, w, h);
    for (let j = 0; j < rows; j++)
      for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4;
        const on = px[k] + px[k + 1] + px[k + 2] > 330;
        const red = px[k] > 200 && px[k + 1] < 120;
        g.fillStyle = on ? (red ? '#ff3b2a' : color) : '#191715';
        g.beginPath();
        g.arc(i * scale + scale / 2, j * scale + scale / 2, scale * 0.38, 0, Math.PI * 2);
        g.fill();
      }
  });
}

/**
 * 側面下半部的塗裝：u = x（公尺），v = y（公尺）。
 * 前輪前面：下方一條粗橘、上面一條細橘。前輪之後：腰線一條細橘直到車尾，
 * 粗橘帶從前輪後緣的低處往後上揚，到中段變成水平接到車尾。
 */
function sideLivery(left) {
  const X0 = -6.2;
  const X1 = 6.2;
  const Y1 = BELT + 0.02;
  const S = 140;
  const t = canvasTex((X1 - X0) * S, Y1 * S, (g, w, h) => {
    const Y = (y) => h - y * S;
    const X = (x) => (x - X0) * S;
    g.fillStyle = COL.white;
    g.fillRect(0, 0, w, h);
    // 面板接縫：很淡的細線
    g.strokeStyle = 'rgba(60,60,60,0.18)';
    g.lineWidth = 2;
    for (const x of [-4.6, -3.2, -0.2, 1.3, 2.7, 4.6]) {
      g.beginPath();
      g.moveTo(X(x), Y(BELT));
      g.lineTo(X(x), Y(SKIRT));
      g.stroke();
    }
    g.fillStyle = COL.orange;
    // 前段
    g.fillRect(X(AX_F + 0.6), Y(0.56), X(6.2) - X(AX_F + 0.6), 0.24 * S);
    g.fillRect(X(AX_F + 0.6), Y(0.66), X(6.2) - X(AX_F + 0.6), 0.04 * S);
    // 腰線細橘
    g.fillRect(X(-6.2), Y(1.14), X(AX_F) - X(-6.2), 0.04 * S);
    // 上揚的粗橘帶
    const a = AX_F - 0.62;
    const b = AX_F - 3.0;
    g.beginPath();
    g.moveTo(X(a), Y(0.44));
    g.bezierCurveTo(X(a - 1.0), Y(0.5), X(b + 0.6), Y(0.86), X(b), Y(0.86));
    g.lineTo(X(-6.2), Y(0.86));
    g.lineTo(X(-6.2), Y(1.06));
    g.lineTo(X(b), Y(1.06));
    g.bezierCurveTo(X(b + 0.8), Y(1.06), X(a - 0.7), Y(0.68), X(a), Y(0.62));
    g.closePath();
    g.fill();
    if (left) {
      // 左後方的引擎散熱格柵、左前的油箱蓋位置旁的維修蓋
      g.fillStyle = '#1b1c1e';
      g.beginPath();
      g.roundRect(X(-5.6), Y(0.98), 1.0 * S, 0.44 * S, 0.04 * S);
      g.fill();
      g.fillStyle = '#4a4d50';
      for (let i = 0; i < 9; i++) g.fillRect(X(-5.56), Y(0.94) + i * 0.045 * S, 0.92 * S, 0.012 * S);
      g.strokeStyle = 'rgba(40,40,40,0.4)';
      g.lineWidth = 3;
      g.strokeRect(X(-1.55), Y(1.1), 0.62 * S, 0.8 * S);
    }
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1 / (X1 - X0), 1 / Y1);
  t.offset.set(-X0 / (X1 - X0), 0);
  return t;
}

function frontLivery() {
  // 車頭下半部正面：寬 2.5 m（z），y 0.26–1.1 m。從車外看，左邊是車的右側（+z）。
  const S = 240;
  const H = 1.1 - SKIRT;
  return canvasTex(2.5 * S, H * S, (g, w, h) => {
    const Y = (y) => h - (y - SKIRT) * S;
    g.fillStyle = COL.white;
    g.fillRect(0, 0, w, h);
    // 擋風玻璃下的細橘線
    g.fillStyle = COL.orange;
    g.fillRect(0, Y(1.1), w, 0.05 * S);
    // 頭燈的橘色框，中間一條往下彎的弧線把兩邊接起來
    const lamp = (cx) => {
      g.beginPath();
      g.roundRect(cx - 0.3 * S, Y(0.78), 0.6 * S, 0.24 * S, 0.1 * S);
      g.fill();
    };
    lamp(0.34 * S);
    lamp(w - 0.34 * S);
    g.lineWidth = 0.035 * S;
    g.strokeStyle = COL.orange;
    g.beginPath();
    g.moveTo(0.6 * S, Y(0.7));
    g.quadraticCurveTo(w / 2, Y(0.6), w - 0.6 * S, Y(0.7));
    g.stroke();
    // 最下面一條橘
    g.fillRect(0, Y(0.36), w, 0.07 * S);
    g.fillStyle = COL.red;
    g.font = `700 ${0.15 * S}px ${KAI}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('臺 北 客 運', w / 2, Y(0.86));
  });
}

function plateTex(text) {
  return canvasTex(440, 140, (g, w, h) => {
    g.fillStyle = '#f4f6f2';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 14);
    g.fill();
    g.strokeStyle = '#1f6b3a';
    g.lineWidth = 6;
    g.stroke();
    g.fillStyle = '#1f6b3a';
    g.font = `700 78px ${SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  });
}
function placardTex(text) {
  return canvasTex(300, 150, (g, w, h) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, w, h);
    g.fillStyle = COL.red;
    g.font = `800 120px ${SANS}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 6);
  });
}
function floorTex() {
  const t = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#62676d';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#575c62';
    for (let y = 8; y < h; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < w; x += 16) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 6);
  return t;
}
function wheelchairTex() {
  return canvasTex(256, 256, (g, w) => {
    g.fillStyle = '#2257b8';
    g.beginPath();
    g.roundRect(0, 0, w, w, 24);
    g.fill();
    g.strokeStyle = '#fff';
    g.fillStyle = '#fff';
    g.lineWidth = 14;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(118, 64, 16, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.moveTo(112, 96);
    g.lineTo(112, 150);
    g.lineTo(170, 150);
    g.lineTo(190, 200);
    g.stroke();
    g.beginPath();
    g.arc(112, 170, 46, -0.4, Math.PI + 0.9);
    g.stroke();
  });
}
function dashTex() {
  return canvasTex(512, 160, (g, w, h) => {
    g.fillStyle = '#16181b';
    g.fillRect(0, 0, w, h);
    for (const [cx, n] of [[150, 'km/h'], [362, 'rpm']]) {
      g.strokeStyle = '#cfd3d6';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(cx, 85, 58, Math.PI * 0.8, Math.PI * 2.2);
      g.stroke();
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (0.8 + 1.4 * (i / 10));
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * 50, 85 + Math.sin(a) * 50);
        g.lineTo(cx + Math.cos(a) * 58, 85 + Math.sin(a) * 58);
        g.stroke();
      }
      g.strokeStyle = '#ff7a2a';
      g.beginPath();
      g.moveTo(cx, 85);
      g.lineTo(cx + Math.cos(Math.PI * 1.1) * 46, 85 + Math.sin(Math.PI * 1.1) * 46);
      g.stroke();
      g.fillStyle = '#9aa0a6';
      g.font = '500 18px sans-serif';
      g.textAlign = 'center';
      g.fillText(n, cx, 130);
    }
  });
}

/** LED 路線牌：歸「路線牌」那組燈，關掉時還看得到一點點（白天的 LED 也微微亮）。 */
const ledMat = (m) => {
  m.userData.light = 'sign';
  m.userData.lamp = {on: 1.3, off: 0.18};
  m.emissiveIntensity = 0.18;
  return m;
};

// ---------- 主體 ----------
export function buildBus() {
  const root = new THREE.Group();
  const sprung = new THREE.Group(); // 懸吊上面的東西：開門時會蹲低
  const unsprung = new THREE.Group();
  root.add(unsprung, sprung);
  const parts = {}; // id -> {meshes:[], pieces:[]}
  const pieces = [];
  let seatColorsOut = [];
  const part = (id) => (parts[id] ||= {id, meshes: [], pieces: []});

  /** 把一組幾何加成一個 piece。vec 是拆開方向（公尺），order 決定先後。 */
  const piece = (id, objs, vec, order, parent = sprung, hinge = null) => {
    // hinge：{pivot:[x,y,z], angle}，拆開時繞著 pivot 的 x 軸倒下來（像打開紙箱）
    const g = new THREE.Group();
    const inner = hinge ? new THREE.Group() : g;
    if (hinge) {
      g.position.set(...hinge.pivot);
      inner.position.set(-hinge.pivot[0], -hinge.pivot[1], -hinge.pivot[2]);
      g.add(inner);
    }
    for (const o of [].concat(objs)) {
      inner.add(o);
      o.traverse((m) => {
        if (m.isMesh) {
          m.userData.part = id;
          part(id).meshes.push(m);
        }
      });
    }
    parent.add(g);
    const p = {id, obj: g, vec: new THREE.Vector3(...vec), order, x: 0, v: 0, target: 0, wait: 0, hinge: hinge?.angle || 0};
    part(id).pieces.push(p);
    pieces.push(p);
    return g;
  };

  // ---- 車頂：圓弧橫切面拉成一整條，裡面有兩條燈 ----
  {
    const shell = mesh(extrudeX(bodyShape(CEIL, ROOF), -5.94, 5.92, 0.02, 24), mat.paint());
    const out = [shell];
    // 車頂前端的藍紅藍色帶，包過兩側的圓角
    const bandShape = (inset) => {
      const sh = bodyShape(WIN_TOP - 0.02, ROOF, -0.024);
      sh.holes.push(new THREE.Path(bodyShape(WIN_TOP - 0.01, ROOF, inset).getPoints(40).reverse()));
      return sh;
    };
    const ring = bandShape(-0.008);
    for (const [x, c] of [[4.62, COL.blue], [4.84, COL.red], [5.06, COL.blue]]) {
      out.push(mesh(extrudeX(ring, x, x + 0.16, 0, 24), mat.plastic(c, 0.35)));
    }
    // 雨溝
    for (const s of [-1, 1]) out.push(mesh(span([-5.9, WIN_TOP - 0.03, s * (W + 0.026) - 0.01], [5.85, WIN_TOP, s * (W + 0.026) + 0.01], 0.008), mat.plastic('#9a9ea3', 0.4)));
    // 逃生天窗和天線
    for (const x of [3.2, -2.9]) out.push(mesh(span([x - 0.38, ROOF - 0.01, -0.38], [x + 0.38, ROOF + 0.05, 0.38], 0.03), mat.plastic('#d9dad6', 0.4)));
    out.push(mesh(rod([4.4, ROOF, 0.4], [4.25, ROOF + 0.18, 0.4], 0.008, 6), mat.black()));
    // 天花板的燈條
    for (const z of [-0.72, 0.72]) out.push(mesh(span([-5.5, CEIL - 0.03, z - 0.05], [5.3, CEIL, z + 0.05], 0.01), mat.lamp('#fffbea', 0.55, 'cabin', 1.8)));
    piece('roof', out, [0, 3.9, -2.6], 1);
  }
  // ---- 冷氣機：前後有斜面的扁殼，兩側有百葉 ----
  {
    const g = [];
    const prof = new THREE.Shape();
    // (x, y) 側面輪廓，往 z 方向拉寬
    prof.moveTo(-0.7, 0);
    prof.lineTo(-0.55, 0.2);
    prof.lineTo(2.2, 0.2);
    prof.lineTo(2.45, 0);
    prof.closePath();
    const body = new THREE.ExtrudeGeometry(prof, {depth: 1.86, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3, curveSegments: 4});
    body.translate(0, ROOF - 0.02, -0.93);
    g.push(mesh(body, mat.plastic('#e7e7e2', 0.35)));
    const louv = [];
    for (const s of [-1, 1]) for (let i = 0; i < 14; i++) louv.push(span([-0.3 + i * 0.17, ROOF + 0.03, s * 0.975 - 0.006], [-0.22 + i * 0.17, ROOF + 0.16, s * 0.975 + 0.006], 0.004));
    g.push(mesh(merge(louv), mat.plastic('#5b5f64', 0.5)));
    const fan = mat.plastic('#2a2d31', 0.5);
    for (const x of [0.25, 1.45]) {
      g.push(mesh(cylY(0.3, ROOF + 0.2, ROOF + 0.225, x, 0, 40), fan));
      const grill = [];
      for (let i = 0; i < 6; i++) {
        const b = span([-0.29, 0, -0.006], [0.29, 0.01, 0.006], 0.002);
        b.rotateY((i / 6) * Math.PI);
        b.translate(x, ROOF + 0.228, 0);
        grill.push(b);
      }
      g.push(mesh(merge(grill), mat.plastic('#8b9095', 0.4)));
    }
    piece('aircon', g, [0, 4.8, -2.8], 0);
  }

  // ---- 側面車身 ----
  const arches = [AX_F, AX_R];
  const HINGE_L = {pivot: [0, SKIRT, -W], angle: -Math.PI / 2};
  const HINGE_R = {pivot: [0, SKIRT, W], angle: Math.PI / 2};
  const sideShape = (x0, x1, archList) => {
    const sh = new THREE.Shape();
    const R = 0.6;
    sh.moveTo(x0, SKIRT);
    for (const ax of archList.filter((a) => a > x0 && a < x1).sort((a, b) => a - b)) {
      sh.lineTo(ax - R, SKIRT);
      sh.lineTo(ax - R, R_TIRE);
      sh.absarc(ax, R_TIRE, R, Math.PI, 0, true);
      sh.lineTo(ax + R, SKIRT);
    }
    sh.lineTo(x1, SKIRT);
    sh.lineTo(x1, BELT);
    sh.lineTo(x0, BELT);
    sh.closePath();
    return sh;
  };
  const extr = (sh) => new THREE.ExtrudeGeometry(sh, {depth: 0.04, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.008, bevelSegments: 3, curveSegments: 32});
  /** 車窗：每格一塊玻璃，黑色窗框和粗窗柱，上面 0.4 m 是可以推開的小氣窗。 */
  const windowBand = (segments, s, {driver = false} = {}) => {
    const glass = mat.glass(0.74);
    const glassTop = mat.glass(0.62);
    const frames = [];
    const panes = [];
    const tops = [];
    const z = s * W;
    for (const [x0, x1] of segments) {
      frames.push(span([x0, BELT, z - 0.028], [x1, BELT + 0.07, z + 0.028], 0.012));
      frames.push(span([x0, WIN_TOP - 0.07, z - 0.028], [x1, WIN_TOP + 0.005, z + 0.028], 0.012));
      const n = Math.max(1, Math.round((x1 - x0) / 1.25));
      const xs = Array.from({length: n + 1}, (_, i) => x0 + ((x1 - x0) * i) / n);
      for (const x of xs) frames.push(span([x - 0.05, BELT, z - 0.03], [x + 0.05, WIN_TOP, z + 0.03], 0.014));
      for (let i = 0; i < n; i++) {
        const a = xs[i] + 0.05;
        const b = xs[i + 1] - 0.05;
        // 小氣窗的橫框
        frames.push(span([a, WIN_TOP - 0.46, z - 0.026], [b, WIN_TOP - 0.42, z + 0.026], 0.006));
        // 小氣窗分成兩片，中間一條直框
        frames.push(span([(a + b) / 2 - 0.018, WIN_TOP - 0.44, z - 0.026], [(a + b) / 2 + 0.018, WIN_TOP - 0.05, z + 0.026], 0.006));
        panes.push(span([a, BELT + 0.06, z - 0.012], [b, WIN_TOP - 0.44, z + 0.012], 0.006));
        tops.push(span([a, WIN_TOP - 0.44, z - 0.016], [b, WIN_TOP - 0.06, z + 0.008], 0.006));
      }
    }
    if (driver) {
      // 司機窗：前半片往後滑
      frames.push(span([5.15 - 0.02, BELT + 0.05, z - 0.03], [5.15 + 0.02, WIN_TOP - 0.05, z + 0.03], 0.006));
    }
    return [mesh(merge(frames), mat.gloss()), mesh(merge(panes), glass), mesh(merge(tops), glassTop)];
  };
  const archTrim = (s) => {
    const out = [];
    for (const ax of arches) {
      const t = new THREE.TorusGeometry(0.61, 0.022, 8, 32, Math.PI);
      t.translate(ax, R_TIRE, s * (W + 0.006));
      out.push(t);
    }
    return mesh(merge(out), mat.rubber());
  };
  const archLiners = () => {
    const out = [];
    for (const ax of arches)
      for (const s of [-1, 1]) {
        const c = new THREE.CylinderGeometry(0.6, 0.6, 0.55, 28, 1, true, Math.PI / 2, Math.PI);
        c.rotateX(Math.PI / 2);
        c.translate(ax, R_TIRE, s * (W - 0.3));
        out.push(c);
      }
    return mesh(merge(out), new THREE.MeshBasicMaterial({color: '#151617', side: THREE.DoubleSide}));
  };
  const markers = (s, xs) => {
    const g = xs.map((x) => span([x - 0.05, 0.45, s * W - 0.01], [x + 0.05, 0.5, s * W + s * 0.018], 0.012));
    return mesh(merge(g), mat.lamp('#ffa43a', 0.5, 'turn', 3));
  };
  {
    const m = mat.paint();
    m.map = sideLivery(true);
    const lower = mesh(extr(sideShape(-5.96, 5.92, arches)), m);
    lower.position.z = -W;
    const sideT = ledTex([{t: '852', bold: true, size: 14, gap: 4, color: '#ff3b2a'}], 26, 16, 12);
    const sm = mesh(new THREE.PlaneGeometry(0.42, 0.26), ledMat(new THREE.MeshStandardMaterial({map: sideT, emissive: '#ffffff', emissiveMap: sideT, emissiveIntensity: 0.9})));
    sm.position.set(-4.9, BELT + 0.55, -W - 0.034);
    sm.rotation.y = Math.PI;
    const nameT = canvasTex(512, 64, (g, w, h) => {
      g.fillStyle = '#ffffff';
      g.font = `700 40px ${SANS}`;
      g.textBaseline = 'middle';
      g.fillText('臺北客運  KKA-0852', 6, h / 2);
    });
    const nm = mesh(new THREE.PlaneGeometry(0.9, 0.11), new THREE.MeshBasicMaterial({map: nameT, transparent: true}));
    nm.position.set(-4.85, WIN_TOP - 0.16, -W - 0.034);
    nm.rotation.y = Math.PI;
    piece('sideL', [lower, archTrim(-1), markers(-1, [4.8, 2.3, 0.6, -0.9, -3.6, -5.4]), sm, nm,
      ...windowBand([[-5.88, 4.5], [4.5, 5.9]], -1, {driver: true})], [0, -0.2, -1.0], 2, sprung, HINGE_L);
  }
  {
    // 右邊：被兩個門切成三段
    const m = mat.paint();
    m.map = sideLivery(false);
    const segs = [[-5.96, DOOR_R[0]], [DOOR_R[1], DOOR_F[0]], [DOOR_F[1], 5.92]];
    const lows = segs.map(([a, b]) => {
      const o = mesh(extr(sideShape(a, b, arches)), m);
      o.position.z = W - 0.04;
      return o;
    });
    const header = mesh(merge([DOOR_F, DOOR_R].map(([a, b]) => span([a, WIN_TOP - 0.1, W - 0.04], [b, WIN_TOP, W], 0.01))), mat.paint());
    // 門上方的提示燈
    const dl = mesh(merge([DOOR_F, DOOR_R].map(([a, b]) => span([(a + b) / 2 - 0.12, WIN_TOP - 0.08, W], [(a + b) / 2 + 0.12, WIN_TOP - 0.03, W + 0.02], 0.01))), mat.lamp('#ffb02e', 0.35, 'cabin', 2));
    piece('sideR', [...lows, header, dl, archTrim(1), markers(1, [2.3, 0.6, -3.6, -5.4]),
      ...windowBand([[-5.88, DOOR_R[0]], [DOOR_R[1], DOOR_F[0]]], 1)], [0, -0.2, 1.0], 2, sprung, HINGE_R);
  }

  // ---- 擋泥板：每個輪子後面一片黑色橡膠，下面有一排細溝 ----
  {
    const flaps = [];
    const ribs = [];
    for (const ax of arches)
      for (const s of [-1, 1]) {
        const x = ax - 0.64;
        flaps.push(span([x - 0.025, 0.12, s * (W - 0.32)], [x + 0.005, 0.5, s * (W - 0.04)], 0.012));
        for (let i = 0; i < 5; i++) ribs.push(span([x - 0.03, 0.14 + i * 0.07, s * (W - 0.3)], [x - 0.02, 0.16 + i * 0.07, s * (W - 0.06)], 0.004));
      }
    piece('mudflaps', [mesh(merge(flaps), mat.rubber()), mesh(merge(ribs), mat.plastic('#3a3c3f', 0.8))], [0, 0.2, 0], 2);
  }

  // ---- 車門：玻璃門，黑框，中間有橡膠條 ----
  const doorLeaves = [];
  {
    const leafMeshes = [];
    const frame = mat.gloss();
    const glass = mat.glass(0.45);
    const rub = mat.rubber();
    for (const [a, b] of [DOOR_F, DOOR_R]) {
      const w = (b - a) / 2;
      for (const k of [0, 1]) {
        const g = new THREE.Group();
        const x0 = a + k * w;
        const z = W + 0.012;
        const fr = [
          span([x0 + 0.01, SKIRT + 0.05, z - 0.02], [x0 + w - 0.01, SKIRT + 0.13, z + 0.02], 0.01),
          span([x0 + 0.01, WIN_TOP - 0.18, z - 0.02], [x0 + w - 0.01, WIN_TOP - 0.11, z + 0.02], 0.01),
          span([x0 + 0.01, SKIRT + 0.05, z - 0.02], [x0 + 0.06, WIN_TOP - 0.11, z + 0.02], 0.01),
          span([x0 + w - 0.06, SKIRT + 0.05, z - 0.02], [x0 + w - 0.01, WIN_TOP - 0.11, z + 0.02], 0.01),
          span([x0 + 0.06, 1.0, z - 0.016], [x0 + w - 0.06, 1.05, z + 0.016], 0.008),
        ];
        g.add(mesh(merge(fr), frame));
        g.add(mesh(span([x0 + 0.05, SKIRT + 0.12, z - 0.008], [x0 + w - 0.05, WIN_TOP - 0.17, z + 0.008], 0.004), glass));
        const edge = k === 0 ? x0 + w - 0.012 : x0 + 0.012;
        g.add(mesh(span([edge - 0.012, SKIRT + 0.05, z - 0.025], [edge + 0.012, WIN_TOP - 0.11, z + 0.025], 0.01), rub));
        g.userData.dir = k === 0 ? -1 : 1;
        g.userData.w = w;
        doorLeaves.push(g);
        leafMeshes.push(g);
      }
    }
    piece('doors', leafMeshes, [0, -0.05, 1.0], 2, sprung, HINGE_R);
  }

  // ---- 車頭 ----
  {
    const out = [];
    // 下半部白色面板（貼塗裝）
    out.push(mesh(span([5.9, SKIRT, -W], [6.08, 1.12, W], 0.09, 4), mat.paint()));
    const liv = new THREE.Mesh(new THREE.PlaneGeometry(2.44, 1.1 - SKIRT), new THREE.MeshPhysicalMaterial({map: frontLivery(), roughness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.32, envMapIntensity: 0.75}));
    liv.rotation.y = Math.PI / 2;
    liv.position.set(6.083, (1.1 + SKIRT) / 2, 0);
    out.push(liv);
    // 黑色整片前窗框，兩側是橘色 A 柱
    // 黑框只圍一圈（上面放路線牌），中間是透明的擋風玻璃，看得到司機和儀表板
    {
      const fr = [
        span([5.96, 2.28, -W + 0.07], [6.06, WIN_TOP + 0.02, W - 0.07], 0.05),
        span([5.96, 1.06, -W + 0.07], [6.06, 1.16, W - 0.07], 0.03),
      ];
      for (const s of [-1, 1]) fr.push(span([5.96, 1.06, s * (W - 0.07) - 0.06], [6.06, WIN_TOP + 0.02, s * (W - 0.07) + 0.06], 0.03));
      out.push(mesh(merge(fr), mat.gloss()));
    }
    for (const s of [-1, 1]) out.push(mesh(span([5.9, 1.08, s * W - 0.08], [6.07, WIN_TOP + 0.02, s * W + 0.0], 0.04), mat.orange()));
    // 車頂帽（橘色，和車頂同一個圓弧）
    out.push(mesh(extrudeX(bodyShape(WIN_TOP - 0.02, ROOF), 5.9, 6.08, 0.03, 24), mat.orange()));
    // 擋風玻璃：兩側往後包的曲面
    {
      const gw = new THREE.PlaneGeometry(2.3, 1.18, 30, 1);
      const p = gw.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = p.getX(i);
        p.setZ(i, -0.05 * (u / 1.15) ** 4);
      }
      gw.computeVertexNormals();
      gw.rotateY(Math.PI / 2);
      const ws = mesh(gw, mat.glass(0.4));
      ws.position.set(6.066, 1.72, 0);
      ws.rotation.z = 0.03;
      out.push(ws);
    }
    // 遮陽橫條
    out.push(mesh(span([6.05, 2.29, -W + 0.1], [6.075, 2.34, W - 0.1], 0.01), mat.black()));
    // 路線號碼牌（擋風玻璃左下，從車外看在左邊＝車的右側）
    {
      const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.16), new THREE.MeshBasicMaterial({map: placardTex('852')}));
      pm.rotation.y = Math.PI / 2;
      pm.position.set(6.062, 1.27, 0.8);
      out.push(pm);
    }
    // 頭燈：橘框裡的黑色燈座，兩顆圓燈加一顆琥珀色方向燈
    for (const s of [-1, 1]) {
      const zc = s * 0.91;
      out.push(mesh(span([6.07, 0.6, zc - 0.25], [6.11, 0.76, zc + 0.25], 0.06), mat.gloss()));
      for (const dz of [-0.09, 0.07]) {
        out.push(mesh(cylX(0.06, 0.02, 6.115, 0.68, zc + dz, 24), mat.chrome()));
        out.push(mesh(cylX(0.045, 0.02, 6.12, 0.68, zc + dz, 24), mat.lamp('#fff7e2', 0.6, 'head', 4)));
      }
      out.push(mesh(cylX(0.035, 0.02, 6.115, 0.68, zc + s * 0.19, 16), mat.lamp('#ffa13a', 0.5, 'turn', 3)));
      // 角落的小方向燈
      out.push(mesh(span([5.98, 0.66, s * W - s * 0.02 - 0.03], [6.06, 0.72, s * W - s * 0.02 + 0.03], 0.01), mat.lamp('#ffa13a', 0.45, 'turn', 3)));
    }
    // 保險桿下緣、車牌
    out.push(mesh(span([6.0, SKIRT - 0.02, -W + 0.04], [6.1, SKIRT + 0.08, W - 0.04], 0.04), mat.plastic('#2a2c2f', 0.5)));
    {
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.135), new THREE.MeshStandardMaterial({map: plateTex('KKA-0852'), roughness: 0.4}));
      pl.rotation.y = Math.PI / 2;
      pl.position.set(6.11, 0.44, 0);
      out.push(pl);
    }
    // 雨刷：從下緣往中間收著
    for (const s of [-1, 1]) {
      const arm = rod([6.09, 1.14, s * 0.95], [6.09, 1.2, s * 0.02], 0.009, 6);
      const blade = span([6.08, 1.16, s * 0.9], [6.1, 1.2, s * 0.05], 0.006);
      blade.rotateX(0);
      out.push(mesh(merge([arm, blade]), mat.black()));
    }
    piece('front', out, [2.7, 0.5, 0], 2);
  }
  // ---- 後照鏡（兔耳朵） ----
  {
    const out = [];
    const arm = mat.black();
    for (const s of [-1, 1]) {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(6.0, 2.82, s * 1.12),
        new THREE.Vector3(6.25, 2.92, s * 1.3),
        new THREE.Vector3(6.5, 2.72, s * 1.34),
        new THREE.Vector3(6.58, 2.32, s * 1.3),
      ]);
      out.push(mesh(new THREE.TubeGeometry(c, 24, 0.022, 10), arm));
      out.push(mesh(span([6.52, 1.86, s * 1.3 - 0.12], [6.64, 2.34, s * 1.3 + 0.12], 0.06), mat.gloss()));
      out.push(mesh(span([6.508, 1.9, s * 1.3 - 0.095], [6.52, 2.3, s * 1.3 + 0.095], 0.01), mat.chrome()));
      out.push(mesh(span([6.508, 1.72, s * 1.3 - 0.07], [6.6, 1.84, s * 1.3 + 0.07], 0.03), mat.gloss()));
    }
    piece('mirrors', out, [3.5, 0.9, 0], 3);
  }
  // ---- 路線牌 ----
  {
    const front = ledTex([{t: '852', bold: true, size: 15, gap: 4, color: '#ff3b2a'}, {t: '樹林→北大社區', size: 13}], 136, 16, 12);
    const fm = mesh(new THREE.PlaneGeometry(2.1, 0.28), ledMat(new THREE.MeshStandardMaterial({map: front, emissive: '#ffffff', emissiveMap: front, emissiveIntensity: 0.95, roughness: 0.3})));
    fm.rotation.y = Math.PI / 2;
    fm.position.set(6.072, 2.49, 0);
    piece('sign', [fm], [3.5, 1.3, 0], 3);
    const rearT = ledTex([{t: '852', bold: true, size: 15, color: '#ff3b2a'}], 30, 16, 12);
    const rm = mesh(new THREE.PlaneGeometry(0.5, 0.27), ledMat(new THREE.MeshStandardMaterial({map: rearT, emissive: '#ffffff', emissiveMap: rearT, emissiveIntensity: 0.9})));
    rm.rotation.y = -Math.PI / 2;
    rm.position.set(-6.082, 2.36, -0.55);
    piece('sign', [rm], [-4.2, 1.6, 0], 3);
    const sideT = ledTex([{t: '852', bold: true, size: 14, gap: 3, color: '#ff3b2a'}, {t: '北大社區', size: 12}], 84, 16, 10);
    const sm = mesh(new THREE.PlaneGeometry(1.26, 0.24), ledMat(new THREE.MeshStandardMaterial({map: sideT, emissive: '#ffffff', emissiveMap: sideT, emissiveIntensity: 0.9})));
    sm.position.set(4.05, WIN_TOP - 0.24, W + 0.034);
    piece('sign', [sm], [0, -0.1, 1.0], 2, sprung, HINGE_R);
  }

  // ---- 車尾 ----
  {
    const out = [];
    const sh = bodyShape(SKIRT, ROOF);
    const hole = new THREE.Path();
    hole.moveTo(-0.95, 1.9);
    hole.lineTo(0.95, 1.9);
    hole.lineTo(0.95, 2.52);
    hole.lineTo(-0.95, 2.52);
    hole.closePath();
    sh.holes.push(hole);
    out.push(mesh(extrudeX(sh, -6.08, -5.94, 0.03, 24), mat.paint()));
    out.push(mesh(span([-6.07, 1.86, -1.0], [-6.02, 2.56, 1.0], 0.04), mat.gloss()));
    out.push(mesh(span([-6.075, 1.92, -0.92], [-6.06, 2.5, 0.92], 0.01), mat.glass(0.7)));
    // 引擎門：黑色百葉，兩邊有鉸鍊
    out.push(mesh(span([-6.11, 0.5, -0.95], [-6.075, 1.4, 0.95], 0.03), mat.plastic('#1d1f22', 0.6)));
    const slats = [];
    for (let i = 0; i < 9; i++) slats.push(span([-6.125, 0.56 + i * 0.092, -0.88], [-6.105, 0.6 + i * 0.092, 0.88], 0.006));
    out.push(mesh(merge(slats), mat.metal()));
    // 尾燈：每邊直排三顆圓燈
    for (const s of [-1, 1]) {
      out.push(mesh(span([-6.11, 0.52, s * 1.1 - 0.11], [-6.075, 1.38, s * 1.1 + 0.11], 0.05), mat.gloss()));
      [['#d22b1e', 1.22], ['#d22b1e', 1.0], ['#ffa13a', 0.78], ['#f4f4f0', 0.6]].forEach(([c, y]) => {
        out.push(mesh(cylX(0.075, 0.02, -6.118, y, s * 1.1, 24), mat.chrome()));
        // 紅色＝尾燈、琥珀色＝方向燈、白色＝倒車燈（不開）
        const grp = c === '#d22b1e' ? 'tail' : c === '#ffa13a' ? 'turn' : null;
        out.push(mesh(cylX(0.06, 0.02, -6.124, y, s * 1.1, 24), grp ? mat.lamp(c, 0.5, grp, 3) : mat.lamp(c, 0.04)));
      });
    }
    out.push(mesh(span([-6.16, SKIRT - 0.02, -W + 0.04], [-6.04, SKIRT + 0.12, W - 0.04], 0.05), mat.plastic('#2a2c2f', 0.5)));
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.135), new THREE.MeshStandardMaterial({map: plateTex('KKA-0852'), roughness: 0.4}));
    pl.rotation.y = -Math.PI / 2;
    pl.position.set(-6.13, 0.43, 0);
    out.push(pl);
    // 車牌燈：照亮車牌，跟尾燈一起開
    out.push(mesh(span([-6.165, 0.53, -0.12], [-6.13, 0.56, 0.12], 0.01), mat.lamp('#ffffff', 0.04, 'tail', 2.2)));
    out.push(mesh(span([-6.09, 1.5, -W + 0.06], [-6.07, 1.58, W - 0.06], 0.01), mat.orange()));
    piece('rear', out, [-3.8, 0.9, 0], 2);
  }

  // ---- 地板 ----
  {
    const fm = mat.plastic('#ffffff', 0.85);
    fm.map = floorTex();
    const y = mat.plastic(COL.yellow);
    const g = [];
    g.push(span([-1.9, FLOOR - 0.06, -W + 0.05], [5.9, FLOOR, W - 0.05], 0.01));
    g.push(span([-1.92, FLOOR, -W + 0.05], [-1.88, RAISED, W - 0.05], 0.01));
    g.push(span([-4.3, RAISED - 0.06, -W + 0.05], [-1.88, RAISED, W - 0.05], 0.01));
    g.push(span([-4.32, RAISED, -W + 0.05], [-4.28, TOP, W - 0.05], 0.01));
    g.push(span([-5.94, TOP - 0.06, -W + 0.05], [-4.28, TOP, W - 0.05], 0.01));
    // 輪罩（輪子在地板上鼓起來的地方）：深灰色，從輪拱看進去才不會一片亮
    const humps = [];
    for (const s of [-1, 1]) {
      humps.push(span([AX_F - 0.62, FLOOR, s * 0.66], [AX_F + 0.62, 1.1, s * 0.92], 0.06));
      humps.push(span([AX_R - 0.62, RAISED, s * 0.5], [AX_R + 0.62, 1.12, s * 0.62], 0.04));
    }
    g.push(span([4.62, FLOOR, -W + 0.05], [5.88, 0.55, -0.3], 0.02));
    const yel = [];
    for (const [a, b] of [DOOR_F, DOOR_R]) yel.push(span([a, FLOOR, W - 0.12], [b, FLOOR + 0.005, W - 0.05], 0.002));
    yel.push(span([-1.94, RAISED, -W + 0.05], [-1.86, RAISED + 0.004, W - 0.05], 0.002));
    yel.push(span([-4.34, TOP, -W + 0.05], [-4.26, TOP + 0.004, W - 0.05], 0.002));
    const wc = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshStandardMaterial({map: wheelchairTex(), roughness: 0.6}));
    wc.rotation.x = -Math.PI / 2;
    wc.position.set(-0.05, FLOOR + 0.003, 0.35);
    // 輪拱內襯（黑色）是地板鼓起來的輪罩的下半，跟著地板一起拆
    // 車內燈照下來的光：三顆點光源，跟地板放在一起（車頂拆掉了座椅還是亮的）
    const cabinLights = [-3.6, 0.2, 3.8].map((x) => {
      const l = new THREE.PointLight('#fff1d6', 5, 7, 1.6);
      l.position.set(x, 2.35, 0);
      l.userData.light = 'cabin';
      return l;
    });
    piece('floor', [mesh(merge(g), fm), mesh(merge(humps), mat.plastic('#2c2e31', 0.8)), mesh(merge(yel), y), wc, archLiners(), ...cabinLights], [0, 1.3, -1.5], 5);
  }

  // ---- 座椅：一體成形的塑膠椅殼（側面輪廓拉寬），InstancedMesh 一次畫完 ----
  {
    const prof = new THREE.Shape();
    prof.moveTo(0.225, 0.43);
    prof.bezierCurveTo(0.245, 0.44, 0.24, 0.475, 0.215, 0.48);
    prof.lineTo(-0.12, 0.488);
    prof.bezierCurveTo(-0.19, 0.49, -0.2, 0.53, -0.205, 0.58);
    prof.lineTo(-0.235, 0.95);
    prof.bezierCurveTo(-0.237, 0.99, -0.26, 1.0, -0.275, 0.985);
    prof.lineTo(-0.252, 0.56);
    prof.bezierCurveTo(-0.245, 0.47, -0.21, 0.43, -0.14, 0.425);
    prof.closePath();
    const shell = new THREE.ExtrudeGeometry(prof, {depth: 0.4, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 3, curveSegments: 10});
    shell.translate(0, 0, -0.2);
    const seatGeo = merge([shell, span([-0.06, 0, -0.04], [0.06, 0.43, 0.04], 0.01), span([-0.16, 0.38, -0.17], [0.16, 0.42, 0.17], 0.01)]);
    const handle = merge([rod([-0.27, 0.99, -0.16], [-0.27, 1.06, -0.16], 0.012, 8), rod([-0.27, 1.06, -0.16], [-0.27, 1.06, 0.16], 0.012, 8), rod([-0.27, 0.99, 0.16], [-0.27, 1.06, 0.16], 0.012, 8)]);
    const spots = [];
    const pair = (x, y, s) => spots.push([x, y, s * 0.56], [x, y, s * 1.0]);
    for (const x of [1.5, 0.7, -0.1, -0.9]) pair(x, FLOOR, -1);
    for (const x of [2.3, 1.5]) pair(x, FLOOR, 1);
    for (const x of [-2.75, -3.55]) {
      pair(x, RAISED, -1);
      pair(x, RAISED, 1);
    }
    pair(-4.75, TOP, -1);
    pair(-4.75, TOP, 1);
    for (const z of [-1.0, -0.5, 0, 0.5, 1.0]) spots.push([-5.55, TOP, z]);
    const im = new THREE.InstancedMesh(seatGeo, new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 0.45}), spots.length);
    const hm = new THREE.InstancedMesh(handle, mat.chrome(), spots.length);
    const seatColors = [];
    const M = new THREE.Matrix4();
    const c = new THREE.Color();
    spots.forEach(([x, y, z], i) => {
      M.makeTranslation(x, y, z);
      im.setMatrixAt(i, M);
      hm.setMatrixAt(i, M);
      im.setColorAt(i, c.set(i >= 8 && i < 12 ? COL.priority : COL.seat));
      seatColors.push(c.clone());
    });
    im.castShadow = im.receiveShadow = hm.castShadow = true;
    piece('seats', [im, hm], [0, 2.3, -2.0], 4);
    parts.seats.count = spots.length;
    seatColorsOut = seatColors;
  }

  // ---- 扶手、吊環、下車鈴、刷卡機 ----
  const RAIL_Y = 2.3;
  {
    const floorAt = (x) => (x > -1.9 ? FLOOR : x > -4.3 ? RAISED : TOP);
    const poles = [[4.72, 0.98], [-0.56, 0.98], [-1.84, 0.98], [1.1, 0.25], [-0.2, -0.25], [2.65, -0.25], [-3.15, 0.25], [-4.0, -0.25]];
    const g = poles.map(([x, z]) => cylY(0.019, floorAt(x), RAIL_Y, x, z, 12));
    for (const z of [-0.42, 0.42]) g.push(cylX(0.017, 8.9, 0.2, RAIL_Y, z, 12));
    for (const x of [-4.1, -1.5, 1.2, 3.9]) for (const z of [-0.42, 0.42]) g.push(cylY(0.012, RAIL_Y, CEIL, x, z, 8));
    piece('rails', [mesh(merge(g), mat.plastic(COL.yellow, 0.35))], [0, 3.0, -2.2], 3);
    // 吊環：皮帶加圓環，掛在兩條長扶手上
    const strap = merge([span([-0.014, -0.2, -0.004], [0.014, 0, 0.004], 0.003)]);
    const ringG = new THREE.TorusGeometry(0.06, 0.01, 8, 24);
    ringG.rotateY(Math.PI / 2);
    ringG.translate(0, -0.26, 0);
    const xs = [];
    for (let x = -4.05; x <= 4.45; x += 0.42) if (!poles.some(([px]) => Math.abs(px - x) < 0.12)) xs.push(x);
    const n = xs.length * 2;
    const sm = new THREE.InstancedMesh(strap, mat.plastic('#3a3d42', 0.7), n);
    const rm = new THREE.InstancedMesh(ringG, mat.plastic('#f2c230', 0.35), n);
    const M = new THREE.Matrix4();
    let i = 0;
    for (const x of xs)
      for (const z of [-0.42, 0.42]) {
        M.makeTranslation(x, RAIL_Y - 0.012, z);
        sm.setMatrixAt(i, M);
        rm.setMatrixAt(i, M);
        i++;
      }
    sm.castShadow = rm.castShadow = true;
    piece('straps', [sm, rm], [0, 3.0, -2.2], 3);
    parts.straps.count = n;
    const bells = poles.map(([x, z]) => span([x - 0.035, 1.38, z - 0.03], [x + 0.035, 1.46, z + 0.03], 0.01));
    const b2 = poles.map(([x, z]) => cylX(0.022, 0.03, x + 0.045, 1.42, z, 16));
    piece('bell', [mesh(merge(bells), mat.plastic('#f5f5f0')), mesh(merge(b2), mat.lamp('#d8352a', 0.35))], [0, 3.0, -2.2], 3);
    const readers = [];
    for (const [x, z] of [[4.72, 0.98], [-0.56, 0.98]]) {
      readers.push(mesh(span([x - 0.08, 1.0, z - 0.14], [x + 0.08, 1.24, z - 0.03], 0.02), mat.plastic('#2a2d31')));
      readers.push(mesh(span([x - 0.06, 1.1, z - 0.032], [x + 0.06, 1.2, z - 0.025], 0.005), mat.lamp('#3ccf7a', 0.5)));
    }
    piece('reader', readers, [0, 2.6, -1.6], 3);
  }

  // ---- 駕駛座和方向盤 ----
  const steering = new THREE.Group();
  {
    const out = [];
    const seat = mesh(merge([
      span([-0.25, 0.42, -0.25], [0.25, 0.54, 0.25], 0.05),
      (() => {
        const b = span([-0.06, 0, -0.25], [0.06, 0.74, 0.25], 0.05);
        b.rotateZ(0.15);
        b.translate(-0.25, 0.52, 0);
        return b;
      })(),
      span([-0.09, 0, -0.09], [0.09, 0.42, 0.09], 0.02),
    ]), mat.plastic('#26292d', 0.75));
    seat.position.set(5.05, 0.55, -0.72);
    out.push(seat);
    out.push(mesh(span([5.62, 0.55, -W + 0.05], [5.9, 1.18, 0.35], 0.06), mat.plastic('#2c2f33', 0.6)));
    const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), new THREE.MeshStandardMaterial({map: dashTex(), emissive: '#ffffff', emissiveMap: dashTex(), emissiveIntensity: 0.25}));
    dash.position.set(5.6, 1.12, -0.72);
    dash.rotation.set(0, -Math.PI / 2, 0);
    dash.rotateX(-0.5);
    out.push(dash);
    out.push(mesh(rod([5.7, 0.9, -0.72], [5.45, 1.22, -0.72], 0.03), mat.black()));
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.022, 10, 40), mat.black());
    wheel.castShadow = true;
    const spokes = mesh(merge([span([-0.01, -0.22, -0.012], [0.01, 0.22, 0.012], 0.005), span([-0.01, -0.012, -0.22], [0.01, 0.012, 0.22], 0.005)]), mat.black());
    spokes.rotation.y = Math.PI / 2;
    steering.add(wheel, spokes);
    const tilt = new THREE.Group();
    tilt.position.set(5.43, 1.24, -0.72);
    tilt.rotation.z = 1.05;
    const face = new THREE.Group();
    face.rotation.y = Math.PI / 2;
    face.add(steering);
    tilt.add(face);
    out.push(tilt);
    piece('driver', out, [1.1, 2.3, -2.0], 4);
  }

  // ---- 斜坡板 ----
  const ramp = new THREE.Group();
  {
    const plate = mesh(span([-0.5, -0.02, 0], [0.5, 0.0, 0.9], 0.01), mat.plastic('#8b8f94', 0.5));
    const edge = mesh(span([-0.5, -0.019, 0.82], [0.5, 0.001, 0.9], 0.005), mat.plastic(COL.yellow));
    const edge2 = mesh(span([-0.5, -0.019, 0], [0.5, 0.001, 0.08], 0.005), mat.plastic(COL.yellow));
    const ribs = [];
    for (let i = 0; i < 9; i++) ribs.push(span([-0.45, 0.0, 0.12 + i * 0.075], [0.45, 0.006, 0.14 + i * 0.075], 0.002));
    ramp.add(plate, edge, edge2, mesh(merge(ribs), mat.plastic('#7a7e83', 0.5)));
    ramp.position.set((DOOR_R[0] + DOOR_R[1]) / 2, FLOOR + 0.004, RAMP_Z0);
    piece('ramp', [ramp], [0, 1.35, -1.5], 5);
  }

  // ---- 底盤大樑 ----
  {
    const g = [];
    for (const s of [-1, 1]) {
      g.push(span([-1.6, 0.18, s * 0.6 - 0.04], [5.9, 0.27, s * 0.6 + 0.04], 0.01));
      g.push(rod([-1.6, 0.225, s * 0.6], [-2.0, 0.6, s * 0.6], 0.05, 6));
      g.push(span([-6.0, 0.53, s * 0.6 - 0.04], [-1.95, 0.67, s * 0.6 + 0.04], 0.01));
      g.push(span([-5.95, 0.24, s * (W - 0.08) - 0.03], [5.9, 0.3, s * (W - 0.08) + 0.03], 0.005));
    }
    for (const x of [5.6, 4.6, 2.5, 1.3, 0.1, -1.2]) g.push(span([x - 0.04, 0.18, -W + 0.08], [x + 0.04, 0.27, W - 0.08], 0.005));
    for (const x of [-3.25, -5.9]) g.push(span([x - 0.04, 0.53, -0.64], [x + 0.04, 0.67, 0.64], 0.005));
    piece('frame', [mesh(merge(g), mat.chassis())], [0, 0, 0], 7);
  }

  // ---- 輪子：有胎紋的輪胎、碟形鋁圈、10 顆螺帽、後面的煞車鼓 ----
  const tireGeo = (() => {
    const R = R_TIRE;
    const r = 0.287;
    const h = 0.137;
    const pts = [[r, -h * 0.9], [r + 0.03, -h], [R - 0.09, -h * 1.02], [R - 0.03, -h * 0.92], [R - 0.006, -h * 0.75]];
    // 胎面：四條溝
    const grooves = [-0.075, -0.026, 0.026, 0.075];
    let y = -h * 0.7;
    pts.push([R, y]);
    for (const gy of grooves) {
      pts.push([R, gy - 0.008], [R - 0.012, gy - 0.006], [R - 0.012, gy + 0.006], [R, gy + 0.008]);
    }
    pts.push([R, h * 0.7], [R - 0.006, h * 0.75], [R - 0.03, h * 0.92], [R - 0.09, h * 1.02], [r + 0.03, h], [r, h * 0.9]);
    const g = new THREE.LatheGeometry(pts.map(([x, yy]) => new THREE.Vector2(x, yy)), 72);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const rimGeo = (() => {
    // 鋁圈側面輪廓（半徑, 往外的深度），轉一圈成碟形
    const prof = [[0.0, 0.1], [0.11, 0.1], [0.13, 0.092], [0.2, 0.078], [0.255, 0.072], [0.275, 0.085], [0.287, 0.11], [0.29, 0.12], [0.282, 0.125], [0.27, 0.112], [0.27, -0.12], [0.287, -0.125]];
    const g = new THREE.LatheGeometry(prof.map(([x, y]) => new THREE.Vector2(x, y)), 64);
    g.rotateX(Math.PI / 2);
    return g;
  })();
  const nutGeo = (() => {
    const list = [cylZ(0.075, 0.05, 0, 0, 0.11, 28), cylZ(0.05, 0.03, 0, 0, 0.14, 24)];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      list.push(cylZ(0.016, 0.035, Math.cos(a) * 0.14, Math.sin(a) * 0.14, 0.112, 6));
    }
    return merge(list);
  })();
  const holeGeo = (() => {
    const list = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const e = new THREE.CircleGeometry(0.03, 20);
      e.scale(1, 1.6, 1);
      e.rotateZ(a + Math.PI / 2);
      e.translate(Math.cos(a) * 0.218, Math.sin(a) * 0.218, 0.082);
      list.push(e);
    }
    return merge(list);
  })();
  const drumGeo = merge([cylZ(0.24, 0.18, 0, 0, -0.04, 32), cylZ(0.1, 0.3, 0, 0, -0.12, 16)]);
  const spinners = [];
  const steerers = [];
  const tireM = mat.tire();
  const rimM = mat.rim();
  const nutM = mat.alu();
  const holeM = new THREE.MeshBasicMaterial({color: '#2b2d30', side: THREE.DoubleSide});
  const drumM = mat.plastic('#3a3c3f', 0.7);
  const makeWheel = (side) => {
    const g = new THREE.Group();
    const spin = new THREE.Group();
    spin.add(mesh(tireGeo, tireM), mesh(rimGeo, rimM), mesh(nutGeo, nutM), mesh(holeGeo, holeM), mesh(drumGeo, drumM));
    const holder = new THREE.Group();
    holder.add(spin);
    if (side < 0) holder.rotation.y = Math.PI;
    g.add(holder);
    spinners.push({obj: spin, flip: side < 0});
    return g;
  };
  for (const s of [-1, 1]) {
    const steer = new THREE.Group();
    steer.position.set(AX_F, R_TIRE, s * 1.1);
    steer.add(makeWheel(s));
    steerers.push(steer);
    piece('wheels', [steer], [0.9, 0, s * 0.55], 6, unsprung);
    for (const dz of [0, -0.29]) {
      const w = makeWheel(s);
      w.position.set(AX_R, R_TIRE, s * (1.1 + dz));
      piece('wheels', [w], [-0.45, 0, s * (dz === 0 ? 0.6 : 0.3)], 6, unsprung);
    }
  }

  // ---- 前軸、後軸 ----
  {
    const g = [];
    for (const s of [-1, 1]) {
      g.push(rod([AX_F, 0.13, s * 0.64], [AX_F, R_TIRE, s * 0.9], 0.055, 10));
      g.push(cylZ(0.07, 0.14, AX_F, R_TIRE, s * 0.95, 16));
      g.push(rod([AX_F, R_TIRE, s * 0.95], [AX_F - 0.28, R_TIRE - 0.05, s * 0.9], 0.025, 8));
      g.push(cylY(0.04, R_TIRE - 0.16, R_TIRE + 0.16, AX_F, s * 0.93, 12)); // 大王銷
    }
    g.push(span([AX_F - 0.06, 0.08, -0.66], [AX_F + 0.06, 0.18, 0.66], 0.02));
    // 轉向拉桿：從方向機拉到左前輪的轉向臂
    g.push(rod([AX_F - 0.28, R_TIRE - 0.05, -0.9], [AX_F + 0.55, R_TIRE + 0.12, -0.95], 0.022, 8));
    g.push(span([AX_F + 0.5, R_TIRE + 0.05, -1.08], [AX_F + 0.72, R_TIRE + 0.3, -0.82], 0.04));
    // 煞車氣室：每個輪子旁邊一個圓罐，用空氣推動煞車
    const bc = [];
    for (const s2 of [-1, 1]) {
      bc.push(cylX(0.085, 0.18, AX_F + 0.24, R_TIRE + 0.08, s2 * 0.74, 18));
      bc.push(rod([AX_F + 0.14, R_TIRE + 0.08, s2 * 0.74], [AX_F + 0.02, R_TIRE - 0.02, s2 * 0.8], 0.012, 6));
    }
    piece('frontAxle', [mesh(merge(g), mat.chassis()), mesh(merge(bc), mat.plastic('#3d4147', 0.45))], [0.9, 0, 0], 6, unsprung);
  }
  {
    const g = [];
    for (const s of [-1, 1]) {
      g.push(rod([AX_R, R_TIRE, s * 1.0], [AX_R, 0.3, s * 0.35], 0.09, 12));
      g.push(cylZ(0.11, 0.22, AX_R, R_TIRE, s * 0.97, 20));
    }
    g.push(cylZ(0.09, 0.7, AX_R, 0.3, 0, 16));
    const diff = new THREE.SphereGeometry(0.2, 24, 16);
    diff.scale(1.1, 0.9, 1);
    diff.translate(AX_R - 0.05, 0.3, 0.05);
    g.push(diff);
    g.push(cylX(0.07, 0.25, AX_R - 0.3, 0.32, 0.05, 16));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.push(cylX(0.012, 0.03, AX_R + 0.05, 0.3 + Math.sin(a) * 0.19, 0.05 + Math.cos(a) * 0.19, 6));
    }
    const bc = [];
    for (const s2 of [-1, 1]) {
      bc.push(cylX(0.1, 0.22, AX_R + 0.3, R_TIRE + 0.1, s2 * 0.62, 18));
      bc.push(rod([AX_R + 0.18, R_TIRE + 0.1, s2 * 0.62], [AX_R + 0.04, R_TIRE, s2 * 0.7], 0.014, 6));
    }
    piece('rearAxle', [mesh(merge(g), mat.metal()), mesh(merge(bc), mat.plastic('#3d4147', 0.45))], [-0.45, 0, 0], 6, unsprung);
  }
  // ---- 空氣彈簧和避震器 ----
  const bags = [];
  {
    const geo = (() => {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push(new THREE.Vector2(0.1 + 0.035 * Math.sin(t * Math.PI) + 0.008 * Math.sin(t * Math.PI * 4), t));
      }
      return new THREE.LatheGeometry(pts, 28);
    })();
    const plate = mat.metal();
    const rub = mat.rubber();
    const spots = [];
    for (const s of [-1, 1]) {
      for (const dx of [-0.3, 0.3]) spots.push([AX_F + dx, 0.5, s, 0.9]);
      for (const dx of [-0.42, 0.42]) spots.push([AX_R + dx, 0.57, s, -0.45]);
    }
    for (const [x, y0, s, ex] of spots) {
      const g = new THREE.Group();
      g.position.set(x, y0, s * 0.8);
      const bag = mesh(geo, rub);
      bag.scale.y = 0.15;
      g.add(bag);
      const top = mesh(cylY(0.13, 0.15, 0.17, 0, 0, 20), plate);
      g.add(top);
      g.userData = {bag, top, h: 0.15, side: s};
      bags.push(g);
      piece('springs', [g], [ex, 0.5, 0], 6, unsprung);
    }
    // 避震器（黃色筒子），斜斜的
    const sh = [];
    for (const s of [-1, 1]) {
      sh.push(rod([AX_F + 0.12, 0.42, s * 0.88], [AX_F + 0.02, 0.85, s * 0.72], 0.035, 12));
      sh.push(rod([AX_R - 0.15, 0.45, s * 0.9], [AX_R - 0.05, 0.7, s * 0.72], 0.035, 12));
    }
    piece('springs', [mesh(merge(sh), mat.plastic('#e0b12a', 0.4))], [0.2, 0.5, 0], 6, unsprung);
  }

  // ---- 引擎：直列六缸，玻璃缸體看得到活塞 ----
  const pistons = [];
  const flames = [];
  const crankParts = [];
  {
    const out = [];
    const L6 = CYL_PITCH * 6 + 0.12;
    const x0 = ENG_X - L6 / 2;
    const blockMat = new THREE.MeshPhysicalMaterial({color: '#8fa3b3', roughness: 0.15, metalness: 0, transparent: true, opacity: 0.3, depthWrite: false});
    const block = mesh(span([x0, CRANK_Y - 0.1, -0.22], [x0 + L6, CRANK_Y + 0.4, 0.22], 0.03), blockMat);
    block.castShadow = false;
    block.renderOrder = 2;
    out.push(block);
    const iron = mat.plastic('#3a3f45', 0.5);
    iron.metalness = 0.5;
    // 缸頭、汽門室蓋（紅色，上面有一條條的筋）
    out.push(mesh(span([x0 - 0.02, CRANK_Y + 0.4, -0.24], [x0 + L6 + 0.02, CRANK_Y + 0.52, 0.24], 0.03), iron));
    const cover = [span([x0 + 0.02, CRANK_Y + 0.52, -0.19], [x0 + L6 - 0.02, CRANK_Y + 0.62, 0.19], 0.05)];
    for (let i = 0; i < 6; i++) cover.push(span([x0 + 0.08 + i * CYL_PITCH, CRANK_Y + 0.6, -0.15], [x0 + 0.1 + i * CYL_PITCH, CRANK_Y + 0.64, 0.15], 0.008));
    out.push(mesh(merge(cover), mat.plastic('#b83a26', 0.4)));
    out.push(mesh(span([x0 + 0.03, CRANK_Y - 0.22, -0.2], [x0 + L6 - 0.03, CRANK_Y - 0.1, 0.2], 0.04), iron));
    // 進氣、排氣歧管、渦輪（接在缸頭高度，下面的玻璃缸體才看得到活塞）
    out.push(mesh(span([x0 + 0.05, CRANK_Y + 0.42, -0.34], [x0 + L6 - 0.05, CRANK_Y + 0.54, -0.24], 0.04), mat.alu()));
    const exh = [];
    for (let i = 0; i < 6; i++) exh.push(rod([x0 + 0.12 + i * CYL_PITCH, CRANK_Y + 0.44, 0.24], [x0 + 0.12 + i * CYL_PITCH, CRANK_Y + 0.47, 0.32], 0.025, 8));
    exh.push(cylX(0.035, L6 - 0.12, ENG_X, CRANK_Y + 0.47, 0.33, 12));
    out.push(mesh(merge(exh), mat.metal()));
    const turbo = new THREE.TorusGeometry(0.09, 0.05, 12, 24);
    turbo.translate(ENG_X + 0.15, CRANK_Y + 0.5, 0.42);
    out.push(mesh(turbo, mat.metal()));
    // 空氣濾清器和進氣管
    out.push(mesh(cylX(0.11, 0.45, x0 + 0.2, CRANK_Y + 0.62, 0.42, 20), mat.plastic('#2b2e33', 0.6)));
    out.push(mesh(rod([ENG_X + 0.15, CRANK_Y + 0.55, 0.42], [x0 + 0.42, CRANK_Y + 0.62, 0.42], 0.045, 12), mat.rubber()));
    // 引擎後端的皮帶輪、發電機、水泵，用一條皮帶繞起來
    const px = x0 - 0.03;
    const pul = [[CRANK_Y, 0, 0.11], [CRANK_Y + 0.3, 0, 0.07], [CRANK_Y + 0.32, 0.3, 0.06]];
    for (const [y, z, r] of pul) out.push(mesh(cylX(r, 0.04, px, y, z, 24), mat.metal()));
    out.push(mesh(cylX(0.08, 0.2, px + 0.1, CRANK_Y + 0.32, 0.3, 20), mat.alu()));
    {
      const c = new THREE.CatmullRomCurve3([
        new THREE.Vector3(px, CRANK_Y - 0.11, 0), new THREE.Vector3(px, CRANK_Y, -0.115), new THREE.Vector3(px, CRANK_Y + 0.3, -0.075),
        new THREE.Vector3(px, CRANK_Y + 0.38, 0.05), new THREE.Vector3(px, CRANK_Y + 0.38, 0.3), new THREE.Vector3(px, CRANK_Y + 0.3, 0.36),
        new THREE.Vector3(px, CRANK_Y + 0.08, 0.1),
      ], true);
      out.push(mesh(new THREE.TubeGeometry(c, 60, 0.008, 6, true), mat.rubber()));
    }
    // 機油濾芯（藍色）和起動馬達
    out.push(mesh(cylY(0.05, CRANK_Y - 0.05, CRANK_Y + 0.12, ENG_X - 0.2, -0.28, 16), mat.plastic('#2f63b5', 0.4)));
    out.push(mesh(cylX(0.06, 0.24, x0 + L6 - 0.05, CRANK_Y - 0.05, -0.3, 16), mat.plastic('#2b2e33', 0.5)));
    // 飛輪殼
    const bell = new THREE.CylinderGeometry(0.2, 0.3, 0.16, 32);
    bell.rotateZ(Math.PI / 2);
    bell.translate(x0 + L6 + 0.08, CRANK_Y, 0);
    out.push(mesh(bell, iron));
    // 活塞：每缸一個，有缸套的細線和燃燒時的火光
    const pistonGeo = merge([cylY(SPEC.bore / 2 - 0.004, -0.05, 0.05, 0, 0, 24), cylY(SPEC.bore / 2 - 0.002, 0.02, 0.026, 0, 0, 24), cylY(SPEC.bore / 2 - 0.002, 0.034, 0.04, 0, 0, 24)]);
    const rodGeo = cylY(0.012, 0, 1, 0, 0, 8);
    const pM = mat.alu();
    const rM = mat.metal();
    for (let i = 0; i < 6; i++) {
      const x = x0 + 0.06 + CYL_PITCH * (i + 0.5);
      const liner = mesh(new THREE.CylinderGeometry(SPEC.bore / 2 + 0.006, SPEC.bore / 2 + 0.006, 0.36, 24, 1, true), new THREE.MeshStandardMaterial({color: '#c9d4dc', roughness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false}));
      liner.position.set(x, CRANK_Y + 0.21, 0);
      liner.castShadow = false;
      out.push(liner);
      const p = mesh(pistonGeo, pM);
      p.position.x = x;
      const r = mesh(rodGeo, rM);
      r.position.x = x;
      const flame = new THREE.Mesh(cylY(SPEC.bore / 2 - 0.006, 0, 1, 0, 0, 20), new THREE.MeshBasicMaterial({color: '#ff7a1a', transparent: true, opacity: 0, depthWrite: false}));
      flame.position.x = x;
      out.push(p, r, flame);
      pistons.push({p, r, x, i});
      flames.push(flame);
    }
    const crank = new THREE.Group();
    crank.position.set(ENG_X, CRANK_Y, 0);
    crank.add(mesh(cylX(0.03, L6, 0, 0, 0, 12), mat.metal()));
    out.push(crank);
    crankParts.push(crank);
    piece('engine', out, [-2.5, 0.35, 0], 6);
  }
  // ---- 變速箱 ----
  {
    const g = [];
    const body = new THREE.CylinderGeometry(0.17, 0.22, 0.62, 28);
    body.rotateZ(Math.PI / 2);
    body.translate(-4.0, CRANK_Y, 0);
    g.push(body);
    g.push(span([-4.25, CRANK_Y - 0.25, -0.12], [-3.8, CRANK_Y - 0.15, 0.12], 0.03));
    for (let i = 0; i < 5; i++) g.push(cylX(0.225, 0.02, -4.25 + i * 0.12, CRANK_Y, 0, 28));
    for (let i = 0; i < 8; i++) g.push(span([-4.2 + i * 0.06, CRANK_Y + 0.16, -0.08], [-4.18 + i * 0.06, CRANK_Y + 0.24, 0.08], 0.004));
    piece('gearbox', [mesh(merge(g), mat.alu())], [-1.5, 0.2, 0], 6);
  }
  // ---- 傳動軸（會轉） ----
  const shaftSpin = new THREE.Group();
  {
    const A = new THREE.Vector3(-3.69, CRANK_Y, 0);
    const B = new THREE.Vector3(AX_R - 0.42, 0.32, 0.05);
    const len = A.distanceTo(B);
    const tube = mesh(cylX(0.045, len - 0.1, 0, 0, 0, 16), mat.metal());
    const ends = mesh(merge([cylX(0.07, 0.05, -len / 2 + 0.03, 0, 0, 16), cylX(0.07, 0.05, len / 2 - 0.03, 0, 0, 16)]), mat.black());
    const stripe = mesh(span([-len / 2 + 0.1, 0.042, -0.012], [len / 2 - 0.1, 0.05, 0.012], 0.004), mat.plastic(COL.yellow));
    shaftSpin.add(tube, ends, stripe);
    const holder = new THREE.Group();
    holder.position.copy(A).add(B).multiplyScalar(0.5);
    holder.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), B.clone().sub(A).normalize());
    holder.add(shaftSpin);
    piece('shaft', [holder], [-0.9, 0.05, 0], 6);
  }
  // ---- 散熱器（左後） ----
  const fanBlades = new THREE.Group();
  {
    const out = [];
    out.push(mesh(span([-5.6, 0.45, -1.16], [-4.6, 1.0, -1.06], 0.02), mat.alu()));
    const fins = [];
    for (let i = 0; i < 22; i++) fins.push(span([-5.58 + i * 0.045, 0.47, -1.17], [-5.57 + i * 0.045, 0.98, -1.16], 0.001));
    out.push(mesh(merge(fins), mat.black()));
    const blades = [];
    for (let i = 0; i < 7; i++) {
      const b = span([-0.035, 0.04, -0.008], [0.035, 0.22, 0.008], 0.006);
      b.rotateY(0.45);
      b.rotateZ((i / 7) * Math.PI * 2);
      blades.push(b);
    }
    blades.push(cylZ(0.05, 0.05, 0, 0, 0, 16));
    fanBlades.add(mesh(merge(blades), mat.plastic('#2b2e33')));
    fanBlades.position.set(-5.1, 0.72, -0.98);
    out.push(fanBlades);
    out.push(mesh(new THREE.TorusGeometry(0.25, 0.012, 8, 40).translate(-5.1, 0.72, -0.98), mat.black()));
    out.push(mesh(rod([-4.65, 0.95, -1.05], [ENG_X + 0.3, CRANK_Y + 0.5, -0.24], 0.03, 10), mat.rubber()));
    piece('radiator', out, [-2.3, 0.6, -0.5], 6);
  }
  // ---- 油箱（左邊，後輪後面） ----
  {
    const g = mesh(span([-4.25, 0.3, -1.18], [-3.05, 0.64, -0.7], 0.08), mat.alu());
    const straps = mesh(merge([-3.95, -3.35].map((x) => span([x - 0.025, 0.29, -1.19], [x + 0.025, 0.65, -0.69], 0.01))), mat.black());
    const cap = mesh(cylY(0.05, 0.64, 0.68, -3.3, -1.05, 16), mat.black());
    piece('tank', [g, straps, cap], [-0.6, 0.1, -0.9], 6);
  }
  // ---- 電瓶（右邊） ----
  {
    const out = [];
    for (const dx of [0, 0.28]) {
      out.push(mesh(span([-3.7 + dx, 0.34, 0.72], [-3.46 + dx, 0.58, 1.12], 0.02), mat.plastic('#1f2226')));
      out.push(mesh(cylY(0.02, 0.58, 0.62, -3.64 + dx, 0.8, 10), mat.lamp('#d8352a', 0.2)));
      out.push(mesh(cylY(0.02, 0.58, 0.62, -3.52 + dx, 0.8, 10), mat.plastic('#111')));
    }
    piece('battery', out, [-0.6, 0.1, 0.9], 6);
  }
  // ---- 排氣管和消音器 ----
  {
    const out = [];
    out.push(mesh(span([-5.85, 0.3, 0.5], [-5.2, 0.56, 1.05], 0.1), mat.metal()));
    out.push(mesh(rod([ENG_X + 0.15, CRANK_Y + 0.45, 0.48], [-5.3, 0.45, 0.6], 0.04, 10), mat.metal()));
    out.push(mesh(rod([-5.85, 0.4, 0.9], [-6.1, 0.3, 1.0], 0.04, 10), mat.metal()));
    piece('exhaust', out, [-2.5, 0.3, 0.55], 6);
  }

  // ================= 電動版才有的零件（一開始看不到，切到電動版才長出來） =================
  // 配置照一般低地板電動公車簡化：電池分在車頂和車尾（原本的引擎室），中央馬達接傳動軸，控制器在車頂。
  const HV = mat.plastic('#ff7a1a', 0.45); // 高壓電線一律橘色
  const motorSpin = new THREE.Group();
  {
    // 車頂電池：兩組扁平的電池箱，上面有散熱的筋
    const packs = [];
    const ribs = [];
    for (const [a, b] of [[-5.35, -2.25], [2.65, 4.3]]) {
      packs.push(span([a, ROOF - 0.01, -0.92], [b, ROOF + 0.24, 0.92], 0.07));
      for (let x = a + 0.2; x < b - 0.1; x += 0.25) ribs.push(span([x - 0.02, ROOF + 0.24, -0.8], [x + 0.02, ROOF + 0.265, 0.8], 0.006));
    }
    const cable = [rod([-2.25, ROOF + 0.12, 0.7], [-0.75, ROOF + 0.12, 0.7], 0.025, 8), rod([-2.25, ROOF + 0.12, -0.7], [-2.0, ROOF + 0.12, -0.7], 0.025, 8)];
    piece('roofBattery', [mesh(merge(packs), mat.plastic('#d9dcdf', 0.45)), mesh(merge(ribs), mat.plastic('#9fa5ab', 0.4)), mesh(merge(cable), HV)], [0, 4.8, -2.8], 0);
    // 控制器：車頂上一個有散熱片的箱子
    const ctl = [span([-2.1, ROOF - 0.01, -0.55], [-1.0, ROOF + 0.2, 0.55], 0.05)];
    const fins = [];
    for (let i = 0; i < 8; i++) fins.push(span([-2.0 + i * 0.13, ROOF + 0.2, -0.45], [-1.97 + i * 0.13, ROOF + 0.26, 0.45], 0.004));
    piece('controller', [mesh(merge(ctl), mat.plastic('#3a3f45', 0.5)), mesh(merge(fins), mat.alu()), mesh(rod([-1.0, ROOF + 0.1, 0.4], [-0.75, ROOF + 0.12, 0.7], 0.025, 8), HV)], [0, 4.4, -2.6], 0);
  }
  {
    // 車尾電池：原本引擎的位置，上下兩層
    const g = [];
    for (const [y0, y1] of [[0.3, 0.68], [0.72, 1.12]]) g.push(span([-5.85, y0, -0.88], [-4.45, y1, 0.88], 0.05));
    const lines = [];
    for (let i = 1; i < 5; i++) for (const y of [0.49, 0.92]) lines.push(span([-5.85 + i * 0.28 - 0.006, y - 0.17, 0.885], [-5.85 + i * 0.28 + 0.006, y + 0.17, 0.89], 0.002));
    const cable = [rod([-4.45, 0.9, 0.6], [-4.1, 0.75, 0.25], 0.03, 8), rod([-4.45, 0.5, -0.6], [-4.15, 0.5, -0.25], 0.03, 8)];
    piece('rearBattery', [mesh(merge(g), mat.plastic('#d9dcdf', 0.45)), mesh(merge(lines), mat.plastic('#8e949a', 0.5)), mesh(merge(cable), HV)], [-2.5, 0.35, 0], 6);
  }
  {
    // 中央馬達：接在傳動軸前端，前面那片會轉的轉子看得到
    const out = [];
    const body = [cylX(0.25, 0.6, -4.0, CRANK_Y, 0, 36)];
    for (let i = 0; i < 9; i++) body.push(cylX(0.27, 0.025, -4.26 + i * 0.065, CRANK_Y, 0, 36));
    out.push(mesh(merge(body), mat.plastic('#5d6670', 0.4)));
    out.push(mesh(span([-4.15, CRANK_Y + 0.24, -0.12], [-3.85, CRANK_Y + 0.34, 0.12], 0.02), mat.plastic('#2b2e33', 0.5)));
    out.push(mesh(merge([rod([-4.1, CRANK_Y + 0.32, 0.06], [-4.15, 0.75, 0.25], 0.028, 8), rod([-3.95, CRANK_Y + 0.32, -0.06], [-4.15, 0.5, -0.25], 0.028, 8)]), HV));
    const rotor = [cylX(0.2, 0.03, 0, 0, 0, 36)];
    for (let i = 0; i < 4; i++) {
      const b = span([-0.018, -0.19, -0.02], [0.018, 0.19, 0.02], 0.004);
      b.rotateX((i / 4) * Math.PI);
      rotor.push(b);
    }
    motorSpin.add(mesh(merge(rotor), mat.alu()));
    const stripe = mesh(span([-0.02, 0.1, -0.03], [0.02, 0.19, 0.03], 0.004), mat.plastic('#ff7a1a', 0.4));
    motorSpin.add(stripe);
    motorSpin.position.set(-3.68, CRANK_Y, 0);
    out.push(motorSpin);
    piece('motor', out, [-1.5, 0.2, 0], 6);
  }
  {
    // 充電口：左邊車身後段一個小蓋子，裡面是插座
    const out = [];
    out.push(mesh(span([-4.35, 0.82, -W - 0.012], [-4.0, 1.08, -W + 0.01], 0.03), mat.plastic('#2f3337', 0.4)));
    for (const [dz, dy] of [[-0.06, 0.02], [0.06, 0.02], [0, -0.06]]) out.push(mesh(cylZ(0.022, 0.02, -4.175 + dz, 0.95 + dy, -W - 0.02, 16), mat.chrome()));
    const boltT = canvasTex(64, 64, (g) => {
      g.fillStyle = '#ffd23a';
      g.beginPath();
      g.moveTo(36, 4); g.lineTo(14, 36); g.lineTo(30, 36); g.lineTo(24, 60); g.lineTo(50, 24); g.lineTo(34, 24); g.lineTo(40, 4);
      g.closePath();
      g.fill();
    });
    const bolt = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshBasicMaterial({map: boltT, transparent: true}));
    bolt.rotation.y = Math.PI;
    bolt.position.set(-4.0 - 0.07, 1.12, -W - 0.006);
    out.push(bolt);
    piece('chargePort', out, [0, -0.2, -1.0], 2, sprung, HINGE_L);
  }

  return {
    root, sprung, unsprung, parts, pieces, doorLeaves, ramp, spinners, steerers, steering, shaftSpin, fanBlades,
    pistons, flames, crankParts, bags, seatColors: seatColorsOut, motorSpin,
  };
}

/** 曲柄連桿：曲軸角 θ（弧度）時，活塞銷離曲軸中心的高度。 */
export const pistonPin = (th) => CRANK_R * Math.cos(th) + Math.sqrt(ROD * ROD - (CRANK_R * Math.sin(th)) ** 2);
export const ENGINE = {CRANK_Y, CRANK_R, ROD};
export const LEVELS = {FLOOR, RAISED, TOP};
