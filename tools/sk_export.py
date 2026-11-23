# Sketchfab「2025 Tesla Model Y」（BloxBloger，CC BY-NC 4.0）→ 剝剝看的零件網格
# 每個網格先拆成一塊一塊（連通的面），照位置分到零件（前蓋、四扇門、尾門、輪子…），
# 換成車的座標（x 往前、y 往上、z 往右，車長中點、地面為 0），輸出 body.bin＋body.json（和 car/model.js 的讀法相同）。
# 用法：Blender -b -P tools/sk_export.py -- scene.gltf out_dir [debug.png]
import bpy, bmesh, sys, os, json
import numpy as np
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
# 輪胎胎紋、輪框的面很多：先減面（看不出差別，檔案小很多）
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    mn_ = o.data.materials[0].name if o.data.materials else ''
    r = {'Rubber_Rough': 0.12, 'black222': 0.35, 'Material_111': 0.4, 'black.002': 0.4}.get(mn_)
    if r:
        m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = r
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier=m.name)
XC, YC, Z0 = 1.766, (-3.567 + 1.221) / 2, -0.015
AXF, AXR, RW = 1.48, -1.42, 0.36
def car(w): return np.array([-(w[1] - YC), w[2] - Z0, -(w[0] - XC)])

def classify(mat, mn, mx, c, nf):
    x, y, z = c; az = abs(z)
    # 輪子：圓心在輪軸上、車身外側
    for ax, tag in ((AXF, 'F'), (AXR, 'R')):
        if abs(x - ax) < 0.42 and y < 0.78 and mx[1] < 0.8 and az > 0.5 and (mx[0] - mn[0]) < 0.9:
            return 'wheels', tag + ('R' if z > 0 else 'L')
    if mat == 'glass_roof_panorama': return 'roof', ''
    if mat == 'glass_base':
        if mn[2] < -0.3 and mx[2] > 0.3: return ('windshield' if x > 0 else 'liftgate'), ''
    # 後照鏡
    if 0.55 < x < 0.97 and y > 1.04 and az > 0.84: return 'mirrors', ''
    # 車門：兩側、整塊落在門的前後範圍內
    side = mn[2] > 0.45 or mx[2] < -0.45
    if side and mn[1] > 0.25 and mx[1] < 1.6:
        tag = 'R' if z > 0 else 'L'
        if mn[0] > -0.30 and mx[0] < 1.0: return 'doorF' + tag, ''
        if mn[0] > -1.33 and mx[0] < -0.16: return 'doorR' + tag, ''
    # 前蓋：前面、上緣、跨左右
    if mat == 'Material_2125765635' and mn[0] > 1.0 and mn[1] > 0.7 and mn[2] < -0.3 and mx[2] > 0.3: return 'hood', ''
    # 尾門：後窗、鴨尾、後窗下面那片、中間的尾燈條
    if mx[0] < -1.85 and mn[1] > 0.6 and mn[2] < -0.3 and mx[2] > 0.3: return 'liftgate', ''
    if mat == 'back_red_Light' and mn[2] < -0.3 and mx[2] > 0.3: return 'liftgate', ''
    # 車頭、車尾
    if mn[0] > 1.6 and mx[1] < 1.0:
        # 燈：下面兩角的頭燈燈罩、光條兩端（方向燈）
        if mat == 'glass_headlight222' and mx[1] < 0.74: return 'front', 'head'
        if mat == 'front_white_light' and az > 0.45: return 'front', 'turn'
        return 'front', ''
    if mx[0] < -1.7 and mx[1] < 1.02: return 'rear', ''
    # 車裡（座椅、儀表板、方向盤…）
    if az < 0.78 and mn[1] > 0.25 and mx[1] < 1.45 and -1.5 < x < 1.05 and mat not in ('glass_base',):
        if mat in ('Material_2125765635',): return 'body', ''
        if 0.27 < x < 0.4 and 0.72 < y < 0.92 and -0.03 < z < 0.09: return 'drop', ''  # 中間的檔把：新 Model Y 沒有（換檔在螢幕上）
        if 0.36 < x < 0.54 and -0.62 < z < -0.18 and y > 0.9: return 'interior', 'steering'
        if x > 0.55: return 'interior', 'dash'
        return 'interior', 'seats'
    return 'body', ''

groups = {}  # (part, mat, tag) -> list of (pos[n,3], nor[n,3], tri[m,3])
stats = {}
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    me = o.data
    mat = me.materials[0].name if me.materials else 'none'
    M = o.matrix_world; N3 = M.to_3x3().inverted().transposed()
    me.calc_loop_triangles()
    nl = np.array([list(cn.vector) for cn in me.corner_normals]) if hasattr(me, 'corner_normals') else None
    co = np.array([list(M @ v.co) for v in me.vertices])
    lt = me.loop_triangles
    tri_loops = np.array([list(t.loops) for t in lt]); tri_verts = np.array([list(t.vertices) for t in lt])
    loop_vert = np.array([l.vertex_index for l in me.loops])
    # 連通塊（以頂點相連）
    parent = np.arange(len(me.vertices))
    def find(a):
        r = a
        while parent[r] != r: r = parent[r]
        while parent[a] != r: parent[a], a = r, parent[a]
        return r
    for e in me.edges:
        a, b = find(e.vertices[0]), find(e.vertices[1])
        if a != b: parent[a] = b
    roots = np.array([find(i) for i in range(len(me.vertices))])
    tri_root = roots[tri_verts[:, 0]]
    for r in np.unique(tri_root):
        ts = np.where(tri_root == r)[0]
        vs = np.unique(tri_verts[ts])
        P = np.array([car(co[v]) for v in vs])
        mn, mx = P.min(0), P.max(0); c = (mn + mx) / 2
        part, tag = classify(mat, mn, mx, c, len(ts))
        if os.environ.get('DUMP2') and mx[0] < -1.6 and (mx[1] < 0.55 or mn[1] > 1.1):
            print('RR %-10s %-22s tris %5d x %5.2f..%5.2f y %4.2f..%4.2f z %5.2f..%5.2f' % (part, mat, len(ts), mn[0], mx[0], mn[1], mx[1], mn[2], mx[2]))
        if os.environ.get('DUMP') and part in ('interior', 'body') and abs(c[2]) < 0.8 and 0.2 < c[1] < 1.45 and -1.6 < c[0] < 1.1 and (mx[0]-mn[0]) < 2.2:
            print('IN %-8s %-20s tris %6d  x %5.2f..%5.2f  y %4.2f..%4.2f  z %5.2f..%5.2f' % (part, mat, len(ts), mn[0], mx[0], mn[1], mx[1], mn[2], mx[2]))
        if part == 'drop':
            print('DROPPED', mat, len(ts), np.round(mn, 2), np.round(mx, 2)); continue
        key = (part, mat, tag)
        # 每個角一個頂點（保留原本的平滑／銳利法線）
        L = tri_loops[ts].ravel()
        pos = np.array([car(co[v]) for v in loop_vert[L]])
        if nl is not None:
            n = np.array([list((N3 @ Vector(nl[l])).normalized()) for l in L])
        else:
            n = np.zeros_like(pos)
        nor = np.stack([-n[:, 1], n[:, 2], -n[:, 0]], -1)
        groups.setdefault(key, []).append((pos, nor))
        stats[part] = stats.get(part, 0) + len(ts)
print('parts', stats)
# 合併重複頂點、輸出
blob = bytearray(); meta = {'source': '2025 Tesla Model Y by BloxBloger (Sketchfab), CC BY-NC 4.0', 'AX_F': AXF, 'AX_R': AXR, 'R': RW, 'groups': [], 'materials': {}}
for m in bpy.data.materials:
    try:
        bsdf = [n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'][0]
        meta['materials'][m.name] = list(bsdf.inputs['Base Color'].default_value)[:3] + [bsdf.inputs['Alpha'].default_value]
    except Exception: pass
def align(n):
    while len(blob) % n: blob.append(0)
for (part, mat, tag), lst in sorted(groups.items()):
    pos = np.concatenate([a for a, b in lst]); nor = np.concatenate([b for a, b in lst])
    key = np.round(np.concatenate([pos * 1e4, nor * 100], 1)).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    first = np.zeros(len(uniq), np.int64); first[inv[::-1]] = np.arange(len(inv))[::-1]
    P = pos[first].astype(np.float32); Nn = nor[first]; idx = inv.ravel().astype(np.uint32)
    g = {'part': part, 'mat': mat, 'tag': tag, 'nv': len(P), 'ni': len(idx)}
    lo = P.min(0); st = np.maximum((P.max(0) - lo) / 65535.0, 1e-9)
    g['q'] = [float(v) for v in lo] + [float(v) for v in st]
    align(4); g['pos'] = len(blob); blob.extend(np.round((P - lo) / st).astype(np.uint16).tobytes())
    g['nor'] = len(blob); blob.extend(np.clip(np.round(Nn * 127), -127, 127).astype(np.int8).tobytes())
    align(4)
    if len(P) < 65536: g['idx16'] = len(blob); blob.extend(idx.astype(np.uint16).tobytes())
    else: g['idx'] = len(blob); blob.extend(idx.tobytes())
    meta['groups'].append(g)
import zlib
open(os.path.join(outdir, 'model.bin'), 'wb').write(zlib.compress(bytes(blob), 9))
json.dump(meta, open(os.path.join(outdir, 'model.json'), 'w'), indent=1)
print('groups', len(meta['groups']), 'bytes', len(blob))
