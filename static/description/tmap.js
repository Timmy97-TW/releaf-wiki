/* The technical map's reading panel.
   Twelve blocks in the drawing, twelve cards in the panel beside it, paired by
   data-block. Whichever block the reader's pointer or keyboard is on has its
   card up, and it stays up when they leave: the panel holds the last block
   they were on rather than snapping back, so a card can be read at leisure.
   The block named in data-default is only the card the page opens on. The
   cards are all in the HTML, so with no JavaScript that one still reads. */
(function () {
  'use strict';
  var fig = document.querySelector('.tmap__grid');
  if (!fig) return;
  var panel = fig.querySelector('.tmapinfo');
  var nodes = fig.querySelectorAll('.tmapfig__node[data-block]');
  if (!panel || !nodes.length) return;

  var cards = {}, current = null;
  panel.querySelectorAll('.tmapinfo__card').forEach(function (c) { cards[c.getAttribute('data-block')] = c; });
  var home = panel.getAttribute('data-default');

  function show(slug) {
    if (slug === current || !cards[slug]) return;
    if (current) { cards[current].classList.remove('is-on'); }
    cards[slug].classList.add('is-on');
    nodes.forEach(function (n) { n.classList.toggle('is-on', n.getAttribute('data-block') === slug); });
    current = slug;
  }
  nodes.forEach(function (n) {
    var slug = n.getAttribute('data-block');
    n.addEventListener('pointerenter', function () { show(slug); });
  });
  /* focusin bubbles, which focus on an SVG <a> does not reliably do */
  function blockOf(el) {
    while (el && el !== fig) {
      if (el.getAttribute && el.getAttribute('data-block')) return el.getAttribute('data-block');
      el = el.parentNode;
    }
    return null;
  }
  fig.addEventListener('focusin', function (e) { var k = blockOf(e.target); if (k) show(k); });

  current = home;
  nodes.forEach(function (n) { n.classList.toggle('is-on', n.getAttribute('data-block') === home); });
}());
