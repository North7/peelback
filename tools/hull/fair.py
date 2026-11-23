# 把削出來的形狀「整平」：每個橫切面用離中心的距離 r(θ) 表示，沿車長和沿一圈各自平滑、左右對稱，
# 再變回空間場。凹凸、波浪會被抹平，但車身比例不變（玩具版用）。
import numpy as np, sys, os
from scipy import ndimage
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import ROOT
d = np.load(ROOT + '/ref/car/autohome/hull.npz'); V, xs, ys, zs = d['V'], d['xs'], d['ys'], d['zs']
G = xs[1] - xs[0]
SX = float(os.environ.get('SX', '0.08')); STH = float(os.environ.get('STH', '3'))
NT = 360
th = np.linspace(0, 2 * np.pi, NT, endpoint=False)  # θ=0 往上，z = r sinθ，y = yc + r cosθ
Vs = ndimage.gaussian_filter(V, 0.008 / G)
inside = Vs > 0
cy = np.zeros(len(xs)); has = inside.any((1, 2))
for i in np.where(has)[0]:
    yy, zz = np.where(inside[i]); cy[i] = ys[yy].mean()
idx = np.where(has)[0]
cy = np.interp(np.arange(len(xs)), idx, ndimage.gaussian_filter1d(cy[idx], 0.15 / G))
R = np.zeros((len(xs), NT))
step = G / 3; rr = np.arange(0, 1.4, step)
for i in idx:
    Y = cy[i] + np.outer(np.cos(th), rr); Z = np.outer(np.sin(th), rr)
    vy = (Y - ys[0]) / G; vz = (Z - zs[0]) / G
    val = ndimage.map_coordinates(Vs[i], [vy, vz], order=1, cval=-1)
    out = val <= 0
    first = np.where(out.any(1), out.argmax(1), len(rr) - 1)
    # 線性內插到 0
    k = np.maximum(first, 1)
    v0 = val[np.arange(NT), k - 1]; v1 = val[np.arange(NT), k]
    R[i] = rr[k - 1] + step * v0 / np.maximum(v0 - v1, 1e-9)
    if not inside[i].any(): R[i] = 0
# 左右對稱：θ 和 -θ 平均
R = 0.5 * (R + R[:, (-np.arange(NT)) % NT])
# 平滑：沿一圈（環狀）和沿車長
R = ndimage.gaussian_filter1d(R, STH / (360 / NT), axis=1, mode='wrap')
lo, hi = idx.min(), idx.max()
Rin = R[lo:hi + 1]
Rin = ndimage.gaussian_filter1d(Rin, SX / G, axis=0, mode='nearest')
R[lo:hi + 1] = Rin
# 變回空間場
Y, Z = np.meshgrid(ys, zs, indexing='ij')
Vout = np.full(V.shape, -0.5, np.float32)
for i in range(lo, hi + 1):
    dy = Y - cy[i]; rho = np.hypot(dy, Z); ang = np.mod(np.arctan2(Z, dy), 2 * np.pi)
    f = ang / (2 * np.pi) * NT; k0 = np.floor(f).astype(int) % NT; t = f - np.floor(f)
    rt = R[i, k0] * (1 - t) + R[i, (k0 + 1) % NT] * t
    Vout[i] = rt - rho
# 車頭車尾的端面：照原本削出來的長度切齊
xin = xs[has]
Xc = xs[:, None, None]
Vout = np.minimum(Vout, np.minimum(Xc - xin.min(), xin.max() - Xc) + 0 * Vout)
# 車頭、車尾的端面不是「一圈一圈」的形狀（鴨尾、保險桿往回收），用原本削出來的形狀接回去
END = float(os.environ.get('END', '0.45'))
de = np.minimum(xs - xin.min(), xin.max() - xs)
w = np.clip(1 - (de - 0.05) / END, 0, 1); w = (w * w * (3 - 2 * w))[:, None, None]
Vorig = ndimage.gaussian_filter(V, 0.02 / G)
Vout = Vout * (1 - w) + Vorig * w
np.savez_compressed(os.environ.get('OUT', ROOT + '/ref/car/autohome/toy/hull_fair.npz'), V=Vout, xs=xs, ys=ys, zs=zs)
print('fair done', lo, hi, 'SX', SX, 'STH', STH)
