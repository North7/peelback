# 驅動馬達的掃描網格（很多塊、有破洞）→ 存成 npz（世界座標，毫米），給 du_solid.py 做成一整塊實心
import bpy, sys, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
V = []; F = []; off = 0
for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
    me = o.data; me.calc_loop_triangles(); M = o.matrix_world
    co = np.array([list(M @ v.co) for v in me.vertices], np.float32)
    tri = np.array([list(t.vertices) for t in me.loop_triangles], np.int64)
    V.append(co); F.append(tri + off); off += len(co)
np.savez_compressed(out, V=np.concatenate(V), F=np.concatenate(F))
print('DUMP', off, sum(len(f) for f in F))
