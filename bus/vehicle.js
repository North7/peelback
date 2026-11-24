// No.01 公車：台北客運日野低地板公車，可以切換柴油／電動。
import {buildBus, pistonPin, ENGINE, R_TIRE, RAMP_Z0, RAMP_Z1, LEVELS} from './model.js';
import {PARTS, SPEC, displacementL, tireCirc, partText, hasPart, DIFFS} from './data.js';
import {smooth, L, Lp, H, HP} from '../kit/app.js';

const ICONS = {
  drive: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><path d="M3.5 10.5h6.3M14.2 10.5h6.3M12 14.2V21"/></svg>',
  door: '<svg viewBox="0 0 24 24"><path d="M5 21V3h9v18"/><path d="M14 5l5 1.5V21h-5"/><circle cx="11.5" cy="12" r="0.6"/></svg>',
  fuel: '<svg viewBox="0 0 24 24"><path d="M12 3.5c3 4 5.5 7 5.5 10a5.5 5.5 0 0 1-11 0c0-3 2.5-6 5.5-10z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2.5L5.5 13.5h6l-1 8 8-11h-6z"/></svg>',
  compare: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="7" height="14" rx="2"/><rect x="14" y="5" width="7" height="14" rx="2"/><path d="M10 12h4"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
};
export const BUS_ICON = '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="13" rx="3"/><path d="M3 10h18M8 4v6M16 4v6"/><circle cx="7.5" cy="19" r="1.6"/><circle cx="16.5" cy="19" r="1.6"/></svg>';

const FIRE = [0, 4, 2, 5, 1, 3]; // 點火順序 1-5-3-6-2-4：第 i 缸在第幾個 120°
const SLOW = 1 / 25; // 活塞用慢動作，不然看不清楚
const kneelDrop = 0.07;

export default {
  id: 'bus',
  name: ['公車', 'Bus'],
  PARTS,
  partText,
  variants: [{id: 'diesel'}, {id: 'ev'}],
  present: (id, v) => hasPart(id, v),
  build: buildBus,
  subtitle: (S) => (S.variant === 'ev' ? ['台北客運・電動低地板公車', 'Taipei Bus · electric low-floor bus'] : ['台北客運・日野低地板公車', 'Taipei Bus · Hino low-floor bus']),
  facts(S) {
    const kids = (SPEC.length / SPEC.kid).toFixed(1);
    const row = (dt, dd, small) => `<div><dt>${HP(dt)}</dt><dd>${dd}${small ? `<small>${HP(small)}</small>` : ''}</dd></div>`;
    const ev = S.variant === 'ev';
    return `<dl>
      ${row(['長', 'Length'], `<b>${SPEC.length}</b> ${HP(['公尺', 'm'])}`, [`差不多 ${Math.round(SPEC.length / SPEC.kid)} 個小朋友躺成一排（${kids}）`, `About ${Math.round(SPEC.length / SPEC.kid)} kids lying in a row (${kids})`])}
      ${row(['寬', 'Width'], `<b>${SPEC.width}</b> ${HP(['公尺', 'm'])}`)}
      ${row(['輪子', 'Wheels'], `<b>6</b>`, [`轉一圈走 ${tireCirc().toFixed(1)} 公尺`, `One turn rolls ${tireCirc().toFixed(1)} m`])}
      ${
        ev
          ? row(['動力', 'Power'], HP(['馬達和電池', 'Motor and batteries']), ['不燒油，沒有排氣管', 'No fuel, no exhaust pipe']) +
            row(['台北市', 'Taipei'], HP(['每 4 台公車，就有 1 台多是電動的', 'More than 1 in 4 city buses is electric']), ['3,336 台裡有 911 台（2025 年 8 月）', '911 of 3,336 buses (Aug 2025)'])
          : row(['引擎', 'Engine'], `<b>6</b> ${HP(['缸', 'cylinders'])}・${displacementL().toFixed(1)} ${HP(['公升', 'L'])}・${SPEC.hp} ${HP(['匹馬力', 'hp'])}`) +
            row(['台北客運', 'Taipei Bus'], `${HP(['這款車登記過', 'This model:'])} <b>${SPEC.fleet.goya + SPEC.fleet.hongju}</b> ${HP(['台', 'buses'])}`)
      }
      ${row(['地板', 'Floor'], `${HP(['離地不到', 'Under'])} <b>35</b> ${HP(['公分', 'cm off the ground'])}`)}
    </dl>
    <p class="src">${HP(
      ev
        ? ['電動版的電池、馬達、控制器位置，照一般低地板電動公車的配置簡化，不是特定車型。電動公車數量取自臺北市政府主計處統計。', 'The electric version’s batteries, motor and controller are placed like a typical low-floor electric bus, not one exact model. Bus counts are from Taipei City Government statistics.']
        : ['日野 HS8JRVL-UTF（弘鉅車體）。軸距、後懸、車寬取自弘鉅汽車公開的規格（12.2 公尺含前面的後照鏡），前懸、引擎、ZF 自動變速箱、前 2 後 4 個氣囊取自和泰汽車的底盤規格；車門、車窗、冷氣機的位置和車內座位照臺北客運的實車照片和車內影片。後段有幾排、要上幾階、引擎和油箱的確切位置沒有找到照片，是照座位數 24 和同款車推的。', 'Hino HS8JRVL-UTF with a Hongju body. Wheelbase, rear overhang and width are from the bodybuilder’s specs (12.2 m including the front mirrors); front overhang, engine, the ZF automatic gearbox and the 2 front / 4 rear air bags are from Hotai’s chassis specs. Doors, windows, the roof air conditioner and the seats follow photos and onboard videos of real Taipei Bus buses. The number of rear rows, the steps, and the exact engine and fuel tank positions weren’t visible in any photo, so they are worked out from the 24-seat count and similar buses.'],
    )}</p>`;
  },
  LAYERS: [
    {name: ['車子外面', 'Outside'], ids: ['roof', 'aircon', 'roofBattery', 'controller', 'sideL', 'sideR', 'chargePort', 'doors', 'front', 'rear', 'sign', 'mirrors', 'mudflaps']},
    {name: ['車子裡面', 'Inside'], ids: ['seats', 'rails', 'straps', 'bell', 'reader', 'driver', 'floor', 'ramp']},
    {name: ['底盤', 'Chassis'], ids: ['wheels', 'frontAxle', 'rearAxle', 'springs', 'frame']},
    {name: ['引擎', 'Engine'], evName: ['馬達和電池', 'Motor and batteries'], ids: ['engine', 'gearbox', 'motor', 'rearBattery', 'shaft', 'radiator', 'tank', 'battery', 'exhaust']},
  ],
  STACK: [
    {name: ['整台', 'Whole'], say: ['整台公車，組回去囉。', 'The whole bus, all put back together.'], icon: '<rect x="2.5" y="5" width="19" height="11.5" rx="2.5"/><path d="M2.5 10h19M7.5 5v5M12 5v5M16.5 5v5"/><circle cx="7" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>'},
    {name: ['外面', 'Outside'], say: ['第一層，車子外面。', 'Layer one: the outside.'], icon: '<rect x="3" y="2.5" width="18" height="3.2" rx="1.6"/><path d="M3 9.5v7.5h18V9.5"/><path d="M8 9.5v4M16 9.5v4" opacity=".45"/><circle cx="7.5" cy="19.5" r="1.6"/><circle cx="16.5" cy="19.5" r="1.6"/>'},
    {name: ['裡面', 'Inside'], say: ['第二層，車子裡面。', 'Layer two: the inside.'], icon: '<path d="M7.5 3.5v10.5h9"/><path d="M7.5 14l-1.5 6.5M16.5 14v6.5"/><path d="M7.5 9.5h5"/><path d="M19 3.5v4" opacity=".5"/><circle cx="19" cy="9.3" r="1.4" opacity=".5"/>'},
    {name: ['底盤', 'Chassis'], say: ['第三層，底盤。', 'Layer three: the chassis.'], icon: '<path d="M2.5 11h19"/><path d="M5 11V8.5h14V11"/><circle cx="6.5" cy="16" r="3.2"/><circle cx="17.5" cy="16" r="3.2"/><circle cx="6.5" cy="16" r="1" /><circle cx="17.5" cy="16" r="1"/>'},
    {name: ['引擎', 'Engine'], evName: ['馬達', 'Motor'], say: ['第四層，引擎。', 'Layer four: the engine.'], evSay: ['第四層，馬達和電池。', 'Layer four: the motor and batteries.'], evIcon: '<path d="M13.5 2.5L6 12.5h5.5l-1 7 7.5-10h-5.5z"/><path d="M4 21h16" opacity=".5"/>', icon: '<rect x="5" y="3" width="14" height="6" rx="1.5"/><path d="M8 9v4M12 9v4M16 9v4"/><rect x="6.5" y="13" width="11" height="4" rx="1"/><path d="M12 17v4"/>'},
  ],
  LABEL_ORDER: ['engine', 'motor', 'roofBattery', 'rearBattery', 'chargePort', 'controller', 'wheels', 'seats', 'aircon', 'doors', 'front', 'sign', 'driver', 'rear', 'roof', 'frame', 'tank',
    'battery', 'radiator', 'gearbox', 'shaft', 'springs', 'mirrors', 'straps', 'floor', 'rails', 'bell', 'reader', 'ramp', 'exhaust', 'frontAxle', 'rearAxle', 'mudflaps', 'sideL', 'sideR'],
  XRAY_K: {roof: 1, aircon: 1, sideL: 1, sideR: 1, doors: 1, front: 1, rear: 1, mirrors: 1, floor: 0.6},
  sun: {pos: [6, 14, 8], ext: 11},
  ao: 0.3,
  // 燈光：每一組可以各自開關。color 是燈光面板上圖示亮起來的顏色
  LIGHTS: [
    {id: 'head', name: ['頭燈', 'Headlights'], say: ['晚上開車要打開頭燈，才看得到前面的路，別人也看得到公車。', 'At night the driver turns on the headlights to see the road, and so others can see the bus.'], color: '#ffe9a8', view: [1, 0.35, 0.25],
      icon: '<path d="M3.5 8h5a4 4 0 0 1 0 8h-5z"/><path d="M14 9l6.5-1.5M14 12h7M14 15l6.5 1.5"/>'},
    {id: 'turn', name: ['方向燈', 'Turn signals'], say: ['要轉彎的時候，方向燈會一閃一閃，告訴大家公車要轉彎了。', 'Before turning, the turn signals blink to tell everyone the bus is about to turn.'], color: '#ffb02e', mode: 'blink',
      icon: '<path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/>'},
    {id: 'tail', name: ['尾燈', 'Tail lights'], say: ['尾燈是紅色的，讓後面的車知道前面有一台公車。車牌上面還有一顆小燈照著車牌。', 'The red tail lights tell cars behind that a bus is ahead. A little lamp lights up the license plate too.'], color: '#ff4a3a', view: [-1, 0.35, 0.3],
      icon: '<rect x="7" y="4.5" width="10" height="15" rx="2.5"/><circle cx="12" cy="9.5" r="2"/><circle cx="12" cy="15" r="1.4"/>'},
    {id: 'sign', name: ['路線牌', 'Route signs'], say: ['路線牌的小燈排成字，晚上也看得清楚是幾號公車、要開去哪裡。', 'The tiny lights in the route signs spell out the number and the destination, easy to read at night.'], color: '#ff9a2e',
      icon: '<rect x="2.5" y="7" width="19" height="10" rx="2"/><path d="M6 12h.01M9 12h.01M12 12h.01M15 12h.01M18 12h.01" stroke-width="2.6"/>'},
    {id: 'cabin', name: ['車內燈', 'Cabin lights'], say: ['車子裡面的燈打開，晚上上車才看得清楚，也比較安全。', 'With the cabin lights on, people can see where they’re going when they get on at night.'], color: '#fff1d6', view: [0.5, 1, 0.9],
      icon: '<path d="M4 6h16"/><path d="M8 6v2.5h8V6"/><path d="M7 12l-2 6M17 12l2 6M12 11.5V18" opacity=".55"/>'},
  ],
  // 地上的光斑：頭燈照在前面、尾燈在後面映一點紅
  pools: [
    {group: 'head', x: 9.2, z: 0, w: 7, l: 3.8, peak: 0.7},
    {group: 'tail', x: -7.2, z: 0, w: 2.4, l: 2.8, color: '#ff3b2a', peak: 0.3},
  ],
  groundMarks: `m = max(m, step(abs(vW.z + 1.95), 0.06) * step(mod(x, 6.0), 3.0));
        m = max(m, step(abs(vW.z - 2.05), 0.06));`,
  groundFade: ['0.55, 1.0', '5.5, 13.0'],
  cam: {min: 4, max: 48, home: [0.78, 0.36, 0.86], explode: [0.62, 0.95, 0.8], r: [5.0, 4.6], rh: [6.0, 4.2], target: (ex) => [0, 1.3 + 0.7 * ex, -0.9 * ex]},
  actions: [
    {id: 'drive', icon: ICONS.drive, label: ['開車', 'Drive']},
    {id: 'door', icon: ICONS.door, label: ['開門', 'Doors']},
  ],
  panel: [
    {id: 'dSpeed', label: ['公里／小時', 'km/h']},
    {id: 'dTurn', label: ['輪子每秒轉幾圈', 'wheel turns a second']},
    {id: 'dDist', label: ['走了幾公尺', 'meters driven']},
  ],

  setup(ctx) {
    const {model: bus, S, $, app, sound, sayPair, setBtn, later} = ctx;
    // pending：使用者按了「開門」但車還在跑（或按「開車」但門還開著）時，等車停好／門關好才做的那一件事
    const V = {driving: false, speed: 0, dist: 0, crank: 0, doorOpen: false, doorP: 0, pending: null, idleT: 0};
    // ---- 柴油／電動切換＋「哪裡不一樣」 ----
    $('#extraTop').innerHTML = `<div class="vrow">
      <div class="variant" id="variant" role="group">
        <span class="seg-ind"></span>
        <button data-v="diesel" class="on">${ICONS.fuel}<span></span></button>
        <button data-v="ev">${ICONS.bolt}<span></span></button>
      </div>
      <button class="chip diff-btn" id="diffBtn">${ICONS.compare}<span></span></button>
    </div>`;
    const dc = document.createElement('section');
    dc.className = 'card diffcard sidecard';
    dc.id = 'diffCard';
    dc.hidden = true;
    dc.innerHTML = `<div class="card-head"><h2 id="dTitle"></h2><div class="card-btns"><button class="round sm" id="dClose">${ICONS.close}</button></div></div><div class="diff-grid" id="diffGrid"></div>`;
    app.appendChild(dc);
    const moveInd = () => {
      const g = $('#variant');
      const on = g.querySelector('button.on');
      const ind = g.querySelector('.seg-ind');
      ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
      ind.style.width = on.offsetWidth + 'px';
      ind.style.height = on.offsetHeight + 'px';
    };
    const present = (id) => hasPart(id, S.variant);
    function showDiff() {
      const cell = (id, text, v, i) =>
        id ? `<button class="dc${S.variant === v ? ' cur' : ''}" data-id="${id}" data-v="${v}">${H(ctx.P(id).name)}</button>` : `<button class="dc none" data-i="${i}">${HP(text)}</button>`;
      const grid = $('#diffGrid');
      grid.innerHTML =
        `<span class="dh">${ICONS.fuel}${HP(['柴油', 'Diesel'])}</span><span></span><span class="dh">${ICONS.bolt}${HP(['電動', 'Electric'])}</span>` +
        DIFFS.map((r, i) => `${cell(r.d, [r.dText, r.dTextEn], 'diesel', i)}<button class="arrow" data-i="${i}" aria-label="${L('聽聽看', 'Listen')}">${ICONS.sound}</button>${cell(r.e, [r.eText, r.eTextEn], 'ev', i)}`).join('');
      for (const b of grid.querySelectorAll('[data-id]'))
        b.onclick = () => {
          sound.pop(600);
          focusPart(b.dataset.id, b.dataset.v);
        };
      for (const b of grid.querySelectorAll('[data-i]'))
        b.onclick = () => {
          sound.pop(520);
          sayPair(DIFFS[+b.dataset.i].say, DIFFS[+b.dataset.i].sayEn);
        };
      $('#card').hidden = true;
      dc.hidden = false;
      requestAnimationFrame(ctx.resize);
      dc.classList.remove('pop');
      void dc.offsetWidth;
      dc.classList.add('pop');
    }
    const glowChanged = () => {
      S.glow = Object.keys(PARTS).filter((k) => PARTS[k].variant === S.variant);
      S.glowT = 6;
    };
    function setVariant(v, {quiet = false} = {}) {
      if (v === S.variant) return;
      S.variant = v;
      if (S.selected && !present(S.selected)) ctx.select(null);
      for (const p of bus.pieces) if (PARTS[p.id].variant) p.pwait = present(p.id) ? 0.5 + (p.order % 5) * 0.09 : (p.order % 5) * 0.05;
      for (const b of app.querySelectorAll('#variant button')) {
        b.classList.toggle('on', b.dataset.v === v);
        b.setAttribute('aria-pressed', b.dataset.v === v);
      }
      moveInd();
      ctx.renderTexts();
      if (V.driving) sound.engine(true, v);
      glowChanged();
      if (S.layer === 0 && !S.xray) {
        S.xray = true;
        setBtn('xray', true, ['不透視', 'Solid']);
      }
      if (S.layer === 0) ctx.goHome();
      // 「哪裡不一樣」面板只在本來就開著時更新內容，不要切換一次就強制打開（想看再按那顆按鈕）
      if (!dc.hidden) showDiff();
      if (!quiet) {
        sound.whoosh(true);
        if (v === 'ev') sayPair('換成電動公車了！引擎、油箱和排氣管不見了，換成電池和馬達。亮起來的就是不一樣的地方。', 'Now it’s an electric bus! The engine, fuel tank and exhaust are gone, and batteries and a motor took their place. The glowing parts are what changed.');
        else sayPair('換回柴油公車了！引擎、油箱和排氣管都回來了。', 'Back to the diesel bus! The engine, fuel tank and exhaust are back.');
      }
    }
    function focusPart(id, v) {
      const switching = v !== S.variant;
      if (switching) setVariant(v, {quiet: true});
      later(
        () => {
          if (S.layer !== ctx.layerOf[id]) ctx.setLayer(ctx.layerOf[id]);
          later(() => ctx.select(id), 750);
        },
        switching ? 900 : 0,
      );
    }
    for (const b of app.querySelectorAll('#variant button'))
      b.addEventListener('click', () => {
        sound.unlock();
        setVariant(b.dataset.v);
      });
    $('#diffBtn').onclick = () => {
      sound.unlock();
      if (dc.hidden) {
        // 一次只開一張卡片：先關掉零件卡片、燈光面板，取消選中的零件
        ctx.select(null);
        ctx.hideSidecards();
        showDiff();
        glowChanged();
        sayPair('柴油公車和電動公車，有這些地方不一樣。點名字去看看。', 'A diesel bus and an electric bus differ in these places. Tap a name to go and look.');
      } else ctx.hideSidecards();
    };
    $('#dClose').onclick = () => ctx.hideSidecards();

    const handlers = {
      drive: (auto) => {
        if (auto !== true) V.pending = null; // 使用者自己按：取消還在等的那件事
        if (!V.driving && V.doorOpen) {
          sayPair('先把門關好，才能開車喔。', 'Close the doors first, then we can drive.');
          handlers.door(true);
          V.pending = 'drive'; // 門關好（update 裡看）才出發
          return;
        }
        V.driving = !V.driving;
        setBtn('drive', V.driving, V.driving ? ['停車', 'Stop'] : ['開車', 'Drive']);
        $('#drive').hidden = false;
        sound.engine(V.driving, S.variant);
        if (!V.driving) sayPair('停車囉。', 'We stopped.');
        else if (S.variant === 'ev') sayPair('出發囉！電動公車好安靜，聽聽看。', 'Here we go! Listen, the electric bus is so quiet.');
        else sayPair('出發囉！看看輪子和傳動軸怎麼轉。', 'Here we go! Watch how the wheels and drive shaft turn.');
      },
      door: (auto) => {
        if (auto !== true) V.pending = null;
        if (V.driving || V.speed > 0) {
          sayPair('公車要先停好，才能開門喔。', 'The bus has to stop before the doors can open.');
          if (V.driving) handlers.drive(true);
          V.pending = 'door'; // 完全停下來（update 裡看）才開門
          return;
        }
        V.doorOpen = !V.doorOpen;
        setBtn('door', V.doorOpen, V.doorOpen ? ['關門', 'Close'] : ['開門', 'Doors']);
        sound.hiss();
        if (V.doorOpen) sayPair('公車先往右邊蹲低，再開門、放下斜坡板。', 'The bus kneels to the right, then opens the doors and puts out the ramp.');
        else sayPair('關門囉。', 'Doors closing.');
      },
    };

    const tmpC = new ctx.THREE.Color();
    const R = ENGINE.CRANK_R;
    return {
      handlers,
      onPick: (id) => id === 'bell' && sound.dingdong(),
      renderTexts() {
        const [d, e] = app.querySelectorAll('#variant button > span:not(.seg-ind)');
        d.innerHTML = HP(['柴油', 'Diesel']);
        e.innerHTML = HP(['電動', 'Electric']);
        $('#variant').setAttribute('aria-label', L('柴油或電動', 'Diesel or electric'));
        $('#diffBtn > span').innerHTML = HP(['哪裡不一樣', 'What’s different']);
        $('#dTitle').innerHTML = HP(['哪裡不一樣？', 'What’s different?']);
        $('#dClose').setAttribute('aria-label', L('關閉', 'Close'));
        if (!dc.hidden) showDiff();
        requestAnimationFrame(moveInd);
      },
      update(dt, ex) {
        // 開車
        const want = V.driving ? 30 : 0;
        V.speed += (want - V.speed) * (1 - Math.exp(-dt * (V.driving ? 0.7 : 1.1)));
        if (!V.driving && V.speed < 0.05) V.speed = 0;
        V.dist += (V.speed / 3.6) * dt;
        V.crank += 2 * Math.PI * ((600 + V.speed * 32) / 60) * SLOW * dt;
        // 開門：0→1 蹲低，1→2 開門，2→3 放斜坡板
        const dWant = V.doorOpen ? 3 : 0;
        const rate = 1.35 * dt;
        V.doorP = V.doorP < dWant ? Math.min(dWant, V.doorP + rate) : Math.max(dWant, V.doorP - rate);
        // 等著的那件事：車完全停下才開門、門完全關好才出發
        if (V.pending === 'door' && V.speed === 0) {
          V.pending = null;
          handlers.door(true);
        } else if (V.pending === 'drive' && !V.doorOpen && V.doorP < 0.02) {
          V.pending = null;
          handlers.drive(true);
        }
        const kneel = smooth(V.doorP);
        const doorK = smooth(V.doorP - 1);
        const rampK = smooth(V.doorP - 2);
        bus.sprung.position.y = (-kneelDrop / 2) * kneel * (1 - ex);
        bus.sprung.rotation.x = Math.asin(kneelDrop / 2 / 1.25) * kneel * (1 - ex);
        for (const b of bus.bags) {
          const squash = b.userData.side > 0 ? kneelDrop * kneel * (1 - ex) : 0;
          b.userData.bag.scale.y = 0.15 - squash;
          b.userData.top.position.y = -squash;
        }
        for (const leaf of bus.doorLeaves) {
          const out = smooth(doorK * 3) * 0.07;
          const slide = smooth((doorK - 0.25) / 0.75) * leaf.userData.w * 0.92;
          leaf.position.set(leaf.userData.dir * slide, 0, out);
        }
        bus.ramp.position.z = RAMP_Z0 + (RAMP_Z1 - RAMP_Z0) * smooth(rampK * 1.6);
        bus.ramp.rotation.x = Math.asin(Math.min(0.99, (LEVELS.FLOOR - kneelDrop) / 0.9)) * smooth((rampK - 0.55) / 0.45);
        // 輪子：走了多遠就轉多少（弧度 = 距離 ÷ 半徑）
        const ang = V.dist / R_TIRE;
        for (const s of bus.spinners) s.obj.rotation.z = s.flip ? ang : -ang;
        const steer = V.speed > 0.5 ? 0.13 * Math.sin(V.dist * 0.09) * Math.min(1, V.speed / 10) : 0;
        for (const st of bus.steerers) st.rotation.y = steer;
        bus.steering.rotation.z = steer * 18;
        bus.shaftSpin.rotation.x = ang * 4;
        bus.motorSpin.rotation.x = ang * 4;
        bus.fanBlades.rotation.z = V.crank * 1.5;
        ctx.groundMat.uniforms.uRoll.value = V.dist;
        ctx.groundMat.uniforms.uRoad.value += ((V.speed > 0.2 || V.driving ? 1 : 0) - ctx.groundMat.uniforms.uRoad.value) * (1 - Math.exp(-dt * 3));
        // 活塞：真的曲柄連桿（衝程 130 mm，連桿 210 mm）
        for (const pi of bus.pistons) {
          const th = V.crank - (FIRE[pi.i] * 2 * Math.PI) / 3;
          const pin = ENGINE.CRANK_Y + pistonPin(th);
          pi.p.position.y = pin + 0.035;
          const cy = ENGINE.CRANK_Y + R * Math.cos(th);
          const cz = R * Math.sin(th);
          pi.r.position.set(pi.x, cy, cz);
          pi.r.scale.y = Math.hypot(pin - cy, -cz);
          pi.r.rotation.x = Math.atan2(-cz, pin - cy);
          const cyc = (((th % (4 * Math.PI)) + 4 * Math.PI) % (4 * Math.PI)) / (4 * Math.PI);
          const f = bus.flames[pi.i];
          const top = pin + 0.085;
          f.position.y = top;
          f.scale.y = Math.max(0.001, ENGINE.CRANK_Y + 0.4 - top);
          f.material.opacity = cyc < 0.12 ? (1 - cyc / 0.12) * 0.85 : 0;
        }
        for (const c of bus.crankParts) c.rotation.x = V.crank;
        // 座椅的顏色在 instanceColor 裡，要另外淡掉
        const im = bus.parts.seats.meshes[0];
        const k = S.selected === 'seats' ? 0 : 0.62 * S.dimK;
        if (Math.abs(k - (im.userData.k ?? -1)) > 0.002) {
          im.userData.k = k;
          bus.seatColors.forEach((c, i) => im.setColorAt(i, tmpC.copy(c).lerp(ctx.bgCol, k)));
          im.instanceColor.needsUpdate = true;
        }
        // 開車的數字：全部從同一個速度算出來
        if (!$('#drive').hidden) {
          $('#dSpeed').textContent = Math.round(V.speed);
          $('#dTurn').textContent = (V.speed / 3.6 / tireCirc()).toFixed(1);
          $('#dDist').textContent = Math.floor(V.dist);
          // 停好 2.5 秒後收起數字（只算時間，不要每一格都排一個計時器）
          V.idleT = !V.driving && V.speed === 0 ? V.idleT + dt : 0;
          if (V.idleT > 2.5) $('#drive').hidden = true;
        }
        sound.setSpeed(V.speed);
      },
    };
  },
};
void Lp;
