# 台灣高鐵 700T：Sketchfab 上 Basic Hsu（Hsu.Pei.Ge）做的兩個模型（CC BY 4.0）→ 剝剝看的零件
#   loco：「THSR 700T / Interior (Locomotive 01)」車頭那一節（1、12 車）
#   cabin：「Taiwan HSR700T / Interior (Cabin 02)」中間的客車廂（2–11 車）
# 兩個模型的比例不一樣（作者說是照三視圖目測），這裡各自照實車尺寸校正：
#   車寬 3.38 m、車高 3.65 m（軌面到車頂，不含車頂設備）、車體長 頭車 26.75 m／中間車 24.5 m（JRTR 2007、川崎重工）
#   車輪直徑兩個模型量起來都是 0.85 m 左右，和實車 860 mm 對得上，所以寬、高用同一個比例。
# 座位不用模型裡的（排數、商務車廂和官方座位圖不一樣），網頁上照高鐵官網的座位圖一節一節排。
# 輸出 train/sk/train.bin（zlib）＋ train.json；座標：x 往 1 車車頭（南）、y 往上（軌面 0）、z 往右，單位公尺，每節車的中心在 x = 0。
# 用法：Blender -b -P tools/train_export.py -- ref/train/sketchfab train/sk
import bpy, sys, os, json, zlib, shutil
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, outdir = argv[0], argv[1]
os.makedirs(outdir, exist_ok=True)

TRACK = {'Concrete_blinn', 'Rough_blinn', 'Rusted_blinn', 'Gary_blinn'}
SEATS = {'Seat_blinn2', 'Seat_Gray_blinn1', 'Seat_BU_lambert', 'Net_lambert', 'Seat_Number_blinn'}
WHEELS = {'blinn31', 'Wheel_blinn31'}
GLASS = {'Glass_blinn32', 'blinn34'}

# 每個模型：寬高比例 s、長度比例 sL、軌面高度、車頭尖端（loco）或車體中心（cabin）在原模型的 y
MODELS = {
    'loco': dict(s=3.38 / 2.232, body=(-7.81, 9.57), lenReal=26.75, rail=0.34, roof=2.69),
    'cabin': dict(s=3.38 / 3.99, body=(-10.94, 17.16), lenReal=24.5, rail=0.62, roof=4.82),
}

def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.context.scene.objects if o.type == 'MESH' and len(o.data.polygons)]

def mesh_arrays(o, xf):
    """一個物件 → (P[n,3], N[n,3], UV[n,2] 或 None, T[m,3])；頂點照 (原頂點, uv, 法線) 拆開，硬邊才留得住"""
    me = o.data
    me.calc_loop_triangles()
    M = o.matrix_world
    R = M.to_3x3().inverted().transposed()
    uvl = me.uv_layers.active.data if me.uv_layers.active else None
    co = np.array([list(M @ v.co) for v in me.vertices])
    key = {}
    P, N, UV, T = [], [], [], []
    for tri in me.loop_triangles:
        f = []
        for li, vi in zip(tri.loops, tri.vertices):
            n = (R @ Vector(me.corner_normals[li].vector)).normalized() if hasattr(me, 'corner_normals') else (R @ me.loops[li].normal).normalized()
            uv = tuple(uvl[li].uv) if uvl else (0.0, 0.0)
            k = (vi, round(uv[0], 4), round(uv[1], 4), round(n.x, 2), round(n.y, 2), round(n.z, 2))
            if k not in key:
                key[k] = len(P); P.append(co[vi]); N.append(tuple(n)); UV.append(uv)
            f.append(key[k])
        T.append(f)
    P = xf(np.array(P)); N = xf(np.array(N), normal=True)
    return P, N, np.array(UV) if uvl else None, np.array(T, np.int64)

groups = {}
colors = {}
texs = {}

def add(model, part, mat, P, N, UV, T):
    groups.setdefault((model, part, mat), []).append((P, N, UV, T))

for model, cfg in MODELS.items():
    s = cfg['s']; b0, b1 = cfg['body']
    sL = cfg['lenReal'] / (b1 - b0)
    sY = s * 3.65 / ((cfg['roof'] - cfg['rail']) * s)  # 軌面到車頂剛好 3.65 m
    if model == 'loco':
        x0 = cfg['lenReal'] / 2 + 0.125  # 車頭尖端：車長 27 m 的一半（連結部各留 0.25 m）
        def xf(A, normal=False, x0=x0, sL=sL, s=s, sY=sY, b0=b0, rail=cfg['rail']):
            if normal:
                v = np.stack([-A[:, 1] / sL, A[:, 2] / sY, -A[:, 0] / s], -1)
                return v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
            return np.stack([x0 - (A[:, 1] - b0) * sL, (A[:, 2] - rail) * sY, -A[:, 0] * s], -1)
    else:
        yc = (b0 + b1) / 2
        def xf(A, normal=False, yc=yc, sL=sL, s=s, sY=sY, rail=cfg['rail']):
            if normal:
                v = np.stack([-A[:, 1] / sL, A[:, 2] / sY, -A[:, 0] / s], -1)
                return v / np.maximum(np.linalg.norm(v, axis=1, keepdims=True), 1e-9)
            return np.stack([-(A[:, 1] - yc) * sL, (A[:, 2] - rail) * sY, -A[:, 0] * s], -1)
    obs = load(os.path.join(src, model, 'scene.gltf'))
    print('MODEL', model, 's', round(s, 4), 'sL', round(sL, 4), 'sY', round(sY, 4), 'objs', len(obs))
    # 很重的零件（轉向架框架一個就 1.9 萬點）先減面
    for o in obs:
        if len(o.data.vertices) > 3000:
            m = o.modifiers.new('dec', 'DECIMATE'); m.ratio = 0.25
            with bpy.context.temp_override(object=o, active_object=o):
                bpy.ops.object.modifier_apply(modifier=m.name)
    HALF, FLOOR, ROOF = 1.69, 1.2, 3.65
    stats = {}
    for o in obs:
        mat = o.data.materials[0] if o.data.materials and o.data.materials[0] else None
        mname = mat.name if mat else 'none'
        if mname in TRACK or mname in SEATS: continue
        P, N, UV, T = mesh_arrays(o, xf)
        mn, mx = P.min(0), P.max(0)
        L = mx[0] - mn[0]
        if mname in WHEELS: part = 'wheels'
        elif mname == 'Ctrl_Panel_blinn': part = 'cab'
        elif mname == 'Auto_Sale_blinn': part = 'vending'
        elif mname == 'blinn42': part = 'toilet'
        elif mname == 'blinn30':
            if L > 8: part = 'body'                       # 車底的裙板
            elif mx[1] < FLOOR + 0.1: part = 'bogie'
            else: part = 'interior'
        else:
            outside = max(abs(mn[2]), abs(mx[2])) > HALF - 0.1 or mx[1] > ROOF - 0.2 or mn[1] < FLOOR - 0.15
            if mname in GLASS: part = 'windows' if outside else 'interior'
            elif outside: part = 'body'
            elif mname == 'lambert1' and mn[1] > 2.3: part = 'racks'   # 頭上的行李架
            else: part = 'interior'
        if model == 'loco' and part == 'interior' and mn[0] > 5.6:
            # 駕駛室：隔間牆前面。鼻子內側那一大片內殼（又長又寬）跟外殼一起拿掉，不然會擋住控制台
            part = 'body' if (L > 2.5 and mx[2] - mn[2] > 1.6) else 'cab'
        add(model, part, mname, P, N, UV, T)
        stats[part] = stats.get(part, 0) + len(T)
        # 顏色、貼圖
        if mat and mname not in colors:
            col = [0.7, 0.7, 0.7]; tex = None
            if mat.node_tree:
                bs = [n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED']
                if bs: col = list(bs[0].inputs['Base Color'].default_value)[:3]
                ims = [n.image for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image]
                if ims: tex = ims[0]
            colors[mname] = {'col': [round(c, 4) for c in col]}
            if tex is not None:
                fn = os.path.basename(tex.filepath) or (tex.name + '.jpeg')
                p = os.path.join(src, model, 'textures', fn)
                if os.path.exists(p): colors[mname]['tex'] = mname; texs[mname] = p
        bbox = None
    print('PARTS', model, stats)

# 輸出：位置 uint16（每組記最小值和間距）、法線 int8、uv uint16（0–1 以外的照原樣夾住）
blob = bytearray()
meta = {'groups': [], 'colors': colors,
        'credits': ['THSR 700T / Interior (Locomotive 01) and Taiwan HSR700T / Interior (Cabin 02) by Basic Hsu (Hsu.Pei.Ge), CC BY 4.0']}
def align(n):
    while len(blob) % n: blob.append(0)
tot = 0
for (model, part, mat), lst in sorted(groups.items()):
    P = np.concatenate([a[0] for a in lst]).astype(np.float32)
    N = np.concatenate([a[1] for a in lst]).astype(np.float32)
    hasuv = mat in texs
    UV = np.concatenate([a[2] if a[2] is not None else np.zeros((len(a[0]), 2)) for a in lst]) if hasuv else None
    off = 0; Ts = []
    for a in lst:
        Ts.append(a[3] + off); off += len(a[0])
    T = np.concatenate(Ts).astype(np.uint32).ravel()
    g = {'model': model, 'part': part, 'mat': mat, 'nv': len(P), 'ni': len(T)}
    lo = P.min(0); st = np.maximum((P.max(0) - lo) / 65535.0, 1e-9)
    g['q'] = [float(v) for v in lo] + [float(v) for v in st]
    align(4); g['pos'] = len(blob); blob.extend(np.round((P - lo) / st).astype(np.uint16).tobytes())
    align(4); g['nrm'] = len(blob); blob.extend(np.clip(np.round(N * 127), -127, 127).astype(np.int8).tobytes())
    if hasuv:
        ulo = UV.min(0); ust = np.maximum((UV.max(0) - ulo) / 65535.0, 1e-9)
        g['uq'] = [float(v) for v in ulo] + [float(v) for v in ust]
        align(4); g['uv'] = len(blob); blob.extend(np.round((UV - ulo) / ust).astype(np.uint16).tobytes())
    align(4)
    if len(P) < 65536: g['idx16'] = len(blob); blob.extend(T.astype(np.uint16).tobytes())
    else: g['idx'] = len(blob); blob.extend(T.tobytes())
    meta['groups'].append(g); tot += len(T) // 3
# 貼圖：縮到最大 512（車身塗裝 1024），轉成 jpg
os.makedirs(os.path.join(outdir, 'tex'), exist_ok=True)
for name, p in texs.items():
    img = bpy.data.images.load(p)
    w, h = img.size
    mx_ = 1024 if name == 'THSR_Color_blinn' else 512
    if max(w, h) > mx_: img.scale(int(w * mx_ / max(w, h)), int(h * mx_ / max(w, h)))
    img.filepath_raw = os.path.join(outdir, 'tex', name + '.jpg'); img.file_format = 'JPEG'
    bpy.context.scene.render.image_settings.quality = 85
    img.save()
meta['tex'] = sorted(texs)
open(os.path.join(outdir, 'train.bin'), 'wb').write(zlib.compress(bytes(blob), 9))
json.dump(meta, open(os.path.join(outdir, 'train.json'), 'w'), indent=1)
print('OUT groups', len(meta['groups']), 'tris', tot, 'bytes', len(blob), 'tex', sorted(texs))
