// Interactive part picker.
//
// Point at any component in the live 3D scene and it lights up, a card names
// it, and its bill-of-materials row highlights in the table below. Click to
// pin that selection; the table scrolls to the row. The part list beside the
// stage is the same thing driven from the other end, so the diagram and the
// text always agree — and it works by keyboard, which a hover-only 3D scene
// would not.
//
// Raycasting deliberately ignores the stage, the flow ribbons and the glows:
// they are dressing, and letting the reader "select the floor" is noise.
(function () {
  if (typeof THREE === "undefined" || typeof BIO_COMPONENTS === "undefined") return;

  const canvas = document.getElementById("gl");
  const host = document.querySelector(".stage");
  if (!canvas || !host) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- wait for the hero to finish loading ---------- */
  let scene = null, camera = null;
  const boot = setInterval(function () {
    if (!window.__bioHero || !window.__bioHero.isReady()) return;
    if (!window.__bioHero.scene || !window.__bioHero.camera) return;
    clearInterval(boot);
    scene = window.__bioHero.scene;
    camera = window.__bioHero.camera;
    init();
  }, 200);
  setTimeout(function () { clearInterval(boot); }, 25000);

  /* ---------- state ---------- */
  const byMesh = new Map();          // mesh name -> component
  const comps = new Map();           // id -> { def, meshes[], baseEmissive[] }
  let hovered = null, pinned = null;

  const ACCENT = { lumen: 0xff8a2e, shell: 0x3ddc8b, both: 0x5aa9ff };

  function init() {
    BIO_COMPONENTS.forEach(function (def) {
      const meshes = [];
      def.meshes.forEach(function (n) {
        const o = scene.getObjectByName(n);
        if (!o || !o.material) return;
        byMesh.set(n, def.id);
        // record the resting emissive so a highlight can be undone exactly
        const m = o.material;
        meshes.push({
          obj: o, mat: m,
          hex: m.emissive ? m.emissive.getHex() : null,
          ei: m.emissiveIntensity || 0,
        });
      });
      if (meshes.length) comps.set(def.id, { def: def, meshes: meshes });
    });
    buildList();
    bindCanvas();
    bindTable();
    render();
  }

  /* ---------- highlight ---------- */
  function paint(id, strength) {
    const c = comps.get(id);
    if (!c) return;
    const col = ACCENT[c.def.flow] || ACCENT.both;
    c.meshes.forEach(function (m) {
      if (!m.mat.emissive) return;
      if (strength > 0) {
        m.mat.emissive.setHex(col);
        m.mat.emissiveIntensity = m.ei + strength;
      } else {
        if (m.hex !== null) m.mat.emissive.setHex(m.hex);
        m.mat.emissiveIntensity = m.ei;
      }
    });
  }

  function apply() {
    comps.forEach(function (c, id) { paint(id, 0); });
    if (pinned) paint(pinned, 0.42);
    if (hovered && hovered !== pinned) paint(hovered, 0.26);
    // the hero's own loop repaints continuously; nudge it when it is idle
    if (window.__bioHero.redraw) window.__bioHero.redraw();
  }

  /* ---------- the card over the stage ---------- */
  const card = document.createElement("div");
  card.className = "pick-card";
  card.hidden = true;
  host.appendChild(card);

  function showCard(id) {
    const c = comps.get(id);
    if (!c) { card.hidden = true; return; }
    const d = c.def;
    card.className = "pick-card flow-" + d.flow + (pinned === id ? " pinned" : "");
    card.innerHTML =
      '<div class="pick-role">' + d.role + "</div>" +
      "<b>" + d.label + "</b>" +
      "<p>" + d.note + "</p>" +
      (d.href ? '<a class="pick-link" href="' + d.href + '">Full record &#8594;</a>' : "") +
      (pinned === id ? '<button class="pick-clear" type="button">Clear</button>' : "");
    card.hidden = false;
    const clear = card.querySelector(".pick-clear");
    if (clear) clear.addEventListener("click", function (e) {
      e.stopPropagation(); pinned = null; hovered = null; sync();
    });
  }

  /* ---------- the list beside the stage ---------- */
  let listEl = null;
  function buildList() {
    listEl = document.createElement("div");
    listEl.className = "pick-list";
    listEl.setAttribute("aria-label", "Components");
    listEl.innerHTML =
      '<div class="pick-list-head">Components <span>select to inspect</span></div>' +
      BIO_COMPONENTS.filter(function (d) { return comps.has(d.id); }).map(function (d) {
        return '<button type="button" class="pick-item flow-' + d.flow + '" data-id="' + d.id + '">' +
          '<i class="pick-dot"></i><span class="pick-name">' + d.label + "</span>" +
          '<span class="pick-role-sm">' + d.role + "</span></button>";
      }).join("");
    host.parentNode.insertBefore(listEl, host.nextSibling);

    listEl.querySelectorAll(".pick-item").forEach(function (b) {
      const id = b.getAttribute("data-id");
      b.addEventListener("mouseenter", function () { if (!pinned) { hovered = id; sync(); } });
      b.addEventListener("mouseleave", function () { if (!pinned) { hovered = null; sync(); } });
      b.addEventListener("focus", function () { hovered = id; sync(); });
      b.addEventListener("click", function () {
        pinned = pinned === id ? null : id;
        hovered = pinned;
        sync();
        if (pinned) scrollToRow(pinned);
      });
    });
  }

  /* ---------- the bill of materials ---------- */
  let rowFor = new Map();
  function bindTable() {
    const table = document.querySelector("table.bom");
    if (!table || !table.tBodies[0]) return;
    BIO_COMPONENTS.forEach(function (d) {
      if (!d.bom) return;
      Array.prototype.forEach.call(table.tBodies[0].rows, function (r) {
        const first = r.cells[0] ? r.cells[0].textContent.trim() : "";
        // the markup uses non-breaking hyphens; compare on a folded string
        const fold = function (s) { return s.replace(/‑/g, "-").toLowerCase(); };
        if (fold(first) === fold(d.bom)) {
          rowFor.set(d.id, r);
          r.classList.add("bom-linked");
          r.setAttribute("tabindex", "0");
          r.addEventListener("mouseenter", function () { if (!pinned) { hovered = d.id; sync(); } });
          r.addEventListener("mouseleave", function () { if (!pinned) { hovered = null; sync(); } });
          r.addEventListener("focus", function () { hovered = d.id; sync(); });
          r.addEventListener("blur", function () { if (!pinned) { hovered = null; sync(); } });
          r.addEventListener("click", function () {
            pinned = pinned === d.id ? null : d.id; hovered = pinned; sync();
          });
        }
      });
    });
  }

  function scrollToRow(id) {
    const r = rowFor.get(id);
    if (!r) return;
    r.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "center" });
  }

  /* ---------- keep every surface in step ---------- */
  function sync() {
    const active = pinned || hovered;
    apply();
    if (active) showCard(active); else card.hidden = true;
    if (listEl) listEl.querySelectorAll(".pick-item").forEach(function (b) {
      const id = b.getAttribute("data-id");
      b.classList.toggle("is-hover", id === hovered && id !== pinned);
      b.classList.toggle("is-pinned", id === pinned);
      b.setAttribute("aria-pressed", String(id === pinned));
    });
    rowFor.forEach(function (r, id) {
      r.classList.toggle("is-hover", id === hovered && id !== pinned);
      r.classList.toggle("is-pinned", id === pinned);
    });
    canvas.style.cursor = hovered ? "pointer" : "grab";
  }

  /* ---------- raycasting ---------- */
  function bindCanvas() {
    const ray = new THREE.Raycaster();
    const pt = new THREE.Vector2();
    let moved = false, downX = 0, downY = 0;

    function pick(ev) {
      const r = canvas.getBoundingClientRect();
      pt.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
      pt.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(pt, camera);
      const hits = ray.intersectObjects(scene.children, false);
      for (let i = 0; i < hits.length; i++) {
        const n = hits[i].object.name;
        if (n && byMesh.has(n)) return byMesh.get(n);
      }
      return null;
    }

    canvas.addEventListener("pointerdown", function (e) {
      moved = false; downX = e.clientX; downY = e.clientY;
    });
    canvas.addEventListener("pointermove", function (e) {
      if (Math.abs(e.clientX - downX) > 4 || Math.abs(e.clientY - downY) > 4) moved = true;
      if (e.buttons) return;                 // orbiting, not pointing
      const id = pick(e);
      if (id !== hovered && !pinned) { hovered = id; sync(); }
      else if (id !== hovered) { hovered = id; sync(); }
    });
    canvas.addEventListener("pointerleave", function () {
      if (!pinned) { hovered = null; sync(); }
    });
    canvas.addEventListener("click", function (e) {
      if (moved) return;                      // a drag is not a selection
      const id = pick(e);
      pinned = id && pinned !== id ? id : null;
      hovered = pinned || id;
      sync();
      if (pinned) scrollToRow(pinned);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && pinned) { pinned = null; hovered = null; sync(); }
    });
  }

  function render() { sync(); }
})();
