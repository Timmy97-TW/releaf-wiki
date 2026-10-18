# Swap the painted mountains at the back of a navmap plate for the students' redrawn strip
# (18 Oct 2026: a 4096-wide transparent PNG). The strip is scaled to the plate width with its
# foot on the field line; the old sky is held behind it; only the right-hand cliff reaches
# lower than the field line, and there the strip's lower part is stretched down to meet the old foot.
#   python3 build/navmap-mountains.py mountains.png <old plate> <new plate> <old plate-model.webp>
# Run it against the ORIGINAL plates (kept outside the repo), never against a swapped one.
import sys, numpy as np
from PIL import Image
from scipy import ndimage as nd
mpath, inp, out, refp = sys.argv[1:5]
plate = Image.open(inp).convert('RGB'); W, H = plate.size
P = np.asarray(plate).astype(float)
# every plate shares one back, so its outline is read off a plate with nothing tall near the hills
R = np.asarray(Image.open(refp).convert('RGB')).astype(float)
r, g, b = R[...,0], R[...,1], R[...,2]; lum = (r+g+b)/3
plum = P.mean(2)
LIM = 470
rows = np.arange(H)[:, None]
mtn = ((r < b + 6) & (lum < 175)) | ((lum > 205) & (rows < 260))
mtn[LIM:] = False
lab, _ = nd.label(mtn)
top_ids = set(np.unique(lab[0])) - {0}
mask = np.isin(lab, list(top_ids))
mask = nd.binary_closing(mask, iterations=2); mask = nd.binary_fill_holes(mask)
mask[LIM:] = False
gt = np.array([ (np.nonzero(mask[:,x])[0].max()+1 if mask[:,x].any() else 0) for x in range(W)])
# thin spikes (the river running out of the hills) are not mountain
raw = gt.copy()
gt = nd.grey_opening(gt, size=71)
# all the plates share one back: only the right-hand cliff comes down past the field line
gt[:1900] = np.minimum(gt[:1900], 322)
# the old cliff stopped in a steep wall at x~1908; the new foot slopes down to it instead
xs = np.arange(1650, 1935); t = (xs - 1650) / (1935 - 1650)
gt[1935:] = nd.maximum_filter1d(np.maximum(gt, raw), 15)[1935:] + 3
gt[1650:1935] = np.maximum(np.minimum(gt[1650:1935], 322), (318 + 86*np.sqrt(t)).astype(int))
mask = np.arange(H)[:, None] < gt[None, :]
# old sky: per column, colour just above the old mountains, held down and blurred sideways
sky = P.copy()
sky_col = np.zeros((W,3))
mtop = np.array([ np.argmax(~((plum[:,x] > 205))) for x in range(W)])
for x in range(W):
    t = max(mtop[x]-4, 1); sky_col[x] = P[max(t-6,0):t, x].mean(0)
for x in range(W):
    t = max(mtop[x]-4, 1); sky[t:, x] = sky_col[x]
sky = nd.gaussian_filter(sky, (8, 40, 0))
for x in range(W):
    t = max(mtop[x]-4, 1); sky[:t, x] = P[:t, x]
# the new strip, scaled to the plate width, its foot on the old field line
M = Image.open(mpath).convert('RGBA'); s = W / M.width
M = M.resize((W, round(M.height*s)), Image.LANCZOS)
A = np.asarray(M).astype(float)
foot = 312
cols_bottom = np.array([ (np.nonzero(A[:,x,3] > 128)[0].max() if (A[:,x,3]>128).any() else 0) for x in range(W)])
dy = foot - int(np.median(cols_bottom))
layer = np.zeros((H, W, 4))
y0 = max(dy, 0); sy0 = y0 - dy
hh = min(H - y0, A.shape[0] - sy0)
layer[y0:y0+hh] = A[sy0:sy0+hh]
# where the old mountains reached further down than the new foot, carry the strip's foot down
# (the strip's lower part is stretched down to meet it, column by column)
src = layer.copy()
for x in range(W):
    fb = cols_bottom[x] + dy
    if gt[x] + 3 > fb and fb > 160:
        s0 = fb - 160; n = gt[x] + 4 - s0
        pos = np.linspace(s0, fb - 1, n)
        for c in range(4):
            layer[s0:s0+n, x, c] = np.interp(pos, np.arange(H), src[:, x, c])
a = layer[...,3:]/255
newtop = sky*(1-a) + layer[...,:3]*a
soft = nd.gaussian_filter(mask.astype(float), 1.2)[..., None]
res = P*(1-soft) + newtop*soft
Image.fromarray(np.clip(res,0,255).astype(np.uint8)).save(out, quality=90, method=6)
print(inp.split('/')[-1], 'dy', dy, 'ground top range', gt.min(), gt.max())
