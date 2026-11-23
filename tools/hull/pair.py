# 照片和網頁模型（同一個相機）並排：pair.py 模型資料夾 frames 輸出 [裁切 x0,y0,x1,y1]
import sys
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import IMG
d, frames, out = sys.argv[1], [int(x) for x in sys.argv[2].split(',')], sys.argv[3]
box = tuple(int(v) for v in sys.argv[4].split(',')) if len(sys.argv) > 4 else (250, 380, 1750, 980)
rows = []
for i in frames:
    a = Image.open(f'{IMG}/f{i:02d}.png').convert('RGBA'); bg = Image.new('RGBA', a.size, (255, 255, 255, 255)); bg.alpha_composite(a)
    m = Image.open(f'{d}/m{i:02d}.png').convert('RGB')
    w, h = box[2] - box[0], box[3] - box[1]
    r = Image.new('RGB', (w * 2 + 10, h), 'white'); r.paste(bg.convert('RGB').crop(box), (0, 0)); r.paste(m.crop(box), (w + 10, 0)); rows.append(r)
S = Image.new('RGB', (rows[0].width, sum(r.height + 10 for r in rows)), 'white')
y = 0
for r in rows: S.paste(r, (0, y)); y += r.height + 10
S.save(out, quality=90)
