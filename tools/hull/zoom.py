# 三視圖局部放大加細格線（每 5 公分一條、10 公分標數字），用來讀座標
import sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
u0, u1, v0, v1 = map(float, sys.argv[3:7])  # 這張圖的座標範圍（公尺）
flipu = len(sys.argv) > 7 and sys.argv[7] == 'flip'
im = Image.open(src).convert('RGB'); W, H = im.size
# 三視圖：每公尺 400 像素，u 從 U0 開始，v 從頂端 V1
U0 = {'right': -2.45, 'left': -2.45, 'front': -1.1, 'rear': -1.1, 'top': -2.45}
V1 = {'right': 1.7, 'left': 1.7, 'front': 1.7, 'rear': 1.7, 'top': 1.1}
k = [n for n in U0 if f'bp_{n}' in src][0]
S = 400
def px(u, v):
    x = (u - U0[k]) * S
    if flipu: x = W - 1 - x
    return x, (V1[k] - v) * S
xa, ya = px(u0, v1); xb, yb = px(u1, v0)
box = (int(min(xa, xb)), int(ya), int(max(xa, xb)), int(yb))
c = im.crop(box).resize(((box[2] - box[0]) * 2, (box[3] - box[1]) * 2), Image.LANCZOS)
d = ImageDraw.Draw(c)
import numpy as np
for u in np.arange(np.ceil(u0 * 20) / 20, u1 + 1e-9, 0.05):
    x = (px(u, 0)[0] - box[0]) * 2
    major = abs(u * 10 - round(u * 10)) < 1e-6
    d.line([(x, 0), (x, c.height)], fill=(255, 0, 0) if major else (255, 170, 170), width=1)
    if major: d.text((x + 2, 2), '%.1f' % u, fill=(200, 0, 0))
for v in np.arange(np.ceil(v0 * 20) / 20, v1 + 1e-9, 0.05):
    y = (px(0, v)[1] - box[1]) * 2
    major = abs(v * 10 - round(v * 10)) < 1e-6
    d.line([(0, y), (c.width, y)], fill=(0, 0, 255) if major else (170, 170, 255), width=1)
    if major: d.text((2, y + 2), '%.2f' % v, fill=(0, 0, 200))
c.save(out)
