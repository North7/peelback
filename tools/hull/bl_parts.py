# Blender：把整理好的車身切成零件（每個面看它的中心點在哪、貼圖上是什麼材質），
# 依規格把尺寸對齊（車長 4.79、車高 1.624），輸出網頁用的二進位網格＋說明檔
# 用法：Blender -b -P bl_parts.py -- prep_dir out_dir
import bpy, bmesh, sys, os, json, struct
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
prep, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=os.path.join(prep, 'body.blend'))
ob = bpy.data.objects['body']
me = ob.data
cls = np.load(os.path.join(prep, 'cls.npy'))  # v 往上（和貼圖同方向，第 0 列是 v=1）
R = cls.shape[0]
bj = json.load(open(os.path.join(os.path.dirname(prep), 'body.json')))
AXF, AXR = bj['AX_F'], bj['AX_R']
mw = ob.matrix_world
uvl = me.uv_layers.active.data
# 側窗輪廓（和 classify.py 相同）
WIN = [(0.97, 1.10), (0.9, 1.19), (0.8, 1.305), (0.7, 1.386), (0.6, 1.44), (0.4, 1.498), (0.2, 1.528), (0.0, 1.545), (-0.3, 1.548), (-0.6, 1.538),
       (-1.0, 1.51), (-1.2, 1.484), (-1.4, 1.434), (-1.52, 1.38), (-1.58, 1.345), (-1.5, 1.27), (-1.4, 1.218), (-1.0, 1.177), (-0.6, 1.15),
       (-0.2, 1.13), (0.2, 1.116), (0.6, 1.105), (0.85, 1.09)]
def inpoly(px, py, poly):
    c = False; n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > py) != (y2 > py) and px < (x2 - x1) * (py - y1) / (y2 - y1) + x1: c = not c
    return c
def interp(v, xs, ys): return float(np.interp(v, xs, ys))
def bar_up(az): return interp(az, [0, 0.45, 0.55, 0.65, 0.75, 0.85, 0.9], [0.765, 0.765, 0.775, 0.795, 0.82, 0.845, 0.85])
def part_of(x, y, z, n, k):
    az = abs(z); side = 'R' if z > 0 else 'L'
    rr = min(np.hypot(x - AXF, y - 0.356), np.hypot(x - AXR, y - 0.356))
    if k == 3:
        return 'windshield' if x > 0.25 else ('roof' if x > -1.12 else 'liftgate')
    if k in (2, 5) or (inpoly(x, y, WIN) and abs(n[2]) > 0.3):
        if x > -0.30: return 'doorF' + side
        if x > -1.155: return 'doorR' + side
        return 'body'
    cowl = 0.985 - 0.09 * (az / 0.7) ** 2
    hood_half = interp(x, [0.98, 2.0, 2.4], [0.70, 0.86, 0.9])
    if n[1] > 0.2 and x > cowl - 0.02 and y > bar_up(az) + 0.004 and az < hood_half: return 'hood'
    if x < -1.12 and y > 0.6:
        if y > 0.995 and az < 0.79 and (n[0] < -0.15 or n[1] > 0.25) and x < -1.75: return 'liftgate'
        if y <= 0.995 and az < 0.60 and n[0] < -0.3: return 'liftgate'
        if x < -1.85 and y > 1.12 and az < 0.79: return 'liftgate'
    if x > AXF + 0.02 and y < bar_up(az) + 0.004 and rr > 0.43: return 'front'
    if x > 2.0 and y < bar_up(az) + 0.004: return 'front'
    if x < AXR - 0.02 and y < 0.62 and rr > 0.43: return 'rear'
    if x < -2.0 and y < 0.62: return 'rear'
    if abs(n[2]) > 0.3 and 0.205 < y < 1.13 and rr > 0.445:
        if -0.20 < x < 0.94: return 'doorF' + side
        if -1.24 < x <= -0.20: return 'doorR' + side
    return 'body'
# 法線大範圍平滑：削出來的表面有細小起伏，烤漆反光會放大；只改法線、不改形狀
from mathutils import kdtree, Vector
NR = float(os.environ.get('NRAD', '0.035'))
nv = len(me.vertices)
kd = kdtree.KDTree(nv)
co = [mw @ v.co for v in me.vertices]
for i, c in enumerate(co): kd.insert(c, i)
kd.balance()
vn = [(M3 := mw.to_3x3()) @ v.normal for v in me.vertices]
SN = []
for i, c in enumerate(co):
    acc = Vector((0, 0, 0)); n0 = vn[i]
    for (p_, j, d) in kd.find_range(c, NR):
        w = np.exp(-(d / (NR * 0.5)) ** 2)
        if vn[j].dot(n0) > 0.5: acc += vn[j] * w  # 轉角很大的地方（摺邊）不混
    SN.append(acc.normalized() if acc.length > 0 else n0)
print('normals smoothed', NR)
# 每個面：中心、法線、貼圖材質
bm = bmesh.new(); bm.from_mesh(me)
bm.faces.ensure_lookup_table()
uvlay = bm.loops.layers.uv.active
groups = {}
M3 = mw.to_3x3()
for f in bm.faces:
    c = mw @ f.calc_center_median(); nn = (M3 @ f.normal).normalized()
    x, y, z = c.x, c.z, -c.y; n = (nn.x, nn.z, -nn.y)
    u = sum(l[uvlay].uv.x for l in f.loops) / len(f.loops); v = sum(l[uvlay].uv.y for l in f.loops) / len(f.loops)
    k = int(cls[min(R - 1, max(0, int((1 - v) * R))), min(R - 1, max(0, int(u * R)))])
    p = part_of(x, y, z, n, k)
    groups.setdefault((p, 'paint'), []).append(f.index)
    # 玻璃：面的三個角任何一個落在玻璃（含黑邊）就算
    kk = [k]
    for l in f.loops:
        uu, vv = l[uvlay].uv.x, l[uvlay].uv.y
        kk.append(int(cls[min(R - 1, max(0, int((1 - vv) * R))), min(R - 1, max(0, int(uu * R)))]))
    if any(q in (2, 3) for q in kk): groups.setdefault((p, 'glass'), []).append(f.index)
# 尺寸對齊規格：車長 4.79（x、z 同比例），車高 1.624
xs = [(mw @ v.co).x for v in me.vertices]; zs_ = [(mw @ v.co).z for v in me.vertices]
LEN = max(xs) - min(xs); TOP = max(zs_)
SXZ = 4.79 / LEN; SY = 1.624 / TOP
print('len', LEN, 'top', TOP, 'scale xz', SXZ, 'y', SY)
# 輸出：每組一段，位置 float32、法線 int8、uv uint16、索引 uint32
blob = bytearray(); meta = {'scale': [SXZ, SY], 'AX_F': AXF * SXZ, 'AX_R': AXR * SXZ, 'groups': []}
def align(n):
    while len(blob) % n: blob.append(0)
for (p, mat), faces in sorted(groups.items()):
    vmap = {}; pos = []; nor = []; uvs = []; idx = []
    for fi in faces:
        f = bm.faces[fi]
        loops = list(f.loops)
        tri = [loops[0], loops[1], loops[2]] if len(loops) == 3 else None
        polys = [(loops[0], loops[i], loops[i + 1]) for i in range(1, len(loops) - 1)]
        for t in polys:
            for l in t:
                key = (l.vert.index, round(l[uvlay].uv.x, 6), round(l[uvlay].uv.y, 6))
                if key not in vmap:
                    w = mw @ l.vert.co; nn = SN[l.vert.index]
                    if mat == 'glass': w = w + nn * 0.002
                    vmap[key] = len(pos)
                    pos.append((w.x * SXZ, w.z * SY, -w.y * SXZ)); nor.append((nn.x, nn.z, -nn.y)); uvs.append((l[uvlay].uv.x, l[uvlay].uv.y))
                idx.append(vmap[key])
    pos = np.array(pos, np.float32); nor = np.array(nor, np.float32); uvs = np.array(uvs, np.float32); idx = np.array(idx, np.uint32)
    g = {'part': p, 'mat': mat, 'nv': len(pos), 'ni': len(idx)}
    align(4); g['pos'] = len(blob); blob += pos.tobytes()
    g['nor'] = len(blob); blob += np.clip(np.round(nor * 127), -127, 127).astype(np.int8).tobytes()
    align(4); g['uv'] = len(blob); blob += np.clip(np.round(uvs * 65535), 0, 65535).astype(np.uint16).tobytes()
    align(4)
    if len(pos) < 65536:
        g['idx16'] = len(blob); blob += idx.astype(np.uint16).tobytes()
    else:
        g['idx'] = len(blob); blob += idx.tobytes()
    meta['groups'].append(g)
    print('%-10s %-6s verts %6d tris %6d' % (p, mat, len(pos), len(idx) // 3))
open(os.path.join(outdir, 'body.bin'), 'wb').write(bytes(blob))
json.dump(meta, open(os.path.join(outdir, 'body.json'), 'w'), indent=1)
print('bytes', len(blob))
