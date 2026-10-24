/* (a) the month tabs: the month of the entry on screen is the one shown; picking a month shows it and turns the
   pages to its first entry. (To apply: these ~30 lines go into hub-pn.js's mark(), which already knows the entry.) */
(function () {
  var sec = document.querySelector(".nx-a");
  if (!sec) return;
  var tabs = [].slice.call(sec.querySelectorAll(".nx-tab")), months = [].slice.call(sec.querySelectorAll(".nx-month"));
  function show(m) {
    tabs.forEach(function (t) { t.setAttribute("aria-selected", t.dataset.m === m ? "true" : "false"); t.tabIndex = t.dataset.m === m ? 0 : -1; });
    months.forEach(function (s) { s.classList.toggle("on", s.dataset.m === m); });
  }
  function current() {
    var a = sec.querySelector(".pn-e[aria-current='true']");
    return a ? a.closest(".nx-month").dataset.m : months[0].dataset.m;
  }
  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      show(t.dataset.m);
      if (sec.classList.contains("pn-noview")) return;
      var first = sec.querySelector("#nx-m" + t.dataset.m + " .pn-e");
      if (first && first.getAttribute("aria-current") !== "true") first.click();
    });
  });
  show(current());
  new MutationObserver(function () { show(current()); })
    .observe(sec.querySelector(".nx-months"), { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
})();
