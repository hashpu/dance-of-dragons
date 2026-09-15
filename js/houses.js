let memberIndex = []; // [{ member, house }] across all unlocked houses, cached for instant search

// The main Houses grid only shows the great Houses of the Dance — crown
// orders (Kingsguard, Dragonguard, etc.) live under their own section on
// the Factions page instead.
async function getGreatHouses() {
  const all = await Api.getHouses();
  return all.filter((h) => h.faction !== "CROWN");
}

// Groups the flat house list into its own section per faction, in a fixed
// narrative order (crown, then the two warring sides, then everyone who
// stayed out of it) instead of one undifferentiated grid — a faction not
// in this list (shouldn't happen, but data can change) still gets its own
// section, just appended after the ones we know about.
const FACTION_ORDER = ["ROYAL HOUSE", "BLACK FACTION", "GREEN FACTION", "NEUTRAL", "LORDS OF HARRENHAL"];
const FACTION_META = {
  "ROYAL HOUSE": {
    label: "The Royal House",
    blurb: "House Targaryen itself — dragonlords and rulers of the Seven Kingdoms.",
    color: "var(--gold)",
    icon: `<path d="M4 18h16M4 18l-1.4-8.6L8 12l4-7.5 4 7.5 5.4-2.6L20 18"/>`
  },
  "BLACK FACTION": {
    label: "Team Black",
    blurb: "Rallied behind Rhaenyra Targaryen's claim to the Iron Throne.",
    color: "#5b8def",
    icon: `<path d="M20 12.5A8 8 0 1111.5 4a6.3 6.3 0 008.5 8.5z"/>`
  },
  "GREEN FACTION": {
    label: "Team Green",
    blurb: "Backed Aegon II's claim to the throne after Viserys I's death.",
    color: "#6fae4a",
    icon: `<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>`
  },
  NEUTRAL: {
    label: "Neutral Houses",
    blurb: "Stayed out of the war outright, or waited to see which side would win.",
    color: "#9a9a9e",
    icon: `<path d="M12 3v3M5 7l-3 6a3 3 0 006 0zM19 7l-3 6a3 3 0 006 0zM5 7h14M9 21h6M12 6v15"/>`
  },
  "LORDS OF HARRENHAL": {
    label: "Lords of Harrenhal",
    blurb: "A dragonfire-cursed seat, claimed and re-claimed throughout the war.",
    color: "#e0622f",
    icon: `<path d="M12 2c3 4 6 6.5 6 10.5a6 6 0 01-12 0C6 8.5 9 6 12 2z"/><path d="M12 8c1.5 2 2.5 3.5 2.5 5a2.5 2.5 0 01-5 0c0-1.5 1-3 2.5-5z"/>`
  }
};

function groupHousesByFaction(houses) {
  const byFaction = new Map();
  houses.forEach((h) => {
    if (!byFaction.has(h.faction)) byFaction.set(h.faction, []);
    byFaction.get(h.faction).push(h);
  });
  const known = FACTION_ORDER.filter((f) => byFaction.has(f));
  const unknown = [...byFaction.keys()].filter((f) => !FACTION_ORDER.includes(f));
  return [...known, ...unknown].map((faction) => ({ faction, houses: byFaction.get(faction) }));
}

function factionSectionHtml({ faction, houses }) {
  const meta = FACTION_META[faction] || { label: faction, blurb: "", color: "var(--red)", icon: "" };
  return `
    <section class="faction-section" style="--faction-color:${meta.color}">
      <div class="faction-section-header">
        <div class="faction-section-title">
          ${
            meta.icon
              ? `<div class="faction-section-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg></div>`
              : ""
          }
          <div>
            <h2>${meta.label}</h2>
            ${meta.blurb ? `<p class="faction-section-blurb">${meta.blurb}</p>` : ""}
          </div>
        </div>
        <span class="faction-section-count">${houses.length} house${houses.length === 1 ? "" : "s"}</span>
      </div>
      <div class="house-grid">${houses.map(houseCardHtml).join("")}</div>
    </section>
  `;
}

const STAT_ICONS = {
  houses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/></svg>`
};

function renderStats(houses) {
  const lockedCount = houses.filter((h) => h.locked).length;

  document.getElementById("statsRow").innerHTML = `
    <div class="stat-pill">${STAT_ICONS.houses}<span class="stat-value">${houses.length}</span><span class="stat-label">Houses</span></div>
    <div class="stat-pill">${STAT_ICONS.lock}<span class="stat-value">${lockedCount}</span><span class="stat-label">Locked</span></div>
  `;
}

async function renderHouseGrid() {
  document.getElementById("houseGrid").innerHTML = Array(6).fill('<div class="skeleton-card"></div>').join("");
  const houses = await getGreatHouses();
  document.getElementById("houseGrid").innerHTML = groupHousesByFaction(houses).map(factionSectionHtml).join("");
  scrollReveal(".house-card", document.getElementById("houseGrid"));
  renderStats(houses);

  const unlocked = houses.filter((h) => !h.locked && h.memberCount > 0);
  const details = await Promise.all(unlocked.map((h) => Api.getHouse(h.slug).catch(() => null)));
  memberIndex = [];
  details.forEach((house) => {
    if (!house) return;
    house.members.forEach((member) => memberIndex.push({ member, house }));
  });

  return houses;
}

function matchesHouse(h, q) {
  return (
    h.name.toLowerCase().includes(q) ||
    h.faction.toLowerCase().includes(q) ||
    h.description.toLowerCase().includes(q)
  );
}

async function runSearch(query) {
  const houses = await getGreatHouses();
  const q = query.trim().toLowerCase();
  const grid = document.getElementById("houseGrid");
  const results = document.getElementById("searchResults");

  if (!q) {
    grid.innerHTML = groupHousesByFaction(houses).map(factionSectionHtml).join("");
    results.innerHTML = "";
    return;
  }

  const matchingHouses = houses.filter((h) => matchesHouse(h, q));
  grid.innerHTML = matchingHouses.length
    ? groupHousesByFaction(matchingHouses).map(factionSectionHtml).join("")
    : `<p class="empty-state">No houses match "${query}".</p>`;

  const memberHits = memberIndex.filter(
    ({ member }) => member.name.toLowerCase().includes(q) || (member.role || "").toLowerCase().includes(q)
  );

  if (!memberHits.length) {
    results.innerHTML = "";
    return;
  }

  results.innerHTML = `
    <div class="member-results">
      <div class="member-results-title">People matching "${query}"</div>
      ${memberHits
        .map(({ member, house }) => {
          const fallback = generatedAvatar(member.name, house.color);
          const avatar = member.avatarUrl || fallback;
          return `
          <a class="member-hit" href="/house?h=${house.slug}&highlight=${member.id}">
            <img src="${avatar}" alt="" onerror="this.onerror=null;this.src='${fallback}'" />
            <div>
              <div class="member-hit-name">${member.name}${member.role ? ` · ${member.role}` : ""}</div>
              <div class="member-hit-house" style="color:${house.color}">${house.faction === "CROWN" ? house.name : "House " + house.name}</div>
            </div>
          </a>`;
        })
        .join("")}
    </div>
  `;
}

renderHouseGrid();

document.getElementById("houseSearch").addEventListener("input", (e) => runSearch(e.target.value));

document.getElementById("resetAllBtn").onclick = async () => {
  const ok = await Dialog.confirm({
    kicker: "Admin only",
    title: "Reset all houses?",
    message: "This resets every house's lore, locks, and members back to default, for every visitor. This cannot be undone.",
    confirmText: "Reset everything",
    danger: true
  });
  if (!ok) return;
  const secret = await Dialog.prompt({
    kicker: "Admin only",
    title: "Enter admin secret",
    label: "Admin secret",
    type: "password",
    placeholder: "••••••••",
    confirmText: "Reset everything",
    icon: "lock"
  });
  if (!secret) return;
  try {
    await Api.resetAll(secret);
    document.getElementById("houseSearch").value = "";
    document.getElementById("searchResults").innerHTML = "";
    await renderHouseGrid();
  } catch (e) {
    await Dialog.alert({ title: "Couldn't reset", message: e.message, icon: "warning", cardColor: "var(--red)" });
  }
};

// Safe alternative to "Reset all houses" — only adds houses that don't
// exist in the database yet, never touching an existing house or its
// members. This is what should be used whenever new houses get added to
// the site going forward.
document.getElementById("seedMissingBtn").onclick = async () => {
  const secret = await Dialog.prompt({
    kicker: "Admin only",
    title: "Enter admin secret",
    label: "Admin secret",
    type: "password",
    placeholder: "••••••••",
    confirmText: "Add new houses",
    icon: "lock"
  });
  if (!secret) return;
  try {
    const { added } = await Api.seedMissingHouses(secret);
    await renderHouseGrid();
    await Dialog.alert({
      title: added.length ? "Houses added" : "Nothing to add",
      message: added.length
        ? `Added: ${added.join(", ")}. Every other house was left untouched.`
        : "Every house in the list already exists here.",
      icon: "info"
    });
  } catch (e) {
    await Dialog.alert({ title: "Couldn't add new houses", message: e.message, icon: "warning", cardColor: "var(--red)" });
  }
};
