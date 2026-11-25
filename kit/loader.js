// 載入畫面：一個輪子沿著一條細路往右滾，滾到哪裡就是載入到哪裡；上面一排是這次要準備的車，建好一台亮一台；下面一個百分比。
// 網頁一打開（程式還在下載）就先出現 0%，介紹片、點進一台車都用同一個。
// 這個檔不能 import 別的東西：打包工具（tools/build.mjs）也直接拿 LOADER 放進網頁。

/** icons：[[id, svg], ...]，要準備的車（可以是空的，先留位置） */
export const LOADER = (icons = [], extra = '') =>
  `<div class="loading lp" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">` +
  `<div class="lp-in"><div class="lp-veh">${icons.map(([id, svg]) => `<i data-v="${id}">${svg}</i>`).join('')}</div>` +
  `<div class="lp-road"><i class="lp-fill"></i><div class="lp-pos"><div class="wheel"></div></div></div>` +
  `<b class="lp-num">0<small>%</small></b></div>${extra}</div>`;

/**
 * 進度：stages = [[名字, 權重, 大概要幾秒], ...]，好了的那幾段加起來就是進度（順序不限）。
 * bytes(名字, 0～1)：這段的下載收到幾成；begin(名字)：開始建模型（數字照估的時間慢慢爬，爬不到終點就停著等）；done(名字)：這段好了（車子的圖示亮起來）。
 * 建模型的時候主執行緒會卡住，輪子的轉動用 CSS 動畫（卡住時照樣在轉），位置用 CSS 過渡接著滑。
 */
export function progress(el, stages) {
  const total = stages.reduce((a, s) => a + s[1], 0);
  const at = Object.fromEntries(stages.map(([id, w, sec]) => [id, {w: w / total, sec, ok: false, f: -1}]));
  let cur = null, t0 = 0, shown = 0, base = 0, raf = 0, last = -1;
  const num = el.querySelector('.lp-num'), fill = el.querySelector('.lp-fill'), pos = el.querySelector('.lp-pos'), road = el.querySelector('.lp-road');
  const draw = (p) => {
    const v = Math.min(100, Math.floor(p * 100));
    if (v === last) return;
    last = v;
    num.firstChild.nodeValue = String(v);
    el.setAttribute('aria-valuenow', v);
    fill.style.transform = `scaleX(${p})`;
    pos.style.transform = `translateX(${p * (road.clientWidth - pos.clientWidth)}px)`;
  };
  const tick = () => {
    raf = requestAnimationFrame(tick);
    // 有下載的那段：下載佔這段的 70%（照收到的位元組），建模型用估的時間再爬 25%；沒有下載的（熱身）整段用估的爬到九成
    let target = base;
    for (const id in at) {
      const s = at[id];
      if (s.ok) continue;
      if (s.f >= 0) target += s.w * 0.7 * s.f;
      if (s === cur) target += s.w * (s.f >= 0 ? 0.25 : 0.9) * (1 - Math.exp(-(performance.now() - t0) / 1000 / s.sec));
    }
    shown += (Math.max(shown, target) - shown) * 0.18;
    draw(shown);
  };
  raf = requestAnimationFrame(tick);
  return {
    begin(id) {
      if (at[id].ok || cur === at[id]) return;
      cur = at[id];
      t0 = performance.now();
    },
    /** 這段的下載收到幾成（0～1） */
    bytes(id, f) {
      at[id].f = Math.max(at[id].f, f);
    },
    done(id) {
      if (at[id].ok) return;
      at[id].ok = true;
      base += at[id].w;
      if (cur === at[id]) cur = null;
      el.querySelector(`[data-v="${id}"]`)?.classList.add('on');
    },
    /** 全部好了：直接到 100%，停掉 */
    finish() {
      base = 1;
      cur = null;
      shown = 1;
      draw(1);
      cancelAnimationFrame(raf);
    },
    stop() {
      cancelAnimationFrame(raf);
    },
  };
}

/** 讓瀏覽器先畫一格（建模型之前把進度畫出去） */
export const paintFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
