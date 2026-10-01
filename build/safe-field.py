"""The homepage's "out of the field" drawing (#safe in index.html).

A Taiwanese farm at first light: three ridges of the Central Range, paddies,
betel palms and a brick farmhouse, and in front a field of young plants
behind an earth ridge and a bamboo fence. Engineered rods gather outside the
ridge under a no-entry sign; only amber drops of protectant cross into the
rows. Seeded, so it redraws the same every time.

    python3 build/safe-field.py > /tmp/safe.svg

Paste the <svg> into the <figure class="sf-fig"> in index.html. The colours
live in assets/css/home-safe.css (.sfd-*), not here.
"""
import random, math
random.seed(7)
W,H=560,420
o=[]
def f(v): return ('%.1f'%v).rstrip('0').rstrip('.')
def P(pts,close=True):
    s='M'+' L'.join(f(x)+' '+f(y) for x,y in pts)
    return s+('z' if close else '')
def jit(pts,a=1.2):
    return [(x+random.uniform(-a,a),y+random.uniform(-a,a)) for x,y in pts]
# sun
o.append('<circle class="sfd-sun" cx="474" cy="62" r="24"/>')
# mountains: three layers, the Central Range far back
def ridge(y0,lo,hi,step,base,cls,seed):
    random.seed(seed)
    pts=[(0,y0)]; x=0
    while x<W:
        x+=random.uniform(*step); pts.append((min(x,W),random.uniform(lo,hi)))
    pts+=[(W,base),(0,base)]
    o.append('<path class="%s" d="%s"/>'%(cls,P(pts)))
    # a few contour strokes down from the peaks
    c=[]
    for (x,y) in pts[1:-3]:
        if y<(lo+hi)/2 and random.random()<.7:
            c.append('M%s %sq%s %s %s %s'%(f(x),f(y+3),f(random.uniform(-6,6)),f(10),f(random.uniform(-10,10)),f(random.uniform(16,26))))
    o.append('<path class="%s-c" d="%s"/>'%(cls.split()[-1],''.join(c)))
ridge(120,66,112,(18,34),200,'sfd-mtn sfd-mtn--far',3)
ridge(150,104,138,(26,48),205,'sfd-mtn sfd-mtn--mid',5)
ridge(180,146,172,(40,70),214,'sfd-mtn sfd-mtn--near',9)
random.seed(11)
# paddies: strips y 196..252
ys=[196,206,218,232,252]
for i in range(len(ys)-1):
    y0,y1=ys[i],ys[i+1]
    cls='sfd-water' if i%2==0 else 'sfd-paddy'
    o.append('<path class="%s" d="%s"/>'%(cls,P(jit([(0,y0),(W,y0+random.uniform(-2,2)),(W,y1),(0,y1)],.6))))
    # rice tufts rows on paddy strips
    if cls=='sfd-paddy':
        t=[]
        for xx in range(6,W,11):
            yy=(y0+y1)/2+random.uniform(-1,1)
            t.append('M%s %sl-1.6 -3.4M%s %sl1.6 -3.4'%(f(xx),f(yy),f(xx),f(yy)))
        o.append('<path class="sfd-tuft" d="%s"/>'%''.join(t))
    else:
        t=[]
        for xx in range(10,W,16):
            yy=(y0+y1)/2+random.uniform(-1.5,1.5)
            t.append('M%s %sl0 -4'%(f(xx),f(yy)))
        o.append('<path class="sfd-tuft sfd-tuft--young" d="%s"/>'%''.join(t))
# bamboo and trees behind the house
o.append('<path class="sfd-tree" d="M30 202c-6-16 4-30 18-28 4-12 22-14 28-2 14-4 24 8 18 22z"/><path class="sfd-tree sfd-tree--b" d="M146 204c-4-12 4-22 14-20 6-10 20-8 22 4 8 2 10 10 6 16z"/>')
o.append('<g class="sfd-house" transform="translate(0 -10)">'
 '<path class="sfd-wall" d="M44 214V188h92v26z"/>'
 '<path class="sfd-roof" d="M36 190l12-14h84l12 14z"/>'
 '<path class="sfd-roofline" d="M48 176h84"/>'
 '<path class="sfd-wing" d="M136 214v-18h26v18z"/><path class="sfd-roof" d="M132 198l6-8h22l6 8z"/>'
 '<rect class="sfd-door" x="82" y="198" width="14" height="16" rx="1"/>'
 '<rect class="sfd-win" x="56" y="196" width="12" height="9"/><rect class="sfd-win" x="110" y="196" width="12" height="9"/>'
 '</g>')
# betel palms behind the field edge
def palm(x,base,top,lean):
    s='<g class="sfd-palm">'
    s+='<path class="sfd-trunk" d="M%s %s Q%s %s %s %s"/>'%(f(x),f(base),f(x+lean*.4),f((base+top)/2),f(x+lean),f(top))
    cx,cy=x+lean,top
    fr=[]
    for a in (-150,-118,-90,-62,-30,-170,-10):
        r=random.uniform(16,22); ar=math.radians(a)
        ex,ey=cx+r*math.cos(ar),cy+r*math.sin(ar)+ (8 if abs(a+90)>50 else 0)
        mx,my=cx+r*.55*math.cos(ar),cy+r*.55*math.sin(ar)-4
        fr.append('M%s %sQ%s %s %s %s'%(f(cx),f(cy),f(mx),f(my),f(ex),f(ey)))
    s+='<path class="sfd-frond" d="%s"/>'%''.join(fr)
    s+='<circle class="sfd-nut" cx="%s" cy="%s" r="2.6"/></g>'%(f(cx+1),f(cy+4))
    return s
o.append(palm(214,236,112,4)); o.append(palm(236,240,128,-3)); o.append(palm(520,224,120,5))
# foreground: field
VP=(400,150)
field=[(198,252),(W,252),(W,H),(132,H)]
o.append('<path class="sfd-field" d="%s"/>'%P(field))
# outside ground
o.append('<path class="sfd-ground" d="%s"/>'%P([(0,252),(198,252),(132,H),(0,H)]))
# rows + sprouts
rows=[]; sprouts=[]
for i in range(9):
    xb=170+i*52  # bottom x
    # line from y=252 to H towards VP
    def at(y):
        t=(y-VP[1])/(H-VP[1]); return VP[0]+(xb-VP[0])*t
    x0=at(254); 
    if xb>W+120: break
    rows.append('M%s 254L%s %s'%(f(x0),f(xb),H))
    for y in (264,280,300,324,352,386):
        x=at(y)
        if x<at(254)-1 and False: pass
        # keep inside field: left boundary line from (198,252)->(132,H)
        lb=198+(132-198)*(y-252)/(H-252)
        if x<lb+8 or x>W-4: continue
        s=.35+.95*(y-252)/(H-252)
        sprouts.append((x,y,s))
o.append('<path class="sfd-row" d="%s"/>'%''.join(rows))
sp=[]
for x,y,s in sprouts:
    sp.append('<path class="sfd-sprout" transform="translate(%s %s) scale(%s)" d="M0 0V-9M0 -5c-1-5-5-7-10-7 0 5 4 7 10 7zM0 -8c1-5 5-7 9-7 0 5-4 7-9 7z"/>'%(f(x),f(y),f(s)))
o.append(''.join(sp))
# the ridge (field edge) with bamboo posts and string
o.append('<path class="sfd-ridge" d="M192 252L204 252L140 420L120 420z"/>')
posts=[]
for k in range(5):
    t=(k+.3)/5; y=258+t*(H-262); x=196+(128-196)*(y-252)/(H-252)
    h=10+22*t
    posts.append((x,y,h))
o.append('<path class="sfd-post" d="%s"/>'%''.join('M%s %sV%s'%(f(x),f(y),f(y-h)) for x,y,h in posts))
o.append('<path class="sfd-string" d="%s"/>'%('M'+' L'.join('%s %s'%(f(x),f(y-h*.82)) for x,y,h in posts)))
# bacteria cluster, outside, pressing at the edge
cells=[(58,318,-24),(92,300,14),(84,342,-60),(118,330,8),(46,360,30),(104,372,-18),(70,388,52),(26,334,-80)]
cg=[]
for x,y,a in cells:
    cg.append('<g transform="translate(%s %s) rotate(%s)"><rect class="sfd-cell" x="-15" y="-5.5" width="30" height="11" rx="5.5"/><path class="sfd-cell__hi" d="M-8 -1.6h9"/></g>'%(x,y,a))
o.append(''.join(cg))
# sign: no engineered microbes past this edge
o.append('<g class="sfd-sign" transform="translate(150 262)">'
 '<path class="sfd-signpost" d="M0 0V-34"/>'
 '<circle class="sfd-signface" cx="0" cy="-50" r="17"/>'
 '<g transform="translate(0 -50) rotate(-20)"><rect class="sfd-signcell" x="-9" y="-3.6" width="18" height="7.2" rx="3.6"/></g>'
 '<circle class="sfd-signring" cx="0" cy="-50" r="17"/>'
 '<path class="sfd-signbar" d="M-12 -62L12 -38"/>'
 '</g>')
# protectant drops crossing over the edge into the field
drops=[(124,318,2.6),(146,306,2.8),(170,298,3),(196,296,3.1),(222,300,3.2),(248,308,3.3),(272,318,3.4)]
o.append(''.join('<circle class="sfd-drop" cx="%s" cy="%s" r="%s"/>'%d for d in drops))
svg='<svg class="sfd" viewBox="0 34 %d %d" aria-hidden="true" focusable="false">%s</svg>'%(W,H-34,''.join(o))
print(svg)
