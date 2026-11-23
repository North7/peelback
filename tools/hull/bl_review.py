# Blender：載入 obj，用校正好的相機從指定角度拍，和照片並排
# 用法：Blender -b -P bl_review.py -- model.obj camera.json out_prefix frames(逗號) [mode]
import bpy, sys, json, math, os
import numpy as np
argv = sys.argv[sys.argv.index('--') + 1:]
objp, camp, outp, frames = argv[0], argv[1], argv[2], [int(x) for x in argv[3].split(',')]
mode = argv[4] if len(argv) > 4 else 'solid'
cam = json.load(open(camp))
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
if objp.endswith('.blend'):
    with bpy.data.libraries.load(objp) as (src, dst): dst.objects = src.objects
    for o in dst.objects:
        if o is not None: sc.collection.objects.link(o)
else:
    bpy.ops.wm.obj_import(filepath=objp, up_axis='Y', forward_axis='NEGATIVE_Z')
# 車的座標 (x 前, y 上, z 右) → Blender (X=x, Y=-z, Z=y)；obj 匯入時 up=Y, forward=-Z 會把 (x,y,z)→(x,-z,y)
W, H = 2000, 1333
sc.render.resolution_x, sc.render.resolution_y = W, H
sc.render.resolution_percentage = 50
sc.render.engine = 'BLENDER_WORKBENCH'
sc.display.shading.light = 'STUDIO'
sc.display.shading.color_type = 'MATERIAL' if mode == 'mat' else 'SINGLE'
sc.display.shading.single_color = (0.6, 0.62, 0.65)
sc.display.shading.show_cavity = True
sc.render.film_transparent = True
camd = bpy.data.cameras.new('cam'); co = bpy.data.objects.new('cam', camd); sc.collection.objects.link(co); sc.camera = co
f, D, Hc, pitch, cx, cy, a3, step, ox, oz, roll = [cam[k] for k in ['f', 'D', 'Hc', 'pitch', 'cx', 'cy', 'a3', 'step', 'ox', 'oz', 'roll']]
camd.sensor_fit = 'HORIZONTAL'; camd.sensor_width = 36
camd.lens = f / W * 36
camd.shift_x = (W / 2 - cx) / W
camd.shift_y = (cy - H / 2) / W
camd.clip_end = 200
from mathutils import Matrix, Vector
for i in frames:
    al = math.radians(a3 + (i - 3) * step)
    # 相機在轉盤座標 (0,Hc,D) 看 -Z；車點 p → 轉盤：X = x sin - z cos, Z = x cos + z sin（先減 ox,oz）
    # 反過來把相機放進車的座標：相機位置 = R^-1 (0,Hc,D) + (ox,0,oz)
    s, c = math.sin(al), math.cos(al)
    # R: (x,z)->(X,Z) = (x s - z c, x c + z s)；R^-1: (X,Z)->(x,z) = (X s + Z c, -X c + Z s)
    def inv(X, Y, Z): return (X * s + Z * c + ox, Y, -X * c + Z * s + oz)
    pc = inv(0, Hc, D)
    # 相機的軸（轉盤座標）：右 (1,0,0)、上、後 (0,0,1)，再加俯仰和滾轉
    cp, spp = math.cos(pitch), math.sin(pitch)
    back_t = (0, spp, cp)
    right_t = (1, 0, 0)
    def invd(v): return (v[0] * s + v[2] * c, v[1], -v[0] * c + v[2] * s)
    R_ = Vector(invd(right_t)); U_ = Vector(invd((0, cp, -spp))); B_ = Vector(invd(back_t))
    cr, sr = math.cos(roll), math.sin(roll)
    R2 = R_ * cr + U_ * sr; U2 = -R_ * sr + U_ * cr
    toB = lambda v: Vector((v[0], -v[2], v[1]))
    M = Matrix.Identity(4)
    for k, vec in enumerate([toB(R2), toB(U2), toB(B_)]):
        M[0][k], M[1][k], M[2][k] = vec
    M[0][3], M[1][3], M[2][3] = toB(Vector(pc))
    co.matrix_world = M
    sc.render.filepath = f'{outp}_{i:02d}.png'
    bpy.ops.render.render(write_still=True)
print('rendered', frames)
