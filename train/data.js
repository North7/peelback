// 台灣高鐵 700T：零件說明和真實數字。
// 尺寸：全長 304 m、頭車 27 m／中間車 25 m、車寬 3.38 m、車高 3.65 m（不含車頂設備）、地板高 1.25 m（維基百科 THSR 700T，引用川崎重工、JRTR 2007）。
// 座位 977：每一節的座位數和排法照高鐵官網「車廂座位配置」（2024 年版）：1 車 63、2 車 96、3 車 85、4 車 96、5 車 80、6 車商務 66、
//   7 車 61（含 4 個輪椅位）、8 車 96、9 車 85、10 車 96、11 車 85、12 車 68。標準車廂一排 3+2、排距 1.04 m；商務車廂 2+2、排距 1.12 m。
// 編組 Tc-M2-MP-M1-T-M1s-MP-M2-M1-MP-M2-Tc：9 節有馬達、3 節沒有（1、5、12 車），馬達 36 個 × 285 kW＝10,260 kW；重 503 公噸；最高營運時速 300 公里；
//   電是架空線的 25,000 伏特交流電（維基百科）。集電弓在 4、9 車（英文維基百科）。廁所在 1、3、5、7、9、11 車，販賣機在 1、5、11 車（官網座位圖、日文維基百科）。
// 座椅顏色：標準車廂青綠色、商務車廂紫色（2025 年新車 N700ST 的報導拿現行 700T 來比）。車頭鼻子長 8 公尺（NOWnews 2025）。

export const SPEC = {
  length: 304,
  width: 3.38,
  height: 3.65,
  cars: 12,
  seats: 977,
  business: 66,
  standard: 911,
  speed: 300,
  weight: 503, // 公噸
  motors: 36,
  motorKw: 285,
  volts: 25000,
  nose: 8,
  bus: 12.16, // 拿台北客運公車來比
  busT: 16.3,
};

// 每一節：座位怎麼排（照官網座位圖）。abc／de：這一排靠 A 那邊有三個位子、靠 E 那邊有兩個位子的排號範圍。
// 座位圖左邊是南（1 車那頭），A 在上面；車頭朝南（+x）時，A 那一排在右手邊（+z）。
export const CARS = [
  {no: 1, type: 'Tc', seats: 63, abc: [1, 13], de: [2, 13], toilet: true, vending: true},
  {no: 2, type: 'M2', seats: 96, abc: [1, 20], de: [2, 19]},
  {no: 3, type: 'MP', seats: 85, abc: [2, 18], de: [2, 18], toilet: true},
  {no: 4, type: 'M1', seats: 96, abc: [1, 20], de: [2, 19], panto: true},
  {no: 5, type: 'T', seats: 80, abc: [2, 17], de: [2, 17], toilet: true, vending: true},
  {no: 6, type: 'M1s', seats: 66, business: true, ac: [2, 17], de: [1, 17]},
  {no: 7, type: 'MP', seats: 61, abc: [1, 11], de: [1, 12], wheel: [[13, 'A'], [14, 'A'], [13, 'E'], [14, 'E']], toilet: true},
  {no: 8, type: 'M2', seats: 96, abc: [1, 20], de: [2, 19]},
  {no: 9, type: 'M1', seats: 85, abc: [2, 18], de: [2, 18], toilet: true, panto: true},
  {no: 10, type: 'MP', seats: 96, abc: [1, 20], de: [2, 19]},
  {no: 11, type: 'M2', seats: 85, abc: [2, 18], de: [2, 18], toilet: true, vending: true},
  {no: 12, type: 'Tc', seats: 68, abc: [1, 14], de: [1, 13]},
];

// say：點了會念的一句話。fact：一個可以數、可以比的數字。
export const PARTS = {
  nose: {name: '車頭', en: 'nose',
    say: '高鐵的車頭有一個長長扁扁的鼻子，像鴨子的嘴巴。這樣衝進山洞的時候，才不會「碰」一聲把空氣擠得很大聲。',
    fact: '鼻子有 8 公尺長，差不多兩台汽車排起來。'},
  body: {name: '車廂', en: 'cars',
    say: '一列高鐵有 12 節車廂，車身是鋁做的，又輕又堅固。白色的車身上有一條橘色和一條黑色的線。',
    fact: '12 節接起來 304 公尺，差不多 25 台公車排成一排。'},
  windows: {name: '車窗', en: 'windows',
    say: '窗戶一格一格排在座位旁邊。有幾片是緊急逃生窗，旁邊放著敲破玻璃用的小鎚子。',
    fact: '每節車廂左右各有 3 片緊急逃生窗。'},
  pantograph: {name: '集電弓', en: 'pantograph',
    say: '車頂上像手臂一樣的架子叫集電弓，它頂著上面的電線，把電送進火車裡，讓馬達轉起來。',
    fact: '電線上的電有 25,000 伏特，是家裡插座的 200 多倍，千萬不能靠近！'},
  cab: {name: '駕駛室', en: 'cab',
    say: '司機坐在鼻子後面的駕駛室開火車。高鐵頭尾兩邊都有駕駛室，到了終點不用掉頭，司機走到另一頭就能往回開。',
    fact: '最快可以開到每小時 300 公里。'},
  standard: {name: '標準車廂', en: 'standard cars',
    say: '大部分的人坐標準車廂，青綠色的椅子一排 5 個，左邊 3 個、右邊 2 個。椅子可以整排轉過來，永遠面向前面。',
    fact: '11 節標準車廂一共 911 個位子。'},
  business: {name: '商務車廂', en: 'business car',
    say: '第 6 節是商務車廂，紫色的椅子比較大，一排只有 4 個，每個位子都有插座。',
    fact: '一共 66 個位子。整列加起來 977 個位子。'},
  accessible: {name: '輪椅位', en: 'wheelchair spaces',
    say: '第 7 節有一塊沒有椅子的地方，給坐輪椅的人停，旁邊還有比較大的無障礙廁所。',
    fact: '一共 4 個輪椅位。'},
  racks: {name: '行李架', en: 'luggage racks',
    say: '座位上面的架子放小包包，大行李箱放在車廂兩頭的行李區。',
    fact: '每一節的兩頭都有放大行李的地方。'},
  toilet: {name: '廁所', en: 'toilets',
    say: '高鐵上有廁所，在車廂的一頭，門口還有洗手台。',
    fact: '只有單號的車廂有廁所：1、3、5、7、9、11 車。'},
  vending: {name: '販賣機', en: 'vending machines',
    say: '口渴了可以在販賣機買飲料。',
    fact: '1、5、11 車才有販賣機。'},
  saloon: {name: '地板和牆', en: 'floor and walls',
    say: '車廂裡的地板和牆。車門旁邊的小空間叫玄關，上下車的時候大家從這裡進出。',
    fact: '地板離鐵軌 1.25 公尺，跟月台一樣高，上車不用爬樓梯。'},
  bogie: {name: '轉向架', en: 'bogies',
    say: '每節車廂底下有兩組轉向架，它們托著車廂，彎道的時候會跟著鐵軌轉，裡面還有彈簧讓火車坐起來不會晃。',
    fact: '每節 2 組，整列 24 組。'},
  wheels: {name: '車輪', en: 'wheels',
    say: '火車的輪子是鐵做的，兩個輪子用一根車軸連在一起，邊上有一圈凸起來，卡在鐵軌內側才不會掉下去。',
    fact: '整列有 48 根車軸、96 個車輪。'},
  motors: {name: '馬達', en: 'traction motors',
    say: '高鐵沒有引擎，是用電動馬達讓輪子轉。12 節裡有 9 節有馬達，1、5、12 車沒有。',
    fact: '一共 36 個馬達，每個 285 千瓦，加起來 10,260 千瓦。'},
};

export const partText = (id) => PARTS[id];

// ---------- English ----------
const EN = {
  nose: ['The front of the train has a long, flat nose, like a duck’s bill. That way it doesn’t make a loud BOOM when it rushes into a tunnel.', 'The nose is 8 meters long, about two cars in a row.'],
  body: ['A THSR train has 12 cars. The body is made of aluminium, light and strong, white with an orange stripe and a black stripe.', 'All 12 cars together are 304 meters long, about 25 buses in a row.'],
  windows: ['A row of windows runs along the seats. A few are emergency windows, with a little hammer next to them for breaking the glass.', 'Each car has 3 emergency windows on each side.'],
  pantograph: ['The arm on the roof is called a pantograph. It presses against the wire above and brings electricity into the train to turn the motors.', 'The wire carries 25,000 volts, over 200 times a home socket. Never go near it!'],
  cab: ['The driver sits in the cab behind the nose. There’s a cab at each end, so at the last stop the train doesn’t turn around: the driver just walks to the other end.', 'It can go up to 300 km an hour.'],
  standard: ['Most people ride in the standard cars. The teal seats come 5 to a row: 3 on one side, 2 on the other. Whole rows can spin around so they always face forward.', 'The 11 standard cars have 911 seats.'],
  business: ['Car 6 is the business car. Its purple seats are bigger, only 4 to a row, and every seat has a power socket.', '66 seats. The whole train has 977 seats.'],
  accessible: ['Car 7 has open spaces for people in wheelchairs, next to a bigger accessible toilet.', '4 wheelchair spaces.'],
  racks: ['Small bags go on the racks above the seats. Big suitcases go in the luggage areas at the ends of each car.', 'Every car has a luggage area at both ends.'],
  toilet: ['There are toilets on the train, at one end of the car, with a sink by the door.', 'Only the odd-numbered cars have toilets: 1, 3, 5, 7, 9 and 11.'],
  vending: ['Thirsty? You can buy a drink from the vending machine.', 'Only cars 1, 5 and 11 have one.'],
  saloon: ['The floor and walls of the cars. The little space by the doors is the vestibule, where everyone gets on and off.', 'The floor is 1.25 meters above the rails, as high as the platform, so there are no steps.'],
  bogie: ['Under each car are two bogies. They hold the car up, turn with the track on curves, and have springs so the ride is smooth.', '2 per car, 24 on the whole train.'],
  wheels: ['Train wheels are made of steel. Two wheels are joined by an axle, and a raised rim on each wheel hooks inside the rail so it can’t slip off.', '48 axles and 96 wheels on the whole train.'],
  motors: ['A THSR train has no engine: electric motors turn the wheels. 9 of the 12 cars have motors; cars 1, 5 and 12 don’t.', '36 motors, 285 kW each, 10,260 kW in all.'],
};
for (const [k, [sayEn, factEn]] of Object.entries(EN)) Object.assign(PARTS[k], {sayEn, factEn});
