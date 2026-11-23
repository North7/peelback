import bpy, sys, math
from mathutils import Vector, Matrix
argv = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=argv[0])
sc = bpy.context.scene
sc.render.engine = 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y = 1400, 800
world = bpy.data.worlds.new('w'); sc.world = world; world.color = (0.8, 0.8, 0.82)
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3; sun.rotation_euler = (0.6, 0.3, 0.8); sc.collection.objects.link(sun)
hide = argv[3].split(',') if len(argv) > 3 and argv[3] else []
for o in sc.objects:
    if o.type == 'MESH' and o.data.materials and any(h == o.data.materials[0].name for h in hide): o.hide_render = True
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 35
C = Vector([float(v) for v in argv[2].split(',')]); T = Vector((1.766, -1.17, 0.7))
cam.location = C
cam.rotation_euler = (T - C).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = argv[1]
bpy.ops.render.render(write_still=True)
