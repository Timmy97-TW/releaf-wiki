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

    /* The forms pass by on their own, left to right, one card every few
       seconds, and start again from the first after the last. They hold
       still while the reader is using the strip, while it is off screen,
       and for anyone who asked for less motion. */
    var calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var busy = false, seen = false;
    function advance() {
      if (busy || !seen || document.hidden) return;
      var max = track.scrollWidth - track.clientWidth - 2;
      if (track.scrollLeft >= max) track.scrollTo({ left: 0, behavior: 'smooth' });
      else track.scrollBy({ left: step(), behavior: 'smooth' });
    }
    if (!calm) {
      ['pointerenter', 'focusin', 'touchstart'].forEach(function (e) { slider.addEventListener(e, function () { busy = true; }, { passive: true }); });
      ['pointerleave', 'focusout', 'touchend'].forEach(function (e) { slider.addEventListener(e, function () { busy = false; }, { passive: true }); });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { seen = es[0].isIntersecting; }, { threshold: 0.35 }).observe(slider);
      } else { seen = true; }
      setInterval(advance, 3200);
    }
    window.addEventListener('resize', update);
    update();
  });
})();
