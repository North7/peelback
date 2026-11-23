# Blender：任意視角拍模型（車的座標 x 前、y 上、z 右）
# 用法：Blender -b -P bl_free.py -- model.obj out.png "cx,cy,cz" "tx,ty,tz" lens [mat]
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
objp, out = argv[0], argv[1]
C = [float(v) for v in argv[2].split(',')]; T = [float(v) for v in argv[3].split(',')]
lens = float(argv[4]) if len(argv) > 4 else 50
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
if objp.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=objp); sc = bpy.context.scene
else:
    bpy.ops.wm.obj_import(filepath=objp, up_axis='Y', forward_axis='NEGATIVE_Z')
    for o in sc.objects:
        if o.type == 'MESH':
            for p in o.data.polygons: p.use_smooth = True
TEX = [a[4:] for a in argv if a.startswith('tex=')]
if TEX:
    img = bpy.data.images.load(TEX[0])
    mat = bpy.data.materials.new('tex'); nt = mat.node_tree
    bsdf = [n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'][0]
    t = nt.nodes.new('ShaderNodeTexImage'); t.image = img
    nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
    for o in sc.objects:
        if o.type == 'MESH': o.data.materials.clear(); o.data.materials.append(mat)
sc.render.resolution_x, sc.render.resolution_y = 1400, 900
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'MATCAP'
sc.display.shading.studio_light = 'metal_carpaint.exr' if 'metal_carpaint.exr' in [s.name for s in bpy.context.preferences.studio_lights] else sc.display.shading.studio_light
sc.display.shading.color_type = 'TEXTURE' if TEX else ('MATERIAL' if (len(argv) > 5 and argv[5] == 'mat') else 'SINGLE')
if TEX: sc.display.shading.light = 'FLAT'
sc.display.shading.single_color = (0.55, 0.57, 0.6)
sc.render.film_transparent = False
camd = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', camd); sc.collection.objects.link(co); sc.camera = co
camd.lens = lens; camd.clip_end = 300
toB = lambda v: Vector((v[0], -v[2], v[1]))
from mathutils import Matrix
fw = (toB(T) - toB(C)).normalized()
rt = fw.cross(Vector((0, 0, 1))).normalized(); up = rt.cross(fw)
M = Matrix.Identity(4)
for k, vec in enumerate([rt, up, -fw]):
    M[0][k], M[1][k], M[2][k] = vec
M[0][3], M[1][3], M[2][3] = toB(C)
co.matrix_world = M
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
