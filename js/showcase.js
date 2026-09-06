function buildCardHtml(member, house) {
  const fallback = generatedAvatar(member.name, house.color);
  const avatar = member.avatarUrl || fallback;
  return `
    <a class="build-card" href="${member.buildLink}" target="_blank" rel="noopener" style="--card-color:${house.color}">
      <img class="build-avatar" src="${avatar}" alt="" onerror="this.onerror=null;this.src='${fallback}'" />
      <div class="build-name">${member.name}</div>
      <div class="build-role">${member.role || "&nbsp;"}</div>
      <div class="build-link-label">Open Roblox build ↗</div>
    </a>
  `;
}

async function renderShowcase() {
  const summaries = await Api.getHouses();
  const unlocked = summaries.filter((h) => !h.locked && h.memberCount > 0);
  const houses = await Promise.all(unlocked.map((h) => Api.getHouse(h.slug).catch(() => null)));
  const container = document.getElementById("showcaseList");

  const groups = houses
    .filter(Boolean)
    .map((h) => ({ house: h, members: h.members.filter((m) => m.buildLink) }))
    .filter((g) => g.members.length);

  if (!groups.length) {
    container.innerHTML = `
      <div class="empty-tree" style="padding:60px 0">
        No Roblox builds linked yet. Add one from any house's family tree — open a member's
        "More options" and fill in "Roblox build link".
      </div>
    `;
    return;
  }

  container.innerHTML = groups
    .map(
      ({ house, members }) => `
      <section class="faction-section">
        <div class="faction-header" style="--card-color:${house.color}">
          <div class="faction-name">House ${house.name}</div>
        </div>
        <div class="build-grid">${members.map((m) => buildCardHtml(m, house)).join("")}</div>
      </section>
    `
    )
    .join("");
  scrollReveal(".build-card", container);
}

renderShowcase();
