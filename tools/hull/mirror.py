# 後照鏡：在後照鏡附近用「沒剪掉後照鏡」的輪廓再削一次，減掉車身，剩下的就是後照鏡
import numpy as np, sys, os, json
from scipy import ndimage
from skimage import measure
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
cam = json.load(open(ROOT + '/ref/car/autohome/camera.json')); P = np.array([cam[n] for n in NAMES])
bj = json.load(open(ROOT + '/ref/car/autohome/body.json')); xmid = bj['xmid']
hd = np.load(ROOT + '/ref/car/autohome/hull.npz'); Vb, bxs, bys, bzs = hd['V'], hd['xs'], hd['ys'], hd['zs']
from scipy.interpolate import RegularGridInterpolator
Vbs = ndimage.gaussian_filter(Vb, 1.2)
Vbi = RegularGridInterpolator((bxs, bys, bzs), Vbs, bounds_error=False, fill_value=-1)
sdf = []
for i in range(36):
    m = load_sil(i)
    sdf.append((ndimage.distance_transform_edt(m) - ndimage.distance_transform_edt(~m)).astype(np.float32))
G = 0.004
out = []
for s in (1, -1):
    xs = np.arange(0.58, 0.95, G) + xmid; ys = np.arange(0.9, 1.3, G); zs = s * np.arange(0.6, 1.16, G)
    X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
    pts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], -1)
    best = np.full(len(pts), 9.0)
    for i in range(36):
        u, v, zc = project(pts, i, P)
        best = np.minimum(best, ndimage.map_coordinates(sdf[i], [v, u], order=1, cval=-50) * zc / P[0])
    Vm = best.reshape(X.shape)
    body = Vbi(pts).reshape(X.shape)
    # 後照鏡 = 削出來的形狀，扣掉車身往外 4 mm 的範圍
    Vm = np.minimum(Vm, -(body + 0.004))
    Vm = ndimage.gaussian_filter(Vm, 0.8)
    # 只留最大的一塊
    lab, n = ndimage.label(Vm > 0)
    if n == 0: continue
    sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1)); keep = 1 + int(np.argmax(sizes))
    Vm = np.where(lab == keep, Vm, np.minimum(Vm, -0.001))
    v, f, _, _ = measure.marching_cubes(Vm, 0.0, spacing=(G, G, G * s))
    v += np.array([xs[0] - xmid, ys[0], zs[0]])
    if s < 0: f = f[:, ::-1]
    out.append((v, f))
    print('mirror side', s, 'verts', len(v), 'bbox', v.min(0).round(3), v.max(0).round(3), 'components', n)
with open(ROOT + '/ref/car/autohome/mirrors.obj', 'w') as fo:
    off = 1
    for v, f in out:
        for p in v: fo.write('v %.4f %.4f %.4f\n' % tuple(p))
        for a, b, c in f + off: fo.write('f %d %d %d\n' % (a, c, b))
        off += len(v)
