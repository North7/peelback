# Blender：把整理好的車身輸出成 numpy（三角形、每個角的 uv、平滑過的法線、哪些面是玻璃），給 split.py 切零件
# 用法：Blender -b -P bl_export.py -- prep_dir
import bpy, bmesh, sys, os
import numpy as np
from mathutils import kdtree, Vector
argv = sys.argv[sys.argv.index('--') + 1:]
prep = argv[0]
bpy.ops.wm.open_mainfile(filepath=os.path.join(prep, 'body.blend'))
ob = bpy.data.objects['body']
me = ob.data
mw = ob.matrix_world
M3 = mw.to_3x3()
cls = np.load(os.path.join(prep, 'cls.npy'))
R = cls.shape[0]
# 法線大範圍平滑：削出來的表面有細小起伏，烤漆反光會放大；只改法線、不改形狀
NR = float(os.environ.get('NRAD', '0.09'))
co = [mw @ v.co for v in me.vertices]
vn = [(M3 @ v.normal).normalized() for v in me.vertices]
kd = kdtree.KDTree(len(co))
for i, c in enumerate(co): kd.insert(c, i)
kd.balance()
SN = []
for i, c in enumerate(co):
    acc = Vector((0, 0, 0)); n0 = vn[i]
    for (_, j, d) in kd.find_range(c, NR):
        if vn[j].dot(n0) > 0.5: acc += vn[j] * float(np.exp(-(d / (NR * 0.5)) ** 2))
    SN.append(acc.normalized() if acc.length > 0 else n0)
bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.triangulate(bm, faces=bm.faces)
uvl = bm.loops.layers.uv.active
vmap = {}; pos = []; nor = []; uvs = []; tris = []; glass = []
def k_at(u, v): return int(cls[min(R - 1, max(0, int((1 - v) * R))), min(R - 1, max(0, int(u * R)))])
for f in bm.faces:
    t = []; kk = []
    for l in f.loops:
        u, v = l[uvl].uv.x, l[uvl].uv.y
        key = (l.vert.index, round(u, 6), round(v, 6))
        if key not in vmap:
            w = co[l.vert.index]; n = SN[l.vert.index]
            vmap[key] = len(pos)
            pos.append((w.x, w.z, -w.y)); nor.append((n.x, n.z, -n.y)); uvs.append((u, v))
        t.append(vmap[key]); kk.append(k_at(u, v))
    c = f.calc_center_median(); uc = sum(l[uvl].uv.x for l in f.loops) / 3; vc = sum(l[uvl].uv.y for l in f.loops) / 3
    kk.append(k_at(uc, vc))
    tris.append(t); glass.append(any(q in (2, 3) for q in kk))
np.savez_compressed(os.path.join(prep, 'mesh.npz'), pos=np.array(pos, np.float32), nor=np.array(nor, np.float32), uv=np.array(uvs, np.float32), tris=np.array(tris, np.int32), glass=np.array(glass))
print('exported', len(pos), 'verts', len(tris), 'tris', 'glass', sum(glass))
