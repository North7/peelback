# 沿著門縫把車身精確切成零件：每個零件是一個連續的「在裡面多少」場（>0 在裡面），
# 依序把三角形沿著場=0 的線切開（不是整個三角形分），邊緣才會是乾淨的線。
# 用法：split.py prep_dir out_dir
import numpy as np, sys, json, os
from matplotlib.path import Path
from scipy.spatial import cKDTree
prep, outdir = sys.argv[1], sys.argv[2]
m = np.load(prep + '/mesh.npz')
P0, N0, UV0, T0, G0 = m['pos'].astype(np.float64), m['nor'].astype(np.float64), m['uv'].astype(np.float64), m['tris'], m['glass']
bj = json.load(open(os.path.join(os.path.dirname(prep), 'body.json')))
AXF, AXR = bj['AX_F'], bj['AX_R']

# ---- 量好的線（車身座標，未對齊規格前） ----
WIN = [(0.97, 1.10), (0.9, 1.19), (0.8, 1.305), (0.7, 1.386), (0.6, 1.44), (0.4, 1.498), (0.2, 1.528), (0.0, 1.545), (-0.3, 1.548), (-0.6, 1.538),
       (-1.0, 1.51), (-1.2, 1.484), (-1.4, 1.434), (-1.52, 1.38), (-1.58, 1.345), (-1.5, 1.27), (-1.4, 1.218), (-1.0, 1.177), (-0.6, 1.15),
       (-0.2, 1.13), (0.2, 1.116), (0.6, 1.105), (0.85, 1.09)]
WP = Path(WIN)
wseg = np.concatenate([np.linspace(a, b, 80) for a, b in zip(WIN, WIN[1:] + WIN[:1])])
wkd = cKDTree(wseg)
BOT = [(x, y) for x, y in WIN[15:]] + [WIN[0]]  # 窗戶下緣（由後往前）
bx = np.array([p[0] for p in BOT]); by = np.array([p[1] for p in BOT])
def belt(x): return np.interp(x, bx, by)
BZ = [0, 0.45, 0.55, 0.65, 0.75, 0.85, 0.9]
def bar_up(az): return np.interp(az, BZ, [0.765, 0.765, 0.775, 0.795, 0.82, 0.845, 0.85])
def zg(x): return np.interp(x, [-2.25, -2.05, -1.9, 0.6, 0.98], [0.46, 0.56, 0.6, 0.61, 0.70])
def win_sd(x, y):
    d, _ = wkd.query(np.stack([x, y], -1))
    inside = WP.contains_points(np.stack([x, y], -1))
    return np.where(inside, d, -d)
mn = lambda *a: np.minimum.reduce(np.broadcast_arrays(*a))
mx = lambda *a: np.maximum.reduce(np.broadcast_arrays(*a))

def fields(P, N):
    x, y, z = P[:, 0], P[:, 1], P[:, 2]; az = np.abs(z)
    nx, ny, nz = N[:, 0], N[:, 1], N[:, 2]; anz = np.abs(nz)
    rr = np.minimum(np.hypot(x - AXF, y - 0.356), np.hypot(x - AXR, y - 0.356))
    cowl = 0.985 - 0.09 * (az / 0.7) ** 2
    top = mn(ny - 0.12, y - 1.06, zg(x) - az, cowl - x)
    win = mn(win_sd(x, y), anz - 0.3)
    F = {}
    F['windshield'] = mn(top, x - 0.25)
    F['roof'] = mn(top, 0.25 - x, x + 1.12)
    F['liftgate'] = mx(mn(top, -1.12 - x),
                       mn(-1.75 - x, y - 0.995, 0.79 - az, mx(-nx - 0.15, ny - 0.25)),
                       mn(-1.12 - x, 0.995 - y, y - 0.6, 0.60 - az, -nx - 0.3),
                       mn(-1.85 - x, y - 1.12, 0.79 - az))
    lowF = mn(anz - 0.3, y - 0.205, belt(x) + 0.02 - y, x + 0.20, 0.94 - x)
    lowR = mn(anz - 0.3, y - 0.205, belt(x) + 0.02 - y, -0.20 - x, x + 1.24, rr - 0.445)
    for s, tag in ((1, 'R'), (-1, 'L')):
        sd = s * z - 0.3
        F['doorF' + tag] = mn(mx(mn(win, x + 0.30), lowF), sd)
        F['doorR' + tag] = mn(mx(mn(win, -0.30 - x, x + 1.155), lowR), sd)
    F['hood'] = mn(ny - 0.2, x - (cowl - 0.02), y - (bar_up(az) + 0.004), np.interp(x, [0.98, 2.0, 2.4], [0.70, 0.86, 0.9]) - az)
    F['front'] = mx(mn(x - AXF - 0.02, bar_up(az) + 0.004 - y, rr - 0.43), mn(x - 2.0, bar_up(az) + 0.004 - y))
    F['rear'] = mx(mn(AXR - 0.02 - x, 0.62 - y, rr - 0.43), mn(-2.0 - x, 0.62 - y))
    return F
ORDER = ['windshield', 'roof', 'liftgate', 'doorFR', 'doorRR', 'doorFL', 'doorRL', 'hood', 'front', 'rear']

def cut(P, N, UV, T, s):
    """沿 s=0 切三角形：回傳 (s>=0 的三角形, s<0 的三角形)，新的頂點加在後面"""
    S = s[T]; pos = S >= 0
    allp = pos.all(1); alln = (~pos).all(1); mix = ~(allp | alln)
    A = [T[allp]]; B = [T[alln]]
    P2, N2, U2 = [P], [N], [UV]; nv = len(P)
    newP, newN, newU = [], [], []
    def add(i, j):
        nonlocal nv
        t = s[i] / (s[i] - s[j])
        newP.append(P[i] + (P[j] - P[i]) * t); n = N[i] + (N[j] - N[i]) * t; newN.append(n / (np.linalg.norm(n) + 1e-12)); newU.append(UV[i] + (UV[j] - UV[i]) * t)
        nv += 1
        return nv - 1
    for tri, sg in zip(T[mix], pos[mix]):
        # 找出和另外兩個不同邊的那一個點
        k = [i for i in range(3) if sg[i] != sg[(i + 1) % 3] and sg[i] != sg[(i + 2) % 3]][0]
        a, b, c = tri[k], tri[(k + 1) % 3], tri[(k + 2) % 3]
        pab = add(a, b); pac = add(a, c)
        lone = [[a, pab, pac]]; other = [[pab, b, c], [pab, c, pac]]
        (A if sg[k] else B).append(np.array(lone))
        (B if sg[k] else A).append(np.array(other))
    if newP:
        P = np.vstack([P, np.array(newP)]); N = np.vstack([N, np.array(newN)]); UV = np.vstack([UV, np.array(newU)])
    A = np.vstack([a.reshape(-1, 3) for a in A]); B = np.vstack([b.reshape(-1, 3) for b in B])
    return P, N, UV, A, B

def split_all(P, N, UV, T):
    out = {}
    rest = T
    for name in ORDER:
        F = fields(P, N)
        P, N, UV, A, rest = cut(P, N, UV, rest, F[name])
        out[name] = A
    out['body'] = rest
    return P, N, UV, out

# 尺寸對齊規格：車長 4.79（x、z 同比例）、車高 1.624
LEN = P0[:, 0].max() - P0[:, 0].min(); TOP = P0[:, 1].max()
SXZ, SY = 4.79 / LEN, 1.624 / TOP
print('len', LEN, 'top', TOP, 'scale', SXZ, SY)
blob = bytearray(); meta = {'scale': [SXZ, SY], 'AX_F': AXF * SXZ, 'AX_R': AXR * SXZ, 'groups': []}
def align(n):
    while len(blob) % n: blob.append(0)
def emit(part, mat, P, N, UV, T, lift=0.0):
    if len(T) == 0: return
    used = np.unique(T); remap = np.full(len(P), -1, np.int64); remap[used] = np.arange(len(used))
    p = P[used] + N[used] * lift; p = p * np.array([SXZ, SY, SXZ]); n = N[used]; uv = UV[used]; idx = remap[T].ravel()
    g = {'part': part, 'mat': mat, 'nv': len(p), 'ni': len(idx)}
    align(4); g['pos'] = len(blob); blob.extend(p.astype(np.float32).tobytes())
    g['nor'] = len(blob); blob.extend(np.clip(np.round(n * 127), -127, 127).astype(np.int8).tobytes())
    align(4); g['uv'] = len(blob); blob.extend(np.clip(np.round(uv * 65535), 0, 65535).astype(np.uint16).tobytes())
    align(4)
    if len(p) < 65536: g['idx16'] = len(blob); blob.extend(idx.astype(np.uint16).tobytes())
    else: g['idx'] = len(blob); blob.extend(idx.astype(np.uint32).tobytes())
    meta['groups'].append(g)
    print('%-10s %-6s verts %6d tris %6d' % (part, mat, len(p), len(idx) // 3))
for mat, sel, lift in (('paint', np.ones(len(T0), bool), 0.0), ('glass', G0, 0.002)):
    P, N, UV, parts = split_all(P0.copy(), N0.copy(), UV0.copy(), T0[sel])
    for name, T in parts.items(): emit(name, mat, P, N, UV, T, lift)
open(outdir + '/body.bin', 'wb').write(bytes(blob))
json.dump(meta, open(outdir + '/body.json', 'w'), indent=1)
print('bytes', len(blob))
