# 照片和模型並排＋輪廓疊圖（紅＝照片多出來、藍＝模型多出來）
import sys, numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
pref, frames, out = sys.argv[1], [int(x) for x in sys.argv[2].split(',')], sys.argv[3]
rows = []
for i in frames:
    ph = Image.open(f'{IMG}/f{i:02d}.png').convert('RGBA').resize((1000, 666))
    bg = Image.new('RGBA', ph.size, (255, 255, 255, 255)); bg.alpha_composite(ph)
    md = Image.open(f'{pref}_{i:02d}.png').convert('RGBA')
    bg2 = Image.new('RGBA', md.size, (255, 255, 255, 255)); bg2.alpha_composite(md)
    a = np.array(ph)[..., 3] > 10; b = np.array(md)[..., 3] > 10
    ov = np.full(a.shape + (3,), 255, np.uint8)
    ov[a & b] = (200, 200, 200); ov[a & ~b] = (230, 40, 40); ov[~a & b] = (40, 90, 230)
    row = Image.new('RGB', (3000, 666), 'white')
    row.paste(bg.convert('RGB'), (0, 0)); row.paste(bg2.convert('RGB'), (1000, 0)); row.paste(Image.fromarray(ov), (2000, 0))
    d = ImageDraw.Draw(row); d.text((10, 10), f'f{i:02d}', fill=(255, 0, 0))
    rows.append(row.crop((0, 150, 3000, 520)))
sheet = Image.new('RGB', (3000, 370 * len(rows)), 'white')
for k, r in enumerate(rows): sheet.paste(r, (0, 370 * k))
sheet.resize((1800, int(370 * len(rows) * 0.6))).save(out, quality=88)
