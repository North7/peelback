# 車側往內修正多少：把車側表面往內推 δ，看不同角度的照片投上去的細節（門縫、門把、窗框）對不對得起來
import numpy as np, sys, json
from PIL import Image
from scipy import ndimage
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
import os
cam = json.load(open(os.environ.get('CAM', ROOT + '/ref/car/autohome/camera.json'))); P = np.array([cam[n] for n in NAMES])
d = np.load(os.environ.get('NPZ', ROOT + '/ref/car/autohome/hull.npz')); V, xs, ys, zs = d['V'], d['xs'], d['ys'], d['zs']
V = ndimage.gaussian_filter(V, 1.2)
side = int(sys.argv[1]) if len(sys.argv) > 1 else 1
G = 0.005
gx = np.arange(-1.9, 1.9, G); gy = np.arange(0.28, 1.45, G)
# 車側表面：每個 (x,y) 找最外側 V>0 的 z
from scipy.interpolate import RegularGridInterpolator
Vi = RegularGridInterpolator((xs, ys, zs), V, bounds_error=False, fill_value=-1)
X, Y = np.meshgrid(gx, gy, indexing='ij')
zgrid = zs[::-1] if side > 0 else zs
zsurf = np.full(X.shape, np.nan)
pts = np.stack([X.ravel(), Y.ravel()], -1)
lo = np.zeros(len(pts)); hi = np.full(len(pts), 1.15)
for _ in range(25):  # 二分法找 V=0 的位置（從外往內）
    mid = (lo + hi) / 2
    val = Vi(np.stack([pts[:, 0], pts[:, 1], side * mid], -1))
    inside = val > 0
    lo = np.where(inside, mid, lo); hi = np.where(inside, hi, mid)
zsurf = lo.reshape(X.shape)
ok = zsurf > 0.3
gray = []
views = list(range(5, 20)) if side > 0 else list(range(23, 36)) + [0, 1]
imgs = {}
for i in views:
    im = np.array(Image.open(f'{IMG}/f{i:02d}.png').convert('L')).astype(np.float32)
    imgs[i] = ndimage.gaussian_filter(im, 0.7)
deltas = np.arange(-0.06, 0.241, 0.01)
ref = 12 if side > 0 else 30
PATCH = int(0.16 / G)
scores = np.zeros((len(deltas),) + X.shape)
def sample(i, p):
    u, v, _ = project(p, i, P)
    return ndimage.map_coordinates(imgs[i], [v, u], order=1, cval=np.nan)
def ncc_map(a, b):
    m = np.isfinite(a) & np.isfinite(b)
    a = np.where(m, a, 0); b = np.where(m, b, 0); w = m.astype(float)
    f = lambda x: ndimage.uniform_filter(x, PATCH)
    W = f(w) + 1e-9
    ma, mb = f(a) / W, f(b) / W
    va = f(a * a) / W - ma ** 2; vb = f(b * b) / W - mb ** 2; cab = f(a * b) / W - ma * mb
    return cab / np.sqrt(np.maximum(va, 1e-3) * np.maximum(vb, 1e-3)), va, vb
others = [ref - 4, ref - 3, ref + 3, ref + 4]
for k, dl in enumerate(deltas):
    p = np.stack([X, Y, side * (zsurf - dl)], -1)
    a = sample(ref, p)
    s = 0
    for o in others:
        b = sample(o, p)
        c, va, vb = ncc_map(a, b)
        s = s + np.nan_to_num(c)
    scores[k] = s / len(others)
best = deltas[np.argmax(scores, 0)]
conf = scores.max(0) - np.median(scores, 0)
np.savez_compressed(os.environ.get('SWEEP', ROOT + f'/ref/car/autohome/sweep_{"R" if side > 0 else "L"}.npz'), gx=gx, gy=gy, zsurf=zsurf, best=best, conf=conf, scores=scores, deltas=deltas)
# 印出粗格子的結果
for yy in np.arange(0.35, 1.45, 0.1):
    j = np.argmin(np.abs(gy - yy))
    row = []
    for xx in np.arange(-1.8, 1.81, 0.2):
        i = np.argmin(np.abs(gx - xx))
        row.append('%5.2f' % best[i, j] if conf[i, j] > 0.05 else '   . ')
    print('%.2f' % yy, ' '.join(row), ' zsurf@x0=%.3f' % zsurf[np.argmin(np.abs(gx)), j])
print('x:  ', ' '.join('%5.1f' % x for x in np.arange(-1.8, 1.81, 0.2)))

m = (conf > 0.05) & (gy[None, :] < 0.9) & (np.abs(gx[:, None]) < 1.6) & (zsurf > 0.5)
print('SUMMARY mean-best-ncc %.3f' % scores.max(0)[m].mean(), 'halfwidth p10/p50/p90', np.round(np.percentile((zsurf - best)[m], [10, 50, 90]), 3))
for xx in (-1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6):
    sel = m & (np.abs(gx[:, None] - xx) < 0.2)
    if sel.any(): print('  x %.1f halfwidth %.3f' % (xx, np.median((zsurf - best)[sel])))
