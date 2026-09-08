// The Factions page only shows the crown orders — the great Houses of the
// Dance live on the main Houses page instead. Only one category exists here
// now, so there's no per-section header — the page's own title/description
// already covers it.
const FACTION_STAT_ICONS = {
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`
};

function renderFactionStats(crownHouses) {
  const lockedCount = crownHouses.filter((h) => h.locked).length;
  document.getElementById("factionStats").innerHTML = `
    <div class="stat-pill">${FACTION_STAT_ICONS.shield}<span class="stat-value">${crownHouses.length}</span><span class="stat-label">Orders</span></div>
    <div class="stat-pill">${FACTION_STAT_ICONS.lock}<span class="stat-value">${lockedCount}</span><span class="stat-label">Locked</span></div>
  `;
}

async function renderFactions() {
  const container = document.getElementById("factionsList");
  container.innerHTML = `<div class="house-grid">${Array(4).fill('<div class="skeleton-card"></div>').join("")}</div>`;
  const houses = await Api.getHouses();
  const crownHouses = houses.filter((h) => h.faction === "CROWN");
  renderFactionStats(crownHouses);
  container.innerHTML = crownHouses.length
    ? `<div class="house-grid">${crownHouses.map(houseCardHtml).join("")}</div>`
    : `<p class="empty-state">No crown orders yet.</p>`;
  scrollReveal(".house-card", container);
}

renderFactions();
