// 車子的 3D 資料（zlib 壓縮過的 .bin）：點進哪一台才下載、解壓那一台，之後再進同一台直接用。
// 部署版（public/）裡 .bin 是網頁旁邊的獨立檔案，import 拿到的是網址；
// 單檔版（給 Claude 頁面發佈、本機工具用）裡 .bin 直接包在網頁裡，import 拿到的是位元組。兩種都吃。
// 下載時一段一段讀，載入畫面的進度照真的收到幾個位元組走（伺服器有給檔案大小的話）。
import {unzlibSync} from 'three/addons/libs/fflate.module.js';

const cache = new Map();
const state = new Map(); // 網址 → {got, total, fns}
async function fetchBytes(src, st) {
  const res = await fetch(src);
  if (!res.ok) throw new Error(`${res.status} ${src}`);
  // 有壓縮（content-encoding）時 content-length 是壓縮後的大小，和讀到的對不起來：當成不知道大小
  const total = res.headers.get('content-encoding') ? 0 : +res.headers.get('content-length') || 0;
  if (!total || !res.body?.getReader) return new Uint8Array(await res.arrayBuffer());
  st.total = total;
  let buf = new Uint8Array(total), n = 0;
  const rd = res.body.getReader();
  for (;;) {
    const {done, value} = await rd.read();
    if (done) break;
    if (n + value.length > buf.length) {
      const b2 = new Uint8Array(Math.max(buf.length * 2, n + value.length));
      b2.set(buf.subarray(0, n));
      buf = b2;
    }
    buf.set(value, n);
    n += value.length;
    st.got = Math.min(n, total);
    for (const f of st.fns) f();
  }
  return buf.subarray(0, n);
}
export function loadBin(src, onp) {
  if (!cache.has(src)) {
    const st = {got: 0, total: 0, fns: new Set()};
    state.set(src, st);
    cache.set(
      src,
      (async () => {
        const raw = typeof src === 'string' ? await fetchBytes(src, st) : src;
        st.got = st.total = st.total || 1;
        for (const f of st.fns) f();
        st.fns.clear();
        return unzlibSync(raw);
      })(),
    );
  }
  if (onp) {
    const st = state.get(src);
    if (st.got && st.got === st.total) onp(1);
    else st.fns.add(() => onp(st.total ? st.got / st.total : 0));
  }
  return cache.get(src);
}
/** 一台車有好幾個檔：一起下載，onp(0～1) 是全部加起來收到多少（照檔案大小加權；還不知道大小的先當 0） */
export function loadBins(srcs, onp) {
  const st = () => srcs.map((s) => state.get(s));
  const report = onp && (() => {
    const a = st();
    if (a.every((s) => s?.total)) onp(a.reduce((x, s) => x + s.got, 0) / a.reduce((x, s) => x + s.total, 0));
    else onp(a.reduce((x, s) => x + (s?.total ? s.got / s.total : 0), 0) / a.length);
  });
  return Promise.all(srcs.map((s) => loadBin(s, report)));
}
