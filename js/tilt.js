/* Mouse-tracked 3D tilt for timeline cards and family-tree nodes. Uses
   event delegation on document so it works on elements rendered after this
   script loads. Skipped entirely on touch devices (no hover) and when the
   user prefers reduced motion. */
(function () {
  const SELECTOR = ".timeline-card, .node";
  const MAX_DEG = 7;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover)").matches) return;

  let activeCard = null;
  let frame = null;

  function setTilt(card, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    const rx = (0.5 - y) * MAX_DEG * 2;
    const ry = (x - 0.5) * MAX_DEG * 2;

    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      card.style.setProperty("--tilt-rx", rx.toFixed(2) + "deg");
      card.style.setProperty("--tilt-ry", ry.toFixed(2) + "deg");
      card.style.setProperty("--tilt-mx", (x * 100).toFixed(1) + "%");
      card.style.setProperty("--tilt-my", (y * 100).toFixed(1) + "%");
    });
  }

  function resetTilt(card) {
    card.style.setProperty("--tilt-rx", "0deg");
    card.style.setProperty("--tilt-ry", "0deg");
  }

  document.addEventListener("mousemove", (e) => {
    const card = e.target.closest(SELECTOR);
    if (card !== activeCard) {
      if (activeCard) resetTilt(activeCard);
      activeCard = card;
    }
    if (card) setTilt(card, e.clientX, e.clientY);
  });

  document.addEventListener(
    "mouseleave",
    () => {
      if (activeCard) resetTilt(activeCard);
      activeCard = null;
    },
    true
  );
})();
