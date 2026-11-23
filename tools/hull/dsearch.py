# 找相機距離 D：每個候選 D 重新調其他參數（輪廓一致）、把車長定成 4.79，
# 再看車側細節在不同照片間對不對得起來（越一致越對）
import numpy as np, sys, json, time, subprocess, os
from scipy import ndimage
from scipy.optimize import minimize
sys.path.insert(0, __file__.rsplit('/', 1)[0])
import common
from common import *
SP = sys.argv[1]
Ds = [float(x) for x in sys.argv[2].split(',')]
base = json.load(open(ROOT + '/ref/car/autohome/camera.json'))
SC = 4
sils = [strip_mirrors(load_sil(i), i, np.array([base[n] for n in NAMES])) for i in range(36)]
from PIL import Image
sils = [np.array(Image.fromarray(s.astype(np.uint8) * 255).resize((500, 333), Image.BILINEAR)) > 127 for s in sils]
sild = [ndimage.binary_dilation(s, iterations=1) for s in sils]
H, W = sils[0].shape
G = 0.03
xs = np.arange(-2.6, 2.6, G); ys = np.arange(0.25, 1.75, G); zs = np.arange(-1.2, 1.2, G)
X, Y, Z = np.meshgrid(xs, ys, zs, indexing='ij')
PTS = np.stack([X.ravel(), Y.ravel(), Z.ravel()], -1)
def carve(P, pts):
    alive = np.ones(len(pts), bool)
    for i in range(36):
        u, v, _ = project(pts[alive], i, P, SC)
        ui = np.round(u).astype(int); vi = np.round(v).astype(int)
        ok = (ui >= 0) & (ui < W) & (vi >= 0) & (vi < H)
        ins = np.zeros(len(ui), bool); ins[ok] = sild[i][vi[ok], ui[ok]]
        idx = np.where(alive)[0]; alive[idx[~ins]] = False
    return alive
def score(P):
    alive = carve(P, PTS); pts = PTS[alive]
    ious = []
    for i in range(36):
        u, v, _ = project(pts, i, P, SC)
        ui = np.round(u).astype(int); vi = np.round(v).astype(int)
        ok = (ui >= 0) & (ui < W) & (vi >= 0) & (vi < H)
        r = np.zeros((H, W), bool); r[vi[ok], ui[ok]] = True
        r = ndimage.binary_closing(ndimage.binary_dilation(r, iterations=1), iterations=2)
        _, vc, _ = project(np.array([[0, 0.4, 0]]), i, P, SC)
        cut = int(vc[0]) - 6
        s = sils[i][:cut]; rr = r[:cut]
        ious.append((s & rr).sum() / max(1, (s | rr).sum()))
    return 1 - np.mean(ious), pts
res = {}
for D in Ds:
    t0 = time.time()
    p = dict(base); p['f'] = base['f'] / base['D'] * D; p['D'] = D
    keys = ['Hc', 'pitch', 'cx', 'cy', 'a3', 'step', 'ox', 'oz']
    scl = np.array([0.1, 0.01, 5, 5, 1, 0.05, 0.03, 0.03])
    def obj(q):
        pp = dict(p); pp.update({k: p[k] + q[j] * scl[j] for j, k in enumerate(keys)})
        return score(np.array([pp[n] for n in NAMES]))[0]
    r = minimize(obj, np.zeros(len(keys)), method='Powell', options={'maxfev': 220, 'xtol': 1e-2, 'ftol': 1e-4})
    p.update({k: p[k] + r.x[j] * scl[j] for j, k in enumerate(keys)})
    # 用車長定比例
    for it in range(2):
        P = np.array([p[n] for n in NAMES])
        _, pts = score(P)
        L = pts[:, 0].max() - pts[:, 0].min() + G
        p['f'] *= L / 4.79
    print('D', D, 'iou-loss', round(r.fun, 4), 'L', round(L, 3), {k: round(p[k], 4) for k in NAMES}, round(time.time() - t0), 's', flush=True)
    json.dump(p, open(f'{SP}/cam_D{int(D)}.json', 'w'))
    res[D] = p
