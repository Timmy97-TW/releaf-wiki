// Figure 10 (4.1): pick one part of the wiring and the rest of the drawing steps back. The four buttons and the four
// lead-in paragraphs of 4.1 name the same four things (ground, the LED's transistor, the sensor bus, the supplies), so
// pointing at a paragraph lights its part of the drawing too. A click pins the choice; a second click lets it go.
// Every wire, pin and label in the SVG carries the class of the net(s) it belongs to (n-gnd, n-led, n-bus, n-pwr).
(function () {
  const fig = document.getElementById("fig-wiring");
  const svg = fig && fig.querySelector("svg.wire");
  if (!svg) return;
  const nets = ["gnd", "led", "bus", "pwr"];
  const btns = Array.prototype.slice.call(fig.querySelectorAll(".nets button[data-net]"));
  let pinned = null;

  function show(net) {
    nets.forEach(function (n) { svg.classList.toggle("hl-" + n, n === net); });
    svg.classList.toggle("hl", !!net);
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-net") === pinned));
      b.classList.toggle("on", b.getAttribute("data-net") === net);
    });
  }

  btns.forEach(function (b) {
    const net = b.getAttribute("data-net");
    b.addEventListener("click", function () { pinned = pinned === net ? null : net; show(pinned); });
    b.addEventListener("mouseenter", function () { show(net); });
    b.addEventListener("mouseleave", function () { show(pinned); });
  });

  document.querySelectorAll("#sec41 p[data-net]").forEach(function (p) {
    const net = p.getAttribute("data-net");
    p.addEventListener("mouseenter", function () { show(net); });
    p.addEventListener("mouseleave", function () { show(pinned); });
  });
})();
