# 任意 glTF：自動框住，從斜上方和正側面各拍一張（Workbench，看結構用）
import bpy, sys, math
from mathutils import Vector
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
sc = bpy.context.scene
obs = [o for o in sc.objects if o.type == 'MESH']
pts = [o.matrix_world @ Vector(c) for o in obs for c in o.bound_box]
mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))); mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
c = (mn + mx) / 2; r = (mx - mn).length / 2
sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'; sc.display.shading.show_cavity = True
sc.render.resolution_x, sc.render.resolution_y = 1000, 700
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 40; cam.data.clip_end = r * 20; cam.data.clip_start = r * 0.01
for name, d in (('a', Vector((1, -1.2, 0.8))), ('b', Vector((0, 0, 1))), ('c', Vector((1, 0, 0.15)))):
    d.normalize(); cam.location = c + d * r * 2.6
    cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y' if name != 'b' else 'X').to_euler()
    sc.render.filepath = argv[1] + '_' + name + '.png'
    bpy.ops.render.render(write_still=True)
