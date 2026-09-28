/* =============================================================================
   ReLeaf: LaTeX maths
   -----------------------------------------------------------------------------
   Renders LaTeX with the KaTeX copy vendored in assets/vendor/katex (nothing is
   fetched from another host). Write maths straight into the HTML:

     inline    \( \mu = \mu_{max} \frac{S}{K_s + S} \)
     display   \[ \frac{dX}{dt} = \mu X - D X \]      or  $$ ... $$

   A page opts in with, in <head>:
     <link rel="stylesheet" href="../assets/vendor/katex/katex.min.css" />
   and before </body>:
     <script defer src="../assets/vendor/katex/katex.min.js"></script>
     <script defer src="../assets/vendor/katex/contrib/mhchem.min.js"></script>
     <script defer src="../assets/js/math.js"></script>
   (adjust ../ to the page's depth). \ce{NaCl} works through mhchem.
   ========================================================================== */
(function () {
  "use strict";
  function run() {
    if (!window.katex) return;
    var opts = { throwOnError: false, strict: "ignore", trust: false };
    var skip = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, PRE: 1, CODE: 1, NOSCRIPT: 1 };
    var re = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)/g;
    var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== document.body; p = p.parentNode) {
          if (skip[p.nodeName] || (p.classList && (p.classList.contains("katex") || p.classList.contains("no-math")))) return NodeFilter.FILTER_REJECT;
        }
        return /\$\$|\\\[|\\\(/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.nodeValue, frag = document.createDocumentFragment(), last = 0, m;
      re.lastIndex = 0;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var display = m[3] === undefined;
        var tex = m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3];
        var el = document.createElement(display ? "div" : "span");
        el.className = display ? "math math--display" : "math";
        try { katex.render(tex, el, Object.assign({ displayMode: display }, opts)); }
        catch (e) { el.textContent = m[0]; }
        frag.appendChild(el);
        last = re.lastIndex;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
