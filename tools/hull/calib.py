# 用「輪廓一致」反推相機：參數對了，36 張輪廓削出來的形狀投影回去會剛好填滿每張輪廓
import numpy as np, sys, json, time
from scipy import ndimage
from scipy.optimize import minimize
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *

SC = 4
sils = [load_sil(i, SC) for i in range(36)]
sild = [ndimage.binary_dilation(s, iterations=1) for s in sils]
H, W = sils[0].shape
G = 0.03
xs = np.arange(-2.5, 2.5, G); ys = np.arange(0.2, 1.75, G); zs = np.arange(-1.15, 1.15, G)
X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
PTS = np.stack([X.ravel(), Y.ravel(), Z.ravel()], -1)

def score(P, ret=False):
    alive = np.ones(len(PTS), bool)
    for i in range(36):
        u, v, _ = project(PTS[alive], i, P, SC)
        ui = np.round(u).astype(int); vi = np.round(v).astype(int)
        ok = (ui >= 0) & (ui < W) & (vi >= 0) & (vi < H)
        inside = np.zeros(len(ui), bool)
        inside[ok] = sild[i][vi[ok], ui[ok]]
        idx = np.where(alive)[0]
        alive[idx[~inside]] = False
    pts = PTS[alive]
    ious = []
    for i in range(36):
        u, v, _ = project(pts, i, P, SC)
        ui = np.round(u).astype(int); vi = np.round(v).astype(int)
        ok = (ui >= 0) & (ui < W) & (vi >= 0) & (vi < H)
        r = np.zeros((H, W), bool); r[vi[ok], ui[ok]] = True
        r = ndimage.binary_closing(ndimage.binary_dilation(r, iterations=1), iterations=2)
        # 只比 0.35 m 以上（避開地上的影子）
        _, vcut, _ = project(np.array([[0, 0.35, 0]]), i, P, SC)
        _, vfar, _ = project(np.array([[-2.4 * np.cos(np.radians(P[6] + (i - 3) * P[7])), 0.35, 0]]), i, P, SC)
        cut = int(min(vcut[0], vfar[0])) - 2
        s = sils[i][:cut]; rr = r[:cut]
        ious.append((s & rr).sum() / max(1, (s | rr).sum()))
    if ret: return np.array(ious), alive.sum()
    return 1 - np.mean(ious)

SCL = np.array([200, 2, 0.1, 0.02, 10, 10, 2, 0.3, 0.05, 0.05, 0.01])
def obj(q): return score(P0 + q * SCL)
t = time.time(); print('start', score(P0), time.time() - t, flush=True)
best = None
for D0 in (12, 20, 35):
    p = P0.copy(); p[1] = D0; p[0] = 276 * D0
    q0 = (p - P0) / SCL
    r = minimize(obj, q0, method='Powell', options={'maxfev': 1500, 'xtol': 1e-3, 'ftol': 1e-5})
    print('D0', D0, r.fun, dict(zip(NAMES, np.round(P0 + r.x * SCL, 4))), flush=True)
    if best is None or r.fun < best[0]: best = (r.fun, P0 + r.x * SCL)
P = best[1]
ious, n = score(P, True)
print('best', best[0], 'ious', np.round(ious, 3))
json.dump(dict(zip(NAMES, map(float, P))), open(ROOT + '/ref/car/autohome/camera.json', 'w'), indent=1)
