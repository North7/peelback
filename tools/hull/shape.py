# 削好的形狀（hull.npz）→ 車身：平滑、挖輪拱、切車底、補上照片看不到的前後上緣圓角，輸出 body.obj
import numpy as np, sys, os, json
from scipy import ndimage
from skimage import measure
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import ROOT
d = np.load(os.environ.get('HULL', ROOT + '/ref/car/autohome/hull.npz'))
V, xs, ys, zs = d['V'], d['xs'], d['ys'], d['zs']
G = xs[1] - xs[0]
SIG = float(os.environ.get('SIG', '0.012'))
V = ndimage.gaussian_filter(V, SIG / G)
# 兩個區域再加強平滑：車頭正面（燈和進氣口在側面輪廓留下的橫紋）、後照鏡底座（剪掉後照鏡留下的凹凸）
_X, _Y, _Z = np.meshgrid(xs, ys, zs, indexing='ij')
_xin = xs[(V > 0).any((1, 2))]; _xm = (_xin.min() + _xin.max()) / 2; _xr = _X - _xm
zone = ((_xr > 1.85) & (_Y > 0.3) & (_Y < 0.72)) | ((_xr > 0.45) & (_xr < 1.15) & (_Y > 0.92) & (_Y < 1.3) & (np.abs(_Z) > 0.6))
w = ndimage.gaussian_filter(zone.astype(np.float32), 0.04 / G)
V = V * (1 - w) + ndimage.gaussian_filter(V, 0.03 / G) * w
del _X, _Y, _Z, _xr, zone, w
# 玩具版：把稜角「銳化」（形狀減掉它自己的模糊版，凸的稜更凸），去掉充氣感
SHARP = float(os.environ.get('SHARP', '0'))
if SHARP > 0:
    V = V + SHARP * (V - ndimage.gaussian_filter(V, 0.06 / G))
# 車側：用多張照片細節對齊量到的位置（sweep_R/L）把中段多出來的寬度削掉
from scipy.interpolate import RegularGridInterpolator
num = 0; den = 0
for S in 'RL':
    sw = np.load(ROOT + f'/ref/car/autohome/sweep_{S}.npz')
    gx, gy, zsf, best, conf = sw['gx'], sw['gy'], sw['zsurf'], sw['best'], sw['conf']
    corr = zsf - best
    w = np.clip(conf - 0.05, 0, None) * (zsf > 0.5) * (corr > 0.6)
    num = num + ndimage.gaussian_filter(corr * w, (0.25 / 0.005, 0.08 / 0.005)); den = den + ndimage.gaussian_filter(w, (0.25 / 0.005, 0.08 / 0.005))
Wmap = np.where(den > 0.02, num / np.maximum(den, 1e-9), 9.0)
Wmap[:, sw['gy'] > 1.32] = 9.0
# 下半部（門檻、輪拱高度）特徵少：每一直行往下沿用最低的可靠值，左右沒值的直行用旁邊內插
gyv = sw['gy']
for i in range(Wmap.shape[0]):
    ok = np.where((Wmap[i] < 9) & (gyv < 0.95))[0]
    if len(ok): Wmap[i, :ok[0]] = Wmap[i, ok[0]]
low = gyv < 0.95
for j in np.where(low)[0]:
    col = Wmap[:, j]; ok = col < 9
    if ok.sum() > 2:
        xi = sw['gx']; inside = (xi > xi[ok].min()) & (xi < xi[ok].max())
        col[inside & ~ok] = np.interp(xi[inside & ~ok], xi[ok], col[ok])
# 往下延伸到地面（車側最下面那段沿用 0.3 m 的寬度）
j0 = np.argmin(np.abs(sw['gy'] - 0.32))
# 量到的寬度有雜訊，烤漆反光會照出一道道波浪：再做大範圍平滑（前後 35 公分、上下 12 公分）
ok = Wmap < 9
Wsm = ndimage.gaussian_filter(np.where(ok, Wmap, 0), (0.35 / 0.005, 0.12 / 0.005)) / np.maximum(ndimage.gaussian_filter(ok.astype(float), (0.35 / 0.005, 0.12 / 0.005)), 1e-6)
Wmap = np.where(ok, Wsm, 9.0)
Wi = RegularGridInterpolator((sw['gx'], sw['gy']), Wmap, bounds_error=False, fill_value=9.0)
Xh, Yh = np.meshgrid(xs, ys, indexing='ij')
Wxy = Wi(np.stack([Xh, np.maximum(Yh, sw['gy'][j0])], -1))
Wxy = np.where(Yh > 1.32, 9.0, Wxy)
V = np.minimum(V, Wxy[:, :, None] - np.abs(zs)[None, None, :])
print('side clamp applied; median W in mid', np.median(Wxy[(np.abs(Xh) < 1) & (Yh > 0.4) & (Yh < 0.8)]))
# 車長中點對齊原點（照片轉盤中心不一定在車子正中間）
occ = V > 0
xin = xs[occ.any((1, 2))]
xmid = (xin.min() + xin.max()) / 2
zin = zs[occ.any((0, 1))]
print('hull x', xin.min(), xin.max(), 'len', xin.max() - xin.min(), 'z', zin.min(), zin.max())
X, Y, Z = np.meshgrid(xs - xmid, ys, zs, indexing='ij')
LENh = xin.max() - xin.min()
t = LENh / 2 - X  # 離車頭多遠
AX_F = LENh / 2 - 0.889; AX_R = AX_F - 2.89; RW = 0.356
cfg = json.load(open(os.environ['CFG'])) if os.environ.get('CFG') else {}
RA = cfg.get('RA', 0.425); WELL = cfg.get('WELL', 0.6)
# 輪拱：圓心在輪心，|z| > WELL 的地方挖掉
for ax in (AX_F, AX_R):
    r = np.sqrt((X - ax) ** 2 + (Y - RW) ** 2)
    V = np.minimum(V, np.maximum(r - RA, WELL - np.abs(Z)))
# 車底
V = np.minimum(V, Y - cfg.get('FLOOR', 0.17))
# 前後上緣往兩側圓下去（水平拍的照片看不到這個弧度）
top0 = np.zeros(len(xs))
iz0 = np.argmin(np.abs(zs))
for i in range(len(xs)):
    c = V[i, :, iz0]
    col = np.where(c > 0)[0]
    if not len(col): continue
    k = col.max()
    top0[i] = ys[k] + (G * c[k] / (c[k] - c[k + 1]) if k + 1 < len(c) else 0)  # 線性內插到 0
w0 = (top0 > 0).astype(float)
top0 = np.where(w0 > 0, ndimage.gaussian_filter1d(top0 * w0, 2) / np.maximum(ndimage.gaussian_filter1d(w0, 2), 1e-6), 0)
TOP = top0[:, None, None]
def smooth01(u): u = np.clip(u, 0, 1); return u * u * (3 - 2 * u)
FA, FT, FZ = cfg.get('FA', 0.10), cfg.get('FT', 1.25), cfg.get('FZ', 0.42)
RAa, RT, RZ = cfg.get('RA2', 0.08), cfg.get('RT', 0.55), cfg.get('RZ', 0.5)
wz = np.abs(Z)
dropF = FA * np.clip(1 - t / FT, 0, 1) ** 1.3 * smooth01((wz - FZ) / (0.97 - FZ)) ** 1.6
dropR = RAa * np.clip(1 - (LENh - t) / RT, 0, 1) ** 1.3 * smooth01((wz - RZ) / (0.97 - RZ)) ** 1.6
V = np.minimum(V, TOP - dropF - dropR - Y)
verts, faces, normals, _ = measure.marching_cubes(V, 0.0, spacing=(G, G, G))
verts += np.array([xs[0] - xmid, ys[0], zs[0]])
out = os.environ.get('OUT', ROOT + '/ref/car/autohome/body.obj')
with open(out, 'w') as f:
    for v in verts: f.write('v %.4f %.4f %.4f\n' % tuple(v))
    for a, b, c in faces + 1: f.write('f %d %d %d\n' % (a, c, b))
json.dump({'xmid': float(xmid), 'len': float(LENh), 'AX_F': float(AX_F), 'AX_R': float(AX_R)}, open(out.replace('.obj', '.json'), 'w'))
print('verts', len(verts), 'len', LENh, 'out', out)
