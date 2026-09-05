/* Set your server's invite link here to activate the "Join Discord" button. */
const DISCORD_INVITE_URL = "https://discord.gg/eRHDDrnJZk";

const NAV_ICONS = {
  houses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/></svg>`,
  timeline: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.3"/><path d="M12 7.5V12l3 2"/></svg>`,
  factions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-9 9-3 1 1-3 9-9z"/><path d="M13.5 8.5l2 2M4 20l3.5-3.5"/></svg>`,
  showcase: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13" r="3.2"/></svg>`,
  apply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-6 0-13 4-15 12l-1 4 4-1C16 17 20 10 20 4z"/><path d="M9.5 14.5L4 20"/></svg>`
};

(function () {
  const el = document.getElementById("topbar");
  if (!el) return;
  const active = el.dataset.active || "";
  const links = [
    { href: "index.html", label: "Houses", icon: "houses" },
    { href: "timeline.html", label: "Timeline", icon: "timeline" },
    { href: "factions.html", label: "Factions", icon: "factions" },
    { href: "showcase.html", label: "Build Showcase", icon: "showcase" },
    { href: "apply.html", label: "Apply", icon: "apply" }
  ];

  const user = typeof getDiscordUser === "function" ? getDiscordUser() : null;
  const authHtml = user
    ? `
      <div class="user-chip">
        <img src="${discordAvatarUrl(user)}" alt="" />
        <span>${user.username}</span>
        <button class="btn-link" style="margin:0" onclick="signOutDiscord()">Sign out</button>
      </div>`
    : `<button class="btn btn-outline" onclick="beginDiscordLogin()">Sign in</button>`;

  el.innerHTML = `
    <a href="index.html" class="brand"><span class="brand-icon">${HOUSE_ICONS.targaryen}</span>Dance of Dragons</a>
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

  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand"><span class="brand-icon">${HOUSE_ICONS.targaryen}</span>Dance of Dragons</div>
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
