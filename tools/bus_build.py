# 臺北客運 弘鉅車體 HINO HS8JRVL-UTF 低地板公車：照實車照片和弘鉅公開規格（12200 × 2500 × 3280、軸距 5875、後懸 3370）在 Blender 建外殼。
# 座標（輸出時）：x 往車頭、y 往上、z 往右（車門那一側），地面 y = 0，車長中點 x = 0。
# Blender 裡用 X = x、Y = -z、Z = y 建（Z 朝上）。
# 用法：Blender -b -P tools/bus_build.py -- out_dir [review_prefix]
import bpy, bmesh, sys, os, math, json, zlib
import numpy as np
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
outdir = argv[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
review = argv[1] if len(argv) > 1 else None

# ---------------- 尺寸 ----------------
# 車身長：弘鉅規格 12200 含前面兔耳後照鏡；車身本體 = 前懸 2570（和泰 HS8JRVL 底盤規格）+ 軸距 5875 + 後懸 3370 = 11.815
L, W = 11.815, 2.5
HL, HW = L / 2, W / 2
ROOF = 3.02          # 車頂（不含冷氣機）
SKIRT = 0.30         # 車身下緣離地
FA = HL - 2.57       # 前軸 3.3375
RA = FA - 5.875      # 後軸 -2.5375
TIRE_R = 0.478
ARCH_R = 0.60
WB, WT = 1.28, 2.78  # 側窗下緣、上緣
# 門、窗（x 從前往後）
# 門、窗：照 KKA-3180 車門側正側面照片（以前軸、軸距比例量）和新店客運同款固亞車體的側面照：前門寬約 1.0 m、緊貼車頭角，
# 中門寬約 1.1 m、從前軸後 2.6 m 開始；兩門之間 3 格窗，中門後 3 格窗
DOOR_F = (5.42, 4.42)
DOOR_M = (0.66, -0.46)
WIN_R = [(4.34, 3.08), (3.00, 1.84), (1.76, 0.74), (-0.54, -2.24), (-2.32, -4.00), (-4.08, -5.40)]          # 車門側
WIN_L = [(5.62, 4.55), (4.47, 3.00), (2.92, 1.45), (1.37, -0.10), (-0.18, -1.65), (-1.73, -3.20), (-3.28, -4.75), (-4.83, -5.40)]  # 司機側（第一個是司機窗；左後段第一格是緊急出口）

def B(x, y, z):  # 我們的座標 → Blender
    return Vector((x, -z, y))

mats = {}
def mat(name, col, rough=0.5, metal=0.0):
    if name in mats: return mats[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*col, 1)
    mats[name] = m
    return m

def srgb(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v + 0.055) / 1.055) ** 2.4 if v > 0.04045 else v / 12.92 for v in c)

M_PAINT = mat('paint', srgb('#f4f3ef'), 0.35)
M_BLACK = mat('frit', srgb('#111214'), 0.4)
M_GLASS = mat('glass', srgb('#1a242b'), 0.05)
M_RUBBER = mat('rubber', srgb('#151515'), 0.8)

def new_obj(name, me, m=None):
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    if m: o.data.materials.append(m)
    return o

def box(name, c, s, m=None, bevel=0.0, seg=3):
    """c：中心（我們的座標）、s：大小 (x, y, z)；bevel：圓角半徑"""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * s[0], -v.co.z * 0 + v.co.y * s[2], v.co.z * s[1]))
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me, m)
    o.location = B(*c)
    if bevel > 0:
        md = o.modifiers.new('bv', 'BEVEL'); md.width = bevel; md.segments = seg; md.limit_method = 'NONE'
    return o

def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for md in list(o.modifiers):
        with bpy.context.temp_override(object=o, active_object=o):
            bpy.ops.object.modifier_apply(modifier=md.name)

def boolean(o, cutters, op='DIFFERENCE'):
    """把一堆刀子合成一個再一次切（快很多、也比較不會出錯）"""
    for c in cutters: apply_all(c)
    if len(cutters) > 1:
        with bpy.context.temp_override(active_object=cutters[0], selected_editable_objects=cutters, selected_objects=cutters):
            bpy.ops.object.join()
    cut = cutters[0]
    md = o.modifiers.new('b', 'BOOLEAN'); md.operation = op; md.object = cut; md.solver = 'EXACT'; md.use_self = True; md.use_hole_tolerant = True
    apply_all(o)
    bpy.data.objects.remove(cut)

# ---------------- 車身：一個圓角盒子 ----------------
def body_shell():
    me = bpy.data.meshes.new('body')
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        x, y, z = v.co.x, v.co.y, v.co.z
        v.co = Vector((x * L, y * W, SKIRT + (z + 0.5) * (ROOF - SKIRT)))
    bm.edges.ensure_lookup_table()
    bw = bm.edges.layers.float.new('bevel_weight_edge')
    for e in bm.edges:
        a, b2 = e.verts[0].co, e.verts[1].co
        d = (b2 - a).normalized()
        mid = (a + b2) / 2
        top = mid.z > ROOF - 0.01
        bot = mid.z < SKIRT + 0.01
        if abs(d.z) > 0.9:                       # 直的角：前面圓一點，後面小一點
            e[bw] = 0.55 if mid.x > 0 else 0.42
        elif top and abs(d.x) > 0.9: e[bw] = 0.62   # 車頂兩側
        elif top and mid.x > 0: e[bw] = 1.0         # 車頂前緣（圓圓的）
        elif top: e[bw] = 0.55                      # 車頂後緣
        else: e[bw] = 0.08                          # 下緣
    bm.to_mesh(me); bm.free()
    o = new_obj('body', me, M_PAINT)
    md = o.modifiers.new('bv', 'BEVEL'); md.width = 0.34; md.segments = 10; md.limit_method = 'WEIGHT'
    apply_all(o)
    sol = o.modifiers.new('sol', 'SOLIDIFY'); sol.thickness = 0.035; sol.offset = -1
    apply_all(o)
    return o

body = body_shell()
print('BODY0', len(body.data.vertices))

# ---------------- 開口：側面一整條窗帶（實車窗柱是黑的）、車門、擋風玻璃、路線牌、輪拱 ----------------
BAND_L = (5.66, -5.44)
BAND_R = (4.38, -5.44)
cut = []
cut.append(box('c', ((BAND_L[0] + BAND_L[1]) / 2, (WB + WT) / 2, -HW), (BAND_L[0] - BAND_L[1], WT - WB, 0.3), bevel=0.06))
cut.append(box('c', ((BAND_R[0] + BAND_R[1]) / 2, (WB + WT) / 2, HW), (BAND_R[0] - BAND_R[1], WT - WB, 0.3), bevel=0.06))
for (x0, x1) in (DOOR_F, DOOR_M): cut.append(box('c', ((x0 + x1) / 2, (0.20 + WT) / 2, HW), (x0 - x1, WT - 0.20, 0.3), bevel=0.04))
cut.append(box('c', (HL, 1.86, 0), (0.4, 1.52, 2.26), bevel=0.09))
cut.append(box('c', (HL, 2.80, 0), (0.4, 0.30, 2.06), bevel=0.05))
cut.append(box('c', (-HL, 2.74, 0), (0.4, 0.30, 1.76), bevel=0.04))
for ax in (FA, RA):
    for s_ in (1, -1):
        me = bpy.data.meshes.new('arch'); bm = bmesh.new()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=56, radius1=ARCH_R, radius2=ARCH_R, depth=0.6)
        bm.to_mesh(me); bm.free()
        o = new_obj('c', me); o.rotation_euler = (math.pi / 2, 0, 0); o.location = B(ax, TIRE_R + 0.02, s_ * HW)
        cut.append(o)
        cut.append(box('c', (ax, 0.2, s_ * HW), (ARCH_R * 2, 0.6, 0.6)))
boolean(body, cut)
print('BODY1', len(body.data.vertices))

# ---------------- 其他零件：每一個都記「零件、材質標籤」 ----------------
PARTS = []   # (obj, part, tag)
def keep(o, part, tag):
    PARTS.append((o, part, tag)); return o

def tube(name, pts, r, m=None):
    """沿著一串點的圓管（我們的座標）"""
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts): sp.points[i].co = (*B(*p), 1)
    cu.bevel_depth = r; cu.bevel_resolution = 4; cu.use_fill_caps = True
    o = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active = o
    with bpy.context.temp_override(object=o, active_object=o, selected_objects=[o], selected_editable_objects=[o]):
        bpy.ops.object.convert(target='MESH')
    o = bpy.context.view_layer.objects.active
    return o

def cyl(name, c, r, depth, axis='z', seg=32):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me)
    o.rotation_euler = {'z': (math.pi / 2, 0, 0), 'x': (0, math.pi / 2, 0), 'y': (0, 0, 0)}[axis]
    o.location = B(*c)
    return o

# 側窗：每一格玻璃、中間黑色窗柱、上面一排小推窗的橫框
def side_glass(bays, side, band):
    z = side * (HW - 0.012)
    x0, x1 = band
    keep(box('frit', ((x0 + x1) / 2, WB + 0.02, side * (HW - 0.02)), (x0 - x1, 0.05, 0.02)), 'side', 'frit')
    keep(box('frit', ((x0 + x1) / 2, WT - 0.02, side * (HW - 0.02)), (x0 - x1, 0.05, 0.02)), 'side', 'frit')
    edges = []
    for i, (a, b) in enumerate(bays):
        keep(box('glass', ((a + b) / 2, (WB + WT) / 2, z), (a - b - 0.06, WT - WB - 0.06, 0.012), bevel=0.02), 'side', 'glass')
        edges += [a, b]
        # 上面的小推窗：橫框＋一根直框（司機窗是左右推的，直框在中間）
        if side < 0 and i == 0:
            keep(box('frit', ((a + b) / 2, (WB + WT) / 2, side * (HW - 0.004)), (0.05, WT - WB - 0.04, 0.02)), 'side', 'frit')
        elif i % 2 == 0 or side > 0:
            yv = WT - 0.42
            keep(box('frit', ((a + b) / 2, yv, side * (HW - 0.004)), (a - b - 0.05, 0.035, 0.02)), 'side', 'frit')
            keep(box('frit', (a - (a - b) * 0.5, (yv + WT) / 2, side * (HW - 0.004)), (0.03, WT - yv - 0.04, 0.02)), 'side', 'frit')
    xs = sorted(set([round(e, 3) for e in edges] + [x0, x1]))
    for e in xs:
        keep(box('frit', (e, (WB + WT) / 2, side * (HW - 0.016)), (0.09, WT - WB - 0.01, 0.03), bevel=0.01), 'side', 'frit')
side_glass(WIN_L, -1, BAND_L)
side_glass(WIN_R, 1, BAND_R)

# 車門：兩扇玻璃門，黑框、中間橡膠條（等一下在 app 裡會左右滑開）
for di, (a, b) in enumerate((DOOR_F, DOOR_M)):
    w = (a - b) / 2
    for k in (0, 1):
        x0 = a - k * w
        tag = '%s%d' % ('FM'[di], k)
        z = HW + 0.004
        y0, y1 = 0.26, WT - 0.04
        fr = [box('f', (x0 - w / 2, y0 + 0.04, z), (w - 0.02, 0.08, 0.04)), box('f', (x0 - w / 2, y1 - 0.04, z), (w - 0.02, 0.08, 0.04)),
              box('f', (x0 - 0.035, (y0 + y1) / 2, z), (0.05, y1 - y0, 0.04)), box('f', (x0 - w + 0.035, (y0 + y1) / 2, z), (0.05, y1 - y0, 0.04)),
              box('f', (x0 - w / 2, 1.02, z), (w - 0.08, 0.05, 0.03))]
        for f in fr: keep(f, 'doors', tag + '|frame')
        keep(box('g', (x0 - w / 2, (y0 + y1) / 2, z), (w - 0.08, y1 - y0 - 0.12, 0.012)), 'doors', tag + '|glass')
        edge = x0 - w + 0.012 if k == 0 else x0 - 0.012
        keep(box('r', (edge, (y0 + y1) / 2, z + 0.005), (0.025, y1 - y0, 0.05), bevel=0.01), 'doors', tag + '|rubber')
        # 門把手（直的不鏽鋼管，在玻璃裡面）
        keep(tube('h', [(x0 - w * 0.55, 1.15, HW - 0.04), (x0 - w * 0.55, 1.9, HW - 0.04)], 0.016), 'doors', tag + '|chrome')

# ---------------- 車頭 ----------------
# 擋風玻璃（往內一點）、外面一圈黑框
keep(box('ws', (HL - 0.012, 1.86, 0), (0.012, 1.48, 2.22), bevel=0.06), 'front', 'glass')
keep(box('wsf', (HL - 0.022, 1.86, 0), (0.02, 1.56, 2.30), bevel=0.08), 'front', 'frit')
keep(box('wsf', (HL - 0.022, 2.80, 0), (0.02, 0.34, 2.10), bevel=0.05), 'front', 'frit')
keep(box('sign', (HL - 0.014, 2.80, 0), (0.012, 0.26, 2.0), bevel=0.03), 'sign', 'signF')
# 頭燈：橘色燈殼（凸出來一點）、裡面一顆投射式頭燈、外側一顆圓的琥珀色方向燈、內側一顆小燈
for s_ in (1, -1):
    zc = s_ * 0.86
    keep(box('pod', (HL + 0.012, 0.60, zc), (0.06, 0.25, 0.64), bevel=0.06, seg=5), 'front', 'orange')
    keep(box('lens', (HL + 0.04, 0.60, zc - s_ * 0.04), (0.02, 0.15, 0.36), bevel=0.05, seg=4), 'front', 'head')
    keep(box('refl', (HL + 0.03, 0.60, zc - s_ * 0.04), (0.012, 0.17, 0.40), bevel=0.05, seg=4), 'front', 'chrome')
    keep(cyl('turn', (HL + 0.04, 0.60, zc + s_ * 0.235), 0.045, 0.03, 'x'), 'front', 'turn')
    keep(cyl('pos', (HL + 0.04, 0.62, zc - s_ * 0.29), 0.022, 0.02, 'x'), 'front', 'pos')
# 保險桿（下面一條凸出來）、底下黑色的唇
keep(box('bump', (HL + 0.03, 0.37, 0), (0.08, 0.14, W - 0.08), bevel=0.04, seg=4), 'front', 'white')
keep(box('lip', (HL - 0.02, 0.29, 0), (0.12, 0.04, W - 0.2), bevel=0.015), 'front', 'black')
keep(box('plateF', (HL + 0.075, 0.40, 0), (0.008, 0.14, 0.44), bevel=0.01), 'front', 'plateF')
# 車頂前緣的兩顆小燈（琥珀色）
for s_ in (1, -1):
    keep(box('mk', (HL - 0.14, ROOF + 0.005, s_ * 1.05), (0.1, 0.04, 0.1), bevel=0.015), 'front', 'pos')
# 雨刷：兩支，躺在擋風玻璃下緣
for s_ in (1, -1):
    pz = s_ * 0.28
    keep(tube('wa', [(HL + 0.02, 1.13, pz), (HL + 0.045, 1.16, pz - s_ * 0.05), (HL + 0.045, 1.2, pz - s_ * 0.95)], 0.012), 'front', 'black')
    keep(box('wb', (HL + 0.05, 1.19, pz - s_ * 0.55), (0.025, 0.03, 0.95), bevel=0.008), 'front', 'black')
    keep(cyl('wp', (HL + 0.02, 1.13, pz), 0.03, 0.04, 'x', 16), 'front', 'black')
# 後照鏡：從車頂前面兩角伸出來的黑色兔耳臂，鏡子垂在前面兩邊
for s_ in (1, -1):
    z0 = s_ * 1.16
    pts = [(HL - 0.25, 2.92, z0), (HL + 0.05, 2.96, s_ * 1.30), (HL + 0.32, 2.86, s_ * 1.45), (HL + 0.42, 2.55, s_ * 1.5), (HL + 0.42, 2.30, s_ * 1.5)]
    keep(tube('arm', pts, 0.028), 'mirrors', 'black')
    keep(box('head', (HL + 0.42, 2.02, s_ * 1.5), (0.1, 0.46, 0.24), bevel=0.04, seg=4), 'mirrors', 'black')
    keep(box('mg', (HL + 0.36, 2.02, s_ * 1.5), (0.012, 0.40, 0.19), bevel=0.02), 'mirrors', 'mirror')
    # 下面一顆小的廣角鏡
    keep(tube('arm2', [(HL + 0.42, 2.30, s_ * 1.5), (HL + 0.5, 2.2, s_ * 1.42)], 0.012), 'mirrors', 'black')

# ---------------- 車尾 ----------------
keep(box('rs', (-HL + 0.014, 2.74, 0), (0.012, 0.26, 1.72), bevel=0.03), 'sign', 'signR')
keep(box('rsf', (-HL + 0.022, 2.74, 0), (0.02, 0.34, 1.82), bevel=0.04), 'rear', 'frit')
for s_ in (1, -1):
    zc = s_ * 1.06
    keep(box('tlh', (-HL - 0.01, 1.0, zc), (0.05, 0.62, 0.20), bevel=0.04, seg=4), 'rear', 'black')
    for i, (yy, tg) in enumerate([(1.22, 'turn'), (1.08, 'tail'), (0.94, 'tail'), (0.80, 'rev')]):
        keep(cyl('tl', (-HL - 0.035, yy, zc), 0.055, 0.03, 'x', 24), 'rear', tg)
    keep(box('rmk', (-HL + 0.14, ROOF + 0.005, s_ * 1.05), (0.1, 0.04, 0.1), bevel=0.015), 'rear', 'tail')
# 引擎蓋（大大的白色後門）的縫、保險桿、車牌
for (c, sz) in [((-HL - 0.004, 1.30, 0), (0.006, 0.012, 1.62)), ((-HL - 0.004, 0.62, 0), (0.006, 0.012, 1.62)),
                ((-HL - 0.004, 0.96, 0.81), (0.006, 0.68, 0.012)), ((-HL - 0.004, 0.96, -0.81), (0.006, 0.68, 0.012)),
                ((-HL - 0.004, 2.0, 0), (0.006, 0.012, 1.62)), ((-HL - 0.004, 1.65, 0.81), (0.006, 0.7, 0.012)), ((-HL - 0.004, 1.65, -0.81), (0.006, 0.7, 0.012))]:
    keep(box('seam', c, sz), 'rear', 'black')
keep(box('rbump', (-HL - 0.03, 0.40, 0), (0.08, 0.2, W - 0.06), bevel=0.04, seg=4), 'rear', 'black')
keep(box('plateR', (-HL - 0.012, 0.82, 0.0), (0.008, 0.14, 0.44), bevel=0.01), 'rear', 'plateR')

# ---------------- 車頂：冷氣機、兩個逃生天窗 ----------------
# 冷氣機（頂置式）：照 KKA-3180 側面照，從前軸稍後延伸到中門前，長約 4.5 m
keep(box('ac', (1.45, ROOF + 0.12, 0), (4.5, 0.26, 2.0), bevel=0.11, seg=6), 'aircon', 'white')
for xg in (2.9, 1.95, 1.0, 0.05):
    keep(box('acg', (xg, ROOF + 0.252, 0), (0.8, 0.012, 1.5), bevel=0.02), 'aircon', 'grey')
for xh in (-1.6, -3.9):   # 逃生天窗：中段一個、後段一個（車內照片）
    keep(box('hatch', (xh, ROOF + 0.03, 0), (0.75, 0.06, 0.75), bevel=0.03), 'roof', 'grey')

# ---------------- 側面：琥珀色側邊燈、最下面一條黑色橡膠條 ----------------
for s_ in (1, -1):
    for xm in [5.0 if s_ < 0 else 5.6, 2.3, 1.2 if s_ < 0 else 0.9, -0.6 if s_ < 0 else -1.0, -3.6, -4.9]:
        if s_ > 0 and (DOOR_F[1] - 0.05 < xm < DOOR_F[0] + 0.05 or DOOR_M[1] - 0.05 < xm < DOOR_M[0] + 0.05): continue
        if abs(xm - FA) < ARCH_R + 0.05 or abs(xm - RA) < ARCH_R + 0.05: continue
        keep(box('sm', (xm, 0.52, s_ * (HW + 0.008)), (0.09, 0.045, 0.02), bevel=0.01), 'side', 'marker')
    keep(box('skirt', (0, 0.32, s_ * (HW + 0.006)), (L - 0.4, 0.05, 0.02), bevel=0.01), 'side', 'black')

# 右後角上面直條百葉（散熱器出風，KKA-2531／KKA-3131 照片）、下面兩塊檢修蓋；左邊後輪前面腰線上的圓形加油口蓋
keep(box('louv', (-5.62, 1.85, HW + 0.002), (0.32, 0.62, 0.02), bevel=0.01), 'sideR', 'black')
for k in range(7):
    keep(box('louvS', (-5.62, 1.6 + k * 0.083, HW + 0.012), (0.27, 0.018, 0.012)), 'sideR', 'grey')
for (c, sz) in [((-5.42, 0.82, HW + 0.002), (0.62, 0.012, 0.01)), ((-5.42, 0.46, HW + 0.002), (0.62, 0.012, 0.01)), ((-5.11, 0.64, HW + 0.002), (0.012, 0.37, 0.01)), ((-5.73, 0.64, HW + 0.002), (0.012, 0.37, 0.01)),
                ((-5.42, 1.22, HW + 0.002), (0.62, 0.012, 0.01)), ((-5.11, 1.02, HW + 0.002), (0.012, 0.4, 0.01)), ((-5.73, 1.02, HW + 0.002), (0.012, 0.4, 0.01))]:
    keep(box('seamR', c, sz), 'sideR', 'black')
keep(cyl('fuel', (RA + 0.95, 1.05, -HW - 0.004), 0.085, 0.012, 'z', 32), 'sideL', 'grey')
# 擋泥板：每個輪子後面一片黑色橡膠
for ax in (FA, RA):
    for s_ in (1, -1):
        keep(box('flap', (ax - ARCH_R - 0.03, 0.3, s_ * (HW - 0.17)), (0.02, 0.38, 0.3)), 'mudflaps', 'rubber')

# ---------------- 輪子（樣板：輪軸在原點、沿 z；app 裡放到六個位置） ----------------
def lathe(name, prof, seg=72):
    """prof：[(r, z)]，繞 z 軸轉一圈"""
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    rings = []
    for (rr, zz) in prof:
        ring = [bm.verts.new((rr * math.cos(2 * math.pi * k / seg), rr * math.sin(2 * math.pi * k / seg), zz)) for k in range(seg)]
        rings.append(ring)
    for a, b2 in zip(rings[:-1], rings[1:]):
        for k in range(seg):
            bm.faces.new((a[k], a[(k + 1) % seg], b2[(k + 1) % seg], b2[k]))
    bm.to_mesh(me); bm.free()
    return new_obj(name, me)
TR, TW = TIRE_R, 0.275
tire = []
for i in range(17):
    t = i / 16
    zz = -TW / 2 + TW * t
    side_k = abs(t - 0.5) * 2
    rr = TR * (0.62 + 0.38 * math.sqrt(max(0, 1 - side_k ** 6)))
    if 0.18 < t < 0.82 and i % 3 == 0: rr -= 0.012   # 胎紋的溝
    tire.append((rr, zz))
WT_O = lathe('tire', tire)
WHEEL = [(WT_O, 'tire')]
rim = [(0.286, -0.11), (0.29, -0.1), (0.29, 0.1), (0.286, 0.11), (0.25, 0.115), (0.24, 0.06), (0.17, 0.05), (0.15, 0.08), (0.11, 0.085), (0.105, 0.12), (0.06, 0.135), (0.001, 0.14)]
WHEEL.append((lathe('rimF', rim, 48), 'rimF'))
rimR = [(0.286, -0.11), (0.29, -0.1), (0.29, 0.1), (0.286, 0.11), (0.25, 0.115), (0.235, 0.02), (0.17, -0.02), (0.12, -0.0), (0.06, 0.01), (0.001, 0.012)]
WHEEL.append((lathe('rimR', rimR, 48), 'rimR'))
# 鋼圈上的 10 個圓孔（黑）和 10 顆螺帽
for k in range(10):
    a = 2 * math.pi * k / 10
    o = cyl('hole', (0, 0, 0), 0.03, 0.01, 'y', 16); o.location = (0.205 * math.cos(a), 0.205 * math.sin(a), 0.06); o.rotation_euler = (0, 0, 0)
    WHEEL.append((o, 'holeF'))
    o = cyl('nut', (0, 0, 0), 0.018, 0.03, 'y', 6); o.location = (0.125 * math.cos(a + 0.3), 0.125 * math.sin(a + 0.3), 0.095); o.rotation_euler = (0, 0, 0)
    WHEEL.append((o, 'nutF'))



# ---------------- 座椅樣板（原點在椅腳正下方地板上，面向 +x）：紅色坐墊靠背、灰色塑膠背殼、上面不鏽鋼握把、灰色椅腳 ----------------
SEAT = []
def seat_part(o, tag): SEAT.append((o, tag)); return o
# 坐墊：前面圓一點、微微往後傾
o = box('cush', (0.04, 0.44, 0), (0.42, 0.09, 0.42), bevel=0.04, seg=4); o.rotation_euler = (0, math.radians(-4), 0); seat_part(o, 'cushion')
# 靠背：往後仰 12 度，上面窄一點
me = bpy.data.meshes.new('back'); bm = bmesh.new()
bmesh.ops.create_cube(bm, size=1.0)
for v in bm.verts:
    x, y, z = v.co.x, v.co.y, v.co.z
    h = 0.52; t = (z + 0.5)
    w = 0.42 - 0.06 * t
    v.co = Vector((x * 0.07 - t * h * math.sin(math.radians(12)), y * w, 0.5 + t * h * math.cos(math.radians(12))))
bm.to_mesh(me); bm.free()
o = new_obj('back', me); md = o.modifiers.new('bv', 'BEVEL'); md.width = 0.03; md.segments = 4; seat_part(o, 'cushion')
# 背殼：靠背後面一片灰色塑膠，包住邊緣
me2 = me.copy(); o2 = new_obj('shell', me2); o2.location = (-0.03, 0, 0); o2.scale = (1.0, 1.06, 1.03)
md = o2.modifiers.new('bv', 'BEVEL'); md.width = 0.03; md.segments = 4; seat_part(o2, 'shell')
# 坐墊下面的殼、椅腳（一根粗柱＋往牆邊的橫桿）
seat_part(box('pan', (0.03, 0.37, 0), (0.40, 0.06, 0.40), bevel=0.02), 'shell')
seat_part(cyl('leg', (0.0, 0.17, 0), 0.03, 0.34, 'y', 16), 'metal')
seat_part(box('foot', (0.0, 0.01, 0), (0.26, 0.02, 0.12), bevel=0.008), 'metal')
# 上面的握把：靠背頂上一個不鏽鋼 U 形管
top_x = -0.52 * math.sin(math.radians(12)) - 0.05
seat_part(tube('grab', [(top_x, 0.99, -0.17), (top_x - 0.02, 1.08, -0.15), (top_x - 0.02, 1.08, 0.15), (top_x, 0.99, 0.17)], 0.014), 'chrome')

# 三角形吊環（掛在橫桿下面；原點在橫桿）：灰色皮帶＋三角形握把
STRAP = []
STRAP.append((box('band', (0, -0.11, 0), (0.03, 0.22, 0.006), bevel=0.002), 'band'))
tri = []
for k in range(25):
    a = 2 * math.pi * k / 24
    # 圓角三角形：用三個圓弧接起來
    r = 0.07 + 0.012 * math.cos(3 * a)
    tri.append((0, -0.29 + r * math.sin(a + math.pi / 2), r * math.cos(a + math.pi / 2)))
STRAP.append((tube('tri', tri, 0.011), 'handle'))
# ================= 輸出：每個零件 → 換成我們的座標、分組、量化、壓縮 =================
def tri_data(o):
    """套用修改器、三角化、尖角的邊分開（硬邊才不會被抹平）→ (P[n,3] 我們的座標, T[m,3], N[m,3] 面法線)"""
    apply_all(o)
    bm = bmesh.new(); bm.from_mesh(o.data); bm.transform(o.matrix_world)
    sharp = [e for e in bm.edges if e.calc_face_angle(0) > math.radians(38)]
    bmesh.ops.split_edges(bm, edges=sharp)
    bmesh.ops.triangulate(bm, faces=bm.faces[:])
    bm.verts.index_update(); bm.normal_update()
    V = np.array([list(v.co) for v in bm.verts], np.float32)
    F = np.array([[v.index for v in f.verts] for f in bm.faces], np.int64).reshape(-1, 3)
    Nf = np.array([list(f.normal) for f in bm.faces], np.float32).reshape(-1, 3)
    bm.free()
    P = np.stack([V[:, 0], V[:, 2], -V[:, 1]], -1)
    N = np.stack([Nf[:, 0], Nf[:, 2], -Nf[:, 1]], -1)
    return P, F, N
groups = {}
def add(part, tag, P, F):
    if not len(F): return
    used = np.unique(F); remap = np.full(len(P), -1); remap[used] = np.arange(len(used))
    groups.setdefault((part, tag), []).append((P[used], remap[F]))

# 車身：照位置分成車頭、車尾、車頂、左右兩面；朝裡面的面另外一組（車廂內牆）
P, F, N = tri_data(body)
C = P[F].mean(1)
region = np.where(C[:, 0] > HL - 0.30, 0, np.where(C[:, 0] < -HL + 0.30, 1, np.where(C[:, 1] > WT + 0.06, 2, np.where(C[:, 2] > 0, 3, 4))))
names = ['front', 'rear', 'roof', 'sideR', 'sideL']
out_dir = np.stack([np.sign(C[:, 0]) * (np.abs(C[:, 0]) > HL - 0.30), (C[:, 1] > WT + 0.06).astype(np.float32), np.sign(C[:, 2])], -1)
inward = np.where(region <= 1, N[:, 0] * np.sign(C[:, 0]) < -0.2, np.where(region == 2, N[:, 1] < -0.2, N[:, 2] * np.sign(C[:, 2]) < -0.2))
bottom = (C[:, 1] < SKIRT + 0.06) & (np.abs(N[:, 1]) > 0.7)   # 車身底板（地板另外做）：不要，不然拆開時會變成長長的三角形
for r_ in range(5):
    for inn in (False, True):
        m = (region == r_) & (inward == inn) & ~bottom
        add(names[r_], 'inner' if inn else 'paint', P, F[m])
for (o, tag) in SEAT:
    P, F, N = tri_data(o); add('seatT', tag, P, F)
for (o, tag) in STRAP:
    P, F, N = tri_data(o); add('strapT', tag, P, F)
for (o, part, tag) in PARTS:
    if o.type != 'MESH': continue
    P, F, N = tri_data(o)
    if part == 'side': part = 'sideR' if P[:, 2].mean() > 0 else 'sideL'
    add(part, tag, P, F)

blob = bytearray(); meta = {'groups': [], 'dims': {'L': L, 'W': W, 'ROOF': ROOF, 'SKIRT': SKIRT, 'FA': FA, 'RA': RA, 'WB': WB, 'WT': WT, 'DOOR_F': DOOR_F, 'DOOR_M': DOOR_M}}
def align(n):
    while len(blob) % n: blob.append(0)
stats = {}
for (part, tag), lst in sorted(groups.items()):
    Ps, Ts, off = [], [], 0
    for P, T in lst: Ps.append(P); Ts.append(T + off); off += len(P)
    P = np.concatenate(Ps).astype(np.float32); T = np.concatenate(Ts).astype(np.uint32).ravel()
    g = {'part': part, 'tag': tag, 'nv': len(P), 'ni': len(T)}
    lo = P.min(0); stp = np.maximum((P.max(0) - lo) / 65535.0, 1e-9)
    g['q'] = [float(v) for v in lo] + [float(v) for v in stp]
    align(4); g['pos'] = len(blob); blob.extend(np.round((P - lo) / stp).astype(np.uint16).tobytes())
    align(4)
    if len(P) < 65536: g['idx16'] = len(blob); blob.extend(T.astype(np.uint16).tobytes())
    else: g['idx'] = len(blob); blob.extend(T.tobytes())
    meta['groups'].append(g); stats[part] = stats.get(part, 0) + len(T) // 3
os.makedirs(outdir, exist_ok=True)
open(os.path.join(outdir, 'bus.bin'), 'wb').write(zlib.compress(bytes(blob), 9))
json.dump(meta, open(os.path.join(outdir, 'bus.json'), 'w'), indent=1)
print('OUT', stats, 'tris', sum(stats.values()), 'bytes', len(blob), 'groups', len(meta['groups']))

if review:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    sc.render.resolution_x = 1400; sc.render.resolution_y = 860
    cols = {'glass': '#2a3640', 'frit': '#111214', 'orange': '#ef6a1c', 'head': '#e8eef2', 'chrome': '#c8ccd0', 'turn': '#f6a521', 'pos': '#fff1c8',
            'white': '#f4f3ef', 'black': '#151515', 'plateF': '#e8efe6', 'plateR': '#e8efe6', 'signF': '#0b0b0b', 'signR': '#0b0b0b', 'mirror': '#8aa0b0',
            'tail': '#c8281e', 'rev': '#f2f2f2', 'grey': '#9aa0a6', 'marker': '#f6a521', 'rubber': '#1a1a1a', 'tire': '#1b1c1e', 'rimF': '#d3d6da', 'rimR': '#d3d6da', 'holeF': '#222222', 'nutF': '#bbbbbb'}
    for (o, part, tag) in PARTS:
        key = tag.split('|')[-1]
        if key in ('frame',): key = 'black'
        o.data.materials.clear() if o.type == 'MESH' else None
        if o.type == 'MESH': o.data.materials.append(mat('v_' + key, srgb(cols.get(key, '#888888'))))
    # 輪子放上去看
    for (o, tag) in WHEEL:
        if o.type == 'MESH':
            o.data.materials.clear(); o.data.materials.append(mat('v_' + tag, srgb(cols.get(tag, '#888888'))))
    import copy
    for ax in (FA, RA):
        for s_ in (1, -1):
            for (o, tag) in WHEEL:
                c = o.copy(); c.data = o.data; bpy.context.scene.collection.objects.link(c)
                c.matrix_world = Matrix.Translation(B(ax, TIRE_R, s_ * (HW - 0.2))) @ Matrix.Rotation(-s_ * math.pi / 2, 4, 'X') @ o.matrix_world
    for (o, tag) in WHEEL: o.hide_render = True
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.lens = 50
    for i, (pos, tgt) in enumerate([((18, 3.0, -10), (0, 1.5, 0)), ((17, 2.6, 11), (0, 1.5, 0)), ((-16, 3.5, 9), (0, 1.5, 0)), ((10.5, 1.3, 2.2), (5.5, 1.2, 0))]):
        cam.location = B(*pos); cam.rotation_euler = (B(*tgt) - B(*pos)).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = f'{review}_{i}.png'; bpy.ops.render.render(write_still=True)
