# Blender：整理削出來的車身網格 → 平滑、減面、展 UV，烘出每個貼圖格子的位置和法線（給照片投影用）
# 用法：Blender -b -P bl_prep.py -- body.obj outdir [tris]
import bpy, bmesh, sys, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
TRIS = int(argv[2]) if len(argv) > 2 else 120000
RES = 2048
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.wm.obj_import(filepath=src, up_axis='Y', forward_axis='NEGATIVE_Z')
ob = [o for o in sc.objects if o.type == 'MESH'][0]
ob.name = 'body'
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
def mod(kind, **kw):
    m = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items(): setattr(m, k, v)
    with bpy.context.temp_override(object=ob, active_object=ob):
        r = bpy.ops.object.modifier_apply(modifier=m.name)
    return r
# 去掉小碎塊、合併重複點
bm = bmesh.new(); bm.from_mesh(ob.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
islands = []
seen = set()
for f in bm.faces:
    if f.index in seen: continue
    stack = [f]; isl = []
    seen.add(f.index)
    while stack:
        g = stack.pop(); isl.append(g)
        for e in g.edges:
            for h in e.link_faces:
                if h.index not in seen: seen.add(h.index); stack.append(h)
    islands.append(isl)
islands.sort(key=len, reverse=True)
for isl in islands[1:]: bmesh.ops.delete(bm, geom=isl, context='FACES')
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(ob.data); bm.free()
print('faces before', len(ob.data.polygons), 'islands dropped', len(islands) - 1)
# 平滑（去掉削形狀留下的小顆粒），再減面
mod('CORRECTIVE_SMOOTH', iterations=6, factor=0.5, use_only_smooth=True, smooth_type='SIMPLE') if False else None
mod('SMOOTH', factor=0.5, iterations=4)
ratio = min(1.0, TRIS / len(ob.data.polygons))
mod('DECIMATE', ratio=ratio, use_collapse_triangulate=True)
mod('TRIANGULATE')
for p in ob.data.polygons: p.use_smooth = True
print('faces after', len(ob.data.polygons))
# 展 UV
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.004, area_weight=0.0, scale_to_bounds=False)
bpy.ops.object.mode_set(mode='OBJECT')
# 用 Cycles 烘位置和法線
sc.render.engine = 'CYCLES'
sc.cycles.samples = 1
sc.cycles.device = 'CPU'
def bake(kind):
    img = bpy.data.images.new(kind, RES, RES, float_buffer=True, alpha=True)
    mat = bpy.data.materials.new('bake_' + kind)
    nt = mat.node_tree
    for n in list(nt.nodes): nt.nodes.remove(n)
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = img
    nt.links.new(geo.outputs['Position' if kind == 'pos' else 'Normal'], em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    nt.nodes.active = tex
    ob.data.materials.clear(); ob.data.materials.append(mat)
    sc.render.bake.margin = 4
    with bpy.context.temp_override(object=ob, active_object=ob, selected_objects=[ob]):
        bpy.ops.object.bake(type='EMIT')
    a = np.array(img.pixels[:], dtype=np.float32).reshape(RES, RES, 4)
    return a
P = bake('pos'); N = bake('nrm')
# Blender (X, Y, Z) → 車的座標 (x=X, y=Z, z=-Y)
def toCar(a): return np.stack([a[..., 0], a[..., 2], -a[..., 1]], -1)
valid = P[..., 3] > 0.5
np.savez_compressed(os.path.join(outdir, 'bake.npz'), pos=toCar(P[..., :3]).astype(np.float32), nrm=toCar(N[..., :3]).astype(np.float32), valid=valid)
ob.data.materials.clear()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, 'body.blend'))
# 也存一份帶 UV 的 obj（車的座標）
me = ob.data
uv = me.uv_layers.active.data
with open(os.path.join(outdir, 'body_uv.obj'), 'w') as f:
    mw = ob.matrix_world
    for v in me.vertices:
        w = mw @ v.co
        f.write('v %.5f %.5f %.5f\n' % (w.x, w.z, -w.y))
    k = 0
    for p in me.polygons:
        for li in p.loop_indices: f.write('vt %.6f %.6f\n' % tuple(uv[li].uv))
    for p in me.polygons:
        vs = list(p.vertices); ls = list(p.loop_indices)
        f.write('f ' + ' '.join('%d/%d' % (vs[j] + 1, ls[j] + 1) for j in range(len(vs))) + '\n')
print('baked', valid.sum())
