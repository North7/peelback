# 列出指定材質每個連通塊的位置（車的座標：x 往前、y 往上、z 往右，車長中點為 0、地面為 0）
import bpy, sys, bmesh
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
want = argv[1].split(',')
XC, YC, Z0 = 1.766, (-3.567 + 1.221) / 2, -0.015
def car(w): return (-(w.y - YC), w.z - Z0, -(w.x - XC))
for o in bpy.context.scene.objects:
    if o.type != 'MESH' or not o.data.materials or o.data.materials[0].name not in want: continue
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen = set()
    for v in bm.verts:
        if v.index in seen: continue
        comp = []; st = [v]; seen.add(v.index)
        while st:
            a = st.pop(); comp.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); st.append(b)
        P = [car(o.matrix_world @ c.co) for c in comp]
        mn = [min(p[k] for p in P) for k in range(3)]; mx = [max(p[k] for p in P) for k in range(3)]
        nf = len({f.index for c in comp for f in c.link_faces})
        if nf < int(argv[2]) if len(argv) > 2 else 0: continue
        print('%-9s %-20s faces %6d  x %5.2f..%5.2f  y %5.2f..%5.2f  z %5.2f..%5.2f' % (o.name, o.data.materials[0].name, nf, mn[0], mx[0], mn[1], mx[1], mn[2], mx[2]))
    bm.free()
