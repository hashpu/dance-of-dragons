let memberIndex = []; // [{ member, house }] across all unlocked houses, cached for instant search

// The main Houses grid only shows the great Houses of the Dance — crown
// orders (Kingsguard, Dragonguard, etc.) live under their own section on
// the Factions page instead.
async function getGreatHouses() {
  const all = await Api.getHouses();
  return all.filter((h) => h.faction !== "CROWN");
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
  document.getElementById("houseGrid").innerHTML = houses.map(houseCardHtml).join("");
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
    grid.innerHTML = houses.map(houseCardHtml).join("");
    results.innerHTML = "";
    return;
  }

  const matchingHouses = houses.filter((h) => matchesHouse(h, q));
  grid.innerHTML = matchingHouses.length
    ? matchingHouses.map(houseCardHtml).join("")
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
          <a class="member-hit" href="house.html?h=${house.slug}&highlight=${member.id}">
            <img src="${avatar}" alt="" onerror="this.onerror=null;this.src='${fallback}'" />
            <div>
              <div class="member-hit-name">${member.name}${member.role ? ` · ${member.role}` : ""}</div>
              <div class="member-hit-house" style="color:${house.color}">House ${house.name}</div>
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
