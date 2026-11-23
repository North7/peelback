# 攝影測量：相鄰照片配對 SIFT 特徵點 → 轉盤相機參數 + 3D 點一起最小平方（bundle adjustment）
import numpy as np, cv2, json, sys, time
from scipy.optimize import least_squares
from scipy.sparse import lil_matrix
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import *
SP = sys.argv[1]
base = json.load(open(ROOT + '/ref/car/autohome/camera.json'))
sift = cv2.SIFT_create(nfeatures=6000, contrastThreshold=0.02)
kps, des = [], []
for i in range(36):
    im = cv2.imread(f'{IMG}/f{i:02d}.png', cv2.IMREAD_UNCHANGED)
    g = cv2.cvtColor(im[..., :3], cv2.COLOR_BGR2GRAY)
    m = (im[..., 3] > 250).astype(np.uint8) * 255
    m = cv2.erode(m, np.ones((9, 9), np.uint8))
    k, d = sift.detectAndCompute(g, m)
    kps.append(np.array([p.pt for p in k], np.float64)); des.append(d)
print('features', [len(k) for k in kps][:6], flush=True)
bf = cv2.BFMatcher(cv2.NORM_L2)
# 配對：相差 1、2 張
pairs = {}
for i in range(36):
    for dj in (1, 2):
        j = (i + dj) % 36
        mm = bf.knnMatch(des[i], des[j], k=2)
        good = [a for a, b in mm if a.distance < 0.75 * b.distance]
        if len(good) < 20: continue
        a = kps[i][[g.queryIdx for g in good]]; b = kps[j][[g.trainIdx for g in good]]
        F, inl = cv2.findFundamentalMat(a, b, cv2.FM_RANSAC, 1.5, 0.999)
        if inl is None: continue
        inl = inl.ravel().astype(bool)
        pairs[(i, j)] = [(good[k].queryIdx, good[k].trainIdx) for k in np.where(inl)[0]]
print('pairs', len(pairs), 'matches', sum(len(v) for v in pairs.values()), flush=True)
# 串成軌跡（union-find）
parent = {}
def find(x):
    while parent.setdefault(x, x) != x:
        parent[x] = parent[parent[x]]; x = parent[x]
    return x
for (i, j), ms in pairs.items():
    for a, b in ms:
        ra, rb = find((i, a)), find((j, b))
        if ra != rb: parent[ra] = rb
tracks = {}
for node in list(parent):
    tracks.setdefault(find(node), []).append(node)
tracks = [t for t in tracks.values() if len(t) >= 3 and len(set(f for f, _ in t)) == len(t)]
print('tracks', len(tracks), 'obs', sum(len(t) for t in tracks), flush=True)
obs_f = np.array([f for t in tracks for f, _ in t]); obs_t = np.array([k for k, t in enumerate(tracks) for _ in t])
obs_uv = np.array([kps[f][k] for t in tracks for f, k in t])
# 初始 3D 點：用目前相機做兩視角三角化（取軌跡第一、最後一個觀測），簡單的線性解
camk = ['f', 'D', 'Hc', 'pitch', 'cx', 'cy', 'a3', 'step', 'ox', 'oz', 'roll']
P0 = np.array([base[n] for n in camk])
def cam_rays(P, f_idx, uv):
    f, D, Hc, pitch, cx, cy, a3, step, ox, oz, roll = P
    al = np.radians(a3 + (f_idx - 3) * step); s, c = np.sin(al), np.cos(al)
    C = np.stack([D * c + ox, np.full_like(al, Hc), D * s + oz], -1)
    u = (uv[:, 0] - cx) / f; v = (uv[:, 1] - cy) / f
    cr, sr = np.cos(-roll), np.sin(-roll)
    u, v = cr * u - sr * v, sr * u + cr * v
    cp, sp = np.cos(pitch), np.sin(pitch)
    # 相機座標的方向 (u, -v, -1) → 轉盤座標：右(1,0,0)、上(0,cp,-sp)、後(0,sp,cp)
    dx = u; dy = -v * cp - (-1) * sp * -1 * 0 + (-v) * 0
    d_t = np.stack([u, -v * cp - sp, v * sp - cp], -1)
    # 轉盤 → 車：(X,Z)->(x,z) = (X s + Z c, -X c + Z s)
    d = np.stack([d_t[:, 0] * s + d_t[:, 2] * c, d_t[:, 1], -d_t[:, 0] * c + d_t[:, 2] * s], -1)
    return C, d / np.linalg.norm(d, axis=1, keepdims=True)
X0 = np.zeros((len(tracks), 3))
for k, t in enumerate(tracks):
    fs = np.array([f for f, _ in t]); uv = np.array([kps[f][i] for f, i in t])
    C, d = cam_rays(P0, fs, uv)
    A = np.zeros((3, 3)); b = np.zeros(3)
    for ci, di in zip(C, d):
        M = np.eye(3) - np.outer(di, di); A += M; b += M @ ci
    X0[k] = np.linalg.solve(A + 1e-9 * np.eye(3), b)
def resid(q):
    P = q[:11]; X = q[11:].reshape(-1, 3)
    u, v, zc = project(X[obs_t], obs_f, P)
    return np.concatenate([u - obs_uv[:, 0], v - obs_uv[:, 1]])
# 檢查投影方程和 cam_rays 一致：初始殘差
q0 = np.concatenate([P0, X0.ravel()])
r0 = resid(q0); print('init rms', np.sqrt(np.mean(r0 ** 2)), 'median', np.median(np.abs(r0)), flush=True)
nobs = len(obs_f)
J = lil_matrix((2 * nobs, len(q0)), dtype=int)
for o in range(nobs):
    for r in (o, nobs + o):
        J[r, :11] = 1
        J[r, 11 + 3 * obs_t[o]: 11 + 3 * obs_t[o] + 3] = 1
# 固定 D（尺度由車長另外定）：讓 D 的範圍很窄
lo = np.full(len(q0), -np.inf); hi = np.full(len(q0), np.inf)
lo[1], hi[1] = P0[1] - 1e-6, P0[1] + 1e-6
t0 = time.time()
for it in range(3):
    s = least_squares(resid, q0, jac_sparsity=J, loss='huber', f_scale=2.0, x_scale='jac', bounds=(lo, hi), max_nfev=60, verbose=0)
    r = s.fun.reshape(2, -1); e = np.hypot(r[0], r[1])
    keep_t = np.ones(len(tracks), bool)
    bad = e > max(4.0, 3 * np.median(e))
    print('iter', it, 'rms', np.sqrt(np.mean(e ** 2)), 'median', np.median(e), 'bad', bad.sum(), round(time.time() - t0), 's', flush=True)
    # 去掉離群觀測（反光會跟著鏡頭移動）
    if bad.sum() == 0: break
    keep = ~bad
    obs_f, obs_t, obs_uv = obs_f[keep], obs_t[keep], obs_uv[keep]
    nobs = len(obs_f)
    J = lil_matrix((2 * nobs, len(q0)), dtype=int)
    for o in range(nobs):
        for rr in (o, nobs + o):
            J[rr, :11] = 1; J[rr, 11 + 3 * obs_t[o]: 11 + 3 * obs_t[o] + 3] = 1
    q0 = s.x
P = s.x[:11]; X = s.x[11:].reshape(-1, 3)
print('CAM', {k: round(float(v), 4) for k, v in zip(camk, P)})
np.savez(SP + '/sfm.npz', P=P, X=X, obs_t=obs_t, obs_f=obs_f)
json.dump({k: float(v) for k, v in zip(camk, P)}, open(SP + '/cam_sfm.json', 'w'), indent=1)
