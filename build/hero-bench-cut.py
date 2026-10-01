"""The hero's reactor, cut out of its render (assets/img/home/hero-bench-cut-*).

The render (hero-bench-2400.jpg) has the machine on the hero's ink. For the
light in the hero the machine has to stand in the field itself, so this
gives it a real alpha channel. The backdrop is the base ink plus one soft
green glow behind the machine (the scene's 520 nm light falling on it); it
is modelled as a radial profile round the glow's centre, measured from the
darkest pixels at each radius, so dark parts of the machine that sit inside
the glow keep their alpha. Soft edges are un-mixed from the backdrop.

    python3 build/hero-bench-cut.py

writes hero-bench-cut-2400.webp, -1400.webp and the -1400.png fallback.
After a new render, re-measure --r-cx/--r-cy/--r-hw/--r-hh in
home-hero.css from the cut's alpha (magick ... -alpha extract -threshold 50%
-format %@ info:).
"""
import numpy as np, subprocess, sys
def load(path):
    w,h=[int(v) for v in subprocess.check_output(['magick','identify','-format','%w %h',path]).split()]
    raw=subprocess.check_output(['magick',path,'-depth','8','rgb:-'])
    return np.frombuffer(raw,np.uint8).reshape(h,w,3).astype(np.float32)/255.0
def save(path,rgba):
    h,w,_=rgba.shape
    data=(np.clip(rgba,0,1)*255+.5).astype(np.uint8).tobytes()
    subprocess.run(['magick','-size','%dx%d'%(w,h),'-depth','8','rgba:-',path],input=data,check=True)
def smooth(e0,e1,x):
    t=np.clip((x-e0)/(e1-e0),0,1); return t*t*(3-2*t)
import os, tempfile
HOME=os.path.join(os.path.dirname(__file__),'..','assets','img','home')
src=os.path.join(HOME,'hero-bench-2400.jpg')
out=os.path.join(tempfile.mkdtemp(),'cut.png')
lo,hi=5.0,13.0
C=load(src); H,W,_=C.shape
base=np.array([7,11,10],np.float32)/255
R,G,Bc=C[...,0]*255,C[...,1]*255,C[...,2]*255
lum=C.mean(axis=2)*255
# the glow: greenish, dark, and not near any bright edge
glowish=(G-R>5)&(G-Bc>2)&(lum<40)
yy,xx=np.mgrid[0:H,0:W].astype(np.float32)
wts=glowish*(G-R)
x0=(xx*wts).sum()/wts.sum(); y0=(yy*wts).sum()/wts.sum()
sx=np.sqrt((wts*(xx-x0)**2).sum()/wts.sum()); sy=np.sqrt((wts*(yy-y0)**2).sum()/wts.sum())
r=np.sqrt(((xx-x0)/sx)**2+((yy-y0)/sy)**2)
nb=60; rmax=4.0
bins=np.clip((r/rmax*nb).astype(int),0,nb-1)
prof=np.zeros((nb,3),np.float32)
for b in range(nb):
    sel=(bins==b)&(lum<60)
    if sel.sum()<50: prof[b]=base; continue
    v=C[sel]
    # the darkest fifth at this radius is backdrop
    k=np.argsort(v.mean(axis=1))[:max(10,int(.2*len(v)))]
    prof[b]=np.median(v[k],axis=0)
# smooth the profile and make it fall monotonically to the base
for it in range(3):
    prof[1:-1]=(prof[:-2]+2*prof[1:-1]+prof[2:])/4
prof=np.maximum(prof,base)
for b in range(1,nb): prof[b]=np.minimum(prof[b],prof[b-1])
prof[-8:]=base
rf=np.clip(r/rmax*nb-.5,0,nb-1.001)
i0=rf.astype(int); t=(rf-i0)[...,None]
B=prof[i0]*(1-t)+prof[np.minimum(i0+1,nb-1)]*t
diff=np.abs(C-B).max(axis=2)*255
a=smooth(lo,hi,diff)
au=np.maximum(a,.25)[...,None]
F=np.clip(B+(C-B)/au,0,1)
F=np.where((a>.98)[...,None],C,F)
save(out,np.dstack([F,a]))
print('glow centre %.0f,%.0f sigma %.0f,%.0f  alpha mean %.3f'%(x0,y0,sx,sy,a.mean()))

def enc(png, name, width=None):
    p=png
    if width:
        p=png.replace('.png','-%d.png'%width)
        subprocess.run(['magick',png,'-resize','%dx'%width,p],check=True)
    subprocess.run(['cwebp','-quiet','-q','86','-alpha_q','100','-m','6','-exact',p,'-o',os.path.join(HOME,name+'.webp')],check=True)
    return p
enc(out,'hero-bench-cut-2400')
p14=enc(out,'hero-bench-cut-1400',1400)
subprocess.run(['magick',p14,'-strip','PNG8:'+os.path.join(HOME,'hero-bench-cut-1400.png')],check=True)
