# 用 36 張輪廓「削」出車身：每個空間點投影到每張照片，取離輪廓邊的距離（公尺）的最小值；>0 就在車裡
import numpy as np, sys, json, time
from scipy import ndimage
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
from skimage import measure

G = float(sys.argv[1]) if len(sys.argv) > 1 else 0.01
import os
cam = json.load(open(os.environ.get('CAM', ROOT + '/ref/car/autohome/camera.json')))
P = np.array([cam[n] for n in NAMES])
t0 = time.time()
sdf = []
for i in range(36):
    m = strip_mirrors(load_sil(i), i, P)
    d = ndimage.distance_transform_edt(m) - ndimage.distance_transform_edt(~m)
    sdf.append(d.astype(np.float32))
H, W = sdf[0].shape
print('sdf', time.time() - t0, flush=True)
xs = np.arange(-2.47, 2.47 + 1e-9, G); ys = np.arange(0.12, 1.72 + 1e-9, G); zs = np.arange(-1.12, 1.12 + 1e-9, G)
V = np.full((len(xs), len(ys), len(zs)), 9.0, np.float32)
Yg, Zg = np.meshgrid(ys, zs, indexing='ij')
for ix, x in enumerate(xs):
    pts = np.stack([np.full(Yg.size, x), Yg.ravel(), Zg.ravel()], -1)
    best = np.full(Yg.size, 9.0, np.float32)
    for i in range(36):
        u, v, zc = project(pts, i, P)
        val = ndimage.map_coordinates(sdf[i], [v, u], order=1, mode='constant', cval=-50)
        best = np.minimum(best, val * zc / P[0])
    V[ix] = best.reshape(Yg.shape)
print('carve', time.time() - t0, flush=True)
np.savez_compressed(os.environ.get('NPZ', ROOT + '/ref/car/autohome/hull.npz'), V=V, xs=xs, ys=ys, zs=zs)
if os.environ.get('NOMESH'): sys.exit(0)
SIG = float(os.environ.get('SIG', '0'))
Vs = ndimage.gaussian_filter(V, SIG / G) if SIG > 0 else V
verts, faces, normals, _ = measure.marching_cubes(Vs, 0.0, spacing=(G, G, G))
verts += np.array([xs[0], ys[0], zs[0]])
print('mesh', len(verts), len(faces), 'bbox', verts.min(0), verts.max(0), flush=True)
with open(os.environ.get('OUT', ROOT + '/ref/car/autohome/hull.obj'), 'w') as f:
    for v in verts: f.write('v %.4f %.4f %.4f\n' % tuple(v))
    for a, b, c in faces + 1: f.write('f %d %d %d\n' % (a, c, b))
print('done', time.time() - t0)
