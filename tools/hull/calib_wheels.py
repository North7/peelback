# 用輪圈（位置＋看起來多大）校正相機：近的輪子大、遠的小 → 相機距離；輪心位置已知（軸距 2.89、輪距 1.636）
import numpy as np, json, sys
from scipy.optimize import least_squares
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
R = json.load(open(sys.argv[1]))
obs = []
for i, l in R.items():
    for cx, cy, w, h, ang, area in l:
        hh = max(w, h); ww = min(w, h)
        if 120 <= hh <= 180 and ww > 35 and cy > 740: obs.append((int(i), cx, cy, hh))
print(len(obs), 'obs')
cam = json.load(open(ROOT + '/ref/car/autohome/camera.json'))
WB, TR, RW = 2.89, 0.818, 0.356
def wheels(xc):
    AXF = xc + 2.395 - 0.889; AXR = AXF - WB
    return np.array([[AXF, RW, TR], [AXF, RW, -TR], [AXR, RW, TR], [AXR, RW, -TR]])
names = ['f', 'D', 'Hc', 'pitch', 'cx', 'cy', 'a3', 'step', 'ox', 'oz', 'rimD', 'xc']
def unpack(q):
    d = dict(zip(names, q)); P = np.array([d.get(n, 0.0) for n in NAMES]); return d, P
def resid(q, ret=False):
    d, P = unpack(q)
    W = wheels(d['xc'])
    r = []; info = []
    for i, u, v, hh in obs:
        uu, vv, zc = project(W, i, P)
        # 只考慮朝向相機那一側的兩個輪子
        al = np.radians(d['a3'] + (i - 3) * d['step'])
        near = np.sign(np.sin(al))
        cand = [k for k in range(4) if np.sign(W[k, 2]) == near] if abs(np.sin(al)) > 0.2 else list(range(4))
        dd = [np.hypot(uu[k] - u, vv[k] - v) for k in cand]; k = cand[int(np.argmin(dd))]
        size = d['f'] * d['rimD'] / zc[k]
        r += [uu[k] - u, vv[k] - v, 2.0 * (size - hh)]
        info.append((i, k, uu[k] - u, vv[k] - v, size - hh))
    return info if ret else np.array(r)
best = None
for D0 in (9, 12, 15, 18, 22, 28):
    q0 = [276 * D0, D0, 0.8, 0.0, 984, 680, cam['a3'], 10.0, 0.0, 0.0, 0.5, 0.0]
    lo = [500, 4, -1, -0.3, 800, 400, -20, 9.5, -0.5, -0.5, 0.3, -0.3]; hi = [20000, 60, 3, 0.3, 1200, 1000, 20, 10.5, 0.5, 0.5, 0.8, 0.3]
    s = least_squares(resid, q0, bounds=(lo, hi), loss='soft_l1', f_scale=4)
    c = np.sqrt(np.mean(s.fun ** 2))
    print('D0', D0, 'rms', round(c, 2), dict(zip(names, np.round(s.x, 4))))
    if best is None or c < best[0]: best = (c, s.x)
d, P = unpack(best[1])
print('BEST', {k: round(float(v), 4) for k, v in d.items()})
for row in resid(best[1], True):
    if max(abs(row[2]), abs(row[3]), abs(row[4])) > 5: print('big', np.round(row, 1))
json.dump({k: float(v) for k, v in d.items()}, open(sys.argv[2], 'w'), indent=1)
