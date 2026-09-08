function houseCardHtml(h) {
  const count = h.memberCount;
  const badge = count
    ? `<span class="pill pill-count">Builds ${count}</span>`
    : `<span class="pill pill-empty">No builds yet</span>`;
  return `
  <div class="house-card" style="--card-color:${h.color}">
    <div class="house-icon">${HOUSE_ICONS[h.slug]}</div>
    <div class="house-faction">${h.faction}</div>
    <h3 class="house-name">${h.name}</h3>
    <p class="house-desc">${h.description}</p>
    ${badge}
    <a class="btn btn-primary btn-block" href="/house?h=${h.slug}">View tree →</a>
  </div>`;
}
