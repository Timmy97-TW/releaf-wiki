/* The technical map's reading panel.
   Twelve blocks in the drawing, twelve cards in the panel beside it, paired by
   data-block. Whichever block the reader's pointer or keyboard is on has its
   card up; when they leave, the panel settles back on the block named in
   data-default. The cards are all in the HTML, so with no JavaScript the
   default one still reads. */
(function () {
  'use strict';
  var fig = document.querySelector('.tmap__grid');
  if (!fig) return;
  var panel = fig.querySelector('.tmapinfo');
  var nodes = fig.querySelectorAll('.tmapfig__node[data-block]');
  if (!panel || !nodes.length) return;

  var cards = {}, current = null, settleT = 0;
  panel.querySelectorAll('.tmapinfo__card').forEach(function (c) { cards[c.getAttribute('data-block')] = c; });
  var home = panel.getAttribute('data-default');

  function show(slug) {
    if (slug === current || !cards[slug]) return;
    if (current) { cards[current].classList.remove('is-on'); }
    cards[slug].classList.add('is-on');
    nodes.forEach(function (n) { n.classList.toggle('is-on', n.getAttribute('data-block') === slug); });
    current = slug;
  }
  function settle() { clearTimeout(settleT); settleT = setTimeout(function () { show(home); }, 90); }
  function hold(slug) { clearTimeout(settleT); show(slug); }

  nodes.forEach(function (n) {
    var slug = n.getAttribute('data-block');
    n.addEventListener('pointerenter', function () { hold(slug); });
    n.addEventListener('pointerleave', settle);
  });
  /* focusin/focusout bubble, which focus/blur on an SVG <a> do not reliably do */
  function blockOf(el) {
    while (el && el !== fig) {
      if (el.getAttribute && el.getAttribute('data-block')) return el.getAttribute('data-block');
      el = el.parentNode;
    }
    return null;
  }
  fig.addEventListener('focusin', function (e) { var k = blockOf(e.target); if (k) hold(k); });
  fig.addEventListener('focusout', settle);
  panel.addEventListener('pointerenter', function () { clearTimeout(settleT); });
  panel.addEventListener('pointerleave', settle);

  current = home;
  nodes.forEach(function (n) { n.classList.toggle('is-on', n.getAttribute('data-block') === home); });
}());
