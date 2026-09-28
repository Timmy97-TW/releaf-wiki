/* Education page only: previous / next buttons for the student-feedback slider.
   The track is a plain scroll-snap list, so it works by swipe or scroll without this. */
(function () {
  document.querySelectorAll('.fbslider').forEach(function (slider) {
    var track = slider.querySelector('.fbtrack');
    var prev = slider.querySelector('[data-dir="prev"]');
    var next = slider.querySelector('[data-dir="next"]');
    if (!track || !prev || !next) return;

    function step() {
      var card = track.querySelector('li');
      if (!card) return track.clientWidth;
      var gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      return card.getBoundingClientRect().width + gap;
    }
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
