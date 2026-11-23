// 三種顯示：zy（中文＋注音）、zh（中文）、en（英文）。
// 注音照 tools/zhuyin.mjs 產生的 zhuyin.json：認得的整段用那一段的讀音（破音字依詞判斷），
// 執行時才拼出來的句子，用每個字最常見的讀音。
import ZY from './zhuyin.json';

const KEY = 'peelback.lang';
let lang = (() => {
  try {
    // 舊名字（拆拆看 takeapart）存的設定也認
    const v = localStorage.getItem(KEY) ?? localStorage.getItem('takeapart.lang');
    return ['zy', 'zh', 'en'].includes(v) ? v : 'zy';
  } catch {
    return 'zy';
  }
})();
export const getLang = () => lang;
export function setLang(l) {
  lang = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {}
  applyLang();
}
export function applyLang() {
  document.documentElement.dataset.lang = lang;
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-Hant-TW';
}

/** 依目前語言挑一句：英文模式回英文，其他回中文。 */
export const L = (zh, en) => (lang === 'en' ? (en ?? zh) : zh);
export const Lp = (pair) => (Array.isArray(pair) ? L(pair[0], pair[1]) : pair);

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);
/** 中文字加注音：注音橫排浮在字的上面，不佔字的寬度，字距和沒有注音時一樣。 */
export function ruby(s) {
  // 句號、逗號這些標點黏在前一個字後面，換行時不會一個標點單獨跑到下一行
  return rubyRaw(s).replace(/(<\/i><\/span><\/span>)([，。、！？：；」』）…]+)/g, (m, end, p) => end.slice(0, -7) + `<span class="zp">${p}</span></span>`);
}
function rubyRaw(s) {
  return String(s).replace(/[㐀-鿿]+|[^㐀-鿿]+/g, (run) => {
    if (!/[㐀-鿿]/.test(run)) return esc(run);
    const zs = ZY.runs[run] || [...run].map((c) => ZY.chars[c] || '');
    return [...run].map((c, i) => (zs[i] ? `<span class="zc">${c}${zyCol(zs[i])}</span>` : c)).join('');
  });
}
/**
 * 一個字的直式注音：符號由上往下排成一直行，聲調在右邊（靠近最後一個符號），輕聲的點在最上面。
 * 聲調的位置一律保留，沒有聲調（一聲）的字也一樣寬，整行字距才會整齊。
 */
function zyCol(z) {
  const neutral = z.startsWith('˙');
  const body = neutral ? z.slice(1) : z;
  const tone = /[ˊˇˋ]$/.test(body) ? body.slice(-1) : '';
  const syms = [...(tone ? body.slice(0, -1) : body)];
  return `<span class="z" aria-hidden="true"><span class="zs">${neutral ? '<i class="n">˙</i>' : ''}${syms.map((c) => `<i>${c}</i>`).join('')}</span><i class="t">${tone}</i></span>`;
}
/** 文字轉成要放進畫面的 HTML：注音模式加注音，其他只做跳脫。 */
export const H = (s) => (lang === 'zy' ? ruby(s) : esc(s));
export const HP = (pair) => H(Lp(pair));
export {esc};
