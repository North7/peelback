# 從烘焙的位置圖和照片貼圖，做出側、前、後、上四張正投影圖（車的座標，已對齊車長中點）
import numpy as np, sys, json
from PIL import Image, ImageDraw
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import ROOT
prep = sys.argv[1]; tex = sys.argv[2] if len(sys.argv) > 2 else 'tex_avg.png'
d = np.load(prep + '/bake.npz'); pos, nrm, valid = d['pos'], d['nrm'], d['valid']
T = np.array(Image.open(f'{prep}/{tex}').convert('RGB'))[::-1]
p = pos[valid]; n = nrm[valid]; c = T[valid]
n = n / (np.linalg.norm(n, axis=1, keepdims=True) + 1e-9)
S = 400  # 每公尺像素
def ortho(sel, ax_u, ax_v, ur, vr, depth_ax, depth_sign, name, flipu=False):
    W = int((ur[1] - ur[0]) * S); H = int((vr[1] - vr[0]) * S)
    img = np.full((H, W, 3), 255, np.uint8); zb = np.full((H, W), -1e9)
    q = p[sel]; cc = c[sel]
    u = ((q[:, ax_u] - ur[0]) * S).astype(int); v = ((vr[1] - q[:, ax_v]) * S).astype(int)
    if flipu: u = W - 1 - u
    dep = q[:, depth_ax] * depth_sign
    o = np.argsort(dep)
    u, v, cc = u[o], v[o], cc[o]
    for du in (-1, 0, 1):
        for dv in (-1, 0, 1):
            uu, vv = u + du, v + dv
            ok = (uu >= 0) & (uu < W) & (vv >= 0) & (vv < H)
            img[vv[ok], uu[ok]] = cc[ok]
    ok = (u >= 0) & (u < W) & (v >= 0) & (v < H)
    img[v[ok], u[ok]] = cc[ok]
    im = Image.fromarray(img); dr = ImageDraw.Draw(im)
    # 每 10 公分一條格線，每公尺加粗並標數字
    for k in np.arange(np.ceil(ur[0] * 10) / 10, ur[1], 0.1):
        x = (k - ur[0]) * S; x = W - 1 - x if flipu else x
        dr.line([(x, 0), (x, 8 if abs(k * 10 - round(k * 10)) < 1e-6 and round(k * 10) % 10 else 18)], fill=(255, 0, 0))
        if abs(k - round(k * 2) / 2) < 1e-6: dr.text((x + 2, 20), '%.1f' % k, fill=(255, 0, 0))
    for k in np.arange(np.ceil(vr[0] * 10) / 10, vr[1], 0.1):
        y = (vr[1] - k) * S
        dr.line([(0, y), (8, y)], fill=(255, 0, 0))
        if abs(k - round(k * 2) / 2) < 1e-6: dr.text((10, y - 6), '%.1f' % k, fill=(255, 0, 0))
    im.save(f'{prep}/bp_{name}.png')
    return im
L = json.load(open(ROOT + '/ref/car/autohome/body.json'))['len']
ortho(n[:, 2] > 0.25, 0, 1, (-2.45, 2.45), (0, 1.7), 2, 1, 'right', flipu=False)
ortho(n[:, 2] < -0.25, 0, 1, (-2.45, 2.45), (0, 1.7), 2, -1, 'left', flipu=True)
ortho(n[:, 0] > 0.2, 2, 1, (-1.1, 1.1), (0, 1.7), 0, 1, 'front', flipu=True)
ortho(n[:, 0] < -0.2, 2, 1, (-1.1, 1.1), (0, 1.7), 0, -1, 'rear')
ortho(n[:, 1] > 0.2, 0, 2, (-2.45, 2.45), (-1.1, 1.1), 1, 1, 'top')
print('ok', L)
