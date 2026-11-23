import {H} from '../../kit/i18n.js';
const src = document.createElement('div');
// 從 mock.js 拿同一個標誌（避免兩份不一樣）
import('./mark.js').then(({MARK}) => {
  for (const id of ['m1', 'm2', 'i1', 'i2']) document.getElementById(id).innerHTML = MARK;
  const w = `<div class="logo">${MARK}<div class="word"><b>Peelback</b><span>${H('剝剝看')}</span></div></div>`;
  document.getElementById('w1').innerHTML = w; document.getElementById('w2').innerHTML = w;
});
