// No.03 汽車：特斯拉 Model Y 新版（2025）。
import {buildCar, R_TIRE, SCALE, preload} from './model.js';
import {PARTS, SPEC, partText, tireCirc} from './data.js';
import {smooth, HP} from '../kit/app.js';

export const CAR_ICON = '<svg viewBox="0 0 24 24"><path d="M3 15.5v-2.2c0-1 .6-1.8 1.6-2.1l2.4-.7 2.6-3a3 3 0 0 1 2.3-1h3.4a3 3 0 0 1 2.4 1.2l2.1 2.8 1 .4c.7.3 1.2 1 1.2 1.8v2.8"/><path d="M3 15.5h18"/><circle cx="7.3" cy="16.5" r="1.9"/><circle cx="16.7" cy="16.5" r="1.9"/><path d="M7.5 10.5h9.5"/></svg>';
const ICONS = {
  drive: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M3.5 10.5h6.3M14.2 10.5h6.3M12 14.2V21"/></svg>',
  open: '<svg viewBox="0 0 24 24"><path d="M3 16.5h18M5 16.5l1.8-5h10.4l1.8 5"/><path d="M6.8 11.5L4 6.5M17.2 11.5l2.8-5" /><circle cx="7.5" cy="19" r="1.5"/><circle cx="16.5" cy="19" r="1.5"/></svg>',
};
const DEG = Math.PI / 180;

export default {
  id: 'car',
  name: ['汽車', 'Car'],
  PARTS,
  partText,
  build: buildCar,
  preload, // 點進來時先下載這台的 3D 資料
  subtitle: () => ['特斯拉・Model Y', 'Tesla · Model Y'],
  facts() {
    const row = (dt, dd, small) => `<div><dt>${HP(dt)}</dt><dd>${dd}${small ? `<small>${HP(small)}</small>` : ''}</dd></div>`;
    return `<dl>
      ${row(['長', 'Length'], `<b>${SPEC.length}</b> ${HP(['公尺', 'm'])}`, [`差不多 ${Math.round(SPEC.length / SPEC.kid)} 個小朋友躺成一排`, `About ${Math.round(SPEC.length / SPEC.kid)} kids lying in a row`])}
      ${row(['寬', 'Width'], `<b>${SPEC.width}</b> ${HP(['公尺', 'm'])}`, ['加上後照鏡 2.13 公尺', '2.13 m with the mirrors'])}
      ${row(['高', 'Height'], `<b>${SPEC.height}</b> ${HP(['公尺', 'm'])}`)}
      ${row(['座位', 'Seats'], `<b>${SPEC.seats}</b>`)}
      ${row(['螢幕', 'Screens'], `<b>${SPEC.screen}</b> ${HP(['吋', 'in'])}・<b>${SPEC.rearScreen}</b> ${HP(['吋', 'in'])}`, ['前面一個大的、後座一個小的', 'A big one in front, a small one in back'])}
      ${row(['電池', 'Battery'], `${HP(['大約', 'About'])} <b>${SPEC.battery}</b> ${HP(['度電', 'kWh'])}`, ['差不多可以把 5000 支手機充飽', 'Enough to charge about 5,000 phones'])}
      ${row(['馬達', 'Motors'], `<b>2</b>`, ['前面一個、後面一個，四輪都出力', 'One front, one rear: all-wheel drive'])}
    </dl>
    <p class="src">${HP(['尺寸、馬達、懸吊、前後車廂容量取自特斯拉台灣版車主手冊；電池在地板下的位置照特斯拉緊急救援手冊，大小是照手冊的圖按軸距量的（特斯拉沒有公布）；電池容量是報導的數字。底盤和電池的外形借用 Model X 底盤、Model S 電池的模型，照這些位置和大小擺。', 'Size, motors, suspension and trunk space are from Tesla’s Taiwan owner’s manual. The battery’s place under the floor follows Tesla’s emergency response guide, and its size is measured from the guide’s drawing against the wheelbase (Tesla doesn’t publish it); battery capacity is from news reports. The chassis and battery shapes borrow Model X chassis and Model S battery models, placed to match.'])}</p>
    <p class="src credit">3D：“2025 Tesla Model Y” by BloxBloger（CC BY-NC 4.0）・“Tesla Model X chassis” by Michael Zhang・“Tesla Batterie Pack V2” by AniMtrX・“Tesla Front / Rear Small Drive Unit” by tangentinnovationgroup（CC BY 4.0）・Sketchfab</p>`;
  },
  LAYERS: [
    {name: ['車子外面', 'Outside'], ids: ['front', 'hood', 'windshield', 'roof', 'doors', 'mirrors', 'liftgate', 'rear', 'body']},
    {name: ['車子裡面', 'Inside'], ids: ['floor', 'seats', 'dash', 'screen', 'rearScreen', 'steering', 'frunk', 'trunk']},
    {name: ['底盤', 'Chassis'], ids: ['wheels', 'brakes', 'suspension', 'casting', 'frame']},
    {name: ['電池和馬達', 'Battery and motors'], ids: ['battery', 'frontMotor', 'rearMotor', 'heatpump', 'chargePort']},
  ],
  STACK: [
    {name: ['整台', 'Whole'], say: ['整台車，組回去囉。', 'The whole car, all put back together.'], icon: CAR_ICON.replace(/<\/?svg[^>]*>/g, '')},
    {name: ['外面', 'Outside'], say: ['第一層，車子外面。', 'Layer one: the outside.'], icon: '<path d="M3 14.5c0-1 .6-1.7 1.5-2l2.5-.8 2.6-3a3 3 0 0 1 2.3-1h3.4a3 3 0 0 1 2.4 1.2l2 2.7c1 .3 2.3.8 2.3 2.2v1.7H3z"/>'},
    {name: ['裡面', 'Inside'], say: ['第二層，車子裡面。', 'Layer two: the inside.'], icon: '<path d="M7.5 3.5v10.5h9"/><path d="M7.5 14l-1.5 6.5M16.5 14v6.5"/><path d="M7.5 9.5h5"/>'},
    {name: ['底盤', 'Chassis'], say: ['第三層，底盤。', 'Layer three: the chassis.'], icon: '<path d="M2.5 11h19"/><path d="M5 11V8.5h14V11"/><circle cx="6.5" cy="16" r="3.2"/><circle cx="17.5" cy="16" r="3.2"/>'},
    {name: ['電池', 'Battery'], say: ['第四層，電池和馬達。', 'Layer four: the battery and motors.'], icon: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M19 10.5h2v3h-2"/><path d="M11.5 8.8l-2.3 3.6h3.4l-2.2 3.8"/>'},
  ],
  LABEL_ORDER: ['battery', 'frontMotor', 'rearMotor', 'screen', 'seats', 'wheels', 'front', 'roof', 'doors', 'hood', 'liftgate', 'frunk', 'trunk', 'steering', 'rearScreen', 'dash',
    'casting', 'frame', 'brakes', 'suspension', 'chargePort', 'heatpump', 'mirrors', 'windshield', 'rear', 'body', 'floor'],
  XRAY_K: {front: 1, hood: 1, windshield: 1, roof: 1, doors: 1, mirrors: 1, liftgate: 1, rear: 1, body: 1, floor: 0.6},
  sun: {pos: [6, 14, -8], ext: 9},
  ao: 0.22,
  groundMarks: `m = max(m, step(abs(vW.z + 2.6), 0.06) * step(mod(x, 6.0), 3.0));
        m = max(m, step(abs(vW.z - 2.7), 0.06));`,
  groundFade: ['0.6, 1.0', '5.0, 12.0'],
  // 左前方：駕駛座和充電口那一邊
  cam: {min: 3, max: 40, home: [0.82, 0.34, -0.85], explode: [0.6, 1.0, -0.8], r: [3.9, 3.8], rh: [5.0, 3.6], target: (ex) => [0, 1.35 + 0.8 * ex, -0.6 * ex]},
  actions: [
    {id: 'drive', icon: ICONS.drive, label: ['開車', 'Drive']},
    {id: 'open', icon: ICONS.open, label: ['打開', 'Open']},
  ],
  panel: [
    {id: 'dSpeed', label: ['公里／小時', 'km/h']},
    {id: 'dTurn', label: ['輪子每秒轉幾圈', 'wheel turns a second']},
    {id: 'dDist', label: ['走了幾公尺', 'meters driven']},
  ],
  LIGHTS: [
    {id: 'bar', name: ['光條', 'Light bar'], say: ['車頭最上面一整條細細的燈，是新 Model Y 最好認的地方。', 'The thin light bar across the top of the nose is the easiest way to spot the new Model Y.'], color: '#eef3ff', view: [1, 0.35, -0.35],
      icon: '<path d="M3 11c3-1.6 15-1.6 18 0"/><path d="M3 11v2.5M21 11v2.5"/>'},
    {id: 'head', name: ['頭燈', 'Headlights'], say: ['頭燈藏在保險桿兩邊的黑框裡，晚上照亮前面的路。', 'The headlights hide in the black frames at the bumper corners and light up the road at night.'], color: '#ffe9a8', view: [1, 0.25, -0.45],
      icon: '<path d="M3.5 8h5a4 4 0 0 1 0 8h-5z"/><path d="M14 9l6.5-1.5M14 12h7M14 15l6.5 1.5"/>'},
    {id: 'turn', name: ['方向燈', 'Turn signals'], say: ['要轉彎的時候，光條兩端的琥珀色燈會一閃一閃。', 'Before turning, the amber lights at both ends of the light bar blink.'], color: '#ffb02e', mode: 'blink', view: [1, 0.35, -0.6],
      icon: '<path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/>'},
    {id: 'tail', name: ['尾燈', 'Tail lights'], say: ['車尾一整條紅色的光條，讓後面的車知道前面有車。', 'A full-width red light bar at the back tells cars behind that you are there.'], color: '#ff4a3a', view: [-1, 0.35, -0.45],
      icon: '<path d="M3 12c3-1.4 15-1.4 18 0"/><path d="M3 12v3M21 12v3"/>'},
    {id: 'ambient', name: ['氣氛燈', 'Ambient light'], say: ['車子裡面儀表板和中控台上有一條氣氛燈，晚上亮起淡淡的藍光。', 'Inside, a strip of ambient light along the dashboard and console glows soft blue at night.'], color: '#7fb3ff', view: [0.4, 1, -0.6],
      icon: '<path d="M4 15c4-3 12-3 16 0"/><path d="M6 11c3-2 9-2 12 0" opacity=".55"/>'},
  ],
  pools: [
    {group: 'head', x: 4.79 * 1 + 2.4, z: 0, w: 5, l: 3.4, peak: 0.65},
    {group: 'tail', x: -4.79 - 1.2, z: 0, w: 2.2, l: 3.0, color: '#ff3b2a', peak: 0.3},
  ],

  setup(ctx) {
    const {model: car, $, sound, sayPair, setBtn, later} = ctx;
    // pending：等車停好才開門、等門關好才出發（使用者自己按任何一顆就取消）
    const V = {driving: false, speed: 0, dist: 0, open: false, openP: 0, pending: null, idleT: 0};
    const handlers = {
      drive: (auto) => {
        if (auto !== true) V.pending = null;
        if (!V.driving && V.open) {
          sayPair('先把車門關好，才能開車喔。', 'Close the doors first, then we can drive.');
          handlers.open(true);
          V.pending = 'drive';
          return;
        }
        V.driving = !V.driving;
        setBtn('drive', V.driving, V.driving ? ['停車', 'Stop'] : ['開車', 'Drive']);
        $('#drive').hidden = false;
        sound.engine(V.driving, 'ev');
        if (V.driving) sayPair('出發囉！電動車好安靜，聽聽看。', 'Here we go! Listen, the electric car is so quiet.');
        else sayPair('停車囉。', 'We stopped.');
      },
      open: (auto) => {
        if (auto !== true) V.pending = null;
        if (V.driving || V.speed > 0) {
          sayPair('車子要先停好，才能開門喔。', 'The car has to stop before the doors can open.');
          if (V.driving) handlers.drive(true);
          V.pending = 'open';
          return;
        }
        V.open = !V.open;
        setBtn('open', V.open, V.open ? ['關上', 'Close'] : ['打開', 'Open']);
        sound.hiss();
        if (V.open) sayPair('四個車門、前車廂和尾門都打開了。前面放東西的地方沒有引擎喔！', 'All four doors, the front trunk and the liftgate are open. There’s no engine in the front!');
        else sayPair('全部關上囉。', 'All closed.');
      },
    };
    return {
      handlers,
      update(dt, ex) {
        const want = V.driving ? 40 : 0;
        V.speed += (want - V.speed) * (1 - Math.exp(-dt * (V.driving ? 0.8 : 1.2)));
        if (!V.driving && V.speed < 0.05) V.speed = 0;
        V.dist += (V.speed / 3.6) * dt;
        // 打開：車門、前車廂蓋、尾門一起慢慢打開（拆開的時候先關上）
        V.openP += ((V.open ? 1 : 0) - V.openP) * (1 - Math.exp(-dt * 2.6));
        if (V.pending === 'open' && V.speed === 0) {
          V.pending = null;
          handlers.open(true);
        } else if (V.pending === 'drive' && !V.open && V.openP < 0.03) {
          V.pending = null;
          handlers.drive(true);
        }
        // 拆開的時候門會關上：按鈕也要跟著變回「打開」
        if (ex > 0.5 && V.open) {
          V.open = false;
          setBtn('open', false, ['打開', 'Open']);
        }
        const k = smooth(V.openP) * (1 - ex);
        for (const d of car.open.doors) d.grp.rotation.y = d.side * k * (d.front ? 62 : 58) * DEG;
        car.open.hood.rotation.z = k * 48 * DEG;
        car.open.gate.rotation.z = -k * 80 * DEG;
        // 輪子：走了多遠就轉多少
        const ang = V.dist / R_TIRE;
        for (const s of car.spinners) s.obj.rotation.z = s.flip ? ang : -ang;
        const steer = V.speed > 0.5 ? 0.12 * Math.sin(V.dist * 0.12) * Math.min(1, V.speed / 12) : 0;
        for (const st of car.steerers) st.rotation.y = steer;
        ctx.groundMat.uniforms.uRoll.value = V.dist * SCALE;
        ctx.groundMat.uniforms.uRoad.value += ((V.speed > 0.2 || V.driving ? 1 : 0) - ctx.groundMat.uniforms.uRoad.value) * (1 - Math.exp(-dt * 3));
        if (!$('#drive').hidden) {
          $('#dSpeed').textContent = Math.round(V.speed);
          $('#dTurn').textContent = (V.speed / 3.6 / tireCirc()).toFixed(1);
          $('#dDist').textContent = Math.floor(V.dist);
          V.idleT = !V.driving && V.speed === 0 ? V.idleT + dt : 0;
          if (V.idleT > 2.5) $('#drive').hidden = true;
        }
        sound.setSpeed(V.speed);
      },
    };
  },
};
