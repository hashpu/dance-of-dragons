/* Site-wide "which side are you on" poll — Team Green vs Team Black.
   One vote per Discord account (the site's existing "identify"-scope
   sign-in), tallied server-side in the votes table. See
   server/routes/votes.js. */

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

  const actionsHtml = user
    ? `
      <div class="poll-vote-row">
        <button class="poll-vote-btn poll-vote-green${data.myVote === "green" ? " active" : ""}" id="voteGreenBtn">
          ${data.myVote === "green" ? "✓ " : ""}Team Green
        </button>
        <button class="poll-vote-btn poll-vote-black${data.myVote === "black" ? " active" : ""}" id="voteBlackBtn">
          ${data.myVote === "black" ? "✓ " : ""}Team Black
        </button>
      </div>
      <p class="poll-note">${data.myVote ? "You can change your vote any time." : "Signed in — pick a side."}</p>
    `
    : `
      <button class="btn btn-outline poll-signin-btn" id="pollSignInBtn">Sign in with Discord to vote</button>
      <p class="poll-note">One vote per Discord account.</p>
    `;

  el.innerHTML = `
    <div class="poll-header">
      <div class="eyebrow" style="justify-content:center">Choose Your Side</div>
      <h2 class="poll-title">Team Green or Team Black?</h2>
    </div>
    <div class="poll-bar">
      <div class="poll-bar-fill poll-bar-green" style="width:${greenPct}%"></div>
      <div class="poll-bar-fill poll-bar-black" style="width:${blackPct}%"></div>
    </div>
    <div class="poll-counts">
      <span class="poll-count-green">Green ${greenPct}% (${data.green})</span>
      <span class="poll-count-black">Black ${blackPct}% (${data.black})</span>
    </div>
    <div class="poll-actions">${actionsHtml}</div>
  `;

  if (user) {
    document.getElementById("voteGreenBtn").onclick = () => castVote("green");
    document.getElementById("voteBlackBtn").onclick = () => castVote("black");
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
