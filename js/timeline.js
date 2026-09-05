const TAG_COLORS = { black: "#4a90d9", green: "#d4af37", neutral: "#9a9a9e" };
const TAG_LABELS = { black: "Team Black", green: "Team Green", neutral: "Neutral" };

function timelineItemHtml(ev) {
  const color = TAG_COLORS[ev.tag];
  return `
    <div class="timeline-item" style="--tag-color:${color}">
      <div class="timeline-dot"></div>
      <div class="timeline-card">
        <div class="timeline-year">${ev.year}</div>
        <div class="timeline-title">${ev.title}</div>
        <p class="timeline-desc">${ev.desc}</p>
        <span class="timeline-tag" style="background:color-mix(in srgb, ${color} 20%, transparent); color:${color}; border:1px solid color-mix(in srgb, ${color} 45%, transparent)">${TAG_LABELS[ev.tag]}</span>
      </div>
    </div>
  `;
}

document.getElementById("timelineList").innerHTML = TIMELINE_EVENTS.map(timelineItemHtml).join("");

const revealItems = document.querySelectorAll(".timeline-item");
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
  revealItems.forEach((el) => {
    el.classList.add("reveal");
    io.observe(el);
  });
}
