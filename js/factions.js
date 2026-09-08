// The Factions page only shows the crown orders — the great Houses of the
// Dance live on the main Houses page instead. Only one category exists here
// now, so there's no per-section header — the page's own title/description
// already covers it.
async function renderFactions() {
  const container = document.getElementById("factionsList");
  container.innerHTML = `<div class="house-grid">${Array(4).fill('<div class="skeleton-card"></div>').join("")}</div>`;
  const houses = await Api.getHouses();
  const crownHouses = houses.filter((h) => h.faction === "CROWN");
  container.innerHTML = crownHouses.length
    ? `<div class="house-grid">${crownHouses.map(houseCardHtml).join("")}</div>`
    : `<p class="empty-state">No crown orders yet.</p>`;
  scrollReveal(".house-card", container);
}

renderFactions();
