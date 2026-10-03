"""Farm details for version C of the student's valley (mock, 2 Oct 2026):
houses, trees, palms, farmers, furrows, seedlings, haystacks and net houses,
drawn by code in the manner of her painting and laid onto it before it is lit.

HER MANNER, as read from the painting: flat shapes in two or three tones, no
outlines and no gradients; edges that wander like a dry brush; a small palette
of olive, ochre, soil brown and blue-grey; dark green blobs for bushes (she put
some along the river). Everything here keeps to that: each object is a few
flat polygons whose edges are jittered, in colours sampled from her picture.

These are NOT her drawing. They are additions by code (AI-assisted), and the
page that uses them should say so.

All positions are in her picture's own pixels (2048 x 1152). A Painter draws
the same objects at any scale onto any window of the picture, so the opening
close-up gets them drawn at five times the size, not enlarged.
"""
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

HORIZON = 470.0      # where sizes would shrink to nothing
REF_Y = 832.0        # the row of the field she zoomed in on: scale 1 there


def scale(y):
    return max((y - HORIZON) / (REF_Y - HORIZON), 0.12)


class Painter:
    """Draws rough-edged flat polygons onto a window of the picture."""

    def __init__(self, canvas, x0=0, y0=0, k=1, lights=None):
        self.c, self.x0, self.y0, self.k = canvas, x0, y0, k
        self.h, self.w = canvas.shape[:2]
        self.lights = lights            # an RGBA float canvas for what shines at night, or None
        self.n = 0
        self.clip = None
        self.windows = []               # [x, y, w, h] of every pane that shines at night

    def _rng(self):
        self.n += 1
        return np.random.default_rng(1000 + self.n)

    def set_clip(self, mask):
        """mask: a full-picture boolean array, or None."""
        if mask is None:
            self.clip = None
            return
        hh, ww = int(round(self.h / self.k)), int(round(self.w / self.k))
        win = mask[self.y0:self.y0 + hh, self.x0:self.x0 + ww].astype(np.uint8) * 255
        if win.shape != (hh, ww):
            pad = np.zeros((hh, ww), np.uint8); pad[:win.shape[0], :win.shape[1]] = win; win = pad
        self.clip = np.asarray(Image.fromarray(win).resize((self.w, self.h), Image.BILINEAR), dtype=np.float64) / 255

    def _mask(self, pts, rough, closed=True, width=None):
        """A soft mask for a polygon (or a stroke of `width` picture px) with a dry-brush edge."""
        rng = self._rng()
        pts = np.asarray(pts, dtype=np.float64)
        if rough > 0:
            out = []
            m = len(pts)
            for i in range(m if closed else m - 1):
                a, b = pts[i], pts[(i + 1) % m]
                seg = b - a
                ln = np.hypot(*seg)
                steps = max(int(ln / 2.2), 1)
                nrm = np.array([-seg[1], seg[0]]) / max(ln, 1e-6)
                jit = rng.normal(0, rough, steps)
                jit[0] *= 0.3
                for j in range(steps):
                    out.append(a + seg * (j / steps) + nrm * jit[j])
            if not closed:
                out.append(pts[-1])
            pts = np.array(out)
        p = (pts - [self.x0, self.y0]) * self.k
        padw = (width or 0) * self.k + 3
        bx0, by0 = int(np.floor(p[:, 0].min() - padw)), int(np.floor(p[:, 1].min() - padw))
        bx1, by1 = int(np.ceil(p[:, 0].max() + padw)), int(np.ceil(p[:, 1].max() + padw))
        bx0, by0, bx1, by1 = max(bx0, 0), max(by0, 0), min(bx1, self.w), min(by1, self.h)
        if bx1 <= bx0 or by1 <= by0:
            return None
        ss = 3 if self.k < 3 else 2
        im = Image.new("L", ((bx1 - bx0) * ss, (by1 - by0) * ss), 0)
        q = [((x - bx0) * ss, (y - by0) * ss) for x, y in p]
        d = ImageDraw.Draw(im)
        if width is None:
            d.polygon(q, fill=255)
        else:
            d.line(q, fill=255, width=max(int(round(width * self.k * ss)), 1), joint="curve")
        a = np.asarray(im.resize((bx1 - bx0, by1 - by0), Image.BOX), dtype=np.float64) / 255
        if self.clip is not None:
            a = a * self.clip[by0:by1, bx0:bx1]
        return a, (bx0, by0, bx1, by1)

    def poly(self, pts, color, rough=0.45, alpha=1.0, mul=False, light=None, width=None, closed=True):
        r = self._mask(pts, rough, closed, width)
        if r is None:
            return
        a, (bx0, by0, bx1, by1) = r
        a = (a * alpha)[..., None]
        reg = self.c[by0:by1, bx0:bx1]
        col = np.asarray(color, dtype=np.float64)
        self.c[by0:by1, bx0:bx1] = reg * (1 - a * (1 - col / 255)) if mul else reg * (1 - a) + col * a
        if light is not None:
            q = np.asarray(pts, dtype=np.float64)
            self.windows.append([round(float(v), 1) for v in (q[:, 0].min(), q[:, 1].min(), np.ptp(q[:, 0]), np.ptp(q[:, 1]))])
        if light is not None and self.lights is not None:
            lr = self.lights[by0:by1, bx0:bx1]
            lr[..., :3] = lr[..., :3] * (1 - a) + np.asarray(light, dtype=np.float64) * a
            lr[..., 3:] = np.maximum(lr[..., 3:], a * 255)

    def sprite(self, img, cx, bottom, w, h):
        """Pastes an RGBA picture (PIL) w x h picture px, standing on (cx, bottom)."""
        self.n += 1
        W, Hh = max(int(round(w * self.k)), 2), max(int(round(h * self.k)), 2)
        im = np.asarray(img.resize((W, Hh), Image.LANCZOS), dtype=np.float64)
        x = int(round((cx - w / 2 - self.x0) * self.k)); y = int(round((bottom - h - self.y0) * self.k))
        sx0, sy0 = max(-x, 0), max(-y, 0)
        sx1, sy1 = min(W, self.w - x), min(Hh, self.h - y)
        if sx1 <= sx0 or sy1 <= sy0:
            return
        a = im[sy0:sy1, sx0:sx1, 3:] / 255
        reg = self.c[y + sy0:y + sy1, x + sx0:x + sx1]
        self.c[y + sy0:y + sy1, x + sx0:x + sx1] = reg * (1 - a) + im[sy0:sy1, sx0:sx1, :3] * a

    def ellipse(self, cx, cy, rx, ry, color, rot=0.0, n=18, **kw):
        t = np.linspace(0, 2 * np.pi, n, endpoint=False)
        x, y = rx * np.cos(t), ry * np.sin(t)
        c, s = np.cos(rot), np.sin(rot)
        self.poly(np.stack([cx + x * c - y * s, cy + x * s + y * c], 1), color, **kw)

    def stroke(self, pts, width, color, **kw):
        self.poly(pts, color, width=width, closed=False, **kw)


SHADOW = (118, 132, 120)      # multiplied: the ground in shade
WINDOW = (246, 207, 148)      # --dawn, the page's warm window light


def house(P, x, y, flip=False, roof=(172, 90, 56), wall=(228, 216, 186), size=54):
    """A low farmhouse seen from above its front: wall, gable side, tiled roof slope."""
    u = size * scale(y)
    d = -1 if flip else 1
    hw, rr = 0.36 * u, 0.27 * u
    dx, dy = d * 0.36 * u, -0.17 * u
    xl, xr = x - 0.5 * u, x + 0.5 * u
    xe = xr if d > 0 else xl                    # the corner the side wall leaves from
    P.poly([(xl - 0.42 * u, y + 0.09 * u), (xr - 0.1 * u, y + 0.09 * u), (xr + dx * 0.4, y - 0.02 * u), (xl - 0.3 * u, y - 0.14 * u)],
           SHADOW, mul=True, alpha=0.7, rough=0.5)
    side = tuple(c * 0.8 for c in wall)
    P.poly([(xe, y), (xe + dx, y + dy), (xe + dx, y + dy - hw), (xe, y - hw)], side, rough=0.3)
    P.poly([(xl, y - hw), (xr, y - hw), (xr, y), (xl, y)], wall, rough=0.3)
    ridge_l, ridge_r = (xl + 0.5 * dx, y - hw + 0.5 * dy - rr), (xr + 0.5 * dx, y - hw + 0.5 * dy - rr)
    ridge_e = ridge_r if d > 0 else ridge_l
    P.poly([(xe, y - hw), (xe + dx, y + dy - hw), ridge_e], side, rough=0.25)
    ov = 0.05 * u
    P.poly([(xl - ov, y - hw + ov), (xr + ov, y - hw + ov), (ridge_r[0] + ov * 0.5, ridge_r[1]), (ridge_l[0] - ov * 0.5, ridge_l[1])], roof, rough=0.4)
    dark = tuple(c * 0.84 for c in roof)
    P.poly([(xl - ov, y - hw + ov), (xr + ov, y - hw + ov), (xr + ov + 0.1 * dx, y - hw - 0.07 * u), (xl - ov + 0.1 * dx, y - hw - 0.07 * u)], dark, rough=0.3)
    if u > 17:
        door_x = x - d * 0.2 * u
        P.poly([(door_x - 0.07 * u, y - 0.24 * u), (door_x + 0.07 * u, y - 0.24 * u), (door_x + 0.07 * u, y), (door_x - 0.07 * u, y)], (92, 64, 44), rough=0.15)
        for wx in (x + d * 0.08 * u, x + d * 0.3 * u):
            P.poly([(wx - 0.065 * u, y - 0.27 * u), (wx + 0.065 * u, y - 0.27 * u), (wx + 0.065 * u, y - 0.14 * u), (wx - 0.065 * u, y - 0.14 * u)],
                   (74, 88, 96), rough=0.12, light=WINDOW)
    else:
        P.poly([(x - 0.1 * u, y - 0.26 * u), (x + 0.12 * u, y - 0.26 * u), (x + 0.12 * u, y - 0.1 * u), (x - 0.1 * u, y - 0.1 * u)],
               (74, 88, 96), rough=0.1, light=WINDOW)


def tree(P, x, y, size=1.0, tone=0):
    """A round tree: her river-bank bush, on a trunk, with a sunlit side."""
    r = 13.5 * scale(y) * size
    rng = np.random.default_rng(int(x * 7 + y * 13))
    P.ellipse(x - 0.9 * r, y + 0.05 * r, 1.25 * r, 0.42 * r, SHADOW, mul=True, alpha=0.7, rough=0.5)
    P.poly([(x - 0.13 * r, y - 0.9 * r), (x + 0.13 * r, y - 0.9 * r), (x + 0.16 * r, y), (x - 0.16 * r, y)], (88, 64, 42), rough=0.2)
    dark = [(44, 92, 52), (52, 100, 48), (40, 84, 60)][tone % 3]
    mid = [(74, 126, 62), (84, 134, 58), (66, 118, 74)][tone % 3]
    cy = y - 1.55 * r
    for ox, oy, k in ((-0.45, 0.2, 0.78), (0.42, 0.25, 0.74), (0, -0.15, 0.95)):
        P.ellipse(x + ox * r + rng.normal(0, 0.06 * r), cy + oy * r, k * r, k * r * 0.9, dark, rough=0.7)
    P.ellipse(x + 0.28 * r, cy - 0.28 * r, 0.52 * r, 0.42 * r, mid, rough=0.6)
    P.ellipse(x + 0.42 * r, cy - 0.42 * r, 0.22 * r, 0.17 * r, (112, 152, 78), rough=0.4)


def palm(P, x, y, size=1.0):
    """A betel palm: a thin trunk and a tuft of fronds."""
    r = 13.5 * scale(y) * size
    top = y - 3.3 * r
    P.ellipse(x - 1.1 * r, y + 0.04 * r, 1.3 * r, 0.26 * r, SHADOW, mul=True, alpha=0.6, rough=0.4)
    P.stroke([(x, y), (x + 0.1 * r, y - 1.7 * r), (x, top)], 0.2 * r, (104, 92, 70), rough=0.15)
    for ang, ln in ((-2.9, 1.25), (-2.35, 1.35), (-1.75, 1.2), (-1.3, 1.25), (-0.75, 1.35), (-0.2, 1.25), (0.35, 0.95), (2.8, 0.95)):
        tipx, tipy = x + np.cos(ang) * ln * r, top + np.sin(ang) * ln * r * 0.8 + 0.42 * r
        midx, midy = x + np.cos(ang) * 0.55 * ln * r, top + np.sin(ang) * 0.6 * ln * r * 0.8
        nx, ny = -np.sin(ang) * 0.13 * r, np.cos(ang) * 0.13 * r
        P.poly([(x, top), (midx + nx, midy + ny), (tipx, tipy), (midx - nx, midy - ny)], (50, 100, 56) if ang < -0.5 else (40, 84, 50), rough=0.25)


def farmer(P, x, y, shirt=(76, 108, 160), bend=False, size=24, hoe=False):
    """A farmer in a conical hat, standing or bent to the crop."""
    h = size * scale(y)
    if hoe and not bend:
        P.stroke([(x + 0.25 * h, y - 0.44 * h), (x + 0.5 * h, y - 0.02 * h)], 0.045 * h, (120, 92, 60), rough=0.05)
        P.poly([(x + 0.44 * h, y - 0.06 * h), (x + 0.62 * h, y - 0.04 * h), (x + 0.6 * h, y + 0.03 * h), (x + 0.44 * h, y + 0.01 * h)], (96, 100, 104), rough=0.08)
    P.ellipse(x - 0.34 * h, y + 0.01 * h, 0.4 * h, 0.1 * h, SHADOW, mul=True, alpha=0.7, rough=0.3)
    legs = (58, 64, 82)
    P.poly([(x - 0.13 * h, y - 0.4 * h), (x - 0.01 * h, y - 0.4 * h), (x - 0.02 * h, y), (x - 0.13 * h, y)], legs, rough=0.12)
    P.poly([(x + 0.02 * h, y - 0.4 * h), (x + 0.14 * h, y - 0.4 * h), (x + 0.13 * h, y), (x + 0.03 * h, y)], legs, rough=0.12)
    if bend:
        P.poly([(x - 0.15 * h, y - 0.44 * h), (x + 0.15 * h, y - 0.36 * h), (x + 0.5 * h, y - 0.6 * h), (x + 0.34 * h, y - 0.78 * h)], shirt, rough=0.2)
        P.stroke([(x + 0.4 * h, y - 0.58 * h), (x + 0.5 * h, y - 0.26 * h)], 0.08 * h, shirt, rough=0.1)
        hx, hy = x + 0.52 * h, y - 0.74 * h
    else:
        P.poly([(x - 0.17 * h, y - 0.76 * h), (x + 0.17 * h, y - 0.76 * h), (x + 0.16 * h, y - 0.36 * h), (x - 0.16 * h, y - 0.36 * h)], shirt, rough=0.2)
        P.stroke([(x + 0.19 * h, y - 0.72 * h), (x + 0.25 * h, y - 0.42 * h)], 0.085 * h, shirt, rough=0.1)
        P.stroke([(x - 0.19 * h, y - 0.72 * h), (x - 0.24 * h, y - 0.44 * h)], 0.085 * h, shirt, rough=0.1)
        hx, hy = x, y - 0.85 * h
    P.ellipse(hx, hy, 0.1 * h, 0.1 * h, (214, 170, 130), rough=0.1, n=10)
    P.poly([(hx - 0.3 * h, hy - 0.03 * h), (hx + 0.3 * h, hy - 0.03 * h), (hx, hy - 0.27 * h)], (226, 200, 134), rough=0.15)
    P.poly([(hx - 0.3 * h, hy - 0.03 * h), (hx + 0.3 * h, hy - 0.03 * h), (hx + 0.2 * h, hy + 0.02 * h), (hx - 0.2 * h, hy + 0.02 * h)], (186, 158, 98), rough=0.1)


def haystack(P, x, y, size=1.0):
    r = 9.5 * scale(y) * size
    P.ellipse(x - 0.8 * r, y, 1.2 * r, 0.36 * r, SHADOW, mul=True, alpha=0.65, rough=0.4)
    t = np.linspace(np.pi, 2 * np.pi, 10)
    P.poly([(x + r * np.cos(a), y + 1.25 * r * np.sin(a)) for a in t] + [(x + r, y + 0.12 * r), (x - r, y + 0.12 * r)], (222, 188, 104), rough=0.5)
    P.poly([(x - r, y + 0.12 * r)] + [(x + r * np.cos(a), y + 1.25 * r * np.sin(a)) for a in np.linspace(np.pi, 1.5 * np.pi, 6)] + [(x - 0.2 * r, y + 0.12 * r)],
           (190, 154, 80), rough=0.4)


def nethouse(P, x, y, tunnels=3, length=64):
    """Net-house tunnels side by side, seen along their flanks."""
    s = scale(y)
    ln, th = length * s, 11 * s
    for i in range(tunnels - 1, -1, -1):
        ox, oy = i * 7 * s, -i * 9.5 * s
        x0, x1, yb = x - ln / 2 + ox, x + ln / 2 + ox, y + oy
        if i == 0:
            P.poly([(x0 - 0.5 * th, yb + 0.25 * th), (x1 - 0.2 * th, yb + 0.25 * th), (x1, yb), (x0, yb - 0.1 * th)], SHADOW, mul=True, alpha=0.6, rough=0.4)
        P.poly([(x0, yb), (x0, yb - 0.55 * th), (x0 + 0.5 * th, yb - th), (x1 - 0.1 * th, yb - th), (x1, yb - 0.55 * th), (x1, yb)], (214, 222, 216), rough=0.3)
        P.poly([(x0 + 0.5 * th, yb - th), (x1 - 0.1 * th, yb - th), (x1, yb - 0.55 * th), (x0 + 0.1 * th, yb - 0.55 * th)], (238, 242, 236), rough=0.25)
        for rx in np.arange(x0 + 0.9 * th, x1 - 0.3 * th, 0.85 * th):
            P.stroke([(rx, yb), (rx, yb - 0.6 * th), (rx + 0.25 * th, yb - th)], max(0.09 * th, 0.6), (170, 184, 180), rough=0.0)


def _edges(mask, axis):
    """For each column (axis 0) or row (axis 1) of a field: where it starts and ends."""
    m = mask if axis == 0 else mask.T
    cols = np.where(m.any(0))[0]
    a = np.array([np.where(m[:, c])[0][[0, -1]] for c in cols], dtype=np.float64)
    k = max(len(cols) // 12, 3) | 1
    return cols, ndimage.median_filter(a[:, 0], k), ndimage.median_filter(a[:, 1], k)


def rows(P, mask, n=9, axis=0, mul=(206, 200, 186), width=1.5, alpha=0.75):
    """Furrows: lines that run between two facing edges of the field, so they
    follow its shape and its perspective."""
    cols, lo, hi = _edges(mask, axis)
    if len(cols) < 12:
        return
    P.set_clip(ndimage.binary_erosion(mask, iterations=3))
    for i in range(n):
        t = ((i + 0.5) / n) ** (1.12 if axis == 0 else 1.0)
        line = lo + t * (hi - lo)
        pts = [(c, v) if axis == 0 else (v, c) for c, v in zip(cols[::6], line[::6])]
        w = width * (0.7 + 0.6 * t) * scale(float(np.mean(lo + hi) / 2 if axis == 0 else np.mean(cols)))
        P.stroke(pts, max(w, 0.8), mul, mul=True, alpha=alpha, rough=0.25)
    P.set_clip(None)


def seedlings(P, mask, n=7, gap=11.0, color=(62, 112, 58)):
    """Rows of small plants across a field."""
    cols, lo, hi = _edges(mask, 0)
    if len(cols) < 12:
        return
    core = ndimage.binary_erosion(mask, iterations=4)
    for i in range(n):
        t = ((i + 0.5) / n) ** 1.12
        line = lo + t * (hi - lo)
        s = scale(float(np.mean(line)))
        step = max(gap * s, 4.0)
        xs = np.arange(cols[0] + step * (0.5 + 0.5 * (i % 2)), cols[-1], step)
        for x in xs:
            y = float(np.interp(x, cols, line))
            if not core[int(round(y)) if y < mask.shape[0] - 1 else -1, int(round(x))]:
                P.n += 2
                continue
            P.ellipse(x, y, 2.9 * s, 2.0 * s, color, rough=0.25, n=9)
            P.ellipse(x + 0.8 * s, y - 0.7 * s, 1.3 * s, 0.9 * s, (104, 150, 76), rough=0.15, n=7)


def reactor(P, img, x, y, h):
    """Her own reactor drawing, small, standing with its glass on (x, y)."""
    w = h * img.size[0] / img.size[1]
    P.ellipse(x - 0.45 * w, y + 0.5 * h, 0.75 * w, 0.14 * h, SHADOW, mul=True, alpha=0.7, rough=0.3, n=12)
    P.sprite(img, x, y + 0.5 * h, w, h)


def paddy(P, mask, n=8, gap=7.0):
    """A rice paddy: standing water that holds the sky, and young rice in lines."""
    ys, xs = np.where(mask)
    P.set_clip(ndimage.binary_erosion(mask, iterations=4))
    P.poly([(xs.min(), ys.min()), (xs.max(), ys.min()), (xs.max(), ys.max()), (xs.min(), ys.max())], (176, 204, 208), alpha=0.5, rough=0)
    P.set_clip(None)
    cols, lo, hi = _edges(mask, 0)
    core = ndimage.binary_erosion(mask, iterations=6)
    for i in range(n):
        t = ((i + 0.5) / n) ** 1.12
        line = lo + t * (hi - lo)
        s = scale(float(np.mean(line)))
        step = max(gap * s, 3.0)
        for x in np.arange(cols[0] + step * (0.5 + 0.5 * (i % 2)), cols[-1], step):
            y = float(np.interp(x, cols, line))
            if not core[min(int(round(y)), mask.shape[0] - 1), int(round(x))]:
                P.n += 1
                continue
            P.stroke([(x, y), (x + 0.4 * s, y - 2.6 * s)], max(0.9 * s, 0.6), (78, 128, 70), rough=0.0)


def orchard(P, mask, n=3, gap=19.0):
    """Fruit trees in lines."""
    cols, lo, hi = _edges(mask, 0)
    core = ndimage.binary_erosion(mask, iterations=7)
    for i in range(n):
        t = ((i + 0.6) / n) ** 1.1
        line = lo + t * (hi - lo)
        s = scale(float(np.mean(line)))
        step = gap * s
        for x in np.arange(cols[0] + step * 0.7, cols[-1], step):
            y = float(np.interp(x, cols, line))
            if not core[min(int(round(y)), mask.shape[0] - 1), int(round(x))]:
                P.n += 4
                continue
            r = 5.6 * s
            P.ellipse(x - 0.8 * r, y + 0.1 * r, 1.1 * r, 0.4 * r, SHADOW, mul=True, alpha=0.6, rough=0.3, n=10)
            P.ellipse(x, y - 0.9 * r, r, 0.92 * r, (52, 100, 54), rough=0.5, n=12)
            P.ellipse(x + 0.3 * r, y - 1.2 * r, 0.5 * r, 0.42 * r, (88, 138, 66), rough=0.35, n=10)
            P.ellipse(x - 0.25 * r, y - 0.7 * r, 0.16 * r, 0.16 * r, (226, 150, 64), rough=0.05, n=7)   # fruit


def flowers(P, mask, color=(246, 226, 92), count=150):
    """Blossom scattered over a field."""
    core = ndimage.binary_erosion(mask, iterations=4)
    ys, xs = np.where(core)
    if len(ys) == 0:
        P.n += count
        return
    rng = np.random.default_rng(int(xs.mean() * 3 + ys.mean()))
    for i in rng.choice(len(ys), size=count):
        s = scale(float(ys[i]))
        P.ellipse(float(xs[i]), float(ys[i]), 1.5 * s, 1.1 * s, color, rough=0.1, n=7)


def egret(P, x, y, flip=False):
    s = scale(y); d = -1 if flip else 1
    P.stroke([(x - 1 * s, y), (x - 1 * s, y - 4 * s)], max(0.5 * s, 0.5), (60, 60, 56), rough=0)
    P.stroke([(x + 1 * s, y), (x + 1 * s, y - 4 * s)], max(0.5 * s, 0.5), (60, 60, 56), rough=0)
    P.ellipse(x, y - 5.6 * s, 3.4 * s, 2.2 * s, (246, 246, 240), rough=0.15, n=12)
    P.stroke([(x + d * 2.4 * s, y - 6.4 * s), (x + d * 3.6 * s, y - 9.6 * s), (x + d * 4.8 * s, y - 10 * s)], 1.1 * s, (246, 246, 240), rough=0.05)
    P.stroke([(x + d * 4.8 * s, y - 10 * s), (x + d * 7 * s, y - 9.6 * s)], max(0.6 * s, 0.5), (226, 170, 70), rough=0)


def truck(P, x, y, flip=False):
    """The small blue farm truck."""
    s = scale(y); d = -1 if flip else 1
    P.poly([(x - 15 * s, y + 2 * s), (x + 13 * s, y + 2 * s), (x + 11 * s, y - 1 * s), (x - 17 * s, y - 1 * s)], SHADOW, mul=True, alpha=0.7, rough=0.3)
    P.poly([(x - d * 14 * s, y - 7 * s), (x + d * 3 * s, y - 7 * s), (x + d * 3 * s, y - 1 * s), (x - d * 14 * s, y - 1 * s)], (62, 108, 170), rough=0.2)
    P.poly([(x - d * 13 * s, y - 9.5 * s), (x + d * 2 * s, y - 9.5 * s), (x + d * 2 * s, y - 7 * s), (x - d * 13 * s, y - 7 * s)], (190, 160, 100), rough=0.25)
    P.poly([(x + d * 3 * s, y - 11 * s), (x + d * 10 * s, y - 11 * s), (x + d * 13 * s, y - 6 * s), (x + d * 13 * s, y - 1 * s), (x + d * 3 * s, y - 1 * s)], (74, 124, 190), rough=0.2)
    P.poly([(x + d * 5 * s, y - 10 * s), (x + d * 9.4 * s, y - 10 * s), (x + d * 11.6 * s, y - 6.4 * s), (x + d * 5 * s, y - 6.4 * s)], (196, 216, 224), rough=0.1)
    for wx in (x - d * 9 * s, x + d * 8 * s):
        P.ellipse(wx, y - 0.6 * s, 2.6 * s, 2.6 * s, (44, 44, 48), rough=0.1, n=10)


def bridge(P, x, y, half=31.0):
    """A plank footbridge over the river."""
    s = scale(y); w = half * s
    P.poly([(x - w, y - 1 * s), (x + w, y - 4 * s), (x + w, y + 1 * s), (x - w, y + 4 * s)], (196, 168, 118), rough=0.3)
    P.stroke([(x - w, y - 1 * s), (x + w, y - 4 * s)], max(1.2 * s, 0.8), (120, 92, 60), rough=0.1)
    P.stroke([(x - w, y + 4 * s), (x + w, y + 1 * s)], max(1.2 * s, 0.8), (120, 92, 60), rough=0.1)
    for t in np.linspace(-0.8, 0.8, 5):
        P.stroke([(x + t * w, y + 1.5 * s - t * 1.5 * s - 2.5 * s), (x + t * w, y + 1.5 * s - t * 1.5 * s - 7 * s)], max(0.8 * s, 0.6), (120, 92, 60), rough=0)


# ---- the scene -------------------------------------------------------------
# Field treatments: a point inside the field, what grows there.
FIELDS = [
    ((1069, 832), "seedlings", dict(n=6, gap=12)),            # the field the camera starts on
    ((600, 645), "rows", dict(n=6, axis=0)),
    ((940, 810), "rows", dict(n=8, axis=1)),
    ((1260, 800), "rows", dict(n=9, axis=0)),
    ((1900, 825), "rows", dict(n=7, axis=0)),
    ((240, 900), "rows", dict(n=7, axis=0)),
    ((560, 1095), "rows", dict(n=6, axis=1)),
    ((1745, 665), "rows", dict(n=5, axis=0)),
    ((890, 1085), "seedlings", dict(n=6, gap=13)),
    ((700, 845), "seedlings", dict(n=5, gap=11)),
    ((1560, 835), "seedlings", dict(n=5, gap=12)),
    ((1150, 1085), "seedlings", dict(n=6, gap=13)),
    ((1480, 725), "rows", dict(n=6, axis=0, mul=(214, 222, 214), alpha=0.6)),
    ((1340, 690), "rows", dict(n=5, axis=1)),
    ((330, 1010), "rows", dict(n=6, axis=0, mul=(214, 214, 190), alpha=0.6)),
    ((1900, 1030), "seedlings", dict(n=5, gap=13)),
]
HOUSES = [  # x, y, flip, roof
    (925, 668, False, (172, 90, 56)), (1150, 652, True, (104, 118, 128)), (1312, 662, False, (172, 90, 56)),
    (590, 712, True, (150, 70, 50)), (455, 716, False, (172, 90, 56)), (1762, 702, True, (172, 90, 56)),
    (300, 824, False, (104, 118, 128)), (1528, 864, False, (172, 90, 56)), (1915, 850, True, (150, 70, 50)),
    (1302, 908, True, (172, 90, 56)), (772, 968, False, (150, 70, 50)), (318, 1004, True, (172, 90, 56)),
]
TREES = [  # x, y, size, tone
    (897, 666, 1.0, 0), (958, 672, 0.8, 1), (1178, 655, 0.9, 2), (1286, 664, 0.9, 0), (562, 714, 0.9, 1), (425, 716, 1.0, 0), (486, 720, 0.8, 2),
    (1792, 704, 0.9, 1), (262, 826, 1.0, 0), (338, 828, 0.85, 2), (1486, 862, 1.0, 1), (1574, 870, 0.8, 0), (1958, 852, 1.0, 2), (1874, 854, 0.85, 0),
    (1262, 908, 1.0, 0), (1342, 912, 0.85, 1), (732, 968, 1.0, 2), (812, 972, 0.85, 0), (276, 1006, 1.0, 1), (1010, 905, 0.9, 0),
    (1076, 1004, 0.9, 2), (566, 936, 0.9, 1), (1470, 1012, 0.9, 0), (1732, 906, 0.9, 1), (852, 742, 0.8, 0), (1268, 728, 0.8, 2),
    (1436, 884, 0.85, 1), (1602, 1096, 1.0, 0), (1000, 1132, 1.0, 1), (402, 1066, 0.95, 0), (1796, 1146, 1.0, 2), (680, 620, 0.8, 0),
    (1040, 618, 0.75, 1), (1556, 660, 0.8, 2), (1962, 718, 0.85, 0),
]
PALMS = [(346, 1002, 1.0), (360, 1008, 0.85), (1552, 866, 1.0), (1938, 856, 0.9), (800, 966, 0.9), (1326, 904, 0.9), (1620, 1090, 1.0), (240, 830, 0.9), (1004, 1128, 0.95), (1014, 1136, 0.8)]
FARMERS = [  # x, y, shirt, bent
    (1038, 843, (76, 108, 160), False), (1090, 870, (196, 84, 70), True),
    (702, 874, (236, 232, 220), False), (1246, 964, (76, 108, 160), False), (908, 988, (196, 84, 70), False), (1422, 960, (236, 232, 220), True),
    (542, 902, (76, 108, 160), True), (1650, 996, (236, 232, 220), False), (1206, 1088, (196, 84, 70), False), (312, 944, (236, 232, 220), False),
    (1886, 970, (76, 108, 160), False), (850, 800, (196, 84, 70), False), (1402, 708, (236, 232, 220), False), (1088, 1108, (76, 108, 160), True),
    (916, 1110, (236, 232, 220), True), (646, 772, (76, 108, 160), False), (1560, 1000, (196, 84, 70), True), (1712, 1068, (76, 108, 160), False),
]
HAYSTACKS = [(1140, 930, 1.0), (1168, 944, 0.9), (1118, 952, 0.9), (1340, 968, 1.0), (1366, 986, 0.9), (1624, 928, 1.0), (1652, 940, 0.9), (1600, 946, 0.85),
             (1500, 598, 0.9), (1540, 604, 0.8), (1150, 918, 0.8)]
NETHOUSES = [(1930, 770, 3, 54), (452, 990, 3, 62)]
# Version D only
PADDIES = [(1480, 725), (1930, 915), (130, 1000)]
ORCHARDS = [((835, 690), 3), ((1300, 1085), 3)]
FLOWERS = [(800, 848), (1235, 680), (195, 1045)]
EGRETS = [(1462, 716, False), (1500, 742, True), (1905, 912, False), (1960, 930, True), (1985, 908, False), (150, 990, False), (96, 1012, True)]
TRUCKS = [(1196, 890, False), (640, 925, True)]
BRIDGES = [(1744, 940)]


def paint(P, field_of, dots=(), rich=False, reactor_img=None, hero=None):
    """Lays the whole scene onto a Painter, far to near. field_of(x, y) gives a
    field's mask (or None) on her untouched picture. rich (version D) adds
    paddies, orchards, blossom, egrets, a truck, a footbridge, and her own
    reactor drawing at every dot but `hero` (that one is a layer of its own)."""
    if rich:
        for j, (fx, fy) in enumerate(PADDIES):
            P.n = 60000 + j * 1500
            m = field_of(fx, fy)
            if m is not None:
                paddy(P, m)
            else:
                print("  no clean field at", (fx, fy), "- skipped paddy")
        for j, ((fx, fy), n) in enumerate(ORCHARDS):
            P.n = 70000 + j * 1500
            m = field_of(fx, fy)
            if m is not None:
                orchard(P, m, n)
        for j, (fx, fy) in enumerate(FLOWERS):
            P.n = 80000 + j * 1500
            m = field_of(fx, fy)
            if m is not None:
                flowers(P, m)
        P.n = 0
    for (fx, fy), kind, kw in FIELDS:
        if rich and (fx, fy) in PADDIES:
            P.n += 500
            continue
        m = field_of(fx, fy)
        if m is None:
            print("  no clean field at", (fx, fy), "- skipped", kind)
            P.n += 500
            continue
        n0 = P.n
        (rows if kind == "rows" else seedlings)(P, m, **kw)
        P.n = n0 + 500                              # the same jitter whatever a window culls
    things = [(y, 0, house, (x, y, f), dict(roof=r)) for x, y, f, r in HOUSES]
    things += [(y, 1, nethouse, (x, y, n, ln), {}) for x, y, n, ln in NETHOUSES]
    things += [(y, 2, haystack, (x, y, s), {}) for x, y, s in HAYSTACKS]
    things += [(y, 3, tree, (x, y, s, t), {}) for x, y, s, t in TREES]
    things += [(y, 4, palm, (x, y, s), {}) for x, y, s in PALMS]
    things += [(y, 5, farmer, (x, y, c, b), dict(hoe=rich and k % 3 == 0)) for k, (x, y, c, b) in enumerate(FARMERS)]
    if rich:
        things += [(y, 6, egret, (x, y, f), {}) for x, y, f in EGRETS]
        things += [(y, 7, truck, (x, y, f), {}) for x, y, f in TRUCKS]
        things += [(y, 8, bridge, (x, y), {}) for x, y in BRIDGES]
        if reactor_img is not None:
            for j, (dx, dy, _) in enumerate(dots):
                if j != hero:
                    h = 23 * scale(dy)
                    things.append((dy + 0.5 * h, 9, reactor, (reactor_img, dx, dy, h), {}))
    for i, (y, _, fn, args, kw) in enumerate(sorted(things, key=lambda t: (t[0], t[1]))):
        P.n = 20000 + i * 200
        for dx, dy, _ in (() if rich else dots):
            if fn is not farmer and np.hypot(args[0] - dx, (args[1] - 14 * scale(args[1])) - dy) < 20 * scale(args[1]) and P.k == 1:
                print("  note:", fn.__name__, "at", args[:2], "sits on the reactor at", (dx, dy))
        fn(P, *args, **kw)
