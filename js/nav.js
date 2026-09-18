/* Set your server's invite link here to activate the "Join Discord" button. */
const DISCORD_INVITE_URL = "https://discord.gg/eRHDDrnJZk";

const THEME_STORAGE_KEY = "got-theme";
const THEME_ICONS = {
  light: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>`,
  dark: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>`,
  system: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20"/></svg>`
};
const THEME_CHECK_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" }
];

function getThemePref() {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) || "system";
  } catch (e) {
    return "system";
  }
}

function setThemePref(value) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (e) {}
  document.documentElement.setAttribute("data-theme", value);
}

const NAV_ICONS = {
  houses: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5L12 4l8 6.5V19a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z"/></svg>`,
  factions: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-9 9-3 1 1-3 9-9z"/><path d="M13.5 8.5l2 2M4 20l3.5-3.5"/></svg>`,
  apply: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-6 0-13 4-15 12l-1 4 4-1C16 17 20 10 20 4z"/><path d="M9.5 14.5L4 20"/></svg>`,
  rules: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10a1 1 0 011 1v16l-3-2-3 2-3-2-3 2V4a1 1 0 011-1z"/><path d="M9 8h6M9 12h6"/></svg>`
};

function navEscapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

(async function () {
  const el = document.getElementById("topbar");
  if (!el) return;
  if (typeof consumeAuthRedirectHash === "function") await consumeAuthRedirectHash();
  const active = el.dataset.active || "";
  const links = [
    { href: "/", label: "Home", icon: "houses" },
    { href: "/factions", label: "Crown Orders", icon: "factions" },
    { href: "/apply", label: "Apply", icon: "apply" },
    { href: "/rules", label: "Rules", icon: "rules" }
  ];

  const user = typeof getDiscordUser === "function" ? getDiscordUser() : null;
  const robloxUser = typeof getRobloxUser === "function" ? getRobloxUser() : null;
  const memberSince = user && typeof discordAccountCreatedAt === "function" ? discordAccountCreatedAt(user) : null;

  // Most routes only verify+record a signed-in visitor's Discord identity as
  // a side effect of checking something specific (a Lord assignment, an
  // application) — someone who just browses an unlocked house, or a locked
  // one with no Lord configured yet, would never actually get recorded that
  // way, even though they're genuinely signed in. This runs once per page
  // load whenever a token is present, so being signed in anywhere on the
  // site is enough to show up in the admin/house "add spouse" search.
  // Fire-and-forget: a network hiccup here shouldn't affect page load. Also
  // doubles as how the profile card learns the signed-in visitor's actual
  // Discord server roles (identify-scope alone can't see those — only the
  // site's bot can, via the guild member lookup this endpoint runs).
  if (user && typeof Api !== "undefined") {
    Api.discordMe()
      .then((me) => {
        const section = document.getElementById("profileRolesSection");
        const rolesEl = document.getElementById("profileDiscordRoles");
        if (!section || !rolesEl || !me || !Array.isArray(me.roles) || !me.roles.length) return;
        rolesEl.innerHTML = me.roles
          .map((r) => `<span class="profile-badge profile-badge-role" style="${discordRoleBadgeCss(r.color)}">${navEscapeHtml(r.name)}</span>`)
          .join("");
        section.hidden = false;
      })
      .catch(() => {});
  }

  // Application decisions (approved/declined) the applicant hasn't dismissed
  // yet — the site-side half of notifying them, alongside the Discord DM
  // routes/applications.js sends. Fetched after the nav itself has already
  // rendered (like discordMe above) so a slow/failed request never delays
  // the page; the notification dot and card just pop in a moment later.
  // Only ever populated for someone who was actually signed in with Discord
  // when they applied — anyone else has nothing to show here.
  if (user && typeof Api !== "undefined") {
    Api.getMyApplications()
      .then((apps) => apps.filter((a) => !a.seen))
      .then((updates) => {
        if (!updates.length) return;
        const section = document.getElementById("appUpdatesSection");
        const dot = document.getElementById("userChipDot");
        if (!section || !dot) return;
        document.getElementById("appUpdates").innerHTML = updates.map(applicationUpdateHtml).join("");
        section.hidden = false;
        dot.hidden = false;
        wireAppUpdateDismissButtons();
      })
      .catch(() => {});
  }

  function applicationUpdateHtml(a) {
    if (a.type === "message") {
      return `
        <div class="app-update-card app-update-message" data-id="${a.id}" data-type="message">
          <div class="app-update-head">
            <span class="app-update-status">💬 Message</span>
            <span class="app-update-dept">${navEscapeHtml(a.departmentName)}</span>
          </div>
          <p class="app-update-reason">${navEscapeHtml(a.body)}</p>
          <button class="btn-link app-update-dismiss" data-action="dismiss-app-update" data-id="${a.id}" data-type="message">Dismiss</button>
        </div>
      `;
    }
    const approved = a.status === "approved";
    return `
      <div class="app-update-card ${approved ? "app-update-approved" : "app-update-declined"}" data-id="${a.id}">
        <div class="app-update-head">
          <span class="app-update-status">${approved ? "✅ Approved" : "❌ Declined"}</span>
          <span class="app-update-dept">${navEscapeHtml(a.departmentName)}</span>
        </div>
        ${!approved && a.declineReason ? `<p class="app-update-reason">${navEscapeHtml(a.declineReason)}</p>` : ""}
        <button class="btn-link app-update-dismiss" data-action="dismiss-app-update" data-id="${a.id}">Dismiss</button>
      </div>
    `;
  }

  function wireAppUpdateDismissButtons() {
    document.querySelectorAll('[data-action="dismiss-app-update"]').forEach((btn) => {
      btn.onclick = async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        btn.disabled = true;
        try {
          if (btn.dataset.type === "message") await Api.markApplicationMessageSeen(id);
          else await Api.markApplicationSeen(id);
        } catch (err) {
          btn.disabled = false;
          return;
        }
        btn.closest(".app-update-card")?.remove();
        if (!document.querySelectorAll(".app-update-card").length) {
          document.getElementById("appUpdatesSection")?.setAttribute("hidden", "");
          document.getElementById("userChipDot")?.setAttribute("hidden", "");
        }
      };
    });
  }

  const authHtml = user
    ? `
      <div class="profile-menu" id="profileMenu">
        <button class="user-chip" id="profileTrigger" type="button" aria-expanded="false">
          <img src="${discordAvatarUrl(user)}" alt="" />
          <span>${user.username}</span>
          <svg class="user-chip-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          <span class="user-chip-dot" id="userChipDot" hidden></span>
        </button>
        <div class="profile-card" id="profileCard" hidden style="--profile-accent:${discordAccentColorCss(user) || "var(--red)"}">
          <div class="profile-banner" style="${discordProfileBannerCss(user)}"></div>
          <div class="profile-body">
            <img class="profile-avatar" src="${discordAvatarUrl(user)}" alt="" />
            <div class="profile-name">${user.username}</div>
            ${memberSince ? `<div class="profile-meta">Discord member since ${memberSince.toLocaleDateString(undefined, { month: "short", year: "numeric" })}</div>` : ""}
            <div id="profileRolesSection" hidden>
              <div class="profile-divider"></div>
              <div class="profile-badges" id="profileDiscordRoles"></div>
            </div>
            <div id="appUpdatesSection" hidden>
              <div class="profile-divider"></div>
              <div class="app-updates" id="appUpdates"></div>
            </div>
            <div class="profile-badges">
              <span class="profile-badge profile-badge-verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg> Verified via Discord</span>
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
            <div class="profile-divider"></div>
            <button class="btn-link profile-signout" onclick="signOutDiscord()">Sign out</button>
          </div>
        </div>
      </div>`
    : `<button class="btn btn-outline" onclick="beginDiscordLogin()">Sign in</button>`;

  el.innerHTML = `
    <a href="/" class="brand"><span class="brand-icon">${HOUSE_ICONS.targaryen}</span>Dungeons &amp; Dragons</a>
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
      <div class="theme-menu" id="themeMenu">
        <button class="theme-trigger" id="themeTrigger" type="button" aria-label="Theme" aria-expanded="false">
          ${THEME_ICONS[getThemePref()]}
        </button>
        <div class="theme-card" id="themeCard" hidden>
          ${THEME_OPTIONS.map(
            (o) => `
            <button type="button" class="theme-option" data-theme-value="${o.value}">
              <span class="theme-option-icon">${THEME_ICONS[o.value]}</span>
              <span class="theme-option-label">${o.label}</span>
              <span class="theme-option-check">${THEME_CHECK_ICON}</span>
            </button>`
          ).join("")}
        </div>
      </div>
      ${authHtml}
      <a class="btn btn-primary" href="${DISCORD_INVITE_URL || "#"}">Join Discord</a>
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

  const themeTrigger = document.getElementById("themeTrigger");
  const themeCard = document.getElementById("themeCard");
  function markActiveThemeOption() {
    const current = getThemePref();
    themeCard.querySelectorAll(".theme-option").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.themeValue === current);
    });
  }
  markActiveThemeOption();
  themeTrigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = themeCard.hidden;
    themeCard.hidden = !isOpen;
    themeTrigger.setAttribute("aria-expanded", String(isOpen));
  });
  themeCard.querySelectorAll(".theme-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      setThemePref(btn.dataset.themeValue);
      themeTrigger.innerHTML = THEME_ICONS[btn.dataset.themeValue];
      markActiveThemeOption();
      themeCard.hidden = true;
      themeTrigger.setAttribute("aria-expanded", "false");
    });
  });
  document.addEventListener("click", (e) => {
    if (!themeCard.hidden && !e.target.closest("#themeMenu")) {
      themeCard.hidden = true;
      themeTrigger.setAttribute("aria-expanded", "false");
    }
  });

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
        <a class="footer-discord" href="${DISCORD_INVITE_URL || "#"}">Join the Discord</a>
      </div>
      <div class="footer-bottom">Fan-made lore site for a Roblox community. Not affiliated with HBO or George R. R. Martin.</div>
    </footer>
  `
  );
})();
