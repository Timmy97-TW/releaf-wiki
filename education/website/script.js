// script.js

const isChinesePage = window.location.pathname.includes("/zh/");
const assetPrefix = isChinesePage ? "../" : "";

function getAssetPath(path) {
  return `${assetPrefix}${path}`;
}

function showSection(sectionId) {
  const sections = document.querySelectorAll("section");

  sections.forEach(section => {
    section.classList.remove("active");
  });

  const selectedSection = document.getElementById(sectionId);

  if (selectedSection) {
    selectedSection.classList.add("active");
    window.scrollTo(0, 0);
  }
}

/* ══════════════════════════════════════
   INTERACTIVE OUTREACH MAP
══════════════════════════════════════ */

const outreachMapData = {
  luzhou: {
    title: isChinesePage ? "蘆洲國小" : "Luzhou Elementary School",
    image: getAssetPath("images/outreach/luzhou.jpg"),
    alt: "Luzhou Elementary School outreach"
  },

  pengbo: {
    title: isChinesePage ? "私立芃博文理短期補習班" : "Private Pengbo Liberal Arts and Science Cram School",
    image: getAssetPath("images/outreach/3.webp"),
    alt: "Private Pengbo Liberal Arts and Science Cram School outreach"
  },

  yucheng: {
    title: isChinesePage ? "臺北市立育成高中" : "Taipei Municipal Yucheng Senior High School",
    image: getAssetPath("images/outreach/yucheng.jpg"),
    alt: "Taipei Municipal Yucheng Senior High School outreach"
  },

  xingya: {
    title: isChinesePage ? "興雅國小" : "Xing Ya Elementary School",
    image: getAssetPath("images/outreach/xingya.jpg"),
    alt: "Xing Ya Elementary School outreach"
  },

  fude: {
    title: isChinesePage ? "福德國小" : "Fude Elementary School",
    image: getAssetPath("images/outreach/fude.jpg"),
    alt: "Fude Elementary School outreach"
  },

  evergreen: {
    title: isChinesePage ? "長青幼兒園" : "Evergreen Kindergarten",
    image: getAssetPath("images/outreach/evergreen.jpg"),
    alt: "Evergreen Kindergarten outreach"
  },

  yonghe: {
    title: isChinesePage ? "新北市立永和國中" : "New Taipei Municipal Yonghe Junior High School",
    image: getAssetPath("images/outreach/yonghe.jpg"),
    alt: "New Taipei Municipal Yonghe Junior High School outreach"
  },

  yifang: {
    title: isChinesePage ? "義方國小" : "Yifang Elementary School",
    image: getAssetPath("images/outreach/yifang.jpg"),
    alt: "Yifang Elementary School outreach"
  },

  huaxing: {
    title: isChinesePage ? "華興育幼院" : "Huaxing Children’s Home",
    image: getAssetPath("images/outreach/huaxing.jpg"),
    alt: "Huaxing Children’s Home outreach"
  },

  daan: {
    title: isChinesePage ? "大安國小" : "Da’an Elementary School",
    image: getAssetPath("images/outreach/daan.jpg"),
    alt: "Da’an Elementary School outreach"
  },

  visual: {
    title: isChinesePage ? "臺北市立啟明學校" : "Taipei School for the Visually Impaired",
    image: getAssetPath("images/outreach/visual.jpg"),
    alt: "Taipei School for the Visually Impaired outreach"
  },

  xisong: {
    title: isChinesePage ? "西松高中" : "Xisong High School",
    image: getAssetPath("images/outreach/xisong.jpg"),
    alt: "Xisong High School outreach"
  },

  utaipei: {
    title: isChinesePage ? "台北市立大學附設國小" : "Affiliated Experimental Elementary School of University of Taipei",
    image: getAssetPath("images/outreach/1.webp"),
    alt: "Affiliated Experimental Elementary School of University of Taipei outreach"
  },

  dingxi: {
    title: isChinesePage ? "新北市頂溪國小" : "Dingxi Elementary School",
    image: getAssetPath("images/outreach/2.jpg"),
    alt: "Dingxi Elementary School outreach"
  },

  yongping: {
    title: isChinesePage ? "永平國小" : "Yongping Elementary School",
    image: getAssetPath("images/outreach/4.jpg"),
    alt: "Yongping Elementary School outreach"
  },

  fuhsing: {
    title: isChinesePage ? "臺北市私立復興實驗高級中學" : "Taipei Fuhsing Private School",
    image: getAssetPath("images/outreach/5.jpg"),
    alt: "Taipei Fuhsing Private School outreach"
  }
};

function updateOutreachMap(pointId) {
  const data = outreachMapData[pointId];

  if (!data) {
    return;
  }

  const titleEl = document.getElementById("map-info-title");
  const imageEl = document.getElementById("map-info-image");

  if (!titleEl || !imageEl) {
    return;
  }

  titleEl.textContent = data.title;
  imageEl.src = data.image;
  imageEl.alt = data.alt;

  document.querySelectorAll(".map-point, .map-point-button").forEach(point => {
    point.classList.toggle("active", point.dataset.mapPoint === pointId);
  });
}

function initOutreachMap() {
  const mapPoints = document.querySelectorAll(".map-point, .map-point-button");

  if (!mapPoints.length) {
    return;
  }

  mapPoints.forEach(point => {
    point.addEventListener("click", () => {
      updateOutreachMap(point.dataset.mapPoint);
    });

    point.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        updateOutreachMap(point.dataset.mapPoint);
      }
    });
  });

  const activePoint =
    document.querySelector(".map-point.active, .map-point-button.active") ||
    mapPoints[0];

  if (activePoint && activePoint.dataset.mapPoint) {
    updateOutreachMap(activePoint.dataset.mapPoint);
  }
}

/* ══════════════════════════════════════
   PAST PROJECTS TIMELINE
   Click a timeline dot to show that year only
══════════════════════════════════════ */

function initPastProjectsTimeline() {
  const projectTabs = document.querySelectorAll("[data-project-tab]");
  const projectPanels = document.querySelectorAll("[data-project-year]");

  if (!projectTabs.length || !projectPanels.length) {
    return;
  }

  function showProjectYear(year) {
    projectTabs.forEach(tab => {
      const isActive = tab.dataset.projectTab === year;
      tab.classList.toggle("active", isActive);

      const dot = tab.querySelector(".tl-dot");
      if (dot) {
        dot.classList.toggle("active", isActive);
      }
    });

    projectPanels.forEach(panel => {
      const isActive = panel.dataset.projectYear === year;
      panel.classList.toggle("active", isActive);
    });
  }

  projectTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      showProjectYear(tab.dataset.projectTab);
    });
  });

  const activeTab =
    document.querySelector("[data-project-tab].active") ||
    projectTabs[0];

  if (activeTab && activeTab.dataset.projectTab) {
    showProjectYear(activeTab.dataset.projectTab);
  }
}

/* ══════════════════════════════════════
   INITIALIZE PAGE FEATURES
══════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  initOutreachMap();
  initPastProjectsTimeline();
});
/* ══════════════════════════════════════
   AUTO-ADVANCING IMAGE CAROUSEL
   Works by duplicating slides so the
   CSS animation loops seamlessly.
   No JS timer needed — pure CSS scroll
   with JS only for dot sync.
══════════════════════════════════════ */

function initCarousels() {
  document.querySelectorAll('.carousel').forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    if (!track) return;

    const slides = Array.from(track.querySelectorAll('.carousel-slide'));
    if (!slides.length) return;

    // Duplicate all slides so the track is 2× wide → seamless loop
    slides.forEach(slide => {
      const clone = slide.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    });

    // Optional dot indicators — only for the real (non-cloned) slides
    const dotsContainer = carousel.parentElement.querySelector('.carousel-dots');
    if (!dotsContainer) return;

    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot' + (i === 0 ? ' active' : '');
      dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
      dotsContainer.appendChild(dot);
    });

    const dots = dotsContainer.querySelectorAll('.carousel-dot');
    const slideCount = slides.length;

    // Sync dots to animation progress
    function syncDots() {
      const duration = parseFloat(
        getComputedStyle(track).animationDuration
      ) * 1000 || 24000;

      const elapsed = (Date.now() % duration) / duration; // 0–1
      const index = Math.floor(elapsed * slideCount) % slideCount;

      dots.forEach((d, i) => d.classList.toggle('active', i === index));
    }

    // Run dot sync at ~10fps to save battery
    setInterval(syncDots, 100);

    // Clicking a dot jumps the animation to that slide's position
    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        const duration = parseFloat(
          getComputedStyle(track).animationDuration
        ) * 1000 || 24000;

        const fraction = i / slideCount;
        const delayMs = -(fraction * duration);

        track.style.animationDelay = `${delayMs}ms`;
      });
    });
  });
}

// Call in DOMContentLoaded (already defined above — extend it)
document.addEventListener('DOMContentLoaded', () => {
  initCarousels();
});