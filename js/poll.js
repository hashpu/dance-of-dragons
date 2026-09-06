/* Site-wide "which side are you on" poll — Team Green vs Team Black.
   One vote per Discord account (the site's existing "identify"-scope
   sign-in), tallied server-side in the votes table. See
   server/routes/votes.js. */

const POLL_TEAM_SIGILS = {
  green: "assets/sigils/team-green-dragon.jpg",
  black: "assets/sigils/team-black-dragon.jpg"
};

function pollTeamHtml({ side, label, pct, count, myVote, canVote }) {
  const isMine = myVote === side;
  const tag = isMine ? `<div class="poll-team-badge">✓ Your Pick</div>` : "";
  const inner = `
    ${tag}
    <div class="poll-team-content">
      <div class="poll-team-name">${label}</div>
      <div class="poll-team-pct">${pct}%</div>
      <div class="poll-team-count">${count} vote${count === 1 ? "" : "s"}</div>
    </div>
  `;
  const cls = `poll-team poll-team-${side}${isMine ? " active" : ""}`;
  const style = `style="background-image:url('${POLL_TEAM_SIGILS[side]}')"`;
  return canVote
    ? `<button type="button" class="${cls}" ${style} id="voteBtn-${side}">${inner}</button>`
    : `<div class="${cls}" ${style}>${inner}</div>`;
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
      <h1 class="poll-title">Cast Your Vote</h1>
      <p class="page-desc" style="max-width:480px; margin:0 auto">
        The realm is dividing. ${total ? `${total.toLocaleString()} vote${total === 1 ? "" : "s"} cast so far.` : "Be the first to declare."}
      </p>
    </div>
    <div class="poll-bar">
      <div class="poll-bar-fill poll-bar-green" style="width:${greenPct}%"></div>
      <div class="poll-bar-fill poll-bar-black" style="width:${blackPct}%"></div>
    </div>
    <div class="poll-teams">
      ${pollTeamHtml({ side: "green", label: "Team Green", pct: greenPct, count: data.green, myVote: data.myVote, canVote: !!user })}
      <div class="poll-vs"><span>VS</span></div>
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
