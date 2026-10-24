/* What a reader still sees in English after i18n.js has run.
 *
 * Paste this into the browser console on a page in Chinese, or load it over
 * every page from one tab (an iframe each, same origin), and it gives back
 * the strings the runtime looked for and did not find -- which is the only
 * honest answer to "what is left to translate", because most of what is left
 * is copy a page script writes and tools/i18n/extract.py cannot see.
 *
 *   window.__harvest(document, await fetch("static/i18n/<page>.zh.json")
 *                                     .then(r => r.json()))
 *
 * The walk below follows static/assets/js/i18n.js: the same CAND / BLOCKY /
 * SKIP sets, the same descent into an element whose whole text is unknown,
 * and the drawings' <title>/<desc> at the end. A string comes back only when
 * its hash is in no dictionary, and a unit that already reads as Chinese is
 * left alone -- its Latin bits are names and units the translator kept.
 */
window.__harvest = (doc, DICT) => {
  var FNV_PRIME = BigInt("0x100000001b3"), FNV_MASK = (1n << 64n) - 1n;
  function hash(s) {
    var h = BigInt("0xcbf29ce484222325");
    var bytes = new TextEncoder().encode(s);
    for (var i = 0; i < bytes.length; i++) h = (h ^ BigInt(bytes[i])) * FNV_PRIME & FNV_MASK;
    return h.toString(16).padStart(16, "0");
  }
  var B = {}, A = {};
  for (var k in (DICT.b || {})) B[k.split(":")[0]] = 1;
  for (var k in (DICT.a || {})) A[k.split(":")[0]] = 1;
  function known(t) { return B[hash(t)] === 1; }
  function knownAttr(name, t) { return A[name + "|" + hash(t)] === 1; }
  var SKIP = {SCRIPT:1,STYLE:1,NOSCRIPT:1,TEMPLATE:1,CODE:1,PRE:1,KBD:1,SAMP:1,VAR:1,SVG:1,CANVAS:1,IFRAME:1,TITLE:1,META:1,LINK:1};
  var CAND = {P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,LI:1,DT:1,DD:1,FIGCAPTION:1,CAPTION:1,TH:1,TD:1,BLOCKQUOTE:1,SUMMARY:1,BUTTON:1,LABEL:1,LEGEND:1,OPTION:1,A:1,SPAN:1,STRONG:1,EM:1,B:1,I:1,SMALL:1,ABBR:1,TIME:1,CITE:1,Q:1,DIV:1,ADDRESS:1,OUTPUT:1,MARK:1};
  var BLOCKY = {HTML:1,BODY:1,HEAD:1,DIV:1,SECTION:1,ARTICLE:1,MAIN:1,HEADER:1,FOOTER:1,ASIDE:1,NAV:1,UL:1,OL:1,DL:1,TABLE:1,THEAD:1,TBODY:1,TFOOT:1,TR:1,FIGURE:1,DETAILS:1,FORM:1,FIELDSET:1,PICTURE:1,VIDEO:1,AUDIO:1,MAP:1,COLGROUP:1,P:1,LI:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,FIGCAPTION:1,CAPTION:1,TH:1,TD:1,DT:1,DD:1,BLOCKQUOTE:1,SUMMARY:1,BUTTON:1,LABEL:1,LEGEND:1,OPTION:1,ADDRESS:1};
  var ART = ".sec__no, .toc__no, a[href^='#cite-']";
  var HAN = /[㐀-鿿豈-﫿]/;
  function tagOf(e){return e.tagName.toUpperCase();}
  function textOf(e){var o="",k=e.childNodes;for(var i=0;i<k.length;i++){var c=k[i];
    if(c.nodeType===3){o+=c.nodeValue;continue;}if(c.nodeType!==1)continue;
    if(SKIP[tagOf(c)])continue;if(c.matches&&c.matches(ART))continue;o+=textOf(c);}return o;}
  function blockInside(e){var k=e.children;for(var i=0;i<k.length;i++){var c=k[i],t=tagOf(c);
    if(c.matches&&c.matches(".math"))continue;if(SKIP[t]||BLOCKY[t])return true;if(blockInside(c))return true;}return false;}
  function norm(s){return s.replace(/[\s   ​]+/g," ").trim();}
  function want(t){return t.length>1 && /[A-Za-z]{2}/.test(t) && !HAN.test(t) && !/^(?:https?:\/\/|\.?\/)/.test(t);}
  var hits = [];
  function add(t, el){ hits.push({t:t, w:(el.tagName||"#text").toLowerCase()+(typeof el.className==="string"&&el.className?"."+el.className.trim().split(/\s+/).slice(0,2).join("."):"")}); }
  var OFF = ".refs, .bib, #site-nav, .sitenav, .sitenav-skip, .katex, .skip";
  (function walk(node){
    var k = node.childNodes;
    for (var i=0;i<k.length;i++){
      var c = k[i];
      if (c.nodeType===3){ var t=norm(c.nodeValue); if(want(t)) add(t, c.parentElement); continue; }
      if (c.nodeType!==1) continue;
      var T = tagOf(c);
      for (var A of ["alt","title","aria-label","placeholder","data-toc","data-label","data-cap","data-name","data-title","data-role","data-en"]) {
        if (c.hasAttribute && c.hasAttribute(A)) {
          var v = norm(c.getAttribute(A));
          if (want(v) && !knownAttr(A, v) && !known(v)) hits.push({t:v, w:"@" + A});
        }
      }
      if (c.matches && c.matches(".math")) continue;
      if (SKIP[T]) { if (T==="SVG") walk(c); continue; }
      if (c.matches && c.matches(OFF)) continue;
      if (c.matches && c.matches(ART)) continue;
      if (CAND[T] && !blockInside(c)) {
        var bt = norm(textOf(c));
        /* this one reads as Chinese already: its Latin bits are names and
           units the translator kept, not strings anybody missed */
        if (HAN.test(bt)) continue;
        if (want(bt)) {
          if (known(bt)) continue;
          /* the dictionary does not know this element's text. i18n.js goes
             inside when that happens, so do the same: a script has often
             glued two labels it DOES know into one element. */
          if (c.children.length) { walk(c); continue; }
          add(bt, c); continue;
        }
      }
      walk(c);
    }
  })(doc.body);
  /* the drawings' accessible names, which the walk above never reaches */
  var names = doc.querySelectorAll("svg title, svg desc");
  for (var i = 0; i < names.length; i++) {
    var nt = norm(names[i].textContent);
    if (want(nt) && !known(nt)) hits.push({ t: nt, w: "svg:name" });
  }
  var seen = {}, out = [];
  for (var h of hits) { if (seen[h.t]) continue; seen[h.t]=1; out.push(h.w+"\t"+h.t); }
  return out;
};
