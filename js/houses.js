let memberIndex = []; // [{ member, house }] across all unlocked houses, cached for instant search


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
  const houses = await Api.getHouses();
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
  const houses = await Api.getHouses();
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
    : `<p class="page-desc" style="grid-column:1/-1">No houses match "${query}".</p>`;

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
  const ok = window.confirm(
    "Reset ALL houses to their default lore, locks, and members — for every visitor? This cannot be undone."
  );
  if (!ok) return;
  const secret = window.prompt("Enter the admin secret:");
  if (!secret) return;
  try {
    await Api.resetAll(secret);
    document.getElementById("houseSearch").value = "";
    document.getElementById("searchResults").innerHTML = "";
    await renderHouseGrid();
  } catch (e) {
    alert(e.message);
  }
};
