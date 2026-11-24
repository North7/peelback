// No.02 飛機：星宇航空 A350-1000「空山金」。
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {buildPlane, SCALE, preload} from './model.js';
import {PARTS, SPEC, partText} from './data.js';
import {smooth, approach, HP} from '../kit/app.js';

export const PLANE_ICON = '<svg viewBox="0 0 24 24"><path d="M12 2.5c.8 0 1.2.8 1.2 2v5l7.3 4.2v2l-7.3-2.2v4.6l2.3 1.7v1.6L12 20.3l-3.5 1.1v-1.6l2.3-1.7v-4.6l-7.3 2.2v-2l7.3-4.2v-5c0-1.2.4-2 1.2-2z"/></svg>';
const ICONS = {
  takeoff: '<svg viewBox="0 0 24 24"><path d="M2.5 20h19"/><path d="M3.5 14.2l3.3 1.3 4.4-1.7-3.4-5.4 1.9-.7 5.9 4.4 4.3-1.6c1-.4 2 .3 1.6 1.2-.2.5-.7.9-1.2 1.1L7.6 17.8 3 16.2z"/></svg>',
  wing: '<svg viewBox="0 0 24 24"><path d="M2.5 15l19-6.5v3.2l-7.3 4.8H2.5z"/><path d="M14.2 16.5l2 3.5M10 16.5l1.2 3.5"/></svg>',
};
const DEG = Math.PI / 180;
// 動翅膀：三段，每段 4.5 秒
const WING_DEMO = [
  {say: ['副翼一邊往上、一邊往下，方向舵往左，飛機就往左轉。', 'One aileron goes up and the other goes down, and the rudder moves left, so the plane turns left.'], glow: ['ailerons', 'rudder']},
  {say: ['升降舵往上翹，飛機的頭抬起來，往上飛。', 'The elevators tilt up, the nose lifts, and the plane climbs.'], glow: ['elevator']},
  {say: ['擾流板翹起來、襟翼伸出來，飛機就慢下來。', 'The spoilers pop up and the flaps come out, so the plane slows down.'], glow: ['spoilers', 'flaps']},
];

export default {
  id: 'plane',
  name: ['飛機', 'Plane'],
  PARTS,
  partText,
  build: buildPlane,
  preload, // 點進來時先下載這台的 3D 資料
  subtitle: () => ['星宇航空・A350-1000 空山金', 'STARLUX · A350-1000 Airsorayama Gold'],
  facts() {
    const row = (dt, dd, small) => `<div><dt>${HP(dt)}</dt><dd>${dd}${small ? `<small>${HP(small)}</small>` : ''}</dd></div>`;
    const busN = (n) => Math.round(n / SPEC.bus);
    return `<dl>
      ${row(['長', 'Length'], `<b>${SPEC.length}</b> ${HP(['公尺', 'm'])}`, [`差不多 ${busN(SPEC.length)} 台公車排成一排`, `About ${busN(SPEC.length)} buses in a row`])}
      ${row(['翅膀', 'Wingspan'], `<b>${SPEC.span}</b> ${HP(['公尺', 'm'])}`)}
      ${row(['高', 'Height'], `<b>${SPEC.height}</b> ${HP(['公尺', 'm'])}`, [`差不多 ${Math.round(SPEC.height / SPEC.floorH)} 層樓`, `About ${Math.round(SPEC.height / SPEC.floorH)} floors`])}
      ${row(['座位', 'Seats'], `<b>350</b>`, ['頭等艙 4、商務艙 40、豪華經濟艙 36、經濟艙 270', 'First 4, business 40, premium economy 36, economy 270'])}
      ${row(['引擎', 'Engines'], `<b>2</b>`, ['風扇直徑 3 公尺，有 22 片葉片', 'Fans 3 m across, with 22 blades'])}
      ${row(['重量', 'Weight'], `${HP(['最重', 'Up to'])} <b>${SPEC.mtow}</b> ${HP(['公噸', 'tonnes'])}`, [`差不多 ${Math.round(SPEC.mtow / SPEC.busT)} 台公車那麼重`, `As heavy as about ${Math.round(SPEC.mtow / SPEC.busT)} buses`])}
      ${row(['飛多遠', 'Range'], `<b>16,100</b> ${HP(['公里', 'km'])}`)}
      ${row(['輪子', 'Wheels'], `<b>${SPEC.wheels}</b>`)}
    </dl>
    <p class="src">${HP(['尺寸、重量、引擎、油量取自空中巴士公開的規格；座位照星宇航空公布的配置；空山金塗裝照模型照片做。客艙、貨艙、起落架艙的位置是簡化過的，不是原廠圖。', 'Size, weight, engines and fuel are from Airbus’s published specs; seats follow STARLUX’s published layout; the Airsorayama Gold paint follows a photo of a model. The cabin, cargo holds and gear bays are simplified, not factory drawings.'])}</p>`;
  },
  LAYERS: [
    {name: ['飛機外面', 'Outside the plane'], ids: ['nose', 'fuselage', 'doors', 'tailcone', 'fin', 'rudder', 'stab', 'elevator', 'antennas', 'pitot']},
    {name: ['客艙裡面', 'Inside the cabin'], ids: ['cockpit', 'first', 'business', 'premium', 'economy', 'galley', 'lav', 'bins', 'cabinFloor']},
    {name: ['翅膀', 'Wings'], ids: ['wings', 'winglets', 'slats', 'flaps', 'fairings', 'ailerons', 'spoilers', 'fuelTank']},
    {name: ['飛機肚子', 'The belly'], ids: ['cargo', 'noseGear', 'mainGear']},
    {name: ['引擎', 'Engines'], ids: ['engine', 'fan', 'core', 'pylon', 'apu']},
  ],
  STACK: [
    {name: ['整台', 'Whole'], say: ['整台飛機，組回去囉。', 'The whole plane, all put back together.'], icon: PLANE_ICON.replace(/<\/?svg[^>]*>/g, '')},
    {name: ['外面', 'Outside'], say: ['第一層，飛機外面。', 'Layer one: outside the plane.'], icon: '<rect x="3" y="11.5" width="18" height="6" rx="3"/><path d="M5 7h14"/><path d="M12 3.5v2" opacity=".5"/>'},
    {name: ['裡面', 'Cabin'], say: ['第二層，客艙裡面。', 'Layer two: inside the cabin.'], icon: '<path d="M7.5 3.5v10.5h9"/><path d="M7.5 14l-1.5 6.5M16.5 14v6.5"/><path d="M7.5 9.5h5"/>'},
    {name: ['翅膀', 'Wings'], say: ['第三層，翅膀。', 'Layer three: the wings.'], icon: '<path d="M2.5 14l19-6v3.2l-8 5H2.5z"/><path d="M13.5 16.2v3.3"/>'},
    {name: ['肚子', 'Belly'], say: ['第四層，飛機肚子，裡面有行李和輪子。', 'Layer four: the belly, with luggage and wheels.'], icon: '<rect x="5" y="7.5" width="14" height="10" rx="2"/><path d="M9 7.5V5h6v2.5"/><circle cx="8" cy="20" r="1.3"/><circle cx="16" cy="20" r="1.3"/>'},
    {name: ['引擎', 'Engines'], say: ['第五層，引擎。', 'Layer five: the engines.'], icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 10c-1-2-1-4 0-6.5M14 12c2-1 4-1 6.5 0M12 14c1 2 1 4 0 6.5M10 12c-2 1-4 1-6.5 0"/>'},
  ],
  LABEL_ORDER: ['engine', 'fan', 'wings', 'cockpit', 'first', 'business', 'economy', 'premium', 'fin', 'nose', 'mainGear', 'noseGear', 'cargo', 'fuelTank', 'flaps', 'ailerons',
    'rudder', 'elevator', 'slats', 'spoilers', 'winglets', 'fairings', 'stab', 'tailcone', 'doors', 'fuselage', 'antennas', 'pitot', 'galley', 'lav', 'bins', 'core', 'pylon', 'apu', 'cabinFloor'],
  XRAY_K: {nose: 1, fuselage: 1, doors: 1, tailcone: 1, wings: 1, winglets: 1, engine: 1, cabinFloor: 0.6, bins: 0.6},
  sun: {pos: [6, 16, -8], ext: 16},
  ao: 0.16,
  LIGHTS: [
    {id: 'nav', name: ['航行燈', 'Navigation lights'], say: ['左邊紅、右邊綠、尾巴白。晚上別的飛機一看，就知道這架飛機往哪裡飛。', 'Red on the left, green on the right, white at the tail. At night other pilots can tell which way this plane is flying.'], color: '#ff5a4a', view: [0.25, 1, -0.5],
      icon: '<circle cx="5.5" cy="12" r="2.6"/><circle cx="18.5" cy="12" r="2.6"/><path d="M8.5 12h7"/>'},
    {id: 'beacon', name: ['防撞燈', 'Beacon lights'], say: ['機身上下的紅燈一閃一閃，告訴地上的人：引擎要發動了，不要靠近！', 'The red lights on top and bottom flash to warn people on the ground: the engines are starting, stay away!'], color: '#ff3a2a', mode: 'beacon', view: [0.6, 0.5, -0.8],
      icon: '<path d="M7.5 16a4.5 4.5 0 0 1 9 0z"/><path d="M5 16h14M12 4.5v3M5.5 7.5l2 2M18.5 7.5l-2 2"/>'},
    {id: 'strobe', name: ['閃光燈', 'Strobe lights'], say: ['翅膀尖端和尾巴的白燈很亮，連閃兩下，讓很遠的飛機也看得到。', 'The bright white lights on the wing tips and tail flash twice in a row, so even faraway planes can see it.'], color: '#ffffff', mode: 'strobe', phase: 0.3,
      icon: '<path d="M13 2.5L6 13h5l-1 8.5 7-11h-5z"/>'},
    {id: 'landing', name: ['降落燈', 'Landing lights'], say: ['降落的時候打開，像大手電筒一樣照亮前面的跑道。', 'Turned on for landing, they light up the runway ahead like giant flashlights.'], color: '#fff3d6', view: [1, 0.25, -0.35],
      icon: '<circle cx="7.5" cy="12" r="4"/><path d="M13 9l8-3M13 12h8.5M13 15l8 3"/>'},
    {id: 'taxi', name: ['滑行燈', 'Taxi light'], say: ['鼻輪上也有一顆燈，在地上滑行的時候照亮前面的路。', 'There’s a lamp on the nose gear too. It lights the way when the plane drives on the ground.'], color: '#fff3d6', view: [1, 0.15, -0.6],
      icon: '<circle cx="12" cy="16.5" r="3.5"/><path d="M12 13V6M9 8.5l3-3 3 3"/>'},
    {id: 'logo', name: ['標誌燈', 'Logo lights'], say: ['水平尾翼上的燈往上照著垂直尾翼，晚上也看得到星宇的標誌。', 'Lamps on the horizontal tail shine up on the tail fin, so the STARLUX logo shows at night.'], color: '#ffe2a6', view: [-0.35, 0.35, -1],
      icon: '<path d="M8 20l4-15h6l-3 15z"/><path d="M3.5 20l4.5-3.5" opacity=".6"/>'},
    {id: 'cabin', name: ['客艙燈', 'Cabin lights'], say: ['客艙的燈打開，從外面看，一整排窗戶都亮起來了。', 'With the cabin lights on, the whole row of windows glows from outside.'], color: '#ffd08a', view: [0.35, 0.25, -1],
      icon: '<path d="M4 6h16"/><path d="M8 6v2.5h8V6"/><path d="M7 12l-2 6M17 12l2 6M12 11.5V18" opacity=".55"/>'},
  ],
  // 地上的光斑（場景大小）：降落燈照得遠、滑行燈照在鼻輪前面
  pools: [
    {group: 'landing', x: 11.5, z: 0, w: 11, l: 5.5, peak: 0.55},
    {group: 'taxi', x: 8.2, z: 0, w: 4.5, l: 2.6, peak: 0.6},
  ],
  // 跑道：中線虛線、兩邊邊線（45 公尺寬），起飛、降落時才出現
  groundMarks: `m = max(m, step(abs(vW.z), 0.07) * step(mod(x, 8.0), 4.5));
        m = max(m, step(abs(abs(vW.z) - 3.75), 0.07));`,
  groundFade: ['0.5, 0.62', '7.0, 15.0'],
  cam: {min: 2.5, max: 70, home: [0.72, 0.4, -0.8], explode: [0.55, 1.0, -0.75], r: [5.4, 5.0], rh: [6.4, 4.6], target: (ex) => [0, 1.15 + 1.0 * ex, 0]},
  actions: [
    {id: 'fly', icon: ICONS.takeoff, label: ['起飛', 'Take off']},
    {id: 'wings', icon: ICONS.wing, label: ['動翅膀', 'Move wings']},
  ],
  panel: [
    {id: 'dSpeed', label: ['公里／小時', 'km/h']},
    {id: 'dAlt', label: ['離地幾公尺', 'meters up']},
    {id: 'd101', label: ['個台北101那麼高', 'Taipei 101s tall']},
  ],
  panelNote: ['快轉播放', 'Sped up'],

  setup(ctx) {
    const {model: bus, S, $, scene, THREE, sound, say, sayPair, setBtn, later} = ctx;
    const F = {flying: false, alt: 0, speed: 0, dist: 0, pitch: 0, roll: 0, spool: 0, gearK: 0, flapK: 0, spoilK: 0, ail: 0, elev: 0, rud: 0, wingT: -1, wingPhase: -1};
    // 雲：飛高以後才出現，一團團往後飄
    const clouds = new THREE.Group();
    const cloudM = new THREE.MeshStandardMaterial({color: '#ffffff', roughness: 1, transparent: true, opacity: 0, depthWrite: false});
    {
      let seed = 11;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 16; i++) {
        const g = [];
        const n = 4 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          const sp = new THREE.SphereGeometry(0.8 + rnd() * 1.4, 16, 12);
          sp.scale(1, 0.55, 1);
          sp.translate((rnd() - 0.5) * 4.5, (rnd() - 0.3) * 0.8, (rnd() - 0.5) * 2.6);
          g.push(sp);
        }
        const c = new THREE.Mesh(mergeGeometries(g), cloudM);
        const high = rnd() < 0.3;
        c.position.set(-35 + rnd() * 70, high ? 1 + rnd() * 4 : -6 + rnd() * 3.5, (rnd() - 0.5) * (high ? 60 : 44));
        if (high && Math.abs(c.position.z) < 12) c.position.z = Math.sign(c.position.z || 1) * (12 + rnd() * 12);
        clouds.add(c);
      }
      clouds.visible = false;
      scene.add(clouds);
    }
    const handlers = {
      fly: () => {
          if (S.layer) ctx.setLayer(0);
        F.flying = !F.flying;
        setBtn('fly', F.flying, F.flying ? ['降落', 'Land'] : ['起飛', 'Take off']);
        $('#drive').hidden = false;
        sound.engine(true, 'jet');
        // 起飛前先開防撞燈和航行燈（真的飛機就是這樣）
        if (F.flying) {
          ctx.setLight('beacon', true, {quiet: true, focus: false, night: false});
          ctx.setLight('nav', true, {quiet: true, focus: false, night: false});
        }
        if (F.flying) sayPair('準備起飛！引擎轉起來，飛機在跑道上越跑越快，再把頭抬起來。', 'Ready for takeoff! The engines spin up, the plane races down the runway, then lifts its nose.');
        else sayPair('準備降落，放下起落架，伸出襟翼。', 'Getting ready to land: gear down, flaps out.');
      },
      wings: () => {
        // 示範播到一半再按一次：停下來（和高鐵「電怎麼走」一樣）
        if (F.wingT >= 0) {
          F.wingT = -1;
          S.glow = null;
          S.glowT = 0;
          setBtn('wings', false);
          return;
        }
        if (S.layer) ctx.setLayer(0);
        F.wingT = 0;
        F.wingPhase = -1;
        setBtn('wings', true);
      },
    };
    const _q = new THREE.Quaternion();
    const CHORD = new THREE.Vector3(-1, 0, 0);
    return {
      handlers,
      update(dt, ex) {
        // ---- 飛行（時間快轉）：滑跑加速 → 抬頭 → 離地爬升 → 巡航；降落反過來 ----
        const onGround = F.alt <= 0;
        let pitchT = 0;
        if (F.flying) {
          F.spool = approach(F.spool, 1, 0.9, dt);
          if (onGround) {
            if (F.speed < 280) F.speed += 40 * dt * F.spool;
            else pitchT = 8;
            if (F.speed >= 280 && F.pitch > 6) F.alt = 0.01;
          } else {
            const climb = F.alt < 1500 ? 40 + F.alt * 0.3 : 520;
            F.alt = Math.min(SPEC.cruiseAlt, F.alt + climb * dt);
            F.speed = approach(F.speed, 300 + 600 * smooth(F.alt / SPEC.cruiseAlt), 0.8, dt);
            pitchT = F.alt < SPEC.cruiseAlt - 500 ? 9 : 2.5;
          }
        } else if (!onGround) {
          const sink = F.alt > 2500 ? 650 : 30 + F.alt * 0.2;
          F.alt = Math.max(0, F.alt - sink * dt);
          F.speed = approach(F.speed, 260 + 640 * smooth(F.alt / SPEC.cruiseAlt), 0.8, dt);
          pitchT = F.alt < 150 ? 4.5 : 2;
          F.spool = approach(F.spool, 0.45, 0.8, dt);
        } else {
          F.speed = Math.max(0, F.speed - 50 * dt);
          F.spool = approach(F.spool, F.speed > 0 ? 0.35 : 0, F.speed > 0 ? 0.8 : 0.5, dt);
        }
        F.dist += (F.speed / 3.6) * dt;
        // 起落架：起飛離地就收，降落低於 900 公尺放下；襟翼：起飛和降落時伸出來；擾流板：落地後翹起來減速
        const gearT = (F.flying && F.alt > 20) || (!F.flying && F.alt > 900) ? 1 : 0;
        F.gearK = Math.min(1, Math.max(0, F.gearK + (gearT ? dt : -dt) / 3));
        let flapT = 0;
        if (F.flying && (onGround ? F.speed > 0 || F.spool > 0.3 : F.alt < 700)) flapT = 0.4;
        if (!F.flying && !onGround && F.alt < 2500) flapT = 1;
        if (!F.flying && onGround && F.speed > 0) flapT = 1;
        let spoilT = !F.flying && onGround && F.speed > 5 && F.dist > 0 ? 1 : 0;
        // 動翅膀的示範疊在上面
        let ailT = 0;
        let elevT = 0;
        let rudT = 0;
        let rollT = 0;
        if (F.wingT >= 0) {
          F.wingT += dt;
          const ph = Math.floor(F.wingT / 4.5);
          if (ph !== F.wingPhase && ph < WING_DEMO.length) {
            F.wingPhase = ph;
            sayPair(...WING_DEMO[ph].say);
            S.glow = WING_DEMO[ph].glow;
            S.glowT = 4.4;
            sound.pop(560 + ph * 80);
          }
          const k = smooth((F.wingT % 4.5) / 0.8) * (1 - smooth(((F.wingT % 4.5) - 3.6) / 0.8));
          if (ph === 0) {
            ailT = k;
            rudT = -k;
            rollT = onGround ? 0 : -22 * k;
          } else if (ph === 1) {
            elevT = -k;
            if (!onGround) pitchT += 7 * k;
          } else if (ph === 2) {
            spoilT = Math.max(spoilT, k);
            flapT = Math.max(flapT, k);
          } else {
            F.wingT = -1;
            S.glow = null;
            setBtn('wings', false);
          }
        }
        F.pitch = approach(F.pitch, pitchT, 1.6, dt);
        F.roll = approach(F.roll, rollT, 1.4, dt);
        F.flapK = approach(F.flapK, flapT, 1.4, dt);
        F.spoilK = approach(F.spoilK, spoilT, 3, dt);
        F.ail = approach(F.ail, ailT, 4, dt);
        F.elev = approach(F.elev, elevT, 4, dt);
        F.rud = approach(F.rud, rudT, 4, dt);

        // 舵面：每一片繞著自己的轉軸轉；襟翼同時往後滑
        for (const f of bus.surf.flaps) {
          f.grp.quaternion.copy(_q.setFromAxisAngle(f.axis, F.flapK * 32 * DEG));
          f.grp.position.copy(f.base).addScaledVector(CHORD, F.flapK * 1.6);
        }
        for (const a of bus.surf.ailerons) a.grp.quaternion.copy(_q.setFromAxisAngle(a.axis, F.ail * a.side * 20 * DEG));
        for (const sp of bus.surf.spoilers) sp.grp.quaternion.copy(_q.setFromAxisAngle(sp.axis, -F.spoilK * 45 * DEG));
        for (const e of bus.surf.elevators) e.grp.quaternion.copy(_q.setFromAxisAngle(e.axis, F.elev * 22 * DEG));
        bus.surf.rudder.grp.quaternion.copy(_q.setFromAxisAngle(bus.surf.rudder.axis, F.rud * 25 * DEG));
        // 縫翼跟著襟翼一起伸出：往前滑、前緣往下
        for (const sl of bus.surf.slats) {
          sl.grp.quaternion.copy(_q.setFromAxisAngle(sl.axis, -F.flapK * 16 * DEG));
          sl.grp.position.copy(sl.base).addScaledVector(CHORD, -F.flapK * 0.45);
        }
        // 起落架：主輪往中間收、鼻輪往前收；拆開的時候先放下來
        const g = smooth(F.gearK) * (1 - ex);
        for (const m of bus.gear.mains) m.grp.rotation.x = m.side * g * 86 * DEG;
        bus.gear.nose.grp.rotation.z = g * 84 * DEG;
        // 鼻輪艙門：輪子收進去以後才關
        const dk = smooth((g - 0.55) / 0.45);
        for (const d of bus.gear.nose.doors) d.grp.rotation.x = d.side * dk * 90 * DEG;
        if (F.alt <= 0) for (const w of bus.wheelSpin) w.rotation.z = -F.dist / w.userData.R;
        for (const f of bus.fans) f.rotation.x += dt * (0.4 + F.spool * 14);
        // 姿態：抬頭繞著主輪，側傾繞著機身中心；拆開的時候擺平
        bus.att.rotation.z = F.pitch * DEG * (1 - ex);
        bus.rollG.rotation.x = F.roll * DEG * (1 - ex);
        // 地面往下掉、慢慢淡掉；跑道線起飛降落時出現；雲在高空才出現
        const altVis = Math.min(60, F.alt * SCALE * 0.5);
        ctx.ground.position.y = -altVis;
        ctx.shade.position.y = -altVis + 0.001;
        const fade = smooth(F.alt / 300);
        ctx.groundMat.uniforms.uFade.value = fade;
        ctx.shadeMat.opacity = 0.22 * (1 - fade);
        ctx.groundMat.uniforms.uRoll.value = F.dist * SCALE;
        ctx.groundMat.uniforms.uRoad.value = approach(ctx.groundMat.uniforms.uRoad.value, F.flying || F.speed > 0 || F.alt > 0 ? 1 : 0, 3, dt);
        cloudM.opacity = 0.8 * smooth((F.alt - 300) / 2200);
        clouds.visible = cloudM.opacity > 0.01;
        const cs = (F.speed / 3.6) * SCALE * 0.14;
        for (const c of clouds.children) {
          c.position.x -= cs * dt;
          if (c.position.x < -38) c.position.x += 76;
        }
        if (!$('#drive').hidden) {
          $('#dSpeed').textContent = Math.round(F.speed);
          $('#dAlt').textContent = Math.round(F.alt).toLocaleString('en-US');
          $('#d101').textContent = (F.alt / SPEC.tower101).toFixed(1);
          F.idleT = !F.flying && F.speed === 0 && F.alt === 0 ? (F.idleT || 0) + dt : 0;
          if (F.idleT > 2.5) $('#drive').hidden = true;
        }
        sound.setSpeed(F.spool * 100);
      },
    };
    void say;
  },
};
