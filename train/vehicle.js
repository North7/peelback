// No.04 火車：台灣高鐵 700T。
import * as THREE from 'three';
import {buildTrain, SEATS, R_WHEEL, SCALE} from './model.js';
import {PARTS, SPEC, partText} from './data.js';
import {smooth, HP} from '../kit/app.js';

export const TRAIN_ICON = '<svg viewBox="0 0 24 24"><path d="M2.5 16.5h13.2c2.8 0 5.8-1.6 5.8-3.6 0-2.4-3.6-4.4-8.5-4.4H2.5z"/><path d="M2.5 12.2h10.8"/><path d="M15 9.2l2.3 2.6"/><path d="M2.5 20h19"/></svg>';
const ICONS = {
  run: '<svg viewBox="0 0 24 24"><path d="M2.5 15.5h12.8c2.7 0 5.7-1.5 5.7-3.4 0-2.3-3.5-4.2-8.2-4.2H2.5z"/><path d="M3 19.5h4M10 19.5h4M17 19.5h4"/></svg>',
  seats: '<svg viewBox="0 0 24 24"><path d="M7 4.5v9h8.5"/><path d="M7 13.5l-1.5 6M15.5 13.5v6"/><path d="M15 6.5a5 5 0 0 1 4.5 5.5"/><path d="M19.5 12l1.5-1.6M19.5 12l-1.9-.9"/></svg>',
};
const WHEEL_C = Math.PI * R_WHEEL * 2;

export default {
  id: 'train',
  name: ['火車', 'Train'],
  PARTS,
  partText,
  build: buildTrain,
  subtitle: () => ['台灣高鐵・700T', 'Taiwan High Speed Rail · 700T'],
  facts() {
    const row = (dt, dd, small) => `<div><dt>${HP(dt)}</dt><dd>${dd}${small ? `<small>${HP(small)}</small>` : ''}</dd></div>`;
    const busN = (n) => Math.round(n / SPEC.bus);
    return `<dl>
      ${row(['長', 'Length'], `<b>${SPEC.length}</b> ${HP(['公尺', 'm'])}`, [`12 節，差不多 ${busN(SPEC.length)} 台公車排成一排`, `12 cars, about ${busN(SPEC.length)} buses in a row`])}
      ${row(['寬', 'Width'], `<b>${SPEC.width}</b> ${HP(['公尺', 'm'])}`)}
      ${row(['高', 'Height'], `<b>${SPEC.height}</b> ${HP(['公尺', 'm'])}`, ['從鐵軌到車頂', 'From the rails to the roof'])}
      ${row(['座位', 'Seats'], `<b>${SPEC.seats}</b>`, [`標準車廂 ${SPEC.standard}、商務車廂 ${SPEC.business}`, `Standard ${SPEC.standard}, business ${SPEC.business}`])}
      ${row(['最快', 'Top speed'], `<b>${SPEC.speed}</b> ${HP(['公里／小時', 'km/h'])}`)}
      ${row(['馬達', 'Motors'], `<b>${SPEC.motors}</b>`, ['在 12 節裡的 9 節車廂底下', 'Under 9 of the 12 cars'])}
      ${row(['重量', 'Weight'], `<b>${SPEC.weight}</b> ${HP(['公噸', 'tonnes'])}`, [`差不多 ${Math.round(SPEC.weight / SPEC.busT)} 台公車那麼重`, `As heavy as about ${Math.round(SPEC.weight / SPEC.busT)} buses`])}
    </dl>
    <p class="src">${HP(['尺寸、重量、馬達、編組取自維基百科（引用川崎重工和 JRTR 的資料）；每一節的座位照高鐵官網的座位圖排；座椅顏色照新聞報導。集電弓、馬達、車頭燈的樣子和位置是簡化的示意。', 'Size, weight, motors and formation are from Wikipedia (citing Kawasaki and JRTR); the seats in every car follow THSR’s official seat maps; seat colors follow news reports. The pantographs, motors and headlights are simplified.'])}</p>
    <p class="src credit">3D：“THSR 700T / Interior (Locomotive 01)”・“Taiwan HSR700T / Interior (Cabin 02)” by Basic Hsu（CC BY 4.0）・Sketchfab</p>`;
  },
  LAYERS: [
    {name: ['火車外面', 'Outside'], ids: ['nose', 'body', 'windows', 'pantograph']},
    {name: ['車廂裡面', 'Inside'], ids: ['cab', 'standard', 'business', 'accessible', 'racks', 'toilet', 'vending', 'saloon']},
    {name: ['車底', 'Underneath'], ids: ['bogie', 'wheels', 'motors']},
  ],
  STACK: [
    {name: ['整列', 'Whole'], say: ['整列高鐵，組回去囉。', 'The whole train, all put back together.'], icon: TRAIN_ICON.replace(/<\/?svg[^>]*>/g, '')},
    {name: ['外面', 'Outside'], say: ['第一層，火車外面。', 'Layer one: outside the train.'], icon: '<path d="M2.5 15.5h13c2.6 0 5.5-1.4 5.5-3.3 0-2.2-3.4-4.2-8-4.2H2.5z"/>'},
    {name: ['裡面', 'Inside'], say: ['第二層，車廂裡面。', 'Layer two: inside the cars.'], icon: '<path d="M7.5 3.5v10.5h9"/><path d="M7.5 14l-1.5 6.5M16.5 14v6.5"/><path d="M7.5 9.5h5"/>'},
    {name: ['車底', 'Under'], say: ['第三層，車底，有輪子和馬達。', 'Layer three: underneath, with wheels and motors.'], icon: '<path d="M2.5 10h19"/><circle cx="7" cy="15.5" r="3"/><circle cx="17" cy="15.5" r="3"/>'},
  ],
  LABEL_ORDER: ['nose', 'cab', 'business', 'standard', 'pantograph', 'wheels', 'bogie', 'motors', 'toilet', 'accessible', 'vending', 'racks', 'windows', 'body', 'saloon'],
  XRAY_K: {nose: 1, body: 1, windows: 1, saloon: 0.6},
  sun: {pos: [4, 14, 6], ext: 14},
  ao: 0.18,
  LIGHTS: [
    {id: 'head', name: ['車頭燈', 'Headlights'], say: ['車頭燈在鼻子下面兩邊，晚上和山洞裡會打開。', 'The headlights sit low on each side of the nose. They switch on at night and in tunnels.'], color: '#fff3d6', view: [1, 0.3, 0.4],
      icon: '<circle cx="7.5" cy="12" r="4"/><path d="M13 9l8-3M13 12h8.5M13 15l8 3"/>'},
    {id: 'tail', name: ['尾燈', 'Tail lights'], say: ['最後一節的車頭燈變成紅色的尾燈，告訴後面：火車的屁股在這裡。', 'At the last car the lights glow red, saying: this is the end of the train.'], color: '#ff4a3a', view: [-1, 0.3, 0.4],
      icon: '<circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2"/>'},
    {id: 'cabin', name: ['車廂燈', 'Cabin lights'], say: ['車廂裡的燈打開，從外面看，一整排窗戶都亮起來了。', 'With the cabin lights on, the whole row of windows glows from outside.'], color: '#ffd08a', view: [0.3, 0.25, 1],
      icon: '<path d="M4 6h16"/><path d="M8 6v2.5h8V6"/><path d="M7 12l-2 6M17 12l2 6M12 11.5V18" opacity=".55"/>'},
  ],
  pools: [
    {group: 'head', x: 1.6, z: 0, w: 0.9, l: 2.2, peak: 0.55},
  ],
  // 跑起來的時候地上一條條往後跑（看得出速度）
  groundMarks: `m = max(m, step(mod(x, 3.0), 0.12) * step(abs(vW.z), 3.0));`,
  groundFade: ['0.6, 0.6', '8.0, 22.0'],
  cam: {frameLen: 6, min: 1.2, max: 70, home: [0.62, 0.26, 0.75], explode: [0.5, 0.9, 0.8], r: [1.0, 1.6], rh: [2.6, 1.0], target: (ex) => [-1.9, 0.42 + 1.0 * ex, 0]},
  actions: [
    {id: 'run', icon: ICONS.run, label: ['出發', 'Go']},
    {id: 'seats', icon: ICONS.seats, label: ['轉椅子', 'Turn seats']},
  ],
  panel: [
    {id: 'dSpeed', label: ['公里／小時', 'km/h']},
    {id: 'dTurn', label: ['輪子每秒轉幾圈', 'wheel turns a second']},
    {id: 'dDist', label: ['走了幾公尺', 'meters traveled']},
  ],
  panelNote: ['快轉播放', 'Sped up'],

  setup(ctx) {
    const {model, $, sound, sayPair, setBtn, later} = ctx;
    const V = {running: false, speed: 0, dist: 0, turned: false, turnP: 0, shown: 0};
    // 轉椅子：每個位子在原地轉半圈（真的高鐵椅子可以轉，永遠面向火車前進的方向）
    const seatMeshes = [];
    for (const id of ['standard', 'business', 'accessible']) for (const m of model.parts[id]?.meshes || []) if (m.isInstancedMesh) seatMeshes.push({m, list: id === 'standard' ? SEATS.std : id === 'business' ? SEATS.biz : SEATS.wheel});
    const M = new THREE.Matrix4();
    const R = new THREE.Matrix4();
    const T = new THREE.Matrix4();
    const PIV = -0.06; // 位子的中心（坐墊和椅背中間）
    const setSeats = (a) => {
      R.makeRotationY(a);
      for (const {m, list} of seatMeshes) {
        list.forEach((s, k) => {
          M.makeTranslation(s.x + PIV, 0, s.z).multiply(R).multiply(T.makeTranslation(-PIV, 0, 0));
          m.setMatrixAt(k, M);
        });
        m.instanceMatrix.needsUpdate = true;
      }
    };
    const handlers = {
      run: () => {
        V.running = !V.running;
        setBtn('run', V.running, V.running ? ['停車', 'Stop'] : ['出發', 'Go']);
        $('#drive').hidden = false;
        sound.engine(V.running, 'ev');
        if (V.running) {
          ctx.setLight('head', true, {quiet: true, focus: false, night: false});
          ctx.setLight('tail', true, {quiet: true, focus: false, night: false});
          sayPair('出發囉！高鐵越跑越快，最快每小時 300 公里。', 'Here we go! The train speeds up, up to 300 km an hour.');
        } else sayPair('準備進站，慢慢停下來。', 'Coming into the station, slowing down.');
      },
      seats: () => {
        V.turned = !V.turned;
        setBtn('seats', V.turned, V.turned ? ['轉回來', 'Turn back'] : ['轉椅子', 'Turn seats']);
        if (ctx.S.layer !== 2) ctx.setLayer(2);
        sayPair(V.turned ? '到了終點，火車要往回開。椅子整排轉過來，大家還是面向前面。' : '椅子轉回來囉。',
          V.turned ? 'At the last stop the train goes back the other way, so the seats spin around and everyone still faces forward.' : 'The seats turned back.');
      },
    };
    return {
      handlers,
      update(dt) {
        // 加速：0 到 300 公里大約 40 秒（這裡快轉）
        const want = V.running ? SPEC.speed : 0;
        const k = V.running ? 0.35 : 0.6;
        V.speed += (want - V.speed) * (1 - Math.exp(-dt * k));
        if (!V.running && V.speed < 0.5) V.speed = 0;
        V.dist += (V.speed / 3.6) * dt * 0.08; // 畫面上放慢，不然地上的線會糊掉
        ctx.groundMat.uniforms.uRoll.value = V.dist * SCALE;
        ctx.groundMat.uniforms.uRoad.value += ((V.speed > 1 || V.running ? 1 : 0) - ctx.groundMat.uniforms.uRoad.value) * (1 - Math.exp(-dt * 3));
        V.turnP += ((V.turned ? 1 : 0) - V.turnP) * (1 - Math.exp(-dt * 2.2));
        const a = smooth(V.turnP) * Math.PI;
        if (Math.abs(a - V.shown) > 1e-4) {
          V.shown = a;
          setSeats(a);
        }
        if (!$('#drive').hidden) {
          $('#dSpeed').textContent = Math.round(V.speed);
          $('#dTurn').textContent = (V.speed / 3.6 / WHEEL_C).toFixed(1);
          $('#dDist').textContent = Math.floor(V.dist / 0.08);
          if (!V.running && V.speed === 0) later(() => !V.running && V.speed === 0 && ($('#drive').hidden = true), 2500);
        }
        sound.setSpeed(V.speed / 6);
      },
    };
  },
};
