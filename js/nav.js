/* Set your server's invite link here to activate the "Join Discord" button. */
const DISCORD_INVITE_URL = "https://discord.gg/eRHDDrnJZk";

const NAV_ICONS = {
  houses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/></svg>`,
  timeline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.3"/><path d="M12 7.5V12l3 2"/></svg>`,
  factions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-9 9-3 1 1-3 9-9z"/><path d="M13.5 8.5l2 2M4 20l3.5-3.5"/></svg>`,
  showcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.2"/></svg>`,
  apply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-6 0-13 4-15 12l-1 4 4-1C16 17 20 10 20 4z"/><path d="M9.5 14.5L4 20"/></svg>`,
  rules: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10a1 1 0 011 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 011-1z"/><path d="M9 8h6M9 12h6"/></svg>`
};

(async function () {
  const el = document.getElementById("topbar");
  if (!el) return;
  if (typeof consumeAuthRedirectHash === "function") await consumeAuthRedirectHash();
  const active = el.dataset.active || "";
  const links = [
    { href: "index.html", label: "Houses", icon: "houses" },
    { href: "timeline.html", label: "Timeline", icon: "timeline" },
    { href: "factions.html", label: "Crown Orders", icon: "factions" },
    { href: "showcase.html", label: "Community", icon: "showcase" },
    { href: "apply.html", label: "Apply", icon: "apply" },
    { href: "rules.html", label: "Rules", icon: "rules" }
  ];

  const user = typeof getDiscordUser === "function" ? getDiscordUser() : null;
  const robloxUser = typeof getRobloxUser === "function" ? getRobloxUser() : null;
  const memberSince = user && typeof discordAccountCreatedAt === "function" ? discordAccountCreatedAt(user) : null;

  const authHtml = user
    ? `
      <div class="profile-menu" id="profileMenu">
        <button class="user-chip" id="profileTrigger" type="button" aria-expanded="false">
          <img src="${discordAvatarUrl(user)}" alt="" />
          <span>${user.username}</span>
        </button>
        <div class="profile-card" id="profileCard" hidden style="--profile-accent:${discordAccentColorCss(user) || "var(--red)"}">
          <div class="profile-banner" style="${discordProfileBannerCss(user)}"></div>
          <div class="profile-body">
            <img class="profile-avatar" src="${discordAvatarUrl(user)}" alt="" />
            <div class="profile-name">${user.username}</div>
            ${memberSince ? `<div class="profile-meta">Discord member since ${memberSince.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>` : ""}
            <div class="profile-badges">
              <span class="profile-badge profile-badge-verified">✓ Verified via Discord</span>
              ${discordBadges(user)
                .map(([, emoji, label]) => `<span class="profile-badge profile-badge-flag" title="${label}">${emoji} ${label}</span>`)
                .join("")}
            </div>
            ${robloxUser
              ? `
            <div class="profile-divider"></div>
            <div class="profile-roblox-header"><span>🎮 ${robloxUser.username || robloxUser.id}</span><button class="btn-link" style="margin:0" onclick="signOutRoblox()">Unlink</button></div>
            <div class="profile-badges" id="profileRobloxBadges"></div>`
              : ""}
            <button class="btn btn-outline btn-block" onclick="signOutDiscord()">Sign out</button>
          </div>
        </div>
      </div>`
    : `<button class="btn btn-outline" onclick="beginDiscordLogin()">Sign in</button>`;

  el.innerHTML = `
    <a href="index.html" class="brand"><span class="brand-icon">${HOUSE_ICONS.targaryen}</span>Dungeons &amp; Dragons</a>
    <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false">
      <svg class="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>
      <svg class="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <nav class="nav-links">
      ${links
        .map((l) => `<a href="${l.href}"${l.href === active ? ' class="active"' : ""}>${NAV_ICONS[l.icon]}${l.label}</a>`)
        .join("")}
    </nav>
    <div class="topbar-actions">
      ${authHtml}
      <a class="btn btn-primary" href="${DISCORD_INVITE_URL || "#"}" target="_blank" rel="noopener">Join Discord</a>
    </div>
  `;

  const toggle = document.getElementById("navToggle");
  toggle.addEventListener("click", () => {
    const isOpen = el.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
  });

  const profileTrigger = document.getElementById("profileTrigger");
  if (profileTrigger) {
    const profileCard = document.getElementById("profileCard");
    profileTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = profileCard.hidden;
      profileCard.hidden = !isOpen;
      profileTrigger.setAttribute("aria-expanded", String(isOpen));
    });
    document.addEventListener("click", (e) => {
      if (!profileCard.hidden && !e.target.closest("#profileMenu")) {
        profileCard.hidden = true;
        profileTrigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  const robloxBadgesEl = document.getElementById("profileRobloxBadges");
  if (robloxBadgesEl && robloxUser) {
    fetch(`/api/roblox/badges/${robloxUser.id}`)
      .then((res) => (res.ok ? res.json() : { badges: [] }))
      .then(({ badges }) => {
        robloxBadgesEl.innerHTML = (badges || [])
          .slice(0, 6)
          .map(
            (b) =>
              `<span class="profile-badge profile-badge-roblox" title="${b.name}">${b.iconUrl ? `<img src="${b.iconUrl}" alt="" />` : "🏅"} ${b.name}</span>`
          )
          .join("");
      })
      .catch(() => {});
  }

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand"><span class="brand-icon">${HOUSE_ICONS.targaryen}</span>Dungeons &amp; Dragons</div>
        <nav class="footer-links">
          ${links.map((l) => `<a href="${l.href}">${l.label}</a>`).join("")}
        </nav>
        <a class="footer-discord" href="${DISCORD_INVITE_URL || "#"}" target="_blank" rel="noopener">Join the Discord ↗</a>
      </div>
      <div class="footer-bottom">Fan-made lore site for a Roblox community. Not affiliated with HBO or George R. R. Martin.</div>
    </footer>
  `
  );
})();
