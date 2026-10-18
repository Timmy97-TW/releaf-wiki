# The students' own sticker drawings into the navigation picture (18 Oct 2026).
# Each drawing arrives as a 1920x1080 slide export, one object on white. We cut the
# white away, keep the object's own proportions, and sit it where the placeholder
# sat: same ground line, same centre, the same visual weight (equal area).
# Sprite boxes in layout-pages.js and their click outlines are rewritten to match.
#   python3 build/navmap-stickers.py "<folder of slides>" [--write]
import json, math, os, re, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'assets/navmap/img/w')
LAYOUT = os.path.join(ROOT, 'assets/navmap/layout-pages.js')

# slide -> the sticker it replaces.  'crop' takes the upper part of a drawing for a
# second sticker (the board without its post, the screen without its mast); those two
# are held or mounted by another object, so their boxes are left exactly where they are.
JOBS = [
    ('3',  'description'),
    ('5',  'biomanufacturing'),
    ('7',  'engineering'),
    ('9',  'development'),
    ('11', 'contribution@toolbox'),
    ('13', 'results@stand', {'top': 'results'}),
    ('16', 'parts'),
    ('17', 'plant@plot', {'largest': True, 'panel': True}),
    ('20', 'safety-and-security', {'onpost': 'safety-and-security@post'}),
    ('22', 'notebook'),
    ('24', 'model'),
    ('27', 'software@stand', {'top': 'software'}),
    ('29', 'protein-design'),
    ('32', 'human-practices'),
    ('34', 'education'),
    ('36', 'entrepreneurship'),
    ('38', 'sustainability'),
    ('40', 'laws-and-regulations'),
    ('42', 'geospatial-analysis'),
    ('44', 'data-physicalization'),
    ('47', 'attributions'),
]
FIXED = {'results', 'software'}        # sits in another object's hands / on its mast
MARGIN = 0.02                          # transparent breathing room, as a share of the art


def cutout(path, largest=False, flat=23, soft=55):
    """A slide export -> RGBA with its backing taken away, trimmed to the drawing.

    The backing is whatever colour runs round the edge of the slide (white on most of
    them, a pale panel on one), taken only where it reaches the border."""
    im = Image.open(path).convert('RGB')
    A = np.asarray(im).astype(np.int16)
    frame = np.concatenate([A[0], A[-1], A[:, 0], A[:, 1]])
    back = np.median(frame, 0)
    d = np.abs(A - back).max(2)
    lab, _ = nd.label(d <= flat)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    solid = ~np.isin(lab, list(edge))
    alpha = solid.astype(float)
    band = solid & nd.binary_dilation(~solid, iterations=2)
    alpha[band] = np.minimum(alpha[band], np.clip(d / float(soft), 0, 1)[band])
    A = np.asarray(im)
    # specks from the export (a stray mark, a slide title) are not part of the drawing
    parts, n = nd.label(alpha > 0.15)
    sizes = np.bincount(parts.ravel())[1:]
    keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * (1.0 if largest else 0.005)]
    alpha[~np.isin(parts, keep)] = 0
    out = Image.fromarray(np.dstack([A, (alpha * 255).astype(np.uint8)]), 'RGBA')
    return out.crop(out.split()[-1].point(lambda v: 255 if v > 10 else 0).getbbox())


def strip_panel(im, flat=45, soft=70):
    """One drawing came out of the slide on a pale panel; take the panel away too."""
    A = np.asarray(im).astype(np.int16)
    rgb, a0 = A[..., :3], A[..., 3]
    frame = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    back = np.median(frame, 0)
    d = np.abs(rgb - back).max(2)
    lab, _ = nd.label((d <= flat) & (a0 > 0))
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    solid = ~np.isin(lab, list(edge))
    alpha = np.minimum(a0 / 255.0, solid.astype(float))
    band = solid & nd.binary_dilation(~solid, iterations=2)
    alpha[band] = np.minimum(alpha[band], np.clip(d / float(soft), 0, 1)[band])
    out = Image.fromarray(np.dstack([A[..., :3].astype(np.uint8), (alpha * 255).astype(np.uint8)]), 'RGBA')
    return out.crop(content_box(out, 10))


def rows_profile(im):
    a = np.asarray(im)[..., 3] > 40
    return a.sum(1)


def top_block(prof, frac=0.3):
    """Where the wide part at the top ends and a post or mast carries on alone."""
    lim = prof.max() * frac
    start = int(np.argmax(prof >= lim))
    narrow = np.nonzero(prof[start:] < lim)[0]
    return start + int(narrow.min()) if len(narrow) else len(prof)


def drop_stem(im):
    """Keep the wide part at the top: the board without its post, the screen without its mast."""
    top = im.crop((0, 0, im.width, top_block(rows_profile(im))))
    return top.crop(content_box(top, 10))


def content_box(im, t=8):
    return im.split()[-1].point(lambda v: 255 if v > t else 0).getbbox()


def framed(art, px_w):
    """The drawing on its own canvas, centred, with a little margin all round."""
    s = px_w / art.width
    art = art.resize((max(1, round(art.width * s)), max(1, round(art.height * s))), Image.LANCZOS)
    m = max(2, round(art.width * MARGIN)), max(2, round(art.height * MARGIN))
    can = Image.new('RGBA', (art.width + 2 * m[0], art.height + 2 * m[1]), (0, 0, 0, 0))
    can.alpha_composite(art, m)
    return can, m


def hit_points(can, x, y, w, h, cols=11):
    """A click outline that follows the new drawing: top edge across, then the foot back."""
    a = np.asarray(can)[..., 3] > 60
    W, H = can.size
    xs = np.nonzero(a.any(0))[0]
    if not len(xs):
        return None
    lo, hi = xs.min(), xs.max()
    edges = np.linspace(lo, hi + 1, cols + 1).astype(int)
    top, bot = [], []
    for i in range(cols):
        sl = a[:, edges[i]:max(edges[i] + 1, edges[i + 1])]
        ys = np.nonzero(sl.any(1))[0]
        if not len(ys):
            continue
        cx = (edges[i] + edges[i + 1]) / 2
        top.append((cx, ys.min()))
        bot.append((cx, ys.max() + 1))
    pts = top + bot[::-1]
    return ' '.join('%d,%d' % (round(x + px / W * w), round(y + py / H * h)) for px, py in pts)


def main(src, write):
    layout_src = open(LAYOUT).read()
    head = layout_src[:layout_src.index('{')]
    worlds = json.loads(layout_src[layout_src.index('{'):].rstrip().rstrip(';'))
    uses = {}
    for wname, wd in worlds.items():
        for pid, sp in wd['sprites'].items():
            uses.setdefault(sp.get('img', pid), []).append((wname, pid, sp))
    report = []

    for job in JOBS:
        num, name = job[0], job[1]
        opts = job[2] if len(job) > 2 else {}
        art = cutout(os.path.join(src, num + '.png'), largest=opts.get('largest', False))
        if opts.get('panel'):
            art = strip_panel(art)
        targets = [(name, art)]
        if 'top' in opts:
            targets.append((opts['top'], drop_stem(art)))
        for tname, tart in targets:
            old = Image.open(os.path.join(IMG, tname + '.webp')).convert('RGBA')
            ob = content_box(old)
            ow, oh = ob[2] - ob[0], ob[3] - ob[1]
            boxes = uses.get(tname, [])
            widest = max((sp['w'] for _, _, sp in boxes), default=max(old.width, 160))
            can, m = framed(tart, min(tart.width, round(widest * 1.4)))
            cw, ch = can.width - 2 * m[0], can.height - 2 * m[1]
            fixed = tname in FIXED or not boxes
            for wname, pid, sp in boxes:
                # the placeholder's drawing, in world units
                owld, ohld = sp['w'] * ow / old.width, sp['h'] * oh / old.height
                bx = sp['x'] + sp['w'] * (ob[0] + ob[2]) / (2 * old.width)
                by = sp['y'] + sp['h'] * ob[3] / old.height
                if fixed:            # keep the box: fit the drawing inside it
                    k = min(owld / cw, ohld / ch)
                else:                # same visual weight, the drawing's own shape
                    k = math.sqrt(owld * ohld / (cw * ch))
                boxw, boxh = can.width * k, can.height * k
                sp['w'], sp['h'] = round(boxw), round(boxh)
                sp['x'], sp['y'] = round(bx - boxw / 2), round(by + m[1] * k - boxh)
                pts = hit_points(can, sp['x'], sp['y'], sp['w'], sp['h'])
                if pts:
                    sp['hit'] = pts
            if 'onpost' in opts:     # the sign keeps the post it was nailed to
                post_name = opts['onpost']
                post = Image.open(os.path.join(IMG, post_name + '.webp')).convert('RGBA')
                prof = rows_profile(post)
                cut = top_block(prof)              # under this the post runs on alone
                sign_w = int(prof[:cut].max())
                new_sign = tart.resize((sign_w, max(1, round(tart.height * sign_w / tart.width))), Image.LANCZOS)
                out = Image.new('RGBA', (post.width, post.height), (0, 0, 0, 0))
                out.alpha_composite(post.crop((0, cut, post.width, post.height)), (0, cut))
                out.alpha_composite(new_sign, ((post.width - sign_w) // 2, max(0, cut - new_sign.height)))
                if write:
                    out.save(os.path.join(IMG, post_name + '.webp'), quality=88, method=6)
                report.append((post_name, out.size, 'on its post'))
            if write:
                can.save(os.path.join(IMG, tname + '.webp'), quality=88, method=6)
            report.append((tname, can.size, '%d placement%s%s' % (len(boxes), '' if len(boxes) == 1 else 's',
                                                                  ', box kept' if fixed else '')))
    if write:
        body = json.dumps(worlds, separators=(', ', ': '))
        open(LAYOUT, 'w').write(head + body + ';\n')
    for name, size, note in report:
        print('%-26s %-12s %s' % (name, '%dx%d' % size, note))
    print(('written' if write else 'dry run') + ': %d stickers' % len(report))


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    main(args[0], '--write' in sys.argv)
