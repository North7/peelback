# 汽車之家 36 張轉盤照片的相機模型和輪廓工具
import numpy as np
from PIL import Image
from scipy import ndimage
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
IMG = os.path.join(ROOT, 'ref/car/autohome')
LEN = 4.79

def load_sil(i, scale=1):
    a = np.array(Image.open(f'{IMG}/f{i:02d}.png'))[..., 3]
    m = a > 10
    m = ndimage.binary_fill_holes(m)
    if scale != 1:
        h, w = m.shape
        m = np.array(Image.fromarray(m.astype(np.uint8) * 255).resize((w // scale, h // scale), Image.BILINEAR)) > 127
    return m

# 車的座標：x 往前（車頭 +），y 往上，z 往右；原點在車長中點、地面、車寬中線
# 參數 P: f, D, Hc, pitch, cx, cy, a3(第3張的角度,度), step(每張轉幾度), ox, oz（轉盤中心相對車中心的偏移）, roll
NAMES = ['f', 'D', 'Hc', 'pitch', 'cx', 'cy', 'a3', 'step', 'ox', 'oz', 'roll']
P0 = np.array([5520, 20.0, 0.75, 0.0, 990, 680, 0.0, 10.0, 0.0, 0.0, 0.0])

def project(pts, i, P, scale=1):
    f, D, Hc, pitch, cx, cy, a3, step, ox, oz, roll = P
    al = np.radians(a3 + (i - 3) * step)
    x = pts[..., 0] - ox; y = pts[..., 1]; z = pts[..., 2] - oz
    X = x * np.sin(al) - z * np.cos(al)
    Z = x * np.cos(al) + z * np.sin(al)
    dy = y - Hc; dep = D - Z
    cp, sp = np.cos(pitch), np.sin(pitch)
    yc = cp * dy + sp * dep; zc = -sp * dy + cp * dep
    u = f * X / zc; v = -f * yc / zc
    cr, sr = np.cos(roll), np.sin(roll)
    u, v = cr * u - sr * v, sr * u + cr * v
    return (cx + u) / scale, (cy + v) / scale, zc

# 後照鏡會在前後方向的照片裡凸出車身；沿著車側往後的空間會因此削不掉，變成一條「架子」。
# 所以在後照鏡那幾行，把凸出去的部分剪回車身邊線（用上下兩行的邊線內插）。
MIRROR_BOX = (0.40, 0.85, 0.94, 1.22, 0.78, 1.12)  # x0,x1,y0,y1,|z|0,|z|1

def strip_mirrors(m, i, P, scale=1):
    m = m.copy()
    x0, x1, y0, y1, z0, z1 = MIRROR_BOX
    H, W = m.shape
    for s in (-1, 1):
        c = np.array([[x, y, s * z] for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)])
        u, v, _ = project(c, i, P, scale)
        ua, ub = int(u.min()) - 4, int(u.max()) + 4
        va, vb = int(v.min()) - 3, int(v.max()) + 3
        if va < 1 or vb >= H - 1: continue
        right = u.mean() > np.mean(np.where(m.any(0))[0])
        def ext(r):
            cols = np.where(m[r])[0]
            if len(cols) == 0: return None
            return cols.max() if right else cols.min()
        ea, eb = ext(va - 1), ext(vb + 1)
        if ea is None or eb is None: continue
        for r in range(va, vb + 1):
            e = ext(r)
            if e is None or not (ua <= e <= ub): continue
            line = ea + (eb - ea) * (r - va) / max(1, vb - va)
            if right and e > line + 2: m[r, int(np.ceil(line)) + 1:] = False
            if not right and e < line - 2: m[r, :int(np.floor(line))] = False
    return m
