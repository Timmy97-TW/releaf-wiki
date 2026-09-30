/* =============================================================================
   ReLeaf: Dry Lab Notebook
   -----------------------------------------------------------------------------
   The mosaic, the season timeline and Felix Yu's board. On the board every
   pipeline is a lane, every week a row, newest at the top. A mark on a lane is that pipeline's page for that week. Lines between
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
  {id:'hw',    name:'Hardware',          icon:'hw'},
  {id:'bio',   name:'Protein design',    icon:'bio'},
  {id:'model', name:'Modelling',         icon:'model'},
  {id:'plant', name:'Plant systems',     icon:'plant'},
  {id:'comm',  name:'Communication',     icon:'comm'}
];
const PIPES = NB.pipes;
const WEEKS = NB.weeks.map(w => w.date);
const ENTRIES = NB.entries;
const HANDOFFS = NB.handoffs;
const LINKS = NB.links;
const PHOTOS = NB.photos;

const KINDS = {
  start:    {label:'A pipeline opens',       shape:'ring'},
  work:     {label:'A working week',         shape:'dot'},
  milestone:{label:'A milestone',            shape:'diamond'},
  branch:   {label:'The line splits',        shape:'tri'},
  handoff:  {label:'Handed onward',          shape:'chev'},
  end:      {label:'The pipeline closes',    shape:'square'},
  plan:     {label:'Planned, not yet done',  shape:'plan'}
};
const NB_KINDS = {
  start:    {label:'Circled: a pipeline opens',   shape:'ring'},
  work:     {label:'Ticked: a working week',      shape:'dot'},
  milestone:{label:'Starred: a milestone',        shape:'diamond'},
  branch:   {label:'Forked: the line splits',     shape:'tri'},
  handoff:  {label:'Arrowed out: handed onward',  shape:'chev'},
  end:      {label:'Boxed: the pipeline closes',  shape:'square'},
  plan:     {label:'Pencilled in: planned',       shape:'plan'}
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
/* The last week that has happened. Weeks after it are the plan to the
   freeze: they are on the board, pencilled in, but not in the record. */
const LASTW = (()=>{let i=NW-1; while(i>0 && NB.weeks[i].plan) i--; return i;})();
const isPlanW = w => w>LASTW;

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
    /* Narrow lanes: names turn vertical. The wet lab keeps room for its words
       unless that would squeeze the lanes below a readable width. */
    compact=true;
    railW=78; gapW=22; rowH=62; headH=104; nodeSz=36; wetT=38;
    lane=Math.floor((avail-railW-gapW-wetW-TAIL)/NL);
    if(lane<54){ wetW=76; wetT=34; lane=Math.floor((avail-railW-gapW-wetW-TAIL)/NL); }
  }
  WETWORDS = wetW>100;
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
let COMPACT=false, WETWORDS=true;
function readMetrics(){
  RAIL=cssnum('--rail'); LANE=cssnum('--lane'); ROW=cssnum('--row');
  GAP=cssnum('--gap'); WETW=cssnum('--wetw'); HEAD=cssnum('--headh');
}
const laneX = i => RAIL + i*LANE + LANE/2;
const wetL  = () => RAIL + NL*LANE + GAP;
/* The thumbnail sits to the left of the wet lab column, so the words saying
   how each send came back have room beside it. */
const wetX  = () => WETWORDS ? wetL()+28 : wetL()+WETW/2;
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

/* The clean board uses plain marks: an open ring when a pipeline starts, a
   dot for an ordinary week, a star for a milestone, a fork where it splits,
   an arrow where work is handed on, a filled square when it closes, and a
   dashed ring for a week that is planned but has not happened. */
const SHAPES={
  ring:   '<circle cx="0" cy="0" r="5.6" fill="var(--node-face)" stroke="var(--c)" stroke-width="2.4"/>',
  dot:    '<circle class="glyphfill" cx="0" cy="0" r="5.4"/>',
  diamond:'<circle class="mstone-halo" cx="0" cy="0" r="12" fill="var(--c)" opacity=".13"/>'
         +'<path class="glyphfill" d="M0 -8 2.3 -2.7 8 -2.2 3.7 1.6 5 7.2 0 4.2 -5 7.2 -3.7 1.6 -8 -2.2 -2.3 -2.7Z"/>',
  tri:    '<path d="M0 6.5V0.8M0 0.8 -5.2 -5.4M0 0.8 5.2 -5.4" stroke="var(--c)" stroke-width="2.2" fill="none" stroke-linecap="round"/>'
         +'<circle class="glyphfill" cx="-5.6" cy="-5.8" r="2.1"/><circle class="glyphfill" cx="5.6" cy="-5.8" r="2.1"/>',
  chev:   '<circle class="glyphfill" cx="0" cy="0" r="6.4"/><path d="M-2.4 -3.2 1.4 0 -2.4 3.2" fill="none" stroke="var(--node-face)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  square: '<rect class="glyphfill" x="-5.4" y="-5.4" width="10.8" height="10.8" rx="1.5"/>',
  plan:   '<circle cx="0" cy="0" r="5.8" fill="var(--node-face)" stroke="var(--c)" stroke-width="1.7" stroke-dasharray="2.6 2.4"/>'
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
         +'<path class="glyphstroke" style="stroke-width:1.4" d="M-3.9 -3.5 4.2 3.7M4 -3.7 -3.7 3.9" stroke-linecap="round"/>',
  plan:   '<path class="glyphstroke" style="stroke-width:1.5" stroke-dasharray="2.4 2.6" d="M1.8 -6.4C-2.8 -7.6 -6.9 -4.2 -6.7 0.4 -6.5 4.7 -2.6 7.3 1.3 6.5 5.3 5.7 7.4 1.9 6.4 -1.8 5.7 -4.5 3.6 -6.1 0.6 -6.6" stroke-linecap="round"/>'
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
    ${gicon('wet')}<span class="nm">Wet Lab</span><span class="nmv">Wet Lab</span>${WETWORDS?'<span class="sub">sent, and what came back</span>':''}<span class="bar"></span></div>`;
  h+=`</div>`;

  h+=`<div style="position:relative;width:${W}px;height:${H}px">`;
  h+=`<div class="beams" style="top:0;width:${W}px">`;
  PIPES.forEach((p,i)=>{h+=`<div class="beam" data-beam="${p.id}" style="left:${RAIL+i*LANE}px;--c:${p.cv}"><i></i></div>`});
  h+=`</div>`;
  h+=`<div class="wetband" style="left:${wetL()-GAP/2}px;width:${WETW+GAP/2}px;height:${H}px"></div>`;
  const planH=(NW-1-LASTW)*ROW;
  if(planH>0){
    h+=`<div class="planband" style="left:${RAIL}px;width:${W-RAIL}px;height:${planH}px"></div>`;
    h+=`<div class="nowline" style="top:${planH}px"><span>Now: week of ${fmt(WEEKS[LASTW])}</span></div>`;
  }

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
    const pl=isPlanW(w);
    h+=`<button type="button" class="railrow${pl?' is-plan':''}" data-wk="${w}" style="top:${y}px"
      aria-label="Week ${w+1}, ${fmtLong(wk)}: ${pl?'what is planned':'read the whole week'}">
      <span class="wk">${wk2(w)}</span><span class="dt">${fmt(wk)}</span>
      ${pl?'<span class="pl">Planned</span>':isM?`<span class="mo">${monthOf(wk)}</span>`:''}${(NB.events||[]).filter(ev=>ev.w===w).map(ev=>`<span class="ev" title="${attr(fmt(ev.date)+': '+ev.t)}" aria-hidden="true"></span>`).join('')}</button>`;
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
  const p=VINE[pid]; if(!p || SPINE==='rule') return 0;
  if(SPINE==='vine'||SPINE==='stem') return vineOffsetAt(p,y);
  return inkOffsetAt(pid,p.y1,p.y2,y);
}
const nodeX = (pid,w) => laneX(P_BY_ID[pid].lane)+spineOffsetAt(pid,rowY(w));

function links(){
  let s='';
  const nb=isNotebook();
  /* lane spines */
  PIPES.forEach((p,i)=>{
    const ws=ENTRIES.filter(e=>e.p===p.id&&e.k!=='plan').map(e=>e.w);
    const pw=ENTRIES.filter(e=>e.p===p.id&&e.k==='plan').map(e=>e.w);
    if(!ws.length) return;
    const y1=rowY(Math.min(...ws)), y2=rowY(Math.max(...ws)), x=laneX(i);
    VINE[p.id]=vineParams(p.id,y1,y2);
    /* the plan: a dashed line from the last week done to the last week planned */
    if(pw.length){
      s+=`<line x1="${x}" y1="${y2}" x2="${x}" y2="${rowY(Math.max(...pw))}" style="stroke:${p.cv}" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round" opacity=".45" data-spine="${p.id}"/>`;
    }
    if(SPINE==='rule'){
      s+=`<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" style="stroke:${p.cv}" stroke-width="2.4" stroke-linecap="round" opacity=".32" data-spine="${p.id}"/>`;
    }else if(SPINE==='vine'||SPINE==='stem'){
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
    const d=`M ${x1+14} ${y} C ${x1+(wx-x1)*.45} ${y}, ${wx-(wx-x1)*.28} ${y}, ${wx-(WETWORDS?25:19)} ${y}`;
    s+=`<path d="${d}" fill="none" style="stroke:${p.cv}" stroke-width="2" opacity=".55" stroke-dasharray="6 5" stroke-linecap="round" data-hand="${j}"/>`;
    const tip=wx-(WETWORDS?23:17);
    s+=`<path d="M ${tip-7} ${y-4.5} L ${tip} ${y} L ${tip-7} ${y+4.5} Z" style="fill:${p.cv}" opacity=".75"/>`;
    /* and back: where the notebook dates the answer, the line returns to the
       pipeline it landed on, in the wet lab's colour */
    const r=hf.ret;
    if(r && r.to){
      const ty=rowY(r.w), tx=nodeX(r.to,r.w);
      const sx=wx-(WETWORDS?23:17), sy=y-8;
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
    if(WETWORDS){
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
${more?`<p class="shotcap">${list.length} photographs</p>`:''}`;
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
  const days=e.dates.length?e.dates.map(fmt).join(' and '):'week of '+fmt(WEEKS[e.w]);
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
  if(isPlanW(w)){
    const pl=ENTRIES.filter(e=>e.w===w);
    let h=`<div class="top"><span class="pipe" style="color:var(--ink-2)">Planned week</span><span class="when">${wk2(w)}</span></div>`;
    h+=`<h3>${fmtLong(WEEKS[w])}</h3>`;
    h+=pl.length?`<div class="csec"><h4>Pencilled in</h4><ul class="ai">${pl.map(e=>`<li><b>${esc(P_BY_ID[e.p].short)}</b>: ${e.t}</li>`).join('')}</ul></div>`
                :`<p class="sum">Nothing pencilled in yet.</p>`;
    h+=`<div class="foot"><span>Wiki freeze, 21 October</span><button type="button" class="close" data-close>Close</button></div>`;
    return h;
  }
  let h=`<div class="top"><span class="pipe" style="color:var(--ink-2)">The week</span><span class="when">${wk2(w)}</span></div>`;
  wk.days.forEach((d,i)=>{
    h+=`<h3${d.ai?' class="ai"':''}>${fmtLong(d.date)}</h3>`;
    if(d.event){ h+=`<p class="sum"><b>Event:</b> ${esc(d.event)}</p><p class="jump"><button type="button" data-record="e-${d.date}">Read it in the written record</button></p>`; return; }
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
  if(wk.days.length) h+=`<p class="jump"><button type="button" data-record="e-${wk.days[0].date}">Open this week in the written record</button></p>`;
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
  const top=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||64)+(parseFloat(FX.style.getPropertyValue('--tbh'))||0)+8;
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
   5. FILTER + SEARCH. The pipeline tags and the search box act on all
   three views: the board dims what does not match, the record hides
   the weeks that do not match, the photo log shows only what matches.
   ================================================================== */
const active=new Set(GROUPS.map(g=>g.id));
let query='';
const allOn=()=>active.size===GROUPS.length;
/* The record's own pipeline names, mapped onto the lanes. */
const NAME_TO_ID={'Data Physicalization':'dataphys','Wiki & Notebook':'wiki','Plant Growth Chamber':'chamber','Hydroponics':'hydro',
  'Math Modeling':'math','GIS & Stress Forecast':'gis','Genetic Circuit Design':'circuit','Bioreactor':'reactor','OD600 Photometer':'photo',
  'Light Plate Apparatus':'lpa','Chlorophyll Fluorometer':'fluor','Protectant Design':'protect','Codon Optimization':'codon',
  'Digital Twin':'twin','Wet Lab Handoff':'wet'};
function hay(e){
  return plain([e.t,e.s,e.stage,P_BY_ID[e.p].short,...e.deliv.map(d=>d.t+' '+d.items.join(' '))].join(' ')).toLowerCase();
}
const REC=[];
function indexRecord(){
  document.querySelectorAll('#record article.entry').forEach(a=>{
    const g=new Set();
    a.querySelectorAll('.pipes .pipe b').forEach(b=>{
      const id=NAME_TO_ID[b.textContent.trim()];
      if(id==='wet') g.add('wet'); else if(id&&P_BY_ID[id]) g.add(P_BY_ID[id].g);
    });
    REC.push({a,g,t:a.textContent.replace(/\s+/g,' ').toLowerCase()});
  });
}
let shown={board:0,record:0,gallery:0};
function applyFilter(){
  const q=query.trim().toLowerCase();
  let nOn=0;
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
    if(ok&&g!=='wet') nOn++;
  });
  shown.board=nOn;
  grid.querySelectorAll('[data-spine]').forEach(sp=>{
    const p=P_BY_ID[sp.dataset.spine];
    sp.style.opacity = active.has(p.g) ? (q?'.12':'') : '.06';
  });
  grid.querySelectorAll('.beam').forEach(b=>{ b.style.opacity = active.has(P_BY_ID[b.dataset.beam].g)?'1':'.15'; });
  grid.querySelectorAll('.head[data-lane]').forEach(hd=>{ hd.style.opacity = active.has(P_BY_ID[hd.dataset.lane].g)?'1':'.3'; });

  /* the written record */
  let nRec=0;
  const months=new Map();
  REC.forEach(r=>{
    let ok = allOn() || [...r.g].some(g=>active.has(g));
    if(ok&&q) ok=r.t.includes(q);
    r.a.classList.toggle('is-miss',!ok);
    if(ok) nRec++;
    const m=r.a.closest('.nbmonth');
    months.set(m,(months.get(m)||0)+(ok?1:0));
  });
  shown.record=nRec;
  const filtering = q || !allOn();
  months.forEach((n,m)=>{
    m.classList.toggle('off',filtering&&!n);
    const link=document.querySelector(`.mindex__list a[href="#${m.id}"]`);
    if(link){ link.classList.toggle('is-empty',filtering&&!n); const sp=link.querySelector('span'); if(sp){ sp.dataset.all=sp.dataset.all||sp.textContent; sp.textContent=filtering?`${n} match${n===1?'':'es'}`:sp.dataset.all; } }
    if(filtering&&n){ const f=m.querySelector('.nbmonth__fold'); if(f&&!f.open) f.open=true; }
  });
  const empty=document.getElementById('recempty');
  if(empty) empty.classList.toggle('off',nRec>0);

  buildGallery();
  status();
}
function status(){
  const el=document.getElementById('tbstatus'); if(!el) return;
  const q=query.trim(), filtering=q||!allOn();
  const what = !allOn() ? GROUPS.filter(g=>active.has(g.id)).map(g=>g.name).join(', ') : '';
  const scope = [what, q?`“${esc(q)}”`:''].filter(Boolean).join(' and ');
  let t='';
  if(filtering){
    if(view==='board') t=`<b>${shown.board}</b> of ${ENTRIES.length} marks match ${scope}.`;
    else if(view==='record') t=`<b>${shown.record}</b> of ${REC.length} entries match ${scope}.`;
    else t=`<b>${shown.gallery}</b> of ${PHOTOS.length} photographs match ${scope}.`;
  }
  el.innerHTML=t;
}
const chipsEl=document.getElementById('groupchips');
function renderChips(){
  chipsEl.innerHTML=GROUPS.map(g=>{
    const c=PIPES.find(p=>p.g===g.id).ct, on=active.has(g.id);
    const tip = allOn() ? `Show only ${g.name}` : (on ? `Hide ${g.name}` : `Add ${g.name}`);
    return `<button type="button" class="chip" data-g="${g.id}" aria-pressed="${on}" title="${tip}" style="--cc:${c}">${gicon(g.icon)}<span>${g.name}</span></button>`;
  }).join('') + (allOn()?'':`<button type="button" class="chip chip--all" data-all>Show all</button>`);
}
chipsEl.addEventListener('click',e=>{
  const b=e.target.closest('.chip'); if(!b)return;
  if(b.hasAttribute('data-all')){ GROUPS.forEach(g=>active.add(g.id)); }
  else{
    const id=b.dataset.g;
    /* From "everything", a tag isolates its group; after that tags add and remove. */
    if(allOn()){ active.clear(); active.add(id); }
    else if(active.has(id)){ active.delete(id); if(!active.size) GROUPS.forEach(g=>active.add(g.id)); }
    else active.add(id);
  }
  renderChips();
  const again=chipsEl.querySelector(b.hasAttribute('data-all')?'.chip':`[data-g="${b.dataset.g}"]`);
  if(again) again.focus();
  applyFilter();
});
renderChips();
document.getElementById('q').addEventListener('input',e=>{query=e.target.value;applyFilter()});

/* ==================================================================
   6. LEGEND
   ================================================================== */
function range(p){
  const ws=ENTRIES.filter(e=>e.p===p.id&&e.k!=='plan').map(e=>e.w);
  return ws.length?`${fmt(WEEKS[Math.min(...ws)])} to ${fmt(WEEKS[Math.max(...ws)])}`:'';
}
function legendPipes(filter){
  return PIPES.filter(filter).map(p=>`<li><span class="sw" style="background:${p.cv}"></span>${p.href?`<a href="${p.href}">${esc(p.short)}</a>`:esc(p.short)}<span class="desc">${range(p)}</span></li>`).join('');
}
function buildLegend(){
  const SHP=curShapes(), KND=curKinds();
  const glyph=v=>SHP[v.shape].replace(/class="glyphfill"/g,'fill="currentColor"').replace(/class="glyphface"/g,'fill="var(--panel)"').replace(/class="glyphstroke"/g,'fill="none" stroke="currentColor" stroke-width="2"').replace(/var\(--c\)/g,'currentColor').replace(/var\(--node-face\)/g,'var(--panel)');
  const feeds=LINKS.filter(l=>l.kind==='feed').length, branches=LINKS.filter(l=>l.kind==='branch').length;
  const returns=HANDOFFS.filter(h=>h.ret.to).length;
  const sw=(d,extra)=>`<svg width="30" height="12" viewBox="0 0 30 12" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ${extra||''}/></svg>`;
  document.getElementById('legend').innerHTML=`
  <div><h4>Marks</h4>
    <ul>${Object.values(KND).map(v=>`<li><svg width="18" height="18" viewBox="-9 -9 18 18" style="color:var(--ink-2)">${glyph(v)}</svg>${v.label}</li>`).join('')}
      <li class="ai"><svg width="18" height="18" viewBox="-9 -9 18 18" aria-hidden="true"><circle r="3.2" fill="var(--ai-ink,#c2410c)"/></svg>Drafted, not yet written up by the team</li></ul></div>
  <div><h4>Lines</h4>
    <ul>
      <li style="color:var(--ink-3)">${sw('M2 11 C2 4, 28 8, 28 1')}<span style="color:var(--ink-2)">A pipeline grows out of another</span><span class="desc">${branches}</span></li>
      <li style="color:var(--ink-3)" class="ai">${sw('M2 3 C10 12, 20 12, 27 5')}<span>One pipeline feeds another</span><span class="desc">${feeds}</span></li>
      <li style="color:var(--wet)">${sw('M2 6 L28 6','stroke-dasharray="5 4"')}<span style="color:var(--ink-2)">Sent to the Wet Lab</span><span class="desc">${HANDOFFS.length}</span></li>
      <li style="color:var(--wet)" class="ai">${sw('M28 6 L2 6','stroke-dasharray="1.5 4"')}<span>Came back and changed a pipeline</span><span class="desc">${returns}</span></li>
    </ul></div>
  <div><h4>Hardware</h4><ul>${legendPipes(p=>p.g==='hw')}</ul></div>
  <div><h4>Protein design and modelling</h4><ul>${legendPipes(p=>p.g==='bio'||p.g==='model')}</ul></div>
  <div><h4>Plants and communication</h4><ul>${legendPipes(p=>p.g==='plant'||p.g==='comm')}</ul></div>
`;
}

/* ==================================================================
   7. PHOTO LOG
   ================================================================== */
const gallery=document.getElementById('gallery');
function photoMatches(ph,q){
  if(ph.p && P_BY_ID[ph.p] && !active.has(P_BY_ID[ph.p].g)) return false;
  if(!ph.p && !allOn()) return false;
  if(q) return (ph.c+' '+(ph.p?P_BY_ID[ph.p].short:'team')).toLowerCase().includes(q);
  return true;
}
function buildGallery(){
  const q=query.trim().toLowerCase();
  shown.gallery=PHOTOS.filter(ph=>photoMatches(ph,q)).length;
  if(view!=='gallery')return;
  let h='';
  for(let w=NW-1;w>=0;w--){
    const list=(PIX_BY_WEEK[w]||[]).filter(ph=>photoMatches(ph,q));
    if(!list.length)continue;
    h+=`<section class="galweek"><h2>Week of ${fmtLong(WEEKS[w])}<span>${wk2(w)}, ${list.length} photograph${list.length>1?'s':''}</span></h2><div class="galgrid" data-all="${list.map(p=>p.i).join(',')}">`;
    list.forEach(ph=>{
      const p=ph.p?P_BY_ID[ph.p]:null;
      const who = p ? p.short : (ph.hf!==null&&ph.hf!==undefined ? 'Wet Lab' : (ph.team==='Wetlab' ? 'Wet Lab' : ph.team==='HP' ? 'Human Practices' : 'Team'));
      const ct  = p ? p.ct : (who==='Wet Lab' ? 'var(--wet)' : 'var(--ink-3)');
      h+=`<figure class="galitem" style="--ct:${ct}">
        <button type="button" class="shot-btn${ph.k==='figure'?' fig':''}" data-pix="${ph.i}" aria-label="Enlarge: ${attr(ph.c)}">
          <img src="${ph.t}" alt="${attr(ph.c)}" loading="lazy">${ph.s?STARSVG:''}</button>
        <figcaption class="meta"><span class="cap ai">${esc(ph.c)}</span>
          <span class="sub"><span class="pd">${esc(who)}</span><span>${esc(ph.d)}</span>${ph.s?'<span>team pick</span>':''}</span></figcaption></figure>`;
    });
    h+=`</div></section>`;
  }
  gallery.innerHTML=h||`<div class="nothing"><img src="${MASCOT}" alt=""><p>No photographs match. Try another word, or show all pipelines.</p></div>`;
}

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
  /* The record's pipeline dots take the same pens as the board, and each
     written week can be found on the board. */
  record.querySelectorAll('.pipe').forEach(li=>{
    const id=NAME_TO_ID[((li.querySelector('b')||{}).textContent||'').trim()];
    if(id&&(id==='wet'||P_BY_ID[id])) li.style.setProperty('--c', id==='wet'?'var(--wet)':`var(--p-${id})`);
  });
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
const viewBtns=[...document.querySelectorAll('#controls [data-view]')];
function setView(v){
  view=v;
  viewBtns.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===v)));
  const board=v==='board';
  ['boardframe','legend'].forEach(id=>document.getElementById(id).classList.toggle('off',!board));
  gallery.classList.toggle('off',v!=='gallery');
  record.classList.toggle('off',v!=='record');
  unpin(true);
  if(board) build();
  applyFilter();
}
viewBtns.forEach(b=>b.addEventListener('click',()=>{
  const deep=document.getElementById('controls').getBoundingClientRect().top<=(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||68)+1;
  setView(b.dataset.view);
  /* switched from deep inside another view: start the new one at its top */
  if(deep) document.getElementById({board:'boardframe',record:'record',gallery:'gallery'}[b.dataset.view]).scrollIntoView({block:'start'});
  setHash(b.dataset.view==='board'?'board':b.dataset.view==='record'?'':'photos');
}));

/* ==================================================================
   11. STYLES: Clean (the default) and Felix's Notebook paper
   ================================================================== */
const SKINS=[
  {id:'clean',    name:'Clean',    note:'white, one typeface', s1:'#ffffff'},
  {id:'notebook', name:'Notebook', note:'Felix Yu’s ruled paper, one pen per pipeline', s1:'#ece4cf'}
];
const skinsEl=document.getElementById('skins');
skinsEl.innerHTML=SKINS.map(k=>`<button type="button" class="seg__btn" data-skin="${k.id}" aria-pressed="false" title="${k.name}: ${k.note}" style="--s1:${k.s1}"><span class="seg__sw"></span>${k.name}</button>`).join('');
function setSkin(id,remember){
  FX.setAttribute('data-skin',id);
  skinsEl.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===id)));
  if(remember){ try{ localStorage.setItem('drylab-style',id); }catch(e){} }
  if(view==='board'){ build(); applyFilter(); }
  buildLegend();
  drawTimeline();
}
skinsEl.addEventListener('click',e=>{ const b=e.target.closest('[data-skin]'); if(b) setSkin(b.dataset.skin,true); });

/* ==================================================================
   12. THE MOSAIC: DRY LAB, spelled in the dry lab's own photographs.
   Tiles fly in the first time the words are on screen; a hovered
   photo lifts off the sheet and names itself; a click opens it; the
   shuffle button deals a fresh set; now and then one tile turns over.
   ================================================================== */
const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
(function(){
  const box=document.getElementById('mosaic'), sheet=document.getElementById('mosaicgrid'), cap=document.getElementById('mosaiccap');
  if(!box||!sheet) return;
  const FONT={D:['XX.','X.X','X.X','X.X','XX.'],R:['XX.','X.X','XX.','X.X','X.X'],Y:['X.X','X.X','.X.','.X.','.X.'],
              L:['X..','X..','X..','X..','XXX'],A:['.X.','X.X','XXX','X.X','X.X'],B:['XX.','X.X','XX.','X.X','XX.']};
  const WORD='DRY LAB';
  const POOL=PHOTOS.filter(p=>p.team==='Drylab'&&p.k==='photo');
  const DEFAULT_CAP='';
  const LEAF='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14V7M8 7C8 4.5 6 2.5 3 2.5c0 3 1.8 4.5 5 4.5ZM8 8.6c0-2.2 1.8-4 4.5-4 0 2.7-1.6 4-4.5 4Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  let cells=[], dealt=[], tiles=[], mode='', cols=27, rows=7, hovering=false, visible=false;

  /* One line on a wide screen; DRY over LAB on a phone, so the squares
     stay big enough to see. The squared paper runs the full width of the
     page, and the words sit in the middle of it. */
  function layout(){
    const m = matchMedia('(max-width:640px)').matches ? 'stack' : 'line';
    const w = sheet.parentNode.clientWidth || innerWidth;
    const cell = Math.max(36, Math.min(48, innerHeight*.054));
    const wordCols = m==='stack' ? 11 : 25;
    const c = m==='stack' ? 13 : Math.max(27, Math.floor(w/cell));
    const key = m+c;
    if(key===mode) return false;
    mode=key;
    cells=[];
    const lines = m==='stack' ? ['DRY','LAB'] : [WORD];
    const left = Math.floor((c-wordCols)/2);
    lines.forEach((word,li)=>{
      let col=left;
      for(const ch of word){
        if(ch===' '){ col+=2; continue; }
        FONT[ch].forEach((row,r)=>[...row].forEach((x,cc)=>{ if(x==='X') cells.push({r:1+li*6+r,c:col+cc}); }));
        col+=4;
      }
    });
    cols = c;
    rows = m==='stack' ? 13 : 7;
    box.style.setProperty('--cols',cols);
    box.style.setProperty('--rows',rows);
    return true;
  }
  function shuffled(list){ const a=list.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
  function deal(){
    /* Starred frames first, the rest at random, never the same photo twice. */
    const st=shuffled(POOL.filter(p=>p.s)), rest=shuffled(POOL.filter(p=>!p.s));
    const pick=dealt.length ? shuffled(POOL) : st.concat(rest);
    return pick.slice(0,cells.length);
  }
  function render(){
    const taken=new Set(cells.map(c=>c.r+'|'+c.c));
    let h='';
    /* a few leaves on the empty squares, the way the team doodles on paper */
    for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
      if(taken.has(r+'|'+c)) continue;
      if(jitter('leaf',r*31+c)<.045) h+=`<span class="mosaic__leaf" style="--r:${r+1};--c:${c+1}">${LEAF}</span>`;
    }
    dealt=deal();
    h+=cells.map((cl,i)=>{
      const ph=dealt[i];
      const fx=((jitter('fx',i)-.5)*260).toFixed(0)+'px', fy=((jitter('fy',i)-.5)*160).toFixed(0)+'px', fr=((jitter('fr',i)-.5)*50).toFixed(0)+'deg';
      const d=Math.round(cl.c*28+jitter('d',i)*160);
      return `<button type="button" class="tile" data-t="${i}" style="--r:${cl.r+1};--c:${cl.c+1};--fx:${fx};--fy:${fy};--fr:${fr};--d:${d}ms" aria-label="${attr(ph.c)}, ${attr(ph.d)}"><img src="${ph.t}" alt="" decoding="async"></button>`;
    }).join('');
    sheet.innerHTML=h;
    tiles=[...sheet.querySelectorAll('.tile')];
    if(visible||reduce()) requestAnimationFrame(()=>requestAnimationFrame(()=>box.classList.add('is-in')));
  }
  function describe(ph){
    const p=ph.p?P_BY_ID[ph.p]:null;
    return `<b>${esc(ph.d)}</b>${p?` &middot; <span class="pc" style="color:${p.ct}">${esc(p.short)}</span>`:''} &middot; <span class="ai">${esc(ph.c)}</span>`;
  }
  sheet.addEventListener('mouseover',e=>{ const t=e.target.closest('.tile'); if(t){ hovering=true; cap.innerHTML=describe(dealt[+t.dataset.t]); } });
  sheet.addEventListener('focusin',e=>{ const t=e.target.closest('.tile'); if(t) cap.innerHTML=describe(dealt[+t.dataset.t]); });
  sheet.addEventListener('mouseleave',()=>{ hovering=false; cap.innerHTML=DEFAULT_CAP; });
  sheet.addEventListener('click',e=>{
    const t=e.target.closest('.tile'); if(!t) return;
    e.stopPropagation();
    openLB(dealt,+t.dataset.t,t);
  });
  function turn(i,ph,delay){
    const t=tiles[i]; if(!t) return;
    setTimeout(()=>{
      if(reduce()){ dealt[i]=ph; t.querySelector('img').src=ph.t; t.setAttribute('aria-label',`${plain(ph.c)}, ${ph.d}`); return; }
      t.classList.remove('flip'); void t.offsetWidth; t.classList.add('flip');
      setTimeout(()=>{ dealt[i]=ph; t.querySelector('img').src=ph.t; t.setAttribute('aria-label',`${plain(ph.c)}, ${ph.d}`); },250);
      setTimeout(()=>t.classList.remove('flip'),560);
    },delay);
  }
  document.getElementById('shuffle').addEventListener('click',()=>{
    const next=shuffled(POOL).slice(0,cells.length);
    cells.forEach((cl,i)=>turn(i,next[i],Math.round(cl.c*22+jitter('s'+Date.now(),i)*120)));
    cap.innerHTML=DEFAULT_CAP;
  });
  /* Now and then, while the words are on screen and nobody is looking at
     one photo in particular, a single tile turns over to another frame. */
  setInterval(()=>{
    if(!visible||hovering||reduce()||document.hidden||!tiles.length) return;
    const used=new Set(dealt.map(p=>p.i));
    const spare=POOL.filter(p=>!used.has(p.i)); if(!spare.length) return;
    turn(Math.floor(Math.random()*tiles.length),spare[Math.floor(Math.random()*spare.length)],0);
  },3400);
  if('IntersectionObserver' in window){
    new IntersectionObserver(es=>es.forEach(en=>{
      visible=en.isIntersecting;
      if(visible) requestAnimationFrame(()=>box.classList.add('is-in'));
    }),{threshold:.25}).observe(box);
  }else{ visible=true; }
  layout(); box.hidden=false; render();
  addEventListener('resize',()=>{ if(layout()){ box.classList.remove('is-in'); render(); } });
})();

/* ==================================================================
   13. WHERE THE NOTEBOOK IS: the season as one line, the latest week,
   and what is pencilled in before the freeze.
   ================================================================== */
const D0=new Date(WEEKS[0]+'T00:00:00');
const TODAY=NB.today||WEEKS[LASTW];
const FREEZE=NB.freeze||'2026-10-21';
const dayOf=iso=>Math.round((new Date(iso+'T00:00:00')-D0)/864e5);
(function(){
  const track=document.getElementById('nowtrack'); if(!track) return;
  const end=dayOf(FREEZE), now=Math.min(dayOf(TODAY),end), pc=d=>(d/end*100).toFixed(2)+'%';
  track.innerHTML=`<span class="now__line"></span><span class="now__done" style="width:${pc(now)}"></span>
    <span class="now__plan" style="left:${pc(now)};width:calc(${pc(end)} - ${pc(now)})"></span>
    <span class="now__mk is-start" style="left:0"><span>${fmt(WEEKS[0])}</span><i></i></span>
    <span class="now__mk is-today" style="left:${pc(now)}"><span>Today, ${fmt(TODAY)}</span><i></i></span>
    <span class="now__mk is-end" style="left:100%"><span>Wiki freeze, ${fmt(FREEZE)}</span><i></i></span>`;
  const item=(e,cls)=>{
    const p=P_BY_ID[e.p];
    return `<li class="${cls||''}${e.ai?' ai':''}" style="--c:${p.cv}"><button type="button" data-goto="${e.p}|${e.w}"><b style="color:${p.ct}">${esc(p.short)}</b>: ${e.t}${cls?` <span class="w">by ${fmt(WEEKS[e.w])}</span>`:''}</button></li>`;
  };
  const rank={milestone:0,end:1,start:2,branch:3,handoff:4,work:5};
  const last=ENTRIES.filter(e=>e.w===LASTW).sort((a,b)=>(rank[a.k]-rank[b.k])||(b.h-a.h)).slice(0,3);
  document.getElementById('nowlast').innerHTML=last.map(e=>item(e)).join('')||'<li>Nothing recorded yet.</li>';
  /* one item from each week left, then a second from the nearest week */
  const pl=ENTRIES.filter(e=>e.k==='plan'), wks=[...new Set(pl.map(e=>e.w))].sort((a,b)=>a-b);
  const firsts=wks.map(w=>pl.find(e=>e.w===w));
  const plan=firsts.concat(pl.filter(e=>!firsts.includes(e))).slice(0,3).sort((a,b)=>a.w-b.w);
  document.getElementById('nowplan').innerHTML=plan.map(e=>item(e,'is-plan')).join('')||'<li>Nothing pencilled in yet.</li>';
  document.getElementById('now').addEventListener('click',e=>{
    const b=e.target.closest('[data-goto]'); if(!b) return;
    const [p,w]=b.dataset.goto.split('|');
    goTo(grid.querySelector(`.node[data-i="${E_BY_KEY[p+'|'+w]}"]`));
  });
})();

/* ==================================================================
   14. SEASON TIMELINE. The dry lab's pipelines against the weeks, on
   one screen, with the wet lab's own work underneath and every
   crossing between them drawn in.
   ================================================================== */
const tlBox=document.getElementById('tl'), tlScroll=document.getElementById('tlscroll'), tlTip=document.getElementById('tltip');
const WET=NB.wet||[];
const wOf=iso=>Math.floor(dayOf(iso)/7);
function drawTimeline(){
  if(!tlScroll) return;
  document.getElementById('season').hidden=false;
  const W=Math.max(980,tlScroll.clientWidth);
  /* Narrower than the chart: it scrolls, and a column of short names stays pinned on the left. */
  const pinned=W>tlScroll.clientWidth+1;
  const LBL=pinned?112:Math.min(196,Math.max(150,W*.14)), PADR=18, AX=62;
  let lab='';
  const cw=(W-LBL-PADR)/NW, x=w=>LBL+w*cw;
  /* a laptop screen: the whole timeline, key included, still fits under the nav */
  const short=innerHeight<860;
  const RH=short?19:21, GH=short?17:19, CH=short?11:12, WRH=short?13:15, WCH=8;
  const rows=[]; let y=AX+6;
  GROUPS.forEach(g=>{
    const ps=PIPES.filter(p=>p.g===g.id&&ENTRIES.some(e=>e.p===p.id));
    if(!ps.length) return;
    rows.push({grp:g,y}); y+=GH;
    ps.forEach(p=>{ rows.push({p,y}); y+=RH; });
    y+=4;
  });
  const dryBottom=y;
  const wetTop=y+22; y=wetTop;
  const wetRows=[]; y+=GH;
  WET.forEach(t=>{ wetRows.push({t,y}); y+=WRH; });
  const H=y+8;
  const rowOf=Object.fromEntries(rows.filter(r=>r.p).map(r=>[r.p.id,r]));
  const nowX=LBL+dayOf(TODAY)/7*cw, frzX=LBL+dayOf(FREEZE)/7*cw;
  let s='';
  /* plan region and month bands */
  s+=`<rect x="${nowX}" y="${AX-4}" width="${W-PADR-nowX}" height="${H-AX+4}" fill="url(#tlhatch)"/>`;
  /* months: a rule at the first of each month, the name where there is
     room for it (the chart opens on 28 March, so March gets no name) */
  for(let m=2;m<=9;m++){
    const mx=Math.max(x(0),LBL+dayOf(`2026-${String(m+1).padStart(2,'0')}-01`)/7*cw);
    const nx=LBL+dayOf(`2026-${String(m+2).padStart(2,'0')}-01`)/7*cw;
    if(mx>x(0)) s+=`<line x1="${mx}" x2="${mx}" y1="${AX-20}" y2="${H}" stroke="var(--rule)" stroke-width="1"/>`;
    if(Math.min(nx,W-PADR)-mx>44) s+=`<text class="t-mon" x="${mx+5}" y="${AX-24}">${MONTHS_LONG[m]}</text>`;
  }
  WEEKS.forEach((wk,w)=>{
    if(w%2===0) s+=`<text class="t-wk" x="${x(w)+cw/2}" y="${AX-7}" text-anchor="middle">${new Date(wk+'T00:00:00').getDate()}</text>`;
  });
  s+=`<line x1="${LBL}" x2="${W-PADR}" y1="${AX}" y2="${AX}" stroke="var(--rule)"/>`;
  /* dry rows */
  const kindName=k=>curKinds()[k]?curKinds()[k].label:k;
  rows.forEach(r=>{
    if(r.grp){ lab+=`<text class="t-grp" x="0" y="${r.y+GH-5}">${esc(r.grp.name)}</text>`; return; }
    const p=r.p, cy=r.y+RH/2;
    s+=`<g class="row" data-p="${p.id}"><rect class="row-bg" x="0" y="${r.y}" width="${W-PADR}" height="${RH}"/>`;
    const nm=esc(pinned||p.short.length>24?p.abbr:p.short);
    lab+=`<text class="t-lab" x="10" y="${cy+4.2}">${nm}</text>`;
    lab+=`<circle cx="3" cy="${cy}" r="3" style="fill:${p.cv}"/>`;
    s+=`<line x1="${LBL}" x2="${W-PADR}" y1="${cy}" y2="${cy}" stroke="var(--rule-2)"/>`;
    ENTRIES.forEach((e,i)=>{
      if(e.p!==p.id) return;
      const cx=x(e.w)+1, cwid=cw-2, top=cy-CH/2;
      if(e.k==='plan'){
        s+=`<rect class="cell" data-i="${i}" data-p="${p.id}" x="${cx+.75}" y="${top+.75}" width="${cwid-1.5}" height="${CH-1.5}" rx="3" fill="var(--panel)" style="stroke:${p.cv}" stroke-width="1.5" stroke-dasharray="3 2.5"/>`;
        return;
      }
      const op=[0,.34,.6,.9][e.h]||.34;
      s+=`<rect class="cell" data-i="${i}" data-p="${p.id}" x="${cx}" y="${top}" width="${cwid}" height="${CH}" rx="3" style="fill:${p.cv}" fill-opacity="${op}"/>`;
      if(e.k==='milestone') s+=`<path pointer-events="none" transform="translate(${cx+cwid/2} ${cy}) scale(.62)" d="M0 -8 2.3 -2.7 8 -2.2 3.7 1.6 5 7.2 0 4.2 -5 7.2 -3.7 1.6 -8 -2.2 -2.3 -2.7Z" fill="#fff"/>`;
      else if(e.k==='end') s+=`<rect pointer-events="none" x="${cx+cwid/2-3}" y="${cy-3}" width="6" height="6" fill="#fff"/>`;
      else if(e.k==='start') s+=`<circle pointer-events="none" cx="${cx+cwid/2}" cy="${cy}" r="2.6" fill="none" stroke="#fff" stroke-width="1.5"/>`;
    });
    s+=`</g>`;
  });
  /* links between dry pipelines */
  LINKS.forEach(b=>{
    const r1=rowOf[b.frm], r2=rowOf[b.to]; if(!r1||!r2) return;
    const x1=x(b.fw)+cw/2, x2=x(b.tw)+cw/2, y1=r1.y+RH/2, y2=r2.y+RH/2;
    const dx=Math.max(14,Math.abs(y2-y1)*.25);
    s+=`<path class="x-line" data-p="${b.frm} ${b.to}" d="M${x1} ${y1} C${x1-dx} ${(y1+y2)/2}, ${x2-dx} ${(y1+y2)/2}, ${x2} ${y2}" stroke="var(--ink-4)" stroke-width="1.3" opacity=".55"/>`;
  });
  /* the wet lab */
  s+=`<line x1="0" x2="${W-PADR}" y1="${wetTop-10}" y2="${wetTop-10}" stroke="var(--rule)"/>`;
  lab+=`<text class="t-grp t-wet" x="0" y="${wetTop+GH-5}">Wet Lab</text>`;
  wetRows.forEach(({t,y:ry})=>{
    const cy=ry+WRH/2;
    s+=`<g class="row" data-p="wet"><rect class="row-bg" x="0" y="${ry}" width="${W-PADR}" height="${WRH}"/>`;
    lab+=`<text class="t-lab" x="10" y="${cy+4}" style="font-size:11.5px;fill:var(--ink-3)">${esc(pinned&&t.name.length>14?t.name.split(' ')[0]:t.name)}</text>`;
    s+=`<line x1="${LBL}" x2="${W-PADR}" y1="${cy}" y2="${cy}" stroke="var(--rule-2)"/>`;
    (t.spans||[]).forEach(([a,b,kind])=>{
      const w1=Math.max(0,wOf(a)), w2=Math.min(NW-1,wOf(b));
      for(let w=w1;w<=w2;w++){
        const cx=x(w)+1, cwid=cw-2;
        if(kind==='plan') s+=`<rect class="cell" data-wet="${esc(t.id)}" data-w="${w}" data-kind="plan" x="${cx+.5}" y="${cy-WCH/2+.5}" width="${cwid-1}" height="${WCH-1}" rx="2" fill="var(--panel)" stroke="var(--wet)" stroke-width="1" stroke-dasharray="2.5 2"/>`;
        else s+=`<rect class="cell" data-wet="${esc(t.id)}" data-w="${w}" data-kind="${kind}" x="${cx}" y="${cy-WCH/2}" width="${cwid}" height="${WCH}" rx="2" fill="var(--wet)" fill-opacity="${kind==='light'?.22:.55}"/>`;
      }
    });
    s+=`</g>`;
  });
  /* crossings: down to the wet lab, and back where the answer changed a pipeline */
  HANDOFFS.forEach((hf,j)=>{
    const r=rowOf[hf.p]; if(!r) return;
    const hx=x(hf.w)+cw/2, y1=r.y+RH/2+CH/2+1, y2=wetTop-4;
    const p=P_BY_ID[hf.p];
    s+=`<path class="x-line" data-p="${hf.p} wet" d="M${hx} ${y1} V${y2-6}" style="stroke:${p.cv}" stroke-width="1.6" stroke-dasharray="4 3"/>`;
    s+=`<path class="x-line" data-p="${hf.p} wet" d="M${hx-4} ${y2-8} L${hx} ${y2-2} L${hx+4} ${y2-8}" fill="none" style="stroke:${p.cv}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    s+=`<circle class="x-dot" data-hf="${j}" data-p="${hf.p} wet" cx="${hx}" cy="${wetTop+4}" r="5.5" fill="var(--wet)" stroke="var(--panel)" stroke-width="2"/>`;
    const rt=hf.ret;
    if(rt&&rt.to&&rowOf[rt.to]){
      const rx=x(rt.w)+cw/2+(rt.w===hf.w?6:0), ry=rowOf[rt.to].y+RH/2+CH/2+2;
      /* along the wet lab's edge to the week it came back, then up */
      const by=wetTop+4, r6=Math.min(6,Math.abs(rx-hx)/2);
      s+=`<path class="x-line" data-p="${rt.to} wet" d="M${hx+5.5} ${by} H${rx-r6} Q${rx} ${by} ${rx} ${by-r6} V${ry+6}" stroke="var(--wet)" stroke-width="1.7" stroke-dasharray="1.5 3.5" stroke-linecap="round"/>`;
      s+=`<path class="x-line" data-p="${rt.to} wet" d="M${rx-4} ${ry+7} L${rx} ${ry+1} L${rx+4} ${ry+7}" fill="none" stroke="var(--wet)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  });
  /* today and the freeze */
  s+=`<line x1="${nowX}" x2="${nowX}" y1="${AX-4}" y2="${H}" stroke="var(--accent)" stroke-width="2"/>`;
  s+=`<text class="t-flag" x="${nowX-6}" y="12" text-anchor="end" style="fill:var(--accent-ink)">Today, ${fmt(TODAY)}</text>`;
  s+=`<line x1="${nowX}" x2="${nowX}" y1="2" y2="${AX-4}" stroke="var(--accent)" stroke-width="2"/>`;
  s+=`<line x1="${frzX}" x2="${frzX}" y1="${AX-4}" y2="${H}" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>`;
  s+=`<line x1="${frzX}" x2="${frzX}" y1="2" y2="${AX-4}" stroke="var(--red)" stroke-width="2" stroke-dasharray="5 3"/>`;
  /* events (a symposium, a forum): a diamond on the axis */
  (NB.events||[]).forEach((ev,k)=>{
    const ex=LBL+dayOf(ev.date)/7*cw;
    s+=`<line x1="${ex}" x2="${ex}" y1="${AX}" y2="${dryBottom}" stroke="var(--ink-3)" stroke-width="1" stroke-dasharray="1 3" opacity=".7" pointer-events="none"/>`;
    s+=`<path class="x-ev" data-ev="${k}" transform="translate(${ex} ${AX})" d="M0 -6 6 0 0 6 -6 0Z" fill="var(--ink)" stroke="var(--panel)" stroke-width="1.5"/>`;
  });
  const close=frzX-nowX<130;
  s+=`<text class="t-flag" x="${frzX+6}" y="${close?28:12}" text-anchor="${frzX+110>W?'end':'start'}" dx="${frzX+110>W?-12:0}" style="fill:var(--red-ink)">Freeze, ${fmt(FREEZE)}</text>`;
  tlScroll.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Season timeline: ${PIPES.length} dry lab pipelines by week from ${fmtLong(WEEKS[0])} to ${fmtLong(WEEKS[NW-1])}, with ${HANDOFFS.length} crossings to the wet lab.">
    <defs><pattern id="tlhatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--accent)" fill-opacity=".025"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--accent)" stroke-opacity=".07" stroke-width="2"/></pattern></defs>${s}${pinned?'':lab}</svg>`;
  let pin=tlBox.querySelector('.tl__labels');
  if(pinned){
    if(!pin){ pin=document.createElement('div'); pin.className='tl__labels'; tlBox.appendChild(pin); }
    pin.innerHTML=`<svg width="${LBL}" height="${H}" viewBox="0 0 ${LBL} ${H}" aria-hidden="true">${lab}</svg>`;
  }else if(pin) pin.remove();
  if(tlScroll.scrollWidth>tlScroll.clientWidth) tlScroll.scrollLeft=tlScroll.scrollWidth;

  const key=document.getElementById('tlkey');
  key.innerHTML=`
    <span><svg width="46" height="12" aria-hidden="true"><rect x="0" y="0" width="14" height="12" rx="3" fill="var(--ink-3)" fill-opacity=".34"/><rect x="16" y="0" width="14" height="12" rx="3" fill="var(--ink-3)" fill-opacity=".6"/><rect x="32" y="0" width="14" height="12" rx="3" fill="var(--ink-3)" fill-opacity=".9"/></svg>A lighter to a heavier week</span>
    <span><svg width="14" height="12" aria-hidden="true"><rect width="14" height="12" rx="3" fill="var(--ink-3)" fill-opacity=".9"/><path transform="translate(7 6) scale(.55)" d="M0 -8 2.3 -2.7 8 -2.2 3.7 1.6 5 7.2 0 4.2 -5 7.2 -3.7 1.6 -8 -2.2 -2.3 -2.7Z" fill="#fff"/></svg>Milestone</span>
    <span><svg width="14" height="12" aria-hidden="true"><rect x=".75" y=".75" width="12.5" height="10.5" rx="3" fill="none" stroke="var(--ink-3)" stroke-width="1.5" stroke-dasharray="3 2.5"/></svg>Planned</span>
    <span><svg width="22" height="12" aria-hidden="true"><path d="M2 6H20" stroke="var(--ink-3)" stroke-width="1.6" stroke-dasharray="4 3"/></svg>Sent to the wet lab</span>
    <span><svg width="22" height="12" aria-hidden="true"><path d="M2 6H20" stroke="var(--wet)" stroke-width="1.8" stroke-dasharray="1.5 3.5" stroke-linecap="round"/></svg>Came back and changed a pipeline</span>
    <span><svg width="12" height="12" aria-hidden="true"><path d="M6 1 11 6 6 11 1 6Z" fill="var(--ink)"/></svg>Event</span>
    <span><svg width="10" height="12" aria-hidden="true"><path d="M5 0V12" stroke="var(--red)" stroke-width="2" stroke-dasharray="4 2"/></svg>Wiki freeze</span>`;
}
(function(){
  if(!tlBox) return;
  const tip=(html,el,tc)=>{
    const b=tlBox.getBoundingClientRect(), r=el.getBoundingClientRect();
    tlTip.innerHTML=html; tlTip.style.setProperty('--tc',tc||'#fff');
    let left=r.left-b.left+r.width/2;
    const half=Math.min(150,tlTip.offsetWidth/2);
    left=Math.max(half+4,Math.min(left,b.width-half-4));
    tlTip.style.left=left+'px'; tlTip.style.top=(r.top-b.top)+'px';
    tlTip.classList.add('on');
  };
  const focusOn=ps=>{
    const svg=tlScroll.querySelector('svg'); if(!svg) return;
    tlBox.classList.toggle('is-focus',!!ps);
    svg.querySelectorAll('.is-hot').forEach(x=>x.classList.remove('is-hot'));
    if(!ps) return;
    svg.querySelectorAll('[data-p]').forEach(x=>{ if(x.dataset.p.split(' ').some(p=>ps.includes(p))) x.classList.add('is-hot'); });
    svg.querySelectorAll('.cell[data-wet]').forEach(x=>{ if(ps.includes('wet')) x.classList.add('is-hot'); });
  };
  tlScroll.addEventListener('mouseover',e=>{
    const ev=e.target.closest('.x-ev');
    if(ev){ const E=NB.events[+ev.dataset.ev]; tip(`<b>Event, ${fmtLong(E.date)}</b>${esc(E.t)}`,ev,'#fff'); return; }
    const c=e.target.closest('.cell,.x-dot'), row=e.target.closest('g.row');
    if(row) focusOn([row.dataset.p]);
    if(!c){ tlTip.classList.remove('on'); return; }
    if(c.dataset.i!==undefined){
      const en=ENTRIES[+c.dataset.i], p=P_BY_ID[en.p];
      tip(`<b>${esc(p.short)}, week of ${fmt(WEEKS[en.w])}</b>${en.t}<small>${kindName(en.k)}</small>`,c,p.ct);
    }else if(c.dataset.hf!==undefined){
      const hf=HANDOFFS[+c.dataset.hf];
      tip(`<b>Sent to the wet lab, ${fmt(hf.date)}</b>${esc(hf.t.charAt(0).toUpperCase()+hf.t.slice(1))}<small>${esc(hf.ret.state)}</small>`,c,'#9fd3f0');
    }else{
      const t=WET.find(t=>t.id===c.dataset.wet), w=+c.dataset.w;
      const ev=(t.events||[]).filter(ev=>wOf(ev.date)===w).map(ev=>`${fmt(ev.date)}: ${esc(ev.t)}`).join('<br>');
      tip(`<b>Wet lab: ${esc(t.name)}</b>${ev||`Week of ${fmt(WEEKS[w])}`}<small>${c.dataset.kind==='plan'?'Planned':c.dataset.kind==='light'?'Lighter activity':'Main period'}</small>`,c,'#9fd3f0');
    }
  });
  tlScroll.addEventListener('mouseleave',()=>{ tlTip.classList.remove('on'); focusOn(null); });
  tlScroll.addEventListener('scroll',()=>tlTip.classList.remove('on'),{passive:true});
  tlScroll.addEventListener('click',e=>{
    const ev=e.target.closest('.x-ev');
    if(ev){ tlTip.classList.remove('on'); setView('record'); return revealRecord(NB.events[+ev.dataset.ev].id); }
    const c=e.target.closest('.cell[data-i],.x-dot'); if(!c) return;
    tlTip.classList.remove('on');
    if(c.dataset.hf!==undefined) return goTo(grid.querySelector(`.node[data-hf="${c.dataset.hf}"]`));
    const en=ENTRIES[+c.dataset.i];
    goTo(grid.querySelector(`.node[data-i="${c.dataset.i}"]`)||grid.querySelector(`.railrow[data-wk="${en.w}"]`));
  });
})();
function kindName(k){ return (curKinds()[k]||{label:k}).label; }

/* ==================================================================
   15. GO
   ================================================================== */
const controls=document.getElementById('controls');
controls.hidden=false;
let startSkin='clean';
try{ const st=localStorage.getItem('drylab-style'); if(SKINS.some(k=>k.id===st)) startSkin=st; }catch(e){}
FX.setAttribute('data-skin',startSkin);
skinsEl.querySelectorAll('[data-skin]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.skin===startSkin)));
buildLegend();
indexRecord();
drawTimeline();

/* The toolbar stays under the site nav while the views scroll past; the
   record's month index then sits under the toolbar. */
(function(){
  const wide=matchMedia('(min-width:1000px)');
  const sync=()=>{
    const navh=parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'))||68;
    const stuck=wide.matches && controls.getBoundingClientRect().top<=navh+1;
    controls.classList.toggle('is-stuck',stuck);
    FX.style.setProperty('--tbh', wide.matches ? controls.offsetHeight+'px' : '0px');
  };
  addEventListener('scroll',sync,{passive:true});
  addEventListener('resize',sync);
  sync();
})();

/* The written record opens first. #photos and #board open those views;
   a mark's own address (#lpa-w26, #w12, #wet-3) opens it on the board. */
const hash=decodeURIComponent(location.hash.slice(1));
const n=hash&&nodeFor(hash);
if(hash==='photos') setView('gallery');
else if(hash==='board'||n){
  setView('board');
  document.getElementById('board').scrollTop=0;
  if(n) goTo(n);
}else{ setView('record'); if(hash&&hash!=='record') revealRecord(hash); }
let rt, lastW=innerWidth;
addEventListener('resize',()=>{ clearTimeout(rt); rt=setTimeout(()=>{
  if(view==='board'){ build(); applyFilter(); }
  if(innerWidth!==lastW){ lastW=innerWidth; drawTimeline(); }
  refollow();
},180); });
})();
