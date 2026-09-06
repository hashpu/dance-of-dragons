/* Site-wide "which side are you on" poll — Team Green vs Team Black.
   One vote per Discord account (the site's existing "identify"-scope
   sign-in), tallied server-side in the votes table. See
   server/routes/votes.js. */

function pollTeamHtml({ side, label, pct, count, myVote, canVote }) {
  const isMine = myVote === side;
  const icon = HOUSE_ICONS.targaryen;
  const tag = isMine ? `<div class="poll-team-badge">✓ Your Pick</div>` : "";
  const inner = `
    ${tag}
    <div class="poll-team-icon">${icon}</div>
    <div class="poll-team-name">${label}</div>
    <div class="poll-team-pct">${pct}%</div>
    <div class="poll-team-count">${count} vote${count === 1 ? "" : "s"}</div>
  `;
  const cls = `poll-team poll-team-${side}${isMine ? " active" : ""}`;
  return canVote
    ? `<button type="button" class="${cls}" id="voteBtn-${side}">${inner}</button>`
    : `<div class="${cls}">${inner}</div>`;
}

async function renderPoll() {
  const el = document.getElementById("pollWidget");
  if (!el) return;

  let data;
  try {
    data = await Api.getVotes();
  } catch (e) {
    el.hidden = true;
    return;
  }

  const total = data.total || 0;
  const greenPct = total ? Math.round((data.green / total) * 100) : 50;
  const blackPct = 100 - greenPct;
  const user = typeof getDiscordUser === "function" ? getDiscordUser() : null;

  el.innerHTML = `
    <div class="poll-header">
      <div class="eyebrow" style="justify-content:center">Dance of the Dragons</div>
      <h2 class="poll-title">Pick Your Side</h2>
    </div>
    <div class="poll-bar">
      <div class="poll-bar-fill poll-bar-green" style="width:${greenPct}%"></div>
      <div class="poll-bar-fill poll-bar-black" style="width:${blackPct}%"></div>
    </div>
    <div class="poll-teams">
      ${pollTeamHtml({ side: "green", label: "Team Green", pct: greenPct, count: data.green, myVote: data.myVote, canVote: !!user })}
      <div class="poll-vs">VS</div>
      ${pollTeamHtml({ side: "black", label: "Team Black", pct: blackPct, count: data.black, myVote: data.myVote, canVote: !!user })}
    </div>
    ${
      user
        ? `<p class="poll-note">${data.myVote ? "Riding for the realm. Click the other side any time to switch." : "Pick a side."}</p>`
        : `
          <button class="btn btn-outline poll-signin-btn" id="pollSignInBtn">Sign in with Discord to vote</button>
          <p class="poll-note">One vote per Discord account.</p>
        `
    }
  `;

  if (user) {
    document.getElementById("voteBtn-green").onclick = () => castVote("green");
    document.getElementById("voteBtn-black").onclick = () => castVote("black");
  } else {
    document.getElementById("pollSignInBtn").onclick = () => {
      if (typeof beginDiscordLogin === "function") beginDiscordLogin();
    };
  }
}

async function castVote(choice) {
  try {
    await Api.castVote(choice);
    await renderPoll();
  } catch (e) {
    if (typeof Dialog !== "undefined") {
      await Dialog.alert({ title: "Couldn't record your vote", message: e.message, icon: "warning", cardColor: "var(--red)" });
    } else {
      alert(e.message);
    }
  }
}

renderPoll();
