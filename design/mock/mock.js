// 剝剝看 Peelback：入口頁和觀看頁的三個設計方向（效果圖用，不是正式程式）
// 網址參數：?d=A|B|C&p=home|view&m=1（手機）
import {H} from '../../kit/i18n.js';

const q = new URLSearchParams(location.search);
const D = q.get('d') || 'A';
const P = q.get('p') || 'home';
const M = q.get('m') === '1';
document.documentElement.dataset.dir = D;
document.documentElement.dataset.mob = M ? '1' : '0';
const theme = {A: 'dark', B: 'light', C: 'dark'}[D];
document.documentElement.dataset.theme = theme;
const img = (v) => `../assets/cut_${v}_${theme}.png`;

// ---------- 圖示（一種線寬，1.7） ----------
const I = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
  sound: '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z"/><path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 6.5a7.8 7.8 0 0 1 0 11"/>',
  theme: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
  reset: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.8h3.8"/>',
  explode: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>',
  xray: '<path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  drive: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M3.8 10.5h6.2M14 10.5h6.2M12 14v6.4"/>',
  door: '<path d="M6 20V5.5A1.5 1.5 0 0 1 7.5 4H15l3 3v13"/><path d="M4 20h16M13 12.5h1.5"/>',
  light: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1.9 1.9V16h5.4v-.3c0-.8.3-1.4.9-1.9A6 6 0 0 0 12 3z"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  lock: '<rect x="5.5" y="10.5" width="13" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  arrowL: '<path d="M14.5 6l-6 6 6 6"/>',
  arrowR: '<path d="M9.5 6l6 6-6 6"/>',
  layers: '<path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5" opacity=".5"/>',
  all: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  bus: '<rect x="4" y="3.5" width="16" height="14" rx="2.5"/><path d="M4 11h16M7.5 20.5v-3M16.5 20.5v-3"/><circle cx="8" cy="14.5" r=".9" fill="currentColor"/><circle cx="16" cy="14.5" r=".9" fill="currentColor"/>',
  plane: '<path d="M12 2.8c1 0 1.6 1 1.6 2.3v4.6l7.4 4.3v2l-7.4-2.3v4.4l2.4 1.8v1.6L12 20.6l-4 .9v-1.6l2.4-1.8v-4.4L3 16v-2l7.4-4.3V5.1c0-1.3.6-2.3 1.6-2.3z"/>',
  car: '<path d="M3 15.5v-2.2c0-1 .6-1.8 1.6-2.1l2.4-.7 2.6-3a3 3 0 0 1 2.3-1h3.4a3 3 0 0 1 2.4 1.2l2.1 2.8 1 .4c.7.3 1.2 1 1.2 1.8v2.8H3z"/><circle cx="7.3" cy="16.3" r="1.9"/><circle cx="16.7" cy="16.3" r="1.9"/>',
  train: '<rect x="5" y="3" width="14" height="14" rx="3.5"/><path d="M5 10.5h14M8.5 21l2-4M15.5 21l-2-4"/><circle cx="8.6" cy="13.8" r=".9" fill="currentColor"/><circle cx="15.4" cy="13.8" r=".9" fill="currentColor"/>',
  ship: '<path d="M3 15.5l2.2 4.5h13.6l2.2-4.5L12 13z"/><path d="M6.5 14.4V9h11v5.4M12 9V4.5"/>',
  dino: '<path d="M4 19c0-5 2.5-8 6.5-8h3c1.8 0 2.5-1.3 2.5-3s1.2-3.5 3.5-3.5c1.2 0 2 .8 2 2 0 .9-.6 1.6-1.6 1.6H18.5"/><path d="M8 19v-3M14 19v-4"/><path d="M4 19c-1.3 0-2-.8-2-2"/>',
};
const svg = (k, cls = '') => `<svg viewBox="0 0 24 24" class="${cls}">${I[k]}</svg>`;

// ---------- 標誌 ----------
const LOGO = {
  // A 藍圖：一張方卡片，右上角被掀開一角，露出下面那一層
  A: `<svg viewBox="0 0 40 40" class="mark"><rect x="9" y="9" width="27" height="27" rx="7" fill="var(--acc)"/>
      <path d="M4 10a6 6 0 0 1 6-6h12.5L31 12.5V25a6 6 0 0 1-6 6H10a6 6 0 0 1-6-6z" fill="var(--ink)"/>
      <path d="M22.5 4v5.5a3 3 0 0 0 3 3H31" fill="none" stroke="var(--bg)" stroke-width="2.2" stroke-linejoin="round"/></svg>`,
  // B 剝橘：一顆圓，右上一瓣被剝開翻出去
  B: `<svg viewBox="0 0 40 40" class="mark"><path d="M20 5a15 15 0 1 0 15 15H20z" fill="var(--acc)"/>
      <path d="M23 2.5a14.5 14.5 0 0 1 14.5 14.5H23z" fill="var(--ink)" transform="rotate(10 23 17)"/></svg>`,
  // C 展廳：三片斜放的板子往上拆開（爆炸圖）；最上面那片右邊一角被掀起來、往回捲，露出背面
  C: `<svg viewBox="0 0 48 48" class="mark">
      <path d="M6 37.5L24 29 42 37.5 24 46z" fill="var(--ink)" opacity=".26"/>
      <path d="M6 26.5L24 18 42 26.5 24 35z" fill="var(--ink)" opacity=".52"/>
      <path d="M6.00 13.50L24.00 5.00 31.56 8.57 32.10 18.18 24.00 22.00z" fill="var(--acc)"/>
      <path d="M31.56 8.57L32.10 18.18Q28.92 15.01 22.94 11.04Q27.85 8.40 31.56 8.57z" fill="#000" opacity=".28" transform="translate(-1 1.4)"/>
      <path d="M31.56 8.57L32.10 18.18Q28.92 15.01 22.94 11.04Q27.85 8.40 31.56 8.57z" fill="var(--ink)"/></svg>`,
};
const NAME = {A: '藍圖', B: '剝橘', C: '展廳'};
const logo = () => `<div class="logo">${LOGO[D]}<div class="word"><b>Peelback</b><span>${H('剝剝看')}</span></div></div>`;

// ---------- 資料（之後會越來越多：同一類可以有好幾台） ----------
const CATS = [
  {id: 'all', zh: '全部', n: 3},
  {id: 'bus', zh: '公車', n: 1},
  {id: 'plane', zh: '飛機', n: 1},
  {id: 'car', zh: '汽車', n: 1},
  {id: 'train', zh: '火車', soon: true},
  {id: 'ship', zh: '船', soon: true},
  {id: 'dino', zh: '恐龍', soon: true},
];
const ITEMS = [
  {no: '01', cat: 'bus', brand: '台北客運', zh: '低地板公車', en: 'Hino low-floor', img: 'bus', layers: 4, parts: 29},
  {no: '02', cat: 'plane', brand: '星宇航空', zh: 'A350-1000', en: 'STARLUX', img: 'plane', layers: 5, parts: 31},
  {no: '03', cat: 'car', brand: '特斯拉', zh: 'Model Y', en: 'Tesla', img: 'car', layers: 4, parts: 26},
  {no: '04', cat: 'train', brand: '台鐵', zh: 'EMU3000 城際列車', soon: true},
  {no: '05', cat: 'bus', brand: '雙層', zh: '觀光巴士', soon: true},
  {no: '06', cat: 'plane', brand: '波音', zh: '787 夢幻客機', soon: true},
];

const sysTools = () =>
  M
    ? `<button class="ib" aria-label="更多">${svg('more')}</button>`
    : `<div class="seg lang"><button class="on">ㄅㄆ</button><button>中</button><button>EN</button></div>
       <button class="ib">${svg('sound')}</button><button class="ib">${svg('theme')}</button>`;

const meta = (it) => `<span class="meta"><b>${it.layers}</b>${H('層')}<i></i><b>${it.parts}</b>${H('個零件')}</span>`;
const card = (it, big = false) =>
  it.soon
    ? `<article class="card soon"><span class="no">No.${it.no}</span><div class="ph">${svg(it.cat)}</div>
        <h3><small>${H(it.brand)}</small><span>${H(it.zh)}</span></h3><span class="tag">${svg('lock')}${H('即將推出')}</span></article>`
    : `<article class="card${big ? ' big' : ''}"><span class="no">No.${it.no}</span><div class="ph"><img src="${img(it.img)}"></div>
        <h3><small>${H(it.brand)}</small><span>${H(it.zh)}</span></h3>${meta(it)}</article>`;

// ---------- 入口頁 ----------
function homeA() {
  // 藍圖：上面一塊「繼續看」，下面是分類＋館藏格子
  return `<header class="top">${logo()}<div class="tools">${sysTools()}</div></header>
  <section class="hero">
    <div class="copy"><p class="eyebrow">${H('繼續看')}</p><h1>${H('特斯拉')} Model Y</h1>
      <p class="sub">${H('上次拆到')} <b>${H('第二層')}</b>${H('・車子裡面')}</p>
      <div class="prog"><i style="width:50%"></i></div>
      <button class="cta">${svg('layers')}<span>${H('接著剝開')}</span></button></div>
    <div class="art"><img src="${img('car')}"></div>
  </section>
  <nav class="cats">${CATS.map((c, i) => `<button class="chip${i === 0 ? ' on' : ''}${c.soon ? ' soon' : ''}">${svg(c.id)}<span>${H(c.zh)}</span>${c.n ? `<em>${c.n}</em>` : ''}</button>`).join('')}</nav>
  <section class="grid">${ITEMS.map((it) => card(it)).join('')}</section>`;
}
function homeB() {
  // 剝橘：先選一大類（大磚塊），再看那一類的每一台
  const tiles = CATS.slice(1).map((c) => {
    const it = ITEMS.find((x) => x.cat === c.id && !x.soon);
    return `<button class="tile${c.soon ? ' soon' : ''}" data-c="${c.id}"><span class="ic">${svg(c.id)}</span><b>${H(c.zh)}</b>
      <em>${c.soon ? H('即將推出') : `${c.n} ${H('台')}`}</em>${it ? `<img src="${img(it.img)}">` : ''}</button>`;
  });
  return `<header class="top">${logo()}<div class="tools">${sysTools()}</div></header>
  <section class="intro"><h1>${H('今天想剝開什麼？')}</h1></section>
  <section class="tiles">${tiles.join('')}</section>
  <div class="shelfhead"><h2>${H('全部館藏')}</h2><span>${H('共')} 3 ${H('台')}</span></div>
  <section class="shelf">${ITEMS.map((it) => card(it)).join('')}</section>`;
}
function homeC() {
  // 展廳：一次看一台，像站在展台前；底下是分類和一排縮圖
  const it = ITEMS[2];
  return `<header class="top">${logo()}<div class="tools">${sysTools()}</div></header>
  <nav class="cats">${CATS.map((c, i) => `<button class="tab${i === 3 ? ' on' : ''}${c.soon ? ' soon' : ''}">${H(c.zh)}</button>`).join('')}</nav>
  <section class="stage">
    <div class="num">03<span>/ 03</span></div>
    <button class="nav l">${svg('arrowL')}</button><button class="nav r">${svg('arrowR')}</button>
    <div class="plinth"></div>
    <img class="hero" src="${img(it.img)}">
    <div class="label"><small>${H(it.brand)}</small><h1>${H(it.zh)}</h1>${meta(it)}
      <button class="cta">${svg('layers')}<span>${H('走近看')}</span></button></div>
  </section>
  <section class="strip">${ITEMS.map((x, i) => `<button class="th${i === 2 ? ' on' : ''}${x.soon ? ' soon' : ''}">${x.soon ? svg(x.cat) : `<img src="${img(x.img)}">`}<span>No.${x.no}</span></button>`).join('')}</section>`;
}

// ---------- 觀看頁 ----------
const LAYERS = [['整台', 'car'], ['外面', 'layers'], ['裡面', 'door'], ['底盤', 'drive'], ['電池', 'light']];
function viewer() {
  const bg = `../assets/view_car_${theme}_${M ? 'm' : 'd'}.png`;
  const acts = [['explode', '組回去', true], ['xray', '透視'], ['drive', '開車'], ['door', '打開'], ['light', '燈光']];
  const dock = M
    ? `<div class="dock">${acts.slice(0, 3).map(([k, t, on]) => `<button class="${on ? 'pri' : ''}">${svg(k)}<span>${H(t)}</span></button>`).join('')}
        <button>${svg('more')}<span>${H('更多')}</span></button></div>`
    : `<div class="dock">${acts.map(([k, t, on]) => `<button class="${on ? 'pri' : ''}">${svg(k)}<span>${H(t)}</span></button>`).join('')}</div>`;
  const rail = M
    ? `<div class="scrub">${LAYERS.map(([t], i) => `<button class="${i === 1 ? 'on' : ''}"><i></i>${i === 1 ? `<span>${H(t)}</span>` : ''}</button>`).join('')}</div>`
    : `<nav class="rail">${LAYERS.map(([t], i) => `<button class="${i === 1 ? 'on' : ''}"><i>${i}</i><span>${H(t)}</span></button>`).join('')}</nav>`;
  const tags = M
    ? [['車頭', 18, 64], ['車門', 62, 58], ['尾門', 70, 30]]
    : [['車頭', 30, 74], ['前車廂蓋', 36, 52], ['車門', 58, 66], ['玻璃車頂', 50, 28], ['尾門', 66, 22]];
  return `<div class="scene" style="background-image:url(${bg})"></div>
  <header class="vtop"><button class="ib back">${svg('back')}</button>
    <div class="vtitle"><small>No.03</small><b>${H('特斯拉')} Model Y</b></div>
    <div class="tools">${M ? `<button class="ib">${svg('more')}</button>` : `<div class="seg lang"><button class="on">ㄅㄆ</button><button>中</button><button>EN</button></div><button class="ib">${svg('sound')}</button><button class="ib">${svg('reset')}</button>`}</div></header>
  ${tags.map(([t, x, y]) => `<span class="ptag" style="left:${x}%;top:${y}%"><b>${H(t)}</b><i></i></span>`).join('')}
  ${rail}${dock}`;
}

document.body.innerHTML = `<main class="${P}">${P === 'home' ? {A: homeA, B: homeB, C: homeC}[D]() : viewer()}</main>
<div class="cap">${D} ${NAME[D]}・${P === 'home' ? '入口' : '觀看'}・${M ? '手機 390' : '電腦 1440'}</div>`;
