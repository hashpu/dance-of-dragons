const FACTION_ORDER = ["ROYAL HOUSE", "BLACK FACTION", "GREEN FACTION", "LORDS OF HARRENHAL", "NEUTRAL"];

const FACTION_INFO = {
  "ROYAL HOUSE": { color: "#e0483e", blurb: "House Targaryen itself — the crown both sides were fighting to control." },
  "BLACK FACTION": { color: "#4a90d9", blurb: "Bannermen who backed Rhaenyra Targaryen's claim to the Iron Throne." },
  "GREEN FACTION": { color: "#d4af37", blurb: "Bannermen who backed Aegon II's claim to the Iron Throne." },
  "LORDS OF HARRENHAL": { color: "#b08d57", blurb: "Riverlands lords holding the ruined seat of Harrenhal, drawn into the war by their claim to it." },
  NEUTRAL: { color: "#9a9a9e", blurb: "Houses that stayed out of the Dance for as long as they could." }
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
}

renderFactions();
