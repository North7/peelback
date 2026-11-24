# 飛機：Sketchfab 下載的 A350-1000 外殼（Newbie99999993，CC BY）、Trent XWB 引擎（hakai315，CC BY）、
# A350-1000 起落架（N.S STUDIOS，CC BY）→ 剝剝看的零件網格（plane/sk/plane.bin + plane.json）
# 機身還是用程式畫（塗裝、窗戶燈、拆成上蓋／兩面牆／肚子都靠它），但每一站的寬、高照這個外殼量出來（STATIONS）。
# 座標：x 往機頭、y 往上、z 往右翼，地面 y=0，機頭在 x=+LEN/2。
# 用法：Blender -b -P tools/plane_export.py -- ref/sk_new plane/sk [debug_prefix]
import bpy, sys, os, json, zlib
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
dbg = argv[2] if len(argv) > 2 else None
LEN = 73.79
GROUND = 9.73   # 外殼模型裡地面的高度（輪子最低點）

def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']

def dec(o, target):
    """面太多的先減面（引擎內部、輪胎螺絲這些細節在畫面上看不出差別）"""
    n = len(o.data.polygons)
    if n <= target: return
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = target / n
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=m.name)

def comps(o, tf):
    """一個網格拆成連通塊：[(P[n,3] 轉好的座標, T[m,3])]"""
    me = o.data
    me.calc_loop_triangles()
    M = o.matrix_world
    co = np.array([list(M @ v.co) for v in me.vertices]) if len(me.vertices) else np.zeros((0, 3))
    P = tf(co)
    tv = np.array([list(t.vertices) for t in me.loop_triangles], np.int64).reshape(-1, 3)
    parent = np.arange(len(co))
    def find(a):
        r = a
        while parent[r] != r: r = parent[r]
        while parent[a] != r: parent[a], a = r, parent[a]
        return r
    for e in me.edges:
        a, b = find(e.vertices[0]), find(e.vertices[1])
        if a != b: parent[a] = b
    roots = np.array([find(i) for i in range(len(co))])
    out = []
    if not len(tv): return out
    for r in np.unique(roots[tv[:, 0]]):
        T = tv[roots[tv[:, 0]] == r]
        used = np.unique(T)
        remap = np.full(len(P), -1); remap[used] = np.arange(len(used))
        out.append((P[used], remap[T]))
    return out

groups = {}
def add(part, mk, P, T, tag=''):
    groups.setdefault((part, mk, tag), []).append((P.astype(np.float32), T))

# ================= 外殼 =================
obs = load(os.path.join(src, 'plane_shell', 'scene.gltf'))
shell_tf = lambda co: np.stack([co[:, 0], co[:, 2] - GROUND, -co[:, 1]], -1)
SKIP = {'Object_8', 'Object_11', 'Object_14', 'Object_17', 'Object_20', 'Object_31'}  # 引擎、起落架換別的模型；細線不要
fuse = []
FUSE_COMPS = []
seen = set()
pieces = []
for o in obs:
    if o.name in SKIP: continue
    for P, T in comps(o, shell_tf):
        mn, mx = P.min(0), P.max(0)
        key = (len(P), *np.round(mn, 2), *np.round(mx, 2))
        if key in seen: continue  # 重複疊在一起的面
        seen.add(key)
        if o.name == 'Object_28':
            add('nose', 'glass', P, T, 'C|glass'); continue
        if mx[0] - mn[0] > 60: fuse.append(P); FUSE_COMPS.append((P, T)); continue
        pieces.append((P, T, mn, mx, (mn + mx) / 2, len(P), o.name))

# 機頭（離機頭 6.4 公尺內）、機尾（66 公尺以後）：直接用外殼，切口用平面切乾淨
import bmesh
def cut(P, T, x0, keep_front):
    bm = bmesh.new()
    vs = [bm.verts.new(tuple(p)) for p in P]
    for t in T:
        try: bm.faces.new((vs[t[0]], vs[t[1]], vs[t[2]]))
        except ValueError: pass
    geom = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geom, plane_co=(x0, 0, 0), plane_no=(1, 0, 0), clear_inner=keep_front, clear_outer=not keep_front)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.index_update()
    Q = np.array([list(v.co) for v in bm.verts], np.float32)
    F = np.array([[v.index for v in f.verts] for f in bm.faces], np.int64).reshape(-1, 3)
    bm.free()
    return Q, F

# 機身每一站的寬高（給程式畫的機身用）
FP = np.concatenate(fuse)
NOSE_X = float(FP[:, 0].max())
TAIL_X = float(FP[:, 0].min())
st = []
for t in list(np.arange(0, 8, 0.4)) + list(np.arange(8, 52, 2)) + list(np.arange(52, LEN - 0.5, 0.8)) + [LEN - 0.15]:
    x = NOSE_X - t
    sel = FP[np.abs(FP[:, 0] - x) < 0.25]
    if len(sel) < 6: continue
    y0, y1 = sel[:, 1].min(), sel[:, 1].max()
    st.append([round(float(t), 2), round(float(np.abs(sel[:, 2]).max()), 3), round(float((y1 - y0) / 2), 3), round(float((y1 + y0) / 2), 3)])
CY = float(np.median([s[3] for s in st if 12 < s[0] < 45]))
for s in st: s[3] = round(s[3] - CY, 3)
print('NOSE_X', NOSE_X, 'TAIL_X', TAIL_X, 'CY', CY)
for P, T in FUSE_COMPS:
    side = 'R' if P[:, 2].mean() > 0 else 'L'
    Q, F = cut(P, T, NOSE_X - 5.9, True)
    if len(F): add('noseSkin', 'skin', Q, F, side + '|skin')
    Q, F = cut(P, T, NOSE_X - 66.0, False)
    if len(F): add('tailSkin', 'skin', Q, F, side + '|skin')

# 機翼後緣：每個 |z| 的最小 x（拿最大的那兩塊機翼量）
wing_main = [p for p in pieces if p[5] > 800 and 2.9 < abs(p[4][2]) < 30 and p[3][0] - p[2][0] > 15]
WP = np.concatenate([p[0] for p in wing_main])
def te(z):
    sel = WP[np.abs(np.abs(WP[:, 2]) - abs(z)) < 0.6]
    return sel[:, 0].min() if len(sel) else -99
def le(z):
    sel = WP[np.abs(np.abs(WP[:, 2]) - abs(z)) < 0.6]
    return sel[:, 0].max() if len(sel) else 99

info = []
def mirror_add(part, mk, P, T, tag=''):
    """右邊那一份當標準，左邊用鏡射（原模型左翼歪了一點）。tag 前面加 R| 或 L|"""
    add(part, mk, P, T, 'R|' + tag)
    Q = P.copy(); Q[:, 2] *= -1
    add(part, mk, Q, T[:, ::-1].copy(), 'L|' + tag)

for P, T, mn, mx, c, nv, oname in pieces:
    az = abs(c[2]); sz = mx - mn; Z = c[2]
    if Z < -0.7: continue          # 左邊：等一下用右邊鏡射
    part, tag = None, ''
    if nv == 2340: part = 'pylon'
    elif c[0] < -22 and az < 0.7 and c[1] > 8.6:
        part = 'rudder' if mn[0] < -36 and mx[0] < -30 else 'fin'
    elif c[0] < -25 and az >= 0.7 and c[1] < 9.5:
        part = 'elevator' if (mx[0] < -31.5 and sz[2] > 5 and nv < 20) else 'stab'
    elif az > 29.3 and c[1] > 5: part = 'winglets'
    elif az < 3.7 and c[1] < 6.2 and -9 < c[0] < 10: part = 'belly'
    elif 2.9 < az < 30.5 and -15 < c[0] < 13 and c[1] > 2.5:
        if 5 < c[0] < 8 and mn[1] < 2: part = None                       # 原本引擎的反推力罩：換成 Trent
        elif mx[1] < 4.9 and az < 6: part = None                         # 原本主起落架的支柱
        elif nv > 800 and sz[0] > 15: part = 'wings'
        elif nv in (499, 85, 19) and sz[0] < 2.5: part = 'fairings'        # 襟翼滑軌整流罩
        elif mx[0] < -5.5 and mn[0] > -10.7 and az > 20.3: part = 'ailerons'
        elif mx[0] < -0.9 and mn[0] > -7 and 3 < mn[2] and mx[2] < 20.3 and sz[1] < 1.7: part = 'flaps'
        elif mn[0] > 4.6 and az < 10.2 and c[1] > 4.2: part = 'slats'
        else: part = 'wings'
    elif c[0] > 30 and mx[1] < 3.7: part = None                           # 原本的鼻輪
    elif c[0] < -33.5 and az < 0.7 and 5.5 < c[1] < 9.5: part = 'tailcone'      # 機尾尖端（輔助動力排氣口）
    elif az < 0.7 and (sz[0] > 0.6 or sz[1] > 0.6): part = 'antennas'
    else: part = None
    info.append(part)
    if part is None: continue
    if part == 'flaps': tag = 'in' if mx[2] < 11 else 'out'
    if az < 0.7: add(part, 'shell', P, T, 'C|' + tag)
    else: mirror_add(part, 'shell', P, T, tag)

# 機翼每一站的前緣、後緣、高度（給油箱、翼尖燈、擾流板用）：用平面去切三角形
def slice_z(lst, z0):
    pts = []
    for P, T in lst:
        A, B, C = P[T[:, 0]], P[T[:, 1]], P[T[:, 2]]
        for U, V in ((A, B), (B, C), (C, A)):
            d0, d1 = U[:, 2] - z0, V[:, 2] - z0
            m = (d0 * d1) < 0
            if not m.any(): continue
            t = d0[m] / (d0[m] - d1[m])
            pts.append(U[m] + (V[m] - U[m]) * t[:, None])
    return np.concatenate(pts) if pts else np.zeros((0, 3))
WLST = [(P, T) for (part, mk, tag), lst in groups.items() if part in ('wings', 'flaps', 'ailerons', 'slats') and tag.startswith('R') for P, T in lst]
WING = []
for z in np.arange(3.0, 30.45, 0.5):
    sel = slice_z(WLST, z)
    if len(sel) < 4: continue
    le, te = sel[:, 0].max(), sel[:, 0].min()
    near = sel[sel[:, 0] > le - 0.3]
    WING.append([round(float(z), 2), round(float(le), 3), round(float(te), 3), round(float(near[:, 1].mean()), 3), round(float(sel[:, 1].max()), 3), round(float(sel[:, 1].min()), 3)])

print('PARTS', {k: sum(1 for p in info if p == k) for k in set(info)})

# ---- 主輪艙那一段的機腹整流罩：下載的模型在這裡缺了好幾塊（只剩斜板掛著，網頁上像一片白布垂下來）。
# 真的 A350 整流罩是一整塊凸出來的殼：每 0.25 公尺切一刀，取整流罩＋機身在那一刀的點，做「下緣凸包」（像用保鮮膜從外面包起來），
# 一段一段接成一整片平滑的外殼，缺的洞和掛著的板子都包在裡面。外推 1.5 公分蓋在原本的面上面。
from mathutils.bvhtree import BVHTree
HULL_LST = [(P, T) for (part, mk, tag), lst in groups.items() if part == 'belly' for P, T in lst] + FUSE_COMPS
stt = np.array(st)
HP = np.concatenate([P[np.unique(T)] for P, T in HULL_LST])
HP = HP[HP[:, 1] < CY - 0.8]
def lower_env(pts):
    """pts: (z, y)。回傳 y(z) 的下緣凸包（z 由小到大）"""
    pts = sorted(set(map(tuple, np.round(pts, 4))))
    h = []
    for p in pts:
        while len(h) >= 2 and (h[-1][0] - h[-2][0]) * (p[1] - h[-2][1]) - (h[-1][1] - h[-2][1]) * (p[0] - h[-2][0]) <= 0: h.pop()
        h.append(p)
    return np.array(h)
ZCAP = 3.3
# 範圍＝翼根那一段（z = 3 那一刀的前緣到後緣）
WP_ALL = np.concatenate([P[np.unique(T)] for (part, mk, tag), lst in groups.items() if part in ('wings', 'slats', 'flaps') and tag.startswith('R') for P, T in lst])
WR = WP_ALL[(WP_ALL[:, 2] > 2.5) & (WP_ALL[:, 2] < ZCAP)]
T0, T1 = NOSE_X - WR[:, 0].max() + 0.3, NOSE_X - WR[:, 0].min() - 0.3
# 用三角形直接切出翼根的剖面（頂點太疏，有的刀抓不到機翼下表面）
ROOT_CUTS = [(zc, slice_z(WLST, zc)) for zc in (2.9, 3.1, 3.3)]
NS = 48
# 整段整流罩：前後端照下載模型的整流罩（機腹那一大片）
BELLY_P = np.concatenate([P[np.unique(T)] for (part, mk, tag), lst in groups.items() if part == 'belly' for P, T in lst])
BELLY_P = BELLY_P[BELLY_P[:, 1] < CY - 0.8]
T0, T1 = NOSE_X - BELLY_P[:, 0].max() + 0.3, NOSE_X - BELLY_P[:, 0].min() - 0.3
HULL_T = np.arange(T0, T1 + 1e-6, 0.25)
SL = []
for t in HULL_T:
    x = NOSE_X - t
    sel = HP[np.abs(HP[:, 0] - x) < 0.35]
    zy = np.stack([np.abs(sel[:, 2]), sel[:, 1]], -1)
    # 網頁上的機身是照 STATIONS 程式畫的橢圓（比下載的機身略胖），也要包進來，不然會從整流罩穿出來
    rz_, ry_, dy_ = (float(np.interp(t, stt[:, 0], stt[:, c])) + (0.03 if c < 3 else 0) for c in (1, 2, 3))
    th_ = np.radians(np.arange(90, 181, 2))
    zy = np.vstack([zy, np.stack([rz_ * np.sin(th_), CY + dy_ + ry_ * np.cos(th_)], -1)])
    # 側邊只包到整流罩的寬度（機身側面不要塗白）
    bz = BELLY_P[np.abs(BELLY_P[:, 0] - x) < 0.35]
    zf = min(ZCAP, float(np.abs(bz[:, 2]).max())) if len(bz) else 0.5
    zy = zy[(zy[:, 0] <= zf) & (zy[:, 1] < CY - 0.8)]
    # 機翼下表面（翼根那幾點）：整流罩上緣要接到這裡
    for zc, cut in ROOT_CUTS:
        near = cut[np.abs(cut[:, 0] - x) < 0.3]
        if len(near) and zf > 2.8: zy = np.vstack([zy, [[zc, near[:, 1].min()]]])
    zy = np.vstack([zy, [[0.0, zy[zy[:, 0] < 0.8, 1].min() if (zy[:, 0] < 0.8).any() else zy[:, 1].min()]]])
    env = lower_env(zy)
    seg = np.r_[0, np.cumsum(np.hypot(*np.diff(env, axis=0).T))]
    u = np.linspace(0, seg[-1], NS)
    SL.append(np.stack([np.interp(u, seg, env[:, 0]), np.interp(u, seg, env[:, 1])], -1))
SL = np.array(SL)
for _ in range(2):
    SL[1:-1] = (SL[:-2] + SL[1:-1] * 2 + SL[2:]) / 4
HV = []
for k, t in enumerate(HULL_T):
    # 兩端 1 公尺慢慢往內收 4 公分，收進原本的整流罩裡面，看不到切口
    e = min(t - T0, T1 - t)
    off = 0.015 if e > 1.0 else -0.04 + 0.055 * e
    for z, y in SL[k]:
        HV.append((NOSE_X - t, y - off, z + (off * 0.4 if z > 1.0 else 0.0)))
HV = np.array(HV, np.float32)
HF = []
for k in range(len(HULL_T) - 1):
    for j in range(NS - 1):
        a = k * NS + j; b = a + NS
        HF += [[a, a + 1, b + 1], [a, b + 1, b]]
HF = np.array(HF, np.int64)
A, B_, C = HV[HF[NS * 2, 0]], HV[HF[NS * 2, 1]], HV[HF[NS * 2, 2]]
if np.cross(B_ - A, C - A)[1] > 0: HF = HF[:, ::-1].copy()  # 底部的面要朝下
print('HULL t', round(float(T0), 2), round(float(T1), 2))
print('HULL', len(HV), 'verts', 'outer z', np.round(SL[:, -1, 0].min(), 2), np.round(SL[:, -1, 0].max(), 2), 'bottom y', np.round(SL[:, 0, 1].min(), 2))
mirror_add('belly', 'shell', HV, HF, 'hull')

# ---- 主輪艙、翼根下面的洞：從下面往上打線，打不到外殼（直接看進機身裡）的格子，用旁邊的高度補一片關起來的艙門 ----
ext = [(P, T) for (part, mk, tag), lst in groups.items() if part in ('belly', 'wings', 'flaps', 'fairings', 'slats') and not tag.startswith('L') and 'hull' not in tag for P, T in lst]
ext += FUSE_COMPS
Vs = []; Fs = []; off = 0
for P, T in ext:
    Vs.extend(P.tolist()); Fs.extend((T + off).tolist()); off += len(P)
bvh = BVHTree.FromPolygons(Vs, Fs)
DX, DZ = 0.1, 0.1
xs = np.arange(-6.0, 8.0 + 1e-6, DX); zs = np.arange(0.0, 7.0 + 1e-6, DZ)
H = np.full((len(xs), len(zs)), np.nan)
for i, x in enumerate(xs):
    for j, z in enumerate(zs):
        hit = bvh.ray_cast(Vector((x, -3.0, z)), Vector((0, 1, 0)), 8.0)
        # 打到的面要朝下（從下面看得到）；打到朝上的面＝從背面看過去，畫面上是透空的
        if hit[0] is not None and hit[0][1] < 4.9 and hit[1][1] < -0.05: H[i, j] = hit[0][1]
# 洞：被外殼包圍（四個方向都找得到外殼）但自己打不到的格子
hole = np.zeros_like(H, bool)
for i in range(1, len(xs) - 1):
    for j in range(len(zs) - 1):
        if not np.isnan(H[i, j]): continue
        col = H[:, j]; row = H[i, :]
        if np.isnan(col[:i]).all() or np.isnan(col[i + 1:]).all(): continue
        if np.isnan(row[j + 1:]).all(): continue
        hole[i, j] = True
# 只補主輪艙附近（翼根下面）
for i, x in enumerate(xs):
    for j, z in enumerate(zs):
        if not (-4.0 < x < 5.5 and 3.0 < z < 7.0): hole[i, j] = False
# 洞裡零星打到的小碎塊（原模型起落架支柱、艙內的東西）也當成洞：四周有三面以上是洞的格子併進來
for _ in range(4):
    nb = np.zeros_like(hole, int)
    nb[1:, :] += hole[:-1, :]; nb[:-1, :] += hole[1:, :]; nb[:, 1:] += hole[:, :-1]; nb[:, :-1] += hole[:, 1:]
    hole = hole | ((nb >= 3) & ~np.isnan(H)) | ((nb >= 2) & np.isnan(H) & (nb > 0))
# 洞外面一圈（貼著洞的外殼格子）：高度當邊界
ring = np.zeros_like(hole)
ring[1:, :] |= hole[:-1, :]; ring[:-1, :] |= hole[1:, :]; ring[:, 1:] |= hole[:, :-1]; ring[:, :-1] |= hole[:, 1:]
ring &= ~hole & ~np.isnan(H)
# 格點：洞和那一圈的四個角都要。邊界格點取旁邊外殼裡最高（最裡面）的高度，補片才會整片藏在外殼後面、只從洞裡露出來
NX, NZ = len(xs) + 1, len(zs) + 1
gx = np.concatenate([xs - DX / 2, [xs[-1] + DX / 2]]); gz = np.concatenate([zs - DZ / 2, [zs[-1] + DZ / 2]])
node = np.full((NX, NZ), np.nan); need = np.zeros((NX, NZ), bool); fixed = np.zeros((NX, NZ), bool)
for i, j in zip(*np.where(hole | ring)):
    for c in ((i, j), (i + 1, j), (i, j + 1), (i + 1, j + 1)):
        need[c] = True
        if ring[i, j]:
            node[c] = H[i, j] if np.isnan(node[c]) else max(node[c], H[i, j]); fixed[c] = True
free = need & ~fixed
node[free] = np.nanmean(node[fixed])
for _ in range(3000):  # 拉普拉斯平滑：洞裡的高度＝四周平均，整片像拉緊的膜
    pad = np.pad(node, 1, constant_values=np.nan)
    st4 = np.stack([pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]])
    avg = np.nanmean(np.where(np.isnan(st4), np.nan, st4), axis=0)
    node[free] = avg[free]
quads = []
for i, j in zip(*np.where(hole | ring)):
    ys = [node[i, j], node[i + 1, j], node[i + 1, j + 1], node[i, j + 1]]
    if any(np.isnan(ys)): continue
    quads.append([(gx[i], ys[0] + 0.012, gz[j]), (gx[i + 1], ys[1] + 0.012, gz[j]), (gx[i + 1], ys[2] + 0.012, gz[j + 1]), (gx[i], ys[3] + 0.012, gz[j + 1])])
print('HOLES', int(hole.sum()), 'filled', len(quads))
if quads:
    P = np.array([v for q in quads for v in q], np.float32)
    # 面朝下（從飛機下面看得到）
    T = np.array([[k * 4, k * 4 + 1, k * 4 + 2, k * 4, k * 4 + 2, k * 4 + 3][a:a + 3] for k in range(len(quads)) for a in (0, 3)], np.int64)
    mirror_add('belly', 'shell', P, T, 'door')

json.dump({'NOSE_X': NOSE_X, 'CY': CY, 'STATIONS': st}, open(os.path.join(outdir, 'plane_meas.json'), 'w'), indent=1)

# ================= 引擎：Trent XWB（組好的那一台，y > 7.5），換到 A350 的位置 =================
obs = load(os.path.join(src, 'trent', 'scene.gltf'))
# Airbus ACAP（A350 Aircraft Characteristics, FIGURE 2-2-0 / 2-3-0）：進氣口唇緣離機頭 25.78 m、引擎中心離機身中心 10.50 m、短艙最低點離地 0.76 m；
# Trent XWB-97 風扇直徑 3.0 m（這個模型的風扇 3.94 → 縮 0.761）
S_E = 0.761
NOSE_REAL = 36.895                     # 這裡的機頭位置（LEN/2）
LIP = 37.0588 - (NOSE_REAL - (NOSE_REAL - 25.78))  # 外殼座標裡的唇緣 x（外殼機頭在 37.0588）
X_FAN = LIP - (5.23 - 3.19) * S_E
Y_ENG = 0.76 + (4.145 - 1.49) * S_E
Z_ENG = 10.50
def eng_tf(co):
    return np.stack([X_FAN - (co[:, 0] + 3.19) * S_E, Y_ENG + (co[:, 2] - 4.145) * S_E, Z_ENG + (co[:, 1] - 10.70) * S_E], -1)
def eng_kind(name):
    n = name.lower()
    if n.startswith('cube.001'): return None                     # 它自己的派龍：用外殼的
    if n.startswith('engine outer'): return ('engine', 'lip' if 'material.004' in n else 'cowl')
    if n.startswith('cylinder.011') or n.startswith('cylinder.019'): return ('fan', 'blade')
    if n.startswith('cone thingy') or n.startswith('sphere.008'): return ('fan', 'spinner')
    if n.startswith('exahuster'): return ('core', 'plug' if 'material.040' in n else 'nozzle')
    return ('core', 'core')
for o in obs:
    M = o.matrix_world
    ys = [(M @ v.co)[1] for v in o.data.vertices[:50]]
    if not ys or min(ys) < 7.5: continue
    k = eng_kind(o.name)
    if not k: continue
    dec(o, 2500 if k[0] == 'core' else 9000)
    mat = o.data.materials[0] if o.data.materials else None
    shade = 0.6
    if mat and mat.node_tree:
        b = [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
        if b: shade = round(float(sum(b[0].inputs['Base Color'].default_value[:3]) / 3), 2)
    for P, T in comps(o, eng_tf):
        mirror_add(k[0], 'eng', P, T, k[1] + ('' if k[1] != 'core' else ('_d' if shade < 0.55 else '')))

# ================= 起落架（A350-1000）：主輪兩組、鼻輪一組 =================
obs = load(os.path.join(src, 'gear', 'scene.gltf'))
# ACAP FIGURE 7-2-0：鼻輪離機頭 4.63 m、主輪中軸 37.11 m（軸距 32.48）、主輪距 10.734 m、主輪左右間距約 1.40–1.47 m（模型 1.2 → 拉寬 1.18 倍）
SHELL_NOSE = 37.0588
MAIN_X = (SHELL_NOSE - 37.11) + 1.83
MAIN_Z = 10.734 / 2
NOSE_GX = (SHELL_NOSE - 4.63) - 2.73
GEAR_W = 1.18
for o in obs:
    M = o.matrix_world
    co0 = np.array([list(M @ v.co) for v in o.data.vertices])
    nf = len(o.data.polygons)
    tag = 'tire' if nf in (18299, 18300) else 'rim' if nf in (18172, 17148) else 'strut'
    dec(o, 5000 if tag == 'tire' else 1600 if tag == 'rim' else 900)
    if co0[:, 0].max() < 1:   # 主起落架：3 排 × 2 顆
        tf = lambda co: np.stack([co[:, 0] + MAIN_X, co[:, 2] + 0.68, MAIN_Z - co[:, 1] * GEAR_W], -1)
        W = [(x + MAIN_X, MAIN_Z + dz * GEAR_W) for x in (-3.27, -1.83, -0.38) for dz in (-0.6, 0.6)]
        for P, T in comps(o, tf):
            if tag == 'strut': mirror_add('mainGear', 'gear', P, T, tag); continue
            c = (P.min(0) + P.max(0)) / 2
            wx, wz = min(W, key=lambda w: (w[0] - c[0]) ** 2 + (w[1] - c[2]) ** 2)
            add('mainGear', 'gear', P, T, 'R|%s|%.2f,%.2f' % (tag, wx, wz))
            Q = P.copy(); Q[:, 2] *= -1
            add('mainGear', 'gear', Q, T[:, ::-1].copy(), 'L|%s|%.2f,%.2f' % (tag, wx, -wz))
    else:                      # 鼻輪：2 顆
        tf = lambda co: np.stack([co[:, 0] + NOSE_GX, co[:, 2] + 0.65, -co[:, 1]], -1)
        for P, T in comps(o, tf):
            if tag == 'strut': add('noseGear', 'gear', P, T, 'C|strut'); continue
            c = (P.min(0) + P.max(0)) / 2
            add('noseGear', 'gear', P, T, 'C|%s|%.2f,%.2f' % (tag, 2.73 + NOSE_GX, 0.38 if c[2] > 0 else -0.38))

# ================= 輸出 =================
blob = bytearray()
meta = {'groups': [], 'NOSE_X': NOSE_X, 'CY': CY,
        'WING': WING, 'credits': ['Airbus A350 V4 by Newbie99999993, CC BY 4.0', 'Rolls-Royce Trent XWB Engine by hakai315, CC BY 4.0', 'A350-1000 Landing Gear by N.S STUDIOS, CC BY 4.0']}
def align(n):
    while len(blob) % n: blob.append(0)
stats = {}
for (part, mk, tag), lst in sorted(groups.items()):
    if part == 'fuse': continue
    Ps = []; Ts = []; off = 0
    for P, T in lst:
        Ps.append(P); Ts.append(T + off); off += len(P)
    P = np.concatenate(Ps).astype(np.float32); T = np.concatenate(Ts).astype(np.uint32).ravel()
    g = {'part': part, 'mat': mk, 'tag': tag, 'nv': len(P), 'ni': len(T)}
    lo = P.min(0); stp = np.maximum((P.max(0) - lo) / 65535.0, 1e-9)
    g['q'] = [float(v) for v in lo] + [float(v) for v in stp]
    align(4); g['pos'] = len(blob); blob.extend(np.round((P - lo) / stp).astype(np.uint16).tobytes())
    align(4)
    if len(P) < 65536: g['idx16'] = len(blob); blob.extend(T.astype(np.uint16).tobytes())
    else: g['idx'] = len(blob); blob.extend(T.tobytes())
    meta['groups'].append(g); stats[part] = stats.get(part, 0) + len(T) // 3
open(os.path.join(outdir, 'plane.bin'), 'wb').write(zlib.compress(bytes(blob), 9))
json.dump(meta, open(os.path.join(outdir, 'plane.json'), 'w'), indent=1)
print('OUT', stats, 'tris', sum(stats.values()), 'bytes', len(blob))

if dbg:
    # 照零件上色，從上、下、側面看
    import random
    bpy.ops.wm.read_factory_settings(use_empty=True)
    random.seed(5)
    cols = {}
    for (part, mk, tag), lst in groups.items():
        P = np.concatenate([p for p, t in lst]); off = 0; F = []
        for p, t in lst: F.append(t + off); off += len(p)
        F = np.concatenate(F)
        me = bpy.data.meshes.new(part)
        V = np.stack([P[:, 0], -P[:, 2], P[:, 1]], -1)
        me.from_pydata(V.tolist(), [], F.tolist())
        ob = bpy.data.objects.new(part, me); bpy.context.scene.collection.objects.link(ob)
        m = bpy.data.materials.new(part)
        cols.setdefault(part, (random.random(), random.random(), random.random(), 1))
        m.diffuse_color = cols[part]; me.materials.append(m)
    print('COLORS', {k: [round(x, 2) for x in v[:3]] for k, v in cols.items()})
    sc = bpy.context.scene; sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x = 1600; sc.render.resolution_y = 1000
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 78; cam.data.clip_end = 500
    for i, (d, up) in enumerate([((0, 0, 1), 'X'), ((0, 0, -1), 'X'), ((0, -1, 0), 'Y')]):
        d = Vector(d); cam.location = Vector((0, 0, 6)) + d * 80
        cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{dbg}_{i}.png'; bpy.ops.render.render(write_still=True)
