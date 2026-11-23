// 剝剝看（Peelback）：入口是展廳（#），走進一台車是 #bus、#plane、#car。
// 要加新的一台：在 CATALOG 加一筆、在 VEHICLES 放它的定義；新的分類加在 CATS。
import {startApp} from './app.js';
import {startHome} from './home.js';
import {applyLang} from './i18n.js';
import {applyThemeAttr} from './ui.js';
import bus, {BUS_ICON} from '../bus/vehicle.js';
import plane, {PLANE_ICON} from '../plane/vehicle.js';
import car, {CAR_ICON} from '../car/vehicle.js';
import IMG_BUS from './img/bus.webp';
import IMG_PLANE from './img/plane.webp';
import IMG_CAR from './img/car.webp';

const VEHICLES = {bus, plane, car};
const SVG = (inner) => `<svg viewBox="0 0 24 24">${inner}</svg>`;
const CATS = [
  {id: 'all'},
  {id: 'bus', name: ['公車', 'Buses'], icon: BUS_ICON},
  {id: 'plane', name: ['飛機', 'Planes'], icon: PLANE_ICON},
  {id: 'car', name: ['汽車', 'Cars'], icon: CAR_ICON},
  {id: 'train', soon: true, name: ['火車', 'Trains'], icon: SVG('<rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 10.5h14M8.5 21l2-4M15.5 21l-2-4"/><circle cx="8.6" cy="13.8" r=".9" fill="currentColor"/><circle cx="15.4" cy="13.8" r=".9" fill="currentColor"/>')},
  {id: 'ship', soon: true, name: ['船', 'Ships'], icon: SVG('<path d="M3 15.5l2.2 4.5h13.6l2.2-4.5L12 13z"/><path d="M6.5 14.4V9h11v5.4M12 9V4.5"/>')},
];
const nParts = (V) => Object.keys(V.PARTS).length;
const CATALOG = [
  {id: 'bus', cat: 'bus', no: '01', brand: ['台北客運', 'Taipei Bus'], name: ['低地板公車', 'Low-floor bus'], img: IMG_BUS},
  {id: 'plane', cat: 'plane', no: '02', brand: ['星宇航空', 'STARLUX'], name: ['A350-1000', 'A350-1000'], img: IMG_PLANE},
  {id: 'car', cat: 'car', no: '03', brand: ['特斯拉', 'Tesla'], name: ['Model Y', 'Model Y'], img: IMG_CAR},
].map((x) => ({...x, layers: VEHICLES[x.id].LAYERS.length, parts: nParts(VEHICLES[x.id])}));
// 還沒有任何一台的分類先不顯示（火車、船做好再打開）
const SHOWN_CATS = CATS.filter((c) => c.id === 'all' || CATALOG.some((x) => x.cat === c.id));

applyLang();
applyThemeAttr();
let current = null;
let currentId = null;
let lastId = null;
function route() {
  const id = location.hash.slice(1);
  const want = VEHICLES[id] ? id : 'home';
  if (want === currentId) return;
  current?.dispose();
  currentId = want;
  if (want === 'home') {
    current = startHome({cats: SHOWN_CATS, items: CATALOG, lastId, onOpen: (v) => (location.hash = v)});
  } else {
    lastId = want;
    const item = CATALOG.find((x) => x.id === want);
    current = startApp(VEHICLES[want], {no: item?.no, onHome: () => (location.hash = '')});
  }
}
addEventListener('hashchange', route);
route();
