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
    Q, F = cut(P, T, NOSE_X - 6.4, True)
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
json.dump({'NOSE_X': NOSE_X, 'CY': CY, 'STATIONS': st}, open(os.path.join(outdir, 'plane_meas.json'), 'w'), indent=1)

# ================= 引擎：Trent XWB（組好的那一台，y > 7.5），換到 A350 的位置 =================
obs = load(os.path.join(src, 'trent', 'scene.gltf'))
S_E = 0.85
X_FAN, Y_ENG, Z_ENG = 9.83, 3.41, 10.53
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
MAIN_X, MAIN_Z, NOSE_GX = 0.77 + 1.83, 5.45, 32.6 - 2.73
for o in obs:
    M = o.matrix_world
    co0 = np.array([list(M @ v.co) for v in o.data.vertices])
    nf = len(o.data.polygons)
    tag = 'tire' if nf in (18299, 18300) else 'rim' if nf in (18172, 17148) else 'strut'
    dec(o, 5000 if tag == 'tire' else 1600 if tag == 'rim' else 900)
    if co0[:, 0].max() < 1:   # 主起落架：3 排 × 2 顆
        tf = lambda co: np.stack([co[:, 0] + MAIN_X, co[:, 2] + 0.68, MAIN_Z - co[:, 1]], -1)
        W = [(x + MAIN_X, MAIN_Z + dz) for x in (-3.27, -1.83, -0.38) for dz in (-0.6, 0.6)]
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
