# 疊圖：參考照片的輪廓描紅線、模型的輪廓描藍線，用車長和地面對齊
import sys
from PIL import Image, ImageFilter, ImageChops, ImageDraw
import numpy as np
ref, mine, out = sys.argv[1:4]
def mask(path, thr):
    im = np.asarray(Image.open(path).convert('L')).astype(float)
    m = im < thr
    ys, xs = np.nonzero(m)
    return m, xs.min(), xs.max(), ys.min(), ys.max()
mr, ax0, ax1, ay0, ay1 = mask(ref, 185)
mm, bx0, bx1, by0, by1 = mask(mine, 215)
# 用車長對齊（x 方向）、車頂到最低點對齊（y 方向用同一個比例，對齊車頂）
s = (ax1 - ax0) / (bx1 - bx0)
H = Image.open(ref).convert('RGB')
W2, H2 = H.size
mi = Image.fromarray((mm * 255).astype('uint8')).resize((int(mm.shape[1] * s), int(mm.shape[0] * s)))
canvas = Image.new('L', (W2, H2), 0)
canvas.paste(mi, (int(ax0 - bx0 * s), int(ay0 - by0 * s)))
edge = lambda m: np.asarray(Image.fromarray(m).filter(ImageFilter.FIND_EDGES)) > 60
er = edge((mr * 255).astype('uint8'))
em = edge(np.asarray(canvas))
# 參考：車身塗成淡紅色；模型：藍色輪廓線。只保留車子那一塊，放大 2 倍
rgb = np.full((H2, W2, 3), 255, dtype='uint8')
rgb[mr] = [245, 170, 170]
rgb[em] = [20, 60, 220]
img = Image.fromarray(rgb).crop((max(0, ax0 - 10), max(0, ay0 - 10), min(W2, ax1 + 10), min(H2, ay1 + 10)))
img = img.resize((img.width * 2, img.height * 2), Image.NEAREST)
img.save(out)
print('scale', round(s, 3), 'ref box', ax0, ax1, ay0, ay1, 'mine box', bx0, bx1, by0, by1)
