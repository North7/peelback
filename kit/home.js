// 剝剝看的入口：展廳。一次看一台，像站在展台前；上面分類、下面一排縮圖，左右滑或按箭頭換下一台。
// 之後每一類可以有好幾台（飛機好幾種、公車好幾種…），只要在 entry.js 的 CATALOG 多加一筆。
import {L, H, HP, getLang, setLang} from './i18n.js';
import {LOGO} from './logo.js';
import {sysMenu, bindSys, ICON2, spring} from './ui.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const STR = {
  all: ['全部', 'All'],
  look: ['走近看', 'Take a look'],
  layers: ['層', 'layers'],
  parts: ['個零件', 'parts'],
  soon: ['即將推出', 'Coming soon'],
  soonSay: ['這一類還在做，很快就會放上來。', 'We’re still building these. They’ll be here soon.'],
  more: ['更多', 'More'],
};

/**
 * 畫出入口頁。cats：分類；items：每一台（{id, cat, no, brand, name, img, layers, parts}）。
 * onOpen(id) 走進那一台。回傳 {dispose}。
 */
export function startHome({cats, items, onOpen, lastId}) {
  const ac = new AbortController();
  const sig = {signal: ac.signal};
  const app = document.getElementById('app');
  const $ = (s) => app.querySelector(s);
  const S = {cat: 'all', i: Math.max(0, items.findIndex((x) => x.id === lastId))};
  const list = () => (S.cat === 'all' ? items : items.filter((x) => x.cat === S.cat));

  app.innerHTML = `
<div class="home">
  <header class="htop">
    <a class="brand" href="#" aria-label="Peelback">${LOGO('')}</a>
    ${sysMenu({sound: false, view: false})}
  </header>
  <nav class="htabs" id="htabs" role="tablist"><span class="seg-ind"></span>
    ${cats.map((c) => `<button role="tab" data-c="${c.id}" class="${c.soon ? 'soon' : ''}"><span></span></button>`).join('')}
  </nav>
  <section class="stage" id="stage">
    <div class="num" aria-hidden="true"><b id="hNum"></b><span id="hTot"></span></div>
    <button class="round nav l" id="hPrev">${ICON2.left}</button>
    <button class="round nav r" id="hNext">${ICON2.right}</button>
    <div class="plinth"></div>
    <div class="hero" id="hHero"></div>
    <div class="hlabel" id="hLabel"></div>
  </section>
  <div class="strip" id="strip"></div>
</div>`;

  function renderTexts() {
    $('.brand .word span').innerHTML = H('剝剝看');
    for (const b of app.querySelectorAll('#htabs button')) {
      const c = cats.find((x) => x.id === b.dataset.c);
      b.querySelector('span').innerHTML = HP(c.id === 'all' ? STR.all : c.name);
    }
    $('#hPrev').setAttribute('aria-label', L('上一台', 'Previous'));
    $('#hNext').setAttribute('aria-label', L('下一台', 'Next'));
    show(0, true);
    renderStrip();
    moveInd();
  }
  const moveInd = () => {
    const g = $('#htabs');
    const on = g.querySelector('button.on');
    const ind = g.querySelector('.seg-ind');
    if (!on) return;
    ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    ind.style.width = on.offsetWidth + 'px';
    ind.style.height = on.offsetHeight + 'px';
    on.scrollIntoView?.({inline: 'nearest', block: 'nearest', behavior: REDUCED ? 'auto' : 'smooth'});
  };
  function renderStrip() {
    const L2 = list();
    $('#strip').innerHTML = L2.length
      ? L2.map((x, i) => `<button class="th${i === S.i ? ' on' : ''}" data-i="${i}" aria-label="No.${x.no} ${L(...x.brand)} ${L(...x.name)}"><span class="no">No.${x.no}</span><img src="${x.img}" alt="" draggable="false"></button>`).join('')
      : '';
    for (const b of app.querySelectorAll('#strip .th')) b.onclick = () => go(+b.dataset.i - S.i);
  }

  /** 換到第 i 台：舊的往旁邊滑走、新的從另一邊滑進來（彈簧） */
  function show(dir, instant = false) {
    const L2 = list();
    const hero = $('#hHero');
    const lab = $('#hLabel');
    const cat = cats.find((c) => c.id === S.cat);
    $('#stage').classList.toggle('empty', !L2.length);
    $('#hPrev').hidden = $('#hNext').hidden = L2.length < 2;
    if (!L2.length) {
      // 還沒推出的分類
      $('#hNum').textContent = '—';
      $('#hTot').textContent = '';
      hero.innerHTML = `<div class="soonmark">${cat.icon}</div>`;
      lab.innerHTML = `<small>${HP(cat.name)}</small><h1>${HP(STR.soon)}</h1><p class="meta">${HP(STR.soonSay)}</p>`;
      animIn(hero, lab, dir, instant);
      return;
    }
    S.i = (S.i + L2.length) % L2.length;
    const x = L2[S.i];
    $('#hNum').textContent = x.no;
    $('#hTot').textContent = '/ ' + String(items.length).padStart(2, '0');
    hero.innerHTML = `<img src="${x.img}" alt="" draggable="false">`;
    lab.innerHTML = `<small>${HP(x.brand)}</small><h1>${HP(x.name)}</h1>
      <p class="meta"><b>${x.layers}</b>${H(L(STR.layers[0], ' ' + STR.layers[1]))}<i></i><b>${x.parts}</b>${H(L(STR.parts[0], ' ' + STR.parts[1]))}</p>
      <button class="cta" id="hGo">${ICON2.layers}<span>${HP(STR.look)}</span></button>`;
    $('#hGo').onclick = () => onOpen(x.id);
    for (const b of app.querySelectorAll('#strip .th')) b.classList.toggle('on', +b.dataset.i === S.i);
    animIn(hero, lab, dir, instant);
  }
  function animIn(hero, lab, dir, instant) {
    if (REDUCED || instant) return;
    const dx = dir === 0 ? 0 : dir > 0 ? 90 : -90;
    spring(hero, [{transform: `translateX(${dx}px) scale(${dir ? 0.92 : 0.96})`, opacity: 0}, {transform: 'none', opacity: 1}], 620);
    spring(lab, [{transform: 'translateY(14px)', opacity: 0}, {transform: 'none', opacity: 1}], 520, 60);
  }
  const go = (d) => {
    const L2 = list();
    if (L2.length < 2 && d) return;
    S.i += d;
    show(Math.sign(d) || 1);
  };
  function setCat(id) {
    S.cat = id;
    S.i = 0;
    for (const b of app.querySelectorAll('#htabs button')) b.setAttribute('aria-pressed', String(b.classList.toggle('on', b.dataset.c === id)));
    moveInd();
    renderStrip();
    show(1);
  }

  for (const b of app.querySelectorAll('#htabs button')) b.onclick = () => b.dataset.c !== S.cat && setCat(b.dataset.c);
  $('#hPrev').onclick = () => go(-1);
  $('#hNext').onclick = () => go(1);
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    // Enter 只在焦點不在按鈕、連結上時才進車（不然在「上一台」或分類上按 Enter 也會進去）
    else if (e.key === 'Enter' && list()[S.i] && !e.target.closest?.('button, a, input')) onOpen(list()[S.i].id);
  }, sig);
  // 左右滑換下一台
  let sx = null;
  $('#stage').addEventListener('pointerdown', (e) => (sx = e.clientX), sig);
  addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const d = e.clientX - sx;
    sx = null;
    if (Math.abs(d) > 50) go(d < 0 ? 1 : -1);
  }, sig);
  $('#hHero').addEventListener('click', () => list()[S.i] && onOpen(list()[S.i].id), sig);
  addEventListener('resize', moveInd, sig);

  bindSys(app, {sig, onLang: renderTexts});
  for (const b of app.querySelectorAll('#htabs button')) b.setAttribute('aria-pressed', String(b.classList.toggle('on', b.dataset.c === S.cat)));
  renderTexts();
  if (!REDUCED) spring(app.querySelector('.home'), [{opacity: 0, transform: 'scale(0.985)'}, {opacity: 1, transform: 'none'}], 520);

  return {
    dispose() {
      ac.abort();
      app.innerHTML = '';
    },
  };
}
export {getLang, setLang};
