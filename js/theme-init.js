/* Runs before the stylesheet loads so the page never flashes the wrong
   theme. Kept as its own tiny blocking script (not folded into nav.js,
   which loads much later and only after the DOM/CSS is already up) —
   see THEME_STORAGE_KEY in nav.js for the toggle UI that writes this. */
(function () {
  try {
    var t = localStorage.getItem("got-theme") || "system";
    document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
})();
