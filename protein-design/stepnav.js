/* Protein Design section strip. On a narrow screen the strip scrolls
   sideways and the later steps start out of view, so bring the current step
   into view once, without moving the page. Nothing here is needed to read or
   use the strip; with JavaScript off it still scrolls by hand. */
(function () {
  var cur = document.querySelector('.stepnav a.step[aria-current="page"]');
  if (!cur) return;
  var bar = cur.parentNode;
  if (bar.scrollWidth <= bar.clientWidth) return;
  bar.scrollLeft = Math.max(0, cur.offsetLeft - bar.offsetLeft - (bar.clientWidth - cur.offsetWidth) / 2);
})();
