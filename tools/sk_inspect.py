import bpy, sys, bmesh
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
obs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
bpy.context.view_layer.update()
mn = Vector((1e9,)*3); mx = Vector((-1e9,)*3)
for o in obs:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c); mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
print('BBOX', tuple(round(v,3) for v in mn), tuple(round(v,3) for v in mx), 'size', tuple(round(v,3) for v in (mx-mn)))
for o in obs:
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    import bmesh as B
    # 連通塊數
    seen=set(); n=0
    for v in bm.verts:
        if v.index in seen: continue
        n+=1; st=[v]; seen.add(v.index)
        while st:
            a=st.pop()
            for e in a.link_edges:
                b=e.other_vert(a)
                if b.index not in seen: seen.add(b.index); st.append(b)
    ws=[o.matrix_world @ Vector(c) for c in o.bound_box]
    a=Vector(map(min,*ws)) if False else Vector((min(w.x for w in ws),min(w.y for w in ws),min(w.z for w in ws)))
    b=Vector((max(w.x for w in ws),max(w.y for w in ws),max(w.z for w in ws)))
    print('%-10s %-22s tris %7d comps %5d bbox %s %s' % (o.name, me.materials[0].name if me.materials else '-', sum(len(p.vertices)-2 for p in me.polygons), n, tuple(round(v,2) for v in a), tuple(round(v,2) for v in b)))
    bm.free()
