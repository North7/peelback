# 底盤、電池、前後馬達（Sketchfab 下載，CC BY）→ 剝剝看的第三、四層零件
# 每個模型：讀進來 → 減面 → 縮放／轉到 Model Y 的位置（軸距 2.89、輪距 1.636）→ 依位置分零件 → 輸出 inner.bin＋inner.json
# 用法：Blender -b -P tools/sk_parts.py -- ref/car/sketchfab/parts car/sk
import bpy, sys, os, json
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
AXF, AXR, RW = 1.48, -1.42, 0.36

def load(name, ratio):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(src, name, 'scene.gltf'))
    obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if ratio < 1:
        for o in obs:
            m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = ratio
            with bpy.context.temp_override(object=o, active_object=o):
                bpy.ops.object.modifier_apply(modifier=m.name)
    return obs

def comps(o):
    """一個網格拆成連通塊：回傳 [(頂點座標 world[n,3], 三角形 index[m,3] 指到這些點, 材質名, 顏色)]"""
    me = o.data
    me.calc_loop_triangles()
    M = o.matrix_world
    co = np.array([list(M @ v.co) for v in me.vertices]) if len(me.vertices) else np.zeros((0, 3))
    tv = np.array([list(t.vertices) for t in me.loop_triangles], np.int64).reshape(-1, 3)
    tm = np.array([t.material_index for t in me.loop_triangles], np.int64)
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
    for r in np.unique(roots[tv[:, 0]]) if len(tv) else []:
        sel = roots[tv[:, 0]] == r
        T = tv[sel]
        mi = int(np.bincount(tm[sel]).argmax())
        mat = me.materials[mi] if mi < len(me.materials) and me.materials[mi] else None
        col = [0.6, 0.6, 0.6]
        if mat and mat.node_tree:
            b = [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
            if b: col = list(b[0].inputs['Base Color'].default_value)[:3]
        out.append((co, T, mat.name if mat else 'none', col))
    return out

groups = {}  # (part, matkey) -> [(P, T)]
colors = {}
def add(part, matkey, col, P, T, tag=''):
    groups.setdefault((part, matkey, tag), []).append((P, T)); colors[matkey] = col

# ---------- 底盤（Model X，CC BY Michael Zhang）：輪子不要（用 Model Y 的），中間的電池底板不要（用電池模型） ----------
S = 2.89 / 1.345; YC = -0.0728
def ch(p): return np.stack([-(p[:, 1] - YC) * S, (p[:, 2] + 0.027) * S + RW, -p[:, 0] * S], -1)
for o in load('chassis', 1.0):
    for co, T, mname, col in comps(o):
        P = ch(co); used = np.unique(T); Q = P[used]
        mn, mx = Q.min(0), Q.max(0); c = (mn + mx) / 2
        near = min(abs(c[0] - AXF), abs(c[0] - AXR))
        if near < 0.45 and abs(c[2]) > 0.6 and c[1] < 0.75: continue  # 輪胎、輪圈
        if mx[0] > 2.0 or mn[0] < -1.95 or mn[1] < 0.1: continue  # 前後保險桿鋼樑、最底下的護板：會從 Model Y 的車殼穿出來
        if abs(c[0]) < 1.05 and mx[1] < 0.42 and abs(c[2]) < 0.72 and (mx[0] - mn[0]) > 0.25: continue  # 電池底板
        part = 'suspension' if (near < 0.6 and abs(c[2]) > 0.25) else 'casting'
        tag = ('F' if c[0] > 0 else 'R') + (('L' if c[2] < 0 else 'R') if part == 'suspension' and abs(c[2]) > 0.15 else '')  # 避震器再分左右，名牌才落在輪子旁
        add(part, 'ch_' + mname, col, P, T, tag)  # 前、後分開（名牌和拆開的方向才對）

# ---------- 電池（Model S 電池包，CC BY AniMtrX）：拉成 Model Y 電池的大小，鼓起來那段放後面 ----------
obs = load('battery', 0.15)
allp = np.concatenate([np.array([list(o.matrix_world @ v.co) for v in o.data.vertices]) for o in obs])
bmn, bmx = allp.min(0), allp.max(0)
def bt(p):
    x = -1.15 + (p[:, 0] - bmn[0]) / (bmx[0] - bmn[0]) * 2.17
    z = -0.75 + (p[:, 1] - bmn[1]) / (bmx[1] - bmn[1]) * 1.5
    y = 0.165 + (p[:, 2] - bmn[2]) * 0.62
    return np.stack([x, y, z], -1)
for o in obs:
    for co, T, mname, col in comps(o):
        add('battery', 'bt_' + mname, col, bt(co), T)

# ---------- 前、後驅動馬達（實物掃描，CC BY tangentinnovationgroup）：mm → m，放在前後軸上 ----------
def solid(name, voxel, tris):
    """掃描的模型分成很多塊互相重疊：合成一塊 → 用體素重建一層完整的外皮 → 減面到 tris 個三角形"""
    obs = load(name, 1.0)
    o = obs[0]
    with bpy.context.temp_override(active_object=o, selected_editable_objects=obs, selected_objects=obs):
        bpy.ops.object.join()
    print('SCALE', name, tuple(round(v, 4) for v in o.matrix_world.to_scale()), 'parent', o.parent.name if o.parent else None)
    # 先把位置、縮放套進網格（體素大小才是真的毫米）
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
    o.data.transform(mw); o.matrix_world.identity()
    m = o.modifiers.new('rm', 'REMESH'); m.mode = 'VOXEL'; m.voxel_size = voxel; m.adaptivity = 0
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=m.name)
    n = len(o.data.polygons)
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1.0, tris / max(1, n))
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=m.name)
    print('SOLID', name, n, '->', len(o.data.polygons))
    return [o]

def solid_obj(name, tris):
    """du_solid.py 做好的實心外皮（solid.obj）→ 減面"""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.wm.obj_import(filepath=os.path.join(src, name, 'solid.obj'), up_axis='Z', forward_axis='Y')
    o = [o for o in bpy.context.scene.objects if o.type == 'MESH'][0]
    n = len(o.data.polygons)
    m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = min(1.0, tris / n)
    with bpy.context.temp_override(object=o, active_object=o):
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons: p.use_smooth = False
    print('SOLID', name, n, '->', len(o.data.polygons))
    return [o]

def du(name, ratio, ax, lateral):
    obs = solid_obj(name, 30000)
    allp = np.concatenate([np.array([list(o.matrix_world @ v.co) for v in o.data.vertices]) for o in obs])
    c = (allp.min(0) + allp.max(0)) / 2; lo = allp.min(0)
    def tf(p):
        q = (p - c) / 1000.0
        if lateral == 'Y': x, z = q[:, 0], -q[:, 1]
        else: x, z = q[:, 1], q[:, 0]
        y = (p[:, 2] - lo[2]) / 1000.0 + 0.2
        return np.stack([x + ax, y, z], -1)
    for o in obs:
        for co, T, mname, col in comps(o):
            add('frontMotor' if ax > 0 else 'rearMotor', 'du', [0.62, 0.64, 0.66], tf(co), T)
du('front_du', 0.014, AXF, 'Y')
du('rear_du', 0.022, AXR, 'X')

# ---------- 輸出 ----------
blob = bytearray(); meta = {'groups': [], 'colors': colors,
    'credits': ['Tesla Model X chassis by Michael Zhang (beyond.zht), CC BY 4.0', 'Tesla Batterie Pack V2 by AniMtrX, CC BY 4.0',
                'Tesla Front / Rear Small Drive Unit by tangentinnovationgroup, CC BY 4.0']}
def align(n):
    while len(blob) % n: blob.append(0)
stats = {}
for (part, mk, tag), lst in sorted(groups.items()):
    Ps = []; Ts = []; off = 0
    for P, T in lst:
        used = np.unique(T); remap = np.full(len(P), -1); remap[used] = np.arange(len(used))
        Ps.append(P[used]); Ts.append(remap[T] + off); off += len(used)
    P = np.concatenate(Ps).astype(np.float32); T = np.concatenate(Ts).astype(np.uint32).ravel()
    g = {'part': part, 'mat': mk, 'tag': tag, 'nv': len(P), 'ni': len(T)}
    lo = P.min(0); st = np.maximum((P.max(0) - lo) / 65535.0, 1e-9)
    g['q'] = [float(v) for v in lo] + [float(v) for v in st]
    align(4); g['pos'] = len(blob); blob.extend(np.round((P - lo) / st).astype(np.uint16).tobytes())
    align(4)
    if len(P) < 65536: g['idx16'] = len(blob); blob.extend(T.astype(np.uint16).tobytes())
    else: g['idx'] = len(blob); blob.extend(T.tobytes())
    meta['groups'].append(g); stats[part] = stats.get(part, 0) + len(T) // 3
import zlib
open(os.path.join(outdir, 'inner.bin'), 'wb').write(zlib.compress(bytes(blob), 9))
json.dump(meta, open(os.path.join(outdir, 'inner.json'), 'w'), indent=1)
print('INNER', stats, 'bytes', len(blob))
