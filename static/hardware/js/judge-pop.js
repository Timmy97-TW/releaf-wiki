/* "For judges" pop-up on the four component pages (20 Oct 2026, prototype).
   The owner: a button "not too obvious but obvious enough", which opens a glassy panel with the four Best Hardware
   criteria, a line each and links to the evidence, saying up front that the pages are long. One file builds the
   button and the panel on every page (static/hardware/css/judge-pop.css); links to the page the reader is on stay on it. */
(function () {
  "use strict";
  /* iGEM: the hardware pages sit at flat addresses, hardware and hardware-<instrument> */
  var here = (location.pathname.match(/\/hardware-(bioreactor|photometer|diopal|hydroponics)(?:[\/?#]|$)/) || [])[1] || "hub";
  var up = "";
  function u(page, id) {
    if (page === here) return "#" + id;
    return (page === "hub" ? "hardware" : "hardware-" + page) + "#" + id;
  }
  var C = { bioreactor: "#5aa9ff", photometer: "#ffa23d", diopal: "#3ddc8b", hydroponics: "#b18cff", hub: "#8f9aa6" };
  var NAME = { bioreactor: "Bioreactor", photometer: "Photometer", diopal: "LPA", hydroponics: "Hydroponics", hub: "Hardware" };
  var ITEMS = [
    { t: "The need", a: "We make an engineered protectant on the farm without releasing the bacteria. The cells stay sealed behind a 0.2&nbsp;&micro;m membrane.",
      l: [["bioreactor", "sec21", "Why a bioreactor"], ["photometer", "overview", "Why read OD600 in line"]] },
    { t: "User testing", a: "Three outside builders built the Slim photometer from our guide, and what they found changed the guide. Expert reviews reshaped the bioreactor.",
      l: [["photometer", "handover", "Three outside builders"], ["bioreactor", "feedback", "Expert reviews"]] },
    { t: "Proof of concept", a: "The protectant reached the output side at the culture&rsquo;s level, and the photometer logged 434&nbsp;h without a sample.",
      l: [["bioreactor", "result-1", "Lumen and shell read the same"], ["photometer", "cyc4", "The 434-hour run"], ["diopal", "first-run", "The LPA&rsquo;s first run"]] },
    { t: "Reproduction", a: "STL files and costed materials lists for all four instruments, and step&#8209;by&#8209;step guides for three.",
      l: [["hub", "guides", "All guides and manuals"], ["bioreactor", "reproduction", "Bioreactor"], ["photometer", "reproduction", "Photometers"], ["diopal", "reproduction", "LPA"], ["hydroponics", "reproduction", "Hydroponics"]] }
  ];

  // the button: one the page already carries ([data-judge-pop], on the hub's instrument section), else a floating pill
  var btn = document.querySelector("[data-judge-pop]"), own = !btn;
  if (own) {
    btn = document.createElement("button");
    btn.type = "button"; btn.className = "jp-btn"; btn.innerHTML = '<i aria-hidden="true">&#9670;</i>For judges';
  }
  btn.setAttribute("aria-haspopup", "dialog");

  var dlg = document.createElement("dialog");
  dlg.className = "jp"; dlg.setAttribute("aria-labelledby", "jp-t");
  dlg.innerHTML =
    '<div class="jp-in">' +
    '<button type="button" class="jp-x" aria-label="Close">&times;</button>' +
    '<p class="jp-k">For judges</p>' +
    '<h2 class="jp-t" id="jp-t">Our hardware at a glance</h2>' +
    '<p class="jp-note">These pages are long, so this is the short version. Each judging criterion gets our ' +
    'answer in one line and a link to where you can check it.</p>' +
    '<ol class="jp-list">' + ITEMS.map(function (it, i) {
      return '<li class="jp-c"><span class="jp-n">' + (i + 1) + '</span><div><h3>' + it.t + '</h3><p>' + it.a + '</p><ul>' +
        it.l.map(function (x) {
          var href = u(x[0], x[1]);
          return '<li><a href="' + href + '" style="--c:' + C[x[0]] + '"><span class="jp-pg">' + NAME[x[0]] + '</span>' + x[2] + '</a></li>';
        }).join("") + '</ul></div></li>';
    }).join("") + '</ol></div>';

  if (own) {
    // (21 Oct 2026, the owner: "add the 'for judges' button on bottom right of the hardware pages after the animation")
    // On an instrument page the button waits in the bottom-right corner until the hero animation has been scrolled past.
    document.body.appendChild(btn);
    var story = document.getElementById("story");
    if (story) {
      btn.classList.add("jp-wait");
      // (21 Oct 2026, the owner: "when the animation plays remove the judges button") It also steps aside while any
      // other animation fills much of the screen: the Slim clip, the explainers, a playing video.
      var ANIM = "#story, .sp-clip, .xp-stage:not(.cm-stage), .hv-frame, video";
      var tick = 0;
      var check = function () {
        tick = 0;
        var vh = window.innerHeight, past = story.getBoundingClientRect().bottom < 0, busy = false;
        if (past) {
          var els = document.querySelectorAll(ANIM);
          for (var i = 0; i < els.length && !busy; i++) {
            var r = els[i].getBoundingClientRect();
            if (!r.width || !r.height) continue;
            var seen = Math.min(r.bottom, vh) - Math.max(r.top, 0);
            if (seen > vh * 0.4) busy = true;
          }
        }
        btn.classList.toggle("is-on", past && !busy);
      };
      var soon = function () { if (!tick) tick = requestAnimationFrame(check); };
      window.addEventListener("scroll", soon, { passive: true });
      window.addEventListener("resize", soon);
      setInterval(check, 800);                 // clips that grow or start on their own, without a scroll
      check();
    }
  }
  document.body.appendChild(dlg);

  function open() { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", ""); document.documentElement.classList.add("jp-open"); }
  function close() { if (dlg.close) dlg.close(); else dlg.removeAttribute("open"); }
  dlg.addEventListener("close", function () { document.documentElement.classList.remove("jp-open"); btn.focus({ preventScroll: true }); });
  btn.addEventListener("click", open);
  dlg.querySelector(".jp-x").addEventListener("click", close);
  dlg.addEventListener("click", function (e) {
    if (e.target === dlg) { close(); return; }                       // a click on the backdrop
    var a = e.target.closest("a[href^='#']");
    if (a) close();                                                  // a link on this page: close, then the page jumps
  });
})();
