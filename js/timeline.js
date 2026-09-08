const TAG_COLORS = { black: "#4a90d9", green: "#d4af37", neutral: "#9a9a9e" };
const TAG_LABELS = { black: "Team Black", green: "Team Green", neutral: "Neutral" };

const TYPE_ICONS = {
  death: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="10" r="7"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/><path d="M9 17v2M12 17.5v2.5M15 17v2"/></svg>`,
  battle: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5l14 14M19 5L5 19"/><path d="M5 5l2.5 1M19 5l-2.5 1M5 19l2.5-1M19 19l-2.5-1"/></svg>`,
  event: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M18 6l-2.5 2.5M8.5 15.5L6 18"/></svg>`
};

function timelineCardHtml(ev, color) {
  return `
    <div class="timeline-card">
      <div class="timeline-title">${ev.title}</div>
      <p class="timeline-desc">${ev.desc}</p>
      <span class="timeline-tag" style="background:color-mix(in srgb, ${color} 20%, transparent); color:${color}; border:1px solid color-mix(in srgb, ${color} 45%, transparent)">${TAG_LABELS[ev.tag]}</span>
    </div>
  `;
}

const rows = [];
let lastYear = null;
let sideIndex = 0;

TIMELINE_EVENTS.forEach((ev) => {
  if (ev.year !== lastYear) {
    rows.push(`<div class="timeline-year-marker"><span>${ev.year}</span></div>`);
    lastYear = ev.year;
  }

  const color = TAG_COLORS[ev.tag];
  const side = sideIndex % 2 === 0 ? "left" : "right";
  sideIndex++;

  rows.push(`
    <div class="timeline-row timeline-row-${side} reveal" style="--tag-color:${color}">
      ${timelineCardHtml(ev, color)}
      <div class="timeline-dot">${TYPE_ICONS[ev.type] || TYPE_ICONS.event}</div>
    </div>
  `);
});

document.getElementById("timelineList").innerHTML = rows.join("");

const revealItems = document.querySelectorAll(".timeline-row");
if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealItems.forEach((el) => io.observe(el));
}
