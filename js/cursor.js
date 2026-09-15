/* Replaces the system pointer with a small red dot that follows the mouse.
   Skipped on touch devices (no real mouse to track) and when the visitor
   prefers reduced motion. */
(function () {
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  document.documentElement.classList.add("custom-cursor");

  const dot = document.createElement("div");
  dot.className = "cursor-dot";
  document.body.appendChild(dot);

  window.addEventListener(
    "mousemove",
    (e) => {
      dot.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      dot.style.opacity = "1";
    },
    { passive: true }
  );

  document.addEventListener("mousedown", () => dot.classList.add("cursor-dot-active"));
  document.addEventListener("mouseup", () => dot.classList.remove("cursor-dot-active"));
  document.addEventListener("mouseleave", () => (dot.style.opacity = "0"));
})();
