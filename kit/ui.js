// 入口頁和觀看頁共用的系統按鈕（語言、日夜、聲音、回到正面）、圖示和彈簧動畫。
// 電腦：右上角一排；手機：收成一顆「⋯」，點了才從右上角長出一個小面板，不佔畫面。
import {L, getLang, setLang} from './i18n.js';

export const ICON2 = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  more: '<svg viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>',
  left: '<svg viewBox="0 0 24 24"><path d="M14.5 6l-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24"><path d="M9.5 6l6 6-6 6"/></svg>',
  layers: '<svg viewBox="0 0 24 24"><path d="M12 4l8.5 4.5L12 13 3.5 8.5z"/><path d="M3.5 12.5L12 17l8.5-4.5"/><path d="M3.5 16.5L12 21l8.5-4.5" opacity=".55"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
  sound: '<svg viewBox="0 0 24 24"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path class="wave" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/></svg>',
  view: '<svg viewBox="0 0 24 24"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.8h3.8"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M8.5 5.8v12.4L18.5 12z"/></svg>',
};

// ---------- 日夜（白天是預設）----------
// 整個網站只有一個白天／晚上：頁面深淺色、3D 場景的天色、燈光面板裡的切換都是同一個（2026-11-24 改：原本頁面和場景各管各的，會打架）
const TKEY = 'peelback.theme';
export const getTheme = () => {
  try {
    return localStorage.getItem(TKEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};
export function applyThemeAttr(t = getTheme()) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#f3f1ea' : '#070808');
}
export function setTheme(t) {
  try {
    localStorage.setItem(TKEY, t);
  } catch {
    /* 私密模式：只這一次有效 */
  }
  applyThemeAttr(t);
}

// ---------- 日夜切換（和 Daybreak 同一套）----------
// 頁面：一圈晨昏色的光從日夜鍵擴散出去，舊畫面在圈外、新畫面在圈內，中間露出來的那一圈就是晨昏線。
// 鍵上的圖示：一群點，晚上排成月亮、白天排成太陽，切換時先散開、再用彈簧重新排好。
const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const SHP = (() => {
  const sun = [];
  const moon = [[9.4, 1.2], [10.2, 4.2]];
  for (let y = 0; y < 11; y++)
    for (let x = 0; x < 11; x++) {
      const dx = x - 5, dy = y - 5, r = Math.hypot(dx, dy);
      if (r <= 2.3) sun.push([x, y]);
      else if (Math.abs(r - 4.2) < 0.45 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) sun.push([x, y]);
      if (Math.hypot(x - 4.7, y - 5.3) <= 4.1 && Math.hypot(x - 6.8, y - 3.9) > 3.8) moon.push([x, y]);
    }
  return {dark: moon, light: sun};
})();
const NP = Math.max(SHP.dark.length, SHP.light.length);
/** 在按鈕裡放一個點陣圖示；回傳 aim(主題, 要不要散開) */
function dotIcon(btn) {
  btn.innerHTML = `<svg viewBox="-0.4 -0.4 11.8 11.8" class="dots">${Array.from({length: NP}, () => '<circle r="0.4"/>').join('')}</svg>`;
  const cs = [...btn.querySelectorAll('circle')];
  const PT = cs.map(() => ({x: 5, y: 5, vx: 0, vy: 0, tx: 5, ty: 5, a: 0, ta: 0}));
  let raf = 0;
  const draw = () => PT.forEach((p, i) => {
    cs[i].setAttribute('cx', p.x.toFixed(2));
    cs[i].setAttribute('cy', p.y.toFixed(2));
    cs[i].setAttribute('opacity', Math.min(1, p.a).toFixed(2));
  });
  const tick = () => {
    raf = 0;
    let mv = 0;
    for (const p of PT) {
      p.vx = (p.vx + (p.tx - p.x) * 0.075) * 0.8;
      p.vy = (p.vy + (p.ty - p.y) * 0.075) * 0.8;
      p.x += p.vx;
      p.y += p.vy;
      p.a += (p.ta - p.a) * 0.12;
      mv += Math.abs(p.vx) + Math.abs(p.vy) + Math.abs(p.ta - p.a);
    }
    draw();
    if (mv > 0.02) raf = requestAnimationFrame(tick);
  };
  return (to, kick) => {
    // 按鈕上畫的是「按了會變成的那個」：現在是晚上就顯示太陽
    const sh = SHP[to === 'dark' ? 'light' : 'dark'];
    PT.forEach((p, i) => {
      const q = sh[i % sh.length];
      p.tx = q[0];
      p.ty = q[1];
      p.ta = i < sh.length ? 1 : 0;
      if (kick) {
        const an = Math.random() * 6.283, sp = 1 + Math.random() * 1.6;
        p.vx += Math.cos(an) * sp;
        p.vy += Math.sin(an) * sp;
      }
    });
    if (RM() || !kick) {
      PT.forEach((p) => Object.assign(p, {x: p.tx, y: p.ty, a: p.ta, vx: 0, vy: 0}));
      draw();
    } else if (!raf) raf = requestAnimationFrame(tick);
  };
}
/** 晨昏光圈：從 btn 的中心擴散出去。fn 換主題。 */
export function sweep(btn, fn) {
  const de = document.documentElement;
  if (RM() || !document.startViewTransition) return void fn();
  const r = btn.getBoundingClientRect();
  const vx = r.left + r.width / 2, vy = r.top + r.height / 2;
  de.style.setProperty('--vx', vx.toFixed(0) + 'px');
  de.style.setProperty('--vy', vy.toFixed(0) + 'px');
  de.style.setProperty('--vR', (Math.hypot(Math.max(vx, innerWidth - vx), Math.max(vy, innerHeight - vy)) + 200).toFixed(0) + 'px');
  de.dataset.vt = 'theme';
  let t = null;
  try {
    // 換主題的那一刻畫面停止更新（不能等下一格），所以叫 3D 場景馬上用新顏色重畫一次，新畫面才會是對的
    t = document.startViewTransition(() => {
      fn();
      dispatchEvent(new Event('peelback:theme'));
    });
  } catch {
    fn();
  }
  const done = () => delete de.dataset.vt;
  if (t?.finished) t.finished.then(done, done);
  else done();
}

// ---------- 語言切換（和 Daybreak 同一套）：字先從左到右變成點字，再從左到右解回另一種語言 ----------
const GL = '⠁⠃⠇⠧⠷⠿⠾⠼⠸⠰⠒⠶⠭⠛⠫⠽⠯⠟';
const rgl = () => GL[(Math.random() * GL.length) | 0];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const mixg = (s, k, out) => {
  let o = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    o += (out ? i >= k : i < k) || ch === ' ' || ch === '　' ? ch : ch.charCodeAt(0) > 0x2e7f ? rgl() : rgl();
  }
  return o;
};
let busy = false;
let queued = null;
/** 換語言的字亂碼動畫。動畫跑到一半又按了別的語言：記下最後一次，跑完直接套用（畫面和按鈕才會一致） */
export function scramble(root, fn) {
  if (RM()) return void fn();
  if (busy) {
    queued = fn;
    return;
  }
  busy = true;
  const finish = () => {
    busy = false;
    const q = queued;
    queued = null;
    if (q) q();
  };
  const prep = () => {
    const out = [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      const pe = n.parentElement;
      if (!n.nodeValue.trim() || !pe || pe.closest('script, style, svg, .langs, .stage .num, .loading, .logo')) continue;
      const r = pe.getBoundingClientRect();
      if (!r.width && !r.height) continue;
      out.push({n, s: n.nodeValue, d: clamp(r.left / (innerWidth || 1), 0, 1)});
    }
    return out;
  };
  const run = (list, dur, wave, out, done) => {
    const t0 = performance.now();
    let last = -99;
    const step = (now) => {
      const t = now - t0, end = t >= dur + wave;
      if (now - last > 40 || end) {
        last = now;
        for (const o of list) {
          const p = clamp((t - o.d * wave) / dur, 0, 1);
          o.n.nodeValue = mixg(o.s, Math.round(p * o.s.length), out);
        }
      }
      if (end) done();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const l0 = prep();
  run(l0, 200, 200, true, () => {
    for (const o of l0) if (o.n.isConnected) o.n.nodeValue = o.s;
    try {
      fn();
    } catch (e) {
      // 動畫中途離開了這一頁（例如按了返回）：不要讓 busy 卡住，之後才換得了語言
      finish();
      throw e;
    }
    const list = prep();
    for (const o of list) o.n.nodeValue = mixg(o.s, 0, false);
    run(list, 380, 340, false, () => {
      for (const o of list) o.n.nodeValue = o.s;
      finish();
    });
  });
}

/** 彈簧動畫：可以被打斷（新的動畫直接接手），尊重「減少動態」 */
export function spring(el, frames, duration = 520, delay = 0) {
  if (!el?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return null;
  return el.animate(frames, {duration, delay, easing: 'cubic-bezier(0.34, 1.45, 0.64, 1)', fill: 'backwards'});
}

/** 系統按鈕的 HTML。sound／view：觀看頁才有聲音和回到正面。 */
export function sysMenu({sound = true, view = true} = {}) {
  return `<div class="tools" id="tools">
  <div class="sys" id="sys">
    <div class="langs" id="langs" role="group" aria-label="語言 Language">
      <span class="seg-ind"></span>
      <button data-l="zy" aria-label="中文加注音">ㄅㄆ</button>
      <button data-l="zh" aria-label="中文">中</button>
      <button data-l="en" aria-label="English">EN</button>
    </div>
    ${sound ? `<button class="round" id="soundBtn">${ICON2.sound}</button>` : ''}
    <button class="round" id="themeBtn"></button>
    ${view ? `<button class="round" id="viewBtn">${ICON2.view}</button>` : ''}
  </div>
  <button class="round menu" id="menuBtn" aria-expanded="false">${ICON2.more}</button>
</div>`;
}

/** 綁系統按鈕：日夜、手機的「⋯」選單；onLang 給了就連語言也在這裡處理（入口頁用）。 */
export function bindSys(root, {sig, onLang} = {}) {
  const $ = (s) => root.querySelector(s);
  const tools = $('#tools');
  const themeBtn = $('#themeBtn');
  const aim = dotIcon(themeBtn);
  // 看畫面「現在」是白天還是晚上（介紹片自己天黑時，存起來的設定還是白天；按下去要換成白天，不是再換成晚上）
  const cur = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
  const paintTheme = () => {
    const dark = cur() === 'dark';
    themeBtn.setAttribute('aria-label', dark ? L('換成白天', 'Light mode') : L('換成晚上', 'Dark mode'));
    $('#menuBtn')?.setAttribute('aria-label', L('設定', 'Settings')); // 換語言時一起換
  };
  aim(cur(), false);
  paintTheme();
  // 白天／晚上可能從別的地方換（燈光面板、開燈自動變晚上）：日夜鍵的圖示和說明跟著變
  {
    let last = cur();
    const mo = new MutationObserver(() => {
      const t = cur();
      if (t === last) return;
      last = t;
      aim(t, true);
      paintTheme();
    });
    mo.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
    sig?.signal?.addEventListener('abort', () => mo.disconnect());
  }
  themeBtn.onclick = () => {
    const to = cur() === 'dark' ? 'light' : 'dark';
    aim(to, true);
    sweep(themeBtn, () => setTheme(to));
    paintTheme();
  };
  const menu = $('#menuBtn');
  menu.setAttribute('aria-label', L('設定', 'Settings'));
  const close = () => {
    tools.classList.remove('open');
    menu.setAttribute('aria-expanded', 'false');
  };
  menu.onclick = (e) => {
    e.stopPropagation();
    const open = !tools.classList.contains('open');
    tools.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    if (open) {
      spring($('#sys'), [{opacity: 0, transform: 'translateY(-8px) scale(.92)'}, {opacity: 1, transform: 'none'}], 480);
      requestAnimationFrame(() => moveSeg($('#langs')));
    }
  };
  addEventListener('pointerdown', (e) => {
    if (tools.classList.contains('open') && !tools.contains(e.target)) close();
  }, sig);
  if (onLang) {
    for (const b of root.querySelectorAll('#langs button')) {
      b.classList.toggle('on', b.dataset.l === getLang());
      b.addEventListener('click', () => {
        if (b.dataset.l === getLang()) return;
        for (const x of root.querySelectorAll('#langs button')) x.classList.toggle('on', x === b);
        moveSeg($('#langs'));
        scramble(root, () => {
          setLang(b.dataset.l);
          onLang();
          paintTheme();
        });
      });
    }
    requestAnimationFrame(() => moveSeg($('#langs')));
  }
  return {close, paintTheme};
}
export function moveSeg(g) {
  const on = g?.querySelector('button.on');
  const ind = g?.querySelector('.seg-ind');
  if (!on || !ind) return;
  ind.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
  ind.style.width = on.offsetWidth + 'px';
  ind.style.height = on.offsetHeight + 'px';
}
