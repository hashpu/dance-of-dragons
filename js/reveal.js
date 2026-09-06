// Fades/slides matching elements into view as they scroll on screen, with a
// slight stagger between siblings. Call after the elements exist in the DOM.
function scrollReveal(selector, root = document) {
  const items = root.querySelectorAll(selector);
  if (!("IntersectionObserver" in window)) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  items.forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i, 8) * 0.06}s`;
    io.observe(el);
  });
}
