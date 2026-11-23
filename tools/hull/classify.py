# 貼圖分材質：車漆換成乾淨的漆色（留門縫細線）；深色細節保留照片；玻璃、輪拱、車底照規則
import numpy as np, sys, json
from PIL import Image
from scipy import ndimage
from matplotlib.path import Path
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from common import ROOT
prep = sys.argv[1]
import os
TOY = os.environ.get('TOY') == '1'
d = np.load(prep + '/bake.npz'); pos, nrm, valid = d['pos'], d['nrm'], d['valid']
R = pos.shape[0]
flip = lambda a: a[::-1]
pos, nrm, valid = flip(pos), flip(nrm), flip(valid)  # 和貼圖一樣 v 往上
nrm = nrm / (np.linalg.norm(nrm, axis=-1, keepdims=True) + 1e-9)
T = np.array(Image.open(prep + '/tex_best.png').convert('RGB')).astype(np.float32)
A = np.array(Image.open(prep + '/tex_avg.png').convert('RGB')).astype(np.float32)
cov = np.array(Image.open(prep + '/tex_cov.png')).astype(np.float32) / 255
bj = json.load(open(os.path.join(os.path.dirname(os.path.abspath(prep)), 'body.json')))
x, y, z = pos[..., 0], pos[..., 1], pos[..., 2]; az = np.abs(z)
# ---- 規則區域 ----
# 側窗（含黑框）的外輪廓，x–y（兩側相同）
WIN = [(0.97, 1.10), (0.9, 1.19), (0.8, 1.305), (0.7, 1.386), (0.6, 1.44), (0.4, 1.498), (0.2, 1.528), (0.0, 1.545), (-0.3, 1.548), (-0.6, 1.538),
       (-1.0, 1.51), (-1.2, 1.484), (-1.4, 1.434), (-1.52, 1.38), (-1.58, 1.345), (-1.5, 1.27), (-1.4, 1.218), (-1.0, 1.177), (-0.6, 1.15),
       (-0.2, 1.13), (0.2, 1.116), (0.6, 1.105), (0.85, 1.09)]
side = (np.abs(nrm[..., 2]) > 0.3)
inwin = Path(WIN).contains_points(np.stack([x.ravel(), y.ravel()], -1)).reshape(x.shape) & side & valid
# 黑框：窗戶輪廓往內 2.5 公分
from scipy.spatial import cKDTree
poly = np.array(WIN + [WIN[0]])
seg = np.concatenate([np.linspace(poly[k], poly[k + 1], 60) for k in range(len(poly) - 1)])
dist = np.full(x.shape, 9.0)
dd, _ = cKDTree(seg).query(np.stack([x[inwin], y[inwin]], -1)); dist[inwin] = dd
frame = inwin & (dist < 0.026)
bpil = inwin & (x > -0.405 - 0.04 * (y - 1.1) / 0.45) & (x < -0.262 - 0.06 * (y - 1.1) / 0.45)
divider = inwin & (np.abs(x - (-1.155 - 0.02 * (y - 1.2) / 0.27)) < 0.009)
glass_side = inwin & ~frame & ~bpil & ~divider
# 上面的玻璃：擋風玻璃＋玻璃車頂＋後窗（俯視的範圍）
zg = np.interp(x, [-2.25, -2.05, -1.9, 0.6, 0.98], [0.46, 0.56, 0.6, 0.61, 0.70])
xcowl = 0.985 - 0.09 * (az / 0.7) ** 2
top = (nrm[..., 1] > 0.12) & (y > 1.06) & (az < zg) & (x < xcowl) & (x > -2.3) & ~((x < -1.85) & (y < 1.255)) & valid
# 輪拱和車底
AXF, AXR = bj['AX_F'], bj['AX_R']
r_arch = np.minimum(np.hypot(x - AXF, y - 0.356), np.hypot(x - AXR, y - 0.356))
arch = (r_arch < 0.427) & (az < 0.93) & valid
under = (y < 0.175) | (nrm[..., 1] < -0.6)
# ---- 照片：像不像車漆 ----
L = T.mean(-1)
La = A.mean(-1); mxa = A.max(-1); mna = A.min(-1); Sa = (mxa - mna) / np.maximum(mxa, 1)
seen = cov > 0.18
# 每個角度都黑的才是黑色零件（反光會移動，平均後變淡）
trim = seen & ((La < 72) | ((La < 110) & (Sa > 0.22)))
trim = ndimage.binary_opening(trim, iterations=1) | (trim & (La < 50))
# 地板的倒影在每張照片都一樣暗：大片的深色只在真的黑色區（門檻、前下巴、後擴散器）才算
known = (y < 0.285) | ((x > 1.85) & (y < 0.43)) | ((x < -1.85) & (y < 0.53))
lab, n = ndimage.label(trim & ~known)
if n:
    sizes = ndimage.sum(np.ones_like(lab), lab, np.arange(1, n + 1))
    big = np.zeros(n + 1, bool); big[1:] = sizes > 5000
    trim &= ~big[lab]
# 燈區：保留照片（光條、燈殼、反光片）
BZ = [0, 0.45, 0.55, 0.65, 0.75, 0.85, 0.9]
barU = np.interp(az, BZ, [0.765, 0.765, 0.775, 0.795, 0.82, 0.845, 0.85]); barL = np.interp(az, BZ, [0.75, 0.75, 0.757, 0.77, 0.785, 0.8, 0.82])
lampF = (x > 1.7) & (((y > barL - 0.012) & (y < barU + 0.012) & (az < 0.92)) | ((y > 0.6) & (y < 0.68) & (az > 0.6) & (az < 0.9)))
lampR = (x < -1.75) & (y > 0.94) & (y < 1.16)
cls = np.zeros(x.shape, np.uint8)  # 0 車漆 1 照片細節 2 側窗玻璃 3 上方玻璃 4 黑色內襯 5 黑框
if not TOY:
    cls[trim] = 1
    cls[seen & (lampF | lampR) & ((La < 120) | (La > 205) | (Sa > 0.15))] = 1
cls[glass_side] = 2; cls[top] = 3; cls[frame | bpil | divider] = 5
cls[arch | under] = 4
cls[~valid] = 0
# ---- 顏色 ----
PAINT = np.array([118, 123, 129] if TOY else [104, 108, 113], np.float32)
lum = A.mean(-1)
hp = lum - ndimage.gaussian_filter(lum, 3.0)
line = np.clip(-(hp + 4) / 22, 0, 1) * (cls == 0) * seen
if TOY: line[:] = 0
alb = np.empty_like(T)
alb[:] = PAINT * (1 - 0.65 * line[..., None])
det = cls == 1
alb[det] = np.clip(T[det] * 0.85, 0, 255)
alb[cls == 2] = (18, 22, 25); alb[cls == 3] = (12, 14, 16); alb[cls == 4] = (16, 17, 18); alb[cls == 5] = (10, 11, 12)
# 玻璃四周一圈黑色（玻璃邊的黑色印刷，也蓋住玻璃和車身交界的鋸齒）
gl = (cls == 2) | (cls == 3)
frit = ndimage.binary_dilation(gl, iterations=9) & ~gl & valid & (cls != 4)
alb[frit] = (10, 11, 12); cls[frit] = 5
# 車牌（汽車之家的牌子）改成空白車牌
plateF = (z > -0.25) & (z < 0.24) & (y > 0.45) & (y < 0.60) & (x > 1.9) & (nrm[..., 0] > 0.3)
plateR = (z > -0.26) & (z < 0.225) & (y > 0.42) & (y < 0.56) & (x < -1.9) & (nrm[..., 0] < -0.3)
plate = plateF | plateR
alb[plate] = (226, 228, 226); cls[plate] = 1
# 車頭下半部：照片上反光很多，改用量好的形狀畫乾淨的黑色（進氣口梯形、最下面的黑唇、兩角的直線、雷達圓點）
fr = valid & (x > 1.7) & (nrm[..., 0] > 0.15) & (y < 0.6) & (y > 0.18) & ~plate & ~lampF
cls[fr & (cls == 1)] = 0
alb[fr] = PAINT
intake = fr & (y > 0.255) & (y < 0.405) & (az < np.interp(y, [0.255, 0.31, 0.405], [0.62, 0.62, 0.47]))
lip = fr & (y < 0.235) & (az < 0.8)
cline = fr & (az > 0.826) & (az < 0.842) & (y > 0.36) & (y < 0.6)
radar = fr & ((z - 0.48) ** 2 + (y - 0.54) ** 2 < 0.019 ** 2)
for msk, col in ((intake, (14, 15, 16)), (lip, (18, 19, 20)), (cline, (12, 12, 13)), (radar, (95, 98, 102))):
    alb[msk] = col; cls[msk] = 1
# 網格：進氣口裡一條條橫的
grille = intake & ((np.round((y - 0.26) / 0.022) % 2) == 0) & (y < 0.395)
alb[grille] = (32, 34, 36)
# 後照鏡底座附近：照片裡的後照鏡被投影到車身上變成黑色污漬，改回車漆（窗框不動）
mz = valid & (x > 0.55) & (x < 1.05) & (y > 0.98) & (y < 1.3) & (az > 0.7) & (cls == 1)
cls[mz] = 0; alb[mz] = PAINT
# 車頂和側窗中間那條：實車是黑色玻璃車頂直接接到窗框，沒有車身色
WT = [(0.97, 1.10), (0.9, 1.19), (0.8, 1.305), (0.7, 1.386), (0.6, 1.44), (0.4, 1.498), (0.2, 1.528), (0.0, 1.545), (-0.3, 1.548), (-0.6, 1.538), (-1.0, 1.51), (-1.2, 1.484), (-1.4, 1.434), (-1.52, 1.38), (-1.58, 1.345)][::-1]
wtop = np.interp(x, [p[0] for p in WT], [p[1] for p in WT])
band = valid & (x > -1.58) & (x < 0.9) & (y > wtop - 0.006) & (y > 1.25) & ~gl & (cls != 4)
alb[band] = (10, 11, 12); cls[band] = 5
if TOY:
    # 玩具版的細節全部照量好的位置畫：門縫、門把、下緣黑色飾板、尾燈燈殼、頭燈黑框、側邊相機
    sd = valid & (np.abs(nrm[..., 2]) > 0.35) & (cls == 0)
    def seam(x0, y0, y1, w=0.0035):
        return sd & (np.abs(x - x0) < w) & (y > y0) & (y < y1)
    r_rear = np.hypot(x - AXR, y - 0.356)
    seams = seam(0.94, 0.30, 1.10) | seam(-0.20, 0.27, 1.13) | (sd & (np.abs(x + 1.24) < 0.0035) & (y > 0.79) & (y < 1.18)) \
        | (sd & (np.abs(r_rear - 0.47) < 0.0035) & (x > AXR + 0.05) & (x < -1.24) & (y > 0.5))
    handles = sd & (np.abs(y - 1.0) < 0.012) & (((x > -0.06) & (x < 0.08)) | ((x > -1.11) & (x < -0.97)))
    rocker = valid & (y < 0.285) & (cls == 0)
    camtri = sd & (x > 1.0) & (x < 1.12) & (y > 0.77) & (y < 0.82 + (x - 1.0) * 0.25) & (y > 0.77 + (1.12 - x) * 0.0)
    tailbox = valid & (x < -1.75) & (y > 0.99) & (y < 1.12) & (cls == 0)
    headbox = valid & (x > 1.7) & (y > 0.6) & (y < 0.68) & (az > 0.6) & (az < 0.88) & (nrm[..., 0] > 0.1)
    rdiff = valid & (x < -1.9) & (y > 0.2) & (y < 0.48) & (nrm[..., 0] < -0.2) & ~plate
    for msk, col in ((seams, (52, 54, 57)), (handles, (40, 42, 45)), (rocker, (24, 25, 27)), (camtri, (16, 17, 18)),
                     (tailbox, (34, 30, 30)), (headbox, (26, 27, 29)), (rdiff, (22, 23, 24))):
        alb[msk] = col; cls[msk & ~seams] = 1
# 粗糙度/金屬度：車漆有金屬感，黑色亮面，玻璃很亮，內襯霧面
rough = np.full(x.shape, 0.55 if TOY else 0.42, np.float32); metal = np.full(x.shape, 0.15 if TOY else 0.38, np.float32)
rough[cls == 1] = 0.45; metal[cls == 1] = 0.05
rough[cls == 2] = 0.05; rough[cls == 3] = 0.3; rough[cls == 5] = 0.18; metal[cls >= 2] = 0.0
rough[cls == 4] = 0.85
# 邊緣外擴，避免縫隙露出底色
def pad(img, m, n=6):
    out = img.copy(); mm = m.copy()
    for _ in range(n):
        g = ndimage.grey_dilation(np.where(mm[..., None], out, 0), size=(3, 3, 1)) if out.ndim == 3 else ndimage.grey_dilation(np.where(mm, out, 0), size=(3, 3))
        new = ndimage.binary_dilation(mm) & ~mm
        out[new] = g[new]; mm |= new
    return out
alb = pad(alb, valid); rough = pad(rough, valid); metal = pad(metal, valid)
Image.fromarray(np.clip(alb, 0, 255).astype(np.uint8)).save(prep + '/albedo.png')
cc = pad(np.where(cls == 4, 0.0, np.where(cls == 3, 60.0, 255.0)).astype(np.float32), valid)  # 清漆：內襯、車底沒有
orm = np.stack([cc.astype(np.uint8), (rough * 255).astype(np.uint8), (metal * 255).astype(np.uint8)], -1)
Image.fromarray(orm).save(prep + '/orm.png')
np.save(prep + '/cls.npy', cls)
# 透明遮罩：玻璃的地方車身挖空（白＝車身、黑＝玻璃）
gm = (cls == 2) | (cls == 3)
Image.fromarray(np.where(gm, 0, 255).astype(np.uint8)).resize((1024, 1024), Image.BILINEAR).save(prep + '/mask.png')
vis = np.array([[150, 155, 160], [230, 120, 40], [60, 160, 230], [30, 80, 200], [40, 40, 40], [0, 0, 0]], np.uint8)[cls]
vis[~valid] = 255
Image.fromarray(vis).save(prep + '/cls.png')
print('classes', [(k, int((cls[valid] == k).sum())) for k in range(6)])
