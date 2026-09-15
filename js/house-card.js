const HOUSE_CARD_PEOPLE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 2.5-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15 20c.3-2 1.7-3.3 4-3.3"/></svg>`;
const HOUSE_CARD_LOCK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`;

function houseCardHtml(h) {
  const count = h.memberCount;
  return `
  <div class="house-card" style="--card-color:${h.color}">
    <span class="house-card-corner house-card-corner-tl" aria-hidden="true"></span>
    <span class="house-card-corner house-card-corner-br" aria-hidden="true"></span>
    ${h.locked ? `<span class="house-lock-badge" title="Locked">${HOUSE_CARD_LOCK_ICON}</span>` : ""}
    <div class="house-card-head">
      <div class="house-icon"><span class="house-icon-ring"></span>${HOUSE_ICONS[h.slug]}</div>
      <div class="house-card-heading">
        <div class="house-faction">${h.faction}</div>
        <h3 class="house-name">${h.name}</h3>
      </div>
    </div>
    <p class="house-desc">${h.description}</p>
    <div class="house-card-footer">
      <div class="house-member-stat${count ? "" : " empty"}">
        ${HOUSE_CARD_PEOPLE_ICON}
        <span>${count || "No"} member${count === 1 ? "" : "s"}</span>
      </div>
      <a class="btn btn-primary" href="/house?h=${h.slug}">View tree →</a>
    </div>
  </div>`;
}
