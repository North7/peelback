// 剝剝看介紹頁的首屏樣稿：五個概念放在同一頁，下面一排切換（#1 #2 #3 #6 #9）。
import {LOGO} from '../../kit/logo.js';
import c0 from './c0_film.js';
import c1 from './c1_particles.js';
import c2 from './c2_scan.js';
import c3 from './c3_freeze.js';
import c6 from './c6_scale.js';
import c9 from './c9_poster.js';

const CONCEPTS = [
  {k: 'film', mark: '▶', name: '電影版', run: c0},
  {k: '1', name: '粒子變形', run: c1},
  {k: '2', name: '掃描線', run: c2},
  {k: '3', name: '凍結爆炸', run: c3},
  {k: '6', name: '真實比例', run: c6},
  {k: '9', name: '撕開海報', run: c9},
];
const SUN = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>';
const MOON = '<svg viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

const root = document.documentElement;
const getTheme = () => {
  try {
    return localStorage.getItem('peelback.theme') === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};
// 記過的選擇優先；沒有的話，外層（Claude 頁面）已經設了就照它；都沒有就用網站預設的白天
let stored = null;
try {
  stored = localStorage.getItem('peelback.theme');
} catch {}
root.dataset.theme = stored ? getTheme() : root.dataset.theme === 'dark' ? 'dark' : 'light';

const app = document.getElementById('app');
app.innerHTML = `
  <div class="stage" id="stage"></div>
  <header class="top">
    <a class="brand" href="#">${LOGO('剝剝看')}</a>
    <button class="ib" id="theme" aria-label="切換白天、晚上"></button>
  </header>
  <nav class="proto" id="proto" aria-label="首屏樣稿">
    <i class="ind" id="protoInd"></i>
    ${CONCEPTS.map((c) => `<button data-k="${c.k}"><b>${c.mark || c.k}</b><span>${c.name}</span></button>`).join('')}
  </nav>`;

const themeBtn = document.getElementById('theme');
const paintThemeBtn = () => (themeBtn.innerHTML = root.dataset.theme === 'dark' ? MOON : SUN);
paintThemeBtn();
// 片子自己天黑、天亮時（改了 data-theme），右上角的圖示也跟著換
new MutationObserver(paintThemeBtn).observe(root, {attributes: true, attributeFilter: ['data-theme']});
let themeFns = [];
themeBtn.onclick = () => {
  const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = t;
  try {
    localStorage.setItem('peelback.theme', t);
  } catch {}
  paintThemeBtn();
  themeBtn.classList.remove('spin');
  void themeBtn.offsetWidth;
  themeBtn.classList.add('spin');
  for (const f of themeFns) f(t);
};

let cur = null, ac = null, runN = 0;
async function show() {
  const k = location.hash.slice(1) || 'film';
  const c = CONCEPTS.find((x) => x.k === k) || CONCEPTS[0];
  const n = ++runN;
  ac?.abort();
  try {
    cur?.dispose?.();
  } catch (e) {
    console.error(e);
  }
  cur = null;
  themeFns = [];
  ac = new AbortController();
  const stage = document.getElementById('stage');
  stage.innerHTML = `<div class="loading"><svg viewBox="0 0 48 48" class="lmark"><path class="p3" d="M6 37.5L24 29 42 37.5 24 46z"/><path class="p2" d="M6 26.5L24 18 42 26.5 24 35z"/><path class="p1" d="M6 15L24 6.5 42 15 24 23.5z"/></svg></div>`;
  stage.dataset.k = c.k;
  const btns = [...document.querySelectorAll('#proto button')];
  btns.forEach((b) => b.classList.toggle('on', b.dataset.k === c.k));
  moveInd();
  const ctx = {sig: ac.signal, onTheme: (f) => themeFns.push(f), alive: () => n === runN};
  try {
    const r = await c.run(stage, ctx);
    if (n !== runN) return r?.dispose?.();
    cur = r;
    stage.querySelector('.loading')?.remove();
  } catch (e) {
    console.error(e);
    if (n === runN) stage.innerHTML = `<div class="loading"><p class="err">載入失敗：${e.message}</p></div>`;
  }
}
function moveInd() {
  const on = document.querySelector('#proto button.on');
  const ind = document.getElementById('protoInd');
  if (!on) return;
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
  ind.style.width = on.offsetWidth + 'px';
}
document.getElementById('proto').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) location.hash = b.dataset.k;
});
addEventListener('hashchange', show);
addEventListener('resize', moveInd);
document.fonts?.ready.then(moveInd);
show();
