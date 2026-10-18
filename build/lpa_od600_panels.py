"""Rebuild results/lpa-od600-panels: six light-plate OD600 panels.

Numbers are the Measurement page's own sampling table (19 September light plate
run, B. subtilis WB800 + CcaSR), three tubes per green tier and one per red.
The earlier figure plotted the 24 h green 2% and 12% means as 0.073 and 0.034;
the table's tubes are 1.056/1.083/1.081 and 1.059/1.008/1.036, so those two
means are 1.073 and 1.034.  Green tiers map 220 lux = 2%, 510 = 12%, 3850 = 100%.
"""
import sys, pathlib
import numpy as np
import matplotlib
matplotlib.use("Agg")
from matplotlib import font_manager as fm
import matplotlib.pyplot as plt
from matplotlib.patheffects import withStroke

def bold(c, w=1.5):
    """Inter ships here as one variable face with no bold instance, so weight
    is added with a hairline stroke in the glyph's own colour."""
    return [withStroke(linewidth=w, foreground=c)]

OUT = pathlib.Path(sys.argv[1])
FONT = pathlib.Path(sys.argv[2])
if FONT.exists():
    fm.fontManager.addfont(str(FONT))
    FAM = fm.FontProperties(fname=str(FONT)).get_name()
else:
    FAM = "Helvetica Neue"
plt.rcParams.update({"font.family": FAM, "svg.fonttype": "none"})

T = np.array([2, 4, 6, 8, 24], float)
BLANK = [0.061, 0.059, 0.057, 0.059, 0.059]

RED = {                                   # one tube per tier
    "Red 2%":   ([0.108], [0.115], [0.188], [0.251], [1.026]),
    "Red 12%":  ([0.108], [0.114], [0.194], [0.244], [0.969]),
    "Red 100%": ([0.103], [0.120], [0.201], [0.256], [1.026]),
}
GREEN = {                                 # three tubes per tier
    "Green 2%":   ([0.118,0.089,0.111],[0.122,0.123,0.119],[0.412,0.383,0.195],[0.293,0.237,0.250],[1.056,1.083,1.081]),
    "Green 12%":  ([0.109,0.115,0.109],[0.123,0.149,0.126],[0.285,0.195,0.208],[0.290,0.284,0.259],[1.059,1.008,1.036]),
    "Green 100%": ([0.106,0.108,0.103],[0.121,0.119,0.120],[0.295,0.188,0.209],[0.269,0.280,0.269],[1.000,1.020,1.031]),
}
INK = {"Red 2%":"#bd896d","Red 12%":"#af684e","Red 100%":"#7d4737",
       "Green 2%":"#6ca99b","Green 12%":"#3b908a","Green 100%":"#1a565f"}
TITLE, SUB, FOOT, GRID, BLANKC = "#1a2833", "#617772", "#707d7d", "#e9ecec", "#9aa3a3"

fig, axes = plt.subplots(2, 3, figsize=(16, 10.4), dpi=100, sharex=True, sharey=True)
fig.patch.set_facecolor("white")

for ax, (name, rows) in zip(axes.ravel(), list(RED.items()) + list(GREEN.items())):
    c = INK[name]
    means = [float(np.mean(r)) for r in rows]
    ax.plot(T, BLANK, ls=(0, (6, 5)), lw=2.0, color=BLANKC, zorder=1)
    for t, r in zip(T, rows):                      # every tube as its own dot
        ax.plot([t] * len(r), r, "o", ms=9, color=c, alpha=.72, mec="none", zorder=3)
    ax.plot(T, means, "-", lw=3.4, color=c, solid_capstyle="round", zorder=2)
    ax.annotate(f"{means[-1]:.3f}", (T[-1], means[-1]), textcoords="offset points",
                xytext=(-6, 16), ha="right", color=c, fontsize=17, path_effects=bold(c))
    ax.set_title(name, loc="left", color=c, fontsize=19, pad=14, path_effects=bold(c, 1.7))
    ax.set_ylim(-0.03, 1.22)
    ax.set_xlim(0.2, 25.8)
    ax.set_xticks([2, 4, 6, 8, 24])
    ax.set_yticks(np.arange(0, 1.21, .2))
    ax.tick_params(labelsize=14, colors=FOOT, length=0)
    ax.grid(axis="y", color=GRID, lw=1.2)
    ax.set_axisbelow(True)
    for s in ("top", "right", "left"):
        ax.spines[s].set_visible(False)
    ax.spines["bottom"].set_color(GRID)

for ax in axes[:, 0]:
    ax.set_ylabel("Raw OD600", fontsize=15, color=FOOT, labelpad=10)
for ax in axes[1]:
    ax.set_xlabel("Time (h)", fontsize=15, color=FOOT, labelpad=8)

fig.suptitle("One panel per illumination setting", x=.075, y=.962, ha="left",
             fontsize=30, color=TITLE, path_effects=bold(TITLE, 2.2))
fig.text(.075, .908, "Shared axes make the six trajectories directly comparable. "
                     "Dashed line: measured blank.", fontsize=16, color=SUB)
fig.text(.075, .022, "Supplied raw readings; dots are single tubes and the line joins "
                     "their mean. OD600 is turbidity, not protein output.",
         fontsize=15, color=FOOT)
fig.subplots_adjust(left=.085, right=.955, top=.825, bottom=.115, wspace=.14, hspace=.26)
fig.savefig(OUT, format="webp", facecolor="white")
print("wrote", OUT, OUT.stat().st_size, "bytes")
