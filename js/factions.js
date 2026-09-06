// The Factions page only shows the crown orders — the great Houses of the
// Dance live on the main Houses page instead.
const FACTION_ORDER = ["CROWN"];

const FACTION_INFO = {
  CROWN: { color: "#c7ae6b", blurb: "Sworn orders bound to the Iron Throne and the realm's peace, not to either side of the Dance." }
};

async function renderFactions() {
  const houses = await Api.getHouses();
  const container = document.getElementById("factionsList");
  container.innerHTML = FACTION_ORDER.map((faction) => {
    const info = FACTION_INFO[faction];
    const houseList = houses.filter((h) => h.faction === faction);
    if (!houseList.length) return "";
    return `
      <section class="faction-section">
        <div class="faction-header" style="--card-color:${info.color}">
          <div class="faction-name">${faction}</div>
          <p class="faction-blurb">${info.blurb}</p>
        </div>
        <div class="house-grid">${houseList.map(houseCardHtml).join("")}</div>
      </section>
    `;
  }).join("");
  scrollReveal(".house-card", container);
}

renderFactions();
