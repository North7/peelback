# 把 36 張照片的顏色投影到車身的貼圖上（每個格子挑正對它、沒被擋住的照片）
import numpy as np, sys, os, json
from PIL import Image
from scipy import ndimage
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
prep, camp = sys.argv[1], sys.argv[2]
xmid = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
cam = json.load(open(camp)); P = np.array([cam[n] for n in NAMES])
d = np.load(prep + '/bake.npz')
pos, nrm, valid = d['pos'], d['nrm'], d['valid']
R = pos.shape[0]
idx = np.where(valid.ravel())[0]
p = pos.reshape(-1, 3)[idx].astype(np.float64); n = nrm.reshape(-1, 3)[idx].astype(np.float64)
n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
p_h = p.copy(); p_h[:, 0] += xmid  # 回到削形狀時的座標
acc = np.zeros((len(p), 3)); wsum = np.zeros(len(p)); best = np.zeros(len(p)); bestc = np.zeros((len(p), 3))
for i in range(36):
    im = np.array(Image.open(f'{IMG}/f{i:02d}.png').convert('RGBA')).astype(np.float32)
    rgb = im[..., :3] * (im[..., 3:] / 255) + 255 * (1 - im[..., 3:] / 255)
    a = im[..., 3]
    H, W = a.shape
    u, v, zc = project(p_h, i, P)
    # 相機位置（車的座標）→ 視線方向
    f_, D, Hc, pitch, cx, cy, a3, step, ox, oz, roll = P
    al = np.radians(a3 + (i - 3) * step); s_, c_ = np.sin(al), np.cos(al)
    camp_ = np.array([D * c_ + ox, Hc, D * s_ + oz])
    vd = camp_ - p_h; vd /= np.linalg.norm(vd, axis=1, keepdims=True)
    dot = (n * vd).sum(1)
    ui = np.round(u).astype(int); vi = np.round(v).astype(int)
    ok = (ui >= 0) & (ui < W) & (vi >= 0) & (vi < H) & (dot > 0.05)
    zb = np.full((H, W), 1e9, np.float32)
    np.minimum.at(zb, (vi[ok], ui[ok]), zc[ok])
    zb = ndimage.minimum_filter(zb, 5)
    vis = np.zeros(len(p), bool)
    vis[ok] = zc[ok] <= zb[vi[ok], ui[ok]] + 0.015
    alpha_ok = np.zeros(len(p), bool); alpha_ok[ok] = a[vi[ok], ui[ok]] > 250
    m = vis & alpha_ok
    col = np.zeros((len(p), 3)); col[ok] = ndimage.map_coordinates(rgb[..., 0], [v[ok], u[ok]], order=1)[:, None] * [1, 0, 0]
    for c in range(3): col[m, c] = ndimage.map_coordinates(rgb[..., c], [v[m], u[m]], order=1)
    w = np.where(m, np.clip(dot, 0, 1) ** 4, 0)
    acc += col * w[:, None]; wsum += w
    better = m & (dot > best)
    best[better] = dot[better]; bestc[better] = col[better]
    print(i, m.sum(), flush=True)
avg = acc / np.maximum(wsum, 1e-9)[:, None]
for name, arr in (('tex_avg', avg), ('tex_best', bestc)):
    out = np.full((R * R, 3), 255, np.float32); out[idx] = arr
    out = out.reshape(R, R, 3)[::-1]  # 貼圖的 v 往上
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(f'{prep}/{name}.png')
cov = np.zeros(R * R); cov[idx] = best; Image.fromarray((cov.reshape(R, R)[::-1] * 255).astype(np.uint8)).save(prep + '/tex_cov.png')
print('done')
