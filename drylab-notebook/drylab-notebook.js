/* =============================================================================
   ReLeaf: Dry Lab Notebook
   -----------------------------------------------------------------------------
   Felix Yu's board. Every pipeline is a lane, every week a row, newest at the
   top. A mark on a lane is that pipeline's page for that week. Lines between
   lanes are where one pipeline grew out of another, or fed it. The rail on
   the right is the Wet Lab: what the dry lab sent across, and beside it how
   it came back; where the notebook dates the answer, a line runs back to the
   pipeline it landed on.

   The data is window.NB (notebook-data.js, built by build/drylab_notebook.py
   from the written record at the foot of this page). The written record is
   plain markup and reads without any of this.
   ========================================================================== */
(function () {
"use strict";
const NB = window.NB;
const FX = document.getElementById('main');
if (!NB || !FX) return;

/* ==================================================================
   1. GROUPS + PIPELINES
   ================================================================== */
const ICONS = {
  plant:'<path d="M8 14V7M8 7C8 4.5 6 2.5 3 2.5c0 3 1.8 4.5 5 4.5ZM8 8.6c0-2.2 1.8-4 4.5-4 0 2.7-1.6 4-4.5 4Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>',
  model:'<path d="M2 12.5C4 12.5 4.5 4 7.4 4c2.9 0 2.6 6.5 5 6.5 1.6 0 1.9-3 1.9-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 2v12h12" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".45" stroke-linecap="round"/>',
  hw:'<path d="M8 2.2 13.2 5v6L8 13.8 2.8 11V5Z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" stroke-width="1.5"/>',
  bio:'<path d="M4.2 2c0 4 7.6 4 7.6 8s-7.6 4-7.6 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" transform="scale(1 .78) translate(0 1.6)"/><path d="M11.8 2c0 4-7.6 4-7.6 8s7.6 4 7.6 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" transform="scale(1 .78) translate(0 1.6)"/><path d="M5.2 5.4h5.6M4.6 10.6h6.8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>',
  comm:'<path d="M2.5 6.5h3l4-3v9l-4-3h-3z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M11.8 5.2a4 4 0 0 1 0 5.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
  wet:'<path d="M6.2 2v4.1L2.7 12.2A1.1 1.1 0 0 0 3.7 14h8.6a1.1 1.1 0 0 0 1-1.8L9.8 6.1V2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.2 2h5.6M4.6 9.6h6.8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>'
};
const GROUPS = [
  {id:'comm',  name:'Communication',     icon:'comm'},
  {id:'plant', name:'Plant Systems',     icon:'plant'},
  {id:'model', name:'Modelling & Sim',   icon:'model'},
  {id:'hw',    name:'Hardware',          icon:'hw'},
  {id:'bio',   name:'Computational Bio', icon:'bio'}
];
const PIPES = NB.pipes;
const WEEKS = NB.weeks.map(w => w.date);
const ENTRIES = NB.entries;
const HANDOFFS = NB.handoffs;
const LINKS = NB.links;
const PHOTOS = NB.photos;

const KINDS = {
  start:    {label:'Seed · a pipeline opens',   shape:'ring'},
  work:     {label:'Leaf · a working week',     shape:'dot'},
  milestone:{label:'Bloom · a milestone',       shape:'diamond'},
  branch:   {label:'Tendril · the line forks',  shape:'tri'},
  handoff:  {label:'Drop · handed onward',      shape:'chev'},
  end:      {label:'Pod · the pipeline closes', shape:'square'}
};
const NB_KINDS = {
  start:    {label:'Circled · a pipeline opens',   shape:'ring'},
  work:     {label:'Ticked · a working week',      shape:'dot'},
  milestone:{label:'Starred · a milestone',        shape:'diamond'},
  branch:   {label:'Forked · the line splits',     shape:'tri'},
  handoff:  {label:'Arrowed out · handed onward',  shape:'chev'},
  end:      {label:'Boxed · the pipeline closes',  shape:'square'}
};

/* ==================================================================
   2. PHOTOGRAPHS, indexed three ways
   ================================================================== */
const PIX_BY_WEEK = {}, PIX_BY_PW = {}, PIX_BY_HF = {}, PIX_BY_SRC = {};
PHOTOS.forEach((ph,i)=>{
  ph.i=i;
  (PIX_BY_WEEK[ph.w] ||= []).push(ph);
  if(ph.p) (PIX_BY_PW[ph.p+'|'+ph.w] ||= []).push(ph);
  if(ph.hf!==null && ph.hf!==undefined) (PIX_BY_HF[ph.hf] ||= []).push(ph);
  PIX_BY_SRC[ph.l]=ph;
});
const MASCOT='art/mascot.webp';
const STARSVG='<svg class="star" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z"/></svg>';
/* Prints set down by hand are never quite square to the table. */
const tilt = i => ((i*2654435761%1000)/1000-.5)*3.4;
function weekPick(w){
  const l=PIX_BY_WEEK[w]; if(!l||!l.length) return null;
  return l.find(p=>p.s&&p.k==='photo') || l.find(p=>p.k==='photo') || l[0];
}
const esc = s => String(s).replace(/&(?!(?:[a-z]+|#\d+);)/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
const attr = s => String(s).replace(/<[^>]+>/g,'').replace(/"/g,'&quot;');
const plain = s => String(s).replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');

/* ==================================================================
   3. RENDER
   ================================================================== */
/* Each pipeline hue becomes a variable, shifted toward the ink for text. The
   Notebook skin swaps in its own pens for --p0-*, so the lanes follow. */
(function(){
  const decl = PIPES.map(p=>
    `--p0-${p.id}:${p.c}`+
    `;--p-${p.id}:color-mix(in srgb, var(--p0-${p.id}) calc(100% - var(--lift)), #fff calc(var(--lift)))`+
    `;--pt-${p.id}:color-mix(in srgb, var(--p0-${p.id}) calc(100% - var(--tlift)), var(--towards) calc(var(--tlift)))`
  ).join(';');
  const s=document.createElement('style');
  s.textContent=`.fx{${decl}}`;
  document.head.appendChild(s);
})();
PIPES.forEach(p=>{p.cv=`var(--p-${p.id})`; p.ct=`var(--pt-${p.id})`});

const P_BY_ID = Object.fromEntries(PIPES.map((p,i)=>[p.id,{...p,lane:i}]));
const G_BY_ID = Object.fromEntries(GROUPS.map(g=>[g.id,g]));
const E_BY_KEY = Object.fromEntries(ENTRIES.map((e,i)=>[e.p+'|'+e.w,i]));
const NW = WEEKS.length, NL = PIPES.length;

const cssnum = n => parseFloat(getComputedStyle(FX).getPropertyValue(n));
let RAIL, LANE, ROW, GAP, WETW, HEAD;

const SBW=(()=>{
  const d=document.createElement('div');
  d.style.cssText='position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll';
  document.body.appendChild(d);
  const w=d.offsetWidth-d.clientWidth;
  d.remove();
  return w;
})();

/* Thirteen lanes plus a wet lab rail will not fit a fixed lane width on every
   screen, so the lane width is solved for the space available. Below ~78px the
   lane labels turn vertical and shorten. */
function fitMetrics(){
  const frame=document.getElementById('boardframe');
  const avail=(frame.clientWidth||document.documentElement.clientWidth)-SBW-2;
  const TAIL=16;
  let railW=96, gapW=34, wetW=156, rowH=68, headH=86, nodeSz=44, wetT=44, compact=false;
  let lane=Math.floor((avail-railW-gapW-wetW-TAIL)/NL);
  if(lane<78){
    compact=true;
    railW=74; gapW=20; wetW=76; rowH=58; headH=104; nodeSz=34; wetT=34;
    lane=Math.floor((avail-railW-gapW-wetW-TAIL)/NL);
  }
  lane=Math.max(40,Math.min(lane,110));
  const s=FX.style;
  s.setProperty('--rail',railW+'px');
  s.setProperty('--lane',lane+'px');
  s.setProperty('--gap',gapW+'px');
  s.setProperty('--wetw',wetW+'px');
  s.setProperty('--row',rowH+'px');
  s.setProperty('--headh',headH+'px');
  s.setProperty('--nodesz',nodeSz+'px');
  s.setProperty('--wetthumb',wetT+'px');
  frame.classList.toggle('compact',compact);
  COMPACT=compact;
}
let COMPACT=false;
function readMetrics(){
  RAIL=cssnum('--rail'); LANE=cssnum('--lane'); ROW=cssnum('--row');
  GAP=cssnum('--gap'); WETW=cssnum('--wetw'); HEAD=cssnum('--headh');
}
const laneX = i => RAIL + i*LANE + LANE/2;
const wetL  = () => RAIL + NL*LANE + GAP;
/* The thumbnail sits to the left of the wet lab column, so the words saying
   how each send came back have room beside it. */
const wetX  = () => COMPACT ? wetL()+WETW/2 : wetL()+30;
const rowY  = w => ((NW-1)-w)*ROW + ROW/2;
const totalW = () => RAIL + NL*LANE + GAP + WETW + 16;
const totalH = () => NW*ROW;

const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTHS_LONG=['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmt(iso){const d=new Date(iso+'T00:00:00');return `${d.getDate()} ${MONTHS[d.getMonth()]}`}
function fmtLong(iso){const d=new Date(iso+'T00:00:00');return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`}
function monthOf(iso){return MONTHS[new Date(iso+'T00:00:00').getMonth()]}
const wk2 = w => 'W'+String(w+1).padStart(2,'0');
function gicon(id,cls){return `<svg class="${cls||'gi'}" viewBox="0 0 16 16" aria-hidden="true">${ICONS[id]}</svg>`}

/* The board speaks one language: a seed opens a pipeline, a leaf is an
   ordinary working week, a bloom is a milestone, a pod closes a line. */
const SHAPES={
  ring:   '<path class="glyphfill" d="M0 -6.4 C4.6 -3.6 5.4 2 0 6.4 C-5.4 2 -4.6 -3.6 0 -6.4 Z"/>'
         +'<path class="glyphface" d="M0 -3.2 C1.6 -1.4 1.8 1.2 0 3.2" fill="none" stroke-width="1.1" stroke="currentColor" opacity=".55"/>',
  dot:    '<path class="glyphfill" d="M0 -6 C5.6 -3 6.2 3.4 0 6.6 C-6.2 3.4 -5.6 -3 0 -6 Z" transform="rotate(-18)"/>'
         +'<path d="M0 5.6 L0 -5.2" stroke="var(--node-face)" stroke-width="1" opacity=".6" transform="rotate(-18)"/>',
  diamond:'<circle class="mstone-halo" cx="0" cy="0" r="12.5" fill="var(--c)" opacity=".14"/>'
         +'<circle class="mstone-ring" cx="0" cy="0" r="9.6" fill="none" stroke="var(--c)" stroke-width="1.1" opacity=".5"/>'
         +'<g><ellipse class="glyphfill" cx="0" cy="-5.6" rx="3.1" ry="4.6"/>'
         +'<ellipse class="glyphfill" cx="5.3" cy="-1.7" rx="3.1" ry="4.6" transform="rotate(72 5.3 -1.7)"/>'
         +'<ellipse class="glyphfill" cx="3.3" cy="4.5" rx="3.1" ry="4.6" transform="rotate(144 3.3 4.5)"/>'
         +'<ellipse class="glyphfill" cx="-3.3" cy="4.5" rx="3.1" ry="4.6" transform="rotate(216 -3.3 4.5)"/>'
         +'<ellipse class="glyphfill" cx="-5.3" cy="-1.7" rx="3.1" ry="4.6" transform="rotate(288 -5.3 -1.7)"/>'
         +'<circle cx="0" cy="0" r="2.9" fill="var(--node-face)"/><circle cx="0" cy="0" r="1.5" fill="var(--c)"/></g>',
  tri:    '<path d="M0 6.5 L0 0.5" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round"/>'
         +'<path d="M0 0.5 C-1 -3 -3.6 -4.4 -6 -5.4" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round"/>'
         +'<path d="M0 0.5 C1 -3 3.6 -4.4 6 -5.4" stroke="var(--c)" stroke-width="2" fill="none" stroke-linecap="round"/>'
         +'<circle class="glyphfill" cx="-6.4" cy="-5.8" r="1.9"/><circle class="glyphfill" cx="6.4" cy="-5.8" r="1.9"/>',
  chev:   '<path class="glyphfill" d="M0 -6.8 C3.9 -1.8 6 1 6 3.2 A6 6 0 0 1 -6 3.2 C-6 1 -3.9 -1.8 0 -6.8 Z"/>'
         +'<circle cx="-1.9" cy="2.4" r="1.5" fill="var(--node-face)" opacity=".75"/>',
  square: '<path class="glyphfill" d="M0 -6.6 C4 -4.4 4 4.4 0 6.6 C-4 4.4 -4 -4.4 0 -6.6 Z"/>'
         +'<circle cx="0" cy="-2.6" r="1.15" fill="var(--node-face)"/><circle cx="0" cy="0.4" r="1.15" fill="var(--node-face)"/><circle cx="0" cy="3.4" r="1.15" fill="var(--node-face)"/>'
};
/* The Notebook skin does not grow anything. It uses the marks you actually
   make in a notebook: you circle a thing when it starts, tick it off each week
   it moves, star it when it lands, fork the line when it splits, arrow it out
   when it leaves, and box it and cross it through when it is finished. */
const NB_SHAPES={
  ring:   '<path class="glyphstroke" d="M1.8 -6.4C-2.8 -7.6 -6.9 -4.2 -6.7 0.4 -6.5 4.7 -2.6 7.3 1.3 6.5 5.3 5.7 7.4 1.9 6.4 -1.8 5.7 -4.5 3.6 -6.1 0.6 -6.6" stroke-linecap="round"/>'
         +'<circle class="glyphfill" cx="0" cy="0" r="2"/>',
  dot:    '<path class="glyphstroke" d="M-5.4 -0.4C-4 1 -2.6 2.7 -1.5 4.6 0.5 0.3 2.9 -3.1 5.7 -5.5" stroke-linecap="round" stroke-linejoin="round"/>',
  diamond:'<circle class="mstone-halo" cx="0" cy="0" r="12.5" fill="var(--c)" opacity=".13"/>'
         +'<circle class="mstone-ring" cx="0" cy="0" r="10" fill="none" stroke="var(--c)" stroke-width="1.1" opacity=".5"/>'
         +'<path class="glyphfill" d="M0 -7.6 2.2 -2.5 7.6 -2.1 3.5 1.6 4.8 6.9 0 4 -4.8 6.9 -3.5 1.6 -7.6 -2.1 -2.2 -2.5Z"/>',
  tri:    '<path class="glyphstroke" d="M0 6.6 0 0.6" stroke-linecap="round"/>'
         +'<path class="glyphstroke" d="M0 0.6C-1.2 -2.4 -3.4 -4 -5.6 -5" stroke-linecap="round"/>'
         +'<path class="glyphstroke" d="M0 0.6C1.2 -2.4 3.4 -4 5.6 -5" stroke-linecap="round"/>'
         +'<path class="glyphfill" d="M-6.6 -5.6 -2.9 -6.1 -4.4 -2.7Z"/><path class="glyphfill" d="M6.6 -5.6 2.9 -6.1 4.4 -2.7Z"/>',
  chev:   '<path class="glyphstroke" d="M-6.6 0C-3.4 -0.6 0.6 -0.4 4.6 0.2" stroke-linecap="round"/>'
         +'<path class="glyphstroke" d="M1.2 -4L5.8 0.2 1.4 4.4" stroke-linecap="round" stroke-linejoin="round"/>',
  square: '<path class="glyphstroke" d="M-5.6 -5.4 5.5 -6 6.1 5.3 -5.1 5.9Z" stroke-linejoin="round"/>'
         +'<path class="glyphstroke" style="stroke-width:1.4" d="M-3.9 -3.5 4.2 3.7M4 -3.7 -3.7 3.9" stroke-linecap="round"/>'
};
function isNotebook(){return FX.getAttribute('data-skin')==='notebook'}
function curShapes(){return isNotebook()?NB_SHAPES:SHAPES}
function curKinds(){return isNotebook()?NB_KINDS:KINDS}

const grid = document.getElementById('grid');

function build(){
  fitMetrics();
  readMetrics();
  SPINE=spineStyle();
  const W=totalW(), H=totalH();
  let h='';

  /* lane headers: each links to the page its work was written up on */
  h+=`<div class="heads" style="width:${W}px;height:${HEAD}px">`;
  h+=`<div class="corner">Week</div>`;
  PIPES.forEach((p,i)=>{
    const tag=p.href?'a':'div';
    h+=`<${tag} class="head" data-lane="${p.id}" ${p.href?`href="${p.href}"`:''} style="left:${RAIL+i*LANE}px;--c:${p.cv}" title="${attr(p.short)}${p.href?': read the page':''}">
      ${gicon(G_BY_ID[p.g].icon)}
      <span class="nm">${esc(p.name).replace(/\n/g,'<br>')}</span>
      <span class="nmv">${esc(p.abbr)}</span>
      <span class="bar"></span></${tag}>`;
  });
  h+=`<div class="head wethead" style="left:${wetL()}px;width:${WETW}px" title="Wet Lab">
    ${gicon('wet')}<span class="nm">Wet Lab</span><span class="nmv">Wet Lab</span>${COMPACT?'':'<span class="sub">sent, and what came back</span>'}<span class="bar"></span></div>`;
  h+=`</div>`;

  h+=`<div style="position:relative;width:${W}px;height:${H}px">`;
  h+=`<div class="beams" style="top:0;width:${W}px">`;
  PIPES.forEach((p,i)=>{h+=`<div class="beam" data-beam="${p.id}" style="left:${RAIL+i*LANE}px;--c:${p.cv}"><i></i></div>`});
  h+=`</div>`;
  h+=`<div class="wetband" style="left:${wetL()-GAP/2}px;width:${WETW+GAP/2}px;height:${H}px"></div>`;

  h+=`<div class="rowlines" style="top:0;width:${W-RAIL}px">`;
  WEEKS.forEach((wk,w)=>{
    const y=((NW-1)-w)*ROW;
    const isM = w===NW-1 || monthOf(WEEKS[w])!==monthOf(WEEKS[w+1]);
    h+=`<div class="rowline ${isM?'mstart':''}" style="top:${y}px"></div>`;
  });
  h+=`</div>`;
  h+=`<div class="wetwall" style="top:0;left:${wetL()-GAP/2}px;height:${H}px"></div>`;
  h+=`<svg class="links" style="top:0" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true">${links()}</svg>`;

  /* date rail: every week opens that week's page of the notebook */
  h+=`<div class="rail" style="height:${H}px">`;
  WEEKS.forEach((wk,w)=>{
    const y=((NW-1)-w)*ROW;
    const isM = w===NW-1 || monthOf(WEEKS[w])!==monthOf(WEEKS[w+1]);
    h+=`<button type="button" class="railrow ${w===NW-1?'now':''}" data-wk="${w}" style="top:${y}px"
      aria-label="Week ${w+1}, ${fmtLong(wk)}: read the whole week">
      <span class="wk">${wk2(w)}</span><span class="dt">${fmt(wk)}</span>
      ${isM?`<span class="mo">${monthOf(wk)}</span>`:''}</button>`;
  });
  h+=`</div>`;

  h+=`<div class="nodes" style="top:0;width:${W}px;height:${H}px">${nodes()}</div>`;
  h+=`</div>`;

  grid.innerHTML=h;
  grid.style.width=W+'px';
  wireNodes();
}

/* A stable pseudo-random number from a string and an index, so the hand-drawn
   wobble and the photo tilts stay put between renders. */
function jitter(key,n){
  let h=2166136261;
  const s=key+'#'+n;
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
  return ((h>>>0)%100000)/100000;
}
function spineStyle(){return (getComputedStyle(FX).getPropertyValue('--spine')||'ink').trim()}
let SPINE='ink';
const VINE={};
function vineParams(key,y1,y2){
  return {y1,y2,span:Math.abs(y2-y1),amp:4.4+jitter(key,'a')*2.2,period:118+jitter(key,'p')*46,phase:jitter(key,'q')*6.283};
}
function vineOffsetAt(p,y){
  if(!p||!p.span) return 0;
  const t=(y-p.y2)/(p.y1-p.y2);
  return Math.sin(p.phase+(p.span*t)/p.period*6.283)*p.amp;
}
function vinePath(x,p){
  const steps=Math.max(4,Math.round(p.span/14));
  let d='';
  for(let i=0;i<=steps;i++){
    const t=i/steps, y=p.y2+(p.y1-p.y2)*t;
    d+=(i?' L ':'M ')+(x+vineOffsetAt(p,y)).toFixed(2)+' '+y.toFixed(2);
  }
  return d;
}
/* Leaves hang off the vine between the nodes, never on top of one. */
function vineFoliage(x,p,col,busyRows){
  if(p.span<70) return '';
  const n=Math.max(1,Math.min(9,Math.round(p.span/78)));
  let out='';
  for(let i=1;i<=n;i++){
    const t=i/(n+1), y=p.y2+(p.y1-p.y2)*t;
    if(busyRows.some(by=>Math.abs(by-y)<26)) continue;
    const off=vineOffsetAt(p,y), dir=(i%2)?1:-1;
    out+=`<path d="M0 0 C5.8 -1.1 8.2 3.4 2 7.8 C-1.1 4.2 -2 1.1 0 0 Z"
      transform="translate(${(x+off).toFixed(1)} ${y.toFixed(1)}) rotate(${dir>0?-42:42}) scale(${dir},1)" style="fill:${col}" opacity=".40"/>`;
  }
  return out;
}
/* Drawn with a ruler a pipeline reads as a Gantt bar; with a slight waver it
   reads as a line someone inked down the page. */
function inkSteps(y1,y2){return Math.max(2,Math.round(Math.abs(y2-y1)/40))}
function inkWobble(key,i,steps){
  const t=i/steps;
  return (jitter(key,i)-.5)*2.1 + Math.sin(t*Math.PI*1.7+jitter(key,'p')*6.3)*.9;
}
function inkPath(x,y1,y2,key){
  const steps=inkSteps(y1,y2);
  let d='';
  for(let i=0;i<=steps;i++){
    const y=y1+(y2-y1)*(i/steps);
    d+=(i?' L ':'M ')+(x+inkWobble(key,i,steps)).toFixed(2)+' '+y.toFixed(2);
  }
  return d;
}
function inkOffsetAt(key,y1,y2,y){
  const steps=inkSteps(y1,y2);
  if(y1===y2) return inkWobble(key,0,steps);
  const t=Math.max(0,Math.min(1,(y-y1)/(y2-y1)));
  const f=t*steps, i=Math.min(steps-1,Math.floor(f));
  return inkWobble(key,i,steps)*(1-(f-i)) + inkWobble(key,i+1,steps)*(f-i);
}
function spineOffsetAt(pid,y){
  const p=VINE[pid]; if(!p) return 0;
  if(SPINE==='vine'||SPINE==='stem') return vineOffsetAt(p,y);
  return inkOffsetAt(pid,p.y1,p.y2,y);
}
const nodeX = (pid,w) => laneX(P_BY_ID[pid].lane)+spineOffsetAt(pid,rowY(w));

function links(){
  let s='';
  const nb=isNotebook();
  /* lane spines */
  PIPES.forEach((p,i)=>{
    const ws=ENTRIES.filter(e=>e.p===p.id).map(e=>e.w);
    if(!ws.length) return;
    const y1=rowY(Math.min(...ws)), y2=rowY(Math.max(...ws)), x=laneX(i);
    VINE[p.id]=vineParams(p.id,y1,y2);
    if(SPINE==='vine'||SPINE==='stem'){
      const busy=ENTRIES.filter(e=>e.p===p.id).map(e=>rowY(e.w));
      s+=`<path d="${vinePath(x,VINE[p.id])}" fill="none" style="stroke:${p.cv}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" opacity=".5" data-spine="${p.id}"/>`;
      s+=vineFoliage(x,VINE[p.id],p.cv,busy);
    }else{
      s+=`<path d="${inkPath(x,y1,y2,p.id)}" fill="none" style="stroke:${p.cv}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity=".34" data-spine="${p.id}"/>`;
    }
  });
  /* the wet lab rail, from the first send to the last */
  const wx=wetX(), hy=HANDOFFS.map(x=>rowY(x.w));
  s+=`<line x1="${wx}" y1="${Math.min(...hy)-14}" x2="${wx}" y2="${Math.max(...hy)+14}" style="stroke:var(--wet)" stroke-width="1.6" stroke-linecap="round" opacity=".45"/>`;

  /* branches: a new pipeline growing out of an old one */
  LINKS.forEach((b,j)=>{
    const p1=P_BY_ID[b.frm], p2=P_BY_ID[b.to];
    const y1=rowY(b.fw), y2=rowY(b.tw);
    const x1=nodeX(b.frm,b.fw), x2=nodeX(b.to,b.tw);
    if(b.kind==='branch'){
      const midY=y1+(y2-y1)*0.5;
      const d = y1===y2
        ? `M ${x1} ${y1} C ${x1+(x2-x1)*.4} ${y1-26}, ${x2-(x2-x1)*.4} ${y2-26}, ${x2} ${y2}`
        : `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
      s+=`<path d="${d}" fill="none" style="stroke:${p2.cv}" stroke-width="2.2" opacity=".62" stroke-linecap="round" data-link="${j}"/>`;
      s+=`<circle cx="${x2}" cy="${y2}" r="2" style="fill:${p2.cv}" opacity=".8"/>`;
    }else{
      /* a feed: what one pipeline handed another, bowed under the row, with
         an arrowhead landing on the pipeline that took it */
      const dir=Math.sign(x2-x1)||1, sx=x1+dir*13, ex=x2-dir*15;
      const d=`M ${sx} ${y1} C ${sx+(ex-sx)*.3} ${y1+22}, ${ex-(ex-sx)*.3} ${y2+22}, ${ex} ${y2+3}`;
      s+=`<path d="${d}" fill="none" style="stroke:${p1.cv}" stroke-width="1.8" opacity=".6" stroke-linecap="round" data-link="${j}"/>`;
      s+=`<path d="M ${ex-dir*6} ${y2-1} L ${ex+dir*1} ${y2+3.5} L ${ex-dir*5.5} ${y2+8}" fill="none" style="stroke:${p1.cv}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" opacity=".75"/>`;
    }
  });

  /* handoffs: dashed out to the wet lab */
  HANDOFFS.forEach((hf,j)=>{
    const p=P_BY_ID[hf.p];
    const y=rowY(hf.w), x1=nodeX(hf.p,hf.w);
    const d=`M ${x1+14} ${y} C ${x1+(wx-x1)*.45} ${y}, ${wx-(wx-x1)*.28} ${y}, ${wx-(COMPACT?19:25)} ${y}`;
    s+=`<path d="${d}" fill="none" style="stroke:${p.cv}" stroke-width="2" opacity=".55" stroke-dasharray="6 5" stroke-linecap="round" data-hand="${j}"/>`;
    const tip=wx-(COMPACT?17:23);
    s+=`<path d="M ${tip-7} ${y-4.5} L ${tip} ${y} L ${tip-7} ${y+4.5} Z" style="fill:${p.cv}" opacity=".75"/>`;
    /* and back: where the notebook dates the answer, the line returns to the
       pipeline it landed on, in the wet lab's colour */
    const r=hf.ret;
    if(r && r.to){
      const ty=rowY(r.w), tx=nodeX(r.to,r.w);
      const sx=wx-(COMPACT?17:23), sy=y-8;
      const ex=tx+15, ey=ty;
      const rd=`M ${sx} ${sy} C ${sx-(sx-ex)*.25} ${sy-(sy-ey)*.9}, ${ex+(sx-ex)*.35} ${ey}, ${ex} ${ey}`;
      s+=`<path d="${rd}" fill="none" style="stroke:var(--wet)" stroke-width="2" opacity=".7" stroke-dasharray="2 5" stroke-linecap="round" data-ret="${j}"/>`;
      s+=`<path d="M ${ex+7} ${ey-4.5} L ${ex} ${ey} L ${ex+7} ${ey+4.5}" fill="none" style="stroke:var(--wet)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>`;
    }
  });
  return s;
}

function nodes(){
  const SHP=curShapes(), KND=curKinds();
  let s='';
  ENTRIES.forEach((e,i)=>{
    const p=P_BY_ID[e.p];
    const y=rowY(e.w), x=nodeX(e.p,e.w);
    const sh=SHP[KND[e.k].shape];
    const pix=(PIX_BY_PW[e.p+'|'+e.w]||[]).length;
    s+=`<button type="button" class="node h${e.h}${pix?' haspix':''} kind-${e.k}${e.ai?' is-ai':''}" data-i="${i}" data-pipe="${e.p}" data-group="${p.g}" data-lane="${p.lane}" data-week="${e.w}"
      style="left:${x}px;top:${y}px;--c:${p.cv}"
      aria-label="${attr(p.short)}, week of ${fmtLong(WEEKS[e.w])}: ${attr(e.t)}${pix?`. ${pix} photograph${pix>1?'s':''}`:''}">
      <svg width="34" height="34" viewBox="-17 -17 34 34" aria-hidden="true"><circle class="halo" cx="0" cy="0" r="13"/><circle class="pulse" cx="0" cy="0" r="9.6"/><g>${sh}</g>
      <g class="cam"><rect x="6.5" y="6.5" width="8.4" height="6.4" rx="1.6" class="glyphfill"/><circle cx="10.7" cy="9.7" r="1.5" class="glyphface"/></g></svg></button>`;
  });
  /* On the rail, a send is shown by what the wet lab did with it: the first
     photograph from that handoff, ringed in the sending pipeline's colour. */
  HANDOFFS.forEach((hf,j)=>{
    const x=wetX(), y=rowY(hf.w), p=P_BY_ID[hf.p];
    const pix=(PIX_BY_HF[j]||[]);
    const face = pix.length
      ? `<span class="wetthumb" style="--ring:${p.cv}"><img src="${pix[0].t}" alt="" loading="lazy"></span>`
      : `<span class="wetthumb" style="--ring:${p.cv}"><svg width="100%" height="100%" viewBox="-17 -17 34 34" style="color:var(--wet)"><g style="--c:var(--wet)">${SHP.ring}</g></svg></span>`;
    s+=`<button type="button" class="node wetnode" data-hf="${j}" data-group="wet" data-week="${hf.w}"
      style="left:${x}px;top:${y}px;--wtilt:${tilt(j+11).toFixed(2)}deg"
      aria-label="Sent to the wet lab, ${fmtLong(hf.date)}: ${attr(hf.t)}. ${attr(hf.ret.state)}.">
      ${face}${pix.length>1?`<span class="wetcnt">${pix.length}</span>`:''}</button>`;
    if(!COMPACT){
      const open=/open/i.test(hf.ret.state);
      s+=`<span class="wetstate ai${open?' open':''}" style="left:${x+30}px;top:${y}px">${esc(hf.ret.state)}</span>`;
    }
  });
  return s;
}

/* ==================================================================
   4. CARD
   ================================================================== */
const card=document.getElementById('card'), cardInner=document.getElementById('cardinner');
let pinned=null, hoverEl=null;
const SHOT_CAP=6;
function shotsHTML(list,scope){
  if(!list||!list.length) return '';
  const show=list.slice(0,SHOT_CAP), more=list.length-show.length;
  const n=Math.min(show.length,3);
  return `<div class="shots n${n}" data-all="${list.map(p=>p.i).join(',')}">${show.map(ph=>
    `<button type="button" class="shot-btn${ph.k==='figure'?' fig':''}" data-pix="${ph.i}" title="${attr(ph.c)}"
      aria-label="Photograph, ${attr(ph.d)}: ${attr(ph.c)}">
      <img src="${ph.t}" alt="${attr(ph.c)}" loading="lazy">${ph.s?STARSVG:''}</button>`).join('')}</div>
  <p class="shotcap">${list.length} photograph${list.length>1?'s':''} ${scope||'this week'}${more?`. Open any to see all ${list.length}`:'. Open to enlarge'}</p>`;
}
function delivHTML(list){
  if(!list||!list.length) return '';
  return list.map(d=>`<div class="dl"><b>${d.t}</b>${d.items.length?`<ul>${d.items.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}</div>`).join('');
}
/* The lines into and out of a node, in words. */
function joinsHTML(e){
  const rows=[];
  LINKS.forEach(b=>{
    if(b.to===e.p&&b.tw===e.w) rows.push(`<li${b.ai?' class="ai"':''}>${b.kind==='branch'?'Grew out of':'Took from'} <b>${esc(P_BY_ID[b.frm].short)}</b>: ${esc(b.t)}</li>`);
    if(b.frm===e.p&&b.fw===e.w) rows.push(`<li${b.ai?' class="ai"':''}>${b.kind==='branch'?'Branched into':'Fed'} <b>${esc(P_BY_ID[b.to].short)}</b>: ${esc(b.t)}</li>`);
  });
  HANDOFFS.forEach((hf,j)=>{
    if(hf.p===e.p&&hf.w===e.w) rows.push(`<li>Sent to the <b>Wet Lab</b>: ${esc(hf.t)}. <span class="ai">${esc(hf.ret.state)}.</span></li>`);
    if(hf.ret.to===e.p&&hf.ret.w===e.w) rows.push(`<li class="ai">Came back from the <b>Wet Lab</b>: ${esc(hf.ret.t)}</li>`);
  });
  return rows.length?`<div class="csec"><h4>Connections</h4><ul>${rows.join('')}</ul></div>`:'';
}
function cardHTML(e){
  const p=P_BY_ID[e.p], g=G_BY_ID[p.g], k=curKinds()[e.k];
  const lane = p.href ? `<a class="pipe" href="${p.href}">${gicon(g.icon)} ${esc(p.short)}</a>` : `<span class="pipe">${gicon(g.icon)} ${esc(p.short)}</span>`;
  const days=e.dates.map(fmt).join(' and ');
  return `
  <div class="top">${lane}<span class="when">${wk2(e.w)} · ${days}</span></div>
  <span class="kind">${k.label}</span>
  ${e.stage?`<span class="stage">${e.stage}</span>`:''}
  <h3${e.ai?' class="ai"':''}>${e.t}</h3>
  ${shotsHTML(PIX_BY_PW[e.p+'|'+e.w])}
  ${e.s?`<p class="sum${e.ai?' ai':''}">${e.s}</p>`:''}
  ${e.deliv.length?`<div class="csec"><h4>Deliverables</h4>${delivHTML(e.deliv)}</div>`:''}
  ${joinsHTML(e)}
  <div class="foot"><span>${esc(g.name)}</span><button type="button" class="close" data-close>Close</button></div>`;
}
function wetCardHTML(hf,j){
  const p=P_BY_ID[hf.p], r=hf.ret, open=/open/i.test(r.state);
  const did=hf.student_did.length?hf.student_did:hf.did;
  return `
  <div class="top"><span class="pipe" style="color:var(--wet)">${gicon('wet')} Sent to the Wet Lab</span><span class="when">${wk2(hf.w)} · ${fmt(hf.date)}</span></div>
  <span class="state ai${open?' open':''}">${esc(r.state)}</span>
  <h3>${esc(hf.t.charAt(0).toUpperCase()+hf.t.slice(1))}</h3>
  ${shotsHTML(PIX_BY_HF[j],'of what followed')}
  <p class="sum">${hf.d}</p>
  <div class="csec"><h4>What we sent</h4><p class="sum" style="margin-top:0">${hf.student_sent?hf.student_sent.charAt(0).toUpperCase()+hf.student_sent.slice(1)+'.':hf.sent}</p></div>
  <div class="csec"><h4>What the wet lab did with it</h4><ul>${did.map(b=>`<li>${b}</li>`).join('')}</ul></div>
  <div class="csec"><h4>What came back</h4><p class="sum" style="margin-top:0">${hf.back}</p>
    ${r.to?`<p class="jump ai">It landed on <button type="button" data-goto="${r.to}|${r.w}">${esc(P_BY_ID[r.to].short)}, ${fmt(WEEKS[r.w])}</button>: ${esc(r.t)}.</p>`:''}</div>
  <div class="foot"><span>From ${esc(p.short)}</span><button type="button" class="close" data-close>Close</button></div>`;
}
/* A week's page: the whole entry as the students wrote it. */
function weekCardHTML(w){
  const wk=NB.weeks[w];
  let h=`<div class="top"><span class="pipe" style="color:var(--ink-2)">The week</span><span class="when">${wk2(w)}</span></div>`;
  wk.days.forEach((d,i)=>{
    h+=`<h3${d.ai?' class="ai"':''}>${fmtLong(d.date)}</h3>`;
    if(d.note) h+=`<p class="sum ai">${d.note}</p>`;
    const lanes=[...new Set(d.deliv.map(x=>x.lane))];
    const onBoard=ENTRIES.filter(e=>e.w===w && e.dates.includes(d.date));
    if(onBoard.length) h+=`<div class="tags" style="margin-top:10px">${onBoard.map(e=>`<span class="tag" style="box-shadow:inset 3px 0 0 ${P_BY_ID[e.p].cv}">${esc(P_BY_ID[e.p].short)}${e.stage?`: ${e.stage}`:''}</span>`).join('')}</div>`;
    if(d.results.length) h+=`<div class="csec"><h4>Results</h4><ul${d.ai?' class="ai"':''}>${d.results.map(r=>`<li>${r}</li>`).join('')}</ul></div>`;
    if(d.who.length) h+=`<div class="csec"><h4>Participants</h4><p class="who">${d.who.join(', ')}</p></div>`;
    if(d.contrib.length) h+=`<div class="csec"><h4>Contributions</h4><dl class="contrib">${d.contrib.map(c=>`<div><dt>${c.who}</dt><dd>${c.html}</dd></div>`).join('')}</dl></div>`;
    if(d.links) h+=`<div class="csec"><h4>Links</h4><p class="links">${d.links}</p></div>`;
    void lanes;
  });
  h+=shotsHTML(PIX_BY_WEEK[w],'that week');
  h+=`<p class="jump"><button type="button" data-record="e-${wk.days[0].date}">Open this week in the written record</button></p>`;
  h+=`<div class="foot"><span>Week of ${fmtLong(WEEKS[w])}</span><button type="button" class="close" data-close>Close</button></div>`;
  return h;
}

function showCard(el,pin){
  let html, col, colT, pipe, key;
  if(el.dataset.hf!==undefined){
    const j=+el.dataset.hf; html=wetCardHTML(HANDOFFS[j],j); col=colT='var(--wet)'; pipe='wet'; key='h'+j;
  }else if(el.dataset.wk!==undefined){
    const w=+el.dataset.wk; html=weekCardHTML(w); col=colT='var(--ink-3)'; pipe='week'; key='w'+w;
  }else{
    const e=ENTRIES[+el.dataset.i]; html=cardHTML(e); col=P_BY_ID[e.p].cv; colT=P_BY_ID[e.p].ct; pipe=e.p; key='e'+el.dataset.i;
  }
  card.style.setProperty('--c',col);
  card.style.setProperty('--ct',colT);
  card.dataset.pipe=pipe;
  const fresh = card.dataset.forNode !== key;
  card.dataset.forNode = key;
  cardInner.innerHTML = html;
  if(fresh) cardInner.scrollTop=0;
  card.classList.add('on');
  card.classList.toggle('pin',!!pin);
  card.setAttribute('aria-hidden','false');
  position(el);
  if(fresh){ card.style.animation='none'; void card.offsetWidth; card.style.animation=''; }
  drawTether(el,col,fresh);
}
function position(el){
  if(matchMedia('(max-width:640px)').matches){
    card.style.top=''; card.style.left=''; card.dataset.tip='centre';
    return;
  }
  const r=el.getBoundingClientRect();
  const cw=card.offsetWidth, ch=card.offsetHeight;
  let x=r.right+14, side='left';
  if(x+cw>innerWidth-10){ x=r.left-cw-14; side='right'; }
  if(x<10){ x=Math.min(Math.max(10,r.left+r.width/2-cw/2),innerWidth-cw-10); side='centre'; }
  card.style.setProperty('--ox', side==='right' ? '92%' : side==='centre' ? '50%' : '8%');
  card.dataset.tip = side;
  let y=r.top+r.height/2-ch/2;
  const top=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||64)+8;
  y=Math.max(top,Math.min(y,innerHeight-ch-10));
  card.style.left=x+'px'; card.style.top=y+'px';
}
function hideCard(){
  if(pinned) return;
  card.classList.remove('on','pin');
  card.dataset.forNode='';
  card.setAttribute('aria-hidden','true');
  killTether();
}
function unpin(keepHash){
  if(pinned){pinned.classList.remove('pinned');pinned=null}
  card.classList.remove('on','pin');
  card.dataset.forNode='';
  card.setAttribute('aria-hidden','true');
  killTether();
  if(!keepHash) setHash('');
}
function pin(n){
  if(pinned&&pinned!==n)pinned.classList.remove('pinned');
  pinned=n;n.classList.add('pinned');showCard(n,true);
  setHash(nodeHash(n));
}

/* Every mark has an address: pinning writes it into the URL, and that URL
   reopens it. #reactor-w12, #wet-1, #w12 */
function nodeHash(n){
  if(n.dataset.hf!==undefined) return 'wet-'+(+n.dataset.hf+1);
  if(n.dataset.wk!==undefined) return wk2(+n.dataset.wk).toLowerCase();
  const e=ENTRIES[+n.dataset.i]; return e.p+'-'+wk2(e.w).toLowerCase();
}
function nodeFor(hash){
  let m;
  if((m=/^wet-(\d+)$/.exec(hash))) return grid.querySelector(`.node[data-hf="${+m[1]-1}"]`);
  if((m=/^w(\d\d)$/.exec(hash))) return grid.querySelector(`.railrow[data-wk="${+m[1]-1}"]`);
  if((m=/^([a-z]+)-w(\d\d)$/.exec(hash))){
    const i=E_BY_KEY[m[1]+'|'+(+m[2]-1)];
    return i===undefined?null:grid.querySelector(`.node[data-i="${i}"]`);
  }
  return null;
}
function setHash(h){
  try{ history.replaceState(null,'',h?'#'+h:location.pathname+location.search); }catch(e){}
}
function scrollBoardTo(el){
  const board=document.getElementById('board');
  const br=board.getBoundingClientRect(), r=el.getBoundingClientRect();
  board.scrollTop += (r.top-br.top) - board.clientHeight/2 + r.height/2;
  const fr=document.getElementById('boardframe').getBoundingClientRect();
  if(fr.top<0||fr.top>innerHeight*.5) document.getElementById('boardframe').scrollIntoView({block:'start'});
}
function goTo(n){
  if(!n) return;
  if(view!=='board') setView('board');
  scrollBoardTo(n);
  requestAnimationFrame(()=>requestAnimationFrame(()=>pin(n)));
}

function wireNodes(){
  grid.querySelectorAll('.node, .railrow').forEach(n=>{
    n.addEventListener('mouseenter',()=>{if(!pinned){hoverEl=n;showCard(n,false)}});
    n.addEventListener('mouseleave',()=>{if(!pinned)hideCard()});
    n.addEventListener('focus',()=>{if(!pinned){hoverEl=n;showCard(n,false)}});
    n.addEventListener('blur',()=>{if(!pinned)hideCard()});
    n.addEventListener('click',ev=>{
      ev.stopPropagation();
      if(pinned===n){unpin();return}
      pin(n);
    });
    if(!n.classList.contains('node')) return;
    n.addEventListener('keydown',ev=>{
      const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,1],ArrowDown:[0,-1]};
      if(!dirs[ev.key])return;
      ev.preventDefault();
      const [dx,dy]=dirs[ev.key];
      const all=[...grid.querySelectorAll('.node:not(.dim)')];
      const cl=n.dataset.lane!==undefined?+n.dataset.lane:NL+1, cw=+n.dataset.week;
      let best=null,bd=1e9;
      all.forEach(o=>{
        if(o===n)return;
        const ol=o.dataset.lane!==undefined?+o.dataset.lane:NL+1, ow=+o.dataset.week;
        const vl=ol-cl, vw=ow-cw;
        if(dx&&Math.sign(vl)!==dx)return;
        if(dy&&Math.sign(vw)!==dy)return;
        const d=Math.abs(vl)*(dx?1:6)+Math.abs(vw)*(dy?1:6);
        if(d<bd){bd=d;best=o}
      });
      if(best)best.focus();
    });
  });
  if(pinned){
    const again=nodeFor(nodeHash(pinned));
    pinned=null;
    if(again){pinned=again;again.classList.add('pinned');showCard(again,true)}
    else unpin();
  }
}
card.addEventListener('click',e=>{
  if(e.target.closest('[data-close]')) return unpin();
  const g=e.target.closest('[data-goto]');
  if(g){
    const [p,w]=g.dataset.goto.split('|');
    const n=grid.querySelector(`.node[data-i="${E_BY_KEY[p+'|'+w]}"]`);
    if(n){unpin(true);goTo(n)}
    return;
  }
  const r=e.target.closest('[data-record]');
  if(r){unpin();setView('record');revealRecord(r.dataset.record);}
});
document.addEventListener('click',e=>{if(pinned&&!card.contains(e.target)&&!e.target.closest('.node,.railrow'))unpin()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&pinned&&!lb.classList.contains('on'))unpin()});
function refollow(){
  const el=pinned||hoverEl;
  if(el&&card.classList.contains('on')){ position(el); drawTether(el,card.style.getPropertyValue('--c'),false); }
}
document.getElementById('board').addEventListener('scroll',refollow,{passive:true});
addEventListener('scroll',refollow,{passive:true});

/* The stem from node to card (Cultivar only), redrawn whenever the card
   moves and cleared whenever it closes, so it is never left dangling. */
let tetherEl=null;
function killTether(){ if(tetherEl){tetherEl.remove();tetherEl=null;} }
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const motifsOn=()=>getComputedStyle(FX).getPropertyValue('--motifs').trim()==='1';
function drawTether(el,colour,replay){
  if(reduceMotion()||!motifsOn()||!el||matchMedia('(max-width:640px)').matches) return killTether();
  const n=el.getBoundingClientRect(), c=card.getBoundingClientRect();
  if(!c.width) return;
  const bv=document.getElementById('board').getBoundingClientRect();
  const nx=n.left+n.width/2, ny=n.top+n.height/2;
  if(ny<bv.top-4||ny>bv.bottom+4||nx<bv.left-4||nx>bv.right+4) return killTether();
  const tip=card.dataset.tip||'left';
  let ax, ay=c.bottom-7;
  if(tip==='right') ax=c.right-7;
  else if(tip==='centre'){ ax=c.left+c.width/2; ay = ny<c.top ? c.top : c.bottom; }
  else ax=c.left+7;
  const dx=ax-nx, dy=ay-ny;
  const bow=Math.min(46,Math.max(18,Math.hypot(dx,dy)*0.30));
  const c1x=nx+dx*0.15, c1y=ny+dy*0.55-bow, c2x=nx+dx*0.72, c2y=ay-dy*0.10-bow*0.35;
  const d=`M ${nx.toFixed(1)} ${ny.toFixed(1)} C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${ax.toFixed(1)} ${ay.toFixed(1)}`;
  const len=Math.round(Math.hypot(dx,dy)*1.35)+40;
  const pt=t=>{const u=1-t;return [u*u*u*nx+3*u*u*t*c1x+3*u*t*t*c2x+t*t*t*ax,u*u*u*ny+3*u*u*t*c1y+3*u*t*t*c2y+t*t*t*ay]};
  let leaves='';
  [[0.38,1],[0.66,-1]].forEach(([t,dir],i)=>{
    const [lx,ly]=pt(t);
    leaves+=`<path class="tleaf" d="M0 0 C6.2 -1.2 8.6 3.6 2.1 8.2 C-1.2 4.4 -2.1 1.2 0 0 Z" transform="translate(${lx.toFixed(1)} ${ly.toFixed(1)}) rotate(${dir>0?-44:44}) scale(${dir},1)" style="animation-delay:${140+i*70}ms"/>`;
  });
  if(!tetherEl){ tetherEl=document.createElement('div'); tetherEl.className='tether'; FX.appendChild(tetherEl); }
  tetherEl.style.setProperty('--tc',colour);
  tetherEl.innerHTML=`<svg aria-hidden="true"><path class="stalk" d="${d}" style="--len:${len}"/>${leaves}<circle class="petiole" cx="${ax.toFixed(1)}" cy="${ay.toFixed(1)}" r="3.4" style="animation-delay:200ms"/></svg>`;
  if(!replay){
    tetherEl.querySelectorAll('.stalk,.tleaf,.petiole').forEach(x=>{x.style.animation='none'});
    tetherEl.querySelector('.stalk').style.strokeDashoffset='0';
    tetherEl.querySelectorAll('.tleaf').forEach(x=>x.style.opacity='.62');
    tetherEl.querySelector('.petiole').style.opacity='.9';
  }
}

/* ==================================================================
   5. FILTER + SEARCH
   ================================================================== */
const active=new Set(GROUPS.map(g=>g.id));
let query='';
function hay(e){
  return plain([e.t,e.s,e.stage,P_BY_ID[e.p].short,...e.deliv.map(d=>d.t+' '+d.items.join(' '))].join(' ')).toLowerCase();
}
function applyFilter(){
  const q=query.trim().toLowerCase();
  grid.querySelectorAll('.node').forEach(n=>{
    const g=n.dataset.group;
    let ok = g==='wet' ? true : active.has(g);
    if(ok&&q){
      if(n.dataset.hf!==undefined){
        const d=HANDOFFS[+n.dataset.hf];
        ok=plain([d.t,d.d,d.sent,d.back,...d.did,P_BY_ID[d.p].short].join(' ')).toLowerCase().includes(q);
      }else ok=hay(ENTRIES[+n.dataset.i]).includes(q);
    }
    n.classList.toggle('dim',!ok);
  });
  grid.querySelectorAll('[data-spine]').forEach(s=>{
    const p=P_BY_ID[s.dataset.spine];
    s.style.opacity = active.has(p.g) ? (q?'.12':'') : '.06';
  });
  grid.querySelectorAll('.beam').forEach(b=>{ b.style.opacity = active.has(P_BY_ID[b.dataset.beam].g)?'1':'.15'; });
  grid.querySelectorAll('.head[data-lane]').forEach(hd=>{ hd.style.opacity = active.has(P_BY_ID[hd.dataset.lane].g)?'1':'.3'; });
  buildGallery();
}
const chipsEl=document.getElementById('groupchips');
chipsEl.innerHTML=GROUPS.map(g=>{
  const c=PIPES.find(p=>p.g===g.id).ct;
  return `<button type="button" class="chip" data-g="${g.id}" aria-pressed="true" style="color:${c}">${gicon(g.icon)}<span style="color:var(--ink-2)">${g.name}</span></button>`;
}).join('');
chipsEl.addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  const id=b.dataset.g, on=b.getAttribute('aria-pressed')==='true';
  if(on&&active.size===1)return;
  on?active.delete(id):active.add(id);
  b.setAttribute('aria-pressed',String(!on));
  applyFilter();
});
document.getElementById('q').addEventListener('input',e=>{query=e.target.value;applyFilter()});

/* ==================================================================
   6. LEGEND + STATS
   ================================================================== */
function range(p){
  const ws=ENTRIES.filter(e=>e.p===p.id).map(e=>e.w);
  return `W${Math.min(...ws)+1} to ${Math.max(...ws)+1}`;
}
function legendPipes(filter){
  return PIPES.filter(filter).map(p=>`<li><span class="sw" style="background:${p.cv}"></span>${p.href?`<a href="${p.href}">${esc(p.short)}</a>`:esc(p.short)}<span class="desc">${range(p)}</span></li>`).join('');
}
function buildLegend(){
  const SHP=curShapes(), KND=curKinds();
  const glyph=v=>SHP[v.shape].replace(/class="glyphfill"/g,'fill="currentColor"').replace(/class="glyphface"/g,'fill="var(--panel)"').replace(/class="glyphstroke"/g,'fill="none" stroke="currentColor" stroke-width="2"');
  const feeds=LINKS.filter(l=>l.kind==='feed').length, branches=LINKS.filter(l=>l.kind==='branch').length;
  const returns=HANDOFFS.filter(h=>h.ret.to).length;
  const sw=(d,extra)=>`<svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ${extra||''}/></svg>`;
  document.getElementById('legend').innerHTML=`
  <div><h4>What happened</h4>
    <ul>${Object.values(KND).map(v=>`<li><svg width="18" height="18" viewBox="-9 -9 18 18" style="color:var(--ink-2)"><g style="--c:var(--ink-2)">${glyph(v)}</g></svg>${v.label}</li>`).join('')}</ul></div>
  <div><h4>How the parts connect</h4>
    <ul>
      <li style="color:var(--ink-2)">${sw('M2 11 C2 4, 28 8, 28 1')}<span>A pipeline grows out of another</span><span class="desc">${branches}</span></li>
      <li style="color:var(--ink-2)" class="ai">${sw('M2 3 C10 12, 20 12, 27 5')}<span>One pipeline feeds another</span><span class="desc">${feeds}</span></li>
      <li style="color:var(--wet)">${sw('M2 6 L28 6','stroke-dasharray="5 4"')}<span style="color:var(--ink-2)">Sent to the Wet Lab</span><span class="desc">${HANDOFFS.length}</span></li>
      <li style="color:var(--wet)" class="ai">${sw('M28 6 L2 6','stroke-dasharray="1.5 4"')}<span style="color:var(--ink-2)">Came back and changed a pipeline</span><span class="desc">${returns}</span></li>
    </ul></div>
  <div><h4>Communication and plants</h4><ul>${legendPipes(p=>p.g==='comm'||p.g==='plant')}</ul></div>
  <div><h4>Modelling and computational bio</h4><ul>${legendPipes(p=>p.g==='model'||p.g==='bio')}</ul></div>
  <div><h4>Hardware</h4><ul>${legendPipes(p=>p.g==='hw')}</ul></div>
  <div><h4>Reading the board</h4>
    <ul>
      <li>Newest week sits at the top<span class="desc">↑ later</span></li>
      <li>Bigger halo = a heavier week<span class="desc">1 to 3</span></li>
      <li>Small camera = photographs attached<span class="desc">${PHOTOS.length}</span></li>
      <li>Click a date to read the whole week<span class="desc">${NW}</span></li>
      <li class="ai">Orange dot = drafted, the team has not written it up yet<span class="desc">${ENTRIES.filter(e=>e.ai).length}</span></li>
    </ul></div>`;
}
document.getElementById('hintpix').textContent=`Marks with a camera have photographs. The photo log holds all ${PHOTOS.length}.`;
(function stats(){
  const closed=ENTRIES.filter(e=>e.k==='end').length;
  const miles=ENTRIES.filter(e=>e.k==='milestone').length;
  const people=new Set(); NB.weeks.forEach(w=>w.days.forEach(d=>{ if(!d.ai) d.who.forEach(n=>people.add(n)); }));
  const branches=LINKS.filter(l=>l.kind==='branch').length;
  document.getElementById('stats').innerHTML=[
    [NW,'weeks'],[NL,'pipelines'],[ENTRIES.length,'notebook pages'],[PHOTOS.length,'photographs'],
    [miles,'milestones'],[branches,'branch points'],[HANDOFFS.length,'wet lab handoffs'],[closed,'closed on purpose'],[people.size,'contributors']
  ].map(([n,l])=>`<div class="stat"><b>${n}</b><span>${l}</span></div>`).join('');
})();

/* ==================================================================
   7. PHOTO LOG
   ================================================================== */
const gallery=document.getElementById('gallery');
function buildGallery(){
  if(view!=='gallery')return;
  const q=query.trim().toLowerCase();
  let h='';
  for(let w=NW-1;w>=0;w--){
    const list=(PIX_BY_WEEK[w]||[]).filter(ph=>{
      if(ph.p && !active.has(P_BY_ID[ph.p].g)) return false;
      if(q) return (ph.c+' '+(ph.p?P_BY_ID[ph.p].short:'team')).toLowerCase().includes(q);
      return true;
    });
    if(!list.length)continue;
    h+=`<section class="galweek"><h2>Week ${w+1} · <b>${fmtLong(WEEKS[w])} 2026</b> · ${list.length} frame${list.length>1?'s':''}</h2><div class="galgrid" data-all="${list.map(p=>p.i).join(',')}">`;
    list.forEach(ph=>{
      const p=ph.p?P_BY_ID[ph.p]:null;
      const who = p ? p.short : (ph.hf!==null&&ph.hf!==undefined ? 'Wet Lab' : (ph.team==='Wetlab' ? 'Wet Lab' : 'Team'));
      const ct  = p ? p.ct : (who==='Wet Lab' ? 'var(--wet)' : 'var(--ink-3)');
      h+=`<figure class="galitem" style="--ct:${ct};--tilt:${tilt(ph.i+3).toFixed(2)}deg">
        <button type="button" class="shot-btn${ph.k==='figure'?' fig':''}" data-pix="${ph.i}" aria-label="Enlarge: ${attr(ph.c)}">
          <img src="${ph.t}" alt="${attr(ph.c)}" loading="lazy">${ph.s?STARSVG:''}</button>
        <figcaption class="meta"><span class="cap ai">${esc(ph.c)}</span>
          <span class="sub"><span class="pd">${esc(who)}</span><span>${esc(ph.d)}</span>${ph.s?'<span>team pick</span>':''}</span></figcaption></figure>`;
    });
    h+=`</div></section>`;
  }
  gallery.innerHTML=h||`<div class="nothing"><img src="${MASCOT}" alt=""><p>No photographs match that filter.</p></div>`;
}

/* Contact strip: one representative frame per week, oldest to newest. */
(function(){
  const row=document.getElementById('striprow');
  let h='';
  for(let w=0;w<NW;w++){
    const pick=weekPick(w), n=(PIX_BY_WEEK[w]||[]).length;
    if(!pick){
      h+=`<div class="frame empty" title="Week ${w+1}: nothing photographed"><span class="shot"><img class="mascot-sm" src="${MASCOT}" alt=""></span><span class="n">${wk2(w)}</span></div>`;
    }else{
      h+=`<button type="button" class="frame" data-week="${w}" title="${attr(pick.c)}" style="--tilt:${tilt(w+7).toFixed(2)}deg"
        aria-label="Week ${w+1}, ${fmtLong(WEEKS[w])}: ${n} photograph${n>1?'s':''}">
        <span class="shot"><img src="${pick.t}" alt="" loading="lazy">${n>1?`<span class="cnt">${n}</span>`:''}</span>
        <span class="n">${wk2(w)}</span></button>`;
    }
  }
  row.innerHTML=h;
  const withPix=Object.keys(PIX_BY_WEEK).length;
  document.getElementById('stripnote').textContent=`${PHOTOS.length} photographs, ${withPix} of ${NW} weeks. Pick one up to read that week.`;
  row.addEventListener('click',e=>{
    const f=e.target.closest('.frame[data-week]'); if(!f)return;
    goTo(grid.querySelector(`.railrow[data-wk="${f.dataset.week}"]`));
  });
})();

/* ==================================================================
   8. LIGHTBOX
   ================================================================== */
const lb=document.getElementById('lb');
let lbList=[], lbAt=0, lbFrom=null;
function openLB(list,at,from){
  lbList=list; lbAt=Math.max(0,at); lbFrom=from||null;
  lb.classList.add('on');
  document.body.style.overflow='hidden';
  paintLB();
  document.getElementById('lbclose').focus();
}
function paintLB(){
  const ph=lbList[lbAt]; if(!ph)return;
  const p=ph.p?P_BY_ID[ph.p]:null;
  const img=document.getElementById('lbimg');
  img.src=ph.l; img.alt=ph.c;
  document.getElementById('lbcap').textContent=ph.c;
  document.getElementById('lbdate').textContent=`${ph.d} · Week ${ph.w+1}${ph.s?' · team pick':''}`;
  const wet=ph.hf!==null&&ph.hf!==undefined;
  document.getElementById('lbpipe').textContent = p ? p.short : (wet||ph.team==='Wetlab' ? 'Wet Lab' : 'Team');
  lb.style.setProperty('--lbc', p ? p.cv : (wet ? 'var(--wet)' : 'var(--scrim-ink-2)'));
  document.getElementById('lbcount').textContent=`${lbAt+1} / ${lbList.length}`;
  const multi=lbList.length>1;
  document.getElementById('lbprev').style.display=multi?'':'none';
  document.getElementById('lbnext').style.display=multi?'':'none';
}
function stepLB(d){ if(!lbList.length)return; lbAt=(lbAt+d+lbList.length)%lbList.length; paintLB(); }
function closeLB(){
  lb.classList.remove('on'); document.body.style.overflow='';
  document.getElementById('lbimg').removeAttribute('src');
  if(lbFrom&&document.contains(lbFrom)) lbFrom.focus();
}
document.getElementById('lbclose').addEventListener('click',closeLB);
document.getElementById('lbprev').addEventListener('click',()=>stepLB(-1));
document.getElementById('lbnext').addEventListener('click',()=>stepLB(1));
lb.addEventListener('click',e=>{if(e.target===lb)closeLB()});
addEventListener('keydown',e=>{
  if(!lb.classList.contains('on'))return;
  if(e.key==='Escape'){e.stopPropagation();closeLB()}
  else if(e.key==='ArrowLeft')stepLB(-1);
  else if(e.key==='ArrowRight')stepLB(1);
  else if(e.key==='Tab'){
    const f=[...lb.querySelectorAll('button')].filter(b=>b.style.display!=='none');
    const i=f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i+(e.shiftKey?-1:1)+f.length)%f.length].focus();
  }
},true);
/* Any thumbnail anywhere opens the lightbox, scoped to its own group. The
   written record's photographs are links to the full image, so they still
   work without any of this. */
document.addEventListener('click',e=>{
  const b=e.target.closest('.fx .shot-btn');
  if(b){
    e.stopPropagation();
    const ph=PHOTOS[+b.dataset.pix];
    const box=b.closest('[data-all]');
    const scope=box?box.dataset.all.split(',').map(i=>PHOTOS[+i]):[ph];
    openLB(scope,scope.indexOf(ph),b);
    return;
  }
  const a=e.target.closest('.fx .ph');
  if(!a||e.metaKey||e.ctrlKey||e.shiftKey)return;
  e.preventDefault();
  const list=[...a.closest('.photos').querySelectorAll('.ph')].map(x=>PIX_BY_SRC[x.getAttribute('href')]||
    {l:x.getAttribute('href'),t:x.getAttribute('href'),c:x.dataset.cap||'',d:x.dataset.date||'',w:0,p:null});
  openLB(list,[...a.closest('.photos').querySelectorAll('.ph')].indexOf(a),a);
},true);

/* ==================================================================
   9. THE WRITTEN RECORD
   ================================================================== */
const record=document.getElementById('record');
function revealRecord(id){
  const t=id&&document.getElementById(id);
  if(!t) return;
  const fold=t.matches('details')?t:(t.querySelector('.nbmonth__fold')||t.closest('details.nbmonth__fold'));
  if(fold&&!fold.open) fold.open=true;
  requestAnimationFrame(()=>t.scrollIntoView({block:'start'}));
}
record.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="#"]');
  if(!a||a.getAttribute('href').length<2) return;
  const id=decodeURIComponent(a.getAttribute('href').slice(1));
  if(!document.getElementById(id)) return;
  e.preventDefault();
  setHash(id);
  revealRecord(id);
});
(function(){
  const allBtn=document.getElementById('nb-all');
  const folds=[...record.querySelectorAll('.nbmonth__fold')];
  const sync=()=>{
    const allOpen=folds.every(f=>f.open);
    allBtn.textContent=allOpen?'Close all':'Open all';
    allBtn.setAttribute('aria-pressed',String(allOpen));
  };
  if(allBtn){
    allBtn.addEventListener('click',()=>{ const open=!folds.every(f=>f.open); folds.forEach(f=>{f.open=open}); sync(); });
    folds.forEach(f=>f.addEventListener('toggle',sync));
    sync();
  }
  const idx=new Map([...record.querySelectorAll('.mindex__list a')].map(a=>[a.getAttribute('href').slice(1),a]));
  if('IntersectionObserver' in window){
    const seen=new Map();
    const io=new IntersectionObserver(es=>{
      es.forEach(en=>seen.set(en.target.id,en.isIntersecting));
      let cur=null;
      for(const s of record.querySelectorAll('.nbmonth')) if(seen.get(s.id)){cur=s.id;break}
      idx.forEach((a,id)=>a.classList.toggle('is-here',id===cur));
    },{rootMargin:'-140px 0px -45% 0px'});
    record.querySelectorAll('.nbmonth').forEach(s=>io.observe(s));
  }
  record.querySelectorAll('.ph-more').forEach(b=>{
    b.addEventListener('click',()=>{
      const row=b.closest('.photos');
      const open=row.classList.toggle('is-collapsed')===false;
      b.setAttribute('aria-expanded',String(open));
      b.textContent=open?'Show fewer':'+'+row.querySelectorAll('.is-extra').length+' more';
    });
  });
  /* Each written entry can be found on the board, and each week on the board
     can be found in the writing. */
  record.querySelectorAll('article.entry').forEach(a=>{
    const w=Math.floor((new Date(a.id.slice(2)+'T00:00:00')-new Date(WEEKS[0]+'T00:00:00'))/(7*864e5));
    if(w<0||w>=NW) return;
    const b=document.createElement('button');
    b.type='button'; b.className='onboard'; b.textContent='On the board';
    b.setAttribute('aria-label',`See the week of ${fmtLong(WEEKS[w])} on the board`);
    b.addEventListener('click',()=>goTo(grid.querySelector(`.railrow[data-wk="${w}"]`)));
    const mon=a.querySelector('.entry__mon');
    (mon?mon.parentNode:a).appendChild(b);
  });
})();

/* ==================================================================
   10. VIEWS: the board, the written record, the photo log
   ================================================================== */
let view='record';
const viewBtns=[...document.querySelectorAll('.views [data-view]')];
function setView(v){
  view=v;
  viewBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
  const board=v==='board';
  ['boardframe','hint','legend'].forEach(id=>document.getElementById(id).classList.toggle('off',!board));
  gallery.classList.toggle('off',v!=='gallery');
  record.classList.toggle('off',v!=='record');
  /* Groups and search act on the board and the photo log, not the record. */
  document.querySelectorAll('#groupchips, #q, .controls .ctl-label').forEach(x=>x.classList.toggle('off',v==='record'));
  unpin(true);
  if(board) build(), applyFilter();
  buildGallery();
}
viewBtns.forEach(b=>b.addEventListener('click',()=>{ setView(b.dataset.view); setHash(b.dataset.view==='board'?'':b.dataset.view==='record'?'record':'photos'); }));

/* ==================================================================
   11. SKINS: two of Felix's papers
   ================================================================== */
const SKINS=[
  {id:'notebook', name:'Notebook', note:'ruled paper, one pen per pipeline', s1:'#e9dfc8', s2:'#1b2636'},
  {id:'cultivar', name:'Cultivar', note:'white, plant green, a water-blue wet lab', s1:'#eef7ea', s2:'#2f8f4e'}
];
const skinsEl=document.getElementById('skins');
skinsEl.innerHTML=SKINS.map(k=>`<button type="button" class="skin" data-skin="${k.id}" aria-pressed="false" style="--s1:${k.s1};--s2:${k.s2}" title="${k.name}: ${k.note}"><span>${k.name}</span></button>`).join('');
function setSkin(id,remember){
  FX.setAttribute('data-skin',id);
  skinsEl.querySelectorAll('.skin').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===id)));
  if(remember){ try{ localStorage.setItem('drylab-skin',id); }catch(e){} }
  if(view==='board'){ build(); applyFilter(); }
  buildLegend();
}
skinsEl.addEventListener('click',e=>{ const b=e.target.closest('.skin'); if(b) setSkin(b.dataset.skin,true); });

/* ==================================================================
   12. GO
   ================================================================== */
document.getElementById('controls').hidden=false;
document.getElementById('strip').hidden=false;
let startSkin='notebook';
try{ const s=localStorage.getItem('drylab-skin'); if(SKINS.some(k=>k.id===s)) startSkin=s; }catch(e){}
FX.setAttribute('data-skin',startSkin);
skinsEl.querySelectorAll('.skin').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===startSkin)));
buildLegend();

const hash=decodeURIComponent(location.hash.slice(1));
const onRecord = hash==='record' || (hash && document.getElementById(hash) && document.getElementById(hash).closest('#record'));
/* A phone gets the written record first; the board is one tap away. */
const small = matchMedia('(max-width:700px)').matches;
if(hash==='photos') setView('gallery');
else if(onRecord || (small && !hash)) { setView('record'); if(hash&&hash!=='record') revealRecord(hash); }
else {
  setView('board');
  document.getElementById('board').scrollTop=0;
  const n=hash&&nodeFor(hash);
  if(n) goTo(n);
}
let rt;
addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>{ if(view==='board'){ build(); applyFilter(); } refollow(); },180); });
})();
