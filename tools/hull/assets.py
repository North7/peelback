# 網頁用的貼圖：車身顏色（JPEG）、粗糙度/金屬度/清漆（PNG 1024）、輪圈（側面照片裡的輪圈）
import numpy as np, sys, os
from PIL import Image
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import IMG, ROOT
prep, out = sys.argv[1], sys.argv[2]
Image.open(prep + '/albedo.png').convert('RGB').save(out + '/albedo.jpg', quality=86, optimize=True)
Image.open(prep + '/orm.png').convert('RGB').resize((1024, 1024), Image.LANCZOS).save(out + '/orm.png', optimize=True)
Image.open(prep + '/mask.png').save(out + '/mask.png', optimize=True)
# 輪圈：第 12 張（右側正側面）後輪，接近正圓
im = Image.open(f'{IMG}/f12.png').convert('RGBA')
bg = Image.new('RGBA', im.size, (40, 42, 45, 255))
bg.alpha_composite(im)
cx, cy, r = 587.2, 789.8, 78.5
ry = r * 154.4 / 149.4
w = bg.crop((int(cx - r), int(cy - ry), int(cx + r), int(cy + ry))).resize((512, 512), Image.LANCZOS).convert('RGB')
a = np.array(w).astype(np.float32)
yy, xx = np.mgrid[:512, :512]
rr = np.hypot(xx - 255.5, yy - 255.5) / 256
a[rr > 0.985] = (34, 35, 37)
Image.fromarray(a.astype(np.uint8)).save(out + '/rim.jpg', quality=90)
for f in ('albedo.jpg', 'orm.png', 'mask.png', 'rim.jpg', 'body.bin'):
    print(f, os.path.getsize(out + '/' + f) // 1024, 'KB')
