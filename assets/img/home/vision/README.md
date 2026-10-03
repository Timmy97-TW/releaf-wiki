# Vision section artwork ("Every farmer a biomanufacturer.")

The pictures for the homepage's last section (`#vision` in `index.html`), drawn by
Jacquelyn on 2 October 2026. Every shape in the valley is hers. The five source PNGs
(2048 x 1152) live with the team's other source art, not in this repository:

    Zoomed out w_o green dots.PNG   the valley in daylight, no reactors
    Zoomed out green dots.PNG       the reactors' glows alone, transparent
    Zoomed out.PNG                  the two together
    Zoomed in.PNG                   one field, 12x (a crop of the valley)
    Zoomed in with bioreactor .PNG  the same field with a reactor drawn on it

`build/vision-art.py` turns those five into the files here. **Do not edit these by
hand**: run the script again instead, from the repository root.

    python3 build/vision-art.py "path/to/that/folder"
    python3 build/vision-art.py "path/to/that/folder" --preview /tmp/day.png

`--preview` also writes the daylight picture with the farm details on it, which is the
quickest way to check a change to `build/vision_details.py`. The script needs numpy,
Pillow, scipy and `cwebp`. It takes about 30 seconds and rewrites every file below plus
`assets/js/home-vision-data.js`, which carries the rectangles and the reactor list the
page reads. Bump the `?v=` on the homepage's css and js after any change here.

## The layers

The artboard is **2048 x 1552 units**, (0, 0) at the top left: her drawing at y 400 to
1552, with 400 units of her own sky carried up above it so a tall screen (a phone) can
show more sky rather than less valley. The horizon is at y 1170.

| File | What it is |
|---|---|
| `land.webp` | her mountains and fields in daylight, at twice her size, with the farm details drawn in. The only picture of the land: the page dims it to night and lights it again |
| `land-mask.webp` | the land's outline, small. Keeps the night off the sky |
| `masks.webp` | one sprite per reactor: the shape of the field it lights, packed on shelves |
| `close.webp` | the field the camera starts on, at five times her size, with its details |
| `hero-mask.webp` | that field's shape, to the same scale |
| `sky-night.webp` | her sky at night, with stars |
| `sky-dawn.webp` | the same sky at first light |
| `sun.webp` | her sun, lifted out of the sky so it can rise from behind the ridge |
| `reactor.webp` | her bioreactor, cut out of the close-up, its lime turned to `--sig-green` |

## The farm details

The houses, trees, palms, farmers, furrows, seedlings, paddies, orchards, haystacks,
net houses, truck and footbridge are **not** in her drawing: `build/vision_details.py`
draws them in her manner (flat shapes, dry-brush edges, her palette) at whatever scale
the picture is being built at. They were added by the team with AI assistance in
October 2026; her painting underneath is untouched. Their positions are plain lists at
the foot of that file, in her picture's own pixels, so moving or removing one is a
one-line edit.

## If the drawing is replaced

Keep the five file names and the 16:9 shape and the script will take new art as it
stands. Then check, in order: the sun is found (it is the only pure white disc in the
sky), the reactors' dots are found (the script prints how many), and every field under
a dot is a solid patch of one colour (the script prints the ones it could not read, and
falls back to a round pool of light there). `FOCAL` in the script is the reactor the
camera opens on, and `build/vision_details.py` places its details against the same
picture, so both need revisiting if the composition changes.
