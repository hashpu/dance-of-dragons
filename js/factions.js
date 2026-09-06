// The Factions page only shows the crown orders — the great Houses of the
// Dance live on the main Houses page instead. Only one category exists here
// now, so there's no per-section header — the page's own title/description
// already covers it.
async function renderFactions() {
  const houses = await Api.getHouses();
  const container = document.getElementById("factionsList");
  const crownHouses = houses.filter((h) => h.faction === "CROWN");
  container.innerHTML = `<div class="house-grid">${crownHouses.map(houseCardHtml).join("")}</div>`;
  scrollReveal(".house-card", container);
}

renderFactions();
