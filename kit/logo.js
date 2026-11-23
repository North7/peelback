// 剝剝看 Peelback 的標誌：三片斜放的板子往上拆開（爆炸圖），最上面那片右上角被掀起來往回捲。
// 顏色跟著主題：--accent（最上層）、--ink（下面兩層和捲起來的背面）。
export const MARK = `<svg viewBox="0 0 48 48" class="mark" aria-hidden="true">
<path d="M6 37.5L24 29 42 37.5 24 46z" fill="var(--ink)" opacity=".26"/>
<path d="M6 26.5L24 18 42 26.5 24 35z" fill="var(--ink)" opacity=".52"/>
<path d="M6.00 13.50L24.00 5.00 31.56 8.57 32.10 18.18 24.00 22.00z" fill="var(--accent)"/>
<path d="M31.56 8.57L32.10 18.18Q28.92 15.01 22.94 11.04Q27.85 8.40 31.56 8.57z" fill="#000" opacity=".28" transform="translate(-1 1.4)"/>
<path d="M31.56 8.57L32.10 18.18Q28.92 15.01 22.94 11.04Q27.85 8.40 31.56 8.57z" fill="var(--ink)"/></svg>`;
export const LOGO = (zh) => `<div class="logo">${MARK}<div class="word"><b>Peelback</b><span>${zh}</span></div></div>`;
// 網頁圖示（瀏覽器分頁）：深色圓角方塊上放標誌
export const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#0d1010"/><g transform="translate(8 6)">${MARK.replace(/var\(--ink\)/g, '#ecede8').replace(/var\(--accent\)/g, '#3fe0b2').replace(' class="mark" aria-hidden="true"', ' width="48" height="48"')}</g></svg>`;
