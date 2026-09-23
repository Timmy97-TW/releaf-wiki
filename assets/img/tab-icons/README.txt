ReLeaf site navigation: tab artwork
===================================

Each of the five tabs shows a drawing above its title in the drop panel.
Drop the student designs in here with these exact filenames:

    project.png
    wetlab.png
    drylab.png
    engagement.png
    team.png

Then switch it on for that tab in assets/data/site-nav.js:

    { id: "wetlab", name: "Wet Lab", art: true, ... }

.svg works too, and so does .webp. If you use a different extension or a
different name, give "art" the path from the wiki root instead of true:

    { id: "wetlab", name: "Wet Lab", art: "assets/img/tab-icons/pipette.svg", ... }

Guidance
--------
  size        square, 256x256 or larger (it renders at 56px, 112px on retina)
  background  transparent PNG or SVG
  colour      anything, but the panel around it is white with leaf-green
              accents (#14402b / #23684a / #4f9c6f), so mid to dark tones read
              best
  weight      the drawing sits next to 1.75rem type, so keep it simple enough
              to read at thumbnail size

A tab without "art" requests nothing, and a file that fails to load is
removed, so the nav will not show a broken image while you are still drawing.
