// Hero mode — video clip or live WebGL, decided once while the page is parsing.
//
// The three component pages (photometer, LPA, hydroponics) open on a scroll-driven
// walkthrough. Since 7 Oct 2026 that walkthrough is a pre-rendered clip scrubbed by the
// scroll (js/scrub-video.js); the WebGL story it was rendered from is still on the page
// and still works, it is just not loaded unless it is needed.
//
// The page's #story element names its clips:
//   data-src-desktop / data-src-phone        the two MP4s (16:9 and portrait)
//   data-poster-desktop / data-poster-phone  their first frames
// and the markup carries two <template>s, #hero-video and #hero-live3d, holding the
// script tags for each mode. load() writes ONE of them into the document right here,
// so its scripts run in order, before anything after this point, and the other mode's
// scripts (three.js and the models, in video mode) are never fetched.
//
// The rule:
//   ?live3d=1                 the WebGL story (re-rendering the clips needs it)
//   ?video=1                  the clip, whatever else is true (testing)
//   no clip named, or no H.264 in this browser          -> the WebGL story
//   a clip given as a path next to the page (clips/...)  -> the clip on localhost only.
//     Those files are local test copies: git-ignored, never deployed. Anywhere else the
//     page plays the WebGL story until the Video Universe URLs are put in, so a deploy
//     made before the swap still has a working hero.
//   anything else (an absolute URL)                      -> the clip.
window.HeroMode = (function () {
  "use strict";

  function decide(story) {
    const q = location.search;
    if (/[?&]live3d=1(?:&|$)/.test(q)) return "live3d";
    if (/[?&]video=1(?:&|$)/.test(q)) return "video";
    const d = story ? story.dataset : {};
    const a = d.srcDesktop, b = d.srcPhone;
    if (!a || !b) return "live3d";
    let h264 = "";
    try { h264 = document.createElement("video").canPlayType('video/mp4; codecs="avc1.640028"'); } catch (e) { /* no video */ }
    if (!h264) return "live3d";
    const local = function (u) { return !/^(https?:)?\/\//i.test(u); };
    const dev = location.protocol === "file:" ||
      /^(localhost|127\.0\.0\.1|\[::1\]|.*\.localhost|.*\.test)$/.test(location.hostname);
    if ((local(a) || local(b)) && !dev) return "live3d";
    return "video";
  }

  let mode = null;
  function load() {
    const story = document.getElementById("story");
    mode = decide(story);
    document.documentElement.classList.add("hero-" + mode);
    const tpl = document.getElementById("hero-" + mode);
    // document.write while parsing: the template's scripts become ordinary
    // parser-inserted scripts and run in order, right after this one.
    if (tpl) document.write(tpl.innerHTML);
    return mode;
  }

  return { decide: decide, load: load, get mode() { return mode; } };
})();
