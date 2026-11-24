// 台北客運 日野 HS8JRVL 低地板公車：零件說明和真實數字。
// 數字來源：zh.wikiversity.org「臺北客運」使用車種（固亞／弘鉅低地板，HS8JRVL-UTF），
// 引擎缸徑衝程為日野 J08E 公開規格。車高頁面寫 1,730 mm 明顯有誤，這裡用 3.15 m 的估計值並標明。

export const SPEC = {
  length: 12.2, // m（弘鉅公開規格 12200 × 2500 × 3280，含前面的兔耳後照鏡）
  bodyLength: 11.815, // 車身本體：前懸 2.57 + 軸距 5.875 + 後懸 3.37
  width: 2.5,
  height: 3.28, // 含車頂冷氣機
  wheelbase: 5.875,
  frontOverhang: 2.57, // 和泰 HS8JRVL 底盤規格
  tireD: 0.9565, // 275/70R22.5：571.5 mm 鋼圈 + 2 × 192.5 mm 胎壁
  bore: 0.112,
  stroke: 0.13,
  cylinders: 6,
  hp: 280,
  gears: 6,
  floor: 0.34, // 台北市低地板補貼要點：無階梯區空車地板高 ≤ 35 cm
  fleet: {goya: 108, hongju: 79}, // 累計登記數
  kid: 1.15, // 小一小朋友約 115 cm
};

// 7.684 L：6 × π/4 × 0.112² × 0.130
export const displacementL = () => (SPEC.cylinders * Math.PI / 4 * SPEC.bore ** 2 * SPEC.stroke) * 1000;
export const tireCirc = () => Math.PI * SPEC.tireD; // 一圈 3.0 m

// say：點了會念的一句話。fact：一個可以數、可以比的數字。
export const PARTS = {
  aircon: {name: '冷氣機', en: 'air conditioner',
    say: '冷氣機放在車頂上，把涼涼的風吹進車子裡。台灣的夏天很熱，公車一定要有它。',
    fact: '它在最高的地方，因為熱空氣會往上跑。'},
  roof: {name: '車頂', en: 'roof',
    say: '車頂像一個大蓋子，蓋住整台公車，下雨也不會淋濕。',
    fact: '車頂前面有藍色和紅色的線，是台北客運的花紋。'},
  sideL: {name: '左邊車身', en: 'left side',
    say: '這是公車的左邊，沒有門，只有一整排窗戶。司機就坐在這一邊的最前面。',
    fact: '白色車身加上橘色的線，一看就知道是台北客運。'},
  sideR: {name: '右邊車身', en: 'right side',
    say: '這是公車的右邊，靠近人行道，所以門都開在這一邊。',
    fact: '在台灣車子靠右走，所以門開在右邊。'},
  doors: {name: '車門', en: 'doors',
    say: '公車有兩個門：前門上車，後門下車。兩片門會往外推、再往旁邊滑開。',
    fact: '2 個門 × 2 片 = 4 片門板。'},
  front: {name: '車頭', en: 'front',
    say: '車頭有一大片擋風玻璃、兩個大燈和雨刷，還寫著「臺北客運」四個字。',
    fact: '擋風玻璃差不多有兩個小朋友那麼寬。'},
  sign: {name: '路線牌', en: 'route sign',
    say: '路線牌是用很多小燈排成的字，告訴大家這台車是幾號、要開去哪裡。',
    fact: '852 號：從樹林開到北大社區。'},
  mirrors: {name: '後照鏡', en: 'mirrors',
    say: '公車的後照鏡像兔子的耳朵，往前伸出去，司機才看得到車子旁邊有沒有人。',
    fact: '左邊一個、右邊一個，一共 2 個。'},
  rear: {name: '車尾', en: 'rear',
    ev: {say: '電動公車的車尾裡面沒有引擎，放的是一大組電池。', fact: '電動公車沒有排氣管，車尾不會冒煙。'},
    say: '引擎就藏在車尾裡面，所以公車的後面比較熱，也比較吵。',
    fact: '車尾有紅色的燈，告訴後面的車要小心。'},
  mudflaps: {name: '擋泥板', en: 'mud flaps',
    say: '每個輪子後面都掛著一片黑色的橡膠，下雨天輪子甩起來的泥水，就會被它擋住。',
    fact: '4 個輪子，4 片擋泥板。'},
  floor: {name: '地板', en: 'low floor',
    ev: {say: '這是低地板公車，前半段的地板離地面很近，上車不用爬樓梯。後面比較高，因為下面要放電池和馬達。', fact: '地板離地面不到 35 公分，差不多到你的膝蓋。'},
    say: '這是低地板公車，前半段的地板離地面很近，上車不用爬樓梯。後面比較高，因為下面要放引擎。',
    fact: '地板離地面不到 35 公分，差不多到你的膝蓋。'},
  seats: {name: '座椅', en: 'seats',
    say: '公車上有大約 30 個座位。前面顏色不一樣的是博愛座，要讓給老人家、孕婦和需要的人。',
    fact: '數數看，紅色的博愛座有幾個？'},
  rails: {name: '扶手', en: 'handrails',
    say: '站著的時候要抓好黃色的扶手。它是黃色的，因為很顯眼，一下子就找得到。',
    fact: '上面還有兩條長長的扶手，從前面一直到後面。'},
  straps: {name: '吊環', en: 'hand straps',
    say: '天花板垂下來的黃色圓環叫吊環。站著的時候抓住它，公車轉彎也不會跌倒。',
    fact: '數數看，一共有幾個吊環？'},
  bell: {name: '下車鈴', en: 'stop button',
    say: '快到站的時候按一下紅色的下車鈴，叮咚！司機就知道下一站有人要下車。',
    fact: '點點看，會叮咚喔。'},
  reader: {name: '刷卡機', en: 'card reader',
    say: '上車和下車都要用悠遊卡在刷卡機上嗶一下。',
    fact: '前門一台、後門一台。'},
  driver: {name: '方向盤', en: 'steering wheel',
    say: '司機坐在左前方，轉動方向盤，前面的輪子就跟著轉彎。',
    fact: '方向盤要轉很多圈，輪子才轉一點點，這樣才轉得動這麼重的公車。'},
  ramp: {name: '斜坡板', en: 'ramp',
    say: '後門可以放下一塊斜坡板，坐輪椅的人和推娃娃車的人，就可以直接推上車。',
    fact: '按「開門」，公車會先往右邊蹲低一點，再放下斜坡板。'},
  frame: {name: '底盤大樑', en: 'chassis frame',
    say: '大樑是公車的骨頭，引擎、輪子、車身，全部都裝在它上面。',
    fact: '大樑從車頭一直延伸到車尾，有 12 公尺長。'},
  frontAxle: {name: '前軸', en: 'front axle',
    say: '前軸連著兩個前輪。司機轉方向盤，前輪就跟著左右轉。',
    fact: '前軸中間彎下去，讓地板可以做得很低。'},
  rearAxle: {name: '後軸', en: 'rear axle',
    say: '後軸會出力推著公車往前走。中間圓圓的齒輪盒，讓左右輪轉彎時可以轉不一樣快。',
    fact: '後輪才是真正出力的輪子，前輪負責轉彎。'},
  wheels: {name: '輪胎', en: 'tires',
    say: '公車有 6 個輪胎：前面 2 個，後面每一邊 2 個並在一起，因為後面最重。',
    fact: '輪子轉一圈，公車往前走 3 公尺。'},
  springs: {name: '空氣彈簧', en: 'air springs',
    say: '公車不是用鐵彈簧，是用充滿空氣的氣囊，坐起來比較不會晃。停車時放掉一點氣，公車就會往右邊蹲下來。',
    fact: '前面 2 個、後面 4 個，一共 6 個。'},
  engine: {variant: 'diesel', name: '引擎', en: 'engine',
    say: '引擎是公車的心臟。它把柴油燒成力氣，推著 6 個活塞上上下下。',
    fact: '6 個汽缸加起來 7.7 公升，差不多 4 大瓶寶特瓶。'},
  gearbox: {variant: 'diesel', name: '變速箱', en: 'gearbox',
    say: '變速箱像腳踏車的變速，有 6 個檔。起步用小檔，跑快了換大檔。',
    fact: '這台用的是 ZF 的自動變速箱，司機不用自己換檔。'},
  shaft: {name: '傳動軸', en: 'drive shaft',
    ev: {say: '傳動軸是一根會轉的鐵棒，把馬達的力氣送到後面的輪子。', fact: '按「開車」，看看它轉得多快。'},
    say: '傳動軸是一根會轉的鐵棒，把引擎的力氣送到後面的輪子。',
    fact: '按「開車」，看看它轉得多快。'},
  radiator: {name: '散熱器', en: 'radiator',
    ev: {say: '電池和馬達工作的時候也會變熱，散熱器一樣要用水和風扇幫它們降溫。', fact: '柴油公車和電動公車都有散熱器。'},
    say: '引擎工作的時候會變得很燙。散熱器用水和風扇幫它降溫，就像我們流汗一樣。',
    fact: '車身右後方上面那一格直條的百葉，就是讓熱風吹出去的地方。'},
  tank: {variant: 'diesel', name: '油箱', en: 'fuel tank',
    say: '油箱裡裝的是柴油，是引擎的食物。',
    fact: '公車的引擎吃柴油，不是汽油。'},
  battery: {name: '電瓶', en: 'batteries',
    say: '電瓶存著電，讓引擎發動，也讓車燈和路線牌亮起來。',
    fact: '2 顆 12 伏特的電瓶接在一起，變成 24 伏特。'},
  exhaust: {variant: 'diesel', name: '排氣管', en: 'exhaust',
    say: '引擎燒完柴油的廢氣，會先經過消音器變安靜，再從排氣管出去。',
    fact: '所以站在公車後面會聞到味道，要站遠一點。'},
  motor: {variant: 'ev', name: '馬達', en: 'electric motor',
    say: '電動公車沒有引擎，是用馬達讓輪子轉。馬達用電就能轉，不用燒油，所以很安靜。',
    fact: '踩煞車的時候，馬達會變成發電機，把電存回電池裡。'},
  roofBattery: {variant: 'ev', name: '車頂電池', en: 'roof batteries',
    say: '電動公車的電池又大又重，有一部分放在車頂上，像一排大箱子。',
    fact: '大電池裡面有很多個小電池，排得整整齊齊。'},
  rearBattery: {variant: 'ev', name: '車尾電池', en: 'rear batteries',
    say: '柴油公車放引擎的車尾，電動公車拿來放電池。',
    fact: '電動公車晚上回到停車場，插上充電器充電。'},
  controller: {variant: 'ev', name: '控制器', en: 'motor controller',
    say: '控制器是馬達的大腦。司機踩油門，它就決定要給馬達多少電。',
    fact: '橘色的粗電線是高壓電，很危險，只有修車師傅可以碰。'},
  chargePort: {variant: 'ev', name: '充電口', en: 'charging port',
    say: '電動公車不用加油，要把充電槍插在充電口充電。',
    fact: '就像手機一樣，沒電了就要充電。'},
};

/** 這個零件在柴油版、電動版的說明（電動版有自己的說法就用電動版的）。 */
export const partText = (id, variant) => ({...PARTS[id], ...(variant === 'ev' ? PARTS[id].ev : null)});
export const hasPart = (id, variant) => !PARTS[id].variant || PARTS[id].variant === variant;

// 比一比：柴油公車和電動公車不一樣的地方。d、e 是零件 id；沒有對應零件的寫字。
export const DIFFS = [
  {d: 'engine', e: 'motor', say: '柴油公車用引擎，電動公車用馬達。'},
  {d: 'tank', e: 'roofBattery', say: '柴油公車的油箱裝柴油，電動公車的電池裝電。'},
  {d: 'gearbox', eText: '沒有', say: '電動公車的馬達直接轉，不用變速箱。'},
  {d: 'exhaust', eText: '沒有', say: '電動公車不燒油，所以沒有排氣管，也不會冒黑煙。'},
  {dText: '加油', e: 'chargePort', say: '柴油公車要去加油，電動公車要插電充電。'},
  {dText: '開起來很吵', eText: '開起來很安靜', say: '按開車聽聽看，兩種公車的聲音不一樣。'},
];


// ---------- English ----------
// [say, fact]；電動版有自己說法的零件另外寫在 EN_EV
const EN = {
  aircon: ['The air conditioner sits on the roof and blows cool air into the bus. Taiwan’s summers are hot, so every bus needs one.', 'It’s up at the very top, because hot air rises.'],
  roof: ['The roof is like a big lid over the whole bus, so nobody gets wet when it rains.', 'The front of the roof has blue and red stripes, the Taipei Bus colors.'],
  sideL: ['This is the left side of the bus. It has no doors, just a long row of windows. The driver sits at the very front on this side.', 'White with orange stripes: you can spot a Taipei Bus right away.'],
  sideR: ['This is the right side, next to the sidewalk, so all the doors are on this side.', 'In Taiwan cars drive on the right, so the doors open on the right.'],
  doors: ['The bus has two doors: get on at the front, get off at the back. Each door pushes out and then slides open.', '2 doors × 2 panels = 4 door panels.'],
  front: ['The front has a big windshield, two headlights, wipers, and the name of the bus company.', 'The windshield is about as wide as two kids.'],
  sign: ['The route sign is made of lots of tiny lights. It tells everyone the bus number and where it’s going.', 'Route 852 goes from Shulin to Beida Community.'],
  mirrors: ['The mirrors stick out in front like bunny ears, so the driver can see who is next to the bus.', 'One on the left, one on the right: 2 in all.'],
  rear: ['The engine hides inside the back of the bus, so the back is warmer and noisier.', 'The red lights at the back tell cars behind to be careful.'],
  floor: ['This is a low-floor bus. The front half of the floor is close to the ground, so there are no stairs to climb. The back is higher because the engine is underneath.', 'The floor is less than 35 cm off the ground, about as high as your knee.'],
  seats: ['There are about 30 seats. The red ones near the front are priority seats for older people, pregnant women and anyone who needs them.', 'Count them: how many red priority seats are there?'],
  rails: ['Hold on to the yellow handrails when you stand. They’re yellow so you can find them fast.', 'Two long rails run overhead from the front to the back.'],
  straps: ['The yellow rings hanging from the ceiling are hand straps. Hold one and you won’t fall when the bus turns.', 'Count them: how many straps are there?'],
  mudflaps: ['Behind each wheel hangs a black rubber flap. On rainy days it stops the muddy water the tires throw up.', '4 wheels, 4 mud flaps.'],
  bell: ['When your stop is coming, press the red stop button. Ding-dong! Now the driver knows someone wants to get off.', 'Tap it: it really goes ding-dong.'],
  reader: ['Tap your EasyCard on the card reader when you get on and when you get off.', 'One by the front door, one by the back door.'],
  driver: ['The driver sits at the front on the left and turns the steering wheel to turn the front wheels.', 'The steering wheel turns many times for the tires to turn a little, so even a heavy bus is easy to steer.'],
  ramp: ['A ramp folds out at the back door, so people in wheelchairs or with strollers can roll right on.', 'Press Doors: the bus kneels to the right first, then the ramp comes out.'],
  frame: ['The chassis frame is the bus’s skeleton. The engine, wheels and body are all attached to it.', 'The frame runs from front to back, 12 meters long.'],
  frontAxle: ['The front axle holds the two front wheels. When the driver steers, they turn left and right.', 'It dips down in the middle so the floor can be really low.'],
  rearAxle: ['The rear axle pushes the bus forward. The round gearbox in the middle lets the left and right wheels turn at different speeds in a corner.', 'The back wheels do the pushing; the front wheels do the steering.'],
  wheels: ['The bus has 6 tires: 2 in front, and 2 side by side on each side at the back, because the back is the heaviest.', 'One turn of a wheel moves the bus 3 meters.'],
  springs: ['Instead of metal springs, the bus rides on air bags, so it bounces less. Let out some air and the bus kneels down to the right.', '2 in front and 4 at the back: 6 in all.'],
  engine: ['The engine is the heart of the bus. It burns diesel to make power and pushes 6 pistons up and down.', 'Its 6 cylinders hold 7.7 liters together, about 4 big soda bottles.'],
  gearbox: ['The gearbox works like the gears on a bike. It has 6 gears: a low gear to start, then higher gears as the bus goes faster.', 'It’s a ZF automatic, so the driver doesn’t have to change gears.'],
  shaft: ['The drive shaft is a spinning steel rod that carries the engine’s power to the back wheels.', 'Press Drive and watch how fast it spins.'],
  radiator: ['The engine gets very hot. The radiator cools it down with water and a fan, a bit like how we sweat.', 'The louvered grille high up at the back on the right is where the hot air blows out.'],
  tank: ['The fuel tank holds diesel, the engine’s food.', 'This engine eats diesel, not gasoline.'],
  battery: ['The batteries store electricity to start the engine and to light up the lamps and the route sign.', 'Two 12-volt batteries together make 24 volts.'],
  exhaust: ['The engine’s used-up gas goes through a muffler to get quieter, then out of the exhaust pipe.', 'That’s why it smells behind a bus. Stand back a little.'],
  motor: ['An electric bus has no engine. A motor turns the wheels using electricity, with no fuel to burn, so it’s very quiet.', 'When the bus brakes, the motor becomes a generator and puts electricity back into the batteries.'],
  roofBattery: ['An electric bus’s batteries are big and heavy, so some of them sit on the roof, like a row of big boxes.', 'Inside each big battery are lots of small batteries, lined up neatly.'],
  rearBattery: ['Where a diesel bus keeps its engine, an electric bus keeps batteries.', 'At night the electric bus goes back to the depot and plugs in to charge.'],
  controller: ['The controller is the motor’s brain. When the driver presses the pedal, it decides how much electricity the motor gets.', 'The thick orange cables carry high voltage. They’re dangerous, and only mechanics may touch them.'],
  chargePort: ['An electric bus never fills up with fuel. Instead, a charging plug goes into the charging port.', 'Just like a phone: when it runs low, you charge it.'],
};
const EN_EV = {
  radiator: ['The batteries and motor get hot too, so the radiator still cools them with water and a fan.', 'Diesel buses and electric buses both have radiators.'],
  floor: ['This is a low-floor bus. The front half of the floor is close to the ground, so there are no stairs to climb. The back is higher because the batteries and motor are underneath.', 'The floor is less than 35 cm off the ground, about as high as your knee.'],
  rear: ['There’s no engine in the back of an electric bus; it’s full of batteries instead.', 'An electric bus has no exhaust pipe, so no smoke comes out of the back.'],
  shaft: ['The drive shaft is a spinning steel rod that carries the motor’s power to the back wheels.', 'Press Drive and watch how fast it spins.'],
};
for (const [k, [sayEn, factEn]] of Object.entries(EN)) Object.assign(PARTS[k], {sayEn, factEn});
for (const [k, [sayEn, factEn]] of Object.entries(EN_EV)) Object.assign(PARTS[k].ev, {sayEn, factEn});
const DIFF_EN = [
  {sayEn: 'A diesel bus uses an engine; an electric bus uses a motor.'},
  {sayEn: 'A diesel bus’s tank holds fuel; an electric bus’s batteries hold electricity.'},
  {eTextEn: 'None', sayEn: 'The electric motor turns the wheels directly, so it needs no gearbox.'},
  {eTextEn: 'None', sayEn: 'An electric bus burns no fuel, so there’s no exhaust pipe and no black smoke.'},
  {dTextEn: 'Fill up', sayEn: 'A diesel bus fills up with fuel; an electric bus plugs in to charge.'},
  {dTextEn: 'Loud', eTextEn: 'Quiet', sayEn: 'Press Drive and listen: the two buses sound different.'},
];
DIFFS.forEach((d, i) => Object.assign(d, DIFF_EN[i]));
