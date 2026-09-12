const MEDAL_CLASS = { 1: "leaderboard-gold", 2: "leaderboard-silver", 3: "leaderboard-bronze" };

function entityLabel(h) {
  return h.faction === "CROWN" ? h.name : "House " + h.name;
}

function leaderboardRowHtml(h, rank, leaderCount) {
  const fillPct = leaderCount ? Math.max(6, Math.round((h.memberCount / leaderCount) * 100)) : 0;
  const medalClass = MEDAL_CLASS[rank] || "";
  return `
    <a class="leaderboard-row ${medalClass}" href="/house?h=${h.slug}" style="--card-color:${h.color}; --fill:${fillPct}%">
      <span class="leaderboard-rank">${rank}</span>
      <span class="leaderboard-icon">${HOUSE_ICONS[h.slug] || ""}</span>
      <span class="leaderboard-info">
        <span class="leaderboard-name">${entityLabel(h)}</span>
        <span class="leaderboard-faction">${h.faction}</span>
      </span>
      <span class="leaderboard-count">
        ${h.memberCount}
        <span>member${h.memberCount === 1 ? "" : "s"}</span>
      </span>
    </a>
  `;
}

async function renderLeaderboard() {
  const el = document.getElementById("leaderboardList");
  el.innerHTML = Array(8)
    .fill('<div class="skeleton-card" style="height:64px"></div>')
    .join("");

  let houses;
  try {
    houses = await Api.getHouses();
  } catch (e) {
    el.innerHTML = `<p class="empty-state">Couldn't load the leaderboard right now. Try refreshing the page.</p>`;
    return;
  }

  const ranked = [...houses].sort((a, b) => b.memberCount - a.memberCount);
  const leaderCount = ranked.length ? ranked[0].memberCount : 0;

  el.innerHTML = ranked.map((h, i) => leaderboardRowHtml(h, i + 1, leaderCount)).join("");
  scrollReveal(".leaderboard-row", el);
}

renderLeaderboard();
