#!/usr/bin/env node
// 把頁面上會出現的中文全部標好注音，每台車寫一份 <車>/zhuyin.json（字串 → 每個字的注音）。
// 做法：繁轉簡（opencc）→ pinyin-pro 依詞判斷破音字 → 轉成注音 → 套用台灣教育部讀音的修正表。
// 一律標本調（「一」「不」不變調），跟國小課本一樣。另外輸出 tools/zhuyin-review.txt 方便逐條檢查。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {pinyin, customPinyin} from 'pinyin-pro';
import * as OpenCC from 'opencc-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const t2s = OpenCC.Converter({from: 'tw', to: 'cn'});

// 台灣讀音（教育部重編國語辭典）和 pinyin-pro 預設不同、或它判錯的詞。key 用簡體，值是空白分隔的拼音。
customPinyin({
  心脏: 'xīn zàng',
  力气: 'lì qì',
  轮子: 'lún zi',
  轮胎: 'lún tāi',
  转一圈: 'zhuàn yī quān',
  转动: 'zhuàn dòng',
  转得: 'zhuàn de',
  会转: 'huì zhuàn',
  在转: 'zài zhuàn',
  转很多圈: 'zhuàn hěn duō quān',
  转一点点: 'zhuǎn yī diǎn diǎn',
  转弯: 'zhuǎn wān',
  转不一样快: 'zhuàn bù yī yàng kuài',
  一转: 'yī zhuàn',
  垃圾: 'lè sè',
  星期: 'xīng qí',
  危险: 'wéi xiǎn',
  微: 'wéi',
  企: 'qì',
  谁: 'shéi',
  喔: 'ō',
  哦: 'ō',
  了: 'le',
  着: 'zhe',
  一下子: 'yī xià zi',
  样子: 'yàng zi',
  个子: 'gè zi',
  车子: 'chē zi',
  鼻子: 'bí zi',
  孩子: 'hái zi',
  朋友: 'péng yǒu',
  东西: 'dōng xi',
  时候: 'shí hòu',
  地方: 'dì fāng',
  知道: 'zhī dào',
  告诉: 'gào sù',
  什么: 'shén me',
  怎么: 'zěn me',
  这么: 'zhè me',
  多少: 'duō shǎo',
  觉得: 'jué de',
  漂亮: 'piào liàng',
  干净: 'gān jìng',
  安静: 'ān jìng',
  衣服: 'yī fú',
  休息: 'xiū xí',
  消息: 'xiāo xí',
  明白: 'míng bái',
  清楚: 'qīng chǔ',
  地板: 'dì bǎn',
  底盘: 'dǐ pán',
  大梁: 'dà liáng',
  柴油: 'chái yóu',
  方向盘: 'fāng xiàng pán',
  后照镜: 'hòu zhào jìng',
  空调: 'kōng tiáo',
  冷气机: 'lěng qì jī',
  散热器: 'sàn rè qì',
  变速箱: 'biàn sù xiāng',
  传动轴: 'chuán dòng zhóu',
  前轴: 'qián zhóu',
  后轴: 'hòu zhóu',
  轴: 'zhóu',
  弹簧: 'tán huáng',
  吊环: 'diào huán',
  扶手: 'fú shǒu',
  刷卡机: 'shuā kǎ jī',
  下车铃: 'xià chē líng',
  斜坡板: 'xié pō bǎn',
  电瓶: 'diàn píng',
  电池: 'diàn chí',
  排气管: 'pái qì guǎn',
  消音器: 'xiāo yīn qì',
  马达: 'mǎ dá',
  充电: 'chōng diàn',
  台北客运: 'tái běi kè yùn',
  臺北客運: 'tái běi kè yùn',
  博爱座: 'bó ài zuò',
  悠游卡: 'yōu yóu kǎ',
  一共: 'yī gòng',
  长长的: 'cháng cháng de',
  公里: 'gōng lǐ',
  公尺: 'gōng chǐ',
  公分: 'gōng fēn',
  公升: 'gōng shēng',
  几个: 'jǐ gè',
  几圈: 'jǐ quān',
  几公尺: 'jǐ gōng chǐ',
  差不多: 'chà bù duō',
  还有: 'hái yǒu',
  还是: 'hái shì',
  还没: 'hái méi',
  的话: 'de huà',
  得很: 'de hěn',
  看得到: 'kàn de dào',
  找得到: 'zhǎo de dào',
  转得动: 'zhuàn de dòng',
  一样: 'yī yàng',
  不一样: 'bù yī yàng',
  比一比: 'bǐ yī bǐ',
  看一看: 'kàn yī kàn',
  点点看: 'diǎn diǎn kàn',
  数数看: 'shǔ shǔ kàn',
  数一数: 'shǔ yī shǔ',
  组回去: 'zǔ huí qù',
  拆拆看: 'chāi chāi kàn',
  剥剥看: 'bāo bāo kàn', // 產品名：小朋友口語的「剝」ㄅㄠ
  考考你: 'kǎo kǎo nǐ',
  不玩了: 'bù wán le',
  答对了: 'dá duì le',
  好了: 'hǎo le',
  囉: 'luo',
  啰: 'luo',
  喽: 'lou',
  吧: 'ba',
  呢: 'ne',
  吗: 'ma',
  啊: 'a',
  的: 'de',
  地面: 'dì miàn',
  空气: 'kōng qì',
  重: 'zhòng',
  长: 'cháng',
  车头: 'chē tóu',
  车尾: 'chē wěi',
  车顶: 'chē dǐng',
  车身: 'chē shēn',
  头: 'tóu',
  里面: 'lǐ miàn',
  外面: 'wài miàn',
  后面: 'hòu miàn',
  前面: 'qián miàn',
  上面: 'shàng miàn',
  下面: 'xià miàn',
  旁边: 'páng biān',
  左边: 'zuǒ biān',
  右边: 'yòu biān',
  这边: 'zhè biān',
  那边: 'nà biān',
  整台: 'zhěng tái',
  一台: 'yī tái',
  每一边: 'měi yī biān',
  箱子: 'xiāng zi',
  网子: 'wǎng zi',
  排得: 'pái de',
  部分: 'bù fèn',
  转一转: 'zhuàn yī zhuàn',
  转几圈: 'zhuàn jǐ quān',
  让轮子转: 'ràng lún zi zhuàn',
  能转: 'néng zhuàn',
  直接转: 'zhí jiē zhuàn',
  怎么转: 'zěn me zhuàn',
  活塞: 'huó sāi',
  档: 'dǎng',
  小档: 'xiǎo dǎng',
  大档: 'dà dǎng',
  个档: 'gè dǎng',
  排档: 'pái dǎng',
  机头: 'jī tóu',
  机身: 'jī shēn',
  机尾: 'jī wěi',
  机门: 'jī mén',
  机翼: 'jī yì',
  机长: 'jī zhǎng',
  副机长: 'fù jī zhǎng',
  机长往后拉: 'jī zhǎng wǎng hòu lā',
  垂直尾翼: 'chuí zhí wěi yì',
  水平尾翼: 'shuǐ píng wěi yì',
  翼尖小翼: 'yì jiān xiǎo yì',
  方向舵: 'fāng xiàng duò',
  升降舵: 'shēng jiàng duò',
  襟翼: 'jīn yì',
  副翼: 'fù yì',
  扰流板: 'rǎo liú bǎn',
  起落架: 'qǐ luò jià',
  主起落架: 'zhǔ qǐ luò jià',
  鼻轮: 'bí lún',
  驾驶舱: 'jià shǐ cāng',
  头等舱: 'tóu děng cāng',
  商务舱: 'shāng wù cāng',
  经济舱: 'jīng jì cāng',
  豪华经济舱: 'háo huá jīng jì cāng',
  客舱: 'kè cāng',
  货舱: 'huò cāng',
  货柜: 'huò guì',
  行李柜: 'xíng lǐ guì',
  行李: 'xíng lǐ',
  行李箱: 'xíng lǐ xiāng',
  洗手间: 'xǐ shǒu jiān',
  厨房: 'chú fáng',
  吊架: 'diào jià',
  风扇: 'fēng shàn',
  叶片: 'yè piàn',
  燃油: 'rán yóu',
  空服员: 'kōng fú yuán',
  空山基: 'kōng shān jī',
  空山金: 'kōng shān jīn',
  星宇航空: 'xīng yǔ háng kōng',
  空中巴士: 'kōng zhōng bā shì',
  劳斯莱斯: 'láo sī lái sī',
  降落: 'jiàng luò',
  落地: 'luò dì',
  着陆: 'zhuó lù',
  起飞: 'qǐ fēi',
  飞机: 'fēi jī',
  一层层: 'yī céng céng',
  一圈一圈: 'yī quān yī quān',
  弯弯的: 'wān wān de',
  省油: 'shěng yóu',
  雷达: 'léi dá',
  眼罩: 'yǎn zhào',
  屁股: 'pì gǔ',
  肚子: 'dù zi',
  翅膀: 'chì bǎng',
  辅助动力装置: 'fǔ zhù dòng lì zhuāng zhì',
  抬头: 'tái tóu',
  抬起来: 'tái qǐ lái',
  翘起来: 'qiào qǐ lái',
  往上翘: 'wǎng shàng qiào',
  一排: 'yī pái',
  一架: 'yī jià',
  这架: 'zhè jià',
  整架: 'zhěng jià',
  洗澡水: 'xǐ zǎo shuǐ',
  一缸: 'yī gāng',
  缸: 'gāng',
  长: 'cháng',
  台北101: 'tái běi',
  那么高: 'nà me gāo',
  几公尺: 'jǐ gōng chǐ',
  离地: 'lí dì',
  快转: 'kuài zhuǎn',
  播放: 'bō fàng',
  搖杆: 'yáo gǎn',
  摇杆: 'yáo gǎn',
  公吨: 'gōng dùn',
  调出来: 'tiáo chū lái',
  滑过去: 'huá guò qù',
  往后: 'wǎng hòu',
  点头: 'diǎn tóu',
  上下点: 'shàng xià diǎn',
  跨过: 'kuà guò',
  伸长: 'shēn cháng',
  空气: 'kōng qì',
  空服员和清洁: 'kōng fú yuán hé qīng jié',
  转起来: 'zhuàn qǐ lái',
  一直转: 'yī zhí zhuàn',
  往左转: 'wǎng zuǒ zhuǎn',
  斜斜地转弯: 'xié xié de zhuǎn wān',
  位子: 'wèi zi',
  管子: 'guǎn zi',
  重量: 'zhòng liàng',
  油量: 'yóu liàng',
  飞得: 'fēi de',
  直直地: 'zhí zhí de',
  缝翼: 'fèng yì',
  滑轨罩: 'huá guǐ zhào',
  挡泥板: 'dǎng ní bǎn',
  空速管: 'kōng sù guǎn',
  天线: 'tiān xiàn',
  航行灯: 'háng xíng dēng',
  防撞灯: 'fáng zhuàng dēng',
  闪光灯: 'shǎn guāng dēng',
  降落灯: 'jiàng luò dēng',
  滑行灯: 'huá xíng dēng',
  标志灯: 'biāo zhì dēng',
  客舱灯: 'kè cāng dēng',
  头灯: 'tóu dēng',
  方向灯: 'fāng xiàng dēng',
  尾灯: 'wěi dēng',
  车内灯: 'chē nèi dēng',
  车牌: 'chē pái',
  一闪一闪: 'yī shǎn yī shǎn',
  连闪两下: 'lián shǎn liǎng xià',
  背鳍: 'bèi qí',
  天黑了: 'tiān hēi le',
  天亮了: 'tiān liàng le',
  看得比较清楚: 'kàn de bǐ jiào qīng chǔ',
  看得清楚: 'kàn de qīng chǔ',
  看得到: 'kàn de dào',
  照着: 'zhào zhe',
  照亮: 'zhào liàng',
  手电筒: 'shǒu diàn tǒng',
  塔台: 'tǎ tái',
  卫星: 'wèi xīng',
  讯号: 'xùn hào',
  小钩子: 'xiǎo gōu zi',
  小船: 'xiǎo chuán',
  轨道: 'guǐ dào',
  抓住: 'zhuā zhù',
  甩起来: 'shuǎi qǐ lái',
  泥水: 'ní shuǐ',
  特斯拉: 'tè sī lā',
  光条: 'guāng tiáo',
  前车厢: 'qián chē xiāng',
  后车厢: 'hòu chē xiāng',
  前车厢盖: 'qián chē xiāng gài',
  尾门: 'wěi mén',
  玻璃车顶: 'bō lí chē dǐng',
  氛围灯: 'fēn wéi dēng',
  气氛灯: 'qì fēn dēng',
  一体压铸: 'yī tǐ yā zhù',
  压出来: 'yā chū lái',
  热泵: 'rè bèng',
  卡钳: 'kǎ qián',
  碟盘: 'dié pán',
  避震器: 'bì zhèn qì',
  后照镜: 'hòu zhào jìng',
  水银灰: 'shuǐ yín huī',
  打滑: 'dǎ huá',
  度电: 'dù diàn',
  充饱: 'chōng bǎo',
  拨杆: 'bō gǎn',
  撥桿: 'bō gǎn',
  弹出来: 'tán chū lái',
  折起来: 'zhé qǐ lái',
  放倒: 'fàng dǎo',
  打开: 'dǎ kāi',
  关上: 'guān shàng',
  焊起来: 'hàn qǐ lái',
  课本: 'kè běn',
  书包: 'shū bāo',
  藏着: 'cáng zhe',
  藏在: 'cáng zài',
  出力: 'chū lì',
  空调: 'kōng tiáo',
  铝合金: 'lǚ hé jīn',
  一次: 'yī cì',
});

const INIT = {b: 'ㄅ', p: 'ㄆ', m: 'ㄇ', f: 'ㄈ', d: 'ㄉ', t: 'ㄊ', n: 'ㄋ', l: 'ㄌ', g: 'ㄍ', k: 'ㄎ', h: 'ㄏ', j: 'ㄐ', q: 'ㄑ', x: 'ㄒ', zh: 'ㄓ', ch: 'ㄔ', sh: 'ㄕ', r: 'ㄖ', z: 'ㄗ', c: 'ㄘ', s: 'ㄙ'};
const FIN = {
  a: 'ㄚ', o: 'ㄛ', e: 'ㄜ', ê: 'ㄝ', ai: 'ㄞ', ei: 'ㄟ', ao: 'ㄠ', ou: 'ㄡ', an: 'ㄢ', en: 'ㄣ', ang: 'ㄤ', eng: 'ㄥ', er: 'ㄦ', ong: 'ㄨㄥ',
  i: 'ㄧ', ia: 'ㄧㄚ', ie: 'ㄧㄝ', iao: 'ㄧㄠ', iu: 'ㄧㄡ', iou: 'ㄧㄡ', ian: 'ㄧㄢ', in: 'ㄧㄣ', iang: 'ㄧㄤ', ing: 'ㄧㄥ', iong: 'ㄩㄥ', io: 'ㄧㄛ',
  u: 'ㄨ', ua: 'ㄨㄚ', uo: 'ㄨㄛ', uai: 'ㄨㄞ', ui: 'ㄨㄟ', uei: 'ㄨㄟ', uan: 'ㄨㄢ', un: 'ㄨㄣ', uen: 'ㄨㄣ', uang: 'ㄨㄤ', ueng: 'ㄨㄥ',
  ü: 'ㄩ', üe: 'ㄩㄝ', üan: 'ㄩㄢ', ün: 'ㄩㄣ', v: 'ㄩ', ve: 'ㄩㄝ', van: 'ㄩㄢ', vn: 'ㄩㄣ',
};
const TONE = ['˙', '', 'ˊ', 'ˇ', 'ˋ', '˙'];

function toZhuyin(py) {
  const m = py.match(/^([a-zü]+)(\d)?$/);
  if (!m) return '';
  let s = m[1];
  const tone = m[2] === undefined ? 0 : +m[2];
  let body;
  if (/^(zh|ch|sh|r|z|c|s)i$/.test(s)) body = INIT[s.slice(0, -1)];
  else {
    let ini = '';
    if (s.startsWith('y')) {
      s = s.slice(1);
      if (s.startsWith('u')) s = 'ü' + s.slice(1);
      else if (!s.startsWith('i')) s = 'i' + s;
    } else if (s.startsWith('w')) {
      s = s.slice(1);
      if (!s.startsWith('u')) s = 'u' + s;
    } else {
      const k = s.startsWith('zh') || s.startsWith('ch') || s.startsWith('sh') ? s.slice(0, 2) : s[0];
      if (INIT[k]) {
        ini = INIT[k];
        s = s.slice(k.length);
        if ('jqx'.includes(k) && s.startsWith('u')) s = 'ü' + s.slice(1);
      }
    }
    if (s === 'ue') s = 'üe';
    body = ini + (FIN[s] ?? '');
  }
  if (!body) return '';
  return tone === 0 || tone === 5 ? '˙' + body : body + TONE[tone];
}

{
  const FILES = ['kit', 'bus', 'plane', 'car'].flatMap((d) => fs.readdirSync(path.join(ROOT, d)).filter((f) => f.endsWith('.js') && f !== 'model.js').map((f) => `${d}/${f}`));
// 收集原始碼裡所有中文字串（去掉註解）
const CJK = /[㐀-鿿]+/g;
const runs = new Set();
for (const f of FILES) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  for (const m of src.matchAll(CJK)) runs.add(m[0]);
}
const map = {};
const charCount = {};
const review = [];
for (const run of [...runs].sort()) {
  const simp = t2s(run);
  const chars = [...run];
  let zy;
  if ([...simp].length === chars.length) {
    const py = pinyin(simp, {toneType: 'num', type: 'array', toneSandhi: false, v: false});
    zy = py.map(toZhuyin);
  } else zy = chars.map((c) => toZhuyin(pinyin(t2s(c), {toneType: 'num', toneSandhi: false})));
  map[run] = zy;
  chars.forEach((c, i) => {
    const k = c + '\t' + zy[i];
    charCount[k] = (charCount[k] || 0) + 1;
  });
  review.push(run + '  ' + chars.map((c, i) => c + zy[i]).join(' '));
}
// 每個字最常見的讀音，給執行時才組出來的字串用
const best = {};
for (const [k, n] of Object.entries(charCount)) {
  const [c, z] = k.split('\t');
  if (!best[c] || n > best[c][1]) best[c] = [z, n];
}
const chars = Object.fromEntries(Object.entries(best).map(([c, [z]]) => [c, z]));
fs.writeFileSync(path.join(ROOT, 'kit/zhuyin.json'), JSON.stringify({runs: map, chars}));
fs.writeFileSync(path.join(ROOT, 'tools/zhuyin-review.txt'), review.join('\n') + '\n');
console.log(`zhuyin: ${runs.size} 段，${Object.keys(chars).length} 個字`);
}
