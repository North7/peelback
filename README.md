# 剝剝看 Peelback

給小朋友在 iPad 上玩的「可以拆開的 3D 模型」。

線上：https://peelback.aronlab.dev/

入口是「展廳」，一次看一台；走進一台車的網址是 `#bus`、`#plane`、`#car`：

- No.01 公車：台北客運日野 HS8JRVL 低地板公車（柴油／電動切換）→ `bus/`
- No.02 飛機：星宇航空 A350-1000「空山金」→ `plane/`
- No.03 汽車：特斯拉 Model Y → `car/`

加新的一台：照 `plane/vehicle.js` 寫一份，在 `kit/entry.js` 的 `VEHICLES` 和 `CATALOG` 各加一筆（分類還沒有車時不會顯示）。

## 部署

`npm run build` 之後把 `dist/peelback.html` 複製成 `public/index.html`，push 到 main，GitHub Actions 部署到 Cloudflare Pages
（`.github/workflows/cloudflare.yml`，需要倉庫 Secrets：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`）。

## 3D 模型的來源（姓名標示）

- 特斯拉 Model Y 外殼、車內：“2025 Tesla Model Y” by BloxBloger，Sketchfab，CC BY-NC 4.0（非商業使用）
- 汽車底盤：“Tesla Model X chassis” by Michael Zhang（beyond.zht），Sketchfab，CC BY 4.0
- 汽車電池：“Tesla Batterie Pack V2” by AniMtrX，Sketchfab，CC BY 4.0
- 汽車前後馬達：“Tesla Front / Rear Small Drive Unit” by tangentinnovationgroup，Sketchfab，CC BY 4.0
- 飛機機翼、尾翼、舵面、機頭機尾外殼：“A350 V4” by Newbie99999993，Sketchfab，CC BY 4.0（機身中段照它量的尺寸用程式畫）
- 飛機引擎：“Roll Royce Trent XWB Engine” by hakai315，Sketchfab，CC BY 4.0
- 飛機起落架：“A350-1000 Landing Gear” by N.S STUDIOS，Sketchfab，CC BY 4.0
- 公車、飛機：用程式自己畫的

原始下載檔不在這個倉庫（`ref/` 只留在本機）；`car/sk/` 是拆成零件、壓縮過的版本（`tools/sk_export.py`、`tools/sk_parts.py`）。

共用的介面在 `kit/`：`app.js`（場景、鏡頭、一層一層拆、名牌、點零件、透視、燈光）、`i18n.js`（注音／中文／英文）、
`sound.js`、`style.css`、`entry.js`（換車）。每台車一個資料夾：`model.js`（幾何，真實尺寸）、`data.js`（零件說明，中英文）、
`vehicle.js`（層、按鈕、每格的動畫）。加新的一台：照 `plane/vehicle.js` 寫一份，在 `kit/entry.js` 加進清單。

同一個零件在好幾個地方（例如飛機三個廚房），每個地方要各自是一個 piece，名牌才會指到真的東西，不會指到中間空的地方。

## 建置

需要 teardown 技能的 node_modules（esbuild、three）：`~/.claude/skills/teardown/node_modules`，
以及這個專案自己的 `npm install`（注音用的 pinyin-pro、opencc-js）。

```bash
npm run build                 # 先產生注音（kit/zhuyin.json），再打包 dist/peelback.html、dist/peelback.artifact.html
node tools/shot.mjs "$PWD/dist/peelback.html#plane" "$PWD/shots/x.png" 1366 1024 3000
```

Node 裝在 `~/.local/share/nodejs/current/bin`（沒有加進 PATH）。

## 資料來源

尺寸、引擎、車隊數量：zh.wikiversity.org「臺北客運」使用車種（固亞 108 台、弘鉅 79 台，累計登記）。
車高、車內零件位置是估計或照一般後置引擎低地板公車簡化的。

## 注音

頁面上所有中文都要有注音。`tools/zhuyin.mjs` 從 `kit/`、`bus/`、`plane/` 的程式收集中文字串，繁轉簡後用 pinyin-pro 依詞判斷破音字，
再套 `customPinyin` 裡的台灣讀音修正表，轉成注音存到 `bus/zhuyin.json`。`tools/zhuyin-review.txt` 列出每一段的結果，
改了文字之後要看一遍。新增的文字只要寫在這幾個資料夾的 js 裡，重新 build 就會自動有注音。
注音橫排浮在字的上面（`.zc` / `.z`），右上角可以切成純中文或英文；英文的說明寫在各 `data.js` 最後的 EN 表。

## 柴油／電動

電動版的零件（馬達、車頂電池、車尾電池、控制器、充電口）在 `data.js` 標 `variant: 'ev'`，柴油專屬的標 `variant: 'diesel'`。
電動版的配置照一般低地板電動公車簡化，不是台北客運特定車型。

## 燈光

右上角的燈泡打開燈光面板：白天／晚上，加上每一組燈的開關。第一次開燈會自動變晚上。
- 模型裡的燈用 `mat.lamp(顏色, 平常亮度, 組名, 打開亮度)`；真的光源（車內燈、標誌燈）在 `userData.light` 寫組名。
- 每台車在 `vehicle.js` 的 `LIGHTS` 列出燈組（名字、念的話、圖示、閃的節奏 `blink`／`beacon`／`strobe`、開燈時鏡頭方向 `view`），
  `pools` 是照在地上的光斑。
- 畫面有環境遮蔽（縫隙的軟陰影）和光暈；白天光暈門檻很高，只有燈會發光。慢的裝置跑幾秒後會自動關掉環境遮蔽、降解析度。
