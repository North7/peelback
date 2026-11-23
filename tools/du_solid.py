# 掃描網格 → 在表面撒點 → 體素佔用（膨脹補破洞、填滿內部、再縮回）→ 平滑 → marching cubes → obj
import numpy as np, sys
from scipy import ndimage
from skimage import measure
src, out, vox = sys.argv[1], sys.argv[2], float(sys.argv[3])
d = np.load(src); V, F = d['V'].astype(np.float64), d['F']
A, B, C = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
area = 0.5 * np.linalg.norm(np.cross(B - A, C - A), axis=1)
n = int(min(2.5e7, area.sum() / (vox * vox) * 6))
rng = np.random.default_rng(0)
idx = rng.choice(len(F), n, p=area / area.sum())
r1 = np.sqrt(rng.random(n)); r2 = rng.random(n)
P = (1 - r1)[:, None] * A[idx] + (r1 * (1 - r2))[:, None] * B[idx] + (r1 * r2)[:, None] * C[idx]
lo = P.min(0) - 6 * vox
ijk = np.floor((P - lo) / vox).astype(np.int64)
shape = ijk.max(0) + 7
occ = np.zeros(shape, bool); occ[ijk[:, 0], ijk[:, 1], ijk[:, 2]] = True
occ = ndimage.binary_dilation(occ, iterations=2)
occ = ndimage.binary_fill_holes(occ)
occ = ndimage.binary_erosion(occ, iterations=1)
f = ndimage.gaussian_filter(occ.astype(np.float32), 0.9)
v, fc, _, _ = measure.marching_cubes(f, 0.5)
v = v * vox + lo
with open(out, 'w') as fo:
    for p in v: fo.write('v %.3f %.3f %.3f\n' % tuple(p))
    for a, b, c in fc + 1: fo.write('f %d %d %d\n' % (a, c, b))
print('SOLID', src, 'points', n, 'grid', shape, 'verts', len(v), 'faces', len(fc))
