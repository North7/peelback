// 車子的 3D 資料（zlib 壓縮過的 .bin）：點進哪一台才下載、解壓那一台，之後再進同一台直接用。
// 部署版（public/）裡 .bin 是網頁旁邊的獨立檔案，import 拿到的是網址；
// 單檔版（給 Claude 頁面發佈、本機工具用）裡 .bin 直接包在網頁裡，import 拿到的是位元組。兩種都吃。
import {unzlibSync} from 'three/addons/libs/fflate.module.js';

const cache = new Map();
export function loadBin(src) {
  if (!cache.has(src)) {
    cache.set(
      src,
      (async () => {
        const raw = typeof src === 'string' ? new Uint8Array(await (await fetch(src)).arrayBuffer()) : src;
        return unzlibSync(raw);
      })(),
    );
  }
  return cache.get(src);
}
